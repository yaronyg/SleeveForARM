const resourcegroupAzure = require("sleeveforarm/src/resourcegroup").default;
const DataCenterNames = require("sleeveforarm/src/resource").DataCenterNames;
module.exports = new resourcegroupAzure().setGlobalDefault(true).setDataCenter(XXXX);
