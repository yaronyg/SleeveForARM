import * as fs from "fs-extra";
import * as Path from "path";
import * as CommonUtilities from "./common-utilities";

/*
 * In our code we take DC names returned by AZ and
 * use it to generate enum values. So it's important
 * that the enum values are just the DC name with
 * spaces removed.
 */

/**
 * The names of data centers supported by Azure. Please
 * note that not all Azure Accounts have access to all data centers.
 */
export enum DataCenterNames {
    EastAsia = "East Asia",
    SoutheastAsia = "Southeast Asia",
    CentralUS = "Central US",
    EastUS = "East US",
    EastUS2 = "East US 2",
    WestUS = "West US",
    NorthCentralUS = "North Central US",
    SouthCentralUS = "South Central US",
    NorthEurope = "North Europe",
    WestEurope = "West Europe",
    JapanWest = "Japan West",
    JapanEast = "Japan East",
    BrazilSouth = "Brazil South",
    AustraliaEast = "Australia East",
    AustraliaSoutheast = "Australia Southeast",
    SouthIndia = "South India",
    CentralIndia = "Central India",
    WestIndia = "West India",
    CanadaCentral = "Canada Central",
    CanadaEast = "Canada East",
    UKSouth = "UK South",
    UKWest = "UK West",
    WestCentralUS = "West Central US",
    WestUS2 = "West US 2",
    KoreaCentral = "Korea Central",
    KoreaSouth = "Korea South"
}

/**
 * We use the first character of the string value
 * as part of our names so make sure each type has a
 * different first character.
 */
export enum DeployType {
  LocalDevelopment = "dev",
  Production = "prod"
}

export enum ResourcesWeSupportSettingUp {
    MySqlAzure = "mySqlAzure",
    WebAppNode = "webapp-node"
}

export abstract class Resource {
    protected static async internalSetup(fileName: string,
                                         targetDirectoryPath: string)
                                         : Promise<void> {
        if (!(await fs.pathExists(targetDirectoryPath))) {
            throw new Error(
                "We expect the caller to create the directory for us");
        }
        const assetPath =
            Path.join(__dirname,
                        "..",
                        "assets",
                        Path.basename(fileName, ".js"));
        await fs.copy(assetPath, targetDirectoryPath);
        await CommonUtilities.npmSetup(targetDirectoryPath);
    }

    protected  deploymentType: DeployType;
    protected targetDirectoryPath: string;

    protected resourcesInEnvironment: Resource[];

    private baseNameProperty: string;

    protected initialize(resource: Resource | null,
                         targetDirectoryPath: string): this {
        this.targetDirectoryPath = targetDirectoryPath;
        if (this.baseName === undefined) {
            this.setBaseName(Path.basename(this.targetDirectoryPath));
        }
        return this;
    }

    protected async hydrate(resourcesInEnvironment: Resource[],
                            deploymentType: DeployType): Promise<this> {
        this.resourcesInEnvironment = resourcesInEnvironment;
        this.deploymentType = deploymentType;
        return this;
    }

    public get baseName() {
        return this.baseNameProperty;
    }

    protected setBaseName(baseName: string) {
        this.baseNameProperty = baseName;
        return this;
    }
}
