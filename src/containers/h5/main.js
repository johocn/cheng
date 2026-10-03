// containers/h5/main.js — M3 屏幕路由状态机：home / detail / gacha / battle / result
// 输入模型同 M2：pointerdown → hitTest → dispatch；战斗屏沿用 M2 帧循环 rAF → advanceFrame
import '../../render/art.js'; // IIFE 素材库副作用导入，先于渲染层就绪（window.Art）
import { createBattle, advanceFrame } from '../../engine/state.js';
import { LOGICAL_W, LOGICAL_H } from '../../engine/config.js';
import { createRng } from '../../engine/rng.js';
import { drawBattle } from '../../render/battle.js';
import { drawHome, hitHome } from '../../render/home.js';
import { drawResult, hitResult } from '../../render/result.js';
import { drawDetail, hitDetail, drawGacha, hitGacha } from '../../render/metaScreens.js';
import { loadSave, persistSave, touchDaily } from '../../meta/save.js';
import { levelUp, starUp, atkMul } from '../../meta/meta.js';
import { pullOnce, pullTen, PULL_COST, TEN_COST } from '../../meta/gacha.js';
import { applyGacha, resultRewards } from '../../meta/reward.js';
import { HEROES, DUP_FRAGS, chapterMul } from '../../meta/heroes.js'; // 章节系数在 meta/heroes.js（engine/config.js 无此导出）

const canvas = document.getElementById('game');
canvas.width = LOGICAL_W;
canvas.height = LOGICAL_H;
const ctx = canvas.getContext('2d');

// ?speed=N 时间倍率（验收快进用，1-10，默认 1）
const SPEED = Math.max(1, Math.min(10,
  Number(new URLSearchParams(location.search).get('speed')) || 1));

// ===== 局外存档与屏幕状态 =====
let save = loadSave();
touchDaily(save); // 跨日重置免费抽计数

let screen = 'home';        // home | detail | gacha | battle | result
let selectedHero = 'zhaoyun';
let battleState = null;     // 战斗局内状态（engine state + chapterN/firstClear/pendingInputs）
let resultData = null;      // 结算数据 { win, chapterN, rewards, doubled }
let gachaResult = null;     // 抽卡结果浮层（单条或数组，null=无浮层）
let last = performance.now();

// 坐标换算：canvas CSS 显示尺寸（height:100dvh 自适应）→ 720×1280 逻辑坐标
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (LOGICAL_W / rect.width);
  const y = (e.clientY - rect.top) * (LOGICAL_H / rect.height);
  if (screen === 'battle') {
    // M2 战斗输入通道：命中结果写入局内状态，帧循环消费一次
    if (battleState) battleState.pendingInputs = hitBattle(x, y, battleState);
    return;
  }
  dispatch(hitTest(x, y));
});

// 四屏命中检测（battle 屏走 hitBattle，见上）
function hitTest(x, y) {
  if (screen === 'home') return hitHome(x, y);
  if (screen === 'detail') return hitDetail(x, y);
  if (screen === 'gacha') return hitGacha(x, y, save, gachaResult);
  if (screen === 'result') return hitResult(x, y, resultData);
  return null;
}

// M2 战斗 hitTest 原样保留（git ee41870）：三选一卡 / 锦囊槽 / 大招圆
function hitBattle(x, y, st) {
  // skillPick 三卡: (72..648, 216..468) 三等分 176 宽 → pickSkill 0/1/2
  if (st.stage === 'skillPick' && st.pickChoices) {
    if (y >= 216 && y <= 468) {
      for (let i = 0; i < 3; i++) {
        const cx0 = 72 + i * 200;
        if (x >= cx0 && x <= cx0 + 176) return { pickSkill: i };
      }
    }
    return null;
  }
  // 锦囊槽: y 1112..1208, 8 格 x=30+i*84 宽 72
  if (y >= 1112 && y <= 1208) {
    const i = Math.floor((x - 30) / 84);
    if (i >= 0 && i < 8 && (x - 30) - i * 84 <= 72) return { clickSlot: i };
  }
  // 大招按钮: 圆心(600,985) r=60（容差+8）
  const dx = x - 600, dy = y - 985;
  if (dx * dx + dy * dy <= 60 * 60) return { useUlt: true };
  return null;
}

