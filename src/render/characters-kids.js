/**
 * characters-kids.js — 45° 视角儿童绘画风格人物动画库
 * 三国塔防「七进七出」· 儿童蜡笔风（粗轮廓 + 明亮色 + Q版大头）
 *
 * 与 characters45.js 同构（部件化 + phase 驱动），可共存做双风格切换。
 * 儿童风三要素：粗轮廓线（OUTLINE）/ 明亮蜡笔色板（K）/ Q版大头比例
 */
(function (global) {
  'use strict';

  // ---------- 儿童风色板（明亮蜡笔色） ----------
  var K = {
    outline: '#4a3728',      // 深棕轮廓线（比纯黑柔和，像蜡笔勾边）
    skin: '#ffdfb0',
    paper: '#fdf6e3', paperDeep: '#f2e4c2',
    lane: 'rgba(140,120,90,0.5)',
    red: '#e84b3c', redDeep: '#c93a2c',       // 帅/披风
    blue: '#3f8fd2', blueDeep: '#2f74b3',     // 步兵袍
    orange: '#f5952e', orangeDeep: '#d97c1a', // 弓兵袍
    purple: '#8e6fd8', purpleDeep: '#7458c2', // 战马
    green: '#57b86a', greenDeep: '#3f9e52',   // 弓/旗
    yellow: '#f7c948', yellowDeep: '#e0ac25', // 金饰
    white: '#ffffff', silverBlue: '#dcecf7',  // 赵云白银甲
    blush: 'rgba(255,140,120,0.55)'
  };
  var OUT = 2.6;             // 标准轮廓宽度（清晰度核心参数）
  var OUT_BIG = 3.2;         // 大部件轮廓
  var TAU = Math.PI * 2;

  // 通用：描边形状（先填色后描粗边）
  function outlined(ctx, fill, lw, pathFn) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    pathFn();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = K.outline;
    ctx.lineWidth = lw || OUT;
    ctx.stroke();
  }

  function circle(x, y, r) {
    return function () {
      ctx2.beginPath();
      ctx2.arc(x, y, r, 0, TAU);
    };
  }

  // 当前 ctx 引用（draw 函数入口统一 setCtx）
  var ctx2 = null;
  function setCtx(c) { ctx2 = c; }

  function shadow(ctx, x, y, rx, ry) {
    ctx.fillStyle = 'rgba(74,55,40,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry || rx * 0.38, 0, 0, TAU);
    ctx.fill();
  }

  function capsulePath(x, y, w, h) {
    var r = w / 2;
    ctx2.beginPath();
    ctx2.moveTo(x - r, y - h / 2 + r);
    ctx2.arcTo(x - r, y + h / 2, x, y + h / 2, r);
    ctx2.arcTo(x + r, y + h / 2, x + r, y - h / 2 + r, r);
    ctx2.arcTo(x + r, y - h / 2, x, y - h / 2, r);
    ctx2.arcTo(x - r, y - h / 2, x - r, y + h / 2, r);
    ctx2.closePath();
  }

  // Q版大头：脸 + 简单五官 + 头盔
  function headKids(ctx, x, y, r, opts) {
    opts = opts || {};
    setCtx(ctx);
    // 脸
    outlined(ctx, K.skin, OUT, circle(x, y, r));
    // 头盔（扣在头顶的半圆帽）
    outlined(ctx, opts.helmet || K.blue, OUT, function () {
      ctx2.beginPath();
      ctx2.arc(x, y - r * 0.18, r * 0.98, Math.PI * 1.02, Math.PI * 1.98);
      ctx2.closePath();
    });
    // 盔沿
    outlined(ctx, opts.rim || K.yellow, OUT * 0.85, function () {
      capsulePath(x, y - r * 0.12, r * 2.1, r * 0.34);
    });
    // 眼睛（两点）+ 微笑
    ctx2.fillStyle = K.outline;
    ctx2.beginPath();
    ctx2.arc(x - r * 0.34, y + r * 0.16, r * 0.13, 0, TAU);
    ctx2.fill();
    ctx2.beginPath();
    ctx2.arc(x + r * 0.34, y + r * 0.16, r * 0.13, 0, TAU);
    ctx2.fill();
    // 腮红
    ctx2.fillStyle = K.blush;
    ctx2.beginPath();
    ctx2.ellipse(x - r * 0.58, y + r * 0.42, r * 0.2, r * 0.13, 0, 0, TAU);
    ctx2.ellipse(x + r * 0.58, y + r * 0.42, r * 0.2, r * 0.13, 0, 0, TAU);
    ctx2.fill();
    // 微笑
    ctx2.strokeStyle = K.outline;
    ctx2.lineWidth = OUT * 0.7;
    ctx2.beginPath();
    ctx2.arc(x, y + r * 0.3, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx2.stroke();
    // 盔缨（小绒球）
    if (opts.pom) {
      outlined(ctx, opts.pom, OUT * 0.9, circle(x, y - r * 1.05, r * 0.28));
    }
  }

  /**
   * 步兵（儿童版）— 蓝袍小兵持红缨矛
   */
  function drawSpearmanKids(ctx, x, y, s, phase, moving) {
    s = (s || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    setCtx(ctx);
    var sw = moving ? Math.sin(phase * TAU) : 0;
    var bob = moving ? Math.abs(Math.sin(phase * TAU)) * 1.8 : 0;
    var base = -bob;
    shadow(ctx, 0, 1, 12, 4.5);
    // 腿（短粗，摆动）
    outlined(ctx, K.blueDeep, OUT, function () { capsulePath(-5, -5 + sw * 4, 6, 11 - Math.abs(sw) * 3); });
    outlined(ctx, K.blueDeep, OUT, function () { capsulePath(5, -5 - sw * 4, 6, 11 - Math.abs(sw) * 3); });
    // 躯干（蓝袍 + 腰带）
    outlined(ctx, K.blue, OUT_BIG, function () { capsulePath(0, base - 15, 17, 19); });
    outlined(ctx, K.yellow, OUT * 0.8, function () { capsulePath(0, base - 9, 17.5, 4); });
    // 头（大头 r=10）
    headKids(ctx, 0, base - 34, 10, { helmet: K.blueDeep, pom: K.red });
    // 长矛
    ctx.save();
    ctx.translate(11, base - 14);
    ctx.rotate(0.1 + sw * 0.05);
    outlined(ctx, '#a8763e', OUT * 0.9, function () { capsulePath(0, 0, 3, 54); });
    outlined(ctx, K.paper, OUT * 0.8, function () {
      ctx2.beginPath();
      ctx2.moveTo(0, -27); ctx2.lineTo(-5, -17); ctx2.lineTo(5, -17);
      ctx2.closePath();
    });
    outlined(ctx, K.red, OUT * 0.7, function () { capsulePath(0, -14, 6, 6); });
    ctx.restore();
    ctx.restore();
  }

  /**
   * 弓兵（儿童版）— 橙袍小兵抱绿弓
   */
  function drawArcherKids(ctx, x, y, s, phase, moving) {
    s = (s || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    setCtx(ctx);
    var sw = moving ? Math.sin(phase * TAU) : 0;
    var bob = moving ? Math.abs(Math.sin(phase * TAU)) * 1.6 : 0;
    var base = -bob;
    shadow(ctx, 0, 1, 11, 4.2);
    outlined(ctx, K.orangeDeep, OUT, function () { capsulePath(-4.5, -5 + sw * 4, 5.5, 10 - Math.abs(sw) * 3); });
    outlined(ctx, K.orangeDeep, OUT, function () { capsulePath(4.5, -5 - sw * 4, 5.5, 10 - Math.abs(sw) * 3); });
    outlined(ctx, K.orange, OUT_BIG, function () { capsulePath(0, base - 14, 15.5, 17); });
    outlined(ctx, K.yellow, OUT * 0.8, function () { capsulePath(0, base - 8.5, 16, 3.6); });
    headKids(ctx, 0, base - 32, 9.5, { helmet: K.orangeDeep, rim: K.green, pom: K.green });
    // 绿弓（左侧）
    ctx.save();
    ctx.translate(-11, base - 13);
    ctx.rotate(-0.08 + sw * 0.04);
    ctx.strokeStyle = K.outline;
    ctx.lineWidth = OUT_BIG + 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, -1.2, 1.2);
    ctx.stroke();
    ctx.strokeStyle = K.green;
    ctx.lineWidth = OUT_BIG;
    ctx.stroke();
    // 弦
    ctx.strokeStyle = K.outline;
    ctx.lineWidth = 1.4;
    var pull = 2 + Math.sin(phase * TAU * 0.5) * 2;
    ctx.beginPath();
    ctx.moveTo(14 * Math.cos(-1.2), 14 * Math.sin(-1.2));
    ctx.lineTo(-pull, 0);
    ctx.lineTo(14 * Math.cos(1.2), 14 * Math.sin(1.2));
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /**
   * 骑兵（儿童版）— 紫色小马 + 红袍骑手
   */
  function drawCavalryKids(ctx, x, y, s, phase, moving) {
    s = (s || 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    setCtx(ctx);
    var g = moving ? Math.sin(phase * TAU) : 0;
    var bob = moving ? Math.abs(Math.cos(phase * TAU)) * 2 : 0;
    shadow(ctx, 0, 1.5, 18, 6);
    // 马腿（四条短粗腿，对侧步）
    outlined(ctx, K.purpleDeep, OUT, function () { capsulePath(-12, -8 + g * 3, 5.5, 13 - Math.abs(g) * 3); });
    outlined(ctx, K.purpleDeep, OUT, function () { capsulePath(12, -8 - g * 3, 5.5, 13 - Math.abs(g) * 3); });
    outlined(ctx, K.purple, OUT, function () { capsulePath(-6, -8 - g * 3, 5.5, 13 - Math.abs(g) * 3); });
    outlined(ctx, K.purple, OUT, function () { capsulePath(6, -8 + g * 3, 5.5, 13 - Math.abs(g) * 3); });
    // 马身
    outlined(ctx, K.purple, OUT_BIG, function () { capsulePath(0, -20 - bob, 34, 17); });
    // 马头（迎面下方）
    var hy = -11 - bob;
    outlined(ctx, K.purple, OUT_BIG, function () {
      ctx2.beginPath();
      ctx2.ellipse(0, hy + 7, 7.5, 9, 0, 0, TAU);
    });
    // 马眼睛（两点白+黑）
    ctx2.fillStyle = K.white;
    ctx2.beginPath(); ctx2.arc(-3, hy + 4, 2.2, 0, TAU); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(3, hy + 4, 2.2, 0, TAU); ctx2.fill();
    ctx2.fillStyle = K.outline;
    ctx2.beginPath(); ctx2.arc(-3, hy + 4.5, 1.1, 0, TAU); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(3, hy + 4.5, 1.1, 0, TAU); ctx2.fill();
    // 鬃毛（黄）
    outlined(ctx, K.yellow, OUT * 0.8, function () { capsulePath(0, hy - 4, 12, 4); });
    // 骑手（红袍小人）
    var rt = -46 - bob;
    outlined(ctx, K.redDeep, OUT, function () { capsulePath(-4.5, -8 + g * 2, 5, 9); });
    outlined(ctx, K.redDeep, OUT, function () { capsulePath(4.5, -8 - g * 2, 5, 9); });
    outlined(ctx, K.red, OUT_BIG, function () { capsulePath(0, rt + 12, 14, 15); });
    headKids(ctx, 0, rt - 8, 9, { helmet: K.redDeep, pom: K.yellow });
    // 小骑枪
    ctx.save();
    ctx.translate(9, rt + 6);
    ctx.rotate(0.12 + g * 0.04);
    outlined(ctx, '#a8763e', OUT * 0.85, function () { capsulePath(0, 2, 2.6, 40); });
    outlined(ctx, K.paper, OUT * 0.75, function () {
      ctx2.beginPath();
      ctx2.moveTo(0, -18); ctx2.lineTo(-4, -10); ctx2.lineTo(4, -10);
      ctx2.closePath();
    });
    ctx.restore();
    ctx.restore();
  }

  /**
   * 精英·帅（儿童版）— 红袍大将 + 披风 + 令旗
   */
  function drawEliteKids(ctx, x, y, s, phase, moving) {
    s = (s || 1) * 1.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    setCtx(ctx);
    var sw = moving ? Math.sin(phase * TAU) : 0;
    var bob = moving ? Math.abs(Math.sin(phase * TAU)) * 1.8 : 0;
    var base = -bob;
    shadow(ctx, 0, 1.5, 13, 5);
    // 披风（身后大摆）
    outlined(ctx, K.red, OUT_BIG, function () {
      ctx2.beginPath();
      ctx2.moveTo(-9, base - 30);
      ctx2.quadraticCurveTo(-16 - sw * 3, base - 16, -10, base - 4);
      ctx2.lineTo(10, base - 4);
      ctx2.quadraticCurveTo(16 - sw * 3, base - 16, 9, base - 30);
      ctx2.closePath();
    });
    outlined(ctx, K.redDeep, OUT, function () { capsulePath(-5, -5 + sw * 4, 6, 11 - Math.abs(sw) * 3); });
    outlined(ctx, K.redDeep, OUT, function () { capsulePath(5, -5 - sw * 4, 6, 11 - Math.abs(sw) * 3); });
    outlined(ctx, K.red, OUT_BIG, function () { capsulePath(0, base - 16, 18, 20); });
    outlined(ctx, K.yellow, OUT * 0.85, function () { capsulePath(0, base - 9.5, 18.5, 4.4); });
    headKids(ctx, 0, base - 36, 10.5, { helmet: K.redDeep, rim: K.yellow, pom: K.yellow });
    // 令旗
    ctx.save();
    ctx.translate(-12, base - 24);
    outlined(ctx, '#a8763e', OUT * 0.85, function () { capsulePath(0, 0, 2.6, 44); });
    var fw = 13 + sw * 2;
    outlined(ctx, K.green, OUT, function () {
      ctx2.beginPath();
      ctx2.moveTo(1, -21);
      ctx2.quadraticCurveTo(1 + fw * 0.6, -19 + sw, 1 + fw, -17);
      ctx2.lineTo(1, -11);
      ctx2.closePath();
    });
    ctx.restore();
    ctx.restore();
  }

  /**
   * 赵云（儿童版）— 白甲小将 + 红披风 + 亮银枪
   * action: 'idle' | 'attack' | 'ult'
   */
  function drawZhaoyunKids(ctx, x, y, s, phase, action) {
    s = (s || 1) * 1.15;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    setCtx(ctx);
    var atk = 0;
    if (action === 'attack') atk = Math.sin(Math.min(phase, 1) * Math.PI);
    else if (action === 'ult') atk = 1;
    var idle = Math.sin(phase * TAU) * 0.8;
    var base = idle;
    shadow(ctx, 0, 1.5, 13, 5);
    // 披风（红，攻击后扬）
    outlined(ctx, K.red, OUT_BIG, function () {
      ctx2.beginPath();
      ctx2.moveTo(-9, base - 32);
      ctx2.quadraticCurveTo(-17 - atk * 5, base - 18, -11 - atk * 3, base - 4);
      ctx2.lineTo(11 + atk * 3, base - 4);
      ctx2.quadraticCurveTo(17 + atk * 5, base - 18, 9, base - 32);
      ctx2.closePath();
    });
    // 腿（白甲）
    outlined(ctx, K.silverBlue, OUT, function () { capsulePath(-5, -5, 6, 11); });
    outlined(ctx, '#c4d8e8', OUT, function () { capsulePath(5, -5, 6, 11); });
    // 躯干（白甲 + 金腰带）
    outlined(ctx, K.white, OUT_BIG, function () { capsulePath(0, base - 16, 18, 20); });
    outlined(ctx, K.yellow, OUT * 0.85, function () { capsulePath(0, base - 9.5, 18.5, 4.4); });
    // 胸前「赵」字小徽
    ctx.save();
    ctx.fillStyle = K.red;
    ctx.font = 'bold 7px "KaiTi","STKaiti",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('赵', 0, base - 14);
    ctx.restore();
    // 头（白盔金沿 + 红缨球）
    headKids(ctx, 0, base - 36, 10.5, { helmet: K.silverBlue, rim: K.yellow, pom: K.red });
    // 亮银枪：突刺
    ctx.save();
    var thrust = atk * 11;
    ctx.translate(10 - thrust * 0.4, base - 16 + thrust * 0.5);
    ctx.rotate(0.4 - atk * 0.3);
    outlined(ctx, K.silverBlue, OUT * 0.9, function () { capsulePath(0, 0, 3, 58); });
    outlined(ctx, K.white, OUT * 0.8, function () {
      ctx2.beginPath();
      ctx2.moveTo(0, -29); ctx2.lineTo(-5, -19); ctx2.lineTo(5, -19);
      ctx2.closePath();
    });
    outlined(ctx, K.red, OUT * 0.7, function () { capsulePath(0, -16, 6.5, 6); });
    ctx.restore();
    // 大招蓄势光环（黄圈）
    if (action === 'ult') {
      var gr = 32 + Math.sin(phase * TAU * 2) * 3;
      ctx.strokeStyle = K.yellow;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.ellipse(0, 0, gr, gr * 0.4, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  global.CharactersKids = {
    K: K, OUT: OUT,
    drawSpearmanKids: drawSpearmanKids,
    drawArcherKids: drawArcherKids,
    drawCavalryKids: drawCavalryKids,
    drawEliteKids: drawEliteKids,
    drawZhaoyunKids: drawZhaoyunKids
  };
})(typeof window !== 'undefined' ? window : globalThis);
