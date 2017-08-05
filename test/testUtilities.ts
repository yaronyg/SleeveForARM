import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Winston from "winston";

export const testingDirParentPath = Path.join(__dirname, "..",
                                        "disposableTestFiles");

function generateLogPath(mochaThis) {
    return Path.join(testingDirParentPath, mochaThis.currentTest.parent.title,
                     mochaThis.currentTest.title);
}

export async function setupMochaTestLogging(mochaThis, emptyDir = true)
        : Promise<[string, string]> {
    const testingDirFullPath = generateLogPath(mochaThis);
    if (emptyDir) {
        await fs.emptyDirAsync(testingDirFullPath);
    }
    const logFilePath = Path.join(testingDirFullPath, "output.log");
    Winston.add(Winston.transports.File, {
        filename: logFilePath,
        level: "silly"
    });
    const sleeveCommandLocation =
            Path.join(testingDirFullPath, "..", "..", "..",
                                        "src", "sleeve.cmd");
    return [testingDirFullPath, sleeveCommandLocation];
}

export function tearDownMochaTestLogging() {
    Winston.remove(Winston.transports.File);
}
