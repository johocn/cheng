// tests/render/spearFx.test.js — M11 枪四档演出 + 金环脉冲 + 放大项（battleFx.drawHeroAttack）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as battleFx from '../../src/render/battleFx.js';
import * as particles from '../../src/render/particles.js';
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
const arcs = (ctx) => ctx.__calls.filter((c) => c.fn === 'arc').map((c) => c.args);
const spearEv = (stage) => ({
  type: 'heroAtk', mode: 'spear', stage, ang: -0.6, x: 430, y: 560,
  range: [180, 210, 240, 270][stage], splash: null,
});

beforeEach(() => battleFx.reset());

describe('M11 heroAttackAnim：heroAtk 事件驱动', () => {
  it('consume spear stage=2 → active/mode/stage/range 正确', () => {
    battleFx.consume([spearEv(2)], {}, 1000);
    const a = battleFx.heroAttackAnim(1000 + 50);
    expect(a.active).toBe(true);
    expect(a.mode).toBe('spear');
    expect(a.stage).toBe(2);
    expect(a.range).toBe(240);
    expect(a.ang).toBeCloseTo(-0.6);
  });
  it('thrust 时长 250ms：230ms 时 active，270ms 后 inactive', () => {
    battleFx.consume([spearEv(0)], {}, 1000);
    expect(battleFx.heroAttackAnim(1230).active).toBe(true);
    expect(battleFx.heroAttackAnim(1270).active).toBe(false);
  });
  it('sweep 时长 340ms：320ms active，360ms inactive', () => {
    battleFx.consume([spearEv(2)], {}, 1000);
    expect(battleFx.heroAttackAnim(1320).active).toBe(true);
    expect(battleFx.heroAttackAnim(1360).active).toBe(false);
  });
});

describe('M11 drawHeroAttack：枪四档', () => {
  it('thrust：金杆+朱砂红缨+金环脉冲，不画扇形/射程环', () => {
    battleFx.consume([spearEv(0)], {}, 1000);
    const ctx = makeCtx();
    expect(battleFx.drawHeroAttack(ctx, 1050)).toBe(true);
    expect(sets(ctx, 'strokeStyle')).toContain('#c9a227');   // 枪杆/金环
    expect(sets(ctx, 'fillStyle')).toContain('#9e2a1e');     // 红缨
    expect(sets(ctx, 'fillStyle').some((v) => String(v).startsWith('rgba(31,27,22'))).toBe(false);
    expect(ctx.__calls.some((c) => c.fn === 'setLineDash')).toBe(false);
  });
  it('pierce：双层残影（≥3 次金杆 stroke）+ 枪尖气浪墨线', () => {
    battleFx.consume([spearEv(1)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1250); // q=0.5 残影与气浪均可见
    const goldStrokes = ctx.__calls.filter((c) => c.fn === 'stroke' && c.args.length === 0).length;
    expect(goldStrokes).toBeGreaterThanOrEqual(3); // 主枪 + 2 残影 + 金环
    expect(sets(ctx, 'strokeStyle').some((v) => String(v).startsWith('rgba(31,27,22'))).toBe(true); // 气浪
  });
  it('sweep：扇形墨浪 α≤0.16 + 三道鎏金飞白弧', () => {
    battleFx.consume([spearEv(2)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1120); // q≈0.35
    const fills = sets(ctx, 'fillStyle').filter((v) => String(v).startsWith('rgba(31,27,22'));
    expect(fills.length).toBeGreaterThan(0);
    for (const f of fills) expect(parseFloat(f.match(/rgba\(31,27,22,([\d.]+)\)/)[1])).toBeLessThanOrEqual(0.16);
    expect(arcs(ctx).length).toBeGreaterThanOrEqual(3); // 扇形弧+3 金弧
  });
  it('circle：鎏金虚线射程环（半径=事件 range 270）+ 双圈墨波 + 枪影', () => {
    battleFx.consume([spearEv(3)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1150); // q=0.3
    expect(ctx.__calls.some((c) => c.fn === 'setLineDash')).toBe(true);
    expect(arcs(ctx).some((a) => Math.abs(a[2] - 270) < 2)).toBe(true); // 射程环半径
    const inks = sets(ctx, 'strokeStyle').filter((v) => String(v).startsWith('rgba(31,27,22'));
    expect(inks.length).toBeGreaterThanOrEqual(2); // 墨波两圈
  });
  it('演出结束不画：500ms 后返回 false', () => {
    battleFx.consume([spearEv(3)], {}, 1000);
    const ctx = makeCtx();
    expect(battleFx.drawHeroAttack(ctx, 1500)).toBe(false);
    expect(ctx.__calls).toHaveLength(0);
  });
  it('金环脉冲：所有枪档通用（半径 24→40 内的鎏金 arc）', () => {
    battleFx.consume([spearEv(0)], {}, 1000);
    const ctx = makeCtx();
    battleFx.drawHeroAttack(ctx, 1050);
    const pulse = arcs(ctx).some((a) => a[2] > 24 && a[2] < 45);
    expect(pulse).toBe(true);
  });
});

describe('M11 放大项', () => {
  it('hit 溅墨放大：普通 14 粒、暴击 18 粒', () => {
    const spy = vi.spyOn(particles, 'splash');
    battleFx.consume([{ type: 'hit', x: 100, y: 200, dmg: 60, crit: false, enemyId: 1, enemyType: 'bing' }], {}, 1000);
    battleFx.consume([{ type: 'hit', x: 150, y: 200, dmg: 120, crit: true, enemyId: 2, enemyType: 'bing' }], {}, 1010);
    expect(spy).toHaveBeenNthCalledWith(1, 100, 200, 14);
    expect(spy).toHaveBeenNthCalledWith(2, 150, 200, 18);
    vi.restoreAllMocks();
  });
  it('飘字字号：普通 18px、暴击 22px', () => {
    battleFx.consume([{ type: 'hit', x: 100, y: 200, dmg: 60, crit: false, enemyId: 1, enemyType: 'bing' }], {}, 1000);
    battleFx.consume([{ type: 'hit', x: 150, y: 200, dmg: 120, crit: true, enemyId: 2, enemyType: 'bing' }], {}, 1010);
    const fl = battleFx.floats();
    expect(fl[0].size).toBe(18);
    expect(fl[1].size).toBe(22);
  });
  it('暴击 hitStop 加深：70ms 内冻结、80ms 恢复', () => {
    battleFx.consume([{ type: 'hit', x: 100, y: 200, dmg: 120, crit: true, enemyId: 1, enemyType: 'bing' }], {}, 2000);
    expect(battleFx.frozen(2050)).toBe(true);
    expect(battleFx.frozen(2090)).toBe(false);
  });
});
