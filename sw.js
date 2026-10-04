/* WaveTune service worker: cache-first para assets, network-first para navegación.
   Solo se pre-cachea lo que existe de verdad: si un solo addAll falla, la
   instalación entera se rechaza y el service worker nunca llega a activarse. */

const CACHE = "wavetune-v10";

const PRECACHE = [
  "./",
  "index.html",
  "explorar/Explorar.html",
  "biblioteca/Biblioteca.html",

  "css/Style.css",

  "js/Data.js",
  "js/Layout.js",
  "js/Player.js",
  "js/Script.js",

  "manifest.webmanifest",
  "assets/artwork/_placeholder.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      /* addAll es tudo-o-nada: se añaden de uno en uno para que una portada
         ausente no impida instalar el resto. */
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {}))))
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
  if (new URL(req.url).origin !== location.origin) return;

  /* Navegación: red primero (contenido fresco) y, si no hay red, la caché. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("index.html"))
        )
    );
    return;
  }

  /* El resto: caché primero y se rellena si no estaba. */
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && /\/(assets|js|css)\//.test(req.url)) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
