// src/meta/signin.js — 每日签到：7 日一轮递进奖励，看广告领取（spec 5.1）
import { rngNext } from '../engine/rng.js';
import { gainStamina } from './stamina.js';
import { todayStr } from './save.js';

export const SIGNIN_REWARDS = [
  { diamonds: 0, stamina: 20, frags: 0 },
  { diamonds: 30, stamina: 0, frags: 0 },
  { diamonds: 0, stamina: 20, frags: 0 },
  { diamonds: 50, stamina: 0, frags: 0 },
  { diamonds: 80, stamina: 0, frags: 0 },
  { diamonds: 0, stamina: 0, frags: 5 },
  { diamonds: 200, stamina: 60, frags: 0 },
];

// 当前应领格位（0-6，7 天一轮循环，断签不清零）
export function signinIndex(save) { return (save.daily.signinCount || 0) % 7; }
export function signinClaimable(save) { return save.daily.signinClaimedDate !== todayStr(); }

// 领取：入账并推进计数；当日已领返回 null。D6 碎片发给随机已拥有英雄
export function claimSignin(save, rng) {
  if (!signinClaimable(save)) return null;
  const r = SIGNIN_REWARDS[signinIndex(save)];
  save.wallet.diamonds += r.diamonds;
  gainStamina(save, r.stamina);
  let fragHero = null;
  if (r.frags > 0) {
    const owned = Object.keys(save.heroes).filter((id) => save.heroes[id].owned);
    fragHero = owned[Math.floor(rngNext(rng) * owned.length)] || null;
    if (fragHero) save.heroes[fragHero].frags += r.frags;
  }
  save.daily.signinCount = (save.daily.signinCount || 0) + 1;
  save.daily.signinClaimedDate = todayStr();
  return { ...r, fragHero };
}
