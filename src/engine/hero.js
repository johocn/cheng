// engine/hero.js — 赵云：范围普攻（spec 4.1「近战范围」定位）
import { HERO, HERO_POS } from './config.js';
import { pathPoint } from './enemy.js';
import { dealDamage } from './combat.js';

export function pickTargets(state) {
  return state.enemies.filter((e) => {
    const p = pathPoint(e.lane, e.t);
    return Math.hypot(p.x - HERO_POS.x, p.y - HERO_POS.y) <= HERO.atkRange;
  });
}

export function heroAttack(state, dtSec) {
  const h = state.hero;
  h.atkCooldown = Math.max(0, h.atkCooldown - dtSec);
  if (h.atkCooldown > 0) return;
  const targets = pickTargets(state);
  if (targets.length === 0) return;
  h.atkCooldown = HERO.atkInterval;
  for (const e of targets) {
    dealDamage(state, e.id, HERO.atk);
  }
}
