const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const CONFIG_SECTIONS = {
  team: {
    draft: "teamDraft",
    dirty: "teamDirty",
    dataKey: "teamConfig",
    endpoint: "/api/dashboard/config/team",
    success: "Config team sauvegardee."
  },
  tournamentFilter: {
    draft: "tournamentFilterDraft",
    dirty: "tournamentFilterDirty",
    dataKey: "tournamentFilter",
    endpoint: "/api/dashboard/config/tournament-filter",
    success: "Tournament filter sauvegarde."
  },
  actu: {
    draft: "actuDraft",
    dirty: "actuDirty",
    dataKey: "actuConfig",
    endpoint: "/api/dashboard/config/actu",
    success: "Actu sauvegardee."
  },
  cast: {
    draft: "castDraft",
    dirty: "castDirty",
    dataKey: "castConfig",
    endpoint: "/api/dashboard/config/cast",
    success: "Config cast sauvegardee."
  }
};

const state = {
  ui: {
    mode: "info",
    selectedEventId: ""
  },
  remote: {
    loading: false,
    notice: "Chargement du dashboard...",
    error: ""
  },
  data: createEmptyPayload(),
  settings: {
    teamDraft: createEmptyPayload().settings.teamConfig,
    tournamentFilterDraft: createEmptyPayload().settings.tournamentFilter,
    tournamentFilterQuery: "",
    actuDraft: [],
    castDraft: createEmptyPayload().settings.castConfig,
    castSelectedWindowId: "",
    teamDirty: false,
    tournamentFilterDirty: false,
    actuDirty: false,
    castDirty: false
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindUiEvents();
  hydrateSettingsState({ force: true });
  renderDashboard();
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
      renderMode();
    });
  });

  on("eventSelect", "change", (event) => selectEvent(event.target.value));
  delegate("eventsList", "click", "[data-event-id]", (_event, button) => selectEvent(button.dataset.eventId || ""));

  on("configResetDraftsButton", "click", () => {
    hydrateSettingsState({ force: true });
    renderConfig();
    renderActionState();
  });

  bindSimpleInput("teamDescriptionInput", () => state.settings.teamDraft, "description", "team");
  on("teamAddPlayerButton", "click", () => addDraftItem("team", state.settings.teamDraft.players, createEmptyTeamPlayer));
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
    renderConfig();
  });
  on("tournamentFilterHints", "change", (event) => {
    const eventId = event.target.dataset.filterEventId;
    if (!eventId) return;

    toggleAcceptedEventId(eventId, event.target.checked);
    markSettingsDirty("tournamentFilter");
    renderConfig();
  });
  bindConfigButtons("tournamentFilter");

  on("actuAddButton", "click", () => addDraftItem("actu", state.settings.actuDraft, createEmptyActuItem));
  bindListInput("actuConfigList", "actuIndex", "actuField", () => state.settings.actuDraft, "actu");
  bindRemoveButton("actuConfigList", "removeActuIndex", () => state.settings.actuDraft, "actu");
  bindConfigButtons("actu");

  on("castWindowSelect", "change", (event) => {
    state.settings.castSelectedWindowId = event.target.value;
    renderConfig();
  });
  on("castEditor", "input", (event) => {
    const { castPlatform: platform, castField: field } = event.target.dataset;
    if (!platform || !field) return;

    const entry = upsertCastDraftEntry(state.settings.castSelectedWindowId);
    entry[platform][field] = event.target.value;
    markSettingsDirty("cast");
  });
  bindConfigButtons("cast");
}

function on(id, eventName, handler) {
  const element = $(id);
  if (element) element.addEventListener(eventName, handler);
}

function delegate(id, eventName, selector, handler) {
  on(id, eventName, (event) => {
    const target = event.target.closest(selector);
    if (target) handler(event, target);
  });
}

function bindSimpleInput(id, getObject, field, section) {
  on(id, "input", (event) => {
    getObject()[field] = event.target.value;
    markSettingsDirty(section);
  });
}

function bindListInput(containerId, indexKey, fieldKey, getList, section) {
  on(containerId, "input", (event) => {
    const index = Number(event.target.dataset[indexKey]);
    const field = event.target.dataset[fieldKey];
    const item = getList()[index];

    if (Number.isNaN(index) || !field || !item) return;

    item[field] = event.target.value;
    markSettingsDirty(section);
  });
}

function bindRemoveButton(containerId, removeKey, getList, section) {
  delegate(containerId, "click", `[data-${toKebab(removeKey)}]`, (_event, button) => {
    const index = Number(button.dataset[removeKey]);
    if (Number.isNaN(index)) return;

    getList().splice(index, 1);
    markSettingsDirty(section);
    renderConfig();
  });
}

function bindConfigButtons(section) {
  const ids = getConfigButtonIds(section);

  on(ids.reset, "click", () => resetConfigDraft(section));
  on(ids.save, "click", () => saveConfig(section));
}

