"use strict";
// Casinha · paredes, janelas, quintal, 2º andar e fundo em cache (ensureBg)
// ---- paredes, janelas e luz ----
const WP = { quarto: ["#BEACEA", "#AC98DE", "listra"], banheiro: ["#C8E8ED", "#A6D4DF", "azulejo"], sala: ["#F2D0AC", "#E3B98E", "losango"], cozinha: ["#F7E3A8", "#EBCB80", "xadrez"],
  // leva 4 (2º andar): suíte florida, banheiro de pastilha verde, sala de jogos azul-noite com estrelinhas, fachada da varanda
  suite: ["#F5DCE6", "#E8BFD0", "floral"], lavabo: ["#CDEBE0", "#A3D6C4", "pastilha"], jogos: ["#3F4B7E", "#36416E", "estrelas"], varanda: ["#F4E6CF", "#DCC6A6", "fachada"] };
const JANELAS = new Set(["2,0", "13,0", "14,0", "4,0"]);
const DECOR = { "3,0": "coracao", "9,0": "paisagem", "12,0": "paisagem2", "5,6": "espelho", "2,6": "toalha", "10,8": "relogio" }; // (9,8): quadro de troféus, desenhado ao vivo (leva 2)
const JANELAS2 = new Set(["2,0", "4,0", "13,0", "15,0"]);
const DECOR2 = { "3,0": "coracao", "12,0": "poster", "1,8": "espelho", "6,8": "toalha", "10,8": "arandela", "15,8": "arandela" };
const janelas = () => andarAtual === 1 ? JANELAS2 : JANELAS;
const decorAtual = () => andarAtual === 1 ? DECOR2 : DECOR;
const CAP = "#7B6276", CAP_L = "#9C8499", CAP_D = "#5B4659", LINE = "#2D1C30";
const VX = 7; // coluna da parede interna vertical (desenhada mais fina)
// modo de teste: ?hora=NN (0–23) troca o relógio real
const HORA_TESTE = (() => { const m = /[?&]hora=(\d{1,2})(?:&|$)/.exec(location.search); const n = m ? +m[1] : -1; return n >= 0 && n <= 23 ? n : null; })();
function hourNow(){ if (HORA_TESTE != null) return HORA_TESTE; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
function skyKind(h){ return h >= 7 && h < 17 ? "dia" : h >= 17 && h < 19 ? "tarde" : h >= 5 && h < 7 ? "manha" : "noite"; }
const SKY = { dia: ["#6DBDF0", "#C4E8F8"], tarde: ["#E8797A", "#FBCB8C"], manha: ["#A99BE0", "#F9C6C6"], noite: ["#141840", "#2D3478"] };
function darkness(h){ if (h >= 8 && h < 17) return 0; if (h >= 17 && h < 20) return (h - 17) / 3 * .5; if (h >= 6 && h < 8) return (8 - h) / 2 * .5; return .5; }

const isWallAt = (x, y) => x < 0 || y < 0 || x >= W || y >= H || MAP[y][x] === 1;
const isFace = (x, y) => y >= 0 && y + 1 < H && x >= 0 && x < W && MAP[y][x] === 1 && MAP[y + 1][x] !== 1;
function pisoDe(cm){ const de2 = COMODOS2.has(cm), pi = (de2 ? pisos2 : pisos)[cm]; return PISOS[typeof pi === "number" ? pi : (de2 ? PISO_PADRAO2 : PISO_PADRAO)[cm]] || PISOS[0]; }

// frente da parede: topo, papel de parede e rodapé
function drawFace(px, py, room){
  const pc = papelDe(room); if (pc){ drawPapel(px, py, pc); return; } // leva 6: papel escolhido no modo construir
  const wp = WP[room] || WP.sala, a = wp[0], b = wp[1];
  R(px, py, T, 3, CAP); R(px, py, T, 1, CAP_L); R(px, py + 3, T, 1, LINE);
  R(px, py + 4, T, 9, a);
  if (wp[2] === "listra"){
    for (let i = 0; i < T; i += 4) R(px + i, py + 4, 2, 9, b);
    for (let i = 2; i < T; i += 8){ P(px + i, py + 7, sh(a, .3)); P(px + i + 4, py + 10, sh(a, .3)); }
  } else if (wp[2] === "azulejo"){
    R(px, py + 8, T, 1, b); R(px, py + 12, T, 1, b);
    for (let i = 3; i < T; i += 4) R(px + i, py + 4, 1, 9, b);
    for (let i = 0; i < T; i += 4){ P(px + i, py + 5, sh(a, .45)); P(px + i, py + 9, sh(a, .45)); }
    R(px, py + 6, T, 1, "#8CC3D2"); for (let i = 1; i < T; i += 4) P(px + i, py + 6, "#EAF7FA");
  } else if (wp[2] === "losango"){
    for (const i of [3, 11]){ P(px + i, py + 5, b); R(px + i - 1, py + 6, 3, 1, b); P(px + i, py + 7, b); P(px + i, py + 6, sh(a, .35)); }
    P(px + 7, py + 6, b); P(px + 15, py + 6, b);
    R(px, py + 8, T, 1, "#D9A877"); R(px, py + 9, T, 4, "#FFF1DC"); R(px, py + 9, T, 1, "#FFFAF0");
    for (let i = 3; i < T; i += 8){ R(px + i, py + 10, 1, 3, "#EAD3B2"); R(px + i + 1, py + 10, 1, 3, "#FFFAF0"); }
  } else if (wp[2] === "floral"){ // florzinhas em cima, lambri branco embaixo
    for (let i = 1; i < T - 2; i += 5){ const k = (px >> 4) + i, fy = py + 4 + (k % 2 ? 1 : 3), c0 = k % 2 ? "#E58FB5" : "#B99BE6";
      P(px + i + 1, fy, c0); P(px + i, fy + 1, c0); P(px + i + 2, fy + 1, c0); P(px + i + 1, fy + 2, c0); P(px + i + 1, fy + 1, "#F6C667"); }
    R(px, py + 9, T, 1, "#C99AB0"); R(px, py + 10, T, 3, "#FFF6F9"); R(px, py + 10, T, 1, "#FFFFFF");
    for (let i = 3; i < T; i += 8) R(px + i, py + 11, 1, 2, "#EAD3DE");
  } else if (wp[2] === "pastilha"){ // pastilhas de vidro verde-água com uma faixa
    for (let j = 0; j < 9; j += 2) for (let i = (j >> 1) % 2; i < T; i += 2) P(px + i, py + 4 + j, b);
    R(px, py + 8, T, 1, "#6FBFA4"); for (let i = 1; i < T; i += 3) P(px + i, py + 8, "#E9F8F2");
  } else if (wp[2] === "estrelas"){ // azul-noite, estrelinhas e faixa neon
    for (let i = 0; i < T; i += 8) R(px + i, py + 4, 4, 5, b);
    const h = hash(px, py, 3); P(px + 2 + h % 11, py + 5 + (h >> 4) % 3, "#FCE9B8");
    if (h % 3 === 0){ const sx = px + 3 + (h >> 7) % 9, sy = py + 6; P(sx, sy - 1, "#FFF6D6"); R(sx - 1, sy, 3, 1, "#FFF6D6"); P(sx, sy + 1, "#FFF6D6"); }
    R(px, py + 9, T, 1, "#E8607A"); R(px, py + 10, T, 1, "#7FD0F5"); R(px, py + 11, T, 2, "#2C3560");
  } else if (wp[2] === "fachada"){ // lado de fora: tábuas de revestimento
    for (let j = 0; j < 9; j += 3){ R(px, py + 4 + j, T, 1, sh(a, .14)); R(px, py + 6 + j, T, 1, b); }
    R(px, py + 12, T, 1, sh(b, -.12));
  } else {
    for (let i = 1; i < T; i += 4){ P(px + i, py + 5, b); P(px + i + 2, py + 7, b); }
    R(px, py + 8, T, 1, "#E09A6A"); for (let i = 0; i < T; i += 4) R(px + i, py + 8, 2, 1, "#FFF6DF");
    R(px, py + 9, T, 4, "#FFF9EA");
    for (let i = 3; i < T; i += 4) R(px + i, py + 9, 1, 4, "#E7DCC0");
    R(px, py + 10, T, 1, "#E7DCC0");
  }
  R(px, py + 4, T, 1, sh(a, -.16));
  R(px, py + 13, T, 1, "#D2A06C"); R(px, py + 14, T, 1, "#A5754B"); R(px, py + 15, T, 1, "#6B4429");
}

// guarda-corpo da varanda (2º andar): corrimão de madeira e balaústres brancos; entre eles aparece a vista lá embaixo
function drawGradil(x, y){
  const px = x * T, py = y * T, md = "#F4EEE6", mdD = "#CFC3B4";
  const lateral = (h) => { // lado direito, visto de cima
    R(px + 6, py, 2, h, "rgba(20,45,30,.3)");
    R(px + 1, py, 5, h, LINE); R(px + 2, py, 3, h, C.wood); R(px + 2, py, 1, h, C.woodL); R(px + 4, py, 1, h, C.woodD);
  };
  if (x === W - 1 && y < HC){ lateral(T); return; }
  const x1 = x === W - 1 ? 6 : T;
  R(px, py + 11, x1, 2, "rgba(20,45,30,.32)");
  R(px, py, x1, 1, LINE); R(px, py + 1, x1, 2, C.wood); R(px, py + 1, x1, 1, C.woodL); R(px, py + 3, x1, 1, C.woodDD);
  for (let i = (x === 8 ? 2 : 1); i < x1; i += 3){ R(px + i, py + 4, 1, 5, md); P(px + i, py + 4, "#FFFFFF"); P(px + i, py + 8, mdD); }
  R(px, py + 9, x1, 1, C.woodD); R(px, py + 10, x1, 1, LINE);
  if (x === 8){ R(px, py, 1, 11, LINE); R(px + 1, py + 1, 1, 9, C.woodD); } // encontra a parede do banheiro
  if (x === W - 1){ lateral(4); rbox(px + 1, py, 6, 11, C.woodD); R(px + 2, py + 1, 4, 1, C.woodL); P(px + 3, py + 3, C.gold); } // pilar do canto
}
// porta de vidro de correr para a varanda (2º andar)
function drawPortaVidro(x, y){
  const px = x * T, py = y * T, esq = x === PORTAS2[2][0];
  drawDoor(x, y, true);
  const gx = px + (esq ? 2 : 9);
  R(gx, py + 3, 5, 11, "#A5754B"); R(gx + 1, py + 4, 3, 9, "rgba(196,232,250,.75)"); R(gx + 1, py + 4, 1, 4, "#FFFFFF"); P(gx + 2, py + 9, "#FFFFFF");
}
function drawWallTile(x, y){
  const px = x * T, py = y * T;
  if (andarAtual === 1 && x >= 8 && (y === HC || (x === W - 1 && y >= 9))){ drawGradil(x, y); return; } // varanda
  if (y > HC){ drawCerca(x, y); return; } // cerca do quintal
  if (y === HC){ // parede de baixo: topo fino, o resto é jardim
    const x0 = x === 0 ? 9 : 0, x1 = x === W - 1 ? 7 : T, w = x1 - x0;
    R(px + x0, py, w, 7, CAP); R(px + x0, py + 1, w, 1, CAP_L); R(px + x0, py + 5, w, 1, CAP_D);
    R(px + x0, py, w, 1, LINE); R(px + x0, py + 6, w, 1, LINE);
    R(px + x0, py + 7, w, 2, "rgba(20,45,30,.28)");
    if (x === 0){ R(px + 9, py, 1, 7, LINE); R(px + 10, py, 5, 1, CAP); P(px + 10, py, CAP_L); P(px + 10, py + 1, CAP_L); P(px + 14, py, CAP_D); }
    if (x === W - 1){ R(px + 6, py, 1, 7, LINE); R(px + 1, py, 5, 1, CAP); P(px + 1, py, CAP_L); P(px + 5, py, CAP_D); P(px + 5, py + 1, CAP_D); R(px + 7, py, 2, 8, "rgba(20,45,30,.28)"); }
    if (x === VX){ R(px + 5, py, 6, 1, CAP); P(px + 5, py, CAP_L); P(px + 10, py, CAP_D); }
    if (portaQ && (x === 0 || x === W - 1)) cercaLateral(x === 0 ? px + 10 : px + 1, py, 7); // cerca do quintal encosta no canto da casa
    return;
  }
  if (x === 0 || x === W - 1){ // paredes de fora, à esquerda e à direita
    const x0 = x === 0 ? 9 : 0;
    R(px + x0, py, 7, T, CAP); R(px + x0, py, 1, T, LINE); R(px + x0 + 6, py, 1, T, LINE); R(px + x0 + 1, py, 1, T, CAP_L); R(px + x0 + 5, py, 1, T, CAP_D);
    if (y === 0){ const ix = x === 0 ? px + 15 : px; R(ix, py, 1, 3, CAP); P(ix, py, CAP_L); }
    if (x === W - 1) R(px + 7, py, 2, T, "rgba(20,45,30,.28)");
    return;
  }
  if (x === VX){ drawNarrowWall(x, y); return; }
  if (isFace(x, y)) drawFace(px, py, comodo(x, y + 1));
  else { R(px, py, T, T, CAP); }
}
// parede vertical interna: miolo de 8px, com o piso (ou a parede vizinha) continuando nas laterais
function drawNarrowWall(x, y){
  const px = x * T, py = y * T, face = isFace(x, y);
  const lf = isFace(x - 1, y), rf = isFace(x + 1, y);
  for (const [nx, sx] of [[x - 1, 0], [x + 1, 12]]) clipRect(px + sx, py, 4, T, () => {
    if (MAP[y][nx] === 1){ if (isFace(nx, y)) drawFace(px, py, comodo(nx, y + 1)); else R(px, py, T, T, CAP); }
    else drawFloorTile(x, y, pisoDe(comodo(nx, y)));
  });
  if (face){
    clipRect(px + 4, py, 8, T, () => drawFace(px, py, comodo(x, y + 1)));
    if (!lf) R(px + 4, py, 1, T, LINE);
    if (!rf) R(px + 11, py, 1, T, LINE);
  } else {
    R(px + 4, py, 8, T, CAP); R(px + 5, py, 1, T, CAP_L); R(px + 10, py, 1, T, CAP_D);
    if (!isWallAt(x, y - 1)){ R(px + 4, py, 8, 1, LINE); R(px + 5, py + 1, 6, 1, CAP_L); }
    R(px + 4, py + (lf ? 3 : 0), 1, T - (lf ? 3 : 0), LINE);
    R(px + 11, py + (rf ? 3 : 0), 1, T - (rf ? 3 : 0), LINE);
    if (lf){ R(px + 4, py, 2, 3, CAP); R(px + 4, py, 2, 1, CAP_L); }
    if (rf){ R(px + 10, py, 2, 3, CAP); R(px + 10, py, 2, 1, CAP_L); }
  }
}
// portas: batente de madeira e soleira
function drawDoor(x, y, vidro){
  if (!vidro && andarAtual === 1 && y === 8 && x > VX){ drawPortaVidro(x, y); return; }
  const px = x * T, py = y * T, wd = "#A5754B", wl = "#D2A06C", wdd = "#6B4429";
  if (x === VX){
    clipRect(px, py, 4, T, () => drawFloorTile(x, y, pisoDe(comodo(x - 1, y))));
    R(px + 4, py, 8, T, wd); R(px + 4, py, 1, T, wdd); R(px + 11, py, 1, T, wdd); R(px + 5, py, 1, T, wl);
    R(px + 5, py + 5, 6, 1, "#8C5E3A"); R(px + 5, py + 11, 6, 1, "#8C5E3A");
    R(px + 4, py, 8, 2, "rgba(30,15,30,.3)");
  } else {
    R(px, py, T, 3, wd); R(px, py, T, 1, wl); R(px, py + 3, T, 1, LINE);
    R(px, py + 4, T, 3, "rgba(30,15,30,.26)"); R(px, py + 7, T, 2, "rgba(30,15,30,.12)");
    R(px, py + 13, T, 3, wd); R(px, py + 13, T, 1, wl); R(px, py + 15, T, 1, "#8C5E3A");
    if (isWallAt(x - 1, y)){ R(px, py + 4, 2, 12, wd); R(px, py + 4, 1, 12, wl); R(px + 2, py + 4, 1, 12, wdd); }
    if (isWallAt(x + 1, y)){ R(px + 14, py + 4, 2, 12, wd); R(px + 13, py + 4, 1, 12, wdd); R(px + 15, py + 4, 1, 12, "#8C5E3A"); }
  }
}
// ---- quintal (leva 2) ----
const PLACA = { x: 13, y: HC }; // placa "vende-se" no jardim antes de comprar o quintal (clicável)
// cerca branca de estacas: embaixo (horizontal) e nas laterais do quintal
const CERCA = "#F4EEE6", CERCA_D = "#CFC3B4";
// trecho vertical de cerca (visto de cima), de y0 até o fim do quadrado
function cercaLateral(cx, py, y0){
  y0 = y0 || 0; const b = CERCA, bD = CERCA_D, h = T - y0;
  R(cx + 5, py + y0, 2, h, "rgba(20,45,30,.28)");
  R(cx, py + y0, 5, h, LINE); R(cx + 1, py + y0, 3, h, b); R(cx + 3, py + y0, 1, h, bD);
  for (const j of [1, 9]){ if (j < y0) continue; R(cx - 1, py + j, 7, 5, LINE); R(cx, py + j + 1, 5, 3, b); R(cx, py + j + 1, 5, 1, "#FFFFFF"); R(cx + 4, py + j + 2, 1, 2, bD); }
}
function drawCerca(x, y){
  const px = x * T, py = y * T, b = CERCA, bD = CERCA_D, sombra = "rgba(20,45,30,.28)";
  const lateral = cx => cercaLateral(cx, py);
  if (y < H - 1){ lateral(x === 0 ? px + 10 : px + 1); return; }
  const x0 = x === 0 ? 9 : 0, x1 = x === W - 1 ? 8 : T, w = x1 - x0;
  R(px + x0, py + 13, w, 2, sombra);
  for (const ry of [4, 8]){ R(px + x0, py + ry - 1, w, 1, LINE); R(px + x0, py + ry, w, 2, b); R(px + x0, py + ry + 1, w, 1, bD); R(px + x0, py + ry + 2, w, 1, LINE); }
  for (let i = x0 + (x === 0 ? 0 : 1); i + 4 <= x1; i += 5){
    R(px + i, py + 1, 4, 12, LINE); R(px + i + 1, py, 2, 1, LINE);
    R(px + i + 1, py + 1, 2, 11, b); P(px + i + 1, py + 1, "#FFFFFF"); R(px + i + 2, py + 3, 1, 9, bD);
  }
  if (x === 0) lateral(px + 10);
  if (x === W - 1) lateral(px + 1);
}
// porta da cozinha para o quintal, na parede de baixo (topo fino de 7px)
function drawPortaQuintal(x, y){
  const px = x * T, py = y * T;
  clipRect(px, py, T, 7, () => drawFloorTile(x, y, pisoDe("cozinha")));
  R(px, py, 2, 7, CAP_D); R(px + 2, py, 1, 7, LINE); R(px + 14, py, 2, 7, CAP_D); R(px + 13, py, 1, 7, LINE);
  R(px, py, 3, 1, LINE); R(px + 13, py, 3, 1, LINE);
  R(px + 3, py + 5, 10, 2, "#A5754B"); R(px + 3, py + 5, 10, 1, "#D2A06C"); R(px, py + 7, T, 1, LINE);
  // tapetinho de entrada na grama
  rbox(px + 2, py + 9, 12, 6, C.coral); R(px + 3, py + 10, 10, 1, "#F4A08E"); R(px + 4, py + 12, 8, 1, sh(C.coral, -.15));
  for (let i = 3; i < 13; i += 2) P(px + i, py + 15, C.cream);
}
function drawPedras(){
  for (let j = 1; j <= 2; j++){
    const px = portaQ * T, py = (HC + j) * T;
    for (const [a, b] of [[3, 3], [8, 10]]){ rbox(px + a, py + b, 6, 4, "#C9C2B8"); R(px + a + 1, py + b, 4, 1, "#E4DFD8"); R(px + a + 1, py + b + 4, 4, 1, "rgba(20,45,30,.25)"); }
  }
}
function drawPlaca(px, py){
  R(px + 7, py + 10, 2, 6, C.woodD); R(px + 6, py + 15, 4, 1, "rgba(20,45,30,.3)");
  R(px + 2, py + 2, 12, 9, LINE); R(px + 3, py + 3, 10, 7, C.cream); R(px + 3, py + 3, 10, 1, "#FFFFFF"); R(px + 3, py + 9, 10, 1, C.creamD);
  // "$" verde
  const g = "#3B8F56"; R(px + 7, py + 3, 1, 7, g); R(px + 6, py + 4, 3, 1, g); P(px + 5, py + 5, g); R(px + 6, py + 6, 2, 1, g); P(px + 9, py + 7, g); R(px + 6, py + 8, 3, 1, g);
  P(px + 4, py + 4, C.rose); P(px + 11, py + 8, C.rose);
}
// jardim em volta da casa (só aparece na moldura)
// estações (leva 3): grama, flores/folhas e arbustos mudam conforme a época do ano
const GRAMAS = {
  primavera: { g: "#7FB96C", gD: "#6BA85C", gL: "#97CE80", flores: ["#FFFFFF", "#F9B8CC", "#FFE08A", "#C9B6F2"], nFlor: 5, raro: 2, arb: ["#3F8F56", "#5DB070", "#2F7446", "#8AD490"], bot: ["#F9B8CC", "#FFFFFF"] },
  verao:     { g: "#86BF5A", gD: "#70AA47", gL: "#A8D66E", flores: ["#FFE08A", "#FFFFFF", "#F6A04D"], nFlor: 3, raro: 2, arb: ["#2F8A4A", "#4EAA5E", "#22683A", "#86D68F"], bot: ["#FFE08A", "#F6A04D"] },
  outono:    { g: "#A3AC64", gD: "#8C9752", gL: "#BFC37D", flores: ["#E08A3C", "#C9612F", "#F2B04A", "#B5502C"], nFlor: 4, raro: 1, folhas: 1, arb: ["#C47A36", "#E39A4A", "#93532A", "#F4C070"], bot: ["#B5502C", "#F2B04A"] },
  inverno:   { g: "#A2B48F", gD: "#8DA17B", gL: "#C2CFAF", flores: ["#FFFFFF", "#E6EEF2"], nFlor: 3, raro: 3, geada: 1, arb: ["#577E5E", "#6E9572", "#3F6447", "#DCE8E2"], bot: ["#E6EEF2", "#FFFFFF"] }
};
function drawGarden(est, chuva){
  const gp = GRAMAS[est] || GRAMAS.primavera, g = gp.g, gD = gp.gD, gL = gp.gL;
  R(0, 0, W * T, H * T, g);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++){
    if (tx > 0 && tx < W - 1 && ty < HC) continue;
    const meioQuintal = ty > HC && ty < H - 1 && tx > 0 && tx < W - 1;
    const px = tx * T, py = ty * T;
    for (let i = 0; i < 9; i++){ const h = hash(tx, ty, i), ax = px + h % 15, ay = py + (h >> 5) % 15; if (i % 3 === 0) R(ax, ay, 2, 1, gD); else if (i % 3 === 1){ P(ax, ay, gL); P(ax, ay + 1, gD); } else P(ax, ay, gD); }
    for (let i = 0; i < gp.nFlor; i++){
      const h = hash(tx, ty, 20 + i); if (h % gp.raro || (meioQuintal && h % 5 > (gp.folhas ? 1 : 0))) continue;
      const fx = tx === 0 ? px + 1 + h % 6 : tx === W - 1 ? px + 9 + h % 6 : px + (h >> 3) % 15, fy = ty === HC ? py + 10 + (h >> 7) % 5 : py + (h >> 7) % 15;
      const cor = gp.flores[(h >> 11) % gp.flores.length];
      if (gp.folhas){ R(fx, fy, 2, 1, cor); P(fx + ((h >> 13) % 2), fy + 1, sh(cor, -.2)); } // folhas caídas
      else if (gp.geada){ P(fx, fy, cor); if (h % 3 === 0) P(fx + 1, fy, "#DDE7EA"); } // geada
      else { P(fx, fy, cor); P(fx, fy + 1, "#4F9050"); }
    }
  }
  const [a0, a1, a2, a3] = gp.arb;
  const bush = (bx, by, w) => {
    R(bx + 1, by, w - 2, 6, a0); R(bx, by + 1, w, 4, a0); R(bx + 1, by, w - 2, 2, a1); R(bx + 2, by, 2, 1, a3);
    R(bx + 1, by + 5, w - 2, 1, a2); P(bx + w - 2, by + 2, a2); P(bx + 2, by + 3, a2);
    P(bx + 3, by + 2, gp.bot[0]); P(bx + w - 3, by + 3, gp.bot[1]);
    if (est === "primavera"){ P(bx + w - 4, by + 1, "#FFFFFF"); P(bx + 5, by + 4, "#F9B8CC"); }
    if (gp.geada) R(bx + 2, by, w - 4, 1, "#EEF4F2");
    R(bx + 1, by + 6, w - 2, 1, "rgba(20,45,30,.25)");
  };
  for (const tx of [1, 4, 5, 9, 12, 15]){ if (portaQ && Math.abs(tx - portaQ) <= 1) continue; bush(tx * T + 3 + hash(tx, 0, 40) % 4, HC * T + 9, 9 + hash(tx, 0, 41) % 3); }
  for (const ty of [2, 6, 9]){ bush(1, ty * T + 4, 7); bush((W - 1) * T + 8, ty * T + 11, 7); }
  if (chuva){
    // grama molhada e poças
    ctx.fillStyle = "rgba(30,50,90,.13)"; ctx.fillRect(0, 0, W * T, H * T);
    const poca = (x, y, w, h) => { R(x + 1, y, w - 2, h, "#7E9FC0"); R(x, y + 1, w, h - 2, "#7E9FC0"); R(x + 1, y + 1, w - 3, 1, "#A9C6E0"); P(x + w - 2, y + h - 2, "#6A88AA"); };
    for (let tx = 1; tx < W - 1; tx++){ const h = hash(tx, HC, 77); if (h % 4 === 0 && !(portaQ && Math.abs(tx - portaQ) <= 0)) poca(tx * T + 2 + h % 6, HC * T + 11, 6, 3); }
    for (let ty = HC + 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++){ const h = hash(tx, ty, 78); if (h % 5 === 0) poca(tx * T + 2 + h % 5, ty * T + 3 + (h >> 4) % 8, 7 + h % 3, 4); }
    for (const ty of [4, 8]){ poca(1, ty * T + 12, 6, 3); poca((W - 1) * T + 9, ty * T + 2, 6, 3); }
  }
}
// ---- 2º andar (leva 4): vista lá de cima, varanda e vão da escada ----
// copa de árvore vista de cima, nas cores da estação
function copaArvore(cx, cy, r, h, gp, est){
  const [a0, a1, a2, a3] = gp.arb;
  for (let dy = -r; dy <= r; dy++){ const hw = Math.round(Math.sqrt(r * r - dy * dy)); R(cx - hw, cy + dy, hw * 2, 1, dy > r * .45 ? a2 : a0); }
  for (let dy = -r + 1; dy < 1; dy++){ const hw = Math.round(Math.sqrt(Math.max(0, (r - 2) * (r - 2) - dy * dy)) * .55); if (hw > 0) R(cx - hw - Math.round(r * .25), cy + dy, hw, 1, a1); }
  for (let i = 0; i < r; i++){ const q = hash(h, i, 71), ax = cx - r + 1 + q % (r * 2 - 1), ay = cy - r + 1 + (q >> 6) % (r * 2 - 1); if (Math.hypot(ax - cx, ay - cy) < r - 1) P(ax, ay, i % 3 ? a2 : a3); }
  if (est === "primavera" || est === "verao") for (let i = 0; i < 3; i++){ const q = hash(h, i, 72); P(cx - r + 2 + q % (r * 2 - 3), cy - r + 2 + (q >> 5) % r, gp.bot[i % 2]); }
  if (gp.geada) R(cx - Math.round(r * .5), cy - r, Math.round(r), 1, "#EEF4F2");
}
// fundo do 2º andar: o jardim fica lá embaixo (escuro) e as copas das árvores chegam na altura da janela
function drawVistaAlta(est, chuva){
  const gp = GRAMAS[est] || GRAMAS.primavera, chao = sh(gp.gD, -.32);
  R(0, 0, W * T, H * T, chao);
  for (let i = 0; i < 260; i++){ const q = hash(i, 7, 33); P(q % (W * T), (q >> 9) % (H * T), i % 2 ? sh(chao, .14) : sh(chao, -.14)); }
  for (let k = 0; k < 8; k++){ const q = hash(k, 1, 44); copaArvore(2 + q % 4, k * 27 + q % 10, 6 + q % 3, q, gp, est); }
  for (let k = 0; k < 8; k++){ const q = hash(k, 2, 44); copaArvore(W * T - 3 - q % 4, k * 27 + 12 + q % 10, 6 + q % 3, q, gp, est); }
  for (let k = 0; k < 10; k++){ const q = hash(k, 3, 44); copaArvore(k * 31 + 6 + q % 10, H * T + 2 + q % 3, 8 + q % 4, q, gp, est); }
  if (chuva){ ctx.fillStyle = "rgba(30,50,90,.16)"; ctx.fillRect(0, 0, W * T, H * T); }
}
// varanda: folhas no outono, geada no inverno, pétalas na primavera; com chuva, deck molhado e poças
function drawVaranda(est, chuva){
  const gp = GRAMAS[est] || GRAMAS.primavera;
  for (let y = 9; y < HC; y++) for (let x = VX + 1; x < W - 1; x++){
    const px = x * T, py = y * T;
    for (let i = 0; i < 3; i++){
      const q = hash(x, y, 80 + i), fx = px + 1 + q % 14, fy = py + 1 + (q >> 5) % 14;
      if (gp.folhas && q % 3 < 2){ const c = gp.flores[(q >> 9) % gp.flores.length]; R(fx, fy, 2, 1, c); P(fx + (q >> 12) % 2, fy + 1, sh(c, -.2)); }
      else if (gp.geada && q % 3 === 0){ P(fx, fy, "#EEF4F8"); P(fx + 1, fy, "#DDE7EA"); }
      else if (est === "primavera" && q % 4 === 0) P(fx, fy, gp.flores[(q >> 9) % gp.flores.length]);
    }
  }
  if (chuva){
    ctx.fillStyle = "rgba(30,50,90,.14)"; ctx.fillRect((VX + 1) * T, 9 * T, (W - VX - 2) * T, 3 * T);
    for (let y = 9; y < HC; y++) for (let x = VX + 1; x < W - 1; x++){ const q = hash(x, y, 79); if (q % 3) continue;
      const px = x * T + 2 + q % 6, py = y * T + 3 + (q >> 4) % 8, w = 6 + q % 3; R(px + 1, py, w - 2, 3, "#8FA7C4"); R(px, py + 1, w, 1, "#8FA7C4"); R(px + 1, py, w - 3, 1, "#B7CBE0"); }
  }
}
// vão da escada no 2º andar (plano, vai no fundo): degraus descendo e sumindo no escuro
function drawVao(x, y){
  R(x, y, 32, 48, "#1E1828");
  R(x, y, 3, 48, "#3A3050"); R(x + 29, y, 3, 48, "#2A2240");
  for (let i = 0; i < 6; i++){
    const yy = y + i * 7, k = Math.min(1, i / 4.5), pis = mix(C.woodL, "#231B30", k), pc = mix("#9A89E0", "#231B30", k);
    R(x + 3, yy, 26, 5, pis); R(x + 3, yy, 26, 1, mix("#F4D8B0", "#231B30", k)); R(x + 3, yy + 5, 26, 2, mix(C.woodDD, "#1A1424", k));
    R(x + 9, yy, 14, 5, pc); R(x + 9, yy + 5, 14, 2, mix("#4E3F92", "#1A1424", k)); P(x + 9, yy + 5, mix(C.gold, "#231B30", k)); P(x + 22, yy + 5, mix(C.gold, "#231B30", k));
  }
  R(x, y, 32, 1, "rgba(255,240,210,.35)"); // quina do piso na saída
}
const SKY_CHUVA = { dia: ["#8796AE", "#B9C3D0"], tarde: ["#7F7896", "#B7AABA"], manha: ["#8D88A8", "#C2B9C6"] };
function drawWindow(px, py, hr, x, est, chuva, alto){
  const kind = skyKind(hr), [s0, s1] = chuva && SKY_CHUVA[kind] ? SKY_CHUVA[kind] : SKY[kind], gp = GRAMAS[est] || GRAMAS.primavera;
  R(px + 1, py + 4, 14, 1, "#8C5E3A");
  R(px + 3, py + 4, 11, 9, C.cream);
  for (let j = 0; j < 7; j++) R(px + 4, py + 5 + j, 9, 1, mix(s0, s1, j / 6));
  if (kind === "noite"){ if (x % 2 && !chuva){ R(px + 9, py + 6, 2, 2, "#FFF6D6"); P(px + 10, py + 6, mix(s0, s1, .2)); } }
  else if (kind === "tarde" || kind === "manha"){ if (!chuva) R(px + 9, py + 9, 3, 2, "#FFE9A8"); if (!alto) R(px + 4, py + 11, 9, 1, mix(s1, "#FFFFFF", .3)); }
  else {
    if (est === "verao" && !chuva && x % 2 === 0){ R(px + 10, py + 6, 2, 2, "#FFE45C"); P(px + 9, py + 6, "#FFF3A8"); } // sol forte
    if (!alto){
      R(px + 4, py + 11, 9, 1, gp.gL); P(px + 6, py + 10, gp.gL); P(px + 7, py + 10, gp.gL); P(px + 11, py + 10, gp.g);
      if (est === "outono"){ P(px + 5, py + 10, "#E08A3C"); P(px + 10, py + 11, "#C9612F"); }
    }
  }
  if (alto){ // 2º andar: topo das árvores lá fora, nas cores da estação (silhueta à noite)
    const noite = kind === "noite", c0 = noite ? "#1C2440" : chuva ? sh(gp.arb[0], -.18) : gp.arb[0], c1 = noite ? "#26304F" : chuva ? gp.arb[0] : gp.arb[1];
    R(px + 4, py + 11, 9, 1, c0); R(px + 4, py + 10, 4, 1, c0); R(px + 9, py + 10, 4, 1, c0); R(px + 5, py + 9, 2, 1, c0); R(px + 10, py + 9, 2, 1, c0);
    P(px + 5, py + 9, c1); P(px + 10, py + 9, c1); P(px + 4, py + 10, c1);
    if (!noite && (est === "primavera" || est === "outono")) P(px + 11, py + 10, gp.bot[0]);
    if (!noite && gp.geada) R(px + 5, py + 9, 2, 1, "#EEF4F2");
  }
  R(px + 8, py + 5, 1, 7, C.cream); R(px + 4, py + 8, 9, 1, C.cream);
  R(px + 3, py + 4, 11, 1, "#FFFFFF"); R(px + 13, py + 5, 1, 8, C.creamD);
  R(px + 2, py + 12, 13, 1, "#D2A06C");
  // cortinas
  for (const [cx0, d] of [[1, 1], [14, -1]]){
    R(px + cx0, py + 5, 2, 8, C.rose); R(px + cx0 + (d > 0 ? 2 : -1), py + 5, 1, 5, C.rose); R(px + cx0 + (d > 0 ? 0 : 1), py + 5, 1, 8, "#F9C9D6"); P(px + cx0 + (d > 0 ? 1 : 0), py + 12, "#D97A96");
    P(px + cx0 + (d > 0 ? 2 : -1), py + 9, "#D97A96");
  }
}
function drawDecor(kind, px, py, hr){
  if (kind === "coracao"){ R(px + 4, py + 5, 8, 7, "#8C5E3A"); R(px + 4, py + 5, 8, 1, C.wood); R(px + 5, py + 6, 6, 5, C.cream); pixHeart(px + 5, py + 7, "#E8607A"); P(px + 10, py + 6, C.cream); }
  else if (kind === "paisagem" || kind === "paisagem2"){
    const n = kind === "paisagem2";
    R(px + 3, py + 5, 10, 7, "#C9973F"); R(px + 3, py + 5, 10, 1, "#F0C870");
    R(px + 4, py + 6, 8, 3, n ? "#F4A77C" : "#9FD3F2"); R(px + 4, py + 9, 8, 2, n ? "#8B6FB8" : "#6DB37A"); P(px + 9, py + 7, n ? "#FFF0C0" : "#FFE08A"); R(px + 5, py + 8, 2, 1, n ? "#8B6FB8" : "#6DB37A"); P(px + 10, py + 9, n ? "#6F58A0" : "#5AA068");
  }
  else if (kind === "espelho"){ R(px + 4, py + 4, 8, 9, "#D2A06C"); R(px + 5, py + 5, 6, 7, "#C5E8F6"); R(px + 6, py + 6, 1, 3, "#FFFFFF"); P(px + 7, py + 6, "#FFFFFF"); P(px + 9, py + 10, "#EAF8FE"); R(px + 5, py + 11, 6, 1, "#A4D0E4"); }
  else if (kind === "toalha"){ R(px + 3, py + 6, 10, 1, C.metal); R(px + 5, py + 6, 6, 6, C.rose); R(px + 5, py + 6, 6, 1, "#F9C9D6"); R(px + 5, py + 10, 6, 1, "#FFFFFF"); R(px + 10, py + 7, 1, 5, "#D97A96"); }
  else if (kind === "relogio"){
    R(px + 5, py + 5, 5, 7, C.coral); R(px + 4, py + 6, 7, 5, C.coral); R(px + 5, py + 6, 5, 5, "#FFF8EC");
    const cx = px + 7, cy = py + 8, ah = (hr % 12) / 12 * Math.PI * 2, am = (hr % 1) * Math.PI * 2;
    P(cx + Math.round(Math.sin(am) * 2), cy - Math.round(Math.cos(am) * 2), "#8D9BAA"); P(cx + Math.round(Math.sin(am)), cy - Math.round(Math.cos(am)), "#8D9BAA");
    P(cx + Math.round(Math.sin(ah)), cy - Math.round(Math.cos(ah)), C.ink); P(cx, cy, C.ink);
  }
  else if (kind === "poster"){ // pôster de videogame com um bichinho de pixel
    R(px + 3, py + 4, 10, 9, "#2D1C30"); R(px + 4, py + 5, 8, 7, "#5246B0"); R(px + 4, py + 5, 8, 1, "#6F5CC0");
    const g = "#7FD0F5"; R(px + 6, py + 7, 4, 2, g); P(px + 6, py + 6, g); P(px + 9, py + 6, g); P(px + 5, py + 8, g); P(px + 10, py + 8, g); P(px + 6, py + 9, g); P(px + 9, py + 9, g);
    P(px + 7, py + 7, "#2D1C30"); P(px + 8, py + 7, "#2D1C30"); R(px + 5, py + 11, 6, 1, "#E8607A"); P(px + 11, py + 6, "#FCE9B8");
  }
  else if (kind === "arandela"){ // luminária de parede da varanda (acende à noite)
    R(px + 7, py + 4, 2, 2, "#5A546C"); rbox(px + 5, py + 6, 6, 6, "#FCE9B8"); R(px + 6, py + 7, 4, 4, "#FFF6D6"); R(px + 6, py + 7, 1, 4, "#FFFFFF"); R(px + 5, py + 12, 6, 1, "#5A546C");
  }
  else if (kind === "prateleira"){
    R(px + 2, py + 10, 12, 1, "#8C5E3A"); R(px + 2, py + 11, 12, 1, "rgba(40,20,20,.2)");
    R(px + 3, py + 7, 3, 3, C.coral); R(px + 3, py + 6, 3, 1, C.cream); R(px + 7, py + 6, 2, 4, C.mint); P(px + 7, py + 5, C.cream); P(px + 8, py + 5, C.cream); R(px + 10, py + 7, 3, 3, C.gold); R(px + 10, py + 6, 3, 1, "#8C5E3A");
  }
}

