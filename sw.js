const staticCashName = 'site-static-v1';
const dynamicCasheName = 'site-dynamic-v1';
const assets = [
  '/pwa-video-player/',
  '/pwa-video-player/index.html',
  '/pwa-video-player/js/app.js',
  '/pwa-video-player/js/ui.js',
  '/pwa-video-player/js/materialize.min.js',
  '/pwa-video-player/css/styles.css',
  '/pwa-video-player/css/materialize.min.css',
  '/pwa-video-player/img/dish.png',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.gstatic.com/s/materialicons/v139/flUhRq6tzZclQEJ-Vdg-IuiaDsNc.woff2',
  '/pwa-video-player/pages/fallback.html',
];

// cache size limit function
const limitCacheSize = (name, size) => {
  caches.open(name).then(cache => {
    cache.keys().then(keys => {
      if (keys.length > size) {
        cache.delete(keys[0]).then(limitCacheSize(name, size));
      }
    });
  });
};

// install event
self.addEventListener('install', evt => {
  // console.log('service worker has been installed');
  // evt.waitUntil(
  //   caches.open(staticCashName).then(cache => {
  //     console.log('caching shell assets');
  //     cache.addAll(assets);
  //   }),
  // );
});

// activate event
self.addEventListener('activate', evt => {
  // console.log('service worker has been activated');
  // evt.waitUntil(
  //   caches.keys().then(keys => {
  //     // console.log(keys);
  //     return Promise.all(
  //       keys
  //         .filter(key => key !== staticCashName && key !== dynamicCasheName)
  //         .map(key => caches.delete(key)),
  //     );
  //   }),
  // );
});

// fetch event
self.addEventListener('fetch', evt => {
  // console.log('fetch event', evt);
  // evt.respondWith(
  //   caches
  //     .match(evt.request)
  //     .then(cacheRes => {
  //       return (
  //         cacheRes ||
  //         fetch(evt.request).then(async fetchRes => {
  //           const cache = await caches.open(dynamicCasheName);
  //           await cache.put(evt.request.url, fetchRes.clone());
  //           limitCacheSize(dynamicCasheName, 15);
  //           return fetchRes;
  //         })
  //       );
  //     })
  //     .catch(() => {
  //       // if (evt.request.url.indexOf('.html') > -1) {
  //       if (evt.request.destination === 'document') {
  //         return caches.match('/pwa-video-player/pages/fallback.html');
  //       }
  //     }),
  // );
});
