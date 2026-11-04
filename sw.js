/* La app de Exámenes se ha retirado. Este service worker sustituye al antiguo
   para borrar su caché y darse de baja, así los móviles que la tenían instalada
   dejan de mostrarla y pasan a Turnos DJ. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('examenes-')).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
