export default abstract class Resource {
    private scopedResources: Resource[];

    public addService(resource: Resource) {
        this.scopedResources.push(resource);
        return this;
    }

    public abstract async deployResource(resourceDirectoryPath: string,
                                         resources: Resource[])
        : Promise<string>;
}
