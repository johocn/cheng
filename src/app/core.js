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
import { drawRevive, hitRevive } from '../render/revive.js';
import { applyIap, grantFirstChargeHero, srPool, fundChapterBonus, owned } from '../meta/iap.js';
import { loadSave, persistSave, touchDaily } from '../meta/save.js';
import { levelUp, starUp, atkMul } from '../meta/meta.js';
import { pullOnce, pullTen, PULL_COST, TEN_COST } from '../meta/gacha.js';
import { applyGacha, resultRewards } from '../meta/reward.js';
import { HEROES, DUP_FRAGS, chapterMul } from '../meta/heroes.js';
import { drawSignin, hitSignin } from '../render/signin.js';
import { claimSignin, signinClaimable } from '../meta/signin.js';
import { toast } from '../render/ui.js';
import { spendStamina, regenStamina, BATTLE_COST, STAMINA_MAX } from '../meta/stamina.js';
import { grantMonthlyDaily } from '../meta/iap.js';
import { todayStr } from '../meta/save.js';
import { setSkin, currentSkin } from '../render/theme.js';
import { loadHeroPortraits } from '../platform/img.js';
import { touchQuests, reportQuest, questClaimable, questsOf, claimQuest, claimPass, passLevel, passExp, DAILY_QUESTS, WEEKLY_QUESTS } from '../meta/quests.js';
import { ACHIEVEMENTS, achvProgress, achvClaimable, claimAchv, anyAchvClaimable } from '../meta/achievements.js';
import { drawQuests, hitQuests } from '../render/quests.js';
import { drawChallenge, hitChallenge } from '../render/challenge.js';
import { modeUnlocked, dailyAffixOf, setBest } from '../meta/challenge.js';

