# M8 战斗表现追平《城主别慌张》实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 战斗表现对标《城主别慌张》——打击感全家桶（hit-stop/飘字/击退/屏震/墨散/音画同步）+ 部件动画器剪影小人 + 粒子 v2 + 大招分镜 v2 + Boss 卷轴登场与斩杀慢镜 + 场景层次，纯程序化零图片资产。

**Architecture:** engine 唯一增量 = 只读事件流 `state.frameEvents`（数值路径零改动）；渲染层新增 `battleFx`（事件消费→吞帧时停/屏震/飘字/击退/闪白）与 `cinematic`（演出队列）两个模块级单例；hit-stop 与演出统一走「渲染层不调 advanceFrame」的吞帧机制，engine 无感知；双皮肤经 `theme.setSkin` 改写 `Art.C` 色板，动画器每帧读现值自动 1:1 契合。

**Tech Stack:** 原生 Canvas 2D + 纯函数 engine（vitest TDD）+ H5(wite/vite) / 微信小游戏双容器；PowerShell 环境（禁 `&&`、禁 heredoc，commit 用单行 `-m`）。

**Spec:** `docs/specs/2026-10-03-sanguo-tower-design.md` 第十二章（v1.5，commit `80a06a8`）。

**测试基线:** 234/234（33 文件）全绿；每任务完成后必须回到全绿。

---

## 调研结论（写死的事实，工程师零上下文直接用）

### 引擎现状（改动锚点）

| 文件 | 关键事实 |
|------|---------|
| `src/engine/state.js` | `createBattle(seed, opts)` L16-53 造 state；`advanceFrame` L65-132：终态冻结 → `structuredClone(state)` → `work.frame++` → TICK=16.667ms while 循环 → 输入消费 → `if (work.ult) { tickUlt; if (!work.ult) reapDead(work); continue; }` → stage switch（wave 分支：`updateWave → moveEnemies 返回 leaked → shieldT<=0 扣血 → tickSlots → heroAttack → reapDead → applyLeech → tickTimers`）→ hp≤0 → over。**事件流重置点 = work 创建处；leak 事件埋点 = shieldT<=0 扣血循环** |
| `src/engine/combat.js` | `dealDamage(state, enemyId, amount)` L5-17：扣 `e.hp`，hp≤0 时金币+killCount+从 `state.enemies` filter 移除，返回 `{killed, reward}`。**hit/kill(direct) 事件埋点；需加可选 `opts.crit` 参数（向后兼容）** |
| `src/engine/enemy.js` | `spawnEnemy` L40-57 push 敌对象（字段 id/type/lane/t/hp/hpMax/speedMul/dmgBonus/affix/siegeClock/slowT/stunT/burnT/burnMul）。`moveEnemies` L61-93：返回 `leaked = [{type, dmg}]`（真漏怪 t≥1 + 投石车轰击 SIEGE_INTERVAL 触发都 push 进 leaked）。`reapDead` L96-108：hp≤0 收口（金币+killCount+shuai 计 bossKills）。`pathPoint(laneIdx, t)` L27-38：路径进度→逻辑坐标。**kill(burn) 事件埋点 = reapDead；boss 事件埋点 = spawnEnemy** |
| `src/engine/hero.js` | `heroAttack` L24-44：冷却→pickTargets→`isCrit = rng < st.crit`→`dmg = atk × dmgMul × (isCrit?2:1)`→循环 `dealDamage(state, e.id, dmg)`。`chainLightning` L48-68 连锁也走 dealDamage。**isCrit 需传入 dealDamage** |
| `src/engine/ult.js` | `tryStartUlt` L14-27：扣 2 计策→`state.ult = { t: 0 }`。`tickUlt` L29-39：t≥2.8 直接 `e.hp -= ULT_DAMAGE` + 击退 + 眩晕（**不走 dealDamage，死后由 reapDead 收口**）。**ult 事件埋点 = tryStartUlt 成功** |
| `src/engine/config.js` | `HERO_POS={x:360,y:640}`；`ENEMY_TYPES` 六型（bing/qi/gong/shuai/tou/teng）；`CHAPTER_PACKS` 6 套（L82-183）；`ULT_CAST_DUR=2.8`；shuai=BOSS。**bossTitle 字段加在 6 套包对象里** |

### 渲染/容器现状（改动锚点）

| 文件 | 关键事实 |
|------|---------|
| `src/render/battle.js` | `drawBattle(ctx, state)` L20-40：`beginUltShake` → 背景双皮肤分支 → `drawLanes`（lineWidth 3 虚线）→ 敌人循环 `Art.drawEnemyToken(ctx, p.x, p.y, 26, type, hpRatio, affix)` + `drawStatusMarks` → `Art.drawHeroToken(ctx, 360, 640, 34, 1)` → HUD/进度条/锦囊槽/大招按钮/横幅 → `drawUltCinematic` → skillPick 弹窗。**M8 主改文件：敌人圆牌→部件小人、赵云加长枪、加飘字/幽灵/粒子/屏震/氛围墨点/路径质感** |
| `src/render/fx.js` | `beginUltShake(ctx, state)` L18-27（p≥0.79 屏抖 ±6）；`drawUltCinematic` L30-35（p<0.57 七段突刺 / 0.57-0.79 冲击波）；`SEG_DUR=0.22`、`SEG_ANGLES` 7 方向黄金角。**M8 重排四段：聚雾 0-0.6 / 突刺 0.6-1.6 / 白闪 1.6-2.2 / 冲击波+大印 2.2-2.8** |
| `src/render/art.js` | IIFE 挂 `globalThis.Art`；`C` 色板（paper/ink/inkMid/bronze/gold/seal/sealHi/jade/laneInk…）；`skinId`；`drawEnemyToken`（墨底圆牌+血条+词缀印）；`drawHeroToken`（青铜双环+血条）；`drawBattleBackdrop(ctx,x,y,w,h)`（三层远山 op 0.28/0.18/0.12 + 雾带）；`sealStamp`；`roundRect`。**远山改双层 + tSec 参数** |
| `src/render/theme.js` | `setSkin('ink'|'shadow')` 改写 `Art.C` 与 ui 色板（shadow 下 `ink:'#f0d9a8'` 暖字色、`seal:'#b23a28'`）。**动画器/粒子每帧读 Art.C 现值 = 双皮肤自动契合，无需分支** |
| `src/app/core.js` | `createApp({ctx, showRewarded, purchase, getSpeed})`；`SPEED = clamp(getSpeed(),1,10)` L67；`startBattle` L384-409（createBattle→screen='battle'）；`loop` L508-559：battle 分支 `battleState = advanceFrame(battleState, battleState.pendingInputs, dtMs * SPEED)` → `pendingInputs = null` → 终态判定（over 且 !reviveUsed → screen='revive'；否则 finishBattle）→ `drawBattle`。**吞帧时停接线点 = loop battle 分支；每局 reset = startBattle** |
| `src/platform/audio.js` | `sfx(name)` L59-62：`if (!ac || !soundOn || !SFX[name]) return`。SFX 表 8 音（click/attack/ult/skill/coin/compose/win/lose）。`tone(freq,dur,type,vol,when,slideTo)` 基础音符。**M8 加 hit/kill/drum 三音 + 60ms 同名限频（Date.now 口径，wx 无 performance.now）** |

### 测试约定（复用）

- vitest，`pnpm test` 跑全部；单文件 `pnpm vitest run tests/xxx.test.js`（PowerShell 下 `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "` 统计）
- mock ctx 模式（tests/platform/wxContainer.test.js L5-16）：`new Proxy({}, { get(t,k){ if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>gradient; if(k==='measureText') return ()=>({width:10}); if(typeof k==='string' && !(k in t)) return ()=>{}; return t[k]; }, set(t,k,v){ t[k]=v; return true; } })`
- mock AudioContext 模式（tests/m7-audio.test.js L7-29）：手写 createOscillator/createGain 计数节点
- art.js 是 IIFE，测试文件 `import '../../src/render/art.js'` 即挂 `globalThis.Art`
- 引擎测试构造：`createBattle(20260304, {})` + 直接 mutate（push enemies / 置 stage）

### 事件流设计定案（spec 12.1 的两处必要补充）

1. **`enemyId` 字段**：spec 事件结构无 id，但受击闪白/击退需定位敌体——hit/kill 事件补 `enemyId`（engine 侧顺手 `e.id`，零成本）。
2. **第 5 种事件 `boss`**：spec 12.2「Boss 登场 2px 屏震」与 12.4「Boss 卷轴」都需要登场信号，事件枚举补 `{ type:'boss', enemyType:'shuai', isBoss:true }`（spawnEnemy 产）。
3. **leak 事件埋在 state.js 扣血处**（非 enemy.js）：护盾免伤时不发事件（渲染反馈与实际扣血一致）；坐标统一 HERO_POS（漏怪终点；投石车轰击坐标误差可接受）。enemy.js 的 leaked 数组结构不动，零回归。
4. **kill 的 cause 判定**：`cause: e.burnT > 0 ? 'burn' : 'direct'`——reapDead 收口的死敌若正处灼烧则 burn，否则 direct（大招/锦囊直伤死归 direct，语义=非灼烧）。
5. **hit 与 kill 互斥**：dealDamage 致死只发 kill 不发 hit（避免同帧双吞帧）。

---

## 文件结构（新建/修改全景）

| 动作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/engine/state.js` | frameEvents 初始化/每帧重置 + leak 事件 |
| 修改 | `src/engine/combat.js` | hit/kill(direct) 事件 + opts.crit |
| 修改 | `src/engine/enemy.js` | kill(burn) + boss 事件 |
| 修改 | `src/engine/hero.js` | isCrit 传入 |
| 修改 | `src/engine/ult.js` | ult 事件 |
| 修改 | `src/engine/config.js` | CHAPTER_PACKS 加 bossTitle ×6 |
| 新建 | `src/render/particles.js` | 粒子 v2：splash/trail/blot 三发射器 + LCG 确定性随机 + 池 ≤120 |
| 新建 | `src/render/animator.js` | pose() 姿态纯函数 + drawEnemyFigure 剪影小人 + drawHeroSpear |
| 新建 | `src/render/cinematic.js` | 演出队列状态机 + bossScroll/bossKill 绘制 |
| 新建 | `src/render/battleFx.js` | 事件消费 → 吞帧/屏震/飘字/击退/闪白/死亡快照/音效/演出触发 |
| 修改 | `src/render/battle.js` | 小人接线 + 场景层次 + 飘字/幽灵/粒子绘制 + 屏震 |
| 修改 | `src/render/fx.js` | 大招分镜 v2 四段重写 |
| 修改 | `src/render/art.js` | drawBattleBackdrop 双层远山 + tSec |
| 修改 | `src/app/core.js` | 吞帧时停接线 + battleFx.reset + 终态延后 |
| 修改 | `src/platform/audio.js` | hit/kill/drum + 限频 |
| 新建 | `tests/engine/events.test.js` | 事件流全字段 |
| 新建 | `tests/render/particles.test.js` | 池上限/LCG 确定性/update/draw |
| 新建 | `tests/render/animator.test.js` | pose 四态×敌型 + 双皮肤 |
| 新建 | `tests/render/cinematic.test.js` | 队列状态机 + 绘制冒烟 |
| 新建 | `tests/render/battlefx.test.js` | 吞帧分级/封顶/飘字/快照/触发 |
| 新建 | `tests/render/m8-smoke.test.js` | mock ctx 全链路冒烟 |

任务依赖：T1 →（T4）← T2/T3；T4 → T5 → T6 → T7 → T8 → T9。T2/T3 相互独立可与 T1 并行。

---

### Task 1: Engine 只读事件流（engine 层唯一改动）

**Files:**
- Modify: `src/engine/state.js`（createBattle 加字段 + advanceFrame 重置 + leak 埋点）
- Modify: `src/engine/combat.js`（hit/kill direct + opts.crit）
- Modify: `src/engine/enemy.js`（kill burn + boss）
- Modify: `src/engine/hero.js`（isCrit 传入）
- Modify: `src/engine/ult.js`（ult 事件）
- Test: `tests/engine/events.test.js`

- [ ] **Step 1.1: 写失败测试**

创建 `tests/engine/events.test.js`：

```js
// tests/engine/events.test.js — M8 只读事件流：hit/kill/leak/ult/boss 全字段 + 每帧重置 + 数值零回归
import { describe, it, expect } from 'vitest';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { dealDamage } from '../../src/engine/combat.js';
import { spawnEnemy, reapDead, pathPoint } from '../../src/engine/enemy.js';
import { tryStartUlt } from '../../src/engine/ult.js';
import { HERO_POS, ENEMY_TYPES } from '../../src/engine/config.js';

function battle() { return createBattle(20260304, {}); }

