import * as FS from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import BaseDeployStorageResource from "./BaseDeployStorageResource";
import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import IStorageResource from "./IStorageResource";
import PromiseGate from "./promiseGate";
import * as Resource from "./resource";
import * as ServiceEnvironment from "./serviceEnvironmentUtilities";
import WebappNodeAzure from "./webapp-node-azure";

interface IPublishingProfile {
    publishMethod: string;
    userName: string;
    userPWD: string;
}

export class BaseDeployWebappNodeAzureInfrastructure {
    constructor(private nodeInfra: WebappNodeAzureInfrastructure) {}
    public async getDeployedURL() {
        // tslint:disable-next-line:max-line-length
        const azResult = await CommonUtilities.runAzCommand(`az webapp show \
--resource-group ${this.nodeInfra.resourceGroup.resourceGroupName} \
--name ${this.nodeInfra.webAppDNSName}`);
        return "http://" + azResult.defaultHostName;
    }
}

export class WebappNodeAzureInfrastructure extends WebappNodeAzure
        // tslint:disable-next-line:max-line-length
        implements IInfrastructure.IInfrastructure<BaseDeployWebappNodeAzureInfrastructure> {
    public webAppServicePlanName: string;
    public webAppDNSName: string;
    private readonly promiseGate = new PromiseGate();

    public initialize(resource: WebappNodeAzure | null,
                      targetDirectoryPath: string): this {
        super.initialize(resource, targetDirectoryPath);
        if (resource !== null) {
            Object.assign(this, resource);
        }
        return this;
    }

    public async setup(): Promise<void> {
        return await WebappNodeAzure.internalSetup(__filename,
                                             this.targetDirectoryPath);
    }

    public async hydrate(resourcesInEnvironment: Resource.Resource[],
                         deploymentType: Resource.DeployType)
                    : Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);

        if (this.webAppDNSName === undefined) {
            this.webAppDNSName = this.resourceGroup.resourceGroupName +
                                 this.baseName;
        }

        if (this.webAppServicePlanName === undefined) {
            this.webAppServicePlanName =
                this.resourceGroup.resourceGroupName +
                    this.baseName + "webAppPlan";
        }

        return this;
    }

    public async deployResource(developmentDeploy = false): Promise<this> {
        await this.resourceGroup.getBaseDeployClassInstance();
        const storageResources =
            CommonUtilities.findInfraResourcesByInterface<IStorageResource>(
                this.resourcesInEnvironment,
                CommonUtilities.isIStorageResource);
        const storagePromisesToWaitFor
            : Array<Promise<BaseDeployStorageResource>> = [];
        for (const storageResource of storageResources) {
            storagePromisesToWaitFor
                .push(storageResource.getBaseDeployClassInstance());
        }

        await (this.deploymentType === Resource.DeployType.Production ?
            this.deployToProduction(developmentDeploy,
                storagePromisesToWaitFor) :
            this.deployToDev(storagePromisesToWaitFor));

        this.promiseGate
            .openGateSuccess(new BaseDeployWebappNodeAzureInfrastructure(this));

        return this;
    }

    public getBaseDeployClassInstance()
        : Promise<BaseDeployWebappNodeAzureInfrastructure> {
        return this.promiseGate.promise.then(
            function(baseClass: BaseDeployWebappNodeAzureInfrastructure) {
                return baseClass;
            });
    }
    private async deployToDev(storagePromisesToWaitFor
            : Array<Promise<BaseDeployStorageResource>>) {
        const baseStorageResources: BaseDeployStorageResource[] =
             await Promise.all(storagePromisesToWaitFor);

        let environmentVariablesArray: Array<[string, string]> = [];
        for (const baseStorageResource of baseStorageResources) {
            environmentVariablesArray =
                [...environmentVariablesArray,
                 ...baseStorageResource.getEnvironmentVariables()];
        }

        const sleevePath =
            CommonUtilities.localScratchDirectory(this.targetDirectoryPath);
        await FS.ensureDirAsync(sleevePath);
        const variablePath =
            Path.join(CommonUtilities
                        .localScratchDirectory(this.targetDirectoryPath),
                      ServiceEnvironment.environmentFileName);
        FS.removeSync(variablePath);
        for (const nameValuePair of environmentVariablesArray) {
            FS.appendFileSync(variablePath,
                `${nameValuePair[0]} ${nameValuePair[1]}\n`);
        }
    }

    private async deployToProduction(
        developmentDeploy: boolean,
        storagePromisesToWaitFor
            : Array<Promise<BaseDeployStorageResource>>) {
        const resourceGroupName = this.resourceGroup.resourceGroupName;
        const webPromise =
            CommonUtilities.runAzCommand(
`az appservice plan create \
--name ${this.webAppServicePlanName} \
--resource-group ${resourceGroupName} --sku FREE`)
            .then(() => {
                return CommonUtilities.runAzCommand(
`az webapp create \
--name ${this.webAppDNSName} \
--resource-group ${resourceGroupName} \
--plan ${this.webAppServicePlanName}`, CommonUtilities.azCommandOutputs.json);
        });

        const webAppCreateResult = await webPromise;
        const baseStorageResources: BaseDeployStorageResource[]
            = await Promise.all(storagePromisesToWaitFor);

        let environmentVariablesArray: Array<[string, string]> = [];

        const secondStepPromises: Array<Promise<any>> = [];
        const webAppIPs: string[] =
            webAppCreateResult.outboundIpAddresses.split(",");
        for (const baseStorageResource of baseStorageResources) {
            webAppIPs.forEach((ipAddr) => {
                secondStepPromises.push(
                    baseStorageResource
                        .setFirewallRule(this.baseName, ipAddr));
            });

            environmentVariablesArray =
                [...environmentVariablesArray,
                 ...baseStorageResource.getEnvironmentVariables()];
        }

        let environmentalVariables: string = "";

        for (const variablePair of environmentVariablesArray) {
            environmentalVariables += `${variablePair[0]}=${variablePair[1]} `;
        }

        if (environmentalVariables !== "") {
            secondStepPromises.push(CommonUtilities.runAzCommand(
`az webapp config appsettings set \
--name ${this.webAppDNSName} \
--resource-group ${this.resourceGroup.resourceGroupName} \
--settings ${environmentalVariables}`));
        }

        await Promise.all(secondStepPromises);

        await CommonUtilities.runAzCommand(
`az webapp deployment source config-local-git \
--name ${this.webAppDNSName} --resource-group ${resourceGroupName} \
--query url --output tsv`, CommonUtilities.azCommandOutputs.string);

        await this.deployToWebApp(developmentDeploy);
    }

    /**
     * Handles copying the local web app code to Azure
     * @developmentDeploy This is only used for development of sleeveforarm,
     * it lets us know we need to deploy to the webapp a development version
     * of sleeveforarm.
     */
    private async deployToWebApp(developmentDeploy = false): Promise<void> {
        const resourceGroupName = this.resourceGroup.resourceGroupName;

        const profiles: IPublishingProfile[] =
            await CommonUtilities.runAzCommand(
`az webapp deployment list-publishing-profiles --name ${this.webAppDNSName} \
--resource-group ${resourceGroupName}`);

        const msDeployProfile = profiles.find((profile) =>
            profile.publishMethod === "MSDeploy");

        if (msDeployProfile === undefined) {
            throw new Error("We didn't find the MSDeploy profile, huh?");
        }

        const username = msDeployProfile.userName;
        const password = msDeployProfile.userPWD;

        const gitURL =
// tslint:disable-next-line:max-line-length
`https://${username}:${password}@${this.webAppDNSName}.scm.azurewebsites.net/${this.webAppDNSName}.git`;

        const gitCloneDepotParentPath =
            CommonUtilities.localScratchDirectory(this.targetDirectoryPath);

        const gitCloneDepotPath = Path.join(gitCloneDepotParentPath,
                                            this.webAppDNSName);

        await FS.emptyDirAsync(gitCloneDepotParentPath);

        await CommonUtilities.exec(
                Util.format(`git clone ${gitURL}`),
                    gitCloneDepotParentPath);

        const directoryContents = await FS.readdirAsync(gitCloneDepotPath);

        // It's a git depo so it always has a hidden .git file, hence there
        // will be at least one file
        if (directoryContents.length > 1) {
            // This command fails if there isn't at least one file (other than
            // .git) in the directory, hence why we have the check above.
            await CommonUtilities.exec("git rm -f -r -q *", gitCloneDepotPath);
        }

        const nodeModulesPath =
            Path.join(this.targetDirectoryPath, "node_modules");
        const sleevePath = Path.join(this.targetDirectoryPath, ".sleeve");
        await FS.copyAsync(this.targetDirectoryPath, gitCloneDepotPath, {
            filter: (src) => (src !== nodeModulesPath && src !== sleevePath)
        });

        if (developmentDeploy) {
            await this.developDeployToWebApp(gitCloneDepotPath);
        }

        await CommonUtilities.exec("git add -A", gitCloneDepotPath);

        const result =
            await CommonUtilities.exec("git status --porcelain=v2",
                                       gitCloneDepotPath);

        if (result.stdout !== "") {
            await CommonUtilities.exec("git commit -am \"Prep for release\"",
                        gitCloneDepotPath);

            await CommonUtilities.exec("git push", gitCloneDepotPath);
        }
    }

    /**
     * Deploys a development version of SleeveForArm
     */
    private async developDeployToWebApp(gitCloneDepotPath: string)
                                        : Promise<void> {
        // We want to clone node_modules in this case so we need to
        // get rid of .gitignore
        await FS.removeAsync(Path.join(gitCloneDepotPath, ".gitignore"));

        const sleeveForArmClonePath =
            Path.join(gitCloneDepotPath, "sleeveforarm") ;
        await FS.ensureDirAsync(sleeveForArmClonePath);

        const depotPath = Path.join(__dirname, "..");

        const disposableTestFilesPath =
            Path.join(depotPath, "disposableTestFiles");
        const nodeModulesPath =
            Path.join(depotPath, "node_modules");

        await FS.copyAsync(depotPath, sleeveForArmClonePath, {
            filter: (src) => (src !== disposableTestFilesPath) &&
                             (src !== nodeModulesPath)
        });

        // Need to make the node module files just look like regular files
        // Otherwise the WebApp Git Repo will treat sleeveforarm as a
        // sub-module and not properly copy it over.
        await FS.removeAsync(Path.join(sleeveForArmClonePath, ".git"));

        // Otherwise we won't check in any of the .js or other files we normally
        // ignore.
        await FS.removeAsync(Path.join(sleeveForArmClonePath, ".gitignore"));
    }
}
