// render/quests.js — 军务面板：每日/每周/战令三 tab（M6 mockup 定稿）
// 战令轨道不做横向滚动手势，按「当前级锚点 ± 窗口」静态展示
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { PASS_LEVEL_EXP, PASS_MAX_LEVEL, passReward } from '../meta/quests.js';
import { KAI, C, panel, topbar, btn, roundRect } from './ui.js';

export const QUESTS_LAYOUT = {
  backBtn: { x: 20, y: 110, w: 110, h: 64 },
  tabs: { x0: 20, y: 190, w: 213, h: 64, gap: 10 },
  rows: { x: 20, y: 280, w: 680, h: 120, step: 132 },
  passBanner: { x: 20, y: 280, w: 680, h: 160 },
  track: { x: 20, y: 480, cardW: 120, cardH: 170, step: 130 },
  claimBtnW: 150,
};

const TABS = [
  { key: 'daily', label: '每日' },
  { key: 'weekly', label: '每周' },
  { key: 'pass', label: '战令' },
];

// 主入口：tab='daily'|'weekly'|'pass'
// rows: 每日/每周 tab 传 [{id,name,goal,cur,rewardText,claimable,claimed}]
// passData: 战令 tab 传 { level, exp, paid, levels:[{lv,freeClaimed,paidClaimed}] }
export function drawQuests(ctx, save, tab, rows, passData) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '军 务');
  const L = QUESTS_LAYOUT;
  btn(ctx, L.backBtn.x, L.backBtn.y, L.backBtn.w, L.backBtn.h, '← 返 回', 'ghost', 26);
  // tab 行
  TABS.forEach((t, i) => {
    const x = L.tabs.x0 + i * (L.tabs.w + L.tabs.gap);
    btn(ctx, x, L.tabs.y, L.tabs.w, L.tabs.h, t.label, tab === t.key ? 'cinnabar' : 'ghost', 30);
  });
  if (tab === 'pass') drawPass(ctx, save, passData);
  else drawRows(ctx, rows);
}

