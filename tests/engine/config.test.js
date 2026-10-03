import { describe, it, expect } from 'vitest';
import {
  LOGICAL_W, LOGICAL_H, HERO_POS, HERO,
  ENEMY_TYPES, LANES, HP_MAX, WAVE_INTERVAL, TOTAL_WAVES, WAVES,
} from '../../src/engine/config.js';

describe('数值配置表', () => {
  it('逻辑画布 720×1280，赵云居中', () => {
    expect(LOGICAL_W).toBe(720);
    expect(LOGICAL_H).toBe(1280);
    expect(HERO_POS).toEqual({ x: 360, y: 640 });
  });

  it('三条路径都终于赵云脚下', () => {
    expect(LANES).toHaveLength(3);
    for (const lane of LANES) {
      const last = lane[lane.length - 1];
      expect(last).toEqual(HERO_POS);
    }
  });

  it('敌人类型齐全且数值为正', () => {
    expect(Object.keys(ENEMY_TYPES).sort())
      .toEqual(['bing', 'gong', 'qi', 'shuai']);
    for (const def of Object.values(ENEMY_TYPES)) {
      expect(def.hp).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.dmg).toBeGreaterThan(0);
      expect(def.reward).toBeGreaterThan(0);
      expect(typeof def.label).toBe('string');
    }
  });

  it('三波刷怪事件：时间升序、类型/路径合法', () => {
    expect(WAVES).toHaveLength(TOTAL_WAVES);
    const laneCount = LANES.length;
    WAVES.forEach((wave, wi) => {
      let prevAt = -Infinity;
      for (const [at, type, lane] of wave.events) {
        expect(at, `wave${wi + 1} 事件时间须升序`).toBeGreaterThan(prevAt);
        prevAt = at;
        expect(ENEMY_TYPES[type], `wave${wi + 1} 类型 ${type} 合法`).toBeTruthy();
        expect(lane, `wave${wi + 1} 路径 ${lane} 合法`)
          .toBeGreaterThanOrEqual(0);
        expect(lane).toBeLessThan(laneCount);
      }
      expect(wave.events.length, '每波至少 1 个事件').toBeGreaterThan(0);
    });
  });

  it('守军与波间歇为正', () => {
    expect(HP_MAX).toBe(15);
    expect(WAVE_INTERVAL).toBeGreaterThan(0);
    expect(TOTAL_WAVES).toBe(3);
  });

  it('赵云数值已定（AoE 普攻）', () => {
    expect(HERO.atk).toBe(60);
    expect(HERO.atkInterval).toBe(0.75);
    expect(HERO.atkRange).toBe(180);
  });
});
