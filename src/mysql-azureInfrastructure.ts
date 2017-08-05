import * as GeneratePassword from "generate-password";
import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import INamePassword from "./INamePassword";
import IStorageResource from "./IStorageResource";
import KeyVaultInfra from "./keyvaultInfrastructure";
import MySqlAzure from "./mysql-azure";
import * as Resource from "./resource";

export default class MySqlAzureInfrastructure extends MySqlAzure
        implements IInfrastructure.IInfrastructure, IStorageResource,
                    INamePassword {
    public securityName: string;
    public password: string;
    public isStorageResource: boolean = true;
    public mySqlAzureFullName: string;
    private hostVariableName: string;
    private userVariableName: string;
    private passwordVariableName: string;
    public initialize(resource: Resource.Resource | null,
                      targetDirectoryPath: string): this {
        super.initialize(resource, targetDirectoryPath);
        if (resource !== null) {
            Object.assign(this, resource);
        }
        return this;
    }
    public async setup(): Promise<void> {
        return await MySqlAzureInfrastructure
            .internalSetup(__filename, this.targetDirectoryPath);
    }
    public async hydrate(resourcesInEnvironment: Resource.Resource[],
                         deploymentType: Resource.DeployType)
                        : Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);

        if (this.mySqlAzureFullName === undefined) {
            this.mySqlAzureFullName = (this.resourceGroup.resourceGroupName +
                this.baseName).toLowerCase();
        }

        this.securityName = this.baseName;
        this.password = GeneratePassword.generate({
            // tslint:disable-next-line:max-line-length
            // This is a combination of https://docs.microsoft.com/en-us/sql/relational-databases/security/strong-passwords
            // and https://technet.microsoft.com/en-us/library/cc956689.aspx.
            // The later came up when setting a password!
            exclude: "\/:|<>+=.'[]{}(),;?*!@",
            length: 32,
            numbers: true,
            strict: true,
            symbols: true,
            uppercase: true
        });

        this.hostVariableName = `$${this.baseName}_host`;
        this.userVariableName = `$${this.baseName}_user`;
        this.passwordVariableName = `$${this.baseName}_password`;

        return this;
    }

    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        let result = "";
        const resourceGroupName = this.resourceGroup.resourceGroupName;
        const mySqlServerCreateVariableName =
            `$${this.baseName}ServerCreate`;
        result += `${mySqlServerCreateVariableName} = az mysql server create \
--resource-group ${resourceGroupName} --name ${this.mySqlAzureFullName} \
--admin-user ${this.securityName} --admin-password '${this.password}' \
--ssl-enforcement Enabled | ConvertFrom-Json \n`;

        const keyVault =
            CommonUtilities
                .findGlobalDefaultResourceByType(this.resourcesInEnvironment,
                                                KeyVaultInfra) as KeyVaultInfra;
        result += keyVault.setSecret(this.securityName, this.password);

        result += `${this.hostVariableName} = \
${mySqlServerCreateVariableName}.fullyQualifiedDomainName\n`;

        result += `${this.userVariableName} = \
"${this.securityName}@" + ${mySqlServerCreateVariableName}.name\n`;

        result += `${this.passwordVariableName} = '${this.password}'\n`;

        const startIpAddress = "0.0.0.0";
        let endIpAddress: string;
        let firewallRuleName: string;
        switch (this.deploymentType) {
            case Resource.DeployType.LocalDevelopment: {
                firewallRuleName = "AllowAllIPs";
                endIpAddress = "255.255.255.255";
                break;
            }
            case Resource.DeployType.Production: {
                firewallRuleName = "OnlyAllowAzureIps";
                endIpAddress = "0.0.0.0";
                break;
            }
            default: {
                throw new Error(`Unrecognized deployment type \
${this.deploymentType}`);
            }
        }

        result += `az mysql server firewall-rule create \
--resource-group ${resourceGroupName} --server ${this.mySqlAzureFullName} \
--name ${firewallRuleName} --start-ip-address ${startIpAddress} \
--end-ip-address ${endIpAddress}\n`;

        return {
            functionToCallAfterScriptRuns: async () => { return; },
            powerShellScript: result
        };
    }

    public getPowershellConnectionVariableNames(): string[] {
        return [this.hostVariableName, this.userVariableName,
                this.passwordVariableName];
    }

}
