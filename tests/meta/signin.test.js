// tests/meta/signin.test.js — 签到奖励表/领取/跨日 + 存档 M5 字段迁移
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SIGNIN_REWARDS, signinIndex, signinClaimable, claimSignin } from '../../src/meta/signin.js';
import { defaultSave, loadSave, touchDaily } from '../../src/meta/save.js';
import { createRng } from '../../src/engine/rng.js';

afterEach(() => { vi.unstubAllGlobals(); });

const DATE = '2026-10-03';
function freezeDate() {
  vi.stubGlobal('Date', class extends Date {
    static now() { return Date.parse('2026-10-03T12:00:00Z'); }
    toISOString() { return '2026-10-03T12:00:00.000Z'; }
  });
}

describe('奖励表', () => {
  it('7 格递进（D7 含 200 钻+60 体力）', () => {
    expect(SIGNIN_REWARDS).toHaveLength(7);
    expect(SIGNIN_REWARDS[6]).toEqual({ diamonds: 200, stamina: 60, frags: 0 });
    expect(SIGNIN_REWARDS[5].frags).toBe(5);
  });
});

describe('claimSignin', () => {
  it('领取入账并推进计数（跨日可再领）', () => {
    freezeDate();
    const s = defaultSave();
    const r1 = claimSignin(s, createRng(7));
    expect(r1).toEqual({ diamonds: 0, stamina: 20, frags: 0, fragHero: null });
    expect(s.daily.signinCount).toBe(1);
    expect(s.daily.signinClaimedDate).toBe(DATE);
    expect(s.wallet.stamina).toBe(80); // 60 + 20，可超上限
    expect(signinClaimable(s)).toBe(false);
    expect(claimSignin(s, createRng(7))).toBeNull(); // 当日幂等
  });
  it('轮循环：7 次后回到 D1', () => {
    freezeDate();
    const s = defaultSave();
    for (let i = 0; i < 8; i++) {
      expect(signinIndex(s)).toBe(i % 7);
      s.daily.signinClaimedDate = null; // 模拟跨日
      claimSignin(s, createRng(7 + i));
    }
  });
  it('D6 发 5 碎片给已拥有英雄', () => {
    freezeDate();
    const s = defaultSave();
    s.daily.signinCount = 5;
    const before = s.heroes.zhaoyun.frags;
    const r = claimSignin(s, createRng(9));
    expect(r.frags).toBe(5);
    expect(r.fragHero).toBe('zhaoyun'); // 初始仅赵云拥有
    expect(s.heroes.zhaoyun.frags).toBe(before + 5);
  });
});

describe('存档 M5 字段迁移', () => {
  it('defaultSave 含 staminaTs/iap/cosmetics/daily.signin', () => {
    const s = defaultSave();
    expect(s.wallet.stamina).toBe(60);
    expect(s.wallet).toHaveProperty('staminaTs');
    expect(s.iap).toEqual({ firstCharge: false, monthly: false, monthlyLastClaim: '', pass: false, fund: false, fundChapters: [] });
    expect(s.cosmetics).toEqual({ skin: 'ink', shadowOwned: false });
    expect(s.daily.signinCount).toBe(0);
    expect(s.daily.signinClaimedDate).toBeNull();
  });
  it('旧档 loadSave 补齐缺失字段；touchDaily 跨日保留签到累计', () => {
    freezeDate();
    const old = { v: 1, wallet: { coins: 1, diamonds: 2 }, heroes: defaultSave().heroes, progress: defaultSave().progress, daily: { freePulls: 0, date: '2026-10-01', signinCount: 4 } };
    localStorage.setItem('qqc_save_v1', JSON.stringify(old));
    const s = loadSave();
    expect(s.wallet.stamina).toBe(60);
    expect(s.iap.fundChapters).toEqual([]);
    expect(s.cosmetics.skin).toBe('ink');
    expect(s.daily.signinCount).toBe(4);
    touchDaily(s); // 同日（date 已是今天）不动
    s.daily.date = '2026-10-02';
    touchDaily(s); // 跨日：保留 signinCount，清当日领取
    expect(s.daily.signinCount).toBe(4);
    expect(s.daily.signinClaimedDate).toBeNull();
    expect(s.daily.freePulls).toBe(0);
  });
});
