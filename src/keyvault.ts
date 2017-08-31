import IGlobalDefault from "./IGlobalDefault";
import ResourceNotResourceGroup from "./resourceNotResourceGroup";

export default class KeyVault extends ResourceNotResourceGroup
        implements IGlobalDefault {
    private isGlobalDefaultProperty: boolean;

    private enableSoftDeleteProperty: boolean;

    private enabledForDeploymentProperty: boolean;

    private enabledForDiskEncryption: boolean;

    private enabledForTemplateDeploymentProperty: boolean;

    public get isGlobalDefault(): boolean {
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
}
