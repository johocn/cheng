// render/battleFx.js — M8 打击感全家桶：engine 事件消费 → 吞帧时停/屏震/飘字/击退/闪白/死亡快照/音效/演出触发
// 渲染层可变状态（模块级单例，单战场实例）；engine 无感知。时长统一 ÷ speed（验收快进不卡顿）
import { sfx } from '../platform/audio.js';
import * as particles from './particles.js';
import * as cinematic from './cinematic.js';
import { HERO_POS, CHAPTER_PACKS } from '../engine/config.js';

const HIT = { normal: 30, crit: 50, kill: 70, cap: 120 };

let speed = 1;
let renderClock = 0;      // 渲染层时钟（真实推进，吞帧不影响；粒子/飘字/演出用）
let hitStopUntil = 0;     // 吞帧截止时刻（与 core consume 传入的 now 同口径 = 渲染时钟）
let shakeState = null;    // { amp, start, dur }
let floatList = [];       // 飘字
let enemyFx = new Map();  // id → { hitAt, knockAt, dieAt, die:{type,x,y,affix} }
let leakFlashUntil = 0;
let heroAtk = null;       // { at, ang }
let prevUltT = -1;        // 大招分镜节点检测
let comboJumpAt = 0;      // M9 连击弹跳起点（kill 事件重置）

export function setSpeed(s) { speed = Math.max(1, Math.min(10, s)); }

// 渲染时钟推进（core 每帧先调）；返回当前渲染时钟
export function tick(dtMs) { renderClock += dtMs; return renderClock; }

// 当前渲染时钟只读（battle.js 绘制用，与 consume/update 同口径）
export function nowClock() { return renderClock; }

export function frozen(now) { return now < hitStopUntil; }

// 吞帧判定 + 演出占用（core 的 busy）
export function busy(now) { return frozen(now) || !!cinematic.active(); }

export function reset() {
  hitStopUntil = 0;
  shakeState = null;
  floatList = [];
  enemyFx = new Map();
  leakFlashUntil = 0;
  heroAtk = null;
  prevUltT = -1;
  comboJumpAt = 0;
  cinematic.reset();
  particles.reset();
}

function addHitStop(ms, now) {
  const dur = ms / speed;
  const base = Math.max(hitStopUntil, now);
  hitStopUntil = Math.min(base + dur, now + HIT.cap / speed); // 同帧叠加封顶
}

// 屏震（amp px × dur ms）；frame 取模伪随机偏移由 beginShake 消费
export function addShake(amp, durMs) {
  shakeState = { amp: amp / Math.max(1, speed * 0.5), start: renderClock, dur: durMs / Math.max(1, speed * 0.5) };
}
export function shakeActive() {
  return !!shakeState && renderClock - shakeState.start < shakeState.dur;
}
// 屏震 save+translate；返回 true 由调用方 restore
export function beginShake(ctx) {
  if (!shakeActive()) return false;
  const f = Math.floor(renderClock / 16); // 渲染帧号（确定性）
  const amp = shakeState.amp;
  const dx = (((f * 7) % 26) / 25 * 2 - 1) * amp;
  const dy = (((f * 11) % 34) / 33 * 2 - 1) * amp;
  ctx.save();
  ctx.translate(dx, dy);
  return true;
}
export function endShake(ctx) { ctx.restore(); }

export function floats() { return floatList; }

// 敌人受击闪白是否活跃
export function enemyHitFlash(id, now) {
  const fx = enemyFx.get(id);
  return !!fx && fx.hitAt !== undefined && now - fx.hitAt < 80 / speed;
}

// 敌人击退相位（0-1，200ms 往返）；方向由渲染层按路径切线计算
export function enemyKnockPhase(id, now) {
  const fx = enemyFx.get(id);
  if (!fx || fx.knockAt === undefined) return 0;
  const q = (now - fx.knockAt) / (200 / speed);
  if (q < 0 || q >= 1) return 0;
  return Math.sin(q * Math.PI); // 0→1→0 回弹
}

