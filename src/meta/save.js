// src/meta/save.js — 局外存档：localStorage / wx.setStorageSync 同构适配
// 结构（spec 第七章 + M5 扩展）：{ v, wallet, heroes, progress, daily, iap, cosmetics }
const KEY = 'qqc_save_v1';

export function defaultIap() {
  return { firstCharge: false, monthly: false, monthlyLastClaim: '', pass: false, fund: false, fundChapters: [] };
}

export function defaultSave() {
  return {
    v: 1,
    wallet: { coins: 500, diamonds: 300, stamina: 60, staminaTs: 0 },
    heroes: {
      zhaoyun: { owned: true, stars: 1, level: 1, frags: 0 },
      guanyu: { owned: false, stars: 1, level: 1, frags: 0 },
      zhangfei: { owned: false, stars: 1, level: 1, frags: 0 },
      zhugeliang: { owned: false, stars: 1, level: 1, frags: 0 },
      machao: { owned: false, stars: 1, level: 1, frags: 0 },
      huangzhong: { owned: false, stars: 1, level: 1, frags: 0 },
      lvbu: { owned: false, stars: 1, level: 1, frags: 0 },
      zhangliao: { owned: false, stars: 1, level: 1, frags: 0 },
      zhouyu: { owned: false, stars: 1, level: 1, frags: 0 },
    },
    progress: { chapter: 1, chapterClear: 0, waveBest: 0, endlessBest: 0, bossBest: 0, dailyPaid: '', bossPaid: '' },
    daily: { freePulls: 0, signinCount: 0, signinClaimedDate: null, date: todayStr() },
    iap: defaultIap(),
    quests: {
      daily: { date: '', progress: {}, claimed: [] },
      weekly: { weekId: '', progress: {}, claimed: [] },
      pass: { seasonId: '', exp: 0, claimedFree: [], claimedPaid: [] },
    },
    stats: { kills: 0, wins: 0, coinsEarned: 0, dailyWins: 0, gachaCount: 0 },
    achievements: { claimed: [] },
    cosmetics: { skin: 'ink', shadowOwned: false },
  };
}

export function todayStr() { return new Date().toISOString().slice(0, 10); }

// 存储适配：微信小游戏无 DOM，wx 同构；测试可注入
function storage() {
  if (typeof wx !== 'undefined' && wx.getStorageSync) {
    return {
      get: (k) => wx.getStorageSync(k),
      set: (k, v) => wx.setStorageSync(k, v),
    };
  }
  return {
    get: (k) => (typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null),
    set: (k, v) => localStorage.setItem(k, v),
  };
}

export function persistSave(save) {
  storage().set(KEY, JSON.stringify(save));
}

export function loadSave() {
  try {
    const raw = storage().get(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !parsed.wallet || !parsed.heroes) return defaultSave();
    // M5 字段补齐（旧档迁移，向后兼容）
    parsed.wallet.stamina ??= 60;
    parsed.wallet.staminaTs ??= 0;
    parsed.daily = { ...defaultSave().daily, ...parsed.daily };
    parsed.daily.signinCount ??= 0;
    parsed.daily.signinClaimedDate ??= null;
    parsed.iap = { ...defaultIap(), ...(parsed.iap || {}) };
    // M6 任务字段补齐（旧档迁移；touchQuests 负责日/周/赛季内容重置）
    parsed.quests = { ...defaultSave().quests, ...(parsed.quests || {}) };
    parsed.cosmetics = { skin: 'ink', shadowOwned: false, ...(parsed.cosmetics || {}) };
    // M7 扩池补齐：旧档可能缺周瑜/张辽键
    for (const id of ['zhangliao', 'zhouyu']) {
      parsed.heroes[id] ??= { owned: false, stars: 1, level: 1, frags: 0 };
    }
    // M7 征战字段补齐
    parsed.progress.endlessBest ??= 0;
    parsed.progress.bossBest ??= 0;
    parsed.progress.dailyPaid ??= '';
    parsed.progress.bossPaid ??= '';
    // M7 功勋：累计统计与已领集合
    parsed.stats = { ...defaultSave().stats, ...(parsed.stats || {}) };
    parsed.achievements = { claimed: [], ...(parsed.achievements || {}) };
    parsed.achievements.claimed ??= [];
    return parsed;
  } catch {
    return defaultSave();
  }
}

// 每日重置（免费抽/当日签到）；累计签到天数跨日保留
export function touchDaily(save) {
  const t = todayStr();
  if (save.daily.date !== t) {
    save.daily = { freePulls: 0, signinCount: save.daily.signinCount || 0, signinClaimedDate: null, date: t };
  }
}