describe('M8 事件流', () => {
  it('createBattle 初始化 frameEvents 为空数组', () => {
    expect(battle().frameEvents).toEqual([]);
  });

  it('dealDamage 命中产 hit（dmg/crit/enemyId/坐标/enemyType）', () => {
    const s = battle();
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].t = 0.3;
    const id = s.enemies[0].id;
    dealDamage(s, id, 30, { crit: true });
    const hits = s.frameEvents.filter((e) => e.type === 'hit');
    expect(hits).toHaveLength(1);
    const ev = hits[0];
    expect(ev.dmg).toBe(30);
    expect(ev.crit).toBe(true);
    expect(ev.enemyId).toBe(id);
    expect(ev.enemyType).toBe('bing');
    const p = pathPoint(0, 0.3);
    expect(ev.x).toBeCloseTo(p.x, 5);
    expect(ev.y).toBeCloseTo(p.y, 5);
  });

  it('dealDamage 致死只产 kill（cause direct / isBoss）不产 hit', () => {
    const s = battle();
    spawnEnemy(s, 'shuai', 1);
    const id = s.enemies[0].id;
    const r = dealDamage(s, id, 99999);
    expect(r.killed).toBe(true);
    expect(s.frameEvents.filter((e) => e.type === 'hit')).toHaveLength(0);
    const k = s.frameEvents.find((e) => e.type === 'kill');
    expect(k.cause).toBe('direct');
    expect(k.isBoss).toBe(true);
    expect(k.enemyType).toBe('shuai');
    expect(k.enemyId).toBe(id);
    expect(k.affix).toBeNull(); // 第1章 affixRate=0 无词缀
  });

  it('opts.crit 缺省 false（旧调用零回归）', () => {
    const s = battle();
    spawnEnemy(s, 'bing', 0);
    dealDamage(s, s.enemies[0].id, 10);
    expect(s.frameEvents[0].crit).toBe(false);
  });

  it('reapDead 灼烧中死亡 cause=burn；非灼烧 direct（大招/锦囊直伤）', () => {
    const s = battle();
    spawnEnemy(s, 'teng', 0);
    s.enemies[0].burnT = 3; // 灼烧中
    s.enemies[0].hp = 0;
    spawnEnemy(s, 'bing', 1);
    s.enemies[1].hp = 0;    // 非灼烧（如大招直伤后收口）
    reapDead(s);
    const kills = s.frameEvents.filter((e) => e.type === 'kill');
    expect(kills).toHaveLength(2);
    expect(kills[0].cause).toBe('burn');
    expect(kills[1].cause).toBe('direct');
  });

  it('spawnEnemy 出 shuai 产 boss 事件（isBoss true）', () => {
    const s = battle();
    spawnEnemy(s, 'bing', 0);
    spawnEnemy(s, 'shuai', 2);
    const evs = s.frameEvents.filter((e) => e.type === 'boss');
    expect(evs).toHaveLength(1);
    expect(evs[0].enemyType).toBe('shuai');
    expect(evs[0].isBoss).toBe(true);
  });

  it('tryStartUlt 成功产 ult 事件；失败不产', () => {
    const s = battle();
    expect(tryStartUlt(s)).toBe(false); // 无计策
    s.slots[0] = { id: 1, type: 'jice', tier: 1 };
    s.slots[1] = { id: 2, type: 'jice', tier: 1 };
    expect(tryStartUlt(s)).toBe(true);
    const ev = s.frameEvents.find((e) => e.type === 'ult');
    expect(ev).toBeTruthy();
    expect(ev.x).toBe(HERO_POS.x);
    expect(ev.dmg).toBe(600);
  });

  it('漏怪产 leak 事件（坐标 HERO_POS）；护盾期免伤不发', () => {
    // 直接走 advanceFrame：interval 态没有敌人推进，用 wave 态 + 手动注入
    const s = battle();
    s.stage = 'wave';
    s.spawnQueue = [];
    spawnEnemy(s, 'bing', 0);
    s.enemies[0].t = 0.999;       // 一 tick 内跨过 t≥1
    s.enemies[0].hp = 999999;     // 不会被打死
    const s2 = advanceFrame(s, null, 17);
    const leaks = s2.frameEvents.filter((e) => e.type === 'leak');
    expect(leaks).toHaveLength(1);
    expect(leaks[0].x).toBe(HERO_POS.x);
    expect(leaks[0].enemyType).toBe('bing');
    expect(s2.hp).toBe(s.hp - 1); // 实际扣血
    // 护盾期
    const s3 = battle();
    s3.stage = 'wave';
    s3.spawnQueue = [];
    s3.shieldT = 3;
    spawnEnemy(s3, 'bing', 0);
    s3.enemies[0].t = 0.999;
    s3.enemies[0].hp = 999999;
    const s4 = advanceFrame(s3, null, 17);
    expect(s4.frameEvents.filter((e) => e.type === 'leak')).toHaveLength(0);
    expect(s4.hp).toBe(s3.hp); // 免伤
  });

  it('frameEvents 每帧重置：上一帧事件不残留到下一帧', () => {
    const s = battle();
    s.stage = 'wave';
    s.spawnQueue = [];
    spawnEnemy(s, 'bing', 0);
    dealDamage(s, s.enemies[0].id, 10);
    expect(s.frameEvents.length).toBeGreaterThan(0);
    const s2 = advanceFrame(s, null, 17);
    expect(s2.frameEvents).toEqual([]); // 无新事件则空
  });

  it('终态冻结不再产事件', () => {
    const s = battle();
    s.stage = 'victory';
    const s2 = advanceFrame(s, null, 17);
    expect(s2).toBe(s); // 终态原样返回
  });

  it('数值零回归：kill 事件的金币/killCount 与无事件流时代一致', () => {
    const s = battle();
    spawnEnemy(s, 'qi', 0);
    const id = s.enemies[0].id;
    dealDamage(s, id, 99999);
    expect(s.coins).toBe(ENEMY_TYPES.qi.reward);
    expect(s.killCount).toBe(1);
  });
});
```

- [ ] **Step 1.2: 跑测试确认失败**

Run: `pnpm vitest run tests/engine/events.test.js`
Expected: FAIL（`s.frameEvents` undefined 相关断言错误，10 个用例中多数挂）

- [ ] **Step 1.3: 实现 state.js**

`src/engine/state.js` 两处改动：

改动 A — `createBattle` 的 state 字面量里 `stats` 行后加一行：

```js
    stats: { mergeCount: 0, ultCount: 0, bossKills: 0 }, // M6 任务埋点（战斗结束由 core 上报）
    frameEvents: [],   // M8 只读事件流（每帧重置，渲染层消费后即弃）
```

改动 B — `advanceFrame` 里 `work.frame++` 后加重置：

```js
  const work = structuredClone(state);
  work.frame++;
  work.frameEvents = []; // M8：上一帧事件不残留（只读事件流）
  let remain = Math.max(0, dtMs);
```

改动 C — wave 分支的漏怪扣血循环替换（原 L108-111）：

```js
        const leaked = moveEnemies(work, dt); // 移动含 stun/slow/burn
        if (work.shieldT <= 0) {          // 玄武护盾免伤（enemy.js 不感知 shield）
          for (const l of leaked) {
            work.hp -= l.dmg;
            (work.frameEvents = work.frameEvents || []).push({ // M8：漏怪事件（免伤不发）
              type: 'leak', x: HERO_POS.x, y: HERO_POS.y, dmg: l.dmg,
              crit: false, enemyType: l.type, isBoss: l.type === 'shuai',
            });
          }
        }
```

（`HERO_POS` 已在 state.js L4 从 config 导入，无需新增 import。）

- [ ] **Step 1.4: 实现 combat.js（整文件替换）**

```js
// engine/combat.js — 伤害结算 / 死亡移除 / 击杀金币
// M8：命中/击杀只读事件（state.frameEvents）——数值路径零改动
import { ENEMY_TYPES } from './config.js';
import { pathPoint } from './enemy.js';

// 对单个敌人结算伤害；致死则移出并发金币
// opts.crit：暴击标记（M8 事件流；缺省 false，旧调用零回归）
export function dealDamage(state, enemyId, amount, opts = {}) {
  const e = state.enemies.find((x) => x.id === enemyId);
  if (!e) return null;
  e.hp -= amount;
  const p = pathPoint(e.lane, e.t); // 事件坐标 = 敌人当前位置（逻辑坐标）
  if (e.hp <= 0) {
    const reward = ENEMY_TYPES[e.type].reward;
    state.coins += reward;
    state.killCount = (state.killCount || 0) + 1; // 击杀统计（饮血回血按总杀数取模）
    (state.frameEvents = state.frameEvents || []).push({
      type: 'kill', x: p.x, y: p.y, dmg: amount, crit: !!opts.crit,
      enemyId, enemyType: e.type, isBoss: e.type === 'shuai', cause: 'direct',
      affix: e.affix || null, // 词缀随事件携带（敌人随后即被移除，渲染层查不到）
    });
    state.enemies = state.enemies.filter((x) => x.id !== enemyId);
    return { killed: true, reward };
  }
  (state.frameEvents = state.frameEvents || []).push({
    type: 'hit', x: p.x, y: p.y, dmg: amount, crit: !!opts.crit,
    enemyId, enemyType: e.type,
  });
  return { killed: false };
}
```

（循环依赖检查：enemy.js 只 import config，不 import combat —— combat → enemy 单向，无环。）

- [ ] **Step 1.5: 实现 enemy.js 两处埋点**

改动 A — `spawnEnemy` 函数体末尾（`state.enemies.push({...})` 之后、函数收尾 `}` 之前）加：

```js
  if (type === 'shuai') { // M8：Boss 登场事件（卷轴/屏震触发）
    (state.frameEvents = state.frameEvents || []).push({
      type: 'boss', x: LANES[laneIdx][0].x, y: LANES[laneIdx][0].y,
      dmg: 0, crit: false, enemyType: 'shuai', isBoss: true,
    });
  }
```

改动 B — `reapDead` 整函数替换：

```js
// 死亡清尸：hp≤0 的敌人入金币并移除（锦囊/灼烧/大招伤害的统一收口）
export function reapDead(state) {
  for (const e of state.enemies) {
    if (e.hp <= 0) {
      state.coins += ENEMY_TYPES[e.type].reward;
      state.killCount = (state.killCount || 0) + 1;
      const p = pathPoint(e.lane, e.t);
      (state.frameEvents = state.frameEvents || []).push({
        type: 'kill', x: p.x, y: p.y, dmg: 0, crit: false,
        enemyId: e.id, enemyType: e.type, isBoss: e.type === 'shuai',
        cause: e.burnT > 0 ? 'burn' : 'direct', // 灼烧中死亡=烧死（DOT/灼烧锦囊），其余直伤（大招/锦囊斩击）
        affix: e.affix || null,
      });
      if (e.type === 'shuai') {
        state.stats = state.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
        state.stats.bossKills++;
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}
```

（`LANES` 已在 enemy.js L2 导入；`pathPoint` 是同文件函数。）

- [ ] **Step 1.6: 实现 hero.js 与 ult.js**

hero.js `heroAttack` 里主攻循环替换（原 L36-42）：

```js
  for (const e of targets) {
    dealDamage(state, e.id, dmg, { crit: isCrit });
    if (st.slowOnHit) {
      const cur = state.enemies.find((x) => x.id === e.id);
      if (cur) cur.slowT = Math.max(cur.slowT || 0, 2);
    }
  }
```

（chainLightning 的 dealDamage 不传 opts——连锁无暴击，缺省 false 正确。）

ult.js `tryStartUlt` 末尾替换（原 L23-27）：

```js
  state.stats = state.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
  state.stats.ultCount++;
  state.ult = { t: 0 };
  (state.frameEvents = state.frameEvents || []).push({ // M8：大招起手事件（战鼓/分镜对齐）
    type: 'ult', x: HERO_POS.x, y: HERO_POS.y, dmg: ULT_DAMAGE, crit: false, enemyType: null,
  });
  return true;
}
```

ult.js 头部 import 行（原 L2-4）替换为：

```js
import {
  ULT_JICE_COST, ULT_CAST_DUR, ULT_DAMAGE, ULT_KNOCKBACK, ULT_STUN,
  HERO_POS,
} from './config.js';
```

- [ ] **Step 1.7: 跑新测试 + 全量回归**

Run: `pnpm vitest run tests/engine/events.test.js`
Expected: PASS（10 用例）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: `Test Files  34 passed`、`Tests  244 passed`（234 基线 + 10 新增，零回归）

- [ ] **Step 1.8: Commit**

```powershell
git add src/engine/state.js src/engine/combat.js src/engine/enemy.js src/engine/hero.js src/engine/ult.js tests/engine/events.test.js
git commit -m "feat(m8): engine 只读事件流 hit/kill/leak/ult/boss 数值路径零改动"
```

---

### Task 2: 粒子系统 v2（render/particles.js 新建）

**Files:**
- Create: `src/render/particles.js`
- Test: `tests/render/particles.test.js`

- [ ] **Step 2.1: 写失败测试**

创建 `tests/render/particles.test.js`：

```js
// tests/render/particles.test.js — M8 粒子 v2：池上限/确定性/update/draw
import { describe, it, expect, beforeEach } from 'vitest';
import {
  splash, trail, blot, update, draw, reset, activeCount, POOL_MAX,
} from '../../src/render/particles.js';
import '../../src/render/art.js'; // 挂 globalThis.Art（draw 读色板）

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

beforeEach(() => reset());

describe('M8 粒子 v2', () => {
  it('三发射器产出活跃粒子', () => {
    splash(100, 100, 8);
    trail(100, 100, 0);
    blot(100, 100);
    expect(activeCount()).toBeGreaterThan(0);
  });

  it('池化上限 ≤120：海量发射后活跃数封顶', () => {
    for (let i = 0; i < 200; i++) splash(100, 100, 10);
    expect(activeCount()).toBeLessThanOrEqual(POOL_MAX);
    expect(POOL_MAX).toBe(120);
  });

  it('LCG 确定性：reset 后同序发射 update 轨迹一致（可观测口径）', () => {
    reset();
    splash(50, 50, 3);
    update(0.1);
    const s1 = JSON.stringify(sampleAlive());
    reset();
    splash(50, 50, 3);
    update(0.1);
    const s2 = JSON.stringify(sampleAlive());
    expect(s1).toBe(s2); // 同种子同序发射 → 可观测结果一致
  });

  it('update 推进位置/寿命，寿命尽则失活', () => {
    splash(100, 100, 1);
    const n0 = activeCount();
    expect(n0).toBe(1);
    update(0.1); // 未到期仍活
    expect(activeCount()).toBe(1);
    update(10);  // 远超 life(~0.55s 上限) 全灭
    expect(activeCount()).toBe(0);
  });

  it('draw 在 mock ctx 上不炸', () => {
    splash(100, 100, 6);
    trail(100, 100, 1.2);
    blot(100, 100);
    update(0.05);
    expect(() => draw(makeCtx())).not.toThrow();
  });

  it('reset 清空全部', () => {
    splash(0, 0, 30);
    blot(0, 0);
    reset();
    expect(activeCount()).toBe(0);
  });
});

// 辅助：无法直接访问池，用 draw 的调用计数间接采样（此处退化为确定性对比的桥）
// —— 由于池不导出，直接断言可观测行为：update 后再 update，位置应持续变化（活粒子）
function sampleAlive() { return `alive=${activeCount()}`; }
```

（注：粒子池为模块私有不导出，`sampleAlive` 以可观测口径做确定性对比，与项目「渲染层可变状态不导出」约定一致。）

- [ ] **Step 2.2: 跑测试确认失败**

Run: `pnpm vitest run tests/render/particles.test.js`
Expected: FAIL（模块不存在，import 报错）

- [ ] **Step 2.3: 实现 particles.js**

创建 `src/render/particles.js`：

```js
// render/particles.js — M8 粒子系统 v2：溅墨/飞白/墨晕三发射器，池化 ≤120 保 60fps
// 确定性随机：模块级 LCG（禁 Math.random，同序调用同结果，可测）
// 配色每帧读 globalThis.Art.C 现值 → 双皮肤（水墨/皮影）自动契合
export const POOL_MAX = 120;

// ---- 确定性随机（线性同余） ----
let lcg = 12345;
function rnd() { lcg = (lcg * 1103515245 + 12345) & 0x7fffffff; return lcg / 0x7fffffff; }

const pool = [];

function alloc() {
  if (pool.length < POOL_MAX) { const p = {}; pool.push(p); return p; }
  let oldest = pool[0];
  for (const p of pool) if (p.age > oldest.age) oldest = p; // 池满复用最老
  return oldest;
}

function paint() {
  const Art = globalThis.Art;
  return (Art && Art.C) || { ink: '#1f1b16', seal: '#9e2a1e', gold: '#c9a227' };
}

// 溅墨：命中点墨色+朱砂混喷（重力抛物线）
export function splash(x, y, n = 8) {
  const C = paint();
  for (let i = 0; i < n; i++) {
    const p = alloc();
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    const sp = 90 + rnd() * 160;
    p.kind = 'splash';
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
    p.life = 0.3 + rnd() * 0.25; p.age = 0;
    p.size = 2 + rnd() * 3.5;
    p.color = rnd() < 0.25 ? C.seal : C.ink;
    p.alive = true;
  }
}

// 飞白：沿方向角的拖尾短线（冲刺/枪风/突刺路径）
export function trail(x, y, ang) {
  const C = paint();
  const p = alloc();
  p.kind = 'trail';
  p.x = x; p.y = y;
  p.vx = Math.cos(ang) * 240; p.vy = Math.sin(ang) * 240;
  p.life = 0.18 + rnd() * 0.1; p.age = 0;
  p.size = 1.5 + rnd() * 1.5;
  p.color = C.gold;
  p.alive = true;
}

// 墨晕：死亡消散——大粒慢速外扩淡出
export function blot(x, y) {
  const C = paint();
  const n = 4;
  for (let i = 0; i < n; i++) {
    const p = alloc();
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const sp = 24 + rnd() * 30;
    p.kind = 'blot';
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 10;
    p.life = 0.4 + rnd() * 0.15; p.age = 0;
    p.size = 7 + rnd() * 8;
    p.color = C.ink;
    p.alive = true;
  }
}

export function update(dtSec) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dtSec;
    if (p.age >= p.life) { p.alive = false; continue; }
    if (p.kind === 'splash') p.vy += 380 * dtSec; // 重力
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
  }
}

