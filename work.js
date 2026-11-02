/* شرباكة: «شجرة دوامي».
   The family tree's idea for a workplace: start from yourself and add your manager, your colleagues and
   the people under you. Under every name the tree writes what that person is to you («مديرتي»،
   «زميلي»، «موظف عندي»). Colours are departments, me in sand. Shared as a story or post (with
   «أخفي الأسامي»: only the names of people marked «ربعي» stay) or printed as an A4 PDF.

   The whole tree is one small document:
     { v: 1, me: 'p1', n: 7, co: 'شركة اللؤلؤة',
       p: { p1: { n: 'علي', g: 'm', b: 'p2', j: 'مصمم', d: 'd3', h: 1, x: 1 }, ... }
                 name, m or f, b: their manager (none for the one at the top), j: their job,
                 d: their department, h: «ربعي» (a friend at work), x: «طلع من الدوام» (left)
       d: { d3: { n: 'التسويق', c: 0 } },      departments: name and colour (an index in DEPT_COLORS)
       o: { hide: true, tidy: true, mine: true } }   settings (left out when none is on)
   Everyone is under one person at the top; the people under someone are in the order they were added. */
(function (root) {
  'use strict';

  var WORK = {};
  var KIN = root.KIN || (typeof require === 'function' ? (function () { try { return require('./kin.js'); } catch (e) { return null; } })() : null);
  var MAXP = 400, NAME = 40, JOB = 40, CO = 40, DEPT = 24, MAXD = 12;

  function num(id) { return +String(id).slice(1) || 0; }
  function byNum(a, b) { return num(a) - num(b); }
  function count(doc) { return Object.keys(doc.p).length; }
  function copy(doc) { return JSON.parse(JSON.stringify(doc)); }
  function clip(s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n); }

  function blank(name, g, job, co) {
    var doc = { v: 1, me: 'p1', n: 1, p: { p1: { n: clip(name, NAME), g: g === 'f' ? 'f' : 'm' } }, d: {} };
    if (clip(job, JOB)) doc.p.p1.j = clip(job, JOB);
    if (clip(co, CO)) doc.co = clip(co, CO);
    return doc;
  }

  // The people under each person, in the order they were added; '' holds the one at the top.
  function kidsOf(doc) {
    var K = {};
    Object.keys(doc.p).sort(byNum).forEach(function (id) {
      var b = doc.p[id].b || '';
      (K[b] = K[b] || []).push(id);
    });
    return K;
  }
  function topOf(doc) {
    var id = doc.me, seen = {};
    while (doc.p[id].b && !seen[id]) { seen[id] = 1; id = doc.p[id].b; }
    return id;
  }

  /* A document as it came from storage, made safe: unknown keys dropped, managers that don't exist or
     go round in a circle cut, and anyone not joined to the top of my tree left out. */
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || !raw.p || typeof raw.p !== 'object') return null;
    var p = {}, d = {}, n = 0, ids = Object.keys(raw.p).filter(function (id) { return /^p\d+$/.test(id); }).sort(byNum).slice(0, MAXP);
    var rd = raw.d && typeof raw.d === 'object' ? raw.d : {};
    Object.keys(rd).filter(function (id) { return /^d\d+$/.test(id); }).sort(byNum).slice(0, MAXD).forEach(function (id) {
      var x = rd[id], name = x && clip(x.n, DEPT);
      if (!name) return;
      d[id] = { n: name, c: Math.max(0, Math.min(DEPT_COLORS.sea.length - 1, Math.floor(+x.c) || 0)) };
      n = Math.max(n, num(id));
    });
    ids.forEach(function (id) {
      var x = raw.p[id];
      if (!x || typeof x !== 'object') return;
      var q = { n: clip(x.n, NAME), g: x.g === 'f' ? 'f' : 'm' };
      if (typeof x.b === 'string' && /^p\d+$/.test(x.b)) q.b = x.b;
      if (clip(x.j, JOB)) q.j = clip(x.j, JOB);
      if (typeof x.d === 'string' && d[x.d]) q.d = x.d;
      if (x.h) q.h = 1;
      if (x.x) q.x = 1;
      p[id] = q;
      n = Math.max(n, num(id));
    });
    if (!p[raw.me]) return null;
    // managers that are missing, or that lead back round to the person
    Object.keys(p).forEach(function (id) {
      if (p[id].b && (!p[p[id].b] || p[id].b === id)) delete p[id].b;
    });
    Object.keys(p).forEach(function (id) {
      var seen = {}, cur = id;
      while (p[cur].b) {
        seen[cur] = 1;
        if (seen[p[cur].b]) { delete p[cur].b; break; }
        cur = p[cur].b;
      }
    });
    var doc = { v: 1, me: raw.me, n: Math.max(n, Math.floor(+raw.n) || 0), p: p, d: d };
    // only the people joined to the top of my tree
    var top = topOf(doc), K = kidsOf(doc), keep = {}, queue = [top];
    while (queue.length) { var id = queue.shift(); keep[id] = 1; (K[id] || []).forEach(function (k) { queue.push(k); }); }
    Object.keys(p).forEach(function (id) { if (!keep[id]) delete p[id]; });
    dropUnused(doc);
    var co = clip(raw.co, CO);
    if (co) doc.co = co;
    if (raw.o && typeof raw.o === 'object') {
      var o = {};
      ['hide', 'tidy', 'mine'].forEach(function (k) { if (raw.o[k]) o[k] = true; });
      if (Object.keys(o).length) doc.o = o;
    }
    return doc;
  }

  // Departments nobody is in any more go.
  function dropUnused(doc) {
    var used = {};
    Object.keys(doc.p).forEach(function (id) { if (doc.p[id].d) used[doc.p[id].d] = 1; });
    Object.keys(doc.d).forEach(function (id) { if (!used[id]) delete doc.d[id]; });
  }

  /* --- changes (each returns false when it can't be made) --- */

  function newPerson(doc, name, g, job, dept) {
    if (count(doc) >= MAXP) return null;
    var id = 'p' + (++doc.n), q = { n: clip(name, NAME), g: g === 'f' ? 'f' : 'm' };
    if (clip(job, JOB)) q.j = clip(job, JOB);
    if (dept && doc.d[dept]) q.d = dept;
    doc.p[id] = q;
    return id;
  }

  /* Adds someone next to pid: t is 'B' (their manager: only when they have none), 'C' (a colleague
     under the same manager) or 'R' (someone under them). The new person starts in pid's department.
     Returns the new id. */
  function addNext(doc, pid, t, name, g, job) {
    var p = doc.p[pid];
    if (!p || !clip(name, NAME)) return null;
    if (t === 'B' && p.b) return null;
    if (t === 'C' && !p.b) return null;
    var id = newPerson(doc, name, g, job, p.d);
    if (!id) return null;
    if (t === 'B') p.b = id;
    else if (t === 'C') doc.p[id].b = p.b;
    else doc.p[id].b = pid;
    return id;
  }

  /* Takes someone out: the people under them move up to their manager. The one at the top can go only
     when one person is right under them (that one becomes the top). Never me. */
  function removePerson(doc, pid) {
    var p = doc.p[pid];
    if (!p || pid === doc.me) return false;
    var under = Object.keys(doc.p).filter(function (id) { return doc.p[id].b === pid; });
    if (!p.b && under.length > 1) return false;
    under.forEach(function (id) { if (p.b) doc.p[id].b = p.b; else delete doc.p[id].b; });
    delete doc.p[pid];
    dropUnused(doc);
    return true;
  }
  function canRemove(doc, pid) {
    var p = doc.p[pid];
    if (!p || pid === doc.me) return false;
    return !!p.b || Object.keys(doc.p).filter(function (id) { return doc.p[id].b === pid; }).length <= 1;
  }

  // A new department, with the first colour no department has yet. Returns its id.
  function addDept(doc, name) {
    name = clip(name, DEPT);
    if (!name) return null;
    var same = Object.keys(doc.d).filter(function (id) { return doc.d[id].n === name; })[0];
    if (same) return same;
    if (Object.keys(doc.d).length >= MAXD) return null;
    var taken = {};
    Object.keys(doc.d).forEach(function (id) { taken[doc.d[id].c] = 1; });
    var c = 0;
    while (taken[c] && c < DEPT_COLORS.sea.length - 1) c++;
    var id = 'd' + (++doc.n);
    doc.d[id] = { n: name, c: c };
    return id;
  }

  /* --- what each person is to me --- */

  var WORDS = {
    boss: ['مديري', 'مديرتي'], boss2: ['مدير مديري', 'مديرة مديري'], above: ['فوق مديري', 'فوق مديري'],
    rep: ['موظف عندي', 'موظفة عندي'], team: ['بفريقي', 'بفريقي'], mate: ['زميلي', 'زميلتي']
  };
  function w(key, p) { return WORDS[key][p.g === 'f' ? 1 : 0]; }

  function relLabel(doc, pid) {
    var me = doc.me, p = doc.p[pid];
    if (!p) return '';
    if (pid === me) return 'أنا';
    // above me
    var up = doc.p[me].b, k = 1;
    while (up) {
      if (up === pid) return w(k === 1 ? 'boss' : k === 2 ? 'boss2' : 'above', p);
      up = doc.p[up].b; k++;
    }
    // under me
    var cur = p.b; k = 1;
    while (cur) {
      if (cur === me) return w(k === 1 ? 'rep' : 'team', p);
      cur = doc.p[cur].b; k++;
    }
    var myBoss = doc.p[me].b;
    if (myBoss && p.b === myBoss) return w('mate', p);
    // under one of my colleagues
    var b = p.b && doc.p[p.b];
    if (b && myBoss && b.b === myBoss) return 'بفريق ' + w('mate', b);
    var md = doc.p[me].d;
    if (p.d && md && p.d === md) return 'من قسمي';
    if (p.d && doc.d[p.d]) return 'من ' + doc.d[p.d].n;
    return 'معاي بالدوام';
  }

  // The words on the «ضيف» buttons for pid: «مديره» / «مديرها» / «مديري».
  function addWords(doc, pid) {
    var mine = pid === doc.me, f = doc.p[pid].g === 'f';
    var end = mine ? 'ي' : f ? 'ها' : 'ه';
    return { B: 'مدير' + end, C: 'زميل' + (mine ? 'ي' : f ? ' لها' : ' له'), R: 'موظف عند' + end };
  }

  /* --- views: the whole workplace, or my department only --- */

  // «قسمي»: from the highest of my managers still in my department, everyone in it (or with none set).
  function viewOf(doc, mine) {
    var K = kidsOf(doc), md = doc.p[doc.me].d;
    if (!mine || !md) return { root: topOf(doc), K: K, mine: false };
    var r = doc.me;
    while (doc.p[r].b && doc.p[doc.p[r].b].d === md) r = doc.p[r].b;
    var K2 = {};
    Object.keys(K).forEach(function (b) {
      K2[b] = K[b].filter(function (id) { var d = doc.p[id].d; return !d || d === md; });
    });
    return { root: r, K: K2, mine: true };
  }
  function inView(v) {
    var out = [], queue = [v.root];
    while (queue.length) { var id = queue.shift(); out.push(id); (v.K[id] || []).forEach(function (k) { queue.push(k); }); }
    return out;
  }
  // Is «قسمي» worth showing: I have a department and it leaves someone out.
  function hasMine(doc) {
    return !!doc.p[doc.me].d && inView(viewOf(doc, true)).length < count(doc);
  }

  /* --- layout ---
     A person's box is NW wide and NH tall (the circle on top, AV wide); the people under someone sit
     RH lower. With «ترتيب», three or more people under someone with nobody under them stand in two
     columns on a line down from them (a comb), and the rest go in a row under the comb. Lines are
     lists of ['M'|'L', x, y] and ['Q', cx, cy, x, y]. Built left to right and turned around at the end,
     so the first person under someone is on the right. */

  var SCREEN = { NW: 92, AV: 54, NH: 112, CG: 14, RH: 156, CH: 122, PG: 12, R: 12 };

  function moved(list, dx, dy) {
    return list.map(function (s) {
      var o = [s[0]];
      for (var i = 1; i < s.length; i += 2) { o.push(s[i] + dx, s[i + 1] + dy); }
      return o;
    });
  }

  // The lines from someone at (px, y0) to the people under them at xs (their circles RH lower).
  function famLines(px, xs, M, y0) {
    var t = y0 + M.NH + 4, bus = y0 + M.NH + (M.RH - M.NH) / 2, b = y0 + M.RH - 6, r = Math.min(M.R, bus - t, b - bus);
    var lo = Math.min.apply(null, xs), hi = Math.max.apply(null, xs);
    if (hi - lo < 1) return [['M', px, t], ['L', px, b]];
    var out = [['M', px, t], ['L', px, bus],
      ['M', lo, b], ['L', lo, bus + r], ['Q', lo, bus, lo + r, bus], ['L', hi - r, bus], ['Q', hi, bus, hi, bus + r], ['L', hi, b]];
    xs.forEach(function (x) { if (x > lo + 0.5 && x < hi - 0.5) out.push(['M', x, bus], ['L', x, b]); });
    return out;
  }

  function rowOf(subs, M) {
    var x = 0, at = [];
    subs.forEach(function (s, i) { if (i) x += M.CG; at.push(x); x += s.w; });
    return { at: at, w: x, cs: subs.map(function (s, i) { return at[i] + s.cx; }) };
  }

  function lay(id, K, M, tidy) {
    var kids = K[id] || [];
    if (!kids.length) return { w: M.NW, h: M.NH, cx: M.NW / 2, nodes: [{ id: id, x: M.NW / 2, y: 0 }], lines: [] };
    var leaves = kids.filter(function (k) { return !(K[k] || []).length; });
    var others = kids.filter(function (k) { return (K[k] || []).length; });
    var nodes = [], lines = [];
    if (!tidy || leaves.length < 3) {
      var subs = kids.map(function (k) { return lay(k, K, M, tidy); }), row = rowOf(subs, M);
      var pcx = (row.cs[0] + row.cs[row.cs.length - 1]) / 2;
      var minX = Math.min(0, pcx - M.NW / 2), maxX = Math.max(row.w, pcx + M.NW / 2), sh = -minX, H = 0;
      nodes.push({ id: id, x: pcx + sh, y: 0 });
      subs.forEach(function (s, i) {
        s.nodes.forEach(function (n) { nodes.push({ id: n.id, x: n.x + row.at[i] + sh, y: n.y + M.RH }); });
        lines = lines.concat(moved(s.lines, row.at[i] + sh, M.RH));
        H = Math.max(H, s.h);
      });
      lines = lines.concat(famLines(pcx + sh, row.cs.map(function (c) { return c + sh; }), M, 0));
      return { w: maxX - minX, h: M.RH + H, cx: pcx + sh, nodes: nodes, lines: lines };
    }
    // the comb, its line down at x = 0 for now
    var off = M.NW / 2 + M.PG, rows = Math.ceil(leaves.length / 2), r = M.AV / 2 + 4;
    var combEnd = M.RH + (rows - 1) * M.CH + M.NH, lastStub = M.RH + (rows - 1) * M.CH + M.AV / 2;
    leaves.forEach(function (k, i) {
      var x = i % 2 ? off : -off, y = M.RH + Math.floor(i / 2) * M.CH;
      nodes.push({ id: k, x: x, y: y });
      lines.push(['M', 0, y + M.AV / 2], ['L', x < 0 ? x + r : x - r, y + M.AV / 2]);
    });
    var minX = -off - M.NW / 2, maxX = off + M.NW / 2, H = combEnd, spineEnd = lastStub;
    if (others.length) {
      var subs2 = others.map(function (k) { return lay(k, K, M, tidy); }), row2 = rowOf(subs2, M);
      var mid = (row2.cs[0] + row2.cs[row2.cs.length - 1]) / 2, ox = -mid, oy = combEnd + (M.RH - M.NH), H2 = 0;
      subs2.forEach(function (s, i) {
        s.nodes.forEach(function (n) { nodes.push({ id: n.id, x: n.x + row2.at[i] + ox, y: n.y + oy }); });
        lines = lines.concat(moved(s.lines, row2.at[i] + ox, oy));
        H2 = Math.max(H2, s.h);
      });
      lines = lines.concat(famLines(0, row2.cs.map(function (c) { return c + ox; }), M, combEnd - M.NH));
      minX = Math.min(minX, ox); maxX = Math.max(maxX, ox + row2.w);
      H = oy + H2; spineEnd = combEnd + 4;
    }
    lines.push(['M', 0, M.NH + 4], ['L', 0, spineEnd]);
    nodes.push({ id: id, x: 0, y: 0 });
    var sh = -minX;
    return {
      w: maxX - minX, h: H, cx: sh,
      nodes: nodes.map(function (n) { return { id: n.id, x: n.x + sh, y: n.y }; }),
      lines: moved(lines, sh, 0)
    };
  }

  // The tree of a view laid out at the sizes M: { W, H, nodes: [{ id, x (middle), y (top) }], lines, levels }.
  function layout(doc, v, M, tidy) {
    var s = lay(v.root, v.K, M, !!tidy), W = s.w;
    var flip = function (list) {
      return list.map(function (c) {
        var o = [c[0]];
        for (var i = 1; i < c.length; i += 2) o.push(W - c[i], c[i + 1]);
        return o;
      });
    };
    var levels = 0, depth = {}, queue = [[v.root, 1]];
    while (queue.length) {
      var q = queue.shift();
      levels = Math.max(levels, q[1]);
      (v.K[q[0]] || []).forEach(function (k) { queue.push([k, q[1] + 1]); });
    }
    return { W: W, H: s.h, nodes: s.nodes.map(function (n) { return { id: n.id, x: W - n.x, y: n.y }; }), lines: flip(s.lines), levels: levels };
  }

  WORK.blank = blank; WORK.clean = clean; WORK.addNext = addNext; WORK.removePerson = removePerson;
  WORK.canRemove = canRemove; WORK.addDept = addDept; WORK.relLabel = relLabel; WORK.addWords = addWords;
  WORK.viewOf = viewOf; WORK.inView = inView; WORK.hasMine = hasMine; WORK.layout = layout; WORK.SCREEN = SCREEN;
  WORK.kidsOf = kidsOf; WORK.topOf = topOf;

  // Department colours: on the navy of the screen and stories, and on the white of a printed page.
  var DEPT_COLORS = {
    sea: ['#2EC4B6', '#FF8A80', '#B9A7F0', '#7FB8F0', '#F4A261', '#9BD48A', '#F28DC0', '#5FD3E8', '#D9C27A', '#C9A0DC', '#88C9A1', '#F7B2A5'],
    paper: ['#1FAFA2', '#F0796D', '#8E78DD', '#4F94DA', '#E07F2E', '#5FAE4E', '#D9629F', '#2BAFC7', '#B8973A', '#A877C4', '#4FA874', '#E58A79']
  };
  var NO_DEPT = { sea: '#9DB2C8', paper: '#A9B7C6' };
  function deptColor(doc, pid, kind) {
    var d = doc.p[pid].d && doc.d[doc.p[pid].d];
    return d ? DEPT_COLORS[kind][d.c] : NO_DEPT[kind];
  }
  WORK.DEPT_COLORS = DEPT_COLORS;

  if (typeof module !== 'undefined' && module.exports) module.exports = WORK;
  root.WORK = WORK;
  if (typeof document === 'undefined') return;

  /* ---------- Pictures (story 1080 x 1920, post 1080 x 1350) and the A4 page ---------- */

  var PIC = { NW: 150, AV: 96, NH: 196, CG: 22, RH: 270, CH: 214, PG: 20, R: 22 };
  var PICFMT = {
    story: { title: 120, titleY: 300, sub: 46, subY: 384, boxY: 470, boxH: 1000, boxW: 960 },
    post: { title: 92, titleY: 168, sub: 38, subY: 232, boxY: 292, boxH: 812, boxW: 960 }
  };
  var HEART = 'M12 21s-7.5-4.6-9.5-9.1C1.1 8.7 3.2 5 6.7 5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.5 0 5.6 3.7 4.2 6.9C19.5 16.4 12 21 12 21z';

  function picTitle(doc) { return doc.co || 'شجرة دوامي'; }
  function people(n) { return n === 1 ? 'شخص واحد' : n === 2 ? 'شخصين' : n <= 10 ? n + ' أشخاص' : n + ' شخص'; }
  function picSub(doc, v) {
    var parts = [];
    if (doc.co) parts.push('شجرة دوامي');
    var md = doc.p[doc.me].d;
    if (v.mine && md && doc.d[md]) parts.push('قسم ' + doc.d[md].n);
    parts.push(people(inView(v).length));
    return parts.join(' · ');
  }

  // The view at the picture's sizes, in whichever shape (as it is, or with «ترتيب») comes out bigger.
  function picLayout(doc, v, boxW, boxH, maxS) {
    var best = null;
    [false, true].forEach(function (tidy) {
      var L = layout(doc, v, PIC, tidy), s = Math.min(boxW / L.W, boxH / L.H, maxS);
      if (!best || s > best.s * 1.02) best = { L: L, s: s };
    });
    return best;
  }

  /* Draws L (at the picture's sizes) with X, Y and scale s. hide: only «ربعي» keep their name; everyone
     else shows what they are to me and their job, with a pearl for a letter. page: the printed page,
     where the job (or what they are to me, when no job is given) goes under the name. */
  var INK = {
    sea: { line: 'rgba(244, 239, 230, 0.4)', me: '#E9C46A', fill: '#12385E', meFill: '#F4EFE6', letter: '#F4EFE6', meLetter: '#0E2A47',
      name: '#F4EFE6', rel: '#E9C46A', meRel: '#F4EFE6', job: 'rgba(244, 239, 230, 0.72)', heart: '#E9C46A', heartInk: '#0E2A47', kind: 'sea', relSize: 25 },
    paper: { line: '#BFCAD6', me: '#D9AE45', fill: '#FFFFFF', meFill: '#0E2A47', letter: '#0E2A47', meLetter: '#FFFFFF',
      name: '#0E2A47', rel: '#A3801F', meRel: '#0E2A47', job: '#4A607A', heart: '#D9AE45', heartInk: '#FFFFFF', kind: 'paper', relSize: 27 }
  };

  function initial(name) {
    var c = Array.from(String(name || '').trim())[0];
    return c ? c.toUpperCase() : '؟';
  }

  // A small pearl, drawn where a hidden name's first letter would be (as in tree.js).
  function pearl(ctx, cx, cy, pr, dark) {
    if (dark) ctx.fillStyle = '#0E2A47';
    else {
      var g = ctx.createRadialGradient(cx - pr * 0.35, cy - pr * 0.4, pr * 0.05, cx, cy, pr);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#F4EFE6'); g.addColorStop(1, '#C9BCA8');
      ctx.fillStyle = g;
    }
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
  }

  function drawWork(ctx, doc, L, X, Y, s, ink, hide, page) {
    var D = KIN.draw, AV = PIC.AV * s, NW = PIC.NW * s, r = AV / 2, ring = Math.max(ink.kind === 'sea' ? 4 : 0, 6 * s);
    ctx.save();
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ink.line; ctx.lineWidth = Math.max(ink.kind === 'sea' ? 2.5 : 0, 3.5 * s);
    ctx.beginPath();
    L.lines.forEach(function (c) {
      if (c[0] === 'M') ctx.moveTo(X(c[1]), Y(c[2]));
      else if (c[0] === 'L') ctx.lineTo(X(c[1]), Y(c[2]));
      else ctx.quadraticCurveTo(X(c[1]), Y(c[2]), X(c[3]), Y(c[4]));
    });
    ctx.stroke();

    L.nodes.forEach(function (n) {
      var p = doc.p[n.id], isMe = n.id === doc.me, cx = X(n.x), cy = Y(n.y) + r;
      var hidden = hide && !p.h;
      ctx.globalAlpha = p.x ? 0.45 : 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isMe ? ink.meFill : ink.fill; ctx.fill();
      ctx.lineWidth = ring; ctx.strokeStyle = isMe ? ink.me : deptColor(doc, n.id, ink.kind); ctx.stroke();
      if (hidden) pearl(ctx, cx, cy, r * 0.3, isMe && ink.meFill === '#F4EFE6');
      else {
        var top = initial(p.n);
        ctx.fillStyle = isMe ? ink.meLetter : ink.letter;
        D.setFont(ctx, '700', Math.round(AV * 0.42));
        var mt = ctx.measureText(top), h2 = (mt.actualBoundingBoxAscent || AV * 0.3) - (mt.actualBoundingBoxDescent || 0);
        ctx.fillText(top, cx, cy + h2 / 2);
      }
      if (p.h) {
        // «ربعي»: a small sand heart on the circle's top corner
        var hr = r * 0.42, hx = cx - r * 0.74, hy = cy - r * 0.74;
        ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fillStyle = ink.heart; ctx.fill();
        ctx.lineWidth = Math.max(1.5, 3 * s); ctx.strokeStyle = ink.kind === 'sea' ? '#0E2A47' : '#FFFFFF'; ctx.stroke();
        if (root.Path2D) {
          ctx.save();
          var k = hr * 1.15 / 24;
          ctx.translate(hx - 12 * k, hy - 12.5 * k); ctx.scale(k, k);
          ctx.fillStyle = ink.heartInk; ctx.fill(new Path2D(HEART));
          ctx.restore();
        }
      }
      var rel = relLabel(doc, n.id), job = p.j || '';
      var first = hidden ? rel : p.n || 'بدون اسم';
      var second = hidden ? job : page ? job || rel : rel;
      var ny = Y(n.y) + AV + 56 * s, gap = 36 * s;
      ctx.fillStyle = ink.name;
      D.fit(ctx, first, '700', Math.round(Math.max(ink.kind === 'sea' ? 22 : 0, 34 * s)), NW + 6, 16 * s);
      ctx.fillText(first, cx, ny);
      if (second) {
        ctx.fillStyle = isMe && !(page && job) ? ink.meRel : (page && job) || (hidden && job) ? ink.job : ink.rel;
        D.fit(ctx, second, '500', Math.round(Math.max(ink.kind === 'sea' ? 18 : 0, ink.relSize * s)), NW + 6, ink.relSize * s * 0.55);
        ctx.fillText(second, cx, ny + gap);
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function fontSample(doc, more) {
    return picTitle(doc) + ' شجرة دوامي قسم شخص أشخاص شخصين واحد +0123456789 · ' + (more || '') + ' ' +
      Object.keys(doc.p).map(function (id) { return doc.p[id].n + ' ' + (doc.p[id].j || '') + ' ' + relLabel(doc, id); }).join(' ') + ' ' +
      Object.keys(doc.d).map(function (id) { return doc.d[id].n; }).join(' ');
  }

  // The departments in a view, for the key under the title: [{ n, color }].
  function legend(doc, v, kind) {
    var seen = {}, out = [];
    inView(v).forEach(function (id) {
      var d = doc.p[id].d;
      if (d && doc.d[d] && !seen[d]) { seen[d] = 1; out.push({ n: doc.d[d].n, color: DEPT_COLORS[kind][doc.d[d].c] }); }
    });
    return out.length > 1 ? out : [];
  }

  // The key: a dot and a name for each department, centred on cx at y.
  function drawLegend(ctx, items, cx, y, size, color, maxW) {
    if (!items.length) return;
    var D = KIN.draw, dot = size * 0.62, gap = size * 0.45, sep = size * 1.2;
    D.setFont(ctx, '500', size);
    var ws = items.map(function (it) { return ctx.measureText(it.n).width + dot + gap; });
    var total = ws.reduce(function (a, b) { return a + b; }, 0) + sep * (items.length - 1);
    var k = total > maxW ? maxW / total : 1;
    if (k < 1) { size *= k; dot *= k; gap *= k; sep *= k; D.setFont(ctx, '500', size); ws = ws.map(function (x) { return x * k; }); total = maxW; }
    var x = cx + total / 2;  // right to left
    ctx.save();
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    items.forEach(function (it, i) {
      ctx.beginPath(); ctx.arc(x - dot / 2, y, dot / 2, 0, Math.PI * 2); ctx.fillStyle = it.color; ctx.fill();
      ctx.fillStyle = color; ctx.fillText(it.n, x - dot - gap, y);
      x -= ws[i] + sep;
    });
    ctx.restore();
  }

  // opts.hide: as in drawWork. opts.mine: my department only.
  function makePicture(doc, format, opts) {
    var hide = !!(opts && opts.hide), v = viewOf(doc, !!(opts && opts.mine));
    var D = KIN.draw, F = PICFMT[format] || PICFMT.story, H = KIN.FORMATS[format === 'post' ? 'post' : 'story'].H;
    var keys = legend(doc, v, 'sea');
    return D.loadFonts(fontSample(doc)).then(function () {
      var boxY = F.boxY + (keys.length ? F.sub * 1.4 : 0), boxH = F.boxH - (keys.length ? F.sub * 1.4 : 0);
      var pl = picLayout(doc, v, F.boxW, boxH, 1.25), L = pl.L, s = pl.s;
      var c = document.createElement('canvas');
      c.width = 1080; c.height = H;
      var ctx = c.getContext('2d');
      D.background(ctx, 1080, H);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#F4EFE6';
      D.fit(ctx, picTitle(doc), '700', F.title, 960, 60);
      ctx.fillText(picTitle(doc), 540, F.titleY);
      ctx.fillStyle = '#E9C46A';
      D.setFont(ctx, '500', F.sub);
      ctx.fillText(picSub(doc, v), 540, F.subY);
      drawLegend(ctx, keys, 540, F.subY + F.sub * 1.5, F.sub * 0.72, 'rgba(244, 239, 230, 0.8)', 940);
      var ox = 540 - L.W * s / 2, oy = boxY + Math.max(0, (boxH - L.H * s) / 2);
      drawWork(ctx, doc, L, function (x) { return ox + x * s; }, function (y) { return oy + y * s; }, s, INK.sea, hide, false);
      D.drawSticker(ctx, KIN.FORMATS[format === 'post' ? 'post' : 'story'].sticker);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }

  /* ---------- The tree on an A4 page, as a PDF to print ---------- */

  var PAGE = { land: { w: 842, h: 595 }, port: { w: 595, h: 842 } }, PK = 4;
  var PDF_LINK = 'https://shorbaka.com/#work';

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
    var paint = 'q ' + page.w + ' 0 0 ' + page.h + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + paint.length + ' >>\nstream\n' + paint + '\nendstream');
    links.forEach(function (l, i) {
      obj(6 + i, '<< /Type /Annot /Subtype /Link /Rect [' + l.rect.map(n2).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI (' + l.uri + ') >> >>');
    });
    obj(info, '<< /Title ' + text(title) + ' /Creator (shorbaka.com) /Producer (shorbaka.com) >>');
    var xref = at;
    put('xref\n0 ' + (info + 1) + '\n0000000000 65535 f \n' + offs.slice(1, info + 1).map(function (o) { return ('000000000' + o).slice(-10) + ' 00000 n \n'; }).join(''));
    put('trailer\n<< /Size ' + (info + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  // Resolves { file: the PDF, name, type, preview: a PNG of the page, w, h }.
  function makePdf(doc, orient, opts) {
    var hide = !!(opts && opts.hide), v = viewOf(doc, !!(opts && opts.mine)), D = KIN.draw, P = PAGE[orient] || PAGE.land, k = PK;
    var title = picTitle(doc), foot = 'سوّ شجرة دوامك على shorbaka.com', keys = legend(doc, v, 'paper');
    return D.loadFonts(fontSample(doc, foot)).then(function () {
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
      ctx.fillText(picSub(doc, v), W / 2, titleY + 22 * k);
      drawLegend(ctx, keys, W / 2, titleY + 42 * k, 9 * k, '#4A607A', W - 160 * k);
      var boxW = W - 88 * k, boxY = titleY + (keys.length ? 62 : 48) * k, boxH = H - boxY - 74 * k;
      var pl = picLayout(doc, v, boxW, boxH, 1.7), L = pl.L, s = pl.s;
      var ox = W / 2 - L.W * s / 2, oy = boxY + Math.max(0, (boxH - L.H * s) / 2);
      drawWork(ctx, doc, L, function (x) { return ox + x * s; }, function (y) { return oy + y * s; }, s, INK.paper, hide, true);
      var fy = H - 44 * k, markH = 15 * k, markW = markH * 102 / 72, gap = 7 * k;
      D.setFont(ctx, '500', 10 * k);
      var tw = ctx.measureText(foot).width, total = markW + gap + tw, right = W / 2 + total / 2, left = W / 2 - total / 2;
      ctx.fillStyle = '#4A607A';
      ctx.fillText(foot, right - tw / 2, fy + 3.5 * k);
      D.drawMark(ctx, left + markW / 2, fy, markH, true);
      var preview = document.createElement('canvas'), pw = 1100, ph = Math.round(1100 * H / W);
      preview.width = pw; preview.height = ph;
      preview.getContext('2d').drawImage(c, 0, 0, pw, ph);
      var blob = function (cv, type, q) { return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('no picture')); }, type, q); }); };
      return Promise.all([blob(c, 'image/jpeg', 0.92).then(bytesOf), blob(preview, 'image/png')]).then(function (r) {
        var links = [{ rect: [left / k - 4, (H - fy) / k - 10, right / k + 4, (H - fy) / k + 12], uri: PDF_LINK }];
        var pdf = pdfOf(r[0], { w: W, h: H }, P, title, links);
        c.width = c.height = 0;
        return { file: pdf, name: 'shorbaka-work-tree.pdf', type: 'application/pdf', preview: r[1], w: pw, h: ph };
      });
    });
  }

  WORK.makePicture = makePicture;
  WORK.makePdf = makePdf;

  /* ---------- Page ---------- */

  var LOCAL = 'shorbaka.work.v1', UNSAVED = 'shorbaka.work.unsaved', NS = 'http://www.w3.org/2000/svg';
  var HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + HEART + '"/></svg>';
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
  // A table that isn't there yet (the database change not made): the tree stays on this device.
  function noTable(e) { return !!e && (e.code === 'PGRST205' || e.code === '42P01' || /work_trees/.test(String(e.message || ''))); }

  function start() {
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      sec: $('work'), count: $('wk-count'), msg: $('wk-msg'), retry: $('wk-retry'),
      start: $('wk-start'), meName: $('wk-me'), meJob: $('wk-job'), coStart: $('wk-co-start'), gSeg: $('wk-g'), startErr: $('wk-start-err'),
      wrap: $('wk-wrap'), coBtn: $('wk-co-btn'), coText: $('wk-co-text'), coForm: $('wk-co-form'), coName: $('wk-co-name'),
      bar: $('wk-bar'), side: $('wk-side'), tidy: $('wk-tidy'), zoom: $('wk-zoom'), keys: $('wk-keys'),
      scroll: $('wk-scroll'), stage: $('wk-stage'), canvas: $('wk-canvas'),
      share: $('wk-share'), pdf: $('wk-pdf'), note: $('wk-note'), saveRetry: $('wk-save-retry'), signIn: $('wk-in'),
      sheet: $('wk-sheet'), pWho: $('wk-p-who'), pAv: $('wk-p-av'), pTitle: $('wk-p-title'), pRel: $('wk-p-rel'), pClose: $('wk-p-close'),
      pEdit: $('wk-p-edit'), pName: $('wk-p-name'), pJob: $('wk-p-job'), pG: $('wk-p-g'), pSave: $('wk-p-save'),
      pDepts: $('wk-p-depts'), pDeptForm: $('wk-p-dept-form'), pDeptName: $('wk-p-dept-name'),
      pAdds: $('wk-p-adds'), pForm: $('wk-p-form'), pFormLabel: $('wk-p-form-label'), pNew: $('wk-p-new'), pNewJob: $('wk-p-new-job'),
      pNewG: $('wk-p-new-g'), pAdd: $('wk-p-add'), pErr: $('wk-p-err'), pDone: $('wk-p-done'),
      pMarks: $('wk-p-marks'), pFriend: $('wk-p-friend'), pLeft: $('wk-p-left'),
      pDel: $('wk-p-del'), pConfirm: $('wk-p-confirm'), pWarn: $('wk-p-warn'), pYes: $('wk-p-yes'), pNo: $('wk-p-no')
    };
    if (!ui.sec || !ui.sheet) return;

    var st = { doc: null, where: 'local', loaded: false, failed: false, seq: 0, saving: null, again: false, pending: false, saveErr: false,
      person: null, adding: null, from: null, lastAdded: null, center: true, zl: 0, z: 1, L: null, g: null, newG: null, noTable: false };
    var acctReady = !root.ACCOUNT, timer = null;
    var gBtns = Array.prototype.slice.call(ui.gSeg.querySelectorAll('button'));
    var sideBtns = Array.prototype.slice.call(ui.side.querySelectorAll('button'));
    var newGBtns = Array.prototype.slice.call(ui.pNewG.querySelectorAll('button'));
    var editGBtns = Array.prototype.slice.call(ui.pG.querySelectorAll('button'));

    function accounts() { return root.ACCOUNT && root.ACCOUNT.on() ? root.ACCOUNT : null; }
    function signedIn() { var a = accounts(); return a && a.user() ? a : null; }
    function shown() { return !!ui.sec.offsetParent; }
    function canAccount(a) { return a && a.loadWorkTree && !st.noTable; }

    /* --- where the tree lives: the account when signed in, this device otherwise --- */

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
      var seq = ++st.seq;
      st.failed = false;
      if (!canAccount(a)) {
        st.where = 'local'; st.doc = loadLocal(); st.loaded = true; st.center = true;
        render();
        return;
      }
      st.where = 'account'; st.loaded = false; st.doc = null;
      render();
      a.loadWorkTree().then(function (data) {
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
        if (noTable(e)) { st.noTable = true; sync(true); return; }
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
      var req = (now && a.saveWorkTreeNow && a.saveWorkTreeNow(st.doc)) || a.saveWorkTree(st.doc);
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
        ? (state === 'saving' || st.saving || st.pending ? 'لحظة، تنحفظ…' : st.saveErr ? 'ما قدرنا نحفظ آخر تعديل. تأكد من النت.' : 'محفوظة بحسابك، وتلقاها من أي جهاز تدخل منه.')
        : st.saveErr ? 'ما قدرنا نحفظها بهالجهاز.' : 'محفوظة في جهازك بس.';
      ui.saveRetry.hidden = !(inAcct && st.saveErr && !st.saving);
      ui.signIn.hidden = inAcct || !a || !acctReady || st.noTable;
    }

    function counts() {
      var n = st.doc ? count(st.doc) : 0;
      ui.count.textContent = '';
      if (n > 1) ui.count.appendChild(el('b', null, people(n)));
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
        ui.msg.textContent = 'ما قدرنا نجيب شجرتك الحين. تأكد من النت وجرّب مرة ثانية.';
        ui.msg.hidden = false; ui.retry.hidden = false;
        return;
      }
      if (!st.doc) {
        ui.wrap.hidden = true;
        if (ui.start.hidden) {
          ui.start.hidden = false;
          var u = signedIn() && accounts().user(), treeMe = root.TREE && root.TREE.current && root.TREE.current();
          if (!ui.meName.value) ui.meName.value = (treeMe && treeMe.p[treeMe.me] && treeMe.p[treeMe.me].n) || (u && u.first) || '';
        }
        return;
      }
      ui.start.hidden = true; ui.wrap.hidden = false;
      showCo();
      draw();
      note();
      if (!ui.sheet.hidden) fillSheet();
    }

    function showCo() {
      if (!ui.coForm.hidden) return;
      var co = st.doc.co;
      ui.coText.textContent = co || 'اسم الشركة';
      ui.coBtn.classList.toggle('is-empty', !co);
      ui.coBtn.setAttribute('aria-label', co ? 'غيّر اسم الشركة: ' + co : 'ضيف اسم الشركة');
    }

    function view() { return viewOf(st.doc, opt('mine') && hasMine(st.doc)); }

    function draw() {
      var doc = st.doc, mineOk = hasMine(doc), v = view();
      ui.side.hidden = !mineOk;
      sideBtns.forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.v === 'mine') === v.mine)); });
      var L = layout(doc, v, SCREEN, false), box = Math.max(240, ui.scroll.clientWidth - 36), canTidy = L.W > box + 1;
      if (canTidy && opt('tidy')) {
        var T = layout(doc, v, SCREEN, true);
        if (T.W < L.W) L = T;
      }
      var tidyDiffers = canTidy && layout(doc, v, SCREEN, true).W < layout(doc, v, SCREEN, false).W;
      ui.tidy.hidden = !tidyDiffers;
      ui.tidy.setAttribute('aria-pressed', String(tidyDiffers && opt('tidy')));
      st.L = L;
      paint(L, doc);
      keys(doc, v);
      sizeStage();
      if (st.center && shown()) {
        st.center = false;
        centerOn([st.lastAdded, doc.me].filter(function (x) { return x && doc.p[x]; })[0]);
      }
    }

    function keys(doc, v) {
      ui.keys.textContent = '';
      var items = legend(doc, v, 'sea');
      ui.keys.hidden = !items.length;
      items.forEach(function (it) {
        var s = el('span', 'wk-key');
        var dot = el('i'); dot.style.background = it.color;
        s.appendChild(dot); s.appendChild(document.createTextNode(it.n));
        ui.keys.appendChild(s);
      });
    }

    function paint(L, doc) {
      ui.canvas.textContent = '';
      ui.canvas.style.width = L.W + 'px';
      ui.canvas.style.height = L.H + 'px';
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'tr-lines');
      svg.setAttribute('width', L.W); svg.setAttribute('height', L.H);
      svg.setAttribute('viewBox', '0 0 ' + L.W + ' ' + L.H);
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', L.lines.map(function (c) { return c[0] + c.slice(1).map(function (v) { return Math.round(v * 10) / 10; }).join(' '); }).join(''));
      svg.appendChild(path);
      ui.canvas.appendChild(svg);
      L.nodes.forEach(function (n) { ui.canvas.appendChild(nodeBox(n, doc)); });
    }

    function nodeBox(n, doc) {
      var p = doc.p[n.id], isMe = n.id === doc.me, b = el('button', 'tr-node wk-node');
      b.type = 'button';
      b.style.left = (n.x - SCREEN.NW / 2) + 'px';
      b.style.top = n.y + 'px';
      if (isMe) b.classList.add('is-me');
      else b.style.setProperty('--ring', deptColor(doc, n.id, 'sea'));
      if (p.x) b.classList.add('is-left');
      if (st.lastAdded === n.id) b.classList.add('is-new');
      b.dataset.pid = n.id;
      var av = el('span', 'tr-av', initial(p.n));
      if (p.h) { var h = el('span', 'wk-heart'); h.innerHTML = HEART_SVG; av.appendChild(h); }
      b.appendChild(av);
      b.appendChild(el('span', 'tr-name' + (p.n ? '' : ' is-noname'), p.n || 'بدون اسم'));
      var rel = relLabel(doc, n.id);
      b.appendChild(el('span', 'tr-rel', rel));
      b.setAttribute('aria-label', (p.n || 'بدون اسم') + '، ' + rel + (p.j ? '، ' + p.j : '') + (p.h ? '، ربعي' : '') + (p.x ? '، طلع من الدوام' : ''));
      b.addEventListener('click', function () { openPerson(n.id, b); });
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
      ui.zoom.setAttribute('aria-label', last ? 'رجّع الشجرة لحجمها' : st.zl ? 'صغّرها أكثر' : 'صغّر الشجرة');
      ui.zoom.setAttribute('aria-pressed', String(st.zl > 0));
      ui.zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (last ? ZOOM.in : ZOOM.out) + '</svg>';
    }
    function centerOn(pid) {
      var n = st.L && st.L.nodes.filter(function (x) { return x.id === pid; })[0];
      if (!n) return;
      ui.scroll.scrollLeft = Math.max(0, 18 + n.x * st.z - ui.scroll.clientWidth / 2);
    }

    /* --- one person's sheet --- */

    function pressed(btns, attr, val) { btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset[attr] === val)); }); }

    function openPerson(pid, from) {
      st.person = pid; st.from = from || null; st.adding = null; st.newG = null;
      ui.pDone.textContent = '';
      ui.pName.value = st.doc.p[pid].n;
      ui.pJob.value = st.doc.p[pid].j || '';
      st.g = st.doc.p[pid].g;
      ui.pConfirm.hidden = true;
      ui.pDeptForm.hidden = true;
      fillSheet();
      ui.sheet.hidden = false;
      document.documentElement.classList.add('kin-lock');
      ui.pClose.focus();
    }
    function closePerson() {
      if (ui.sheet.hidden) return;
      var pid = st.person;
      ui.sheet.hidden = true;
      document.documentElement.classList.remove('kin-lock');
      st.person = null; st.adding = null;
      var back = st.from && document.body.contains(st.from) ? st.from : ui.canvas.querySelector('[data-pid="' + pid + '"]');
      if (back) back.focus({ preventScroll: true });
    }

    function fillSheet() {
      var doc = st.doc, pid = st.person, p = doc && doc.p[pid];
      if (!p) { closePerson(); return; }
      var isMe = pid === doc.me;
      ui.pAv.textContent = initial(p.n);
      ui.pWho.className = 'tr-p-who' + (isMe ? ' is-me' : '');
      ui.pAv.style.setProperty('--ring', isMe ? '' : deptColor(doc, pid, 'sea'));
      ui.pTitle.textContent = p.n || 'بدون اسم';
      ui.pRel.textContent = relLabel(doc, pid) + (p.j ? ' · ' + p.j : '');
      editState();
      pressed(editGBtns, 'g', st.g);

      // departments: a chip each (tap the one picked again to take it off) and «+ قسم جديد»
      ui.pDepts.textContent = '';
      Object.keys(doc.d).sort(byNum).forEach(function (id) {
        var c = el('button', 'tr-chip tr-chip-sm wk-dept');
        c.type = 'button';
        c.setAttribute('aria-pressed', String(p.d === id));
        var dot = el('i'); dot.style.background = DEPT_COLORS.sea[doc.d[id].c];
        c.appendChild(dot); c.appendChild(document.createTextNode(doc.d[id].n));
        c.addEventListener('click', function () { setDept(p.d === id ? null : id); });
        ui.pDepts.appendChild(c);
      });
      var plus = el('button', 'tr-chip tr-chip-sm wk-dept-new', 'قسم جديد');
      plus.type = 'button';
      plus.setAttribute('aria-expanded', String(!ui.pDeptForm.hidden));
      plus.addEventListener('click', function () {
        ui.pDeptForm.hidden = !ui.pDeptForm.hidden;
        plus.setAttribute('aria-expanded', String(!ui.pDeptForm.hidden));
        if (!ui.pDeptForm.hidden) { ui.pDeptName.value = ''; ui.pDeptName.focus(); }
      });
      ui.pDepts.appendChild(plus);

      // «ضيف»: their manager (when they have none), a colleague (when they have a manager), someone under them
      var words = addWords(doc, pid);
      ui.pAdds.textContent = '';
      [['B', !p.b], ['C', !!p.b], ['R', true]].forEach(function (x) {
        if (!x[1]) return;
        var c = el('button', 'tr-chip', words[x[0]]);
        c.type = 'button';
        c.dataset.t = x[0];
        c.setAttribute('aria-pressed', String(st.adding === x[0]));
        c.addEventListener('click', function () { startAdd(x[0]); });
        ui.pAdds.appendChild(c);
      });
      if (st.adding && !ui.pAdds.querySelector('[data-t="' + st.adding + '"]')) st.adding = null;
      ui.pForm.hidden = !st.adding;
      if (st.adding) ui.pFormLabel.textContent = 'اسم ' + words[st.adding].replace(/ (له|لها)$/, '');
      pressed(newGBtns, 'g', st.newG);

      ui.pMarks.hidden = isMe;
      ui.pFriend.checked = !!p.h;
      ui.pLeft.checked = !!p.x;

      ui.pDel.hidden = isMe;
      ui.pDel.querySelector('span').textContent = 'امسح ' + (p.n || 'هالشخص');
    }

    function editState() {
      var p = st.doc.p[st.person];
      var dirty = ui.pName.value.trim() !== (p.n || '') || ui.pJob.value.trim() !== (p.j || '') || st.g !== p.g;
      ui.pSave.disabled = !dirty || !ui.pName.value.trim();
    }

    function startAdd(t) {
      st.adding = st.adding === t ? null : t;
      st.newG = null;
      ui.pNew.value = ''; ui.pNewJob.value = '';
      ui.pErr.hidden = true;
      ui.pDone.textContent = '';
      fillSheet();
      if (st.adding) ui.pNew.focus();
    }

    function setDept(id) {
      var p = st.doc.p[st.person];
      if (id) p.d = id; else delete p.d;
      dropUnused(st.doc);
      changed();
    }

    ui.pName.addEventListener('input', editState);
    ui.pJob.addEventListener('input', editState);
    editGBtns.forEach(function (b) { b.addEventListener('click', function () { st.g = b.dataset.g; pressed(editGBtns, 'g', st.g); editState(); }); });
    ui.pEdit.addEventListener('submit', function (e) {
      e.preventDefault();
      var p = st.doc.p[st.person], name = clip(ui.pName.value, NAME);
      if (!name) return;
      p.n = name;
      var job = clip(ui.pJob.value, JOB);
      if (job) p.j = job; else delete p.j;
      p.g = st.g === 'f' ? 'f' : 'm';
      ui.pDone.textContent = 'انحفظ ✓';
      changed();
    });
    ui.pDeptForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = addDept(st.doc, ui.pDeptName.value);
      if (!id) { ui.pDeptName.focus(); return; }
      ui.pDeptForm.hidden = true;
      setDept(id);
    });
    newGBtns.forEach(function (b) { b.addEventListener('click', function () { st.newG = b.dataset.g; pressed(newGBtns, 'g', st.newG); ui.pErr.hidden = true; }); });
    ui.pForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = clip(ui.pNew.value, NAME);
      if (!name) { ui.pErr.textContent = 'اكتب الاسم'; ui.pErr.hidden = false; ui.pNew.focus(); return; }
      if (!st.newG) { ui.pErr.textContent = 'اختار ولد ولا بنت'; ui.pErr.hidden = false; return; }
      var id = addNext(st.doc, st.person, st.adding, name, st.newG, ui.pNewJob.value);
      if (!id) { ui.pErr.textContent = 'ما زبطت، جرّب مرة ثانية'; ui.pErr.hidden = false; return; }
      st.lastAdded = id; st.center = true;
      st.adding = null;
      ui.pDone.textContent = 'انضاف ' + name + '، ' + relLabel(st.doc, id) + ' ✓';
      changed();
    });
    ui.pFriend.addEventListener('change', function () {
      var p = st.doc.p[st.person];
      if (ui.pFriend.checked) p.h = 1; else delete p.h;
      changed();
    });
    ui.pLeft.addEventListener('change', function () {
      var p = st.doc.p[st.person];
      if (ui.pLeft.checked) p.x = 1; else delete p.x;
      changed();
    });
    ui.pDel.addEventListener('click', function () {
      var pid = st.person, p = st.doc.p[pid];
      if (!canRemove(st.doc, pid)) {
        ui.pWarn.textContent = 'ما نقدر نمسحه وهو فوق أكثر من شخص. امسح اللي تحته أول، أو ضيف له مدير.';
        ui.pYes.hidden = true;
      } else {
        var under = Object.keys(st.doc.p).filter(function (id) { return st.doc.p[id].b === pid; }).length;
        ui.pWarn.textContent = under ? 'اللي تحته يصيرون تحت ' + (p.b ? (st.doc.p[p.b].n || 'مديره') : 'بعض') + '.' : 'متأكد؟';
        if (under && !p.b) ui.pWarn.textContent = 'اللي تحته يصير هو فوق الشجرة.';
        ui.pYes.hidden = false;
      }
      ui.pConfirm.hidden = false;
      (ui.pYes.hidden ? ui.pNo : ui.pYes).focus();
    });
    ui.pNo.addEventListener('click', function () { ui.pConfirm.hidden = true; ui.pDel.focus(); });
    ui.pYes.addEventListener('click', function () {
      var pid = st.person;
      if (!removePerson(st.doc, pid)) return;
      ui.pConfirm.hidden = true;
      ui.sheet.hidden = true;
      document.documentElement.classList.remove('kin-lock');
      st.person = null;
      changed();
    });
    ui.pClose.addEventListener('click', closePerson);
    ui.sheet.addEventListener('click', function (e) { if (e.target === ui.sheet) closePerson(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !ui.sheet.hidden) closePerson(); });

    /* --- the start: my name, my job, the company, boy or girl --- */

    gBtns.forEach(function (b) { b.addEventListener('click', function () { st.g = b.dataset.g; pressed(gBtns, 'g', st.g); ui.startErr.hidden = true; }); });
    ui.start.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = clip(ui.meName.value, NAME);
      if (!name) { ui.startErr.textContent = 'اكتب اسمك'; ui.startErr.hidden = false; ui.meName.focus(); return; }
      if (!st.g) { ui.startErr.textContent = 'اختار ولد ولا بنت'; ui.startErr.hidden = false; return; }
      st.doc = blank(name, st.g, ui.meJob.value, ui.coStart.value);
      st.center = true;
      changed();
      // straight to my sheet, to add my manager and my team
      setTimeout(function () {
        var b = ui.canvas.querySelector('[data-pid="' + st.doc.me + '"]');
        openPerson(st.doc.me, b);
      }, 0);
    });

    /* --- the company name --- */

    ui.coBtn.addEventListener('click', function () {
      ui.coBtn.hidden = true; ui.coForm.hidden = false;
      ui.coName.value = st.doc.co || '';
      ui.coName.focus();
    });
    ui.coForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var co = clip(ui.coName.value, CO);
      if (co) st.doc.co = co; else delete st.doc.co;
      ui.coForm.hidden = true; ui.coBtn.hidden = false;
      changed();
      ui.coBtn.focus();
    });

    /* --- the bar: «كل الدوام» / «قسمي», «ترتيب», zoom --- */

    sideBtns.forEach(function (b) {
      b.addEventListener('click', function () { setOpt('mine', b.dataset.v === 'mine'); st.center = true; st.zl = 0; changed(); });
    });
    ui.tidy.addEventListener('click', function () { setOpt('tidy', !opt('tidy')); st.zl = 0; changed(); });
    ui.zoom.addEventListener('click', function () {
      var zs = zooms(), mid = (ui.scroll.scrollLeft + ui.scroll.clientWidth / 2 - 18) / st.z;
      st.zl = st.zl >= zs.length - 1 ? 0 : st.zl + 1;
      sizeStage();
      ui.scroll.scrollLeft = Math.max(0, 18 + mid * st.z - ui.scroll.clientWidth / 2);
    });
    ui.retry.addEventListener('click', function () { sync(true); });
    ui.saveRetry.addEventListener('click', function () { save(); });
    ui.signIn.addEventListener('click', function () {
      if (KIN.openAuth) KIN.openAuth({ title: 'احفظ شجرتك بحسابك', text: 'سجّل دخولك عشان تنحفظ شجرة دوامك بحسابك، وتلقاها من أي جهاز.' }, ui.signIn);
    });

    /* --- share: a story or post, and the PDF --- */

    function hideOption(opts) {
      return count(st.doc) < 2 ? null : {
        label: 'أخفي الأسامي', hint: 'تطلع بس أسامي ربعك اللي عليهم قلب', on: opts.hide,
        set: function (on) { opts.hide = on; if (st.doc) { setOpt('hide', on); changed(); } }
      };
    }
    ui.share.addEventListener('click', function () {
      if (!st.doc || !KIN.openShare) return;
      var doc = copy(st.doc), opts = { hide: opt('hide'), mine: opt('mine') && hasMine(st.doc) };
      KIN.openShare({
        file: 'shorbaka-work',
        make: function (format) { return makePicture(doc, format, opts); },
        alt: doc.co ? 'شجرة دوامي في ' + doc.co : 'شجرة دوامي',
        mention: 'تمنشن ربعك بالدوام',
        tips: { story: 'حطها ستوري ومنشن ربعك بالدوام', post: 'انشرها بقروب الدوام، أو نزّلها بوست ومنشن ربعك' },
        text: 'سويت شجرة دوامي على شرباكة 🌳 سوّ شجرة دوامك: https://shorbaka.com/#work',
        option: hideOption(opts)
      }, ui.share);
    });
    ui.pdf.addEventListener('click', function () {
      if (!st.doc || !KIN.openShare) return;
      var doc = copy(st.doc), opts = { hide: opt('hide'), mine: opt('mine') && hasMine(st.doc) };
      var size = function (label, alt) { return { label: label, title: 'جاهزة للطباعة', alt: alt, dl: 'حمّل ملف PDF', tip: '' }; };
      KIN.openShare({
        file: 'shorbaka-work-tree',
        sizes: { land: size('بالعرض', 'صفحة A4 بالعرض'), port: size('بالطول', 'صفحة A4 بالطول') },
        sizesLabel: 'اتجاه الصفحة',
        make: function (orient) { return makePdf(doc, orient, opts); },
        alt: doc.co ? 'شجرة دوامي في ' + doc.co : 'شجرة دوامي',
        tips: { land: 'اطبعها على ورقة A4، أو أرسلها بقروب الدوام', port: 'اطبعها على ورقة A4، أو أرسلها بقروب الدوام' },
        text: 'شجرة دوامي من شرباكة 🌳 سوّ شجرة دوامك: https://shorbaka.com/#work',
        option: hideOption(opts)
      }, ui.pdf);
    });

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

    WORK.shown = function (on) { if (on && st.doc) { st.center = true; draw(); } };
    WORK.current = function () { return st.doc; };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
