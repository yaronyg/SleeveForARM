// import { expect } from "chai";
import ResourceGroup from "@sleeve/resourcegroup-azure";
import WebappNodeAzure from "../src/webapp-node-azure";

describe("Web app Node Azure", () => {
    it("should be deployable2", async function() {
        this.timeout(30000);
        const webappNode = new WebappNodeAzure();
        const resourceGroup = new ResourceGroup();
        await resourceGroup.deployResource("ick3", []);
        await webappNode.deployResource("testing", [resourceGroup]);
    });
});
