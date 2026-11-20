"use strict";
// Casinha · leva 15: o bairro (rua com câmera, vizinhos com rotina, praça, café, academia e mercado), festa em casa e férias
// Carregado ANTES do 18-laco.js. Ganchos: embrulha drawViagem, leva10Click, leva10Update, leva10Esconde, addLeva10Objs, drawLabels10,
//   bannerLeva10, ITENS16.diversao, MENU_EXTRA.pc, musicaAtiva, visitaAgora/visitaDoBloco/visitaMenu/visitaPendente/avisoVisita,
//   addFestaObjs, addPetObj, drawPrato, openPanel("cozinha"), agirSozinho, acaoTerminada, chegarEmCasa, setMode, filhoNeeds, bebeNeeds,
//   petNivel, nomeDe, pessoasRel, rostoCanvas, leva11Ouvir/leva11Reset e (depois que o 18 carrega) precisaFluido.
//   Empurra FAIXAS, EFEITOS, HAB, DESEJOS, CONQUISTAS, VISITAS, CAT/FURN_EXTRA (lembrancinhas), RECEITAS (comida de festa).
// =====================================================================
// LEVA 15 — dados novos:
//   jogadores/<pid>/cena = "rua" | "praca" | "cafe" | "academia" | "mercado"  (ausente = em casa). Cada aparelho desenha só a própria cena.
//   jogadores/<pid>/fora = { x, y, dir }   destino (px da cena) do boneco na rua/lugar; os outros aparelhos andam até lá na mesma velocidade
//   casa/rel/<npc-…_pid>   amizade com os vizinhos (VIZ). Romance com NPC não existe (romPermitido já barra: NPC não é morador).
//   casa/bairro/visita = { npc, ini, fim, por }   vizinho chamado pra visitar (entra no sistema de visitas da leva 5)
//   casa/festa = { por, ini, dur, conv: { npc-…: true }, amigos: { código: true }, comida: { k: qtd }, pts: { pid: { danca, papo, comeu } },
//                  contado, nota: { anim, div, com, est } }   uma festa por vez; some 3 min depois do fim
//   salas/<casa amiga>/casa/festaConvite/<esta sala> = { de, ini, fim }   convite de festa (vira um aviso lá, com "Ir" = visita)
//   casa/ferias = { por, estado: convite|viajando|fim|cancelado, criado, destino, dias, ini, volta, vai: {pid}, conv: {pid: true|false},
//                   area: {pid: "quarto"|"fora"}, ativ: {pid: {id, at}}, feitos: {"<dia>_<pid>_<aid>": 1}, evento: {"<dia>_<pid>": 1},
//                   lembr: {item: pid}, chegou: {pid: ts}, fimAt, contado }
//   casa/loja/<lembrancinha> = true (decoração exclusiva no catálogo) · casa/stats/festas, festa5, ferias, cafesDois
//   casa/historia/festa_<ini>, ferias_<ini>
// Tempo do bairro: relógio de Brasília (agoraBR) + B15.desloc. Rotinas, carros e cachorros são funções puras do tempo (iguais em todo aparelho).
// Teste: bairroHora(h, diaDaSemana) / bairroHora(null) · festaAvancar(min) · feriasAvancar(dias) · B15 (estado e medidas)
// =====================================================================
const B15 = { desloc: 0, vEu: 62, vNpc: 24, festaDur: 15 * MIN, festaMax: 8, feriasConvite: 10 * MIN, dia: 24 * HORA, ms: 0, quadros: 0,
  get festa(){ return festa15; }, get ferias(){ return ferias15; }, get eu(){ return EU15; } };
const RUA_W = 1200, CH15 = 208, CAL_Y0 = 128, CAL_Y1 = 150, PORTA_Y = 129;
const tB = t => (t || srvNow()) + B15.desloc;
const brAgora = t => agoraBR(tB(t));
const DIAS_NOME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function bairroHora(h, dw){
  if (h == null){ B15.desloc = 0; ruaBgKey = ""; return brAgora(); }
  B15.desloc = 0; const a = brAgora();
  B15.desloc = (((dw == null ? a.dw : dw) - a.dw + 7) % 7) * 24 * HORA + (h - a.h) * HORA;
  ruaBgKey = ""; return brAgora();
}
const horaRua = () => B15.desloc ? brAgora().h : hourNow();
const hhmm = h => String(Math.floor(h) % 24).padStart(2, "0") + ":" + String(Math.floor((h % 1) * 60)).padStart(2, "0");
const oyCena = () => lo.height - CH15;

// =====================================================================
// 1. A RUA: lotes (casas, lugares) e vizinhos
// =====================================================================
const LOTES = [
  { id: "praca", x0: 24, w: 128, porta: 88, lugar: "praca" },
  { id: "jorge", x0: 156, w: 66, porta: 189, casa: { parede: "#F6E3A0", teto: "#D9704A" } },
  { id: "cida", x0: 226, w: 66, porta: 259, casa: { parede: "#FBD3DC", teto: "#B5609E" } },
  { id: "nos", x0: 296, w: 108, porta: 350, nossa: 1 },
  { id: "cafe", x0: 408, w: 100, porta: 470, lugar: "cafe" },
  { id: "azul", x0: 512, w: 70, porta: 547, casa: { parede: "#BFD9F2", teto: "#4F6FB0" } },
  { id: "livia", x0: 586, w: 66, porta: 619, casa: { parede: "#CDEBC9", teto: "#3F8F56" } },
  { id: "academia", x0: 656, w: 104, porta: 708, lugar: "academia" },
  { id: "hideo", x0: 764, w: 66, porta: 797, casa: { parede: "#E3D6F7", teto: "#6A4FB0" } },
  { id: "laranja", x0: 834, w: 70, porta: 869, casa: { parede: "#FAD9B8", teto: "#D9733A", sobrado: 1 } },
  { id: "osvaldo", x0: 908, w: 62, porta: 939, casa: { parede: "#F4F1EA", teto: "#7A8BA0" } },
  { id: "mercado", x0: 974, w: 112, porta: 1030, lugar: "mercado" },
  { id: "amigos", x0: 1090, w: 26, porta: 1102, placa: 1 },
  { id: "salao", x0: 1120, w: 76, porta: 1158, salao: 1 } // js/31-salao-corpo.js
];
const LOTE = Object.fromEntries(LOTES.map(l => [l.id, l]));
const POSTES = [70, 214, 360, 500, 640, 780, 920, 1060];
const ARVORES = [154, 223, 294, 406, 510, 585, 654, 762, 833, 906, 972];
const WD = dw => dw >= 1 && dw <= 5;
// vizinhos: nome, idade, jeito (2 traços), profissão, casa e rotina pelo relógio de Brasília. teen = adolescente (desenho de adolescente)
const VIZ = {
  "npc-jorge": { nome: "Seu Jorge", anos: 68, fase: "idoso", prof: "Carteiro aposentado", tracos: ["aventureiro", "sociavel"], casa: "jorge", gosta: "livro",
    av: { corpo: "ele", roupa: 5, traje: 5, cabelo: 4, estilo: 0, pele: 2, barba: 1, acess: 1, fisico: "magro" },
    falas: ["Corri 5 km hoje! Com essa idade, hein? 🏃", "Na minha época eu entregava carta nessa rua toda.", "Já viram o chafariz novo da praça?", "Bom dia é de graça e faz bem! ☀️"],
    rot: dw => dw ? [[6, 7, "rua", { correr: [40, 1080] }], [7.2, 8.5, "cafe", "mesa3a"], [9, 11, "praca", "banco1a"], [15, 16.5, "cafe", "mesa3a"], [18, 19, "rua", { frente: 1 }]]
      : [[7, 8, "rua", { correr: [40, 1080] }], [9, 12, "praca", "banco1a"], [16, 17, "cafe", "mesa3a"]] },
  "npc-cida": { nome: "Dona Cida", anos: 72, fase: "idoso", prof: "Costureira aposentada", tracos: ["cozinheiro", "sociavel"], casa: "cida", gosta: "flores",
    av: { corpo: "ela", roupa: 4, traje: 1, cabelo: 4, estilo: 2, pele: 1, acess: 1, fisico: "cheinho", altura: "baixinho" },
    falas: ["Fiz um bolo de fubá, depois passo aí! 🍰", "Meu neto Téo não larga esse celular…", "As rosas do meu jardim estão lindas.", "Vocês dois formam um casal tão bonito 💕"],
    rot: dw => dw ? [[8, 9, "rua", { regar: 1 }], [10, 11.5, "praca", "banco2a"], [16, 17, "mercado", "compras"], [19, 20, "rua", { frente: 1 }]]
      : [[8, 9, "rua", { regar: 1 }], [10, 12, "praca", "banco2a"], [15, 16, "cafe", "mesa1a"]] },
  "npc-teo": { nome: "Téo", anos: 15, fase: "adolescente", teen: 1, prof: "Estudante (9º ano)", tracos: ["brincalhao", "preguicoso"], casa: "cida", gosta: "chocolate",
    L: { pele: 1, cabelo: 0, estilo: 5, corpo: "ele", roupa: 6 },
    falas: ["Já passou de fase naquele jogo? 🎮", "Minha vó acha que eu jogo demais…", "Prova de matemática amanhã 😩", "Esse balanço é o melhor da cidade."],
    rot: dw => WD(dw) ? [[6.8, 12.8, "fora", "L"], [15, 17, "praca", "balanco1"], [19, 20, dw === 2 || dw === 4 ? "academia" : "casa", "esteira1"], [20.2, 21, "rua", { frente: 1 }]]
      : dw === 6 ? [[10, 12, "praca", "balanco1"], [16, 17, "cafe", "mesa2b"]] : [[14, 16, "praca", "balanco1"]] },
  "npc-neusa": { nome: "Dona Neusa", anos: 61, fase: "idoso", prof: "Dona do Café Grão Doce", tracos: ["cozinheiro", "organizado"], casa: "cafe", gosta: "flores",
    av: { corpo: "ela", roupa: 3, traje: 0, cabelo: 9, estilo: 2, pele: 3, fisico: "cheinho" }, unif: "chef",
    falas: ["O pão de queijo acabou de sair! 🧀", "Cafezinho passado na hora ☕", "Acordo às 5 todo dia, meu bem.", "Volta amanhã que tem bolo de cenoura."],
    rot: dw => dw ? [[6, 20, "cafe", "balcao"]] : [[7, 13, "cafe", "balcao"], [14, 15, "mercado", "compras"]] },
  "npc-marcos": { nome: "Marcos", anos: 35, fase: "adulto", prof: "Professor de música", tracos: ["artista", "romantico"], casa: "azul", gosta: "livro",
    av: { corpo: "ele", roupa: 7, traje: 0, cabelo: 5, estilo: 9, pele: 4, barba: 1, acess: 1, altura: "alto" },
    falas: ["Tô ensaiando uma música nova 🎸", "A Paula e eu adoramos esse café.", "Música boa faz a casa ficar mais leve.", "Vocês tocam algum instrumento?"],
    rot: dw => WD(dw) ? [[7.5, 17, "fora", "R"], [18, 19, dw === 1 || dw === 3 ? "mercado" : "casa", "compras"], [19.5, 20.4, dw === 2 || dw === 4 ? "rua" : "casa", { passear: [480, 720] }], [20.5, 21.5, dw % 2 ? "academia" : "casa", "pesos"]]
      : dw === 6 ? [[9, 11, "cafe", "mesa1a"]] : [[16, 18, "praca", "banco2b"]] },
  "npc-paula": { nome: "Paula", anos: 34, fase: "adulto", prof: "Arquiteta", tracos: ["organizado", "aventureiro"], casa: "azul", gosta: "flores",
    av: { corpo: "ela", roupa: 1, traje: 2, cabelo: 0, estilo: 8, pele: 4 },
    falas: ["Desenhei uma casinha igual a de vocês 📐", "Sábado é dia de café com o Marcos ☕", "Essa rua tem as fachadas mais lindas.", "Bora correr amanhã cedo?"],
    rot: dw => WD(dw) ? [[8, 17.5, "fora", "R"], [18, 19, dw === 2 || dw === 4 ? "academia" : "casa", "esteira2"], [19.5, 20.4, dw === 2 || dw === 4 ? "rua" : "casa", { passear: [500, 740] }]]
      : dw === 6 ? [[9, 11, "cafe", "mesa1b"]] : [[16, 18, "praca", "banco2a"]] },
  "npc-livia": { nome: "Lívia", anos: 29, fase: "adulto", prof: "Veterinária", tracos: ["bichos", "timido"], casa: "livia", gosta: "biscoito", cao: 1,
    av: { corpo: "ela", roupa: 0, traje: 3, cabelo: 8, estilo: 6, pele: 0, fisico: "magro" },
    falas: ["O Biscoito adora passear! 🐶", "Vacinaram o bichinho de vocês?", "Hoje atendi um filhote de gato lindo 🐱", "…oi. Tudo bem? 😊"],
    rot: dw => WD(dw) ? [[7, 7.6, "rua", { passear: [560, 900], cao: 1 }], [7.6, 7.95, "cafe", "fila"], [8, 18, "fora", "R"], [19, 19.6, "rua", { passear: [330, 900], cao: 1 }], [20, 21, dw % 2 ? "academia" : "casa", "yoga"]]
      : [[7, 7.6, "rua", { passear: [560, 900], cao: 1 }], [10, 12, dw === 6 ? "praca" : "casa", "cachorro"], [19, 19.6, "rua", { passear: [330, 900], cao: 1 }]] },
  "npc-rafa": { nome: "Rafa", anos: 26, fase: "adulto", prof: "Personal trainer", tracos: ["aventureiro", "comilao"], casa: "laranja", gosta: "chocolate",
    av: { corpo: "ele", roupa: 2, traje: 5, cabelo: 5, estilo: 4, pele: 3, forma: "atletico", altura: "alto" },
    falas: ["Bora treinar? 💪", "Água, gente! Hidratação!", "Hoje é dia de perna 🦵", "Depois do treino, um açaí… 🍧"],
    rot: dw => dw ? [[5.5, 6, "rua", { correr: [600, 1080] }], [6, 12, "academia", "instrutor"], [13, 14, "cafe", "mesa2a"], [17, 22, "academia", "instrutor"]]
      : [[8, 10, "praca", "alongar"]] },
  "npc-bia": { nome: "Bia", anos: 31, fase: "adulto", prof: "Designer freelancer", tracos: ["artista", "nerd"], casa: "laranja", gosta: "livro",
    av: { corpo: "ela", roupa: 4, traje: 4, cabelo: 10, estilo: 1, pele: 2, acess: 1 },
    falas: ["Trabalho melhor com cheirinho de café ☕", "Tô desenhando a praça 🎨", "Vocês viram o pôr do sol ontem?", "Prazo pra sexta… socorro 😅"],
    rot: dw => WD(dw) ? [[10, 12, "cafe", "mesa2a"], [17, 18, "praca", "banco1b"], [19, 20, dw === 5 ? "mercado" : "casa", "compras"]]
      : dw === 6 ? [[11, 13, "praca", "banco1b"], [18, 19, "cafe", "mesa3b"]] : [] },
  "npc-osvaldo": { nome: "Seu Osvaldo", anos: 75, fase: "idoso", prof: "Pescador aposentado e pipoqueiro", tracos: ["caseiro", "comilao"], casa: "osvaldo", gosta: "chocolate",
    av: { corpo: "ele", roupa: 6, traje: 0, cabelo: 9, estilo: 0, pele: 3, barba: 1, acess: 3, fisico: "cheinho", altura: "baixinho" },
    falas: ["Pipoca doce ou salgada? 🍿", "Peguei um peixe desse tamanho uma vez!", "Hmpf. Essa juventude…", "No meu tempo a praça era só terra."],
    rot: dw => dw === 1 ? [[8, 10, "mercado", "compras"], [15, 17, "rua", { frente: 1 }]] : [[7, 9, "praca", "banco2b"], [14, 19, "praca", "pipoca"]] },
  "npc-hideo": { nome: "Sr. Hideo", anos: 52, fase: "adulto", prof: "Dono do Mercado Bom Preço", tracos: ["organizado", "jardineiro"], casa: "hideo", gosta: "flores",
    av: { corpo: "ele", roupa: 0, traje: 0, cabelo: 5, estilo: 0, pele: 0, acess: 1 },
    falas: ["Chegou morango fresquinho! 🍓", "Hoje tem promoção de farinha.", "O Caio estuda e ainda me ajuda aqui.", "Minha horta dá os melhores tomates 🍅"],
    rot: dw => dw ? [[6.3, 6.9, "cafe", "mesa1a"], [7, 14, "mercado", "caixa"], [14.5, 15.5, "cafe", "mesa3b"], [16, 22, "mercado", "repor"]] : [[8, 13, "mercado", "caixa"]] },
  "npc-caio": { nome: "Caio", anos: 17, fase: "adolescente", teen: 1, prof: "Estudante e caixa do mercado", tracos: ["timido", "nerd"], casa: "hideo", gosta: "livro",
    L: { pele: 0, cabelo: 5, estilo: 3, corpo: "ele", roupa: 3 },
    falas: ["Vai querer sacola? 🛍️", "Tô estudando pro vestibular.", "…valeu. 😊", "Meu pai organiza as prateleiras por cor."],
    rot: dw => WD(dw) ? [[6.8, 12.5, "fora", "L"], [14, 22, "mercado", "caixa"]] : dw === 6 ? [[14, 22, "mercado", "caixa"]] : [[15, 17, "praca", "balanco2"]] }
};
const VIZ_IDS = Object.keys(VIZ);
for (const v of Object.values(VIZ)) if (v.unif && UNIF[v.unif]) v.av.traje = UNIF[v.unif].tj;
const ehViz = id => !!VIZ[id];
// trechos do dia (ordenados, buracos viram "casa")
const segCache = new Map();
function npcSegs(id, dw){
  const k = id + dw; let l = segCache.get(k); if (l) return l;
  const src = VIZ[id].rot(dw).map(([h0, h1, onde, a]) => ({ h0, h1, onde, a })).sort((a, b) => a.h0 - b.h0);
  l = []; let h = 0;
  for (const s of src){ if (s.h0 > h) l.push({ h0: h, h1: s.h0, onde: "casa" }); l.push(s); h = s.h1; }
  if (h < 24) l.push({ h0: h, h1: 24, onde: "casa" });
  segCache.set(k, l); return l;
}
const laneY = id => CAL_Y0 + 2 + hashStr(id) % 17;
function ruaModoX(id, s, h){
  const a = s.a || {}, el = Math.max(0, (h - s.h0) * 3600), casa = LOTE[VIZ[id].casa];
  if (a.correr || a.passear){ const [x0, x1] = a.correr || a.passear, v = a.correr ? 46 : 16, L = x1 - x0, d = (el * v) % (2 * L); return { x: d < L ? x0 + d : x1 - (d - L), dir: d < L ? "right" : "left", anda: 1 }; }
  if (a.regar) return { x: casa.x0 + 10, dir: "right", anda: 0, regar: 1 };
  return { x: casa.porta + 14, dir: "down", anda: 0 };
}
function pontaX(id, s, fim){
  if (s.onde === "casa") return LOTE[VIZ[id].casa].porta;
  if (s.onde === "fora") return s.a === "L" ? -26 : RUA_W + 26;
  if (s.onde === "rua") return ruaModoX(id, s, fim ? s.h1 : s.h0).x;
  return LOTE[s.onde] ? LOTE[s.onde].porta : 0;
}
// onde o vizinho está no instante t: { cena: "rua" | lugar | null (em casa/fora), x, y, dir, anda, pose, s }
function npcEstado(id, t){
  const a = brAgora(t), h = a.h, segs = npcSegs(id, a.dw);
  let i = segs.findIndex(s => h >= s.h0 && h < s.h1); if (i < 0) i = segs.length - 1;
  const s = segs[i], p = i > 0 ? segs[i - 1] : { onde: "casa", h0: 0, h1: 0 };
  const el = (h - s.h0) * 3600, xa = pontaX(id, p, true), xb = pontaX(id, s, false), y = laneY(id);
  const parado = p.onde === s.onde && (s.onde === "casa" || s.onde === "fora");
  const wd = parado ? 0 : Math.abs(xb - xa) / B15.vNpc;
  if (el < wd) return { cena: "rua", x: xa + (xb - xa) * el / wd, y, dir: xb > xa ? "right" : "left", anda: 1, s, indo: s.onde };
  if (s.onde === "casa" || s.onde === "fora") return { cena: null, casa: s.onde === "casa" ? VIZ[id].casa : null, s };
  if (s.onde === "rua"){ const m = ruaModoX(id, s, h); return { cena: "rua", x: m.x, y, dir: m.dir, anda: m.anda, regar: m.regar, cao: s.a.cao, correr: !!s.a.correr, s }; }
  const L = LUGARES[s.onde]; if (!L) return { cena: null, s };
  const e2 = el - wd, rest = (s.h1 - h) * 3600, sp = vagaLugar(L, s.a, id, e2), pt = L.porta;
  if (e2 < 5) { const k = e2 / 5; return { cena: s.onde, x: pt[0] + (sp.x - pt[0]) * k, y: pt[1] + (sp.y - pt[1]) * k, dir: "up", anda: 1, s }; }
  if (rest < 5) { const k = 1 - rest / 5; return { cena: s.onde, x: sp.x + (pt[0] - sp.x) * k, y: sp.y + (pt[1] - sp.y) * k, dir: "down", anda: 1, s }; }
  return Object.assign({ cena: s.onde, s }, sp);
}
function vagaLugar(L, nome, id, el){
  const v = L.vagas[nome] || L.vagas[Object.keys(L.vagas)[0]];
  return typeof v === "function" ? v(el, hashStr(id)) : v;
}
// lugares abertos (o vizinho que trabalha lá está no balcão/caixa)
const HORARIO = { cafe: dw => dw ? [6, 20] : [7, 13], academia: dw => dw ? [6, 23] : [8, 12], mercado: dw => dw ? [7, 22] : [8, 13], praca: () => [0, 24] };
function aberto(l, t){ const a = brAgora(t), [i, f] = HORARIO[l](a.dw); return a.h >= i && a.h < f; }
function horarioTxt15(l){ const a = brAgora(), [i, f] = HORARIO[l](a.dw); return l === "praca" ? "Aberta 24h" : aberto(l) ? "Aberto até " + f + "h" : "Fechado · abre " + (a.h < i ? "às " + i + "h" : "amanhã às " + HORARIO[l]((a.dw + 1) % 7)[0] + "h"); }

// =====================================================================
// 2. LUGARES (cenas pequenas: 288 x 208)
// =====================================================================
const vai = (x0, x1, v, el, ph) => { const L = x1 - x0, d = (el * v + ph) % (2 * L); return d < L ? [x0 + d, 1] : [x1 - (d - L), -1]; };
const LUGARES = {
  praca: { nome: "Praça das Flores", ic: "🌳", fora: 1, porta: [144, 202], chao: [[10, 108, 278, 202]], faixa: "praca15",
    vagas: {
      banco1a: { x: 56, y: 119, dir: "down", pose: "sit" }, banco1b: { x: 72, y: 119, dir: "down", pose: "sit" },
      banco2a: { x: 216, y: 119, dir: "down", pose: "sit" }, banco2b: { x: 232, y: 119, dir: "down", pose: "sit" },
      balanco1: { x: 50, y: 176, dir: "down", pose: "sit", balanco: 1 }, balanco2: { x: 70, y: 176, dir: "down", pose: "sit", balanco: 1 },
      pipoca: { x: 246, y: 168, dir: "left", pose: "stand" }, alongar: { x: 150, y: 176, dir: "down", pose: "arms", alt: 1 },
      cachorro: (el, ph) => { const [x, d] = vai(96, 140, 8, el, ph); return { x, y: 150, dir: d > 0 ? "right" : "left", anda: 1, cao: 1 }; }
    },
    ativ: [
      { id: "b-banco", nome: "Sentar no banco", ic: "🪑", vaga: ["banco1a", "banco1b", "banco2a", "banco2b"], hit: [[44, 100, 40, 24], [204, 100, 40, 24]], dur: 10, ganho: { energia: 12, diversao: 6 } },
      { id: "b-moeda", nome: "Moedinha no chafariz", ic: "🪙", x: 144, y: 126, dir: "up", hit: [[112, 74, 64, 44]], dur: 4, ganho: { diversao: 14 }, preco: 1 },
      { id: "b-balanco", nome: "Balançar", ic: "🎠", vaga: ["balanco1", "balanco2"], hit: [[36, 148, 46, 34]], dur: 10, ganho: { diversao: 22 } },
      { id: "b-pipoca", nome: "Comprar pipoca", ic: "🍿", x: 226, y: 172, dir: "right", hit: [[212, 146, 46, 32]], dur: 5, ganho: { fome: 15, diversao: 10 }, preco: 4, precisa: "npc-osvaldo", fecha: "O pipoqueiro só vem à tarde (14h–19h, menos segunda)." },
      { id: "b-cachorro", nome: "Brincar com os cachorros", ic: "🐶", x: 176, y: 156, dir: "left", hit: [[150, 140, 60, 30]], dur: 8, ganho: { diversao: 18, social: 6 } }
    ] },
  cafe: { nome: "Café Grão Doce", ic: "☕", porta: [144, 202], chao: [[12, 104, 276, 202]], faixa: "cafe15",
    vagas: {
      balcao: { x: 216, y: 82, dir: "down", pose: "stand", atras: 1 }, fila: { x: 192, y: 112, dir: "up", pose: "stand" },
      mesa1a: { x: 42, y: 134, dir: "right", pose: "sitdrink" }, mesa1b: { x: 70, y: 134, dir: "left", pose: "sitdrink" },
      mesa2a: { x: 42, y: 182, dir: "right", pose: "sitdrink" }, mesa2b: { x: 70, y: 182, dir: "left", pose: "sitdrink" },
      mesa3a: { x: 114, y: 160, dir: "right", pose: "sitdrink" }, mesa3b: { x: 142, y: 160, dir: "left", pose: "sitdrink" }
    },
    mesas: [["mesa1a", "mesa1b"], ["mesa2a", "mesa2b"], ["mesa3a", "mesa3b"]],
    ativ: [
      { id: "b-pedir", nome: "Pedir no balcão", ic: "☕", x: 226, y: 112, dir: "up", hit: [[170, 64, 106, 40]], menu: 1, precisa: "npc-neusa" },
      { id: "b-mesa", nome: "Sentar à mesa", ic: "🪑", vaga: ["mesa1a", "mesa1b", "mesa2a", "mesa2b", "mesa3a", "mesa3b"], hit: [[32, 118, 50, 30], [32, 166, 50, 30], [104, 144, 50, 30]], dur: 12, ganho: { energia: 8, social: 4 } }
    ] },
  academia: { nome: "Academia Movimento", ic: "🏋️", porta: [144, 202], chao: [[12, 100, 276, 202]], faixa: "academia15",
    vagas: {
      esteira1: { x: 44, y: 110, dir: "right", pose: "corre" }, esteira2: { x: 88, y: 110, dir: "right", pose: "corre" },
      pesos: { x: 154, y: 118, dir: "down", pose: "pesos" }, saco: { x: 204, y: 120, dir: "right", pose: "soco" },
      yoga: { x: 232, y: 170, dir: "down", pose: "arms", alt: 1 }, yoga2: { x: 186, y: 170, dir: "down", pose: "arms", alt: 1 },
      instrutor: (el, ph) => { const [x, d] = vai(60, 210, 10, el, ph); return { x, y: 146, dir: d > 0 ? "right" : "left", anda: 1 }; }
    },
    ativ: [
      { id: "b-esteira", nome: "Correr na esteira", ic: "🏃", vaga: ["esteira1", "esteira2"], hit: [[26, 84, 84, 32]], dur: 15, ganho: { energia: -10, diversao: 12, higiene: -10 }, hab: 14, aberto: 1 },
      { id: "b-pesos", nome: "Levantar peso", ic: "🏋️", vaga: ["pesos"], hit: [[132, 92, 46, 32]], dur: 12, ganho: { energia: -12, diversao: 8, higiene: -8 }, hab: 14, aberto: 1 },
      { id: "b-saco", nome: "Socar o saco", ic: "🥊", vaga: ["saco"], hit: [[196, 70, 40, 54]], dur: 10, ganho: { energia: -8, diversao: 16, higiene: -6 }, hab: 10, aberto: 1 },
      { id: "b-yoga", nome: "Alongar no tapete", ic: "🧘", vaga: ["yoga2", "yoga"], hit: [[170, 158, 90, 22]], dur: 10, ganho: { energia: 6, diversao: 8 }, hab: 8, aberto: 1 }
    ] },
  mercado: { nome: "Mercado Bom Preço", ic: "🛒", porta: [144, 202], chao: [[12, 100, 276, 202]], faixa: "mercado15",
    vagas: {
      caixa: { x: 250, y: 160, dir: "left", pose: "stand", atras: 1 },
      compras: (el, ph) => { const k = Math.floor((el + ph % 40) / 12) % 3, [x, d] = vai(28, 168, 14, el, ph * 7); return { x, y: [114, 150, 186][k], dir: d > 0 ? "right" : "left", anda: 1, carrinho: 1 }; },
      repor: (el, ph) => { const k = Math.floor(el / 20) % 3, [x, d] = vai(36, 160, 6, el, ph); return { x, y: [114, 150, 186][k], dir: k % 2 ? "up" : d > 0 ? "right" : "left", anda: Math.floor(el / 4) % 3 ? 0 : 1 }; }
    },
    ativ: [
      { id: "b-gondola", nome: "Escolher produtos", ic: "🧺", x: 96, y: 112, dir: "up", hit: [[20, 70, 156, 120]], menu: 1, aberto: 1 },
      { id: "b-caixa", nome: "Pagar no caixa", ic: "💳", x: 222, y: 170, dir: "right", hit: [[214, 140, 60, 40]], menu: 1, aberto: 1 }
    ] }
};
const LUG_IDS = Object.keys(LUGARES);
const ehLugar = c => !!LUGARES[c];

