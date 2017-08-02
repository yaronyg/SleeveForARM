const KeyVault = require("sleeveforarm/src/keyvault").default;
module.exports = new KeyVault()
    .setGlobalDefault(true)
    .setEnableSoftDelete(true)
    .setEnableForDeployment(true)
    .setEnableForDiskEncryption(true)
    .setEnableForTemplateDeployment(true);
