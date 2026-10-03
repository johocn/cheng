// src/platform/iap.js — 内购支付通道适配器（M5 桩模式，与 ads.js 三分支同构）
// 1) wx + IAP_PARAMS 已配置（正式商户上线后填入）→ wx.requestPayment 真实支付
// 2) wx + 未配置 → 桩：模拟支付 800ms 成功（真机走通全流程）
// 3) H5 → 桩：同步成功
const MOCK_PAY_MS = 800;
// 上线前由服务端统一下单后填入：{ timeStamp, nonceStr, package, signType, paySign }
const IAP_PARAMS = null;

export function payEnv() {
  if (typeof wx === 'undefined' || typeof wx.requestPayment !== 'function') return 'h5-stub';
  return IAP_PARAMS ? 'wx-real' : 'wx-stub';
}

export function purchase(skuId, { onSuccess, onFail } = {}) {
  const env = payEnv();
  if (env === 'h5-stub') { onSuccess(); return; }
  if (env === 'wx-stub') { setTimeout(onSuccess, MOCK_PAY_MS); return; }
  wx.requestPayment({
    ...IAP_PARAMS,
    success: onSuccess,
    fail: onFail,
  });
}
