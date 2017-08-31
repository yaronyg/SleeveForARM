import IGlobalDefault from "./IGlobalDefault";
import * as Resource from "./resource";

export default class ResourceGroup extends Resource.Resource
        implements IGlobalDefault {
    private isGlobalDefaultProperty: boolean = false;

    public setGlobalDefault(setting: boolean) {
        this.isGlobalDefaultProperty = setting;
        return this;
    }

    public get isGlobalDefault(): boolean {
        return this.isGlobalDefaultProperty;
    }
}
