// render/battleFx.js — M8 打击感全家桶：engine 事件消费 → 吞帧时停/屏震/飘字/击退/闪白/死亡快照/音效/演出触发
// 渲染层可变状态（模块级单例，单战场实例）；engine 无感知。时长统一 ÷ speed（验收快进不卡顿）
import { sfx } from '../platform/audio.js';
import * as particles from './particles.js';
import * as cinematic from './cinematic.js';
import { HERO_POS, BOSS_SKILL, CHAPTER_PACKS, ELITE_FX, AFFIX_COLORS, AFFIXES, BOW_FX_DUR } from '../engine/config.js';
import { pathPoint } from '../engine/enemy.js';

const HIT = { normal: 30, crit: 70, kill: 70, cap: 120 }; // M11：暴击 hitStop 50→70 加深
const SPEAR_FX_DUR = [0.25, 0.5, 0.34, 0.5];              // M11 枪四档演出时长（thrust/pierce/sweep/circle）
const BOW_GOLD = '#c9a227';                                // M11 弓演出配色（鎏金/墨/朱砂，贴水墨主风格）
const BOW_INK = '#1f1b16';
const BOW_SEAL = '#9e2a1e';
const BOW_VOLLEYS = [[0], [0, 0.12], [0, 0.08, 0.16]];     // 弓各档齐射相位延迟（秒；贰双发/叁三连）
const TAU = Math.PI * 2;
const easeOut = (q) => 1 - Math.pow(1 - q, 3);

let speed = 1;
let renderClock = 0;      // 渲染层时钟（真实推进，吞帧不影响；粒子/飘字/演出用）
let hitStopUntil = 0;     // 吞帧截止时刻（与 core consume 传入的 now 同口径 = 渲染时钟）
let shakeState = null;    // { amp, start, dur }
let floatList = [];       // 飘字
let enemyFx = new Map();  // id → { hitAt, knockAt, dieAt, die:{type,x,y,affix} }
let leakFlashUntil = 0;
let heroAtk = null;       // M11 { mode, stage, at, ang, x, y, range, splash }（heroAtk 事件驱动）
let prevUltT = -1;        // 大招分镜节点检测
let comboJumpAt = 0;      // M9 连击弹跳起点（kill 事件重置）
let bossFlash = null;     // M9 Boss 技能结算闪现 { x, y, at }（事件携带 Boss 坐标）
let eliteList = [];       // M10 精英武印 { x, y, affix, born, minor }（born=consume now 口径）

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
  bossFlash = null;
  eliteList = [];
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

