import * as Yargs from "yargs";
import * as CliUtilities from "./cliUtilities";
import * as Resource from "./resource";

// tslint:disable-next-line:no-unused-expression
Yargs
  .command(
    "init",
    "Initialize a new Sleeve project",
    {},
    async function(argv) {
      CliUtilities.setLoggingIfNeeded(argv);
      await CliUtilities.init(process.cwd());
    }
  )
  .command(
    "setup",
    "Setup a new instance of a resource",
    function(moreYargs) {
      return moreYargs.option("n", {
        alias: "resourceName",
        describe:
          "Name of the resource to setup and the directory it will be created \
in"
      })
    .option("t", {
        alias: "resourceType",
        choices: ["webapp-node", "mySqlAzure"],
        describe: "Type of resource to setup"
    });
    },
    async function(argv) {
      CliUtilities.setLoggingIfNeeded(argv);
      const targetPath: string =
        await CliUtilities.setup(process.cwd(), argv.resourceName,
                                 argv.resourceType);
      console.log(`Resource created in ${targetPath}`);
    }
  )
  .command(
    "deploy",
    "Deploy resources in current project",
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
    })
    .option("v", {
      alias: "verbose",
      describe: "Outputs logs to file and screen"
    })
  .command(
    "manage",
    "Manage resources in deployed environments",
    {},
    async function(argv) {
      CliUtilities.setLoggingIfNeeded(argv);
      await CliUtilities.manageResource(process.cwd());
    }
  )
  .command(
    "*",
    "",
    {},
    function(argv) {
      Yargs.showHelp();
    }
  )
  .help(true)
  .strict()
  .version()
  .argv;
