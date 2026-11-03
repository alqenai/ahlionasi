/* شرباكة: "شنو يصير لك؟"
   Walk the family tree one step at a time and get the relation written out,
   the way people say it ("فهد يصير ولد عم أبوي"), then turn it into a story image.
   Everything runs in the browser: the names never leave the device. */
(function (root) {
  'use strict';

  /* ---------- Kinship logic ---------- */

  // One step from a person to a relative. t: direction in the tree, g: gender,
  // c: the word before another name ("أبو علي"), p: the word with "my" ("أبوي").
  var STEPS = {
    F: { t: 'up', g: 'm', c: 'أبو', p: 'أبوي' },
    M: { t: 'up', g: 'f', c: 'أم', p: 'أمي' },
    B: { t: 'side', g: 'm', c: 'أخو', p: 'أخوي' },
    Z: { t: 'side', g: 'f', c: 'أخت', p: 'أختي' },
    S: { t: 'down', g: 'm', c: 'ولد', p: 'ولدي' },
    D: { t: 'down', g: 'f', c: 'بنت', p: 'بنتي' },
    H: { t: 'mate', g: 'm', c: 'زوج', p: 'زوجي' },
    W: { t: 'mate', g: 'f', c: 'زوجة', p: 'زوجتي' }
  };
  // A parent's brother or sister has its own word.
  var UNCLES = {
    FB: { c: 'عم', p: 'عمي' },
    FZ: { c: 'عمة', p: 'عمتي' },
    MB: { c: 'خال', p: 'خالي' },
    MZ: { c: 'خالة', p: 'خالتي' }
  };
  var MAX = 8;

  function lastStep(path) {
    return path.length ? STEPS[path[path.length - 1]] : null;
  }

  // Which steps make sense next. We never offer a step that just walks back
  // (my father's son is me or my brother, my brother's father is my father).
  function options(path) {
    if (path.length >= MAX) return [];
    var l = lastStep(path);
    if (!l) return ['F', 'M', 'B', 'Z', 'S', 'D', 'W', 'H'];
    var mate = l.g === 'm' ? 'W' : 'H';
    if (l.t === 'up' || l.t === 'mate') return ['F', 'M', 'B', 'Z'];
    if (l.t === 'side') return ['S', 'D', mate];
    return ['S', 'D', 'B', 'Z', mate];
  }

  // Add a step. A child's brother or sister is just another child:
  // "أخت ولد عمي" becomes "بنت عمي".
  function add(path, step) {
    var l = lastStep(path);
    if (l && l.t === 'down' && STEPS[step].t === 'side') {
      return path.slice(0, -1).concat(step === 'B' ? 'S' : 'D');
    }
    return path.concat(step);
  }

  function units(path) {
    var out = [];
    for (var i = 0; i < path.length; i++) {
      var pair = UNCLES[path[i] + (path[i + 1] || '')];
      if (pair) { out.push(pair); i++; } else { out.push(STEPS[path[i]]); }
    }
    return out;
  }

  // "ولد عم أبوي", or with a name: "ولد عم أبو علي".
  function phrase(path, anchor) {
    var u = units(path);
    if (!u.length) return '';
    var words = [];
    for (var i = u.length - 1; i > 0; i--) words.push(u[i].c);
    words.push(anchor ? u[0].c + ' ' + anchor : u[0].p);
    return words.join(' ');
  }

  // The step said word for word: "أخو أبوي".
  function literal(path, step) {
    return path.length ? STEPS[step].c + ' ' + phrase(path) : STEPS[step].p;
  }

  // Everyday words for a few chains.
  function common(path) {
    var k = path.join('');
    var two = { FF: 'جدي', MF: 'جدي', FM: 'جدتي', MM: 'جدتي', SS: 'حفيدي', DS: 'حفيدي', SD: 'حفيدتي', DD: 'حفيدتي' };
    if (two[k]) return two[k];
    if (/^[FM]{3}$/.test(k)) return (k[2] === 'F' ? 'جد ' : 'جدة ') + (k[0] === 'F' ? 'أبوي' : 'أمي');
    return '';
  }

  function gender(path) {
    var l = lastStep(path);
    return l ? l.g : null;
  }

  function generation(path) {
    return path.reduce(function (n, s) {
      var t = STEPS[s].t;
      return n + (t === 'up' ? -1 : t === 'down' ? 1 : 0);
    }, 0);
  }

  function genLine(path) {
    var g = generation(path);
    if (g === 0) return 'من جيلي';
    if (g === -1) return 'من جيل أبوي وأمي';
    if (g === -2) return 'من جيل أجدادي';
    if (g <= -3) return 'من جيل أجداد أبوي وأمي';
    if (g === 1) return 'من جيل عيالي';
    if (g === 2) return 'من جيل أحفادي';
    return 'من جيل أحفاد عيالي';
  }

  function subject(path, them) {
    return them || (gender(path) === 'f' ? 'هي' : 'هو');
  }

  function verb(path) {
    return gender(path) === 'f' ? 'تصير' : 'يصير';
  }

  // A second line that helps: "يعني جدي", or "يعني فهد من جيل أبوي وأمي".
  function extra(path, them) {
    var c = common(path);
    if (c) return 'يعني ' + c;
    if (units(path).length < 2) return '';
    return 'يعني ' + subject(path, them) + ' ' + genLine(path);
  }

  function sentence(path, them) {
    return subject(path, them) + ' ' + verb(path) + ' ' + phrase(path);
  }

  // Positions for drawing the walk: up is a generation up, down is a generation
  // down, brothers, sisters and spouses sit beside (to the left, reading right to left).
  function layout(path) {
    var x = 0, y = 0, pts = [{ x: 0, y: 0, t: 'me', path: [] }];
    for (var i = 0; i < path.length; i++) {
      var t = STEPS[path[i]].t;
      if (t === 'up') y -= 1; else if (t === 'down') y += 1; else x -= 1;
      pts.push({ x: x, y: y, t: t, path: path.slice(0, i + 1) });
    }
    return pts;
  }

  function chip(path, step) {
    var np = add(path, step), main = phrase(np), lit = literal(path, step);
    return { step: step, path: np, main: main, hint: lit !== main ? lit : common(np) };
  }

  var KIN = {
    STEPS: STEPS, MAX: MAX, options: options, add: add, units: units, phrase: phrase,
    literal: literal, common: common, gender: gender, generation: generation,
    genLine: genLine, subject: subject, verb: verb, extra: extra, sentence: sentence,
    layout: layout, chip: chip
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = KIN;
  root.KIN = KIN;
  if (typeof document === 'undefined') return;

  /* ---------- Story image (1080 x 1920) ---------- */

  var FONT = '"Readex Pro", system-ui, sans-serif';
  var COL = { me: '#F4EFE6', up: '#FF8A80', side: '#E9C46A', down: '#2EC4B6', mate: '#8FB8DE' };
  // The Shorbaka mark: two threads (family + friends) woven together, in a 120x120 box.
  var THREAD_A = 'M14 34 C40 34 44 86 60 86 S80 34 106 34', THREAD_B = 'M14 86 C40 86 44 34 60 34 S80 86 106 86';

  function setFont(ctx, weight, size) { ctx.font = weight + ' ' + size + 'px ' + FONT; }

  function fit(ctx, text, weight, size, maxW, min) {
    setFont(ctx, weight, size);
    while (size > min && ctx.measureText(text).width > maxW) { size -= 2; setFont(ctx, weight, size); }
    return size;
  }

  function wrap(ctx, text, maxW) {
    var lines = [], line = '';
    text.split(' ').forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (!line || ctx.measureText(t).width <= maxW) line = t; else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines;
  }

  /* One line if it fits, else the two-line split with the most even lengths, else null. */
  function balance(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return [text];
    var words = text.split(' '), best = null, bestW = Infinity;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      var w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (w <= maxW && w < bestW) { best = [a, b]; bestW = w; }
    }
    return best;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draws the two-thread mark centred on (cx, cy), h px tall (about h * 102 / 72 wide).
  // The gap where one thread crosses the other is cut out for real (offscreen canvas),
  // so it looks right on any background, including see-through ones.
  function drawMark(ctx, cx, cy, h, light) {
    if (typeof Path2D === 'undefined') return;
    var s = h / 72, k = 3, W = Math.ceil(120 * s * k), H = W;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    var a = new Path2D(THREAD_A), b = new Path2D(THREAD_B);
    var ca = light ? '#1A9E92' : '#2EC4B6', cb = light ? '#F0675C' : '#FF8A80';
    g.scale(s * k, s * k); g.lineCap = 'round'; g.lineJoin = 'round';
    function thread(p, col) {
      g.globalCompositeOperation = 'destination-out'; g.lineWidth = 20; g.stroke(p);
      g.globalCompositeOperation = 'source-over'; g.lineWidth = 11; g.strokeStyle = col; g.stroke(p);
    }
    g.lineWidth = 11; g.strokeStyle = ca; g.stroke(a);
    thread(b, cb);
    // the teal thread goes back over the coral one at the right crossing
    g.save(); g.beginPath(); g.arc(83, 60, 19, 0, Math.PI * 2); g.clip(); thread(a, ca); g.restore();
    ctx.drawImage(c, cx - 60 * s, cy - 60 * s, 120 * s, 120 * s);
  }

  function pearl(ctx, x, y, r) {
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, '#F4EFE6'); g.addColorStop(1, '#D9C79A');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
  }

  function miniRings(ctx, x, y, r) {
    ctx.save();
    ctx.lineWidth = Math.max(3, r * 0.28);
    [[-0.5, '#8FB8DE'], [0.5, '#F4EFE6']].forEach(function (d) {
      ctx.beginPath(); ctx.arc(x + d[0] * r, y, r * 0.78, 0, Math.PI * 2);
      ctx.fillStyle = '#0E2A47'; ctx.fill();
    });
    [[-0.5, '#8FB8DE'], [0.5, '#F4EFE6']].forEach(function (d) {
      ctx.beginPath(); ctx.arc(x + d[0] * r, y, r * 0.78, 0, Math.PI * 2);
      ctx.strokeStyle = d[1]; ctx.stroke();
    });
    ctx.restore();
  }

  function overlap(a, b) {
    var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && h > 0 ? w * h : 0;
  }

  /* Short label for a node, relative to the one before it: «أبوه», «أختها», «زوجته». */
  function relLabel(path) {
    var s = STEPS[path[path.length - 1]], prev = STEPS[path[path.length - 2]];
    return (s.c === 'زوجة' ? 'زوجت' : s.c) + (prev.g === 'm' ? 'ه' : 'ها');
  }

  /* Lays the walk out at a given cell size, with every label placed where it hits nothing.
     A middle node whose full label has no free spot falls back to its short label. */
  function walkPlan(ctx, path, meName, themName, cell, colW) {
    colW = colW || cell;
    var pts = layout(path), n = pts.length;
    var r = Math.max(15, Math.min(36, cell * 0.16));
    var lw = Math.max(4, Math.min(7, cell * 0.028));
    var P = pts.map(function (p, j) {
      return { x: p.x * colW, y: p.y * cell, r: (j === 0 || j === n - 1) ? r * 1.18 : r * 0.82 };
    });
    var solid = P.map(function (p) { return { x0: p.x - p.r, y0: p.y - p.r, x1: p.x + p.r, y1: p.y + p.r }; });
    for (var i = 1; i < n; i++) {
      var a = P[i - 1], b = P[i], pad = pts[i].t === 'mate' ? Math.max(lw, r * 0.62) : lw;
      solid.push({ x0: Math.min(a.x, b.x) - pad, y0: Math.min(a.y, b.y) - pad, x1: Math.max(a.x, b.x) + pad, y1: Math.max(a.y, b.y) + pad });
    }
    var labels = [], order = [0];
    if (n > 1) order.push(n - 1);
    for (var o = 1; o < n - 1; o++) order.push(o);
    order.forEach(function (k) {
      var q = P[k], bold = k === 0 || k === n - 1;
      var text = k === 0 ? (meName || 'أنا') : k === n - 1 ? (themName || phrase(pts[k].path)) : phrase(pts[k].path);
      var weight = bold ? '700' : '500';
      var base = Math.round(Math.max(24, Math.min(34, cell * 0.15)) * (bold ? 1.15 : 1));
      var edge = {};
      [k - 1, k + 1].forEach(function (m) {
        if (m < 0 || m >= n) return;
        var dx = pts[m].x - pts[k].x, dy = pts[m].y - pts[k].y;
        if (dx < 0) edge.left = true; if (dx > 0) edge.right = true;
        if (dy < 0) edge.above = true; if (dy > 0) edge.below = true;
      });
      var taken = solid.concat(labels.map(function (l) { return l.bb; }));
      var texts = [text];
      if (!bold && k > 1) texts.push(relLabel(pts[k].path));
      var best = null;
      texts.forEach(function (text, short) {
      ['below', 'above', 'right', 'left'].forEach(function (pos) {
        var side = pos === 'right' || pos === 'left';
        var fs = fit(ctx, text, weight, base, side ? 240 : Math.max(colW * 0.95, 160), 18);
        var m = ctx.measureText(text), w = m.width;
        var asc = typeof m.actualBoundingBoxAscent === 'number' ? m.actualBoundingBoxAscent : fs * 0.8;
        var desc = typeof m.actualBoundingBoxDescent === 'number' ? m.actualBoundingBoxDescent : fs * 0.35;
        var x, y, align;
        if (pos === 'below') { align = 'center'; x = q.x; y = q.y + q.r + 12 + fs * 0.92; }
        else if (pos === 'above') { align = 'center'; x = q.x; y = q.y - q.r - 14 - fs * 0.22; }
        else if (pos === 'right') { align = 'left'; x = q.x + q.r + 16; y = q.y + fs * 0.34; }
        else { align = 'right'; x = q.x - q.r - 16; y = q.y + fs * 0.34; }
        var x0 = align === 'center' ? x - w / 2 : align === 'left' ? x : x - w;
        var bb = { x0: x0 - 6, x1: x0 + w + 6, y0: y - asc - 4, y1: y + desc + 4 };
        var cost = (edge[pos] ? 1e9 : 0) + (short ? 0.5 : 0);
        taken.forEach(function (t) { cost += overlap(bb, t); });
        if (!best || cost < best.cost) best = { cost: cost, text: text, weight: weight, fs: fs, x: x, y: y, align: align, bb: bb, bold: bold };
      });
      });
      labels.push(best);
    });
    var all = solid.concat(labels.map(function (l) { return l.bb; }));
    return {
      pts: pts, P: P, labels: labels, r: r, lw: lw, cell: cell, colW: colW,
      x0: Math.min.apply(null, all.map(function (b) { return b.x0; })),
      y0: Math.min.apply(null, all.map(function (b) { return b.y0; })),
      x1: Math.max.apply(null, all.map(function (b) { return b.x1; })),
      y1: Math.max.apply(null, all.map(function (b) { return b.y1; })),
      clash: labels.reduce(function (s, l) { return s + (l.cost >= 1 ? l.cost : 0); }, 0),
      short: labels.filter(function (l) { return l.cost > 0 && l.cost < 1; }).length
    };
  }

  /* Picks the biggest cell size whose whole drawing, labels included, fits the box.
     When rows are tight and labels still bump or had to be shortened, the columns get wider. */
  function fitWalk(ctx, path, meName, themName, box) {
    var plan, cell;
    function fits(pl) { return pl.x1 - pl.x0 <= box.w && pl.y1 - pl.y0 <= box.h; }
    function score(pl) { return pl.clash * 1000 + pl.short; }
    for (cell = 260; ; cell -= 6) {
      plan = walkPlan(ctx, path, meName, themName, cell);
      if (fits(plan) || cell <= 50) break;
    }
    for (var colW = cell + 12; score(plan) > 0 && colW <= Math.max(260, cell * 1.8); colW += 12) {
      var wide = walkPlan(ctx, path, meName, themName, cell, colW);
      if (!fits(wide)) break;
      if (score(wide) < score(plan)) plan = wide;
    }
    var w = plan.x1 - plan.x0, h = plan.y1 - plan.y0;
    plan.scale = Math.min(1, box.w / w, box.h / h);
    plan.ox = box.x + (box.w - w * plan.scale) / 2 - plan.x0 * plan.scale;
    plan.oy = box.y + (box.h - h * plan.scale) / 2 - plan.y0 * plan.scale;
    return plan;
  }

  function drawWalk(ctx, path, meName, themName, box) {
    var plan = fitWalk(ctx, path, meName, themName, box);
    var pts = plan.pts, n = pts.length, r = plan.r, lw = plan.lw, P = plan.P;
    ctx.save();
    ctx.translate(plan.ox, plan.oy);
    ctx.scale(plan.scale, plan.scale);

    for (var i = 1; i < n; i++) {
      var a = P[i - 1], b = P[i], t = pts[i].t;
      ctx.save();
      ctx.strokeStyle = COL[t]; ctx.lineWidth = lw; ctx.lineCap = 'round';
      if (t === 'side') ctx.setLineDash([lw * 2.2, lw * 2.4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
      if (t === 'mate') miniRings(ctx, (a.x + b.x) / 2, (a.y + b.y) / 2, r * 0.55);
    }

    for (var j = 0; j < n; j++) {
      var p = P[j], start = j === 0, end = j === n - 1;
      if (end) {
        ctx.save(); ctx.shadowColor = 'rgba(233, 196, 106, 0.7)'; ctx.shadowBlur = p.r * 1.4;
        pearl(ctx, p.x, p.y, p.r); ctx.restore();
      } else {
        pearl(ctx, p.x, p.y, p.r);
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.lineWidth = end ? lw * 1.35 : lw;
      ctx.strokeStyle = start ? '#F4EFE6' : end ? '#E9C46A' : COL[pts[j].t];
      ctx.stroke();
    }

    plan.labels.forEach(function (l) {
      setFont(ctx, l.weight, l.fs);
      ctx.textAlign = l.align;
      ctx.fillStyle = l.bold ? '#F4EFE6' : '#C9D6E3';
      ctx.fillText(l.text, l.x, l.y);
    });
    ctx.restore();
  }

  // The small sign-off at the bottom: the mark and the address, on a see-through pill that sits in the story.
  function drawSticker(ctx, cy) {
    var label = 'shorbaka.com', markH = 56, markW = markH * 102 / 72, gap = 18, padS = 28, padE = 34, h = 96;
    ctx.save();
    ctx.direction = 'ltr'; ctx.textAlign = 'left'; setFont(ctx, '500', 40);
    var m = ctx.measureText(label), w = padS + markW + gap + m.width + padE;
    var x0 = 540 - w / 2;
    roundRect(ctx, x0, cy - h / 2, w, h, h / 2);
    ctx.fillStyle = 'rgba(244, 239, 230, 0.07)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244, 239, 230, 0.2)'; ctx.stroke();
    drawMark(ctx, x0 + padS + markW / 2, cy, markH, false);
    var ink = (m.actualBoundingBoxAscent || 30) - (m.actualBoundingBoxDescent || 0);
    ctx.fillStyle = '#F4EFE6';
    ctx.fillText(label, x0 + padS + markW + gap, cy + ink / 2);
    ctx.restore();
  }

  function loadFonts(sample) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var all = Promise.all([
      document.fonts.load('700 100px "Readex Pro"', sample),
      document.fonts.load('500 40px "Readex Pro"', sample),
      document.fonts.load('400 40px "Readex Pro"', sample),
      document.fonts.load('500 32px "Readex Pro"', 'shorbaka.com')
    ]).catch(function () {});
    var timeout = new Promise(function (res) { setTimeout(res, 2500); });
    return Promise.race([all, timeout]);
  }

  /* The two sizes we draw: an Instagram story (9:16) and a feed post (4:5). Both are 1080 wide;
     the post packs the same layout into less height. */
  var FORMATS = {
    story: { H: 1920, top: 300, lead: 46, name: 150, nameMin: 64, nameGap: 34, verb: 54, verbGap: 74,
      rel: 104, relMin: 64, walkGap: 56, minWalk: 380, bottom: 1470, bottomMore: 1410, moreY: 1476, more: 42, sticker: 1612 },
    post: { H: 1350, top: 178, lead: 40, name: 124, nameMin: 56, nameGap: 30, verb: 46, verbGap: 64,
      rel: 88, relMin: 56, walkGap: 48, minWalk: 300, bottom: 1060, bottomMore: 1004, moreY: 1068, more: 38, sticker: 1220 }
  };

  /* The room left for the walk drawing, between the relation text and the bottom line. */
  function storyBox(textBottom, more, F) {
    F = F || FORMATS.story;
    var bottom = more ? F.bottomMore : F.bottom;
    var top = Math.min(textBottom + F.walkGap, bottom - F.minWalk);
    return { x: 70, y: top, w: 940, h: bottom - top };
  }

  /* The sea behind every picture: deep navy, a teal glow and a few pearls of air. k = height / 1920. */
  function background(ctx, W, H) {
    var k = H / 1920;
    var bg = ctx.createRadialGradient(540, 620 * k, 40, 540, 760 * k, Math.max(1100, 1500 * k));
    bg.addColorStop(0, '#16466F'); bg.addColorStop(0.55, '#0E2A47'); bg.addColorStop(1, '#0A2036');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    var glow = ctx.createRadialGradient(540, 520 * k, 0, 540, 520 * k, 720);
    glow.addColorStop(0, 'rgba(46, 196, 182, 0.12)'); glow.addColorStop(1, 'rgba(46, 196, 182, 0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    [[96, 1520, 11], [176, 400, 7], [968, 470, 12], [1012, 1250, 8], [64, 930, 6], [900, 1760, 9], [280, 1790, 6], [770, 210, 7]].forEach(function (b) {
      var bx = b[0], by = b[1] * k, br = b[2];
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; ctx.fill();
    });
  }

  /* words: the tree's own words for the relation, when they say more than the steps do (tree.js, from a
     person's sheet): { rel: «زوجة عمي الثانية», «طليقة أخوي», «جد أبوي», more: the line at the bottom }. */
  function makeStory(meName, themName, path, format, words) {
    var F = FORMATS[format] || FORMATS.story;
    var subj = subject(path, themName), rel = (words && words.rel) || phrase(path);
    var more = words && typeof words.more === 'string' ? words.more : extra(path, themName);
    return loadFonts('صلة القرابة بيني وبين ' + subj + ' ' + rel + ' ' + (meName || 'أنا') + ' ' + more).then(function () {
      var W = 1080, H = F.H, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      background(ctx, W, H);

      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

      var y = F.top;
      ctx.fillStyle = '#9DB2C8'; setFont(ctx, '400', F.lead);
      ctx.fillText('صلة القرابة بيني وبين', 540, y);

      var ns = fit(ctx, subj, '700', F.name, 940, F.nameMin);
      y += F.nameGap + ns * 0.98;
      ctx.fillStyle = '#F4EFE6'; ctx.fillText(subj, 540, y);

      y += ns * 0.36 + F.verbGap;
      ctx.fillStyle = '#9DB2C8'; setFont(ctx, '500', F.verb);
      ctx.fillText(verb(path), 540, y);

      var rs = F.rel, lines;
      for (;;) {
        setFont(ctx, '700', rs);
        lines = balance(ctx, rel, 940);
        if (lines || rs <= F.relMin) break;
        rs -= 8;
      }
      if (!lines) lines = wrap(ctx, rel, 940);
      ctx.fillStyle = '#E9C46A';
      lines.forEach(function (line, i) {
        y += i === 0 ? rs * 1.3 : rs * 1.18;
        ctx.fillText(line, 540, y);
      });

      var box = storyBox(y, more, F);
      drawWalk(ctx, path, meName, themName || (words && words.rel) || '', box);

      if (more) {
        ctx.textAlign = 'center'; ctx.fillStyle = '#9DB2C8';
        fit(ctx, more, '400', F.more, 940, 28);
        ctx.fillText(more, 540, F.moreY);
      }

      drawSticker(ctx, F.sticker);

      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }

  KIN.makeStory = makeStory; KIN.fitWalk = fitWalk; KIN.storyBox = storyBox; KIN.FORMATS = FORMATS;
  // For the family tree picture (tree.js), so both pictures look like one family.
  KIN.draw = { FONT: FONT, setFont: setFont, fit: fit, roundRect: roundRect, drawMark: drawMark, pearl: pearl,
    drawSticker: drawSticker, loadFonts: loadFonts, background: background };

  /* ---------- Page ---------- */

  var ICONS = {
    up: '<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"/>',
    side: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    down: '<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"/>',
    mate: '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>'
  };
  var KEY = 'shorbaka.wallet.v1';
  var DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function icon(type) {
    var s = el('span', 'kin-ico');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[type] + '</svg>';
    return s;
  }

  function arNum(n) {
    return String(n).replace(/[0-9]/g, function (d) { return DIGITS[Number(d)]; });
  }

  function people(n) {
    if (n === 1) return 'شخص واحد';
    if (n === 2) return 'شخصين';
    if (n <= 10) return arNum(n) + ' أشخاص';
    return arNum(n) + ' شخص';
  }

  KIN.people = people; KIN.arNum = arNum;

  // Rebuild the walk from the steps that were tapped; null if anything is off.
  // «علي» and «على القناعي» are the same person here: first word, alef/yeh/teh marbuta forms and tashkeel set aside.
  function firstWord(s) {
    return String(s || '').trim().split(/\s+/)[0].replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase();
  }

  function replay(steps) {
    if (!Array.isArray(steps) || !steps.length || steps.length > MAX * 2) return null;
    var path = [], trail = [];
    for (var i = 0; i < steps.length; i++) {
      if (options(path).indexOf(steps[i]) < 0) return null;
      var info = chip(path, steps[i]);
      trail.push(info);
      path = info.path;
    }
    return trail;
  }

  function loadWallet() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(function (it) {
        return it && typeof it.them === 'string' && typeof it.me === 'string' && replay(it.steps);
      });
    } catch (e) { return []; }
  }

  function storeWallet(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 60))); return true; } catch (e) { return false; }
  }

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      me: $('kin-me'), them: $('kin-them'), need: $('kin-need'), path: $('kin-path'), next: $('kin-next'),
      opts: $('kin-opts'), max: $('kin-max'), actions: $('kin-actions'), done: $('kin-done'),
      back: $('kin-back'), reset: $('kin-reset'), result: $('kin-result'), rLabel: $('kin-r-label'),
      rSentence: $('kin-r-sentence'), rExtra: $('kin-r-extra'), story: $('kin-story'), save: $('kin-save'),
      copy: $('kin-copy'), again: $('kin-again'), wallet: $('kin-wallet'), wCount: $('kin-w-count'),
      wList: $('kin-w-list'), wNote: $('kin-w-note'), wEmpty: $('kin-w-empty'), wIn: $('kin-w-in'), modal: $('kin-modal'),
      img: $('kin-img'), share: $('kin-share'), dl: $('kin-dl'), close: $('kin-close'), tip: $('kin-tip'),
      mTitle: $('kin-m-title'), seg: $('kin-seg'), opt: $('kin-opt'), optBox: $('kin-opt-box'),
      choice: $('kin-choice'), choiceText: $('kin-choice-text'), choiceSeg: $('kin-choice-seg'),
      picks: $('kin-picks'), picksText: $('kin-picks-text'), picksRow: $('kin-picks-row'),
      optText: $('kin-opt-text'), optHint: $('kin-opt-hint'), opt2: $('kin-opt2'), opt2Box: $('kin-opt2-box'),
      opt2Text: $('kin-opt2-text'), opt2Hint: $('kin-opt2-hint'), rTree: $('kin-r-tree'), addTree: $('kin-add-tree'),
      rIn: $('kin-r-in'), rInText: $('kin-r-in-text'), rSee: $('kin-r-see'),
      privacy: $('kin-privacy-text'), auth: $('kin-auth'), authTitle: $('kin-auth-title'),
      authText: $('kin-auth-text'), gbtn: $('kin-gbtn'), authErr: $('kin-auth-err'), authClose: $('kin-auth-close'),
      authHint: $('kin-auth-hint'), authLocal: $('kin-auth-local'), mLink: $('kin-mlink'),
      authOr: $('kin-auth-or'), mail: $('kin-mail'), mailAddr: $('kin-mail-addr'), mailSend: $('kin-mail-send'),
      code: $('kin-code'), codeSent: $('kin-code-sent'), codeIn: $('kin-code-in'), codeGo: $('kin-code-go'),
      codeAgain: $('kin-code-again'), codeBack: $('kin-code-back'),
      acctBox: $('acct'), acctIn: $('acct-in'), acctBtn: $('acct-btn'), acctAv: $('acct-av'), acctFirst: $('acct-first'),
      acctMenu: $('acct-menu'), acctAvLg: $('acct-av-lg'), acctName: $('acct-name'), acctEmail: $('acct-email'),
      acctWallet: $('acct-wallet'), acctCount: $('acct-count'), acctOut: $('acct-out'), acctDel: $('acct-del'),
      acctConfirm: $('acct-confirm'), acctYes: $('acct-yes'), acctNo: $('acct-no'), acctErr: $('acct-err')
    };
    if (!ui.path) return;

    var st = { trail: [], open: false, done: false, pending: null, added: null, them: ui.them.value.trim() }, file = null, url = null, dlUrl = null;
    var sheet = null, sheetFrom = null, wSeq = 0, acctReady = !root.ACCOUNT;

    // The account system, when it is switched on and loaded; null otherwise.
    function accounts() { return root.ACCOUNT && root.ACCOUNT.on() ? root.ACCOUNT : null; }

    function cur() { return st.trail.length ? st.trail[st.trail.length - 1].path : []; }

    /* «شجرة عائلتي» (tree.js), when this walk starts from its owner («اسمك» empty or the same name):
       each step can then be someone in it, and the choices name them («أبوي (محمد)»). */
    function treeDoc() {
      var T = root.TREE, doc = T && T.current ? T.current() : null;
      if (!doc || !doc.p[doc.me]) return null;
      var me = firstWord(ui.me.value);
      return !me || me === firstWord(doc.p[doc.me].n) ? doc : null;
    }

    // Who in the tree the walk has reached: me at the start, null once it leaves the tree.
    function treeAt(doc) {
      if (!doc) return null;
      var at = st.trail.length ? st.trail[st.trail.length - 1].pid : doc.me;
      return at && doc.p[at] ? at : null;
    }

    /* The choices for one step. Without the tree: one («أخوي»). With it: one for each one in the
       tree («أخوي (خالد)», «أخوي (منصور)»), and one for someone not in it yet (not for a father or
       mother who is already there). */
    function stepChoices(path, step, doc, idx, at) {
      var base = chip(path, step);
      base.pid = null;
      var kin = doc && at ? root.TREE.kinOf(doc, idx, at, step) : [];
      if (!kin.length) return [base];
      var out = kin.map(function (pid) {
        return Object.assign({}, base, { pid: pid, main: base.main + ' (' + (doc.p[pid].n || 'بدون اسم') + ')' });
      });
      // (a husband who has four wives, or a wife who has a husband, can't have another one not in the tree)
      var full = (step === 'W' || step === 'H') && root.TREE.canMarry && !root.TREE.canMarry(doc, idx, at);
      if (step !== 'F' && step !== 'M' && !full) {
        out.push(Object.assign({}, base, { hint: STEPS[step].g === 'f' ? 'وحدة ثانية مو\u00a0بشجرتك' : 'واحد ثاني مو\u00a0بشجرتك' }));
      }
      return out;
    }

    // A walk opened again from the saved list: fathers and mothers are certain, so they get their names back.
    function bindTrail(trail) {
      var doc = treeDoc(), at = doc ? doc.me : null, idx = doc ? root.TREE.index(doc) : null;
      trail.forEach(function (info) {
        var kin = at && (info.step === 'F' || info.step === 'M') ? root.TREE.kinOf(doc, idx, at, info.step) : [];
        info.pid = kin[0] || null;
        if (info.pid) info.main = info.main + ' (' + (doc.p[info.pid].n || 'بدون اسم') + ')';
        at = info.pid;
      });
      return trail;
    }
    function names() { return { me: ui.me.value.trim(), them: ui.them.value.trim() }; }
    function label(btn) { return btn.querySelector('span'); }

    function flash(btn, text, ms) {
      var s = label(btn);
      if (!s.dataset.label) s.dataset.label = s.textContent;
      s.textContent = text;
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { s.textContent = s.dataset.label; }, ms || 1800);
    }

    function node(i, main, hint, type, isCur) {
      var waiting = i < 0 && !st.open;
      var li = el('li', 'kin-node' + (isCur ? ' is-cur' : '') + (i < 0 ? ' is-me' : '') + (waiting ? ' is-waiting' : ''));
      li.style.setProperty('--c', COL[type]);
      li.appendChild(el('span', 'kin-dot'));
      var b = el('button', 'kin-node-btn');
      b.type = 'button';
      var m = el('span', 'kin-main', main);
      if (i < 0) m.appendChild(el('small', 'kin-you', 'أنت'));
      b.appendChild(m);
      if (hint) b.appendChild(el('span', 'kin-hint', hint));
      b.setAttribute('aria-label', i < 0 ? main + '، دوس عشان تبدأ من عندك' : main + '، ارجع لهالخطوة');
      if (i < 0) b.setAttribute('aria-expanded', String(st.open && !st.trail.length));
      b.addEventListener('click', function () {
        if (i < 0 && !names().them) { needThem(true); ui.them.focus(); return; }
        st.trail = i < 0 ? [] : st.trail.slice(0, i + 1);
        st.open = true; st.done = false;
        render();
        focusNext();
      });
      li.appendChild(b);
      if (waiting) {
        // an arrow pointing at the name; tapping the tag works like tapping the name
        var tap = el('button', 'kin-tap');
        tap.type = 'button';
        tap.tabIndex = -1;
        tap.setAttribute('aria-hidden', 'true');
        tap.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
        tap.appendChild(el('span', 'kin-tap-long', 'دوس على اسمك'));
        tap.appendChild(el('span', 'kin-tap-short', 'دوس هني'));
        tap.addEventListener('click', function () { b.click(); });
        li.appendChild(tap);
        // on a narrow phone or with a long name, the short words leave the name room (checked before it is drawn)
        requestAnimationFrame(function () {
          if (m.scrollWidth > m.clientWidth + 1) li.classList.add('is-tight');
        });
      }
      return li;
    }

    function option(info, i) {
      var t = STEPS[info.step].t;
      var b = el('button', 'kin-opt');
      b.type = 'button';
      b.style.setProperty('--c', COL[t]);
      b.style.animationDelay = (i * 35) + 'ms';
      b.appendChild(icon(t));
      var txt = el('span', 'kin-opt-txt');
      txt.appendChild(el('span', 'kin-opt-main', info.main));
      if (info.hint) txt.appendChild(el('span', 'kin-opt-hint', info.hint));
      b.appendChild(txt);
      b.setAttribute('aria-label', info.main + (info.hint ? '، ' + info.hint : ''));
      b.addEventListener('click', function () {
        if (!names().them) { needThem(true); ui.them.focus(); return; }
        st.trail.push(info);
        st.open = true; st.done = false;
        render();
        focusNext();
      });
      return b;
    }

    function reveal(box) {
      var r = box.getBoundingClientRect();
      if (r.bottom > window.innerHeight - 12 || r.top < 0) box.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function focusNext() {
      var first = ui.opts.querySelector('button');
      if (!ui.next.hidden && first) { first.focus({ preventScroll: true }); reveal(ui.next); }
      else if (!ui.actions.hidden) { ui.done.focus({ preventScroll: true }); reveal(ui.actions); }
    }

    function render() {
      var n = names(), path = cur(), g = gender(path);
      ui.path.textContent = '';
      ui.path.appendChild(node(-1, n.me || 'أنا', '', 'me', !st.trail.length));
      st.trail.forEach(function (s, i) {
        ui.path.appendChild(node(i, s.main, s.hint, STEPS[s.step].t, i === st.trail.length - 1));
      });

      var opts = st.open && !st.done && n.them ? options(path) : [], doc = opts.length ? treeDoc() : null;
      var idx = doc ? root.TREE.index(doc) : null, at = treeAt(doc), list = [];
      if (doc && at === doc.me) opts = opts.filter(function (s) { return s !== (doc.p[doc.me].g === 'f' ? 'W' : 'H'); });
      opts.forEach(function (s) { list = list.concat(stepChoices(path, s, doc, idx, at)); });
      ui.opts.textContent = '';
      list.forEach(function (info, i) { ui.opts.appendChild(option(info, i)); });
      ui.next.hidden = !list.length;
      ui.max.hidden = !(st.open && !st.done && path.length >= MAX);

      ui.actions.hidden = !st.trail.length || st.done;
      label(ui.done).textContent = g === 'f'
        ? (n.them ? 'وصلت! هذي هي ' + n.them : 'وصلت لها')
        : (n.them ? 'وصلت! هذا هو ' + n.them : 'وصلت له');

      ui.result.hidden = !st.done;
      if (st.done) {
        ui.rLabel.textContent = 'صلة القرابة بيني وبين ' + (n.them || 'هالشخص');
        ui.rSentence.textContent = '';
        ui.rSentence.appendChild(el('b', null, subject(path, n.them)));
        ui.rSentence.appendChild(document.createTextNode(' ' + verb(path) + ' '));
        ui.rSentence.appendChild(el('em', null, phrase(path)));
        var more = extra(path, n.them);
        ui.rExtra.textContent = more;
        ui.rExtra.hidden = !more;
      }
      treeBox(n);
    }

    function walkSteps() { return st.trail.map(function (i) { return { t: i.step, pid: i.pid || null }; }); }

    // Under the result: «ضيفه لشجرتي», or «فهد موجود بشجرتك» when the walk ended on someone in it.
    function treeBox(n) {
      if (!ui.rTree) return;
      var doc = st.done ? treeDoc() : null, last = st.trail[st.trail.length - 1], T = root.TREE;
      if (!doc || !last || !T.addWalk) { ui.rTree.hidden = true; return; }
      var f = gender(cur()) === 'f', who = n.them || (f ? 'هي' : 'هو');
      if (last.pid && doc.p[last.pid]) {
        ui.rTree.hidden = false; ui.addTree.hidden = true; ui.rIn.hidden = false;
        ui.rInText.textContent = st.added === last.pid
          ? (f ? 'انضافت ' : 'انضاف ') + (n.them || '') + ' لشجرتك ✓'
          : who + (f ? ' موجودة بشجرتك ✓' : ' موجود بشجرتك ✓');
        ui.rSee.textContent = f ? 'شوفها بالشجرة' : 'شوفه بالشجرة';
        return;
      }
      // only when every step can go on the tree (my wife's brother can't, for one)
      ui.rTree.hidden = !T.addWalk(doc, walkSteps(), n.them);
      ui.addTree.hidden = false; ui.rIn.hidden = true;
      label(ui.addTree).textContent = f ? 'ضيفها لشجرتي' : 'ضيفه لشجرتي';
    }

    function renderWallet() {
      if (!ui.wallet) return;
      var a = accounts(), seq = ++wSeq;
      renderAccount();
      if (a && a.user()) {
        a.list().then(function (items) { if (seq === wSeq) drawWallet(items, true); },
          function () { if (seq === wSeq) drawWallet(null, true); });
      } else {
        drawWallet(loadWallet(), false);
      }
    }

    // The wallet has its own box under the finder. Signed out with nothing saved, it invites them to sign in.
    function drawWallet(items, inAccount) {
      var a = accounts(), failed = !items, list = (items || []).filter(function (it) { return replay(it.steps); });
      var invite = !inAccount && !!a && acctReady && !list.length;
      ui.wallet.hidden = !inAccount && !list.length && !invite;
      ui.wCount.textContent = list.length ? people(list.length) : '';
      if (ui.acctCount) ui.acctCount.textContent = inAccount && list.length ? people(list.length) : '';
      if (ui.wEmpty) {
        ui.wEmpty.hidden = list.length > 0;
        ui.wEmpty.textContent = failed ? 'ما قدرنا نجيب اللي حفظتهم الحين، جرّب بعد شوي.'
          : inAccount ? 'ما حفظت أحد للحين. احفظ أي صلة قرابة وبتلقاها هني.'
          : 'احفظ صلات القرابة اللي تكتشفها، وتلقاها هني من أي جهاز تدخل منه.';
      }
      if (ui.wIn) ui.wIn.hidden = !invite;
      if (ui.wNote) {
        ui.wNote.hidden = invite;
        ui.wNote.textContent = inAccount ? 'محفوظة بحسابك، وتلقاها من أي جهاز تدخل منه.'
          : a ? 'محفوظة في جهازك بس. سجّل دخول وتنتقل لحسابك.'
          : 'محفوظة في جهازك بس.';
      }
      ui.wList.textContent = '';
      list.forEach(function (it) {
        var trail = replay(it.steps), path = trail[trail.length - 1].path;
        var li = el('li', 'kin-w-item');
        var open = el('button', 'kin-w-open');
        open.type = 'button';
        open.appendChild(el('span', 'kin-w-name', subject(path, it.them)));
        open.appendChild(el('span', 'kin-w-rel', verb(path) + ' ' + phrase(path)));
        open.addEventListener('click', function () {
          ui.me.value = it.me; ui.them.value = it.them; st.them = ui.them.value.trim();
          st.trail = bindTrail(trail); st.open = true; st.done = true;
          render();
          ui.result.focus({ preventScroll: true });
          ui.result.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        var edit = el('button', 'kin-w-edit');
        edit.type = 'button';
        edit.appendChild(el('span', null, 'عدّل'));
        edit.setAttribute('aria-label', 'عدّل اسم ' + subject(path, it.them));
        edit.addEventListener('click', function () { editItem(li, it, path, inAccount); });
        var del = el('button', 'kin-w-del');
        del.type = 'button';
        del.appendChild(el('span', null, 'شيل'));
        del.setAttribute('aria-label', 'شيل ' + subject(path, it.them));
        del.addEventListener('click', function () {
          if (del.dataset.armed) {
            if (inAccount) {
              del.disabled = true;
              accounts().remove(it.id).then(renderWallet, function () { del.disabled = false; flash(del, 'ما زبط', 2000); });
            } else {
              storeWallet(loadWallet().filter(function (x) { return x.id !== it.id; }));
              renderWallet();
            }
            return;
          }
          del.dataset.armed = '1';
          flash(del, 'متأكد؟', 3000);
          setTimeout(function () { delete del.dataset.armed; }, 3000);
        });
        li.appendChild(open);
        li.appendChild(edit);
        li.appendChild(del);
        ui.wList.appendChild(li);
      });
    }

    // Fixing a name that was typed wrong: the row turns into a small form in place.
    function editItem(li, it, path, inAccount) {
      var form = el('form', 'kin-w-form'), field = el('div', 'kin-w-field');
      var input = el('input', 'kin-w-input');
      input.type = 'text'; input.value = it.them; input.maxLength = 40;
      input.autocomplete = 'off'; input.setAttribute('enterkeyhint', 'done');
      input.placeholder = gender(path) === 'f' ? 'اسمها' : 'اسمه';
      input.setAttribute('aria-label', 'الاسم');
      field.appendChild(input);
      field.appendChild(el('span', 'kin-w-rel', verb(path) + ' ' + phrase(path)));
      var ok = el('button', 'kin-w-ok'), no = el('button', 'kin-w-no');
      ok.type = 'submit'; ok.appendChild(el('span', null, 'حفظ'));
      no.type = 'button'; no.appendChild(el('span', null, 'إلغاء'));
      form.appendChild(field); form.appendChild(ok); form.appendChild(no);
      li.textContent = '';
      li.classList.add('is-editing');
      li.appendChild(form);
      input.focus();
      input.select();

      var busy = function (on) { ok.disabled = no.disabled = input.disabled = on; };
      no.addEventListener('click', renderWallet);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.stopPropagation(); renderWallet(); }
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = input.value.trim().slice(0, 40);
        if (name === it.them) { renderWallet(); return; }
        busy(true);
        if (inAccount) {
          accounts().rename(it.id, name).then(renderWallet, function () { busy(false); flash(ok, 'ما زبط', 2000); });
          return;
        }
        // On the device: if that name with that relation is already saved, the two become one (the saved one stays).
        var list = loadWallet();
        var same = list.some(function (x) { return x.id !== it.id && x.them === name && x.path === it.path; });
        if (same) list = list.filter(function (x) { return x.id !== it.id; });
        else list.forEach(function (x) { if (x.id === it.id) x.them = name; });
        if (storeWallet(list)) renderWallet();
        else { busy(false); flash(ok, 'ما زبط', 2000); }
      });
    }

    function renderAccount() {
      var a = accounts();
      if (ui.privacy) {
        ui.privacy.textContent = a ? 'الأسماء ما تطلع من جهازك إلا اللي تحفظها بحسابك.'
          : 'الأسماء تبقى في جهازك، ما تطلع لأحد.';
      }
      // Top of the page: "sign in" when signed out, the person's chip with their account menu when in.
      if (!ui.acctBox) return;
      ui.acctBox.hidden = !a || !acctReady;
      var u = ui.acctBox.hidden ? null : a.user();
      ui.acctIn.hidden = ui.acctBox.hidden || !!u;
      ui.acctBtn.hidden = !u;
      if (!u) { closeMenu(); ui.acctBtn.dataset.who = ''; return; }
      var who = u.id + ' ' + u.picture + ' ' + u.name;
      if (ui.acctBtn.dataset.who === who) return;
      ui.acctBtn.dataset.who = who;
      avatar(ui.acctAv, u);
      avatar(ui.acctAvLg, u);
      ui.acctFirst.textContent = u.first || u.name || 'حسابي';
      ui.acctName.textContent = u.name || u.first || 'حسابي';
      ui.acctEmail.textContent = u.email;
      ui.acctBtn.setAttribute('aria-label', 'حسابك: ' + (u.name || u.email || ''));
    }

    // Their Google photo, or the first letter of their name when there is none (or it doesn't load).
    function avatar(box, u) {
      var letter = Array.from((u.name || u.email || '؟').trim())[0] || '؟';
      box.textContent = '';
      if (!u.picture) { box.textContent = letter.toUpperCase(); return; }
      var img = new Image();
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () { box.textContent = letter.toUpperCase(); };
      img.src = u.picture;
      box.appendChild(img);
    }

    function openMenu() {
      ui.acctMenu.hidden = false;
      ui.acctBtn.setAttribute('aria-expanded', 'true');
      askDelete(false);
      ui.acctWallet.focus({ preventScroll: true });
    }

    function closeMenu(focusBtn) {
      if (!ui.acctMenu || ui.acctMenu.hidden) return;
      ui.acctMenu.hidden = true;
      ui.acctBtn.setAttribute('aria-expanded', 'false');
      askDelete(false);
      if (focusBtn) ui.acctBtn.focus();
    }

    // Deleting the account asks once more, inside the menu.
    function askDelete(on) {
      ui.acctConfirm.hidden = !on;
      ui.acctDel.hidden = on;
      ui.acctErr.hidden = true;
      ui.acctYes.disabled = ui.acctNo.disabled = false;
      if (on) ui.acctNo.focus({ preventScroll: true });
    }

    function openSheet(m, from) {
      sheet = m; sheetFrom = from || null;
      m.hidden = false;
      document.documentElement.classList.add('kin-lock');
      var x = m.querySelector('.kin-x');
      if (x) x.focus();
    }

    // A sheet can open over another one (a story from a person's sheet in the tree): the page stays
    // still until the last one closes.
    function closeSheet(m, keepFocus) {
      if (!m || m.hidden) return;
      m.hidden = true;
      if (!document.querySelector('.kin-modal:not([hidden])')) document.documentElement.classList.remove('kin-lock');
      if (sheet === m) sheet = null;
      if (!keepFocus && sheetFrom) sheetFrom.focus();
    }

    function authError(text) {
      ui.authErr.textContent = text;
      ui.authErr.hidden = false;
      showLocal(true);
    }

    // Google refuses to sign in from the browsers built into apps (Instagram, Snapchat, TikTok...),
    // which is where links in stories open.
    function inAppBrowser() {
      var ua = navigator.userAgent || '';
      if (/Instagram|FBAN|FBAV|FB_IAB|Snapchat|musical_ly|Bytedance|TikTok|; wv\)/i.test(ua)) return true;
      return /iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua) && !navigator.standalone;
    }

    // The way out when Google sign-in can't work here: keep the relation on this device for now.
    function showLocal(show) {
      if (ui.authLocal) ui.authLocal.hidden = !(show && st.pending);
    }

    // Sign-in sheet. pending is the relation to save once the person is in; copy ({title, text}) lets
    // another section (the family tree) say why it asks.
    function openAuth(pending, from, copy) {
      var a = accounts();
      if (!a || !ui.auth) return;
      var stuck = inAppBrowser(), byMail = mailOn();
      st.pending = pending || null;
      ui.authTitle.textContent = copy ? copy.title : pending ? 'احفظها بحسابك' : 'سجّل دخولك';
      ui.authText.textContent = copy ? copy.text : pending
        ? 'سجّل دخولك عشان تنحفظ صلة القرابة بحسابك، وتلقاها من أي جهاز.'
        : 'سجّل دخولك عشان تشوف اللي حفظتهم، وتحفظ من أي جهاز.';
      ui.authErr.hidden = true;
      if (ui.authHint) {
        ui.authHint.hidden = !stuck;
        ui.authHint.textContent = byMail ? HINT_MAIL : HINT;
      }
      showLocal(stuck);
      // a code sent a moment ago (the page may have reloaded while they fetched it) carries on
      var kept = byMail ? mailKept() : null;
      if (kept) mail = kept;
      showMail(!byMail ? '' : kept ? 'code' : 'addr');
      ui.gbtn.textContent = 'لحظة…';
      openSheet(ui.auth, from);
      a.googleButton(ui.gbtn, function (err) {
        if (err) { authError('ما زبط الدخول، جرّب مرة ثانية.'); return; }
        forgetMail();
        closeSheet(ui.auth, true);
        afterSignIn();
      }).catch(function () {
        ui.gbtn.textContent = '';
        authError(byMail ? 'ما قدرنا نفتح دخول جوجل. سجّل بإيميلك، أو جرّب مرة ثانية.' : 'ما قدرنا نفتح دخول جوجل. تأكد من النت وجرّب مرة ثانية.');
      });
    }

    /* --- sign-in with a code sent by email (when the account side has it on) --- */

    var HINT = ui.authHint ? ui.authHint.textContent : '';
    var HINT_MAIL = 'جوجل ما يخليك تسجّل دخول من داخل التطبيقات مثل انستقرام. سجّل بإيميلك تحت، أو افتح الصفحة بسفاري أو كروم (من زر ⋯ اللي فوق).';
    var MAIL = 'shorbaka.mail';  // in this tab: the address a code went to and when, so a reload can carry on
    var mail = { email: '', at: 0 }, againT = null;

    function mailOn() { var a = accounts(); return !!(a && a.emailOn && a.emailOn() && ui.mail); }
    function mailKept() {
      try {
        var m = JSON.parse(sessionStorage.getItem(MAIL) || 'null');
        return m && m.email && Date.now() - m.at < 15 * 60000 ? m : null;
      } catch (e) { return null; }
    }
    function keepMail() { try { sessionStorage.setItem(MAIL, JSON.stringify(mail)); } catch (e) {} }
    function forgetMail() {
      mail = { email: '', at: 0 };
      clearInterval(againT);
      try { sessionStorage.removeItem(MAIL); } catch (e) {}
    }

    // step: 'addr' (write the email), 'code' (write the code that came), or '' (no email sign-in)
    function showMail(step) {
      if (!ui.mail) return;
      ui.authOr.hidden = !step;
      ui.mail.hidden = step !== 'addr';
      ui.code.hidden = step !== 'code';
      if (step !== 'code') return;
      ui.codeSent.textContent = '';
      ui.codeSent.appendChild(document.createTextNode('أرسلنا كود إلى '));
      ui.codeSent.appendChild(el('b', null, mail.email));
      ui.codeSent.appendChild(document.createTextNode('. اكتبه هني، وإذا ما لقيته شوف الـ Spam.'));
      againTimer();
    }

    // Another code can be asked for a minute after the last one.
    function againTimer() {
      clearInterval(againT);
      var tick = function () {
        var left = Math.ceil((mail.at + 60000 - Date.now()) / 1000);
        ui.codeAgain.disabled = left > 0;
        label(ui.codeAgain).textContent = left > 0 ? 'تقدر تطلب كود ثاني بعد ' + left + ' ثانية' : 'ما وصلك؟ أرسله مرة ثانية';
        if (left <= 0) clearInterval(againT);
      };
      tick();
      againT = setInterval(tick, 1000);
    }

    function mailError(e, sending) {
      var code = String((e && e.code) || ''), said = String((e && e.message) || '');
      if ((e && e.status === 429) || /rate_limit/.test(code)) {
        return sending ? 'طلبت كود قبل شوي. انتظر دقيقة وجرّب مرة ثانية.' : 'جرّبت وايد. انتظر شوي وجرّب مرة ثانية.';
      }
      if (sending) return /email_address_invalid/.test(code) ? 'تأكد من الإيميل، شكله مو صحيح.' : 'ما قدرنا نرسل الكود الحين. جرّب مرة ثانية بعد شوي.';
      return /otp|expired|invalid/i.test(code + ' ' + said) ? 'الكود غلط أو انتهى. تأكد منه، أو اطلب كود جديد.' : 'ما زبط الدخول. تأكد من النت وجرّب مرة ثانية.';
    }

    // ٠١٢٣ typed or pasted from an Arabic keyboard is the code 0123
    function digitsOf(v) {
      return String(v || '').replace(/[٠-٩۰-۹]/g, function (d) { return String(d.charCodeAt(0) & 0xF); }).replace(/\D/g, '');
    }

    function sendCode(email, btn) {
      var a = accounts(), s = label(btn), was = s.textContent, again = btn === ui.codeAgain;
      if (!a) return;
      ui.authErr.hidden = true;
      btn.disabled = true; s.textContent = 'لحظة…';
      a.sendEmailCode(email).then(function () {
        mail = { email: email, at: Date.now() };
        keepMail();
        ui.codeIn.value = '';
        showMail('code');
        ui.codeIn.focus();
      }, function (err) {
        authError(mailError(err, true));
      }).then(function () {
        if (again) againTimer(); else { btn.disabled = false; s.textContent = was; }
      });
    }

    if (ui.mail) {
      ui.mail.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = ui.mailAddr.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          authError('اكتب إيميلك كامل، مثل name@gmail.com');
          ui.mailAddr.focus();
          return;
        }
        sendCode(email, ui.mailSend);
      });
      ui.code.addEventListener('submit', function (e) {
        e.preventDefault();
        var a = accounts(), code = digitsOf(ui.codeIn.value), s = label(ui.codeGo), was = s.textContent;
        if (!a || !mail.email) return;
        ui.authErr.hidden = true;
        if (code.length < 6) { authError('اكتب الكود كامل.'); ui.codeIn.focus(); return; }
        ui.codeGo.disabled = true; s.textContent = 'لحظة…';
        a.verifyEmailCode(mail.email, code).then(function () {
          ui.codeGo.disabled = false; s.textContent = was;
          forgetMail();
          closeSheet(ui.auth, true);
          afterSignIn();
        }, function (err) {
          ui.codeGo.disabled = false; s.textContent = was;
          authError(mailError(err, false));
          ui.codeIn.select();
        });
      });
      ui.codeAgain.addEventListener('click', function () { if (mail.email) sendCode(mail.email, ui.codeAgain); });
      ui.codeBack.addEventListener('click', function () {
        ui.authErr.hidden = true;
        ui.mailAddr.value = mail.email;
        forgetMail();
        showMail('addr');
        ui.mailAddr.focus();
      });
    }

    // Moves anything saved on this device into the account, then saves the relation that was waiting.
    function afterSignIn() {
      var a = accounts(), pending = st.pending, local = loadWallet().map(function (it) {
        var trail = replay(it.steps);
        return { me: it.me, them: it.them, steps: trail[trail.length - 1].path, at: it.at };
      });
      st.pending = null;
      var chain = Promise.resolve();
      if (local.length) chain = chain.then(function () { return a.save(local, true); }).then(function () { storeWallet([]); });
      if (pending) chain = chain.then(function () { return a.save([pending]); }).then(function () { flash(ui.save, 'انحفظت'); });
      chain.catch(function () { flash(ui.save, 'ما قدرت أحفظ، جرّب مرة ثانية', 2400); }).then(renderWallet);
    }

    // The walk starts from your name only once the person's name is written: until then that field turns red.
    function needThem(on) {
      var label = ui.them.parentNode;
      label.classList.remove('is-missing');
      if (on) { void label.offsetWidth; label.classList.add('is-missing'); }  // shakes again on every tap
      ui.need.hidden = !on;
    }

    ui.me.addEventListener('input', render);
    /* Another name is another person: writing it or wiping it takes the walk back to the start, and
       it goes on only once there is a name again (tapping your name asks for it). */
    ui.them.addEventListener('input', function () {
      var v = ui.them.value.trim();
      if (v) needThem(false);
      if (v !== st.them) {
        st.them = v;
        if (st.open || st.trail.length || st.done) { st.trail = []; st.open = false; st.done = false; st.added = null; }
      }
      render();
    });
    ui.done.addEventListener('click', function () {
      st.done = true; render();
      ui.result.focus({ preventScroll: true });
      ui.result.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    ui.back.addEventListener('click', function () {
      st.trail.pop(); st.done = false; st.open = true; render(); focusNext();
    });
    ui.reset.addEventListener('click', function () {
      st.trail = []; st.done = false; st.open = true; st.added = null; render(); focusNext();
    });
    ui.again.addEventListener('click', function () {
      st.trail = []; st.done = false; st.open = false; st.added = null;
      ui.them.value = ''; st.them = ''; render(); ui.them.focus();
    });

    function saveHere(item) {
      var list = loadWallet().filter(function (it) { return !(it.them === item.them && it.path === item.path); });
      list.unshift(item);
      if (storeWallet(list)) { flash(ui.save, 'انحفظت'); renderWallet(); }
      else flash(ui.save, 'ما قدرت أحفظ هني');
    }

    // Saving needs an account when accounts are on; without them the wallet stays on the device.
    if (ui.save) ui.save.addEventListener('click', function () {
      var n = names(), path = cur();
      var item = { id: Date.now().toString(36), me: n.me, them: n.them, steps: path.slice(), path: path.join(''), at: Date.now() };
      var waitFor = root.ACCOUNT ? root.ACCOUNT.ready : Promise.resolve(false);
      waitFor.then(function () {
        var a = accounts();
        if (!a) { saveHere(item); return; }
        if (!a.user()) { openAuth(item, ui.save); return; }
        ui.save.disabled = true;
        a.save([item]).then(function () { flash(ui.save, 'انحفظت'); renderWallet(); },
          function () { flash(ui.save, 'ما قدرت أحفظ، جرّب مرة ثانية', 2400); })
          .then(function () { ui.save.disabled = false; });
      });
    });

    ui.copy.addEventListener('click', function () {
      var n = names();
      copyText(sentence(cur(), n.them) + '\nشوف شنو يصير لك: shorbaka.com').then(function (ok) { if (ok) flash(ui.copy, 'انسخت'); });
    });

    // Resolves true once text is on the clipboard.
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
      }
      return Promise.resolve(legacyCopy(text));
    }
    KIN.copyText = copyText;

    function legacyCopy(text) {
      var t = el('textarea');
      t.value = text; t.setAttribute('readonly', '');
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      return ok;
    }

    // The sheet makes the picture as a story or as a post; the toggle at its top switches between them.
    var SIZES = {
      story: { label: 'ستوري', title: 'ستوريك جاهز', tip: 'حطها ستوري', alt: 'ستوري' },
      post: { label: 'بوست', title: 'بوستك جاهز', tip: 'نزّلها بوست', alt: 'بوست' }
    };
    var segs = ui.seg ? Array.prototype.slice.call(ui.seg.querySelectorAll('button')) : [];

    /* What the sheet is showing. A picture source is { file, make(format) -> Promise<Blob>, alt, mention }:
       the finder's relation here, or the family tree from tree.js. It can also bring a choice,
       choice: { label, items: [{ key, label }], value, set(key) }, shown under the size toggle (the tree's
       «الأسامي»: «كلها»، «بدون البنات»، «بس اسمي»), and switches under it, option: { label, hint, on, set(on) }
       or options (a list). And groups to pick from, picks: { label, items: [{ key, label, color }], value: [keys],
       set(keys) } («ربعي»: which of my groups show), as chips over the choice. With link, a button copies it
       (linkLabel: its words, «انسخ رابط الشجرة كاملة» when none).
       A source can bring its own sizes instead of story and post ({ key: { label, title, alt, dl } },
       sizesLabel), and make() can then resolve a file that isn't the picture shown: { file, name, type,
       preview, w, h } (the tree's PDF, with a picture of the page). */
    var pic = null, shown = 'story';
    function sizesOf(p) { return (p && p.sizes) || SIZES; }

    function finderPicture() {
      var n = names(), path = cur();
      return {
        file: 'shorbaka',
        make: function (format) { return makeStory(n.me, n.them, path, format); },
        alt: 'صلة القرابة بيني وبين ' + subject(path, n.them) + '. ' + sentence(path, n.them),
        mention: n.them ? 'تمنشن ' + n.them : 'تمنشنهم',
        text: 'شوف شنو يصير لك أي أحد على شرباكة: https://shorbaka.com'
      };
    }

    function showImage(format) {
      var p = pic, t = sizesOf(p)[format];
      return p.make(format).then(function (res) {
        if (!res) throw new Error('no image');
        var isPic = typeof Blob === 'undefined' || res instanceof Blob, shot = isPic ? res : res.preview, out = isPic ? res : res.file;
        var name = isPic ? p.file + '-' + format + '.png' : res.name;
        if (url) URL.revokeObjectURL(url);
        if (dlUrl && dlUrl !== url) URL.revokeObjectURL(dlUrl);
        url = URL.createObjectURL(shot);
        dlUrl = isPic ? url : URL.createObjectURL(out);
        file = typeof File === 'function' ? new File([out], name, { type: isPic ? 'image/png' : res.type }) : null;
        ui.img.setAttribute('width', isPic ? 1080 : res.w);
        ui.img.setAttribute('height', isPic ? FORMATS[format].H : res.h);
        ui.img.src = url;
        ui.img.alt = t.alt + ': ' + p.alt;
        ui.dl.href = dlUrl;
        ui.dl.setAttribute('download', name);
        label(ui.dl).textContent = t.dl || 'حمّل الصورة';
        ui.modal.classList.toggle('is-page', !isPic);
        ui.share.hidden = !(file && navigator.canShare && navigator.canShare({ files: [file] }));
        if (ui.mTitle) ui.mTitle.textContent = t.title;
        ui.tip.textContent = p.tips && p.tips[format] ? p.tips[format] : t.tip + '، ولا تنسى ' + p.mention;
        segs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.format === format)); });
        shown = format;
      });
    }

    // While a picture is being drawn, the toggle, the picks, the choice and the switches wait.
    function busy(on) {
      segs.forEach(function (x) { x.disabled = on; });
      pickBtns().forEach(function (x) { x.disabled = on; });
      choiceBtns().forEach(function (x) { x.disabled = on; });
      toggles.forEach(function (t) { t.box.disabled = on; });
      ui.img.classList.toggle('is-busy', on);
    }

    /* Up to two switches under the size toggle: a source brings option, or options (a list; the
       tree's PDF has «أخفي أسامي البنات» and its QR). */
    var toggles = [
      { wrap: ui.opt, box: ui.optBox, text: ui.optText, hint: ui.optHint },
      { wrap: ui.opt2, box: ui.opt2Box, text: ui.opt2Text, hint: ui.opt2Hint }
    ].filter(function (t) { return t.wrap && t.box; });
    function optionsOf(p) { return ((p && (p.options || [p.option])) || []).filter(Boolean); }

    // more: rows already shown above the switches (the choice), for the room the picture leaves them
    function showOptions(list, more) {
      toggles.forEach(function (t, i) {
        var o = list[i];
        t.wrap.hidden = !o;
        if (!o) return;
        t.box.checked = !!o.on;
        t.text.textContent = o.label;
        t.hint.textContent = o.hint || '';
      });
      var rows = list.length + (more || 0);
      ui.modal.classList.toggle('has-opt', rows > 0);
      ui.modal.classList.toggle('has-opt2', rows > 1);
      ui.modal.classList.toggle('has-opt3', rows > 2);
    }

    /* The source's groups as chips: «الكل» and one for each group (Ali: one group, two, or all of them).
       With all of them on, a tap on one leaves only it; after that each tap adds one or takes one off, and
       taking off the last one brings back all. The picture is drawn again each time; if it can't be, the
       pick goes back. */
    function pickBtns() { return ui.picksRow ? Array.prototype.slice.call(ui.picksRow.querySelectorAll('button')) : []; }
    function pressPicks(c) {
      var all = c.value.length >= c.items.length;
      pickBtns().forEach(function (b) {
        var on = b.dataset.key === '*' ? all : !all && c.value.indexOf(b.dataset.key) >= 0;
        b.setAttribute('aria-pressed', String(on));
      });
    }
    function showPicks(c) {
      if (!ui.picks || !ui.picksRow) return 0;
      ui.picks.hidden = !c;
      ui.picksRow.textContent = '';
      if (!c) return 0;
      ui.picksText.textContent = c.label;
      var keys = c.items.map(function (it) { return it.key; });
      [{ key: '*', label: 'الكل' }].concat(c.items).forEach(function (it) {
        var b = document.createElement('button'), s = document.createElement('span');
        b.type = 'button';
        b.className = 'kin-pick';
        b.dataset.key = it.key;
        if (it.color) { var dot = document.createElement('i'); dot.style.background = it.color; b.appendChild(dot); }
        s.textContent = it.label;
        b.appendChild(s);
        b.addEventListener('click', function () {
          if (!pic || pic.picks !== c) return;
          var was = c.value.slice(), all = was.length >= keys.length, next;
          if (it.key === '*') { if (all) return; next = keys; }
          else if (all) next = [it.key];
          else if (was.indexOf(it.key) >= 0) next = was.length > 1 ? was.filter(function (k) { return k !== it.key; }) : keys;
          else next = keys.filter(function (k) { return k === it.key || was.indexOf(k) >= 0; });
          c.set(next); c.value = next;
          pressPicks(c);
          busy(true);
          showImage(shown).catch(function () {
            c.set(was); c.value = was;
            pressPicks(c);
            flash(b, 'ما زبطت', 2000);
          }).then(function () { busy(false); });
        });
        ui.picksRow.appendChild(b);
      });
      pressPicks(c);
      // the rows the chips take, for the room the picture leaves them
      return c.items.length > 3 ? 2 : 1;
    }

    /* The source's choice, as a small toggle of its own: the picture is drawn again when it changes, and
       if it can't be, the choice goes back. When the source's value isn't one of the items (the tree hides
       girls' names, and this side of it has none), the first item shows pressed. */
    function choiceBtns() { return ui.choiceSeg ? Array.prototype.slice.call(ui.choiceSeg.querySelectorAll('button')) : []; }
    function pressChoice(key) { choiceBtns().forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.key === key)); }); }
    function showChoice(c) {
      if (!ui.choice || !ui.choiceSeg) return false;
      ui.choice.hidden = !c;
      ui.choiceSeg.textContent = '';
      if (!c) return false;
      ui.choiceText.textContent = c.label;
      var on = c.items.some(function (it) { return it.key === c.value; }) ? c.value : c.items[0].key;
      c.items.forEach(function (it) {
        var b = document.createElement('button'), s = document.createElement('span');
        b.type = 'button';
        b.dataset.key = it.key;
        s.textContent = it.label;
        b.appendChild(s);
        b.addEventListener('click', function () {
          if (b.getAttribute('aria-pressed') === 'true' || !pic || pic.choice !== c) return;
          var was = c.value, wasOn = (choiceBtns().filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; })[0] || {}).dataset;
          c.set(it.key); c.value = it.key;
          pressChoice(it.key);
          busy(true);
          showImage(shown).catch(function () {
            c.set(was); c.value = was;
            pressChoice(wasOn ? wasOn.key : was);
            flash(b, 'ما زبطت', 2000);
          }).then(function () { busy(false); });
        });
        ui.choiceSeg.appendChild(b);
      });
      pressChoice(on);
      return true;
    }

    // The size toggle shows the source's own sizes (story and post, or the page across and up and down).
    function showSizes(p) {
      var sizes = sizesOf(p), keys = Object.keys(sizes);
      segs.forEach(function (b, i) {
        b.hidden = i >= keys.length;
        if (i >= keys.length) return;
        b.dataset.format = keys[i];
        label(b).textContent = sizes[keys[i]].label;
      });
      if (ui.seg) ui.seg.setAttribute('aria-label', p.sizesLabel || 'مقاس الصورة');
      return keys[0];
    }

    // Opens the sheet with the first size (a story); the button shows «لحظة…» while the picture is drawn.
    function openShare(source, from) {
      var s = label(from), was = s.textContent;
      pic = source;
      var first = showSizes(source);
      showOptions(optionsOf(source), showPicks(source.picks) + (showChoice(source.choice) ? 1 : 0));
      if (ui.mLink) {
        // «انسخ رابط الشجرة كاملة», or the source's own words for its link («انسخ رابط ربعي»)
        var ml = label(ui.mLink);
        clearTimeout(ui.mLink._t);
        ml.textContent = ml.dataset.label = source.linkLabel || 'انسخ رابط الشجرة كاملة';
        ui.mLink.hidden = !source.link;
      }
      ui.modal.classList.toggle('has-link', !!(ui.mLink && source.link));
      from.disabled = true; s.textContent = 'لحظة…';
      return showImage(first).then(function () {
        openSheet(ui.modal, from);
        s.textContent = was;
      }).catch(function () {
        s.textContent = was;
        flash(from, 'ما زبطت، جرّب مرة ثانية', 2400);
      }).then(function () { from.disabled = false; });
    }

    ui.story.addEventListener('click', function () { openShare(finderPicture(), ui.story); });

    if (ui.addTree) {
      ui.addTree.addEventListener('click', function () {
        var n = names(), r = root.TREE && root.TREE.addFromFinder ? root.TREE.addFromFinder(walkSteps(), n.them) : null;
        if (!r) { flash(ui.addTree, 'ما زبطت، جرّب مرة ثانية', 2400); return; }
        // the walk now goes through the tree: its steps get their people (and names, where there are)
        var doc = root.TREE.current();
        st.trail.forEach(function (info, i) {
          if (info.pid || !r.pids[i]) return;
          info.pid = r.pids[i];
          info.main = info.main + ' (' + ((doc && doc.p[info.pid].n) || 'بدون اسم') + ')';
        });
        st.added = r.pid;
        render();
        ui.rSee.focus({ preventScroll: true });
      });
      ui.rSee.addEventListener('click', function () {
        var last = st.trail[st.trail.length - 1];
        if (last && last.pid && root.TREE.reveal) root.TREE.reveal(last.pid);
        if (history.replaceState) history.replaceState(null, '', '#tree');
        showSection('tree', true);
      });
    }

    segs.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-pressed') === 'true') return;
        busy(true);
        showImage(b.dataset.format).catch(function () { flash(b, 'ما زبطت', 2000); }).then(function () { busy(false); });
      });
    });

    toggles.forEach(function (t, i) {
      t.box.addEventListener('change', function () {
        var o = optionsOf(pic)[i], on = t.box.checked;
        if (!o) return;
        o.set(on);
        busy(true);
        showImage(shown).catch(function () {
          // the picture couldn't be drawn again: the switch goes back to what the picture shows
          o.set(!on);
          t.box.checked = !on;
        }).then(function () { busy(false); });
      });
    });

    // the source's link (the tree's «رابط الشجرة كاملة»), for Instagram's link sticker
    if (ui.mLink) ui.mLink.addEventListener('click', function () {
      if (!pic || !pic.link) return;
      copyText(pic.link).then(function (ok) { flash(ui.mLink, ok ? 'انتسخ الرابط ✓' : 'ما انتسخ، جرّب مرة ثانية', 2200); });
    });

    ui.close.addEventListener('click', function () { closeSheet(ui.modal); });
    if (ui.authClose) ui.authClose.addEventListener('click', function () { st.pending = null; closeSheet(ui.auth); });
    if (ui.authLocal) ui.authLocal.addEventListener('click', function () {
      var item = st.pending;
      st.pending = null;
      closeSheet(ui.auth);
      if (item) saveHere(item);
    });
    [ui.modal, ui.auth].forEach(function (m) {
      if (m) m.addEventListener('click', function (e) { if (e.target === m) { if (m === ui.auth) st.pending = null; closeSheet(m); } });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (sheet) { if (sheet === ui.auth) st.pending = null; closeSheet(sheet); }
      else if (ui.acctMenu && !ui.acctMenu.hidden) closeMenu(true);
    });

    if (ui.wIn) ui.wIn.addEventListener('click', function () { openAuth(null, ui.wIn); });
    if (ui.acctBox) {
      ui.acctIn.addEventListener('click', function () { openAuth(null, ui.acctIn); });
      ui.acctBtn.addEventListener('click', function () { if (ui.acctMenu.hidden) openMenu(); else closeMenu(); });
      document.addEventListener('click', function (e) {
        if (!ui.acctMenu.hidden && !ui.acctBox.contains(e.target)) closeMenu();
      });
      ui.acctWallet.addEventListener('click', function () {
        closeMenu();
        if (KIN.showSection) KIN.showSection('kin');
        ui.wallet.scrollIntoView({ block: 'start', behavior: 'smooth' });
        ui.wallet.focus({ preventScroll: true });
      });
      // Admins get «لوحة التحكم» (/dash/) in the menu; the dashboard has «الموقع» to come back.
      var acctDash = $('acct-dash');
      if (acctDash) {
        var dashCheck = function (u) {
          acctDash.hidden = true;
          var a = accounts();
          if (u && a && a.isAdmin) a.isAdmin().then(function (yes) {
            var now = a.user();
            acctDash.hidden = !(yes && now && now.id === u.id);
          });
        };
        if (root.ACCOUNT) {
          root.ACCOUNT.onChange(dashCheck);
          root.ACCOUNT.ready.then(function () { dashCheck(root.ACCOUNT.user()); });
        }
      }
      ui.acctOut.addEventListener('click', function () {
        var a = accounts();
        closeMenu();
        if (a) a.signOut().then(function () { renderWallet(); ui.acctIn.focus({ preventScroll: true }); });
      });
      ui.acctDel.addEventListener('click', function () { askDelete(true); });
      ui.acctNo.addEventListener('click', function () { askDelete(false); ui.acctDel.focus({ preventScroll: true }); });
      ui.acctYes.addEventListener('click', function () {
        var a = accounts();
        if (!a) return;
        ui.acctYes.disabled = ui.acctNo.disabled = true;
        ui.acctErr.hidden = true;
        a.deleteAccount().then(function () {
          closeMenu();
          renderWallet();
          ui.acctIn.focus({ preventScroll: true });
        }, function () {
          ui.acctYes.disabled = ui.acctNo.disabled = false;
          ui.acctErr.hidden = false;
        });
      });
    }
    // The picture goes with a sentence and the link (where the app keeps text, like WhatsApp).
    ui.share.addEventListener('click', function () {
      if (!file) return;
      var data = { files: [file] };
      if (pic && pic.text) data.text = pic.text;
      navigator.share(data).catch(function (e) {
        if (data.text && e && e.name === 'TypeError') navigator.share({ files: [file] }).catch(function () {});
      });
    });

    /* Four sections share the page under the hero: «شنو يصير لك؟» (with the saved list), «شجرة عائلتي»
       (tree.js), «شجرة دوامي» (work.js) and «ربعي» (friends.js). The switcher under the hero picks one;
       #tree, #work or #friends in the address opens that section. */
    var mainEl = document.querySelector('main');
    var secLinks = Array.prototype.slice.call(document.querySelectorAll('.sec'));
    function showSection(name, scroll) {
      if (!mainEl) return;
      name = (name === 'tree' || name === 'work' || name === 'friends' || name === 'game') && $(name) ? name : 'kin';
      mainEl.setAttribute('data-sec', name);
      secLinks.forEach(function (a) {
        if (a.dataset.sec === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      if (root.TREE && root.TREE.shown) root.TREE.shown(name === 'tree');
      if (root.WORK && root.WORK.shown) root.WORK.shown(name === 'work');
      if (root.FRIENDS && root.FRIENDS.shown) root.FRIENDS.shown(name === 'friends');
      if (root.GAME && root.GAME.shown) root.GAME.shown(name === 'game');
      if (name === 'kin') render();  // names from the tree may have changed meanwhile
      if (scroll) $(name).scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    secLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (history.replaceState) history.replaceState(null, '', '#' + a.dataset.sec);
        showSection(a.dataset.sec, true);
      });
    });
    function hashSec() {
      var h = location.hash;
      return h === '#tree' ? 'tree' : h === '#work' ? 'work' : h === '#friends' ? 'friends' : h === '#game' ? 'game' : 'kin';
    }
    window.addEventListener('hashchange', function () { showSection(hashSec(), hashSec() !== 'kin'); });
    showSection(hashSec(), false);
    if (hashSec() !== 'kin' && $(hashSec())) setTimeout(function () { $(hashSec()).scrollIntoView({ block: 'start' }); }, 0);
    var acctTree = $('acct-tree');
    if (acctTree) acctTree.addEventListener('click', function () {
      closeMenu();
      if (history.replaceState) history.replaceState(null, '', '#tree');
      showSection('tree', true);
      $('tree').focus({ preventScroll: true });
    });

    KIN.openShare = openShare;
    KIN.openAuth = function (copy, from) { openAuth(null, from, copy); };
    KIN.showSection = showSection;
    KIN.treeChanged = function () { render(); };

    render();
    renderWallet();
    if (root.ACCOUNT) {
      root.ACCOUNT.onChange(renderWallet);
      // The top of the page waits until we know whether they are signed in, so it doesn't flicker.
      root.ACCOUNT.ready.then(function () { acctReady = true; renderWallet(); });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
