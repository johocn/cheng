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

export function spawnEnemy(state, type, laneIdx, mul = 1, hpMul = 1) {
  const def = ENEMY_TYPES[type];
  state.enemies.push({
    id: state.nextEnemyId++,
    type,
    lane: laneIdx,
    t: 0,
    hp: def.hp * mul * hpMul,    // hpMul：章节敌方 hp 系数（M3 局外注入）
    hpMax: def.hp * mul * hpMul,
    speedMul: mul, // 速度成长与 slow/stun 合成在 moveEnemies（不随章节系数放大）
    slowT: 0, stunT: 0, burnT: 0,
  });
}

// 推进所有敌人（含 stun 冻结 / slow 减速 / burn 灼烧）；
// t≥1 的判定漏怪并移出，返回 [{type, dmg}]——扣血由 state.js 统一结算（shield 免伤）
export function moveEnemies(state, dtSec) {
  const leaked = [];
  const survivors = [];
  for (const e of state.enemies) {
    if (e.stunT > 0) { e.stunT -= dtSec; survivors.push(e); continue; }
    if (e.slowT > 0) { e.slowT -= dtSec; }
    if (e.burnT > 0) {
      e.burnT -= dtSec;
      // M6 藤甲兵元素弱点：受灼烧伤害 ×2
      const burnK = e.type === 'teng' ? 2 : 1;
      e.hp -= e.hpMax * 0.02 * dtSec * burnK * (e.burnMul || 1);
    }
    const slow = e.slowT > 0 ? 0.7 : 1;
    e.t += (ENEMY_TYPES[e.type].speed * (e.speedMul || 1) * slow * dtSec) / laneLength(e.lane);
    if (e.t >= 1) {
      leaked.push({ type: e.type, dmg: ENEMY_TYPES[e.type].dmg });
    } else {
      survivors.push(e);
    }
  }
  state.enemies = survivors;
  return leaked;
}

// 死亡清尸：hp≤0 的敌人入金币并移除（锦囊/灼烧/大招伤害的统一收口）
export function reapDead(state) {
  for (const e of state.enemies) {
    if (e.hp <= 0) {
      state.coins += ENEMY_TYPES[e.type].reward;
      state.killCount = (state.killCount || 0) + 1;
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
}
