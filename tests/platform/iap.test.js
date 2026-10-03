// tests/platform/iap.test.js — 支付桩三分支（node 环境 = h5-stub 同步成功）
import { describe, it, expect, vi } from 'vitest';
import { payEnv, purchase } from '../../src/platform/iap.js';

describe('platform/iap 支付桩', () => {
  it('node 环境为 h5-stub', () => {
    expect(payEnv()).toBe('h5-stub');
  });
  it('桩模式同步成功回调', () => {
    const ok = vi.fn(), fail = vi.fn();
    purchase('firstCharge', { onSuccess: ok, onFail: fail });
    expect(ok).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();
  });
});
