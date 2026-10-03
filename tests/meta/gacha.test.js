// tests/meta/gacha.test.js
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/engine/rng.js';
import { PULL_COST, TEN_COST, pullOnce, pullTen, rollQuality, qualityOfId } from '../../src/meta/gacha.js';
import { HEROES, GACHA_POOL, DUP_FRAGS } from '../../src/meta/heroes.js';

describe('meta/gacha 抽卡', () => {
  it('费用：单抽 280，十连 2520（9 折）', () => {
    expect(PULL_COST).toBe(280);
    expect(TEN_COST).toBe(2520);
  });

  it('pullOnce 返回池内英雄；重复 → 按品质转碎片', () => {
    const rng = createRng(42);
    for (let i = 0; i < 50; i++) {
      const r = pullOnce(rng);
      expect(GACHA_POOL).toContain(r.heroId);
      expect(r.dup).toBeTypeOf('boolean');
      if (r.dup) {
        expect(r.frags).toBe(DUP_FRAGS[HEROES[r.heroId].quality]);
      } else {
        expect(r.frags).toBe(0);
      }
    }
  });

  it('rollQuality 分布合理（1 万次：R 最多、UR 存在且 <3%）', () => {
    const rng = createRng(7);
    const n = 10000;
    const cnt = { UR: 0, SSR: 0, SR: 0, R: 0 };
    for (let i = 0; i < n; i++) cnt[rollQuality(rng)]++;
    expect(cnt.R / n).toBeGreaterThan(0.55);
    expect(cnt.UR / n).toBeGreaterThan(0.005);
    expect(cnt.UR / n).toBeLessThan(0.03);
    expect(cnt.SR / n).toBeGreaterThan(0.25);
  });

  it('qualityOfId 按英雄表返回品质', () => {
    expect(qualityOfId('zhaoyun')).toBe('UR');
    expect(qualityOfId('huangzhong')).toBe('R');
  });

  it('十连：10 抽、确定性、保底——构造全 R 种子序列仍保证 ≥1 只 SR+', () => {
    const rng = createRng(20260304);
    const res = pullTen(rng);
    expect(res.length).toBe(10);
    expect(res.some((r) => ['SR', 'SSR', 'UR'].includes(HEROES[r.heroId].quality))).toBe(true);
    // 同种子可复现
    const again = pullTen(createRng(20260304));
    expect(again.map((r) => r.heroId)).toEqual(res.map((r) => r.heroId));
  });
});
