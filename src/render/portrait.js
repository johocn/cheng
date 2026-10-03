// render/portrait.js — 立绘圆裁组件：立绘就绪 → 圆形裁剪 drawImage；否则回退楷体命字圆牌
import { heroSeal } from './ui.js';
import { loadImage, portraitReady } from '../platform/img.js';
import { HEROES } from '../meta/heroes.js';

// cx/cy/r 同 heroSeal 口径；opts: { owned, selected, ring } ring=品级环色（缺省古铜）
export function drawPortrait(ctx, cx, cy, r, heroId, opts = {}) {
  const { owned = true, selected = false } = opts;
  const h = loadImage(`heroes/${heroId}.webp`);
  if (owned && portraitReady(h)) {
    const img = h.img;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    // 512×768 竖图圆裁：取上部人像区，短边贴合
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = 0;
    ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // 描边（选中态金环加粗，与 heroSeal 口径一致）
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = !owned ? '#a89c86' : (selected ? '#c9a227' : '#8b6914');
    ctx.lineWidth = selected ? 5 : 3;
    ctx.stroke();
    if (selected) {
      ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.stroke();
    }
    return true;
  }
  heroSeal(ctx, cx, cy, r, HEROES[heroId].char, owned, selected);
  return false;
}
