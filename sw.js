const CACHE_NAME = 'leli-poop-v3';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './game.js',
    './flappy.js',
    './assets/leli.png',
    './assets/leli-sad.jpg',
    './assets/kuhkayi.png',
    './assets/kuhkayi-sad.png',
    './assets/spawner.png',
    './assets/flintastek.mp3'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
