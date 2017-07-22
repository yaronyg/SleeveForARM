export abstract class Resource {
    /**
     * This function will be called on a resource class before it is used
     * by Sleeve.
     *
     * The function is used to help resources that needed to perform
     * asynchronous work before they can be used. For example,
     * resourcegroup-azure needs to make an async call to fix its
     * location if one wasn't provided in the constructor. This function
     * is where it would do that work.
     */
    public abstract async prepareResource(): Promise<void>;

}
