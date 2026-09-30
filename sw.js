/* WaveTune service worker: cache-first para assets, network-first para navegación */
const CACHE = "wavetune-v8";
const PRECACHE = [
  "HTML/index.html",
  "js/catalog.js",
  "js/music-player.js",
  "css/music.css",
  "assets/dist/css/bootstrap.min.css",
  "assets/dist/js/bootstrap.bundle.min.js",
  "manifest.webmanifest",
  "assets/artwork/baile-inolvidable.png",
  "assets/artwork/diabla.png",
  "assets/artwork/in-the-end.png",
  "assets/artwork/_placeholder.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match("HTML/index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && /\/assets\/|\/js\/|\/css\//.test(req.url)) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});