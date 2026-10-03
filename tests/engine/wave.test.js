import { describe, it, expect } from 'vitest';
import { startWave, updateWave } from '../../src/engine/wave.js';
import {
  WAVE_COMPS, TOTAL_WAVES, ENEMY_GROWTH, SPAWN_GAP_MIN, ENEMY_TYPES,
} from '../../src/engine/config.js';

function makeState(wave = 1) {
  return {
    wave,
    stage: 'interval',
    stageClock: 0,
    spawnQueue: [],
    enemies: [],
    nextEnemyId: 1,
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
    expect(s.spawnQueue[0]).toEqual({ at: 0.5, type: 'bing', lane: 0, mul: 1 });
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
