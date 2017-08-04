import * as child_process from "child_process";
import * as fs from "fs-extra-promise";
import * as jsonCycle from "json-cycle";
import * as Path from "path";
import * as tmp from "tmp-promise";
import { format, promisify } from "util";
import * as Winston from "winston";
import * as CommonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";

const childProcessExec = promisify(child_process.exec);

export enum azCommandOutputs {
    json,
    string,
}

export async function exec(command: string, cwd: string) {
    try {
        const result = await childProcessExec(command, { cwd });
        Winston.debug("exec ran with command %s in directory %s and got \
                        output %j", command, cwd, jsonCycle.decycle(result));
        return result;
    } catch (err) {
        Winston.error("exec ran with command %s in directory %s and \
                        failed with error %j\n\
stdout %s\nstderr %s\n", command, cwd, err, err.stdout, err.stderr);
        throw err;
    }
}

export async function runExecFailOnStderr(command: string, skipLog = false) {
    try {
        const commandResult = await childProcessExec(command);
        if (commandResult.stderr) {
            throw new Error(commandResult.stderr);
        }
        if (!skipLog) {
            Winston.debug("Exec Command: %s with stdout: %s",
                command, commandResult.stdout);
        }
        return commandResult.stdout;
    } catch (err) {
        if (!skipLog) {
            Winston.error("Exec Command: %s failed with commandResult %j",
                command, err);
        }
        throw new Error(format("Command %s failed with error %j\n\
stdout %s\nstderr %s", command, err, err.stdout, err.stderr));
    }
}

export async function runPowerShellScript(scriptContents: string) {
    const tempFileObject = await tmp.file({prefix: "sleeve-", postfix: ".ps1"});
    await fs.writeAsync(tempFileObject.fd, scriptContents);
    await fs.closeAsync(tempFileObject.fd);
    await runExecFailOnStderr(`powershell ${tempFileObject.path}`);
    console.log(`Temp file location is ${tempFileObject.path}`);
}

export async function runAzCommand(command: string,
                                   output = azCommandOutputs.json)
                                   : Promise<any | string> {
    const stdout = await runExecFailOnStderr(command, true);
    switch (output) {
        case azCommandOutputs.json: {
            const jsonOut = JSON.parse(stdout);
            Winston.debug("Exec command %s with output %j", command, jsonOut);
            return JSON.parse(stdout);
        }
        case azCommandOutputs.string: {
            Winston.debug("Exec command %s with output %s", command, stdout);
            return stdout;
        }
        default: {
            throw new Error("Unsupported output type: " + output);
        }
    }
}

export async function azAppServiceListLocations()
                                            : Promise<Array<{name: string}>> {
    return await module.exports.runAzCommand("az appservice list-locations");
}

export function addPasswordToGitURL(gitURL: string, password: string): string {
        // Insert password with ":" at the front before the first '@' character
        const indexOfAt = gitURL.indexOf("@");
        return gitURL.slice(0, indexOfAt) + ":" + password +
            gitURL.slice(indexOfAt);
}

export async function npmSetup(path: string) {
    await CommonUtilities
        .exec("npm link sleeveforarm", path);
    await CommonUtilities
        .exec("npm install", path);
}

export async function executeOnSleeveResources(parentPath: string,
                                               processFunction:
                                (path: string) => Promise<void>) {
    const directoryContents = await fs.readdirAsync(parentPath);
    for (const childFileName of directoryContents) {
        const candidatePath = Path.join(parentPath, childFileName);
        const isDirectory = await fs.isDirectoryAsync(candidatePath);
        const sleevePath = Path.join(candidatePath, "sleeve.js");
        if (isDirectory && await fs.existsAsync(sleevePath)) {
            await processFunction(candidatePath);
        }
    }
}

/**
 * Javascript doesn't know what interfaces are so when one imports
 * an interface in Typescript this does not produce any code in Javascript.
 * But typescript still happily lets one specify (foo instance of I) where I
 * is the interface. But that check won't work. So we have to do a duck
 * typing check instead.
 */
export function isIGlobalDefault(object: any): object is IGlobalDefault {
  return (object as IGlobalDefault).isGlobalDefault !== undefined;
}

export function findGlobalResourceResourceByType(resources: Resource.Resource[],
                                                 resourceType: any)
                                                 : Resource.Resource {
    const resourceFound = resources.find((resource) => {
        return resource instanceof resourceType &&
               isIGlobalDefault(resource);
    });
    if (resourceFound === undefined) {
        throw new Error(`ResourceType ${resourceType} not found in \
${resources}`);
    }
    return resourceFound;
}

