/* BIW KSA — Parts list screen (shared by the time sheet and the report).
   Anyone can edit a part or add a new one; every change is saved to the KSA database
   (through KSAData) and shows up for all engineers. Deleting is only in the management page. */
(function () {
  'use strict';
  if (window.KSAPartsUI) return;

  function T(en, ar) { return window.KSAi18n ? window.KSAi18n.t(en, ar) : ar; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var CSS = '' +
    ':host{all:initial}' +
    '.ov{position:fixed;inset:0;z-index:2147482000;background:rgba(15,23,42,.55);display:flex;align-items:flex-end;justify-content:center;font-family:-apple-system,"Segoe UI",Roboto,Tahoma,Arial,sans-serif}' +
    '@media(min-width:700px){.ov{align-items:center}}' +
    '.bx{width:100%;max-width:640px;max-height:92vh;display:flex;flex-direction:column;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.3);overflow:hidden;color:#0f172a}' +
    '@media(min-width:700px){.bx{border-radius:20px}}' +
    '.hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff}' +
    '.hd h2{flex:1;margin:0;font-size:17px;font-weight:900}' +
    '.hd small{display:block;font-size:12px;font-weight:600;opacity:.8;margin-top:2px}' +
    '.x{flex:none;border:0;border-radius:12px;padding:9px 14px;font:inherit;font-weight:800;background:rgba(255,255,255,.15);color:#fff;cursor:pointer}' +
    '.tl{display:flex;gap:8px;padding:12px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc}' +
    '.tl input{flex:1;min-width:0;min-height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:8px 12px;font:inherit;font-size:15px;direction:ltr;text-align:left}' +
    '.add{flex:none;border:0;border-radius:12px;padding:0 14px;min-height:44px;font:inherit;font-weight:900;font-size:14px;background:#0f766e;color:#fff;cursor:pointer}' +
    '.ls{flex:1;overflow:auto;padding:6px 14px 14px;-webkit-overflow-scrolling:touch}' +
    '.it{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #eef2f7}' +
    '.it .tx{flex:1;min-width:0;direction:ltr;text-align:left}' +
    '.it .pn{font-weight:900;font-size:15px}' +
    '.it .ds{font-size:13px;color:#334155;margin-top:2px;line-height:1.35}' +
    '.it .mt{font-size:12px;color:#64748b;margin-top:3px;font-weight:700}' +
    '.ed{flex:none;border:1.5px solid #1d4ed8;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:800;background:#eff6ff;color:#1e3a8a;cursor:pointer}' +
    '.em{padding:22px 0;text-align:center;color:#64748b;font-weight:700}' +
    '.fm{padding:14px 16px 18px;overflow:auto}' +
    '.fm label{display:block;margin:12px 0 6px;font-size:12px;font-weight:900;color:#374151}' +
    '.fm input,.fm textarea{width:100%;box-sizing:border-box;min-height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:15px;direction:ltr;text-align:left;text-transform:uppercase}' +
    '.fm textarea{min-height:70px;resize:vertical}' +
    '.sg{display:flex;gap:8px}' +
    '.sg button{flex:1;min-height:44px;border-radius:12px;border:1.5px solid #cbd5e1;background:#fff;font:inherit;font-weight:900;cursor:pointer;color:#0f172a}' +
    '.sg button.on{background:#0f172a;border-color:#0f172a;color:#fff}' +
    '.er{min-height:20px;margin-top:10px;color:#b91c1c;font-weight:800;font-size:13px}' +
    '.ac{display:flex;gap:10px;margin-top:12px}' +
    '.ac button{flex:1;min-height:48px;border-radius:12px;font:inherit;font-weight:900;font-size:15px;cursor:pointer}' +
    '.cn{border:1px solid #cbd5e1;background:#fff;color:#0f172a}' +
    '.sv{border:0;background:#0f766e;color:#fff}' +
    '.nt{font-size:12px;color:#64748b;font-weight:700;margin-top:8px;line-height:1.5}' +
    '.ok{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);background:#15803d;color:#fff;padding:10px 16px;border-radius:999px;font-weight:800;font-size:13px;box-shadow:0 8px 20px rgba(0,0,0,.25);opacity:0;transition:opacity .25s;pointer-events:none}' +
    '.ok.on{opacity:1}';

  function open(opts) {
    opts = opts || {};
    if (!window.KSAData) { alert(T('Parts list is not available.', 'قائمة القطع مب متوفرة.')); return; }
    var host = document.createElement('div');
    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    var st = document.createElement('style'); st.textContent = CSS; root.appendChild(st);
    var ov = document.createElement('div'); ov.className = 'ov'; ov.style.direction = (window.KSAi18n && KSAi18n.lang() === 'en') ? 'ltr' : 'rtl'; root.appendChild(ov);
    var bx = document.createElement('div'); bx.className = 'bx'; ov.appendChild(bx);
    var toast = document.createElement('div'); toast.className = 'ok'; ov.appendChild(toast);
    document.body.appendChild(host);
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    var query = opts.query || '', changed = false, tt = null;

    function close() {
      document.body.style.overflow = prevOverflow;
      host.remove();
      if (changed && typeof opts.onChange === 'function') { try { opts.onChange(); } catch (e) {} }
      if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch (e) {} }
    }
    function flash(t) { toast.textContent = t; toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('on'); }, 2200); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

    function listView() {
      bx.innerHTML = '<div class="hd"><div style="flex:1"><h2>' + T('Parts List', 'قائمة القطع') + '</h2><small>' + T('Any edit or new part is saved for all engineers', 'أي تعديل أو إضافة ينحفظ ويطلع لكل المهندسين') + '</small></div><button class="x" type="button" data-a="close">' + T('Close', 'إغلاق') + '</button></div>' +
        '<div class="tl"><input type="search" placeholder="' + T('Search P/N or description', 'ابحث بالبارت نمبر أو الوصف') + '" value="' + esc(query) + '"><button class="add" type="button" data-a="add">' + T('+ Add part', '+ إضافة قطعة') + '</button></div>' +
        '<div class="ls"></div>';
      var inp = bx.querySelector('input'), ls = bx.querySelector('.ls');
      function draw() {
        var q = String(inp.value || '').trim().toLowerCase(); query = inp.value;
        var parts = KSAData.parts().filter(function (p) { return !q || p.part.toLowerCase().indexOf(q) !== -1 || p.desc.toLowerCase().indexOf(q) !== -1; });
        ls.innerHTML = parts.length ? parts.map(function (p) {
          return '<div class="it"><div class="tx"><div class="pn">' + esc(p.part) + '</div><div class="ds">' + esc(p.desc) + '</div><div class="mt">Instruction Manual: ' + esc(p.manual) + ' · Serial: ' + (p.serialRequired ? 'YES' : 'N/A') + '</div></div>' +
            '<button class="ed" type="button" data-edit="' + esc(p.part) + '">' + T('✎ Edit', '✎ تعديل') + '</button></div>';
        }).join('') : '<div class="em">' + T('Nothing found. Tap “+ Add part” to add it.', 'ما لقيت شي. اضغط «+ إضافة قطعة» وضيفها.') + '</div>';
      }
      inp.addEventListener('input', draw);
      bx.querySelector('[data-a="close"]').onclick = close;
      bx.querySelector('[data-a="add"]').onclick = function () { formView(null); };
      ls.addEventListener('click', function (e) { var b = e.target.closest('[data-edit]'); if (b) formView(KSAData.findPart(b.getAttribute('data-edit'))); });
      draw();
    }

    function formView(p) {
      var isNew = !p;
      var cur = p || { part: (opts.prefill && opts.prefill.part) || '', desc: (opts.prefill && opts.prefill.desc) || '', manual: 'N/A', serialRequired: true };
      bx.innerHTML = '<div class="hd"><div style="flex:1"><h2>' + (isNew ? T('Add Part', 'إضافة قطعة') : T('Edit Part', 'تعديل قطعة')) + '</h2><small>' + (isNew ? T('It is added to the list for everyone', 'تنضاف للقائمة وتطلع للكل') : esc(cur.part)) + '</small></div><button class="x" type="button" data-a="back">' + T('Back', 'رجوع') + '</button></div>' +
        '<div class="fm">' +
          '<label>Part Number</label><input data-f="part" value="' + esc(cur.part) + '" placeholder="P177-0179" autocomplete="off" autocapitalize="characters">' +
          '<label>Description</label><textarea data-f="desc" placeholder="CROSSOVER ADAPTER 1.90 NU-10RD BOX" autocapitalize="characters">' + esc(cur.desc) + '</textarea>' +
          '<label>Instruction Manual</label><input data-f="manual" value="' + esc(cur.manual || 'N/A') + '" placeholder="N/A" autocomplete="off" autocapitalize="characters">' +
          '<label>Serial Number</label><div class="sg"><button type="button" data-s="1" class="' + (cur.serialRequired ? 'on' : '') + '">' + T('Has a serial', 'لها سيريال') + '</button><button type="button" data-s="0" class="' + (cur.serialRequired ? '' : 'on') + '">' + T('No serial (N/A)', 'بدون سيريال (N/A)') + '</button></div>' +
          '<div class="er"></div>' +
          '<div class="ac"><button class="cn" type="button" data-a="back">' + T('Cancel', 'إلغاء') + '</button><button class="sv" type="button" data-a="save">' + T('Save', 'حفظ') + '</button></div>' +
          (isNew ? '' : '<div class="nt">' + T('The change applies for everyone from now on. Time sheets already made do not change.', 'التعديل يطلع للكل من الحين. التايم شيتات اللي انطلعت قبل ما تتغير.') + '</div>') +
        '</div>';
      var serial = !!cur.serialRequired;
      bx.querySelectorAll('[data-a="back"]').forEach(function (b) { b.onclick = listView; });
      bx.querySelector('.sg').addEventListener('click', function (e) {
        var b = e.target.closest('[data-s]'); if (!b) return; serial = b.getAttribute('data-s') === '1';
        bx.querySelectorAll('.sg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
      bx.querySelector('[data-a="save"]').onclick = function () {
        var v = function (f) { return String(bx.querySelector('[data-f="' + f + '"]').value || '').replace(/\s+/g, ' ').trim().toUpperCase(); };
        var res = KSAData.savePart({ part: v('part').replace(/\s+/g, ''), desc: v('desc'), manual: v('manual') || 'N/A', serialRequired: serial }, isNew ? '' : cur.part);
        if (!res || !res.ok) { bx.querySelector('.er').textContent = (res && res.error) || T('Could not save', 'تعذر الحفظ'); return; }
        changed = true;
        if (typeof opts.onChange === 'function') { try { opts.onChange(); } catch (e) {} }
        if (typeof opts.onSaved === 'function' && opts.returnOnSave) { var r = res.part; close(); opts.onSaved(r); return; }
        query = res.part ? res.part.part : '';
        listView(); flash(T('Saved ✓ — everyone will see it', 'انحفظ ✓ وبيطلع للكل'));
      };
      setTimeout(function () { var f = bx.querySelector(isNew && !cur.part ? '[data-f="part"]' : '[data-f="desc"]'); if (f) f.focus(); }, 60);
    }

    if (opts.mode === 'add') formView(null); else listView();
  }

  window.KSAPartsUI = { open: open };
})();
