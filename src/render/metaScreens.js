// render/metaScreens.js — 英雄详情屏 + 名将录屏
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { HEROES, GACHA_POOL, STAR_MAX } from '../meta/heroes.js';
import { levelCap, levelUpCost, fragNeeded } from '../meta/meta.js';
import { PULL_COST, TEN_COST } from '../meta/gacha.js';
import { KAI, C, panel, topbar, btn, starsText } from './ui.js';
import { drawPortrait } from './portrait.js';

export const DETAIL_LAYOUT = {
  backBtn: { x: 20, y: 110, w: 110, h: 64 },
  portrait: { cx: 360, cy: 330, r: 110 },
  lvRow: { y: 470 },
  upBtn: { x: 470, y: 450, w: 220, h: 64 },
  statPanel: { x: 20, y: 560, w: 680, h: 300 },
  starBtn: { x: 160, y: 900, w: 400, h: 84 },
};

export function drawDetail(ctx, save, heroId) {
  const def = HEROES[heroId];
  const h = save.heroes[heroId];
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, `${def.name} · ${def.quality} · ${def.tag}`);
  const L = DETAIL_LAYOUT;

  btn(ctx, L.backBtn.x, L.backBtn.y, L.backBtn.w, L.backBtn.h, '← 返 回', 'ghost', 26);
  drawPortrait(ctx, L.portrait.cx, L.portrait.cy, L.portrait.r, heroId, { owned: h.owned, selected: true });
  ctx.fillStyle = C.gold; ctx.font = `700 34px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(starsText(h.stars, STAR_MAX), L.portrait.cx, L.portrait.cy + L.portrait.r + 40);

  // 等级行 + 升级按钮
  const cap = levelCap(save);
  ctx.fillStyle = C.ink; ctx.font = `700 32px ${KAI}`; ctx.textAlign = 'left';
  ctx.fillText(`Lv.${h.level} / ${cap}`, 30, L.lvRow.y + 32);
  const canLv = h.owned && h.level < cap;
  btn(ctx, L.upBtn.x, L.upBtn.y, L.upBtn.w, L.upBtn.h,
    `升级 🪙${levelUpCost(h)}`, canLv ? 'gold' : 'disabled', 26);

  // 属性面板（羊皮卷）
  panel(ctx, L.statPanel.x, L.statPanel.y, L.statPanel.w, L.statPanel.h);
  const rows = [
    ['品质', def.quality],
    ['获取', def.obtain],
    ['碎片', `${h.frags} / ${fragNeeded(h)}（下一星）`],
    ['等级加成', `+${Math.round((h.level - 1) * 6)}% 攻击`],
    ['星级加成', `+${Math.round((h.stars - 1) * 20)}% 攻击`],
  ];
  rows.forEach(([k, v], i) => {
    const y = L.statPanel.y + 50 + i * 50;
    ctx.fillStyle = C.mut; ctx.font = `600 26px ${KAI}`; ctx.textAlign = 'left';
    ctx.fillText(k, L.statPanel.x + 40, y);
    ctx.fillStyle = C.ink; ctx.textAlign = 'right';
    ctx.fillText(v, L.statPanel.x + L.statPanel.w - 40, y);
  });

  const canStar = h.owned && h.stars < STAR_MAX && h.frags >= fragNeeded(h);
  btn(ctx, L.starBtn.x, L.starBtn.y, L.starBtn.w, L.starBtn.h,
    h.stars >= STAR_MAX ? '★ 已满星' : `升 星（碎片 ${h.frags}/${fragNeeded(h)}）`,
    canStar ? 'cinnabar' : 'disabled', 30);
}

// 命中检测：返回 / 升级 / 升星
export function hitDetail(x, y) {
  const L = DETAIL_LAYOUT;
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inBtn(L.backBtn)) return { action: 'back' };
  if (inBtn(L.upBtn)) return { action: 'levelUp' };
  if (inBtn(L.starBtn)) return { action: 'starUp' };
  return null;
}

// ============ 名将录 ============
export const GACHA_LAYOUT = {
  backBtn: { x: 20, y: 110, w: 110, h: 64 },
  poolPanel: { x: 20, y: 200, w: 680, h: 460 },
  rateY: 720,
  freeBtn: { x: 110, y: 860, w: 500, h: 84 },
  singleBtn: { x: 40, y: 1120, w: 300, h: 100 },
  tenBtn: { x: 380, y: 1120, w: 300, h: 100 },
  resultGridY: 240, resultCell: { w: 130, h: 170, step: 138 },
};

export function drawGacha(ctx, save, gachaResult) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '名将录');
  const L = GACHA_LAYOUT;

  btn(ctx, L.backBtn.x, L.backBtn.y, L.backBtn.w, L.backBtn.h, '← 返 回', 'ghost', 26);
  panel(ctx, L.poolPanel.x, L.poolPanel.y, L.poolPanel.w, L.poolPanel.h);
  ctx.fillStyle = C.ink; ctx.font = `700 44px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('名 将 录', LOGICAL_W / 2, L.poolPanel.y + 90);
  ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
  ctx.fillText('UR 1.5% · SSR 8.5% · SR 30% · R 60%', LOGICAL_W / 2, L.poolPanel.y + 150);
  // 卡池英雄一览（6 命小牌 + 获取态）：cx_i = 95 + 110i，末张 645 + r42 ≤ 696 不出画
  GACHA_POOL.forEach((id, i) => {
    const cx = 95 + i * 110;
    drawPortrait(ctx, cx, L.poolPanel.y + 300, 42, id, { owned: save.heroes[id].owned, selected: false });
    ctx.fillStyle = save.heroes[id].owned ? C.ink : C.gray;
    ctx.font = `600 20px ${KAI}`;
    ctx.fillText(HEROES[id].name, cx, L.poolPanel.y + 380);
  });

  // 免费抽（H5 直发占位，M4 接 wx 激励视频）
  const free = 3 - save.daily.freePulls;
  btn(ctx, L.freeBtn.x, L.freeBtn.y, L.freeBtn.w, L.freeBtn.h,
    free > 0 ? `📺 看广告 · 免费单抽（今日 ${save.daily.freePulls}/3）` : '今日免费抽已用完',
    free > 0 ? 'ghost' : 'disabled', 26);

  const canSingle = save.wallet.diamonds >= PULL_COST;
  const canTen = save.wallet.diamonds >= TEN_COST;
  btn(ctx, L.singleBtn.x, L.singleBtn.y, L.singleBtn.w, L.singleBtn.h, `单抽 💎${PULL_COST}`, canSingle ? 'cinnabar' : 'disabled', 30);
  btn(ctx, L.tenBtn.x, L.tenBtn.y, L.tenBtn.w, L.tenBtn.h, `十连 💎${TEN_COST}`, canTen ? 'gold' : 'disabled', 30);

  if (gachaResult) drawGachaResult(ctx, save, gachaResult);
}