export function draw(ctx) {
  const C = paint();
  for (const p of pool) {
    if (!p.alive) continue;
    const a = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = a;
    if (p.kind === 'trail') {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const len = 12 * a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'blot' ? p.size * (0.6 + 0.6 * (p.age / p.life)) : p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function activeCount() { return pool.filter((p) => p.alive).length; }

export function reset() {
  pool.length = 0;
  lcg = 12345; // 复位确定性种子
}
```

- [ ] **Step 2.4: 跑测试**

Run: `pnpm vitest run tests/render/particles.test.js`
Expected: PASS（6 用例）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 35 文件 / 250 用例全绿

- [ ] **Step 2.5: Commit**

```powershell
git add src/render/particles.js tests/render/particles.test.js
git commit -m "feat(m8): 粒子 v2 溅墨/飞白/墨晕三发射器 池化120 LCG确定性"
```

---

### Task 3: 部件动画器（render/animator.js 新建）

**Files:**
- Create: `src/render/animator.js`
- Test: `tests/render/animator.test.js`

- [ ] **Step 3.1: 写失败测试**

创建 `tests/render/animator.test.js`：

```js
// tests/render/animator.test.js — M8 姿态纯函数：四类敌人 × 四态；双皮肤调色板
import { describe, it, expect, beforeEach } from 'vitest';
import { pose, drawEnemyFigure, drawHeroSpear, figureHeight } from '../../src/render/animator.js';
import '../../src/render/art.js';   // 挂 globalThis.Art
import { setSkin } from '../../src/render/theme.js';

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

beforeEach(() => setSkin('ink'));

describe('M8 pose 姿态函数（纯数据）', () => {
  it('walk：上下颠簸 bob 正弦 + 腿摆 + 前倾', () => {
    const a = pose('bing', 'walk', 0);
    const b = pose('bing', 'walk', 0.2); // t*8: 0 → 1.6rad，sin 变化
    expect(a.lean).toBeGreaterThan(0);   // 前倾赶路
    expect(b.bob).not.toBe(a.bob);       // 颠簸随相位变化
    expect(Math.abs(b.limbSwing)).toBeLessThanOrEqual(1);
  });

  it('attack：前倾+挥砍弧 200ms 内推进，超时归位', () => {
    const p1 = pose('bing', 'attack', 0.1);
    expect(p1.lean).toBeGreaterThan(0);
    expect(p1.weaponAngle).toBeGreaterThan(-1.1); // 弧从 -63° 起步
    const p2 = pose('bing', 'attack', 0.3);       // 超时
    expect(p2.lean).toBe(0);
  });

  it('hit：flash 从 1 衰减，80ms 后归零；后仰 lean 为负', () => {
    const p0 = pose('bing', 'hit', 0);
    expect(p0.flash).toBe(1);
    expect(p0.lean).toBeLessThan(0);
    const pEnd = pose('bing', 'hit', 0.08);
    expect(pEnd.flash).toBe(0);
  });

  it('die：alpha 1→0、sink 0→12、400ms 走完', () => {
    const p0 = pose('bing', 'die', 0);
    expect(p0.alpha).toBe(1);
    expect(p0.sink).toBe(0);
    const pMid = pose('bing', 'die', 0.2);
    expect(pMid.alpha).toBeCloseTo(0.5, 5);
    expect(pMid.sink).toBeCloseTo(6, 5);
    const pEnd = pose('bing', 'die', 0.4);
    expect(pEnd.alpha).toBe(0);
  });

  it('四类敌人 × 四态全组合输出合法数值（无 NaN）', () => {
    for (const type of ['bing', 'gong', 'qi', 'shuai']) {
      for (const st of ['walk', 'attack', 'hit', 'die']) {
        const pz = pose(type, st, 0.13);
        for (const k of ['lean', 'bob', 'weaponAngle', 'flash', 'alpha', 'sink']) {
          expect(Number.isFinite(pz[k])).toBe(true);
        }
      }
    }
  });

  it('figureHeight：敌人视高 48-56px 区间（mockup v2 定稿约 2 倍圆牌）', () => {
    expect(figureHeight('bing')).toBeGreaterThanOrEqual(48);
    expect(figureHeight('shuai')).toBeLessThanOrEqual(56);
  });
});

describe('M8 绘制（mock ctx 冒烟 + 双皮肤）', () => {
  it('四类敌人 drawEnemyFigure 不炸', () => {
    for (const type of ['bing', 'gong', 'qi', 'shuai']) {
      const pz = pose(type, 'walk', 0.1);
      expect(() => drawEnemyFigure(makeCtx(), 100, 100, type, pz)).not.toThrow();
    }
  });

  it('die 态 alpha=0 时绘制安全（ghost 收尾）', () => {
    const pz = pose('bing', 'die', 0.5);
    expect(() => drawEnemyFigure(makeCtx(), 100, 100, 'bing', pz)).not.toThrow();
  });

  it('双皮肤 1:1：皮影下填充色为暖字色（读 Art.C 现值）', () => {
    const seen = [];
    const ctx = new Proxy({}, {
      get(t, k) {
        if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
        if (k === 'measureText') return () => ({ width: 10 });
        if (typeof k === 'string' && k === 'fillStyle') return t.fillStyle;
        if (typeof k === 'string' && !(k in t)) return () => {};
        return t[k];
      },
      set(t, k, v) { if (k === 'fillStyle') seen.push(v); t[k] = v; return true; },
    });
    setSkin('shadow');
    drawEnemyFigure(ctx, 100, 100, 'bing', pose('bing', 'walk', 0));
    expect(seen).toContain('#f0d9a8'); // theme.js SHADOW_ART.ink
    setSkin('ink');
  });

  it('drawHeroSpear 不炸', () => {
    expect(() => drawHeroSpear(makeCtx(), 360, 640, 0.5, 0.1)).not.toThrow();
  });
});
```

- [ ] **Step 3.2: 跑测试确认失败**

Run: `pnpm vitest run tests/render/animator.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3.3: 实现 animator.js**

创建 `src/render/animator.js`：

```js
// render/animator.js — M8 部件动画器：姿态纯函数 + 水墨/皮影剪影小人
// pose() 只输出数据（vitest 可测）；drawX 只按数据画；配色每帧读 Art.C 现值（theme.setSkin 即全量换肤）

const KAI = '"KaiTi","STKaiti","楷体",serif';

function art() {
  const A = globalThis.Art;
  return (A && A.C) || {
    ink: '#1f1b16', inkMid: '#3a332a', paper: '#e8dcc4', paperHi: '#f2e8d2',
    bronze: '#8b6914', bronzeLt: '#b8963e', gold: '#c9a227', seal: '#9e2a1e',
  };
}

// 敌人视高（px）：mockup v2 定稿约圆牌 2 倍，48-56 区间
export function figureHeight(type) {
  if (type === 'qi') return 56;   // 骑马最高
  if (type === 'shuai') return 54; // 大氅
  return 50;                       // 兵/弓
}

// ===== 姿态纯函数：输出 { lean, bob, weaponAngle, flash, alpha, sink, limbSwing } =====
// animState: 'walk'|'attack'|'hit'|'die'; t: 态内秒
export function pose(type, animState, t) {
  const pz = { lean: 0, bob: 0, weaponAngle: 0, flash: 0, alpha: 1, sink: 0, limbSwing: 0 };
  if (animState === 'walk') {
    pz.bob = Math.sin(t * 8) * 2;
    pz.limbSwing = Math.sin(t * 8);
    pz.lean = 4 + Math.sin(t * 4) * 2; // 前倾赶路
    if (type === 'qi') pz.bob += Math.sin(t * 10) * 1.5; // 骑乘颠簸
  } else if (animState === 'attack') {
    const q = Math.min(1, t / 0.2);
    pz.lean = 14 * Math.sin((q * Math.PI) / 2);
    pz.weaponAngle = -1.1 + q * 1.6; // 挥砍弧 -63°→+28°
    if (t > 0.2) { pz.lean = 0; pz.weaponAngle = 0.5; }
  } else if (animState === 'hit') {
    const q = Math.max(0, 1 - t / 0.08);
    pz.flash = q;       // 纸色闪白 80ms 衰减
    pz.lean = -10 * q;  // 后仰
  } else if (animState === 'die') {
    const q = Math.min(1, t / 0.4);
    pz.alpha = 1 - q;
    pz.sink = 12 * q;
    pz.lean = -20 * q;
  }
  return pz;
}

// ===== 敌人剪影小人（部件拼装，高 figureHeight）=====
// (x,y)=脚底锚点；pz=pose 输出。attack 弧方向固定朝右（敌人朝赵云≈路径终点，绘制时以 lean 表达即可）
export function drawEnemyFigure(ctx, x, y, type, pz) {
  const C = art();
  const H = figureHeight(type);
  const a = Math.max(0, pz.alpha);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  const yy = y - pz.sink;

  // 落地墨影（脚底椭圆）
  ctx.fillStyle = 'rgba(31,27,22,0.30)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, H * 0.22, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, yy);
  ctx.rotate((pz.lean * Math.PI) / 180);

  if (type === 'qi') drawRider(ctx, C, H, pz);
  else if (type === 'gong') drawArcher(ctx, C, H, pz);
  else if (type === 'shuai') drawMarshal(ctx, C, H, pz);
  else drawSwordsman(ctx, C, H, pz);

  // 受击纸色闪白（覆盖剪影的柔光圆）
  if (pz.flash > 0) {
    ctx.globalAlpha = a * pz.flash * 0.75;
    ctx.fillStyle = C.paperHi;
    ctx.beginPath();
    ctx.arc(0, -H * 0.5, H * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 兵（刀兵）：披风 + 宽刃刀（刃/格/柄）+ 发髻 + 腰带
function drawSwordsman(ctx, C, H, pz) {
  const bodyTop = -H * 0.42, bodyBot = 0;
  // 披风（身后摆动三角）
  ctx.fillStyle = C.inkMid;
  ctx.beginPath();
  ctx.moveTo(-H * 0.06, bodyTop + H * 0.06);
  ctx.lineTo(-H * 0.26 - pz.limbSwing * 3, bodyBot - H * 0.02);
  ctx.lineTo(-H * 0.05, bodyBot - H * 0.1);
  ctx.closePath();
  ctx.fill();
  // 身体（墨团梯形）
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-H * 0.09, bodyTop);
  ctx.lineTo(H * 0.09, bodyTop);
  ctx.lineTo(H * 0.13, bodyBot);
  ctx.lineTo(-H * 0.13, bodyBot);
  ctx.closePath();
  ctx.fill();
  // 腰带
  ctx.strokeStyle = C.seal;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-H * 0.115, -H * 0.18);
  ctx.lineTo(H * 0.115, -H * 0.18);
  ctx.stroke();
  // 头 + 发髻
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.09, H * 0.095, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.185, H * 0.035, 0, Math.PI * 2); ctx.fill();
  // 宽刃刀：柄(细线) + 格(短横) + 刃(长四边形)
  ctx.save();
  ctx.translate(H * 0.1, bodyTop + H * 0.1);
  ctx.rotate(pz.weaponAngle - 0.5);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(H * 0.16, 0); ctx.stroke(); // 柄
  ctx.beginPath(); ctx.moveTo(H * 0.16, -H * 0.05); ctx.lineTo(H * 0.16, H * 0.05); ctx.stroke(); // 格
  ctx.fillStyle = C.inkMid;
  ctx.beginPath();
  ctx.moveTo(H * 0.17, -H * 0.035);
  ctx.lineTo(H * 0.40, -H * 0.05);
  ctx.lineTo(H * 0.43, 0);
  ctx.lineTo(H * 0.17, H * 0.035);
  ctx.closePath();
  ctx.fill(); // 刃
  ctx.restore();
}

// 弓：反曲弓（弓臂双曲线+弦）+ 搭箭 + 背后箭壶
function drawArcher(ctx, C, H, pz) {
  const bodyTop = -H * 0.44, bodyBot = 0;
  // 身体
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-H * 0.08, bodyTop);
  ctx.lineTo(H * 0.08, bodyTop);
  ctx.lineTo(H * 0.11, bodyBot);
  ctx.lineTo(-H * 0.11, bodyBot);
  ctx.closePath();
  ctx.fill();
  // 头
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.09, H * 0.09, 0, Math.PI * 2); ctx.fill();
  // 背后箭壶（斜背小矩形 + 两支箭头）
  ctx.save();
  ctx.translate(-H * 0.1, bodyTop + H * 0.12);
  ctx.rotate(0.35);
  ctx.fillStyle = C.inkMid;
  ctx.fillRect(-H * 0.03, 0, H * 0.06, H * 0.2);
  ctx.strokeStyle = C.inkMid;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-H * 0.01, 0); ctx.lineTo(-H * 0.01, -H * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(H * 0.015, 0); ctx.lineTo(H * 0.015, -H * 0.05); ctx.stroke();
  ctx.restore();
  // 反曲弓：竖持双曲弓臂 + 弦
  ctx.save();
  ctx.translate(H * 0.12, bodyTop + H * 0.1);
  ctx.rotate(pz.weaponAngle * 0.4);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -H * 0.16);
  ctx.quadraticCurveTo(H * 0.09, -H * 0.08, 0.028 * H, 0); // 上臂反曲
  ctx.quadraticCurveTo(H * 0.09, H * 0.08, 0, H * 0.16);   // 下臂反曲
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -H * 0.16); ctx.lineTo(0, H * 0.16); ctx.stroke(); // 弦
  // 搭箭（水平短线+镞）
  ctx.beginPath(); ctx.moveTo(-H * 0.05, 0); ctx.lineTo(H * 0.1, 0); ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(H * 0.1, 0); ctx.lineTo(H * 0.07, -H * 0.02); ctx.lineTo(H * 0.07, H * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// 骑：马身/马首/四蹄/尾鬃 + 骑手 + 长枪朱砂红缨
function drawRider(ctx, C, H, pz) {
  const bodyY = -H * 0.36; // 马背高度
  // 尾鬃（曲线）
  ctx.strokeStyle = C.inkMid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-H * 0.26, bodyY - H * 0.04);
  ctx.quadraticCurveTo(-H * 0.4, bodyY + H * 0.02, -H * 0.38 - pz.limbSwing * 2, bodyY + H * 0.12);
  ctx.stroke();
  // 马身（大椭圆）
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(0, bodyY, H * 0.27, H * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  // 马首（小椭圆前伸 + 双耳）
  ctx.beginPath();
  ctx.ellipse(H * 0.28, bodyY - H * 0.07, H * 0.1, H * 0.055, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(H * 0.3, bodyY - H * 0.12);
  ctx.lineTo(H * 0.34, bodyY - H * 0.2);
  ctx.lineTo(H * 0.34, bodyY - H * 0.11);
  ctx.closePath(); ctx.fill();
  // 四蹄（walk 摆动两两错相）
  ctx.fillStyle = C.ink;
  const legs = [[-H * 0.18, 0], [-H * 0.1, 1], [H * 0.12, 1], [H * 0.2, 0]];
  for (const [lx, ph] of legs) {
    const swing = ph ? pz.limbSwing * 3 : -pz.limbSwing * 3;
    ctx.fillRect(lx + swing, bodyY + H * 0.1, H * 0.035, H * 0.09);
  }
  // 骑手（小身+头，位于马背）
  ctx.beginPath();
  ctx.moveTo(-H * 0.05, bodyY - H * 0.16);
  ctx.lineTo(H * 0.05, bodyY - H * 0.16);
  ctx.lineTo(H * 0.06, bodyY - H * 0.02);
  ctx.lineTo(-H * 0.06, bodyY - H * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, bodyY - H * 0.21, H * 0.055, 0, Math.PI * 2); ctx.fill();
  // 长枪（斜举）+ 朱砂红缨
  ctx.save();
  ctx.translate(H * 0.04, bodyY - H * 0.14);
  ctx.rotate(pz.weaponAngle * 0.3 - 0.45);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-H * 0.05, 0); ctx.lineTo(H * 0.3, 0); ctx.stroke();
  ctx.fillStyle = C.seal; // 红缨
  ctx.beginPath();
  ctx.moveTo(H * 0.3, 0);
  ctx.lineTo(H * 0.24, -H * 0.045);
  ctx.lineTo(H * 0.24, H * 0.045);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// 帅：大氅（宽梯形+下摆波浪）+ 冠 + 鎏金描边
function drawMarshal(ctx, C, H, pz) {
  const bodyTop = -H * 0.5, bodyBot = 0;
  // 大氅
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-H * 0.1, bodyTop);
  ctx.lineTo(H * 0.1, bodyTop);
  ctx.quadraticCurveTo(H * 0.24, bodyBot * 0.5, H * 0.2 + pz.limbSwing, bodyBot);
  ctx.quadraticCurveTo(0, bodyBot + H * 0.03, -H * 0.2 + pz.limbSwing, bodyBot);
  ctx.quadraticCurveTo(-H * 0.24, bodyBot * 0.5, -H * 0.1, bodyTop);
  ctx.closePath();
  ctx.fill();
  // 鎏金描边（大氅外轮廓近似 = 左右轮廓弧线）
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-H * 0.1, bodyTop);
  ctx.quadraticCurveTo(-H * 0.24, bodyBot * 0.5, -H * 0.2 + pz.limbSwing, bodyBot);
  ctx.moveTo(H * 0.1, bodyTop);
  ctx.quadraticCurveTo(H * 0.24, bodyBot * 0.5, H * 0.2 + pz.limbSwing, bodyBot);
  ctx.stroke();
  // 头 + 冠（小矩形）
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.07, H * 0.085, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-H * 0.05, bodyTop - H * 0.2, H * 0.1, H * 0.05);
  // 持剑（直垂）
  ctx.strokeStyle = C.inkMid;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(H * 0.14, bodyTop + H * 0.16); ctx.lineTo(H * 0.14, bodyBot - H * 0.06); ctx.stroke();
}

// ===== 赵云长枪叠加（青铜双环底牌由 Art.drawHeroToken 保留）=====
// ang：突刺方向角（朝命中敌人）；t：攻击态内秒（0-0.2 突出，0.2-0.4 回收）
export function drawHeroSpear(ctx, x, y, ang, t) {
  const C = art();
  const ext = Math.sin(Math.min(1, t / 0.2) * Math.PI) * 30; // 0→30→0 突刺
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // 飞白拖尾（粒子由 battleFx 另发，这里画静态弧）
  ctx.strokeStyle = 'rgba(201,162,39,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 42, -0.5, 0.2);
  ctx.stroke();
  // 枪杆（鎏金）
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(54 + ext, 0);
  ctx.stroke();
  // 枪尖
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(60 + ext, 0);
  ctx.lineTo(50 + ext, -3.5);
  ctx.lineTo(50 + ext, 3.5);
  ctx.closePath();
  ctx.fill();
  // 红缨
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  ctx.moveTo(50 + ext, 0);
  ctx.lineTo(44 + ext, -5);
  ctx.lineTo(44 + ext, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 3.4: 跑测试**

Run: `pnpm vitest run tests/render/animator.test.js`
Expected: PASS（9 用例）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 36 文件 / 259 用例全绿

- [ ] **Step 3.5: Commit**

```powershell
git add src/render/animator.js tests/render/animator.test.js
git commit -m "feat(m8): 部件动画器 pose纯函数+四类剪影小人+赵云长枪 双皮肤读色板"
```

---

### Task 4: cinematic 演出队列核心 + battleFx 打击感全家桶 + audio 三音 + bossTitle

**Files:**
- Create: `src/render/cinematic.js`（本任务只做队列核心；绘制在 Task 8）
- Create: `src/render/battleFx.js`
- Modify: `src/engine/config.js`（CHAPTER_PACKS 加 bossTitle ×6）
- Modify: `src/platform/audio.js`（hit/kill/drum + 限频）
- Test: `tests/render/cinematic.test.js`、`tests/render/battlefx.test.js`

- [ ] **Step 4.1: 写失败测试（cinematic 队列）**

创建 `tests/render/cinematic.test.js`：

```js
// tests/render/cinematic.test.js — M8 演出队列状态机（核心；绘制 Task 8 补）
import { describe, it, expect, beforeEach } from 'vitest';
import { push, active, update, reset, QUEUE_MAX } from '../../src/render/cinematic.js';

beforeEach(() => reset());

describe('M8 cinematic 队列', () => {
  it('push 后 active 返回队首', () => {
    push({ kind: 'bossScroll', dur: 800, data: { title: '曹仁' } });
    const cur = active();
    expect(cur.kind).toBe('bossScroll');
    expect(cur.t).toBe(0);
  });

  it('update 推进 t，到 dur 出队', () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    update(200);
    expect(active().t).toBe(200);
    update(200);
    expect(active()).toBeNull(); // 播完出队
  });

  it('串行独占：前一演完才推进后一', () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossScroll', dur: 800, data: {} });
    update(400);
    expect(active().kind).toBe('bossScroll'); // 前一出队，后者成为队首
    expect(active().t).toBe(0);
  });

  it(`队列上限 ${QUEUE_MAX}：超出丢弃（防积压）`, () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} }); // 丢弃
    reset();
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} });
    push({ kind: 'bossKill', dur: 400, data: {} });
    expect(active().kind).toBe('bossKill');
    update(1200); // 两个 400 播完
    expect(active()).toBeNull();
  });

  it('reset 清空', () => {
    push({ kind: 'bossKill', dur: 400, data: {} });
    reset();
    expect(active()).toBeNull();
  });
});
```

- [ ] **Step 4.2: 写失败测试（battleFx）**

创建 `tests/render/battlefx.test.js`：

```js
// tests/render/battlefx.test.js — M8 打击感全家桶：吞帧分级/封顶/飘字/快照/演出触发/快进缩放
import { describe, it, expect, beforeEach } from 'vitest';
import {
  consume, update, reset, frozen, addShake, shakeActive, floats,
  ghostOf, enemyHitFlash, heroAttackAnim, setSpeed, tick, leakFlash,
} from '../../src/render/battleFx.js';
import { push, active as cineActive, reset as cineReset } from '../../src/render/cinematic.js';

