// engine/combat.js — 伤害结算 / 死亡移除 / 击杀金币
import { ENEMY_TYPES } from './config.js';

// 对单个敌人结算伤害；致死则移出并发金币
export function dealDamage(state, enemyId, amount) {
  const e = state.enemies.find((x) => x.id === enemyId);
  if (!e) return null;
  e.hp -= amount;
  if (e.hp <= 0) {
    const reward = ENEMY_TYPES[e.type].reward;
    state.coins += reward;
    state.killCount = (state.killCount || 0) + 1; // 击杀统计（饮血回血按总杀数取模）
    state.enemies = state.enemies.filter((x) => x.id !== enemyId);
    return { killed: true, reward };
  }
  return { killed: false };
}
