"use strict";
// Casinha · leva 12b: espelho detalhado (retrato grande), formatos de corpo no criador, cópias de segurança e "Voltar no tempo"
// Carregado ANTES do 18-laco.js.
// =====================================================================
// LEVA 12b
//   jogadores/<pid>/forma  = ampulheta|pera|maca|retangulo|triangulo|atletico   (sem campo = retangulo: igual a antes)
//   jogadores/<pid>/altura = baixinho|medio|alto ; fisico = magro|medio|cheinho   (sem campo = medio)
//   casa/backupDia = "AAAA-MM-DD"        quem ganha a transação nessa folha faz a cópia do dia (horário de Brasília)
//   backups/<chave> = { app: "casinha", v: 1, tipo: dia|antes|arquivo, at, por, rotulo, casa: {...}, jogadores: {pid: {...}}, resumo }
//      chave: AAAA-MM-DD (cópia do dia, guarda 7), antes_<ts> (antes de voltar, guarda 5), arquivo_<ts> (cópia carregada, guarda 3)
//      fica em salas/<sala>/backups (fora de "casa": a casa não carrega as cópias junto)
//   casa/voltaTempo = { id, de, nome, alvo, rotulo, at, estado: pedido|restaurando|feito|recusado|expirou|cancelado, ok: {pid: true}, quem: {pid: true}, desfazer?, fim? }
//   Teste: espelhoFolha() mostra todas as combinações; backupAgora() força a cópia de hoje
// =====================================================================

// ---------------------------------------------------------------------
// 1. RETRATO GRANDE (pixel art de corpo inteiro, desenhado por código)
// ---------------------------------------------------------------------
const ESP_W = 96, ESP_H = 136, ESP_CW = 80, ESP_CH = 130;
const ESP_VISTAS = [["down", "De frente"], ["right", "De lado"], ["up", "De costas"], ["left", "Do outro lado"]];
const ESP_POSES = [["pe", "Em pé"], ["cintura", "Mão na cintura"], ["acenar", "Acenando"]];
const ESP_OUT = "rgb(" + OUTLINE.join(",") + ")";
// meia-largura em px: ombro, peito, cintura, quadril
const ESP_BASE = { ele: [13, 12, 10, 11], ela: [10, 11, 8, 11], neutro: [11, 11, 9, 10] };
const ESP_FORMA = { retangulo: [0, 0, 1, 0], ampulheta: [0, 2, -3, 3], pera: [-2, -1, 0, 4], maca: [0, 1, 4, 1], triangulo: [3, 2, 0, -1], atletico: [3, 2, -2, 0] };
const ESP_FISICO = { magro: [-1, -2, -2, -2], medio: [0, 0, 0, 0], cheinho: [1, 2, 3, 2] };
function geoEsp(v){
  const b = ESP_BASE[v.corpo] || ESP_BASE.neutro, f = ESP_FORMA[v.forma] || ESP_FORMA.retangulo, q = ESP_FISICO[v.fisico] || ESP_FISICO.medio;
  const [sh, ch, wa, hi] = b.map((x, i) => x + f[i] + q[i]);
  const dh = v.altura === "alto" ? 1 : v.altura === "baixinho" ? -1 : 0, L = 34 + 5 * dh, T = 30 + dh, by = 126, cx = 40;
  const yC = by - 4 - L, yS = yC - T, magro = v.fisico === "magro", cheio = v.fisico === "cheinho";
  return { cx, by, sh, ch, wa, hi, dh, L, T, yC, yS, yCh: yS + 9, yW: yS + 17, yH: yC - 5, yP: yC - 8, hc: yS - 3, ht: yS - 29,
    aw: 5 + (magro ? -1 : cheio ? 1 : 0) + (v.forma === "atletico" ? 1 : 0), lg: (magro ? -1 : cheio ? 1 : 0) + (v.forma === "pera" ? 1 : 0),
    busto: v.corpo === "ela" ? 2 : 0, barrigaF: (v.forma === "maca" ? 3 : 0) + (cheio ? 2 : 0), bumbum: (v.forma === "pera" || v.forma === "ampulheta" ? 2 : 0) + (cheio ? 1 : 0) };
}
function interp(pts, y){
  if (y <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]){ const [y0, a] = pts[i - 1], [y1, b] = pts[i]; return a + (b - a) * (y - y0) / Math.max(1, y1 - y0); }
  return pts[pts.length - 1][1];
}
const hwEsp = (g, y) => Math.round(interp([[g.yS, g.sh - 3], [g.yS + 3, g.sh], [g.yCh, g.ch], [g.yW, g.wa], [g.yH, g.hi], [g.yC, g.hi - 1]], y));
function elipse(cx, cy, rx, ry, c){
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++){
    const k = 1 - Math.pow(dy / (ry + .5), 2); if (k <= 0) continue;
    const h = rx * Math.sqrt(k) + .5; R(Math.round(cx - h), Math.round(cy + dy), Math.round(cx + h) - Math.round(cx - h), 1, c);
  }
}
// pontos ao longo de uma linha quebrada (de meio em meio pixel), com a fração do caminho
function trilha(pts){
  const out = []; let tot = 0; const seg = [];
  for (let i = 1; i < pts.length; i++){ const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); tot += d; }
  let acc = 0;
  for (let i = 1; i < pts.length; i++){
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.ceil(seg[i - 1] * 2));
    for (let k = 0; k <= n; k++){ const t = k / n; out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (acc + seg[i - 1] * t) / (tot || 1)]); }
    acc += seg[i - 1];
  }
  return out;
}
// membro grosso (braço, rabo de cavalo): de t0 a t1 do caminho; borda = contorno escuro por baixo
function membro(pts, w, c, t0, t1, borda){
  const tr = trilha(pts); t0 = t0 || 0; t1 = t1 == null ? 1 : t1;
  const pinta = (ww, cc) => { for (const [x, y, t] of tr) if (t >= t0 - 1e-6 && t <= t1 + 1e-6){ const wv = typeof ww === "function" ? ww(t) : ww; R(Math.round(x - wv / 2), Math.round(y - wv / 2), Math.round(wv), Math.round(wv), cc); } };
  if (borda) pinta(typeof w === "function" ? t => w(t) + 2 : w + 2, ESP_OUT);
  pinta(w, c);
}
function ptEm(pts, t){ const tr = trilha(pts); let best = tr[0]; for (const p of tr) if (Math.abs(p[2] - t) < Math.abs(best[2] - t)) best = p; return best; }

// paleta e roupas do retrato
// cor dos olhos combinando com o cabelo (cabelo castanho = olho mel, cabelo colorido = olho da mesma cor)
const OLHOS_ESP = ["#9A5F2C", "#A8652B", "#C47F2E", "#4F8FC4", "#6F8FA8", "#7A5233", "#C2507E", "#6E5FD0", "#C4652E", "#4F9DC4", "#D46FAA", "#3F8FD0", "#3F9A6E"];
function palEsp(v){
  const skin = PELES[v.pele], hair = CABELOS[v.cabelo], cor = ROUPAS[v.roupa], tj = v.traje;
  const CREME = "#FFF4E0", JEANS = "#56609E";
  const terno = tj === 8 ? mix(cor, "#1E1A2A", .55) : null;
  // cor dos olhos: puxa do cabelo (castanho vira castanho-mel, cabelo colorido dá olho da mesma cor)
  const iris = OLHOS_ESP[v.cabelo] || "#8C5A2B";
  const top = tj === 2 || tj === 3 ? CREME : terno || cor;
  return { skin, skD: sh(skin, -.16), skDD: sh(skin, -.3), skL: sh(skin, .2), hair, hl: sh(hair, .32), dk: sh(hair, -.25), dk2: sh(hair, -.45),
    cor, corD: sh(cor, -.24), corDD: sh(cor, -.42), corL: sh(cor, .28), top, topD: sh(top, -.2), topL: sh(top, .25), CREME, JEANS, jD: sh(JEANS, -.22), jL: sh(JEANS, .2), terno,
    eye: hexRGB(skin)[0] < 170 ? "#1E1220" : "#3A2433", lash: "#1A1020", iris, irisL: sh(iris, .35), irisD: sh(iris, -.3), boca: sh(skin, -.5), blush: "rgba(238,96,110,.45)", tie: "#E8607A" };
}

