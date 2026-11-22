/* BIW KSA — Service Worker v1.3.1 (copy of the Omani one: Safari-proof, redirect-proof, offline-first). Scope: /ksa/ only */
const CACHE_NAME = 'biw-ksa-v1.3.1';
/* طابور رفع الأرشيف: نفس الكود المستخدم بالصفحات */
try { importScripts('./ksa-queue.js'); } catch (e) {}
const ASSETS = [
  './',
  './index.html',
  './timesheet.html',
  './report.html',
  './admin.html',
  './mle.html',
  './ksa-data.js',
  './ksa-queue.js',
  './ksa-archive.js',
  './ksa-ts-share.js',
  './ksa-parts-ui.js',
  './ksa-i18n.js',
  './ksa-dict.js',
  './ksa-user.js',
  './signature-pad.js',
  './bg.jpg',
  './libs/html2canvas.min.js',
  './libs/jspdf.umd.min.js',
  './assets/ksa-logo.jpg',
  './fonts/LiberationSerif-Regular.woff2',
  './fonts/LiberationSerif-Bold.woff2',
  './fonts/Carlito-Bold.woff2',
  './fonts/Caladea-Bold.woff2',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './manifest.json'
];

/* يعيد بناء الرد نظيفًا: يشيل علامة redirected اللي يرفضها سفاري بالتنقل */
async function cleanResponse(res) {
  if (!res) return res;
  if (!res.redirected) return res;
  const body = await res.blob();
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}

async function precacheOne(cache, url) {
  try {
    const res = await fetch(url, { cache: 'no-cache', redirect: 'follow' });
    if (res && (res.ok || res.status === 0)) {
      cache.put(url, await cleanResponse(res));
      return true;
    }
  } catch (e) {}
  return false;
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(ASSETS.map((u) => precacheOne(cache, u))))
      /* لا skipWaiting: النسخة الجديدة تنتظر — التحديث فقط عبر رسالة التحديث (لا تحديث صامت) */
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      /* يمسح كاش KSA القديم فقط — كاش تطبيق عمان على نفس الموقع ما نلمسه */
      Promise.all(keys.filter((k) => k.indexOf('biw-ksa-') === 0 && k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; /* خارجي: خله للمتصفح */
  if (url.pathname.endsWith('/version.json')) {   /* فحص التحديث: شبكة فقط، بلا كاش أبدًا */
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }
  e.respondWith(handle(e.request, url));
});

/* مطابقة ذكية: /timesheet == /timesheet.html == ./timesheet.html */
async function smartMatch(url) {
  const c = await caches.open(CACHE_NAME);
  let path = url.pathname;
  const tries = [path];
  if (path.endsWith('/')) tries.push(path + 'index.html');
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) tries.push(path + '.html');
  if (path.endsWith('.html')) tries.push(path.replace(/\.html$/, ''));
  for (const p of tries) {
    const hit = await c.match(new Request(new URL(p, url.origin).href), { ignoreSearch: true });
    if (hit) return hit;
  }
  /* مطابقة بالمفاتيح النسبية المخزنة وقت التثبيت */
  const keys = await c.keys();
  const base = path.split('/').pop() || 'index.html';
  for (const k of keys) {
    const kp = new URL(k.url).pathname;
    if (kp.endsWith('/' + base) || kp.endsWith('/' + base + '.html')) {
      return c.match(k, { ignoreSearch: true });
    }
  }
  return undefined;
}

async function handle(request, url) {
  /* 1) الكاش أولًا */
  try {
    const cached = await smartMatch(url);
    if (cached) {
      refreshInBackground(request, url);
      return await cleanResponse(cached);
    }
  } catch (e) {}

  /* 2) الشبكة، وخزّنه نظيفًا */
  try {
    const res = await fetch(request);
    if (res && res.status === 200) {
      const clean = await cleanResponse(res.clone());
      caches.open(CACHE_NAME).then((c) => c.put(url.pathname, clean)).catch(() => {});
      return res.redirected ? await cleanResponse(res) : res;
    }
    return res;
  } catch (e) {}

  /* 3) أوفلاين وبدون كاش → أبدًا لا نرجع فاضي */
  try {
    if (request.mode === 'navigate' || (request.headers.get('accept') || '').indexOf('text/html') !== -1) {
      const home = await smartMatch(new URL('./index.html', url.origin));
      if (home) return await cleanResponse(home);
    }
  } catch (e) {}
  return new Response('Offline - not cached', {
    status: 503, statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

function refreshInBackground(request, url) {
  try {
    fetch(request).then(async (res) => {
      if (res && res.status === 200) {
        const clean = await cleanResponse(res);
        caches.open(CACHE_NAME).then((c) => c.put(url.pathname, clean)).catch(() => {});
      }
    }).catch(() => {});
  } catch (e) {}
}

/* أندرويد: إذا رجع النت والتطبيق مقفول، يكمل رفع الملفات المعلّقة للأرشيف */
self.addEventListener('sync', (e) => {
  if (e.tag !== 'ksa-archive-flush' || !self.KSAQueue) return;
  e.waitUntil(self.KSAQueue.flush().then((left) => { if (left) throw new Error('pending'); }));
});
