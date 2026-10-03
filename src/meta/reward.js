// src/meta/reward.js — 结算奖励计算/入账 + 抽卡结果落账（纯函数，直接改传入 save）
import { CH_HERO, DUP_FRAGS, HEROES } from './heroes.js';

// 结算奖励：首通 full（金币 800+250N、钻 30+10N、章节英雄奖励）；重复仅金币 500+150N
// 返回值附带 chapterN / firstClear，供 applyRewards 推进进度（实施修正指令）；
// 解锁英雄时 frags 记 0（无碎片入账），转碎片时为 { heroId: n }
export function resultRewards(chapterN, firstClear, save) {
  if (!firstClear) {
    return { coins: 500 + 150 * chapterN, diamonds: 0, unlockHero: null, frags: {}, chapterN, firstClear };
  }
  const { unlockHero, frags } = chapterHeroReward(chapterN, save);
  return {
    coins: 800 + 250 * chapterN, diamonds: 30 + 10 * chapterN,
    unlockHero, frags: unlockHero ? 0 : frags, chapterN, firstClear,
  };
}

// 章节英雄奖励：第 N 章对应 CH_HERO[N % 6] 轮转（第1章→关羽……赵云为初始拥有，
// 轮转自然顺延首未拥有）；未拥有→解锁，已拥有→按品质转碎片（品质取 HEROES 表）
export function chapterHeroReward(chapterN, save) {
  const id = CH_HERO[chapterN % CH_HERO.length];
  const h = save.heroes[id];
  if (h.owned) return { unlockHero: null, frags: { [id]: DUP_FRAGS[HEROES[id].quality] } };
  return { unlockHero: id, frags: {} };
}

// 入账 + 首通推进进度（chapterClear 取最大；chapter 指向下一章）
export function applyRewards(save, r) {
  save.wallet.coins += r.coins;
  save.wallet.diamonds += r.diamonds;
  if (r.unlockHero) save.heroes[r.unlockHero].owned = true;
  for (const [id, n] of Object.entries(r.frags || {})) {
    save.heroes[id].frags += n;
  }
  if (r.firstClear) {
    save.progress.chapterClear = Math.max(save.progress.chapterClear, r.chapterN);
    save.progress.chapter = save.progress.chapterClear + 1;
  }
}

// 抽卡落账：单条或数组；新英雄解锁★1，重复转碎片
export function applyGacha(save, results) {
  const list = Array.isArray(results) ? results : [results];
  for (const { heroId, dup, frags } of list) {
    const h = save.heroes[heroId];
    if (dup) h.frags += frags;
    else h.owned = true;
  }
}
