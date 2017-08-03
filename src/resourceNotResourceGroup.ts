import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import ResourceGroupInfrastructure from "./resourcegroupInfrastructure";

export default abstract class ResourceNotResourceGroup
            extends Resource.Resource {
    private static findDefaultResourceGroup(resources: Resource.Resource[])
                : ResourceGroupInfrastructure {
        const globalResourceGroup = resources.find((resource) => {
            return resource instanceof ResourceGroupInfrastructure &&
                resource.isGlobalDefault;
        }) as ResourceGroupInfrastructure;

        if (globalResourceGroup !== undefined) {
            return globalResourceGroup;
        }

        throw new Error("There is no global default resource group object!");
    }

    private resourceGroupProperty: ResourceGroupInfrastructure;

    protected async hydrate(resourcesInEnvironment: Resource.Resource[])
                            : Promise<ResourceNotResourceGroup> {
        if (this.resourceGroup === undefined) {
            this.resourceGroupProperty =
                ResourceNotResourceGroup
                    .findDefaultResourceGroup(resourcesInEnvironment);
        }

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
