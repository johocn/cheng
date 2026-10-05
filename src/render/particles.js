// render/particles.js — M8 粒子系统 v2：溅墨/飞白/墨晕三发射器，池化 ≤120 保 60fps
// 确定性随机：模块级 LCG（禁 Math.random，同序调用同结果，可测）
// 配色每帧读 globalThis.Art.C 现值 → 双皮肤（水墨/皮影）自动契合
export const POOL_MAX = 120;

// ---- 确定性随机（线性同余） ----
let lcg = 12345;
function rnd() { lcg = (lcg * 1103515245 + 12345) & 0x7fffffff; return lcg / 0x7fffffff; }

const pool = [];

function alloc() {
  if (pool.length < POOL_MAX) { const p = {}; pool.push(p); return p; }
  let oldest = pool[0];
  for (const p of pool) if (p.age > oldest.age) oldest = p; // 池满复用最老
  return oldest;
}

function paint() {
  const Art = globalThis.Art;
  return (Art && Art.C) || { ink: '#1f1b16', seal: '#9e2a1e', gold: '#c9a227' };
}

// 溅墨：命中点墨色+朱砂混喷（重力抛物线）
export function splash(x, y, n = 8) {
  const C = paint();
  for (let i = 0; i < n; i++) {
    const p = alloc();
    const ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    const sp = 90 + rnd() * 160;
    p.kind = 'splash';
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp;
    p.life = 0.3 + rnd() * 0.25; p.age = 0;
    p.size = 2 + rnd() * 3.5;
    p.color = rnd() < 0.25 ? C.seal : C.ink;
    p.alive = true;
  }
}

// 飞白：沿方向角的拖尾短线（冲刺/枪风/突刺路径）
export function trail(x, y, ang) {
  const C = paint();
  const p = alloc();
  p.kind = 'trail';
  p.x = x; p.y = y;
  p.vx = Math.cos(ang) * 240; p.vy = Math.sin(ang) * 240;
  p.life = 0.18 + rnd() * 0.1; p.age = 0;
  p.size = 1.5 + rnd() * 1.5;
  p.color = C.gold;
  p.alive = true;
}

// 墨晕：死亡消散——大粒慢速外扩淡出
export function blot(x, y) {
  const C = paint();
  const n = 4;
  for (let i = 0; i < n; i++) {
    const p = alloc();
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.8;
    const sp = 24 + rnd() * 30;
    p.kind = 'blot';
    p.x = x; p.y = y;
    p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp - 10;
    p.life = 0.4 + rnd() * 0.15; p.age = 0;
    p.size = 7 + rnd() * 8;
    p.color = C.ink;
    p.alive = true;
  }
}

export function update(dtSec) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dtSec;
    if (p.age >= p.life) { p.alive = false; continue; }
    if (p.kind === 'splash') p.vy += 380 * dtSec; // 重力
    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
  }
}

export function draw(ctx) {
  const C = paint();
  for (const p of pool) {
    if (!p.alive) continue;
    const a = Math.max(0, 1 - p.age / p.life);
    ctx.globalAlpha = a;
    if (p.kind === 'trail') {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const len = 12 * a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.kind === 'blot' ? p.size * (0.6 + 0.6 * (p.age / p.life)) : p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function activeCount() { return pool.filter((p) => p.alive).length; }

export function reset() {
  pool.length = 0;
  lcg = 12345; // 复位确定性种子
}
