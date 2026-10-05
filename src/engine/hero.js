// engine/hero.js — 赵云：范围普攻（spec 4.1「近战范围」定位）
// M2：读 state.heroStat 派生属性；暴击/连锁走 state.rng 种子随机
import { HERO, HERO_POS } from './config.js';
import { pathPoint } from './enemy.js';
import { dealDamage } from './combat.js';
import { rngNext } from './rng.js';

// heroStat 兜底（M1 形态 state 无 heroStat 时退回基础值，保持测试/调用兼容）
function statOf(state) {
  return state.heroStat || {
    atk: HERO.atk, atkInterval: HERO.atkInterval, atkRange: HERO.atkRange,
    crit: 0, slowOnHit: false, chain: 0,
  };
}

export function pickTargets(state, range) {
  const r = range === undefined ? statOf(state).atkRange : range;
  return state.enemies.filter((e) => {
    const p = pathPoint(e.lane, e.t);
    return Math.hypot(p.x - HERO_POS.x, p.y - HERO_POS.y) <= r;
  });
}

export function heroAttack(state, dtSec) {
  const st = statOf(state);
  const h = state.hero || (state.hero = { atkCooldown: 0 });
  h.atkCooldown = Math.max(0, h.atkCooldown - dtSec);
  if (h.atkCooldown > 0) return;
  const targets = pickTargets(state, st.atkRange);
  if (targets.length === 0) return;
  h.atkCooldown = st.atkInterval;
  const dmgMul = state.atkBuffT > 0 ? 1.3 : 1;
  if (state.atkBuffT > 0) state.atkBuffT = Math.max(0, state.atkBuffT - st.atkInterval); // buff 随攻击节拍衰减
  const isCrit = st.crit > 0 && state.rng ? rngNext(state.rng) < st.crit : false;
  const dmg = st.atk * dmgMul * (isCrit ? 2 : 1);
  for (const e of targets) {
    dealDamage(state, e.id, dmg, { crit: isCrit });
    if (st.slowOnHit) {
      const cur = state.enemies.find((x) => x.id === e.id);
      if (cur) cur.slowT = Math.max(cur.slowT || 0, 2);
    }
  }
  if (st.chain) chainLightning(state, targets[0], st, dmg);
}

// 连锁闪电：从命中源出发按距离最近逐跳，最多 chain 跳，
// 每跳伤害 = 主伤害 ×0.5，逐跳 ×0.7；已命中（主目标/链上）不重复
function chainLightning(state, source, st, mainDmg) {
  const hit = new Set([source.id]);
  let prev = source;
  let dmg = mainDmg * 0.5;
  for (let n = 0; n < st.chain; n++) {
    const pp = pathPoint(prev.lane, prev.t);
    let best = null;
    let bestD = Infinity;
    for (const e of state.enemies) {
      if (hit.has(e.id)) continue;
      const p = pathPoint(e.lane, e.t);
      const d = Math.hypot(p.x - pp.x, p.y - pp.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    dealDamage(state, best.id, dmg);
    hit.add(best.id);
    dmg *= 0.7;
    prev = best;
  }
}