function addDraftItem(section, list, factory) {
  list.push(factory());
  markSettingsDirty(section);
  renderConfig();
}

async function runCronUpdate() {
  setRemote({ loading: true, notice: "Lancement du cron...", error: "" });

  try {
    const response = await fetch("/api/dashboard/updateCron", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const result = await readJsonSafe(response);

    if (!response.ok || result?.ok === false) {
      throw new Error(result?.error || result?.message || "Cron impossible.");
    }

    await loadDashboard({ preserveDrafts: true, notice: result?.message || "Cron lance." });
  } catch (error) {
    setRemote({ loading: false, notice: "Echec du cron.", error: error.message || "Erreur inconnue." });
    renderDashboard();
  }
}

async function logout() {
  await fetch("/dashboard/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  window.location.href = "/dashboard/login";
}

async function loadDashboard(options = {}) {
  const { preserveDrafts = true, notice = "" } = options;

  setRemote({ loading: true, notice: "Lecture des donnees locales...", error: "" });
  renderStatus();
  renderActionState();

  try {
    const response = await fetch("/api/dashboard");
    const payload = await readJsonSafe(response);

    if (!response.ok) {
      throw new Error(payload?.error || "Chargement impossible.");
    }

    state.data = normalizePayload(payload);
    hydrateSettingsState({ force: !preserveDrafts });
    ensureSelectedEvent();
    ensureCastWindowSelection();

    setRemote({
      loading: false,
      error: "",
      notice: notice || `Dashboard mis a jour (${formatGeneratedAt(state.data.meta.generatedAt)}).`
    });
  } catch (error) {
    setRemote({
      loading: false,
      error: error.message || "Erreur inconnue.",
      notice: "Le dashboard n'a pas pu charger les donnees."
    });
  }

  renderDashboard();
}

async function saveConfig(section) {
  const config = CONFIG_SECTIONS[section];
  if (!config) return;

  setRemote({ loading: true, notice: "Sauvegarde en cours...", error: "" });
  renderStatus();
  renderActionState();

  try {
    const response = await fetch(config.endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.settings[config.draft])
    });
    const result = await readJsonSafe(response);

    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || result?.message || "Sauvegarde impossible.");
    }

    state.data.settings[config.dataKey] = result.config;
    hydrateSettingsState({ force: true });
    await loadDashboard({ preserveDrafts: false, notice: result.message || config.success });
  } catch (error) {
    setRemote({ loading: false, notice: "Echec de sauvegarde.", error: error.message || "Erreur inconnue." });
    renderDashboard();
  }
}

function resetConfigDraft(section) {
  const config = CONFIG_SECTIONS[section];
  if (!config) return;

  state.settings[config.draft] = cloneValue(state.data.settings[config.dataKey]);
  state.settings[config.dirty] = false;

  if (section === "cast") {
    ensureCastWindowSelection({ force: true });
  }

  renderConfig();
  renderActionState();
}

function createEmptyPayload() {
  return {
    meta: { generatedAt: null },
    header: {
      title: "Havok Dashboard",
      subtitle: "Aucune donnee chargee."
    },
    featuredEventId: "",
    events: [],
    trackedPlayers: [],
    recentResults: [],
    actu: [],
    casts: [],
    dataSources: [],
    summaryCards: [],
    settings: {
      teamConfig: { description: "", players: [] },
      tournamentFilter: { description: "", acceptedEventIds: [] },
      actuConfig: [],
      castConfig: { entries: [] },
      eventOptions: [],
      castWindowOptions: []
    },
    notes: []
  };
}

function normalizePayload(payload = {}) {
  const empty = createEmptyPayload();
  const settings = payload.settings || {};

  return {
    meta: payload.meta || empty.meta,
    header: payload.header || empty.header,
    featuredEventId: payload.featuredEventId || empty.featuredEventId,
    events: asArray(payload.events),
    trackedPlayers: asArray(payload.trackedPlayers),
    recentResults: asArray(payload.recentResults),
    actu: asArray(payload.actu),
    casts: asArray(payload.casts),
    dataSources: asArray(payload.dataSources),
    summaryCards: asArray(payload.summaryCards),
    settings: {
      teamConfig: asObject(settings.teamConfig, empty.settings.teamConfig),
      tournamentFilter: asObject(settings.tournamentFilter, empty.settings.tournamentFilter),
      actuConfig: asArray(settings.actuConfig),
      castConfig: asObject(settings.castConfig, empty.settings.castConfig),
      eventOptions: asArray(settings.eventOptions),
      castWindowOptions: asArray(settings.castWindowOptions)
    },
    notes: asArray(payload.notes)
  };
}

function hydrateSettingsState(options = {}) {
  const { force = false } = options;

  Object.values(CONFIG_SECTIONS).forEach((config) => {
    if (force || !state.settings[config.dirty]) {
      state.settings[config.draft] = cloneValue(state.data.settings[config.dataKey]);
      state.settings[config.dirty] = false;
    }
  });

  ensureCastWindowSelection({ force });
}

