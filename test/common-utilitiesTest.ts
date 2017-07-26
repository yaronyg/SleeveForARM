import { expect } from "chai";
import * as commonUtilities from "../src/common-utilities";
import * as TestUtilities from "./testUtilities";

describe("Quick test of string munging", () => {
    beforeEach(async function() {
        await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(() => {
        TestUtilities.tearDownMochaTestLogging();
    });

    it("should munge the URL right", () => {
        const mungedURL =
            commonUtilities
                .addPasswordToGitURL("http://foo@ick.bar/stuff/net.git",
                                     "password");
        expect(mungedURL).to.equal("http://foo:password@ick.bar/stuff/net.git");
    });
});
