// src/meta/meta.js — 局外养成计算：账号等级/升级/升星/羁绊/攻击加成聚合
// 口径：每级 +6% 攻、每星 +20% 攻、羁绊 ×1.15；数值表见 meta/heroes.js
import { STAR_MAX, FRAGS_PER_STAR, BOND_HEROES, BOND_HEROES_ALL } from './heroes.js';

export const LEVEL_ATK_STEP = 0.06;
export const STAR_ATK_STEP = 0.2;
export const BOND_ATK_MUL = 1.15;
export const BOND_ALL_MUL = 1.25; // M7 汉室云集 8 人（取大不叠加）
export const LEVEL_COST_STEP = 160;

export function accountLevel(save) { return 1 + save.progress.chapterClear; }
export function levelCap(save) { return accountLevel(save) * 5; }
export function levelUpCost(hero) { return LEVEL_COST_STEP * hero.level; }
export function fragNeeded(hero) { return FRAGS_PER_STAR; }

export function levelUp(save, heroId) {
  const h = save.heroes[heroId];
  if (!h || !h.owned) return false;
  if (h.level >= levelCap(save)) return false;
  const cost = levelUpCost(h);
  if (save.wallet.coins < cost) return false;
  save.wallet.coins -= cost;
  h.level += 1;
  return true;
}

export function starUp(save, heroId) {
  const h = save.heroes[heroId];
  if (!h || !h.owned) return false;
  if (h.stars >= STAR_MAX) return false;
  if (h.frags < fragNeeded(h)) return false;
  h.frags -= fragNeeded(h);
  h.stars += 1;
  return true;
}

export function bondActive(save) {
  return BOND_HEROES.every((id) => save.heroes[id] && save.heroes[id].owned);
}

// M7 汉室云集：8 人全收集（含周瑜/张辽）
export function bondAllActive(save) {
  return BOND_HEROES_ALL.every((id) => save.heroes[id] && save.heroes[id].owned);
}

// 攻击总乘区：等级 × 星级 × 羁绊（未拥有英雄 ×1；羁绊取大不叠加）
export function atkMul(save, heroId) {
  const h = save.heroes[heroId];
  if (!h || !h.owned) return 1;
  const lv = 1 + LEVEL_ATK_STEP * (h.level - 1);
  const st = 1 + STAR_ATK_STEP * (h.stars - 1);
  const bond = bondAllActive(save) ? BOND_ALL_MUL : bondActive(save) ? BOND_ATK_MUL : 1;
  return lv * st * bond;
}
