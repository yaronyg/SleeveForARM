import * as fs from "fs-extra-promise";
import * as Path from "path";
import * as Winston from "winston";
import * as CommonUtilities from "./common-utilities";
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
}

// TODO: developmentDeploy is really just intended for Node WebAPPs so that
// we deploy code in Azure that will properly set up the environment
// to take a version of Sleeve from the local machine and not look to
// NPM. But we really need to shove this into some kind of property bag
// as the name and usage is confusing.
export async function deployResources(
                          rootOfDeploymentPath: string,
                          deploymentType: Resource.DeployType,
                          developmentDeploy = false,
                          deleteResourceGroupBeforeDeploy = false)
                          : Promise<InfraResourceType[]> {
    const resourcesInEnvironment: InfraResourceType[] = [];
    const rootSleevePath = Path.join(rootOfDeploymentPath, "sleeve.js");
    if (!(fs.existsSync(rootSleevePath))) {
      console.log("There is no sleeve.js in the root, \
this is not a properly configured project");
      process.exit(-1);
    }
    await CommonUtilities.npmSetup(rootOfDeploymentPath);
    const rootResourceGroup: ResourceGroup = require(rootSleevePath);
    const rootResourceGroupInfra =
      // tslint:disable-next-line:max-line-length
      createInfraResource(rootResourceGroup, rootOfDeploymentPath) as ResourceGroupInfrastructure.ResourceGroupInfrastructure;
    await rootResourceGroupInfra.hydrate(resourcesInEnvironment,
                                         deploymentType);
    if (deleteResourceGroupBeforeDeploy) {
      await rootResourceGroupInfra.deleteResource();
    }
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

    if (resourcesInEnvironment.length === 0) {
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
`Web app is available at ${await baseDeployWebApp.getDeployedURL()}`);
        }
      }
    }
    return resourcesInEnvironment;
}

export function setLoggingIfNeeded(argv: any) {
  if (argv.version) {
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
