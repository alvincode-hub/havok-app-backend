const {
  normalizedRequestStatePath
} = require("../storage/paths.js");
const {
  loadNormalizedData,
  saveNormalizedData
} = require("../storage/normalizedStore.js");

const LIVE_FORBIDDEN_COOLDOWN_MS = 15 * 60 * 1000;
const FINISHED_FORBIDDEN_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const CUMULATIVE_FORBIDDEN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function loadRequestState() {
  const cache = await loadNormalizedData(normalizedRequestStatePath());

  if (!cache || typeof cache !== "object" || Array.isArray(cache)) {
    return { entries: {} };
  }

  return {
    entries: isObject(cache.entries) ? cache.entries : {}
  };
}

async function saveRequestState(state) {
  await saveNormalizedData(
    {
      entries: isObject(state?.entries) ? state.entries : {}
    },
    normalizedRequestStatePath()
  );
}

async function getRequestStateEntry(key) {
  const state = await loadRequestState();
  return state.entries[key] || null;
}

async function markRequestSuccess(key, metadata = {}) {
  const state = await loadRequestState();
  const now = new Date().toISOString();
  const currentEntry = state.entries[key] || {};

  state.entries[key] = {
    ...currentEntry,
    key,
    source: metadata.source || currentEntry.source || "",
    status: "ok",
    cooldownUntil: null,
    lastAttemptAt: now,
    lastSuccessAt: now,
    lastFailureReason: null,
    freshnessTtlMs: metadata.freshnessTtlMs ?? currentEntry.freshnessTtlMs ?? null
  };

  await saveRequestState(state);
  return state.entries[key];
}

async function markRequestForbidden(key, metadata = {}) {
  const state = await loadRequestState();
  const now = new Date();
  const currentEntry = state.entries[key] || {};
  const cooldownMs = getForbiddenCooldownMs(key, metadata.cooldownKind);

  state.entries[key] = {
    ...currentEntry,
    key,
    source: metadata.source || currentEntry.source || "",
    status: "forbidden",
    cooldownUntil: new Date(now.getTime() + cooldownMs).toISOString(),
    lastAttemptAt: now.toISOString(),
    lastForbiddenAt: now.toISOString(),
    lastFailureReason: metadata.reason || "forbidden",
    freshnessTtlMs: metadata.freshnessTtlMs ?? currentEntry.freshnessTtlMs ?? null
  };

  await saveRequestState(state);
  return state.entries[key];
}

function getBlockedReason(entry, freshnessTtlMs) {
  const now = Date.now();

  if (entry?.cooldownUntil) {
    const cooldownUntilTime = new Date(entry.cooldownUntil).getTime();

    if (!Number.isNaN(cooldownUntilTime) && cooldownUntilTime > now) {
      return {
        blocked: true,
        reason: "forbidden_cooldown",
        cooldownUntil: entry.cooldownUntil
      };
    }
  }

  if (entry?.lastSuccessAt && freshnessTtlMs > 0) {
    const lastSuccessTime = new Date(entry.lastSuccessAt).getTime();

    if (!Number.isNaN(lastSuccessTime) && now - lastSuccessTime < freshnessTtlMs) {
      return {
        blocked: true,
        reason: "fresh_cache",
        cooldownUntil: new Date(lastSuccessTime + freshnessTtlMs).toISOString()
      };
    }
  }

  return {
    blocked: false,
    reason: null,
    cooldownUntil: null
  };
}

async function getRequestDecision(key, options = {}) {
  const entry = await getRequestStateEntry(key);
  const freshnessTtlMs = Number(options.freshnessTtlMs) || 0;
  return {
    entry,
    ...getBlockedReason(entry, freshnessTtlMs)
  };
}

function getForbiddenCooldownMs(key, cooldownKind) {
  if (String(key || "").includes("Fortnite:cumulative:")) {
    return CUMULATIVE_FORBIDDEN_COOLDOWN_MS;
  }

  if (cooldownKind === "live") {
    return LIVE_FORBIDDEN_COOLDOWN_MS;
  }

  return FINISHED_FORBIDDEN_COOLDOWN_MS;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = {
  LIVE_FORBIDDEN_COOLDOWN_MS,
  FINISHED_FORBIDDEN_COOLDOWN_MS,
  CUMULATIVE_FORBIDDEN_COOLDOWN_MS,
  getRequestDecision,
  getRequestStateEntry,
  markRequestSuccess,
  markRequestForbidden
};
