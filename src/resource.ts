import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as CommonUtilities from "./common-utilities";

export interface IDeployResponse {
    powerShellScript: string;
    functionToCallAfterScriptRuns: () => Promise<void>;
}

export abstract class Resource {
    public static async setup(targetDirectoryPath: string): Promise<void> {
        throw new Error("Child class has to implement this!");
    }

    protected static async internalSetup(fileName: string,
                                         targetDirectoryPath: string)
                                         : Promise<void> {
        if (!(await fs.existsAsync(targetDirectoryPath))) {
            throw new Error(
                "We expect the caller to create the directory for us");
        }
        const assetPath =
            Path.join(__dirname,
                        "..",
                        "assets",
                        Path.basename(fileName, ".js"));
        await fs.copyAsync(assetPath, targetDirectoryPath);
        await CommonUtilities.npmSetup(targetDirectoryPath);
    }

    private baseNameProperty: string;

    private directoryPathProperty: string;

    private scopedResources: Resource[] = [];

    public get getDependentServices() {
        return this.scopedResources;
    }

    public addService(resource: Resource) {
        this.scopedResources.push(resource);
        return this;
    }

    public get baseName() {
        return this.baseNameProperty;
    }

    public setBaseName(baseName: string) {
        this.baseNameProperty = baseName;
        return this;
    }

    public get directoryPath() {
        return this.directoryPathProperty;
    }

    public setDirectoryPath(directoryPath: string) {
        this.directoryPathProperty = directoryPath;
        if (this.baseName === undefined) {
            this.setBaseName(Path.basename(this.directoryPath));
        }
        return this;
    }

    public abstract async deployResource(resources: Resource[])
        : Promise<IDeployResponse>;
}
