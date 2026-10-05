# M7 终局三模式+扩池+功勋+音频+分享 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec 第十一章实现 M7：终局三模式（无尽/每日挑战/车轮战）+ 周瑜张辽扩池 + 功勋成就 + 音效 BGM + 分享公告。

**Architecture:** 三模式复用 engine 现有 `createBattle/advanceFrame`（`state.mode` 分支 + `opts` 注入）；助战被动经 battle 入参传入（engine 零 save 依赖）；成就进度由 `save.stats` 累计派生；音频 WebAudio 程序化合成 + 文件预留通道；零新增图片资产。

**Tech Stack:** 原生 JS ESM + Canvas 2D + vitest（engine/meta 层 TDD）+ vite（H5）+ wx-mini 构建链。

**Spec:** `docs/specs/2026-10-03-sanguo-tower-design.md` 第十一章（11.1–11.7）。

---

## 执行注意（所有任务共用）

- 环境：Windows PowerShell。**命令分隔用 `;`，禁止 `&&`**。
- 测试命令（统计两行结果）：
  ```
  pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }
  ```
- 单文件测试：`pnpm vitest run tests/xxx.test.js`
- **基线 186/186（27 文件）绿**才可开工；每任务结束必须全绿再 commit。
- commit 风格：`feat(m7): 中文描述` / `fix(m7): 中文描述`；**仓库无 remote，严禁 push**。
- 提交前禁止 `git add -A`，按文件逐个 add。
- UI 坐标体系：逻辑画布 720×1280；渲染工具函数 `panel(ctx,x,y,w,h)` / `btn(ctx,x,y,w,h,label,style,size)` / `heroSeal(ctx,cx,cy,r,char,filled,gold)` / `topbar(ctx,save,title)` 来自 `src/render/ui.js`；色彩 `C.paper/C.ink/C.gold/C.cinnabar/C.ok/C.mut/C.gray`；字体 `${KAI}`。
- engine 层纯函数：不得 import meta/render/platform；save 依赖只在 core/meta 层。

## 文件结构总览

