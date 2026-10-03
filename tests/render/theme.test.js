// tests/render/theme.test.js — 皮肤切换：改写共享色板，ink 可还原
import { describe, it, expect, beforeAll } from 'vitest';
import '../../src/render/art.js'; // IIFE 副作用：挂 globalThis.Art
import { setSkin, currentSkin } from '../../src/render/theme.js';
import { C as UI_C } from '../../src/render/ui.js';

describe('theme 皮肤体系', () => {
  beforeAll(() => setSkin('ink'));

  it('默认水墨', () => {
    expect(currentSkin()).toBe('ink');
    expect(globalThis.Art.skinId).toBe('ink');
  });
  it('切皮影：UI/Art 色板翻转（暗底暖光）', () => {
    setSkin('shadow');
    expect(currentSkin()).toBe('shadow');
    expect(globalThis.Art.skinId).toBe('shadow');
    expect(UI_C.paper).toBe('#241a12');       // 页面底 → 暗木
    expect(UI_C.ink).toBe('#f0d9a8');         // 面板文字 → 暖光
    expect(globalThis.Art.C.paper).toBe('#241a12');
    expect(globalThis.Art.C.ink).toBe('#f0d9a8');
    expect(typeof globalThis.Art.drawShadowBackdrop).toBe('function');
  });
  it('切回水墨：完整还原初始色板', () => {
    setSkin('ink'); // 先回水墨再快照（前一用例遗留 shadow 态）
    const uiBefore = { ...UI_C }, artBefore = { ...globalThis.Art.C };
    setSkin('shadow');
    setSkin('ink');
    expect(UI_C).toEqual(uiBefore);
    expect(globalThis.Art.C).toEqual(artBefore);
    expect(globalThis.Art.skinId).toBe('ink');
  });
  it('非法皮肤 id 忽略', () => {
    setSkin('kids');
    expect(currentSkin()).toBe('ink');
  });
});
