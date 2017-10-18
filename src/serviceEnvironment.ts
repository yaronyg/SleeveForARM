import * as MySql2 from "mysql2";
import * as ServiceEnvironmentUtilities from "./serviceEnvironmentUtilities";

ServiceEnvironmentUtilities.setProcessEnv();

export function getMySqlConnectionObject(mySqlServerName: string,
                                         database?: string)
                                         : MySql2.ConnectionOptions {
    const host = process.env["APPSETTING_" + mySqlServerName +
        ServiceEnvironmentUtilities.resourceHostSuffix];
    const user = process.env["APPSETTING_" + mySqlServerName +
        ServiceEnvironmentUtilities.resourceUserSuffix];
    const password = process.env["APPSETTING_" + mySqlServerName +
        ServiceEnvironmentUtilities.resourcePasswordSuffix];

    if (host === undefined || user === undefined || password === undefined) {
        throw new Error(
            `Resource ${mySqlServerName} does not exist in environment`);
    }

    const baseConnectionObject: MySql2.ConnectionOptions = {
        host,
        password,
        port: 3306,
        ssl: {},
        user
    };

    if (database !== undefined) {
        baseConnectionObject.database = database;
    }

    return baseConnectionObject;
}

export function getCDNEndpoint() {
        const endpoint = process.env[ServiceEnvironmentUtilities.cdnprefix];
        if (endpoint !== "CDN_NOT_SET") {
            return endpoint;
        } else {
            throw new Error(
                `CDN endpoint is not available without proper setup`);
        }
}
