/* 学习工作台 · Service Worker
   目标：装到手机桌面后能离线打开（题库/单词/文章都在本地文件里）。
   策略：页面导航网络优先（保证打开就是最新版），静态文件 cache-first + 后台更新；
        永远不碰 textdb.dev 的同步接口（那是实时数据，必须走网络）。 */
var CACHE = 'kaogong-v30';
var ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './data/issues.js',
  './data/vocab_plan.js',
  './data/vocab.js',
  './data/news.js',
  './data/idioms.js',
  './data/idiomfill.js',
  './data/calc.js',
  './data/weekend.js',
  './data/phrases.js',
  './data/drills.js',
  './data/outline.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(ASSETS.map(function (u) {
      return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* 同步接口 / 统计接口：一律走网络，不缓存 */
  if (url.hostname !== self.location.hostname) return;

  /* 页面导航（index.html）：网络优先，保证每次打开都是最新版本；断网才回退缓存 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'reload' }).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
