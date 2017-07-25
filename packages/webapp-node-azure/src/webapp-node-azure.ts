import { runAzCommand } from "@sleeve/common-utilities";
import Resource from "@sleeve/common-utilities/resource";
import ResourceGroup from "@sleeve/resourcegroup-azure";
import path = require("path");
import { randomBytes } from "crypto";
import { format } from "util";

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

    public get webAppServicePlanName() {
        return this.webAppServicePlanNameProperty;
    }

    public setWebAppServicePlanName(name: string): WebappNodeAzure {
        this.webAppServicePlanNameProperty = name;
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
                    path.basename(__dirname));
        }

        const result = await runAzCommand(
            format("az appservice plan create --name \"%s\" \
                    --resource-group \"%s\" --sku FREE",
                    this.webAppServicePlanName,
                    this.resourceGroup.resourceGroupName),
        );
    }
}