| 动作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/meta/heroes.js` | HEROES 9 人 + GACHA_POOL 8 人 + BOND_HEROES_ALL |
| 修改 | `src/meta/save.js` | defaultSave/loadSave 迁移：heroes 2 键、progress 4 键、stats、settings、achievements、noticesRead |
| 修改 | `src/meta/meta.js` | 汉室云集 8 人羁绊 |
| 修改 | `src/engine/state.js` | createBattle opts：mode/dailyAffix/bonus；终态分支 |
| 修改 | `src/engine/wave.js` | endless 程序化波 / bossrush 编排 / daily 全词缀 |
| 修改 | `src/engine/enemy.js` | spawnEnemy burnMul（周瑜被动） |
| 修改 | `src/engine/combat.js` | （若灼烧结算在此处，与 enemy.js 二选一实际为准） |
| 新建 | `src/meta/challenge.js` | 解锁判定 / 每日词缀 / 周词缀 / best 更新 |
| 修改 | `src/meta/iap.js`（chapterMul 引用不变） | 无改 |
| 新建 | `src/render/challenge.js` | 征战屏绘制+命中 |
| 修改 | `src/render/home.js` | 征战大卡+功能行四格+英雄 9 格 |
| 修改 | `src/render/result.js` | modeText 徽标 |
| 修改 | `src/render/quests.js` | 四 tab + 功勋列表 |
| 新建 | `src/meta/achievements.js` | 18 项成就表+进度+领取 |
| 新建 | `src/platform/audio.js` | WebAudio 适配+8 音效+BGM 合成+开关 |
| 新建 | `src/platform/share.js` | wx 分享 / H5 剪贴板 |
| 新建 | `src/meta/notices.js` | 公告表+未读 |
| 新建 | `src/render/notices.js` | 公告屏 |
| 修改 | `src/app/core.js` | 路由/结算埋点/音效触发/分享/公告/征战/功勋接入 |
| 修改 | `src/containers/h5/main.js`、`src/containers/wx-mini/game.js` | initAudio 注入 |
| 新建 | `tests/*.test.js` ×6 | 各任务测试 |

---

### Task 1: 武将扩池 + 双被动（周瑜灼烧/张辽突袭）+ 主城 9 格

**Files:**
- Modify: `src/meta/heroes.js`
- Modify: `src/meta/save.js`（defaultSave heroes + loadSave 迁移）
- Modify: `src/meta/meta.js`（汉室云集羁绊）
- Modify: `src/engine/state.js`（opts.bonus 透传）
- Modify: `src/engine/enemy.js`（spawnEnemy burnMul）
- Modify: `src/engine/wave.js`（startWave 前 3 波 frontHpCut）
- Modify: `src/render/home.js`（9 格布局常量）
- Test: `tests/m7-heroes.test.js`

- [ ] **Step 1.1: 写失败测试**

```js
// tests/m7-heroes.test.js — M7 扩池：周瑜/张辽 + 双被动 + 8 人羁绊
import { describe, it, expect } from 'vitest';
import { HEROES, GACHA_POOL, BOND_HEROES, BOND_HEROES_ALL } from '../src/meta/heroes.js';
import { defaultSave, loadSave } from '../src/meta/save.js';
import { atkMul, bondActive, bondAllActive } from '../src/meta/meta.js';
import { createBattle } from '../src/engine/state.js';
import { spawnEnemy } from '../src/engine/enemy.js';
import { startWave } from '../src/engine/wave.js';

describe('M7 扩池', () => {
  it('HEROES 含周瑜/张辽 SSR，GACHA_POOL 8 人', () => {
    expect(HEROES.zhouyu.quality).toBe('SSR');
    expect(HEROES.zhangliao.quality).toBe('SSR');
    expect(GACHA_POOL).toHaveLength(8);
    expect(GACHA_POOL).toContain('zhouyu');
    expect(GACHA_POOL).toContain('zhangliao');
  });

  it('defaultSave 补两英雄键；旧档 loadSave 迁移补齐', () => {
    const d = defaultSave();
    expect(d.heroes.zhouyu).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
    expect(d.heroes.zhangliao).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
    // 旧档模拟：无两键
    globalThis.localStorage = {
      getItem: () => JSON.stringify({ ...d, heroes: { zhaoyun: d.heroes.zhaoyun } }),
      setItem: () => {},
    };
    const s = loadSave();
    expect(s.heroes.zhouyu).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
    expect(s.heroes.zhangliao).toEqual({ owned: false, stars: 1, level: 1, frags: 0 });
  });

  it('羁绊：6 人全家福 +15%；8 人汉室云集 +25% 取大', () => {
    const s = defaultSave();
    BOND_HEROES.forEach((id) => { s.heroes[id].owned = true; });   // 仅 6 人
    expect(bondActive(s)).toBe(true);
    expect(bondAllActive(s)).toBe(false);
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.15);
    BOND_HEROES_ALL.forEach((id) => { s.heroes[id].owned = true; }); // 8 人全
    expect(bondAllActive(s)).toBe(true);
    expect(atkMul(s, 'zhaoyun')).toBeCloseTo(1.25); // 取大不叠加
  });

  it('周瑜被动：burnBonus 经 createBattle 注入 spawnEnemy 的 burnMul', () => {
    const st = createBattle(1, { bonus: { burnBonus: 0.6, frontHpCut: 0 } });
    spawnEnemy(st, 'bing', 0, 1, 1, null);
    expect(st.enemies[0].burnMul).toBeCloseTo(1.6);
    const st0 = createBattle(1, {});
    spawnEnemy(st0, 'bing', 0, 1, 1, null);
    expect(st0.enemies[0].burnMul ?? 1).toBe(1);
  });

  it('张辽被动：前 3 波敌 hp ×(1-frontHpCut)，第 4 波起还原', () => {
    const st = createBattle(1, { bonus: { burnBonus: 0, frontHpCut: 0.24 } });
    st.wave = 2; startWave(st);   // 前 3 波
    expect(st.spawnQueue[0].hpMul).toBeCloseTo(0.76);
    st.wave = 4; startWave(st);
    expect(st.spawnQueue[0].hpMul).toBe(1);
  });

  it('HOME_LAYOUT 9 格：step 74 / r 32 / x0 27', async () => {
    const L = (await import('../src/render/home.js')).HOME_LAYOUT;
    expect(L.heroStep).toBe(74);
    expect(L.heroR).toBe(32);
    expect(L.heroX0).toBe(27);
  });
});
```

- [ ] **Step 1.2: 跑测试确认失败**

Run: `pnpm vitest run tests/m7-heroes.test.js`
Expected: FAIL（zhouyu/zhangliao undefined、BOND_HEROES_ALL 未导出等）

- [ ] **Step 1.3: 实现 heroes.js**

`HEROES` 表按拼音顺序插入两行（保持现有格式）：

```js
  zhangliao:  { name: '张辽',   quality: 'SSR', tag: '突袭压制', obtain: '抽卡',     initial: false, char: '辽' },
  zhouyu:     { name: '周瑜',   quality: 'SSR', tag: '火计灼烧', obtain: '抽卡',     initial: false, char: '瑜' },
```

```js
export const GACHA_POOL = ['zhaoyun', 'guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong', 'zhangliao', 'zhouyu'];
export const BOND_HEROES = ['zhaoyun', 'guanyu', 'zhangfei', 'zhugeliang', 'machao', 'huangzhong']; // 蜀国全家福 6 人（不变）
export const BOND_HEROES_ALL = [...BOND_HEROES, 'zhangliao', 'zhouyu']; // 汉室云集 8 人（M7）
```

- [ ] **Step 1.4: 实现 save.js**

defaultSave 的 heroes 对象加两键（在 lvbu 行后）：

```js
      zhangliao: { owned: false, stars: 1, level: 1, frags: 0 },
      zhouyu: { owned: false, stars: 1, level: 1, frags: 0 },
```

loadSave 迁移段（M6 补齐之后）加：

```js
    // M7 扩池补齐：旧档可能缺周瑜/张辽键
    for (const id of ['zhangliao', 'zhouyu']) {
      parsed.heroes[id] ??= { owned: false, stars: 1, level: 1, frags: 0 };
    }
```

- [ ] **Step 1.5: 实现 meta.js 羁绊**

meta.js 顶部 import 改 `import { STAR_MAX, FRAGS_PER_STAR, BOND_HEROES, BOND_HEROES_ALL } from './heroes.js';`，常量区加 `export const BOND_ALL_MUL = 1.25;`，新增：

```js
export function bondAllActive(save) {
  return BOND_HEROES_ALL.every((id) => save.heroes[id] && save.heroes[id].owned);
}
```

`atkMul(save, heroId)` 内 bond 段改为取大不叠加：

```js
  const bond = bondAllActive(save) ? BOND_ALL_MUL : bondActive(save) ? BOND_ATK_MUL : 1;
```

（保留原 bondActive/星级段逻辑不动。）

- [ ] **Step 1.6: 实现 engine 双被动**

`state.js` createBattle，在 `state.chapterPackRate = ...` 行后加：

```js
  // M7 助战被动注入（core 由 save 算好传入；engine 不读 save）
  state.burnBonus = opts.bonus?.burnBonus || 0;   // 周瑜：灼烧 DOT 伤害 +20%/★
  state.frontHpCut = opts.bonus?.frontHpCut || 0; // 张辽：前 3 波敌 hp −8%/★
```

`enemy.js` spawnEnemy 的 push 对象加一字段（`burnT: 0` 行后）：

```js
    burnMul: 1 + (state.burnBonus || 0), // M7 周瑜被动：灼烧增伤乘区（enemy.js 灼烧结算已乘 burnMul）
```

`wave.js` startWave 的 `const mul = 1 + (state.wave - 1) * ENEMY_GROWTH;` 行改为：

```js
  let mul = 1 + (state.wave - 1) * ENEMY_GROWTH;
  if (state.wave <= 3 && state.frontHpCut) mul *= (1 - state.frontHpCut); // M7 张辽：开局压制
```

（注：enemy.js L70 灼烧结算已有 `(e.burnMul || 1)` 乘区，burnMul 默认 1 行为零回归。）

- [ ] **Step 1.7: 实现 home.js 9 格**

HOME_LAYOUT 前三常量改：

```js
  heroY: 300, heroR: 32, heroStep: 74, heroX0: 27,   // M7 9 格横排
```

（drawHome/hitHome 均按 `Object.keys(HEROES)` 循环，布局常量改后自动 9 格；名字/星标字号 20/16 已足够容纳 74px 间距，不动。）

- [ ] **Step 1.8: 全量测试**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿（186 基线 + 新增 6 用例；若既有测试断言 7 格/6 人池，按 M7 口径同步修正该断言并在 commit message 注明）

- [ ] **Step 1.9: Commit**

```powershell
git add src/meta/heroes.js src/meta/save.js src/meta/meta.js src/engine/state.js src/engine/enemy.js src/engine/wave.js src/render/home.js tests/m7-heroes.test.js
git commit -m "feat(m7): 周瑜张辽扩池+灼烧/开局双被动+汉室云集羁绊+主城9格"
```

---

### Task 2: engine 三模式核心 + meta/challenge.js

**Files:**
- Modify: `src/engine/state.js`（mode/dailyAffix 终态分支）
- Modify: `src/engine/wave.js`（endless 程序化波 / bossrush 编排 / daily 全词缀）
- New: `src/meta/challenge.js`（解锁/每日词缀/周词缀）
- Test: `tests/m7-challenge-engine.test.js`

- [ ] **Step 2.1: 写失败测试**

```js
// tests/m7-challenge-engine.test.js — M7 三模式 engine 核心
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../src/engine/state.js';
import { startWave, updateWave } from '../src/engine/wave.js';
import { TOTAL_WAVES } from '../src/engine/config.js';
import { modeUnlocked, dailyAffixOf, weeklyAffix } from '../src/meta/challenge.js';

function defaultSaveLike() {
  return { progress: { chapter: 3, chapterClear: 4, waveBest: 0 } };
}

describe('M7 解锁与词缀', () => {
  const s = defaultSaveLike();
  it('阶梯解锁：daily≥1章 / endless≥2章 / bossrush≥4章', () => {
    expect(modeUnlocked(s, 'daily')).toBe(true);
    expect(modeUnlocked(s, 'endless')).toBe(true);
    expect(modeUnlocked(s, 'bossrush')).toBe(true);
    const s1 = { progress: { chapterClear: 1 } };
    expect(modeUnlocked(s1, 'daily')).toBe(true);
    expect(modeUnlocked(s1, 'endless')).toBe(false);
    expect(modeUnlocked(s1, 'bossrush')).toBe(false);
    const s0 = { progress: { chapterClear: 0 } };
    expect(modeUnlocked(s0, 'daily')).toBe(false);
  });
  it('dailyAffixOf 同日期确定性且在词缀池内', () => {
    expect(dailyAffixOf('2026-10-05')).toBe(dailyAffixOf('2026-10-05'));
    expect(dailyAffixOf('2026-10-06')).toBe(dailyAffixOf('2026-10-06'));
    expect(['iron', 'swift', 'sharp']).toContain(dailyAffixOf('2026-10-05'));
  });
  it('weeklyAffix 在词缀池内且同周稳定', () => {
    expect(['iron', 'swift', 'sharp']).toContain(weeklyAffix());
    expect(weeklyAffix()).toBe(weeklyAffix());
  });
});

describe('M7 无尽模式', () => {
  it('16 波起程序化生成：count 增长 + hp ×1.08^(wave-15) + 永不 victory', () => {
    const st = createBattle(1, { mode: 'endless', chapterMul: 1 });
    st.wave = 16; startWave(st);
    // w1 基表 8 兵 → 第 2 轮次 lap=1 → count ×1.3 = 10.4 → 11
    expect(st.spawnQueue.length).toBe(11);
    // T1 已定口径：chMul 承载全部 hp 系数（chapterMul × endless 1.08^over）；hpMul 专供张辽减益
    expect(st.spawnQueue[0].chMul).toBeCloseTo(Math.pow(1.08, 1));
    st.spawnQueue = [];
    updateWave(st, 0.1); // 清空 → skillPick 而非 victory
    expect(st.stage).toBe('skillPick');
  });
  it('每清 5 波发金币（wave×10）', () => {
    const st = createBattle(1, { mode: 'endless' });
    st.wave = 5; st.coins = 0; st.spawnQueue = [];
    updateWave(st, 0.1);
    expect(st.coins).toBe(50);
  });
  it('advanceFrame 终态仅 over（chapter 不回归）', () => {
    const st = createBattle(1, { mode: 'endless' });
    st.stage = 'victory'; // 无尽不可能到达，但防御：终态冻结仍生效
    expect(advanceFrame(st, null, 16)).toBe(st);
  });
});

describe('M7 每日挑战', () => {
  it('daily：全员自带当日词缀（含 BOSS 波）', () => {
    const st = createBattle(12345, { mode: 'daily', dailyAffix: 'swift' });
    st.wave = 10; startWave(st); // BOSS 波
    expect(st.spawnQueue.every((e) => e.affix === 'swift')).toBe(true);
  });
  it('daily 同种子同波次确定性', () => {
    const a = createBattle(20261005, { mode: 'daily', dailyAffix: 'iron' });
    const b = createBattle(20261005, { mode: 'daily', dailyAffix: 'iron' });
    a.wave = 3; b.wave = 3; startWave(a); startWave(b);
    expect(JSON.stringify(a.spawnQueue)).toBe(JSON.stringify(b.spawnQueue));
  });
  it('daily 15 波清完仍 victory（可领奖）', () => {
    const st = createBattle(1, { mode: 'daily' });
    st.wave = TOTAL_WAVES; st.spawnQueue = [];
    updateWave(st, 0.1);
    expect(st.stage).toBe('victory');
  });
});

describe('M7 车轮战', () => {
  it('bossrush：每轮 2 帅带随机词缀，hp ×(1+0.25(r-1))×chapterMul', () => {
    const st = createBattle(1, { mode: 'bossrush', chapterMul: 2 });
    st.wave = 1; startWave(st);
    expect(st.bossRound).toBe(1);
    expect(st.spawnQueue).toHaveLength(2);
    expect(st.spawnQueue.every((e) => e.type === 'shuai')).toBe(true);
    expect(st.spawnQueue[0].chMul).toBeCloseTo(2);        // r=1 → ×1
    expect(st.spawnQueue.every((e) => e.affix)).toBe(true);
    st.wave = 3; startWave(st);                            // r=3 → ×1.5
    expect(st.spawnQueue[0].chMul).toBeCloseTo(3);
  });
  it('bossrush 清波进 skillPick（轮间歇）而非 victory', () => {
    const st = createBattle(1, { mode: 'bossrush' });
    st.wave = 1; st.spawnQueue = []; st.enemies = [];
    updateWave(st, 0.1);
    expect(st.stage).toBe('skillPick');
  });
});
```

- [ ] **Step 2.2: 跑测试确认失败**

Run: `pnpm vitest run tests/m7-challenge-engine.test.js`
Expected: FAIL（modeUnlocked 等未导出、mode 分支未实现）

- [ ] **Step 2.3: 实现 meta/challenge.js**

```js
// src/meta/challenge.js — M7 征战模式：解锁阶梯 / 每日词缀 / 周词缀 / 最佳记录
// 日期与词缀逻辑全在 meta 层；engine 只吃 createBattle opts（零 save/日期依赖）
import { AFFIX_KEYS } from '../engine/config.js';

export function modeUnlocked(save, mode) {
  const c = save.progress.chapterClear || 0;
  if (mode === 'daily') return c >= 1;
  if (mode === 'endless') return c >= 2;
  if (mode === 'bossrush') return c >= 4;
  return false;
}

// 每日词缀：日期串哈希 → 词缀池均匀映射（同日全服同词条，确定性）
export function dailyAffixOf(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  return AFFIX_KEYS[h % AFFIX_KEYS.length];
}

// 车轮战周词缀：ISO 周数 % 3
export function weeklyAffix(now = new Date()) {
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return AFFIX_KEYS[week % AFFIX_KEYS.length];
}

export function bestOf(save, mode) {
  if (mode === 'endless') return save.progress.endlessBest || 0;
  if (mode === 'bossrush') return save.progress.bossBest || 0;
  return 0;
}

export function setBest(save, mode, v) {
  if (mode === 'endless') save.progress.endlessBest = Math.max(save.progress.endlessBest || 0, v);
  if (mode === 'bossrush') save.progress.bossBest = Math.max(save.progress.bossBest || 0, v);
}
```

- [ ] **Step 2.4: 实现 wave.js 三分支**

`wave.js` 顶部 import 加 `TOTAL_WAVES`（现有 import 补充），startWave 整体替换为：

```js
// 波开始：chapter/daily/endless 走组成表，bossrush 走专用编排
// 口径（T1 已定）：chMul 承载全部 hp 系数（chapterMul × endless 1.08^over × bossrush 递增）；
//                 hpMul 专供张辽开局减益事件因子（updateWave 折算 spawnEnemy 形参）
export function startWave(state) {
  if (state.mode === 'bossrush') return startBossRushWave(state);
  const pack = CHAPTER_PACKS[state.packIdx || 0];
  // M7 无尽：组成表按 (wave-1)%len 轮换（chapter 波次 ≤len 行为不变）
  const comp = pack.waveComps[(state.wave - 1) % pack.waveComps.length];
  const mul = 1 + (state.wave - 1) * ENEMY_GROWTH;
  const hpMul = state.wave <= 3 && state.frontHpCut ? 1 - state.frontHpCut : 1; // 张辽：开局压制（前 3 波）
  // M7 无尽难度：15 波后 hp ×1.08^(wave-15) 指数递增
  const endlessOver = state.mode === 'endless' && state.wave > TOTAL_WAVES ? state.wave - TOTAL_WAVES : 0;
  const chMul = (state.chapterMul || 1) * (endlessOver ? Math.pow(1.08, endlessOver) : 1);
  const rate = state.chapterPackRate ?? 0;
  const bossWave = state.wave <= TOTAL_WAVES && BOSS_WAVES.includes(state.wave);
  const lap = Math.floor((state.wave - 1) / pack.waveComps.length); // M7 无尽轮次
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (const [type, count0] of comp) {
    const count = state.mode === 'endless' ? Math.ceil(count0 * (1 + 0.3 * lap)) : count0;
    const gap = Math.max(SPAWN_GAP_MIN, 6 / count);
    for (let i = 0; i < count; i++) {
      // M6 精英词缀；M7 每日挑战：全员固定当日词缀（含 BOSS）
      const affix = state.mode === 'daily' && state.dailyAffix ? state.dailyAffix
        : (bossWave || rngNext(state.rng) < rate)
          ? AFFIX_KEYS[Math.floor(rngNext(state.rng) * AFFIX_KEYS.length)]
          : null;
      events.push({ at, type, lane, mul, chMul, hpMul, affix });
      at += gap;
      lane = (lane + 1) % 3;
    }
  }
  events.sort((a, b) => a.at - b.at);
  state.spawnQueue = events;
  state.stageClock = 0;
  state.stage = 'wave';
}

// M7 车轮战：第 r 轮 2 个 shuai 带随机词缀，hp ×(1+0.25(r-1))×chapterMul，无小兵
function startBossRushWave(state) {
  state.bossRound = (state.bossRound || 0) + 1;
  const r = state.bossRound;
  const chMul = (1 + 0.25 * (r - 1)) * (state.chapterMul || 1);
  const events = [];
  let at = 0.5;
  let lane = 0;
  for (let i = 0; i < 2; i++) {
    const affix = AFFIX_KEYS[Math.floor(rngNext(state.rng) * AFFIX_KEYS.length)];
    events.push({ at, type: 'shuai', lane, mul: 1, chMul, hpMul: 1, affix });
    at += 1.2;
    lane = (lane + 1) % 3;
  }
  state.spawnQueue = events;
  state.stageClock = 0;
  state.stage = 'wave';
}
```

注意：原实现 `pack.waveComps[state.wave - 1]` 在 endless wave>15 时越界 undefined，必须按上面的 `(state.wave - 1) % pack.waveComps.length` 写。`bossWave` 加 `state.wave <= TOTAL_WAVES` 防无尽轮次反复触发必带词缀。

`updateWave` 的清波判定替换为：

```js
  if (!state.spawnQueue.length && state.enemies.length === 0) {
    if (state.mode === 'endless') {
      if (state.wave % 5 === 0) state.coins += state.wave * 10; // 每 5 波额外金币
      state.stage = 'skillPick'; // 无尽永不 victory
    } else {
      state.stage = state.wave >= TOTAL_WAVES ? 'victory' : 'skillPick';
    }
  }
```

- [ ] **Step 2.5: 实现 state.js mode 字段**

createBattle 在 `state.chapterPackRate = ...` 后加：

```js
  // M7 模式：'chapter'（缺省零回归）| 'endless' | 'daily' | 'bossrush'
  state.mode = opts.mode || 'chapter';
  state.dailyAffix = opts.dailyAffix || null;
  state.bossRound = 0;
```

- [ ] **Step 2.6: 全量测试**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿（含既有 186；wave 改动对 chapter 模式零影响——`(wave-1)%len` 与直接索引在 wave≤15 时等价）

- [ ] **Step 2.7: Commit**

```powershell
git add src/engine/state.js src/engine/wave.js src/meta/challenge.js tests/m7-challenge-engine.test.js
git commit -m "feat(m7): engine三模式核心（无尽程序化波/每日种子词缀/车轮战编排）+解锁词缀meta层"
```

---

### Task 3: 征战屏 + 主城入口 + 结算入档

**Files:**
- New: `src/render/challenge.js`
- Modify: `src/render/home.js`（征战大卡 + 功能行四格 + hitHome）
- Modify: `src/render/result.js`（modeText 徽标）
- Modify: `src/app/core.js`（startBattle/finishBattle 模式化 + 路由）
- Modify: `src/meta/save.js`（progress 4 键迁移）
- Test: `tests/m7-challenge-ui.test.js`

- [ ] **Step 3.1: save.js progress 迁移**

defaultSave 的 progress 行改：

```js
    progress: { chapter: 1, chapterClear: 0, waveBest: 0, endlessBest: 0, bossBest: 0, dailyPaid: '', bossPaid: '' },
```

loadSave 迁移段加：

```js
    // M7 征战字段补齐
    parsed.progress.endlessBest ??= 0;
    parsed.progress.bossBest ??= 0;
    parsed.progress.dailyPaid ??= '';
    parsed.progress.bossPaid ??= '';
```

- [ ] **Step 3.2: 写失败测试**

```js
// tests/m7-challenge-ui.test.js — 征战屏绘制/命中 + 结算模式化
import { describe, it, expect } from 'vitest';
import { CHALLENGE_LAYOUT, hitChallenge } from '../src/render/challenge.js';
import { HOME_LAYOUT, hitHome } from '../src/render/home.js';
import { hitResult } from '../src/render/result.js';

const save = {
  wallet: {}, heroes: {}, progress: { chapter: 3, chapterClear: 4, endlessBest: 32, bossBest: 7, dailyPaid: '', bossPaid: '' },
};

describe('M7 征战屏', () => {
  it('三模式卡布局常量齐备', () => {
    expect(CHALLENGE_LAYOUT.cards).toHaveLength(3);
    expect(CHALLENGE_LAYOUT.back).toBeTruthy();
  });
  it('命中：点 daily 卡返回挑战 action；返回键 back', () => {
    const c = CHALLENGE_LAYOUT.cards[0]; // daily
    expect(hitChallenge(c.x + 10, c.y + 10, save)).toEqual({ action: 'mode', mode: 'daily' });
    expect(hitChallenge(CHALLENGE_LAYOUT.back.x + 5, CHALLENGE_LAYOUT.back.y + 5, save)).toEqual({ action: 'back' });
  });
  it('主城征战卡与功能行四格命中', () => {
    expect(hitHome(HOME_LAYOUT.challengeCard.x + 10, HOME_LAYOUT.challengeCard.y + 10, save)).toEqual({ action: 'challenge' });
    const t = HOME_LAYOUT.toolRow;
    expect(hitHome(t.x + 10, t.y + 10, save)).toEqual({ action: 'achv' });
    expect(hitHome(t.x + t.cell + 10, t.y + 10, save)).toEqual({ action: 'share' });
    expect(hitHome(t.x + t.cell * 2 + 10, t.y + 10, save)).toEqual({ action: 'notices' });
    expect(hitHome(t.x + t.cell * 3 + 10, t.y + 10, save)).toEqual({ action: 'sound' });
  });
  it('result modeText 不影响既有命中', () => {
    const data = { win: true, chapterN: 2, doubled: false, modeText: '无尽模式 · 32 波' };
    expect(hitResult(100, 1160, data)).toEqual({ action: 'again' });
  });
});
```

- [ ] **Step 3.3: 跑测试确认失败**

Run: `pnpm vitest run tests/m7-challenge-ui.test.js`
Expected: FAIL（challenge.js 不存在、HOME_LAYOUT 无 challengeCard/toolRow）

- [ ] **Step 3.4: 实现 render/challenge.js**

```js
// render/challenge.js — M7 征战屏：三模式竖卡（解锁阶梯 + 个人最佳）
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { KAI, C, panel, heroSeal, btn, topbar } from './ui.js';

export const CHALLENGE_LAYOUT = {
  back: { x: 20, y: 20, w: 80, h: 60 },
  cards: [
    { key: 'daily', x: 20, y: 110, w: 680, h: 300 },
    { key: 'endless', x: 20, y: 430, w: 680, h: 300 },
    { key: 'bossrush', x: 20, y: 750, w: 680, h: 300 },
  ],
  playBtn: { w: 160, h: 64 },
};

const META = {
  daily: { seal: '日', name: '每日挑战', desc: '固定种子全服同关 · 通关领 ◆50', lockAt: '通关第 1 章解锁' },
  endless: { seal: '无', name: '无尽模式', desc: '波次无限递增 · 每 5 波发金币', lockAt: '通关第 2 章解锁' },
  bossrush: { seal: '车', name: 'BOSS 车轮战', desc: '帅连续来袭 · 击败数计分', lockAt: '通关第 4 章解锁' },
};

function bestText(mode, save) {
  if (mode === 'endless') return save.progress.endlessBest ? `最佳战绩 ${save.progress.endlessBest} 波` : '暂无战绩';
  if (mode === 'bossrush') return save.progress.bossBest ? `最佳战绩 ${save.progress.bossBest} BOSS` : '暂无战绩';
  return save.progress.dailyPaid === '' ? '今日奖励待领 ◆50' : '今日已完成';
}

export function drawChallenge(ctx, save, unlocked) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  topbar(ctx, save, '征 战');
  ctx.fillStyle = C.paper; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('征 战', LOGICAL_W / 2, 50);
  // 返回
  btn(ctx, CHALLENGE_LAYOUT.back.x, CHALLENGE_LAYOUT.back.y, CHALLENGE_LAYOUT.back.w, CHALLENGE_LAYOUT.back.h, '← 返', 'ghost', 26);
  CHALLENGE_LAYOUT.cards.forEach((card) => {
    const m = META[card.key];
    const open = unlocked[card.key];
    panel(ctx, card.x, card.y, card.w, card.h);
    heroSeal(ctx, card.x + 70, card.y + 90, 46, m.seal, true, open);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink; ctx.font = `700 34px ${KAI}`;
    ctx.fillText(m.name, card.x + 140, card.y + 56);
    ctx.fillStyle = C.mut; ctx.font = `600 24px ${KAI}`;
    ctx.fillText(m.desc, card.x + 140, card.y + 102);
    ctx.fillStyle = C.gold; ctx.font = `700 26px ${KAI}`;
    ctx.fillText(bestText(card.key, save), card.x + 140, card.y + 150);
    if (open) {
      const b = CHALLENGE_LAYOUT.playBtn;
      btn(ctx, card.x + card.w - b.w - 30, card.y + card.h - b.h - 30, b.w, b.h, '挑 战', 'cinnabar', 30);
    } else {
      ctx.fillStyle = C.gray; ctx.font = `600 26px ${KAI}`;
      ctx.fillText(`🔒 ${m.lockAt}`, card.x + 140, card.y + 205);
    }
  });
}

export function hitChallenge(x, y, save) {
  const L = CHALLENGE_LAYOUT;
  if (x >= L.back.x && x <= L.back.x + L.back.w && y >= L.back.y && y <= L.back.y + L.back.h) return { action: 'back' };
  for (const card of L.cards) {
    if (x >= card.x && x <= card.x + card.w && y >= card.y && y <= card.y + card.h) return { action: 'mode', mode: card.key };
  }
  return null;
}
```

- [ ] **Step 3.5: 实现 home.js 征战卡 + 功能行**

HOME_LAYOUT 加两常量（skinCard 后）：

```js
  challengeCard: { x: 30, y: 830, w: 660, h: 130 },                 // M7 征战大卡
  toolRow: { x: 20, y: 980, w: 680, h: 90, cell: 170 },             // M7 功能行四格
```

drawHome 在 drawSkinCard 调用后加：

```js
  // M7 征战大卡（每日挑战可挑战/可领奖红点）
  const cc = L.challengeCard;
  panel(ctx, cc.x, cc.y, cc.w, cc.h);
  heroSeal(ctx, cc.x + 80, cc.y + cc.h / 2, 46, '征', true, true);
  ctx.fillStyle = C.ink; ctx.font = `700 40px ${KAI}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('征 战', cc.x + 150, cc.y + 46);
  ctx.fillStyle = C.mut; ctx.font = `600 26px ${KAI}`;
  ctx.fillText('无尽 · 每日挑战 · 车轮战', cc.x + 150, cc.y + 94);
  // M7 功能行四格：功勋/分享/公告/声音（红点由 core 传参 redDots）
  drawToolRow(ctx, save, L.toolRow, redDots);
```

drawHome 签名改为 `drawHome(ctx, save, selectedHero = 'zhaoyun', redDots = {})`；模块底部新增：

```js
const TOOLS = [
  { key: 'achv', char: '功', label: '功勋' },
  { key: 'share', char: '享', label: '分享' },
  { key: 'notices', char: '公', label: '公告' },
  { key: 'sound', char: '声', label: '声音' },
];

function drawToolRow(ctx, save, row, redDots) {
  TOOLS.forEach((t, i) => {
    const x = row.x + i * row.cell;
    panel(ctx, x, row.y, row.cell - 10, row.h);
    heroSeal(ctx, x + 44, row.y + row.h / 2, 26, t.char, true, false);
    ctx.fillStyle = C.ink; ctx.font = `600 26px ${KAI}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(t.label, x + 84, row.y + row.h / 2);
    if (redDots[t.key]) {
      ctx.fillStyle = C.cinnabar;
      ctx.beginPath();
      ctx.arc(x + row.cell - 34, row.y + 22, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
```

hitHome 在 `if (inBtn(L.skinCard))` 行后加：

```js
  if (inBtn(L.challengeCard)) return { action: 'challenge' };
  if (y >= L.toolRow.y && y <= L.toolRow.y + L.toolRow.h) {
    const i = Math.floor((x - L.toolRow.x) / L.toolRow.cell);
    if (i >= 0 && i < 4) return { action: TOOLS[i].key };
  }
```

（hitHome 需要访问 save 才算红点吗？不需要——hitHome 只管命中，签名保持 `hitHome(x, y)`。测试里 `hitHome(x, y, save)` 多传参数无害。）

- [ ] **Step 3.6: 实现 result.js modeText**

drawResult 在「第N章 · 15 波」fillText 行后加：

```js
  if (data.modeText) {
    ctx.fillStyle = C.cinnabar; ctx.font = `700 28px ${KAI}`;
    ctx.fillText(data.modeText, LOGICAL_W / 2, 250);
  }
```

同时该行章节文案在非 chapter 模式下改为通用（modeText 优先展示）：

```js
  ctx.fillStyle = C.ink; ctx.font = `700 34px ${KAI}`;
  ctx.fillText(data.modeText ? data.modeTitle || '' : `第${data.chapterN}章 · 15 波 ${data.win ? '通关' : '止步'}`, LOGICAL_W / 2, 200);
```

hitResult 不变。

- [ ] **Step 3.7: core.js 接入**

imports 增补：

```js
import { drawChallenge, hitChallenge } from '../render/challenge.js';
import { modeUnlocked, dailyAffixOf, weeklyAffix, bestOf, setBest } from '../meta/challenge.js';
```

screen 注释行扩为 `home | detail | gacha | battle | result | signin | shop | revive | quests | challenge | notices`。

`startBattle(chapterN)` 改为 `startBattle(chapterN, mode = 'chapter')`，战斗构造段替换：

```js
    // M7：模式化开战。daily 种子=YYYYMMDD、词缀=当日；chMul 挑战模式取当前章
    const seed = mode === 'daily' ? Number(todayStr().replace(/-/g, '')) : 20260304 + chapterN;
    const bonus = {
      atkMul: atkMul(save, 'zhaoyun'),
      chapterMul: mode === 'chapter' ? chapterMul(chapterN) : chapterMul(save.progress.chapter),
      mode,
      dailyAffix: mode === 'daily' ? dailyAffixOf(todayStr()) : null,
      battleBonus: battleBonus(save),
    };
    battleState = createBattle(seed, bonus);
    battleState.chapterN = chapterN;
    battleState.mode = mode;
```

（`battleState.mode` 冗余存一份供结算读取，engine 内部以 state.mode 为准。）

模块级新增（startBattle 前）：

```js
  // M7 助战被动：周瑜灼烧 +20%/★、张辽开局 −8%/★（engine 零 save 依赖）
  function battleBonus(save) {
    const b = { burnBonus: 0, frontHpCut: 0 };
    if (save.heroes.zhouyu?.owned) b.burnBonus = 0.2 * save.heroes.zhouyu.stars;
    if (save.heroes.zhangliao?.owned) b.frontHpCut = 0.08 * save.heroes.zhangliao.stars;
    return b;
  }
```

注意 createBattle opts 命名：Task 1 用 `opts.bonus`，这里传 `battleBonus: battleBonus(save)`——统一为 `bonus: battleBonus(save)`，与 Task 1 的 `opts.bonus?.burnBonus` 对齐（测试代码亦用 `bonus:`）。

handlePointer 的 challenge 屏分支（hitTest 函数加一行）：

```js
    if (screen === 'challenge') return hitChallenge(x, y, save);
```

dispatch 加（home 分支后并列）：

```js
    } else if (screen === 'challenge') {
      if (hit.action === 'back') screen = 'home';
      if (hit.action === 'mode') {
        if (modeUnlocked(save, hit.mode)) startBattle(save.progress.chapter, hit.mode);
        else showToast('未解锁 · 先通关章节');
      }
```

home 分支的 dispatch 加入口与功能行（`if (hit.action === 'quests')` 行后）：

```js
      if (hit.action === 'challenge') { screen = 'challenge'; }
      if (hit.action === 'achv') { screen = 'quests'; questTab = 'achv'; }
      if (hit.action === 'share') doShare();
      if (hit.action === 'notices') { screen = 'notices'; }
      if (hit.action === 'sound') cycleSound(save);
```

（`doShare/cycleSound` 在 Task 5/6 实现；本任务先占位 `function doShare() { showToast('M7 分享功能即将上线'); }` 与 `function cycleSound() {}`，Task 5/6 替换。）

`finishBattle()` 在 `const win = ...` 前加模式结算，resultData 组装替换为：

```js
  function finishBattle() {
    const win = battleState.stage === 'victory';
    const mode = battleState.mode || 'chapter';
    const st = battleState.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
    if (st.mergeCount) reportQuest(save, 'merge', st.mergeCount);
    if (st.ultCount) reportQuest(save, 'ult', st.ultCount);
    if (st.bossKills) reportQuest(save, 'boss_kill', st.bossKills);
    if (win) reportQuest(save, 'battle_win', 1);
    touchQuests(save);
    if (mode === 'endless') {
      const bestWave = battleState.wave; // 死亡/漏怪时的波数即战绩
      setBest(save, 'endless', bestWave);
      const coins = bestWave * 20;
      save.wallet.coins += coins;
      resultData = {
        win, chapterN: battleState.chapterN, mode,
        modeTitle: `无尽模式 · ${bestWave} 波`,
        modeText: `最佳 ${Math.max(save.progress.endlessBest, bestWave)} 波 · 金币 +${coins}`,
        rewards: { coins, diamonds: 0, frags: {} }, doubled: false,
      };
    } else if (mode === 'daily') {
      let diamonds = 0;
      if (win && save.progress.dailyPaid !== todayStr()) { save.progress.dailyPaid = todayStr(); diamonds = 50; }
      save.wallet.diamonds += diamonds;
      resultData = {
        win, chapterN: battleState.chapterN, mode,
        modeTitle: `每日挑战 · ${win ? '通关' : '未通关'}`,
        modeText: diamonds ? `首通奖励 ◆${diamonds}` : (win ? '今日奖励已领' : '失败可无限重试'),
        rewards: { coins: 0, diamonds, frags: {} }, doubled: false,
      };
    } else if (mode === 'bossrush') {
      const kills = st.bossKills || 0;
      setBest(save, 'bossrush', kills);
      let diamonds = 0;
      if (save.progress.bossPaid !== todayStr()) { save.progress.bossPaid = todayStr(); diamonds = Math.min(50, 5 * kills); }
      save.wallet.diamonds += diamonds;
      resultData = {
        win, chapterN: battleState.chapterN, mode,
        modeTitle: `车轮战 · 击败 ${kills} BOSS`,
        modeText: `最佳 ${save.progress.bossBest} BOSS` + (diamonds ? ` · 钻石 +${diamonds}` : ' · 今日奖励已领'),
        rewards: { coins: 0, diamonds, frags: {} }, doubled: false,
      };
    } else {
      resultData = {
        win, chapterN: battleState.chapterN,
        rewards: resultRewards(battleState.chapterN, win && battleState.firstClear, save),
        doubled: false,
      };
      if (win) applyRewardsWithProgress(resultData.rewards);
      else save.wallet.coins += resultData.rewards.coins;
    }
    persistSave(save);
    screen = 'result';
  }
```

loop 里 victory 判定对 endless/bossrush 不成立（engine 永不进 victory），over → revive → giveup → finishBattle 流转自然生效；daily victory 走既有 `stage === 'victory'` 分支。但 endless/bossrush 的 `battleState.stage === 'victory'` 永假，over 且未复活时进 revive 屏 —— 复活继续打符合「波次无限」设计，giveup 结算。无改动需要。

挑战模式体力照扣（startBattle 现有逻辑， chapterN 传当前章）。

- [ ] **Step 3.8: 全量测试**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿

- [ ] **Step 3.9: Commit**

```powershell
git add src/render/challenge.js src/render/home.js src/render/result.js src/app/core.js src/meta/save.js tests/m7-challenge-ui.test.js
git commit -m "feat(m7): 征战屏+主城征战卡/功能行+结算模式化入档（endless/daily/bossrush 奖励）"
```

---

### Task 4: 功勋（成就系统）+ 军务四 tab

**Files:**
- New: `src/meta/achievements.js`
- Modify: `src/meta/save.js`（stats + achievements + 迁移）
- Modify: `src/render/quests.js`（四 tab + 功勋列表渲染）
- Modify: `src/app/core.js`（stats 埋点 + achv tab 路由 + 红点）
- Test: `tests/m7-achievements.test.js`

- [ ] **Step 4.1: save.js stats/achievements 迁移**

defaultSave 加（quests 后）：

```js
    stats: { kills: 0, wins: 0, coinsEarned: 0, dailyWins: 0, gachaCount: 0 },
    achievements: { claimed: [] },
```

loadSave 迁移段加：

```js
    // M7 功勋：累计统计与已领集合
    parsed.stats = { ...defaultSave().stats, ...(parsed.stats || {}) };
    parsed.achievements = { claimed: [], ...(parsed.achievements || {}) };
    parsed.achievements.claimed ??= [];
```

- [ ] **Step 4.2: 写失败测试**

```js
// tests/m7-achievements.test.js — M7 功勋 18 项
import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS, achvProgress, achvClaimable, claimAchv, anyAchvClaimable } from '../src/meta/achievements.js';
import { defaultSave } from '../src/meta/save.js';

describe('M7 功勋', () => {
  it('成就表 18 项、id 唯一、奖励全为钻石', () => {
    expect(ACHIEVEMENTS).toHaveLength(18);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(18);
    ACHIEVEMENTS.forEach((a) => expect(a.reward.diamonds).toBeGreaterThan(0));
  });
  it('进度：击杀/通关/收集/星级/终局/财富派生自 save', () => {
    const s = defaultSave();
    s.stats.kills = 1000; s.stats.wins = 10;
    s.heroes.zhaoyun.owned = true; s.heroes.zhouyu.owned = true;
    s.heroes.zhaoyun.stars = 3;
    s.progress.endlessBest = 20; s.stats.dailyWins = 3;
    s.progress.bossBest = 5; s.stats.coinsEarned = 50000;
    const cur = (id) => achvProgress(s, ACHIEVEMENTS.find((a) => a.id === id));
    expect(cur('k1')).toBe(1000);
    expect(cur('w1')).toBe(10);
    expect(cur('c1')).toBe(2);
    expect(cur('s1')).toBe(3);
    expect(cur('e1')).toBe(20);
    expect(cur('d1')).toBe(3);
    expect(cur('b1')).toBe(5);
    expect(cur('f1')).toBe(50000);
  });
  it('可领与领取：达标未领可领；领取入钱包防重复', () => {
    const s = defaultSave();
    s.stats.kills = 1000;
    const a = ACHIEVEMENTS.find((x) => x.id === 'k1');
    expect(achvClaimable(s, a)).toBe(true);
    const d0 = s.wallet.diamonds;
    expect(claimAchv(s, a)).toBe(true);
    expect(s.wallet.diamonds).toBe(d0 + 30);
    expect(claimAchv(s, a)).toBe(false); // 防重复
    expect(achvClaimable(s, a)).toBe(false);
  });
  it('红点：任一可领为 true', () => {
    const s = defaultSave();
    s.stats.wins = 1;
    expect(anyAchvClaimable(s)).toBe(true);
  });
});
```

- [ ] **Step 4.3: 跑测试确认失败**

Run: `pnpm vitest run tests/m7-achievements.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 4.4: 实现 meta/achievements.js**

```js
// src/meta/achievements.js — M7 功勋：18 项四类，进度由 save 派生（spec 11.3）

// stat 取值：kills/wins/coinsEarned/dailyWins/gachaCount（save.stats）
//          collected（拥有英雄数）/ maxStar（最高星级）/ totalStar（总星级）
//          endlessBest / bossBest（save.progress）
export const ACHIEVEMENTS = [
  { id: 'k1', cat: '战斗', name: '千军辟易·千', stat: 'kills', goal: 1000, reward: { diamonds: 30 } },
  { id: 'k2', cat: '战斗', name: '千军辟易·万', stat: 'kills', goal: 10000, reward: { diamonds: 100 } },
  { id: 'w1', cat: '战斗', name: '百战功成·十', stat: 'wins', goal: 10, reward: { diamonds: 30 } },
  { id: 'w2', cat: '战斗', name: '百战功成·五十', stat: 'wins', goal: 50, reward: { diamonds: 100 } },
  { id: 'c1', cat: '养成', name: '广纳贤士·四', stat: 'collected', goal: 4, reward: { diamonds: 30 } },
  { id: 'c2', cat: '养成', name: '广纳贤士·八', stat: 'collected', goal: 8, reward: { diamonds: 80 } },
  { id: 's1', cat: '养成', name: '神威天将·三星', stat: 'maxStar', goal: 3, reward: { diamonds: 30 } },
  { id: 's2', cat: '养成', name: '神威天将·五星', stat: 'maxStar', goal: 5, reward: { diamonds: 80 } },
  { id: 't1', cat: '养成', name: '将星璀璨·二十', stat: 'totalStar', goal: 20, reward: { diamonds: 40 } },
  { id: 't2', cat: '养成', name: '将星璀璨·四十', stat: 'totalStar', goal: 40, reward: { diamonds: 100 } },
  { id: 'e1', cat: '终局', name: '无尽征途·二十波', stat: 'endlessBest', goal: 20, reward: { diamonds: 40 } },
  { id: 'e2', cat: '终局', name: '无尽征途·四十波', stat: 'endlessBest', goal: 40, reward: { diamonds: 100 } },
  { id: 'd1', cat: '终局', name: '日行一善·三次', stat: 'dailyWins', goal: 3, reward: { diamonds: 30 } },
  { id: 'd2', cat: '终局', name: '日行一善·十次', stat: 'dailyWins', goal: 10, reward: { diamonds: 80 } },
  { id: 'b1', cat: '终局', name: '万夫莫开·五帅', stat: 'bossBest', goal: 5, reward: { diamonds: 40 } },
  { id: 'b2', cat: '终局', name: '万夫莫开·十帅', stat: 'bossBest', goal: 10, reward: { diamonds: 100 } },
  { id: 'f1', cat: '财富', name: '富甲一方·五万', stat: 'coinsEarned', goal: 50000, reward: { diamonds: 30 } },
  { id: 'f2', cat: '财富', name: '富甲一方·二十万', stat: 'coinsEarned', goal: 200000, reward: { diamonds: 100 } },
];
```

```js
function statValue(save, stat) {
  if (stat === 'collected') return Object.values(save.heroes).filter((h) => h.owned).length;
  if (stat === 'maxStar') return Math.max(...Object.values(save.heroes).map((h) => h.stars || 1));
  if (stat === 'totalStar') return Object.values(save.heroes).reduce((n, h) => n + (h.owned ? h.stars || 1 : 0), 0);
  if (stat === 'endlessBest') return save.progress.endlessBest || 0;
  if (stat === 'bossBest') return save.progress.bossBest || 0;
  return save.stats[stat] || 0;
}

export function achvProgress(save, a) { return statValue(save, a.stat); }

export function achvClaimable(save, a) {
  return !save.achievements.claimed.includes(a.id) && achvProgress(save, a) >= a.goal;
}

export function claimAchv(save, a) {
  if (!achvClaimable(save, a)) return false;
  save.achievements.claimed.push(a.id);
  save.wallet.diamonds += a.reward.diamonds;
  return true;
}

export function anyAchvClaimable(save) {
  return ACHIEVEMENTS.some((a) => achvClaimable(save, a));
}
```

- [ ] **Step 4.5: 实现 render/quests.js 四 tab + 功勋列表**

TABS 改四签（`{ key: 'pass', label: '战令' }` 后加）：

```js
  { key: 'achv', label: '功勋' },
```

`QUESTS_LAYOUT.tabs` 改 `{ x0: 20, y: 190, w: 162, h: 64, gap: 10 }`（4×162+3×10=678，右边距 22 ✓）。

drawQuests 的 tab 分发加（`if (tab === 'pass') drawPass(...)` 平级）：

```js
  if (tab === 'achv') { drawAchv(ctx, save, achvRows); return; }
```

（drawQuests 签名扩参 `achvRows`——core 求值传入；或 drawQuests 内 import ACHIEVEMENTS 自行求值。**取舍：render 只画**，core 传 rows，同 quests 现有 rows 模式。）函数签名 `drawQuests(ctx, save, tab, rows, passData, achvRows)`。

模块新增（drawPass 后）：

```js
function drawAchv(ctx, save, rows) {
  const L = QUESTS_LAYOUT;
  ctx.fillStyle = C.ink; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('功勋 · 累计成就', LOGICAL_W / 2, L.tabs.y + 120);
  rows.forEach((r, i) => {
    const y = 300 + i * 92;
    if (y > 1180) return; // 视口截断（超过 10 行滚动不做，YAGNI：18 项分两页由后续迭代评估）
    panel(ctx, 20, y, 680, 82);
    ctx.fillStyle = C.ink; ctx.font = `700 26px ${KAI}`;
    ctx.textAlign = 'left';
    ctx.fillText(r.name, 40, y + 26);
    ctx.fillStyle = C.mut; ctx.font = `600 22px ${KAI}`;
    ctx.fillText(`${Math.min(r.cur, r.goal)} / ${r.goal}`, 40, y + 58);
    // 进度条（墨槽鎏金）
    ctx.fillStyle = C.ink; ctx.fillRect(330, y + 52, 220, 12);
    ctx.fillStyle = C.gold; ctx.fillRect(330, y + 52, 220 * Math.min(1, r.cur / r.goal), 12);
    if (r.claimed) {
      ctx.fillStyle = C.ok; ctx.font = `600 24px ${KAI}`;
      ctx.fillText('已领', 640, y + 41);
    } else if (r.claimable) {
      btn(ctx, 590, y + 16, 90, 50, '领取', 'cinnabar', 24);
    } else {
      ctx.fillStyle = C.gray; ctx.font = `600 24px ${KAI}`;
      ctx.fillText(`◆${r.reward}`, 640, y + 41);
    }
  });
}
```

hitQuests 签名同扩（`hitQuests(x, y, tab, rows, passData, achvRows)`），achv 分支（按钮盒：x 590–680，y = 行 y+16 到 y+66）：

```js
  if (tab === 'achv') {
    for (let i = 0; i < rows.length; i++) {
      const y = 300 + i * 92;
      if (y > 1180) break;
      const r = rows[i];
      if (r.claimable && x >= 590 && x <= 680 && y >= 316 + i * 92 && y <= 366 + i * 92) {
        return { action: 'achvClaim', id: r.id };
      }
    }
    return null;
  }
```

- [ ] **Step 4.6: core.js 埋点与路由**

imports 加：

```js
import { ACHIEVEMENTS, achvProgress, achvClaimable, claimAchv, anyAchvClaimable } from '../meta/achievements.js';
```

模块级新增：

```js
  function addStats(key, n) { save.stats[key] = (save.stats[key] || 0) + n; }
```

埋点位置（M6 finishBattle 基础上）：
- finishBattle：`addStats('kills', battleState.killCount || 0)`；`if (win) addStats('wins', 1)`；mode 分支里 daily win 领奖时 `addStats('dailyWins', 1)`；endless 结算 `addStats('coinsEarned', coins)`
- applyRewardsWithProgress：`addStats('coinsEarned', r.coins)`（函数首行）
- 战败安慰金币处：`addStats('coinsEarned', resultData.rewards.coins)`
- doPull 两处 reportQuest(save,'gacha',…) 后：`addStats('gachaCount', ten ? 10 : 1)`

questTab 注释更新为 `daily|weekly|pass|achv`；home 入口 `questTab='achv'`（Task 3 已接）。

`questRows()` 开头加：

```js
    if (questTab === 'achv') return []; // 功勋页无任务行（走 achvRows）
```

模块级新增：

```js
  function achvRows() {
    return ACHIEVEMENTS.map((a) => ({
      id: a.id, name: a.name, goal: a.goal,
      cur: achvProgress(save, a), reward: a.reward.diamonds,
      claimable: achvClaimable(save, a),
      claimed: save.achievements.claimed.includes(a.id),
    }));
  }
```

quests 屏绘制/命中调用改传 achvRows：`drawQuests(ctx, save, questTab, questRows(), passData(), achvRows())`；`hitQuests(x, y, questTab, questRows(), passData(), achvRows())`。dispatch quests 分支加：

```js
      if (hit.action === 'achvClaim') {
        const a = ACHIEVEMENTS.find((x) => x.id === hit.id);
        if (a && claimAchv(save, a)) {
          persistSave(save);
          showToast(`功勋达成 · 钻石+${a.reward.diamonds}`);
        }
      }
```

红点：home 绘制调用改传 redDots —— loop 中 `drawHome(ctx, save, selectedHero, { achv: anyAchvClaimable(save), notices: noticesUnread(save) })`（noticesUnread 在 Task 6 实现，本任务先传 `{ achv: anyAchvClaimable(save) }`）。

- [ ] **Step 4.7: 全量测试**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿

- [ ] **Step 4.8: Commit**

```powershell
git add src/meta/achievements.js src/meta/save.js src/render/quests.js src/app/core.js tests/m7-achievements.test.js
git commit -m "feat(m7): 功勋18项四类+军务四tab+stats累计埋点+领取落账红点"
```

---

### Task 5: 音效 BGM（WebAudio 合成 + 文件通道 + 开关）

**Files:**
- New: `src/platform/audio.js`
- Modify: `src/meta/save.js`（settings 迁移）
- Modify: `src/app/core.js`（触发点 + 声音格循环）
- Modify: `src/containers/h5/main.js`、`src/containers/wx-mini/game.js`（initAudio 注入）
- Test: `tests/m7-audio.test.js`

- [ ] **Step 5.1: save.js settings 迁移**

defaultSave 加（cosmetics 后）：`settings: { sound: true, bgm: true },`
loadSave 迁移段加：

```js
    parsed.settings = { sound: true, bgm: true, ...(parsed.settings || {}) };
```

- [ ] **Step 5.2: 写失败测试**

```js
// tests/m7-audio.test.js — M7 音频：合成调度（mock AudioContext）+ 开关状态机 + 文件通道
import { describe, it, expect, vi } from 'vitest';
import { initAudio, sfx, bgmStart, bgmStop, setSoundMode, soundModeCycle, AUDIO_FILES } from '../src/platform/audio.js';

function mockCtx() {
  const nodes = [];
  return {
    nodes,
    currentTime: 0,
    destination: {},
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
      nodes.push(o); return o;
    },
    createGain() {
      const g = { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
      nodes.push(g); return g;
    },
  };
}

describe('M7 音频', () => {
  it('未初始化/失败时 sfx 静默 no-op 不炸', () => {
    expect(() => sfx('click')).not.toThrow();
    initAudio(() => { throw new Error('no audio'); });
    expect(() => sfx('ult')).not.toThrow();
  });
  it('初始化后 sfx 调度 oscillator/gain；sound=false 时不调度', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: false } });
    const n0 = ctx.nodes.length;
    sfx('click');
    expect(ctx.nodes.length).toBeGreaterThan(n0);
    setSoundMode({ settings: { sound: false, bgm: false } });
    const n1 = ctx.nodes.length;
    sfx('coin');
    expect(ctx.nodes.length).toBe(n1); // 静音不调度
  });
  it('8 个音效名全部可触发', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: true } });
    for (const name of ['click', 'attack', 'ult', 'skill', 'coin', 'compose', 'win', 'lose']) {
      expect(() => sfx(name)).not.toThrow();
    }
  });
  it('开关三态循环：全开→仅音效→全关→全开', () => {
    expect(soundModeCycle({ sound: true, bgm: true })).toEqual({ sound: true, bgm: false });
    expect(soundModeCycle({ sound: true, bgm: false })).toEqual({ sound: false, bgm: false });
    expect(soundModeCycle({ sound: false, bgm: false })).toEqual({ sound: true, bgm: true });
  });
  it('BGM：开启时调度音符循环，关闭停止；AUDIO_FILES.bgm 缺省 null', () => {
    const ctx = mockCtx();
    initAudio(() => ctx);
    setSoundMode({ settings: { sound: true, bgm: true } });
    expect(() => bgmStart()).not.toThrow();
    expect(() => bgmStop()).not.toThrow();
    expect(AUDIO_FILES.bgm).toBeNull();
  });
});
```

- [ ] **Step 5.3: 跑测试确认失败**

Run: `pnpm vitest run tests/m7-audio.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 5.4: 实现 platform/audio.js**

```js
// platform/audio.js — M7 音频：双容器 WebAudio 适配（H5 AudioContext / wx.createWebAudioContext）
// 降级策略：工厂未注入或初始化失败 → 全部 no-op（同立绘回退模式，零风险）
// 文件通道：AUDIO_FILES.bgm 置路径常量即优先加载文件，失败回退合成（同广告桩零代码切换）

// 文件预留通道：上线前把 bgm 置为容器可及路径（如 'assets/audio/bgm.m4a'）
export const AUDIO_FILES = { bgm: null };

let ac = null;          // AudioContext 实例
let soundOn = true;     // 音效开关
let bgmOn = true;       // BGM 开关
let bgmTimer = null;    // BGM 续期定时器
const MASTER = 0.3;

export function initAudio(createCtx) {
  try { ac = createCtx ? createCtx() : null; } catch { ac = null; }
}

export function setSoundMode(save) {
  soundOn = !!save.settings?.sound;
  bgmOn = !!save.settings?.bgm;
  if (!bgmOn) bgmStop();
}

// 三态循环：全开 → 仅音效 → 全关 → 全开
export function soundModeCycle(cur) {
  if (cur.sound && cur.bgm) return { sound: true, bgm: false };
  if (cur.sound && !cur.bgm) return { sound: false, bgm: false };
  return { sound: true, bgm: true };
}

// 基础音符：freq 起始频率，dur 秒，type 波形，vol 音量，when 相对当前秒
function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol * MASTER, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* 音频设备异常静默 */ }
}

