import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import * as Yargs from "yargs";
import * as CommonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import * as IInfrastructure from "./IInfrastructure";
import KeyVault from "./keyvault";
import KeyVaultInfrastructure from "./keyvaultInfrastructure";
import MySqlAzure from "./mysql-azure";
import MySqlAzureInfrastructure from "./mysql-azureInfrastructure";
import * as Resource from "./resource";
import ResourceGroup from "./resourcegroup";
import ResourceGroupInfrastructure from "./resourcegroupInfrastructure";
import WebappNodeAzure from "./webapp-node-azure";
import WebappNodeAzureInfrastructure from "./webapp-node-azureInfrastructure";

type InfraResourceType = IInfrastructure.IInfrastructure &
                         Resource.Resource;

function createInfraResource(resource: Resource.Resource,
                             targetDirectoryPath: string)
                             : InfraResourceType {
  let infraResource: InfraResourceType | null = null;
  if (resource instanceof ResourceGroup) {
    infraResource = new ResourceGroupInfrastructure();
  }
  if (resource instanceof KeyVault) {
    infraResource = new KeyVaultInfrastructure();
  }
  if (resource instanceof WebappNodeAzure) {
    infraResource = new WebappNodeAzureInfrastructure();
  }
  if (resource instanceof MySqlAzure) {
    infraResource = new MySqlAzureInfrastructure();
  }
  if (infraResource === null) {
    throw new Error("Unrecognized resource type!");
  }
  infraResource.initialize(resource, targetDirectoryPath);
  return infraResource;
}

export async function setup(rootPath: string, serviceName: string,
                            serviceType: string) {
    const targetPath = Path.join(rootPath, serviceName);
    if (fs.existsSync(targetPath)) {
      console.log(`Directory with name ${serviceName} already exists.`);
      process.exit(-1);
    }
    await fs.ensureDirAsync(targetPath);
    let infraResource: IInfrastructure.IInfrastructure;
    switch (serviceType) {
      case Resource.ResourcesWeSupportSettingUp.MySqlAzure: {
        infraResource = new MySqlAzureInfrastructure();
        break;
      }
      case Resource.ResourcesWeSupportSettingUp.WebAppNode: {
        infraResource = new WebappNodeAzureInfrastructure();
        break;
      }
      default: {
        throw new Error(`Unsupported resource type ${serviceType}`);
      }
    }
    infraResource.initialize(null, targetPath);
    await infraResource.setup();
}

export async function deployResources(
                          rootOfDeploymentPath: string,
                          deploymentType: Resource.DeployType,
                          developmentDeploy = false) {
    const globalDefaultResourcesToHydrate: InfraResourceType[] = [];
    const storageResourcesToHydrate: InfraResourceType[] = [];
    const notGlobalDefaultResourcesToHydrate
      : InfraResourceType[] = [];
    const resourcesInEnvironment: InfraResourceType[] = [];
    const rootSleevePath = Path.join(rootOfDeploymentPath, "sleeve.js");
    if (!(fs.existsSync(rootSleevePath))) {
      console.log("There is no sleeve.js in the root, \
this is not a properly configured project");
      process.exit(-1);
    }
    await CommonUtilities.npmSetup(rootOfDeploymentPath);
    const rootResourceGroup: ResourceGroup = require(rootSleevePath);
    const rootResourceGroupInfra: InfraResourceType =
      createInfraResource(rootResourceGroup, rootOfDeploymentPath);
    await rootResourceGroupInfra.hydrate(resourcesInEnvironment,
                                         deploymentType);
    resourcesInEnvironment.push(rootResourceGroupInfra);

    await CommonUtilities.executeOnSleeveResources(rootOfDeploymentPath,
      async (candidatePath) => {
        await CommonUtilities.npmSetup(candidatePath);
        const sleevePath = Path.join(candidatePath, "sleeve.js");
        const resource = require(sleevePath);
        const infraResource = createInfraResource(resource, candidatePath);
        if (CommonUtilities.isIGlobalDefault(infraResource)) {
          globalDefaultResourcesToHydrate.push(infraResource);
          return;
        }
        if (CommonUtilities.isIStorageResource(infraResource)) {
          storageResourcesToHydrate.push(infraResource);
          return;
        }
        notGlobalDefaultResourcesToHydrate.push(infraResource);
      });

    if (resourcesInEnvironment.length === 0) {
      console.log("There are no resources to deploy");
      process.exit(-1);
    }

    for (const resourceArray of
      [globalDefaultResourcesToHydrate, storageResourcesToHydrate,
        notGlobalDefaultResourcesToHydrate]) {
      for (const infraResource of resourceArray) {
        const resource =
          await infraResource.hydrate(resourcesInEnvironment, deploymentType);
        resourcesInEnvironment.push(resource);
      }
    }

    let scriptToRun = "$ErrorActionPreference = \"Stop\"\n";
    const functionsToCallAfterScriptRuns = [];
    for (const resource of resourcesInEnvironment) {
      const deployResult = await resource.deployResource(developmentDeploy);
      scriptToRun += deployResult.powerShellScript;
      functionsToCallAfterScriptRuns
        .push(deployResult.functionToCallAfterScriptRuns);
    }

    await CommonUtilities.runPowerShellScript(scriptToRun);

    for (const functionToCall of functionsToCallAfterScriptRuns) {
      await functionToCall();
    }

    if (deploymentType === Resource.DeployType.Production) {
      for (const resource of resourcesInEnvironment) {
        if (resource instanceof WebappNodeAzureInfrastructure) {
          const url =
            await (resource as WebappNodeAzureInfrastructure).getDeployedURL();
          console.log(
            `Web app is available at ${url}`);
        }
      }
    }
}
