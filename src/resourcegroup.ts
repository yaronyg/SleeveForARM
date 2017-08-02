import * as fs from "fs";
import * as path from "path";
import { format, promisify } from "util";
import * as commonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import * as Resource from "./resource";

const asyncFsStat = promisify(fs.stat);

export default class ResourceGroup extends Resource.Resource
        implements IGlobalDefault {
    public static async setup(targetDirectoryPath: string): Promise<void> {
        return ResourceGroup.internalSetup(__filename, targetDirectoryPath);
    }

    private locationProperty: string;
    private isGlobalDefaultProperty: boolean = false;
    private resourceGroupNameProperty: string;

    public get location() {
        return this.locationProperty;
    }

    /**
     * Set the location for the resource group
     * @param location The space delimited string used by Azure such as
     * "East US 2"
     */
    public setLocation(location: string) {
        this.locationProperty = location;
        return this;
    }

    get isGlobalDefault(): boolean {
        return this.isGlobalDefaultProperty;
    }

    public setGlobalDefault(setting: boolean) {
        this.isGlobalDefaultProperty = setting;
        return this;
    }

    public get resourceGroupName() {
        return this.resourceGroupNameProperty;
    }

    public setResourceGroupName(name: string) {
        this.resourceGroupNameProperty = name;
        return this;
    }

    /**
     * This function is only public for testing purposes.
     */
    public async testingCalculateResourceGroupName() {
        if (this.location === undefined) {
            const locations = await commonUtilities.azAppServiceListLocations();
            this.setLocation(locations[0].name);
        }

        const locationAcronym = this.location.split(" ")
        .reduce((output, word) => {
            return output + word[0];
        }, "");

        if (this.resourceGroupName === undefined) {
            this.setResourceGroupName(this.baseName + locationAcronym);
        }

    }

    public async deployResource(resources: Resource.Resource[])
                                : Promise<Resource.IDeployResponse> {
        await this.testingCalculateResourceGroupName();

        // tslint:disable-next-line:max-line-length
        return {
            functionToCallAfterScriptRuns: async () => { return; },
            // tslint:disable-next-line:max-line-length
            powerShellScript: `az group create --name ${this.resourceGroupName} --location \"${this.location}\"\n`
        };
    }
}
