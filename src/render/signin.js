// render/signin.js — 每日签到屏：7 日递进格子 + 广告领取（spec 5.1，mockup ①定稿）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { SIGNIN_REWARDS, signinIndex, signinClaimable } from '../meta/signin.js';
import { KAI, C, panel, topbar, btn } from './ui.js';

export const SIGNIN_LAYOUT = {
  backBtn: { x: 20, y: 110, w: 110, h: 64 },
  grid: { x: 30, y: 220, cellW: 156, cellH: 150, gap: 12 },
  bigCellY: 544, bigCellH: 130,
  infoY: 730,
  claimBtn: { x: 110, y: 1000, w: 500, h: 96 },
};
const ROW2_Y = 382;

function rewardText(r) {
  const parts = [];
  if (r.diamonds) parts.push(`钻石×${r.diamonds}`);
  if (r.stamina) parts.push(`体力×${r.stamina}`);
  if (r.frags) parts.push(`碎片×${r.frags}`);
  return parts.join(' + ');
}

export function drawSignin(ctx, save) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '签到 · 七日豪礼');
  const L = SIGNIN_LAYOUT;
  btn(ctx, L.backBtn.x, L.backBtn.y, L.backBtn.w, L.backBtn.h, '← 返 回', 'ghost', 26);

  const idx = signinIndex(save);
  const dayNames = ['第一日', '第二日', '第三日', '第四日', '第五日', '第六日', '第七日'];
  for (let i = 0; i < 7; i++) {
    const big = i === 6;
    const col = big ? 0 : i % 4, row = big ? 2 : Math.floor(i / 4);
    const x = L.grid.x + col * (L.grid.cellW + L.grid.gap);
    const y = big ? L.bigCellY : L.grid.y + row * (L.grid.cellH + L.grid.gap);
    const w = big ? L.grid.cellW * 4 + L.grid.gap * 3 : L.grid.cellW;
    const h = big ? L.bigCellH : L.grid.cellH;
    const claimed = i < idx;
    const today = i === idx;
    if (big) panel(ctx, x, y, w, h); else panel(ctx, x, y, w, h, 8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.mut; ctx.font = `600 20px ${KAI}`;
    ctx.fillText(big ? `${dayNames[i]} · 大奖` : dayNames[i], x + w / 2, y + (big ? 30 : 28));
    ctx.fillStyle = claimed ? C.gray : C.ink;
    ctx.font = `700 ${big ? 30 : 26}px ${KAI}`;
    ctx.fillText(rewardText(SIGNIN_REWARDS[i]), x + w / 2, y + (big ? 78 : 84));
    if (claimed) {
      ctx.fillStyle = C.ok; ctx.font = `700 22px ${KAI}`;
      ctx.fillText('✓ 已领取', x + w / 2, y + (big ? 116 : 122));
    }
    if (today) { // 朱砂脉冲（Date.now 驱动，rAF 逐帧重绘）
      const a = 0.35 + 0.3 * Math.sin(Date.now() / 280);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = C.cinnabar;
      ctx.lineWidth = 5;
      ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      ctx.restore();
      ctx.fillStyle = C.cinnabar; ctx.font = `700 20px ${KAI}`;
      ctx.fillText('今日', x + w / 2, y - 2);
    }
  }

  ctx.fillStyle = C.mut; ctx.font = `600 26px ${KAI}`;
  ctx.fillText(`累计签到 ${save.daily.signinCount || 0} 天 · 7 天一轮循环 · 断签不清零`, LOGICAL_W / 2, L.infoY);

  const claimable = signinClaimable(save);
  btn(ctx, L.claimBtn.x, L.claimBtn.y, L.claimBtn.w, L.claimBtn.h,
    claimable ? '📺 观看广告 · 领取今日奖励' : '今日已领取 · 明日再来',
    claimable ? 'cinnabar' : 'disabled', 30);
}

// 命中检测：save 参与领取态判定（未传时按未领处理）
export function hitSignin(x, y, save = { daily: {} }) {
  const L = SIGNIN_LAYOUT;
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inBtn(L.backBtn)) return { action: 'back' };
  if (inBtn(L.claimBtn) && signinClaimable(save)) return { action: 'claim' };
  return null;
}