// 抽卡结果浮层：十连 5×2 / 单抽 1
function drawGachaResult(ctx, save, results) {
  ctx.fillStyle = 'rgba(31,27,22,0.92)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = C.paper; ctx.font = `700 40px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('招募结果（点击任意处关闭）', LOGICAL_W / 2, 120);
  const L = GACHA_LAYOUT;
  const list = Array.isArray(results) ? results : [results];
  list.forEach((r, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const cx = 130 + col * L.resultCell.step;
    const cy = L.resultGridY + row * (L.resultCell.h + 40) + L.resultCell.h / 2;
    const ownedBefore = r.dup; // dup = 抽取时已拥有
    drawPortrait(ctx, cx, cy, 56, r.heroId, { owned: true, selected: true });
    ctx.fillStyle = ownedBefore ? C.mut : C.gold;
    ctx.font = `700 24px ${KAI}`;
    ctx.fillText(ownedBefore ? `碎片+${r.frags}` : 'NEW!', cx, cy + 88);
  });
}

// 命中：结果浮层存在时点击任意处关闭；否则三按钮（费用不足返回 null）
export function hitGacha(x, y, save, gachaResult) {
  if (gachaResult) return { action: 'closeResult' };
  const L = GACHA_LAYOUT;
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inBtn(L.backBtn)) return { action: 'back' };
  if (inBtn(L.freeBtn)) return save.daily.freePulls < 3 ? { action: 'freePull' } : null;
  if (inBtn(L.singleBtn)) return save.wallet.diamonds >= PULL_COST ? { action: 'pullTen' } : null;
  if (inBtn(L.tenBtn)) return save.wallet.diamonds >= TEN_COST ? { action: 'pullTen', ten: true } : null;
  return null;
}