// =====================================================================
// 3. EU NA RUA: cena, posição, andar, entrar e sair
// =====================================================================
const EU15 = { cena: "casa", x: 350, y: PORTA_Y + 2, tx: 350, ty: PORTA_Y + 2, dir: "down", plano: null, cam: 0, init: false, pronto: false };
const dispB = {}; // posições mostradas dos outros (px da cena)
const cenaDe = j => j && LUG_IDS.concat("rua").includes(j.cena) ? j.cena : "casa";
const naRuaOuLugar = () => !!me && EU15.cena !== "casa";
function salvarCena(){
  if (!me || !salaRef) return;
  const c = EU15.cena, f = c === "casa" ? null : { x: Math.round(EU15.tx), y: Math.round(EU15.ty), dir: EU15.dir };
  me.dados.cena = c === "casa" ? null : c; me.dados.fora = f;
  ref("jogadores/" + pid).update({ cena: c === "casa" ? null : c, fora: f }).catch(() => {});
}
function irCena(c, x, y, dir){
  if (me.acao) setAcao(null);
  me.path = []; me.plano = null; closeMenu();
  EU15.cena = c; EU15.x = EU15.tx = x; EU15.y = EU15.ty = y; EU15.dir = dir || "down"; EU15.plano = null;
  if (c === "rua") EU15.cam = clamp(x - 144, 0, RUA_W - W * T);
  if (mode !== "live") setMode("live");
  carrinho15.vis = c === "mercado";
  salvarCena(); syncRuaUI(true); document.body.classList.toggle("fora15", c !== "casa");
}
function podeSair(){
  if (!me) return false;
  if (meNoTrabalho()){ toast("Você está no trabalho 💼"); return false; }
  if (emViagem() || feriasEu()){ toast("Vocês estão viajando 🚗"); return false; }
  return true;
}
function sairPraRua(destino){
  if (!podeSair()) return;
  const sai = () => {
    irCena("rua", LOTE.nos.porta, PORTA_Y + 2, "down"); sfx("porta");
    if (destino) setTimeout(() => irAoLote(destino), 250); else toast("🚶 Você saiu pra rua. Toque pra andar; nas portas pra entrar.");
  };
  const e = entradaTile();
  if (andarAtual === 0 && e && !(me.tx === e[0] && me.ty === e[1]) && bfs(me.tx, me.ty, (x, y) => x === e[0] && y === e[1])) goTo(null, (x, y) => x === e[0] && y === e[1], sai);
  else { if (andarAtual !== 0 && typeof trocarAndar === "function") trocarAndar(0, true); sai(); }
}
function entrarEmCasa(silencio){
  if (!me) return;
  if (andarAtual !== 0 && typeof trocarAndar === "function") trocarAndar(0, true);
  const e = entradaTile() || freeSpot();
  me.tx = me.px = e[0]; me.ty = me.py = e[1]; me.dir = "up"; me.path = []; me.plano = null; savePos();
  irCena("casa");
  if (!silencio){ sfx("porta"); toast("🏠 De volta em casa."); }
}
function entrarLugar(id){
  const L = LUGARES[id]; if (!L) return;
  if (!aberto(id)){ toast(L.ic + " " + L.nome + ": " + horarioTxt15(id) + "."); return; }
  irCena(id, L.porta[0], L.porta[1] - 6, "up"); sfx("porta");
  if (!B15["visto_" + id]){ B15["visto_" + id] = 1; toast(L.ic + " " + L.nome + " · toque nas coisas pra fazer atividades."); }
}
function sairDoLugar(){ const id = EU15.cena; irCena("rua", LOTE[id].porta, PORTA_Y + 2, "down"); sfx("porta"); }
// anda até um ponto da cena e depois faz "plano"
function andarAte(x, y, plano){
  if (me.acao) setAcao(null);
  const c = EU15.cena, ch = c === "rua" ? [[6, CAL_Y0, RUA_W - 6, CAL_Y1]] : LUGARES[c].chao;
  let best = null, bd = 1e9;
  for (const [x0, y0, x1, y1] of ch){ const px = clamp(x, x0, x1), py = clamp(y, y0, y1), d = Math.hypot(px - x, py - y); if (d < bd){ bd = d; best = [px, py]; } }
  EU15.tx = best[0]; EU15.ty = best[1]; EU15.plano = plano || null;
  if (Math.hypot(EU15.tx - EU15.x, EU15.ty - EU15.y) < 1){ EU15.x = EU15.tx; EU15.y = EU15.ty; const f = EU15.plano; EU15.plano = null; if (f) f(); }
  salvarCena();
}
function irAoLote(id){
  const L = LOTE[id]; if (!L) return;
  if (EU15.cena !== "rua"){ if (EU15.cena === "casa") return sairPraRua(id); sairDoLugar(); setTimeout(() => irAoLote(id), 200); return; }
  andarAte(L.porta, PORTA_Y, () => { EU15.dir = "up"; acaoLote(L); });
}
function acaoLote(L){
  if (L.lugar) return entrarLugar(L.lugar);
  if (L.nossa) return entrarEmCasa();
  if (L.placa) return typeof openBairro === "function" && !visitando ? openBairro() : toast("🏘️ As casas dos amigos ficam no Bairro dos moradores.");
  if (L.salao) return openSalao();
  baterNaPorta(L);
}
function baterNaPorta(L){
  sfx("toc");
  const t = srvNow(), em = VIZ_IDS.filter(id => VIZ[id].casa === L.id && npcEstado(id, t).casa === L.id);
  const donos = VIZ_IDS.filter(id => VIZ[id].casa === L.id).map(id => VIZ[id].nome);
  if (!em.length){ toast("Toc toc… ninguém em casa (" + nomesLista(donos) + ")."); return; }
  const id = em[0], v = VIZ[id], h = brAgora().h;
  falaNpc(id, (h < 9 ? "Bom dia" : h < 18 ? "Oi" : "Boa noite") + ", " + nomeEu10() + "! 👋");
  toast(v.nome + " atendeu a porta 👋"); relMudar(pid, id, relBonus({ amizade: 2 }));
}
// os outros: interpolação até o destino
function atualizarDispB(dt){
  for (const [id, j] of Object.entries(jogadores)){
    if (id === pid || !j || !j.fora){ delete dispB[id]; continue; }
    const c = cenaDe(j), d = dispB[id];
    if (!d || d.c !== c){ dispB[id] = { x: j.fora.x, y: j.fora.y, c, anda: false }; continue; }
    const dx = j.fora.x - d.x, dy = j.fora.y - d.y, dist = Math.hypot(dx, dy);
    if (dist > 400){ d.x = j.fora.x; d.y = j.fora.y; d.anda = false; }
    else if (dist > .5){ const s = Math.min(dist, B15.vEu * dt); d.x += dx / dist * s; d.y += dy / dist * s; d.anda = true; d.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"; }
    else d.anda = false;
  }
}
function bairroUpdate(dt){
  if (!me) return;
  if (!EU15.init){
    EU15.init = true;
    const d = me.dados || {}, c = cenaDe(d), recente = !d.visto || srvNow() - d.visto < 2 * HORA;
    if (c !== "casa" && d.fora && recente && !meNoTrabalho()){ EU15.cena = c; EU15.x = EU15.tx = d.fora.x; EU15.y = EU15.ty = d.fora.y; EU15.cam = clamp(EU15.x - 144, 0, RUA_W - W * T); document.body.classList.add("fora15"); }
    else if (c !== "casa"){ EU15.cena = "casa"; salvarCena(); }
  }
  if (EU15.cena !== "casa" && meNoTrabalho()){ EU15.cena = "casa"; salvarCena(); document.body.classList.remove("fora15"); }
  atualizarDispB(dt);
  if (EU15.cena === "casa") return;
  const dx = EU15.tx - EU15.x, dy = EU15.ty - EU15.y, dist = Math.hypot(dx, dy);
  if (dist > .3){
    const s = Math.min(dist, B15.vEu * dt); EU15.x += dx / dist * s; EU15.y += dy / dist * s;
    EU15.dir = Math.abs(dx) > Math.abs(dy) * .6 ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    passoT15 += dt; if (passoT15 > .32){ passoT15 = 0; sfx("passo", .35); }
    if (dist - s < .3){ EU15.x = EU15.tx; EU15.y = EU15.ty; const f = EU15.plano; EU15.plano = null; if (f) f(); }
  }
  if (EU15.cena === "rua"){ const alvo = clamp(EU15.x - 144, 0, RUA_W - W * T); EU15.cam += (alvo - EU15.cam) * Math.min(1, dt * 5); if (Math.abs(alvo - EU15.cam) < .3) EU15.cam = alvo; }
  // bom dia dos vizinhos (perto de você na rua)
  if (EU15.cena === "rua" || ehLugar(EU15.cena)){
    const t = srvNow();
    for (const id of VIZ_IDS){
      if (Date.now() - (saudou[id] || 0) < 4 * 60000) continue;
      const st = npcVis[id]; if (!st || Math.hypot(st.x - EU15.x, (st.y - EU15.y) * 1.5) > 30) continue;
      saudou[id] = Date.now(); const h = brAgora(t).h;
      falaNpc(id, (h >= 5 && h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ", " + nomeEu10() + "! " + (h >= 5 && h < 18 ? "☀️" : "🌙"));
      me.needs.social = clamp(me.needs.social + 3, 0, 100);
    }
  }
}
let passoT15 = 0;
const saudou = {};

// =====================================================================
// 4. DESENHO: fundo da rua em cache (canvas largo, só recortado), lugares, pessoas, luz
// =====================================================================
let ruaBg = null, ruaBgKey = "", ruaFrente = null, ruaLuz = null, ruaLuzSig = "";
const lugBg = new Map();
function corEstacao(){
  const e = estacao();
  return e === "outono" ? ["#D9893A", "#E8A94A", "#B8652E"] : e === "inverno" ? ["#4F8F6A", "#6FA884", "#3D7355"] : e === "primavera" ? ["#5DAA5E", "#7FC27A", "#3F8F56"] : ["#4FA568", "#6DBB72", "#35804F"];
}
function arvore15(x, by, s){
  const [c, cL, cD] = corEstacao(), e = estacao();
  R(x - 2, by - 22, 4, 22, "#7A5236"); R(x - 2, by - 22, 1, 22, "#9C6A44"); R(x + 1, by - 18, 1, 18, "#5E3E28");
  const r = 13 * (s || 1);
  disco(x, by - 34, r, cD); disco(x - 3, by - 37, r - 2, c); disco(x + 4, by - 31, r - 5, c); disco(x - 4, by - 40, r - 7, cL);
  for (let i = 0; i < 12; i++){ const h = hash(x, i, 31); P(x - r + h % (2 * r), by - 34 - r + (h >>> 8) % (2 * r), i % 2 ? cL : cD); }
  if (e === "primavera") for (let i = 0; i < 8; i++){ const h = hash(x, i, 33); P(x - r + 2 + h % (2 * r - 4), by - 44 + (h >>> 8) % 20, "#F49AAE"); }
  if (e === "outono") for (let i = 0; i < 5; i++){ const h = hash(x, i, 34); P(x - 10 + h % 20, by + 1 + (h >>> 8) % 3, "#D9893A"); }
}
function janela15(x, y, w, h, luz){ R(x - 1, y - 1, w + 2, h + 2, "#FFFFFF"); R(x, y, w, h, luz ? "#F6D77A" : "#9FC3E0"); R(x + (w >> 1), y, 1, h, "#FFFFFF"); R(x, y + (h >> 1), w, 1, "#FFFFFF"); if (!luz) P(x + 1, y + 1, "#E6F4FB"); R(x - 1, y + h + 1, w + 2, 1, "rgba(35,18,40,.25)"); }
function telhado(x, w, top, cor){ for (let i = 0; i < 16; i++) R(x + 16 - i, top - 16 + i, w - 32 + 2 * i, 1, i % 4 === 3 ? sh(cor, -.16) : cor); R(x - 1, top, w + 2, 2, sh(cor, -.3)); for (let i = 2; i < 14; i += 4) R(x + 18 - i, top - 15 + i, w - 36 + 2 * i, 1, sh(cor, .15)); }
function porta15(x, by, cor){ rbox(x - 6, by - 25, 12, 22, cor || "#7A5236"); R(x - 4, by - 23, 8, 8, sh(cor || "#7A5236", .12)); P(x + 3, by - 13, C.gold); R(x - 8, by - 3, 16, 3, "#C9C1B5"); R(x - 8, by - 3, 16, 1, "#E3DDD3"); }
function placa15(x, y, w){ rbox(x, y, w, 11, "#5A3A28"); R(x + 1, y + 1, w - 2, 1, "#7A5236"); }
function fachadaCasa(L){
  const x = L.x0, w = L.w, base = 124, c = L.casa, top = c.sobrado ? 48 : 72, pa = c.parede, sd = sh(pa, -.14);
  R(x + 3, top, w - 6, base - top, pa); R(x + w - 6, top + 2, 3, base - top - 2, sd); R(x + 3, base - 4, w - 6, 4, sh(pa, -.22));
  for (let yy = top + 6; yy < base - 6; yy += 7) for (let xx = x + 6 + (yy % 2) * 4; xx < x + w - 8; xx += 9) P(xx, yy, sh(pa, -.05));
  telhado(x, w, top, c.teto); R(x + w - 22, top - 22, 6, 10, "#9C6644"); R(x + w - 22, top - 22, 6, 1, "#C08A5A");
  L.jan = [];
  const jy = c.sobrado ? [56, 88] : [86];
  for (const yy of jy) for (const xx of [x + 9, x + w - 22]){ if (Math.abs(xx + 6 - L.porta) < 12 && yy > 80) continue; janela15(xx, yy, 13, 11, 0); L.jan.push([xx, yy, 13, 11]); }
  porta15(L.porta, base, sh(c.teto, -.2));
  R(x + 2, base - 1, 5, 1, "#3F8F56"); for (const fx of [x + 4, x + w - 7]){ disco(fx, base - 4, 3, "#5DAA5E"); P(fx - 1, base - 6, "#F49AAE"); P(fx + 1, base - 5, "#F6C667"); }
  R(L.porta + 12, base - 12, 1, 12, "#7A5236"); rbox(L.porta + 10, base - 16, 6, 5, "#5B8FD0");
}
function paletaNossa(){
  const h = [...sala].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) | 0, 7) >>> 0;
  return { teto: ["#8E7CF0", "#E8735F", "#5DBB7D", "#7FB8E8", "#F49AAE", "#F6C667"][h % 6], parede: ["#FFF4E0", "#F3E3D3", "#E8F1F7", "#FBE8EF"][(h >>> 4) % 4] };
}
function fachadaNossa(L){
  const x = L.x0, w = L.w, base = 124, p = paletaNossa(), top = 60, pa = p.parede;
  R(x + 3, top, w - 6, base - top, pa); R(x + w - 7, top + 2, 4, base - top - 2, sh(pa, -.14)); R(x + 3, base - 4, w - 6, 4, sh(pa, -.22));
  telhado(x - 2, w + 4, top, p.teto); R(x + 18, top - 26, 7, 12, "#9C6644"); R(x + 18, top - 26, 7, 1, "#C08A5A");
  L.jan = [[x + 10, 76, 15, 13], [x + w - 26, 76, 15, 13], [x + 10, 96, 15, 13], [x + w - 26, 96, 15, 13]];
  for (const [a, b, ww, hh] of L.jan) janela15(a, b, ww, hh, 0);
  porta15(L.porta, base, "#C0506E"); pixHeart(L.porta - 2, base - 21, "#FFC2CC");
  placa15(L.porta - 26, top + 4, 52); // nome da casa (texto na camada de cima)
  R(x - 2, base - 6, w + 4, 6, "#78B860"); R(x - 2, base - 6, w + 4, 1, "#97CE80");
  for (let i = 0; i < 6; i++){ const fx = x + 4 + i * 6 + (i > 2 ? w - 40 : 0); P(fx, base - 7, ["#F49AAE", "#F6C667", "#FFFFFF"][i % 3]); P(fx + 1, base - 6, "#5DAA5E"); }
  R(L.porta - 9, base - 1, 18, 1, "#E9D8BE");
}
function toldo(x, w, y, a, b){ for (let i = 0; i < w; i++) R(x + i, y, 1, 9, Math.floor(i / 6) % 2 ? b : a); for (let i = 0; i < w; i += 6) disco(x + i + 3, y + 9, 2, Math.floor(i / 6) % 2 ? b : a); R(x, y, w, 1, sh(a, -.25)); }
function fachadaCafe(L){
  const x = L.x0, w = L.w, base = 124, top = 58;
  R(x + 2, top, w - 4, base - top, "#F7E6D2"); R(x + w - 5, top, 3, base - top, "#E2CBB1"); R(x + 2, top - 3, w - 4, 4, "#8C5E3A");
  for (let yy = top + 4; yy < 84; yy += 6) R(x + 2, yy, w - 4, 1, "#EED7BE");
  placa15(x + 14, top + 5, w - 28); toldo(x + 2, w - 4, 84, "#E8607A", "#FFF4E0");
  rbox(x + 8, 98, 40, 22, "#7A5236"); R(x + 10, 100, 36, 18, "#BFE6F7"); R(x + 10, 110, 36, 1, "#FFFFFF");
  for (let i = 0; i < 4; i++){ rbox(x + 12 + i * 9, 111, 7, 6, ["#F9C9D6", "#E9C48A", "#F6E3A0", "#C08A5A"][i]); P(x + 14 + i * 9, 111, "#FFFFFF"); }
  rbox(L.porta - 8, 97, 16, 27, "#7A5236"); R(L.porta - 6, 99, 12, 20, "#BFE6F7"); R(L.porta - 6, 108, 12, 1, "#FFFFFF"); P(L.porta + 4, 110, C.gold);
  R(L.porta - 10, base - 1, 20, 1, "#C9C1B5");
  rbox(x + w - 20, 112, 12, 4, "#E9D8BE"); R(x + w - 15, 116, 2, 7, "#7A5236"); rbox(x + w - 26, 114, 5, 9, "#E8607A"); // mesinha de fora
  L.jan = [[x + 10, 100, 36, 18]];
}
function fachadaAcademia(L){
  const x = L.x0, w = L.w, base = 124, top = 54;
  R(x + 2, top, w - 4, base - top, "#5B6B8C"); R(x + w - 5, top, 3, base - top, "#46557A"); R(x + 2, top, w - 4, 3, "#7F8FB0");
  placa15(x + 12, top + 6, w - 24);
  for (const xx of [x + 8, x + w - 40]){ rbox(xx, 80, 32, 30, "#2E3A55"); R(xx + 2, 82, 28, 26, "#9FC3E0"); R(xx + 2, 82, 28, 3, "#C8E0F2"); R(xx + 6, 98, 18, 3, "#3A3448"); R(xx + 8, 92, 2, 6, "#3A3448"); R(xx + 20, 92, 2, 6, "#3A3448"); }
  rbox(L.porta - 9, 92, 18, 32, "#2E3A55"); R(L.porta - 7, 94, 14, 28, "#BFE6F7"); R(L.porta, 94, 1, 28, "#2E3A55");
  R(x + 2, base - 3, w - 4, 3, "#3A4766");
  L.jan = [[x + 10, 82, 28, 26], [x + w - 38, 82, 28, 26]];
}
function fachadaSalao(L){ // salão de cabeleireiro: rosa, vitrine com cabecinhas e o poste listrado
  const x = L.x0, w = L.w, base = 124, top = 64;
  R(x + 2, top, w - 4, base - top, "#F7C6D6"); R(x + w - 5, top, 3, base - top, "#E9A9BF"); R(x + 2, top - 3, w - 4, 4, "#C2507E");
  placa15(x + 10, top + 4, w - 20); toldo(x + 2, w - 4, 82, "#C2507E", "#FFF4E0");
  rbox(x + 6, 94, 26, 22, "#8C5E7A"); R(x + 8, 96, 22, 18, "#BFE6F7");
  for (const [cx, cor] of [[x + 13, "#6B3A2A"], [x + 23, "#E8C27A"]]){ disco(cx, 105, 3, "#F6D2B0"); R(cx - 4, 100, 8, 3, cor); R(cx - 4, 102, 2, 4, cor); R(cx - 2, 109, 4, 5, "#FFF4E0"); }
  rbox(L.porta - 9, 92, 18, 32, "#8C5E7A"); R(L.porta - 7, 94, 14, 28, "#BFE6F7"); R(L.porta, 94, 1, 28, "#8C5E7A");
  const px = x + w - 10; R(px, 90, 5, 30, "#FFFFFF"); for (let y = 90; y < 120; y += 6){ R(px, y, 5, 2, "#E8445E"); R(px, y + 3, 5, 1, "#378ADD"); }
  R(px - 1, 88, 7, 2, "#C8963E"); R(px - 1, 120, 7, 2, "#C8963E");
  L.jan = [[x + 8, 96, 22, 18]];
}
function fachadaMercado(L){
  const x = L.x0, w = L.w, base = 124, top = 60;
  R(x + 2, top, w - 4, base - top, "#EFF7EC"); R(x + w - 5, top, 3, base - top, "#D3E6CC"); R(x + 2, top - 3, w - 4, 4, "#3F8F56");
  placa15(x + 16, top + 4, w - 32); toldo(x + 2, w - 4, 80, "#3F8F56", "#EFF7EC");
  rbox(L.porta - 14, 94, 28, 30, "#7A8BA0"); R(L.porta - 12, 96, 24, 28, "#BFE6F7"); R(L.porta, 96, 1, 28, "#7A8BA0");
  rbox(x + 8, 96, 30, 22, "#7A8BA0"); R(x + 10, 98, 26, 18, "#BFE6F7"); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) R(x + 12 + j * 6, 101 + i * 5, 4, 3, ["#E8445E", "#F6C667", "#7FC27A", "#F49A6A"][(i + j) % 4]);
  for (let i = 0; i < 3; i++){ const cx = x + w - 40 + i * 12; rbox(cx, 112, 11, 9, "#C08A5A"); for (let k = 0; k < 5; k++) P(cx + 2 + k * 2 - (k > 2 ? 4 : 0), 110 + (k > 2 ? 1 : 0), ["#E8445E", "#F6C667", "#7FC27A"][(i + k) % 3]); }
  L.jan = [[x + 10, 98, 26, 18]];
}
function fachadaPraca(L){
  const x = L.x0, w = L.w, base = 124;
  R(x, 92, w, 32, "#8CC56E");
  disco(x + w / 2, 104, 18, "#B9C2CF"); disco(x + w / 2, 104, 15, "#7FB8E8"); disco(x + w / 2, 100, 4, "#D8F0FA"); R(x + w / 2 - 1, 90, 2, 12, "#D8F0FA");
  for (let i = 0; i < w; i += 4) if (Math.abs(x + i - L.porta) > 12){ rbox(x + i, 112, 5, 12, "#3F8F56"); P(x + i + 2, 113, "#5DAA5E"); }
  for (const xx of [L.porta - 13, L.porta + 11]){ R(xx, 98, 3, 26, "#9C6A44"); R(xx, 98, 1, 26, "#C08A5A"); }
  R(L.porta - 13, 96, 27, 3, "#9C6A44"); placa15(L.porta - 26, 84, 52);
  arvore15(x + 16, 112, 1.2); arvore15(x + w - 16, 112, 1.1);
  L.jan = [];
}
function placaAmigos(L){ const x = L.porta; R(x - 1, 96, 3, 28, "#7A5236"); rbox(x - 12, 92, 24, 10, "#C08A5A"); R(x + 10, 94, 4, 6, "#C08A5A"); L.jan = []; }
function desenharRuaBg(c){
  const g = c.getContext("2d"), oy = c.height - CH15;
  withCtx(g, 1, () => {
    R(0, 0, RUA_W, c.height, "#8FD0F0");
    ctx.save(); ctx.translate(0, oy);
    for (const [y0, y1, cor] of [[-oy, 18, "#8FD0F0"], [18, 34, "#A3D8F2"], [34, 52, "#B8E1F4"], [52, 70, "#CDE9F6"]]) R(0, y0, RUA_W, y1 - y0, cor);
    for (let i = 0; i < 9; i++) nuvem15(40 + i * 130 + hash(i, 1, 5) % 50, 10 + hash(i, 2, 5) % 26, 18 + hash(i, 3, 5) % 16);
    for (let x = 0; x < RUA_W; x += 6){ const hh = 18 + hash(x, 9, 9) % 26; R(x, 70 - hh, 6, hh + 4, x % 12 ? "#B8C7D9" : "#AFC0D4"); if (hash(x, 4, 4) % 3 === 0) R(x + 2, 74 - hh, 2, 2, "#DDE6F0"); } // prédios ao longe
    R(0, 70, RUA_W, 54, "#97CE80"); for (let i = 0; i < 260; i++){ const h = hash(i, 7, 77); P(h % RUA_W, 72 + (h >>> 10) % 50, i % 2 ? "#86C26F" : "#A8D891"); }
    for (const L of LOTES){ if (L.casa) fachadaCasa(L); else if (L.nossa) fachadaNossa(L); else if (L.lugar === "cafe") fachadaCafe(L); else if (L.lugar === "academia") fachadaAcademia(L); else if (L.salao) fachadaSalao(L); else if (L.lugar === "mercado") fachadaMercado(L); else if (L.lugar === "praca") fachadaPraca(L); else if (L.placa) placaAmigos(L); }
    for (const x of ARVORES) arvore15(x, 124, .95);
    R(0, 0, 24, 124, "#97CE80"); R(0, 100, 24, 24, "#B9C2CF"); // começo da rua (pro centro)
    // calçada
    R(0, 124, RUA_W, 28, "#D9D2C6"); R(0, 124, RUA_W, 1, "#EFE9DE");
    for (let x = 0; x < RUA_W; x += 16) R(x, 124, 1, 28, "#C4BCAE");
    for (let y = 131; y < 152; y += 8) R(0, y, RUA_W, 1, "#CDC5B7");
    for (let i = 0; i < 70; i++){ const h = hash(i, 11, 3); P(h % RUA_W, 126 + (h >>> 9) % 24, "#C9C1B5"); }
    R(0, 151, RUA_W, 3, "#B3AA9C"); R(0, 151, RUA_W, 1, "#E3DDD3");
    // rua
    R(0, 154, RUA_W, 40, "#4A4458"); for (let i = 0; i < 160; i++){ const h = hash(i, 13, 5); P(h % RUA_W, 155 + (h >>> 9) % 38, i % 2 ? "#54506A" : "#423C50"); }
    for (let x = 6; x < RUA_W; x += 30) R(x, 173, 14, 2, "#F6E7A0");
    for (const L of LOTES) if (L.lugar){ for (let k = 0; k < 6; k++) R(L.porta - 14, 157 + k * 6, 28, 3, "#E6E1EE"); } // faixas de pedestre
    R(0, 194, RUA_W, 3, "#B3AA9C"); R(0, 197, RUA_W, 11, "#D9D2C6");
    for (let x = 8; x < RUA_W; x += 26){ disco(x, 204, 4, "#5DAA5E"); P(x - 1, 201, "#7FC27A"); }
    ctx.restore();
  });
}
function nuvem15(x, y, w){ rbox(x, y, w, 6, "#FFFFFF"); rbox(x + 4, y - 4, Math.max(4, w - 10), 6, "#FFFFFF"); R(x + 1, y + 5, w - 2, 1, "#E3EEF7"); }
function desenharFrente(c){ // postes (na frente das pessoas): canvas próprio, também só recortado
  const g = c.getContext("2d"), oy = c.height - CH15;
  withCtx(g, 1, () => { ctx.save(); ctx.translate(0, oy);
    for (const x of POSTES){ R(x - 1, 112, 3, 42, "#5A546C"); R(x - 1, 112, 1, 42, "#7A748C"); R(x - 3, 150, 7, 3, "#46405A"); R(x - 1, 112, 9, 2, "#5A546C"); rbox(x + 4, 113, 7, 4, "#46405A"); R(x + 5, 116, 5, 1, "#FFF3C4"); }
    ctx.restore(); });
}
function garantirRuaBg(){
  const key = [lo.height, estacao(), sala].join("|");
  if (ruaBg && key === ruaBgKey) return;
  ruaBgKey = key; ruaBg = ruaBg || document.createElement("canvas"); ruaBg.width = RUA_W; ruaBg.height = lo.height; desenharRuaBg(ruaBg);
  ruaFrente = ruaFrente || document.createElement("canvas"); ruaFrente.width = RUA_W; ruaFrente.height = lo.height; ruaFrente.getContext("2d").clearRect(0, 0, RUA_W, lo.height); desenharFrente(ruaFrente);
  ruaLuzSig = "";
}
// ---- lugares: fundo de cada um (288 x lo.height) ----
function piso15(x0, y0, x1, y1, a, b, t){ for (let y = y0; y < y1; y += t) for (let x = x0; x < x1; x += t) R(x, y, t, t, ((x / t + y / t) | 0) % 2 ? a : b); }
function cadeira15(x, by, cor){ rbox(x - 4, by - 9, 8, 3, cor); R(x - 4, by - 6, 1, 6, sh(cor, -.25)); R(x + 3, by - 6, 1, 6, sh(cor, -.25)); }
function mesaRedonda(x, by){ R(x - 1, by - 9, 3, 9, "#7A5236"); R(x - 5, by - 1, 11, 1, "#5E3E28"); for (let dy = -3; dy <= 3; dy++){ const w = Math.round(9 * Math.sqrt(1 - (dy / 3.6) ** 2)); R(x - w, by - 12 + dy, w * 2 + 1, 1, dy < 0 ? "#C08A5A" : dy === 3 ? "#7A5236" : "#9C6644"); } R(x - 5, by - 14, 6, 1, "#D9A877"); rbox(x + 1, by - 16, 4, 3, "#FFFFFF"); P(x + 2, by - 16, "#8C5E3A"); }
const LUG_DRAW = {
  praca(){
    for (const [y0, y1, cor] of [[-200, 20, "#8FD0F0"], [20, 34, "#A8DAF2"], [34, 46, "#C2E6F5"]]) R(0, y0, 288, y1 - y0, cor);
    nuvem15(30, 12, 22); nuvem15(190, 22, 16);
    R(0, 46, 288, 162, "#8CC56E"); for (let i = 0; i < 300; i++){ const h = hash(i, 5, 55); P(h % 288, 48 + (h >>> 9) % 158, i % 2 ? "#7DB862" : "#A0D486"); }
    for (const x of [20, 70, 120, 170, 222, 268]) arvore15(x + hash(x, 1, 1) % 8, 70 + hash(x, 2, 2) % 10, 1.15);
    R(128, 100, 32, 108, "#E3D6BE"); R(10, 132, 268, 22, "#E3D6BE"); for (let i = 0; i < 120; i++){ const h = hash(i, 8, 8); const onX = i % 2; P(onX ? 128 + h % 32 : 10 + h % 268, onX ? 100 + (h >>> 8) % 108 : 132 + (h >>> 8) % 22, "#D1C2A6"); }
    // chafariz
    for (let dy = -14; dy <= 14; dy++){ const ww = Math.round(30 * Math.sqrt(1 - (dy / 14.5) ** 2)); R(144 - ww, 98 + dy, ww * 2, 1, "#B9C2CF"); }
    for (let dy = -11; dy <= 11; dy++){ const ww = Math.round(26 * Math.sqrt(1 - (dy / 11.5) ** 2)); R(144 - ww, 97 + dy, ww * 2, 1, "#5FB8DE"); }
    R(141, 78, 6, 20, "#B9C2CF"); rbox(136, 76, 16, 5, "#C9D1DC");
    // bancos
    for (const bx of [64, 224]){ rbox(bx - 15, 104, 30, 5, "#9C6A44"); R(bx - 15, 104, 30, 1, "#C08A5A"); rbox(bx - 15, 111, 30, 4, "#B5814F"); R(bx - 13, 115, 2, 5, "#5A546C"); R(bx + 11, 115, 2, 5, "#5A546C"); }
    // balanço
    R(36, 146, 3, 34, "#5A546C"); R(82, 146, 3, 34, "#5A546C"); R(34, 144, 54, 3, "#7A748C"); R(30, 178, 60, 4, "#D8C49A");
    // pipoqueiro (carrinho)
    rbox(214, 150, 26, 18, "#E8445E"); R(216, 152, 22, 8, "#FFF4E0"); for (let i = 0; i < 7; i++) P(218 + i * 3, 153 + (i % 2), "#F6E3A0"); R(212, 146, 30, 3, "#FFFFFF"); R(226, 140, 2, 6, "#7A748C");
    disco(218, 170, 3, "#2E2638"); disco(236, 170, 3, "#2E2638");
    for (const [x, y] of [[20, 192], [268, 192], [20, 110], [268, 110]]){ disco(x, y, 6, "#5DAA5E"); P(x - 2, y - 3, "#F49AAE"); P(x + 2, y - 2, "#F6C667"); P(x, y - 4, "#FFFFFF"); }
    R(134, 200, 20, 8, "#B9C2CF");
  },
  cafe(){
    R(0, -200, 288, 268, "#F3D9C0"); for (let y = -200; y < 60; y += 8) R(0, y, 288, 1, "#EBCBAE");
    R(0, 60, 288, 6, "#8C5E3A"); R(0, 60, 288, 1, "#B5814F");
    rbox(20, 12, 70, 38, "#2E3A2E"); R(22, 14, 66, 34, "#3F5240"); for (let i = 0; i < 5; i++) R(28, 19 + i * 6, 30 + (i * 13) % 24, 1, "#E3EEE0"); R(70, 19, 12, 1, "#F6E3A0"); R(70, 25, 10, 1, "#F6E3A0");
    rbox(104, 8, 60, 44, "#7A5236"); R(106, 10, 56, 40, "#9FD3F2"); R(106, 34, 56, 16, "#97CE80"); R(133, 10, 2, 40, "#7A5236"); R(106, 29, 56, 2, "#7A5236"); disco(118, 40, 5, "#3F8F56");
    for (const sx of [184, 240]){ R(sx, 18, 34, 2, "#8C5E3A"); for (let i = 0; i < 5; i++) rbox(sx + 2 + i * 6, 10, 5, 8, ["#F6E3A0", "#E8C890", "#BFD9F2", "#F9C9D6", "#C6E8C8"][i]); }
    piso15(0, 66, 288, 208, "#E9D8BE", "#C9A57A", 12);
    R(166, 66, 110, 6, "#5E3E28"); // parede do balcão (atrás)
    rbox(260, 72, 14, 18, "#B9C2CF"); R(262, 74, 10, 6, "#3A3448"); // máquina de café
    for (const [x, y] of [[56, 136], [56, 184], [128, 162]]){ cadeira15(x - 14, y, "#C0506E"); cadeira15(x + 14, y, "#C0506E"); }
    for (const [x, y] of [[14, 96], [274, 196]]){ rbox(x - 5, y - 6, 10, 8, "#C08A5A"); disco(x, y - 12, 6, "#5DAA5E"); P(x - 2, y - 14, "#7FC27A"); }
    R(132, 200, 24, 8, "#BFE6F7");
  },
  academia(){
    R(0, -200, 288, 264, "#DDE3EE"); R(0, 58, 288, 6, "#7A8BA0");
    rbox(14, 10, 200, 42, "#B9C2CF"); R(16, 12, 196, 38, "#CFE6F5"); for (let i = 0; i < 6; i++) R(30 + i * 34, 14, 10, 34, "#E6F4FB");
    rbox(226, 12, 46, 30, "#E8445E"); R(230, 18, 38, 2, "#FFFFFF"); R(230, 24, 26, 2, "#FFFFFF"); R(230, 30, 32, 2, "#FFF4E0");
    R(0, 64, 288, 144, "#4A4F5E"); for (let i = 0; i < 260; i++){ const h = hash(i, 9, 99); P(h % 288, 66 + (h >>> 9) % 140, i % 3 ? "#565B6C" : "#3E4252"); }
    for (const x of [44, 88]){ rbox(x - 16, 98, 32, 14, "#3A3448"); R(x - 14, 100, 28, 4, "#2E2638"); R(x + 12, 84, 3, 16, "#7A748C"); rbox(x + 8, 80, 10, 6, "#5A546C"); R(x + 10, 82, 6, 2, "#7FD1B2"); }
    rbox(138, 108, 34, 7, "#C0506E"); R(142, 115, 2, 6, "#7A748C"); R(166, 115, 2, 6, "#7A748C"); R(136, 92, 2, 18, "#7A748C"); R(172, 92, 2, 18, "#7A748C");
    R(206, 64, 1, 18, "#7A748C");
    rbox(170, 160, 34, 12, "#7FD1B2"); rbox(216, 160, 34, 12, "#F49AAE");
    rbox(256, 80, 16, 26, "#BFE6F7"); R(258, 82, 12, 10, "#7FB8E8"); R(262, 96, 4, 4, "#5A546C");
    for (let i = 0; i < 3; i++) rbox(20 + i * 12, 150, 10, 30, ["#7FB8E8", "#F6C667", "#B49CF4"][i]); // armários
    R(132, 200, 24, 8, "#BFE6F7");
  },
  mercado(){
    R(0, -200, 288, 262, "#EAF4E6"); R(0, 56, 288, 6, "#3F8F56");
    for (const [x, t, c] of [[16, 60, "#E8445E"], [96, 60, "#F6C667"], [176, 60, "#7FB8E8"]]){ rbox(x, 14, t, 14, c); R(x + 6, 19, t - 12, 2, "#FFFFFF"); }
    rbox(196, 34, 76, 30, "#BFE6F7"); R(198, 36, 72, 26, "#E6F4FB"); for (let i = 0; i < 6; i++) rbox(200 + i * 12, 44, 9, 14, ["#FFFFFF", "#F6E3A0", "#E8445E", "#7FC27A", "#FFFFFF", "#F49A6A"][i]); // freezer
    piso15(0, 62, 288, 208, "#F4F1EA", "#E3DDD3", 16);
    for (const y of [96, 132, 168]){ rbox(22, y - 14, 150, 14, "#B9C2CF"); for (let i = 0; i < 24; i++){ const h = hash(i, y, 3); rbox(25 + i * 6, y - 13 + (i % 2), 5, 6, ["#E8445E", "#F6C667", "#7FC27A", "#7FB8E8", "#F49A6A", "#FFFFFF", "#B49CF4"][h % 7]); } R(22, y - 1, 150, 1, "#8E94AA"); }
    rbox(214, 150, 44, 14, "#7A8BA0"); R(216, 152, 40, 4, "#3A3448"); rbox(250, 140, 10, 10, "#3A3448"); R(252, 142, 6, 3, "#7FD1B2"); // caixa
    for (let i = 0; i < 3; i++){ const x = 230 + i * 12, y = 190; R(x, y - 8, 10, 6, "#C9D1DC"); for (let k = 0; k < 5; k++) P(x + k * 2, y - 8 + (k % 2), "#8E94AA"); disco(x + 2, y, 1, "#2E2638"); disco(x + 8, y, 1, "#2E2638"); }
    R(132, 200, 24, 8, "#BFE6F7");
  }
};
function lugarBg(id){
  const k = id + "|" + lo.height + "|" + estacao(); let c = lugBg.get(k); if (c) return c;
  c = document.createElement("canvas"); c.width = W * T; c.height = lo.height;
  withCtx(c.getContext("2d"), 1, () => { ctx.save(); ctx.translate(0, c.height - CH15); LUG_DRAW[id](); ctx.restore(); });
  lugBg.set(k, c); return c;
}
// ---- carros que passam (puro do tempo) ----
const CORES_CARRO = ["#E8445E", "#5B8FD0", "#F6C667", "#7FD1B2", "#B49CF4", "#F2F2F2", "#F49A6A"];
const carSpr = (cor, esq, roda) => sprite("car15:" + cor + ":" + (esq ? 1 : 0) + ":" + roda, 32, 15, (ox, oy) => {
  const c = cor, cL = sh(c, .3), cD = sh(c, -.25), vd = "#BFE6F7";
  const X = (a, w) => esq ? ox + 32 - a - w : ox + a;
  R(X(1, 30), oy + 6, 30, 6, c); R(X(2, 28), oy + 6, 28, 1, cL); R(X(1, 30), oy + 11, 30, 1, cD);
  R(X(8, 15), oy + 1, 15, 6, c); R(X(9, 13), oy + 1, 13, 1, cL); R(X(10, 5), oy + 2, 5, 4, vd); R(X(16, 5), oy + 2, 5, 4, vd);
  R(X(29, 2), oy + 7, 2, 2, "#FFF0A0"); R(X(1, 1), oy + 7, 1, 2, "#E8445E");
  for (const wx of [7, 24]){ R(X(wx - 3, 7), oy + 9, 7, 6, "#2E2638"); R(X(wx - 1, 3), oy + 11, 3, 2, "#C6D0DA"); P(X(wx - 1 + roda, 1), oy + 11 + roda, "#8D9BAA"); }
});
function carrosAgora(t){
  const l = [];
  for (const [lane, per, v, y, esq] of [[0, 21000, 92, 172, 0], [1, 27000, 80, 191, 1]]){
    const dur = (RUA_W + 90) / v * 1000;
    for (let k = -1; k <= 0; k++){
      const i = Math.floor(t / per) + k, h = hash(i, lane, 1501); if (h % 4 === 0) continue;
      const ini = i * per + h % 6000, e = t - ini; if (e < 0 || e > dur) continue;
      const d = e / 1000 * v; l.push({ x: esq ? RUA_W + 45 - d : -45 + d, by: y, cor: CORES_CARRO[(h >>> 4) % CORES_CARRO.length], esq });
    }
  }
  return l;
}
// ---- cachorros da praça (puro do tempo) ----
function caesPraca(t){
  const el = tB(t) / 1000, l = [];
  for (let i = 0; i < 2; i++){ const [x, d] = vai(30 + i * 120, 120 + i * 130, 14 + i * 4, el + i * 37, i * 50), parado = Math.floor(el / 6 + i) % 3 === 0; l.push({ x: parado ? Math.round(80 + i * 120) : x, by: 160 + i * 26, esq: d < 0, pose: parado ? "sit" : "walk" }); }
  return l;
}
// ---- pessoas na cena ----
const npcVis = {};      // id -> estado visível agora (na cena em que estou)
const npcFalaM = {};    // id -> { txt, at }
function falaNpc(id, txt){ npcFalaM[id] = { txt, at: Date.now() }; }
function poseCena(acaoId, tm, k){
  const pisca = (tm + k * 377) % 3700 < 140;
  if (/^b-(banco|mesa|tomar|balanco)/.test(acaoId)) return { pose: (/^b-(mesa|tomar)/.test(acaoId) ? (acaoId === "b-tomar-bolo" || acaoId === "b-tomar-pao" ? "siteat" : "sitdrink") : "sit") + (pisca ? "blink" : ""), frame: Math.floor((tm + k * 211) / 650) % 3 === 2 ? 1 : 0, sit: 1 };
  if (acaoId === "b-esteira") return { pose: "stand", frame: Math.floor(tm / 90) % 4, corre: 1 };
  if (/^b-(pesos|saco|yoga|piada)|dancar/.test(acaoId)) return { pose: Math.floor(tm / 300) % 2 ? "arms" : "stand", frame: /dancar/.test(acaoId) ? (Math.floor(tm / 260) % 2 ? 1 : 3) : 0 };
  return { pose: pisca ? "blink" : Math.floor((tm + k * 211) / 800) % 2 ? "breath" : "stand", frame: 0 };
}
function blitTeen(L, cx, by, dir, frame, pose, moch){ ctx.drawImage(kidSprite(true, L, dir, frame, pose === "corre" ? "stand" : pose, moch).c, Math.round(cx - 9), Math.round(by - 24)); }
function blitNpc(id, cx, by, dir, frame, pose, extra){
  const v = VIZ[id];
  if (!/^sit/.test(pose)){ R(cx - 3, by - 1, 6, 1, "rgba(35,18,40,.22)"); R(cx - 5, by, 10, 1, "rgba(35,18,40,.3)"); }
  if (v.teen){ const p = /^sit/.test(pose) ? "sit" : pose === "arms" ? "arms" : "stand"; blitTeen(v.L, cx, by, dir, frame, p, extra && extra.mochila); }
  else blitAvatar(v.av, cx, by, dir, frame, pose);
}
// estado de cada vizinho na minha cena (com pose e quadro)
function npcsNaCena(c, t, tm){
  const l = [];
  for (const id of VIZ_IDS){
    const st = npcEstado(id, t); npcVis[id] = null;
    if (st.cena !== c) continue;
    const k = hashStr(id) % 97;
    let pose = st.pose || "stand", frame = st.anda ? Math.floor((tm + k * 37) / (st.correr ? 80 : 115)) % 4 : 0;
    const pisca = (tm + k * 377) % 3700 < 140;
    if (st.anda) pose = "stand";
    else if (pose === "stand") pose = pisca ? "blink" : Math.floor((tm + k * 211) / 800) % 2 ? "breath" : "stand";
    else if (pose === "sit" || pose === "sitdrink"){ frame = pose === "sitdrink" ? (Math.floor((tm + k * 211) / 650) % 3 === 2 ? 1 : 0) : 0; if (pisca) pose += "blink"; }
    else if (pose === "corre"){ pose = "stand"; frame = Math.floor(tm / 90) % 4; }
    else if (pose === "pesos" || pose === "soco" || (pose === "arms" && st.alt)) { pose = Math.floor((tm + k * 100) / (st.pose === "soco" ? 220 : 500)) % 2 ? "arms" : "stand"; }
    let x = st.x, y = st.y;
    if (st.balanco){ x += Math.round(Math.sin(tm / 380 + k) * 3); }
    const o = { id, x, y, dir: st.dir || "down", pose, frame, st, festa: false };
    npcVis[id] = o; l.push(o);
  }
  return l;
}
// os jogadores na minha cena
function jogadoresNaCena(c, tm){
  const l = [];
  for (const [id, j] of Object.entries(jogadores)){
    if (!j || !j.nome) continue;
    let x, y, dir, anda, acao;
    if (id === pid){ if (EU15.cena !== c) continue; x = EU15.x; y = EU15.y; dir = EU15.dir; anda = Math.hypot(EU15.tx - EU15.x, EU15.ty - EU15.y) > .4; acao = me.acao; }
    else { if (!j.online || cenaDe(j) !== c || !dispB[id]) continue; const d = dispB[id]; x = d.x; y = d.y; dir = d.dir || (j.fora && j.fora.dir) || "down"; anda = d.anda; acao = j.acao && Date.now() - (j.acao.ini || 0) < (j.acao.dur || 0) + 3000 ? j.acao : null; }
    const k = (id.charCodeAt(1) || 0) * 7, aid = acao ? acao.id || "" : "";
    let p = anda ? { pose: "stand", frame: Math.floor(tm / 115) % 4 } : poseCena(aid, tm, k);
    if (!anda && acao && acao.dir15) dir = acao.dir15;
    if (p.corre) dir = "right";
    if (aid === "b-balanco") x += Math.round(Math.sin(tm / 380 + k) * 3);
    l.push({ id, j, x, y, dir, pose: p.pose, frame: p.frame, aid, sit: p.sit });
  }
  return l;
}
function desenharPessoa(o, tm){
  const jv = o.id === pid && me ? avDe(pid, me.dados) : avDe(o.id, o.j);
  if (!o.sit){ R(o.x - 3, o.y - 1, 6, 1, "rgba(35,18,40,.22)"); R(o.x - 5, o.y, 10, 1, "rgba(35,18,40,.3)"); }
  blitAvatar(jv, o.x, o.y, o.dir, o.frame, o.pose);
  if (EU15.cena === "mercado" && o.id === pid && carrinho15.vis) carrinhoSpr15(o.x + (o.dir === "left" ? -14 : 6), o.y);
}
function carrinhoSpr15(x, by){ const n = Object.values(carrinho15.itens).reduce((s, v) => s + v, 0); R(x, by - 9, 10, 6, "#C9D1DC"); for (let k = 0; k < 5; k++) P(x + k * 2, by - 9 + (k % 2), "#8E94AA"); for (let i = 0; i < Math.min(4, n); i++) R(x + 1 + i * 2, by - 11, 2, 2, ["#E8445E", "#F6C667", "#7FC27A", "#FFFFFF"][i]); disco(x + 2, by - 1, 1, "#2E2638"); disco(x + 8, by - 1, 1, "#2E2638"); R(x + 9, by - 12, 1, 4, "#8E94AA"); }
const labels15 = [];
function drawBairro(now){
  if (!naRuaOuLugar() || feriasEu()) return false;
  const a0 = performance.now(), c = EU15.cena, mctx = canvas.getContext("2d");
  ctx = lo.getContext("2d"); S = 1; ctx.imageSmoothingEnabled = false;
  const tm = Date.now(), t = srvNow(), oy = oyCena(), rua = c === "rua", cam = rua ? Math.round(EU15.cam) : 0;
  labels15.length = 0;
  if (rua){ garantirRuaBg(); ctx.drawImage(ruaBg, cam, 0, W * T, lo.height, 0, 0, W * T, lo.height); }
  else ctx.drawImage(lugarBg(c), 0, 0);
  ctx.save(); ctx.translate(-cam, oy);
  const vis = (x, m) => x > cam - (m || 30) && x < cam + W * T + (m || 30);
  const objs = [];
  if (rua){
    // janelas acesas das casas com gente (à noite)
    const hr = horaRua(), noite = hr >= 17.5 || hr < 6;
    if (noite) for (const L of LOTES){ if (!L.jan || !L.jan.length || !vis(L.x0 + L.w / 2, 80)) continue; if (casaAcesa(L, t)) for (const [x, y, w, h] of L.jan) R(x, y, w, h, "#F6D77A"); }
    // água do chafariz que dá pra ver por cima da cerca
    if (vis(88)) for (let i = 0; i < 3; i++){ const ph = (tm / 300 + i / 3) % 1; P(88 - 2 + i * 2, 92 - Math.round(Math.sin(ph * Math.PI) * 6), "#FFFFFF"); }
    // Lívia: cachorro na coleira; Dona Cida: regador
  } else {
    if (c === "praca"){
      for (let i = 0; i < 5; i++){ const ph = (tm / 420 + i / 5) % 1, a = i / 5 * Math.PI * 2; P(Math.round(144 + Math.cos(a) * ph * 18), Math.round(80 + ph * ph * 16 - Math.sin(ph * Math.PI) * 10), "#FFFFFF"); }
      for (let i = 0; i < 6; i++){ const x = 120 + ((tm / 60 + i * 9) % 48); P(Math.round(x), 97 + Math.round(Math.sin(tm / 300 + i) * 1.5), "#9FD6F2"); }
      for (const d of caesPraca(t)) objs.push({ z: d.by, f: () => { R(d.x - 5, d.by + 1, 10, 1, "rgba(35,18,40,.25)"); ctx.drawImage(petSprite("cachorro", d.pose, d.pose === "walk" ? Math.floor(tm / 150) % 2 : Math.floor(tm / 650) % 2, d.esq, false).c, Math.round(d.x - 9), d.by - 13); } });
    }
    if (c === "cafe"){ // balcão na frente de quem está atrás dele
      objs.push({ z: 98, f: () => { rbox(166, 84, 110, 16, "#B5814F"); R(168, 84, 106, 3, "#E9D8BE"); R(168, 88, 106, 1, "#8C5E3A"); rbox(196, 70, 36, 16, "#E6F4FB"); for (let i = 0; i < 4; i++) rbox(199 + i * 8, 77, 6, 6, ["#F9C9D6", "#E9C48A", "#F6E3A0", "#C08A5A"][i]); R(196, 70, 36, 1, "#FFFFFF"); } });
      for (const [x, y] of [[56, 136], [56, 184], [128, 162]]) objs.push({ z: y - .5, f: () => mesaRedonda(x, y) });
      if (Math.floor(tm / 700) % 2 && aberto("cafe")){ P(266, 66, "#FFFFFF"); P(267, 64, "#FFFFFF"); }
    }
    if (c === "academia") objs.push({ z: 128, f: () => { rbox(198, 82, 12, 26, "#C0506E"); R(200, 84, 8, 2, "#E8607A"); R(198, 104, 12, 2, "#8C3A50"); } });
    if (c === "mercado") objs.push({ z: 166, f: () => { rbox(214, 150, 44, 14, "#7A8BA0"); R(216, 152, 40, 4, "#3A3448"); R(216, 152, ((tm / 40) % 40) | 0, 1, "#5A546C"); } });
  }
  // vizinhos
  for (const o of npcsNaCena(c, t, tm)){
    if (rua && !vis(o.x)) continue;
    const st = o.st, z = st.atras ? o.y - 20 : o.y;
    objs.push({ z, f: () => {
      blitNpc(o.id, Math.round(o.x), Math.round(o.y), o.dir, o.frame, o.pose, { mochila: st.s && st.indo === "fora" || (st.s && st.s.onde === "fora") });
      if (st.cao){ const cx = Math.round(o.x + (o.dir === "left" ? -14 : 14)), anda = st.anda; R(cx - 5, o.y + 1, 10, 1, "rgba(35,18,40,.25)"); ctx.drawImage(petSprite("cachorro", anda ? "walk" : "sit", anda ? Math.floor(tm / 150) % 2 : 0, o.dir === "left", false).c, cx - 9, Math.round(o.y) - 12); if (rua) for (let i = 0; i < 5; i++) P(Math.round(o.x + (cx - o.x) * i / 5), Math.round(o.y - 10 + i * 1.5), "#E8445E"); }
      if (st.regar){ R(o.x + 4, o.y - 12, 6, 4, "#7FB8E8"); R(o.x + 9, o.y - 13, 3, 1, "#7FB8E8"); const g = Math.floor(tm / 120) % 4; P(o.x + 12, o.y - 11 + g, "#BFE6F7"); P(o.x + 13, o.y - 9 + g, "#BFE6F7"); }
      if (st.s && st.s.a === "compras" && st.carrinho) carrinhoSpr15(Math.round(o.x + (o.dir === "left" ? -14 : 6)), Math.round(o.y));
      if (st.s && st.s.a === "pesos" && /arms/.test(o.pose)) { R(o.x - 9, o.y - 31, 18, 1, "#7A748C"); rbox(o.x - 11, o.y - 33, 3, 5, "#2E2638"); rbox(o.x + 8, o.y - 33, 3, 5, "#2E2638"); }
    } });
    labels15.push({ x: o.x - cam, y: o.y + oy, nome: VIZ[o.id].nome, npc: o.id, teen: VIZ[o.id].teen, sit: /^sit/.test(o.pose) });
  }
  // jogadores
  for (const o of jogadoresNaCena(c, tm)){
    objs.push({ z: o.y + .1, f: () => { desenharPessoa(o, tm); if (o.aid === "b-pesos" && /arms/.test(o.pose)){ R(o.x - 9, o.y - 31, 18, 1, "#7A748C"); rbox(o.x - 11, o.y - 33, 3, 5, "#2E2638"); rbox(o.x + 8, o.y - 33, 3, 5, "#2E2638"); } } });
    labels15.push({ x: o.x - cam, y: o.y + oy, nome: o.j.nome + (o.j.visita ? " · visita" : ""), jog: o.id, sit: !!o.sit, acao: o.id === pid ? me.acao : o.j.acao });
  }
  objs.sort((a, b) => a.z - b.z).forEach(o => o.f());
  ctx.restore();
  if (rua){
    ctx.drawImage(ruaFrente, cam, 0, W * T, lo.height, 0, 0, W * T, lo.height);
    ctx.save(); ctx.translate(-cam, oy);
    const rd = Math.floor(tm / 90) % 2;
    for (const k of carrosAgora(t)) if (vis(k.x, 40)){ R(k.x - 14, k.by - 1, 30, 2, "rgba(20,20,30,.3)"); ctx.drawImage(carSpr(k.cor, k.esq, rd).c, Math.round(k.x - 16), k.by - 15); }
    ctx.restore();
  }
  // partículas (corações, notas)
  ctx.save(); ctx.translate(-cam, 0); particulasCena(tm); ctx.restore();
  // chuva e luz
  const clima = (rua || c === "praca") ? climaAgora() : null;
  if (clima){ const n = clima === "garoa" ? 70 : 150, len = clima === "garoa" ? 2 : 4; ctx.fillStyle = clima === "garoa" ? "rgba(228,238,255,.55)" : "rgba(212,230,255,.75)"; for (let i = 0; i < n; i++){ const h = hash(i, 3, 777), y = ((tm / (clima === "garoa" ? 9 : 4) + h % 400) % (lo.height + 20)) - 10, x = ((h >>> 9) % 300 + y * .25 + cam * .2) % 300 - 6; ctx.fillRect(Math.round(x), Math.round(y), 1, len); } }
  luzCena(c, cam, clima, t);
  ctx.drawImage(vig, 0, 0);
  mctx.imageSmoothingEnabled = false; mctx.drawImage(lo, 0, 0, canvas.width, canvas.height);
  textosCena(mctx, c, cam, oy, tm, t);
  B15.ms += performance.now() - a0; B15.quadros++;
  return true;
}
function casaAcesa(L, t){
  if (L.nossa) return Object.values(jogadores).some(j => j && j.online && cenaDe(j) === "casa" && !j.visita) || horaRua() < 23;
  if (L.lugar) return L.lugar !== "praca" && aberto(L.lugar, t);
  return VIZ_IDS.some(id => VIZ[id].casa === L.id && npcEstado(id, t).casa === L.id) && horaRua() < 23.5;
}
function luzCena(c, cam, clima, t){
  const hr = horaRua(); let dk = darkness(hr); if (clima) dk = Math.min(.5, dk + (clima === "garoa" ? .08 : .15));
  let k = dk * 2; if (!LUGARES[c] || !LUGARES[c].fora) k = c === "rua" ? k : k * .3; // dentro dos lugares a luz está acesa
  if (k <= 0) return;
  const warm = clima ? [186, 196, 224] : hr < 12 ? [255, 214, 214] : [255, 198, 156], night = [116, 110, 182];
  const A = k < .5 ? [255, 255, 255] : warm, B = k < .5 ? warm : night, f = k < .5 ? k * 2 : (k - .5) * 2;
  const base = "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(",") + ")";
  const largura = c === "rua" ? RUA_W : W * T, oy = oyCena(), lights = [];
  if (c === "rua"){
    if (k > .3) for (const x of POSTES) lights.push([x + 7, 118 + oy, 46, "255,214,150", 1]);
    if (k > .3) for (const L of LOTES) if (L.jan && casaAcesa(L, t)) for (const [x, y, w, h] of L.jan) lights.push([x + w / 2, y + h / 2 + oy, 20, "255,206,130", .8]);
  } else if (c === "praca"){ if (k > .3) for (const [x, y] of [[20, 110], [268, 110], [144, 70]]) lights.push([x, y + oy, 50, "255,214,150", 1]); }
  else for (const x of [60, 144, 228]) lights.push([x, 40 + oy, 70, "255,226,180", .7]);
  const sig = c + base + largura + "x" + lo.height + lights.map(L => L.join(",")).join("|");
  if (!ruaLuz){ ruaLuz = document.createElement("canvas"); }
  if (sig !== ruaLuzSig){
    ruaLuzSig = sig; ruaLuz.width = largura; ruaLuz.height = lo.height;
    const l = ruaLuz.getContext("2d"); l.fillStyle = base; l.fillRect(0, 0, largura, lo.height); l.globalCompositeOperation = "lighter";
    for (const [x, y, r, cc, pw] of lights){ l.globalAlpha = clamp(pw * k, 0, 1); l.drawImage(luzSpr(cc, r, 0), x - r, y - r, r * 2, r * 2); }
    l.globalAlpha = 1; l.globalCompositeOperation = "source-over";
  }
  ctx.globalCompositeOperation = "multiply"; ctx.drawImage(ruaLuz, cam, 0, W * T, lo.height, 0, 0, W * T, lo.height);
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, r, cc, pw] of lights){ if (r < 40 || x < cam - r || x > cam + W * T + r) continue; const r2 = r * .7; ctx.globalAlpha = clamp(.2 * k * pw, 0, 1); ctx.drawImage(luzSpr(cc, r, 1), x - cam - r2, y - r2, r2 * 2, r2 * 2); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
}
// nomes, placas, balões, conversa dos vizinhos e setas das bordas
const setas15 = [];
const EMOJIS_PAPO = ["☕", "😂", "🌧️", "⚽", "🐶", "🍰", "🎵", "😮", "💬", "🌻", "📺", "👍"];
function textosCena(mctx, c, cam, oy, tm, t){
  const K = canvas.width / (W * T), dpr = Math.min(window.devicePixelRatio || 1, 3), fs = Math.round(clamp(4.6 * K, 12 * dpr, 17 * dpr));
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.textAlign = "center"; mctx.textBaseline = "bottom"; mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1);
  const nome = (txt, x, y, cor) => { mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(txt, x, y); mctx.fillStyle = cor; mctx.fillText(txt, x, y); };
  // placas
  if (c === "rua"){
    const fp = Math.round(fs * .8); mctx.font = "700 " + fp + "px 'Pixelify Sans', monospace";
    for (const L of LOTES){
      const txt = L.lugar ? LUGARES[L.lugar].nome : L.nossa ? (nomeCasa || nomeCasaPadrao()) : L.placa ? "Amigos" : L.salao ? "Salão" : null; if (!txt) continue;
      const bx = (L.lugar === "praca" ? L.porta : L.nossa ? L.porta : L.placa ? L.porta : L.x0 + L.w / 2) - cam, by = (L.lugar === "praca" ? 95 : L.nossa ? 75 : L.placa ? 101 : L.lugar === "mercado" ? 74 : L.lugar === "academia" ? 70 : L.salao ? 75 : 73) + oy;
      if (bx < -60 || bx > W * T + 60) continue;
      mctx.fillStyle = "#FFF4E0"; mctx.save(); mctx.beginPath(); const lw = (L.nossa ? 50 : L.placa ? 22 : L.lugar === "praca" ? 50 : L.salao ? 50 : L.w - 32) * K; mctx.rect((bx * K) - lw / 2, (by - 12) * K, lw, 14 * K); mctx.clip();
      mctx.fillText(txt, bx * K, (by - .5) * K, lw - 4); mctx.restore();
    }
    mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
  }
  // conversa entre vizinhos (balões com emoji, iguais em todo aparelho)
  const aqui = VIZ_IDS.filter(id => npcVis[id]), bl = Math.floor(tB(t) / 6000), pares = [];
  for (let i = 0; i < aqui.length; i++) for (let j = i + 1; j < aqui.length; j++){ const a = npcVis[aqui[i]], b = npcVis[aqui[j]]; if (Math.abs(a.x - b.x) < 46 && Math.abs(a.y - b.y) < 30 && !a.st.anda && !b.st.anda) pares.push([aqui[i], aqui[j]]); }
  if (pares.length && (tB(t) % 6000) < 3600){ const [a, b] = pares[hash(bl, salaSeed, 61) % pares.length], quem = hash(bl, 3, 62) % 2 ? a : b; if (!npcFalaM[quem] || Date.now() - npcFalaM[quem].at > 4000) npcFalaM[quem] = { txt: EMOJIS_PAPO[hash(bl, 5, 63) % EMOJIS_PAPO.length] + (hash(bl, 6, 64) % 2 ? " " + EMOJIS_PAPO[hash(bl, 7, 65) % EMOJIS_PAPO.length] : ""), at: Date.now() - 600, auto: 1 }; }
  // nomes
  for (const L of labels15){
    const sx = L.x * K; if (sx < -40 || sx > canvas.width + 40) continue;
    const top = (L.y - (L.teen ? 24 : L.sit ? 25 : 28)) * K;
    if (L.npc) nome(L.nome, sx, top, "#FAC775"); else nome(L.nome, sx, top, L.jog === pid ? "#FFFFFF" : "#E6DEFF");
    const f = L.npc ? npcFalaM[L.npc] : null, fj = L.jog && jogadores[L.jog];
    if (f && Date.now() - f.at < 4200) bolha9(mctx, fs, sx, top - fs * 1.05, f.txt);
    else if (fj && fj.fala && fj.falaAt && tm - fj.falaAt < 7000 && tm - fj.falaAt > -60000) bolha9(mctx, fs, sx, top - fs * 1.05, String(fj.fala));
    if (L.jog === pid && L.acao){ const w = 16 * K, pr = clamp((tm - L.acao.ini) / L.acao.dur, 0, 1), bh = Math.max(4, K * 1.2); mctx.fillStyle = "rgba(18,14,28,.85)"; mctx.fillRect(sx - w / 2 - 1, top + 2, w + 2, bh + 2); mctx.fillStyle = "#8E7CF0"; mctx.fillRect(sx - w / 2, top + 3, w * pr, bh); }
  }
  // setas das bordas: o que tem pra lá (lugares e gente)
  setas15.length = 0;
  if (c === "rua"){
    const vw = W * T, esq = [], dir = [];
    for (const L of LOTES){ if (!L.lugar && !L.nossa) continue; const x = L.porta; if (x < cam + 6) esq.push([cam - x, L]); else if (x > cam + vw - 6) dir.push([x - cam - vw, L]); }
    const gente = (lado) => Object.entries(jogadores).filter(([id, j]) => id !== pid && j && j.online && cenaDe(j) === "rua" && dispB[id] && (lado < 0 ? dispB[id].x < cam : dispB[id].x > cam + vw)).map(([, j]) => j.nome);
    const rot = L => L.lugar ? LUGARES[L.lugar].ic + " " + LUGARES[L.lugar].nome.split(" ")[0] : "🏠 Casa";
    for (const [lado, l] of [[-1, esq], [1, dir]]){
      l.sort((a, b) => a[0] - b[0]); const g = gente(lado);
      if (!l.length && !g.length) continue;
      const txt = (lado < 0 ? "◀ " : "") + (l.length ? rot(l[0][1]) : "") + (g.length ? (l.length ? " · " : "") + "👤 " + nomesLista(g) : "") + (lado > 0 ? " ▶" : "");
      const fpx = Math.round(fs * .82); mctx.font = "700 " + fpx + "px Nunito, sans-serif";
      const tw = Math.min(mctx.measureText(txt).width, canvas.width * .46), bw = tw + 14, bh = fpx * 1.7, y = (CAL_Y0 - 30 + oy) * K, x = lado < 0 ? 4 : canvas.width - bw - 4;
      mctx.fillStyle = "rgba(27,21,40,.78)"; mctx.beginPath(); if (mctx.roundRect) mctx.roundRect(x, y, bw, bh, 8); else mctx.rect(x, y, bw, bh); mctx.fill();
      mctx.fillStyle = "#FFFFFF"; mctx.textAlign = "left"; mctx.fillText(txt, x + 7, y + bh - fpx * .42, tw); mctx.textAlign = "center";
      setas15.push({ x, y, w: bw, h: bh, lote: l.length ? l[0][1].id : null, lado });
      mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
    }
  }
}

