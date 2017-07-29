import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import * as Yargs from "yargs";
import * as CommonUtilities from "./common-utilities";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import WebappNodeAzure from "./webapp-node-azure";

// tslint:disable-next-line:no-unused-expression
Yargs
  .command(
    "init",
    "Initialize a new Sleeve project",
    {},
    async function(argv) {
      const assetPath =
          Path.join(__dirname,
                      "..",
                      "assets",
                      "cliInit");
      await fs.copyAsync(assetPath, ".");
    }
  )
  .command(
    "setup",
    "Setup a new instance of a service",
    function(moreYargs) {
      return moreYargs.option("n", {
        alias: "serviceName",
        describe:
          "Name of the service to setup and the directory it will be created in"
      })
    .option("t", {
        alias: "serviceType",
        choices: ["webapp-node"],
        describe: "Type of service to setup"
    });
    },
    async function(argv) {
      const targetPath = Path.join(process.cwd(), argv.serviceName);
      if (fs.existsSync(targetPath)) {
        console.log(`Directory with name ${argv.serviceName} already exists.`);
        process.exit(-1);
      }
      await fs.ensureDirAsync(targetPath);
      await WebappNodeAzure.setup(Path.join(process.cwd(), argv.serviceName));
    }
  )
  .command(
    "deploy",
    "Deploy services in current project",
    {},
    async function(argv) {
      deployResources(process.cwd());
    }
  )
  .help()
  .argv;

async function npmSetup(path: string) {
    await CommonUtilities
      .exec("npm link sleeveforarm", path);
    await CommonUtilities
      .exec("npm install", path);
}

export async function deployResources(rootOfDeploymentPath: string) {
    const resources: Resource.Resource[] = [];
    const rootSleevePath = Path.join(rootOfDeploymentPath, "sleeve.js");
    if (!(fs.existsSync(rootSleevePath))) {
      console.log("There is no sleeve.js in the root, \
this is not a properly configured project");
      process.exit(-1);
    }
    await npmSetup(rootOfDeploymentPath);
    resources.push(
        require(rootSleevePath).setDirectoryPath(rootOfDeploymentPath));

    const directoryContents = await fs.readdirAsync(rootOfDeploymentPath);
    for (const childFileName of directoryContents) {
      const candidatePath = Path.join(rootOfDeploymentPath, childFileName);
      const isDirectory = await fs.isDirectoryAsync(candidatePath);
      const sleevePath = Path.join(candidatePath, "sleeve.js");
      if (isDirectory && await fs.existsAsync(sleevePath)) {
        await npmSetup(candidatePath);
        resources.push(
          require(sleevePath).setDirectoryPath(candidatePath));
      }
    }

    if (resources.length === 0) {
      console.log("There are no resources to deploy");
      process.exit(-1);
    }

    let scriptToRun = "";
    const functionsToCallAfterScriptRuns = [];
    for (const resource of resources) {
      const deployResult = await resource.deployResource(resources);
      scriptToRun += deployResult.powerShellScript;
      functionsToCallAfterScriptRuns
        .push(deployResult.functionToCallAfterScriptRuns);
    }

    await CommonUtilities.runPowerShellScript(scriptToRun);

    for (const functionToCall of functionsToCallAfterScriptRuns) {
      await functionToCall();
    }

    console.log("Before");
    for (const resource of resources) {
      console.log("During: %j", resource);
      console.log("Test result: %s", (resource instanceof WebappNodeAzure));
      if (resource instanceof WebappNodeAzure) {
        console.log("Right before");
        const url = await resource.getDeployedURL();
        console.log(
          `Web app is available at ${url}`);
        console.log("Right after");
      }
    }
    console.log("All done");
}