// ---- cabelo: borda de baixo (relativa ao topo da cabeça) por coluna, para frente, lado e costas ----
const NUCA = [20, 46, 17, 24, 15, 25, 15, 15, 15, 14];
function cabeloBaixo(st, vista, s){
  const d = Math.abs(s), z = (s + 60) % 3 === 0 ? 1 : 0;
  if (vista === "up"){
    if (st === 1) return d <= 15 ? 46 - (d > 13 ? 3 : 0) : -99;
    if (st === 5) return d <= 14 ? 25 : -99;
    if (st === 3) return d <= 15 ? 24 + ((s + 60) % 4 === 0 ? 1 : 0) : -99;
    if (st === 8) return d <= 12 ? 16 : 12;
    return d >= 11 ? 15 : [21, 46, 20, 24, 19, 25, 20, 20, 16, 19][st] + (st === 0 ? z : 0);
  }
  if (vista === "right"){ // s > 0 é a frente do rosto
    if (s > 3) return [8, 6, 6, 10, 4, 11, 6, 6, 7, 5][st] + (st === 0 || st === 3 ? z : 0);
    if (s >= -2) return st === 1 || st === 5 || st === 3 ? NUCA[st] : st === 4 ? 10 : 12;
    return NUCA[st] + (st === 3 ? ((s + 60) % 4 === 0 ? 1 : 0) : 0);
  }
  switch (st){ // de frente
    case 0: return d <= 8 ? 8 + z : d <= 9 ? 11 : d <= 11 ? 16 : 12;
    case 1: return d <= 8 ? (s === -3 ? 4 : 6 + Math.min(3, Math.abs(s + 3) >> 1)) : 43 - (d > 12 ? 2 : 0);
    case 2: return d <= 8 ? 6 : d <= 11 ? 13 : 11;
    case 3: return d <= 8 ? 9 + ((s + 60) % 4 === 0 ? 1 : 0) : 22 + ((s + 60) % 3 === 0 ? 1 : 0);
    case 4: return d <= 9 ? 4 : 12;
    case 5: return d <= 9 ? 11 : 24;
    case 6: return d <= 8 ? 6 + (s > 0 ? 1 : 0) : 13;
    case 7: return d <= 8 ? (s === 0 ? 3 : 6) : 13;
    case 8: return d <= 9 ? 7 : 15;
    default: return d <= 8 ? 5 : d <= 11 ? 12 : 10;
  }
}
// pinta a "capa" do cabelo coluna por coluna, com mechas, pontas e brilho
function capaCabelo(g, p, st, vista, extraR){
  const cx = g.cx, ht = g.ht, Rr = (st === 3 ? 14.5 : st === 4 ? 12 : 13) + (extraR || 0), sobe = st === 3 ? 13 : st === 4 ? 10.5 : 11.5;
  const base = st === 4 ? mix(p.hair, p.skin, .3) : p.hair;
  for (let x = Math.floor(cx - Rr); x <= Math.ceil(cx + Rr); x++){
    const s = x - cx, k = 1 - Math.pow(s / (Rr + .5), 2); if (k <= 0) continue;
    const top = Math.round(ht + 11 - Math.sqrt(k) * sobe), bot = ht + cabeloBaixo(st, vista, s);
    for (let y = top; y < bot; y++){
      let c = base;
      const u = (y - top) / Math.max(1, bot - top);
      if (st === 4) c = (x + y) % 2 ? base : sh(base, -.12);
      else if (st === 3){ if ((x * 7 + y * 3) % 5 === 0) c = p.dk; else if ((x * 3 + y * 7) % 11 === 0) c = p.hl; else if (u > .6 && (x + y) % 3 === 0) c = p.dk; }
      else {
        // mechas: cada mecha tem miolo claro e beira escura, e elas descem levemente curvas
        const m = ((s + 64 + Math.round(u * 2.2 * Math.sign(s || 1))) % 5 + 5) % 5;
        if (m === 0 && y > top + 2 && y < bot - 1) c = p.dk;
        else if (m === 2 && y > top + 4 && u < .8) c = sh(base, .1);
        if (u > .72 && m !== 2) c = mix(c, p.dk, .5); // pontas mais escuras embaixo
        if (y === top || y === top + 1 && Math.abs(s) > Rr - 5) c = sh(c, -.08);
      }
      if (y === bot - 1 && st !== 4) c = p.dk2;
      if (st === 9 && Math.abs(s) >= 9 && vista !== "right") c = mix(p.hair, p.skin, .3);
      if (s > Rr - 3 && st !== 4 && y > top + 1) c = sh(c, -.15);
      R(x, y, 1, 1, c);
    }
    // brilho em arco
    if (st !== 4 && st !== 3 && s >= -9 && s <= -2 && bot > top + 4){ P(x, top + 2, p.hl); if (s >= -7 && s <= -4) P(x, top + 3, p.hl); }
  }
}
// camadas de trás (atrás do corpo) e extras (coque, rabo, chiquinhas, topete, black power)
function cabeloAtras(g, p, st, vista){
  const cx = g.cx, ht = g.ht;
  if (st === 8){ // black power: bolão atrás da cabeça
    const ox = vista === "right" ? -4 : 0; elipse(cx + ox, ht + 9, 19, 17, p.hair);
    for (let y = ht - 8; y < ht + 26; y++) for (let x = cx + ox - 19; x <= cx + ox + 19; x++){ if (Math.pow((x - cx - ox) / 18.5, 2) + Math.pow((y - ht - 9) / 16.5, 2) > 1) continue; const h = hash(x, y, 8) % 13; if (h === 0) P(x, y, p.dk); else if (h === 1 && y < ht + 6 && x < cx + ox) P(x, y, p.hl); }
    return;
  }
  if (vista === "up") return; // de costas, o cabelo comprido vai por cima do corpo
  if (st === 1){ // comprido: lençol atrás dos ombros
    const x0 = vista === "right" ? cx - 15 : cx - 15, x1 = vista === "right" ? cx - 1 : cx + 15;
    for (let x = x0; x <= x1; x++){ const d = Math.abs(x - cx); for (let y = ht + 9; y < ht + 46 - (d > 13 ? 3 : 0) - (vista === "right" && x > cx - 4 ? 6 : 0); y++) P(x, y, (x + 64) % 4 === 1 ? p.dk : sh(p.hair, -.1)); }
  } else if (st === 5 && vista !== "right"){ for (let x = cx - 14; x <= cx + 14; x++) R(x, ht + 10, 1, 15, sh(p.hair, -.1)); }
  else if (st === 6 && vista === "down"){ membro([[cx + 10, ht + 9], [cx + 13, ht + 18], [cx + 12, ht + 32]], t => 6 - t * 3, p.hair, 0, 1, true); }
}
function cabeloExtras(g, p, st, vista, frente){
  const cx = g.cx, ht = g.ht, tie = p.tie;
  if (st === 2){ // coque
    const bx = vista === "right" ? cx - 8 : cx, by = vista === "right" ? ht + 1 : ht - 3;
    elipse(bx, by, 6, 5.5, p.hair); P(bx - 3, by - 3, p.hl); P(bx - 2, by - 4, p.hl); P(bx + 3, by + 1, p.dk); R(bx - 1, by - 1, 3, 1, p.dk);
    R(bx - 4, by + 5, 8, 2, tie); P(bx - 4, by + 5, sh(tie, .3));
  } else if (st === 6){ // rabo de cavalo
    if (vista === "right"){ membro([[cx - 11, ht + 8], [cx - 16, ht + 16], [cx - 15, ht + 34]], t => 7 - t * 4, p.hair, 0, 1, true); R(cx - 13, ht + 6, 3, 4, tie); }
    else if (vista === "up"){ membro([[cx, ht + 9], [cx + 1, ht + 20], [cx, ht + 36]], t => 7 - t * 4, p.hair, 0, 1, true); R(cx - 2, ht + 7, 4, 3, tie); for (let y = ht + 14; y < ht + 34; y += 4) P(cx, y, p.dk); }
    else R(cx + 10, ht + 7, 3, 3, tie);
  } else if (st === 7){ // maria-chiquinha
    const lados = vista === "right" ? [-1] : [-1, 1];
    for (const l of lados){
      const x0 = vista === "right" ? cx - 4 : cx + l * 13;
      membro([[x0, ht + 10], [x0 + l * 3, ht + 19], [x0 + l * 2, ht + 32]], t => 7 - t * 3, p.hair, 0, 1, true);
      R(x0 - 2, ht + 8, 4, 3, tie); P(x0 - 1, ht + 8, sh(tie, .3)); P(x0 + l * 2, ht + 18, p.hl); P(x0 + l * 2, ht + 24, p.dk);
    }
  } else if (st === 9){ // topete
    const ox = vista === "right" ? 3 : vista === "up" ? 0 : -1;
    elipse(cx + ox, ht - 1, 10, 5, p.hair); for (let x = cx + ox - 7; x <= cx + ox + 2; x++) P(x, ht - 4 + (x > cx + ox - 2 ? 1 : 0), p.hl);
    P(cx + ox + 6, ht + 2, p.dk); P(cx + ox + 7, ht + 1, p.dk); if (vista !== "up") P(cx + ox + 8, ht + 3, p.hair);
  } else if (st === 3 && frente){ for (let i = 0; i < 6; i++){ const x = cx - 13 + i * 5 + (i % 2), y = ht + 20 + (i % 2); if (Math.abs(x - cx) < 10) continue; elipse(x, y, 2, 2, p.hair); P(x, y, p.dk); } } // cachinhos só dos lados (no meio caíam em cima do rosto)
}

// ---- rosto ----
function rostoEsp(g, p, v, vista, hum, piscar){
  const cx = g.cx, ht = g.ht, ela = v.corpo === "ela";
  const feliz = hum === "muitoFeliz", bem = hum === "feliz", brava = hum === "chateado", triste = hum === "triste";
  const bc = v.barba ? sh(p.hair, -.1) : null, sobr = p.dk2;
  if (vista === "down"){
    if (bc){ for (let y = ht + 16; y <= ht + 26; y++){ const k = 1 - Math.pow((y - (ht + 13)) / 13.5, 2); if (k <= 0) continue; const h = Math.round(11 * Math.sqrt(k)); for (let x = cx - h; x < cx + h; x++){ const d = Math.abs(x - cx + .5); if (y >= ht + 20 || d >= 7.5) P(x, y, (x + y) % 3 ? bc : sh(bc, -.15)); } } R(cx - 4, ht + 20, 8, 1, bc); }
    for (const [ex, l] of [[cx - 8, -1], [cx + 4, 1]]){
      // olho grande: cílio em cima, íris colorida embaixo, brilho grande em cima e um pontinho de luz embaixo
      const ey = ht + 12;
      if (feliz){ P(ex, ey + 3, p.eye); P(ex + 1, ey + 2, p.eye); P(ex + 2, ey + 2, p.eye); P(ex + 3, ey + 3, p.eye); }
      else if (piscar){ R(ex, ey + 3, 4, 1, p.eye); if (ela) P(l < 0 ? ex - 1 : ex + 4, ey + 2, p.eye); }
      else {
        // l l l l / D W W D / D W I D / I I L I / D I I D
        R(ex, ey, 4, 5, p.eye); R(ex, ey, 4, 1, p.lash);
        R(ex, ey + 3, 4, 1, p.iris); R(ex + 1, ey + 4, 2, 1, p.irisD); P(ex + 2, ey + 2, p.iris); P(ex + 2, ey + 3, p.irisL);
        R(ex + 1, ey + 1, 2, 1, "#FFFFFF"); P(ex + 1, ey + 2, "#FFFFFF");
        if (brava) R(ex, ey, 4, 2, p.skD);
        if (ela){ P(l < 0 ? ex - 1 : ex + 4, ey, p.lash); P(l < 0 ? ex - 1 : ex + 4, ey - 1, p.lash); }
      }
      // sobrancelhas: brava = ponta de dentro desce; triste = ponta de dentro sobe
      const dentro = l < 0 ? ex + 3 : ex, fora = l < 0 ? ex - 1 : ex + 4, by0 = ht + 9;
      if (brava){ P(fora, by0 - 1, sobr); P((fora + dentro) / 2 | 0, by0, sobr); P(dentro, by0 + 1, sobr); P(l < 0 ? ex + 1 : ex + 2, by0, sobr); }
      else if (triste){ P(fora, by0 + 1, sobr); P(l < 0 ? ex + 1 : ex + 2, by0, sobr); P(dentro, by0 - 1, sobr); P(l < 0 ? ex + 2 : ex + 1, by0, sobr); }
      else { R(ex - (l < 0 ? 1 : 0), by0 - (feliz ? 1 : 0), 5, 1, sobr); P(l < 0 ? ex - 1 : ex + 4, by0 + 1 - (feliz ? 1 : 0), sobr); }
    }
    P(cx, ht + 18, p.skD); P(cx - 1, ht + 19, p.skD);
    R(cx - 10, ht + 18, 3, 2, feliz || bem ? "rgba(238,96,110,.6)" : p.blush); R(cx + 7, ht + 18, 3, 2, feliz || bem ? "rgba(238,96,110,.6)" : p.blush);
    const y0 = ht + 21, m = bc ? "#B4505E" : p.boca;
    if (feliz){ R(cx - 3, y0, 6, 1, m); R(cx - 2, y0, 4, 1, "#FFFFFF"); R(cx - 2, y0 + 1, 4, 1, m); R(cx - 1, y0 + 1, 2, 1, "#E8607A"); P(cx - 1, y0 + 2, m); P(cx, y0 + 2, m); }
    else if (bem){ P(cx - 3, y0, m); R(cx - 2, y0 + 1, 4, 1, m); P(cx + 2, y0, m); }
    else if (brava){ R(cx - 2, y0 + 1, 4, 1, m); P(cx - 3, y0 + 2, m); P(cx + 2, y0 + 2, m); }
    else if (triste){ P(cx - 3, y0 + 2, m); R(cx - 2, y0 + 1, 4, 1, m); P(cx + 2, y0 + 2, m); P(cx - 7, ht + 17, "#BFE6F7"); P(cx - 7, ht + 18, "#7FB8E8"); }
    else R(cx - 1, y0 + 1, 3, 1, m);
  } else if (vista === "right"){
    if (bc){ for (let y = ht + 16; y <= ht + 26; y++) for (let x = cx - 1; x <= cx + 10; x++){ const k = 1 - Math.pow((y - (ht + 13)) / 13.5, 2) - Math.pow((x - cx) / 11.5, 2) * 0; if (k > 0 && x < cx + 11 * Math.sqrt(k) && (y >= ht + 20 || x < cx + 3)) P(x, y, bc); } }
    // nariz (sai da cabeça)
    P(cx + 11, ht + 16, p.skin); R(cx + 11, ht + 17, 2, 2, p.skin); P(cx + 12, ht + 18, p.skD);
    const ex = cx + 5, ey = ht + 13;
    if (feliz){ P(ex, ey + 1, p.eye); P(ex + 1, ey + 2, p.eye); P(ex - 1, ey + 2, p.eye); }
    else if (piscar) R(ex, ey + 2, 2, 1, p.eye);
    else { R(ex, ey - 1, 3, 5, p.eye); R(ex, ey + 1, 3, 3, p.iris); P(ex + 1, ey + 2, p.irisL); R(ex, ey - 1, 3, 1, p.lash); P(ex + 1, ey, "#FFFFFF"); P(ex + 2, ey, "#FFFFFF"); P(ex + 2, ey + 1, "#FFFFFF"); if (brava) R(ex, ey - 1, 3, 2, p.skD); if (ela){ P(ex + 3, ey - 1, p.lash); P(ex + 3, ey - 2, p.lash); } }
    if (brava){ P(ex - 1, ht + 9, sobr); P(ex, ht + 10, sobr); P(ex + 1, ht + 10, sobr); P(ex + 2, ht + 11, sobr); }
    else if (triste){ P(ex - 1, ht + 11, sobr); R(ex, ht + 10, 2, 1, sobr); P(ex + 2, ht + 9, sobr); P(ex, ht + 17, "#7FB8E8"); }
    else R(ex - 1, ht + 10 - (feliz ? 1 : 0), 4, 1, sobr);
    R(cx + 4, ht + 18, 3, 2, feliz || bem ? "rgba(238,96,110,.6)" : p.blush);
    const m = bc ? "#B4505E" : p.boca, y0 = ht + 21;
    if (feliz){ R(cx + 7, y0, 3, 2, m); P(cx + 8, y0, "#FFFFFF"); P(cx + 9, y0 + 1, "#E8607A"); }
    else if (bem){ P(cx + 7, y0, m); R(cx + 8, y0 + 1, 2, 1, m); }
    else if (brava || triste){ R(cx + 7, y0 + 1, 2, 1, m); P(cx + 9, y0 + 2, m); }
    else R(cx + 8, y0 + 1, 2, 1, m);
    // orelha
    elipse(cx - 1, ht + 15, 2, 3, p.skin); P(cx - 1, ht + 15, p.skD); P(cx - 1, ht + 16, p.skDD);
  }
}

