"use strict";
// Casinha · leva 11: começar do zero (obras), girar, cores e versões dos móveis, metas do lar
// =====================================================================
// LEVA 11
//   casa/modo = "pronta" | "zero"      casa antiga sem o campo = "pronta" (nada muda nela)
//   casa/obra/paredes/<x_y> = 1        parede ocupando o quadrado (x, y). Só em casas "zero".
//   casa/obra/portas/<x_y> = 1         porta (fica num quadrado de parede reta; a parede continua marcada)
//   casa/obra/janelas/<x_y> = 1        janela (parede com chão embaixo)
//   casa/obra/entrada = "x_y"          porta de entrada (as visitas batem nela)
//   casa/obra/comodos/<id> = { nome: tipo, ax, ay }   id estável = "c<ax>_<ay>" (âncora: 1º quadrado do cômodo)
//   casa/moveis/<id>/rot = 1..3        giro (ausente = 0, de frente); cor = 1..3 (ausente = original)
//   casa/metas/<meta> = { at, por, pago: { pid: true } }   metas do lar (cada um recebe o prêmio uma vez)
// Como funciona no modo "zero": o MAP sai de casa/obra (montarZero), comodo(x, y) devolve o id do cômodo
// (ou "quintal" = lado de fora), COMODOS[id] = nome mostrado, tipoC(id) = tipo (quarto, cozinha...).
// Móvel girado: localmente vira o tipo virtual "<tipo>@<rot>" (CAT, TOP, SENTAR próprios, w/h trocados);
// no banco continua t = tipo e rot = n. Versões: VERSAO_PROX[tipo] = próximo tipo ("Melhorar" paga a diferença).
// =====================================================================
let casaZero = false, modoLido = false, obra = {}, obraCarregada = false, metas = {}, metasCarregadas = false, casaCriada = 0;
let zGrid = null, zRooms = [], zPassagem = new Set(), obraSel = null, obraFoco = null, obraSigC = null, obraUISig = "";
const comodosTentados = new Set(), metaPend = new Set();
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const kxy = (x, y) => x + "_" + y;
const xyk = k => String(k).split("_").map(Number);
const zeroAqui = () => casaZero && andarAtual === 0;
const bordaZ = (x, y) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1;
const PRECO_PAREDE = 10, DEVOLVE_PAREDE = 5, PRECO_PORTA = 60, DEVOLVE_PORTA = 30, PRECO_JANELA = 80, DEVOLVE_JANELA = 40;

// ---------------- cômodos: tipos ----------------
const TIPOS_COMODO = {
  kitnet: { nome: "Kitnet", wp: "sala", piso: 1 }, quarto: { nome: "Quarto", wp: "quarto", piso: 0 }, banheiro: { nome: "Banheiro", wp: "banheiro", piso: 3 },
  cozinha: { nome: "Cozinha", wp: "cozinha", piso: 6 }, sala: { nome: "Sala", wp: "sala", piso: 1 }, escritorio: { nome: "Escritório", wp: "escritorio", piso: 7 },
  jogos: { nome: "Sala de jogos", wp: "jogos", piso: 7 }, lavanderia: { nome: "Lavanderia", wp: "lavabo", piso: 2 }, closet: { nome: "Closet", wp: "suite", piso: 4 },
  comodo: { nome: "Cômodo novo", wp: "sala", piso: 1 }
};
WP.escritorio = ["#CFE3D2", "#B4D0B8", "listra"];
// tipo do cômodo (casa pronta: o próprio nome; casa do zero: o tipo escolhido)
function tipoC(cm){
  if (!casaZero || !cm || cm === "quintal") return cm;
  const c = obra.comodos && obra.comodos[cm];
  return c && TIPOS_COMODO[c.nome] ? c.nome : TIPOS_COMODO[cm] ? cm : "comodo";
}

// ---------------- casa nova: escolha e kitnet ----------------
const KIT = { x0: 2, y0: 9, x1: 9, y1: 15, porta: [5, 15], janela: [6, 9] }; // kitnet: 6x5 por dentro
const MOVEIS_ZERO = [["colchao", 3, 10], ["frigobar", 8, 10], ["ducha", 3, 14], ["vaso", 4, 14], ["pote", 8, 14]];
function obraInicial(){
  const paredes = {};
  for (let x = KIT.x0; x <= KIT.x1; x++){ paredes[kxy(x, KIT.y0)] = 1; paredes[kxy(x, KIT.y1)] = 1; }
  for (let y = KIT.y0; y <= KIT.y1; y++){ paredes[kxy(KIT.x0, y)] = 1; paredes[kxy(KIT.x1, y)] = 1; }
  const pk = kxy(KIT.porta[0], KIT.porta[1]);
  return { paredes, portas: { [pk]: 1 }, janelas: { [kxy(KIT.janela[0], KIT.janela[1])]: 1 }, entrada: pk, comodos: { [kxy("c" + (KIT.x0 + 1), KIT.y0 + 1)]: { nome: "kitnet", ax: KIT.x0 + 1, ay: KIT.y0 + 1 } } };
}
const PAREDES_INICIAIS = Object.keys(obraInicial().paredes).length;
function casaZeroDados(t){
  const mv = {}; MOVEIS_ZERO.forEach(([tp, x, y], i) => mv["m" + i] = { t: tp, x, y });
  const ob = obraInicial(), cid = Object.keys(ob.comodos)[0];
  return { modo: "zero", moveis: mv, pisos: { [cid]: 1 }, leva1: true, leva5: true, leva10: t, obra: ob, pet: { nome: "Pipoca", tipo: "gato", comeu: t, carinho: t } };
}
function opcaoModo(m, fn){
  const z = m === "zero", b = btn("", z ? "btn ghost escolha" : "btn escolha", () => fn(m));
  b.append(el("strong", null, z ? "🧱 Começar do zero" : "🏠 Casa pronta"),
    el("small", null, z ? "Um terreno com uma kitnet e $500 pra cada um. Vocês levantam paredes, portas e janelas e montam a casa aos poucos." : "Casa mobiliada com quarto, banheiro, sala e cozinha, do jeito de sempre."));
  return b;
}
// casa nova: usa a escolha feita na tela inicial; senão pergunta (fechar = casa pronta)
function escolherModoNovo(){
  const k = "casinha-modo-" + sala, pend = store.get(k);
  if (pend === "zero" || pend === "pronta"){ store.set(k, null); return Promise.resolve(pend); }
  return new Promise(res => {
    let feito = false, iv = 0;
    const fim = m => { if (feito) return; feito = true; clearInterval(iv); if (painel && painel.id === "modo") closePanel(); res(m); };
    openPanel("modo", "Como vai ser a casa de vocês?", corpo => {
      corpo.append(el("p", "muted", "É uma escolha só, na hora de criar. Depois não dá pra trocar."));
      const g = el("div", "modos11"); g.append(opcaoModo("pronta", fim), opcaoModo("zero", fim)); corpo.append(g);
    });
    iv = setInterval(() => { if (!painel || painel.id !== "modo") fim("pronta"); }, 400);
  });
}
function novaSala(modo){
  const abc = "abcdefghjkmnpqrstuvwxyz23456789"; let c = ""; const r = new Uint32Array(14); crypto.getRandomValues(r); for (const v of r) c += abc[v % abc.length];
  store.set("casinha-modo-" + c, modo); location.hash = c;
}
$("createRoom").onclick = () => novaSala("pronta");
$("createRoomZero").onclick = () => novaSala("zero");

// ---------------- mapa do zero ----------------
function montarZero(){
  MAP.length = 0; H = H_QUINTAL; portaQ = 0; escadaOn = false;
  const pa = obra.paredes || {}, po = obra.portas || {};
  for (let y = 0; y < H; y++){ const r = []; for (let x = 0; x < W; x++){ const k = kxy(x, y); r.push(bordaZ(x, y) ? 1 : po[k] ? 2 : pa[k] ? 1 : 0); } MAP.push(r); }
  detectarComodos();
}
// cômodos = áreas fechadas por paredes (portas fecham também); área que encosta na cerca = lado de fora
let comodosNovos = [], comodosReancora = [];
function detectarComodos(){
  const reg = MAP.map(r => r.map(() => -1)), regs = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
    if (MAP[y][x] !== 0 || reg[y][x] >= 0) continue;
    const i = regs.length, tiles = [], q = [[x, y]]; reg[y][x] = i; let fora = false;
    while (q.length){
      const [a, b] = q.shift(); tiles.push([a, b]); if (a === 1 || b === 1 || a === W - 2 || b === H - 2) fora = true;
      for (const [dx, dy] of DIRS4){ const nx = a + dx, ny = b + dy; if (MAP[ny][nx] !== 0 || reg[ny][nx] >= 0) continue; reg[ny][nx] = i; q.push([nx, ny]); }
    }
    tiles.sort((p, q2) => p[1] - q2[1] || p[0] - q2[0]);
    regs.push({ tiles, fora });
  }
  const cms = obra.comodos || {}, ids = new Map(), usados = new Set();
  comodosNovos = []; comodosReancora = [];
  const lista = Object.entries(cms).filter(([, c]) => c && typeof c.ax === "number").sort((a, b) => a[0] < b[0] ? -1 : 1);
  for (const [id, c] of lista){ const r = reg[c.ay] && reg[c.ay][c.ax]; if (r >= 0 && !regs[r].fora && !ids.has(r)){ ids.set(r, id); usados.add(id); } }
  for (const [id, c] of lista){ // a âncora virou parede: o cômodo do lado herda o id
    if (usados.has(id) || !MAP[c.ay] || MAP[c.ay][c.ax] === 0) continue;
    for (const [dx, dy] of DIRS4){ const r = reg[c.ay + dy] && reg[c.ay + dy][c.ax + dx]; if (r >= 0 && !regs[r].fora && !ids.has(r)){ ids.set(r, id); usados.add(id); comodosReancora.push([id, regs[r].tiles[0]]); break; } }
  }
  zGrid = MAP.map(r => r.map(() => "quintal")); zRooms = [];
  regs.forEach((g, i) => {
    if (g.fora) return;
    let id = ids.get(i);
    if (!id){ const [ax, ay] = g.tiles[0]; id = "c" + kxy(ax, ay); comodosNovos.push([id, ax, ay]); }
    for (const [x, y] of g.tiles) zGrid[y][x] = id;
    const cx = g.tiles.reduce((s, p) => s + p[0], 0) / g.tiles.length, cy = g.tiles.reduce((s, p) => s + p[1], 0) / g.tiles.length;
    zRooms.push({ id, tiles: g.tiles, cx, cy });
  });
  // portas e paredes: cômodo do lado (porta) ou de baixo (parede: é a frente que aparece)
  zPassagem = new Set();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
    if (MAP[y][x] === 2){
      let cm = "quintal"; for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){ const v = zGrid[y + dy][x + dx]; if (MAP[y + dy][x + dx] === 0 && v !== "quintal"){ cm = v; break; } }
      zGrid[y][x] = cm;
      for (const [a, b] of portaHoriz(x, y) ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]]) zPassagem.add(kxy(a, b));
    } else if (MAP[y][x] === 1 && MAP[y + 1][x] === 0) zGrid[y][x] = zGrid[y + 1][x];
  }
  nomesComodos();
}
function nomesComodos(){
  const cont = {}, n = {};
  const ord = zRooms.slice().sort((a, b) => a.id < b.id ? -1 : 1);
  for (const r of ord){ const t = tipoC(r.id); cont[t] = (cont[t] || 0) + 1; }
  for (const r of ord){ const t = tipoC(r.id); n[t] = (n[t] || 0) + 1; COMODOS[r.id] = TIPOS_COMODO[t].nome + (cont[t] > 1 ? " " + n[t] : ""); }
}
const parede1 = (x, y) => !bordaZ(x, y) && MAP[y] && (MAP[y][x] === 1 || MAP[y][x] === 2);
const portaHoriz = (x, y) => (isWallAt(x - 1, y) || (MAP[y] && MAP[y][x - 1] === 2)) && (isWallAt(x + 1, y) || (MAP[y] && MAP[y][x + 1] === 2));
// grava os cômodos que apareceram (id determinístico: dois aparelhos ao mesmo tempo gravam a mesma coisa)
function salvarComodosNovos(){
  if (!me || visitando || !obraCarregada || !zeroAqui()) return;
  for (const [id, ax, ay] of comodosNovos){
    if (comodosTentados.has(id)) continue; comodosTentados.add(id);
    txn("casa/obra/comodos/" + id, cur => cur ? undefined : { nome: "comodo", ax, ay }).then(ok => { if (ok && mode === "build") toast("Cômodo novo! Dê um nome pra ele na aba Obras."); });
  }
  for (const [id, [ax, ay]] of comodosReancora) ref("casa/obra/comodos/" + id).update({ ax, ay }).catch(() => {});
  comodosReancora = [];
}
function entradaZero(){
  const ok = k => {
    if (!k) return null; const [x, y] = xyk(k); if (!MAP[y] || MAP[y][x] !== 2) return null;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]){ const nx = x + dx, ny = y + dy; if (MAP[ny] && MAP[ny][nx] === 0 && comodo(nx, ny) === "quintal") return { x, y, fora: [nx, ny], k }; }
    return null;
  };
  let e = ok(obra.entrada); if (e) return e;
  for (const k of Object.keys(obra.portas || {}).sort()){ e = ok(k); if (e) return e; }
  return null;
}

