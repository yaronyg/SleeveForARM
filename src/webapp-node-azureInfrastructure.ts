import * as Crypto from "crypto";
import * as FS from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import KeyVaultInfra from "./keyvaultInfrastructure";
import * as Resource from "./resource";
import WebappNodeAzure from "./webapp-node-azure";

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
        return WebappNodeAzure.internalSetup(__filename,
                                             this.targetDirectoryPath);
    }

    public async hydrate(resourcesInEnvironment: Resource.Resource[])
                    : Promise<this> {
        await super.hydrate(resourcesInEnvironment);

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

    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        let result = "";
        const resourceGroupName = this.resourceGroup.resourceGroupName;

        const userName = this.webAppDNSName;
        const password = Crypto.randomBytes(20).toString("hex");
        // tslint:disable-next-line:max-line-length
        result += `az webapp deployment user set --user-name \"${userName}" --password \"${password}\"\n`;

        const keyVault =
            CommonUtilities
                .findGlobalResourceResourceByType(this.resourcesInEnvironment,
                                                KeyVaultInfra) as KeyVaultInfra;
        result += keyVault.setSecret(userName, password);

        // tslint:disable-next-line:max-line-length
        result += `az appservice plan create --name \"${this.webAppServicePlanName}\" \
--resource-group \"${resourceGroupName}\" --sku FREE\n`;

        // tslint:disable-next-line:max-line-length
        result += `$webappCreateResult=az webapp create --name \"${this.webAppDNSName}\" \
--resource-group \"${resourceGroupName}\" --plan \"${this.webAppServicePlanName}\"\n`;

        // tslint:disable-next-line:max-line-length
        result += "Write-Host The web app front page URL is $webappCreateResult.defaultHostName\n";

        // tslint:disable-next-line:max-line-length
        result += `az webapp deployment source config-local-git \
--name \"${this.webAppDNSName}\" --resource-group \"${resourceGroupName}\" \
--query url --output tsv\n`;

        return {
            // tslint:disable-next-line:max-line-length
            functionToCallAfterScriptRuns: async () =>
                await this.deployToWebApp(password),
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

    private async deployToWebApp(password: string): Promise<void> {
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
            CommonUtilities.addPasswordToGitURL(webAppGitURLResult, password);

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
