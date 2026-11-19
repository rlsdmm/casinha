"use strict";
// Casinha · leva 23: móveis com a arte do pacote Cozy Interior (shubibubi, versão completa comprada).
// Só os recortes que o jogo usa ficam aqui, empacotados em img/moveis/cozy.png (o pacote em si não vai pro repositório).
// COZY.pecas[tipo][cor] = { nome, sw (cor do botão), f: [x, y, w, h] de frente, b: de costas, l/r: de lado }.
// A cor do móvel (casa/moveis/<id>/cor) escolhe a variante pronta do pacote em vez de repintar o desenho.
// Sofá e poltrona girados usam as vistas de lado e de costas do pacote; o resto gira como antes.
const COZY = {
  img: null, ok: false,
  pecas: {
    sofa: [{nome:"Lilás",f:[0,0,32,16],b:[32,0,32,16],l:[64,0,16,32],r:[80,0,16,32],sw:"#765C7F"},{nome:"Verde",f:[96,0,32,16],b:[128,0,32,16],l:[160,0,16,32],r:[176,0,16,32],sw:"#66874B"},{nome:"Laranja",f:[192,0,32,16],b:[224,0,32,16],l:[0,32,16,32],r:[16,32,16,32],sw:"#BC7945"},{nome:"Cinza",f:[32,32,32,16],b:[64,32,32,16],l:[96,32,16,32],r:[112,32,16,32],sw:"#545C5D"}],
    poltrona: [{nome:"Mostarda",f:[128,32,16,16],l:[144,32,16,16],r:[160,32,16,16],b:[176,32,16,16],sw:"#C59449"},{nome:"Azul",f:[192,32,16,16],l:[208,32,16,16],r:[224,32,16,16],b:[240,32,16,16],sw:"#3F506F"},{nome:"Verde",f:[0,64,16,16],l:[16,64,16,16],r:[32,64,16,16],b:[48,64,16,16],sw:"#66874B"},{nome:"Vinho",f:[64,64,16,16],l:[80,64,16,16],r:[96,64,16,16],b:[112,64,16,16],sw:"#794245"}],
    casal: [{nome:"Lilás",f:[128,64,32,32],sw:"#8C7296"},{nome:"Azul",f:[160,64,32,32],sw:"#506580"},{nome:"Verde",f:[192,64,32,32],sw:"#4B8053"},{nome:"Rosa",f:[224,64,32,32],sw:"#B37770"}],
    solteiro: [{nome:"Coral",f:[0,96,16,32],sw:"#A35B4E"},{nome:"Azul",f:[16,96,16,32],sw:"#506580"},{nome:"Verde",f:[32,96,16,32],sw:"#4B8053"},{nome:"Amarelo",f:[48,96,16,32],sw:"#CC9B45"}],
    armario: [{nome:"Madeira",f:[64,96,30,29],sw:"#926140"},{nome:"Clara",f:[94,96,30,29],sw:"#997549"},{nome:"Escura",f:[124,96,30,29],sw:"#624A39"},{nome:"Branca",f:[154,96,30,29],sw:"#C0AC90"}],
    banheira: [{nome:"Creme",f:[184,96,30,16],sw:"#CDBB9D"},{nome:"Cinza",f:[214,96,30,16],sw:"#A7A6B2"},{nome:"Preta",f:[0,128,30,16],sw:"#4C4A4C"}],
    vaso: [{nome:"Branco",f:[30,128,13,16],sw:"#9D9FB0"}],
    geladeira: [{nome:"Menta",f:[43,128,16,32],sw:"#748678"},{nome:"Vermelha",f:[59,128,16,32],sw:"#C45A51"},{nome:"Amarela",f:[75,128,16,32],sw:"#CF993A"},{nome:"Creme",f:[91,128,16,32],sw:"#C7B494"}],
    fogao: [{nome:"Creme",f:[107,128,16,16],sw:"#C6B08D"},{nome:"Laranja",f:[123,128,16,16],sw:"#C38954"},{nome:"Inox",f:[139,128,16,16],sw:"#9093A2"},{nome:"Preto",f:[155,128,16,16],sw:"#4E5556"}],
    pia: [{nome:"Creme",f:[171,128,16,24],sw:"#D9C6A5"},{nome:"Inox",f:[187,128,16,24],sw:"#9093A2"},{nome:"Laranja",f:[203,128,16,24],sw:"#C38A54"},{nome:"Verde",f:[219,128,16,24],sw:"#6E8574"}],
    tapete: [{nome:"Rosa",f:[0,160,48,32],sw:"#90687F"},{nome:"Azul",f:[48,160,48,32],sw:"#6D8280"},{nome:"Verde",f:[96,160,48,32],sw:"#80765C"},{nome:"Bege",f:[144,160,48,32],sw:"#8D7E60"}]
  }
};
let COZY_OFF = 0; // > 0: desenha o móvel antigo (a cama com dossel usa a cama de casal grande por baixo)
(() => {
  const im = new Image();
  im.onload = () => {
    COZY.ok = true;
    for (const k of [...sprCache.keys()]) if (/^f[vz]?:/.test(k)) sprCache.delete(k);
    bgKey = null;
  };
  im.src = "img/moveis/cozy.png?v=1"; COZY.img = im;
})();
const cozyVar = (t, cor) => { const p = COZY.pecas[t]; return p ? p[cor | 0] || p[0] : null; };
// desenha o recorte encostado no fundo do quadrado do móvel e centralizado; devolve false se não tiver arte
function arteCozy(t, x, y, f, cor, vista, w, h){
  if (!COZY.ok || COZY_OFF) return false;
  const v = cozyVar(t, cor), r = v && v[vista || "f"]; if (!r) return false;
  const c = CAT[t]; w = w || c.w * T; h = h || c.h * T;
  const [sx, sy, rw, rh] = r, dx = x + Math.floor((w - rw) / 2), dy = y + h - rh;
  ctx.drawImage(COZY.img, sx, sy, rw, rh, dx, dy, rw, rh);
  if (!f || vista && vista !== "f") return true;
  // em uso: um detalhe por cima (a arte do pacote é parada)
  if (t === "fogao"){ rbox(dx + 8, dy - 2, 6, 4, "#8D9BAA"); R(dx + 9, dy - 2, 4, 1, "#C9D3DC"); P(dx + 7, dy, "#6B7787"); P(dx + 14, dy, "#6B7787"); P(dx + 4 + (f - 1), dy + 2, "#F2A65A"); P(dx + 5, dy + 1, "#FFE08A"); }
  else if (t === "pia"){ R(dx + 8, dy + 5, 1, 3, "#BFE0F5"); P(dx + 8, dy + 8, "#E6F4FD"); }
  else if (t === "banheira"){ for (const [a, b] of [[4, 0], [8, -1], [13, 0], [18, -1], [23, 0], [11, 1], [20, 1]]){ R(dx + a, dy + b, 2, 2, "#FFFFFF"); P(dx + a + 1, dy + b + 1, "#E6F4FB"); } }
  return true;
}
// desenho de frente (catálogo, prévias e quem chama drawFurn direto)
{ const d0 = drawFurn; drawFurn = function(t, x, y, f){ if (arteCozy(t, x, y, f, 0)) return; d0(t, x, y, f); }; }
{ const fd = FURN_EXTRA.dossel; if (fd) FURN_EXTRA.dossel = (x, y, f) => { COZY_OFF++; try { fd(x, y, f); } finally { COZY_OFF--; } }; }
// sprite com a variante de cor certa (sem repintar)
{ const f0 = furnSprite; furnSprite = function(t, f, cor){
  const c = CAT[t];
  if (!COZY.ok || !c || c.virt || !COZY.pecas[t]) return f0(t, f, cor);
  const top = TOP[t] || 0;
  return sprite("fz:" + t + ":" + f + ":" + (cor | 0), c.w * T, c.h * T + top, (ox, oy) => arteCozy(t, ox, oy + top, f, cor), !c.chao);
}; }
// girados: sofá e poltrona têm vista de lado e de costas no pacote
{ const v0 = spriteVirt; spriteVirt = function(t, f, cor){
  const c = CAT[t], b = c && c.base, v = COZY.ok && cozyVar(b, cor);
  if (!v || !v.b || !v.l) return v0(t, f, cor);
  const vista = c.rot === 2 ? "b" : c.rot === 1 ? "r" : "l"; // r = 1: virado pra esquerda (encosto à direita)
  const s = sprite("fz:" + t + ":" + (cor | 0), c.w * T, c.h * T, (ox, oy) => arteCozy(b, ox, oy, 0, cor, vista, c.w * T, c.h * T));
  s.ox = 0; s.oy = 0; return s;
}; }
// cores: as variantes prontas do pacote (os nomes e as amostras vêm da folha)
for (const [t, vs] of Object.entries(COZY.pecas)){
  if (vs.length < 2) continue;
  CORES[t] = { m: (CORES[t] && CORES[t].m) || {}, v: vs.map(v => ({ nome: v.nome, sw: v.sw })) };
}
