// src/meta/iap.js — 内购落账：4 档商品购买后入账（支付通道见 platform/iap.js，spec 5.2）
import { gainStamina } from './stamina.js';
import { HEROES, DUP_FRAGS } from './heroes.js';
import { todayStr } from './save.js';

export const SKUS = {
  firstCharge: { name: '首充礼包', price: 6,  desc: 'SR 英雄自选 + 钻石×300', tag: '破冰价' },
  monthlyCard: { name: '月卡',     price: 30, desc: '每日钻石×60 + 体力×50（30 天）', tag: '30 天' },
  battlePass:  { name: '战令',     price: 68, desc: '立即解锁皮影戏限定皮肤', tag: '赛季' },
  growthFund:  { name: '成长基金', price: 98, desc: '立即钻石×1000 + 每章首通钻石×100（10 章）', tag: '10 倍返' },
};
export const FIRST_CHARGE_DIAMONDS = 300;
export const MONTHLY_DIAMONDS = 60, MONTHLY_STAMINA = 50;
export const FUND_LUMP = 1000, FUND_PER_CHAPTER = 100, FUND_CHAPTER_MAX = 10;

export function owned(save, sku) { return !!(save.iap && save.iap[sku]); }

// 首充 SR 自选池
export function srPool() {
  return Object.keys(HEROES).filter((id) => HEROES[id].quality === 'SR');
}

// 购买成功后的即时入账（首充的 SR 选择由 UI 层二次走 grantFirstChargeHero）
export function applyIap(save, sku) {
  if (!save.iap) save.iap = { firstCharge: false, monthly: false, monthlyLastClaim: '', pass: false, fund: false, fundChapters: [] };
  switch (sku) {
    case 'firstCharge':
      save.iap.firstCharge = true;
      save.wallet.diamonds += FIRST_CHARGE_DIAMONDS;
      return { sku, diamonds: FIRST_CHARGE_DIAMONDS, pick: true };
    case 'monthlyCard':
      save.iap.monthly = true;
      grantMonthlyDaily(save); // 当日立即发放首份
      return { sku };
    case 'battlePass':
      save.iap.pass = true;
      save.cosmetics.shadowOwned = true;
      save.cosmetics.skin = 'shadow';
      return { sku, skin: 'shadow' };
    case 'growthFund':
      save.iap.fund = true;
      save.wallet.diamonds += FUND_LUMP;
      return { sku, diamonds: FUND_LUMP };
    default:
      return null;
  }
}

// 月卡每日发放（启动/跨日时机调用；同日幂等）
export function grantMonthlyDaily(save, today = todayStr()) {
  if (!save.iap || !save.iap.monthly) return 0;
  if (save.iap.monthlyLastClaim === today) return 0;
  save.iap.monthlyLastClaim = today;
  save.wallet.diamonds += MONTHLY_DIAMONDS;
  gainStamina(save, MONTHLY_STAMINA);
  return MONTHLY_DIAMONDS + MONTHLY_STAMINA;
}

// 首充 SR 选择落账：未拥有 → 解锁；已拥有 → 转碎片
export function grantFirstChargeHero(save, heroId) {
  const h = save.heroes[heroId];
  if (!h) return null;
  if (h.owned) {
    const frags = DUP_FRAGS[HEROES[heroId].quality];
    h.frags += frags;
    return { heroId, dup: true, frags };
  }
  h.owned = true;
  return { heroId, dup: false };
}

// 成长基金章节首通追加返还（core 落账钩子内调用）；去重且 10 章封顶
export function fundChapterBonus(save, chapterN) {
  if (!save.iap || !save.iap.fund) return 0;
  save.iap.fundChapters = save.iap.fundChapters || [];
  if (save.iap.fundChapters.includes(chapterN)) return 0;
  if (save.iap.fundChapters.length >= FUND_CHAPTER_MAX) return 0;
  save.iap.fundChapters.push(chapterN);
  save.wallet.diamonds += FUND_PER_CHAPTER;
  return FUND_PER_CHAPTER;
}
