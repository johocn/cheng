// engine/enemy.js — 敌人生成 / 沿路径移动 / 漏怪判定
import { LANES, ENEMY_TYPES, SIEGE_RANGE, SIEGE_INTERVAL, SIEGE_DMG, COMBO_WINDOW, HERO_POS, BOSS_SKILL } from './config.js';

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

// M9 Boss 技能扇形几何：顶点 (bx,by) 朝 facing 展开 arcDeg 张角、range 半径，判定点 (px,py) 是否在扇形内
export function inArc(bx, by, px, py, facing, range = BOSS_SKILL.range, arcDeg = BOSS_SKILL.arc) {
  const dx = px - bx, dy = py - by;
  if (Math.hypot(dx, dy) > range) return false;
  let ang = Math.atan2(dy, dx) - facing;
  while (ang > Math.PI) ang -= 2 * Math.PI;
  while (ang < -Math.PI) ang += 2 * Math.PI;
  return Math.abs(ang) <= (arcDeg / 2) * (Math.PI / 180);
}

export function spawnEnemy(state, type, laneIdx, mul = 1, hpMul = 1, affix = null) {
  const def = ENEMY_TYPES[type];
  const iron = affix === 'iron' ? 1.6 : 1;
  const e = {
    id: state.nextEnemyId++,
    type,
    lane: laneIdx,
    t: 0,
    hp: def.hp * mul * hpMul * iron,           // iron 词缀：铁壁 hp ×1.6
    hpMax: def.hp * mul * hpMul * iron,
    speedMul: mul * (affix === 'swift' ? 1.4 : 1), // swift 词缀：疾行速度 ×1.4
    dmgBonus: affix === 'sharp' ? 2 : 0,       // sharp 词缀：漏怪/轰击伤害 +2
    affix,
    siegeClock: 0, // 投石车轰击计时
    slowT: 0, stunT: 0, burnT: 0,
    burnMul: 1 + (state.burnBonus || 0), // M7 周瑜被动：灼烧增伤乘区（enemy.js 灼烧结算已乘 burnMul）
  };
  state.enemies.push(e);
  if (type === 'shuai') { // M9：技能状态机（null=冷却 | 'warn'=前摇）+ M8：登场事件（卷轴/屏震触发）
    e.skill = { clock: 0, phase: null, t0: 0 };
    (state.frameEvents = state.frameEvents || []).push({
      type: 'boss', x: LANES[laneIdx][0].x, y: LANES[laneIdx][0].y,
      dmg: 0, crit: false, enemyType: 'shuai', isBoss: true,
    });
  }
}

// 推进所有敌人（含 stun 冻结 / slow 减速 / burn 灼烧 / M9 Boss 技能状态机）；
// t≥1 的判定漏怪并移出，返回 [{type, dmg}]——扣血由 state.js 统一结算（shield 免伤）
export function moveEnemies(state, dtSec) {
  const leaked = [];
  const survivors = [];
  for (const e of state.enemies) {
    // M9 Boss 技能：warn 前摇被眩晕/击退（t 回退）→ 打断取消，cd 重置满（打断即有收益）
    if (e.skill && e.skill.phase === 'warn' && (e.stunT > 0 || e.t < e.skill.t0 - 1e-6)) {
      e.skill.phase = null;
      e.skill.clock = 0;
    }
    if (e.stunT > 0) { e.stunT -= dtSec; survivors.push(e); continue; }
    if (e.skill) { // M9 Boss 技能状态机（stun 分支已天然冻结计时）
      const p = pathPoint(e.lane, e.t);
      if (e.skill.phase === null) {
        e.skill.clock += dtSec;
        // 冷却满 + 已逼近英雄（≤ range×0.9）才起手
        if (e.skill.clock >= BOSS_SKILL.cd &&
            Math.hypot(HERO_POS.x - p.x, HERO_POS.y - p.y) <= BOSS_SKILL.range * 0.9) {
          e.skill.phase = 'warn'; e.skill.clock = 0; e.skill.t0 = e.t;
        }
      } else {
        e.skill.clock += dtSec;
        if (e.skill.clock >= BOSS_SKILL.telegraph) {
          // 结算：扇形朝英雄展开，英雄恒在张角内；距离超 range（击退后）则空放不扣
          const facing = Math.atan2(HERO_POS.y - p.y, HERO_POS.x - p.x);
          if (inArc(p.x, p.y, HERO_POS.x, HERO_POS.y, facing)) {
            leaked.push({ type: e.type, dmg: BOSS_SKILL.dmg, skill: true, x: p.x, y: p.y });
          }
          e.skill.phase = null; e.skill.clock = 0; // 结算/空放后 cd 重置
        }
      }
    }
    if (e.slowT > 0) { e.slowT -= dtSec; }
    if (e.burnT > 0) {
      e.burnT -= dtSec;
      // M6 藤甲兵元素弱点：受灼烧伤害 ×2
      const burnK = e.type === 'teng' ? 2 : 1;
      e.hp -= e.hpMax * 0.02 * dtSec * burnK * (e.burnMul || 1);
    }
    const slow = e.slowT > 0 ? 0.7 : 1;
    // M6 投石车：抵达停驻点后驻守轰击，永不漏怪（被击退 t 变小则恢复推进）
    if (e.type === 'tou' && e.t >= 1 - SIEGE_RANGE / laneLength(e.lane)) {
      e.siegeClock += dtSec;
      while (e.siegeClock >= SIEGE_INTERVAL) {
        e.siegeClock -= SIEGE_INTERVAL;
        leaked.push({ type: e.type, dmg: SIEGE_DMG + (e.dmgBonus || 0) });
      }
      survivors.push(e);
      continue;
    }
    e.t += (ENEMY_TYPES[e.type].speed * (e.speedMul || 1) * slow * dtSec) / laneLength(e.lane);
    if (e.t >= 1) {
      leaked.push({ type: e.type, dmg: ENEMY_TYPES[e.type].dmg + (e.dmgBonus || 0) });
    } else {
      survivors.push(e);
    }
  }
  state.enemies = survivors;
  return leaked;
}

// 击杀登记（金币/计数/M9 连击窗口）——dealDamage 直伤死与 reapDead 收尸共用，
// 两路互斥（直伤死即 splice 移出，不会被收尸重复登记）
export function registerKill(state, type) {
  state.coins += ENEMY_TYPES[type].reward;
  state.killCount = (state.killCount || 0) + 1;
  // M9 连击：窗口内递增，超窗归零重计（旧式 state 缺字段时按超窗处理，零回归）
  const gap = (state.stageClock ?? Infinity) - (state.lastKillClock ?? -Infinity);
  if (gap > COMBO_WINDOW || state.combo == null) state.combo = 0;
  state.combo += 1;
  state.lastKillClock = state.stageClock ?? state.lastKillClock;
}

// 死亡清尸：hp≤0 的敌人入金币并移除（灼烧/锦囊/大招伤害的统一收口；直伤走 combat.dealDamage）
export function reapDead(state) {
  for (const e of state.enemies) {
    if (e.hp <= 0) {
      registerKill(state, e.type);
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
