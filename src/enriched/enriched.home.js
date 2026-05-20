const { isDateLive, isDateSoon } = require("../utils/dates.js");
const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { loadConfigData } = require("../storage/configStore.js");
const { normalizedTournamentsPath } = require("../storage/paths.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");
const { findPlayersTop } = require("../services/findPlayersTop.js");
const fs = require("fs");
const path = require("path");

async function enrichHome() {
  const actuPath = path.join(__dirname, "../../data/normalized/actu/actu.json");
  const actu = fs.existsSync(actuPath) && fs.statSync(actuPath).size > 0
    ? (await loadNormalizedData("normalized/actu/actu.json")) || []
    : [];
  const tournaments = (await loadNormalizedData(normalizedTournamentsPath())) || [];
  const acceptedEventIds = await loadAcceptedEventIds();

  const liveTournaments = [];
  let upcomingTournaments = [];

  for (const tournament of tournaments) {
    if (!(await isEventAccepted(tournament.id, acceptedEventIds))) {
      continue;
    }

    const name = tournament.name || "tournament";
    const image = tournament.images?.square || null;

    for (const tournamentWindow of tournament.windows || []) {
      const tournamentName = `${name} ${getWindowSuffix(tournamentWindow.windowId)}`.trim();

      if (isDateLive(tournamentWindow.start, tournamentWindow.end)) {
        liveTournaments.push({
          tournamentName,
          tournamentId: tournament.id || null,
          windowId: tournamentWindow.windowId,
          image,
          start: tournamentWindow.start,
          end: tournamentWindow.end,
          teamFormat: tournamentWindow.teamFormat || null,
          gameMode: tournamentWindow.mode || null,
        });
      }

      if (!isDateLive(tournamentWindow.start, tournamentWindow.end) && isDateSoon(tournamentWindow.start)) {
        upcomingTournaments.push({
          tournamentName,
          tournamentId: tournament.id || null,
          windowId: tournamentWindow.windowId,
          image,
          start: tournamentWindow.start,
          end: tournamentWindow.end,
          teamFormat: tournamentWindow.teamFormat || null,
          gameMode: tournamentWindow.mode || null,
        });
      }
    }
  }

  upcomingTournaments.sort((a, b) => new Date(a.start) - new Date(b.start));
  upcomingTournaments = upcomingTournaments.slice(0, 5);

  const lastPlayedWindow = await findLastPlayedWindow(tournaments, acceptedEventIds);

  return {
    actu,
    liveTournament: liveTournaments[0] || null,
    upcomingTournaments,
    lastPlayedWindow
  };
}

async function findLastPlayedWindow(events, acceptedEventIds, now = new Date()) {
  const allWindows = [];

  for (const event of events || []) {
    if (!(await isEventAccepted(event.id, acceptedEventIds))) {
      continue;
    }

    const eventName = event.name || "tournament";
    const image = event.images?.square || null;

    for (const tournamentWindow of event.windows || []) {
      const endDate = new Date(tournamentWindow.end);

      if (endDate <= now) {
        allWindows.push({
          tournament: {
            tournamentId: event.id || null,
            windowId: tournamentWindow.windowId || null,
            tournamentName: `${eventName} ${getWindowSuffix(tournamentWindow.windowId)}`.trim(),
            image,
            start: tournamentWindow.start,
            end: tournamentWindow.end,
            teamFormat: tournamentWindow.teamFormat || null,
            gameMode: tournamentWindow.mode || null
          },
          tournamentWindow
        });
      }
    }
  }

  allWindows.sort((a, b) => new Date(b.tournament.end) - new Date(a.tournament.end));

  const lastWindowEntry = allWindows[0] || null;

  if (!lastWindowEntry) {
    return null;
  }

  const { tournament: lastWindow, tournamentWindow } = lastWindowEntry;

  const playerConfig = await loadConfigData("config/team.json");

  if (!playerConfig?.players || playerConfig.players.length === 0) {
    return {
      tournament: lastWindow,
      places: []
    };
  }

  const playerIds = playerConfig.players.map((player) => {
    return player.accountId;
  });
  const playerResults = await findPlayersTop(playerIds, tournamentWindow);
  const places = playerConfig.players.flatMap((player, index) => {
    const result = playerResults[index] || null;

    if (!result) {
      return [];
    }

    return [{
      accountId: player.accountId,
      name: player.name,
      result
    }];
  });

  return {
    tournament: lastWindow,
    places: places
  };
}

module.exports = { enrichHome };
