// tests/render/eliteFx.test.js — M10 精英武印盖章渲染：印章颜色/时序 + 同屏限流降级色点
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as battleFx from '../../src/render/battleFx.js';
import { ELITE_FX, AFFIX_COLORS, AFFIXES } from '../../src/engine/config.js';
import '../../src/render/art.js';

// Proxy mock ctx：记录方法调用与属性赋值（同 comboFx.test.js 模式）
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
const fills = (ctx) => ctx.__calls.filter((c) => c.set === 'fillStyle').map((c) => c.val);

const evOf = (affix, i = 0) => ({ type: 'elite', affix, x: 100 + i * 30, y: 200 });

describe('M10 武印盖章：consume 入列与印章绘制', () => {
  beforeEach(() => battleFx.reset());

  it('consume elite → 印章绘出词缀字与词缀色', () => {
    battleFx.consume([evOf('iron')], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000);
    expect(texts(ctx)).toContain(AFFIXES.iron.label);
    expect(fills(ctx)).toContain(AFFIX_COLORS.iron);
  });

  it('三词缀色映射：swift 青 / sharp 朱', () => {
    battleFx.consume([evOf('swift')], {}, 1000);
    let ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000);
    expect(fills(ctx)).toContain(AFFIX_COLORS.swift);

    battleFx.reset();
    battleFx.consume([evOf('sharp')], {}, 1000);
    ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000);
    expect(fills(ctx)).toContain(AFFIX_COLORS.sharp);
  });

  it('盖章相位：draw 内有 scale/rotate 变换（弹跳盖下）', () => {
    battleFx.consume([evOf('iron')], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1010); // q=0.02 处于盖下段
    const fns = ctx.__calls.map((c) => c.fn);
    expect(fns).toContain('scale');
    expect(fns).toContain('rotate');
  });

  it('屏外刷出点 clamp 进屏（lane0 起点 y=-40 → 印章中心 y≥96）', () => {
    battleFx.consume([{ type: 'elite', affix: 'iron', x: 360, y: -40 }], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000);
    const tr = ctx.__calls.filter((c) => c.fn === 'translate').map((c) => c.args);
    expect(tr.length).toBeGreaterThan(0);
    for (const [x, y] of tr) {
      expect(x).toBeGreaterThanOrEqual(50);
      expect(y).toBeGreaterThanOrEqual(96);
    }
  });

  it('dur(0.5s) 过期不再绘制', () => {
    battleFx.consume([evOf('iron')], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000 + ELITE_FX.dur * 1000 + 20);
    expect(texts(ctx)).toHaveLength(0);
  });
});

describe('M10 武印盖章：同屏限流降级', () => {
  beforeEach(() => battleFx.reset());

  it('活跃印章达 maxActive 后，新事件降级 minor：只画色点不画字', () => {
    const evs = [evOf('iron', 0), evOf('swift', 1), evOf('sharp', 2), evOf('iron', 3)];
    battleFx.consume(evs, {}, 1000);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000);
    const t = texts(ctx);
    expect(t.filter((x) => x === AFFIXES.iron.label)).toHaveLength(1); // 第 4 个 iron 降级无字
    // 降级色点：存在小半径 arc（r ≤ 8）且 fillStyle 命中词缀色
    expect(ctx.__calls.some((c) => c.fn === 'arc' && c.args[2] <= 8)).toBe(true);
    expect(fills(ctx)).toContain(AFFIX_COLORS.iron);
  });

  it('降级色点 minorDur(0.8s) 过期消失（印章 0.5s 已先过期）', () => {
    battleFx.consume([evOf('iron', 0), evOf('swift', 1), evOf('sharp', 2), evOf('iron', 3)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000 + ELITE_FX.minorDur * 1000 + 20);
    expect(ctx.__calls.some((c) => c.fn === 'arc')).toBe(false);
  });

  it('印章过期后腾出限额：后续 elite 不再降级', () => {
    battleFx.consume([evOf('iron', 0), evOf('swift', 1), evOf('sharp', 2)], {}, 1000);
    battleFx.drawEliteSpawns(makeCtx(), 1000 + ELITE_FX.dur * 1000 + 20); // 惰性清理过期三枚
    battleFx.consume([evOf('iron', 3)], {}, 1000 + ELITE_FX.dur * 1000 + 20);
    const ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000 + ELITE_FX.dur * 1000 + 20);
    expect(texts(ctx)).toContain(AFFIXES.iron.label); // 正常盖章
  });
});

describe('M10 武印盖章：快进 speed 缩放', () => {
  beforeEach(() => battleFx.reset());
  afterEach(() => battleFx.setSpeed(1));

  it('speed=2 时印章 250ms 过期（0.5s÷2）', () => {
    battleFx.setSpeed(2);
    battleFx.consume([evOf('iron')], {}, 1000);
    let ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000 + 240);
    expect(texts(ctx)).toContain(AFFIXES.iron.label);
    ctx = makeCtx();
    battleFx.drawEliteSpawns(ctx, 1000 + 260);
    expect(texts(ctx)).toHaveLength(0);
  });
});
