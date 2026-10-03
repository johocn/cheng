// render/battle.js — 战场渲染：只读 state，每帧重绘
import {
  LOGICAL_W, LOGICAL_H, LANES, HERO_POS,
  TOTAL_WAVES, ITEM_TYPES, ROGUE_SKILLS, RARITY_NAMES, ULT_JICE_COST,
} from '../engine/config.js';
import { pathPoint } from '../engine/enemy.js';
import { countJice, canUlt } from '../engine/ult.js';
import { canMergeAt } from '../engine/slot.js';
import { beginUltShake, drawUltCinematic } from './fx.js';

const KAI = '"KaiTi","STKaiti","楷体",serif';
// 元素色 / 稀有色（UI 定稿）
const ELEM_COLORS = { 金: '#c9a227', 水: '#4a6fa5', 雷: '#6b4e9b', 火: '#b33a2b', 风: '#7ba098' };
const RARITY_COLORS = ['#52525b', '#4a6fa5', '#c9a227'];
// 锦囊槽定稿坐标：8 格 72×96，间隙 12，起点 (30, 1112)
const SLOT_X0 = 30, SLOT_Y = 1112, SLOT_W = 72, SLOT_H = 96, SLOT_STEP = 84;
// 大招按钮定稿坐标：圆心 (600, 985) r=52，就绪光环 r=62
const ULT_CX = 600, ULT_CY = 985, ULT_R = 52;

export function drawBattle(ctx, state) {
  const Art = window.Art;
  const shaken = state.ult ? beginUltShake(ctx, state) : false; // 大招尾段屏抖（save+translate）
  Art.drawBattleBackdrop(ctx, 0, 0, LOGICAL_W, LOGICAL_H);
  drawLanes(ctx);
  for (const e of state.enemies) {
    const p = pathPoint(e.lane, e.t);
    Art.drawEnemyToken(ctx, p.x, p.y, 26, e.type, e.hp / e.hpMax);
    drawStatusMarks(ctx, p, e);
  }
  Art.drawHeroToken(ctx, HERO_POS.x, HERO_POS.y, 34, 1);
  drawHud(ctx, state);
  drawWaveProgress(ctx, state);
  drawSlots(ctx, state);
  if (!state.ult) drawUltButton(ctx, state); // 演出期间隐藏大招按钮
  drawStageBanner(ctx, state);
  if (state.ult) drawUltCinematic(ctx, state);
  if (shaken) ctx.restore();
  if (state.stage === 'skillPick' && state.pickChoices) drawSkillPick(ctx, state);
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
  Art.drawHudPill(ctx, 260, 24, 130, 44, `第 ${state.wave || 1}/${TOTAL_WAVES} 波`, 'bronze');
  Art.drawHudPill(ctx, LOGICAL_W - 24 - 130, 24, 130, 44, `金 ${state.coins}`, 'gold');
}

// 15 波进度条：y=84 h=8 朱红填充 wave/15
function drawWaveProgress(ctx, state) {
  const Art = window.Art;
  const x = 24, y = 84, w = LOGICAL_W - 48, h = 8;
  Art.roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = 'rgba(31,27,22,0.18)';
  ctx.fill();
  const ratio = Math.min(1, (state.wave || 0) / TOTAL_WAVES);
  if (ratio > 0) {
    ctx.save();
    Art.roundRect(ctx, x, y, w, h, 4);
    ctx.clip();
    ctx.fillStyle = '#9e2a1e';
    ctx.fillRect(x, y, w * ratio, h);
    ctx.restore();
  }
}

// 锦囊槽 8 格：空格虚线框；实格卡片（顶色条+锦囊名 24px+元素字 13px）；3 同金边 4px+「合」角标
function drawSlots(ctx, state) {
  for (let i = 0; i < state.slots.length; i++) {
    drawSlotCell(ctx, SLOT_X0 + i * SLOT_STEP, SLOT_Y, SLOT_W, SLOT_H,
      state.slots[i], canMergeAt(state, i));
  }
}

