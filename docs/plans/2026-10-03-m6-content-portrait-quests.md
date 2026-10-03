# M6 内容厚度 + 立绘接入 + 任务全家桶 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 spec v1.3 第十章全部内容——章节差异化（投石车/藤甲兵/精英词缀/6 套章节包）、9 命武将 AI 立绘接入展示层、每日/每周/战令三级任务系统。

**Architecture:** engine 层纯函数扩展（新敌行为分支 + 词缀乘区 + stats 计数，零平台依赖）；立绘走 sharp 离线压缩管线 + `platform/img.js` 运行时加载抽象（失败回退楷体圆牌）；任务系统为新模块 `meta/quests.js`（纯数据 + 纯函数），core 层做埋点接线与屏路由。测试全 TDD（vitest）。

**Tech Stack:** vitest、vite、sharp（新增 devDependency）、Canvas 2D、wx.createImage。

**Spec:** `docs/specs/2026-10-03-sanguo-tower-design.md` 第十章；任务面板 UI 以会话内 mockup 定稿为准。

**执行约定（每个任务通用）：**
- 工作目录 `E:\zhao\game\qijinqichu`，Windows PowerShell 环境（命令用 `;` 分隔，禁 `&&`）
- 测试命令 `pnpm test`（vitest run），单文件 `pnpm vitest run tests/xxx.test.js`
- 提交信息用单行单引号中文，格式 `type(m6): 描述`
- 战令付费轨说明：mockup 中「令牌×1」不落地为道具系统，付费轨奖励统一钻石（逢 5 级 ◆150），此为对 mockup 的定稿微调
- 任务面板战令轨道不做横向滚动手势，按「当前级锚点 ± 窗口」静态展示

**对既有代码的关键事实（子代理必读）：**
- `src/engine/state.js`：`createBattle(seed, opts)` 纯函数；`advanceFrame` 固定 16.667ms tick；`opts.atkMul/chapterMul` 注入局外乘区
- `src/engine/wave.js`：`startWave` 读 `WAVE_COMPS[state.wave-1]` 构建 `spawnQueue`；`state.chapterMul` 章节系数
- `src/engine/enemy.js`：`spawnEnemy(state,type,lane,mul,hpMul)`；`moveEnemies` 返回 `leaked:[{type,dmg}]`；`reapDead` 结算击杀
- `src/engine/config.js`：`ENEMY_TYPES`（bing/qi/gong/shuai）、`WAVE_COMPS`（15 波）、`BOSS_WAVES=[10,15]`
- `src/render/art.js`：IIFE 挂 `global.Art`，`drawEnemyToken(ctx,x,y,r,type,hpRatio)`，`ENEMY_TEXT` 字表
- `src/render/ui.js`：`C` 色板、`panel/btn/topbar/heroSeal/toast/roundRect/starsText`
- `src/app/core.js`：`createApp({ctx,showRewarded,purchase,getSpeed})`；`dispatch(hit)` 动作分发；`finishBattle()` 战斗结算；`doPull()` 抽卡；`startBattle()` 出战
- `src/meta/save.js`：`defaultSave()/loadSave()/touchDaily()`，旧档迁移在 `loadSave` 内 `??=` 补字段
- 测试目录结构 `tests/{engine,meta,render,platform}/*.test.js`；storage mock 见 `tests/setup.localStorage.js`（vitest 全局生效）
- `scripts/build-wx.mjs`：vite lib 构建单文件 game.js + 拷 game.json + 4MB 断言

---

## Task 1：新敌人类型 + 藤甲兵灼烧克制（engine）

**Files:**
- Modify: `src/engine/config.js`（ENEMY_TYPES 加 tou/teng）
- Modify: `src/engine/enemy.js`（灼烧克制系数）
- Test: `tests/engine/enemy.test.js`（追加用例）

- [ ] **Step 1: 写失败测试**（追加到 `tests/engine/enemy.test.js` 末尾）

```js
import { ENEMY_TYPES } from '../../src/engine/config.js';

describe('M6 新敌人', () => {
  test('config 定义 投石车/藤甲兵', () => {
    expect(ENEMY_TYPES.tou).toMatchObject({ hp: 350, speed: 22, dmg: 1, reward: 40, label: '投' });
    expect(ENEMY_TYPES.teng).toMatchObject({ hp: 300, speed: 32, dmg: 2, reward: 25, label: '藤' });
  });

  test('藤甲兵受灼烧伤害 ×2', () => {
    const s = createBattle(1);
    spawnEnemy(s, 'teng', 0);
    const teng = s.enemies[0];
    teng.burnT = 1;                 // 灼烧 1s
    const hp0 = teng.hp;
    moveEnemies(s, 1);              // 推进 1s
    const burned = hp0 - teng.hp;
    // 普通敌人灼烧每秒 2% hpMax；藤甲 ×2 = 4% hpMax
    expect(burned).toBeCloseTo(teng.hpMax * 0.04, 5);
  });

  test('非藤甲兵灼烧仍为 2% hpMax', () => {
    const s = createBattle(1);
    spawnEnemy(s, 'bing', 0);
    const b = s.enemies[0];
    b.burnT = 1;
    const hp0 = b.hp;
    moveEnemies(s, 1);
    expect(hp0 - b.hp).toBeCloseTo(b.hpMax * 0.02, 5);
  });
});
```

注意：该文件已有 `createBattle/spawnEnemy/moveEnemies` 的 import 与 describe 块，追加 describe 到文件末尾，import 若已存在不重复。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/engine/enemy.test.js`
Expected: FAIL（`ENEMY_TYPES.tou` undefined、burned 为 0.02 倍）

- [ ] **Step 3: 实现**

`src/engine/config.js` 的 `ENEMY_TYPES` 追加两行（保持既有四行不动）：

```js
  tou:   { hp: 350, speed: 22, dmg: 1, reward: 40, label: '投' },
  teng:  { hp: 300, speed: 32, dmg: 2, reward: 25, label: '藤' },
```

`src/engine/enemy.js` 的 `moveEnemies` 中灼烧行：

```js
      e.hp -= e.hpMax * 0.02 * dtSec * (e.burnMul || 1);
```

改为（藤甲兵元素弱点：灼烧 ×2）：

```js
      const burnK = e.type === 'teng' ? 2 : 1;
      e.hp -= e.hpMax * 0.02 * dtSec * burnK * (e.burnMul || 1);
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run tests/engine/enemy.test.js`
Expected: PASS（含既有用例）

- [ ] **Step 5: Commit**

```bash
git add src/engine/config.js src/engine/enemy.js tests/engine/enemy.test.js
git commit -m 'feat(m6): 新敌人投石车/藤甲兵——藤甲灼烧×2元素克制(TDD)'
```

---

## Task 2：投石车停驻轰击行为（engine）

**Files:**
- Modify: `src/engine/config.js`（停驻常量）
- Modify: `src/engine/enemy.js`（moveEnemies 停驻 + 轰击）
- Test: `tests/engine/enemy.test.js`（追加）

**行为定案：** 投石车沿路径推进至「剩余路径长 260px」处停驻（`t >= 1 - 260/laneLength`，拐弯误差可接受）；停驻后不再推进 t，每 3s 轰击一次直接扣 1 守军（词缀 sharp 加成同漏怪口径）；轰击伤害走 `moveEnemies` 返回值 `leached` 同一通道（`state.js` 已统一结算，玄武护盾天然免伤）；投石车仍可被漏怪机制跳过吗？——**不可**：停驻后永不 t≥1，玩家必须击杀它。被击退（锦囊白虎/大招）使 t 变小 → 恢复推进。

- [ ] **Step 1: 写失败测试**（追加到 `tests/engine/enemy.test.js`）

```js
describe('M6 投石车停驻轰击', () => {
  test('停驻后不推进且周期轰击扣守军', () => {
    const s = createBattle(1);
    spawnEnemy(s, 'tou', 0);
    const tou = s.enemies[0];
    tou.t = 0.95;                          // 直接推到临界（lane0 总长 680，1-260/680≈0.6176）
    const siegeT = 1 - 260 / laneLength(0);
    tou.t = siegeT;                        // 停驻点
    s.hp = 15;
    // 轰击计时字段
    expect(tou.siegeClock).toBe(0);
    moveEnemies(s, 3);                     // 3s：触发一次轰击
    expect(tou.t).toBe(siegeT);            // 不推进
    expect(s.hp).toBe(14);                 // 扣 1 守军
    // 再推 2.9s 不足周期，不轰击
    moveEnemies(s, 2.9);
    expect(s.hp).toBe(14);
    moveEnemies(s, 0.1);
    expect(s.hp).toBe(13);                 // 满 3s 再轰
  });

  test('停驻点前正常推进不轰击', () => {
    const s = createBattle(1);
    spawnEnemy(s, 'tou', 0);
    s.hp = 15;
    moveEnemies(s, 1);                     // 1s 内推进远未到停驻点
    expect(s.hp).toBe(15);
  });

  test('被击退后恢复推进', () => {
    const s = createBattle(1);
    spawnEnemy(s, 'tou', 0);
    const tou = s.enemies[0];
    tou.t = 1 - 260 / laneLength(0);
    moveEnemies(s, 1);
    tou.t = Math.max(0, tou.t - 0.5);      // 模拟白虎击退
    const t0 = tou.t;
    moveEnemies(s, 1);
    expect(tou.t).toBeGreaterThan(t0);     // 重新推进
  });
});
```

（`laneLength` 若未 import 则加入该文件顶部 import。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/engine/enemy.test.js`
Expected: FAIL（siegeClock undefined、hp 未扣）

