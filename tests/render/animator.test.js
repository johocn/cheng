// tests/render/animator.test.js — M8 姿态纯函数：四类敌人 × 四态；双皮肤调色板
import { describe, it, expect, beforeEach } from 'vitest';
import { pose, drawEnemyFigure, drawHeroSpear, figureHeight } from '../../src/render/animator.js';
import '../../src/render/art.js';   // 挂 globalThis.Art
import { setSkin } from '../../src/render/theme.js';

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

beforeEach(() => setSkin('ink'));

describe('M8 pose 姿态函数（纯数据）', () => {
  it('walk：上下颠簸 bob 正弦 + 腿摆 + 前倾', () => {
    const a = pose('bing', 'walk', 0);
    const b = pose('bing', 'walk', 0.2); // t*8: 0 → 1.6rad，sin 变化
    expect(a.lean).toBeGreaterThan(0);   // 前倾赶路
    expect(b.bob).not.toBe(a.bob);       // 颠簸随相位变化
    expect(Math.abs(b.limbSwing)).toBeLessThanOrEqual(1);
  });

  it('attack：前倾+挥砍弧 200ms 内推进，超时归位', () => {
    const p1 = pose('bing', 'attack', 0.1);
    expect(p1.lean).toBeGreaterThan(0);
    expect(p1.weaponAngle).toBeGreaterThan(-1.1); // 弧从 -63° 起步
    const p2 = pose('bing', 'attack', 0.3);       // 超时
    expect(p2.lean).toBe(0);
  });

  it('hit：flash 从 1 衰减，80ms 后归零；后仰 lean 为负', () => {
    const p0 = pose('bing', 'hit', 0);
    expect(p0.flash).toBe(1);
    expect(p0.lean).toBeLessThan(0);
    const pEnd = pose('bing', 'hit', 0.08);
    expect(pEnd.flash).toBe(0);
  });

  it('die：alpha 1→0、sink 0→12、400ms 走完', () => {
    const p0 = pose('bing', 'die', 0);
    expect(p0.alpha).toBe(1);
    expect(p0.sink).toBe(0);
    const pMid = pose('bing', 'die', 0.2);
    expect(pMid.alpha).toBeCloseTo(0.5, 5);
    expect(pMid.sink).toBeCloseTo(6, 5);
    const pEnd = pose('bing', 'die', 0.4);
    expect(pEnd.alpha).toBe(0);
  });

  it('四类敌人 × 四态全组合输出合法数值（无 NaN）', () => {
    for (const type of ['bing', 'gong', 'qi', 'shuai']) {
      for (const st of ['walk', 'attack', 'hit', 'die']) {
        const pz = pose(type, st, 0.13);
        for (const k of ['lean', 'bob', 'weaponAngle', 'flash', 'alpha', 'sink']) {
          expect(Number.isFinite(pz[k])).toBe(true);
        }
      }
    }
  });

  it('figureHeight：敌人视高 48-56px 区间（mockup v2 定稿约 2 倍圆牌）', () => {
    expect(figureHeight('bing')).toBeGreaterThanOrEqual(48);
    expect(figureHeight('shuai')).toBeLessThanOrEqual(56);
  });
});

describe('M8 绘制（mock ctx 冒烟 + 双皮肤）', () => {
  it('四类敌人 drawEnemyFigure 不炸', () => {
    for (const type of ['bing', 'gong', 'qi', 'shuai']) {
      const pz = pose(type, 'walk', 0.1);
      expect(() => drawEnemyFigure(makeCtx(), 100, 100, type, pz)).not.toThrow();
    }
  });

  it('die 态 alpha=0 时绘制安全（ghost 收尾）', () => {
    const pz = pose('bing', 'die', 0.5);
    expect(() => drawEnemyFigure(makeCtx(), 100, 100, 'bing', pz)).not.toThrow();
  });

  it('双皮肤 1:1：皮影下填充色为暖字色（读 Art.C 现值）', () => {
    const seen = [];
    const ctx = new Proxy({}, {
      get(t, k) {
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k === 'measureText') return () => ({ width: 10 });
        if (typeof k === 'string' && k === 'fillStyle') return t.fillStyle;
        if (typeof k === 'string' && !(k in t)) return () => {};
        return t[k];
      },
      set(t, k, v) { if (k === 'fillStyle') seen.push(v); t[k] = v; return true; },
    });
    setSkin('shadow');
    drawEnemyFigure(ctx, 100, 100, 'bing', pose('bing', 'walk', 0));
    expect(seen).toContain('#f0d9a8'); // theme.js SHADOW_ART.ink
    setSkin('ink');
  });

  it('drawHeroSpear 不炸', () => {
    expect(() => drawHeroSpear(makeCtx(), 360, 640, 0.5, 0.1)).not.toThrow();
  });
});
