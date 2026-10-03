import { describe, it, expect } from 'vitest';
import { countJice, canUlt, tryStartUlt, tickUlt } from '../../src/engine/ult.js';
import { createRng } from '../../src/engine/rng.js';
import { ULT_CAST_DUR, ULT_DAMAGE, ULT_STUN } from '../../src/engine/config.js';

function makeState() {
  return {
    rng: createRng(5),
    slots: Array(8).fill(null),
    nextItemId: 1,
    ult: null,
    stage: 'wave',
    enemies: [],
    nextEnemyId: 1,
    coins: 0,
  };
}
function spawnAt(state, t, hp = 1000) {
  state.enemies.push({ id: state.nextEnemyId++, type: 'bing', lane: 0, t, hp, hpMax: hp, slowT: 0, stunT: 0, burnT: 0 });
}
function putJice(state, n) {
  for (let i = 0; i < n; i++) {
    const idx = state.slots.findIndex((x) => x === null);
    if (idx === -1) break;
    state.slots[idx] = { id: state.nextItemId++, type: 'jice', tier: 1 };
  }
}

describe('充能判定', () => {
  it('计策 <2 不可放；≥2 就绪', () => {
    const s = makeState();
    expect(countJice(s)).toBe(0);
    putJice(s, 1);
    expect(canUlt(s)).toBe(false);
    putJice(s, 1); // 共 2
    expect(countJice(s)).toBe(2);
    expect(canUlt(s)).toBe(true);
  });

  it('tryStartUlt：消耗 2 张计策，进入演出计时', () => {
    const s = makeState();
    putJice(s, 2);
    expect(tryStartUlt(s)).toBe(true);
    expect(s.ult).not.toBeNull();
    expect(s.ult.t).toBe(0);
    expect(countJice(s)).toBe(0);
  });

  it('不足 2 张 / 已在演出中 → 拒绝', () => {
    const s = makeState();
    putJice(s, 1);
    expect(tryStartUlt(s)).toBe(false);
    putJice(s, 2);
    expect(tryStartUlt(s)).toBe(true);
    expect(tryStart(s)).toBe(false);
    function tryStart(s2) { return tryStartUlt(s2); }
  });
});

describe('演出与结算', () => {
  it('演出期间推进 t，未到时不结算', () => {
    const s = makeState();
    spawnAt(s, 0.5);
    putJice(s, 2);
    tryStartUlt(s);
    tickUlt(s, 1.0);
    expect(s.ult.t).toBeCloseTo(1.0, 5);
    expect(s.enemies[0].hp).toBe(1000); // 未结算
  });

  it('演出结束：全场受 ULT_DAMAGE、t 回退、眩晕、ult 清空', () => {
    const s = makeState();
    spawnAt(s, 0.5);
    spawnAt(s, 0.1, 400);
    putJice(s, 2);
    tryStartUlt(s);
    tickUlt(s, ULT_CAST_DUR);
    expect(s.ult).toBeNull();
    expect(s.enemies[0].hp).toBe(1000 - ULT_DAMAGE);
    expect(s.enemies[0].stunT).toBeCloseTo(ULT_STUN, 5);
    expect(s.enemies[0].t).toBeCloseTo(0.35, 5);
    expect(s.enemies[1].hp).toBe(0); // 400-600 击穿
  });
});
