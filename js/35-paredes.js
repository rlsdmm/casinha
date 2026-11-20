"use strict";
// Casinha · v47: paredes altas
// A parede do fundo (linha 0 da casa) ganha o dobro da altura: uma faixa de TOPO px em cima da cena (TOPO no 01-base).
// Nenhum pedaço de chão some: a cena inteira desce TOPO px (draw, no 18-laco) e o toque desconta (worldFromEvent, no 07-jogo).
// Na parede alta: papel de parede com moldura, trilho e lambri, janelas grandes com cortina, e os quadros sobem DY35 px
// (ficam por cima dos móveis em vez de escondidos atrás). As paredes de dentro (banheiro, cozinha) continuam baixinhas,
// como numa casa de bonecas cortada.

// ---------------- papel de parede alto ----------------
// estilo dos papéis originais de cada cômodo (WP, no 04-cenario): padrão de cima e lambri de baixo (cheio = parede inteira)
const ESTILO35 = {
  listra: { p: "listras" },
  azulejo: { p: "azulejo", cheio: 1 },
  losango: { p: "losango", lam: "#FFF1DC", lin: "#EAD3B2" },
  xadrez: { p: "pontinhos", lam: "#FFF9EA", lin: "#E7DCC0", ladrilho: 1 }, // cozinha: azulejinho creme embaixo
  floral: { p: "floral", lam: "#FFF6F9", lin: "#EAD3DE" },
  pastilha: { p: "pastilha", cheio: 1 },
  estrelas: { p: "estrelasNoite", lam: "#2C3560", lin: "#36416E", neon: 1 },
  fachada: { p: "fachada", cheio: 1 }
};
const escuro35 = a => hexRGB(a).reduce((s, v) => s + v, 0) < 420;
// padrão do papel numa faixa de h linhas a partir de ya (presa no x absoluto, emenda entre os quadrados)
function padrao35(p, px, ya, h, a, b){
  const l = sh(a, .32), d = sh(a, -.26), esc = escuro35(a), yb = ya + h;
  const fileiras = (passo, fn) => { for (let j = 0, r = 0; j < h; j += passo, r++) fn(ya + j, r); };
  R(px, ya, T, h, a);
  switch (p){
    case "listras":
      for (let i = 0; i < T; i += 4) R(px + i, ya, 2, h, b);
      fileiras(6, (y, r) => { for (let i = 2; i < T; i += 8) if (y + 2 < yb) P(px + i + (r % 2) * 4, y + 2, l); });
      break;
    case "pontinhos": fileiras(3, (y, r) => { for (let i = (r % 2) * 2 + 1; i < T; i += 4) if (y + 1 < yb) P(px + i, y + 1, b); }); break;
    case "bolinhas": fileiras(4, (y, r) => { if (y + 2 >= yb) return; for (let i = (r % 2) * 4 + 1; i < T; i += 8){ R(px + i, y + 1, 2, 2, esc ? l : d); P(px + i, y + 1, esc ? sh(a, .55) : b); } }); break;
    case "xadrez": fileiras(4, (y, r) => { for (let i = 0; i < 4; i++) if ((i + r) % 2) R(px + i * 4, y, 4, Math.min(4, yb - y), b); }); break;
    case "flor": case "floral":
      fileiras(7, (y, r) => {
        if (y + 3 >= yb) return;
        const x = px + (r % 2 ? 10 : 2), k = r % 2;
        const pe = p === "floral" ? (k ? "#E58FB5" : "#B99BE6") : k ? (esc ? "#F9C9D6" : "#FFFFFF") : (esc ? "#FCE9B8" : d);
        P(x + 1, y + 1, pe); P(x, y + 2, pe); P(x + 2, y + 2, pe); P(x + 1, y + 3, pe); P(x + 1, y + 2, "#F6C667"); if (y + 4 < yb) P(x + 3, y + 3, "#6DB37A");
      });
      break;
    case "tijolo": {
      const ar = esc ? sh(a, .22) : sh(a, .42);
      fileiras(4, (y, r) => {
        if (y + 3 < yb) R(px, y + 3, T, 1, ar);
        for (const jx of r % 2 ? [3, 11] : [7, 15]){ R(px + jx, y, 1, Math.min(3, yb - y), ar); if (y < yb) P(px + jx - 5, y, l); }
        if (hash(px, r, 41) % 3 === 0 && y + 1 < yb) R(px + (r % 2 ? 5 : 1), y + 1, 3, 1, b);
      });
      break;
    }
    case "madeira":
      for (let i = 0; i < T; i += 4){
        const v = (hash(px + i, 0, 9) % 5 - 2) * .035; R(px + i, ya, 3, h, sh(a, v)); R(px + i + 3, ya, 1, h, d); P(px + i, ya, l);
        for (let k = 0; k < 2; k++) P(px + i + 1, ya + 1 + hash(px + i, k + 1, 9) % (h - 2), b);
      }
      break;
    case "coracoes":
      fileiras(7, (y, r) => {
        if (y + 3 >= yb) return;
        const x = px + (r % 2 ? 10 : 2), c = r % 2 ? "#E8607A" : (esc ? "#F9C9D6" : "#F49AAE");
        P(x, y + 1, c); P(x + 2, y + 1, c); R(x, y + 2, 3, 1, c); P(x + 1, y + 3, c);
      });
      break;
    case "estrelas":
      fileiras(7, (y, r) => {
        if (y + 4 >= yb) return;
        const x = px + (r % 2 ? 11 : 3), yy = y + 2;
        P(x, yy - 1, "#F6C667"); R(x - 1, yy, 3, 1, "#F6C667"); P(x, yy + 1, "#F6C667"); P(x, yy, "#FCE9B8");
        P(px + (r % 2 ? 5 : 13), y + 5 < yb ? y + 5 : yy, "#FCE9B8");
      });
      break;
    case "losango":
      fileiras(8, (y, r) => {
        if (y + 3 >= yb) return;
        for (const i of r % 2 ? [7, 15] : [3, 11]){ P(px + i, y + 1, b); R(px + i - 1, y + 2, 3, 1, b); P(px + i, y + 3, b); P(px + i, y + 2, sh(a, .35)); }
      });
      break;
    case "azulejo":
      fileiras(4, y => { if (y + 3 < yb) R(px, y + 3, T, 1, b); for (let i = 0; i < T; i += 4) P(px + i, y, sh(a, .45)); });
      for (let i = 3; i < T; i += 4) R(px + i, ya, 1, h, b);
      { const fy = ya + 11; R(px, fy, T, 1, "#8CC3D2"); for (let i = 1; i < T; i += 4) P(px + i, fy, "#EAF7FA"); } // faixa no meio
      break;
    case "pastilha":
      for (let j = 0; j < h; j += 2) for (let i = (j >> 1) % 2; i < T; i += 2) P(px + i, ya + j, b);
      { const fy = ya + 12; R(px, fy, T, 1, "#6FBFA4"); for (let i = 1; i < T; i += 3) P(px + i, fy, "#E9F8F2"); }
      break;
    case "fachada": fileiras(3, y => { R(px, y, T, 1, sh(a, .14)); if (y + 2 < yb) R(px, y + 2, T, 1, b); }); break;
    case "estrelasNoite":
      for (let i = 0; i < T; i += 8) R(px + i, ya, 4, h, b);
      for (let k = 0; k < 3; k++){ const q = hash(px, k, 3); P(px + 2 + q % 11, ya + 1 + (q >> 4) % (h - 2), "#FCE9B8"); }
      { const q = hash(px, 9, 3); if (q % 2 === 0){ const sx = px + 3 + (q >> 7) % 9, sy = ya + 3 + (q >> 3) % (h - 6); P(sx, sy - 1, "#FFF6D6"); R(sx - 1, sy, 3, 1, "#FFF6D6"); P(sx, sy + 1, "#FFF6D6"); } }
      break;
    default: // liso: só uma textura bem leve
      for (let k = 0; k < 3; k++){ const q = hash(px, k, 17); P(px + q % T, ya + (q >> 5) % h, sh(a, -.05)); }
  }
}
// lambri: painéis de madeira pintada com friso a cada 8 px (ou azulejinho, na cozinha)
function lambri35(px, ya, h, cor, lin, ladrilho){
  R(px, ya, T, h, cor);
  if (ladrilho){
    for (let j = 2; j < h; j += 3) R(px, ya + j, T, 1, lin);
    for (let i = 3; i < T; i += 4) R(px + i, ya, 1, h, lin);
    for (let i = 0; i < T; i += 4) P(px + i, ya, sh(cor, .4));
    return;
  }
  R(px, ya, T, 1, sh(cor, .22));
  for (const i of [3, 11]){ R(px + i, ya + 1, 1, h - 1, lin); P(px + i + 1, ya + 1, sh(cor, .25)); }
}
// a frente da parede alta inteira: de -TOPO até o fim do quadrado da linha 0 (32 px)
function faceAlta35(px, room){
  const pc = papelDe(room), wp = WP[room] || WP.sala;
  const a = pc ? pc.a : wp[0], b = pc ? sh(pc.a, -.12) : wp[1];
  const est = pc ? { p: pc.p } : (ESTILO35[wp[2]] || { p: "pontinhos", lam: "#FFF9EA", lin: "#E7DCC0", ladrilho: 1 });
  const y0 = -TOPO, topo = y0 + 4, base = T - 3, trilho = base - 6;
  R(px, y0, T, 3, CAP); R(px, y0, T, 1, CAP_L); R(px, y0 + 3, T, 1, LINE); // espessura da parede, vista de cima
  if (est.cheio) padrao35(est.p, px, topo, base - topo, a, b);
  else {
    padrao35(est.p, px, topo, trilho - topo, a, b);
    if (est.neon){ R(px, trilho, T, 1, "#E8607A"); R(px, trilho + 1, T, 1, "#7FD0F5"); }
    else { R(px, trilho, T, 1, "#E2B888"); R(px, trilho + 1, T, 1, "#A5754B"); }
    const lam = est.lam || (escuro35(a) ? sh(a, .1) : "#FFF8EE"), lin = est.lin || (escuro35(a) ? sh(a, -.12) : "#E8D8C4");
    lambri35(px, trilho + 2, base - trilho - 2, lam, lin, est.ladrilho);
    R(px, trilho + 2, T, 1, "rgba(35,18,40,.1)"); // sombrinha do trilho
  }
  R(px, topo, T, 1, sh(a, -.2)); R(px, topo + 1, T, 1, "rgba(35,18,40,.07)"); R(px, topo + 2, T, 1, "rgba(35,18,40,.035)"); // sombra embaixo do teto
  R(px, base, T, 1, "#D2A06C"); R(px, base + 1, T, 1, "#A5754B"); R(px, base + 2, T, 1, "#6B4429"); // rodapé
}

