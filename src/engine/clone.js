// engine/clone.js — 无宿主 API 依赖的深拷贝
// wx 小游戏基础库（lib 3.x）不提供 structuredClone（Node 17+/Chrome 98+ 才有），
// 引擎层 advanceFrame 每帧快照必须走自研实现；state 为 plain object 树，此实现覆盖之，
// 并附 Date/Map/Set 兜底防止未来 state 携带这些类型时静默丢引用。
export function deepClone(v) {
  if (v === null || typeof v !== 'object') return v; // 原始值直返（含 undefined/NaN/±Infinity）
  if (Array.isArray(v)) {
    const arr = new Array(v.length);
    for (let i = 0; i < v.length; i++) arr[i] = deepClone(v[i]);
    return arr;
  }
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof Map) {
    const out = new Map();
    for (const [k, x] of v) out.set(deepClone(k), deepClone(x));
    return out;
  }
  if (v instanceof Set) {
    const out = new Set();
    for (const x of v) out.add(deepClone(x));
    return out;
  }
  const out = {};
  for (const k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = deepClone(v[k]);
  }
  return out;
}
