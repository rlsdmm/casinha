"use strict";
// Casinha · leva 6: papel de parede, decoração, nível do casal e loja da semana
// =====================================================================
// LEVA 6: paredes (papel e decoração), 3 minigames novos, nível do casal, loja da semana
//   casa/paredes/<cômodo>, casa/paredes2/<cômodo> = { p: padrão, c: cor }   (como os pisos; ausente = papel original)
//   casa/decor/<id> = { t, x, y, andar?, por }   presa na parede de cima de um cômodo (tile de parede com chão embaixo)
//   casa/nivel/xp     XP do casal (sempre por transação na folha: xpCasal(n))
//   casa/loja/<t>     true = item da loja da semana já comprado (decoração: "dc-<t>"); fica no catálogo pra sempre
//   casa/leva6        flag da migração (XP inicial a partir dos contadores antigos)
//   casa/jogos/<id>   reflexo: rf;  desenho: ds + tracos/<rodada>/<push>;  perguntas: pq
// =====================================================================
let paredes = {}, paredes2 = {}, decor = {}, nivelXp = 0, nivelCarregado = false, lojaDonos = {}, leva6Tentou = false;
let papelPad = 1, papelCor = 0;
function leva6Reset(){ paredes = {}; paredes2 = {}; paredesSigC = null; decor = {}; nivelXp = 0; nivelCarregado = false; lojaDonos = {}; leva6Tentou = false; }

// ---------------- papel de parede ----------------
const PAPEL_CORES = [["Lilás", "#BEACEA"], ["Rosa", "#F5C6D6"], ["Pêssego", "#F7CDB0"], ["Amarelo", "#F7E3A8"], ["Menta", "#BFE5DA"], ["Azul", "#C5E0F6"],
  ["Sálvia", "#B9CFA6"], ["Creme", "#F4E6CF"], ["Cinza", "#CFC8DA"], ["Terracota", "#D9967A"], ["Azul-noite", "#3F4B7E"], ["Vinho", "#8E3B5A"]];
const PAPEL_PADROES = [
  { id: "liso", nome: "Liso" }, { id: "listras", nome: "Listras" }, { id: "bolinhas", nome: "Bolinhas" }, { id: "xadrez", nome: "Xadrez" },
  { id: "flor", nome: "Florzinha" }, { id: "tijolo", nome: "Tijolinho" }, { id: "madeira", nome: "Madeira" },
  { id: "coracoes", nome: "Corações", nivel: 4 }, { id: "estrelas", nome: "Estrelinhas douradas", nivel: 14 }
];
let paredesSigC = null; // leva 8: a assinatura entra na chave do fundo a cada quadro; calcula só quando as paredes mudam
const paredesSig = () => paredesSigC || (paredesSigC = JSON.stringify(paredes) + JSON.stringify(paredes2));
function papelDe(room){
  const v = (COMODOS2.has(room) ? paredes2 : paredes)[room];
  if (!v || typeof v !== "object") return null;
  const p = PAPEL_PADROES[v.p], c = PAPEL_CORES[v.c];
  return p && c ? { p: p.id, a: c[1] } : null;
}
// mesma moldura do drawFace (topo, linha, rodapé); o miolo (9 linhas) muda com o padrão. Padrões presos ao x absoluto: emendam entre tiles.
function drawPapel(px, py, pp){
  const a = pp.a, escuro = hexRGB(a).reduce((s, v) => s + v, 0) < 420;
  const b = sh(a, -.12), l = sh(a, .32), d = sh(a, -.26), y0 = py + 4;
  R(px, py, T, 3, CAP); R(px, py, T, 1, CAP_L); R(px, py + 3, T, 1, LINE);
  R(px, y0, T, 9, a);
  switch (pp.p){
    case "listras": for (let i = 0; i < T; i += 4){ R(px + i, y0, 2, 9, b); P(px + i + 2, y0 + 2 + ((px + i) >> 2) % 2 * 4, l); } break;
    case "bolinhas": for (let j = 0; j < 3; j++) for (let i = (j % 2) * 4 + 1; i < T; i += 8){ R(px + i, y0 + 1 + j * 3, 2, 2, escuro ? l : d); P(px + i, y0 + 1 + j * 3, escuro ? sh(a, .55) : b); } break;
    case "xadrez": for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2) R(px + i * 4, y0 + j * 3, 4, 3, b); R(px, y0 + 3, T, 1, sh(a, -.06)); break;
    case "flor":
      for (const [fx, fy, k] of [[2, 1, 0], [10, 5, 1]]){
        const x = px + fx, y = y0 + fy, pe = k ? (escuro ? "#F9C9D6" : "#FFFFFF") : (escuro ? "#FCE9B8" : d);
        P(x + 1, y, pe); P(x, y + 1, pe); P(x + 2, y + 1, pe); P(x + 1, y + 2, pe); P(x + 1, y + 1, "#F6C667"); P(x + 3, y + 2, "#6DB37A");
      } break;
    case "tijolo": {
      const ar = escuro ? sh(a, .22) : sh(a, .42);
      for (let r = 0; r < 3; r++){
        const yy = y0 + r * 3; R(px, yy + 2, T, 1, ar);
        for (const jx of r % 2 ? [3, 11] : [7, 15]){ R(px + jx, yy, 1, 2, ar); P(px + jx - 5, yy, l); }
        if (hash(px, r, 41) % 3 === 0) R(px + (r % 2 ? 5 : 1), yy + 1, 3, 1, b);
      } break;
    }
    case "madeira": for (let i = 0; i < T; i += 4){ const v = (hash(px + i, 0, 9) % 5 - 2) * .035; R(px + i, y0, 3, 9, sh(a, v)); R(px + i + 3, y0, 1, 9, d); P(px + i + 1, y0 + 1 + hash(px + i, 1, 9) % 6, b); P(px + i, y0, l); } break;
    case "coracoes":
      for (const [fx, fy, k] of [[2, 1, 0], [10, 5, 1]]){ const x = px + fx, y = y0 + fy, c = k ? "#E8607A" : (escuro ? "#F9C9D6" : "#F49AAE"); P(x, y, c); P(x + 2, y, c); R(x, y + 1, 3, 1, c); P(x + 1, y + 2, c); } break;
    case "estrelas":
      for (const [fx, fy] of [[3, 2], [11, 5]]){ const x = px + fx, y = y0 + fy; P(x, y - 1, "#F6C667"); R(x - 1, y, 3, 1, "#F6C667"); P(x, y + 1, "#F6C667"); P(x, y, "#FCE9B8"); }
      P(px + 8, y0 + 1, "#FCE9B8"); P(px + 14, y0 + 7, "#FCE9B8"); P(px + 6, y0 + 7, sh(a, .4)); break;
    default: R(px, y0 + 7, T, 1, b); R(px, y0 + 8, T, 1, sh(a, -.06)); // liso
  }
  R(px, y0, T, 1, sh(a, -.16));
  R(px, py + 13, T, 1, "#D2A06C"); R(px, py + 14, T, 1, "#A5754B"); R(px, py + 15, T, 1, "#6B4429");
}