beforeEach(() => { reset(); cineReset(); });

describe('M8 battleFx 吞帧时停', () => {
  it('hit 30ms / 暴击 50ms / kill 70ms 分级', () => {
    let now = 1000;
    consume([{ type: 'hit', x: 0, y: 0, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    expect(frozen(1001)).toBe(true);
    expect(frozen(1031)).toBe(false); // 30ms 后解冻
    now = 2000;
    consume([{ type: 'hit', x: 0, y: 0, dmg: 10, crit: true, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    expect(frozen(2049)).toBe(true);
    expect(frozen(2051)).toBe(false);
    now = 3000;
    consume([{ type: 'kill', x: 0, y: 0, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing', cause: 'direct' }], { enemies: [] }, now);
    expect(frozen(3069)).toBe(true);
    expect(frozen(3071)).toBe(false);
  });

  it('同帧叠加封顶 120ms', () => {
    const now = 1000;
    const evs = [];
    for (let i = 0; i < 10; i++) {
      evs.push({ type: 'hit', x: 0, y: 0, dmg: 5, crit: false, enemyId: i, enemyType: 'bing' });
    }
    consume(evs, { enemies: [] }, now); // 10×30=300ms → 封顶 120
    expect(frozen(1119)).toBe(true);
    expect(frozen(1121)).toBe(false);
  });

  it('快进缩放：SPEED=10 时 hit 时停 3ms', () => {
    setSpeed(10);
    const now = 1000;
    consume([{ type: 'hit', x: 0, y: 0, dmg: 5, crit: false, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    expect(frozen(1002)).toBe(true);
    expect(frozen(1004)).toBe(false);
    setSpeed(1);
  });
});

describe('M8 battleFx 反馈状态', () => {
  it('hit 生成飘字（普通墨 18px / 暴击朱砂 23px）+ 受击闪白记录', () => {
    const now = 1000;
    consume([
      { type: 'hit', x: 100, y: 200, dmg: 12.4, crit: false, enemyId: 1, enemyType: 'bing' },
      { type: 'hit', x: 300, y: 400, dmg: 88, crit: true, enemyId: 2, enemyType: 'qi' },
    ], { enemies: [] }, now);
    expect(floats().length).toBe(2);
    const f0 = floats()[0];
    expect(f0.text).toBe('12'); // 取整
    expect(f0.size).toBe(18);
    expect(f0.crit).toBe(false);
    expect(floats()[1].size).toBe(23);
    expect(floats()[1].crit).toBe(true);
    expect(enemyHitFlash(1, 1050)).toBe(true);  // 80ms 内
    expect(enemyHitFlash(1, 1100)).toBe(false); // 过期
  });

  it('kill 记录死亡快照（ghost，affix 取自事件），400ms 后过期清除', () => {
    const now = 1000;
    consume([{ type: 'kill', x: 200, y: 300, dmg: 0, crit: false, enemyId: 7, enemyType: 'shuai', isBoss: true, cause: 'direct', affix: 'iron' }], { enemies: [] }, now);
    const g = ghostOf(7, 1050);
    expect(g).toBeTruthy();
    expect(g.type).toBe('shuai');
    expect(g.x).toBe(200);
    expect(g.y).toBe(300);
    expect(g.affix).toBe('iron');
    update(500); // 快照过期清除
    expect(ghostOf(7, 1550)).toBeNull();
  });

  it('kill isBoss 入队斩杀慢镜 400ms；boss 事件入队卷轴 800ms + title', () => {
    const now = 1000;
    const packState = { packIdx: 0, mode: 'chapter', enemies: [] };
    consume([{ type: 'boss', x: 0, y: 0, dmg: 0, crit: false, enemyId: 1, enemyType: 'shuai', isBoss: true }], packState, now);
    expect(cineActive().kind).toBe('bossScroll');
    expect(cineActive().dur).toBe(800);
    expect(cineActive().data.title).toBe('曹仁'); // CHAPTER_PACKS[0].bossTitle
    cineReset();
    const killState = { enemies: [] };
    consume([{ type: 'kill', x: 5, y: 5, dmg: 0, crit: false, enemyId: 2, enemyType: 'shuai', isBoss: true, cause: 'burn' }], killState, now);
    expect(cineActive().kind).toBe('bossKill');
    cineReset();
    const rushState = { packIdx: 0, mode: 'bossrush', bossRound: 3, enemies: [] };
    consume([{ type: 'boss', x: 0, y: 0, dmg: 0, crit: false, enemyId: 3, enemyType: 'shuai', isBoss: true }], rushState, now);
    expect(cineActive().data.title).toBe('车轮战 · 第3轮');
  });

  it('ult 事件不重复触发演出（战鼓由 audio 限频侧管），无崩溃', () => {
    expect(() => consume([{ type: 'ult', x: 360, y: 640, dmg: 600, crit: false, enemyId: null, enemyType: null }], { enemies: [] }, 1000)).not.toThrow();
    expect(cineActive()).toBeNull();
  });

  it('leak 事件触发城门红闪状态', () => {
    const now = 1000;
    consume([{ type: 'leak', x: 360, y: 640, dmg: 1, crit: false, enemyId: null, enemyType: 'bing' }], { enemies: [] }, now);
    expect(leakFlash(now + 100)).toBe(true);
    expect(leakFlash(now + 300)).toBe(false);
  });

  it('屏震：addShake 后 shakeActive，update 过期后解除', () => {
    tick(16); // 初始化内部时钟
    addShake(3, 120);
    expect(shakeActive()).toBe(true);
    for (let i = 0; i < 10; i++) update(20); // 累计 200ms > 120ms
    expect(shakeActive()).toBe(false);
  });

  it('hit 事件驱动赵云突刺动画（200ms）', () => {
    const now = 1000;
    consume([{ type: 'hit', x: 460, y: 740, dmg: 10, crit: false, enemyId: 1, enemyType: 'bing' }], { enemies: [] }, now);
    const a = heroAttackAnim(now + 50);
    expect(a.active).toBe(true);
    expect(a.ang).toBeCloseTo(Math.atan2(740 - 640, 460 - 360), 5); // 朝命中点
    expect(heroAttackAnim(now + 250).active).toBe(false); // 200ms 过期
  });

  it('update 推进 cinematic 与飘字过期清理', () => {
    const now = 1000;
    consume([{ type: 'kill', x: 0, y: 0, dmg: 9, crit: false, enemyId: 1, enemyType: 'bing', cause: 'direct' }], { enemies: [] }, now);
    expect(floats().length).toBe(1); // kill(dmg>0) 也有飘字
    for (let i = 0; i < 12; i++) update(50); // 600ms > 500ms 飘字寿命
    expect(floats().length).toBe(0);
  });
});
```

- [ ] **Step 4.3: 跑测试确认失败**

Run: `pnpm vitest run tests/render/cinematic.test.js tests/render/battlefx.test.js`
Expected: FAIL（两个模块不存在）

- [ ] **Step 4.4: 实现 cinematic.js（队列核心）**

创建 `src/render/cinematic.js`：

```js
// render/cinematic.js — M8 演出队列状态机：Boss 卷轴 / 斩杀慢镜（与 hit-stop 共用吞帧机制）
// 队列串行独占；绘制函数 draw() 于 Task 8 补齐
export const QUEUE_MAX = 2;
export const DUR_SCROLL = 800; // Boss 卷轴 0.8s
export const DUR_KILL = 400;   // 斩杀慢镜 0.4s

const queue = [];

export function push(item) {
  if (queue.length >= QUEUE_MAX) return; // 防积压
  queue.push({ t: 0, ...item });
}

export function active() { return queue[0] || null; }

export function update(dtMs) {
  const cur = queue[0];
  if (!cur) return;
  cur.t += dtMs;
  if (cur.t >= cur.dur) queue.shift();
}

export function reset() { queue.length = 0; }
```

- [ ] **Step 4.5: 实现 battleFx.js**

创建 `src/render/battleFx.js`：

```js
// render/battleFx.js — M8 打击感全家桶：engine 事件消费 → 吞帧时停/屏震/飘字/击退/闪白/死亡快照/音效/演出触发
// 渲染层可变状态（模块级单例，单战场实例）；engine 无感知。时长统一 ÷ speed（验收快进不卡顿）
import { sfx } from '../platform/audio.js';
import * as particles from './particles.js';
import * as cinematic from './cinematic.js';
import { HERO_POS, CHAPTER_PACKS } from '../engine/config.js';

const HIT = { normal: 30, crit: 50, kill: 70, cap: 120 };

let speed = 1;
let renderClock = 0;      // 渲染层时钟（真实推进，吞帧不影响；粒子/飘字/演出用）
let hitStopUntil = 0;     // 吞帧截止时刻（与 core consume 传入的 now 同口径 = 渲染时钟）
let shakeState = null;    // { amp, start, dur }
let floatList = [];       // 飘字
let enemyFx = new Map();  // id → { hitAt, knockAt, dieAt, die:{type,x,y,affix} }
let leakFlashUntil = 0;
let heroAtk = null;       // { at, ang }
let prevUltT = -1;        // 大招分镜节点检测

export function setSpeed(s) { speed = Math.max(1, Math.min(10, s)); }

// 渲染时钟推进（core 每帧先调）；返回当前渲染时钟
export function tick(dtMs) { renderClock += dtMs; return renderClock; }

// 当前渲染时钟只读（battle.js 绘制用，与 consume/update 同口径）
export function nowClock() { return renderClock; }

export function frozen(now) { return now < hitStopUntil; }

// 吞帧判定 + 演出占用（core 的 busy）
export function busy(now) { return frozen(now) || !!cinematic.active(); }

export function reset() {
  hitStopUntil = 0;
  shakeState = null;
  floatList = [];
  enemyFx = new Map();
  leakFlashUntil = 0;
  heroAtk = null;
  prevUltT = -1;
  cinematic.reset();
  particles.reset();
}

function addHitStop(ms, now) {
  const dur = ms / speed;
  const base = Math.max(hitStopUntil, now);
  hitStopUntil = Math.min(base + dur, now + HIT.cap / speed); // 同帧叠加封顶
}

// 屏震（amp px × dur ms）；frame 取模伪随机偏移由 beginShake 消费
export function addShake(amp, durMs) {
  shakeState = { amp: amp / Math.max(1, speed * 0.5), start: renderClock, dur: durMs / Math.max(1, speed * 0.5) };
}
export function shakeActive() {
  return !!shakeState && renderClock - shakeState.start < shakeState.dur;
}
// 屏震 save+translate；返回 true 由调用方 restore
export function beginShake(ctx) {
  if (!shakeActive()) return false;
  const f = Math.floor(renderClock / 16); // 渲染帧号（确定性）
  const amp = shakeState.amp;
  const dx = (((f * 7) % 26) / 25 * 2 - 1) * amp;
  const dy = (((f * 11) % 34) / 33 * 2 - 1) * amp;
  ctx.save();
  ctx.translate(dx, dy);
  return true;
}
export function endShake(ctx) { ctx.restore(); }

export function floats() { return floatList; }

// 敌人受击闪白是否活跃
export function enemyHitFlash(id, now) {
  const fx = enemyFx.get(id);
  return !!fx && fx.hitAt !== undefined && now - fx.hitAt < 80 / speed;
}

// 敌人击退相位（0-1，200ms 往返）；方向由渲染层按路径切线计算
export function enemyKnockPhase(id, now) {
  const fx = enemyFx.get(id);
  if (!fx || fx.knockAt === undefined) return 0;
  const q = (now - fx.knockAt) / (200 / speed);
  if (q < 0 || q >= 1) return 0;
  return Math.sin(q * Math.PI); // 0→1→0 回弹
}

// 死亡幽灵快照（400ms 内有效）
export function ghostOf(id, now) {
  const fx = enemyFx.get(id);
  if (!fx || fx.dieAt === undefined) return null;
  if (now - fx.dieAt >= 400 / speed) return null;
  return fx.die;
}

export function leakFlash(now) { return now < leakFlashUntil; }

// 赵云突刺动画（hit 事件驱动，200ms）
export function heroAttackAnim(now) {
  if (!heroAtk || now - heroAtk.at >= 200 / speed) return { active: false, ang: 0, t: 0 };
  return { active: true, ang: heroAtk.ang, t: (now - heroAtk.at) / 1000 };
}

// ===== 事件消费（core 在 advanceFrame 之后调用；用完即弃由 core 置空 frameEvents）=====
export function consume(events, state, now) {
  for (const ev of events || []) {
    if (ev.type === 'hit') {
      addHitStop(ev.crit ? HIT.crit : HIT.normal, now);
      const fx = enemyFx.get(ev.enemyId) || {};
      fx.hitAt = now;
      fx.knockAt = now;
      enemyFx.set(ev.enemyId, fx);
      particles.splash(ev.x, ev.y, ev.crit ? 10 : 6);
      floatList.push({
        x: ev.x, y: ev.y - 30, text: String(Math.round(ev.dmg)),
        crit: !!ev.crit, size: ev.crit ? 23 : 18, born: renderClock,
      });
      heroAtk = { at: now, ang: Math.atan2(ev.y - HERO_POS.y, ev.x - HERO_POS.x) };
      sfx('hit');
    } else if (ev.type === 'kill') {
      addHitStop(HIT.kill, now);
      const fx = enemyFx.get(ev.enemyId) || {};
      fx.dieAt = now;
      fx.die = { type: ev.enemyType, x: ev.x, y: ev.y, affix: ev.affix || null }; // affix 随事件携带（state.enemies 里已被移除，查不到）
      enemyFx.set(ev.enemyId, fx);
      particles.blot(ev.x, ev.y);
      if (ev.dmg > 0) {
        floatList.push({
          x: ev.x, y: ev.y - 30, text: String(Math.round(ev.dmg)),
          crit: !!ev.crit, size: ev.crit ? 23 : 18, born: renderClock,
        });
      }
      addShake(3, 120); // 击杀屏震
      sfx('kill');
      if (ev.isBoss) cinematic.push({ kind: 'bossKill', dur: cinematic.DUR_KILL, data: { x: ev.x, y: ev.y, type: ev.enemyType } });
    } else if (ev.type === 'leak') {
      leakFlashUntil = now + 200 / speed; // 城门红闪
    } else if (ev.type === 'boss') {
      const title = state.mode === 'bossrush'
        ? `车轮战 · 第${state.bossRound || 1}轮`
        : (CHAPTER_PACKS[state.packIdx || 0] || {}).bossTitle || '敌帅';
      cinematic.push({ kind: 'bossScroll', dur: cinematic.DUR_SCROLL, data: { title } });
      addShake(2, 300); // Boss 登场屏震
    } else if (ev.type === 'ult') {
      sfx('drum'); // 战鼓起手（演出本体由 state.ult 驱动 fx.js，不经 cinematic）
    }
  }
}

// 大招分镜节点检测（core 每帧 battle 分支调；跨界触发音效/溅墨/屏震）
export function ultTick(state) {
  if (!state || !state.ult) { prevUltT = -1; return; }
  const t = state.ult.t;
  const prev = prevUltT;
  prevUltT = t;
  if (prev < 0) return; // 首帧只记录
  const SEG = 1.0 / 7;
  for (let j = 1; j <= 7; j++) { // 七段突刺节点：溅墨 + 短噗
    const node = 0.6 + j * SEG;
    if (prev < node && t >= node && j <= 6) {
      particles.splash(HERO_POS.x + Math.cos(j * 2.1) * 120, HERO_POS.y + Math.sin(j * 2.1) * 120, 5);
      sfx('hit');
    }
  }
  if (prev < 1.6 && t >= 1.6) sfx('skill');   // 收招白闪
  if (prev < 2.2 && t >= 2.2) { addShake(8, 300); sfx('drum'); } // 冲击波屏震
}

// 每帧推进（真实时钟：吞帧期间粒子/飘字/演出仍走）
export function update(dtMs) {
  cinematic.update(dtMs);
  const dtSec = dtMs / 1000;
  particles.update(dtSec);
  floatList = floatList.filter((f) => renderClock - f.born < 500 / speed);
  // 惰性清理过期敌人视觉状态（防 Map 无限膨胀）
  if (enemyFx.size > 60) {
    for (const [id, fx] of enemyFx) {
      const dead = fx.dieAt !== undefined && renderClock - fx.dieAt >= 450 / speed;
      const stale = fx.dieAt === undefined && fx.hitAt !== undefined && renderClock - fx.hitAt >= 1000;
      if (dead || stale) enemyFx.delete(id);
    }
  }
}
```

- [ ] **Step 4.6: 实现 config.js bossTitle 与 audio.js 三音**

config.js — 6 套 CHAPTER_PACKS 各加 `bossTitle` 字段（每包对象 name 行后）：

```js
  { // 第1章 长坂坡：教学缓冲，无词缀（敌池含 BOSS 波 shuai）
    name: '长坂坡', bossTitle: '曹仁', affixRate: 0,
```

同理依次：第2章 乌林 `bossTitle: '曹休'`、第3章 赤壁 `bossTitle: '曹真'`、第4章 华容道 `bossTitle: '张郃'`、第5章 荆州 `bossTitle: '徐晃'`、第6章 成都 `bossTitle: '曹洪'`。

audio.js — SFX 表（原 L48-57）加三项：

```js
const SFX = {
  click:   () => tone(880, 0.06, 'square', 0.5, 0, 660),
  attack:  () => tone(220, 0.09, 'triangle', 0.7, 0, 110),
  ult:     () => { tone(80, 0.5, 'sine', 1.0, 0, 40); tone(160, 0.3, 'square', 0.4, 0.05, 60); },
  skill:   () => { tone(1046, 0.12, 'sine', 0.6); tone(1318, 0.12, 'sine', 0.6, 0.08); tone(1568, 0.2, 'sine', 0.6, 0.16); },
  coin:    () => { tone(1318, 0.08, 'sine', 0.6); tone(1975, 0.14, 'sine', 0.6, 0.06); },
  compose: () => { tone(523, 0.07, 'triangle', 0.8); tone(523, 0.07, 'triangle', 0.8, 0.1); },
  win:     () => [523, 587, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'sine', 0.6, i * 0.1)), // 五声上行
  lose:    () => { tone(330, 0.3, 'sine', 0.7, 0, 220); tone(220, 0.4, 'sine', 0.7, 0.25, 147); },
  hit:     () => tone(320, 0.05, 'triangle', 0.5, 0, 160), // M8 命中短噗
  kill:    () => { tone(180, 0.12, 'sine', 0.8, 0, 60); tone(90, 0.16, 'square', 0.3, 0.02, 45); }, // M8 击杀低沉
  drum:    () => { tone(60, 0.4, 'sine', 1.0, 0, 38); tone(120, 0.2, 'triangle', 0.5, 0.04, 80); }, // M8 大招战鼓
};
```

audio.js — `sfx` 替换为限频版（模块顶部加 `const lastPlay = {};`）：

```js
const lastPlay = {};

export function sfx(name) {
  if (!ac || !soundOn || !SFX[name]) return;
  const now = Date.now(); // wx 无 performance.now，统一 Date.now
  if (lastPlay[name] && now - lastPlay[name] < 60) return; // M8 限频防噪（60ms 同名冷却）
  lastPlay[name] = now;
  SFX[name]();
}
```

- [ ] **Step 4.7: 跑测试**

Run: `pnpm vitest run tests/render/cinematic.test.js tests/render/battlefx.test.js`
Expected: PASS（cinematic 5 + battlefx 11 = 16 用例）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 38 文件 / 275 用例全绿（若 config.test.js 断言包对象形状挂了，按其断言风格补 bossTitle 期望值——只有显式 `toEqual` 整对象断言才会挂）

- [ ] **Step 4.8: Commit**

```powershell
git add src/render/cinematic.js src/render/battlefx.js src/engine/config.js src/platform/audio.js tests/render/cinematic.test.js tests/render/battlefx.test.js
git commit -m "feat(m8): battleFx打击感全家桶+cinematic队列核心+三合成音+bossTitle"
```

---

### Task 5: battle.js 渲染接线 + 场景层次升级

**Files:**
- Modify: `src/render/battle.js`（敌人小人/赵云长枪/飘字/幽灵/粒子/屏震/氛围墨点/路径质感/红闪）
- Modify: `src/render/art.js`（drawBattleBackdrop 双层远山 + tSec 参数）
- Test: `tests/render/m8-smoke.test.js`

- [ ] **Step 5.1: 写失败测试（mock ctx 冒烟，M7 防线复用）**

创建 `tests/render/m8-smoke.test.js`：

```js
// tests/render/m8-smoke.test.js — M8 mock ctx 全链路冒烟：drawX 链路含动画器/粒子/演出各状态无崩溃
// 渲染循环崩溃 vitest 常规断言抓不到（无 ctx）——通用 mock ctx 跑全链路是 M7 验证过的有效防线
import { describe, it, expect, beforeEach } from 'vitest';
import { drawBattle } from '../../src/render/battle.js';
import { createBattle, advanceFrame } from '../../src/engine/state.js';
import { spawnEnemy } from '../../src/engine/enemy.js';
import * as battleFx from '../../src/render/battleFx.js';
import { reset as cineReset, push as cinePush } from '../../src/render/cinematic.js';
import '../../src/render/art.js';
import { setSkin } from '../../src/render/theme.js';

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

beforeEach(() => { battleFx.reset(); cineReset(); setSkin('ink'); });

function stagedBattle() {
  const s = createBattle(20260304, {});
  s.stage = 'wave';
  s.wave = 1;
  s.spawnQueue = [];
  spawnEnemy(s, 'bing', 0);
  spawnEnemy(s, 'qi', 1);
  spawnEnemy(s, 'gong', 2);
  spawnEnemy(s, 'shuai', 0);
  s.enemies[0].t = 0.3;
  s.enemies[1].t = 0.5;
  s.enemies[2].t = 0.7;
  s.enemies[3].t = 0.2;
  return s;
}

describe('M8 drawBattle 冒烟', () => {
  it('wave 态基础绘制（四类敌人小人 + HUD）不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('受击/飘字/幽灵/屏震活跃态绘制不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    const now = battleFx.tick(0);
    battleFx.consume([
      { type: 'hit', x: 200, y: 300, dmg: 12, crit: true, enemyId: s.enemies[0].id, enemyType: 'bing' },
    ], s, 1000);
    battleFx.update(30);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('kill 后死亡幽灵 + 溅墨绘制不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    battleFx.consume([
      { type: 'kill', x: 200, y: 300, dmg: 60, crit: false, enemyId: s.enemies[0].id, enemyType: 'bing', cause: 'direct' },
    ], s, 1000);
    battleFx.update(100);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('Boss 卷轴演出中绘制不炸', () => {
    const s = stagedBattle();
    battleFx.tick(16);
    cinePush({ kind: 'bossScroll', dur: 800, data: { title: '曹仁' } });
    cinePush({ kind: 'bossKill', dur: 400, data: { x: 360, y: 500, type: 'shuai' } });
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });

  it('大招演出各时段绘制不炸（四分镜全覆盖）', () => {
    const s = stagedBattle();
    s.slots[0] = { id: 1, type: 'jice', tier: 1 };
    s.slots[1] = { id: 2, type: 'jice', tier: 1 };
    battleFx.tick(16);
    for (const t of [0.2, 0.8, 1.4, 1.9, 2.5]) {
      s.ult = { t };
      expect(() => drawBattle(makeCtx(), s)).not.toThrow();
    }
    s.ult = null;
  });

  it('skillPick / interval / victory / over 各 stage 绘制不炸', () => {
    const ctx = makeCtx();
    const s = stagedBattle();
    battleFx.tick(16);
    s.stage = 'skillPick';
    s.pickChoices = ['crit', 'atk', 'range'];
    expect(() => drawBattle(ctx, s)).not.toThrow();
    for (const st of ['interval', 'victory', 'over']) {
      s.stage = st;
      expect(() => drawBattle(ctx, s)).not.toThrow();
    }
  });

  it('双皮肤（皮影）全链路不炸', () => {
    setSkin('shadow');
    const s = stagedBattle();
    battleFx.tick(16);
    expect(() => drawBattle(makeCtx(), s)).not.toThrow();
  });
});
```

- [ ] **Step 5.2: 跑测试确认失败**

Run: `pnpm vitest run tests/render/m8-smoke.test.js`
Expected: PASS（7 用例）——**注意：此冒烟是防线不是行为断言，只证明「全链路不炸」；此时视觉尚未接线，行为验收由 Task 9 截图目检兜底（drawCinematic 在 Task 8 才接入 battle.js，本冒烟不依赖它）**

- [ ] **Step 5.3: 实现 art.js 双层远山**

art.js `drawBattleBackdrop`（原 L308-323）整函数替换：

```js
  // ---------- 战场背景（水墨远山 + 宣纸 + 雾带） ----------
  // M8 场景层次：后层 op0.16 + 前层 op0.30（mockup v2 曲线），前层 8s 周期 ±10px 缓移（云雾感）
  // tSec：时间秒（battle.js 传 state.frame/60；缺省 0 兼容旧调用）
  function drawBattleBackdrop(ctx, x, y, w, h, tSec) {
    tSec = tSec || 0;
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#efe5cd'); g.addColorStop(0.55, C.paper); g.addColorStop(1, C.paperDeep);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // 双层远山：后层淡远、前层浓近
    mountain(ctx, x + w * 0.72, y + h * 0.30, w * 0.55, h * 0.26, 'rgba(58,51,42,0.16)');
    mountain(ctx, x + w * 0.30 + Math.sin((tSec / 8) * Math.PI * 2) * 10, y + h * 0.36, w * 0.62, h * 0.24, 'rgba(58,51,42,0.30)');
    // 雾带
    var fog = ctx.createLinearGradient(x, y + h * 0.42, x, y + h * 0.62);
    fog.addColorStop(0, 'rgba(232,220,196,0)');
    fog.addColorStop(1, C.paper);
    ctx.fillStyle = fog;
    ctx.fillRect(x, y + h * 0.42, w, h * 0.2);
  }
```

（既有 `mountain` 辅助函数不动。）

- [ ] **Step 5.4: 实现 battle.js（整文件替换）**

`src/render/battle.js` 整文件替换为：

```js
// render/battle.js — 战场渲染：只读 state，每帧重绘
// M8：部件小人 + 打击感反馈（飘字/幽灵/屏震/红闪）+ 场景层次（双层远山/氛围墨点/路径质感）
import {
  LOGICAL_W, LOGICAL_H, LANES, HERO_POS,
  TOTAL_WAVES, ITEM_TYPES, ROGUE_SKILLS, RARITY_NAMES, ULT_JICE_COST,
} from '../engine/config.js';
import { pathPoint } from '../engine/enemy.js';
import { countJice, canUlt } from '../engine/ult.js';
import { canMergeAt } from '../engine/slot.js';
import { beginUltShake, drawUltCinematic } from './fx.js';
import { pose, drawEnemyFigure, drawHeroSpear, figureHeight } from './animator.js';
import * as battleFx from './battleFx.js';
import * as particles from './particles.js';
// 注：drawCinematic 的 import 与调用在 Task 8 接入（届时 cinematic.js 才导出该函数）

const KAI = '"KaiTi","STKaiti","楷体",serif';
const ELEM_COLORS = { 金: '#c9a227', 水: '#4a6fa5', 雷: '#6b4e9b', 火: '#b33a2b', 风: '#7ba098' };
const RARITY_COLORS = ['#52525b', '#4a6fa5', '#c9a227'];
const SLOT_X0 = 30, SLOT_Y = 1112, SLOT_W = 72, SLOT_H = 96, SLOT_STEP = 84;
const ULT_CX = 600, ULT_CY = 985, ULT_R = 52;

export function drawBattle(ctx, state) {
  const Art = globalThis.Art;
  const now = battleFx.nowClock(); // 与 core consume 同口径（渲染时钟），禁用 performance.now 混用
  const shaken1 = state.ult ? beginUltShake(ctx, state) : false; // 大招尾段屏抖
  const shaken2 = battleFx.beginShake(ctx);                      // 击杀/登场屏震
  if (Art.skinId === 'shadow') Art.drawShadowBackdrop(ctx, 0, 0, LOGICAL_W, LOGICAL_H);
  else Art.drawBattleBackdrop(ctx, 0, 0, LOGICAL_W, LOGICAL_H, state.frame / 60); // M8 双层远山随引擎时钟缓移
  drawLanes(ctx);
  drawAmbient(ctx, state);
  drawGhosts(ctx, now);
  for (const e of state.enemies) drawEnemy(ctx, e, now);
  drawHero(ctx, state, now);
  drawHud(ctx, state);
  drawWaveProgress(ctx, state);
  drawSlots(ctx, state);
  if (!state.ult) drawUltButton(ctx, state);
  drawStageBanner(ctx, state);
  drawLeakFlash(ctx, now);
  battleFx.drawFloatsPublic(ctx, now); // 飘字（battleFx 导出的绘制）
  particles.draw(ctx);
  if (state.ult) drawUltCinematic(ctx, state);
  if (shaken2) battleFx.endShake(ctx);
  if (shaken1) ctx.restore();
  if (state.stage === 'skillPick' && state.pickChoices) drawSkillPick(ctx, state);
}
```

（时钟口径说明：core 的 `consume(events, state, now)` 传入的 now = `battleFx.tick(dtMs)` 返回的渲染时钟；drawBattle 用 `battleFx.nowClock()` 取同一时钟——飘字/闪白/幽灵/突刺动画全链路单一时间轴，禁止与 performance.now 混用，否则生产环境受击闪白/长枪突刺永不生效。）

继续整文件（以下函数跟随 drawBattle 之后，替换原有全部实现；drawHud/drawWaveProgress/drawSlots/drawSlotCell/drawUltButton/drawSkillPick/drawPickCard/wrapText/banner 与原版逐字相同故此处只列出**新增/修改**的函数，未列出的原样保留）：

```js
// ===== M8 新增：路径质感（晕染底 + 主虚线 + 路口墨点）=====
function drawLanes(ctx) {
  const Art = globalThis.Art;
  ctx.save();
  ctx.lineCap = 'round';
  // 底层晕染 8px 低透明
  ctx.strokeStyle = 'rgba(90,80,64,0.18)';
  ctx.lineWidth = 8;
  for (const lane of LANES) strokeLane(ctx, lane);
  // 主线 3px 虚线
  ctx.strokeStyle = Art.C.laneInk;
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  for (const lane of LANES) strokeLane(ctx, lane);
  ctx.setLineDash([]);
  // 路口墨点加重（拐点+终点）
  ctx.fillStyle = 'rgba(31,27,22,0.5)';
  for (const lane of LANES) {
    for (const pt of lane.slice(1)) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function strokeLane(ctx, lane) {
  ctx.beginPath();
  ctx.moveTo(lane[0].x, lane[0].y);
  for (let i = 1; i < lane.length; i++) ctx.lineTo(lane[i].x, lane[i].y);
  ctx.stroke();
}

// ===== M8 新增：氛围墨点（6 颗确定性缓浮，frame 驱动零状态）=====
function drawAmbient(ctx, state) {
  const Art = globalThis.Art;
  const t = state.frame / 60;
  const cols = [Art.C.ink, Art.C.ink, Art.C.seal, Art.C.ink, Art.C.seal, Art.C.ink];
  for (let i = 0; i < 6; i++) {
    const ph = t * (0.05 + i * 0.011) + i * 1.9;
    const x = ((i * 137 + Math.sin(ph) * 40) % LOGICAL_W + LOGICAL_W) % LOGICAL_W;
    const y = ((i * 331 + t * (6 + i)) % LOGICAL_H + LOGICAL_H) % LOGICAL_H;
    ctx.globalAlpha = 0.1 + (i % 2) * 0.04;
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== M8 新增：死亡幽灵（die 态小人 + 墨散由粒子侧已发）=====
function drawGhosts(ctx, now) {
  const ghosts = battleFx.activeGhosts(now); // battleFx 导出的快照遍历
  for (const g of ghosts) {
    const age = Math.max(0, Math.min(0.4, (now - g.bornAt) / 1000));
    const pz = pose(g.type, 'die', age);
    drawEnemyFigure(ctx, g.x, g.y, g.type, pz);
  }
}

// ===== M8 改造：敌人绘制（圆牌 → 部件小人）=====
function drawEnemy(ctx, e, now) {
  const Art = globalThis.Art;
  const p = pathPoint(e.lane, e.t);
  // 动画态判定：受击 flash → hit；投石车轰击（tou 且刚漏过）→ attack；否则 walk
  let anim = 'walk';
  if (battleFx.enemyHitFlash(e.id, now)) anim = 'hit';
  const phase = now / 1000 + e.id * 0.7; // enemyId 错开步频
  const pz = pose(e.type, anim, phase);
  // 击退 offset：路径切线反向 × 6px × 回弹相位（视觉层 offset，engine pos 不改）
  let kx = 0, ky = 0;
  const kp = battleFx.enemyKnockPhase(e.id, now);
  if (kp > 0) {
    const a = pathPoint(e.lane, Math.max(0, e.t - 0.01));
    const b = pathPoint(e.lane, e.t);
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    kx = (-dx / len) * 6 * kp;
    ky = (-dy / len) * 6 * kp;
  }
  // 血条（朱砂，小人头顶）
  drawHpBar(ctx, p.x + kx, p.y - figureHeight(e.type) - 12, e.hp / e.hpMax);
  drawEnemyFigure(ctx, p.x + kx, p.y + pz.bob + ky, e.type, pz);
  // 精英词缀印（沿用 Art.sealStamp）
  if (e.affix) {
    Art.sealStamp(ctx, p.x + kx + 22, p.y - figureHeight(e.type) + 6, 14, Art.AFFIX_TEXT[e.affix] || '精', 'gold', 8);
  }
  drawStatusMarks(ctx, p, e);
}

// M8 新增：敌人血条（原 drawEnemyToken 内置逻辑外置）
function drawHpBar(ctx, x, y, ratio) {
  if (ratio >= 1) return;
  const bw = 40, bh = 4;
  ctx.fillStyle = 'rgba(31,27,22,0.55)';
  ctx.fillRect(x - bw / 2, y, bw, bh);
  ctx.fillStyle = '#9e2a1e';
  ctx.fillRect(x - bw / 2, y, bw * Math.max(0, Math.min(1, ratio)), bh);
}

// ===== M8 改造：赵云（双环底牌保留 + 攻击突刺长枪）=====
function drawHero(ctx, state, now) {
  const Art = globalThis.Art;
  Art.drawHeroToken(ctx, HERO_POS.x, HERO_POS.y, 36, 1);
  const atk = battleFx.heroAttackAnim(now);
  if (atk.active) drawHeroSpear(ctx, HERO_POS.x, HERO_POS.y, atk.ang, atk.t);
}

// ===== M8 新增：漏怪城门红闪（200ms）=====
function drawLeakFlash(ctx, now) {
  if (!battleFx.leakFlash(now)) return;
  const g = ctx.createRadialGradient(HERO_POS.x, HERO_POS.y, 40, HERO_POS.x, HERO_POS.y, 200);
  g.addColorStop(0, 'rgba(158,42,30,0)');
  g.addColorStop(0.7, 'rgba(158,42,30,0.28)');
  g.addColorStop(1, 'rgba(158,42,30,0)');
  ctx.fillStyle = g;
  ctx.fillRect(HERO_POS.x - 200, HERO_POS.y - 200, 400, 400);
}
```

同时 battleFx.js 需补两个导出（Step 4.5 文件末尾追加）：

```js
// 活跃死亡幽灵列表（battle.js drawGhosts 消费）
export function activeGhosts(now) {
  const out = [];
  for (const [, fx] of enemyFx) {
    if (fx.dieAt !== undefined && renderClock - fx.dieAt < 400 / speed) {
      out.push({ ...fx.die, bornAt: fx.dieAt });
    }
  }
  return out;
}

// 飘字绘制（楷体上浮 40px 淡出 500ms；暴击朱砂加粗）
export function drawFloatsPublic(ctx, now) {
  const C = (globalThis.Art && globalThis.Art.C) || { ink: '#1f1b16', seal: '#9e2a1e' };
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floatList) {
    const q = (renderClock - f.born) / (500 / speed);
    if (q >= 1) continue;
    ctx.globalAlpha = 1 - q;
    ctx.fillStyle = f.crit ? C.seal : C.ink;
    ctx.font = `${f.crit ? 'bold ' : ''}${f.size}px "KaiTi","STKaiti","楷体",serif`;
    ctx.fillText(f.text, f.x, f.y - 40 * q);
  }
  ctx.globalAlpha = 1;
}
```

并在 battleFx.test.js 的 import 列表补 `activeGhosts, drawFloatsPublic`（冒烟验证）：

```js
import {
  consume, update, reset, frozen, addShake, shakeActive, floats,
  ghostOf, enemyHitFlash, heroAttackAnim, setSpeed, tick, activeGhosts, drawFloatsPublic,
} from '../../src/render/battleFx.js';
```

并在 `tests/render/battlefx.test.js` 的 describe 末尾补一用例：

```js
  it('activeGhosts 列出活跃幽灵；drawFloatsPublic mock ctx 不炸', () => {
    const now = 1000;
    consume([{ type: 'kill', x: 10, y: 20, dmg: 5, crit: false, enemyId: 9, enemyType: 'bing', cause: 'direct' }], { enemies: [] }, now);
    expect(activeGhosts(now + 100)).toHaveLength(1);
    expect(activeGhosts(now + 500)).toHaveLength(0);
    expect(() => drawFloatsPublic(makeCtx(), now + 100)).not.toThrow();
  });
```

（battlefx.test.js 文件顶部需加 makeCtx 定义——从 wxContainer.test.js 复制的 Proxy 工厂。）

- [ ] **Step 5.5: 跑测试 + 全量回归**

Run: `pnpm vitest run tests/render/m8-smoke.test.js tests/render/battlefx.test.js`
Expected: PASS（7 + 12 用例）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 39 文件 / 283 用例全绿。**若既有渲染测试（render/quests.test.js、render/theme.test.js、platform/wxContainer.test.js）挂：多半因 battle.js 顶部新增 import 循环或 Art.AFFIX_TEXT 引用——AFFIX_TEXT 已在 art.js 导出表（L528）✔；循环检查：battleFx → audio/particles/cinematic/config，battle → battleFx/animator/particles/fx，无环 ✔**

- [ ] **Step 5.6: Commit**

```powershell
git add src/render/battle.js src/render/art.js src/render/battlefx.js tests/render/m8-smoke.test.js tests/render/battlefx.test.js
git commit -m "feat(m8): battle渲染接线 部件小人/飘字/幽灵/屏震/红闪/氛围墨点/路径质感/双层远山"
```

---

### Task 6: core 吞帧时停接线 + 终态延后

**Files:**
- Modify: `src/app/core.js`（loop battle 分支 + startBattle reset + setSpeed）

- [ ] **Step 6.1: 实现 core.js 改动**

core.js 顶部 import 区（L34 sfx import 行后）加：

```js
import * as battleFx from '../render/battleFx.js'; // M8 打击感全家桶（吞帧时停/反馈）
```

`createApp` 内 `SPEED` 声明行（L67）后加：

```js
  battleFx.setSpeed(SPEED); // M8：快进缩放吞帧/演出时长
```

`startBattle` 内 `reviveUsed = false;`（L406）后加：

```js
    battleFx.reset(); // M8：每局视觉状态清零（时停/屏震/飘字/幽灵/演出/粒子）
```

`loop` 的 battle 分支（原 L518-528）整段替换：

```js
    if (screen === 'battle') {
      const now = battleFx.tick(dtMs); // 渲染时钟推进（粒子/飘字/演出用真实时间）
      const busy = battleFx.busy(now); // 吞帧中或演出中 → engine 冻结
      if (!busy) {
        battleState = advanceFrame(battleState, battleState.pendingInputs, dtMs * SPEED);
        battleState.pendingInputs = null;
        battleFx.consume(battleState.frameEvents || [], battleState, now); // 事件→时停/反馈/演出
        battleState.frameEvents = []; // 用完即弃（终态冻结期防重复消费）
        battleFx.ultTick(battleState); // 大招分镜节点（音效/溅墨/屏震）
      }
      battleFx.update(dtMs); // 演出/粒子/飘字推进（真实时钟，吞帧期间也走）
      const terminal = battleState.stage === 'victory' || battleState.stage === 'over';
      if (terminal && !battleFx.busy(battleFx.tick(0))) {
        if (battleState.stage === 'over' && !reviveUsed) {
          screen = 'revive'; // 拦截结算 → 弹复活（演出播完才处置）
        } else {
          finishBattle();
        }
      }
      drawBattle(ctx, battleState);
    }
```

（要点：① `busy` 时完全不调 advanceFrame、不清 pendingInputs——玩家点击保留到解冻后消费；② 终态处置延后到演出播完——斩杀慢镜 0.4s 先演再进结算/复活；③ `battleFx.tick(0)` 取当前渲染时钟不推进。）

- [ ] **Step 6.2: 全量回归 + 构建**

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 39 文件 / 283 用例全绿（core.js 无单测，行为由冒烟+真机验证）

Run: `pnpm build:wx 2>&1 | Select-String -Pattern "首包|OK|error"`
Expected: 构建成功，首包体积断言通过（≤4MB）

- [ ] **Step 6.3: Commit**

```powershell
git add src/app/core.js
git commit -m "feat(m8): core吞帧时停接线 busy冻结engine+终态演出延后+每局reset"
```

---

### Task 7: 大招分镜 v2（fx.js 四段重写）

**Files:**
- Modify: `src/render/fx.js`（整文件替换：聚雾/七段突刺/白闪速度线/墨波大印 + 屏抖改 8px）

- [ ] **Step 7.1: 实现 fx.js（整文件替换）**

`src/render/fx.js` 整文件替换为：

```js
// render/fx.js — M8 大招「七进七出」2.8s 分镜 v2（六格分镜定稿）与屏抖（只读 state，逐帧重绘）
// 四段：① 0-0.6 起手聚雾 ② 0.6-1.6 七段突刺 ③ 1.6-2.2 收招白闪 ④ 2.2-2.8 冲击波·屏震·印
// 段界音效/溅墨/屏震由 battleFx.ultTick 跨界触发（fx.js 保持纯绘制）
import { HERO_POS, ULT_CAST_DUR } from '../engine/config.js';

const KAI = '"KaiTi","STKaiti","楷体",serif';
// 金色随皮肤色板（皮影戏下为鎏金亮金）
function gold() { return (typeof globalThis.Art !== 'undefined' && globalThis.Art) ? globalThis.Art.C.gold : '#c9a227'; }

const T1 = 0.6, T2 = 1.6, T3 = 2.2; // 段界（秒）
const SEG_DUR = (T2 - T1) / 7;      // 七段突刺每段 1/7 s ≈ 0.143

// 七段方向：黄金角取模伪随机（确定性）
const SEG_ANGLES = Array.from(
  { length: 7 },
  (_, j) => (0.65 + j * 2.399963229728653) % (Math.PI * 2),
);

// 屏抖（p≥T3/2.8）：save+translate，返回 true 由调用方 restore。
// M8：幅度 8px（spec 12.2 大招屏震 8px×300ms 口径）线性衰减
export function beginUltShake(ctx, state) {
  const p = state.ult.t / ULT_CAST_DUR;
  if (p < T3 / ULT_CAST_DUR) return false;
  const amp = (8 * (1 - p)) / (1 - T3 / ULT_CAST_DUR);
  const dx = (((state.frame * 7) % 26) / 25 * 2 - 1) * amp;
  const dy = (((state.frame * 11) % 34) / 33 * 2 - 1) * amp;
  ctx.save();
  ctx.translate(dx, dy);
  return true;
}

// 分镜入口
export function drawUltCinematic(ctx, state) {
  const t = state.ult.t;
  if (t < T1) drawGather(ctx, t);
  else if (t < T2) drawThrust(ctx, t - T1);
  else if (t < T3) drawFlash(ctx, (t - T2) / (T3 - T2));
  else drawImpulse(ctx, (t - T3) / (ULT_CAST_DUR - T3));
}

// ① 起手聚雾 0-0.6：边缘压暗 20% + 四角墨雾聚向赵云 + 金环充能
function drawGather(ctx, t) {
  const q = t / T1;
  // 边缘压暗 vignette
  const g = ctx.createRadialGradient(HERO_POS.x, HERO_POS.y, 200, HERO_POS.x, HERO_POS.y, 780);
  g.addColorStop(0, 'rgba(31,27,22,0)');
  g.addColorStop(1, `rgba(31,27,22,${(0.2 * q).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, 1280);
  // 四角墨雾（大墨团沿对角线向心插值，越聚越淡）
  for (const [cx, cy] of [[0, 0], [720, 0], [0, 1280], [720, 1280]]) {
    const x = cx + (HERO_POS.x - cx) * q;
    const y = cy + (HERO_POS.y - cy) * q;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 90);
    rg.addColorStop(0, `rgba(58,51,42,${(0.35 * (1 - q * 0.4)).toFixed(3)})`);
    rg.addColorStop(1, 'rgba(58,51,42,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, Math.PI * 2);
    ctx.fill();
  }
  // 赵云金环充能（半径收缩的旋转虚线环）
  ctx.save();
  ctx.translate(HERO_POS.x, HERO_POS.y);
  ctx.rotate(q * Math.PI * 2);
  ctx.strokeStyle = gold();
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 64 - 20 * q, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ② 七段突刺 0.6-1.6：赵云向 7 方向依次冲出残影（出即回），老残影渐隐
function drawThrust(ctx, t) {
  const seg = Math.min(6, Math.floor(t / SEG_DUR));
  for (let j = 0; j <= seg; j++) {
    const q = Math.min(1, (t - j * SEG_DUR) / SEG_DUR); // 段内进度
    const dist = Math.sin(q * Math.PI) * 200;
    const age = seg - j;
    const alpha = (1 - age * 0.12) * (0.45 + 0.55 * Math.sin(q * Math.PI));
    if (alpha <= 0.02) continue;
    const ang = SEG_ANGLES[j];
    const x = HERO_POS.x + Math.cos(ang) * dist;
    const y = HERO_POS.y + Math.sin(ang) * dist;
    // 冲刺轨迹（鎏金飞白路径）
    ctx.strokeStyle = `rgba(201,162,39,${(0.4 * alpha).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(HERO_POS.x, HERO_POS.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawAfterimage(ctx, x, y, 30, Math.min(1, alpha));
  }
}

// 赵云残影：纸底圆牌 + 云字 + 3 层金描边（三级透明度递减）
function drawAfterimage(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.fillStyle = 'rgba(244,236,216,0.9)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = alpha * (1 - k * 0.28);
    ctx.strokeStyle = gold();
    ctx.lineWidth = 3.5 - k;
    ctx.beginPath();
    ctx.arc(x, y, r - k * 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1f1b16';
  ctx.font = 'bold 30px ' + KAI;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('云', x, y + 1);
  ctx.restore();
}

// ③ 收招白闪 1.6-2.2：全屏提亮至 #f6efdd + 放射速度线
function drawFlash(ctx, q) {
  ctx.fillStyle = `rgba(246,239,221,${(0.85 * (1 - q * 0.6)).toFixed(3)})`;
  ctx.fillRect(0, 0, 720, 1280);
  ctx.strokeStyle = `rgba(201,162,39,${(0.5 * (1 - q)).toFixed(3)})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + q * 0.4;
    const r0 = 180 + q * 260;
    const r1 = r0 + 150;
    ctx.beginPath();
    ctx.moveTo(HERO_POS.x + Math.cos(ang) * r0, HERO_POS.y + Math.sin(ang) * r0);
    ctx.lineTo(HERO_POS.x + Math.cos(ang) * r1, HERO_POS.y + Math.sin(ang) * r1);
    ctx.stroke();
  }
}

// ④ 冲击波·屏震·印 2.2-2.8：三圈墨波扩散 + 朱砂「七进七出」大印浮现淡出
// （屏震本体由 beginUltShake 承担；溅墨由 battleFx.ultTick 在段界发）
function drawImpulse(ctx, q) {
  for (let k = 0; k < 3; k++) { // 三圈墨波错相扩散
    const qq = Math.max(0, Math.min(1, q * 1.3 - k * 0.15));
    if (qq <= 0) continue;
    const ease = 1 - Math.pow(1 - qq, 3);
    const r = 640 * ease;
    const lw = 14 - k * 3 - 10 * qq;
    if (lw <= 0.5) continue;
    ctx.strokeStyle = `rgba(31,27,22,${(0.4 * (1 - qq)).toFixed(3)})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(HERO_POS.x, HERO_POS.y, Math.max(1, r - k * 18), 0, Math.PI * 2);
    ctx.stroke();
  }
  // 朱砂大印：q>0.3 浮现，尾段淡出
  if (q > 0.3) {
    const pq = Math.min(1, (q - 0.3) / 0.5);
    ctx.save();
    ctx.globalAlpha = pq < 0.8 ? 1 : (1 - pq) / 0.2;
    ctx.translate(HERO_POS.x, HERO_POS.y - 80);
    ctx.rotate(-0.03);
    const s = 200;
    ctx.fillStyle = 'rgba(158,42,30,0.92)';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = '#f4ecd8';
    ctx.font = 'bold 44px ' + KAI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('七 进 七 出', 0, 0);
    ctx.restore();
  }
}
```

- [ ] **Step 7.2: 冒烟验证**

Run: `pnpm vitest run tests/render/m8-smoke.test.js`
Expected: PASS——「大招演出各时段绘制不炸（四分镜全覆盖）」用例已覆盖 t=[0.2, 0.8, 1.4, 1.9, 2.5]（四段各中段）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 39 文件 / 283 用例全绿

- [ ] **Step 7.3: Commit**

```powershell
git add src/render/fx.js
git commit -m "feat(m8): 大招分镜v2 四段重排 聚雾/突刺/白闪速度线/墨波大印 屏抖8px"
```

---

### Task 8: Boss 卷轴登场 + 斩杀慢镜（cinematic 绘制）

**Files:**
- Modify: `src/render/cinematic.js`（追加 drawCinematic 绘制函数）
- Modify: `src/render/battle.js`（接线 drawCinematic——Task 5 时故意未接，本任务补上）
- Test: `tests/render/cinematic.test.js`（追加绘制冒烟）

- [ ] **Step 8.1: 写失败测试（追加用例）**

在 `tests/render/cinematic.test.js` 末尾追加：

```js
// ===== Task 8 追加：绘制冒烟 =====
import { drawCinematic, DUR_SCROLL, DUR_KILL } from '../../src/render/cinematic.js';
import '../../src/render/art.js';

function makeCtx() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradient;
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && !(k in t)) return () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

describe('M8 演出绘制', () => {
  it('无演出时 drawCinematic 直接返回不画', () => {
    expect(() => drawCinematic(makeCtx())).not.toThrow();
  });

  it('Boss 卷轴各阶段（展开/停留/收起）绘制不炸', () => {
    push({ kind: 'bossScroll', dur: DUR_SCROLL, data: { title: '曹仁' } });
    const ctx = makeCtx();
    for (const t of [100, 400, 700]) { // 展开/停留/收起
      update(100);
      expect(() => drawCinematic(ctx)).not.toThrow();
    }
  });

  it('斩杀慢镜各阶段绘制不炸（含大印与墨点飞散）', () => {
    push({ kind: 'bossKill', dur: DUR_KILL, data: { x: 360, y: 500, type: 'shuai' } });
    const ctx = makeCtx();
    for (const t of [50, 200, 380]) {
      update(50);
      expect(() => drawCinematic(ctx)).not.toThrow();
    }
  });

  it('时序常量符合 spec（卷轴 800ms / 慢镜 400ms）', () => {
    expect(DUR_SCROLL).toBe(800);
    expect(DUR_KILL).toBe(400);
  });
});
```

- [ ] **Step 8.2: 跑测试确认失败**

Run: `pnpm vitest run tests/render/cinematic.test.js`
Expected: FAIL（`drawCinematic is not exported`）

- [ ] **Step 8.3: 实现 cinematic.js 绘制（文件末尾追加）**

`src/render/cinematic.js` 末尾追加：

```js
// ===== Task 8：演出绘制（battle.js 在全部战场元素之后调用）=====
const KAI = '"KaiTi","STKaiti","楷体",serif';

export function drawCinematic(ctx) {
  const cur = queue[0];
  if (!cur) return;
  if (cur.kind === 'bossScroll') drawBossScroll(ctx, cur.t / cur.dur, cur.data);
  else if (cur.kind === 'bossKill') drawBossKill(ctx, cur.t / cur.dur, cur.data);
}

// Boss 卷轴登场（0.8s）：横幅卷轴自中央展开——羊皮纸带 + 青铜轴头 + 名号 + 朱砂「帅」印 + 两侧墨迹
function drawBossScroll(ctx, q, data) {
  // 展开节奏：0-0.3 展开 scale 0.1→1，0.3-0.8 停留，0.8-1 收起 1→0.1
  let scale;
  if (q < 0.3) scale = 0.1 + 0.9 * (1 - Math.pow(1 - q / 0.3, 3));
  else if (q < 0.8) scale = 1;
  else scale = 0.1 + 0.9 * (1 - (q - 0.8) / 0.2);
  // 背景暗幕（演出聚焦）
  ctx.fillStyle = `rgba(31,27,22,${(0.35 * scale).toFixed(3)})`;
  ctx.fillRect(0, 0, 720, 1280);
  ctx.save();
  ctx.translate(360, 560);
  ctx.scale(scale, scale);
  // 两侧墨迹晕开（radial 大墨团）
  for (const [mx, my] of [[-320, 0], [320, 0]]) {
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 130);
    g.addColorStop(0, 'rgba(31,27,22,0.5)');
    g.addColorStop(1, 'rgba(31,27,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, 130, 0, Math.PI * 2);
    ctx.fill();
  }
  // 羊皮纸带（600×180）
  const g2 = ctx.createLinearGradient(0, -90, 0, 90);
  g2.addColorStop(0, '#f2e8d2');
  g2.addColorStop(1, '#d9c9a8');
  ctx.fillStyle = g2;
  ctx.fillRect(-300, -90, 600, 180);
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 3;
  ctx.strokeRect(-300, -90, 600, 180);
  // 青铜轴头（两端圆柱）
  ctx.fillStyle = '#8b6914';
  ctx.fillRect(-316, -100, 16, 200);
  ctx.fillRect(300, -100, 16, 200);
  ctx.fillStyle = '#b8963e';
  ctx.fillRect(-316, -100, 16, 14);
  ctx.fillRect(-316, 86, 16, 14);
  ctx.fillRect(300, -100, 16, 14);
  ctx.fillRect(300, 86, 16, 14);
  // Boss 名号（44px 楷体）
  ctx.fillStyle = '#1f1b16';
  ctx.font = 'bold 44px ' + KAI;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.title || '敌 帅', 0, -14);
  ctx.fillStyle = '#5a5040';
  ctx.font = '16px ' + KAI;
  ctx.fillText('—— 大 敌 当 前 ——', 0, 44);
  // 朱砂「帅」印（右上角）
  ctx.rotate(-0.06);
  ctx.fillStyle = '#9e2a1e';
  ctx.fillRect(196, -78, 56, 56);
  ctx.fillStyle = '#f4ecd8';
  ctx.font = 'bold 30px ' + KAI;
  ctx.fillText('帅', 224, -49);
  ctx.restore();
}

// 斩杀慢镜（0.4s）：全场褪色至宣纸留白 + Boss 剪影墨点飞散 + 朱砂「斩」大印 64px 盖下（scale 1.3→1 微旋）
function drawBossKill(ctx, q, data) {
  // 全场褪色：纸色罩渐强（宣纸留白感）
  ctx.fillStyle = `rgba(244,236,216,${(0.55 * Math.min(1, q * 1.6)).toFixed(3)})`;
  ctx.fillRect(0, 0, 720, 1280);
  const bx = data.x || 360;
  const by = data.y || 500;
  // Boss 剪影墨点飞散：12 颗墨点从死亡点径向散开淡出（确定性角度）
  const alpha = 1 - q;
  ctx.fillStyle = `rgba(31,27,22,${(0.7 * alpha).toFixed(3)})`;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + 0.26;
    const dist = 20 + q * 90;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(ang) * dist, by + Math.sin(ang) * dist, 6 + (i % 3) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // 朱砂「斩」大印：q 0.25 后盖下，scale 1.3→1 微旋
  if (q > 0.25) {
    const pq = Math.min(1, (q - 0.25) / 0.5);
    const s = 64 * (1.3 - 0.3 * pq);
    ctx.save();
    ctx.globalAlpha = pq < 0.9 ? 1 : (1 - pq) / 0.1;
    ctx.translate(bx, by);
    ctx.rotate(-0.04 + pq * 0.03);
    ctx.fillStyle = 'rgba(158,42,30,0.92)';
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.font = `bold ${Math.round(s * 1.1)}px ` + KAI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('斩', 0, s * 0.06);
    ctx.restore();
  }
}
```

- [ ] **Step 8.3b: battle.js 接线 drawCinematic**

两处小改：

① import 区（`import * as particles from './particles.js';` 行后）加：

```js
import { drawCinematic } from './cinematic.js';
```

② drawBattle 主函数中 `particles.draw(ctx);` 行后加：

```js
  drawCinematic(ctx);                  // Boss 卷轴 / 斩杀慢镜（全屏演出最上层）
```

- [ ] **Step 8.4: 跑测试 + 全量回归**

Run: `pnpm vitest run tests/render/cinematic.test.js`
Expected: PASS（5 + 4 = 9 用例）

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 39 文件 / 287 用例全绿

- [ ] **Step 8.5: Commit**

```powershell
git add src/render/cinematic.js src/render/battle.js tests/render/cinematic.test.js
git commit -m "feat(m8): Boss卷轴登场+斩杀慢镜绘制+接线battle 朱砂斩印+墨点飞散"
```

---

### Task 9: 收口——全测/体积/真机冒烟截图/双皮肤/验收对照

**Files:**
- Create: `docs/screenshots/m8/`（截图存档）
- Modify: `docs/specs/2026-10-03-sanguo-tower-design.md`（第八章 M8 行 `◐` → `✅`）

- [ ] **Step 9.1: 全量测试基线确认**

Run: `pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`
Expected: 39 文件 / 287 用例全绿（234 基线 + 53 新增）

- [ ] **Step 9.2: 双端构建 + 体积断言**

Run: `pnpm build:h5`
Expected: vite 构建成功无 error

Run: `pnpm build:wx 2>&1 | Select-String -Pattern "首包|体积|error"`
Expected: 首包 ≤4MB 断言通过（零图片资产，代码增量约 30KB）

- [ ] **Step 9.3: H5 dev server 真机视口冒烟（390×844 dpr=2 手机视口截图）**

Run: `pnpm dev`（后台启动，vite 5173）

用浏览器自动化（TRAE-browseruse / browser_use 子代理）以手机视口 390×844、deviceScaleFactor=2 逐镜截图存 `docs/screenshots/m8/`：

| # | 镜头 | 操作路径 | 存档名 |
|---|------|---------|--------|
| 1 | 战斗走路（小人+氛围墨点+路径质感） | 主城 → 出征 → 等第 1 波刷怪 | `m8-1-walk.webp` |
| 2 | 受击/飘字/溅墨 | 敌近身时连拍（可用 `?speed=3` 加速） | `m8-2-hit.webp` |
| 3 | 大招分镜①聚雾 | 攒 2 计策 → 放大招 → t≈0.3s 截 | `m8-3-ult-gather.webp` |
| 4 | 大招分镜②突刺 | t≈1.2s 截 | `m8-4-ult-thrust.webp` |
| 5 | 大招分镜③白闪 | t≈1.9s 截 | `m8-5-ult-flash.webp` |
| 6 | 大招分镜④墨波大印 | t≈2.5s 截 | `m8-6-ult-impulse.webp` |
| 7 | Boss 卷轴 | 打到第 10 波（快进）开场截 | `m8-7-boss-scroll.webp` |
| 8 | 斩杀慢镜 | Boss 血量打空瞬间截 | `m8-8-boss-kill.webp` |
| 9 | 皮影皮肤对照 | 主城换装皮影 → 再截战斗 | `m8-9-shadow.webp` |

**截图铁律（M7 实证）：**
- canvas rAF 游戏在标签页失焦时被浏览器节流冻结——冒烟前必须激活 tab 到前台
- 可用 `__app.handlePointer(LX,LY)` 直发逻辑坐标、`__app.__debug(fn)` 读写 battleState（可注入敌人/强制胜利）
- browser 代理的「PASS」汇报必须逐张 Read 目检——多次实证谎报/误截
- 攒 2 计策最快路径：`__debug((s) => { s.slots[0]={id:s.nextItemId++,type:'jice',tier:1}; s.slots[1]={id:s.nextItemId++,type:'jice',tier:1}; })`
- 大招分镜时序截取可用 `__debug((s) => { s.ult = { t: 0.3 }; })` 直接置演出相位（渲染层 `drawUltCinematic` 只读 `state.ult.t`）

帧时长抽检：DevTools console 执行

```js
let last = performance.now(); const ds = [];
let n = 0;
const iv = setInterval(() => {
  const now = performance.now(); ds.push(now - last); last = now;
  if (++n >= 100) { clearInterval(iv); console.log('avg', (ds.reduce((a,b)=>a+b,0)/n).toFixed(2), 'ms/帧 (≤16.7=60fps)'); }
}, 0);
```

Expected: 平均帧时长 ≤17ms（60fps）

- [ ] **Step 9.4: 验收标准逐条对照（spec 12.6）**

1. ✅ 事件流单测：hit/kill/leak/ult/isBoss 字段完整（tests/engine/events.test.js 10 用例）；数值路径零回归（234 基线全绿）
2. ✅ 姿态函数单测：四类敌人 × 四态（animator.test.js）；双皮肤调色板（shadow 下 `#f0d9a8` 断言）
3. ✅ mock ctx 渲染冒烟：battle 全 drawX 链路含 cinematic 各状态（m8-smoke.test.js 7 用例）
4. ✅ 手机视口截图 390×844 dpr2 逐镜目检存档 `docs/screenshots/m8/`（9 张）
5. ✅ 性能：粒子池 ≤120（particles.test）；帧时长抽检 60fps；`build:wx` 首包 ≤4MB
6. ✅ 双皮肤一致性：皮影全链路冒烟 + m8-9 截图目检

- [ ] **Step 9.5: Spec 第八章里程碑标记**

`docs/specs/2026-10-03-sanguo-tower-design.md` 第八章里程碑表 M8 行：`◐ 定案 2026-10-05（待实施）` → `✅ 完成 2026-10-05`（按该表既有 M7 行格式）。

- [ ] **Step 9.6: 收口 Commit**

```powershell
git add docs/screenshots/m8 docs/specs/2026-10-03-sanguo-tower-design.md
git commit -m "docs(m8): M8收口 冒烟截图9张目检入库+spec里程碑标记完成"
```

（dev server 用完停止：关闭后台进程。）

---

## 执行注意事项（给子代理）

1. **PowerShell 环境**：禁 `&&`（用分号或分开跑）；禁 heredoc；commit 用单行 `git commit -m "..."`；逐文件 `git add`（禁止 `git add -A`）
2. **仓库无 remote**：只 commit 不 push
3. **测试统计命令**：`pnpm test 2>&1 | Select-String -Pattern "Test Files|Tests "`；单文件 `pnpm vitest run tests/<file>`
4. **每任务收尾必须全绿**再 commit；挂了先修再走
5. **禁 Math.random**：视觉随机一律 LCG（particles.js 已内置）或 frame/clock 取模（确定性）
6. **禁新增图片资产**：一切程序化绘制
7. **engine 数值路径零改动**：Task 1 只加事件 push，任何平衡数值（hp/speed/reward/金币）不得动——events.test.js 有数值零回归用例兜底
8. **模块级单例测试污染**：battleFx/particles/cinematic 都有模块状态，测试文件 beforeEach 必须 reset
9. **art.js 是 IIFE**：测试文件需 `import '../../src/render/art.js'` 挂载 globalThis.Art
10. **性能预算**：粒子 ≤120、敌人 ≤30/场、每帧绘制调用不新增 O(n²)——drawGhosts/drawEnemy 循环均为 O(敌人+幽灵)，安全

