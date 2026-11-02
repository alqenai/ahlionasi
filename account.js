/* شرباكة: the account (Google sign-in through Supabase) and the wallet kept in it.
   While CONFIG is empty, accounts stay off and the wallet lives on the device only. */
(function (root) {
  'use strict';

  var CONFIG = {
    supabaseUrl: 'https://jfvbubrhghmivdjfbcku.supabase.co',
    supabaseKey: 'sb_publishable_nom1uzSkzypbyYisBt2-dQ_psJfSZEe',  // public key, safe to ship: row-level security guards the data
    googleClientId: '715982042873-ps3ftqgqvdskeegi0m7nksadeqae4a81.apps.googleusercontent.com',  // public too: Google only honours it on https://shorbaka.com
    // Sign-in with a code sent by email. Supabase sends it through the site's own email service (Resend),
    // with supabase/templates/email-code.html as the email. false hides it (shorbaka.com/?email=1 still shows it).
    emailSignIn: true
  };

  var SUPABASE_JS = '/vendor/supabase-2.117.3.js';
  var GOOGLE_JS = 'https://accounts.google.com/gsi/client';

  var on = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey && CONFIG.googleClientId &&
    root.crypto && root.crypto.subtle && root.TextEncoder && root.Promise);
  var client = null, user = null, session = null, listeners = [], scripts = {};

  function script(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { delete scripts[src]; s.remove(); reject(new Error('could not load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  function toUser(u) {
    if (!u) return null;
    var m = u.user_metadata || {}, full = m.full_name || m.name || '';
    return { id: u.id, email: u.email || '', name: full, first: m.given_name || full.split(' ')[0] || '',
      picture: m.avatar_url || m.picture || '' };
  }

  // Listeners run on a later tick: Supabase asks not to call it again from inside its own auth callback.
  function setUser(u) {
    var next = toUser(u), changed = (next && next.id) !== (user && user.id);
    user = next;
    if (changed) setTimeout(function () { listeners.forEach(function (fn) { try { fn(user); } catch (e) {} }); }, 0);
  }

  /* A tree save can still be on its way when the page is closed or reloaded. keepalive lets it
     finish (browsers allow up to 64 KB); if the browser refuses, it goes again as a normal request. */
  function fetchKeep(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (init && init.method === 'POST' && /\/rest\/v1\/(family|work)_trees/.test(url) && typeof init.body === 'string' &&
        root.Blob && new Blob([init.body]).size < 60000) {
      return fetch(input, Object.assign({}, init, { keepalive: true })).catch(function () { return fetch(input, init); });
    }
    return fetch(input, init);
  }

  var ready = !on ? Promise.resolve(false) : script(SUPABASE_JS).then(function () {
    client = root.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'shorbaka.auth' },
      global: { fetch: fetchKeep }
    });
    client.auth.onAuthStateChange(function (event, s) { session = s || null; setUser(s && s.user); });
    return client.auth.getSession().then(function (r) {
      session = (r && r.data && r.data.session) || null;
      setUser(session && session.user);
      return true;
    });
  }).catch(function () { on = false; return false; });

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  // Google gets the hashed nonce, Supabase the raw one, so a stolen token cannot be replayed.
  function nonce() {
    var raw = hex(root.crypto.getRandomValues(new Uint8Array(24)));
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)).then(function (h) {
      return { raw: raw, hashed: hex(h) };
    });
  }

  /* Draws Google's own "Continue with Google" button into el.
     done(error) runs after each sign-in attempt; error is null when it worked. */
  function googleButton(el, done) {
    return ready.then(function (ok) {
      if (!ok) throw new Error('accounts are off');
      return Promise.all([script(GOOGLE_JS), nonce()]);
    }).then(function (r) {
      var n = r[1], g = root.google && root.google.accounts && root.google.accounts.id;
      if (!g) throw new Error('google did not load');
      g.initialize({
        client_id: CONFIG.googleClientId,
        nonce: n.hashed,
        ux_mode: 'popup',
        callback: function (resp) {
          client.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: n.raw }).then(function (res) {
            if (res.error) throw res.error;
            setUser(res.data && res.data.user);
            done(null);
          }).catch(function (e) { done(e || new Error('sign in failed')); });
        }
      });
      el.textContent = '';
      g.renderButton(el, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with',
        logo_alignment: 'center', locale: 'ar', width: Math.max(220, Math.min(320, el.clientWidth || 300))
      });
    });
  }

  /* --- Sign-in with a code sent by email: works where Google can't, like inside Instagram --- */

  function emailOn() {
    return on && (CONFIG.emailSignIn || /[?&]email=1(&|$)/.test(root.location ? root.location.search : ''));
  }

  // Sends a code to email (making the account the first time). Resolves once the email is on its way.
  function sendEmailCode(email) {
    return ready.then(function (ok) {
      if (!ok) throw new Error('accounts are off');
      return client.auth.signInWithOtp({ email: email, options: { shouldCreateUser: true } });
    }).then(function (res) { if (res.error) throw res.error; });
  }

  // Signs in with the code from that email.
  function verifyEmailCode(email, code) {
    return ready.then(function (ok) {
      if (!ok) throw new Error('accounts are off');
      return client.auth.verifyOtp({ email: email, token: code, type: 'email' });
    }).then(function (res) {
      if (res.error) throw res.error;
      setUser(res.data && res.data.user);
    });
  }

  function signOut() {
    try { root.google.accounts.id.disableAutoSelect(); } catch (e) {}
    if (!client) { setUser(null); return Promise.resolve(); }
    return client.auth.signOut({ scope: 'local' }).then(function () { setUser(null); }, function () { setUser(null); });
  }

  function rows(res) {
    if (res.error) throw res.error;
    return res.data || [];
  }

  function list() {
    return client.from('relations').select('id,me,them,steps,created_at')
      .order('created_at', { ascending: false }).limit(500).then(rows)
      .then(function (data) {
        return data.map(function (r) {
          return { id: r.id, me: r.me, them: r.them, steps: r.steps.split(''), at: Date.parse(r.created_at) };
        });
      });
  }

  /* Saves wallet items ({me, them, steps: ['F','B',...], at}). Saving the same person with the same
     relation again moves it to the top; keepOld leaves an existing copy as it is (used when moving
     the device wallet into the account). */
  function save(items, keepOld) {
    if (!items.length) return Promise.resolve([]);
    var data = items.map(function (it) {
      return {
        user_id: user.id, me: String(it.me || '').slice(0, 40), them: String(it.them || '').slice(0, 40),
        steps: it.steps.join(''), created_at: new Date(it.at || Date.now()).toISOString()
      };
    });
    return client.from('relations').upsert(data, { onConflict: 'user_id,them,steps', ignoreDuplicates: !!keepOld }).then(rows);
  }

  function remove(id) {
    return client.from('relations').delete().eq('id', id).then(rows);
  }

  // The family tree («شجرة عائلتي») is one document per account; null when there is none yet.
  function loadTree() {
    return client.from('family_trees').select('data').eq('user_id', user.id).maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      return res.data ? res.data.data : null;
    });
  }

  function saveTree(data) {
    return client.from('family_trees')
      .upsert({ user_id: user.id, data: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(rows);
  }

  /* The same save, sent before this function returns, for when the page is being closed: a page on its
     way out can't wait for Supabase to look up the session first. Returns the request, or null when
     it can't go this way (no session yet, or the tree is over the 64 KB a closing page may send). */
  function saveTreeNow(data, table) {
    if (!session || !session.access_token || !user || !root.fetch || !root.Blob) return null;
    var body = JSON.stringify({ user_id: user.id, data: data, updated_at: new Date().toISOString() });
    if (new Blob([body]).size >= 60000) return null;
    return root.fetch(CONFIG.supabaseUrl + '/rest/v1/' + (table || 'family_trees') + '?on_conflict=user_id', {
      method: 'POST', keepalive: true, body: body,
      headers: { apikey: CONFIG.supabaseKey, Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }
    }).then(function (res) { if (!res.ok) throw new Error('tree not saved: ' + res.status); });
  }

  // «شجرة دوامي» (work.js): one document per account too, in its own table; null when there is none yet.
  function loadWorkTree() {
    return client.from('work_trees').select('data').eq('user_id', user.id).maybeSingle().then(function (res) {
      if (res.error) throw res.error;
      return res.data ? res.data.data : null;
    });
  }
  function saveWorkTree(data) {
    return client.from('work_trees')
      .upsert({ user_id: user.id, data: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(rows);
  }
  function saveWorkTreeNow(data) { return saveTreeNow(data, 'work_trees'); }

  // Fixes the name of a saved person. If that name with that relation is already saved, the two become one.
  function rename(id, them) {
    return client.from('relations').update({ them: String(them || '').slice(0, 40) }).eq('id', id).then(rows)
      .catch(function (e) {
        if (e && e.code === '23505') return remove(id);
        throw e;
      });
  }

  /* «رابط الشجرة»: a link to my whole tree that opens with a password I set. The database keeps the
     password hashed and gives the tree only to whoever has both; these are the owner's side of it. */
  function one(res) {
    if (res.error) throw res.error;
    return res.data == null ? null : res.data;
  }
  // My link's code, or null when I have none.
  function treeLink() { return client.rpc('my_tree_link').then(one); }
  // Sets the password (making the link the first time). Resolves the code, the same one as before.
  function setTreeLink(password) { return client.rpc('set_tree_link', { password: password }).then(one); }
  // The link stops opening, even with the password.
  function stopTreeLink() { return client.rpc('stop_tree_link').then(one); }
  /* My link and whether it opens without a password: { code, open }, or null when I have none. A
     database from before links without a password answers { code, open: false, old: true }. */
  function treeLinkState() {
    return client.rpc('my_tree_link_state').then(one).catch(function (e) {
      if (!e || (e.code !== 'PGRST202' && e.code !== '42883')) throw e;
      return treeLink().then(function (code) { return { code: code, open: false, old: true }; });
    });
  }
  // Takes the password off (making the link the first time): whoever has the link sees the tree.
  function openTreeLink() { return client.rpc('open_my_tree_link').then(one); }

  /* «رابط الشجرة كاملة» for «شجرة دوامي»: no password (Ali's call), so whoever has it sees the tree. */
  // My work tree's link code, or null when I have none.
  function workLink() { return client.rpc('my_work_link').then(one); }
  // Makes the link (or gives the one I have). Resolves its code.
  function makeWorkLink() { return client.rpc('make_work_link').then(one); }
  // The link stops opening; a link made later gets a new code.
  function stopWorkLink() { return client.rpc('stop_work_link').then(one); }

  /* «اقتراحات على شجرتك»: additions suggested through my tree's link. [{ id, from, at, ops }], oldest
     first; [] when the database doesn't have them yet. */
  function treeSuggestions() {
    return client.rpc('my_tree_suggestions').then(one).then(function (r) { return r || []; }).catch(function (e) {
      if (e && (e.code === 'PGRST202' || e.code === '42883')) return [];
      throw e;
    });
  }
  // Done with a suggestion (added what I picked, or none): it goes.
  function dropTreeSuggestion(id) { return client.rpc('drop_tree_suggestion', { sid: id }).then(one); }

  // Deletes the account and everything saved in it (the database function cascades).
  function deleteAccount() {
    return client.rpc('delete_my_account').then(rows).then(signOut);
  }

  root.ACCOUNT = {
    on: function () { return on; },
    ready: ready,
    user: function () { return user; },
    onChange: function (fn) { listeners.push(fn); },
    googleButton: googleButton,
    emailOn: emailOn,
    sendEmailCode: sendEmailCode,
    verifyEmailCode: verifyEmailCode,
    signOut: signOut,
    list: list,
    save: save,
    remove: remove,
    rename: rename,
    loadTree: loadTree,
    saveTree: saveTree,
    saveTreeNow: function (data) { return saveTreeNow(data); },
    loadWorkTree: loadWorkTree,
    saveWorkTree: saveWorkTree,
    saveWorkTreeNow: saveWorkTreeNow,
    treeLink: treeLink,
    setTreeLink: setTreeLink,
    stopTreeLink: stopTreeLink,
    treeLinkState: treeLinkState,
    openTreeLink: openTreeLink,
    workLink: workLink,
    makeWorkLink: makeWorkLink,
    stopWorkLink: stopWorkLink,
    treeSuggestions: treeSuggestions,
    dropTreeSuggestion: dropTreeSuggestion,
    deleteAccount: deleteAccount
  };
})(window);