// ---------------- decoração de parede ----------------
// d(x, y): desenho dentro do tile da parede (sprite com contorno); anim(x, y, tm, hr): por cima, a cada quadro; vivo: só anim (sem sprite)
const casalVisual = () => Object.entries(jogadores).filter(([, j]) => j && j.nome).sort((a, b) => (a[1].entrou || 0) - (b[1].entrou || 0)).slice(0, 2).map(([, j]) => visual(j));
const DECOR_CAT = {
  quadroPaisagem: { nome: "Quadro de paisagem", preco: 60, d(x, y){
    R(x + 3, y + 5, 10, 7, "#C9973F"); R(x + 3, y + 5, 10, 1, "#F0C870"); R(x + 4, y + 6, 8, 5, "#9FD3F2");
    R(x + 6, y + 8, 3, 1, "#8B78C0"); R(x + 5, y + 9, 5, 1, "#8B78C0"); P(x + 7, y + 7, "#FFFFFF"); P(x + 6, y + 8, "#FFFFFF");
    P(x + 10, y + 7, "#FFE08A"); R(x + 4, y + 10, 8, 1, "#6DB37A"); P(x + 11, y + 9, "#5AA068"); } },
  quadroGato: { nome: "Quadro de gatinho", preco: 60, d(x, y){
    R(x + 3, y + 4, 10, 8, C.woodD); R(x + 3, y + 4, 10, 1, C.wood); R(x + 4, y + 5, 8, 6, "#F9E3C8");
    R(x + 5, y + 7, 5, 3, "#E8A55A"); P(x + 5, y + 6, "#E8A55A"); P(x + 9, y + 6, "#E8A55A"); P(x + 7, y + 7, "#C97F3A");
    P(x + 6, y + 8, C.ink); P(x + 8, y + 8, C.ink); P(x + 7, y + 9, "#E8607A"); P(x + 10, y + 9, "#E8A55A"); P(x + 11, y + 8, "#E8A55A"); } },
  quadroCoracao: { nome: "Quadro de coração", preco: 50, d(x, y){
    R(x + 4, y + 5, 8, 7, "#E58FB5"); R(x + 4, y + 5, 8, 1, "#F9C9D6"); R(x + 5, y + 6, 6, 5, "#FFF4F8"); pixHeart(x + 5, y + 7, "#E8607A"); P(x + 6, y + 7, "#F7A3B5"); } },
  quadroAbstrato: { nome: "Quadro abstrato", preco: 70, d(x, y){
    R(x + 2, y + 4, 12, 9, "#2E2638"); R(x + 3, y + 5, 10, 7, "#FFF4E0");
    R(x + 4, y + 6, 4, 3, "#E8735F"); R(x + 8, y + 8, 4, 3, "#378ADD"); R(x + 9, y + 6, 3, 1, "#F6C667"); P(x + 10, y + 7, "#F6C667"); R(x + 4, y + 10, 3, 1, "#2E2638"); P(x + 7, y + 9, "#7FD1B2"); } },
  fotoCasal: { nome: "Foto do casal", preco: 90, chave: () => casalVisual().map(v => [v.cabelo, v.pele, v.roupa].join(".")).join("-"), d(x, y){
    R(x + 3, y + 3, 10, 10, "#FFFFFF"); R(x + 4, y + 4, 8, 6, "#9FD3F2"); R(x + 4, y + 9, 8, 1, "#8DBB8A");
    const cs = casalVisual();
    [[0, 4], [1, 8]].forEach(([i, dx]) => {
      const v = cs[i] || { cabelo: i ? 3 : 0, pele: i ? 0 : 2, roupa: i ? 4 : 2 };
      R(x + dx, y + 5, 3, 1, CABELOS[v.cabelo]); R(x + dx, y + 6, 3, 2, PELES[v.pele]); P(x + dx + (i ? 2 : 0), y + 6, CABELOS[v.cabelo]); R(x + dx, y + 8, 3, 2, ROUPAS[v.roupa]);
    });
    P(x + 7, y + 4, "#E8607A"); R(x + 4, y + 11, 8, 1, "#F1EDF7"); P(x + 10, y + 11, "#E8607A"); } },
  prateleira: { nome: "Prateleira com coisinhas", preco: 70, d(x, y){
    R(x + 1, y + 10, 14, 2, C.wood); R(x + 1, y + 10, 14, 1, C.woodL); P(x + 3, y + 12, C.woodD); P(x + 12, y + 12, C.woodD);
    R(x + 2, y + 8, 3, 2, C.coral); R(x + 2, y + 7, 3, 1, C.leaf); P(x + 3, y + 6, C.leafL);
    R(x + 6, y + 5, 2, 5, "#5246B0"); P(x + 6, y + 5, "#6F5CC0"); R(x + 8, y + 6, 2, 4, "#E8607A");
    R(x + 11, y + 7, 3, 3, "#C5E8F6"); R(x + 11, y + 6, 3, 1, C.gold); P(x + 12, y + 8, "#FFFFFF"); } },
  luzinhas: { nome: "Luzinhas pisca-pisca", preco: 80, vivo: 1, anim(x, y, tm, hr){
    const sag = [0, 1, 1, 2, 2, 2, 1, 1], cores = ["#FF6B7A", "#FFD45C", "#6FE0A8", "#7FB8FF", "#E39BFF"], noite = darkness(hr) > .08;
    for (let i = 0; i < T; i++) P(x + i, y + 4 + sag[i % 8], "#3B5A2E");
    for (let k = 0; k < 4; k++){
      const i = 1 + k * 4, by = y + 5 + sag[i % 8], c = cores[(k + (x >> 4)) % cores.length];
      const on = !noite || Math.floor(tm / 420 + k * 1.7 + (x >> 4)) % 3 !== 0;
      R(x + i, by, 2, 2, noite ? (on ? c : sh(c, -.45)) : sh(c, .3)); if (on && noite) P(x + i, by, "#FFFFFF");
    } } },
  relogio: { nome: "Relógio de parede", preco: 60, d(x, y){
    R(x + 6, y + 4, 4, 1, C.woodD); R(x + 5, y + 5, 6, 1, C.woodD); R(x + 4, y + 6, 8, 4, C.woodD); R(x + 5, y + 10, 6, 1, C.woodD); R(x + 6, y + 11, 4, 1, C.woodD);
    R(x + 6, y + 5, 4, 1, "#FFF8EC"); R(x + 5, y + 6, 6, 4, "#FFF8EC"); R(x + 6, y + 10, 4, 1, "#FFF8EC"); P(x + 7, y + 5, "#E8607A"); P(x + 7, y + 12, C.gold); },
    anim(x, y, tm, hr){ const cx = x + 7, cy = y + 8, ah = (hr % 12) / 12 * Math.PI * 2, am = (hr % 1) * Math.PI * 2;
      P(cx + Math.round(Math.sin(am) * 2), cy - Math.round(Math.cos(am) * 2), "#8D9BAA"); P(cx + Math.round(Math.sin(am)), cy - Math.round(Math.cos(am)), "#8D9BAA");
      P(cx + Math.round(Math.sin(ah)), cy - Math.round(Math.cos(ah)), C.ink); P(cx, cy, C.ink); } },
  espelho: { nome: "Espelho redondo", preco: 70, d(x, y){
    R(x + 5, y + 3, 6, 1, "#D8A64A"); R(x + 4, y + 4, 8, 8, "#D8A64A"); R(x + 5, y + 12, 6, 1, "#D8A64A");
    R(x + 5, y + 4, 6, 8, "#C5E8F6"); R(x + 6, y + 5, 1, 3, "#FFFFFF"); P(x + 7, y + 5, "#FFFFFF"); R(x + 5, y + 10, 6, 2, "#A4D0E4"); P(x + 9, y + 9, "#EAF8FE"); } },
  plantinha: { nome: "Plantinha pendurada", preco: 45, d(x, y){
    R(x + 7, y + 2, 1, 4, "#8C5E3A"); R(x + 5, y + 6, 6, 3, C.coral); R(x + 5, y + 6, 6, 1, "#F29A86"); P(x + 6, y + 5, C.leaf); P(x + 9, y + 5, C.leafL);
    R(x + 4, y + 8, 2, 4, C.leaf); R(x + 10, y + 8, 2, 5, C.leaf); R(x + 7, y + 9, 2, 3, C.leafD); P(x + 3, y + 11, C.leafD); P(x + 12, y + 12, C.leafD);
    P(x + 4, y + 9, C.leafL); P(x + 8, y + 12, C.leafL); P(x + 11, y + 10, C.leafL); } },
  letreiro: { nome: "Letreiro com coração", preco: 100, d(x, y){
    P(x + 4, y + 4, "#8C5E3A"); P(x + 11, y + 4, "#8C5E3A");
    R(x + 2, y + 5, 12, 7, C.wood); R(x + 2, y + 5, 12, 1, C.woodL); R(x + 2, y + 11, 12, 1, C.woodD);
    pixHeart(x + 6, y + 7, "#E8607A"); P(x + 7, y + 7, "#F7A3B5"); P(x + 3, y + 8, C.cream); P(x + 4, y + 9, C.cream); P(x + 12, y + 8, C.cream); P(x + 11, y + 9, C.cream); } },
  // nível do casal
  neon: { nome: "Coração neon", preco: 150, nivel: 11, semContorno: 1, d(x, y){
    const c = "#FF7AB6", rows = [[1, 2, 6, 7], [0, 3, 5, 8], [0, 4, 8], [1, 7], [2, 6], [3, 5], [4]];
    rows.forEach((r, j) => r.forEach(i => P(x + 3 + i, y + 4 + j, c))); },
    anim(x, y, tm, hr){ if (darkness(hr) < .08) return; ctx.globalAlpha = .55 + .25 * Math.sin(tm / 260); const rows = [[1, 2, 6, 7], [0, 3, 5, 8], [0, 4, 8], [1, 7], [2, 6], [3, 5], [4]];
      rows.forEach((r, j) => r.forEach(i => P(x + 3 + i, y + 4 + j, "#FFE0EF"))); ctx.globalAlpha = 1; } },
  vitral: { nome: "Vitral", preco: 180, nivel: 18, d(x, y){
    R(x + 5, y + 3, 6, 1, "#5A4E8A"); R(x + 4, y + 4, 8, 9, "#5A4E8A");
    R(x + 5, y + 4, 3, 3, "#E8607A"); R(x + 8, y + 4, 3, 3, "#7FB8E8"); R(x + 5, y + 8, 3, 4, "#F6C667"); R(x + 8, y + 8, 3, 4, "#7FD1B2");
    P(x + 5, y + 4, "#F7A3B5"); P(x + 8, y + 4, "#C4E8F8"); P(x + 5, y + 8, "#FCE9B8"); P(x + 8, y + 8, "#BFEFDC"); } },
  // loja da semana
  quadroOnda: { nome: "Quadro da onda", preco: 70, loja: "praia", d(x, y){
    R(x + 3, y + 5, 10, 7, "#378ADD"); R(x + 3, y + 5, 10, 1, "#7FB8E8"); R(x + 4, y + 6, 8, 5, "#C4E8F8");
    R(x + 4, y + 9, 8, 2, "#378ADD"); R(x + 5, y + 8, 3, 1, "#378ADD"); P(x + 6, y + 7, "#7FB8E8"); P(x + 7, y + 7, "#FFFFFF"); P(x + 8, y + 8, "#FFFFFF");
    P(x + 10, y + 7, "#FFE08A"); R(x + 9, y + 10, 3, 1, "#F3DDBE"); } },
  leque: { nome: "Leque japonês", preco: 60, loja: "japa", d(x, y){
    const c = "#D9483D", l = "#FFF4E0";
    R(x + 4, y + 5, 8, 1, c); R(x + 3, y + 6, 10, 1, c); R(x + 4, y + 7, 8, 1, c); R(x + 5, y + 8, 6, 1, c); R(x + 6, y + 9, 4, 1, c);
    for (let i = 4; i < 12; i += 2) P(x + i, y + 6, l); P(x + 7, y + 7, "#F6C667");
    for (const [a, b] of [[4, 5], [6, 6], [9, 6], [11, 5]]) P(x + a, y + b + 2, "#A8322B");
    R(x + 7, y + 10, 2, 2, C.woodD); P(x + 7, y + 12, "#F6C667"); } },
  vinil: { nome: "Disco de vinil", preco: 60, loja: "retro", d(x, y){
    R(x + 6, y + 4, 4, 1, "#2C2C2A"); R(x + 5, y + 5, 6, 1, "#2C2C2A"); R(x + 4, y + 6, 8, 4, "#2C2C2A"); R(x + 5, y + 10, 6, 1, "#2C2C2A"); R(x + 6, y + 11, 4, 1, "#2C2C2A");
    P(x + 5, y + 7, "#4A4258"); P(x + 10, y + 8, "#4A4258"); P(x + 6, y + 5, "#5A5268"); R(x + 7, y + 7, 2, 2, "#E8607A"); P(x + 7, y + 7, "#F7A3B5"); } },
  guirlanda: { nome: "Guirlanda de folhas", preco: 60, loja: "floresta", d(x, y){
    const g = C.leaf, gD = C.leafD;
    R(x + 6, y + 3, 4, 2, g); R(x + 4, y + 4, 2, 2, gD); R(x + 10, y + 4, 2, 2, gD); R(x + 3, y + 6, 2, 3, g); R(x + 11, y + 6, 2, 3, g);
    R(x + 4, y + 9, 2, 2, gD); R(x + 10, y + 9, 2, 2, gD); R(x + 6, y + 10, 4, 2, g);
    P(x + 4, y + 5, "#D9483D"); P(x + 11, y + 7, "#D9483D"); P(x + 8, y + 3, "#F6C667"); P(x + 3, y + 8, "#F6C667");
    P(x + 7, y + 12, "#E8607A"); P(x + 8, y + 12, "#E8607A"); P(x + 6, y + 13, "#E8607A"); P(x + 9, y + 13, "#E8607A"); } },
  donut: { nome: "Quadro de donut", preco: 60, loja: "doce", d(x, y){
    R(x + 3, y + 4, 10, 9, "#7FD1B2"); R(x + 4, y + 5, 8, 7, "#FFF8EC");
    R(x + 6, y + 6, 4, 1, "#D9A877"); R(x + 5, y + 7, 6, 3, "#D9A877"); R(x + 6, y + 10, 4, 1, "#C08A5A");
    R(x + 6, y + 6, 4, 1, "#E58FB5"); R(x + 5, y + 7, 6, 2, "#E58FB5"); R(x + 7, y + 8, 2, 1, "#FFF8EC");
    P(x + 6, y + 7, "#7FB8E8"); P(x + 9, y + 7, "#F6C667"); P(x + 8, y + 6, "#FFFFFF"); } },
  planeta: { nome: "Quadro de planeta", preco: 70, loja: "espaco", d(x, y){
    R(x + 3, y + 4, 10, 9, "#1E2440"); R(x + 3, y + 4, 10, 1, "#2E3866");
    R(x + 6, y + 6, 4, 4, "#E8735F"); R(x + 6, y + 6, 2, 1, "#F29A86"); R(x + 4, y + 8, 8, 1, "#F6C667"); P(x + 9, y + 9, "#B8503D");
    P(x + 4, y + 5, "#FFFFFF"); P(x + 11, y + 6, "#FFFFFF"); P(x + 5, y + 11, "#FCE9B8"); P(x + 11, y + 11, "#FFFFFF"); } }
};
function decorSprite(t){ const d = DECOR_CAT[t], k = d.chave ? d.chave() : ""; return sprite("dc:" + t + ":" + k, 16, 16, (ox, oy) => { if (d.d) d.d(ox, oy); }, !d.vivo && !d.semContorno); }
function decorIcone(t, w, h){ // ícone pro catálogo/loja: a parede atrás e a decoração por cima
  const cv = el("canvas"); cv.width = w || 128; cv.height = h || 96; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  const k = Math.min(cv.width, cv.height) / 18, ox = Math.round((cv.width - 16 * k) / 2), oy = Math.round((cv.height - 16 * k) / 2);
  withCtx(x, k, () => { ctx.translate(ox, oy); drawPapel(0, 0, { p: "liso", a: "#F4E6CF" }); const d = DECOR_CAT[t]; if (d.vivo && d.anim) d.anim(0, 0, Date.now(), 21); ctx.setTransform(1, 0, 0, 1, 0, 0); });
  if (!DECOR_CAT[t].vivo){ x.drawImage(decorSprite(t).c, ox - k, oy - k, 18 * k, 18 * k); if (DECOR_CAT[t].anim) withCtx(x, k, () => { ctx.translate(ox, oy); DECOR_CAT[t].anim(0, 0, Date.now(), 10.2); ctx.setTransform(1, 0, 0, 1, 0, 0); }); }
  return cv;
}
const decorDoAndar = () => Object.entries(decor).filter(([, d]) => d && DECOR_CAT[d.t] && (d.andar || 0) === andarAtual);
function decorEm(x, y){ const e = decorDoAndar().find(([, d]) => d.x === x && d.y === y); return e ? e[0] : null; }
// parede de cima de um cômodo: tile de parede com chão embaixo, fora janelas, portas, decoração fixa, mural, quadro de troféus e paredes de fora
function decorSpotOk(x, y, ignore){
  if (x <= 0 || x >= W - 1 || x === VX || y < 0 || y >= HC || !isFace(x, y)) return false;
  const k = x + "," + y;
  if (janelas().has(k) || decorAtual()[k]) return false;
  if (andarAtual === 0 && ((x === MURAL.x && y === MURAL.y) || (x === QUADRO.x && y === QUADRO.y))) return false;
  // leva 8 proibia pendurar atrás de móvel alto (ficava escondida e o toque ia pro móvel). Leva 16a libera de novo:
  // no modo viver a decoração é desenhada por cima do móvel, 2px mais alta (addDecorFrente); no construir o móvel alto
  // fica meio transparente (cobreDecor); e o toque na faixa da parede escolhe a decoração (07-jogo.js, leva 8).
  return !decorDoAndar().some(([id, d]) => id !== ignore && d.x === x && d.y === y);
}
// leva 8: móvel alto (que sobe por cima da parede de trás) encostado nessa parede
const DECOR_ALTO = 7;
function moveAltoEm(x, y){ const id = occ[y] && occ[y][x], m = id && moveis[id]; return !!m && (TOP[m.t] || 0) >= DECOR_ALTO; }
// leva 8: o inverso: um móvel alto colocado logo abaixo de uma decoração esconderia ela
// leva 16a: não esconde mais (a decoração aparece por cima); fica a função porque o construir ainda pergunta
function escondeDecor(){ return false; }
// leva 16a: móvel alto com decoração na parede logo acima (no construir ele fica meio transparente)
function cobreDecor(m){
  const c = CAT[m.t]; if (!c || c.chao || (TOP[m.t] || 0) < DECOR_ALTO) return false;
  for (let dx = 0; dx < c.w; dx++) if (decorEm(m.x + dx, m.y - 1)) return true;
  return false;
}
// leva 16a: no modo viver, decoração atrás de móvel alto entra na fila de desenho logo depois do móvel, 2px mais alta
function addDecorFrente(objs, tm){
  if (mode !== "live") return;
  const hr = hourNow();
  for (const [, d] of decorDoAndar()){
    if (!isFace(d.x, d.y) || !moveAltoEm(d.x, d.y + 1)) continue;
    const m = moveis[occ[d.y + 1][d.x]], c = CAT[m.t], def = DECOR_CAT[d.t], px = d.x * T, py = d.y * T - 2 + (d.y === 0 ? DY35 : 0);
    objs.push({ z: (m.y + c.h) * T - 1 + .3, f: () => {
      R(px + 3, py + 14, 10, 1, "rgba(35,18,40,.28)"); // sombrinha no móvel, pra parecer pendurada na frente
      if (!def.vivo) ctx.drawImage(decorSprite(d.t).c, px - 1, py - 1);
      if (def.anim) def.anim(px, py, tm, hr);
    } });
  }
}
function drawDecorParede(tm, hr){
  for (const [id, d] of decorDoAndar()){
    if (mode === "build" && tool && tool.kind === "decorMover" && tool.id === id) continue;
    if (!isFace(d.x, d.y)) continue;
    if (mode === "live" && moveAltoEm(d.x, d.y + 1)) continue; // leva 16a: vai por cima do móvel (addDecorFrente)
    const def = DECOR_CAT[d.t], px = d.x * T, py = d.y * T + (d.y === 0 ? DY35 : 0); // v47: parede alta
    if (!def.vivo) ctx.drawImage(decorSprite(d.t).c, px - 1, py - 1);
    if (def.anim) def.anim(px, py, tm, hr);
  }
}
// luzes no mapa de luz (só aparecem quando escurece): decoração e móveis novos
const LUZ6 = { andon: ["255,214,150", 46, .95, 0], lava: ["220,140,255", 30, .8, -2], cogumelo: ["255,190,140", 34, .85, -2], cupcake: ["255,170,210", 32, .85, -4],
  saturno: ["255,200,140", 32, .85, -2], jukebox: ["255,170,120", 26, .7, -6], fliperama: ["140,190,255", 22, .7, -6], lareira: ["255,150,80", 50, .95, 4], aquario: ["120,200,255", 24, .6, -4] };
