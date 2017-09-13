import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as CommonUtilities from "./common-utilities";

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
                                         targetDirectoryPath: string,
                                         maximumNameLength: number)
                                         : Promise<void> {
        const serviceName = Path.basename(targetDirectoryPath);
        if (!(await CommonUtilities.validateResource(
                    (serviceName), maximumNameLength))) {
            throw new Error(
                `The name of the resource ${Path.basename(targetDirectoryPath)}\
 should be less than ${maximumNameLength} characters,\
 contains only alphanumeric characters and start with a letter\n` );
        }

        if (fs.existsSync(targetDirectoryPath)) {
          console.log(`Directory with name ${serviceName} already exists.`);
          process.exit(-1);
        }

        await fs.ensureDirAsync(targetDirectoryPath);
        const assetPath =
            Path.join(__dirname,
                        "..",
                        "assets",
                        Path.basename(fileName, ".js"));
        await fs.copyAsync(assetPath, targetDirectoryPath);
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

    protected get baseName() {
        return this.baseNameProperty;
    }

    protected setBaseName(baseName: string) {
        this.baseNameProperty = baseName;
        return this;
    }
}