// ---------------- janelas grandes com cortina ----------------
const JAN35 = { gy: -9, gh: 15, gw: 9 }; // vidro: linhas -9..5, colunas px+4..px+12 (a cruz do caixilho em px+8 e gy+6)
const CORTINA35 = { quarto: ["#C9B6F2", "#E6DCFA", "#9E88D6"], suite: ["#F2B8CC", "#FBDDE7", "#D58AA6"], jogos: ["#7FB8E8", "#C4E0F6", "#5A8CC0"] };
function cortina35(px, room){
  const [m, l, d] = CORTINA35[room] || [C.rose, "#F9C9D6", "#D97A96"], gy = JAN35.gy, gh = JAN35.gh;
  R(px, gy - 3, 16, 1, "#8C5E3A"); P(px, gy - 3, C.gold); P(px + 15, gy - 3, C.gold); // varão
  R(px + 1, gy - 2, 14, 2, m); R(px + 1, gy - 2, 14, 1, l); // bandô
  for (let i = 1; i < 15; i++) if (i % 3 !== 0) P(px + i, gy, m); else P(px + i, gy, d);
  for (const [x0, dir] of [[px + 1, 1], [px + 14, -1]]){ // laterais, presas por uma faixinha
    for (let j = 1; j < gh + 3; j++){
      const y = gy + j, preso = j === 9, larg = preso ? 2 : j > 9 ? 3 + (j > 12 ? 1 : 0) : 3;
      for (let k = 0; k < larg; k++){ const x = x0 + dir * k, c = k === 0 ? l : k === larg - 1 ? d : m; P(x, y, c); }
      if (preso) P(x0 + dir, y, C.gold);
    }
  }
}
function janelaAlta35(px, hr, x, est, chuva, alto){
  const kind = skyKind(hr), [s0, s1] = chuva && SKY_CHUVA[kind] ? SKY_CHUVA[kind] : SKY[kind], gp = GRAMAS[est] || GRAMAS.primavera;
  const { gy, gh, gw } = JAN35, gx = px + 4;
  R(px + 2, gy - 1, 13, gh + 3, "rgba(35,18,40,.12)"); // sombrinha do batente na parede
  R(px + 3, gy - 1, 11, gh + 2, C.cream);
  for (let j = 0; j < gh; j++) R(gx, gy + j, gw, 1, mix(s0, s1, j / (gh - 1)));
  const noite = kind === "noite";
  if (alto){ // 2º andar: copas das árvores lá fora
    const c0 = noite ? "#1C2440" : chuva ? sh(gp.arb[0], -.18) : gp.arb[0], c1 = noite ? "#26304F" : chuva ? gp.arb[0] : gp.arb[1];
    R(gx, gy + gh - 2, gw, 2, c0); R(gx, gy + gh - 3, 4, 1, c0); R(gx + 5, gy + gh - 3, 4, 1, c0); R(gx + 1, gy + gh - 4, 2, 1, c0); R(gx + 6, gy + gh - 4, 2, 1, c0);
    P(gx + 1, gy + gh - 4, c1); P(gx + 6, gy + gh - 4, c1); P(gx, gy + gh - 3, c1);
    if (!noite && (est === "primavera" || est === "outono")) P(gx + 7, gy + gh - 3, gp.bot[0]);
  } else if (noite){
    R(gx, gy + gh - 2, gw, 2, "#1E2A3A"); R(gx + 1, gy + gh - 3, 3, 1, "#1E2A3A"); R(gx + 6, gy + gh - 3, 2, 1, "#1E2A3A");
  } else {
    R(gx, gy + gh - 2, gw, 2, gp.g); R(gx, gy + gh - 2, gw, 1, gp.gL); P(gx + 2, gy + gh - 3, gp.gL); P(gx + 3, gy + gh - 3, gp.gL); P(gx + 7, gy + gh - 3, gp.g);
    if (est === "outono"){ P(gx + 1, gy + gh - 3, "#E08A3C"); P(gx + 6, gy + gh - 2, "#C9612F"); }
    if (est === "primavera"){ P(gx + 5, gy + gh - 2, "#F9B8CC"); P(gx + 1, gy + gh - 1, "#FFFFFF"); }
    if (gp.geada) R(gx, gy + gh - 2, gw, 1, "#EEF4F2");
  }
  if (noite){ if (!chuva){ R(gx + 5, gy + 2, 2, 2, "#FFF6D6"); P(gx + 6, gy + 2, mix(s0, s1, .15)); P(gx + 4, gy + 3, "#FFF6D6"); } } // lua
  else if (kind === "dia"){ if (!chuva && (est === "verao" || x % 2 === 0)){ R(gx + 5, gy + 1, 2, 2, "#FFE45C"); P(gx + 4, gy + 1, "#FFF3A8"); P(gx + 7, gy + 2, "#FFF3A8"); } }
  else if (!chuva){ R(gx + 5, gy + gh - 5, 3, 2, "#FFE9A8"); P(gx + 4, gy + gh - 4, "#FFF3C8"); } // sol baixinho de manhã e de tarde
  R(px + 8, gy, 1, gh, C.cream); R(gx, gy + 6, gw, 1, C.cream); // caixilho em cruz
  R(px + 3, gy - 1, 11, 1, "#FFFFFF"); R(px + 13, gy, 1, gh + 1, C.creamD); R(px + 3, gy + gh, 11, 1, C.creamD);
  if (!noite){ ctx.globalAlpha = .45; P(gx + 1, gy + 3, "#FFFFFF"); P(gx + 2, gy + 2, "#FFFFFF"); P(gx + 1, gy + 4, "#FFFFFF"); P(px + 10, gy + 9, "#FFFFFF"); ctx.globalAlpha = 1; } // reflexo no vidro
  R(px + 1, gy + gh + 1, 14, 1, "#E2B888"); R(px + 1, gy + gh + 2, 14, 1, "#A5754B"); R(px + 2, gy + gh + 3, 12, 1, "rgba(35,18,40,.18)"); // peitoril
  cortina35(px, comodo(x, 1));
}
// por cima, a cada quadro: nuvem passando, brilho das estrelas, e com chuva a nuvem escura e as gotas escorrendo no vidro
function janelaAltaAnim35(px, x, tm, hr){
  const kind = skyKind(hr), chuva = climaAgora(), { gy, gh, gw } = JAN35, gx = px + 4;
  const ok = (ax, ay) => ax >= gx && ax < gx + gw && ax !== px + 8 && ay >= gy && ay < gy + gh - 2 && ay !== gy + 6;
  const pp = (ax, ay, c) => { if (ok(ax, ay)) P(ax, ay, c); };
  if (chuva){
    const cxp = Math.floor((tm / 2600 + x * 5) % 20) - 6, nc = kind === "noite" ? "#3A3F66" : "#9AA4B6", nc2 = kind === "noite" ? "#323760" : "#A9B2C2";
    for (let i = 0; i < 7; i++){ pp(gx + cxp + i, gy + 2, nc); if (i > 0 && i < 6) pp(gx + cxp + i, gy + 1, nc2); }
    for (let k = 0; k < (chuva === "garoa" ? 2 : 4); k++){
      const q = hash(x, k, 51), dx = gx + q % gw, per = 1600 + q % 1500, f = ((tm + q) % per) / per, ay = gy + Math.floor(f * (gh - 1));
      ctx.globalAlpha = .75; pp(dx, ay, "#E8F2FF"); ctx.globalAlpha = .35; pp(dx, ay - 1, "#E8F2FF"); ctx.globalAlpha = 1;
    }
    return;
  }
  if (kind === "noite"){
    for (let i = 0; i < 4; i++){ const q = hash(x, i, 7); ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(tm / 700 + q % 10)); pp(gx + q % gw, gy + 1 + (q >> 4) % 7, "#FFFFFF"); }
    ctx.globalAlpha = 1; return;
  }
  const cxp = Math.floor((tm / 1400 + x * 5) % 18) - 4;
  for (let i = 0; i < 5; i++){ pp(gx + cxp + i, gy + 4, "#FFFFFF"); if (i > 0 && i < 4) pp(gx + cxp + i, gy + 3, "#FFFFFF"); }
  const gl = Math.floor(tm / 90 + x * 9) % 80;
  if (gl < 8){ ctx.globalAlpha = .7; for (let i = 0; i < 2; i++) pp(gx + gl + i, gy + gh - 4 - gl, "#FFFFFF"); ctx.globalAlpha = 1; }
}

