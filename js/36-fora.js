"use strict";
// Casinha · v48: jardim em volta da casa (substitui o drawGarden do 04-cenario)
// Grama com manchas de luz e sombra, folhinhas em V, trevos e pedrinhas; flores em buquezinho nas cores da estação;
// arbustos redondos com sombra e florzinha; árvores espiando pelas bordas (copa com sombra na grama).
// Os lugares são os mesmos de antes (arbustos nas laterais e embaixo, quintal), então nada novo fica embaixo de móvel.

function moita36(cx, by, w, h, gp, est){ // arbusto arredondado; (cx, by) = meio da base
  const [a0, a1, a2, a3] = gp.arb, x0 = cx - w / 2;
  R(x0 + 1, by, w - 1, 1, "rgba(20,45,30,.3)"); R(x0 + 2, by + 1, w - 3, 1, "rgba(20,45,30,.13)"); // sombra
  for (let dy = 0; dy < h; dy++){
    const t = (dy + .5) / h * 2 - 1, hw = Math.max(1, Math.round(Math.sqrt(1 - t * t) * w / 2)), y = by - h + dy;
    R(cx - hw, y, hw * 2, 1, a2); // contorno escuro
    if (hw > 1) R(cx - hw + 1, y, hw * 2 - 2, 1, dy < h * .4 ? a1 : dy > h * .72 ? a2 : a0);
  }
  for (let i = 0; i < 3; i++){ const q = hash(cx, by, 60 + i); P(cx - 2 + q % 4, by - h + 1 + (q >> 4) % 2, a3); } // brilho no alto
  for (let i = 0; i < 2; i++){ const q = hash(cx, by, 70 + i); P(cx - w / 2 + 2 + q % Math.max(1, w - 4), by - h + 2 + (q >> 5) % Math.max(1, h - 3), gp.bot[i % 2]); } // flor/fruta
  if (est === "primavera"){ P(cx + 1, by - h + 2, "#FFFFFF"); P(cx - 2, by - 2, "#F9B8CC"); }
  if (gp.geada) R(cx - Math.floor(w / 2) + 2, by - h, w - 4, 1, "#EEF4F2");
}
function copa36(cx, cy, r, gp, est, seed){ // árvore vista de cima, com sombra deslocada pra baixo e pra direita
  const [a0, a1, a2, a3] = gp.arb;
  for (let dy = -r; dy <= r; dy++){ const hw = Math.round(Math.sqrt(r * r - dy * dy)); R(cx - hw + 3, cy + dy + 3, hw * 2, 1, "rgba(20,45,30,.22)"); }
  for (let dy = -r; dy <= r; dy++){ const hw = Math.round(Math.sqrt(r * r - dy * dy)); R(cx - hw, cy + dy, hw * 2, 1, dy > r * .4 ? a2 : a0); }
  for (let dy = -r + 2; dy < 2; dy++){ const hw = Math.round(Math.sqrt(Math.max(0, (r - 3) * (r - 3) - dy * dy)) * .6); if (hw > 0) R(cx - hw - Math.round(r * .2), cy + dy, hw, 1, a1); }
  for (let i = 0; i < r * 2; i++){ const q = hash(seed, i, 73), ax = cx - r + 1 + q % (r * 2 - 1), ay = cy - r + 1 + (q >> 6) % (r * 2 - 1); if (Math.hypot(ax - cx, ay - cy) < r - 1) P(ax, ay, i % 3 ? a2 : a3); }
  if (est === "primavera" || est === "verao") for (let i = 0; i < 4; i++){ const q = hash(seed, i, 74); P(cx - r + 3 + q % (r * 2 - 5), cy - r + 3 + (q >> 5) % r, gp.bot[i % 2]); }
  if (gp.geada) R(cx - Math.round(r * .5), cy - r, Math.round(r), 1, "#EEF4F2");
}
drawGarden = function(est, chuva){
  const gp = GRAMAS[est] || GRAMAS.primavera, g = gp.g, gD = gp.gD, gL = gp.gL, mD = mix(g, gD, .55), mL = mix(g, gL, .5);
  R(0, 0, W * T, H * T, g);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++){
    if (tx > 0 && tx < W - 1 && ty < HC) continue;
    const meioQuintal = ty > HC && ty < H - 1 && tx > 0 && tx < W - 1, px = tx * T, py = ty * T;
    for (let i = 0; i < 2; i++){ const q = hash(tx, ty, 100 + i); R(px + q % 12, py + (q >> 4) % 13, 3 + (q >> 9) % 3, 2 + (q >> 12) % 2, i ? mL : mD); } // manchas
    for (let i = 0; i < 8; i++){ // folhinhas em V e pontinhos
      const q = hash(tx, ty, i), ax = px + 1 + q % 14, ay = py + (q >> 5) % 14;
      if (i % 3 === 0){ P(ax, ay, gL); P(ax - 1, ay + 1, gD); P(ax + 1, ay + 1, gD); }
      else if (i % 3 === 1){ P(ax, ay, gL); P(ax, ay + 1, gD); }
      else P(ax, ay, gD);
    }
    const k = hash(tx, ty, 120);
    if (k % 4 === 0){ const ax = px + 2 + k % 11, ay = py + 2 + (k >> 6) % 11; P(ax, ay, gL); P(ax + 1, ay, gL); P(ax, ay + 1, gL); P(ax + 1, ay + 1, mD); } // trevo
    if (k % 7 === 3){ const ax = px + 2 + (k >> 3) % 11, ay = py + 3 + (k >> 8) % 10; P(ax, ay, "#B9B2A8"); P(ax + 1, ay, "#D6D0C6"); P(ax, ay + 1, "rgba(20,45,30,.25)"); } // pedrinha
    for (let i = 0; i < gp.nFlor; i++){
      const q = hash(tx, ty, 20 + i); if (q % gp.raro || (meioQuintal && q % 5 > (gp.folhas ? 1 : 0))) continue;
      const fx = tx === 0 ? px + 2 + q % 5 : tx === W - 1 ? px + 10 + q % 5 : px + 1 + (q >> 3) % 14, fy = ty === HC ? py + 10 + (q >> 7) % 4 : py + 1 + (q >> 7) % 13;
      const cor = gp.flores[(q >> 11) % gp.flores.length];
      if (gp.folhas){ R(fx, fy, 2, 1, cor); P(fx + ((q >> 13) % 2), fy + 1, sh(cor, -.2)); } // folhas caídas
      else if (gp.geada){ P(fx, fy, cor); if (q % 3 === 0) P(fx + 1, fy, "#DDE7EA"); } // geada
      else { P(fx, fy - 1, cor); P(fx - 1, fy, cor); P(fx + 1, fy, cor); P(fx, fy, (q >> 14) % 2 ? "#FFE08A" : "#FFFFFF"); P(fx, fy + 1, "#4F9050"); } // florzinha de 4 pétalas
    }
  }
  // arbustos nos mesmos lugares de antes
  for (const tx of [1, 4, 5, 9, 12, 15]){ if (portaQ && Math.abs(tx - portaQ) <= 1) continue; const w = 9 + hash(tx, 0, 41) % 3; moita36(tx * T + 3 + hash(tx, 0, 40) % 4 + w / 2, HC * T + 15, w, 6, gp, est); }
  for (const ty of [2, 6, 9]){ moita36(5, ty * T + 11, 7, 6, gp, est); moita36((W - 1) * T + 12, ty * T + 17, 7, 6, gp, est); }
  // árvores espiando pelas bordas de baixo (a copa sai da tela)
  copa36(-2, H * T + 5, 14, gp, est, 1); copa36(W * T + 3, H * T + 7, 15, gp, est, 2);
  if (chuva){
    ctx.fillStyle = "rgba(30,50,90,.13)"; ctx.fillRect(0, 0, W * T, H * T);
    const poca = (x, y, w, h) => { R(x + 1, y, w - 2, h, "#7E9FC0"); R(x, y + 1, w, h - 2, "#7E9FC0"); R(x + 1, y + 1, w - 3, 1, "#A9C6E0"); P(x + w - 2, y + h - 2, "#6A88AA"); };
    for (let tx = 1; tx < W - 1; tx++){ const q = hash(tx, HC, 77); if (q % 4 === 0 && !(portaQ && Math.abs(tx - portaQ) <= 0)) poca(tx * T + 2 + q % 6, HC * T + 11, 6, 3); }
    for (let ty = HC + 1; ty < H - 1; ty++) for (let tx = 1; tx < W - 1; tx++){ const q = hash(tx, ty, 78); if (q % 5 === 0) poca(tx * T + 2 + q % 5, ty * T + 3 + (q >> 4) % 8, 7 + q % 3, 4); }
    for (const ty of [4, 8]){ poca(1, ty * T + 12, 6, 3); poca((W - 1) * T + 9, ty * T + 2, 6, 3); }
  }
};
// faixa de cima (parede alta): o mesmo jardim rico do lado de fora
{ const f0 = faixaFora35; faixaFora35 = function(px){
  if (andarAtual === 1) return f0(px);
  const gp = GRAMAS[estacao()] || GRAMAS.primavera, g = gp.g, mD = mix(g, gp.gD, .55), mL = mix(g, gp.gL, .5);
  R(px, -TOPO, T, TOPO, g);
  for (let i = 0; i < 2; i++){ const q = hash(px, -1, 130 + i); R(px + q % 12, -TOPO + (q >> 4) % 13, 3, 2, i ? mL : mD); }
  for (let i = 0; i < 7; i++){ const q = hash(px >> 4, -1, i), ax = px + 1 + q % 14, ay = -TOPO + (q >> 5) % 14; P(ax, ay, i % 2 ? gp.gD : gp.gL); }
}; }
