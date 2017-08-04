import * as fs from "fs-extra-promise";
import * as path from "path";
import * as Winston from "winston";

export const testingDirParentPath = path.join(__dirname, "..",
                                        "disposableTestFiles");

function generateLogPath(mochaThis) {
    return path.join(testingDirParentPath, mochaThis.currentTest.parent.title,
                     mochaThis.currentTest.title);
}

export async function setupMochaTestLogging(mochaThis): Promise<string> {
    const testingDirFullPath = generateLogPath(mochaThis);
    await fs.emptyDirAsync(testingDirFullPath);
    const logFilePath = path.join(testingDirFullPath, "output.log");
    Winston.add(Winston.transports.File, {
        filename: logFilePath,
        level: "silly"
    });
    return testingDirFullPath;
}

export function tearDownMochaTestLogging() {
    Winston.remove(Winston.transports.File);
}