const SFX = {
  click:   () => tone(880, 0.06, 'square', 0.5, 0, 660),
  attack:  () => tone(220, 0.09, 'triangle', 0.7, 0, 110),
  ult:     () => { tone(80, 0.5, 'sine', 1.0, 0, 40); tone(160, 0.3, 'square', 0.4, 0.05, 60); },
  skill:   () => { tone(1046, 0.12, 'sine', 0.6); tone(1318, 0.12, 'sine', 0.6, 0.08); tone(1568, 0.2, 'sine', 0.6, 0.16); },
  coin:    () => { tone(1318, 0.08, 'sine', 0.6); tone(1975, 0.14, 'sine', 0.6, 0.06); },
  compose: () => { tone(523, 0.07, 'triangle', 0.8); tone(523, 0.07, 'triangle', 0.8, 0.1); },
  win:     () => [523, 587, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.6, i * 0.1)), // 五声上行
  lose:    () => { tone(330, 0.3, 'sine', 0.7, 0, 220); tone(220, 0.4, 'sine', 0.7, 0.25, 147); },
};

export function sfx(name) {
  if (!ac || !soundOn || !SFX[name]) return;
  SFX[name]();
}

// ===== BGM：五声音阶宫调式 16 小节循环（古琴拟音：基频+2次泛音指数衰减，tempo 72）
const GONG_SCALE = [261.6, 293.7, 329.6, 392.0, 440.0]; // 宫商角徵羽（C 五声）
const BGM_PATTERN = [0, 1, 2, 1, 4, 3, 2, 0, 1, 2, 3, 4, 3, 2, 1, 0]; // 16 音序列
const BGM_BEAT = 60 / 72 / 2; // 八分音符秒数

