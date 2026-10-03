// render/battle.js — 战场渲染：只读 state，每帧重绘
import { LOGICAL_W, LOGICAL_H, LANES, HERO_POS } from '../engine/config.js';
import { pathPoint } from '../engine/enemy.js';

export function drawBattle(ctx, state) {
  const Art = window.Art;
  Art.drawBattleBackdrop(ctx, 0, 0, LOGICAL_W, LOGICAL_H);
  drawLanes(ctx);
  for (const e of state.enemies) {
    const p = pathPoint(e.lane, e.t);
    Art.drawEnemyToken(ctx, p.x, p.y, 26, e.type, e.hp / e.hpMax);
  }
  Art.drawHeroToken(ctx, HERO_POS.x, HERO_POS.y, 34, 1);
  drawHud(ctx, state);
  drawStageBanner(ctx, state);
}

function drawLanes(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(90,80,64,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  for (const lane of LANES) {
    ctx.beginPath();
    ctx.moveTo(lane[0].x, lane[0].y);
    for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x, lane[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx, state) {
  const Art = window.Art;
  Art.drawHudPill(ctx, 24, 24, 200, 44, `守军 ${state.hp}/${state.hpMax}`, 'ink');
  Art.drawHudPill(ctx, 260, 24, 130, 44, `第${state.wave || '一'}波`, 'bronze');
  Art.drawHudPill(ctx, LOGICAL_W - 24 - 130, 24, 130, 44, `金 ${state.coins}`, 'gold');
}

// 阶段横幅：波间歇倒计时 / 胜负终态
function drawStageBanner(ctx, state) {
  const cx = LOGICAL_W / 2;
  const cy = LOGICAL_H * 0.42;
  const Art = window.Art;
  if (state.stage === 'interval' && state.wave === 0) {
    banner(ctx, cx, cy, '长坂坡 · 备战', `第 1 波即将来袭`);
  } else if (state.stage === 'interval') {
    banner(ctx, cx, cy, `第 ${state.wave} 波 已清`, `下一波 ${Math.ceil(state.stageClock)} 秒后`);
  } else if (state.stage === 'victory') {
    banner(ctx, cx, cy, '大 获 全 胜', `七进七出 · 守军 ${state.hp}/${state.hpMax}`);
  } else if (state.stage === 'over') {
    banner(ctx, cx, cy, '阵 线 失 守', `止步第 ${state.wave} 波`);
  }
}

function banner(ctx, cx, cy, title, sub) {
  const Art = window.Art;
  Art.drawPanel(ctx, cx - 190, cy - 54, 380, 108, false);
  const fs = 44;
  ctx.fillStyle = '#1f1b16';
  ctx.font = `bold ${fs}px "KaiTi","STKaiti","楷体",serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, cx, cy - 18);
  ctx.fillStyle = '#9e2a1e';
  ctx.font = '22px "KaiTi","STKaiti","楷体",serif';
  ctx.fillText(sub, cx, cy + 24);
}
