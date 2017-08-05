import ResourceNotResourceGroup from "./resourceNotResourceGroup";

export default class MySqlAzure extends ResourceNotResourceGroup {
    public static async setup(targetDirectoryPath: string): Promise<void> {
        return MySqlAzure.internalSetup(__filename, targetDirectoryPath);
    }
}
