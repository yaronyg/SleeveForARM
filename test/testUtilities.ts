import * as fs from "fs-extra";
import * as generatePassword from "generate-password";
import * as Path from "path";
import * as Winston from "winston";
import * as CliUtilities from "../src/cliUtilities";
import * as CommonUtilities from "../src/common-utilities";
import * as Data from "../src/data";
// tslint:disable-next-line:max-line-length
import * as ResourceGroupInfrastructure from "../src/resourceGroupInfrastructure";

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

export async function tearDownMochaTestLogging(
        resourcesInEnvironment: CliUtilities.InfraResourceType[],
        testingDirFullPath: string,
        mochaState: Mocha.IBeforeAndAfterContext) {
    Winston.remove(Winston.transports.File);
    for (const resource of resourcesInEnvironment) {
        if (CommonUtilities.isClass(resource,
            ResourceGroupInfrastructure.ResourceGroupInfrastructure)) {
await (resource as ResourceGroupInfrastructure.ResourceGroupInfrastructure)
                .deleteResource();
        }
    }
    // If the test failed we want to keep the files and resources around
    // so we can investigate
    if (mochaState.currentTest.state !== "failed") {
        try {
            fs.removeSync(testingDirFullPath);
        } catch (err) {
            if (err.code !== "ENOTEMPTY") {
                // The log file is still trying to write which
                // screws up the delete but it's o.k., all the
                // files are gone
                throw err;
            }
        }
    }
}

export function generateRandomTestGroupName(): string {
    return generatePassword.generate({
        length: Data.data.ResourceGroupLength
        - Data.data.DataCenterAcronymLength
        - Data.data.DeploymentTypeIdLength,
        numbers: false, // The first char can't be a number
                        // so I just ban them completely.
        symbols: false,
        uppercase: false
    });
}
