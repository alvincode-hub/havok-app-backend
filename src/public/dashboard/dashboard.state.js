export const CONFIG_SECTIONS = {
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

export function createDashboardState() {
  const emptyPayload = createEmptyPayload();

  return {
    ui: {
      mode: "info",
      selectedEventId: ""
    },
    remote: {
      loading: false,
      notice: "Chargement du dashboard...",
      error: ""
    },
    data: emptyPayload,
    settings: {
      teamDraft: cloneValue(emptyPayload.settings.teamConfig),
      tournamentFilterDraft: cloneValue(emptyPayload.settings.tournamentFilter),
      tournamentFilterQuery: "",
      actuDraft: [],
      castDraft: cloneValue(emptyPayload.settings.castConfig),
      castSelectedWindowId: "",
      teamDirty: false,
      tournamentFilterDirty: false,
      actuDirty: false,
      castDirty: false
    }
  };
}

export function createEmptyPayload() {
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

export function buildDashboardPayload(resources = {}) {
  const empty = createEmptyPayload();
  const overview = asObject(resources.overview);
  const content = asObject(resources.content);
  const events = asObject(resources.events);

  return normalizePayload({
    meta: overview.meta || empty.meta,
    header: overview.header || empty.header,
    featuredEventId: overview.featuredEventId || empty.featuredEventId,
    events: asArray(events.items),
    trackedPlayers: asArray(content.trackedPlayers),
    recentResults: asArray(content.recentResults),
    actu: asArray(content.actu),
    casts: asArray(content.casts),
    dataSources: asArray(overview.dataSources),
    summaryCards: asArray(overview.summaryCards),
    settings: asObject(resources.config, empty.settings),
    notes: asArray(overview.notes)
  });
}

export function normalizePayload(payload = {}) {
  const empty = createEmptyPayload();
  const settings = asObject(payload.settings);

  return {
    meta: asObject(payload.meta, empty.meta),
    header: asObject(payload.header, empty.header),
    featuredEventId: normalizeString(payload.featuredEventId),
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

export function hydrateSettingsState(state, options = {}) {
  const { force = false } = options;

  Object.values(CONFIG_SECTIONS).forEach((config) => {
    if (force || !state.settings[config.dirty]) {
      state.settings[config.draft] = cloneValue(state.data.settings[config.dataKey]);
      state.settings[config.dirty] = false;
    }
  });

  ensureCastWindowSelection(state, { force });
}

export function resetConfigDraft(state, section) {
  const config = CONFIG_SECTIONS[section];

  if (!config) {
    return;
  }

  state.settings[config.draft] = cloneValue(state.data.settings[config.dataKey]);
  state.settings[config.dirty] = false;

  if (section === "cast") {
    ensureCastWindowSelection(state, { force: true });
  }
}

export function markSettingsDirty(state, section) {
  const config = CONFIG_SECTIONS[section];

  if (!config) {
    return;
  }

  state.settings[config.dirty] = true;
}

export function ensureSelectedEvent(state) {
  const events = asArray(state.data.events);

  if (!events.some((event) => event.id === state.ui.selectedEventId)) {
    state.ui.selectedEventId = state.data.featuredEventId || events[0]?.id || "";
  }
}

export function toggleAcceptedEventId(state, eventId, checked) {
  const ids = new Set(asArray(state.settings.tournamentFilterDraft.acceptedEventIds));

  if (checked) {
    ids.add(eventId);
  } else {
    ids.delete(eventId);
  }

  state.settings.tournamentFilterDraft.acceptedEventIds = Array.from(ids).sort((left, right) => left.localeCompare(right));
}

export function ensureCastWindowSelection(state, options = {}) {
  const { force = false } = options;
  const castWindowOptions = getCastWindowOptions(state);
  const availableWindowIds = new Set(castWindowOptions.map((option) => option.windowId));
  const currentSelection = state.settings.castSelectedWindowId;

  if (!force && availableWindowIds.has(currentSelection)) {
    return;
  }

  if (state.ui.selectedEventId && availableWindowIds.has(state.ui.selectedEventId)) {
    state.settings.castSelectedWindowId = state.ui.selectedEventId;
    return;
  }

  const configuredEntry = asArray(state.settings.castDraft.entries).find((entry) => {
    return entry.windowId && availableWindowIds.has(entry.windowId) && hasConfiguredCastEntry(entry);
  });

  state.settings.castSelectedWindowId = configuredEntry?.windowId || castWindowOptions[0]?.windowId || "";
}

export function syncCastWindowSelectionToEvent(state, windowId) {
  if (getCastWindowOptions(state).some((option) => option.windowId === windowId)) {
    state.settings.castSelectedWindowId = windowId;
    return;
  }

  ensureCastWindowSelection(state, { force: true });
}

export function getCastWindowOptions(state) {
  const baseOptions = cloneValue(asArray(state.data.settings.castWindowOptions));
  const hasFallbackEntry = asArray(state.settings.castDraft.entries).some((entry) => {
    return !entry.windowId && hasConfiguredCastEntry(entry);
  });

  if (!hasFallbackEntry) {
    return baseOptions;
  }

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

export function getSelectedCastEntry(state) {
  const selectedWindowId = state.settings.castSelectedWindowId || "";
  const entries = asArray(state.settings.castDraft.entries);

  return entries.find((entry) => (entry.windowId || "") === selectedWindowId) || createEmptyCastEntry(selectedWindowId);
}

export function upsertCastDraftEntry(state, windowId) {
  if (!Array.isArray(state.settings.castDraft.entries)) {
    state.settings.castDraft.entries = [];
  }

  const normalizedWindowId = normalizeString(windowId);
  let entry = state.settings.castDraft.entries.find((item) => (item.windowId || "") === normalizedWindowId);

  if (!entry) {
    entry = createEmptyCastEntry(normalizedWindowId);
    state.settings.castDraft.entries.push(entry);
  }

  return entry;
}

export function createEmptyTeamPlayer() {
  return {
    accountId: "",
    name: "",
    image: "",
    country: "",
    countryFlag: ""
  };
}

export function createEmptyCastEntry(windowId = "") {
  return {
    windowId: normalizeString(windowId),
    youtube: { channelName: "", link: "" },
    twitch: { channelName: "", link: "" }
  };
}

export function createEmptyActuItem() {
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

export function getConfigButtonIds(section) {
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

export function setRemote(state, nextRemoteState) {
  Object.assign(state.remote, nextRemoteState);
}

export function hasConfiguredCastEntry(entry) {
  return ["youtube", "twitch"].some((platform) => {
    const channel = entry?.[platform];
    return Boolean(channel?.channelName || channel?.link);
  });
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function asObject(value, fallback = {}) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

export function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function toKebab(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}
