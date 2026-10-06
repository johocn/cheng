// tests/engine/bossSkill.test.js — M9 Boss 技能「横扫千军」：扇形几何 / 冷却前摇 / 打断 / 结算扣血
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { spawnEnemy, moveEnemies, pathPoint, inArc } from '../../src/engine/enemy.js';
import { BOSS_SKILL, HP_MAX } from '../../src/engine/config.js';

function makeState() {
  return { enemies: [], nextEnemyId: 1, frameEvents: [] };
}
// lane0 直线：t=0.9 时距英雄 68px（≤ range×0.9=180 触发半径），t=0.5 时 340px（超出）
function spawnBoss(t = 0.9) {
  const s = makeState();
  spawnEnemy(s, 'shuai', 0);
  s.enemies[0].t = t;
  return s;
}

describe('M9 Boss 技能：inArc 扇形几何（纯函数）', () => {
  it('半径边界：恰在 range 上含内、超出排除', () => {
    expect(inArc(0, 0, BOSS_SKILL.range, 0, 0)).toBe(true);
    expect(inArc(0, 0, BOSS_SKILL.range + 1, 0, 0)).toBe(false);
  });

  it('张角边界：±55° 之内含、之外排除、背后排除', () => {
    const r = 100;
    const cIn = Math.cos((54 * Math.PI) / 180);
    const sIn = Math.sin((54 * Math.PI) / 180);
    expect(inArc(0, 0, r * cIn, r * sIn, 0)).toBe(true);   // +54°
    expect(inArc(0, 0, r * cIn, -r * sIn, 0)).toBe(true);  // −54° 对称
    const cOut = Math.cos((56 * Math.PI) / 180);
    const sOut = Math.sin((56 * Math.PI) / 180);
    expect(inArc(0, 0, r * cOut, r * sOut, 0)).toBe(false); // +56°
    expect(inArc(0, 0, -r, 0, 0)).toBe(false);              // 180° 背后
  });
});

describe('M9 Boss 技能：spawnEnemy 附加状态机', () => {
  it('仅 shuai 附加 e.skill（bing 字段表零回归）', () => {
    const s = makeState();
    spawnEnemy(s, 'shuai', 0);
    expect(s.enemies[0].skill).toEqual({ clock: 0, phase: null, t0: 0 });
    spawnEnemy(s, 'bing', 0);
    expect(s.enemies[1].skill).toBeUndefined();
  });
});

