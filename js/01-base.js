"use strict";
// Casinha · constantes, mapa da casa, pisos e catálogo de móveis
const DB_URL = "https://sintonia-a-dois-default-rtdb.firebaseio.com";
// Mapa: a casa ocupa as linhas 0..HC (HC = parede de baixo). Com quintal comprado (leva 2),
// o mapa ganha linhas de grama cercada abaixo da casa: H passa de H_CASA (13) para H_QUINTAL (18).
const W = 18, T = 16, HC = 12, H_CASA = 13, H_QUINTAL = 18;
const TOPO = 16, DY35 = -10; // v47: faixa da parede alta em cima da cena; quanto sobe o que fica pendurado na parede de cima
let H = H_CASA;
// Leva 4: segundo andar. Cada andar é uma cena do tamanho da casa; o cliente desenha só o andar do próprio jogador.
// A escada fica no mesmo lugar nos dois andares (canto direito da sala): no térreo ela sobe para o norte,
// em cima chega num vão com a saída para o norte. No MAP, os quadrados da escada valem 4 (não anda, não constrói).
let andarAtual = 0, escadaOn = false;
const ESCADA = { x: 15, y: 2, w: 2, h: 3 };
const ESC_Z = (ESCADA.y + ESCADA.h) * T - 1;     // base da escada na ordem de desenho
const PE_ESCADA = [[15, 5], [16, 5]];             // térreo: começo da subida (fica sempre livre)
const TOPO_ESCADA = [[15, 1], [16, 1]];           // em cima: patamar de onde se desce
const RESERVA_ANDAR2 = [[14, 1], [15, 1], [16, 1]]; // em cima: passagem até o patamar (sem móvel)
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch(e){} }
};
function el(tag, cls, text){ const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
// toasts comuns esperam o toast especial (conquista) sumir antes de aparecer
let toastT, especialAte = 0;
function toast(m){
  const espera = especialAte - Date.now();
  if (espera > 0){ setTimeout(() => toast(m), espera + 50); return; }
  const t = $("toast"); t.className = "toast"; t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3000);
}

// ===================== mapa =====================
const MAP = [];
const PORTAS = [[3,6],[7,3],[7,9],[12,8],[13,8]];
let portaQ = 0; // coluna da porta da cozinha para o quintal (0 = sem quintal)
// 2º andar: suíte (esq. em cima), banheiro da suíte (esq. embaixo), sala de jogos com o vão da escada (dir. em cima)
// e varanda (dir. embaixo, com guarda-corpo no lugar da parede de fora)
const PORTAS2 = [[7, 3], [3, 8], [12, 8], [13, 8]];
function montarMapa(quintal, porta){
  MAP.length = 0;
  if (andarAtual === 1){
    H = H_CASA; portaQ = 0;
    for (let y = 0; y < H; y++){ const r = []; for (let x = 0; x < W; x++) r.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 || x === 7 || y === 8 ? 1 : 0); MAP.push(r); }
    for (const [x, y] of PORTAS2) MAP[y][x] = 2;
    marcarEscada(); return;
  }
  H = quintal ? H_QUINTAL : H_CASA; portaQ = quintal ? (porta || 13) : 0;
  for (let y = 0; y < H; y++){ const r = []; for (let x = 0; x < W; x++){
    const wall = x === 0 || y === 0 || x === W - 1 || y === H - 1 || y === HC || (x === 7 && y < HC) || (y === 6 && x < 7) || (y === 8 && x > 7);
    r.push(wall ? 1 : 0);
  } MAP.push(r); }
  for (const [x, y] of PORTAS) MAP[y][x] = 2;
  if (quintal) MAP[HC][portaQ] = 2;
  if (escadaOn) marcarEscada();
}
function marcarEscada(){ for (let j = 0; j < ESCADA.h; j++) for (let i = 0; i < ESCADA.w; i++) MAP[ESCADA.y + j][ESCADA.x + i] = 4; }
const naEscada = (x, y) => (escadaOn || andarAtual === 1) && x >= ESCADA.x && x < ESCADA.x + ESCADA.w && y >= ESCADA.y && y < ESCADA.y + ESCADA.h;
montarMapa(false);
function comodo(x, y){
  if (andarAtual === 1){ if (x < 7) return y < 8 ? "suite" : "lavabo"; return y < 8 ? "jogos" : "varanda"; }
  if (y > HC) return "quintal"; if (x < 7) return y < 6 ? "quarto" : "banheiro"; if (x === 7) return y < 6 ? "sala" : "cozinha"; return y < 8 ? "sala" : "cozinha";
}
const COMODOS = { quarto: "Quarto", banheiro: "Banheiro", sala: "Sala", cozinha: "Cozinha", quintal: "Quintal", suite: "Suíte", lavabo: "Banheiro da suíte", jogos: "Sala de jogos", varanda: "Varanda" };
const COMODOS2 = new Set(["suite", "lavabo", "jogos", "varanda"]);

