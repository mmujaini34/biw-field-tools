/* BIW KSA — shared data: BIW engineers (name, ID #, saved signature), the daily-log operations and the parts list.
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
  /* القائمة الأولى (من ورقة محمد) — تستخدم بس لو الجهاز عمره ما اتصل بالقاعدة */
  var DEFAULT_PARTS = [
    { part: 'EA1591-36-175C', desc: 'PACKER TO MOTOR PENETRATOR MLE/POTHEAD', manual: 'N/A', serialRequired: true },
    { part: 'SPTM03-R40L', desc: 'TRI-LOK PACKER FIELD ATTACHABLE PENETRATOR #4AWG ROUND CABLE TO METAL CLAD MLE', manual: 'N/A', serialRequired: true },
    { part: 'SPTM03-R20L', desc: 'TRI-LOK PACKER F/A PENETRATOR #2AWG ROUND CABLE TO METAL CLAD MLE', manual: 'N/A', serialRequired: true },
    { part: 'SPT120-F40-R20', desc: 'TRI-LOK PACKER F/A PENETRATOR #4AWG FLAT CABLE AND #2AWG ROUND CABLE', manual: 'N/A', serialRequired: true },
    { part: 'TLK0077160-R40', desc: 'TRU-LOK WELLHEAD F/A PENETRATOR #4 AWG ROUND CABLE', manual: 'N/A', serialRequired: true },
    { part: 'TLK007160-R20', desc: 'TRU-LOK WELLHEAD F/A PENETRATOR #2 AWG ROUND CABLE', manual: 'N/A', serialRequired: true },
    { part: 'STW77160-R40', desc: 'TRI-LOK WELLHEAD F/A PENETRATOR #4 AWG ROUND CABLE', manual: 'A400-0392', serialRequired: true },
    { part: 'P177-0179', desc: 'CROSSOVER ADAPTER 1.90 NU-10RD BOX', manual: 'N/A', serialRequired: true },
    { part: 'TLK52A2-EXP', desc: 'TRU-LOK SURFACE CONNECTOR EXP & C1D2 HEAVY DUTY', manual: 'N/A', serialRequired: true },
    { part: 'P177-0317', desc: 'ASSY. CROSSOVER ADAPTER 3 INTO 1 MONEL AN SEALS', manual: 'N/A', serialRequired: true },
    { part: 'A177-0326-12', desc: '1.90-NU-10 RD BOX X PIN', manual: 'N/A', serialRequired: false }
  ];

  function getJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function setJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function key(v) { return clean(v).toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* أسماء المهندسين: أول حرف من كل كلمة كابيتال */
  function pkey(v) { return String(v == null ? '' : v).toUpperCase().replace(/\s+/g, ''); }
  function normPart(x) { return { part: pkey(x.part), desc: clean(x.desc).toUpperCase(), manual: clean(x.manual).toUpperCase() || 'N/A', serialRequired: x.serialRequired !== false }; }
  function T(en, ar) { return g.KSAi18n ? g.KSAi18n.t(en, ar) : ar; }
  function niceName(v) { return clean(v).toLowerCase().replace(/(^|[\s\-'])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

  var cache = getJSON(CACHE, null) || { engineers: [], ops: DEFAULT_OPS.slice(), parts: DEFAULT_PARTS.slice(), at: 0 };
  if (!Array.isArray(cache.engineers)) cache.engineers = [];
  if (!Array.isArray(cache.ops) || !cache.ops.length) cache.ops = DEFAULT_OPS.slice();
  if (!Array.isArray(cache.parts) || !cache.parts.length) cache.parts = DEFAULT_PARTS.slice();
  var listeners = [];

  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) {} }); }

  /* يطبّق الطابور المعلّق فوق نسخة السيرفر — عشان اللي انضاف بدون نت ما يختفي */
  function overlay(base) {
    var out = { engineers: (base.engineers || []).map(function (x) { return { name: x.name, id_no: x.id_no || '', sig: x.sig || '', at: x.at || 0 }; }),
                ops: (base.ops || []).map(function (x) { return { text: x.text, status: x.status === 'WORKING' ? 'WORKING' : 'STANDBY' }; }),
                parts: (base.parts || []).map(normPart),
                at: base.at || Date.now() };
    getJSON(PENDING, []).forEach(function (p) {
      if (p.type === 'eng') {
        var k = key(p.data.name), hit = null;
        out.engineers.forEach(function (x) { if (key(x.name) === k) hit = x; });
        if (!hit) { hit = { name: p.data.name, id_no: '', sig: '', at: 0 }; out.engineers.push(hit); }
        hit.name = p.data.name; hit.id_no = p.data.id_no || '';
        if (p.data.sig) hit.sig = p.data.sig;
        hit.at = p.at || Date.now();
      } else if (p.type === 'part') {
        var d = normPart(p.data), oldK = pkey(p.data.old_part), i, at = -1, clash = -1;
        for (i = 0; i < out.parts.length; i++) { if (oldK && out.parts[i].part === oldK) at = i; if (out.parts[i].part === d.part) clash = i; }
        if (oldK && oldK !== d.part && clash !== -1) { /* الرقم الجديد موجود: السيرفر بيرفضه — نخليه */ }
        else if (at !== -1) out.parts[at] = d;
        else if (clash !== -1) out.parts[clash] = d;
        else out.parts.push(d);
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
    cache = overlay({ engineers: j.engineers, ops: j.ops.length ? j.ops : DEFAULT_OPS, parts: Array.isArray(j.parts) && j.parts.length ? j.parts : cache.parts, at: Date.now() });
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
      var req = p.type === 'eng' ? post('eng-save', p.data, 20000) : (p.type === 'part' ? post('part-save', p.data) : post('op-add', p.data));
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
    /* القطع: قائمة وحدة للكل — أي تعديل أو إضافة ينحفظ ويطلع لكل المهندسين */
    parts: function () { return cache.parts.slice(); },
    findPart: function (part) { var k = pkey(part), hit = null; cache.parts.forEach(function (x) { if (x.part === k) hit = x; }); return hit; },
    partKey: pkey,
    savePart: function (o, oldPart) {
      var d = normPart(o || {});
      if (!d.part || !d.desc) return { ok: false, error: T('Part Number and Description are required', 'البارت نمبر والوصف مطلوبين') };
      var oldK = pkey(oldPart);
      if (oldK && oldK !== d.part && api.findPart(d.part)) return { ok: false, error: T('Part Number ' + d.part + ' is already in the list', 'البارت نمبر ' + d.part + ' موجود بالقائمة') };
      var cur = api.findPart(oldK || d.part);
      if (cur && cur.part === d.part && cur.desc === d.desc && cur.manual === d.manual && cur.serialRequired === d.serialRequired) return { ok: true, part: cur };
      var data = { part: d.part, desc: d.desc, manual: d.manual, serialRequired: d.serialRequired };
      if (oldK && oldK !== d.part) data.old_part = oldK;
      queue('part', data);
      return { ok: true, part: api.findPart(d.part) };
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
