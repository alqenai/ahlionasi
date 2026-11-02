/* شرباكة: «شجرة عائلتي».
   Start from yourself and add your family one person at a time. Under every name the tree writes what
   that person is to you («عمي»، «بنت خالي»), with the same engine as «شنو يصير لك؟». The tree is drawn
   from your father's side or your mother's side, kept in your account (or on this device), and shared
   as a picture.

   The whole tree is one small document:
     { v: 1, me: 'p1', n: 7,
       p: { p1: { n: 'علي', g: 'm' }, ... },                  people: name, m or f (d: true, passed away)
       f: { f2: { a: 'p3', b: 'p4', k: ['p1', 'p5'] }, ... },   families: husband, wife, children eldest first
                                                               (x: true, divorced)
       fn: 'القناعي',                                          the family name (left out when not given)
       h: ['خالد', 'سارة'],                                     who helped finish it: names of people whose
                                                               suggestions the owner added (left out when none)
       o: { hideF: true } }                                    settings (left out when none is on)
   A family can be missing its husband or wife (not added yet). Brothers and sisters whose parents
   aren't added yet share a family with neither. A man can have up to four wives: his families are in
   the order he married them (their ids' order). */
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

  // «ساعدوني بإتمام هذه الشجرة»: up to 30 names, each once, in the order they helped.
  var MAXH = 30;
  function helpers(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      var n = typeof x === 'string' ? cleanName(x) : '';
      if (n && out.indexOf(n) < 0 && out.length < MAXH) out.push(n);
    });
    return out;
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
        if (!x.a || !x.b) delete x.x;
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
      if (x.d === true) p[id].d = true;
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
      if (x.x === true && a && b) f[id].x = true;
      n = Math.max(n, num(id));
    });
    var doc = { v: 1, me: raw.me, n: Math.max(n, Math.floor(+raw.n) || 0), p: p, f: f };
    var fn = typeof raw.fn === 'string' ? cleanFam(raw.fn) : '';
    if (fn) doc.fn = fn;
    var h = helpers(raw.h);
    if (h.length) doc.h = h;
    // settings: o.hideF hides girls' and women's names in the shared picture, o.tidy lays it out with «ترتيب»,
    // o.pdfNoQr leaves the «رابط الشجرة كاملة» QR out of the PDF
    if (raw.o && typeof raw.o === 'object') {
      var o = {};
      if (raw.o.hideF === true) o.hideF = true;
      if (raw.o.tidy === true) o.tidy = true;
      if (raw.o.pdfNoQr === true) o.pdfNoQr = true;
      if (Object.keys(o).length) doc.o = o;
    }
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
      if (!x.a || !x.b) delete x.x;
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

  /* ---------- Marriages ---------- */

  var MAX_WIVES = 4;
  var ORD = ['', 'الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

  // A man's families with his wives, in the order he married them.
  function wivesOf(doc, idx, pid) {
    return (idx.unions[pid] || []).filter(function (fid) { var x = doc.f[fid]; return x.a === pid && !!x.b; });
  }

  // A man can have up to four wives at a time and a woman one husband: a divorce frees the place.
  function canMarry(doc, idx, pid) {
    var p = doc.p[pid];
    if (!p) return false;
    var now = (idx.unions[pid] || []).filter(function (fid) { var x = doc.f[fid]; return x.a && x.b && !x.x; }).length;
    return now < (p.g === 'f' ? 1 : MAX_WIVES);
  }

  // The family that makes her a wife among his wives (the one with the most wives when she has had two husbands).
  function wifeIn(doc, idx, pid) {
    var best = null, most = 0;
    (idx.unions[pid] || []).forEach(function (fid) {
      var x = doc.f[fid], n = x.b === pid && x.a ? wivesOf(doc, idx, x.a).length : 0;
      if (n > most) { most = n; best = fid; }
    });
    return best;
  }

  // Moves a wife one place among his wives. dir -1 = married earlier. (The two families swap their ids.)
  function moveWife(doc, fid, dir) {
    var x = doc.f[fid];
    if (!x || !x.a || !x.b) return false;
    var ws = wivesOf(doc, index(doc), x.a), i = ws.indexOf(fid), j = i + dir;
    if (i < 0 || j < 0 || j >= ws.length) return false;
    doc.f[fid] = doc.f[ws[j]]; doc.f[ws[j]] = x;
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
  // A half brother or sister on the way (my grandfather's son from his other wife) is said the everyday
  // way, as a brother or sister: «عمي», «ولد عمي», «ولد أخوي». Only my own stay «ولد أبوي», «بنت أمي».
  function relName(path) {
    if (!path) return '';
    if (!path.length) return 'أنا';
    if (path.length === 3 && /^[FM]{3}$/.test(path.join(''))) return KIN.common(path);
    if (path.length > 2) path = path.join('').replace(/[FM]([SD])/g, function (m, c) { return c === 'S' ? 'B' : 'Z'; }).split('');
    return KIN.phrase(path);
  }

  // When what pid is to me ends in a marriage («زوجة عمي»), that family: the one with the person before them.
  function marriageOf(doc, idx, rels, pid) {
    var path = rels[pid], t = path && path[path.length - 1];
    if (t !== 'W' && t !== 'H') return null;
    var before = path.slice(0, -1).join('');
    return (idx.unions[pid] || []).filter(function (fid) {
      var x = doc.f[fid], mate = x.a === pid ? x.b : x.a;
      return !!mate && !!rels[mate] && rels[mate].join('') === before;
    })[0] || null;
  }

  /* What pid is to me, as the tree writes it under their name: relName, and for a husband or wife also
     a divorce («طليقة أخوي», «طليقي») and which wife she is when he has more than one («زوجة عمي الثانية»). */
  function relLabel(doc, idx, rels, pid) {
    var path = rels[pid], fid = path ? marriageOf(doc, idx, rels, pid) : null;
    if (!fid) return relName(path);
    var x = doc.f[fid], wife = path[path.length - 1] === 'W', of = path.slice(0, -1), his = of.length ? ' ' + relName(of) : '';
    if (x.x) return wife ? (his ? 'طليقة' + his : 'طليقتي') : (his ? 'طليق' + his : 'طليقي');
    var ws = wife ? wivesOf(doc, idx, x.a) : [];
    if (ws.length < 2) return relName(path);
    var n = ws.indexOf(fid) + 1;
    return (his ? 'زوجة' + his : 'زوجتي') + ' ' + (ORD[n] || String(n));
  }

  // «الله يرحمه» under the name of someone who has passed away.
  function rip(p) { return p.g === 'f' ? 'الله يرحمها' : 'الله يرحمه'; }

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
  // All of theirs: my father's other wife is the mother of my brothers and sisters.
  function lineUnions(doc, idx) {
    var set = {}, seen = {}, queue = [doc.me];
    (idx.unions[doc.me] || []).forEach(function (fid) { set[fid] = 1; });
    while (queue.length) {
      var pid = queue.shift(), up = idx.parent[pid];
      if (!up || seen[up]) continue;
      seen[up] = set[up] = 1;
      [doc.f[up].a, doc.f[up].b].forEach(function (q) {
        if (!q) return;
        (idx.unions[q] || []).forEach(function (fid) { set[fid] = 1; });
        queue.push(q);
      });
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
     CG: husband to wife, SG: brother to brother, GG: between families, RH: one generation,
     RIP: the line «الله يرحمه» under the relation. */
  var SCREEN = { NW: 92, AV: 54, NH: 112, CG: 14, SG: 10, GG: 26, RH: 158, RIP: 16 };

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
        if (mate && (!line || line[fid])) slot = { pid: mate, kind: 'mate', ex: !!x.x, d: !!doc.p[mate].d };
        else if (!mate && opts.ghosts && (fid === myParents || fid === view.root.fam)) {
          slot = { ghost: { of: fid === myParents ? me : view.root.via, t: x.a ? 'M' : 'F' } };
        }
        parts.push({ fid: fid, slot: slot });
      });
      // own: whose family each group of children is when it is drawn under its mother (or father)
      var row = [], pIdx = 0, groups = [];
      var self = { pid: pid, kind: 'blood', d: !!doc.p[pid].d };
      if (parts.length <= 1) {
        row.push(self);
        if (parts[0] && parts[0].slot) row.push(parts[0].slot);
        if (parts[0]) groups.push({ from: parts[0].slot ? [0, 1] : [0], own: 0, fid: parts[0].fid });
      } else {
        // the first wife on one side of him, the others on his other side in the order he married them
        if (parts[0].slot) { row.push(parts[0].slot); pIdx = 1; }
        row.push(self);
        groups.push({ from: parts[0].slot ? [0, 1] : [pIdx], own: parts[0].slot && !parts[0].slot.ghost ? 0 : pIdx, fid: parts[0].fid });
        parts.slice(1).forEach(function (part) {
          if (!part.slot) { groups.push({ from: [pIdx], own: pIdx, fid: part.fid }); return; }
          row.push(part.slot);
          var i = row.length - 1;
          // a third or fourth wife stands past the second: her children's line starts under her
          groups.push({ from: i - pIdx > 1 ? [i] : [pIdx, i], own: part.slot.ghost ? pIdx : i, fid: part.fid });
        });
      }
      var hidden = 0;
      groups.forEach(function (g) {
        var kids = doc.f[g.fid].k;
        if (opts.collapse && opts.collapse[pid]) { hidden += kids.length; g.kids = []; }
        else g.kids = kids.map(person);
      });
      if (hidden) {
        var had = groups.filter(function (g) { return doc.f[g.fid].k.length; });
        groups = [{ from: had.length === 1 ? had[0].from : [pIdx], kids: [], more: hidden, g: doc.p[pid].g }];
      }
      groups = groups.filter(function (g) { return g.kids.length || g.more; });
      var spread = false;
      if (groups.length > 1) {
        var owners = {};
        groups.forEach(function (g) { owners[g.own] = 1; });
        if (Object.keys(owners).length > 1) {
          // children of more than one wife: each family hangs under its own mother, spread out under them
          spread = true;
          groups.forEach(function (g) { g.from = [g.own]; });
        } else {
          // their mothers aren't drawn (the picture keeps only the marriages on my line): one family under him
          groups = [{ from: [pIdx], own: pIdx, kids: [].concat.apply([], groups.map(function (g) { return g.kids; })) }];
        }
      }
      return { pid: pid, row: row, head: pIdx, groups: groups, spread: spread };
    }

    var r = view.root, top = [], kids;
    // the man at the top is drawn like everyone else, with all his wives and all their children
    // (and so another wife can be added to him)
    if (r.fam && doc.f[r.fam].a) return { root: person(doc.f[r.fam].a), heads: heads };
    if (r.fam) {
      var R = doc.f[r.fam];
      if (R.a) top.push({ pid: R.a, kind: 'top', d: !!doc.p[R.a].d }); else if (opts.ghosts) top.push({ ghost: { of: r.via, t: 'F' } });
      if (R.b) top.push({ pid: R.b, kind: 'top', ex: !!(R.x && R.a), d: !!doc.p[R.b].d }); else if (opts.ghosts) top.push({ ghost: { of: r.via, t: 'M' } });
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

  /* Where the people of a row stand when their children are spread out under them: each one as near
     as they can be to want[i] (where their own children's middle is, or undefined when they have none),
     in order and never closer than D. With y = x - i D the places only have to keep their order: the
     best fit pools the neighbours that are out of order at their average. The ones with no children
     of their own stand evenly between their neighbours. */
  function spreadRow(n, want, D) {
    var pools = [], y = [], i;
    for (i = 0; i < n; i++) {
      if (want[i] == null) continue;
      var p = { v: want[i] - i * D, w: 1, at: [i] };
      while (pools.length && pools[pools.length - 1].v > p.v) {
        var q = pools.pop();
        p = { v: (q.v * q.w + p.v * p.w) / (q.w + p.w), w: q.w + p.w, at: q.at.concat(p.at) };
      }
      pools.push(p);
    }
    pools.forEach(function (p) { p.at.forEach(function (k) { y[k] = p.v; }); });
    var known = [];
    for (i = 0; i < n; i++) if (y[i] != null) known.push(i);
    for (i = 0; i < n; i++) {
      if (y[i] != null) continue;
      var a = null, b = null;
      known.forEach(function (k) { if (k < i) a = k; else if (b === null) b = k; });
      y[i] = a === null ? (b === null ? 0 : y[b]) : b === null ? y[a] : y[a] + (y[b] - y[a]) * (i - a) / (b - a);
    }
    return y.map(function (v, k) { return v + k * D; });
  }

  /* Sizes a block: its width W, where its children start (kx) and where its own person stands (hx).
     A block with the children of more than one wife (spread) also keeps where each one in its row
     stands (sx), everyone from the block's left edge. */
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
    b.kx = (b.W - kidsW) / 2;
    // the middle of each group's children
    var x = b.kx;
    b.groups.forEach(function (g) {
      var hs = [];
      g.kids.forEach(function (k, i) { if (i) x += M.SG; hs.push(x + k.hx); x += k.W; });
      if (g.more) { if (g.kids.length) x += M.SG; hs.push(x + M.NW / 2); x += M.NW; }
      g.mid = (hs[0] + hs[hs.length - 1]) / 2;
      x += M.GG;
    });
    var slot = function (i) { return M.NW / 2 + i * (M.NW + M.CG); };
    if (!b.row.length) b.hx = b.W / 2;
    else if (b.spread) {
      var want = [];
      b.groups.forEach(function (g) { want[g.from[0]] = g.mid; });
      var sx = spreadRow(b.row.length, want, M.NW + M.CG), left = sx[0] - M.NW / 2, right = sx[sx.length - 1] + M.NW / 2;
      if (left < 0) {
        sx = sx.map(function (v) { return v - left; });
        b.kx -= left; b.W -= left; right -= left;
      }
      b.W = Math.max(b.W, right);
      b.sx = sx;
      b.hx = sx[b.head];
    } else {
      var rx = (b.W - b.rowW) / 2;
      if (b.groups.length === 1) {
        // as place puts it: the parents right above the middle of their children
        var off = 0, from = b.groups[0].from;
        from.forEach(function (i) { off += slot(i); });
        off /= from.length || 1;
        rx = Math.max(0, Math.min(b.W - b.rowW, b.groups[0].mid - off));
      }
      b.hx = rx + slot(b.head);
    }
    return b.W;
  }

  /* The marriage lines of a block's row: husband and wife side by side, a second wife on his other
     side, and a third or fourth past her, each joined to the one before her. ex: they are divorced. */
  function pairs(b, at, y, out) {
    b.row.forEach(function (s, i) {
      if (i === b.head) return;
      var j = i < b.head ? i + 1 : i - 1;
      out.links.push({ t: 'pair', x1: at(Math.min(i, j)), x2: at(Math.max(i, j)), y: y, ghost: !!(s.ghost || b.row[b.head].ghost), ex: !!s.ex });
    });
  }

  /* Places a block with its left edge at x0 and its row at y (reading order runs left to right here;
     the drawing mirrors it so the eldest ends up on the right). Fills out.nodes and out.links. */
  function place(b, x0, y, M, out, depth) {
    var flat = !b.row.length, ky = flat ? y : y + M.RH, kdepth = flat ? depth : depth + 1;
    var kx = x0 + b.kx;
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
    if (!b.spread && b.groups.length === 1 && b.groups[0].heads.length) {
      // put the parents right above the middle of their children
      var hs0 = b.groups[0].heads, mid = (hs0[0] + hs0[hs0.length - 1]) / 2;
      var from = b.groups[0].from, off = 0;
      from.forEach(function (i) { off += slotX(0, i); });
      off /= from.length || 1;
      rx = Math.max(x0, Math.min(x0 + b.W - b.rowW, mid - off));
    }
    // a block with the children of more than one wife: each one above her own children (as measured)
    var at = b.spread ? function (i) { return x0 + b.sx[i]; } : function (i) { return slotX(rx, i); };
    b.row.forEach(function (s, i) {
      out.nodes.push({ pid: s.pid || null, kind: s.ghost ? 'ghost' : s.kind, ghost: s.ghost || null, x: at(i), y: y });
    });
    b.headX = at(b.head);
    pairs(b, at, y + M.AV / 2, out);
    // and a line down to their children: from between the two of them, or from under one parent's name
    b.groups.forEach(function (g) {
      if (!g.heads.length) return;
      var ax = 0;
      g.from.forEach(function (i) { ax += at(i); });
      ax /= g.from.length || 1;
      var ghostTop = g.from.length > 0 && g.from.every(function (i) { return b.row[i].ghost; });
      out.links.push({ t: 'kids', ax: ax, ay: y + (g.from.length === 2 ? M.AV / 2 : M.NH + 2 + (b.row[g.from[0]].d ? M.RIP || 0 : 0)), busY: y + M.NH + (M.RH - M.NH) / 2,
        kids: g.heads, ky: ky, ghost: ghostTop });
    });
  }

  /* ---------- «ترتيب»: the tidy layout ---------- */

  /* Brothers and sisters can stand in rows instead of one long line, eldest first, so the tree takes
     the shape of the page instead of running sideways. Each row has its own bar. The line from the
     parents carries on down to the next row through a gap in the middle of the row above: the spine.
     opts.wrap is how wide a row may grow (Infinity: one row each, like the generations layout). */
  var SPINE = 1.6;  // the spine's gap, in M.GG

  /* Where the rows break: as few rows as fit in lim, and of the ways to do that, the one whose rows
     get shorter going down («أصغر شيء ينزل تحت»), then the narrowest and most even. (The spine's gap isn't
     counted, so it doesn't push a child down.) Returns [{ i, j }]. */
  function rowsOf(items, M, lim) {
    var n = items.length;
    var cw = function (i, j) { var w = 0; for (var k = i; k < j; k++) w += items[k].w + (k > i ? M.SG : 0); return w; };
    if (n < 2 || !(lim < Infinity) || cw(0, n) <= lim) return [{ i: 0, j: n }];
    var greedy = [];
    for (var i = 0; i < n;) {
      var j = i + 1;
      while (j < n && cw(i, j + 1) <= lim) j++;
      greedy.push({ i: i, j: j });
      i = j;
    }
    var R = greedy.length, best = null, tries = 0;
    (function cut(i, r, rows) {
      if (++tries > 20000) return;
      if (r === R - 1) {
        if (n - i > 1 && cw(i, n) > lim) return;
        var all = rows.concat({ i: i, j: n }), ws = all.map(function (x) { return cw(x.i, x.j); });
        var down = ws.every(function (w, k) { return !k || w <= ws[k - 1] + 0.5; }) ? 0 : 1;
        var widest = Math.max.apply(null, ws), spread = widest - Math.min.apply(null, ws);
        if (!best || down < best.down || (down === best.down && (widest < best.widest - 0.5 ||
            (widest < best.widest + 0.5 && spread < best.spread - 0.5)))) best = { down: down, widest: widest, spread: spread, rows: all };
        return;
      }
      for (var j = n - (R - 1 - r); j > i; j--) {  // longer rows first, so they win a tie
        if (j - i > 1 && cw(i, j) > lim) continue;
        cut(j, r + 1, rows.concat({ i: i, j: j }));
      }
    })(0, 0, []);
    return best ? best.rows : greedy;
  }

  /* Sizes a block for the tidy layout. Every group of children gets rows; each row's places are kept
     as offsets from the group's spine (g.rows[].x), and the group as how far it reaches either side
     of it (g.L, g.R) and how tall it is (g.H). The block keeps its width W, height H, where its row
     starts (rx), where each group's spine is (spines) and where its own person stands (hx). */
  function measureTidy(b, M, lim) {
    var flat = !b.row.length, gap = M.GG * SPINE;
    b.rowW = flat ? 0 : b.row.length * M.NW + (b.row.length - 1) * M.CG;
    b.groups.forEach(function (g) {
      var items = g.kids.map(function (k) { measureTidy(k, M, lim); return { b: k, w: k.W, h: k.H, hx: k.hx }; });
      if (g.more) items.push({ more: true, w: M.NW, h: M.NH, hx: M.NW / 2 });
      var rows = rowsOf(items, M, lim), L = 0, R = 0, H = 0;
      rows.forEach(function (r, ri) {
        var its = items.slice(r.i, r.j), pos = [], x = 0, last = ri === rows.length - 1;
        its.forEach(function (it, k) { if (k) x += M.SG; pos.push(x); x += it.w; });
        if (last) {
          // the bar's middle under the spine
          var mid = (pos[0] + its[0].hx + pos[its.length - 1] + its[its.length - 1].hx) / 2;
          r.x = pos.map(function (p) { return p - mid; });
        } else {
          // the spine passes between the two halves; the eldest side takes the extra one
          var best = null;
          for (var s = its.length; s >= 0; s--) {
            var le = s ? pos[s - 1] + its[s - 1].w + gap / 2 : 0, re = s < its.length ? x - pos[s] + gap / 2 : 0;
            if (!best || Math.abs(le - re) < best.d - 0.5) best = { s: s, d: Math.abs(le - re), le: le };
          }
          r.x = pos.map(function (p, k) { return k < best.s ? p - best.le : p - (best.s < its.length ? pos[best.s] : x) + gap / 2; });
        }
        r.items = its;
        r.h = Math.max.apply(null, its.map(function (it) { return it.h; }));
        L = Math.max(L, -r.x[0]);
        R = Math.max(R, r.x[its.length - 1] + its[its.length - 1].w);
        H += (ri ? M.RH - M.NH : 0) + r.h;
      });
      g.rows = rows; g.L = L; g.R = R; g.W = L + R; g.H = H;
    });
    var slot = function (i) { return M.NW / 2 + i * (M.NW + M.CG); };
    b.spines = [];
    if (!b.groups.length) {
      b.W = b.rowW; b.rx = 0;
    } else if (b.groups.length === 1) {
      // the parents right above the spine, so the line drops straight down
      var g = b.groups[0], a = 0;
      g.from.forEach(function (i) { a += slot(i); });
      a = flat ? 0 : a / (g.from.length || 1);
      var left = Math.max(flat ? 0 : a, g.L), right = Math.max(flat ? 0 : b.rowW - a, g.R);
      b.W = left + right; b.rx = left - a; b.spines.push(left);
    } else {
      // the children of more than one wife: their families side by side, each mother right above her
      // own family's spine (as in measure)
      var kidsW = 0, want = [];
      b.groups.forEach(function (g2, n) { kidsW += g2.W + (n ? M.GG : 0); });
      b.W = Math.max(b.rowW, kidsW); b.rx = (b.W - b.rowW) / 2;
      var gx = (b.W - kidsW) / 2;
      b.groups.forEach(function (g2) { b.spines.push(gx + g2.L); want[g2.from[0]] = gx + g2.L; gx += g2.W + M.GG; });
      if (b.spread) {
        var sx = spreadRow(b.row.length, want, M.NW + M.CG), lo = sx[0] - M.NW / 2, hi = sx[sx.length - 1] + M.NW / 2;
        if (lo < 0) {
          sx = sx.map(function (v) { return v - lo; });
          b.spines = b.spines.map(function (v) { return v - lo; });
          b.W -= lo; hi -= lo;
        }
        b.W = Math.max(b.W, hi);
        b.sx = sx;
      }
    }
    var kidsH = 0;
    b.groups.forEach(function (g2) { kidsH = Math.max(kidsH, g2.H); });
    b.H = flat ? kidsH : b.groups.length ? M.RH + kidsH : M.NH;
    b.hx = flat ? b.W / 2 : b.sx ? b.sx[b.head] : b.rx + slot(b.head);
    return b.W;
  }

  // Places a block measured by measureTidy with its left edge at x0 and its row at y.
  function placeTidy(b, x0, y, M, out, depth) {
    var flat = !b.row.length, ky = flat ? y : y + M.RH, kdepth = flat ? depth : depth + 1, gapY = M.RH - M.NH;
    var slotX = b.sx ? function (i) { return x0 + b.sx[i]; } : function (i) { return x0 + b.rx + M.NW / 2 + i * (M.NW + M.CG); };
    out.depth = Math.max(out.depth, depth);
    b.row.forEach(function (s, i) {
      out.nodes.push({ pid: s.pid || null, kind: s.ghost ? 'ghost' : s.kind, ghost: s.ghost || null, x: slotX(i), y: y });
    });
    pairs(b, slotX, y + M.AV / 2, out);
    b.groups.forEach(function (g, gi) {
      var sx = x0 + b.spines[gi], ty = ky, rows = [], count = 0;
      g.rows.forEach(function (r) {
        var heads = [];
        r.items.forEach(function (it, k) {
          var ix = sx + r.x[k];
          if (it.more) {
            out.nodes.push({ more: g.more, g: g.g, x: ix + M.NW / 2, y: ty });
            out.depth = Math.max(out.depth, kdepth);
          } else placeTidy(it.b, ix, ty, M, out, kdepth);
          heads.push(ix + it.hx);
          count++;
        });
        rows.push({ busY: ty - gapY / 2, kids: heads, ky: ty });
        ty += r.h + gapY;
      });
      if (flat && count < 2) return;
      var ax = sx, ay = rows[0].busY;
      if (!flat) {
        ax = 0;
        g.from.forEach(function (i) { ax += slotX(i); });
        ax /= g.from.length || 1;
        ay = y + (g.from.length === 2 ? M.AV / 2 : M.NH + 2 + (b.row[g.from[0]].d ? M.RIP || 0 : 0));
      }
      var ghostTop = !flat && g.from.length > 0 && g.from.every(function (i) { return b.row[i].ghost; });
      out.links.push({ t: 'kids', ax: ax, ay: ay, sx: sx, rows: rows, busY: rows[0].busY, kids: rows[0].kids, ky: rows[0].ky, ghost: ghostTop });
    });
  }

  // Everything needed to draw one view at sizes M: nodes and lines, in a W x H box, eldest on the right.
  function layout(doc, idx, view, M, opts) {
    var bl = blocks(doc, idx, view, opts), out = { nodes: [], links: [], depth: 0 }, R = bl.root, W, H;
    var many = !R.row.length && R.groups[0] && R.groups[0].kids.length + (R.groups[0].more ? 1 : 0) > 1;
    var top = many ? (M.RH - M.NH) / 2 : 0;
    if (opts.wrap) {
      measureTidy(R, M, opts.wrap);
      placeTidy(R, 0, top, M, out, 0);
      W = R.W; H = top + R.H;
    } else {
      measure(R, M);
      place(R, 0, top, M, out, 0);
      W = R.W; H = top + out.depth * M.RH + M.NH;
    }
    var X = function (x) { return W - x; };
    out.nodes.forEach(function (n) { n.x = X(n.x); });
    out.links.forEach(function (l) {
      if (l.t === 'pair') { var a = X(l.x1), b = X(l.x2); l.x1 = Math.min(a, b); l.x2 = Math.max(a, b); return; }
      l.ax = X(l.ax);
      if (l.rows) {
        l.sx = X(l.sx);
        l.rows = l.rows.map(function (r) { return { busY: r.busY, kids: r.kids.map(X), ky: r.ky }; });
        l.kids = l.rows[0].kids;
      } else l.kids = l.kids.map(X);
    });
    out.W = W; out.H = H; out.heads = bl.heads; out.levels = out.depth + 1; out.tidy = !!opts.wrap;
    return out;
  }

  /* The tidy layout that shows a view biggest in a boxW x boxH box, no bigger than maxS: rows are
     tried narrower and narrower and the best kept (the widest of the equals, so a tree that already
     fits stays as it is). Returns { L, s }. */
  function fitLayout(doc, idx, view, M, opts, boxW, boxH, maxS) {
    var o = {}, k;
    for (k in opts) o[k] = opts[k];
    o.wrap = Infinity;
    var L = layout(doc, idx, view, M, o), best = { L: L, s: Math.min(boxW / L.W, boxH / L.H, maxS) }, lim = L.W;
    for (var i = 0; i < 48 && lim > M.NW * 1.5; i++) {
      lim *= 0.9;
      o.wrap = lim;
      L = layout(doc, idx, view, M, o);
      var s = Math.min(boxW / L.W, boxH / L.H, maxS);
      if (s > best.s * 1.0001) best = { L: L, s: s };
    }
    return best;
  }

  // Who can be added to a person, so that everyone added still shows on one of the views.
  function choices(doc, idx, pid, line, heads) {
    var p = doc.p[pid], parent = idx.parent[pid], fam = parent ? doc.f[parent] : null, out = [];
    if (fam ? !fam.a : line[pid]) out.push('F');
    if (fam ? !fam.b : line[pid]) out.push('M');
    if ((heads[pid] || line[pid]) && (fam || line[pid])) out.push('B', 'Z');
    if (heads[pid] && canMarry(doc, idx, pid)) out.push(p.g === 'f' ? 'H' : 'W');
    out.push('S', 'D');
    return out;
  }

  // Everyone drawn as the head of a family on some view (they can have a husband or wife added).
  function allHeads(doc, idx) {
    var heads = {};
    views(doc, idx).forEach(function (v) {
      var L = layout(doc, idx, v, SCREEN, { ghosts: false, mates: 'all' });
      Object.keys(L.heads).forEach(function (k) { heads[k] = 1; });
    });
    return heads;
  }

  // Can a t (F M B Z S D H W) be added to pid, and still show on one of the views?
  function canAdd(doc, idx, pid, t) {
    return !!doc.p[pid] && choices(doc, idx, pid, lineSet(doc, idx), allHeads(doc, idx)).indexOf(t) >= 0;
  }

  /* Who in the tree is pid's t, in the finder's steps: his father, her brothers, their daughters...
     eldest first. The finder shows them by name («أخوي (خالد)»). */
  function kinOf(doc, idx, pid, t) {
    if (!doc.p[pid]) return [];
    var fam = idx.parent[pid], x = fam ? doc.f[fam] : null, unions = idx.unions[pid] || [], out = [];
    var g = /[FBSH]/.test(t) ? 'm' : 'f';
    if (t === 'F') return x && x.a ? [x.a] : [];
    if (t === 'M') return x && x.b ? [x.b] : [];
    if (t === 'B' || t === 'Z') return x ? x.k.filter(function (c) { return c !== pid && doc.p[c].g === g; }) : [];
    unions.forEach(function (fid) {
      var y = doc.f[fid];
      if (t === 'H' || t === 'W') {
        var m = y.a === pid ? y.b : y.a;
        if (m && doc.p[m].g === g) out.push(m);
      } else if (t === 'S' || t === 'D') {
        y.k.forEach(function (c) { if (doc.p[c].g === g) out.push(c); });
      }
    });
    return out;
  }

  /* Puts a walk from the finder into the tree: steps [{ t: 'F', pid: 'p3' or null }, ...] from me.
     A step with a pid is someone already in the tree; the others add a new person, without a name
     but the last, who gets `name`. Works on a copy: returns { doc, pid, added } or, when a step
     can't go on the tree, null. pids: who each step ended up at. */
  function addWalk(doc, steps, name) {
    var d = copy(doc), cur = d.me, prev = null, added = [], pids = [];
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i], idx = index(d), last = i === steps.length - 1;
      if (s.pid && kinOf(d, idx, cur, s.t).indexOf(s.pid) >= 0) { prev = cur; cur = s.pid; pids.push(cur); continue; }
      if (!canAdd(d, idx, cur, s.t)) return null;
      // a child of someone just reached through a marriage belongs to that marriage
      var fid = null;
      if ((s.t === 'S' || s.t === 'D') && (idx.unions[cur] || []).length > 1) {
        fid = (idx.unions[cur] || []).filter(function (u) { return d.f[u].a === prev || d.f[u].b === prev; })[0] || idx.unions[cur][0];
      }
      var np = addRelative(d, cur, s.t, last ? name : '', fid);
      if (!np) return null;
      added.push(np); pids.push(np);
      prev = cur; cur = np;
    }
    return { doc: d, pid: cur, added: added, pids: pids };
  }

  /* ---------- «اقترح إضافة»: additions suggested through the tree's link ---------- */

  /* A suggestion is the steps its sender took on a copy of the tree, in order:
       [{ id: 'p57', of: 'p3', t: 'S', n: 'سعود', mate: 'p9' }, ...]
     add a t (F M B Z S D H W) of person `of`, named n. id names the new person so a later step can build
     on them (of or mate can be an earlier step's id); mate picks which marriage a child belongs to
     (null: the one without a husband or wife). */
  var STEP = /^[FMBZSDHW]$/;
  function cleanSteps(ops) {
    var out = [], ids = {};
    (Array.isArray(ops) ? ops : []).forEach(function (op) {
      if (out.length >= 100 || !op || typeof op !== 'object') return;
      var id = String(op.id || ''), of = String(op.of || ''), mate = op.mate == null ? null : String(op.mate);
      if (!/^p\d{1,6}$/.test(id) || ids[id] || !/^p\d{1,6}$/.test(of) || !STEP.test(op.t)) return;
      if (mate && !/^p\d{1,6}$/.test(mate)) mate = null;
      var n = cleanName(op.n);
      if (!n) return;
      ids[id] = 1;
      out.push({ id: id, of: of, t: op.t, n: n, mate: mate });
    });
    return out;
  }

  // The steps a step stands on: the earlier steps that added its person or its marriage's other parent.
  function stepNeeds(ops, op) {
    var ids = ops.map(function (o) { return o.id; });
    return [op.of, op.mate].filter(function (x) { return x && ids.indexOf(x) >= 0 && x !== op.id; });
  }

  /* Puts the steps whose ids are in pick (all of them when pick is missing) on a copy of doc, as it is
     now. A step whose person is gone, or that no longer fits on the tree, is left out, and so are the
     steps built on it. Returns { doc, map: { stepId: new id in doc }, done: [stepIds], left: [stepIds] }. */
  function replay(doc, ops, pick) {
    var d = copy(doc), steps = cleanSteps(ops), stepIds = {}, map = {}, done = [], left = [];
    steps.forEach(function (op) { stepIds[op.id] = 1; });
    function who(x) { return !x ? null : stepIds[x] ? (map[x] || false) : (d.p[x] ? x : false); }
    steps.forEach(function (op) {
      if (pick && pick.indexOf(op.id) < 0) return;
      var of = who(op.of), mate = op.mate ? who(op.mate) : null, np = null;
      if (of && mate !== false) {
        var idx = index(d);
        if (canAdd(d, idx, of, op.t)) {
          var fid = null;
          if (op.t === 'S' || op.t === 'D') {
            var us = idx.unions[of] || [];
            fid = us.filter(function (u) { var x = d.f[u]; return mate ? (x.a === mate || x.b === mate) : !(x.a && x.b); })[0] || null;
            if (!fid && us.length > 1) fid = us[0];
            if (!fid && mate && us.length === 1) fid = us[0];
          }
          np = addRelative(d, of, op.t, op.n, fid);
        }
      }
      if (np) { map[op.id] = np; done.push(op.id); } else left.push(op.id);
    });
    return { doc: d, map: map, done: done, left: left };
  }

  /* What each step would add, for the owner to pick from: [{ id, n, rel, needs }] (rel: what the new
     person is to the owner, «ولد عمي»; '' when the step no longer fits). */
  function describeSteps(doc, ops) {
    var steps = cleanSteps(ops), r = replay(doc, steps), idx = index(r.doc), rels = relations(r.doc, idx);
    return steps.map(function (op) {
      var id = r.map[op.id];
      return { id: op.id, n: op.n, rel: id ? relLabel(r.doc, idx, rels, id) : '', needs: stepNeeds(steps, op) };
    });
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

  /* A line through points that only go across or down, turning with round corners of size R (smaller
     where the pieces are short). Same steps as kidLines. */
  function roundLine(pts, R) {
    var p = [];
    pts.forEach(function (q) {
      var n = p.length;
      if (n && Math.abs(q[0] - p[n - 1][0]) < 1 && Math.abs(q[1] - p[n - 1][1]) < 1) return;
      if (n > 1) {
        var a = p[n - 2], b = p[n - 1];
        if ((Math.abs(a[0] - b[0]) < 1 && Math.abs(b[0] - q[0]) < 1) || (Math.abs(a[1] - b[1]) < 1 && Math.abs(b[1] - q[1]) < 1)) { p[n - 1] = q; return; }
      }
      p.push(q);
    });
    var out = [['M', p[0][0], p[0][1]]], len = function (a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); };
    for (var i = 1; i < p.length - 1; i++) {
      var a = p[i - 1], b = p[i], c = p[i + 1];
      var l1 = len(a, b), l2 = len(b, c);
      var r = Math.max(0, Math.min(R, i > 1 ? l1 / 2 : l1, i < p.length - 2 ? l2 / 2 : l2));
      var u = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], v = [(c[0] - b[0]) / l2, (c[1] - b[1]) / l2];
      out.push(['L', b[0] - u[0] * r, b[1] - u[1] * r]);
      if (r > 0) out.push(['Q', b[0], b[1], b[0] + v[0] * r, b[1] + v[1] * r]);
    }
    if (p.length > 1) out.push(['L', p[p.length - 1][0], p[p.length - 1][1]]);
    return out;
  }

  /* The lines of one 'kids' link, ready to draw: X and Y turn layout places into drawing places, and
     each child's line stops cut short of their circle. A tidy link with rows goes down the spine:
     to the first bar, along it to the spine, down to its own bar, then to the child. */
  function linkLines(l, R, cut, X, Y) {
    X = X || function (v) { return v; };
    Y = Y || function (v) { return v; };
    if (!l.rows) return kidLines(X(l.ax), Y(l.ay), Y(l.busY), l.kids.map(X), Y(l.ky) - cut, R);
    var ax = X(l.ax), ay = Y(l.ay), sx = X(l.sx), b0 = Y(l.rows[0].busY), out = [];
    l.rows.forEach(function (r, ri) {
      var busY = Y(r.busY), ky = Y(r.ky) - cut;
      r.kids.forEach(function (k) {
        var kx = X(k), pts = [[ax, ay]];
        if (ri) pts.push([ax, b0], [sx, b0], [sx, busY]);
        else pts.push([ax, busY]);
        pts.push([kx, busY], [kx, ky]);
        out = out.concat(roundLine(pts, R));
      });
    });
    return out;
  }

  /* The two short strokes across the line between a divorced husband and wife, at its middle:
     [[x1, y1, x2, y2], ...]. h is half their height. */
  function exMark(x1, x2, y, h) {
    var cx = (x1 + x2) / 2, d = h * 0.45;
    return [-1, 1].map(function (k) { var x = cx + k * h * 0.42; return [x - d, y + h, x + d, y - h]; });
  }

  var TREE = {
    blank: blank, clean: clean, cleanFam: cleanFam, famTitle: famTitle, copy: copy, index: index, count: count, addRelative: addRelative, rename: rename,
    removePerson: removePerson, move: move, relations: relations, relName: relName, views: views, climb: climb,
    lineSet: lineSet, lineUnions: lineUnions, layout: layout, choices: choices, kidLines: kidLines, SCREEN: SCREEN,
    allHeads: allHeads, canAdd: canAdd, kinOf: kinOf, addWalk: addWalk, fitLayout: fitLayout, linkLines: linkLines, rowsOf: rowsOf,
    canMarry: canMarry, wivesOf: wivesOf, wifeIn: wifeIn, moveWife: moveWife, relLabel: relLabel, marriageOf: marriageOf,
    spreadRow: spreadRow, exMark: exMark, rip: rip, cleanName: cleanName, helpers: helpers,
    cleanSteps: cleanSteps, stepNeeds: stepNeeds, replay: replay, describeSteps: describeSteps, thanksLine: thanksLine
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TREE;
  root.TREE = TREE;
  if (typeof document === 'undefined') return;

  /* ---------- Picture (story 1080 x 1920, post 1080 x 1350) and the A4 page ---------- */

  var PIC = { NW: 150, AV: 96, NH: 196, CG: 18, SG: 16, GG: 40, RH: 270, RIP: 32 };
  /* qr: when the picture leaves people out and the tree has a «رابط الشجرة كاملة», the box gets shorter
     (boxH) and one panel takes the sticker's place, its middle at y: the code (qr wide) on its left, and
     «امسح الكود» / «وشوف الشجرة كاملة» over the shorbaka.com mark on its right (see drawQrPanel). */
  var PICFMT = {
    story: { title: 120, titleY: 300, sub: 46, subY: 384, boxY: 470, boxH: 1000, boxW: 960,
      qr: { boxH: 885, y: 1521, qr: 214, pad: 24, gap: 34, r: 40, t1: 46, t2: 36, t3: 34, mark: 46, t4: 28, foot: 59, open: { boxH: 940, y: 1580 } } },
    post: { title: 92, titleY: 168, sub: 38, subY: 232, boxY: 292, boxH: 812, boxW: 960,
      qr: { boxH: 722, y: 1146, qr: 172, pad: 20, gap: 28, r: 34, t1: 38, t2: 30, t3: 28, mark: 38, t4: 24, foot: 50, open: { boxH: 770, y: 1196 } } }
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

  /* Fits a view into a boxW x boxH box at the picture's sizes. When it would come out smaller than
     minS, the children of the families furthest from me fold into a count («+٤ عياله»), the most
     distant relatives first, until it fits. tidy: laid out with «ترتيب». */
  function pictureLayout(doc, idx, view, boxW, boxH, tidy, minS, maxS) {
    minS = minS || MIN_SCALE; maxS = maxS || MAX_SCALE;
    var collapse = {}, keep = mineUp(doc, idx), rels = relations(doc, idx), L, s;
    var kidsOf = function (pid) {
      var k = [];
      (idx.unions[pid] || []).forEach(function (fid) { k = k.concat(doc.f[fid].k); });
      return k;
    };
    for (var round = 0; round < 400; round++) {
      var o = { ghosts: false, mates: 'line', collapse: collapse };
      if (tidy) { var f = fitLayout(doc, idx, view, PIC, o, boxW, boxH, maxS); L = f.L; s = f.s; }
      else { L = layout(doc, idx, view, PIC, o); s = Math.min(boxW / L.W, boxH / L.H, maxS); }
      if (s >= minS) break;
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
    return { L: L, s: s, folded: Object.keys(collapse).length > 0 };
  }

  // Does this view show any girl or woman? (The switch that hides their names only shows when it does.)
  function viewHasF(doc, viewKey) {
    var idx = index(doc), vs = views(doc, idx), view = vs.filter(function (v) { return v.key === viewKey; })[0] || vs[0];
    return layout(doc, idx, view, PIC, { ghosts: false, mates: 'line' }).nodes.some(function (n) {
      return n.pid && doc.p[n.pid] && doc.p[n.pid].g === 'f';
    });
  }

  // A small pearl, drawn where a hidden name's first letter would be.
  function pearl(ctx, cx, cy, pr, dark) {
    if (dark) ctx.fillStyle = '#0E2A47';
    else {
      var g = ctx.createRadialGradient(cx - pr * 0.35, cy - pr * 0.4, pr * 0.05, cx, cy, pr);
      g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, '#F4EFE6'); g.addColorStop(1, '#C9BCA8');
      ctx.fillStyle = g;
    }
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
  }

  /* The colours of a tree drawing: on the navy sea of a story, or on the white of a printed page.
     min: the smallest sizes in pixels on a story (fitName, fitRel: how far a long name may shrink). */
  var INK = {
    sea: { line: 'rgba(244, 239, 230, 0.4)', boy: '#2EC4B6', girl: '#FF8A80', me: '#E9C46A', more: 'rgba(244, 239, 230, 0.45)',
      fill: '#12385E', meFill: '#F4EFE6', letter: '#F4EFE6', meLetter: '#0E2A47', name: '#F4EFE6', moreName: '#9DB2C8',
      rel: '#E9C46A', meRel: '#F4EFE6', rip: 'rgba(244, 239, 230, 0.66)', relSize: 25, min: { line: 2.5, ring: 4, name: 22, rel: 18, gap: 26, fitName: 16, fitRel: 14 } },
    paper: { line: '#BFCAD6', boy: '#1FAFA2', girl: '#F0796D', me: '#D9AE45', more: '#A9B7C6',
      fill: '#FFFFFF', meFill: '#0E2A47', letter: '#0E2A47', meLetter: '#FFFFFF', name: '#0E2A47', moreName: '#6C8096',
      rel: '#A3801F', meRel: '#0E2A47', rip: '#6C8096', relSize: 27, min: { line: 0, ring: 0, name: 0, rel: 0, gap: 0, fitName: 0, fitRel: 0 } }
  };

  /* Draws the people and lines of L, a layout at the picture's sizes: X and Y place it, s is its scale.
     hideF: girls and women show what they are to me («أختي») instead of their name, and a pearl
     instead of their first letter. Under someone who has passed away: «الله يرحمه». */
  function drawTree(ctx, doc, rels, L, X, Y, s, ink, hideF) {
    var D = KIN.draw, m = ink.min, AV = PIC.AV * s, NW = PIC.NW * s, r = AV / 2, ring = Math.max(m.ring, 6 * s), idx = index(doc);
    ctx.save();
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ink.line; ctx.lineWidth = Math.max(m.line, 3.5 * s);
    L.links.forEach(function (l) {
      ctx.beginPath();
      if (l.t === 'pair') {
        ctx.moveTo(X(l.x1) + r + ring, Y(l.y)); ctx.lineTo(X(l.x2) - r - ring, Y(l.y));
        if (l.ex) exMark(X(l.x1), X(l.x2), Y(l.y), Math.max(m.ring * 1.6, 11 * s)).forEach(function (q) { ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); });
      } else {
        linkLines(l, 24 * s, ring, X, Y).forEach(function (c) {
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
      var col = isMe ? ink.me : n.more ? ink.more : doc.p[n.pid].g === 'f' ? ink.girl : ink.boy;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = isMe ? ink.meFill : ink.fill; ctx.fill();
      ctx.lineWidth = ring; ctx.strokeStyle = col;
      if (n.more) ctx.setLineDash([ring * 1.6, ring * 1.4]);
      ctx.stroke();
      ctx.setLineDash([]);
      var hidden = !n.more && hideF && doc.p[n.pid].g === 'f', nameless = !n.more && !doc.p[n.pid].n;
      if (hidden) pearl(ctx, cx, cy, r * 0.3, isMe && ink.meFill === '#F4EFE6');
      else {
        var top = n.more ? '+' + n.more : initial(doc.p[n.pid].n);
        ctx.fillStyle = isMe ? ink.meLetter : ink.letter;
        D.setFont(ctx, '700', Math.round(AV * (n.more ? 0.36 : 0.42)));
        var mt = ctx.measureText(top), ink2 = (mt.actualBoundingBoxAscent || AV * 0.3) - (mt.actualBoundingBoxDescent || 0);
        ctx.direction = n.more ? 'ltr' : 'rtl';  // «+3», not «3+»
        ctx.fillText(top, cx, cy + ink2 / 2);
        ctx.direction = 'rtl';
      }

      var name = n.more ? (n.g === 'f' ? 'عيالها' : 'عياله') : hidden || nameless ? relLabel(doc, idx, rels, n.pid) : doc.p[n.pid].n;
      var ny = Y(n.y) + AV + 22 * s + 34 * s, gap = Math.max(m.gap, 36 * s);
      ctx.fillStyle = n.more ? ink.moreName : ink.name;
      D.fit(ctx, name, n.more ? '500' : '700', Math.round(Math.max(m.name, 34 * s)), NW + 6, m.fitName || 17 * s);
      ctx.fillText(name, cx, ny);
      if (!n.more && !hidden && !nameless) {
        var rel = relLabel(doc, idx, rels, n.pid);
        ny += gap;
        ctx.fillStyle = isMe ? ink.meRel : ink.rel;
        D.fit(ctx, rel, '500', Math.round(Math.max(m.rel, ink.relSize * s)), NW + 6, m.fitRel || ink.relSize * s * 0.55);
        ctx.fillText(rel, cx, ny);
      }
      if (!n.more && doc.p[n.pid].d) {
        ctx.fillStyle = ink.rip;
        D.fit(ctx, rip(doc.p[n.pid]), '500', Math.round(Math.max(m.rel * 0.9, ink.relSize * s * 0.84)), NW + 6, m.fitRel || ink.relSize * s * 0.5);
        ctx.fillText(rip(doc.p[n.pid]), cx, ny + gap * 0.86);
      }
    });
    ctx.restore();
  }

  function fontSample(doc, rels, more) {
    var idx = index(doc);
    return famTitle(doc) + ' أهل أبوي أمي عياله عيالها الله يرحمه يرحمها +0123456789 ' + GENS.join(' ') + ' ' + (more || '') + ' ' +
      Object.keys(doc.p).map(function (id) { return doc.p[id].n + ' ' + relLabel(doc, idx, rels, id); }).join(' ');
  }

  /* ---------- QR codes: the «رابط الشجرة كاملة» in the pictures and on the page ---------- */

  var QR_JS = '/vendor/qrcode-generator-2.0.4.js', qrLoading = null;
  function loadQr() {
    if (root.qrcode) return Promise.resolve(root.qrcode);
    if (!qrLoading) {
      qrLoading = new Promise(function (resolve, reject) {
        var sc = document.createElement('script');
        sc.src = QR_JS; sc.async = true;
        sc.onload = function () { if (root.qrcode) resolve(root.qrcode); else reject(new Error('no qrcode')); };
        sc.onerror = function () { qrLoading = null; sc.remove(); reject(new Error('could not load ' + QR_JS)); };
        document.head.appendChild(sc);
      });
    }
    return qrLoading;
  }

  // The squares of a QR code for text: n x n, dark(row, col).
  function qrOf(qrcode, text) {
    var q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return { n: q.getModuleCount(), dark: function (r, c) { return q.isDark(r, c); } };
  }

  // The code as an SVG (navy squares, no background), for the page.
  function qrSvg(q) {
    var d = '';
    for (var r = 0; r < q.n; r++) for (var c = 0; c < q.n; c++) if (q.dark(r, c)) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    return '<svg xmlns="' + NS + '" viewBox="0 0 ' + q.n + ' ' + q.n + '" shape-rendering="crispEdges" role="img" aria-label="QR"><path fill="#0E2A47" d="' + d + '"/></svg>';
  }

  // The squares of the code in navy, size wide at (x, y), leaving a quiet edge inside it.
  function drawQrCode(ctx, q, x, y, size, ink) {
    var cell = Math.floor(size / (q.n + 4)), w = cell * q.n, x0 = Math.round(x + (size - w) / 2), y0 = Math.round(y + (size - w) / 2);
    ctx.fillStyle = ink || '#0E2A47';
    for (var r = 0; r < q.n; r++) for (var c = 0; c < q.n; c++) if (q.dark(r, c)) ctx.fillRect(x0 + c * cell, y0 + r * cell, cell, cell);
  }

  /* The foot of a story or post that leaves people out: one see-through panel like the shorbaka.com
     sticker. Its top row, centred on (540, Z.y): the code on the left on a soft pearl (not white, so
     it doesn't glare on the navy), and on the right «امسح الكود» / «وشوف الشجرة كاملة» over the mark
     and shorbaka.com. Under them, in small print, who to take the password from (pwText). */
  var QR_WORDS = ['امسح الكود', 'وشوف الشجرة كاملة'], QR_BG = '#D9D1C1';
  function drawQrPanel(ctx, q, Z, pwText) {
    var D = KIN.draw, k = Z.qr / 214, mw = Z.mark * 102 / 72, mg = Math.round(12 * k);
    ctx.save();
    ctx.direction = 'rtl';
    D.setFont(ctx, '700', Z.t1); var w1 = ctx.measureText(QR_WORDS[0]).width;
    D.setFont(ctx, '500', Z.t2); var w2 = ctx.measureText(QR_WORDS[1]).width;
    D.setFont(ctx, '500', Z.t4); var w4 = pwText ? ctx.measureText(pwText).width : 0;
    ctx.direction = 'ltr';
    D.setFont(ctx, '500', Z.t3); var m3 = ctx.measureText(STICKER_LABEL), w3 = mw + mg + m3.width;
    var tw = Math.max(w1, w2, w3), top = Z.qr + 2 * Z.pad, H = top + (pwText ? Z.foot : 0);
    var W = Math.round(Math.min(1000, Math.max(Z.pad + Z.qr + Z.gap + tw + Z.pad * 1.4, w4 + Z.pad * 3)));
    var x0 = Math.round(540 - W / 2), y0 = Math.round(Z.y - top / 2), right = x0 + W - Z.pad * 1.4;
    D.roundRect(ctx, x0, y0, W, H, Z.r);
    ctx.fillStyle = 'rgba(244, 239, 230, 0.07)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244, 239, 230, 0.2)'; ctx.stroke();

    // the small print under a thin line: «خذ الباسورد من علي» (none when the link needs no password)
    if (pwText) {
      var yd = y0 + top;
      ctx.beginPath(); ctx.moveTo(x0 + Z.pad, yd); ctx.lineTo(x0 + W - Z.pad, yd);
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244, 239, 230, 0.14)'; ctx.stroke();
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(244, 239, 230, 0.8)';
      D.fit(ctx, pwText, '500', Z.t4, W - Z.pad * 2, Math.round(Z.t4 * 0.7));
      ctx.fillText(pwText, x0 + W / 2, yd + Z.foot / 2);
    }

    D.roundRect(ctx, x0 + Z.pad, y0 + Z.pad, Z.qr, Z.qr, Math.round(Z.qr * 0.1));
    ctx.fillStyle = QR_BG; ctx.fill();
    drawQrCode(ctx, q, x0 + Z.pad, y0 + Z.pad, Z.qr);

    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#F4EFE6'; D.setFont(ctx, '700', Z.t1);
    ctx.fillText(QR_WORDS[0], right, Z.y - 50 * k);
    ctx.fillStyle = '#E9C46A'; D.setFont(ctx, '500', Z.t2);
    ctx.fillText(QR_WORDS[1], right, Z.y + 6 * k);
    // the mark and the address, lined up with the words' right edge
    var my = Z.y + 70 * k, ink = (m3.actualBoundingBoxAscent || Z.t3 * 0.72) - (m3.actualBoundingBoxDescent || 0), ux = right - w3;
    D.drawMark(ctx, ux + mw / 2, my, Z.mark, false);
    ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillStyle = '#F4EFE6'; D.setFont(ctx, '500', Z.t3);
    ctx.fillText(STICKER_LABEL, ux + mw + mg, my + ink / 2);
    ctx.restore();
  }
  var STICKER_LABEL = 'shorbaka.com';
  var QR_ASK = 'وعندك إضافة؟ اقترحها';

  // «خالد وسارة ساعدوني بإتمام هذه الشجرة», or '' when nobody's suggestions were added.
  function thanksLine(doc) {
    var h = (doc && doc.h) || [];
    if (!h.length) return '';
    var names = h.length === 1 ? h[0] : h.slice(0, -1).join('، ') + ' و' + h[h.length - 1];
    return names + (h.length === 1 ? ' ساعدني' : ' ساعدوني') + ' بإتمام هذه الشجرة';
  }

  // The panel's sizes and place in a format: a link without a password has no line under the QR.
  function qrZone(F, pwText) {
    if (pwText) return F.qr;
    var Z = {}, k;
    for (k in F.qr) Z[k] = F.qr[k];
    Z.y = F.qr.open.y; Z.boxH = F.qr.open.boxH;
    return Z;
  }

  /* Who the password comes from: me, the one who made the tree and set it («خذ الباسورد من علي»).
     When girls' names are hidden and I'm a girl, my name stays out too. */
  function pwFrom(doc, hideF) {
    var me = (doc && doc.p[doc.me]) || {}, f = me.g === 'f', name = hideF && f ? '' : String(me.n || '').trim();
    return 'خذ الباسورد من ' + (name || (f ? 'صاحبة الشجرة' : 'صاحب الشجرة'));
  }

  TREE.loadQr = loadQr;
  TREE.qrOf = qrOf;
  TREE.qrSvg = qrSvg;
  TREE.pwFrom = pwFrom;

  /* A «رابط الشجرة» password as it's kept, the same whichever keyboard typed it: Arabic and Persian
     digits as 0-9, capitals as small letters, and the Arabic letters written more than one way
     (أ إ آ ا، ى ي، ة ه) one way, without tashkeel or ـ. The page that opens the link does the same. */
  function plainPw(s) {
    return String(s || '').trim().toLowerCase()
      .replace(/[٠-٩۰-۹]/g, function (d) { return String(d.charCodeAt(0) & 0xF); })
      .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/[ىی]/g, 'ي').replace(/ة/g, 'ه').replace(/ک/g, 'ك');
  }
  TREE.plainPw = plainPw;

  /* opts.hideF: as in drawTree. opts.tidy: laid out with «ترتيب». opts.qr: the «رابط الشجرة كاملة»; when
     the picture leaves people out (families folded into «+3 عياله», or the other side of the family),
     a QR to it goes at the foot. opts.qrOpen: the link needs no password (no «خذ الباسورد من …»). */
  function makePicture(doc, viewKey, format, opts) {
    var hideF = !!(opts && opts.hideF), tidy = !!(opts && opts.tidy), link = opts && opts.qr;
    var D = KIN.draw, F = PICFMT[format] || PICFMT.story, H = KIN.FORMATS[format === 'post' ? 'post' : 'story'].H;
    var idx = index(doc), rels = relations(doc, idx), vs = views(doc, idx);
    var view = vs.filter(function (v) { return v.key === viewKey; })[0] || vs[0];
    var title = famTitle(doc);
    var pl = pictureLayout(doc, idx, view, F.boxW, F.boxH, tidy), boxH = F.boxH;
    // the QR goes on when the picture leaves people out: families folded into «+3», or the other side
    var qrLib = link && (pl.folded || vs.length > 1) ? loadQr().catch(function () { return null; }) : Promise.resolve(null);
    var pwText = opts && opts.qrOpen ? '' : pwFrom(doc, hideF), QZ = qrZone(F, pwText);
    return Promise.all([D.loadFonts(fontSample(doc, rels, link ? [QR_WORDS.join(' '), pwText].filter(Boolean).join(' ') : '')), qrLib]).then(function (got) {
      var qrcode = got[1];
      if (qrcode) { boxH = QZ.boxH; pl = pictureLayout(doc, idx, view, F.boxW, boxH, tidy); }
      var c = document.createElement('canvas');
      c.width = 1080; c.height = H;
      var ctx = c.getContext('2d');
      D.background(ctx, 1080, H);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

      var L = pl.L, s = pl.s;
      ctx.fillStyle = '#F4EFE6';
      D.fit(ctx, title, '700', F.title, 960, 60);
      ctx.fillText(title, 540, F.titleY);
      ctx.fillStyle = '#E9C46A';
      D.setFont(ctx, '500', F.sub);
      ctx.fillText((view.label ? view.label + ' · ' : '') + gens(L.levels), 540, F.subY);

      var ox = 540 - L.W * s / 2, oy = F.boxY + Math.max(0, (boxH - L.H * s) / 2);
      drawTree(ctx, doc, rels, L, function (x) { return ox + x * s; }, function (y) { return oy + y * s; }, s, INK.sea, hideF);

      if (qrcode) drawQrPanel(ctx, qrOf(qrcode, link), QZ, pwText);
      else D.drawSticker(ctx, KIN.FORMATS[format === 'post' ? 'post' : 'story'].sticker);
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }

  /* ---------- The tree on an A4 page, as a PDF to print ---------- */

  var PAGE = { land: { w: 842, h: 595 }, port: { w: 595, h: 842 } };  // A4 in points
  var PK = 4;  // canvas pixels per point: 288 dots an inch
  var PDF_MIN = 0.72, PDF_MAX = 1.7;  // names from 6pt to 14pt
  var PDF_LINK = 'https://shorbaka.com/#tree';

  function bytesOf(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(new Uint8Array(fr.result)); };
      fr.onerror = rej;
      fr.readAsArrayBuffer(blob);
    });
  }

  /* A one-page PDF that is the picture of the page (a JPEG), with links over parts of it (the address at
     its foot, the QR). page: { w, h } in points; px: { w, h } of the JPEG; links: [{ rect: [x1, y1, x2, y2]
     in points, uri }]. */
  function pdfOf(jpeg, px, page, title, links) {
    var enc = new TextEncoder(), parts = [], at = 0, offs = [];
    var put = function (x) { var b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); at += b.length; };
    var obj = function (n, body) { offs[n] = at; put(n + ' 0 obj\n' + body + '\nendobj\n'); };
    var text = function (t) {
      var h = 'FEFF';
      for (var i = 0; i < t.length; i++) h += ('000' + t.charCodeAt(i).toString(16).toUpperCase()).slice(-4);
      return '<' + h + '>';
    };
    var num = function (v) { return String(Math.round(v * 100) / 100); };
    put('%PDF-1.4\n'); put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    // the links are objects 6.., the document's Info comes last
    var annots = links.map(function (l, i) { return (6 + i) + ' 0 R'; }).join(' '), info = 6 + links.length, last = info;
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + page.w + ' ' + page.h + '] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R /Annots [' + annots + '] >>');
    offs[4] = at;
    put('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + px.w + ' /Height ' + px.h +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n');
    put(jpeg);
    put('\nendstream\nendobj\n');
    var paint = 'q ' + page.w + ' 0 0 ' + page.h + ' 0 0 cm /Im0 Do Q';
    obj(5, '<< /Length ' + paint.length + ' >>\nstream\n' + paint + '\nendstream');
    links.forEach(function (l, i) {
      obj(6 + i, '<< /Type /Annot /Subtype /Link /Rect [' + l.rect.map(num).join(' ') + '] /Border [0 0 0] /A << /S /URI /URI (' + l.uri + ') >> >>');
    });
    obj(info, '<< /Title ' + text(title) + ' /Creator (shorbaka.com) /Producer (shorbaka.com) >>');
    var xref = at;
    put('xref\n0 ' + (last + 1) + '\n0000000000 65535 f \n' + offs.slice(1, last + 1).map(function (o) { return ('000000000' + o).slice(-10) + ' 00000 n \n'; }).join(''));
    put('trailer\n<< /Size ' + (last + 1) + ' /Root 1 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  /* The tree on a white A4 page, always laid out with «ترتيب», ready to print: orient is 'land' or
     'port'. opts.hideF as in drawTree; opts.qr: the «رابط الشجرة كاملة», as a QR in the corner at the
     foot (a link in the PDF too), with «خذ الباسورد من …» under it unless opts.qrOpen (no password).
     Resolves { file: the PDF, name, type, preview: a PNG of the page, w, h }. */
  function makePdf(doc, viewKey, orient, opts) {
    var hideF = !!(opts && opts.hideF), link = opts && opts.qr, D = KIN.draw, P = PAGE[orient] || PAGE.land, k = PK;
    var idx = index(doc), rels = relations(doc, idx), vs = views(doc, idx);
    var view = vs.filter(function (v) { return v.key === viewKey; })[0] || vs[0];
    var title = famTitle(doc), foot = 'سوّ شجرة عائلتك على shorbaka.com';
    var qrLib = link ? loadQr().catch(function () { return null; }) : Promise.resolve(null);
    var pwText = opts && opts.qrOpen ? '' : pwFrom(doc, hideF);
    // a link with a password takes suggestions: the QR also asks for them
    var askText = link && pwText ? QR_ASK : '', thanks = thanksLine(doc);
    var more = [foot, thanks].concat(link ? [QR_WORDS.join(' '), pwText, askText] : []).filter(Boolean).join(' ');
    return Promise.all([D.loadFonts(fontSample(doc, rels, more)), qrLib]).then(function (got) {
      var qrcode = got[1];
      var W = P.w * k, H = P.h * k, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
      // a thin gold frame
      D.roundRect(ctx, 20 * k, 20 * k, W - 40 * k, H - 40 * k, 16 * k);
      ctx.lineWidth = 1.2 * k; ctx.strokeStyle = '#E4D3A6'; ctx.stroke();

      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      var titleY = (orient === 'port' ? 78 : 66) * k;
      ctx.fillStyle = '#0E2A47';
      D.fit(ctx, title, '700', 26 * k, W - 120 * k, 14 * k);
      ctx.fillText(title, W / 2, titleY);

      // with the QR in the corner, the tree stops above it
      var boxW = W - 88 * k, boxY = titleY + 48 * k, boxH = H - boxY - (qrcode ? (pwText ? 128 : 116) : 74) * k - (thanks ? 16 * k : 0);
      var pl = pictureLayout(doc, idx, view, boxW, boxH, true, PDF_MIN, PDF_MAX), L = pl.L, s = pl.s;
      ctx.fillStyle = '#A3801F';
      D.setFont(ctx, '500', 11 * k);
      ctx.fillText((view.label ? view.label + ' · ' : '') + gens(L.levels), W / 2, titleY + 22 * k);

      var ox = W / 2 - L.W * s / 2, oy = boxY + Math.max(0, (boxH - L.H * s) / 2);
      drawTree(ctx, doc, rels, L, function (x) { return ox + x * s; }, function (y) { return oy + y * s; }, s, INK.paper, hideF);

      // the sign-off at the foot: the mark and «سوّ شجرة عائلتك على shorbaka.com», a link in the PDF
      var fy = H - 44 * k, markH = 15 * k, markW = markH * 102 / 72, gap = 7 * k;
      D.setFont(ctx, '500', 10 * k);
      var tw = ctx.measureText(foot).width, total = markW + gap + tw, right = W / 2 + total / 2, left = W / 2 - total / 2;
      ctx.fillStyle = '#4A607A';
      ctx.fillText(foot, right - tw / 2, fy + 3.5 * k);
      D.drawMark(ctx, left + markW / 2, fy, markH, true);

      // «خالد وسارة ساعدوني بإتمام هذه الشجرة»: whose suggestions the owner added, over the sign-off
      if (thanks) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#A3801F';
        D.fit(ctx, thanks, '500', 10 * k, W - 2 * (qrcode ? 210 : 60) * k, 7 * k);
        ctx.fillText(thanks, W / 2, fy - 18 * k);
      }

      // the QR to the whole tree in the bottom left corner, «امسح الكود» / «وشوف الشجرة كاملة» beside
      // it, and under it in small print who to take the password from
      var qrSide = 68 * k, qx = 34 * k, qy = H - (pwText ? 50 : 34) * k - qrSide;
      if (qrcode) {
        drawQrCode(ctx, qrOf(qrcode, link), qx, qy, qrSide);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#0E2A47'; D.setFont(ctx, '700', 9.5 * k);
        ctx.fillText(QR_WORDS[0], qx + qrSide + 6 * k, qy + qrSide / 2 - 2 * k);
        ctx.fillStyle = '#4A607A'; D.setFont(ctx, '500', 8.5 * k);
        ctx.fillText(QR_WORDS[1], qx + qrSide + 6 * k, qy + qrSide / 2 + 11 * k);
        if (askText) {
          ctx.fillStyle = '#1E8C82'; D.setFont(ctx, '500', 8.5 * k);
          ctx.fillText(askText, qx + qrSide + 6 * k, qy + qrSide / 2 + 24 * k);
        }
        if (pwText) {
          ctx.fillStyle = '#A3801F'; D.fit(ctx, pwText, '500', 7.5 * k, 140 * k, 5.5 * k);
          ctx.fillText(pwText, qx + 4 * k, fy + 3.5 * k);  // on the same line as the address at the foot
        }
      }

      var preview = document.createElement('canvas'), pw = 1100, ph = Math.round(1100 * H / W);
      preview.width = pw; preview.height = ph;
      preview.getContext('2d').drawImage(c, 0, 0, pw, ph);
      var blob = function (cv, type, q) { return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('no picture')); }, type, q); }); };
      return Promise.all([blob(c, 'image/jpeg', 0.92).then(bytesOf), blob(preview, 'image/png')]).then(function (r) {
        var links = [{ rect: [left / k - 4, (H - fy) / k - 10, right / k + 4, (H - fy) / k + 12], uri: PDF_LINK }];
        if (qrcode) links.push({ rect: [qx / k, (H - qy - qrSide) / k, (qx + qrSide) / k, (H - qy) / k], uri: link });
        var pdf = pdfOf(r[0], { w: W, h: H }, P, title, links);
        c.width = c.height = 0;  // let the big canvas go
        return { file: pdf, name: 'shorbaka-family-tree.pdf', type: 'application/pdf', preview: r[1], w: pw, h: ph };
      });
    });
  }

  TREE.makePicture = makePicture;
  TREE.makePdf = makePdf;
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

  /* The sizes a zoom button steps through for a tree W wide in a box avail wide: as drawn, then smaller.
     A big tree gets two steps down, the second showing it all (or as much as stays readable). */
  function zoomSteps(W, avail) {
    if (!W || avail <= 0) return [1];
    var fit = Math.max(0.16, Math.min(1, avail / W));
    if (fit > 0.98) return [1];
    if (fit >= 0.62) return [1, fit];
    return [1, Math.min(0.75, Math.sqrt(fit)), fit];
  }

  /* Draws the layout L into canvas, an element on the page: the lines in one SVG, everyone in a box.
     opts.tap(n, box): what tapping someone (or a «+» place) does; without it nobody can be tapped.
     opts.fresh: who was just added (pops in). opts.hideF: girls and women show what they are to me
     instead of their name, with a pearl for a letter, as in the pictures. */
  function paint(canvas, L, doc, opts) {
    opts = opts || {};
    var idx = index(doc), rels = relations(doc, idx);
    canvas.textContent = '';
    canvas.style.width = L.W + 'px';
    canvas.style.height = L.H + 'px';

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tr-lines');
    svg.setAttribute('width', L.W); svg.setAttribute('height', L.H);
    svg.setAttribute('viewBox', '0 0 ' + L.W + ' ' + L.H);
    svg.setAttribute('aria-hidden', 'true');
    var r = SCREEN.AV / 2 + 3;
    L.links.forEach(function (l) {
      var d;
      if (l.t === 'pair') {
        d = 'M' + (l.x1 + r) + ' ' + l.y + 'H' + (l.x2 - r);
        if (l.ex) exMark(l.x1, l.x2, l.y, 6).forEach(function (q) { d += 'M' + q.slice(0, 2).join(' ') + 'L' + q.slice(2).join(' '); });
      } else {
        d = linkLines(l, 14, 4).map(function (c) {
          return c[0] + c.slice(1).map(function (v) { return Math.round(v * 10) / 10; }).join(' ');
        }).join('');
      }
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      if (l.ghost) p.setAttribute('class', 'is-ghost');
      svg.appendChild(p);
    });
    canvas.appendChild(svg);
    L.nodes.forEach(function (n) {
      if (n.pid || (n.ghost && opts.tap)) canvas.appendChild(nodeBox(n, doc, idx, rels, opts));
    });
  }

  function nodeBox(n, doc, idx, rels, opts) {
    var tap = opts.tap, b = el(tap ? 'button' : 'div', 'tr-node');
    if (tap) b.type = 'button';
    b.style.left = (n.x - SCREEN.NW / 2) + 'px';
    b.style.top = n.y + 'px';
    if (n.ghost) {
      var label = relName(rels[n.ghost.of].concat(n.ghost.t));
      b.classList.add('is-ghost');
      b.appendChild(el('span', 'tr-av', '+'));
      b.appendChild(el('span', 'tr-name', label));
      b.setAttribute('aria-label', 'ضيف ' + label);
      b.addEventListener('click', function () { tap(n, b); });
      return b;
    }
    var p = doc.p[n.pid], isMe = n.pid === doc.me, rel = relLabel(doc, idx, rels, n.pid);
    var hidden = !!opts.hideF && p.g === 'f';
    b.classList.add(isMe ? 'is-me' : n.kind === 'mate' ? 'is-mate' : 'is-blood');
    if (!isMe && p.g === 'f') b.classList.add('is-f');
    if (opts.fresh && n.pid === opts.fresh) b.classList.add('is-new');
    if (opts.marked && opts.marked[n.pid]) b.classList.add('is-sugg');
    b.dataset.pid = n.pid;
    var av = el('span', 'tr-av', hidden ? null : initial(p.n));
    if (hidden) { av.classList.add('is-pearl'); av.appendChild(el('i')); }
    b.appendChild(av);
    if (hidden) b.appendChild(el('span', 'tr-name', rel));
    else {
      // someone added from «شنو يصير لك؟» on the way to a relative may have no name yet
      b.appendChild(el('span', 'tr-name' + (p.n ? '' : ' is-noname'), p.n || 'بدون اسم'));
      b.appendChild(el('span', 'tr-rel', rel));
    }
    if (p.d) b.appendChild(el('span', 'tr-rip', rip(p)));
    if (tap) {
      b.setAttribute('aria-label', isMe ? p.n + '، هذا إنت' : (p.n || 'بدون اسم') + '، ' + KIN.verb(rels[n.pid]) + ' ' + rel + (p.d ? '، ' + rip(p) : ''));
      b.addEventListener('click', function () { tap(n, b); });
    }
    return b;
  }

  /* ---------- A tree to look at only: the page a «رابط الشجرة» opens ---------- */

  /* Shows doc in els ({ side, tidy, zoom, scroll, stage, canvas }, laid out as on the tree page): both
     sides, «ترتيب» and zoom, and nobody can be tapped or added. When the owner hides girls' and women's
     names, they come without them and show what they are, as in the pictures. */
  function viewer(els, doc, vopts) {
    vopts = vopts || {};
    var idx = index(doc), vs = views(doc, idx), hideF = !!(doc.o && doc.o.hideF);
    var st = { view: vs[0].key, tidy: !!(doc.o && doc.o.tidy), zl: 0, z: 1, L: null, boxW: 0, boxH: 0, center: true, fitNext: false };
    var sideBtns = Array.prototype.slice.call(els.side.querySelectorAll('button'));

    function room() {
      var w = Math.max(240, els.scroll.clientWidth - 36);
      if (w !== st.boxW || !st.boxH) { st.boxW = w; st.boxH = Math.max(340, (window.innerHeight || 700) - 170); }
      return { w: w, h: st.boxH };
    }
    function draw() {
      var view = vs.filter(function (v) { return v.key === st.view; })[0] || vs[0];
      els.side.hidden = vs.length < 2;
      sideBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.side === view.key)); });
      var base = { ghosts: false, mates: 'all' }, L = layout(doc, idx, view, SCREEN, base), box = room();
      var canTidy = L.W > box.w + 1;
      els.tidy.hidden = !canTidy;
      els.tidy.setAttribute('aria-pressed', String(st.tidy));
      els.tidy.setAttribute('aria-label', st.tidy ? 'رجّع الشجرة بالأجيال' : 'رتّب الشجرة على قد الشاشة');
      if (st.tidy && canTidy) L = fitLayout(doc, idx, view, SCREEN, base, box.w, box.h, 1).L;
      st.L = L;
      paint(els.canvas, L, doc, { hideF: hideF, tap: vopts.tap, marked: vopts.marked, fresh: st.fresh });
      st.fresh = null;
      size();
      if (st.center) { st.center = false; centerOn(st.focus || doc.me); st.focus = null; }
    }
    function steps() { return zoomSteps(st.L && st.L.W, els.scroll.clientWidth - 36); }
    function size() {
      var L = st.L;
      if (!L || els.scroll.clientWidth - 36 <= 0) return;
      var zs = steps();
      if (st.fitNext) { st.fitNext = false; st.zl = zs.length - 1; }
      st.zl = Math.min(st.zl, zs.length - 1);
      var last = zs.length > 1 && st.zl >= zs.length - 1;
      els.zoom.hidden = zs.length < 2;
      st.z = zs[st.zl];
      els.canvas.style.transform = st.z === 1 ? '' : 'scale(' + st.z + ')';
      els.stage.style.width = Math.ceil(L.W * st.z) + 'px';
      els.stage.style.height = Math.ceil(L.H * st.z) + 'px';
      els.zoom.setAttribute('aria-label', last ? 'رجّع الشجرة لحجمها' : st.zl ? 'صغّرها أكثر' : 'صغّر الشجرة');
      els.zoom.setAttribute('aria-pressed', String(st.zl > 0));
      els.zoom.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (last ? ZOOM.in : ZOOM.out) + '</svg>';
    }
    function centerOn(pid) {
      var n = st.L && st.L.nodes.filter(function (x) { return x.pid === pid; })[0];
      if (n) els.scroll.scrollLeft = Math.max(0, 18 + n.x * st.z - els.scroll.clientWidth / 2);
    }

    sideBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.view === b.dataset.side) return;
        st.view = b.dataset.side; st.zl = 0; st.center = true;
        draw();
      });
    });
    els.tidy.addEventListener('click', function () {
      st.tidy = !st.tidy; st.zl = 0; st.fitNext = st.tidy; st.center = true;
      draw();
    });
    els.zoom.addEventListener('click', function () {
      var mid = (els.scroll.scrollLeft + els.scroll.clientWidth / 2 - 18) / st.z;
      st.zl = (st.zl + 1) % steps().length;
      size();
      if (!st.zl) centerOn(doc.me);
      else els.scroll.scrollLeft = Math.max(0, 18 + mid * st.z - els.scroll.clientWidth / 2);
    });
    var resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (Math.max(240, els.scroll.clientWidth - 36) !== st.boxW) draw(); else size();
      }, 120);
    });
    draw();

    /* The tree changed (someone suggested an addition): draw the new one, on a side that shows `fresh`,
       keeping the place on screen. */
    return {
      set: function (next, fresh) {
        doc = next; idx = index(doc); vs = views(doc, idx);
        if (fresh) {
          var on = function (v) { return layout(doc, idx, v, SCREEN, { ghosts: false, mates: 'all' }).nodes.some(function (n) { return n.pid === fresh; }); };
          var cur = vs.filter(function (v) { return v.key === st.view; })[0];
          if (!cur || !on(cur)) { var other = vs.filter(on)[0]; if (other) { st.view = other.key; st.center = true; st.focus = fresh; } }
          st.fresh = fresh;
        }
        var left = els.scroll.scrollLeft;
        draw();
        if (!st.center) els.scroll.scrollLeft = left;
      },
      doc: function () { return doc; }
    };
  }

  TREE.viewer = viewer;

  function init() {
    var $ = function (id) { return document.getElementById(id); };
    var ui = {
      sec: $('tree'), count: $('tr-count'), msg: $('tr-msg'), retry: $('tr-retry'),
      start: $('tr-start'), meName: $('tr-me'), gSeg: $('tr-g'), go: $('tr-go'), startErr: $('tr-start-err'),
      wrap: $('tr-wrap'), side: $('tr-side'), zoom: $('tr-zoom'), tidy: $('tr-tidy'), scroll: $('tr-scroll'), stage: $('tr-stage'),
      canvas: $('tr-canvas'), share: $('tr-share'), pdf: $('tr-pdf'), note: $('tr-note'), saveRetry: $('tr-save-retry'), signIn: $('tr-in'),
      sheet: $('tr-sheet'), pAv: $('tr-p-av'), pTitle: $('tr-p-title'), pRel: $('tr-p-rel'), pClose: $('tr-p-close'),
      pRename: $('tr-p-rename'), pName: $('tr-p-name'), pSave: $('tr-p-save'), pLabel: $('tr-p-label'), pAdds: $('tr-p-adds'),
      pForm: $('tr-p-form'), pFormLabel: $('tr-p-form-label'), pNew: $('tr-p-new'), pUnions: $('tr-p-unions'), pAdd: $('tr-p-add'),
      pDone: $('tr-p-done'), pOrder: $('tr-p-order'), pUp: $('tr-p-up'), pDown: $('tr-p-down'), pDel: $('tr-p-del'),
      pWives: $('tr-p-wives'), pBefore: $('tr-p-before'), pAfter: $('tr-p-after'), pMarks: $('tr-p-marks'),
      pConfirm: $('tr-p-confirm'), pWarn: $('tr-p-warn'), pYes: $('tr-p-yes'), pNo: $('tr-p-no'),
      acctCount: $('acct-tree-count'),
      famStart: $('tr-fam-start'), famBtn: $('tr-fam-btn'), famText: $('tr-fam-text'), famForm: $('tr-fam-form'), famName: $('tr-fam-name'),
      linkBtn: $('tr-link-btn'), link: $('tr-link'), lClose: $('tr-l-close'), lText: $('tr-l-text'), lMsg: $('tr-l-msg'),
      lRetry: $('tr-l-retry'), lIn: $('tr-l-in'), lOn: $('tr-l-on'), lQr: $('tr-l-qr'), lUrl: $('tr-l-url'), lCopy: $('tr-l-copy'),
      lForm: $('tr-l-form'), lLabel: $('tr-l-label'), lPass: $('tr-l-pass'), lSave: $('tr-l-save'), lCancel: $('tr-l-cancel'),
      lMore: $('tr-l-more'), lChange: $('tr-l-change'), lStop: $('tr-l-stop'), lConfirm: $('tr-l-confirm'), lYes: $('tr-l-yes'), lNo: $('tr-l-no'),
      lOpen: $('tr-l-open'), lFree: $('tr-l-free'), lAsk: $('tr-l-ask'), lTip: $('tr-l-tip'),
      sgBar: $('tr-sg-bar'), sgBarText: $('tr-sg-bar-text'), sg: $('tr-sg'), sgClose: $('tr-sg-close'), sgList: $('tr-sg-list'), sgMsg: $('tr-sg-msg')
    };
    if (!ui.sec || !ui.canvas || !KIN) return;

    var st = {
      doc: null, where: 'local', loaded: false, failed: false, seq: 0,
      view: null, L: null, zl: 0, z: 1, center: true, lastAdded: null, focus: null, boxW: 0, boxH: 0, fitNext: false,
      person: null, from: null, adding: null, union: null, g: '',
      saving: null, again: false, saveErr: false, pending: false,
      // «رابط الشجرة كاملة»: the link's code, null for none, undefined while it's asked for
      link: null, linkErr: false, linkOff: false
    };
    var acctReady = !root.ACCOUNT, timer = null, told = null;  // told: the tree kin.js last heard about
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
      loadLink();
      var seq = ++st.seq;
      st.failed = false;
      if (!a) {
        st.where = 'local'; st.doc = loadLocal(); st.loaded = true; st.center = true;
        sugg.list = [];
        render();
        showSuggBar();
        return;
      }
      st.where = 'account'; st.loaded = false; st.doc = null;
      render();
      a.loadTree().then(function (data) {
        if (seq !== st.seq) return;
        var doc = clean(data), local = loadLocal(), mine = unsaved(uid);
        st.loaded = true; st.center = true;
        setTimeout(function () { if (seq === st.seq) loadSuggestions(true); }, 0);
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
      if (told !== st.doc) { told = st.doc; if (KIN.treeChanged) KIN.treeChanged(); }
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
      showLinkBtn();
      if (!ui.sheet.hidden) fillSheet();
    }

    /* The room the tree has on screen: the width of its box, and about the height of the screen (taken
       when the width changes, so the bar of a phone's browser coming and going doesn't move the tree). */
    function screenBox() {
      var w = Math.max(240, ui.scroll.clientWidth - 36);
      if (w !== st.boxW || !st.boxH) { st.boxW = w; st.boxH = Math.max(340, (window.innerHeight || 700) - 170); }
      return { w: w, h: st.boxH };
    }

    // A setting kept with the tree (o.hideF, o.tidy).
    function setOpt(key, on) {
      if (!st.doc) return;
      var o = st.doc.o || {};
      if (on) o[key] = true; else delete o[key];
      if (Object.keys(o).length) st.doc.o = o; else delete st.doc.o;
    }

    function draw() {
      var doc = st.doc, idx = index(doc), vs = views(doc, idx);
      var view = vs.filter(function (v) { return v.key === st.view; })[0] || vs[0];
      st.view = view.key;
      ui.side.hidden = vs.length < 2;
      sideBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.side === view.key)); });

      // «ترتيب» shows once the tree is wider than the screen: then it can gather it to the screen's shape
      var base = { ghosts: true, mates: 'all' }, L = layout(doc, idx, view, SCREEN, base), box = screenBox();
      var tidy = !!(doc.o && doc.o.tidy), canTidy = L.W > box.w + 1;
      if (ui.tidy) {
        ui.tidy.hidden = !canTidy;
        ui.tidy.setAttribute('aria-pressed', String(tidy));
        ui.tidy.setAttribute('aria-label', tidy ? 'رجّع الشجرة بالأجيال' : 'رتّب الشجرة على قد الشاشة');
      }
      if (tidy && canTidy) L = fitLayout(doc, idx, view, SCREEN, base, box.w, box.h, 1).L;
      st.L = L;
      paint(ui.canvas, L, doc, {
        fresh: st.lastAdded,
        tap: function (n, b) { if (n.ghost) openPerson(n.ghost.of, n.ghost.t, b); else openPerson(n.pid, null, b); }
      });
      sizeStage();
      if (st.center && shown()) {
        st.center = false;
        centerOn([st.focus, st.lastAdded, doc.me].filter(function (x) { return x && doc.p[x]; })[0]);
        st.focus = null;
      }
    }

    function zooms() { return zoomSteps(st.L && st.L.W, ui.scroll.clientWidth - 36); }

    function sizeStage() {
      var L = st.L;
      if (!L || ui.scroll.clientWidth - 36 <= 0) return;
      var zs = zooms();
      if (st.fitNext) { st.fitNext = false; st.zl = zs.length - 1; }
      st.zl = Math.min(st.zl, zs.length - 1);
      var last = zs.length > 1 && st.zl >= zs.length - 1;
      ui.zoom.hidden = zs.length < 2;
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
      var d = copy(st.doc), id = addRelative(d, pid, t, '…', fid), i = index(d);
      return id ? relLabel(d, i, relations(d, i), id) : '';
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
      ui.pTitle.textContent = p.n || 'بدون اسم';
      ui.pName.placeholder = p.g === 'f' ? 'اكتب اسمها' : 'اكتب اسمه';
      ui.pRel.textContent = isMe ? 'هذا إنت' : KIN.verb(rels[pid]) + ' ' + relLabel(doc, idx, rels, pid) + (p.d ? '، ' + rip(p) : '');
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

      // a wife among his wives: which one she is («زوجة عمي الثانية»)
      var wf = p.g === 'f' ? wifeIn(doc, idx, pid) : null, ws = wf ? wivesOf(doc, idx, doc.f[wf].a) : [], wi = ws.indexOf(wf);
      st.wife = ws.length > 1 ? wf : null;
      ui.pWives.hidden = ws.length < 2;
      ui.pBefore.disabled = wi <= 0;
      ui.pAfter.disabled = wi < 0 || wi >= ws.length - 1;

      // passed away, divorced: only here, never asked when adding someone
      var marks = [];
      if (!isMe) marks.push({ key: 'd', text: p.g === 'f' ? 'متوفية' : 'متوفي', hint: (p.g === 'f' ? 'ونكتب تحت اسمها ' : 'ونكتب تحت اسمه ') + '«' + rip(p) + '»', on: !!p.d,
        set: function (on) { if (on) p.d = true; else delete p.d; } });
      if (p.g === 'f') {
        var hs = (idx.unions[pid] || []).filter(function (fid) { return doc.f[fid].b === pid && doc.f[fid].a; });
        hs.forEach(function (fid) {
          var x = doc.f[fid];
          marks.push({ key: fid, text: hs.length > 1 ? 'مطلقة من ' + (doc.p[x.a].n || 'زوجها') : 'مطلقة', on: !!x.x,
            set: function (on) { if (on) x.x = true; else delete x.x; } });
        });
      }
      var keys = marks.map(function (m) { return m.key + ':' + m.text; }).join('|');
      if (ui.pMarks.dataset.keys !== keys || ui.pMarks.dataset.pid !== pid) {
        ui.pMarks.textContent = '';
        marks.forEach(function (m) { ui.pMarks.appendChild(markEl(m)); });
        ui.pMarks.dataset.keys = keys; ui.pMarks.dataset.pid = pid;
      } else {
        marks.forEach(function (m, i) {
          var box = ui.pMarks.children[i].querySelector('input');
          box.checked = m.on;
          box._set = m.set;
        });
      }
      ui.pMarks.hidden = !marks.length;

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

    // One switch in the person's sheet («متوفي», «مطلقة»): { text, hint, on, set(on) }.
    function markEl(m) {
      var l = el('label', 'kin-toggle'), words = el('span', 'kin-toggle-words'), box = el('input'), sw = el('span', 'kin-switch');
      words.appendChild(el('span', 'kin-toggle-text', m.text));
      if (m.hint) words.appendChild(el('span', 'kin-toggle-hint', m.hint));
      box.type = 'checkbox';
      box.setAttribute('role', 'switch');
      box.checked = m.on;
      box._set = m.set;
      box.addEventListener('change', function () { box._set(box.checked); changed(); });
      sw.setAttribute('aria-hidden', 'true');
      l.appendChild(words); l.appendChild(box); l.appendChild(sw);
      return l;
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
    // the two families swap ids, so a child being added picks their mother again
    ui.pBefore.addEventListener('click', function () { if (st.wife && moveWife(st.doc, st.wife, -1)) { stopAdd(); changed(); } });
    ui.pAfter.addEventListener('click', function () { if (st.wife && moveWife(st.doc, st.wife, 1)) { stopAdd(); changed(); } });

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
      if (KIN.openAuth) KIN.openAuth({ title: 'احفظ شجرتك بحسابك', text: 'سجّل دخولك عشان تنحفظ شجرتك بحسابك، وتلقاها من أي جهاز.' }, ui.signIn);
    });
    ui.share.addEventListener('click', function () {
      if (!st.doc || !KIN.openShare) return;
      var doc = copy(st.doc), key = st.view, vs = views(doc, index(doc));
      var view = vs.filter(function (v) { return v.key === key; })[0] || vs[0];
      // with a «رابط الشجرة كاملة», a picture that leaves people out carries its QR, and the sheet can copy it
      var link = st.link && signedIn() ? linkUrl(st.link) : null, open = !!(link && st.linkOpen);
      var opts = { hideF: !!(st.doc.o && st.doc.o.hideF), tidy: !!(st.doc.o && st.doc.o.tidy), qr: link, qrOpen: open };
      KIN.openShare({
        file: 'shorbaka-tree',
        make: function (format) { return makePicture(doc, key, format, opts); },
        alt: famTitle(doc) + (view.label ? '، ' + view.label : ''),
        mention: 'تمنشن أهلك',
        link: link,
        tips: open
          ? { story: 'حطها ستوري مع ستيكر الرابط، ومنشن أهلك', post: 'انشرها بقروب العائلة مع الرابط، أو نزّلها بوست ومنشن أهلك' }
          : link
          ? { story: 'حطها ستوري مع ستيكر الرابط، ومنشن أهلك وعطهم الباسورد', post: 'انشرها بقروب العائلة مع الرابط والباسورد، أو نزّلها بوست ومنشن أهلك' }
          : { story: 'انشرها بقروب العائلة، أو حطها ستوري ومنشن أهلك', post: 'انشرها بقروب العائلة، أو نزّلها بوست ومنشن أهلك' },
        text: link
          ? 'سويت شجرة عائلتي على شرباكة 🌳 شوفوها كاملة هني: ' + link + (open ? '' : '\nواطلبوا مني الباسورد')
          : 'سويت شجرة عائلتي على شرباكة 🌳 سوّ شجرة عائلتك: https://shorbaka.com/#tree',
        // remembered with the tree, so the next picture comes out the same way
        option: hideOption(doc, key, opts)
      }, ui.share);
    });

    // The switch «أخفي أسامي البنات», remembered with the tree so the next picture comes out the same way.
    function hideOption(doc, key, opts) {
      return !viewHasF(doc, key) ? null : {
        label: 'أخفي أسامي البنات', hint: 'يطلع «أختي» و«أمي» بدال الأسامي', on: opts.hideF,
        set: function (on) { opts.hideF = on; if (st.doc) { setOpt('hideF', on); changed(); } }
      };
    }

    // With a «رابط الشجرة كاملة», the PDF can carry its QR in the corner, or not.
    function pdfQrOption(link, opts) {
      return !link ? null : {
        label: 'حط كيو آر الشجرة كاملة', hint: 'اللي يمسحه يشوف الشجرة كاملة' + (opts.qrOpen ? '' : ' بالباسورد'), on: !!opts.qr,
        set: function (on) { opts.qr = on ? link : null; if (st.doc) { setOpt('pdfNoQr', !on); changed(); } }
      };
    }

    // The tree on an A4 page to print, across or up and down; always gathered with «ترتيب».
    if (ui.pdf) ui.pdf.addEventListener('click', function () {
      if (!st.doc || !KIN.openShare) return;
      var doc = copy(st.doc), key = st.view, vs = views(doc, index(doc));
      var view = vs.filter(function (v) { return v.key === key; })[0] || vs[0];
      // the QR to the whole tree goes in the corner unless it was switched off (remembered with the tree)
      var link = st.link && signedIn() ? linkUrl(st.link) : null;
      var opts = { hideF: !!(st.doc.o && st.doc.o.hideF), qr: link && !(st.doc.o && st.doc.o.pdfNoQr) ? link : null, qrOpen: !!(link && st.linkOpen) };
      var size = function (label, alt) {
        return { label: label, title: 'جاهزة للطباعة', alt: alt, dl: 'حمّل ملف PDF', tip: '' };
      };
      KIN.openShare({
        file: 'shorbaka-family-tree',
        sizes: { land: size('بالعرض', 'صفحة A4 بالعرض'), port: size('بالطول', 'صفحة A4 بالطول') },
        sizesLabel: 'اتجاه الصفحة',
        make: function (orient) { return makePdf(doc, key, orient, opts); },
        alt: famTitle(doc) + (view.label ? '، ' + view.label : ''),
        tips: { land: 'اطبعها على ورقة A4، أو أرسلها بقروب العائلة', port: 'اطبعها على ورقة A4، أو أرسلها بقروب العائلة' },
        text: 'شجرة عائلتي من شرباكة 🌳 سوّ شجرة عائلتك: https://shorbaka.com/#tree',
        options: [hideOption(doc, key, opts), pdfQrOption(link, opts)]
      }, ui.pdf);
    });

    /* --- «رابط الشجرة كاملة»: the whole tree at shorbaka.com/t/#code, opened with a password I set ---
       It needs the account: the page shows the tree as it is saved there. The sheet shows one of
       out (not signed in), wait, err, none (no link yet: set a password), on (the link, its QR and a way
       to copy it), change (a new password), stop (are you sure) or open (are you sure about taking the
       password off: then the link opens for anyone who has it, st.linkOpen). st.linkFree: the database
       can take a password off. */

    var linkSeq = 0, linkMode = '', linkNote = null;  // linkNote: what the sheet says after a change, in one state

    function linkUrl(code) {
      var site = /(^|\.)shorbaka\.com$/.test(location.hostname) ? 'https://shorbaka.com' : location.origin;
      return site + '/t/#' + code;
    }

    /* --- «اقتراحات على شجرتك»: what family suggested through «رابط الشجرة كاملة» --- */

    var sugg = { list: [], at: 0, busy: false };
    function loadSuggestions(force) {
      var a = signedIn();
      if (!ui.sgBar || !a || !a.treeSuggestions || st.where !== 'account' || !st.loaded || !st.doc) { showSuggBar(); return; }
      if (!force && Date.now() - sugg.at < 60000) return;
      sugg.at = Date.now();
      var uid = a.user().id;
      a.treeSuggestions().then(function (list) {
        if (!signedIn() || signedIn().user().id !== uid) return;
        sugg.list = Array.isArray(list) ? list : [];
        showSuggBar();
        if (!ui.sg.hidden) fillSugg();
      }, function () {});
    }
    function showSuggBar() {
      if (!ui.sgBar) return;
      var n = st.where === 'account' && st.doc ? sugg.list.length : 0;
      ui.sgBar.hidden = !n;
      if (n) ui.sgBarText.textContent = n === 1 ? 'عندك اقتراح من ' + sugg.list[0].from + ' على شجرتك' : n === 2 ? 'عندك اقتراحين على شجرتك' : 'عندك ' + n + (n <= 10 ? ' اقتراحات' : ' اقتراح') + ' على شجرتك';
    }
    function sayDate(s) {
      var m = Math.round((Date.now() - Date.parse(s)) / 60000);
      if (!(m >= 0)) return '';
      if (m < 1) return 'الحين';
      if (m < 60) return 'قبل ' + m + ' دقيقة';
      var h = Math.round(m / 60);
      if (h < 24) return 'قبل ' + h + (h === 1 ? ' ساعة' : ' ساعات');
      var d = Math.round(h / 24);
      return d === 1 ? 'أمس' : 'قبل ' + d + ' أيام';
    }
    function sgSay(text, bad) {
      ui.sgMsg.textContent = text || '';
      ui.sgMsg.hidden = !text;
      ui.sgMsg.classList.toggle('is-err', !!bad);
    }
    function fillSugg() {
      ui.sgList.textContent = '';
      if (!sugg.list.length) { ui.sgList.appendChild(el('p', 'tr-sg-text', 'ما فيه اقتراحات ثانية.')); return; }
      sugg.list.forEach(function (sg) {
        var item = el('div', 'tr-sg-item'), head = el('p', 'tr-sg-from');
        head.appendChild(el('span', null, 'من ' + sg.from));
        head.appendChild(el('small', null, sayDate(sg.at)));
        item.appendChild(head);
        var steps = describeSteps(st.doc, sg.ops), boxes = {};
        steps.forEach(function (x) {
          var row = el('label', 'tr-sg-op' + (x.rel ? '' : ' is-off')), box = el('input'), words = el('span');
          box.type = 'checkbox';
          box.checked = !!x.rel;
          box.disabled = !x.rel;
          boxes[x.id] = box;
          row.appendChild(box);
          row.appendChild(el('b', null, x.n));
          words.textContent = x.rel ? ' ' + x.rel : ' ما يركب على الشجرة الحين';
          row.appendChild(words);
          // picking someone picks who they're built on; leaving someone out leaves out who is built on them
          box.addEventListener('change', function () {
            var walk = function (id, on) {
              var b = boxes[id];
              if (!b || b.disabled) return;
              b.checked = on;
              if (on) (steps.filter(function (y) { return y.id === id; })[0] || { needs: [] }).needs.forEach(function (n) { walk(n, true); });
              else steps.forEach(function (y) { if (y.needs.indexOf(id) >= 0 && boxes[y.id].checked) walk(y.id, false); });
            };
            walk(x.id, box.checked);
            addBtn.disabled = !steps.some(function (y) { return boxes[y.id].checked; });
          });
          item.appendChild(row);
        });
        var btns = el('div', 'tr-sg-btns'), addBtn = el('button', 'kin-btn kin-primary', 'ضيف المختار'), noBtn = el('button', 'kin-btn', 'لا، شكرًا');
        addBtn.type = noBtn.type = 'button';
        addBtn.disabled = !steps.some(function (y) { return boxes[y.id].checked; });
        addBtn.addEventListener('click', function () {
          var pick = steps.filter(function (y) { return boxes[y.id].checked; }).map(function (y) { return y.id; });
          takeSugg(sg, pick);
        });
        noBtn.addEventListener('click', function () { takeSugg(sg, []); });
        btns.appendChild(addBtn); btns.appendChild(noBtn);
        item.appendChild(btns);
        ui.sgList.appendChild(item);
      });
    }
    // Adds the picked steps of one suggestion (none: it's turned down), then lets it go.
    function takeSugg(sg, pick) {
      var a = signedIn();
      if (!a || sugg.busy || !st.doc) return;
      var added = 0;
      if (pick.length) {
        var r = replay(st.doc, sg.ops, pick);
        added = r.done.length;
        if (added) {
          var h = helpers((r.doc.h || []).concat(sg.from));
          if (h.length) r.doc.h = h;
          st.doc = r.doc;
          st.lastAdded = r.map[r.done[r.done.length - 1]];
          changed();
        }
      }
      sugg.busy = true;
      sgSay('');
      a.dropTreeSuggestion(sg.id).then(function () {
        sugg.busy = false;
        sugg.list = sugg.list.filter(function (x) { return x.id !== sg.id; });
        showSuggBar();
        fillSugg();
        sgSay(!pick.length ? 'تمام، ما انضاف شي من اقتراح ' + sg.from + '.' :
          added ? 'انضاف ' + (added === 1 ? 'شخص واحد' : added === 2 ? 'شخصين' : added + ' أشخاص') + ' من اقتراح ' + sg.from + '، وانكتب اسم ' + sg.from + ' مع اللي ساعدوا.' :
          'ما قدرنا نضيفهم، الشجرة تغيّرت.', pick.length && !added);
        if (!sugg.list.length) setTimeout(closeSugg, 1600);
      }, function () {
        sugg.busy = false;
        sgSay('ما قدرنا نشيل الاقتراح من القائمة. تأكد من النت وجرّب مرة ثانية.', true);
      });
    }
    function openSugg() {
      if (!st.doc) return;
      sgSay('');
      fillSugg();
      ui.sg.hidden = false;
      document.documentElement.classList.add('kin-lock');
      ui.sgClose.focus();
    }
    function closeSugg() {
      if (!ui.sg || ui.sg.hidden) return;
      ui.sg.hidden = true;
      document.documentElement.classList.remove('kin-lock');
      if (!ui.sgBar.hidden) ui.sgBar.focus({ preventScroll: true });
    }
    if (ui.sgBar) {
      ui.sgBar.addEventListener('click', openSugg);
      ui.sgClose.addEventListener('click', closeSugg);
      ui.sg.addEventListener('click', function (e) { if (e.target === ui.sg) closeSugg(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSugg(); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') loadSuggestions(); });
    }

    function loadLink() {
      var a = signedIn(), seq = ++linkSeq;
      st.linkErr = false; linkMode = ''; linkNote = null;
      if (!a || !a.treeLink) { st.link = null; showLinkBtn(); fillLink(); return; }
      st.link = undefined;
      showLinkBtn(); fillLink();
      (a.treeLinkState ? a.treeLinkState() : a.treeLink().then(function (code) { return { code: code, old: true }; })).then(function (r) {
        if (seq !== linkSeq) return;
        st.link = (r && r.code) || null;
        st.linkOpen = !!(st.link && r.open);
        st.linkFree = !(r && r.old);
      }, function (e) {
        if (seq !== linkSeq) return;
        st.link = null;
        // the site went up before its database knew about links: no button until it does
        if (e && (e.code === 'PGRST202' || e.code === '42883')) st.linkOff = true; else st.linkErr = true;
      }).then(function () {
        if (seq === linkSeq) { showLinkBtn(); fillLink(); }
      });
    }

    function showLinkBtn() {
      if (ui.linkBtn) ui.linkBtn.hidden = !st.doc || !accounts() || st.linkOff;
    }

    function linkState() {
      if (!signedIn()) return 'out';
      if (st.linkErr) return 'err';
      if (st.link === undefined) return 'wait';
      if (!st.link) return linkMode === 'open' ? 'open' : 'none';
      return linkMode || 'on';
    }

    function fillLink() {
      if (!ui.link || ui.link.hidden) return;
      var s = linkState(), url = st.link ? linkUrl(st.link) : '', open = !!(st.link && st.linkOpen);
      ui.lIn.hidden = s !== 'out';
      ui.lRetry.hidden = s !== 'err';
      ui.lOn.hidden = ui.lMore.hidden = s !== 'on';
      ui.lForm.hidden = s !== 'none' && s !== 'change';
      ui.lConfirm.hidden = s !== 'stop' && s !== 'open';
      ui.lCancel.hidden = s !== 'change';
      if (ui.lFree) ui.lFree.hidden = s !== 'none' || !st.linkFree;
      if (ui.lOpen) ui.lOpen.hidden = open || !st.linkFree;
      ui.lChange.textContent = open ? 'حط باسورد' : 'غيّر الباسورد';
      ui.lText.textContent = s === 'change' ? (open ? 'الرابط نفسه ما يتغيّر، بس بعدها ما ينفتح إلا بالباسورد.' : 'الرابط نفسه ما يتغيّر، بس الباسورد القديم يوقف.')
        : open ? 'اللي عنده الرابط يشوف شجرتك كاملة بدون باسورد، وما يقدر يغيّر فيها شي.'
        : 'اللي عنده الرابط والباسورد يشوف شجرتك كاملة، وما يقدر يغيّر فيها شي.';
      ui.lLabel.textContent = s === 'change' && !open ? 'الباسورد الجديد' : 'حط باسورد للرابط';
      btnText(ui.lSave).textContent = s !== 'change' ? 'سوّ الرابط' : open ? 'حط الباسورد' : 'غيّر الباسورد';
      if (ui.lTip) ui.lTip.textContent = 'حطه بستيكر الرابط بالستوري أو أرسله بقروب العائلة' + (open ? '.' : '، وعطهم الباسورد.');
      if (ui.lAsk) ui.lAsk.textContent = s === 'open'
        ? 'أي أحد عنده الرابط أو يمسح الكيو آر بيشوف شجرتك كاملة بدون باسورد. وتقدر ترجّع الباسورد متى ما تبي.'
        : 'اللي عندهم الرابط ما يقدرون يفتحونه بعدها' + (open ? '' : '، حتى بالباسورد') + '. وإذا سويت رابط جديد بعدين، بيكون رابط ثاني.';
      ui.lYes.textContent = s === 'open' ? 'شيل الباسورد' : 'وقّفه';

      var m = s === 'wait' ? { a: 'لحظة…' }
        : s === 'err' ? { err: true, a: 'ما قدرنا نجيب رابط شجرتك الحين. تأكد من النت.' }
        : linkNote && linkNote.s === s ? linkNote : null;
      ui.lMsg.textContent = '';
      ui.lMsg.hidden = !m;
      ui.lMsg.classList.toggle('is-err', !!(m && m.err));
      if (m) {
        ui.lMsg.appendChild(document.createTextNode(m.a));
        if (m.pw) { ui.lMsg.appendChild(el('b', null, m.pw)); ui.lMsg.appendChild(document.createTextNode(m.b)); }
      }

      if (s !== 'on' || ui.lQr.dataset.url === url) return;
      ui.lUrl.textContent = url.replace(/^https?:\/\//, '');
      ui.lQr.dataset.url = url; ui.lQr.textContent = '';
      loadQr().then(function (qrcode) {
        if (ui.lQr.dataset.url !== url) return;
        ui.lQr.innerHTML = qrSvg(qrOf(qrcode, url));
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
    function sayLink(s, err, a, pw, b) { linkNote = { s: s, err: err, a: a, pw: pw, b: b || '' }; fillLink(); }

    function openLink() {
      if (!st.doc || !ui.link) return;
      linkMode = ''; linkNote = null;
      if (signedIn() && st.linkErr) loadLink();
      ui.link.hidden = false;
      document.documentElement.classList.add('kin-lock');
      fillLink();
      ui.lClose.focus();
    }

    function closeLink() {
      if (!ui.link || ui.link.hidden) return;
      ui.link.hidden = true;
      document.documentElement.classList.remove('kin-lock');
      linkMode = ''; linkNote = null;  // the password shown after setting it goes with the sheet
      ui.lPass.value = '';
      if (ui.linkBtn && !ui.linkBtn.hidden) ui.linkBtn.focus({ preventScroll: true });
    }

    function busyLink(btns, on) {
      btns.forEach(function (b) { b.disabled = on; });
    }

    if (ui.link) {
      ui.linkBtn.addEventListener('click', openLink);
      ui.lClose.addEventListener('click', closeLink);
      ui.link.addEventListener('click', function (e) { if (e.target === ui.link) closeLink(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !ui.link.hidden) { e.stopPropagation(); closeLink(); }
      }, true);
      ui.lRetry.addEventListener('click', loadLink);

      ui.lIn.addEventListener('click', function () {
        closeLink();
        if (KIN.openAuth) KIN.openAuth({ title: 'سجّل دخولك', text: 'الرابط يفتح شجرتك من حسابك: سجّل دخولك عشان تنحفظ فيه، وبعدها سوّ الرابط.' }, ui.linkBtn);
      });

      // Setting a password makes the link the first time, and changes its password after that.
      ui.lForm.addEventListener('submit', function (e) {
        e.preventDefault();
        // shown back as typed, in English digits like the rest of the site
        var a = signedIn(), was = linkState(), typed = ui.lPass.value.trim(), pw = plainPw(typed);
        typed = typed.replace(/[٠-٩۰-۹]/g, function (d) { return String(d.charCodeAt(0) & 0xF); });
        if (!a || (was !== 'none' && was !== 'change')) return;
        if (pw.length < 4) { sayLink(was, true, 'الباسورد لازم يكون 4 حروف أو أرقام على الأقل.'); ui.lPass.focus(); return; }
        var uid = a.user().id, s = btnText(ui.lSave), text = s.textContent;
        busyLink([ui.lSave, ui.lCancel], true); s.textContent = 'لحظة…';
        // the link shows the tree saved in the account, so the last change goes first
        (st.pending || st.saving ? save() : Promise.resolve(true)).then(function () {
          return a.setTreeLink(pw);
        }).then(function (code) {
          busyLink([ui.lSave, ui.lCancel], false); s.textContent = text;
          var b = signedIn(), wasOpen = !!st.linkOpen;
          if (!b || b.user().id !== uid || !code) return;
          st.link = code; st.linkErr = false; st.linkOpen = false; linkMode = '';
          ui.lPass.value = '';
          if (was === 'change' && !wasOpen) sayLink('on', false, 'تغيّر الباسورد إلى ', typed, '. اللي عندهم الرابط يحتاجون الباسورد الجديد.');
          else if (was === 'change') sayLink('on', false, 'انحفظ الباسورد ', typed, '. من الحين الرابط ما ينفتح إلا فيه، فعطه أهلك.');
          else sayLink('on', false, 'انحفظ الباسورد ', typed, '. احفظه عندك، لأنه ينحفظ مشفّر وما نقدر نرجّعه لك.');
          ui.lCopy.focus({ preventScroll: true });
        }, function () {
          busyLink([ui.lSave, ui.lCancel], false); s.textContent = text;
          sayLink(was, true, 'ما زبطت. تأكد من النت وجرّب مرة ثانية.');
        });
      });

      ui.lCopy.addEventListener('click', function () {
        if (!st.link) return;
        KIN.copyText(linkUrl(st.link)).then(function (ok) { flashBtn(ui.lCopy, ok ? 'انتسخ الرابط ✓' : 'ما انتسخ، جرّب مرة ثانية'); });
      });
      ui.lChange.addEventListener('click', function () { linkMode = 'change'; linkNote = null; fillLink(); ui.lPass.focus(); });
      ui.lCancel.addEventListener('click', function () { linkMode = ''; linkNote = null; ui.lPass.value = ''; fillLink(); ui.lChange.focus(); });
      ui.lStop.addEventListener('click', function () { linkMode = 'stop'; linkNote = null; fillLink(); ui.lNo.focus(); });
      // taking the password off, or making the link without one: asks first
      var askOpen = function () { linkMode = 'open'; linkNote = null; fillLink(); ui.lNo.focus(); };
      if (ui.lOpen) ui.lOpen.addEventListener('click', askOpen);
      if (ui.lFree) ui.lFree.addEventListener('click', askOpen);
      ui.lNo.addEventListener('click', function () {
        var back = linkMode === 'open' ? (st.link ? ui.lOpen : ui.lFree) : ui.lStop;
        linkMode = ''; fillLink();
        if (back && !back.hidden) back.focus();
      });
      ui.lYes.addEventListener('click', function () {
        var a = signedIn(), was = linkState();
        if (!a || (was !== 'stop' && was !== 'open')) return;
        busyLink([ui.lYes, ui.lNo], true);
        if (was === 'open') {
          var uid = a.user().id, made = !st.link;
          // the link shows the tree saved in the account, so the last change goes first
          (st.pending || st.saving ? save() : Promise.resolve(true)).then(function () {
            return a.openTreeLink();
          }).then(function (code) {
            busyLink([ui.lYes, ui.lNo], false);
            var b = signedIn();
            if (!b || b.user().id !== uid || !code) return;
            st.link = code; st.linkErr = false; st.linkOpen = true; linkMode = '';
            sayLink('on', false, made ? 'سوّينا الرابط بدون باسورد. أي أحد عنده الرابط يشوف شجرتك كاملة.'
              : 'شلنا الباسورد. الحين أي أحد عنده الرابط يشوف شجرتك كاملة.');
            ui.lCopy.focus({ preventScroll: true });
          }, function () {
            busyLink([ui.lYes, ui.lNo], false);
            linkMode = '';
            sayLink(st.link ? 'on' : 'none', true, 'ما زبطت. تأكد من النت وجرّب مرة ثانية.');
          });
          return;
        }
        a.stopTreeLink().then(function () {
          busyLink([ui.lYes, ui.lNo], false);
          var wasOpen = st.linkOpen;
          st.link = null; st.linkOpen = false; linkMode = '';
          sayLink('none', false, wasOpen ? 'وقّفنا الرابط، وما عاد ينفتح.' : 'وقّفنا الرابط، وما عاد ينفتح حتى بالباسورد.');
          ui.lClose.focus();
        }, function () {
          busyLink([ui.lYes, ui.lNo], false);
          linkMode = '';
          sayLink('on', true, 'ما قدرنا نوقّفه الحين. تأكد من النت وجرّب مرة ثانية.');
        });
      });
    }

    // «ترتيب»: gathers a wide tree into the shape of the screen (and of the pictures), or back to generations.
    if (ui.tidy) ui.tidy.addEventListener('click', function () {
      if (!st.doc) return;
      var on = !(st.doc.o && st.doc.o.tidy);
      setOpt('tidy', on);
      st.zl = 0; st.fitNext = on; st.center = true;
      changed();
    });
    var resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        if (!st.L) return;
        // a tidy tree takes the shape of the screen, so a new width lays it out again
        if (st.doc && shown() && Math.max(240, ui.scroll.clientWidth - 36) !== st.boxW) draw(); else sizeStage();
      }, 120);
    });

    // kin.js calls this when the page switches between «شنو يصير لك؟» and the tree.
    TREE.shown = function (isTree) {
      if (!isTree || !st.doc) return;
      st.center = true;
      render();
    };

    /* For «شنو يصير لك؟» (kin.js): the tree as it is now (null while it loads), and a way to put a walk
       from it into the tree (see addWalk). Returns what addWalk returns. */
    TREE.current = function () { return st.loaded && !st.failed ? st.doc : null; };
    TREE.addFromFinder = function (steps, name) {
      if (!st.doc) return null;
      var r = addWalk(st.doc, steps, name);
      if (!r) return null;
      st.doc = r.doc; st.lastAdded = r.pid;
      TREE.reveal(r.pid);
      changed();
      return r;
    };
    // The next time the tree shows, it opens on the side this person is on, with them in the middle.
    TREE.reveal = function (pid) {
      var doc = st.doc;
      if (!doc || !doc.p[pid]) return;
      var idx = index(doc), on = views(doc, idx).filter(function (v) {
        return layout(doc, idx, v, SCREEN, { ghosts: false, mates: 'all' }).nodes.some(function (n) { return n.pid === pid; });
      })[0];
      if (on) st.view = on.key;
      st.focus = pid; st.center = true;
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
