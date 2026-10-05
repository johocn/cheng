// tests/m7-achievements.test.js — M7 功勋 18 项
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, achvProgress, achvClaimable, claimAchv, anyAchvClaimable } from '../src/meta/achievements.js';
import { defaultSave } from '../src/meta/save.js';

describe('M7 功勋', () => {
  it('成就表 18 项、id 唯一、奖励全为钻石', () => {
    expect(ACHIEVEMENTS).toHaveLength(18);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(18);
    ACHIEVEMENTS.forEach((a) => expect(a.reward.diamonds).toBeGreaterThan(0));
  });
  it('进度：击杀/通关/收集/星级/终局/财富派生自 save', () => {
    const s = defaultSave();
    s.stats.kills = 1000; s.stats.wins = 10;
    s.heroes.zhaoyun.owned = true; s.heroes.zhouyu.owned = true;
    s.heroes.zhaoyun.stars = 3;
    s.progress.endlessBest = 20; s.stats.dailyWins = 3;
    s.progress.bossBest = 5; s.stats.coinsEarned = 50000;
    const cur = (id) => achvProgress(s, ACHIEVEMENTS.find((a) => a.id === id));
    expect(cur('k1')).toBe(1000);
    expect(cur('w1')).toBe(10);
    expect(cur('c1')).toBe(2);
    expect(cur('s1')).toBe(3);
    expect(cur('e1')).toBe(20);
    expect(cur('d1')).toBe(3);
    expect(cur('b1')).toBe(5);
    expect(cur('f1')).toBe(50000);
  });
  it('可领与领取：达标未领可领；领取入钱包防重复', () => {
    const s = defaultSave();
    s.stats.kills = 1000;
    const a = ACHIEVEMENTS.find((x) => x.id === 'k1');
    expect(achvClaimable(s, a)).toBe(true);
    const d0 = s.wallet.diamonds;
    expect(claimAchv(s, a)).toBe(true);
    expect(s.wallet.diamonds).toBe(d0 + 30);
    expect(claimAchv(s, a)).toBe(false); // 防重复
    expect(achvClaimable(s, a)).toBe(false);
  });
  it('红点：任一可领为 true', () => {
    const s = defaultSave();
    s.stats.wins = 10; // 达成 w1「百战功成·十」（计划原稿 wins=1 与 goal=10 矛盾，此处修正）
    expect(anyAchvClaimable(s)).toBe(true);
  });
});
