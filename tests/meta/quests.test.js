import { describe, test, expect } from 'vitest';
import {
  DAILY_QUESTS, WEEKLY_QUESTS, PASS_LEVEL_EXP, PASS_MAX_LEVEL,
  questsOf, reportQuest, claimQuest, passLevel, passExp, weekIdOf, seasonIdOf,
  touchQuests, claimPass, questClaimable, anyClaimable,
} from '../../src/meta/quests.js';
import { defaultSave } from '../../src/meta/save.js';

describe('M6 任务定义', () => {
  test('每日 6 条 / 每周 4 条 / 战令常量', () => {
    expect(DAILY_QUESTS).toHaveLength(6);
    expect(WEEKLY_QUESTS).toHaveLength(4);
    expect(PASS_LEVEL_EXP).toBe(100);
    expect(PASS_MAX_LEVEL).toBe(30);
    expect(DAILY_QUESTS.find((q) => q.id === 'd_win').goal).toBe(1);
    expect(WEEKLY_QUESTS.find((q) => q.id === 'w_boss').event).toBe('boss_kill');
  });
});

describe('M6 进度上报', () => {
  test('reportQuest 累计进度并直达上限截断', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    reportQuest(s, 'merge', 3);
    reportQuest(s, 'merge', 4);
    expect(questsOf(s).daily.progress.merge).toBe(5);   // 上限=goal 截断
    reportQuest(s, 'battle_win', 1);
    expect(questsOf(s).daily.progress.battle_win).toBe(1);
  });

  test('battle_win 同入周任务进度', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    reportQuest(s, 'battle_win', 2);
    expect(questsOf(s).weekly.progress.battle_win).toBe(2);
  });

  test('跨日重置每日进度，跨周重置每周进度', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });  // 周一
    reportQuest(s, 'merge', 5);
    touchQuests(s, { now: new Date('2026-10-06T10:00:00') });  // 周二：日重置周保留
    expect(questsOf(s).daily.progress.merge ?? 0).toBe(0);
    expect(questsOf(s).weekly.progress.merge).toBe(5);
    touchQuests(s, { now: new Date('2026-10-12T10:00:00') });  // 下周一：周重置
    expect(questsOf(s).weekly.progress.merge ?? 0).toBe(0);
  });
});

describe('M6 领取与战令', () => {
  test('claimQuest 落账奖励+战令exp，重复领拒', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    reportQuest(s, 'battle_win', 1);
    const dia0 = s.wallet.diamonds;
    const r = claimQuest(s, 'daily', 'd_win');
    expect(r.ok).toBe(true);
    expect(s.wallet.diamonds).toBe(dia0 + 30);
    expect(passExp(s)).toBe(20);                      // 每日领奖 +20 exp
    expect(claimQuest(s, 'daily', 'd_win').ok).toBe(false);
  });

  test('未达目标不可领', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    expect(claimQuest(s, 'weekly', 'w_win').ok).toBe(false);
  });

  test('passLevel 派生与满级封顶', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    s.quests.pass.exp = 250;
    expect(passLevel(s)).toBe(2);                     // floor(250/100)
    s.quests.pass.exp = 99999;
    expect(passLevel(s)).toBe(PASS_MAX_LEVEL);
  });

  test('claimPass 免费/付费轨——付费资格校验', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    s.quests.pass.exp = 350;                          // Lv3
    const dia0 = s.wallet.diamonds;
    expect(claimPass(s, 'free', 3).ok).toBe(true);
    expect(s.wallet.diamonds).toBeGreaterThan(dia0);
    expect(claimPass(s, 'free', 3).ok).toBe(false);   // 已领
    expect(claimPass(s, 'paid', 3).ok).toBe(false);   // 未购战令
    s.iap.pass = true;
    expect(claimPass(s, 'paid', 3).ok).toBe(true);
    expect(claimPass(s, 'paid', 4).ok).toBe(false);   // 未达级
  });

  test('赛季切换重置战令', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    s.quests.pass.exp = 500;
    touchQuests(s, { now: new Date('2026-11-01T10:00:00') });
    expect(s.quests.pass.exp).toBe(0);
    expect(questsOf(s).pass.claimedFree).toHaveLength(0);
  });

  test('anyClaimable 红点口径', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    expect(anyClaimable(s)).toBe(false);
    reportQuest(s, 'battle_win', 1);
    expect(anyClaimable(s)).toBe(true);
  });
});

describe('M6 weekId/seasonId', () => {
  test('周一锚点与月份串', () => {
    expect(weekIdOf(new Date('2026-10-05T10:00:00'))).toBe('2026-10-05'); // 周一
    expect(weekIdOf(new Date('2026-10-07T10:00:00'))).toBe('2026-10-05'); // 周三归周一
    expect(seasonIdOf(new Date('2026-10-05T10:00:00'))).toBe('2026-10');
  });
});
