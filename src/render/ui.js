// render/ui.js — M3 四屏共享控件：楷体常量/水墨色板/羊皮纸面板/朱砂金按钮/顶栏资源条
import { LOGICAL_W } from '../engine/config.js';
import { STAMINA_MAX } from '../meta/stamina.js';

export const KAI = '"KaiTi","STKaiti","楷体",serif';
export const C = {
  paper: '#ede4d2', paper2: '#e0d2b4', card: '#f2e8d2',
  ink: '#1f1b16', bronze: '#8b6914', gold: '#c9a227',
  cinnabar: '#9e2a1e', mut: '#8a7a5f', gray: '#a89c86',
  ok: '#3e7a3a',
  paperHi: '#f6efdd', paperDeep: '#d9c9a8',
  chromeText: '#f2e8d0', // 顶栏恒亮字（顶栏底色固定深墨，不随换肤反转）
};

// 圆角矩形路径（arcTo 四角）
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 羊皮纸面板：双层古铜描边
export function panel(ctx, x, y, w, h, r = 10) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, C.paperHi); g.addColorStop(1, C.paperDeep);
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = C.bronze; ctx.lineWidth = 3;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  ctx.strokeStyle = 'rgba(244,236,216,0.8)'; ctx.lineWidth = 2;
  roundRect(ctx, x + 5, y + 5, w - 10, h - 10, r - 4); ctx.stroke();
}

// 按钮 style: 'cinnabar' 朱砂实心 | 'gold' 暗金实心 | 'ghost' 古铜虚线 | 'disabled' 灰
export function btn(ctx, x, y, w, h, label, style = 'cinnabar', fontSize = 30) {
  const fills = {
    cinnabar: ['#b03a28', '#9e2a1e', '#7a2418', '#f4ecd8'],
    gold: ['#d4b04a', '#c9a227', '#8f7312', '#3b2e07'],
    ghost: [null, null, C.bronze, C.bronze],
    disabled: ['#c9bfa8', '#c9bfa8', '#a89c86', '#8a7f68'],
  };
  const [g0, g1, border, text] = fills[style];
  if (g0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, g0); g.addColorStop(1, g1);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(242,232,210,0.4)';
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
  }
  ctx.strokeStyle = border; ctx.lineWidth = 2;
  if (style === 'ghost') ctx.setLineDash([8, 6]);
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = text; ctx.font = `700 ${fontSize}px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 2);
}

// 顶栏：墨底资源条（金币/钻石/体力），h=90
export function topbar(ctx, save, title) {
  ctx.fillStyle = 'rgba(31,27,22,0.92)';
  ctx.fillRect(0, 0, LOGICAL_W, 90);
  ctx.fillStyle = C.chromeText;
  ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title || '七进七出', 30, 45);
  const items = [
    `🪙 ${save.wallet.coins}`,
    `💎 ${save.wallet.diamonds}`,
    `⚡ ${save.wallet.stamina ?? 0}/${STAMINA_MAX}`,
  ];
  ctx.font = `600 24px ${KAI}`;
  let x = LOGICAL_W - 30;
  for (let i = items.length - 1; i >= 0; i--) {
    const w = ctx.measureText(items[i]).width + 28;
    x -= w;
    ctx.strokeStyle = 'rgba(201,162,39,0.55)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, 20, w, 50, 25); ctx.stroke();
    ctx.fillStyle = C.chromeText;
    ctx.fillText(items[i], x + 14, 46);
    x -= 12;
  }
}

// 命字牌：立绘占位（M4 前以 命字圆牌 代立绘）
export function heroSeal(ctx, cx, cy, r, char, owned = true, selected = false) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, C.paperHi); g.addColorStop(1, C.paperDeep);
  ctx.fillStyle = owned ? g : 'rgba(168,156,134,0.35)';
  ctx.fill();
  ctx.strokeStyle = owned ? (selected ? C.gold : C.bronze) : C.gray;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.stroke();
  if (selected) {
    ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.fillStyle = owned ? C.ink : C.gray;
  ctx.font = `700 ${Math.round(r * 1.1)}px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(char, cx, cy + 4);
}

// 星级文本：n 实星，余虚星（默认 ★5 封顶）
export function starsText(n, max = 5) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, max - n));
}

// 提示浮条：居中羊皮纸条（core 设置 toastMsg/toastUntil 后逐帧调用）
export function toast(ctx, msg, y = 990) {
  ctx.font = `600 28px ${KAI}`;
  const w = Math.min(660, ctx.measureText(msg).width + 64);
  const x = (LOGICAL_W - w) / 2;
  ctx.save();
  ctx.globalAlpha = 0.95;
  panel(ctx, x, y, w, 64);
  ctx.restore();
  ctx.fillStyle = C.ink;
  ctx.font = `600 26px ${KAI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, LOGICAL_W / 2, y + 33);
}
