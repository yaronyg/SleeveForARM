import { expect } from "chai";
import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Request from "request-promise-native";
import * as Winston from "winston";
import * as CliUtilities from "../src/cliUtilities";
import * as CommonUtilities from "../src/common-utilities";
import * as Resource from "../src/resource";
import ResourceGroup from "../src/resourcegroup";
import ResourceGroupInfrastructure from "../src/resourcegroupInfrastructure";
import WebappNodeAzure from "../src/webapp-node-azure";
// tslint:disable-next-line:max-line-length
import WebappNodeAzureInfrastructure from "../src/webapp-node-azureinfrastructure";
import * as TestUtilities from "./testUtilities";

describe("Web app Node Azure", () => {
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
        const deploymentType = Resource.DeployType.Production;
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath, "webApp");
        await fs.emptyDirAsync(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);
        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);
        await CliUtilities.deployResources(webAppSamplePath, deploymentType);

        const resourceGroup: ResourceGroup =
            require(Path.join(webAppSamplePath, "sleeve.js"));
        const resourceGroupInfra: ResourceGroupInfrastructure =
            new ResourceGroupInfrastructure();
        resourceGroupInfra.initialize(resourceGroup, webAppSamplePath);
        await resourceGroupInfra.hydrate([], deploymentType);

        const webAppNode: WebappNodeAzure =
            require(Path.join(webAppSamplePath, "foo", "sleeve.js"));
        const webAppNodeInfra: WebappNodeAzureInfrastructure =
            new WebappNodeAzureInfrastructure();
        webAppNodeInfra.initialize(webAppNode,
            Path.join(webAppSamplePath, "foo"));
        await webAppNodeInfra.hydrate([resourceGroupInfra], deploymentType);
        const deployedURL = await webAppNodeInfra.getDeployedURL();
        const getResult = await Request.get(deployedURL);
        expect(getResult).equals("Hello World!");
    });
});
