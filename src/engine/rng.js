// engine/rng.js — mulberry32 种子随机：rng 是普通对象，直接存进 battle state，
// structuredClone 自动复制，advanceFrame 保持纯函数确定性。
export function createRng(seed) {
  return { s: seed >>> 0 };
}

export function rngNext(rng) {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngInt(rng, n) {
  return Math.floor(rngNext(rng) * n);
}

export function rngPick(rng, arr) {
  return arr[rngInt(rng, arr.length)];
}
