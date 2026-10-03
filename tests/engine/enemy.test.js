import { describe, it, expect } from 'vitest';
import {
  pathPoint, laneLength, spawnEnemy, moveEnemies, reapDead,
} from '../../src/engine/enemy.js';
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
      speedMul: 1, slowT: 0, stunT: 0, burnT: 0,
    });
    expect(s.enemies[1].id).toBe(2);
    expect(s.nextEnemyId).toBe(3);
  });

  it('mul 参数：hp/hpMax/speedMul 同步成长（默认 1）', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0, 1.5);
    expect(s.enemies[0].hp).toBe(150);
    expect(s.enemies[0].hpMax).toBe(150);
    expect(s.enemies[0].speedMul).toBe(1.5);
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

  it('stunT>0：原地冻结不移动也不漏怪，计时递减', () => {
    const s = makeState();
    spawnEnemy(s, 'qi', 0);
    s.enemies[0].t = 0.999;
    s.enemies[0].stunT = 0.5;
    const leaked = moveEnemies(s, 0.1);
    expect(leaked).toHaveLength(0);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].t).toBeCloseTo(0.999, 5);
    expect(s.enemies[0].stunT).toBeCloseTo(0.4, 5);
  });

  it('slowT>0：移速 ×0.7，计时递减', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].slowT = 2;
    moveEnemies(s, 1);
    expect(s.enemies[0].t).toBeCloseTo((35 / 680) * 0.7, 5);
    expect(s.enemies[0].slowT).toBeCloseTo(1, 5);
  });

  it('burnT>0：每秒损失 2% hpMax，计时递减', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].burnT = 1;
    moveEnemies(s, 1);
    expect(s.enemies[0].hp).toBeCloseTo(100 - 2, 5);
    expect(s.enemies[0].burnT).toBeCloseTo(0, 5);
  });
});

describe('reapDead 帧末清尸', () => {
  it('hp≤0：入金币、计击杀、移出战场；活者保留', () => {
    const s = makeState();
    s.coins = 0;
    s.killCount = 0;
    spawnEnemy(s, 'bing', 0);
    spawnEnemy(s, 'qi', 1);
    s.enemies[0].hp = 0;
    reapDead(s);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].type).toBe('qi');
    expect(s.coins).toBe(ENEMY_TYPES.bing.reward);
    expect(s.killCount).toBe(1);
  });
});

describe('M6 新敌人', () => {
  it('config 定义 投石车/藤甲兵', () => {
    expect(ENEMY_TYPES.tou).toMatchObject({ hp: 350, speed: 22, dmg: 1, reward: 40, label: '投' });
    expect(ENEMY_TYPES.teng).toMatchObject({ hp: 300, speed: 32, dmg: 2, reward: 25, label: '藤' });
  });

  it('藤甲兵受灼烧伤害 ×2', () => {
    const s = makeState();
    spawnEnemy(s, 'teng', 0);
    const teng = s.enemies[0];
    teng.burnT = 1;                 // 灼烧 1s
    const hp0 = teng.hp;
    moveEnemies(s, 1);              // 推进 1s
    const burned = hp0 - teng.hp;
    // 普通敌人灼烧每秒 2% hpMax；藤甲 ×2 = 4% hpMax
    expect(burned).toBeCloseTo(teng.hpMax * 0.04, 5);
  });

  it('非藤甲兵灼烧仍为 2% hpMax', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    const b = s.enemies[0];
    b.burnT = 1;
    const hp0 = b.hp;
    moveEnemies(s, 1);
    expect(hp0 - b.hp).toBeCloseTo(b.hpMax * 0.02, 5);
  });
});