// ---------------- ganchos no mapa, cômodos, pisos e paredes ----------------
{ const f0 = montarMapa; montarMapa = function(q, p){ if (casaZero && andarAtual === 0) return montarZero(); return f0(q, p); }; }
{ const f0 = comodo; comodo = function(x, y){ if (zeroAqui() && zGrid){ const r = zGrid[y]; return (r && r[x]) || "quintal"; } return f0(x, y); }; }
{ const f0 = pisoDe; pisoDe = function(cm){
  if (!zeroAqui() || COMODOS2.has(cm)) return f0(cm);
  const pi = pisos[cm]; if (typeof pi === "number" && PISOS[pi]) return PISOS[pi];
  const t = TIPOS_COMODO[tipoC(cm)]; return PISOS[t ? t.piso : 1] || PISOS[0];
}; }
{ const f0 = drawFace; drawFace = function(px, py, room){
  if (!zeroAqui() || WP[room] && !(obra.comodos || {})[room]) return f0(px, py, room);
  if (!room || room === "quintal") return f0(px, py, "varanda"); // lado de fora: fachada
  const pc = papelDe(room); if (pc){ drawPapel(px, py, pc); return; }
  const t = TIPOS_COMODO[tipoC(room)]; return f0(px, py, t ? t.wp : "sala");
}; }
{ const f0 = freeSpot; freeSpot = function(){
  if (!zeroAqui()) return f0();
  const e = entradaZero(), ex = e ? e.x : 9, ey = e ? e.y : 9, l = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (walkable(x, y)) l.push([x, y, (comodo(x, y) === "quintal" ? 100 : 0) + (MAP[y][x] === 2 || zPassagem.has(kxy(x, y)) ? 20 : 0) + Math.abs(x - ex) + Math.abs(y - ey)]);
  l.sort((a, b) => a[2] - b[2]); return l.length ? [l[0][0], l[0][1]] : [9, 9];
}; }
// decoração de parede: qualquer parede de frente (não só as de cima da casa pronta)
{ const f0 = decorSpotOk; decorSpotOk = function(x, y, ignore){
  if (!zeroAqui()) return f0(x, y, ignore);
  if (bordaZ(x, y) || !isFace(x, y) || MAP[y][x] !== 1 || JANELAS.has(x + "," + y) || moveAltoEm(x, y + 1)) return false;
  return !decorDoAndar().some(([id, d]) => id !== ignore && d.x === x && d.y === y);
}; }
{ const f0 = comodoDoToque; comodoDoToque = function(tx, ty){
  if (!zeroAqui()) return f0(tx, ty);
  if (!MAP[ty] || tx < 0 || tx >= W) return null;
  if (MAP[ty][tx] !== 1) return comodo(tx, ty);
  return isFace(tx, ty) && !bordaZ(tx, ty) ? comodo(tx, ty + 1) : null;
}; }
{ const f0 = leva6Fantasma; leva6Fantasma = function(){
  if (!zeroAqui() || mode !== "build" || !tool || (tool.kind !== "decor" && tool.kind !== "decorMover")) return f0();
  ctx.fillStyle = "rgba(93,202,165,.25)";
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (decorSpotOk(x, y, tool.id)) ctx.fillRect(x * T + 1, y * T + 4, T - 2, 9);
  if (hover && MAP[hover.y]){ const ok = decorSpotOk(hover.x, hover.y, tool.id); ctx.fillStyle = ok ? "rgba(93,202,165,.45)" : "rgba(240,112,122,.45)"; ctx.fillRect(hover.x * T, hover.y * T, T, T); }
}; }
// visitas batem na porta de entrada (do lado de fora); o gatinho continua andando pelo terreno
{ const f0 = visitaSpot; visitaSpot = function(v){
  if (!zeroAqui() || v.tipo === "gato") return f0(v);
  const e = entradaZero(); if (e && e.fora[1] > HC) return e.fora;
  for (const x of [9, 8, 10, 7, 11, 6, 12, 5, 13]) if (walkable(x, H - 2)) return [x, H - 2];
  return [9, H - 2];
}; }
{ const f0 = visitaEstado; visitaEstado = function(v, t){
  const st = f0(v, t);
  if (zeroAqui() && v.tipo !== "gato" && st.fase === "aqui" && t - v.ini < VIS_ANDA + VIS_TOC){ const e = entradaZero(); if (e && e.fora[0] === st.sx && e.fora[1] === st.sy) st.dir = e.y < st.sy ? "up" : "down"; }
  return st;
}; }
// chuva só cai do lado de fora
function chuvaClipZero(){
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bordaZ(x, y) || (MAP[y][x] === 0 && comodo(x, y) === "quintal")) ctx.rect(x * T, y * T, T, T);
}

// ---------------- fundo do zero (terreno, pisos, paredes, cerca, portas e janelas) ----------------
{ const f0 = ensureBg; ensureBg = function(hr){ if (zeroAqui()) return ensureBgZero(hr); return f0(hr); }; }
function drawTerreno(est, chuva){
  const gp = GRAMAS[est] || GRAMAS.primavera, g = gp.g, gD = gp.gD, gL = gp.gL;
  R(0, 0, W * T, H * T, g);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++){
    const px = tx * T, py = ty * T;
    for (let i = 0; i < 9; i++){ const h = hash(tx, ty, i), ax = px + h % 15, ay = py + (h >> 5) % 15; if (i % 3 === 0) R(ax, ay, 2, 1, gD); else if (i % 3 === 1){ P(ax, ay, gL); P(ax, ay + 1, gD); } else P(ax, ay, gD); }
    for (let i = 0; i < gp.nFlor; i++){
      const h = hash(tx, ty, 20 + i); if (h % gp.raro || h % 5 > (gp.folhas ? 1 : 0)) continue;
      const fx = px + (h >> 3) % 15, fy = py + (h >> 7) % 15, cor = gp.flores[(h >> 11) % gp.flores.length];
      if (gp.folhas){ R(fx, fy, 2, 1, cor); P(fx + ((h >> 13) % 2), fy + 1, sh(cor, -.2)); }
      else if (gp.geada){ P(fx, fy, cor); if (h % 3 === 0) P(fx + 1, fy, "#DDE7EA"); }
      else { P(fx, fy, cor); P(fx, fy + 1, "#4F9050"); }
    }
  }
  if (chuva){ ctx.fillStyle = "rgba(30,50,90,.13)"; ctx.fillRect(0, 0, W * T, H * T); }
}
function drawCercaZ(x, y){
  const px = x * T, py = y * T, b = CERCA, bD = CERCA_D;
  if (y === 0 || y === H - 1){
    const x0 = x === 0 ? 9 : 0, x1 = x === W - 1 ? 8 : T, w = x1 - x0;
    R(px + x0, py + 13, w, 2, "rgba(20,45,30,.28)");
    for (const ry of [4, 8]){ R(px + x0, py + ry - 1, w, 1, LINE); R(px + x0, py + ry, w, 2, b); R(px + x0, py + ry + 1, w, 1, bD); R(px + x0, py + ry + 2, w, 1, LINE); }
    for (let i = x0 + (x === 0 ? 0 : 1); i + 4 <= x1; i += 5){ R(px + i, py + 1, 4, 12, LINE); R(px + i + 1, py, 2, 1, LINE); R(px + i + 1, py + 1, 2, 11, b); P(px + i + 1, py + 1, "#FFFFFF"); R(px + i + 2, py + 3, 1, 9, bD); }
  }
  if (x === 0 || x === W - 1) cercaLateral(x === 0 ? px + 10 : px + 1, py, y === 0 ? 4 : 0);
}
function drawWallTileZ(x, y){
  const px = x * T, py = y * T;
  if (bordaZ(x, y)){ drawCercaZ(x, y); return; }
  const Lw = parede1(x - 1, y), Rw = parede1(x + 1, y), Uw = parede1(x, y - 1), face = isFace(x, y);
  if (!Lw && !Rw){ // parede "em pé": miolo de 8px, como a parede interna da casa pronta
    if (face){ clipRect(px + 4, py, 8, T, () => drawFace(px, py, comodo(x, y + 1))); R(px + 4, py, 1, T, LINE); R(px + 11, py, 1, T, LINE); }
    else {
      R(px + 4, py, 8, T, CAP); R(px + 5, py, 1, T, CAP_L); R(px + 10, py, 1, T, CAP_D); R(px + 4, py, 1, T, LINE); R(px + 11, py, 1, T, LINE);
      if (!Uw){ R(px + 4, py, 8, 1, LINE); R(px + 5, py + 1, 6, 1, CAP_L); }
    }
    if (MAP[y][x + 1] !== 1){ R(px + 12, py, 2, T, "rgba(35,18,40,.2)"); R(px + 14, py, 1, T, "rgba(35,18,40,.1)"); }
    return;
  }
  if (face){ drawFace(px, py, comodo(x, y + 1)); if (!Lw) R(px, py, 1, T, LINE); if (!Rw) R(px + T - 1, py, 1, T, LINE); return; }
  R(px, py, T, T, CAP); R(px, py + 1, T, 1, CAP_L);
  if (!Uw) R(px, py, T, 1, LINE);
  if (!Lw) R(px, py, 1, T, LINE);
  if (!Rw) R(px + T - 1, py, 1, T, LINE);
  if (parede1(x, y + 1) && !parede1(x - 1, y + 1) && !parede1(x + 1, y + 1)){ R(px, py + T - 1, 5, 1, LINE); R(px + 11, py + T - 1, 5, 1, LINE); } // canto que desce como parede fina
}
function drawPortaZ(x, y){
  const px = x * T, py = y * T, wd = "#A5754B", wl = "#D2A06C", wdd = "#6B4429";
  if (!portaHoriz(x, y)){
    R(px + 4, py, 8, T, wd); R(px + 4, py, 1, T, wdd); R(px + 11, py, 1, T, wdd); R(px + 5, py, 1, T, wl);
    R(px + 5, py + 5, 6, 1, "#8C5E3A"); R(px + 5, py + 11, 6, 1, "#8C5E3A"); R(px + 4, py, 8, 2, "rgba(30,15,30,.3)");
    return;
  }
  R(px, py, T, 3, wd); R(px, py, T, 1, wl); R(px, py + 3, T, 1, LINE);
  R(px, py + 4, T, 3, "rgba(30,15,30,.26)"); R(px, py + 7, T, 2, "rgba(30,15,30,.12)");
  R(px, py + 13, T, 3, wd); R(px, py + 13, T, 1, wl); R(px, py + 15, T, 1, "#8C5E3A");
  if (isWallAt(x - 1, y)){ R(px, py + 4, 2, 12, wd); R(px, py + 4, 1, 12, wl); R(px + 2, py + 4, 1, 12, wdd); }
  if (isWallAt(x + 1, y)){ R(px + 14, py + 4, 2, 12, wd); R(px + 13, py + 4, 1, 12, wdd); R(px + 15, py + 4, 1, 12, "#8C5E3A"); }
}
function ensureBgZero(hr){
  const est = estacao(), chuva = climaAgora();
  const key = ["z", obraSigC || (obraSigC = JSON.stringify(obra)), JSON.stringify(pisos), paredesSig(), H, Math.floor(hr * 12), est, chuva || ""].join("|");
  if (key === bgKey) return;
  bgKey = key;
  const b = bg.getContext("2d"); b.imageSmoothingEnabled = false;
  withCtx(b, 1, () => {
    drawTerreno(est, chuva);
    // pisos (a parede em pé fica com o piso de cada lado)
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
      const v = MAP[y][x], px = x * T, py = y * T;
      if (v === 0 || (v === 2 && portaHoriz(x, y))){ const cm = comodo(x, y); if (cm !== "quintal") drawFloorTile(x, y, pisoDe(cm)); continue; }
      if (v === 1 && (parede1(x - 1, y) || parede1(x + 1, y))) continue;
      const l = comodo(x - 1, y), r = comodo(x + 1, y);
      if (MAP[y][x - 1] === 0 && l !== "quintal") clipRect(px, py, 8, T, () => drawFloorTile(x, y, pisoDe(l)));
      if (MAP[y][x + 1] === 0 && r !== "quintal") clipRect(px + 8, py, 8, T, () => drawFloorTile(x, y, pisoDe(r)));
    }
    if (chuva){
      const poca = (x, y, w, h) => { R(x + 1, y, w - 2, h, "#7E9FC0"); R(x, y + 1, w, h - 2, "#7E9FC0"); R(x + 1, y + 1, w - 3, 1, "#A9C6E0"); P(x + w - 2, y + h - 2, "#6A88AA"); };
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){ const h = hash(x, y, 78); if (h % 5 === 0 && MAP[y][x] === 0 && comodo(x, y) === "quintal") poca(x * T + 2 + h % 5, y * T + 3 + (h >> 4) % 8, 7 + h % 3, 4); }
    }
    // tapetinho da porta de entrada
    const e = entradaZero();
    if (e){ const fx = e.fora[0] * T, fy = e.fora[1] * T; rbox(fx + 2, fy + 3, 12, 8, C.coral); R(fx + 3, fy + 4, 10, 1, "#F4A08E"); R(fx + 4, fy + 6, 8, 1, sh(C.coral, -.15)); for (let i = 3; i < 13; i += 2) P(fx + i, fy + 11, C.cream); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){ if (MAP[y][x] === 1) drawWallTileZ(x, y); else if (MAP[y][x] === 2) drawPortaZ(x, y); }
    // sombras das paredes no chão
    const s1 = "rgba(35,18,40,.2)", s2 = "rgba(35,18,40,.1)";
    for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
      if (MAP[y][x] === 1 || !isFace(x, y - 1)) continue;
      const px = x * T, py = y * T, fina = !parede1(x - 1, y - 1) && !parede1(x + 1, y - 1);
      if (fina){ R(px + 4, py, 8, 2, s1); R(px + 4, py + 2, 9, 1, s2); } else { R(px, py, T, 2, s1); R(px, py + 2, T, 2, s2); }
    }
    // janelas (com a luz entrando no chão de dentro)
    const kind = skyKind(hr);
    for (const k of JANELAS){
      const [x, y] = k.split(",").map(Number), px = x * T, py = y * T;
      if (!isFace(x, y)) continue;
      drawWindow(px, py, hr, x, est, chuva, false);
      if (kind !== "noite" && comodo(x, y + 1) !== "quintal"){
        const c = chuva ? "rgba(210,225,255,.1)" : kind === "dia" ? (est === "verao" ? "rgba(255,246,190,.3)" : "rgba(255,248,210,.2)") : kind === "tarde" ? "rgba(255,190,120,.22)" : "rgba(255,210,200,.18)";
        for (let r = 0; r < 20; r++){ if (r === 9 || r === 10) continue; const o = Math.floor(r / 3), yy = py + T + 3 + r; if (MAP[Math.floor(yy / T)] && MAP[Math.floor(yy / T)][x] === 1) break; R(px + 4 + o, yy, 4, 1, c); R(px + 9 + o, yy, 4, 1, c); }
      }
    }
  });
}

