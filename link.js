/* شرباكة: the page a «رابط الشجرة» opens (shorbaka.com/t/#code). A link without a password shows the
   whole tree to look at straight away (tree.js draws it); otherwise the page asks for the password the
   owner gave. The password stays with this tab only, so a reload doesn't ask again. */
(function (root) {
  'use strict';

  var API = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/open_tree_link';
  var FREE = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/open_free_tree_link';
  var KEY = 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe';  // public key: the password is what guards the tree
  var KEPT = 'shorbaka.link.';

  var $ = function (id) { return document.getElementById(id); };
  var ui = {
    main: $('t-main'), title: $('t-title'), sub: $('t-sub'), count: $('t-count'),
    form: $('t-form'), pass: $('t-pass'), go: $('t-go'), err: $('t-err'),
    bar: $('t-bar'), side: $('t-side'), tidy: $('t-tidy'), zoom: $('t-zoom'),
    scroll: $('t-scroll'), stage: $('t-stage'), canvas: $('t-canvas'), only: $('t-only')
  };
  if (!ui.form || !root.TREE) return;

  // the password as the owner's page kept it (٠١٢٣ is 0123, capitals and أ/ا don't matter)
  var plain = root.TREE.plainPw;

  var code = '';
  try { code = decodeURIComponent(location.hash.replace(/^#/, '')).trim().toLowerCase(); } catch (e) {}

  function kept() { try { return sessionStorage.getItem(KEPT + code) || ''; } catch (e) { return ''; } }
  function keep(pw) { try { if (pw) sessionStorage.setItem(KEPT + code, pw); else sessionStorage.removeItem(KEPT + code); } catch (e) {} }

  function say(text) {
    ui.err.textContent = text;
    ui.err.hidden = !text;
  }

  function busy(on) {
    ui.go.disabled = on;
    ui.go.querySelector('span').textContent = on ? 'لحظة…' : 'افتح الشجرة';
  }

  function people(n) { return n === 1 ? 'شخص واحد' : n === 2 ? 'شخصين' : n <= 10 ? n + ' أشخاص' : n + ' شخص'; }

  function show(doc) {
    var me = doc.p[doc.me], name = (me && me.n) || '';
    ui.title.textContent = doc.fn ? 'شجرة عائلة ' + doc.fn : name ? 'شجرة عائلة ' + name : 'شجرة عائلة';
    document.title = ui.title.textContent + ' | شرباكة';
    ui.sub.textContent = !name ? 'تحت كل اسم شنو يصير لصاحب الشجرة.' :
      name + (me.g === 'f' ? ' كاتبة تحت كل اسم شنو يصير لها.' : ' كاتب تحت كل اسم شنو يصير له.');
    var n = Object.keys(doc.p).length;
    ui.count.innerHTML = '';
    var b = document.createElement('b'); b.textContent = people(n);
    var s = document.createElement('span'); s.textContent = 'الله يحفظهم';
    ui.count.appendChild(b); ui.count.appendChild(document.createTextNode(' · ')); ui.count.appendChild(s);
    ui.count.hidden = false;
    ui.form.hidden = true;
    ui.bar.hidden = false; ui.scroll.hidden = false; ui.only.hidden = false;
    ui.main.classList.add('is-open');
    root.TREE.viewer({ side: ui.side, tidy: ui.tidy, zoom: ui.zoom, scroll: ui.scroll, stage: ui.stage, canvas: ui.canvas }, doc);
  }

  function rpc(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  /* First: a link without a password opens straight away. A link with one, or a database from before
     links without one, or no answer: the password form, as always. Resolves true when that's settled. */
  function tryFree() {
    var was = ui.sub.textContent;
    ui.form.hidden = true;
    ui.sub.textContent = 'لحظة…';
    return rpc(FREE, { link: code }).then(function (res) {
      var doc = res && res.tree ? root.TREE.clean(res.tree) : null;
      ui.sub.textContent = was;
      if (doc) { show(doc); return true; }
      if (res && res.error === 'gone') { gone(); return true; }
      if (res && res.error === 'empty') { ui.sub.textContent = 'الشجرة فاضية للحين.'; return true; }
      ui.form.hidden = false;
      return false;
    }, function () {
      ui.sub.textContent = was;
      ui.form.hidden = false;
      return false;
    });
  }

  function open(pw, quiet) {
    busy(true);
    say('');
    return rpc(API, { link: code, password: pw }).then(function (res) {
      busy(false);
      var doc = res && res.tree ? root.TREE.clean(res.tree) : null;
      if (doc) { keep(pw); show(doc); return; }
      keep('');
      var e = res && res.error;
      if (e === 'wrong') say(quiet ? '' : 'الباسورد غلط. تأكد منه من صاحب الشجرة.');
      else if (e === 'wait') say('الرابط وقف شوي لأن الباسورد انكتب غلط وايد. جرّب بعد ' + (res.minutes || 60) + ' دقيقة.');
      else if (e === 'gone') gone();
      else say('الشجرة فاضية للحين.');
      if (!quiet && e === 'wrong') { ui.pass.select(); }
    }).catch(function () {
      busy(false);
      say('ما قدرنا نفتحها الحين. تأكد من النت وجرّب مرة ثانية.');
    });
  }

  function gone() {
    ui.sub.textContent = 'هالرابط موقّف أو مو موجود. اطلب الرابط الجديد من صاحب الشجرة.';
    ui.form.hidden = true;
  }

  // another link opened in the same tab
  window.addEventListener('hashchange', function () { location.reload(); });

  ui.form.addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = plain(ui.pass.value);
    if (!pw) { say('اكتب الباسورد.'); ui.pass.focus(); return; }
    ui.pass.blur();
    open(pw);
  });

  if (!/^[a-z0-9]{10}$/.test(code)) {
    ui.sub.textContent = 'الرابط ناقص. تأكد إنك نسخته كامل، أو اطلبه مرة ثانية من صاحب الشجرة.';
    ui.form.hidden = true;
    return;
  }
  tryFree().then(function (done) {
    if (done) return;
    var pw = kept();
    if (pw) open(pw, true); else setTimeout(function () { ui.pass.focus(); }, 300);
  });
})(window);
