// PlanejaPro Service Worker
const CACHE = 'planejapro-v1';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/','/']).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if(e.request.url.includes('/api/')) return;
  if(e.request.method!=='GET') return;
  e.respondWith(
    fetch(e.request).then(r=>{
      if(r&&r.status===200){const cl=r.clone();caches.open(CACHE).then(c=>c.put(e.request,cl));}
      return r;
    }).catch(()=>caches.match(e.request).then(r=>r||caches.match('/')))
  );
});