// ---------------- móveis novos: versões (barato → bom → ótimo) ----------------
const DORMIR_DOSSEL = [Object.assign({}, DORMIR[0], { ganho: { energia: 90 } }), Object.assign({}, DORMIR[1], { ganho: { energia: 30 } })];
Object.assign(CAT, {
  colchao:   { nome: "Colchão", w: 2, h: 3, preco: 60, acoes: [{ id: "dormir", nome: "Dormir", dur: 20, ganho: { energia: 55 }, sobre: 1, deitar: 1 }, { id: "cochilo", nome: "Tirar um cochilo", dur: 8, ganho: { energia: 18 }, sobre: 1, deitar: 1 }] },
  frigobar:  { nome: "Frigobar", w: 1, h: 1, preco: 80, acoes: [{ id: "lanche", nome: "Pegar um lanche", dur: 6, ganho: { fome: 20 } }] },
  geladeiraG:{ nome: "Geladeira duplex", w: 2, h: 1, preco: 480, acoes: [{ id: "lanche", nome: "Pegar um lanche caprichado", dur: 6, ganho: { fome: 40 } }, { id: "suco", nome: "Tomar um suco gelado", dur: 4, ganho: { fome: 8, energia: 8, diversao: 6 } }] },
  fogareiro: { nome: "Fogareiro", w: 1, h: 1, preco: 50, acoes: [] },
  fogaoChique:{ nome: "Fogão chique", w: 2, h: 1, preco: 420, acoes: [] },
  ducha:     { nome: "Chuveiro simples", w: 1, h: 1, preco: 60, acoes: [{ id: "banho", nome: "Tomar banho", dur: 10, ganho: { higiene: 60 }, sobre: 1 }] },
  pufeSofa:  { nome: "Pufe", w: 1, h: 1, preco: 50, acoes: [{ id: "pufe11", nome: "Sentar no pufe", dur: 8, ganho: { energia: 6, diversao: 6 }, sobre: 1 }] },
  sofaG:     { nome: "Sofá grande", w: 4, h: 1, preco: 480, acoes: [{ id: "relaxar", nome: "Relaxar", dur: 8, ganho: { energia: 14, diversao: 16 }, sobre: 1 }] },
  radio:     { nome: "Radinho", w: 1, h: 1, preco: 40, acoes: [{ id: "radio", nome: "Ouvir rádio", dur: 10, ganho: { diversao: 22 } }] },
  tvG:       { nome: "TV grande", w: 3, h: 1, preco: 520, acoes: [{ id: "tv", nome: "Assistir TV", dur: 12, ganho: { diversao: 50 } }] }
});
CAT.dossel.acoes = DORMIR_DOSSEL; // a melhor cama descansa mais
Object.assign(TOP, { colchao: 1, frigobar: 3, geladeiraG: 14, fogareiro: 4, fogaoChique: 6, ducha: 10, pufeSofa: 3, sofaG: 6, radio: 5, tvG: 11 });
SENTAR.pufeSofa = { vagas: [{ dx: 0, by: 14 }] };
SENTAR.sofaG = { vagas: [{ dx: -16, by: 15 }, { dx: 16, by: 15 }, { dx: 0, by: 15 }], cima: 12 };
const VERSAO_PROX = { colchao: "solteiro", solteiro: "casal", frigobar: "geladeira", fogareiro: "fogao",
  ducha: "chuveiro", chuveiro: "banheira", pufeSofa: "sofa", radio: "tv" }; // v24/v26: sem "Melhorar" pros móveis grandes (sofá, TV, geladeira duplex, fogão chique, dossel)
const FOGO_RITMO = { fogareiro: 1.35, fogao: 1, fogaoChique: .7 }; // tempo de cozinhar
const FAM = { fogareiro: "fogao", fogaoChique: "fogao", tvG: "tv", radio: "som", ducha: "chuveiro", frigobar: "geladeira", geladeiraG: "geladeira" };
const baseT = t => (CAT[t] && CAT[t].base) || t;

FURN_EXTRA.colchao = (x, y) => {
  const bl = "#E8735F", blL = sh(bl, .22), blD = sh(bl, -.2), lado = "#CFC3DD";
  rbox(x + 1, y - 1, 30, 48, lado);
  R(x + 2, y - 1, 28, 44, "#F6F1FA"); R(x + 2, y - 1, 28, 1, "#FFFFFF");
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) P(x + 5 + i * 7, y + 2 + j * 9, "#E2D8EC");
  rbox(x + 5, y + 1, 22, 9, "#FFFFFF"); R(x + 7, y + 7, 18, 1, "#E6DDF0"); R(x + 7, y + 3, 3, 1, "#F3EEF8");
  R(x + 2, y + 17, 28, 25, bl); R(x + 2, y + 17, 28, 2, blL); R(x + 2, y + 19, 28, 1, blD);
  for (let j = 0; j < 3; j++) R(x + 4, y + 24 + j * 6, 22, 1, sh(bl, .35));
  R(x + 27, y + 19, 3, 23, blD); R(x + 2, y + 42, 28, 1, blD);
  R(x + 2, y + 43, 28, 3, lado); R(x + 2, y + 45, 28, 1, sh(lado, -.2));
};
FURN_EXTRA.frigobar = (x, y) => {
  const g = "#BFE5DA", gL = "#E4F6F0", gD = "#9CCBBE", gDD = "#74A89A";
  rbox(x + 2, y - 3, 12, 18, g); R(x + 3, y - 2, 1, 16, gL); R(x + 12, y - 2, 1, 16, gD); R(x + 4, y - 3, 8, 1, gL);
  R(x + 2, y + 1, 12, 1, gDD); R(x + 3, y + 2, 9, 1, gL);
  R(x + 11, y - 2, 1, 2, C.metalD); R(x + 11, y + 4, 1, 5, C.metalD); P(x + 11, y + 4, C.metalL);
  R(x + 4, y + 5, 4, 4, C.cream); R(x + 5, y + 7, 2, 1, C.rose); P(x + 5, y + 4, C.coral); P(x + 9, y + 10, C.gold);
  R(x + 3, y + 15, 2, 1, C.inkL); R(x + 11, y + 15, 2, 1, C.inkL);
};
FURN_EXTRA.geladeiraG = (x, y) => {
  const g = "#BFE5DA", gL = "#E4F6F0", gD = "#9CCBBE", gDD = "#74A89A";
  rbox(x + 1, y - 14, 30, 29, g); R(x + 2, y - 13, 1, 27, gL); R(x + 29, y - 13, 1, 27, gD); R(x + 3, y - 13, 26, 1, gL);
  R(x + 15, y - 13, 1, 19, gD); R(x + 16, y - 13, 1, 19, gDD);
  R(x + 13, y - 9, 1, 9, C.metalD); P(x + 13, y - 9, C.metalL); R(x + 18, y - 9, 1, 9, C.metalD); P(x + 18, y - 9, C.metalL);
  R(x + 2, y + 6, 28, 1, gDD); R(x + 3, y + 8, 26, 5, gD); R(x + 3, y + 8, 26, 1, gL); R(x + 12, y + 10, 8, 1, C.metalD);
  rbox(x + 21, y - 7, 6, 8, "#E8F0F4"); R(x + 22, y - 6, 4, 4, "#5E7A8C"); P(x + 23, y - 5, "#9FD3F2"); P(x + 23, y - 1, "#9FD3F2");
  R(x + 4, y - 10, 5, 5, C.cream); R(x + 5, y - 8, 3, 1, C.rose); P(x + 6, y - 11, C.coral); R(x + 6, y - 2, 2, 2, C.gold); P(x + 9, y - 3, C.sky); pixHeart(x + 4, y + 1, C.coral);
  R(x + 2, y + 15, 3, 1, C.inkL); R(x + 27, y + 15, 3, 1, C.inkL);
};
FURN_EXTRA.fogareiro = (x, y, f) => {
  box(x + 1, y + 5, 14, 10, C.wood); R(x + 1, y + 5, 14, 1, C.woodL); for (const yy of [8, 11]) R(x + 1, y + yy, 14, 1, C.woodD);
  R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 12, y + 15, 2, 1, C.woodDD);
  rbox(x + 1, y - 2, 14, 7, "#C9CFD6"); R(x + 2, y - 2, 12, 1, "#EEF3F7"); R(x + 1, y + 4, 14, 1, "#8D9BAA");
  for (const a of [2, 9]){ R(x + a, y - 1, 5, 4, "#2E2638"); R(x + a + 1, y, 3, 2, f ? "#F2A65A" : "#77708A"); }
  P(x + 7, y + 3, C.coral); P(x + 8, y + 3, C.ink);
  if (f){ P(x + 3 + (f - 1), y - 2, "#FFE08A"); P(x + 12 - (f - 1), y - 2, "#F2A65A"); rbox(x + 8, y - 4, 7, 4, "#B9C2CC"); R(x + 9, y - 4, 5, 1, "#E4EAF0"); }
};
FURN_EXTRA.fogaoChique = (x, y, f) => {
  const fg = "#F4EEE6", fgD = "#DDD5CA";
  rbox(x + 1, y - 6, 30, 6, fgD); R(x + 2, y - 6, 28, 1, "#FFFFFF");
  for (let i = 0; i < 6; i++) P(x + 4 + i * 5, y - 4, C.gold);
  P(x + 16, y - 3, f ? "#7FE0A8" : "#6A6478");
  R(x + 1, y - 1, 30, 8, C.ink); R(x + 1, y - 1, 30, 1, C.inkL);
  for (const a of [3, 10, 17, 24]){ R(x + a, y, 5, 4, "#1F1A28"); R(x + a + 1, y + 1, 3, 2, f && a < 14 ? "#F2A65A" : "#77708A"); }
  box(x + 1, y + 7, 30, 8, fg);
  for (const ox of [3, 17]){ R(x + ox, y + 8, 12, 6, C.ink); R(x + ox + 1, y + 9, 10, 4, f ? "#F2A65A" : "#5A546C"); R(x + ox + 2, y + 8, 8, 1, "#E6C277"); if (f) R(x + ox + 2, y + 10, 4, 1, "#FAD08A"); }
  R(x + 2, y + 15, 2, 1, C.inkL); R(x + 28, y + 15, 2, 1, C.inkL);
  if (f){ rbox(x + 4, y - 4, 7, 5, "#B9C2CC"); R(x + 5, y - 4, 5, 1, "#E4EAF0"); R(x + 18, y + 1, 4, 1, "#6FB8F0"); }
};
FURN_EXTRA.ducha = (x, y) => {
  rbox(x, y + 2, 16, 14, "#DCE6EC"); R(x + 2, y + 4, 12, 10, "#C9D8E2");
  for (const yy of [7, 11]) R(x + 2, y + yy, 12, 1, "#B6C8D4");
  for (const xx of [6, 10]) R(x + xx, y + 4, 1, 10, "#B6C8D4");
  R(x + 7, y + 8, 2, 2, "#7F96A8"); P(x + 7, y + 8, "#5F7688");
  R(x + 8, y - 10, 2, 13, C.metal); R(x + 8, y - 10, 1, 13, C.metalL);
  R(x + 4, y - 10, 5, 2, C.metal); rbox(x + 2, y - 9, 6, 3, C.metalD); P(x + 3, y - 7, "#E6F4FD"); P(x + 5, y - 7, "#E6F4FD");
  P(x + 11, y - 1, C.coral); P(x + 11, y - 2, C.metalD); P(x + 12, y - 1, C.sky);
};
FURN_EXTRA.pufeSofa = (x, y) => {
  const c = "#7C69CC", cL = "#9A89E0", cD = "#6453B0", cDD = "#4E3F92";
  rbox(x + 1, y + 1, 14, 14, cD); R(x + 2, y + 12, 12, 2, cDD);
  rbox(x + 2, y - 3, 12, 11, cL); R(x + 4, y - 3, 8, 1, "#B3A4EE"); R(x + 3, y + 7, 10, 1, c);
  P(x + 7, y + 2, cDD); P(x + 8, y + 2, c);
  for (const [a, b] of [[4, 0], [11, 1], [5, 5], [10, 5], [7, -1]]) P(x + a, y + b, c);
};
FURN_EXTRA.sofaG = (x, y) => {
  const sf = "#7C69CC", sfD = "#6453B0", sfDD = "#4E3F92", sfL = "#9A89E0", w = 64;
  rbox(x + 3, y - 6, w - 6, 11, sfDD);
  for (let i = 0; i < 4; i++){ rbox(x + 5 + i * 14, y - 5, 13, 9, sfD); P(x + 11 + i * 14, y - 1, sfDD); P(x + 12 + i * 14, y - 1, sf); }
  R(x + 5, y + 4, w - 10, 1, sfDD);
  R(x + 5, y + 5, w - 10, 7, sfL); R(x + 5, y + 5, w - 10, 1, "#B3A4EE"); R(x + 5, y + 11, w - 10, 1, sf);
  for (const sx of [18, 32, 46]) R(x + sx, y + 5, 1, 7, sf);
  R(x + 4, y + 12, w - 8, 3, sfD); R(x + 4, y + 14, w - 8, 1, sfDD);
  rbox(x, y - 2, 6, 17, sfD); rbox(x + w - 6, y - 2, 6, 17, sfD);
  R(x + 1, y - 1, 4, 2, sfL); R(x + w - 5, y - 1, 4, 2, sfL); R(x + 1, y + 11, 4, 3, sfDD); R(x + w - 5, y + 11, 4, 3, sfDD);
  rbox(x + 7, y - 2, 8, 7, C.gold); R(x + 9, y, 4, 1, "#FCE9B8"); R(x + 9, y + 2, 4, 1, "#FCE9B8");
  rbox(x + 28, y - 2, 8, 7, C.rose); pixHeart(x + 29, y, "#FFFFFF");
  rbox(x + 50, y - 1, 7, 6, C.mint); P(x + 52, y + 1, "#FFFFFF"); P(x + 54, y + 2, "#FFFFFF");
  R(x + 2, y + 15, 2, 1, C.woodDD); R(x + w - 4, y + 15, 2, 1, C.woodDD); R(x + 31, y + 15, 2, 1, C.woodDD);
};
FURN_EXTRA.radio = (x, y, f) => {
  box(x + 2, y + 7, 12, 8, C.wood); R(x + 2, y + 7, 12, 2, C.woodL); R(x + 4, y + 10, 8, 4, C.woodD); P(x + 8, y + 12, C.gold);
  R(x + 3, y + 15, 2, 1, C.woodDD); R(x + 11, y + 15, 2, 1, C.woodDD);
  rbox(x + 2, y - 2, 12, 9, C.coral); R(x + 3, y - 2, 10, 1, "#F4A08E"); R(x + 3, y + 6, 10, 1, sh(C.coral, -.2));
  R(x + 3, y, 6, 5, "#F4E6CF"); for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) P(x + 4 + i * 2, y + 1 + j * 2, "#B98A5A");
  P(x + 11, y + 1, C.gold); P(x + 11, y + 4, f ? "#7FE0A8" : C.inkL);
  R(x + 12, y - 5, 1, 3, C.metalD); P(x + 12, y - 5, C.metalL);
};
FURN_EXTRA.tvG = (x, y, f) => {
  box(x + 1, y + 6, 46, 9, C.wood); R(x + 1, y + 6, 46, 2, C.woodL);
  for (const ox of [3, 17, 31]){ R(x + ox, y + 9, 13, 5, C.woodD); R(x + ox + 1, y + 10, 11, 3, C.wood); R(x + ox + 1, y + 10, 11, 1, C.woodL); }
  P(x + 15, y + 11, C.gold); P(x + 32, y + 11, C.gold);
  R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 44, y + 15, 2, 1, C.woodDD);
  R(x + 20, y + 5, 8, 1, C.ink); R(x + 18, y + 6, 12, 1, C.inkL);
  R(x + 1, y - 2, 3, 8, "#3A3448"); R(x + 44, y - 2, 3, 8, "#3A3448"); P(x + 2, y, "#77708A"); P(x + 45, y, "#77708A");
  rbox(x + 5, y - 11, 38, 16, C.ink);
  const sx = x + 7, sy = y - 9, sw = 34, shh = 12;
  if (!f){ R(sx, sy, sw, shh, "#2A3550"); R(sx + 1, sy + 1, 9, 1, "#42537A"); R(sx + 1, sy + 2, 5, 1, "#42537A"); P(sx + 1, sy + 3, "#42537A"); }
  else {
    const sky = ["#7EC8F0", "#F4A77C", "#2A2F6E", "#B49CF4"][f - 1], gr = ["#5DBB7D", "#C97842", "#3E7A3A", "#E06B92"][f - 1];
    R(sx, sy, sw, 7, sky); R(sx, sy + 6, sw, 1, sh(sky, .25)); R(sx, sy + 7, sw, 5, gr); R(sx, sy + 7, sw, 1, sh(gr, .22));
    R(sx + 26, sy + 1, 4, 3, f === 3 ? "#F4F1FB" : "#FFE08A");
    R(sx + 6 + f * 3, sy + 5, 8, 2, sh(gr, -.12)); R(sx + 8 + f * 3, sy + 4, 4, 1, sh(gr, -.12));
    R(sx + 4 + f * 2, sy + 1, 6, 1, "#FFFFFF"); R(sx + 5 + f * 2, sy + 2, 6, 1, "#FFFFFF");
    R(sx, sy, sw, 1, "rgba(255,255,255,.25)");
  }
  P(x + 40, y + 3, f ? "#7FE0A8" : "#C4504A");
};

