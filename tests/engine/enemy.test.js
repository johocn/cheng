import { describe, it, expect } from 'vitest';
import { pathPoint, laneLength, spawnEnemy, moveEnemies } from '../../src/engine/enemy.js';
import { ENEMY_TYPES, HERO_POS } from '../../src/engine/config.js';

function makeState() {
  return { enemies: [], nextEnemyId: 1 };
}

describe('pathPoint 路径插值', () => {
  it('lane0 是单段直线：t=0 顶点、t=1 赵云、t=0.5 中点', () => {
    expect(pathPoint(0, 0)).toEqual({ x: 360, y: -40 });
    expect(pathPoint(0, 1)).toEqual({ x: 360, y: 640 });
    expect(pathPoint(0, 0.5)).toEqual({ x: 360, y: 300 });
  });

  it('t 越界钳制到 [0,1]', () => {
    expect(pathPoint(0, -1)).toEqual(pathPoint(0, 0));
    expect(pathPoint(0, 2)).toEqual(pathPoint(0, 1));
  });

  it('lane1 折线：起点、终点正确，中点在前半段', () => {
    expect(pathPoint(1, 0)).toEqual({ x: -40, y: 300 });
    expect(pathPoint(1, 1)).toEqual(HERO_POS);
    const mid = pathPoint(1, 0.5);
    expect(mid.x).toBeLessThan(200); // 总长约529，前段长约288，t=0.5 仍在第一段
  });

  it('终点即赵云脚下（漏怪判定点）', () => {
    for (let lane = 0; lane < 3; lane++) {
      expect(pathPoint(lane, 1)).toEqual(HERO_POS);
    }
  });

  it('laneLength 为正且 lane0 长度 = 680', () => {
    expect(laneLength(0)).toBeCloseTo(680, 0);
    expect(laneLength(1)).toBeGreaterThan(0);
  });
});

describe('spawnEnemy', () => {
  it('按类型定义生成满血敌人，id 自增', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    spawnEnemy(s, 'qi', 2);
    expect(s.enemies).toHaveLength(2);
    expect(s.enemies[0]).toEqual({
      id: 1, type: 'bing', lane: 0, t: 0,
      hp: ENEMY_TYPES.bing.hp, hpMax: ENEMY_TYPES.bing.hp,
    });
    expect(s.enemies[1].id).toBe(2);
    expect(s.nextEnemyId).toBe(3);
  });
});

describe('moveEnemies', () => {
  it('按类型速度推进 t', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    moveEnemies(s, 1); // 恰好 1 秒
    // bing speed 35 / lane0 长度 680
    expect(s.enemies[0].t).toBeCloseTo(35 / 680, 5);
  });

  it('t≥1 判定漏怪：移出战场并返回漏怪明细', () => {
    const s = makeState();
    spawnEnemy(s, 'qi', 0);
    s.enemies[0].t = 0.999;
    spawnEnemy(s, 'bing', 0);
    s.enemies[1].t = 0.5;
    const leaked = moveEnemies(s, 0.1);
    expect(leaked).toEqual([{ type: 'qi', dmg: ENEMY_TYPES.qi.dmg }]);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].type).toBe('bing');
  });
});
