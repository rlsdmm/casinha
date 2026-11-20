"use strict";
// Casinha · v53: bonequinhos com a arte do Cozy People (Shubibubi, versão paga). Recortes em img/gente/cozypeople.png:
// só as peças em tons de cinza do andar (4 direções) e dos braços pra cima, que o jogo pinta com as cores de cada um.
// Cada peça ocupa 256x256 na folha: em cima o andar (linhas: frente, costas, direita, esquerda; 8 quadros de 32x32),
// embaixo os braços pra cima. Enquanto a folha não carrega (ou se falhar), fica o boneco desenhado pelo código.
// Sentado e deitado são montados aqui com pedaços do andar (o pacote não tem essas poses).
const GENTE = { img: null, ok: false, cache: new Map(),
  idx: { corpo: 0, olhos: 1, blush: 2, h_bob: 3, h_braids: 4, h_braids_tie: 5, h_buzzcut: 6, h_curly: 7, h_emo: 8, h_extra_long: 9, h_frenchcurl: 10, h_gentleman: 11, h_long_straight: 12, h_midiwave: 13, h_ponytail: 14, h_spacebuns: 15, h_wavy: 16,
    r_basic: 17, r_dress: 18, r_floral: 19, r_overalls: 20, r_pants: 21, r_shoes: 22, r_skirt: 23, r_spaghetti: 24, r_sporty: 25, r_stripe: 26, r_suit: 27, r_suit_tie: 28, r_sailor: 29, a_beard: 30, a_glasses: 31, a_glasses_sun: 32 } };
