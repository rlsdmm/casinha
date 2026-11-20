"use strict";
// Casinha · v46: luz e sombra, e chão com veio
// Tudo por cima do que já existe:
//  - fundo (ensureBg): as tábuas e os ladrilhos não ficam todos iguais, e o chão escurece de leve perto das paredes;
//  - cena (draw, no 18-laco): sombra macia dos móveis (sombrasMoveis34) e raios de sol pelas janelas (raiosSol34).

// ---------------- fundo: veio do chão e cantinhos ----------------
const SOMBRA34 = "35,18,40";
function veioChao34(){
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    if (MAP[y][x] !== 0 || y >= HC) continue;
    const cm = comodo(x, y); if (cm === "quintal" || cm === "varanda") continue;
    const p = pisoDe(cm), px = x * T, py = y * T;
    if (p.tipo === "tabua" && !/Taco|Parquet/.test(p.nome)){ // tábuas corridas: cada tábua um tiquinho mais clara ou mais escura
      for (let b = 0; b < 4; b++){
        const h = hash(x, y * 4 + b, 91) % 9;
        if (h < 2) R(px, py + b * 4, T, 4, "rgba(255,236,210,.07)");
        else if (h > 6) R(px, py + b * 4, T, 4, "rgba(70,35,20,.07)");
      }
      const k = hash(x, y, 93); if (k % 11 === 0) P(px + 2 + k % 12, py + 1 + ((k >> 5) % 4) * 4, "rgba(70,35,20,.25)"); // nó da madeira
    } else if (p.tipo === "xadrez" || /Taco|Parquet/.test(p.nome)){ // ladrilho e taco: de quadrinho em quadrinho
      for (let q = 0; q < 4; q++){
        const h = hash(x * 2 + (q & 1), y * 2 + (q >> 1), 92) % 7, qx = px + (q & 1) * 8, qy = py + (q >> 1) * 8;
        if (h === 0) R(qx, qy, 8, 8, "rgba(255,255,255,.07)");
        else if (h === 6) R(qx, qy, 8, 8, "rgba(" + SOMBRA34 + ",.05)");
      }
      if (p.tipo === "xadrez"){ const k = hash(x, y, 94); if (k % 5 === 0){ const sx = px + 2 + k % 10, sy = py + 2 + (k >> 6) % 10; P(sx, sy, "rgba(255,255,255,.45)"); P(sx + 1, sy, "rgba(255,255,255,.2)"); } } // brilhinho do piso
    }
  }
}
// o chão escurece devagar perto das paredes (o 04-cenario já faz as 2 primeiras linhas embaixo da parede de cima)
function cantinhos34(){
  const s = a => "rgba(" + SOMBRA34 + "," + a + ")";
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
    if (MAP[y][x] !== 0 || y >= HC || x === VX) continue;
    const px = x * T, py = y * T;
    if (y > 0 && MAP[y - 1][x] === 1){ const a = [.07, .05, .035, .02]; for (let i = 0; i < 4; i++) R(px, py + 4 + i, T, 1, s(a[i])); }
    if (x > 0 && MAP[y][x - 1] === 1 && x - 1 !== VX){
      if (x === 1){ R(px + 3, py, 1, T, s(.06)); R(px + 4, py, 1, T, s(.03)); }
      else { R(px, py, 2, T, s(.16)); R(px + 2, py, 1, T, s(.08)); R(px + 3, py, 1, T, s(.04)); }
    }
    if (x < W - 1 && MAP[y][x + 1] === 1 && x + 1 !== VX){ R(px + T - 2, py, 2, T, s(.08)); R(px + T - 3, py, 1, T, s(.04)); }
  }
}
{ const e0 = ensureBg; ensureBg = function(hr){
  const k0 = bgKey; e0(hr);
  if (bgKey !== k0) withCtx(bg.getContext("2d"), 1, () => { veioChao34(); cantinhos34(); });
}; }

