// tests/render/screens.test.js — 新屏布局常量与命中检测（纯数据，无 canvas）
import { describe, it, expect } from 'vitest';
import { SIGNIN_LAYOUT, hitSignin } from '../../src/render/signin.js';
import { SHOP_LAYOUT, hitShop } from '../../src/render/shop.js';
import { REVIVE_LAYOUT, hitRevive } from '../../src/render/revive.js';
import { defaultSave } from '../../src/meta/save.js';

it('signin 命中：返回/领取（未领可领）', () => {
  const B = SIGNIN_LAYOUT.backBtn, C = SIGNIN_LAYOUT.claimBtn;
  expect(hitSignin(B.x + 5, B.y + 5)).toEqual({ action: 'back' });
  expect(hitSignin(C.x + 5, C.y + 5)).toEqual({ action: 'claim' });
});
it('signin 命中：当日已领时 claim 返回 null', () => {
  const save = defaultSave();
  save.daily.signinClaimedDate = '2026-10-03';
  const C = SIGNIN_LAYOUT.claimBtn;
  expect(hitSignin(C.x + 5, C.y + 5, save)).toBeNull();
});
it('shop 命中：返回/购买各卡（未购）', () => {
  const save = defaultSave();
  const B = SHOP_LAYOUT.backBtn;
  expect(hitShop(B.x + 5, B.y + 5, save)).toEqual({ action: 'back' });
  for (let i = 0; i < 4; i++) {
    const c = SHOP_LAYOUT.cards[i], b = SHOP_LAYOUT.buyBtn;
    const bx = c.x + c.w - b.w - 24, by = c.y + (c.h - b.h) / 2;
    expect(hitShop(bx + 5, by + 5, save)).toEqual({ action: 'buy', sku: ['firstCharge', 'monthlyCard', 'battlePass', 'growthFund'][i] });
  }
});
it('shop 命中：已购卡返回 null', () => {
  const save = defaultSave();
  save.iap.firstCharge = true;
  const c = SHOP_LAYOUT.cards[0], b = SHOP_LAYOUT.buyBtn;
  const bx = c.x + c.w - b.w - 24, by = c.y + (c.h - b.h) / 2;
  expect(hitShop(bx + 5, by + 5, save)).toBeNull();
});
it('revive 命中：复活/撤退', () => {
  const A = REVIVE_LAYOUT.adBtn, G = REVIVE_LAYOUT.giveup;
  expect(hitRevive(A.x + 5, A.y + 5)).toEqual({ action: 'revive' });
  expect(hitRevive(G.x + G.w / 2, G.y + G.h / 2)).toEqual({ action: 'giveup' });
});
