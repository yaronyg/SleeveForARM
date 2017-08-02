import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";

export default abstract class ResourceNotResourceGroup
            extends Resource.Resource {
    private static findDefaultResourceGroup(resources: Resource.Resource[])
                : ResourceGroup {
        const globalResourceGroup = resources.find((resource) => {
            return resource instanceof ResourceGroup &&
                resource.isGlobalDefault;
        }) as ResourceGroup;

        if (globalResourceGroup !== undefined) {
            return globalResourceGroup;
        }

        throw new Error("There is no global default resource group object!");
    }

    private resourceGroupProperty: ResourceGroup;

    public get resourceGroup(): ResourceGroup {
        return this.resourceGroupProperty;
    }

    public setResourceGroup(resourceGroup: ResourceGroup): this {
        this.resourceGroupProperty = resourceGroup;
        return this;
    }

    public setResourceGroupToGlobalDefaultIfNotSet(
                        resources: Resource.Resource[]): this {
        if (this.resourceGroup === undefined) {
            this.resourceGroupProperty =
                ResourceNotResourceGroup.findDefaultResourceGroup(resources);
        }
        return this;
    }
}
