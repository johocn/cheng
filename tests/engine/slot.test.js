import { describe, it, expect } from 'vitest';
import { tickSlots, useSlot, countType, canMergeAt } from '../../src/engine/slot.js';
import { createRng } from '../../src/engine/rng.js';
import { SLOT_MAX, ITEM_TYPES } from '../../src/engine/config.js';
import { pathPoint } from '../../src/engine/enemy.js';
import { HERO_POS } from '../../src/engine/config.js';

function makeState() {
  return {
    rng: createRng(123),
    slots: Array(SLOT_MAX).fill(null),
    nextItemId: 1,
    stage: 'wave',
    slotTimer: 0,
    enemies: [],
    nextEnemyId: 1,
    hp: 15, hpMax: 15,
    shieldT: 0, atkBuffT: 0,
    coins: 0,
  };
}
function spawnAt(state, lane, t, type = 'bing') {
  state.enemies.push({ id: state.nextEnemyId++, type, lane, t, hp: 100, hpMax: 100, slowT: 0, stunT: 0, burnT: 0 });
}

describe('tickSlots 掉落', () => {
  it('wave 阶段每满 6s 掉入最左空槽', () => {
    const s = makeState();
    tickSlots(s, 5.9);
    expect(s.slots[0]).toBeNull();
    tickSlots(s, 0.2);
    expect(s.slots[0]).not.toBeNull();
    expect(ITEM_TYPES[s.slots[0].type]).toBeTruthy();
    expect(s.slots[0].tier).toBe(1);
  });

  it('非 wave 阶段不计时不掉落', () => {
    const s = makeState();
    s.stage = 'skillPick';
    tickSlots(s, 10);
    expect(s.slots.every((x) => x === null)).toBe(true);
  });

  it('8 格满员暂停掉落（计时钳在阈值）', () => {
    const s = makeState();
    for (let i = 0; i < SLOT_MAX; i++) s.slots[i] = { id: i + 1, type: 'qinglong', tier: 1 };
    tickSlots(s, 10);
    expect(s.slotTimer).toBeLessThanOrEqual(6);
    expect(s.slots.filter(Boolean)).toHaveLength(SLOT_MAX);
  });
});

describe('useSlot 使用与合成', () => {
  it('3 张相同：点击其一 → 合成 1 张 tier2', () => {
    const s = makeState();
    s.slots[0] = { id: 1, type: 'zhuque', tier: 1 };
    s.slots[2] = { id: 2, type: 'zhuque', tier: 1 };
    s.slots[5] = { id: 3, type: 'zhuque', tier: 1 };
    useSlot(s, 2);
    const left = s.slots.filter(Boolean);
    expect(left).toHaveLength(1);
    expect(left[0].type).toBe('zhuque');
    expect(left[0].tier).toBe(2);
  });

  it('青龙使用：射程内敌人受 1.5×atk×tierMul', () => {
    const s = makeState();
    spawnAt(s, 0, 0.9); // pathPoint(0,0.9) ≈ (360,572)，在射程 180 内
    s.slots[0] = { id: 1, type: 'qinglong', tier: 1 };
    useSlot(s, 0);
    expect(s.enemies[0].hp).toBe(100 - 90); // 60×1.5×1
    expect(s.slots[0]).toBeNull();
  });

  it('玄武使用：shieldT=3；计策使用：atkBuffT=5', () => {
    const s = makeState();
    s.slots[0] = { id: 1, type: 'xuanwu', tier: 1 };
    useSlot(s, 0);
    expect(s.shieldT).toBe(3);
    s.slots[1] = { id: 2, type: 'jice', tier: 1 };
    useSlot(s, 1);
    expect(s.atkBuffT).toBe(5);
  });

  it('白虎使用：全场 t 回退；朱雀使用：全场 burnT=5', () => {
    const s = makeState();
    spawnAt(s, 0, 0.5);
    s.slots[0] = { id: 1, type: 'baihu', tier: 1 };
    useSlot(s, 0);
    expect(s.enemies[0].t).toBeCloseTo(0.38, 5);
    s.slots[1] = { id: 2, type: 'zhuque', tier: 1 };
    useSlot(s, 1);
    expect(s.enemies[0].burnT).toBeCloseTo(5, 5);
  });

  it('tier2 使用：效果 ×2.5', () => {
    const s = makeState();
    spawnAt(s, 0, 0.9);
    s.slots[0] = { id: 1, type: 'qinglong', tier: 2 };
    useSlot(s, 0);
    expect(s.enemies[0].hp).toBe(100 - 225); // 60×1.5×2.5
  });

  it('点击空槽无效果', () => {
    const s = makeState();
    expect(useSlot(s, 0)).toBe(false);
    expect(s.slots[0]).toBeNull();
  });
});

describe('辅助', () => {
  it('countType / canMergeAt', () => {
    const s = makeState();
    s.slots[0] = { id: 1, type: 'jice', tier: 1 };
    s.slots[1] = { id: 2, type: 'jice', tier: 1 };
    expect(countType(s, 'jice')).toBe(2);
    expect(canMergeAt(s, 0)).toBe(false);
    s.slots[2] = { id: 3, type: 'jice', tier: 1 };
    expect(canMergeAt(s, 0)).toBe(true);
    expect(canMergeAt(s, 7)).toBe(false);
  });
});
