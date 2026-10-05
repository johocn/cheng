// render/challenge.js — M7 征战屏：三模式竖卡（解锁阶梯 + 个人最佳）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { KAI, C, panel, heroSeal, btn, topbar } from './ui.js';

export const CHALLENGE_LAYOUT = {
  back: { x: 20, y: 20, w: 80, h: 60 },
  cards: [
    { key: 'daily', x: 20, y: 110, w: 680, h: 300 },
    { key: 'endless', x: 20, y: 430, w: 680, h: 300 },
    { key: 'bossrush', x: 20, y: 750, w: 680, h: 300 },
  ],
  playBtn: { w: 160, h: 64 },
};

const META = {
  daily: { seal: '日', name: '每日挑战', desc: '固定种子全服同关 · 通关领 ◆50', lockAt: '通关第 1 章解锁' },
  endless: { seal: '无', name: '无尽模式', desc: '波次无限递增 · 每 5 波发金币', lockAt: '通关第 2 章解锁' },
  bossrush: { seal: '车', name: 'BOSS 车轮战', desc: '帅连续来袭 · 击败数计分', lockAt: '通关第 4 章解锁' },
};

function bestText(mode, save) {
  if (mode === 'endless') return save.progress.endlessBest ? `最佳战绩 ${save.progress.endlessBest} 波` : '暂无战绩';
  if (mode === 'bossrush') return save.progress.bossBest ? `最佳战绩 ${save.progress.bossBest} BOSS` : '暂无战绩';
  return save.progress.dailyPaid === '' ? '今日奖励待领 ◆50' : '今日已完成';
}

export function drawChallenge(ctx, save, unlocked) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '征 战');
  ctx.fillStyle = C.paper; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('征 战', LOGICAL_W / 2, 50);
  // 返回
  btn(ctx, CHALLENGE_LAYOUT.back.x, CHALLENGE_LAYOUT.back.y, CHALLENGE_LAYOUT.back.w, CHALLENGE_LAYOUT.back.h, '← 返', 'ghost', 26);
  CHALLENGE_LAYOUT.cards.forEach((card) => {
    const m = META[card.key];
    const open = unlocked[card.key];
    panel(ctx, card.x, card.y, card.w, card.h);
    heroSeal(ctx, card.x + 70, card.y + 90, 46, m.seal, true, open);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; ctx.font = `700 34px ${KAI}`;
    ctx.fillText(m.name, card.x + 140, card.y + 56);
    ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
    ctx.fillText(m.desc, card.x + 140, card.y + 102);
    ctx.fillStyle = C.gold; ctx.font = `700 26px ${KAI}`;
    ctx.fillText(bestText(card.key, save), card.x + 140, card.y + 150);
    if (open) {
      const b = CHALLENGE_LAYOUT.playBtn;
      btn(ctx, card.x + card.w - b.w - 30, card.y + card.h - b.h - 30, b.w, b.h, '挑 战', 'cinnabar', 30);
    } else {
      ctx.fillStyle = C.gray; ctx.font = `600 26px ${KAI}`;
      ctx.fillText(`🔒 ${m.lockAt}`, card.x + 140, card.y + 205);
    }
  });
}

export function hitChallenge(x, y, save) {
  const L = CHALLENGE_LAYOUT;
  if (x >= L.back.x && x <= L.back.x + L.back.w && y >= L.back.y && y <= L.back.y + L.back.h) return { action: 'back' };
  for (const card of L.cards) {
    if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) return { action: 'mode', mode: card.key };
  }
  return null;
}