const PISOS = [
  { nome: "Madeira", a: "#9B7653", b: "#8A6847", tipo: "tabua" },
  { nome: "Madeira clara", a: "#D2B48C", b: "#BFA079", tipo: "tabua" },
  { nome: "Azulejo", a: "#E8ECF0", b: "#D3DAE1", tipo: "xadrez" },
  { nome: "Azulejo azul", a: "#9FC3E0", b: "#86AED0", tipo: "xadrez" },
  { nome: "Carpete rosa", a: "#E7A3B8", b: "#D98FA6", tipo: "carpete" },
  { nome: "Carpete verde", a: "#8DBB8A", b: "#78A675", tipo: "carpete" },
  { nome: "Xadrez", a: "#F1EFE8", b: "#3A3A3A", tipo: "xadrez" },
  { nome: "Madeira escura", a: "#5E4430", b: "#4E3826", tipo: "tabua" },
  { nome: "Deck", a: "#C08A5A", b: "#7A5234", tipo: "deck" } // leva 4 (varanda)
];
const PISO_PADRAO = { quarto: 0, banheiro: 3, sala: 1, cozinha: 6 };
const PISO_PADRAO2 = { suite: 4, lavabo: 2, jogos: 7, varanda: 8 }; // casa/pisos2

// ===================== catálogo =====================
const NEEDS = [
  { id: "fome", nome: "Fome", cor: "#EF9F27", queda: 0.040 },
  { id: "energia", nome: "Energia", cor: "#378ADD", queda: 0.030 },
  { id: "diversao", nome: "Diversão", cor: "#D4537E", queda: 0.045 },
  { id: "social", nome: "Social", cor: "#5DCAA5", queda: 0.035 },
  { id: "higiene", nome: "Higiene", cor: "#85B7EB", queda: 0.025 }
];
const DORMIR = [{ id: "dormir", nome: "Dormir", dur: 20, ganho: { energia: 75 }, sobre: 1, deitar: 1 }, { id: "cochilo", nome: "Tirar um cochilo", dur: 8, ganho: { energia: 25 }, sobre: 1, deitar: 1 }];
const CAT = {
  casal:     { nome: "Cama de casal", w: 2, h: 2, preco: 450, acoes: DORMIR },
  solteiro:  { nome: "Cama de solteiro", w: 1, h: 2, preco: 300, acoes: DORMIR },
  sofa:      { nome: "Sofá", w: 2, h: 1, preco: 250, acoes: [{ id: "relaxar", nome: "Relaxar", dur: 8, ganho: { energia: 10, diversao: 12 }, sobre: 1 }] },
  tv:        { nome: "TV", w: 2, h: 1, preco: 200, acoes: [{ id: "tv", nome: "Assistir TV", dur: 12, ganho: { diversao: 35 } }] },
  game:      { nome: "Videogame", w: 1, h: 1, preco: 150, acoes: [{ id: "jogar", nome: "Jogar videogame", dur: 12, ganho: { diversao: 45, energia: -5 } }] },
  geladeira: { nome: "Geladeira", w: 1, h: 1, preco: 250, acoes: [{ id: "lanche", nome: "Pegar um lanche", dur: 6, ganho: { fome: 30 } }] },
  fogao:     { nome: "Fogão", w: 1, h: 1, preco: 200, acoes: [] }, // receitas: ver COZINHA (menu extra)
  pia:       { nome: "Pia", w: 1, h: 1, preco: 100, acoes: [{ id: "maos", nome: "Lavar as mãos", dur: 4, ganho: { higiene: 12 } }] },
  mesa:      { nome: "Mesa", w: 2, h: 2, preco: 120, acoes: [{ id: "cafe", nome: "Tomar um café", dur: 6, ganho: { fome: 10, energia: 12 }, junto: 1 }] },
  chuveiro:  { nome: "Chuveiro", w: 1, h: 1, preco: 200, acoes: [{ id: "banho", nome: "Tomar banho", dur: 10, ganho: { higiene: 80 }, sobre: 1 }] },
  vaso:      { nome: "Vaso sanitário", w: 1, h: 1, preco: 100, acoes: [{ id: "banheiro", nome: "Usar o banheiro", dur: 5, ganho: { higiene: 20 }, sobre: 1 }] },
  pc:        { nome: "Computador", w: 2, h: 1, preco: 300, acoes: [] }, // trabalhar, vídeos, tarefas e jogos: MENU_EXTRA.pc (leva 2)
  estante:   { nome: "Estante", w: 2, h: 1, preco: 150, acoes: [{ id: "ler", nome: "Ler um livro", dur: 10, ganho: { diversao: 25 } }] },
  som:       { nome: "Som", w: 1, h: 1, preco: 180, acoes: [{ id: "dancar", nome: "Dançar", dur: 10, ganho: { diversao: 30, energia: -5 }, junto: 1 }] },
  planta:    { nome: "Planta", w: 1, h: 1, preco: 40, livre: 1, acoes: [{ id: "regar", nome: "Regar", dur: 3, ganho: { diversao: 5 } }] },
  armario:   { nome: "Guarda-roupa", w: 2, h: 1, preco: 200, acoes: [] }, // espelho: MENU_EXTRA.armario (leva 3)
  abajur:    { nome: "Abajur", w: 1, h: 1, preco: 60, acoes: [] },
  tapete:    { nome: "Tapete", w: 3, h: 2, preco: 80, acoes: [], chao: 1 },
  canteiro:  { nome: "Canteiro", w: 1, h: 1, preco: 60, livre: 1, acoes: [] },  // horta: ver JARDIM (menu extra)
  pote:      { nome: "Pote do bichinho", w: 1, h: 1, preco: 30, livre: 1, acoes: [] }, // ver PET (menu extra)
  // leva 2: área externa. fora = só no quintal; livre = pode dentro e fora; o resto só dentro de casa
  churrasqueira: { nome: "Churrasqueira", w: 2, h: 1, preco: 350, fora: 1, acoes: [{ id: "churrasco", nome: "Fazer churrasco ($15)", dur: 12, ganho: { fome: 50, diversao: 15 }, junto: 1, juntoMult: 1.4, juntoSocial: 3, antes: () => gastar(15, "a carne"), cancel: () => ganhar(15) }] },
  rede:       { nome: "Rede", w: 3, h: 1, preco: 220, fora: 1, acoes: [{ id: "rede", nome: "Deitar na rede", dur: 12, ganho: { energia: 30, diversao: 10 }, sobre: 1, deitar: 1 }] },
  piscina:    { nome: "Piscininha", w: 2, h: 2, preco: 300, fora: 1, acoes: [{ id: "piscina", nome: "Brincar na piscina", dur: 10, ganho: { diversao: 35, higiene: 15 }, sobre: 1, junto: 1, juntoSocial: 2 }] },
  balanco:    { nome: "Balanço", w: 2, h: 1, preco: 260, fora: 1, acoes: [{ id: "balancar", nome: "Balançar", dur: 8, ganho: { diversao: 25 }, sobre: 1, junto: 1, juntoSocial: 2 }] },
  piquenique: { nome: "Mesa de piquenique", w: 3, h: 2, preco: 280, fora: 1, acoes: [{ id: "piquenique", nome: "Fazer um piquenique", dur: 10, ganho: { fome: 25, diversao: 10 }, sobre: 1, junto: 1, juntoMult: 1.6, juntoSocial: 3 }] },
  // leva 4: mais lugares pra sentar
  poltrona:   { nome: "Poltrona", w: 1, h: 1, preco: 160, acoes: [{ id: "poltrona", nome: "Sentar e relaxar", dur: 8, ganho: { energia: 10, diversao: 10 }, sobre: 1 }] },
  banheira:   { nome: "Banheira", w: 2, h: 1, preco: 380, acoes: [{ id: "banheira", nome: "Banho de banheira", dur: 12, ganho: { higiene: 85, energia: 10 }, sobre: 1 }] }
};
// Onde o boneco senta (leva 4). vagas: uma por pessoa, na ordem de quem está no móvel.
//   dx = deslocamento a partir do meio do móvel; by = base do boneco (px a partir do topo do quadrado do móvel); dir = para onde olha.
//   fixas: usa a vaga mesmo sozinho (cadeira da mesa, assento do balanço); sempre: toda ação do móvel é sentada (mesa, computador).
//   cima: posição de quem senta de costas olhando a TV.  frente: retângulos [x, y, w, h] do móvel redesenhados por cima de quem senta.
//   mesa: mãos em cima do tampo (y do tampo).  cadeira: puxa uma cadeira de escritório.  empe: fica em pé em cima (chuveiro, piscina).
const SENTAR = {
  sofa:       { vagas: [{ dx: -7, by: 15 }, { dx: 7, by: 15 }], cima: 12 }, // leva 23: sofá de 2 lugares (arte Cozy)
  poltrona:   { vagas: [{ dx: 0, by: 15, frente: [[-1, 3, 5, 14], [12, 3, 5, 14]] }] },
  vaso:       { vagas: [{ dx: 0, by: 16 }] },
  banheira:   { vagas: [{ dx: 3, by: 13, frente: [[-1, 6, 34, 11]], banho: 1 }] },
  mesa:       { sempre: 1, fixas: 1, vagas: [{ dx: 0, by: 8, frente: [[-1, 7, 34, 22]], mesa: 8, z: -.7 }, { dx: 0, by: 32, dir: "up" }] }, // v27: mesa da Cozy
  pc:         { sempre: 1, fixas: 1, vagas: [{ dx: 0, by: 21, dir: "up", cadeira: 1 }] },
  piquenique: { fixas: 1, vagas: [{ dx: -8, by: 7, frente: [[-1, 3, 50, 21]], mesa: 4, z: -.7 }, { dx: 8, by: 30, dir: "up" }] },
  balanco:    { fixas: 1, vagas: [{ dx: -6, by: 7, cordas: [7, 12] }, { dx: 7, by: 7, cordas: [20, 25] }] },
  piscina:    { empe: 1, vagas: [{ dx: -6, by: 22 }, { dx: 6, by: 22 }] }
};
// móveis que já vêm no 2º andar (andar: 1)
const MOVEIS_ANDAR2 = [
  ["casal",2,1],["abajur",1,1],["abajur",5,1],["planta",6,1],["tapete",2,5],["poltrona",1,6],["armario",5,6],
  ["pia",1,9],["vaso",1,11],["banheira",4,9],["planta",6,11],
  ["estante",8,1],["tv",10,1],["game",12,1],["tapete",10,2],["sofa",10,4],["pc",15,6],["planta",8,7],["poltrona",13,4],
  ["rede",9,10],["planta",8,9],["planta",16,9],["canteiro",15,11],["canteiro",16,11]
];
// Menus extras por tipo de móvel: (id do móvel, móvel) => [{ nome, info, fn }]. Somam com CAT[t].acoes.
// Para um móvel novo com menu próprio, basta registrar aqui.
const MENU_EXTRA = {};
const SOCIAL = [
  { id: "conversar", nome: "Conversar", dur: 6, eu: { social: 30 }, outro: { social: 25 }, txt: "conversou com você" },
  { id: "abracar", nome: "Abraçar", dur: 3, eu: { social: 25 }, outro: { social: 25 }, txt: "te deu um abraço" },
  { id: "dancar", nome: "Dançar juntos", dur: 8, eu: { social: 25, diversao: 20 }, outro: { social: 25, diversao: 20 }, txt: "dançou com você" },
  { id: "cocegas", nome: "Fazer cócegas", dur: 3, eu: { diversao: 15, social: 10 }, outro: { diversao: 15, social: 10 }, txt: "te fez cócegas" },
  { id: "beijo", nome: "Dar um beijinho", dur: 3, eu: { social: 30 }, outro: { social: 30 }, txt: "te deu um beijinho" }
];
const MOVEIS_INICIAIS = [
  ["casal",1,1],["abajur",4,1],["armario",5,1],["tapete",1,4],["planta",6,5],
  ["chuveiro",1,7],["pia",5,7],["vaso",1,11],["planta",6,11],
  ["tv",10,1],["game",12,1],["som",8,1],["estante",15,1],["tapete",10,3],["sofa",10,5],["pc",15,6],["planta",8,7],
  ["geladeira",16,9],["fogao",15,9],["pia",14,9],["mesa",10,10],
  ["canteiro",13,1],["canteiro",14,1],["pote",16,11]
];
// itens que entraram depois (leva 1): casas antigas recebem uma vez, onde couber
const EXTRAS_LEVA1 = [["canteiro",13,1],["canteiro",14,1],["pote",16,11]];

