import { expect } from "chai";
import * as fs from "fs-extra-promise";
import "mocha";
import * as Path from "path";
import * as CommonUtilities from "../src/common-utilities";
import * as Resource from "../src/resource";
import ResourceGroup from "../src/resourcegroup";
import * as TestUtilities from "./testUtilities";

describe("Resource group", () => {
    before(async () => {
        await CommonUtilities.exec("npm link", Path.join(__dirname, ".."));
    });

    let testingDirFullPath: string;
    beforeEach(async function() {
        [ testingDirFullPath ] =
            await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(() => {
        TestUtilities.tearDownMochaTestLogging();
    });

    it("should be created, even if it exists", async () => {
        const resourceGroupPath =
            Path.join(testingDirFullPath, "resourceGroup");
        await fs.emptyDirAsync(resourceGroupPath);
        await ResourceGroup.setup(resourceGroupPath);
        await CommonUtilities
            .exec("npm link sleeveforarm", resourceGroupPath);
        await CommonUtilities
            .exec("npm install", resourceGroupPath);
        const resourceGroup: ResourceGroup =
            require(Path.join(resourceGroupPath, "sleeve.js"));
        resourceGroup.setBaseName("silly");

        // tslint:disable-next-line:max-line-length
        const expectedOutput = "az group create --name sillysouthcentralus --location southcentralus\n";
        async function runOnce() {
            const result: Resource.IDeployResponse =
                await resourceGroup.deployResource([]);
            expect(result.powerShellScript).equals(expectedOutput);
            await CommonUtilities.runAzCommand(expectedOutput);
        }
        await runOnce();
        await runOnce();
    });
});
