/* شرباكة: مفاتيح المزايا. What the admins turned on or off from the dashboard (/dash/ → «المزايا»).
   window.SHORBAKA_FLAGS starts from the defaults (and the last answer kept on this device), then the
   site asks Supabase; when the answer changes something, a 'shorbaka:flags' event goes out on window.
   A part that is off is only hidden: what people saved for it stays. */
(function () {
  'use strict';
  var URL = 'https://jfvbubrhghmivdjfbcku.supabase.co/rest/v1/rpc/site_flags';
  var KEY = 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe';  // public key
  var KEEP = 'shorbaka.flags';
  var DEFAULTS = { divorce: false };  // what the site does before (or without) an answer

  function merge(raw) {
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = raw && typeof raw[k] === 'boolean' ? raw[k] : DEFAULTS[k]; });
    return out;
  }
  var kept = null;
  try { kept = JSON.parse(localStorage.getItem(KEEP) || 'null'); } catch (e) {}
  var flags = window.SHORBAKA_FLAGS = merge(kept);

  if (typeof fetch !== 'function') return;
  fetch(URL, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' }, body: '{}' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (raw) {
      if (!raw || typeof raw !== 'object') return;
      var next = merge(raw), changed = Object.keys(next).some(function (k) { return next[k] !== flags[k]; });
      try { localStorage.setItem(KEEP, JSON.stringify(next)); } catch (e) {}
      if (!changed) return;
      flags = window.SHORBAKA_FLAGS = next;
      try { window.dispatchEvent(new Event('shorbaka:flags')); } catch (e) {}
    }, function () {});
})();