// ---------------- cores dos móveis ----------------
// regra m: quais pixels mudam (faixa de matiz h, saturação s, luz l; abs = matiz absoluta); v[i]: variação (h nova, sv/sm saturação, lm/la luz)
const CORES = {};
const defCor = (ts, m, v) => ts.forEach(t => CORES[t] = { m, v });
defCor(["estante", "armario", "mesa", "pc", "tv", "tvG", "radio", "dossel"], { h: [16, 38], s: [.18, .72], l: [.12, .82], c: 28 },
  [{ nome: "Madeira", sw: "#B5814F" }, { nome: "Clara", sw: "#E2C29A", lm: 1.2, sm: .75 }, { nome: "Escura", sw: "#5E4430", lm: .62 }, { nome: "Branca", sw: "#F1ECE6", sv: .1, lm: .3, la: .64 }]);
defCor(["sofa", "sofaG", "pufeSofa"], { h: [230, 272], s: [.15, 1], l: [0, 1], c: 250 },
  [{ nome: "Lilás", sw: "#7C69CC" }, { nome: "Verde", sw: "#6FA35C", h: 112 }, { nome: "Rosa", sw: "#E58FB5", h: 335, lm: 1.06 }, { nome: "Cinza", sw: "#8E8A9A", sv: .07 }]);
defCor(["poltrona"], { h: [24, 48], s: [.55, 1], l: [0, 1], c: 37 },
  [{ nome: "Mostarda", sw: "#E9A94B" }, { nome: "Azul", sw: "#5B8FD6", h: 212, sm: .8 }, { nome: "Verde", sw: "#5DAA7A", h: 145, sm: .75 }, { nome: "Vinho", sw: "#9C3B5A", h: 340, lm: .72 }]);
defCor(["casal"], { h: [235, 268], s: [.2, 1], l: [0, 1], c: 250 },
  [{ nome: "Lilás", sw: "#6F5CC0" }, { nome: "Azul", sw: "#3F7FC8", h: 210 }, { nome: "Verde", sw: "#4E9A6A", h: 145 }, { nome: "Rosa", sw: "#D9708C", h: 340 }]);
defCor(["solteiro", "colchao"], { h: [0, 16], s: [.5, 1], l: [0, 1], c: 9 },
  [{ nome: "Coral", sw: "#E8735F" }, { nome: "Azul", sw: "#5B8FD6", h: 212, sm: .8 }, { nome: "Verde", sw: "#5DAA7A", h: 145, sm: .75 }, { nome: "Amarelo", sw: "#E8C25A", h: 45 }]);
defCor(["geladeira", "geladeiraG", "frigobar"], { h: [140, 182], s: [.12, 1], l: [.3, .97], c: 162 },
  [{ nome: "Menta", sw: "#BFE5DA" }, { nome: "Rosa", sw: "#F2C2D2", h: 342 }, { nome: "Amarela", sw: "#F4E2A0", h: 48, sm: 1.3 }, { nome: "Branca", sw: "#F1F3F4", sv: .05, lm: 1.04 }]);
defCor(["fogao", "fogaoChique", "pia"], { h: [18, 52], s: [0, 1], l: [.76, 1], abs: 1 },
  [{ nome: "Creme", sw: "#F4EEE6" }, { nome: "Vermelho", sw: "#D9483D", h: 4, sv: .62, lm: .72 }, { nome: "Azul", sw: "#7FB0DA", h: 208, sv: .5, lm: .82 }, { nome: "Preto", sw: "#3A3448", sv: .08, lm: .32 }]);
defCor(["banheira"], { h: [0, 360], s: [0, .3], l: [.74, 1], abs: 1 },
  [{ nome: "Branca", sw: "#FFFFFF" }, { nome: "Rosa", sw: "#F2B8CC", h: 340, sv: .55, lm: .9 }, { nome: "Azul", sw: "#A9CCEB", h: 208, sv: .5, lm: .88 }, { nome: "Dourada", sw: "#E8C46A", h: 44, sv: .62, lm: .82 }]);
defCor(["tapete"], { h: [335, 356], s: [.3, 1], l: [0, 1], c: 345 },
  [{ nome: "Rosa", sw: "#DC6A86" }, { nome: "Azul", sw: "#5B8FD6", h: 212 }, { nome: "Verde", sw: "#5DAA7A", h: 140 }, { nome: "Amarelo", sw: "#E8C25A", h: 45 }]);
function rgb2hsl(r, g, b){
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn){ const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; }
  return [h, s, l];
}
function hsl2rgb(h, s, l){
  h = (((h % 360) + 360) % 360) / 360; if (s <= 0){ const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(clamp(v, 0, 1) * 255));
}
// pinta de novo os pixels do desenho que está no ctx (dentro do sprite(), antes do contorno)
function recolorir(b, cor){
  const def = CORES[b], v = def && def.v[cor]; if (!v || !cor) return;
  const m = def.m, cv = ctx.canvas, d = ctx.getImageData(0, 0, cv.width, cv.height), a = d.data;
  for (let i = 0; i < a.length; i += 4){
    if (a[i + 3] < 40) continue;
    const [h, s, l] = rgb2hsl(a[i], a[i + 1], a[i + 2]);
    if (h < m.h[0] || h > m.h[1] || s < m.s[0] || s > m.s[1] || l < m.l[0] || l > m.l[1]) continue;
    const nh = v.h == null ? h : m.abs ? v.h : v.h + (h - m.c), ns = v.sv != null ? v.sv : clamp(s * (v.sm || 1), 0, 1), nl = clamp(l * (v.lm || 1) + (v.la || 0), 0, 1);
    const [r, g, bb] = hsl2rgb(nh, ns, nl); a[i] = r; a[i + 1] = g; a[i + 2] = bb;
  }
  ctx.putImageData(d, 0, 0);
}

// ---------------- girar: tipos virtuais "<tipo>@<rot>" ----------------
// bit: o desenho de cima gira inteiro (camas, sofás, poltrona, banheira, tapete); cx: vista de lado e de costas desenhadas (aparelhos e armários)
const GIRO = { colchao: "bit", solteiro: "bit", casal: "bit", sofa: "bit", sofaG: "bit", poltrona: "bit", banheira: "bit", tapete: "bit",
  tv: "cx", tvG: "cx", pc: "cx", estante: "cx", armario: "cx", geladeira: "cx", geladeiraG: "cx", fogao: "cx", fogaoChique: "cx", pia: "cx" };
