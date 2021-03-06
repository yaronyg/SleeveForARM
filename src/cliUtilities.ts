import * as fs from "fs-extra";
import * as Path from "path";
import * as ReplaceInFile from "replace-in-file";
import * as Winston from "winston";
import ApplicationInsights from "./applicationInsights";
// tslint:disable-next-line:max-line-length
import * as ApplicationInsightsInfrastructure from "./applicationInsightsInfrastructure";
import * as CommonUtilities from "./common-utilities";
import * as Data from "./data";
import * as IInfrastructure from "./IInfrastructure";
import KeyVault from "./keyvault";
import * as KeyVaultInfrastructure from "./keyvaultInfrastructure";
import MySqlAzure from "./mysql-azure";
import * as MySqlAzureInfrastructure from "./mysql-azureInfrastructure";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import * as ResourceGroupInfrastructure from "./resourcegroupInfrastructure";
import WebappNodeAzure from "./webapp-node-azure";
// tslint:disable-next-line:max-line-length
import * as WebappNodeAzureInfrastructure from "./webapp-node-azureInfrastructure";

export type InfraResourceType = IInfrastructure.IInfrastructure<any> &
                         Resource.Resource;

function createInfraResource(resource: Resource.Resource,
                             targetDirectoryPath: string)
                             : InfraResourceType {
  let infraResource: InfraResourceType | null = null;

  if (CommonUtilities.isClass(resource, ResourceGroup)) {
    infraResource =
    new ResourceGroupInfrastructure.ResourceGroupInfrastructure();
  }
  if (CommonUtilities.isClass(resource, KeyVault)) {
    infraResource = new KeyVaultInfrastructure.KeyVaultInfrastructure();
  }
  if (CommonUtilities.isClass(resource, WebappNodeAzure)) {
    infraResource =
      new WebappNodeAzureInfrastructure.WebappNodeAzureInfrastructure();
  }
  if (CommonUtilities.isClass(resource, MySqlAzure)) {
    infraResource = new MySqlAzureInfrastructure.MySqlAzureInfrastructure();
  }
  if (CommonUtilities.isClass(resource, ApplicationInsights)) {
    infraResource =
      new ApplicationInsightsInfrastructure.ApplicationInsightsInfrastructure();
  }
  if (infraResource === null) {
    throw new Error("Unrecognized resource type!");
  }
  infraResource.initialize(resource, targetDirectoryPath);
  return infraResource;
}

export async function init(currentWorkingDirectory: string) {
  const assetPath =
    Path.join(__dirname,
                "..",
                "assets",
                "cliInit");
  if (!(await CommonUtilities.validateResource(Path.basename(process.cwd()),
                              Data.data.ProjectNameLength))) {
      throw new Error(`Project name should be less than \
${Data.data.ProjectNameLength} characters, contains only \
alphanumeric characters and start with a letter\n`);
  }

  await fs.copy(assetPath, currentWorkingDirectory);

  const aiInfrastructure =
    new ApplicationInsightsInfrastructure.ApplicationInsightsInfrastructure();
  const aiSleevePath = Path.join(currentWorkingDirectory, "AppInsights");
  await aiInfrastructure
    .initialize(null, aiSleevePath)
    .setup();
  const aiReplaceOptions = {
    files: Path.join(aiSleevePath, "sleeve.js"),
    from: /new applicationInsights\(\);/,
    to: "new applicationInsights().setGlobalDefault(true);"
  };
  await ReplaceInFile(aiReplaceOptions);
  // NPM publish turns all .gitignore into .npmignore. For awhile it
  // seemed that you could put in both a .gitignore and a .npmignore
  // and the .gitignore would be ignored but no longer. So now we
  // ship a .npmignore and then rename it after install.
  await fs.move(Path.join(currentWorkingDirectory, ".npmignore"),
                Path.join(currentWorkingDirectory, ".gitignore"));

  const locations = await CommonUtilities.azAppServiceListLocations();
  const dataCenterEnum: string = locations[0].name.replace(/ /g, "");
  const replaceInFileOptions = {
    files: Path.join(currentWorkingDirectory, "sleeve.js"),
    from: /XXXX/,
    to: `DataCenterNames.${dataCenterEnum}`
  };
  await ReplaceInFile(replaceInFileOptions);
  await CommonUtilities.npmSetup(currentWorkingDirectory);
  await CommonUtilities.executeOnSleeveResources(currentWorkingDirectory,
  (path) => {
    return CommonUtilities.npmSetup(path);
  });
  if (await fs.pathExists(Path.join(currentWorkingDirectory, ".git"))
        === false) {
    CommonUtilities.exec("git init", currentWorkingDirectory);
  }
}

