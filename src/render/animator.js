// render/animator.js — M8 部件动画器：姿态纯函数 + 水墨/皮影剪影小人
// pose() 只输出数据（vitest 可测）；drawX 只按数据画；配色每帧读 Art.C 现值（theme.setSkin 即全量换肤）

const KAI = '"KaiTi","STKaiti","楷体",serif';

function art() {
  const A = globalThis.Art;
  return (A && A.C) || {
    ink: '#1f1b16', inkMid: '#3a332a', paper: '#e8dcc4', paperHi: '#f2e8d2',
    bronze: '#8b6914', bronzeLt: '#b8963e', gold: '#c9a227', seal: '#9e2a1e',
  };
}

// 敌人视高（px）：mockup v2 定稿约圆牌 2 倍，48-56 区间
export function figureHeight(type) {
  if (type === 'qi') return 56;   // 骑马最高
  if (type === 'shuai') return 54; // 大氅
  return 50;                       // 兵/弓
}

// ===== 姿态纯函数：输出 { lean, bob, weaponAngle, flash, alpha, sink, limbSwing } =====
// animState: 'walk'|'attack'|'hit'|'die'; t: 态内秒
export function pose(type, animState, t) {
  const pz = { lean: 0, bob: 0, weaponAngle: 0, flash: 0, alpha: 1, sink: 0, limbSwing: 0 };
  if (animState === 'walk') {
    pz.bob = Math.sin(t * 8) * 2;
    pz.limbSwing = Math.sin(t * 8);
    pz.lean = 4 + Math.sin(t * 4) * 2; // 前倾赶路
    if (type === 'qi') pz.bob += Math.sin(t * 10) * 1.5; // 骑乘颠簸
  } else if (animState === 'attack') {
    const q = Math.min(1, t / 0.2);
    pz.lean = 14 * Math.sin((q * Math.PI) / 2);
    pz.weaponAngle = -1.1 + q * 1.6; // 挥砍弧 -63°→+28°
    if (t > 0.2) { pz.lean = 0; pz.weaponAngle = 0.5; }
  } else if (animState === 'hit') {
    const q = Math.max(0, 1 - t / 0.08);
    pz.flash = q;       // 纸色闪白 80ms 衰减
    pz.lean = -10 * q;  // 后仰
  } else if (animState === 'die') {
    const q = Math.min(1, t / 0.4);
    pz.alpha = 1 - q;
    pz.sink = 12 * q;
    pz.lean = -20 * q;
  }
  return pz;
}

// ===== 敌人剪影小人（部件拼装，高 figureHeight）=====
// (x,y)=脚底锚点；pz=pose 输出。attack 弧方向固定朝右（敌人朝赵云≈路径终点，绘制时以 lean 表达即可）
export function drawEnemyFigure(ctx, x, y, type, pz) {
  const C = art();
  const H = figureHeight(type);
  const a = Math.max(0, pz.alpha);
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  const yy = y - pz.sink;

  // 落地墨影（脚底椭圆）
  ctx.fillStyle = 'rgba(31,27,22,0.30)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, H * 0.22, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, yy);
  ctx.rotate((pz.lean * Math.PI) / 180);

  if (type === 'qi') drawRider(ctx, C, H, pz);
  else if (type === 'gong') drawArcher(ctx, C, H, pz);
  else if (type === 'shuai') drawMarshal(ctx, C, H, pz);
  else drawSwordsman(ctx, C, H, pz);

  // 受击纸色闪白（覆盖剪影的柔光圆）
  if (pz.flash > 0) {
    ctx.globalAlpha = a * pz.flash * 0.75;
    ctx.fillStyle = C.paperHi;
    ctx.beginPath();
    ctx.arc(0, -H * 0.5, H * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 兵（刀兵）：披风 + 宽刃刀（刃/格/柄）+ 发髻 + 腰带
function drawSwordsman(ctx, C, H, pz) {
  const bodyTop = -H * 0.42, bodyBot = 0;
  // 披风（身后摆动三角）
  ctx.fillStyle = C.inkMid;
  ctx.beginPath();
  ctx.moveTo(-H * 0.06, bodyTop + H * 0.06);
  ctx.lineTo(-H * 0.26 - pz.limbSwing * 3, bodyBot - H * 0.02);
  ctx.lineTo(-H * 0.05, bodyBot - H * 0.1);
  ctx.closePath();
  ctx.fill();
  // 身体（墨团梯形）
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-H * 0.09, bodyTop);
  ctx.lineTo(H * 0.09, bodyTop);
  ctx.lineTo(H * 0.13, bodyBot);
  ctx.lineTo(-H * 0.13, bodyBot);
  ctx.closePath();
  ctx.fill();
  // 腰带
  ctx.strokeStyle = C.seal;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-H * 0.115, -H * 0.18);
  ctx.lineTo(H * 0.115, -H * 0.18);
  ctx.stroke();
  // 头 + 发髻
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.09, H * 0.095, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.185, H * 0.035, 0, Math.PI * 2); ctx.fill();
  // 宽刃刀：柄(细线) + 格(短横) + 刃(长四边形)
  ctx.save();
  ctx.translate(H * 0.1, bodyTop + H * 0.1);
  ctx.rotate(pz.weaponAngle - 0.5);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(H * 0.16, 0); ctx.stroke(); // 柄
  ctx.beginPath(); ctx.moveTo(H * 0.16, -H * 0.05); ctx.lineTo(H * 0.16, H * 0.05); ctx.stroke(); // 格
  ctx.fillStyle = C.inkMid;
  ctx.beginPath();
  ctx.moveTo(H * 0.17, -H * 0.035);
  ctx.lineTo(H * 0.40, -H * 0.05);
  ctx.lineTo(H * 0.43, 0);
  ctx.lineTo(H * 0.17, H * 0.035);
  ctx.closePath();
  ctx.fill(); // 刃
  ctx.restore();
}

