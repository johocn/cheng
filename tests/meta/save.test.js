// tests/meta/save.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { defaultSave, loadSave, persistSave, touchDaily } from '../../src/meta/save.js';

describe('meta/save 存档层', () => {
  beforeEach(() => localStorage.clear());

  it('默认存档：赵云已拥有★1Lv1，钻石 300 金币 500，进度第 1 章', () => {
    const s = defaultSave();
    expect(s.v).toBe(1);
    expect(s.heroes.zhaoyun).toEqual({ owned: true, stars: 1, level: 1, frags: 0 });
    expect(s.heroes.guanyu.owned).toBe(false);
    expect(s.wallet).toEqual({ coins: 500, diamonds: 300, stamina: 60, staminaTs: 0 });
    expect(s.progress).toEqual({ chapter: 1, chapterClear: 0, waveBest: 0, endlessBest: 0, bossBest: 0, dailyPaid: '', bossPaid: '' }); // M7 征战四键
    expect(s.daily.freePulls).toBe(0);
  });

  it('persist 后 load 还原', () => {
    const s = defaultSave();
    s.wallet.coins = 1234;
    persistSave(s);
    expect(loadSave().wallet.coins).toBe(1234);
  });

  it('load 无存档/损坏时返回默认存档（不抛错）', () => {
    expect(loadSave()).toEqual(defaultSave());
    localStorage.setItem('qqc_save_v1', '{broken');
    expect(loadSave()).toEqual(defaultSave());
  });

  it('M7 设置开关：默认 settings 全开；旧档迁移补齐且保留已有值', () => {
    expect(defaultSave().settings).toEqual({ sound: true, bgm: true });
    localStorage.setItem('qqc_save_v1', JSON.stringify({
      v: 1,
      wallet: { coins: 1, diamonds: 1 },
      heroes: { zhaoyun: { owned: true } },
      progress: { chapter: 1, chapterClear: 0, waveBest: 0 }, // pre-M7 旧档形态（无征战四键）
      settings: { sound: false }, // 旧档只有部分键
    }));
    const s = loadSave();
    expect(s.settings).toEqual({ sound: false, bgm: true });
  });

  it('touchDaily：跨日重置免费抽计数', () => {
    const s = defaultSave();
    s.daily = { freePulls: 3, date: '2000-01-01' };
    touchDaily(s);
    expect(s.daily.freePulls).toBe(0);
    expect(s.daily.date).not.toBe('2000-01-01');
    const before = s.daily.date;
    touchDaily(s); // 同日不再重置
    expect(s.daily.date).toBe(before);
  });
});
