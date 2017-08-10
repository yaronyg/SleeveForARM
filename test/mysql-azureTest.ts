import { expect } from "chai";
import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as CliUtilities from "../src/cliUtilities";
import * as CommonUtilities from "../src/common-utilities";
import * as Resource from "../src/resource";
import * as TestUtilities from "./testUtilities";

describe("mySQL Azure", () => {
    before(async function() {
        this.timeout(60 * 1000);
        await CommonUtilities.exec("npm link", Path.join(__dirname, ".."));
    });

    let testingDirFullPath: string;
    let sleeveCommandLocation: string;
    beforeEach(async function() {
        [testingDirFullPath, sleeveCommandLocation] =
            await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(function() {
        TestUtilities.tearDownMochaTestLogging();
    });

    it("should be deployable", async function() {
        const deploymentType = Resource.DeployType.LocalDevelopment;
        this.timeout(10 * 60 * 1000);
        const mySqlSamplePath = Path.join(testingDirFullPath, "mySQL");

        await fs.emptyDirAsync(mySqlSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
                                    mySqlSamplePath);

        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t mySqlAzure -n mySql`,
                                    mySqlSamplePath);
        // await CliUtilities.setup(mySqlSamplePath, "mySql", "mySqlAzure");

        await CommonUtilities.exec(
`${sleeveCommandLocation} setup -t webapp-node -n webApp`, mySqlSamplePath);

        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);
        await CliUtilities.deployResources(mySqlSamplePath, deploymentType);
    });
});
