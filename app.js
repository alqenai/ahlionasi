/* شرباكة as an app on the phone (PWA). Registers the service worker (sw.js), and runs the
   «نزّل التطبيق» button in the header:
   - Android and computers: the browser's own install prompt, once the browser offers one.
   - iPhone and iPad, which have no prompt: a sheet with the steps (Share → Add to Home Screen).
   - Inside Instagram and other apps' browsers: the sheet says to open the page in Safari or Chrome first.
   Hidden when the site already runs as the app. */
(function (root) {
  'use strict';

  var doc = root.document, nav = root.navigator;

  if ('serviceWorker' in nav) {
    root.addEventListener('load', function () {
      nav.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function () {});
    });
  }

  function $(id) { return doc.getElementById(id); }
  var ui = { btn: $('app-btn'), sheet: $('app-sheet'), close: $('app-close'), ios: $('app-ios'), inApp: $('app-inapp'), note: $('app-note') };
  if (!ui.btn || !ui.sheet) return;

  var ua = nav.userAgent || '';
  var apple = /iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);  // iPadOS calls itself a Mac
  var inApp = /Instagram|FBAN|FBAV|FB_IAB|Snapchat|musical_ly|Bytedance|TikTok|; wv\)/i.test(ua) ||
    (apple && !/Safari\//.test(ua) && !nav.standalone);
  var offer = null, from = null;

  function installed() {
    return nav.standalone === true || !!(root.matchMedia && root.matchMedia('(display-mode: standalone)').matches);
  }

  function show() { ui.btn.hidden = installed() || !(offer || apple || inApp); }

  if (installed()) doc.documentElement.classList.add('is-app');
  show();

  root.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();  // our button asks instead of the browser's bar
    offer = e;
    show();
  });
  root.addEventListener('appinstalled', function () {
    offer = null;
    ui.btn.hidden = true;
    closeSheet();
  });

  ui.btn.addEventListener('click', function () {
    if (offer) {
      var o = offer;
      offer = null;  // a prompt can be shown once
      o.prompt();
      Promise.resolve(o.userChoice).then(function (c) {
        if (c && c.outcome === 'accepted') ui.btn.hidden = true; else show();
      }, show);
      return;
    }
    openSheet();
  });

  /* On iPhone the app keeps its own storage, apart from Safari: whoever is signed in signs in once
     more inside it, and what is kept only in this browser stays here. */
  function noteText() {
    if (!apple || inApp) return '';
    var a = root.ACCOUNT;
    if (a && a.on && a.on() && a.user && a.user()) return 'بالتطبيق بتحتاج تسجّل دخولك مرة وحدة، وبعدها تلقى كل شي.';
    return keptHere() ? 'شجرتك محفوظة بهالمتصفح بس، والتطبيق ما يشوفها. سجّل دخولك أول عشان تنحفظ بحسابك وتلقاها بالتطبيق.' : '';
  }

  function keptHere() {
    try {
      var tree = JSON.parse(root.localStorage.getItem('shorbaka.tree.v1') || 'null');
      var saved = JSON.parse(root.localStorage.getItem('shorbaka.wallet.v1') || '[]');
      return !!(tree && tree.p && Object.keys(tree.p).length > 1) || (Array.isArray(saved) && saved.length > 0);
    } catch (e) { return false; }
  }

  function openSheet() {
    from = doc.activeElement;
    ui.ios.hidden = inApp;
    ui.inApp.hidden = !inApp;
    var note = noteText();
    ui.note.textContent = note;
    ui.note.hidden = !note;
    ui.sheet.hidden = false;
    doc.documentElement.classList.add('kin-lock');
    ui.close.focus();
  }

  function closeSheet() {
    if (ui.sheet.hidden) return;
    ui.sheet.hidden = true;
    doc.documentElement.classList.remove('kin-lock');
    if (from && doc.body.contains(from) && from.focus) from.focus({ preventScroll: true });
    from = null;
  }

  ui.close.addEventListener('click', closeSheet);
  ui.sheet.addEventListener('click', function (e) { if (e.target === ui.sheet) closeSheet(); });
  doc.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !ui.sheet.hidden) { e.stopPropagation(); closeSheet(); }
  });
})(window);
