const CACHE_VERSION = 'v1';
const STATIC_CACHE_NAME = `lyricisticality-static-${CACHE_VERSION}`;

const CORE_ASSETS = [
	'./',
	'./index.html',
	'./lyrics-selection.html',
	'./lyric-card.html',
	'./manifest.webmanifest',
	'./assets/css/styles.css',
	'./assets/css/card.css',
	'./assets/js/pwa.js',
	'./assets/js/index.js',
	'./assets/js/lyrics-selection.js',
	'./assets/js/lyric-card.js',
	'./assets/images/icon.svg',
	'./assets/icons/fav.svg',
	'./assets/images/quote.svg',
	'./assets/images/typelogo.svg',
	'./assets/images/github.svg',
	'./assets/images/default-cover.svg',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(STATIC_CACHE_NAME);

			await Promise.all(
				CORE_ASSETS.map(async (assetPath) => {
					try {
						const response = await fetch(assetPath, { cache: 'reload' });
						if (response && response.ok) {
							await cache.put(assetPath, response);
						}
					} catch {
					}
				}),
			);

			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const cacheNames = await caches.keys();
			const obsoleteCaches = cacheNames.filter(
				(cacheName) => cacheName !== STATIC_CACHE_NAME,
			);

			await Promise.all(obsoleteCaches.map((cacheName) => caches.delete(cacheName)));
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}

	const requestUrl = new URL(event.request.url);
	const isSameOrigin = requestUrl.origin === self.location.origin;

	if (event.request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				try {
					return await fetch(event.request);
				} catch {
					const cache = await caches.open(STATIC_CACHE_NAME);
					const cachedPage = await cache.match(requestUrl.pathname);
					if (cachedPage) {
						return cachedPage;
					}

					const fallbackPage = await cache.match('./index.html');
					if (fallbackPage) {
						return fallbackPage;
					}

					return Response.error();
				}
			})(),
		);
		return;
	}

	if (!isSameOrigin) {
		event.respondWith(
			fetch(event.request).catch(async () => {
				const cache = await caches.open(STATIC_CACHE_NAME);
				return cache.match(event.request);
			}),
		);
		return;
	}

	event.respondWith(
		(async () => {
			const cache = await caches.open(STATIC_CACHE_NAME);
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}

			try {
				const networkResponse = await fetch(event.request);
				if (networkResponse && networkResponse.ok) {
					cache.put(event.request, networkResponse.clone());
				}
				return networkResponse;
			} catch {
				return cachedResponse || Response.error();
			}
		})(),
	);
});