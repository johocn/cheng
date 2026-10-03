// platform/img.js — 图片加载同构抽象：H5 new Image / wx wx.createImage
// 失败/未就绪一律 ready:false，渲染层据此回退楷体圆牌（spec 10.2 降级零风险）
const cache = new Map();

export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const handle = { img: null, ready: false, failed: false };
  try {
    if (typeof wx !== 'undefined' && wx.createImage) {
      handle.img = wx.createImage();
      handle.img.onload = () => { handle.ready = true; };
      handle.img.onerror = () => { handle.failed = true; };
      handle.img.src = src;
    } else if (typeof Image !== 'undefined') {
      handle.img = new Image();
      handle.img.onload = () => { handle.ready = true; };
      handle.img.onerror = () => { handle.failed = true; };
      handle.img.src = src;
    } else {
      handle.failed = true; // node 测试环境：哑句柄
    }
  } catch {
    handle.failed = true;
  }
  cache.set(src, handle);
  return handle;
}

export function portraitReady(h) { return !!h && h.ready && !!h.img; }

// 预热武将立绘（core 启动时调用一次）
export function loadHeroPortraits(heroIds) {
  for (const id of heroIds) loadImage(`heroes/${id}.webp`);
  return heroIds.map((id) => loadImage(`heroes/${id}.webp`));
}
