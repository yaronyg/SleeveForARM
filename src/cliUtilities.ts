import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Util from "util";
import * as Yargs from "yargs";
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
  if (infraResource === null) {
    throw new Error("Unrecognized resource type!");
  }
  infraResource.initialize(resource, targetDirectoryPath);
  return infraResource;
}

export async function deployResources(rootOfDeploymentPath: string) {
    const globalDefaultResourcesToHydrate: InfraResourceType[] = [];
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
    await rootResourceGroupInfra.hydrate(resourcesInEnvironment);
    resourcesInEnvironment.push(rootResourceGroupInfra);

    await CommonUtilities.executeOnSleeveResources(rootOfDeploymentPath,
      async (candidatePath) => {
        await CommonUtilities.npmSetup(candidatePath);
        const sleevePath = Path.join(candidatePath, "sleeve.js");
        const resource = require(sleevePath);
        const infraResource = createInfraResource(resource, candidatePath);
        if (CommonUtilities.isIGlobalDefault(resource)) {
          globalDefaultResourcesToHydrate.push(infraResource);
        } else {
          notGlobalDefaultResourcesToHydrate.push(infraResource);
        }
      });

    if (resourcesInEnvironment.length === 0) {
      console.log("There are no resources to deploy");
      process.exit(-1);
    }

    for (const infraResource of globalDefaultResourcesToHydrate) {
      const resource =
          await infraResource.hydrate(resourcesInEnvironment);
      resourcesInEnvironment.push(resource);
    }

    for (const infraResource of notGlobalDefaultResourcesToHydrate) {
      const resource =
        await infraResource.hydrate(resourcesInEnvironment);
      resourcesInEnvironment.push(resource);
    }

    let scriptToRun = "";
    const functionsToCallAfterScriptRuns = [];
    for (const resource of resourcesInEnvironment) {
      const deployResult = await resource.deployResource();
      scriptToRun += deployResult.powerShellScript;
      functionsToCallAfterScriptRuns
        .push(deployResult.functionToCallAfterScriptRuns);
    }

    await CommonUtilities.runPowerShellScript(scriptToRun);

    for (const functionToCall of functionsToCallAfterScriptRuns) {
      await functionToCall();
    }

    for (const resource of resourcesInEnvironment) {
      // BUGBUG: The right way to check if the resource is WebappNodeAzure
      // is to use instanceof. But for reasons I don't have time to investigate
      // right now this isn't working with Node 8 at run time.
      // if (resource instanceof WebappNodeAzure) {
      if (resource instanceof WebappNodeAzureInfrastructure) {
        const url =
          await (resource as WebappNodeAzureInfrastructure).getDeployedURL();
        console.log(
          `Web app is available at ${url}`);
      }
    }
}
