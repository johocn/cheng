// render/fx.js — 大招「七进七出」2.8s 分镜与通用战斗特效（只读 state，逐帧重绘）
import { HERO_POS, ULT_CAST_DUR } from '../engine/config.js';

const KAI = '"KaiTi","STKaiti","楷体",serif';
// 金色随皮肤色板（皮影戏下为鎏金亮金）
function gold() { return (typeof globalThis.Art !== 'undefined' && globalThis.Art) ? globalThis.Art.C.gold : '#c9a227'; }
const SEG_DUR = 0.22; // 七段突刺：每段 0.22s（7 段共 1.54s ≈ 演出前 0.57）

// 七段方向：黄金角取模伪随机（确定性；state.frame 逐帧递增，直接取模驱动方向会每帧抖动，
// 故按段索引取模铺开——屏抖仍按计划用 frame 取模，见 beginUltShake）
const SEG_ANGLES = Array.from(
  { length: 7 },
  (_, j) => (0.65 + j * 2.399963229728653) % (Math.PI * 2),
);

// 屏抖（p≥0.79）：save+translate，返回 true 由调用方 restore。
// 伪随机取模于 state.frame（禁 Math.random）；幅度按抖动相位归一 ±6 → 0 线性衰减。
export function beginUltShake(ctx, state) {
  const p = state.ult.t / ULT_CAST_DUR;
  if (p < 0.79) return false;
  const amp = (6 * (1 - p)) / (1 - 0.79);
  const dx = (((state.frame * 7) % 26) / 25 * 2 - 1) * amp;
  const dy = (((state.frame * 11) % 34) / 33 * 2 - 1) * amp;
  ctx.save();
  ctx.translate(dx, dy);
  return true;
}

// 分镜入口：p = ult.t / 2.8
export function drawUltCinematic(ctx, state) {
  const t = state.ult.t;
  const p = t / ULT_CAST_DUR;
  if (p < 0.57) drawThrust(ctx, t);
  else if (p < 0.79) drawShockwave(ctx, p);
}

// p<0.57：七段突刺——赵云向 7 个伪随机方向依次冲出残影（出即回），老残影渐隐
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
    // 冲刺轨迹
    ctx.strokeStyle = `rgba(201,162,39,${(0.4 * alpha).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(HERO_POS.x, HERO_POS.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawAfterimage(ctx, x, y, 30, Math.min(1, alpha));
  }
}

// 赵云残影：纸底圆牌 + 云字 + 3 层金描边
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

// 0.57≤p<0.79：收招冲击波——环自赵云扩散 r 0→640，线宽 12→2，金
function drawShockwave(ctx, p) {
  const q = (p - 0.57) / 0.22;
  const ease = 1 - Math.pow(1 - q, 3);
  const r = 640 * ease;
  ctx.save();
  if (q < 0.3) { // 收招闪白
    const fa = 0.4 * (1 - q / 0.3);
    const g = ctx.createRadialGradient(HERO_POS.x, HERO_POS.y, 0, HERO_POS.x, HERO_POS.y, 260);
    g.addColorStop(0, `rgba(255,244,214,${fa.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(HERO_POS.x, HERO_POS.y, 260, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(201,162,39,0.45)'; // 辉光副环
  ctx.lineWidth = 18 - 14 * q;
  ctx.beginPath();
  ctx.arc(HERO_POS.x, HERO_POS.y, Math.max(1, r - 16), 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = gold(); // 主环
  ctx.lineWidth = 12 - 10 * q;
  ctx.beginPath();
  ctx.arc(HERO_POS.x, HERO_POS.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
