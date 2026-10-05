// render/cinematic.js — M8 演出队列状态机：Boss 卷轴 / 斩杀慢镜（与 hit-stop 共用吞帧机制）
// 队列串行独占；绘制函数 draw() 于 Task 8 补齐
export const QUEUE_MAX = 2;
export const DUR_SCROLL = 800; // Boss 卷轴 0.8s
export const DUR_KILL = 400;   // 斩杀慢镜 0.4s

const queue = [];

export function push(item) {
  if (queue.length >= QUEUE_MAX) return; // 防积压
  queue.push({ t: 0, ...item });
}

export function active() { return queue[0] || null; }

export function update(dtMs) {
  let dt = dtMs;
  while (queue.length && dt > 0) { // 消耗式推进：一次 update 可跨过多个已播完的短演出
    const cur = queue[0];
    const remain = cur.dur - cur.t;
    if (dt >= remain) { dt -= remain; queue.shift(); continue; }
    cur.t += dt;
    dt = 0;
  }
}

export function reset() { queue.length = 0; }