function renderDashboard() {
  renderHeader();
  renderMode();
  renderInfo();
  renderConfig();
  renderStatus();
  renderActionState();
}

function renderHeader() {
  setText("pageTitle", state.data.header.title || "Havok Dashboard");
  setText("pageSubtitle", state.data.header.subtitle || "Aucune donnee chargee.");
}

function renderMode() {
  $$("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.ui.mode);
  });

  toggleClass("infoView", "is-hidden", state.ui.mode !== "info");
  toggleClass("configView", "is-hidden", state.ui.mode !== "config");
}

function renderInfo() {
  renderEventSelect();
  renderHero();
  renderWindowConnection();
  renderSummary();
  renderEvents();
  renderPlayers();
  renderResults();
  renderActu();
  renderCasts();
  renderNotes();
  renderSources();
}

function renderConfig() {
  syncSettingsStatus();

  const castWindowOptions = getCastWindowOptions();
  const selectedCastEntry = getSelectedCastEntry();

  renderInputValue("teamDescriptionInput", state.settings.teamDraft.description || "");
  renderInputValue("tournamentFilterDescriptionInput", state.settings.tournamentFilterDraft.description || "");
  renderInputValue("tournamentFilterSearchInput", state.settings.tournamentFilterQuery || "");

  setHtml("teamPlayerList", renderTeamPlayersMarkup());
  setHtml("tournamentFilterHints", renderTournamentOptionsMarkup());
  setHtml("actuConfigList", renderActuConfigMarkup());

  setHtml("castWindowSelect", renderCastWindowOptionsMarkup(castWindowOptions));
  renderInputValue("castWindowSelect", state.settings.castSelectedWindowId || "");
  setDisabled("castWindowSelect", castWindowOptions.length === 0);
  setText("castWindowMeta", buildCastWindowMeta(selectedCastEntry, castWindowOptions));

  renderInputValue("castYoutubeChannelName", selectedCastEntry.youtube?.channelName || "");
  renderInputValue("castYoutubeLink", selectedCastEntry.youtube?.link || "");
  renderInputValue("castTwitchChannelName", selectedCastEntry.twitch?.channelName || "");
  renderInputValue("castTwitchLink", selectedCastEntry.twitch?.link || "");
}

function renderEventSelect() {
  const select = $("eventSelect");
  if (!select) return;

  if (state.data.events.length === 0) {
    select.innerHTML = `<option value="">Aucun event</option>`;
    select.value = "";
    return;
  }

  select.innerHTML = state.data.events.map(renderEventOption).join("");
  select.value = state.ui.selectedEventId;
}

function renderEventOption(event) {
  return `
    <option value="${escapeHtml(event.id)}">
      ${escapeHtml(event.name)} - ${escapeHtml(event.statusLabel)} - ${escapeHtml(event.timeLabel)}
    </option>
  `;
}

function renderHero() {
  const event = getSelectedEvent();
  const image = $("featuredImage");
  const media = image?.parentElement;

  if (!event) {
    setHeroFallback(image, media);
    return;
  }

  setText("featuredName", event.name || "Event");
  setText("featuredMeta", `${event.timeLabel} - ${event.teamFormat} - ${event.mode}`);
  setText("featuredSummary", event.summary || "Aucun resume disponible.");
  setText("featuredMode", event.mode || "--");
  setText("featuredTracked", String(event.trackedPlayers || 0));
  setText("featuredBestRank", event.bestRank || "--");
  setText("featuredCountdown", event.countdown || "--");
  setChip("featuredStatus", event.statusLabel || "Archive", getStatusClass(event.status));
  setImage(image, media, event.image, event.name || "Event");
}

function setHeroFallback(image, media) {
  setText("featuredName", "Aucun event disponible");
  setText("featuredMeta", "Le dossier data ne contient pas encore de fenetre exploitable.");
  setText("featuredSummary", "Ajoute ou regenere les snapshots locaux pour afficher un focus.");
  setText("featuredMode", "--");
  setText("featuredTracked", "0");
  setText("featuredBestRank", "--");
  setText("featuredCountdown", "--");
  setChip("featuredStatus", "Archive", "chip chip-review");
  setImage(image, media, "", "");
}

