import * as Path from "path";

export interface IDeployResponse {
    powerShellScript: string;
    functionToCallAfterScript: () => Promise<void>;
}

export abstract class Resource {
    public static async setup(targetDirectoryPath: string): Promise<void> {
        throw new Error("The base method should never be called!");
    }

    private baseNameProperty: string;

    private directoryPathProperty: string;

    private scopedResources: Resource[];

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
