// engine/wave.js — 波次编排：WAVE_COMPS × 成长系数生成刷怪队列
// 流转：interval（state.js 编排）→ wave → skillPick（下一波）/ victory（终波）
import { WAVE_COMPS, TOTAL_WAVES, SPAWN_GAP_MIN, ENEMY_GROWTH, BOSS_WAVES, AFFIX_KEYS } from './config.js';
import { rngNext } from './rng.js';
import { spawnEnemy } from './enemy.js';

// 波开始：构建该波刷怪队列 [{ at(波内秒), type, lane, mul, chMul, affix }]，按时间升序
export function startWave(state) {
  const comp = WAVE_COMPS[state.wave - 1];
  const mul = 1 + (state.wave - 1) * ENEMY_GROWTH;
  const chMul = state.chapterMul || 1; // 章节敌方 hp 系数（M3 局外注入，默认 ×1 零回归）
  const rate = state.chapterPackRate ?? 0; // 章节包精英词缀权重（M6 Task 4 注入，缺省 0）
  const bossWave = BOSS_WAVES.includes(state.wave);
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (const [type, count] of comp) {
    const gap = Math.max(SPAWN_GAP_MIN, 6 / count);
    for (let i = 0; i < count; i++) {
      // M6 精英词缀：BOSS 波必带；普通波按章节权重 rng 判定，词缀三选一均匀抽
      const affix = (bossWave || rngNext(state.rng) < rate)
        ? AFFIX_KEYS[Math.floor(rngNext(state.rng) * AFFIX_KEYS.length)]
        : null;
      events.push({ at, type, lane, mul, chMul, affix });
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
    spawnEnemy(state, ev.type, ev.lane, ev.mul, ev.chMul, ev.affix);
  }
  if (!state.spawnQueue.length && state.enemies.length === 0) {
    state.stage = state.wave >= TOTAL_WAVES ? 'victory' : 'skillPick';
  }
}