// ---------------- sombra macia dos móveis ----------------
// A silhueta de todos os móveis (com o contorno) vira uma sombra que escorrega pra baixo e pra direita, em 3 degraus,
// desenhada embaixo de tudo. Guardada numa tela e refeita só quando algum móvel muda.
const somb34 = document.createElement("canvas"), silh34 = document.createElement("canvas");
let somb34Sig = "";
function sombrasMoveis34(){
  const w = W * T, h = H * T, mov = tool && tool.kind === "mover" ? tool.id : "";
  let sig = andarAtual + "|" + w + "x" + h + "|" + mov + "|" + (COZY.ok ? 1 : 0) + "|" + (typeof COZY_OFF !== "undefined" && COZY_OFF ? 1 : 0);
  for (const id in moveis){ const m = moveis[id]; sig += ";" + id + m.t + m.x + "," + m.y + "c" + (m.cor | 0); }
  if (sig !== somb34Sig){
    somb34Sig = sig;
    for (const c of [somb34, silh34]){ if (c.width !== w || c.height !== h){ c.width = w; c.height = h; } }
    const t = silh34.getContext("2d"); t.imageSmoothingEnabled = false; t.clearRect(0, 0, w, h);
    withCtx(t, 1, () => {
      for (const id in moveis){
        const m = moveis[id], c = CAT[m.t]; if (!c || c.chao || id === mov) continue;
        try { blitFurn(m.t, m.x * T, m.y * T, 0, m.cor); } catch (e){}
      }
    });
    t.globalCompositeOperation = "source-in"; t.fillStyle = "rgb(" + SOMBRA34 + ")"; t.fillRect(0, 0, w, h); t.globalCompositeOperation = "source-over";
    const s = somb34.getContext("2d"); s.imageSmoothingEnabled = false; s.clearRect(0, 0, w, h);
    for (const [d, a] of [[3, .07], [2, .09], [1, .12]]){ s.globalAlpha = a; s.drawImage(silh34, d, d); }
    s.globalAlpha = 1;
  }
  ctx.drawImage(somb34, 0, 0);
}

// ---------------- raios de sol pelas janelas ----------------
// De dia, um feixe de luz quentinho desce de cada janela até o chão, com uns grãozinhos de poeira flutuando.
// À tarde fica alaranjado; de manhã, rosado. Com chuva ou de noite, nada (a luz da noite é o mapa de luz do 18-laco).
const RAIO34 = { dia: "255,246,214", tarde: "255,184,112", manha: "255,206,196" };
const raio34Cache = {};
function raioSpr34(cor){
  if (raio34Cache[cor]) return raio34Cache[cor];
  const c = document.createElement("canvas"); c.width = 40; c.height = 64; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, "rgba(" + cor + ",1)"); g.addColorStop(.55, "rgba(" + cor + ",.55)"); g.addColorStop(1, "rgba(" + cor + ",0)");
  x.fillStyle = g; x.beginPath(); x.moveTo(1, 0); x.lineTo(13, 0); x.lineTo(39, 64); x.lineTo(15, 64); x.closePath(); x.fill();
  // borda mais fraquinha dos dois lados (o feixe não tem quina dura)
  x.globalCompositeOperation = "destination-out"; x.fillStyle = "rgba(0,0,0,.45)";
  x.beginPath(); x.moveTo(1, 0); x.lineTo(4, 0); x.lineTo(20, 64); x.lineTo(15, 64); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(10, 0); x.lineTo(13, 0); x.lineTo(39, 64); x.lineTo(34, 64); x.closePath(); x.fill();
  return raio34Cache[cor] = c;
}
function raiosSol34(tm, hr){
  const kind = skyKind(hr); if (kind === "noite" || climaAgora()) return;
  const cor = RAIO34[kind], est = estacao(), forca = (kind === "dia" ? (est === "verao" ? .62 : est === "inverno" ? .4 : .5) : .45);
  const spr = raioSpr34(cor);
  for (const k of janelas()){
    const [x, y] = k.split(",").map(Number); if (!isFace(x, y)) continue;
    const px = x * T + 2, py = y * T + 12;
    ctx.globalAlpha = forca; ctx.globalCompositeOperation = "screen"; ctx.drawImage(spr, px, py); ctx.globalCompositeOperation = "source-over";
    // poeirinha dançando dentro do feixe
    for (let i = 0; i < 4; i++){
      const f = ((tm / 9000 + i * .27 + x * .13) % 1), yy = py + 4 + f * 50, xx = px + 5 + f * 20 + Math.sin(tm / 1300 + i * 2.1) * 2.5;
      ctx.globalAlpha = .55 * Math.sin(f * Math.PI); P(Math.round(xx), Math.round(yy), "#FFFBEA");
    }
  }
  ctx.globalAlpha = 1;
}
