// render/home.js — 主城：章节卡 + 英雄横排 + 羁绊条 + M6 入口行（军务/签到/商城三等分）+ 皮影皮肤卡 + 底部三按钮
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { HEROES, BOND_HEROES, chapterName, chapterMul } from '../meta/heroes.js';
import { signinClaimable } from '../meta/signin.js';
import { anyClaimable } from '../meta/quests.js';
import { currentSkin } from '../render/theme.js';
import { KAI, C, panel, topbar, heroSeal, btn, starsText } from './ui.js';
import { drawPortrait } from './portrait.js';

// 布局常量（720×1280）
export const HOME_LAYOUT = {
  heroY: 300, heroR: 32, heroStep: 74, heroX0: 27,   // M7 9 格横排
  questBtn: { x: 20, y: 540, w: 213, h: 90 },        // M6 军务
  signinBtn: { x: 243, y: 540, w: 213, h: 90 },      // M5 入口行
  shopBtn: { x: 466, y: 540, w: 214, h: 90 },
  skinCard: { x: 30, y: 660, w: 660, h: 170 },
  skinBtn: { w: 200, h: 70 },
  challengeCard: { x: 30, y: 830, w: 660, h: 130 },                 // M7 征战大卡
  toolRow: { x: 20, y: 980, w: 680, h: 90, cell: 170 },             // M7 功能行四格
  btnY: 1140, btnH: 90,
  drawBtn: { x: 30, w: 180 }, outBtn: { x: 230, w: 260 }, codexBtn: { x: 510, w: 180 },
};

export function drawHome(ctx, save, selectedHero = 'zhaoyun', redDots = {}) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '主城');
  const L = HOME_LAYOUT;

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

  // 英雄横排（9 格）
  const ids = Object.keys(HEROES);
  ids.forEach((id, i) => {
    const cx = HOME_LAYOUT.heroX0 + i * HOME_LAYOUT.heroStep;
    const h = save.heroes[id] || {}; // 旧档缺将键时按未拥有渲染（渲染循环不可崩）
    drawPortrait(ctx, cx, HOME_LAYOUT.heroY, HOME_LAYOUT.heroR, id, { owned: h.owned, selected: id === selectedHero && h.owned });
    ctx.fillStyle = h.owned ? C.ink : C.gray;
    ctx.font = `600 20px ${KAI}`;
    ctx.textAlign = 'center';
    ctx.fillText(HEROES[id].name, cx, HOME_LAYOUT.heroY + HOME_LAYOUT.heroR + 28);
    ctx.fillStyle = h.owned ? C.gold : C.gray;
    ctx.font = `600 16px ${KAI}`;
    ctx.fillText(h.owned ? starsText(h.stars) : '🔒', cx, HOME_LAYOUT.heroY + HOME_LAYOUT.heroR + 56);
  });

  // 羁绊条
  const ownedCnt = BOND_HEROES.filter((id) => save.heroes[id]?.owned).length;
  panel(ctx, 20, 420, 680, 70);
  ctx.fillStyle = ownedCnt >= 6 ? C.ok : C.mut;
  ctx.font = `600 28px ${KAI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(
    ownedCnt >= 6 ? '蜀国全家福 · 羁绊激活 攻击 +15%' : `蜀国全家福 ${ownedCnt}/6 · 攻击 +15%（未激活）`,
    LOGICAL_W / 2, 455,
  );

  // M6 入口行：军务（红点）+ 签到（红点）+ 商城（三等分）
  drawEntry(ctx, L.questBtn, '务', '军务', anyClaimable(save));
  drawEntry(ctx, L.signinBtn, '签', '每日签到', signinClaimable(save));
  drawEntry(ctx, L.shopBtn, '商', '商城', false);

  // 皮影皮肤卡
  drawSkinCard(ctx, save, L);

  // M7 征战大卡（每日挑战可挑战/可领奖红点）
  const cc = L.challengeCard;
  panel(ctx, cc.x, cc.y, cc.w, cc.h);
  heroSeal(ctx, cc.x + 80, cc.y + cc.h / 2, 46, '征', true, true);
  ctx.fillStyle = C.ink; ctx.font = `700 40px ${KAI}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('征 战', cc.x + 150, cc.y + 46);
  ctx.fillStyle = C.mut; ctx.font = `600 26px ${KAI}`;
  ctx.fillText('无尽 · 每日挑战 · 车轮战', cc.x + 150, cc.y + 94);
  // M7 功能行四格：功勋/分享/公告/声音（红点由 core 传参 redDots）
  drawToolRow(ctx, save, L.toolRow, redDots);

  // 底部三按钮
  const { btnY, btnH, drawBtn, outBtn, codexBtn } = HOME_LAYOUT;
  btn(ctx, drawBtn.x, btnY, drawBtn.w, btnH, '抽 卡', 'ghost');
  btn(ctx, outBtn.x, btnY, outBtn.w, btnH, '出 战', 'cinnabar', 38);
  btn(ctx, codexBtn.x, btnY, codexBtn.w, btnH, '图 鉴', 'ghost');
}

