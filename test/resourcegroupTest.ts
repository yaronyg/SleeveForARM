import { expect } from "chai";
import "mocha";
import * as CommonUtilities from "../src/common-utilities";
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
        // tslint:disable-next-line:max-line-length
        const expectedOutput = "az group create --name sillysouthcentralus --location southcentralus\n";
        expect((await resourceGroup.deployResource("silly", []))
                .functionToCallAfterScript)
            .equals(expectedOutput);
        await CommonUtilities.runAzCommand(expectedOutput);
        expect((await resourceGroup.deployResource("silly", []))
                .functionToCallAfterScript)
            .equals(expectedOutput);
        await CommonUtilities.runAzCommand(expectedOutput);
    });
});