const ROUPAS = ["#3E8C80", "#C2584E", "#5E5A9E", "#D99A45", "#C46A86", "#4F84B8", "#5A7A3A", "#3A3638"]; // v30: tons mais suaves, no estilo da Cozy
const CABELOS = ["#2B1D14", "#6B3A2A", "#A8653A", "#D9B97E", "#8E8E8E", "#262326", "#A04A62", "#5E5A9E", "#C0683A", "#E6D6B4", "#D592AE", "#4F84B8", "#4E8A6A"];
const PELES = ["#F6D2B0", "#E8B48C", "#C98E62", "#9C6644", "#6B4430"];
const ESTILOS = ["Curto", "Comprido", "Coque", "Cacheado", "Raspado", "Franja", "Rabo de cavalo", "Maria-chiquinha", "Black power", "Topete"];
// v52: cada corpo só vê os cortes dele (criador, salão e filhos); "neutro" vê todos
const ESTILOS_CORPO = { ele: [0, 9, 4, 5, 3, 8], ela: [0, 1, 6, 7, 2, 3, 5, 8] };
const estilosDe = corpo => ESTILOS_CORPO[corpo] || ESTILOS.map((_, i) => i);
const estiloPara = (corpo, e) => estilosDe(corpo).includes(e) ? e : estilosDe(corpo)[0];
// leva 3: corpo (neutro = como era antes), tipo de roupa e acessório. preco = paga uma vez no guarda-roupa (jogadores/<pid>/guarda)
const CORPOS = [["ele", "Ele"], ["ela", "Ela"], ["neutro", "Neutro"]];
const TRAJES = [{ nome: "Camiseta" }, { nome: "Vestido" }, { nome: "Saia e blusa" }, { nome: "Macacão", preco: 40 }, { nome: "Moletom", preco: 60 }, { nome: "Regata" }];
const ACESS = [{ nome: "Nenhum" }, { nome: "Óculos" }, { nome: "Laço" }, { nome: "Boné", preco: 30 }, { nome: "Flor" }];
