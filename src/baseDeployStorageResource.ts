export default abstract class IBaseDeployStorageResource {
    public abstract getEnvironmentVariables(): Array<[string, string]>;

    public abstract setFirewallRule(nameOfResourceSettingRule: string,
                                    ipAddress: string): Promise<this>;
}
