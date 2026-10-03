// render/revive.js — 战败复活弹层：原地满血复活，本局 1 次，看广告（spec 5.1，mockup ③定稿）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { KAI, C, panel, heroSeal, btn } from './ui.js';

export const REVIVE_LAYOUT = {
  card: { x: 140, y: 380, w: 440, h: 520 },
  adBtn: { x: 210, y: 720, w: 300, h: 90 },
  giveup: { x: 200, y: 830, w: 320, h: 60 },
};

export function drawRevive(ctx, wave) {
  ctx.fillStyle = 'rgba(26,20,16,0.78)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  const L = REVIVE_LAYOUT;
  panel(ctx, L.card.x, L.card.y, L.card.w, L.card.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink; ctx.font = `700 44px ${KAI}`;
  ctx.fillText('将 军 身 陨', LOGICAL_W / 2, L.card.y + 60);
  ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
  ctx.fillText('常山赵子龙 · 血战力竭', LOGICAL_W / 2, L.card.y + 105);
  heroSeal(ctx, LOGICAL_W / 2, L.card.y + 190, 58, '云', true, true);
  // 空血条
  const bw = 300, bx = LOGICAL_W / 2 - bw / 2, by = L.card.y + 270;
  ctx.fillStyle = 'rgba(31,27,22,0.3)';
  ctx.fillRect(bx, by, bw, 14);
  ctx.fillStyle = C.paper; ctx.font = `600 18px ${KAI}`;
  ctx.fillText('体力尽失', LOGICAL_W / 2, by + 8);
  ctx.fillStyle = C.cinnabar; ctx.font = `700 26px ${KAI}`;
  ctx.fillText(`止步第 ${wave} 波 · 原地满血复活`, LOGICAL_W / 2, L.card.y + 310);
  btn(ctx, L.adBtn.x, L.adBtn.y, L.adBtn.w, L.adBtn.h, '📺 观看广告 · 复活', 'cinnabar', 30);
  ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
  ctx.fillText('忍痛撤退（回结算）', LOGICAL_W / 2, L.giveup.y + L.giveup.h / 2);
}

// 命中检测：复活 / 撤退
export function hitRevive(x, y) {
  const L = REVIVE_LAYOUT;
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inBtn(L.adBtn)) return { action: 'revive' };
  if (inBtn(L.giveup)) return { action: 'giveup' };
  return null;
}