// ---- acessórios ----
function acessEsp(g, p, v, vista){
  const a = v.acess, cx = g.cx, ht = g.ht, st = v.estilo, side = vista === "right";
  const topo = st === 8 ? ht - 7 : st === 3 ? ht - 2 : st === 9 ? ht - 5 : st === 2 && !side ? ht - 8 : ht;
  if (a === 1){ // óculos redondos
    const f = "#C68A3E", lente = "rgba(220,240,255,.35)";
    if (vista === "down"){
      for (const ex of [cx - 8, cx + 4]){ R(ex - 1, ht + 11, 6, 1, f); R(ex - 1, ht + 17, 6, 1, f); R(ex - 2, ht + 12, 1, 5, f); R(ex + 4, ht + 12, 1, 5, f); P(ex + 3, ht + 12, lente); }
      R(cx - 3, ht + 13, 5, 1, f); P(cx - 10, ht + 13, f); P(cx + 9, ht + 13, f);
    } else if (side){ R(cx + 4, ht + 12, 4, 1, f); R(cx + 4, ht + 17, 4, 1, f); R(cx + 3, ht + 13, 1, 4, f); R(cx + 7, ht + 13, 1, 4, f); R(cx - 1, ht + 13, 4, 1, f); }
    else { P(cx - 11, ht + 14, f); P(cx + 10, ht + 14, f); }
  } else if (a === 2){ // laço
    const c = "#E8607A", cD = "#B8405A", cL = "#F7A3B5", bx = side ? cx - 4 : vista === "up" ? cx - 6 : cx + 5, y = topo + 1;
    for (const l of [-1, 1]){ for (let i = 0; i < 4; i++) R(bx + l * (2 + i), y - 1 - (i >> 1), 1, 3 + i, c); P(bx + l * 3, y - 1, cL); P(bx + l * 5, y + 2, cD); }
    R(bx - 1, y, 3, 3, cD); P(bx, y + 1, c); R(bx - 2, y + 3, 1, 3, c); R(bx + 2, y + 3, 1, 3, c);
  } else if (a === 3){ // boné
    const c = "#E8735F", cD = sh(c, -.25), cL = sh(c, .3), y = topo;
    elipse(cx, y + 6, 13, 7, c); R(cx - 13, y + 6, 27, 7, c); R(cx - 13, y + 11, 27, 2, cD); for (let x = cx - 6; x <= cx - 1; x++) P(x, y + 2, cL); R(cx - 1, y - 1, 3, 2, cD);
    if (vista === "down"){ R(cx - 15, y + 12, 31, 3, cD); R(cx - 14, y + 12, 29, 1, c); P(cx - 1, y + 6, "#FFFFFF"); R(cx - 2, y + 7, 4, 2, "#FFFFFF"); }
    else if (side){ R(cx + 6, y + 11, 13, 3, cD); R(cx + 6, y + 11, 13, 1, c); }
    else { R(cx - 4, y + 9, 8, 2, "#FFF4E0"); }
  } else if (a === 4){ // flor
    const fx = side ? cx - 2 : vista === "up" ? cx + 8 : cx - 9, fy = topo + 4, pt = "#F9B8CC", pD = "#E58FB5";
    for (const [dx, dy] of [[0, -2], [2, 0], [0, 2], [-2, 0]]) elipse(fx + dx, fy + dy, 1.5, 1.5, (dx + dy) > 0 ? pD : pt);
    R(fx - 1, fy - 1, 2, 2, "#FFE08A"); P(fx + 3, fy + 3, "#4FA568"); P(fx + 4, fy + 4, "#4FA568");
  } else if (a === 5){ // coroa de flores
    const y = topo + 3, cores = ["#F49AAE", "#F6C667", "#B49CF4", "#FFFFFF", "#F49AAE", "#F6C667", "#B49CF4"];
    R(cx - 13, y + 1, 26, 2, "#4FA568"); for (let x = cx - 12; x <= cx + 12; x += 3) P(x, y + 2, "#8AD490");
    if (!side) cores.forEach((c, i) => { const x = cx - 12 + i * 4; elipse(x, y, 1.5, 1.5, c); P(x, y, "#F6C667"); });
    else [0, 1, 2].forEach(i => { const x = cx - 8 + i * 6; elipse(x, y, 1.5, 1.5, cores[i]); P(x, y, "#F6C667"); });
  } else if (a === 6){ // cachecol listrado
    const c = "#D9483D", s2 = "#F6C667", y = g.hc - 2;
    R(cx - 8, y, 16, 6, c); for (let x = cx - 7; x < cx + 8; x += 4) R(x, y, 2, 6, s2); R(cx - 8, y + 5, 16, 1, sh(c, -.25));
    if (vista === "down"){ R(cx + 2, y + 5, 5, 14, c); R(cx + 2, y + 9, 5, 2, s2); R(cx + 2, y + 15, 5, 2, s2); for (let x = cx + 2; x < cx + 7; x += 2) P(x, y + 19, s2); }
    else if (side){ R(cx + 4, y + 4, 4, 12, c); R(cx + 4, y + 8, 4, 2, s2); }
    else { R(cx - 6, y + 5, 5, 10, c); R(cx - 6, y + 9, 5, 2, s2); }
  } else if (a === 7){ // chapéu de festa
    const by0 = topo + 2, px = side ? cx - 1 : cx, c1 = "#7FB8E8", c2 = "#F6C667";
    for (let i = 0; i < 12; i++){ const w = Math.max(1, Math.round(12 - i)); R(px - (w >> 1), by0 - i, w, 1, (i >> 1) % 2 ? c2 : c1); }
    elipse(px, by0 - 13, 2.5, 2.5, "#FFFFFF"); P(px - 2, by0 - 5, "#E8607A"); P(px + 2, by0 - 8, "#E8607A"); P(px - 1, by0 - 2, "#E8607A");
  } else if (a === ACESS_COLAR){ // colar de coração
    const ou = "#F6C667", ouD = "#D8963A", y = g.yS;
    if (vista === "down"){ for (let i = -5; i <= 5; i++) P(cx + i, y + 1 + Math.round((25 - i * i) / 6), Math.abs(i) % 2 ? ouD : ou); R(cx - 2, y + 6, 2, 2, "#E8445E"); R(cx + 1, y + 6, 2, 2, "#E8445E"); R(cx - 1, y + 7, 3, 2, "#E8445E"); P(cx, y + 9, "#E8445E"); P(cx - 2, y + 6, "#F7A3B5"); }
    else if (side){ for (let i = 0; i < 6; i++) P(cx + 2 + i, y + i, ou); R(cx + 7, y + 6, 2, 3, "#E8445E"); }
    else R(cx - 5, y, 10, 1, ouD);
  }
}

