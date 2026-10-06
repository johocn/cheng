// engine/spear.js — M11 枪意/箭意档位纯函数（wave → 档位下标，取最后一个 wave≤当前波的档）
import { SPEAR_STAGES, BOW_STAGES } from './config.js';

export function spearStageOf(wave) {
  let s = 0;
  for (let i = 0; i < SPEAR_STAGES.length; i++) {
    if (wave >= SPEAR_STAGES[i].wave) s = i;
  }
  return s;
}

export function bowStageOf(wave) {
  let s = 0;
  for (let i = 0; i < BOW_STAGES.length; i++) {
    if (wave >= BOW_STAGES[i].wave) s = i;
  }
  return s;
}
