// engine/wave.js — 波次编排：WAVE_COMPS × 成长系数生成刷怪队列
// 流转：interval（state.js 编排）→ wave → skillPick（下一波）/ victory（终波）
import { WAVE_COMPS, TOTAL_WAVES, SPAWN_GAP_MIN, ENEMY_GROWTH } from './config.js';
import { spawnEnemy } from './enemy.js';

// 波开始：构建该波刷怪队列 [{ at(波内秒), type, lane, mul }]，按时间升序
export function startWave(state) {
  const comp = WAVE_COMPS[state.wave - 1];
  const mul = 1 + (state.wave - 1) * ENEMY_GROWTH;
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (const [type, count] of comp) {
    const gap = Math.max(SPAWN_GAP_MIN, 6 / count);
    for (let i = 0; i < count; i++) {
      events.push({ at, type, lane, mul });
      at += gap;
      lane = (lane + 1) % 3;
    }
  }
  events.sort((a, b) => a.at - b.at);
  state.spawnQueue = events;
  state.stageClock = 0;
  state.stage = 'wave';
}

// wave 阶段推进：刷怪 → 波清判定（interval/skillPick/victory/over 不在此推进）
export function updateWave(state, dtS) {
  if (state.stage !== 'wave') return;
  state.stageClock += dtS;
  while (state.spawnQueue.length && state.spawnQueue[0].at <= state.stageClock) {
    const ev = state.spawnQueue.shift();
    spawnEnemy(state, ev.type, ev.lane, ev.mul);
  }
  if (!state.spawnQueue.length && state.enemies.length === 0) {
    state.stage = state.wave >= TOTAL_WAVES ? 'victory' : 'skillPick';
  }
}
