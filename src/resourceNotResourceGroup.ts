import * as CommonUtilities from "./common-utilities";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import ResourceGroupInfrastructure from "./resourcegroupInfrastructure";

export default abstract class ResourceNotResourceGroup
            extends Resource.Resource {
    private static findDefaultResourceGroup(resources: Resource.Resource[])
                : ResourceGroupInfrastructure {
        return CommonUtilities.findGlobalResourceResourceByType(resources,
                                            ResourceGroupInfrastructure) as
                                            ResourceGroupInfrastructure;
    }

    private resourceGroupProperty: ResourceGroupInfrastructure;

    protected async hydrate(resourcesInEnvironment: Resource.Resource[])
                            : Promise<ResourceNotResourceGroup> {
        if (this.resourceGroup === undefined) {
            this.resourceGroupProperty =
                ResourceNotResourceGroup
                    .findDefaultResourceGroup(resourcesInEnvironment);
        }

        this.resourcesInEnvironment = resourcesInEnvironment;

        return this;
    }

    protected get resourceGroup(): ResourceGroupInfrastructure {
        return this.resourceGroupProperty;
    }

    protected setResourceGroup(resourceGroup: ResourceGroupInfrastructure)
                                : this {
        this.resourceGroupProperty = resourceGroup;
        return this;
    }
}
