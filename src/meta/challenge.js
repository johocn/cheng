// src/meta/challenge.js — M7 征战模式：解锁阶梯 / 每日词缀 / 周词缀 / 最佳记录
// 日期与词缀逻辑全在 meta 层；engine 只吃 createBattle opts（零 save/日期依赖）
import { AFFIX_KEYS } from '../engine/config.js';

export function modeUnlocked(save, mode) {
  const c = save.progress.chapterClear || 0;
  if (mode === 'daily') return c >= 1;
  if (mode === 'endless') return c >= 2;
  if (mode === 'bossrush') return c >= 4;
  return false;
}

// 每日词缀：日期串哈希 → 词缀池均匀映射（同日全服同词条，确定性）
export function dailyAffixOf(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return AFFIX_KEYS[h % AFFIX_KEYS.length];
}

// 车轮战周词缀：ISO 周数 % 3
export function weeklyAffix(now = new Date()) {
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return AFFIX_KEYS[week % AFFIX_KEYS.length];
}

export function bestOf(save, mode) {
  if (mode === 'endless') return save.progress.endlessBest || 0;
  if (mode === 'bossrush') return save.progress.bossBest || 0;
  return 0;
}

export function setBest(save, mode, v) {
  if (mode === 'endless') save.progress.endlessBest = Math.max(save.progress.endlessBest || 0, v);
  if (mode === 'bossrush') save.progress.bossBest = Math.max(save.progress.bossBest || 0, v);
}
