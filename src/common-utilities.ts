import * as child_process from "child_process";
import * as fs from "fs-extra-promise";
import * as jsonCycle from "json-cycle";
import * as tmp from "tmp-promise";
import { format, promisify } from "util";
import * as Winston from "winston";

const childProcessExec = promisify(child_process.exec);

export enum azCommandOutputs {
    json,
    string,
}

export async function exec(command: string, cwd: string) {
    let result;
    try {
        result = child_process.exec(command, { cwd });
        Winston.debug("exec ran with command %s in directory %s and got \
                        output %j", command, cwd, jsonCycle.decycle(result));
    } catch (err) {
        Winston.error("exec ran with command %s in directory %s and \
                        failed with error %j and output %j",
                        command, cwd, err, jsonCycle.decycle(result));
    }
}

export async function runExecFailOnStderr(command: string, skipLog = false) {
    let commandResult;
    try {
        commandResult = await childProcessExec(command);
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
                command, commandResult);
        }
        throw new Error(format("Command %s failed with error %j",
                        command, err));
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