function pluck(freq, when) {
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    [1, 2, 3].forEach((h, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * h, t0);
      const v = 0.35 / (i + 1);
      g.gain.setValueAtTime(v * MASTER, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t0); osc.stop(t0 + 1);
    });
  } catch { /* 静默 */ }
}

export function bgmStart() {
  if (!ac || !bgmOn || bgmTimer) return;
  if (AUDIO_FILES.bgm) return; // 文件通道优先时走容器层播放（后续接），合成不启动
  let step = 0;
  const tick = () => {
    if (!bgmOn) return;
    const when = 0;
    pluck(GONG_SCALE[BGM_PATTERN[step % 16]], when);
    if (step % 4 === 0) pluck(GONG_SCALE[0] / 2, when + 0.02); // 低音宫锚定
    step++;
    bgmTimer = setTimeout(tick, BGM_BEAT * 1000);
  };
  tick();
}

export function bgmStop() {
  if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = null; }
}
```

- [ ] **Step 5.5: 容器注入**

`src/containers/h5/main.js`（createApp 调用前）：

```js
import { initAudio, bgmStart } from '../../platform/audio.js';
initAudio(() => new (window.AudioContext || window.webkitAudioContext)());
// 首次用户交互后启动 BGM（浏览器自动播放策略）
window.addEventListener('pointerdown', function once() {
  bgmStart();
  window.removeEventListener('pointerdown', once);
}, { once: true });
```

`src/containers/wx-mini/game.js`（createApp 调用前）：

```js
import { initAudio, bgmStart } from '../../platform/audio.js';
initAudio(() => (typeof wx !== 'undefined' && wx.createWebAudioContext) ? wx.createWebAudioContext() : null);
wx.onTouchStart && wx.onTouchStart(() => bgmStart());
```

- [ ] **Step 5.6: core.js 触发点**

imports 加 `import { sfx, setSoundMode, soundModeCycle, bgmStart } from '../platform/audio.js';`

- createApp 初始化段（setSkin 后）：`setSoundMode(save);`
- dispatch home 分支 `sound` action 实现（替换 Task 3 占位）：

```js
      if (hit.action === 'sound') {
        save.settings = soundModeCycle(save.settings);
        setSoundMode(save);
        if (save.settings.bgm) bgmStart();
        persistSave(save);
        const m = save.settings;
        showToast(m.sound && m.bgm ? '声音 · 全开' : m.sound ? '声音 · 仅音效' : '声音 · 全关');
      }
