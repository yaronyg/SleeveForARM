import { expect } from "chai";
import * as fs from "fs-extra-promise";
import * as path from "path";
import * as Request from "request-promise-native";
import * as Winston from "winston";
import { exec } from "../src/common-utilities";
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
        this.timeout(10 * 60 * 1000);
        const webappNode = new WebappNodeAzure();
        const resourceGroup = new ResourceGroup();
        await resourceGroup.deployResource("ick3", []);
        const webAppSamplePath = path.join(testingDirFullPath, "webApp");
        await webappNode.setup(webAppSamplePath);
        const webAppURL =
            await webappNode.deployResource(webAppSamplePath, [resourceGroup]);
        const getResult = await Request.get(webAppURL);
        expect(getResult).equals("Hello World!");
    });
});
