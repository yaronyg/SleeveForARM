import { expect } from "chai";
import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Request from "request-promise-native";
import * as Winston from "winston";
import * as CommonUtilities from "../src/common-utilities";
import ResourceGroup from "../src/resourcegroup";
import WebappNodeAzure from "../src/webapp-node-azure";
import * as TestUtilities from "./testUtilities";

describe("Web app Node Azure", () => {
    before(async () => {
        await CommonUtilities.exec("npm link", Path.join(__dirname, ".."));
    });

    let testingDirFullPath: string;
    beforeEach(async function() {
        testingDirFullPath = await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(() => {
        TestUtilities.tearDownMochaTestLogging();
    });

    it("should be deployable", async function() {
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath, "webApp");
        await fs.emptyDirAsync(webAppSamplePath);
        await WebappNodeAzure.setup(webAppSamplePath);
        await CommonUtilities.exec("npm link sleeveforarm", webAppSamplePath);
        await CommonUtilities.exec("npm install", webAppSamplePath);
        const webAppNode: WebappNodeAzure =
            require(Path.join(webAppSamplePath, "sleeve.js"));
        webAppNode.setDirectoryPath(webAppSamplePath);
        const resourceGroup = new ResourceGroup().setBaseName("ick3");
        await resourceGroup.deployResource([]);
        const webAppResult =
            await webAppNode.deployResource([resourceGroup]);
        await CommonUtilities
            .runPowerShellScript(webAppResult.powerShellScript);
        await webAppResult.functionToCallAfterScriptRuns();
        const deployedURL = await webAppNode.getDeployedURL();
        const getResult = await Request.get(deployedURL);
        expect(getResult).equals("Hello World!");
    });
});
