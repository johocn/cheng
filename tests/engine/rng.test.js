import { describe, it, expect } from 'vitest';
import { createRng, rngNext, rngPick, rngInt } from '../../src/engine/rng.js';

describe('种子 RNG（mulberry32）', () => {
  it('同种子序列完全一致（确定性）', () => {
    const a = createRng(42), b = createRng(42);
    for (let i = 0; i < 100; i++) expect(rngNext(a)).toBe(rngNext(b));
  });

  it('不同种子序列不同', () => {
    const a = createRng(1), b = createRng(2);
    expect(rngNext(a)).not.toBe(rngNext(b));
  });

  it('rngNext 就地推进 state（可序列化进 battle state）', () => {
    const r = createRng(7);
    const s1 = r.s;
    rngNext(r);
    expect(r.s).not.toBe(s1);
  });

  it('rngPick 返回数组元素；rngInt 在 [0,n) 且可到边界 0', () => {
    const r = createRng(9);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(rngPick(r, arr));
    for (let i = 0; i < 50; i++) {
      const v = rngInt(r, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(3);
    }
  });
});
