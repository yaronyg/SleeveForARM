import * as Crypto from "crypto";
import * as FS from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import INamePassword from "./INamePassword";
import IStorageResource from "./IStorageResource";
import KeyVaultInfra from "./keyvaultInfrastructure";
import * as Resource from "./resource";
import * as ServiceEnvironment from "./serviceEnvironmentUtilities";
import WebappNodeAzure from "./webapp-node-azure";

interface IPublishingProfile {
    publishMethod: string;
    userName: string;
    userPWD: string;
}

export default class WebappNodeAzureInfrastructure extends WebappNodeAzure
        implements IInfrastructure.IInfrastructure {
    public webAppServicePlanName: string;
    public webAppDNSName: string;

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

    public async deployResource(developmentDeploy = false)
            : Promise<IInfrastructure.IDeployResponse> {
        let result = "";

        if (this.deploymentType === Resource.DeployType.LocalDevelopment) {
            result += this.setEnvironmentVariablesAndFirewallRules();
            return {
                functionToCallAfterScriptRuns: async () => { return; },
                powerShellScript: result
            };
        }

        if (this.deploymentType !== Resource.DeployType.Production) {
            throw new Error(`Unrecognized deployment type \
${this.deploymentType}`);
        }

        const resourceGroupName = this.resourceGroup.resourceGroupName;

        result += CommonUtilities.appendErrorCheck(
`az appservice plan create \
--name "${this.webAppServicePlanName}" \
--resource-group "${resourceGroupName}" --sku FREE\n`);

        result += CommonUtilities.appendErrorCheck(
`$webappCreateResult = az webapp create \
--name "${this.webAppDNSName}" \
--resource-group "${resourceGroupName}" --plan "${this.webAppServicePlanName}" \
| ConvertFrom-Json \n`);

        result += "Write-Host The web app front page URL is \
$webappCreateResult.defaultHostName\n";

        result += CommonUtilities.appendErrorCheck(
`az webapp deployment source config-local-git \
--name "${this.webAppDNSName}" --resource-group "${resourceGroupName}" \
--query url --output tsv\n`);

        result +=
            this.setEnvironmentVariablesAndFirewallRules("$webappCreateResult");

        return {
            // tslint:disable-next-line:max-line-length
            functionToCallAfterScriptRuns: async () =>
                await this.deployToWebApp(developmentDeploy),
            powerShellScript: result
        };
    }

    public async getDeployedURL() {
        // tslint:disable-next-line:max-line-length
        const azResult = await CommonUtilities.runAzCommand(`az webapp show \
--resource-group ${this.resourceGroup.resourceGroupName} \
--name ${this.webAppDNSName}`);
        return "http://" + azResult.defaultHostName;
    }

    private setLocalEnvironmentVariables(powerShellVariables: string[])
                                        : string {
        let result = "";
        const sleevePath =
            CommonUtilities.localScratchDirectory(this.targetDirectoryPath);
        FS.ensureDirSync(sleevePath);
        const variablePath =
            Path.join(CommonUtilities
                        .localScratchDirectory(this.targetDirectoryPath),
                        ServiceEnvironment.environmentFileName);
        if (powerShellVariables.length > 0) {
            result += `New-Item "${variablePath}" -type file -force\n`;
        }
        for (const powerShellVariable of powerShellVariables) {
            const name = powerShellVariable.substring(1);
            result += `setx APPSETTING_${name} \
${powerShellVariable}\n`;
            result += `Add-Content "${variablePath}" \
"${name} ${powerShellVariable}"\n`;
        }
        return result;
    }

    private setAzureEnvironmentVariables(powerShellVariables: string[])
                                         : string {
        if (powerShellVariables.length === 0) {
            return "";
        }

        let result = `az webapp config appsettings set \
--name ${this.webAppDNSName} \
--resource-group ${this.resourceGroup.resourceGroupName} --settings `;

        for (const powerShellVariable of powerShellVariables) {
            result += `${powerShellVariable.substring(1)}=\
${powerShellVariable} `;
        }

        result += "\n";

        return CommonUtilities.appendErrorCheck(result);
    }

    private setEnvironmentVariablesAndFirewallRules(
            webAppResultVariableName?: string): string {
        let result = "";
        const storageResources =
            CommonUtilities.findResourcesByInterface<IStorageResource>(
                this.resourcesInEnvironment,
                CommonUtilities.isIStorageResource);
        let powerShellVariables: string[]  = [];
        for (const storageResource of storageResources) {
            powerShellVariables =
             powerShellVariables
                .concat(storageResource
                    .getEnvironmentVariables());
            if (webAppResultVariableName !== undefined) {
                result +=
`${storageResource.setFirewallRule()}(\
${webAppResultVariableName}.outboundIpAddresses -split ",")\n`;
            }
        }
        switch (this.deploymentType) {
            case Resource.DeployType.LocalDevelopment: {
                return result +
                    this.setLocalEnvironmentVariables(powerShellVariables);
            }
            case Resource.DeployType.Production: {
                return result +
                    this.setAzureEnvironmentVariables(powerShellVariables);
            }
            default: {
                throw new Error(`Unrecognized deployment type \
${this.deploymentType}`);
            }
        }
    }

    /**
     * Deploys a development version of SleeveForArm
     * @param gitCloneDepotPath
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
                Util.format("git clone %s", gitURL),
                    gitCloneDepotParentPath);

        const directoryContents = await FS.readdirAsync(gitCloneDepotPath);

        // It's a git depo so it always has a hidden .git file, hence there
        // will be at least one file
        if (directoryContents.length > 1) {
            // This command fails if there isn't at least one file in the
            // directory, hence why we have the check above.
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
}