// =====================================================================
// 5. TOQUES NA CENA
// =====================================================================
function bairroClick(p, toque){
  if (me.acao && me.acao.id === "minigame") return;
  const c = EU15.cena, cam = c === "rua" ? Math.round(EU15.cam) : 0, oy = oyCena(), sx = p.x + cam, sy = p.y - oy, f = toque ? 6 : 2;
  // setas das bordas
  if (c === "rua"){
    const r = canvas.getBoundingClientRect(), qx = p.sx * canvas.width / r.width, qy = p.sy * canvas.height / r.height;
    for (const s of setas15) if (qx >= s.x && qx <= s.x + s.w && qy >= s.y - 6 && qy <= s.y + s.h + 6){ if (s.lote) irAoLote(s.lote); else andarAte(s.lado < 0 ? EU15.x - 200 : EU15.x + 200, EU15.y); return; }
  }
  // vizinho
  let alvo = null, bd = 13 + f;
  for (const id of VIZ_IDS){ const o = npcVis[id]; if (!o) continue; const d = Math.hypot(sx - o.x, (sy - (o.y - (VIZ[id].teen ? 9 : 12))) * .8); if (d < bd){ bd = d; alvo = id; } }
  if (alvo) return menuVizinho(alvo, p);
  // outra pessoa
  for (const [id, d] of Object.entries(dispB)){ const j = jogadores[id]; if (!j || !j.online || cenaDe(j) !== c) continue; if (Math.hypot(sx - d.x, (sy - (d.y - 12)) * .8) < 12 + f){ return menuPessoaFora(id, p); } }
  if (c === "rua"){
    if (sy < CAL_Y0 - 2){ const L = LOTES.find(l => sx >= l.x0 && sx < l.x0 + l.w); if (L) return menuLote(L, p); }
    return andarAte(sx, sy);
  }
  const L = LUGARES[c];
  if (Math.abs(sx - L.porta[0]) < 16 && sy > L.porta[1] - 10) return sairDoLugar();
  for (const a of L.ativ) if (a.hit.some(([x, y, w, h]) => sx >= x - f && sx <= x + w + f && sy >= y - f && sy <= y + h + f)) return tocarAtiv(c, a, p);
  andarAte(sx, sy);
}
function menuLote(L, p){
  if (L.nossa) return openMenu(p, nomeCasa || nomeCasaPadrao(), [{ nome: "Entrar em casa 🏠", fn: () => irAoLote(L.id) }]);
  if (L.placa) return openMenu(p, "🏘️ Casas de amigos", [{ nome: "Ver o bairro", info: Object.keys(vizinhos).length + " casas", fn: () => irAoLote(L.id) }]);
  if (L.salao) return openMenu(p, "💇 Salão", [{ nota: 1, nome: "Corte, cor e barba" }, { nome: "Entrar", fn: () => irAoLote(L.id) }]);
  if (L.lugar){ const G = LUGARES[L.lugar]; return openMenu(p, G.ic + " " + G.nome, [{ nota: 1, nome: horarioTxt15(L.lugar) }, { nome: "Entrar", fn: () => irAoLote(L.id) }]); }
  const donos = VIZ_IDS.filter(id => VIZ[id].casa === L.id);
  openMenu(p, "Casa de " + nomesLista(donos.map(id => VIZ[id].nome)), [{ nome: "Bater na porta 🚪", fn: () => irAoLote(L.id) }]);
}
function menuPessoaFora(id, p){
  const j = jogadores[id];
  openMenu(p, j.nome, [
    { nome: "Conversar 💬", fn: () => perto(dispB[id].x, dispB[id].y, () => { startAcao({ id: "s-conversar", nome: "Conversando com " + j.nome, dur: 5, ganho: { social: 25, diversao: 5 } }, null, id); ref("eventos/" + id).push({ tipo: "conversar", de: pid, at: TS() }).catch(() => {}); }) },
    { nome: "Abraçar 🤗", fn: () => perto(dispB[id].x, dispB[id].y, () => { startAcao({ id: "s-abracar", nome: "Abraçando " + j.nome, dur: 3, ganho: { social: 25 } }, null, id); ref("eventos/" + id).push({ tipo: "abracar", de: pid, at: TS() }).catch(() => {}); burst15(EU15.x, EU15.y, "heart"); }) }
  ]);
}
function burst15(x, y, kind){ for (let i = 0; i < 6; i++) particles.push({ x: x + (Math.random() * 12 - 6), y: y + oyCena() - 22, vy: -8 - Math.random() * 10, vx: Math.random() * 8 - 4, life: 1.6, kind }); }
// anda até perto de (x, y) e faz fn virado pra lá
function perto(x, y, fn){ const lado = EU15.x < x ? -12 : 12; andarAte(x + lado, y + 1, () => { EU15.dir = lado < 0 ? "right" : "left"; fn(); }); }

