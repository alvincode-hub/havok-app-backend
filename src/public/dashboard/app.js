import {
  CONFIG_SECTIONS,
  buildDashboardPayload,
  createDashboardState,
  createEmptyActuItem,
  createEmptyTeamPlayer,
  ensureCastWindowSelection,
  ensureSelectedEvent,
  getConfigButtonIds,
  hydrateSettingsState,
  markSettingsDirty,
  resetConfigDraft,
  setRemote,
  syncCastWindowSelectionToEvent,
  toggleAcceptedEventId,
  toKebab,
  upsertCastDraftEntry
} from "./dashboard.state.js";
import {
  loadDashboardResources,
  logoutDashboard,
  runDashboardCron,
  saveDashboardConfig
} from "./dashboard.api.js";
import { renderDashboard } from "./dashboard.view.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = createDashboardState();

document.addEventListener("DOMContentLoaded", () => {
  bindUiEvents();
  hydrateSettingsState(state, { force: true });
  renderDashboard(state);
  loadDashboard();
});

function bindUiEvents() {
  on("refreshButton", "click", () => loadDashboard({ preserveDrafts: true }));
  on("configRefreshButton", "click", () => loadDashboard({ preserveDrafts: true }));
  on("cronButton", "click", runCronUpdate);
  on("logoutButton", "click", logout);

  $$("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ui.mode = button.dataset.mode || "info";
      renderDashboard(state);
    });
  });

  on("eventSelect", "change", (event) => selectEvent(event.target.value));
  delegate("eventsList", "click", "[data-event-id]", (_event, button) => selectEvent(button.dataset.eventId || ""));

  on("configResetDraftsButton", "click", () => {
    hydrateSettingsState(state, { force: true });
    renderDashboard(state);
  });

  bindSimpleInput("teamDescriptionInput", () => state.settings.teamDraft, "description", "team");
  on("teamAddPlayerButton", "click", () => {
    state.settings.teamDraft.players.push(createEmptyTeamPlayer());
    markSettingsDirty(state, "team");
    renderDashboard(state);
  });
  bindListInput("teamPlayerList", "playerIndex", "playerField", () => state.settings.teamDraft.players, "team");
  bindRemoveButton("teamPlayerList", "removePlayerIndex", () => state.settings.teamDraft.players, "team");
  bindConfigButtons("team");

  bindSimpleInput(
    "tournamentFilterDescriptionInput",
    () => state.settings.tournamentFilterDraft,
    "description",
    "tournamentFilter"
  );
  on("tournamentFilterSearchInput", "input", (event) => {
    state.settings.tournamentFilterQuery = event.target.value;
    renderDashboard(state);
  });
  on("tournamentFilterHints", "change", (event) => {
    const eventId = event.target.dataset.filterEventId;

    if (!eventId) {
      return;
    }

    toggleAcceptedEventId(state, eventId, event.target.checked);
    markSettingsDirty(state, "tournamentFilter");
    renderDashboard(state);
  });
  bindConfigButtons("tournamentFilter");

  on("actuAddButton", "click", () => {
    state.settings.actuDraft.push(createEmptyActuItem());
    markSettingsDirty(state, "actu");
    renderDashboard(state);
  });
  bindListInput("actuConfigList", "actuIndex", "actuField", () => state.settings.actuDraft, "actu");
  bindRemoveButton("actuConfigList", "removeActuIndex", () => state.settings.actuDraft, "actu");
  bindConfigButtons("actu");

  on("castWindowSelect", "change", (event) => {
    state.settings.castSelectedWindowId = event.target.value;
    renderDashboard(state);
  });
  on("castEditor", "input", (event) => {
    const { castPlatform: platform, castField: field } = event.target.dataset;

    if (!platform || !field) {
      return;
    }

    const entry = upsertCastDraftEntry(state, state.settings.castSelectedWindowId);
    entry[platform][field] = event.target.value;
    markSettingsDirty(state, "cast");
    renderDashboard(state);
  });
  bindConfigButtons("cast");
}

