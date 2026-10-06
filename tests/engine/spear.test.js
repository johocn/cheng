// tests/engine/spear.test.js — M11 枪意四档/箭意三档：档位纯函数 + heroAttack 双形态
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { spearStageOf, bowStageOf } from '../../src/engine/spear.js';
import { heroAttack } from '../../src/engine/hero.js';
import { pathPoint } from '../../src/engine/enemy.js';
import { HERO_POS, SPEAR_STAGES, BOW_STAGES, BOW_RANGE } from '../../src/engine/config.js';

// 二分找 lane 上距英雄 dist 的 t（避免手算折线长度误差；路径距英雄单调递减，dist 偏大→t 偏小）
function tAtDist(lane, dist) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p = pathPoint(lane, mid);
    if (Math.hypot(p.x - HERO_POS.x, p.y - HERO_POS.y) > dist) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function makeState(wave) {
  return {
    enemies: [], nextEnemyId: 1, frameEvents: [],
    hero: { atkCooldown: 0 },
    heroStat: { atk: 60, atkInterval: 0.75, atkRange: 180, crit: 0, slowOnHit: false, chain: 0 },
    wave, rng: null, atkBuffT: 0,
  };
}
function addEnemy(s, lane, t, hp = 999) {
  const e = { id: s.nextEnemyId++, lane, t, hp, hpMax: hp, type: 'bing' };
  s.enemies.push(e);
  return e;
}
const heroAtkEv = (s) => s.frameEvents.find((ev) => ev.type === 'heroAtk');

describe('M11 档位纯函数', () => {
  it('spearStageOf：w1/4→壹 w5→贰 w9→叁 w13/15→肆', () => {
    expect(spearStageOf(1)).toBe(0);
    expect(spearStageOf(4)).toBe(0);
    expect(spearStageOf(5)).toBe(1);
    expect(spearStageOf(9)).toBe(2);
    expect(spearStageOf(13)).toBe(3);
    expect(spearStageOf(15)).toBe(3);
  });
  it('bowStageOf：w1→穿云 w4→穿云 w5→连珠 w9/15→箭雨', () => {
    expect(bowStageOf(1)).toBe(0);
    expect(bowStageOf(4)).toBe(0);
    expect(bowStageOf(5)).toBe(1);
    expect(bowStageOf(9)).toBe(2);
    expect(bowStageOf(15)).toBe(2);
  });
  it('config 数值定稿核对', () => {
    expect(SPEAR_STAGES.map((s) => s.bonus)).toEqual([0, 30, 60, 90]);
    expect(SPEAR_STAGES.map((s) => s.wave)).toEqual([1, 5, 9, 13]);
    expect(BOW_RANGE).toBe(320);
    expect(BOW_STAGES[0].mul).toBeCloseTo(1.2);
    expect(BOW_STAGES[1].splash).toEqual({ r: 70, mul: 0.5 });
    expect(BOW_STAGES[2].mul).toBeCloseTo(0.7);
    expect(BOW_STAGES[2].splash).toEqual({ r: 110, mul: 0.35 });
  });
});

describe('M11 枪：档位范围增量', () => {
  it('w1 基线：195px 环带敌由弓出手（1.2×）；w5（+30）同位置切枪（1.0×）', () => {
    const s1 = makeState(1);
    addEnemy(s1, 0, tAtDist(0, 195)); // lane0: dist=680×(1-t) 线性
    heroAttack(s1, 0.1);
    expect(heroAtkEv(s1).mode).toBe('bow'); // 枪圈外 → 弓
    expect(s1.enemies[0].hp).toBe(927);     // 999-72
    const s5 = makeState(5);
    addEnemy(s5, 0, tAtDist(0, 195));
    heroAttack(s5, 0.1);
    expect(heroAtkEv(s5).mode).toBe('spear'); // 195 ≤ 210 切枪
    expect(s5.enemies[0].hp).toBe(939);       // 60×1.0
    expect(heroAtkEv(s5).stage).toBe(1);
    expect(heroAtkEv(s5).range).toBe(210);    // 180+30
  });
  it('w9：range=240 事件携带；w13：range=270', () => {
    const s9 = makeState(9);
    addEnemy(s9, 0, tAtDist(0, 100));
    heroAttack(s9, 0.1);
    expect(heroAtkEv(s9).range).toBe(240);
    expect(heroAtkEv(s9).stage).toBe(2);
    const s13 = makeState(13);
    addEnemy(s13, 0, tAtDist(0, 100));
    heroAttack(s13, 0.1);
    expect(heroAtkEv(s13).range).toBe(270);
    expect(heroAtkEv(s13).stage).toBe(3);
  });
  it('range 技能乘区与档位增量叠加：atkRange=234（180×1.3）时 w9 → 294', () => {
    const s = makeState(9);
    s.heroStat.atkRange = 234;
    addEnemy(s, 0, tAtDist(0, 280));
    heroAttack(s, 0.1);
    expect(s.enemies[0].hp).toBe(939); // 280 ≤ 294 打到
    expect(heroAtkEv(s).range).toBe(294);
  });
});

