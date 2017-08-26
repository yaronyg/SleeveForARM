import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import PromiseGate from "./promiseGate";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";

export class BaseDeployResourceGroupInfrastructure {
    constructor(private baseGroup: ResourceGroupInfrastructure) {}

    public get deployedResourceGroupName() {
        return this.baseGroup.resourceGroupName;
    }
}

export class ResourceGroupInfrastructure extends ResourceGroup
    implements IInfrastructure.IInfrastructure {
    private location: string;
    private resourceGroupNameProperty: string;
    private readonly promiseGate = new PromiseGate();

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

    public async deployResource(): Promise<this> {
        try {
            if (this.promiseGate.isGateOpen) {
                throw new Error("Deploy was already called");
            }
            await CommonUtilities.runAzCommand(
`az group create --name ${this.resourceGroupName} \
--location \"${this.location}\"`);

            this.promiseGate.openGateSuccess(
                new BaseDeployResourceGroupInfrastructure(this));
            return this;
        } catch (err) {
            this.promiseGate.openGateError(err);
            throw err;
        }
    }

    public getBaseDeployClassInstance():
            Promise<BaseDeployResourceGroupInfrastructure> {
        return this.promiseGate.promise.then(
            function(baseClass: BaseDeployResourceGroupInfrastructure) {
                return baseClass;
            });
    }
}