function renderWindowConnection() {
  const event = getSelectedEvent();
  const pills = $("windowInsightPills");
  const statuses = $("windowPlayerStatuses");
  const prizes = $("windowPrizeHighlights");

  if (!event) {
    setText("windowDetailMeta", "Aucune fenetre selectionnee.");
    setText("windowDetailDescription", "Les snapshots enrichis de results et de window details apparaitront ici pour l'event choisi.");
    setHtml(pills, "");
    setHtml(statuses, renderEmptyState("Aucun statut", "Selectionne un event pour afficher la fenetre enrichie."));
    setHtml(prizes, renderEmptyState("Aucun prize", "Aucune donnee enrichie n'est reliee pour le moment."));
    return;
  }

  const meta = [event.eventType, event.teamFormat, event.mode, event.timeLabel].filter(Boolean).join(" - ");
  const insightPills = [
    event.hasResultConnection ? "results connecte" : "results absent",
    event.hasDetailConnection ? "window details connecte" : "window details absent",
    event.hasDetailConnection ? (event.requiresQualification ? "qualification requise" : "qualification non requise") : "",
    event.hasDetailConnection && event.matchCap ? `${event.matchCap} game(s) max` : "",
    event.hasDetailConnection ? `${event.scoreRuleCount || 0} score rule(s)` : "",
    event.hasDetailConnection ? `${event.prizeCount || 0} prize(s)` : ""
  ].filter(Boolean);

  setText("windowDetailMeta", meta || "Fenetre locale");
  setText(
    "windowDetailDescription",
    event.detailDescription ||
      event.qualificationSummary ||
      (event.hasWindowConnection
        ? "La fenetre est connectee mais ne remonte pas de description detaillee."
        : "Aucun detail enrichi disponible pour cette fenetre.")
  );

  setHtml(pills, insightPills.map((label) => `<span class="detail-pill">${escapeHtml(label)}</span>`).join(""));
  setHtml(statuses, renderPlayerStatuses(event.playerStatuses));
  setHtml(prizes, renderPrizeHighlights(event.prizeHighlights));
}

function renderPlayerStatuses(players = []) {
  if (!Array.isArray(players) || players.length === 0) {
    return renderEmptyState("Aucun statut joueur", "Les snapshots enrichis ne remontent aucun statut pour les joueurs suivis.");
  }

  return players.map((player) => {
    const labels = player.labels?.length ? player.labels.join(", ") : "Aucun label";
    const stateLabel = player.isQualified ? "Qualifie" : "Suivi";
    const stateClass = player.isQualified ? "chip chip-live" : "chip chip-review";

    return `
      <article class="detail-item">
        <div>
          <strong>${escapeHtml(player.name || "Joueur suivi")}</strong>
          <p class="detail-copy">${escapeHtml(labels)}</p>
        </div>
        <span class="${stateClass}">${stateLabel}</span>
      </article>
    `;
  }).join("");
}

function renderPrizeHighlights(prizes = []) {
  if (!Array.isArray(prizes) || prizes.length === 0) {
    return renderEmptyState("Aucun prize", "La fenetre selectionnee ne remonte pas de prize detaille dans window-details.");
  }

  return prizes.map((prize) => `
    <article class="detail-item">
      <p class="detail-copy">${escapeHtml(prize)}</p>
    </article>
  `).join("");
}

function renderSummary() {
  const cards = state.data.summaryCards;
  const markup = cards.length
    ? cards.map((card) => `
        <article class="summary-card">
          <p class="eyebrow">${escapeHtml(card.label || "Bloc")}</p>
          <strong>${escapeHtml(card.value || "--")}</strong>
          <p class="summary-hint">${escapeHtml(card.hint || "")}</p>
        </article>
      `).join("")
    : renderEmptyState("Pas d'indicateur", "Le payload ne contient aucun bloc resume.");

  setHtml("summaryGrid", markup);
}

function renderEvents() {
  const markup = state.data.events.length
    ? state.data.events.map(renderEventButton).join("")
    : renderEmptyState("Aucun event", "Le calendrier local est vide.");

  setHtml("eventsList", markup);
}

function renderEventButton(event) {
  const selected = event.id === state.ui.selectedEventId ? "is-selected" : "";

  return `
    <button class="event-button ${selected}" type="button" data-event-id="${escapeHtml(event.id)}">
      <div class="event-item-top">
        <div>
          <h4>${escapeHtml(event.name || "Event")}</h4>
          <p class="event-meta">${escapeHtml(event.timeLabel || "--")} - ${escapeHtml(event.teamFormat || "--")} - ${escapeHtml(event.mode || "--")}</p>
        </div>
        <span class="${getStatusClass(event.status)}">${escapeHtml(event.statusLabel || "Archive")}</span>
      </div>
      <p class="event-summary">${escapeHtml(event.summary || "")}</p>
      <div class="event-stats">
        <span class="metric-pill">${escapeHtml(event.countdown || "--")}</span>
        <span class="metric-pill">${escapeHtml(String(event.trackedPlayers || 0))} joueur(s)</span>
        <span class="metric-pill">Best ${escapeHtml(event.bestRank || "--")}</span>
      </div>
    </button>
  `;
}

function renderPlayers() {
  const players = state.data.trackedPlayers;
  const markup = players.length
    ? players.map(renderPlayerCard).join("")
    : renderEmptyState("Roster vide", "Aucun joueur n'est present dans les donnees locales.");

  setHtml("playersGrid", markup);
}

