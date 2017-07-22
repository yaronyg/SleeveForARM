import fs = require("fs");
// tslint:disable-next-line:no-var-requires
const { promisify } = require("util");
const asyncFsStat = promisify(fs.stat);

async function setup() {
    const directoryToSetUp = process.argv[2];
    /**
     * We need to go to the specified directory
     * and create the sleeve.js file and put inside of it
     * a call to new resourcegroup();
     */
    if (!fs.existsSync(directoryToSetUp)) {
        throw new Error("Specified path does not exist: " +
                        directoryToSetUp);
    }

    const statResults = await asyncFsStat(directoryToSetUp);

    if (!statResults.isDirectory()) {
        throw new Error("Specified path is not a directory - " +
                        directoryToSetUp);
    }
}

try {
    setup();
    process.exit(0);
} catch (err) {
    // tslint:disable-next-line:no-console
    console.log("Set up failed because of %s", err);
    process.exit(-1);
}
