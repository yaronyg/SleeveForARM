import * as CommonUtilities from "./common-utilities";
import * as data from "./data";
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
    // tslint:disable-next-line:max-line-length
    implements IInfrastructure.IInfrastructure<BaseDeployResourceGroupInfrastructure> {
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
            this.targetDirectoryPath, (data.data as any).ResourceGroupLength,
            true);
    }

    public async hydrate(resourcesInEnvironment: Resource.Resource[],
                         deploymentType: Resource.DeployType)
                    : Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);
        if (this.dataCenter === undefined) {
            throw new Error(
"setDataCenter in root sleeve.js file MUST be set to a DC name");
        }

        const locationAcronym = this.dataCenter.split(" ")
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
        if (this.promiseGate.isGateOpen) {
            throw new Error("Deploy was already called");
        }

        try {
            await CommonUtilities.runAzCommand(
`az group create --name ${this.resourceGroupName} \
--location "${this.dataCenter}"`);

            this.promiseGate.openGateSuccess(
                new BaseDeployResourceGroupInfrastructure(this));
            return this;
        } catch (err) {
            this.promiseGate.openGateError(err);
            throw err;
        }
    }

    public async deleteResource(): Promise<this> {
        if (!this.promiseGate.isGateOpen) {
            throw new Error(
"Delete is intended to clean up after we deploy.");
        }

        try {
            await CommonUtilities.runAzCommand(
`az group delete --name ${this.resourceGroupName} --yes`,
CommonUtilities.azCommandOutputs.string);
            return this;
        } catch (err) {
            if (err.toString().includes(
"stderr ERROR: Resource group 'mySQLSCUp' could not be found.")) {
                // Group doesn't exist, which is fine
                return this;
            }
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
