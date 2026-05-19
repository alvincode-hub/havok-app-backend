const { writeData, readData } = require("./jsonStore");
const { logDebug, logError } = require("../utils/logger");

async function saveNormalizedData(data, filePath) {
  try {
    await writeData(data, filePath);
    logDebug(`Normalized sauvegarde ${filePath}`, "NormalizedStore");
  } catch (error) {
    logError(`Normalized sauvegarde impossible ${filePath}`, "NormalizedStore", error);
    throw error;
  }
}

async function loadNormalizedData(filePath) {
  try {
    const data = await readData(filePath);
    logDebug(`Normalized charge ${filePath}`, "NormalizedStore");
    return data;
  } catch (error) {
    return null;
  }
}

module.exports = { saveNormalizedData, loadNormalizedData };
