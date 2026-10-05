// containers/h5/main.js — H5 容器薄壳（M4：逻辑抽至 app/core.js）
// 容器只做三件事：注入 Canvas、桥接输入、桥接平台 API
import '../../render/art.js'; // IIFE 素材库副作用导入，先于渲染层就绪
import { createApp } from '../../app/core.js';
import { LOGICAL_W, LOGICAL_H } from '../../engine/config.js';
import { showRewarded } from '../../platform/ads.js';
import { purchase } from '../../platform/iap.js';
import { initAudio, bgmStart } from '../../platform/audio.js';

// M7 音频：WebAudio 工厂注入（无 WebAudio 环境时 initAudio 内部降级为全 no-op）
initAudio(() => new (window.AudioContext || window.webkitAudioContext)());
// 首次用户交互后启动 BGM（浏览器自动播放策略：AudioContext 需用户手势解锁）
window.addEventListener('pointerdown', function once() {
  bgmStart();
  window.removeEventListener('pointerdown', once);
}, { once: true });

const canvas = document.getElementById('game');
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
const ctx = canvas.getContext('2d');

const app = createApp({
  ctx,
  showRewarded,
  purchase,
  // ?speed=N 时间倍率（验收快进用，core 内钳制 1-10，默认 1）
  getSpeed: () => Number(new URLSearchParams(location.search).get('speed')) || 1,
});
app.start();
if (import.meta.env.DEV) window.__app = app; // 冒烟钩子：配合 core.__debug 驱动终态（prod 不存在）

// 坐标换算：canvas CSS 显示尺寸（height:100dvh 自适应）→ 720×1280 逻辑坐标
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  app.handlePointer(
    (e.clientX - rect.left) * (LOGICAL_W / rect.width),
    (e.clientY - rect.top) * (LOGICAL_H / rect.height)
  );
});