```

- 音效触发点（sfx 调用，位置对齐现有代码）：
  - handlePointer 进入（任何屏点击）：`sfx('click');`（dispatch 首行 `if (!hit) return;` 后）
  - startBattle 成功（screen = 'battle' 前）：`sfx('attack');`
  - 战斗锦囊合成成功处（core 现有 merge 上报同点若存在；局内三合一路径在 engine，core 无法逐次触发——**取舍：合成音效在 skillPick 选卡时播 'skill'，锦囊使用 clickSlot 处播 'compose'**）：`hitBattle` 结果消费处（handlePointer battle 分支）`if (battleState.pendingInputs?.clickSlot !== undefined || battleState.pendingInputs?.pickSkill !== undefined) sfx('compose');`（简化：pendingInputs 非空即播 'compose'）
  - 大招：pendingInputs 含 useUlt 时 `sfx('ult');`
  - finishBattle：`sfx(win ? 'win' : 'lose');`
  - 领取类成功（quests claim / achvClaim / 签到 / 抽卡出结果）：`sfx('coin');`
- [ ] **Step 5.7: 全量测试**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿

- [ ] **Step 5.8: Commit**

```powershell
git add src/platform/audio.js src/meta/save.js src/app/core.js src/containers/h5/main.js src/containers/wx-mini/game.js tests/m7-audio.test.js
git commit -m "feat(m7): WebAudio双容器适配+8合成音效+五声宫调BGM+文件通道+三态开关"
```

---

### Task 6: 分享 + 公告系统

**Files:**
- New: `src/platform/share.js`
- New: `src/meta/notices.js`
- New: `src/render/notices.js`
- Modify: `src/app/core.js`
- Test: `tests/m7-share-notices.test.js`

- [ ] **Step 6.1: 写失败测试**

```js
// tests/m7-share-notices.test.js — M7 分享降级 + 公告未读
import { describe, it, expect } from 'vitest';
import { shareApp } from '../src/platform/share.js';
import { NOTICES, noticesUnread, markNoticesRead, latestNoticeId } from '../src/meta/notices.js';
import { NOTICES_LAYOUT, hitNotices } from '../src/render/notices.js';
import { defaultSave } from '../src/meta/save.js';

