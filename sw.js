const CACHE='pdw-2027-v30';
const CORE=[
 './',
 './index.html',
 './app.js?v=30',
 './style.css?v=30',
 './manifest.webmanifest',
 './vendor/xlsx.full.min.js',
 './vendor/qrcode.min.js',
 './vendor/jszip.min.js',
 './vendor/html5-qrcode.min.js',
 './assets/pdw-logo.jpg'
];
self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await self.skipWaiting()})()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{e.respondWith((async()=>{try{const r=await fetch(e.request);if(e.request.method==='GET'){const c=await caches.open(CACHE);try{await c.put(e.request,r.clone())}catch{}}return r}catch{return(await caches.match(e.request))||(e.request.mode==='navigate'?await caches.match('./index.html'):Response.error())}})())});