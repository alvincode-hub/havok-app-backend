const LABEL = {
  ecomm_true: "Cash",
  token_true: "Qual",
};

function enrichResult(result, window) {
  if (!result) {
    return null;
  }

  return {
    ...result,
    labels: getResultLabels(result, window),
    rankLabel: getRankLabel(result?.rank),
    pointsLabel: getPointsLabel(result?.points)
  };
}

function getResultLabels(result, window) {
  if (!result) {
    return [];
  }

  const prizes = window?.prizes || [];
  const points = typeof result?.points === "number" ? result.points : null;
  const rank = typeof result?.rank === "number" ? result.rank : null;
  const hasCompetitiveResult =
    (typeof points === "number" && points > 0) ||
    (typeof rank === "number" && rank > 0);
  const labels = new Set();

  for (const prize of prizes) {
    let key = "";

    if (
      prize.rewardType === "token" &&
      prize.scoringType === "value" &&
      Number(prize.threshold) === 0 &&
      !hasCompetitiveResult
    ) {
      continue;
    }

    if (prize.scoringType === "rank" && rank !== null) {
      key = `${prize.rewardType}_${rank <= prize.threshold}`;
    } else if (prize.scoringType === "value" && points !== null) {
      key = `${prize.rewardType}_${points >= prize.threshold}`;
    } else if (prize.scoringType === "percentile") {
      continue;
    }

    const label = LABEL[key] || null;

    if (label) {
      labels.add(label);
    }
  }

  return [...labels];
}

function getRankLabel(rank) {
  return typeof rank === "number" ? `#${rank}` : null;
}

function getPointsLabel(points) {
  return typeof points === "number" ? `${points} pts` : null;
}

module.exports = {
  enrichResult,
  getResultLabels,
  getRankLabel,
  getPointsLabel
};