describe('M7 分享', () => {
  it('H5 无 wx：走剪贴板降级返回 copied', async () => {
    const saved = globalThis.wx;
    globalThis.wx = undefined;
    const r = await shareApp({ title: '测试文案' });
    expect(r).toBe('copied');
    globalThis.wx = saved;
  });
  it('wx 环境：调 wx.shareAppMessage 返回 shared', async () => {
    const saved = globalThis.wx;
    let called = null;
    globalThis.wx = { shareAppMessage: (o) => { called = o; } };
    const r = await shareApp({ title: '测试文案', query: 'from=result' });
    expect(r).toBe('shared');
    expect(called.title).toBe('测试文案');
    expect(called.query).toBe('from=result');
    globalThis.wx = saved;
  });
});

describe('M7 公告', () => {
  it('NOTICES ≥2 条且 id/date/title/body 齐备', () => {
    expect(NOTICES.length).toBeGreaterThanOrEqual(2);
    NOTICES.forEach((n) => {
      expect(n.id && n.date && n.title && n.body).toBeTruthy();
    });
  });
  it('未读判定与已读标记', () => {
    const s = defaultSave();
    expect(noticesUnread(s)).toBe(true);       // 初始无已读戳 → 有未读
    markNoticesRead(s);
    expect(noticesUnread(s)).toBe(false);
    expect(s.noticesRead).toBe(latestNoticeId());
  });
  it('公告屏命中：返回键', () => {
    const b = NOTICES_LAYOUT.back;
    expect(hitNotices(b.x + 5, b.y + 5)).toEqual({ action: 'back' });
  });
});
```

- [ ] **Step 6.2: 跑测试确认失败**

Run: `pnpm vitest run tests/m7-share-notices.test.js`
Expected: FAIL

- [ ] **Step 6.3: 实现 platform/share.js**

```js
// platform/share.js — M7 分享：wx 主动分享 / H5 剪贴板降级
export async function shareApp({ title, query = '' }) {
  if (typeof wx !== 'undefined' && wx.shareAppMessage) {
    wx.shareAppMessage({ title, query });
    return 'shared';
  }
  // H5 降级：剪贴板复制（execCommand 兜底老浏览器）
  const text = title;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    return 'copied';
  } catch {
    return 'failed';
  }
}
```

- [ ] **Step 6.4: 实现 meta/notices.js**

```js
// meta/notices.js — M7 公告：本地配置表（运营更新此处即可，零代码下发）
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

