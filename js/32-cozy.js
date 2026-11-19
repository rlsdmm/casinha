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
    solteiro: [{nome:"Coral",l:[0,96,32,23],r:[32,96,32,23],f:[64,96,16,32],b:[80,96,16,32],sw:"#A35B4E"},{nome:"Azul",l:[96,96,32,23],r:[128,96,32,23],f:[160,96,16,32],b:[176,96,16,32],sw:"#506580"},{nome:"Verde",l:[192,96,32,23],r:[224,96,32,23],f:[0,128,16,32],b:[16,128,16,32],sw:"#4B8053"},{nome:"Amarelo",l:[32,128,32,23],r:[64,128,32,23],f:[96,128,16,32],b:[112,128,16,32],sw:"#CC9B45"}],
    armario: [{nome:"Madeira",f:[128,128,30,29],sw:"#926140"},{nome:"Clara",f:[158,128,30,29],sw:"#997549"},{nome:"Escura",f:[188,128,30,29],sw:"#624A39"},{nome:"Branca",f:[218,128,30,29],sw:"#C0AC90"}],
    banheira: [{nome:"Creme",f:[0,160,30,16],sw:"#CDBB9D"},{nome:"Cinza",f:[30,160,30,16],sw:"#A7A6B2"},{nome:"Preta",f:[60,160,30,16],sw:"#4C4A4C"}],
    vaso: [{nome:"Branco",f:[90,160,13,16],sw:"#9D9FB0"}],
    geladeira: [{nome:"Menta",f:[103,160,16,32],sw:"#748678"},{nome:"Vermelha",f:[119,160,16,32],sw:"#C45A51"},{nome:"Amarela",f:[135,160,16,32],sw:"#CF993A"},{nome:"Creme",f:[151,160,16,32],sw:"#C7B494"}],
    fogao: [{nome:"Creme",f:[167,160,16,16],sw:"#C6B08D"},{nome:"Laranja",f:[183,160,16,16],sw:"#C38954"},{nome:"Inox",f:[199,160,16,16],sw:"#9093A2"},{nome:"Preto",f:[215,160,16,16],sw:"#4E5556"}],
    pia: [{nome:"Creme",f:[231,160,16,24],sw:"#D9C6A5"},{nome:"Inox",f:[0,192,16,24],sw:"#9093A2"},{nome:"Laranja",f:[16,192,16,24],sw:"#C38A54"},{nome:"Verde",f:[32,192,16,24],sw:"#6E8574"}],
    tapete: [{nome:"Rosa",f:[48,192,48,32],sw:"#90687F"},{nome:"Azul",f:[96,192,48,32],sw:"#6D8280"},{nome:"Verde",f:[144,192,48,32],sw:"#80765C"},{nome:"Bege",f:[192,192,48,32],sw:"#8D7E60"}],
    mesa: [{nome:"Madeira",f:[0,224,32,38],sw:"#966342"},{nome:"Clara",f:[32,224,32,38],sw:"#9A7749"},{nome:"Escura",f:[64,224,32,38],sw:"#644C3A"},{nome:"Branca",f:[96,224,32,38],sw:"#C3AF91"}],
    pc: [{nome:"Madeira",f:[128,224,32,28],o:[160,224,32,28],sw:"#8B5F3F"},{nome:"Clara",f:[192,224,32,28],o:[224,224,32,28],sw:"#956D47"},{nome:"Escura",f:[0,262,32,28],o:[32,262,32,28],sw:"#77573E"},{nome:"Branca",f:[64,262,32,28],o:[96,262,32,28],sw:"#A18265"}],
    tv: [{nome:"Madeira",f:[128,262,26,15],sw:"#956241"},{nome:"Clara",f:[154,262,26,15],sw:"#9A7649"},{nome:"Escura",f:[180,262,26,15],sw:"#644C3B"},{nome:"Branca",f:[206,262,26,15],sw:"#C2AE91"}],
    planta: [{nome:"Costela-de-adão",f:[232,262,16,32],sw:"#4F8A3C"},{nome:"Espada-de-são-jorge",f:[0,294,16,32],sw:"#7E9A3A"},{nome:"Orquídea",f:[16,294,16,32],sw:"#D46A9C"},{nome:"Lírio-da-paz",f:[32,294,16,32],sw:"#E8E2D0"}],
    abajur: [{nome:"Lanterna",f:[48,294,16,32],sw:"#F3E2B0"},{nome:"Cúpula",f:[64,294,16,32],sw:"#F0DDB4"},{nome:"Galhos",f:[80,294,16,32],sw:"#C98A3A"},{nome:"Três luzes",f:[96,294,16,32],sw:"#E8D49A"}],
    estante: [{nome:"Madeira",f:[112,294,30,30],sw:"#9E7658"},{nome:"Clara",f:[142,294,30,30],sw:"#9B7656"},{nome:"Escura",f:[172,294,30,30],sw:"#9A7456"},{nome:"Branca",f:[202,294,30,30],sw:"#997558"}],
    namoradeira: [{nome:"Coral",f:[0,326,32,16],sw:"#C06358"}],
    pufeSofa: [{nome:"Rosa",f:[32,326,13,14],sw:"#AE7767"},{nome:"Verde",f:[45,326,13,14],sw:"#796243"},{nome:"Azul",f:[58,326,13,14],sw:"#54797F"},{nome:"Cinza",f:[71,326,13,14],sw:"#84654E"}],
    sofaG: [{nome:"Lilás",f:[84,326,56,16],sw:"#775D80"},{nome:"Verde",f:[140,326,56,16],sw:"#66884B"},{nome:"Laranja",f:[196,326,56,16],sw:"#BD7945"},{nome:"Cinza",f:[0,342,56,16],sw:"#535C5E"}],
    geladeiraG: [{nome:"Inox",f:[56,342,24,31],sw:"#8F92A1"},{nome:"Laranja",f:[80,342,24,31],sw:"#C08554"}],
    telmesa: [{nome:"Madeira",f:[104,342,16,15],sw:"#9B7849"}],
    urso: [{nome:"Ursinho",f:[120,342,14,12],sw:"#C68571"}],
    camaInfantil: [{nome:"Rosa",f:[134,342,15,25],sw:"#E8858E"},{nome:"Azul",f:[149,342,15,25],sw:"#5FA8B8"},{nome:"Verde",f:[164,342,15,25],sw:"#7AAE6A"}],
    camaTeen: [{nome:"Coral",l:[179,342,32,23],r:[211,342,32,23],f:[0,373,16,32],b:[16,373,16,32],sw:"#A35B4E"},{nome:"Azul",l:[32,373,32,23],r:[64,373,32,23],f:[96,373,16,32],b:[112,373,16,32],sw:"#506580"},{nome:"Verde",l:[128,373,32,23],r:[160,373,32,23],f:[192,373,16,32],b:[208,373,16,32],sw:"#4B8053"},{nome:"Amarelo",l:[224,373,32,23],r:[0,405,32,23],f:[32,405,16,32],b:[48,405,16,32],sw:"#CC9B45"}],
    mesaEstudos: [{nome:"Rosa",f:[64,405,32,15],sw:"#E8858E"},{nome:"Azul",f:[96,405,32,15],sw:"#5FA8B8"},{nome:"Verde",f:[128,405,32,15],sw:"#7AAE6A"}],
    bloquinhos: [{nome:"Bloquinhos",f:[160,405,16,16],sw:"#CE7D4B"}],
    dossel: [{nome:"Lilás",f:[176,405,32,52],sw:"#AC8364"},{nome:"Azul",f:[208,405,32,52],sw:"#94775A"},{nome:"Verde",f:[0,457,32,52],sw:"#937C50"},{nome:"Rosa",f:[32,457,32,52],sw:"#A97B57"}],
    chuveiro: [{nome:"Box",f:[64,457,16,26],sw:"#BCD1D5"}],
    pelPintinho: [{nome:"Pintinho",f:[80,457,13,11],sw:"#D8CB80"}],
    pelCoelho: [{nome:"Coelhinho",f:[93,457,11,10],sw:"#CCB97E"}],
    pelGatinho: [{nome:"Gatinho",f:[104,457,11,11],sw:"#809BA5"}],
    pelCacto: [{nome:"Cacto",f:[115,457,11,14],sw:"#748C50"}],
    pelGirafa: [{nome:"Girafa",f:[126,457,14,16],sw:"#BE9766"}]
  },
  tv: {"tvOff":[140,457,25,20],"progs":[[[165,457,25,20],[190,457,25,20],[215,457,25,20],[0,509,25,20]],[[25,509,25,20],[50,509,25,20],[75,509,25,20],[100,509,25,20],[125,509,25,20]],[[150,509,25,20],[175,509,25,20],[200,509,25,20],[225,509,25,20],[0,529,25,20],[25,529,25,20],[50,529,25,20],[75,529,25,20]],[[100,529,25,20],[125,529,25,20],[150,529,25,20],[175,529,25,20]],[[200,529,25,20],[225,529,25,20],[0,549,25,20],[25,549,25,20]],[[50,549,25,20],[75,549,25,20],[100,549,25,20],[125,549,25,20]],[[150,549,25,20],[175,549,25,20],[200,549,25,20],[225,549,25,20],[0,569,25,20],[25,569,25,20],[50,569,25,20],[75,569,25,20]],[[100,569,25,20],[125,569,25,20],[150,569,25,20],[175,569,25,20]],[[200,569,25,20],[225,569,25,20],[0,589,25,20],[25,589,25,20],[50,589,25,20],[75,589,25,20],[100,589,25,20],[125,589,25,20]]]}
};
// v29: quadros da lareira (fogo) e do aquário (peixinhos em cima de uma mesinha), sem variante de cor
COZY.anim = {"tvTubo":[[150,589,16,29],[166,589,16,29],[182,589,16,29],[198,589,16,29],[214,589,16,29]],"pote":[[230,589,16,9],[0,618,16,9]],"lareira":[[16,618,27,30],[43,618,27,30],[70,618,27,30],[97,618,27,30],[124,618,27,30]],"aquario":[[151,618,16,30],[167,618,16,30],[183,618,16,30],[199,618,16,30],[215,618,16,30],[231,618,16,30],[0,648,16,30],[16,648,16,30],[32,648,16,30]],"arvoreNatal":[[48,648,32,32],[80,648,32,32],[112,648,32,32]],"castical":[[144,648,7,12],[151,648,7,12],[158,648,7,12],[165,648,7,12],[172,648,7,12],[179,648,7,12],[186,648,7,12]],"hamsterGaiola":[[193,648,16,14],[209,648,16,14],[225,648,16,14]],"aquarioBetta":[[0,680,16,30],[16,680,16,30],[32,680,16,30],[48,680,16,30],[64,680,16,30],[80,680,16,30],[96,680,16,30],[112,680,16,30]]};
TOP.aquario = Math.max(TOP.aquario || 0, 14);
for (const [t, h] of [["tvTubo", 13], ["geladeiraG", 15], ["telmesa", 6]]) TOP[t] = Math.max(TOP[t] || 0, h); // v34 // o aquário em cima da mesinha é mais alto que o antigo
let COZY_OFF = 0; // > 0: desenha o móvel antigo (a cama com dossel usa a cama de casal grande por baixo)
(() => {
  const im = new Image();
  im.onload = () => {
    COZY.ok = true;
    for (const k of [...sprCache.keys()]) if (/^f[vz]?:/.test(k)) sprCache.delete(k);
    bgKey = null;
  };
  im.src = "img/moveis/cozy.png?v=9"; COZY.img = im;
})();
const cozyVar = (t, cor) => { const p = COZY.pecas[t]; return p ? p[cor | 0] || p[0] : null; };
// desenha o recorte encostado no fundo do quadrado do móvel e centralizado; devolve false se não tiver arte
function arteCozy(t, x, y, f, cor, vista, w, h){
  if (!COZY.ok || COZY_OFF) return false;
  if (COZY.anim[t] && !vista){ // lareira e aquário: um quadro por vez, encostado no fundo do quadrado
    const fs = t === "aquario" && (cor | 0) === 1 && COZY.anim.aquarioBetta ? COZY.anim.aquarioBetta : COZY.anim[t]; // v38: betta
    const q = fs[(f | 0) % fs.length], c = CAT[t], ww = c.w * T, hh = c.h * T;
    ctx.drawImage(COZY.img, q[0], q[1], q[2], q[3], x + Math.floor((ww - q[2]) / 2), y + hh - q[3], q[2], q[3]);
    return true;
  }
  const v = cozyVar(t, cor); if (t === "pc" && f && !vista) vista = "o"; // computador ligado: monitor aceso
  const r = v && v[vista || "f"]; if (!r) return false;
  const c = CAT[t]; w = w || c.w * T; h = h || c.h * T;
  const [sx, sy, rw, rh] = r, dx = x + Math.floor((w - rw) / 2), dy = y + h - rh;
  if (t === "planta" && f){ // balanço leve: só as folhas mexem 1px, o vaso fica parado
    const vaso = 9, s = f === 1 ? -1 : 1;
    ctx.drawImage(COZY.img, sx, sy, rw, rh - vaso, dx + s, dy, rw, rh - vaso);
    ctx.drawImage(COZY.img, sx, sy + rh - vaso, rw, vaso, dx, dy + rh - vaso, rw, vaso);
    return true;
  }
  ctx.drawImage(COZY.img, sx, sy, rw, rh, dx, dy, rw, rh);
  if (t === "telmesa"){ // v34: o telefone (desenho do jogo) em cima da mesinha do pacote
    const px = x, py = dy - 4;
    rbox(px + 4, py - 1, 8, 6, "#7FD1B2"); R(px + 5, py - 1, 6, 1, "#A8E6CC");
    rbox(px + 3, py - 4, 10, 3, "#5DBB9A"); R(px + 4, py - 4, 8, 1, "#A8E6CC"); R(px + 3, py - 2, 2, 2, "#3F9A7C"); R(px + 11, py - 2, 2, 2, "#3F9A7C");
    R(px + 6, py + 1, 4, 3, C.cream); P(px + 7, py + 2, C.ink); P(px + 8, py + 2, C.ink);
    return true;
  }
  if (t === "tv"){ // TV em cima do rack: desligada ou passando um programa (f = 1 + programa * 8 + quadro)
    const q = f ? (COZY.tv.progs[Math.floor((f - 1) / 8)] || COZY.tv.progs[0])[(f - 1) % 8] : null, tr = q || COZY.tv.tvOff;
    ctx.drawImage(COZY.img, tr[0], tr[1], tr[2], tr[3], x + Math.floor((w - tr[2]) / 2), dy + 2 - tr[3], tr[2], tr[3]);
    return true;
  }
  if (!f || vista && vista !== "f") return true;
  // em uso: um detalhe por cima (a arte do pacote é parada)
  if (t === "fogao"){ rbox(dx + 8, dy - 2, 6, 4, "#8D9BAA"); R(dx + 9, dy - 2, 4, 1, "#C9D3DC"); P(dx + 7, dy, "#6B7787"); P(dx + 14, dy, "#6B7787"); P(dx + 4 + (f - 1), dy + 2, "#F2A65A"); P(dx + 5, dy + 1, "#FFE08A"); }
  else if (t === "pia"){ R(dx + 8, dy + 5, 1, 3, "#BFE0F5"); P(dx + 8, dy + 8, "#E6F4FD"); }
  else if (t === "banheira"){ for (const [a, b] of [[4, 0], [8, -1], [13, 0], [18, -1], [23, 0], [11, 1], [20, 1]]){ R(dx + a, dy + b, 2, 2, "#FFFFFF"); P(dx + a + 1, dy + b + 1, "#E6F4FB"); } }
  return true;
}
// TV ligada: um programa por vez (troca a cada 45 s), cada um no ritmo do GIF original
const TV_RITMO = [900, 300, 450, 450, 450, 450, 450, 450, 450];
// v39: programação pelo relógio do jogo. 0 novela, 1 futebol, 2 almoço, 3 tempo (sol), 4 tempo (chuva), 5 tempo (nublado),
// 6 café da manhã, 7 terror, 8 sobremesa
function progTV(tm){
  const h = hourNow(), chuva = !!climaAgora(), tempo = chuva ? 4 : h < 15 ? 3 : 5, alterna = Math.floor(tm / 30000) % 2;
  if (h >= 6 && h < 9) return alterna ? tempo : 6;   // manhã: previsão do tempo e café da manhã
  if (h >= 9 && h < 12) return 8;                    // receita de sobremesa
  if (h >= 12 && h < 14) return 2;                   // almoço
  if (h >= 14 && h < 18) return 1;                   // futebol à tarde
  if (h >= 18 && h < 19) return tempo;               // jornal do tempo
  if (h >= 19 && h < 23) return 0;                   // novela
  return 7;                                          // de madrugada, filme de terror
}
{ const f0 = furnFrame; furnFrame = function(t, on, tm, ph){
  if (COZY.ok && t === "lareira") return Math.floor(tm / 110) % 5;
  if (COZY.ok && t === "tvTubo") return on ? 1 + Math.floor(tm / 400) % 4 : 0; // v34: desenho antigo passando na TV de tubo da Cozy
  if (COZY.ok && t === "aquario") return Math.floor((tm + (ph || 0) * 131) / 400) % 72; // 9 quadros (peixinhos) e 8 (betta): 72 serve pros dois
  if (COZY.ok && t === "arvoreNatal") return Math.floor(tm / 220) % 3;
  if (COZY.ok && t === "hamsterGaiola") return Math.floor((tm + (ph || 0) * 97) / 160) % 3;
  if (t !== "tv" || !on || !COZY.ok) return f0(t, on, tm, ph);
  const p = Math.min(progTV(tm), COZY.tv.progs.length - 1), n = COZY.tv.progs[p].length;
  return 1 + p * 8 + Math.floor(tm / TV_RITMO[p]) % n;
}; }
// tela dos minijogos: onde fica a tela da TV e do monitor novos (x, y a partir do canto do móvel, largura, altura)
function telaCozy(b){ if (!COZY.ok) return null; return b === "tv" ? [5, -13, 21, 12] : b === "pc" ? [6, -8, 12, 8] : null; }
// desenho de frente (catálogo, prévias e quem chama drawFurn direto)
{ const d0 = drawFurn; drawFurn = function(t, x, y, f){ if (arteCozy(t, x, y, f, 0)) return; d0(t, x, y, f); }; }
{ const fd = FURN_EXTRA.dossel; if (fd) FURN_EXTRA.dossel = (x, y, f) => { COZY_OFF++; try { fd(x, y, f); } finally { COZY_OFF--; } }; }
// sprite com a variante de cor certa (sem repintar)
{ const f0 = furnSprite; furnSprite = function(t, f, cor){
  const c = CAT[t];
  if (!COZY.ok || !c || c.virt || !(COZY.pecas[t] || COZY.anim[t])) return f0(t, f, cor);
  const top = TOP[t] || 0;
  return sprite("fz:" + t + ":" + f + ":" + (cor | 0), c.w * T, c.h * T + top, (ox, oy) => arteCozy(t, ox, oy + top, f, cor), !c.chao);
}; }
// girados: sofá, poltrona e cama de solteiro têm vista de lado e de costas no pacote (v37: a arte pode passar do quadrado pra cima)
{ const v0 = spriteVirt; spriteVirt = function(t, f, cor){
  const c = CAT[t], b = c && c.base, v = COZY.ok && cozyVar(b, cor);
  if (!v || !v.b || !v.l || !v.r) return v0(t, f, cor);
  const vista = c.rot === 2 ? "b" : c.rot === 1 ? "r" : "l"; // r = 1: virado pra esquerda (encosto/cabeceira à direita)
  const r = v[vista], extra = Math.max(0, r[3] - c.h * T);
  const s = sprite("fz:" + t + ":" + (cor | 0), c.w * T, c.h * T + extra, (ox, oy) => arteCozy(b, ox, oy + extra, 0, cor, vista, c.w * T, c.h * T));
  s.ox = 0; s.oy = extra; return s;
}; }
// cores: as variantes prontas do pacote (os nomes e as amostras vêm da folha)
for (const [t, vs] of Object.entries(COZY.pecas)){
  if (vs.length < 2) continue;
  CORES[t] = { m: (CORES[t] && CORES[t].m) || {}, v: vs.map(v => ({ nome: v.nome, sw: v.sw })) };
}

