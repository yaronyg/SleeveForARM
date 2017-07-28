import { expect } from "chai";
import * as fs from "fs-extra-promise";
import * as path from "path";
import * as Request from "request-promise-native";
import * as Winston from "winston";
import { azCommandOutputs, exec, runAzCommand,
            runPowerShellScript } from "../src/common-utilities";
import ResourceGroup from "../src/resourcegroup";
import WebappNodeAzure from "../src/webapp-node-azure";
import * as TestUtilities from "./testUtilities";

describe("Web app Node Azure", () => {
    before(async () => {
        await exec("npm link", path.join(__dirname, ".."));
    });
    after(async () => {
        await exec("npm rm --global sleeveforarm", path.join(__dirname, ".."));
    });

    let testingDirFullPath: string;
    beforeEach(async function() {
        testingDirFullPath = await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(() => {
        TestUtilities.tearDownMochaTestLogging();
    });

    it("should be deployable", async function() {
        // tslint:disable-next-line:max-line-length
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = path.join(testingDirFullPath, "webApp");
        const webappNode =
            new WebappNodeAzure().setDirectoryPath(webAppSamplePath);
        const resourceGroup = new ResourceGroup().setBaseName("ick3");
        await resourceGroup.deployResource([]);
        await WebappNodeAzure.setup(webAppSamplePath);
        const webAppResult =
            await webappNode.deployResource([resourceGroup]);
        await runPowerShellScript(webAppResult.powerShellScript);
        await webAppResult.functionToCallAfterScript();
        const deployedURL = await webappNode.getDeployedURL();
        const getResult = await Request.get(deployedURL);
        expect(getResult).equals("Hello World!");
    });
});
