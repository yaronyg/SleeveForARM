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
    let resourcesInEnvironment: CliUtilities.InfraResourceType[];
    beforeEach(async function() {
        [testingDirFullPath, sleeveCommandLocation] =
            await TestUtilities.setupMochaTestLogging(this);
    });

    afterEach(async function() {
        await TestUtilities.tearDownMochaTestLogging(resourcesInEnvironment,
            testingDirFullPath, this);
    });

    it("should be deployable", async function() {
        const deploymentType = Resource.DeployType.Production;
        this.timeout(15 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath,
            TestUtilities.generateRandomTestGroupName());
        await fs.emptyDir(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} \
setup -t mySqlAzure -n mySql`, webAppSamplePath);

        // enable the CDN
        await updateSleeveJSforCDN(webAppSamplePath);

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
        resourcesInEnvironment =
         await CliUtilities.deployResources(webAppSamplePath, deploymentType,
                                           true);

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
        await getTheResult(tryCDN);
    });

    async function waitAndTryAgain(url: string, httpGetResult: string,
                                   resolve: () => void,
                                   reject: (err: any) => void) {
        setTimeout(async function() {
            try {
                await getTheResult(url, httpGetResult);
                resolve();
            } catch (err) {
                reject(err);
            }
        }, 5000);
    }

    async function updateSleeveJSforCDN(webAppSamplePath: string) {
        const pathTosleevejs = Path.join(webAppSamplePath, "foo");
        const replaceInFileOptions = {
              files: Path.join(pathTosleevejs, "sleeve.js"),
              from: /module.exports = new webappNodeAzure\(\);/,
              // tslint:disable-next-line:max-line-length
              to: "const option = require(\"sleeveforarm/src/webapp-node-azure\").CDNSKUOption; module.exports = new webappNodeAzure().setCDNProvider(option.Standard_Akamai);"
          };
        await ReplaceInFile(replaceInFileOptions);
    }

    async function getTheResult(url: string,
                                httpGetResult: string = "") {
        httpGetResult = httpGetResult ? httpGetResult : "A Name";
        return new Promise(async function(resolve, reject) {
            try {
                const getResult = await Request.get(url);
                if (getResult === "Not Set!") {
                    waitAndTryAgain(url, httpGetResult, resolve, reject);
                } else {
                    try {
                        expect(getResult).equals(httpGetResult);
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
                    waitAndTryAgain(url, httpGetResult, resolve, reject);
                    return;
                }
                throw err;
            }
        });
    }

    it("should run locally", async function() {
        const deploymentType = Resource.DeployType.LocalDevelopment;
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath,
            TestUtilities.generateRandomTestGroupName());
        await fs.emptyDir(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // await CliUtilities.init(webAppSamplePath);
        await CommonUtilities.exec(
`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);

        await CommonUtilities.exec(`${sleeveCommandLocation} \
setup -t mySqlAzure -n mySql`, webAppSamplePath);

        resourcesInEnvironment =
            await CliUtilities.deployResources(webAppSamplePath, deploymentType,
                                            false);
        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);

          // tslint:disable-next-line:max-line-length
          // although the CDN is set for the local-test, but we are actually using the 127.0.0.1
        await updateSleeveJSforCDN(webAppSamplePath);

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
        await getTheResult("http://localhost:1337/trycdn");
    });
});
