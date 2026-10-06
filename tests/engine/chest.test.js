// tests/engine/chest.test.js — M10 Boss 波前宝箱：rollChest 抽三 / pickChest 五种犒赏效果
import { describe, it, expect } from 'vitest';
import { createBattle, refreshStats } from '../../src/engine/state.js';
import { rollChest, pickChest } from '../../src/engine/chest.js';
import { CHEST_REWARDS, CHEST_GOLD, CHEST_HP, CHEST_SHIELD, CHEST_ATK, SLOT_MAX } from '../../src/engine/config.js';

describe('M10 宝箱：rollChest 抽三', () => {
  it('三选一：不重复、全在奖励池、写入 chestChoices', () => {
    const s = createBattle(1);
    rollChest(s);
    expect(s.chestChoices).toHaveLength(3);
    expect(new Set(s.chestChoices).size).toBe(3);
    for (const id of s.chestChoices) {
      expect(CHEST_REWARDS.some((r) => r.id === id)).toBe(true);
    }
  });

  it('确定性：同种子同抽签结果', () => {
    const a = createBattle(20260304);
    const b = createBattle(20260304);
    rollChest(a);
    rollChest(b);
    expect(a.chestChoices).toEqual(b.chestChoices);
  });
});

describe('M10 宝箱：pickChest 犒赏效果', () => {
  it('无效输入返回 false（未 roll / 越界 idx）', () => {
    const s = createBattle(1);
    expect(pickChest(s, 0)).toBe(false); // 未 roll
    rollChest(s);
    expect(pickChest(s, 3)).toBe(false); // 越界
    expect(pickChest(s, -1)).toBe(false);
  });

  it('troops 犒赏三军：hpMax +3 并回复（钳 hpMax）', () => {
    const s = createBattle(1);
    s.chestChoices = ['troops', 'gold', 'shield'];
    s.hp = s.hpMax - 2;
    expect(pickChest(s, 0)).toBe(true);
    expect(s.hpMax).toBe(15 + CHEST_HP);
    expect(s.hp).toBe(15 - 2 + CHEST_HP);
    expect(s.chestChoices).toBeNull();
  });

  it('shield 玄武庇佑：shieldT 取较大值（不缩短已有护盾）', () => {
    const s = createBattle(1);
    s.chestChoices = ['shield', 'gold', 'troops'];
    pickChest(s, 0);
    expect(s.shieldT).toBe(CHEST_SHIELD);
    const s2 = createBattle(1);
    s2.chestChoices = ['shield', 'gold', 'troops'];
    s2.shieldT = 6;
    pickChest(s2, 0);
    expect(s2.shieldT).toBe(6);
  });

  it('gold 金帛犒军：coins +120', () => {
    const s = createBattle(1);
    s.chestChoices = ['gold', 'troops', 'shield'];
    const before = s.coins;
    pickChest(s, 0);
    expect(s.coins).toBe(before + CHEST_GOLD);
  });

  it('edge 锋芒：edgeAtk 累积乘区，refreshStats 后 atk ×1.1（重算不丢）', () => {
    const s = createBattle(1);
    const baseAtk = s.heroStat.atk;
    s.chestChoices = ['edge', 'gold', 'troops'];
    pickChest(s, 0);
    expect(s.edgeAtk).toBe(CHEST_ATK);
    refreshStats(s);
    expect(s.heroStat.atk).toBeCloseTo(baseAtk * (1 + CHEST_ATK), 6);
    // 二次refresh（如后续 pickSkill）乘区保留
    refreshStats(s);
    expect(s.heroStat.atk).toBeCloseTo(baseAtk * (1 + CHEST_ATK), 6);
  });

  it('items 计策入囊：向空槽放入 2 张 tier1 锦囊', () => {
    const s = createBattle(1);
    s.chestChoices = ['items', 'gold', 'troops'];
    pickChest(s, 0);
    const filled = s.slots.filter(Boolean);
    expect(filled).toHaveLength(2);
    for (const it of filled) {
      expect(it.tier).toBe(1);
      expect(it.id).toBeLessThan(s.nextItemId);
    }
  });

  it('items 槽满时丢弃（不补偿、不越界）', () => {
    const s = createBattle(1);
    s.slots = Array(SLOT_MAX).fill({ id: 999, type: 'qinglong', tier: 1 });
    s.nextItemId = 1000;
    s.chestChoices = ['items', 'gold', 'troops'];
    pickChest(s, 0);
    expect(s.slots.filter((x) => x && x.id === 999)).toHaveLength(SLOT_MAX); // 原样未动
  });
});
