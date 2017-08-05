import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";

export default class ResourceGroupInfrastructure extends ResourceGroup
    implements IInfrastructure.IInfrastructure {
    private location: string;
    private resourceGroupNameProperty: string;

    public get resourceGroupName() {
        return this.resourceGroupNameProperty;
    }

    public setResourceGroupName(name: string) {
        this.resourceGroupNameProperty = name;
        return this;
    }

    public initialize(resource: ResourceGroup | null,
                      targetDirectoryPath: string): this {
        super.initialize(resource, targetDirectoryPath);
        if (resource !== null) {
            Object.assign(this, resource);
        }
        return this;
    }
    public async setup(): Promise<void> {
        return await ResourceGroup.internalSetup(__filename,
                this.targetDirectoryPath);
    }
    public async hydrate(resourcesInEnvironment: Resource.Resource[],
                         deploymentType: Resource.DeployType)
                    : Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);
        if (this.location === undefined) {
            const locations = await CommonUtilities.azAppServiceListLocations();
            this.location = locations[0].name;
        }

        const locationAcronym = this.location.split(" ")
        .reduce((output, word) => {
            return output + word[0];
        }, "");

        if (this.resourceGroupName === undefined) {
            this.setResourceGroupName(
                this.baseName + locationAcronym + deploymentType[0]);
        }

        return this;
    }
    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        // tslint:disable-next-line:max-line-length
        return {
            functionToCallAfterScriptRuns: async () => { return; },
            // tslint:disable-next-line:max-line-length
            powerShellScript: `az group create --name ${this.resourceGroupName} \
--location \"${this.location}\"\n`
        };
    }
}
