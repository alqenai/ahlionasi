/* شرباكة: «تحدي» (#game). Ten random questions about family: a small map of you and someone
   («شنو يصير لك؟»), or a question / riddle, each with three answers and one of them right. At the end
   the score, which can be shared as a story or a post (through kin.js's share sheet).
   The questions come from public.game_questions (edited from /dash/ → «الأسئلة»); game-bank.js is the
   list played when the database can't be reached. GAME.mapSvg draws the map here and in the dashboard. */
(function (root) {
  'use strict';

  var URL_ = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/game_questions';
  var KEY = 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe';  // public key
  var SEEN = 'shorbaka.game.seen';
  var ROUND = 5;  // Ali (2026-11-03): five a round

  /* ---------- The map ---------- */

  // t: where the step goes in the tree, g: gender, c: the word before «ه / ها» («أخوه», «بنتها»), p: with «my».
  var STEPS = {
    F: { t: 'up', g: 'm', c: 'أبو', p: 'أبوي' },
    M: { t: 'up', g: 'f', c: 'أم', p: 'أمي' },
    B: { t: 'side', g: 'm', c: 'أخو', p: 'أخوي' },
    Z: { t: 'side', g: 'f', c: 'أخت', p: 'أختي' },
    S: { t: 'down', g: 'm', c: 'ولد', p: 'ولدي' },
    D: { t: 'down', g: 'f', c: 'بنت', p: 'بنتي' },
    H: { t: 'mate', g: 'm', c: 'زوج', p: 'زوجي' },
    W: { t: 'mate', g: 'f', c: 'زوجت', p: 'زوجتي' }
  };
  var COL = { me: '#F4EFE6', up: '#FF8A80', side: '#E9C46A', down: '#2EC4B6', mate: '#8FB8DE' };

  function cleanPath(p) { return String(p || '').toUpperCase().replace(/[^FMBZSDHW]/g, '').slice(0, 8); }

  // «أنا», «أبوي», «أخوه», «ولده», …: each one said from the one before it, so the map doesn't give the answer away.
  function stepLabels(path) {
    var out = ['أنا'];
    for (var i = 0; i < path.length; i++) {
      var s = STEPS[path[i]];
      out.push(i === 0 ? s.p : s.c + (STEPS[path[i - 1]].g === 'm' ? 'ه' : 'ها'));
    }
    return out;
  }

  // Up is a generation up, down a generation down; brothers, sisters and spouses sit beside (to the left).
  function layout(path) {
    var x = 0, y = 0, pts = [{ x: 0, y: 0, t: 'me' }];
    for (var i = 0; i < path.length; i++) {
      var t = STEPS[path[i]].t;
      if (t === 'up') y -= 1; else if (t === 'down') y += 1; else x -= 1;
      pts.push({ x: x, y: y, t: t });
    }
    return pts;
  }

  var measurer = null;
  function textW(text, size, weight) {
    if (typeof document !== 'undefined') {
      try {
        measurer = measurer || document.createElement('canvas').getContext('2d');
        measurer.font = (weight || 500) + ' ' + size + 'px "Readex Pro", system-ui, sans-serif';
        return measurer.measureText(text).width;
      } catch (e) {}
    }
    return text.length * size * 0.58;
  }
  function overlap(a, b) {
    var w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* The map as an SVG string. opts.answer: the person's label once answered (instead of «؟»). */
  function mapSvg(rawPath, opts) {
    opts = opts || {};
    var path = cleanPath(rawPath).split('').filter(Boolean);
    var pts = layout(path), names = opts.names || stepLabels(path), n = pts.length;
    var cell = 92, r = 17, rEnd = 22, fs = 16;
    var P = pts.map(function (p, i) { return { x: p.x * cell, y: p.y * cell, r: i === 0 || i === n - 1 ? rEnd : r }; });
    var taken = P.map(function (p) { return { x0: p.x - p.r, y0: p.y - p.r, x1: p.x + p.r, y1: p.y + p.r }; });
    for (var i = 1; i < n; i++) {
      var a = P[i - 1], b = P[i];
      taken.push({ x0: Math.min(a.x, b.x) - 5, y0: Math.min(a.y, b.y) - 5, x1: Math.max(a.x, b.x) + 5, y1: Math.max(a.y, b.y) + 5 });
    }
    var labels = [];
    for (var k = 0; k < n; k++) {
      var text = k === n - 1 && n > 1 ? (opts.answer || opts.endName || '') : names[k];
      if (!text) continue;
      var bold = k === 0 || k === n - 1, size = bold ? fs + 1 : fs, w = textW(text, size, bold ? 700 : 500), q = P[k];
      var edge = {};
      [k - 1, k + 1].forEach(function (m) {
        if (m < 0 || m >= n) return;
        var dx = pts[m].x - pts[k].x, dy = pts[m].y - pts[k].y;
        if (dx < 0) edge.left = true; if (dx > 0) edge.right = true;
        if (dy < 0) edge.above = true; if (dy > 0) edge.below = true;
      });
      var best = null;
      ['below', 'above', 'right', 'left'].forEach(function (pos) {
        var x, y, anchor;
        if (pos === 'below') { anchor = 'middle'; x = q.x; y = q.y + q.r + 8 + size * 0.85; }
        else if (pos === 'above') { anchor = 'middle'; x = q.x; y = q.y - q.r - 10; }
        else if (pos === 'right') { anchor = 'start'; x = q.x + q.r + 10; y = q.y + size * 0.35; }
        else { anchor = 'end'; x = q.x - q.r - 10; y = q.y + size * 0.35; }
        var x0 = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w;
        var bb = { x0: x0 - 4, x1: x0 + w + 4, y0: y - size * 0.85 - 3, y1: y + size * 0.3 + 3 };
        var cost = edge[pos] ? 1e9 : 0;
        taken.forEach(function (t) { cost += overlap(bb, t); });
        if (!best || cost < best.cost) best = { cost: cost, x: x, y: y, anchor: anchor, bb: bb, text: text, size: size, bold: bold };
      });
      taken.push(best.bb);
      labels.push(best);
    }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    taken.forEach(function (b) { x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1); });
    var pad = 10; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    var s = '<svg class="gm-map-svg" direction="ltr" style="direction:ltr" viewBox="' + [x0, y0, x1 - x0, y1 - y0].map(Math.round).join(' ') +
      '" width="' + Math.round((x1 - x0) * (opts.scale || 1.5)) + '" height="' + Math.round((y1 - y0) * (opts.scale || 1.5)) + '" role="img" aria-label="' +
      esc(names.join('، ') + (n > 1 ? '، ؟' : '')) + '">';
    for (var j = 1; j < n; j++) {
      var A = P[j - 1], Bq = P[j], t = pts[j].t;
      s += '<line x1="' + A.x + '" y1="' + A.y + '" x2="' + Bq.x + '" y2="' + Bq.y + '" stroke="' + COL[t] +
        '" stroke-width="5" stroke-linecap="round"' + (t === 'side' ? ' stroke-dasharray="10 11"' : '') + '/>';
      if (t === 'mate') {
        var mx = (A.x + Bq.x) / 2, my = (A.y + Bq.y) / 2;
        s += '<circle cx="' + (mx + 5) + '" cy="' + my + '" r="8" fill="none" stroke="#8FB8DE" stroke-width="3"/>' +
          '<circle cx="' + (mx - 5) + '" cy="' + my + '" r="8" fill="none" stroke="#F4EFE6" stroke-width="3"/>';
      }
    }
    for (var m = 0; m < n; m++) {
      var p = P[m], start = m === 0, end = m === n - 1 && n > 1;
      var ring = start ? '#F4EFE6' : end ? '#E9C46A' : COL[pts[m].t];
      if (end) s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (p.r + 7) + '" fill="rgba(233,196,106,.18)"/>';
      s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '" fill="' + (end ? '#1B3E62' : '#173B5F') + '" stroke="' + ring + '" stroke-width="4"/>';
      if (end && !opts.answer) s += '<text x="' + p.x + '" y="' + (p.y + 8) + '" text-anchor="middle" font-size="22" font-weight="700" fill="#E9C46A">؟</text>';
      else s += '<circle cx="' + (p.x - p.r * 0.3) + '" cy="' + (p.y - p.r * 0.3) + '" r="' + (p.r * 0.28) + '" fill="rgba(255,255,255,.75)"/>';
    }
    labels.forEach(function (l) {
      s += '<text x="' + l.x.toFixed(1) + '" y="' + l.y.toFixed(1) + '" text-anchor="' + l.anchor + '" font-size="' + l.size +
        '" font-weight="' + (l.bold ? 700 : 500) + '" fill="' + (l.bold ? (l.text === names[0] ? '#F4EFE6' : '#E9C46A') : '#C9D6E3') + '">' + esc(l.text) + '</text>';
    });
    return s + '</svg>';
  }

  /* ---------- Questions ---------- */

  function clean(q, i) {
    if (!q || !Array.isArray(q.a) || q.a.length < 3) return null;
    var a = q.a.slice(0, 3).map(function (x) { return String(x || '').trim(); });
    if (a.some(function (x) { return !x; })) return null;
    var k = q.k === 'map' ? 'map' : 'text', p = cleanPath(q.p);
    if (k === 'map' && !p) return null;
    if (k === 'text' && !String(q.q || '').trim()) return null;
    return { id: q.id != null ? String(q.id) : 'b' + i, k: k, q: String(q.q || '').trim(), p: p, a: a };
  }
  function bank() { return (root.GAME_BANK || []).map(clean).filter(Boolean); }

  var loaded = null;
  function load() {
    if (loaded) return loaded;
    var fromDb = typeof fetch !== 'function' ? Promise.reject() : fetch(URL_, {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}'
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (list) {
      var qs = Array.isArray(list) ? list.map(clean).filter(Boolean) : [];
      if (qs.length < 3) throw new Error('no questions');
      return qs;
    });
    var wait = new Promise(function (res, rej) { setTimeout(rej, 4000); });
    loaded = Promise.race([fromDb, wait]).catch(function () { loaded = null; return bank(); });
    return loaded;
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // Ten at random, the ones not played lately first, so a second round brings new questions.
  function pick(all) {
    var seen = [];
    try { seen = JSON.parse(localStorage.getItem(SEEN) || '[]'); } catch (e) {}
    if (!Array.isArray(seen)) seen = [];
    var fresh = shuffle(all.filter(function (q) { return seen.indexOf(q.id) < 0; }));
    var old = shuffle(all.filter(function (q) { return seen.indexOf(q.id) >= 0; }));
    // Ali (2026-11-03): mix them, not maps only. Each round: one question from a family tree (theirs, or
    // an example one; see treeQuestion), two maps, and the rest riddles and questions, shuffled.
    var want = { map: 2, text: ROUND - 3 }, round = [], rest = [];
    fresh.concat(old).forEach(function (q) {
      if (want[q.k] > 0) { want[q.k]--; round.push(q); } else rest.push(q);
    });
    round = round.concat(rest.slice(0, Math.max(0, ROUND - 1 - round.length)));
    var keep = seen.filter(function (id) { return !round.some(function (q) { return q.id === id; }); })
      .concat(round.map(function (q) { return q.id; }));
    keep = keep.slice(-Math.max(0, all.length - ROUND));
    try { localStorage.setItem(SEEN, JSON.stringify(keep)); } catch (e) {}
    var tq = treeQuestion();
    if (tq) round.push(tq);
    return shuffle(round).map(function (q) {
      return { q: q, choices: shuffle([0, 1, 2]).map(function (i) { return { text: q.a[i], right: i === 0 }; }) };
    });
  }

  /* ---------- A question from a family tree ----------
     Ali (2026-11-03): ask about the player's own «شجرة عائلتي» when there is one on this device or in the
     account («سارة شنو تصير لك؟», the map with their names); otherwise about an example family
     («سارة شنو تصير لفهد؟»). The names stay in the browser. */

  var BOYS = ['فهد', 'خالد', 'ناصر', 'سالم', 'بدر', 'يوسف', 'جاسم', 'مشعل', 'عبدالله', 'حمد', 'سعود', 'راشد'];
  var GIRLS = ['نورة', 'سارة', 'مريم', 'دانة', 'لولوة', 'هيا', 'شيخة', 'منيرة', 'فاطمة', 'أمل', 'بدرية', 'غلا'];
  var EX_PATHS = ['FB', 'FZ', 'MB', 'MZ', 'FF', 'MM', 'FBS', 'FBD', 'FZS', 'FZD', 'MBS', 'MBD', 'MZS', 'MZD', 'BS', 'BD', 'ZS', 'ZD',
    'FFB', 'MFB', 'FMZ', 'MMZ', 'FBW', 'MZH', 'FBSS', 'MZDS', 'FFBS', 'BSS'];
  var GRAND = { 'جدي': 'جد', 'جدتي': 'جدة', 'حفيدي': 'حفيد', 'حفيدتي': 'حفيدة' };

  // What the person at the end of path is: «ولد عمي», or about someone else, «ولد عم فهد».
  function relWords(path, anchor) {
    var K = root.KIN;
    if (!K || !path.length) return '';
    var c = K.common(path);
    if (c && !anchor) return c;
    if (c) {
      var w = c.split(' ');
      return GRAND[w[0]] ? GRAND[w[0]] + ' ' + anchor : c.replace(/(أبوي|أمي)$/, function (m) { return (m === 'أبوي' ? 'أبو ' : 'أم ') + anchor; });
    }
    return K.phrase(path, anchor);
  }

  // Two wrong answers close to the right one: the same walk with one step on the other side (أبو↔أم,
  // أخو↔أخت, ولد↔بنت, زوج↔زوجة) or one step fewer. The person's own gender (the last step) stays.
  var FLIP = { F: 'M', M: 'F', B: 'Z', Z: 'B', S: 'D', D: 'S', H: 'W', W: 'H' };
  function wrongs(path, anchor, right) {
    var same = root.KIN.phrase(path, anchor), out = [], add = function (p) {
      // never another way of saying the right answer («أبو أبوي» is «جدي»)
      var w = relWords(p, anchor);
      if (w && w !== right && root.KIN.phrase(p, anchor) !== same && out.indexOf(w) < 0) out.push(w);
    };
    for (var i = 0; i < path.length - 1; i++) add(path.slice(0, i).concat(FLIP[path[i]], path.slice(i + 1)));
    for (var j = 0; j < path.length - 1; j++) if (path.length > 1) add(path.slice(0, j).concat(path.slice(j + 1)));
    var last = path[path.length - 1];
    add(['F', 'B', last === 'D' || last === 'Z' || last === 'M' || last === 'W' ? 'D' : 'S']);
    add(['M', 'Z', last === 'D' || last === 'Z' || last === 'M' || last === 'W' ? 'D' : 'S']);
    return shuffle(out).slice(0, 2);
  }

  // From the player's tree: someone with a name, one to four steps away.
  function fromMyTree() {
    var T = root.TREE, doc = T && T.current && T.current();
    if (!doc || !doc.p || !doc.me || !T.relations || !T.index) return null;
    var rels;
    try { rels = T.relations(doc, T.index(doc)); } catch (e) { return null; }
    var pids = shuffle(Object.keys(rels).filter(function (pid) {
      var p = rels[pid], n = doc.p[pid] && String(doc.p[pid].n || '').trim();
      return pid !== doc.me && n && p.length >= 1 && p.length <= 4;
    }));
    for (var i = 0; i < pids.length; i++) {
      var pid = pids[i], path = rels[pid];
      var right = root.KIN.common(path) || (T.relName ? T.relName(path) : relWords(path));
      var bad = wrongs(path, '', right);
      if (!right || bad.length < 2) continue;
      // the map: each person on the way by name (or what they are, when they have none)
      var walk = [doc.me], names = ['أنا'];
      var cur = doc.me;
      var byPath = {};
      Object.keys(rels).forEach(function (id) { byPath[rels[id].join('')] = byPath[rels[id].join('')] || id; });
      for (var k = 1; k < path.length; k++) {
        var id = byPath[path.slice(0, k).join('')], nm = id && doc.p[id] && String(doc.p[id].n || '').trim();
        names.push(nm || stepLabels(path.slice(0, k))[k]);
      }
      var name = String(doc.p[pid].n).trim();
      names.push('');
      return { id: 'tree', k: 'map', p: path.join(''), q: name + ' شنو ' + root.KIN.verb(path) + ' لك؟', names: names, endName: name, a: [right, bad[0], bad[1]], mine: true };
    }
    return null;
  }

  // An example family: «فهد»، his father «خالد»، his uncle «ناصر»، and the person asked about.
  function fromExample() {
    if (!root.KIN) return null;
    var path = EX_PATHS[Math.floor(Math.random() * EX_PATHS.length)].split('');
    var boys = shuffle(BOYS), girls = shuffle(GIRLS), me = boys.pop();
    var names = [me];
    path.forEach(function (st) { names.push(STEPS[st].g === 'm' ? boys.pop() : girls.pop()); });
    var right = relWords(path, me), bad = wrongs(path, me, right);
    if (!right || bad.length < 2) return null;
    var end = names[names.length - 1];
    return { id: 'example', k: 'map', p: path.join(''), q: end + ' شنو ' + root.KIN.verb(path) + ' ل' + me + '؟', names: names, endName: end,
      a: [right, bad[0], bad[1]], example: true };
  }

  function treeQuestion() { return fromMyTree() || fromExample(); }

  /* Points (Ali, 2026-11-03): ten seconds a question, and the faster the more. A right answer within
     the ten seconds gets 100 (straight away) down to 50 (at ten seconds); after that it gets 25. Wrong is 0. */
  var LIMIT = 10000;
  function points(right, ms) {
    if (!right) return 0;
    if (ms > LIMIT) return 25;
    return Math.round(100 - 50 * Math.max(0, ms) / LIMIT);
  }

  // What the score says: always kind, never a dig at the player (Ali, 2026-11-03).
  function verdict(score, of) {
    if (score >= of) return 'كفو! ولا غلطة';
    if (score >= of * 0.8) return 'ما شاء الله، تعرف أهلك زين';
    if (score >= of * 0.5) return 'حلو! باقي لك شوي';
    return 'بداية حلوة، جرّب مرة ثانية';
  }

  var GAME = { points: points, treeQuestion: treeQuestion, relWords: relWords, mapSvg: mapSvg, stepLabels: stepLabels, cleanPath: cleanPath, STEPS: STEPS, bank: bank, verdict: verdict, load: load };
  root.GAME = GAME;
  if (typeof document === 'undefined') return;

  /* ---------- The score picture (story 9:16 or post 4:5) ---------- */

  // r: { score: right answers, of: questions, marks: [true, false, …], points }
  function makePicture(r, format) {
    var K = root.KIN, D = K && K.draw;
    if (!D) return Promise.reject(new Error('no kin.js'));
    var F = K.FORMATS[format] || K.FORMATS.story, H = F.H, post = format === 'post';
    var marks = r.marks, line = verdict(r.score, marks.length), hasPts = typeof r.points === 'number';
    var right = r.score + ' من ' + marks.length + ' صح';
    return D.loadFonts('تحدي شنو يصير لك؟ ' + line + ' ' + right + ' نقطة تقدر تغلبني؟ 0123456789/').then(function () {
      var c = document.createElement('canvas');
      c.width = 1080; c.height = H;
      var ctx = c.getContext('2d');
      D.background(ctx, 1080, H);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var y = post ? 200 : 430;
      ctx.fillStyle = '#9DB2C8'; D.setFont(ctx, '500', post ? 44 : 50);
      ctx.fillText('تحدي شنو يصير لك؟', 540, y);

      // the points, big: «420», and «نقطة» under them (or «4/5» for a score without points)
      y += post ? 280 : 360;
      ctx.save();
      ctx.direction = 'ltr'; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(233, 196, 106, 0.45)'; ctx.shadowBlur = 60;
      ctx.fillStyle = '#E9C46A'; D.setFont(ctx, '700', post ? 250 : 300);
      ctx.fillText(hasPts ? String(r.points) : r.score + '/' + marks.length, 540, y);
      ctx.restore();
      if (hasPts) {
        y += post ? 90 : 110;
        ctx.fillStyle = '#9DB2C8'; D.setFont(ctx, '500', post ? 54 : 62);
        ctx.fillText('نقطة', 540, y);
      }

      y += post ? 120 : 150;
      ctx.fillStyle = '#F4EFE6';
      D.fit(ctx, line, '700', post ? 66 : 76, 940, 44);
      ctx.fillText(line, 540, y);

      // a pearl for every question: teal when right, faint when not
      y += post ? 110 : 140;
      var R = 30, gap = 26, rowW = marks.length * R * 2 + (marks.length - 1) * gap, sx = 540 + rowW / 2 - R;
      marks.forEach(function (ok, i) {
        var x = sx - i * (R * 2 + gap);
        ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2);
        if (ok) {
          ctx.fillStyle = '#2EC4B6'; ctx.fill();
          ctx.beginPath(); ctx.arc(x - R * 0.32, y - R * 0.32, R * 0.26, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
        } else {
          ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(244, 239, 230, 0.28)'; ctx.stroke();
        }
      });
      y += post ? 90 : 110;
      ctx.fillStyle = '#9DB2C8'; D.setFont(ctx, '500', post ? 40 : 46);
      ctx.fillText(right, 540, y);

      y += post ? 130 : 200;
      ctx.fillStyle = '#E9C46A'; D.setFont(ctx, '700', post ? 64 : 72);
      ctx.fillText('تقدر تغلبني؟', 540, y);

      D.drawSticker(ctx, F.sticker);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }
  GAME.makePicture = makePicture;

  /* ---------- One challenge every 24 hours, and the scores ----------
     Ali (2026-11-03): one challenge a day. The database decides (game_status / game_start in
     20261103_game.sql: per account when signed in, per internet address when not); this device also
     remembers its last one, which is what counts while the database can't answer. Signed in, every score
     is kept (my_game_results) and can be shared again any time. */

  var LAST = 'shorbaka.game.last', DAY = 864e5;
  var RPC = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/';
  function token() {
    try {
      var s = JSON.parse(localStorage.getItem('shorbaka.auth') || 'null');
      return (s && (s.access_token || (s.currentSession && s.currentSession.access_token))) || '';
    } catch (e) { return ''; }
  }
  function signedIn() { var A = root.ACCOUNT; return !!(A && A.on && A.on() && A.user && A.user()); }
  // Signed in, as the account (the session account.js keeps); an expired sign-in is refreshed by
  // account.js, so a 401 waits a moment and goes once more.
  function rpc(name, args, again) {
    var t = signedIn() ? token() : '';
    return fetch(RPC + name, {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + (t || KEY), 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      if (r.status === 401 && t && !again) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return rpc(name, args, true); });
      return r.ok ? r.text().then(function (x) { return x ? JSON.parse(x) : null; }) : Promise.reject(new Error('HTTP ' + r.status));
    });
  }
  function lastLocal() {
    try { var l = JSON.parse(localStorage.getItem(LAST) || 'null'); return l && typeof l.at === 'number' ? l : null; } catch (e) { return null; }
  }
  function localNext() { var l = lastLocal(); return l && Date.now() - l.at < DAY ? l.at + DAY : 0; }

  // «بعد 5 ساعات و 20 دقيقة»
  function count(n, one, two, few, many) { return n === 1 ? one : n === 2 ? two : n <= 10 ? n + ' ' + few : n + ' ' + many; }
  function wait(ms) {
    var m = Math.max(1, Math.ceil(ms / 60000)), h = Math.floor(m / 60);
    m = m % 60;
    var hs = h ? count(h, 'ساعة', 'ساعتين', 'ساعات', 'ساعة') : '', ms_ = m ? count(m, 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة') : '';
    return 'بعد ' + (hs && ms_ ? hs + ' و' + ms_ : hs || ms_);
  }
  var dateFmt = null;
  function day(at) {
    try {
      dateFmt = dateFmt || new Intl.DateTimeFormat('ar-KW-u-nu-latn', { timeZone: 'Asia/Kuwait', weekday: 'long', day: 'numeric', month: 'long' });
      return dateFmt.format(new Date(at));
    } catch (e) { return new Date(at).toLocaleDateString(); }
  }

  /* ---------- Page ---------- */

  function init() {
    var sec = document.getElementById('game');
    if (!sec) return;
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      start: $('gm-start'), play: $('gm-play'), end: $('gm-end'), go: $('gm-go'),
      step: $('gm-step'), score: $('gm-score'), bar: $('gm-bar'), card: $('gm-card'), opts: $('gm-opts'),
      next: $('gm-next'), lock: $('gm-lock'), lockT: $('gm-lock-t'), res: $('gm-res'), resList: $('gm-res-list'),
      resEmpty: $('gm-res-empty'), resIn: $('gm-res-in'), gain: $('gm-gain'), time: $('gm-time'), timeBar: $('gm-time-bar'),
      timeN: $('gm-time-n'), timeT: $('gm-time-t'), bigU: $('gm-big-u'), big: $('gm-big'), line: $('gm-line'), dots: $('gm-dots'), share: $('gm-share'), again: $('gm-again')
    };
    var st = null;

    function view(name) {
      ui.start.hidden = name !== 'start';
      ui.play.hidden = name !== 'play';
      ui.end.hidden = name !== 'end';
    }

    function begin() {
      var s = ui.go.querySelector('span') || ui.go, was = s.textContent;
      ui.go.disabled = true; s.textContent = 'لحظة…';
      var gate = rpc('game_start').then(function (r) {
        if (r && r.ok === false) return { locked: Date.parse(r.next) };
        return { play: r && r.play };
      }, function () {
        // the database can't answer (or isn't set up yet): this device's last challenge decides
        var next = localNext();
        return next ? { locked: next } : {};
      });
      Promise.all([gate, load()]).then(function (res) {
        var g = res[0];
        if (g.locked) { lockUntil(g.locked); return; }
        st = { round: pick(res[1]), i: 0, score: 0, points: 0, marks: [], play: g.play || null };
        view('play');
        ask();
        sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }).then(function () { ui.go.disabled = false; s.textContent = was; });
    }

    // The start view while waiting: when the next one opens, and the last score.
    var lockedTo = 0, ticker = null;
    function lockUntil(at) {
      lockedTo = at;
      var left = at - Date.now();
      if (left <= 0) { lockedTo = 0; ui.go.hidden = false; ui.lock.hidden = true; clearInterval(ticker); ticker = null; return; }
      ui.go.hidden = true; ui.lock.hidden = false;
      ui.lockT.textContent = 'تحديك الجاي ' + wait(left);
      if (!ticker) ticker = setInterval(function () { if (lockedTo) lockUntil(lockedTo); }, 30000);
    }

    function shareResult(r, from) {
      if (!root.KIN || !root.KIN.openShare) return;
      var marks = String(r.marks || '').split('').map(function (c) { return c === '1'; });
      if (!marks.length) for (var i = 0; i < r.of; i++) marks.push(i < r.score);
      var pic = { score: r.score, of: marks.length, marks: marks, points: typeof r.points === 'number' ? r.points : undefined };
      var said = typeof pic.points === 'number' ? pic.points + ' نقطة' : r.score + ' من ' + marks.length;
      root.KIN.openShare({
        file: 'shorbaka-game',
        make: function (format) { return makePicture(pic, format); },
        alt: 'جبت ' + said + ' بتحدي شنو يصير لك؟',
        mention: 'تمنشن ربعك',
        text: 'جبت ' + said + ' بتحدي شنو يصير لك؟ تقدر تغلبني؟ https://shorbaka.com/#game'
      }, from);
    }

    // «نتائج التحدي»: signed in, every score from the account; otherwise this device's last one.
    function results() {
      var list = ui.resList;
      var draw = function (rows, inAccount) {
        list.textContent = '';
        rows.forEach(function (r) {
          var li = document.createElement('li');
          var d = document.createElement('span'); d.className = 'gm-r-day'; d.textContent = day(r.at);
          var sc = document.createElement('b'); sc.className = 'gm-r-sc';
          if (typeof r.points === 'number') {
            sc.textContent = r.points;
            var u = document.createElement('small'); u.textContent = ' نقطة · ' + r.score + '/' + r.of;
            sc.appendChild(u);
          } else sc.textContent = r.score + '/' + r.of;
          var b = document.createElement('button'); b.type = 'button'; b.className = 'gm-r-share'; b.setAttribute('aria-label', 'شارك النتيجة');
          b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 8v6M9 11h6"/></svg><span>شارك</span>';
          b.addEventListener('click', function () { shareResult(r, b); });
          li.appendChild(d); li.appendChild(sc); li.appendChild(b);
          list.appendChild(li);
        });
        ui.res.hidden = !rows.length && inAccount;
        ui.resEmpty.hidden = rows.length > 0;
        ui.resIn.hidden = inAccount || !(root.ACCOUNT && root.ACCOUNT.on && root.ACCOUNT.on());
      };
      var l = lastLocal(), local = l && typeof l.score === 'number' ? [l] : [];
      if (!signedIn()) { draw(local, false); return; }
      draw(local, true);
      rpc('my_game_results').then(function (rows) {
        if (!signedIn() || !Array.isArray(rows)) return;
        draw(rows.map(function (r) { return { at: Date.parse(r.at), score: r.score, of: r.of, marks: r.marks, points: typeof r.points === 'number' ? r.points : undefined }; }), true);
      }, function () {});
    }

    // What the start view shows: the button, or the wait; and the scores.
    function refresh() {
      if (!st || ui.start.hidden === false) {
        rpc('game_status').then(function (r) {
          if (r && r.ok === false) lockUntil(Date.parse(r.next)); else lockUntil(0);
        }, function () { lockUntil(localNext()); });
      }
      results();
    }

    function ask() {
      var cur = st.round[st.i], q = cur.q;
      ui.step.textContent = 'سؤال ' + (st.i + 1) + ' من ' + st.round.length;
      ui.score.textContent = st.points;
      ui.gain.hidden = true;
      ui.bar.textContent = '';
      st.round.forEach(function (_, i) {
        var b = document.createElement('i');
        if (i < st.marks.length) b.className = st.marks[i] ? 'is-ok' : 'is-no';
        else if (i === st.i) b.className = 'is-cur';
        ui.bar.appendChild(b);
      });
      ui.card.textContent = '';
      ui.card.className = 'gm-card is-' + q.k;
      if (q.k === 'map') {
        var m = document.createElement('div');
        m.className = 'gm-map';
        m.innerHTML = mapSvg(q.p, { names: q.names, endName: q.endName });
        ui.card.appendChild(m);
        if (q.example || q.mine) ui.card.insertBefore(Object.assign(document.createElement('p'), { className: 'gm-tag', textContent: q.mine ? 'من شجرة عائلتك' : 'عائلة مثال' }), m);
      }
      var h = document.createElement('p');
      h.className = 'gm-q';
      h.textContent = q.k === 'map' ? (q.q || 'شنو يصير لك؟') : q.q;
      ui.card.appendChild(h);
      ui.opts.textContent = '';
      cur.choices.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'gm-opt';
        var t = document.createElement('span'); t.textContent = c.text;
        b.appendChild(t);
        b.addEventListener('click', function () { answer(b, c); });
        ui.opts.appendChild(b);
      });
      ui.next.hidden = true;
      ui.card.classList.remove('is-in'); void ui.card.offsetWidth; ui.card.classList.add('is-in');
      startClock();
    }

    /* The ten seconds: a bar that empties and the seconds left. It stops at the answer; after ten seconds
       it says a right answer now gets less. */
    var clock = null;
    function startClock() {
      stopClock();
      var t0 = performance.now();
      st.t0 = t0;
      ui.time.classList.remove('is-over');
      ui.timeBar.style.transition = 'none';
      ui.timeBar.style.transform = 'scaleX(1)';
      void ui.timeBar.offsetWidth;
      ui.timeBar.style.transition = 'transform ' + LIMIT + 'ms linear';
      ui.timeBar.style.transform = 'scaleX(0)';
      var tick = function () {
        var left = LIMIT - (performance.now() - t0);
        if (left > 0) ui.timeN.textContent = Math.ceil(left / 1000);
        else { ui.timeN.textContent = '0'; ui.time.classList.add('is-over'); ui.timeT.textContent = 'خلص الوقت، الجواب الصح الحين بـ 25 نقطة'; stopClock(); }
      };
      ui.timeT.textContent = 'كل ما جاوبت أسرع، نقاطك تزيد';
      tick();
      clock = setInterval(tick, 200);
    }
    function stopClock() { if (clock) { clearInterval(clock); clock = null; } }

    function answer(btn, c) {
      if (st.marks.length > st.i) return;
      var ms = performance.now() - st.t0, got = points(c.right, ms);
      stopClock();
      var w = ui.timeBar.getBoundingClientRect().width, full = ui.time.querySelector('.gm-time-track').getBoundingClientRect().width;
      ui.timeBar.style.transition = 'none';
      ui.timeBar.style.transform = 'scaleX(' + (full ? Math.max(0, Math.min(1, w / full)) : 0) + ')';
      st.marks.push(c.right);
      if (c.right) st.score++;
      st.points += got;
      ui.gain.textContent = '+' + got;
      ui.gain.className = 'gm-gain' + (got ? '' : ' is-zero');
      ui.gain.hidden = false;
      ui.timeT.textContent = c.right ? (ms <= LIMIT ? 'جاوبت بـ ' + (ms / 1000).toFixed(1) + ' ثانية' : 'جاوبت بعد ما خلص الوقت') : 'جواب غلط';
      var btns = Array.prototype.slice.call(ui.opts.children), cur = st.round[st.i];
      btns.forEach(function (b, i) {
        b.disabled = true;
        if (cur.choices[i].right) b.classList.add('is-right');
        else if (b === btn) b.classList.add('is-wrong');
        else b.classList.add('is-off');
      });
      if (cur.q.k === 'map') {
        var right = cur.choices.filter(function (x) { return x.right; })[0];
        ui.card.querySelector('.gm-map').innerHTML = mapSvg(cur.q.p, { names: cur.q.names, endName: cur.q.endName, answer: cur.q.names ? cur.q.endName + ': ' + right.text : right.text });
      }
      ui.score.textContent = st.points;
      var bars = ui.bar.children;
      if (bars[st.i]) bars[st.i].className = c.right ? 'is-ok' : 'is-no';
      var last = st.i >= st.round.length - 1;
      (ui.next.querySelector('span') || ui.next).textContent = last ? 'النتيجة' : 'التالي';
      ui.next.hidden = false;
      ui.next.focus({ preventScroll: true });
    }

    function finish() {
      view('end');
      stopClock();
      ui.big.innerHTML = '';
      var b = document.createElement('b'); b.textContent = st.points;
      ui.big.appendChild(b);
      ui.bigU.textContent = 'نقطة · ' + st.score + ' من ' + st.marks.length + ' صح';
      ui.line.textContent = verdict(st.score, st.marks.length);
      ui.dots.textContent = '';
      st.marks.forEach(function (ok) { var i = document.createElement('i'); if (ok) i.className = 'is-ok'; ui.dots.appendChild(i); });
      var marks = st.marks.map(function (ok) { return ok ? '1' : '0'; }).join('');
      var at = Date.now();
      try { localStorage.setItem(LAST, JSON.stringify({ at: at, score: st.score, of: st.marks.length, marks: marks, points: st.points })); } catch (e) {}
      if (st.play) rpc('game_finish', { play: st.play, sc: st.score, total: st.marks.length, marks: marks, pts: st.points }).then(results, function () {});
      lockUntil(at + DAY);
      results();
      sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    ui.go.addEventListener('click', begin);
    ui.again.addEventListener('click', function () { view('start'); refresh(); sec.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    ui.resIn.addEventListener('click', function () { if (root.KIN && root.KIN.openAuth) root.KIN.openAuth('سجّل دخول عشان تنحفظ نتائجك', ui.resIn); });
    if (root.ACCOUNT && root.ACCOUNT.onChange) {
      root.ACCOUNT.onChange(function () { refresh(); });
      if (root.ACCOUNT.ready) root.ACCOUNT.ready.then(refresh);
    }
    ui.next.addEventListener('click', function () {
      if (st.i >= st.round.length - 1) { finish(); return; }
      st.i++;
      ask();
    });
    ui.share.addEventListener('click', function () {
      if (!st || !root.KIN || !root.KIN.openShare) return;
      shareResult({ score: st.score, of: st.marks.length, points: st.points, marks: st.marks.map(function (ok) { return ok ? '1' : '0'; }).join('') }, ui.share);
    });

    GAME.shown = function (on) { if (on) { load(); if (!ui.start.hidden) refresh(); } };
    GAME.showResults = function () { view('start'); refresh(); ui.res.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    view('start');
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
