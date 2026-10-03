// render/home.js — 主城：章节卡 + 英雄横排 + 羁绊条 + 底部三按钮
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { HEROES, BOND_HEROES, chapterName, chapterMul } from '../meta/heroes.js';
import { KAI, C, panel, topbar, heroSeal, btn, starsText } from './ui.js';

// 布局常量（720×1280）
// 7 命英雄一排：cx_i = 72 + 96i，末张 648 ≤ 696 不出画
export const HOME_LAYOUT = {
  heroY: 300, heroR: 40, heroStep: 96, heroX0: 72,   // 7 格横排
  btnY: 1140, btnH: 90,
  drawBtn: { x: 30, w: 180 }, outBtn: { x: 230, w: 260 }, codexBtn: { x: 510, w: 180 },
};

export function drawHome(ctx, save, selectedHero = 'zhaoyun') {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '主城');

  // 章节卡（两张并排：当前进度章 / 下一章）
  const cw = 320, ch = 120, cy = 120;
  panel(ctx, 20, cy, cw, ch);
  ctx.fillStyle = C.ink; ctx.font = `700 32px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第一章 · ${chapterName(1)}`, 20 + cw / 2, cy + 44);
  ctx.fillStyle = C.ok; ctx.font = `600 26px ${KAI}`;
  ctx.fillText(save.progress.chapterClear >= 1 ? '✔ 已通关' : '进行中', 20 + cw / 2, cy + 88);
  panel(ctx, 380, cy, cw, ch);
  ctx.fillStyle = C.ink; ctx.font = `700 32px ${KAI}`;
  ctx.fillText(`第${save.progress.chapter}章 · ${chapterName(save.progress.chapter)}`, 380 + cw / 2, cy + 44);
  ctx.fillStyle = C.gray; ctx.font = `600 26px ${KAI}`;
  ctx.fillText(`敌军 ×${chapterMul(save.progress.chapter).toFixed(1)}`, 380 + cw / 2, cy + 88);

  // 英雄横排（7 格：6 命 + 吕布占位）
  const ids = Object.keys(HEROES);
  ids.forEach((id, i) => {
    const cx = HOME_LAYOUT.heroX0 + i * HOME_LAYOUT.heroStep;
    const h = save.heroes[id];
    heroSeal(ctx, cx, HOME_LAYOUT.heroY, HOME_LAYOUT.heroR, HEROES[id].char, h.owned, id === selectedHero && h.owned);
    ctx.fillStyle = h.owned ? C.ink : C.gray;
    ctx.font = `600 20px ${KAI}`;
    ctx.textAlign = 'center';
    ctx.fillText(HEROES[id].name, cx, HOME_LAYOUT.heroY + HOME_LAYOUT.heroR + 28);
    ctx.fillStyle = h.owned ? C.gold : C.gray;
    ctx.font = `600 16px ${KAI}`;
    ctx.fillText(h.owned ? starsText(h.stars) : '🔒', cx, HOME_LAYOUT.heroY + HOME_LAYOUT.heroR + 56);
  });

  // 羁绊条
  const owned = BOND_HEROES.filter((id) => save.heroes[id].owned).length;
  panel(ctx, 20, 420, 680, 70);
  ctx.fillStyle = owned >= 6 ? C.ok : C.mut;
  ctx.font = `600 28px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(
    owned >= 6 ? '蜀国全家福 · 羁绊激活 攻击 +15%' : `蜀国全家福 ${owned}/6 · 攻击 +15%（未激活）`,
    LOGICAL_W / 2, 455,
  );

  // 底部三按钮
  const { btnY, btnH, drawBtn, outBtn, codexBtn } = HOME_LAYOUT;
  btn(ctx, drawBtn.x, btnY, drawBtn.w, btnH, '抽 卡', 'ghost');
  btn(ctx, outBtn.x, btnY, outBtn.w, btnH, '出 战', 'cinnabar', 38);
  btn(ctx, codexBtn.x, btnY, codexBtn.w, btnH, '图 鉴', 'ghost');
}

// 命中检测 → { action, heroId? }
export function hitHome(x, y) {
  const ids = Object.keys(HEROES);
  for (let i = 0; i < ids.length; i++) {
    const cx = HOME_LAYOUT.heroX0 + i * HOME_LAYOUT.heroStep;
    const dx = x - cx, dy = y - HOME_LAYOUT.heroY;
    if (dx * dx + dy * dy <= (HOME_LAYOUT.heroR + 16) ** 2) return { action: 'hero', heroId: ids[i] };
  }
  const { btnY, btnH, drawBtn, outBtn, codexBtn } = HOME_LAYOUT;
  if (y >= btnY && y <= btnY + btnH) {
    if (x >= drawBtn.x && x <= drawBtn.x + drawBtn.w) return { action: 'gacha' };
    if (x >= outBtn.x && x <= outBtn.x + outBtn.w) return { action: 'battle' };
    if (x >= codexBtn.x && x <= codexBtn.x + codexBtn.w) return { action: 'hero', heroId: 'zhaoyun' };
  }
  return null;
}
