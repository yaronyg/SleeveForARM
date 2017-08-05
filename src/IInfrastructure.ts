import * as Resource from "./resource";

export interface IDeployResponse {
    functionToCallAfterScriptRuns: () => Promise<void>;
    powerShellScript: string;
}

export interface IInfrastructure {
    /**
     * Used to initialize an infrastructure resource using a non infrastructure
     * resource (the ones we get out of the sleeve.json files). Note that
     * this class sets up the infrastructure resource for either setup or
     * hydrate (which tend to be mutually exclusive).
     */
    initialize(resource: Resource.Resource | null, targetDirectoryPath: string)
        : this;

    /**
     * Copies the appropriate files for the resource type to
     * targetDirectoryPath.
     */
    setup(): Promise<void>;

    /**
     * Sets up variables in the infrastructure resource to get ready for a
     * deploy.
     */
    hydrate(resourcesInEnvironment: Resource.Resource[],
            deploymentType: Resource.DeployType): Promise<this>;

    /**
     * Creates both the script (eventually ARM template we hope) and any
     * additional code that needs to be run in order to deploy a service.
     */
    deployResource(): Promise<IDeployResponse>;
}
