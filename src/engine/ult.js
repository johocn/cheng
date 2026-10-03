// engine/ult.js — 大招「七进七出」：2 计策施放，2.8s 演出（时间冻结），结束一次结算
import {
  ULT_JICE_COST, ULT_CAST_DUR, ULT_DAMAGE, ULT_KNOCKBACK, ULT_STUN,
} from './config.js';

export function countJice(state) {
  return state.slots.filter((x) => x && x.type === 'jice').length;
}

export function canUlt(state) {
  return !state.ult && countJice(state) >= ULT_JICE_COST;
}

export function tryStartUlt(state) {
  if (!canUlt(state)) return false;
  let need = ULT_JICE_COST;
  for (let i = 0; i < state.slots.length && need > 0; i++) {
    if (state.slots[i] && state.slots[i].type === 'jice') {
      state.slots[i] = null;
      need--;
    }
  }
  state.ult = { t: 0 };
  return true;
}

export function tickUlt(state, dtS) {
  if (!state.ult) return;
  state.ult.t += dtS;
  if (state.ult.t < ULT_CAST_DUR) return;
  // 结算：全场伤害 + 击退 + 眩晕
  for (const e of state.enemies) {
    e.hp = Math.max(0, e.hp - ULT_DAMAGE);
    e.t = Math.max(0, e.t - ULT_KNOCKBACK);
    e.stunT = Math.max(e.stunT, ULT_STUN);
  }
  state.ult = null;
}
