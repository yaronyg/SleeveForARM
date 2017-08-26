import * as Resource from "./resource";

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
     * Runs the code needed to deploy the resource for the current deployment
     * type.
     */
    deployResource(developmentDeploy?: boolean): Promise<this>;

    /**
     * Many resources can only handle certain types of requests once their
     * deployment has reached a particular point. For example, with KeyVault
     * we can't process requests to add secrets until the KeyVault itself
     * has been created. This method is used to get an object with the
     * services the resource offers once it is ready to be used.
     */
    getBaseDeployClassInstance(): Promise<any>;
}
