import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame, refreshStats } from '../../src/engine/state.js';
import { startWave, updateWave } from '../../src/engine/wave.js';
import { TOTAL_WAVES, HP_MAX } from '../../src/engine/config.js';

function runFrames(state, seconds, inputs) {
  let ms = seconds * 1000;
  while (ms > 0) {
    const step = Math.min(16.667, ms);
    state = advanceFrame(state, inputs, step);
    ms -= step;
    if (state.stage === 'victory' || state.stage === 'over') break;
  }
  return state;
}

// 自动玩家：skillPick 选「稀有度最高」的；大招就绪即放；锦囊冷却 3s 点一次（有合先合）
function autoPlay(state, maxSeconds) {
  let elapsed = 0;
  let slotCd = 0;
  while (elapsed < maxSeconds) {
    if (state.stage === 'victory' || state.stage === 'over') break;
    if (state.stage === 'skillPick' && state.pickChoices) {
      const r = { 0: 0, 1: 1, 2: 2 };
      const best = state.pickChoices.reduce(
        (bi, id, i, arr) => (r[id] > r[arr[bi]] ? i : bi), 0,
      );
      state = advanceFrame(state, { pickSkill: best }, 16.667);
      elapsed += 0.016667;
      continue;
    }
    if (state.slots.filter((x) => x && x.type === 'jice').length >= 2) {
      state = advanceFrame(state, { useUlt: true }, 16.667);
      elapsed += 0.016667;
      continue;
    }
    if (slotCd <= 0 && state.stage === 'wave' && state.slots.some(Boolean)) {
      const idx = state.slots.findIndex(Boolean);
      state = advanceFrame(state, { clickSlot: idx }, 16.667);
      slotCd = 3;
      elapsed += 0.016667;
      continue;
    }
    state = advanceFrame(state, null, 100);
    elapsed += 0.1;
    slotCd -= 0.1;
  }
  return state;
}

describe('M2 主状态机', () => {
  it('createBattle 初始态完整（slots/skills/ult/heroStat）', () => {
    const s = createBattle(1);
    expect(s.stage).toBe('interval');
    expect(s.slots).toHaveLength(8);
    expect(s.skills).toEqual([]);
    expect(s.ult).toBeNull();
    expect(s.heroStat.atk).toBe(60);
    expect(s.hp).toBe(HP_MAX);
    expect(s.wave).toBe(0);
  });

  it('纯函数：advanceFrame 不改入参（state 与 inputs 均不变异）', () => {
    const s = createBattle(2);
    const snap = JSON.stringify(s);
    const inputs = { clickSlot: 0 };
    advanceFrame(s, inputs, 100);
    expect(JSON.stringify(s)).toBe(snap);
    expect(inputs).toEqual({ clickSlot: 0 });
  });

  it('确定性：同种子同输入序列结果一致', () => {
    const a = autoPlay(runFrames(createBattle(42), 6), 30);
    const b = autoPlay(runFrames(createBattle(42), 6), 30);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('15 波自动玩家通关 victory（集成验收）', () => {
    const t0 = Date.now();
    const s = autoPlay(runFrames(createBattle(20260304), 2), 60 * 30);
    console.log(`[集成验收] stage=${s.stage} wave=${s.wave} hp=${s.hp}/${s.hpMax} `
      + `击杀=${s.killCount} 金币=${s.coins} 实际用时=${((Date.now() - t0) / 1000).toFixed(1)}s`);
    expect(s.stage).toBe('victory');
    expect(s.wave).toBe(TOTAL_WAVES);
    expect(s.hp).toBeGreaterThan(0);
  }, 120000);

  it('skillPick 冻结战斗：不推进敌人与计时', () => {
    let s = runFrames(createBattle(7), 8); // 进入第一波
    s = advanceFrame(s, null, 16.667);
    if (s.stage === 'skillPick') {
      const snap = JSON.stringify({ e: s.enemies, c: s.stageClock });
      const s2 = advanceFrame(s, null, 500);
      expect(JSON.stringify({ e: s2.enemies, c: s2.stageClock })).toBe(snap);
    }
  });

  it('refreshStats：增垣提高 hpMax 并回补差值', () => {
    const s = createBattle(3);
    s.skills.push('wall');
    refreshStats(s);
    expect(s.hpMax).toBe(HP_MAX + 5);
    expect(s.hp).toBe(HP_MAX + 5);
    s.hp = 10;
    s.skills.push('crit');
    refreshStats(s);
    expect(s.hpMax).toBe(HP_MAX + 5);
    expect(s.hp).toBe(10); // 上限不变时无回补
  });
});

describe('M3 局外注入', () => {
  it('createBattle 默认零回归：无 opts 时行为与 M2 完全一致', () => {
    const a = createBattle(20260304);
    const b = createBattle(20260304, {});
    expect(a.heroStat.atk).toBe(b.heroStat.atk);
    expect(a.heroStat.atk).toBeCloseTo(60); // 基础攻击不变
  });

  it('atkMul 注入 heroStat.atk；refreshStats 技能重算后仍保留局外乘区', () => {
    const s = createBattle(1, { atkMul: 1.5 });
    expect(s.heroStat.atk).toBeCloseTo(90);
    // 模拟技能重算：refreshStats 后 meta 乘区不丢
    const s2 = createBattle(1, { atkMul: 2 });
    s2.skills.push('atk');
    refreshStats(s2); // computeStats: 60×1.2=72 → ×2 = 144
    expect(s2.heroStat.atk).toBeCloseTo(144);
  });

  it('chapterMul=1.5 时敌军 hp ×1.5，速度不变', () => {
    const s = createBattle(1, { chapterMul: 1.5 });
    s.wave = 1;
    startWave(s);
    // 快进到第一只刷出（首事件 at=0.5s）
    updateWave(s, 1.0);
    const e = s.enemies[0];
    expect(e.hpMax).toBeCloseTo(100 * 1.5); // bing 100 × 波1成长1 × 章节系数1.5
    expect(e.speedMul).toBe(1);             // 速度不受章节系数影响
  });
});
