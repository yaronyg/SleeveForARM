import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as ReadLine from "readline";
import * as CommonUtilities from "./common-utilities";

export interface INameValue {
    name: string;
    value: string;
}

interface INameValueHolder {
    values: INameValue[];
}

export const environmentFileName = "environmentVariables.txt";

export function readEnvironmentVariables() {
    const scratchPath = Path.join(process.cwd(),
                                    CommonUtilities.scratchDirectoryName,
                                    environmentFileName);
    if (fs.existsSync(scratchPath) === false) {
        return [];
    }
    const result: INameValue[] = [];
    const linesOfFile = fs.readFileSync(scratchPath, "utf-8").split("\r\n");
    for (const line of linesOfFile) {
        const nameValue = line.split(" ");
        if (nameValue.length !== 2) {
            continue;
        }
        result.push({
            name: nameValue[0],
            value: nameValue[1]
        });
    }
    return result;
}

export function setProcessEnv() {
    const localOverides = readEnvironmentVariables();
    for (const nameValue of localOverides) {
        process.env["APPSETTING_" + nameValue.name] = nameValue.value;
    }
}

export const resourceHostSuffix = "_host";
export const resourceUserSuffix = "_user";
export const resourcePasswordSuffix = "_password";