describe('M11 弓：枪圈外自动双形态', () => {
  it('w1 穿云箭：320 内最近单敌 1.2×（72），heroAtk mode=bow splash=null', () => {
    const s = makeState(1);
    const e = addEnemy(s, 1, tAtDist(1, 250));
    heroAttack(s, 0.1);
    expect(e.hp).toBe(927); // 999-72
    const ev = heroAtkEv(s);
    expect(ev.mode).toBe('bow');
    expect(ev.stage).toBe(0);
    expect(ev.splash).toBe(null);
    expect(ev.range).toBe(320);
    expect(s.hero.atkCooldown).toBe(0.75); // 弓共用攻速节拍
  });
  it('枪圈内敌优先用枪，弓不触发', () => {
    const s = makeState(1);
    addEnemy(s, 0, tAtDist(0, 100)); // 圈内
    heroAttack(s, 0.1);
    expect(heroAtkEv(s).mode).toBe('spear');
  });
  it('枪圈内优先：圈内有敌时枪出手（圈内掉血），圈外敌留给弓下一轮', () => {
    const s = makeState(1);
    const inR = addEnemy(s, 0, tAtDist(0, 100));
    const outR = addEnemy(s, 0, tAtDist(0, 250));
    heroAttack(s, 0.1);
    expect(inR.hp).toBe(939);      // 枪 1.0× 打圈内
    expect(outR.hp).toBe(999);     // 弓等待
    expect(heroAtkEv(s).mode).toBe('spear');
  });
  it('w5 连珠箭：主 0.8×（48）+ 溅射 70 内 0.5×（30），溅射外不掉', () => {
    const s = makeState(5);
    const main = addEnemy(s, 0, tAtDist(0, 245)); // 枪程 210 外 → 弓主目标
    const near = addEnemy(s, 0, tAtDist(0, 250)); // 距主 5 < 70 溅到
    const far = addEnemy(s, 0, tAtDist(0, 320));  // 距主 75 > 70 溅不到
    heroAttack(s, 0.1);
    expect(main.hp).toBe(951);  // 999-48
    expect(near.hp).toBe(969);  // 999-30
    expect(far.hp).toBe(999);
    const ev = heroAtkEv(s);
    expect(ev.stage).toBe(1);
    expect(ev.splash).toEqual({ x: expect.any(Number), y: expect.any(Number), r: 70 });
  });
  it('w9 箭雨：主 0.7×（42）+ 溅射 110 内 0.35×（21）', () => {
    const s = makeState(9);
    const main = addEnemy(s, 0, tAtDist(0, 245)); // 枪程 240 外 → 弓
    const near = addEnemy(s, 0, tAtDist(0, 250)); // 距主 5 < 110
    const far = addEnemy(s, 0, tAtDist(0, 365));  // 距主 120 > 110
    heroAttack(s, 0.1);
    expect(main.hp).toBe(957); // 999-42
    expect(near.hp).toBe(978); // 999-21
    expect(far.hp).toBe(999);
    expect(heroAtkEv(s).stage).toBe(2);
    expect(heroAtkEv(s).splash.r).toBe(110);
  });
  it('320 外无目标：弓也不出手，冷却不消耗', () => {
    const s = makeState(1);
    addEnemy(s, 1, tAtDist(1, 400));
    heroAttack(s, 0.1);
    expect(heroAtkEv(s)).toBeUndefined();
    expect(s.hero.atkCooldown).toBe(0);
  });
  it('advanceFrame 纯函数契约：枪箭两形态都不变异入参', () => {
    const s = createBattle(11);
    s.wave = 5;
    const snap = JSON.stringify(s);
    advanceFrame(s, null, 16.667);
    expect(JSON.stringify(s)).toBe(snap);
  });
});
