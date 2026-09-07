const TIERS = {
  IRON: 0, BRONZE: 400, SILVER: 800, GOLD: 1200,
  PLATINUM: 1600, EMERALD: 2000, DIAMOND: 2400
};
const RANKS = { IV: 0, III: 100, II: 200, I: 300 };

function calculateAbsoluteLp(entry) {
  if (!entry) return 0;
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(entry.tier)) {
    return 2800 + entry.leaguePoints;
  }
  return (TIERS[entry.tier] || 0) + (RANKS[entry.rank] || 0) + entry.leaguePoints;
}

function getRankFromAbsLp(absLp) {
  if (absLp <= 0) return 'NON CLASSÉ';
  if (absLp >= 2800) return `MASTER+ (${Math.floor(absLp - 2800)} LP)`;
  
  const tiers = ['FER', 'BRONZE', 'ARGENT', 'OR', 'PLATINE', 'ÉMERAUDE', 'DIAMANT'];
  const tierIdx = Math.floor(absLp / 400);
  const tierName = tiers[tierIdx] || 'INCONNU';
  
  const remainder = absLp % 400;
  const divisions = ['IV', 'III', 'II', 'I'];
  const divIdx = Math.floor(remainder / 100);
  const lp = Math.floor(remainder % 100);
  
  return `${tierName} ${divisions[divIdx]} - ${lp} LP`;
}

module.exports = { calculateAbsoluteLp, getRankFromAbsLp };