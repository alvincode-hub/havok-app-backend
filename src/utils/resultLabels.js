const LABEL = {
  ecomm_true: "Cash",
  ecomm_false: "Pas Cash",
  token_true: "Qual",
  token_false: "Pas Qual"
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
  const rewardStatuses = new Map();

  for (const prize of prizes) {
    if (isAutomaticQualificationPrize(prize)) {
      continue;
    }

    const qualifies = isPrizeQualified(prize, { points, rank });

    if (qualifies === null) {
      continue;
    }

    if (!LABEL[`${prize.rewardType}_true`] || !LABEL[`${prize.rewardType}_false`]) {
      continue;
    }

    const currentStatus = rewardStatuses.get(prize.rewardType);

    rewardStatuses.set(prize.rewardType, Boolean(currentStatus || qualifies));
  }

  const labels = [];

  for (const [rewardType, qualifies] of rewardStatuses) {
    const label = LABEL[`${rewardType}_${qualifies}`] || null;

    if (label) {
      labels.push(label);
    }
  }

  return labels;
}

function isPrizeQualified(prize, result) {
  if (prize?.scoringType === "rank" && result.rank !== null) {
    return result.rank <= prize.threshold;
  }

  if (prize?.scoringType === "value" && result.points !== null) {
    return result.points >= prize.threshold;
  }

  return null;
}

function isAutomaticQualificationPrize(prize) {
  return (
    prize?.rewardType === "token" &&
    prize?.scoringType === "value" &&
    Number(prize?.threshold) === 0
  );
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
