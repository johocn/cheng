// tests/m7-audio.test.js — M7 音频：合成调度（mock AudioContext）+ 开关状态机 + 文件通道
import { describe, it, expect, vi, afterEach } from 'vitest';
import { initAudio, sfx, bgmStart, bgmStop, setSoundMode, soundModeCycle, AUDIO_FILES } from '../src/platform/audio.js';

// mock ctx：比计划基线多补 oscillator.frequency 的 setValueAtTime/exponentialRampToValueAtTime，
// 使 tone/pluck 的调度代码真实走通（而非被 try/catch 吞掉），节点计数才有断言意义
function mockCtx() {
  const nodes = [];
  return {
    nodes,
    currentTime: 0,
    destination: {},
    createOscillator() {
      const o = {
        type: '',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      };
      nodes.push(o); return o;
    },
    createGain() {
      const g = {
        gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
      };
      nodes.push(g); return g;
    },
  };
}

afterEach(() => {
  bgmStop(); // 清理 BGM 调度器，防止用例间定时器泄漏
  initAudio(null);
  setSoundMode({ settings: { sound: true, bgm: true } });
});

describe('M7 音频', () => {
  it('未初始化/失败时 sfx 静默 no-op 不炸', () => {
    expect(() => sfx('click')).not.toThrow();
    initAudio(() => { throw new Error('no audio'); });
    expect(() => sfx('ult')).not.toThrow();
  });
  it('初始化后 sfx 调度 oscillator/gain；sound=false 时不调度', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: false } });
    const n0 = ctx.nodes.length;
    sfx('click');
    expect(ctx.nodes.length).toBeGreaterThan(n0);
    setSoundMode({ settings: { sound: false, bgm: false } });
    const n1 = ctx.nodes.length;
    sfx('coin');
    expect(ctx.nodes.length).toBe(n1); // 静音不调度
  });
  it('8 个音效名全部可触发', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: true } });
    for (const name of ['click', 'attack', 'ult', 'skill', 'coin', 'compose', 'win', 'lose']) {
      expect(() => sfx(name)).not.toThrow();
    }
  });
  it('未知音效名安全忽略，不调度节点', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: true } });
    const n0 = ctx.nodes.length;
    sfx('not_a_sfx');
    expect(ctx.nodes.length).toBe(n0);
  });
  it('开关三态循环：全开→仅音效→全关→全开', () => {
    expect(soundModeCycle({ sound: true, bgm: true })).toEqual({ sound: true, bgm: false });
    expect(soundModeCycle({ sound: true, bgm: false })).toEqual({ sound: false, bgm: false });
    expect(soundModeCycle({ sound: false, bgm: false })).toEqual({ sound: true, bgm: true });
  });
  it('BGM：开启时调度音符循环，关闭停止；AUDIO_FILES.bgm 缺省 null', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: true } });
    expect(() => bgmStart()).not.toThrow();
    expect(() => bgmStop()).not.toThrow();
    expect(AUDIO_FILES.bgm).toBeNull();
  });
  it('BGM 合成调度：重复 bgmStart 去重不叠加调度器；bgmStop 后停止推进', () => {
    vi.useFakeTimers();
    try {
      const ctx = mockCtx();
      initAudio(() => ctx);
      setSoundMode({ settings: { sound: true, bgm: true } });
      const n0 = ctx.nodes.length;
      bgmStart();
      bgmStart(); // bgmTimer 守卫：第二次调用必须 no-op
      // 首 tick（step 0）：旋律 pluck 3 泛音 + 低音宫 pluck 3 泛音 = 6 osc + 6 gain
      expect(ctx.nodes.length).toBe(n0 + 12);
      vi.advanceTimersByTime(420); // 一个八分音符节拍（60/72/2 ≈ 416.7ms）
      // 仅一条调度链推进：step 1 单 pluck = 6 节点（若叠加调度器会是 12）
      expect(ctx.nodes.length).toBe(n0 + 18);
      bgmStop();
      vi.advanceTimersByTime(2000);
      expect(ctx.nodes.length).toBe(n0 + 18); // 停止后不再调度
    } finally {
      bgmStop();
      vi.useRealTimers();
    }
  });
  it('BGM 关闭时 bgmStart 不启动调度器（bgm=false 守卫）', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: false } });
    const n0 = ctx.nodes.length;
    bgmStart();
    expect(ctx.nodes.length).toBe(n0);
  });
});
