// tests/meta/heroes.test.js
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HEROES, GACHA_POOL, DUP_FRAGS, STAR_MAX, FRAGS_PER_STAR,
  CHAPTERS, CH_HERO, chapterName, chapterMul, BOND_HEROES,
} from '../../src/meta/heroes.js';

describe('meta/heroes 数据表', () => {
  it('7 命英雄，品质与定位符合 spec', () => {
    expect(Object.keys(HEROES).length).toBe(7);
    expect(HEROES.zhaoyun).toMatchObject({ name: '赵云', quality: 'UR', initial: true });
    expect(HEROES.guanyu.quality).toBe('SSR');
    expect(HEROES.zhangfei.quality).toBe('SSR');
    expect(HEROES.zhugeliang.quality).toBe('SR');
    expect(HEROES.machao.quality).toBe('SR');
    expect(HEROES.huangzhong.quality).toBe('R');
    expect(HEROES.lvbu).toMatchObject({ quality: 'UR', obtain: '限时活动' });
  });

  it('吕布不进抽卡池、不参与羁绊；其余 6 命进池且为蜀国羁绊', () => {
    expect(GACHA_POOL).not.toContain('lvbu');
    expect(GACHA_POOL.length).toBe(6);
    expect(BOND_HEROES.length).toBe(6);
    expect(BOND_HEROES).not.toContain('lvbu');
    for (const id of GACHA_POOL) expect(BOND_HEROES).toContain(id);
  });

  it('重复转碎片：UR15 SSR5 SR3 R1；升星 3 碎片/星 ★5 封顶', () => {
    expect(DUP_FRAGS).toEqual({ UR: 15, SSR: 5, SR: 3, R: 1 });
    expect(FRAGS_PER_STAR).toBe(3);
    expect(STAR_MAX).toBe(5);
  });

  it('章节表：6 章名循环、系数 1.5^(N-1)', () => {
    expect(chapterName(1)).toBe('长坂坡');
    expect(chapterName(7)).toBe('长坂坡');
    expect(chapterMul(1)).toBe(1);
    expect(chapterMul(2)).toBeCloseTo(1.5);
    expect(chapterMul(3)).toBeCloseTo(2.25);
    expect(CH_HERO[0]).toBe('zhaoyun');
    expect(CH_HERO[1]).toBe('guanyu');
  });
});

describe('M6 立绘资产', () => {
  it('9 张立绘入库且单张 ≤80KB', () => {
    const dir = join(fileURLToPath(new URL('.', import.meta.url)), '../../src/assets/heroes');
    const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
    expect(files.length).toBe(9);
    for (const f of files) {
      expect(statSync(join(dir, f)).size).toBeLessThanOrEqual(80 * 1024);
    }
  });
});
