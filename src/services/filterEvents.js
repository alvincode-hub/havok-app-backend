const { loadConfigData } = require("../storage/configStore.js");

async function loadAcceptedEventIds() {
  const config = await loadConfigData("config/tournament-filter.json");

  if (!Array.isArray(config?.acceptedEventIds)) {
    return null;
  }

  return new Set(
    config.acceptedEventIds
      .map((entry) => normalizeSimpleString(entry))
      .filter(Boolean)
  );
}

async function isEventAccepted(eventId, acceptedEventIds) {
  const normalizedEventId = normalizeSimpleString(eventId);
  const acceptedIds =
    acceptedEventIds instanceof Set ? acceptedEventIds : await loadAcceptedEventIds();

  if (!normalizedEventId) {
    return false;
  }

  if (acceptedIds === null) {
    return true;
  }

  if (acceptedIds.size === 0) {
    return false;
  }

  return acceptedIds.has(normalizedEventId);
}

function normalizeSimpleString(value) {
  return typeof value === "string" ? value.trim() : "";
}

module.exports = {
  loadAcceptedEventIds,
  isEventAccepted
};
