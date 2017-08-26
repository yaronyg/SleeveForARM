import * as Crypto from "crypto";
import * as fs from "fs-extra-promise";
import * as GeneratePassword from "generate-password";
import * as Path from "path";
import * as Winston from "winston";
import * as CommonUtilities from "./common-utilities";
import * as IInfrastructure from "./IInfrastructure";
import INamePassword from "./INamePassword";
import IStorageResource from "./IStorageResource";
import * as KeyVaultInfra from "./keyvaultInfrastructure";
import MySqlAzure from "./mysql-azure";
import PromiseGate from "./promiseGate";
import * as Resource from "./resource";
import * as ServiceEnvironmentUtilities from "./serviceEnvironmentUtilities";

export interface ISqlCreateResult {
    fullyQualifiedDomainName: string;
    name: string;
}

export class BaseDeployMySqlAzureInfrastructure {
    private readonly environmentVariablesValues: Array<[string, string]> = [];
    constructor(private baseMySqlAzureInfrastructure:
                    MySqlAzureInfrastructure,
                createResult: ISqlCreateResult) {
        const baseName = baseMySqlAzureInfrastructure.getBaseName();
        const hostVariableName =
            `${baseName}${ServiceEnvironmentUtilities.resourceHostSuffix}`;
        const userVariableName =
            `${baseName}${ServiceEnvironmentUtilities.resourceUserSuffix}`;
        const passwordVariableName =
            `${baseName}${ServiceEnvironmentUtilities.resourcePasswordSuffix}`;

        this.environmentVariablesValues.push([hostVariableName,
            createResult.fullyQualifiedDomainName]);
        this.environmentVariablesValues.push([userVariableName,
`${baseMySqlAzureInfrastructure.securityName}@${createResult.name}`]);
        this.environmentVariablesValues.push([passwordVariableName,
            baseMySqlAzureInfrastructure.password]);
    }

    /**
     * Returns a list name/value pairs for environment
     * variables to describe how to connect to this resource.
     */
    public getEnvironmentVariables(): Array<[string, string]> {
        return this.environmentVariablesValues;
    }

    /**
     * Creates a firewall on the storage resource with the given
     * name for the given ipAddress.
     */
    public async setFirewallRule(ruleName: string, ipAddress: string)
        : Promise<this> {
        return this.baseMySqlAzureInfrastructure
                    .setFirewallRule(ruleName, ipAddress);
    }
}