const GIRO_TXT = ["de frente", "virado pra esquerda", "de costas", "virado pra direita"];
const PAL_CX = {
  tv: { tipo: "tela", topo: C.woodL, corpo: C.wood, costas: "#3A3448" }, tvG: { tipo: "tela", topo: C.woodL, corpo: C.wood, costas: "#3A3448" },
  pc: { tipo: "mesa", topo: C.woodL, corpo: C.wood, costas: C.woodD },
  estante: { topo: C.wood, corpo: C.woodD, frente: "livros", costas: C.woodD }, armario: { topo: C.woodD, corpo: C.wood, frente: C.woodL, costas: C.wood, puxa: C.gold },
  geladeira: { topo: "#E4F6F0", corpo: "#9CCBBE", frente: "#BFE5DA", costas: "#9CCBBE", puxa: C.metalD }, geladeiraG: { topo: "#E4F6F0", corpo: "#9CCBBE", frente: "#BFE5DA", costas: "#9CCBBE", puxa: C.metalD },
  fogao: { topo: C.ink, corpo: "#F4EEE6", frente: "#DDD5CA", costas: "#DDD5CA", bocas: 1 }, fogaoChique: { topo: C.ink, corpo: "#F4EEE6", frente: "#DDD5CA", costas: "#DDD5CA", bocas: 1 },
  pia: { topo: "#DCE4EA", corpo: "#E9D8BE", frente: "#FFF4E0", costas: "#E9D8BE", cuba: 1 }
};
function sentarGirado(b, r){
  const s = SENTAR[b], c = CAT[b];
  if (b === "pc") return { sempre: 1, fixas: 1, vagas: [r === 2 ? { dx: 0, by: -1, dir: "down" } : { dx: r === 1 ? -14 : 14, by: 22, dir: r === 1 ? "right" : "left" }] };
  if (!s || !s.vagas) return null;
  if (r === 2) return { fixas: s.fixas, vagas: s.vagas.map(v => ({ dx: -v.dx, by: Math.max(6, c.h * T - v.by + 8), dir: "up" })) };
  const alto = c.w * T;
  return { fixas: s.fixas, vagas: s.vagas.map(v => ({ dx: r === 1 ? -2 : 2, by: Math.round(alto / 2 + (r === 1 ? v.dx : -v.dx)) + 7, dir: r === 1 ? "left" : "right" })) };
}
for (const [t, modo] of Object.entries(GIRO)){
  const c = CAT[t]; if (!c) continue;
  for (const r of [1, 2, 3]){
    const v = t + "@" + r, imp = r % 2 === 1;
    CAT[v] = Object.assign({}, c, { w: imp ? c.h : c.w, h: imp ? c.w : c.h, virt: 1, base: t, rot: r, nivel: 0 });
    TOP[v] = modo === "bit" ? 0 : (TOP[t] || 0);
    const st = sentarGirado(t, r); if (st) SENTAR[v] = st;
    MENU_EXTRA[v] = (id, m) => MENU_EXTRA[t] ? MENU_EXTRA[t](id, m) : [];
  }
}
for (const [t, f] of Object.entries(FAM)) if (t !== "radio" && t !== "ducha") MENU_EXTRA[t] = (id, m) => MENU_EXTRA[f] ? MENU_EXTRA[f](id, m) : [];
// vista de costas: a silhueta do móvel de frente (espelhada), pintada de fundo
function drawCostas(b, x, y, W2, Hf, top){
  const tmp = document.createElement("canvas"); tmp.width = W2 + 2; tmp.height = Hf + top + 2;
  withCtx(tmp.getContext("2d"), 1, () => drawFurn(b, 1, 1 + top, 0));
  const d = tmp.getContext("2d").getImageData(0, 0, tmp.width, tmp.height).data, cor = PAL_CX[b].costas, alto = Hf + top;
  const op = (i, j) => i >= 0 && j >= 0 && i < W2 && j < alto && d[((j + 1) * tmp.width + (W2 - i)) * 4 + 3] > 40;
  for (let i = 0; i < W2; i++){
    let primeiro = -1;
    for (let j = 0; j < alto; j++){
      if (!op(i, j)) continue;
      if (primeiro < 0) primeiro = j;
      let c = cor;
      if (j - primeiro < 2) c = sh(cor, .22);
      else if (!op(i, j + 1)) c = sh(cor, -.3);
      else if (i % 8 === 0 || !op(i - 1, j)) c = sh(cor, -.14);
      else if (!op(i + 1, j)) c = sh(cor, -.2);
      P(x + i, y + j, c);
    }
  }
  if (PAL_CX[b].tipo === "tela") for (let j = 0; j < 3; j++) R(x + Math.round(W2 / 2) - 4, y + 3 + j * 2, 8, 1, sh(cor, -.3)); // respiro da TV
}
// vista de lado (r = 1: frente pra esquerda; 3: pra direita): tampo em cima, a lateral na frente e uma faixa da frente na beirada
function drawLado(b, x, y, W2, Hf, top, r){
  const Pc = PAL_CX[b], yb = y + top + Hf, esq = r === 1, fx = esq ? x + 1 : x + W2 - 4;
  if (Pc.tipo){ // TV ou computador: móvel baixo e a tela de lado, em pé no meio
    const alt = Pc.tipo === "mesa" ? 11 : 9, hT = Math.max(3, Hf - 13), y0 = yb - alt - hT;
    rbox(x + 1, y0, W2 - 2, hT, Pc.topo); R(x + 2, y0, W2 - 4, 1, sh(Pc.topo, .25));
    R(x + 1, y0 + hT, W2 - 2, alt, Pc.corpo); R(x + 1, y0 + hT, W2 - 2, 1, sh(Pc.corpo, -.25)); R(x + 1, yb - 1, W2 - 2, 1, sh(Pc.corpo, -.35)); R(x + 3, y0 + hT + 4, W2 - 6, 1, sh(Pc.corpo, -.12));
    const alto = Pc.tipo === "mesa" ? 9 : 13, lx = x + Math.floor(W2 / 2) - 1 + (esq ? -2 : 2), l0 = y0 + 2, l1 = y0 + hT - 3;
    R(lx, l0 - alto, 3, l1 - l0 + alto, C.ink); R(esq ? lx : lx + 2, l0 - alto + 1, 1, l1 - l0 + alto - 2, "#42537A"); R(lx + 1, l0 - alto, 1, 1, C.inkL);
    R(lx - (esq ? 0 : 1), l1, 4, 2, C.inkL);
    if (Pc.tipo === "mesa"){ R(esq ? lx - 5 : lx + 5, l0 + 2, 3, Math.max(3, hT - 8), "#F1EDF7"); P(esq ? lx - 4 : lx + 6, l0 + hT - 4, C.rose); }
    return;
  }
  const alt = top + 13, hT = Math.max(3, Hf - 13), y0 = yb - alt - hT;
  rbox(x + 1, y0, W2 - 2, hT, Pc.topo); R(x + 2, y0, W2 - 4, 1, sh(Pc.topo, .25));
  R(x + 1, y0 + hT, W2 - 2, alt, Pc.corpo); R(x + 1, y0 + hT, W2 - 2, 1, sh(Pc.corpo, -.25)); R(x + 1, yb - 1, W2 - 2, 1, sh(Pc.corpo, -.35));
  R(esq ? x + W2 - 3 : x + 2, y0 + hT + 1, 1, alt - 2, sh(Pc.corpo, .14));
  if (Pc.frente === "livros"){ const cs = [C.coral, C.sky, C.gold, C.mint, C.rose, "#9C8AE6"]; R(fx, y0, 3, yb - y0, C.woodDD); for (let j = y0 + 1, k = 0; j < yb - 2; j += 3, k++) R(fx + (esq ? 1 : 0), j, 2, 2, cs[k % cs.length]); }
  else { R(fx, y0 + 1, 3, yb - y0 - 2, Pc.frente); R(esq ? fx : fx + 2, y0 + 1, 1, yb - y0 - 2, sh(Pc.frente, -.2)); }
  if (Pc.puxa){ const px2 = esq ? fx + 2 : fx; R(px2, y0 + hT + 3, 1, 4, Pc.puxa); if (alt > 18) R(px2, yb - 9, 1, 4, Pc.puxa); }
  if (Pc.bocas){ for (let j = y0 + 1; j + 3 <= y0 + hT; j += 6) for (let i = x + 3; i + 4 <= x + W2 - 3; i += 6){ R(i, j, 4, 3, "#1F1A28"); R(i + 1, j + 1, 2, 1, "#77708A"); } R(esq ? x + W2 - 4 : x + 2, y0 + hT + 2, 2, 2, C.gold); }
  if (Pc.cuba && hT >= 7){ rbox(x + 3, y0 + 2, W2 - 6, hT - 4, "#AEBECB"); R(x + 4, y0 + 3, W2 - 8, hT - 6, "#CBD8E2"); P(esq ? x + W2 - 4 : x + 3, y0 + 1, C.metalD); }
  else if (Pc.cuba) R(x + 4, y0 + 1, W2 - 8, 1, "#AEBECB");
}
function spriteVirt(t, f, cor){
  const c = CAT[t], b = c.base, r = c.rot, top = TOP[b] || 0, key = "fv:" + t + ":" + f + ":" + (cor | 0);
  let s = sprCache.get(key); if (s) return s;
  if (GIRO[b] === "bit"){
    const base = furnSprite(b, f, cor).c, bw = base.width, bh = base.height, cv = document.createElement("canvas"), x = cv.getContext("2d");
    if (r === 2){ cv.width = bw; cv.height = bh; x.imageSmoothingEnabled = false; x.translate(bw, bh); x.rotate(Math.PI); }
    // r = 1: gira no sentido horário (o encosto vai pra direita, fica virado pra esquerda); r = 3: anti-horário
    else { cv.width = bh; cv.height = bw; x.imageSmoothingEnabled = false; if (r === 1){ x.translate(bh, 0); x.rotate(Math.PI / 2); } else { x.translate(0, bw); x.rotate(-Math.PI / 2); } }
    x.drawImage(base, 0, 0);
    s = { c: cv, ox: r === 3 ? top : 0, oy: 0 };
    sprCache.set(key, s); return s;
  }
  s = sprite(key, c.w * T, c.h * T + top, (ox, oy) => {
    if (r === 2) drawCostas(b, ox, oy, c.w * T, c.h * T, top); else drawLado(b, ox, oy, c.w * T, c.h * T, top, r);
    if (cor) recolorir(b, cor);
  }, !c.chao);
  s.ox = 0; s.oy = top;
  return s;
}
// ganchos de desenho: cor, giro e família (frames e efeitos)
{ const f0 = furnSprite; furnSprite = function(t, f, cor){
  const c = CAT[t]; if (!c) return f0(t, f);
  if (c.virt) return spriteVirt(t, f, cor | 0);
  cor = cor | 0; if (!cor || !CORES[t]) return f0(t, f);
  const top = TOP[t] || 0;
  return sprite("f:" + t + ":" + f + ":c" + cor, c.w * T, c.h * T + top, (ox, oy) => { drawFurn(t, ox, oy + top, f); recolorir(t, cor); }, !c.chao);
}; }
blitFurn = function(t, x, y, f, cor){
  const s = furnSprite(t, f, cor);
  ctx.drawImage(s.c, Math.round(x - 1 - (s.ox || 0)), Math.round(y - (s.oy != null ? s.oy : (TOP[t] || 0)) - 1));
};
blitFurnParte = function(t, f, x, y, r, cor){
  const s = furnSprite(t, f, cor), top = s.oy != null ? s.oy : (TOP[t] || 0);
  ctx.drawImage(s.c, r[0] + 1 + (s.ox || 0), r[1] + top + 1, r[2], r[3], Math.round(x + r[0]), Math.round(y + r[1]), r[2], r[3]);
};
{ const f0 = furnFrame; furnFrame = (t, on, tm, ph) => f0(FAM[baseT(t)] && FAM[baseT(t)] !== "geladeira" ? FAM[baseT(t)] : baseT(t), on, tm, ph); }
{ const f0 = drawFx; drawFx = function(t, x, y, tm){
  const c = CAT[t]; if (c && c.virt) return; // girado: sem vapor/água desenhados de frente
  const b = FAM[t] && FAM[t] !== "geladeira" ? FAM[t] : t;
  return f0(b, x + (t === "fogaoChique" ? 2 : 0), y, tm);
}; }
// local: móvel girado vira o tipo virtual (o banco continua com t e rot)
{ const f0 = aplicarMoveis; aplicarMoveis = function(){
  f0(); let mud = false;
  for (const [id, m] of Object.entries(moveis)){ const r = m.rot | 0; if (r > 0 && r < 4 && GIRO[m.t] && CAT[m.t + "@" + r]){ moveis[id] = Object.assign({}, m, { t: m.t + "@" + r, tb: m.t }); mud = true; } }
  if (mud) rebuildOcc();
}; }

// ---------------- girar, cor e melhorar ----------------
function girar(id){
  const m = moveis[id]; if (!m) return;
  const b = baseT(m.t), r0 = CAT[m.t].rot || 0;
  for (let i = 1; i < 4; i++){
    const r = (r0 + i) % 4, vt = r ? b + "@" + r : b;
    if (!canPlace(vt, m.x, m.y, id)) continue;
    txn("casa/moveis/" + id, cur => { if (!cur || cur.t !== b) return; if (r) cur.rot = r; else delete cur.rot; return cur; })
      .then(ok => { toast(ok ? CAT[b].nome + ": " + GIRO_TXT[r] + "." : "Esse móvel não está mais na casa."); if (ok) sfx("pop"); });
    return;
  }
  toast("Não tem espaço pra girar aqui. Mova pra um lugar mais livre.");
}
function menuCor(id, p){
  const m = moveis[id]; if (!m) return; const b = baseT(m.t), def = CORES[b]; if (!def) return;
  openMenu(p, "Cor: " + CAT[b].nome, def.v.map((v, i) => ({ nome: (i === (m.cor | 0) ? "✓ " : "") + v.nome, info: i ? "grátis" : "original", fn: () => {
    txn("casa/moveis/" + id, cur => { if (!cur) return; if (i) cur.cor = i; else delete cur.cor; return cur; }).then(ok => { if (ok){ toast(CAT[b].nome + ": " + v.nome.toLowerCase() + "."); sfx("pop"); } });
  } })));
}
function melhorItem(id){
  const m = moveis[id]; if (!m) return null;
  const b = baseT(m.t), nx = VERSAO_PROX[b]; if (!nx || !CAT[nx]) return null;
  const trava = CAT[nx].nivel && nivelCasal() < CAT[nx].nivel, dif = Math.max(0, CAT[nx].preco - CAT[b].preco);
  return { nome: "⬆ Melhorar: " + CAT[nx].nome, info: trava ? "🔒 Nível " + CAT[nx].nivel : "$" + dif, fn: () => melhorar(id) };
}
function melhorar(id){
  const m = moveis[id]; if (!m) return;
  const b = baseT(m.t), nx = VERSAO_PROX[b]; if (!nx) return;
  if (CAT[nx].nivel && nivelCasal() < CAT[nx].nivel){ toast(CAT[nx].nome + " libera no nível " + CAT[nx].nivel + " do casal."); return; }
  const rot = GIRO[nx] ? (CAT[m.t].rot || 0) : 0, vt = rot ? nx + "@" + rot : nx;
  if (!canPlace(vt, m.x, m.y, id)){ toast(CAT[nx].nome + " é maior e não cabe aí. Abra espaço do lado (ou mova o móvel)."); return; }
  const dif = Math.max(0, CAT[nx].preco - CAT[b].preco);
  if (!gastar(dif, CAT[nx].nome.toLowerCase())) return;
  txn("casa/moveis/" + id, cur => { if (!cur || cur.t !== b) return; cur.t = nx; if (!rot) delete cur.rot; if (!CORES[nx]) delete cur.cor; return cur; }).then(ok => {
    if (!ok){ ganhar(dif); toast("Não deu pra melhorar agora."); return; }
    toast("Agora é " + CAT[nx].nome.toLowerCase() + "! -$" + dif); sfx("moeda"); burst(m.x + CAT[m.t].w / 2 - .5, m.y, "brilho");
  });
}
function venderMovel(f){
  const m = moveis[f]; if (!m) return; const c = CAT[m.t], volta = Math.round(c.preco * .7);
  txn("casa/moveis/" + f, cur => cur ? null : undefined).then(ok => {
    if (!ok){ toast("Esse móvel já saiu da casa."); return; }
    if (m.t === "canteiro") ref("casa/jardim/" + f).remove().catch(() => {});
    ganhar(volta); toast("Venda feita: " + c.nome + ". +$" + volta);
  });
}
function menuMovelBuild(f, p){
  const m = moveis[f]; if (!m) return; const c = CAT[m.t], b = baseT(m.t), it = [];
  it.push({ nome: "Mover", fn: () => { tool = { kind: "mover", t: m.t, id: f }; if (buildTab === "obra") buildTab = "mov"; renderBuild(); toast("Toque no lugar novo."); } });
  if (GIRO[b]) it.push({ nome: "↻ Girar", info: GIRO_TXT[c.rot || 0], fn: () => girar(f) });
  if (CORES[b]) it.push({ nome: "🎨 Cor", info: CORES[b].v[m.cor | 0] ? CORES[b].v[m.cor | 0].nome : "", fn: () => menuCor(f, p) });
  const up = melhorItem(f); if (up) it.push(up);
  it.push({ nome: "Vender", info: "+$" + Math.round(c.preco * .7), fn: () => venderMovel(f) });
  openMenu(p, c.nome, it);
}
{ const f0 = furnMenu; furnMenu = function(id, p){
  const m = moveis[id]; if (!m) return;
  const up = !visitando && melhorItem(id);
  if (!up) return f0(id, p);
  const c = CAT[m.t], items = c.acoes.map(a => ({ nome: a.nome, info: ganhoTxt(a), fn: () => useFurn(id, a) }));
  if (MENU_EXTRA[m.t]) items.push(...MENU_EXTRA[m.t](id, m));
  items.push(up);
  openMenu(p, c.nome, items);
}; }
// TV grande (e TV comum com sofá grande na frente): assiste sentado no sofá
function sofaDaTela(m){ return sofaDaTv(m); } // leva 12: sofaDaTv já vê TV grande/girada e sofá grande/girado
{ const f0 = useFurn; useFurn = function(id, a){
  const m = moveis[id];
  if (m && a && a.id === "tv" && !a.tela && ["tv", "tvG"].includes(baseT(m.t))){ const s = sofaDaTela(m); if (s) return f0(s, Object.assign({}, a, { tela: id, cima: 1, sobre: 1 })); }
  return f0(id, a);
}; }
// fogão: o ritmo da receita depende da versão
{ const f0 = cozinhar; cozinhar = function(fogaoId, rk){
  const m = moveis[fogaoId], r = RECEITAS[rk], k = m ? FOGO_RITMO[baseT(m.t)] || 1 : 1;
  if (!r || k === 1) return f0(fogaoId, rk);
  const d0 = r.dur; r.dur = Math.max(3, Math.round(d0 * k));
  try { return f0(fogaoId, rk); } finally { r.dur = d0; }
}; }

