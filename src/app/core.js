// src/app/core.js — 平台无关应用壳（M4 自 h5/main.js 抽取）
// 容器只做三件事：注入 Canvas、桥接输入、桥接平台 API；本模块承载其余全部
import { createBattle, advanceFrame } from '../engine/state.js';
import { LOGICAL_W, LOGICAL_H } from '../engine/config.js';
import { createRng } from '../engine/rng.js';
import { drawBattle } from '../render/battle.js';
import { drawHome, hitHome } from '../render/home.js';
import { drawResult, hitResult } from '../render/result.js';
import { drawDetail, hitDetail, drawGacha, hitGacha } from '../render/metaScreens.js';
import { drawShop, hitShop } from '../render/shop.js';
import { applyIap, grantFirstChargeHero, srPool, fundChapterBonus, owned } from '../meta/iap.js';
import { loadSave, persistSave, touchDaily } from '../meta/save.js';
import { levelUp, starUp, atkMul } from '../meta/meta.js';
import { pullOnce, pullTen, PULL_COST, TEN_COST } from '../meta/gacha.js';
import { applyGacha, resultRewards } from '../meta/reward.js';
import { HEROES, DUP_FRAGS, chapterMul } from '../meta/heroes.js';
import { drawSignin, hitSignin } from '../render/signin.js';
import { claimSignin, signinClaimable } from '../meta/signin.js';
import { toast } from '../render/ui.js';

export function createApp({ ctx, showRewarded, purchase = () => {}, getSpeed = () => 1 }) {
  // ===== 局外存档与屏幕状态 =====
  const save = loadSave();
  touchDaily(save); // 跨日重置免费抽计数

  let screen = 'home';        // home | detail | gacha | battle | result | signin
  let selectedHero = 'zhaoyun';
  let battleState = null;     // 战斗局内状态（engine state + chapterN/firstClear/pendingInputs）
  let resultData = null;      // 结算数据 { win, chapterN, rewards, doubled }
  let gachaResult = null;     // 抽卡结果浮层（单条或数组，null=无浮层）
  let adBusy = false;         // 激励视频观看中，防重入
  let shopPick = null;        // 首充 SR 自选浮层
  let toastMsg = '', toastUntil = 0;
  function showToast(msg) { toastMsg = msg; toastUntil = Date.now() + 2600; }
  let last = 0;
  const SPEED = Math.max(1, Math.min(10, getSpeed() || 1)); // 验收快进倍率 1-10，默认 1

  // 输入入口：容器把平台事件换算成 720×1280 逻辑坐标后调用
  function handlePointer(x, y) {
    if (screen === 'battle') {
      // M2 战斗输入通道：命中结果写入局内状态，帧循环消费一次
      if (battleState) battleState.pendingInputs = hitBattle(x, y, battleState);
      return;
    }
    dispatch(hitTest(x, y));
  }

  // 四屏命中检测（battle 屏走 hitBattle，见上）
  function hitTest(x, y) {
    if (screen === 'home') return hitHome(x, y);
    if (screen === 'detail') return hitDetail(x, y);
    if (screen === 'gacha') return hitGacha(x, y, save, gachaResult);
    if (screen === 'result') return hitResult(x, y, resultData);
    if (screen === 'signin') return hitSignin(x, y, save);
    if (screen === 'shop') return hitShop(x, y, save, shopPick);
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
      if (hit.action === 'signin') screen = 'signin';
      if (hit.action === 'shop') { screen = 'shop'; shopPick = null; }
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
      if (hit.action === 'double' && !adBusy) {
        adBusy = true;
        // M4：翻倍接激励视频（H5 直发行为不变；wx 桩 800ms 后入账）
        showRewarded('double', {
          onReward() {
            adBusy = false;
            resultData.doubled = true;
            applyRewardsDouble();
            persistSave(save);
          },
          onFail() { adBusy = false; },
        });
      }
      if (hit.action === 'again') startBattle(resultData.chapterN);
      if (hit.action === 'next') startBattle(resultData.chapterN + 1);
    } else if (screen === 'signin') {
      if (hit.action === 'back') screen = 'home';
      if (hit.action === 'claim' && !adBusy) {
        adBusy = true;
        showRewarded('signin', {
          onReward() {
            adBusy = false;
            const r = claimSignin(save, createRng((Date.now() & 0xffffffff) >>> 0));
            persistSave(save);
            if (r) {
              const parts = [];
              if (r.diamonds) parts.push(`钻石+${r.diamonds}`);
              if (r.stamina) parts.push(`体力+${r.stamina}`);
              if (r.fragHero) parts.push(`${r.fragHero === 'zhaoyun' ? '赵云' : '英雄'}碎片+${r.frags}`);
              showToast(`签到成功 ${parts.join(' ')}`);
            }
          },
          onFail() { adBusy = false; },
        });
      }
    } else if (screen === 'shop') {
      if (hit.action === 'back') { screen = 'home'; shopPick = null; }
      if (hit.action === 'buy' && !adBusy && !owned(save, hit.sku)) {
        adBusy = true;
        purchase(hit.sku, {
          onSuccess() {
            adBusy = false;
            const r = applyIap(save, hit.sku);
            persistSave(save);
            if (!r) return;
            if (r.pick) shopPick = srPool();
            if (r.skin) showToast('皮影戏限定皮肤已解锁');
            if (r.diamonds) showToast(`钻石 +${r.diamonds}`);
          },
          onFail() { adBusy = false; },
        });
      }
      if (hit.action === 'pickHero') {
        const r = grantFirstChargeHero(save, hit.heroId);
        shopPick = null;
        persistSave(save);
        if (r) showToast(r.dup ? `${HEROES[r.heroId].name}碎片 +${r.frags}` : `新武将 · ${HEROES[r.heroId].name}`);
      }
    }
  }

  // ===== 抽卡 =====
  function doPull(ten, free) {
    const ownedIds = Object.keys(save.heroes).filter((id) => save.heroes[id].owned);
    const rng = createRng((Date.now() & 0xffffffff) >>> 0); // 会话内随机种子（存档不含 rng）
    if (free) {
      // M4：免费抽接激励视频
      if (adBusy) return;
      adBusy = true;
      showRewarded('freePull', {
        onReward() {
          adBusy = false;
          save.daily.freePulls += 1;
          gachaResult = pullOnce(rng, ownedIds);
          applyGacha(save, gachaResult); // 新英雄解锁★1 / 重复转碎片
          persistSave(save);
        },
        onFail() { adBusy = false; },
      });
      return;
    }
    const cost = ten ? TEN_COST : PULL_COST;
    save.wallet.diamonds -= cost;
    gachaResult = ten ? pullTen(rng, ownedIds) : pullOnce(rng, ownedIds);
    applyGacha(save, gachaResult);
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
      fundChapterBonus(save, r.chapterN); // 成长基金章节首通返还
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
    if (!last) last = now; // 首帧校准（wx 环境无 performance.now 也不依赖它）
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
    } else if (screen === 'signin') {
      drawSignin(ctx, save);
    } else if (screen === 'shop') {
      drawShop(ctx, save, shopPick);
    }
    // 屏绘制后统一画 toast（战斗屏除外）
    if (screen !== 'battle' && Date.now() < toastUntil) toast(ctx, toastMsg);
    requestAnimationFrame(loop);
  }

  function start() { requestAnimationFrame(loop); }

  return { handlePointer, start, get screen() { return screen; } };
}