describe('M9 Boss 技能：状态机（冷却 / 前摇 / 打断 / 结算）', () => {
  it('cd 计满且距离 ≤ range×0.9 才进入 warn', () => {
    const far = spawnBoss(0.5); // 距英雄 340px，超出触发半径
    far.enemies[0].skill.clock = BOSS_SKILL.cd;
    moveEnemies(far, 0.1);
    expect(far.enemies[0].skill.phase).toBeNull();

    const near = spawnBoss(0.9); // 距英雄 68px
    near.enemies[0].skill.clock = BOSS_SKILL.cd;
    moveEnemies(near, 0.1);
    expect(near.enemies[0].skill.phase).toBe('warn');
    expect(near.enemies[0].skill.clock).toBe(0); // 前摇重新计时
  });

  it('cd 未满不触发（即使在射程内）', () => {
    const s = spawnBoss(0.9);
    s.enemies[0].skill.clock = BOSS_SKILL.cd - 0.5;
    moveEnemies(s, 0.1);
    expect(s.enemies[0].skill.phase).toBeNull();
  });

  it('前摇推进至结算：伤害并入 leaked（skill 标记 + Boss 坐标），cd 重置', () => {
    const s = spawnBoss(0.9);
    const e = s.enemies[0];
    e.skill.phase = 'warn';
    e.skill.clock = BOSS_SKILL.telegraph - 0.05;
    e.skill.t0 = e.t;
    const tSettle = e.t;
    const leaked = moveEnemies(s, 0.1); // 跨过 telegraph
    expect(leaked).toHaveLength(1);
    expect(leaked[0]).toMatchObject({ type: 'shuai', dmg: BOSS_SKILL.dmg, skill: true });
    expect(leaked[0].x).toBeCloseTo(pathPoint(0, tSettle).x, 5);
    expect(leaked[0].y).toBeCloseTo(pathPoint(0, tSettle).y, 5);
    expect(e.skill.phase).toBeNull(); // 结算后回冷却
    expect(e.skill.clock).toBe(0);
  });

  it('结算后 cd 重置：冷却不满不会立刻再次 warn', () => {
    const s = spawnBoss(0.85); // 留推进余量不漏怪
    const e = s.enemies[0];
    e.skill.phase = 'warn';
    e.skill.clock = BOSS_SKILL.telegraph;
    e.skill.t0 = e.t;
    moveEnemies(s, 0.1); // 结算
    expect(e.skill.phase).toBeNull();
    e.skill.clock = BOSS_SKILL.cd - 1;
    moveEnemies(s, 0.5); // 仍差 0.5s，不触发
    expect(e.skill.phase).toBeNull();
    e.skill.clock = BOSS_SKILL.cd;
    moveEnemies(s, 0.1);
    expect(e.skill.phase).toBe('warn'); // 冷却满再次进入前摇
  });

  it('warn 期间被眩晕 → 打断取消（cd 重置满，打断即有收益）', () => {
    const s = spawnBoss(0.9);
    const e = s.enemies[0];
    e.skill.phase = 'warn';
    e.skill.clock = BOSS_SKILL.telegraph - 0.1;
    e.skill.t0 = e.t;
    e.stunT = 0.5;
    const leaked = moveEnemies(s, 0.1);
    expect(leaked).toHaveLength(0);
    expect(e.skill.phase).toBeNull();
    expect(e.skill.clock).toBe(0);
    expect(e.t).toBeCloseTo(0.9, 5); // stun 冻结不移动
  });

  it('warn 期间被击退（t 回退）→ 打断取消', () => {
    const s = spawnBoss(0.9);
    const e = s.enemies[0];
    e.skill.phase = 'warn';
    e.skill.clock = BOSS_SKILL.telegraph - 0.1;
    e.skill.t0 = e.t;
    e.t -= 0.05; // 模拟白虎/大招击退
    const leaked = moveEnemies(s, 0.1);
    expect(leaked).toHaveLength(0);
    expect(e.skill.phase).toBeNull();
    expect(e.skill.clock).toBeCloseTo(0.1, 5); // 打断后冷却从头再计（残留 1.3s 已丢弃，本帧 0.1s 计入新冷却）
  });
});

describe('M9 Boss 技能：state.js 统一结算（口径同漏怪）', () => {
  function bossWarnState() {
    const s = createBattle(1, { chapterN: 1 });
    s.stage = 'wave'; s.wave = 1; s.stageClock = 0;
    spawnEnemy(s, 'shuai', 0);
    const e = s.enemies[0];
    e.t = 0.9;
    e.skill.phase = 'warn';
    e.skill.clock = BOSS_SKILL.telegraph - 0.01; // 首个 tick 即结算
    e.skill.t0 = e.t;
    return s;
  }

  it('命中扣守军耐久并发 bossSkill 事件；非漏怪不清 combo', () => {
    const s = bossWarnState();
    s.combo = 7;
    const out = advanceFrame(s, null, 50);
    expect(out.hp).toBe(HP_MAX - BOSS_SKILL.dmg);
    expect(out.combo).toBe(7);
    const evs = out.frameEvents.filter((ev) => ev.type === 'bossSkill');
    expect(evs).toHaveLength(1);
    expect(evs[0].dmg).toBe(BOSS_SKILL.dmg);
    expect(evs[0].isBoss).toBe(true);
    expect(out.frameEvents.filter((ev) => ev.type === 'leak')).toHaveLength(0); // 不走漏怪事件
  });

  it('玄武护盾免伤：不扣血不发事件', () => {
    const s = bossWarnState();
    s.shieldT = 3;
    const out = advanceFrame(s, null, 50);
    expect(out.hp).toBe(HP_MAX);
    expect(out.frameEvents.some((ev) => ev.type === 'bossSkill')).toBe(false);
  });
});