// ---------------- móveis no modo zero: onde podem ficar ----------------
function jogadorEm(x, y){
  if (me && me.tx === x && me.ty === y) return true;
  return Object.entries(jogadores).some(([id, j]) => id !== pid && j.online && (j.andar || 0) === andarAtual && j.x === x && j.y === y);
}
{ const f0 = canPlace; canPlace = function(t, x, y, ignore){
  if (!zeroAqui()) return f0(t, x, y, ignore);
  const c = CAT[t]; if (!c) return false;
  for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++){
    const xx = x + dx, yy = y + dy;
    if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1 || MAP[yy][xx] !== 0) return false;
    if (!c.chao && occ[yy][xx] && occ[yy][xx] !== ignore) return false;
    const fora = comodo(xx, yy) === "quintal";
    if (c.fora ? !fora : (!c.livre && fora)) return false;
    if (!c.chao && zPassagem.has(kxy(xx, yy))) return false;
  }
  if (c.chao){ for (const [id, m] of Object.entries(moveis)){ if (id === ignore || !CAT[m.t] || !CAT[m.t].chao) continue; const o = CAT[m.t]; if (x < m.x + o.w && x + c.w > m.x && y < m.y + o.h && y + c.h > m.y) return false; } }
  if (!c.chao){ for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++) if (jogadorEm(x + dx, y + dy)) return false; }
  if (escondeDecor(t, x, y)) return false;
  return true;
}; }
function motivoZero(t, x, y, ignore){
  const c = CAT[t];
  for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++){
    const xx = x + dx, yy = y + dy;
    if (!MAP[yy] || xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1 || MAP[yy][xx] !== 0) return "Não cabe aí: tem parede, porta ou cerca no caminho.";
    const fora = comodo(xx, yy) === "quintal";
    if (c.fora && !fora) return "Esse é de área externa: vai do lado de fora.";
    if (!c.fora && !c.livre && fora) return "Esse móvel é de dentro de casa: coloque num cômodo fechado (com paredes e porta).";
    if (!c.chao && zPassagem.has(kxy(xx, yy))) return "Aí é a passagem de uma porta: fica livre.";
  }
  return escondeDecor(t, x, y) ? "Esse móvel é alto e esconderia a decoração da parede." : "Não cabe aí. Tente outro lugar.";
}

// ---------------- obras: paredes, portas e janelas ----------------
function linhaObra(a, b){
  const out = [], dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.abs(dx) >= Math.abs(dy)){ const s = Math.sign(dx) || 1; for (let i = 0; i <= Math.abs(dx); i++) out.push([a[0] + i * s, a[1]]); }
  else { const s = Math.sign(dy); for (let i = 0; i <= Math.abs(dy); i++) out.push([a[0], a[1] + i * s]); }
  return out.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H);
}
function posJogadores(){
  const l = []; if (me) l.push([me.tx, me.ty]);
  for (const [id, j] of Object.entries(jogadores)) if (id !== pid && j.online && (j.andar || 0) === 0) l.push([j.x, j.y]);
  return l;
}
// confere um estado proposto da obra: portas com parede dos lados e passagem livre, janelas e decoração com parede de frente, ninguém preso
function validarObra(pa, po, ja){
  const g = []; for (let y = 0; y < H; y++){ const r = []; for (let x = 0; x < W; x++){ const k = kxy(x, y); r.push(bordaZ(x, y) ? 1 : po[k] ? 2 : pa[k] ? 1 : 0); } g.push(r); }
  const par = (x, y) => y >= 0 && y < H && x >= 0 && x < W && g[y][x] !== 0;
  for (const k of Object.keys(po)){
    if (!po[k]) continue; const [x, y] = xyk(k);
    const hz = par(x - 1, y) && par(x + 1, y) && !par(x, y - 1) && !par(x, y + 1), vt = par(x, y - 1) && par(x, y + 1) && !par(x - 1, y) && !par(x + 1, y);
    if (!hz && !vt) return { ok: false, msg: "Uma porta ficaria sem parede dos lados ou com parede na frente." };
  }
  const face = (x, y) => g[y] && g[y][x] === 1 && g[y + 1] && g[y + 1][x] !== 1;
  for (const k of Object.keys(ja)){ if (!ja[k]) continue; const [x, y] = xyk(k); if (!face(x, y)) return { ok: false, msg: "Uma janela ficaria tampada (ou sem parede)." }; }
  for (const [, d] of decorDoAndar()) if (!face(d.x, d.y)) return { ok: false, msg: "Uma decoração da parede ficaria tampada. Tire ela antes." };
  const vis = g.map(r => r.map(() => false)), q = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if ((x === 1 || y === 1 || x === W - 2 || y === H - 2) && g[y][x] !== 1){ vis[y][x] = true; q.push([x, y]); }
  while (q.length){ const [x, y] = q.pop(); for (const [dx, dy] of DIRS4){ const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || vis[ny][nx] || g[ny][nx] === 1) continue; vis[ny][nx] = true; q.push([nx, ny]); } }
  const preso = (x, y) => g[y] && g[y][x] !== 1 && !vis[y][x];
  for (const m of Object.values(moveis)){ const c = CAT[m.t]; if (!c) continue; for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++) if (preso(m.x + dx, m.y + dy)) return { ok: false, msg: "Isso deixaria " + c.nome.toLowerCase() + " preso num cômodo sem porta." }; }
  for (const [x, y] of posJogadores()) if (preso(x, y)) return { ok: false, msg: "Isso prenderia alguém num cômodo sem porta." };
  return { ok: true };
}
function checaTileParede(x, y){
  if (bordaZ(x, y)) return "A cerca do terreno não leva parede.";
  if (MAP[y][x] === 2) return "Aí tem uma porta.";
  if (occ[y][x] || tapeteAt(x, y)) return "Tem móvel no caminho da parede.";
  if (jogadorEm(x, y)) return "Tem alguém em pé aí.";
  return null;
}
function avaliarLinha(a, b, kind){
  const tiles = linhaObra(a, b), pa = Object.assign({}, obra.paredes || {}), po = Object.assign({}, obra.portas || {}), ja = Object.assign({}, obra.janelas || {});
  if (kind === "parede"){
    const novos = tiles.filter(([x, y]) => !pa[kxy(x, y)] && !po[kxy(x, y)]);
    if (!novos.length) return { ok: false, tiles, msg: "Aí já tem parede." };
    for (const [x, y] of novos){ const e = checaTileParede(x, y); if (e) return { ok: false, tiles, msg: e }; pa[kxy(x, y)] = 1; }
    const custo = novos.length * PRECO_PAREDE, txt = novos.length + (novos.length > 1 ? " paredes" : " parede") + " · $" + custo;
    const v = validarObra(pa, po, ja); if (!v.ok) return { ok: false, tiles, txt, msg: v.msg };
    if (me && me.dinheiro < custo) return { ok: false, tiles, txt, msg: "Faltam $" + Math.ceil(custo - me.dinheiro) + " pra essas paredes." };
    return { ok: true, tiles, novos, custo, txt };
  }
  const rem = tiles.filter(([x, y]) => !bordaZ(x, y) && (pa[kxy(x, y)] || po[kxy(x, y)]));
  if (!rem.length) return { ok: false, tiles, msg: "Não tem parede aí pra apagar." };
  let volta = 0;
  for (const [x, y] of rem){
    const k = kxy(x, y); if (decorEm(x, y)) return { ok: false, tiles, msg: "Tem decoração nessa parede. Tire ela antes." };
    volta += DEVOLVE_PAREDE + (po[k] ? DEVOLVE_PORTA : 0) + (ja[k] ? DEVOLVE_JANELA : 0); delete pa[k]; delete po[k]; delete ja[k];
  }
  const txt = "Apagar " + rem.length + (rem.length > 1 ? " paredes" : " parede") + " · +$" + volta, v = validarObra(pa, po, ja);
  return v.ok ? { ok: true, tiles, rem, volta, txt } : { ok: false, tiles, txt, msg: v.msg };
}
let avalCache = { k: "", v: null };
function avaliarCache(a, b, kind){ const k = [a, b, kind, obraSigC, occVer, me ? Math.floor(me.dinheiro) : 0].join("|"); if (avalCache.k !== k) avalCache = { k, v: avaliarLinha(a, b, kind) }; return avalCache.v; }
function confirmarLinha(){
  if (!obraSel || !obraSel.b || !tool) return;
  const kind = tool.kind, inf = avaliarLinha(obraSel.a, obraSel.b, kind);
  if (!inf.ok){ toast(inf.msg || "Não dá pra fazer isso aí."); return; }
  const up = {};
  if (kind === "parede"){
    if (!gastar(inf.custo, "as paredes")) return;
    for (const [x, y] of inf.novos) up["paredes/" + kxy(x, y)] = 1;
    ref("casa/obra").update(up).then(() => { toast((inf.novos.length > 1 ? inf.novos.length + " paredes novas" : "Parede nova") + ". -$" + inf.custo); sfx("pop"); }, () => { ganhar(inf.custo); toast("Não deu pra construir agora."); });
  } else {
    for (const [x, y] of inf.rem){ const k = kxy(x, y); up["paredes/" + k] = null; up["portas/" + k] = null; up["janelas/" + k] = null; if (obra.entrada === k) up.entrada = null; }
    ref("casa/obra").update(up).then(() => { ganhar(inf.volta); toast("Parede derrubada. +$" + inf.volta); }, () => toast("Não deu pra apagar agora."));
  }
  obraSel = null; renderBuild();
}
// porta: numa parede reta (ou num vão de um quadrado entre duas paredes); janela: numa parede de frente
function podeAbertura(kind, x, y){
  if (!MAP[y] || bordaZ(x, y)) return { ok: false, msg: kind === "porta" ? "A cerca não leva porta." : "A cerca não leva janela." };
  const k = kxy(x, y), pa = obra.paredes || {}, po = obra.portas || {}, ja = obra.janelas || {};
  if (kind === "porta"){
    if (po[k]) return { ok: false, msg: "Aí já tem porta." };
    let custo = PRECO_PORTA;
    if (!pa[k]){
      const ww = (a, b) => parede1(a, b);
      if (MAP[y][x] !== 0 || !((ww(x - 1, y) && ww(x + 1, y)) || (ww(x, y - 1) && ww(x, y + 1)))) return { ok: false, msg: "A porta vai numa parede reta (ou num vão de um quadrado entre duas paredes)." };
      if (occ[y][x] || tapeteAt(x, y) || jogadorEm(x, y)) return { ok: false, msg: "Tem coisa nesse vão." };
      custo += PRECO_PAREDE;
    }
    if (ja[k]) return { ok: false, msg: "Aí tem uma janela. Tire ela antes." };
    if (decorEm(x, y)) return { ok: false, msg: "Tem decoração nessa parede. Tire ela antes." };
    const pa2 = Object.assign({}, pa, { [k]: 1 }), po2 = Object.assign({}, po, { [k]: 1 }), v = validarObra(pa2, po2, ja);
    if (!v.ok) return { ok: false, msg: /porta/.test(v.msg) ? "A porta vai numa parede reta, com parede dos dois lados e passagem livre." : v.msg };
    const hz = parede1(x - 1, y) || isWallAt(x - 1, y);
    for (const [a, b] of hz ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]]) if (occ[b] && occ[b][a]) return { ok: false, msg: "Tem móvel na frente: a porta ficaria bloqueada." };
    return { ok: true, custo, novaParede: !pa[k] };
  }
  if (!pa[k] || po[k]) return { ok: false, msg: "A janela vai numa parede." };
  if (ja[k]) return { ok: false, msg: "Aí já tem janela." };
  if (!isFace(x, y)) return { ok: false, msg: "A janela precisa de chão na frente: use uma parede com o lado de baixo livre." };
  if (!parede1(x - 1, y) && !parede1(x + 1, y)) return { ok: false, msg: "Essa parede é de lado. A janela vai numa parede de frente (deitada)." };
  if (decorEm(x, y)) return { ok: false, msg: "Tem decoração nessa parede. Tire ela antes." };
  if (moveAltoEm(x, y + 1)) return { ok: false, msg: "Tem um móvel alto na frente dessa parede." };
  return { ok: true, custo: PRECO_JANELA };
}
let aberturasCache = { k: "", s: null };
function aberturasOk(kind){
  const k = kind + "|" + obraSigC + "|" + occVer + "|" + Object.keys(decor).length;
  if (aberturasCache.k !== k){ const s = new Set(); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if ((MAP[y][x] !== 0 || kind === "porta") && podeAbertura(kind, x, y).ok) s.add(kxy(x, y)); aberturasCache = { k, s }; }
  return aberturasCache.s;
}
function conectaFora(x, y){ for (const [dx, dy] of DIRS4) if (MAP[y + dy] && MAP[y + dy][x + dx] === 0 && comodo(x + dx, y + dy) === "quintal") return true; return false; }
function colocarAbertura(kind, x, y){
  const r = podeAbertura(kind, x, y); if (!r.ok){ toast(r.msg); return; }
  const k = kxy(x, y), nome = kind === "porta" ? "a porta" : "a janela";
  if (!gastar(r.custo, nome)) return;
  const up = kind === "porta" ? { ["paredes/" + k]: 1, ["portas/" + k]: 1 } : { ["janelas/" + k]: 1 };
  if (kind === "porta" && !entradaZero() && conectaFora(x, y)) up.entrada = k;
  ref("casa/obra").update(up).then(() => { toast((kind === "porta" ? "Porta nova" : "Janela nova") + "! -$" + r.custo); sfx(kind === "porta" ? "porta" : "pop"); }, () => { ganhar(r.custo); toast("Não deu pra colocar agora."); });
}
function menuPorta(x, y, p){
  const k = kxy(x, y), e = entradaZero(), it = [];
  if (e && e.k === k) it.push({ nota: 1, nome: "Porta de entrada: as visitas batem aqui." });
  else if (conectaFora(x, y)) it.push({ nome: "Virar a porta de entrada", info: "Visitas", fn: () => ref("casa/obra/entrada").set(k).then(() => toast("Agora essa é a porta de entrada.")) });
  it.push({ nome: "Tirar a porta", info: "+$" + DEVOLVE_PORTA, fn: () => {
    const po = Object.assign({}, obra.portas || {}); delete po[k];
    const v = validarObra(obra.paredes || {}, po, obra.janelas || {}); if (!v.ok){ toast(v.msg); return; }
    const up = { ["portas/" + k]: null }; if (obra.entrada === k) up.entrada = null;
    ref("casa/obra").update(up).then(() => { ganhar(DEVOLVE_PORTA); toast("Porta virou parede. +$" + DEVOLVE_PORTA); });
  } });
  openMenu(p, "Porta", it);
}
function menuJanela(x, y, p){
  const k = kxy(x, y);
  openMenu(p, "Janela", [{ nome: "Tirar a janela", info: "+$" + DEVOLVE_JANELA, fn: () => ref("casa/obra/janelas/" + k).remove().then(() => { ganhar(DEVOLVE_JANELA); toast("Janela tirada. +$" + DEVOLVE_JANELA); }) }]);
}
function nomearComodo(id, tipo){
  const r = zRooms.find(q => q.id === id), c = (obra.comodos || {})[id] || {};
  const ax = typeof c.ax === "number" ? c.ax : r ? r.tiles[0][0] : 0, ay = typeof c.ay === "number" ? c.ay : r ? r.tiles[0][1] : 0;
  ref("casa/obra/comodos/" + id).update({ nome: tipo, ax, ay }).then(() => toast("Agora é " + TIPOS_COMODO[tipo].nome.toLowerCase() + ".")).catch(() => toast("Não deu pra trocar o nome agora."));
}
function menuComodo(id, p){
  const atual = tipoC(id);
  openMenu(p, (COMODOS[id] || "Cômodo") + ": que cômodo é?", Object.entries(TIPOS_COMODO).filter(([k]) => k !== "comodo").map(([k, t]) => ({ nome: (k === atual ? "✓ " : "") + t.nome, fn: () => nomearComodo(id, k) })));
}
function obraClick(tx, ty, p){
  if (!MAP[ty] || tx < 0 || tx >= W) return;
  if (!tool){
    const k = kxy(tx, ty);
    if ((obra.portas || {})[k]) return menuPorta(tx, ty, p);
    if ((obra.janelas || {})[k]) return menuJanela(tx, ty, p);
    const f = furnAt(tx, ty) || tapeteAt(tx, ty); if (f && moveis[f]) return menuMovelBuild(f, p);
    const cm = comodo(tx, ty); if (MAP[ty][tx] === 0 && cm !== "quintal"){ obraFoco = cm; return menuComodo(cm, p); }
    toast("Escolha uma ferramenta: parede, apagar, porta ou janela."); return;
  }
  if (tool.kind === "parede" || tool.kind === "apagar"){
    if (!obraSel){ obraSel = { a: [tx, ty], b: null }; toast(tool.kind === "parede" ? "Agora toque onde a parede termina." : "Agora toque onde termina o trecho pra apagar."); renderBuild(); return; }
    if (!obraSel.b){ obraSel.b = [tx, ty]; renderBuild(); const inf = avaliarLinha(obraSel.a, obraSel.b, tool.kind); toast(inf.ok ? inf.txt + ". Toque em Confirmar (ou no mesmo lugar de novo)." : inf.msg); return; }
    if (obraSel.b[0] === tx && obraSel.b[1] === ty){ confirmarLinha(); return; }
    obraSel = { a: [tx, ty], b: null }; toast("Começou outra linha. Toque onde ela termina."); renderBuild(); return;
  }
  if (tool.kind === "porta" || tool.kind === "janela") colocarAbertura(tool.kind, tx, ty);
}
{ const f0 = buildClick; buildClick = function(tx, ty, p){
  if (zeroAqui() && buildTab === "obra"){ obraClick(tx, ty, p); return; }
  if (!tool && !decorEm(tx, ty)){ const f = furnAt(tx, ty) || tapeteAt(tx, ty); if (f && moveis[f]){ menuMovelBuild(f, p); return; } }
  if (zeroAqui() && tool && (tool.kind === "novo" || tool.kind === "mover") && CAT[tool.t] && !(CAT[tool.t].nivel && nivelCasal() < CAT[tool.t].nivel) && !canPlace(tool.t, tx, ty, tool.id)){ toast(motivoZero(tool.t, tx, ty, tool.id)); return; }
  return f0(tx, ty, p);
}; }

