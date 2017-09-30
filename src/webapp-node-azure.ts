import ResourceNotResourceGroup from "./resourceNotResourceGroup";

export enum CDNSKUOption {
    Custom_Verizon = "Custom_Verizon",
    Premium_Verizon = "Premium_Verizon",
    Standard_Akamai = "Standard_Akamai",
    Standard_ChinaCdn = "Standard_ChinaCdn",
    Standard_Verizon = "Standard_Verizon"
}

export default class WebappNodeAzure extends ResourceNotResourceGroup {
    protected DefaultCDNSKU: CDNSKUOption;
    public setCDNProvider(setting: CDNSKUOption): this {
        this.DefaultCDNSKU = setting;
        return this;
    }
    public  getCDNProvider() {
        return this.DefaultCDNSKU;
    }
}
