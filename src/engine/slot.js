// engine/slot.js — 锦囊掉落/使用/合成（mutate working state）
import { rngPick } from './rng.js';
import {
  SLOT_MAX, ITEM_DROP_INTERVAL, MERGE_COUNT, ITEM_TIER2_MUL,
  ITEM_TYPES, HERO, HERO_POS, ENEMY_TYPES,
} from './config.js';
import { pathPoint } from './enemy.js';

export function tickSlots(state, dtS) {
  if (state.stage !== 'wave') return;
  state.slotTimer += dtS;
  if (state.slotTimer < ITEM_DROP_INTERVAL) return;
  const idx = state.slots.findIndex((x) => x === null);
  if (idx === -1) {
    state.slotTimer = ITEM_DROP_INTERVAL; // 满员钳住，一有空位立即掉
    return;
  }
  state.slotTimer = 0;
  state.slots[idx] = {
    id: state.nextItemId++,
    type: rngPick(state.rng, Object.keys(ITEM_TYPES)),
    tier: 1,
  };
}

export function countType(state, type) {
  return state.slots.filter((x) => x && x.type === type).length;
}

export function canMergeAt(state, i) {
  const it = state.slots[i];
  return !!it && countType(state, it.type) >= MERGE_COUNT;
}

export function useSlot(state, i) {
  const it = state.slots[i];
  if (!it) return false;
  if (canMergeAt(state, i)) {
    // 3 张相同 → 1 张 tier2（保留点击位，其余清除）
    state.slots[i] = { id: state.nextItemId++, type: it.type, tier: 2 };
    for (let j = 0; j < SLOT_MAX; j++) {
      if (j !== i && state.slots[j] && state.slots[j].type === it.type) {
        state.slots[j] = null;
      }
    }
    state.stats = state.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
    state.stats.mergeCount++;
    return true;
  }
  applyItemEffect(state, it);
  state.slots[i] = null;
  return true;
}

function tierMul(item) {
  return item.tier === 2 ? ITEM_TIER2_MUL : 1;
}

function forEachEnemy(state, fn) {
  for (const e of state.enemies) fn(e);
}

function inRange(enemy) {
  const p = pathPoint(enemy.lane, enemy.t);
  const dx = p.x - HERO_POS.x, dy = p.y - HERO_POS.y;
  return Math.hypot(dx, dy) <= HERO.atkRange;
}

export function applyItemEffect(state, item) {
  const def = ITEM_TYPES[item.type];
  const mul = tierMul(item);
  switch (def.kind) {
    case 'strike': // 范围斩击：射程内 1.5×atk
      forEachEnemy(state, (e) => {
        if (inRange(e)) e.hp -= HERO.atk * 1.5 * mul;
      });
      break;
    case 'shield': // 守军免伤 3s
      state.shieldT = 3 * mul;
      break;
    case 'knock':  // 全场击退
      forEachEnemy(state, (e) => { e.t = Math.max(0, e.t - 0.12 * mul); });
      break;
    case 'burn':   // 灼烧 5s，每秒 2% 自身 hpMax
      forEachEnemy(state, (e) => { e.burnT = Math.max(e.burnT, 5 * mul); });
      break;
    case 'buff':   // 攻击 +30% 共 5s
      state.atkBuffT = Math.max(state.atkBuffT, 5 * mul);
      break;
  }
}