export class MySqlAzureInfrastructure extends MySqlAzure
        implements IInfrastructure.IInfrastructure, IStorageResource,
                    INamePassword {
    public securityName: string;
    public password: string;
    public isStorageResource: boolean = true;
    public mySqlAzureFullName: string;
    private readonly promiseGate = new PromiseGate();
    public getBaseName() {
        return this.baseName;
    }
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

        return this;
    }

    public async deployResource(): Promise<this> {
        try {
            await this.resourceGroup.getBaseDeployClassInstance();
            const promisesToWaitFor = [];
            const resourceGroupName = this.resourceGroup.resourceGroupName;
            const createResult = await CommonUtilities.runAzCommand(
    `az mysql server create \
    --resource-group ${resourceGroupName} --name ${this.mySqlAzureFullName} \
    --admin-user ${this.securityName} --admin-password '${this.password}' \
    --ssl-enforcement Enabled`, CommonUtilities.azCommandOutputs.json);
            this.promiseGate.openGateSuccess(
                new BaseDeployMySqlAzureInfrastructure(this, createResult));

            const keyVault =
                CommonUtilities
                    .findGlobalDefaultResourceByType(
                        this.resourcesInEnvironment,
KeyVaultInfra.KeyVaultInfrastructure) as KeyVaultInfra.KeyVaultInfrastructure;

            promisesToWaitFor.push(
                keyVault
                    .getBaseDeployClassInstance()
                    .then((keyVaultBaseClass) => {
                        return keyVaultBaseClass
                            .setSecret(this.securityName, this.password);
                    }));

            if (this.deploymentType === Resource.DeployType.LocalDevelopment) {
                promisesToWaitFor.push(this.setFirewallAllowAll());
            }

            const scriptPaths: string [] = [];
            for (const checkScriptPath of
                    this.pathToMySqlInitializationScripts) {
                const scriptPath =
                    Path.isAbsolute(checkScriptPath) ? checkScriptPath :
                        Path.join(this.targetDirectoryPath, checkScriptPath);
                if (await fs.existsAsync(scriptPath) === false) {
                    throw new Error(`Submitted mySql initialization script, \
    located at ${scriptPath} for ${this.baseName} does not exist.`);
                }
                scriptPaths.push(scriptPath);
            }

            let firewallRuleName;
            try {
                firewallRuleName = await this.setUpFirewallForSqlScript();
            } finally {
                if (this.deploymentType === Resource.DeployType.Production
                        && firewallRuleName) {
                    await this.removeFirewallRule(firewallRuleName);
                }
            }

            for (const scriptPath of scriptPaths) {
                promisesToWaitFor.push(this.runMySqlScript(scriptPath));
            }
            await Promise.all(promisesToWaitFor);
            return this;
        } catch (err) {
            if (!this.promiseGate.isGateOpen) {
                this.promiseGate.openGateError(err);
            }
            throw err;
        }
    }

    public getBaseDeployClassInstance():
        Promise<BaseDeployMySqlAzureInfrastructure> {
        return this.promiseGate.promise.then(
            function(baseClass: BaseDeployMySqlAzureInfrastructure) {
                return baseClass;
            }
        );
    }

    public async setUpFirewallForSqlScript() {
        if (this.deploymentType === Resource.DeployType.LocalDevelopment) {
            return Promise.resolve();
        }

        const initSqlCommand =
`mysql -h ${this.mySqlAzureFullName}.mysql.database.azure.com \
-u ${this.securityName}@${this.mySqlAzureFullName} \
-p${this.password} -v`;
        let devIp: string = "";
        const firewallRuleName = Crypto.randomBytes(12).toString("hex");
        const re =
            /Client with IP address (.*) is not allowed to access the server/;
        try {
            await CommonUtilities.exec(initSqlCommand,
                                        this.targetDirectoryPath);
            Winston.debug("The request that was supposed to fail to talk to \
    mySQl so we could find out what IP address Azure mySQL sees actually \
    succeeded!");
        } catch (err) {
            const result = err.message.match(re);
            if (result.length !== 2) {
                throw new Error(`Search for dev IP failed with ${err}`);
            }
            devIp = result[1];
        }

        if (devIp === "") {
            throw new Error("Call to get our IP failed!");
        }

        await this.setFirewallRule(firewallRuleName, devIp);
        return firewallRuleName;
    }
    public async runMySqlScript(pathToScript: string) {
        const initSqlCommand =
`mysql -h ${this.mySqlAzureFullName}.mysql.database.azure.com \
-u ${this.securityName}@${this.mySqlAzureFullName} \
-p${this.password} -v < "${pathToScript}"`;
        const re =
            /Client with IP address (.*) is not allowed to access the server/;
        CommonUtilities.retryAfterFailure(async () => {
            await CommonUtilities.exec(initSqlCommand,
                                    this.targetDirectoryPath);
        }, 5);
    }

    public setFirewallRule(name: string, ipAddress: string) {
        return CommonUtilities.runAzCommand(
`az mysql server firewall-rule create \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server ${this.mySqlAzureFullName} \
--name "${name}" --start-ip-address "${ipAddress}" \
--end-ip-address "${ipAddress}"`);
    }

    private setFirewallAllowAll() {
        return CommonUtilities.runAzCommand(
`az mysql server firewall-rule create \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server ${this.mySqlAzureFullName} \
--name "${this.baseName}AllAccess" --start-ip-address "0.0.0.0" \
--end-ip-address "255.255.255.255"`);
    }

    private removeFirewallRule(name: string) {
        return CommonUtilities.runAzCommand(
`az mysql server firewall-rule delete \
--resource-group ${this.resourceGroup.resourceGroupName} \
--server-name ${this.mySqlAzureFullName} \
--name "${name}" --yes`, CommonUtilities.azCommandOutputs.string);
    }
}
