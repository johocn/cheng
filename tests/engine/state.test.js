import { describe, it, expect, test } from 'vitest';
import { createBattle, advanceFrame, refreshStats } from '../../src/engine/state.js';
import { startWave, updateWave } from '../../src/engine/wave.js';
import { TOTAL_WAVES, HP_MAX } from '../../src/engine/config.js';
import { useSlot } from '../../src/engine/slot.js';
import { tryStartUlt } from '../../src/engine/ult.js';
import { spawnEnemy, reapDead } from '../../src/engine/enemy.js';

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

// 自动玩家：宝箱选 0（任选皆正向增益）；skillPick 选「稀有度最高」的；大招就绪即放；锦囊冷却 3s 点一次（有合先合）
function autoPlay(state, maxSeconds) {
  let elapsed = 0;
  let slotCd = 0;
  while (elapsed < maxSeconds) {
    if (state.stage === 'victory' || state.stage === 'over') break;
    if (state.stage === 'chestPick' && state.chestChoices) {
      state = advanceFrame(state, { pickChest: 0 }, 16.667); // M10：Boss 波前宝箱
      elapsed += 0.016667;
      continue;
    }
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

describe('M6 章节包注入', () => {
  it('createBattle 按章节号注入包与词缀权重', () => {
    const s1 = createBattle(1, { chapterN: 1 });
    expect(s1.packIdx).toBe(0);
    expect(s1.chapterPackRate).toBe(0);
    const s3 = createBattle(1, { chapterN: 3 });
    expect(s3.packIdx).toBe(2);
    expect(s3.chapterPackRate).toBeCloseTo(0.2, 5);
    const s8 = createBattle(1, { chapterN: 8 });   // 8→packIndex 7%6=1
    expect(s8.packIdx).toBe(1);
  });
});

describe('M6 stats 计数', () => {
  test('createBattle 初始化 stats 三计数', () => {
    const s = createBattle(1);
    expect(s.stats).toMatchObject({ mergeCount: 0, ultCount: 0, bossKills: 0 });
  });

  test('锦囊三合一 mergeCount+1 / 大招 ultCount+1 / 杀帅 bossKills+1', () => {
    const s = createBattle(1);
    // 三合一：凑 3 张同型
    s.slots[0] = { id: 1, type: 'qinglong', tier: 1 };
    s.slots[1] = { id: 2, type: 'qinglong', tier: 1 };
    s.slots[2] = { id: 3, type: 'qinglong', tier: 1 };
    useSlot(s, 0);
    expect(s.stats.mergeCount).toBe(1);
    // 大招：凑 2 计策
    s.slots[3] = { id: 4, type: 'jice', tier: 1 };
    s.slots[4] = { id: 5, type: 'jice', tier: 1 };
    expect(tryStartUlt(s)).toBe(true);
    expect(s.stats.ultCount).toBe(1);
    // 杀帅
    spawnEnemy(s, 'shuai', 0);
    s.enemies[0].hp = 0;
    reapDead(s);
    expect(s.stats.bossKills).toBe(1);
  });
});
