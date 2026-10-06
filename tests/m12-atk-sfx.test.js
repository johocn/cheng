// tests/m12-atk-sfx.test.js — M12 普攻音效：枪四档/弓三档出手音配方 + sfx(name, sc) 时间缩放
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initAudio, sfx, setSoundMode, bgmStop } from '../src/platform/audio.js';

// mock ctx：记录 oscillator 波形与频率调度事件（set/ramp 的值与时刻），供配方断言
function mockCtx() {
  const nodes = [];
  return {
    nodes,
    currentTime: 0,
    destination: {},
    createOscillator() {
      const o = {
        type: '',
        freqEvents: [],
        frequency: {
          value: 0,
          setValueAtTime(v, t) { o.freqEvents.push({ kind: 'set', v, t }); },
          exponentialRampToValueAtTime(v, t) { o.freqEvents.push({ kind: 'ramp', v, t }); },
        },
        connect() {}, start() {}, stop() {},
      };
      nodes.push(o); return o;
    },
    createGain() {
      const g = {
        gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
      };
      nodes.push(g); return g;
    },
  };
}
const oscs = (ctx) => ctx.nodes.filter((n) => n.freqEvents);
const setAt = (o) => (o.freqEvents.find((e) => e.kind === 'set') || {}).t;
const rampOf = (o) => o.freqEvents.find((e) => e.kind === 'ramp') || null;

let caseSeed = 0;
beforeEach(() => { // 每用例独立时间窗：隔离 sfx 60ms 同名限频
  vi.useFakeTimers();
  caseSeed += 1000;
  vi.setSystemTime(1700000000000 + caseSeed);
});
afterEach(() => {
  bgmStop();
  vi.useRealTimers();
  initAudio(null);
  setSoundMode({ settings: { sound: true, bgm: true } });
});

function fresh() {
  const ctx = mockCtx();
  initAudio(() => ctx);
  setSoundMode({ settings: { sound: true, bgm: true } });
  return ctx;
}

describe('M12 出手音配方（枪低音区/弓高音区）', () => {
  it('7 个新音名全部可触发且调度节点', () => {
    const ctx = fresh();
    for (const name of ['spear1', 'spear2', 'spear3', 'spear4', 'bow1', 'bow2', 'bow3']) {
      const n0 = ctx.nodes.length;
      sfx(name);
      expect(ctx.nodes.length, name).toBeGreaterThan(n0);
    }
  });
  it('spear1 单枪突刺：triangle 380→190 + sine 1200→600 擦音（2 层）', () => {
    const ctx = fresh();
    sfx('spear1');
    const o = oscs(ctx);
    expect(o.length).toBe(2);
    expect(o[0].type).toBe('triangle');
    expect(o[0].freqEvents[0].v).toBe(380);
    expect(rampOf(o[0]).v).toBe(190);
    expect(rampOf(o[0]).t).toBeCloseTo(0.08, 5);
    expect(o[1].type).toBe('sine');
    expect(o[1].freqEvents[0].v).toBe(1200);
    expect(rampOf(o[1]).v).toBe(600);
  });
  it('spear2 龙胆突刺：3 层（+sawtooth 残影）', () => {
    const ctx = fresh();
    sfx('spear2');
    const o = oscs(ctx);
    expect(o.length).toBe(3);
    expect(o[2].type).toBe('sawtooth');
  });
  it('spear3 横扫枪风：triangle 180→560 上滑 + square 低扫（2 层）', () => {
    const ctx = fresh();
    sfx('spear3');
    const o = oscs(ctx);
    expect(o.length).toBe(2);
    expect(o[0].type).toBe('triangle');
    expect(o[0].freqEvents[0].v).toBe(180);
    expect(rampOf(o[0]).v).toBe(560);
    expect(o[1].type).toBe('square');
    expect(o[1].freqEvents[0].v).toBe(90);
  });
  it('spear4 枪圈墨波：sine 低鸣 + square 泛音 + triangle（3 层）', () => {
    const ctx = fresh();
    sfx('spear4');
    const o = oscs(ctx);
    expect(o.length).toBe(3);
    expect(o[0].type).toBe('sine');
    expect(o[0].freqEvents[0].v).toBe(70);
    expect(o[1].type).toBe('square');
    expect(o[2].type).toBe('triangle');
  });
  it('bow1 穿云箭：sine 880 弦响 + triangle 1400→700 破空（2 层）', () => {
    const ctx = fresh();
    sfx('bow1');
    const o = oscs(ctx);
    expect(o.length).toBe(2);
    expect(o[0].type).toBe('sine');
    expect(o[0].freqEvents[0].v).toBe(880);
    expect(o[1].type).toBe('triangle');
    expect(o[1].freqEvents[0].v).toBe(1400);
    expect(rampOf(o[1]).v).toBe(700);
  });
});

describe('M12 齐射错相排程（对齐 BOW_VOLLEYS 演出）', () => {
  it('bow2 连珠箭：4 层，第二响弦响 when=0.12', () => {
    const ctx = fresh();
    sfx('bow2');
    const o = oscs(ctx);
    expect(o.length).toBe(4);
    expect(setAt(o[0])).toBe(0);
    expect(setAt(o[2])).toBeCloseTo(0.12, 5);
    expect(o[2].freqEvents[0].v).toBe(880); // 同配方重放
  });
  it('bow3 箭雨：6 层，三响 when=0/0.08/0.16', () => {
    const ctx = fresh();
    sfx('bow3');
    const o = oscs(ctx);
    expect(o.length).toBe(6);
    expect(setAt(o[0])).toBe(0);
    expect(setAt(o[2])).toBeCloseTo(0.08, 5);
    expect(setAt(o[4])).toBeCloseTo(0.16, 5);
  });
  it('sc 缩放：sfx("bow2", 0.5) 第二响 when=0.06（快进 ÷speed）', () => {
    const ctx = fresh();
    sfx('bow2', 0.5);
    const o = oscs(ctx);
    expect(o.length).toBe(4);
    expect(setAt(o[2])).toBeCloseTo(0.06, 5);
  });
});

describe('M12 零破坏与限频', () => {
  it('现有音效忽略 sc 不炸：sfx("hit", 0.5) 正常调度', () => {
    const ctx = fresh();
    sfx('hit', 0.5);
    expect(oscs(ctx).length).toBeGreaterThan(0);
  });
  it('限频按 name 独立：spear1 冷却期内 bow1 仍发声', () => {
    const ctx = fresh();
    sfx('spear1');
    const n1 = ctx.nodes.length;
    sfx('spear1'); // 同名 60ms 内 → 静默
    expect(ctx.nodes.length).toBe(n1);
    sfx('bow1'); // 不同名不受限
    expect(ctx.nodes.length).toBeGreaterThan(n1);
  });
  it('过冷却窗后同名可再发声', () => {
    const ctx = fresh();
    sfx('spear1');
    const n1 = ctx.nodes.length;
    vi.advanceTimersByTime(80);
    sfx('spear1');
    expect(ctx.nodes.length).toBeGreaterThan(n1);
  });
});
