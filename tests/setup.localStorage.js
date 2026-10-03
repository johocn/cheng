// tests/setup.localStorage.js — node 测试环境最小 localStorage 垫片
// vitest 默认 environment 为 node 且未安装 jsdom；save.js 的 localStorage 分支需要此全局对象
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}
