import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import * as Yargs from "yargs";
import * as CliUtilities from "./cliUtilities";
import * as CommonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import * as IInfrastructure from "./IInfrastructure";
import KeyVault from "./keyvault";
import KeyVaultInfrastructure from "./keyvaultInfrastructure";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import ResourceGroupInfrastructure from "./resourcegroupInfrastructure";
import WebappNodeAzure from "./webapp-node-azure";
import WebappNodeAzureInfrastructure from "./webapp-node-azureInfrastructure";

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
      const webAppInfra = new WebappNodeAzureInfrastructure();
      webAppInfra.initialize(null, Path.join(process.cwd(), argv.serviceName));
      await webAppInfra.setup();
    }
  )
  .command(
    "deploy",
    "Deploy services in current project",
    {},
    async function(argv) {
      await CliUtilities.deployResources(process.cwd());
    }
  )
  .help()
  .strict()
  .argv;
