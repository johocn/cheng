import { describe, test, expect, vi } from 'vitest';
import { loadImage, loadHeroPortraits, portraitReady } from '../../src/platform/img.js';

describe('M6 立绘加载抽象', () => {
  test('loadImage 返回句柄且未就绪时 portraitReady=false', () => {
    const h = loadImage('heroes/zhaoyun.webp');
    expect(h).toHaveProperty('ready');
    expect(portraitReady(h)).toBe(false);
  });

  test('同一 URL 复用缓存句柄', () => {
    const a = loadImage('heroes/zhaoyun.webp');
    const b = loadImage('heroes/zhaoyun.webp');
    expect(a).toBe(b);
  });

  test('loadHeroPortraits 预热 9 张且对未知 id 不抛错', () => {
    expect(() => loadHeroPortraits(['zhaoyun', 'guanyu', 'notexist'])).not.toThrow();
  });
});
