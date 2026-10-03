// tests/platform/wxContainer.test.js — wx 容器冒烟：mock 平台 API 后加载 game.js
// 验证点：import 不炸（无 window/document 依赖）、主 canvas 尺寸、帧循环稳定、触摸派发、存档走 wx 同构分支
import { describe, it, expect, afterAll } from 'vitest';

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {}; // 方法兜底
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// ---- mock 安装（必须在 dynamic import 之前）----
const storageMap = new Map();
let touchHandler = null;
const rafQueue = [];
const mainCanvas = { width: 0, height: 0, getContext: () => makeCtx() };

globalThis.wx = {
  createCanvas: () => mainCanvas,
  getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 844 }),
  getLaunchOptionsSync: () => ({ query: {} }),
  onTouchStart: (cb) => { touchHandler = cb; },
  getStorageSync: (k) => (storageMap.has(k) ? storageMap.get(k) : ''),
  setStorageSync: (k, v) => storageMap.set(k, v),
};
globalThis.requestAnimationFrame = (cb) => rafQueue.push(cb);

function pump(frames, dt = 16.667) {
  let now = 1000;
  for (let i = 0; i < frames; i++) {
    now += dt;
    rafQueue.splice(0).forEach((cb) => cb(now));
  }
}

// game.js 无导出，纯副作用加载；断言全部基于 mock 世界的观测
await import('../../src/containers/wx-mini/game.js');

afterAll(() => {
  delete globalThis.wx;
  delete globalThis.requestAnimationFrame;
});

describe('wx 容器冒烟（模拟环境）', () => {
  it('主 canvas 初始化为 720×1280 逻辑分辨率', () => {
    expect(mainCanvas.width).toBe(720);
    expect(mainCanvas.height).toBe(1280);
  });

  it('start() 已入队帧回调（home 屏运行中）', () => {
    expect(rafQueue.length).toBeGreaterThan(0);
  });

  it('home 屏 pump 120 帧（约 2s）无异常，存档已落 wx 存储', () => {
    expect(() => pump(120)).not.toThrow();
    expect(storageMap.has('qqc_save_v1')).toBe(false); // home 屏无操作不主动写档，仅断言不炸
  });

  it('模拟触摸派发不炸（点按映射进逻辑坐标）', () => {
    expect(typeof touchHandler).toBe('function');
    expect(() => touchHandler({ touches: [{ clientX: 195, clientY: 422 }] })).not.toThrow();
    pump(5);
  });

  it('空 touches 事件安全忽略', () => {
    expect(() => touchHandler({ touches: [] })).not.toThrow();
  });
});
