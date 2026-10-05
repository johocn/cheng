// render/notices.js — M7 公告屏：本地公告表列表卡（布局同 challenge 屏：topbar + 返回 + 竖卡）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { KAI, C, panel, btn, topbar } from './ui.js';

export const NOTICES_LAYOUT = {
  back: { x: 20, y: 20, w: 80, h: 60 },
  cardH: 200, cardGap: 16, cardY0: 110,
};

export function drawNotices(ctx, save, notices) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '公 告');
  btn(ctx, NOTICES_LAYOUT.back.x, NOTICES_LAYOUT.back.y, NOTICES_LAYOUT.back.w, NOTICES_LAYOUT.back.h, '← 返', 'ghost', 26);
  const L = NOTICES_LAYOUT;
  notices.forEach((n, i) => {
    const y = L.cardY0 + i * (L.cardH + L.cardGap);
    if (y + L.cardH > 1220) return; // 视口截断
    panel(ctx, 20, y, 680, L.cardH);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; ctx.font = `700 30px ${KAI}`;
    ctx.fillText(n.title, 44, y + 44);
    ctx.fillStyle = C.mut; ctx.font = `600 22px ${KAI}`;
    ctx.fillText(n.date, 44, y + 84);
    ctx.fillStyle = C.ink; ctx.font = `600 24px ${KAI}`;
    for (let r = 0; r * 24 < n.body.length; r++) { // 手动换行（每行 24 全角字）
      ctx.fillText(n.body.slice(r * 24, (r + 1) * 24), 44, y + 124 + r * 34);
    }
  });
}

export function hitNotices(x, y) {
  const b = NOTICES_LAYOUT.back;
  if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { action: 'back' };
  return null;
}
