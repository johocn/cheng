// tests/meta/stamina.test.js — 体力：恢复/扣减/奖励入账
import { describe, it, expect } from 'vitest';
import { regenStamina, spendStamina, gainStamina, STAMINA_MAX, REGEN_MS, BATTLE_COST } from '../../src/meta/stamina.js';
import { defaultSave } from '../../src/meta/save.js';

const MIN = 60 * 1000;

function saveWith(stamina, ts) {
  const s = defaultSave();
  s.wallet.stamina = stamina;
  s.wallet.staminaTs = ts;
  return s;
}

describe('regenStamina 自然恢复', () => {
  it('满体力时对齐时间戳，不超上限', () => {
    const s = saveWith(60, 1000);
    const gained = regenStamina(s, 10 * MIN);
    expect(gained).toBe(0);
    expect(s.wallet.stamina).toBe(60);
    expect(s.wallet.staminaTs).toBe(10 * MIN);
  });
  it('5.5 分钟 → +1 点，时间戳只前进整数点', () => {
    const s = saveWith(58, 0);
    const gained = regenStamina(s, 5.5 * MIN);
    expect(gained).toBe(1);
    expect(s.wallet.stamina).toBe(59);
    expect(s.wallet.staminaTs).toBe(REGEN_MS);
  });
  it('跨点累积且封顶 60', () => {
    const s = saveWith(58, 0);
    regenStamina(s, 12 * MIN);
    expect(s.wallet.stamina).toBe(60);
  });
  it('恢复期间扣减后再恢复，从旧时间戳续算', () => {
    const s = saveWith(60, 0);
    regenStamina(s, 1 * MIN); // 满 → ts=1min
    s.wallet.stamina -= 3;    // 57
    const gained = regenStamina(s, 8 * MIN); // 距上次 7min → +1
    expect(gained).toBe(1);
    expect(s.wallet.stamina).toBe(58);
    expect(s.wallet.staminaTs).toBe(1 * MIN + REGEN_MS);
  });
});

describe('spendStamina / gainStamina', () => {
  it('不足时拒绝且不扣', () => {
    const s = saveWith(4, 0);
    expect(spendStamina(s)).toBe(false);
    expect(s.wallet.stamina).toBe(4);
  });
  it('足够时扣 5 点', () => {
    const s = saveWith(60, 0);
    expect(spendStamina(s)).toBe(true);
    expect(s.wallet.stamina).toBe(60 - BATTLE_COST);
  });
  it('奖励入账可超上限', () => {
    const s = saveWith(55, 0);
    gainStamina(s, 20);
    expect(s.wallet.stamina).toBe(75);
    expect(STAMINA_MAX).toBe(60);
    expect(REGEN_MS).toBe(5 * 60 * 1000);
  });
});