// ===== 动作分发 =====
function dispatch(hit) {
  if (!hit) return;
  if (screen === 'home') {
    if (hit.action === 'hero') { selectedHero = hit.heroId; screen = 'detail'; }
    if (hit.action === 'gacha') { screen = 'gacha'; gachaResult = null; }
    if (hit.action === 'battle') startBattle(save.progress.chapter);
  } else if (screen === 'detail') {
    if (hit.action === 'back') screen = 'home';
    if (hit.action === 'levelUp') { levelUp(save, selectedHero); persistSave(save); }
    if (hit.action === 'starUp') { starUp(save, selectedHero); persistSave(save); }
  } else if (screen === 'gacha') {
    if (hit.action === 'back') { screen = 'home'; gachaResult = null; }
    if (hit.action === 'closeResult') gachaResult = null;
    if (hit.action === 'freePull') doPull(false, true);
    if (hit.action === 'pullTen') doPull(!!hit.ten, false);
  } else if (screen === 'result') {
    if (hit.action === 'double') { resultData.doubled = true; applyRewardsDouble(); persistSave(save); }
    if (hit.action === 'again') startBattle(resultData.chapterN);
    if (hit.action === 'next') startBattle(resultData.chapterN + 1);
  }
}

// ===== 抽卡 =====
function doPull(ten, free) {
  const ownedIds = Object.keys(save.heroes).filter((id) => save.heroes[id].owned);
  const rng = createRng((Date.now() & 0xffffffff) >>> 0); // 会话内随机种子（存档不含 rng）
  if (free) {
    save.daily.freePulls += 1;
    gachaResult = pullOnce(rng, ownedIds);
  } else {
    const cost = ten ? TEN_COST : PULL_COST;
    save.wallet.diamonds -= cost;
    gachaResult = ten ? pullTen(rng, ownedIds) : pullOnce(rng, ownedIds);
  }
  applyGacha(save, gachaResult); // 新英雄解锁★1 / 重复转碎片
  persistSave(save);
}

// ===== 战斗 =====
function startBattle(chapterN) {
  // 首版战斗固定赵云上阵；注入局外攻击乘区与章节敌军 hp 系数
  const bonus = { atkMul: atkMul(save, 'zhaoyun'), chapterMul: chapterMul(chapterN) };
  battleState = createBattle(20260304 + chapterN, bonus);
  battleState.chapterN = chapterN;   // 展示/结算用标注（engine 不读）
  battleState.firstClear = chapterN > save.progress.chapterClear;
  battleState.pendingInputs = null;
  screen = 'battle';
}

function finishBattle() {
  const win = battleState.stage === 'victory';
  resultData = {
    win,
    chapterN: battleState.chapterN,
    rewards: resultRewards(battleState.chapterN, win && battleState.firstClear, save),
    doubled: false,
  };
  if (win) {
    applyRewardsWithProgress(resultData.rewards);
  } else {
    save.wallet.coins += resultData.rewards.coins; // 战败安慰金币（重复通关口径）
  }
  persistSave(save);
  screen = 'result'; // 战败也进结算屏（drawResult/hitResult 已按 win=false 处理）
}

// 结算入账 + 首通推进进度（chapterClear 取最大；chapter 指向下一章）
function applyRewardsWithProgress(r) {
  save.wallet.coins += r.coins;
  save.wallet.diamonds += r.diamonds;
  if (r.unlockHero) save.heroes[r.unlockHero].owned = true;
  for (const [id, n] of Object.entries(r.frags || {})) save.heroes[id].frags += n;
  if (r.firstClear) {
    save.progress.chapterClear = Math.max(save.progress.chapterClear, r.chapterN);
    save.progress.chapter = save.progress.chapterClear + 1;
  }
  save.progress.waveBest = Math.max(save.progress.waveBest, 15);
}

// 广告翻倍（M3 H5 直发占位，M4 接 wx 激励视频）：奖励再入账一次
function applyRewardsDouble() {
  const r = resultData.rewards;
  save.wallet.coins += r.coins;
  save.wallet.diamonds += r.diamonds;
  if (r.unlockHero) { // 翻倍时解锁英雄追加等价碎片（英雄已在首结入账时解锁）
    save.heroes[r.unlockHero].frags += DUP_FRAGS[HEROES[r.unlockHero].quality];
    save.heroes[r.unlockHero].owned = true;
  }
  for (const [id, n] of Object.entries(r.frags || {})) save.heroes[id].frags += n;
}

// ===== 帧循环：战斗屏推演，其余屏重绘 =====
function loop(now) {
  const dtMs = Math.min(now - last, 100); // 切后台回来防大步积压
  last = now;
  if (screen === 'battle') {
    battleState = advanceFrame(battleState, battleState.pendingInputs, dtMs * SPEED);
    battleState.pendingInputs = null; // 每帧消费一次
    if (battleState.stage === 'victory' || battleState.stage === 'over') finishBattle();
    drawBattle(ctx, battleState);
  } else if (screen === 'home') {
    drawHome(ctx, save, selectedHero);
  } else if (screen === 'detail') {
    drawDetail(ctx, save, selectedHero);
  } else if (screen === 'gacha') {
    drawGacha(ctx, save, gachaResult);
  } else if (screen === 'result') {
    drawResult(ctx, save, resultData);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
