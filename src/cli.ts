import * as fs from "fs-extra";
import * as Path from "path";
import * as Yargs from "yargs";
import * as CliUtilities from "./cliUtilities";
import * as CommonUtilities from "./common-utilities";
import * as Resource from "./resource";

// tslint:disable-next-line:no-unused-expression
Yargs
  .command(
    "init",
    "Initialize a new Sleeve project",
    {},
    async function(argv) {
      CliUtilities.setLoggingIfNeeded(argv);
      const assetPath =
          Path.join(__dirname,
                      "..",
                      "assets",
                      "cliInit");
      await fs.copy(assetPath, process.cwd());
      await CommonUtilities.npmSetup(process.cwd());
      await CommonUtilities.executeOnSleeveResources(process.cwd(),
        (path) => {
          return CommonUtilities.npmSetup(path);
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
        choices: ["webapp-node", "mySqlAzure"],
        describe: "Type of service to setup"
    });
    },
    async function(argv) {
      CliUtilities.setLoggingIfNeeded(argv);
      CliUtilities.setup(process.cwd(), argv.serviceName, argv.serviceType);
    }
  )
  .command(
    "deploy",
    "Deploy services in current project",
    function(moreYargs) {
      return moreYargs.option("t", {
        alias: "deploymentType",
        choices: [Resource.DeployType.LocalDevelopment,
                  Resource.DeployType.Production],
        describe: "Set deployment type to either local deployment or \
deploy to Azure production"
      });
    },
    async function(argv) {
      CliUtilities.setLoggingIfNeeded(argv);
      await CliUtilities.deployResources(process.cwd(), argv.deploymentType);
    }
  )
  .option("v", {
    alias: "verbose",
    describe: "Outputs logs to file and screen"
  }
  )
  .help()
  .strict()
  .argv;
