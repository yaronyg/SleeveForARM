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
import WebappNodeAzure from "./webapp-node-azure";

export default class WebappNodeAzureInfrastructure extends WebappNodeAzure
        implements IInfrastructure.IInfrastructure, INamePassword {
    public securityName: string;
    public password: string;
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

        this.securityName = this.baseName;
        this.password = Crypto.randomBytes(20).toString("hex");

        return this;
    }

    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        let result = "";

        if (this.deploymentType === Resource.DeployType.LocalDevelopment) {
            result += this.setEnvironmentVariables();
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

        // tslint:disable-next-line:max-line-length
        result += `az webapp deployment user set --user-name \"${this.securityName}" --password \"${this.password}\"\n`;

        const keyVault =
            CommonUtilities
                .findGlobalDefaultResourceByType(this.resourcesInEnvironment,
                                                KeyVaultInfra) as KeyVaultInfra;
        result += keyVault.setSecret(this.securityName, this.password);

        // tslint:disable-next-line:max-line-length
        result += `az appservice plan create --name \"${this.webAppServicePlanName}\" \
--resource-group \"${resourceGroupName}\" --sku FREE\n`;

        // tslint:disable-next-line:max-line-length
        result += `$webappCreateResult=az webapp create --name \"${this.webAppDNSName}\" \
--resource-group \"${resourceGroupName}\" --plan \"${this.webAppServicePlanName}\ "
| ConvertFrom-Json \n`;

        // tslint:disable-next-line:max-line-length
        result += "Write-Host The web app front page URL is $webappCreateResult.defaultHostName\n";

        // tslint:disable-next-line:max-line-length
        result += `az webapp deployment source config-local-git \
--name \"${this.webAppDNSName}\" --resource-group \"${resourceGroupName}\" \
--query url --output tsv\n`;

        result += this.setEnvironmentVariables();

        return {
            // tslint:disable-next-line:max-line-length
            functionToCallAfterScriptRuns: async () =>
                await this.deployToWebApp(),
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
        for (const powerShellVariable of powerShellVariables) {
            result += `setx APPSETTING_${powerShellVariable.substring(1)} \
${powerShellVariable}\n`;
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

        return result;
    }

    private setEnvironmentVariables(): string {
        const storageResources =
            CommonUtilities.findResourcesByInterface<IStorageResource>(
                this.resourcesInEnvironment,
                CommonUtilities.isIStorageResource);
        let powerShellVariables: string[]  = [];
        for (const storageResource of storageResources) {
            powerShellVariables =
             powerShellVariables
                .concat(storageResource
                    .getPowershellConnectionVariableNames());
        }
        switch (this.deploymentType) {
            case Resource.DeployType.LocalDevelopment: {
                return this.setLocalEnvironmentVariables(powerShellVariables);
            }
            case Resource.DeployType.Production: {
                return this.setAzureEnvironmentVariables(powerShellVariables);
            }
            default: {
                throw new Error(`Unrecognized deployment type \
${this.deploymentType}`);
            }
        }
    }

    private async deployToWebApp(): Promise<void> {
        const resourceGroupName = this.resourceGroup.resourceGroupName;
        const getGitURL = `az webapp deployment source config-local-git \
--name \"${this.webAppDNSName}\" --resource-group \"${resourceGroupName}\" \
--query url --output tsv\n`;
        const webAppGitURLResult =
            await CommonUtilities.runAzCommand(getGitURL,
                    CommonUtilities.azCommandOutputs.string);

        const gitCloneDepotParentPath =
            Path.join(this.targetDirectoryPath, ".sleeve");

        const gitCloneDepotPath = Path.join(gitCloneDepotParentPath,
                                            this.webAppDNSName);

        await FS.emptyDirAsync(gitCloneDepotParentPath);

        const gitURLWithPassword =
            CommonUtilities.addPasswordToGitURL(webAppGitURLResult,
                                                this.password);

        await CommonUtilities.exec(
                Util.format("git clone %s", gitURLWithPassword),
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