export function createApp({ ctx, showRewarded, purchase = () => {}, getSpeed = () => 1 }) {
  // ===== 局外存档与屏幕状态 =====
  const save = loadSave();
  touchDaily(save); // 跨日重置免费抽计数
  touchQuests(save); // M6 任务日/周/赛季刷新（跨日 tick 内亦调用）
  setSkin(save.cosmetics.skin || 'ink');       // 启动恢复皮肤
  loadHeroPortraits(Object.keys(save.heroes)); // M6 立绘预热（失败静默回退圆牌）
  if (grantMonthlyDaily(save) > 0) persistSave(save); // 月卡跨日首发

  let screen = 'home';        // home | detail | gacha | battle | result | signin | shop | revive | quests | challenge
  let selectedHero = 'zhaoyun';
  let battleState = null;     // 战斗局内状态（engine state + chapterN/firstClear/pendingInputs）
  let resultData = null;      // 结算数据 { win, chapterN, rewards, doubled }
  let gachaResult = null;     // 抽卡结果浮层（单条或数组，null=无浮层）
  let adBusy = false;         // 激励视频观看中，防重入
  let shopPick = null;        // 首充 SR 自选浮层
  let questTab = 'daily';     // M6 军务面板当前页签（daily|weekly|pass|achv）
  let reviveUsed = false;     // 本局复活次数（0/1）
  let toastMsg = '', toastUntil = 0;
  function showToast(msg) { toastMsg = msg; toastUntil = Date.now() + 2600; }
  // M7 功勋累计统计：跨局累计不重置（save.stats）
  function addStats(key, n) { save.stats[key] = (save.stats[key] || 0) + n; }
  // M6 广告埋点：任何激励视频成功回调计 ad_watch（任务进度）
  function rewarded(slot, cb) {
    showRewarded(slot, {
      ...cb,
      onReward() { reportQuest(save, 'ad_watch', 1); cb.onReward && cb.onReward(); },
    });
  }
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
    if (screen === 'quests') return hitQuests(x, y, questTab, questRows(), passData(), achvRows());
    if (screen === 'challenge') return hitChallenge(x, y, save);
    if (screen === 'revive') return hitRevive(x, y);
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

  // ===== 军务面板视图数据（红点口径统一走 meta/quests.js anyClaimable，core 不另实现）=====
  function questRows() {
    if (questTab === 'pass' || questTab === 'achv') return []; // 战令页无任务行；功勋页走 achvRows
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
  // M7 功勋行数据：进度由 save 派生（achvProgress），领奖状态存 save.achievements.claimed
  function achvRows() {
    return ACHIEVEMENTS.map((a) => ({
      id: a.id, name: a.name, goal: a.goal,
      cur: achvProgress(save, a), reward: a.reward.diamonds,
      claimable: achvClaimable(save, a),
      claimed: save.achievements.claimed.includes(a.id),
    }));
  }
  function passData() {
    const lv = passLevel(save);
    const before = 1, after = 3; // 当前级锚点窗口（无横向滚动手势）
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

  // ===== 动作分发 =====
  function dispatch(hit) {
    if (!hit) return;
    if (screen === 'home') {
      if (hit.action === 'hero') { selectedHero = hit.heroId; screen = 'detail'; }
      if (hit.action === 'gacha') { screen = 'gacha'; gachaResult = null; }
      if (hit.action === 'battle') startBattle(save.progress.chapter);
      if (hit.action === 'signin') screen = 'signin';
      if (hit.action === 'shop') { screen = 'shop'; shopPick = null; }
      if (hit.action === 'quests') { screen = 'quests'; questTab = 'daily'; } // 进面板默认页签
      if (hit.action === 'challenge') { screen = 'challenge'; } // M7 征战入口
      if (hit.action === 'achv') { screen = 'quests'; questTab = 'achv'; } // M7 功勋（Task 4 接管内容）
      if (hit.action === 'share') doShare();
      if (hit.action === 'notices') doNotices();
      if (hit.action === 'sound') cycleSound(save);
      if (hit.action === 'skin' && !adBusy) {
        if (!save.cosmetics.shadowOwned) {
          adBusy = true;
          rewarded('skin', {
            onReward() {
              adBusy = false;
              save.cosmetics.shadowOwned = true;
              save.cosmetics.skin = 'shadow';
              setSkin('shadow');
              persistSave(save);
              showToast('皮影戏皮肤已解锁');
            },
            onFail() { adBusy = false; },
          });
        } else {
          save.cosmetics.skin = currentSkin() === 'shadow' ? 'ink' : 'shadow';
          setSkin(save.cosmetics.skin);
          persistSave(save);
          showToast(save.cosmetics.skin === 'shadow' ? '已换装 · 皮影戏' : '已换装 · 写实水墨');
        }
      }
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
        rewarded('double', {
          onReward() {
            adBusy = false;
            resultData.doubled = true;
            applyRewardsDouble();
            persistSave(save);
          },
          onFail() { adBusy = false; },
        });
      }
      if (hit.action === 'again') startBattle(resultData.chapterN, resultData.mode || 'chapter'); // M7 挑战重打同模式
      if (hit.action === 'next') startBattle(resultData.chapterN + 1);
    } else if (screen === 'signin') {
      if (hit.action === 'back') screen = 'home';
      if (hit.action === 'claim' && !adBusy) {
        adBusy = true;
        rewarded('signin', {
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
    } else if (screen === 'challenge') {
      if (hit.action === 'back') screen = 'home';
      if (hit.action === 'mode') {
        if (modeUnlocked(save, hit.mode)) startBattle(save.progress.chapter, hit.mode);
        else showToast('未解锁 · 先通关章节');
      }
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
      if (hit.action === 'achvClaim') {
        const a = ACHIEVEMENTS.find((x) => x.id === hit.id);
        if (a && claimAchv(save, a)) {
          persistSave(save);
          showToast(`功勋达成 · 钻石+${a.reward.diamonds}`);
        }
      }
    } else if (screen === 'revive') {
      if (hit.action === 'revive' && !adBusy) {
        adBusy = true;
        rewarded('revive', {
          onReward() {
            adBusy = false;
            reviveUsed = true;
            battleState.hp = battleState.hpMax; // 原地满血（敌人/波次现场保持）
            battleState.stage = 'wave';         // 解除 engine 终态冻结
            screen = 'battle';
          },
          onFail() { adBusy = false; },
        });
      }
      if (hit.action === 'giveup') finishBattle();
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
      rewarded('freePull', {
        onReward() {
          adBusy = false;
          save.daily.freePulls += 1;
          gachaResult = pullOnce(rng, ownedIds);
          applyGacha(save, gachaResult); // 新英雄解锁★1 / 重复转碎片
          reportQuest(save, 'gacha', ten ? 10 : 1);
          addStats('gachaCount', ten ? 10 : 1); // M7 功勋累计
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
    reportQuest(save, 'gacha', ten ? 10 : 1);
    addStats('gachaCount', ten ? 10 : 1); // M7 功勋累计
    persistSave(save);
  }

  // ===== 战斗 =====
  // M7 助战被动：周瑜灼烧 +20%/★、张辽开局 −8%/★（engine 零 save 依赖，core 算好注入）
  function battleBonus(save) {
    const b = { burnBonus: 0, frontHpCut: 0 };
    if (save.heroes.zhouyu?.owned) b.burnBonus = 0.2 * save.heroes.zhouyu.stars;
    if (save.heroes.zhangliao?.owned) b.frontHpCut = 0.08 * save.heroes.zhangliao.stars;
    return b;
  }

  // M7 占位（Task 5/6 替换为真实现）：分享 / 公告 / 声音切换
  function doShare() { showToast('M7 分享功能即将上线'); }
  function doNotices() { showToast('M7 公告功能即将上线'); }
  function cycleSound() {}

  function startBattle(chapterN, mode = 'chapter') {
    regenStamina(save);
    if (!spendStamina(save, BATTLE_COST)) {
      showToast(`体力不足（${save.wallet.stamina}/${STAMINA_MAX}）· 每 5 分钟恢复 1 点`);
      return;
    }
    reportQuest(save, 'stamina_spend', BATTLE_COST);
    persistSave(save);
    // M7：模式化开战。daily 种子=YYYYMMDD、词缀=当日；chMul 挑战模式取当前章（engine 内再乘 endless/bossrush 递增）
    const seed = mode === 'daily' ? Number(todayStr().replace(/-/g, '')) : 20260304 + chapterN;
    const opts = {
      atkMul: atkMul(save, 'zhaoyun'),
      chapterMul: mode === 'chapter' ? chapterMul(chapterN) : chapterMul(save.progress.chapter),
      mode,
      dailyAffix: mode === 'daily' ? dailyAffixOf(todayStr()) : null,
      bonus: battleBonus(save),
    };
    battleState = createBattle(seed, opts);
    battleState.chapterN = chapterN;   // 展示/结算用标注（engine 不读）
    battleState.mode = mode;           // 冗余存一份供结算读取（engine 内部以 state.mode 为准）
    battleState.firstClear = chapterN > save.progress.chapterClear;
    battleState.pendingInputs = null;
    reviveUsed = false;
    screen = 'battle';
  }

  function finishBattle() {
    const win = battleState.stage === 'victory';
    const mode = battleState.mode || 'chapter';
    // M6 战斗埋点：局内计数整局上报（胜/负均计）
    const st = battleState.stats || { mergeCount: 0, ultCount: 0, bossKills: 0 };
    if (st.mergeCount) reportQuest(save, 'merge', st.mergeCount);
    if (st.ultCount) reportQuest(save, 'ult', st.ultCount);
    if (st.bossKills) reportQuest(save, 'boss_kill', st.bossKills);
    if (win) reportQuest(save, 'battle_win', 1);
    // M7 功勋埋点：击杀/通关跨局累计（胜/负均计击杀）
    addStats('kills', battleState.killCount || 0);
    if (win) addStats('wins', 1);
    touchQuests(save); // 结算时跨日/跨周补偿刷新
    if (mode === 'endless') {
      // M7 无尽：死亡/漏怪时的波数即战绩；金币 = 波数 × 20
      const bestWave = battleState.wave;
      setBest(save, 'endless', bestWave);
      const coins = bestWave * 20;
      save.wallet.coins += coins;
      addStats('coinsEarned', coins); // M7 功勋累计
      resultData = {
        win, chapterN: battleState.chapterN, mode,
        modeTitle: `无尽模式 · ${bestWave} 波`,
        modeText: `最佳 ${Math.max(save.progress.endlessBest, bestWave)} 波 · 金币 +${coins}`,
        rewards: { coins, diamonds: 0, frags: {} }, doubled: false,
      };
    } else if (mode === 'daily') {
      // M7 每日挑战：当日首胜领 ◆50，之后当日重打无奖励（失败可无限重试）
      let diamonds = 0;
      if (win && save.progress.dailyPaid !== todayStr()) { save.progress.dailyPaid = todayStr(); diamonds = 50; addStats('dailyWins', 1); } // M7 功勋：每日首胜累计
      save.wallet.diamonds += diamonds;
      resultData = {
        win, chapterN: battleState.chapterN, mode,
        modeTitle: `每日挑战 · ${win ? '通关' : '未通关'}`,
        modeText: diamonds ? `首通奖励 ◆${diamonds}` : (win ? '今日奖励已领' : '失败可无限重试'),
        rewards: { coins: 0, diamonds, frags: {} }, doubled: false,
      };
    } else if (mode === 'bossrush') {
      // M7 车轮战：击败数计分；当日按击败数发钻石（上限 50）
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
        win,
        chapterN: battleState.chapterN,
        rewards: resultRewards(battleState.chapterN, win && battleState.firstClear, save),
        doubled: false,
      };
      if (win) {
        applyRewardsWithProgress(resultData.rewards);
      } else {
        save.wallet.coins += resultData.rewards.coins; // 战败安慰金币（重复通关口径）
        addStats('coinsEarned', resultData.rewards.coins); // M7 功勋累计
      }
    }
    persistSave(save);
    screen = 'result'; // 战败也进结算屏（drawResult/hitResult 已按 win=false 处理）
  }

  // 结算入账 + 首通推进进度（chapterClear 取最大；chapter 指向下一章）
  function applyRewardsWithProgress(r) {
    addStats('coinsEarned', r.coins); // M7 功勋累计
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
    if (save.daily.date !== todayStr()) { // 跨日：免费抽/签到重置 + 月卡发放
      touchDaily(save);
      grantMonthlyDaily(save);
      touchQuests(save); // M6 任务日/周/赛季刷新
      persistSave(save);
    }
    const dtMs = Math.min(now - last, 100); // 切后台回来防大步积压
    last = now;
    if (screen === 'battle') {
      battleState = advanceFrame(battleState, battleState.pendingInputs, dtMs * SPEED);
      battleState.pendingInputs = null; // 每帧消费一次
      if (battleState.stage === 'victory' || battleState.stage === 'over') {
        if (battleState.stage === 'over' && !reviveUsed) {
          screen = 'revive'; // 拦截结算 → 弹复活（engine 终态冻结，等待 app 层处置）
        } else {
          finishBattle();
        }
      }
      drawBattle(ctx, battleState);
    } else if (screen === 'home') {
      drawHome(ctx, save, selectedHero, { achv: anyAchvClaimable(save) }); // M7 功勋红点（notices 红点 Task 6 接管）
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
    } else if (screen === 'quests') {
      drawQuests(ctx, save, questTab, questRows(), passData(), achvRows());
    } else if (screen === 'challenge') {
      drawChallenge(ctx, save, {
        daily: modeUnlocked(save, 'daily'),
        endless: modeUnlocked(save, 'endless'),
        bossrush: modeUnlocked(save, 'bossrush'),
      });
    } else if (screen === 'revive') {
      drawBattle(ctx, battleState);
      drawRevive(ctx, battleState.wave);
    }
    // 屏绘制后统一画 toast（战斗屏除外）
    if (screen !== 'battle' && Date.now() < toastUntil) toast(ctx, toastMsg);
    requestAnimationFrame(loop);
  }

  function start() { requestAnimationFrame(loop); }

  return {
    handlePointer, start,
    get screen() { return screen; },
    // 冒烟测试钩子：仅 dev 生效（import.meta.env.DEV），prod 构建整段死码剔除
    __debug(fn) { if (import.meta.env.DEV && battleState) fn(battleState); },
  };
}
