// tests/render/cinematic.test.js — M8 演出队列状态机（核心；绘制 Task 8 补）
import { describe, it, expect, beforeEach } from 'vitest';
import { push, active, update, reset, QUEUE_MAX, drawCinematic, DUR_SCROLL, DUR_KILL } from '../../src/render/cinematic.js';
import '../../src/render/art.js';

beforeEach(() => reset());

describe('M8 cinematic 队列', () => {
  it('push 后 active 返回队首', () => {
    push({ kind: 'bossScroll', dur: 800, data: { title: '曹仁' } });
    const cur = active();
    expect(cur.kind).toBe('bossScroll');
    expect(cur.t).toBe(0);
  });

  it('update 推进 t，到 dur 出队', () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    update(200);
    expect(active().t).toBe(200);
    update(200);
    expect(active()).toBeNull(); // 播完出队
  });

  it('串行独占：前一演完才推进后一', () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossScroll', dur: 800, data: {} });
    update(400);
    expect(active().kind).toBe('bossScroll'); // 前一出队，后者成为队首
    expect(active().t).toBe(0);
  });

  it(`队列上限 ${QUEUE_MAX}：超出丢弃（防积压）`, () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} }); // 丢弃
    reset();
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} });
    expect(active().kind).toBe('bossKill');
    update(1200); // 两个 400 播完
    expect(active()).toBeNull();
  });

  it('reset 清空', () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    reset();
    expect(active()).toBeNull();
  });
});

// ===== Task 8 追加：绘制冒烟 =====
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

describe('M8 演出绘制', () => {
  it('无演出时 drawCinematic 直接返回不画', () => {
    expect(() => drawCinematic(makeCtx())).not.toThrow();
  });

  it('Boss 卷轴各阶段（展开/停留/收起）绘制不炸', () => {
    push({ kind: 'bossScroll', dur: DUR_SCROLL, data: { title: '曹仁' } });
    const ctx = makeCtx();
    for (const t of [100, 400, 700]) { // 展开/停留/收起
      update(100);
      expect(() => drawCinematic(ctx)).not.toThrow();
    }
  });

  it('斩杀慢镜各阶段绘制不炸（含大印与墨点飞散）', () => {
    push({ kind: 'bossKill', dur: DUR_KILL, data: { x: 360, y: 500, type: 'shuai' } });
    const ctx = makeCtx();
    for (const t of [50, 200, 380]) {
      update(50);
      expect(() => drawCinematic(ctx)).not.toThrow();
    }
  });

  it('时序常量符合 spec（卷轴 800ms / 慢镜 400ms）', () => {
    expect(DUR_SCROLL).toBe(800);
    expect(DUR_KILL).toBe(400);
  });
});