// ---- interações com os vizinhos ----
const npcCd = {};
const PRESENTES15 = { flores: { nome: "Flores", ic: "💐", preco: 15 }, chocolate: { nome: "Chocolate", ic: "🍫", preco: 10 }, livro: { nome: "Livro", ic: "📕", preco: 20 }, biscoito: { nome: "Biscoito de cachorro", ic: "🦴", preco: 8 } };
function infoVizinho15(id){
  const v = VIZ[id], r = relDe(pid, id), est = estAmizade(r);
  return v.anos + " anos · " + v.prof + " · " + v.tracos.map(k => TRACOS[k] ? TRACOS[k].ic + " " + TRACOS[k].nome : k).join(", ") + " · " + est.ic + " " + est.nome;
}
function menuVizinho(id, p){
  const v = VIZ[id], am = amizadeDe(pid, id), o = npcVis[id];
  const it = [{ nota: 1, nome: infoVizinho15(id) },
    { nome: "Conversar 💬", info: "Amizade", fn: () => interagir(id, "conversa") },
    { nome: "Contar piada 😂", info: "Arriscado", fn: () => interagir(id, "piada") },
    { nome: "Elogiar 🌟", info: "Amizade", fn: () => interagir(id, "elogio") },
    { nome: "Dar presente 🎁", info: "Mais amizade", fn: () => darPresente15(id) }];
  if (!v.teen || am >= 20) it.push({ nome: "Chamar pra visitar 🏡", info: am >= 15 ? "Vem em casa" : "Precisa ser amigo", fn: () => chamarVisita15(id) });
  it.push({ nome: "Convidar pra festa 🎉", info: festaAtiva() ? "Festa marcada" : "Marcar festa", fn: () => convidarFesta15(id) });
  if (o && o.st && o.st.s && LUGARES[o.st.s.onde] && o.st.s.onde === "cafe" && !visitando) it.push({ nome: "Pagar um café pra " + v.nome + " ☕", info: "$5", fn: () => { if (!gastar(5, "o café")) return; interagir(id, "cafe"); } });
  openMenu(p, v.nome, it);
}
const RESP15 = { conversa: ["Que bom conversar com você! 😊", "Pois é, né?", "Hahaha, verdade!", "Volta mais vezes!"], elogio: ["Ah, obrigado(a)! 😊", "Que gentileza! 💛", "Você que é! 😄"], piadaBoa: ["HAHAHA! 😂", "Essa foi boa! 🤣", "Kkkkk, conta outra!"], piadaRuim: ["Hm… 😐", "Não entendi… 🤔", "…tá. 😶"], cafe: ["Obrigado(a) pelo café! ☕💛"] };
// v50: respostas dos vizinhos. Cada ação tem a sua lista (café, conversa, mostrar a casa) e cada vizinho um jeitinho;
// sorteia sem repetir a última frase daquele vizinho. Antes a visita usava uma conta fixa (horário da visita + tamanho do
// nome da ação) e caía sempre na mesma fala solta, tipo "Acordo às 5 todo dia".
const ela15 = id => { const v = VIZ[id] || {}, c = (v.av && v.av.corpo) || (v.L && v.L.corpo); return c === "ela"; };
const oa15 = (id, txt) => txt.replace(/\(a\)/g, ela15(id) ? "a" : "o");
const CAFE15 = ["Hum, que cafezinho gostoso! ☕", "Nada como um café com os vizinhos 💛", "Obrigad(a)! Passadinho na hora, né? ☕", "Aceito! Um cafezinho sempre cai bem ☕",
  "Que cheirinho bom! ☕✨", "Café e uma boa prosa: combinação perfeita 😊", "Esquentou até o coração 💛", "Do jeitinho que eu gosto! ☕"];