// 死亡幽灵快照（400ms 内有效）
export function ghostOf(id, now) {
  const fx = enemyFx.get(id);
  if (!fx || fx.dieAt === undefined) return null;
  if (now - fx.dieAt >= 400 / speed) return null;
  return fx.die;
}

export function leakFlash(now) { return now < leakFlashUntil; }

// 赵云突刺动画（hit 事件驱动，200ms）
export function heroAttackAnim(now) {
  if (!heroAtk || now - heroAtk.at >= 200 / speed) return { active: false, ang: 0, t: 0 };
  return { active: true, ang: heroAtk.ang, t: (now - heroAtk.at) / 1000 };
}

// ===== 事件消费（core 在 advanceFrame 之后调用；用完即弃由 core 置空 frameEvents）=====
export function consume(events, state, now) {
  for (const ev of events || []) {
    if (ev.type === 'hit') {
      addHitStop(ev.crit ? HIT.crit : HIT.normal, now);
      const fx = enemyFx.get(ev.enemyId) || {};
      fx.hitAt = now;
      fx.knockAt = now;
      enemyFx.set(ev.enemyId, fx);
      particles.splash(ev.x, ev.y, ev.crit ? 10 : 6);
      floatList.push({
        x: ev.x, y: ev.y - 30, text: String(Math.round(ev.dmg)),
        crit: !!ev.crit, size: ev.crit ? 23 : 18, born: renderClock,
      });
      heroAtk = { at: now, ang: Math.atan2(ev.y - HERO_POS.y, ev.x - HERO_POS.x) };
      sfx('hit');
    } else if (ev.type === 'kill') {
      addHitStop(HIT.kill, now);
      const fx = enemyFx.get(ev.enemyId) || {};
      fx.dieAt = now;
      fx.die = { type: ev.enemyType, x: ev.x, y: ev.y, affix: ev.affix || null }; // affix 随事件携带（state.enemies 里已被移除，查不到）
      enemyFx.set(ev.enemyId, fx);
      particles.blot(ev.x, ev.y);
      comboJumpAt = now; // M9：连击弹跳起点重置
      if (ev.dmg > 0) {
        floatList.push({
          x: ev.x, y: ev.y - 30, text: String(Math.round(ev.dmg)),
          crit: !!ev.crit, size: ev.crit ? 23 : 18, born: renderClock,
        });
      }
      addShake(3, 120); // 击杀屏震
      sfx('kill');
      if (ev.isBoss) cinematic.push({ kind: 'bossKill', dur: cinematic.DUR_KILL, data: { x: ev.x, y: ev.y, type: ev.enemyType } });
    } else if (ev.type === 'leak') {
      leakFlashUntil = now + 200 / speed; // 城门红闪
    } else if (ev.type === 'boss') {
      const title = state.mode === 'bossrush'
        ? `车轮战 · 第${state.bossRound || 1}轮`
        : (CHAPTER_PACKS[state.packIdx || 0] || {}).bossTitle || '敌帅';
      cinematic.push({ kind: 'bossScroll', dur: cinematic.DUR_SCROLL, data: { title } });
      addShake(2, 300); // Boss 登场屏震
    } else if (ev.type === 'ult') {
      sfx('drum'); // 战鼓起手（演出本体由 state.ult 驱动 fx.js，不经 cinematic）
    }
  }
}

// 大招分镜节点检测（core 每帧 battle 分支调；跨界触发音效/溅墨/屏震）
export function ultTick(state) {
  if (!state || !state.ult) { prevUltT = -1; return; }
  const t = state.ult.t;
  const prev = prevUltT;
  prevUltT = t;
  if (prev < 0) return; // 首帧只记录
  const SEG = 1.0 / 7;
  for (let j = 1; j <= 7; j++) { // 七段突刺节点：溅墨 + 短噗
    const node = 0.6 + j * SEG;
    if (prev < node && t >= node && j <= 6) {
      particles.splash(HERO_POS.x + Math.cos(j * 2.1) * 120, HERO_POS.y + Math.sin(j * 2.1) * 120, 5);
      sfx('hit');
    }
  }
  if (prev < 1.6 && t >= 1.6) sfx('skill');   // 收招白闪
  if (prev < 2.2 && t >= 2.2) { addShake(8, 300); sfx('drum'); } // 冲击波屏震
}

