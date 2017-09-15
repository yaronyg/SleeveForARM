import * as fs from "fs-extra";
import * as Path from "path";
import * as Winston from "winston";

export const testingDirParentPath = Path.join(__dirname, "..",
                                        "disposableTestFiles");

function generateLogPath(mochaThis: Mocha.IBeforeAndAfterContext) {
    return Path.join(testingDirParentPath, mochaThis.currentTest.parent.title,
                     mochaThis.currentTest.title);
}

export async function setupMochaTestLogging(
    mochaThis: Mocha.IBeforeAndAfterContext, emptyDir = true)
        : Promise<[string, string]> {
    const testingDirFullPath = generateLogPath(mochaThis);
    if (emptyDir) {
        await fs.emptyDir(testingDirFullPath);
    }
    const logFilePath = Path.join(testingDirFullPath, "output.log");
    Winston.add(Winston.transports.File, {
        filename: logFilePath,
        level: "silly"
    });
    Winston.remove(Winston.transports.Console);
    Winston.add(Winston.transports.Console, {
        level: "silly",
        stderrLevels: []
    });
    const sleeveCommandLocation =
            Path.join(testingDirFullPath, "..", "..", "..",
                                        "src", "sleeveforarm.cmd");
    return [testingDirFullPath, sleeveCommandLocation];
}

export function tearDownMochaTestLogging() {
    Winston.remove(Winston.transports.File);
}
