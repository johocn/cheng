// tests/engine/clone.test.js — deepClone 纯函数深拷贝（wx 小游戏无 structuredClone 的引擎层替代）
import { describe, it, expect } from 'vitest';
import { deepClone } from '../../src/engine/clone.js';
import { createRng, rngNext } from '../../src/engine/rng.js';

describe('deepClone', () => {
  it('原始值与特殊值直返（NaN/Infinity/undefined/null/负零）', () => {
    expect(deepClone(0)).toBe(0);
    expect(deepClone(NaN)).toBeNaN();
    expect(deepClone(Infinity)).toBe(Infinity);
    expect(deepClone(undefined)).toBeUndefined();
    expect(deepClone(null)).toBeNull();
    expect(deepClone('txt')).toBe('txt');
    expect(deepClone(-0)).toBe(-0);
    expect(deepClone(true)).toBe(true);
  });

  it('嵌套对象与数组深拷贝且相互独立', () => {
    const src = { a: { b: { c: 1 } }, arr: [{ x: 2 }, [3, { y: 4 }]] };
    const cp = deepClone(src);
    expect(cp).toEqual(src);
    cp.a.b.c = 99;
    cp.arr[0].x = 99;
    cp.arr[1][1].y = 99;
    cp.arr.push('new');
    expect(src.a.b.c).toBe(1);
    expect(src.arr[0].x).toBe(2);
    expect(src.arr[1][1].y).toBe(4);
    expect(src.arr.length).toBe(2);
  });

  it('Date/Map/Set 等价克隆且独立', () => {
    const d = new Date('2026-10-06T00:00:00Z');
    const m = new Map([['k', { v: 1 }]]);
    const s = new Set([1, { z: 2 }]);
    const cp = deepClone({ d, m, s });
    expect(cp.d.getTime()).toBe(d.getTime());
    expect(cp.m).toEqual(m); // 先断言克隆等价
    expect(cp.s).toEqual(s);
    cp.m.get('k').v = 9; // 再改克隆验证独立
    cp.s.add('new');
    expect(m.get('k').v).toBe(1);
    expect(s.size).toBe(2);
  });

  it('战斗 state 形状克隆后 rng 推进互不影响（advanceFrame 同构场景）', () => {
    const state = {
      stage: 'wave', wave: 10, frame: 0, hp: 15, hpMax: 15,
      rng: createRng(42),
      enemies: [{ id: 1, type: 'bing', hp: 100, path: [{ x: 1, y: 2 }] }],
      spawnQueue: [{ at: 0.5, type: 'bing', lane: 0, mul: 1, chMul: 1, hpMul: 1, affix: null }],
      heroStat: { atk: 60, hpMax: 15 },
    };
    const work = deepClone(state);
    expect(work).toEqual(state);
    const a1 = rngNext(state.rng), a2 = rngNext(work.rng);
    expect(a1).toBe(a2); // 起点同 seed，首次推进同值
    rngNext(work.rng);
    expect(state.rng.s).not.toBe(work.rng.s); // 后续推进各自独立
    work.enemies[0].hp = 0;
    work.frame = 999;
    expect(state.enemies[0].hp).toBe(100);
    expect(state.frame).toBe(0);
  });
});
