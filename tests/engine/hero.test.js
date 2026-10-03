import { describe, it, expect } from 'vitest';
import { heroAttack, pickTargets } from '../../src/engine/hero.js';
import { HERO, ENEMY_TYPES } from '../../src/engine/config.js';

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
