import { describe, it, expect } from 'vitest';
import { dealDamage } from '../../src/engine/combat.js';
import { ENEMY_TYPES } from '../../src/engine/config.js';

function makeState() {
  return {
    coins: 0,
    enemies: [{ id: 7, type: 'bing', lane: 0, t: 0.4, hp: 50, hpMax: 100 }],
    nextEnemyId: 8,
  };
}

describe('dealDamage', () => {
  it('伤害未致死：扣血，返回 killed:false', () => {
    const s = makeState();
    const r = dealDamage(s, 7, 30);
    expect(r).toEqual({ killed: false });
    expect(s.enemies[0].hp).toBe(20);
    expect(s.coins).toBe(0);
  });

  it('伤害致死：移出战场 + 发放击杀金币', () => {
    const s = makeState();
    const r = dealDamage(s, 7, 60);
    expect(r).toEqual({ killed: true, reward: ENEMY_TYPES.bing.reward });
    expect(s.enemies).toHaveLength(0);
    expect(s.coins).toBe(ENEMY_TYPES.bing.reward);
  });

  it('无效 id 安全返回 null，不改动 state', () => {
    const s = makeState();
    const before = JSON.stringify(s);
    expect(dealDamage(s, 999, 50)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });
});
