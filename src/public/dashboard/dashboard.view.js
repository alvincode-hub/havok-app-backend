import { CONFIG_SECTIONS } from "./dashboard.state.js";

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let state = null;

export function renderDashboard(nextState) {
  const focusSnapshot = captureFocusSnapshot();
  state = nextState;
  renderHeader();
  renderMode();
  renderInfo();
  renderConfig();
  renderStatus();
  renderActionState();
  restoreFocusSnapshot(focusSnapshot);
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

function getSelectedEvent() {
  return state.data.events.find((event) => event.id === state.ui.selectedEventId) || state.data.events[0] || null;
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

function createEmptyCastEntry(windowId = "") {
  return {
    windowId: String(windowId || "").trim(),
    youtube: { channelName: "", link: "" },
    twitch: { channelName: "", link: "" }
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

function captureFocusSnapshot() {
  const activeElement = document.activeElement;

  if (!(activeElement instanceof HTMLElement) || !activeElement.matches("input, textarea, select")) {
    return null;
  }

  const selector = buildElementSelector(activeElement);

  if (!selector) {
    return null;
  }

  const supportsSelection =
    typeof activeElement.selectionStart === "number" &&
    typeof activeElement.selectionEnd === "number";

  return {
    selector,
    selectionStart: supportsSelection ? activeElement.selectionStart : null,
    selectionEnd: supportsSelection ? activeElement.selectionEnd : null,
    selectionDirection: supportsSelection ? activeElement.selectionDirection : null
  };
}

function restoreFocusSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  const nextElement = document.querySelector(snapshot.selector);

  if (!(nextElement instanceof HTMLElement) || nextElement === document.activeElement || nextElement.disabled) {
    return;
  }

  nextElement.focus({ preventScroll: true });

  if (
    typeof nextElement.setSelectionRange === "function" &&
    snapshot.selectionStart !== null &&
    snapshot.selectionEnd !== null
  ) {
    nextElement.setSelectionRange(
      snapshot.selectionStart,
      snapshot.selectionEnd,
      snapshot.selectionDirection || "none"
    );
  }
}

function buildElementSelector(element) {
  if (element.id) {
    return `#${escapeSelector(element.id)}`;
  }

  const datasetEntries = Object.entries(element.dataset);

  if (datasetEntries.length === 0) {
    return null;
  }

  const tagName = element.tagName.toLowerCase();
  const dataSelector = datasetEntries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => {
      const attributeName = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return `[data-${attributeName}="${escapeSelector(value)}"]`;
    })
    .join("");

  return `${tagName}${dataSelector}`;
}

function escapeSelector(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(String(value));
  }

  return String(value).replace(/["\\]/g, "\\$&");
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

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
