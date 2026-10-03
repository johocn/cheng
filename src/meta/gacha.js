// src/meta/gacha.js — 名将录抽卡：品质加权 → 品质内均匀；十连保底 SR+
// 种子 rng（engine/rng.js mulberry32）保证确定性可测可复现
import { rngNext } from '../engine/rng.js';
import { HEROES, GACHA_POOL, DUP_FRAGS } from './heroes.js';

export const PULL_COST = 280;
export const TEN_COST = 2520; // 280×10×0.9

const QUALITY_WEIGHTS = { UR: 1.5, SSR: 8.5, SR: 30, R: 60 };
const HIGH = ['SR', 'SSR', 'UR'];

export function qualityOfId(heroId) { return HEROES[heroId].quality; }

// 品质加权抽取（权重和 100）
export function rollQuality(rng) {
  let r = rngNext(rng) * 100;
  for (const q of ['UR', 'SSR', 'SR', 'R']) {
    r -= QUALITY_WEIGHTS[q];
    if (r <= 0) return q;
  }
  return 'R';
}

// 单抽结果：{ heroId, dup, frags }；dup 由调用方按 owned 判定后由 applyGacha 落账
export function pullOnce(rng, ownedIds = []) {
  const q = rollQuality(rng);
  const pool = GACHA_POOL.filter((id) => HEROES[id].quality === q);
  const heroId = pool[Math.floor(rngNext(rng) * pool.length)];
  const dup = ownedIds.includes(heroId);
  return { heroId, dup, frags: dup ? DUP_FRAGS[HEROES[heroId].quality] : 0 };
}

// 十连：逐抽；若前 9 抽全 R，则第 10 抽强制 SR+（品质内均匀）
export function pullTen(rng, ownedIds = []) {
  const res = [];
  for (let i = 0; i < 10; i++) res.push(pullOnce(rng, ownedIds));
  if (!res.slice(0, 9).some((r) => HIGH.includes(HEROES[r.heroId].quality))) {
    const pool = GACHA_POOL.filter((id) => HIGH.includes(HEROES[id].quality));
    const heroId = pool[Math.floor(rngNext(rng) * pool.length)];
    const dup = ownedIds.includes(heroId);
    res[9] = { heroId, dup, frags: dup ? DUP_FRAGS[HEROES[heroId].quality] : 0 };
  }
  return res;
}
