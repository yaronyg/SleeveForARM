import * as CommonUtilities from "./common-utilities";
import * as Resource from "./resource";
import * as ResourceGroupInfrastructure from "./resourcegroupInfrastructure";

export default abstract class ResourceNotResourceGroup
            extends Resource.Resource {
    private static findDefaultResourceGroup(resources: Resource.Resource[])
                : ResourceGroupInfrastructure.ResourceGroupInfrastructure {
        return CommonUtilities.findGlobalDefaultResourceByType(resources,
                ResourceGroupInfrastructure.ResourceGroupInfrastructure) as
                    ResourceGroupInfrastructure.ResourceGroupInfrastructure;
    }

    private resourceGroupProperty:
        ResourceGroupInfrastructure.ResourceGroupInfrastructure;

    protected async hydrate(resourcesInEnvironment: Resource.Resource[],
                            deploymentType: Resource.DeployType)
                            : Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);
        if (this.resourceGroup === undefined) {
            this.resourceGroupProperty =
                ResourceNotResourceGroup
                    .findDefaultResourceGroup(resourcesInEnvironment);
        }

        return this;
    }

    public get resourceGroup()
            : ResourceGroupInfrastructure.ResourceGroupInfrastructure {
        return this.resourceGroupProperty;
    }

    protected setResourceGroup(resourceGroup
            : ResourceGroupInfrastructure.ResourceGroupInfrastructure)
                                : this {
        this.resourceGroupProperty = resourceGroup;
        return this;
    }
}
