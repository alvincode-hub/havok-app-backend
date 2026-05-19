function formatRequestLog(fields = {}) {
  return JSON.stringify({
    service: fields.service || "unknown",
    operation: fields.operation || "unknown",
    key: fields.key || "",
    source: fields.source || "",
    status: fields.status || "unknown",
    cacheHit: fields.cacheHit ?? null,
    cooldownApplied: fields.cooldownApplied ?? false,
    durationMs: fields.durationMs ?? null,
    ...fields
  });
}

module.exports = { formatRequestLog };
