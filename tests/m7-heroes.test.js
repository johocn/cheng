// tests/m7-heroes.test.js — M7 扩池：周瑜/张辽 + 双被动 + 8 人羁绊
import { describe, it, expect } from 'vitest';
import { HEROES, GACHA_POOL, BOND_HEROES, BOND_HEROES_ALL } from '../src/meta/heroes.js';
import { defaultSave, loadSave } from '../src/meta/save.js';
import { atkMul, bondActive, bondAllActive } from '../src/meta/meta.js';
import { createBattle } from '../src/engine/state.js';
import { spawnEnemy } from '../src/engine/enemy.js';
import { startWave } from '../src/engine/wave.js';

describe('M7 扩池', () => {
  it('HEROES 含周瑜/张辽 SSR，GACHA_POOL 8 人', () => {
    expect(HEROES.zhouyu.quality).toBe('SSR');
    expect(HEROES.zhangliao.quality).toBe('SSR');
    expect(GACHA_POOL).toHaveLength(8);
    expect(GACHA_POOL).toContain('zhouyu');
    expect(GACHA_POOL).toContain('zhangliao');
  });

  it('defaultSave 补两英雄键；旧档 loadSave 迁移补齐', () => {
    const d = defaultSave();
    expect(d.heroes.zhouyu).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
    expect(d.heroes.zhangliao).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
    // 旧档模拟：无两键
    globalThis.localStorage = {
      getItem: () => JSON.stringify({ ...d, heroes: { zhaoyun: d.heroes.zhaoyun } }),
      setItem: () => {},
    };
    const s = loadSave();
    expect(s.heroes.zhouyu).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
    expect(s.heroes.zhangliao).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
  });

  it('羁绊：6 人全家福 +15%；8 人汉室云集 +25% 取大', () => {
    const s = defaultSave();
    BOND_HEROES.forEach((id) => { s.heroes[id].owned = true; });   // 仅 6 人
    expect(bondActive(s)).toBe(true);
    expect(bondAllActive(s)).toBe(false);
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.15);
    BOND_HEROES_ALL.forEach((id) => { s.heroes[id].owned = true; }); // 8 人全
    expect(bondAllActive(s)).toBe(true);
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.25); // 取大不叠加
  });

  it('周瑜被动：burnBonus 经 createBattle 注入 spawnEnemy 的 burnMul', () => {
    const st = createBattle(1, { bonus: { burnBonus: 0.6, frontHpCut: 0 } });
    spawnEnemy(st, 'bing', 0, 1, 1, null);
    expect(st.enemies[0].burnMul).toBeCloseTo(1.6);
    const st0 = createBattle(1, {});
    spawnEnemy(st0, 'bing', 0, 1, 1, null);
    expect(st0.enemies[0].burnMul ?? 1).toBe(1);
  });

  it('张辽被动：前 3 波敌 hp ×(1-frontHpCut)，第 4 波起还原', () => {
    const st = createBattle(1, { bonus: { burnBonus: 0, frontHpCut: 0.24 } });
    st.wave = 2; startWave(st);   // 前 3 波
    expect(st.spawnQueue[0].hpMul).toBeCloseTo(0.76);
    st.wave = 4; startWave(st);
    expect(st.spawnQueue[0].hpMul).toBe(1);
  });

  it('HOME_LAYOUT 9 格：step 74 / r 32 / x0 27', async () => {
    const L = (await import('../src/render/home.js')).HOME_LAYOUT;
    expect(L.heroStep).toBe(74);
    expect(L.heroR).toBe(32);
    expect(L.heroX0).toBe(27);
  });
});