function renderPlayerCard(player) {
  const avatar = player.image
    ? `<div class="avatar"><img src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name || "Player")}" /></div>`
    : `<div class="avatar"><div class="avatar-fallback">${escapeHtml(getInitials(player.name))}</div></div>`;
  const countryLine = [player.country, player.latestPlayedAtLabel].filter(Boolean).join(" - ");
  const countryFlag = player.countryFlag
    ? `<img class="country-flag" src="${escapeHtml(player.countryFlag)}" alt="${escapeHtml(player.country || "Flag")}" />`
    : "";

  return `
    <article class="player-card">
      <div class="player-head">
        <div class="player-header-main">
          ${avatar}
          <div>
            <h4 class="player-name">${escapeHtml(player.name || "Tracked player")}</h4>
            <div class="player-subtitle-row">
              ${countryFlag}
              <p class="player-subtitle">${escapeHtml(countryLine || "EU")}</p>
            </div>
          </div>
        </div>
        <span class="${getStatusClass(player.status)}">${escapeHtml(player.statusLabel || "Archive")}</span>
      </div>
      <div class="player-metrics">
        ${renderPlayerMetric("Last rank", player.latestRank || "--")}
        ${renderPlayerMetric("Best rank", player.bestRank || "--")}
        ${renderPlayerMetric("Points", String(player.latestPoints || 0))}
        ${renderPlayerMetric("Event", player.latestEventName || "--")}
      </div>
      <p class="player-summary">${escapeHtml(player.summary || "")}</p>
    </article>
  `;
}

function renderPlayerMetric(label, value) {
  return `
    <article class="player-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderResults() {
  if (state.data.recentResults.length === 0) {
    setHtml("resultsBody", `
      <tr>
        <td colspan="6">${renderEmptyState("Aucun resultat", "Les donnees locales ne contiennent pas encore de classement exploitable.")}</td>
      </tr>
    `);
    return;
  }

  setHtml("resultsBody", state.data.recentResults.map((result) => `
    <tr>
      <td><strong>${escapeHtml(result.playerName || "Player")}</strong></td>
      <td>${escapeHtml(result.eventName || "--")}</td>
      <td>${escapeHtml(result.rankLabel || "--")}</td>
      <td>${escapeHtml(String(result.points || 0))}</td>
      <td>${escapeHtml(String(result.kills || 0))}</td>
      <td>${escapeHtml(result.playedAtLabel || "--")}</td>
    </tr>
  `).join(""));
}

function renderActu() {
  const markup = state.data.actu.length
    ? state.data.actu.map(renderActuItem).join("")
    : renderEmptyState("Aucune actu", "Le fichier d'actu local est vide.");

  setHtml("actuList", markup);
}

function renderActuItem(item) {
  const media = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name || "Actu")}" />`
    : `<div class="avatar-fallback">ACTU</div>`;
  const link = item.link
    ? `<a class="actu-link" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">Voir le lien</a>`
    : "";

  return `
    <article class="actu-item">
      <div class="actu-media">${media}</div>
      <div>
        <h4>${escapeHtml(item.name || "Actu")}</h4>
        <p class="actu-date">${escapeHtml(item.dateLabel || "Date inconnue")}</p>
        <p class="actu-copy">${escapeHtml(item.description || "Sans description.")}</p>
        ${link}
      </div>
    </article>
  `;
}

function renderCasts() {
  const selectedEvent = getSelectedEvent();
  const activeCasts = getDisplayedCastsForSelectedEvent();

  if (activeCasts.length === 0) {
    setHtml("castList", renderEmptyState(
      "Aucun cast",
      selectedEvent ? "Aucun lien n'est configure pour cet event." : "Aucun lien n'est configure dans cast.json."
    ));
    return;
  }

  setHtml("castList", activeCasts.map((cast) => {
    const link = cast.link
      ? `<a class="cast-link" href="${escapeHtml(cast.link)}" target="_blank" rel="noreferrer">Ouvrir le lien</a>`
      : "";

    return `
      <article class="cast-item">
        <p class="eyebrow">${escapeHtml(cast.windowId ? cast.windowName || "Fenetre" : "Fallback global")}</p>
        <h4>${escapeHtml(cast.label || "Canal")}</h4>
        <p class="event-meta">${escapeHtml(cast.channelName || "Sans nom")}</p>
        <p class="cast-context">${escapeHtml(buildCastCardContext(cast))}</p>
        ${link}
      </article>
    `;
  }).join(""));
}

function renderNotes() {
  const markup = state.data.notes.length
    ? state.data.notes.map((note) => `<p class="note-item">${escapeHtml(note)}</p>`).join("")
    : renderEmptyState("Aucune note", "Le backend n'a remonte aucun contexte.");

  setHtml("notesList", markup);
}

function renderSources() {
  const markup = state.data.dataSources.length
    ? state.data.dataSources.map(renderSourceItem).join("")
    : renderEmptyState("Aucune source", "Le backend n'a remonte aucun fichier.");

  setHtml("sourcesList", markup);
}