const CAFE_VIZ15 = {
  "npc-neusa": ["Quase tão bom quanto o do Grão Doce! 😄☕", "Que delícia ser servida pra variar, meu bem 🥹", "Forte do jeitinho que eu gosto! Depois te conto meu segredo ☕", "Pó bom, água no ponto… vocês aprenderam direitinho! ☕"],
  "npc-rafa": ["Sem açúcar, por favor! 💪☕", "Cafeína antes do treino? Bora! ⚡"],
  "npc-bia": ["Combustível pro prazo de sexta ☕😅", "Agora eu desenho até de madrugada! 🎨☕"],
  "npc-osvaldo": ["No barco eu tomava café às 4 da manhã! 🎣☕", "Café com pipoca, já provou? Fica bom, viu!"],
  "npc-jorge": ["No tempo dos Correios era um café a cada entrega! 📮☕", "Esse café merece carta de agradecimento ✉️"],
  "npc-cida": ["Da próxima eu trago o bolo de fubá pra acompanhar! 🍰", "Ai, que gostoso… igualzinho o de casa 💛"],
  "npc-marcos": ["Café e violão: combinação perfeita 🎸☕", "Esse café merece uma música! 🎶"],
  "npc-paula": ["Igual ao nosso café de sábado ☕", "Café bom e casa bonita, que visita boa! 📐"],
  "npc-livia": ["…obrigada. Tá uma delícia 😊☕", "O Biscoito ia querer um pouquinho também 🐶"],
  "npc-hideo": ["Esse pó é lá do mercado? Escolheram bem! ☕", "Café bom, freguês satisfeito 😄"],
  "npc-teo": ["Café? Minha vó vai achar que eu cresci 😅", "Valeu! Agora eu aguento estudar 📚"],
  "npc-caio": ["Valeu! Plantão no caixa pede isso ☕", "Salvou meu dia 🙌"]
};
const CAFE_MAIS15 = ["Mais um? Hoje eu não durmo! 😄", "Ih, já tô ligad(a) de tanto café ☕⚡", "Esse já foi o segundo… tô voando! 😂", "Mais um cafezinho? Vocês me mimam! 🥹"];
const TOUR15 = ["Que casinha linda! 🏡", "Adorei a decoração, viu? ✨", "Dá pra ver o carinho em cada cantinho 💛", "Que vontade de morar aqui 😄", "Vocês capricharam!", "Que janela mais charmosa! 🪟", "Tá tudo tão aconchegante 🛋️"];
const TOUR_VIZ15 = { "npc-paula": ["Gostei da planta da casa! Bem pensada 📐", "Essa parede ficou linda, que papel bonito!"], "npc-cida": ["Que cortina bonita! Fui costureira, sei reconhecer 🧵"], "npc-livia": ["Que cantinho bom pro bichinho de vocês 🐾"], "npc-marcos": ["Essa sala tem acústica boa, hein! 🎸"] };
const CONVERSA15 = ["Que bom conversar com vocês! 😊", "Adoro essa vizinhança 💛", "Vocês são uns amores!", "A gente precisa fazer isso mais vezes!"];
const ultFala15 = {};
function semRepetir15(chave, lista){ // evita as últimas 3 frases daquele vizinho (ou menos, se a lista for curta)
  const uniq = [...new Set(lista)]; if (!uniq.length) return "";
  const hist = ultFala15[chave] || (ultFala15[chave] = []), evita = new Set(hist.slice(-Math.min(3, uniq.length - 1)));
  const pode = lista.filter(t => !evita.has(t)), txt = (pode.length ? pode : lista)[Math.floor(Math.random() * (pode.length ? pode : lista).length)];
  hist.push(txt); if (hist.length > 6) hist.shift();
  return txt;
}
const cafesVisita15 = {};
function respostaVizinho15(id, tipo, chaveVisita){
  const v = VIZ[id] || { falas: [] };
  if (tipo === "cafe"){
    const k = (chaveVisita || "") + id, n = cafesVisita15[k] = (cafesVisita15[k] || 0) + 1;
    return oa15(id, semRepetir15(id + "cafe", n > 1 ? CAFE_MAIS15 : CAFE15.concat(CAFE_VIZ15[id] || [], CAFE_VIZ15[id] || [])));
  }
  if (tipo === "tour") return oa15(id, semRepetir15(id + "tour", TOUR15.concat(TOUR_VIZ15[id] || [])));
  return oa15(id, semRepetir15(id + "conversa", (v.falas || []).concat(CONVERSA15)));
}
function interagir(id, tipo){
  const v = VIZ[id], o = npcVis[id];
  if (!o){ toast(v.nome + " já foi embora."); return; }
  if (Date.now() - (npcCd[id + tipo] || 0) < 25000){ falaNpc(id, "Já já a gente conversa mais 😊"); return; }
  perto(o.x, o.y, () => {
    npcCd[id + tipo] = Date.now();
    const dados = { conversa: ["b-conversa", "Conversando com " + v.nome, 5, { social: 22, diversao: 4 }], piada: ["b-piada", "Contando uma piada pra " + v.nome, 4, { social: 14, diversao: 10 }],
      elogio: ["b-elogio", "Elogiando " + v.nome, 3, { social: 14 }], cafe: ["b-conversa", "Tomando um café com " + v.nome, 6, { social: 25, energia: 8 }] }[tipo];
    startAcao({ id: dados[0], nome: dados[1], dur: dados[2], ganho: dados[3], fim: () => {
      let d = 5, r = RESP15.conversa;
      if (tipo === "conversa"){ d = 5; r = [respostaVizinho15(id, "conversa")]; ganharHab("charme", 4); }
      if (tipo === "elogio"){ d = 4; r = RESP15.elogio; }
      if (tipo === "cafe"){ d = 9; r = [respostaVizinho15(id, "cafe", "rua" + brDia())]; }
      if (tipo === "piada"){ const gosta = v.tracos.some(k => k === "brincalhao" || k === "sociavel" || k === "comilao"), serio = v.tracos.some(k => k === "timido" || k === "organizado"), sorte = Math.random();
        if (gosta || (!serio && sorte < .7) || (serio && sorte < .35)){ d = gosta ? 8 : 5; r = RESP15.piadaBoa; sfx("risada"); } else { d = -2; r = RESP15.piadaRuim; } }
      falaNpc(id, r[Math.floor(Math.random() * r.length)]);
      relMudar(pid, id, d > 0 ? relBonus({ amizade: d }) : { amizade: d }).then(() => { refreshPanel("relacoes"); checarConquistas(); });
      if (d > 0) burst15(EU15.x, EU15.y, "note");
    } }, null, id);
    if (me.acao) me.acao.dir15 = EU15.dir;
  });
}
function darPresente15(id){
  if (visitando){ toast("Visita não gasta aqui 😉"); return; }
  const v = VIZ[id];
  openPanel("presente15", "Presente pra " + v.nome + " 🎁", corpo => {
    corpo.append(el("p", "muted", "Cada vizinho tem um gosto. Acertar rende o dobro de amizade."));
    const l = el("div", "list");
    for (const [k, pr] of Object.entries(PRESENTES15)){
      const row = el("div", "rowi"), tx = el("div", "tx"); tx.append(el("strong", null, pr.ic + " " + pr.nome), el("small", null, "$" + pr.preco));
      row.append(tx, btn("Dar", "btn small", () => {
        if (!gastar(pr.preco, "o presente")) return; closePanel();
        const acertou = v.gosta === k, d = acertou ? 16 : 8;
        relMudar(pid, id, relBonus({ amizade: d })).then(() => checarConquistas());
        falaNpc(id, acertou ? "Ai, eu AMO " + pr.nome.toLowerCase() + "! " + pr.ic + "💛" : "Obrigado(a)! " + pr.ic + " 😊"); sfx(acertou ? "fanfarra" : "pop");
        toast(v.nome + (acertou ? " amou o presente! 💛" : " gostou do presente.")); ganharNeeds({ social: 10 });
      }));
      l.append(row);
    }
    corpo.append(l);
  });
}
// vizinho chamado pra visitar: entra no sistema de visitas (bate na porta e fica um tempinho)
let bairroDB = {};
function chamarVisita15(id){
  const v = VIZ[id];
  if (amizadeDe(pid, id) < 15){ falaNpc(id, "Quem sabe quando a gente se conhecer melhor 😊"); toast("Fiquem mais amigos antes (amizade 15)."); return; }
  if (v.teen){ falaNpc(id, "Vou pedir pra minha vó! 😅"); }
  const t = srvNow(), cur = bairroDB.visita;
  if (cur && t < cur.fim){ toast("Já tem vizinho indo visitar 🏡"); return; }
  ref("casa/bairro/visita").set({ npc: id, ini: t + 45000, fim: t + 45000 + 12 * MIN, por: pid }).then(() => { falaNpc(id, "Passo lá já já! 🏡"); toast(v.nome + " vai passar na casa de vocês daqui a pouco 🏡"); });
}
for (const id of VIZ_IDS) if (!VIZ[id].teen) VISITAS[id] = { nome: VIZ[id].nome, dur: 12 * MIN, av: VIZ[id].av };
{ const f0 = visitaAgora; visitaAgora = function(){
  const v = bairroDB.visita, t = srvNow();
  if (v && VIZ[v.npc] && !VIZ[v.npc].teen && t >= v.ini && t < v.fim) return { id: "n" + v.ini, tipo: v.npc, ini: v.ini, fim: v.fim, pedido: "visita", lado: 1, premio: v.ini / 1000 | 0 };
  return f0();
}; }
{ const f0 = visitaDoBloco; visitaDoBloco = function(b){
  const v = f0(b); if (v) return v;
  const h = i => hash(salaSeed, b, 640 + i);
  if (h(0) % 100 >= 30) return null;
  const ad = VIZ_IDS.filter(id => !VIZ[id].teen), amigos = ad.filter(id => amizadeDe(pid, id) >= 10), l = amigos.length ? amigos : ad, tipo = l[h(1) % l.length];
  const ini = b * VISITA_BLOCO + (h(2) % 60) * 60000;
  return { id: "b" + b, tipo, ini, fim: ini + VISITAS[tipo].dur, pedido: "visita", lado: h(4) % 2, premio: h(5) };
}; }
const visFeito15 = new Set();
{ const f0 = visitaPendente; visitaPendente = function(v){ if (VIZ[v.tipo]) return !visFeito15.has(v.id); return f0(v); }; }
{ const f0 = avisoVisita; avisoVisita = function(v){
  if (!VIZ[v.tipo]) return f0(v);
  const txt = VIZ[v.tipo].nome + ", da rua, bateu na porta pra uma visita 🏡"; toast(txt + (andarAtual ? " (lá embaixo)" : "")); avisar("visita", txt);
}; }
{ const f0 = visitaMenu; visitaMenu = function(p){
  const v = visView && visView.v; if (!v || !VIZ[v.tipo]) return f0(p);
  if (visView.fase === "indo"){ toast(VIZ[v.tipo].nome + " já está indo embora. Tchau!"); return; }
  const id = v.tipo, nm = VIZ[id].nome, faz = (k, nome, dur, ganho, d) => {
    if (andarAtual !== 0){ toast("A visita está lá embaixo."); return; }
    const [sx, sy] = visitaSpot(v), fora = sy > HC, goal = fora ? (x, y) => Math.abs(x - sx) + Math.abs(y - sy) === 1 : (x, y) => y === HC - 1 && Math.abs(x - sx) <= 1;
    const a = { id: "v-" + k, nome, dur, ganho, fim: () => { visFeito15.add(v.id); relMudar(pid, id, relBonus({ amizade: d })).then(() => checarConquistas()); toast(nm + ": \"" + respostaVizinho15(id, k === "cafe15" ? "cafe" : k === "tour15" ? "tour" : "conversa", v.id) + "\""); } };
    if (!bfs(me.tx, me.ty, goal)){ if (me.acao) setAcao(null); me.path = []; startAcao(a); return; }
    goTo(null, goal, () => { faceTo(sx, sy); startAcao(a); });
  };
  openMenu(p, nm + " veio visitar", [{ nota: 1, nome: infoVizinho15(id) },
    { nome: "Conversar", info: "Social", fn: () => faz("conversa15", "Conversando com " + nm, 6, { social: 30, diversao: 6 }, 6) },
    { nome: "Oferecer um cafezinho ☕", info: "Amizade", fn: () => faz("cafe15", "Tomando um café com " + nm, 6, { social: 25, energia: 6 }, 8) },
    { nome: "Mostrar a casa 🏠", info: "Amizade", fn: () => faz("tour15", "Mostrando a casa pra " + nm, 8, { social: 20, diversao: 10 }, 7) }]);
}; }

// ---- atividades dos lugares ----
function vagaLivre(c, nomes){
  const ocup = new Set();
  for (const id of VIZ_IDS){ const o = npcVis[id]; if (o && o.st && o.st.s && o.st.s.onde === c && !o.st.anda) ocup.add(o.st.s.a); }
  for (const [id, j] of Object.entries(jogadores)) if (id !== pid && j && j.online && cenaDe(j) === c && j.acao && j.acao.vaga15 && Date.now() - (j.acao.ini || 0) < (j.acao.dur || 0) + 3000) ocup.add(j.acao.vaga15);
  return nomes.filter(n => !ocup.has(n));
}
function tocarAtiv(c, a, p){
  const L = LUGARES[c]; if (EU15.cena !== c) return;
  if (a.aberto && !aberto(c)){ toast(L.ic + " " + horarioTxt15(c) + "."); return; }
  if (a.precisa){ const st = npcVis[a.precisa]; if (!st || st.st.anda){ toast(a.fecha || (VIZ[a.precisa].nome + " não está aqui agora.")); return; } }
  if (c === "cafe" && a.id === "b-pedir") return menuCafe(p);
  if (c === "mercado") return openMercado();
  if (c === "academia" && !diariaPaga()){ return openMenu(p, "Academia Movimento", [{ nota: 1, nome: "Diária: $" + DIARIA + " (vale o dia todo)" }, { nome: "Pagar a diária e treinar", info: "$" + DIARIA, fn: () => { if (pagarDiaria()) fazerAtiv(c, a); } }]); }
  fazerAtiv(c, a);
}
function fazerAtiv(c, a, extra){
  const L = LUGARES[c];
  let vg = null, x = a.x, y = a.y, dir = a.dir;
  if (a.vaga){
    const livres = vagaLivre(c, a.vaga); if (!livres.length){ toast("Está tudo ocupado agora. Espera um pouquinho 😉"); return; }
    let esc = livres[0];
    if (extra && extra.vaga && livres.includes(extra.vaga)) esc = extra.vaga;
    else { const pr = livres.map(n => [n, Math.hypot(L.vagas[n].x - EU15.x, L.vagas[n].y - EU15.y)]).sort((q, r) => q[1] - r[1]); esc = pr[0][0]; }
    vg = esc; const v = L.vagas[esc]; x = v.x; y = v.y; dir = v.dir;
  }
  andarAte(x, y, () => {
    if (EU15.cena !== c) return;
    EU15.x = x; EU15.y = y; EU15.dir = dir;
    const def = Object.assign({}, a, extra || {}, { antes: a.preco ? () => gastar(a.preco, a.nome.toLowerCase()) : null, cancel: a.preco ? null : null,
      fim: () => {
        if (a.hab) ganharHab("condicionamento", a.hab);
        if (a.hab){ addEfeito("malhou", { quieto: 1 }); checarDesejos({ malhar: 1 }); }
        if (a.id === "b-moeda"){ toast(Math.random() < .3 ? "🪙 Pediu um desejo… e sentiu que vai dar certo ✨" : "🪙 Plim! Desejo feito."); }
        if (a.id === "b-cachorro") { sfx("latido"); if (temTraco("bichos")) addEfeito("bichinho", { quieto: 1 }); }
        if (a.id === "b-pipoca") { sfx("pipoca"); relMudar(pid, "npc-osvaldo", relBonus({ amizade: 2 })); }
        if (extra && extra.fim) extra.fim();
      } });
    EU15.vaga = vg; startAcao(def);
    if (me.acao){ me.acao.dir15 = dir; me.acao.vaga15 = vg; ref("jogadores/" + pid + "/acao").update({ dir15: dir, vaga15: vg }).catch(() => {}); }
  });
}
// academia: diária
const DIARIA = 5;
const diariaPaga = () => store.get("casinha-diaria15-" + sala) === brDia();
const brDia = () => { const a = brAgora(); return a.d.toISOString().slice(0, 10); };
function pagarDiaria(){ if (!gastar(DIARIA, "a diária da academia")) return false; store.set("casinha-diaria15-" + sala, brDia()); toast("🏋️ Diária paga! Bom treino 💪"); return true; }
// café: pedir no balcão e sentar
const CARDAPIO = { cafe: { nome: "Cafezinho", ic: "☕", preco: 5, ganho: { energia: 22, diversao: 6 }, id: "b-tomar-cafe" }, bolo: { nome: "Fatia de bolo", ic: "🍰", preco: 8, ganho: { fome: 30, diversao: 10 }, id: "b-tomar-bolo" }, pao: { nome: "Pão de queijo", ic: "🧀", preco: 4, ganho: { fome: 18 }, id: "b-tomar-pao" } };
function menuCafe(p){
  openMenu(p, "☕ Dona Neusa: \"O que vai ser?\"", Object.entries(CARDAPIO).map(([k, c]) => ({ nome: c.ic + " " + c.nome, info: "$" + c.preco, fn: () => pedirCafe(k) })));
}
function pedirCafe(k){
  const c = CARDAPIO[k], L = LUGARES.cafe;
  andarAte(226, 112, () => {
    if (EU15.cena !== "cafe") return; EU15.dir = "up";
    if (!gastar(c.preco, c.nome.toLowerCase())) return;
    falaNpc("npc-neusa", ["Saindo! " + c.ic, "Capricho pra você 💛", "Fresquinho! " + c.ic][Math.floor(Math.random() * 3)]); sfx("moeda");
    relMudar(pid, "npc-neusa", relBonus({ amizade: 1 }));
    // senta numa mesa (de preferência junto de quem está com você)
    const par = Object.entries(jogadores).find(([id, j]) => id !== pid && j && j.online && cenaDe(j) === "cafe" && j.acao && /^b-(tomar|mesa)/.test(j.acao.id || "") && j.acao.vaga15);
    let quero = null;
    if (par){ const m = L.mesas.find(ms => ms.includes(par[1].acao.vaga15)); if (m) quero = m.find(n => n !== par[1].acao.vaga15); }
    setTimeout(() => fazerAtiv("cafe", L.ativ[1], { id: c.id, nome: c.ic + " " + c.nome + " na mesa", dur: 14, ganho: c.ganho, vaga: quero, fim: () => cafeADois() }), 600);
  });
}
// encontro no café: os dois na mesma mesa ao mesmo tempo
function cafeADois(){
  const L = LUGARES.cafe, vg = EU15.vaga; if (!vg) return;
  const mesa = L.mesas.find(m => m.includes(vg)); if (!mesa) return;
  const outro = Object.entries(jogadores).find(([id, j]) => id !== pid && j && j.online && !j.visita && cenaDe(j) === "cafe" && j.acao && mesa.includes(j.acao.vaga15) && Date.now() - (j.acao.ini || 0) < (j.acao.dur || 0) + 8000);
  if (!outro) return;
  const k = "casinha-cafe2-" + sala + "-" + brDia() + "-" + outro[0];
  addEfeito("cafeDois"); relMudar(pid, outro[0], relBonus({ amizade: 3, romance: 4 })); checarDesejos({ cafeDois: 1 });
  if (store.get(k) !== "1"){ store.set(k, "1"); const par = [pid, outro[0]].sort().join("_"); txn("casa/bairro/cafe2/" + brDia() + "_" + par, v => v ? undefined : srvNow()).then(ok => { if (ok){ xpCasal(8); statMais("cafesDois"); } }); toastEspecial("☕💕 Encontro no café", "Um cafezinho a dois com " + outro[1].nome + ". Humor lá em cima!"); burst15(EU15.x, EU15.y, "heart"); sfx("beijo"); }
}
// mercado: carrinho e caixa (mais barato que a geladeira)
const carrinho15 = { itens: {}, vis: false };
const precoMercado = k => Math.max(2, Math.round(INGREDIENTES[k].preco * .7));
function openMercado(){
  if (!aberto("mercado")){ toast("🛒 " + horarioTxt15("mercado") + "."); return; }
  openPanel("mercado15", "Mercado Bom Preço 🛒", corpo => {
    const l = el("div", "list"), tot = el("p"), bb = el("div", "hbtns");
    corpo.append(el("p", "muted", "Uns 30% mais barato que pedir pela geladeira. Põe no carrinho e paga no caixa: vai tudo pra despensa de casa."), l, tot, bb);
    const upd = () => {
      l.textContent = ""; bb.textContent = "";
      for (const [k, ing] of Object.entries(INGREDIENTES)){
        const n = carrinho15.itens[k] || 0, row = el("div", "rowi"), tx = el("div", "tx");
        tx.append(el("strong", null, ing.nome + (n ? " · " + n + " no carrinho" : "")), el("small", null, "$" + precoMercado(k) + " (geladeira: $" + ing.preco + ") · em casa: " + (despensa[k] || 0)));
        const b = el("div", "bb10"); b.append(btn("−", "btn ghost small", () => { if (n) { carrinho15.itens[k] = n - 1; upd(); } }), btn("+", "btn small", () => { carrinho15.itens[k] = n + 1; upd(); }));
        b.children[0].setAttribute("aria-label", "Tirar " + ing.nome); b.children[1].setAttribute("aria-label", "Pôr " + ing.nome + " no carrinho");
        row.append(tx, b); l.append(row);
      }
      const total = Object.entries(carrinho15.itens).reduce((s, [k, v]) => s + precoMercado(k) * v, 0);
      tot.textContent = total ? "Total: $" + total : "O carrinho está vazio.";
      bb.append(btn("💳 Pagar no caixa" + (total ? " ($" + total + ")" : ""), "btn", () => pagarMercado()), btn("Continuar olhando", "btn ghost", closePanel));
    };
    upd(); return upd;
  });
}
function pagarMercado(){
  const total = Object.entries(carrinho15.itens).reduce((s, [k, v]) => s + precoMercado(k) * v, 0);
  if (!total){ toast("Põe alguma coisa no carrinho antes 🛒"); return; }
  if (visitando){ toast("Visita não gasta aqui 😉"); return; }
  closePanel();
  andarAte(222, 170, () => {
    if (EU15.cena !== "mercado") return; EU15.dir = "right";
    const quem = npcVis["npc-caio"] ? "npc-caio" : npcVis["npc-hideo"] ? "npc-hideo" : null;
    if (!quem){ toast("Não tem ninguém no caixa agora 😅"); return; }
    if (!gastar(total, "as compras")) return;
    const itens = Object.assign({}, carrinho15.itens);
    mexerDespensa(itens).then(ok => {
      if (!ok){ ganhar(total); toast("Não deu pra guardar agora."); return; }
      carrinho15.itens = {}; sfx("moeda"); falaNpc(quem, quem === "npc-caio" ? "Vai querer sacola? 🛍️" : "Volte sempre! 🍓");
      toast("🛒 Compras na despensa! -$" + total); relMudar(pid, quem, relBonus({ amizade: 1 })); refreshPanel("cozinha");
    });
  });
}

// =====================================================================
// 6. CARTÃO DA CENA (embaixo da tela) e porta de casa
// =====================================================================
const ruaCard = el("div", "card rua15"); ruaCard.id = "ruaCard"; ruaCard.hidden = true; ruaCard.setAttribute("aria-live", "polite");
viagemCard.after(ruaCard);
let ruaSig = "";
function syncRuaUI(forca){
  const on = naRuaOuLugar() && !feriasEu() && !viagemOn();
  const c = EU15.cena, a = brAgora(), min = Math.floor(a.h * 60);
  const aqui = on ? VIZ_IDS.filter(id => npcVis[id]).map(id => VIZ[id].nome).concat(Object.entries(jogadores).filter(([id, j]) => id !== pid && j && j.online && cenaDe(j) === c).map(([, j]) => j.nome)) : [];
  const sig = on ? [c, min, aqui.join(","), LUG_IDS.map(l => aberto(l) ? 1 : 0).join(""), carrinhoN()].join("|") : "";
  document.body.classList.toggle("fora15", on);
  if (!forca && sig === ruaSig) return; ruaSig = sig;
  ruaCard.hidden = !on; ruaCard.textContent = ""; if (!on) return;
  const clima = climaAgora(), ce = c === "rua" || c === "praca" ? (clima ? " · 🌧️" : darkness(horaRua()) > .3 ? " · 🌙" : " · ☀️") : "";
  const sub = el("p", "muted", "🕐 " + hhmm(a.h) + " · " + DIAS_NOME[a.dw] + ce + (aqui.length ? " · Aqui: " + nomesLista(aqui) : ""));
  const bb = el("div", "hbtns");
  if (c === "rua"){
    ruaCard.append(el("h2", null, "🏘️ Rua das Acácias"), sub);
    for (const l of LUG_IDS){ const G = LUGARES[l], b = btn(G.ic + " " + G.nome.split(" ")[0], "btn ghost", () => irAoLote(l)); b.setAttribute("aria-label", "Ir " + (l === "praca" ? "à " : "ao ") + G.nome + " (" + horarioTxt15(l) + ")"); if (!aberto(l)) b.classList.add("fechado15"); bb.append(b); }
    bb.append(btn("🏠 Entrar em casa", "btn", () => irAoLote("nos")));
  } else {
    const G = LUGARES[c];
    ruaCard.append(el("h2", null, G.ic + " " + G.nome), sub, el("p", "muted", horarioTxt15(c) + (c === "academia" ? " · diária $" + DIARIA + (diariaPaga() ? " (paga hoje ✓)" : "") : "")));
    for (const at of G.ativ){
      const b = btn(at.ic + " " + at.nome + (at.preco ? " ($" + at.preco + ")" : ""), "btn ghost", () => tocarAtiv(c, at, centroTela()));
      if ((at.aberto && !aberto(c)) || (at.precisa && !npcVis[at.precisa])) b.classList.add("fechado15");
      bb.append(b);
    }
    if (c === "mercado" && carrinhoN()) bb.append(btn("💳 Pagar (" + carrinhoN() + ")", "btn", pagarMercado));
    bb.append(btn("🚪 Voltar pra rua", "btn", sairDoLugar));
  }
  ruaCard.append(bb);
}
const carrinhoN = () => Object.values(carrinho15.itens).reduce((s, v) => s + v, 0);
function centroTela(){ const r = canvas.getBoundingClientRect(); return { x: W * T / 2, y: lo.height / 2, sx: r.width / 2, sy: r.height / 2 }; }
function menuPorta(p){
  const it = [{ nome: "Sair pra rua 🚶", info: "Rua das Acácias", fn: () => sairPraRua() }];
  for (const l of LUG_IDS){ const G = LUGARES[l]; it.push({ nome: "Ir " + (l === "praca" ? "à " : "ao ") + G.nome.split(" ")[0] + " " + G.ic, info: horarioTxt15(l), fn: () => sairPraRua(l) }); }
  openMenu(p, "Porta da rua", it);
}
const capachoSpr = () => sprite("capacho15", 14, 6, (ox, oy) => { rbox(ox, oy, 14, 6, "#B5814F"); R(ox + 1, oy + 1, 12, 4, "#C99A5E"); for (let i = 0; i < 6; i++) P(ox + 2 + i * 2, oy + 2 + (i % 2), "#9C6A44"); pixHeart(ox + 5, oy + 1, "#E8607A"); });
let capVis = null;

