import path = require("path");
// tslint:disable-next-line:no-var-requires
const { format, promisify } = require("util");
import commonUtilities = require("@sleeve/common-utilities");
import resource = require("@sleeve/common-utilities/resource");
import fs = require("fs");

export class ResourceGroup extends resource.Resource {
    public static readonly minimumResourceGroupName: number = 5;
    public static readonly maximumResourceGroupName: number = 10;

    private static validateResourceGroupName(isSubmittedName: boolean,
                                             name: string) {
        const validationResult =
            commonUtilities.validateName(ResourceGroup.minimumResourceGroupName,
                            ResourceGroup.maximumResourceGroupName, name);

        if (validationResult !== commonUtilities.ValidationResult.valid) {
            const errorString = format("%s %s is %s",
                (isSubmittedName ?
                    "The submitted name " :
                    "The parent directory name "), name,
                validationResult);
            throw new Error(errorString);
        }

        return;
    }

    private resourceGroupName: string;
    private location: string = "";

    public constructor(name?: string, location?: string) {
        super();
        const isSubmittedName = typeof name !== "undefined";

        if (!isSubmittedName) {
            name = path.basename(__dirname);
        }

        ResourceGroup.validateResourceGroupName(isSubmittedName, name!);
    }

    public async prepareResource(): Promise<void> {
        if (this.location === "") {
            const locations = await commonUtilities.azAppServiceListLocations();
            this.location = locations[0].name;
        }
    }
}

export let setupDirectory: commonUtilities.ISetUpDirectory;
// tslint:disable-next-line:only-arrow-functions
setupDirectory = async function(pathToSetUp: string) {
    
};