export async function setup(currentWorkingDirectory: string,
                            serviceName: string,
                            serviceType: string): Promise<string> {
    const rootPath: string =
      await CommonUtilities.findGitRootDir(currentWorkingDirectory);
    const targetPath = Path.join(rootPath, serviceName);
    let infraResource: IInfrastructure.IInfrastructure<any>;
    switch (serviceType) {
      case Resource.ResourcesWeSupportSettingUp.MySqlAzure: {
        infraResource = new MySqlAzureInfrastructure.MySqlAzureInfrastructure();
        break;
      }
      case Resource.ResourcesWeSupportSettingUp.WebAppNode: {
        infraResource =
          new WebappNodeAzureInfrastructure.WebappNodeAzureInfrastructure();
        break;
      }
      default: {
        throw new Error(`Unsupported resource type ${serviceType}`);
      }
    }
    infraResource.initialize(null, targetPath);
    await infraResource.setup();
    return targetPath;
}

async function hydrateEnvironment(currentWorkingDirectory: string,
                                  deploymentType: Resource.DeployType):
  Promise<InfraResourceType[]> {
  const resourcesInEnvironment: InfraResourceType[] = [];
  const rootOfDeploymentPath: string =
    await CommonUtilities.findGitRootDir(currentWorkingDirectory);
  const rootSleevePath = Path.join(rootOfDeploymentPath, "sleeve.js");
  if (!(fs.existsSync(rootSleevePath))) {
    // tslint:disable-next-line:no-console
    console.log("There is no sleeve.js in the root, \
  this is not a properly configured project");
    process.exit(-1);
  }
  await CommonUtilities.npmSetup(rootOfDeploymentPath);
  const rootResourceGroup: ResourceGroup = require(rootSleevePath);
  // tslint:disable-next-line:max-line-length
  const rootResourceGroupInfra =
    createInfraResource(rootResourceGroup, rootOfDeploymentPath) as ResourceGroupInfrastructure.ResourceGroupInfrastructure;
  await rootResourceGroupInfra.hydrate(resourcesInEnvironment,
      deploymentType);
  resourcesInEnvironment.push(rootResourceGroupInfra);

  await CommonUtilities.executeOnSleeveResources(rootOfDeploymentPath,
    async (candidatePath) => {
      await CommonUtilities.npmSetup(candidatePath);
      const sleevePath = Path.join(candidatePath, "sleeve.js");
      const resource = require(sleevePath);
      const infraResource = createInfraResource(resource, candidatePath);
      resourcesInEnvironment.push(
        await infraResource.hydrate(resourcesInEnvironment, deploymentType));
    });
  return resourcesInEnvironment;
}

// TODO: developmentDeploy is really just intended for Node WebAPPs so that
// we deploy code in Azure that will properly set up the environment
// to take a version of Sleeve from the local machine and not look to
// NPM. But we really need to shove this into some kind of property bag
// as the name and usage is confusing.
export async function deployResources(
                          currentWorkingDirectory: string,
                          deploymentType: Resource.DeployType,
                          developmentDeploy = false)
                          : Promise<InfraResourceType[]> {
    const resourcesInEnvironment: InfraResourceType[] =
      await hydrateEnvironment(currentWorkingDirectory, deploymentType);

    if (resourcesInEnvironment.length === 0) {
      // tslint:disable-next-line:no-console
      console.log("There are no resources to deploy");
      process.exit(-1);
    }

    const promisesToWaitFor = [];
    for (const resource of resourcesInEnvironment) {
      promisesToWaitFor.push(resource.deployResource(developmentDeploy));
    }

    await Promise.all(promisesToWaitFor);

    if (deploymentType === Resource.DeployType.Production) {
      for (const resource of resourcesInEnvironment) {
        if (resource instanceof
            WebappNodeAzureInfrastructure.WebappNodeAzureInfrastructure) {
          const baseDeployWebApp =
            // tslint:disable-next-line:max-line-length
            await (resource as WebappNodeAzureInfrastructure.WebappNodeAzureInfrastructure)
              .getBaseDeployClassInstance();
          console.log(
`Web app ${resource.baseName} is available at \
${await baseDeployWebApp.getDeployedURL()}`);
        }
      }
    }
    return resourcesInEnvironment;
}

