/* شرباكة: لوحة التحكم (shorbaka.com/dash/).
   Signing in is account.js, the same as on the site. Every number here comes from the admin_*
   functions in supabase/migrations/20261102_admin.sql, which answer only accounts in public.admins,
   so this page being public gives nobody anything. */
(function (root) {
  'use strict';

  var URL_ = 'https://jfvbubrhghmivdjfbcku.supabase.co';
  var KEY = 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe';  // public key: the admin check in the database guards the data
  var STORE = 'shorbaka.auth';  // where account.js keeps the session
  var PAGE = 50;

  var $ = function (id) { return document.getElementById(id); };
  var A = root.ACCOUNT;
  var gates = ['g-wait', 'g-in', 'g-no', 'g-setup', 'g-fail'];
  var state = { tab: 'overview', q: '', users: [], total: 0, loaded: {} };

  function gate(id) {
    gates.forEach(function (g) { $(g).hidden = g !== id; });
    $('dash').hidden = id !== 'dash';
  }

  function toast(text) {
    var t = $('toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* --- talking to the database --- */

  function token() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE) || 'null');
      return (s && (s.access_token || (s.currentSession && s.currentSession.access_token))) || '';
    } catch (e) { return ''; }
  }

  function rpc(name, args, retried) {
    return fetch(URL_ + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + (token() || KEY), 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {})
    }).then(function (res) {
      return res.text().then(function (txt) {
        var body = null;
        try { body = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (res.ok) return body;
        var err = new Error((body && body.message) || ('HTTP ' + res.status));
        err.status = res.status; err.code = body && body.code;
        throw err;
      });
    }).catch(function (e) {
      // an expired sign-in: account.js refreshes it, so wait a moment and go once more
      if (!retried && e.status === 401) {
        return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return rpc(name, args, true); });
      }
      throw e;
    });
  }

  function missing(e) { return e && (e.code === 'PGRST202' || e.code === '42883' || e.status === 404); }

  /* --- formatting: Arabic words, English digits, Kuwait time --- */

  var nf = new Intl.NumberFormat('en-US');
  function num(n) { return nf.format(n || 0); }
  var df = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { timeZone: 'Asia/Kuwait', day: 'numeric', month: 'short', year: 'numeric' });
  var tf = new Intl.DateTimeFormat('ar-KW-u-nu-latn', { timeZone: 'Asia/Kuwait', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  function date(s) { return s ? df.format(new Date(s)) : '—'; }
  function ago(s) {
    if (!s) return '—';
    var m = Math.round((Date.now() - Date.parse(s)) / 60000);
    if (m < 1) return 'الحين';
    if (m < 60) return 'قبل ' + m + ' دقيقة';
    var h = Math.round(m / 60);
    if (h < 24) return 'قبل ' + h + (h === 1 ? ' ساعة' : ' ساعات');
    var d = Math.round(h / 24);
    if (d < 8) return d === 1 ? 'أمس' : 'قبل ' + d + ' أيام';
    return tf.format(new Date(s));
  }
  function people(n) { return n === 1 ? 'شخص واحد' : num(n) + ' شخص'; }

  /* --- نظرة عامة --- */

  function tile(k, v, s) {
    var t = el('div', 'card tile');
    t.appendChild(el('div', 'k', k));
    t.appendChild(el('div', 'v', num(v)));
    if (s) { var p = el('div', 's'); p.innerHTML = s; t.appendChild(p); }
    return t;
  }

  function overview(o) {
    var tiles = $('tiles');
    tiles.textContent = '';
    tiles.appendChild(tile('المستخدمين', o.users, '<b>+' + num(o.users_today) + '</b> اليوم'));
    tiles.appendChild(tile('جدد بآخر 7 أيام', o.users_7d, num(o.users_30d) + ' بآخر 30 يوم'));
    tiles.appendChild(tile('دخلوا بآخر 7 أيام', o.active_7d));
    tiles.appendChild(tile('شجرات فيها أهل', o.trees, num(o.trees_7d) + ' تعدّلت بآخر 7 أيام'));
    tiles.appendChild(tile('أشخاص بالشجرات', o.tree_people));
    tiles.appendChild(tile('قرابات محفوظة', o.relations, num(o.relations_7d) + ' بآخر 7 أيام'));
    tiles.appendChild(tile('روابط شجرة', o.links));
    tiles.appendChild(tile('محظورين', o.blocked));

    // sign-ups per day: one series, so the title names it and there is no legend
    var days = o.days || [], max = 0;
    days.forEach(function (d) { max = Math.max(max, d.signups); });
    var top = Math.max(1, max), bars = $('bars'), table = $('days-table');
    bars.textContent = ''; table.textContent = '';
    var mid = el('div', 'gridline'); mid.style.bottom = '50%';
    var midLabel = el('span', null, top >= 2 ? num(Math.round(top / 2)) : ''); mid.appendChild(midLabel);
    var hi = el('div', 'gridline'); hi.style.bottom = '100%'; hi.appendChild(el('span', null, num(top)));
    bars.appendChild(hi); bars.appendChild(mid);
    var head = el('tr'); head.appendChild(el('th', null, 'اليوم')); head.appendChild(el('th', null, 'حسابات جديدة')); head.appendChild(el('th', null, 'قرابات'));
    table.appendChild(head);
    days.forEach(function (d) {
      var b = el('div', 'bar' + (d.signups ? '' : ' zero')), i = el('i');
      i.style.height = (d.signups / top * 100) + '%';
      b.appendChild(i);
      b.tabIndex = 0;
      var label = date(d.day + 'T12:00:00Z') + ': ' + (d.signups === 1 ? 'حساب واحد' : num(d.signups) + ' حساب');
      b.setAttribute('aria-label', label);
      var tip;
      var pos = days.indexOf(d);
      function showTip() {
        tip = el('div', 'tip', label);
        // keep the tip inside the card at both ends of the chart
        if (pos < 5) { tip.style.left = '0'; tip.style.transform = 'none'; }
        else if (pos > days.length - 6) { tip.style.right = '0'; tip.style.transform = 'none'; }
        else tip.style.left = '50%';
        b.appendChild(tip);
      }
      function hideTip() { if (tip) tip.remove(); tip = null; }
      b.addEventListener('mouseenter', showTip); b.addEventListener('mouseleave', hideTip);
      b.addEventListener('focus', showTip); b.addEventListener('blur', hideTip);
      bars.appendChild(b);
      var tr = el('tr');
      tr.appendChild(el('td', null, date(d.day + 'T12:00:00Z')));
      tr.appendChild(el('td', null, num(d.signups)));
      tr.appendChild(el('td', null, num(d.relations)));
      table.insertBefore(tr, table.children[1] || null);
    });
    var axis = $('axis');
    axis.textContent = '';
    if (days.length) {
      axis.appendChild(el('span', null, date(days[0].day + 'T12:00:00Z')));
      axis.appendChild(el('span', null, 'اليوم'));
    }

    meter($('meter'), $('legend'), [
      { label: 'Google', n: o.google, c: 'var(--teal)' },
      { label: 'الإيميل', n: o.email, c: 'var(--sand)' }
    ]);
    meter($('meter2'), $('legend2'), [
      { label: 'بباسورد', n: o.links - o.links_open, c: 'var(--teal)' },
      { label: 'بدون باسورد', n: o.links_open, c: 'var(--sand)' }
    ]);
  }

  function meter(bar, legend, parts) {
    var total = parts.reduce(function (s, p) { return s + (p.n || 0); }, 0);
    bar.textContent = ''; legend.textContent = '';
    parts.forEach(function (p) {
      if (total && p.n) { var i = el('i'); i.style.width = (p.n / total * 100) + '%'; i.style.background = p.c; bar.appendChild(i); }
      var s = el('span', null, p.label + ': ' + num(p.n) + (total ? ' (' + Math.round(p.n / total * 100) + '%)' : ''));
      s.style.setProperty('--c', p.c);
      legend.appendChild(s);
    });
  }

  /* --- المستخدمين --- */

  function userCard(u) {
    var c = el('article', 'card user');
    var top = el('div', 'top');
    top.appendChild(el('span', 'em', u.email || '(بدون إيميل)'));
    if (u.name) top.appendChild(el('span', 'chip', u.name));
    (u.providers || []).forEach(function (p) { top.appendChild(el('span', 'chip', p === 'google' ? 'Google' : p === 'email' ? 'إيميل' : p)); });
    if (u.admin) top.appendChild(el('span', 'chip admin', 'أدمن'));
    if (u.blocked) top.appendChild(el('span', 'chip blocked', 'محظور'));
    c.appendChild(top);

    var meta = el('div', 'meta');
    function m(k, v) { var s = el('span'); s.appendChild(document.createTextNode(k + ' ')); s.appendChild(el('b', null, v)); meta.appendChild(s); }
    m('سجّل', date(u.created_at));
    m('آخر دخول', ago(u.last_sign_in_at));
    m('الشجرة', u.people ? people(u.people) : 'ما بدأها');
    if (u.tree_at) m('آخر تعديل', ago(u.tree_at));
    m('قرابات', num(u.relations));
    m('رابط الشجرة', u.link === 'open' ? 'بدون باسورد' : u.link === 'password' ? 'بباسورد' : 'لا');
    c.appendChild(meta);

    if (!u.admin) {
      var acts = el('div', 'acts');
      var block = el('button', 'btn small', u.blocked ? 'فك الحظر' : 'حظر');
      block.type = 'button';
      block.onclick = function () {
        var q = u.blocked ? 'تفك الحظر عن ' + u.email + '؟' : 'تحظر ' + u.email + '؟ ما يقدر يدخل لين تفك الحظر، وبياناته تبقى.';
        if (!confirm(q)) return;
        act(block, 'admin_block', { target: u.id, block: !u.blocked }, u.blocked ? 'انفك الحظر' : 'انحظر');
      };
      acts.appendChild(block);
      if (u.link) {
        var stop = el('button', 'btn small', 'وقّف رابط الشجرة');
        stop.type = 'button';
        stop.onclick = function () {
          if (!confirm('توقف رابط شجرة ' + u.email + '؟ الرابط والـ QR اللي نشره ما راح يفتحون.')) return;
          act(stop, 'admin_stop_link', { target: u.id }, 'وقف الرابط');
        };
        acts.appendChild(stop);
      }
      var del = el('button', 'btn small danger', 'امسح الحساب');
      del.type = 'button';
      del.onclick = function () {
        var typed = prompt('بينمسح الحساب وكل اللي فيه (الشجرة والقرابات والرابط)، وما يرجع.\nاكتب الإيميل عشان تأكد:\n' + u.email);
        if (typed == null) return;
        if (typed.trim().toLowerCase() !== String(u.email || '').toLowerCase()) { toast('الإيميل مو نفسه، ما انمسح شي'); return; }
        act(del, 'admin_delete_user', { target: u.id }, 'انمسح الحساب');
      };
      acts.appendChild(del);
      c.appendChild(acts);
    }
    return c;
  }

  function act(btn, fn, args, done) {
    btn.disabled = true;
    rpc(fn, args).then(function () {
      toast(done);
      state.loaded = {};
      loadUsers(false);
    }).catch(function (e) {
      btn.disabled = false;
      toast('ما صار: ' + e.message);
    });
  }

  function loadUsers(more) {
    var skip = more ? state.users.length : 0;
    $('u-more').disabled = true;
    return rpc('admin_users', { q: state.q, lim: PAGE, skip: skip }).then(function (r) {
      state.users = (more ? state.users : []).concat(r.rows || []);
      state.total = r.total || 0;
      var box = $('users');
      if (!more) box.textContent = '';
      (r.rows || []).forEach(function (u) { box.appendChild(userCard(u)); });
      $('u-count').textContent = state.q
        ? num(state.total) + ' نتيجة لـ «' + state.q + '»'
        : num(state.total) + ' حساب، الأحدث فوق';
      $('u-more').hidden = state.users.length >= state.total;
      $('u-more').disabled = false;
      state.loaded.users = true;
    });
  }

  /* --- آخر الأحداث --- */

  var KINDS = {
    signup: ['حساب جديد', 'var(--teal)'],
    signin: ['دخل', 'var(--muted)'],
    tree: ['عدّل شجرته', 'var(--coral)'],
    relation: ['حفظ قرابة', 'var(--sand)'],
    link: ['سوّى رابط شجرة بباسورد', 'var(--pearl)'],
    link_open: ['سوّى رابط شجرة بدون باسورد', 'var(--pearl)'],
    'admin:block': ['حظرت', 'var(--coral)'],
    'admin:unblock': ['فكيت الحظر عن', 'var(--coral)'],
    'admin:stop_link': ['وقفت رابط شجرة', 'var(--coral)'],
    'admin:delete': ['مسحت حساب', 'var(--coral)']
  };

  function feed(list) {
    var ul = $('feed');
    ul.textContent = '';
    if (!list.length) { ul.appendChild(el('li', null, 'ما صار شي للحين.')); return; }
    list.forEach(function (e) {
      var k = KINDS[e.kind] || [e.kind, 'var(--muted)'];
      var li = el('li'), dot = el('span', 'dot');
      dot.style.setProperty('--c', k[1]);
      var txt = el('span', 'txt');
      txt.appendChild(document.createTextNode(k[0] + (e.kind === 'tree' && e.n ? ' (' + people(e.n) + ')' : '') + ' '));
      txt.appendChild(el('bdi', null, e.email || ''));
      var t = el('time', null, ago(e.at));
      t.dateTime = e.at; t.title = tf.format(new Date(e.at));
      li.appendChild(dot); li.appendChild(txt); li.appendChild(t);
      ul.appendChild(li);
    });
  }

  /* --- tabs and loading --- */

  function load(tab, force) {
    if (!force && state.loaded[tab]) return Promise.resolve();
    var p = tab === 'overview' ? rpc('admin_overview').then(overview)
      : tab === 'users' ? loadUsers(false)
      : rpc('admin_activity', { lim: 100 }).then(feed);
    return p.then(function () {
      state.loaded[tab] = true;
      $('stamp').textContent = 'آخر تحديث ' + tf.format(new Date());
    }).catch(function (e) { toast('ما قدرنا نجيبها: ' + e.message); });
  }

  function show(tab) {
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    ['overview', 'users', 'activity'].forEach(function (t) { $('p-' + t).hidden = t !== tab; });
    try { history.replaceState(null, '', '#' + tab); } catch (e) {}
    load(tab);
  }

  document.querySelectorAll('.tab').forEach(function (b) { b.onclick = function () { show(b.dataset.tab); }; });
  $('refresh').onclick = function () { state.loaded = {}; load(state.tab, true); };
  $('search').onsubmit = function (ev) { ev.preventDefault(); state.q = $('q').value.trim(); loadUsers(false).catch(function (e) { toast(e.message); }); };
  $('u-more').onclick = function () { loadUsers(true).catch(function (e) { toast(e.message); }); };
  $('signout').onclick = function () { A.signOut().then(function () { location.reload(); }); };

  /* --- who is here --- */

  var started;
  function start(user) {
    var id = user ? user.id : null;
    if (started !== undefined && started === id) return;
    started = id;
    if (!user) { signInGate(); return; }
    $('who').hidden = false;
    $('who-email').textContent = user.email || user.name || '';
    gate('g-wait');
    rpc('am_i_admin').then(function (yes) {
      if (!yes) {
        $('g-sql').textContent = "insert into public.admins (user_id) values ('" + user.id + "');";
        gate('g-no');
        return;
      }
      gate('dash');
      var t = (location.hash || '').replace('#', '');
      show(['overview', 'users', 'activity'].indexOf(t) >= 0 ? t : 'overview');
    }).catch(function (e) {
      if (missing(e)) { gate('g-setup'); return; }
      $('g-fail-msg').textContent = e.message;
      gate('g-fail');
    });
  }

  $('g-copy').onclick = function () {
    var text = $('g-sql').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('انتسخ'); }, function () { toast('حدد السطر وانسخه'); });
  };

  function err(text) { $('g-err').textContent = text || ''; $('g-err').hidden = !text; }

  function signInGate() {
    $('who').hidden = true;
    gate('g-in');
    A.googleButton($('g-google'), function (e) { if (e) err('ما زبط الدخول بـ Google، جرّب مرة ثانية أو بالإيميل.'); }).catch(function () { $('g-google').hidden = true; });
    var email = '';
    $('g-mail').onsubmit = function (ev) {
      ev.preventDefault(); err('');
      email = $('g-email').value.trim();
      A.sendEmailCode(email).then(function () {
        $('g-mail').hidden = true; $('g-code').hidden = false; $('g-otp').focus();
      }).catch(function (e) { err('ما انرسل الكود: ' + e.message); });
    };
    $('g-code').onsubmit = function (ev) {
      ev.preventDefault(); err('');
      var code = $('g-otp').value.replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); }).replace(/\D/g, '');
      A.verifyEmailCode(email, code).catch(function () { err('الكود مو صحيح، تأكد منه.'); });
    };
  }

  if (!A || !A.on()) { $('g-fail-msg').textContent = 'الحسابات مو شغالة بالموقع.'; gate('g-fail'); return; }
  A.ready.then(function () {
    start(A.user());
    A.onChange(function (u) { start(u); });
  });
})(window);
