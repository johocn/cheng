// render/fx.js — M8 大招「七进七出」2.8s 分镜 v2（六格分镜定稿）与屏抖（只读 state，逐帧重绘）
// 四段：① 0-0.6 起手聚雾 ② 0.6-1.6 七段突刺 ③ 1.6-2.2 收招白闪 ④ 2.2-2.8 冲击波·屏震·印
// 段界音效/溅墨/屏震由 battleFx.ultTick 跨界触发（fx.js 保持纯绘制）
import { HERO_POS, ULT_CAST_DUR } from '../engine/config.js';

const KAI = '"KaiTi","STKaiti","楷体",serif';
// 金色随皮肤色板（皮影戏下为鎏金亮金）
function gold() { return (typeof globalThis.Art !== 'undefined' && globalThis.Art) ? globalThis.Art.C.gold : '#c9a227'; }

const T1 = 0.6, T2 = 1.6, T3 = 2.2; // 段界（秒）
const SEG_DUR = (T2 - T1) / 7;      // 七段突刺每段 1/7 s ≈ 0.143

// 七段方向：黄金角取模伪随机（确定性）
const SEG_ANGLES = Array.from(
  { length: 7 },
  (_, j) => (0.65 + j * 2.399963229728653) % (Math.PI * 2),
);

// 屏抖（p≥T3/2.8）：save+translate，返回 true 由调用方 restore。
// M8：幅度 8px（spec 12.2 大招屏震 8px×300ms 口径）线性衰减
export function beginUltShake(ctx, state) {
  const p = state.ult.t / ULT_CAST_DUR;
  if (p < T3 / ULT_CAST_DUR) return false;
  const amp = (8 * (1 - p)) / (1 - T3 / ULT_CAST_DUR);
  const dx = (((state.frame * 7) % 26) / 25 * 2 - 1) * amp;
  const dy = (((state.frame * 11) % 34) / 33 * 2 - 1) * amp;
  ctx.save();
  ctx.translate(dx, dy);
  return true;
}

// 分镜入口
export function drawUltCinematic(ctx, state) {
  const t = state.ult.t;
  if (t < T1) drawGather(ctx, t);
  else if (t < T2) drawThrust(ctx, t - T1);
  else if (t < T3) drawFlash(ctx, (t - T2) / (T3 - T2));
  else drawImpulse(ctx, (t - T3) / (ULT_CAST_DUR - T3));
}

// ① 起手聚雾 0-0.6：边缘压暗 20% + 四角墨雾聚向赵云 + 金环充能
function drawGather(ctx, t) {
  const q = t / T1;
  // 边缘压暗 vignette
  const g = ctx.createRadialGradient(HERO_POS.x, HERO_POS.y, 200, HERO_POS.x, HERO_POS.y, 780);
  g.addColorStop(0, 'rgba(31,27,22,0)');
  g.addColorStop(1, `rgba(31,27,22,${(0.2 * q).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, 1280);
  // 四角墨雾（大墨团沿对角线向心插值，越聚越淡）
  for (const [cx, cy] of [[0, 0], [720, 0], [0, 1280], [720, 1280]]) {
    const x = cx + (HERO_POS.x - cx) * q;
    const y = cy + (HERO_POS.y - cy) * q;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 90);
    rg.addColorStop(0, `rgba(58,51,42,${(0.35 * (1 - q * 0.4)).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(58,51,42,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  // 赵云金环充能（半径收缩的旋转虚线环）
  ctx.save();
  ctx.translate(HERO_POS.x, HERO_POS.y);
  ctx.rotate(q * Math.PI * 2);
  ctx.strokeStyle = gold();
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 64 - 20 * q, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ② 七段突刺 0.6-1.6：赵云向 7 方向依次冲出残影（出即回），老残影渐隐
function drawThrust(ctx, t) {
  const seg = Math.min(6, Math.floor(t / SEG_DUR));
  for (let j = 0; j <= seg; j++) {
    const q = Math.min(1, (t - j * SEG_DUR) / SEG_DUR); // 段内进度
    const dist = Math.sin(q * Math.PI) * 200;
    const age = seg - j;
    const alpha = (1 - age * 0.12) * (0.45 + 0.55 * Math.sin(q * Math.PI));
    if (alpha <= 0.02) continue;
    const ang = SEG_ANGLES[j];
    const x = HERO_POS.x + Math.cos(ang) * dist;
    const y = HERO_POS.y + Math.sin(ang) * dist;
    // 冲刺轨迹（鎏金飞白路径）
    ctx.strokeStyle = `rgba(201,162,39,${(0.4 * alpha).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(HERO_POS.x, HERO_POS.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawAfterimage(ctx, x, y, 30, Math.min(1, alpha));
  }
}

// 赵云残影：纸底圆牌 + 云字 + 3 层金描边（三级透明度递减）
function drawAfterimage(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.fillStyle = 'rgba(244,236,216,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = alpha * (1 - k * 0.28);
    ctx.strokeStyle = gold();
    ctx.lineWidth = 3.5 - k;
    ctx.beginPath();
    ctx.arc(x, y, r - k * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1f1b16';
  ctx.font = 'bold 30px ' + KAI;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('云', x, y + 1);
  ctx.restore();
}

// ③ 收招白闪 1.6-2.2：全屏提亮至 #f6efdd + 放射速度线
function drawFlash(ctx, q) {
  ctx.fillStyle = `rgba(246,239,221,${(0.85 * (1 - q * 0.6)).toFixed(3)})`;
  ctx.fillRect(0, 0, 720, 1280);
  ctx.strokeStyle = `rgba(201,162,39,${(0.5 * (1 - q)).toFixed(3)})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + q * 0.4;
    const r0 = 180 + q * 260;
    const r1 = r0 + 150;
    ctx.beginPath();
    ctx.moveTo(HERO_POS.x + Math.cos(ang) * r0, HERO_POS.y + Math.sin(ang) * r0);
    ctx.lineTo(HERO_POS.x + Math.cos(ang) * r1, HERO_POS.y + Math.sin(ang) * r1);
    ctx.stroke();
  }
}

// ④ 冲击波·屏震·印 2.2-2.8：三圈墨波扩散 + 朱砂「七进七出」大印浮现淡出
// （屏震本体由 beginUltShake 承担；溅墨由 battleFx.ultTick 在段界发）
function drawImpulse(ctx, q) {
  for (let k = 0; k < 3; k++) { // 三圈墨波错相扩散
    const qq = Math.max(0, Math.min(1, q * 1.3 - k * 0.15));
    if (qq <= 0) continue;
    const ease = 1 - Math.pow(1 - qq, 3);
    const r = 640 * ease;
    const lw = 14 - k * 3 - 10 * qq;
    if (lw <= 0.5) continue;
    ctx.strokeStyle = `rgba(31,27,22,${(0.4 * (1 - qq)).toFixed(3)})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(HERO_POS.x, HERO_POS.y, Math.max(1, r - k * 18), 0, Math.PI * 2);
    ctx.stroke();
  }
  // 朱砂大印：q>0.3 浮现，尾段淡出
  if (q > 0.3) {
    const pq = Math.min(1, (q - 0.3) / 0.5);
    ctx.save();
    ctx.globalAlpha = pq < 0.8 ? 1 : (1 - pq) / 0.2;
    ctx.translate(HERO_POS.x, HERO_POS.y - 80);
    ctx.rotate(-0.03);
    const s = 200;
    ctx.fillStyle = 'rgba(158,42,30,0.92)';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = '#f4ecd8';
    ctx.font = 'bold 44px ' + KAI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('七 进 七 出', 0, 0);
    ctx.restore();
  }
}
