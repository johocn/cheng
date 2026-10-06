# M10 战斗表现三期：精英词缀出场演出 + Boss 波前宝箱三选一

> 2026-10-06 立项。接续 M9（连击 Combo + Boss 横扫预警，HEAD dd4c379 已推送，327/327 绿）。
> 来源：M9 backlog 采纳前两项（backlog ①精英词缀出场演出、④Boss 波前宝箱三选一），mockup 内联预览定稿。

## 背景与目标

1. **精英词缀出场演出**——壁/行/锋 精英刷出时目前无任何视觉提示，玩家只能靠血条速度反推。给精英一个「武印盖章」轻量演出，让词缀威胁一目了然。
2. **Boss 波前宝箱三选一**——BOSS 波（10/15）前波清节点插入一次「战前犒赏」三选一，提升局内决策密度，与既有兵法三择（rogue.js）形成「先犒赏、后兵法」的两段仪式。

## 设计定稿（mockup 已选型，2026-10-06）

- **精英演出方案 A「武印盖章」**：出场点盖词缀色方印（52×52 圆角，楷体字），scale 2.1→1 弹性盖章 + 微旋 -14°→-5°，0.5s 即散。**最贴 M8 帅/斩印章语言，实现最轻**。印色随词缀：壁·墨 `#1f1b16` / 行·青 `#5f8272` / 锋·朱 `#9e2a1e`。
- **宝箱面板方案 A「宝箱仪式版」**：与兵法三择同构（暗幕 + 纸面板 + 三横卡），顶部木箱铜箍宝箱 + 「战 前 犒 赏」标题。三卡复用 drawPickCard 视觉语言（顶条铜色 `#b8963e`）。

## 数值定稿（config.js 新增 M10 段）

```js
// ===== M10 精英词缀出场演出 =====
export const ELITE_FX = {
  dur: 0.5,        // 印章全程秒（÷speed；0-25% 盖下、25-80% 停留、80-100% 淡出）
  maxActive: 3,    // 同屏活跃印章上限，超出降级头顶色点
  minorDur: 0.8,   // 降级色点秒
};
export const AFFIX_COLORS = { iron: '#1f1b16', swift: '#5f8272', sharp: '#9e2a1e' };

// ===== M10 Boss 波前宝箱 =====
export const CHEST_REWARDS = [
  { id: 'troops', name: '犒赏三军', desc: '耐久 +3 并回复' },
  { id: 'shield', name: '玄武庇佑', desc: '开战护盾 4 秒' },
  { id: 'gold',   name: '金帛犒军', desc: '金币 +120' },
  { id: 'items',  name: '计策入囊', desc: '随机锦囊 +2' },
  { id: 'edge',   name: '锋芒',     desc: '攻击 +10%' },
];
export const CHEST_GOLD = 120;
export const CHEST_HP = 3;
export const CHEST_SHIELD = 4;   // 秒
export const CHEST_ITEMS = 2;    // 张
export const CHEST_ATK = 0.1;    // +10% 乘区
```

## Engine 设计（纯函数，全部可测）

### 精英演出（enemy.js + config.js）

- `spawnEnemy`：`affix && type !== 'shuai'` 时 push `frameEvents { type:'elite', affix, x, y }`（x/y 取 `LANES[laneIdx][0]`，同 boss 事件口径）。**shuai 不发**——Boss 波全员词缀，shuai 已有卷轴登场，避免重复演出。
- daily 全员词缀：刷怪间隔 ≥SPAWN_GAP_MIN(0.9s) 天然错峰；限流在渲染层（maxActive 超出降级色点），engine 无感知。

### 宝箱（新模块 engine/chest.js + state.js + wave.js）

