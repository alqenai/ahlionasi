/* شرباكة: the page a «رابط الشجرة كاملة» of «شجرة دوامي» opens (shorbaka.com/w/#code). There is no
   password (Ali's call): the whole work tree shows straight away, to look at only (work.js draws it). */
(function (root) {
  'use strict';

  var API = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/open_work_link';
  var KEY = 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe';  // the public key: the link's code is what opens the tree

  var $ = function (id) { return document.getElementById(id); };
  var ui = {
    main: $('t-main'), title: $('t-title'), sub: $('t-sub'), count: $('t-count'), retry: $('t-retry'), keys: $('t-keys'),
    bar: $('t-bar'), tidy: $('t-tidy'), zoom: $('t-zoom'), scroll: $('t-scroll'), stage: $('t-stage'), canvas: $('t-canvas'),
    only: $('t-only')
  };
  if (!ui.canvas || !root.WORK || !root.WORK.viewer) return;

  var code = '';
  try { code = decodeURIComponent(location.hash.replace(/^#/, '')).trim().toLowerCase(); } catch (e) {}

  function people(n) { return n === 1 ? 'شخص واحد' : n === 2 ? 'شخصين' : n <= 10 ? n + ' أشخاص' : n + ' شخص'; }

  function say(text, again) {
    ui.sub.textContent = text;
    ui.sub.hidden = !text;
    ui.retry.hidden = !again;
  }

  function show(doc) {
    var me = doc.p[doc.me], name = (me && me.n) || '';
    // the company's name, or whose tree it is (a hidden name leaves just «شجرة دوام»)
    ui.title.textContent = doc.co || (name ? 'شجرة دوام ' + name : 'شجرة دوام');
    document.title = ui.title.textContent + ' | شرباكة';
    say(doc.co && name ? 'شجرة دوام ' + name : '');
    ui.count.textContent = '';
    ui.count.appendChild(document.createElement('b')).textContent = people(Object.keys(doc.p).length);
    ui.count.hidden = false;
    ui.bar.hidden = false; ui.scroll.hidden = false; ui.only.hidden = false;
    ui.main.classList.add('is-open');
    root.WORK.viewer({ tidy: ui.tidy, zoom: ui.zoom, scroll: ui.scroll, stage: ui.stage, canvas: ui.canvas, keys: ui.keys }, doc);
  }

  function open() {
    say('لحظة…');
    fetch(API, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ link: code })
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (res) {
      var doc = res && res.tree ? root.WORK.clean(res.tree) : null;
      if (doc) show(doc);
      else if (res && res.error === 'gone') say('هالرابط موقّف أو مو موجود. اطلب الرابط الجديد من صاحب الشجرة.');
      else say('الشجرة فاضية للحين.');
    }).catch(function () {
      say('ما قدرنا نفتحها الحين. تأكد من النت وجرّب مرة ثانية.', true);
    });
  }

  // another link opened in the same tab
  window.addEventListener('hashchange', function () { location.reload(); });
  ui.retry.addEventListener('click', open);

  if (!/^[a-z0-9]{10}$/.test(code)) {
    say('الرابط ناقص. تأكد إنك نسخته كامل، أو اطلبه مرة ثانية من صاحب الشجرة.');
    return;
  }
  open();
})(window);
