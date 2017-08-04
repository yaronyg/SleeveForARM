import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as CommonUtilities from "./common-utilities";

export interface IDeployResponse {
    functionToCallAfterScriptRuns: () => Promise<void>;
    powerShellScript: string;
}

export abstract class Resource {
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

    protected get baseName() {
        return this.baseNameProperty;
    }

    protected setBaseName(baseName: string) {
        this.baseNameProperty = baseName;
        return this;
    }
}
