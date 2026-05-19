const WINDOW_SUFFIXES = [
  "(Semaine 1 - Jour 1)",
  "(Semaine 1 - Jour 2)",
  "(Semaine 1 - Finale)",
  "(Semaine 2 - Jour 1)",
  "(Semaine 2 - Jour 2)",
  "(Semaine 2 - Finale)",
  "(Semaine 3 - Jour 1)",
  "(Semaine 3 - Jour 2)",
  "(Semaine 3 - Finale)",
  "(Semaine 4 - Jour 1)",
  "(Semaine 4 - Jour 2)",
  "(Semaine 4 - Finale)",
  "(Semaine 5 - Jour 1)",
  "(Semaine 5 - Jour 2)",
  "(Semaine 5 - Finale)",
  "(Lobby derniere chance)",
  "(Derniere chance)",
  "(Play-In Jour 1)",
  "(Play-In Jour 2)",
  "(Play-In)",
  "(Qualifications)",
  "(Finale)",
  "(Heat 1)",
  "(Heat 2)",
  "(Heat 3)",
  "(Heat 4)",
  "(Jour 1)",
  "(Jour 2)"
].sort((left, right) => right.length - left.length);

function getWindowSuffix(id = "") {
  if (id.includes("Week1Day1")) return "(Semaine 1 - Jour 1)";
  if (id.includes("Week1Day2")) return "(Semaine 1 - Jour 2)";
  if (id.includes("Week1Final")) return "(Semaine 1 - Finale)";

  if (id.includes("Week2Day1")) return "(Semaine 2 - Jour 1)";
  if (id.includes("Week2Day2")) return "(Semaine 2 - Jour 2)";
  if (id.includes("Week2Final")) return "(Semaine 2 - Finale)";

  if (id.includes("Week3Day1")) return "(Semaine 3 - Jour 1)";
  if (id.includes("Week3Day2")) return "(Semaine 3 - Jour 2)";
  if (id.includes("Week3Final")) return "(Semaine 3 - Finale)";

  if (id.includes("Week4Day1")) return "(Semaine 4 - Jour 1)";
  if (id.includes("Week4Day2")) return "(Semaine 4 - Jour 2)";
  if (id.includes("Week4Final")) return "(Semaine 4 - Finale)";

  if (id.includes("Week5Day1")) return "(Semaine 5 - Jour 1)";
  if (id.includes("Week5Day2")) return "(Semaine 5 - Jour 2)";
  if (id.includes("Week5Final")) return "(Semaine 5 - Finale)";

  if (id.includes("LastChanceQualifier")) return "(Derniere chance)";
  if (id.includes("LastChanceLobby")) return "(Lobby derniere chance)";

  if (id.includes("PlayInStage_Day1")) return "(Play-In Jour 1)";
  if (id.includes("PlayInStage_Day2")) return "(Play-In Jour 2)";
  if (id.includes("PlayInDay1")) return "(Play-In Jour 1)";
  if (id.includes("PlayInDay2")) return "(Play-In Jour 2)";
  if (id.includes("PlayIn")) return "(Play-In)";

  if (id.includes("Heat1")) return "(Heat 1)";
  if (id.includes("Heat2")) return "(Heat 2)";
  if (id.includes("Heat3")) return "(Heat 3)";
  if (id.includes("Heat4")) return "(Heat 4)";

  if (id.includes("Day1")) return "(Jour 1)";
  if (id.includes("Day2")) return "(Jour 2)";

  if (id.includes("Round1")) return "(Qualifications)";
  if (id.includes("Round2")) return "(Finale)";

  if (id.includes("Final")) return "(Finale)";

  return "";
}

function stripKnownWindowSuffix(name = "") {
  let nextName = String(name || "").trim();
  let didStrip = true;

  while (nextName && didStrip) {
    didStrip = false;

    for (const suffix of WINDOW_SUFFIXES) {
      if (!nextName.endsWith(suffix)) {
        continue;
      }

      nextName = nextName.slice(0, -suffix.length).trim();
      didStrip = true;
      break;
    }
  }

  return nextName;
}

module.exports = {
  getWindowSuffix,
  stripKnownWindowSuffix
};
