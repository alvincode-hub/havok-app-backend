const { writeData, readData } = require("./jsonStore");
const { logDebug, logError } = require("../utils/logger");

async function saveRawData(data, filePath) {
  try {
    await writeData(data, filePath);
    logDebug(`Raw sauvegarde ${filePath}`, "RawStore");
  } catch (error) {
    logError(`Raw sauvegarde impossible ${filePath}`, "RawStore", error);
    throw error;
  }
}

async function loadRawData(filePath) {
  try {
    const data = await readData(filePath);
    logDebug(`Raw charge ${filePath}`, "RawStore");
    return data;
  } catch (error) {
    return null;
  }
}

module.exports = { saveRawData, loadRawData };
