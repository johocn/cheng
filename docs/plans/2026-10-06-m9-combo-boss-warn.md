# M9 战斗表现二期：连击 Combo + Boss 技能预警

> 2026-10-06 立项。接续 M8 战斗表现计划（Task 1-9 已完成，commits 9c661d8..b72f886）。
> 来源：对比《城主别慌张》竞品分析后，用户从增强清单中拍板「先做 1+2」，其余采纳进 backlog。

## 背景与目标

M8 完成了打击感全家桶（吞帧时停/屏震/飘字/粒子/四分镜大招/BOSS 卷轴/斩杀慢镜）。M9 补两件「对抗感」：

1. **连击 Combo**——连续击杀计数反馈，让割草爽感有数字实感
2. **Boss 技能预警**——曹仁「横扫千军」前摇演出，让 Boss 战从「血牛」变「有对手」，并给控制类锦囊/大招一个明确的策略价值（打断）

## 设计定稿（mockup 已选型）

- **Combo 方案 A**：「×N」数字弹跳 + 三圈墨点扩散。复用 M8 飘字语言，实现最轻。位置屏幕中央偏上（y≈360，不挡英雄）。N≥2 才显示。
- **Boss 预警方案 B**：扇形警示区 + 台词气泡「看我横扫千军！」。扇形以 Boss 为顶点、朝英雄方向展开。**用户硬要求：扇形用浅色淡赭渲，贴近水墨主风格，禁止浓艳脱离风格。**

## 数值定稿（config.js 新增 M9 段）

```js
export const COMBO_WINDOW = 2.0; // 秒：击杀间隔超过则连击归零重计
export const BOSS_SKILL = {
  name: '横扫千军',    // 气泡台词「看我横扫千军！」
  cd: 8,               // 结算/取消后冷却秒
  telegraph: 1.4,      // 前摇警示秒（期间可被打断）
  arc: 110,            // 扇形张角度（朝英雄方向 ±55°）
  range: 200,          // 扇形半径（逻辑像素）
  dmg: 1,              // 命中扣守军耐久（受玄武护盾免伤，口径同漏怪）；定稿 2→1（见交接快照 2026-10-06 校准）
};
```

## Engine 设计（纯函数，全部可测）

### Combo（reapDead + state.js）

- state 新字段：`combo: 0`、`lastKillClock: -999`
- `reapDead` 击杀时：`stageClock - lastKillClock > COMBO_WINDOW` 则先归零；然后 `combo++`、更新 `lastKillClock`
- state.js leak 结算处（L112-120，实际扣血分支内）：`combo = 0`（免伤不扣不清零，口径同免伤不发事件）
- 不新增 frameEvent：渲染层读 `state.combo`，弹跳动画由 battleFx 内部计时器在消费 kill 事件时重置
- 终态（victory/over）冻结自然停摆，无需处理

### Boss 技能（enemy.js）

- `spawnEnemy` 对 `type==='shuai'` 附加 `e.skill = { clock: 0, phase: null, t0: 0 }`（phase: null | 'warn'）
- `moveEnemies` 循环内推进（stun continue 分支天然冻结技能计时，一致）：
  - `phase === null`：`clock += dt`；当 `clock >= BOSS_SKILL.cd` 且 `dist(e, HERO_POS) <= range * 0.9` 且非 stun → 进入 warn：`phase='warn'`、`clock=0`、`t0=e.t`
  - `phase === 'warn'`：`clock += dt`
    - **打断判定**：`e.stunT > 0` 或 `e.t < t0 - 1e-6`（白虎/大招击退）→ 取消：`phase=null, clock=0`（cd 重置满，打断即有收益）
    - `clock >= telegraph` → 结算：英雄在扇形内（恒在，只要距离 ≤ range）且 `shieldT <= 0` → 扣血走事件：`frameEvents.push({ type:'bossSkill', dmg, ... })`（扣血在 moveEnemies 内直接 `state.hp -= dmg`？**否**——遵循现有口径：敌人模块不动 hp，leak 也是 moveEnemies 返回、state.js 统一扣。但 moveEnemies 已返回 leaked 数组——**bossSkill 伤害并入 leaked 返回**（`{type:'shuai', dmg, skill:true}`），state.js 同一分支扣血 + 发事件（免伤不发事件同口径）。击退（t 回退）导致结算时距离 > range → 空放不扣（扇形罩不到）
    - 结算/空放后：`phase=null, clock=0`
