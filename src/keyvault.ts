import IGlobalDefault from "./IGlobalDefault";
import * as Resource from "./resource";
import ResourceNotResourceGroup from "./resourceNotResourceGroup";

export default class KeyVault extends ResourceNotResourceGroup
        implements IGlobalDefault {
    public static async setup(targetDirectoryPath: string): Promise<void> {
        return KeyVault.internalSetup(__filename, targetDirectoryPath);
    }

    private keyVaultFullNameProperty: string;

    private isGlobalDefaultProperty: boolean;

    private enableSoftDeleteProperty: boolean;

    private enabledForDeploymentProperty: boolean;

    private enabledForDiskEncryption: boolean;

    private enabledForTemplateDeploymentProperty: boolean;

    public get keyVaultFullName() {
        return this.keyVaultFullNameProperty;
    }

    public setKeyVaultFullName(name: string): this {
        this.keyVaultFullNameProperty = name;
        return this;
    }

    get isGlobalDefault(): boolean {
        return this.isGlobalDefaultProperty;
    }

    public setGlobalDefault(setting: boolean) {
        this.isGlobalDefaultProperty = setting;
        return this;
    }

    public get isEnabledForSoftDelete() {
        return this.enableSoftDeleteProperty;
    }

    public setEnableSoftDelete(setting: boolean): this {
        this.enableSoftDeleteProperty = setting;
        return this;
    }

    public get isEnabledForDeployment() {
        return this.enabledForDeploymentProperty;
    }

    public setEnableForDeployment(setting: boolean): this {
        this.enabledForDeploymentProperty = setting;
        return this;
    }

    public get isEnabledForDiskEncryption() {
        return this.enabledForDiskEncryption;
    }

    public setEnableForDiskEncryption(setting: boolean): this {
        this.enabledForDiskEncryption = setting;
        return this;
    }

    public get isEnabledForTemplateDeployment() {
        return this.enabledForTemplateDeploymentProperty;
    }

    public setEnableForTemplateDeployment(setting: boolean): this {
        this.enabledForTemplateDeploymentProperty = setting;
        return this;
    }

    public async deployResource(resources: Resource.Resource[])
        : Promise<Resource.IDeployResponse> {

        this.setResourceGroupToGlobalDefaultIfNotSet(resources);

        if (this.keyVaultFullName === undefined) {
            this.setKeyVaultFullName(
                this.resourceGroup.resourceGroupName +
                    this.baseName);
        }

        let result = "";

        // tslint:disable:max-line-length
        result += `az keyvault create --name \"${this.keyVaultFullName}\" --resource-group \"${this.resourceGroup.resourceGroupName}\" \
--enable-soft-delete ${this.isEnabledForSoftDelete} --enabled-for-deployment ${this.isEnabledForDeployment} \
--enabled-for-disk-encryption ${this.isEnabledForDiskEncryption} --enabled-for-template-deployment ${this.isEnabledForTemplateDeployment}\n`;
        // tslint:enable:max-line-length

        return {
            functionToCallAfterScriptRuns: async () => { return; },
            powerShellScript: result
        };
    }

    /**
     * Returns a powershell script to set the given name and secret
     * on the current KeyVault object.
     */
    public async setSecret(name: string, secret: string): string {
        return `az keyvault secret set --name \"${name}\" --vault-name \"`
    }
}
