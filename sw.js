"use strict";
// Casinha · service worker (leva 16a). Registrado pelo js/24-acabamento.js como "sw.js?v=N" (N = <meta name="casinha-versao">).
// Por isso este arquivo NÃO precisa mudar a cada publicação: o ?v=N novo no index já faz o navegador instalar um SW novo.
//  - index.html (e qualquer navegação) e version.txt: rede primeiro (o jogo nunca fica preso numa versão velha).
//    Com rede fraca, se a rede não responder em 3,5 s, abre a cópia guardada (e o aviso de "Versão nova" cuida do resto).
//  - js/css com ?v=N, ícones e manifesto: cache primeiro. A chave tem o ?v=N, então versão nova = arquivo novo.
//  - SDK do Firebase (www.gstatic.com/firebasejs/<versão>/...): cache primeiro, num cache próprio (o endereço já tem a versão).
//  - Dados do Firebase (firebaseio.com, websocket), fontes e qualquer outro site: nem passa por aqui (vai direto pra rede).
const VERSAO = new URL(self.location.href).searchParams.get("v") || "0";
const CACHE = "casinha-app-v" + VERSAO, CACHE_SDK = "casinha-sdk";
const BASE = new URL("./", self.location.href).href;          // .../casinha/ no GitHub Pages
const INDEX = BASE;                                            // chave única do HTML (sem ?app=1, ?atualizar=N...)

self.addEventListener("install", ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // a lista de arquivos sai do próprio index publicado (os mesmos ?v=N), pra não manter duas listas
    const r = await fetch(INDEX, { cache: "no-store" });
    if (!r.ok) throw new Error("index " + r.status);
    const html = await r.clone().text();
    await c.put(INDEX, r);
    const urls = new Set(["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "version.txt"]);
    for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
      const u = m[1];
      if (/^(css|js)\/[^"]+\?v=/.test(u) || /^https:\/\/www\.gstatic\.com\/firebasejs\//.test(u)) urls.add(u);
    }
    const sdk = await caches.open(CACHE_SDK);
    await Promise.all([...urls].map(u => {
      const abs = new URL(u, BASE).href, alvo = abs.startsWith("https://www.gstatic.com/") ? sdk : c;
      return alvo.match(abs).then(ja => ja || fetch(abs, { cache: "no-cache" }).then(res => res.ok ? alvo.put(abs, res) : null)).catch(() => null);
    }));
    // na primeira instalação já assume; nas seguintes espera o jogador tocar em "Versão nova" (mensagem "pular")
  })());
});

self.addEventListener("activate", ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("casinha-app-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", ev => { if (ev.data && ev.data.tipo === "pular") self.skipWaiting(); });

const comTempo = (p, ms) => new Promise((ok, erro) => { const t = setTimeout(() => erro(new Error("demorou")), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); erro(e); }); });

async function redePrimeiro(req, chave, ms){
  const c = await caches.open(CACHE);
  // pelo endereço (não pelo Request de navegação, que não aceita opções); no-cache = confere com o servidor (304 é barato)
  const rede = fetch(req.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) c.put(chave, r.clone()).catch(() => {}); return r; });
  try { return await (ms ? comTempo(rede, ms) : rede); }
  catch (e){
    const guardado = (await c.match(chave)) || (await caches.match(chave));
    if (guardado) return guardado;
    return rede; // sem cópia guardada: espera a rede mesmo (ou falha como falharia sem SW)
  }
}
async function cachePrimeiro(req, nomeCache){
  const achou = await caches.match(req);
  if (achou) return achou;
  const r = await fetch(req);
  if (r.ok || r.type === "opaque") (await caches.open(nomeCache)).put(req, r.clone()).catch(() => {});
  return r;
}

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === "https://www.gstatic.com" && url.pathname.startsWith("/firebasejs/")){ ev.respondWith(cachePrimeiro(req, CACHE_SDK)); return; }
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return; // Firebase, fontes etc.: direto pra rede
  const caminho = url.href.slice(BASE.length).split("?")[0];
  if (req.mode === "navigate" || caminho === "" || caminho === "index.html"){ ev.respondWith(redePrimeiro(req, INDEX, 3500)); return; }
  if (caminho === "version.txt"){ ev.respondWith(redePrimeiro(req, new URL("version.txt", BASE).href, 0)); return; }
  if (caminho === "sw.js") return;
  ev.respondWith(cachePrimeiro(req, CACHE));
});
