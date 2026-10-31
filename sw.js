/* 学习工作台 · Service Worker
   目标：装到手机桌面后能离线打开（题库/单词/文章都在本地文件里）。
   策略：页面导航网络优先（保证打开就是最新版入口）；静态文件缓存优先 + 后台更新
        （同版本秒开、版本更新自动拉新资源，不会每次全量重下）；
        永远不碰 textdb.dev 的同步接口（那是实时数据，必须走网络）。 */
var CACHE = 'kaogong-v96';
var ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './data/boards.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
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

  /* 页面导航：网络优先 —— 打开时先拿最新 index.html，保证版本入口是最新的；断网才回退缓存。 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  /* 静态资源（app.js / all.js / css / 图片）：缓存优先 + 后台更新。
     同版本内多次打开命中缓存秒开；版本更新后 ?v= 时间戳变化 → 缓存 miss → 自动下载新资源。
     带 ?v= 版本戳的资源：网络优先（发布即新 URL，直接走网络拿最新内容，
     避免 CDN 旧版被 SW 固化；拿到后仍写缓存，供离线复用）。 */
  var hasV = req.url.indexOf('?v=') >= 0;
  if (hasV) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      var upd = fetch(req, { cache: 'no-cache' }).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return Response.error();
      });
      return hit || upd;
    })
  );
});
