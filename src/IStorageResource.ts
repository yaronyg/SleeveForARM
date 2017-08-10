export default interface IStorageResource {
    /**
     * The value doesn't matter, it's the existence of the
     * property we are looking for.
     */
    isStorageResource: boolean;

    /**
     * Returns a list of Powershell script variable names
     * that will contain the values necessary to connect
     * to this resource. The returned values will all be
     * prefixed with $ to make them powershell variables.
     * There is no good reason for this.
     */
    getPowershellConnectionVariableNames(): string[];

    /**
     * Returns the name of a function that can be called
     * at runtime in the powershell script to set a firewall
     * rule. The function will have the returned name
     * and will take as an argument an array of IP addresses
     * that are allowed to talk to the storage device.
     */
    getPowershellFirewallFunctionName(): string;
}
