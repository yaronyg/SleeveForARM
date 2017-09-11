import * as CliUtilities from "./cliUtilities";
import * as Resource from "./resource";

export interface IInfrastructure<T> {
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
     * targetDirectoryPath. This is used to setup a new resource type
     * instance.
     */
    setup(): Promise<void>;

    /**
     * Sets up variables in the infrastructure resource to get ready for a
     * deploy. The point of hydrate is to let us create at least a place
     * holder for the resource type that exposes any values other resource
     * types might need to know about, such as the resource's name. This
     * API call was necessary for an older version of Sleeve. We might be
     * able to get rid of it now.
     * BUGBUG: https://github.com/yaronyg/SleeveForARM/issues/11
     *
     * @param resourceInEnvironment - A list of Infrastructure Resources that
     * are available in the service. Note that the array is not guaranteed to
     * be filled with all resources until deployResource is called.
     * @param deploymentType - The type of deployment
     */
    hydrate(resourcesInEnvironment: CliUtilities.InfraResourceType[],
            deploymentType: Resource.DeployType): Promise<this>;

    /**
     * Runs the code needed to deploy the resource for the current deployment
     * type.
     *
     * @param developmentDeploy - This is a testing feature that we use to let
     * us know when we need to do some magic to set up a Web App in particular
     * to get it's version of Sleeve from the local environment instead of
     * from NPM.
     */
    deployResource(developmentDeploy?: boolean): Promise<this>;

    /**
     * Many resources can only handle certain types of requests once their
     * deployment has reached a particular point. For example, with KeyVault
     * we can't process requests to add secrets until the KeyVault itself
     * has been created. This method is used to get an object with the
     * services the resource offers once it is ready to be used.
     */
    getBaseDeployClassInstance(): Promise<T>;
}
