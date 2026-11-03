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
  var ROUND = 10;

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
    var pts = layout(path), names = stepLabels(path), n = pts.length;
    var cell = 92, r = 17, rEnd = 22, fs = 16;
    var P = pts.map(function (p, i) { return { x: p.x * cell, y: p.y * cell, r: i === 0 || i === n - 1 ? rEnd : r }; });
    var taken = P.map(function (p) { return { x0: p.x - p.r, y0: p.y - p.r, x1: p.x + p.r, y1: p.y + p.r }; });
    for (var i = 1; i < n; i++) {
      var a = P[i - 1], b = P[i];
      taken.push({ x0: Math.min(a.x, b.x) - 5, y0: Math.min(a.y, b.y) - 5, x1: Math.max(a.x, b.x) + 5, y1: Math.max(a.y, b.y) + 5 });
    }
    var labels = [];
    for (var k = 0; k < n; k++) {
      var text = k === n - 1 && n > 1 ? (opts.answer || '') : names[k];
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
    var round = fresh.concat(old).slice(0, ROUND);
    var keep = seen.filter(function (id) { return !round.some(function (q) { return q.id === id; }); })
      .concat(round.map(function (q) { return q.id; }));
    keep = keep.slice(-Math.max(0, all.length - ROUND));
    try { localStorage.setItem(SEEN, JSON.stringify(keep)); } catch (e) {}
    return round.map(function (q) {
      return { q: q, choices: shuffle([0, 1, 2]).map(function (i) { return { text: q.a[i], right: i === 0 }; }) };
    });
  }

  // What the score says (Ali's Kuwaiti, short).
  function verdict(score, of) {
    if (score >= of) return 'كفو! ولا غلطة';
    if (score >= of * 0.8) return 'تعرف أهلك زين';
    if (score >= of * 0.5) return 'مو شين، بس تبيلك قعدة مع جدتك';
    return 'يبيلك تزور أهلك أكثر';
  }

  var GAME = { mapSvg: mapSvg, stepLabels: stepLabels, cleanPath: cleanPath, STEPS: STEPS, bank: bank, verdict: verdict, load: load };
  root.GAME = GAME;
  if (typeof document === 'undefined') return;

  /* ---------- The score picture (story 9:16 or post 4:5) ---------- */

  function makePicture(score, marks, format) {
    var K = root.KIN, D = K && K.draw;
    if (!D) return Promise.reject(new Error('no kin.js'));
    var F = K.FORMATS[format] || K.FORMATS.story, H = F.H, post = format === 'post';
    var line = verdict(score, marks.length);
    return D.loadFonts('تحدي شنو يصير لك؟ ' + line + ' تقدر تغلبني؟ 0123456789/').then(function () {
      var c = document.createElement('canvas');
      c.width = 1080; c.height = H;
      var ctx = c.getContext('2d');
      D.background(ctx, 1080, H);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var y = post ? 210 : 470;
      ctx.fillStyle = '#9DB2C8'; D.setFont(ctx, '500', post ? 44 : 50);
      ctx.fillText('تحدي شنو يصير لك؟', 540, y);

      // the score, big: «8/10»
      y += post ? 300 : 380;
      ctx.save();
      ctx.direction = 'ltr';
      ctx.shadowColor = 'rgba(233, 196, 106, 0.45)'; ctx.shadowBlur = 60;
      ctx.fillStyle = '#E9C46A'; D.setFont(ctx, '700', post ? 280 : 330);
      var big = String(score), w1 = ctx.measureText(big).width;
      D.setFont(ctx, '500', post ? 120 : 140);
      var small = '/' + marks.length, w2 = ctx.measureText(small).width, x0 = 540 - (w1 + w2) / 2;
      ctx.textAlign = 'left';
      D.setFont(ctx, '700', post ? 280 : 330); ctx.fillText(big, x0, y);
      ctx.shadowBlur = 0; ctx.fillStyle = '#9DB2C8';
      D.setFont(ctx, '500', post ? 120 : 140); ctx.fillText(small, x0 + w1 + 8, y);
      ctx.restore();

      y += post ? 140 : 180;
      ctx.fillStyle = '#F4EFE6';
      D.fit(ctx, line, '700', post ? 70 : 80, 940, 44);
      ctx.fillText(line, 540, y);

      // a pearl for every question: teal when right, faint when not
      y += post ? 120 : 160;
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

      y += post ? 150 : 230;
      ctx.fillStyle = '#E9C46A'; D.setFont(ctx, '700', post ? 64 : 72);
      ctx.fillText('تقدر تغلبني؟', 540, y);

      D.drawSticker(ctx, F.sticker);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }
  GAME.makePicture = makePicture;

  /* ---------- Page ---------- */

  function init() {
    var sec = document.getElementById('game');
    if (!sec) return;
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      start: $('gm-start'), play: $('gm-play'), end: $('gm-end'), go: $('gm-go'),
      step: $('gm-step'), score: $('gm-score'), bar: $('gm-bar'), card: $('gm-card'), opts: $('gm-opts'),
      next: $('gm-next'), big: $('gm-big'), line: $('gm-line'), dots: $('gm-dots'), share: $('gm-share'), again: $('gm-again')
    };
    var st = null;

    function view(name) {
      ui.start.hidden = name !== 'start';
      ui.play.hidden = name !== 'play';
      ui.end.hidden = name !== 'end';
    }

    function begin() {
      var s = ui.go.querySelector('span') || ui.go, was = s.textContent;
      ui.go.disabled = ui.again.disabled = true; s.textContent = 'لحظة…';
      load().then(function (all) {
        st = { round: pick(all), i: 0, score: 0, marks: [] };
        view('play');
        ask();
        sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }).then(function () { ui.go.disabled = ui.again.disabled = false; s.textContent = was; });
    }

    function ask() {
      var cur = st.round[st.i], q = cur.q;
      ui.step.textContent = 'سؤال ' + (st.i + 1) + ' من ' + st.round.length;
      ui.score.textContent = st.score;
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
        m.innerHTML = mapSvg(q.p);
        ui.card.appendChild(m);
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
    }

    function answer(btn, c) {
      if (st.marks.length > st.i) return;
      st.marks.push(c.right);
      if (c.right) st.score++;
      var btns = Array.prototype.slice.call(ui.opts.children), cur = st.round[st.i];
      btns.forEach(function (b, i) {
        b.disabled = true;
        if (cur.choices[i].right) b.classList.add('is-right');
        else if (b === btn) b.classList.add('is-wrong');
        else b.classList.add('is-off');
      });
      if (cur.q.k === 'map') {
        var right = cur.choices.filter(function (x) { return x.right; })[0];
        ui.card.querySelector('.gm-map').innerHTML = mapSvg(cur.q.p, { answer: right.text });
      }
      ui.score.textContent = st.score;
      var bars = ui.bar.children;
      if (bars[st.i]) bars[st.i].className = c.right ? 'is-ok' : 'is-no';
      var last = st.i >= st.round.length - 1;
      (ui.next.querySelector('span') || ui.next).textContent = last ? 'النتيجة' : 'التالي';
      ui.next.hidden = false;
      ui.next.focus({ preventScroll: true });
    }

    function finish() {
      view('end');
      ui.big.innerHTML = '';
      var b = document.createElement('b'); b.textContent = st.score;
      var s = document.createElement('span'); s.textContent = '/' + st.marks.length;
      ui.big.appendChild(b); ui.big.appendChild(s);
      ui.line.textContent = verdict(st.score, st.marks.length);
      ui.dots.textContent = '';
      st.marks.forEach(function (ok) { var i = document.createElement('i'); if (ok) i.className = 'is-ok'; ui.dots.appendChild(i); });
      sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }

    ui.go.addEventListener('click', begin);
    ui.again.addEventListener('click', begin);
    ui.next.addEventListener('click', function () {
      if (st.i >= st.round.length - 1) { finish(); return; }
      st.i++;
      ask();
    });
    ui.share.addEventListener('click', function () {
      if (!st || !root.KIN || !root.KIN.openShare) return;
      var score = st.score, marks = st.marks.slice();
      root.KIN.openShare({
        file: 'shorbaka-game',
        make: function (format) { return makePicture(score, marks, format); },
        alt: 'جبت ' + score + ' من ' + marks.length + ' بتحدي شنو يصير لك؟',
        mention: 'تمنشن ربعك',
        text: 'جبت ' + score + ' من ' + marks.length + ' بتحدي شنو يصير لك؟ تقدر تغلبني؟ https://shorbaka.com/#game'
      }, ui.share);
    });

    GAME.shown = function (on) { if (on) load(); };
    view('start');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
