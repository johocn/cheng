// tests/meta/reward.test.js
import { describe, it, expect } from 'vitest';
import { defaultSave } from '../../src/meta/save.js';
import { resultRewards, applyRewards, applyGacha, chapterHeroReward } from '../../src/meta/reward.js';

describe('meta/reward 结算奖励', () => {
  it('首通第 1 章：金币 1050 钻 40，章节英雄未拥有 → 解锁', () => {
    const r = resultRewards(1, true, defaultSave());
    expect(r.coins).toBe(1050); // 800+250
    expect(r.diamonds).toBe(40); // 30+10
    expect(r.unlockHero).toBe('guanyu'); // CH_HERO[0]=zhaoyun 已拥有 → 顺延首未拥有
    expect(r.frags).toBe(0);
  });

  it('首通英雄已拥有 → 转碎片（关羽 SSR×5）', () => {
    const s = defaultSave();
    s.heroes.guanyu.owned = true;
    const r = resultRewards(1, true, s);
    expect(r.unlockHero).toBe(null);
    expect(r.frags).toEqual({ guanyu: 5 });
  });

  it('重复通关：仅金币 650，不推进进度', () => {
    const r = resultRewards(1, false, defaultSave());
    expect(r.coins).toBe(650); // 500+150
    expect(r.diamonds).toBe(0);
    expect(r.unlockHero).toBe(null);
    expect(r.frags).toEqual({});
  });

  it('applyRewards：入账 + 首通推进 chapterClear/chapter + 解锁英雄', () => {
    const s = defaultSave();
    const r = resultRewards(1, true, s);
    applyRewards(s, r);
    expect(s.wallet.coins).toBe(500 + 1050);
    expect(s.wallet.diamonds).toBe(300 + 40);
    expect(s.heroes.guanyu.owned).toBe(true);
    expect(s.progress.chapterClear).toBe(1);
    expect(s.progress.chapter).toBe(2);
  });

  it('chapterHeroReward：按 CH_HERO 轮转，已拥有→碎片', () => {
    const s = defaultSave();
    expect(chapterHeroReward(2, s)).toEqual({ unlockHero: 'zhangfei', frags: {} });
    s.heroes.zhangfei.owned = true;
    expect(chapterHeroReward(2, s)).toEqual({ unlockHero: null, frags: { zhangfei: 5 } });
  });
});

describe('meta/reward 抽卡入账', () => {
  it('applyGacha：新英雄解锁★1 / 重复转碎片入账', () => {
    const s = defaultSave();
    applyGacha(s, { heroId: 'guanyu', dup: false, frags: 0 });
    expect(s.heroes.guanyu.owned).toBe(true);
    applyGacha(s, { heroId: 'guanyu', dup: true, frags: 5 });
    expect(s.heroes.guanyu.frags).toBe(5);
  });

  it('applyGacha 多结果数组一次性入账', () => {
    const s = defaultSave();
    applyGacha(s, [
      { heroId: 'guanyu', dup: false, frags: 0 },
      { heroId: 'guanyu', dup: true, frags: 5 },
      { heroId: 'huangzhong', dup: true, frags: 1 },
    ]);
    expect(s.heroes.guanyu.owned).toBe(true);
    expect(s.heroes.guanyu.frags).toBe(5);
    expect(s.heroes.huangzhong.frags).toBe(1);
  });
});
