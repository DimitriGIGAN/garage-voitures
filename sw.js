// Le Garage des Petites Voitures — fonctionne sans internet.
const V = "garage-v9";
const CORE = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "voix/index.json"];
const CHANTS = ["bois","choux","cloche","escargot","lune","marionnette","navire","pomme","prince"].map(n => "chants/c-" + n + ".json");
const SONS = ["bonne","bravo","erreur","fanfare","musique-jour","musique-matin","musique-nuit","musique-soir","niveau"].map(n => "son/" + n + ".mp3");
const IMGS = ["img/jeux.json","img/album-ile.json","img/histoires.json"];
const PACKS = []; for(const h of "0123456789abcdef") for(const b of "01") PACKS.push("voix/p" + h + b + ".json");

// mise de côté en arrière-plan, quelques fichiers à la fois, sans bloquer l'installation
async function stash(c, list){
  const todo = [];
  for(const u of list) if(!(await c.match(u))) todo.push(u);
  const next = async () => { while(todo.length){ const u = todo.shift(); try{ await c.add(u); }catch(e){} } };
  await Promise.all([next(), next(), next()]);
}
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    // ce qui sert tout de suite : la page, les images, les sons et les chansons
    await c.addAll(CORE);
    const saveData = self.navigator && navigator.connection && navigator.connection.saveData;
    // les voix (23 Mo) : seulement si le téléphone n'est pas en mode « économie de données »
    stash(c, IMGS.concat(SONS, CHANTS, saveData ? [] : PACKS));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    // on récupère ce que l'ancienne version avait déjà téléchargé (voix, vidéos) au lieu de tout reprendre
    for(const k of await caches.keys()){
      if(k === V || !k.startsWith("garage-")) continue;
      const old = await caches.open(k);
      for(const r of await old.keys()){
        const p = new URL(r.url).pathname;
        if(!/\/videos\//.test(p)) continue; // seules les comptines vidéo sont reprises ; voix et images sont rechargées (elles peuvent avoir changé)
        if(!(await c.match(r))){ const res = await old.match(r); if(res) await c.put(r, res); }
      }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
// la page du jeu (pas les autres pages comme /decouvrir/)
const SCOPE = new URL("./", self.location).pathname;
const isGamePage = u => { const p = new URL(u).pathname; return p === SCOPE || p === SCOPE + "index.html"; };
self.addEventListener("fetch", e => {
  const r = e.request, url = new URL(r.url);
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(r.method !== "GET" || (url.origin !== location.origin && !font)) return;
  if(r.mode === "navigate" && isGamePage(r.url)){
    // la page : on montre tout de suite la copie, et on va chercher la nouvelle version en même temps.
    // Si le réseau répond vite (moins de 2,5 s), on montre la nouvelle ; sinon la copie, et la nouvelle servira la fois suivante.
    e.respondWith((async () => {
      const c = await caches.open(V);
      const cached = (await c.match("index.html")) || (await c.match("./"));
      const net = fetch(r).then(n => { if(n.ok){ c.put("index.html", n.clone()); } return n; });
      e.waitUntil(net.catch(() => {}));
      if(!cached) return net;
      const quick = await Promise.race([net.catch(() => null), new Promise(ok => setTimeout(() => ok(null), 2500))]);
      return quick && quick.ok ? quick : cached;
    })());
    return;
  }
  if(r.mode === "navigate") return; // les autres pages du site : normalement, par le réseau
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(r, {ignoreSearch: url.pathname.endsWith(".json")});
    if(hit) return hit;
    const n = await fetch(r);
    if((n.ok && n.status === 200) || n.type === "opaque") c.put(r, n.clone());
    return n;
  })());
});