// ---------------- pisos (v28) ----------------
// img/moveis/pisos.png: uma fileira de quadrinhos 16x16 do pacote, que emendam sozinhos. PISOS[i].cz = posição na fileira.
// O deck da varanda continua desenhado no código. Pisos novos entram no fim da lista (o banco guarda o índice).
PISOS.push({ nome: "Taco", a: "#7A5A3C", b: "#5E4430", tipo: "tabua" }, { nome: "Parquet", a: "#6E5238", b: "#55402C", tipo: "tabua" },
  { nome: "Ladrilho hidráulico", a: "#C9BDB8", b: "#A9473F", tipo: "xadrez" });
[[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [9, 8], [10, 9], [11, 10]].forEach(([i, k]) => { if (PISOS[i]) PISOS[i].cz = k; });
const PISOS_CZ = { img: null, ok: false };
(() => {
  const im = new Image();
  im.onload = () => { PISOS_CZ.ok = true; bgKey = null; if (typeof mode !== "undefined" && mode === "build" && typeof renderBuild === "function") renderBuild(); };
  im.src = "img/moveis/pisos.png?v=2"; PISOS_CZ.img = im;
})();
{ const d0 = drawFloorTile; drawFloorTile = function(x, y, p){
  if (PISOS_CZ.ok && p && p.cz != null){ ctx.drawImage(PISOS_CZ.img, p.cz * 16, 0, 16, 16, x * T, y * T, 16, 16); return; }
  d0(x, y, p);
}; }

// ---------------- bichinhos (v33) ----------------
// img/moveis/pets.png: gato (pintado de laranja, como a Pipoca) e cachorrinho do pacote, de lado (17x13, virados pra direita),
// e o passarinho pulando em cima da gaiola (16x32). Gatos de raça (mingau) e coelho continuam desenhados no código.
const PETS_CZ = { img: null, ok: false, q: {"gatoAnda":[[0,0,17,13],[17,0,17,13],[34,0,17,13],[51,0,17,13]],"gatoDorme":[[0,13,17,13],[17,13,17,13],[34,13,17,13],[51,13,17,13]],"caoAnda":[[0,26,17,13],[17,26,17,13],[34,26,17,13],[51,26,17,13]],"caoSenta":[[0,39,17,13],[17,39,17,13],[34,39,17,13]],"caoCome":[[0,52,17,13],[17,52,17,13]],"caoDorme":[[0,65,17,13],[17,65,17,13],[34,65,17,13],[51,65,17,13]],"gaiola":[[0,78,16,32],[16,78,16,32],[32,78,16,32],[48,78,16,32],[64,78,16,32],[80,78,16,32],[96,78,16,32],[112,78,16,32],[128,78,16,32],[144,78,16,32]]} };
(() => {
  const im = new Image();
  im.onload = () => { PETS_CZ.ok = true; for (const k of [...sprCache.keys()]) if (/^(pet|f:gaiola)/.test(k)) sprCache.delete(k); };
  im.src = "img/moveis/pets.png?v=1"; PETS_CZ.img = im;
})();
function quadroPet(tipo, pose, f){
  const q = PETS_CZ.q, gato = tipo === "gato", k = f | 0;
  if (pose === "sleep") return (gato ? q.gatoDorme : q.caoDorme)[k ? 2 : 0];
  if (pose === "walk") return (gato ? q.gatoAnda : q.caoAnda)[k ? 2 : 0];
  if (pose === "eat") return gato ? q.gatoAnda[k ? 1 : 0] : q.caoCome[k ? 1 : 0];
  if (pose === "jump") return (gato ? q.gatoAnda : q.caoAnda)[1];
  return gato ? q.gatoAnda[0] : q.caoSenta[k ? 1 : 0]; // parado / sentado
}
{ const p0 = petSprite; petSprite = function(tipo, pose, f, esq, triste){
  if (!PETS_CZ.ok || (tipo !== "gato" && tipo !== "cachorro")) return p0(tipo, pose, f, esq, triste);
  const fr = quadroPet(tipo, pose, f), desce = tipo === "gato" && pose === "eat" ? 1 : 0;
  return sprite(["petz", tipo, pose, f | 0, esq ? 1 : 0, triste ? 1 : 0].join(":"), 17, 13, (ox, oy) => {
    ctx.save(); if (esq){ ctx.translate(ox * 2 + 17, 0); ctx.scale(-1, 1); }
    ctx.drawImage(PETS_CZ.img, fr[0], fr[1], fr[2], fr[3], ox, oy + desce, fr[2], fr[3] - desce);
    ctx.restore();
    if (triste){ ctx.globalAlpha = .18; R(ox, oy, 17, 13, "#3A3F6A"); ctx.globalAlpha = 1; } // tristinho: um pouco mais apagado
  });
}; }
if (typeof petTruqueSpr === "function"){ const t0 = petTruqueSpr; petTruqueSpr = function(tipo, pose, f, esq){
  if (PETS_CZ.ok && (tipo === "gato" || tipo === "cachorro")){ // v37: todos os truques com a arte do pacote
    if (pose === "senta") return petSprite(tipo, "sit", f, esq, false);
    if (pose === "pata") return petSprite(tipo, "sit", f ? 1 : 0, esq, false);
    if (pose === "barriga" || pose === "deitado") return petSprite(tipo, "sleep", pose === "barriga" ? 1 : 0, esq, false);
  }
  return t0(tipo, pose, f, esq);
}; }
// gaiola: só a gaiola do pacote (o passarinho aparece em cima quando a casa tem um; ver passaroCozy)
{ const g0 = FURN_EXTRA.gaiola; if (g0) FURN_EXTRA.gaiola = (x, y, f) => {
  if (!PETS_CZ.ok) return g0(x, y, f);
  const q = PETS_CZ.q.gaiola[0]; ctx.drawImage(PETS_CZ.img, q[0], q[1] + 16, 16, 16, x, y, 16, 16);
}; }
// o passarinho em cima da gaiola, pulando (tristinho: parado)
function passaroCozy(x, y, tm, triste){
  if (!PETS_CZ.ok) return false;
  const fs = PETS_CZ.q.gaiola, k = triste ? 0 : Math.floor(tm / 120) % (fs.length + 14); // pula e depois descansa um pouco
  const q = fs[k < fs.length ? k : 0];
  ctx.drawImage(PETS_CZ.img, q[0], q[1], 16, 16, x, y - 16, 16, 16);
  return true;
}


// ---------------- filtro Cozy (v36) ----------------
// Móveis que o pacote não tem (coleções da loja, presentes, quintal, chuveiro, som...) continuam desenhados no código,
// mas passam por um filtro de cor: menos saturação, brancos puxando pro creme e um toque quente, como a paleta da Cozy.
// O contorno do jogo fica igual. Cada sprite é filtrado uma vez (fica guardado no sprCache já filtrado).
const FILTRO_CZ = { sat: .68, luz: .9, base: .045, quente: [1.0, .975, .93] };
const filtrados = new WeakSet();
function filtroCozy(c){
  if (!c || filtrados.has(c)) return; filtrados.add(c);
  const x = c.getContext("2d", { willReadFrequently: true }), d = x.getImageData(0, 0, c.width, c.height), a = d.data, F = FILTRO_CZ;
  for (let i = 0; i < a.length; i += 4){
    if (a[i + 3] < 20) continue;
    if (a[i] === OUTLINE[0] && a[i + 1] === OUTLINE[1] && a[i + 2] === OUTLINE[2]) continue;
    const r = a[i], g = a[i + 1], b = a[i + 2], l = .299 * r + .587 * g + .114 * b;
    for (let k = 0; k < 3; k++){
      const v = [r, g, b][k], dess = l + (v - l) * F.sat, comp = 255 * F.base + dess * F.luz;
      a[i + k] = Math.max(0, Math.min(255, Math.round(comp * F.quente[k])));
    }
  }
  x.putImageData(d, 0, 0);
}
const naoFiltra = t => !!(COZY.pecas[t] || COZY.anim[t]);
{ const f1 = furnSprite; furnSprite = function(t, f, cor){
  const s = f1(t, f, cor), c = CAT[t];
  if (c && !c.virt && !naoFiltra(t)) filtroCozy(s.c);
  return s;
}; }
{ const v1 = spriteVirt; spriteVirt = function(t, f, cor){
  const s = v1(t, f, cor), c = CAT[t];
  if (c && !naoFiltra(c.base)) filtroCozy(s.c);
  return s;
}; }

// ---------------- grama e papéis de parede mais suaves (v36) ----------------
// mesma ideia do filtro dos móveis, só que mais leve: a grama e as cores de papel de parede chegam mais perto da paleta da Cozy
function suaveCor(hex, sat, luz){
  const [r, g, b] = hexRGB(hex), l = .299 * r + .587 * g + .114 * b, q = FILTRO_CZ.quente;
  const v = [r, g, b].map((c, k) => Math.max(0, Math.min(255, Math.round((255 * .03 + (l + (c - l) * sat) * luz) * q[k]))));
  return "#" + v.map(c => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}
for (const gp of Object.values(GRAMAS)){
  for (const k of ["g", "gD", "gL"]) gp[k] = suaveCor(gp[k], .74, .93);
  if (gp.arb) gp.arb = gp.arb.map(c => suaveCor(c, .74, .93));
}
PAPEL_CORES.forEach(p => { p[1] = suaveCor(p[1], .78, .95); });


// ---------------- v37: dossel do tamanho da cama de casal; box do chuveiro embaçando ----------------
if (CAT.dossel){ CAT.dossel.w = 2; CAT.dossel.h = 2; }
// vidro do box na frente de quem toma banho, embaçado de baixo pra cima (desenhado depois do bonequinho)
function vidroBox(x, y, tm){
  ctx.globalAlpha = .28; R(x + 1, y - 9, 14, 23, "#DCEFF5");
  for (let j = 0; j < 23; j++){ ctx.globalAlpha = .12 + .5 * (j / 23); R(x + 1, y - 9 + j, 14, 1, "#F4F8FA"); }
  ctx.globalAlpha = .55; for (let k = 0; k < 3; k++){ const yy = y - 6 + k * 3; P(x + 3 + k, yy, "#FFFFFF"); P(x + 4 + k, yy - 1, "#FFFFFF"); }
  for (let n = 0; n < 4; n++){ const ph = (tm / 900 + n * .27) % 1; ctx.globalAlpha = .7; P(x + 3 + n * 3, Math.round(y - 4 + ph * 16), "#BFE0F5"); }
  ctx.globalAlpha = 1; R(x, y - 10, 1, 25, "#9AA3AE"); R(x + 15, y - 10, 1, 25, "#9AA3AE"); R(x, y - 10, 16, 1, "#B9C0CA");
}
{ const fx0 = drawFx; drawFx = function(t, x, y, tm){ fx0(t, x, y, tm); if (t === "chuveiro" && COZY.ok && COZY.pecas.chuveiro) vidroBox(x, y, tm); }; }


// ---------------- v38: Natal, velas, hamster, betta e pelúcias ----------------
const diaAgora = () => new Date(srvNow()).getDate();
// árvore de Natal animada (luzinhas piscando): só aparece no catálogo de dezembro até o Dia de Reis
Object.assign(CAT, {
  arvoreNatal: { nome: "Árvore de Natal", w: 2, h: 1, preco: 150, epoca: () => mesAgora() === 12 || (mesAgora() === 1 && diaAgora() <= 6),
    acoes: [{ id: "natal", nome: "Admirar a árvore", dur: 5, ganho: { diversao: 14, social: 4 }, junto: 1, juntoSocial: 2 }] },
  hamsterGaiola: { nome: "Gaiola do hamster", w: 1, h: 1, preco: 90, acoes: [] },
  pelPintinho: { nome: "Pintinho de pelúcia", w: 1, h: 1, preco: 70, acoes: [{ id: "urso", nome: "Abraçar o pintinho", dur: 4, ganho: { diversao: 10, social: 6 } }] },
  pelCoelho:   { nome: "Coelhinho de pelúcia", w: 1, h: 1, preco: 70, acoes: [{ id: "urso", nome: "Abraçar o coelhinho", dur: 4, ganho: { diversao: 10, social: 6 } }] },
  pelGatinho:  { nome: "Gatinho de pelúcia", w: 1, h: 1, preco: 70, acoes: [{ id: "urso", nome: "Abraçar o gatinho", dur: 4, ganho: { diversao: 10, social: 6 } }] },
  pelCacto:    { nome: "Cacto de pelúcia", w: 1, h: 1, preco: 60, acoes: [{ id: "urso", nome: "Abraçar o cacto (é fofinho!)", dur: 4, ganho: { diversao: 12, social: 4 } }] },
  pelGirafa:   { nome: "Girafinha de brinquedo", w: 1, h: 1, preco: 80, acoes: [{ id: "urso", nome: "Brincar com a girafinha", dur: 4, ganho: { diversao: 12 } }] }
});
Object.assign(TOP, { arvoreNatal: 16, hamsterGaiola: 1, pelGirafa: 1 });
if (typeof LUZ6 !== "undefined") LUZ6.arvoreNatal = ["255,214,140", 44, .9, -6];
// hamster: mais um bichinho pra adotar, que vem com a gaiola animada do pacote
if (typeof PET13 !== "undefined") PET13.hamster = { nome: "Hamster", ic: "🐹", preco: 25, fome: 10, car: 16, comida: "Dar sementinhas", cuida: "Brincar na rodinha 🎡", ch: "carinho", item: "hamsterGaiola" };
if (typeof MENU_EXTRA !== "undefined" && MENU_EXTRA.gaiola){ const g0 = MENU_EXTRA.gaiola; MENU_EXTRA.hamsterGaiola = id => {
  const r = g0(id) || []; return r.map(it => it.nota ? Object.assign({}, it, { nome: "Gaiola vazia. Adote um hamster 🐹" }) : it);
}; }
// aquário: dá pra escolher o peixe (a "cor" do aquário)
CORES.aquario = { m: {}, v: [{ nome: "Peixinhos coloridos", sw: "#7FC8E8" }, { nome: "Peixe betta", sw: "#C9504A" }] };
// castiçal aceso do pacote (jantar à luz de velas); X, Y = onde ficava a vela antiga
function velaCozy(X, Y, tm, i){
  const fs = COZY.ok && COZY.anim.castical; if (!fs) return false;
  const q = fs[(Math.floor(tm / 150) + i * 3) % fs.length];
  ctx.drawImage(COZY.img, q[0], q[1], q[2], q[3], X - 3, Y + 7 - q[3], q[2], q[3]);
  return true;
}
// ícone do hamster no painel de bichinhos
function iconeHamster(x){
  const fs = COZY.ok && COZY.anim.hamsterGaiola; if (!fs) return false;
  const q = fs[0]; x.drawImage(COZY.img, q[0], q[1], q[2], q[3], 0, 15 - q[3], q[2], q[3]); return true;
}


// ---------------- v39: lareira estalando e esquentando; crianças de pertinho ----------------
let lareiraQuente = 0, lareiraAviso = 0;
setInterval(() => {
  if (!me || typeof moveis === "undefined" || $("screenGame").hidden) return;
  let perto = 99;
  for (const m of Object.values(moveis)){
    if (!m || m.t !== "lareira") continue;
    const d = Math.hypot(me.px - (m.x + 1), me.py - (m.y + 1)); perto = Math.min(perto, d);
    if (d < 7) sfx("fogo", clamp(1 - d / 7, .15, 1) * .9);
    if (typeof particles !== "undefined" && Math.random() < .6) particles.push({ x: (m.x + 1) * T + Math.random() * 8 - 4, y: m.y * T + 2, vx: Math.random() * 4 - 2, vy: -6 - Math.random() * 6, life: 1.1, kind: "brilho" });
  }
  // quentinho: parado perto da lareira, de noite ou no inverno
  const parado = !(me.path && me.path.length), frio = estacao() === "inverno" || hourNow() >= 19 || hourNow() < 6;
  if (perto <= 2.2 && parado && frio){
    if (++lareiraQuente % 15 === 0) ganharNeeds({ energia: 2, diversao: 2 });
    if (Date.now() - lareiraAviso > 10 * 60000){ lareiraAviso = Date.now(); toast("Quentinho perto da lareira 🔥"); }
  } else lareiraQuente = 0;
}, 1000);

// a criança (ou o bebê) no "espelho": retrato grande, girando, com uma fichinha
function openFilhoPertinho(fid){
  const VIS = [["down", "De frente"], ["right", "De lado"], ["up", "De costas"], ["left", "Do outro lado"]];
  let vista = 0;
  openPanel("espelho", "Ver " + nomeFilho(fid) + " 🪞", corpo => {
    corpo.classList.add("esp12b");
    const cv = el("canvas", "espCanvas12b"); cv.width = ESP_W; cv.height = ESP_H; cv.setAttribute("role", "img");
    const leg = el("p", "espLeg12b"); leg.setAttribute("aria-live", "polite");
    const gira = el("div", "espGira12b"), lbl = el("span", "espVista12b");
    const bE = btn("◀", "btn ghost", () => { vista = (vista + 3) % 4; desenha(); }), bD = btn("▶", "btn ghost", () => { vista = (vista + 1) % 4; desenha(); });
    bE.setAttribute("aria-label", "Girar para a esquerda"); bD.setAttribute("aria-label", "Girar para a direita");
    gira.append(bE, lbl, bD);
    const ficha = el("ul", "ficha31");
    corpo.append(cv, leg, gira, ficha);
    const desenha = () => {
      const f = filhos[fid]; if (!f){ closePanel(); return; }
      const t = srvNow(), fase = filhoFase(f, t), L = lookFilho(f), x = cv.getContext("2d"), bebe = fase === "bebe" || fase === "engatinhando";
      x.imageSmoothingEnabled = false; x.drawImage(cenaEspelho(), 0, 0);
      x.globalAlpha = .22; x.fillStyle = "#3A2433"; x.beginPath(); x.ellipse(48, 128, 16, 3, 0, 0, 6.29); x.fill(); x.globalAlpha = 1;
      if (bebe){
        const s = sprite("bbface:" + L.pele + ":" + L.cabelo, 8, 7, (ox, oy) => drawBebe("berco", "acordado", ox, oy, PELES[L.pele], CABELOS[L.cabelo]));
        x.drawImage(s.c, 0, 0, s.c.width, s.c.height, 48 - s.c.width * 4, 96 - s.c.height * 8, s.c.width * 8, s.c.height * 8);
      } else {
        const pisca = Date.now() % 3400 < 150, s = kidSprite(fase === "adolescente", L, VIS[vista][0], 0, pisca ? "blink" : "stand", false), k = 4;
        x.drawImage(s.c, 0, 0, s.c.width, s.c.height, Math.round(48 - s.c.width * k / 2), 130 - s.c.height * k, s.c.width * k, s.c.height * k);
      }
      molduraEsp(x);
      gira.hidden = bebe; lbl.textContent = VIS[vista][1];
      const h = filhoHumor(f, t), txt = nomeFilho(fid) + " · " + h.em + " " + h.nome;
      if (leg.textContent !== txt) leg.textContent = txt;
      const n = filhoNeeds(f, t), st = famEstado(fid, t), dias = Math.floor((t - f.nasceu) / FAMILIA.dia);
      const onde = !st ? "" : st.onde === "escola" ? "Na escola 🎒" : st.onde === "cama" ? "Dormindo 😴" : st.brincaPet ? "Brincando com " + petNome() + " 🐾" : "Em casa";
      const pais = Object.keys(f.pais || {}).map(nomeDe).filter(Boolean).join(" e ");
      const linhas = [["Fase", FASE_NOME[fase] + " · " + dias + (dias === 1 ? " dia" : " dias")]];
      if (onde) linhas.push(["Agora", onde]);
      if (n && !bebe) linhas.push(["Como está", "Fome " + Math.round(n.fome) + " · Diversão " + Math.round(n.diversao) + " · Estudo " + Math.round(n.estudo)]);
      if (pais) linhas.push(["Pais", pais]);
      const sig = linhas.map(l => l.join("|")).join("~");
      if (ficha.dataset.sig !== sig){ ficha.dataset.sig = sig; ficha.textContent = ""; for (const [r, v] of linhas){ const li = el("li"); li.append(el("b", null, r + ": "), document.createTextNode(v)); ficha.append(li); } }
      cv.setAttribute("aria-label", nomeFilho(fid) + ", " + (bebe ? "bebê" : VIS[vista][1].toLowerCase()));
    };
    desenha();
    clearInterval(espTimer); espTimer = setInterval(() => { if (!painel || painel.id !== "espelho"){ clearInterval(espTimer); return; } desenha(); }, 150);
  });
}