// 赵云普攻演出（M11：heroAtk 事件驱动，枪四档/弓三档双形态；hit 兜底 thrust）
export function heroAttackAnim(now) {
  if (!heroAtk) return { active: false };
  const dur = heroAtk.mode === 'bow'
    ? BOW_FX_DUR.draw + BOW_FX_DUR.fly + Math.max(...BOW_VOLLEYS[Math.min(2, heroAtk.stage)])
    : SPEAR_FX_DUR[heroAtk.stage];
  const t = (now - heroAtk.at) / 1000;
  if (t < 0 || t >= dur / speed) return { active: false };
  return { active: true, mode: heroAtk.mode, stage: heroAtk.stage, ang: heroAtk.ang,
    x: heroAtk.x, y: heroAtk.y, range: heroAtk.range, splash: heroAtk.splash, t, dur };
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
      particles.splash(ev.x, ev.y, ev.crit ? 18 : 14); // M11 放大：6/10→14/18
      floatList.push({
        x: ev.x, y: ev.y - 30, text: String(Math.round(ev.dmg)),
        crit: !!ev.crit, size: ev.crit ? 22 : 18, born: renderClock, // M11 放大：暴击 23→22 朱砂大字
      });
      if (!heroAtk || heroAtk.mode !== 'bow' || now - heroAtk.at >= (BOW_FX_DUR.draw + BOW_FX_DUR.fly) * 1000 / speed) {
        heroAtk = { mode: 'spear', stage: 0, at: now, ang: Math.atan2(ev.y - HERO_POS.y, ev.x - HERO_POS.x) }; // 兜底：直伤（闪电链等）也出小枪
      }
      sfx('hit');
    } else if (ev.type === 'heroAtk') { // M11：普攻本体演出事件（枪四档/弓三档）
      heroAtk = { mode: ev.mode, stage: ev.stage, at: now, ang: ev.ang,
        x: ev.x, y: ev.y, range: ev.range, splash: ev.splash };
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
    } else if (ev.type === 'bossSkill') { // M9：横扫结算——扇形闪现加深 + 小幅屏震
      bossFlash = { x: ev.x, y: ev.y, at: now };
      addShake(4, 250);
    } else if (ev.type === 'elite') { // M10：精英武印——同屏活跃达上限则降级头顶色点（born 用 now 口径）
      const active = eliteList.filter((f) => !f.minor && now - f.born < (ELITE_FX.dur * 1000) / speed).length;
      eliteList.push({ x: ev.x, y: ev.y, affix: ev.affix, born: now, minor: active >= ELITE_FX.maxActive });
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

// ===== M9 Boss 技能预警（淡赭浅渲，贴水墨主风格）=====
const BOSS_WARN_INK = '#1f1b16';
const BOSS_WARN_RED = '#b03a2e'; // 淡赭：低透明浅渲，禁浓艳

// 扇形路径：顶点 (bx,by) 朝 facing 展开 BOSS_SKILL.range/arc
function fanPath(ctx, bx, by, facing) {
  const half = (BOSS_SKILL.arc * Math.PI) / 360;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.arc(bx, by, BOSS_SKILL.range, facing - half, facing + half);
  ctx.closePath();
}

// Boss 技能层（battle.js 敌人层之后调用：警示罩罩住敌人语义）。
// warn 阶段：淡赭扇形（填充 α0.10 / 描边虚线 α0.32）+ 顶点墨点 + 台词气泡；
// 结算帧（bossSkill 事件）：扇形闪现加深 150ms（α0.3→0）+ 消费侧小幅屏震。返回是否有绘制。
export function drawBossSkill(ctx, state, now) {
  let drew = false;
  for (const e of (state && state.enemies) || []) {
    if (e.type !== 'shuai' || !e.skill || e.skill.phase !== 'warn') continue;
    const p = pathPoint(e.lane, e.t);
    const facing = Math.atan2(HERO_POS.y - p.y, HERO_POS.x - p.x);
    ctx.save();
    fanPath(ctx, p.x, p.y, facing);
    ctx.globalAlpha = 0.1; // 填充 ≤0.12：浅渲
    ctx.fillStyle = BOSS_WARN_RED;
    ctx.fill();
    ctx.globalAlpha = 0.32; // 描边 ≤0.35
    ctx.strokeStyle = BOSS_WARN_RED;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.35; // 顶点墨点
    ctx.fillStyle = BOSS_WARN_INK;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawBossBubble(ctx, p.x, p.y, e.skill.clock);
    drew = true;
  }
  if (bossFlash && now - bossFlash.at < 150 / speed) { // 结算闪现：无气泡
    const facing = Math.atan2(HERO_POS.y - bossFlash.y, HERO_POS.x - bossFlash.x);
    const q = (now - bossFlash.at) / (150 / speed);
    ctx.save();
    fanPath(ctx, bossFlash.x, bossFlash.y, facing);
    ctx.globalAlpha = 0.3 * (1 - q); // 0.3 → 0 线性衰减
    ctx.fillStyle = BOSS_WARN_RED;
    ctx.fill();
    ctx.restore();
    drew = true;
  }
  return drew;
}

// ===== M10 精英武印盖章 =====
const ELITE_INK = '#f4ecd8'; // 印面字色（纸色）

// 武印层（battle.js 敌人层后调用，印章罩住敌人语义）：
// 印章 q：0-25% 盖下（scale 2.1→1 ease-out + rotate -14°→-5°）、25-80% 停留、80-100% 淡出；
// 降级 minor 只画头顶词缀色点。惰性过期清理（q≥1 移除）。不吞帧、不屏震。
// 刷出点 clamp 进屏（lane0 起点 y=-40 / lane1、2 x=±40 在画面外，印章须可见）
function clampSpawn(x, y) {
  return {
    x: Math.max(50, Math.min(670, x)),
    y: Math.max(96, Math.min(1230, y)),
  };
}

export function drawEliteSpawns(ctx, now) {
  if (!eliteList.length) return;
  eliteList = eliteList.filter((f) => {
    const life = (f.minor ? ELITE_FX.minorDur : ELITE_FX.dur) * 1000 / speed;
    return now - f.born < life;
  });
  for (const f of eliteList) {
    const life = (f.minor ? ELITE_FX.minorDur : ELITE_FX.dur) * 1000 / speed;
    const q = (now - f.born) / life;
    if (q < 0 || q >= 1) continue;
    const { x: fx, y: fy } = clampSpawn(f.x, f.y);
    const color = AFFIX_COLORS[f.affix] || AFFIX_COLORS.iron;
    ctx.save();
    if (f.minor) { // 降级：头顶色点（半程淡出）
      ctx.globalAlpha = 0.85 * (1 - q * 0.5);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(fx, fy - 44, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    let s = 1, rot = -5, alpha = 1;
    if (q < 0.25) { // 盖下段
      const k = q / 0.25;
      s = 2.1 - 1.1 * (1 - Math.pow(1 - k, 3));
      rot = -14 + 9 * k;
    } else if (q >= 0.8) { // 淡出段
      alpha = 1 - (q - 0.8) / 0.2;
    }
    ctx.globalAlpha = alpha;
    ctx.translate(fx, fy);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.fillRect(-26, -26, 52, 52);
    ctx.fillStyle = ELITE_INK;
    ctx.font = 'bold 34px "KaiTi","STKaiti","楷体",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((AFFIXES[f.affix] || {}).label || '精', 0, 2);
    ctx.restore();
  }
}

// 台词气泡：墨底白字「看我横扫千军！」，warn 前 0.25s 上浮滑入（气泡仅 warn 段）
function drawBossBubble(ctx, bx, by, clock) {
  const q = Math.max(0, Math.min(1, clock / 0.25));
  const lift = (1 - q) * 14;
  const w = 160, h = 30;
  const x = bx - w / 2, y = by - 70 - lift;
  ctx.save();
  // 墨底圆角 pill（arcTo 手绘，避免 Art 依赖）
  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.arcTo(x + w, y, x + w, y + h, 8);
  ctx.arcTo(x + w, y + h, x, y + h, 8);
  ctx.arcTo(x, y + h, x, y, 8);
  ctx.arcTo(x, y, x + w, y, 8);
  ctx.closePath();
  ctx.fillStyle = 'rgba(31,27,22,0.88)';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4ecd8';
  ctx.font = 'bold 17px "KaiTi","STKaiti","楷体",serif';
  ctx.fillText('看我横扫千军！', bx, y + h / 2 + 1);
  ctx.restore();
}

// ===== M11 drawHeroAttack：普攻本体演出（金环脉冲 + 枪四档 / 弓三档，heroAtk 事件驱动）=====
export function drawHeroAttack(ctx, now) {
  const a = heroAttackAnim(now);
  if (!a.active) return false;
  const q = Math.min(1, a.t / a.dur);
  ctx.save();
  ctx.translate(HERO_POS.x, HERO_POS.y);
  ctx.globalAlpha = (1 - q) * 0.7; // 金环脉冲：所有档通用
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 24 + 16 * easeOut(q), 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (a.mode === 'spear') drawSpearStage(ctx, a, q);
  else drawBowStage(ctx, a, q, now);
  ctx.restore();
  return true;
}

// 枪杆+枪尖+红缨+飞白（局部坐标，rotate 前置；len 杆基长 ext 突伸 alpha 透明度）
function drawSpearBar(ctx, ang, len, ext, alpha) {
  ctx.save();
  ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(201,162,39,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 42, -0.5, 0.2);
  ctx.stroke();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(16 + len + ext, 0);
  ctx.stroke();
  ctx.fillStyle = '#1f1b16';
  ctx.beginPath();
  ctx.moveTo(22 + len + ext, 0);
  ctx.lineTo(12 + len + ext, -3.5);
  ctx.lineTo(12 + len + ext, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9e2a1e';
  ctx.beginPath();
  ctx.moveTo(12 + len + ext, 0);
  ctx.lineTo(6 + len + ext, -5);
  ctx.lineTo(6 + len + ext, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSpearStage(ctx, a, q) {
  if (a.stage === 0) { // 壹 单枪突刺（M8 原版保留）
    drawSpearBar(ctx, a.ang, 22, Math.sin(Math.min(1, q / 0.8) * Math.PI) * 26, 1);
  } else if (a.stage === 1) { // 贰 龙胆突刺：长枪+双层残影+枪尖气浪
    const ext = Math.sin(q * Math.PI) * 70;
    for (let j = 2; j >= 1; j--) {
      const q2 = q - j * 0.12;
      if (q2 > 0 && q2 < 1) drawSpearBar(ctx, a.ang, 22, Math.sin(q2 * Math.PI) * 70, j === 1 ? 0.35 : 0.18);
    }
    drawSpearBar(ctx, a.ang, 22, ext, 1);
    if (q > 0.35 && q < 0.9) { // 白描气浪三线
      const tipx = Math.cos(a.ang) * (38 + ext), tipy = Math.sin(a.ang) * (38 + ext);
      ctx.strokeStyle = `rgba(31,27,22,${(0.4 * (1 - q)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      for (let m = 0; m < 3; m++) {
        const aa = a.ang + (m - 1) * 0.42;
        ctx.beginPath();
        ctx.moveTo(tipx + Math.cos(aa) * 6, tipy + Math.sin(aa) * 6);
        ctx.lineTo(tipx + Math.cos(aa) * (16 + m * 5), tipy + Math.sin(aa) * (16 + m * 5));
        ctx.stroke();
      }
    }
  } else if (a.stage === 2) { // 叁 横扫枪风：120° 扇形墨浪+三道鎏金飞白弧+扫击枪
    const cur = a.ang - 1.05 + 2.1 * q;
    ctx.fillStyle = `rgba(31,27,22,${(0.16 * (1 - q * 0.5)).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, a.range * 0.95, a.ang - 1.05, cur);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(201,162,39,${((1 - q * 0.75) * (0.55 - k * 0.13)).toFixed(3)})`;
      ctx.lineWidth = 2.6 - k * 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, a.range * (0.5 + k * 0.22), Math.max(a.ang - 1.05, cur - 0.6), cur);
      ctx.stroke();
    }
    drawSpearBar(ctx, cur, 40, 0, 1);
  } else { // 肆 枪圈墨波：鎏金虚线射程环显形+双圈墨波+360° 枪影环
    const ringA = Math.sin(q * Math.PI);
    ctx.strokeStyle = `rgba(201,162,39,${(ringA * 0.55).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, a.range, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let w = 0; w < 2; w++) {
      const qw = Math.max(0, Math.min(1, q * 1.25 - w * 0.18));
      if (qw <= 0) continue;
      ctx.strokeStyle = `rgba(31,27,22,${(0.32 * (1 - qw)).toFixed(3)})`;
      ctx.lineWidth = w ? 2 : 4;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(2, a.range * easeOut(qw) - w * 14), 0, TAU);
      ctx.stroke();
    }
    for (let s2 = 5; s2 >= 0; s2--) {
      drawSpearBar(ctx, -Math.PI / 2 + q * TAU - s2 * 0.09, 38, 0, s2 === 0 ? 1 : 0.4 * (1 - s2 / 6));
    }
  }
}

// ===== M11 弓三档演出：拉弓（金弓弧+墨弦+弦上箭）→ 飞行（墨杆金羽；贰双发/叁三连上弧）→ 命中（三层墨花晕开+溅射环）=====
// 弓箭 j 的落点偏移（相对主目标）：壹/贰打主点（贰第二箭微偏），叁三箭错落溅射圈内
function bowLanding(a, j, stage) {
  if (stage !== 2) return j === 0 ? [0, 0] : [8, -6];
  const r = (a.splash || {}).r || 90;
  return [[0, 0], [-r * 0.4, r * 0.35], [r * 0.35, -r * 0.3]][j];
}

function drawBowStage(ctx, a, q, now) {
  const stage = Math.min(2, a.stage || 0);
  const draw = BOW_FX_DUR.draw, fly = BOW_FX_DUR.fly;
  if (a.t < draw) { drawBowDraw(ctx, a, a.t / draw); return; } // 拉弓段
  const dx = a.x - HERO_POS.x, dy = a.y - HERO_POS.y; // 相对主目标（ctx 已 translate 到英雄）
  const delays = BOW_VOLLEYS[stage];
  for (let j = 0; j < delays.length; j++) {
    const f = (a.t - draw - delays[j]) / fly; // 该箭飞行进度
    if (f <= 0) continue;
    const fq = f * 1.25; // 1.25：命中花从飞行后 20% 起晕开，箭到（f=1）时恰花隐
    const [ox, oy] = bowLanding(a, j, stage);
    if (fq < 1) drawBowArrow(ctx, dx + ox, dy + oy, f, stage === 2); // 箭在途
    else drawBowImpact(ctx, dx + ox, dy + oy, fq - 1);
  }
  if (a.splash && a.t >= draw + 0.8 * fly) { // 溅射环：首箭及体晕开起显形，至演出收线性淡出
    const k = Math.max(0, 1 - (a.t - (draw + 0.8 * fly)) / (a.dur - draw - 0.8 * fly));
    if (k > 0) {
      ctx.strokeStyle = `rgba(201,162,39,${(k * 0.5).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.arc(dx, dy, a.splash.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// 拉弓段：鎏金弓身弧（开口朝前）+ 墨弦 V 形后拉 + 弦上箭（墨杆朱砂镞，pull→1 离弦）
function drawBowDraw(ctx, a, pull) {
  ctx.save();
  ctx.rotate(a.ang);
  ctx.strokeStyle = BOW_GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(14, 0, 13, -1.15, 1.15);
  ctx.stroke();
  const tx = 14 + 13 * Math.cos(1.15), ty = 13 * Math.sin(1.15);
  const nock = tx - 12 * pull;
  ctx.strokeStyle = 'rgba(31,27,22,0.85)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tx, -ty);
  ctx.lineTo(nock, 0);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.strokeStyle = BOW_INK; // 弦上箭
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nock, 0);
  ctx.lineTo(nock + 22, 0);
  ctx.stroke();
  ctx.fillStyle = BOW_SEAL;
  ctx.beginPath();
  ctx.moveTo(nock + 28, 0);
  ctx.lineTo(nock + 20, -3);
  ctx.lineTo(nock + 20, 3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// 单支飞行箭（墨杆金羽）：f 0→1 从英雄到落点 easeOut；loft=叁箭雨上弧抛物线
function drawBowArrow(ctx, tx, ty, f, loft) {
  const e = easeOut(f);
  const py = ty - (loft ? Math.sin(Math.PI * f) * 46 : 0);
  ctx.save();
  ctx.translate(tx * e, py);
  ctx.rotate(Math.atan2(py, tx * e + 1e-4));
  ctx.strokeStyle = BOW_INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.stroke();
  ctx.strokeStyle = BOW_GOLD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-7, 0); ctx.lineTo(-10.5, -3.2);
  ctx.moveTo(-7, 0); ctx.lineTo(-10.5, 3.2);
  ctx.stroke();
  ctx.restore();
}

// 命中三层墨花（墨滴入水晕开）：bloom 0→0.25，内圈先绽外圈后散，随晕开同步淡出
function drawBowImpact(ctx, x, y, bloom) {
  const k = 1 - bloom / 0.25;
  if (k <= 0) return;
  const g = bloom / 0.25;
  const rings = [
    { r: 5, g: 9, a: 0.5, w: 2.2 },
    { r: 11, g: 15, a: 0.28, w: 1.4 },
    { r: 18, g: 22, a: 0.14, w: 1 },
  ];
  for (const rg of rings) {
    ctx.strokeStyle = `rgba(31,27,22,${(rg.a * k).toFixed(3)})`;
    ctx.lineWidth = rg.w;
    ctx.beginPath();
    ctx.arc(x, y, rg.r + rg.g * g, 0, TAU);
    ctx.stroke();
  }
}