- [ ] **Step 3: 实现**

`src/engine/config.js` 追加常量（放 ENEMY_TYPES 之后）：

```js
// ===== M6 投石车 =====
export const SIEGE_RANGE = 260;   // 距英雄剩余路径长阈值（停驻轰击）
export const SIEGE_INTERVAL = 3;  // 轰击周期秒
export const SIEGE_DMG = 1;       // 轰击基础扣守军（词缀 sharp 在 spawnEnemy 折入 e.dmgBonus）
```

`src/engine/enemy.js`：import 行加 `SIEGE_RANGE, SIEGE_INTERVAL, SIEGE_DMG`；`spawnEnemy` 签名扩展并在敌人对象加字段：

```js
export function spawnEnemy(state, type, laneIdx, mul = 1, hpMul = 1, affix = null) {
  const def = ENEMY_TYPES[type];
  const iron = affix === 'iron' ? 1.6 : 1;
  state.enemies.push({
    id: state.nextEnemyId++,
    type,
    lane: laneIdx,
    t: 0,
    hp: def.hp * mul * hpMul * iron,
    hpMax: def.hp * mul * hpMul * iron,
    speedMul: mul * (affix === 'swift' ? 1.4 : 1),
    dmgBonus: affix === 'sharp' ? 2 : 0,
    affix,
    siegeClock: 0,
    slowT: 0, stunT: 0, burnT: 0,
  });
}
```

`moveEnemies` 循环内在 burn 结算之后、推进之前插入停驻逻辑：

```js
    const slow = e.slowT > 0 ? 0.7 : 1;
    // M6 投石车：抵达停驻点后驻守轰击，永不漏怪
    if (e.type === 'tou' && e.t >= 1 - SIEGE_RANGE / laneLength(e.lane)) {
      e.siegeClock += dtSec;
      while (e.siegeClock >= SIEGE_INTERVAL) {
        e.siegeClock -= SIEGE_INTERVAL;
        leaked.push({ type: e.type, dmg: SIEGE_DMG + (e.dmgBonus || 0) });
      }
      survivors.push(e);
      continue;
    }
    e.t += (ENEMY_TYPES[e.type].speed * e.speedMul * slow * dtSec) / laneLength(e.lane);
    if (e.t >= 1) {
      leaked.push({ type: e.type, dmg: ENEMY_TYPES[e.type].dmg + (e.dmgBonus || 0) });
    } else {
      survivors.push(e);
    }
```

（原 `e.speedMul || 1` 改为 `e.speedMul`——spawnEnemy 现恒写入该字段；若测试发现旧用例手工构造敌人缺 speedMul，保留 `|| 1` 兜底。）

- [ ] **Step 4: 运行确认通过 + 全量回归**

Run: `pnpm vitest run tests/engine/enemy.test.js` → PASS
Run: `pnpm test` → 全绿（wave/state 用例不应受影响，spawnEnemy 新参数有默认值）

- [ ] **Step 5: Commit**

```bash
git add src/engine/config.js src/engine/enemy.js tests/engine/enemy.test.js
git commit -m 'feat(m6): 投石车停驻轰击行为——驻守点/3s周期/护盾贯通结算(TDD)'
```

---

## Task 3：精英词缀（engine + 渲染标记）

**Files:**
- Modify: `src/engine/config.js`（AFFIXES 表）
- Modify: `src/engine/wave.js`（刷怪词缀判定）
- Modify: `src/render/art.js`（drawEnemyToken 词缀视觉）
- Test: `tests/engine/wave.test.js`（追加）+ `tests/render/theme.test.js` 不动（art 视觉不做断言，靠截图验收）

- [ ] **Step 1: 写失败测试**（追加到 `tests/engine/wave.test.js`）

```js
import { AFFIXES, BOSS_WAVES } from '../../src/engine/config.js';

describe('M6 精英词缀', () => {
  test('词缀表定义', () => {
    expect(AFFIXES.iron).toMatchObject({ label: '壁', hpMul: 1.6 });
    expect(AFFIXES.swift).toMatchObject({ label: '行', speedMul: 1.4 });
    expect(AFFIXES.sharp).toMatchObject({ label: '锋', dmgBonus: 2 });
  });

  test('BOSS 波刷怪必带词缀', () => {
    const s = createBattle(7);
    s.wave = BOSS_WAVES[0];      // 第 10 波
    s.chapterPackRate = 0;       // 章节权重 0：非 BOSS 波必不带词缀 → 对照样例
    startWave(s);
    while (s.spawnQueue.length) {
      const ev = s.spawnQueue.shift();
      spawnEnemy(s, ev.type, ev.lane, ev.mul, ev.chMul, ev.affix);
    }
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.enemies.every((e) => e.affix)).toBe(true);   // BOSS 波全部带词缀
  });

  test('词缀乘区落进敌人属性', () => {
    const s = createBattle(7);
    spawnEnemy(s, 'bing', 0, 1, 1, 'iron');
    expect(s.enemies[0].hp).toBeCloseTo(ENEMY_TYPES.bing.hp * 1.6, 5);
    spawnEnemy(s, 'bing', 1, 1, 1, 'swift');
    expect(s.enemies[1].speedMul).toBeCloseTo(1.4, 5);
    spawnEnemy(s, 'bing', 2, 1, 1, 'sharp');
    expect(s.enemies[2].dmgBonus).toBe(2);
  });
});
```

（import 按该文件现状合并。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/engine/wave.test.js`
Expected: FAIL（AFFIXES 未定义、affix 恒 null）

- [ ] **Step 3: 实现**

`src/engine/config.js` 追加：

```js
// ===== M6 精英词缀 =====
export const AFFIXES = {
  iron:  { label: '壁', hpMul: 1.6 },
  swift: { label: '行', speedMul: 1.4 },
  sharp: { label: '锋', dmgBonus: 2 },
};
export const AFFIX_KEYS = ['iron', 'swift', 'sharp'];
```

`src/engine/wave.js`：import 加 `AFFIX_KEYS` 与 `rngNext`（来自 `./rng.js`）；`startWave` 构建事件时按 `state.chapterPackRate ?? 0` 判定：

```js
  const rate = state.chapterPackRate ?? 0;
  const bossWave = BOSS_WAVES.includes(state.wave);
  for (const [type, count] of comp) {
    const gap = Math.max(SPAWN_GAP_MIN, 6 / count);
    for (let i = 0; i < count; i++) {
      const affix = (bossWave || rngNext(state.rng) < rate)
        ? AFFIX_KEYS[Math.floor(rngNext(state.rng) * AFFIX_KEYS.length)]
        : null;
      events.push({ at, type, lane, mul, chMul, affix });
      at += gap;
      lane = (lane + 1) % 3;
    }
  }
```

`updateWave` 的 spawn 调用改为 `spawnEnemy(state, ev.type, ev.lane, ev.mul, ev.chMul, ev.affix)`。import 行补 `BOSS_WAVES`。

`src/render/art.js`：`drawEnemyToken` 签名加第 7 参 `affix`，在单字绘制后追加角标小印（复用 `sealStamp`）：

```js
  function drawEnemyToken(ctx, x, y, r, type, hpRatio, affix) {
    // ……原实现不动……
    // M6 精英词缀：右上角标小印
    if (affix && Art.AFFIX_TEXT) {
      sealStamp(ctx, x + rr * 0.82, y - rr * 0.82, Math.max(10, r * 0.5), Art.AFFIX_TEXT[affix] || '精', 'gold', 8);
    }
  }
