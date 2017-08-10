import * as CommonUtilities from "./common-utilities";
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
        return await KeyVaultInfrastructure
            .internalSetup(__filename, this.targetDirectoryPath);
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
    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        // tslint:disable:max-line-length
        const result = CommonUtilities.appendErrorCheck(
`az keyvault create --name \"${this.keyVaultFullName}\" \
--resource-group \"${this.resourceGroup.resourceGroupName}\" \
--enable-soft-delete ${this.isEnabledForSoftDelete} \
--enabled-for-deployment ${this.isEnabledForDeployment} \
--enabled-for-disk-encryption ${this.isEnabledForDiskEncryption} \
--enabled-for-template-deployment ${this.isEnabledForTemplateDeployment}\n`);
        // tslint:enable:max-line-length

        return {
            functionToCallAfterScriptRuns: async () => { return; },
            powerShellScript: result
        };
    }

    /**
     * A really brain dead function that returns a powershell command that
     * will set the given secret on the current keyvault to the given
     * value. Note that if the secret already exists it will be
     * overwritten with the new value.
     */
    public setSecretViaPowershell(secretName: string, password: string)
        : string {
        return CommonUtilities.appendErrorCheck(
`az keyvault secret set --name '${secretName}' \
--vault-name '${this.keyVaultFullName}' --value '${password}'\n`);
    }

    /**
     * The powershell command will return the secret as a string.
     * The powershell script will throw an exception if the secret doesn't exit.
     */
    public getSecretViaPowershell(secretName: string): string {
        return CommonUtilities.appendErrorCheck(
`${this.secretString(secretName)} | ConvertFrom-Json).value\n`);
    }

    public async getSecret(secretName: string): Promise<string | null> {
        try {
            const azResult = await CommonUtilities.runAzCommand(
`${this.secretString(secretName)}`);
            return azResult.value;
        } catch (err) {
            return null;
        }
    }

    private secretString(secretName: string): string {
        return `(az keyvault secret show --name '${secretName}' \
--vault-name '${this.keyVaultFullName}'`;
    }

}
