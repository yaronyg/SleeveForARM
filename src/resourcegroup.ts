import * as fs from "fs";
import * as path from "path";
import { format, promisify } from "util";
import * as commonUtilities from "./common-utilities";
import Resource from "./resource";

const asyncFsStat = promisify(fs.stat);

interface IGroupCreateResult {
    properties: {
        provisioningState: string;
    };
}

export default class ResourceGroup extends Resource {
    private locationProperty: string;
    private isGlobalDefaultProperty: boolean = false;
    private resourceGroupNameProperty: string;

    public get location() {
        return this.locationProperty;
    }

    public setLocation(location: string): ResourceGroup {
        this.locationProperty = location;
        return this;
    }

    get isGlobalDefault(): boolean {
        return this.isGlobalDefaultProperty;
    }

    public setGlobalDefault(setting: boolean): ResourceGroup {
        this.isGlobalDefaultProperty = setting;
        return this;
    }

    public get resourceGroupName() {
        return this.resourceGroupNameProperty;
    }

    public setResourceGroupName(name: string): ResourceGroup {
        this.resourceGroupNameProperty = name;
        return this;
    }

    public async deployResource(directoryPath: string,
                                resources: Resource[]): Promise<string> {
        if (this.location === undefined) {
            const locations = await commonUtilities.azAppServiceListLocations();
            this.setLocation(locations[0]
                            .name.replace(/\s/g, "").toLowerCase());
        }

        if (this.resourceGroupName === undefined) {
            this.setResourceGroupName(path.basename(directoryPath) +
                                        this.location);
        }

        const groupCreateResult: IGroupCreateResult =
            await commonUtilities.runAzCommand(
                format("az group create --name %s --location \"%s\"",
                    this.resourceGroupName,
                    this.location));

        if (groupCreateResult.properties.provisioningState !== "Succeeded") {
            throw new Error(
                format("Provisioning failed with %j", groupCreateResult));
        }

        return "";
    }
}
