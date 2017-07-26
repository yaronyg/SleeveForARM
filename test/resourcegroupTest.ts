// import { expect } from "chai";
import "mocha";
import ResourceGroup from "../src/resourcegroup";
import * as TestUtilities from "./testUtilities";

describe("Resource group", () => {

    beforeEach(async function() {
        await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(() => {
        TestUtilities.tearDownMochaTestLogging();
    });

    it("should be created, even if it exists", async () => {
        const resourceGroup = new ResourceGroup();
        resourceGroup.deployResource(".", []);
        resourceGroup.deployResource(".", []);
    });
});
