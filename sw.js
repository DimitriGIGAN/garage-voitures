// Le Garage des Petites Voitures — fonctionne sans internet.
const V = "garage-v1";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "voix/index.json"];
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(CORE);
    // voix et sons : on les met de côté en arrière-plan, sans bloquer l'installation
    const extra = [];
    for(const h of "0123456789abcdef") extra.push("voix/p" + h + ".json");
    ["bonne","bravo","erreur","fanfare","musique-jour","musique-matin","musique-nuit","musique-soir","niveau"].forEach(n => extra.push("son/" + n + ".mp3"));
    extra.forEach(u => c.add(u).catch(() => {}));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for(const k of await caches.keys()) if(k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const r = e.request;
  const o = new URL(r.url).origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(new URL(r.url).hostname);
  if(r.method !== "GET" || (o !== location.origin && !font)) return;
  const isPage = r.mode === "navigate";
  e.respondWith((async () => {
    const c = await caches.open(V);
    if(isPage){ // la page : réseau d'abord pour avoir la dernière version, sinon la copie
      try{ const n = await fetch(r); if(n.ok) c.put("index.html", n.clone()); return n; }
      catch(err){ return (await c.match("index.html")) || (await c.match("./")); }
    }
    const hit = await c.match(r);
    if(hit) return hit;
    const n = await fetch(r);
    if(n.ok || n.type === "opaque") c.put(r, n.clone());
    return n;
  })());
});
