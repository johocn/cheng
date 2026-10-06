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

// ===== Task 8：演出绘制（battle.js 在全部战场元素之后调用）=====
const KAI = '"KaiTi","STKaiti","楷体",serif';

export function drawCinematic(ctx) {
  const cur = queue[0];
  if (!cur) return;
  if (cur.kind === 'bossScroll') drawBossScroll(ctx, cur.t / cur.dur, cur.data);
  else if (cur.kind === 'bossKill') drawBossKill(ctx, cur.t / cur.dur, cur.data);
}

// Boss 卷轴登场（0.8s）：横幅卷轴自中央展开——羊皮纸带 + 青铜轴头 + 名号 + 朱砂「帅」印 + 两侧墨迹
function drawBossScroll(ctx, q, data) {
  // 展开节奏：0-0.3 展开 scale 0.1→1，0.3-0.8 停留，0.8-1 收起 1→0.1
  let scale;
  if (q < 0.3) scale = 0.1 + 0.9 * (1 - Math.pow(1 - q / 0.3, 3));
  else if (q < 0.8) scale = 1;
  else scale = 0.1 + 0.9 * (1 - (q - 0.8) / 0.2);
  // 背景暗幕（演出聚焦）
  ctx.fillStyle = `rgba(31,27,22,${(0.35 * scale).toFixed(3)})`;
  ctx.fillRect(0, 0, 720, 1280);
  ctx.save();
  ctx.translate(360, 560);
  ctx.scale(scale, scale);
  // 两侧墨迹晕开（radial 大墨团）
  for (const [mx, my] of [[-320, 0], [320, 0]]) {
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 130);
    g.addColorStop(0, 'rgba(31,27,22,0.5)');
    g.addColorStop(1, 'rgba(31,27,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(mx, my, 130, 0, Math.PI * 2);
    ctx.fill();
  }
  // 羊皮纸带（600×180）
  const g2 = ctx.createLinearGradient(0, -90, 0, 90);
  g2.addColorStop(0, '#f2e8d2');
  g2.addColorStop(1, '#d9c9a8');
  ctx.fillStyle = g2;
  ctx.fillRect(-300, -90, 600, 180);
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 3;
  ctx.strokeRect(-300, -90, 600, 180);
  // 青铜轴头（两端圆柱）
  ctx.fillStyle = '#8b6914';
  ctx.fillRect(-316, -100, 16, 200);
  ctx.fillRect(300, -100, 16, 200);
  ctx.fillStyle = '#b8963e';
  ctx.fillRect(-316, -100, 16, 14);
  ctx.fillRect(-316, 86, 16, 14);
  ctx.fillRect(300, -100, 16, 14);
  ctx.fillRect(300, 86, 16, 14);
  // Boss 名号（44px 楷体）
  ctx.fillStyle = '#1f1b16';
  ctx.font = 'bold 44px ' + KAI;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.title || '敌 帅', 0, -14);
  ctx.fillStyle = '#5a5040';
  ctx.font = '16px ' + KAI;
  ctx.fillText('—— 大 敌 当 前 ——', 0, 44);
  // 朱砂「帅」印（右上角）
  ctx.rotate(-0.06);
  ctx.fillStyle = '#9e2a1e';
  ctx.fillRect(196, -78, 56, 56);
  ctx.fillStyle = '#f4ecd8';
  ctx.font = 'bold 30px ' + KAI;
  ctx.fillText('帅', 224, -49);
  ctx.restore();
}

// 斩杀慢镜（0.4s）：全场褪色至宣纸留白 + Boss 剪影墨点飞散 + 朱砂「斩」大印 64px 盖下（scale 1.3→1 微旋）
function drawBossKill(ctx, q, data) {
  // 全场褪色：纸色罩渐强（宣纸留白感）
  ctx.fillStyle = `rgba(244,236,216,${(0.55 * Math.min(1, q * 1.6)).toFixed(3)})`;
  ctx.fillRect(0, 0, 720, 1280);
  const bx = data.x || 360;
  const by = data.y || 500;
  // Boss 剪影墨点飞散：12 颗墨点从死亡点径向散开淡出（确定性角度）
  const alpha = 1 - q;
  ctx.fillStyle = `rgba(31,27,22,${(0.7 * alpha).toFixed(3)})`;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + 0.26;
    const dist = 20 + q * 90;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(ang) * dist, by + Math.sin(ang) * dist, 6 + (i % 3) * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // 朱砂「斩」大印：q 0.25 后盖下，scale 1.3→1 微旋
  if (q > 0.25) {
    const pq = Math.min(1, (q - 0.25) / 0.5);
    const s = 64 * (1.3 - 0.3 * pq);
    ctx.save();
    ctx.globalAlpha = pq < 0.9 ? 1 : (1 - pq) / 0.1;
    ctx.translate(bx, by);
    ctx.rotate(-0.04 + pq * 0.03);
    ctx.fillStyle = 'rgba(158,42,30,0.92)';
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = '#f4ecd8';
    ctx.font = `bold ${Math.round(s * 1.1)}px ` + KAI;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('斩', 0, s * 0.06);
    ctx.restore();
  }
}
