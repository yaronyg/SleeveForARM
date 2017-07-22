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
        throw new Error(format("runAzCommand %s failed with %s", command,
                        error));
    }
}

export async function azAppServiceListLocations()
                                            : Promise<Array<{name: string}>> {
    return await module.exports.runAzCommand("az appservice list-locations");
}

export const enum ValidationResult {
        tooLong = "too long",
        tooShort = "too short",
        nullOrUndefined = "null or undefined",
        notAlphaNumeric = "not alpha numeric",
        valid = "valid",
}

const alphaNumericRegex = /^[0-9a-zA-Z]+$/;

export function validateName(minLength: number, maxlength: number,
                             proposedName?: string): ValidationResult {
    if ((typeof proposedName === "undefined") ||
        (proposedName === null)) {
        return ValidationResult.nullOrUndefined;
    }

    if (proposedName.length < minLength) {
        return ValidationResult.tooShort;
    }

    if (proposedName.length > maxlength) {
        return ValidationResult.tooLong;
    }

    if (proposedName.match(alphaNumericRegex) === null) {
        return ValidationResult.notAlphaNumeric;
    }

    return ValidationResult.valid;
}
