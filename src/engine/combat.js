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