function drawRows(ctx, rows) {
  const L = QUESTS_LAYOUT;
  rows.forEach((r, i) => {
    const y = L.rows.y + i * L.rows.step;
    if (y + L.rows.h > 1150) return;
    panel(ctx, L.rows.x, y, L.rows.w, L.rows.h);
    // 印章事件标（首字）
    ctx.fillStyle = C.cinnabar;
    roundRect(ctx, L.rows.x + 18, y + L.rows.h / 2 - 26, 52, 52, 6);
    ctx.fill();
    ctx.fillStyle = C.paperHi;
    ctx.font = `700 30px ${KAI}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.name[0], L.rows.x + 44, y + L.rows.h / 2 + 2);
    // 任务名 + 进度
    ctx.fillStyle = C.ink;
    ctx.font = `700 30px ${KAI}`;
    ctx.textAlign = 'left';
    ctx.fillText(r.name, L.rows.x + 92, y + 44);
    // 进度条（墨槽鎏金）
    const bw = 300, bh = 14, bx = L.rows.x + 92, by = y + 70;
    ctx.fillStyle = 'rgba(31,27,22,0.75)';
    roundRect(ctx, bx, by, bw, bh, 7); ctx.fill();
    const ratio = Math.min(1, r.cur / r.goal);
    if (ratio > 0) {
      ctx.fillStyle = C.gold;
      roundRect(ctx, bx, by, Math.max(bh, bw * ratio), bh, 7); ctx.fill();
    }
    ctx.fillStyle = C.mut;
    ctx.font = `600 22px ${KAI}`;
    ctx.fillText(`${Math.min(r.cur, r.goal)} / ${r.goal}`, bx + bw + 16, by + 9);
    // 奖励 + 按钮
    ctx.fillStyle = C.ok;
    ctx.font = `700 26px ${KAI}`;
    ctx.textAlign = 'right';
    ctx.fillText(r.rewardText, L.rows.x + L.rows.w - 30, y + 44);
    const bx2 = L.rows.x + L.rows.w - L.claimBtnW - 30, by2 = y + L.rows.h - 56;
    if (r.claimed) btn(ctx, bx2, by2, L.claimBtnW, 44, '已 领', 'disabled', 24);
    else if (r.claimable) btn(ctx, bx2, by2, L.claimBtnW, 44, '领 取', 'cinnabar', 26);
    else btn(ctx, bx2, by2, L.claimBtnW, 44, '进行中', 'disabled', 24);
  });
}

function drawPass(ctx, save, passData) {
  const L = QUESTS_LAYOUT;
  const B = L.passBanner;
  panel(ctx, B.x, B.y, B.w, B.h);
  ctx.fillStyle = C.ink;
  ctx.font = `700 36px ${KAI}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('蜀汉军令 · 本月赛季', B.x + 30, B.y + 44);
  ctx.fillStyle = C.cinnabar;
  ctx.font = `700 32px ${KAI}`;
  ctx.textAlign = 'right';
  ctx.fillText(`Lv.${passData.level}`, B.x + B.w - 30, B.y + 44);
  // 经验条
  const bw = B.w - 60, bh = 16, bx = B.x + 30, by = B.y + 86;
  ctx.fillStyle = 'rgba(31,27,22,0.75)';
  roundRect(ctx, bx, by, bw, bh, 8); ctx.fill();
  const ratio = Math.min(1, passData.exp / PASS_LEVEL_EXP);
  if (ratio > 0) { ctx.fillStyle = C.gold; roundRect(ctx, bx, by, bw * ratio, bh, 8); ctx.fill(); }
  ctx.fillStyle = C.mut;
  ctx.font = `600 22px ${KAI}`;
  ctx.textAlign = 'left';
  ctx.fillText(
    passData.level >= PASS_MAX_LEVEL
      ? '已达满级 · 经验不再累积'
      : `军令经验 ${passData.exp % PASS_LEVEL_EXP} / ${PASS_LEVEL_EXP} · 距下一级还需 ${PASS_LEVEL_EXP - (passData.exp % PASS_LEVEL_EXP)}`,
    bx, by + 44,
  );
  // 等级卡窗口（当前级锚点，无滚动手势）
  const T = L.track;
  passData.levels.forEach((lv, i) => {
    const x = T.x + i * T.step;
    if (x + T.cardW > LOGICAL_W - 20) return;
    const cur = lv.lv === passData.level;
    panel(ctx, x, T.y, T.cardW, T.cardH, cur ? 10 : 8);
    if (cur) { ctx.strokeStyle = C.cinnabar; ctx.lineWidth = 4; roundRect(ctx, x, T.y, T.cardW, T.cardH, 10); ctx.stroke(); }
    ctx.fillStyle = C.ink;
    ctx.font = `700 26px ${KAI}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`Lv.${lv.lv}`, x + T.cardW / 2, T.y + 28);
    // 免费轨
    const fr = passReward(lv.lv, 'free');
    const frText = fr.diamonds ? `◆${fr.diamonds}` : `🪙${fr.coins}`;
    const freeClaimed = lv.freeClaimed;
    ctx.fillStyle = freeClaimed ? C.gray : C.ok;
    ctx.font = `700 24px ${KAI}`;
    ctx.fillText(freeClaimed ? '已领 ' + frText : frText, x + T.cardW / 2, T.y + 82);
    if (!freeClaimed && lv.lv <= passData.level) {
      btn(ctx, x + 14, T.y + 100, T.cardW - 28, 30, '领取', 'gold', 20);
    } else {
      btn(ctx, x + 14, T.y + 100, T.cardW - 28, 30, freeClaimed ? '已领' : '未达成', 'disabled', 20);
    }
    // 付费轨（令标）：整行即领取热区（hitQuests 对应 T.y+136..164）
    const pr = passReward(lv.lv, 'paid');
    const paidClaimed = lv.paidClaimed;
    const locked = !passData.paid;
    ctx.fillStyle = locked ? C.gray : (paidClaimed ? C.gray : C.gold);
    ctx.fillText(`${locked ? '🔒' : '令'} ${pr.diamonds}`, x + T.cardW / 2, T.y + 150);
  });
  ctx.fillStyle = C.mut;
  ctx.font = `600 22px ${KAI}`;
  ctx.textAlign = 'center';
  ctx.fillText('免费轨全员可领 · 「令」轨需商城购战令解锁', LOGICAL_W / 2, T.y + T.cardH + 40);
}

// 命中检测：{action:'back'|'tab'|'claim'|'passClaim'}
export function hitQuests(x, y, tab, rows = [], passData = null) {
  const L = QUESTS_LAYOUT;
  const inB = (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inB(L.backBtn)) return { action: 'back' };
  for (let i = 0; i < TABS.length; i++) {
    const tb = { x: L.tabs.x0 + i * (L.tabs.w + L.tabs.gap), y: L.tabs.y, w: L.tabs.w, h: L.tabs.h };
    if (inB(tb)) return { action: 'tab', tab: TABS[i].key };
  }
  if (tab === 'pass' && passData) {
    const T = L.track;
    for (let i = 0; i < passData.levels.length; i++) {
      const x0 = T.x + i * T.step;
      const lv = passData.levels[i];
      // 免费轨领取区
      if (x >= x0 + 14 && x <= x0 + T.cardW - 14 && y >= T.y + 100 && y <= T.y + 130) {
        if (lv.lv <= passData.level && !lv.freeClaimed) return { action: 'passClaim', track: 'free', level: lv.lv };
      }
      // 付费轨领取区（令字行整行）
      if (x >= x0 && x <= x0 + T.cardW && y >= T.y + 136 && y <= T.y + 164) {
        if (passData.paid && lv.lv <= passData.level && !lv.paidClaimed) return { action: 'passClaim', track: 'paid', level: lv.lv };
      }
    }
    return null;
  }
  for (let i = 0; i < rows.length; i++) {
    const y0 = L.rows.y + i * L.rows.step;
    if (y0 + L.rows.h > 1150) break;
    if (y >= y0 && y <= y0 + L.rows.h) {
      if (x >= L.rows.x + L.rows.w - L.claimBtnW - 30 && x <= L.rows.x + L.rows.w - 30 && y >= y0 + L.rows.h - 56) {
        return { action: 'claim', taskId: rows[i].id };
      }
      return null;
    }
  }
  return null;
}
