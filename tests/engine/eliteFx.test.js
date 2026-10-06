// tests/engine/eliteFx.test.js — M10 精英词缀出场演出：spawnEnemy 发 elite 事件（shuai 除外，避免与 Boss 卷轴重复）
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { spawnEnemy } from '../../src/engine/enemy.js';
import { LANES, AFFIXES, AFFIX_COLORS, ELITE_FX } from '../../src/engine/config.js';

function makeState() {
  return { enemies: [], nextEnemyId: 1, frameEvents: [] };
}

describe('M10 精英演出：spawnEnemy 发 elite 事件', () => {
  it('非 shuai 带词缀 → 发 elite 事件（affix/坐标取路径起点）', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 1, 1, 1, 'iron');
    const ev = s.frameEvents.find((e) => e.type === 'elite');
    expect(ev).toBeTruthy();
    expect(ev.affix).toBe('iron');
    expect(ev.x).toBe(LANES[1][0].x);
    expect(ev.y).toBe(LANES[1][0].y);
  });

  it('shuai 带词缀 → 只发 boss 事件，不发 elite（卷轴已足够）', () => {
    const s = makeState();
    spawnEnemy(s, 'shuai', 0, 1, 1, 'sharp');
    const types = s.frameEvents.map((e) => e.type);
    expect(types).toContain('boss');
    expect(types).not.toContain('elite');
  });

  it('无词缀 → 不发 elite 事件', () => {
    const s = makeState();
    spawnEnemy(s, 'qi', 2);
    expect(s.frameEvents.find((e) => e.type === 'elite')).toBeUndefined();
  });

  it('daily 全员词缀：逐个刷出逐个发（数量 1:1）', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0, 1, 1, 'swift');
    spawnEnemy(s, 'gong', 1, 1, 1, 'iron');
    spawnEnemy(s, 'teng', 2, 1, 1, 'sharp');
    const elites = s.frameEvents.filter((e) => e.type === 'elite');
    expect(elites).toHaveLength(3);
    expect(elites.map((e) => e.affix)).toEqual(['swift', 'iron', 'sharp']);
  });

  it('三种词缀字段值合法（AFFIXES/AFFIX_COLORS/ELITE_FX 配置完备）', () => {
    for (const key of ['iron', 'swift', 'sharp']) {
      expect(AFFIXES[key].label).toBeTruthy();
      expect(AFFIX_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(ELITE_FX.dur).toBeGreaterThan(0);
    expect(ELITE_FX.maxActive).toBeGreaterThanOrEqual(1);
  });

  it('advanceFrame 真实链路：elite 事件随 frameEvents 流出（deepClone 保真）', () => {
    const state = createBattle(20260304);
    // 手工注入一个带词缀刷怪事件（模拟 daily），跑一帧验证事件透传
    state.stage = 'wave';
    state.spawnQueue = [{ at: 0, type: 'bing', lane: 0, mul: 1, chMul: 1, hpMul: 1, affix: 'iron' }];
    const out = advanceFrame(state, null, 100);
    expect(out.frameEvents.some((e) => e.type === 'elite' && e.affix === 'iron')).toBe(true);
  });
});
