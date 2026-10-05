// containers/wx-mini/game.js — 微信小游戏容器薄壳
// 与 h5/main.js 同构：注入 Canvas + 桥接输入，逻辑全部在 app/core.js
import '../../render/art.js';
import { createApp } from '../../app/core.js';
import { LOGICAL_W, LOGICAL_H } from '../../engine/config.js';
import { showRewarded } from '../../platform/ads.js';
import { purchase } from '../../platform/iap.js';
import { initAudio, bgmStart } from '../../platform/audio.js';

// M7 音频：wx.createWebAudioContext 基础库 ≥2.19 可用；缺失则 initAudio 降级全 no-op（静默零风险）
initAudio(() => (typeof wx !== 'undefined' && wx.createWebAudioContext) ? wx.createWebAudioContext() : null);
wx.onTouchStart && wx.onTouchStart(() => bgmStart()); // 首次触摸解锁音频；bgmStart 内部去重防叠加

const canvas = wx.createCanvas(); // 主 canvas，内容自动拉伸铺满全屏
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
const ctx = canvas.getContext('2d');
const sys = wx.getSystemInfoSync(); // 兼容性优先；新 API getWindowInfo 基础库要求更高

const app = createApp({
  ctx,
  showRewarded,
  purchase,
  // 快进通道对齐 H5：预览时在启动参数带 ?speed=N
  getSpeed: () => Number(wx.getLaunchOptionsSync().query?.speed) || 1,
});
app.start();

wx.onTouchStart((e) => {
  const t = e.touches && e.touches[0];
  if (!t) return;
  // touch 坐标为逻辑像素（与 windowWidth 同基准），按比例映射到 720×1280
  app.handlePointer(
    (t.clientX / sys.windowWidth) * LOGICAL_W,
    (t.clientY / sys.windowHeight) * LOGICAL_H
  );
});
