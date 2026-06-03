const { writeData, readData } = require("./jsonStore");
const { logDebug, logError } = require("../utils/logger");

async function saveConfigData(data, filePath) {
  try {
    await writeData(data, filePath);
    logDebug(`Config sauvegarde ${filePath}`, "ConfigStore");
  } catch (error) {
    logError(`Config sauvegarde impossible ${filePath}`, "ConfigStore", error);
    throw error;
  }
}

async function loadConfigData(filePath) {
  try {
    const data = await readData(filePath, { silentMissing: true });

    if (data !== null) {
      logDebug(`Config charge ${filePath}`, "ConfigStore");
    }

    return data;
  } catch (error) {
    return null;
  }
}

module.exports = { saveConfigData, loadConfigData };