// 弓：反曲弓（弓臂双曲线+弦）+ 搭箭 + 背后箭壶
function drawArcher(ctx, C, H, pz) {
  const bodyTop = -H * 0.44, bodyBot = 0;
  // 身体
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-H * 0.08, bodyTop);
  ctx.lineTo(H * 0.08, bodyTop);
  ctx.lineTo(H * 0.11, bodyBot);
  ctx.lineTo(-H * 0.11, bodyBot);
  ctx.closePath();
  ctx.fill();
  // 头
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.09, H * 0.09, 0, Math.PI * 2); ctx.fill();
  // 背后箭壶（斜背小矩形 + 两支箭头）
  ctx.save();
  ctx.translate(-H * 0.1, bodyTop + H * 0.12);
  ctx.rotate(0.35);
  ctx.fillStyle = C.inkMid;
  ctx.fillRect(-H * 0.03, 0, H * 0.06, H * 0.2);
  ctx.strokeStyle = C.inkMid;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-H * 0.01, 0); ctx.lineTo(-H * 0.01, -H * 0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(H * 0.015, 0); ctx.lineTo(H * 0.015, -H * 0.05); ctx.stroke();
  ctx.restore();
  // 反曲弓：竖持双曲弓臂 + 弦
  ctx.save();
  ctx.translate(H * 0.12, bodyTop + H * 0.1);
  ctx.rotate(pz.weaponAngle * 0.4);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -H * 0.16);
  ctx.quadraticCurveTo(H * 0.09, -H * 0.08, 0.028 * H, 0); // 上臂反曲
  ctx.quadraticCurveTo(H * 0.09, H * 0.08, 0, H * 0.16);   // 下臂反曲
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -H * 0.16); ctx.lineTo(0, H * 0.16); ctx.stroke(); // 弦
  // 搭箭（水平短线+镞）
  ctx.beginPath(); ctx.moveTo(-H * 0.05, 0); ctx.lineTo(H * 0.1, 0); ctx.stroke();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(H * 0.1, 0); ctx.lineTo(H * 0.07, -H * 0.02); ctx.lineTo(H * 0.07, H * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// 骑：马身/马首/四蹄/尾鬃 + 骑手 + 长枪朱砂红缨
function drawRider(ctx, C, H, pz) {
  const bodyY = -H * 0.36; // 马背高度
  // 尾鬃（曲线）
  ctx.strokeStyle = C.inkMid;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-H * 0.26, bodyY - H * 0.04);
  ctx.quadraticCurveTo(-H * 0.4, bodyY + H * 0.02, -H * 0.38 - pz.limbSwing * 2, bodyY + H * 0.12);
  ctx.stroke();
  // 马身（大椭圆）
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(0, bodyY, H * 0.27, H * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  // 马首（小椭圆前伸 + 双耳）
  ctx.beginPath();
  ctx.ellipse(H * 0.28, bodyY - H * 0.07, H * 0.1, H * 0.055, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(H * 0.3, bodyY - H * 0.12);
  ctx.lineTo(H * 0.34, bodyY - H * 0.2);
  ctx.lineTo(H * 0.34, bodyY - H * 0.11);
  ctx.closePath(); ctx.fill();
  // 四蹄（walk 摆动两两错相）
  ctx.fillStyle = C.ink;
  const legs = [[-H * 0.18, 0], [-H * 0.1, 1], [H * 0.12, 1], [H * 0.2, 0]];
  for (const [lx, ph] of legs) {
    const swing = ph ? pz.limbSwing * 3 : -pz.limbSwing * 3;
    ctx.fillRect(lx + swing, bodyY + H * 0.1, H * 0.035, H * 0.09);
  }
  // 骑手（小身+头，位于马背）
  ctx.beginPath();
  ctx.moveTo(-H * 0.05, bodyY - H * 0.16);
  ctx.lineTo(H * 0.05, bodyY - H * 0.16);
  ctx.lineTo(H * 0.06, bodyY - H * 0.02);
  ctx.lineTo(-H * 0.06, bodyY - H * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(0, bodyY - H * 0.21, H * 0.055, 0, Math.PI * 2); ctx.fill();
  // 长枪（斜举）+ 朱砂红缨
  ctx.save();
  ctx.translate(H * 0.04, bodyY - H * 0.14);
  ctx.rotate(pz.weaponAngle * 0.3 - 0.45);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-H * 0.05, 0); ctx.lineTo(H * 0.3, 0); ctx.stroke();
  ctx.fillStyle = C.seal; // 红缨
  ctx.beginPath();
  ctx.moveTo(H * 0.3, 0);
  ctx.lineTo(H * 0.24, -H * 0.045);
  ctx.lineTo(H * 0.24, H * 0.045);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// 帅：大氅（宽梯形+下摆波浪）+ 冠 + 鎏金描边
function drawMarshal(ctx, C, H, pz) {
  const bodyTop = -H * 0.5, bodyBot = 0;
  // 大氅
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(-H * 0.1, bodyTop);
  ctx.lineTo(H * 0.1, bodyTop);
  ctx.quadraticCurveTo(H * 0.24, bodyBot * 0.5, H * 0.2 + pz.limbSwing, bodyBot);
  ctx.quadraticCurveTo(0, bodyBot + H * 0.03, -H * 0.2 + pz.limbSwing, bodyBot);
  ctx.quadraticCurveTo(-H * 0.24, bodyBot * 0.5, -H * 0.1, bodyTop);
  ctx.closePath();
  ctx.fill();
  // 鎏金描边（大氅外轮廓近似 = 左右轮廓弧线）
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-H * 0.1, bodyTop);
  ctx.quadraticCurveTo(-H * 0.24, bodyBot * 0.5, -H * 0.2 + pz.limbSwing, bodyBot);
  ctx.moveTo(H * 0.1, bodyTop);
  ctx.quadraticCurveTo(H * 0.24, bodyBot * 0.5, H * 0.2 + pz.limbSwing, bodyBot);
  ctx.stroke();
  // 头 + 冠（小矩形）
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(0, bodyTop - H * 0.07, H * 0.085, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-H * 0.05, bodyTop - H * 0.2, H * 0.1, H * 0.05);
  // 持剑（直垂）
  ctx.strokeStyle = C.inkMid;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(H * 0.14, bodyTop + H * 0.16); ctx.lineTo(H * 0.14, bodyBot - H * 0.06); ctx.stroke();
}

// ===== 赵云长枪叠加（青铜双环底牌由 Art.drawHeroToken 保留）=====
// ang：突刺方向角（朝命中敌人）；t：攻击态内秒（0-0.2 突出，0.2-0.4 回收）
export function drawHeroSpear(ctx, x, y, ang, t) {
  const C = art();
  const ext = Math.sin(Math.min(1, t / 0.2) * Math.PI) * 30; // 0→30→0 突刺
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  // 飞白拖尾（粒子由 battleFx 另发，这里画静态弧）
  ctx.strokeStyle = 'rgba(201,162,39,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 42, -0.5, 0.2);
  ctx.stroke();
  // 枪杆（鎏金）
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(54 + ext, 0);
  ctx.stroke();
  // 枪尖
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.moveTo(60 + ext, 0);
  ctx.lineTo(50 + ext, -3.5);
  ctx.lineTo(50 + ext, 3.5);
  ctx.closePath();
  ctx.fill();
  // 红缨
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  ctx.moveTo(50 + ext, 0);
  ctx.lineTo(44 + ext, -5);
  ctx.lineTo(44 + ext, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
