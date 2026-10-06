// tests/render/bossWarn.test.js — M9 Boss 技能预警渲染：淡赭扇形浅渲 / 台词气泡 / 结算闪现 / 屏震
import { describe, it, expect } from 'vitest';
import * as battleFx from '../../src/render/battleFx.js';
import '../../src/render/art.js';
import { spawnEnemy } from '../../src/engine/enemy.js';

// Proxy mock ctx：记录方法调用与属性赋值（同 comboFx.test.js makeCtx 模式）
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
const alphas = (ctx) => ctx.__calls.filter((c) => c.set === 'globalAlpha').map((c) => c.val);

// lane0 t=0.9：距英雄 68px（扇形罩内），真实 spawn 保证 skill 字段与路径几何成立
function warnState() {
  const s = { enemies: [], nextEnemyId: 1, frameEvents: [] };
  spawnEnemy(s, 'shuai', 0);
  s.enemies[0].t = 0.9;
  s.enemies[0].skill.phase = 'warn';
  s.enemies[0].skill.clock = 0.5;
  s.enemies[0].skill.t0 = 0.9;
  return s;
}

describe('M9 drawBossSkill：warn 扇形（淡赭浅渲，贴水墨主风格）', () => {
  it('无 warn 且无闪现：不画任何东西', () => {
    battleFx.reset();
    const ctx = makeCtx();
    const drew = battleFx.drawBossSkill(ctx, { enemies: [] }, 1000);
    expect(drew).toBe(false);
    expect(ctx.__calls.filter((c) => c.fn === 'arc')).toHaveLength(0);
    expect(texts(ctx)).toHaveLength(0);
  });

  it('warn 中画扇形：#b03a2e 淡赭、填充 α≤0.12、描边虚线、全部 α≤0.35 浅渲', () => {
    battleFx.reset();
    const ctx = makeCtx();
    const drew = battleFx.drawBossSkill(ctx, warnState(), 1000);
    expect(drew).toBe(true);
    expect(ctx.__calls.some((c) => c.set === 'fillStyle' && c.val === '#b03a2e')).toBe(true);
    expect(ctx.__calls.some((c) => c.fn === 'fill')).toBe(true);
    const a = alphas(ctx);
    expect(a.length).toBeGreaterThan(0);
    expect(Math.max(...a)).toBeLessThanOrEqual(0.35);                        // 浅渲硬上限
    expect(a.some((v) => v <= 0.12)).toBe(true);                             // 填充段 ≤0.12
    expect(ctx.__calls.some((c) => c.fn === 'setLineDash')).toBe(true);      // 描边虚线
  });

  it('warn 中画台词气泡「看我横扫千军！」（仅 warn 段）', () => {
    battleFx.reset();
    const ctx = makeCtx();
    battleFx.drawBossSkill(ctx, warnState(), 1000);
    expect(texts(ctx).some((t) => String(t).includes('看我横扫千军'))).toBe(true);
  });
});

describe('M9 drawBossSkill：结算闪现 + 屏震', () => {
  it('consume bossSkill：触发小幅屏震；150ms 内闪现加深扇形（0<α≤0.3）且无气泡', () => {
    battleFx.reset();
    const now = 1000;
    battleFx.consume([{ type: 'bossSkill', x: 360, y: 572, dmg: 1 }], { enemies: [] }, now);
    expect(battleFx.shakeActive()).toBe(true); // 复用屏震基建（小幅）
    const ctx = makeCtx();
    const drew = battleFx.drawBossSkill(ctx, { enemies: [] }, now + 50);
    expect(drew).toBe(true);
    expect(ctx.__calls.some((c) => c.fn === 'fill')).toBe(true);
    const a = alphas(ctx);
    expect(Math.max(...a)).toBeGreaterThan(0);
    expect(Math.max(...a)).toBeLessThanOrEqual(0.3);   // 加深峰值 0.3 → 衰减
    expect(texts(ctx)).toHaveLength(0);                // 气泡仅 warn 段，闪现不带
  });

  it('闪现 150ms 后消失', () => {
    battleFx.reset();
    const now = 1000;
    battleFx.consume([{ type: 'bossSkill', x: 360, y: 572, dmg: 1 }], { enemies: [] }, now);
    const ctx = makeCtx();
    const drew = battleFx.drawBossSkill(ctx, { enemies: [] }, now + 200);
    expect(drew).toBe(false);
    expect(ctx.__calls.filter((c) => c.fn === 'fill')).toHaveLength(0);
  });

  it('warn 与闪现并存：两者都画（结算帧恰有另一 Boss 起手）', () => {
    battleFx.reset();
    const now = 1000;
    battleFx.consume([{ type: 'bossSkill', x: 360, y: 572, dmg: 1 }], { enemies: [] }, now);
    const ctx = makeCtx();
    const drew = battleFx.drawBossSkill(ctx, warnState(), now + 50);
    expect(drew).toBe(true);
    expect(texts(ctx).some((t) => String(t).includes('看我横扫千军'))).toBe(true); // warn 气泡在
    expect(ctx.__calls.filter((c) => c.fn === 'fill').length).toBeGreaterThanOrEqual(2); // warn 扇形 + 闪现扇形
  });
});
