import * as child_process from "child_process";
import * as fs from "fs-extra-promise";
import * as HTTP from "http";
import * as jsonCycle from "json-cycle";
import * as Path from "path";
import * as tmp from "tmp-promise";
import { format, promisify } from "util";
import * as Winston from "winston";
import * as CommonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import IStorageResource from "./IStorageResource";
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
    return new Promise(async function(resolve, reject) {
        const tempFileObject =
            await tmp.file({prefix: "sleeve-", postfix: ".ps1"});
        await fs.writeAsync(tempFileObject.fd, scriptContents);
        await fs.closeAsync(tempFileObject.fd);
        Winston.debug(`Temp file location is ${tempFileObject.path}`);

        const ps = child_process.spawn("powershell.exe",
            ["-NoLogo", "-NonInteractive", tempFileObject.path]);

        ps.stdout.on("data", (data) =>
            Winston.debug("stdout:" + data.toString()));
        ps.stderr.on("data", (data) =>
            Winston.debug("stderr:" + data.toString()));
        ps.on("exit", (code) => {
            if (code !== 0) {
                const error = `runPowerShell ${tempFileObject.path} failed \
with code ${code}.`;
                Winston.error(error);
                reject(Error(error));
            }
            resolve();
        });
    });
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

export function isIStorageResource(object: any): object is IStorageResource {
    return (object as IStorageResource).isStorageResource !== undefined;
}

export function findGlobalDefaultResourceByType(resources: Resource.Resource[],
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

export function findResourcesByInterface<T>(
    resources: Resource.Resource[],
    interfaceCheck: (object: any) => object is T): T[] {
    const passingResource: T[] = [];
    for (const resource of resources) {
        if (interfaceCheck(resource)) {
            passingResource.push(resource);
        }
    }
    return passingResource;
}

export const scratchDirectoryName = ".sleeve";

export function localScratchDirectory(targetDirectoryPath: string) {
  return Path.join(targetDirectoryPath, scratchDirectoryName);
}

/**
 * Appends a check for exe failure to a powershell script
 * command call.
 * @param command We assume the command ends in \n
 * @param indent How many spaces to indent the command
 */
export function appendErrorCheck(command: string, indent: number = 0) {
    const indentSpaces = Array(indent + 1).join(" ");
    return command +
// tslint:disable-next-line:max-line-length
`${indentSpaces}if ($LastExitCode -ne 0) { throw \"Command \" + (h)[-1].CommandLine + \" Failed\" }\n`;
}

export function getMyIp(): Promise<string> {
    return new Promise(function(resolve, reject) {
        HTTP.get({host: "api.ipify.org", port: 80, path: "/"},
            function(resp) {
                resp.on("data", function(ip) {
                    resolve(ip.toString());
                });
                resp.on("error", function(err) {
                    reject(err);
                });
            });
    });
}

export async function wait(millisecondsToWait: number) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve();
        }, millisecondsToWait);
    });
}

export async function retryAfterFailure(command: () => Promise<void>,
                                        counter: number) {
    try {
        await command();
    } catch (err) {
        if (counter === 0) {
            throw err;
        }
        await wait(1000);
        await retryAfterFailure(command, --counter);
    }
}

/**
 * I keep running into bizarre situations where instanceof
 * just doesn't work. I checked the Javascript and I have
 * no idea what's going on. But really simple checks like
 * an object that says it is of type foo will return
 * false to "obj instanceof foo". So I have to use this
 * check instead. Note that this is NOT a substitute for
 * instanceof since I don't check inheritance.
 */
export function isClass(obj: object, classObj: object): boolean {
    return Object.getPrototypeOf(obj).constructor.name === classObj.name;
}
