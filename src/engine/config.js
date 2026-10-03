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
  tou:   { hp: 350, speed: 22, dmg: 1, reward: 40, label: '投' },
  teng:  { hp: 300, speed: 32, dmg: 2, reward: 25, label: '藤' },
};

// ===== M6 投石车 =====
export const SIEGE_RANGE = 260;   // 距英雄剩余路径长阈值（停驻轰击）
export const SIEGE_INTERVAL = 3;  // 轰击周期秒
export const SIEGE_DMG = 1;       // 轰击基础扣守军（词缀 sharp 在 spawnEnemy 折入 e.dmgBonus）

// 三条进攻路径（折线拐点），均终于 HERO_POS
export const LANES = [
  [{ x: 360, y: -40 }, { x: 360, y: 640 }],
  [{ x: -40, y: 300 }, { x: 200, y: 460 }, { x: 360, y: 640 }],
  [{ x: 760, y: 300 }, { x: 520, y: 460 }, { x: 360, y: 640 }],
];

export const HP_MAX = 15;        // 守军耐久（漏怪扣减，归零战败）

// ===== M2 关卡扩展 =====
export const TOTAL_WAVES = 15;   // 单章 15 波（覆盖 M1 的 3）

// 每波敌人成长：hp/speed ×(1 + (wave-1)×0.15)
export const ENEMY_GROWTH = 0.15;

// BOSS 波（第 10/15 波，shuai 领衔）；其前一波 skillPick 必出稀有以上
export const BOSS_WAVES = [10, 15];

// 波内刷怪最小间隔（秒）；实际间隔 = max(SPAWN_GAP_MIN, 6/count)
export const SPAWN_GAP_MIN = 0.9;

// 15 波组成表：每项 [type, count]，lane 由引擎按 i%3 轮转
// 数值已验算：配合技能叠加与锦囊/大招，自动玩家 15 波可通关（见计划头部）
export const WAVE_COMPS = [
  [['bing', 8]],                               // w1 教学
  [['bing', 10]],                              // w2
  [['bing', 8], ['gong', 2]],                  // w3
  [['bing', 8], ['qi', 2]],                    // w4
  [['bing', 10], ['gong', 3], ['qi', 2]],      // w5 教学收尾
  [['bing', 12], ['qi', 3]],                   // w6
  [['bing', 10], ['gong', 4], ['qi', 3]],      // w7
  [['bing', 12], ['qi', 4]],                   // w8
  [['bing', 14], ['gong', 4], ['qi', 4]],      // w9（w9 skillPick 必稀有）
  [['bing', 10], ['qi', 4], ['shuai', 2]],     // w10 BOSS
  [['bing', 14], ['qi', 5]],                   // w11
  [['bing', 12], ['gong', 6], ['qi', 5]],      // w12
  [['bing', 16], ['qi', 6]],                   // w13
  [['bing', 14], ['gong', 6], ['qi', 6]],      // w14（w14 skillPick 必稀有）
  [['bing', 12], ['qi', 6], ['shuai', 4]],     // w15 终 BOSS
];

// ===== M2 锦囊系统 =====
export const SLOT_MAX = 8;            // 锦囊槽上限
export const ITEM_DROP_INTERVAL = 6;  // 掉落间隔秒（stage==='wave' 才计）
export const MERGE_COUNT = 3;         // N 张相同 → 高级
export const ITEM_TIER2_MUL = 2.5;    // 高级锦囊效果倍率
export const ITEM_TYPES = {
  qinglong: { label: '青龙', elem: '金', kind: 'strike' }, // 范围斩击：射程内 1.5×atk
  xuanwu:   { label: '玄武', elem: '水', kind: 'shield' }, // 守军免伤护盾 3s
  baihu:    { label: '白虎', elem: '风', kind: 'knock' },  // 全场击退 t-0.12
  zhuque:   { label: '朱雀', elem: '火', kind: 'burn' },   // 灼烧 5s，每秒 2% hpMax
  jice:     { label: '计策', elem: '雷', kind: 'buff' },   // 攻击 +30% 共 5s
};

// ===== M2 大招 =====
export const ULT_JICE_COST = 2;   // 消耗计策数
export const ULT_CAST_DUR = 2.8;  // 演出秒（期间时间冻结）
export const ULT_DAMAGE = 600;    // 结算：全场伤害
export const ULT_KNOCKBACK = 0.15;// 结算：全场 t 回退
export const ULT_STUN = 2;        // 结算：眩晕秒

// ===== M2 肉鸽技能池 =====
export const RARITY_NAMES = ['普通', '稀有', '史诗'];
export const ROGUE_SKILLS = [
  { id: 'crit',  name: '锋锐', rarity: 0, weight: 60, desc: '暴击 +25%' },
  { id: 'aspd',  name: '疾风', rarity: 0, weight: 60, desc: '攻速 +15%' },
  { id: 'atk',   name: '砺刃', rarity: 0, weight: 60, desc: '攻击 +20%' },
  { id: 'range', name: '远照', rarity: 1, weight: 30, desc: '范围 +30%' },
  { id: 'slow',  name: '凝霜', rarity: 1, weight: 30, desc: '普攻附带减速 30%·2s' },
  { id: 'wall',  name: '增垣', rarity: 1, weight: 30, desc: '守军上限 +5 并回满' },
  { id: 'chain', name: '雷引', rarity: 2, weight: 10, desc: '普攻连锁 4 目标·衰减 30%' },
  { id: 'leech', name: '饮血', rarity: 2, weight: 10, desc: '每 10 杀回复 1 守军' },
  { id: 'drop',  name: '神机', rarity: 2, weight: 10, desc: '锦囊掉落间隔 -20%' },
];
