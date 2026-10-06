// engine/hero.js — 赵云：范围普攻（spec 4.1「近战范围」定位）
// M2：读 state.heroStat 派生属性；暴击/连锁走 state.rng 种子随机
// M11：枪意四档（范围随波扩）+ 箭意三档（枪圈外自动远程）双形态
import { HERO, HERO_POS, SPEAR_STAGES, BOW_RANGE, BOW_STAGES } from './config.js';
import { spearStageOf, bowStageOf } from './spear.js';
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

function isCritNow(state, st) {
  return st.crit > 0 && state.rng ? rngNext(state.rng) < st.crit : false;
}

function emitHeroAtk(state, mode, stage, target, range, splash) {
  const p = pathPoint(target.lane, target.t);
  (state.frameEvents = state.frameEvents || []).push({
    type: 'heroAtk', mode, stage,
    ang: Math.atan2(p.y - HERO_POS.y, p.x - HERO_POS.x),
    x: p.x, y: p.y, range,
    splash: splash ? { x: p.x, y: p.y, r: splash.r } : null,
  });
}

export function heroAttack(state, dtSec) {
  const st = statOf(state);
  const h = state.hero || (state.hero = { atkCooldown: 0 });
  h.atkCooldown = Math.max(0, h.atkCooldown - dtSec);
  if (h.atkCooldown > 0) return;
  const stage = spearStageOf(state.wave || 1);
  const range = st.atkRange + SPEAR_STAGES[stage].bonus; // M11：档位增量叠加技能乘区
  const targets = pickTargets(state, range);
  if (targets.length === 0) return bowAttack(state, st, h);
  h.atkCooldown = st.atkInterval;
  const dmgMul = state.atkBuffT > 0 ? 1.3 : 1;
  if (state.atkBuffT > 0) state.atkBuffT = Math.max(0, state.atkBuffT - st.atkInterval); // buff 随攻击节拍衰减
  const isCrit = isCritNow(state, st);
  const dmg = st.atk * dmgMul * (isCrit ? 2 : 1);
  for (const e of targets) {
    dealDamage(state, e.id, dmg, { crit: isCrit });
    if (st.slowOnHit) {
      const cur = state.enemies.find((x) => x.id === e.id);
      if (cur) cur.slowT = Math.max(cur.slowT || 0, 2);
    }
  }
  if (st.chain) chainLightning(state, targets[0], st, dmg);
  emitHeroAtk(state, 'spear', stage, targets[0], range, null);
}

// 箭意：枪圈内无目标时自动远程点射（320 内最近敌），攻速与枪共用节拍
function bowAttack(state, st, h) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const p = pathPoint(e.lane, e.t);
    const d = Math.hypot(p.x - HERO_POS.x, p.y - HERO_POS.y);
    if (d <= BOW_RANGE && d < bestD) { bestD = d; best = e; }
  }
  if (!best) return;
  h.atkCooldown = st.atkInterval;
  const stage = bowStageOf(state.wave || 1);
  const def = BOW_STAGES[stage];
  const dmgMul = state.atkBuffT > 0 ? 1.3 : 1;
  if (state.atkBuffT > 0) state.atkBuffT = Math.max(0, state.atkBuffT - st.atkInterval);
  const isCrit = isCritNow(state, st);
  const dmg = st.atk * def.mul * dmgMul * (isCrit ? 2 : 1);
  dealDamage(state, best.id, dmg, { crit: isCrit });
  if (def.splash) {
    const bp = pathPoint(best.lane, best.t);
    for (const e of state.enemies) {
      if (e.id === best.id) continue;
      const p = pathPoint(e.lane, e.t);
      if (Math.hypot(p.x - bp.x, p.y - bp.y) <= def.splash.r) {
        dealDamage(state, e.id, st.atk * def.splash.mul * dmgMul);
      }
    }
  }
  if (st.chain) chainLightning(state, best, st, dmg);
  emitHeroAtk(state, 'bow', stage, best, BOW_RANGE, def.splash || null);
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