function renderSourceItem(source) {
  const statusClass = source.exists ? "chip chip-source-ok" : "chip chip-source-missing";

  return `
    <article class="source-item">
      <div class="source-item-top">
        <div>
          <h4>${escapeHtml(source.label || "Source")}</h4>
          <p class="source-detail">${escapeHtml(source.detail || "")}</p>
        </div>
        <span class="${statusClass}">${escapeHtml(source.statusLabel || "--")}</span>
      </div>
      <span class="source-path">${escapeHtml(source.path || "--")}</span>
      <p class="source-detail">${escapeHtml(source.updatedAtLabel || "--")}</p>
    </article>
  `;
}

function renderTeamPlayersMarkup() {
  const players = asArray(state.settings.teamDraft.players);

  if (players.length === 0) {
    return renderEmptyState("Roster vide", "Ajoute au moins un joueur a suivre.");
  }

  return players.map((player, index) => `
    <article class="editor-item">
      <div class="editor-item-head">
        <p class="editor-item-title">Joueur ${index + 1}</p>
        <button class="button button-secondary compact-button" type="button" data-remove-player-index="${index}">Supprimer</button>
      </div>
      <div class="editor-grid editor-grid-player">
        ${renderTextField("Account ID", "player", index, "accountId", player.accountId)}
        ${renderTextField("Nom", "player", index, "name", player.name)}
        ${renderTextField("Image", "player", index, "image", player.image)}
        ${renderTextField("Pays", "player", index, "country", player.country)}
        ${renderTextField("Drapeau", "player", index, "countryFlag", player.countryFlag, "field-span-full")}
      </div>
    </article>
  `).join("");
}

