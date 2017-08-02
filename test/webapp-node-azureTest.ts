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
        const sleeveCommandLocation =
            Path.join(testingDirFullPath, "..", "..", "..", "..",
                        "src", "sleeve.cmd");
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
            webAppSamplePath);

        const resourceGroup: ResourceGroup =
            require(Path.join(webAppSamplePath, "sleeve.js"))
            .setDirectoryPath(webAppSamplePath);
        await resourceGroup.testingCalculateResourceGroupName();
        const webAppNode: WebappNodeAzure =
            require(Path.join(webAppSamplePath, "foo", "sleeve.js"))
            .setDirectoryPath(Path.join(webAppSamplePath, "foo"));
        webAppNode
            .setResourceGroup(resourceGroup)
            .setDefaultWebAppDNSName();
        const deployedURL = await webAppNode.getDeployedURL();
        const getResult = await Request.get(deployedURL);
        expect(getResult).equals("Hello World!");
    });
});
