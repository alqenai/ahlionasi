/* شرباكة: the page a «رابط ربعي» opens (shorbaka.com/f/#code). There is no password (Ali's call): all
   the friends and their groups show straight away, to look at only (friends.js draws them). With «بس اسمي»
   on, the database sends the friends without their names. */
(function (root) {
  'use strict';

  var API = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/open_friends_link';
  var KEY = 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe';  // the public key: the link's code is what opens them

  var $ = function (id) { return document.getElementById(id); };
  var ui = {
    main: $('t-main'), title: $('t-title'), sub: $('t-sub'), count: $('t-count'), retry: $('t-retry'),
    bar: $('t-bar'), zoom: $('t-zoom'), scroll: $('t-scroll'), stage: $('t-stage'), canvas: $('t-canvas'), only: $('t-only')
  };
  var F = root.FRIENDS;
  if (!ui.canvas || !F || !F.viewer) return;

  var code = '';
  try { code = decodeURIComponent(location.hash.replace(/^#/, '')).trim().toLowerCase(); } catch (e) {}

  function say(text, again) {
    ui.sub.textContent = text;
    ui.sub.hidden = !text;
    ui.retry.hidden = !again;
  }

  function show(doc) {
    ui.title.textContent = doc.me ? 'ربع ' + doc.me : 'ربعي';
    document.title = ui.title.textContent + ' | شرباكة';
    say('');
    // «16 صديق · 4 قروبات», as on the site
    ui.count.textContent = '';
    ui.count.appendChild(document.createElement('b')).textContent = F.friendsN(Object.keys(doc.p).length);
    ui.count.appendChild(document.createTextNode(' · '));
    ui.count.appendChild(document.createElement('span')).textContent = F.groupsN(Object.keys(doc.g).length);
    ui.count.hidden = false;
    ui.bar.hidden = false; ui.scroll.hidden = false; ui.only.hidden = false;
    ui.main.classList.add('is-open');
    F.viewer({ zoom: ui.zoom, scroll: ui.scroll, stage: ui.stage, canvas: ui.canvas }, doc);
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
      var doc = res && res.map ? F.clean(res.map) : null;
      if (doc && Object.keys(doc.g).length) show(doc);
      else if (res && res.error === 'gone') say('هالرابط موقّف أو مو موجود. اطلب الرابط الجديد من صاحبه.');
      else say('ما فيه ربع للحين.');
    }).catch(function () {
      say('ما قدرنا نفتحه الحين. تأكد من النت وجرّب مرة ثانية.', true);
    });
  }

  // another link opened in the same tab
  window.addEventListener('hashchange', function () { location.reload(); });
  ui.retry.addEventListener('click', open);

  if (!/^[a-z0-9]{10}$/.test(code)) {
    say('الرابط ناقص. تأكد إنك نسخته كامل، أو اطلبه مرة ثانية من صاحبه.');
    return;
  }
  open();
})(window);
