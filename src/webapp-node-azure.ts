import { randomBytes } from "crypto";
import * as fs from "fs-extra-promise";
import * as path from "path";
import { format } from "util";
import { addPasswordToGitURL, azCommandOutputs, exec,
        runAzCommand, runExecFailOnStderr } from "./common-utilities";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";

export default class WebappNodeAzure extends Resource.Resource {
    public static async setup(targetDirectoryPath: string): Promise<void> {
        return ResourceGroup.internalSetup(__filename, targetDirectoryPath);
    }
    private static findDefaultResourceGroup(resources: Resource.Resource[])
                    : ResourceGroup {
        const globalResourceGroup = resources.find((resource) => {
            return resource instanceof ResourceGroup &&
                resource.isGlobalDefault;
        }) as ResourceGroup;

        if (globalResourceGroup !== undefined) {
            return globalResourceGroup;
        }

        throw new Error("There is no global default resource group object!");
    }

    private resourceGroup: ResourceGroup;

    private webAppServicePlanNameProperty: string;

    private webAppDNSNameProperty: string;

    public get webAppServicePlanName() {
        return this.webAppServicePlanNameProperty;
    }

    public setWebAppServicePlanName(name: string) {
        this.webAppServicePlanNameProperty = name;
        return this;
    }

    public get webAppDNSName() {
        return this.webAppDNSNameProperty;
    }

    public setWebAppServiceDNSName(name: string) {
        this.webAppDNSNameProperty = name;
        return this;
    }

    public async deployResource(resources: Resource.Resource[])
                                : Promise<Resource.IDeployResponse> {
        let result = "";
        const userName = randomBytes(10).toString("hex");
        const password = randomBytes(20).toString("hex");
        // tslint:disable-next-line:max-line-length
        result += `az webapp deployment user set --user-name \"${userName}" --password \"${password}\"\n`;

        if (this.resourceGroup === undefined) {
            this.resourceGroup =
                WebappNodeAzure.findDefaultResourceGroup(resources);
        }

        if (this.webAppServicePlanName === undefined) {
            this.setWebAppServicePlanName(
                this.resourceGroup.resourceGroupName +
                    this.baseName + "webAppPlan");
        }

        // tslint:disable-next-line:max-line-length
        result += `az appservice plan create --name \"${this.webAppServicePlanName}\" --resource-group \"${this.resourceGroup.resourceGroupName}\" --sku FREE\n`;

        if (this.webAppDNSNameProperty === undefined) {
            this.setWebAppServiceDNSName(
                this.resourceGroup.resourceGroupName +
                    this.baseName + "webapp");
        }

        // tslint:disable-next-line:max-line-length
        result += `$webappCreateResult=az webapp create --name \"${this.webAppDNSName}\" --resource-group \"${this.resourceGroup.resourceGroupName}\" --plan \"${this.webAppServicePlanName}\"\n`;
        result += "Write-Host The web app front page URL is $webappCreateResult.defaultHostName\n";
        // tslint:disable-next-line:max-line-length
        result += `az webapp deployment source config-local-git --name \"${this.webAppDNSName}\" --resource-group \"${this.resourceGroup.resourceGroupName}\" --query url --output tsv\n`;

        return {
            // tslint:disable-next-line:max-line-length
            functionToCallAfterScriptRuns: async () => await this.deployToWebApp(this.directoryPath, password),
            powerShellScript: result
        };
    }

    public async getDeployedURL() {
        // tslint:disable-next-line:max-line-length
        const azResult = await runAzCommand(`az webapp show --resource-group ${this.resourceGroup.resourceGroupName} --name ${this.webAppDNSName}`);
        return "http://" + azResult.defaultHostName;
    }

    private async deployToWebApp(directoryPath: string, password: string)
            : Promise<void> {
        const webAppGitURLResult =
            await runAzCommand(
                format("az webapp deployment source config-local-git \
                        --name \"%s\" --resource-group \"%s\" \
                        --query url --output tsv", this.webAppDNSName,
                        this.resourceGroup.resourceGroupName),
                    azCommandOutputs.string);

        const gitCloneDepotParentPath = path.join(directoryPath, ".sleeve");

        const gitCloneDepotPath = path.join(gitCloneDepotParentPath,
                                            this.webAppDNSName);

        await fs.emptyDirAsync(gitCloneDepotParentPath);

        const gitURLWithPassword = addPasswordToGitURL(webAppGitURLResult,
                                                        password);

        await exec(format("git clone %s", gitURLWithPassword),
                    gitCloneDepotParentPath);

        const directoryContents = await fs.readdirAsync(gitCloneDepotPath);
        console.log(`directoryContents: ${directoryContents}`);

        // It's a git depo so it always has a hidden .git file, hence there
        // will be at least one file
        if (directoryContents.length > 1) {
            // This command fails if there isn't at least one file in the
            // directory, hence why we have the check above.
            await exec("git rm -f -r -q *", gitCloneDepotPath);
        }

        const nodeModulesPath = path.join(directoryPath, "node_modules");
        const sleevePath = path.join(directoryPath, ".sleeve");
        await fs.copyAsync(directoryPath, gitCloneDepotPath, {
            filter: (src) => (src !== nodeModulesPath && src !== sleevePath)
        });

        await exec("git add -A", gitCloneDepotPath);

        const result =
            await exec("git status --porcelain=v2", gitCloneDepotPath);

        if (result.stdout !== "") {
            await exec("git commit -am \"Prep for release\"",
                        gitCloneDepotPath);

            await exec("git push", gitCloneDepotPath);
        }
    }
}