// 未读：save.noticesRead 落后于最新公告 id 即视为有未读
export function noticesUnread(save) {
  return save.noticesRead !== latestNoticeId();
}

export function markNoticesRead(save) {
  save.noticesRead = latestNoticeId();
}
```

- [ ] **Step 6.5: 实现 render/notices.js**

```js
// render/notices.js — M7 公告屏：标题列表卡
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
  ctx.fillStyle = C.paper; ctx.font = `700 30px ${KAI}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('公 告', LOGICAL_W / 2, 50);
  btn(ctx, NOTICES_LAYOUT.back.x, NOTICES_LAYOUT.back.y, NOTICES_LAYOUT.back.w, NOTICES_LAYOUT.back.h, '← 返', 'ghost', 26);
  const L = NOTICES_LAYOUT;
  notices.forEach((n, i) => {
    const y = L.cardY0 + i * (L.cardH + L.cardGap);
    if (y + L.cardH > 1220) return; // 视口截断
    panel(ctx, 20, y, 680, L.cardH);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink; ctx.font = `700 30px ${KAI}`;
    ctx.fillText(n.title, 44, y + 44);
    ctx.fillStyle = C.mut; ctx.font = `600 22px ${KAI}`;
    ctx.fillText(n.date, 44, y + 84);
    ctx.fillStyle = C.ink; ctx.font = `600 24px ${KAI}`;
    // 手动换行（每行 24 全角字）
    for (let r = 0; r * 24 < n.body.length; r++) {
      ctx.fillText(n.body.slice(r * 24, (r + 1) * 24), 44, y + 124 + r * 34);
    }
  });
}

export function hitNotices(x, y) {
  const b = NOTICES_LAYOUT.back;
  if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { action: 'back' };
  return null;
}
```