- 扇形几何纯函数 `inArc(bx, by, px, py, facing)`：`facing = atan2(HERO_POS.y-by, HERO_POS.x-bx)`，点在扇形内 = 距离 ≤ range 且夹角 ≤ arc/2。测试直打边界角

### 渲染

- **battleFx.js** `drawCombo(ctx, state)`：`combo >= 2` 时中央偏上绘制「×N」墨字弹跳（kill 事件触发 90ms×3 递减缩放）+ 三圈墨点扩散（复用现有 LCG/时序基建）；N≥10 数字转朱砂色（小增强，成本一行）
- **battle.js** `drawBossSkill(ctx, state)`：敌人层之后调用（警示罩罩住敌人，语义直观）：
  - warn 阶段：淡赭扇形（`#b03a2e` opacity ≤0.12 填充 + 0.35 描边虚线，**浅色渲**）+ Boss 顶点 + 台词气泡（墨底白字「看我横扫千军！」，warn 首帧滑入）
  - 结算帧（bossSkill 事件）：扇形短暂闪现加深（0.15s 内 opacity 0.12→0.3→0）+ 复用 beginUltShake 小幅屏震

## Task 分解（TDD，每 Task 先测试后实现）

- **Task 1 Combo engine**：tests/engine/combo.test.js——窗口内连杀递增 / 超窗归零重计 / leak 扣血清零 / leak 免伤不清零 / 单杀不显示（combo 1）字段随 deepClone 保真。实现：state.js 字段 + reapDead + leak 清零 + config COMBO_WINDOW
- **Task 2 Combo render**：tests/render/comboFx.test.js——combo≥2 才画 / 弹跳缩放时序衰减 / kill 事件重置动画 / ≥10 朱砂。实现：battleFx.drawCombo + core.js loop 接线（kill 事件喂 battleFx）
- **Task 3 Boss 技能 engine**：tests/engine/bossSkill.test.js——cd 与距离双条件触发 / 前摇推进至结算扣血（并入 leaked） / stun 打断取消 / 击退打断取消 / 护盾免伤不扣不发事件 / inArc 几何边界 / 结算后 cd 重置。实现：enemy.js 技能状态机 + inArc 导出 + state.js 接 bossSkill 扣血分支
- **Task 4 Boss 技能 render**：tests/render/bossWarn.test.js——warn 才画扇形 / 淡赭浅渲 opacity 断言 / 气泡仅 warn 首段 / 结算闪现时序。实现：battle.js drawBossSkill
- **Task 5 收口**：全量测试 + 手机视口截图（390×844 dpr=2：combo 弹跳 / 扇形警示 / 打断瞬间）入库 docs/screenshots/m9/ + wx 构建（525KB 级断言）+ 交接快照更新 + spec 里程碑 + commit push

## 非目标（本批不做）

- 离线挂机（用户明确否决）
- 技能音效（气泡+视觉先行，audio 增强 backlog）
- 多 Boss 技能差异化（关羽/张飞大招分镜属 backlog ⑤）
- daily 词缀对技能数值的影响（v1 固定 dmg=1）

## Backlog（已采纳待排期，来源见对话记录 2026-10-06）

1. 精英词缀出场演出（壁/行/锋 字牌弹出 + 音效）
2. 锦囊全屏反馈（玄武盾光罩/朱雀火雨 全屏色罩 + 60ms 微时停）
3. 多武将大招分镜（关羽青龙横扫/张飞咆哮震屏）
4. Boss 波前宝箱三选一（提升局内决策密度）
5. 微信好友排行榜（每日挑战/无尽/车轮战，开放数据域）
6. Boss 技能音效 + 赛季词缀轮换

## 交接快照（随 Task 推进更新）

- 2026-10-06：立项。定稿 1A（Combo 弹跳计数）+ 2B（扇形警示+气泡，淡赭浅渲硬要求）。M8 基线：289 测试全绿、wx 包 525KB、HEAD 8a6f886（含 structuredClone wx 修复 8d3c8d2 与大招 toast 8a6f886）。
- 2026-10-06 Task 3 校准：dmg 2→1（用户拍板）。集成验收种子 20260304 基线余量恰好 4 血 = 全程 2 次横扫×2，dmg=2 恰好打穿；已验证不改数值路线全不通（前摇窗口无玄武/大招/白虎资源、青龙优先无效、wall 优先 w8 即败）。其余数值（cd 8/前摇 1.4/范围 200/张角 110）不动。
