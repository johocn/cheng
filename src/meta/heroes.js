// src/meta/heroes.js — 局外英雄数据表（spec 4.1）+ 章节配置
// 数值口径见 docs/plans/2026-10-03-m3-meta.md 头部表格

export const HEROES = {
  zhaoyun:    { name: '赵云',   quality: 'UR',  tag: '近战范围', obtain: '初始',     initial: true,  char: '赵' },
  guanyu:     { name: '关羽',   quality: 'SSR', tag: '斩杀单体', obtain: '抽卡',     initial: false, char: '关' },
  zhangfei:   { name: '张飞',   quality: 'SSR', tag: '嘲讽护盾', obtain: '抽卡',     initial: false, char: '张' },
  zhugeliang: { name: '诸葛亮', quality: 'SR',  tag: '计策增益', obtain: '抽卡',     initial: false, char: '诸' },
  machao:     { name: '马超',   quality: 'SR',  tag: '冲锋击退', obtain: '章节奖励', initial: false, char: '马' },
  huangzhong: { name: '黄忠',   quality: 'R',   tag: '远程穿透', obtain: '章节奖励', initial: false, char: '黄' },
  lvbu:       { name: '吕布',   quality: 'UR',  tag: '隐藏全属性', obtain: '限时活动', initial: false, char: '吕' },
};

export const GACHA_POOL = ['zhaoyun', 'guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong'];
export const BOND_HEROES = ['zhaoyun', 'guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong'];

export const DUP_FRAGS = { UR: 15, SSR: 5, SR: 3, R: 1 };
export const STAR_MAX = 5;
export const FRAGS_PER_STAR = 3;

export const CHAPTERS = ['长坂坡', '乌林', '赤壁', '华容道', '荆州', '成都'];
export const CH_HERO = ['zhaoyun', 'guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong'];

export function chapterName(n) { return CHAPTERS[(n - 1) % CHAPTERS.length]; }
export function chapterMul(n) { return Math.pow(1.5, n - 1); }
