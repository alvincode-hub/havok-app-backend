const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath } = require("../storage/paths.js");
const { isInDelay } = require("../utils/dates.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");

async function enrichedCalendrier() {
  const tournaments = (await loadNormalizedData(normalizedTournamentsPath())) || [];
  const acceptedEventIds = await loadAcceptedEventIds();
  const enrichedTournaments = [];

  for (const tournament of tournaments) {
    if (!(await isEventAccepted(tournament.id, acceptedEventIds))) {
      continue;
    }

    const name = tournament.name || "Tournoi";
    const image = tournament.images?.square || null;

    for (const tournamentWindow of tournament.windows || []) {
      const tournamentName = `${name} ${getWindowSuffix(tournamentWindow.windowId)}`.trim();
      if (isInDelay(tournamentWindow.start)) {
        enrichedTournaments.push({
          tournamentId: tournament.id || null,
          windowId: tournamentWindow.windowId || null,
          name: tournamentName,
          image,
          start: tournamentWindow.start,
          end: tournamentWindow.end,
          teamFormat: tournamentWindow.teamFormat || null,
          mode: tournamentWindow.mode || null
        });
      }
    }
  }

  enrichedTournaments.sort((a, b) => new Date(a.start) - new Date(b.start));
  return enrichedTournaments;
}

module.exports = { enrichedCalendrier };
