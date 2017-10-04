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
    if (ServiceEnvironmentUtilities.cdnprefix === "NO_CDN_SET") {
        throw new Error(
            `CDN endpoint is not avaialble without proper setup`);
            // why do you even call this method without set up the CDN?
    }else {
        const endpoint = process.env[ServiceEnvironmentUtilities.cdnprefix];
        if (endpoint !== undefined) {
            return endpoint;
        }else {
            // tslint:disable-next-line:max-line-length
            return "127.0.0.1"; // very likely this path is under the local dev given the CDN is setup yet no endpoint is avaialbe from the current env property
        }
    }
}