function on(id, eventName, handler) {
  const element = $(id);

  if (element) {
    element.addEventListener(eventName, handler);
  }
}

function delegate(id, eventName, selector, handler) {
  on(id, eventName, (event) => {
    const target = event.target.closest(selector);

    if (target) {
      handler(event, target);
    }
  });
}

function bindSimpleInput(id, getObject, field, section) {
  on(id, "input", (event) => {
    getObject()[field] = event.target.value;
    markSettingsDirty(state, section);
    renderDashboard(state);
  });
}

function bindListInput(containerId, indexKey, fieldKey, getList, section) {
  on(containerId, "input", (event) => {
    const index = Number(event.target.dataset[indexKey]);
    const field = event.target.dataset[fieldKey];
    const item = getList()[index];

    if (Number.isNaN(index) || !field || !item) {
      return;
    }

    item[field] = event.target.value;
    markSettingsDirty(state, section);
    renderDashboard(state);
  });
}

function bindRemoveButton(containerId, removeKey, getList, section) {
  delegate(containerId, "click", `[data-${toKebab(removeKey)}]`, (_event, button) => {
    const index = Number(button.dataset[removeKey]);

    if (Number.isNaN(index)) {
      return;
    }

    getList().splice(index, 1);
    markSettingsDirty(state, section);
    renderDashboard(state);
  });
}

function bindConfigButtons(section) {
  const ids = getConfigButtonIds(section);

  on(ids.reset, "click", () => {
    resetConfigDraft(state, section);
    renderDashboard(state);
  });

  on(ids.save, "click", () => saveConfig(section));
}

async function loadDashboard(options = {}) {
  const { preserveDrafts = true, notice = "" } = options;

  setRemote(state, {
    loading: true,
    notice: "Lecture des donnees locales...",
    error: ""
  });
  renderDashboard(state);

  try {
    const resources = await loadDashboardResources();
    state.data = buildDashboardPayload(resources);
    hydrateSettingsState(state, { force: !preserveDrafts });
    ensureSelectedEvent(state);
    ensureCastWindowSelection(state);

    setRemote(state, {
      loading: false,
      error: "",
      notice: notice || `Dashboard mis a jour (${formatGeneratedAt(state.data.meta.generatedAt)}).`
    });
  } catch (error) {
    setRemote(state, {
      loading: false,
      error: error.message || "Erreur inconnue.",
      notice: "Le dashboard n'a pas pu charger les donnees."
    });
  }

  renderDashboard(state);
}

async function saveConfig(section) {
  const config = CONFIG_SECTIONS[section];

  if (!config) {
    return;
  }

  setRemote(state, {
    loading: true,
    notice: "Sauvegarde en cours...",
    error: ""
  });
  renderDashboard(state);

  try {
    const result = await saveDashboardConfig(config.endpoint, state.settings[config.draft]);
    state.data.settings[config.dataKey] = result.config;
    hydrateSettingsState(state, { force: true });
    await loadDashboard({
      preserveDrafts: false,
      notice: result.message || config.success
    });
  } catch (error) {
    setRemote(state, {
      loading: false,
      notice: "Echec de sauvegarde.",
      error: error.message || "Erreur inconnue."
    });
    renderDashboard(state);
  }
}

async function runCronUpdate() {
  setRemote(state, {
    loading: true,
    notice: "Lancement du cron...",
    error: ""
  });
  renderDashboard(state);

  try {
    const result = await runDashboardCron();
    await loadDashboard({
      preserveDrafts: true,
      notice: result?.message || "Cron lance."
    });
  } catch (error) {
    setRemote(state, {
      loading: false,
      notice: "Echec du cron.",
      error: error.message || "Erreur inconnue."
    });
    renderDashboard(state);
  }
}

async function logout() {
  await logoutDashboard();
  window.location.href = "/dashboard/login";
}

function selectEvent(eventId) {
  state.ui.selectedEventId = eventId;
  syncCastWindowSelectionToEvent(state, eventId);
  renderDashboard(state);
}

function formatGeneratedAt(value) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
