const resourcegroupAzure = require("@sleeve/resourcegroup-azure");
const resourceGroup = (new resourcegroupAzure()).setGlobalDefault(true);
module.exports = resourceGroup;