function renderTournamentOptionsMarkup() {
  const acceptedIds = new Set(state.settings.tournamentFilterDraft.acceptedEventIds || []);
  const options = asArray(state.data.settings.eventOptions);
  const query = String(state.settings.tournamentFilterQuery || "").trim().toLowerCase();

  if (options.length === 0) {
    return renderEmptyState("Aucun eventId", "Aucun event n'est disponible pour construire le filtre.");
  }

  const filteredOptions = options.filter((option) => {
    if (!query) return true;

    return [option.name, option.eventId, ...asArray(option.modes)]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  if (filteredOptions.length === 0) {
    return renderEmptyState("Aucun resultat", "Aucun tournoi ne correspond a cette recherche.");
  }

  return filteredOptions.map((option) => {
    const checked = acceptedIds.has(option.eventId);
    const modes = option.modes?.length ? option.modes.join(", ") : "Mode inconnu";

    return `
      <label class="filter-option ${checked ? "is-active" : ""}">
        <input type="checkbox" data-filter-event-id="${escapeHtml(option.eventId)}" ${checked ? "checked" : ""} />
        <div>
          <p class="editor-item-title">${escapeHtml(option.name || option.eventId)}</p>
          <p class="filter-option-copy">${escapeHtml(option.eventId)}</p>
          <div class="filter-option-meta">
            <span class="pill-mini">${escapeHtml(modes)}</span>
            <span class="pill-mini">${escapeHtml(String(option.windows || 0))} fenetre(s)</span>
          </div>
        </div>
        <span class="${checked ? "chip chip-live" : "chip chip-review"}">${checked ? "Actif" : "Off"}</span>
      </label>
    `;
  }).join("");
}

function renderActuConfigMarkup() {
  const items = asArray(state.settings.actuDraft);

  if (items.length === 0) {
    return renderEmptyState("Aucune actu", "Ajoute une carte d'actu locale.");
  }

  return items.map((item, index) => `
    <article class="editor-item">
      <div class="editor-item-head">
        <p class="editor-item-title">${escapeHtml(item.name || `Actu ${index + 1}`)}</p>
        <button class="button button-secondary compact-button" type="button" data-remove-actu-index="${index}">Supprimer</button>
      </div>
      <div class="editor-grid editor-grid-actu">
        ${renderTextField("Nom", "actu", index, "name", item.name)}
        ${renderTextField("Date", "actu", index, "date", item.date, "", "date")}
        ${renderTextField("Image", "actu", index, "image", item.image, "field-span-full")}
        ${renderTextField("Lien", "actu", index, "link", item.link, "field-span-full")}
        <label class="stacked-field field-span-full">
          <span class="field-label">Description</span>
          <textarea data-actu-index="${index}" data-actu-field="description">${escapeHtml(item.description || "")}</textarea>
        </label>
      </div>
    </article>
  `).join("");
}

function renderTextField(label, prefix, index, field, value = "", extraClass = "", type = "text") {
  return `
    <label class="stacked-field ${extraClass}">
      <span class="field-label">${escapeHtml(label)}</span>
      <input type="${type}" data-${prefix}-index="${index}" data-${prefix}-field="${field}" value="${escapeHtml(value || "")}" />
    </label>
  `;
}

function renderCastWindowOptionsMarkup(options) {
  if (options.length === 0) {
    return `<option value="">Aucun windowId disponible</option>`;
  }

  return options.map((option) => {
    const label = [option.windowName, option.timeLabel].filter(Boolean).join(" - ");
    return `<option value="${escapeHtml(option.windowId || "")}">${escapeHtml(label || option.windowId || "Fallback global")}</option>`;
  }).join("");
}

function renderEmptyState(title, copy) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(copy)}</span>
    </div>
  `;
}

function renderStatus() {
  const target = $("statusMessage");
  if (!target) return;

  target.textContent = state.remote.error || state.remote.notice;
  target.className = `status-message ${state.remote.error ? "is-error" : "is-ok"}`;
}

function renderActionState() {
  const busy = state.remote.loading;
  const disabledIds = [
    "refreshButton",
    "cronButton",
    "logoutButton",
    "configRefreshButton",
    "configResetDraftsButton",
    "teamAddPlayerButton",
    "actuAddButton",
    "teamConfigResetButton",
    "tournamentFilterResetButton",
    "actuConfigResetButton",
    "castConfigResetButton"
  ];

  disabledIds.forEach((id) => setDisabled(id, busy));

  setText("refreshButton", busy ? "Chargement..." : "Rafraichir");
  setText("cronButton", busy ? "Lancement..." : "Lancer Cron");
  setText("configRefreshButton", busy ? "Chargement..." : "Rafraichir config");
  setText("logoutButton", "Se Deconnecter");

  Object.entries(CONFIG_SECTIONS).forEach(([section, config]) => {
    setDisabled(getConfigButtonIds(section).save, busy || !state.settings[config.dirty]);
  });
}

function syncSettingsStatus() {
  setText("teamConfigStatus", state.settings.teamDirty ? "Unsaved changes" : "Synced");
  setText("tournamentFilterStatus", state.settings.tournamentFilterDirty ? "Unsaved changes" : "Synced");
  setText("actuConfigStatus", state.settings.actuDirty ? "Unsaved changes" : "Synced");
  setText("castConfigStatus", state.settings.castDirty ? "Unsaved changes" : "Synced");
  setText("tournamentFilterCount", `${(state.settings.tournamentFilterDraft.acceptedEventIds || []).length} selectionne(s)`);
}

function selectEvent(eventId) {
  state.ui.selectedEventId = eventId;
  syncCastWindowSelectionToEvent(eventId);
  renderInfo();
  renderConfig();
}

function ensureSelectedEvent() {
  const events = state.data.events;

  if (!events.some((event) => event.id === state.ui.selectedEventId)) {
    state.ui.selectedEventId = state.data.featuredEventId || events[0]?.id || "";
  }
}

function getSelectedEvent() {
  return state.data.events.find((event) => event.id === state.ui.selectedEventId) || state.data.events[0] || null;
}

function markSettingsDirty(section) {
  const config = CONFIG_SECTIONS[section];
  if (!config) return;

  state.settings[config.dirty] = true;
  syncSettingsStatus();
  renderActionState();
}

function toggleAcceptedEventId(eventId, checked) {
  const ids = new Set(state.settings.tournamentFilterDraft.acceptedEventIds || []);

  checked ? ids.add(eventId) : ids.delete(eventId);

  state.settings.tournamentFilterDraft.acceptedEventIds = Array.from(ids).sort((left, right) => left.localeCompare(right));
}

function ensureCastWindowSelection(options = {}) {
  const { force = false } = options;
  const castWindowOptions = getCastWindowOptions();
  const availableWindowIds = new Set(castWindowOptions.map((option) => option.windowId));
  const currentSelection = state.settings.castSelectedWindowId;

  if (!force && availableWindowIds.has(currentSelection)) return;

  if (state.ui.selectedEventId && availableWindowIds.has(state.ui.selectedEventId)) {
    state.settings.castSelectedWindowId = state.ui.selectedEventId;
    return;
  }

  const configuredEntry = asArray(state.settings.castDraft.entries).find((entry) => {
    return entry.windowId && availableWindowIds.has(entry.windowId) && hasConfiguredCastEntry(entry);
  });

  state.settings.castSelectedWindowId = configuredEntry?.windowId || castWindowOptions[0]?.windowId || "";
}

function syncCastWindowSelectionToEvent(windowId) {
  if (getCastWindowOptions().some((option) => option.windowId === windowId)) {
    state.settings.castSelectedWindowId = windowId;
    return;
  }

  ensureCastWindowSelection({ force: true });
}

function getCastWindowOptions() {
  const baseOptions = cloneValue(asArray(state.data.settings.castWindowOptions));
  const hasFallbackEntry = asArray(state.settings.castDraft.entries).some((entry) => {
    return !entry.windowId && hasConfiguredCastEntry(entry);
  });

  if (!hasFallbackEntry) return baseOptions;

  return [
    {
      windowId: "",
      eventId: "",
      eventName: "",
      windowName: "Fallback global",
      mode: "",
      teamFormat: "",
      timeLabel: "Config legacy sans windowId",
      statusLabel: "Legacy"
    },
    ...baseOptions
  ];
}

function getSelectedCastEntry() {
  const selectedWindowId = state.settings.castSelectedWindowId || "";
  const entries = asArray(state.settings.castDraft.entries);

  return entries.find((entry) => (entry.windowId || "") === selectedWindowId) || createEmptyCastEntry(selectedWindowId);
}

function upsertCastDraftEntry(windowId) {
  if (!Array.isArray(state.settings.castDraft.entries)) {
    state.settings.castDraft.entries = [];
  }

  const normalizedWindowId = String(windowId || "").trim();
  let entry = state.settings.castDraft.entries.find((item) => (item.windowId || "") === normalizedWindowId);

  if (!entry) {
    entry = createEmptyCastEntry(normalizedWindowId);
    state.settings.castDraft.entries.push(entry);
  }

  return entry;
}

function getDisplayedCastsForSelectedEvent() {
  const exactCasts = state.data.casts.filter((cast) => cast.windowId === state.ui.selectedEventId);
  const fallbackCasts = state.data.casts.filter((cast) => !cast.windowId);

  if (exactCasts.length === 0) return fallbackCasts;

  const activeCasts = new Map();

  [...exactCasts, ...fallbackCasts].forEach((cast) => {
    const key = cast.platform || cast.label || cast.id;
    if (cast.windowId || !activeCasts.has(key)) activeCasts.set(key, cast);
  });

  return Array.from(activeCasts.values()).sort((left, right) => String(left.label || "").localeCompare(String(right.label || "")));
}

function buildCastWindowMeta(entry, options) {
  const selectedOption = options.find((option) => option.windowId === state.settings.castSelectedWindowId) || null;
  const activePlatforms = ["youtube", "twitch"].filter((platform) => {
    const channel = entry?.[platform];
    return Boolean(channel?.channelName || channel?.link);
  }).length;

  if (!selectedOption) {
    return "Selectionne un windowId pour configurer le cast.";
  }

  const summary = [selectedOption.eventId, selectedOption.mode, selectedOption.teamFormat, selectedOption.statusLabel]
    .filter(Boolean)
    .join(" - ");

  return summary
    ? `${summary} - ${activePlatforms} canal(aux) renseigne(s).`
    : `${activePlatforms} canal(aux) renseigne(s).`;
}

function buildCastCardContext(cast) {
  if (!cast.windowId) return "Lien fallback global";
  return [cast.eventId, cast.timeLabel].filter(Boolean).join(" - ") || cast.windowId;
}

function createEmptyTeamPlayer() {
  return {
    accountId: "",
    name: "",
    image: "",
    country: "",
    countryFlag: ""
  };
}

function createEmptyCastEntry(windowId = "") {
  return {
    windowId: String(windowId || "").trim(),
    youtube: { channelName: "", link: "" },
    twitch: { channelName: "", link: "" }
  };
}

function createEmptyActuItem() {
  return {
    id: `actu-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: "",
    image: "",
    date: "",
    dateLabel: "",
    description: "",
    link: ""
  };
}