// ---------------- linha 0: parede alta no lugar da baixinha ----------------
function faixaFora35(px){ // o lado de fora, na faixa de cima (jardim ou, no 2º andar, o chão lá embaixo)
  const gp = GRAMAS[estacao()] || GRAMAS.primavera, cima = andarAtual === 1, g = cima ? sh(gp.gD, -.32) : gp.g;
  R(px, -TOPO, T, TOPO, g);
  for (let i = 0; i < 7; i++){ const q = hash(px >> 4, -1, i), ax = px + q % 15, ay = -TOPO + (q >> 5) % 15; P(ax, ay, cima ? sh(g, i % 2 ? .14 : -.14) : i % 2 ? gp.gD : gp.gL); }
}
{ const d0 = drawWallTile; drawWallTile = function(x, y){
  if (y !== 0) return d0(x, y);
  const px = x * T;
  const copiaPraCima = () => { ctx.save(); ctx.translate(0, -T); clipRect(px, 0, T, T, () => d0(x, 0)); ctx.restore(); };
  if (x === 0 || x === W - 1){ faixaFora35(px); d0(x, 0); copiaPraCima(); return; }
  if (isFace(x, 0)){ faceAlta35(px, comodo(x, 1)); return; }
  if (x === VX){ // parede fina entre dois cômodos: as duas paredes altas nas laterais e o miolo subindo até o teto
    clipRect(px, -TOPO, 4, TOPO + T, () => faceAlta35(px, comodo(x - 1, 1)));
    clipRect(px + 12, -TOPO, 4, TOPO + T, () => faceAlta35(px, comodo(x + 1, 1)));
    const h = TOPO + T;
    R(px + 4, -TOPO, 8, h, CAP); R(px + 4, -TOPO, 8, 1, CAP_L); R(px + 5, -TOPO + 3, 1, h - 3, CAP_L); R(px + 10, -TOPO + 3, 1, h - 3, CAP_D);
    R(px + 4, -TOPO + 3, 1, h - 3, LINE); R(px + 11, -TOPO + 3, 1, h - 3, LINE);
    R(px + 12, -TOPO + 4, 2, h - 4, "rgba(35,18,40,.14)"); // sombrinha do miolo na parede da direita
    return;
  }
  d0(x, 0); copiaPraCima();
}; }
// fundo: a faixa de cima entra no mesmo cache (bg tem TOPO px a mais; desenha com a origem descida)
{ const e0 = ensureBg; ensureBg = function(hr){
  const b = bg.getContext("2d"), k0 = bgKey;
  b.setTransform(1, 0, 0, 1, 0, TOPO);
  try { e0(hr); } finally { b.setTransform(1, 0, 0, 1, 0, 0); }
  if (bgKey !== k0 && typeof zeroAqui === "function" && zeroAqui()) withCtx(b, 1, () => { ctx.save(); ctx.translate(0, TOPO); for (let x = 0; x < W; x++) faixaFora35(x * T); ctx.restore(); }); // casa do zero: em cima é jardim
}; }
// enfeites presos na parede de cima sobem junto
{ const f0 = drawBandeirinhas; drawBandeirinhas = function(){ ctx.save(); ctx.translate(0, -13); try { f0(); } finally { ctx.restore(); } }; }
{ const f0 = drawPiscaPisca; drawPiscaPisca = function(tm){ ctx.save(); ctx.translate(0, -13); try { f0(tm); } finally { ctx.restore(); } }; }