- [ ] **Step 6.6: save.js noticesRead 迁移**

defaultSave 加：`noticesRead: '',`（顶层字段，achievements 后）
loadSave 迁移段加：`parsed.noticesRead ??= '';`

- [ ] **Step 6.7: core.js 接入**

imports：

```js
import { drawNotices, hitNotices } from '../render/notices.js';
import { NOTICES, noticesUnread, markNoticesRead } from '../meta/notices.js';
import { shareApp } from '../platform/share.js';
```

- 分享实现（替换 Task 3 占位 doShare）：

```js
  const SHARE_TITLES = [
    () => `我在《七进七出》无尽模式撑到 ${save.progress.endlessBest || 0} 波，守得住长坂坡吗？`,
    () => `我在《七进七出》车轮战击败 ${save.progress.bossBest || 0} 个 BOSS，敢来比比吗？`,
    () => `《七进七出》：赵云单骑守长坂坡，我已推到第 ${save.progress.chapter} 章！`,
  ];
  let shareIdx = 0;
  async function doShare() {
    shareIdx = (shareIdx + 1) % SHARE_TITLES.length;
    const r = await shareApp({ title: SHARE_TITLES[shareIdx](), query: 'from=home' });
    showToast(r === 'shared' ? '已发起分享' : r === 'copied' ? '分享文案已复制' : '分享失败');
  }
```

- 公告屏路由：hitTest 加 `if (screen === 'notices') return hitNotices(x, y);`；dispatch 加：

```js
    } else if (screen === 'notices') {
      if (hit.action === 'back') screen = 'home';
```

- loop 绘制分支加：

```js
    } else if (screen === 'notices') {
      drawNotices(ctx, save, NOTICES);
      if (noticesUnread(save)) { markNoticesRead(save); persistSave(save); } // 进入即已读
```

- home 红点（Task 4 的 drawHome 调用补 notices）：`{ achv: anyAchvClaimable(save), notices: noticesUnread(save) }`

- 结算页分享按钮（可选加分项）：result 屏 hitResult/drawResult 不改（YAGNI，主城分享已覆盖 spec 三个分享点中的动态文案；结算页分享通过 wx 被动分享菜单已可达）。**修正：spec 写明 3 分享点（主城/结算/无尽结算）——实现结算页入口**：result.js drawResult 在 again 按钮上方加分享 ghost 按钮（x 160, y 640 与广告位同区，无广告/已翻倍时显示）：

```js
  if (!(data.win && !data.doubled)) {
    btn(ctx, 160, 640, 400, 84, '📣 分享战绩', 'ghost', 28);
  }
```

hitResult 对应：`if (!(data.win && !data.doubled) && inBtn(adBtn)) return { action: 'share' };`；core result 分支加 `if (hit.action === 'share') doShare();`。广告可点时分享让位广告（激励优先，商业位不变）。

- [ ] **Step 6.8: 全量测试**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿

- [ ] **Step 6.9: Commit**

```powershell
git add src/platform/share.js src/meta/notices.js src/render/notices.js src/render/result.js src/meta/save.js src/app/core.js tests/m7-share-notices.test.js
git commit -m "feat(m7): 分享三态降级+公告本地表+未读红点+结算页分享按钮"
```

---

### Task 7: 回归 + 冒烟 + 截图 + spec 标注

**Files:**
- Modify: `docs/specs/2026-10-03-sanguo-tower-design.md`（第八章 M7 行标 ✅）
- New: `docs/screenshots/m7/`（冒烟截图）
- Test: 全量 + build:wx

- [ ] **Step 7.1: 全量回归**

Run: `pnpm test 2>&1 | Select-String -Pattern 'Test Files|Tests ' | ForEach-Object { $_.Line }`
Expected: 全绿（约 186+25 ≈ 210+ 用例）

- [ ] **Step 7.2: wx 构建体积断言**

Run: `pnpm run build:wx`
Expected: 构建成功，首包 ≤4MB（无新增图片资产，仅代码增量 ~30KB）

- [ ] **Step 7.3: H5 冒烟（browser_use 手机视口 390×844 dpr2）**

`pnpm dev` 起 5173；**保持标签页前台（canvas rAF 失焦冻结）**。按序验证并截图存 `docs/screenshots/m7/`：

1. 主城新布局：征战大卡 + 功能行四格 + 英雄 9 格（`shot-01-home.png`）
2. 征战屏三卡：未解锁锁态 + 个人最佳（`shot-02-challenge.png`）
3. 无尽模式对局：进 3+ 波（`shot-03-endless.png`；可 `window.__app.__debug(fn)` 注入敌人加速）
4. 军务功勋 tab：成就行 + 进度条 + 可领红点（`shot-04-achv.png`）
5. 公告屏：2 条公告（`shot-05-notices.png`）
6. 声音格循环 toast（`shot-06-sound.png`）

冒烟纪律：browser 代理的 PASS 汇报必须逐张目检截图；点击用元素真实中心坐标。

- [ ] **Step 7.4: spec 标注**

第八章里程碑表加行：

```markdown
| M7 终局+扩池+功勋+音频+分享 | 无尽/每日/车轮三模式 + 周瑜张辽扩池 + 功勋 18 项 + 音效 BGM + 分享公告 | 三模式解锁/结算正确；被动数值单测断言；功勋可领；音频开关持久化；wx 构建通过 | ✅ 2026-10-05 完成（测试 N/N · M 文件；冒烟 6 图 `docs/screenshots/m7/`） |
```

（N/M 以 Step 7.1 实际数字填写。）

- [ ] **Step 7.5: Commit**

```powershell
git add docs/specs/2026-10-03-sanguo-tower-design.md docs/screenshots/m7
git commit -m "docs(m7): 回归全绿+冒烟6图+spec M7标注完成"
```

---

## 自审记录（计划完成时勾）

- [ ] Spec 覆盖：11.1→T2/T3；11.2→T1；11.3→T4；11.4→T5；11.5→T6；11.6→T3；11.7→T7 ✓
- [ ] 占位符扫描：T4 成就表 19→18 项已给出明确取舍（删 w0）；T3 doShare/cycleSound 占位由 T5/T6 替换 ✓
- [ ] 类型一致：`opts.bonus`（T1/T3 统一）、`hitQuests(…, achvRows)`（T4 签名一致）、`battleState.mode` 冗余字段（T3）与 finishBattle 读取一致 ✓