// escada do térreo (leva 4), vista de cima: sobe para o norte, com passadeira, corrimões dos dois lados
// subindo acima do quadrado e pilares com bolinha no pé. x, y = canto de cima do vão (32 x 48)
const ESC_ALTO = 4;
function drawEscada(x, y){
  for (let i = 0; i < 6; i++){
    const yy = y + 48 - (i + 1) * 8, k = i / 5;
    const pis = mix(C.wood, C.woodL, .15 + k * .7), esp = mix(C.woodDD, C.woodD, k);
    R(x + 4, yy, 24, 5, pis); R(x + 4, yy, 24, 1, sh(pis, .2)); R(x + 4, yy + 4, 24, 1, sh(pis, -.08));
    R(x + 4, yy + 5, 24, 3, esp); R(x + 4, yy + 5, 24, 1, sh(esp, -.25));
    const pc = mix("#5546A8", "#9A89E0", k * .8);
    R(x + 9, yy, 14, 5, pc); R(x + 9, yy, 14, 1, sh(pc, .3)); R(x + 9, yy + 5, 14, 3, sh(pc, -.32)); P(x + 9, yy + 5, C.gold); P(x + 22, yy + 5, C.gold);
    if (i % 2 === 0) P(x + 15 + (i % 3), yy + 2, sh(pc, .18));
  }
  // corrimões (laterais), subindo um pouco acima do vão
  for (const sx of [x, x + 28]){
    R(sx, y - ESC_ALTO, 4, 48 + ESC_ALTO - 8, C.woodD); R(sx + 1, y - ESC_ALTO, 1, 48 + ESC_ALTO - 8, C.woodL); R(sx + 3, y - ESC_ALTO, 1, 48 + ESC_ALTO - 8, C.woodDD);
    for (let j = y - ESC_ALTO + 3; j < y + 38; j += 4) P(sx + 2, j, C.wood);
  }
  // o alto da escada (degraus e corrimões) some na sombra do andar de cima
  for (const [a, h, al] of [[-ESC_ALTO, 4, .7], [0, 4, .55], [4, 5, .32], [9, 6, .14]]){ ctx.globalAlpha = al; R(x, y + a, 32, h, "#1E1630"); }
  ctx.globalAlpha = 1;
  // pilares do pé, com bolinha dourada
  for (const sx of [x - 1, x + 27]){ rbox(sx, y + 37, 6, 11, C.woodD); R(sx + 1, y + 38, 4, 1, C.woodL); R(sx + 1, y + 44, 4, 1, C.woodDD); rbox(sx + 1, y + 33, 4, 4, C.gold); P(sx + 2, y + 34, "#FCE9B8"); }
}
// guarda-corpo em volta do vão no 2º andar (oeste e sul; o leste é a parede)
function drawGuardaCorpo(x, y){
  const md = "#F4EEE6", mdD = "#CFC3B4";
  R(x, y - 8, 4, 48, C.woodD); R(x + 1, y - 8, 1, 48, C.woodL); R(x + 3, y - 8, 1, 48, C.woodDD); rbox(x, y - 10, 4, 3, C.woodD);
  R(x + 2, y + 47, 30, 1, "rgba(35,18,40,.25)");
  for (let i = x + 5; i < x + 31; i += 3){ R(i, y + 40, 1, 7, md); P(i, y + 40, "#FFFFFF"); P(i, y + 46, mdD); }
  R(x + 2, y + 38, 30, 2, C.wood); R(x + 2, y + 38, 30, 1, C.woodL); R(x + 2, y + 40, 30, 1, C.woodDD); R(x + 2, y + 46, 30, 1, C.woodD);
  rbox(x - 1, y + 35, 6, 13, C.woodD); R(x, y + 36, 4, 1, C.woodL); rbox(x, y + 32, 4, 4, C.gold); P(x + 1, y + 33, "#FCE9B8");
}
function escadaSprite(){
  return andarAtual === 1 ? sprite("escada:1", 33, 58, (ox, oy) => drawGuardaCorpo(ox + 1, oy + 10)) : sprite("escada:0", 34, 59, (ox, oy) => drawEscada(ox + 1, oy + ESC_ALTO + 2));
}
function blitEscada(){
  const s = escadaSprite(), x = ESCADA.x * T, y = ESCADA.y * T;
  if (andarAtual === 1) ctx.drawImage(s.c, x - 2, y - 11); else ctx.drawImage(s.c, x - 2, y - ESC_ALTO - 3);
}
// fundo (jardim, pisos, paredes, portas, janelas): desenhado uma vez e guardado
const bg = document.createElement("canvas"); bg.width = W * T; bg.height = H * T;
let bgKey = null;
function ensureBg(hr){
  const est = estacao(), chuva = climaAgora(), mes = mesAgora();
  const cima = andarAtual === 1;
  const key = [pisos.quarto, pisos.banheiro, pisos.sala, pisos.cozinha, pisos2.suite, pisos2.lavabo, pisos2.jogos, pisos2.varanda, andarAtual, escadaOn ? 1 : 0, H, portaQ, Math.floor(hr * 12), est, chuva || "", mes === 6 ? 6 : 0, paredesSig()].join(",");
  if (key === bgKey) return;
  bgKey = key;
  const b = bg.getContext("2d"); b.imageSmoothingEnabled = false;
  withCtx(b, 1, () => {
    if (cima) drawVistaAlta(est, chuva); else drawGarden(est, chuva);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      if (MAP[y][x] === 1 || y > HC) continue; // quintal: a grama já veio do drawGarden
      if (y === HC){ drawPortaQuintal(x, y); continue; }
      drawFloorTile(x, y, pisoDe(comodo(x, y)));
      if (MAP[y][x] === 2) drawDoor(x, y);
    }
    if (cima) drawVaranda(est, chuva);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (MAP[y][x] === 1) drawWallTile(x, y);
    // sombras suaves das paredes no piso
    const s1 = "rgba(35,18,40,.2)", s2 = "rgba(35,18,40,.1)";
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      const px = x * T, py = y * T;
      if (MAP[y][x] === 1){
        if (x === VX && y < HC){ // parede fina: sombra à direita, no próprio quadrado
          if (MAP[y][x + 1] !== 1){ R(px + 12, py, 2, T, s1); R(px + 14, py, 1, T, s2); }
          if (isFace(x, y) && MAP[y + 1][x] !== 1){ R(px + 4, py + T, 8, 2, s1); R(px + 4, py + T + 2, 9, 1, s2); }
        }
        continue;
      }
      if (y > 0 && y - 1 !== HC && isFace(x, y - 1) && x !== VX){ R(px, py, T, 2, s1); R(px, py + 2, T, 2, s2); }
      if (x === 1 && y < HC){ R(px, py, 2, T, s1); R(px + 2, py, 1, T, s2); }
    }
    if (cima) drawVao(ESCADA.x * T, ESCADA.y * T);
    const kind = skyKind(hr);
    for (const k of janelas()){
      const [x, y] = k.split(",").map(Number), px = x * T, py = y * T;
      drawWindow(px, py, hr, x, est, chuva, cima);
      if (kind !== "noite"){ // luz da janela no chão (fraquinha quando chove, forte no verão)
        const c = chuva ? "rgba(210,225,255,.1)" : kind === "dia" ? (est === "verao" ? "rgba(255,246,190,.3)" : "rgba(255,248,210,.2)") : kind === "tarde" ? "rgba(255,190,120,.22)" : "rgba(255,210,200,.18)";
        for (let r = 0; r < 20; r++){ if (r === 9 || r === 10) continue; const o = Math.floor(r / 3); R(px + 4 + o, py + T + 3 + r, 4, 1, c); R(px + 9 + o, py + T + 3 + r, 4, 1, c); }
      }
    }
    for (const [k, kindD] of Object.entries(decorAtual())){ const [x, y] = k.split(",").map(Number); if (isFace(x, y)) drawDecor(kindD, x * T, y * T, hr); }
    if (!cima){ if (portaQ) drawPedras(); else drawPlaca(PLACA.x * T, PLACA.y * T); }
    if (mes === 6) drawBandeirinhas();
  });
}
// festa junina: bandeirinhas na parede de cima do quarto e da sala
function drawBandeirinhas(){
  const cores = ["#E8607A", "#F6C667", "#5DCAA5", "#7FB8E8", "#B49CF4", "#E8735F"];
  for (let x = 1; x < W - 1; x++){
    if (x === VX) continue;
    const px = x * T, py = 0;
    R(px, py + 4, T, 1, "#6B4429");
    for (let k = 0; k < 2; k++){ const fx = px + 2 + k * 8, c = cores[(x * 2 + k) % cores.length]; R(fx, py + 5, 5, 2, c); R(fx + 1, py + 7, 3, 1, c); P(fx + 2, py + 8, c); P(fx, py + 5, sh(c, .35)); }
  }
}
// brilhos animados das janelas (nuvem, reflexo, estrelas)
function drawWindowAnim(tm, hr){
  const kind = skyKind(hr), chuva = climaAgora();
  for (const k of janelas()){
    const [x, y] = k.split(",").map(Number), px = x * T, py = y * T;
    if (chuva){ // nuvem carregada passando
      const cxp = Math.floor((tm / 2600 + x * 5) % 18) - 5;
      for (let i = 0; i < 6; i++){ const ax = px + 4 + cxp + i; if (ax < px + 4 || ax > px + 12 || ax === px + 8) continue; P(ax, py + 6, kind === "noite" ? "#3A3F66" : "#9AA4B6"); if (i > 0 && i < 5) P(ax, py + 5, kind === "noite" ? "#323760" : "#A9B2C2"); }
      continue;
    }
    if (kind === "noite"){
      for (let i = 0; i < 3; i++){ const h = hash(x, i, 7), sx = px + 5 + h % 7, sy = py + 5 + (h >> 4) % 3; if (sx === px + 8) continue; ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(tm / 700 + h % 10)); P(sx, sy, "#FFFFFF"); }
      ctx.globalAlpha = 1;
    } else {
      const cxp = Math.floor((tm / 1400 + x * 5) % 16) - 3;
      for (let i = 0; i < 4; i++){ const ax = px + 4 + cxp + i; if (ax < px + 5 || ax > px + 11 || ax === px + 8) continue; P(ax, py + 6, "#FFFFFF"); if (i > 0 && i < 3) P(ax, py + 5, "#FFFFFF"); }
      const gl = Math.floor(tm / 90 + x * 9) % 70;
      if (gl < 6){ ctx.globalAlpha = .7; for (let i = 0; i < 2; i++){ const ax = px + 5 + gl + i, ay = py + 10 - gl + i * 0; if (ax <= px + 11 && ax !== px + 8 && ay >= py + 5 && ay !== py + 8) P(ax, ay, "#FFFFFF"); } ctx.globalAlpha = 1; }
    }
  }
}
// vinheta suave nos cantos
const vig = document.createElement("canvas"); vig.width = W * T; vig.height = H * T;
function desenharVinheta(){ const v = vig.getContext("2d"), g = v.createRadialGradient(W * T / 2, H * T / 2, H * T * .45, W * T / 2, H * T / 2, W * T * .72); g.addColorStop(0, "rgba(40,18,50,0)"); g.addColorStop(1, "rgba(40,18,50,.3)"); v.clearRect(0, 0, vig.width, vig.height); v.fillStyle = g; v.fillRect(0, 0, W * T, H * T); }
desenharVinheta();
