import * as Resource from "./resource";

export interface IDeployResponse {
    functionToCallAfterScriptRuns: () => Promise<void>;
    powerShellScript: string;
}

export interface IInfrastructure {
    initialize(resource: Resource.Resource | null, targetDirectoryPath: string)
        : this;
    setup(): Promise<void>;
    hydrate(resourcesInEnvironment: Resource.Resource[]): Promise<this>;
    deployResource(): Promise<IDeployResponse>;
}
