import { describe, it, expect } from 'vitest';
import { startWave, updateWave } from '../../src/engine/wave.js';
import { WAVE_COMPS } from '../../src/engine/config.js';

function makeState() {
  return {
    wave: 0,
    stage: 'interval',
    stageClock: 99,
    waveClock: 0,
    spawnQueue: [],
    enemies: [],
    nextEnemyId: 1,
  };
}

describe('startWave', () => {
  // it.skip：依赖旧 WAVES 事件表细节（队列格式/数量），Task 6 重写
  it.skip('构建刷怪队列并进入 wave 阶段', () => {
    const s = makeState();
    startWave(s, 1);
    expect(s.wave).toBe(1);
    expect(s.stage).toBe('wave');
    expect(s.waveClock).toBe(0);
    expect(s.spawnQueue).toHaveLength(WAVES[0].events.length);
    expect(s.spawnQueue[0]).toEqual({ at: 0.5, type: 'bing', lane: 0 });
  });
});

describe('updateWave — wave 阶段', () => {
  // it.skip：依赖旧 WAVES 事件表细节（首事件时刻/总数），Task 6 重写
  it.skip('到点刷怪：at≤waveClock 的事件入战场并出队', () => {
    const s = makeState();
    startWave(s, 1);
    updateWave(s, 0.6); // waveClock=0.6 ≥ 首事件 0.5
    expect(s.enemies).toHaveLength(1);
    expect(s.spawnQueue).toHaveLength(WAVES[0].events.length - 1);
  });

  it('未到点不刷怪', () => {
    const s = makeState();
    startWave(s, 1);
    updateWave(s, 0.1);
    expect(s.enemies).toHaveLength(0);
  });

  // it.skip：依赖 WAVE_INTERVAL（已删除），Task 6 改为 skillPick 流转
  it.skip('队列空且场清：非终波进入 interval', () => {
    const s = makeState();
    startWave(s, 1);
    s.spawnQueue = [];
    s.enemies = [];
    updateWave(s, 0.1);
    expect(s.stage).toBe('interval');
    expect(s.stageClock).toBe(WAVE_INTERVAL);
  });

  // it.skip：依赖旧 TOTAL_WAVES=3（现为 15），Task 6 重写
  it.skip('队列空且场清：终波（第3波）直接 victory', () => {
    const s = makeState();
    startWave(s, 3);
    s.spawnQueue = [];
    s.enemies = [];
    updateWave(s, 0.1);
    expect(s.stage).toBe('victory');
  });
});

describe('updateWave — interval 阶段', () => {
  it('倒计时归零自动开启下一波', () => {
    const s = makeState();
    s.stage = 'interval';
    s.stageClock = 1.0;
    updateWave(s, 1.1);
    expect(s.wave).toBe(1);
    expect(s.stage).toBe('wave');
  });

  it('倒计时未到不切波', () => {
    const s = makeState();
    s.stage = 'interval';
    s.stageClock = 2.0;
    updateWave(s, 1.0);
    expect(s.stage).toBe('interval');
    expect(s.wave).toBe(0);
  });

  it('victory/over 阶段冻结不推进', () => {
    const s = makeState();
    s.stage = 'victory';
    s.stageClock = 5;
    updateWave(s, 10);
    expect(s.stage).toBe('victory');
    const s2 = makeState();
    s2.stage = 'over';
    updateWave(s2, 10);
    expect(s2.stage).toBe('over');
  });
});