function drawEntry(ctx, box, char, label, redDot) {
  panel(ctx, box.x, box.y, box.w, box.h);
  heroSeal(ctx, box.x + 56, box.y + box.h / 2, 30, char, true, false);
  ctx.fillStyle = C.ink; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, box.x + 108, box.y + box.h / 2);
  if (redDot) {
    ctx.fillStyle = C.cinnabar;
    ctx.beginPath();
    ctx.arc(box.x + box.w - 26, box.y + 22, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSkinCard(ctx, save, L) {
  const s = L.skinCard;
  panel(ctx, s.x, s.y, s.w, s.h);
  // 皮影预览小窗：暗底 + 灯窗光晕 + 剪影「云」
  const px = s.x + 22, py = s.y + 22, pw = 126;
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(px, py, pw, s.h - 44);
  const g = ctx.createRadialGradient(px + pw / 2, py + (s.h - 44) / 2, 0, px + pw / 2, py + (s.h - 44) / 2, pw * 0.7);
  g.addColorStop(0, 'rgba(240,200,110,0.85)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(px, py, pw, s.h - 44);
  ctx.fillStyle = '#12100c'; ctx.font = `700 44px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('云', px + pw / 2, py + (s.h - 44) / 2);
  // 文案
  ctx.fillStyle = C.ink; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'left';
  ctx.fillText('皮影戏 · 整包皮肤', px + pw + 26, s.y + 52);
  ctx.fillStyle = C.mut; ctx.font = `600 22px ${KAI}`;
  ctx.fillText('暗底暖光 · 镂空剪影', px + pw + 26, s.y + 100);
  // 右侧按钮：未解锁 → 广告解锁；已解锁 → 使用中/换装
  const cur = currentSkin();
  const b = L.skinBtn;
  const bx = s.x + s.w - b.w - 22, by = s.y + (s.h - b.h) / 2;
  if (!save.cosmetics.shadowOwned) {
    btn(ctx, bx, by, b.w, b.h, '📺 解锁', 'ghost', 28);
  } else if (cur === 'shadow') {
    btn(ctx, bx, by, b.w, b.h, '使用中', 'gold', 28);
  } else {
    btn(ctx, bx, by, b.w, b.h, '换 装', 'ghost', 28);
  }
}

// M7 功能行：功勋/分享/公告/声音（点击动作在 core 分发；红点 Task 4/5/6 接管）
const TOOLS = [
  { key: 'achv', char: '功', label: '功勋' },
  { key: 'share', char: '享', label: '分享' },
  { key: 'notices', char: '公', label: '公告' },
  { key: 'sound', char: '声', label: '声音' },
];

function drawToolRow(ctx, save, row, redDots) {
  TOOLS.forEach((t, i) => {
    const x = row.x + i * row.cell;
    panel(ctx, x, row.y, row.cell - 10, row.h);
    heroSeal(ctx, x + 44, row.y + row.h / 2, 26, t.char, true, false);
    ctx.fillStyle = C.ink; ctx.font = `600 26px ${KAI}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(t.label, x + 84, row.y + row.h / 2);
    if (redDots[t.key]) {
      ctx.fillStyle = C.cinnabar;
      ctx.beginPath();
      ctx.arc(x + row.cell - 34, row.y + 22, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// 命中检测 → { action, heroId? }
export function hitHome(x, y) {
  const ids = Object.keys(HEROES);
  for (let i = 0; i < ids.length; i++) {
    const cx = HOME_LAYOUT.heroX0 + i * HOME_LAYOUT.heroStep;
    const dx = x - cx, dy = y - HOME_LAYOUT.heroY;
    if (dx * dx + dy * dy <= (HOME_LAYOUT.heroR + 16) ** 2) return { action: 'hero', heroId: ids[i] };
  }
  const L = HOME_LAYOUT;
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inBtn(L.questBtn)) return { action: 'quests' };
  if (inBtn(L.signinBtn)) return { action: 'signin' };
  if (inBtn(L.shopBtn)) return { action: 'shop' };
  if (inBtn(L.skinCard)) return { action: 'skin' };
  if (inBtn(L.challengeCard)) return { action: 'challenge' };
  if (y >= L.toolRow.y && y <= L.toolRow.y + L.toolRow.h) {
    const i = Math.floor((x - L.toolRow.x) / L.toolRow.cell);
    if (i >= 0 && i < 4) return { action: TOOLS[i].key };
  }
  const { btnY, btnH, drawBtn, outBtn, codexBtn } = HOME_LAYOUT;
  if (y >= btnY && y <= btnY + btnH) {
    if (x >= drawBtn.x && x <= drawBtn.x + drawBtn.w) return { action: 'gacha' };
    if (x >= outBtn.x && x <= outBtn.x + outBtn.w) return { action: 'battle' };
    if (x >= codexBtn.x && x <= codexBtn.x + codexBtn.w) return { action: 'hero', heroId: 'zhaoyun' };
  }
  return null;
}