// ---- corpo inteiro ----
function corTronco(tj, p, g, y){
  switch (tj){
    case 0: return y < g.yP ? p.cor : p.JEANS;
    case 2: return y <= g.yW ? p.CREME : p.cor;
    case 3: return y < g.yCh + 2 ? p.CREME : p.cor;
    case 4: return y < g.yP + 1 ? p.cor : p.JEANS;
    case 5: return y < g.yP ? p.cor : p.JEANS;
    case 7: return y < g.yS + 4 ? p.skin : p.cor;
    case 8: return p.terno;
    default: return p.cor;
  }
}
function corPerna(tj, p, g, y){
  if (tj === 0 || tj === 4) return p.JEANS;
  if (tj === 5) return y < g.yC + 9 ? p.JEANS : p.skin;
  if (tj === 3 || tj === 6) return p.cor;
  if (tj === 8) return p.terno;
  return p.skin;
}
const MANGA = [.38, .2, .35, .35, 1, 0, 1, 0, 1]; // até onde vai a manga no braço
function bracosEsp(g, p, v, vista, pose, aceno, so){
  const cx = g.cx, yS = g.yS, aw = g.aw, tj = v.traje, mangaC = tj === 2 || tj === 3 ? p.CREME : p.top;
  const larg = y => Math.max(hwEsp(g, y), g.barr ? barrigaHW(g, y) : 0);
  const desenha = (pts, maoAberta) => {
    membro(pts, t => aw - t * 1.2, p.skin, 0, 1, true);
    membro(pts.map(([x, y]) => [x + aw * .32, y]), 1.3, p.skD, .05, .92, false); // sombra do lado de fora do braço
    if (MANGA[tj]) membro(pts, t => aw + .6 - t * 1.2, mangaC, 0, MANGA[tj], true);
    if (MANGA[tj]) membro(pts, t => aw + .6 - t * 1.2, sh(mangaC, -.12), MANGA[tj] - .03, MANGA[tj], false); // barra da manga
    if (tj === 8 && MANGA[tj] === 1) membro(pts, aw - .5, "#FFFFFF", .94, 1, false); // punho branco do terno
    if (tj === 4) membro(pts, aw + .6, p.corD, .9, 1, false); // punho do moletom
    const [hx, hy] = pts[pts.length - 1];
    if (maoAberta){ elipse(hx, hy - 2, 3, 3.5, p.skin); for (let i = -2; i <= 1; i++) R(Math.round(hx + i * 1.5), Math.round(hy - 8), 1, 3, p.skin); R(Math.round(hx + 3), Math.round(hy - 4), 1, 2, p.skin); P(Math.round(hx), Math.round(hy - 2), p.skD); }
    else { elipse(hx, hy + 1.5, 2.8, 3, p.skin); P(Math.round(hx + 1), Math.round(hy + 2), p.skD); }
  };
  if (vista === "right"){ // de lado só aparece o braço de perto
    if (pose === "acenar"){ if (so === "alto") desenha([[cx + 1, yS + 3], [cx + 8, yS + 9], [cx + 10 + aceno, yS - 6]], true); }
    else if (so === "baixo") desenha(pose === "cintura" ? [[cx, yS + 3], [cx - 8, yS + 12], [cx - 3, g.yW + 1]] : [[cx, yS + 3], [cx + 1, yS + 15], [cx + 2, yS + 27]]);
    return;
  }
  // caminhos do braço do lado esquerdo da tela; M espelha pro outro lado
  const M = q => q.map(([x, y]) => [2 * cx - x - 1, y]), costas = vista === "up";
  const solto = [[cx - g.sh + 2, yS + 3], [cx - larg(yS + 15) - aw / 2 - .5, yS + 15], [cx - Math.max(larg(yS + 26), larg(g.yH)) - aw / 2 - 1, yS + 27]];
  const cintura = [[cx - g.sh + 2, yS + 3], [cx - g.sh - 8, yS + 13], [cx - larg(g.yW) - 1, g.yW + 1]];
  const acena = [[cx - g.sh + 2, yS + 3], [cx - g.sh - 7, yS + 9], [cx - g.sh - 9 - aceno, yS - 6]];
  // A = braço que vai na cintura (esquerda da tela de frente); B = braço que acena (direita da tela de frente). De costas, trocam.
  const A = costas ? M : q => q, B = costas ? q => q : M;
  if (so === "baixo"){ // braços abaixados (antes da cabeça); o que acena vai depois do cabelo
    desenha(A(pose === "cintura" ? cintura : solto));
    if (pose !== "acenar") desenha(B(solto));
  } else if (pose === "acenar") desenha(B(acena), true);
}
function barrigaHW(g, y){ const b = g.barr; if (!b) return 0; const cy = g.yW + 3, ry = 5 + 2 * b, rx = g.wa + 1 + 2 * b; const k = 1 - Math.pow((y - cy) / (ry + .5), 2); return k > 0 ? Math.round(rx * Math.sqrt(k)) : 0; }
function pernasEsp(g, p, v, vista){
  const cx = g.cx, by = g.by, tj = v.traje, lg = g.lg;
  const sapato = tj === 8 ? "#2A2232" : tj === 6 ? sh(p.cor, .45) : tj === 7 ? "#F6C667" : tj === 1 || tj === 2 ? sh(p.cor, -.35) : "#F1EDF7";
  if (vista === "right"){
    for (const [ox, esc] of [[-3, true], [1, false]]){
      for (let y = g.yC - 2; y < by - 4; y++){
        const t = (y - g.yC) / (by - 4 - g.yC), w = Math.round(interp([[0, 11 + lg], [.5, 7.5 + lg], [1, 6 + lg / 2]], t)), x0 = cx + ox - (w >> 1);
        let c = corPerna(tj, p, g, y); if (esc) c = sh(c, -.18);
        R(x0, y, w, 1, c); P(x0, y, sh(c, -.12));
        if (c !== p.skin && !esc && y > g.yC + 3) P(x0 + w - 2, y, sh(c, .1));
      }
      const fx = cx + ox - 3; R(fx, by - 4, 9, 4, esc ? sh(sapato, -.18) : sapato); R(fx, by - 1, 9, 1, sh(sapato, -.3)); R(fx + 1, by - 4, 5, 1, sh(sapato, .15));
    }
    return;
  }
  for (const l of [-1, 1]){
    for (let y = g.yC - 2; y < by - 4; y++){
      const t = (y - g.yC) / (by - 4 - g.yC), fora = Math.round(interp([[0, g.hi - 1], [.45, 7 + lg], [1, 5 + (lg > 0 ? 1 : 0)]], t)), dentro = t < .1 ? 0 : 1;
      const c = corPerna(tj, p, g, y), x0 = l < 0 ? cx - fora : cx + dentro, x1 = l < 0 ? cx - dentro : cx + fora;
      R(x0, y, x1 - x0, 1, c);
      if (l > 0){ P(x1 - 1, y, sh(c, -.18)); P(x1 - 2, y, sh(c, -.08)); } else { P(x0, y, sh(c, .12)); P(x1 - 1, y, sh(c, -.1)); }
      if (c === p.skin && Math.abs(t - .5) < .03) P(l < 0 ? x0 + 2 : x1 - 3, y, p.skD); // joelho
      if (c !== p.skin && l < 0 && y > g.yC + 2) P(x1 - 1, y, sh(c, -.15)); // costura de dentro
    }
    const fx = l < 0 ? cx - 8 : cx + 1;
    R(fx, by - 4, 7, 4, sapato); R(fx, by - 1, 7, 1, sh(sapato, -.3)); R(fx + 1, by - 4, 5, 1, sh(sapato, .15));
    if (sapato === "#F1EDF7"){ P(fx + 2, by - 3, "#C6C0D2"); P(fx + 4, by - 3, "#C6C0D2"); R(fx, by - 1, 7, 1, "#E8735F"); }
    if (tj === 6){ P(fx + 1, by - 4, "#F9C9D6"); P(fx + 5, by - 4, "#F9C9D6"); } // pantufa com orelhinha
    // barra dobrada do jeans
    if (corPerna(tj, p, g, by - 5) === p.JEANS) R(l < 0 ? cx - 6 - (lg > 0 ? 1 : 0) : cx + 1, by - 6, 5 + (lg > 0 ? 1 : 0), 1, p.jL);
  }
}
function troncoEsp(g, p, v, vista){
  const cx = g.cx, tj = v.traje, side = vista === "right", up = vista === "up";
  const fr = y => Math.round(interp([[g.yS, 5], [g.yS + 3, 7], [g.yCh, 8 + g.busto + (g.barrigaF > 2 ? 1 : 0)], [g.yW, 7 + g.barrigaF], [g.yH, 7 + (g.barrigaF ? 1 : 0)], [g.yC, 6]], y));
  const bk = y => Math.round(interp([[g.yS, 6], [g.yS + 3, 7], [g.yCh, 8], [g.yW, 6], [g.yH, 8 + g.bumbum], [g.yC, 7 + g.bumbum]], y));
  // pescoço
  if (side) R(cx - 3, g.hc - 4, 6, 7, p.skin), R(cx - 3, g.hc - 4, 2, 7, p.skD);
  else { R(cx - 3, g.hc - 4, 6, 7, p.skin); R(cx - 3, g.hc - 1, 6, 1, p.skD); }
  for (let y = g.yS; y <= g.yC; y++){
    const c = corTronco(tj, p, g, y), cD = sh(c, -.2), cL = sh(c, .2);
    if (side){ const b = bk(y), f = fr(y); R(cx - b, y, b + f, 1, c); R(cx - b, y, 2, 1, cD); P(cx + f - 1, y, cL); }
    else {
      // luz vindo da esquerda: beira clara, miolo, meia-sombra e sombra na direita; sombrinha embaixo do braço
      const w = hwEsp(g, y); R(cx - w, y, 2 * w, 1, c); R(cx + w - 4, y, 2, 1, sh(c, -.1)); R(cx + w - 2, y, 2, 1, cD); P(cx - w, y, cL); P(cx - w + 1, y, sh(c, .1));
      if (y >= g.yS + 3 && y <= g.yS + 9){ P(cx - w + 2, y, sh(c, -.12)); P(cx + w - 5, y, sh(c, -.18)); }
      if (g.busto && y === g.yCh + 4) R(cx - w + 3, y, 2 * w - 6, 1, sh(c, -.1));
    }
  }
  // gravidez
  if (g.barr){
    const b = g.barr, cy = g.yW + 3, bc = corTronco(tj, p, g, g.yW - 2);
    if (side){ elipse(cx + 3 + b, cy, 3 + 2 * b, 5 + 2 * b, bc); for (let i = 0; i < 4; i++) P(cx + 3 + 3 * b + i - 2, cy - 4 - b + i, sh(bc, .25)); }
    else if (!up){ elipse(cx, cy, g.wa + 1 + 2 * b, 5 + 2 * b, bc); R(cx - 3, cy - 3 - b, 3, 1, sh(bc, .25)); R(cx - 4, cy - 2 - b, 1, 2, sh(bc, .25)); R(cx + g.wa - 1 + 2 * b, cy - 2, 2, 5, sh(bc, -.2)); }
    else { const w = barrigaHW(g, cy); R(cx - w, cy - 2, 2, 5, bc); R(cx + w - 2, cy - 2, 2, 5, sh(bc, -.2)); }
  }
  // detalhes de cada roupa
  const yS = g.yS, yW = g.yW, yP = g.yP, cor = p.cor, corD = p.corD, corL = p.corL;
  const w = y => hwEsp(g, y);
  if (side){
    if (tj === 0 || tj === 5) R(cx - bk(yP - 1), yP - 1, bk(yP - 1) + fr(yP - 1), 1, p.corD);
    if (tj === 4){ elipse(cx - 7, yS + 1, 5, 3, p.corD); R(cx - bk(yP), yP, bk(yP) + fr(yP), 2, p.corD); }
    if (tj === 3){ R(cx - 1, yS, 2, g.yCh + 2 - yS, cor); P(cx, g.yCh + 1, C.gold); }
    if (tj === 8){ R(cx + fr(yS + 2) - 3, yS, 2, 10, "#FFFFFF"); R(cx + fr(yS + 4) - 2, yS + 2, 2, 9, "#D9483D"); R(cx + 1, yS + 2, 1, yW - yS, sh(p.terno, .2)); }
    if (tj === 6) elipse(cx - bk(g.yH) - 1, g.yH, 2.5, 2.5, sh(cor, .35)); // rabinho do pijama
    if (tj === 1 || tj === 2 || tj === 7) R(cx - bk(yW), yW, bk(yW) + fr(yW), 1, tj === 7 ? C.gold : corD);
  } else if (up){
    if (tj === 4){ elipse(cx, yS + 3, 7, 4, p.corD); elipse(cx, yS + 3, 5, 2.5, sh(cor, -.35)); R(cx - w(yP), yP, 2 * w(yP), 2, p.corD); }
    if (tj === 3){ for (let i = 0; i < 9; i++){ P(cx - 6 + i, yS + 1 + i, cor); P(cx + 5 - i, yS + 1 + i, cor); P(cx - 5 + i, yS + 1 + i, cor); P(cx + 4 - i, yS + 1 + i, cor); } }
    if (tj === 7){ R(cx - w(yW), yW, 2 * w(yW), 2, C.gold); elipse(cx - 3, yW, 2.5, 2, C.gold); elipse(cx + 3, yW, 2.5, 2, C.gold); R(cx - 1, yW - 1, 2, 3, "#D8963A"); }
    if (tj === 1){ R(cx, yS + 2, 1, yW - yS - 2, corD); R(cx - w(yW), yW, 2 * w(yW), 1, corD); }
    if (tj === 8){ R(cx, g.yCh, 1, g.yH - g.yCh, sh(p.terno, -.2)); }
    if (tj === 0 || tj === 5){ R(cx - w(yP - 1), yP - 1, 2 * w(yP - 1), 1, corD); R(cx - 6, yP + 2, 4, 3, p.jD); R(cx + 2, yP + 2, 4, 3, p.jD); }
    if (tj === 6){ elipse(cx, g.yH, 3, 3, sh(cor, .35)); P(cx - 1, g.yH - 1, "#FFFFFF"); }
    if (tj === 2) R(cx - w(yW), yW, 2 * w(yW), 1, sh(cor, -.15));
  } else {
    if (tj === 0){ // camiseta: gola, estampa de coração, barra e dobrinhas
      R(cx - 3, yS, 6, 2, p.skin); R(cx - 2, yS + 2, 4, 1, p.skin); P(cx - 4, yS, corD); P(cx + 3, yS, corD); P(cx - 3, yS + 2, corD); P(cx + 2, yS + 2, corD); R(cx - 2, yS + 3, 4, 1, corD);
      const hx = cx - 6, hy = g.yCh - 1; R(hx, hy, 2, 1, "#FFFFFF"); R(hx + 3, hy, 2, 1, "#FFFFFF"); R(hx, hy + 1, 5, 1, "#FFFFFF"); R(hx + 1, hy + 2, 3, 1, "#FFFFFF"); P(hx + 2, hy + 3, "#FFFFFF"); P(hx + 1, hy, "#F7A3B5");
      R(cx - w(yP - 1), yP - 1, 2 * w(yP - 1), 1, corD); P(cx + 4, yW - 2, corD); P(cx + 5, yW - 1, corD); P(cx - 5, yW + 1, corD); P(cx - 4, yW + 2, corD);
    } else if (tj === 1){ // vestido: decote, cinto e botõezinhos
      R(cx - 3, yS, 6, 2, p.skin); R(cx - 2, yS + 2, 4, 1, p.skin); R(cx - 3, yS + 3, 6, 1, corD); R(cx - w(yW), yW, 2 * w(yW), 2, corD); P(cx, yW, C.gold);
      for (let y = yS + 6; y < yW - 1; y += 3) P(cx, y, "#FFFFFF");
    } else if (tj === 2){ // blusa com gola e botões, saia (desenhada depois)
      R(cx - 2, yS, 4, 3, p.skin); P(cx - 4, yS + 1, "#E9D8BE"); P(cx - 3, yS + 2, "#E9D8BE"); P(cx + 3, yS + 1, "#E9D8BE"); P(cx + 2, yS + 2, "#E9D8BE");
      for (let y = yS + 5; y < yW; y += 3) P(cx, y, cor); R(cx, yS + 3, 1, yW - yS - 3, "#EFE2CC"); for (let y = yS + 5; y < yW; y += 3) P(cx, y, cor);
    } else if (tj === 3){ // macacão: peitilho com bolso, alças e botões
      const by0 = g.yCh + 2; R(cx - 6, by0 - 3, 12, 3, cor); R(cx - 6, by0 - 3, 12, 1, corL);
      R(cx - 7, yS, 2, by0 - yS - 2, cor); R(cx + 5, yS, 2, by0 - yS - 2, cor); P(cx - 6, by0 - 3, C.gold); P(cx + 5, by0 - 3, C.gold);
      for (let x = cx - 3; x <= cx + 2; x += 2) P(x, by0 + 1, corL); R(cx - 3, by0, 6, 1, corD); R(cx - 3, by0 + 4, 6, 1, corD); P(cx - 3, by0 + 2, corD); P(cx + 2, by0 + 2, corD);
      R(cx - 2, yS, 4, 2, p.skin); R(cx - 1, yS + 2, 2, 1, p.skin);
    } else if (tj === 4){ // moletom: capuz em volta do pescoço, cordões, bolso canguru, barra
      R(cx - 6, yS - 1, 12, 3, p.corD); R(cx - 3, yS - 1, 6, 2, sh(cor, -.4)); R(cx - 2, yS + 2, 1, 7, "#FFFFFF"); R(cx + 1, yS + 2, 1, 6, "#FFFFFF"); P(cx - 2, yS + 9, "#C6C0D2");
      const py = yW + 1; R(cx - 7, py, 14, 7, sh(cor, -.08)); R(cx - 7, py, 14, 1, corD); R(cx - 7, py, 1, 7, corD); R(cx + 6, py, 1, 7, corD); R(cx - 4, py + 1, 8, 1, corL);
      R(cx - w(yP), yP, 2 * w(yP), 2, corD);
    } else if (tj === 5){ // regata: alças largas, cava, cós do short
      R(cx - 5, yS, 10, 3, p.skin); R(cx - 4, yS + 3, 8, 2, p.skin); R(cx - 3, yS + 5, 6, 1, p.skin);
      R(cx - w(yS) , yS, 3, 1, p.skin); R(cx + w(yS) - 3, yS, 3, 1, p.skin);
      for (let y = yS; y < yS + 7; y++){ P(cx - 6, y, corD); P(cx + 5, y, corD); }
      R(cx - w(yP), yP, 2 * w(yP), 2, p.jD); P(cx - 1, yP + 1, "#C6D0DA");
    } else if (tj === 6){ // pijama: barriguinha clara e botões
      elipse(cx, yW + 1, 6, 8, corL); for (let y = yS + 4; y < yW - 4; y += 4) P(cx, y, "#FFFFFF"); R(cx - 2, yS, 4, 2, p.skin); R(cx - 3, yS, 6, 1, p.corD);
    } else if (tj === 7){ // vestido de festa: decote coração, cinto dourado com pedra, brilhinhos
      R(cx - w(yS + 4), yS + 4, 2 * w(yS + 4), 1, corD); P(cx - 1, yS + 4, p.skin); P(cx, yS + 4, p.skin); P(cx, yS + 5, corD); P(cx - 1, yS + 5, corD);
      R(cx - w(yW), yW, 2 * w(yW), 2, C.gold); R(cx - 1, yW, 2, 2, "#7FD1F2"); P(cx - 4, yS + 9, "#FFFFFF"); P(cx + 3, yS + 12, "#FCE9B8");
    } else if (tj === 8){ // terno: camisa, gravata, lapelas, botões e lencinho
      for (let i = 0; i < 9; i++) R(cx - 4 + (i >> 1), yS + i, 8 - 2 * (i >> 1) > 0 ? 8 - 2 * (i >> 1) : 1, 1, "#FFFFFF");
      R(cx - 1, yS + 1, 2, 2, "#B8303A"); R(cx - 1, yS + 3, 2, 9, "#D9483D"); P(cx, yS + 5, "#B8303A"); P(cx - 1, yS + 9, "#B8303A"); P(cx - 1, yS + 12, "#D9483D");
      const lap = sh(p.terno, .22); for (let i = 0; i < 12; i++){ P(cx - 5 + (i >> 1), yS + i, lap); P(cx + 4 - (i >> 1), yS + i, lap); }
      R(cx, yS + 12, 1, g.yH - yS - 10, sh(p.terno, -.25)); P(cx - 2, yW + 1, C.gold); P(cx - 2, yW + 5, C.gold);
      R(cx + 5, g.yCh - 1, 3, 2, corL); R(cx + 4, g.yCh + 1, 5, 1, sh(p.terno, -.2));
    }
    if (g.busto && tj !== 6 && tj !== 4){ const c = sh(corTronco(tj, p, g, g.yCh + 2), -.15); for (const l of [-1, 1]){ P(cx + l * 2 - (l < 0 ? 1 : 0), g.yCh + 2, c); P(cx + l * 3 - (l < 0 ? 1 : 0), g.yCh + 3, c); P(cx + l * 5 - (l < 0 ? 1 : 0), g.yCh + 3, c); } }
    if (v.forma === "atletico" && !g.busto && tj !== 6){ const c = sh(corTronco(tj, p, g, g.yCh), -.12); R(cx - 6, g.yCh + 1, 4, 1, c); R(cx + 2, g.yCh + 1, 4, 1, c); }
    if (tj === 0 || tj === 4 || tj === 5){ P(cx - 1, yP + 2, p.jD); R(cx - w(yP + 2) + 2, yP + 2, 3, 1, p.jD); R(cx + w(yP + 2) - 5, yP + 2, 3, 1, p.jD); P(cx - 1, yP + 4, "#C6D0DA"); }
  }
}
function saiaEsp(g, p, v, vista){
  const tj = v.traje; if (tj !== 1 && tj !== 2 && tj !== 7) return;
  const cx = g.cx, side = vista === "right", y0 = g.yW + 1, y1 = tj === 7 ? g.by - 1 : tj === 1 ? g.yC + Math.round(g.L * .45) : g.yC + Math.round(g.L * .3);
  const c = p.cor, cD = p.corD, cL = p.corL;
  for (let y = y0; y <= y1; y++){
    const t = (y - y0) / (y1 - y0);
    if (side){
      const f = Math.round(interp([[0, 7 + g.barrigaF + (g.barr ? 3 * g.barr : 0)], [1, 11 + (tj === 7 ? 4 : 0) + g.barr]], t)), b = Math.round(interp([[0, 7 + g.bumbum], [1, 11 + g.bumbum + (tj === 7 ? 5 : 0)]], t));
      R(cx - b, y, b + f, 1, c); R(cx - b, y, 2, 1, cD); P(cx + f - 1, y, cL);
      if (t > .2 && (y % 5 === 0)) P(cx - 2, y, cD);
    } else {
      const hw0 = Math.max(hwEsp(g, y0), g.hi), wv = Math.round(interp([[0, hwEsp(g, y0)], [.25, hw0 + 1], [1, hw0 + (tj === 7 ? 9 : tj === 2 ? 5 : 4)]], t));
      R(cx - wv, y, 2 * wv, 1, c); R(cx + wv - 2, y, 2, 1, cD); P(cx - wv, y, cL);
      // pregas
      if (t > .12) for (let k = -2; k <= 2; k++){ if (tj !== 2 && (k === 0 || Math.abs(k) === 2)) continue; P(Math.round(cx + k * wv / 3), y, tj === 2 ? cD : sh(c, -.1)); }
      if (tj === 7 && hash(cx, y, 3) % 7 === 0) P(cx - wv + 2 + hash(y, 1, 1) % (2 * wv - 4), y, "#FCE9B8");
    }
  }
  const wv = side ? 0 : Math.round(Math.max(hwEsp(g, y0), g.hi) + (tj === 7 ? 9 : tj === 2 ? 5 : 4));
  if (!side){ R(cx - wv, y1, 2 * wv, 1, cD); if (tj === 1) for (let x = cx - wv + 1; x < cx + wv; x += 2) P(x, y1 - 1, "#FFF4E0"); }
}
function cabecaEsp(g, p, v, vista){
  const cx = g.cx, ht = g.ht;
  if (vista !== "right"){ elipse(cx - 11, ht + 15, 2, 3, p.skin); elipse(cx + 11, ht + 15, 2, 3, p.skin); P(cx - 11, ht + 15, p.skD); P(cx + 11, ht + 15, p.skD); }
  elipse(cx, ht + 13, 11, 13, p.skin);
  if (vista === "down"){ for (let y = ht + 20; y <= ht + 25; y++){ const k = 1 - Math.pow((y - (ht + 13)) / 13.5, 2); if (k > 0){ const h = Math.round(11 * Math.sqrt(k)); P(cx + h - 1, y, p.skD); } } R(cx - 3, ht + 26, 6, 1, p.skD); }
  if (vista === "up") R(cx - 4, ht + 25, 8, 1, p.skD);
}
// desenha o boneco grande num canvas de ESP_CW x ESP_CH, com contorno
function desenharRetrato(c, v, vista, pose, hum, anim){
  const x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
  const espelhar = vista === "left"; if (espelhar) vista = "right";
  const g = geoEsp(v), p = palEsp(v), st = v.estilo; g.barr = v.barriga || 0;
  const bob = anim.resp ? 1 : 0; g.ht += bob; g.hc += bob; // respiração: só a cabeça desce 1px
  withCtx(x, 1, () => {
    if (v.traje !== 6) cabeloAtras(g, p, st, vista); else if (vista !== "up") elipse(g.cx, g.ht + 12, 15, 15, p.cor); // pijama: capuz atrás
    pernasEsp(g, p, v, vista);
    troncoEsp(g, p, v, vista);
    saiaEsp(g, p, v, vista);
    if (vista === "right" && v.traje === 7) R(g.cx - 3, g.by - 3, 9, 3, "#F6C667"); // bico do sapato saindo do vestido longo
    bracosEsp(g, p, v, vista, pose, anim.aceno, "baixo");
    cabecaEsp(g, p, v, vista);
    if (vista !== "up") rostoEsp(g, p, v, vista, hum, anim.piscar);
    if (v.traje === 6) capuzEsp(g, p, vista);
    else { capaCabelo(g, p, st, vista); cabeloExtras(g, p, st, vista, vista === "down"); }
    acessEsp(g, p, v, vista);
    bracosEsp(g, p, v, vista, pose, anim.aceno, "alto");
  });
  contornar(c);
  if (espelhar){ const t = document.createElement("canvas"); t.width = c.width; t.height = c.height; const tx = t.getContext("2d"); tx.drawImage(c, 0, 0); x.clearRect(0, 0, c.width, c.height); x.save(); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(t, 0, 0); x.restore(); }
}
function capuzEsp(g, p, vista){ // pijama de bichinho: capuz com orelhas e carinha
  const cx = g.cx, ht = g.ht, c = p.cor, cD = p.corD, cL = p.corL, rosa = "#F9C9D6";
  for (const l of (vista === "right" ? [-1] : [-1, 1])){ const ox = vista === "right" ? cx - 3 : cx + l * 8; elipse(ox, ht - 2, 4, 5, c); elipse(ox, ht - 1, 2, 3, rosa); }
  if (vista === "up"){ elipse(cx, ht + 12, 14, 15, c); R(cx - 10, ht + 4, 20, 1, cD); return; }
  for (let y = ht - 3; y < ht + 27; y++) for (let xx = cx - 15; xx <= cx + 15; xx++){
    const d = Math.pow((xx - cx) / 15.5, 2) + Math.pow((y - (ht + 12)) / 15.5, 2); if (d > 1) continue;
    const dentro = vista === "right" ? Math.pow((xx - cx - 4) / 10.5, 2) + Math.pow((y - (ht + 15)) / 11.5, 2) < 1 && xx > cx - 2 : Math.pow((xx - cx) / 9.5, 2) + Math.pow((y - (ht + 15)) / 11, 2) < 1;
    if (!dentro) P(xx, y, d > .82 ? cD : c);
  }
  for (let xx = cx - 6; xx <= cx - 1; xx++) P(xx, ht, cL);
}
// contorno automático (mesma regra dos sprites do jogo)
function contornar(c){
  const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height), a = d.data, cw = c.width, ch = c.height, mark = [];
  const op = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && a[(j * cw + i) * 4 + 3] > 40;
  for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++){ if (op(i, j)) continue; if (op(i - 1, j) || op(i + 1, j) || op(i, j - 1) || op(i, j + 1)) mark.push((j * cw + i) * 4); }
  // contorno "seletivo": cada pixel da borda puxa a cor do vizinho (escurecida e puxada pro roxo do jogo),
  // como na pixel art feita à mão: cabelo castanho ganha borda castanho-escura, pele ganha borda de pele
  const viz = q => { const i = (q >> 2) % cw, j = (q >> 2) / cw | 0; for (const [di, dj] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) if (op(i + di, j + dj)) return ((j + dj) * cw + i + di) * 4; return -1; };
  const cores = mark.map(q => { const v = viz(q); return v < 0 ? OUTLINE : [0, 1, 2].map(k => Math.round(a[v + k] * .34 + OUTLINE[k] * .66)); });
  mark.forEach((q, n) => { const c = cores[n]; a[q] = c[0]; a[q + 1] = c[1]; a[q + 2] = c[2]; a[q + 3] = 255; });
  x.putImageData(d, 0, 0);
}
// retratos em cache (a animação só alterna entre poucos quadros)
const retratoCache = new Map();
function retrato(v, vista, pose, hum, anim){
  const key = JSON.stringify([v, vista, pose, hum, anim.piscar ? 1 : 0, anim.aceno, anim.resp ? 1 : 0]);
  let c = retratoCache.get(key); if (c) return c;
  c = document.createElement("canvas"); c.width = ESP_CW; c.height = ESP_CH; c.getContext("2d", { willReadFrequently: true }); // o contorno lê os pixels
  desenharRetrato(c, v, vista, pose, hum, anim);
  retratoCache.set(key, c); if (retratoCache.size > 80) retratoCache.delete(retratoCache.keys().next().value);
  return c;
}

