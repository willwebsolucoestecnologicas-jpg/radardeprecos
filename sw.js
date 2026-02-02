const CACHE_NAME = 'kalango-v11'; // Mudei a versão para v11
const urlsToCache = [
  './',
  './index.html',
  './script.js',
  './manifest.json'
];

// Instala o novo Service Worker e força a atualização
self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Limpa o cache antigo (v10) quando o novo (v11) ativar
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ESTRATÉGIA: NETWORK FIRST (Internet primeiro, Cache depois)
// Isso garante que o login funcione porque ele vai buscar a resposta do Google
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
  );
});