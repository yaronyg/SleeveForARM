import IGlobalDefault from "./IGlobalDefault";
import * as Resource from "./resource";

export default class ResourceGroup extends Resource.Resource
        implements IGlobalDefault {
    private isGlobalDefaultProperty: boolean = false;
    private dataCenterProperty: Resource.DataCenterNames;

    public setGlobalDefault(setting: boolean): this {
        this.isGlobalDefaultProperty = setting;
        return this;
    }

    public get isGlobalDefault(): boolean {
        return this.isGlobalDefaultProperty;
    }

    public setDataCenter(dataCenterName: Resource.DataCenterNames): this {
        if ((dataCenterName.replace(/ /g, "") in Resource.DataCenterNames)
                === false) {
            throw new Error(`Submitted data center name ${dataCenterName} is \
not is not in the recognized data center list. Either the name is wrong or \
the list is outdated.`);
        }
        this.dataCenterProperty = dataCenterName;
        return this;
    }

    protected get dataCenter(): Resource.DataCenterNames {
        return this.dataCenterProperty;
    }
}
