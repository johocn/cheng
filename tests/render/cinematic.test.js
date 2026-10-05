// tests/render/cinematic.test.js — M8 演出队列状态机（核心；绘制 Task 8 补）
import { describe, it, expect, beforeEach } from 'vitest';
import { push, active, update, reset, QUEUE_MAX } from '../../src/render/cinematic.js';

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