// ---- cenário: provador com moldura de espelho ----
let cenaEspC = null;
function cenaEspelho(){
  if (cenaEspC) return cenaEspC;
  const c = document.createElement("canvas"); c.width = ESP_W; c.height = ESP_H; const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  withCtx(x, 1, () => {
    // parede listrada com florzinhas
    R(0, 0, ESP_W, ESP_H, "#F3DDEB");
    for (let i = 0; i < ESP_W; i += 8) R(i, 0, 3, 104, "#EACDE0");
    for (let j = 10; j < 96; j += 14) for (let i = 4 + ((j / 14) % 2) * 4; i < ESP_W; i += 16){ P(i, j, "#F9B8CC"); P(i - 1, j + 1, "#F9B8CC"); P(i + 1, j + 1, "#F9B8CC"); P(i, j + 2, "#F9B8CC"); P(i, j + 1, "#FFE08A"); }
    // rodapé branco e assoalho
    R(0, 92, ESP_W, 12, "#FFF8EC"); R(0, 92, ESP_W, 1, "#FFFFFF"); R(0, 103, ESP_W, 1, "#E9D8BE"); for (let i = 4; i < ESP_W; i += 14) R(i, 95, 10, 6, "#F6EEDF");
    R(0, 104, ESP_W, 32, "#C89A6A"); for (let j = 104; j < ESP_H; j += 5){ R(0, j, ESP_W, 1, "#B5814F"); for (let i = (j * 7) % 23; i < ESP_W; i += 23) P(i, j + 2, "#B5814F"); }
    // tapete redondo
    elipse(48, 126, 34, 6, "#E58FB5"); elipse(48, 126, 30, 4.5, "#F7A3B5"); elipse(48, 126, 22, 3, "#F9C9D6");
    // cortina do provador (esquerda) e plantinha (direita)
    R(5, 5, 12, 99, "#7A5AC0"); for (let i = 6; i < 17; i += 3) R(i, 5, 1, 99, "#5E44A0"); R(5, 5, 12, 3, "#F6C667"); R(12, 60, 6, 3, "#F6C667");
    rbox(76, 90, 12, 12, "#E8735F"); R(77, 92, 10, 1, "#F49A85");
    for (const [a, b, l] of [[82, 72, 1], [78, 78, 1], [86, 76, 1], [80, 84, 0], [85, 84, 0], [82, 80, 0]]) elipse(a, b, 3, 5, l ? "#4FA568" : "#35804F");
    // luz quente
    x.globalAlpha = .18; elipse(48, 40, 40, 34, "#FFFFFF"); x.globalAlpha = 1;
  });
  return (cenaEspC = c);
}
function molduraEsp(x){
  withCtx(x, 1, () => {
    const o = "#C8963E", oL = "#F6D27A", oD = "#8C5E3A";
    R(0, 0, ESP_W, 5, o); R(0, ESP_H - 5, ESP_W, 5, o); R(0, 0, 5, ESP_H, o); R(ESP_W - 5, 0, 5, ESP_H, o);
    R(1, 1, ESP_W - 2, 1, oL); R(1, 1, 1, ESP_H - 2, oL); R(1, ESP_H - 2, ESP_W - 2, 1, oD); R(ESP_W - 2, 1, 1, ESP_H - 2, oD);
    R(4, 4, ESP_W - 8, 1, oD); R(4, 4, 1, ESP_H - 8, oD); R(4, ESP_H - 5, ESP_W - 8, 1, oL); R(ESP_W - 5, 4, 1, ESP_H - 8, oL);
    for (const [a, b] of [[2, 2], [ESP_W - 7, 2], [2, ESP_H - 7], [ESP_W - 7, ESP_H - 7]]){ R(a, b, 5, 5, oL); R(a + 1, b + 1, 3, 3, "#E8607A"); P(a + 2, b + 2, "#F7A3B5"); }
    pixHeart(ESP_W / 2 - 2, 0, "#E8607A");
    for (let i = 12; i < ESP_W - 12; i += 10){ P(i, 2, oL); P(i, ESP_H - 3, oD); }
  });
}
// cena completa num canvas 96x136 (fundo, boneco, brilho do vidro, moldura)
function pintarEspelho(c, v, vista, pose, hum, t){
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  const anim = { piscar: t % 3400 < 150, aceno: pose === "acenar" ? (Math.floor(t / 260) % 2 ? 2 : -1) : 0, resp: pose !== "acenar" && Math.floor(t / 1100) % 2 === 1 };
  x.drawImage(cenaEspelho(), 0, 0);
  x.globalAlpha = .22; x.fillStyle = "#3A2433"; x.beginPath(); x.ellipse(48, 128, 18, 3, 0, 0, 6.29); x.fill(); x.globalAlpha = 1; // sombra no chão
  const pronto = typeof retratoPronto === "function" && retratoPronto(v, vista); // arte do PixelLab (js/30-retratos.js)
  if (pronto) x.drawImage(pronto, 0, 0, 64, 64, -16, 3 + (anim.resp ? 1 : 0), 128, 128);
  else x.drawImage(retrato(v, vista, pose, hum, anim), 8, 2);
  // brilho do vidro
  x.save(); x.globalAlpha = .28; x.fillStyle = "#FFFFFF";
  for (const [a, w] of [[18, 5], [28, 2]]){ x.beginPath(); x.moveTo(a, 5); x.lineTo(a + w, 5); x.lineTo(5, a + w + 10); x.lineTo(5, a + 10); x.closePath(); x.fill(); }
  x.restore();
  molduraEsp(x);
}

