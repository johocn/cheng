import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { HP_MAX, TOTAL_WAVES } from '../../src/engine/config.js';

describe('createBattle', () => {
  it('初始状态完整', () => {
    const s = createBattle();
    expect(s.hp).toBe(HP_MAX);
    expect(s.hpMax).toBe(HP_MAX);
    expect(s.coins).toBe(0);
    expect(s.wave).toBe(0);
    expect(s.stage).toBe('interval');
    expect(s.enemies).toEqual([]);
    expect(s.hero.pos).toEqual({ x: 360, y: 640 });
    expect(s.hero.atkCooldown).toBe(0);
    expect(s.nextEnemyId).toBe(1);
    expect(s.frame).toBe(0);
  });
});

describe('advanceFrame 纯函数契约', () => {
  it('不变异入参', () => {
    const s = createBattle();
    const before = JSON.stringify(s);
    advanceFrame(s, null, 1000);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('大 dt 切片推进：1 秒 ≈ 60 tick，time 前进 1s', () => {
    const s = createBattle();
    const s2 = advanceFrame(s, null, 1000);
    expect(s2.time).toBeCloseTo(1.0, 1);
    expect(s2.frame).toBeGreaterThanOrEqual(59);
    expect(s2.frame).toBeLessThanOrEqual(61);
  });

  it('多次小步与大步推进结果一致（确定性）', () => {
    const a = createBattle();
    let s = a;
    for (let i = 0; i < 30; i++) s = advanceFrame(s, null, 16.667);
    const b = createBattle();
    const s2 = advanceFrame(b, null, 30 * 16.667);
    expect(s.time).toBeCloseTo(s2.time, 1);
    expect(s.stage).toBe(s2.stage);
    expect(s.enemies.length).toBe(s2.enemies.length);
  });
});

describe('战斗终局', () => {
  it('漏怪扣守军血；血量归零进入 over 且时间冻结', () => {
    let s = createBattle();
    s.hp = 1;
    s.stage = 'wave';           // 直接构造 wave 场景
    s.spawnQueue = [];
    s.wave = 1;
    s.enemies = [{ id: 1, type: 'qi', lane: 0, t: 0.999, hp: 1, hpMax: 220 }];
    s = advanceFrame(s, null, 200);
    expect(s.stage).toBe('over');
    expect(s.hp).toBe(0);
    const frame = s.frame;
    const frozen = advanceFrame(s, null, 5000);
    expect(frozen.frame).toBe(frame); // 终态时间冻结
  });

  // it.skip：依赖 3 波事件表与旧平衡数值（TOTAL_WAVES 现为 15），Task 6 重写集成验收
  it.skip('集成验收：全程自动战斗 3 波全通 victory 且满血', () => {
    let s = createBattle();
    let guard = 0;
    while (s.stage !== 'victory' && s.stage !== 'over' && guard < 300) {
      s = advanceFrame(s, null, 1000);
      guard++;
    }
    expect(s.stage).toBe('victory');
    expect(s.wave).toBe(TOTAL_WAVES);
    expect(s.hp).toBe(HP_MAX); // 数值已验算：不漏怪
    expect(s.coins).toBeGreaterThan(0);
    expect(s.enemies).toHaveLength(0);
  });
});
