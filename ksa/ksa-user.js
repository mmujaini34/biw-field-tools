/* BIW KSA — who is using this phone.
   First launch: choose the language, then type your name once (saved on this device).
   The name goes with every PDF uploaded to the KSA archive, so management knows exactly
   who made each file. It can be changed later from the home page. */
(function (g) {
  'use strict';
  if (g.KSAUser) return;
  var KEY = 'ksa_user';
  function get() { try { return (localStorage.getItem(KEY) || '').trim(); } catch (e) { return ''; } }
  function nice(v) { return g.KSAData ? KSAData.niceName(v) : String(v || '').replace(/\s+/g, ' ').trim(); }
  function set(v) {
    v = nice(v);
    try { localStorage.setItem(KEY, v); } catch (e) {}
    /* الاسم ينضاف لقائمة أسماء مهندسين BIW (بدون ما يمسح ID أو توقيع محفوظ) */
    try { if (g.KSAData && !KSAData.find(v)) KSAData.saveEngineer({ name: v, id_no: '' }); } catch (e) {}
    try { g.dispatchEvent(new Event('ksa-user')); } catch (e) {}
    return v;
  }
  function T(en, ar) { return g.KSAi18n ? KSAi18n.t(en, ar) : ar; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function ask(opts) {
    opts = opts || {};
    var host = document.createElement('div');
    host.setAttribute('data-noi18n', '1');
    var rtl = !g.KSAi18n || KSAi18n.lang() === 'ar';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(8,5,9,.86);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;direction:' + (rtl ? 'rtl' : 'ltr');
    var names = g.KSAData ? KSAData.names() : [];
    host.innerHTML = '<form style="width:100%;max-width:360px;background:#17121a;border:1px solid rgba(255,196,106,.45);border-radius:20px;padding:22px 18px 18px;color:#fff;text-align:center;box-shadow:0 22px 70px rgba(0,0,0,.65)">' +
      '<div style="font-size:20px;font-weight:800;color:#ffc46a;margin-bottom:6px">' + T('Your name', 'اكتب اسمك') + '</div>' +
      '<div style="font-size:13px;line-height:1.7;color:rgba(255,255,255,.78);margin-bottom:14px">' +
        T('Type your full name once. It is saved on this phone and shows management who made each file.', 'اكتب اسمك الكامل مرة وحدة. ينحفظ في هذا الجوال، والإدارة تعرف منه منو سوّى كل ملف.') + '</div>' +
      '<input name="n" list="ksaUserNames" autocomplete="name" autocapitalize="words" value="' + esc(opts.current || '') + '" placeholder="' + T('Example: Mohammed Al Mujaini', 'مثال: Mohammed Al Mujaini') + '" style="display:block;width:100%;box-sizing:border-box;padding:14px 12px;border-radius:13px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:17px;text-align:center;direction:ltr;outline:none">' +
      '<datalist id="ksaUserNames">' + names.map(function (n) { return '<option value="' + esc(n) + '"></option>'; }).join('') + '</datalist>' +
      '<div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:8px">' + T('Use English letters — names on the forms are in English.', 'اكتبه بالإنجليزي — الأسماء في النماذج إنجليزي.') + '</div>' +
      '<div data-m style="min-height:20px;margin-top:8px;font-size:13px;font-weight:700;color:#ff9c8a"></div>' +
      '<button type="submit" style="display:block;width:100%;margin-top:6px;padding:14px;border-radius:13px;border:1px solid #ffc46a;background:#ffc46a;color:#1a1208;font:inherit;font-size:16px;font-weight:800;cursor:pointer">' + T('Save', 'حفظ') + '</button>' +
      (opts.cancel ? '<button type="button" data-c style="display:block;width:100%;margin-top:10px;padding:12px;border-radius:13px;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.75);font:inherit;font-size:14px;font-weight:700;cursor:pointer">' + T('Cancel', 'إلغاء') + '</button>' : '') +
      '</form>';
    var f = host.querySelector('form'), inp = host.querySelector('input'), msg = host.querySelector('[data-m]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = nice(inp.value);
      if (v.replace(/[^A-Za-z؀-ۿ]/g, '').length < 3) { msg.textContent = T('Please type your full name.', 'اكتب اسمك الكامل.'); inp.focus(); return; }
      v = set(v);
      host.remove();
      if (typeof opts.done === 'function') opts.done(v);
    });
    var c = host.querySelector('[data-c]'); if (c) c.onclick = function () { host.remove(); };
    (document.body || document.documentElement).appendChild(host);
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 80);
  }

  /* أول تشغيل: اللغة ← الاسم */
  function ensure(done) {
    function nameStep() {
      if (get()) { if (typeof done === 'function') done(get()); return; }
      ask({ done: done });
    }
    if (g.KSAi18n && !KSAi18n.chosen()) { KSAi18n.pick(function () { location.reload(); }); return; }
    nameStep();
  }

  g.KSAUser = { name: get, set: set, ask: ask, ensure: ensure };
  function boot() { if (!g.KSA_NO_GATE) ensure(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
