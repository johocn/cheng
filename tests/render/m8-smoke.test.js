// tests/render/m8-smoke.test.js — M8 mock ctx 全链路冒烟：drawX 链路含动画器/粒子/演出各状态无崩溃
// 渲染循环崩溃 vitest 常规断言抓不到（无 ctx）——通用 mock ctx 跑全链路是 M7 验证过的有效防线
import { describe, it, expect, beforeEach } from 'vitest';
import { drawBattle } from '../../src/render/battle.js';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { spawnEnemy } from '../../src/engine/enemy.js';
import * as battleFx from '../../src/render/battleFx.js';
import { reset as cineReset, push as cinePush } from '../../src/render/cinematic.js';
import '../../src/render/art.js';
import { setSkin } from '../../src/render/theme.js';

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

beforeEach(() => { battleFx.reset(); cineReset(); setSkin('ink'); });

function stagedBattle() {
  const s = createBattle(20260304, {});
  s.stage = 'wave';
  s.wave = 1;
  s.spawnQueue = [];
  spawnEnemy(s, 'bing', 0);
  spawnEnemy(s, 'qi', 1);
  spawnEnemy(s, 'gong', 2);
  spawnEnemy(s, 'shuai', 0);
  s.enemies[0].t = 0.3;
  s.enemies[1].t = 0.5;
  s.enemies[2].t = 0.7;
  s.enemies[3].t = 0.2;
  return s;
}

describe('M8 drawBattle 冒烟', () => {
  it('wave 态基础绘制（四类敌人小人 + HUD）不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('受击/飘字/幽灵/屏震活跃态绘制不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    const now = battleFx.tick(0);
    battleFx.consume([
      { type: 'hit', x: 200, y: 300, dmg: 12, crit: true, enemyId: s.enemies[0].id, enemyType: 'bing' },
    ], s, 1000);
    battleFx.update(30);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('kill 后死亡幽灵 + 溅墨绘制不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    battleFx.consume([
      { type: 'kill', x: 200, y: 300, dmg: 60, crit: false, enemyId: s.enemies[0].id, enemyType: 'bing', cause: 'direct' },
    ], s, 1000);
    battleFx.update(100);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('Boss 卷轴演出中绘制不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    cinePush({ kind: 'bossScroll', dur: 800, data: { title: '曹仁' } });
    cinePush({ kind: 'bossKill', dur: 400, data: { x: 360, y: 500, type: 'shuai' } });
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('大招演出各时段绘制不炸（四分镜全覆盖）', () => {
    const s = stagedBattle();
    s.slots[0] = { id: 1, type: 'jice', tier: 1 };
    s.slots[1] = { id: 2, type: 'jice', tier: 1 };
    battleFx.tick(16);
    for (const t of [0.2, 0.8, 1.4, 1.9, 2.5]) {
      s.ult = { t };
      expect(() => drawBattle(makeCtx(), s)).not.toThrow();
    }
    s.ult = null;
  });

  it('skillPick / interval / victory / over 各 stage 绘制不炸', () => {
    const ctx = makeCtx();
    const s = stagedBattle();
    battleFx.tick(16);
    s.stage = 'skillPick';
    s.pickChoices = ['crit', 'atk', 'range'];
    expect(() => drawBattle(ctx, s)).not.toThrow();
    for (const st of ['interval', 'victory', 'over']) {
      s.stage = st;
      expect(() => drawBattle(ctx, s)).not.toThrow();
    }
  });

  it('双皮肤（皮影）全链路不炸', () => {
    setSkin('shadow');
    const s = stagedBattle();
    battleFx.tick(16);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });
});
