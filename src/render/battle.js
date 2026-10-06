// render/battle.js — 战场渲染：只读 state，每帧重绘
// M8：部件小人 + 打击感反馈（飘字/幽灵/屏震/红闪）+ 场景层次（双层远山/氛围墨点/路径质感）
import {
  LOGICAL_W, LOGICAL_H, LANES, HERO_POS,
  TOTAL_WAVES, ITEM_TYPES, ROGUE_SKILLS, RARITY_NAMES, ULT_JICE_COST,
} from '../engine/config.js';
import { pathPoint } from '../engine/enemy.js';
import { countJice, canUlt } from '../engine/ult.js';
import { canMergeAt } from '../engine/slot.js';
import { beginUltShake, drawUltCinematic } from './fx.js';
import { pose, drawEnemyFigure, drawHeroSpear, figureHeight } from './animator.js';
import * as battleFx from './battleFx.js';
import * as particles from './particles.js';
import { drawCinematic } from './cinematic.js';

const KAI = '"KaiTi","STKaiti","楷体",serif';
// 元素色 / 稀有色（UI 定稿）
const ELEM_COLORS = { 金: '#c9a227', 水: '#4a6fa5', 雷: '#6b4e9b', 火: '#b33a2b', 风: '#7ba098' };
const RARITY_COLORS = ['#52525b', '#4a6fa5', '#c9a227'];
// 锦囊槽定稿坐标：8 格 72×96，间隙 12，起点 (30, 1112)
const SLOT_X0 = 30, SLOT_Y = 1112, SLOT_W = 72, SLOT_H = 96, SLOT_STEP = 84;
// 大招按钮定稿坐标：圆心 (600, 985) r=52，就绪光环 r=62
const ULT_CX = 600, ULT_CY = 985, ULT_R = 52;

export function drawBattle(ctx, state) {
  const Art = globalThis.Art;
  const now = battleFx.nowClock(); // 与 core consume 同口径（渲染时钟），禁用 performance.now 混用
  const shaken1 = state.ult ? beginUltShake(ctx, state) : false; // 大招尾段屏抖
  const shaken2 = battleFx.beginShake(ctx);                      // 击杀/登场屏震
  if (Art.skinId === 'shadow') Art.drawShadowBackdrop(ctx, 0, 0, LOGICAL_W, LOGICAL_H);
  else Art.drawBattleBackdrop(ctx, 0, 0, LOGICAL_W, LOGICAL_H, state.frame / 60); // M8 双层远山随引擎时钟缓移
  drawLanes(ctx);
  drawAmbient(ctx, state);
  drawGhosts(ctx, now);
  for (const e of state.enemies) drawEnemy(ctx, e, now);
  drawHero(ctx, state, now);
  drawHud(ctx, state);
  drawWaveProgress(ctx, state);
  drawSlots(ctx, state);
  if (!state.ult) drawUltButton(ctx, state);
  drawStageBanner(ctx, state);
  drawLeakFlash(ctx, now);
  battleFx.drawFloatsPublic(ctx, now); // 飘字（battleFx 导出的绘制）
  particles.draw(ctx);
  drawCinematic(ctx);                  // Boss 卷轴 / 斩杀慢镜（全屏演出最上层）
  if (state.ult) drawUltCinematic(ctx, state);
  if (shaken2) battleFx.endShake(ctx);
  if (shaken1) ctx.restore();
  if (state.stage === 'skillPick' && state.pickChoices) drawSkillPick(ctx, state);
}

