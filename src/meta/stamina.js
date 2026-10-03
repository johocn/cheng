// src/meta/stamina.js — 体力系统：出战扣减 + 5 分钟/点自然恢复（spec 4.3 / 5 定案）
export const STAMINA_MAX = 60;
export const REGEN_MS = 5 * 60 * 1000; // 5 分钟/点
export const BATTLE_COST = 5;          // 每局 5 点（出战即扣，战败不退）

// 自然恢复：按 staminaTs 时间戳累积；满体力时时间戳对齐当前时刻
export function regenStamina(save, now = Date.now()) {
  const w = save.wallet;
  if (w.stamina >= STAMINA_MAX) { w.staminaTs = now; return 0; }
  const ts = w.staminaTs ?? now;
  const points = Math.floor((now - ts) / REGEN_MS);
  if (points <= 0) return 0;
  const gained = Math.min(points, STAMINA_MAX - w.stamina);
  w.stamina += gained;
  w.staminaTs = w.stamina >= STAMINA_MAX ? now : ts + gained * REGEN_MS;
  return gained;
}

// 扣减：足够 → true 并扣；不足 → false（调用方提示）
export function spendStamina(save, n = BATTLE_COST) {
  if (save.wallet.stamina < n) return false;
  save.wallet.stamina -= n;
  return true;
}

// 奖励入账（签到/月卡）：可超上限（自然恢复仍以 60 封顶）
export function gainStamina(save, n) { save.wallet.stamina += n; }
