async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await readJsonSafe(response);

  if (!response.ok) {
    throw new Error(payload?.error || "Requete impossible.");
  }

  return payload;
}

export async function loadDashboardResources() {
  const [overview, events, content, config] = await Promise.all([
    requestJson("/api/dashboard/overview"),
    requestJson("/api/dashboard/events"),
    requestJson("/api/dashboard/content"),
    requestJson("/api/dashboard/config")
  ]);

  return {
    overview,
    events,
    content,
    config
  };
}

export async function saveDashboardConfig(endpoint, payload) {
  return requestJson(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function runDashboardCron() {
  return requestJson("/api/dashboard/updateCron", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
}

export async function logoutDashboard() {
  await requestJson("/dashboard/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}
