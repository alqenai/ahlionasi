/* شرباكة: "شنو يقرب لك؟"
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

  function makeStory(meName, themName, path, format) {
    var F = FORMATS[format] || FORMATS.story;
    var subj = subject(path, themName), rel = phrase(path), more = extra(path, themName);
    return loadFonts('صلة القرابة بيني وبين ' + subj + ' ' + rel + ' ' + (meName || 'أنا') + ' ' + more).then(function () {
      var W = 1080, H = F.H, k = H / 1920, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');

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
      drawWalk(ctx, path, meName, themName, box);

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

  // Rebuild the walk from the steps that were tapped; null if anything is off.
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
      me: $('kin-me'), them: $('kin-them'), path: $('kin-path'), next: $('kin-next'),
      opts: $('kin-opts'), max: $('kin-max'), actions: $('kin-actions'), done: $('kin-done'),
      back: $('kin-back'), reset: $('kin-reset'), result: $('kin-result'), rLabel: $('kin-r-label'),
      rSentence: $('kin-r-sentence'), rExtra: $('kin-r-extra'), story: $('kin-story'), save: $('kin-save'),
      copy: $('kin-copy'), again: $('kin-again'), wallet: $('kin-wallet'), wCount: $('kin-w-count'),
      wList: $('kin-w-list'), wNote: $('kin-w-note'), wEmpty: $('kin-w-empty'), wIn: $('kin-w-in'), modal: $('kin-modal'),
      img: $('kin-img'), share: $('kin-share'), dl: $('kin-dl'), close: $('kin-close'), tip: $('kin-tip'),
      mTitle: $('kin-m-title'), seg: $('kin-seg'),
      privacy: $('kin-privacy-text'), auth: $('kin-auth'), authTitle: $('kin-auth-title'),
      authText: $('kin-auth-text'), gbtn: $('kin-gbtn'), authErr: $('kin-auth-err'), authClose: $('kin-auth-close'),
      authHint: $('kin-auth-hint'), authLocal: $('kin-auth-local'),
      acctBox: $('acct'), acctIn: $('acct-in'), acctBtn: $('acct-btn'), acctAv: $('acct-av'), acctFirst: $('acct-first'),
      acctMenu: $('acct-menu'), acctAvLg: $('acct-av-lg'), acctName: $('acct-name'), acctEmail: $('acct-email'),
      acctWallet: $('acct-wallet'), acctCount: $('acct-count'), acctOut: $('acct-out'), acctDel: $('acct-del'),
      acctConfirm: $('acct-confirm'), acctYes: $('acct-yes'), acctNo: $('acct-no'), acctErr: $('acct-err')
    };
    if (!ui.path) return;

    var st = { trail: [], open: false, done: false, pending: null }, file = null, url = null;
    var sheet = null, sheetFrom = null, wSeq = 0, acctReady = !root.ACCOUNT;

    // The account system, when it is switched on and loaded; null otherwise.
    function accounts() { return root.ACCOUNT && root.ACCOUNT.on() ? root.ACCOUNT : null; }

    function cur() { return st.trail.length ? st.trail[st.trail.length - 1].path : []; }
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
      var li = el('li', 'kin-node' + (isCur ? ' is-cur' : '') + (i < 0 ? ' is-me' : ''));
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
        st.trail = i < 0 ? [] : st.trail.slice(0, i + 1);
        st.open = true; st.done = false;
        render();
        focusNext();
      });
      li.appendChild(b);
      if (i < 0 && !st.open) li.appendChild(el('span', 'kin-tap', 'دوس على اسمك'));
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

      var opts = st.open && !st.done ? options(path) : [];
      ui.opts.textContent = '';
      opts.forEach(function (s, i) { ui.opts.appendChild(option(chip(path, s), i)); });
      ui.next.hidden = !opts.length;
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
        ui.wEmpty.textContent = failed ? 'ما قدرنا نجيب محفظتك الحين، جرّب بعد شوي.'
          : inAccount ? 'محفظتك فاضية. احفظ أي صلة قرابة وبتلقاها هني.'
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
          ui.me.value = it.me; ui.them.value = it.them;
          st.trail = trail; st.open = true; st.done = true;
          render();
          ui.result.focus({ preventScroll: true });
          ui.result.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        var del = el('button', 'kin-w-del');
        del.type = 'button';
        del.appendChild(el('span', null, 'شيل'));
        del.setAttribute('aria-label', 'شيل ' + subject(path, it.them) + ' من المحفظة');
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
        li.appendChild(del);
        ui.wList.appendChild(li);
      });
    }

    function renderAccount() {
      var a = accounts();
      if (ui.privacy) {
        ui.privacy.textContent = a ? 'الأسماء ما تطلع من جهازك إلا اللي تحفظها بمحفظتك.'
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

    function closeSheet(m, keepFocus) {
      if (!m || m.hidden) return;
      m.hidden = true;
      document.documentElement.classList.remove('kin-lock');
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

    // Sign-in sheet. pending is the relation to save once the person is in.
    function openAuth(pending, from) {
      var a = accounts();
      if (!a || !ui.auth) return;
      var stuck = inAppBrowser();
      st.pending = pending || null;
      ui.authTitle.textContent = pending ? 'احفظها بحسابك' : 'سجّل دخولك';
      ui.authText.textContent = pending
        ? 'سجّل دخولك بجوجل عشان تنحفظ صلة القرابة بمحفظتك، وتلقاها من أي جهاز.'
        : 'سجّل دخولك بجوجل عشان تشوف محفظتك وتحفظ فيها من أي جهاز.';
      ui.authErr.hidden = true;
      if (ui.authHint) ui.authHint.hidden = !stuck;
      showLocal(stuck);
      ui.gbtn.textContent = 'لحظة…';
      openSheet(ui.auth, from);
      a.googleButton(ui.gbtn, function (err) {
        if (err) { authError('ما زبط الدخول، جرّب مرة ثانية.'); return; }
        closeSheet(ui.auth, true);
        afterSignIn();
      }).catch(function () {
        ui.gbtn.textContent = '';
        authError('ما قدرنا نفتح دخول جوجل. تأكد من النت وجرّب مرة ثانية.');
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

    ui.me.addEventListener('input', render);
    ui.them.addEventListener('input', render);
    ui.done.addEventListener('click', function () {
      st.done = true; render();
      ui.result.focus({ preventScroll: true });
      ui.result.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    ui.back.addEventListener('click', function () {
      st.trail.pop(); st.done = false; st.open = true; render(); focusNext();
    });
    ui.reset.addEventListener('click', function () {
      st.trail = []; st.done = false; st.open = true; render(); focusNext();
    });
    ui.again.addEventListener('click', function () {
      st.trail = []; st.done = false; st.open = true;
      ui.them.value = ''; render(); ui.them.focus();
    });

    function saveHere(item) {
      var list = loadWallet().filter(function (it) { return !(it.them === item.them && it.path === item.path); });
      list.unshift(item);
      if (storeWallet(list)) { flash(ui.save, 'انحفظت بمحفظتك'); renderWallet(); }
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
      var text = sentence(cur(), n.them) + '\nشوف شنو يقرب لك: shorbaka.com';
      var ok = function () { flash(ui.copy, 'انسخت'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, function () { if (legacyCopy(text)) ok(); });
      } else if (legacyCopy(text)) { ok(); }
    });

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
      story: { title: 'ستوريك جاهز', tip: 'حطها ستوري', alt: 'ستوري', file: 'shorbaka-story.png' },
      post: { title: 'بوستك جاهز', tip: 'نزّلها بوست', alt: 'بوست', file: 'shorbaka-post.png' }
    };
    var segs = ui.seg ? Array.prototype.slice.call(ui.seg.querySelectorAll('button')) : [];

    function showImage(format) {
      var n = names(), path = cur(), t = SIZES[format];
      return makeStory(n.me, n.them, path, format).then(function (blob) {
        if (!blob) throw new Error('no image');
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        file = typeof File === 'function' ? new File([blob], t.file, { type: 'image/png' }) : null;
        ui.img.setAttribute('height', FORMATS[format].H);
        ui.img.src = url;
        ui.img.alt = t.alt + ': صلة القرابة بيني وبين ' + subject(path, n.them) + '. ' + sentence(path, n.them);
        ui.dl.href = url;
        ui.dl.setAttribute('download', t.file);
        ui.share.hidden = !(file && navigator.canShare && navigator.canShare({ files: [file] }));
        if (ui.mTitle) ui.mTitle.textContent = t.title;
        ui.tip.textContent = t.tip + '، ولا تنسى ' + (n.them ? 'تمنشن ' + n.them : 'تمنشنهم');
        segs.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.format === format)); });
      });
    }

    ui.story.addEventListener('click', function () {
      var s = label(ui.story), was = s.textContent;
      ui.story.disabled = true; s.textContent = 'لحظة…';
      showImage('story').then(function () {
        openSheet(ui.modal, ui.story);
        s.textContent = was;
      }).catch(function () {
        s.textContent = was;
        flash(ui.story, 'ما زبطت، جرّب مرة ثانية', 2400);
      }).then(function () { ui.story.disabled = false; });
    });

    segs.forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-pressed') === 'true') return;
        segs.forEach(function (x) { x.disabled = true; });
        ui.img.classList.add('is-busy');
        showImage(b.dataset.format).catch(function () { flash(b, 'ما زبطت', 2000); }).then(function () {
          ui.img.classList.remove('is-busy');
          segs.forEach(function (x) { x.disabled = false; });
        });
      });
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
        ui.wallet.scrollIntoView({ block: 'start', behavior: 'smooth' });
        ui.wallet.focus({ preventScroll: true });
      });
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
    ui.share.addEventListener('click', function () {
      if (file) navigator.share({ files: [file] }).catch(function () {});
    });

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
