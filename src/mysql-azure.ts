import ResourceNotResourceGroup from "./resourceNotResourceGroup";

export default class MySqlAzure extends ResourceNotResourceGroup {
    protected pathToMySqlInitializationScripts: string[] = [];
    /**
     * Points to a text file that contains mySQL commands that
     * can be passed to the mySQL client. These commands will
     * be passed to the mySQL instance during deployment.
     * @param scriptPath Either a path relative to the current
     * directory or an absolute path
     */
    public addMySqlInitializationScript(scriptPath: string): this {
        this.pathToMySqlInitializationScripts.push(scriptPath);
        return this;
    }
}
