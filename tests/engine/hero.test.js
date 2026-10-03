import { describe, it, expect } from 'vitest';
import { heroAttack, pickTargets } from '../../src/engine/hero.js';
import { HERO, ENEMY_TYPES } from '../../src/engine/config.js';
import { createRng } from '../../src/engine/rng.js';

// t=0.9 时三条路径均在射程内（lane0 距离102，lane1/2 约52.8）
// t=0.1 时均远超 180px 射程
function makeState(enemyTs) {
  return {
    coins: 0,
    nextEnemyId: 1,
    enemies: enemyTs.map(([lane, t]) => ({
      id: 0, type: 'bing', lane, t,
      hp: ENEMY_TYPES.bing.hp, hpMax: ENEMY_TYPES.bing.hp,
    })).map((e, i) => ({ ...e, id: i + 1 })),
    hero: { atkCooldown: 0 },
  };
}

describe('pickTargets 射程筛选', () => {
  it('只返回射程内敌人', () => {
    const s = makeState([[0, 0.9], [1, 0.9], [2, 0.9], [0, 0.1]]);
    const ids = pickTargets(s).map((e) => e.id);
    expect(ids).toEqual([1, 2, 3]);
  });
});

describe('heroAttack 范围普攻', () => {
  it('对射程内全体造成 HERO.atk 伤害并进入冷却', () => {
    const s = makeState([[0, 0.9], [1, 0.9], [0, 0.1]]);
    heroAttack(s, 0.0167);
    expect(s.enemies.find((e) => e.id === 1).hp)
      .toBe(ENEMY_TYPES.bing.hp - HERO.atk);
    expect(s.enemies.find((e) => e.id === 2).hp)
      .toBe(ENEMY_TYPES.bing.hp - HERO.atk);
    expect(s.enemies.find((e) => e.id === 3).hp)
      .toBe(ENEMY_TYPES.bing.hp); // 远处敌不受影响
    expect(s.hero.atkCooldown).toBeCloseTo(HERO.atkInterval, 5);
  });

  it('无目标：不攻击、不进入冷却', () => {
    const s = makeState([]);
    heroAttack(s, 0.0167);
    expect(s.hero.atkCooldown).toBe(0);
  });

  it('冷却中：不攻击', () => {
    const s = makeState([[0, 0.9]]);
    s.hero.atkCooldown = 1.0;
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(ENEMY_TYPES.bing.hp);
    expect(s.hero.atkCooldown).toBeCloseTo(1.0 - 0.0167, 3);
  });

  it('冷却剩余小于 dt：本轮立即开火', () => {
    const s = makeState([[0, 0.9]]);
    s.hero.atkCooldown = 0.005;
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(ENEMY_TYPES.bing.hp - HERO.atk);
  });

  it('伤害致死时正常结算移除与金币', () => {
    const s = makeState([[1, 0.9]]);
    s.enemies[0].hp = 60; // 恰好一刀
    heroAttack(s, 0.0167);
    expect(s.enemies).toHaveLength(0);
    expect(s.coins).toBe(ENEMY_TYPES.bing.reward);
  });
});

// ===== M2：heroStat 派生属性接入 =====
const BASE_STAT = {
  atk: 60, atkInterval: 0.75, atkRange: 180,
  crit: 0, slowOnHit: false, chain: 0,
};

function makeM2State(enemyTs, statOverrides = {}, seed = 11) {
  const s = makeState(enemyTs);
  s.rng = createRng(seed);
  s.heroStat = { ...BASE_STAT, ...statOverrides };
  s.atkBuffT = 0;
  s.killCount = 0;
  return s;
}

describe('M2 heroStat 接入', () => {
  it('读 heroStat：atk/atkInterval/atkRange 生效', () => {
    const s = makeM2State([[0, 0.85]], { atk: 90, atkInterval: 0.5, atkRange: 260 });
    s.enemies[0].hp = s.enemies[0].hpMax = 500;
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(410);
    expect(s.hero.atkCooldown).toBeCloseTo(0.5, 5);
  });

  it('暴击走 state.rng：crit=1 时必然暴击（伤害 ×2）', () => {
    const s = makeM2State([[0, 0.9]], { crit: 1 });
    s.enemies[0].hp = s.enemies[0].hpMax = 500; // 血量加厚避免被暴击直接击杀
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(380); // 500 - 60×2
  });

  it('连锁闪电：每次普攻从命中源跳 chain 个最近目标，逐跳 ×0.7（0.5×atk 起跳）', () => {
    // 主目标 lane0 t=0.9，连锁目标 lane0 t=0.1（射程外也可被连锁）
    const s = makeM2State([[0, 0.9], [0, 0.1]], { chain: 4 });
    heroAttack(s, 0.0167);
    expect(s.enemies.find((e) => e.id === 1).hp).toBe(100 - 60); // 主目标
    expect(s.enemies.find((e) => e.id === 2).hp).toBe(100 - 30); // 第1跳 60×0.5
  });

  it('连锁跳数受 chain 限制：chain=0 无连锁', () => {
    const s = makeM2State([[0, 0.9], [0, 0.1]], { chain: 0 });
    heroAttack(s, 0.0167);
    expect(s.enemies.find((e) => e.id === 2).hp).toBe(100);
  });

  it('slowOnHit：命中附加 slowT=2', () => {
    const s = makeM2State([[0, 0.9]], { slowOnHit: true });
    heroAttack(s, 0.0167);
    expect(s.enemies[0].slowT).toBeCloseTo(2, 5);
  });

  it('atkBuffT>0：伤害 ×1.3 且随攻击节拍衰减', () => {
    const s = makeM2State([[0, 0.9]]);
    s.enemies[0].hp = s.enemies[0].hpMax = 500;
    s.atkBuffT = 5;
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(500 - 78); // 60×1.3
    expect(s.atkBuffT).toBeCloseTo(5 - 0.75, 5);
  });
});
