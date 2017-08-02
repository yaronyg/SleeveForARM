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
      await fs.copyAsync(assetPath, process.cwd());
      await CommonUtilities.npmSetup(process.cwd());
      await CommonUtilities.executeOnSleeveResources(process.cwd(),
        async (path) => {
          await CommonUtilities.npmSetup(path);
        });
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
  .strict()
  .argv;

export async function deployResources(rootOfDeploymentPath: string) {
    const resources: Resource.Resource[] = [];
    const rootSleevePath = Path.join(rootOfDeploymentPath, "sleeve.js");
    if (!(fs.existsSync(rootSleevePath))) {
      console.log("There is no sleeve.js in the root, \
this is not a properly configured project");
      process.exit(-1);
    }
    await CommonUtilities.npmSetup(rootOfDeploymentPath);
    resources.push(
        require(rootSleevePath).setDirectoryPath(rootOfDeploymentPath));

    await CommonUtilities.executeOnSleeveResources(rootOfDeploymentPath,
      async (candidatePath) => {
        await CommonUtilities.npmSetup(candidatePath);
        const sleevePath = Path.join(candidatePath, "sleeve.js");
        resources.push(
          require(sleevePath).setDirectoryPath(candidatePath));
      });

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

    for (const resource of resources) {
      // BUGBUG: The right way to check if the resource is WebappNodeAzure
      // is to use instanceof. But for reasons I don't have time to investigate
      // right now this isn't working with Node 8 at run time.
      // if (resource instanceof WebappNodeAzure) {
      if (Object.getPrototypeOf(resource).constructor.name ===
          "WebappNodeAzure") {
        const url = await resource.getDeployedURL();
        console.log(
          `Web app is available at ${url}`);
      }
    }
}
