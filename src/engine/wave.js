// engine/wave.js — 波次编排：interval → wave → 下一波 / victory
// （Task 2 过渡版：WAVE_COMPS 生成刷怪队列；Task 6 将重写为 skillPick 流转 + 成长系数 mul）
import { WAVE_COMPS, TOTAL_WAVES, SPAWN_GAP_MIN } from './config.js';
import { spawnEnemy } from './enemy.js';

export function startWave(state, waveNo) {
  state.wave = waveNo;
  const comp = WAVE_COMPS[waveNo - 1];
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (const [type, count] of comp) {
    const gap = Math.max(SPAWN_GAP_MIN, 6 / count);
    for (let i = 0; i < count; i++) {
      events.push({ at, type, lane });
      at += gap;
      lane = (lane + 1) % 3;
    }
  }
  events.sort((a, b) => a.at - b.at);
  state.spawnQueue = events;
  state.waveClock = 0;
  state.stage = 'wave';
}

export function updateWave(state, dtSec) {
  if (state.stage === 'interval') {
    state.stageClock -= dtSec;
    if (state.stageClock <= 0) startWave(state, state.wave + 1);
    return;
  }
  if (state.stage !== 'wave') return; // victory/over 冻结

  state.waveClock += dtSec;
  while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.waveClock) {
    const ev = state.spawnQueue.shift();
    spawnEnemy(state, ev.type, ev.lane);
  }

  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    if (state.wave >= TOTAL_WAVES) {
      state.stage = 'victory';
      return;
    }
    state.stage = 'interval';
    state.stageClock = 0; // WAVE_INTERVAL 已删除；Task 6 改为 skillPick 流转
  }
}