function leva6Luzes(lights, ativo, tm){
  for (const m of Object.values(moveis)){
    const L = LUZ6[m.t]; if (!L || !CAT[m.t]) continue;
    lights.push([m.x * T + CAT[m.t].w * T / 2, m.y * T + L[3], L[1], L[0], L[2] * (m.t === "lareira" ? .88 + .12 * Math.sin(tm / 90) * Math.sin(tm / 230) : 1)]);
  }
  for (const [, d] of decorDoAndar()){
    const x = d.x * T + 8, y = d.y * T + 7 + (d.y === 0 ? DY35 : 0);
    if (d.t === "luzinhas") lights.push([x, y, 30, "255,214,150", .85]);
    else if (d.t === "neon") lights.push([x, y + 1, 28, "255,110,180", .9]);
    else if (d.t === "letreiro") lights.push([x, y + 2, 16, "255,180,200", .5]);
  }
}
// modo construir: verde onde dá pra pendurar; cômodo inteiro marcado no papel de parede
function comodoDoToque(tx, ty){
  if (!MAP[ty] || tx < 0 || tx >= W) return null;
  if (MAP[ty][tx] !== 1) return comodo(tx, ty);
  if (isFace(tx, ty) && tx > 0 && tx < W - 1) return comodo(tx === VX ? tx + 1 : tx, ty + 1);
  return null;
}
function leva6Fantasma(){
  if (mode !== "build" || !tool) return;
  if (tool.kind === "decor" || tool.kind === "decorMover"){
    ctx.fillStyle = "rgba(93,202,165,.25)";
    for (let y = 0; y < HC; y++) for (let x = 1; x < W - 1; x++) if (decorSpotOk(x, y, tool.id)) ctx.fillRect(x * T + 1, y * T + 4 + (y === 0 ? DY35 : 0), T - 2, 9);
    if (hover && MAP[hover.y]){
      const ok = decorSpotOk(hover.x, hover.y, tool.id);
      const hy = hover.y * T + (hover.y === 0 ? DY35 : 0); // v47: parede alta
      ctx.fillStyle = ok ? "rgba(93,202,165,.45)" : "rgba(240,112,122,.45)"; ctx.fillRect(hover.x * T, hy, T, T);
      if (ok){ ctx.globalAlpha = .85; const def = DECOR_CAT[tool.t]; if (!def.vivo) ctx.drawImage(decorSprite(tool.t).c, hover.x * T - 1, hy - 1); else def.anim(hover.x * T, hy, Date.now(), hourNow()); ctx.globalAlpha = 1; }
    }
  } else if (tool.kind === "papel" && hover){
    const cm = comodoDoToque(hover.x, hover.y); if (!cm || cm === "quintal") return;
    ctx.fillStyle = "rgba(142,124,240,.28)";
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      if (MAP[y][x] !== 1 && comodo(x, y) === cm) ctx.fillRect(x * T, y * T, T, T);
      else if (isFace(x, y) && x > 0 && x < W - 1 && comodo(x === VX ? x + 1 : x, y + 1) === cm) ctx.fillRect(x * T, y === 0 ? -TOPO + 4 : y * T + 4, T, y === 0 ? TOPO + 9 : 9);
    }
  }
}
// toque no modo construir (papel, pendurar, mover/vender decoração). true = já tratou
function leva6BuildClick(tx, ty, p){
  if (tool && tool.kind === "papel"){
    const cm = comodoDoToque(tx, ty);
    if (!cm || cm === "quintal"){ toast("Toque num cômodo ou numa parede de dentro de casa."); return true; }
    const pd = PAPEL_PADROES[tool.p]; if (pd && pd.nivel && nivelCasal() < pd.nivel){ toast("Esse papel libera no nível " + pd.nivel + " do casal."); return true; }
    const v = tool.p < 0 ? null : { p: tool.p, c: tool.c };
    ref((COMODOS2.has(cm) ? "casa/paredes2/" : "casa/paredes/") + cm).set(v).then(() => toast(COMODOS[cm] + (v ? " com papel de parede novo." : " com o papel original de volta.")), () => toast("Não deu pra trocar agora."));
    return true;
  }
  if (tool && (tool.kind === "decor" || tool.kind === "decorMover")){
    const def = DECOR_CAT[tool.t];
    if (!decorSpotOk(tx, ty, tool.id)){
      toast(MAP[ty] && MAP[ty][tx] === 1 && isFace(tx, ty) && moveAltoEm(tx, ty + 1) ? "Aí tem um móvel alto na frente: a decoração ficaria escondida." :
        MAP[ty] && MAP[ty][tx] === 1 && isFace(tx, ty) && tx > 0 && tx < W - 1 && tx !== VX ? "Aí não dá: janela, mural ou já tem coisa nessa parede." : "Decoração vai na parede de cima de um cômodo (as marcadas de verde).");
      return true;
    }
    if (tool.kind === "decorMover"){ const id = tool.id; tool = null; txn("casa/decor/" + id, cur => cur ? Object.assign(cur, { x: tx, y: ty }) : undefined).then(ok => toast(ok ? "Decoração no lugar novo." : "Essa decoração não está mais na parede.")); renderBuild(); return true; }
    if (def.nivel && nivelCasal() < def.nivel){ toast(def.nome + " libera no nível " + def.nivel + " do casal."); return true; }
    const preco = tool.preco != null ? tool.preco : def.preco;
    if (!gastar(preco, def.nome.toLowerCase())) return true;
    const novo = { t: tool.t, x: tx, y: ty, por: pid }; if (andarAtual === 1) novo.andar = 1;
    ref("casa/decor").push(novo).then(() => { toast(def.nome + " na parede. -$" + preco); sfx("pop"); if (def.loja) ref("casa/loja/dc-" + tool.t).set(true).catch(() => {}); }, () => { ganhar(preco); toast("Não deu pra pendurar agora."); });
    return true;
  }
  if (!tool){
    const id = decorEm(tx, ty); if (!id) return false;
    const d = decor[id], def = DECOR_CAT[d.t], volta = Math.round(def.preco * .7);
    openMenu(p, def.nome, [
      { nome: "Mover", fn: () => { tool = { kind: "decorMover", t: d.t, id }; buildTab = "parede"; renderBuild(); toast("Toque na parede nova."); } },
      { nome: "Vender", info: "+$" + volta, fn: () => txn("casa/decor/" + id, cur => cur ? null : undefined).then(ok => { if (!ok){ toast("Essa decoração já saiu da parede."); return; } ganhar(volta); toast("Venda feita: " + def.nome + ". +$" + volta); }) }
    ]);
    return true;
  }
  return false;
}
// toque na decoração no modo viver: espelho troca o visual, relógio diz a hora, o resto dá pra admirar
function irParede(x, y, fn){
  goTo(null, (a, b) => b === y + 1 && Math.abs(a - x) <= 1, () => { me.dir = "up"; savePos(); fn(); });
}
function decorClickVivo(tx, ty, p){
  const id = decorEm(tx, ty); if (!id) return false;
  const d = decor[id], def = DECOR_CAT[d.t], items = [];
  if (d.t === "espelho") items.push({ nome: "Me ver no espelho", info: "🪞", fn: () => irParede(tx, ty, () => openEspelho(pid)) }, { nome: "Trocar o visual", info: "Espelho", fn: () => irParede(tx, ty, () => openCreator(true)) }); // leva 12b
  if (d.t === "relogio"){ const h = hourNow(); items.push({ nota: 1, nome: "São " + Math.floor(h) + "h" + String(Math.floor((h % 1) * 60)).padStart(2, "0") + "." }); }
  if (def.menu) items.push(...def.menu(id, d)); // leva 9: mural de fotos abre o álbum, calendário abre as datas
  items.push({ nome: "Admirar", info: "Diversão", fn: () => irParede(tx, ty, () => startAcao({ id: "admirar", nome: "Admirando: " + def.nome.toLowerCase(), dur: 3, ganho: { diversao: 6 } })) });
  openMenu(p, def.nome, items);
  return true;
}
// aba Paredes do modo construir
function hintParede(){
  return tool && tool.kind === "papel" ? "Toque num cômodo (no chão ou na parede) pra trocar o papel de parede." :
    tool && tool.kind === "decor" ? "Toque numa parede marcada de verde pra pendurar." :
    tool && tool.kind === "decorMover" ? "Toque no lugar novo da decoração." :
    "Escolha um padrão e uma cor e toque num cômodo. Ou pendure uma decoração. Toque numa decoração da parede pra mover ou vender.";
}
function renderParedes(){
  const box = $("paredesBox"); box.innerHTML = "";
  const nv = nivelCasal(), papelOn = tool && tool.kind === "papel";
  box.append(el("p", "sec", "Papel de parede"));
  const pads = el("div", "floors");
  const bo = btn("Original", "floor txt", () => { tool = { kind: "papel", p: -1 }; renderBuild(); });
  bo.setAttribute("aria-pressed", String(!!(papelOn && tool.p < 0))); bo.title = "Volta o papel que o cômodo tinha"; pads.append(bo);
  PAPEL_PADROES.forEach((pd, i) => {
    const trava = !!pd.nivel && nv < pd.nivel, b = el("button", "floor"); b.type = "button"; b.style.position = "relative";
    b.title = pd.nome + (trava ? " (nível " + pd.nivel + ")" : ""); b.setAttribute("aria-label", pd.nome + (trava ? ", libera no nível " + pd.nivel + " do casal" : ""));
    const cv = el("canvas"); cv.width = 16; cv.height = 16; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
    withCtx(x, 1, () => drawPapel(0, 0, { p: pd.id, a: PAPEL_CORES[papelCor][1] }));
    b.append(cv); if (trava){ b.disabled = true; b.append(el("span", "lk", "🔒")); }
    b.setAttribute("aria-pressed", String(!!(papelOn && tool.p === i)));
    b.onclick = () => { papelPad = i; tool = { kind: "papel", p: i, c: papelCor }; renderBuild(); };
    pads.append(b);
  });
  box.append(pads, el("p", "sec", "Cor do papel"));
  const cores = el("div", "swatches");
  PAPEL_CORES.forEach(([n, c], i) => {
    const b = btn("", "swatch", () => { papelCor = i; tool = { kind: "papel", p: papelOn && tool.p >= 0 ? tool.p : papelPad, c: i }; renderBuild(); });
    b.style.background = c; b.setAttribute("aria-label", n); b.title = n; b.setAttribute("aria-pressed", String(papelCor === i)); cores.append(b);
  });
  box.append(cores, el("p", "sec", "Decoração de parede"));
  const cat = el("div", "cat");
  for (const [t, d] of Object.entries(DECOR_CAT)){
    if (d.loja && !lojaDonos["dc-" + t]) continue;
    if (d.soZero && !casaZero) continue; // leva 11: mural e quadro de troféus de parede (casa do zero)
    const trava = !!d.nivel && nv < d.nivel, b = el("button", "item"); b.type = "button";
    const cv = decorIcone(t); if (trava) cv.style.opacity = ".45";
    b.append(cv, el("span", null, d.nome), trava ? el("span", "lk", "🔒 Nível " + d.nivel) : el("span", "pr", "$" + d.preco));
    if (trava) b.setAttribute("aria-label", d.nome + ", libera no nível " + d.nivel + " do casal");
    b.setAttribute("aria-pressed", String(!!(tool && tool.kind === "decor" && tool.t === t && !tool.loja)));
    b.disabled = trava || (!!me && me.dinheiro < d.preco);
    b.onclick = () => { tool = tool && tool.kind === "decor" && tool.t === t && !tool.loja ? null : { kind: "decor", t }; renderBuild(); };
    cat.append(b);
  }
  box.append(cat);
}

