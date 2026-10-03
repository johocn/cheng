// engine/wave.js — 波次编排：interval → wave → 下一波 / victory
import { WAVES, TOTAL_WAVES, WAVE_INTERVAL } from './config.js';
import { spawnEnemy } from './enemy.js';

export function startWave(state, waveNo) {
  state.wave = waveNo;
  state.spawnQueue = WAVES[waveNo - 1].events.map(([at, type, lane]) => ({
    at, type, lane,
  }));
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
    state.stageClock = WAVE_INTERVAL;
  }
}
