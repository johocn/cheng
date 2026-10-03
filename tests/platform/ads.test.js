// tests/platform/ads.test.js — 激励视频适配器三分支
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showRewarded, adEnv } from '../../src/platform/ads.js';

const realWx = globalThis.wx;

afterEach(() => {
  if (realWx === undefined) delete globalThis.wx;
  else globalThis.wx = realWx;
  vi.useRealTimers();
});

describe('platform/ads 激励视频适配器', () => {
  it('H5 环境：直发回调（M3 行为，同步）', () => {
    delete globalThis.wx;
    expect(adEnv('double')).toBe('h5-stub');
    const onReward = vi.fn();
    showRewarded('double', { onReward });
    expect(onReward).toHaveBeenCalledTimes(1); // 同步到达
  });

  it('wx 环境 + 无 adUnitId：桩模式 800ms 后发放', () => {
    vi.useFakeTimers();
    globalThis.wx = { createRewardedVideoAd: vi.fn() };
    expect(adEnv('freePull')).toBe('wx-stub');
    const onReward = vi.fn();
    showRewarded('freePull', { onReward });
    expect(onReward).not.toHaveBeenCalled();
    vi.advanceTimersByTime(799);
    expect(onReward).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onReward).toHaveBeenCalledTimes(1);
  });

  it('wx 环境 + 有 adUnitId：真实激励视频，看完（isEnded）发奖', async () => {
    const handlers = {};
    const ad = {
      onClose: vi.fn((cb) => { handlers.close = cb; }),
      offClose: vi.fn(),
      show: vi.fn(() => Promise.resolve()),
      load: vi.fn(() => Promise.resolve()),
    };
    globalThis.wx = { createRewardedVideoAd: vi.fn(() => ad) };
    // ads.js 内部从 placement 表取 id；测试直接注入配置
    const { __setAdUnits } = await import('../../src/platform/ads.js');
    __setAdUnits({ double: 'adunit-xxx' });
    expect(adEnv('double')).toBe('wx-real');
    const onReward = vi.fn(); const onFail = vi.fn();
    showRewarded('double', { onReward, onFail });
    await vi.waitFor(() => expect(ad.show).toHaveBeenCalledTimes(1));
    handlers.close({ isEnded: true });
    expect(onReward).toHaveBeenCalledTimes(1);
    expect(onFail).not.toHaveBeenCalled();
    __setAdUnits({ double: '' }); // 还原桩，避免污染其他用例
  });

  it('wx 真实广告：中途退出（isEnded=false）走 onFail 不发奖', async () => {
    const handlers = {};
    const ad = {
      onClose: vi.fn((cb) => { handlers.close = cb; }),
      offClose: vi.fn(),
      show: vi.fn(() => Promise.resolve()),
      load: vi.fn(() => Promise.resolve()),
    };
    globalThis.wx = { createRewardedVideoAd: vi.fn(() => ad) };
    // instances 按 placement 单例缓存，真实广告用例各用不同点位避免串扰
    const { __setAdUnits } = await import('../../src/platform/ads.js');
    __setAdUnits({ revive: 'adunit-xxx' });
    const onReward = vi.fn(); const onFail = vi.fn();
    showRewarded('revive', { onReward, onFail });
    await vi.waitFor(() => expect(ad.show).toHaveBeenCalledTimes(1));
    handlers.close({ isEnded: false });
    expect(onReward).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledTimes(1);
    __setAdUnits({ revive: '' });
  });

  it('wx 真实广告：show 失败 → load 重试 → 再失败走 onFail', async () => {
    const ad = {
      onClose: vi.fn(), offClose: vi.fn(),
      show: vi.fn(() => Promise.reject(new Error('no ad'))),
      load: vi.fn(() => Promise.reject(new Error('load fail'))),
    };
    globalThis.wx = { createRewardedVideoAd: vi.fn(() => ad) };
    const { __setAdUnits } = await import('../../src/platform/ads.js');
    __setAdUnits({ skin: 'adunit-xxx' });
    const onReward = vi.fn(); const onFail = vi.fn();
    showRewarded('skin', { onReward, onFail });
    await vi.waitFor(() => expect(onFail).toHaveBeenCalledTimes(1));
    expect(ad.load).toHaveBeenCalledTimes(1);
    expect(onReward).not.toHaveBeenCalled();
    __setAdUnits({ skin: '' });
  });
});
