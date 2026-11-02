/* شرباكة: the service worker. It lets the site install as an app on the phone, and open without a
   connection once it has been opened online.
   - Pages: from the network first, so a new version shows straight away; the kept copy when offline,
     or when the network takes too long.
   - The site's own files: kept. Those whose names change with each version (?v=, /vendor/) are
     fetched once; the rest are refreshed in the background.
   - Google Fonts: kept, so the letters stay right offline.
   - Everything else is left alone: Supabase, Google sign-in, other sites, and the dashboard (/dash/). */
'use strict';

var VERSION = 2;
var SITE = 'shorbaka-site-' + VERSION, FONTS = 'shorbaka-fonts-' + VERSION;
var PAGE_WAIT = 4000;  // ms before a slow network gives way to the kept copy of a page
var FONTS_MAX = 40;

self.addEventListener('install', function (event) {
  event.waitUntil(keepStart().catch(function () {}).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) {
      return /^shorbaka-/.test(n) && n !== SITE && n !== FONTS;
    }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (/^\/dash(\/|$)/.test(url.pathname) || url.pathname === '/sw.js') return;
    event.respondWith(req.mode === 'navigate' ? page(event, url) : file(event, req, url));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(font(event, req));
  }
});

/* The start page and the files it names (and the libraries those scripts load), so the app opens
   offline from the next time on. */
function keepStart() {
  return caches.open(SITE).then(function (cache) {
    return fetch('/', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) return;
      return res.clone().text().then(function (html) {
        return cache.put(pageKey(new URL('/', self.location.origin)), res).then(function () {
          return Promise.all(named(html).map(function (path) { return keepFile(cache, path, true); }));
        });
      });
    });
  });
}

// A script brings the libraries it loads (/vendor/); the manifest brings the app icons.
function keepFile(cache, path, follow) {
  return fetch(path).then(function (res) {
    if (!res.ok) return;
    var copy = res.clone(), p = new URL(path, self.location.origin).pathname;
    var js = /\.js$/.test(p), manifest = /\.webmanifest$/.test(p);
    return (follow && (js || manifest) ? res.text() : Promise.resolve('')).then(function (text) {
      return put(cache, path, copy).then(function () {
        return Promise.all(named(text).filter(function (q) { return manifest || /^\/vendor\//.test(q); }).map(function (q) {
          return keepFile(cache, q, false);
        }));
      });
    });
  }).catch(function () {});
}

// The site's own files a page or script names: "/kin.js?v=20", "/vendor/supabase-2.117.3.js", icons...
function named(text) {
  var out = [], re = /["'](\/(?!\/)[^"'\s#<>]*?\.(?:js|png|svg|ico|webmanifest)(?:\?[^"'\s#<>]*)?)["']/g, m;
  while ((m = re.exec(text))) if (out.indexOf(m[1]) < 0 && !/^\/dash\//.test(m[1])) out.push(m[1]);
  return out;
}

// Keeps a file, dropping the copies of its other versions (/kin.js?v=19 when /kin.js?v=20 comes).
function put(cache, path, res) {
  var u = new URL(path, self.location.origin);
  return cache.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      var o = new URL(k.url);
      return o.pathname === u.pathname && o.search !== u.search;
    }).map(function (k) { return cache.delete(k); }));
  }).then(function () { return cache.put(u.href, res); });
}

// Pages are kept by their path: /?email=1 and / are the same page.
function pageKey(url) { return url.origin + url.pathname; }

function page(event, url) {
  var key = pageKey(url), kept, keeping = new Promise(function (resolve) { kept = resolve; });
  event.waitUntil(keeping);  // the copy of the fresh page, written even after a kept copy answered
  return caches.open(SITE).then(function (cache) {
    var old = function () {
      return cache.match(key).then(function (hit) { return hit || cache.match(pageKey(new URL('/', url.origin))); });
    };
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        old().then(function (hit) { if (hit && !done) { done = true; resolve(hit); } });
      }, PAGE_WAIT);
      fetch(event.request).then(function (res) {
        clearTimeout(timer);
        kept(res.ok && res.type === 'basic' ? cache.put(key, res.clone()).catch(function () {}) : null);
        if (!done) { done = true; resolve(res); }
      }, function (err) {
        clearTimeout(timer);
        kept(null);
        old().then(function (hit) {
          if (done) return;
          done = true;
          if (hit) resolve(hit); else reject(err);
        });
      });
    });
  }).catch(function () { kept(null); return fetch(event.request); });  // no storage here: the network alone
}

function file(event, req, url) {
  var fixed = /(^|&)v=/.test(url.search.slice(1)) || /^\/vendor\//.test(url.pathname);
  return caches.open(SITE).then(function (cache) {
    return cache.match(req).then(function (hit) {
      if (hit && fixed) return hit;
      var fresh = fetch(req).then(function (res) {
        if (!res.ok || res.type !== 'basic') return res;
        return put(cache, req.url, res.clone()).then(function () { return res; }, function () { return res; });
      });
      if (!hit) return fresh;
      event.waitUntil(fresh.catch(function () {}));
      return hit;
    });
  }).catch(function () { return fetch(req); });
}

// The stylesheet is refreshed in the background; the font files never change.
function font(event, req) {
  return caches.open(FONTS).then(function (cache) {
    return cache.match(req).then(function (hit) {
      var css = /fonts\.googleapis\.com$/.test(new URL(req.url).hostname);
      if (hit && !css) return hit;
      var fresh = fetch(req).then(function (res) {
        if (res.ok || res.type === 'opaque') {
          return cache.put(req, res.clone()).then(function () { return trim(cache); }).then(function () { return res; }, function () { return res; });
        }
        return res;
      });
      if (!hit) return fresh;
      event.waitUntil(fresh.catch(function () {}));
      return hit;
    });
  }).catch(function () { return fetch(req); });
}

function trim(cache) {
  return cache.keys().then(function (keys) {
    return Promise.all(keys.slice(0, Math.max(0, keys.length - FONTS_MAX)).map(function (k) { return cache.delete(k); }));
  });
}
