import * as CommonUtilities from "./common-utilities";
import * as data from "./data";
import * as IInfrastructure from "./IInfrastructure";
import KeyVault from "./keyvault";
import PromiseGate from "./promiseGate";
import * as Resource from "./resource";

export class BaseDeployKeyVaultInfrastructure {
    constructor(private baseKeyVault: KeyVaultInfrastructure) {}
    public async setSecret(secretName: string, password: string)
        : Promise<this> {
        await CommonUtilities.runAzCommand(
`az keyvault secret set --name ${secretName} \
--vault-name ${this.baseKeyVault.keyVaultFullName} --value ${password}`);
        return this;
    }
}

export class KeyVaultInfrastructure
    extends KeyVault
    // tslint:disable-next-line:max-line-length
    implements IInfrastructure.IInfrastructure<BaseDeployKeyVaultInfrastructure> {
    public keyVaultFullName: string;
    private readonly promiseGate = new PromiseGate();

    public initialize(resource: KeyVault | null,
                      targetDirectoryPath: string): this {
        super.initialize(resource, targetDirectoryPath);
        if (resource !== null) {
            Object.assign(this, resource);
        }
        return this;
    }
    public async setup(): Promise<void> {
        return await KeyVaultInfrastructure
            .internalSetup(__filename, this.targetDirectoryPath,
                data.data.KeyVaultNameLength);
    }
    public async hydrate(resourcesInEnvironment: Resource.Resource[],
                         deploymentType: Resource.DeployType)
                    : Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);

        if (this.keyVaultFullName === undefined) {
            this.keyVaultFullName = this.resourceGroup.resourceGroupName +
                    this.baseName;
        }
        return this;
    }
    public async deployResource(): Promise<this> {
        try {
            await this.resourceGroup.getBaseDeployClassInstance();
            await CommonUtilities.runAzCommand(
`az keyvault create --name ${this.keyVaultFullName} \
--resource-group ${this.resourceGroup.resourceGroupName} \
--enable-soft-delete ${this.isEnabledForSoftDelete} \
--enabled-for-deployment ${this.isEnabledForDeployment} \
--enabled-for-disk-encryption ${this.isEnabledForDiskEncryption} \
--enabled-for-template-deployment ${this.isEnabledForTemplateDeployment}`);
            this.promiseGate.openGateSuccess(
                new BaseDeployKeyVaultInfrastructure(this));
            return this;
        } catch (err) {
            this.promiseGate.openGateError(err);
            throw err;
        }
    }

    public getBaseDeployClassInstance():
        Promise<BaseDeployKeyVaultInfrastructure> {
        return this.promiseGate.promise.then(
            function(baseClass: BaseDeployKeyVaultInfrastructure) {
                return baseClass;
            });
    }
}