// ---------------- painel da aba Obras ----------------
function hintObra(){
  if (!tool) return "Escolha uma ferramenta. Toque num cômodo pra dizer o que ele é, ou numa porta/janela pra tirar. Cômodo = área fechada por paredes, com porta.";
  if (tool.kind === "parede") return !obraSel ? "Toque no quadrado onde a parede começa ($" + PRECO_PAREDE + " cada quadrado)." : !obraSel.b ? "Agora toque onde ela termina (em linha reta)." : "Confira a prévia e toque em Confirmar (ou no mesmo fim de novo).";
  if (tool.kind === "apagar") return !obraSel ? "Toque no começo do trecho de parede pra derrubar (devolve $" + DEVOLVE_PAREDE + " cada)." : !obraSel.b ? "Agora toque onde o trecho termina." : "Confira e toque em Confirmar.";
  if (tool.kind === "porta") return "Toque numa parede reta (verde) pra pôr uma porta ($" + PRECO_PORTA + "). Num vão de um quadrado entre duas paredes também vale.";
  return "Toque numa parede de frente (verde) pra pôr uma janela ($" + PRECO_JANELA + "). Ela mostra o céu, o tempo e a estação.";
}
function ajudaMudanca(){
  if (!casaZero || !casaCriada) return 1;
  const d = Math.floor((srvNow() - casaCriada) / (24 * HORA));
  return d < 0 || d >= 7 ? 1 : 1 + .5 * (7 - d) / 7;
}
function pagaMudanca(v){ return Math.round(v * ajudaMudanca()); }
function ajudaTxt(){
  const k = ajudaMudanca(); if (k <= 1) return "";
  const d = 7 - Math.floor((srvNow() - casaCriada) / (24 * HORA));
  return "Ajuda de mudança: tarefas e trabalho pagam +" + Math.round((k - 1) * 100) + "% (" + (d > 1 ? "mais " + d + " dias" : "último dia") + ", diminuindo a cada dia).";
}
function renderObra(){
  const box = $("obraBox"); if (!box) return;
  const inf = obraSel && obraSel.b && tool ? avaliarLinha(obraSel.a, obraSel.b, tool.kind) : null;
  const sig = JSON.stringify([tool, obraSel, inf && [inf.ok, inf.txt, inf.msg], zRooms.map(r => [r.id, r.tiles.length, COMODOS[r.id], tipoC(r.id)]), Object.keys(metas), ajudaTxt(), me ? Math.floor(me.dinheiro) : 0]);
  if (sig === obraUISig && box.childNodes.length) return; obraUISig = sig;
  box.textContent = "";
  const fer = el("div", "obraTools");
  const mk = (k, ic, nome, pr) => {
    const b = btn("", "btn ghost obraT", () => { tool = tool && tool.kind === k ? null : { kind: k }; obraSel = null; renderBuild(); });
    b.append(el("span", "ic", ic), el("span", null, nome), el("small", null, pr)); b.setAttribute("aria-pressed", String(!!(tool && tool.kind === k)));
    b.setAttribute("aria-label", nome + ", " + pr); return b;
  };
  fer.append(mk("parede", "🧱", "Parede", "$" + PRECO_PAREDE + " cada"), mk("apagar", "🧽", "Apagar", "+$" + DEVOLVE_PAREDE + " cada"), mk("porta", "🚪", "Porta", "$" + PRECO_PORTA), mk("janela", "🪟", "Janela", "$" + PRECO_JANELA));
  box.append(fer);
  if (inf){
    const row = el("div", "obraConf"); row.setAttribute("role", "status");
    row.append(el("span", null, inf.ok ? inf.txt : (inf.txt ? inf.txt + " · " : "") + inf.msg));
    const ok = btn(tool.kind === "parede" ? "Construir" : "Derrubar", "btn", confirmarLinha); ok.disabled = !inf.ok;
    row.append(ok, btn("Cancelar", "btn ghost", () => { obraSel = null; renderBuild(); }));
    box.append(row);
  }
  const aj = ajudaTxt(); if (aj) box.append(el("p", "muted ajuda11", "📦 " + aj));
  box.append(el("p", "sec", "Cômodos"));
  if (!zRooms.length) box.append(el("p", "muted", "Nenhum cômodo fechado ainda. Feche uma área com paredes (e uma porta) pra ela virar cômodo."));
  const lista = el("div", "list");
  for (const r of zRooms.slice().sort((a, b) => a.cy - b.cy || a.cx - b.cx)){
    const row = el("div", "rowi"), tx = el("div", "tx"), id = "sel11_" + r.id;
    tx.append(el("strong", null, COMODOS[r.id] || "Cômodo"), el("small", null, r.tiles.length + " quadrados"));
    const lab = el("label", "vh", "Tipo do cômodo " + (COMODOS[r.id] || "")); lab.htmlFor = id;
    const sel = el("select"); sel.id = id;
    for (const [k, t] of Object.entries(TIPOS_COMODO)){ const o = el("option", null, t.nome); o.value = k; if (k === tipoC(r.id)) o.selected = true; sel.append(o); }
    sel.onchange = () => nomearComodo(r.id, sel.value);
    sel.onfocus = () => { obraFoco = r.id; }; sel.onblur = () => { if (obraFoco === r.id) obraFoco = null; };
    row.onmouseenter = () => { obraFoco = r.id; }; row.onmouseleave = () => { if (obraFoco === r.id) obraFoco = null; };
    row.append(tx, lab, sel); lista.append(row);
  }
  box.append(lista);
  const feitas = METAS.filter(m => metas[m.id]).length, mb = btn("", "btn ghost escolha", openMetas);
  mb.append(el("strong", null, "🏡 Metas do lar · " + feitas + "/" + METAS.length), el("small", null, proximaMetaTxt()));
  box.append(el("p", "sec", "Metas"), mb);
}
{ const f0 = renderBuild; renderBuild = function(){
  if (buildTab === "obra" && !zeroAqui()) buildTab = "mov";
  if (!tool || (tool.kind !== "parede" && tool.kind !== "apagar")) obraSel = null;
  f0();
  const to = $("tObra"); if (to){ to.hidden = !zeroAqui(); to.setAttribute("aria-pressed", String(buildTab === "obra")); }
  const ob = $("obraBox"); if (ob) ob.hidden = buildTab !== "obra";
  if (buildTab === "obra"){ $("cat").hidden = true; $("floors").hidden = true; $("paredesBox").hidden = true; $("buildHint").textContent = hintObra(); renderObra(); }
}; }
$("tObra").onclick = () => { buildTab = "obra"; tool = null; obraSel = null; renderBuild(); };

