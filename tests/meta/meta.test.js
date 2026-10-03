// tests/meta/meta.test.js
import { describe, it, expect } from 'vitest';
import { defaultSave } from '../../src/meta/save.js';
import {
  accountLevel, levelCap, levelUpCost, levelUp,
  fragNeeded, starUp, bondActive, atkMul,
} from '../../src/meta/meta.js';

describe('meta/meta 养成计算', () => {
  it('账号等级 = 1 + 已通关章节数；英雄等级封顶 = 账号等级 ×5', () => {
    const s = defaultSave();
    expect(accountLevel(s)).toBe(1);
    expect(levelCap(s)).toBe(5);
    s.progress.chapterClear = 2;
    expect(accountLevel(s)).toBe(3);
    expect(levelCap(s)).toBe(15);
  });

  it('升级费用 = 160×当前等级；扣金币并 +1 级；到封顶拒绝', () => {
    const s = defaultSave(); // Lv1 封顶 5
    expect(levelUpCost(s.heroes.zhaoyun)).toBe(160);
    s.wallet.coins = 1000;
    expect(levelUp(s, 'zhaoyun')).toBe(true);
    expect(s.heroes.zhaoyun.level).toBe(2);
    expect(s.wallet.coins).toBe(840);
    s.heroes.zhaoyun.level = 5;
    expect(levelUp(s, 'zhaoyun')).toBe(false); // 封顶
    expect(levelUp(s, 'guanyu')).toBe(false);  // 未拥有
  });

  it('金币不足拒绝升级且不改状态', () => {
    const s = defaultSave();
    s.wallet.coins = 100;
    expect(levelUp(s, 'zhaoyun')).toBe(false);
    expect(s.heroes.zhaoyun.level).toBe(1);
    expect(s.wallet.coins).toBe(100);
  });

  it('升星：3 碎片/星，★5 封顶；碎片不足拒绝', () => {
    const s = defaultSave();
    s.heroes.zhaoyun.frags = 3;
    expect(fragNeeded(s.heroes.zhaoyun)).toBe(3);
    expect(starUp(s, 'zhaoyun')).toBe(true);
    expect(s.heroes.zhaoyun.stars).toBe(2);
    expect(s.heroes.zhaoyun.frags).toBe(0);
    s.heroes.zhaoyun.stars = 5;
    expect(starUp(s, 'zhaoyun')).toBe(false); // ★5 封顶
  });

  it('羁绊：蜀国 6 命全拥有才激活', () => {
    const s = defaultSave();
    expect(bondActive(s)).toBe(false);
    for (const id of ['guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong']) {
      s.heroes[id].owned = true;
    }
    expect(bondActive(s)).toBe(true);
  });

  it('攻击加成乘区 = 等级×星级×羁绊；Lv1★1 无羁绊 = ×1.0（零回归基线）', () => {
    const s = defaultSave();
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.0);
    s.heroes.zhaoyun.level = 15; // 1+0.06×14 = 1.84
    s.heroes.zhaoyun.stars = 3;  // 1+0.2×2 = 1.4
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.84 * 1.4);
    for (const id of ['guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong']) {
      s.heroes[id].owned = true;
    }
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.84 * 1.4 * 1.15);
    expect(atkMul(s, 'lvbu')).toBe(1); // 未拥有不参与
  });
});
