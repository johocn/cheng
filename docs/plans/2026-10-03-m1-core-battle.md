# M1 核心战斗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 跑通「敌人三路径涌入 → 赵云自动范围攻击 → 漏怪扣守军血 → 3 波全清获胜」的 H5 可玩闭环，engine 层纯函数 + vitest 单测通过。

**Architecture:** engine/ 纯函数核心（`advanceFrame(state, inputs, dtMs) → newState`，内部 structuredClone 后按 16.667ms 固定 tick 推进，M1 无随机、完全确定）；render/ 只读 state 绘制（复用已有 IIFE 全局 `window.Art` 素材库）；containers/h5 用 vite dev server 跑浏览器原生 ESM。数值已验算：默认数值下 3 波全通不漏怪（守军 15 满血胜利）。

**Tech Stack:** 原生 ESM JavaScript（零运行时依赖）+ vite（dev server）+ vitest（单测）+ pnpm。Canvas 2D。

**Spec:** `docs/specs/2026-10-03-sanguo-tower-design.md` v1.2 第八章 M1 行。

**M1 范围边界（明确不做，属 M2+）:** 锦囊槽/合成、肉鸽三选一、大招演出、金币消费、暂停按钮。HUD 为只读展示。

**与 spec 的偏差说明:**
- spec 第七章 `stage: 'wave' | 'skillPick' | 'over'` —— M1 实现为 `'wave' | 'interval' | 'victory' | 'over'`（`skillPick` 属 M2；`interval` 为波间歇；`victory` 为 M1 验收终态）。
- spec `state` 含 `slots/skills/ult` —— M1 为字段子集，字段留待 M2 按本计划的 `createBattle` 结构追加。

**项目现状:** 零构建纯静态项目（无 package.json）。已有 `src/render/art.js`（IIFE 挂 `window.Art`）、`src/render/characters45.js`、`src/render/characters-kids.js`、`src/containers/h5/` 三个预览页。M1 新增 node 工具链仅限 devDependencies。

---

### Task 1: 工具链基建（pnpm + vitest + vite）

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `tests/engine/smoke.test.js`

- [ ] **Step 1: 初始化 package.json**

在 `E:\zhao\game\qijinqichu` 下创建 `package.json`：

```json
{
  "name": "qijinqichu",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

`"type": "module"` 必须有——vitest/vite 的 ESM 配置依赖它。

- [ ] **Step 2: 安装 devDependencies**

Run: `pnpm add -D vitest vite`
Expected: 安装成功，package.json 出现 `devDependencies` 字段。

- [ ] **Step 3: 创建 vite.config.js**

```js
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/containers/h5',
  server: { port: 5173 },
});
```

root 指向容器目录，`index.html`（Task 8）放那里。engine/render 通过相对路径 `../../` 引用，vite 默认 fs.allow 覆盖至 package.json 所在的项目根，无需额外配置。

- [ ] **Step 4: 写冒烟测试**

创建 `tests/engine/smoke.test.js`：

```js
import { describe, it, expect } from 'vitest';

