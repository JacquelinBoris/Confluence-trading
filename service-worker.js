// Service worker minimal — rend l'app installable et met en cache le shell
// (HTML/manifest/icônes) pour un chargement instantané. Les appels au Worker
// Cloudflare (analyses IA) et à Firestore ne sont jamais mis en cache : ils
// passent toujours par le réseau.

const CACHE_NAME = "confluence-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels vers Cloudflare Worker, Firebase ou Groq :
  // ce sont toujours des données live, jamais du contenu statique.
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return; // laisse passer directement au réseau
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached); // hors-ligne : retombe sur le cache si dispo
      return cached || network;
    })
  );
});
