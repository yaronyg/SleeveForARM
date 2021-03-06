import { expect } from "chai";
import * as fs from "fs-extra";
import * as Path from "path";
import * as CliUtilities from "../src/cliUtilities";
import * as CommonUtilities from "../src/common-utilities";
import * as MySqlAzureInfrastructure from "../src/mysql-azureinfrastructure";
import * as Resource from "../src/resource";
import * as TestUtilities from "./testUtilities";

describe("mySQL Azure", () => {
    before(async function() {
        this.timeout(60 * 1000);
        await CommonUtilities.exec("npm link", Path.join(__dirname, ".."));
    });

    let testingDirFullPath: string;
    let sleeveCommandLocation: string;
    let resourcesInEnvironment: CliUtilities.InfraResourceType[];
    beforeEach(async function() {
        [testingDirFullPath, sleeveCommandLocation] =
            await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(async function() {
        await TestUtilities.tearDownMochaTestLogging(resourcesInEnvironment,
            testingDirFullPath, this);
    });

    const sqlFile =
"CREATE DATABASE IF NOT EXISTS foo;\n\
use foo;\n\
CREATE TABLE IF NOT EXISTS fooers (name VARCHAR(255));\n\
INSERT INTO fooers (name) VALUES ('A Name');\n";

    const testSqlFile =
"use foo;\n\
SELECT * FROM fooers\n";

    const sleeveJSFile =
'const MySqlAzure = require("sleeveforarm/src/mysql-azure").default;\n\
module.exports = new MySqlAzure().addMySqlInitializationScript("sqlFile");\n';

    it("should be deployable", async function() {
        const deploymentType = Resource.DeployType.Production;
        this.timeout(10 * 60 * 1000);

        const mySqlSamplePath = Path.join(testingDirFullPath,
            TestUtilities.generateRandomTestGroupName());

        await fs.emptyDir(mySqlSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
                                    mySqlSamplePath);

        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t mySqlAzure -n mySql`,
                                    mySqlSamplePath);
        // await CliUtilities.setup(mySqlSamplePath, "mySql", "mySqlAzure");

        const sqlDir = Path.join(mySqlSamplePath, "mySql");
        await fs.writeFile(Path.join(sqlDir, "sqlFile"), sqlFile);

        const sqlSleeveJs = Path.join(sqlDir, "sleeve.js");
        await fs.remove(sqlSleeveJs);
        await fs.writeFile(sqlSleeveJs, sleeveJSFile);

        const testSqlFilePath = Path.join(sqlDir, "testSqlFile");
        await fs.writeFile(testSqlFilePath, testSqlFile);

        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);
        resourcesInEnvironment =
            await CliUtilities.deployResources(mySqlSamplePath, deploymentType,
                                                false);

        const sqlResource =
            resourcesInEnvironment.find((resource) =>
                CommonUtilities.isClass(resource,
                        // tslint:disable-next-line:max-line-length
                        MySqlAzureInfrastructure.MySqlAzureInfrastructure)) as MySqlAzureInfrastructure.MySqlAzureInfrastructure;

        // tslint:disable-next-line:no-unused-expression
        expect(sqlResource).to.not.be.undefined;

        await sqlResource.setFirewallAllowAll();

        const result = await sqlResource.runMySqlScript(testSqlFilePath);

        expect(result.stdout).includes("name").and.includes("A Name");
    });
});
