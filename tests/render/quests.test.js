// tests/render/quests.test.js — 军务面板布局常量与命中检测（纯数据，无 canvas，手法同 screens.test.js）
import { describe, test, expect } from 'vitest';
import { drawQuests, hitQuests, QUESTS_LAYOUT } from '../../src/render/quests.js';

describe('M6 军务面板', () => {
  test('QUESTS_LAYOUT 布局导出与 drawQuests 可用', () => {
    expect(typeof drawQuests).toBe('function');
    expect(QUESTS_LAYOUT.backBtn).toEqual({ x: 20, y: 110, w: 110, h: 64 });
    expect(QUESTS_LAYOUT.tabs).toEqual({ x0: 20, y: 190, w: 213, h: 64, gap: 10 });
    expect(QUESTS_LAYOUT.rows).toEqual({ x: 20, y: 280, w: 680, h: 120, step: 132 });
    expect(QUESTS_LAYOUT.track).toEqual({ x: 20, y: 480, cardW: 120, cardH: 170, step: 130 });
  });

  test('hitQuests: 返回/切tab 命中', () => {
    expect(hitQuests(75, 142, 'daily').action).toBe('back');
    expect(hitQuests(126, 222, 'daily').action).toBe('tab');      // 每日 tab
    expect(hitQuests(556, 222, 'daily').action).toBe('tab');      // 战令 tab
  });

  test('hitQuests 领取按钮落在任务行右端', () => {
    const L = QUESTS_LAYOUT;
    const hit = hitQuests(L.rows.x + L.rows.w - 60, L.rows.y + 80, 'daily', [{ id: 'd_win', claimable: true }]);
    expect(hit.action).toBe('claim');
    expect(hit.taskId).toBe('d_win');
  });

  test('hitQuests 战令轨：锚点窗口内免费/付费领取命中，未购战令付费轨不命中', () => {
    const T = QUESTS_LAYOUT.track;
    const levels = [2, 3, 4, 5, 6].map((lv) => ({ lv, freeClaimed: false, paidClaimed: false }));
    const pd = { level: 3, exp: 350, paid: true, levels };       // 窗口 Lv2..Lv6，锚点 Lv3
    expect(hitQuests(T.x + 60, T.y + 115, 'pass', [], pd))
      .toEqual({ action: 'passClaim', track: 'free', level: 2 });
    expect(hitQuests(T.x + 60, T.y + 150, 'pass', [], pd))
      .toEqual({ action: 'passClaim', track: 'paid', level: 2 });
    expect(hitQuests(T.x + 60, T.y + 150, 'pass', [], { ...pd, paid: false })).toBeNull();
  });
});
