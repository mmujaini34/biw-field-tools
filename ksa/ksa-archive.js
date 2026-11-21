/* BIW KSA — PDF archive capture.
   Every PDF the KSA time sheet / report generates is kept on the phone (IndexedDB) and uploaded
   to the KSA management archive when there is internet. No device registration in the KSA app:
   the engineer names come from the form itself. */
(function () {
  'use strict';
  if (window.KSAArchive) return;

  var TOOLS = { 'timesheet': 'ksa-timesheet', 'report': 'ksa-report' };
  var page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/i, '') || 'index';
  var TOOL = TOOLS[page] || null;

  function val(id) {
    var el = document.getElementById(id);
    if (!el) return '';
    var v = (typeof el.value === 'string') ? el.value : el.textContent;
    return String(v || '').replace(/\s+/g, ' ').trim();
  }
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + '-' + p(d.getMinutes());
  }
  function wellFile(w) {
    var v = String(w || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return v;
  }
  function readMeta() {
    /* الصفحة تقدر تعطي البيانات بنفسها (التايم شيت) */
    if (typeof window.ksaArchiveMeta === 'function') {
      try { var m = window.ksaArchiveMeta(); if (m) { m.tool = TOOL; return m; } } catch (e) {}
    }
    var names = val('fieldEngineerInput').split(/\s*\/\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    var well = val('wellInput');
    var client = val('clientInput'), company = val('companyInput');
    return {
      tool: TOOL,
      engineers: names,
      created_by: names[0] || '',
      well: well,
      client: client && company ? client + ' / ' + company : client,
      doc_date: val('outReportDate') || val('reportDateInput'),
      filename: (wellFile(well) || (TOOL || 'document') + '_' + stamp()) + '.pdf'
    };
  }

  /* ---------- رقم ثابت لكل مستند: نفس الـ PDF مرتين = نسخة وحدة بالأرشيف ---------- */
  function hex(buf) { var b = new Uint8Array(buf), s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
  function asUuid(h) { return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-8' + h.slice(17, 20) + '-' + h.slice(20, 32); }
  function contentEnd(bytes) {
    var mark = [47, 67, 114, 101, 97, 116, 105, 111, 110, 68, 97, 116, 101]; /* "/CreationDate" */
    var stop = Math.max(0, bytes.length - 65536);
    for (var i = bytes.length - mark.length; i >= stop; i--) {
      var hit = true;
      for (var j = 0; j < mark.length; j++) { if (bytes[i + j] !== mark[j]) { hit = false; break; } }
      if (hit) return i;
    }
    return bytes.length;
  }
  function randomId() { var b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b); return asUuid(hex(b.buffer)); }
  function docId(buf) {
    try {
      if (!window.crypto || !crypto.subtle) return Promise.resolve(randomId());
      var bytes = new Uint8Array(buf);
      return crypto.subtle.digest('SHA-256', bytes.subarray(0, contentEnd(bytes))).then(function (d) { return asUuid(hex(d)); }, function () { return randomId(); });
    } catch (e) { return Promise.resolve(randomId()); }
  }
  function toBuffer(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer();
    return new Promise(function (resolve, reject) { var fr = new FileReader(); fr.onload = function () { resolve(fr.result); }; fr.onerror = function () { reject(fr.error); }; fr.readAsArrayBuffer(blob); });
  }

  /* ---------- الرفع ---------- */
  var flushTimer = null;
  function flushNow() {
    if (!window.KSAQueue) return;
    KSAQueue.count().then(function (n) {
      if (!n) return;
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(function (reg) {
            if (reg && reg.sync && reg.sync.register) reg.sync.register('ksa-archive-flush').catch(function () {});
          }).catch(function () {});
        }
      } catch (e) {}
      if (navigator.onLine !== false) KSAQueue.flush();
    }).catch(function () {});
  }
  function scheduleFlush(ms) { if (flushTimer) clearTimeout(flushTimer); flushTimer = setTimeout(function () { flushTimer = null; flushNow(); }, ms); }

  function capture(blob) {
    if (!TOOL || !window.KSAQueue) return;
    var meta = readMeta();
    if (!meta) return;
    toBuffer(blob).then(function (buf) {
      return docId(buf).then(function (id) {
        meta.id = id;
        return KSAQueue.put({ id: id, data: buf, meta: meta, at: Date.now(), tries: 0 });
      });
    }).then(function () { scheduleFlush(1500); }).catch(function () {});
  }

  function hookDoc(doc) {
    var orig = doc.output;
    if (typeof orig !== 'function') return;
    doc.output = function (type) {
      var out = orig.apply(doc, arguments);
      try { if (type === 'blob' && out && typeof out.size === 'number') capture(out); } catch (e) {}
      return out;
    };
  }
  function wrapJsPDF() {
    var ns = window.jspdf;
    if (!ns || typeof ns.jsPDF !== 'function' || ns.jsPDF.__ksa) return;
    var Orig = ns.jsPDF;
    var Wrapped = function () {
      var doc = Reflect.construct(Orig, arguments, Orig);
      try { hookDoc(doc); } catch (e) {}
      return doc;
    };
    Wrapped.prototype = Orig.prototype;
    Object.getOwnPropertyNames(Orig).forEach(function (k) {
      if (k === 'length' || k === 'name' || k === 'prototype' || k === 'arguments' || k === 'caller') return;
      try { Object.defineProperty(Wrapped, k, Object.getOwnPropertyDescriptor(Orig, k)); } catch (e) {}
    });
    Wrapped.__ksa = true;
    try { ns.jsPDF = Wrapped; } catch (e) {}
    if (window.jsPDF === Orig) { try { window.jsPDF = Wrapped; } catch (e) {} }
  }
  try { wrapJsPDF(); } catch (e) {}

  scheduleFlush(2500);
  window.addEventListener('online', function () { scheduleFlush(600); });
  window.addEventListener('pageshow', function () { scheduleFlush(1500); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) scheduleFlush(1000); });
  setInterval(flushNow, 120000);

  window.KSAArchive = { flush: flushNow, tool: TOOL };
})();
