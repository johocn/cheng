// tests/engine/events.test.js — M8 只读事件流：hit/kill/leak/ult/boss 全字段 + 每帧重置 + 数值零回归
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { dealDamage } from '../../src/engine/combat.js';
import { spawnEnemy, reapDead, pathPoint } from '../../src/engine/enemy.js';
import { tryStartUlt } from '../../src/engine/ult.js';
import { HERO_POS, ENEMY_TYPES } from '../../src/engine/config.js';

function battle() { return createBattle(20260304, {}); }

describe('M8 事件流', () => {
  it('createBattle 初始化 frameEvents 为空数组', () => {
    expect(battle().frameEvents).toEqual([]);
  });

  it('dealDamage 命中产 hit（dmg/crit/enemyId/坐标/enemyType）', () => {
    const s = battle();
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].t = 0.3;
    const id = s.enemies[0].id;
    dealDamage(s, id, 30, { crit: true });
    const hits = s.frameEvents.filter((e) => e.type === 'hit');
    expect(hits).toHaveLength(1);
    const ev = hits[0];
    expect(ev.dmg).toBe(30);
    expect(ev.crit).toBe(true);
    expect(ev.enemyId).toBe(id);
    expect(ev.enemyType).toBe('bing');
    const p = pathPoint(0, 0.3);
    expect(ev.x).toBeCloseTo(p.x, 5);
    expect(ev.y).toBeCloseTo(p.y, 5);
  });

  it('dealDamage 致死只产 kill（cause direct / isBoss）不产 hit', () => {
    const s = battle();
    spawnEnemy(s, 'shuai', 1);
    const id = s.enemies[0].id;
    const r = dealDamage(s, id, 99999);
    expect(r.killed).toBe(true);
    expect(s.frameEvents.filter((e) => e.type === 'hit')).toHaveLength(0);
    const k = s.frameEvents.find((e) => e.type === 'kill');
    expect(k.cause).toBe('direct');
    expect(k.isBoss).toBe(true);
    expect(k.enemyType).toBe('shuai');
    expect(k.enemyId).toBe(id);
    expect(k.affix).toBeNull(); // 第1章 affixRate=0 无词缀
  });

  it('opts.crit 缺省 false（旧调用零回归）', () => {
    const s = battle();
    spawnEnemy(s, 'bing', 0);
    dealDamage(s, s.enemies[0].id, 10);
    expect(s.frameEvents[0].crit).toBe(false);
  });

  it('reapDead 灼烧中死亡 cause=burn；非灼烧 direct（大招/锦囊直伤）', () => {
    const s = battle();
    spawnEnemy(s, 'teng', 0);
    s.enemies[0].burnT = 3; // 灼烧中
    s.enemies[0].hp = 0;
    spawnEnemy(s, 'bing', 1);
    s.enemies[1].hp = 0;    // 非灼烧（如大招直伤后收口）
    reapDead(s);
    const kills = s.frameEvents.filter((e) => e.type === 'kill');
    expect(kills).toHaveLength(2);
    expect(kills[0].cause).toBe('burn');
    expect(kills[1].cause).toBe('direct');
  });

  it('spawnEnemy 出 shuai 产 boss 事件（isBoss true）', () => {
    const s = battle();
    spawnEnemy(s, 'bing', 0);
    spawnEnemy(s, 'shuai', 2);
    const evs = s.frameEvents.filter((e) => e.type === 'boss');
    expect(evs).toHaveLength(1);
    expect(evs[0].enemyType).toBe('shuai');
    expect(evs[0].isBoss).toBe(true);
  });

  it('tryStartUlt 成功产 ult 事件；失败不产', () => {
    const s = battle();
    expect(tryStartUlt(s)).toBe(false); // 无计策
    s.slots[0] = { id: 1, type: 'jice', tier: 1 };
    s.slots[1] = { id: 2, type: 'jice', tier: 1 };
    expect(tryStartUlt(s)).toBe(true);
    const ev = s.frameEvents.find((e) => e.type === 'ult');
    expect(ev).toBeTruthy();
    expect(ev.x).toBe(HERO_POS.x);
    expect(ev.dmg).toBe(600);
  });

  it('漏怪产 leak 事件（坐标 HERO_POS）；护盾期免伤不发', () => {
    // 直接走 advanceFrame：interval 态没有敌人推进，用 wave 态 + 手动注入
    const s = battle();
    s.stage = 'wave';
    s.spawnQueue = [];
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].t = 0.9999;      // 一 tick 内跨过 t≥1（0.999 需 19.4ms > 16.667ms 单帧，跨不过）
    s.enemies[0].hp = 999999;     // 不会被打死
    const s2 = advanceFrame(s, null, 17);
    const leaks = s2.frameEvents.filter((e) => e.type === 'leak');
    expect(leaks).toHaveLength(1);
    expect(leaks[0].x).toBe(HERO_POS.x);
    expect(leaks[0].enemyType).toBe('bing');
    expect(s2.hp).toBe(s.hp - 1); // 实际扣血
    // 护盾期
    const s3 = battle();
    s3.stage = 'wave';
    s3.spawnQueue = [];
    s3.shieldT = 3;
    spawnEnemy(s3, 'bing', 0);
    s3.enemies[0].t = 0.9999;
    s3.enemies[0].hp = 999999;
    const s4 = advanceFrame(s3, null, 17);
    expect(s4.frameEvents.filter((e) => e.type === 'leak')).toHaveLength(0);
    expect(s4.hp).toBe(s3.hp); // 免伤
  });

  it('frameEvents 每帧重置：上一帧事件不残留到下一帧', () => {
    const s = battle();
    s.stage = 'wave';
    s.spawnQueue = [];
    spawnEnemy(s, 'bing', 0);
    dealDamage(s, s.enemies[0].id, 10);
    expect(s.frameEvents.length).toBeGreaterThan(0);
    const s2 = advanceFrame(s, null, 17);
    expect(s2.frameEvents).toEqual([]); // 无新事件则空
  });

  it('终态冻结不再产事件', () => {
    const s = battle();
    s.stage = 'victory';
    const s2 = advanceFrame(s, null, 17);
    expect(s2).toBe(s); // 终态原样返回
  });

  it('数值零回归：kill 事件的金币/killCount 与无事件流时代一致', () => {
    const s = battle();
    spawnEnemy(s, 'qi', 0);
    const id = s.enemies[0].id;
    dealDamage(s, id, 99999);
    expect(s.coins).toBe(ENEMY_TYPES.qi.reward);
    expect(s.killCount).toBe(1);
  });
});
