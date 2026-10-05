// meta/notices.js — M7 公告与分享内容配置：本地表（运营更新此处即可，零代码下发）
export const NOTICES = [
  {
    id: '2026-10-05-m7',
    date: '2026-10-05',
    title: 'M7 版本上线：征战模式开启',
    body: '无尽模式、每日挑战、BOSS 车轮战三大征战玩法上线；周瑜、张辽加入招募池；功勋系统开放，达成成就领钻石。',
  },
  {
    id: '2026-10-05-daily',
    date: '2026-10-05',
    title: '每日挑战玩法说明',
    body: '每日挑战全服同关：当日词条对全体敌军生效，固定种子保证公平。首次通关领钻石 50，失败可无限重试。通关第 1 章后开放。',
  },
];

export function latestNoticeId() { return NOTICES[NOTICES.length - 1].id; }

// 未读：save.noticesRead 落后于最新公告 id 即视为有未读（主城「公告」格红点口径）
export function noticesUnread(save) {
  return save.noticesRead !== latestNoticeId();
}

export function markNoticesRead(save) {
  save.noticesRead = latestNoticeId();
}

// M7 分享文案 3 条轮换（spec 11.5：动态拼接无尽最佳 / 车轮最佳 / 章节进度）
export const SHARE_TEXTS = [
  (s) => `我在《七进七出》无尽模式撑到 ${s.progress.endlessBest || 0} 波，守得住长坂坡吗？`,
  (s) => `我在《七进七出》车轮战击败 ${s.progress.bossBest || 0} 个 BOSS，敢来比比吗？`,
  (s) => `《七进七出》：赵云单骑守长坂坡，我已推到第 ${s.progress.chapter} 章！`,
];

export function shareText(save, i) {
  return SHARE_TEXTS[i % SHARE_TEXTS.length](save);
}