// =====================================================================
// 7. MÚSICA AMBIENTE (faixas novas) e humor, habilidade, desejos
// =====================================================================
function faixaMel15(fx, i){
  fx.mel = [];
  for (let s = 0; s < 64; s++){
    const bar = Math.floor(s / 8), pos = s % 8, se = bar >= 4 && bar < 6 ? s - 32 : s, h = hash(i + 11, se, 733), ch = (pos === 0 ? 62 : pos % 2 ? 14 : 40) * (fx.inst === "sino" ? .75 : 1);
    fx.mel.push(h % 100 >= ch || (bar % 4 === 3 && pos >= 6) ? null : { m: fx.escala[2 + (h >>> 8) % 5], d: 1 + (h >>> 13) % 3 });
  }
}
[
  { id: "praca15", nome: "Tarde na Praça", desc: "Pipoca, chafariz e passarinho", bpm: 96, inst: "piano", batida: 1, acordes: [[48, [55, 60, 64, 67]], [53, [57, 60, 65, 69]], [55, [59, 62, 67, 71]], [48, [55, 60, 64, 67]]], escala: [60, 62, 64, 67, 69, 72, 74, 76] },
  { id: "cafe15", nome: "Cafezinho", desc: "Bossinha de padaria", bpm: 78, inst: "piano", batida: 2, swing: .12, acordes: [[38, [57, 60, 65, 69]], [43, [59, 62, 65, 69]], [36, [59, 64, 67, 71]], [45, [57, 61, 64, 67]]], escala: [62, 64, 65, 67, 69, 72, 74, 77] },
  { id: "academia15", nome: "Pulsação", desc: "Pra suar a camisa", bpm: 124, inst: "piano", batida: 1, acordes: [[45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [48, [55, 60, 64, 67]], [43, [55, 59, 62, 67]]], escala: [57, 60, 62, 64, 67, 69, 72, 74] },
  { id: "mercado15", nome: "Corredor 7", desc: "Musiquinha de supermercado", bpm: 100, inst: "sino", batida: 2, acordes: [[41, [57, 60, 65, 69]], [46, [58, 62, 65, 70]], [48, [55, 60, 64, 67]], [41, [57, 60, 65, 69]]], escala: [65, 67, 69, 72, 74, 77, 79, 81] },
  { id: "festa15", nome: "Festa na Sala", desc: "Todo mundo dançando junto", bpm: 118, inst: "piano", batida: 1, acordes: [[48, [55, 60, 64, 67]], [45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [43, [55, 59, 62, 67]]], escala: [64, 67, 69, 72, 74, 76, 79, 81] },
  { id: "mar15", nome: "Brisa do Mar", desc: "Rede, coco e onda", bpm: 72, inst: "piano", batida: 2, acordes: [[40, [56, 59, 64, 68]], [45, [57, 61, 64, 69]], [47, [59, 63, 66, 71]], [40, [56, 59, 64, 68]]], escala: [64, 66, 68, 71, 73, 76, 78, 80] },
  { id: "serra15", nome: "Lareira na Serra", desc: "Chocolate quente e cobertor", bpm: 62, inst: "sino", acordes: [[38, [57, 62, 65, 69]], [46, [58, 62, 65, 70]], [41, [57, 60, 65, 69]], [48, [55, 60, 64, 67]]], escala: [62, 65, 67, 69, 72, 74, 77, 79] },
  { id: "cidade15", nome: "Luzes da Cidade", desc: "Jazz de terraço", bpm: 92, inst: "piano", batida: 1, swing: .15, acordes: [[39, [55, 58, 62, 67]], [36, [55, 58, 63, 67]], [41, [56, 60, 63, 68]], [46, [56, 58, 62, 65]]], escala: [63, 65, 67, 70, 72, 75, 77, 79] }
].forEach(fx => { FAIXAS.push(fx); faixaMel15(fx, FAIXAS.length - 1); });
{ const f0 = musicaAtiva; musicaAtiva = function(){
  const m = me ? { x: me.px, y: me.py, andar: andarAtual } : { x: 0, y: 0, andar: 0 }, mk = (id, desde) => ({ fx: FAIXAS.find(f => f.id === id), desde, mov: null, por: null, andar: andarAtual, m, jantar: false });
  const fe = feriasEu() ? FERIAS_DEST[ferias15.destino] : null;
  if (fe) return mk(fe.faixa, ferias15.ini);
  if (me && ehLugar(EU15.cena) && (EU15.cena === "praca" || aberto(EU15.cena))) return mk(LUGARES[EU15.cena].faixa, Math.floor(srvNow() / HORA) * HORA);
  if (me && EU15.cena === "rua") return null;
  if (festaRolando() && andarAtual === 0) return mk("festa15", festa15.ini);
  return f0();
}; }
Object.assign(EFEITOS, {
  cafeDois: { ic: "☕", nome: "Café a dois", v: 3, min: 180, txt: "Um cafezinho juntinho no Café Grão Doce." },
  malhou: { ic: "💪", nome: "Corpo em movimento", v: 2, min: 120, txt: "Treinou na academia." },
  festa15: { ic: "🎉", nome: "Que festão!", v: 4, min: 360, txt: "Deu uma festa em casa." },
  ferias15: { ic: "🧳", nome: "Férias inesquecíveis", v: 5, min: 3 * 24 * 60, txt: "Voltou de uma viagem de férias." }
});
HAB.condicionamento = { nome: "Condicionamento", ic: "🏃", sobe: "Esteira, pesos, saco de pancada e alongamento na academia", efeito: n => "cansa " + 3 * (n - 1) + "% menos ao treinar · " + (n >= 5 ? "fôlego de atleta" : "no nível 5: fôlego de atleta") };
Object.assign(DESEJOS, {
  malhar: { ic: "🏋️", pts: 110, peso: { aventureiro: 2, preguicoso: -.8 }, cria: () => ({ txt: "Malhar na academia" }), ok: ev => !!ev.malhar },
  cafeDois: { ic: "☕", pts: 130, peso: { romantico: 2.5, sociavel: 1 }, pode: () => !!parceiro() && !visitando, cria: () => { const o = parceiro(); return { alvo: o, txt: "Tomar um café com " + nomeDe(o) + " no Café" }; }, ok: ev => !!ev.cafeDois },
  vizinho: { ic: "🏘️", pts: 80, peso: { sociavel: 2.5, timido: -.6 }, cria: () => ({ txt: "Bater um papo com um vizinho na rua" }), ok: ev => aId(ev, /^b-conversa$/) },
  festa: { ic: "🎉", pts: 200, peso: { sociavel: 3, brincalhao: 1.5, caseiro: .5 }, pode: () => !visitando, cria: () => ({ txt: "Dar uma festa em casa" }), ok: ev => !!ev.festa }
});
// treino: quem tem condicionamento cansa menos
{ const f0 = startAcao; startAcao = function(a, mov, alvo){
  if (a && a.hab && a.ganho && a.ganho.energia < 0){ const n = habNv("condicionamento"); a = Object.assign({}, a, { ganho: Object.assign({}, a.ganho, { energia: Math.round(a.ganho.energia * (1 - .03 * (n - 1))) }) }); }
  return f0(a, mov, alvo);
}; }

// =====================================================================
// 8. FESTA EM CASA
// =====================================================================
let festa15 = null, festaFeita = null;
const festaAtiva = () => !!festa15 && srvNow() < festa15.ini + festa15.dur;
const festaRolando = () => !!festa15 && srvNow() >= festa15.ini && srvNow() < festa15.ini + festa15.dur;
const festaConv = f => Object.keys((f && f.conv) || {}).filter(k => VIZ[k]).sort().slice(0, B15.festaMax);
const COMIDA_FESTA = {
  salgadinhos: { nome: "Salgadinhos", ic: "🥟", preco: 30, porcoes: 10, ganho: { fome: 25, diversao: 10 } },
  pizzaF: { nome: "Pizza gigante", ic: "🍕", preco: 45, porcoes: 8, ganho: { fome: 40, diversao: 10 } },
  boloF: { nome: "Bolo de festa", ic: "🎂", preco: 35, porcoes: 10, ganho: { fome: 25, diversao: 18 } },
  bebidas: { nome: "Refri e suco", ic: "🥤", preco: 20, porcoes: 10, ganho: { fome: 8, energia: 10, diversao: 6 } }
};
for (const [k, c] of Object.entries(COMIDA_FESTA)) RECEITAS[k] = { nome: c.nome, ing: {}, dur: 0, porcoes: c.porcoes, ganho: c.ganho, delivery: 1 };
{ const f0 = drawPrato; drawPrato = function(rk, x, y){
  if (!COMIDA_FESTA[rk]) return f0(rk, x, y);
  rbox(x, y + 1, 9, 6, "#FFFFFF"); R(x + 1, y + 5, 7, 1, "#E6DDF0");
  if (rk === "salgadinhos"){ for (const [a, b] of [[2, 2], [5, 2], [3, 4], [6, 4]]) { R(x + a, y + b, 2, 2, "#E0A93A"); P(x + a, y + b, "#F2C56A"); } }
  else if (rk === "pizzaF"){ rbox(x + 1, y + 1, 7, 5, "#F2D58A"); for (const [a, b] of [[2, 2], [5, 3], [3, 4]]) P(x + a, y + b, "#D9483D"); }
  else if (rk === "boloF"){ R(x + 2, y + 1, 5, 4, "#F9C9D6"); R(x + 2, y + 1, 5, 1, "#FFFFFF"); P(x + 4, y, "#F6C667"); P(x + 3, y + 3, "#7FB8E8"); P(x + 5, y + 2, "#E8445E"); }
  else { R(x + 2, y, 2, 5, "#E8445E"); R(x + 5, y + 1, 2, 4, "#F6C667"); P(x + 2, y, "#FFFFFF"); P(x + 5, y + 1, "#FFFFFF"); }
}; }
{ const f0 = openPanel; openPanel = function(id, titulo, monta){
  if (id !== "cozinha") return f0(id, titulo, monta);
  const tira = corpo => { for (const row of corpo.querySelectorAll(".rowi")){ const st = row.querySelector("strong"); if (st && Object.values(COMIDA_FESTA).some(c => c.nome === st.textContent)) row.remove(); } };
  return f0(id, titulo, corpo => { const upd = monta(corpo); tira(corpo); return () => { if (upd) upd(); tira(corpo); }; });
}; }
function openFesta(){
  if (!me) return;
  if (visitando){ toast("Festa é coisa dos moradores 😉"); return; }
  openPanel("festa15", "Festa em casa 🎉", corpo => {
    const sel = new Set(), amg = new Set(), qtd = { salgadinhos: 1, bebidas: 1, pizzaF: 0, boloF: 0 }; let quando = 0;
    const box = el("div", "list");
    corpo.append(box);
    const upd = () => {
      box.textContent = "";
      const f = festa15, t = srvNow();
      if (f && t < f.ini + f.dur + 3 * MIN){
        const conv = festaConv(f), fim = t >= f.ini + f.dur;
        box.append(el("p", null, fim ? "A festa acabou! " + (f.nota ? "Nota: " + "★".repeat(f.nota.est) + "☆".repeat(5 - f.nota.est) : "Contando os pontos…") : t < f.ini ? "🎉 Festa marcada pras " + hhmm(brAgora(f.ini).h) + " (daqui a " + Math.ceil((f.ini - t) / 60000) + " min)." : "🎉 A festa está rolando! Até " + hhmm(brAgora(f.ini + f.dur).h) + "."));
        box.append(el("p", "muted", "Convidados: " + (conv.length ? nomesLista(conv.map(k => VIZ[k].nome)) : "só a casa") + (Object.keys(f.amigos || {}).length ? " · amigos do bairro: " + Object.keys(f.amigos).length + " casas" : "")));
        if (f.nota) box.append(el("p", null, "🎊 Animação " + f.nota.anim + " · 💃 Diversão " + f.nota.div + " · 🍽️ Comida " + f.nota.com));
        if (!fim){
          box.append(btn("💃 Dançar na festa", "btn", () => { closePanel(); dancarFesta(); }));
          const nao = VIZ_IDS.filter(k => !(f.conv || {})[k] && conhece(k));
          if (nao.length && conv.length < B15.festaMax) box.append(btn("Convidar mais vizinhos", "btn ghost", () => { closePanel(); openMenu(centroTela(), "Convidar", nao.slice(0, 8).map(k => ({ nome: VIZ[k].nome, fn: () => convidarFesta15(k) }))); }));
          if (f.por === pid && t < f.ini) box.append(btn("Cancelar a festa", "btn ghost", () => ref("casa/festa").remove().then(() => { toast("Festa cancelada."); closePanel(); })));
        }
        return;
      }
      box.append(el("p", "muted", "Escolha a hora, chame os vizinhos (os que vocês já conhecem) e amigos do bairro, e compre comida e bebida. Os pratos vão pra mesa, a música toca sozinha e a casa ganha decoração de festa."));
      const hq = el("div", "hbtns"); for (const [v, tx] of [[0, "Agora"], [60, "Daqui a 1 hora"]]){ const b = btn(tx, "btn ghost", () => { quando = v; upd(); }); b.setAttribute("aria-pressed", String(quando === v)); hq.append(b); }
      box.append(el("span", "lbl", "Quando"), hq, el("span", "lbl", "Vizinhos (até " + B15.festaMax + ")"));
      for (const k of VIZ_IDS){
        const ok = conhece(k), on = sel.has(k), b = btn("", "btn ghost escolha", () => { if (!ok) return toast("Conversem na rua antes de convidar 😉"); if (on) sel.delete(k); else if (sel.size < B15.festaMax) sel.add(k); upd(); });
        b.setAttribute("aria-pressed", String(on)); b.disabled = !ok;
        b.append(el("strong", null, (on ? "✅ " : "⬜ ") + VIZ[k].nome), el("small", null, ok ? estAmizade(relDe(pid, k)).ic + " " + estAmizade(relDe(pid, k)).nome : "Ainda não se conhecem"));
        box.append(b);
      }
      const viz = Object.entries(vizinhos).filter(([, v]) => v);
      if (viz.length){ box.append(el("span", "lbl", "Amigos do bairro (recebem o convite na casa deles)")); for (const [cod, v] of viz){ const on = amg.has(cod), b = btn("", "btn ghost escolha", () => { if (on) amg.delete(cod); else amg.add(cod); upd(); }); b.setAttribute("aria-pressed", String(on)); b.append(el("strong", null, (on ? "✅ " : "⬜ ") + (v.nome || "Casa do amigo")), el("small", null, on ? "Vai receber o convite" : "Não convidar")); box.append(b); } }
      box.append(el("span", "lbl", "Comida e bebida"));
      for (const [k, c] of Object.entries(COMIDA_FESTA)){
        const row = el("div", "rowi"), tx = el("div", "tx"); tx.append(el("strong", null, c.ic + " " + c.nome + (qtd[k] ? " × " + qtd[k] : "")), el("small", null, "$" + c.preco + " · " + c.porcoes + " porções"));
        const b = el("div", "bb10"); b.append(btn("−", "btn ghost small", () => { if (qtd[k]) { qtd[k]--; upd(); } }), btn("+", "btn small", () => { if (qtd[k] < 4) { qtd[k]++; upd(); } }));
        b.children[0].setAttribute("aria-label", "Menos " + c.nome); b.children[1].setAttribute("aria-label", "Mais " + c.nome);
        row.append(tx, b); box.append(row);
      }
      const total = Object.entries(qtd).reduce((s, [k, n]) => s + COMIDA_FESTA[k].preco * n, 0);
      box.append(el("p", null, "Total: $" + total + (temMovel("mesa", "piquenique") ? "" : " · coloque uma mesa pra servir os pratos")), btn("🎉 Marcar a festa", "btn", () => criarFesta([...sel], [...amg], qtd, quando, total)));
    };
    upd(); return upd;
  });
}
const conhece = k => { const r = relDe(pid, k); return !!r && ((r.n || 0) > 0 || (+r.amizade || 0) > 0); };
function criarFesta(conv, amigos, qtd, quando, total){
  if (festaAtiva()){ toast("Já tem festa marcada 🎉"); return; }
  if (!gastar(total, "a comida da festa")) return;
  const t = srvNow(), ini = t + quando * MIN + (quando ? 0 : 20000), c = {}; conv.forEach(k => c[k] = true);
  const am = {}; amigos.forEach(k => am[k] = true);
  txn("casa/festa", cur => cur && srvNow() < cur.ini + cur.dur ? undefined : { por: pid, ini, dur: B15.festaDur, conv: conv.length ? c : null, amigos: amigos.length ? am : null, comida: qtd, criada: t })
    .then(ok => {
      if (!ok){ ganhar(total); toast("Já tem festa marcada 🎉"); return; }
      closePanel(); sfx("fanfarra");
      for (const [k, n] of Object.entries(qtd)) for (let i = 0; i < n; i++) ref("casa/pratos").push({ receita: k, porcoes: COMIDA_FESTA[k].porcoes, por: pid, at: TS(), festa: 1 }).catch(() => {});
      const de = nomeCasa || nomeCasaPadrao();
      for (const cod of amigos) fdb.ref("salas/" + cod + "/casa/festaConvite/" + sala).set({ de, ini, fim: ini + B15.festaDur }).catch(() => {});
      toastEspecial("🎉 Festa marcada!", quando ? "Daqui a 1 hora. Os convidados chegam pela porta." : "Os convidados já estão chegando!");
      checarDesejos({ festa: 1 });
    });
}
function convidarFesta15(id){
  if (visitando){ toast("Festa é coisa dos moradores 😉"); return; }
  if (!festaAtiva()){ toast("Marque a festa primeiro (Diversão → Dar uma festa) 🎉"); openFesta(); return; }
  if ((festa15.conv || {})[id]){ falaNpc(id, "Já estou contando os minutos! 🎉"); return; }
  if (festaConv(festa15).length >= B15.festaMax){ toast("A casa já está cheia de convidados 😅"); return; }
  ref("casa/festa/conv/" + id).set(true).then(() => { falaNpc(id, "Opa, eu vou sim! 🎉"); toast(VIZ[id].nome + " vai na festa 🎉"); });
}
function dancarFesta(){
  if (!festaRolando()){ toast("A festa ainda não começou 🎉"); return; }
  if (naRuaOuLugar()) entrarEmCasa(true);
  const tl = festaTiles(); const alvo = tl.dance[(hashStr(pid) % Math.min(6, tl.dance.length))] || freeSpot();
  goTo(null, (x, y) => x === alvo[0] && y === alvo[1], () => { me.dir = "down"; startAcao({ id: "dancar-festa", nome: "Dançando na festa", dur: 20, ganho: { diversao: 30, social: 15, energia: -6 }, fim: () => festaPonto("danca") }); });
}
function festaPonto(k){ if (!festaRolando()) return; txn("casa/festa/pts/" + pid + "/" + k, v => (+v || 0) + 1); }
// rota de cada convidado: chega pela porta, dança, conversa, come e vai embora (puro do tempo, igual em todo aparelho)
const festaRotas = new Map();
function festaTiles(){
  const l = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (walkable(x, y) && y <= linhaSaida()) l.push([x, y]);
  const mid = Object.keys(moveis).find(k => moveis[k] && ["mesa", "piquenique"].includes(baseT(moveis[k].t)));
  const perto = mid ? adjTo(moveis[mid]) : null, eat = perto ? l.filter(([x, y]) => perto(x, y)) : [];
  const aberto4 = ([x, y]) => walkable(x + 1, y) && walkable(x - 1, y) && walkable(x, y + 1) && walkable(x, y - 1);
  let sl = l.filter(q => comodo(q[0], q[1]) === "sala" && aberto4(q)); if (sl.length < 6) sl = l.filter(aberto4); if (sl.length < 6) sl = l;
  const cx = sl.reduce((s, q) => s + q[0], 0) / Math.max(1, sl.length), cy = sl.reduce((s, q) => s + q[1], 0) / Math.max(1, sl.length);
  const dance = sl.slice().sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy) + (a[0] - b[0]) * .001);
  return { dance, eat: eat.length ? eat : dance.slice(-6), mesa: mid };
}
function festaRota(f, i, gid, n){
  const key = f.ini + "|" + gid + "|" + i + "|" + n + "|" + Object.keys(moveis).length + "|" + H + "|" + andarAtual;
  let r = festaRotas.get(key); if (r) return r;
  const e = entradaTile(); if (!e) return null;
  const tl = festaTiles(), segs = [], PASSO = 420, BL = 40000, arr = 4000 + i * 6000, sai = f.dur - 4000 - (n - 1 - i) * 3000;
  let cur = e, tc = arr;
  segs.push({ k: "entra", at: e, ini: tc - 900, dur: 900 });
  const anda = path => { if (!path || !path.length) return; const pts = [cur].concat(path); segs.push({ k: "anda", pts, ini: tc, dur: path.length * PASSO }); tc += path.length * PASSO; cur = path[path.length - 1]; };
  for (let b = 0; tc < sai - 6000 && b < 40; b++){
    const act = b === 0 ? "papo" : ["danca", "papo", "come", "danca"][hash(i, b, f.ini % 9973) % 4];
    const lst = act === "come" ? tl.eat : tl.dance, tgt = lst[(i * 3 + b * 5 + (act === "papo" ? 7 : 0)) % Math.max(1, Math.min(act === "danca" ? 10 : lst.length, lst.length))];
    if (tgt) anda(bfsDe(cur[0], cur[1], tgt[0], tgt[1]));
    const fica = Math.min(BL, sai - tc); if (fica <= 0) break;
    segs.push({ k: "fica", at: cur, act, ini: tc, dur: fica, mesa: tl.mesa }); tc += fica;
  }
  anda(bfsDe(cur[0], cur[1], e[0], e[1]));
  segs.push({ k: "sai", at: e, ini: tc, dur: 900 });
  r = { segs }; festaRotas.set(key, r); if (festaRotas.size > 40) festaRotas.clear();
  return r;
}
function festaGuestEstado(f, i, gid, n, t){
  const r = festaRota(f, i, gid, n); if (!r) return null;
  const dt = t - f.ini;
  for (const s of r.segs){
    if (dt < s.ini || dt >= s.ini + s.dur) continue;
    if (s.k === "entra") return { x: s.at[0], y: s.at[1], dir: "up", alpha: (dt - s.ini) / s.dur };
    if (s.k === "sai") return { x: s.at[0], y: s.at[1], dir: "down", alpha: 1 - (dt - s.ini) / s.dur };
    if (s.k === "fica"){ let dir = "down"; if (s.act === "come" && s.mesa && moveis[s.mesa]){ const m = moveis[s.mesa], c = CAT[m.t], mx = m.x + c.w / 2 - .5, my = m.y + c.h / 2 - .5, dx = mx - s.at[0], dy = my - s.at[1]; dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"; } else if (s.act === "papo") dir = ["left", "right", "down"][(i + Math.floor(dt / 9000)) % 3]; return { x: s.at[0], y: s.at[1], dir, act: s.act, alpha: 1 }; }
    const p = (dt - s.ini) / 420, k = Math.min(Math.floor(p), s.pts.length - 2), fr = p - k, a = s.pts[k], b = s.pts[k + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return { x: a[0] + dx * fr, y: a[1] + dy * fr, dir: dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up", anda: 1, alpha: 1 };
  }
  return null;
}
let festaVis = [];
function addFestaGuests(objs, tm){
  festaVis = [];
  if (!festaRolando() || andarAtual !== 0) return;
  const f = festa15, t = srvNow(), conv = festaConv(f);
  conv.forEach((gid, i) => {
    const st = festaGuestEstado(f, i, gid, conv.length, t); if (!st) return;
    const cx = Math.round((st.x + .5) * T), by = Math.round((st.y + 1) * T - 3), k = hashStr(gid) % 97;
    let pose = "stand", frame = st.anda ? Math.floor(tm / 115) % 4 : 0;
    if (st.act === "danca"){ pose = Math.floor(tm / 260) % 2 ? "arms" : "stand"; frame = Math.floor(tm / 260) % 2 ? 1 : 3; } // mesmo passo de quem dança no som: todo mundo junto
    else if (!st.anda) pose = (tm + k * 377) % 3700 < 140 ? "blink" : Math.floor((tm + k * 211) / 800) % 2 ? "breath" : "stand";
    objs.push({ z: by, f: () => {
      ctx.globalAlpha = clamp(st.alpha, 0, 1);
      blitNpc(gid, cx, by, st.act === "danca" ? "down" : st.dir, frame, pose);
      if (st.act === "come"){ ctx.drawImage(pratoSprite(["salgadinhos", "pizzaF", "boloF", "bebidas"][k % 4]).c, cx + (st.dir === "left" ? -10 : 2), by - 12); }
      ctx.globalAlpha = 1;
    } });
    if (st.act === "danca" && Math.random() < .015) particles.push({ x: cx, y: by - 24, vx: Math.random() * 8 - 4, vy: -10, life: 1.4, kind: "note" });
    festaVis.push({ id: gid, cx, by, act: st.act, nome: VIZ[gid].nome, teen: VIZ[gid].teen });
  });
}
function vigiarFesta(){
  const f = festa15; if (!f || !me) return;
  const t = srvNow(), fim = f.ini + f.dur;
  if (t >= fim && !f.nota && !visitando && !festaTentou.has("n" + f.ini)){
    festaTentou.add("n" + f.ini);
    const conv = festaConv(f), pts = Object.values(f.pts || {}), soma = k => pts.reduce((s, p) => s + (+(p || {})[k] || 0), 0);
    const pessoas = conv.length + Math.max(1, moradores().length), porc = Object.entries(f.comida || {}).reduce((s, [k, n]) => s + (COMIDA_FESTA[k] ? COMIDA_FESTA[k].porcoes * n : 0), 0);
    const anim = clamp(Math.round(conv.length * 11 + soma("danca") * 9 + Object.keys(f.amigos || {}).length * 8 + 12), 0, 100);
    const div = clamp(Math.round(30 + soma("danca") * 10 + soma("papo") * 9 + conv.length * 3), 0, 100);
    const com = clamp(Math.round(porc / pessoas / 2 * 100 + soma("comeu") * 6), 0, 100);
    const est = clamp(Math.round((anim + div + com) / 60), 1, 5);
    txn("casa/festa/nota", c => c ? undefined : { anim, div, com, est }).then(ok => {
      if (!ok) return;
      historia("festa_" + f.ini, "🎉", "Festa em casa com " + (conv.length ? nomesLista(conv.map(k => VIZ[k].nome)) : "a família") + " · " + "★".repeat(est) + "☆".repeat(5 - est));
      statMais("festas"); if (est >= 5) statMais("festa5"); xpCasal(10 + est * 4);
      for (const k of conv) relMudar(f.por, k, { amizade: 4 + est, semConta: 1 });
    });
  }
  if (f.nota && festaFeita !== f.ini && t < fim + 3 * MIN && !visitando){
    festaFeita = f.ini;
    const k = "casinha-festa15-" + sala + "-" + f.ini;
    if (store.get(k) !== "1"){ store.set(k, "1"); const n = f.nota, din = n.est * 15; ganhar(din); addEfeito("festa15"); confete(); sfx("fanfarra");
      toastEspecial("🎉 Festa nota " + "★".repeat(n.est) + "☆".repeat(5 - n.est), "Animação " + n.anim + " · Diversão " + n.div + " · Comida " + n.com + " · +$" + din); }
  }
  if (t > fim + 3 * MIN && f.por === pid) ref("casa/festa").remove().catch(() => {});
  else if (t > fim + 10 * MIN) ref("casa/festa").remove().catch(() => {});
}
const festaTentou = new Set();
function festaAvancar(min){ return festa15 ? ref("casa/festa/ini").set(festa15.ini - min * MIN) : null; }
// convite de festa na casa de amigo (eu sou o convidado)
let festaConvites = {};
function festaConviteAtivo(){ const t = srvNow(); return Object.entries(festaConvites).filter(([, c]) => c && t < c.fim).sort((a, b) => a[1].ini - b[1].ini)[0] || null; }

// =====================================================================
// 9. FÉRIAS DE VÁRIOS DIAS
// =====================================================================
let ferias15 = null, feCarregado = false, feUltSig = "", feChegou = null;
const FERIAS_DEST = {
  praia: { nome: "Praia", lugar: "Hotel Maré Mansa", em: "🏖️", custo: 70, faixa: "mar15", cena: "praia", quarto: "quartoPraia", txt: "na praia",
    dias: [
      [["mar", "Banho de mar 🌊"], ["castelo", "Castelo de areia 🏰"], ["coco", "Água de coco 🥥"], ["por", "Pôr do sol na areia 🌅"]],
      [["surfe", "Aula de surfe 🏄"], ["frescobol", "Frescobol 🏓"], ["picole", "Picolé 🍦"], ["luau", "Luau com violão 🎸"]],
      [["barco", "Passeio de barco ⛵"], ["mergulho", "Mergulho com peixinhos 🐠"], ["rede", "Rede na varanda 😌"], ["golfinho", "Golfinhos à vista! 🐬"]],
      [["feira", "Feirinha de artesanato 🧺"], ["orla", "Caminhada na orla 👟"], ["acai", "Açaí 🍧"], ["fogos", "Fogos na praia 🎆"]],
      [["massagem", "Massagem no hotel 💆"], ["pesca", "Pescaria 🎣"], ["pier", "Foto no píer 📷"], ["jantar", "Jantar à beira-mar 🕯️"]]],
    lembr: [["concha15", "Concha gigante", 35], ["barco15", "Barquinho na garrafa", 55]] },
  montanha: { nome: "Montanha", lugar: "Chalé da Neblina", em: "🏔️", custo: 55, faixa: "serra15", cena: "montanha", quarto: "quartoMontanha", txt: "na montanha",
    dias: [
      [["trilha", "Trilha no mato 🥾"], ["fondue", "Fondue de queijo 🧀"], ["lareira", "Esquentar na lareira 🔥"], ["neblina", "Neblina mágica 🌫️"]],
      [["cachoeira", "Cachoeira gelada 💦"], ["chocolate", "Chocolate quente ☕"], ["cavalo", "Cavalgada 🐴"], ["estrelas", "Céu estrelado ✨"]],
      [["morango", "Colher morangos 🍓"], ["bike", "Bicicleta na estrada 🚲"], ["vinho", "Suco de uva da serra 🍇"], ["festival", "Festival de inverno 🎪"]],
      [["tirolesa", "Tirolesa 🧗"], ["pinhao", "Pinhão na brasa 🌰"], ["leitura", "Livro na varanda 📖"], ["sol", "Nascer do sol no mirante 🌄"]],
      [["pesca", "Pesca no lago 🎣"], ["artesanato", "Feira de malhas 🧶"], ["sopa", "Sopa no caldeirão 🍲"], ["baile", "Baile no salão da vila 💃"]]],
    lembr: [["lampiao15", "Lampião de chalé", 45], ["pinhas15", "Vaso de pinhas", 30]] },
  cidade: { nome: "Cidade grande", lugar: "Hotel Mirante", em: "🌆", custo: 85, faixa: "cidade15", cena: "cidade", quarto: "quartoCidade", txt: "na cidade grande",
    dias: [
      [["museu", "Museu de arte 🖼️"], ["compras", "Compras no centro 🛍️"], ["lanche", "Lanche de rua 🌭"], ["terraco", "Vista do terraço 🌃"]],
      [["parque", "Piquenique no parque 🌳"], ["metro", "Andar de metrô 🚇"], ["sorvete", "Sorvete italiano 🍨"], ["teatro", "Musical no teatro 🎭"]],
      [["aquario", "Aquário gigante 🐋"], ["livraria", "Livraria enorme 📚"], ["cafe", "Café chique ☕"], ["show", "Show ao vivo 🎤"]],
      [["roda", "Roda-gigante 🎡"], ["feira", "Feira gastronômica 🍜"], ["bike", "Ciclovia 🚲"], ["luzes", "Festival de luzes 💡"]],
      [["mercadao", "Mercadão 🥭"], ["fotos", "Fotos nos pontos turísticos 📸"], ["spa", "Spa do hotel 💆"], ["jantar", "Jantar no restaurante giratório 🍽️"]]],
    lembr: [["globo15", "Globo de neve", 40], ["torre15", "Miniatura da torre", 60]] }
};
const QUARTO_ATIV = [["dormir", "Dormir 😴", 20, { energia: 60 }], ["cafeManha", "Café da manhã 🥐", 8, { fome: 50, energia: 5 }], ["banho", "Banho 🚿", 8, { higiene: 60 }]];
const feAtivo = () => !!ferias15 && (ferias15.estado === "convite" || ferias15.estado === "viajando");
const feVai = id => !!(ferias15 && ferias15.vai && ferias15.vai[id]);
const feViajando = () => !!ferias15 && ferias15.estado === "viajando";
const feriasEu = () => !!me && feViajando() && feVai(pid);
const feIds = () => ferias15 ? Object.keys(ferias15.vai || {}).filter(id => jogadores[id] && jogadores[id].nome).sort() : [];
const feDia = () => ferias15 && ferias15.ini ? clamp(Math.floor((srvNow() - ferias15.ini) / B15.dia), 0, (ferias15.dias || 1) - 1) : 0;
const feArea = id => ((ferias15 && ferias15.area) || {})[id] || "fora";
// a casa ficou sem ninguém: vó (filhos) e vizinha (bichinhos) cuidam
const feCasaVazia = () => feViajando() && !moradores().some(([id]) => !feVai(id));
const feCuida = t => !!ferias15 && feViajando() && (t || srvNow()) >= (ferias15.ini || 0);
function openFerias(){
  if (!me) return;
  if (visitando){ toast("Férias são dos moradores 😉"); return; }
  if (feAtivo()){
    const f = ferias15;
    if (f.estado === "convite" && f.conv && f.conv[pid] === true) return aceitarFerias();
    if (f.estado === "convite" && f.por === pid){ toast("Esperando a resposta do convite 🧳"); return; }
    if (f.estado === "viajando" && !feVai(pid)){ toast("🧳 " + nomesLista(feIds().map(nomeDe)) + " " + (feIds().length > 1 ? "estão" : "está") + " de férias " + FERIAS_DEST[f.destino].txt + "."); return; }
  }
  if (!podeSair()) return;
  const cands = moradores().filter(([id, j]) => id !== pid && j.online), sel = new Set(cands.map(([id]) => id)); let dest = "praia", dias = 3;
  openPanel("ferias15", "Férias 🧳", corpo => {
    const box = el("div", "list"); corpo.append(box);
    const upd = () => {
      box.textContent = "";
      box.append(el("p", "muted", "Uma viagem de vários dias (dias de verdade). Quem for abre o jogo direto no destino: tem quarto, atividades diferentes a cada dia, um evento especial por dia, fotos e lembrancinhas que viram decoração em casa."));
      const g = el("div", "dest10");
      for (const [k, d] of Object.entries(FERIAS_DEST)){ const b = btn("", "btn ghost escolha", () => { dest = k; upd(); }); b.setAttribute("aria-pressed", String(dest === k)); b.append(el("strong", null, (dest === k ? "✅ " : "") + d.em + " " + d.nome), el("small", null, d.lugar + " · $" + d.custo + "/dia por pessoa")); g.append(b); }
      box.append(el("span", "lbl", "Destino"), g, el("span", "lbl", "Quantos dias"));
      const dd = el("div", "hbtns"); for (const n of [2, 3, 4, 5]){ const b = btn(n + " dias", "btn ghost", () => { dias = n; upd(); }); b.setAttribute("aria-pressed", String(dias === n)); dd.append(b); } box.append(dd);
      if (cands.length){ box.append(el("span", "lbl", "Chamar junto")); for (const [id, j] of cands){ const on = sel.has(id), b = btn("", "btn ghost escolha", () => { if (on) sel.delete(id); else sel.add(id); upd(); }); b.setAttribute("aria-pressed", String(on)); b.append(el("strong", null, (on ? "✅ " : "⬜ ") + j.nome), el("small", null, on ? "Vai receber o convite" : "Fica em casa")); box.append(b); } }
      else box.append(el("p", "muted", "Ninguém mais está online agora. Dá pra ir sozinho(a), ou esperar o outro entrar pra convidar."));
      const total = FERIAS_DEST[dest].custo * dias * (1 + sel.size);
      const quem = temFilhos() ? (babaInfo() ? "A Tia Lu (babá) cuida das crianças" : "As crianças ficam com a vó Zezé") : "";
      box.append(el("p", "muted", [quem, pet || Object.keys(pets).length ? "os bichinhos ficam com a Lívia, a vizinha veterinária" : ""].filter(Boolean).join("; ") + (quem || pet ? ". Nada de ruim acontece em casa enquanto vocês viajam." : "")));
      box.append(el("p", null, "Total: $" + total + " (você paga)"), btn(sel.size ? "Convidar e esperar 🧳" : "Partir 🧳", "btn", () => criarFerias(dest, dias, [...sel], total)));
    };
    upd(); return upd;
  });
}
function criarFerias(dest, dias, conv, total){
  if (me.dinheiro < total){ toast("Faltam $" + Math.ceil(total - me.dinheiro) + " pra viagem."); return; }
  if (psAtivo()){ toast("O carro está ocupado agora 🚗"); return; }
  const c = {}; conv.forEach(id => c[id] = true);
  txn("casa/ferias", cur => cur && (cur.estado === "convite" || cur.estado === "viajando") ? undefined : { por: pid, estado: "convite", criado: srvNow(), destino: dest, dias, vai: { [pid]: true }, conv: conv.length ? c : null })
    .then(ok => { if (!ok){ toast("Já tem uma viagem rolando 🧳"); return; } closePanel(); if (!conv.length) partirFerias(); else { toast("Convite enviado 🧳 Esperando " + nomesLista(conv.map(nomeDe)) + "."); sfx("pop"); } });
}
function aceitarFerias(){ txn("casa/ferias", cur => { if (!cur || cur.estado !== "convite" || !cur.conv || cur.conv[pid] !== true) return; delete cur.conv[pid]; cur.vai = cur.vai || {}; cur.vai[pid] = true; return cur; }).then(ok => toast(ok ? "Bora! 🧳 Fazendo as malas..." : "Esse convite já era.")); }
function recusarFerias(){ txn("casa/ferias", cur => { if (!cur || cur.estado !== "convite" || !cur.conv || cur.conv[pid] !== true) return; cur.conv[pid] = false; return cur; }); }
function cancelarFerias(){ txn("casa/ferias", cur => { if (!cur || cur.estado !== "convite") return; cur.estado = "cancelado"; cur.fimAt = srvNow(); return cur; }); }
let fePartindo = 0;
function partirFerias(){
  if (fePartindo && Date.now() - fePartindo < 5000) return; fePartindo = Date.now();
  const f = ferias15; if (!f || f.estado !== "convite" || f.por !== pid) return;
  const n = Object.keys(f.vai || {}).length, total = FERIAS_DEST[f.destino].custo * f.dias * n;
  if (!gastar(total, "a viagem")){ cancelarFerias(); return; }
  txn("casa/ferias", cur => { if (!cur || cur.estado !== "convite" || cur.por !== pid) return; const t = srvNow(); cur.estado = "viajando"; cur.ini = t; cur.volta = t + cur.dias * B15.dia; delete cur.conv; return cur; })
    .then(ok => { if (!ok){ ganhar(total); return; } toast("-$" + total + ". Boa viagem! 🧳✈️"); });
}
function voltarFerias(){ txn("casa/ferias", cur => { if (!cur || cur.estado !== "viajando" || !cur.vai || !cur.vai[pid]) return; cur.estado = "fim"; cur.fimAt = srvNow(); return cur; }); }
function feriasAvancar(dias){ const f = ferias15; if (!f || !f.ini) return null; const d = dias * B15.dia; return ref("casa/ferias").update({ ini: f.ini - d, volta: f.volta - d }); }
function vigiarFerias(){
  const f = ferias15; if (!me || !f || visitando) return;
  const t = srvNow();
  if (f.estado === "convite"){
    const pend = Object.entries(f.conv || {}).filter(([, v]) => v === true), aceitos = Object.keys(f.vai || {}).length;
    if (f.por === pid){
      if (!pend.length && aceitos > 0 && (Object.keys(f.conv || {}).length === 0 || aceitos > 1)) partirFerias();
      else if (!pend.length){ cancelarFerias(); toast("Ninguém pôde ir… fica pra próxima 🧳"); }
      else if (t - (f.criado || 0) > B15.feriasConvite){ if (aceitos > 1) partirFerias(); else { cancelarFerias(); toast("Ninguém respondeu… fica pra próxima 🧳"); } }
    } else if (t - (f.criado || 0) > B15.feriasConvite + 60000) cancelarFerias();
  } else if (f.estado === "viajando" && t >= (f.volta || 0)) txn("casa/ferias", cur => { if (!cur || cur.estado !== "viajando" || srvNow() < (cur.volta || 0)) return; cur.estado = "fim"; cur.fimAt = srvNow(); return cur; });
  else if (f.estado === "fim"){
    if (feVai(pid) && feChegou !== f.ini && !(f.chegou || {})[pid]){ feChegou = f.ini; chegarDeFerias(f); }
    if (!f.contado && !feTentou.has(f.ini)){ feTentou.add(f.ini); contarFerias(f); }
    const todos = Object.keys(f.vai || {}).every(id => (f.chegou || {})[id]);
    if ((todos && t - (f.fimAt || 0) > 5 * MIN) || t - (f.fimAt || 0) > 3 * B15.dia) txn("casa/ferias", cur => cur && cur.estado === "fim" && cur.contado ? null : undefined);
  } else if (f.estado === "cancelado" && t - (f.fimAt || 0) > 20000) txn("casa/ferias", cur => cur && cur.estado === "cancelado" ? null : undefined);
}
const feTentou = new Set();
function chegarDeFerias(f){
  ref("casa/ferias/chegou/" + pid).set(srvNow()).catch(() => {});
  entrarEmCasa(true);
  addEfeito("ferias15"); ganharNeeds({ diversao: 40, social: 30 });
  const d = FERIAS_DEST[f.destino];
  toastEspecial(d.em + " De volta das férias!", "Férias inesquecíveis " + d.txt + ". A casa estava esperando por vocês 🏡"); confete(); sfx("fanfarra");
}
function contarFerias(f){
  txn("casa/ferias/contado", c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    const d = FERIAS_DEST[f.destino], dias = clamp(Math.ceil(((f.fimAt || srvNow()) - f.ini) / B15.dia), 1, f.dias || 1);
    historia("ferias_" + f.ini, d.em, nomesLista(Object.keys(f.vai || {}).map(nomeDe)) + " passaram " + dias + (dias > 1 ? " dias " : " dia ") + d.txt + " (" + d.lugar + ")");
    statMais("ferias"); xpCasal(25);
    // lembrancinhas: viram decoração exclusiva (no catálogo e uma de cada já posta em casa)
    for (const k of Object.keys(f.lembr || {})){
      if (!CAT[k]) continue;
      ref("casa/loja/" + k).set(true).catch(() => {});
      if (andarAtual === 0 && casaOk){ const pos = lugarPerto(k, 9, 6); if (pos) ref("casa/moveis").push({ t: k, x: pos[0], y: pos[1], por: f.lembr[k] }).catch(() => {}); }
    }
    // vó e vizinha devolvem filhos e bichinhos bem cuidados
    const t = srvNow(), up = {};
    for (const fid of (typeof famOrdem === "function" ? famOrdem() : [])){ const fl = filhos[fid]; if (!fl) continue; if (ehInfante(fl)){ up["filhos/" + fid + "/fome"] = t; up["filhos/" + fid + "/fralda"] = t; up["filhos/" + fid + "/carinho"] = t; } else { up["filhos/" + fid + "/comeu"] = t; up["filhos/" + fid + "/brincou"] = t; } }
    for (const [id, p] of Object.entries(pets || {})){ if (!p) continue; up["pets/" + id + "/comeu"] = t; up["pets/" + id + "/carinho"] = t; const d13 = PET13[p.tipo]; if (d13 && d13.ch) up["pets/" + id + "/" + d13.ch] = t; }
    if (Object.keys(up).length) ref("casa").update(up).catch(() => {});
  });
}
function feAtiv(aid, nome, dur, ganho, especial){
  const f = ferias15; if (!feriasEu()) return;
  const dia = feDia(), k = dia + "_" + pid + "_" + aid;
  if (especial && ((f.evento || {})[dia + "_" + pid])){ toast("O evento de hoje já foi ✨ Amanhã tem outro!"); return; }
  ref("casa/ferias/ativ/" + pid).set({ id: aid, at: TS() }).catch(() => {});
  startAcao({ id: "fe-" + aid, nome, dur, ganho, fim: () => {
    if (especial){ ref("casa/ferias/evento/" + dia + "_" + pid).set(1).catch(() => {}); confete(); sfx("fanfarra"); toastEspecial("✨ " + nome, "Um momento especial das férias!"); historia("ferias_" + f.ini + "_d" + dia, FERIAS_DEST[f.destino].em, nome.replace(/\s\S+$/, "") + " (dia " + (dia + 1) + " das férias)"); xpCasal(6); }
    else if (!(f.feitos || {})[k]){ ref("casa/ferias/feitos/" + k).set(1).catch(() => {}); ganharNeeds({ diversao: 10, social: 6 }); }
  } });
}
function feTrocaArea(a){ ref("casa/ferias/area/" + pid).set(a).catch(() => {}); if (me.acao) setAcao(null); }
function openLembrancinhas(){
  const f = ferias15; if (!feriasEu()) return; const d = FERIAS_DEST[f.destino];
  openPanel("lembr15", "Lembrancinhas " + d.em, corpo => {
    corpo.append(el("p", "muted", "Viram decoração exclusiva em casa quando vocês voltarem (e ficam no catálogo pra sempre)."));
    const l = el("div", "list"); corpo.append(l);
    const upd = () => {
      l.textContent = "";
      for (const [k, nome, preco] of d.lembr){
        const tem = (ferias15.lembr || {})[k], row = el("div", "rowi"), tx = el("div", "tx"), cv = el("canvas"); cv.width = 32; cv.height = 40; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false; const s = furnSprite(k, 0); x.drawImage(s.c, Math.round((32 - s.c.width * 2) / 2), Math.round((40 - s.c.height * 2) / 2), s.c.width * 2, s.c.height * 2);
        cv.setAttribute("aria-hidden", "true"); tx.append(el("strong", null, nome), el("small", null, tem ? "Comprado ✓" + (tem !== pid ? " por " + nomeDe(tem) : "") : "$" + preco));
        row.append(cv, tx, tem ? el("span", "muted", "🎁") : btn("Comprar", "btn small", () => { if (!gastar(preco, "a lembrancinha")) return; txn("casa/ferias/lembr/" + k, c => c ? undefined : pid).then(ok => { if (!ok){ ganhar(preco); toast("Alguém já comprou essa."); } else { toast("🎁 " + nome + " na mala!"); sfx("moeda"); } }); }));
        l.append(row);
      }
    };
    upd(); return upd;
  });
}
function fotoFerias(){
  if (!feriasEu()) return;
  try { drawFerias(performance.now()); } catch(e){}
  const d = FERIAS_DEST[ferias15.destino], w = lo.width, h = lo.height, pad = 5, base = 13;
  const c = document.createElement("canvas"); c.width = w + pad * 2; c.height = h + pad + base;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  withCtx(x, 1, () => { R(0, 0, c.width, c.height, "#FFF6E8"); for (let i = 3; i < c.width - 3; i += 6) P(i, 2, "#E8A94A"); ctx.drawImage(lo, pad, pad); const dt = new Date(srvNow()); txt3(pad2(dt.getDate()) + "/" + pad2(dt.getMonth() + 1) + "/" + dt.getFullYear(), pad + 1, h + pad + 4, "#8C7A9A"); pixHeart(c.width - pad - 10, h + pad + 4, "#E8607A"); });
  const fl = el("div", "flash9"); $("stage").append(fl); setTimeout(() => fl.remove(), 500); sfx("foto");
  const url = codificarFoto(c); if (!url){ toast("A foto ficou pesada demais 😅"); return; }
  openFotoNova(url, c.width, c.height);
  const inp = painel && painel.el.querySelector("input"); if (inp) inp.value = d.em + " Férias " + d.txt + " · dia " + (feDia() + 1);
}
// cenas novas (montanha e os quartos), no mesmo formato das do passeio de carro
CENAS.montanha = { ceu: "#A9D3EE", bg(){
  for (const [y0, y1, c] of [[0, 30, "#A9D3EE"], [30, 60, "#BCDCF0"], [60, 90, "#D2E7F4"]]) R(0, y0, 288, y1 - y0, c);
  for (let x = 0; x < 288; x += 2){ const h1 = 70 + Math.abs(((x + 40) % 160) - 80) * .7, h2 = 96 + Math.abs(((x + 110) % 120) - 60) * .6; R(x, h1, 2, 208 - h1, "#8E9BB8"); if (h1 < 90) R(x, h1, 2, 4, "#FFFFFF"); R(x, h2, 2, 208 - h2, "#6F8F78"); }
  R(0, 140, 288, 68, "#7DB862"); for (let i = 0; i < 160; i++){ const h = hash(i, 4, 44); P(h % 288, 142 + (h >>> 9) % 64, i % 2 ? "#6DAA55" : "#97CE80"); }
  for (let i = 0; i < 9; i++){ const x = 10 + i * 34 + hash(i, 1, 2) % 10, b = 150 + hash(i, 2, 3) % 20; for (let k = 0; k < 6; k++) R(x - k * 2, b - 30 + k * 5, 4 + k * 4, 5, k % 2 ? "#2F6B45" : "#3F8F56"); R(x + 1, b, 2, 6, "#6B4429"); }
  rbox(196, 120, 64, 44, "#9C6644"); for (let i = 0; i < 18; i++) R(192 + i, 120 - i, 72 - i * 2, 1, i % 3 ? "#7A4A2E" : "#5E3A22"); R(222, 140, 12, 24, "#5E3A22"); rbox(202, 132, 12, 10, "#F6D77A"); rbox(242, 132, 12, 10, "#F6D77A"); R(244, 96, 6, 12, "#7A7A7A");
}, anim(tm){ for (let i = 0; i < 4; i++){ const x = ((tm / 90 + i * 80) % 340) - 30; ctx.globalAlpha = .5; rbox(Math.round(x), 50 + i * 9, 40, 6, "#FFFFFF"); ctx.globalAlpha = 1; } const f = (tm / 400) % 1; ctx.globalAlpha = 1 - f; P(247, 92 - Math.round(f * 14), "#E6E6E6"); P(248, 88 - Math.round(f * 18), "#D6D6D6"); ctx.globalAlpha = 1; } };
function quartoBg(par){
  R(0, 0, 288, 208, par.parede); for (let y = 0; y < 120; y += 6) R(0, y, 288, 1, sh(par.parede, -.05));
  R(0, 116, 288, 92, par.chao); for (let y = 120; y < 208; y += 8) R(0, y, 288, 1, sh(par.chao, -.1));
  rbox(96, 16, 96, 64, "#7A5236"); R(100, 20, 88, 56, par.vista[0]); par.vistaFn(100, 20); R(143, 20, 2, 56, "#7A5236");
  rbox(20, 104, 70, 38, "#FFFFFF"); R(22, 106, 66, 10, par.coberta); R(22, 116, 66, 24, sh(par.coberta, .2)); rbox(24, 98, 26, 10, "#FFF4E0"); rbox(56, 98, 26, 10, "#FFF4E0"); R(18, 92, 74, 6, "#7A5236");
  rbox(208, 104, 54, 22, "#B5814F"); R(210, 104, 50, 3, "#E9D8BE"); rbox(214, 92, 10, 12, "#F6C667"); R(240, 96, 14, 8, "#FFFFFF"); P(246, 94, "#7FB8E8");
  rbox(222, 150, 48, 40, par.tapete); disco(40, 180, 10, "#5DAA5E"); R(36, 188, 8, 8, "#C08A5A");
}
CENAS.quartoPraia = { ceu: "#F3E3D3", bg(){ quartoBg({ parede: "#F3E3D3", chao: "#E9D8BE", coberta: "#7FB8E8", tapete: "#F6C667", vista: ["#6EC1EC"], vistaFn(x, y){ R(x, y + 30, 88, 26, "#3C9ED4"); R(x, y + 46, 88, 10, "#F2D6A0"); disco(x + 70, y + 12, 6, "#FFF6CF"); } }); }, anim(tm){ const k = Math.round(Math.sin(tm / 600) * 2); R(100, 50 + k, 88, 1, "#9FD6F2"); } };
CENAS.quartoMontanha = { ceu: "#C9A57A", bg(){ quartoBg({ parede: "#C9A57A", chao: "#8C5E3A", coberta: "#C0506E", tapete: "#E8C890", vista: ["#BCDCF0"], vistaFn(x, y){ for (let i = 0; i < 88; i += 2){ const h = 20 + Math.abs(((i + 20) % 60) - 30) * .7; R(x + i, y + h, 2, 56 - h, "#8E9BB8"); } R(x, y + 44, 88, 12, "#3F8F56"); } }); rbox(250, 60, 30, 40, "#7A7A7A"); R(254, 70, 22, 26, "#2E2638"); }, anim(tm){ const f = Math.floor(tm / 120) % 3; R(258, 86 - f, 4, 8 + f, "#F6A04A"); R(264, 88, 4, 6 + f, "#FFE08A"); R(268, 87 + f, 3, 7 - f, "#F6A04A"); } };
CENAS.quartoCidade = { ceu: "#E3E6EE", bg(){ quartoBg({ parede: "#E3E6EE", chao: "#B9C2CF", coberta: "#5246B0", tapete: "#B49CF4", vista: ["#2B235F"], vistaFn(x, y){ for (let i = 0; i < 88; i += 8){ const h = 10 + hash(i, 3, 3) % 30; R(x + i, y + h, 7, 56 - h, "#3A3170"); for (let k = y + h + 3; k < y + 54; k += 5) if (hash(i, k, 4) % 3) P(x + i + 2 + (k % 3), k, "#F6D77A"); } } }); }, anim(){} };
function drawFerias(now){
  if (!feriasEu()) return false;
  const f = ferias15, d = FERIAS_DEST[f.destino], area = feArea(pid), cena = area === "quarto" ? d.quarto : d.cena;
  const mctx = canvas.getContext("2d"); ctx = lo.getContext("2d"); S = 1; ctx.imageSmoothingEnabled = false;
  const tm = Date.now(), oy = lo.height - 208, t = srvNow();
  ctx.drawImage(cenaBg(cena), 0, 0); ctx.save(); ctx.translate(0, oy); CENAS[cena].anim(tm);
  const ids = feIds().filter(id => feArea(id) === area && (id === pid || jogadores[id].online)), n = ids.length, nomes = {};
  const chao = area === "quarto" ? 172 : cena === "praia" ? 182 : cena === "cidade" ? 178 : 186;
  ids.forEach((id, i) => {
    const j = jogadores[id], a = ((f.ativ || {})[id]), aid = a && t - (a.at || 0) < 9000 ? a.id : "";
    const ac = id === pid ? me.acao : j.acao, acId = ac && Date.now() - (ac.ini || 0) < (ac.dur || 0) + 2000 ? (ac.id || "") : "";
    let x = Math.round(144 + (i - (n - 1) / 2) * 26), by = chao, pose = Math.floor((tm + i * 700) / 2200) % 6 === 0 ? "blink" : Math.floor((tm + i * 400) / 800) % 2 ? "breath" : "stand", dir = "down", frame = 0;
    if (/dormir/.test(acId)){ x = 44 + i * 30; by = 118; pose = "lie"; }
    else if (/cafeManha/.test(acId)){ pose = Math.floor(tm / 650) % 3 === 2 ? "siteat" : "sit"; frame = pose === "siteat" ? 1 : 0; x = 222 + i * 22; by = 134; }
    else if (/^fe-/.test(acId) || aid){ const k = hash(hashStr(acId || aid), 1, 1) % 4;
      if (k === 0){ pose = Math.floor(tm / 300) % 2 ? "arms" : "stand"; frame = Math.floor(tm / 260) % 2 ? 1 : 3; }
      else if (k === 1){ const ph = tm / 700 + i; x = Math.round(144 + Math.sin(ph) * 40 + (i - (n - 1) / 2) * 12); dir = Math.cos(ph) > 0 ? "right" : "left"; frame = Math.floor(tm / 115) % 4; pose = "stand"; }
      else if (k === 2){ pose = Math.floor((tm + i * 500) / 650) % 3 === 2 ? "siteat" : "sit"; frame = pose === "siteat" ? 1 : 0; by -= 2; }
      else { pose = "arms"; dir = "up"; } }
    blitAvatar(avDe(id, j), x, by, dir, frame, pose);
    if (pose === "lie"){ R(x - 7, by - 2, 14, 2, "#FFF4E0"); R(x - 6, by - 3, 12, 1, "#FFFFFF"); }
    nomes[id] = [x, pose === "lie" ? by - 12 : by - 27];
  });
  particulasCena(tm); ctx.restore();
  // escurece com a noite (a hora de lá é a mesma daqui)
  let k = darkness(hourNow()) * 2; if (area === "quarto") k *= .4;
  if (k > 0){ ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(" + [255, 255, 255].map((v, i) => Math.round(v + ([116, 110, 182][i] - v) * Math.min(1, k * .8))).join(",") + ",1)"; ctx.fillRect(0, 0, lo.width, lo.height); ctx.globalCompositeOperation = "source-over"; }
  ctx.drawImage(vig, 0, 0);
  mctx.imageSmoothingEnabled = false; mctx.drawImage(lo, 0, 0, canvas.width, canvas.height);
  const K = canvas.width / (W * T), dpr = Math.min(window.devicePixelRatio || 1, 3), fs = Math.round(clamp(4.6 * K, 12 * dpr, 17 * dpr));
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.textAlign = "center"; mctx.textBaseline = "bottom"; mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1);
  for (const [id, [x, y]] of Object.entries(nomes)){ const nm = nomeDe(id); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, x * K, (y + oy) * K); mctx.fillStyle = id === pid ? "#FFFFFF" : "#E6DEFF"; mctx.fillText(nm, x * K, (y + oy) * K); }
  bolha9(mctx, fs, canvas.width / 2, (12 + oy) * K + fs * 1.6, d.em + " " + d.lugar + " · dia " + (feDia() + 1) + " de " + f.dias);
  return true;
}
const feCard = el("div", "card viagem10 ferias15"); feCard.id = "feriasCard"; feCard.hidden = true; feCard.setAttribute("aria-live", "polite");
viagemCard.after(feCard);
function syncFeriasUI(){
  const on = feriasEu(), f = ferias15;
  const sig = on ? [f.destino, feDia(), feArea(pid), JSON.stringify(f.feitos || {}), JSON.stringify(f.evento || {}), feIds().join(","), Object.keys(f.lembr || {}).length, Math.floor((f.volta - srvNow()) / HORA)].join("|") : "";
  document.body.classList.toggle("ferias15on", on);
  if (sig === feUltSig) return; feUltSig = sig;
  feCard.hidden = !on; feCard.textContent = ""; if (!on) return;
  const d = FERIAS_DEST[f.destino], dia = feDia(), area = feArea(pid), falta = f.volta - srvNow();
  feCard.append(el("h2", null, d.em + " Férias " + d.txt + " · dia " + (dia + 1) + " de " + f.dias), el("p", "muted", d.lugar + " · com " + nomesLista(feIds().map(id => id === pid ? "você" : nomeDe(id))) + " · volta em " + tempoTxt(Math.max(0, falta))));
  const at = el("div", "hbtns");
  if (area === "quarto"){ for (const [aid, nome, dur, g] of QUARTO_ATIV) at.append(btn(nome, "btn", () => feAtiv(aid, nome, dur, g))); }
  else {
    const hoje15 = d.dias[dia % d.dias.length];
    for (const [aid, nome] of hoje15.slice(0, 3)){ const feito = (f.feitos || {})[dia + "_" + pid + "_" + aid]; at.append(btn((feito ? "✓ " : "") + nome, feito ? "btn ghost" : "btn", () => feAtiv(aid, nome, 10, { diversao: 25, social: 10, energia: -4 }))); }
    const [eid, enome] = hoje15[3], ev = (f.evento || {})[dia + "_" + pid];
    const be = btn((ev ? "✓ " : "✨ ") + enome, ev ? "btn ghost" : "btn", () => feAtiv(eid, enome, 14, { diversao: 45, social: 25 }, true)); be.setAttribute("aria-label", "Evento especial do dia: " + enome); at.append(be);
  }
  const bb = el("div", "hbtns");
  bb.append(btn(area === "quarto" ? "🌴 Sair do quarto" : "🛏️ Ir pro quarto", "btn ghost", () => feTrocaArea(area === "quarto" ? "fora" : "quarto")), btn("📸 Foto", "btn ghost", fotoFerias), btn("🛍️ Lembrancinhas", "btn ghost", openLembrancinhas), btn("🏠 Voltar antes", "btn ghost", () => { if (confirm("Voltar pra casa antes do fim das férias?")) voltarFerias(); }));
  feCard.append(at, bb);
}
// lembrancinhas (decorações exclusivas)
Object.assign(CAT, {
  concha15: { nome: "Concha gigante", w: 1, h: 1, preco: 35, loja: "ferias15", acoes: [{ id: "concha", nome: "Ouvir o mar na concha", dur: 4, ganho: { diversao: 10 } }] },
  barco15: { nome: "Barquinho na garrafa", w: 1, h: 1, preco: 55, loja: "ferias15", acoes: [] },
  lampiao15: { nome: "Lampião de chalé", w: 1, h: 1, preco: 45, loja: "ferias15", acoes: [] },
  pinhas15: { nome: "Vaso de pinhas", w: 1, h: 1, preco: 30, loja: "ferias15", acoes: [] },
  globo15: { nome: "Globo de neve", w: 1, h: 1, preco: 40, loja: "ferias15", acoes: [{ id: "globo", nome: "Chacoalhar o globo", dur: 4, ganho: { diversao: 12 } }] },
  torre15: { nome: "Miniatura da torre", w: 1, h: 1, preco: 60, loja: "ferias15", acoes: [] }
});
Object.assign(TOP, { barco15: 4, lampiao15: 6, pinhas15: 4, torre15: 12, globo15: 2 });
Object.assign(FURN_EXTRA, {
  concha15(x, y){ for (let i = 0; i < 6; i++) R(x + 3 + i, y + 12 - i, 10 - i * 2 + 2, 1, i % 2 ? "#F9C9D6" : "#F6E3D3"); rbox(x + 3, y + 6, 11, 7, "#F9D9E2"); for (let i = 0; i < 4; i++) R(x + 4 + i * 3, y + 6, 1, 7, "#E8A9BC"); R(x + 2, y + 13, 13, 1, "#D99AAE"); },
  barco15(x, y){ rbox(x + 2, y - 2, 12, 15, "#BFE6F7"); R(x + 3, y - 1, 2, 12, "#E6F4FB"); R(x + 6, y - 6, 4, 4, "#8C5E3A"); R(x + 5, y + 8, 7, 2, "#B5814F"); R(x + 8, y + 2, 1, 6, "#7A5236"); R(x + 9, y + 3, 3, 4, "#FFFFFF"); R(x + 2, y + 11, 12, 2, "#7FB8E8"); },
  lampiao15(x, y){ R(x + 7, y - 6, 2, 3, "#3A3448"); rbox(x + 4, y - 3, 8, 12, "#3A3448"); R(x + 5, y - 2, 6, 10, "#F6D77A"); R(x + 7, y, 2, 5, "#FFFFFF"); rbox(x + 3, y + 9, 10, 3, "#3A3448"); R(x + 4, y + 12, 8, 2, "#5A546C"); },
  pinhas15(x, y){ rbox(x + 3, y + 5, 10, 9, "#C08A5A"); R(x + 4, y + 7, 8, 1, "#9C6644"); for (const [a, b] of [[4, 0], [8, -2], [10, 2]]){ rbox(x + a, y + b, 5, 7, "#8C5E3A"); P(x + a + 1, y + b + 2, "#B5814F"); P(x + a + 3, y + b + 4, "#B5814F"); } },
  globo15(x, y){ rbox(x + 4, y + 9, 8, 4, "#7A5236"); disco(x + 8, y + 5, 5, "#CFE6F5"); R(x + 6, y + 6, 4, 3, "#3F8F56"); P(x + 8, y + 4, "#5DAA5E"); for (const [a, b] of [[5, 2], [10, 3], [7, 1], [11, 6]]) P(x + a, y + b, "#FFFFFF"); },
  torre15(x, y){ for (let i = 0; i < 20; i++){ const w = 2 + Math.round(i * .35); R(x + 8 - w, y - 10 + i, w * 2, 1, i % 4 === 0 ? "#5A546C" : "#8E94AA"); } R(x + 7, y - 13, 2, 3, "#E8445E"); R(x + 3, y + 10, 10, 3, "#5A546C"); }
});
if (typeof ELETRICOS !== "undefined") ELETRICOS.add("lampiao15");
{ const f0 = leva11Luzes; leva11Luzes = function(lights, ativo, tm){ f0(lights, ativo, tm); try { for (const m of Object.values(moveis)) if (m && m.t === "lampiao15") lights.push([m.x * T + 8, m.y * T + 2, 34, "255,200,120", .9]); } catch(e){} }; }

// =====================================================================
// 10. GANCHOS
// =====================================================================
{ const f0 = drawViagem; drawViagem = function(now){ if (f0(now)) return true; if (drawFerias(now)) return true; return drawBairro(now); }; }
{ const f0 = leva10Click; leva10Click = function(p, tx, ty, toque){
  if (viagemOn()) return f0(p, tx, ty, toque);
  if (feriasEu()) return true;
  if (naRuaOuLugar()){ try { bairroClick(p, toque); } catch(e){ console.error(e); } return true; }
  if (f0(p, tx, ty, toque)) return true;
  if (mode !== "live" || andarAtual !== 0 || !me) return false;
  const fv = festaVis.find(v => Math.hypot(p.x - v.cx, (p.y - (v.by - 11)) * .8) < 12 + (toque ? 5 : 0));
  if (fv){ openMenu(p, fv.nome + " · na festa", [{ nome: "Conversar 💬", info: "Amizade", fn: () => festaPapo(fv.id) }, { nome: "Dançar junto 💃", info: "Diversão", fn: dancarFesta }]); return true; }
  const e = entradaTile(), pr = portaRua(), visit = typeof visitaAt === "function" && visitaAt(p.x, p.y, toque ? 5 : 0);
  if (!visit && e && ((tx === e[0] && ty === e[1]) || (Math.abs(p.x - pr.cx) < 14 && Math.abs(p.y - (pr.by - 6)) < 12 && !walkable(tx, ty)))){ menuPorta(p); return true; }
  return false;
}; }
function festaPapo(id){
  const v = festaVis.find(q => q.id === id); if (!v) return;
  const gx = Math.round(v.cx / T - .5), gy = Math.round((v.by + 3) / T - 1), goal = (x, y) => Math.abs(x - gx) + Math.abs(y - gy) === 1;
  const fz = () => startAcao({ id: "b-conversa", nome: "Conversando com " + VIZ[id].nome, dur: 5, ganho: { social: 25, diversao: 8 }, fim: () => { relMudar(pid, id, relBonus({ amizade: 5 })); festaPonto("papo"); toast(VIZ[id].nome + ": \"" + ["Que festa boa! 🎉", "A comida tá ótima!", "Adoro essa música 🎵", "Obrigado(a) pelo convite 💛"][Math.floor(Math.random() * 4)] + "\""); } });
  if (bfs(me.tx, me.ty, goal)) goTo(null, goal, () => { faceTo(gx, gy); fz(); }); else fz();
}
{ const f0 = leva10Update; leva10Update = function(dt){ f0(dt); try { bairroUpdate(dt); syncRuaUI(); syncFeriasUI(); } catch(e){ console.error(e); } }; }
{ const f0 = leva10Esconde; leva10Esconde = function(id, j){
  if (j && cenaDe(j) !== "casa" && j.online) return true;
  if (feViajando() && feVai(id)) return true;
  return f0(id, j);
}; }
{ const f0 = addLeva10Objs; addLeva10Objs = function(objs, tm){
  f0(objs, tm);
  try {
    capVis = null;
    if (andarAtual === 0 && mode === "live"){ const e = entradaTile(); if (e){ capVis = e; objs.push({ z: (e[1] + 1) * T - 15, f: () => ctx.drawImage(capachoSpr().c, e[0] * T + 1, (e[1] + 1) * T - 8) }); } }
    addFestaGuests(objs, tm);
    // vó Zezé: cuida das crianças quando a casa toda viajou e não tem babá
    if (feCasaVazia() && temFilhos() && !babaCobre() && andarAtual === 0){ const p = babaPos(); if (p){ const cx = Math.round((p.x + .5) * T), by = Math.round((p.y + 1) * T - 3); objs.push({ z: by, f: () => npcBlit(VO15.av, cx, by, p.dir, 0, Math.floor(tm / 2600) % 5 === 0 ? "arms" : poseIdle(tm, 4)) }); svVis.push({ id: "vo15", cx, by, nome: VO15.nome }); } }
  } catch(e){ console.error(e); }
}; }
const VO15 = { nome: "Vó Zezé", av: { corpo: "ela", roupa: 6, traje: 1, cabelo: 9, estilo: 2, pele: 2, acess: 1, fisico: "cheinho", altura: "baixinho" } };
{ const f0 = addPetObj; addPetObj = function(objs, tm){ if (feCasaVazia()){ petView = null; return; } return f0(objs, tm); }; }
{ const f0 = addFestaObjs; addFestaObjs = function(objs, tm){
  if (festaAtiva() && !festaHoje.length && srvNow() >= festa15.ini - 5 * MIN){ festaHoje = [["festa15", {}]]; try { return f0(objs, tm); } finally { festaHoje = []; } }
  return f0(objs, tm);
}; }
{ const f0 = drawLabels10; drawLabels10 = function(mctx, K, fs, tm){
  f0(mctx, K, fs, tm);
  if (mode !== "live" || andarAtual !== 0) return;
  try {
    for (const v of festaVis) bolhaNome14(mctx, K, v.nome, v.cx, v.by + (v.teen ? 4 : 0), "#FAC775");
    for (const v of festaVis) if (v.act === "papo" && (tm + hashStr(v.id) * 13) % 5000 < 1800) bolha9(mctx, fs, v.cx * K, (v.by - 30) * K, EMOJIS_PAPO[(Math.floor(tm / 5000) + hashStr(v.id)) % EMOJIS_PAPO.length]);
    // quem saiu pra rua / está nos lugares / viajando
    const grupos = {};
    for (const [id, j] of Object.entries(jogadores)){ if (id === pid || !j || !j.online) continue; const c = cenaDe(j); if (c === "casa") continue; (grupos[c] = grupos[c] || []).push(j.nome); }
    const pr = portaRua(); let dy = 0;
    for (const [c, nm] of Object.entries(grupos)){ const L = LUGARES[c], s = nm.length > 1; bolha9(mctx, fs, pr.cx * K, (pr.by - 22) * K - dy, c === "rua" ? "🚶 " + nomesLista(nm) + (s ? " saíram" : " saiu") + " pra rua" : L.ic + " " + nomesLista(nm) + (s ? " estão" : " está") + " no " + L.nome.replace(/^(Praça das Flores)$/, "a praça").replace(/^Café Grão Doce$/, "café").replace(/^Academia Movimento$/, "academia").replace(/^Mercado Bom Preço$/, "mercado")); dy += fs * 1.9; }
    if (feViajando() && !feVai(pid)){ const d = FERIAS_DEST[ferias15.destino]; bolha9(mctx, fs, (W * T / 2) * K, 18 * K, "🧳 " + nomesLista(feIds().map(nomeDe)) + " de férias " + d.txt + " " + d.em); }
    if (capVis && !Object.keys(grupos).length && Math.floor(tm / 4000) % 3 === 0 && !festaRolando()){ mctx.globalAlpha = .85; mctx.fillStyle = "#FFFFFF"; mctx.fillText("🚪", (capVis[0] * T + 8) * K, ((capVis[1] + 1) * T - 8) * K); mctx.globalAlpha = 1; }
  } catch(e){ console.error(e); }
}; }
{ const f0 = bannerLeva10; bannerLeva10 = function(){
  const f = ferias15;
  if (me && f && !visitando){
    if (f.estado === "convite" && f.conv && f.conv[pid] === true){ const d = FERIAS_DEST[f.destino]; return { key: "fe" + f.criado, partes: () => { const bb = el("div", "bb"); bb.append(btn("Bora! 🧳", "btn small", aceitarFerias), btn("Agora não", "btn ghost small", recusarFerias)); return [el("span", null, nomeDe(f.por) + " te chamou pra " + f.dias + " dias de férias " + d.txt + " " + d.em), bb]; } }; }
    if (f.estado === "convite" && f.por === pid){ const pend = Object.entries(f.conv || {}).filter(([, v]) => v === true).map(([id]) => nomeDe(id)); return { key: "fw" + f.criado + pend.join(","), partes: () => { const bb = el("div", "bb"); bb.append(btn("Partir já", "btn small", partirFerias), btn("Cancelar", "btn ghost small", cancelarFerias)); return [el("span", null, pend.length ? "Férias: esperando " + nomesLista(pend) + "… 🧳" : "Fazendo as malas… 🧳"), bb]; } }; }
  }
  const b = f0(); if (b) return b;
  if (me && festa15 && !visitando && festaAtiva()){
    const t = srvNow();
    if (t < festa15.ini) return { key: "fm" + festa15.ini + Math.floor((festa15.ini - t) / 60000), partes: () => [el("span", null, "🎉 Festa às " + hhmm(brAgora(festa15.ini).h)), btn("Ver", "btn small", openFesta)] };
    if (!(me.acao && /dancar/.test(me.acao.id || ""))) return { key: "fr" + festa15.ini, partes: () => [el("span", null, "🎉 A festa está rolando!"), btn("Dançar 💃", "btn small", dancarFesta)] };
  }
  const cv = me && !visitando ? festaConviteAtivo() : null;
  if (cv) return { key: "fc" + cv[0] + cv[1].ini, partes: () => { const bb = el("div", "bb"); bb.append(btn("Ir 🎉", "btn small", () => irVisitar(cv[0])), btn("Dispensar", "btn ghost small", () => ref("casa/festaConvite/" + cv[0]).remove())); return [el("span", null, "🎉 Festa na " + (cv[1].de || "casa de amigos") + (srvNow() < cv[1].ini ? " às " + hhmm(brAgora(cv[1].ini).h) : " agora!")), bb]; } };
  return null;
}; }
{ const f0 = ITENS16.diversao; ITENS16.diversao = function(){
  const l = f0(), i = Math.max(0, l.findIndex(x => x.ic === "🎵"));
  const novos = [{ ic: "🚶", t: "Passear no bairro", sub: "Rua, praça, café, academia e mercado", fn: () => naRuaOuLugar() ? toast("Você já está na rua 🚶") : sairPraRua() }];
  if (!visitando){
    novos.push({ ic: "🎉", t: festaAtiva() ? "Festa" : "Dar uma festa", sub: festaAtiva() ? (festaRolando() ? "Rolando agora!" : "Às " + hhmm(brAgora(festa15.ini).h)) : "Vizinhos, comida e música", n: festaRolando() ? "!" : 0, fn: openFesta });
    novos.push({ ic: "🧳", t: "Férias", sub: feViajando() ? (feVai(pid) ? "Vocês estão viajando" : "De férias " + FERIAS_DEST[ferias15.destino].txt) : "Praia, montanha ou cidade (2 a 5 dias)", n: ferias15 && ferias15.estado === "convite" && ferias15.conv && ferias15.conv[pid] === true ? 1 : 0, fn: openFerias });
  }
  l.splice(i, 0, ...novos); return l;
}; }
{ const f0 = contadores16; contadores16 = function(){ const c = f0(); if (!me || visitando) return c; const n = (ferias15 && ferias15.estado === "convite" && ferias15.conv && ferias15.conv[pid] === true ? 1 : 0) + (festaConviteAtivo() ? 1 : 0); if (n) c.diversao = (c.diversao || 0) + n; return c; }; }
{ const f0 = MENU_EXTRA.pc; MENU_EXTRA.pc = (id, m) => { const l = f0(id, m); if (!visitando) l.push({ nome: "Dar uma festa 🎉", info: festaAtiva() ? "Marcada" : "Vizinhos e comida", fn: openFesta }, { nome: "Férias 🧳", info: "Reservar viagem", fn: openFerias }); return l; }; }
{ const f0 = agirSozinho; agirSozinho = function(){ if (naRuaOuLugar() || feriasEu()){ VIDA.ultAgir = Date.now(); return null; } return f0(); }; }
{ const f0 = setMode; setMode = function(m){ if (m === "build" && (naRuaOuLugar() || feriasEu())){ toast(feriasEu() ? "Vocês estão de férias 🧳" : "Volte pra casa pra construir 🏠"); return; } return f0(m); }; }
{ const f0 = chegarEmCasa; chegarEmCasa = function(p){ if (EU15.cena !== "casa"){ EU15.cena = "casa"; salvarCena(); document.body.classList.remove("fora15"); } return f0(p); }; }
{ const f0 = acaoTerminada; acaoTerminada = function(a){
  f0(a);
  try { if (festaRolando() && EU15.cena === "casa"){ if (a.id === "comer") festaPonto("comeu"); else if (/^s-(conversar|dancar)/.test(a.id || "")) festaPonto(/dancar/.test(a.id) ? "danca" : "papo"); else if (a.id === "dancar") festaPonto("danca"); } } catch(e){ console.error(e); }
}; }
if (typeof filhoNeeds === "function"){ const f0 = filhoNeeds; filhoNeeds = function(f, t){ const n = f0(f, t); if (n && feCuida(t)){ n.fome = Math.max(n.fome, 75); n.diversao = Math.max(n.diversao, 75); } return n; }; }
if (typeof bebeNeeds === "function"){ const f0 = bebeNeeds; bebeNeeds = function(t){ const n = f0(t); if (n && feCuida(t)){ n.fome = Math.max(n.fome, 75); n.fralda = Math.max(n.fralda, 75); n.carinho = Math.max(n.carinho, 75); } return n; }; }
{ const f0 = petNivel; petNivel = function(ts, horas, t){ const v = f0(ts, horas, t); return feCuida(t) ? Math.max(v, 75) : v; }; }
{ const f0 = nomeDe; nomeDe = function(id){ return VIZ[id] ? VIZ[id].nome : id === "vo15" ? VO15.nome : f0(id); }; }
{ const f0 = pessoasRel; pessoasRel = function(){ const l = f0(); for (const id of VIZ_IDS) if (relDe(pid, id) && !l.includes(id)) l.push(id); return l; }; }
{ const f0 = rostoCanvas; rostoCanvas = function(id){
  if (!VIZ[id]) return f0(id);
  const v = VIZ[id], cv = el("canvas", "rosto13"); cv.width = 16; cv.height = 14; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  if (v.teen) x.drawImage(kidSprite(true, v.L, "down", 0, "stand", 0).c, 1, 5, 16, 14, 0, 0, 16, 14);
  else x.drawImage(avatarSprite(v.av, "down", 0, "stand").c, 1, 7, 16, 14, 0, 0, 16, 14);
  cv.setAttribute("aria-hidden", "true"); return cv;
}; }
CONQUISTAS.push(
  { id: "vizinhanca", nome: "Boa vizinhança", txt: "Ficar amigo (amizade 20) de 5 vizinhos da rua.", meta: 5, val: () => VIZ_IDS.filter(k => moradores().some(([id]) => amizadeDe(id, k) >= 20)).length },
  { id: "festa1", nome: "Casa cheia", txt: "A primeira festa em casa.", st: "festas", meta: 1 },
  { id: "festa5e", nome: "Festa cinco estrelas", txt: "Uma festa nota 5.", st: "festa5", meta: 1 },
  { id: "cafe2", nome: "Cafezinho a dois", txt: "3 encontros no Café Grão Doce.", st: "cafesDois", meta: 3 },
  { id: "ferias1", nome: "Malas prontas", txt: "As primeiras férias.", st: "ferias", meta: 1 },
  { id: "ferias3", nome: "Viajantes de carteirinha", txt: "3 viagens de férias.", st: "ferias", meta: 3 }
);
// ouvintes e reset
{ const f0 = leva11Ouvir; leva11Ouvir = function(){
  f0();
  on(ref("casa/bairro"), "value", s => { bairroDB = s.val() || {}; });
  on(ref("casa/festa"), "value", s => { const ant = festa15; festa15 = s.val(); festaRotas.clear();
    if (me && festa15 && (!ant || ant.ini !== festa15.ini) && festa15.por !== pid && srvNow() < festa15.ini + festa15.dur) { toast("🎉 " + nomeDe(festa15.por) + " marcou uma festa pras " + hhmm(brAgora(festa15.ini).h) + "!"); sfx("notif"); avisar("convite", "Festa em casa às " + hhmm(brAgora(festa15.ini).h) + " 🎉"); }
    refreshPanel("festa15"); if (typeof renderBannerJogo === "function") renderBannerJogo(); });
  on(ref("casa/festaConvite"), "value", s => { const ant = festaConvites; festaConvites = s.val() || {}; if (me) for (const [k, c] of Object.entries(festaConvites)) if (c && !ant[k] && srvNow() < c.fim){ toast("🎉 Convite: festa na " + (c.de || "casa de amigos") + "!"); avisar("convite", "Festa na " + (c.de || "casa de amigos") + " 🎉"); } if (typeof renderBannerJogo === "function") renderBannerJogo(); });
  on(ref("casa/ferias"), "value", s => { const ant = ferias15; ferias15 = s.val(); feCarregado = true; feUltSig = "x";
    if (me && ferias15){
      const f = ferias15, d = FERIAS_DEST[f.destino] || FERIAS_DEST.praia;
      if (f.estado === "convite" && f.conv && f.conv[pid] === true && !(ant && ant.conv && ant.conv[pid] === true)){ toast(nomeDe(f.por) + " te chamou pra férias " + d.txt + " " + d.em); sfx("notif"); avisar("convite", nomeDe(f.por) + " te chamou pra férias 🧳"); }
      if (f.estado === "viajando" && (!ant || ant.estado !== "viajando")){
        if (feVai(pid)){ closeMenu(); closePanel(); if (mode !== "live") setMode("live"); me.path = []; me.plano = null; if (me.acao) setAcao(null); if (EU15.cena !== "casa"){ EU15.cena = "casa"; salvarCena(); } sfx("porta"); toastEspecial(d.em + " Férias " + d.txt + "!", d.lugar + " · " + f.dias + " dias. Aproveitem!"); }
        else toast("🧳 " + nomesLista(feIds().map(nomeDe)) + " " + (feIds().length > 1 ? "saíram" : "saiu") + " de férias " + d.txt + " " + d.em);
      }
      if (f.estado === "fim" && ant && ant.estado === "viajando" && !feVai(pid)) toast("🧳 " + nomesLista(Object.keys(f.vai || {}).map(nomeDe)) + " voltaram das férias!");
    }
    refreshPanel("ferias15"); refreshPanel("lembr15"); if (typeof renderBannerJogo === "function") renderBannerJogo(); });
}; }
{ const f0 = leva11Reset; leva11Reset = function(){
  f0();
  EU15.cena = "casa"; EU15.init = false; EU15.plano = null; for (const k in dispB) delete dispB[k]; for (const k in npcVis) delete npcVis[k];
  bairroDB = {}; festa15 = null; festaFeita = null; festaTentou.clear(); festaRotas.clear(); festaVis = []; festaConvites = {};
  ferias15 = null; feCarregado = false; feUltSig = "x"; feChegou = null; feTentou.clear(); carrinho15.itens = {}; visFeito15.clear();
  ruaSig = "x"; document.body.classList.remove("fora15", "ferias15on"); ruaCard.hidden = true; feCard.hidden = true;
}; }
setInterval(() => { if (!me || !salaRef) return; try { vigiarFesta(); vigiarFerias(); if (!$("screenGame").hidden){ refreshPanel("festa15"); } } catch(e){ console.error(e); } }, 1000);
// depois do 18-laco: 60 quadros enquanto anda na rua (câmera fluida) ou alguém dança na festa
window.addEventListener("load", () => {
  if (typeof precisaFluido !== "function") return;
  const f0 = precisaFluido;
  precisaFluido = function(){ if (f0()) return true; if (!me) return false; if (naRuaOuLugar()) return true; return festaRolando() && andarAtual === 0; };
});