```

`global.Art` 导出对象内加 `AFFIX_TEXT: { iron: '壁', swift: '行', sharp: '锋' }`，并在导出前定义。`src/render/battle.js` 中调用 `drawEnemyToken` 处（子代理定位，唯一调用点）追加实参 `e.affix`。

- [ ] **Step 4: 运行确认通过 + 全量回归**

Run: `pnpm vitest run tests/engine/wave.test.js` → PASS
Run: `pnpm test` → 全绿

- [ ] **Step 5: Commit**

```bash
git add src/engine/config.js src/engine/wave.js src/engine/enemy.js src/render/art.js src/render/battle.js tests/engine/wave.test.js
git commit -m 'feat(m6): 精英词缀铁壁/疾行/锐锋——BOSS波必带+鎏金角标(TDD)'
```

---

## Task 4：章节包 CHAPTER_PACKS（6 套波次表 + 敌池 + 词缀权重）

**Files:**
- Modify: `src/engine/config.js`（CHAPTER_PACKS + packIndex）
- Modify: `src/engine/state.js`（createBattle 注入 pack）
- Modify: `src/engine/wave.js`（startWave 按包取表 + rate）
- Test: `tests/engine/config.test.js`（追加）+ `tests/engine/state.test.js`（追加）

**数值定案（6 套全表）：** 包 1 沿用现 `WAVE_COMPS` 原表；包 2-6 在其基础上替换同量级敌人（tou hp350 慢速 / teng hp300 中速，量级介于 qi 220 与 shuai 500 之间）；第 10/15 波 BOSS 构成维持 shuai 数不变；自动通关若受新表影响不过，热调点=表内 count（不改代码结构）。

- [ ] **Step 1: 写失败测试**

追加到 `tests/engine/config.test.js`：

```js
import { CHAPTER_PACKS, packIndex } from '../../src/engine/config.js';