// ---------------------------------------------------------------------
// 2. POP-UP DO ESPELHO
// ---------------------------------------------------------------------
let espEstado = { vista: 0, pose: 0 }, espTimer = 0;
function dadosEspelho(quem){
  if (quem === "criador") return { v: Object.assign({}, visual(creator), { barriga: me ? barrigaDe(pid) || 0 : 0 }), nome: creator.nome || (me && me.dados && me.dados.nome) || "Você", hum: me ? humorDe(me.dados, true).n : HUMOR[1], eu: true };
  const eu = quem === pid, j = eu ? (me && me.dados) : jogadores[quem];
  if (!j) return null;
  const v = visual(typeof avDe === "function" ? avDe(quem, j) : j);
  return { v, nome: j.nome || "Alguém", hum: eu ? humorDe(j, true).n : humorDoOutro(quem, j).n, eu };
}
function openEspelho(quem){
  quem = quem || pid;
  const d0 = dadosEspelho(quem); if (!d0){ toast("Não deu pra achar essa pessoa agora."); return; }
  const titulo = quem === "criador" ? "Espelho 🪞" : d0.eu ? "Me ver no espelho 🪞" : "Ver " + d0.nome + " 🪞";
  openPanel("espelho", titulo, corpo => {
    corpo.classList.add("esp12b");
    const cv = el("canvas", "espCanvas12b"); cv.width = ESP_W; cv.height = ESP_H; cv.setAttribute("role", "img");
    const leg = el("p", "espLeg12b"); leg.setAttribute("aria-live", "polite");
    const gira = el("div", "espGira12b"), lbl = el("span", "espVista12b");
    const bE = btn("◀", "btn ghost", () => { espEstado.vista = (espEstado.vista + 3) % 4; upd(); }), bD = btn("▶", "btn ghost", () => { espEstado.vista = (espEstado.vista + 1) % 4; upd(); });
    bE.setAttribute("aria-label", "Girar para a esquerda"); bD.setAttribute("aria-label", "Girar para a direita");
    gira.append(bE, lbl, bD);
    const poses = el("div", "hbtns espPoses12b"); poses.setAttribute("role", "group"); poses.setAttribute("aria-label", "Pose");
    const pb = ESP_POSES.map(([, n], i) => { const b = btn(n, "btn ghost", () => { espEstado.pose = i; upd(); }); poses.append(b); return b; });
    const acoes = el("div", "hbtns");
    if (me && !visitando) acoes.append(btn("📸 Salvar no álbum", "btn", () => salvarEspelhoAlbum(quem)));
    if (d0.eu && quem !== "criador" && me) acoes.append(btn("👗 Trocar de roupa", "btn ghost", () => { closePanel(); openCreator(true); }));
    corpo.append(cv, leg, gira, poses);
    const ficha = el("ul", "ficha31"); ficha.setAttribute("aria-live", "polite"); // v31: o jeito da pessoa, o que está fazendo e a relação
    if (!d0.eu && quem !== "criador") corpo.append(ficha);
    corpo.append(acoes);
    if (!d0.eu) corpo.append(el("p", "muted", "Só olhando 👀 Quem escolhe o visual é " + d0.nome + "."));
    const desenha = () => {
      const d = dadosEspelho(quem); if (!d){ closePanel(); return; }
      const vis = ESP_VISTAS[espEstado.vista][0];
      pintarEspelho(cv, d.v, vis, ESP_POSES[espEstado.pose][0], d.hum.id, Date.now());
      const pronto = typeof temRetratoPronto === "function" && temRetratoPronto(d.v); // arte pronta não tem poses
      if (poses.hidden !== pronto) poses.hidden = pronto;
      const txt = d.nome + " · " + d.hum.em + " " + d.hum.nome;
      if (leg.textContent !== txt) leg.textContent = txt;
      if (ficha.isConnected){
        const linhas = fichaPessoa(quem), sig = linhas.map(l => l.join("|")).join("~");
        if (ficha.dataset.sig !== sig){
          ficha.dataset.sig = sig; ficha.textContent = "";
          for (const [rot, val] of linhas){ const li = el("li"); li.append(el("b", null, rot + ": "), document.createTextNode(val)); ficha.append(li); }
        }
      }
      cv.setAttribute("aria-label", d.nome + " no espelho, " + ESP_VISTAS[espEstado.vista][1].toLowerCase() + ", " + ESP_POSES[espEstado.pose][1].toLowerCase());
    };
    const upd = () => {
      lbl.textContent = ESP_VISTAS[espEstado.vista][1];
      pb.forEach((b, i) => b.setAttribute("aria-pressed", String(i === espEstado.pose)));
      desenha();
    };
    upd();
    clearInterval(espTimer); espTimer = setInterval(() => { if (!painel || painel.id !== "espelho"){ clearInterval(espTimer); return; } desenha(); }, 130);
    return upd;
  });
}
function salvarEspelhoAlbum(quem){
  const d = dadosEspelho(quem); if (!d) return;
  const k = 2, pad = 6, base = 16, sc = document.createElement("canvas"); sc.width = ESP_W; sc.height = ESP_H;
  pintarEspelho(sc, d.v, ESP_VISTAS[espEstado.vista][0], ESP_POSES[espEstado.pose][0], d.hum.id, 500);
  const c = document.createElement("canvas"); c.width = ESP_W * k + pad * 2; c.height = ESP_H * k + pad + base;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  withCtx(x, 1, () => { R(0, 0, c.width, c.height, "#FFF8EC"); R(0, c.height - 1, c.width, 1, "#E9D8BE"); R(c.width - 1, 0, 1, c.height, "#E9D8BE"); });
  x.drawImage(sc, 0, 0, ESP_W, ESP_H, pad, pad, ESP_W * k, ESP_H * k);
  withCtx(x, 2, () => {
    const dt = new Date(srvNow()), y = (ESP_H * k + pad + 4) / 2;
    txt3(pad2(dt.getDate()) + "/" + pad2(dt.getMonth() + 1) + "/" + dt.getFullYear(), pad / 2 + 1, y, "#8C7A9A");
    pixHeart(c.width / 2 - pad / 2 - 7, y, "#E8607A");
  });
  sfx("foto");
  const url = codificarFoto(c); if (!url){ toast("A foto ficou pesada demais 😅"); return; }
  openFotoNova(url, c.width, c.height);
  const inp = painel && painel.el.querySelector("input"); if (inp) inp.value = "🪞 " + d.nome + " no espelho";
}
// tocar no próprio boneco
function euAt12b(p, toque){
  if (!me) return false;
  const cx = (me.px + .5) * T, cy = (me.py + 1) * T - 2, dd = Math.hypot(p.x - cx, (p.y - (cy - 9)) * .8);
  if (dd > 7 + (toque ? 3 : 0) || (me.path && me.path.length)) return false;
  const items = [{ nome: "🪞 Me ver no espelho", fn: () => openEspelho(pid) }];
  if (!visitando) items.push({ nome: "👗 Trocar o visual", fn: () => openCreator(true) });
  if (typeof openVida === "function") items.push({ nome: "✨ Meu jeito", fn: () => openVida() });
  openMenu(p, nomeDe(pid) + " (você)", items);
  return true;
}
// "Ver <nome> de pertinho": v31 passou pro topo do menu da pessoa (js/07-jogo.js socialMenu e o menu de visita no 20-perto.js)
const itemVerPessoa = id => ({ nome: "👀 Ver " + nomeDe(id) + " de pertinho", fn: () => openEspelho(id) });
// ficha da outra pessoa no espelho: [rótulo, texto]
function fichaPessoa(id){
  const j = jogadores[id]; if (!j) return [];
  const l = [];
  const a = j.acao && j.acao.nome;
  l.push(["Agora", j.online === false ? "Fora de casa 💤" : a ? a : "De bobeira"]);
  const tr = typeof tracosDe === "function" ? tracosDe(j) : [];
  if (tr.length) l.push(["Jeito", tr.map(k => TRACOS[k].ic + " " + TRACOS[k].nome).join(" · ")]);
  if (typeof relDe === "function" && id !== pid && !visitando){
    const r = relDe(pid, id), rk = typeof romRank === "function" ? romRank(pid, id) : 0;
    const st = rk >= 2 && r && ROM_TXT[r.status] ? ROM_TXT[r.status][1] + " " + ROM_TXT[r.status][0] : (() => { const e = estAmizade(r); return e.ic + " " + e.nome; })();
    l.push(["Com você", st]);
  }
  if (j.entrou > 1e12){ const d = new Date(j.entrou); l.push(["Na casa desde", pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear()]); }
  return l;
}

