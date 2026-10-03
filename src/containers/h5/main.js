// containers/h5/main.js — 帧循环：rAF → advanceFrame → drawBattle；pointerdown → hitTest 输入通道
import '../../render/art.js'; // IIFE 素材库副作用导入，先于渲染层就绪（window.Art）
import { createBattle, advanceFrame } from '../../engine/state.js';
import { LOGICAL_W, LOGICAL_H } from '../../engine/config.js';
import { drawBattle } from '../../render/battle.js';

const canvas = document.getElementById('game');
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
const ctx = canvas.getContext('2d');

// ?speed=N 时间倍率（验收快进用，1-10，默认 1）
const SPEED = Math.max(1, Math.min(10,
  Number(new URLSearchParams(location.search).get('speed')) || 1));

let state = createBattle();
let last = performance.now();
let pendingInputs = null; // 本帧收集的点击，帧循环消费一次后置 null

// 坐标换算：canvas CSS 显示尺寸（height:100dvh 自适应）→ 720×1280 逻辑坐标
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (LOGICAL_W / rect.width);
  const y = (e.clientY - rect.top) * (LOGICAL_H / rect.height);
  pendingInputs = hitTest(x, y, state); // {clickSlot}|{useUlt}|{pickSkill}|null
});

function hitTest(x, y, st) {
  // skillPick 三卡: (72..648, 216..468) 三等分 176 宽 → pickSkill 0/1/2
  if (st.stage === 'skillPick' && st.pickChoices) {
    if (y >= 216 && y <= 468) {
      for (let i = 0; i < 3; i++) {
        const cx0 = 72 + i * 200;
        if (x >= cx0 && x <= cx0 + 176) return { pickSkill: i };
      }
    }
    return null;
  }
  // 锦囊槽: y 1112..1208, 8 格 x=30+i*84 宽 72
  if (y >= 1112 && y <= 1208) {
    const i = Math.floor((x - 30) / 84);
    if (i >= 0 && i < 8 && (x - 30) - i * 84 <= 72) return { clickSlot: i };
  }
  // 大招按钮: 圆心(600,985) r=60（容差+8）
  const dx = x - 600, dy = y - 985;
  if (dx * dx + dy * dy <= 60 * 60) return { useUlt: true };
  return null;
}

function loop(now) {
  const dtMs = Math.min(now - last, 100); // 切后台回来防大步积压
  last = now;
  state = advanceFrame(state, pendingInputs, dtMs * SPEED);
  pendingInputs = null; // 每帧消费一次
  drawBattle(ctx, state);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
