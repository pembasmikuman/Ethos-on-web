/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Never skipWaiting: a new version waits until every Ethos window is closed, so it can't swap code mid-workout.

// Push carries no payload. iOS revokes permission if a push shows nothing, so always show one.
self.addEventListener('push', (e) => {
  e.waitUntil(self.registration.showNotification('Rest done', { body: 'Next set.', tag: 'rest' }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('/workout'))),
  );
});
