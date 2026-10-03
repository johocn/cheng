/**
 * characters45.js — 45° 视角部件化人物动画库
 * 三国塔防「七进七出」· 写实水墨风
 *
 * 原理：人物拆解为 阴影/腿/躯干/头/武器 部件，
 *       行走/攻击通过 phase (0~1) 参数驱动关节偏移，逐帧重绘。
 *       帧间一致性完美、零图片资源。
 */
(function (global) {
  'use strict';
  var C = {
    paper: '#e8dcc4', paperHi: '#f6efdd', paperDeep: '#d9c9a8',
    ink: '#1f1b16', inkMid: '#3a332a', inkSoft: '#5a5040',
    bronze: '#8b6914', bronzeLt: '#b8963e', gold: '#c9a227',
    seal: '#9e2a1e', jade: '#4a6b52', silver: '#cfd2ce'
  };
  var TAU = Math.PI * 2;

  function shadow(ctx, x, y, rx, ry, a) {
    ctx.fillStyle = 'rgba(31,27,22,' + (a || 0.32) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry || rx * 0.38, 0, 0, TAU);
    ctx.fill();
  }

  function capsule(ctx, x, y, w, h, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    var r = w / 2;
    ctx.moveTo(x - r, y - h / 2 + r);
    ctx.arcTo(x - r, y + h / 2, x, y + h / 2, r);
    ctx.arcTo(x + r, y + h / 2, x + r, y - h / 2 + r, r);
    ctx.arcTo(x + r, y - h / 2, x, y - h / 2, r);
    ctx.arcTo(x - r, y - h / 2, x - r, y + h / 2, r);
    ctx.closePath();
    ctx.fill();
  }

  // 头部：45° 俯视 — 头顶占比大，盔沿
  function head45(ctx, x, y, r, opts) {
    opts = opts || {};
    // 盔（墨底）
    ctx.fillStyle = opts.helmet || C.ink;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // 盔顶高光（45° 俯视看到头顶）
    ctx.fillStyle = opts.helmetHi || C.inkMid;
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.32, r * 0.72, r * 0.5, 0, 0, TAU);
    ctx.fill();
    // 盔沿（铜）
    ctx.strokeStyle = opts.rim || C.bronzeLt;
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    if (opts.knot) {
      // 盔缨
      ctx.strokeStyle = opts.knot;
      ctx.lineWidth = r * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.9);
      ctx.quadraticCurveTo(x + r * 0.3, y - r * 1.5, x - r * 0.1, y - r * 1.8);
      ctx.stroke();
    }
  }

  /**
   * 步兵（长矛兵）45° 行走
   * phase: 0~1 循环; moving: 是否移动
   */
  function drawSpearman45(ctx, x, y, s, phase, moving) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var sw = moving ? Math.sin(phase * TAU) : 0;      // 腿摆
    var bob = moving ? Math.abs(Math.sin(phase * TAU)) * 1.6 : Math.sin(phase * TAU) * 0.8;
    var top = -34 - bob;
    shadow(ctx, 0, 1, 12, 4.5);
    // 腿（前后摆 = 上下错位 + 透视缩短）
    capsule(ctx, -4.5, -6 + sw * 4, 5, 12 - Math.abs(sw) * 3, C.inkMid);
    capsule(ctx, 4.5, -6 - sw * 4, 5, 12 - Math.abs(sw) * 3, C.ink);
    // 躯干（墨袍）
    capsule(ctx, 0, top + 12, 15, 18, C.ink);
    // 袍摆开衩线（纸色细描）
    ctx.strokeStyle = 'rgba(232,220,196,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, top + 6); ctx.lineTo(0, top + 19); ctx.stroke();
    // 肩甲（铜）
    ctx.fillStyle = C.bronze;
    ctx.beginPath(); ctx.arc(-7.5, top + 6, 3.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(7.5, top + 6, 3.4, 0, TAU); ctx.fill();
    // 头
    head45(ctx, 0, top, 7.5, { knot: C.seal });
    // 长矛（右肩斜握，行走时轻微摆动）
    ctx.save();
    ctx.translate(9, top + 4);
    ctx.rotate(0.12 + sw * 0.05);
    ctx.strokeStyle = C.inkSoft;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-2, 26); ctx.lineTo(-2, -26); ctx.stroke();
    // 矛尖（纸色亮锋）
    ctx.fillStyle = C.paperHi;
    ctx.beginPath();
    ctx.moveTo(-2, -26); ctx.lineTo(-5, -18); ctx.lineTo(1, -18);
    ctx.closePath(); ctx.fill();
    // 红缨
    ctx.strokeStyle = C.seal; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-2, -17);
    ctx.quadraticCurveTo(3, -13, 1, -9); ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /**
   * 弓兵 45° — 侧向持弓，拉弦蓄势随 phase 微动
   */
  function drawArcher45(ctx, x, y, s, phase, moving) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var sw = moving ? Math.sin(phase * TAU) : 0;
    var bob = moving ? Math.abs(Math.sin(phase * TAU)) * 1.5 : 0;
    var top = -32 - bob;
    shadow(ctx, 0, 1, 11, 4.2);
    capsule(ctx, -4, -6 + sw * 4, 4.6, 11 - Math.abs(sw) * 3, C.inkMid);
    capsule(ctx, 4, -6 - sw * 4, 4.6, 11 - Math.abs(sw) * 3, C.ink);
    capsule(ctx, 0, top + 12, 13.5, 17, C.inkMid);   // 躯干略瘦
    ctx.fillStyle = C.bronze;
    ctx.beginPath(); ctx.arc(-6.5, top + 6, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6.5, top + 6, 3, 0, TAU); ctx.fill();
    head45(ctx, 0, top, 7, { rim: C.jade, knot: C.jade });
    // 背箭壶
    capsule(ctx, -9, top + 10, 4.5, 10, C.inkSoft);
    // 弓（左侧竖弓，弦随蓄势微缩）
    var draw = 2 + Math.sin(phase * TAU * 0.5) * 2;
    ctx.strokeStyle = C.inkSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-11, top + 10, 12, -1.15, 1.15);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(232,220,196,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-11 + 12 * Math.cos(-1.15), top + 10 + 12 * Math.sin(-1.15));
    ctx.lineTo(-11 - draw, top + 10);
    ctx.lineTo(-11 + 12 * Math.cos(1.15), top + 10 + 12 * Math.sin(1.15));
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 骑兵 45° — 战马四腿对侧摆，背上骑手
   */
  function drawCavalry45(ctx, x, y, s, phase, moving) {
    s = s || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var g = moving ? Math.sin(phase * TAU) : 0;       // 对侧步
    var bob = moving ? Math.abs(Math.cos(phase * TAU)) * 2 : 0;
    shadow(ctx, 0, 1, 17, 5.5);
    // 马腿（4条，对侧两两）
    var legY = -8, legW = 4, legH = 12;
    capsule(ctx, -11, legY + g * 3, legW, legH - Math.abs(g) * 3, C.inkMid);
    capsule(ctx, 11, legY - g * 3, legW, legH - Math.abs(g) * 3, C.inkMid);
    capsule(ctx, -6, legY - g * 3, legW, legH - Math.abs(g) * 3, C.ink);
    capsule(ctx, 6, legY + g * 3, legW, legH - Math.abs(g) * 3, C.ink);
    // 马身
    capsule(ctx, 0, -18 - bob, 30, 15, C.ink);
    // 马首（朝观者下方 = 迎面而来）
    var hy = -10 - bob;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.ellipse(0, hy + 6, 6.5, 8, 0, 0, TAU);
    ctx.fill();
    // 马鬃（铜细线）
    ctx.strokeStyle = C.bronzeLt; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4, hy - 1); ctx.lineTo(4, hy - 1); ctx.stroke();
    // 辔头
    ctx.strokeStyle = C.seal; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5, hy + 6); ctx.lineTo(5, hy + 6); ctx.stroke();
    // 骑手（缩小人形于马背上）
    var rt = -40 - bob;
    capsule(ctx, 0, rt + 11, 12, 13, C.inkMid);
    ctx.fillStyle = C.bronze;
    ctx.beginPath(); ctx.arc(-6, rt + 6, 2.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6, rt + 6, 2.8, 0, TAU); ctx.fill();
    head45(ctx, 0, rt, 6.5, { knot: C.gold });
    // 骑枪
    ctx.save();
    ctx.translate(7, rt + 4);
    ctx.rotate(0.1 + g * 0.04);
    ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -18); ctx.stroke();
    ctx.fillStyle = C.paperHi;
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(-3, -11); ctx.lineTo(3, -11);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /**
   * 精英·帅 45° — 步将放大版 + 披风 + 令旗
   */
  function drawElite45(ctx, x, y, s, phase, moving) {
    s = (s || 1) * 1.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var sw = moving ? Math.sin(phase * TAU) : 0;
    var bob = moving ? Math.abs(Math.sin(phase * TAU)) * 1.8 : 0;
    var top = -36 - bob;
    shadow(ctx, 0, 1.5, 13, 5, 0.4);
    // 披风（身后摆动）
    ctx.fillStyle = C.seal;
    ctx.beginPath();
    ctx.moveTo(-8, top + 5);
    ctx.quadraticCurveTo(-14 - sw * 3, top + 16, -9, top + 27);
    ctx.lineTo(9, top + 27);
    ctx.quadraticCurveTo(14 - sw * 3, top + 16, 8, top + 5);
    ctx.closePath();
    ctx.fill();
    capsule(ctx, -4.5, -6 + sw * 4, 5, 12 - Math.abs(sw) * 3, C.inkMid);
    capsule(ctx, 4.5, -6 - sw * 4, 5, 12 - Math.abs(sw) * 3, C.ink);
    capsule(ctx, 0, top + 12, 16, 19, C.ink);
    // 铜肩甲 + 金缘
    ctx.fillStyle = C.bronze;
    ctx.beginPath(); ctx.arc(-8, top + 6, 3.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8, top + 6, 3.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-8, top + 6, 4.6, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(8, top + 6, 4.6, 0, TAU); ctx.stroke();
    head45(ctx, 0, top, 8, { helmet: C.ink, helmetHi: C.inkMid, rim: C.gold, knot: C.gold });
    // 令旗（左手）
    ctx.strokeStyle = C.inkSoft; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-10, top + 8); ctx.lineTo(-12, top - 22); ctx.stroke();
    var flagW = 10 + sw * 1.5;
    ctx.fillStyle = C.seal;
    ctx.beginPath();
    ctx.moveTo(-12, top - 22);
    ctx.lineTo(-12 + flagW, top - 19);
    ctx.lineTo(-12, top - 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 赵云 45° — 白马银枪（本作主角，居中阵地）
   * action: 'idle' | 'attack' | 'ult'
   */
  function drawZhaoyun45(ctx, x, y, s, phase, action) {
    s = (s || 1) * 1.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var atk = 0;
    if (action === 'attack') atk = Math.sin(Math.min(phase, 1) * Math.PI);       // 0→1→0 突刺
    else if (action === 'ult') atk = 1;
    var idle = Math.sin(phase * TAU) * 0.8;
    var top = -38 + idle;
    shadow(ctx, 0, 1.5, 13, 5, 0.38);
    // 腿（白甲胫）
    capsule(ctx, -4.5, -6, 5, 12, C.silver);
    capsule(ctx, 4.5, -6, 5, 12, '#b9bdb9');
    // 躯干（白银甲）
    capsule(ctx, 0, top + 12, 16, 19, C.paperHi);
    // 甲片纹（银线）
    ctx.strokeStyle = 'rgba(120,126,120,0.5)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-7, top + 8 + i * 4.5);
      ctx.lineTo(7, top + 8 + i * 4.5);
      ctx.stroke();
    }
    // 护肩（银+金缘）
    ctx.fillStyle = C.silver;
    ctx.beginPath(); ctx.arc(-8.5, top + 6, 4.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(8.5, top + 6, 4.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = C.gold; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(-8.5, top + 6, 5, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(8.5, top + 6, 5, 0, TAU); ctx.stroke();
    // 披风（朱砂，攻击时后扬）
    ctx.fillStyle = C.seal;
    ctx.beginPath();
    ctx.moveTo(-8, top + 5);
    ctx.quadraticCurveTo(-15 - atk * 5, top + 15, -10 - atk * 3, top + 27);
    ctx.lineTo(10 + atk * 3, top + 27);
    ctx.quadraticCurveTo(15 + atk * 5, top + 15, 8, top + 5);
    ctx.closePath();
    ctx.fill();
    // 头（白银盔 + 红缨）
    head45(ctx, 0, top, 8, { helmet: C.silver, helmetHi: '#e2e5e0', rim: C.gold, knot: C.seal });
    // 龙胆亮银枪：攻击时向前（下）突刺
    ctx.save();
    var thrust = atk * 10;
    ctx.translate(9 - thrust * 0.4, top + 6 + thrust * 0.55);
    ctx.rotate(0.45 - atk * 0.3);
    ctx.strokeStyle = C.silver;
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, 28); ctx.lineTo(0, -30); ctx.stroke();
    // 枪尖
    ctx.fillStyle = C.paperHi;
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(-4, -21); ctx.lineTo(4, -21);
    ctx.closePath(); ctx.fill();
    // 红缨火苗
    ctx.strokeStyle = C.seal; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(4 - atk * 6, -14, 2 - atk * 4, -8); ctx.stroke();
    ctx.restore();
    // 大招蓄势光环
    if (action === 'ult') {
      var gr = 30 + Math.sin(phase * TAU * 2) * 3;
      ctx.strokeStyle = 'rgba(201,162,39,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, gr, gr * 0.4, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  global.Characters45 = {
    C: C,
    drawSpearman45: drawSpearman45,
    drawArcher45: drawArcher45,
    drawCavalry45: drawCavalry45,
    drawElite45: drawElite45,
    drawZhaoyun45: drawZhaoyun45
  };
})(typeof window !== 'undefined' ? window : globalThis);