// 每帧推进（真实时钟：吞帧期间粒子/飘字/演出仍走）
export function update(dtMs) {
  renderClock += dtMs; // 推进渲染时钟（真实时间，吞帧不影响）
  cinematic.update(dtMs);
  const dtSec = dtMs / 1000;
  particles.update(dtSec);
  floatList = floatList.filter((f) => renderClock - f.born < 500 / speed);
  // 惰性清理过期敌人视觉状态（防 Map 无限膨胀）
  if (enemyFx.size > 60) {
    for (const [id, fx] of enemyFx) {
      const dead = fx.dieAt !== undefined && renderClock - fx.dieAt >= 450 / speed;
      const stale = fx.dieAt === undefined && fx.hitAt !== undefined && renderClock - fx.hitAt >= 1000;
      if (dead || stale) enemyFx.delete(id);
    }
  }
}

// 活跃死亡幽灵列表（battle.js drawGhosts 消费）
export function activeGhosts(now) {
  const out = [];
  for (const [, fx] of enemyFx) {
    if (fx.dieAt !== undefined && now - fx.dieAt < 400 / speed) {
      out.push({ ...fx.die, bornAt: fx.dieAt });
    }
  }
  return out;
}

// 飘字绘制（楷体上浮 40px 淡出 500ms；暴击朱砂加粗）
export function drawFloatsPublic(ctx, now) {
  const C = (globalThis.Art && globalThis.Art.C) || { ink: '#1f1b16', seal: '#9e2a1e' };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floatList) {
    const q = (renderClock - f.born) / (500 / speed);
    if (q >= 1) continue;
    ctx.globalAlpha = 1 - q;
    ctx.fillStyle = f.crit ? C.seal : C.ink;
    ctx.font = `${f.crit ? 'bold ' : ''}${f.size}px "KaiTi","STKaiti","楷体",serif`;
    ctx.fillText(f.text, f.x, f.y - 40 * q);
  }
  ctx.globalAlpha = 1;
}

// ===== M9 连击 Combo =====
const COMBO_INK = '#1f1b16';   // 墨字（固定常量：朱砂转色阈值测试确定性）
const COMBO_SEAL = '#9e2a1e';  // ≥10 连的朱砂色

// 弹跳缩放：kill 后 270ms 内三峰衰减振荡（1.45 → 1）；无动画恒 1
export function comboScale(now) {
  if (!comboJumpAt) return 1;
  const t = (now - comboJumpAt) / (270 / speed);
  if (t < 0 || t >= 1) return 1;
  return 1 + 0.45 * Math.exp(-3.5 * t) * Math.cos(t * Math.PI * 3);
}

// 连击层（battle.js UI 层调用）：中央偏上「连 击」+「×N」弹跳 + 三圈墨点呼吸
export function drawCombo(ctx, state, now) {
  const n = (state && state.combo) || 0;
  if (n < 2) return;
  const CX = 360, CY = 360;
  // 三圈墨点（数字下方呼吸扩散，相位错开）
  ctx.save();
  ctx.strokeStyle = COMBO_INK;
  for (let i = 0; i < 3; i++) {
    const breath = 0.6 + 0.4 * Math.sin(renderClock / 300 + i * 2.1);
    ctx.globalAlpha = [0.5, 0.28, 0.14][i] * breath;
    ctx.lineWidth = [2.5, 1.5, 1][i];
    ctx.beginPath();
    ctx.arc(CX, CY + 30, [7, 14, 21][i], 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // 数字弹跳（scale 变换）
  const s = comboScale(now);
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(s, s);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COMBO_INK;
  ctx.font = '15px "KaiTi","STKaiti","楷体",serif';
  ctx.fillText('连 击', 0, -34);
  ctx.fillStyle = n >= 10 ? COMBO_SEAL : COMBO_INK;
  ctx.font = 'bold 46px "KaiTi","STKaiti","楷体",serif';
  ctx.fillText(`×${n}`, 0, 0);
  ctx.restore();
}