function getAppInsightsURL(aiName: string, resourceGroupName: string):
    Promise<string> {
  return CommonUtilities.runAzCommand(`az resource show --name ${aiName} \
--resource-group ${resourceGroupName} \
--resource-type Microsoft.Insights/components`)
  .then((result) => {
    if (result && result.properties) {
      return `https://ms.portal.azure.com/#resource/subscriptions/\
${result.properties.TenantId}/resourceGroups/${resourceGroupName}\
/providers/Microsoft.Insights/components/${aiName}/overview`;
    }
    return "";
  });
}

async function createEnvironmentToGetAiLocation(
    currentWorkingDirectory: string,
    deploymentType: Resource.DeployType):
      Promise<string> {
  const resourcesInEnvironment: InfraResourceType[] =
  await hydrateEnvironment(currentWorkingDirectory,
                            deploymentType);
  const rootResourceGroupInfra =
    CommonUtilities
      .findGlobalDefaultResourceByType(resourcesInEnvironment,
        // tslint:disable-next-line:max-line-length
        ResourceGroupInfrastructure.ResourceGroupInfrastructure) as ResourceGroupInfrastructure.ResourceGroupInfrastructure;

  const rootAiInfra =
    CommonUtilities
      .findGlobalDefaultResourceByType(resourcesInEnvironment,
        // tslint:disable-next-line:max-line-length
        ApplicationInsightsInfrastructure.ApplicationInsightsInfrastructure) as ApplicationInsightsInfrastructure.ApplicationInsightsInfrastructure;

  return getAppInsightsURL(rootAiInfra.appInsightsFullName,
      rootResourceGroupInfra.resourceGroupName);
}

export async function getManageResourceData(currentWorkingDirectory: string):
    Promise<{[deploymentType: string]: string}> {
  const results: {[deploymentType: string]: string} = {};

  results[Resource.DeployType.LocalDevelopment] =
      await createEnvironmentToGetAiLocation(currentWorkingDirectory,
        Resource.DeployType.LocalDevelopment);

  results[Resource.DeployType.Production] =
        await createEnvironmentToGetAiLocation(currentWorkingDirectory,
          Resource.DeployType.Production);

  return results;
}

function printManageResults(deployType: Resource.DeployType,
                            deployResult: string) {
  const printPrefix = `${deployType} deployment:`;
  if (deployResult === "") {
    console.log(`${printPrefix} NO DEPLOYMENT`);
    return;
  }
  console.log(`${printPrefix} ${deployResult}`);
}

export async function manageResource(currentWorkingDirectory: string) {
  const manageResults = await getManageResourceData(currentWorkingDirectory);
  const devDeployResults =
    manageResults[Resource.DeployType.LocalDevelopment];
  const productionDeployResults =
    manageResults[Resource.DeployType.Production];

  printManageResults(Resource.DeployType.LocalDevelopment, devDeployResults);
  printManageResults(Resource.DeployType.Production, productionDeployResults);
}

export function setLoggingIfNeeded(argv: any) {
  if (argv.verbose) {
    Winston.add(Winston.transports.File, {
      filename: "log.txt",
      level: "silly"
    });
    Winston.remove(Winston.transports.Console);
    Winston.add(Winston.transports.Console, {
        level: "silly",
        stderrLevels: []
    });
  }
}
