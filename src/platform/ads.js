// src/platform/ads.js — 激励视频广告适配器（M4 桩模式定案）
// 三分支：
//   1) wx + 已配置 adUnitId → 真实激励视频（M5 在微信后台开通流量主后填 ID 即生效）
//   2) wx + 无 adUnitId → 桩：模拟观看 800ms 后发放（真机可走通全流程）
//   3) H5 → 桩：同步直发（M3 行为保持，回归零风险）
const AD_UNITS = {
  freePull: '', // 免费抽卡
  double: '',   // 结算奖励翻倍
  revive: '',   // 复活继续（M5 接入点位）
  skin: '',     // 皮影皮肤解锁（M5）
  signin: '',   // 每日签到（M5）
};
const MOCK_WATCH_MS = 800;
const instances = {}; // placement → RewardedVideoAd 单例复用

// 测试注入钩子（生产不调用）
export function __setAdUnits(patch) { Object.assign(AD_UNITS, patch); }

export function adEnv(placement) {
  if (typeof wx === 'undefined' || typeof wx.createRewardedVideoAd !== 'function') return 'h5-stub';
  return AD_UNITS[placement] ? 'wx-real' : 'wx-stub';
}

export function showRewarded(placement, { onReward, onFail } = {}) {
  const env = adEnv(placement);
  if (env === 'h5-stub') { onReward(); return; }
  if (env === 'wx-stub') { setTimeout(onReward, MOCK_WATCH_MS); return; }
  showRealAd(placement, { onReward, onFail });
}

function showRealAd(placement, { onReward, onFail }) {
  let ad = instances[placement];
  if (!ad) {
    ad = wx.createRewardedVideoAd({ adUnitId: AD_UNITS[placement] });
    instances[placement] = ad;
  }
  const onClose = (res) => {
    ad.offClose(onClose);
    if (res && res.isEnded) onReward();
    else if (onFail) onFail();
  };
  ad.onClose(onClose);
  ad.show().catch(() =>
    ad.load().then(() => ad.show()).catch(() => {
      ad.offClose(onClose);
      if (onFail) onFail();
    })
  );
}
