// engine/state.js — 纯函数主状态机
// advanceFrame(state, inputs, dtMs) → newState
// 对外纯函数（克隆入参）；内部按 16.667ms 固定 tick 确定性推进（M1 无随机）
import { HP_MAX, HERO_POS } from './config.js';
import { moveEnemies } from './enemy.js';
import { heroAttack } from './hero.js';
import { updateWave } from './wave.js';

const TICK_MS = 1000 / 60;

export function createBattle() {
  return {
    frame: 0,
    time: 0,
    hp: HP_MAX,
    hpMax: HP_MAX,
    coins: 0,
    wave: 0,
    stage: 'interval',   // 'wave' | 'interval' | 'victory' | 'over'
    stageClock: 1.5,     // 开场 1.5s 后第一波
    waveClock: 0,
    spawnQueue: [],
    enemies: [],
    nextEnemyId: 1,
    hero: { pos: { ...HERO_POS }, atkCooldown: 0 },
    _acc: 0,             // dt 残差累积（内部）
  };
}

export function advanceFrame(state, inputs, dtMs) {
  const s = structuredClone(state);
  s._acc += dtMs;
  while (s._acc >= TICK_MS) {
    if (s.stage === 'over' || s.stage === 'victory') {
      s._acc = 0; // 终态时间冻结
      break;
    }
    s._acc -= TICK_MS;
    tick(s, inputs);
    s.frame++;
  }
  return s;
}

function tick(s, inputs) {
  const dt = TICK_MS / 1000;
  s.time += dt;
  updateWave(s, dt);
  if (s.stage !== 'wave' && s.stage !== 'interval') return;
  const leaked = moveEnemies(s, dt);
  for (const e of leaked) {
    s.hp -= e.dmg;
  }
  if (s.hp <= 0) {
    s.hp = 0;
    s.stage = 'over';
    return;
  }
  heroAttack(s, dt);
}
