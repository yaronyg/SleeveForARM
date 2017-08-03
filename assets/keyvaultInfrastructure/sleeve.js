const KeyVault = require("sleeveforarm/src/keyvault").default;
module.exports = new KeyVault()
    .setEnableSoftDelete(true)
    .setEnableForDeployment(true)
    .setEnableForDiskEncryption(true)
    .setEnableForTemplateDeployment(true);

