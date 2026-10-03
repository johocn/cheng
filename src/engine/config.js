// engine/config.js — 全部数值配置表（平衡调整只改这里）
// 坐标系：逻辑画布 720×1280 竖屏，render 层负责缩放

export const LOGICAL_W = 720;
export const LOGICAL_H = 1280;
export const HERO_POS = { x: 360, y: 640 };

// 赵云：普攻为范围攻击（spec 4.1 定位「近战范围」——射程内全体受伤）
export const HERO = {
  atk: 60,
  atkInterval: 0.75, // 秒/击
  atkRange: 180,     // 逻辑像素
};

// 敌人类型（type 值与 render/art.js 的 drawEnemyToken 约定一致）
// hp 血量 / speed 逻辑像素每秒 / dmg 漏怪时扣守军 / reward 击杀金币
export const ENEMY_TYPES = {
  bing:  { hp: 100, speed: 35, dmg: 1, reward: 10, label: '兵' },
  qi:    { hp: 220, speed: 50, dmg: 2, reward: 20, label: '骑' },
  gong:  { hp: 80,  speed: 30, dmg: 1, reward: 15, label: '弓' },
  shuai: { hp: 500, speed: 24, dmg: 4, reward: 60, label: '帅' },
};

// 三条进攻路径（折线拐点），均终于 HERO_POS
export const LANES = [
  [{ x: 360, y: -40 }, { x: 360, y: 640 }],
  [{ x: -40, y: 300 }, { x: 200, y: 460 }, { x: 360, y: 640 }],
  [{ x: 760, y: 300 }, { x: 520, y: 460 }, { x: 360, y: 640 }],
];

export const HP_MAX = 15;        // 守军耐久（漏怪扣减，归零战败）
export const WAVE_INTERVAL = 4;  // 波间歇秒数
export const TOTAL_WAVES = 3;    // M1 验收：3 波

// 波次刷怪表：events 每项 [波内第几秒, 类型, 路径]，按时间升序
// 数值已验算：赵云 AoE dps 80 下，3 波全通不漏怪（见计划头部）
export const WAVES = [
  { events: [
    [0.5, 'bing', 0], [2.1, 'bing', 1], [3.7, 'bing', 2], [5.3, 'bing', 0],
    [6.9, 'bing', 1], [8.5, 'bing', 2], [10.1, 'bing', 0], [11.7, 'bing', 1],
  ] },
  { events: [
    [0.5, 'bing', 0], [2.0, 'qi', 1], [3.5, 'bing', 2], [4.6, 'gong', 0],
    [6.0, 'bing', 1], [7.5, 'qi', 2], [9.0, 'bing', 0], [10.2, 'gong', 1],
    [11.6, 'bing', 2], [13.0, 'qi', 0],
  ] },
  { events: [
    [0.5, 'bing', 0], [1.6, 'bing', 1], [2.7, 'qi', 2], [3.8, 'gong', 0],
    [5.0, 'bing', 1], [6.1, 'bing', 2], [7.2, 'qi', 0], [8.3, 'gong', 1],
    [9.4, 'bing', 2], [10.5, 'bing', 0], [11.6, 'qi', 1], [13.0, 'bing', 2],
    [15.0, 'qi', 0], [18.0, 'shuai', 2],
  ] },
];