// prévia das obras e nomes dos cômodos no modo construir
function leva11Fantasma(){
  if (mode !== "build" || !zeroAqui() || buildTab !== "obra") return;
  if (obraFoco){ const r = zRooms.find(q => q.id === obraFoco); if (r){ ctx.fillStyle = "rgba(142,124,240,.3)"; for (const [x, y] of r.tiles) ctx.fillRect(x * T, y * T, T, T); } }
  if (!tool) return;
  if (tool.kind === "parede" || tool.kind === "apagar"){
    if (!obraSel){ if (hover){ ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(hover.x * T, hover.y * T, T, T); } return; }
    const b = obraSel.b || (hover ? [hover.x, hover.y] : obraSel.a), inf = avaliarCache(obraSel.a, b, tool.kind);
    ctx.fillStyle = !inf.ok ? "rgba(240,112,122,.55)" : tool.kind === "apagar" ? "rgba(250,170,90,.55)" : "rgba(93,202,165,.55)";
    for (const [x, y] of inf.tiles) ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
    ctx.fillStyle = "#FFFFFF"; const [ax, ay] = obraSel.a; ctx.fillRect(ax * T, ay * T, T, 1); ctx.fillRect(ax * T, ay * T + T - 1, T, 1); ctx.fillRect(ax * T, ay * T, 1, T); ctx.fillRect(ax * T + T - 1, ay * T, 1, T);
    return;
  }
  const s = aberturasOk(tool.kind); ctx.fillStyle = "rgba(93,202,165,.3)";
  for (const k of s){ const [x, y] = xyk(k); ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2); }
  if (hover && MAP[hover.y]){ const ok = s.has(kxy(hover.x, hover.y)); ctx.fillStyle = ok ? "rgba(93,202,165,.6)" : "rgba(240,112,122,.45)"; ctx.fillRect(hover.x * T, hover.y * T, T, T); }
}
function drawLabels11(mctx, K, fs){
  if (mode !== "build" || !zeroAqui()) return;
  const f = Math.round(fs * .8);
  mctx.font = "800 " + f + "px Nunito, sans-serif"; mctx.textAlign = "center"; mctx.textBaseline = "middle";
  for (const r of zRooms){
    const nm = COMODOS[r.id] || ""; if (!nm) continue;
    const x = (r.cx + .5) * T * K, y = (r.cy + .5) * T * K;
    mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K); mctx.strokeStyle = "rgba(18,14,28,.85)"; mctx.strokeText(nm, x, y);
    mctx.fillStyle = "#FFF4E0"; mctx.fillText(nm, x, y);
  }
  mctx.textBaseline = "bottom"; mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
}
// luzes dos móveis novos e girados; mural e quadro de troféus do zero (são itens de parede)
function leva11Luzes(lights, ativo, tm){
  for (const [id, m] of Object.entries(moveis)){
    const b = baseT(m.t), c = CAT[m.t]; if (!c) continue;
    const cx = m.x * T + c.w * T / 2;
    if (ativo[id] && (b === "tvG" || (b === "tv" && c.virt))) lights.push([cx, m.y * T + 2, b === "tvG" ? 46 : 38, "140,190,255", .8 + .2 * Math.sin(tm / 110) * Math.sin(tm / 370)]);
    if (ativo[id] && b === "pc" && c.virt) lights.push([cx, m.y * T, 24, "140,190,255", .85]);
    if (ativo[id] && (b === "fogareiro" || b === "fogaoChique" || (b === "fogao" && c.virt))) lights.push([cx, m.y * T + 2, 20, "255,170,90", .8 + .2 * Math.sin(tm / 90)]);
    if (b === "frigobar" || b === "geladeiraG" || (b === "geladeira" && c.virt)) lights.push([cx, m.y * T + 4, 12, "220,235,255", .25]);
    if (ativo[id] && b === "radio") lights.push([cx, m.y * T + 2, 14, "255,214,150", .5]);
  }
  if (zeroAqui()){
    const mu = decorDoAndar().find(([, d]) => d.t === "mural11"), qd = decorDoAndar().find(([, d]) => d.t === "trofeus11");
    MURAL.x = mu ? mu[1].x : -9; MURAL.y = mu ? mu[1].y : -9; QUADRO.x = qd ? qd[1].x : -9; QUADRO.y = qd ? qd[1].y : -9;
  }
}
DECOR_CAT.mural11 = { nome: "Mural de bilhetes", preco: 40, vivo: 1, soZero: 1, anim(x, y, tm){ const ox = MURAL.x, oy = MURAL.y; MURAL.x = x / T; MURAL.y = y / T; drawMural(tm); MURAL.x = ox; MURAL.y = oy; }, menu: () => [{ nome: "Ler e escrever bilhetes", fn: openMural }] };
DECOR_CAT.trofeus11 = { nome: "Quadro de troféus", preco: 60, vivo: 1, soZero: 1, anim(x, y, tm){ const ox = QUADRO.x, oy = QUADRO.y; QUADRO.x = x / T; QUADRO.y = y / T; drawQuadroTrofeus(tm); QUADRO.x = ox; QUADRO.y = oy; }, menu: () => [{ nome: "Ver os troféus", fn: openTrofeus }] };
const HS_FIXOS = HOTSPOTS.filter(h => (h.x === MURAL.x && h.y === MURAL.y) || (h.x === QUADRO.x && h.y === QUADRO.y));
for (const h of HS_FIXOS){ const a0 = h.ativo; h.ativo = () => !casaZero && (!a0 || a0()); }

// ---------------- metas do lar ----------------
const moveisDe = id => Object.values(moveis).filter(m => comodo(m.x, m.y) === id);
const temTipo = (l, ts) => l.some(m => ts.includes(baseT(m.t)));
const comodosDo = tipo => zRooms.filter(r => tipoC(r.id) === tipo);
function comodoTemPorta(id){ const r = zRooms.find(q => q.id === id); return !!r && r.tiles.some(([x, y]) => DIRS4.some(([dx, dy]) => MAP[y + dy] && MAP[y + dy][x + dx] === 2)); }
const METAS = [
  { id: "parede", em: "🧱", nome: "Primeira parede", txt: "Levantem uma parede nova no terreno.", hist: "Levantaram a primeira parede da casa nova", premio: 30, ok: () => Object.keys(obra.paredes || {}).length > PAREDES_INICIAIS },
  { id: "janela", em: "🪟", nome: "Primeira janela", txt: "Coloquem uma janela nova.", hist: "Abriram a primeira janela nova da casa", premio: 50, ok: () => Object.keys(obra.janelas || {}).length > 1 },
  { id: "quarto", em: "🛏️", nome: "Primeiro quarto de verdade", txt: "Um cômodo marcado como quarto, com porta e uma cama (não vale colchão).", hist: "Ganharam o primeiro quarto de verdade", premio: 120, ok: () => comodosDo("quarto").some(r => comodoTemPorta(r.id) && temTipo(moveisDe(r.id), ["solteiro", "casal", "dossel"])) },
  { id: "banheiro", em: "🚿", nome: "Banheiro com porta", txt: "Um banheiro com porta, vaso e chuveiro (ou banheira).", hist: "O banheiro ganhou porta (ufa!)", premio: 120, ok: () => comodosDo("banheiro").some(r => comodoTemPorta(r.id) && temTipo(moveisDe(r.id), ["vaso"]) && temTipo(moveisDe(r.id), ["ducha", "chuveiro", "banheira"])) },
  { id: "cozinha", em: "🍳", nome: "Cozinha completa", txt: "Uma cozinha com geladeira, fogão e pia (frigobar e fogareiro não valem).", hist: "A cozinha ficou completa", premio: 150, ok: () => comodosDo("cozinha").some(r => { const l = moveisDe(r.id); return temTipo(l, ["geladeira", "geladeiraG"]) && temTipo(l, ["fogao", "fogaoChique"]) && temTipo(l, ["pia"]); }) },
  { id: "sala", em: "🛋️", nome: "Sala de estar", txt: "Uma sala com sofá e TV.", hist: "Montaram a sala de estar", premio: 150, ok: () => comodosDo("sala").some(r => { const l = moveisDe(r.id); return temTipo(l, ["sofa", "sofaG"]) && temTipo(l, ["tv", "tvG"]); }) },
  { id: "casal", em: "💞", nome: "Cama de casal", txt: "Uma cama de casal (ou com dossel) em casa.", hist: "Compraram a cama de casal", premio: 100, ok: () => Object.values(todosMoveis).some(m => m && (m.t === "casal" || m.t === "dossel")) },
  { id: "quatro", em: "🏡", nome: "Casa com 4 cômodos", txt: "Quatro cômodos fechados no terreno.", hist: "A casa chegou a 4 cômodos", premio: 200, ok: () => zRooms.length >= 4 }
];
function proximaMetaTxt(){ const m = METAS.find(q => !metas[q.id]); return m ? "Próxima: " + m.nome + " (+$" + m.premio + ")" : "Todas cumpridas! Que casa linda."; }
function checarMetas(){
  if (!me || visitando || !zeroAqui() || !metasCarregadas || !obraCarregada || !moveisCarregados || !zGrid) return;
  for (const m of METAS){
    if (metas[m.id] || metaPend.has(m.id) || !m.ok()) continue;
    metaPend.add(m.id);
    txn("casa/metas/" + m.id, cur => cur ? undefined : { at: srvNow(), por: pid }).then(ok => { if (ok) historia("meta_" + m.id, m.em, m.hist); setTimeout(() => metaPend.delete(m.id), 5000); });
  }
  for (const m of METAS){ // cada um recebe o prêmio uma vez
    const v = metas[m.id]; if (!v || (v.pago && v.pago[pid]) || metaPend.has("pago" + m.id)) continue;
    metaPend.add("pago" + m.id);
    txn("casa/metas/" + m.id + "/pago/" + pid, c => c ? undefined : true).then(ok => { if (ok){ ganhar(m.premio); toast("Meta do lar: " + m.nome + ". +$" + m.premio); } });
  }
}
function openMetas(){
  openPanel("metas", "Metas do lar 🏡", corpo => {
    const info = el("p", "muted"), aj = el("p", "ajuda11"), lista = el("div", "list");
    corpo.append(info, aj, lista);
    const upd = () => {
      info.textContent = "Cada meta cumprida vira uma lembrança em \"Nossa história\" e dá um prêmio pra cada um de vocês.";
      aj.textContent = ajudaTxt() ? "📦 " + ajudaTxt() : ""; aj.hidden = !ajudaTxt();
      lista.textContent = "";
      for (const m of METAS){
        const feita = !!metas[m.id], row = el("div", "rowi" + (feita ? " feita" : "")), esq = el("div", "me"), tx = el("div", "tx");
        esq.style.gap = "10px"; tx.append(el("strong", null, m.em + " " + m.nome), el("small", null, feita ? "Cumprida" : m.txt));
        esq.append(el("span", "chk", feita ? "✓" : ""), tx); row.append(esq, el("span", "money", "+$" + m.premio)); lista.append(row);
      }
    };
    upd(); return upd;
  });
}
{ const f0 = nosBotoes9; nosBotoes9 = function(){
  const g = f0(); if (!zeroAqui()) return g;
  const n = METAS.filter(m => metas[m.id]).length, b = btn("", "btn ghost escolha", openMetas);
  b.append(el("strong", null, "🏡 Metas do lar"), el("small", null, n + "/" + METAS.length + " · " + proximaMetaTxt())); b.setAttribute("aria-label", "Metas do lar: " + n + " de " + METAS.length);
  g.append(b); return g;
}; }

// ---------------- banco: modo, obra, metas ----------------
const JANELAS_PRONTA = new Set(JANELAS), DECOR_PRONTA = Object.assign({}, DECOR), MURAL0 = Object.assign({}, MURAL), QUADRO0 = Object.assign({}, QUADRO);
function restaurarFixos(){
  JANELAS.clear(); for (const k of JANELAS_PRONTA) JANELAS.add(k);
  for (const k of Object.keys(DECOR)) delete DECOR[k]; Object.assign(DECOR, DECOR_PRONTA);
  Object.assign(MURAL, MURAL0); Object.assign(QUADRO, QUADRO0);
}
function aplicarObra(){
  obraSigC = null; obraUISig = "";
  if (casaZero){
    JANELAS.clear(); for (const k of Object.keys(obra.janelas || {})) if (obra.janelas[k]) JANELAS.add(k.replace("_", ","));
    for (const k of Object.keys(DECOR)) delete DECOR[k];
    if (andarAtual !== 0){ andarAtual = 0; if (me){ me.andar = 0; ref("jogadores/" + pid + "/andar").set(0).catch(() => {}); } }
    escadaOn = false;
  } else restaurarFixos();
  remontar(); aplicarMoveis(); if (bg.height !== H * T + TOPO) tamanhoCena(); bgKey = null; luzSig = "";
  if (typeof mascaras !== "undefined") mascaras.clear();
  if (me && !walkable(me.tx, me.ty) && !me.acao){ const [x, y] = freeSpot(); me.tx = me.px = x; me.ty = me.py = y; me.path = []; savePos(); }
  if (mode === "build") renderBuild();
  if (casaZero){
    salvarComodosNovos();
    if (me && !visitando && obraCarregada && obra.entrada && !entradaZero()){ const e = Object.keys(obra.portas || {}).find(k => { const [x, y] = xyk(k); return conectaFora(x, y); }); ref("casa/obra/entrada").set(e || null).catch(() => {}); }
  }
}
function leva11Ouvir(){
  on(ref("casa/modo"), "value", s => { const z = s.val() === "zero"; modoLido = s.exists(); if (z !== casaZero){ casaZero = z; aplicarObra(); } if (modoLido){ marcarCasaOk(); if (me) garantirCasa(); } });
  on(ref("casa/obra"), "value", s => { obra = s.val() || {}; obraCarregada = true; if (casaZero) aplicarObra(); });
  on(ref("casa/criada"), "value", s => { const v = s.val(); casaCriada = typeof v === "number" ? v : 0; });
  on(ref("casa/metas"), "value", s => {
    const ant = metas; metas = s.val() || {};
    if (metasCarregadas && me && casaZero) for (const m of METAS) if (metas[m.id] && !ant[m.id]){ toastEspecial("Meta do lar: " + m.nome + " " + m.em, "+$" + m.premio + " pra cada um. Tá em \"Nossa história\"."); confete(); }
    metasCarregadas = true; refreshPanel("metas"); obraUISig = "";
  });
}
function leva11Reset(){
  const era = casaZero;
  casaZero = false; modoLido = false; obra = {}; obraCarregada = false; metas = {}; metasCarregadas = false; casaCriada = 0;
  obraSel = null; obraFoco = null; zGrid = null; zRooms = []; zPassagem = new Set(); comodosTentados.clear(); metaPend.clear(); obraSigC = null; obraUISig = "";
  restaurarFixos();
  if (era){ andarAtual = 0; montarMapa(false); tamanhoCena(); }
}
setInterval(() => { if (!me) return; checarMetas(); if (zeroAqui() && mode === "build" && buildTab === "obra") renderObra(); }, 2000);
