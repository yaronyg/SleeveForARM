import resourceGroup from "./resourcegroup";
import webappNodeAzure from "./webapp-node-azure";

export default class ServicesToCreate {
    public static resourceGroup() {
        return new resourceGroup();
    }

    public webappNodeAzure() {
        return new webappNodeAzure();
    }
}
