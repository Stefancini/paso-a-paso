/* Service worker for Paso a Paso (GitHub Pages edition). web/build_web.py fills in the version and asset list. */
const VERSION = "473d80ae3e64";
const CACHE = "pap-" + VERSION;
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512-maskable.png", "./icons/icon-512.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("pap-") && k !== CACHE && k !== CACHE + "-fonts").map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // The page: network first so a new version shows up when online; the cached copy when offline.
  if (req.mode === "navigate") {
    // On a weak signal, fall back to the saved copy after 3.5 s rather than hanging.
    const net = fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
      return res;
    });
    const slow = new Promise((resolve) => setTimeout(resolve, 3500)).then(() => caches.match("./index.html"));
    e.respondWith(Promise.race([net.catch(() => caches.match("./index.html")), slow.then((hit) => hit || net)]));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
    return;
  }
  // Web fonts: cache first, filled from the network when online; the page has fallback fonts when offline.
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open(CACHE + "-fonts").then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }
      catch (err) { return new Response("", { status: 503 }); }
    }));
  }
});
