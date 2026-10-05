// render/result.js — 结算页：胜/败横幅 + 三奖励 + 广告翻倍占位 + 重打/下一章
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { HEROES } from '../meta/heroes.js';
import { KAI, C, panel, heroSeal, btn } from './ui.js';

export const RESULT_LAYOUT = {
  adBtn: { x: 160, y: 640, w: 400, h: 84 },
  againBtn: { x: 40, y: 1120, w: 280, h: 100 },
  nextBtn: { x: 400, y: 1120, w: 280, h: 100 },
  rewardY: 470, rewardH: 90, rewardW: 200, rewardX0: 40,
};

export function drawResult(ctx, save, data) {
  // data: { win, chapterN, rewards:{coins,diamonds,unlockHero,frags}, doubled }
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = 'rgba(31,27,22,0.92)';
  ctx.fillRect(0, 0, LOGICAL_W, 90);
  ctx.fillStyle = C.paper; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(data.win ? '大获全胜' : '败 北', LOGICAL_W / 2, 45);

  ctx.fillStyle = C.ink; ctx.font = `700 34px ${KAI}`;
  ctx.fillText(data.modeText ? data.modeTitle || '' : `第${data.chapterN}章 · 15 波 ${data.win ? '通关' : '止步'}`, LOGICAL_W / 2, 200);
  // M7 挑战模式副徽标（无尽/每日/车轮战战绩行）
  if (data.modeText) {
    ctx.fillStyle = C.cinnabar; ctx.font = `700 28px ${KAI}`;
    ctx.fillText(data.modeText, LOGICAL_W / 2, 250);
  }

  // 三奖励：金币 / 英雄或碎片 / 钻石
  const { rewardX0, rewardY, rewardW, rewardH } = RESULT_LAYOUT;
  const items = [
    `🪙 +${data.rewards.coins}`,
    data.rewards.unlockHero ? `${HEROES[data.rewards.unlockHero].name} 解锁`
      : Object.entries(data.rewards.frags).map(([id, n]) => `${HEROES[id].name}碎片+${n}`).join(' ') || '—',
    `💎 +${data.rewards.diamonds}`,
  ];
  items.forEach((t, i) => {
    panel(ctx, rewardX0 + i * (rewardW + 20), rewardY, rewardW, rewardH);
    ctx.fillStyle = C.ink; ctx.font = `700 26px ${KAI}`;
    ctx.fillText(t, rewardX0 + i * (rewardW + 20) + rewardW / 2, rewardY + rewardH / 2);
  });

  // 广告翻倍占位（M4 接 wx 激励视频；M3 H5 直发 ×2）
  const { adBtn } = RESULT_LAYOUT;
  if (!data.doubled && data.win) {
    btn(ctx, adBtn.x, adBtn.y, adBtn.w, adBtn.h, '📺 观看广告 · 奖励翻倍', 'ghost', 28);
  } else if (data.doubled) {
    ctx.fillStyle = C.ok; ctx.font = `600 26px ${KAI}`;
    ctx.fillText('已翻倍领取', LOGICAL_W / 2, adBtn.y + adBtn.h + 32); // M7 分享按钮占用广告位，状态文字下移避让
  }
  // M7 分享战绩入口：广告可点时让位广告（激励优先），败局/已翻倍态显示（spec 11.5 分享点）
  if (!(data.win && !data.doubled)) {
    btn(ctx, adBtn.x, adBtn.y, adBtn.w, adBtn.h, '📣 分享战绩', 'ghost', 28);
  }

  // 解锁英雄展示
  if (data.rewards.unlockHero) {
    heroSeal(ctx, LOGICAL_W / 2, 950, 90, HEROES[data.rewards.unlockHero].char, true, true);
    ctx.fillStyle = C.ink; ctx.font = `700 30px ${KAI}`;
    ctx.fillText(`新武将 · ${HEROES[data.rewards.unlockHero].name}`, LOGICAL_W / 2, 1070);
  }

  const { againBtn, nextBtn } = RESULT_LAYOUT;
  btn(ctx, againBtn.x, againBtn.y, againBtn.w, againBtn.h, '重 打', 'ghost');
  if (data.win) btn(ctx, nextBtn.x, nextBtn.y, nextBtn.w, nextBtn.h, '下一章', 'gold', 36);
}

// 命中检测：翻倍 / 分享 / 重打 / 下一章（胜负与已翻倍态参与判定）
export function hitResult(x, y, data) {
  const { adBtn, againBtn, nextBtn } = RESULT_LAYOUT;
  const inBtn = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (!(data.win && !data.doubled) && inBtn(adBtn)) return { action: 'share' }; // M7 分享（与广告位同区，互斥让位）
  if (data.win && !data.doubled && inBtn(adBtn)) return { action: 'double' };
  if (inBtn(againBtn)) return { action: 'again' };
  if (data.win && inBtn(nextBtn)) return { action: 'next' };
  return null;
}
