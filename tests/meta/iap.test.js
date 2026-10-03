// tests/meta/iap.test.js — 4 档内购落账/月卡每日发放/基金章节返还/首充 SR 落账
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SKUS, applyIap, grantMonthlyDaily, grantFirstChargeHero, fundChapterBonus, srPool, FUND_CHAPTER_MAX } from '../../src/meta/iap.js';
import { defaultSave } from '../../src/meta/save.js';

afterEach(() => { vi.unstubAllGlobals(); });
function freezeDate() {
  vi.stubGlobal('Date', class extends Date {
    static now() { return Date.parse('2026-10-03T12:00:00Z'); }
    toISOString() { return '2026-10-03T12:00:00.000Z'; }
  });
}

it('SKU 表：4 档定价与文案', () => {
  expect(Object.keys(SKUS)).toEqual(['firstCharge', 'monthlyCard', 'battlePass', 'growthFund']);
  expect(SKUS.firstCharge.price).toBe(6);
  expect(SKUS.growthFund.price).toBe(98);
});

describe('applyIap', () => {
  it('首充：钻+300 且要求 SR 选择', () => {
    const s = defaultSave();
    const r = applyIap(s, 'firstCharge');
    expect(s.iap.firstCharge).toBe(true);
    expect(s.wallet.diamonds).toBe(600);
    expect(r.pick).toBe(true);
  });
  it('月卡：置位并当日发放首份（钻60+体力50）', () => {
    freezeDate();
    const s = defaultSave();
    applyIap(s, 'monthlyCard');
    expect(s.iap.monthly).toBe(true);
    expect(s.wallet.diamonds).toBe(360);
    expect(s.wallet.stamina).toBe(110);
    expect(s.iap.monthlyLastClaim).toBe('2026-10-03');
  });
  it('战令：置位并解锁皮影皮肤', () => {
    const s = defaultSave();
    const r = applyIap(s, 'battlePass');
    expect(s.iap.pass).toBe(true);
    expect(s.cosmetics.shadowOwned).toBe(true);
    expect(s.cosmetics.skin).toBe('shadow');
    expect(r.skin).toBe('shadow');
  });
  it('基金：置位 + 立即钻1000', () => {
    const s = defaultSave();
    applyIap(s, 'growthFund');
    expect(s.wallet.diamonds).toBe(1300);
  });
});

describe('grantMonthlyDaily', () => {
  it('跨日发放一次，同日幂等', () => {
    freezeDate();
    const s = defaultSave();
    applyIap(s, 'monthlyCard'); // 当日首份
    const d = s.wallet.diamonds, st = s.wallet.stamina;
    expect(grantMonthlyDaily(s)).toBe(0); // 同日幂等
    s.iap.monthlyLastClaim = '2026-10-02';
    expect(grantMonthlyDaily(s)).toBe(110);
    expect(s.wallet.diamonds).toBe(d + 60);
    expect(s.wallet.stamina).toBe(st + 50);
  });
  it('未购月卡返回 0', () => {
    expect(grantMonthlyDaily(defaultSave())).toBe(0);
  });
});

describe('grantFirstChargeHero', () => {
  it('SR 自选池 = zhugeliang/machao', () => {
    expect(srPool()).toEqual(['zhugeliang', 'machao']);
  });
  it('未拥有 → 解锁；已拥有 → 转碎片', () => {
    const s = defaultSave();
    expect(grantFirstChargeHero(s, 'machao')).toEqual({ heroId: 'machao', dup: false });
    expect(s.heroes.machao.owned).toBe(true);
    expect(grantFirstChargeHero(s, 'machao')).toEqual({ heroId: 'machao', dup: true, frags: 3 });
    expect(s.heroes.machao.frags).toBe(3);
  });
});

describe('fundChapterBonus', () => {
  it('未购基金为 0；已购每章首通 +100，去重且 10 章封顶', () => {
    const s = defaultSave();
    expect(fundChapterBonus(s, 1)).toBe(0);
    applyIap(s, 'growthFund');
    expect(fundChapterBonus(s, 1)).toBe(100);
    expect(fundChapterBonus(s, 1)).toBe(0); // 去重
    for (let c = 2; c <= 20; c++) fundChapterBonus(s, c);
    expect(s.iap.fundChapters).toHaveLength(FUND_CHAPTER_MAX);
  });
});
