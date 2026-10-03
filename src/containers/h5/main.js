// containers/h5/main.js — 帧循环：rAF → advanceFrame → drawBattle
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

function loop(now) {
  const dtMs = Math.min(now - last, 100); // 切后台回来防大步积压
  last = now;
  state = advanceFrame(state, null, dtMs * SPEED);
  drawBattle(ctx, state);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