function getConfigButtonIds(section) {
  if (section === "tournamentFilter") {
    return {
      reset: "tournamentFilterResetButton",
      save: "tournamentFilterSaveButton"
    };
  }

  return {
    reset: `${section}ConfigResetButton`,
    save: `${section}ConfigSaveButton`
  };
}

function setRemote(next) {
  Object.assign(state.remote, next);
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function setHtml(target, value) {
  const element = typeof target === "string" ? $(target) : target;
  if (element) element.innerHTML = value;
}

function setDisabled(id, value) {
  const element = $(id);
  if (element) element.disabled = value;
}

function setChip(id, value, className) {
  const element = $(id);
  if (!element) return;

  element.textContent = value;
  element.className = className;
}

function setImage(image, media, src, alt) {
  if (!image) return;

  if (src) {
    image.src = src;
    image.alt = alt;
    media?.classList.remove("is-empty");
    return;
  }

  image.removeAttribute("src");
  image.alt = "";
  media?.classList.add("is-empty");
}

function renderInputValue(id, value) {
  const input = $(id);
  if (input && input.value !== value) input.value = value;
}

function toggleClass(id, className, force) {
  const element = $(id);
  if (element) element.classList.toggle(className, force);
}

function getStatusClass(status) {
  if (status === "live") return "chip chip-live";
  if (status === "upcoming" || status === "recent") return "chip chip-upcoming";
  return "chip chip-review";
}

function formatGeneratedAt(value) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getInitials(value) {
  return String(value || "HV")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "HV";
}

function hasConfiguredCastEntry(entry) {
  return ["youtube", "twitch"].some((platform) => {
    const channel = entry?.[platform];
    return Boolean(channel?.channelName || channel?.link);
  });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value, fallback = {}) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function toKebab(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
