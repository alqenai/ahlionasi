/* شرباكة: «ربعي».
   My friends and the groups I know them from (الدوام، الديوانية، كرة القدم…), drawn like a metro map
   (Ali's pick, «خطوط»): every group is a line in its colour hanging from a sand bar with my name. A friend
   in one group is a station on its line, the name beside it; a friend in more than one group is a pearl
   capsule across their lines, with a dot on each of them. All the lines end on one row, each with its
   group's name, and groups that share friends sit side by side. Shared as a story or post, or printed as
   an A4 PDF, with the groups I pick; signed in, the whole of it gets its own link with no password
   (shorbaka.com/f/#code).

   One small document:
     { v: 1, me: 'علي', n: 9,
       g: { g1: { n: 'الدوام', c: 0 }, ... },          groups: name and colour (an index in COLORS)
       p: { p4: { n: 'فهد', g: ['g1', 'g2'] }, ... },  friends: name and their groups (one or more)
       o: { hide: true } }                             «الأسامي: بس اسمي» (left out when off)
   A friend is always in at least one group: a group that goes takes with it the friends in no other. */
(function (root) {
  'use strict';

  var FRIENDS = {};
  var MAXP = 400, MAXG = 12, NAME = 40, GROUP = 24;
  var FONT = '"Readex Pro", system-ui, sans-serif', NS = 'http://www.w3.org/2000/svg';

  // Group colours (those of «شجرة دوامي»'s departments): on the navy of the screen and stories, and on paper.
  var COLORS = {
    sea: ['#2EC4B6', '#FF8A80', '#B9A7F0', '#7FB8F0', '#F4A261', '#9BD48A', '#F28DC0', '#5FD3E8', '#D9C27A', '#C9A0DC', '#88C9A1', '#F7B2A5'],
    paper: ['#1FAFA2', '#F0796D', '#8E78DD', '#4F94DA', '#E07F2E', '#5FAE4E', '#D9629F', '#2BAFC7', '#B8973A', '#A877C4', '#4FA874', '#E58A79']
  };
  var COLOR_NAMES = ['فيروزي', 'مرجاني', 'بنفسجي', 'أزرق', 'برتقالي', 'أخضر', 'وردي', 'سماوي', 'ذهبي', 'ليلكي', 'نعناعي', 'خوخي'];

  function num(id) { return +String(id).slice(1) || 0; }
  function byNum(a, b) { return num(a) - num(b); }
  function copy(doc) { return JSON.parse(JSON.stringify(doc)); }
  function clip(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }
  function ar(a, b) { return String(a).localeCompare(String(b), 'ar'); }

  function friendsN(n) { return n === 1 ? 'صديق واحد' : n === 2 ? 'صديقين' : n <= 10 ? n + ' أصدقاء' : n + ' صديق'; }
  function groupsN(n) { return n === 1 ? 'قروب واحد' : n === 2 ? 'قروبين' : n <= 10 ? n + ' قروبات' : n + ' قروب'; }

  /* --- the document --- */

  function blank(me, groups) {
    var doc = { v: 1, me: clip(me, NAME), n: 0, g: {}, p: {} };
    (groups || []).forEach(function (name) { addGroup(doc, name); });
    return doc;
  }

  // A document as it came from storage (or a link), made safe: unknown keys and groups dropped.
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || !raw.g || typeof raw.g !== 'object' || !raw.p || typeof raw.p !== 'object') return null;
    var g = {}, p = {}, n = 0;
    Object.keys(raw.g).filter(function (id) { return /^g\d+$/.test(id); }).sort(byNum).slice(0, MAXG).forEach(function (id) {
      var x = raw.g[id], name = x && clip(x.n, GROUP);
      if (!name) return;
      g[id] = { n: name, c: Math.max(0, Math.min(COLORS.sea.length - 1, Math.floor(+x.c) || 0)) };
      n = Math.max(n, num(id));
    });
    Object.keys(raw.p).filter(function (id) { return /^p\d+$/.test(id); }).sort(byNum).slice(0, MAXP).forEach(function (id) {
      var x = raw.p[id];
      if (!x || typeof x !== 'object' || !Array.isArray(x.g)) return;
      var gs = groupsIn(g, x.g);
      if (!gs.length) return;
      // a name can come empty from a link with «بس اسمي»
      p[id] = { n: clip(x.n, NAME), g: gs };
      n = Math.max(n, num(id));
    });
    var doc = { v: 1, me: clip(raw.me, NAME), n: Math.max(n, Math.floor(+raw.n) || 0), g: g, p: p };
    if (raw.o && typeof raw.o === 'object' && raw.o.hide) doc.o = { hide: true };
    return doc;
  }

  // The groups of gs that exist, each once, in the order they were made.
  function groupsIn(g, gs) {
    var seen = {};
    return (gs || []).filter(function (id) {
      if (typeof id !== 'string' || !g[id] || seen[id]) return false;
      seen[id] = 1;
      return true;
    }).sort(byNum);
  }

  // A new group, with the first colour no group has yet; the same name gives the group already there.
  function addGroup(doc, name) {
    name = clip(name, GROUP);
    if (!name) return null;
    var same = Object.keys(doc.g).filter(function (id) { return doc.g[id].n === name; })[0];
    if (same) return same;
    if (Object.keys(doc.g).length >= MAXG) return null;
    var taken = {};
    Object.keys(doc.g).forEach(function (id) { taken[doc.g[id].c] = 1; });
    var c = 0;
    while (taken[c] && c < COLORS.sea.length - 1) c++;
    var id = 'g' + (++doc.n);
    doc.g[id] = { n: name, c: c };
    return id;
  }

  function addFriend(doc, name, gs) {
    name = clip(name, NAME);
    gs = groupsIn(doc.g, gs);
    if (!name || !gs.length || Object.keys(doc.p).length >= MAXP) return null;
    var id = 'p' + (++doc.n);
    doc.p[id] = { n: name, g: gs };
    return id;
  }

  function setFriend(doc, pid, name, gs) {
    var f = doc.p[pid];
    name = clip(name, NAME);
    gs = groupsIn(doc.g, gs);
    if (!f || !name || !gs.length) return false;
    f.n = name; f.g = gs;
    return true;
  }

  // Takes a group out, and with it the friends in no other group. Returns how many friends went.
  function removeGroup(doc, gid) {
    if (!doc.g[gid]) return -1;
    var gone = 0;
    Object.keys(doc.p).forEach(function (id) {
      var f = doc.p[id], i = f.g.indexOf(gid);
      if (i < 0) return;
      f.g.splice(i, 1);
      if (!f.g.length) { delete doc.p[id]; gone++; }
    });
    delete doc.g[gid];
    return gone;
  }

  function inGroup(doc, gid) { return Object.keys(doc.p).filter(function (id) { return doc.p[id].g.indexOf(gid) >= 0; }).length; }
  function onlyIn(doc, gid) { return Object.keys(doc.p).filter(function (id) { var g = doc.p[id].g; return g.length === 1 && g[0] === gid; }).length; }

  FRIENDS.blank = blank; FRIENDS.clean = clean; FRIENDS.addGroup = addGroup; FRIENDS.addFriend = addFriend;
  FRIENDS.setFriend = setFriend; FRIENDS.removeGroup = removeGroup; FRIENDS.inGroup = inGroup; FRIENDS.onlyIn = onlyIn;
  FRIENDS.COLORS = COLORS; FRIENDS.friendsN = friendsN; FRIENDS.groupsN = groupsN;

  /* --- the map ---
     Sizes in units: one unit is a pixel on the screen at full size; the pictures scale it. */

  var M = {
    fs: 13, fc: 12.5, fg: 12, fm: 15,  // font sizes: a station's name, a capsule's, a group's, mine
    lw: 6, dot: 6.5, ring: 2.5, cdot: 5.5, ch: 26, mh: 34, gap: 9, rs: 42, ss: 36, ph: 24,
    spMin: 64, spMax: 150, pad: 6, base: 0.36  // the text's baseline sits base * size under its middle
  };

  var mctx = null;
  // How wide text is in Readex Pro (an estimate where there is no canvas).
  function measure(text, size, weight) {
    if (!text) return 0;
    if (mctx === null && typeof document !== 'undefined') {
      var c = document.createElement('canvas');
      mctx = (c.getContext && c.getContext('2d')) || false;
    }
    if (mctx) { mctx.font = weight + ' ' + size + 'px ' + FONT; return mctx.measureText(text).width; }
    return Array.from(text).length * size * 0.52;
  }

  // text, cut with «…» to fit maxW
  function fitText(text, size, weight, maxW) {
    if (!text || measure(text, size, weight) <= maxW) return text;
    var a = Array.from(text);
    while (a.length > 1 && measure(a.join('').trim() + '…', size, weight) > maxW) a.pop();
    return a.join('').trim() + '…';
  }

  /* The order of the lines, right to left: the one that makes friends in several groups cross the fewest
     lines that aren't theirs, then the narrowest capsules; on a tie, the closest to the order the groups
     were made in. Every order up to 7 groups; above that, swaps while they help. */
  var lastOrder = { key: null, out: null };
  function orderGroups(gids, friends) {
    var k = gids.length, idx = {};
    gids.forEach(function (g, i) { idx[g] = i; });
    var multi = friends.filter(function (f) { return f.g.length > 1; }).map(function (f) { return f.g.map(function (g) { return idx[g]; }); });
    if (k < 3 || !multi.length) return gids.slice();
    var key = gids.join(',') + '|' + multi.map(function (m) { return m.join('.'); }).sort().join(',');
    if (lastOrder.key === key) return lastOrder.out.slice();
    var pos = [];
    function cost(perm) {
      for (var s = 0; s < k; s++) pos[perm[s]] = s;
      var c = 0;
      for (var i = 0; i < multi.length; i++) {
        var m = multi[i], lo = k, hi = -1;
        for (var j = 0; j < m.length; j++) { var x = pos[m[j]]; if (x < lo) lo = x; if (x > hi) hi = x; }
        c += (hi - lo + 1 - m.length) * 1000 + (hi - lo);
      }
      return c;
    }
    // on a tie, the group made first sits furthest right, then the next one, and so on
    var bestPos = null;
    function earlier(perm) {
      var p = [];
      for (var s = 0; s < k; s++) p[perm[s]] = s;
      for (var i = 0; i < k; i++) if (p[i] !== bestPos[i]) return p[i] < bestPos[i];
      return false;
    }
    function keep(perm, c) {
      if (c > bestC || (c === bestC && !earlier(perm))) return;
      bestC = c; best = perm.slice(); bestPos = [];
      for (var s = 0; s < k; s++) bestPos[perm[s]] = s;
    }
    var best = null, bestC = Infinity;
    if (k <= 7) {
      var perm = [], used = [];
      (function go(d) {
        if (d === k) { keep(perm, cost(perm)); return; }
        for (var i = 0; i < k; i++) {
          if (used[i]) continue;
          used[i] = 1; perm[d] = i; go(d + 1); used[i] = 0;
        }
      })(0);
    } else {
      best = gids.map(function (_, i) { return i; }); bestC = cost(best);
      for (var again = true; again;) {
        again = false;
        for (var a = 0; a < k; a++) {
          for (var b = a + 1; b < k; b++) {
            var t = best.slice(); t[a] = best[b]; t[b] = best[a];
            var c2 = cost(t);
            if (c2 < bestC) { best = t; bestC = c2; again = true; }
          }
        }
      }
    }
    var out = best.map(function (i) { return gids[i]; });
    lastOrder = { key: key, out: out };
    return out.slice();
  }

  /* The map of doc for the groups in keep (all of them when null). hide: no friend's name (dots only).
     Returns { W, H, shapes, hits, mid, groups, friends }: shapes in the order they are drawn
       { t: 'line', x1, y1, x2, y2, c, w } | { t: 'rect', x, y, w, h, r, fill, stroke, sw } |
       { t: 'dot', x, y, r, fill, stroke, sw } | { t: 'text', x, y (its middle), s, size, weight, fill }
     with colours by role (INK) or a group's ('g' + its colour), and a friend's shapes carrying pid;
     hits: what can be tapped on the screen, { k: 'me' | 'g' | 'p', id, x, y, w, h }; mid: the middle of my
     bar; groups: the groups shown, right to left; friends: how many friends show. */
  function layout(doc, keep, hide) {
    var gids = Object.keys(doc.g).sort(byNum).filter(function (id) { return !keep || keep.indexOf(id) >= 0; });
    var friends = Object.keys(doc.p).sort(byNum).map(function (id) {
      var f = doc.p[id];
      return { id: id, n: hide ? '' : f.n, g: f.g.filter(function (g) { return gids.indexOf(g) >= 0; }) };
    }).filter(function (f) { return f.g.length; });
    var order = orderGroups(gids, friends), k = order.length, slot = {}, singles = {}, shared = [];
    order.forEach(function (g, i) { slot[g] = i; singles[g] = []; });
    friends.forEach(function (f) {
      if (f.g.length === 1) { singles[f.g[0]].push(f); return; }
      var sl = f.g.map(function (g) { return slot[g]; }).sort(function (a, b) { return a - b; });
      shared.push({ f: f, sl: sl, a: sl[0], b: sl[sl.length - 1] });
    });
    order.forEach(function (g) { singles[g].sort(function (x, y) { return ar(x.n, y.n) || byNum(x.id, y.id); }); });
    shared.sort(function (x, y) { return y.sl.length - x.sl.length || x.a - y.a || x.b - y.b || ar(x.f.n, y.f.n) || byNum(x.f.id, y.f.id); });

    /* the room between two lines: the names beside a line (but the last line's, which have the edge), a shared
       name between its first two dots, and the names of two groups side by side */
    var pills = {}, need = M.spMin;
    order.forEach(function (g) {
      var t = fitText(doc.g[g].n, M.fg, 700, M.spMax - 26);
      pills[g] = { t: t, w: measure(t, M.fg, 700) + 18 };
    });
    order.forEach(function (g, i) {
      if (i + 1 < k) need = Math.max(need, (pills[g].w + pills[order[i + 1]].w) / 2 + 8);
      if (i + 1 < k) singles[g].forEach(function (f) { if (f.n) need = Math.max(need, measure(f.n, M.fs, 400) + M.dot + M.gap + M.lw / 2 + 6); });
    });
    shared.forEach(function (s) { if (s.f.n) need = Math.max(need, (measure(s.f.n, M.fc, 700) + 2 * M.cdot + 12) / (s.sl[1] - s.sl[0])); });
    var sp = Math.min(M.spMax, Math.ceil(need));
    var X = function (s) { return (k - 1 - s) * sp; };  // the first group on the right

    // capsules in rows: a row holds capsules that don't meet
    var rows = [];
    shared.forEach(function (s) {
      for (var r = 0; ; r++) {
        rows[r] = rows[r] || [];
        if (rows[r].every(function (o) { return s.b < o.a || s.a > o.b; })) { rows[r].push(s); s.r = r; break; }
      }
    });
    var row0 = M.mh + 30, yS = row0 + rows.length * M.rs, most = 0;
    order.forEach(function (g) { most = Math.max(most, singles[g].length); });
    var end = most ? yS + (most - 1) * M.ss + 28 : rows.length ? row0 + (rows.length - 1) * M.rs + 28 : M.mh + 40;

    var shapes = [], hits = [];
    order.forEach(function (g) {
      shapes.push({ t: 'line', x1: X(slot[g]), y1: M.mh / 2, x2: X(slot[g]), y2: end, c: 'g' + doc.g[g].c, w: M.lw });
    });
    var mid = k ? (X(0) + X(k - 1)) / 2 : 0, meText = fitText(doc.me || 'أنا', M.fm, 700, 280);
    var meW = Math.max(k > 1 ? X(0) - X(k - 1) + 60 : 60, measure(meText, M.fm, 700) + 40);
    shapes.push({ t: 'rect', x: mid - meW / 2, y: 0, w: meW, h: M.mh, r: M.mh / 2, fill: 'me' });
    shapes.push({ t: 'text', x: mid, y: M.mh / 2, s: meText, size: M.fm, weight: 700, fill: 'meText' });
    hits.push({ k: 'me', x: mid - meW / 2, y: 0, w: meW, h: M.mh });
    // the end of each line, and its group's name under it
    order.forEach(function (g) {
      var x = X(slot[g]), c = 'g' + doc.g[g].c, text = pills[g].t, pw = pills[g].w;
      shapes.push({ t: 'rect', x: x - 11, y: end - 3, w: 22, h: 6, r: 3, fill: c });
      shapes.push({ t: 'rect', x: x - pw / 2, y: end + 10, w: pw, h: M.ph, r: M.ph / 2, fill: c });
      shapes.push({ t: 'text', x: x, y: end + 10 + M.ph / 2, s: text, size: M.fg, weight: 700, fill: 'pillText' });
      hits.push({ k: 'g', id: g, x: x - pw / 2 - 4, y: end + 6, w: pw + 8, h: M.ph + 8 });
    });
    // friends in one group: a station on its line, the name on its left
    order.forEach(function (g) {
      var x = X(slot[g]), maxName = slot[g] < k - 1 ? sp - M.dot - M.gap - M.lw / 2 - 6 : 220;
      singles[g].forEach(function (f, i) {
        var y = yS + i * M.ss, text = f.n ? fitText(f.n, M.fs, 400, maxName) : '', w = text ? measure(text, M.fs, 400) : 0;
        var right = x - M.dot - M.gap, left = text ? right - w - 2 : x - M.dot - 8;
        shapes.push({ t: 'dot', x: x, y: y, r: M.dot, fill: 'station', stroke: 'stationRing', sw: M.ring, pid: f.id });
        if (text) shapes.push({ t: 'text', x: right - w / 2, y: y, s: text, size: M.fs, weight: 400, fill: 'name', pid: f.id });
        hits.push({ k: 'p', id: f.id, x: left, y: y - 16, w: x + M.dot + 8 - left, h: 32 });
      });
    });
    // friends in more than one group: a capsule across their lines, a dot on each, the name between the first two
    shared.forEach(function (s) {
      var y = row0 + s.r * M.rs, xr = X(s.a), xl = X(s.b);
      shapes.push({ t: 'rect', x: xl - 15, y: y - M.ch / 2, w: xr - xl + 30, h: M.ch, r: M.ch / 2, fill: 'cap', stroke: 'capRing', sw: M.ring, pid: s.f.id });
      s.f.g.forEach(function (g) { shapes.push({ t: 'dot', x: X(slot[g]), y: y, r: M.cdot, fill: 'g' + doc.g[g].c, pid: s.f.id }); });
      if (s.f.n) {
        var x1 = X(s.sl[0]), x2 = X(s.sl[1]);
        shapes.push({ t: 'text', x: (x1 + x2) / 2, y: y, s: fitText(s.f.n, M.fc, 700, x1 - x2 - 2 * M.cdot - 10), size: M.fc, weight: 700, fill: 'capText', pid: s.f.id });
      }
      hits.push({ k: 'p', id: s.f.id, x: xl - 15, y: y - 17, w: xr - xl + 30, h: 34 });
    });

    // everything moved so the map starts at (pad, pad)
    var minX = Infinity, maxX = -Infinity;
    shapes.forEach(function (sh) {
      var l, r;
      if (sh.t === 'rect') { l = sh.x; r = sh.x + sh.w; }
      else if (sh.t === 'dot') { l = sh.x - sh.r - (sh.sw || 0) / 2; r = sh.x + sh.r + (sh.sw || 0) / 2; }
      else if (sh.t === 'line') { l = sh.x1 - sh.w / 2; r = sh.x1 + sh.w / 2; }
      else { var w = measure(sh.s, sh.size, sh.weight); l = sh.x - w / 2; r = sh.x + w / 2; }
      if (l < minX) minX = l;
      if (r > maxX) maxX = r;
    });
    var dx = M.pad - minX, dy = M.pad;
    shapes.forEach(function (sh) {
      if (sh.t === 'line') { sh.x1 += dx; sh.x2 += dx; sh.y1 += dy; sh.y2 += dy; } else { sh.x += dx; sh.y += dy; }
    });
    hits.forEach(function (h) { h.x += dx; h.y += dy; });
    return { W: maxX - minX + 2 * M.pad, H: end + 10 + M.ph + 2 * M.pad, shapes: shapes, hits: hits, mid: mid + dx, groups: order, friends: friends.length };
  }

  FRIENDS.layout = layout; FRIENDS.orderGroups = orderGroups;

  /* --- drawing: on the navy (screen, stories) and on paper --- */

  var INK = {
    sea: { kind: 'sea', me: '#E9C46A', meText: '#0E2A47', station: '#F4EFE6', stationRing: '#0E2A47', name: '#F4EFE6',
      cap: '#F4EFE6', capRing: '#0E2A47', capText: '#0E2A47', pillText: '#0E2A47' },
    paper: { kind: 'paper', me: '#E9C46A', meText: '#0E2A47', station: '#FFFFFF', stationRing: '#0E2A47', name: '#0E2A47',
      cap: '#FFFFFF', capRing: '#0E2A47', capText: '#0E2A47', pillText: '#0E2A47' }
  };
  function inkOf(ink, key) {
    if (key && key.charAt(0) === 'g') return COLORS[ink.kind][+key.slice(1)] || COLORS[ink.kind][0];
    return ink[key];
  }
  function r1(v) { return Math.round(v * 10) / 10; }

  // The map as SVG (the page and the link's page); each friend's shapes in a <g data-pid>.
  function svgOf(L, ink) {
    var mk = function (tag, at) {
      var e = document.createElementNS(NS, tag);
      Object.keys(at).forEach(function (a) { if (at[a] != null) e.setAttribute(a, at[a]); });
      return e;
    };
    var svg = mk('svg', { 'class': 'fr-map', width: r1(L.W), height: r1(L.H), viewBox: '0 0 ' + r1(L.W) + ' ' + r1(L.H), 'font-family': FONT, 'aria-hidden': 'true' });
    var groups = {};
    L.shapes.forEach(function (sh) {
      var e, stroke = sh.stroke ? { stroke: inkOf(ink, sh.stroke), 'stroke-width': sh.sw } : {};
      if (sh.t === 'line') e = mk('line', { x1: r1(sh.x1), y1: r1(sh.y1), x2: r1(sh.x2), y2: r1(sh.y2), stroke: inkOf(ink, sh.c), 'stroke-width': sh.w, 'stroke-linecap': 'round' });
      else if (sh.t === 'rect') e = mk('rect', Object.assign({ x: r1(sh.x), y: r1(sh.y), width: r1(sh.w), height: r1(sh.h), rx: r1(sh.r), fill: inkOf(ink, sh.fill) }, stroke));
      else if (sh.t === 'dot') e = mk('circle', Object.assign({ cx: r1(sh.x), cy: r1(sh.y), r: sh.r, fill: inkOf(ink, sh.fill) }, stroke));
      else {
        e = mk('text', { x: r1(sh.x), y: r1(sh.y + M.base * sh.size), 'text-anchor': 'middle', 'font-size': sh.size, 'font-weight': sh.weight, fill: inkOf(ink, sh.fill), direction: 'rtl' });
        e.textContent = sh.s;
      }
      var parent = svg;
      if (sh.pid) parent = groups[sh.pid] || (groups[sh.pid] = svg.appendChild(mk('g', { 'data-pid': sh.pid })));
      parent.appendChild(e);
    });
    return svg;
  }

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

  // The map on a canvas, at (ox, oy) and scale s.
  function paint(ctx, L, ink, ox, oy, s) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    L.shapes.forEach(function (sh) {
      if (sh.t === 'line') {
        ctx.strokeStyle = inkOf(ink, sh.c); ctx.lineWidth = sh.w * s;
        ctx.beginPath(); ctx.moveTo(ox + sh.x1 * s, oy + sh.y1 * s); ctx.lineTo(ox + sh.x2 * s, oy + sh.y2 * s); ctx.stroke();
        return;
      }
      if (sh.t === 'text') {
        ctx.fillStyle = inkOf(ink, sh.fill);
        ctx.font = sh.weight + ' ' + (sh.size * s) + 'px ' + FONT;
        ctx.fillText(sh.s, ox + sh.x * s, oy + (sh.y + M.base * sh.size) * s);
        return;
      }
      if (sh.t === 'rect') roundRect(ctx, ox + sh.x * s, oy + sh.y * s, sh.w * s, sh.h * s, sh.r * s);
      else { ctx.beginPath(); ctx.arc(ox + sh.x * s, oy + sh.y * s, sh.r * s, 0, Math.PI * 2); }
      ctx.fillStyle = inkOf(ink, sh.fill); ctx.fill();
      if (sh.stroke) { ctx.lineWidth = sh.sw * s; ctx.strokeStyle = inkOf(ink, sh.stroke); ctx.stroke(); }
    });
    ctx.restore();
  }

  FRIENDS.svgOf = svgOf;

  if (typeof module !== 'undefined' && module.exports) module.exports = FRIENDS;
  root.FRIENDS = FRIENDS;
  if (typeof document === 'undefined') return;

  // Waits (a little at most) for Readex Pro, so names are measured in the letters they are drawn in.
  function fontsReady(sample) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var all = Promise.all([
      document.fonts.load('400 13px "Readex Pro"', sample),
      document.fonts.load('700 13px "Readex Pro"', sample)
    ]).catch(function () {});
    return Promise.race([all, new Promise(function (res) { setTimeout(res, 2500); })]);
  }
  function sampleOf(doc, more) {
    return (doc.me || '') + ' ربع ' + (more || '') + ' … +0123456789 · ' +
      Object.keys(doc.g).map(function (id) { return doc.g[id].n; }).join(' ') + ' ' +
      Object.keys(doc.p).map(function (id) { return doc.p[id].n; }).join(' ');
  }

  /* ---------- Pictures (story 1080 x 1920, post 1080 x 1350) and the A4 page ---------- */

  var PICFMT = {
    story: { title: 108, titleY: 256, sub: 44, subY: 350, boxY: 422, boxH: 1098, boxW: 960, maxS: 3.4 },
    post: { title: 86, titleY: 146, sub: 36, subY: 228, boxY: 278, boxH: 864, boxW: 960, maxS: 3 }
  };

  function titleOf(doc) { return doc.me ? 'ربع ' + doc.me : 'ربعي'; }
  // «4 قروبات · 16 صديق», or the group's name when it is the only one
  function subOf(doc, L) {
    var head = L.groups.length === 1 ? doc.g[L.groups[0]].n : groupsN(L.groups.length);
    return L.friends ? head + ' · ' + friendsN(L.friends) : head;
  }
  function altOf(doc, keep) {
    var names = Object.keys(doc.g).sort(byNum).filter(function (id) { return !keep || keep.indexOf(id) >= 0; }).map(function (id) { return doc.g[id].n; });
    return titleOf(doc) + (names.length ? ': ' + names.join('، ') : '');
  }

  // opts.hide: no friend's name. opts.keep: the groups that show (all when null).
  function makePicture(doc, format, opts) {
    var hide = !!(opts && opts.hide), keep = (opts && opts.keep) || null, KIN = root.KIN, D = KIN.draw;
    var F = PICFMT[format] || PICFMT.story, H = KIN.FORMATS[format === 'post' ? 'post' : 'story'].H;
    return D.loadFonts(sampleOf(doc, titleOf(doc))).then(function () {
      var L = layout(doc, keep, hide), s = Math.min(F.boxW / L.W, F.boxH / L.H, F.maxS);
      var c = document.createElement('canvas');
      c.width = 1080; c.height = H;
      var ctx = c.getContext('2d');
      D.background(ctx, 1080, H);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#F4EFE6';
      D.fit(ctx, titleOf(doc), '700', F.title, 960, 60);
      ctx.fillText(titleOf(doc), 540, F.titleY);
      ctx.fillStyle = '#E9C46A';
      D.fit(ctx, subOf(doc, L), '500', F.sub, 960, 26);
      ctx.fillText(subOf(doc, L), 540, F.subY);
      paint(ctx, L, INK.sea, 540 - L.W * s / 2, F.boxY + Math.max(0, (F.boxH - L.H * s) / 2), s);
      D.drawSticker(ctx, KIN.FORMATS[format === 'post' ? 'post' : 'story'].sticker);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }

  var PAGE = { port: { w: 595, h: 842 }, land: { w: 842, h: 595 } }, PK = 4;
  var PDF_LINK = 'https://shorbaka.com/#friends';
  /* The QR in the page's corner: with my link (opts.qr), whoever scans it sees all my friends; without
     one, they land on «ربعي» to put in their own. */
  var QR_WORDS = ['امسح الكود', 'وحط ربعك'], LINK_WORDS = ['امسح الكود', 'وشوف ربعي كلهم'];

  // The QR library tree.js loads (/vendor/qrcode-generator), or null when it can't be had.
  function qrLib() {
    var T = root.TREE;
    return T && T.loadQr && T.qrOf ? T.loadQr().catch(function () { return null; }) : Promise.resolve(null);
  }

  // The squares of the code in navy, size wide at (x, y), leaving a quiet edge inside it (as tree.js).
  function drawQrCode(ctx, q, x, y, size) {
    var cell = Math.floor(size / (q.n + 4)), w = cell * q.n, x0 = Math.round(x + (size - w) / 2), y0 = Math.round(y + (size - w) / 2);
    ctx.fillStyle = '#0E2A47';
    for (var r = 0; r < q.n; r++) for (var c = 0; c < q.n; c++) if (q.dark(r, c)) ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
  }

  function bytesOf(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(new Uint8Array(fr.result)); };
      fr.onerror = rej;
      fr.readAsArrayBuffer(blob);
    });
  }

  // A one-page PDF that is the picture of the page (a JPEG), with links over parts of it (as tree.js).
  function pdfOf(jpeg, px, page, title, links) {
    var enc = new TextEncoder(), parts = [], at = 0, offs = [];
    var put = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); at += b.length; };
    var obj = function (n, body) { offs[n] = at; put(n + ' 0 obj\n' + body + '\nendobj\n'); };
    var text = function (t) {
      var h = 'FEFF';
      for (var i = 0; i < t.length; i++) h += ('000' + t.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
      return '<' + h + '>';
    };
    var n2 = function (v) { return String(Math.round(v * 100) / 100); };
    put('%PDF-1.4\n'); put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    var annots = links.map(function (l, i) { return (6 + i) + ' 0 R'; }).join(' '), info = 6 + links.length;
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + page.w + ' ' + page.h + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R /Annots [' + annots + '] >>');
    offs[4] = at;
    put('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + px.w + ' /Height ' + px.h +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
    put(jpeg);
    put('\nendstream\nendobj\n');
    var paintOp = 'q ' + page.w + ' 0 0 ' + page.h + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + paintOp.length + ' >>\nstream\n' + paintOp + '\nendstream');
    links.forEach(function (l, i) {
      obj(6 + i, '<< /Type /Annot /Subtype /Link /Rect [' + l.rect.map(n2).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI (' + l.uri + ') >> >>');
    });
    obj(info, '<< /Title ' + text(title) + ' /Creator (shorbaka.com) /Producer (shorbaka.com) >>');
    var xref = at;
    put('xref\n0 ' + (info + 1) + '\n0000000000 65535 f \n' + offs.slice(1, info + 1).map(function (o) { return ('000000000' + o).slice(-10) + ' 00000 n \n'; }).join(''));
    put('trailer\n<< /Size ' + (info + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  // Resolves { file: the PDF, name, type, preview: a PNG of the page, w, h }. opts: hide, keep, qr (my link).
  function makePdf(doc, orient, opts) {
    var hide = !!(opts && opts.hide), keep = (opts && opts.keep) || null, D = root.KIN.draw, P = PAGE[orient] || PAGE.port, k = PK;
    var title = titleOf(doc), foot = 'حط ربعك على shorbaka.com';
    var qrUrl = (opts && opts.qr) || PDF_LINK, words = opts && opts.qr ? LINK_WORDS : QR_WORDS;
    return Promise.all([D.loadFonts(sampleOf(doc, foot + ' ' + words.join(' '))), qrLib()]).then(function (got) {
      var qrcode = got[1], L = layout(doc, keep, hide);
      var W = P.w * k, H = P.h * k, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
      D.roundRect(ctx, 20 * k, 20 * k, W - 40 * k, H - 40 * k, 16 * k);
      ctx.lineWidth = 1.2 * k; ctx.strokeStyle = '#E4D3A6'; ctx.stroke();
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var titleY = (orient === 'port' ? 78 : 66) * k;
      ctx.fillStyle = '#0E2A47';
      D.fit(ctx, title, '700', 26 * k, W - 120 * k, 14 * k);
      ctx.fillText(title, W / 2, titleY);
      ctx.fillStyle = '#A3801F';
      D.setFont(ctx, '500', 11 * k);
      ctx.fillText(subOf(doc, L), W / 2, titleY + 22 * k);
      // with the QR in the corner, the map stops above it
      var boxW = W - 88 * k, boxY = titleY + 48 * k, boxH = H - boxY - (qrcode ? 116 : 74) * k;
      var s = Math.min(boxW / L.W, boxH / L.H, 1.25 * k);
      paint(ctx, L, INK.paper, W / 2 - L.W * s / 2, boxY + Math.max(0, (boxH - L.H * s) / 2), s);
      var fy = H - 44 * k, markH = 15 * k, markW = markH * 102 / 72, gap = 7 * k;
      D.setFont(ctx, '500', 10 * k);
      var tw = ctx.measureText(foot).width, total = markW + gap + tw, right = W / 2 + total / 2, left = W / 2 - total / 2;
      ctx.fillStyle = '#4A607A';
      ctx.fillText(foot, right - tw / 2, fy + 3.5 * k);
      D.drawMark(ctx, left + markW / 2, fy, markH, true);
      // the QR in the bottom left corner, «امسح الكود» and what it opens beside it, all in navy
      var qrSide = 68 * k, qx = 34 * k, qy = H - 34 * k - qrSide;
      if (qrcode) {
        drawQrCode(ctx, root.TREE.qrOf(qrcode, qrUrl), qx, qy, qrSide);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0E2A47'; D.setFont(ctx, '700', 9.5 * k);
        ctx.fillText(words[0], qx + qrSide + 6 * k, qy + qrSide / 2 - 2 * k);
        D.setFont(ctx, '500', 8.5 * k);
        ctx.fillText(words[1], qx + qrSide + 6 * k, qy + qrSide / 2 + 11 * k);
      }
      var preview = document.createElement('canvas'), pw = 1100, ph = Math.round(1100 * H / W);
      preview.width = pw; preview.height = ph;
      preview.getContext('2d').drawImage(c, 0, 0, pw, ph);
      var blob = function (cv, type, q) { return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('no picture')); }, type, q); }); };
      return Promise.all([blob(c, 'image/jpeg', 0.92).then(bytesOf), blob(preview, 'image/png')]).then(function (r) {
        var links = [{ rect: [left / k - 4, (H - fy) / k - 10, right / k + 4, (H - fy) / k + 12], uri: PDF_LINK }];
        if (qrcode) links.push({ rect: [qx / k, (H - qy - qrSide) / k, (qx + qrSide) / k, (H - qy) / k], uri: qrUrl });
        var pdf = pdfOf(r[0], { w: W, h: H }, P, title, links);
        c.width = c.height = 0;
        return { file: pdf, name: 'shorbaka-friends.pdf', type: 'application/pdf', preview: r[1], w: pw, h: ph };
      });
    });
  }

  FRIENDS.makePicture = makePicture;
  FRIENDS.makePdf = makePdf;

  /* ---------- Page ---------- */

  var LOCAL = 'shorbaka.friends.v1', UNSAVED = 'shorbaka.friends.unsaved';
  // The groups a start comes with, all three picked (Ali: just these three; «+ قروب» adds any other)
  var SUGGEST = ['ربع الدوام', 'ربع الديوانية', 'ربع الجامعة'];
  var ZOOM = {
    out: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6"/>',
    in: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6M10.5 7.5v6"/>'
  };

  function loadLocal() { try { return clean(JSON.parse(localStorage.getItem(LOCAL) || 'null')); } catch (e) { return null; } }
  function storeLocal(doc) {
    try { if (doc) localStorage.setItem(LOCAL, JSON.stringify(doc)); else localStorage.removeItem(LOCAL); return true; } catch (e) { return false; }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function zoomSteps(W, avail) {
    if (!W || avail <= 0) return [1];
    var fit = Math.max(0.16, Math.min(1, avail / W));
    if (fit > 0.98) return [1];
    if (fit >= 0.62) return [1, fit];
    return [1, Math.min(0.75, Math.sqrt(fit)), fit];
  }
  // A table that isn't there yet (the database change not made): my friends stay on this device.
  function noTable(e) { return !!e && (e.code === 'PGRST205' || e.code === '42P01' || /friend_maps/.test(String(e.message || ''))); }

  // A chip for a group: its colour's dot and its name.
  function groupChip(doc, gid, cls) {
    var c = el('button', 'tr-chip tr-chip-sm wk-dept' + (cls ? ' ' + cls : ''));
    c.type = 'button';
    var dot = el('i'); dot.style.background = COLORS.sea[doc.g[gid].c];
    c.appendChild(dot); c.appendChild(el('span', null, doc.g[gid].n));
    return c;
  }

  /* ---------- To look at only: the page a «رابط ربعي» opens (shorbaka.com/f/#code) ----------
     Shows doc in els ({ zoom, scroll, stage, canvas }): every group, and nothing can be tapped. With
     «بس اسمي» the database sends the friends without their names: dots only. */
  function viewer(els, doc) {
    var st = { zl: 0, z: 1, L: null, center: true };
    function draw() {
      var L = layout(doc, null, false);
      st.L = L;
      els.canvas.textContent = '';
      els.canvas.style.width = L.W + 'px';
      els.canvas.style.height = L.H + 'px';
      els.canvas.appendChild(svgOf(L, INK.sea));
      size();
      if (st.center) { st.center = false; els.scroll.scrollLeft = Math.max(0, 18 + L.mid * st.z - els.scroll.clientWidth / 2); }
    }
    function steps() { return zoomSteps(st.L && st.L.W, els.scroll.clientWidth - 36); }
    function size() {
      var L = st.L;
      if (!L || els.scroll.clientWidth - 36 <= 0) return;
      var zs = steps();
      st.zl = Math.min(st.zl, zs.length - 1);
      var last = zs.length > 1 && st.zl >= zs.length - 1;
      els.zoom.hidden = zs.length < 2;
      st.z = zs[st.zl];
      els.canvas.style.transform = st.z === 1 ? '' : 'scale(' + st.z + ')';
      els.stage.style.width = Math.ceil(L.W * st.z) + 'px';
      els.stage.style.height = Math.ceil(L.H * st.z) + 'px';
      els.zoom.setAttribute('aria-label', last ? 'رجّعها لحجمها' : st.zl ? 'صغّرها أكثر' : 'صغّرها');
      els.zoom.setAttribute('aria-pressed', String(st.zl > 0));
      els.zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (last ? ZOOM.in : ZOOM.out) + '</svg>';
    }
    els.zoom.addEventListener('click', function () {
      var mid = (els.scroll.scrollLeft + els.scroll.clientWidth / 2 - 18) / st.z;
      st.zl = (st.zl + 1) % steps().length;
      size();
      els.scroll.scrollLeft = Math.max(0, 18 + mid * st.z - els.scroll.clientWidth / 2);
    });
    var resizeT = null, lastW = els.scroll.clientWidth;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (els.scroll.clientWidth === lastW) return;
        lastW = els.scroll.clientWidth;
        draw();
      }, 120);
    });
    draw();
    // drawn again in Readex Pro once it is here, so the names fit their room
    fontsReady(sampleOf(doc)).then(function () { st.center = true; draw(); });
  }
  FRIENDS.viewer = viewer;

  function start() {
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      sec: $('friends'), count: $('fr-count'), msg: $('fr-msg'), retry: $('fr-retry'),
      start: $('fr-start'), meName: $('fr-me'), sugg: $('fr-sugg'), startGForm: $('fr-start-gform'), startGName: $('fr-start-gname'), startGAdd: $('fr-start-gadd'), startErr: $('fr-start-err'),
      wrap: $('fr-wrap'), groups: $('fr-groups'), gForm: $('fr-g-form'), gNew: $('fr-g-new'),
      add: $('fr-add'), zoom: $('fr-zoom'), scroll: $('fr-scroll'), stage: $('fr-stage'), canvas: $('fr-canvas'), hint: $('fr-hint'),
      share: $('fr-share'), pdf: $('fr-pdf'), note: $('fr-note'), saveRetry: $('fr-save-retry'), signIn: $('fr-in'),
      sheet: $('fr-sheet'), pTitle: $('fr-p-title'), pClose: $('fr-p-close'), pForm: $('fr-p-form'), pNameLabel: $('fr-p-name-label'), pName: $('fr-p-name'),
      pGBox: $('fr-p-gbox'), pGroups: $('fr-p-groups'), pGForm: $('fr-p-gform'), pGName: $('fr-p-gname'), pGAdd: $('fr-p-gadd'),
      pErr: $('fr-p-err'), pSave: $('fr-p-save'), pDone: $('fr-p-done'),
      pDel: $('fr-p-del'), pConfirm: $('fr-p-confirm'), pYes: $('fr-p-yes'), pNo: $('fr-p-no'),
      gSheet: $('fr-gsheet'), gDot: $('fr-g-dot'), gTitle: $('fr-g-title'), gCount: $('fr-g-count'), gClose: $('fr-g-close'),
      gRename: $('fr-g-rename'), gName: $('fr-g-name'), gSave: $('fr-g-save'), gErr: $('fr-g-err'), gColors: $('fr-g-colors'), gAddF: $('fr-g-addf'),
      gDel: $('fr-g-del'), gConfirm: $('fr-g-confirm'), gWarn: $('fr-g-warn'), gYes: $('fr-g-yes'), gNo: $('fr-g-no'),
      linkBtn: $('fr-link-btn'), link: $('fr-link'), lClose: $('fr-l-close'), lMsg: $('fr-l-msg'), lRetry: $('fr-l-retry'),
      lIn: $('fr-l-in'), lMake: $('fr-l-make'), lOn: $('fr-l-on'), lQr: $('fr-l-qr'), lUrl: $('fr-l-url'), lCopy: $('fr-l-copy'),
      lMore: $('fr-l-more'), lStop: $('fr-l-stop'), lConfirm: $('fr-l-confirm'), lYes: $('fr-l-yes'), lNo: $('fr-l-no')
    };
    if (!ui.sec || !ui.sheet || !ui.gSheet) return;

    var st = { doc: null, where: 'local', loaded: false, failed: false, seq: 0, saving: null, again: false, pending: false, saveErr: false,
      mode: null, pid: null, gid: null, sel: [], newSel: [], from: null, gFrom: null, lastAdded: null, center: true, zl: 0, z: 1, L: null,
      starts: SUGGEST.slice(), custom: [], keep: null, fontsOk: false, noTable: false };
    var acctReady = !root.ACCOUNT, timer = null;

    function accounts() { return root.ACCOUNT && root.ACCOUNT.on() ? root.ACCOUNT : null; }
    function signedIn() { var a = accounts(); return a && a.user() ? a : null; }
    function shown() { return !!ui.sec.offsetParent; }
    function canAccount(a) { return a && a.loadFriends && !st.noTable; }
    function lock(on) { document.documentElement.classList.toggle('kin-lock', on); }

    /* --- where my friends live: the account when signed in, this device otherwise --- */

    function keepUnsaved() {
      var a = signedIn();
      if (!a || !st.doc) return;
      try { sessionStorage.setItem(UNSAVED, JSON.stringify({ u: a.user().id, doc: st.doc })); } catch (e) {}
    }
    function unsaved(uid) {
      try { var raw = JSON.parse(sessionStorage.getItem(UNSAVED) || 'null'); return raw && raw.u === uid ? clean(raw.doc) : null; } catch (e) { return null; }
    }
    function dropUnsaved() { try { sessionStorage.removeItem(UNSAVED); } catch (e) {} }

    var synced;
    function sync(force) {
      var a = signedIn(), uid = a ? a.user().id : null;
      if (!force && uid === synced) return;
      synced = uid;
      loadLink();
      var seq = ++st.seq;
      st.failed = false;
      closeSheets();
      if (!canAccount(a)) {
        st.where = 'local'; st.doc = loadLocal(); st.loaded = true; st.center = true;
        render();
        return;
      }
      st.where = 'account'; st.loaded = false; st.doc = null;
      render();
      a.loadFriends().then(function (data) {
        if (seq !== st.seq) return;
        var doc = clean(data), local = loadLocal(), mine = unsaved(uid);
        st.loaded = true; st.center = true;
        if (mine) { st.doc = mine; render(); save(); return; }
        if (!doc && local) {
          st.doc = local; render();
          save().then(function (ok) { if (ok) storeLocal(null); });
          return;
        }
        st.doc = doc;
        render();
      }, function (e) {
        if (seq !== st.seq) return;
        if (noTable(e)) { st.noTable = true; showLinkBtn(); sync(true); return; }
        st.failed = true;
        render();
      });
    }

    function save(now) {
      clearTimeout(timer); timer = null; st.pending = false;
      if (!st.doc) return Promise.resolve(false);
      if (st.where !== 'account') {
        st.saveErr = !storeLocal(st.doc);
        note();
        return Promise.resolve(!st.saveErr);
      }
      var a = signedIn();
      if (!a) return Promise.resolve(false);
      if (st.saving && !now) { st.again = true; return st.saving; }
      st.again = false;
      note('saving');
      var req = (now && a.saveFriendsNow && a.saveFriendsNow(st.doc)) || a.saveFriends(st.doc);
      var mine = st.saving = req.then(function () { return true; }, function () { return false; }).then(function (ok) {
        if (st.saving !== mine) return ok;
        st.saving = null;
        st.saveErr = !ok;
        if (st.again) { st.again = false; return save(); }
        if (ok && !st.pending) dropUnsaved();
        note();
        return ok;
      });
      return mine;
    }

    function changed() {
      st.saveErr = false;
      st.pending = true;
      render();
      clearTimeout(timer);
      timer = setTimeout(save, 450);
    }

    function putAway() {
      if (!st.pending && !st.saving) return;
      if (st.where === 'account') keepUnsaved();
      save(true);
    }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') putAway(); });
    window.addEventListener('pagehide', putAway);

    function note(state) {
      var a = accounts(), inAcct = st.where === 'account';
      ui.note.textContent = inAcct
        ? (state === 'saving' || st.saving || st.pending ? 'لحظة، ينحفظون…' : st.saveErr ? 'ما قدرنا نحفظ آخر تعديل. تأكد من النت.' : 'محفوظين بحسابك، وتلقاهم من أي جهاز تدخل منه.')
        : st.saveErr ? 'ما قدرنا نحفظهم بهالجهاز.' : 'محفوظين في جهازك بس.';
      ui.saveRetry.hidden = !(inAcct && st.saveErr && !st.saving);
      ui.signIn.hidden = inAcct || !a || !acctReady || st.noTable;
    }

    function counts() {
      ui.count.textContent = '';
      if (!st.doc) return;
      var n = Object.keys(st.doc.p).length, k = Object.keys(st.doc.g).length;
      if (n) ui.count.appendChild(el('b', null, friendsN(n)));
      if (k) ui.count.appendChild(el('span', null, groupsN(k)));
    }

    function setOpt(key, on) {
      if (!st.doc) return;
      var o = st.doc.o || {};
      if (on) o[key] = true; else delete o[key];
      if (Object.keys(o).length) st.doc.o = o; else delete st.doc.o;
    }
    function opt(key) { return !!(st.doc && st.doc.o && st.doc.o[key]); }

    /* --- drawing --- */

    function render() {
      ui.msg.hidden = true; ui.retry.hidden = true;
      counts();
      if (!acctReady || (!st.loaded && !st.failed)) {
        ui.start.hidden = true; ui.wrap.hidden = true;
        ui.msg.textContent = 'لحظة…'; ui.msg.hidden = false;
        return;
      }
      if (st.failed) {
        ui.start.hidden = true; ui.wrap.hidden = true;
        ui.msg.textContent = 'ما قدرنا نجيب ربعك الحين. تأكد من النت وجرّب مرة ثانية.';
        ui.msg.hidden = false; ui.retry.hidden = false;
        return;
      }
      if (!st.doc) {
        ui.wrap.hidden = true;
        if (ui.start.hidden) {
          ui.start.hidden = false;
          if (!ui.meName.value) ui.meName.value = myName();
          drawStarts();
        }
        return;
      }
      ui.start.hidden = true; ui.wrap.hidden = false;
      draw();
      note();
      showLinkBtn();
      if (!ui.sheet.hidden) fillSheet();
      if (!ui.gSheet.hidden) fillGroup();
      if (!st.fontsOk) {
        st.fontsOk = true;
        fontsReady(sampleOf(st.doc)).then(function () { if (st.doc && shown()) draw(); });
      }
    }

    // my name from the family tree or the work tree, or the account
    function myName() {
      var T = root.TREE && root.TREE.current && root.TREE.current(), Wk = root.WORK && root.WORK.current && root.WORK.current();
      var u = signedIn() && accounts().user();
      return (T && T.p[T.me] && T.p[T.me].n) || (Wk && Wk.p[Wk.me] && Wk.p[Wk.me].n) || (u && u.first) || '';
    }

    function draw() {
      var doc = st.doc, L = layout(doc, null, false);
      st.L = L;
      drawGroups();
      ui.canvas.textContent = '';
      ui.canvas.style.width = L.W + 'px';
      ui.canvas.style.height = L.H + 'px';
      var svg = svgOf(L, INK.sea), fresh = st.lastAdded && svg.querySelector('[data-pid="' + st.lastAdded + '"]');
      if (fresh) fresh.setAttribute('class', 'is-new');
      ui.canvas.appendChild(svg);
      L.hits.forEach(function (h) { ui.canvas.appendChild(hitBtn(h)); });
      ui.hint.textContent = Object.keys(doc.p).length ? 'دوس على أي اسم أو قروب عشان تعدّله.' : 'ضيف ربعك من «+ صديق».';
      sizeStage();
      if (st.center && shown()) {
        st.center = false;
        var h = st.lastAdded && L.hits.filter(function (x) { return x.k === 'p' && x.id === st.lastAdded; })[0];
        centerX(h ? h.x + h.w / 2 : L.mid);
      }
    }

    // the groups over the map: a chip each (its sheet), and «+ قروب»
    function drawGroups() {
      var doc = st.doc;
      ui.groups.textContent = '';
      Object.keys(doc.g).sort(byNum).forEach(function (gid) {
        var c = groupChip(doc, gid);
        c.dataset.gid = gid;
        c.setAttribute('aria-label', 'قروب ' + doc.g[gid].n + '، ' + friendsN(inGroup(doc, gid)));
        c.addEventListener('click', function () { openGroup(gid, c); });
        ui.groups.appendChild(c);
      });
      if (Object.keys(doc.g).length < MAXG) {
        var plus = el('button', 'tr-chip tr-chip-sm wk-dept-new', 'قروب');
        plus.type = 'button';
        plus.id = 'fr-g-plus';
        plus.setAttribute('aria-expanded', String(!ui.gForm.hidden));
        plus.addEventListener('click', function () {
          ui.gForm.hidden = !ui.gForm.hidden;
          plus.setAttribute('aria-expanded', String(!ui.gForm.hidden));
          if (!ui.gForm.hidden) { ui.gNew.value = ''; ui.gNew.focus(); }
        });
        ui.groups.appendChild(plus);
      } else ui.gForm.hidden = true;
    }

    function hitBtn(h) {
      var doc = st.doc, b = el('button', 'fr-hit');
      b.type = 'button';
      b.style.left = h.x + 'px'; b.style.top = h.y + 'px';
      b.style.width = h.w + 'px'; b.style.height = h.h + 'px';
      b.dataset.k = h.k;
      if (h.id) b.dataset.id = h.id;
      if (h.k === 'me') {
        b.setAttribute('aria-label', (doc.me || 'أنا') + '، غيّر اسمك');
        b.addEventListener('click', function () { openMe(b); });
      } else if (h.k === 'g') {
        b.setAttribute('aria-label', 'قروب ' + doc.g[h.id].n + '، ' + friendsN(inGroup(doc, h.id)));
        b.addEventListener('click', function () { openGroup(h.id, b); });
      } else {
        var f = doc.p[h.id];
        b.setAttribute('aria-label', f.n + '، ' + f.g.map(function (g) { return doc.g[g].n; }).join(' و'));
        b.addEventListener('click', function () { openFriend(h.id, b); });
      }
      return b;
    }

    function zooms() { return zoomSteps(st.L && st.L.W, ui.scroll.clientWidth - 36); }
    function sizeStage() {
      var L = st.L;
      if (!L || ui.scroll.clientWidth - 36 <= 0) return;
      var zs = zooms();
      st.zl = Math.min(st.zl, zs.length - 1);
      var last = zs.length > 1 && st.zl >= zs.length - 1, z = zs[st.zl];
      ui.zoom.hidden = zs.length < 2;
      st.z = z;
      ui.canvas.style.transform = z === 1 ? '' : 'scale(' + z + ')';
      ui.stage.style.width = Math.ceil(L.W * z) + 'px';
      ui.stage.style.height = Math.ceil(L.H * z) + 'px';
      ui.zoom.setAttribute('aria-label', last ? 'رجّعها لحجمها' : st.zl ? 'صغّرها أكثر' : 'صغّرها');
      ui.zoom.setAttribute('aria-pressed', String(st.zl > 0));
      ui.zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (last ? ZOOM.in : ZOOM.out) + '</svg>';
    }
    function centerX(x) { ui.scroll.scrollLeft = Math.max(0, 18 + x * st.z - ui.scroll.clientWidth / 2); }

    function pressed(btn, on) { btn.setAttribute('aria-pressed', String(!!on)); }
    function closeSheets() { closeFriend(true); closeGroup(true); }

    /* --- the start: my name and my groups --- */

    function drawStarts() {
      ui.sugg.textContent = '';
      SUGGEST.concat(st.custom).forEach(function (name) {
        var c = el('button', 'tr-chip tr-chip-sm fr-sg', name);
        c.type = 'button';
        pressed(c, st.starts.indexOf(name) >= 0);
        c.addEventListener('click', function () {
          var i = st.starts.indexOf(name);
          if (i >= 0) st.starts.splice(i, 1); else st.starts.push(name);
          pressed(c, i < 0);
          ui.startErr.hidden = true;
        });
        ui.sugg.appendChild(c);
      });
      // «+ قروب»: a group of my own, written in the field it opens
      if (SUGGEST.length + st.custom.length < MAXG) {
        var plus = el('button', 'tr-chip tr-chip-sm wk-dept-new', 'قروب');
        plus.type = 'button';
        plus.id = 'fr-start-plus';
        plus.setAttribute('aria-expanded', String(!ui.startGForm.hidden));
        plus.addEventListener('click', function () {
          ui.startGForm.hidden = !ui.startGForm.hidden;
          plus.setAttribute('aria-expanded', String(!ui.startGForm.hidden));
          if (!ui.startGForm.hidden) ui.startGName.focus();
        });
        ui.sugg.appendChild(plus);
      } else ui.startGForm.hidden = true;
    }
    function addStart() {
      var name = clip(ui.startGName.value, GROUP);
      if (!name) { ui.startGName.focus(); return false; }
      if (SUGGEST.concat(st.custom).indexOf(name) < 0) st.custom.push(name);
      if (st.starts.indexOf(name) < 0) st.starts.push(name);
      ui.startGName.value = '';
      ui.startGForm.hidden = true;
      ui.startErr.hidden = true;
      drawStarts();
      return true;
    }
    function addStartNow() {
      if (!addStart()) return;
      var plus = $('fr-start-plus');
      (plus || ui.meName).focus();
    }
    ui.startGAdd.addEventListener('click', addStartNow);
    ui.startGName.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      addStartNow();
    });
    ui.start.addEventListener('submit', function (e) {
      e.preventDefault();
      if (clip(ui.startGName.value, GROUP)) addStart();
      var name = clip(ui.meName.value, NAME);
      if (!name) { ui.startErr.textContent = 'اكتب اسمك'; ui.startErr.hidden = false; ui.meName.focus(); return; }
      if (!st.starts.length) { ui.startErr.textContent = 'اختار قروب واحد على الأقل، أو ضيف قروبك'; ui.startErr.hidden = false; return; }
      st.doc = blank(name, st.starts.slice(0, MAXG));
      st.center = true;
      var gs = Object.keys(st.doc.g);
      st.newSel = gs.length === 1 ? gs : [];
      changed();
      // straight to the first friend
      setTimeout(function () { openNew(st.newSel, ui.add); }, 0);
    });

    /* --- a new group, from the chips over the map --- */

    ui.gForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = addGroup(st.doc, ui.gNew.value);
      if (!id) { ui.gNew.focus(); return; }
      ui.gForm.hidden = true;
      changed();
      var plus = $('fr-g-plus');
      if (plus) plus.focus();
    });

    /* --- a friend's sheet: new, one of them, or me (my name only) --- */

    function openNew(sel, from) {
      if (!st.doc) return;
      st.mode = 'new'; st.pid = null;
      st.sel = groupsIn(st.doc.g, sel || st.newSel);
      ui.pName.value = '';
      openSheet(from);
      ui.pName.focus();
    }
    function openFriend(pid, from) {
      var f = st.doc && st.doc.p[pid];
      if (!f) return;
      st.mode = 'edit'; st.pid = pid; st.sel = f.g.slice();
      ui.pName.value = f.n;
      openSheet(from);
      ui.pClose.focus();
    }
    function openMe(from) {
      st.mode = 'me'; st.pid = null; st.sel = [];
      ui.pName.value = st.doc.me || '';
      openSheet(from);
      ui.pName.focus();
    }
    function openSheet(from) {
      closeGroup(true);
      st.from = from || null;
      ui.pDone.textContent = '';
      ui.pErr.hidden = true;
      ui.pConfirm.hidden = true;
      ui.pGForm.hidden = true;
      fillSheet();
      ui.sheet.hidden = false;
      lock(true);
    }
    function closeFriend(quiet) {
      if (ui.sheet.hidden) return;
      ui.sheet.hidden = true;
      lock(false);
      var back = st.from && document.body.contains(st.from) ? st.from : st.pid ? ui.canvas.querySelector('[data-id="' + st.pid + '"]') : ui.add;
      st.mode = null; st.pid = null;
      if (!quiet && back && !back.hidden) back.focus({ preventScroll: true });
    }

    function fillSheet() {
      var doc = st.doc;
      if (!doc || (st.mode === 'edit' && !doc.p[st.pid])) { closeFriend(); return; }
      var me = st.mode === 'me', edit = st.mode === 'edit';
      ui.pTitle.textContent = me ? 'اسمك' : edit ? doc.p[st.pid].n : 'صديق جديد';
      ui.pNameLabel.textContent = me ? 'اسمك' : 'الاسم';
      ui.pGBox.hidden = me;
      btnText(ui.pSave).textContent = edit || me ? 'حفظ' : 'ضيف';
      ui.pDel.hidden = !edit;
      if (edit) btnText(ui.pDel).textContent = 'امسح ' + doc.p[st.pid].n;
      st.sel = groupsIn(doc.g, st.sel);
      ui.pGroups.textContent = '';
      Object.keys(doc.g).sort(byNum).forEach(function (gid) {
        var c = groupChip(doc, gid);
        pressed(c, st.sel.indexOf(gid) >= 0);
        c.addEventListener('click', function () {
          var i = st.sel.indexOf(gid);
          if (i >= 0) st.sel.splice(i, 1); else st.sel.push(gid);
          pressed(c, i < 0);
          ui.pErr.hidden = true;
        });
        ui.pGroups.appendChild(c);
      });
      if (Object.keys(doc.g).length < MAXG) {
        var plus = el('button', 'tr-chip tr-chip-sm wk-dept-new', 'قروب');
        plus.type = 'button';
        plus.setAttribute('aria-expanded', String(!ui.pGForm.hidden));
        plus.addEventListener('click', function () {
          ui.pGForm.hidden = !ui.pGForm.hidden;
          plus.setAttribute('aria-expanded', String(!ui.pGForm.hidden));
          if (!ui.pGForm.hidden) { ui.pGName.value = ''; ui.pGName.focus(); }
        });
        ui.pGroups.appendChild(plus);
      }
    }

    // a new group from the friend's sheet: it is picked for them straight away
    function sheetGroup() {
      var id = addGroup(st.doc, ui.pGName.value);
      if (!id) { ui.pGName.focus(); return; }
      if (st.sel.indexOf(id) < 0) st.sel.push(id);
      ui.pGForm.hidden = true;
      ui.pErr.hidden = true;
      changed();
      ui.pName.focus();
    }
    ui.pGAdd.addEventListener('click', sheetGroup);
    ui.pGName.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      sheetGroup();
    });

    ui.pForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var doc = st.doc, name = clip(ui.pName.value, NAME);
      if (!name) { sayErr(st.mode === 'me' ? 'اكتب اسمك' : 'اكتب الاسم'); ui.pName.focus(); return; }
      if (st.mode === 'me') {
        doc.me = name;
        ui.pDone.textContent = 'انحفظ ✓';
        changed();
        return;
      }
      if (!st.sel.length) { sayErr('اختار قروب واحد على الأقل'); return; }
      if (st.mode === 'edit') {
        setFriend(doc, st.pid, name, st.sel);
        ui.pDone.textContent = 'انحفظ ✓';
        changed();
        return;
      }
      if (Object.keys(doc.p).length >= MAXP) { sayErr('وصلت الحد: ' + MAXP + ' صديق'); return; }
      var id = addFriend(doc, name, st.sel);
      if (!id) { sayErr('ما زبطت، جرّب مرة ثانية'); return; }
      // the next friend starts in the same groups
      st.newSel = st.sel.slice();
      st.lastAdded = id; st.center = true;
      ui.pName.value = '';
      ui.pDone.textContent = 'انضاف ' + name + ' ✓';
      changed();
      ui.pName.focus();
    });
    function sayErr(text) { ui.pErr.textContent = text; ui.pErr.hidden = false; }
    ui.pName.addEventListener('input', function () { ui.pErr.hidden = true; ui.pDone.textContent = ''; });

    ui.pDel.addEventListener('click', function () { ui.pConfirm.hidden = false; ui.pYes.focus(); });
    ui.pNo.addEventListener('click', function () { ui.pConfirm.hidden = true; ui.pDel.focus(); });
    ui.pYes.addEventListener('click', function () {
      if (st.mode !== 'edit' || !st.doc.p[st.pid]) return;
      delete st.doc.p[st.pid];
      if (st.lastAdded === st.pid) st.lastAdded = null;
      st.from = ui.add;
      ui.pConfirm.hidden = true;
      closeFriend();
      changed();
    });
    ui.pClose.addEventListener('click', function () { closeFriend(); });
    ui.sheet.addEventListener('click', function (e) { if (e.target === ui.sheet) closeFriend(); });
    ui.add.addEventListener('click', function () { openNew(null, ui.add); });

    /* --- a group's sheet: its name, its colour, a friend in it, and taking it out --- */

    function openGroup(gid, from) {
      if (!st.doc || !st.doc.g[gid]) return;
      closeFriend(true);
      st.gid = gid; st.gFrom = from || null;
      ui.gName.value = st.doc.g[gid].n;
      ui.gErr.hidden = true;
      ui.gConfirm.hidden = true;
      fillGroup();
      ui.gSheet.hidden = false;
      lock(true);
      ui.gClose.focus();
    }
    function closeGroup(quiet) {
      if (ui.gSheet.hidden) return;
      ui.gSheet.hidden = true;
      lock(false);
      var gid = st.gid, back = st.gFrom && document.body.contains(st.gFrom) ? st.gFrom : ui.groups.querySelector('[data-gid="' + gid + '"]');
      st.gid = null;
      if (!quiet && back) back.focus({ preventScroll: true });
    }
    function fillGroup() {
      var doc = st.doc, g = doc && doc.g[st.gid];
      if (!g) { closeGroup(); return; }
      ui.gDot.style.background = COLORS.sea[g.c];
      ui.gTitle.textContent = g.n;
      var n = inGroup(doc, st.gid);
      ui.gCount.textContent = n ? friendsN(n) : 'ما فيه أحد للحين';
      groupDirty();
      ui.gColors.textContent = '';
      COLORS.sea.forEach(function (c, i) {
        var b = el('button', 'fr-color');
        b.type = 'button';
        b.style.background = c;
        b.setAttribute('aria-label', COLOR_NAMES[i]);
        pressed(b, g.c === i);
        b.addEventListener('click', function () {
          if (g.c === i) return;
          g.c = i;
          changed();
          var on = ui.gColors.querySelector('[aria-pressed="true"]');
          if (on) on.focus();
        });
        ui.gColors.appendChild(b);
      });
    }
    function groupDirty() {
      var g = st.doc.g[st.gid], v = clip(ui.gName.value, GROUP);
      ui.gSave.disabled = !v || v === g.n;
    }
    ui.gName.addEventListener('input', function () { ui.gErr.hidden = true; groupDirty(); });
    ui.gRename.addEventListener('submit', function (e) {
      e.preventDefault();
      var doc = st.doc, v = clip(ui.gName.value, GROUP);
      if (!v || !doc.g[st.gid]) return;
      var same = Object.keys(doc.g).filter(function (id) { return id !== st.gid && doc.g[id].n === v; })[0];
      if (same) { ui.gErr.textContent = 'فيه قروب بهالاسم'; ui.gErr.hidden = false; return; }
      doc.g[st.gid].n = v;
      changed();
    });
    ui.gAddF.addEventListener('click', function () {
      var gid = st.gid;
      closeGroup(true);
      openNew([gid], ui.add);
    });
    ui.gDel.addEventListener('click', function () {
      var doc = st.doc, only = onlyIn(doc, st.gid), all = inGroup(doc, st.gid);
      ui.gWarn.textContent = only
        ? 'بينمسح القروب، ومعاه ' + friendsN(only) + ' ما ' + (only === 1 ? 'له' : 'لهم') + ' قروب ثاني.'
        : all ? 'بينمسح القروب بس، وربعه يبقون بقروباتهم الثانية.' : 'متأكد؟';
      ui.gConfirm.hidden = false;
      ui.gYes.focus();
    });
    ui.gNo.addEventListener('click', function () { ui.gConfirm.hidden = true; ui.gDel.focus(); });
    ui.gYes.addEventListener('click', function () {
      if (!st.doc.g[st.gid]) return;
      removeGroup(st.doc, st.gid);
      if (st.lastAdded && !st.doc.p[st.lastAdded]) st.lastAdded = null;
      st.newSel = groupsIn(st.doc.g, st.newSel);
      if (st.keep) st.keep = groupsIn(st.doc.g, st.keep);
      st.gFrom = ui.add;
      ui.gConfirm.hidden = true;
      closeGroup();
      changed();
    });
    ui.gClose.addEventListener('click', function () { closeGroup(); });
    ui.gSheet.addEventListener('click', function (e) { if (e.target === ui.gSheet) closeGroup(); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!ui.sheet.hidden) closeFriend();
      else if (!ui.gSheet.hidden) closeGroup();
    });

    /* --- the bar: zoom --- */

    ui.zoom.addEventListener('click', function () {
      var zs = zooms(), mid = (ui.scroll.scrollLeft + ui.scroll.clientWidth / 2 - 18) / st.z;
      st.zl = st.zl >= zs.length - 1 ? 0 : st.zl + 1;
      sizeStage();
      ui.scroll.scrollLeft = Math.max(0, 18 + mid * st.z - ui.scroll.clientWidth / 2);
    });
    ui.retry.addEventListener('click', function () { sync(true); });
    ui.saveRetry.addEventListener('click', function () { save(); });
    ui.signIn.addEventListener('click', function () {
      if (root.KIN && root.KIN.openAuth) root.KIN.openAuth({ title: 'احفظ ربعك بحسابك', text: 'سجّل دخولك عشان ينحفظ ربعك بحسابك، وتلقاهم من أي جهاز.' }, ui.signIn);
    });

    /* --- share: a story or post, and the PDF, with the groups I pick (Ali: one, two, or all of them) --- */

    // the groups to pick from in the share sheet; the pick stays while the page is open
    function groupPicks(opts) {
      var doc = st.doc, ids = Object.keys(doc.g).sort(byNum);
      if (ids.length < 2) return null;
      return {
        label: 'القروبات',
        items: ids.map(function (id) { return { key: id, label: doc.g[id].n, color: COLORS.sea[doc.g[id].c] }; }),
        value: opts.keep || ids,
        set: function (keys) { opts.keep = keys.length >= ids.length ? null : keys.slice(); st.keep = opts.keep; }
      };
    }
    // «الأسامي: كلها / بس اسمي», kept with my friends: the link follows it too
    function namesChoice(opts) {
      if (!Object.keys(st.doc.p).length) return null;
      return {
        label: 'الأسامي', items: [{ key: 'all', label: 'كلها' }, { key: 'me', label: 'بس اسمي' }], value: opts.hide ? 'me' : 'all',
        set: function (key) { opts.hide = key === 'me'; if (st.doc) { setOpt('hide', opts.hide); changed(); } }
      };
    }
    function shareOpts(qr) {
      var keep = st.keep && groupsIn(st.doc.g, st.keep);
      return { hide: opt('hide'), keep: keep && keep.length ? keep : null, qr: qr || null };
    }
    // my «رابط ربعي», when I have one (it goes with the account)
    function myLink() { return st.link && signedIn() ? linkUrl(st.link) : null; }
    ui.share.addEventListener('click', function () {
      if (!st.doc || !root.KIN || !root.KIN.openShare) return;
      var doc = copy(st.doc), opts = shareOpts(), link = myLink();
      root.KIN.openShare({
        file: 'shorbaka-friends',
        make: function (format) { return makePicture(doc, format, opts); },
        alt: altOf(doc, opts.keep),
        mention: 'تمنشن ربعك',
        link: link,
        linkLabel: 'انسخ رابط ربعي',
        tips: link
          ? { story: 'حطها ستوري مع ستيكر الرابط، ومنشن ربعك', post: 'نزّلها بوست ومنشن ربعك، وحط الرابط بالبايو' }
          : { story: 'حطها ستوري ومنشن ربعك', post: 'نزّلها بوست ومنشن ربعك' },
        text: link
          ? 'حطيت ربعي على شرباكة 🤝 شوفهم هني: ' + link
          : 'حطيت ربعي على شرباكة 🤝 حط ربعك: https://shorbaka.com/#friends',
        picks: groupPicks(opts),
        choice: namesChoice(opts)
      }, ui.share);
    });
    ui.pdf.addEventListener('click', function () {
      if (!st.doc || !root.KIN || !root.KIN.openShare) return;
      // with my «رابط ربعي», the QR in the corner opens it
      var link = myLink(), doc = copy(st.doc), opts = shareOpts(link);
      var size = function (label, alt) { return { label: label, title: 'جاهزة للطباعة', alt: alt, dl: 'حمّل ملف PDF', tip: '' }; };
      root.KIN.openShare({
        file: 'shorbaka-friends',
        sizes: { port: size('بالطول', 'صفحة A4 بالطول'), land: size('بالعرض', 'صفحة A4 بالعرض') },
        sizesLabel: 'اتجاه الصفحة',
        make: function (orient) { return makePdf(doc, orient, opts); },
        alt: altOf(doc, opts.keep),
        tips: { port: 'اطبعها على ورقة A4، أو أرسلها بقروب ربعك', land: 'اطبعها على ورقة A4، أو أرسلها بقروب ربعك' },
        text: link
          ? 'ربعي من شرباكة 🤝 شوفهم هني: ' + link
          : 'ربعي من شرباكة 🤝 حط ربعك: https://shorbaka.com/#friends',
        picks: groupPicks(opts),
        choice: namesChoice(opts)
      }, ui.pdf);
    });

    /* --- «رابط ربعي»: all my friends and groups at shorbaka.com/f/#code, with no password (as the trees) ---
       It needs the account: the page shows them as they are saved there. The sheet shows one of out (not
       signed in), wait, err, none (no link yet), on (the link, its QR and a way to copy it) or stop (are
       you sure). st.link: undefined while it loads, null when I have none. */

    var linkSeq = 0, linkMode = '', linkNote = null;

    function linkUrl(code) {
      var site = /(^|\.)shorbaka\.com$/.test(location.hostname) ? 'https://shorbaka.com' : location.origin;
      return site + '/f/#' + code;
    }

    function loadLink() {
      var a = signedIn(), seq = ++linkSeq;
      st.linkErr = false; linkMode = ''; linkNote = null;
      if (!a || !a.friendsLink) { st.link = null; showLinkBtn(); fillLink(); return; }
      st.link = undefined;
      showLinkBtn(); fillLink();
      a.friendsLink().then(function (code) {
        if (seq === linkSeq) st.link = code || null;
      }, function (e) {
        if (seq !== linkSeq) return;
        st.link = null;
        // the site went up before its database knew about these links: no button until it does
        if (e && (e.code === 'PGRST202' || e.code === '42883')) st.linkOff = true; else st.linkErr = true;
      }).then(function () {
        if (seq === linkSeq) { showLinkBtn(); fillLink(); }
      });
    }

    function showLinkBtn() {
      if (ui.linkBtn) ui.linkBtn.hidden = !st.doc || !accounts() || !!st.linkOff || st.noTable;
    }

    function linkState() {
      if (!signedIn()) return 'out';
      if (st.linkErr) return 'err';
      if (st.link === undefined) return 'wait';
      if (!st.link) return 'none';
      return linkMode || 'on';
    }

    function fillLink() {
      if (!ui.link || ui.link.hidden) return;
      var s = linkState(), url = st.link ? linkUrl(st.link) : '';
      ui.lIn.hidden = s !== 'out';
      ui.lRetry.hidden = s !== 'err';
      ui.lMake.hidden = s !== 'none';
      ui.lOn.hidden = ui.lMore.hidden = s !== 'on';
      ui.lConfirm.hidden = s !== 'stop';
      var m = s === 'wait' ? { a: 'لحظة…' }
        : s === 'err' ? { err: true, a: 'ما قدرنا نجيب الرابط الحين. تأكد من النت.' }
        : linkNote && linkNote.s === s ? linkNote : null;
      ui.lMsg.textContent = m ? m.a : '';
      ui.lMsg.hidden = !m;
      ui.lMsg.classList.toggle('is-err', !!(m && m.err));

      if (s !== 'on' || ui.lQr.dataset.url === url) return;
      ui.lUrl.textContent = url.replace(/^https?:\/\//, '');
      ui.lQr.dataset.url = url; ui.lQr.textContent = '';
      var T = root.TREE;
      if (!T || !T.loadQr || !T.qrOf || !T.qrSvg) { ui.lQr.hidden = true; return; }
      T.loadQr().then(function (qrcode) {
        if (ui.lQr.dataset.url !== url) return;
        ui.lQr.innerHTML = T.qrSvg(T.qrOf(qrcode, url));
        ui.lQr.hidden = false;
      }, function () {
        if (ui.lQr.dataset.url === url) { ui.lQr.dataset.url = ''; ui.lQr.hidden = true; }
      });
    }

    function btnText(btn) { return btn.querySelector('span') || btn; }
    function flashBtn(btn, text) {
      var s = btnText(btn);
      if (!s.dataset.label) s.dataset.label = s.textContent;
      s.textContent = text;
      clearTimeout(btn._t);
      btn._t = setTimeout(function () { s.textContent = s.dataset.label; }, 2200);
    }
    function sayLink(s, err, a) { linkNote = { s: s, err: err, a: a }; fillLink(); }

    function openLink() {
      if (!st.doc || !ui.link) return;
      linkMode = ''; linkNote = null;
      if (signedIn() && st.linkErr) loadLink();
      ui.link.hidden = false;
      lock(true);
      fillLink();
      ui.lClose.focus();
    }

    function closeLink() {
      if (!ui.link || ui.link.hidden) return;
      ui.link.hidden = true;
      lock(false);
      linkMode = ''; linkNote = null;
      if (ui.linkBtn && !ui.linkBtn.hidden) ui.linkBtn.focus({ preventScroll: true });
    }

    if (ui.link && ui.linkBtn) {
      ui.linkBtn.addEventListener('click', openLink);
      ui.lClose.addEventListener('click', closeLink);
      ui.link.addEventListener('click', function (e) { if (e.target === ui.link) closeLink(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !ui.link.hidden) { e.stopPropagation(); closeLink(); }
      }, true);
      ui.lRetry.addEventListener('click', loadLink);
      ui.lIn.addEventListener('click', function () {
        closeLink();
        if (root.KIN && root.KIN.openAuth) root.KIN.openAuth({ title: 'سجّل دخولك', text: 'الرابط يفتح ربعك من حسابك: سجّل دخولك عشان ينحفظون فيه، وبعدها سوّ الرابط.' }, ui.linkBtn);
      });
      ui.lMake.addEventListener('click', function () {
        var a = signedIn();
        if (!a || linkState() !== 'none') return;
        var uid = a.user().id, s = btnText(ui.lMake), text = s.textContent;
        ui.lMake.disabled = true; s.textContent = 'لحظة…';
        // the link shows what is saved in the account, so the last change goes first
        (st.pending || st.saving ? save() : Promise.resolve(true)).then(function () {
          return a.makeFriendsLink();
        }).then(function (code) {
          ui.lMake.disabled = false; s.textContent = text;
          var b = signedIn();
          if (!b || b.user().id !== uid || !code) return;
          st.link = code; st.linkErr = false; linkMode = '';
          sayLink('on', false, 'سوّينا الرابط ✓');
          ui.lCopy.focus({ preventScroll: true });
        }, function () {
          ui.lMake.disabled = false; s.textContent = text;
          sayLink('none', true, 'ما زبطت. تأكد من النت وجرّب مرة ثانية.');
        });
      });
      ui.lCopy.addEventListener('click', function () {
        if (!st.link) return;
        root.KIN.copyText(linkUrl(st.link)).then(function (ok) { flashBtn(ui.lCopy, ok ? 'انتسخ الرابط ✓' : 'ما انتسخ، جرّب مرة ثانية'); });
      });
      ui.lStop.addEventListener('click', function () { linkMode = 'stop'; linkNote = null; fillLink(); ui.lNo.focus(); });
      ui.lNo.addEventListener('click', function () { linkMode = ''; fillLink(); ui.lStop.focus(); });
      ui.lYes.addEventListener('click', function () {
        var a = signedIn();
        if (!a || linkState() !== 'stop') return;
        ui.lYes.disabled = ui.lNo.disabled = true;
        a.stopFriendsLink().then(function () {
          ui.lYes.disabled = ui.lNo.disabled = false;
          st.link = null; linkMode = '';
          sayLink('none', false, 'وقّفنا الرابط، وما عاد ينفتح.');
          ui.lClose.focus();
        }, function () {
          ui.lYes.disabled = ui.lNo.disabled = false;
          linkMode = '';
          sayLink('on', true, 'ما قدرنا نوقّفه الحين. تأكد من النت وجرّب مرة ثانية.');
        });
      });
    }

    /* --- account --- */

    if (root.ACCOUNT && root.ACCOUNT.ready) {
      root.ACCOUNT.ready.then(function () { acctReady = true; sync(true); }, function () { acctReady = true; sync(true); });
      if (root.ACCOUNT.onChange) root.ACCOUNT.onChange(function () { if (acctReady) sync(); });
    } else { acctReady = true; sync(true); }

    var lastW = 0;
    window.addEventListener('resize', function () {
      if (!st.doc || !shown() || ui.scroll.clientWidth === lastW) return;
      lastW = ui.scroll.clientWidth;
      draw();
    });

    FRIENDS.shown = function (on) { if (on && st.doc) { st.center = true; draw(); } };
    FRIENDS.current = function () { return st.doc; };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
