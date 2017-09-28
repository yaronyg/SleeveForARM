import { expect } from "chai";
import * as fs from "fs-extra";
import * as Path from "path";
import * as ReplaceInFile from "replace-in-file";
import * as Request from "request-promise-native";
import * as CliUtilities from "../src/cliUtilities";
import * as CommonUtilities from "../src/common-utilities";
import * as Resource from "../src/resource";
// tslint:disable-next-line:max-line-length
import * as WebappNodeAzureInfrastructure from "../src/webapp-node-azureinfrastructure";
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
        this.timeout(15 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath, "webApp");
        await fs.emptyDir(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} \
setup -t mySqlAzure -n mySql`, webAppSamplePath);

        // enable the CDN
        const pathTosleevejs = Path.join(webAppSamplePath, "foo");
        const replaceInFileOptions = {
            files: Path.join(pathTosleevejs, "sleeve.js"),
            from: /module.exports = new webappNodeAzure\(\);/,
            // tslint:disable-next-line:max-line-length
            to: "const option = require(\"sleeveforarm/src/webapp-node-azure\").CDNSKUOption; module.exports = new webappNodeAzure().setCDNProvider(option.Standard_Akamai);"
        };

        await ReplaceInFile(replaceInFileOptions);

        // Set up our test
        const fooPath = Path.join(webAppSamplePath, "foo");
        await CommonUtilities.exec("npm install mysql2 --save",
            fooPath);
        await CommonUtilities.exec("npm link sleeveforarm",
            fooPath);

        const testAssetsPath = Path.join(__dirname, "..", "testAssets");
        for (const fileName of ["index.ts", "deploy.cmd", ".deployment"]) {
            const fileToCopyPath = Path.join(testAssetsPath, fileName);
            await fs.copy(fileToCopyPath, Path.join(fooPath, fileName),
                { overwrite: true});
        }

        try {
            await CommonUtilities.exec(
"tsc index.ts --target es6 --module commonjs --moduleResolution node > NUL"
, fooPath);
        } catch (err) {
            // TSC will fail because of spurious type failures, we can
            // ignore. If there is a real problem the next script will
            // fail.
        }

        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);
        const resourcesInEnvironment =
         await CliUtilities.deployResources(webAppSamplePath, deploymentType,
                                           true, true);

        const webApp =
        (resourcesInEnvironment.find((resource) =>
            CommonUtilities.isClass(resource,
                // tslint:disable-next-line:max-line-length
                WebappNodeAzureInfrastructure.WebappNodeAzureInfrastructure))) as WebappNodeAzureInfrastructure.WebappNodeAzureInfrastructure;

        if (webApp === undefined) {
            throw new Error("We don't have a webApp in our results!");
        }

        const baseDeployWebApp = await webApp.getBaseDeployClassInstance();
        const deployedURL = await baseDeployWebApp.getDeployedURL();
        const tryCDN = deployedURL + "/trycdn";

        await getTheResult(deployedURL);
        // skip the CND testing given which is not needed at the dev machine.
        if ( webApp.isCDNEnabled()) {
            await getTheResult(tryCDN);
        }
    });

    async function waitAndTryAgain(url: string, resolve: () => void,
                                   reject: (err: any) => void) {
        setTimeout(async function() {
            try {
                await getTheResult(url);
                resolve();
            } catch (err) {
                reject(err);
            }
        }, 5000);
    }

    async function getTheResult(url: string) {
        return new Promise(async function(resolve, reject) {
            try {
                const getResult = await Request.get(url);
                if (getResult === "Not Set!") {
                    waitAndTryAgain(url, resolve, reject);
                } else {
                    try {
                        expect(getResult).equals("A Name");
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            } catch (err) {
                // BUGBUG: Yes we will go into an endless loop if
                // all we get are ECONNREFUSED errors but eventually
                // the test itself times out.
                if (err.error.errno === "ECONNREFUSED") {
                    // We made the request too quickly
                    waitAndTryAgain(url, resolve, reject);
                    return;
                }
                throw err;
            }
        });
    }

    it("should run locally", async function() {
        const deploymentType = Resource.DeployType.LocalDevelopment;
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath, "webApp");
        await fs.emptyDir(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);

        await CommonUtilities.exec(`${sleeveCommandLocation} \
setup -t mySqlAzure -n mySql`, webAppSamplePath);

        await CliUtilities.deployResources(webAppSamplePath, deploymentType,
                                            false, true);
        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);

        const fooPath = Path.join(webAppSamplePath, "foo");
        await CommonUtilities.exec("npm install mysql2 --save",
            fooPath);
        await CommonUtilities.exec("npm link sleeveforarm",
            fooPath);

        const fileToCopy = Path.join(__dirname, "..", "testAssets",
            "index.ts");
        await fs.copy(fileToCopy, Path.join(fooPath, "index.ts"),
                            { overwrite: true });
        try {
            await CommonUtilities.exec(
"tsc index.ts --target es6 --module commonjs --moduleResolution node > NUL"
, fooPath);
        } catch (err) {
            // TSC will fail because of spurious type failures, we can
            // ignore. If there is a real problem the next script will
            // fail.
        }

        CommonUtilities.exec("node index.js", fooPath);
        await getTheResult("http://localhost:1337");
    });
});