// ---------------------------------------------------------------------
// 3. CRIADOR: prévia grande ao vivo e desenhinhos nos botões de corpo
// ---------------------------------------------------------------------
function espCriador(){
  const c = $("cEspelho"); if (!c || $("screenCreator").hidden) return;
  const hum = me ? humorDe(me.dados, true).n.id : "feliz";
  pintarEspelho(c, Object.assign({}, visual(creator), { barriga: me ? barrigaDe(pid) || 0 : 0 }), ESP_VISTAS[espEstado.vista][0], "pe", hum, Date.now());
}
{ const f0 = drawCreator; drawCreator = function(){ f0(); espCriador(); }; } // montarCriador redesenha na hora
setInterval(espCriador, 130); // e o espelho respira e pisca enquanto a tela está aberta
$("cEspBtn").onclick = () => openEspelho("criador");
$("cGiraE").onclick = () => { espEstado.vista = (espEstado.vista + 3) % 4; espCriador(); };
$("cGiraD").onclick = () => { espEstado.vista = (espEstado.vista + 1) % 4; espCriador(); };
// silhueta pequena (12x18) pra cada botão de formato, altura e físico
function iconeCorpo(v){
  const c = el("canvas", "ic12b"); c.width = 14; c.height = 20; c.setAttribute("aria-hidden", "true");
  const x = c.getContext("2d"), g = geoEsp(Object.assign({ corpo: "neutro" }, v)), fill = "#CECBF6";
  withCtx(x, 1, () => {
    const esc = 18 / (g.by - g.ht + 4), alt = Math.round((g.by - g.ht) * esc * (v.altura === "alto" ? 1.06 : v.altura === "baixinho" ? .86 : .96)), y0 = 19 - alt;
    const fy = t => Math.round(y0 + t * alt);
    elipse(7, fy(.12), 2.5, 2.5, fill);
    for (let y = fy(.24); y < fy(.62); y++){ const gy = g.yS + (y - fy(.24)) / (fy(.62) - fy(.24)) * (g.yC - g.yS), w = Math.max(1, Math.round(hwEsp(g, gy) / 2.6)); R(7 - w, y, 2 * w, 1, fill); }
    for (let y = fy(.62); y < 19; y++){ R(4, y, 2, 1, fill); R(8, y, 2, 1, fill); }
  });
  return c;
}
function iconesCorpo12b(){
  const pares = [["swForma", FORMAS, "forma"], ["swAltura", ALTURAS, "altura"], ["swFisico", FISICOS, "fisico"]];
  for (const [id, lista, campo] of pares){ const box = $(id); if (!box) continue; [...box.children].forEach((b, i) => { if (b.querySelector("canvas")) return; b.prepend(iconeCorpo({ [campo]: lista[i][0] })); }); }
}

// ---------------------------------------------------------------------
// 4. CÓPIAS DE SEGURANÇA E "VOLTAR NO TEMPO"
// ---------------------------------------------------------------------
// fora da cópia: pesados (fotos e áudios), efêmeros (jogo, filme, convite, visita, passeio, música) e memórias que só crescem
// (álbum, recados de voz, história): esses NUNCA são apagados nem trocados quando a casa volta no tempo.
const BK_FORA = ["albumImg", "vozAudio", "jogos", "cinema", "encontros", "namoro", "visita", "passeio", "reencontro", "musica", "album", "vozMeta", "historia", "backupDia", "voltaTempo"];
const BK_JOG = ["dinheiro", "tracos", "hab", "pontos", "guarda", "corpo", "traje", "roupa", "cabelo", "estilo", "pele", "barba", "acess", "forma", "altura", "fisico"];
const BK_GUARDA = { dia: 7, antes: 5, arquivo: 3 };
const dataHora = ts => { const d = new Date(ts); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
const diaBR = ts => { const d = new Date(ts - 3 * HORA); return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()); };
const tipoBk = k => /^\d{4}-\d{2}-\d{2}$/.test(k) ? "dia" : k.indexOf("antes_") === 0 ? "antes" : k.indexOf("arquivo_") === 0 ? "arquivo" : "";
function chavesRest(caminho){ // lista as chaves de um nó sem baixar o conteúdo (REST shallow)
  return fetch(DB_URL + "/salas/" + encodeURIComponent(sala) + "/" + caminho + ".json?shallow=true").then(r => r.ok ? r.json() : null).then(o => o && typeof o === "object" ? Object.keys(o) : []);
}
function resumoBk(casa, jog){
  const mv = casa.moveis && typeof casa.moveis === "object" ? Object.keys(casa.moveis).length : 0, xp = +((casa.nivel || {}).xp) || 0, gente = {};
  for (const [id, j] of Object.entries(jog || {})) if (j && j.nome) gente[id] = { nome: String(j.nome).slice(0, 16), dinheiro: Math.round(+j.dinheiro || 0) };
  return { moveis: mv, nivel: nivelDe(xp), gente };
}
// foto da casa agora (sem os nós de fora) + o essencial de cada morador
function fotografarCasa(){
  return chavesRest("casa").then(chaves => Promise.all(chaves.filter(k => !BK_FORA.includes(k)).map(k => ref("casa/" + k).once("value").then(s => [k, s.val()])))
    .then(pares => ref("jogadores").once("value").then(sj => {
      const casa = {}; for (const [k, v] of pares) if (v != null) casa[k] = v;
      const jog = {};
      for (const [id, j] of Object.entries(sj.val() || {})){ if (!j || !j.nome || j.visita) continue; const o = { nome: j.nome }; for (const f of BK_JOG) if (j[f] != null) o[f] = j[f]; jog[id] = o; }
      return { app: "casinha", v: 1, at: srvNow(), por: pid, casa, jogadores: jog, resumo: resumoBk(casa, jog) };
    })));
}
function limparBackups(){
  return chavesRest("backups").then(ks => {
    const up = {};
    for (const [tipo, n] of Object.entries(BK_GUARDA)){ const l = ks.filter(k => tipoBk(k) === tipo).sort(); l.slice(0, Math.max(0, l.length - n)).forEach(k => up[k] = null); }
    return Object.keys(up).length ? ref("backups").update(up) : null;
  }).catch(() => {});
}
let bkTentou = "";
function backupDoDia(forcar){
  if (!me || visitando || !salaRef) return Promise.resolve(false);
  const hoje = diaBR(srvNow()); if (!forcar && bkTentou === sala + hoje) return Promise.resolve(false); bkTentou = sala + hoje;
  return txn("casa/backupDia", cur => cur === hoje && !forcar ? undefined : hoje).then(ok => {
    if (!ok) return false;
    return fotografarCasa().then(snap => ref("backups/" + hoje).set(Object.assign(snap, { tipo: "dia", rotulo: "Cópia de " + hoje.split("-").reverse().slice(0, 2).join("/") })))
      .then(() => limparBackups()).then(() => true);
  }).catch(e => { console.warn("backup do dia", e); return false; });
}
const backupAgora = () => backupDoDia(true);
setInterval(() => { if (me && casaPronta !== undefined) backupDoDia(false); }, 60000);

// ---- pedido de voltar no tempo (todos os moradores online confirmam) ----
let voltaTempo = null, voltaVisto = "", voltaPausa = false, voltaQuieto = 0, voltaExec = "";
const moradoresOn = () => Object.entries(jogadores).filter(([, j]) => j && j.nome && !j.visita && j.online).map(([id]) => id);
const rotuloBk = (k, b) => (b && b.rotulo) || (tipoBk(k) === "dia" ? "Cópia de " + k : k);
{ const f0 = saveNeeds; saveNeeds = function(force){ if (voltaPausa) return; return f0(force); }; }
{ const f0 = celebrar; celebrar = function(c){ if (Date.now() < voltaQuieto) return; return f0(c); }; }
function pedirVolta(chave, rotulo){
  if (!me || visitando) return;
  const on = moradoresOn();
  if (on.filter(id => id !== pid).length === 0){ confirmarSozinho(chave, rotulo); return; }
  const id = "v" + Date.now().toString(36), quem = {}; on.forEach(p => quem[p] = true); quem[pid] = true;
  txn("casa/voltaTempo", cur => cur && cur.estado === "pedido" && srvNow() - (cur.at || 0) < 5 * 60000 ? undefined : { id, de: pid, nome: nomeEu9(), alvo: chave, rotulo, at: srvNow(), estado: "pedido", ok: { [pid]: true }, quem })
    .then(ok => { if (ok){ toast("Pedido enviado. Falta todo mundo que está na casa confirmar 🕰️"); refreshPanel("voltar"); } else toast("Já tem um pedido de voltar no tempo esperando resposta."); });
}
function confirmarSozinho(chave, rotulo){
  const outros = Object.entries(jogadores).filter(([id, j]) => id !== pid && j && j.nome && !j.visita).map(([, j]) => j.nome);
  openPanel("voltarOk", "Voltar no tempo 🕰️", corpo => {
    let passo = 1;
    const tx = el("p"), aviso = el("p", "muted"), bb = el("div", "hbtns");
    const vai = btn("Sim, voltar", "btn", () => {
      if (passo === 1){ passo = 2; mostra(); return; }
      vai.disabled = true; executarVolta(null, chave, rotulo);
    });
    bb.append(vai, btn("Cancelar", "btn ghost", () => openVoltar()));
    const mostra = () => {
      if (passo === 1){ tx.textContent = "A casa toda volta para \"" + rotulo + "\": móveis, pisos, paredes, bichinho, dinheiro e visual de cada um."; aviso.textContent = "Antes, eu guardo uma cópia de agora. Se não gostar, dá pra desfazer."; vai.textContent = "Sim, voltar"; }
      else { tx.textContent = "⚠️ Só você está na casa agora." + (outros.length ? " " + outros.join(" e ") + " não vai poder opinar." : ""); aviso.textContent = "Confirma de novo? Tudo o que mudou depois dessa cópia some (menos fotos, recados de voz e a nossa história)."; vai.textContent = "Confirmo, voltar no tempo"; }
    };
    mostra(); corpo.append(tx, aviso, bb);
  });
}
function responderVolta(sim){
  const v = voltaTempo; if (!v || v.estado !== "pedido") return;
  if (sim) ref("casa/voltaTempo/ok/" + pid).set(true).then(() => toast("Você confirmou. A casa volta quando todo mundo confirmar."));
  else txn("casa/voltaTempo", cur => cur && cur.id === v.id && cur.estado === "pedido" ? Object.assign(cur, { estado: "recusado", por: pid, fim: srvNow() }) : undefined);
}
function executarVolta(id, chave, rotulo){
  const novo = !id; id = id || "v" + Date.now().toString(36);
  if (voltaExec === id) return; voltaExec = id;
  const comeca = novo ? txn("casa/voltaTempo", cur => cur && (cur.estado === "restaurando" && srvNow() - (cur.ini || 0) < 60000) ? undefined : { id, de: pid, nome: nomeEu9(), alvo: chave, rotulo, at: srvNow(), ini: srvNow(), estado: "restaurando", ok: { [pid]: true }, quem: { [pid]: true } })
    : txn("casa/voltaTempo", cur => cur && cur.id === id && cur.estado === "pedido" ? Object.assign(cur, { estado: "restaurando", ini: srvNow() }) : undefined);
  closePanel();
  comeca.then(ok => {
    if (!ok){ toast("Não deu pra voltar agora. Tente de novo."); return; }
    voltaPausa = true; voltaQuieto = Date.now() + 15000;
    toast("Voltando no tempo... 🕰️");
    const antes = "antes_" + Date.now();
    return fotografarCasa()
      .then(snap => ref("backups/" + antes).set(Object.assign(snap, { tipo: "antes", rotulo: "Antes de voltar (" + dataHora(srvNow()) + ")" })))
      .then(() => Promise.all([ref("backups/" + chave).once("value"), chavesRest("casa")]))
      .then(([s, atuais]) => {
        const b = s.val(); if (!b || !b.casa) throw new Error("cópia vazia");
        const ps = [];
        for (const [k, val] of Object.entries(b.casa)) if (!BK_FORA.includes(k)) ps.push(ref("casa/" + k).set(val)); // um nó por vez, nunca transação no pai
        for (const k of atuais) if (!BK_FORA.includes(k) && !(k in b.casa)) ps.push(ref("casa/" + k).remove());
        for (const [p, j] of Object.entries(b.jogadores || {})){
          if (!jogadores[p] || !j) continue;
          const up = {}; for (const f of BK_JOG) up[f] = j[f] != null ? j[f] : null;
          ps.push(ref("jogadores/" + p).update(up));
        }
        return Promise.all(ps);
      })
      .then(() => txn("casa/voltaTempo", cur => cur && cur.id === id ? Object.assign(cur, { estado: "feito", fim: srvNow(), desfazer: antes }) : undefined))
      .then(() => limparBackups())
      .catch(e => { console.error(e); voltaPausa = false; toast("Deu errado ao voltar no tempo 😕 A cópia de antes ficou guardada."); txn("casa/voltaTempo", cur => cur && cur.id === id ? Object.assign(cur, { estado: "cancelado", fim: srvNow() }) : undefined); });
  });
}
function aoMudarVolta(v){
  const ant = voltaTempo; voltaTempo = v;
  if (!v){ voltaPausa = false; refreshPanel("voltar"); return; }
  if (v.estado === "restaurando" && me){ voltaPausa = true; voltaQuieto = Date.now() + 15000; }
  if (v.estado === "feito" && voltaVisto !== v.id + "f"){
    const primeira = !voltaVisto; voltaVisto = v.id + "f";
    if (me && !primeira || (me && srvNow() - (v.fim || 0) < 30000)){
      voltaQuieto = Date.now() + 8000;
      ref("jogadores/" + pid).once("value").then(s => {
        const j = s.val() || {}; if (me){ me.dinheiro = +j.dinheiro || 0; me.dados = j; lastNeedsSent = ""; }
        voltaPausa = false; renderHud();
        toast("A casa voltou no tempo 🕰️ (" + (v.rotulo || "cópia") + "). Dá pra desfazer em Nós → Voltar no tempo.");
      });
    } else voltaPausa = false;
  } else if (v.estado !== "restaurando") voltaPausa = false;
  if (v.estado === "recusado" && ant && ant.estado === "pedido" && v.de === pid) toast(nomeDe(v.por) + " preferiu não voltar no tempo.");
  // quem pediu executa quando todo mundo que estava online confirmou
  if (v.estado === "pedido" && v.de === pid && me){
    const on = moradoresOn(), falta = on.filter(p => !(v.ok || {})[p]);
    if (!falta.length) executarVolta(v.id, v.alvo, v.rotulo);
  }
  refreshPanel("voltar"); bannerKey = null;
}
setInterval(() => { // pedido parado há mais de 5 min expira; quem saiu da casa não trava o pedido
  const v = voltaTempo; if (!v || !me) return;
  if (v.estado === "pedido" && srvNow() - (v.at || 0) > 5 * 60000 && v.de === pid) txn("casa/voltaTempo", cur => cur && cur.id === v.id && cur.estado === "pedido" ? Object.assign(cur, { estado: "expirou", fim: srvNow() }) : undefined);
  else if (v.estado === "pedido" && v.de === pid) aoMudarVolta(v);
}, 5000);
{ const f0 = bannerLeva10; bannerLeva10 = function(){
  const v = voltaTempo;
  if (me && v && v.estado === "pedido" && v.de !== pid && !(v.ok || {})[pid] && srvNow() - (v.at || 0) < 5 * 60000)
    return { key: "t" + v.id, partes: () => { const bb = el("div", "bb"); bb.append(btn("Ver", "btn small", openVoltar), btn("Não", "btn ghost small", () => responderVolta(false))); return [el("span", null, (v.nome || nomeDe(v.de)) + " quer voltar a casa no tempo 🕰️ (" + (v.rotulo || "") + ")"), bb]; } };
  return f0();
}; }
{ const f0 = leva11Ouvir; leva11Ouvir = function(){ f0(); on(ref("casa/voltaTempo"), "value", s => aoMudarVolta(s.val())); }; }
{ const f0 = leva11Reset; leva11Reset = function(){ f0(); voltaTempo = null; voltaVisto = ""; voltaPausa = false; voltaExec = ""; bkTentou = ""; }; }

