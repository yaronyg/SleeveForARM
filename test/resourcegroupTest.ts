// import { expect } from "chai";
import "mocha";
import ResourceGroup from "../src/resourcegroup";

describe("Resource group", () => {
    it("should be created, even if it exists", async () => {
        const resourceGroup = new ResourceGroup();
        resourceGroup.deployResource(".", []);
    });
});
