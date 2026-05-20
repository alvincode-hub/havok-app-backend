const { loadNormalizedData } = require("../storage/normalizedStore.js");
const { normalizedTournamentsPath } = require("../storage/paths.js");
const { loadAcceptedEventIds, isEventAccepted } = require("../services/filterEvents.js");
const { getWindowSuffix } = require("../utils/windowSuffix.js");
const { isInDelay } = require("../utils/dates.js");

async function enrichedWindowList() {
  const acceptedEventIds = await loadAcceptedEventIds();
  const tournamentList = await loadNormalizedData(normalizedTournamentsPath());

  const enrichedTournamentsList = await Promise.all(
    tournamentList.map(async (event) => {
      const isAccepted = await isEventAccepted(event.id, acceptedEventIds);

      if (!isAccepted) {
        return null;
      }

      const windows = event.windows
        .filter(window => isInDelay(window.start))
        .map(window => {
          const tournamentName =
            `${event.name} ${getWindowSuffix(window.windowId)}`.trim();

          return {
            windowId: window.windowId,
            start: window.start,
            end: window.end,
            name: tournamentName
          };
        });

      return {
        id: event.id,
        windows
      };
    })
  );

  return enrichedTournamentsList.filter(Boolean);
}


module.exports = { enrichedWindowList }