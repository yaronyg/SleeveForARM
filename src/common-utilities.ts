import * as child_process from "child_process";
import * as fs from "fs-extra-promise";
import { format, promisify } from "util";

const exec = promisify(child_process.exec);

export enum azCommandOutputs {
    json,
    string,
}

export async function runExecFailOnStderr(command: string) {
    try {
        const commandResult = await exec(command);
        if (commandResult.stderr) {
            throw new Error(commandResult.stderr);
        }
        return commandResult.stdout;
    } catch (err) {
        throw new Error(format("Command %s failed with error %j",
                        command, err));
    }
}

export async function runAzCommand(command: string,
                                   output = azCommandOutputs.json)
                                   : Promise<any | string> {
    const stdout = await runExecFailOnStderr(command);
    switch (output) {
        case azCommandOutputs.json: {
            return JSON.parse(stdout);
        }
        case azCommandOutputs.string: {
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
