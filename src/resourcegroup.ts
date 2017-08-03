import * as fs from "fs";
import * as path from "path";
import { format, promisify } from "util";
import * as commonUtilities from "./common-utilities";
import IGlobalDefault from "./IGlobalDefault";
import * as Resource from "./resource";

const asyncFsStat = promisify(fs.stat);

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
