// tests/render/atkSfx.test.js — M12 出手音接线：battleFx.consume heroAtk 分支 → sfx(档位音名, 1/speed)
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../src/platform/audio.js', () => ({ sfx: vi.fn() }));
import { sfx } from '../../src/platform/audio.js';
import { consume, reset, setSpeed } from '../../src/render/battleFx.js';

const atkEv = (mode, stage) => ({
  type: 'heroAtk', mode, stage, ang: -0.6, x: 470, y: 470, range: 240, splash: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  setSpeed(1);
});

describe('M12 heroAtk → 出手音', () => {
  it('spear stage2 → sfx("spear3", 1)', () => {
    consume([atkEv('spear', 2)], {}, 1000);
    expect(sfx).toHaveBeenCalledWith('spear3', 1);
  });
  it('bow stage0 → sfx("bow1", 1)', () => {
    consume([atkEv('bow', 0)], {}, 1000);
    expect(sfx).toHaveBeenCalledWith('bow1', 1);
  });
  it('bow stage2 → sfx("bow3", 1)（齐射三声在配方内排程）', () => {
    consume([atkEv('bow', 2)], {}, 1000);
    expect(sfx).toHaveBeenCalledWith('bow3', 1);
  });
  it('快进 speed=4 → sc=0.25', () => {
    setSpeed(4);
    consume([atkEv('spear', 0)], {}, 1000);
    expect(sfx).toHaveBeenCalledWith('spear1', 0.25);
  });
  it('hit/kill 等其他事件不触发出手音名', () => {
    consume([
      { type: 'hit', x: 0, y: 0, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing' },
      { type: 'kill', x: 0, y: 0, dmg: 5, crit: false, enemyId: 2, enemyType: 'bing', cause: 'direct' },
      { type: 'leak', x: 360, y: 640, dmg: 1, crit: false, enemyId: null, enemyType: 'bing' },
    ], { enemies: [] }, 1000);
    const names = sfx.mock.calls.map((c) => c[0]);
    expect(names).not.toContain('spear1');
    expect(names).not.toContain('bow1');
    expect(names).toContain('hit'); // 受击音照旧
  });
  it('stage 溢出防护：bow stage=5 → bow3', () => {
    consume([atkEv('bow', 5)], {}, 1000);
    expect(sfx).toHaveBeenCalledWith('bow3', 1);
  });
});
