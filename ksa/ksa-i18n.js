/* BIW KSA — Arabic / English for the whole app.
   - The language is chosen once (first launch) and can be changed from the home page.
   - Every screen text, message and alert is shown in the chosen language only.
   - The generated PDFs are NOT translated: they stay English exactly like the paper forms.
   Text comes from ksa-dict.js: { "source text as written in the code": { en: "...", ar: "..." } }. */
(function (g) {
  'use strict';
  if (g.KSAi18n) return;

  var KEY = 'ksa_lang';
  function stored() { try { var v = localStorage.getItem(KEY); return v === 'ar' || v === 'en' ? v : null; } catch (e) { return null; } }
  var L = stored() || 'ar';
  var DICT = {}, PATTERNS = [];
  var SKIP = 'script,style,textarea,noscript,#reportPage,#ksaStage,.ksa-page,[data-noi18n]';

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function add(map) {
    for (var k in map) if (Object.prototype.hasOwnProperty.call(map, k)) {
      var v = map[k];
      DICT[norm(k)] = Array.isArray(v) ? { en: v[0], ar: v[1] } : v;
    }
  }
  function addPatterns(list) { PATTERNS = PATTERNS.concat(list || []); }
  function lookup(s) {
    var k = norm(s);
    if (!k) return null;
    var e = DICT[k];
    if (e && e[L] != null) return e[L];
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = k.match(PATTERNS[i].re);
      if (m) { var f = PATTERNS[i][L]; return typeof f === 'function' ? f.apply(null, m.concat([tr])) : f; }
    }
    return null;
  }
  /* يترجم نص (للرسائل والتنبيهات) — سطر سطر */
  function tr(s) {
    if (s == null) return s;
    var out = [];
    String(s).split('\n').forEach(function (line) { var r = lookup(line); if (r == null) out.push(line); else if (r !== '') out.push(r); });
    return out.join('\n');
  }
  function t(en, ar) { return L === 'ar' ? ar : en; }

  /* ---------- ترجمة الصفحة ---------- */
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  var missing = g.__ksaMissing = g.__ksaMissing || {};
  function note(s) { var k = norm(s); if (k && /[A-Za-z؀-ۿ]/.test(k)) missing[k] = 1; }
  function skipped(el) { try { return !!(el && el.closest && el.closest(SKIP)); } catch (e) { return false; } }
  function doText(node) {
    var raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    if (node.__ksaOut === raw) return;               /* ترجمناه قبل */
    if (raw.indexOf('\n') !== -1 && raw.trim().indexOf('\n') !== -1) {   /* نص بأكثر من سطر: سطر سطر */
      var multi = tr(raw);
      node.__ksaOut = multi;
      if (multi !== raw) node.nodeValue = multi;
      return;
    }
    var r = lookup(raw);
    if (r == null) { note(raw); return; }
    var lead = raw.match(/^\s*/)[0], tail = raw.match(/\s*$/)[0];
    var out = r === '' ? '' : lead + r + tail;
    var p = node.parentNode;
    if (p && p.tagName === 'OPTION' && !p.hasAttribute('value')) p.setAttribute('value', p.textContent);  /* قيمة الاختيار ما تتغير */
    node.__ksaOut = out;
    if (out !== raw) node.nodeValue = out;
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute && el.getAttribute(a);
      if (!v || el['__ksa_' + a] === v) continue;
      var r = lookup(v);
      if (r == null) { note(v); continue; }
      el['__ksa_' + a] = r;
      if (r !== v) el.setAttribute(a, r);
    }
  }
  function translate(root) {
    root = root || document.body;
    if (!root) return;
    if (root.nodeType === 3) { if (root.parentNode && root.isConnected !== false && !skipped(root.parentNode)) doText(root); return; }
    if (root.nodeType !== 1 || root.isConnected === false) return;
    if (root.tagName === 'TEXTAREA') { doAttrs(root); return; }
    if (skipped(root)) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, 5 /* element + text */, {
      acceptNode: function (n) {
        if (n.nodeType === 1) {
          if (n.tagName === 'TEXTAREA') { doAttrs(n); return 2; }   /* الـ placeholder بس، مب كلام المستخدم */
          try { if (n.matches(SKIP)) return 2; } catch (e) {}
          return 1;
        }
        return 1;
      }
    });
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }

  /* ---------- اتجاه الصفحة ---------- */
  function applyDir() {
    var h = document.documentElement;
    h.setAttribute('lang', L);
    h.setAttribute('dir', L === 'ar' ? 'rtl' : 'ltr');
    h.classList.toggle('ksa-ar', L === 'ar'); h.classList.toggle('ksa-en', L === 'en');
  }
  applyDir();

  /* ---------- التنبيهات والتأكيد ---------- */
  var _alert = g.alert, _confirm = g.confirm, _prompt = g.prompt;
  g.alert = function (m) { return _alert.call(g, tr(m)); };
  g.confirm = function (m) { return _confirm.call(g, tr(m)); };
  if (_prompt) g.prompt = function (m, d) { return _prompt.call(g, tr(m), d); };

  /* ---------- مراقبة أي نص جديد ---------- */
  var queued = [], timer = null;
  function flush() { timer = null; var q = queued; queued = []; for (var i = 0; i < q.length; i++) translate(q[i]); }
  function start() {
    translate(document.body);
    if (!g.MutationObserver) return;
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'childList') { for (var j = 0; j < m.addedNodes.length; j++) queued.push(m.addedNodes[j]); }
        else if (m.type === 'characterData') queued.push(m.target);
        else if (m.type === 'attributes') queued.push(m.target);
      }
      if (!timer) timer = (g.queueMicrotask ? (g.queueMicrotask(flush), 1) : setTimeout(flush, 0));
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ---------- اختيار اللغة (أول مرة) ---------- */
  function set(lang) {
    if (lang !== 'ar' && lang !== 'en') return;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    L = lang;
    try { g.dispatchEvent(new Event('ksa-lang')); } catch (e) {}
  }
  function pick(cb) {
    var host = document.createElement('div');
    host.setAttribute('data-noi18n', '1');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,5,9,.86);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif';
    host.innerHTML = '<div style="width:100%;max-width:340px;background:#17121a;border:1px solid rgba(255,196,106,.45);border-radius:20px;padding:24px 18px 18px;color:#fff;text-align:center;box-shadow:0 22px 70px rgba(0,0,0,.65)">' +
      '<div style="font-size:20px;font-weight:800;color:#ffc46a;margin-bottom:4px">اختر اللغة</div>' +
      '<div style="font-size:16px;font-weight:700;color:#ffc46a;margin-bottom:16px;direction:ltr">Choose your language</div>' +
      '<button type="button" data-l="ar" style="display:block;width:100%;margin:8px 0 0;padding:15px;border-radius:13px;border:1px solid #ffc46a;background:#ffc46a;color:#1a1208;font:inherit;font-size:18px;font-weight:800;cursor:pointer">العربية</button>' +
      '<button type="button" data-l="en" style="display:block;width:100%;margin:10px 0 0;padding:15px;border-radius:13px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:18px;font-weight:800;cursor:pointer">English</button>' +
      '</div>';
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-l]'); if (!b) return;
      set(b.getAttribute('data-l'));
      host.remove();
      if (typeof cb === 'function') cb(L); else location.reload();
    });
    (document.body || document.documentElement).appendChild(host);
  }

  g.KSAi18n = {
    lang: function () { return L; },
    chosen: function () { return !!stored(); },
    set: function (lang) { set(lang); location.reload(); },
    pick: pick,
    t: t, tr: tr, add: add, addPatterns: addPatterns, translate: translate, lookup: lookup
  };
})(window);
