// meta/quests.js — 任务全家桶：每日/每周任务 + 月更战令（spec 10.3）
// 纯数据+纯函数；刷新由 core 跨日 tick 调 touchQuests 驱动；进度上报 reportQuest
import { todayStr } from './save.js';

export const PASS_LEVEL_EXP = 100;
export const PASS_MAX_LEVEL = 30;
export const DAILY_CLAIM_EXP = 20;
export const WEEKLY_CLAIM_EXP = 60;

// 事件口径：battle_win / ad_watch / gacha / merge / ult / boss_kill / stamina_spend
export const DAILY_QUESTS = [
  { id: 'd_win',     name: '通关任意 1 局',   event: 'battle_win',     goal: 1,  reward: { diamonds: 30 } },
  { id: 'd_ad',      name: '观看广告 2 次',   event: 'ad_watch',       goal: 2,  reward: { diamonds: 20 } },
  { id: 'd_gacha',   name: '招募武将 3 次',   event: 'gacha',          goal: 3,  reward: { diamonds: 30 } },
  { id: 'd_merge',   name: '合成锦囊 5 次',   event: 'merge',          goal: 5,  reward: { coins: 200 } },
  { id: 'd_ult',     name: '释放大招 3 次',   event: 'ult',            goal: 3,  reward: { diamonds: 20 } },
  { id: 'd_stamina', name: '消耗体力 30 点', event: 'stamina_spend',  goal: 30, reward: { coins: 300 } },
];
export const WEEKLY_QUESTS = [
  { id: 'w_win',   name: '通关 15 局',     event: 'battle_win', goal: 15, reward: { diamonds: 80 } },
  { id: 'w_gacha', name: '招募武将 15 次', event: 'gacha',      goal: 15, reward: { diamonds: 60 } },
  { id: 'w_merge', name: '合成锦囊 30 次', event: 'merge',      goal: 30, reward: { coins: 800 } },
  { id: 'w_boss',  name: '击败主将 10 名', event: 'boss_kill',  goal: 10, reward: { diamonds: 60 } },
];

// 战令奖励：免费轨 ◆50/铜钱500 交替；付费轨 ◆100（逢 5 级 ◆150）——mockup 定稿微调无新道具
export function passReward(level, track) {
  if (track === 'free') return level % 2 === 1 ? { diamonds: 50 } : { coins: 500 };
  return { diamonds: level % 5 === 0 ? 150 : 100 };
}

function mondayStr(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;           // 周一=0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}
export function weekIdOf(now = new Date()) { return mondayStr(now); }
export function seasonIdOf(now = new Date()) { return now.toISOString().slice(0, 7); }

export function touchQuests(save, { now = new Date() } = {}) {
  if (!save.quests) {
    save.quests = {
      daily: { date: '', progress: {}, claimed: [] },
      weekly: { weekId: '', progress: {}, claimed: [] },
      pass: { seasonId: '', exp: 0, claimedFree: [], claimedPaid: [] },
    };
  }
  const q = save.quests;
  const t = now.toISOString().slice(0, 10);
  if (q.daily.date !== t) q.daily = { date: t, progress: {}, claimed: [] };
  const w = weekIdOf(now);
  if (q.weekly.weekId !== w) q.weekly = { weekId: w, progress: {}, claimed: [] };
  const s = seasonIdOf(now);
  if (q.pass.seasonId !== s) q.pass = { seasonId: s, exp: 0, claimedFree: [], claimedPaid: [] };
}

export function questsOf(save) { return save.quests; }

function bump(progress, event, n, table) {
  for (const q of table) {
    if (q.event !== event) continue;
    progress[q.event] = Math.min(q.goal, (progress[q.event] || 0) + n);
  }
}

export function reportQuest(save, event, n = 1) {
  if (!save.quests) return;
  bump(save.quests.daily.progress, event, n, DAILY_QUESTS);
  bump(save.quests.weekly.progress, event, n, WEEKLY_QUESTS);
}

export function questClaimable(save, tab, taskId) {
  const q = tab === 'daily' ? save.quests.daily : save.quests.weekly;
  const def = (tab === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS).find((x) => x.id === taskId);
  return !!def && !q.claimed.includes(taskId) && (q.progress[def.event] || 0) >= def.goal;
}

// 红点统一口径：每日/每周任一任务可领（core 与 home 共用，禁止各自实现）
export function anyClaimable(save) {
  if (!save.quests) return false;
  return [...DAILY_QUESTS, ...WEEKLY_QUESTS].some((d) =>
    questClaimable(save, d.id.startsWith('d_') ? 'daily' : 'weekly', d.id));
}

function grant(save, reward) {
  if (reward.diamonds) save.wallet.diamonds += reward.diamonds;
  if (reward.coins) save.wallet.coins += reward.coins;
}

export function claimQuest(save, tab, taskId) {
  if (!questClaimable(save, tab, taskId)) return { ok: false };
  const q = tab === 'daily' ? save.quests.daily : save.quests.weekly;
  const def = (tab === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS).find((x) => x.id === taskId);
  q.claimed.push(taskId);
  grant(save, def.reward);
  save.quests.pass.exp = Math.min(PASS_MAX_LEVEL * PASS_LEVEL_EXP,
    save.quests.pass.exp + (tab === 'daily' ? DAILY_CLAIM_EXP : WEEKLY_CLAIM_EXP));
  return { ok: true, reward: def.reward };
}

export function passLevel(save) {
  return Math.min(PASS_MAX_LEVEL, Math.floor((save.quests?.pass?.exp || 0) / PASS_LEVEL_EXP));
}
export function passExp(save) { return save.quests?.pass?.exp || 0; }

export function claimPass(save, track, level) {
  const p = save.quests.pass;
  const key = track === 'free' ? 'claimedFree' : 'claimedPaid';
  if (track === 'paid' && !save.iap.pass) return { ok: false, reason: 'locked' };
  if (level > passLevel(save)) return { ok: false, reason: 'level' };
  if (p[key].includes(level)) return { ok: false, reason: 'claimed' };
  p[key].push(level);
  const reward = passReward(level, track);
  grant(save, reward);
  return { ok: true, reward };
}
