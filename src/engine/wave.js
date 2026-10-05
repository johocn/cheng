// engine/wave.js — 波次编排：WAVE_COMPS × 成长系数生成刷怪队列
// 流转：interval（state.js 编排）→ wave → skillPick（下一波）/ victory（终波）
import { CHAPTER_PACKS, TOTAL_WAVES, SPAWN_GAP_MIN, ENEMY_GROWTH, BOSS_WAVES, AFFIX_KEYS } from './config.js';
import { rngNext } from './rng.js';
import { spawnEnemy } from './enemy.js';

// 波开始：chapter/daily/endless 走组成表，bossrush 走专用编排
// 口径（T1 已定）：chMul 承载全部 hp 系数（chapterMul × endless 1.08^over × bossrush 递增）；
//                 hpMul 专供张辽开局减益事件因子（updateWave 折算 spawnEnemy 形参）
export function startWave(state) {
  if (state.mode === 'bossrush') return startBossRushWave(state);
  const pack = CHAPTER_PACKS[state.packIdx || 0];
  // M7 无尽：组成表按 (wave-1)%len 轮换（chapter 波次 ≤len 行为不变）
  const comp = pack.waveComps[(state.wave - 1) % pack.waveComps.length];
  const mul = 1 + (state.wave - 1) * ENEMY_GROWTH;
  const hpMul = state.wave <= 3 && state.frontHpCut ? 1 - state.frontHpCut : 1; // 张辽：开局压制（前 3 波）
  // M7 无尽难度：15 波后 hp ×1.08^(wave-15) 指数递增
  const endlessOver = state.mode === 'endless' && state.wave > TOTAL_WAVES ? state.wave - TOTAL_WAVES : 0;
  const chMul = (state.chapterMul || 1) * (endlessOver ? Math.pow(1.08, endlessOver) : 1);
  const rate = state.chapterPackRate ?? 0;
  const bossWave = state.wave <= TOTAL_WAVES && BOSS_WAVES.includes(state.wave);
  const lap = Math.floor((state.wave - 1) / pack.waveComps.length); // M7 无尽轮次
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (const [type, count0] of comp) {
    const count = state.mode === 'endless' ? Math.ceil(count0 * (1 + 0.3 * lap)) : count0;
    const gap = Math.max(SPAWN_GAP_MIN, 6 / count);
    for (let i = 0; i < count; i++) {
      // M6 精英词缀；M7 每日挑战：全员固定当日词缀（含 BOSS）
      const affix = state.mode === 'daily' && state.dailyAffix ? state.dailyAffix
        : (bossWave || rngNext(state.rng) < rate)
          ? AFFIX_KEYS[Math.floor(rngNext(state.rng) * AFFIX_KEYS.length)]
          : null;
      events.push({ at, type, lane, mul, chMul, hpMul, affix });
      at += gap;
      lane = (lane + 1) % 3;
    }
  }
  events.sort((a, b) => a.at - b.at);
  state.spawnQueue = events;
  state.stageClock = 0;
  state.stage = 'wave';
}

// M7 车轮战：第 r 轮 2 个 shuai 带随机词缀，hp ×(1+0.25(r-1))×chapterMul，无小兵
// r 镜像 state.wave（车轮战每轮即一波，真实流转 wave 每轮 +1 后才 startWave，二者恒等）
function startBossRushWave(state) {
  state.bossRound = state.wave;
  const r = state.bossRound;
  const chMul = (1 + 0.25 * (r - 1)) * (state.chapterMul || 1);
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (let i = 0; i < 2; i++) {
    const affix = AFFIX_KEYS[Math.floor(rngNext(state.rng) * AFFIX_KEYS.length)];
    events.push({ at, type: 'shuai', lane, mul: 1, chMul, hpMul: 1, affix });
    at += 1.2;
    lane = (lane + 1) % 3;
  }
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
    spawnEnemy(state, ev.type, ev.lane, ev.mul, ev.chMul * (ev.hpMul ?? 1), ev.affix); // hpMul：M7 张辽开局压制因子
  }
  if (!state.spawnQueue.length && state.enemies.length === 0) {
    if (state.mode === 'endless') {
      if (state.wave % 5 === 0) state.coins += state.wave * 10; // 每 5 波额外金币
      state.stage = 'skillPick'; // 无尽永不 victory
    } else {
      state.stage = state.mode === 'bossrush' ? 'skillPick' // 车轮战无限轮，仅 hp≤0 结束
        : state.wave >= TOTAL_WAVES ? 'victory' : 'skillPick';
    }
  }
}
