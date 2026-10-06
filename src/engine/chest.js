// engine/chest.js — M10 Boss 波前宝箱三选一：均等抽三、五种犒赏效果（mutate working state）
// 触发编排见 wave.js（波清时切 chestPick）与 state.js（pickChest 输入分支）
import { rngNext, rngPick } from './rng.js';
import { CHEST_REWARDS, CHEST_GOLD, CHEST_HP, CHEST_SHIELD, CHEST_ITEMS, CHEST_ATK, ITEM_TYPES } from './config.js';

// 均等洗牌取 3（Fisher-Yates 前三步），消耗 state.rng，确定性可复现
export function rollChest(state) {
  const pool = CHEST_REWARDS.map((r) => r.id);
  const picks = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rngNext(state.rng) * pool.length);
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  state.chestChoices = picks;
}

export function pickChest(state, idx) {
  if (!state.chestChoices || !state.chestChoices[idx]) return false;
  const id = state.chestChoices[idx];
  state.chestChoices = null;
  switch (id) {
    case 'troops': // 犒赏三军：hpMax +3 并回复（同增垣回补口径）
      state.hpMax += CHEST_HP;
      state.hp = Math.min(state.hpMax, state.hp + CHEST_HP);
      break;
    case 'shield': // 玄武庇佑：取较大值，不缩短已有护盾
      state.shieldT = Math.max(state.shieldT || 0, CHEST_SHIELD);
      break;
    case 'gold':
      state.coins += CHEST_GOLD;
      break;
    case 'items': // 计策入囊：空槽放入 2 张 tier1（槽满丢弃，不补偿）
      for (let i = 0; i < CHEST_ITEMS; i++) {
        const slot = state.slots.findIndex((x) => x === null);
        if (slot === -1) break;
        state.slots[slot] = {
          id: state.nextItemId++,
          type: rngPick(state.rng, Object.keys(ITEM_TYPES)),
          tier: 1,
        };
      }
      break;
    case 'edge': // 锋芒：攻击乘区增量（refreshStats 消费，重算不丢）
      state.edgeAtk = (state.edgeAtk || 0) + CHEST_ATK;
      break;
    default:
      return false;
  }
  return true;
}