// ===== M8 新增：路径质感（晕染底 + 主虚线 + 路口墨点）=====
function drawLanes(ctx) {
  const Art = globalThis.Art;
  ctx.save();
  ctx.lineCap = 'round';
  // 底层晕染 8px 低透明
  ctx.strokeStyle = 'rgba(90,80,64,0.18)';
  ctx.lineWidth = 8;
  for (const lane of LANES) strokeLane(ctx, lane);
  // 主线 3px 虚线
  ctx.strokeStyle = Art.C.laneInk;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  for (const lane of LANES) strokeLane(ctx, lane);
  ctx.setLineDash([]);
  // 路口墨点加重（拐点+终点）
  ctx.fillStyle = 'rgba(31,27,22,0.5)';
  for (const lane of LANES) {
    for (const pt of lane.slice(1)) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function strokeLane(ctx, lane) {
  ctx.beginPath();
  ctx.moveTo(lane[0].x, lane[0].y);
  for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x, lane[i].y);
  ctx.stroke();
}

// ===== M8 新增：氛围墨点（6 颗确定性缓浮，frame 驱动零状态）=====
function drawAmbient(ctx, state) {
  const Art = globalThis.Art;
  const t = state.frame / 60;
  const cols = [Art.C.ink, Art.C.ink, Art.C.seal, Art.C.ink, Art.C.seal, Art.C.ink];
  for (let i = 0; i < 6; i++) {
    const ph = t * (0.05 + i * 0.011) + i * 1.9;
    const x = ((i * 137 + Math.sin(ph) * 40) % LOGICAL_W + LOGICAL_W) % LOGICAL_W;
    const y = ((i * 331 + t * (6 + i)) % LOGICAL_H + LOGICAL_H) % LOGICAL_H;
    ctx.globalAlpha = 0.1 + (i % 2) * 0.04;
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== M8 新增：死亡幽灵（die 态小人 + 墨散由粒子侧已发）=====
function drawGhosts(ctx, now) {
  const ghosts = battleFx.activeGhosts(now); // battleFx 导出的快照遍历
  for (const g of ghosts) {
    const age = Math.max(0, Math.min(0.4, (now - g.bornAt) / 1000));
    const pz = pose(g.type, 'die', age);
    drawEnemyFigure(ctx, g.x, g.y, g.type, pz);
  }
}

// ===== M8 改造：敌人绘制（圆牌 → 部件小人）=====
function drawEnemy(ctx, e, now) {
  const Art = globalThis.Art;
  const p = pathPoint(e.lane, e.t);
  // 动画态判定：受击 flash → hit；投石车轰击（tou 且刚漏过）→ attack；否则 walk
  let anim = 'walk';
  if (battleFx.enemyHitFlash(e.id, now)) anim = 'hit';
  const phase = now / 1000 + e.id * 0.7; // enemyId 错开步频
  const pz = pose(e.type, anim, phase);
  // 击退 offset：路径切线反向 × 6px × 回弹相位（视觉层 offset，engine pos 不改）
  let kx = 0, ky = 0;
  const kp = battleFx.enemyKnockPhase(e.id, now);
  if (kp > 0) {
    const a = pathPoint(e.lane, Math.max(0, e.t - 0.01));
    const b = pathPoint(e.lane, e.t);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    kx = (-dx / len) * 6 * kp;
    ky = (-dy / len) * 6 * kp;
  }
  // 血条（朱砂，小人头顶）
  drawHpBar(ctx, p.x + kx, p.y - figureHeight(e.type) - 12, e.hp / e.hpMax);
  drawEnemyFigure(ctx, p.x + kx, p.y + pz.bob + ky, e.type, pz);
  // 精英词缀印（沿用 Art.sealStamp）
  if (e.affix) {
    Art.sealStamp(ctx, p.x + kx + 22, p.y - figureHeight(e.type) + 6, 14, Art.AFFIX_TEXT[e.affix] || '精', 'gold', 8);
  }
  drawStatusMarks(ctx, p, e);
}

// M8 新增：敌人血条（原 drawEnemyToken 内置逻辑外置）
function drawHpBar(ctx, x, y, ratio) {
  if (ratio >= 1) return;
  const bw = 40, bh = 4;
  ctx.fillStyle = 'rgba(31,27,22,0.55)';
  ctx.fillRect(x - bw / 2, y, bw, bh);
  ctx.fillStyle = '#9e2a1e';
  ctx.fillRect(x - bw / 2, y, bw * Math.max(0, Math.min(1, ratio)), bh);
}

// ===== M8 改造：赵云（双环底牌保留 + 攻击突刺长枪）=====
function drawHero(ctx, state, now) {
  const Art = globalThis.Art;
  Art.drawHeroToken(ctx, HERO_POS.x, HERO_POS.y, 36, 1);
  const atk = battleFx.heroAttackAnim(now);
  if (atk.active) drawHeroSpear(ctx, HERO_POS.x, HERO_POS.y, atk.ang, atk.t);
}

// ===== M8 新增：漏怪城门红闪（200ms）=====
function drawLeakFlash(ctx, now) {
  if (!battleFx.leakFlash(now)) return;
  const g = ctx.createRadialGradient(HERO_POS.x, HERO_POS.y, 40, HERO_POS.x, HERO_POS.y, 200);
  g.addColorStop(0, 'rgba(158,42,30,0)');
  g.addColorStop(0.7, 'rgba(158,42,30,0.28)');
  g.addColorStop(1, 'rgba(158,42,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(HERO_POS.x - 200, HERO_POS.y - 200, 400, 400);
}

function drawHud(ctx, state) {
  const Art = globalThis.Art;
  Art.drawHudPill(ctx, 24, 24, 200, 44, `守军 ${state.hp}/${state.hpMax}`, 'ink');
  Art.drawHudPill(ctx, 260, 24, 130, 44, `第 ${state.wave || 1}/${TOTAL_WAVES} 波`, 'bronze');
  Art.drawHudPill(ctx, LOGICAL_W - 24 - 130, 24, 130, 44, `金 ${state.coins}`, 'gold');
}

// 15 波进度条：y=84 h=8 朱红填充 wave/15
function drawWaveProgress(ctx, state) {
  const Art = globalThis.Art;
  const x = 24, y = 84, w = LOGICAL_W - 48, h = 8;
  Art.roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = 'rgba(31,27,22,0.18)';
  ctx.fill();
  const ratio = Math.min(1, (state.wave || 0) / TOTAL_WAVES);
  if (ratio > 0) {
    ctx.save();
    Art.roundRect(ctx, x, y, w, h, 4);
    ctx.clip();
    ctx.fillStyle = Art.C.seal;
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
  const Art = globalThis.Art;
  ctx.save();
  if (!item) { // 空格：虚线框
    ctx.setLineDash([7, 5]);
    ctx.strokeStyle = 'rgba(160,136,88,0.55)';
    ctx.lineWidth = 1.5;
    Art.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
  } else {
    const def = ITEM_TYPES[item.type];
    const ec = ELEM_COLORS[def.elem] || '#52525b';
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, Art.C.paperHi);
    g.addColorStop(1, Art.C.paper);
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
    ctx.strokeStyle = mergeable ? Art.C.gold : 'rgba(31,27,22,0.4)';
    Art.roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    // 锦囊名 24px 楷体 + 元素字 13px
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = Art.C.ink;
    ctx.font = 'bold 24px ' + KAI;
    ctx.fillText(def.label, x + w / 2, y + 46);
    ctx.fillStyle = ec;
    ctx.font = 'bold 13px ' + KAI;
    ctx.fillText(def.elem, x + w / 2, y + 76);
    if (mergeable) { // 右上「合」角标
      const bx = x + w - 4, by = y + 4;
      ctx.fillStyle = Art.C.gold;
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(31,27,22,0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = Art.C.ink;
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
  const Art = globalThis.Art;
  ctx.save();
  ctx.fillStyle = 'rgba(31,27,22,0.92)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  Art.drawPanel(ctx, 60, 88, 600, 452, false);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = Art.C.ink;
  ctx.font = 'bold 40px ' + KAI;
  ctx.fillText('兵 法 三 择', 360, 152);
  for (let i = 0; i < 3; i++) {
    const skill = ROGUE_SKILLS.find((s) => s.id === state.pickChoices[i]);
    if (skill) drawPickCard(ctx, 72 + i * 200, 216, 176, 252, skill);
  }
  ctx.fillStyle = Art.C.inkSoft;
  ctx.font = '16px ' + KAI;
  ctx.fillText('—— 点选一则兵法，即刻出征 ——', 360, 508);
  ctx.restore();
}

function drawPickCard(ctx, x, y, w, h, skill) {
  const Art = globalThis.Art;
  const rc = RARITY_COLORS[skill.rarity] || RARITY_COLORS[0];
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, Art.C.paperHi);
  g.addColorStop(1, Art.C.paper);
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
  ctx.fillStyle = Art.C.ink;
  ctx.font = 'bold 34px ' + KAI; // 技能名
  ctx.fillText(skill.name, x + w / 2, y + 72);
  ctx.fillStyle = Art.C.inkMid;
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
  const Art = globalThis.Art;
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
  const Art = globalThis.Art;
  Art.drawPanel(ctx, cx - 190, cy - 54, 380, 108, false);
  const fs = 44;
  ctx.fillStyle = Art.C.ink;
  ctx.font = `bold ${fs}px "KaiTi","STKaiti","楷体",serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, cx, cy - 18);
  ctx.fillStyle = Art.C.seal;
  ctx.font = '22px "KaiTi","STKaiti","楷体",serif';
  ctx.fillText(sub, cx, cy + 24);
}
