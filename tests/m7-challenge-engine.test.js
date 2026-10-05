// tests/m7-challenge-engine.test.js — M7 三模式 engine 核心
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../src/engine/state.js';
import { startWave, updateWave } from '../src/engine/wave.js';
import { TOTAL_WAVES } from '../src/engine/config.js';
import { modeUnlocked, dailyAffixOf, weeklyAffix } from '../src/meta/challenge.js';

function defaultSaveLike() {
  return { progress: { chapter: 3, chapterClear: 4, waveBest: 0 } };
}

describe('M7 解锁与词缀', () => {
  const s = defaultSaveLike();
  it('阶梯解锁：daily≥1章 / endless≥2章 / bossrush≥4章', () => {
    expect(modeUnlocked(s, 'daily')).toBe(true);
    expect(modeUnlocked(s, 'endless')).toBe(true);
    expect(modeUnlocked(s, 'bossrush')).toBe(true);
    const s1 = { progress: { chapterClear: 1 } };
    expect(modeUnlocked(s1, 'daily')).toBe(true);
    expect(modeUnlocked(s1, 'endless')).toBe(false);
    expect(modeUnlocked(s1, 'bossrush')).toBe(false);
    const s0 = { progress: { chapterClear: 0 } };
    expect(modeUnlocked(s0, 'daily')).toBe(false);
  });
  it('dailyAffixOf 同日期确定性且在词缀池内', () => {
    expect(dailyAffixOf('2026-10-05')).toBe(dailyAffixOf('2026-10-05'));
    expect(dailyAffixOf('2026-10-06')).toBe(dailyAffixOf('2026-10-06'));
    expect(['iron', 'swift', 'sharp']).toContain(dailyAffixOf('2026-10-05'));
  });
  it('weeklyAffix 在词缀池内且同周稳定', () => {
    expect(['iron', 'swift', 'sharp']).toContain(weeklyAffix());
    expect(weeklyAffix()).toBe(weeklyAffix());
  });
});

describe('M7 无尽模式', () => {
  it('16 波起程序化生成：count 增长 + hp ×1.08^(wave-15) + 永不 victory', () => {
    const st = createBattle(1, { mode: 'endless', chapterMul: 1 });
    st.wave = 16; startWave(st);
    // w1 基表 8 兵 → 第 2 轮次 lap=1 → count ×1.3 = 10.4 → 11
    expect(st.spawnQueue.length).toBe(11);
    // T1 已定口径：chMul 承载全部 hp 系数（chapterMul × endless 1.08^over）；hpMul 专供张辽减益
    expect(st.spawnQueue[0].chMul).toBeCloseTo(Math.pow(1.08, 1));
    st.spawnQueue = [];
    updateWave(st, 0.1); // 清空 → skillPick 而非 victory
    expect(st.stage).toBe('skillPick');
  });
  it('每清 5 波发金币（wave×10）', () => {
    const st = createBattle(1, { mode: 'endless' });
    st.wave = 5; st.coins = 0; st.spawnQueue = [];
    st.stage = 'wave'; // updateWave 仅推进 wave 阶段（引擎约定），测试直呼需显式置位
    updateWave(st, 0.1);
    expect(st.coins).toBe(50);
  });
  it('advanceFrame 终态仅 over（chapter 不回归）', () => {
    const st = createBattle(1, { mode: 'endless' });
    st.stage = 'victory'; // 无尽不可能到达，但防御：终态冻结仍生效
    expect(advanceFrame(st, null, 16)).toBe(st);
  });
});

describe('M7 每日挑战', () => {
  it('daily：全员自带当日词缀（含 BOSS 波）', () => {
    const st = createBattle(12345, { mode: 'daily', dailyAffix: 'swift' });
    st.wave = 10; startWave(st); // BOSS 波
    expect(st.spawnQueue.every((e) => e.affix === 'swift')).toBe(true);
  });
  it('daily 同种子同波次确定性', () => {
    const a = createBattle(20261005, { mode: 'daily', dailyAffix: 'iron' });
    const b = createBattle(20261005, { mode: 'daily', dailyAffix: 'iron' });
    a.wave = 3; b.wave = 3; startWave(a); startWave(b);
    expect(JSON.stringify(a.spawnQueue)).toBe(JSON.stringify(b.spawnQueue));
  });
  it('daily 15 波清完仍 victory（可领奖）', () => {
    const st = createBattle(1, { mode: 'daily' });
    st.wave = TOTAL_WAVES; st.spawnQueue = [];
    st.stage = 'wave'; // 同上：updateWave 需 wave 阶段
    updateWave(st, 0.1);
    expect(st.stage).toBe('victory');
  });
});

describe('M7 车轮战', () => {
  it('bossrush：每轮 2 帅带随机词缀，hp ×(1+0.25(r-1))×chapterMul', () => {
    const st = createBattle(1, { mode: 'bossrush', chapterMul: 2 });
    st.wave = 1; startWave(st);
    expect(st.bossRound).toBe(1);
    expect(st.spawnQueue).toHaveLength(2);
    expect(st.spawnQueue.every((e) => e.type === 'shuai')).toBe(true);
    expect(st.spawnQueue[0].chMul).toBeCloseTo(2);        // r=1 → ×1
    expect(st.spawnQueue.every((e) => e.affix)).toBe(true);
    st.wave = 3; startWave(st);                            // r=3 → ×1.5
    expect(st.spawnQueue[0].chMul).toBeCloseTo(3);
  });
  it('bossrush 清波进 skillPick（轮间歇）而非 victory', () => {
    const st = createBattle(1, { mode: 'bossrush' });
    st.wave = 1; st.spawnQueue = []; st.enemies = [];
    st.stage = 'wave'; // 同上：updateWave 需 wave 阶段
    updateWave(st, 0.1);
    expect(st.stage).toBe('skillPick');
  });
  it('bossrush 超过 15 轮清波仍进 skillPick，永不 victory', () => {
    const st = createBattle(1, { mode: 'bossrush' });
    st.wave = 16; st.spawnQueue = []; st.enemies = [];
    st.stage = 'wave';
    updateWave(st, 0.1);
    expect(st.stage).toBe('skillPick'); // 否则 wave≥TOTAL_WAVES 会误判 victory
  });
});
