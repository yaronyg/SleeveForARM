import * as Path from "path";
import ApplicationInsights from "./applicationInsights";
import * as CommonUtilities from "./common-utilities";
import * as data from "./data";
import * as IInfrastructure from "./IInfrastructure";
import PromiseGate from "./promiseGate";
import * as Resource from "./resource";

export class BaseDeployApplicationInsightsInfrastructure {
    constructor(readonly instrumentationKey: string) {}
    public getInstrumentationKey(): string {
        return this.instrumentationKey;
    }
}

export class ApplicationInsightsInfrastructure extends ApplicationInsights
    // tslint:disable-next-line:max-line-length
    implements IInfrastructure.IInfrastructure<BaseDeployApplicationInsightsInfrastructure> {

    public appInsightsFullName: string;

    private readonly promiseGate = new PromiseGate();
    public initialize(resource: ApplicationInsights | null,
                      targetDirectoryPath: string): this {
        super.initialize(resource, targetDirectoryPath);
        if (resource !== null) {
            Object.assign(this, resource);
        }
        return this;
    }
    public async setup(): Promise<void> {
        return await ApplicationInsightsInfrastructure
            .internalSetup(__filename, this.targetDirectoryPath,
                data.data.ApplicationInsightsLength);
    }
    public async hydrate(resourcesInEnvironment: Resource.Resource[],
                         deploymentType: Resource.DeployType): Promise<this> {
        await super.hydrate(resourcesInEnvironment, deploymentType);

        if (this.appInsightsFullName === undefined) {
            this.appInsightsFullName = this.resourceGroup.resourceGroupName +
                this.baseName;
        }
        return this;
    }
    public async deployResource(): Promise<this> {
        try {
            const templateFilePath =
                Path.join(__dirname, "createAppInsightsARM.json");
            await this.resourceGroup.getBaseDeployClassInstance();
            await CommonUtilities.runAzCommand(
`az group deployment create --name ${this.appInsightsFullName} \
--resource-group ${this.resourceGroup.resourceGroupName} \
--template-file ${templateFilePath} \
--parameters appName=${this.appInsightsFullName}`);
            const properties = await CommonUtilities.runAzCommand(
`az resource show --name ${this.appInsightsFullName} \
--resource-group ${this.resourceGroup.resourceGroupName} \
--resource-type Microsoft.Insights/components`);
            const instrumentationKey =
                properties.properties.InstrumentationKey;
            this.promiseGate.openGateSuccess(
new BaseDeployApplicationInsightsInfrastructure(instrumentationKey));
            return this;
        } catch (err) {
            this.promiseGate.openGateError(err);
            throw err;
        }
    }
    public getBaseDeployClassInstance():
        Promise<BaseDeployApplicationInsightsInfrastructure> {
        return this.promiseGate.promise.then(
            function(baseClass: BaseDeployApplicationInsightsInfrastructure) {
                return baseClass;
            });
    }
}
