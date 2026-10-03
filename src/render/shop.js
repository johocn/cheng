// render/shop.js — 商城屏：4 档内购（桩支付）+ 首充 SR 自选浮层（mockup ②定稿）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { HEROES } from '../meta/heroes.js';
import { SKUS, owned } from '../meta/iap.js';
import { KAI, C, panel, topbar, heroSeal, btn } from './ui.js';

export const SHOP_LAYOUT = {
  backBtn: { x: 20, y: 110, w: 110, h: 64 },
  cards: [
    { x: 30, y: 210, w: 660, h: 170 },
    { x: 30, y: 400, w: 660, h: 170 },
    { x: 30, y: 590, w: 660, h: 170 },
    { x: 30, y: 780, w: 660, h: 170 },
  ],
  buyBtn: { w: 170, h: 70 },
  sealChars: { firstCharge: '礼', monthlyCard: '月', battlePass: '令', growthFund: '基' },
  pickSeals: { cx: [260, 460], cy: 620, r: 60 },
};
const SKU_ORDER = ['firstCharge', 'monthlyCard', 'battlePass', 'growthFund'];

export function drawShop(ctx, save, pickPool) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '商 城');
  const L = SHOP_LAYOUT;
  btn(ctx, L.backBtn.x, L.backBtn.y, L.backBtn.w, L.backBtn.h, '← 返 回', 'ghost', 26);

  SKU_ORDER.forEach((sku, i) => {
    const def = SKUS[sku], card = L.cards[i], b = L.buyBtn;
    panel(ctx, card.x, card.y, card.w, card.h);
    heroSeal(ctx, card.x + 80, card.y + card.h / 2, 44, L.sealChars[sku], true, false);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; ctx.font = `700 32px ${KAI}`;
    ctx.fillText(def.name, card.x + 150, card.y + 52);
    ctx.fillStyle = C.bronze; ctx.font = `600 22px ${KAI}`;
    ctx.fillText(def.tag, card.x + 150 + ctx.measureText(def.name).width + 90, card.y + 52);
    ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
    ctx.fillText(def.desc, card.x + 150, card.y + 104);
    const has = owned(save, sku);
    const bx = card.x + card.w - b.w - 24, by = card.y + (card.h - b.h) / 2;
    btn(ctx, bx, by, b.w, b.h, has ? '已拥有' : `¥${def.price}`,
      has ? 'disabled' : (sku === 'monthlyCard' || sku === 'growthFund' ? 'gold' : 'cinnabar'), 30);
  });

  ctx.fillStyle = C.mut; ctx.font = `600 22px ${KAI}`;
  ctx.textAlign = 'center';
  ctx.fillText('桩模式：正式 AppID + 商户配置后自动切换真实支付（platform/iap.js）', LOGICAL_W / 2, 1010);

  if (pickPool) drawPick(ctx, pickPool);
}

// 首充 SR 自选浮层（gacha 结果浮层同构：点击任意处外无效，仅点将有效）
function drawPick(ctx, pool) {
  const L = SHOP_LAYOUT;
  ctx.fillStyle = 'rgba(31,27,22,0.92)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  panel(ctx, 120, 260, 480, 560);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink; ctx.font = `700 40px ${KAI}`;
  ctx.fillText('首充 · SR 自选', LOGICAL_W / 2, 340);
  ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
  ctx.fillText('点选一位 SR 英雄入伍（已拥有转碎片）', LOGICAL_W / 2, 420);
  pool.forEach((id, i) => {
    const cx = L.pickSeals.cx[i] ?? 360, cy = L.pickSeals.cy;
    heroSeal(ctx, cx, cy, L.pickSeals.r, HEROES[id].char, true, true);
    ctx.fillStyle = C.ink; ctx.font = `700 26px ${KAI}`;
    ctx.fillText(HEROES[id].name, cx, cy + L.pickSeals.r + 40);
  });
}

// 命中检测：save 参与已购判定；pickPool 存在时仅响应点将
export function hitShop(x, y, save, pickPool) {
  const L = SHOP_LAYOUT;
  if (pickPool) {
    for (let i = 0; i < pickPool.length; i++) {
      const cx = L.pickSeals.cx[i] ?? 360, cy = L.pickSeals.cy, r = L.pickSeals.r;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= (r + 16) ** 2) return { action: 'pickHero', heroId: pickPool[i] };
    }
    return null;
  }
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inBtn(L.backBtn)) return { action: 'back' };
  for (let i = 0; i < SKU_ORDER.length; i++) {
    const sku = SKU_ORDER[i], card = L.cards[i], b = L.buyBtn;
    const bx = card.x + card.w - b.w - 24, by = card.y + (card.h - b.h) / 2;
    if (x >= bx && x <= bx + b.w && y >= by && y <= by + b.h && !owned(save, sku)) {
      return { action: 'buy', sku };
    }
  }
  return null;
}