(() => {
  const im = new Image();
  im.onload = () => { GENTE.ok = true; for (const k of [...sprCache.keys()]) if (/^av/.test(k)) sprCache.delete(k); };
  im.src = "img/gente/cozypeople.png?v=1"; GENTE.img = im;
})();
// penteados do jogo -> cabelos do pacote (10, 11 e 12 são novos)
const CABELO_GENTE = ["gentleman", "long_straight", "spacebuns", "frenchcurl", "buzzcut", "bob", "ponytail", "braids", "curly", "emo", "wavy", "midiwave", "extra_long"];
// roupas por traje: [peça, cor] ("c" = cor da roupa, "t" = cor do terno)
const G_JEANS = "#56609E", G_CREME = "#FFF4E0", G_SAP = "#F1EDF7";
const TRAJE_GENTE = [
  [["basic", "c"], ["pants", G_JEANS], ["shoes", G_SAP]],            // 0 camiseta
  [["dress", "c"], ["shoes", G_SAP]],                                 // 1 vestido
  [["basic", G_CREME], ["skirt", "c"], ["shoes", G_SAP]],             // 2 saia e blusa
  [["basic", G_CREME], ["overalls", "c"], ["shoes", G_SAP]],          // 3 macacão
  [["sporty", "c"], ["pants", G_JEANS], ["shoes", G_SAP]],            // 4 moletom
  [["spaghetti", "c"], ["pants", G_JEANS], ["shoes", G_SAP]],         // 5 regata
  [["stripe", "c"], ["pants", "c"], ["shoes", G_SAP]],                // 6 pijama de bichinho (o capuz vem do acessDraw)
  [["spaghetti", "c"], ["skirt", "c"], ["shoes", G_SAP]],             // 7 vestido de festa
  [["suit", "t"], ["pants", "t"], ["shoes", "#3A3638"]] // 8 terno
];
// pinta uma peça em cinza com a cor dada: o tom mais comum vira a cor, os escuros vão pra sombra arroxeada, os claros clareiam
function gPeca(nome, cor){
  const key = nome + "|" + cor; let c = GENTE.cache.get(key); if (c) return c;
  const i = GENTE.idx[nome]; c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const x = c.getContext("2d"); x.drawImage(GENTE.img, (i % 8) * 256, Math.floor(i / 8) * 256, 256, 256, 0, 0, 256, 256);
  const d = x.getImageData(0, 0, 256, 256), a = d.data, n = {};
  for (let p = 0; p < a.length; p += 4) if (a[p + 3]) n[a[p]] = (n[a[p]] || 0) + 1;
  const ks = Object.keys(n).map(Number).sort((p, q) => p - q);
  let ref = ks[0], best = -1;
  for (const k of ks){ const s = k === ks[0] && ks.length > 2 ? 0 : n[k]; if (s > best){ best = s; ref = k; } }
  const [r, g, b] = hexRGB(cor), som = [40, 26, 52], mapa = {};
  for (const l of ks){
    const t = l / ref;
    if (t <= 1){ const k = Math.pow(t, 1.15), w = (1 - k) * .6; mapa[l] = [r * k + som[0] * w, g * k + som[1] * w, b * k + som[2] * w].map(Math.round); }
    else mapa[l] = [r, g, b].map(q => Math.round(Math.min(255, q * (1 + (t - 1) * .8)))); // clareia na mesma cor (cabelo escuro não fica cinza)
  }
  for (let p = 0; p < a.length; p += 4) if (a[p + 3]){ const m = mapa[a[p]]; a[p] = m[0]; a[p + 1] = m[1]; a[p + 2] = m[2]; }
  x.putImageData(d, 0, 0); GENTE.cache.set(key, c); return c;
}
const G_LINHA = { down: 0, up: 1, right: 2, left: 3 };
// camadas do visual (sem os olhos, que dependem do piscar)
function gCamadas(v){
  const L = [], cor = ROUPAS[v.roupa], terno = mix(cor, "#1E1A2A", .55), hair = CABELOS[v.cabelo];
  if (!v.banho) for (const [p, c] of TRAJE_GENTE[v.traje] || TRAJE_GENTE[0]) L.push(["r_" + p, c === "c" ? cor : c === "t" ? terno : c]);
  const h = CABELO_GENTE[v.estilo] || "gentleman"; L.push(["h_" + h, hair]); if (h === "braids") L.push(["h_braids_tie", "#E8607A"]);
  if (v.barba) L.push(["a_beard", sh(hair, -.05)]);
  if (v.acess === 1) L.push(["a_glasses", "#6B4A3A"]);
  return L;
}
// quadro 32x32 montado: sec 0 = andar, 1 = braços pra cima; olho: "aberto", "fechado", "feliz"
function gQuadro(v, sec, dir, fr, olho, blush){
  const lin = G_LINHA[dir] || 0, key = ["gq", v.corpo, v.roupa, v.traje, v.cabelo, v.estilo, v.pele, v.barba, v.acess, v.banho, sec, lin, fr, olho, blush].join(":");
  let c = GENTE.cache.get(key); if (c) return c;
  c = document.createElement("canvas"); c.width = 32; c.height = 32; const x = c.getContext("2d");
  const sx = fr * 32, sy = sec * 128 + lin * 32, pele = PELES[v.pele];
  const camada = (nome, cor, al) => { x.globalAlpha = al == null ? 1 : al; x.drawImage(gPeca(nome, cor), sx, sy, 32, 32, 0, 0, 32, 32); x.globalAlpha = 1; };
  camada("corpo", pele);
  // olhos: o corpo já vem com o olho marcado; fechado/feliz pinta o olho de pele e risca uma linha
  if (olho === "aberto") camada("olhos", "#3A2433");
  else {
    const o = gPeca("olhos", "#3A2433").getContext("2d").getImageData(sx, sy, 32, 32).data, lin2 = olho === "feliz" ? 0 : 1;
    const pts = []; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) if (o[(j * 32 + i) * 4 + 3]) pts.push([i, j]);
    const top = {}; for (const [i, j] of pts) top[i] = top[i] == null ? j : Math.min(top[i], j);
    x.fillStyle = pele; for (const [i, j] of pts) x.fillRect(i, j, 1, 1);
    x.fillStyle = sh(pele, -.55); for (const [i, j] of pts) if (j === top[i] + lin2) x.fillRect(i, j, 1, 1);
  }
  if (lin !== 1) camada("blush", "#EE6070", blush ? .9 : .28);
  for (const [p, cor] of gCamadas(v)) camada(p, cor);
  GENTE.cache.set(key, c); return c;
}
// copia linhas [y0, y1) do quadro pra tela, com a origem do quadro em (ox, oy)
const gBlit = (q, ox, oy, y0, y1) => { if (y1 > y0) ctx.drawImage(q, 0, y0, 32, y1 - y0, Math.round(ox), Math.round(oy + y0), 32, y1 - y0); };
// cor de um pixel do quadro (pra calça, sapato e camisa do sentado)
const gCor = (q, i, j) => { const d = q.getContext("2d").getImageData(i, j, 1, 1).data; return d[3] ? "rgb(" + d[0] + "," + d[1] + "," + d[2] + ")" : null; };

