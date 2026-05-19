const fs = require("fs");
const path = require("path");

const LOGS_FILE = path.join(__dirname, "../../data/logs.json");
const MAX_LOG_ENTRIES = 300;
const NEWLINE = process.platform === "win32" ? "\r\n" : "\n";

function getTimestamp() {
  return new Date().toISOString();
}

function serializeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name || "Error",
    message: error.message || String(error),
    stack: error.stack || null
  };
}

function ensureLogsFile() {
  if (!fs.existsSync(LOGS_FILE)) {
    fs.mkdirSync(path.dirname(LOGS_FILE), { recursive: true });
    fs.writeFileSync(LOGS_FILE, "[]");
  }
}

function clampLogs(logs) {
  if (!Array.isArray(logs)) {
    return [];
  }

  return logs.slice(-MAX_LOG_ENTRIES);
}

function readLogs() {
  ensureLogsFile();

  try {
    return clampLogs(JSON.parse(fs.readFileSync(LOGS_FILE, "utf8")));
  } catch (error) {
    process.stderr.write(`[Logger] Failed to read logs file: ${error.message}${NEWLINE}`);
    return [];
  }
}

function writeLogs(logs) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(clampLogs(logs), null, 2));
}

function persistLog(entry) {
  try {
    const logs = readLogs();
    logs.push(entry);
    writeLogs(logs);
  } catch (error) {
    process.stderr.write(`[Logger] Failed to persist log entry: ${error.message}${NEWLINE}`);
  }
}

function printLog(level, source, message, error = null) {
  const line = `[${source}] ${message}`;

  if (level === "ERROR") {
    process.stderr.write(`${line}${NEWLINE}`);
    if (error?.stack) {
      process.stderr.write(`${error.stack}${NEWLINE}`);
    }
    return;
  }

  process.stdout.write(`${line}${NEWLINE}`);
}

function buildEntry(level, message, source, error = null) {
  return {
    timestamp: getTimestamp(),
    level,
    source,
    message,
    error: serializeError(error)
  };
}

function logInfo(message, source) {
  const entry = buildEntry("INFO", message, source);
  printLog("INFO", source, message);
  persistLog(entry);
}

function logError(message, source, error) {
  const entry = buildEntry("ERROR", message, source, error);
  printLog("ERROR", source, message, error);
  persistLog(entry);
}

function logDebug(message, source) {
  const entry = buildEntry("DEBUG", message, source);
  printLog("DEBUG", source, message);
}

function logWarning(message, source) {
  const entry = buildEntry("WARNING", message, source);
  printLog("WARNING", source, message);
  persistLog(entry);
}

module.exports = { logInfo, logError, logDebug, logWarning };
