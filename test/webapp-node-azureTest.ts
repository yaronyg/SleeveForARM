import { expect } from "chai";
import * as fs from "fs-extra-promise";
import * as Path from "path";
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
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath, "webApp");
        await fs.emptyDirAsync(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} \
setup -t mySqlAzure -n mySql`, webAppSamplePath);

        // Set up our test
        const fooPath = Path.join(webAppSamplePath, "foo");
        await CommonUtilities.exec("npm install mysql2 --save",
            fooPath);
        await CommonUtilities.exec("npm link sleeveforarm",
            fooPath);

        const testAssetsPath = Path.join(__dirname, "..", "testAssets");
        for (const fileName of ["index.ts", "deploy.cmd", ".deployment"]) {
            const fileToCopyPath = Path.join(testAssetsPath, fileName);
            await fs.copyAsync(fileToCopyPath, Path.join(fooPath, fileName),
                { overwrite: true});
        }

        await CommonUtilities.exec(
            "tsc index.ts --target es6 --module commonjs \
--moduleResolution node > NUL", fooPath);

        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);
        const resourcesInEnvironment =
         await CliUtilities.deployResources(webAppSamplePath, deploymentType,
                                           true);

        const webApp = resourcesInEnvironment.find((resource) =>
            CommonUtilities.isClass(resource, WebappNodeAzureInfrastructure));

        if (webApp === undefined) {
            throw new Error("We don't have a webApp in our results!");
        }

        const baseDeployWebApp = await webApp.getBaseDeployClassInstance();

        const deployedURL = await baseDeployWebApp.getDeployedURL();
        await getTheResult(deployedURL);
    });

    async function waitAndTryAgain(url, resolve, reject) {
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
                if (err.error.errno === "ECONNREFUSED") {
                    // We made the request too quickly
                    waitAndTryAgain(url, resolve, reject);
                }
                throw err;
            }
        });
    }

    it("should run locally", async function() {
        const deploymentType = Resource.DeployType.LocalDevelopment;
        this.timeout(10 * 60 * 1000);
        const webAppSamplePath = Path.join(testingDirFullPath, "webApp");
        await fs.emptyDirAsync(webAppSamplePath);
        await CommonUtilities.exec(`${sleeveCommandLocation} init`,
            webAppSamplePath);
        // tslint:disable-next-line:max-line-length
        await CommonUtilities.exec(`${sleeveCommandLocation} setup -t webapp-node -n foo`,
            webAppSamplePath);

        await CommonUtilities.exec(`${sleeveCommandLocation} \
setup -t mySqlAzure -n mySql`, webAppSamplePath);

        await CliUtilities.deployResources(webAppSamplePath, deploymentType);
        // await CommonUtilities.exec(`${sleeveCommandLocation} deploy`,
        //     webAppSamplePath);

        const fooPath = Path.join(webAppSamplePath, "foo");
        await CommonUtilities.exec("npm install mysql2 --save",
            fooPath);
        await CommonUtilities.exec("npm link sleeveforarm",
            fooPath);

        const fileToCopy = Path.join(__dirname, "..", "testAssets",
            "index.ts");
        await fs.copyAsync(fileToCopy, Path.join(fooPath, "index.ts"),
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