{ const velho = drawAvatarLocal; drawAvatarLocal = function(v, cx, by, dir, frame, pose){
  if (!GENTE.ok) return velho(v, cx, by, dir, frame, pose);
  pose = String(pose || "stand");
  const fx = { blush: pose.indexOf("blush") >= 0, happy: pose.indexOf("happy") >= 0 };
  const olho = (fecha) => fx.happy ? "feliz" : fecha ? "fechado" : "aberto";
  const ox = cx - 16, oy = by - 32, side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  const acess = (hy, d) => { const a = v.acess; acessDraw(cx, hy, d, a === 1 ? Object.assign({}, v, { acess: 0 }) : v); };
  const baguncado = hy => { if (pose.indexOf("messy") >= 0) cabeloBaguncado(cx, hy, v.estilo, CABELOS[v.cabelo]); };
  if (pose.indexOf("lie") === 0){ // deitado: só a cabeça pra fora da coberta
    const q = gQuadro(v, 0, "down", 0, olho(pose.indexOf("open") < 0 || pose.indexOf("blink") > 0), fx.blush), y = by - 24;
    gBlit(q, ox, y, 0, 24); baguncado(y + 11); acess(y + 12, "down"); return;
  }
  const blink = pose.indexOf("blink") >= 0, breath = pose.indexOf("breath") >= 0;
  if (pose.indexOf("sit") === 0){ gSentado(v, cx, by, dir, frame, pose, olho(blink), fx, breath, acess, baguncado); return; }
  if (pose === "arms"){ const q = gQuadro(v, 1, dir, 0, olho(blink), fx.blush); gBlit(q, ox, oy, 0, 32); if (v.barriga) gBarriga(v, q, cx, oy, dir); acess(oy + 12, dir); return; }
  const fr = ((frame | 0) % 4) * 2, q = gQuadro(v, 0, dir, fr, olho(blink), fx.blush);
  if (breath){ gBlit(q, ox, oy, 27, 32); gBlit(q, ox, oy + 1, 0, 27); } else gBlit(q, ox, oy, 0, 32);
  const sobe = breath ? 1 : 0, pulo = fr === 2 || fr === 6 ? -1 : 0;
  if (v.barriga) gBarriga(v, q, cx, oy + sobe, dir);
  baguncado(oy + 11 + sobe + pulo); acess(oy + 12 + sobe + pulo, dir);
}; }
// barriga de grávida: um volume na cor da camisa por cima da barriga
function gBarriga(v, q, cx, oy, dir){
  const b = v.barriga, cam = gCor(q, 16, 27) || ROUPAS[v.roupa], cL = sh(cam, .25), cD = sh(cam, -.25), ol = sh(cam, -.6);
  if (dir === "left" || dir === "right"){ // de lado: a barriga sai pra frente
    const m = dir === "right" ? 1 : -1, x0 = m > 0 ? cx + 5 : cx - 6;
    for (let k = 0; k < b; k++){ const x = x0 + m * k, h = 3 - (k === b - 1 && k ? 1 : 0); R(x, oy + 25 + (h < 3 ? 1 : 0), 1, h, k === b - 1 ? cD : cam); }
    const xf = x0 + m * b; R(xf, oy + 25 + (b > 1 ? 1 : 0), 1, b > 1 ? 1 : 3, ol); P(x0 + m * (b - 1), oy + 24 + (b > 1 ? 1 : 0), ol); P(x0 + m * (b - 1), oy + 28, ol);
  } else if (dir === "down"){ // de frente: barriga redondinha com brilho
    const w = 4 + b * 2, x0 = cx - w / 2;
    R(x0, oy + 27, w, 3, ol); R(x0 - 1, oy + 28, w + 2, 1, ol); R(x0 + 1, oy + 30, w - 2, 1, ol); // contorno
    R(x0 + 1, oy + 26, w - 2, 4, cam); R(x0, oy + 27, w, 2, cam); R(x0 + 1, oy + 29, w - 2, 1, cD); P(x0 + w - 1, oy + 28, cD);
    P(x0 + 1, oy + 27, cL); P(x0 + 2, oy + 27, cL); P(x0 + 1, oy + 28, cL);
  }
}
// sentado: tronco do quadro de andar + colo, canela e pé desenhados (de costas, as pernas somem na frente)
function gSentado(v, cx, by, dir, frame, pose, olho, fx, breath, acess, baguncado){
  const resto = pose.slice(3), act = /^eat/.test(resto) ? "eat" : /^drink/.test(resto) ? "drink" : /^pc/.test(resto) ? "pc" : /^arms/.test(resto) ? "arms" : "";
  const f = frame ? 1 : 0, b = breath ? 1 : 0, ox = cx - 16, side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  const q = gQuadro(v, act === "arms" ? 1 : 0, dir, 0, olho, fx.blush), base = gQuadro(v, 0, dir, 0, olho, fx.blush);
  const pele = PELES[v.pele], cor = ROUPAS[v.roupa], ts = v.banho ? [] : TRAJE_GENTE[v.traje] || TRAJE_GENTE[0];
  const cDe = c => c === "c" ? cor : c === "t" ? mix(cor, "#1E1A2A", .55) : c, pc = n => { const e = ts.find(t => t[0] === n); return e ? cDe(e[1]) : null; };
  const perna = pc("pants") || pc("skirt") || pc("dress") || (v.traje === 3 ? cor : pele), sap = pc("shoes") || sh(pele, -.06), pD = sh(perna, -.45), skD = sh(pele, -.2);
  const metal = "#C6D0DA", xic = "#7FB8E8";
  if (dir === "up"){ // de costas: by é o assento
    const oy = by - 29 + b; gBlit(q, ox, oy, 0, 29); if (v.barriga) gBarriga(v, q, cx, oy, dir);
    if (act === "pc"){ P(cx - 6, oy + 24 - (f ? 0 : 1), pele); P(cx + 5, oy + 24 - (f ? 1 : 0), skD); }
    baguncado(oy + 11); acess(oy + 12, "up"); return;
  }
  const oy = by - 32 + 1 + b; // o tronco desce 1px; o colo cobre o quadril
  gBlit(q, ox, oy, 0, 27); if (v.barriga) gBarriga(v, q, cx, oy, dir);
  const ly = by - 4;
  if (side){ // coxa pra frente, canela descendo, pé
    R(X(-6, 9), ly - 1, 9, 4, pD); R(X(-6, 8), ly, 8, 2, perna); R(X(-6, 2), ly + 2, 2, 1, perna); R(X(-7, 4), by - 1, 4, 1, sap); P(X(-7, 1), by - 1, sh(sap, -.25));
    if (v.traje === 1 || v.traje === 7) R(X(-6, 7), ly, 7, 1, sh(perna, .15));
    const mc = gCor(base, side ? 16 : 11, 26) || ROUPAS[v.roupa];
    if (act === "pc"){ R(X(-3, 3), ly - 1, 3, 1, mc); P(X(-4, 1), ly - 1 - f, pele); }
    else if ((act === "eat" || act === "drink") && f){ R(X(-3, 2), oy + 23, 2, 1, mc); P(X(-5, 1), oy + 22, pele); if (act === "eat"){ P(X(-6, 1), oy + 21, metal); P(X(-7, 1), oy + 20, metal); } else R(X(-7, 2), oy + 20, 2, 2, xic); }
    else if (act !== "arms") P(X(-4, 1), ly, pele);
  } else { // de frente: colo, canelinhas e os pés
    R(cx - 6, ly - 1, 12, 4, pD); R(cx - 5, ly, 10, 2, perna); R(cx - 5, ly, 10, 1, sh(perna, .15)); P(cx - 1, ly + 1, pD);
    if (v.traje === 1 || v.traje === 2 || v.traje === 7){ R(cx - 6, ly + 2, 12, 1, pD); R(cx - 5, ly + 1, 10, 1, perna); }
    R(cx - 4, by - 1, 3, 1, sap); R(cx + 1, by - 1, 3, 1, sap); P(cx - 4, by - 1, sh(sap, -.25)); P(cx + 3, by - 1, sh(sap, -.25));
    if (act !== "arms"){
      const hyL = act === "pc" && !f ? ly - 1 : ly, hyR = act === "pc" && f ? ly - 1 : ly;
      P(cx - 4, hyL, pele); if (!((act === "eat" || act === "drink") && f)) P(cx + 3, hyR, skD);
      if (act === "eat" && !f){ P(cx + 3, ly - 1, metal); P(cx + 3, ly - 2, metal); }
      if (act === "drink" && !f) R(cx + 3, ly - 2, 2, 2, xic);
      if ((act === "eat" || act === "drink") && f){ R(cx + 4, oy + 22, 1, 2, skD); if (act === "eat"){ P(cx + 3, oy + 21, metal); P(cx + 2, oy + 21, "#F6D25A"); } else { R(cx + 2, oy + 21, 2, 2, xic); P(cx + 2, oy + 21, "#D6ECFA"); } }
    }
  }
  baguncado(oy + 11); acess(oy + 12, dir);
}
// o pacote já vem com contorno: os bonecos novos não ganham o contorno automático
{ const s0 = sprite; sprite = function(key, w, h, fn, outline){ return s0(key, w, h, fn, GENTE.ok && /^av/.test(key) ? false : outline); }; }
// espelho: o boneco novo ampliado 4x (no lugar do desenho grande e da arte pronta do PixelLab, que tinham outro estilo)
{ const r0 = retrato; retrato = function(v, vista, pose, hum, anim){
  if (!GENTE.ok || !v) return r0(v, vista, pose, hum, anim);
  if (typeof vRoupa13 === "function") v = vRoupa13(v);
  if (typeof vUnif === "function") v = vUnif(v);
  v = Object.assign(visual(v), { barriga: v.barriga || 0 });
  anim = anim || {};
  const braco = pose === "acenar" && anim.aceno > 0, key = JSON.stringify(["g", v, vista, braco, anim.piscar ? 1 : 0, anim.resp ? 1 : 0]);
  let c = retratoCache.get(key); if (c) return c;
  const t = document.createElement("canvas"); t.width = 32; t.height = 33;
  withCtx(t.getContext("2d"), 1, () => drawAvatarLocal(v, 16, 33 - (anim.resp ? 0 : 0), vista || "down", 0, (braco ? "arms" : anim.resp ? "breath" : "stand") + (anim.piscar && !braco ? "blink" : "")));
  c = document.createElement("canvas"); c.width = ESP_CW; c.height = ESP_CH; const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(t, 0, 0, 32, 33, (ESP_CW - 96) / 2, ESP_CH - 6 - 99, 96, 99); // 3x, com os pés no tapete
  retratoCache.set(key, c); if (retratoCache.size > 80) retratoCache.delete(retratoCache.keys().next().value);
  return c;
}; }
{ const a0 = rpAchar; rpAchar = function(v){ return GENTE.ok ? null : a0(v); }; }
// "mão na cintura" não existe no pacote: o espelho fica com em pé e acenando
{ const i = ESP_POSES.findIndex(p => p[0] === "cintura"); if (i >= 0) ESP_POSES.splice(i, 1); }
