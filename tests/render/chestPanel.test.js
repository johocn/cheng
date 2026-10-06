// tests/render/chestPanel.test.js — M10 宝箱三选一面板：标题/卡名/提示 + 卡坐标常量（与 hitBattle 同源）+ 宝箱微浮确定性
import { describe, it, expect } from 'vitest';
import { drawChestPick, CHEST_CARDS } from '../../src/render/battle.js';
import { CHEST_REWARDS } from '../../src/engine/config.js';
import '../../src/render/art.js'; // 注册 globalThis.Art（drawPanel/roundRect/C 色板）

// Proxy mock ctx：渐变/measureText 特判（drawPanel/卡片用），其余记录调用
function makeCtx() {
  const calls = [];
  return new Proxy({}, {
    get(t, k) {
      if (k === '__calls') return calls;
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return (...a) => {
          calls.push({ fn: k, args: a });
          return { addColorStop: (...b) => calls.push({ fn: 'addColorStop', args: b }) };
        };
      }
      if (k === 'measureText') {
        return (s) => ({ width: String(s).length * 14 });
      }
      return (...a) => { calls.push({ fn: k, args: a }); };
    },
    set(t, k, v) { calls.push({ set: k, val: v }); return true; },
  });
}
const texts = (ctx) => ctx.__calls.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);

function chestState(choices, frame = 0) {
  return { stage: 'chestPick', chestChoices: choices, frame };
}

describe('M10 drawChestPick：绘制门槛与文案', () => {
  it('非 chestPick 或未 roll → 不画', () => {
    let ctx = makeCtx();
    drawChestPick(ctx, { stage: 'wave', chestChoices: null });
    expect(ctx.__calls.filter((c) => c.fn === 'fillText')).toHaveLength(0);
    ctx = makeCtx();
    drawChestPick(ctx, { stage: 'chestPick', chestChoices: null });
    expect(ctx.__calls.filter((c) => c.fn === 'fillText')).toHaveLength(0);
  });

  it('chestPick 态：标题「战 前 犒 赏」+ 提示语 + 三卡名（chestChoices→CHEST_REWARDS 映射）', () => {
    const ctx = makeCtx();
    drawChestPick(ctx, chestState(['gold', 'troops', 'items']));
    const t = texts(ctx);
    expect(t).toContain('战 前 犒 赏');
    expect(t.some((x) => String(x).includes('点选犒赏'))).toBe(true);
    expect(t).toContain(CHEST_REWARDS.find((r) => r.id === 'gold').name);
    expect(t).toContain(CHEST_REWARDS.find((r) => r.id === 'troops').name);
    expect(t).toContain(CHEST_REWARDS.find((r) => r.id === 'items').name);
  });

  it('卡描述随卡绘制（desc 上卡面）', () => {
    const ctx = makeCtx();
    drawChestPick(ctx, chestState(['shield', 'edge', 'gold']));
    expect(texts(ctx)).toContain(CHEST_REWARDS.find((r) => r.id === 'shield').desc);
  });
});

describe('M10 CHEST_CARDS 常量：与 core.hitBattle 坐标同源', () => {
  it('三卡区域与兵法三择同构：x0=72 step=200 176×252，y=320（宝箱占上段）', () => {
    expect(CHEST_CARDS).toEqual({ x0: 72, step: 200, y: 320, w: 176, h: 252 });
  });
});

describe('M10 宝箱微浮：frame 驱动确定性', () => {
  it('同 frame 两次绘制文本序列一致；不同 frame translate 不同（有浮动）', () => {
    const st = chestState(['gold', 'troops', 'items'], 42);
    const c1 = makeCtx();
    drawChestPick(c1, st);
    const c2 = makeCtx();
    drawChestPick(c2, st);
    expect(texts(c1)).toEqual(texts(c2));

    const c3 = makeCtx();
    drawChestPick(c3, chestState(['gold', 'troops', 'items'], 42 + 15));
    const tr = (c) => c.__calls.filter((x) => x.fn === 'translate').map((x) => x.args);
    expect(JSON.stringify(tr(c1))).not.toBe(JSON.stringify(tr(c3)));
  });
});