function drawSlotCell(ctx, x, y, w, h, item, mergeable) {
  const Art = window.Art;
  ctx.save();
  if (!item) { // 空格：虚线框
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = 'rgba(31,27,22,0.35)';
    ctx.lineWidth = 1.5;
    Art.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
  } else {
    const def = ITEM_TYPES[item.type];
    const ec = ELEM_COLORS[def.elem] || '#52525b';
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#f4ecd8');
    g.addColorStop(1, '#ede4d2');
    Art.roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = g;
    ctx.fill();
    // 顶色条（元素色，随卡圆角裁切）
    ctx.save();
    Art.roundRect(ctx, x, y, w, h, 8);
    ctx.clip();
    ctx.fillStyle = ec;
    ctx.fillRect(x, y, w, 10);
    ctx.restore();
    // 描边：可合成金边 4px，否则墨细边
    ctx.lineWidth = mergeable ? 4 : 1.5;
    ctx.strokeStyle = mergeable ? '#c9a227' : 'rgba(31,27,22,0.4)';
    Art.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    // 锦囊名 24px 楷体 + 元素字 13px
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1f1b16';
    ctx.font = 'bold 24px ' + KAI;
    ctx.fillText(def.label, x + w / 2, y + 46);
    ctx.fillStyle = ec;
    ctx.font = 'bold 13px ' + KAI;
    ctx.fillText(def.elem, x + w / 2, y + 76);
    if (mergeable) { // 右上「合」角标
      const bx = x + w - 4, by = y + 4;
      ctx.fillStyle = '#c9a227';
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(31,27,22,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#1f1b16';
      ctx.font = 'bold 15px ' + KAI;
      ctx.fillText('合', bx, by + 1);
    }
  }
  ctx.restore();
}

// 大招按钮：无 ult 暗底+紫弧充能（计策 n/2）；2 计策金底+旋转虚线光环 r62（state.frame 驱动）
function drawUltButton(ctx, state) {
  const ready = canUlt(state);
  const n = countJice(state);
  ctx.save();
  const g = ctx.createRadialGradient(
    ULT_CX - ULT_R * 0.3, ULT_CY - ULT_R * 0.35, ULT_R * 0.2, ULT_CX, ULT_CY, ULT_R,
  );
  if (ready) { g.addColorStop(0, '#e8c96a'); g.addColorStop(1, '#a87e14'); }
  else { g.addColorStop(0, '#3a332a'); g.addColorStop(1, '#1f1b16'); }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ULT_CX, ULT_CY, ULT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ready ? '#f4ecd8' : 'rgba(184,150,62,0.5)';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (ready) {
    ctx.save(); // 旋转虚线光环，2s 一圈
    ctx.translate(ULT_CX, ULT_CY);
    ctx.rotate((state.frame % 120) / 120 * Math.PI * 2);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#1f1b16';
    ctx.font = 'bold 21px ' + KAI;
    ctx.fillText('七进七出', ULT_CX, ULT_CY + 1);
  } else {
    const charge = Math.min(1, n / ULT_JICE_COST); // 紫弧 charge = 计策数/2
    if (charge > 0) {
      ctx.strokeStyle = '#6b4e9b';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ULT_CX, ULT_CY, ULT_R - 6, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(237,228,210,0.8)';
    ctx.font = '13px ' + KAI;
    ctx.fillText(`计策 ${n}/${ULT_JICE_COST}`, ULT_CX, ULT_CY + 1);
  }
  ctx.restore();
}

// 兵法三择弹窗：暗幕全屏 → 面板 (60,88,600,452) + 三卡 (72/272/472, 216, 176×252)
function drawSkillPick(ctx, state) {
  const Art = window.Art;
  ctx.save();
  ctx.fillStyle = 'rgba(31,27,22,0.92)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  Art.drawPanel(ctx, 60, 88, 600, 452, false);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f1b16';
  ctx.font = 'bold 40px ' + KAI;
  ctx.fillText('兵 法 三 择', 360, 152);
  for (let i = 0; i < 3; i++) {
    const skill = ROGUE_SKILLS.find((s) => s.id === state.pickChoices[i]);
    if (skill) drawPickCard(ctx, 72 + i * 200, 216, 176, 252, skill);
  }
  ctx.fillStyle = '#5a5040';
  ctx.font = '16px ' + KAI;
  ctx.fillText('—— 点选一则兵法，即刻出征 ——', 360, 508);
  ctx.restore();
}

function drawPickCard(ctx, x, y, w, h, skill) {
  const Art = window.Art;
  const rc = RARITY_COLORS[skill.rarity] || RARITY_COLORS[0];
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#f6efdd');
  g.addColorStop(1, '#ede4d2');
  Art.roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3; // 稀有度描边
  ctx.strokeStyle = rc;
  Art.roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
  ctx.save(); // 顶条 10px（稀有色，随卡圆角裁切）
  Art.roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = rc;
  ctx.fillRect(x, y, w, 10);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f1b16';
  ctx.font = 'bold 34px ' + KAI; // 技能名
  ctx.fillText(skill.name, x + w / 2, y + 72);
  ctx.fillStyle = '#3a332a';
  ctx.font = '17px ' + KAI; // 效果（自动换行）
  wrapText(ctx, skill.desc, x + w / 2, y + 128, w - 26, 24);
  const pill = `${RARITY_NAMES[skill.rarity]} ${skill.weight}`; // 权重 pill
  ctx.font = 'bold 13px ' + KAI;
  const pw = ctx.measureText(pill).width + 22;
  const py = y + h - 42;
  Art.roundRect(ctx, x + w / 2 - pw / 2, py, pw, 24, 12);
  ctx.fillStyle = rc;
  ctx.fill();
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText(pill, x + w / 2, py + 13);
  ctx.restore();
}

function wrapText(ctx, text, cx, y0, maxW, lh) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    if (line && ctx.measureText(line + ch).width > maxW) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  lines.forEach((ln, i) => ctx.fillText(ln, cx, y0 + i * lh));
}

// 敌人状态标示：burn 头顶火色小三角 / slow 侧边青点 / stun 金色虚线圈
function drawStatusMarks(ctx, p, e) {
  ctx.save();
  if (e.burnT > 0) {
    ctx.fillStyle = '#b33a2b';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 56);
    ctx.lineTo(p.x - 6, p.y - 44);
    ctx.lineTo(p.x + 6, p.y - 44);
    ctx.closePath();
    ctx.fill();
  }
  if (e.slowT > 0) {
    ctx.fillStyle = '#4a6fa5';
    ctx.beginPath();
    ctx.arc(p.x - 32, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.stunT > 0) {
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 36, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
