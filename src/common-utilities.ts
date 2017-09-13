import * as child_process from "child_process";
import * as fs from "fs-extra";
import * as jsonCycle from "json-cycle";
import * as Path from "path";
import { format, promisify } from "util";
import * as Winston from "winston";
import * as CommonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import * as IInfrastructure from "./IInfrastructure";
import IStorageResource from "./IStorageResource";
import * as Resource from "./resource";

const childProcessExec = promisify(child_process.exec);

export enum azCommandOutputs {
    json,
    string,
}

export interface IExecOutput { stdout: string; stderr: string; }

export async function exec(command: string, cwd: string): Promise<IExecOutput> {
    try {
        Winston.debug(`exec about to run command ${command} in cwd ${cwd}`);
        const result = await childProcessExec(command, { cwd });
        Winston.debug("exec ran with command %s in directory %s and got \
                        output %j", command, cwd, jsonCycle.decycle(result));
        return result;
    } catch (err) {
        Winston.debug("exec ran with command %s in directory %s and \
                        failed with error %j\n\
stdout %s\nstderr %s\n", command, cwd, err, err.stdout, err.stderr);
        throw err;
    }
}

export async function runExecFailOnStderr(command: string, skipLog = false) {
    try {
        Winston.debug(`runExecFailOnStderr about to run command ${command}`);
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

export async function runAzCommand(command: string,
                                   output = azCommandOutputs.json)
                                   : Promise<any | string> {
    Winston.debug(`About to exec command ${command}`);
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
    const directoryContents = await fs.readdir(parentPath);
    const promisesToWaitFor = [];
    for (const childFileName of directoryContents) {
        const candidatePath = Path.join(parentPath, childFileName);
        const isDirectory = (await fs.stat(candidatePath)).isDirectory;
        const sleevePath = Path.join(candidatePath, "sleeve.js");
        if (isDirectory && await fs.pathExists(sleevePath)) {
            promisesToWaitFor.push(processFunction(candidatePath));
        }
    }
    return Promise.all(promisesToWaitFor);
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

export function isIInfrastructure(object: any)
        : object is IInfrastructure.IInfrastructure<any> {
    return (object as IInfrastructure.IInfrastructure<any>)
        .initialize !== undefined;
}

export function isResource(object: any): object is Resource.Resource {
    return object instanceof Resource.Resource;
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

export function findInfraResourcesByInterface<T>(
    resources: Resource.Resource[] | Array<IInfrastructure.IInfrastructure<any>>
        | IStorageResource[],
    interfaceCheck: (object: any) => object is T)
        : Array<Resource.Resource & IInfrastructure.IInfrastructure<any> & T> {
    const passingResource
    : Array<Resource.Resource & IInfrastructure.IInfrastructure<any> & T> = [];
    for (const resource of resources) {
        if (interfaceCheck(resource) && isResource(resource)
            && isIInfrastructure(resource)) {
            passingResource.push(resource);
        }
    }
    return passingResource;
}

export const scratchDirectoryName = ".sleeve";

export function localScratchDirectory(targetDirectoryPath: string) {
  return Path.join(targetDirectoryPath, scratchDirectoryName);
}

export async function wait(millisecondsToWait: number) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve();
        }, millisecondsToWait);
    });
}

export async function retryAfterFailure<T>(command: () => Promise<T>,
                                           counter: number): Promise<T> {
    try {
        return await command();
    } catch (err) {
        if (counter === 0) {
            throw err;
        }
        await wait(1000);
        return await retryAfterFailure(command, --counter);
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
export function isClass(obj: object, classObj: any): boolean {
    return Object.getPrototypeOf(obj).constructor.name === classObj.name;
}

export function validateResource(resourcename: string, length: number) {
    return ((resourcename.length < length) &&
            (RegExp("^[a-zA-Z][a-zA-Z0-9]+$").test(resourcename)));
}

/**
 * Walks up the directory hierarchy look for the root of a GIT
 * project.
 * @param startDir The path to start the directory walk in
 */
export async function findGitRootDir(startDir: string)
        : Promise<string> {
    let currentDir = startDir;
    while (true) {
        if (await fs.pathExists(currentDir) === false) {
            throw new Error("This isn't a git project");
        }
        if (await fs.pathExists(Path.join(currentDir, ".git"))) {
            return currentDir;
        }
        currentDir = Path.normalize(Path.join(currentDir, ".."));
    }
}
