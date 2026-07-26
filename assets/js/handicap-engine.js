/**
 * Pure scoring and handicap calculations.
 * This module deliberately contains no DOM, storage or network code.
 */

export const HANDICAP_RULES = Object.freeze({
  minimumPlayers: 4,
  countedSeasonRounds: 5,
  adjustmentFloor: -3,
  adjustmentCeiling: 2
});

export function calculateRoundAverage(scores) {
  const valid = scores.filter(Number.isFinite);
  if (valid.length < HANDICAP_RULES.minimumPlayers) {
    throw new Error("Minimum 4 players required for handicap calculation");
  }

  const trimmed = [...valid].sort((a, b) => a - b);
  const included = trimmed.length > 4 ? trimmed.slice(1, -1) : trimmed;
  return Math.round(included.reduce((sum, score) => sum + score, 0) / included.length);
}

export function calculateBaseAdjustment(score, average) {
  const diff = score - average;
  if (diff >= 10) return -4;
  if (diff >= 8) return -3;
  if (diff >= 6) return -2;
  if (diff >= 4) return -1;
  if (diff >= 2) return -0.5;
  if (diff >= -1) return 0;
  if (diff >= -3) return 0.5;
  if (diff >= -5) return 1;
  if (diff >= -7) return 2;
  if (diff >= -9) return 3;
  return 4;
}

export function handicapMultiplier(handicap) {
  if (handicap <= 9) return 0.5;
  if (handicap <= 18) return 0.75;
  if (handicap <= 28) return 1;
  return 1.25;
}

export function calculateHandicapResult({ handicap, points, average }) {
  if (!Number.isFinite(handicap) || handicap < 0) throw new Error("Handicap must be zero or greater");
  if (!Number.isFinite(points) || points < 0) throw new Error("Points must be zero or greater");

  if (points === 0) {
    return { dnp: true, adjustment: null, nextHandicap: handicap, countedScore: null };
  }

  const raw = calculateBaseAdjustment(points, average) * handicapMultiplier(handicap);
  const rounded = Math.round(raw);
  const adjustment = Math.max(HANDICAP_RULES.adjustmentFloor, Math.min(HANDICAP_RULES.adjustmentCeiling, rounded));

  return {
    dnp: false,
    adjustment,
    nextHandicap: Math.max(0, handicap + adjustment),
    countedScore: points
  };
}

export function calculateSeasonTotal(scores) {
  return scores
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, HANDICAP_RULES.countedSeasonRounds)
    .reduce((sum, score) => sum + score, 0);
}

export function calculatePlayerStatistics(player, rounds, achievements = []) {
  const results = rounds
    .map(round => round.results.find(result => result.playerId === player.id))
    .filter(result => result && Number.isFinite(result.points));

  const scores = results.map(result => result.points);
  const playerAchievements = achievements.filter(item => item.playerId === player.id);
  const count = type => playerAchievements.filter(item => item.type === type).length;

  return {
    currentHandicap: player.currentHandicap,
    average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    best: scores.length ? Math.max(...scores) : null,
    worst: scores.length ? Math.min(...scores) : null,
    roundsPlayed: scores.length,
    wins: count("win"),
    runnerUps: count("runnerUp"),
    thirds: count("third"),
    nearestPin: count("nearestPin"),
    longestDrive: count("longestDrive"),
    seasonPoints: calculateSeasonTotal(scores)
  };
}

export function rankPlayers(players, rounds, achievements = []) {
  return players
    .map(player => {
      const statistics = calculatePlayerStatistics(player, rounds, achievements);
      return { ...player, statistics };
    })
    .sort((a, b) =>
      b.statistics.seasonPoints - a.statistics.seasonPoints ||
      b.statistics.wins - a.statistics.wins ||
      a.name.localeCompare(b.name)
    )
    .map((player, index) => ({ ...player, position: index + 1 }));
}
