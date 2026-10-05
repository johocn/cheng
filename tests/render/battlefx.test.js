// tests/render/battlefx.test.js — M8 打击感全家桶：吞帧分级/封顶/飘字/快照/演出触发/快进缩放
import { describe, it, expect, beforeEach } from 'vitest';
import {
  consume, update, reset, frozen, addShake, shakeActive, floats,
  ghostOf, enemyHitFlash, heroAttackAnim, setSpeed, tick, leakFlash,
} from '../../src/render/battleFx.js';
import { push, active as cineActive, reset as cineReset } from '../../src/render/cinematic.js';

beforeEach(() => { reset(); cineReset(); });

describe('M8 battleFx 吞帧时停', () => {
  it('hit 30ms / 暴击 50ms / kill 70ms 分级', () => {
    let now = 1000;
    consume([{ type: 'hit', x: 0, y: 0, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    expect(frozen(1001)).toBe(true);
    expect(frozen(1031)).toBe(false); // 30ms 后解冻
    now = 2000;
    consume([{ type: 'hit', x: 0, y: 0, dmg: 10, crit: true, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    expect(frozen(2049)).toBe(true);
    expect(frozen(2051)).toBe(false);
    now = 3000;
    consume([{ type: 'kill', x: 0, y: 0, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing', cause: 'direct' }], { enemies: [] }, now);
    expect(frozen(3069)).toBe(true);
    expect(frozen(3071)).toBe(false);
  });

  it('同帧叠加封顶 120ms', () => {
    const now = 1000;
    const evs = [];
    for (let i = 0; i < 10; i++) {
      evs.push({ type: 'hit', x: 0, y: 0, dmg: 5, crit: false, enemyId: i, enemyType: 'bing' });
    }
    consume(evs, { enemies: [] }, now); // 10×30=300ms → 封顶 120
    expect(frozen(1119)).toBe(true);
    expect(frozen(1121)).toBe(false);
  });

  it('快进缩放：SPEED=10 时 hit 时停 3ms', () => {
    setSpeed(10);
    const now = 1000;
    consume([{ type: 'hit', x: 0, y: 0, dmg: 5, crit: false, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    expect(frozen(1002)).toBe(true);
    expect(frozen(1004)).toBe(false);
    setSpeed(1);
  });
});

describe('M8 battleFx 反馈状态', () => {
  it('hit 生成飘字（普通墨 18px / 暴击朱砂 23px）+ 受击闪白记录', () => {
    const now = 1000;
    consume([
      { type: 'hit', x: 100, y: 200, dmg: 12.4, crit: false, enemyId: 1, enemyType: 'bing' },
      { type: 'hit', x: 300, y: 400, dmg: 88, crit: true, enemyId: 2, enemyType: 'qi' },
    ], { enemies: [] }, now);
    expect(floats().length).toBe(2);
    const f0 = floats()[0];
    expect(f0.text).toBe('12'); // 取整
    expect(f0.size).toBe(18);
    expect(f0.crit).toBe(false);
    expect(floats()[1].size).toBe(23);
    expect(floats()[1].crit).toBe(true);
    expect(enemyHitFlash(1, 1050)).toBe(true);  // 80ms 内
    expect(enemyHitFlash(1, 1100)).toBe(false); // 过期
  });

  it('kill 记录死亡快照（ghost，affix 取自事件），400ms 后过期清除', () => {
    const now = 1000;
    consume([{ type: 'kill', x: 200, y: 300, dmg: 0, crit: false, enemyId: 7, enemyType: 'shuai', isBoss: true, cause: 'direct', affix: 'iron' }], { enemies: [] }, now);
    const g = ghostOf(7, 1050);
    expect(g).toBeTruthy();
    expect(g.type).toBe('shuai');
    expect(g.x).toBe(200);
    expect(g.y).toBe(300);
    expect(g.affix).toBe('iron');
    update(500); // 快照过期清除
    expect(ghostOf(7, 1550)).toBeNull();
  });

  it('kill isBoss 入队斩杀慢镜 400ms；boss 事件入队卷轴 800ms + title', () => {
    const now = 1000;
    const packState = { packIdx: 0, mode: 'chapter', enemies: [] };
    consume([{ type: 'boss', x: 0, y: 0, dmg: 0, crit: false, enemyId: 1, enemyType: 'shuai', isBoss: true }], packState, now);
    expect(cineActive().kind).toBe('bossScroll');
    expect(cineActive().dur).toBe(800);
    expect(cineActive().data.title).toBe('曹仁'); // CHAPTER_PACKS[0].bossTitle
    cineReset();
    const killState = { enemies: [] };
    consume([{ type: 'kill', x: 5, y: 5, dmg: 0, crit: false, enemyId: 2, enemyType: 'shuai', isBoss: true, cause: 'burn' }], killState, now);
    expect(cineActive().kind).toBe('bossKill');
    cineReset();
    const rushState = { packIdx: 0, mode: 'bossrush', bossRound: 3, enemies: [] };
    consume([{ type: 'boss', x: 0, y: 0, dmg: 0, crit: false, enemyId: 3, enemyType: 'shuai', isBoss: true }], rushState, now);
    expect(cineActive().data.title).toBe('车轮战 · 第3轮');
  });

  it('ult 事件不重复触发演出（战鼓由 audio 限频侧管），无崩溃', () => {
    expect(() => consume([{ type: 'ult', x: 360, y: 640, dmg: 600, crit: false, enemyId: null, enemyType: null }], { enemies: [] }, 1000)).not.toThrow();
    expect(cineActive()).toBeNull();
  });

  it('leak 事件触发城门红闪状态', () => {
    const now = 1000;
    consume([{ type: 'leak', x: 360, y: 640, dmg: 1, crit: false, enemyId: null, enemyType: 'bing' }], { enemies: [] }, now);
    expect(leakFlash(now + 100)).toBe(true);
    expect(leakFlash(now + 300)).toBe(false);
  });

  it('屏震：addShake 后 shakeActive，update 过期后解除', () => {
    tick(16); // 初始化内部时钟
    addShake(3, 120);
    expect(shakeActive()).toBe(true);
    for (let i = 0; i < 10; i++) update(20); // 累计 200ms > 120ms
    expect(shakeActive()).toBe(false);
  });

  it('hit 事件驱动赵云突刺动画（200ms）', () => {
    const now = 1000;
    consume([{ type: 'hit', x: 460, y: 740, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    const a = heroAttackAnim(now + 50);
    expect(a.active).toBe(true);
    expect(a.ang).toBeCloseTo(Math.atan2(740 - 640, 460 - 360), 5); // 朝命中点
    expect(heroAttackAnim(now + 250).active).toBe(false); // 200ms 过期
  });

  it('update 推进 cinematic 与飘字过期清理', () => {
    const now = 1000;
    consume([{ type: 'kill', x: 0, y: 0, dmg: 9, crit: false, enemyId: 1, enemyType: 'bing', cause: 'direct' }], { enemies: [] }, now);
    expect(floats().length).toBe(1); // kill(dmg>0) 也有飘字
    for (let i = 0; i < 12; i++) update(50); // 600ms > 500ms 飘字寿命
    expect(floats().length).toBe(0);
  });
});