- `rollChest(state)`：CHEST_REWARDS 均等洗牌取 3（`rngNext` 消耗 rng，确定性可测），`state.chestChoices = [id×3]`。
- `pickChest(state, idx)`：无效 idx/未 roll 返回 false；应用效果并清 `chestChoices`，返回 true：
  - `troops`：`hpMax += 3`、`hp = min(hp+3, hpMax)`（同增垣回补口径）
  - `shield`：`shieldT = max(shieldT, 4)`
  - `gold`：`coins += 120`
  - `items`：向首个空槽 push 2 张 `{id: nextItemId++, type: rngPick(rng, ITEM_TYPES keys), tier: 1}`（槽满则丢弃该张，不补偿——槽上限本就是资源约束）
  - `edge`：`state.edgeAtk = (state.edgeAtk || 0) + 0.1`；`refreshStats`（state.js）在 `heroStat.atk` 乘 `(1 + (state.edgeAtk || 0))`——与 metaAtkMul 同为乘区、重算不丢
- **stage 流转**（`stage: … → chestPick → skillPick → …`）：
  - `wave.js updateWave` 波清分支（非 endless/bossrush，chapter/daily 共用）：`BOSS_WAVES.includes(state.wave + 1)`（即 9/14 波清）→ `stage='chestPick'`，否则 `skillPick`（零回归）
  - `state.js advanceFrame`：inputs 新增分支 `pickChest`（chestPick 态）→ `pickChest(work, idx)` → `stage='skillPick'`（**不 wave++**，pickSkill 分支原样推进）；switch 新增 `case 'chestPick': break`（冻结同 skillPick）；末尾补抽 `chestPick && !chestChoices → rollChest`
- **触发范围 v1**：chapter/daily 模式且 `wave+1 ∈ BOSS_WAVES`；endless（轮换 boss 行无固定前波）/bossrush（轮轮是 boss，节奏太密）不触发——backlog。

### 渲染（battleFx.js + battle.js + core.js）

- **battleFx.js**：
  - `consume` 处理 `ev.type==='elite'`：`eliteList.push({ x, y, affix, born: renderClock, minor })`；活跃数 ≥ ELITE_FX.maxActive 时 `minor=true`
  - `update` 清理过期（印章 >dur、色点 >minorDur）
  - `drawEliteSpawns(ctx, now)`（battle.js 敌人层后调用，印章罩住敌人语义）：印章 q∈[0,0.25] scale 2.1→1 rotate -14°→-5°（ease-out）、[0.25,0.8] 停留、[0.8,1] 淡出；minor 只画头顶 10px 词缀色圆点。不吞帧、不屏震、无音效
- **battle.js**：`drawChestPick(ctx, state)`（chestPick 态，兵法面板之前绘制）：
  - 暗幕同 skillPick（α0.92）+ `Art.drawPanel(ctx, 60, 88, 600, 560)`
  - 标题「战 前 犒 赏」（bold 40px 楷体，y 152）+ 宝箱（木箱 `#96703a`/盖 `#a5793f`/铜箍锁 `#b8963e`，x 居中 y≈200-290，frame 驱动 sin 微浮 ±4px，零状态）
  - 三卡 `drawChestCard`：72+i*200, 320, 176×252（顶条铜色、名 bold 34px、desc 17px wrapText、底 pill「犒赏」）
  - 提示语「—— 点选犒赏 · 再点兵法出征 ——」（y 608）
- **core.js**：
  - `hitBattle` 新增 chestPick 分支：`y ∈ [320, 572]` 三等分 176 宽 → `{ pickChest: i }`（与 drawChestPick 卡坐标一致）
  - `handlePointer` 音效：`pin.pickChest !== undefined → sfx('coin')`（开箱入账感）

## Task 分解（TDD，每 Task 先测试后实现，单行中文 commit）