describe('测试基建', () => {
  it('vitest 就绪', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 运行测试验证基建**

Run: `pnpm test`
Expected: `1 passed`。

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.js tests/engine/smoke.test.js
git commit -m "chore: pnpm+vitest+vite 工具链基建（M1）"
```

---

### Task 2: engine/config.js 数值配置表

**Files:**
- Create: `src/engine/config.js`
- Test: `tests/engine/config.test.js`

所有数值集中一个文件，平衡调整只改这里。

- [ ] **Step 1: 写失败测试**

创建 `tests/engine/config.test.js`：

```js
import { describe, it, expect } from 'vitest';
import {
  LOGICAL_W, LOGICAL_H, HERO_POS, HERO,
  ENEMY_TYPES, LANES, HP_MAX, WAVE_INTERVAL, TOTAL_WAVES, WAVES,
} from '../../src/engine/config.js';

describe('数值配置表', () => {
  it('逻辑画布 720×1280，赵云居中', () => {
    expect(LOGICAL_W).toBe(720);
    expect(LOGICAL_H).toBe(1280);
    expect(HERO_POS).toEqual({ x: 360, y: 640 });
  });

  it('三条路径都终于赵云脚下', () => {
    expect(LANES).toHaveLength(3);
    for (const lane of LANES) {
      const last = lane[lane.length - 1];
      expect(last).toEqual(HERO_POS);
    }
  });

  it('敌人类型齐全且数值为正', () => {
    expect(Object.keys(ENEMY_TYPES).sort())
      .toEqual(['bing', 'gong', 'qi', 'shuai']);
    for (const def of Object.values(ENEMY_TYPES)) {
      expect(def.hp).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.dmg).toBeGreaterThan(0);
      expect(def.reward).toBeGreaterThan(0);
      expect(typeof def.label).toBe('string');
    }
  });

  it('三波刷怪事件：时间升序、类型/路径合法', () => {
    expect(WAVES).toHaveLength(TOTAL_WAVES);
    const laneCount = LANES.length;
    WAVES.forEach((wave, wi) => {
      let prevAt = -Infinity;
      for (const [at, type, lane] of wave.events) {
        expect(at, `wave${wi + 1} 事件时间须升序`).toBeGreaterThan(prevAt);
        prevAt = at;
        expect(ENEMY_TYPES[type], `wave${wi + 1} 类型 ${type} 合法`).toBeTruthy();
        expect(lane, `wave${wi + 1} 路径 ${lane} 合法`)
          .toBeGreaterThanOrEqual(0);
        expect(lane).toBeLessThan(laneCount);
      }
      expect(wave.events.length, '每波至少 1 个事件').toBeGreaterThan(0);
    });
  });

  it('守军与波间歇为正', () => {
    expect(HP_MAX).toBe(15);
    expect(WAVE_INTERVAL).toBeGreaterThan(0);
    expect(TOTAL_WAVES).toBe(3);
  });

  it('赵云数值已定（AoE 普攻）', () => {
    expect(HERO.atk).toBe(60);
    expect(HERO.atkInterval).toBe(0.75);
    expect(HERO.atkRange).toBe(180);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL —— `Cannot find module '../../src/engine/config.js'`。

- [ ] **Step 3: 实现 config.js**

创建 `src/engine/config.js`：

```js
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS（config 6 项 + smoke 1 项全绿）。

- [ ] **Step 5: Commit**

```bash
git add src/engine/config.js tests/engine/config.test.js
git commit -m "feat(engine): 数值配置表——三路径/敌型/3 波刷怪表（数值已验算）"
```

---

### Task 3: engine/enemy.js 敌人生成与移动

**Files:**
- Create: `src/engine/enemy.js`
- Test: `tests/engine/enemy.test.js`

约定：engine 子模块直接 mutate 传入的 working state（`advanceFrame` 已在入口克隆，见 Task 7），对外整体仍是纯函数。单测用鸭子类型最小 state，无需完整 battle 对象。

- [ ] **Step 1: 写失败测试**

创建 `tests/engine/enemy.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { pathPoint, laneLength, spawnEnemy, moveEnemies } from '../../src/engine/enemy.js';
import { ENEMY_TYPES, HERO_POS } from '../../src/engine/config.js';

function makeState() {
  return { enemies: [], nextEnemyId: 1 };
}

describe('pathPoint 路径插值', () => {
  it('lane0 是单段直线：t=0 顶点、t=1 赵云、t=0.5 中点', () => {
    expect(pathPoint(0, 0)).toEqual({ x: 360, y: -40 });
    expect(pathPoint(0, 1)).toEqual({ x: 360, y: 640 });
    expect(pathPoint(0, 0.5)).toEqual({ x: 360, y: 300 });
  });

  it('t 越界钳制到 [0,1]', () => {
    expect(pathPoint(0, -1)).toEqual(pathPoint(0, 0));
    expect(pathPoint(0, 2)).toEqual(pathPoint(0, 1));
  });

  it('lane1 折线：起点、终点正确，中点在前半段', () => {
    expect(pathPoint(1, 0)).toEqual({ x: -40, y: 300 });
    expect(pathPoint(1, 1)).toEqual(HERO_POS);
    const mid = pathPoint(1, 0.5);
    expect(mid.x).toBeLessThan(200); // 总长约529，前段长约288，t=0.5 仍在第一段
  });

  it('终点即赵云脚下（漏怪判定点）', () => {
    for (let lane = 0; lane < 3; lane++) {
      expect(pathPoint(lane, 1)).toEqual(HERO_POS);
    }
  });

  it('laneLength 为正且 lane0 长度 = 680', () => {
    expect(laneLength(0)).toBeCloseTo(680, 0);
    expect(laneLength(1)).toBeGreaterThan(0);
  });
});

describe('spawnEnemy', () => {
  it('按类型定义生成满血敌人，id 自增', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    spawnEnemy(s, 'qi', 2);
    expect(s.enemies).toHaveLength(2);
    expect(s.enemies[0]).toEqual({
      id: 1, type: 'bing', lane: 0, t: 0,
      hp: ENEMY_TYPES.bing.hp, hpMax: ENEMY_TYPES.bing.hp,
    });
    expect(s.enemies[1].id).toBe(2);
    expect(s.nextEnemyId).toBe(3);
  });
});

describe('moveEnemies', () => {
  it('按类型速度推进 t', () => {
    const s = makeState();
    spawnEnemy(s, 'bing', 0);
    moveEnemies(s, 1); // 恰好 1 秒
    // bing speed 35 / lane0 长度 680
    expect(s.enemies[0].t).toBeCloseTo(35 / 680, 5);
  });

  it('t≥1 判定漏怪：移出战场并返回漏怪明细', () => {
    const s = makeState();
    spawnEnemy(s, 'qi', 0);
    s.enemies[0].t = 0.999;
    spawnEnemy(s, 'bing', 0);
    s.enemies[1].t = 0.5;
    const leaked = moveEnemies(s, 0.1);
    expect(leaked).toEqual([{ type: 'qi', dmg: ENEMY_TYPES.qi.dmg }]);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0].type).toBe('bing');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL —— `Cannot find module '../../src/engine/enemy.js'`。

- [ ] **Step 3: 实现 enemy.js**

创建 `src/engine/enemy.js`：

```js
// engine/enemy.js — 敌人生成 / 沿路径移动 / 漏怪判定
import { LANES, ENEMY_TYPES } from './config.js';

// 路径几何只读，模块级缓存（不依赖 state，不影响纯度）
const laneCache = new Map();

function laneSegs(laneIdx) {
  if (!laneCache.has(laneIdx)) {
    const pts = LANES[laneIdx];
    const segs = [];
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      segs.push({ ax: pts[i].x, ay: pts[i].y, bx: pts[i + 1].x, by: pts[i + 1].y, start: total, len });
      total += len;
    }
    laneCache.set(laneIdx, { segs, total });
  }
  return laneCache.get(laneIdx);
}

export function laneLength(laneIdx) {
  return laneSegs(laneIdx).total;
}

// 路径进度 t∈[0,1] → 逻辑坐标（按段长线性插值）
export function pathPoint(laneIdx, t) {
  const { segs, total } = laneSegs(laneIdx);
  const dist = Math.max(0, Math.min(1, t)) * total;
  for (const s of segs) {
    if (dist <= s.start + s.len + 1e-9) {
      const k = s.len === 0 ? 0 : (dist - s.start) / s.len;
      return { x: s.ax + (s.bx - s.ax) * k, y: s.ay + (s.by - s.ay) * k };
    }
  }
  const last = segs[segs.length - 1];
  return { x: last.bx, y: last.by };
}

export function spawnEnemy(state, type, laneIdx) {
  const def = ENEMY_TYPES[type];
  state.enemies.push({
    id: state.nextEnemyId++,
    type,
    lane: laneIdx,
    t: 0,
    hp: def.hp,
    hpMax: def.hp,
  });
}

// 推进所有敌人；t≥1 的判定漏怪并移出，返回 [{type, dmg}]
export function moveEnemies(state, dtSec) {
  const leaked = [];
  const survivors = [];
  for (const e of state.enemies) {
    e.t += (ENEMY_TYPES[e.type].speed * dtSec) / laneLength(e.lane);
    if (e.t >= 1) {
      leaked.push({ type: e.type, dmg: ENEMY_TYPES[e.type].dmg });
    } else {
      survivors.push(e);
    }
  }
  state.enemies = survivors;
  return leaked;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/engine/enemy.js tests/engine/enemy.test.js
git commit -m "feat(engine): 敌人生成/路径插值移动/漏怪判定"
```

---

### Task 4: engine/combat.js 伤害与击杀

**Files:**
- Create: `src/engine/combat.js`
- Test: `tests/engine/combat.test.js`

- [ ] **Step 1: 写失败测试**

创建 `tests/engine/combat.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { dealDamage } from '../../src/engine/combat.js';
import { ENEMY_TYPES } from '../../src/engine/config.js';

function makeState() {
  return {
    coins: 0,
    enemies: [{ id: 7, type: 'bing', lane: 0, t: 0.4, hp: 50, hpMax: 100 }],
    nextEnemyId: 8,
  };
}

describe('dealDamage', () => {
  it('伤害未致死：扣血，返回 killed:false', () => {
    const s = makeState();
    const r = dealDamage(s, 7, 30);
    expect(r).toEqual({ killed: false });
    expect(s.enemies[0].hp).toBe(20);
    expect(s.coins).toBe(0);
  });

  it('伤害致死：移出战场 + 发放击杀金币', () => {
    const s = makeState();
    const r = dealDamage(s, 7, 60);
    expect(r).toEqual({ killed: true, reward: ENEMY_TYPES.bing.reward });
    expect(s.enemies).toHaveLength(0);
    expect(s.coins).toBe(ENEMY_TYPES.bing.reward);
  });

  it('无效 id 安全返回 null，不改动 state', () => {
    const s = makeState();
    const before = JSON.stringify(s);
    expect(dealDamage(s, 999, 50)).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL —— `Cannot find module '../../src/engine/combat.js'`。

- [ ] **Step 3: 实现 combat.js**

创建 `src/engine/combat.js`：

```js
// engine/combat.js — 伤害结算 / 死亡移除 / 击杀金币
import { ENEMY_TYPES } from './config.js';

// 对单个敌人结算伤害；致死则移出并发金币
export function dealDamage(state, enemyId, amount) {
  const e = state.enemies.find((x) => x.id === enemyId);
  if (!e) return null;
  e.hp -= amount;
  if (e.hp <= 0) {
    const reward = ENEMY_TYPES[e.type].reward;
    state.coins += reward;
    state.enemies = state.enemies.filter((x) => x.id !== enemyId);
    return { killed: true, reward };
  }
  return { killed: false };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/engine/combat.js tests/engine/combat.test.js
git commit -m "feat(engine): 伤害结算与击杀金币"
```

---

### Task 5: engine/hero.js 赵云范围普攻

**Files:**
- Create: `src/engine/hero.js`
- Test: `tests/engine/hero.test.js`

赵云普攻 = 射程（180px）内**全体**敌人受伤（spec 4.1 定位「近战范围」）。冷却节奏：无目标时冷却钳到 0，出敌立刻开火。

- [ ] **Step 1: 写失败测试**

创建 `tests/engine/hero.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { heroAttack, pickTargets } from '../../src/engine/hero.js';
import { HERO, ENEMY_TYPES } from '../../src/engine/config.js';

// t=0.9 时三条路径均在射程内（lane0 距离102，lane1/2 约52.8）
// t=0.1 时均远超 180px 射程
function makeState(enemyTs) {
  return {
    coins: 0,
    nextEnemyId: 1,
    enemies: enemyTs.map(([lane, t]) => ({
      id: 0, type: 'bing', lane, t,
      hp: ENEMY_TYPES.bing.hp, hpMax: ENEMY_TYPES.bing.hp,
    })).map((e, i) => ({ ...e, id: i + 1 })),
    hero: { atkCooldown: 0 },
  };
}

describe('pickTargets 射程筛选', () => {
  it('只返回射程内敌人', () => {
    const s = makeState([[0, 0.9], [1, 0.9], [2, 0.9], [0, 0.1]]);
    const ids = pickTargets(s).map((e) => e.id);
    expect(ids).toEqual([1, 2, 3]);
  });
});

describe('heroAttack 范围普攻', () => {
  it('对射程内全体造成 HERO.atk 伤害并进入冷却', () => {
    const s = makeState([[0, 0.9], [1, 0.9], [0, 0.1]]);
    heroAttack(s, 0.0167);
    expect(s.enemies.find((e) => e.id === 1).hp)
      .toBe(ENEMY_TYPES.bing.hp - HERO.atk);
    expect(s.enemies.find((e) => e.id === 2).hp)
      .toBe(ENEMY_TYPES.bing.hp - HERO.atk);
    expect(s.enemies.find((e) => e.id === 3).hp)
      .toBe(ENEMY_TYPES.bing.hp); // 远处敌不受影响
    expect(s.hero.atkCooldown).toBeCloseTo(HERO.atkInterval, 5);
  });

  it('无目标：不攻击、不进入冷却', () => {
    const s = makeState([]);
    heroAttack(s, 0.0167);
    expect(s.hero.atkCooldown).toBe(0);
  });

  it('冷却中：不攻击', () => {
    const s = makeState([[0, 0.9]]);
    s.hero.atkCooldown = 1.0;
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(ENEMY_TYPES.bing.hp);
    expect(s.hero.atkCooldown).toBeCloseTo(1.0 - 0.0167, 3);
  });

  it('冷却剩余小于 dt：本轮立即开火', () => {
    const s = makeState([[0, 0.9]]);
    s.hero.atkCooldown = 0.005;
    heroAttack(s, 0.0167);
    expect(s.enemies[0].hp).toBe(ENEMY_TYPES.bing.hp - HERO.atk);
  });

  it('伤害致死时正常结算移除与金币', () => {
    const s = makeState([[1, 0.9]]);
    s.enemies[0].hp = 60; // 恰好一刀
    heroAttack(s, 0.0167);
    expect(s.enemies).toHaveLength(0);
    expect(s.coins).toBe(ENEMY_TYPES.bing.reward);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL —— `Cannot find module '../../src/engine/hero.js'`。

- [ ] **Step 3: 实现 hero.js**

创建 `src/engine/hero.js`：

```js
// engine/hero.js — 赵云：范围普攻（spec 4.1「近战范围」定位）
import { HERO, HERO_POS } from './config.js';
import { pathPoint } from './enemy.js';
import { dealDamage } from './combat.js';

export function pickTargets(state) {
  return state.enemies.filter((e) => {
    const p = pathPoint(e.lane, e.t);
    return Math.hypot(p.x - HERO_POS.x, p.y - HERO_POS.y) <= HERO.atkRange;
  });
}

export function heroAttack(state, dtSec) {
  const h = state.hero;
  h.atkCooldown = Math.max(0, h.atkCooldown - dtSec);
  if (h.atkCooldown > 0) return;
  const targets = pickTargets(state);
  if (targets.length === 0) return;
  h.atkCooldown = HERO.atkInterval;
  for (const e of targets) {
    dealDamage(state, e.id, HERO.atk);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/engine/hero.js tests/engine/hero.test.js
git commit -m "feat(engine): 赵云范围普攻（射程内全体目标+冷却节奏）"
```

---

### Task 6: engine/wave.js 波次编排

**Files:**
- Create: `src/engine/wave.js`
- Test: `tests/engine/wave.test.js`

状态机：`interval`（波间歇倒计时）→ `startWave` → `wave`（刷怪推进）→ 清场（队列空且敌空）→ 下一波 `interval` 或终波 `victory`。

- [ ] **Step 1: 写失败测试**

创建 `tests/engine/wave.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { startWave, updateWave } from '../../src/engine/wave.js';
import { WAVES, WAVE_INTERVAL } from '../../src/engine/config.js';

function makeState() {
  return {
    wave: 0,
    stage: 'interval',
    stageClock: 99,
    waveClock: 0,
    spawnQueue: [],
    enemies: [],
    nextEnemyId: 1,
  };
}

describe('startWave', () => {
  it('构建刷怪队列并进入 wave 阶段', () => {
    const s = makeState();
    startWave(s, 1);
    expect(s.wave).toBe(1);
    expect(s.stage).toBe('wave');
    expect(s.waveClock).toBe(0);
    expect(s.spawnQueue).toHaveLength(WAVES[0].events.length);
    expect(s.spawnQueue[0]).toEqual({ at: 0.5, type: 'bing', lane: 0 });
  });
});

describe('updateWave — wave 阶段', () => {
  it('到点刷怪：at≤waveClock 的事件入战场并出队', () => {
    const s = makeState();
    startWave(s, 1);
    updateWave(s, 0.6); // waveClock=0.6 ≥ 首事件 0.5
    expect(s.enemies).toHaveLength(1);
    expect(s.spawnQueue).toHaveLength(WAVES[0].events.length - 1);
  });

  it('未到点不刷怪', () => {
    const s = makeState();
    startWave(s, 1);
    updateWave(s, 0.1);
    expect(s.enemies).toHaveLength(0);
  });

  it('队列空且场清：非终波进入 interval', () => {
    const s = makeState();
    startWave(s, 1);
    s.spawnQueue = [];
    s.enemies = [];
    updateWave(s, 0.1);
    expect(s.stage).toBe('interval');
    expect(s.stageClock).toBe(WAVE_INTERVAL);
  });

  it('队列空且场清：终波（第3波）直接 victory', () => {
    const s = makeState();
    startWave(s, 3);
    s.spawnQueue = [];
    s.enemies = [];
    updateWave(s, 0.1);
    expect(s.stage).toBe('victory');
  });
});

describe('updateWave — interval 阶段', () => {
  it('倒计时归零自动开启下一波', () => {
    const s = makeState();
    s.stage = 'interval';
    s.stageClock = 1.0;
    updateWave(s, 1.1);
    expect(s.wave).toBe(1);
    expect(s.stage).toBe('wave');
  });

  it('倒计时未到不切波', () => {
    const s = makeState();
    s.stage = 'interval';
    s.stageClock = 2.0;
    updateWave(s, 1.0);
    expect(s.stage).toBe('interval');
    expect(s.wave).toBe(0);
  });

  it('victory/over 阶段冻结不推进', () => {
    const s = makeState();
    s.stage = 'victory';
    s.stageClock = 5;
    updateWave(s, 10);
    expect(s.stage).toBe('victory');
    const s2 = makeState();
    s2.stage = 'over';
    updateWave(s2, 10);
    expect(s2.stage).toBe('over');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL —— `Cannot find module '../../src/engine/wave.js'`。

- [ ] **Step 3: 实现 wave.js**

创建 `src/engine/wave.js`：

```js
// engine/wave.js — 波次编排：interval → wave → 下一波 / victory
import { WAVES, TOTAL_WAVES, WAVE_INTERVAL } from './config.js';
import { spawnEnemy } from './enemy.js';

export function startWave(state, waveNo) {
  state.wave = waveNo;
  state.spawnQueue = WAVES[waveNo - 1].events.map(([at, type, lane]) => ({
    at, type, lane,
  }));
  state.waveClock = 0;
  state.stage = 'wave';
}

export function updateWave(state, dtSec) {
  if (state.stage === 'interval') {
    state.stageClock -= dtSec;
    if (state.stageClock <= 0) startWave(state, state.wave + 1);
    return;
  }
  if (state.stage !== 'wave') return; // victory/over 冻结

  state.waveClock += dtSec;
  while (state.spawnQueue.length > 0 && state.spawnQueue[0].at <= state.waveClock) {
    const ev = state.spawnQueue.shift();
    spawnEnemy(state, ev.type, ev.lane);
  }

  if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
    if (state.wave >= TOTAL_WAVES) {
      state.stage = 'victory';
      return;
    }
    state.stage = 'interval';
    state.stageClock = WAVE_INTERVAL;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/engine/wave.js tests/engine/wave.test.js
git commit -m "feat(engine): 波次编排状态机（interval/wave/victory/over）"
```

---

### Task 7: engine/state.js 主状态机（纯函数入口）

**Files:**
- Create: `src/engine/state.js`
- Test: `tests/engine/state.test.js`

`advanceFrame(state, inputs, dtMs) → newState`：structuredClone 入参 → 按固定 16.667ms tick 切片推进 → 返回新 state。入参不被变异（纯度测试守卫）。终态（victory/over）后时间冻结。

- [ ] **Step 1: 写失败测试**

创建 `tests/engine/state.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { HP_MAX, TOTAL_WAVES } from '../../src/engine/config.js';

describe('createBattle', () => {
  it('初始状态完整', () => {
    const s = createBattle();
    expect(s.hp).toBe(HP_MAX);
    expect(s.hpMax).toBe(HP_MAX);
    expect(s.coins).toBe(0);
    expect(s.wave).toBe(0);
    expect(s.stage).toBe('interval');
    expect(s.enemies).toEqual([]);
    expect(s.hero.pos).toEqual({ x: 360, y: 640 });
    expect(s.hero.atkCooldown).toBe(0);
    expect(s.nextEnemyId).toBe(1);
    expect(s.frame).toBe(0);
  });
});

describe('advanceFrame 纯函数契约', () => {
  it('不变异入参', () => {
    const s = createBattle();
    const before = JSON.stringify(s);
    advanceFrame(s, null, 1000);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('大 dt 切片推进：1 秒 ≈ 60 tick，time 前进 1s', () => {
    const s = createBattle();
    const s2 = advanceFrame(s, null, 1000);
    expect(s2.time).toBeCloseTo(1.0, 1);
    expect(s2.frame).toBeGreaterThanOrEqual(59);
    expect(s2.frame).toBeLessThanOrEqual(61);
  });

  it('多次小步与大步推进结果一致（确定性）', () => {
    const a = createBattle();
    let s = a;
    for (let i = 0; i < 30; i++) s = advanceFrame(s, null, 16.667);
    const b = createBattle();
    const s2 = advanceFrame(b, null, 30 * 16.667);
    expect(s.time).toBeCloseTo(s2.time, 1);
    expect(s.stage).toBe(s2.stage);
    expect(s.enemies.length).toBe(s2.enemies.length);
  });
});

describe('战斗终局', () => {
  it('漏怪扣守军血；血量归零进入 over 且时间冻结', () => {
    let s = createBattle();
    s.hp = 1;
    s.stage = 'wave';           // 直接构造 wave 场景
    s.spawnQueue = [];
    s.wave = 1;
    s.enemies = [{ id: 1, type: 'qi', lane: 0, t: 0.999, hp: 1, hpMax: 220 }];
    s = advanceFrame(s, null, 200);
    expect(s.stage).toBe('over');
    expect(s.hp).toBe(0);
    const frame = s.frame;
    const frozen = advanceFrame(s, null, 5000);
    expect(frozen.frame).toBe(frame); // 终态时间冻结
  });

  it('集成验收：全程自动战斗 3 波全通 victory 且满血', () => {
    let s = createBattle();
    let guard = 0;
    while (s.stage !== 'victory' && s.stage !== 'over' && guard < 300) {
      s = advanceFrame(s, null, 1000);
      guard++;
    }
    expect(s.stage).toBe('victory');
    expect(s.wave).toBe(TOTAL_WAVES);
    expect(s.hp).toBe(HP_MAX); // 数值已验算：不漏怪
    expect(s.coins).toBeGreaterThan(0);
    expect(s.enemies).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL —— `Cannot find module '../../src/engine/state.js'`。

- [ ] **Step 3: 实现 state.js**

创建 `src/engine/state.js`：

```js
// engine/state.js — 纯函数主状态机
// advanceFrame(state, inputs, dtMs) → newState
// 对外纯函数（克隆入参）；内部按 16.667ms 固定 tick 确定性推进（M1 无随机）
import { HP_MAX, HERO_POS, WAVE_INTERVAL } from './config.js';
import { moveEnemies } from './enemy.js';
import { heroAttack } from './hero.js';
import { updateWave } from './wave.js';

const TICK_MS = 1000 / 60;

export function createBattle() {
  return {
    frame: 0,
    time: 0,
    hp: HP_MAX,
    hpMax: HP_MAX,
    coins: 0,
    wave: 0,
    stage: 'interval',   // 'wave' | 'interval' | 'victory' | 'over'
    stageClock: 1.5,     // 开场 1.5s 后第一波
    waveClock: 0,
    spawnQueue: [],
    enemies: [],
    nextEnemyId: 1,
    hero: { pos: { ...HERO_POS }, atkCooldown: 0 },
    _acc: 0,             // dt 残差累积（内部）
  };
}

export function advanceFrame(state, inputs, dtMs) {
  const s = structuredClone(state);
  s._acc += dtMs;
  while (s._acc >= TICK_MS) {
    s._acc -= TICK_MS;
    tick(s, inputs);
    s.frame++;
    if (s.stage === 'over' || s.stage === 'victory') {
      s._acc = 0; // 终态时间冻结
      break;
    }
  }
  return s;
}

function tick(s, inputs) {
  const dt = TICK_MS / 1000;
  s.time += dt;
  updateWave(s, dt);
  if (s.stage !== 'wave' && s.stage !== 'interval') return;
  const leaked = moveEnemies(s, dt);
  for (const e of leaked) {
    s.hp -= e.dmg;
  }
  if (s.hp <= 0) {
    s.hp = 0;
    s.stage = 'over';
    return;
  }
  heroAttack(s, dt);
}
```

> 注：`inputs` 参数 M1 保留签名不消费（spec 契约，M2 锦囊拖拽接入）。若集成测试 `victory` 断言失败（数值边界），优先微调 `ENEMY_TYPES` 的 `speed`（±10%）或 `HERO.atkInterval`（±0.05）后重跑。

- [ ] **Step 4: 运行全部测试确认通过**

Run: `pnpm test`
Expected: PASS（config/enemy/combat/hero/wave/state/smoke 全绿，含 3 波全通集成验收）。

- [ ] **Step 5: Commit**

```bash
git add src/engine/state.js tests/engine/state.test.js
git commit -m "feat(engine): 纯函数主状态机 advanceFrame + 3 波全通集成验收"
```

---

### Task 8: 渲染层 + H5 容器

**Files:**
- Create: `src/render/battle.js`
- Create: `src/containers/h5/index.html`
- Create: `src/containers/h5/main.js`

渲染只读 state：每帧 `drawBattle(ctx, state)` 把 state 画出来。复用 `window.Art`（IIFE，普通 script 先于 module 加载）。`?speed=N` 查询参数做时间倍率，供验收快进。

- [ ] **Step 1: 实现 render/battle.js**

创建 `src/render/battle.js`：

```js
// render/battle.js — 战场渲染：只读 state，每帧重绘
import { LOGICAL_W, LOGICAL_H, LANES, HERO_POS } from '../engine/config.js';
import { pathPoint } from '../engine/enemy.js';

export function drawBattle(ctx, state) {
  const Art = window.Art;
  Art.drawBattleBackdrop(0, 0, LOGICAL_W, LOGICAL_H);
  drawLanes(ctx);
  for (const e of state.enemies) {
    const p = pathPoint(e.lane, e.t);
    Art.drawEnemyToken(ctx, p.x, p.y, 26, e.type, e.hp / e.hpMax);
  }
  Art.drawHeroToken(ctx, HERO_POS.x, HERO_POS.y, 34, 1);
  drawHud(ctx, state);
  drawStageBanner(ctx, state);
}

function drawLanes(ctx) {
  ctx.save();
  ctx.strokeStyle = 'rgba(90,80,64,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  for (const lane of LANES) {
    ctx.beginPath();
    ctx.moveTo(lane[0].x, lane[0].y);
    for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x, lane[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud(ctx, state) {
  const Art = window.Art;
  Art.drawHudPill(ctx, 24, 24, 200, 44, `守军 ${state.hp}/${state.hpMax}`, 'ink');
  Art.drawHudPill(ctx, 260, 24, 130, 44, `第${state.wave || '一'}波`, 'bronze');
  Art.drawHudPill(ctx, LOGICAL_W - 24 - 130, 24, 130, 44, `金 ${state.coins}`, 'gold');
}

// 阶段横幅：波间歇倒计时 / 胜负终态
function drawStageBanner(ctx, state) {
  const cx = LOGICAL_W / 2;
  const cy = LOGICAL_H * 0.42;
  const Art = window.Art;
  if (state.stage === 'interval' && state.wave === 0) {
    banner(ctx, cx, cy, '长坂坡 · 备战', `第 1 波即将来袭`);
  } else if (state.stage === 'interval') {
    banner(ctx, cx, cy, `第 ${state.wave} 波 已清`, `下一波 ${Math.ceil(state.stageClock)} 秒后`);
  } else if (state.stage === 'victory') {
    banner(ctx, cx, cy, '大 获 全 胜', `七进七出 · 守军 ${state.hp}/${state.hpMax}`);
  } else if (state.stage === 'over') {
    banner(ctx, cx, cy, '阵 线 失 守', `止步第 ${state.wave} 波`);
  }
}

function banner(ctx, cx, cy, title, sub) {
  const Art = window.Art;
  Art.drawPanel(ctx, cx - 190, cy - 54, 380, 108, false);
  const fs = 44;
  ctx.fillStyle = '#1f1b16';
  ctx.font = `bold ${fs}px "KaiTi","STKaiti","楷体",serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, cx, cy - 18);
  ctx.fillStyle = '#9e2a1e';
  ctx.font = '22px "KaiTi","STKaiti","楷体",serif';
  ctx.fillText(sub, cx, cy + 24);
}
```

- [ ] **Step 2: 实现 containers/h5/main.js**

创建 `src/containers/h5/main.js`：

```js
// containers/h5/main.js — 帧循环：rAF → advanceFrame → drawBattle
import { createBattle, advanceFrame } from '../../engine/state.js';
import { LOGICAL_W, LOGICAL_H } from '../../engine/config.js';
import { drawBattle } from '../../render/battle.js';

const canvas = document.getElementById('game');
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
const ctx = canvas.getContext('2d');

// ?speed=N 时间倍率（验收快进用，1-10，默认 1）
const SPEED = Math.max(1, Math.min(10,
  Number(new URLSearchParams(location.search).get('speed')) || 1));

let state = createBattle();
let last = performance.now();

function loop(now) {
  const dtMs = Math.min(now - last, 100); // 切后台回来防大步积压
  last = now;
  state = advanceFrame(state, null, dtMs * SPEED);
  drawBattle(ctx, state);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

- [ ] **Step 3: 实现 containers/h5/index.html**

创建 `src/containers/h5/index.html`：

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>七进七出 · M1 核心战斗</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #1a1410; }
    canvas {
      display: block;
      height: 100dvh;
      max-width: 100vw;
      margin: 0 auto;
    }
  </style>
  <script src="../../render/art.js"></script>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

注意加载顺序：`art.js` 是普通 script（同步执行，先挂 `window.Art`），`main.js` 是 module（defer 语义，后执行）——`window.Art` 必然就绪。

- [ ] **Step 4: 启动 dev server 冒烟**

Run: `pnpm dev`（后台）
Expected: vite 输出 `Local: http://localhost:5173/`，无编译错误。浏览器打开 `http://localhost:5173/` 应看到宣纸底战场 + 三条虚线墨径 + 居中赵云圆牌，1.5s 后第一波敌人沿路径涌入并被赵云攻击，HUD 三牌数值跳动。

- [ ] **Step 5: Commit**

```bash
git add src/render/battle.js src/containers/h5/index.html src/containers/h5/main.js
git commit -m "feat(render+h5): 战场渲染与 H5 容器帧循环（?speed 快进支持）"
```

---

### Task 9: 浏览器验收（手机视口截图硬规范）

**Files:** 无新文件（验收任务）

- [ ] **Step 1: 确认 dev server 存活**

Run: `pnpm dev`（若未在跑，后台启动）
Expected: `http://localhost:5173/` 可访问。

- [ ] **Step 2: 手机视口截图（390×844, dpr=2）**

用 browser_use 代理：
1. 打开 `http://localhost:5173/?speed=4`
2. 视口设 390×844，deviceScaleFactor=2
3. 立即截图 A（开场备战横幅 + 第一波接敌）
4. 等待约 40 秒（speed=4 下全程约 23 秒真实时间）后截图 B
Expected: 截图 B 为「大获全胜」横幅 + 守军 15/15；Console 无红色报错。

- [ ] **Step 3: 战败路径抽查**

打开 `http://localhost:5173/?speed=10` 前先在 DevTools console 执行不可行（engine 无外露）——战败路径已由单测覆盖（state.test.js「漏怪扣守军血」），浏览器只验正常通关。若截图 B 未达 victory：
1. 查 Console 报错并修复
2. 若为数值漏怪：微调 `src/engine/config.js` 的 `speed`（±10%）或 `HERO.atkInterval`（±0.05），重跑 `pnpm test`（集成验收会先行暴露）再截图

- [ ] **Step 4: 归档截图**

截图存 `docs/screenshots/m1/`（A/B 两张），加入 git。

- [ ] **Step 5: Commit**

```bash
git add docs/screenshots/m1/
git commit -m "test(m1): 手机视口验收截图——3 波全通 victory（390×844 dpr2）"
```

---

### Task 10: 全量回归 + 收尾

- [ ] **Step 1: 全量单测**

Run: `pnpm test`
Expected: 全部 PASS（7 个测试文件）。

- [ ] **Step 2: M1 里程碑记录**

在 `docs/specs/2026-10-03-sanguo-tower-design.md` 第八章 M1 行尾追加状态标注 `✅ 2026-10-03`（只改这一处）。

- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-10-03-sanguo-tower-design.md
git commit -m "docs(spec): M1 核心战斗验收完成标注"
```

- [ ] **Step 4: 汇报交付**

向用户汇报：M1 完成清单（engine 6 模块 + 测试 7 文件 + H5 容器 + 截图）、下一步 M2（锦囊合成 + 肉鸽三选一 + 大招演出）待启动。

---

## Self-Review 记录

1. **Spec 覆盖**: M1 行「engine 纯函数 + H5 容器跑通 3 波战斗 / 浏览器可玩 / engine 单测通过」→ Task 2-7（engine + 单测）、Task 8（H5 容器）、Task 9（浏览器验收 + 截图硬规范）。spec §3.2 局内循环（三路径涌入/自动攻击/漏怪扣血/波次推进）→ Task 3/5/6/7。spec §6.2 视觉元素（圆牌/血条/HUD/横幅）→ Task 8 全部走 `window.Art` 既有 API。锦囊/三选一/大招明确划出 M1 边界 ✓
2. **Placeholder 扫描**: 所有代码步骤均给出完整可编译代码；无 TBD/TODO/「类似 Task N」✓
3. **类型一致性**: `pathPoint(laneIdx, t)` / `dealDamage(state, enemyId, amount)` / `pickTargets(state)` / `heroAttack(state, dtSec)` / `startWave(state, waveNo)` / `updateWave(state, dtSec)` / `moveEnemies(state, dtSec)` / `spawnEnemy(state, type, laneIdx)` / `createBattle()` / `advanceFrame(state, inputs, dtMs)` —— 各任务引用与定义逐一核对一致；enemy type 取值 `'bing'|'qi'|'gong'|'shuai'` 与 art.js `ENEMY_TEXT` 约定一致 ✓
