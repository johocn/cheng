// tests/engine/chestFlow.test.js — M10 宝箱编排：w9/w14 波清 → chestPick → skillPick 两段流转（纯 advanceFrame 链路）
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { BOSS_WAVES, TOTAL_WAVES } from '../../src/engine/config.js';

// 构造「波清瞬间」：wave 已打完、场上无敌、刷怪队列空
function clearedState(seed, opts, wave) {
  const s = createBattle(seed, opts);
  s.wave = wave;
  s.stage = 'wave';
  s.spawnQueue = [];
  s.enemies = [];
  return s;
}

describe('M10 宝箱编排：chestPick stage 流转', () => {
  it('chapter w9 波清 → chestPick 且已 rollChest（下一波 10 ∈ BOSS_WAVES）', () => {
    const s = clearedState(20260304, { mode: 'chapter' }, 9);
    expect(BOSS_WAVES).toContain(10);
    const out = advanceFrame(s, null, 50);
    expect(out.stage).toBe('chestPick');
    expect(out.chestChoices).toHaveLength(3);
  });

  it('chapter w14 波清 → chestPick（下一波 15 ∈ BOSS_WAVES）', () => {
    const out = advanceFrame(clearedState(20260304, { mode: 'chapter' }, 14), null, 50);
    expect(out.stage).toBe('chestPick');
  });

  it('chapter w8 波清 → 直接 skillPick（零回归）', () => {
    const out = advanceFrame(clearedState(20260304, { mode: 'chapter' }, 8), null, 50);
    expect(out.stage).toBe('skillPick');
    expect(out.chestChoices).toBeFalsy();
  });

  it('w15 终波清 → victory（不弹宝箱）', () => {
    const out = advanceFrame(clearedState(20260304, { mode: 'chapter' }, TOTAL_WAVES), null, 50);
    expect(out.stage).toBe('victory');
  });

  it('chestPick 输入 pickChest → skillPick（已 roll 兵法、不 wave++）', () => {
    let s = clearedState(20260304, { mode: 'chapter' }, 9);
    s = advanceFrame(s, null, 50); // 波清 → 弹宝箱
    s = advanceFrame(s, { pickChest: 0 }, 50);
    expect(s.stage).toBe('skillPick');
    expect(s.wave).toBe(9); // 尚未推进
    expect(s.pickChoices).toHaveLength(3);
    expect(s.chestChoices).toBeNull();
  });

  it('两段流转闭环：宝箱 → 兵法 → wave10 开波', () => {
    let s = clearedState(20260304, { mode: 'chapter' }, 9);
    s = advanceFrame(s, null, 50);          // 波清 → chestPick
    s = advanceFrame(s, { pickChest: 1 }, 50); // 选犒赏 → skillPick
    s = advanceFrame(s, { pickSkill: 2 }, 50); // 点兵法 → wave10 开波
    expect(s.wave).toBe(10);
    expect(s.stage).toBe('wave');
    expect(s.spawnQueue.length).toBeGreaterThan(0); // BOSS 波已开刷
  });

  it('endless / bossrush 不触发宝箱（波清直进 skillPick）', () => {
    for (const mode of ['endless', 'bossrush']) {
      const out = advanceFrame(clearedState(20260304, { mode }, 9), null, 50);
      expect(out.stage).toBe('skillPick');
      expect(out.chestChoices).toBeFalsy();
    }
  });

  it('daily w9 波清 → 触发宝箱（15 波制与 chapter 同口径）', () => {
    const out = advanceFrame(clearedState(20260304, { mode: 'daily' }, 9), null, 50);
    expect(out.stage).toBe('chestPick');
  });

  it('chestPick 冻结等待：无输入时不掉血不推进 stageClock 波次', () => {
    const s = clearedState(20260304, { mode: 'chapter' }, 9);
    const out = advanceFrame(s, null, 50);
    expect(out.stage).toBe('chestPick');
    const again = advanceFrame(out, null, 1000);
    expect(again.stage).toBe('chestPick');
    expect(again.chestChoices).toEqual(out.chestChoices); // 冻结重抽防抖（只在 !chestChoices 时补抽）
  });
});
