// src/meta/achievements.js — M7 功勋：18 项四类，进度由 save 派生（spec 11.3）

// stat 取值：kills/wins/coinsEarned/dailyWins/gachaCount（save.stats）
//          collected（拥有英雄数）/ maxStar（最高星级）/ totalStar（总星级）
//          endlessBest / bossBest（save.progress）
export const ACHIEVEMENTS = [
  { id: 'k1', cat: '战斗', name: '千军辟易·千', stat: 'kills', goal: 1000, reward: { diamonds: 30 } },
  { id: 'k2', cat: '战斗', name: '千军辟易·万', stat: 'kills', goal: 10000, reward: { diamonds: 100 } },
  { id: 'w1', cat: '战斗', name: '百战功成·十', stat: 'wins', goal: 10, reward: { diamonds: 30 } },
  { id: 'w2', cat: '战斗', name: '百战功成·五十', stat: 'wins', goal: 50, reward: { diamonds: 100 } },
  { id: 'c1', cat: '养成', name: '广纳贤士·四', stat: 'collected', goal: 4, reward: { diamonds: 30 } },
  { id: 'c2', cat: '养成', name: '广纳贤士·八', stat: 'collected', goal: 8, reward: { diamonds: 80 } },
  { id: 's1', cat: '养成', name: '神威天将·三星', stat: 'maxStar', goal: 3, reward: { diamonds: 30 } },
  { id: 's2', cat: '养成', name: '神威天将·五星', stat: 'maxStar', goal: 5, reward: { diamonds: 80 } },
  { id: 't1', cat: '养成', name: '将星璀璨·二十', stat: 'totalStar', goal: 20, reward: { diamonds: 40 } },
  { id: 't2', cat: '养成', name: '将星璀璨·四十', stat: 'totalStar', goal: 40, reward: { diamonds: 100 } },
  { id: 'e1', cat: '终局', name: '无尽征途·二十波', stat: 'endlessBest', goal: 20, reward: { diamonds: 40 } },
  { id: 'e2', cat: '终局', name: '无尽征途·四十波', stat: 'endlessBest', goal: 40, reward: { diamonds: 100 } },
  { id: 'd1', cat: '终局', name: '日行一善·三次', stat: 'dailyWins', goal: 3, reward: { diamonds: 30 } },
  { id: 'd2', cat: '终局', name: '日行一善·十次', stat: 'dailyWins', goal: 10, reward: { diamonds: 80 } },
  { id: 'b1', cat: '终局', name: '万夫莫开·五帅', stat: 'bossBest', goal: 5, reward: { diamonds: 40 } },
  { id: 'b2', cat: '终局', name: '万夫莫开·十帅', stat: 'bossBest', goal: 10, reward: { diamonds: 100 } },
  { id: 'f1', cat: '财富', name: '富甲一方·五万', stat: 'coinsEarned', goal: 50000, reward: { diamonds: 30 } },
  { id: 'f2', cat: '财富', name: '富甲一方·二十万', stat: 'coinsEarned', goal: 200000, reward: { diamonds: 100 } },
];

function statValue(save, stat) {
  if (stat === 'collected') return Object.values(save.heroes).filter((h) => h.owned).length;
  if (stat === 'maxStar') return Math.max(...Object.values(save.heroes).map((h) => h.stars || 1));
  if (stat === 'totalStar') return Object.values(save.heroes).reduce((n, h) => n + (h.owned ? h.stars || 1 : 0), 0);
  if (stat === 'endlessBest') return save.progress.endlessBest || 0;
  if (stat === 'bossBest') return save.progress.bossBest || 0;
  return save.stats[stat] || 0;
}

export function achvProgress(save, a) { return statValue(save, a.stat); }

export function achvClaimable(save, a) {
  return !save.achievements.claimed.includes(a.id) && achvProgress(save, a) >= a.goal;
}

export function claimAchv(save, a) {
  if (!achvClaimable(save, a)) return false;
  save.achievements.claimed.push(a.id);
  save.wallet.diamonds += a.reward.diamonds;
  return true;
}

export function anyAchvClaimable(save) {
  return ACHIEVEMENTS.some((a) => achvClaimable(save, a));
}
