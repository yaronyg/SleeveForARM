import * as IInfrastructure from "./IInfrastructure";
import KeyVault from "./keyvault";
import * as Resource from "./resource";

export default class KeyVaultInfrastructure
    extends KeyVault
    implements IInfrastructure.IInfrastructure {
    public keyVaultFullName: string;

    public initialize(resource: KeyVault | null,
                      targetDirectoryPath: string): this {
        super.initialize(resource, targetDirectoryPath);
        if (resource !== null) {
            Object.assign(this, resource);
        }
        return this;
    }
    public async setup(): Promise<void> {
        return KeyVault.internalSetup(__filename, this.targetDirectoryPath);
    }
    public async hydrate(resourcesInEnvironment: Resource.Resource[])
                    : Promise<this> {
        await super.hydrate(resourcesInEnvironment);

        if (this.keyVaultFullName === undefined) {
            this.keyVaultFullName = this.resourceGroup.resourceGroupName +
                    this.baseName;
        }

        return this;
    }
    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        // tslint:disable:max-line-length
        const result = `az keyvault create --name \"${this.keyVaultFullName}\" \
--resource-group \"${this.resourceGroup.resourceGroupName}\" \
--enable-soft-delete ${this.isEnabledForSoftDelete} \
--enabled-for-deployment ${this.isEnabledForDeployment} \
--enabled-for-disk-encryption ${this.isEnabledForDiskEncryption} \
--enabled-for-template-deployment ${this.isEnabledForTemplateDeployment}\n`;
        // tslint:enable:max-line-length

        return {
            functionToCallAfterScriptRuns: async () => { return; },
            powerShellScript: result
        };
    }
}
