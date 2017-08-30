export default abstract class IBaseDeployStorageResource {
    public abstract getEnvironmentVariables(): Array<[string, string]>;

    public abstract setFirewallRule(ruleName: string, ipAddress: string)
        : Promise<this>;
}
