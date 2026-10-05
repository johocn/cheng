import { describe, it, expect } from 'vitest';
import { startWave, updateWave } from '../../src/engine/wave.js';
import { spawnEnemy } from '../../src/engine/enemy.js';
import { createRng } from '../../src/engine/rng.js';
import {
  WAVE_COMPS, TOTAL_WAVES, ENEMY_GROWTH, SPAWN_GAP_MIN, ENEMY_TYPES, AFFIXES, BOSS_WAVES,
} from '../../src/engine/config.js';

function makeState(wave = 1) {
  return {
    wave,
    stage: 'interval',
    stageClock: 0,
    spawnQueue: [],
    enemies: [],
    nextEnemyId: 1,
    rng: createRng(1),
  };
}

const compCount = (wi) => WAVE_COMPS[wi - 1].reduce((a, [, c]) => a + c, 0);

describe('startWave — WAVE_COMPS 生成', () => {
  it('构建刷怪队列并进入 wave 阶段（stageClock 归零）', () => {
    const s = makeState(1);
    startWave(s);
    expect(s.wave).toBe(1);
    expect(s.stage).toBe('wave');
    expect(s.stageClock).toBe(0);
    expect(s.spawnQueue).toHaveLength(compCount(1)); // w1: 8 bing
    expect(s.spawnQueue[0]).toEqual({ at: 0.5, type: 'bing', lane: 0, mul: 1, chMul: 1, hpMul: 1, affix: null }); // chMul：M3 章节系数默认 ×1；hpMul：M7 张辽开局压制因子（无 frontHpCut 恒 1）；affix：M6 词缀（权重 0 恒 null）
  });

  it('按组成表生成类型与数量，lane i%3 轮转', () => {
    const s = makeState(3); // w3: 8 bing + 2 gong
    startWave(s);
    expect(s.spawnQueue.filter((e) => e.type === 'bing')).toHaveLength(8);
    expect(s.spawnQueue.filter((e) => e.type === 'gong')).toHaveLength(2);
    expect(s.spawnQueue.map((e) => e.lane))
      .toEqual(Array.from({ length: 10 }, (_, i) => i % 3));
  });

  it('成长系数：第 N 波 mul = 1+(N-1)×ENEMY_GROWTH', () => {
    const s = makeState(15);
    startWave(s);
    const mul = 1 + 14 * ENEMY_GROWTH;
    expect(s.spawnQueue[0].mul).toBeCloseTo(mul, 5);
    expect(s.spawnQueue.every((e) => e.mul === mul)).toBe(true);
  });

  it('刷怪间隔 = max(SPAWN_GAP_MIN, 6/count)，首事件 0.5s', () => {
    const s = makeState(1); // 8 只 → gap = max(0.9, 0.75) = 0.9
    startWave(s);
    expect(s.spawnQueue[0].at).toBe(0.5);
    expect(s.spawnQueue[1].at - s.spawnQueue[0].at).toBeCloseTo(SPAWN_GAP_MIN, 5);
    const s2 = makeState(15); // 末组 4 shuai → gap = 6/4 = 1.5
    startWave(s2);
    const tail = s2.spawnQueue.slice(-4);
    expect(tail[1].at - tail[0].at).toBeCloseTo(1.5, 5);
  });
});

describe('updateWave — wave 阶段', () => {
  it('到点刷怪：at≤stageClock 的事件入战场并出队（mul 传给 spawnEnemy）', () => {
    const s = makeState(2);
    startWave(s);
    updateWave(s, 0.6); // 首事件 0.5 已到
    expect(s.enemies).toHaveLength(1);
    expect(s.spawnQueue).toHaveLength(compCount(2) - 1);
    const mul = 1 + ENEMY_GROWTH;
    expect(s.enemies[0].hpMax).toBeCloseTo(ENEMY_TYPES.bing.hp * mul, 5);
  });

  it('未到点不刷怪', () => {
    const s = makeState(1);
    startWave(s);
    updateWave(s, 0.1);
    expect(s.enemies).toHaveLength(0);
  });

  it('队列空且场清：非终波进入 skillPick（不再回 interval）', () => {
    const s = makeState(1);
    startWave(s);
    s.spawnQueue = [];
    s.enemies = [];
    updateWave(s, 0.1);
    expect(s.stage).toBe('skillPick');
  });

  it('队列空且场清：终波（第15波）直接 victory', () => {
    const s = makeState(TOTAL_WAVES);
    startWave(s);
    s.spawnQueue = [];
    s.enemies = [];
    updateWave(s, 0.1);
    expect(s.stage).toBe('victory');
  });

  it('victory/over 阶段冻结不推进', () => {
    const s = makeState(1);
    s.stage = 'victory';
    s.stageClock = 5;
    updateWave(s, 10);
    expect(s.stage).toBe('victory');
    const s2 = makeState(1);
    s2.stage = 'over';
    updateWave(s2, 10);
    expect(s2.stage).toBe('over');
  });
});

describe('M6 精英词缀', () => {
  it('词缀表定义', () => {
    expect(AFFIXES.iron).toMatchObject({ label: '壁', hpMul: 1.6 });
    expect(AFFIXES.swift).toMatchObject({ label: '行', speedMul: 1.4 });
    expect(AFFIXES.sharp).toMatchObject({ label: '锋', dmgBonus: 2 });
  });

  it('BOSS 波刷怪必带词缀；章节权重 0 的非 BOSS 波必不带（?? 0 缺省对照）', () => {
    const s = makeState(BOSS_WAVES[0]); // 第 10 波
    s.chapterPackRate = 0;
    startWave(s);
    while (s.spawnQueue.length) {
      const ev = s.spawnQueue.shift();
      spawnEnemy(s, ev.type, ev.lane, ev.mul, ev.chMul, ev.affix);
    }
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.enemies.every((e) => e.affix)).toBe(true); // BOSS 波全部带词缀
    // 对照样例：非 BOSS 波未注入 chapterPackRate（缺省 ?? 0）→ 全部无词缀
    const s2 = makeState(1);
    startWave(s2);
    expect(s2.spawnQueue.every((ev) => !ev.affix)).toBe(true);
  });

  it('词缀乘区落进敌人属性', () => {
    const s = makeState(1);
    spawnEnemy(s, 'bing', 0, 1, 1, 'iron');
    expect(s.enemies[0].hp).toBeCloseTo(ENEMY_TYPES.bing.hp * 1.6, 5);
    expect(s.enemies[0].hpMax).toBeCloseTo(ENEMY_TYPES.bing.hp * 1.6, 5);
    spawnEnemy(s, 'bing', 1, 1, 1, 'swift');
    expect(s.enemies[1].speedMul).toBeCloseTo(1.4, 5);
    spawnEnemy(s, 'bing', 2, 1, 1, 'sharp');
    expect(s.enemies[2].dmgBonus).toBe(2);
  });
});
