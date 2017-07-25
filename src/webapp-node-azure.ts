import * as childProcess from "child_process";
import { randomBytes } from "crypto";
import * as fs from "fs-extra-promise";
import * as path from "path";
import { format } from "util";
import { addPasswordToGitURL, azCommandOutputs, runAzCommand,
        runExecFailOnStderr } from "./common-utilities";
import Resource from "./resource";
import ResourceGroup from "./resourcegroup";

export default class WebappNodeAzure extends Resource {
    private static findDefaultResourceGroup(resources: Resource[])
                    : ResourceGroup {
        let globalResourceGroup = resources.find((resource) => {
            return resource instanceof ResourceGroup &&
                resource.isGlobalDefault;
        }) as ResourceGroup;

        if (globalResourceGroup !== undefined) {
            return globalResourceGroup;
        }

        globalResourceGroup = resources.find((resource) => {
            return resource instanceof ResourceGroup;
        }) as ResourceGroup;

        if (globalResourceGroup !== undefined) {
            return globalResourceGroup;
        }

        throw new Error("There is no defined resource group object!");
    }

    private appBaseName: string;

    private resourceGroup: ResourceGroup;

    private webAppServicePlanNameProperty: string;

    private webAppDNSNameProperty: string;

    public get webAppServicePlanName() {
        return this.webAppServicePlanNameProperty;
    }

    public setWebAppServicePlanName(name: string): WebappNodeAzure {
        this.webAppServicePlanNameProperty = name;
        return this;
    }

    public get webAppDNSName() {
        return this.webAppDNSNameProperty;
    }

    public setWebAppServiceDNSName(name: string): WebappNodeAzure {
        this.webAppDNSNameProperty = name;
        return this;
    }

    public async deployResource(directoryPath: string,
                                resources: Resource[]): Promise<void> {
        const userName = randomBytes(10).toString("hex");
        const password = randomBytes(20).toString("hex");
        await runAzCommand(
            format("az webapp deployment user set --user-name \"%s\"\
            --password \"%s\"", userName, password));

        if (this.appBaseName === undefined) {
            this.appBaseName = path.basename(directoryPath);
        }

        if (this.resourceGroup === undefined) {
            this.resourceGroup =
                WebappNodeAzure.findDefaultResourceGroup(resources);
        }

        if (this.webAppServicePlanName === undefined) {
            this.setWebAppServicePlanName(
                this.resourceGroup.resourceGroupName +
                    path.basename(directoryPath) + "webAppPlan");
        }

        await runAzCommand(
            format("az appservice plan create --name \"%s\" \
                    --resource-group \"%s\" --sku FREE",
                    this.webAppServicePlanName,
                    this.resourceGroup.resourceGroupName));

        if (this.webAppDNSNameProperty === undefined) {
            this.setWebAppServiceDNSName(
                this.resourceGroup.resourceGroupName +
                    path.basename(directoryPath) + "webapp");
        }

        await runAzCommand(
            format("az webapp create --name \"%s\" \
                    --resource-group \"%s\" --plan \"%s\"",
                this.webAppDNSName,
                this.resourceGroup.resourceGroupName,
                this.webAppServicePlanName));

        await this.deployToWebApp(directoryPath, password);
    }

    public async setup(directoryPath: string) {
        fs.copyAsync(path.join(__dirname, "../assets/webapp-node-azure"),
                        directoryPath);
    }

    private async deployToWebApp(directoryPath: string, password: string) {
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

        await fs.ensureDirAsync(gitCloneDepotParentPath);

        const gitURLWithPassword = addPasswordToGitURL(webAppGitURLResult,
                                                        password);

        await childProcess.exec(format("git clone %s", gitURLWithPassword),
                                { cwd: gitCloneDepotParentPath });

        await fs.copyAsync(directoryPath, gitCloneDepotPath, {
            filter: (src) => (src === "node_modules" || src === ".sleeve")
        });

        await childProcess.exec("git add -A", { cwd: gitCloneDepotPath} );

        await childProcess.exec("git commit -am \"Prep for release\"",
                                    { cwd: gitCloneDepotPath});

        await childProcess.exec("git push", { cwd: gitCloneDepotPath });
    }
}
