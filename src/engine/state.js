// engine/state.js — 主状态机：纯函数入口 advanceFrame（M2）
// 随机性来自 state.rng（随 state 克隆，确定性可复现）；玩家输入 inputs 帧首消费。
// stage: interval → wave → skillPick →（下一波 wave…）→ victory | over
import { HP_MAX, HERO_POS } from './config.js';
import { createRng } from './rng.js';
import { moveEnemies, reapDead } from './enemy.js';
import { heroAttack } from './hero.js';
import { startWave, updateWave } from './wave.js';
import { tickSlots, useSlot } from './slot.js';
import { rollThree, pickSkill, computeStats } from './rogue.js';
import { tryStartUlt, tickUlt, canUlt } from './ult.js';

const TICK = 1000 / 60;   // 16.667ms 固定步长
const INTERVAL_SECS = 2.5; // 波间歇秒数（开场与每波 skillPick 后由 state.js 编排）

export function createBattle(seed = 20260304, opts = {}) {
  const state = {
    frame: 0,
    stage: 'interval',
    stageClock: 0,
    wave: 0,           // 进行中/已完成的波数；startWave 前 +1
    hp: HP_MAX, hpMax: HP_MAX,
    coins: 0, killCount: 0,
    enemies: [], nextEnemyId: 1,
    spawnQueue: [],
    rng: createRng(seed),
    slots: Array(8).fill(null), nextItemId: 1,
    slotTimer: 0,
    skills: [], pickChoices: null,
    heroStat: computeStats([]),
    hero: { pos: { ...HERO_POS }, atkCooldown: 0 },
    atkBuffT: 0, shieldT: 0,
    ult: null,
    leechCount: 0,     // 饮血已结算次数（killCount/10 的增量差）
  };
  // M3 局外注入：英雄攻击乘区 / 章节敌方 hp 系数（缺省 ×1 = 与 M2 完全一致）
  state.metaAtkMul = opts.atkMul || 1;
  state.chapterMul = opts.chapterMul || 1;
  state.heroStat.atk *= state.metaAtkMul;
  return state;
}

// pickSkill 后重算派生属性；增垣提高 hpMax 时回补差值
export function refreshStats(state) {
  const prevMax = state.heroStat.hpMax;
  state.heroStat = computeStats(state.skills);
  state.heroStat.atk *= state.metaAtkMul || 1; // 局外乘区不因技能重算丢失（M3）
  state.hpMax = state.heroStat.hpMax;
  if (state.hpMax > prevMax) state.hp += state.hpMax - prevMax;
  if (state.hp > state.hpMax) state.hp = state.hpMax;
}

export function advanceFrame(state, inputs, dtMs) {
  if (state.stage === 'victory' || state.stage === 'over') return state; // 终态冻结

  const work = structuredClone(state);
  work.frame++;
  let remain = Math.max(0, dtMs);

  while (remain > 0) {
    const step = Math.min(TICK, remain);
    remain -= step;
    const dt = step / 1000;

    // —— 玩家输入（一次输入只消费一次）——
    if (inputs) {
      if (inputs.pickSkill !== undefined && work.stage === 'skillPick' && work.pickChoices) {
        pickSkill(work, inputs.pickSkill);
        refreshStats(work);
        work.wave++;
        startWave(work);
        inputs = null;
      } else if (inputs.useUlt && canUlt(work)) {
        tryStartUlt(work);
        inputs = null;
      } else if (inputs.clickSlot !== undefined && work.stage === 'wave') {
        useSlot(work, inputs.clickSlot);
        inputs = null;
      }
    }

    if (work.ult) { // 大招演出：时间冻结，仅推进演出计时；结束时一次结算
      tickUlt(work, dt);
      if (!work.ult) reapDead(work);
      continue;
    }

    switch (work.stage) {
      case 'interval':
        work.stageClock += dt;
        if (work.stageClock >= INTERVAL_SECS) { work.wave++; startWave(work); }
        break;
      case 'wave': {
        updateWave(work, dt);            // 刷怪 + 波清判定（内置 stageClock）
        if (work.stage !== 'wave') break; // 本 tick 已切 skillPick/victory
        const leaked = moveEnemies(work, dt); // 移动含 stun/slow/burn
        if (work.shieldT <= 0) {          // 玄武护盾免伤（enemy.js 不感知 shield）
          for (const l of leaked) work.hp -= l.dmg;
        }
        tickSlots(work, dt * work.heroStat.dropMul);
        heroAttack(work, dt);
        reapDead(work);
        applyLeech(work);
        tickTimers(work, dt);
        break;
      }
      case 'skillPick':
        break; // 冻结等待输入（不掉落、不移动、不计时）
    }
    if (work.hp <= 0) { work.hp = 0; work.stage = 'over'; break; }
  }

  // 波清 → 弹三选一（updateWave 切 stage 后在此补抽卡）
  if (work.stage === 'skillPick' && !work.pickChoices) {
    rollThree(work);
    work.stageClock = 0;
  }
  if (work.hp <= 0) { work.hp = 0; work.stage = 'over'; }
  return work;
}

// 饮血：每 10 杀回 1 守军（按 killCount 直接取模，与 combat/reapDead 的击杀统计闭环）
function applyLeech(work) {
  if (!work.heroStat.leech) return;
  const heals = Math.floor(work.killCount / 10) - work.leechCount;
  if (heals > 0) {
    work.leechCount += heals;
    work.hp = Math.min(work.hpMax, work.hp + heals);
  }
}

function tickTimers(work, dt) {
  if (work.shieldT > 0) work.shieldT -= dt;
  // atkBuffT 已随攻击节拍衰减，此处仅钳非负
  if (work.atkBuffT < 0) work.atkBuffT = 0;
}
