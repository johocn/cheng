// tests/render/bowFx.test.js — M11 弓三档演出（穿云箭/连珠箭/箭雨）：拉弓/飞行/命中/溅射环
import { describe, it, expect, beforeEach } from 'vitest';
import * as battleFx from '../../src/render/battleFx.js';
import '../../src/render/art.js';

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
const sets = (ctx, k) => ctx.__calls.filter((c) => c.set === k).map((c) => c.val);
const bowEv = (stage) => ({
  type: 'heroAtk', mode: 'bow', stage, ang: -0.6, x: 470, y: 470,
  range: 320, splash: stage === 0 ? null : { r: stage === 1 ? 70 : 110, mul: 0.5 },
});

beforeEach(() => battleFx.reset());

describe('M11 弓演出：heroAtk bow 事件', () => {
  it('consume bow → active/mode=bow；总时长 720ms（draw 0.3+fly 0.42）', () => {
    battleFx.consume([bowEv(0)], {}, 1000);
    const a = battleFx.heroAttackAnim(1050);
    expect(a.active).toBe(true);
    expect(a.mode).toBe('bow');
    expect(a.stage).toBe(0);
    expect(battleFx.heroAttackAnim(1700).active).toBe(true);
    expect(battleFx.heroAttackAnim(1740).active).toBe(false);
  });
});

describe('M11 弓壹 穿云箭（single）', () => {
  it('拉弓段：鎏金弓弧 + 墨弦 + 弦上箭（朱砂镞）', () => {
    battleFx.consume([bowEv(0)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1150); // t=0.15 拉弓中
    expect(sets(ctx, 'strokeStyle')).toContain('#c9a227');            // 弓弧
    expect(sets(ctx, 'strokeStyle').some((v) => String(v).startsWith('rgba(31,27,22'))).toBe(true); // 弦
    expect(sets(ctx, 'fillStyle')).toContain('#9e2a1e');              // 弦上箭镞
  });
  it('飞行段：墨杆金羽箭在途', () => {
    battleFx.consume([bowEv(0)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1500); // t=0.5 飞行中
    const inkStrokes = sets(ctx, 'strokeStyle').filter((v) => v === '#1f1b16').length;
    expect(inkStrokes).toBeGreaterThanOrEqual(1); // 箭杆
    expect(sets(ctx, 'strokeStyle')).toContain('#c9a227'); // 金羽
  });
  it('命中段：主目标墨花扩散；无溅射环（single splash=null）', () => {
    battleFx.consume([bowEv(0)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1700); // t=0.7 命中后
    const inkStrokes = sets(ctx, 'strokeStyle').filter((v) => String(v).startsWith('rgba(31,27,22')).length;
    expect(inkStrokes).toBeGreaterThanOrEqual(1); // 墨花 ring
    expect(ctx.__calls.some((c) => c.fn === 'setLineDash')).toBe(false); // 无溅射环
  });
});

describe('M11 弓贰/叁：连珠箭与箭雨', () => {
  it('double 飞行段：两支箭在途（第二箭延迟）', () => {
    battleFx.consume([bowEv(1)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1550); // t=0.55 双箭在途
    const inkStrokes = sets(ctx, 'strokeStyle').filter((v) => v === '#1f1b16').length;
    expect(inkStrokes).toBeGreaterThanOrEqual(2); // 弦 + 两箭杆（至少两箭）
  });
  it('double 命中段：溅射环显形（虚线鎏金 r=70）+ 主/溅墨花', () => {
    battleFx.consume([bowEv(1)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1700);
    expect(ctx.__calls.some((c) => c.fn === 'setLineDash')).toBe(true);
    expect(sets(ctx, 'strokeStyle')).toContain('#c9a227');
    const inkStrokes = sets(ctx, 'strokeStyle').filter((v) => String(v).startsWith('rgba(31,27,22')).length;
    expect(inkStrokes).toBeGreaterThanOrEqual(2); // 主花+溅花
  });
  it('rain 飞行段：三箭上弧散射', () => {
    battleFx.consume([bowEv(2)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1580); // t=0.58 三箭在途
    const inkStrokes = sets(ctx, 'strokeStyle').filter((v) => v === '#1f1b16').length;
    expect(inkStrokes).toBeGreaterThanOrEqual(3); // 弦 + 三箭杆
  });
  it('rain 命中段：溅射环 r=110 + 三落点墨花错落', () => {
    battleFx.consume([bowEv(2)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1720);
    expect(ctx.__calls.some((c) => c.fn === 'setLineDash')).toBe(true);
    const inkStrokes = sets(ctx, 'strokeStyle').filter((v) => String(v).startsWith('rgba(31,27,22')).length;
    expect(inkStrokes).toBeGreaterThanOrEqual(3); // 三落点墨花
  });
});
