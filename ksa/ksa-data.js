/* BIW KSA — shared data: BIW engineers (name, ID #, saved signature) and the daily-log operations.
   - Kept on the phone (localStorage) so everything works offline.
   - Synced with the private KSA database (biw-ksa edge function) whenever there is internet.
   - New names / signatures / operations made offline wait in a queue and go up when the connection is back. */
(function (g) {
  'use strict';
  if (g.KSAData) return;

  var FN = 'https://szomlyrlpznrdyewknec.supabase.co/functions/v1/biw-ksa';
  var TOKEN = 'biw-ksa-2026';
  var CACHE = 'ksa_boot', PENDING = 'ksa_pending';
  var DEFAULT_OPS = [
    { text: 'Arriving at Rig, checking Equipment', status: 'STANDBY' },
    { text: 'Rig Operation', status: 'STANDBY' },
    { text: 'ESP ASSEMBLY', status: 'STANDBY' },
    { text: 'Packer Molded system', status: 'WORKING' },
    { text: 'Hanger Termination', status: 'WORKING' },
    { text: 'Bonnet Termination', status: 'WORKING' }
  ];

  function getJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function setJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function key(v) { return clean(v).toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* أسماء المهندسين: أول حرف من كل كلمة كابيتال */
  function niceName(v) { return clean(v).toLowerCase().replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

  var cache = getJSON(CACHE, null) || { engineers: [], ops: DEFAULT_OPS.slice(), at: 0 };
  if (!Array.isArray(cache.engineers)) cache.engineers = [];
  if (!Array.isArray(cache.ops) || !cache.ops.length) cache.ops = DEFAULT_OPS.slice();
  var listeners = [];

  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* يطبّق الطابور المعلّق فوق نسخة السيرفر — عشان اللي انضاف بدون نت ما يختفي */
  function overlay(base) {
    var out = { engineers: (base.engineers || []).map(function (x) { return { name: x.name, id_no: x.id_no || '', sig: x.sig || '', at: x.at || 0 }; }),
                ops: (base.ops || []).map(function (x) { return { text: x.text, status: x.status === 'WORKING' ? 'WORKING' : 'STANDBY' }; }),
                at: base.at || Date.now() };
    getJSON(PENDING, []).forEach(function (p) {
      if (p.type === 'eng') {
        var k = key(p.data.name), hit = null;
        out.engineers.forEach(function (x) { if (key(x.name) === k) hit = x; });
        if (!hit) { hit = { name: p.data.name, id_no: '', sig: '', at: 0 }; out.engineers.push(hit); }
        hit.name = p.data.name; hit.id_no = p.data.id_no || '';
        if (p.data.sig) hit.sig = p.data.sig;
        hit.at = p.at || Date.now();
      } else if (p.type === 'op') {
        var ok = key(p.data.text), has = out.ops.some(function (x) { return key(x.text) === ok; });
        if (!has) out.ops.push({ text: p.data.text, status: p.data.status });
      }
    });
    out.engineers.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return out;
  }

  function post(action, body, ms) {
    var ctl = ('AbortController' in g) ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 12000) : null;
    return fetch(FN + '?a=' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-token': TOKEN },
      body: JSON.stringify(body || {}), signal: ctl ? ctl.signal : undefined, cache: 'no-store'
    }).then(function (r) {
      if (t) clearTimeout(t);
      return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; });
    }, function (e) { if (t) clearTimeout(t); throw e; });
  }

  function accept(j) {
    if (!j || !j.ok || !Array.isArray(j.engineers) || !Array.isArray(j.ops)) return false;
    cache = overlay({ engineers: j.engineers, ops: j.ops.length ? j.ops : DEFAULT_OPS, at: Date.now() });
    setJSON(CACHE, cache);
    emit();
    return true;
  }

  var flushing = null;
  function flush() {
    if (flushing) return flushing;
    if (g.navigator && navigator.onLine === false) return Promise.resolve(false);
    flushing = (function next() {
      var q = getJSON(PENDING, []);
      if (!q.length) return Promise.resolve(true);
      var p = q[0];
      var req = p.type === 'eng' ? post('eng-save', p.data, 20000) : post('op-add', p.data);
      return req.then(function (j) {
        if (j && (j.ok || (j.__status >= 400 && j.__status < 500))) {   /* نجح، أو مرفوض نهائيًا: نشيله من الطابور */
          var cur = getJSON(PENDING, []);
          if (cur.length && cur[0].id === p.id) { cur.shift(); setJSON(PENDING, cur); }
          if (j.ok) accept(j);
          return next();
        }
        return false;
      }, function () { return false; });
    })().then(function (r) { flushing = null; return r; }, function () { flushing = null; return false; });
    return flushing;
  }

  function refresh() {
    if (g.navigator && navigator.onLine === false) return Promise.resolve(false);
    return flush().then(function () {
      return post('boot', {}).then(accept, function () { return false; });
    });
  }

  function queue(type, data) {
    var q = getJSON(PENDING, []);
    q.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), type: type, data: data, at: Date.now() });
    setJSON(PENDING, q);
    cache = overlay(cache);
    setJSON(CACHE, cache);
    emit();
    setTimeout(flush, 300);
  }

  var api = {
    niceName: niceName,
    key: key,
    engineers: function () { return cache.engineers.slice(); },
    names: function () { return cache.engineers.map(function (x) { return x.name; }); },
    sigMap: function () { var m = {}; cache.engineers.forEach(function (x) { if (x.sig) m[x.name] = x.sig; }); return m; },
    find: function (name) { var k = key(name), hit = null; cache.engineers.forEach(function (x) { if (key(x.name) === k) hit = x; }); return hit; },
    /* يحفظ اسم + ID (+ توقيع لو موجود). التوقيع القديم يبقى لو ما انرسل جديد */
    saveEngineer: function (o) {
      var name = niceName(o && o.name);
      if (key(name).length < 2) return null;
      var cur = api.find(name);
      var idNo = clean(o.id_no).toUpperCase().slice(0, 30);
      var sig = o.sig || '';
      if (cur && !sig && (cur.id_no || '') === idNo && cur.name === name) return cur;   /* ما تغيّر شي */
      var data = { name: name, id_no: idNo };
      if (sig) data.sig = sig;
      queue('eng', data);
      return api.find(name);
    },
    ops: function () { return cache.ops.slice(); },
    findOp: function (text) { var k = key(text), hit = null; cache.ops.forEach(function (x) { if (key(x.text) === k) hit = x; }); return hit; },
    addOp: function (text, status) {
      text = clean(text).slice(0, 80);
      if (!key(text)) return null;
      var hit = api.findOp(text);
      if (hit) return hit;
      queue('op', { text: text, status: status === 'WORKING' ? 'WORKING' : 'STANDBY' });
      return api.findOp(text);
    },
    pending: function () { return getJSON(PENDING, []).length; },
    refresh: refresh,
    flush: flush,
    onChange: function (f) { if (typeof f === 'function') listeners.push(f); },
    url: FN, token: TOKEN, post: post
  };
  g.KSAData = api;

  g.addEventListener('online', function () { setTimeout(refresh, 700); });
  try { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(refresh, 900); }); } catch (e) {}
  setTimeout(refresh, 600);
})(window);
