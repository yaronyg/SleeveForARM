import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Yargs from "yargs";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import WebappNodeAzure from "./webapp-node-azure";

// tslint:disable-next-line:no-unused-expression
Yargs
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
      await WebappNodeAzure.setup(Path.join(process.cwd(), argv.serviceName));
    }
  )
  .command(
    "deploy",
    "Deploy services in current project",
    {},
    async function(argv) {
      deployResources();
    }
  )
  .help()
  .argv;

async function deployResources() {
    const directoryContents = await fs.readdirAsync(process.cwd());
    const resources: Resource.Resource[] = [];
    for (const candidatePath of directoryContents) {
      const isDirectory = fs.isDirectoryAsync(candidatePath);
      const sleevePath = Path.join(candidatePath, "sleeve.js");
      if (isDirectory && fs.existsAsync(sleevePath)) {
        const resource = require(sleevePath);
        resource.setDirectoryPath(sleevePath);
        resources.push(resource);
      }
    }

    if (resources.length === 0) {
      console.log("There are no resources to deploy");
      return;
    }

    if (!resources.some((resource) => resource instanceof ResourceGroup)) {
      const resourceGroup =
        new ResourceGroup().setBaseName(Path.basename(process.cwd()));
      resources.push(resourceGroup);
    }

    for (const resource of resources) {
      await resource.deployResource(resources);
    }
}
