// import { expect } from "chai";
import ResourceGroup from "../src/resourcegroup";
import WebappNodeAzure from "../src/webapp-node-azure";

describe("Web app Node Azure", () => {
    it("should be deployable", async function() {
        this.timeout(1 * 60 * 1000);
        const webappNode = new WebappNodeAzure();
        const resourceGroup = new ResourceGroup();
        await resourceGroup.deployResource("ick3", []);
        await webappNode.deployResource("testing", [resourceGroup]);
    });
});