// ---- painel "Voltar no tempo" ----
function openVoltar(){
  if (!me || visitando){ toast("Só quem mora na casa pode voltar no tempo."); return; }
  openPanel("voltar", "Voltar no tempo 🕰️", corpo => {
    const pedido = el("div", "list"), topo = el("div", "hbtns"), lista = el("div", "list"), st = el("p", "muted");
    const arq = el("input"); arq.type = "file"; arq.accept = ".json,application/json"; arq.hidden = true;
    arq.onchange = () => { const f = arq.files && arq.files[0]; arq.value = ""; if (f) carregarCopia(f); };
    topo.append(btn("⬇️ Baixar cópia da casa", "btn ghost", baixarCopia), btn("⬆️ Carregar cópia", "btn ghost", () => arq.click()));
    corpo.append(el("p", "muted", "Uma cópia por dia, guardada sozinha (as 7 mais novas). Voltar troca móveis, pisos, paredes, bichinho, horta, dinheiro e visual. Fotos, recados de voz e a nossa história ficam como estão."), pedido, lista, st, topo, arq);
    st.textContent = "Carregando as cópias...";
    let sig = null;
    const carregar = () => chavesRest("backups").then(ks => Promise.all(ks.sort().reverse().map(k => Promise.all([ref("backups/" + k + "/resumo").once("value"), ref("backups/" + k + "/rotulo").once("value"), ref("backups/" + k + "/at").once("value")]).then(([r, ro, at]) => ({ k, resumo: r.val() || {}, rotulo: ro.val(), at: at.val() })))))
      .then(itens => {
        lista.textContent = "";
        st.textContent = itens.length ? "" : "Ainda não tem cópia. A primeira é feita sozinha hoje.";
        itens.sort((a, b) => (b.at || 0) - (a.at || 0));
        for (const it of itens){
          const row = el("div", "rowi"), tx = el("div", "tx"), r = it.resumo, ic = { dia: "📅", antes: "↩️", arquivo: "📄" }[tipoBk(it.k)] || "🗂️";
          const gente = Object.values(r.gente || {}).map(g => g.nome + " $" + g.dinheiro).join(" · ");
          tx.append(el("strong", null, ic + " " + rotuloBk(it.k, it) + (it.at ? " · " + quando(it.at) : "")), el("small", null, (r.moveis || 0) + " móveis · nível " + (r.nivel || 1) + (gente ? " · " + gente : "")));
          row.append(tx, btn(tipoBk(it.k) === "antes" ? "Desfazer" : "Voltar pra cá", "btn small", () => pedirVolta(it.k, rotuloBk(it.k, it))));
          lista.append(row);
        }
      }).catch(() => { st.textContent = "Não deu pra carregar as cópias agora."; });
    carregar();
    const upd = () => {
      const v = voltaTempo, s = JSON.stringify(v || 0); if (s === sig) return; sig = s;
      pedido.textContent = "";
      if (v && v.estado === "pedido" && srvNow() - (v.at || 0) < 5 * 60000){
        const row = el("div", "rowi"), tx = el("div", "tx"), falta = moradoresOn().filter(p => !(v.ok || {})[p]).map(nomeDe);
        tx.append(el("strong", null, "🕰️ " + (v.de === pid ? "Você pediu" : (v.nome || nomeDe(v.de)) + " pediu") + " pra voltar para \"" + (v.rotulo || "") + "\""), el("small", null, falta.length ? "Falta confirmar: " + falta.join(", ") : "Todo mundo confirmou. Voltando..."));
        row.append(tx);
        if (v.de !== pid && !(v.ok || {})[pid]){ const bb = el("div", "hbtns"); bb.append(btn("Confirmo", "btn small", () => responderVolta(true)), btn("Não quero", "btn ghost small", () => responderVolta(false))); tx.append(bb); }
        else if (v.de === pid) row.append(btn("Cancelar", "btn ghost small", () => txn("casa/voltaTempo", cur => cur && cur.id === v.id && cur.estado === "pedido" ? Object.assign(cur, { estado: "cancelado", fim: srvNow() }) : undefined)));
        pedido.append(row);
      } else if (v && v.estado === "feito" && srvNow() - (v.fim || 0) < 10 * 60000){ pedido.append(el("p", "muted", "✅ A casa voltou para \"" + (v.rotulo || "") + "\" " + quando(v.fim) + ". A cópia ↩️ \"Antes de voltar\" desfaz.")); carregar(); }
    };
    upd(); return upd;
  });
}
{ const f0 = nosBotoes9; nosBotoes9 = function(){
  const g = f0(); if (visitando) return g;
  const b = btn("", "btn ghost escolha", openVoltar); b.append(el("strong", null, "🕰️ Voltar no tempo"), el("small", null, "Cópias da casa")); b.setAttribute("aria-label", "Voltar no tempo: cópias da casa");
  g.append(b); return g;
}; }

// ---- baixar e carregar cópia (arquivo .json) ----
function baixarCopia(){
  toast("Preparando a cópia...");
  fotografarCasa().then(snap => {
    snap.tipo = "arquivo"; snap.rotulo = "Cópia baixada em " + dataHora(srvNow()); snap.sala = sala;
    const blob = new Blob([JSON.stringify(snap)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "casinha-" + diaBR(srvNow()) + ".json"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Cópia baixada ⬇️ (" + Math.ceil(blob.size / 1024) + " KB)");
  }).catch(() => toast("Não deu pra fazer a cópia agora."));
}
const chaveOk = k => typeof k === "string" && k.length > 0 && k.length <= 200 && !/[.#$\[\]\/\x00-\x1F\x7F]/.test(k);
function validarCopia(o){
  if (!o || typeof o !== "object" || Array.isArray(o)) return "Esse arquivo não é uma cópia da Casinha.";
  if (o.app !== "casinha" || o.v !== 1) return "Esse arquivo não é uma cópia da Casinha (ou é de uma versão que eu não conheço).";
  if (!o.casa || typeof o.casa !== "object" || Array.isArray(o.casa)) return "A cópia não tem a casa dentro.";
  if (!o.casa.moveis && !o.casa.pisos && !o.casa.obra) return "A cópia está sem móveis, pisos ou obra. Não parece uma casa.";
  if (o.jogadores != null && (typeof o.jogadores !== "object" || Array.isArray(o.jogadores))) return "A parte dos moradores está estranha.";
  let n = 0, ruim = null;
  const anda = (v, d) => { if (ruim) return; if (++n > 60000 || d > 12){ ruim = "A cópia é grande ou funda demais."; return; } if (v && typeof v === "object"){ for (const k of Object.keys(v)){ if (!Array.isArray(v) && !chaveOk(k)){ ruim = "Tem um nome proibido dentro da cópia (" + String(k).slice(0, 20) + ")."; return; } anda(v[k], d + 1); } } else if (typeof v === "string" && v.length > 20000) ruim = "Tem um texto grande demais dentro da cópia."; };
  anda(o.casa, 0); anda(o.jogadores || {}, 0);
  return ruim;
}
function carregarCopia(f){
  if (f.size > 3 * 1024 * 1024){ toast("Arquivo grande demais pra ser uma cópia da casa."); return; }
  const rd = new FileReader();
  rd.onload = () => {
    let o; try { o = JSON.parse(rd.result); } catch(e){ toast("Não consegui ler esse arquivo (não é JSON)."); return; }
    const erro = validarCopia(o); if (erro){ toast(erro); return; }
    const casa = {}; for (const [k, v] of Object.entries(o.casa)) if (!BK_FORA.includes(k) && chaveOk(k)) casa[k] = v;
    const jog = {}; for (const [id, j] of Object.entries(o.jogadores || {})){ if (!j || typeof j !== "object" || !chaveOk(id)) continue; const q = {}; if (j.nome) q.nome = String(j.nome).slice(0, 16); for (const fz of BK_JOG) if (j[fz] != null) q[fz] = j[fz]; jog[id] = q; }
    const chave = "arquivo_" + Date.now(), rotulo = "Cópia carregada" + (o.at ? " (de " + new Date(o.at).toLocaleDateString("pt-BR") + ")" : "");
    ref("backups/" + chave).set({ app: "casinha", v: 1, tipo: "arquivo", at: srvNow(), por: pid, rotulo, casa, jogadores: jog, resumo: resumoBk(casa, jog) })
      .then(() => { limparBackups(); toast("Cópia carregada ✔️ Agora é só confirmar."); pedirVolta(chave, rotulo); }, () => toast("Não deu pra guardar a cópia no banco."));
  };
  rd.onerror = () => toast("Não consegui ler esse arquivo.");
  rd.readAsText(f);
}

// ---------------------------------------------------------------------
// 5. TESTE: folha com as combinações principais (espelhoFolha())
// ---------------------------------------------------------------------
function espelhoFolha(o){
  o = o || {}; const cols = o.cols || 8, lista = [];
  const base = Object.assign({ corpo: "ela", roupa: 1, cabelo: 1, estilo: 1, pele: 1, traje: 0, acess: 0 }, o.base || {});
  for (const it of (o.itens || [])) lista.push(Object.assign({}, base, it));
  let c = $("folha12b"); if (!c){ c = el("canvas"); c.id = "folha12b"; c.style.cssText = "position:fixed;left:0;top:0;z-index:99999;image-rendering:pixelated;background:#221B33"; document.body.append(c); }
  const s = o.esc || 1, rows = Math.ceil(lista.length / cols); c.width = cols * ESP_W; c.height = rows * ESP_H; c.style.width = c.width * s + "px";
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false; const t = document.createElement("canvas"); t.width = ESP_W; t.height = ESP_H;
  lista.forEach((v, i) => { pintarEspelho(t, visual(v), v.vista || "down", v.pose || "pe", v.hum || "feliz", 1000); x.drawImage(t, (i % cols) * ESP_W, Math.floor(i / cols) * ESP_H); });
  return [c.width, c.height];
}
// só os bonecos, sem cenário, lado a lado (pra conferir de perto): espelhoRetratos([{forma: "pera"}, ...], 2)
function espelhoRetratos(lista, esc){
  let c = $("folhaR12b"); if (!c){ c = el("canvas"); c.id = "folhaR12b"; c.style.cssText = "position:fixed;left:0;top:0;z-index:99999;image-rendering:pixelated"; document.body.append(c); }
  const cw = 64, ch = 120; c.width = lista.length * cw; c.height = ch;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.fillStyle = "#E9DDF0"; x.fillRect(0, 0, c.width, c.height);
  lista.forEach((o, i) => { const v = Object.assign(visual(o), { barriga: o.barriga || 0 }); x.drawImage(retrato(v, o.vista || "down", o.pose || "pe", o.hum || "feliz", { piscar: 0, aceno: 0, resp: 0 }), (ESP_CW - cw) / 2, ESP_CH - ch, cw, ch, i * cw, 0, cw, ch); });
  c.style.width = c.width * (esc || 2) + "px"; return c.width;
}
