// tests/engine/combo.test.js — M9 连击 Combo：窗口计数 / 漏怪清零
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { spawnEnemy, reapDead } from '../../src/engine/enemy.js';
import { dealDamage } from '../../src/engine/combat.js';
import { COMBO_WINDOW, HP_MAX } from '../../src/engine/config.js';

function makeKillState(clock) {
  return {
    enemies: [], nextEnemyId: 1, coins: 0, killCount: 0, frameEvents: [],
    combo: 0, lastKillClock: -999, stageClock: clock,
    stats: { mergeCount: 0, ultCount: 0, bossKills: 0 },
  };
}
function spawnKillable(st) {
  spawnEnemy(st, 'bing', 0, 1, 1);
  st.enemies[st.enemies.length - 1].hp = 0;
}

describe('M9 Combo：reapDead 连击计数', () => {
  it('窗口内连续击杀：combo 递增且 lastKillClock 跟随', () => {
    const s = makeKillState(1.0);
    spawnKillable(s); reapDead(s);
    expect(s.combo).toBe(1);
    expect(s.lastKillClock).toBe(1.0);
    s.stageClock = 1.5; // 间隔 0.5s ≤ COMBO_WINDOW
    spawnKillable(s); reapDead(s);
    expect(s.combo).toBe(2);
    expect(s.lastKillClock).toBe(1.5);
  });

  it('超窗归零重计（不叠加旧连击）', () => {
    const s = makeKillState(1.0);
    spawnKillable(s); reapDead(s);
    expect(s.combo).toBe(1);
    s.stageClock = 1.0 + COMBO_WINDOW + 0.1;
    spawnKillable(s); reapDead(s);
    expect(s.combo).toBe(1);
  });

  it('击杀仍发 kill 事件（M8 事件流不受影响）', () => {
    const s = makeKillState(0);
    spawnKillable(s); reapDead(s);
    expect(s.frameEvents.filter((e) => e.type === 'kill')).toHaveLength(1);
  });

  it('旧式无 combo 字段的 state 直调 reapDead 不炸（兼容零回归）', () => {
    const s = { enemies: [], nextEnemyId: 1, coins: 0, killCount: 0, frameEvents: [] };
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].hp = 0;
    reapDead(s);
    expect(s.combo).toBe(1);
  });
});

describe('M9 Combo：直伤击杀计数（dealDamage 主路径）', () => {
  it('dealDamage 致死：combo 递增且 lastKillClock 跟随（真实主力击杀路径）', () => {
    const s = makeKillState(2.0);
    spawnEnemy(s, 'bing', 0, 1, 1);
    dealDamage(s, s.enemies[0].id, 99999);
    expect(s.killCount).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.lastKillClock).toBe(2.0);
    s.stageClock = 2.5;
    spawnEnemy(s, 'bing', 0, 1, 1);
    dealDamage(s, s.enemies[0].id, 99999);
    expect(s.combo).toBe(2);
    expect(s.lastKillClock).toBe(2.5);
  });

  it('直伤死不与 reapDead 双重计数（敌人已移出，收尸不重复登记）', () => {
    const s = makeKillState(1.0);
    spawnEnemy(s, 'bing', 0, 1, 1);
    dealDamage(s, s.enemies[0].id, 99999);
    reapDead(s); // 收尸空跑
    expect(s.killCount).toBe(1);
    expect(s.combo).toBe(1);
    expect(s.coins).toBe(10); // 兵 reward 10 只发一次
  });

  it('advanceFrame 真实链路：英雄攻击致死 combo≥1', () => {
    const s = createBattle(1, { chapterN: 1 });
    s.stage = 'wave'; s.wave = 1; s.stageClock = 0;
    spawnEnemy(s, 'bing', 0, 1, 1);
    s.enemies[0].t = 0.96; // 逼近英雄进入普攻范围
    const out = advanceFrame(s, null, 1000);
    expect(out.killCount).toBeGreaterThanOrEqual(1);
    expect(out.combo).toBeGreaterThanOrEqual(1);
  });
});

describe('M9 Combo：漏怪清零（advanceFrame leak 分支）', () => {
  function leakState() {
    const s = createBattle(1, { chapterN: 1 });
    s.stage = 'wave'; s.wave = 1; s.stageClock = 0;
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].t = 0.9999999; // 下一步即漏怪
    return s;
  }

  it('漏怪扣血且 combo 归零', () => {
    const s = leakState();
    s.combo = 5; s.lastKillClock = 1;
    const out = advanceFrame(s, null, 50);
    expect(out.hp).toBe(HP_MAX - 1);
    expect(out.combo).toBe(0);
  });

  it('玄武护盾免伤：不扣血不清零（口径同免伤不发事件）', () => {
    const s = leakState();
    s.combo = 5; s.shieldT = 3;
    const out = advanceFrame(s, null, 50);
    expect(out.hp).toBe(HP_MAX);
    expect(out.combo).toBe(5);
  });

  it('createBattle 初始 combo=0 / lastKillClock=-999', () => {
    const s = createBattle(1);
    expect(s.combo).toBe(0);
    expect(s.lastKillClock).toBe(-999);
  });
});
