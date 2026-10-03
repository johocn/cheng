// engine/rogue.js — 肉鸽三选一：加权抽取、BOSS 前保底、属性聚合
import { rngNext } from './rng.js';
import { ROGUE_SKILLS, HERO, HP_MAX, BOSS_WAVES } from './config.js';

const byId = (id) => ROGUE_SKILLS.find((s) => s.id === id);

export function rollThree(state) {
  const pool = [...ROGUE_SKILLS];
  const bossAhead = BOSS_WAVES.includes(state.wave + 1);
  const picks = [];
  while (picks.length < 3 && pool.length) {
    const total = pool.reduce((a, s) => a + s.weight, 0);
    let r = rngNext(state.rng) * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].weight;
      if (r <= 0) break;
    }
    idx = Math.min(idx, pool.length - 1);
    picks.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  // BOSS 前保底：若全普通，随机将一张替换为未选中的稀有+
  if (bossAhead && picks.every((id) => byId(id).rarity === 0)) {
    const high = ROGUE_SKILLS.filter((s) => s.rarity >= 1 && !picks.includes(s.id));
    if (high.length) picks[Math.floor(rngNext(state.rng) * 3)] = byId(high[Math.floor(rngNext(state.rng) * high.length)].id).id;
  }
  state.pickChoices = picks;
}

export function pickSkill(state, idx) {
  if (!state.pickChoices || !state.pickChoices[idx]) return false;
  state.skills.push(state.pickChoices[idx]);
  state.pickChoices = null;
  return true;
}

// 聚合已选技能 → 战斗派生属性（pickSkill 后由 state.js 重算存 state.heroStat）
export function computeStats(skillIds) {
  const has = (id) => skillIds.includes(id);
  const count = (id) => skillIds.filter((x) => x === id).length;
  return {
    atk: HERO.atk * Math.pow(1.2, count('atk')),
    atkInterval: HERO.atkInterval * Math.pow(0.85, count('aspd')),
    atkRange: HERO.atkRange * Math.pow(1.3, count('range')),
    crit: 0.25 * count('crit'),
    slowOnHit: has('slow'),
    chain: has('chain') ? 4 : 0,
    leech: has('leech'),
    dropMul: has('drop') ? 0.8 : 1,
    hpMax: HP_MAX + (has('wall') ? 5 : 0),
  };
}
