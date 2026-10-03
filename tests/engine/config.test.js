import { describe, it, expect } from 'vitest';
import {
  LOGICAL_W, LOGICAL_H, HERO_POS, HERO,
  ENEMY_TYPES, LANES, HP_MAX, TOTAL_WAVES, WAVE_COMPS,
  ENEMY_GROWTH, BOSS_WAVES, ITEM_TYPES, SLOT_MAX, ITEM_DROP_INTERVAL,
  MERGE_COUNT, ITEM_TIER2_MUL, ULT_JICE_COST, ULT_CAST_DUR,
  ROGUE_SKILLS, RARITY_NAMES, SPAWN_GAP_MIN,
} from '../../src/engine/config.js';

describe('M1 基础数值', () => {
  it('逻辑画布 720×1280，赵云居中', () => {
    expect(LOGICAL_W).toBe(720);
    expect(LOGICAL_H).toBe(1280);
    expect(HERO_POS).toEqual({ x: 360, y: 640 });
  });

  it('三条路径都终于赵云脚下', () => {
    expect(LANES).toHaveLength(3);
    for (const lane of LANES) {
      expect(lane[lane.length - 1]).toEqual(HERO_POS);
    }
  });

  it('敌人类型齐全且数值为正', () => {
    expect(Object.keys(ENEMY_TYPES).sort())
      .toEqual(['bing', 'gong', 'qi', 'shuai', 'teng', 'tou']);
    for (const def of Object.values(ENEMY_TYPES)) {
      expect(def.hp).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.dmg).toBeGreaterThan(0);
      expect(def.reward).toBeGreaterThan(0);
    }
  });

  it('赵云数值已定（AoE 普攻）', () => {
    expect(HERO.atk).toBe(60);
    expect(HERO.atkInterval).toBe(0.75);
    expect(HERO.atkRange).toBe(180);
  });
});

describe('M2 关卡与系统数值', () => {
  it('15 波组成表：类型合法、数量为正、BOSS 波含 shuai', () => {
    expect(TOTAL_WAVES).toBe(15);
    expect(WAVE_COMPS).toHaveLength(15);
    WAVE_COMPS.forEach((comp, wi) => {
      expect(comp.length, `wave${wi + 1} 至少 1 组`).toBeGreaterThan(0);
      for (const [type, count] of comp) {
        expect(ENEMY_TYPES[type], `wave${wi + 1} 类型 ${type}`).toBeTruthy();
        expect(count, `wave${wi + 1} 数量为正`).toBeGreaterThan(0);
      }
    });
    for (const bw of BOSS_WAVES) {
      const comp = WAVE_COMPS[bw - 1];
      expect(comp.some(([t]) => t === 'shuai'), `第${bw}波 BOSS 含 shuai`).toBe(true);
    }
  });

  it('成长系数与刷怪间隔', () => {
    expect(ENEMY_GROWTH).toBe(0.15);
    expect(SPAWN_GAP_MIN).toBeGreaterThan(0);
  });

  it('锦囊五类齐全，元素与效果键合法', () => {
    expect(Object.keys(ITEM_TYPES).sort())
      .toEqual(['baihu', 'jice', 'qinglong', 'xuanwu', 'zhuque']);
    for (const def of Object.values(ITEM_TYPES)) {
      expect(typeof def.label).toBe('string');
      expect(typeof def.elem).toBe('string');
      expect(['strike', 'shield', 'knock', 'burn', 'buff']).toContain(def.kind);
    }
    expect(SLOT_MAX).toBe(8);
    expect(ITEM_DROP_INTERVAL).toBe(6);
    expect(MERGE_COUNT).toBe(3);
    expect(ITEM_TIER2_MUL).toBe(2.5);
  });

  it('大招：耗 2 计策、演出 2.8s', () => {
    expect(ULT_JICE_COST).toBe(2);
    expect(ULT_CAST_DUR).toBe(2.8);
  });

  it('肉鸽技能池：9 技能、三档稀有度、权重为正、id 唯一', () => {
    expect(ROGUE_SKILLS).toHaveLength(9);
    const ids = ROGUE_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(9);
    for (const s of ROGUE_SKILLS) {
      expect([0, 1, 2]).toContain(s.rarity);
      expect(s.weight).toBeGreaterThan(0);
      expect(typeof s.name).toBe('string');
      expect(typeof s.desc).toBe('string');
    }
    expect(RARITY_NAMES).toEqual(['普通', '稀有', '史诗']);
  });
});
