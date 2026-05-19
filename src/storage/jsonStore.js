const fs = require("fs-extra");
const path = require("path");

const { logError } = require("../utils/logger");

async function readData(filePath) {
  try {
    const resolvedPath = getDataFilePath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Fichier introuvable: ${filePath}`);
    }

    const data = await fs.readFile(resolvedPath, "utf8");
    const parsed  = JSON.parse(data);

    if (parsed.data !== undefined) {
      return parsed.data;
    };
    return parsed;
  } catch (error) {
    logError(`Lecture JSON impossible ${filePath}`, "JsonStore", error);
    throw error;
  }
}

async function readUpdatedAt(filePath) {
  try {
    const resolvedPath = getDataFilePath(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Fichier introuvable: ${filePath}`);
    }

    const data = await fs.readFile(resolvedPath, "utf8");
    const parsed  = JSON.parse(data);

    if (parsed.updatedAt !== undefined) {
      return parsed.updatedAt;
    }
    return null;
  } catch (error) {
    logError(`Lecture JSON impossible ${filePath}`, "JsonStore", error);
    throw error;
  }
}


async function writeData(newData, filePath) {
  await createDataFileIfNotExists(filePath);
  const data = {
    updatedAt: new Date().toISOString(),
    data: newData
  }
  try {
    await fs.writeFile(getDataFilePath(filePath), JSON.stringify(data, null, 2));
  } catch (error) {
    logError(`Ecriture JSON impossible ${filePath}`, "JsonStore", error);
    throw error;
  }
}

function getDataFilePath(fileName) {
  return path.join(__dirname, "../../data", fileName);
}

async function createDataFileIfNotExists(filePath) {
  const resolvedPath = getDataFilePath(filePath);

  if (!fs.existsSync(resolvedPath)) {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, JSON.stringify({}));
  }
}

module.exports = { readData, writeData, createDataFileIfNotExists, readUpdatedAt };