- **Task 1 精英演出 engine**：tests/engine/eliteFx.test.js——非 shuai 带词缀发 elite 事件（affix/x/y）；shuai 带词缀只发 boss 不发 elite；无词缀不发；daily 全员逐个发。实现：enemy.js spawnEnemy 分支 + config ELITE_FX/AFFIX_COLORS
- **Task 2 精英演出 render**：tests/render/eliteFx.test.js——consume elite 入列；drawEliteSpawns 印章 fillStyle=词缀色 + 字=AFFIXES.label；≥maxActive 降级 minor 色点；dur 过期不画；speed 缩放时长。实现：battleFx eliteList/drawEliteSpawns + battle.js 接线（敌人层后）
- **Task 3 宝箱 engine**：tests/engine/chest.test.js——rollChest 三不重复且全在池；pickChest 五种效果各自断言（hpMax/hp、shieldT、coins、edgeAtk 经 refreshStats 乘区 ×1.1、items 空槽 2 张/槽满丢弃）；无效 idx false；chestChoices 清空。实现：engine/chest.js + config CHEST_* + state.js refreshStats edgeAtk
- **Task 4 宝箱编排与输入**：tests/engine/chestFlow.test.js——chapter w9 波清 → chestPick 且已 roll；pickChest 后 → skillPick 且 pickChoices 已填（不 wave++）；再 pickSkill 正常 wave++ startWave(10)；w8 波清直接 skillPick；bossrush/endless 不触发；daily w9 清触发；hp≤0 终态优先。实现：wave.js 分支 + state.js case/inputs/补抽
- **Task 5 宝箱 render**：tests/render/chestPanel.test.js——仅 chestPick 绘制；三卡坐标与 hitBattle 一致（72+i*200, 320, 176×252）；标题/提示文案；卡名取 CHEST_REWARDS；宝箱微浮确定性。实现：battle.js drawChestPick/drawChestCard + core.js hitBattle/handlePointer
- **Task 6 收口**：全量测试（预期 327→约 350）+ 手机视口截图（390×844 dpr=2：武印盖章瞬间 / 宝箱面板）入库 docs/screenshots/m10/ + wx 构建断言 + 交接快照 + push（唯一 push 点）

**集成基线注意**：M9 集成验收种子 20260304 的全自动链路若覆盖 w9 波清，宝箱将插入 chestPick 等待输入并消耗 rng——相关集成测试需在 chestPick 弹出时补 `pickChest` 输入（选 0），余量血量断言相应更新（宝箱为正向增益，余量只会变好）。

## 非目标（本批不做）

- 精英演出/开箱音效（视觉先行，audio backlog）
- endless/bossrush 模式宝箱触发（backlog）
- 宝箱稀有度/权重分级（v1 池均等无稀有概念）
- 开箱分镜动画（静态面板 + 宝箱微浮先行）

## Backlog（新增待排期）

- 精英武印音效 + 宝箱开箱音（木箱开启/铜钱声）
- endless 每 N 波宝箱 / bossrush 轮间宝箱
- 稀有精英差异化演出（大型印章 + 墨迹飞溅）
- 词缀图腾常驻头顶小标（现仅演出期可见，可加 4px 常驻色角标）

## 交接快照（随 Task 推进更新）

- 2026-10-06：立项。mockup 定稿：精英 A 武印盖章 + 宝箱 A 宝箱仪式版（PureShowWidget 内联预览，用户拍板）。M9 基线：327/327 绿、wx 529KB、HEAD dd4c379 已推送。
- 2026-10-06：Task1-5 完成并逐一提交（3f4fcfa config+engine elite 事件 / dbbf049 render 武印盖章+限流降级 / b564aec chest.js+config 奖励池 / 6f3a26a chestPick 流转+hitBattle+音效 / b4c91d8 render 面板+autoPlay 适配）。
- 2026-10-06：Task6 收口完成。
  - **bug 修复**：精英武印屏外——lane0 刷出点 LANES[0][0]=(360,-40) 在画面外，印章画在可视区外（截图验收发现）。修复：drawEliteSpawns 加 clampSpawn（x∈[50,670]、y∈[96,1230]），补 clamp 测试。
  - 集成验收按计划预期修复：autoPlay 补 chestPick 分支（选 0），15 波通关日志 `stage=victory wave=15 hp=17/20 击杀=249`（宝箱正向余量变好）。
  - 全量回归 365/365 绿（M9 基线 327 + M10 新增 38）。
  - 手机截图（390×844 dpr=2）入库 docs/screenshots/m10/：m10-A-elite-stamp.png（武印盖章，clamp 后 lane0 印章可见）+ m10-B-chest-panel.png（宝箱三选一面板）。
  - wx 构建 534 KB（game.js 111KB + heroes 423KB），通过断言。
  - 遗留：精英/开箱音效、endless/bossrush 宝箱、稀有度分级（见 Backlog 节）。
