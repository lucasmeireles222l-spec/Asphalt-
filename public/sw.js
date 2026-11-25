/* ASPHALT OUTLAWS — Service Worker (gerado por build.py; não edite à mão)
 * - Cada versão tem o PRÓPRIO cache ("ao-static-<versão>"): arquivos antigos e novos nunca se misturam.
 * - A nova versão só é ativada depois de baixar TODOS os arquivos e conferir o SHA-256 de cada um.
 *   Se qualquer arquivo falhar/divergir, a instalação é abortada e a versão atual continua intacta.
 * - Ativação só quando o jogador toca em ATUALIZAR AGORA (mensagem SKIP_WAITING).
 * - Abre offline a última versão instalada. Nunca toca em /ws, /health, Supabase nem salvamentos. */
'use strict';
const VERSION = '2026.11.24-3';
const BUILD_HASH = 'fb33281000684466';
const FILES = {
  "/index.html": "fb332810006844663c6668ff799188a8895e252d6a70ed96bc41f59fc4b42935",
  "/manifest.webmanifest": "5f5e84ce100355c686ea66affaaec3b18f830cbd2ca1b3014c41f56237f6ba11",
  "/icon-192.png": "4d200ce2a56424705b5b1abd45e10c8a86f5f890e6154535a045b9008aad1921",
  "/icon-512.png": "e133d90009f85d794eac32ce14c562ae277e47130a6f3bfd5e3f4fe59469a8d2",
  "/icon-maskable-512.png": "ac6f36c82d54435461859044fd2292db4e50164273c1c331c33e9da8e441b493"
};                 /* { "/index.html": "sha256…", … } */
const STRICT = true;                     /* false = só avisa no console quando o hash diverge (veja LEIA-ME) */
const STATIC = 'ao-static-' + VERSION, RT = 'ao-rt2';   /* novo nome: descarta caches de bibliotecas que possam ter sido gravados com erro */
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    try {
      for (const path of Object.keys(FILES)) {
        const res = await fetch(path + '?v=' + BUILD_HASH, { cache: 'reload' });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + path);
        const buf = await res.arrayBuffer();
        const got = hex(await crypto.subtle.digest('SHA-256', buf));
        if (got !== FILES[path]) { if (STRICT) throw new Error('hash divergente: ' + path); console.warn('[sw] hash divergente (STRICT off):', path); }
        const headers = { 'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream' };
        await cache.put(path, new Response(buf, { status: 200, headers }));   /* resposta nova: sem redirecionamentos */
      }
    } catch (err) { await caches.delete(STATIC); throw err; }               /* aborta: versão atual continua funcionando */
    const rt = await caches.open(RT);                                         /* bibliotecas externas: melhor esforço */
    await Promise.all(CDN.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && rt.put(u, r)).catch(() => { })));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== STATIC && k !== RT) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'GET_VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage({ version: VERSION, hash: BUILD_HASH });
});

async function swr(req) {
  /* só grava no cache respostas VERIFICADAS (cors + ok). Antes, respostas "opacas" eram gravadas mesmo quando o CDN
     devolvia erro, e o jogo ficava preso com uma biblioteca quebrada até limpar os dados do Chrome. */
  const c = await caches.open(RT), hit = await c.match(req.url);
  const net = fetch(req.url, { mode: 'cors', credentials: 'omit' })
    .then(r => { if (r && r.ok) { c.put(req.url, r.clone()); return r; } return null; }).catch(() => null);
  if (hit) return hit;
  return (await net) || fetch(req).catch(() => Response.error());
}

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const p = url.pathname;
    if (p === '/ws' || p === '/health' || p === '/version.json' || p === '/sw.js') return;   /* sempre rede */
    if (req.mode === 'navigate') { e.respondWith(caches.open(STATIC).then(c => c.match('/index.html')).then(r => r || fetch(req))); return; }
    if (FILES[p]) { e.respondWith(caches.open(STATIC).then(c => c.match(p)).then(r => r || fetch(req))); return; }
    return;
  }
  if (CDN.includes(req.url) || /(^|\.)(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) e.respondWith(swr(req));
});
