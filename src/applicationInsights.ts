import IGlobalDefault from "./IGlobalDefault";
import ResourceNotResourceGroup from "./resourceNotResourceGroup";

export default class ApplicationInsights extends ResourceNotResourceGroup
    implements IGlobalDefault {
    private isGlobalDefaultProperty: boolean;
    public get isGlobalDefault(): boolean {
        return this.isGlobalDefaultProperty;
    }
    public setGlobalDefault(setting: boolean): this {
        this.isGlobalDefaultProperty = setting;
        return this;
    }
}
