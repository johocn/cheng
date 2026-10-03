import { describe, it, expect } from 'vitest';
import { rollThree, pickSkill, computeStats } from '../../src/engine/rogue.js';
import { createRng } from '../../src/engine/rng.js';
import { ROGUE_SKILLS, RARITY_NAMES, HP_MAX, BOSS_WAVES } from '../../src/engine/config.js';

function makeState() {
  return {
    rng: createRng(77),
    skills: [],
    pickChoices: null,
    stage: 'skillPick',
    wave: 4,
    hp: 15, hpMax: 15,
  };
}
const byId = (id) => ROGUE_SKILLS.find((s) => s.id === id);

describe('rollThree 三选一候选', () => {
  it('产出 3 个不重复技能 id', () => {
    const s = makeState();
    rollThree(s);
    expect(s.pickChoices).toHaveLength(3);
    expect(new Set(s.pickChoices).size).toBe(3);
    for (const id of s.pickChoices) expect(byId(id)).toBeTruthy();
  });

  it('BOSS 前一波（9/14）必含稀有以上', () => {
    for (const bw of BOSS_WAVES) {
      const s = makeState();
      s.wave = bw - 1;
      for (let trial = 0; trial < 20; trial++) {
        rollThree(s);
        const best = Math.max(...s.pickChoices.map((id) => byId(id).rarity));
        expect(best, `第${bw}波前必出稀有+`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('普通波也可能全普通（不强制），但权重收敛合理', () => {
    const s = makeState();
    s.wave = 2;
    rollThree(s);
    expect(s.pickChoices).toHaveLength(3);
  });
});

describe('pickSkill 选择与叠加', () => {
  it('选择后 skills 追加、pickChoices 清空', () => {
    const s = makeState();
    rollThree(s);
    pickSkill(s, 1);
    expect(s.skills).toHaveLength(1);
    expect(s.pickChoices).toBeNull();
  });

  it('同局可叠加：同一技能选两次也生效两次', () => {
    const s = makeState();
    s.pickChoices = ['atk', 'atk', 'crit'];
    pickSkill(s, 0);
    s.pickChoices = ['atk', 'atk', 'crit']; // 模拟下一轮再抽到同款
    pickSkill(s, 0);
    const st = computeStats(s.skills);
    expect(st.atk).toBeCloseTo(60 * 1.2 * 1.2, 5);
  });
});

describe('computeStats 属性聚合', () => {
  it('空技能 = 基础值', () => {
    const st = computeStats([]);
    expect(st.atk).toBe(60);
    expect(st.atkInterval).toBeCloseTo(0.75, 5);
    expect(st.atkRange).toBe(180);
    expect(st.crit).toBe(0);
    expect(st.slowOnHit).toBe(false);
    expect(st.chain).toBe(0);
    expect(st.leech).toBe(false);
    expect(st.dropMul).toBe(1);
    expect(st.hpMax).toBe(HP_MAX);
  });

  it('九技能全叠：各乘区/旗标正确', () => {
    const st = computeStats(ROGUE_SKILLS.map((s) => s.id));
    expect(st.atk).toBeCloseTo(60 * 1.2, 5);
    expect(st.atkInterval).toBeCloseTo(0.75 * 0.85, 5);
    expect(st.atkRange).toBeCloseTo(180 * 1.3, 5);
    expect(st.crit).toBeCloseTo(0.25, 5);
    expect(st.slowOnHit).toBe(true);
    expect(st.chain).toBe(4);
    expect(st.leech).toBe(true);
    expect(st.dropMul).toBe(0.8);
    expect(st.hpMax).toBe(HP_MAX + 5);
  });

  it('稀有度名齐全', () => {
    expect(RARITY_NAMES).toHaveLength(3);
  });
});
