// src/render/theme.js — 皮肤体系（spec 6.5）：皮肤 = 调色板 + 战场背景绘制器
// 写实水墨 ink（默认）/ 皮影戏 shadow（广告解锁）。改写 ui.js 与 art.js 的共享色板对象，
// 渲染函数在每帧绘制时读取色板 → 换肤即时全屏生效，engine 层零改动。
import { C as UI_C } from './ui.js';

// 皮影调色板：暗底暖光（#1a1410 系底 + 灯窗光晕）+ 镂空剪影暖字 + 朱砂/鎏金纹样
const SHADOW_UI = {
  paper: '#241a12', paper2: '#2e2118', card: '#332619',
  ink: '#f0d9a8', bronze: '#a8792a', gold: '#e8c05a',
  cinnabar: '#b23a28', mut: '#a08858', gray: '#7a6644', ok: '#7a9a5a',
  paperHi: '#3a2a1c', paperDeep: '#2a1e13',
};
const SHADOW_ART = {
  paper: '#241a12', paperHi: '#3a2a1c', paperDeep: '#2a1e13', paperShadow: '#221810',
  ink: '#f0d9a8', inkMid: '#d8bd82', inkSoft: '#b89858',
  bronze: '#a8792a', bronzeLt: '#d0a84a', gold: '#e8c05a',
  seal: '#b23a28', sealHi: '#c94a34', jade: '#5a7a62',
  laneInk: 'rgba(232,192,90,0.4)',
};

let skinId = 'ink';
let ORIG_UI = null;  // 首次切肤时快照，供还原
let ORIG_ART = null;

export function currentSkin() { return skinId; }

export function setSkin(id) {
  if (id !== 'ink' && id !== 'shadow') return;
  skinId = id;
  const Art = globalThis.Art;
  if (Art && !ORIG_ART) ORIG_ART = { ...Art.C };
  if (!ORIG_UI) ORIG_UI = { ...UI_C };
  if (Art) Art.skinId = id;
  applyTo(UI_C, id === 'shadow' ? SHADOW_UI : ORIG_UI);
  if (Art) applyTo(Art.C, id === 'shadow' ? SHADOW_ART : ORIG_ART);
}

function applyTo(target, patch) {
  for (const k in patch) target[k] = patch[k];
}
