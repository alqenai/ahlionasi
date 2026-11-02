/* شرباكة: «شجرة عائلتي».
   Start from yourself and add your family one person at a time. Under every name the tree writes what
   that person is to you («عمي»، «بنت خالي»), with the same engine as «شنو يصير لك؟». The tree is drawn
   from your father's side or your mother's side, kept in your account (or on this device), and shared
   as a picture.

   The whole tree is one small document:
     { v: 1, me: 'p1', n: 7,
       p: { p1: { n: 'علي', g: 'm' }, ... },                  people: name, m or f
       f: { f2: { a: 'p3', b: 'p4', k: ['p1', 'p5'] }, ... },   families: husband, wife, children eldest first
       fn: 'القناعي',                                          the family name (left out when not given)
       o: { hideF: true } }                                    settings (left out when none is on)
   A family can be missing its husband or wife (not added yet). Brothers and sisters whose parents
   aren't added yet share a family with neither. */
(function (root) {
  'use strict';

  var KIN = root.KIN || (typeof require === 'function' ? require('./kin.js') : null);
  var MAXP = 400, NAME = 40, FAM = 30;

  /* ---------- The document ---------- */

  function num(id) { return +String(id).slice(1) || 0; }
  function byNum(a, b) { return num(a) - num(b); }
  function count(doc) { return Object.keys(doc.p).length; }

  function blank(name, g) {
    return { v: 1, me: 'p1', n: 1, p: { p1: { n: cleanName(name), g: g === 'f' ? 'f' : 'm' } }, f: {} };
  }

  function cleanName(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, NAME); }

  // «عائلة القناعي» is kept as «القناعي»: the page and the picture add «عائلة» themselves.
  function cleanFam(s) {
    var x = cleanName(s).replace(/^(ال)?(عائلة|عايلة)\s+/, '').slice(0, FAM).trim();
    return /^(ال)?(عائلة|عايلة)$/.test(x) ? '' : x;
  }

  function famTitle(doc) { return doc && doc.fn ? 'شجرة عائلة ' + doc.fn : 'شجرة عائلتي'; }

  // Who is whose child, and who is married in which families, in the order they were added.
  function index(doc) {
    var parent = {}, unions = {};
    Object.keys(doc.f).sort(byNum).forEach(function (fid) {
      var x = doc.f[fid];
      x.k.forEach(function (c) { parent[c] = fid; });
      if (x.a) (unions[x.a] = unions[x.a] || []).push(fid);
      if (x.b) (unions[x.b] = unions[x.b] || []).push(fid);
    });
    return { parent: parent, unions: unions };
  }

  // Families that join nothing go, then anyone who no longer connects to me. Returns who went.
  function prune(doc) {
    var gone = [];
    for (var round = 0; round < 50; round++) {
      var dropped = false;
      Object.keys(doc.f).forEach(function (fid) {
        var x = doc.f[fid];
        if ((!x.a && !x.b && x.k.length < 2) || (!x.k.length && !(x.a && x.b))) { delete doc.f[fid]; dropped = true; }
      });
      var idx = index(doc), seen = {}, queue = [doc.me];
      seen[doc.me] = 1;
      while (queue.length) {
        var pid = queue.shift(), near = [], fams = (idx.unions[pid] || []).slice();
        if (idx.parent[pid]) fams.push(idx.parent[pid]);
        fams.forEach(function (fid) { var x = doc.f[fid]; near.push(x.a, x.b); near = near.concat(x.k); });
        near.forEach(function (q) { if (q && !seen[q]) { seen[q] = 1; queue.push(q); } });
      }
      Object.keys(doc.p).forEach(function (pid) {
        if (!seen[pid]) { delete doc.p[pid]; gone.push(pid); dropped = true; }
      });
      Object.keys(doc.f).forEach(function (fid) {
        var x = doc.f[fid];
        if (x.a && !doc.p[x.a]) x.a = null;
        if (x.b && !doc.p[x.b]) x.b = null;
        x.k = x.k.filter(function (c) { return !!doc.p[c]; });
      });
      if (!dropped) break;
    }
    return gone;
  }

  // Anything read back from storage goes through here; null when it isn't a tree we can use.
  function clean(raw) {
    if (!raw || typeof raw !== 'object' || raw.v !== 1 || !raw.p || typeof raw.p !== 'object') return null;
    var p = {}, f = {}, n = 0, kidOf = {};
    Object.keys(raw.p).forEach(function (id) {
      var x = raw.p[id];
      if (!/^p\d{1,6}$/.test(id) || !x || typeof x !== 'object' || Object.keys(p).length >= MAXP) return;
      p[id] = { n: cleanName(x.n), g: x.g === 'f' ? 'f' : 'm' };
      n = Math.max(n, num(id));
    });
    if (!p[raw.me]) return null;
    var fams = raw.f && typeof raw.f === 'object' ? raw.f : {};
    Object.keys(fams).sort(byNum).forEach(function (id) {
      var x = fams[id];
      if (!/^f\d{1,6}$/.test(id) || !x || typeof x !== 'object') return;
      var a = p[x.a] ? x.a : null, b = p[x.b] ? x.b : null;
      if (a && a === b) b = null;
      var k = (Array.isArray(x.k) ? x.k : []).filter(function (c) {
        if (!p[c] || kidOf[c] || c === a || c === b) return false;
        kidOf[c] = id;
        return true;
      });
      f[id] = { a: a, b: b, k: k };
      n = Math.max(n, num(id));
    });
    var doc = { v: 1, me: raw.me, n: Math.max(n, Math.floor(+raw.n) || 0), p: p, f: f };
    var fn = typeof raw.fn === 'string' ? cleanFam(raw.fn) : '';
    if (fn) doc.fn = fn;
    // settings: o.hideF hides girls' and women's names in the shared picture
    if (raw.o && typeof raw.o === 'object' && raw.o.hideF === true) doc.o = { hideF: true };
    prune(doc);
    return doc;
  }

  function copy(doc) { return JSON.parse(JSON.stringify(doc)); }

  /* ---------- Changes ---------- */

  function addPerson(doc, name, g) {
    var id = 'p' + (++doc.n);
    doc.p[id] = { n: cleanName(name), g: g };
    return id;
  }

  function addFam(doc) {
    var id = 'f' + (++doc.n);
    doc.f[id] = { a: null, b: null, k: [] };
    return id;
  }

  /* Adds a relative of pid. t is the step from pid, as in the finder: F M B Z S D H W.
     fid picks the marriage a child belongs to when pid has more than one. Returns the new id or null. */
  function addRelative(doc, pid, t, name, fid) {
    if (!doc.p[pid] || count(doc) >= MAXP) return null;
    var idx = index(doc), parent = idx.parent[pid], g = /[FBSH]/.test(t) ? 'm' : 'f', np, x;
    if (t === 'F' || t === 'M') {
      var slot = t === 'F' ? 'a' : 'b';
      if (parent && doc.f[parent][slot]) return null;
      np = addPerson(doc, name, g);
      if (!parent) { parent = addFam(doc); doc.f[parent].k.push(pid); }
      doc.f[parent][slot] = np;
      return np;
    }
    if (t === 'B' || t === 'Z') {
      np = addPerson(doc, name, g);
      if (!parent) { parent = addFam(doc); doc.f[parent].k.push(pid); }
      doc.f[parent].k.push(np);
      return np;
    }
    var mine = doc.p[pid].g === 'f' ? 'b' : 'a', theirs = mine === 'a' ? 'b' : 'a', unions = idx.unions[pid] || [];
    if (t === 'H' || t === 'W') {
      np = addPerson(doc, name, doc.p[pid].g === 'f' ? 'm' : 'f');
      // children added before the husband or wife was: they become this marriage's children
      var open = unions.filter(function (u) { return !doc.f[u][theirs]; })[0];
      if (!open) { open = addFam(doc); doc.f[open][mine] = pid; }
      doc.f[open][theirs] = np;
      return np;
    }
    if (t === 'S' || t === 'D') {
      if (fid && unions.indexOf(fid) < 0) return null;
      if (!fid && unions.length > 1) return null;
      fid = fid || unions[0];
      np = addPerson(doc, name, g);
      if (!fid) { fid = addFam(doc); doc.f[fid][mine] = pid; }
      doc.f[fid].k.push(np);
      return np;
    }
    return null;
  }

  function rename(doc, pid, name) {
    if (!doc.p[pid]) return false;
    doc.p[pid].n = cleanName(name);
    return true;
  }

  // Removes someone (never me) and whoever was only joined to me through them. Returns who else went.
  function removePerson(doc, pid) {
    if (pid === doc.me || !doc.p[pid]) return null;
    delete doc.p[pid];
    Object.keys(doc.f).forEach(function (fid) {
      var x = doc.f[fid];
      if (x.a === pid) x.a = null;
      if (x.b === pid) x.b = null;
      x.k = x.k.filter(function (c) { return c !== pid; });
    });
    return prune(doc);
  }

  // Moves someone one place among their brothers and sisters (eldest first). dir -1 = older.
  function move(doc, pid, dir) {
    var fid = index(doc).parent[pid];
    if (!fid) return false;
    var k = doc.f[fid].k, i = k.indexOf(pid), j = i + dir;
    if (j < 0 || j >= k.length) return false;
    k[i] = k[j]; k[j] = pid;
    return true;
  }

  /* ---------- What each person is to me ---------- */

  // The shortest walk from me to everyone, in the finder's steps; me is [].
  function relations(doc, idx) {
    var out = {}, queue = [doc.me];
    out[doc.me] = [];
    var gStep = function (pid, m, f) { return doc.p[pid].g === 'f' ? f : m; };
    while (queue.length) {
      var pid = queue.shift(), path = out[pid], next = [], parent = idx.parent[pid], unions = idx.unions[pid] || [];
      if (parent) {
        var x = doc.f[parent];
        if (x.a) next.push([x.a, 'F']);
        if (x.b) next.push([x.b, 'M']);
        x.k.forEach(function (c) { if (c !== pid) next.push([c, gStep(c, 'B', 'Z')]); });
      }
      unions.forEach(function (fid) {
        var y = doc.f[fid], mate = y.a === pid ? y.b : y.a;
        if (mate) next.push([mate, gStep(mate, 'H', 'W')]);
      });
      unions.forEach(function (fid) {
        doc.f[fid].k.forEach(function (c) { next.push([c, gStep(c, 'S', 'D')]); });
      });
      next.forEach(function (e) {
        if (!out[e[0]]) { out[e[0]] = path.concat(e[1]); queue.push(e[0]); }
      });
    }
    return out;
  }

  // «أنا», «عمي», «بنت خالي», «جد أبوي».
  function relName(path) {
    if (!path) return '';
    if (!path.length) return 'أنا';
    if (path.length === 3 && /^[FM]{3}$/.test(path.join(''))) return KIN.common(path);
    return KIN.phrase(path);
  }

  /* ---------- Views: from my father's side or my mother's ---------- */

  // From a person up through fathers (mothers where no father is added) to the top family.
  // Returns { fam, via } where via is the person on my line inside that family, or { kid } when
  // the person has no parents added yet.
  function climb(doc, idx, pid) {
    var fam = idx.parent[pid], via = pid;
    if (!fam) return { kid: pid, via: pid };
    for (var guard = 0; guard < 60; guard++) {
      var x = doc.f[fam], up = x.a ? idx.parent[x.a] : x.b ? idx.parent[x.b] : null;
      if (!up) return { fam: fam, via: via };
      via = x.a || x.b;
      fam = up;
    }
    return { fam: fam, via: via };
  }

  // The people on my lines: me, my father and his fathers, my mother and her fathers.
  function lineSet(doc, idx) {
    var set = {}, parent = idx.parent[doc.me];
    set[doc.me] = 1;
    if (!parent) return set;
    var x = doc.f[parent];
    [x.a, x.b].forEach(function (start) {
      for (var cur = start, guard = 0; cur && guard < 60; guard++) {
        set[cur] = 1;
        var up = idx.parent[cur];
        if (!up) break;
        cur = doc.f[up].a || doc.f[up].b;
      }
    });
    return set;
  }

  // The marriages on my line (mine, my parents', theirs...): the picture keeps husbands and wives only there.
  function lineUnions(doc, idx) {
    var set = {}, seen = {}, queue = [doc.me];
    (idx.unions[doc.me] || []).forEach(function (fid) { set[fid] = 1; });
    while (queue.length) {
      var pid = queue.shift(), up = idx.parent[pid];
      if (!up || seen[up]) continue;
      seen[up] = set[up] = 1;
      if (doc.f[up].a) queue.push(doc.f[up].a);
      if (doc.f[up].b) queue.push(doc.f[up].b);
    }
    return set;
  }

  function views(doc, idx) {
    var parent = idx.parent[doc.me], x = parent ? doc.f[parent] : null, out = [];
    if (x && x.a) out.push({ key: 'F', label: 'أهل أبوي', root: climb(doc, idx, x.a) });
    if (x && x.b) out.push({ key: 'M', label: 'أهل أمي', root: climb(doc, idx, x.b) });
    if (!out.length) out.push({ key: 'me', label: '', root: parent ? { fam: parent, via: doc.me } : { kid: doc.me, via: doc.me } });
    return out;
  }

  /* ---------- Layout ---------- */

  /* Sizes in px. NW: one person's box, AV: the circle, NH: circle + name + relation,
     CG: husband to wife, SG: brother to brother, GG: between families, RH: one generation. */
  var SCREEN = { NW: 92, AV: 54, NH: 112, CG: 14, SG: 10, GG: 26, RH: 158 };

  /* Builds the blocks of one view. Every block is a row of people (a blood relative with their
     husband or wife beside them) and groups of children under each marriage.
     opts: { ghosts: show «+» places to add parents, mates: 'all' | 'line', collapse: {pid: 1} } */
  function blocks(doc, idx, view, opts) {
    var me = doc.me, myParents = idx.parent[me], line = opts.mates === 'line' ? lineUnions(doc, idx) : null;
    var heads = {};

    function person(pid) {
      heads[pid] = 1;
      var unions = idx.unions[pid] || [], parts = [];
      unions.forEach(function (fid) {
        var x = doc.f[fid], mate = x.a === pid ? x.b : x.a, slot = null;
        if (mate && (!line || line[fid])) slot = { pid: mate, kind: 'mate' };
        else if (!mate && opts.ghosts && fid === myParents) slot = { ghost: { of: me, t: x.a ? 'M' : 'F' } };
        parts.push({ fid: fid, slot: slot });
      });
      var row = [], pIdx = 0, groups = [];
      if (parts.length <= 1) {
        row.push({ pid: pid, kind: 'blood' });
        if (parts[0] && parts[0].slot) row.push(parts[0].slot);
        if (parts[0]) groups.push({ from: parts[0].slot ? [0, 1] : [0], fid: parts[0].fid });
      } else {
        if (parts[0].slot) { row.push(parts[0].slot); pIdx = 1; }
        row.push({ pid: pid, kind: 'blood' });
        groups.push({ from: parts[0].slot ? [0, 1] : [pIdx], fid: parts[0].fid });
        parts.slice(1).forEach(function (part) {
          if (part.slot) { row.push(part.slot); groups.push({ from: [pIdx, row.length - 1], fid: part.fid }); }
          else groups.push({ from: [pIdx], fid: part.fid });
        });
      }
      var hidden = 0;
      groups.forEach(function (g) {
        var kids = doc.f[g.fid].k;
        if (opts.collapse && opts.collapse[pid]) { hidden += kids.length; g.kids = []; }
        else g.kids = kids.map(person);
      });
      if (hidden) {
        groups = [{ from: groups[0].from, kids: [], more: hidden, g: doc.p[pid].g }];
      }
      return { pid: pid, row: row, head: pIdx, groups: groups.filter(function (g) { return g.kids.length || g.more; }) };
    }

    var r = view.root, top = [], kids;
    if (r.fam) {
      var R = doc.f[r.fam];
      if (R.a) top.push({ pid: R.a, kind: 'top' }); else if (opts.ghosts) top.push({ ghost: { of: r.via, t: 'F' } });
      if (R.b) top.push({ pid: R.b, kind: 'top' }); else if (opts.ghosts) top.push({ ghost: { of: r.via, t: 'M' } });
      kids = R.k.map(person);
    } else {
      if (opts.ghosts) top.push({ ghost: { of: r.kid, t: 'F' } }, { ghost: { of: r.kid, t: 'M' } });
      kids = [person(r.kid)];
    }
    var rootBlock = top.length
      ? { pid: null, row: top, head: 0, groups: [{ from: top.length > 1 ? [0, 1] : [0], kids: kids }] }
      : (kids.length === 1 ? kids[0] : { pid: null, row: [], head: 0, groups: [{ from: [], kids: kids }] });
    return { root: rootBlock, heads: heads };
  }

  function measure(b, M) {
    b.rowW = b.row.length ? b.row.length * M.NW + (b.row.length - 1) * M.CG : 0;
    var kidsW = 0, n = 0;
    b.groups.forEach(function (g) {
      var w = 0;
      g.kids.forEach(function (k, i) { w += measure(k, M) + (i ? M.SG : 0); });
      if (g.more) w += (g.kids.length ? M.SG : 0) + M.NW;
      g.w = w;
      if (w) { kidsW += w + (n ? M.GG : 0); n++; }
    });
    b.kidsW = kidsW;
    b.W = Math.max(b.rowW, kidsW);
    return b.W;
  }

  /* Places a block with its left edge at x0 and its row at y (reading order runs left to right here;
     the drawing mirrors it so the eldest ends up on the right). Fills out.nodes and out.links. */
  function place(b, x0, y, M, out, depth) {
    var flat = !b.row.length, ky = flat ? y : y + M.RH, kdepth = flat ? depth : depth + 1;
    var kx = x0 + (b.W - b.kidsW) / 2;
    out.depth = Math.max(out.depth, depth);
    b.groups.forEach(function (g) {
      var hs = [];
      g.kids.forEach(function (k, i) {
        if (i) kx += M.SG;
        place(k, kx, ky, M, out, kdepth);
        hs.push(k.headX);
        kx += k.W;
      });
      if (g.more) {
        if (g.kids.length) kx += M.SG;
        var mx = kx + M.NW / 2;
        out.nodes.push({ more: g.more, g: g.g, x: mx, y: ky });
        out.depth = Math.max(out.depth, kdepth);
        hs.push(mx);
        kx += M.NW;
      }
      g.heads = hs;
      kx += M.GG;
    });
    if (flat) {
      // brothers and sisters whose parents aren't in the tree still hang from one line
      var hs1 = b.groups[0] ? b.groups[0].heads : [];
      if (hs1.length > 1) {
        var sy = y - (M.RH - M.NH) / 2;
        out.links.push({ t: 'kids', ax: (hs1[0] + hs1[hs1.length - 1]) / 2, ay: sy, busY: sy, kids: hs1, ky: y, ghost: false });
      }
      b.headX = x0 + b.W / 2;
      return;
    }

    var slotX = function (rx, i) { return rx + M.NW / 2 + i * (M.NW + M.CG); };
    var rx = x0 + (b.W - b.rowW) / 2;
    if (b.groups.length === 1 && b.groups[0].heads.length) {
      // put the parents right above the middle of their children
      var hs0 = b.groups[0].heads, mid = (hs0[0] + hs0[hs0.length - 1]) / 2;
      var from = b.groups[0].from, off = 0;
      from.forEach(function (i) { off += slotX(0, i); });
      off /= from.length || 1;
      rx = Math.max(x0, Math.min(x0 + b.W - b.rowW, mid - off));
    }
    b.row.forEach(function (s, i) {
      out.nodes.push({ pid: s.pid || null, kind: s.ghost ? 'ghost' : s.kind, ghost: s.ghost || null, x: slotX(rx, i), y: y });
    });
    b.headX = slotX(rx, b.head);
    // husband and wife side by side (a second wife sits on the other side)
    b.row.forEach(function (s, i) {
      if (i === b.head) return;
      var ghost = !!(s.ghost || b.row[b.head].ghost);
      out.links.push({ t: 'pair', x1: slotX(rx, Math.min(i, b.head)), x2: slotX(rx, Math.max(i, b.head)), y: y + M.AV / 2, ghost: ghost });
    });
    // and a line down to their children: from between the two of them, or from under one parent's name
    b.groups.forEach(function (g) {
      if (!g.heads.length) return;
      var ax = 0;
      g.from.forEach(function (i) { ax += slotX(rx, i); });
      ax /= g.from.length || 1;
      var ghostTop = g.from.length > 0 && g.from.every(function (i) { return b.row[i].ghost; });
      out.links.push({ t: 'kids', ax: ax, ay: y + (g.from.length === 2 ? M.AV / 2 : M.NH + 2), busY: y + M.NH + (M.RH - M.NH) / 2,
        kids: g.heads, ky: ky, ghost: ghostTop });
    });
  }

  // Everything needed to draw one view at sizes M: nodes and lines, in a W x H box, eldest on the right.
  function layout(doc, idx, view, M, opts) {
    var bl = blocks(doc, idx, view, opts), out = { nodes: [], links: [], depth: 0 };
    measure(bl.root, M);
    var R = bl.root, top = !R.row.length && R.groups[0] && R.groups[0].kids.length > 1 ? (M.RH - M.NH) / 2 : 0;
    place(R, 0, top, M, out, 0);
    var W = R.W, H = top + out.depth * M.RH + M.NH;
    var X = function (x) { return W - x; };
    out.nodes.forEach(function (n) { n.x = X(n.x); });
    out.links.forEach(function (l) {
      if (l.t === 'pair') { var a = X(l.x1), b = X(l.x2); l.x1 = Math.min(a, b); l.x2 = Math.max(a, b); }
      else { l.ax = X(l.ax); l.kids = l.kids.map(X); }
    });
    out.W = W; out.H = H; out.heads = bl.heads; out.levels = out.depth + 1;
    return out;
  }

  // Who can be added to a person, so that everyone added still shows on one of the views.
  function choices(doc, idx, pid, line, heads) {
    var p = doc.p[pid], parent = idx.parent[pid], fam = parent ? doc.f[parent] : null, out = [];
    if (fam ? !fam.a : line[pid]) out.push('F');
    if (fam ? !fam.b : line[pid]) out.push('M');
    if ((heads[pid] || line[pid]) && (fam || line[pid])) out.push('B', 'Z');
    if (heads[pid]) out.push(p.g === 'f' ? 'H' : 'W');
    out.push('S', 'D');
    return out;
  }

  /* The line from parents down to each child, turning with round corners instead of square ones:
     a list of ['M', x, y], ['L', x, y] and ['Q', cx, cy, x, y] steps (the screen draws it as SVG, the
     picture on a canvas). All the children's lines are one path, so where they overlap the line
     isn't drawn darker. ky is where each child's line stops; R is the size of the turns. */
  function kidLines(ax, ay, busY, kids, ky, R) {
    var out = [];
    kids.forEach(function (kx) {
      var dx = kx - ax, s = dx < 0 ? -1 : 1, half = Math.abs(dx) / 2;
      out.push(['M', ax, ay]);
      if (half < 0.5) { out.push(['L', ax, ky]); return; }
      var r1 = Math.max(0, Math.min(R, busY - ay, half)), r2 = Math.max(0, Math.min(R, ky - busY, half));
      if (r1 > 0) out.push(['L', ax, busY - r1], ['Q', ax, busY, ax + s * r1, busY]);
      out.push(['L', kx - s * r2, busY]);
      if (r2 > 0) out.push(['Q', kx, busY, kx, busY + r2]);
      out.push(['L', kx, ky]);
    });
    return out;
  }

  var TREE = {
    blank: blank, clean: clean, cleanFam: cleanFam, famTitle: famTitle, copy: copy, index: index, count: count, addRelative: addRelative, rename: rename,
    removePerson: removePerson, move: move, relations: relations, relName: relName, views: views, climb: climb,
    lineSet: lineSet, lineUnions: lineUnions, layout: layout, choices: choices, kidLines: kidLines, SCREEN: SCREEN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TREE;
  root.TREE = TREE;
  if (typeof document === 'undefined') return;

  /* ---------- Picture (story 1080 x 1920, post 1080 x 1350) ---------- */

  var PIC = { NW: 150, AV: 96, NH: 196, CG: 18, SG: 16, GG: 40, RH: 270 };
  var PICFMT = {
    story: { title: 120, titleY: 300, sub: 46, subY: 384, boxY: 470, boxH: 1000, boxW: 960 },
    post: { title: 92, titleY: 168, sub: 38, subY: 232, boxY: 292, boxH: 812, boxW: 960 }
  };
  var MIN_SCALE = 0.72, MAX_SCALE = 1.25;

  // In words, so «٤ · أجيال» can never read as «٤٠».
  var GENS = ['', 'جيل واحد', 'جيلين', 'ثلاث أجيال', 'أربع أجيال', 'خمس أجيال', 'ست أجيال', 'سبع أجيال', 'ثمان أجيال', 'تسع أجيال', 'عشر أجيال'];
  function gens(n) { return GENS[n] || KIN.arNum(n) + ' جيل'; }

  // Me and everyone above me: their children always stay in the picture.
  function mineUp(doc, idx) {
    var set = {}, queue = [doc.me];
    set[doc.me] = 1;
    while (queue.length) {
      var up = idx.parent[queue.shift()];
      if (!up) continue;
      [doc.f[up].a, doc.f[up].b].forEach(function (q) { if (q && !set[q]) { set[q] = 1; queue.push(q); } });
    }
    return set;
  }

  /* Fits a view into the picture. When it is too wide to read, the children of the families furthest
     from me fold into a count («+٤ عياله»), the most distant relatives first, until it fits. */
  function pictureLayout(doc, idx, view, boxW, boxH) {
    var collapse = {}, keep = mineUp(doc, idx), rels = relations(doc, idx), L, s;
    var kidsOf = function (pid) {
      var k = [];
      (idx.unions[pid] || []).forEach(function (fid) { k = k.concat(doc.f[fid].k); });
      return k;
    };
    for (var round = 0; round < 400; round++) {
      L = layout(doc, idx, view, PIC, { ghosts: false, mates: 'line', collapse: collapse });
      s = Math.min(boxW / L.W, boxH / L.H, MAX_SCALE);
      if (s >= MIN_SCALE) break;
      var pick = null, best = -1;
      L.nodes.forEach(function (n) {
        if (!n.pid || n.kind === 'mate' || collapse[n.pid] || keep[n.pid] || !L.heads[n.pid]) return;
        var kids = kidsOf(n.pid);
        // one child with no children of their own takes the same room as the «+١» that would replace them
        if (!kids.length || (kids.length === 1 && !kidsOf(kids[0]).length)) return;
        var score = (rels[n.pid] || []).length * 1e6 + n.y * 1e3 + kids.length;
        if (score > best) { best = score; pick = n.pid; }
      });
      if (!pick) break;
      collapse[pick] = 1;
    }
    return { L: L, s: s };
  }

  // Does this view show any girl or woman? (The switch that hides their names only shows when it does.)
  function viewHasF(doc, viewKey) {
    var idx = index(doc), vs = views(doc, idx), view = vs.filter(function (v) { return v.key === viewKey; })[0] || vs[0];
    return layout(doc, idx, view, PIC, { ghosts: false, mates: 'line' }).nodes.some(function (n) {
      return n.pid && doc.p[n.pid] && doc.p[n.pid].g === 'f';
    });
  }

  // A small pearl, drawn where a hidden name's first letter would be.
  function pearl(ctx, cx, cy, pr, onPearl) {
    if (onPearl) ctx.fillStyle = '#0E2A47';
    else {
      var g = ctx.createRadialGradient(cx - pr * 0.35, cy - pr * 0.4, pr * 0.05, cx, cy, pr);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#F4EFE6'); g.addColorStop(1, '#C9BCA8');
      ctx.fillStyle = g;
    }
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
  }

  /* opts.hideF: girls and women show what they are to me («أختي») instead of their name, and a pearl
     instead of their first letter. */
  function makePicture(doc, viewKey, format, opts) {
    var hideF = !!(opts && opts.hideF);
    var D = KIN.draw, F = PICFMT[format] || PICFMT.story, H = KIN.FORMATS[format === 'post' ? 'post' : 'story'].H;
    var idx = index(doc), rels = relations(doc, idx), vs = views(doc, idx);
    var view = vs.filter(function (v) { return v.key === viewKey; })[0] || vs[0];
    var title = famTitle(doc);
    var sample = title + ' أهل أبوي أمي عياله عيالها +0123456789 ' + GENS.join(' ') + ' ' + Object.keys(doc.p).map(function (id) { return doc.p[id].n + ' ' + relName(rels[id]); }).join(' ');
    return D.loadFonts(sample).then(function () {
      var c = document.createElement('canvas');
      c.width = 1080; c.height = H;
      var ctx = c.getContext('2d');
      D.background(ctx, 1080, H);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

      var pl = pictureLayout(doc, idx, view, F.boxW, F.boxH), L = pl.L, s = pl.s;
      ctx.fillStyle = '#F4EFE6';
      D.fit(ctx, title, '700', F.title, 960, 60);
      ctx.fillText(title, 540, F.titleY);
      ctx.fillStyle = '#E9C46A';
      D.setFont(ctx, '500', F.sub);
      ctx.fillText((view.label ? view.label + ' · ' : '') + gens(L.levels), 540, F.subY);

      var M = {};
      Object.keys(PIC).forEach(function (k) { M[k] = PIC[k] * s; });
      var ox = 540 - L.W * s / 2, oy = F.boxY + Math.max(0, (F.boxH - L.H * s) / 2);
      var X = function (x) { return ox + x * s; }, Y = function (y) { return oy + y * s; };
      var r = M.AV / 2, ring = Math.max(4, 6 * s);

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(244, 239, 230, 0.4)'; ctx.lineWidth = Math.max(2.5, 3.5 * s);
      L.links.forEach(function (l) {
        ctx.beginPath();
        if (l.t === 'pair') {
          ctx.moveTo(X(l.x1) + r + ring, Y(l.y)); ctx.lineTo(X(l.x2) - r - ring, Y(l.y));
        } else {
          kidLines(X(l.ax), Y(l.ay), Y(l.busY), l.kids.map(X), Y(l.ky) - ring, 24 * s).forEach(function (c) {
            if (c[0] === 'M') ctx.moveTo(c[1], c[2]);
            else if (c[0] === 'L') ctx.lineTo(c[1], c[2]);
            else ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]);
          });
        }
        ctx.stroke();
      });

      L.nodes.forEach(function (n) {
        var cx = X(n.x), cy = Y(n.y) + r, isMe = n.pid === doc.me;
        // me in sand, girls and women in coral, boys and men in teal
        var col = isMe ? '#E9C46A' : n.more ? 'rgba(244, 239, 230, 0.45)' : doc.p[n.pid].g === 'f' ? '#FF8A80' : '#2EC4B6';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = isMe ? '#F4EFE6' : '#12385E'; ctx.fill();
        ctx.lineWidth = ring; ctx.strokeStyle = col;
        if (n.more) ctx.setLineDash([ring * 1.6, ring * 1.4]);
        ctx.stroke();
        ctx.setLineDash([]);
        var hidden = !n.more && hideF && doc.p[n.pid].g === 'f';
        if (hidden) pearl(ctx, cx, cy, r * 0.3, isMe);
        else {
          var top = n.more ? '+' + n.more : initial(doc.p[n.pid].n);
          ctx.fillStyle = isMe ? '#0E2A47' : '#F4EFE6';
          D.setFont(ctx, '700', Math.round(M.AV * (n.more ? 0.36 : 0.42)));
          var m = ctx.measureText(top), ink = (m.actualBoundingBoxAscent || M.AV * 0.3) - (m.actualBoundingBoxDescent || 0);
          ctx.direction = n.more ? 'ltr' : 'rtl';  // «+3», not «3+»
          ctx.fillText(top, cx, cy + ink / 2);
          ctx.direction = 'rtl';
        }

        var name = n.more ? (n.g === 'f' ? 'عيالها' : 'عياله') : hidden ? relName(rels[n.pid]) : doc.p[n.pid].n;
        var ny = Y(n.y) + M.AV + 22 * s + 34 * s;
        ctx.fillStyle = n.more ? '#9DB2C8' : '#F4EFE6';
        D.fit(ctx, name, n.more ? '500' : '700', Math.round(Math.max(22, 34 * s)), M.NW + 6, 16);
        ctx.fillText(name, cx, ny);
        if (!n.more && !hidden) {
          var rel = relName(rels[n.pid]);
          ctx.fillStyle = isMe ? '#F4EFE6' : '#E9C46A';
          D.fit(ctx, rel, '500', Math.round(Math.max(18, 25 * s)), M.NW + 6, 14);
          ctx.fillText(rel, cx, ny + Math.max(26, 36 * s));
        }
      });

      D.drawSticker(ctx, KIN.FORMATS[format === 'post' ? 'post' : 'story'].sticker);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }

  TREE.makePicture = makePicture;
  TREE.viewHasF = viewHasF;
  TREE.pictureLayout = pictureLayout;

  /* ---------- Page ---------- */

  var LOCAL = 'shorbaka.tree.v1';
  // The account tree as it was when the page was put away with a save still on its way. Only for this tab.
  var UNSAVED = 'shorbaka.tree.unsaved';
  var NS = 'http://www.w3.org/2000/svg';

  function loadLocal() {
    try { return clean(JSON.parse(localStorage.getItem(LOCAL) || 'null')); } catch (e) { return null; }
  }

  function storeLocal(doc) {
    try {
      if (doc) localStorage.setItem(LOCAL, JSON.stringify(doc)); else localStorage.removeItem(LOCAL);
      return true;
    } catch (e) { return false; }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function initial(name) {
    var c = Array.from(String(name || '').trim())[0];
    return c ? c.toUpperCase() : '؟';
  }

  var ZOOM = {
    out: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6"/>',
    in: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20M7.5 10.5h6M10.5 7.5v6"/>'
  };

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      sec: $('tree'), count: $('tr-count'), msg: $('tr-msg'), retry: $('tr-retry'),
      start: $('tr-start'), meName: $('tr-me'), gSeg: $('tr-g'), go: $('tr-go'), startErr: $('tr-start-err'),
      wrap: $('tr-wrap'), side: $('tr-side'), zoom: $('tr-zoom'), scroll: $('tr-scroll'), stage: $('tr-stage'),
      canvas: $('tr-canvas'), share: $('tr-share'), note: $('tr-note'), saveRetry: $('tr-save-retry'), signIn: $('tr-in'),
      sheet: $('tr-sheet'), pAv: $('tr-p-av'), pTitle: $('tr-p-title'), pRel: $('tr-p-rel'), pClose: $('tr-p-close'),
      pRename: $('tr-p-rename'), pName: $('tr-p-name'), pSave: $('tr-p-save'), pLabel: $('tr-p-label'), pAdds: $('tr-p-adds'),
      pForm: $('tr-p-form'), pFormLabel: $('tr-p-form-label'), pNew: $('tr-p-new'), pUnions: $('tr-p-unions'), pAdd: $('tr-p-add'),
      pDone: $('tr-p-done'), pOrder: $('tr-p-order'), pUp: $('tr-p-up'), pDown: $('tr-p-down'), pDel: $('tr-p-del'),
      pConfirm: $('tr-p-confirm'), pWarn: $('tr-p-warn'), pYes: $('tr-p-yes'), pNo: $('tr-p-no'),
      acctCount: $('acct-tree-count'),
      famStart: $('tr-fam-start'), famBtn: $('tr-fam-btn'), famText: $('tr-fam-text'), famForm: $('tr-fam-form'), famName: $('tr-fam-name')
    };
    if (!ui.sec || !ui.canvas || !KIN) return;

    var st = {
      doc: null, where: 'local', loaded: false, failed: false, seq: 0,
      view: null, L: null, zl: 0, z: 1, center: true, lastAdded: null,
      person: null, from: null, adding: null, union: null, g: '',
      saving: null, again: false, saveErr: false, pending: false
    };
    var acctReady = !root.ACCOUNT, timer = null;
    var sideBtns = Array.prototype.slice.call(ui.side.querySelectorAll('button'));
    var gBtns = Array.prototype.slice.call(ui.gSeg.querySelectorAll('button'));

    function accounts() { return root.ACCOUNT && root.ACCOUNT.on() ? root.ACCOUNT : null; }
    function signedIn() { var a = accounts(); return a && a.user() ? a : null; }
    function shown() { return !!ui.sec.offsetParent; }

    /* --- where the tree lives: the account when signed in, this device otherwise --- */

    /* The page is going away with a change not yet confirmed. The change is sent now, and a copy stays
       in this tab: after a reload the account could still answer with the tree from before. */
    function keepUnsaved() {
      var a = signedIn();
      if (!a || !st.doc) return;
      try { sessionStorage.setItem(UNSAVED, JSON.stringify({ u: a.user().id, doc: st.doc })); } catch (e) {}
    }
    function unsaved(uid) {
      try {
        var raw = JSON.parse(sessionStorage.getItem(UNSAVED) || 'null');
        return raw && raw.u === uid ? clean(raw.doc) : null;
      } catch (e) { return null; }
    }
    function dropUnsaved() { try { sessionStorage.removeItem(UNSAVED); } catch (e) {} }

    var synced;  // whose tree is on screen: a user id, or null for this device
    function sync(force) {
      var a = signedIn(), uid = a ? a.user().id : null;
      if (!force && uid === synced) return;
      synced = uid;
      var seq = ++st.seq;
      st.failed = false;
      if (!a) {
        st.where = 'local'; st.doc = loadLocal(); st.loaded = true; st.center = true;
        render();
        return;
      }
      st.where = 'account'; st.loaded = false; st.doc = null;
      render();
      a.loadTree().then(function (data) {
        if (seq !== st.seq) return;
        var doc = clean(data), local = loadLocal(), mine = unsaved(uid);
        st.loaded = true; st.center = true;
        if (mine) {
          // this tab closed with a save on its way: its copy is at least as new as the account's
          st.doc = mine;
          render();
          save();
          return;
        }
        if (!doc && local) {
          // a tree made on this device before signing in moves into the account
          st.doc = local;
          render();
          save().then(function (ok) { if (ok) storeLocal(null); });
          return;
        }
        st.doc = doc;
        render();
      }, function () {
        if (seq !== st.seq) return;
        st.failed = true;
        render();
      });
    }

    /* One save at a time; a change made meanwhile is saved right after. Resolves true once saved.
       now: the page is being put away or closed, so the latest tree goes at once, even past a save
       still on its way (that one is older and was sent first). */
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
      var req = (now && a.saveTreeNow && a.saveTreeNow(st.doc)) || a.saveTree(st.doc);
      var mine = st.saving = req.then(function () { return true; }, function () { return false; }).then(function (ok) {
        if (st.saving !== mine) return ok;  // a newer save took over
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

    // Don't lose the last change when the page is closed or put away.
    // (a save still on its way may not have left yet: Supabase looks up the session first)
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
      ui.signIn.hidden = inAcct || !a || !acctReady;
    }

    // How many are in the tree, in English digits like the picture's «+3», and «الله يحفظهم» under it.
    function people(n) { return n === 1 ? 'شخص واحد' : n === 2 ? 'شخصين' : n <= 10 ? n + ' أشخاص' : n + ' شخص'; }
    function counts() {
      var n = st.doc ? count(st.doc) : 0;
      ui.count.textContent = '';
      if (n > 1) { ui.count.appendChild(el('b', null, people(n))); ui.count.appendChild(el('span', null, 'الله يحفظهم')); }
      if (ui.acctCount) ui.acctCount.textContent = st.where === 'account' && n > 1 ? people(n) : '';
    }

    /* --- drawing the tree on the page --- */

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
          var finderMe = $('kin-me'), u = signedIn() && accounts().user();
          if (!ui.meName.value) ui.meName.value = (finderMe && finderMe.value.trim()) || (u && u.first) || '';
        }
        return;
      }
      ui.start.hidden = true; ui.wrap.hidden = false;
      showFam();
      draw();
      note();
      if (!ui.sheet.hidden) fillSheet();
    }

    function allHeads(doc, idx) {
      var heads = {};
      views(doc, idx).forEach(function (v) {
        var L = layout(doc, idx, v, SCREEN, { ghosts: false, mates: 'all' });
        Object.keys(L.heads).forEach(function (k) { heads[k] = 1; });
      });
      return heads;
    }

    function draw() {
      var doc = st.doc, idx = index(doc), rels = relations(doc, idx), vs = views(doc, idx);
      var view = vs.filter(function (v) { return v.key === st.view; })[0] || vs[0];
      st.view = view.key;
      ui.side.hidden = vs.length < 2;
      sideBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.side === view.key)); });

      var L = layout(doc, idx, view, SCREEN, { ghosts: true, mates: 'all' });
      st.L = L;
      ui.canvas.textContent = '';
      ui.canvas.style.width = L.W + 'px';
      ui.canvas.style.height = L.H + 'px';

      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'tr-lines');
      svg.setAttribute('width', L.W); svg.setAttribute('height', L.H);
      svg.setAttribute('viewBox', '0 0 ' + L.W + ' ' + L.H);
      svg.setAttribute('aria-hidden', 'true');
      var r = SCREEN.AV / 2 + 3;
      L.links.forEach(function (l) {
        var d;
        if (l.t === 'pair') d = 'M' + (l.x1 + r) + ' ' + l.y + 'H' + (l.x2 - r);
        else {
          d = kidLines(l.ax, l.ay, l.busY, l.kids, l.ky - 4, 14).map(function (c) {
            return c[0] + c.slice(1).map(function (v) { return Math.round(v * 10) / 10; }).join(' ');
          }).join('');
        }
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        if (l.ghost) p.setAttribute('class', 'is-ghost');
        svg.appendChild(p);
      });
      ui.canvas.appendChild(svg);
      L.nodes.forEach(function (n) { ui.canvas.appendChild(nodeEl(n, doc, rels)); });
      sizeStage();
      if (st.center && shown()) {
        st.center = false;
        centerOn(st.lastAdded && doc.p[st.lastAdded] ? st.lastAdded : doc.me);
      }
    }

    function nodeEl(n, doc, rels) {
      var b = el('button', 'tr-node');
      b.type = 'button';
      b.style.left = (n.x - SCREEN.NW / 2) + 'px';
      b.style.top = n.y + 'px';
      if (n.ghost) {
        var label = relName(rels[n.ghost.of].concat(n.ghost.t));
        b.classList.add('is-ghost');
        b.appendChild(el('span', 'tr-av', '+'));
        b.appendChild(el('span', 'tr-name', label));
        b.setAttribute('aria-label', 'ضيف ' + label);
        b.addEventListener('click', function () { openPerson(n.ghost.of, n.ghost.t, b); });
        return b;
      }
      var p = doc.p[n.pid], isMe = n.pid === doc.me, rel = relName(rels[n.pid]);
      b.classList.add(isMe ? 'is-me' : n.kind === 'mate' ? 'is-mate' : 'is-blood');
      if (!isMe && p.g === 'f') b.classList.add('is-f');
      if (n.pid === st.lastAdded) b.classList.add('is-new');
      b.dataset.pid = n.pid;
      b.appendChild(el('span', 'tr-av', initial(p.n)));
      b.appendChild(el('span', 'tr-name', p.n || '…'));
      b.appendChild(el('span', 'tr-rel', rel));
      b.setAttribute('aria-label', isMe ? p.n + '، هذا إنت' : p.n + '، ' + KIN.verb(rels[n.pid]) + ' ' + rel);
      b.addEventListener('click', function () { openPerson(n.pid, null, b); });
      return b;
    }

    // Big trees can be zoomed out to see all of it at once.
    /* The sizes the zoom button steps through: as drawn, then smaller. A big tree gets two steps down,
       the second showing it all (or as much as stays visible). */
    function zooms() {
      var L = st.L, avail = ui.scroll.clientWidth - 36;
      if (!L || avail <= 0) return [1];
      var fit = Math.max(0.16, Math.min(1, avail / L.W));
      if (fit > 0.98) return [1];
      if (fit >= 0.62) return [1, fit];
      return [1, Math.min(0.75, Math.sqrt(fit)), fit];
    }

    function sizeStage() {
      var L = st.L;
      if (!L || ui.scroll.clientWidth - 36 <= 0) return;
      var zs = zooms(), last = zs.length > 1 && st.zl >= zs.length - 1;
      ui.zoom.hidden = zs.length < 2;
      st.zl = Math.min(st.zl, zs.length - 1);
      var z = zs[st.zl];
      st.z = z;
      ui.canvas.style.transform = z === 1 ? '' : 'scale(' + z + ')';
      ui.stage.style.width = Math.ceil(L.W * z) + 'px';
      ui.stage.style.height = Math.ceil(L.H * z) + 'px';
      ui.zoom.setAttribute('aria-label', last ? 'رجّع الشجرة لحجمها' : st.zl ? 'صغّرها أكثر' : 'صغّر الشجرة');
      ui.zoom.setAttribute('aria-pressed', String(st.zl > 0));
      ui.zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (last ? ZOOM.in : ZOOM.out) + '</svg>';
    }

    function centerOn(pid) {
      var n = st.L && st.L.nodes.filter(function (x) { return x.pid === pid; })[0];
      if (!n) return;
      ui.scroll.scrollLeft = Math.max(0, 18 + n.x * st.z - ui.scroll.clientWidth / 2);
    }

    /* --- one person: rename, add relatives, order, remove --- */

    // What the new person would be to me, by trying the change on a copy.
    function preview(pid, t, fid) {
      var d = copy(st.doc), id = addRelative(d, pid, t, '…', fid);
      return id ? relName(relations(d, index(d))[id]) : '';
    }

    function openPerson(pid, preset, from) {
      st.person = pid; st.from = from || null; st.adding = null; st.union = null;
      ui.pDone.textContent = '';
      ui.pName.value = st.doc.p[pid].n;
      fillSheet();
      ui.sheet.hidden = false;
      document.documentElement.classList.add('kin-lock');
      if (preset && ui.pAdds.querySelector('[data-t="' + preset + '"]')) startAdd(preset);
      else ui.pClose.focus();
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
      var idx = index(doc), rels = relations(doc, idx), isMe = pid === doc.me;
      ui.pAv.textContent = initial(p.n);
      ui.pAv.parentNode.className = 'tr-p-who' + (isMe ? ' is-me' : p.g === 'f' ? ' is-f' : '');
      ui.pTitle.textContent = p.n || '…';
      ui.pRel.textContent = isMe ? 'هذا إنت' : KIN.verb(rels[pid]) + ' ' + relName(rels[pid]);
      ui.pSave.disabled = !cleanName(ui.pName.value) || cleanName(ui.pName.value) === p.n;

      var list = choices(doc, idx, pid, lineSet(doc, idx), allHeads(doc, idx));
      ui.pLabel.textContent = isMe ? 'ضيف من أهلك:' : 'ضيف من أهل ' + (p.n || 'هالشخص') + ':';
      ui.pAdds.textContent = '';
      list.forEach(function (t) {
        var c = el('button', 'tr-chip', preview(pid, t, t === 'S' || t === 'D' ? (idx.unions[pid] || [])[0] : null));
        c.type = 'button';
        c.dataset.t = t;
        c.setAttribute('aria-pressed', String(st.adding === t));
        c.addEventListener('click', function () { if (st.adding === t) stopAdd(); else startAdd(t); });
        ui.pAdds.appendChild(c);
      });
      if (st.adding && list.indexOf(st.adding) < 0) stopAdd();

      var fam = idx.parent[pid], sibs = fam ? doc.f[fam].k : [], at = sibs.indexOf(pid);
      ui.pOrder.hidden = sibs.length < 2;
      ui.pUp.disabled = at <= 0;
      ui.pDown.disabled = at < 0 || at >= sibs.length - 1;
      ui.pOrder.querySelector('span').textContent = p.g === 'f' ? 'ترتيبها بين إخوانها' : 'ترتيبه بين إخوانه';

      ui.pDel.hidden = isMe;
      ui.pDel.querySelector('span').textContent = 'امسح ' + (p.n || 'هالشخص') + ' من الشجرة';
      ui.pConfirm.hidden = true;
    }

    function startAdd(t) {
      var doc = st.doc, idx = index(doc), unions = t === 'S' || t === 'D' ? (idx.unions[st.person] || []) : [];
      st.adding = t;
      st.union = unions.length > 1 ? (unions.indexOf(st.union) >= 0 ? st.union : unions[0]) : null;
      Array.prototype.forEach.call(ui.pAdds.children, function (c) { c.setAttribute('aria-pressed', String(c.dataset.t === t)); });
      ui.pForm.hidden = false;
      ui.pUnions.textContent = '';
      ui.pUnions.hidden = unions.length < 2;
      if (unions.length > 1) {
        ui.pUnions.appendChild(el('span', null, doc.p[st.person].g === 'f' ? 'أبوه:' : 'أمه:'));
        unions.forEach(function (fid) {
          var x = doc.f[fid], mate = x.a === st.person ? x.b : x.a;
          var b = el('button', 'tr-chip tr-chip-sm', mate ? (doc.p[mate].n || '…') : 'ما أعرف');
          b.type = 'button';
          b.dataset.fid = fid;
          b.setAttribute('aria-pressed', String(fid === st.union));
          b.addEventListener('click', function () {
            st.union = fid;
            Array.prototype.forEach.call(ui.pUnions.querySelectorAll('button'), function (x2) { x2.setAttribute('aria-pressed', String(x2 === b)); });
            formLabel();
          });
          ui.pUnions.appendChild(b);
        });
      }
      formLabel();
      ui.pNew.value = '';
      ui.pNew.focus();
    }

    function formLabel() {
      var rel = preview(st.person, st.adding, st.union);
      ui.pFormLabel.textContent = 'اسم ' + rel;
      ui.pNew.setAttribute('aria-label', 'اسم ' + rel);
    }

    function stopAdd() {
      st.adding = null; st.union = null;
      ui.pForm.hidden = true;
      Array.prototype.forEach.call(ui.pAdds.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
    }

    // After adding someone, show the side of the family they are on.
    function ensureVisible(pid) {
      var doc = st.doc, idx = index(doc), vs = views(doc, idx), has = function (v) {
        return layout(doc, idx, v, SCREEN, { ghosts: false, mates: 'all' }).nodes.some(function (n) { return n.pid === pid; });
      };
      var curView = vs.filter(function (v) { return v.key === st.view; })[0];
      if (curView && has(curView)) return;
      var other = vs.filter(has)[0];
      if (other) st.view = other.key;
    }

    ui.pForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = cleanName(ui.pNew.value);
      if (!name) { ui.pNew.focus(); return; }
      if (!st.adding) return;
      var id = addRelative(st.doc, st.person, st.adding, name, st.union);
      if (!id) { ui.pDone.textContent = 'ما زبطت الإضافة.'; return; }
      st.lastAdded = id;
      st.center = true;
      ensureVisible(id);
      var g = st.doc.p[id].g;
      changed();
      ui.pDone.textContent = (g === 'f' ? 'انضافت ' : 'انضاف ') + name + ' ✓';
      if (st.adding) { formLabel(); ui.pNew.value = ''; ui.pNew.focus(); }
    });

    ui.pName.addEventListener('input', function () {
      var p = st.doc && st.doc.p[st.person];
      ui.pSave.disabled = !p || !cleanName(ui.pName.value) || cleanName(ui.pName.value) === p.n;
    });
    ui.pRename.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = cleanName(ui.pName.value);
      if (!name || !st.doc.p[st.person]) return;
      rename(st.doc, st.person, name);
      ui.pName.value = name;
      changed();
      ui.pDone.textContent = 'تعدّل الاسم ✓';
    });

    ui.pUp.addEventListener('click', function () { if (move(st.doc, st.person, -1)) changed(); });
    ui.pDown.addEventListener('click', function () { if (move(st.doc, st.person, 1)) changed(); });

    ui.pDel.addEventListener('click', function () {
      var p = st.doc.p[st.person], gone = removePerson(copy(st.doc), st.person) || [], f = p.g === 'f';
      ui.pWarn.textContent = 'بينمسح ' + (p.n || 'هالشخص') + ' من شجرتك' + (gone.length
        ? (f ? '، ومعها ' : '، ومعه ') + people(gone.length) + ' ما يوصلون لك إلا ' + (f ? 'عن طريقها.' : 'عن طريقه.')
        : '.');
      ui.pConfirm.hidden = false;
      ui.pDel.hidden = true;
      ui.pNo.focus();
    });
    ui.pNo.addEventListener('click', function () { ui.pConfirm.hidden = true; ui.pDel.hidden = false; ui.pDel.focus(); });
    ui.pYes.addEventListener('click', function () {
      var pid = st.person;
      st.from = null;
      closePerson();
      removePerson(st.doc, pid);
      if (st.lastAdded && !st.doc.p[st.lastAdded]) st.lastAdded = null;
      changed();
    });

    ui.pClose.addEventListener('click', closePerson);
    ui.sheet.addEventListener('click', function (e) { if (e.target === ui.sheet) closePerson(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !ui.sheet.hidden) { e.stopPropagation(); closePerson(); }
    }, true);

    /* --- starting a tree --- */

    gBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        st.g = b.dataset.g;
        gBtns.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        ui.startErr.hidden = true;
      });
    });
    ui.meName.addEventListener('input', function () { ui.startErr.hidden = true; });
    ui.start.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = cleanName(ui.meName.value);
      if (!name || !st.g) {
        ui.startErr.textContent = !name ? 'اكتب اسمك أول.' : 'اختار: ولد ولا بنت؟';
        ui.startErr.hidden = false;
        (!name ? ui.meName : gBtns[0]).focus();
        return;
      }
      st.doc = blank(name, st.g);
      var fn = cleanFam(ui.famStart.value);
      if (fn) st.doc.fn = fn;
      st.center = true;
      changed();
      save();
      var meBtn = ui.canvas.querySelector('.tr-node.is-me');
      if (meBtn) meBtn.focus({ preventScroll: true });
    });

    /* --- the family name on top: tap it to write or change it --- */

    function showFam() {
      var fn = st.doc && st.doc.fn;
      ui.famText.textContent = fn ? 'عائلة ' + fn : 'اسم العائلة';
      ui.famBtn.classList.toggle('is-empty', !fn);
      ui.famBtn.setAttribute('aria-label', fn ? 'عائلة ' + fn + '. غيّر اسم العائلة' : 'ضيف اسم العائلة');
    }
    function openFam() {
      if (!st.doc) return;
      ui.famName.value = st.doc.fn || '';
      ui.famBtn.hidden = true; ui.famForm.hidden = false;
      ui.famName.focus();
    }
    // keep: write what's in the box into the tree; otherwise just close it
    function closeFam(keep) {
      if (ui.famForm.hidden) return;
      ui.famForm.hidden = true; ui.famBtn.hidden = false;
      if (keep && st.doc) {
        var fn = cleanFam(ui.famName.value);
        if (fn !== (st.doc.fn || '')) {
          if (fn) st.doc.fn = fn; else delete st.doc.fn;
          changed();
        }
      }
      showFam();
    }
    ui.famBtn.addEventListener('click', openFam);
    ui.famForm.addEventListener('submit', function (e) { e.preventDefault(); closeFam(true); ui.famBtn.focus({ preventScroll: true }); });
    ui.famName.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeFam(false); ui.famBtn.focus({ preventScroll: true }); }
    });
    // leaving the box keeps what was written (tapping «حفظ» leaves it too)
    ui.famName.addEventListener('blur', function () { setTimeout(function () { closeFam(true); }, 0); });

    /* --- the rest of the controls --- */

    sideBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.view === b.dataset.side) return;
        st.view = b.dataset.side;
        st.center = true;
        render();
      });
    });
    // Each tap goes a step smaller, keeping the middle of what's on screen in the middle; after the smallest, back to normal.
    ui.zoom.addEventListener('click', function () {
      var mid = (ui.scroll.scrollLeft + ui.scroll.clientWidth / 2 - 18) / st.z;
      st.zl = (st.zl + 1) % zooms().length;
      sizeStage();
      if (!st.zl) centerOn(st.doc.me);
      else ui.scroll.scrollLeft = Math.max(0, 18 + mid * st.z - ui.scroll.clientWidth / 2);
    });
    ui.retry.addEventListener('click', function () { sync(true); });
    ui.saveRetry.addEventListener('click', function () { save(); });
    ui.signIn.addEventListener('click', function () {
      if (KIN.openAuth) KIN.openAuth({ title: 'احفظ شجرتك بحسابك', text: 'سجّل دخولك بجوجل عشان تنحفظ شجرتك بحسابك، وتلقاها من أي جهاز.' }, ui.signIn);
    });
    ui.share.addEventListener('click', function () {
      if (!st.doc || !KIN.openShare) return;
      var doc = copy(st.doc), key = st.view, vs = views(doc, index(doc));
      var view = vs.filter(function (v) { return v.key === key; })[0] || vs[0];
      var opts = { hideF: !!(st.doc.o && st.doc.o.hideF) };
      KIN.openShare({
        file: 'shorbaka-tree',
        make: function (format) { return makePicture(doc, key, format, opts); },
        alt: famTitle(doc) + (view.label ? '، ' + view.label : ''),
        mention: 'تمنشن أهلك',
        // remembered with the tree, so the next picture comes out the same way
        option: !viewHasF(doc, key) ? null : {
          label: 'أخفي أسامي البنات', hint: 'يطلع «أختي» و«أمي» بدال الأسامي', on: opts.hideF,
          set: function (on) {
            opts.hideF = on;
            if (!st.doc) return;
            var o = st.doc.o || {};
            if (on) o.hideF = true; else delete o.hideF;
            if (Object.keys(o).length) st.doc.o = o; else delete st.doc.o;
            changed();
          }
        }
      }, ui.share);
    });
    var resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () { if (st.L) sizeStage(); }, 120);
    });

    // kin.js calls this when the page switches between «شنو يصير لك؟» and the tree.
    TREE.shown = function (isTree) {
      if (!isTree || !st.doc) return;
      st.center = true;
      render();
    };

    if (root.ACCOUNT) {
      root.ACCOUNT.onChange(function () { if (acctReady) sync(); });
      root.ACCOUNT.ready.then(function () { acctReady = true; sync(true); });
    }
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
