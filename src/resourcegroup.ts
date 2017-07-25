import path = require("path");
import { format, promisify } from "util";
import commonUtilities = require("./common-utilities");
import Resource from "./resource";
import fs = require("fs");

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
                                resources: Resource[]): Promise<void> {
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
    }

    public async setup(directoryToSetUp: string) {
        /**
         * We need to go to the specified directory
         * and create the sleeve.js file and put inside of it
         * a call to new resourcegroup();
         */
        if (!fs.existsSync(directoryToSetUp)) {
            throw new Error("Specified path does not exist: " +
                            directoryToSetUp);
        }

        const statResults = await asyncFsStat(directoryToSetUp);

        if (!statResults.isDirectory()) {
            throw new Error("Specified path is not a directory - " +
                            directoryToSetUp);
        }
    }
}
