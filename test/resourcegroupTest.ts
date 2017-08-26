import { expect } from "chai";
import * as fs from "fs-extra-promise";
import "mocha";
import * as Path from "path";
import * as CommonUtilities from "../src/common-utilities";
import * as Resource from "../src/resource";
import ResourceGroup from "../src/resourcegroup";
// tslint:disable-next-line:max-line-length
import * as ResourceGroupInfrastructure from "../src/resourcegroupInfrastructure";
import * as TestUtilities from "./testUtilities";

describe("Resource group", () => {
    before(async function() {
        this.timeout(60 * 1000);
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

    it("should create a resource group", async () => {
        const resourceGroupPath =
            Path.join(testingDirFullPath, "resourceGroup");
        await fs.emptyDirAsync(resourceGroupPath);
        const resourceGroupInfra =
            new ResourceGroupInfrastructure.ResourceGroupInfrastructure();
        resourceGroupInfra.initialize(null, resourceGroupPath);
        await resourceGroupInfra.setup();
        await CommonUtilities
            .exec("npm link sleeveforarm", resourceGroupPath);
        await CommonUtilities
            .exec("npm install", resourceGroupPath);
        const resourceGroup: ResourceGroup =
            require(Path.join(resourceGroupPath, "sleeve.js"));

        const secondResourceGroupInfra =
            new ResourceGroupInfrastructure.ResourceGroupInfrastructure();
        secondResourceGroupInfra.initialize(resourceGroup, resourceGroupPath);
        await secondResourceGroupInfra.hydrate([],
            Resource.DeployType.Production);

        // We aren't waiting because we don't need to, we'll
        // catch it in getBaseDeployClassInstance
        secondResourceGroupInfra.deployResource();
        const baseClass =
            await secondResourceGroupInfra.getBaseDeployClassInstance();
        const resourceGroupName = baseClass.deployedResourceGroupName;

        const result = await CommonUtilities.runAzCommand(
`az group exists --name ${resourceGroupName}`,
CommonUtilities.azCommandOutputs.string);

        expect(result.trim()).equals("true");
    });
});
