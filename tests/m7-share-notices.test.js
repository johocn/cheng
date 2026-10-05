// tests/m7-share-notices.test.js — M7 分享三文案轮换 + 降级路径 + 公告表与未读红点
import { describe, it, expect, vi, afterEach } from 'vitest';
import { shareApp } from '../src/platform/share.js';
import { NOTICES, noticesUnread, markNoticesRead, latestNoticeId, SHARE_TEXTS, shareText } from '../src/meta/notices.js';
import { NOTICES_LAYOUT, hitNotices } from '../src/render/notices.js';
import { defaultSave, loadSave } from '../src/meta/save.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.wx;
});

describe('M7 分享 shareApp', () => {
  it('wx 环境：调 wx.shareAppMessage 透传参数并返回 shared', async () => {
    let called = null;
    vi.stubGlobal('wx', { shareAppMessage: (o) => { called = o; } });
    const r = await shareApp({ title: '测试文案', query: 'from=result' });
    expect(r).toBe('shared');
    expect(called.title).toBe('测试文案');
    expect(called.query).toBe('from=result');
  });
  it('H5 无 wx 无剪贴板（node 环境）：降级返回 copied 不炸', async () => {
    const r = await shareApp({ title: '测试文案' });
    expect(r).toBe('copied');
  });
  it('H5 clipboard.writeText 可用：写入分享文案返回 copied', async () => {
    let written = null;
    vi.stubGlobal('navigator', { clipboard: { writeText: async (t) => { written = t; } } });
    const r = await shareApp({ title: '剪贴板文案' });
    expect(r).toBe('copied');
    expect(written).toBe('剪贴板文案');
  });
  it('剪贴板写入抛异常：返回 failed 不炸', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('denied'); } } });
    const r = await shareApp({ title: 'x' });
    expect(r).toBe('failed');
  });
});

describe('M7 分享文案三选轮换', () => {
  it('文案表 3 条互不相同，各自拼接对应战绩数值', () => {
    expect(SHARE_TEXTS).toHaveLength(3);
    const s = defaultSave();
    s.progress.endlessBest = 12;
    s.progress.bossBest = 7;
    s.progress.chapter = 3;
    const texts = [0, 1, 2].map((i) => shareText(s, i));
    expect(new Set(texts).size).toBe(3);
    expect(texts[0]).toContain('12');
    expect(texts[1]).toContain('7');
    expect(texts[2]).toContain('3');
  });
  it('shareText 索引越界取模循环（3 → 回到第 1 条）', () => {
    const s = defaultSave();
    expect(shareText(s, 3)).toBe(shareText(s, 0));
  });
});

describe('M7 公告', () => {
  it('NOTICES ≥2 条且 id/date/title/body 齐备，id 唯一', () => {
    expect(NOTICES.length).toBeGreaterThanOrEqual(2);
    expect(new Set(NOTICES.map((n) => n.id)).size).toBe(NOTICES.length);
    NOTICES.forEach((n) => {
      expect(n.id && n.date && n.title && n.body).toBeTruthy();
    });
  });
  it('未读判定与已读标记（红点口径）', () => {
    const s = defaultSave();
    expect(noticesUnread(s)).toBe(true); // 初始无已读戳 → 有未读
    markNoticesRead(s);
    expect(noticesUnread(s)).toBe(false);
    expect(s.noticesRead).toBe(latestNoticeId());
  });
  it('save 迁移：defaultSave 置空串，旧档 loadSave 补齐，已读档保留', () => {
    expect(defaultSave().noticesRead).toBe('');
    const old = { // M6 时代旧档形态（wallet/heroes/progress 齐备，无 M7 公告字段）
      v: 1, wallet: { coins: 1, diamonds: 1 },
      heroes: { zhaoyun: { owned: true, stars: 1, level: 1, frags: 0 } },
      progress: { chapter: 1, chapterClear: 0, waveBest: 0 },
    };
    localStorage.setItem('qqc_save_v1', JSON.stringify(old));
    expect(loadSave().noticesRead).toBe('');
    localStorage.setItem('qqc_save_v1', JSON.stringify({ ...old, noticesRead: latestNoticeId() }));
    expect(loadSave().noticesRead).toBe(latestNoticeId());
  });
  it('公告屏命中：返回键命中，屏中空白返回 null', () => {
    const b = NOTICES_LAYOUT.back;
    expect(hitNotices(b.x + 5, b.y + 5)).toEqual({ action: 'back' });
    expect(hitNotices(360, 640)).toBeNull();
  });
});