// ---------------- nível do casal ----------------
const XP_JUNTO = 4, XP_SOCIAL = 2, NIVEL_MAX = 20;
const xpDoNivel = n => n <= 1 ? 0 : Math.round(30 * (n - 1) + 12 * (n - 1) * (n - 1)); // 2: 42 · 5: 312 · 10: 1242 · 20: 4902
function nivelDe(xp){ let n = 1; while (n < NIVEL_MAX && xp >= xpDoNivel(n + 1)) n++; return n; }
function nivelCasal(){ return nivelDe(nivelXp); }
// ganha XP do casal (cada um soma a própria parte; transação na folha casa/nivel/xp)
function xpCasal(n){ if (!me || !salaRef || !(n > 0)) return; txn("casa/nivel/xp", v => (+v || 0) + n); }
function premiosNivel(){
  const l = [];
  for (const [t, c] of Object.entries(CAT)) if (c.nivel) l.push({ n: c.nivel, tipo: "movel", k: t, nome: c.nome });
  TRAJES.forEach((t, i) => { if (t.nivel) l.push({ n: t.nivel, tipo: "traje", k: i, nome: t.nome + " (roupa)" }); });
  ACESS.forEach((a, i) => { if (a.nivel) l.push({ n: a.nivel, tipo: "acess", k: i, nome: a.nome + " (acessório)" }); });
  PAPEL_PADROES.forEach((p, i) => { if (p.nivel) l.push({ n: p.nivel, tipo: "papel", k: i, nome: "Papel " + p.nome.toLowerCase() }); });
  for (const [t, d] of Object.entries(DECOR_CAT)) if (d.nivel) l.push({ n: d.nivel, tipo: "decor", k: t, nome: d.nome });
  return l.sort((a, b) => a.n - b.n);
}
function premioIcone(p){
  if (p.tipo === "decor") return decorIcone(p.k, 40, 40);
  const cv = el("canvas"); cv.width = 40; cv.height = 40; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  if (p.tipo === "movel"){ const s = furnSprite(p.k, 0), k = Math.min(40 / s.c.width, 40 / s.c.height); x.drawImage(s.c, (40 - s.c.width * k) / 2, (40 - s.c.height * k) / 2, s.c.width * k, s.c.height * k); }
  else if (p.tipo === "papel") withCtx(x, 2.5, () => drawPapel(0, 0, { p: PAPEL_PADROES[p.k].id, a: "#F5C6D6" }));
  else { const base = Object.assign({}, (me && me.dados) || {}), v = visual(base); if (p.tipo === "traje") v.traje = p.k; else v.acess = p.k; x.drawImage(avatarSprite(v, "down", 0, "stand").c, 0, AV_Y0, 18, 29, 6, 2, 27, 36); }
  return cv;
}
// leva 8: subiu vários níveis de uma vez (ex.: migração de XP): mostra os presentes de todos, não só do último
function festaNivel(n, de){
  de = Math.min(de || n - 1, n - 1);
  const pr = premiosNivel().filter(p => p.n > de && p.n <= n);
  toastEspecial(n - de > 1 ? "Níveis " + (de + 1) + " a " + n + " do casal!" : "Nível " + n + " do casal!", pr.length ? "Liberou: " + pr.map(p => p.nome).join(", ") + "." : "Cada vez mais juntinhos.");
  confete(); setTimeout(() => sfx("nivel"), 380);
  if (me) burst(me.px, me.py, "heart");
}
function renderNivelHud(){
  const n = nivelCasal(), a = xpDoNivel(n), b = xpDoNivel(n + 1), max = n >= NIVEL_MAX;
  const pct = max ? 100 : (nivelXp - a) / (b - a) * 100, txt = max ? "Nível máximo!" : (nivelXp - a) + "/" + (b - a) + " XP";
  $("nivelTx").textContent = "♥ Nível " + n; $("nivelBar").style.width = clamp(pct, 0, 100) + "%"; $("nivelXp").textContent = txt;
  $("bNivel").setAttribute("aria-label", "Nível " + n + " do casal, " + txt + ". Ver presentes");
}
$("bNivel").onclick = () => openNivel();
function openNivel(){
  openPanel("nivel", "Nível do casal", corpo => {
    const topo = el("div", "nivelbtn"), lista = el("div", "niveis");
    topo.style.cursor = "default";
    corpo.append(topo, el("p", "muted", "O casal ganha XP fazendo coisas JUNTOS: ações lado a lado (café, dança no som, comer, cozinhar, faxina a dois, piscina...), carinhos e conversas, partidas na TV, noites de conchinha e dias em dupla. Cada nível libera um presente pra casa ou pro guarda-roupa."), el("h3", null, "Presentes"), lista);
    let sig = null;
    const upd = () => {
      const n = nivelCasal(), s = n + ":" + nivelXp; if (s === sig) return; sig = s;
      const a = xpDoNivel(n), b = xpDoNivel(n + 1), max = n >= NIVEL_MAX;
      topo.textContent = ""; topo.append(el("span", "nv", "♥ Nível " + n), barra(max ? 100 : (nivelXp - a) / (b - a) * 100, "#E8607A"), el("small", null, max ? nivelXp + " XP" : "faltam " + (b - nivelXp) + " XP"));
      topo.querySelector(".bar").style.flex = "1 1 auto";
      lista.textContent = "";
      for (const p of premiosNivel()){
        const ok = n >= p.n, row = el("div", "rowi" + (ok ? "" : " lock")), esq = el("div", "me"), tx = el("div", "tx");
        esq.style.gap = "10px"; tx.append(el("strong", null, p.nome), el("small", null, ok ? (p.tipo === "traje" || p.tipo === "acess" ? "Liberado: no espelho" : p.tipo === "movel" ? "Liberado: no modo construir" : "Liberado: na aba Paredes") : "🔒 Libera no nível " + p.n));
        esq.append(el("span", "nv", "Nv " + p.n), premioIcone(p), tx); row.append(esq); lista.append(row);
      }
    };
    upd(); return upd;
  });
}
// migração: casas antigas começam com um pouco de XP pelo que já fizeram juntos (até o nível 8)
function garantirLeva6(){
  if (leva6Tentou || !me || !casaOk || !statsCarregados || !nivelCarregado) return; leva6Tentou = true;
  txn("casa/leva6", cur => cur ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    const s = stats, xp = ((s.dancas || 0) + (s.abracos || 0) + (s.beijos || 0)) * 2 + (s.noites || 0) * 15 + (s.pratosJuntos || 0) * 6 + (s.partidas || 0) * 8 + (s.diasDupla || 0) * 20 + (s.limpezas || 0);
    if (xp > 0) xpCasal(Math.min(xp, xpDoNivel(8)));
  });
}

