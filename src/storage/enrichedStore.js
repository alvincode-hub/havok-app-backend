const { writeData, readData } = require("./jsonStore");
const { logDebug, logError } = require("../utils/logger");

async function saveEnrichedData(data, filePath) {
  try {
    await writeData(data, filePath);
    logDebug(`Enriched sauvegarde ${filePath}`, "EnrichedStore");
  } catch (error) {
    logError(`Enriched sauvegarde impossible ${filePath}`, "EnrichedStore", error);
    throw error;
  }
}

async function loadEnrichedData(filePath) {
  try {
    const data = await readData(filePath);
    logDebug(`Enriched charge ${filePath}`, "EnrichedStore");
    return data;
  } catch (error) {
    return null;
  }
}

module.exports = { saveEnrichedData, loadEnrichedData };
