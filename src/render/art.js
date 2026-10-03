/**
 * art.js — V3 写实水墨风程序化素材库
 * 三国塔防「七进七出」· 对标三国志战略版视觉体系
 *
 * 原则：
 *  - 全部 Canvas 2D 程序化绘制，零图片资源（适配微信小游戏 ≤4MB 包体）
 *  - 纯函数式：只操作传入的 ctx，不持有全局状态
 *  - 坐标以调用方传入为准，函数内不假设画布尺寸
 */
(function (global) {
  'use strict';

  // ---------- 色板（V3 视觉规范） ----------
  var C = {
    paper: '#e8dcc4', paperHi: '#f2e8d2', paperDeep: '#d9c9a8', paperShadow: '#c9b690',
    ink: '#1f1b16', inkMid: '#3a332a', inkSoft: '#5a5040',
    bronze: '#8b6914', bronzeLt: '#b8963e', gold: '#c9a227',
    seal: '#9e2a1e', sealHi: '#b23a28', jade: '#4a6b52',
    laneInk: 'rgba(90,80,64,0.55)'
  };

  var FONT = '"KaiTi","STKaiti","楷体","SimSun",serif';

  function font(size, weight) {
    return (weight ? weight + ' ' : '') + size + 'px ' + FONT;
  }

  // 通用：圆形底 + 径向渐变
  function circleBase(ctx, x, y, r, inner, outer) {
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.15, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 通用：底部椭圆墨影
  function inkShadow(ctx, x, y, rx, ry) {
    ctx.save();
    ctx.fillStyle = 'rgba(31,27,22,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 通用：朱砂印章（旋转小方印）
  // text: 印文（1-2 字）; variant: 'seal'|'gold'|'jade'|'ink'
  function sealStamp(ctx, x, y, size, text, variant, rot) {
    variant = variant || 'seal';
    rot = rot === undefined ? 6 : rot;
    var bg = { seal: C.seal, gold: C.gold, jade: C.jade, ink: C.inkSoft }[variant] || C.seal;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * Math.PI / 180);
    ctx.fillStyle = bg;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = 'rgba(244,236,216,0.6)';
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.strokeRect(-size / 2 + size * 0.12, -size / 2 + size * 0.12, size * 0.76, size * 0.76);
    ctx.fillStyle = '#f4ecd8';
    ctx.font = font(size * 0.52, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, size * 0.04);
    ctx.restore();
  }

  // ---------- 敌军单位（兵/骑/弓/帅） ----------
  // type: 'bing'|'qi'|'gong'|'shuai'; hpRatio: 0~1
  var ENEMY_TEXT = { bing: '兵', qi: '骑', gong: '弓', shuai: '帅' };

  function drawEnemyToken(ctx, x, y, r, type, hpRatio) {
    type = type || 'bing';
    var elite = type === 'shuai';
    var rr = elite ? r * 1.12 : r;
    inkShadow(ctx, x, y + rr * 1.12, rr * 0.62, rr * 0.2);
    // 墨底圆牌
    circleBase(ctx, x, y, rr, C.inkMid, C.ink);
    // 描边：普通=青铜细边，精英=鎏金双辉
    if (elite) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(201,162,39,0.45)';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.arc(x, y, rr * 1.16, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = C.bronzeLt;
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
    }
    // 楷体单字
    ctx.fillStyle = C.paper;
    ctx.font = font(rr * 0.95, elite ? 'bold' : '');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ENEMY_TEXT[type], x, y + rr * 0.06);
    // 血条（朱砂）
    if (hpRatio !== undefined && hpRatio < 1) {
      var bw = rr * 1.5, bh = Math.max(3, r * 0.16);
      var bx = x - bw / 2, by = y - rr * 1.28;
      ctx.fillStyle = 'rgba(31,27,22,0.55)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = C.seal;
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, hpRatio)), bh);
    }
  }

  // ---------- 英雄赵云 ----------
  function drawHeroToken(ctx, x, y, r, hpRatio) {
    // 鎏金光晕
    var glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.7);
    glow.addColorStop(0, 'rgba(201,162,39,0.4)');
    glow.addColorStop(1, 'rgba(201,162,39,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, Math.PI * 2); ctx.fill();
    inkShadow(ctx, x, y + r * 1.15, r * 0.66, r * 0.2);
    // 宣纸底
    circleBase(ctx, x, y, r, '#f6efdd', C.paperDeep);
    // 青铜双环（double border 效果）
    ctx.strokeStyle = C.bronze;
    ctx.lineWidth = r * 0.11;
    ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.bronzeLt;
    ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    // 外圈墨环
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = r * 0.09;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    // 墨色「云」
    ctx.fillStyle = C.ink;
    ctx.font = font(r * 0.92, 'bold');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('云', x, y + r * 0.06);
    // 朱砂「赵」小印
    sealStamp(ctx, x + r * 0.78, y + r * 0.78, r * 0.42, '赵', 'seal', 8);
    // 血条（鎏金）
    if (hpRatio !== undefined) {
      var bw = r * 2.06, bh = Math.max(4, r * 0.18);
      var bx = x - bw / 2, by = y - r * 1.34;
      ctx.fillStyle = 'rgba(31,27,22,0.55)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = C.gold;
      ctx.fillRect(bx, by, bw * Math.max(0, Math.min(1, hpRatio)), bh);
    }
  }

  // ---------- 锦囊 ----------
  // type: 'qing'|'xuan'|'bai'|'zhu'|'ji'
  var BROCADE = {
    qing: { t: '青', label: '青龙' }, xuan: { t: '玄', label: '玄武' },
    bai: { t: '白', label: '白虎' }, zhu: { t: '朱', label: '朱雀' },
    ji: { t: '计', label: '计策' }
  };

  // 空槽 / 填充槽；mergeReady: 可三合一朱砂脉冲
  function drawBrocadeSlot(ctx, x, y, size, type, mergeReady) {
    var r = size * 0.12;
    ctx.save();
    if (type) {
      // 填充态：宣纸底 + 墨字 + 青铜边
      var g = ctx.createLinearGradient(x, y - size / 2, x, y + size / 2);
      g.addColorStop(0, C.paperHi); g.addColorStop(1, C.paperDeep);
      roundRect(ctx, x - size / 2, y - size / 2, size, size, r);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = mergeReady ? C.seal : C.bronzeLt;
      ctx.lineWidth = size * (mergeReady ? 0.09 : 0.055);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.font = font(size * 0.52, 'bold');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(BROCADE[type].t, x, y + size * 0.03);
      if (mergeReady) {
        ctx.save();
        ctx.shadowColor = 'rgba(158,42,30,0.75)';
        ctx.shadowBlur = size * 0.3;
        roundRect(ctx, x - size / 2, y - size / 2, size, size, r);
        ctx.strokeStyle = C.seal; ctx.stroke();
        ctx.restore();
      }
    } else {
      roundRect(ctx, x - size / 2, y - size / 2, size, size, r);
      ctx.fillStyle = 'rgba(232,220,196,0.07)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(184,150,62,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 锦囊大图标（卡面用）：宣纸圆牌 + 单字 + 底部小字名
  function drawBrocadeIcon(ctx, x, y, r, type) {
    var b = BROCADE[type] || BROCADE.qing;
    inkShadow(ctx, x, y + r * 1.08, r * 0.6, r * 0.18);
    circleBase(ctx, x, y, r, C.paperHi, C.paperShadow);
    ctx.strokeStyle = C.bronze; ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath(); ctx.arc(x, y, r * 0.92, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.bronzeLt; ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = font(r * 0.78, 'bold');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.t, x, y - r * 0.06);
    ctx.font = font(r * 0.26);
    ctx.fillStyle = C.inkSoft;
    ctx.fillText(b.label, x, y + r * 0.5);
  }

  // ---------- UI：面板 / 按钮 ----------
  // 羊皮纸面板 + 古铜三层描边（border + inset paper + inset bronze-lt）
  function drawPanel(ctx, x, y, w, h, selected) {
    var r = Math.min(8, h * 0.14);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, selected ? '#f6eeda' : C.paperHi);
    g.addColorStop(1, C.paperDeep);
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = g; ctx.fill();
    var bcol = selected ? C.seal : C.bronze;
    ctx.strokeStyle = bcol; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = C.paper; ctx.lineWidth = 3;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(2, r - 2)); ctx.stroke();
    ctx.strokeStyle = selected ? C.seal : C.bronzeLt; ctx.lineWidth = 1.2;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(1, r - 4)); ctx.stroke();
  }

  // 墨底按钮（普通操作）
  function drawInkButton(ctx, x, y, w, h, label) {
    var r = Math.min(6, h * 0.18);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, C.inkMid); g.addColorStop(1, C.ink);
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = C.bronzeLt; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = C.paper;
    ctx.font = font(Math.min(h * 0.42, 16));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 宽字距
    drawSpacedText(ctx, label, x + w / 2, y + h / 2 + 1, Math.min(h * 0.42, 16) * 0.35);
  }

  // 朱砂印章大招按钮；charges: 剩余次数（数字→中文），ready: false 转墨色
  function drawUltButton(ctx, x, y, w, h, label, charges, ready) {
    var r = Math.min(6, h * 0.18);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    if (ready) { g.addColorStop(0, C.sealHi); g.addColorStop(1, C.seal); }
    else { g.addColorStop(0, C.inkMid); g.addColorStop(1, C.ink); }
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = ready ? C.gold : C.bronzeLt; ctx.lineWidth = 1.4; ctx.stroke();
    // 内嵌宣纸描边
    ctx.strokeStyle = 'rgba(244,236,216,0.25)'; ctx.lineWidth = 1;
    roundRect(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 2)); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var fs = Math.min(h * 0.44, 18);
    ctx.fillStyle = ready ? '#f4ecd8' : 'rgba(232,220,196,0.55)';
    ctx.font = font(fs, 'bold');
    var labelCx = x + w / 2;
    if (charges !== undefined && charges > 0) {
      // 主文左移，右侧留小印
      drawSpacedText(ctx, label, x + w / 2 - fs * 0.5, y + h / 2 + 1, fs * 0.3);
      var sealSize = fs * 1.05;
      var sx = x + w - sealSize * 1.1, sy = y + h / 2;
      ctx.fillStyle = '#f4ecd8';
      roundRect(ctx, sx - sealSize / 2, sy - sealSize / 2, sealSize, sealSize, 2);
      ctx.fill();
      ctx.fillStyle = C.seal;
      ctx.font = font(sealSize * 0.6, 'bold');
      ctx.fillText(cnNum(charges), sx, sy + 1);
    } else {
      drawSpacedText(ctx, label, x + w / 2, y + h / 2 + 1, fs * 0.3);
    }
  }

  // HUD 印章牌：variant 'ink'|'seal'
  function drawHudPill(ctx, x, y, w, h, text, variant) {
    var r = Math.min(4, h * 0.24);
    var g = ctx.createLinearGradient(x, y, x, y + h);
    if (variant === 'seal') { g.addColorStop(0, '#a83526'); g.addColorStop(1, C.seal); }
    else { g.addColorStop(0, C.inkMid); g.addColorStop(1, C.ink); }
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = variant === 'seal' ? C.gold : C.bronzeLt;
    ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(232,220,196,0.12)'; ctx.lineWidth = 1;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(1, r - 1)); ctx.stroke();
    ctx.fillStyle = C.paper;
    ctx.font = font(Math.min(h * 0.46, 13));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  }

  // ---------- 战场背景（水墨远山 + 宣纸 + 雾带） ----------
  function drawBattleBackdrop(ctx, x, y, w, h) {
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#efe5cd'); g.addColorStop(0.55, C.paper); g.addColorStop(1, C.paperDeep);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // 三层远山
    mountain(ctx, x + w * 0.18, y + h * 0.34, w * 0.5, h * 0.22, 'rgba(58,51,42,0.28)');
    mountain(ctx, x + w * 0.82, y + h * 0.3, w * 0.6, h * 0.28, 'rgba(58,51,42,0.18)');
    mountain(ctx, x + w * 0.5, y + h * 0.42, w * 0.42, h * 0.17, 'rgba(58,51,42,0.12)');
    // 雾带
    var fog = ctx.createLinearGradient(x, y + h * 0.42, x, y + h * 0.62);
    fog.addColorStop(0, 'rgba(232,220,196,0)');
    fog.addColorStop(1, C.paper);
    ctx.fillStyle = fog;
    ctx.fillRect(x, y + h * 0.42, w, h * 0.2);
  }

  function mountain(ctx, cx, baseY, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, baseY);
    ctx.quadraticCurveTo(cx - w * 0.22, baseY - h, cx, baseY - h * 0.55);
    ctx.quadraticCurveTo(cx + w * 0.2, baseY - h * 1.1, cx + w / 2, baseY);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- 技能卡（卷轴羊皮纸三选一） ----------
  // opt: { icon:'锋', name:'会心一击', desc:'两成五概率倍伤', rarity:'r1'|'r2'|'r3', rarityText:'凡品' }
  function drawSkillCard(ctx, x, y, w, h, opt, selected) {
    drawPanel(ctx, x, y, w, h, selected);
    var cx = x + h * 0.52, cy = y + h / 2, cr = h * 0.32;
    // 图标圆牌
    circleBase(ctx, cx, cy, cr, '#f6efdd', C.paperShadow);
    ctx.strokeStyle = C.bronze; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, cr * 0.88, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = font(cr * 0.9, 'bold');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opt.icon, cx, cy + 1);
    // 文案
    var tx = cx + cr + h * 0.24;
    var maxW = w - (tx - x) - h * 0.5;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = font(h * 0.26, 'bold');
    ctx.fillText(opt.name, tx, y + h * 0.36);
    ctx.fillStyle = C.inkSoft;
    ctx.font = font(h * 0.2);
    ctx.fillText(truncate(ctx, opt.desc, maxW), tx, y + h * 0.66);
    // 品级印章
    var rarVar = { r1: 'ink', r2: 'jade', r3: 'seal' }[opt.rarity] || 'ink';
    sealStamp(ctx, x + w - h * 0.3, y + h / 2, h * 0.42, opt.rarityText, rarVar, 6);
  }

  // ---------- 武将立绘位（楷体单字 + 品级框） ----------
  // quality: 'ur'|'ssr'|'sr'|'r'
  var QUALITY = {
    ur: { inner: '#f0e2bd', outer: '#caa64a', ring: C.seal, text: C.ink, label: '神品', labelCol: '#e8c96a' },
    ssr: { inner: '#4e4436', outer: '#2e2820', ring: C.gold, text: C.gold, label: '上品', labelCol: C.gold },
    sr: { inner: '#3f5a4c', outer: '#26382e', ring: C.jade, text: '#9fc4ad', label: '中品', labelCol: '#9fc4ad' },
    r: { inner: '#4a443a', outer: '#302b23', ring: C.inkSoft, text: '#b3a88f', label: '下品', labelCol: '#b3a88f' }
  };

  function drawHeroPortrait(ctx, x, y, r, char, quality, locked) {
    var q = QUALITY[quality] || QUALITY.r;
    ctx.save();
    if (locked) ctx.globalAlpha = 0.42;
    inkShadow(ctx, x, y + r * 1.08, r * 0.6, r * 0.18);
    circleBase(ctx, x, y, r, q.inner, q.outer);
    // 底部墨晕
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(31,27,22,0.28)';
    ctx.fillRect(x - r, y + r * 0.55, r * 2, r);
    ctx.restore();
    // 双线品级环
    ctx.strokeStyle = q.ring; ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(244,236,216,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    // 楷体单字
    ctx.fillStyle = q.text;
    ctx.font = font(r * 0.86, 'bold');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(char, x, y + r * 0.04);
    ctx.restore();
  }

  // 品级标签（描边小方签）
  function drawQualityTag(ctx, x, y, w, h, quality) {
    var q = QUALITY[quality] || QUALITY.r;
    ctx.save();
    roundRect(ctx, x, y, w, h, 2);
    ctx.fillStyle = 'rgba(31,27,22,0.25)'; ctx.fill();
    ctx.strokeStyle = q.labelCol; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = q.labelCol;
    ctx.font = font(Math.min(h * 0.62, 11));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(q.label, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  }

  // 星级（朱砂星 + 空星）
  function drawStars(ctx, x, y, size, filled, total) {
    for (var i = 0; i < total; i++) {
      star(ctx, x + i * (size * 1.3), y, size, i < filled);
    }
  }

  function star(ctx, x, y, s, on) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = on ? C.seal : 'rgba(90,80,64,0.35)';
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rad = i % 2 === 0 ? s : s * 0.42;
      var px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ---------- 工具 ----------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 宽字距文本（居中）
  function drawSpacedText(ctx, text, cx, cy, extra) {
    var widths = [];
    var total = 0;
    for (var i = 0; i < text.length; i++) {
      var w = ctx.measureText(text[i]).width;
      widths.push(w);
      total += w + (i < text.length - 1 ? extra : 0);
    }
    var startX = cx - total / 2;
    for (var j = 0; j < text.length; j++) {
      ctx.fillText(text[j], startX + widths[j] / 2, cy);
      startX += widths[j] + extra;
    }
  }

  function truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function cnNum(n) {
    var m = { 1: '壹', 2: '贰', 3: '叁', 4: '肆', 5: '伍', 6: '陆', 7: '柒', 8: '捌', 9: '玖' };
    return m[n] || String(n);
  }

  // ---------- 导出 ----------
  global.Art = {
    C: C, FONT: FONT,
    drawEnemyToken: drawEnemyToken,
    drawHeroToken: drawHeroToken,
    drawBrocadeSlot: drawBrocadeSlot,
    drawBrocadeIcon: drawBrocadeIcon,
    drawPanel: drawPanel,
    drawInkButton: drawInkButton,
    drawUltButton: drawUltButton,
    drawHudPill: drawHudPill,
    drawBattleBackdrop: drawBattleBackdrop,
    drawSkillCard: drawSkillCard,
    drawHeroPortrait: drawHeroPortrait,
    drawQualityTag: drawQualityTag,
    drawStars: drawStars,
    sealStamp: sealStamp,
    roundRect: roundRect
  };
})(typeof window !== 'undefined' ? window : globalThis);