// ---------------- loja da semana ----------------
const TEMAS = [
  { id: "praia", nome: "Semana Praia", ic: "🏖️", itens: ["guardasol", "cadeiraPraia", "prancha", "boia", "dc:quadroOnda"] },
  { id: "japa", nome: "Semana Japonesa", ic: "🎋", itens: ["andon", "bonsai", "biombo", "chabudai", "dc:leque"] },
  { id: "retro", nome: "Semana Retrô", ic: "📻", itens: ["jukebox", "tvTubo", "lava", "telefone", "dc:vinil"] },
  { id: "floresta", nome: "Semana Floresta", ic: "🍄", itens: ["toco", "cogumelo", "samambaia", "casinhaPassaro", "dc:guirlanda"] },
  { id: "doce", nome: "Semana Doce", ic: "🧁", itens: ["macaron", "cupcake", "pirulito", "vitrineDoces", "dc:donut"] },
  { id: "espaco", nome: "Semana Espacial", ic: "🚀", itens: ["foguete", "saturno", "astronauta", "pufePlaneta", "dc:planeta"] }
];
const LOJA_PROMO = .7, SEG_REF = new Date(2024, 0, 1).getTime(); // 1º/jan/2024 foi segunda-feira
const lojaDef = k => k.startsWith("dc:") ? DECOR_CAT[k.slice(3)] : CAT[k];
const lojaChave = k => k.startsWith("dc:") ? "dc-" + k.slice(3) : k;
// semana de segunda a domingo (hora local), tema = (nº da semana + código da sala): igual em todo aparelho da casa
function semanaInfo(){
  const agora = new Date(srvNow()), dia = (agora.getDay() + 6) % 7;
  const ini = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - dia), fim = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 7);
  const num = Math.round((ini.getTime() - SEG_REF) / (7 * 24 * HORA)), n = TEMAS.length;
  const ti = (((num + (salaSeed >>> 0) % n) % n) + n) % n, tema = TEMAS[ti];
  const outro = TEMAS[(ti + 1 + hash(num, salaSeed, 91) % (n - 1)) % n], extra = outro.itens[hash(num, salaSeed, 92) % (outro.itens.length - 1)];
  const promo = tema.itens[hash(num, salaSeed, 93) % tema.itens.length];
  return { num, tema, vitrine: tema.itens.concat([extra]), extra, promo, fim: fim.getTime() };
}
const lojaPreco = (k, s) => { const p = lojaDef(k).preco; return k === s.promo ? Math.round(p * LOJA_PROMO) : p; };
function faltaTxt(ms){ ms = Math.max(0, ms); const d = Math.floor(ms / (24 * HORA)), h = Math.floor(ms % (24 * HORA) / HORA), m = Math.floor(ms % HORA / 60000); return d ? d + "d " + h + "h" : h ? h + "h " + m + "min" : m + "min"; }
function lojaIcone(k){
  if (k.startsWith("dc:")) return decorIcone(k.slice(3));
  const cv = el("canvas"); cv.width = 128; cv.height = 96; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  const spr = furnSprite(k, 0), sc = Math.min(128 / spr.c.width, 96 / spr.c.height, 4);
  x.drawImage(spr.c, Math.round((128 - spr.c.width * sc) / 2), Math.round((96 - spr.c.height * sc) / 2), Math.round(spr.c.width * sc), Math.round(spr.c.height * sc));
  return cv;
}
function openLoja(){
  openPanel("loja", "Loja da semana", corpo => {
    const hd = el("div", "lojahd"), tit = el("strong"), cd = el("span", "money"), grade = el("div", "cat");
    hd.append(tit, cd);
    corpo.append(hd, el("p", "muted", "Uma coleção nova toda segunda-feira. O que vocês comprarem fica pra sempre no catálogo do modo construir. Um item por semana sai com 30% de desconto."), grade);
    let sig = null;
    const upd = () => {
      const s = semanaInfo(); cd.textContent = "Troca em " + faltaTxt(s.fim - srvNow());
      const k = s.num + JSON.stringify(lojaDonos) + Math.floor(me ? me.dinheiro : 0); if (k === sig) return; sig = k;
      tit.textContent = s.tema.ic + " " + s.tema.nome; grade.textContent = "";
      for (const it of s.vitrine){
        const def = lojaDef(it), preco = lojaPreco(it, s), dono = !!lojaDonos[lojaChave(it)], b = el("button", "item"); b.type = "button";
        const pr = el("span", "pr", "$" + preco); if (it === s.promo) pr.append(el("span", "old", "$" + def.preco));
        b.append(lojaIcone(it), el("span", null, def.nome), pr);
        if (it === s.promo) b.append(el("span", "tag", "-30%"));
        else if (dono) b.append(el("span", "tag dono", "Já é de vocês"));
        else if (it === s.extra) b.append(el("span", "tag dono", "Voltou!"));
        b.setAttribute("aria-label", def.nome + ", $" + preco + (it === s.promo ? ", em promoção" : "") + (dono ? ", já é de vocês" : ""));
        b.disabled = !!me && me.dinheiro < preco;
        b.onclick = () => comprarLoja(it, preco);
        grade.append(b);
      }
    };
    upd();
    let ult = 0; painel.tick = () => { if (Date.now() - ult > 1000){ ult = Date.now(); upd(); } };
    return upd;
  });
}
// comprar = escolher onde colocar; paga quando coloca (igual ao catálogo)
function comprarLoja(it, preco){
  closePanel();
  const dc = it.startsWith("dc:");
  setMode("build"); buildTab = dc ? "parede" : "mov";
  tool = { kind: dc ? "decor" : "novo", t: dc ? it.slice(3) : it, preco, loja: 1 };
  renderBuild();
  toast("Toque " + (dc ? "numa parede marcada de verde" : "na casa") + " pra colocar. Paga na hora de colocar.");
  $("stage").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function renderLojaB(){ const s = semanaInfo(), t = s.tema.ic + " " + s.tema.nome + " · troca em " + faltaTxt(s.fim - srvNow()); if ($("lojaB").textContent !== t) $("lojaB").textContent = t; }
$("bLojaB").onclick = () => openLoja();
{ const pcBase = MENU_EXTRA.pc; MENU_EXTRA.pc = (id, m) => { const l = pcBase(id, m); l.splice(3, 0, { nome: "Loja da semana", info: semanaInfo().tema.nome, fn: openLoja }); return l; }; }

// ---------------- ouvir o banco e laço ----------------
function leva6Ouvir(){
  on(ref("casa/paredes"), "value", s => { paredes = s.val() || {}; paredesSigC = null; });
  on(ref("casa/paredes2"), "value", s => { paredes2 = s.val() || {}; paredesSigC = null; });
  on(ref("casa/decor"), "value", s => { decor = s.val() || {}; checarConquistas(); });
  on(ref("casa/loja"), "value", s => { lojaDonos = s.val() || {}; refreshPanel("loja"); if (mode === "build") renderBuild(); });
  on(ref("casa/nivel/xp"), "value", s => {
    const ant = nivelCasal(), carregado = nivelCarregado; nivelXp = Math.max(0, +s.val() || 0); nivelCarregado = true;
    const n = nivelCasal();
    if (carregado && me && n > ant) festaNivel(n, ant);
    renderNivelHud(); refreshPanel("nivel"); if (n !== ant && mode === "build") renderBuild(); checarConquistas();
  });
}
setInterval(() => { if (painel && painel.tick) painel.tick(); }, 60);
setInterval(() => { if (!me) return; garantirLeva6(); if (mode === "build") renderLojaB(); }, 2000);
CONQUISTAS.push(
  { id: "nivel5", nome: "Casal nível 5", txt: "Chegaram ao nível 5 fazendo coisas juntos.", meta: 5, val: () => nivelCasal() },
  { id: "nivel10", nome: "Casal nível 10", txt: "Nível 10: já ganharam a cama com dossel.", meta: 10, val: () => nivelCasal() },
  { id: "nivel20", nome: "Casal lendário", txt: "Nível 20, o máximo.", meta: 20, val: () => nivelCasal() },
  { id: "decor5", nome: "Paredes com história", txt: "5 decorações penduradas pela casa.", meta: 5, val: () => Object.values(decor).filter(Boolean).length },
  { id: "reflexo1", nome: "Dedo mais rápido", txt: "Primeira partida de reflexo.", st: "reflexos", meta: 1 },
  { id: "desenho5", nome: "Artistas da casa", txt: "5 partidas de desenhar e adivinhar.", st: "desenhos", meta: 5 },
  { id: "almas", nome: "Almas gêmeas", txt: "Acertaram as 5 perguntas sobre o outro.", st: "perfeitos", meta: 1 }
);
