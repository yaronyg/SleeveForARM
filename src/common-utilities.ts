// tslint:disable-next-line:no-var-requires
const { promisify, format } = require("util");
import child_process = require("child_process");

const exec = promisify(child_process.exec);

export async function runAzCommand(command: string) {
    try {
        const commandResult = await exec(command);
        if (commandResult.stderr) {
            throw new Error(commandResult.stderr);
        }
        return JSON.parse(commandResult.stdout);
    } catch (error) {
        throw(new Error(format("runAzCommand %s failed with %s",
                                        command, error)));
    }
}

export async function azAppServiceListLocations()
                                            : Promise<Array<{name: string}>> {
    return await module.exports.runAzCommand("az appservice list-locations");
}