describe('M6 章节包', () => {
  test('6 套章节包结构与循环取模', () => {
    expect(CHAPTER_PACKS).toHaveLength(6);
    expect(packIndex(1)).toBe(0);
    expect(packIndex(6)).toBe(5);
    expect(packIndex(7)).toBe(0);          // 循环复用
    expect(packIndex(13)).toBe(0);
    for (const p of CHAPTER_PACKS) {
      expect(p.waveComps).toHaveLength(15);
      expect(p.affixRate).toBeGreaterThanOrEqual(0);
      expect(p.affixRate).toBeLessThanOrEqual(0.35);
    }
    expect(CHAPTER_PACKS[0].affixRate).toBe(0);   // 第1章教学无词缀
    expect(CHAPTER_PACKS[1].enemies).toContain('tou');
    expect(CHAPTER_PACKS[2].enemies).toContain('teng');
  });

  test('每包 15 波敌型均在其敌池内', () => {
    CHAPTER_PACKS.forEach((p) => {
      for (const comp of p.waveComps) {
        for (const [type] of comp) expect(p.enemies).toContain(type);
      }
    });
  });
});
```

追加到 `tests/engine/state.test.js`：

```js
describe('M6 章节包注入', () => {
  test('createBattle 按章节号注入包与词缀权重', () => {
    const s1 = createBattle(1, { chapterN: 1 });
    expect(s1.packIdx).toBe(0);
    expect(s1.chapterPackRate).toBe(0);
    const s3 = createBattle(1, { chapterN: 3 });
    expect(s3.packIdx).toBe(2);
    expect(s3.chapterPackRate).toBeCloseTo(0.2, 5);
    const s8 = createBattle(1, { chapterN: 8 });   // 8→packIndex 7%6=1
    expect(s8.packIdx).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/engine/config.test.js tests/engine/state.test.js`
Expected: FAIL（CHAPTER_PACKS/packIndex 未定义）

- [ ] **Step 3: 实现**

`src/engine/config.js`：将现 `WAVE_COMPS` 数组重命名为 `WAVE_COMPS_BASE`（第 1 包用），追加章节包（**敌池即表中出现的 type 全集**）：

```js
// ===== M6 章节包：6 套循环复用；7 章起回到包 1 并继续叠加 chapterMul =====
export const CHAPTER_PACKS = [
  { // 第1章 长坂坡：教学缓冲，无词缀
    name: '长坂坡', affixRate: 0,
    enemies: ['bing', 'qi', 'gong'],
    waveComps: WAVE_COMPS_BASE,
  },
  { // 第2章 乌林：+投石车，词缀 10%
    name: '乌林', affixRate: 0.1,
    enemies: ['bing', 'qi', 'gong', 'tou'],
    waveComps: [
      [['bing', 8]], [['bing', 10]], [['bing', 8], ['gong', 2]],
      [['bing', 6], ['tou', 1], ['qi', 2]],
      [['bing', 8], ['gong', 3], ['qi', 2]],
      [['bing', 10], ['tou', 1], ['qi', 3]],
      [['bing', 8], ['gong', 4], ['tou', 1], ['qi', 3]],
      [['bing', 10], ['tou', 1], ['qi', 4]],
      [['bing', 12], ['gong', 4], ['tou', 2], ['qi', 4]],
      [['bing', 8], ['qi', 4], ['shuai', 2]],
      [['bing', 12], ['tou', 1], ['qi', 5]],
      [['bing', 10], ['gong', 6], ['tou', 1], ['qi', 5]],
      [['bing', 14], ['tou', 2], ['qi', 6]],
      [['bing', 12], ['gong', 6], ['tou', 2], ['qi', 6]],
      [['bing', 10], ['qi', 6], ['shuai', 4]],
    ],
  },
  { // 第3章 赤壁：+藤甲兵（灼烧×2），词缀 20%
    name: '赤壁', affixRate: 0.2,
    enemies: ['bing', 'qi', 'gong', 'teng'],
    waveComps: [
      [['bing', 8]], [['bing', 10]], [['bing', 6], ['teng', 2], ['gong', 2]],
      [['bing', 8], ['qi', 2]],
      [['bing', 8], ['teng', 2], ['gong', 3], ['qi', 2]],
      [['bing', 10], ['qi', 3], ['teng', 1]],
      [['bing', 8], ['gong', 4], ['qi', 3], ['teng', 2]],
      [['bing', 10], ['qi', 4], ['teng', 2]],
      [['bing', 12], ['gong', 4], ['qi', 4], ['teng', 2]],
      [['bing', 8], ['qi', 4], ['shuai', 2]],
      [['bing', 12], ['qi', 5], ['teng', 2]],
      [['bing', 10], ['gong', 6], ['qi', 5], ['teng', 2]],
      [['bing', 14], ['qi', 6], ['teng', 3]],
      [['bing', 12], ['gong', 6], ['qi', 6], ['teng', 3]],
      [['bing', 8], ['qi', 6], ['shuai', 4]],
    ],
  },
  { // 第4章 华容道：全敌池，词缀 35%
    name: '华容道', affixRate: 0.35,
    enemies: ['bing', 'qi', 'gong', 'tou', 'teng'],
    waveComps: [
      [['bing', 8]], [['bing', 8], ['teng', 2]], [['bing', 6], ['gong', 2], ['tou', 1]],
      [['bing', 6], ['qi', 2], ['teng', 2]],
      [['bing', 8], ['gong', 3], ['qi', 2], ['tou', 1]],
      [['bing', 10], ['qi', 3], ['teng', 2]],
      [['bing', 8], ['gong', 4], ['qi', 3], ['tou', 2]],
      [['bing', 8], ['qi', 4], ['teng', 3]],
      [['bing', 10], ['gong', 4], ['qi', 4], ['tou', 2], ['teng', 2]],
      [['bing', 8], ['qi', 4], ['shuai', 2]],
      [['bing', 10], ['qi', 5], ['tou', 2], ['teng', 2]],
      [['bing', 8], ['gong', 6], ['qi', 5], ['tou', 2], ['teng', 2]],
      [['bing', 12], ['qi', 6], ['tou', 3], ['teng', 3]],
      [['bing', 10], ['gong', 6], ['qi', 6], ['tou', 2], ['teng', 3]],
      [['bing', 8], ['qi', 6], ['shuai', 4]],
    ],
  },
  { // 第5章 荆州
    name: '荆州', affixRate: 0.35,
    enemies: ['bing', 'qi', 'gong', 'tou', 'teng'],
    waveComps: [
      [['bing', 8]], [['bing', 8], ['teng', 2]], [['bing', 6], ['gong', 3], ['tou', 1]],
      [['bing', 6], ['qi', 3], ['teng', 2]],
      [['bing', 8], ['gong', 3], ['qi', 2], ['tou', 1], ['teng', 1]],
      [['bing', 8], ['qi', 4], ['teng', 2]],
      [['bing', 8], ['gong', 4], ['qi', 3], ['tou', 2], ['teng', 1]],
      [['bing', 8], ['qi', 4], ['tou', 2], ['teng', 2]],
      [['bing', 10], ['gong', 4], ['qi', 4], ['tou', 2], ['teng', 3]],
      [['bing', 6], ['qi', 4], ['shuai', 2]],
      [['bing', 10], ['qi', 5], ['tou', 3], ['teng', 2]],
      [['bing', 8], ['gong', 6], ['qi', 5], ['tou', 2], ['teng', 3]],
      [['bing', 10], ['qi', 6], ['tou', 3], ['teng', 4]],
      [['bing', 10], ['gong', 6], ['qi', 6], ['tou', 3], ['teng', 3]],
      [['bing', 6], ['qi', 6], ['shuai', 4]],
    ],
  },
  { // 第6章 成都
    name: '成都', affixRate: 0.35,
    enemies: ['bing', 'qi', 'gong', 'tou', 'teng'],
    waveComps: [
      [['bing', 8]], [['bing', 8], ['teng', 3]], [['bing', 6], ['gong', 3], ['tou', 1], ['teng', 1]],
      [['bing', 6], ['qi', 3], ['teng', 2]],
      [['bing', 8], ['gong', 3], ['qi', 2], ['tou', 2], ['teng', 1]],
      [['bing', 8], ['qi', 4], ['tou', 1], ['teng', 2]],
      [['bing', 8], ['gong', 4], ['qi', 3], ['tou', 2], ['teng', 2]],
      [['bing', 6], ['qi', 4], ['tou', 3], ['teng', 2]],
      [['bing', 8], ['gong', 4], ['qi', 4], ['tou', 3], ['teng', 3]],
      [['bing', 6], ['qi', 4], ['shuai', 2]],
      [['bing', 8], ['qi', 5], ['tou', 3], ['teng', 3]],
      [['bing', 8], ['gong', 6], ['qi', 5], ['tou', 3], ['teng', 3]],
      [['bing', 8], ['qi', 6], ['tou', 4], ['teng', 4]],
      [['bing', 8], ['gong', 6], ['qi', 6], ['tou', 3], ['teng', 4]],
      [['bing', 4], ['qi', 6], ['shuai', 4]],
    ],
  },
];
export function packIndex(chapterN) { return ((chapterN - 1) % CHAPTER_PACKS.length + CHAPTER_PACKS.length) % CHAPTER_PACKS.length; }
```

同时把 `wave.js` 原 import 的 `WAVE_COMPS` 改为经包取表（见下）。`WAVE_COMPS` 名字保留为导出别名 `export const WAVE_COMPS = WAVE_COMPS_BASE;`（兼容既有测试）。

`src/engine/state.js`：`createBattle` 中 `state.chapterMul = opts.chapterMul || 1;` 之后追加：

```js
  // M6 章节包注入：chapterN 决定波次表/敌池/词缀权重（缺省第 1 包，零回归）
  const ci = Math.max(1, opts.chapterN || 1);
  state.packIdx = packIndex(ci);
  state.chapterPackRate = CHAPTER_PACKS[state.packIdx].affixRate;
```

import 行加 `CHAPTER_PACKS, packIndex`（来自 `./config.js`）。

`src/engine/wave.js`：import 改为 `CHAPTER_PACKS`（不再直接用 WAVE_COMPS）；`startWave` 开头替换取表行：

```js
  const pack = CHAPTER_PACKS[state.packIdx || 0];
  const comp = pack.waveComps[state.wave - 1];
```

- [ ] **Step 4: 运行确认通过 + 全量回归 + 快进冒烟**

Run: `pnpm vitest run tests/engine/config.test.js tests/engine/state.test.js tests/engine/wave.test.js` → PASS
Run: `pnpm test` → 全绿
浏览器快进冒烟（可选，Task 12 统一做）：`pnpm dev` 后 `?speed=10` 打第 2/3 章，确认投石车停驻轰击、藤甲兵出现。

- [ ] **Step 5: Commit**

```bash
git add src/engine/config.js src/engine/state.js src/engine/wave.js tests/engine/config.test.js tests/engine/state.test.js
git commit -m 'feat(m6): 6套章节包——独立15波表/敌池/词缀权重,循环复用叠加chapterMul(TDD)'
```

---

## Task 5：立绘压缩管线（sharp）

**Files:**
- Create: `scripts/compress-heroes.mjs`
- Modify: `package.json`（devDependencies + scripts.heroes）
- Create（产物，入库）: `src/assets/heroes/{zhaoyun,guanyu,zhangfei,zhugeliang,machao,huangzhong,lvbu,zhouyu,zhangliao}.webp` + `src/containers/h5/public/heroes/`（同 9 张拷贝）
- 不入库: `docs/samples/`（已在 .gitignore）

- [ ] **Step 1: 安装 sharp**

Run: `pnpm add -D sharp`
Expected: 安装成功（Windows 平台 prebuilt 二进制）

- [ ] **Step 2: 写压缩脚本** `scripts/compress-heroes.mjs`

```js
// scripts/compress-heroes.mjs — 母版 → 512×768 WebP ≤80KB（spec 10.2 管线）
// 用法: pnpm heroes  |  node scripts/compress-heroes.mjs
import sharp from 'sharp';
import { readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(root, 'docs/samples/heroes');
const OUT = join(root, 'src/assets/heroes');
const H5_PUBLIC = join(root, 'src/containers/h5/public/heroes');
const LIMIT = 80 * 1024;

// 源文件名 → heroId（赵云样张在 samples 根目录，单独映射）
const MAP = {
  'zhaoyun-ink-sample.png': 'zhaoyun',
  'guanyu.png': 'guanyu', 'zhangfei.png': 'zhangfei', 'zhugeliang.png': 'zhugeliang',
  'machao.png': 'machao', 'huangzhong.png': 'huangzhong',
  'lvbu.png': 'lvbu', 'zhouyu.png': 'zhouyu', 'zhangliao.png': 'zhangliao',
};

mkdirSync(OUT, { recursive: true });
mkdirSync(H5_PUBLIC, { recursive: true });

for (const [file, id] of Object.entries(MAP)) {
  const src = file === 'zhaoyun-ink-sample.png' ? join(root, 'docs/samples', file) : join(SRC, file);
  let q = 78, width = 512, out;
  for (;;) {
    out = await sharp(src)
      .resize(width, 768, { fit: 'cover', position: 'attention' })
      .webp({ quality: q })
      .toBuffer();
    if (out.length <= LIMIT || q <= 50) break;
    if (q - 8 <= 50 && width > 400) { width = Math.round(width * 0.9); q = 78; continue; } // 缩幅重压
    q -= 8;
  }
  const dst = join(OUT, `${id}.webp`);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(dst, out);
  copyFileSync(dst, join(H5_PUBLIC, `${id}.webp`));
  console.log(`${id}.webp  ${Math.round(out.length / 1024)}KB  q${q} w${width}`);
  if (out.length > LIMIT) console.warn(`  ⚠ ${id} 仍超 80KB（q 下限），验收时人工复核`);
}
console.log('done: src/assets/heroes + src/containers/h5/public/heroes');
```

`package.json` scripts 加：`"heroes": "node scripts/compress-heroes.mjs"`。

- [ ] **Step 3: 运行产出**

Run: `pnpm heroes`
Expected: 9 行输出，每行 ≤80KB（个别 70-80KB 可接受，>80KB 有 ⚠ 需人工复核）；`src/assets/heroes/` 与 `src/containers/h5/public/heroes/` 各 9 张 webp

- [ ] **Step 4: 体积断言用例**（追加到 `tests/meta/heroes.test.js`）

```js
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

describe('M6 立绘资产', () => {
  test('9 张立绘入库且单张 ≤80KB', () => {
    const dir = join(__dirname, '../../src/assets/heroes');
    const files = readdirSync(dir).filter((f) => f.endsWith('.webp'));
    expect(files.length).toBe(9);
    for (const f of files) {
      expect(statSync(join(dir, f)).size).toBeLessThanOrEqual(80 * 1024);
    }
  });
});
```

（若该测试文件为 ESM 风格用 `import.meta.url`，则以同风格改写 `__dirname`；参考文件内既有写法。）

Run: `pnpm vitest run tests/meta/heroes.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/compress-heroes.mjs package.json pnpm-lock.yaml src/assets/heroes src/containers/h5/public/heroes tests/meta/heroes.test.js
git commit -m 'feat(m6): 立绘压缩管线(sharp 512x768 WebP q78<=80KB)+9张产物双目录入库'
```

---

## Task 6：立绘加载抽象 + 展示层接入（回退圆牌）

**Files:**
- Create: `src/platform/img.js`
- Create: `src/render/portrait.js`
- Modify: `scripts/build-wx.mjs`（构建后拷 assets/heroes → dist/heroes）
- Modify: `src/render/home.js`、`src/render/metaScreens.js`（三接入点）
- Modify: `src/app/core.js`（预热加载）
- Test: `tests/platform/img.test.js`（新增）

**加载路径定案：** h5 经 `src/containers/h5/public/heroes/` 由 vite 静态服务（URL 相对 `heroes/{id}.webp`）；wx 构建后由 `dist/heroes/` 提供；`loadImage` 统一用相对路径，H5 判 `typeof wx === 'undefined'`。

- [ ] **Step 1: 写失败测试** `tests/platform/img.test.js`

```js
import { describe, test, expect, vi } from 'vitest';
import { loadImage, loadHeroPortraits, portraitReady } from '../../src/platform/img.js';

describe('M6 立绘加载抽象', () => {
  test('loadImage 返回句柄且未就绪时 portraitReady=false', () => {
    const h = loadImage('heroes/zhaoyun.webp');
    expect(h).toHaveProperty('ready');
    expect(portraitReady(h)).toBe(false);
  });

  test('同一 URL 复用缓存句柄', () => {
    const a = loadImage('heroes/zhaoyun.webp');
    const b = loadImage('heroes/zhaoyun.webp');
    expect(a).toBe(b);
  });

  test('loadHeroPortraits 预热 9 张且对未知 id 不抛错', () => {
    expect(() => loadHeroPortraits(['zhaoyun', 'guanyu', 'notexist'])).not.toThrow();
  });
});
```

（全局 `Image` 不存在于 node 环境——img.js 内部对缺失构造器的容错正是被测行为：返回 `ready:false` 的哑句柄且不抛错。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/platform/img.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/platform/img.js`

```js
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
```

- [ ] **Step 4: 实现渲染组件** `src/render/portrait.js`

```js
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
```

- [ ] **Step 5: 三接入点替换**

1. `src/render/home.js` 英雄横排：import 加 `import { drawPortrait } from './portrait.js';`；将 `heroSeal(ctx, cx, HOME_LAYOUT.heroY, ..., HEROES[id].char, h.owned, ...)` 一行替换为：

```js
    drawPortrait(ctx, cx, HOME_LAYOUT.heroY, HOME_LAYOUT.heroR, id, { owned: h.owned, selected: id === selectedHero && h.owned });
```

2. `src/render/metaScreens.js` `drawDetail` 的主立绘（`DETAIL_LAYOUT.portrait` 处）：替换 `heroSeal(ctx, L.portrait.cx, L.portrait.cy, L.portrait.r, def.char, h.owned, true)` 为：

```js
  drawPortrait(ctx, L.portrait.cx, L.portrait.cy, L.portrait.r, heroId, { owned: h.owned, selected: true });
```

3. `src/render/metaScreens.js` `drawGacha` 卡池一览与 `drawGachaResult`（读该文件 L119 至文件尾定位 `drawGachaResult` 内的 `heroSeal` 调用）：凡 `heroSeal(ctx, cx, cy, r, HEROES[id].char, owned, sel)` 形态一律替换为 `drawPortrait(ctx, cx, cy, r, id, { owned, selected: sel })`。import 行同上。

4. `src/app/core.js`：import 加 `import { loadHeroPortraits } from '../platform/img.js';`；`createApp` 内 `setSkin(...)` 行后追加：

```js
  loadHeroPortraits(Object.keys(save.heroes)); // M6 立绘预热（失败静默回退圆牌）
```

- [ ] **Step 6: wx 构建拷贝资产**

`scripts/build-wx.mjs` 在 `copyFileSync(join(wxDir,'game.json'), ...)` 之后追加：

```js
// M6 立绘资产：src/assets/heroes → dist/heroes（wx.createImage 相对路径加载）
import { readdirSync } from 'node:fs';
const heroesDir = join(root, 'src/assets/heroes');
const distHeroes = join(distDir, 'heroes');
mkdirSync(distHeroes, { recursive: true });
for (const f of readdirSync(heroesDir)) copyFileSync(join(heroesDir, f), join(distHeroes, f));
```

（import readdirSync 合并到顶部既有 node:fs import 行。）

Run: `pnpm build:wx` → 输出 `dist/game.js = N KB` 且断言通过；`ls src/containers/wx-mini/dist/heroes` 可见 9 张。
Run: `pnpm build:h5` → 通过。
Run: `pnpm vitest run tests/platform/img.test.js` → PASS；`pnpm test` 全绿。

- [ ] **Step 7: Commit**

```bash
git add src/platform/img.js src/render/portrait.js src/render/home.js src/render/metaScreens.js src/app/core.js scripts/build-wx.mjs tests/platform/img.test.js
git commit -m 'feat(m6): 立绘加载抽象+圆裁组件+主城/详情/名将录三接入+wx资产拷贝(失败回退圆牌)'
```

---

## Task 7：meta/quests.js 任务核心（TDD）

**Files:**
- Create: `src/meta/quests.js`
- Modify: `src/meta/save.js`（save.quests 字段 + 迁移 + touchDaily 联动）
- Test: `tests/meta/quests.test.js`（新增）

- [ ] **Step 1: 写失败测试** `tests/meta/quests.test.js`

```js
import { describe, test, expect } from 'vitest';
import {
  DAILY_QUESTS, WEEKLY_QUESTS, PASS_LEVEL_EXP, PASS_MAX_LEVEL,
  questsOf, reportQuest, claimQuest, passLevel, passExp, weekIdOf, seasonIdOf,
  touchQuests, claimPass, questClaimable,
} from '../../src/meta/quests.js';
import { defaultSave } from '../../src/meta/save.js';

describe('M6 任务定义', () => {
  test('每日 6 条 / 每周 4 条 / 战令常量', () => {
    expect(DAILY_QUESTS).toHaveLength(6);
    expect(WEEKLY_QUESTS).toHaveLength(4);
    expect(PASS_LEVEL_EXP).toBe(100);
    expect(PASS_MAX_LEVEL).toBe(30);
    expect(DAILY_QUESTS.find((q) => q.id === 'd_win').goal).toBe(1);
    expect(WEEKLY_QUESTS.find((q) => q.id === 'w_boss').event).toBe('boss_kill');
  });
});

describe('M6 进度上报', () => {
  test('reportQuest 累计进度并直达上限截断', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    reportQuest(s, 'merge', 3);
    reportQuest(s, 'merge', 4);
    expect(questsOf(s).daily.progress.merge).toBe(5);   // 上限=goal 截断
    reportQuest(s, 'battle_win', 1);
    expect(questsOf(s).daily.progress.battle_win).toBe(1);
  });

  test('battle_win 同入周任务进度', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    reportQuest(s, 'battle_win', 2);
    expect(questsOf(s).weekly.progress.battle_win).toBe(2);
  });

  test('跨日重置每日进度，跨周重置每周进度', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });  // 周一
    reportQuest(s, 'merge', 5);
    touchQuests(s, { now: new Date('2026-10-06T10:00:00') });  // 周二：日重置周保留
    expect(questsOf(s).daily.progress.merge ?? 0).toBe(0);
    expect(questsOf(s).weekly.progress.merge).toBe(5);
    touchQuests(s, { now: new Date('2026-10-12T10:00:00') });  // 下周一：周重置
    expect(questsOf(s).weekly.progress.merge ?? 0).toBe(0);
  });
});

describe('M6 领取与战令', () => {
  test('claimQuest 落账奖励+战令exp，重复领拒', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    reportQuest(s, 'battle_win', 1);
    const dia0 = s.wallet.diamonds;
    const r = claimQuest(s, 'daily', 'd_win');
    expect(r.ok).toBe(true);
    expect(s.wallet.diamonds).toBe(dia0 + 30);
    expect(passExp(s)).toBe(20);                      // 每日领奖 +20 exp
    expect(claimQuest(s, 'daily', 'd_win').ok).toBe(false);
  });

  test('未达目标不可领', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    expect(claimQuest(s, 'weekly', 'w_win').ok).toBe(false);
  });

  test('passLevel 派生与满级封顶', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    s.quests.pass.exp = 250;
    expect(passLevel(s)).toBe(2);                     // floor(250/100)
    s.quests.pass.exp = 99999;
    expect(passLevel(s)).toBe(PASS_MAX_LEVEL);
  });

  test('claimPass 免费/付费轨——付费资格校验', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    s.quests.pass.exp = 350;                          // Lv3
    const dia0 = s.wallet.diamonds;
    expect(claimPass(s, 'free', 3).ok).toBe(true);
    expect(s.wallet.diamonds).toBeGreaterThan(dia0);
    expect(claimPass(s, 'free', 3).ok).toBe(false);   // 已领
    expect(claimPass(s, 'paid', 3).ok).toBe(false);   // 未购战令
    s.iap.pass = true;
    expect(claimPass(s, 'paid', 3).ok).toBe(true);
    expect(claimPass(s, 'paid', 4).ok).toBe(false);   // 未达级
  });

  test('赛季切换重置战令', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    s.quests.pass.exp = 500;
    touchQuests(s, { now: new Date('2026-11-01T10:00:00') });
    expect(s.quests.pass.exp).toBe(0);
    expect(questsOf(s).pass.claimedFree).toHaveLength(0);
  });
});

describe('M6 weekId/seasonId', () => {
  test('周一锚点与月份串', () => {
    expect(weekIdOf(new Date('2026-10-05T10:00:00'))).toBe('2026-10-05'); // 周一
    expect(weekIdOf(new Date('2026-10-07T10:00:00'))).toBe('2026-10-05'); // 周三归周一
    expect(seasonIdOf(new Date('2026-10-05T10:00:00'))).toBe('2026-10');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/meta/quests.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/meta/quests.js`

```js
// meta/quests.js — 任务全家桶：每日/每周任务 + 月更战令（spec 10.3）
// 纯数据+纯函数；刷新由 core 跨日 tick 调 touchQuests 驱动；进度上报 reportQuest
import { todayStr } from './save.js';

export const PASS_LEVEL_EXP = 100;
export const PASS_MAX_LEVEL = 30;
export const DAILY_CLAIM_EXP = 20;
export const WEEKLY_CLAIM_EXP = 60;

// 事件口径：battle_win / ad_watch / gacha / merge / ult / boss_kill / stamina_spend
export const DAILY_QUESTS = [
  { id: 'd_win',     name: '通关任意 1 局',   event: 'battle_win',     goal: 1,  reward: { diamonds: 30 } },
  { id: 'd_ad',      name: '观看广告 2 次',   event: 'ad_watch',       goal: 2,  reward: { diamonds: 20 } },
  { id: 'd_gacha',   name: '招募武将 3 次',   event: 'gacha',          goal: 3,  reward: { diamonds: 30 } },
  { id: 'd_merge',   name: '合成锦囊 5 次',   event: 'merge',          goal: 5,  reward: { coins: 200 } },
  { id: 'd_ult',     name: '释放大招 3 次',   event: 'ult',            goal: 3,  reward: { diamonds: 20 } },
  { id: 'd_stamina', name: '消耗体力 30 点', event: 'stamina_spend',  goal: 30, reward: { coins: 300 } },
];
export const WEEKLY_QUESTS = [
  { id: 'w_win',   name: '通关 15 局',     event: 'battle_win', goal: 15, reward: { diamonds: 80 } },
  { id: 'w_gacha', name: '招募武将 15 次', event: 'gacha',      goal: 15, reward: { diamonds: 60 } },
  { id: 'w_merge', name: '合成锦囊 30 次', event: 'merge',      goal: 30, reward: { coins: 800 } },
  { id: 'w_boss',  name: '击败主将 10 名', event: 'boss_kill',  goal: 10, reward: { diamonds: 60 } },
];

// 战令奖励：免费轨 ◆50/铜钱500 交替；付费轨 ◆100（逢 5 级 ◆150）——mockup 定稿微调无新道具
export function passReward(level, track) {
  if (track === 'free') return level % 2 === 1 ? { diamonds: 50 } : { coins: 500 };
  return { diamonds: level % 5 === 0 ? 150 : 100 };
}

function mondayStr(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;           // 周一=0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}
export function weekIdOf(now = new Date()) { return mondayStr(now); }
export function seasonIdOf(now = new Date()) { return now.toISOString().slice(0, 7); }

export function touchQuests(save, { now = new Date() } = {}) {
  if (!save.quests) {
    save.quests = {
      daily: { date: '', progress: {}, claimed: [] },
      weekly: { weekId: '', progress: {}, claimed: [] },
      pass: { seasonId: '', exp: 0, claimedFree: [], claimedPaid: [] },
    };
  }
  const q = save.quests;
  const t = now.toISOString().slice(0, 10);
  if (q.daily.date !== t) q.daily = { date: t, progress: {}, claimed: [] };
  const w = weekIdOf(now);
  if (q.weekly.weekId !== w) q.weekly = { weekId: w, progress: {}, claimed: [] };
  const s = seasonIdOf(now);
  if (q.pass.seasonId !== s) q.pass = { seasonId: s, exp: 0, claimedFree: [], claimedPaid: [] };
}

export function questsOf(save) { return save.quests; }

function bump(progress, event, n, table) {
  for (const q of table) {
    if (q.event !== event) continue;
    progress[q.event] = Math.min(q.goal, (progress[q.event] || 0) + n);
  }
}

export function reportQuest(save, event, n = 1) {
  if (!save.quests) return;
  bump(save.quests.daily.progress, event, n, DAILY_QUESTS);
  bump(save.quests.weekly.progress, event, n, WEEKLY_QUESTS);
}

export function questClaimable(save, tab, taskId) {
  const q = tab === 'daily' ? save.quests.daily : save.quests.weekly;
  const def = (tab === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS).find((x) => x.id === taskId);
  return !!def && !q.claimed.includes(taskId) && (q.progress[def.event] || 0) >= def.goal;
}

function grant(save, reward) {
  if (reward.diamonds) save.wallet.diamonds += reward.diamonds;
  if (reward.coins) save.wallet.coins += reward.coins;
}

export function claimQuest(save, tab, taskId) {
  if (!questClaimable(save, tab, taskId)) return { ok: false };
  const q = tab === 'daily' ? save.quests.daily : save.quests.weekly;
  const def = (tab === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS).find((x) => x.id === taskId);
  q.claimed.push(taskId);
  grant(save, def.reward);
  save.quests.pass.exp = Math.min(PASS_MAX_LEVEL * PASS_LEVEL_EXP,
    save.quests.pass.exp + (tab === 'daily' ? DAILY_CLAIM_EXP : WEEKLY_CLAIM_EXP));
  return { ok: true, reward: def.reward };
}

export function passLevel(save) {
  return Math.min(PASS_MAX_LEVEL, Math.floor((save.quests?.pass?.exp || 0) / PASS_LEVEL_EXP));
}
export function passExp(save) { return save.quests?.pass?.exp || 0; }

export function claimPass(save, track, level) {
  const p = save.quests.pass;
  const key = track === 'free' ? 'claimedFree' : 'claimedPaid';
  if (track === 'paid' && !save.iap.pass) return { ok: false, reason: 'locked' };
  if (level > passLevel(save)) return { ok: false, reason: 'level' };
  if (p[key].includes(level)) return { ok: false, reason: 'claimed' };
  p[key].push(level);
  const reward = passReward(level, track);
  grant(save, reward);
  return { ok: true, reward };
}
```

- [ ] **Step 4: save.quests 字段迁移**

`src/meta/save.js`：`defaultSave` 返回对象追加（`cosmetics` 之前）：

```js
    quests: {
      daily: { date: '', progress: {}, claimed: [] },
      weekly: { weekId: '', progress: {}, claimed: [] },
      pass: { seasonId: '', exp: 0, claimedFree: [], claimedPaid: [] },
    },
```

`loadSave` 内（`parsed.cosmetics = ...` 行前）追加：

```js
    // M6 任务字段补齐（旧档迁移；touchQuests 负责日/周/赛季内容重置）
    parsed.quests = { ...defaultSave().quests, ...(parsed.quests || {}) };
```

- [ ] **Step 5: 运行确认通过 + 全量回归**

Run: `pnpm vitest run tests/meta/quests.test.js tests/meta/save.test.js` → PASS
Run: `pnpm test` → 全绿

- [ ] **Step 6: Commit**

```bash
git add src/meta/quests.js src/meta/save.js tests/meta/quests.test.js
git commit -m 'feat(m6): meta/quests.js 任务核心——每日/每周/月更战令+领取落账+旧档迁移(TDD)'
```

---

## Task 8：engine stats 计数 + core 埋点接线

**Files:**
- Modify: `src/engine/state.js`（createBattle 初始 stats）
- Modify: `src/engine/slot.js`（merge 计数）
- Modify: `src/engine/ult.js`（ult 计数）
- Modify: `src/engine/enemy.js`（bossKills 计数）
- Modify: `src/app/core.js`（五处埋点 + 跨日 tick 联动 quests）
- Test: `tests/engine/state.test.js`（追加）+ `tests/meta/quests.test.js` 已覆盖 meta 侧

- [ ] **Step 1: 写失败测试**（追加到 `tests/engine/state.test.js`）

```js
describe('M6 stats 计数', () => {
  test('createBattle 初始化 stats 三计数', () => {
    const s = createBattle(1);
    expect(s.stats).toMatchObject({ mergeCount: 0, ultCount: 0, bossKills: 0 });
  });

  test('锦囊三合一 mergeCount+1 / 大招 ultCount+1 / 杀帅 bossKills+1', () => {
    const s = createBattle(1);
    // 三合一：凑 3 张同型
    s.slots[0] = { id: 1, type: 'qinglong', tier: 1 };
    s.slots[1] = { id: 2, type: 'qinglong', tier: 1 };
    s.slots[2] = { id: 3, type: 'qinglong', tier: 1 };
    useSlot(s, 0);
    expect(s.stats.mergeCount).toBe(1);
    // 大招：凑 2 计策
    s.slots[3] = { id: 4, type: 'jice', tier: 1 };
    s.slots[4] = { id: 5, type: 'jice', tier: 1 };
    expect(tryStartUlt(s)).toBe(true);
    expect(s.stats.ultCount).toBe(1);
    // 杀帅
    spawnEnemy(s, 'shuai', 0);
    s.enemies[0].hp = 0;
    reapDead(s);
    expect(s.stats.bossKills).toBe(1);
  });
});
```

（import 按该文件现状合并 `useSlot/tryStartUlt/spawnEnemy/reapDead`。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/engine/state.test.js`
Expected: FAIL（stats undefined）

- [ ] **Step 3: 实现**

`src/engine/state.js` `createBattle` 的 `leechCount: 0,` 行后追加：

```js
    stats: { mergeCount: 0, ultCount: 0, bossKills: 0 }, // M6 任务埋点（战斗结束由 core 上报）
```

`src/engine/slot.js` `useSlot` 合成分支 `return true;` 前追加：

```js
    state.stats = state.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
    state.stats.mergeCount++;
```

（`state.stats ||` 兜底为旧测试手工构造 state 的兼容；实现后若全绿可去掉兜底，由子代理按测试实况判断，优先保留兜底为零风险。）

`src/engine/ult.js` `tryStartUlt` 的 `state.ult = { t: 0 };` 前追加：

```js
  state.stats = state.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
  state.stats.ultCount++;
```

`src/engine/enemy.js` `reapDead` 的击杀统计块内（`state.killCount = ...` 行后）追加：

```js
      if (type === 'shuai') {
        state.stats = state.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
        state.stats.bossKills++;
      }
```

（`type` 变量名按上下文取 `e.type`；`state.stats` 兜底同上。）

- [ ] **Step 4: core 埋点接线**（`src/app/core.js`）

1. import 区追加：

```js
import { touchQuests, reportQuest, questClaimable, DAILY_QUESTS, WEEKLY_QUESTS } from '../meta/quests.js';
```

2. `createApp` 内 `touchDaily(save);` 行后追加：

```js
  touchQuests(save); // M6 任务日/周/赛季刷新（跨日 tick 内亦调用）
```

3. 广告统一包装：`function showToast(...)` 定义后追加，并把本模块内所有 `showRewarded(slot, {...})` 调用改为 `rewarded(slot, {...})`（共 5 处：skin/double/freePull/signin/revive）：

```js
  // M6 广告埋点：任何激励视频成功回调计 ad_watch（任务进度）
  function rewarded(slot, cb) {
    showRewarded(slot, {
      ...cb,
      onReward() { reportQuest(save, 'ad_watch', 1); cb.onReward && cb.onReward(); },
    });
  }
```

4. `doPull`：免费抽 `onReward` 内与直购路径 `persistSave(save);` 前，各追加：

```js
    reportQuest(save, 'gacha', ten ? 10 : 1);
```

（免费抽处放在 `applyGacha(save, gachaResult);` 之后；直购处放在 `applyGacha(save, gachaResult);` 之后、`persistSave` 之前。）

5. `startBattle`：`spendStamina(save, BATTLE_COST)` 成功分支（`persistSave(save);` 前）追加：

```js
    reportQuest(save, 'stamina_spend', BATTLE_COST);
```

6. `finishBattle`：函数开头（`const win = ...` 后）追加：

```js
    // M6 战斗埋点：局内计数整局上报（胜/负均计）
    const st = battleState.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
    if (st.mergeCount) reportQuest(save, 'merge', st.mergeCount);
    if (st.ultCount) reportQuest(save, 'ult', st.ultCount);
    if (st.bossKills) reportQuest(save, 'boss_kill', st.bossKills);
    if (win) reportQuest(save, 'battle_win', 1);
    touchQuests(save); // 结算时跨日/跨周补偿刷新
```

7. 跨日 tick 联动：`loop` 内 `if (save.daily.date !== todayStr()) {` 块内 `grantMonthlyDaily(save);` 后追加 `touchQuests(save);`。

- [ ] **Step 5: 运行确认通过 + 全量回归**

Run: `pnpm vitest run tests/engine/state.test.js` → PASS
Run: `pnpm test` → 全绿（core 无直接单测，回归保护既有屏测试）

- [ ] **Step 6: Commit**

```bash
git add src/engine/state.js src/engine/slot.js src/engine/ult.js src/engine/enemy.js src/app/core.js tests/engine/state.test.js
git commit -m 'feat(m6): engine stats计数(合成/大招/杀帅)+core五处埋点接线+跨日tick联动'
```

---

## Task 9：军务面板 render/quests.js + 主城入口改造

**Files:**
- Create: `src/render/quests.js`
- Modify: `src/app/core.js`（quests 路由 + 命中分发 + 领取动作）
- Modify: `src/render/home.js`（入口行两卡 → 三等分 + 红点）
- Test: `tests/render/quests.test.js`（新增，canvas mock 参考现有 `tests/render/screens.test.js` 的既有 mock 手法——先读该文件）

**布局定案（720×1280，对齐 mockup）：**

```
QUESTS_LAYOUT = {
  backBtn: { x: 20, y: 110, w: 110, h: 64 },
  tabs: { y: 190, h: 64, w: 213, gap: 10, x0: 20 },        // 每日/每周/战令
  rows: { x: 20, y: 280, w: 680, h: 120, step: 132 },      // 任务行（6 行 daily）
  passBanner: { x: 20, y: 280, w: 680, h: 160 },
  track: { x: 20, y: 470, cardW: 120, cardH: 170, step: 130 },  // 等级卡窗口 5 张
  window: { before: 1, after: 3 },                          // 当前级锚点窗口
}
```

- [ ] **Step 1: 写失败测试** `tests/render/quests.test.js`

（mock 手法照抄 `tests/render/screens.test.js` 头部——该文件已解决 canvas 2d context mock。核心断言：）

```js
import { drawQuests, hitQuests, QUESTS_LAYOUT } from '../../src/render/quests.js';

describe('M6 军务面板', () => {
  test('hitQuests: 返回/切tab/领取命中', () => {
    const L = QUESTS_LAYOUT;
    expect(hitQuests(75, 142, 'daily').action).toBe('back');
    expect(hitQuests(126, 222, 'daily').action).toBe('tab');      // 每日 tab
    expect(hitQuests(556, 222, 'daily').action).toBe('tab');      // 战令 tab
  });

  test('hitQuests 领取按钮落在任务行右端', () => {
    const L = QUESTS_LAYOUT;
    const hit = hitQuests(L.rows.x + L.rows.w - 60, L.rows.y + 60, 'daily', [{ id: 'd_win', claimable: true }]);
    expect(hit.action).toBe('claim');
    expect(hit.taskId).toBe('d_win');
  });
});
```

（用例细节以实现后的行内坐标为准微调，但**接口签名 `hitQuests(x, y, tab, rows)` 与 action 集合 back/tab/claim/passClaim 不得变**。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run tests/render/quests.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/render/quests.js`

模块结构（完整实现，mockup 定稿还原；复用 `ui.js` 的 `C/KAI/panel/btn/topbar/roundRect` 与 `art.js` 的 `Art.sealStamp`）：

```js
// render/quests.js — 军务面板：每日/每周/战令三 tab（M6 mockup 定稿）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { DAILY_QUESTS, WEEKLY_QUESTS, passLevel, passExp, PASS_LEVEL_EXP, PASS_MAX_LEVEL, passReward } from '../meta/quests.js';
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
    ctx.fillStyle = freeClaimed ? C.gray : C.jade || C.ok;
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
      // 付费轨领取区（整卡下半非按钮区简化：令字行整行）
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
```

（实现时允许微调坐标/删减占位行，但导出签名与 action 集合不变；`C.jade` 若不存在则用 `C.ok`。）

- [ ] **Step 4: core 路由接线**（`src/app/core.js`）

1. import 区追加：

```js
import { drawQuests, hitQuests, QUESTS_LAYOUT } from '../render/quests.js';
import { questsOf, questClaimable, claimQuest, claimPass, passLevel, passExp, DAILY_QUESTS, WEEKLY_QUESTS, passReward } from '../meta/quests.js';
```

（`questClaimable/DAILY_QUESTS/WEEKLY_QUESTS` 若 Task 8 已引入则合并。）

2. 状态变量：`let shopPick = null;` 行后追加 `let questTab = 'daily';`。

3. `screen` 注释行更新为含 `quests`；`hitTest` 追加 `if (screen === 'quests') return hitQuests(x, y, questTab, questRows(), passData());`。

4. 追加两辅助函数（core 内）：

```js
  // 军务面板视图数据
  function questRows() {
    const q = questsOf(save);
    const table = questTab === 'daily' ? DAILY_QUESTS : WEEKLY_QUESTS;
    return table.map((d) => ({
      id: d.id, name: d.name, goal: d.goal,
      cur: q[questTab].progress[d.event] || 0,
      rewardText: d.reward.diamonds ? `◆${d.reward.diamonds}` : `🪙${d.reward.coins}`,
      claimable: questClaimable(save, questTab, d.id),
      claimed: q[questTab].claimed.includes(d.id),
    }));
  }
  function passData() {
    const lv = passLevel(save);
    const before = 1, after = 3; // 当前级锚点窗口
    const levels = [];
    for (let l = Math.max(1, lv - before); l <= Math.min(30, lv + after); l++) {
      levels.push({
        lv: l,
        freeClaimed: save.quests.pass.claimedFree.includes(l),
        paidClaimed: save.quests.pass.claimedPaid.includes(l),
      });
    }
    return { level: lv, exp: passExp(save), paid: !!save.iap.pass, levels };
  }
```

（红点口径不在 core 实现——Task 9 Step 5 的 `anyClaimable(save)` 统一供 core/home 使用。）

5. `dispatch` home 分支追加 `if (hit.action === 'quests') { screen = 'quests'; questTab = 'daily'; }`；
   dispatch 追加 quests 分支（与 signin 分支同级；以下片段插入位置在 `} else if (screen === 'revive') {` 之前，片段首尾的 `} else if` 与闭合 `}` 需与既有链对齐）：

```js
    } else if (screen === 'quests') {
      if (hit.action === 'back') screen = 'home';
      if (hit.action === 'tab') questTab = hit.tab;
      if (hit.action === 'claim') {
        const r = claimQuest(save, questTab, hit.taskId);
        if (r.ok) {
          persistSave(save);
          const p = r.reward;
          showToast(`领取成功 ${p.diamonds ? `钻石+${p.diamonds}` : `金币+${p.coins}`} · 军令经验+${questTab === 'daily' ? 20 : 60}`);
        }
      }
      if (hit.action === 'passClaim') {
        const r = claimPass(save, hit.track, hit.level);
        if (r.ok) {
          persistSave(save);
          showToast(`军令 Lv.${hit.level} ${hit.track === 'free' ? '免费' : '令'}轨 · 钻石+${r.reward.diamonds}`);
        } else if (r.reason === 'locked') {
          showToast('「令」轨需购战令 · 商城可购');
        }
      }
```

6. `loop` 渲染分支追加（`shop` 分支后）：

```js
    } else if (screen === 'quests') {
      drawQuests(ctx, save, questTab, questRows(), passData());
```

- [ ] **Step 5: 主城入口三等分**（`src/render/home.js`）

1. `HOME_LAYOUT` 入口行改三卡：

```js
  questBtn: { x: 20, y: 540, w: 213, h: 90 },        // M6 军务
  signinBtn: { x: 243, y: 540, w: 213, h: 90 },
  shopBtn: { x: 466, y: 540, w: 214, h: 90 },
```

2. `drawHome` 入口行绘制改为：

```js
  drawEntry(ctx, L.questBtn, '务', '军务', questRedDotHome(save));
  drawEntry(ctx, L.signinBtn, '签', '每日签到', signinClaimable(save));
  drawEntry(ctx, L.shopBtn, '商', '商城', false);
```

（`questRedDotHome` 一律复用 meta 层导出：**在 `meta/quests.js` 追加导出 `anyClaimable(save)`（core 与 home 两处统一调用，禁止各自实现）：**

```js
export function anyClaimable(save) {
  if (!save.quests) return false;
  return [...DAILY_QUESTS, ...WEEKLY_QUESTS].some((d) =>
    questClaimable(save, d.id.startsWith('d_') ? 'daily' : 'weekly', d.id));
}
```

home.js 只需 `import { anyClaimable } from '../meta/quests.js';` 并写 `drawEntry(ctx, L.questBtn, '务', '军务', anyClaimable(save));`。core 内不再实现 questRedDot。`tests/meta/quests.test.js` 补一用例：

```js
  test('anyClaimable 红点口径', () => {
    const s = defaultSave();
    touchQuests(s, { now: new Date('2026-10-05T10:00:00') });
    expect(anyClaimable(s)).toBe(false);
    reportQuest(s, 'battle_win', 1);
    expect(anyClaimable(s)).toBe(true);
  });
```

）

3. `hitHome`：入口判定加 `if (inBtn(L.questBtn)) return { action: 'quests' };`。

- [ ] **Step 6: 运行确认通过 + 全量回归**

Run: `pnpm vitest run tests/render/quests.test.js tests/meta/quests.test.js` → PASS
Run: `pnpm test` → 全绿（screens.test.js 若断言入口行坐标需同步修正——以实际失败信息为准修测试）

- [ ] **Step 7: Commit**

```bash
git add src/render/quests.js src/render/home.js src/app/core.js src/meta/quests.js tests/render/quests.test.js tests/meta/quests.test.js
git commit -m 'feat(m6): 军务面板三tab+主城三等分入口+红点+领取落账接线(mockup定稿)'
```

---

## Task 10：回归 + 冒烟 + 截图 + spec 标注（收口）

**Files:**
- Modify: `docs/specs/2026-10-03-sanguo-tower-design.md`（第八章 M6 行 → ✅）
- Create: `docs/screenshots/m6/*.png`（手机视口截图入库，参考 M5 惯例目录结构——先 ls docs/screenshots 确认）

- [ ] **Step 1: 全量回归**

Run: `pnpm test` → 全部绿（24+ 文件）
Run: `pnpm build:h5` → 通过
Run: `pnpm build:wx` → 通过且体积断言（game.js + heroes 资产）≤4MB；若 `build-wx.mjs` 断言仅算 game.js，追加 dist/heroes 目录合计体积进断言：

```js
import { readdirSync } from 'node:fs';
const heroesKb = readdirSync(join(distDir, 'heroes')).reduce((n, f) => n + statSync(join(distDir, 'heroes', f)).size, 0) / 1024;
console.log(`[wx] dist/heroes = ${Math.round(heroesKb)} KB`);
if (kb + heroesKb > 4096) { console.error('[wx] 首包(含立绘)超 4MB'); process.exit(1); }
```

- [ ] **Step 2: 浏览器冒烟（h5 dev server + browser 工具）**

1. `pnpm dev`（后台）→ 打开 `http://localhost:5173`（以实际端口为准）
2. 手机视口 390×844 dpr=2；逐屏截图（9 张）：
   - 主城（军务入口三等分 + 红点态可用 `window.__app` 无法直接造——红点验证用任务领取后状态）
   - 军务面板三 tab 各 1 张（每日/每周/战令）
   - 主城英雄横排立绘态 1 张（立绘加载完成）
   - 英雄详情立绘 1 张
   - 名将录立绘卡池 1 张
   - 战斗中投石车停驻轰击 1 张（第 2 章 `?speed=3`，evaluate 直发 PointerEvent 出战 (360,1185)）
   - 词缀敌人鎏金角标 1 张（同局等待精英出现）
3. 交互冒烟（browser_evaluate 直发 PointerEvent，cx=rect.left+LX*(r.width/720)）：
   - 军务入口 → 三 tab 切换 → 有可领任务时点领取 → toast 出现 → 回主城红点消失
   - 出战第 2 章快进至第 4 波观察投石车停驻（不推进、守军周期扣血）
   - `__app.__debug(st=>{st.stage='over'})` 驱动战败 → 复活弹层仍正常（回归 M5）
4. 发现缺陷当场修复并补测试，重跑全量。

- [ ] **Step 3: 截图入库 + spec 标注**

- 截图存 `docs/screenshots/m6/`（9 张），确认 `.gitignore` 不排除该目录
- `docs/specs/2026-10-03-sanguo-tower-design.md` 第八章 M6 行改为：

```
| M6 内容+视觉+留存 | 章节差异化（新敌/词缀/章节包）+ 武将立绘接入 + 任务全家桶 | 新敌/词缀在 2/3 章可遇且视觉可辨；立绘展示层全接入（失败回退圆牌）；任务三 tab 全功能刷新/领取正常 | ✅ 2026-10-03 交付（投石车/藤甲兵/三词缀/6 章节包；9 张立绘双目录；每日6+每周4+月更战令；N 测试全绿）|
```

（N=最终测试数，跑完填实际值。）

- [ ] **Step 4: 最终提交**

```bash
git add docs/specs/2026-10-03-sanguo-tower-design.md docs/screenshots/m6 scripts/build-wx.mjs
git commit -m 'chore(m6): 回归验收截图入库+spec第八章M6标注(全测试绿)'
```

---

## 任务依赖与执行顺序

```
Task 1 → Task 2 → Task 3 → Task 4        （engine 链，依次依赖）
Task 5 → Task 6                           （立绘链，5 产出资产 6 接入）
Task 7 → Task 8 → Task 9                  （任务链，7 核心 8 埋点 9 UI）
Task 10 收口（依赖全部）
```

三链并行可行（不同文件域）；主窗口串行派发审查亦可。子代理驱动执行：每 Task 独立子代理，主窗口逐任务 `git show` 复核 + 复跑测试。
