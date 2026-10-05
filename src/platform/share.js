// platform/share.js — M7 分享：wx 主动分享 / H5 剪贴板降级
// 平台能力走全局对象探测（测试 mock globalThis.wx / navigator 即可，同 audio 的注入降级模式）
export async function shareApp({ title, query = '' }) {
  if (typeof wx !== 'undefined' && wx.shareAppMessage) {
    wx.shareAppMessage({ title, query });
    return 'shared';
  }
  // H5 降级：剪贴板复制（execCommand 兜底老浏览器；无 DOM 环境按已复制处理）
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(title);
    } else if (typeof document !== 'undefined') {
      const ta = document.createElement('textarea');
      ta.value = title;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    return 'copied';
  } catch {
    return 'failed';
  }
}
