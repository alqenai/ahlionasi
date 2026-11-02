/* شرباكة: «اقترح إضافة» on the page a «رابط الشجرة» opens (shorbaka.com/t/#code), when the link has
   a password. Whoever opened it writes their name, taps anyone in the tree to add their relatives (a
   son, a wife, a brother…), and sends what they added to the tree's owner. Nothing changes in the
   owner's tree until the owner picks what to add (tree.js, on their own page).
   What is sent is the steps taken, in order (tree.js cleanSteps): each new person is built on someone
   already in the tree or on an earlier step. */
(function (root) {
  'use strict';

  var T = root.TREE, KIN = root.KIN;
  if (!T || !KIN || typeof document === 'undefined') return;
  var NAME_KEY = 'shorbaka.suggest.name';

  var $ = function (id) { return document.getElementById(id); };
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
  function getName() { try { return sessionStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function setName(n) { try { sessionStorage.setItem(NAME_KEY, n); } catch (e) {} }

  function start(base, els, link) {
    var ui = {
      box: $('sg'), ask: $('sg-ask'), askText: $('sg-ask-text'), startBtn: $('sg-start'),
      who: $('sg-who'), name: $('sg-name'), whoNote: $('sg-who-note'),
      on: $('sg-on'), count: $('sg-count'), send: $('sg-send'), stop: $('sg-stop'), err: $('sg-err'), ok: $('sg-ok'),
      only: $('t-only'),
      sheet: $('sg-sheet'), who2: $('sg-p-who'), av: $('sg-p-av'), title: $('sg-p-title'), rel: $('sg-p-rel'), close: $('sg-p-close'),
      label: $('sg-p-label'), adds: $('sg-p-adds'), form: $('sg-p-form'), unions: $('sg-p-unions'), formLabel: $('sg-p-form-label'),
      input: $('sg-p-new'), done: $('sg-p-done'), del: $('sg-p-del')
    };
    if (!ui.box || !ui.sheet) { T.viewer(els, base); return; }

    // the owner's «الأسامي» (tree.js hideOf): whose names stay hidden here, as in the pictures
    var hide = T.hideOf(base);
    var me = base.p[base.me] || {}, meF = me.g === 'f';
    // who the suggestions go to: the owner's name, unless it's a girl's name the owner keeps hidden
    var owner = (T.hides(base, base.me, hide) ? '' : String(me.n || '').trim()) || (meF ? 'صاحبة الشجرة' : 'صاحب الشجرة');
    var st = { on: false, from: '', ops: [], doc: base, person: null, adding: null, union: null, back: null };

    ui.askText.textContent = 'تعرف أحد مو موجود بالشجرة؟ ولد، بنت، زوجة… ضيفه واقترحه على ' + owner + '.';
    ui.whoNote.textContent = 'يوصل اسمك مع اقتراحك لـ' + owner + '.';
    ui.send.querySelector('span').textContent = 'أرسلها لـ' + owner;
    ui.box.hidden = false;

    function marked() {
      var m = {};
      st.ops.forEach(function (op) { m[op.id] = 1; });
      return m;
    }
    // the viewer keeps the options it started with, so the marks (who is suggested) change inside them
    var vopts = { tap: tap, marked: {} };
    var view = T.viewer(els, base, vopts);
    function reView(fresh) {
      var m = marked();
      Object.keys(vopts.marked).forEach(function (k) { delete vopts.marked[k]; });
      Object.keys(m).forEach(function (k) { vopts.marked[k] = 1; });
      view.set(st.doc, fresh);
    }

    function counts() {
      var n = st.ops.length;
      ui.count.textContent = !n ? 'للحين ما ضفت أحد.' : n === 1 ? 'ضفت شخص واحد.' : n === 2 ? 'ضفت شخصين.' : 'ضفت ' + n + (n <= 10 ? ' أشخاص.' : ' شخص.');
      ui.send.disabled = !n;
    }
    function err(text) { ui.err.textContent = text || ''; ui.err.hidden = !text; }

    function mode(on) {
      st.on = on;
      ui.ask.hidden = on;
      ui.who.hidden = true;
      ui.on.hidden = !on;
      ui.only.textContent = on ? 'اللي تضيفه يوصل لـ' + owner + ' كاقتراح، وما يتغيّر شي بالشجرة إلا إذا وافق.' : 'هذي شجرة تشوفها بس، وما تقدر تغيّر فيها شي.';
      err('');
      counts();
    }

    ui.startBtn.addEventListener('click', function () {
      ui.ok.hidden = true;
      ui.ask.hidden = true;
      ui.who.hidden = false;
      ui.name.value = getName();
      ui.name.focus();
    });
    ui.who.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = T.cleanName(ui.name.value);
      if (!n) { ui.name.focus(); return; }
      st.from = n; setName(n);
      mode(true);
      ui.on.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    ui.stop.addEventListener('click', function () {
      if (st.ops.length && !confirm('تلغي الإضافات اللي سويتها؟')) return;
      st.ops = []; st.doc = base;
      reView();
      mode(false);
    });

    /* --- tapping someone while suggesting: their sheet --- */

    function tap(n, box) {
      if (!st.on || !n.pid) return;
      st.person = n.pid; st.back = box; st.adding = null; st.union = null;
      ui.done.textContent = '';
      fill();
      ui.sheet.hidden = false;
      document.documentElement.classList.add('kin-lock');
      ui.close.focus();
    }
    function closeSheet() {
      if (ui.sheet.hidden) return;
      ui.sheet.hidden = true;
      document.documentElement.classList.remove('kin-lock');
      var back = st.back && document.body.contains(st.back) ? st.back : els.canvas.querySelector('[data-pid="' + st.person + '"]');
      st.person = null;
      if (back) back.focus({ preventScroll: true });
    }
    ui.close.addEventListener('click', closeSheet);
    ui.sheet.addEventListener('click', function (e) { if (e.target === ui.sheet) closeSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

    function preview(pid, t, fid) {
      var d = T.copy(st.doc), id = T.addRelative(d, pid, t, '…', fid), i = T.index(d);
      return id ? T.relLabel(d, i, T.relations(d, i), id) : '';
    }

    function fill() {
      var doc = st.doc, pid = st.person, p = doc.p[pid];
      if (!p) { closeSheet(); return; }
      var idx = T.index(doc), rels = T.relations(doc, idx), isMe = pid === doc.me, hid = T.hides(doc, pid, hide) && !marked()[pid];
      var shown = hid ? '' : p.n;
      ui.av.textContent = hid ? '' : initial(p.n);
      ui.who2.className = 'tr-p-who' + (isMe ? ' is-me' : p.g === 'f' ? ' is-f' : '');
      var rel = T.relLabel(doc, idx, rels, pid);
      ui.title.textContent = isMe ? (shown || owner) : (shown || rel);
      ui.rel.textContent = isMe ? 'صاحب الشجرة' : (shown ? KIN.verb(rels[pid]) + ' ' + rel + ' لـ' + owner : 'لـ' + owner);
      if (isMe && meF) ui.rel.textContent = 'صاحبة الشجرة';
      var who = isMe ? owner : (shown || 'هالشخص');
      var list = T.choices(doc, idx, pid, T.lineSet(doc, idx), T.allHeads(doc, idx));
      ui.label.textContent = 'ضيف من أهل ' + who + ':';
      ui.adds.textContent = '';
      list.forEach(function (t) {
        var c = el('button', 'tr-chip', relOf(t, p));
        c.type = 'button';
        c.dataset.t = t;
        c.setAttribute('aria-pressed', String(st.adding === t));
        c.addEventListener('click', function () { if (st.adding === t) stopAdd(); else startAdd(t); });
        ui.adds.appendChild(c);
      });
      if (st.adding && list.indexOf(st.adding) < 0) stopAdd();
      var mine = marked()[pid];
      ui.del.hidden = !mine;
      if (mine) ui.del.textContent = 'شيل ' + (p.n || 'هالإضافة') + ' من اقتراحك';
    }

    // the chip says it plainly from that person: «أبوه»، «أختها»، «ولده»...
    function relOf(t, p) {
      var f = p.g === 'f';
      var w = { F: 'أبو', M: 'أم', B: 'أخو', Z: 'أخت', S: 'ولد', D: 'بنت', H: 'زوج', W: 'زوجة' }[t];
      return w + (f ? 'ها' : 'ه');
    }

    function startAdd(t) {
      var doc = st.doc, idx = T.index(doc), unions = t === 'S' || t === 'D' ? (idx.unions[st.person] || []) : [], rels = null;
      st.adding = t;
      st.union = unions.length > 1 ? (unions.indexOf(st.union) >= 0 ? st.union : unions[0]) : null;
      Array.prototype.forEach.call(ui.adds.children, function (c) { c.setAttribute('aria-pressed', String(c.dataset.t === t)); });
      ui.form.hidden = false;
      ui.unions.textContent = '';
      ui.unions.hidden = unions.length < 2;
      if (unions.length > 1) {
        ui.unions.appendChild(el('span', null, doc.p[st.person].g === 'f' ? 'أبوه:' : 'أمه:'));
        unions.forEach(function (fid) {
          var x = doc.f[fid], mate = x.a === st.person ? x.b : x.a, mp = mate ? doc.p[mate] : null;
          // a hidden name: what that wife or husband is to the owner («زوجة عمي الثانية»)
          var label = !mp ? 'ما أعرف' : T.hides(doc, mate, hide) && !marked()[mate]
            ? T.relLabel(doc, idx, rels || (rels = T.relations(doc, idx)), mate) : (mp.n || '…');
          var b = el('button', 'tr-chip tr-chip-sm', label);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(fid === st.union));
          b.addEventListener('click', function () {
            st.union = fid;
            Array.prototype.forEach.call(ui.unions.querySelectorAll('button'), function (x2) { x2.setAttribute('aria-pressed', String(x2 === b)); });
            formLabel();
          });
          ui.unions.appendChild(b);
        });
      }
      formLabel();
      ui.input.value = '';
      ui.input.focus();
    }
    function formLabel() {
      var rel = preview(st.person, st.adding, st.union);
      ui.formLabel.textContent = rel ? 'اسم ' + rel + ' (لـ' + owner + ')' : 'الاسم';
      ui.input.setAttribute('aria-label', ui.formLabel.textContent);
    }
    function stopAdd() {
      st.adding = null; st.union = null;
      ui.form.hidden = true;
      Array.prototype.forEach.call(ui.adds.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
    }

    ui.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = T.cleanName(ui.input.value);
      if (!name) { ui.input.focus(); return; }
      if (st.ops.length >= 100) { ui.done.textContent = 'وصلت لـ100 إضافة. أرسلها، وبعدين كمّل.'; return; }
      var d = T.copy(st.doc), fid = st.union, pid = st.person;
      var x = fid ? d.f[fid] : null, mate = x ? (x.a === pid ? x.b : x.a) : null;
      var id = T.addRelative(d, pid, st.adding, name, fid);
      if (!id) { ui.done.textContent = 'ما تنضاف هني.'; return; }
      st.ops.push({ id: id, of: pid, t: st.adding, n: name, mate: mate || null });
      st.doc = d;
      ui.done.textContent = 'انضاف ' + name + ' ✓';
      stopAdd();
      reView(id);
      fill();
      counts();
    });

    // takes away one suggested person and whatever was added on them, then puts the rest back in order
    ui.del.addEventListener('click', function () {
      var gone = {}, pid = st.person;
      gone[pid] = 1;
      st.ops.forEach(function (op) { if (gone[op.of] || (op.mate && gone[op.mate])) gone[op.id] = 1; });
      var keep = st.ops.filter(function (op) { return !gone[op.id]; });
      var r = T.replay(base, keep), map = r.map;
      st.ops = keep.filter(function (op) { return map[op.id]; }).map(function (op) {
        return { id: map[op.id], of: map[op.of] || op.of, t: op.t, n: op.n, mate: op.mate ? (map[op.mate] || op.mate) : null };
      });
      st.doc = r.doc;
      closeSheet();
      reView();
      counts();
    });

    /* --- sending --- */

    ui.send.addEventListener('click', function () {
      if (!st.ops.length) return;
      err('');
      ui.send.disabled = true;
      var label = ui.send.querySelector('span'), was = label.textContent;
      label.textContent = 'لحظة…';
      fetch(link.api, {
        method: 'POST',
        headers: { apikey: link.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: link.code, password: link.password, name: st.from, ops: T.cleanSteps(st.ops) })
      }).then(function (r) {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      }).then(function (res) {
        label.textContent = was;
        if (res && res.ok) {
          var n = st.ops.length;
          st.ops = []; st.doc = base;
          reView();
          mode(false);
          ui.ok.textContent = 'وصل اقتراحك لـ' + owner + ' (' + (n === 1 ? 'شخص واحد' : n === 2 ? 'شخصين' : n + ' أشخاص') + ')، شكرًا لك 🌿 إذا وافق بيبين بالشجرة.';
          ui.ok.hidden = false;
          return;
        }
        ui.send.disabled = false;
        var e = res && res.error;
        err(e === 'wrong' ? 'الباسورد تغيّر. افتح الرابط من جديد بالباسورد الجديد.'
          : e === 'open' ? owner + ' شال الباسورد من الرابط، والاقتراحات بس للروابط اللي فيها باسورد.'
          : e === 'gone' ? 'هالرابط موقّف. اطلب الرابط الجديد من ' + owner + '.'
          : e === 'full' ? 'عند ' + owner + ' اقتراحات وايد ما شافها للحين. جرّب بعدين.'
          : e === 'wait' ? 'وصلت اقتراحات وايد بهالساعة. جرّب بعد شوي.'
          : 'ما وصل الاقتراح. جرّب مرة ثانية.');
      }).catch(function () {
        label.textContent = was;
        ui.send.disabled = false;
        err('ما وصل الاقتراح. تأكد من النت وجرّب مرة ثانية.');
      });
    });

    window.addEventListener('beforeunload', function (e) {
      if (st.ops.length) { e.preventDefault(); e.returnValue = ''; }
    });
    counts();
  }

  root.SUGGEST = { start: start };
})(window);
