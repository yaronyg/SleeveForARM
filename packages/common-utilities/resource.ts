export default abstract class Resource {
    public abstract async deployResource(resourceDirectoryPath: string,
                                         resources: Resource[])
        : Promise<void>;
}
