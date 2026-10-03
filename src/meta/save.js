// src/meta/save.js — 局外存档：localStorage / wx.setStorageSync 同构适配
// 结构（spec 第七章）：{ v, wallet, heroes, progress, daily }
const KEY = 'qqc_save_v1';

export function defaultSave() {
  return {
    v: 1,
    wallet: { coins: 500, diamonds: 300, stamina: 60 }, // stamina M5 启用
    heroes: {
      zhaoyun: { owned: true, stars: 1, level: 1, frags: 0 },
      guanyu: { owned: false, stars: 1, level: 1, frags: 0 },
      zhangfei: { owned: false, stars: 1, level: 1, frags: 0 },
      zhugeliang: { owned: false, stars: 1, level: 1, frags: 0 },
      machao: { owned: false, stars: 1, level: 1, frags: 0 },
      huangzhong: { owned: false, stars: 1, level: 1, frags: 0 },
      lvbu: { owned: false, stars: 1, level: 1, frags: 0 },
    },
    progress: { chapter: 1, chapterClear: 0, waveBest: 0 },
    daily: { freePulls: 0, date: today() },
  };
}

function today() { return new Date().toISOString().slice(0, 10); }

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
    return parsed;
  } catch {
    return defaultSave();
  }
}

// 每日重置（免费抽 3 次/日）；同日幂等
export function touchDaily(save) {
  const t = today();
  if (save.daily.date !== t) {
    save.daily = { freePulls: 0, date: t };
  }
}
