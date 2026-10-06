// tests/render/comboFx.test.js — M9 连击渲染：弹跳计数 + 墨点扩散（battleFx.drawCombo）
import { describe, it, expect } from 'vitest';
import * as battleFx from '../../src/render/battleFx.js';
import '../../src/render/art.js';

// Proxy mock ctx：记录方法调用与属性赋值（同 cinematic.test.js makeCtx 模式）
function makeCtx() {
  const calls = [];
  return new Proxy({}, {
    get(t, k) {
      if (k === '__calls') return calls;
      return (...a) => { calls.push({ fn: k, args: a }); };
    },
    set(t, k, v) { calls.push({ set: k, val: v }); return true; },
  });
}
const texts = (ctx) => ctx.__calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
const arcs = (ctx) => ctx.__calls.filter((c) => c.fn === 'arc');

describe('M9 drawCombo：显示门槛与文本', () => {
  it('combo<2 不画', () => {
    battleFx.reset();
    const ctx = makeCtx();
    battleFx.drawCombo(ctx, { combo: 1 }, 1000);
    expect(texts(ctx)).toHaveLength(0);
  });

  it('combo≥2 画「连 击」+「×N」两段文本', () => {
    battleFx.reset();
    const ctx = makeCtx();
    battleFx.drawCombo(ctx, { combo: 3 }, 1000);
    const t = texts(ctx);
    expect(t).toHaveLength(2);
    expect(t[0]).toContain('连');
    expect(t[1]).toBe('×3');
  });

  it('combo≥10 数字转朱砂色（fillStyle 命中 seal）', () => {
    battleFx.reset();
    const ctx = makeCtx();
    battleFx.drawCombo(ctx, { combo: 12 }, 1000);
    const sealSet = ctx.__calls.some((c) => c.set === 'fillStyle' && c.val === '#9e2a1e');
    expect(sealSet).toBe(true);
  });

  it('墨点扩散：三圈 arc', () => {
    battleFx.reset();
    const ctx = makeCtx();
    battleFx.drawCombo(ctx, { combo: 2 }, 1000);
    expect(arcs(ctx).length).toBeGreaterThanOrEqual(3);
  });
});

describe('M9 comboScale：击杀弹跳时序', () => {
  it('无 kill 事件时恒为 1', () => {
    battleFx.reset();
    expect(battleFx.comboScale(5000)).toBe(1);
  });

  it('consume kill 后立即 >1，270ms 后回到 1', () => {
    battleFx.reset();
    const state = { combo: 1, packIdx: 0, mode: 'chapter' };
    battleFx.consume([{ type: 'kill', enemyId: 1, x: 100, y: 100, enemyType: 'bing' }], state, 1000);
    expect(battleFx.comboScale(1000)).toBeGreaterThan(1.4);
    expect(battleFx.comboScale(1000 + 300)).toBe(1);
  });

  it('第二次 kill 重置弹跳起点（取较新时刻）', () => {
    battleFx.reset();
    const state = { combo: 2, packIdx: 0, mode: 'chapter' };
    battleFx.consume([{ type: 'kill', enemyId: 1, x: 100, y: 100, enemyType: 'bing' }], state, 1000);
    battleFx.consume([{ type: 'kill', enemyId: 2, x: 120, y: 100, enemyType: 'bing' }], state, 1100);
    expect(battleFx.comboScale(1100)).toBeGreaterThan(1.4); // 从 1100 重新起跳
    expect(battleFx.comboScale(1100 + 300)).toBe(1);
  });
});
