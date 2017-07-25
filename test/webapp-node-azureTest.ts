import * as childProcess from "child_process";
import * as fs from "fs-extra-promise";
import * as path from "path";
import ResourceGroup from "../src/resourcegroup";
import WebappNodeAzure from "../src/webapp-node-azure";

describe("Web app Node Azure", () => {
    before(async () => {
        await childProcess.exec("npm link", { cwd: path.join(__dirname, "..")});
    });
    after(async () => {
        await childProcess.exec("npm rm --global sleeveforarm",
            { cwd: path.join(__dirname, "..")});
    });

    const testingDirFullPath = path.join(__dirname, "testing");
    beforeEach(async () => {
        await fs.ensureDirAsync(testingDirFullPath);
    });
    afterEach(async () => {
        await fs.removeAsync(testingDirFullPath);
    });

    it("should be deployable", async function() {
        this.timeout(10 * 60 * 1000);
        const webappNode = new WebappNodeAzure();
        const resourceGroup = new ResourceGroup();
        await resourceGroup.deployResource("ick3", []);
        const webAppSamplePath = path.join(testingDirFullPath, "webApp");
        await webappNode.setup(webAppSamplePath);
        await webappNode.deployResource(webAppSamplePath, [resourceGroup]);
    });
});
