// tests/m7-challenge-ui.test.js — M7 征战屏：布局/命中 + 结算模式化 + 存档征战字段
import { describe, it, expect, beforeEach } from 'vitest';
import { CHALLENGE_LAYOUT, hitChallenge } from '../src/render/challenge.js';
import { HOME_LAYOUT, hitHome } from '../src/render/home.js';
import { hitResult } from '../src/render/result.js';
import { defaultSave, loadSave } from '../src/meta/save.js';

const save = {
  wallet: {}, heroes: {}, progress: { chapter: 3, chapterClear: 4, endlessBest: 32, bossBest: 7, dailyPaid: '', bossPaid: '' },
};

describe('M7 征战存档字段（progress 四键 + 旧档迁移）', () => {
  beforeEach(() => localStorage.clear());
  it('defaultSave progress 增四键：endlessBest/bossBest/dailyPaid/bossPaid', () => {
    const p = defaultSave().progress;
    expect(p.endlessBest).toBe(0);
    expect(p.bossBest).toBe(0);
    expect(p.dailyPaid).toBe('');
    expect(p.bossPaid).toBe('');
  });
  it('旧档 loadSave 迁移补齐，既有 chapter/waveBest 保留', () => {
    localStorage.setItem('qqc_save_v1', JSON.stringify({
      v: 1,
      wallet: { coins: 1, diamonds: 1, stamina: 60, staminaTs: 0 },
      heroes: { zhaoyun: { owned: true, stars: 1, level: 1, frags: 0 } },
      progress: { chapter: 2, chapterClear: 1, waveBest: 15 },
    }));
    const s = loadSave();
    expect(s.progress.chapter).toBe(2);
    expect(s.progress.chapterClear).toBe(1);
    expect(s.progress.waveBest).toBe(15);
    expect(s.progress.endlessBest).toBe(0);
    expect(s.progress.bossBest).toBe(0);
    expect(s.progress.dailyPaid).toBe('');
    expect(s.progress.bossPaid).toBe('');
  });
});

describe('M7 征战屏', () => {
  it('三模式卡布局常量齐备', () => {
    expect(CHALLENGE_LAYOUT.cards).toHaveLength(3);
    expect(CHALLENGE_LAYOUT.back).toBeTruthy();
  });
  it('命中：点 daily 卡返回挑战 action；返回键 back', () => {
    const c = CHALLENGE_LAYOUT.cards[0]; // daily
    expect(hitChallenge(c.x + 10, c.y + 10, save)).toEqual({ action: 'mode', mode: 'daily' });
    expect(hitChallenge(CHALLENGE_LAYOUT.back.x + 5, CHALLENGE_LAYOUT.back.y + 5, save)).toEqual({ action: 'back' });
  });
  it('主城征战卡与功能行四格命中', () => {
    expect(hitHome(HOME_LAYOUT.challengeCard.x + 10, HOME_LAYOUT.challengeCard.y + 10, save)).toEqual({ action: 'challenge' });
    const t = HOME_LAYOUT.toolRow;
    expect(hitHome(t.x + 10, t.y + 10, save)).toEqual({ action: 'achv' });
    expect(hitHome(t.x + t.cell + 10, t.y + 10, save)).toEqual({ action: 'share' });
    expect(hitHome(t.x + t.cell * 2 + 10, t.y + 10, save)).toEqual({ action: 'notices' });
    expect(hitHome(t.x + t.cell * 3 + 10, t.y + 10, save)).toEqual({ action: 'sound' });
  });
  it('result modeText 不影响既有命中', () => {
    const data = { win: true, chapterN: 2, doubled: false, modeText: '无尽模式 · 32 波' };
    expect(hitResult(100, 1160, data)).toEqual({ action: 'again' });
  });
});
