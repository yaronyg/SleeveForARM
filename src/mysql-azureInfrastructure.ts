import * as Crypto from "crypto";
import * as fs from "fs-extra-promise";
import * as GeneratePassword from "generate-password";
import * as Path from "path";
import * as Winston from "winston";
import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import INamePassword from "./INamePassword";
import IStorageResource from "./IStorageResource";
import KeyVaultInfra from "./keyvaultInfrastructure";
import MySqlAzure from "./mysql-azure";
import * as Resource from "./resource";
import * as ServiceEnvironmentUtilities from "./serviceEnvironmentUtilities";

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
            // The & character got added because it's a reserved command,
            // even in strings. If we want to use it we need to wrap it
            // as '"&"'.
            // I also took out double quotes and ^ because they seem to
            // disappear when I set them on Keyvault. I submitted a bug on that.
            exclude: "^\"&\/:|<>+=.'[]{}(),;?*!@",
            length: 32,
            numbers: true,
            strict: true,
            symbols: false,
            uppercase: true
        });
        // BUGBUG: To meet the symbol requirement for now.
        this.password += "$";

        this.hostVariableName =
`$${this.baseName}${ServiceEnvironmentUtilities.resourceHostSuffix}`;
        this.userVariableName =
`$${this.baseName}${ServiceEnvironmentUtilities.resourceUserSuffix}`;
        this.passwordVariableName =
`$${this.baseName}${ServiceEnvironmentUtilities.resourcePasswordSuffix}`;

        return this;
    }

    public async deployResource(): Promise<IInfrastructure.IDeployResponse> {
        let result = "";
        const resourceGroupName = this.resourceGroup.resourceGroupName;
        const mySqlServerCreateVariableName =
            `$${this.baseName}ServerCreate`;
        result += CommonUtilities.appendErrorCheck(
`${mySqlServerCreateVariableName} = az mysql server create \
--resource-group ${resourceGroupName} --name ${this.mySqlAzureFullName} \
--admin-user ${this.securityName} --admin-password '${this.password}' \
--ssl-enforcement Enabled | ConvertFrom-Json \n`);

        const keyVault =
            CommonUtilities
                .findGlobalDefaultResourceByType(this.resourcesInEnvironment,
                                                KeyVaultInfra) as KeyVaultInfra;
        result +=
            keyVault.setSecretViaPowershell(this.securityName, this.password);

        result += `${this.hostVariableName} = \
${mySqlServerCreateVariableName}.fullyQualifiedDomainName\n`;

        result += `${this.userVariableName} = \
"${this.securityName}@" + ${mySqlServerCreateVariableName}.name\n`;

        result += `${this.passwordVariableName} = '${this.password}'\n`;

        result += this.getFirewallFunction();

        if (this.deploymentType === Resource.DeployType.LocalDevelopment) {
            result += this.setFirewallAllowAll();
        }

        const scriptPaths: string [] = [];
        for (const checkScriptPath of this.pathToMySqlInitializationScripts) {
            const scriptPath =
                Path.isAbsolute(checkScriptPath) ? checkScriptPath :
                    Path.join(this.targetDirectoryPath, checkScriptPath);
            if (await fs.existsAsync(scriptPath) === false) {
                throw new Error(`Submitted mySql initialization script, \
located at ${scriptPath} for ${this.baseName} does not exist.`);
            }
            scriptPaths.push(scriptPath);
        }

        const afterScriptRunFunction = async () => {
            for (const scriptPath of scriptPaths) {
                await this.runMySqlScript(scriptPath);
            }
        };

        return {
            async functionToCallAfterScriptRuns() {
                await afterScriptRunFunction();
            },
            powerShellScript: result
        };
    }

    public getPowershellConnectionVariableNames(): string[] {
        return [this.hostVariableName, this.userVariableName,
                this.passwordVariableName];
    }

    public getPowershellFirewallFunctionName(): string {
        return `${this.baseName}SetFirewallRules`;
    }

    public async runMySqlScript(pathToScript: string) {
        let devIp: string;
        const firewallRuleName = Crypto.randomBytes(12).toString("hex");
        const initSqlCommand =
`mysql -h ${this.mySqlAzureFullName}.mysql.database.azure.com \
-u ${this.securityName}@${this.mySqlAzureFullName} \
-p${this.password} -v < "${pathToScript}"`;
        const re =
            /Client with IP address (.*) is not allowed to access the server/;
        try {
            await CommonUtilities.exec(initSqlCommand,
                                        this.targetDirectoryPath);
            Winston.debug("The request that was supposed to fail to talk to \
mySQl so we could find out what IP address Azure mySQL sees actually \
succeeded!");
            return;
        } catch (err) {
            const result = err.message.match(re);
            if (result.length !== 2) {
                throw new Error(`Search for dev IP failed with ${err}`);
            }
            devIp = result[1];
        }

        try {
            if (this.deploymentType === Resource.DeployType.Production) {
                await this.setFirewallRule(firewallRuleName, devIp);
            }
            CommonUtilities.retryAfterFailure(async () => {
                await CommonUtilities.exec(initSqlCommand,
                                           this.targetDirectoryPath);
            }, 5);
        } finally {
            if (this.deploymentType === Resource.DeployType.Production) {
                await this.removeFirewallRules(firewallRuleName);
            }
        }

    }
    private getFirewallFunction() {
        const firewallCommand = CommonUtilities.appendErrorCheck(
`az mysql server firewall-rule create \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server ${this.mySqlAzureFullName} \
--name "$name" --start-ip-address $_ \
--end-ip-address $_\n`, 4);

        return `function ${this.getPowershellFirewallFunctionName()} {\n\
  $args[0] | ForEach-Object {\n\
    $name = "${this.baseName}" + ($_ -replace '[\.]', '')\n\
    ${firewallCommand}\
  }\n\
}\n`;
    }

    private setFirewallAllowAll() {
        return CommonUtilities.appendErrorCheck(
`az mysql server firewall-rule create \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server ${this.mySqlAzureFullName} \
--name "${this.baseName}AllAccess" --start-ip-address "0.0.0.0" \
--end-ip-address "255.255.255.255"\n`);
    }

    private async setFirewallRule(name: string, ipAddress: string) {
        return await CommonUtilities.runAzCommand(
`az mysql server firewall-rule create \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server ${this.mySqlAzureFullName} \
--name "${name}" --start-ip-address "${ipAddress}" \
--end-ip-address "${ipAddress}"`);
    }

    private async removeFirewallRules(name: string) {
        return await CommonUtilities.runAzCommand(
`az mysql server firewall-rule delete \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server-name ${this.mySqlAzureFullName} \
--name "${name}" --yes`, CommonUtilities.azCommandOutputs.string);
    }
}
