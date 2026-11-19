"use strict";
// Casinha · funções de desenho, sprites em cache e arte dos móveis
// ===================== desenho =====================
let ctx, S = 1;
function R(x, y, w, h, c){ ctx.fillStyle = c; const X = Math.round(x * S), Y = Math.round(y * S); ctx.fillRect(X, Y, Math.round((x + w) * S) - X, Math.round((y + h) * S) - Y); }
function P(x, y, c){ R(x, y, 1, 1, c); }
function withCtx(c, s, fn){ const pc = ctx, ps = S; ctx = c; S = s; try { fn(); } finally { ctx = pc; S = ps; } }
function clipRect(x, y, w, h, fn){ ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); try { fn(); } finally { ctx.restore(); } }
function hexRGB(h){
  h = String(h);
  if (h[0] === "r"){ const m = h.match(/\d+/g); return [+m[0], +m[1], +m[2]]; }
  const n = parseInt(h.replace("#", "").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function sh(h, a){ const [r, g, b] = hexRGB(h), t = a < 0 ? 0 : 255, k = Math.abs(a), f = v => Math.round(v + (t - v) * k); return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")"; }
function mix(a, b, t){ const A = hexRGB(a), B = hexRGB(b); return "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"; }
function hash(x, y, i){ let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(i | 0, 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return (n ^ (n >>> 16)) >>> 0; }
function box(x, y, w, h, c){ R(x, y, w, h, c); R(x, y, w, 1, sh(c, .25)); R(x, y + h - 1, w, 1, sh(c, -.25)); if (h > 2) R(x + w - 1, y + 1, 1, h - 2, sh(c, -.12)); }
// caixa com cantos arredondados, brilho em cima e sombra embaixo
function rbox(x, y, w, h, c){ R(x + 1, y, w - 2, h, c); R(x, y + 1, w, h - 2, c); R(x + 1, y, w - 2, 1, sh(c, .25)); R(x + 1, y + h - 1, w - 2, 1, sh(c, -.25)); if (h > 3) R(x + w - 1, y + 1, 1, h - 2, sh(c, -.13)); }

// paleta comum dos móveis
const C = {
  wood: "#B5814F", woodL: "#D2A06C", woodD: "#8C5E3A", woodDD: "#6B4429",
  cream: "#FFF4E0", creamD: "#E9D8BE", ink: "#2E2638", inkL: "#4A4258",
  metal: "#C6D0DA", metalD: "#8D9BAA", metalL: "#EEF3F7",
  rose: "#EE9AB2", coral: "#E8735F", mint: "#7FD1B2", gold: "#F6C667", sky: "#7FB8E8",
  leaf: "#4FA568", leafD: "#35804F", leafL: "#8AD490"
};
const BED_BL = { casal: "#6F5CC0", solteiro: "#E8735F" };

// ---- sprites com contorno automático, guardados em cache ----
const OUTLINE = [45, 28, 48];
const sprCache = new Map();
function sprite(key, w, h, fn, outline){
  let s = sprCache.get(key); if (s) return s;
  const c = document.createElement("canvas"); c.width = w + 2; c.height = h + 2;
  const x = c.getContext("2d");
  withCtx(x, 1, () => fn(1, 1));
  if (outline !== false){
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data, cw = c.width, ch = c.height, mark = [];
    const op = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && a[(j * cw + i) * 4 + 3] > 40;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++){
      if (op(i, j)) continue;
      if (op(i - 1, j) || op(i + 1, j) || op(i, j - 1) || op(i, j + 1)) mark.push((j * cw + i) * 4);
    }
    for (const p of mark){ a[p] = OUTLINE[0]; a[p + 1] = OUTLINE[1]; a[p + 2] = OUTLINE[2]; a[p + 3] = 255; }
    x.putImageData(d, 0, 0);
  }
  s = { c }; sprCache.set(key, s); return s;
}

// quanto cada móvel sobe acima do próprio quadrado (parte alta, ex.: geladeira)
const TOP = { geladeira: 16, tv: 9, pc: 9, estante: 14, armario: 14, som: 8, planta: 15, abajur: 30, sofa: 6, chuveiro: 10, mesa: 4, casal: 4, solteiro: 4, game: 2, fogao: 5, pia: 8, vaso: 5, tapete: 0, canteiro: 1, pote: 0, churrasqueira: 10, rede: 6, piscina: 2, balanco: 16, piquenique: 3, poltrona: 8, banheira: 7 };
function furnFrame(t, on, tm, ph){
  if (FRAME6[t]) return FRAME6[t](on, tm, ph || 0); // leva 6: móveis novos animados
  if (t === "pote") return petPoteCheio() ? 1 : 0;
  if (t === "piscina") return Math.floor((tm + (ph || 0) * 97) / 520) % 3; // água sempre mexendo
  if (t === "rede" || t === "balanco") return on ? 1 + Math.floor(tm / (t === "rede" ? 700 : 380)) % 2 : 0;
  if (t === "churrasqueira") return on ? 1 + Math.floor(tm / 200) % 2 : 0;
  if (t === "planta") return [0, 1, 0, 2][Math.floor((tm + (ph || 0) * 233) / 650) % 4]; // balanço leve
  if (!on) return 0;
  if (t === "tv") return 1 + Math.floor(tm / 900) % 4;
  if (t === "fogao") return 1 + Math.floor(tm / 220) % 2;
  if (t === "som") return 1 + Math.floor(tm / 260) % 2;
  return 1;
}
function furnSprite(t, f){
  const c = CAT[t], top = TOP[t] || 0;
  return sprite("f:" + t + ":" + f, c.w * T, c.h * T + top, (ox, oy) => drawFurn(t, ox, oy + top, f), !c.chao);
}
function blitFurn(t, x, y, f){ const s = furnSprite(t, f); ctx.drawImage(s.c, Math.round(x - 1), Math.round(y - (TOP[t] || 0) - 1)); }
// redesenha só um pedaço do móvel (r = [x, y, w, h] a partir do topo do quadrado), por cima de quem está sentado
function blitFurnParte(t, f, x, y, r){ const s = furnSprite(t, f), top = TOP[t] || 0; ctx.drawImage(s.c, r[0] + 1, r[1] + top + 1, r[2], r[3], Math.round(x + r[0]), Math.round(y + r[1]), r[2], r[3]); }
// cadeira de escritório puxada pra quem senta no computador (vista de trás): pé com rodinhas atrás, encosto na frente
function cadeiraPc(cx, by, frente){
  const k = frente ? "cad:f" : "cad:b";
  const s = sprite(k, 10, 8, (ox, oy) => {
    if (frente){ rbox(ox + 2, oy + 1, 6, 4, "#6F5CC0"); R(ox + 3, oy + 1, 4, 1, "#9A89E0"); R(ox + 3, oy + 3, 4, 1, "#5546A8"); R(ox + 4, oy + 5, 2, 2, "#5A546C"); }
    else { R(ox + 4, oy, 2, 3, "#5A546C"); R(ox + 1, oy + 3, 8, 1, "#3A3448"); P(ox, oy + 4, "#2E2638"); P(ox + 9, oy + 4, "#2E2638"); P(ox + 3, oy + 4, "#2E2638"); P(ox + 6, oy + 4, "#2E2638"); }
  });
  ctx.drawImage(s.c, cx - 6, frente ? by - 6 : by);
}

function drawFloorTile(x, y, p){
  const px = x * T, py = y * T;
  if (p.tipo === "xadrez"){
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++){
      const c = (i + j) % 2 ? p.b : p.a, qx = px + i * 8, qy = py + j * 8, h = hash(x * 2 + i, y * 2 + j, 1);
      R(qx, qy, 8, 8, sh(c, (h % 5 - 2) * .012));
      R(qx, qy, 8, 1, sh(c, .16)); R(qx, qy + 1, 1, 7, sh(c, .1));
      R(qx, qy + 7, 8, 1, sh(c, -.12)); R(qx + 7, qy, 1, 7, sh(c, -.08));
      if (h % 3 === 0 && (i + j) % 2 === 0) R(qx + 2, qy + 2, 2, 1, sh(c, .35));
    }
  } else if (p.tipo === "tabua"){
    for (let r = 0; r < 4; r++){
      const yy = py + r * 4, gy = y * 4 + r, o = (gy * 11) % 32;
      const rel = (((o - px) % 32) + 32) % 32, cut = rel < 16 ? rel : 0, b0 = Math.floor((px - o) / 32);
      for (const [sx, sw, bi] of [[0, cut, b0], [cut, 16 - cut, cut ? b0 + 1 : b0]]){
        if (!sw) continue;
        const g = hash(bi, gy, 3), v = (g % 7 - 3) * .022;
        R(px + sx, yy, sw, 3, sh(p.a, v)); R(px + sx, yy, sw, 1, sh(p.a, v + .07));
        const g2 = hash(x, gy, 4);
        if (sw > 6 && g2 % 2) R(px + sx + 1 + g2 % (sw - 5), yy + 1 + (g2 >> 4) % 2, 3 + (g2 >> 7) % 2, 1, sh(p.a, v - .08));
        if (sw > 6 && g2 % 9 === 0) P(px + sx + 2 + (g2 >> 5) % (sw - 4), yy + 1, p.b);
      }
      R(px, yy + 3, T, 1, p.b);
      if (rel < 16) R(px + cut, yy, 1, 3, sh(p.b, -.08));
    }
  } else if (p.tipo === "deck"){ // tábuas em pé com fresta, emendas desencontradas e pregos
    for (let c = 0; c < 4; c++){
      const xx = px + c * 4, gx = x * 4 + c, o = (gx * 13) % 32, rel = (((o - py) % 32) + 32) % 32;
      for (const [sy, sh0, bi] of [[0, rel < 16 ? rel : 16, Math.floor((py - o) / 32)], [rel, rel < 16 ? 16 - rel : 0, Math.floor((py - o) / 32) + 1]]){
        if (sh0 <= 0) continue;
        const v = (hash(gx, bi, 5) % 7 - 3) * .025;
        R(xx, py + sy, 3, sh0, sh(p.a, v)); R(xx, py + sy, 1, sh0, sh(p.a, v + .1));
      }
      R(xx + 3, py, 1, T, p.b);
      if (rel < 16){ R(xx, py + rel, 3, 1, sh(p.b, .15)); P(xx + 1, py + (rel + 2) % 16, sh(p.a, -.3)); }
      const h = hash(gx, y, 6); if (h % 3 === 0) R(xx + 1, py + 3 + (h >> 4) % 9, 1, 2, sh(p.a, -.12));
    }
  } else {
    R(px, py, T, T, p.a);
    for (let j = 0; j < T; j++) for (let i = (j % 2) * 2; i < T; i += 4) P(px + i, py + j, j % 2 ? sh(p.a, .09) : p.b);
    for (let i = 0; i < 4; i++){ const h = hash(x, y, 10 + i); P(px + h % 16, py + (h >> 5) % 16, i % 2 ? sh(p.a, .18) : sh(p.b, -.08)); }
  }
}

// arte do pacote Bitglow (https://bitglow.itch.io, recortes em img/moveis/bitglow.png): planta e abajur de pé.
// Enquanto a imagem não carrega, fica o desenho do código; quando chega, os sprites guardados são refeitos.
const BITGLOW = { img: null, ok: false, pecas: { planta: [0, 16, 15, 30], abajur: [16, 0, 16, 46] } };
(() => {
  const im = new Image();
  im.onload = () => { BITGLOW.ok = true; for (const k of [...sprCache.keys()]) if (/^f:(planta|abajur):/.test(k)) sprCache.delete(k); };
  im.src = "img/moveis/bitglow.png?v=1"; BITGLOW.img = im;
})();
function arteBitglow(t, x, y, f){
  const r = BITGLOW.ok && BITGLOW.pecas[t]; if (!r) return false;
  const [sx, sy, w, h] = r, dx = x + Math.floor((16 - w) / 2), dy = y + 16 - h;
  if (t === "planta" && f){ // balanço leve: só as folhas mexem 1px, o vaso fica parado
    const vaso = 11, s = f === 1 ? -1 : 1;
    ctx.drawImage(BITGLOW.img, sx, sy, w, h - vaso, dx + s, dy, w, h - vaso);
    ctx.drawImage(BITGLOW.img, sx, sy + h - vaso, w, vaso, dx, dy + h - vaso, w, vaso);
  } else ctx.drawImage(BITGLOW.img, sx, sy, w, h, dx, dy, w, h);
  return true;
}
function drawFurn(t, x, y, f){
  switch (t){
    case "casal": case "solteiro": {
      const w = t === "casal" ? 48 : 32, bl = BED_BL[t], blL = sh(bl, .2), blD = sh(bl, -.2);
      // cabeceira
      rbox(x, y - 4, w, 13, C.woodD);
      R(x + 2, y - 2, w - 4, 8, C.wood); R(x + 2, y - 2, w - 4, 1, C.woodL); R(x + 2, y + 5, w - 4, 1, C.woodDD);
      pixHeart(x + w / 2 - 3, y, C.woodL); R(x + 4, y, 1, 4, C.woodD); R(x + w - 5, y, 1, 4, C.woodD);
      // estrado e lençol
      box(x + 1, y + 8, w - 2, 39, C.wood); R(x + 1, y + 47, w - 2, 1, C.woodDD);
      R(x + 3, y + 9, w - 6, 36, C.cream); R(x + 3, y + 9, w - 6, 1, "#FFFFFF"); R(x + w - 4, y + 10, 1, 11, C.creamD);
      // travesseiros
      const pw = t === "casal" ? 19 : 22, pos = t === "casal" ? [4, 25] : [5];
      for (const p of pos){ rbox(x + p, y + 10, pw, 10, "#FFFFFF"); R(x + p + 2, y + 17, pw - 4, 1, "#E6DDF0"); R(x + p + 2, y + 12, 3, 1, "#F3EEF8"); P(x + p + pw - 3, y + 12, "#E6DDF0"); }
      // cobertor com a dobra do lençol
      R(x + 2, y + 21, w - 4, 25, bl);
      R(x + 2, y + 21, w - 4, 3, C.cream); R(x + 2, y + 23, w - 4, 1, C.creamD); R(x + 2, y + 24, w - 4, 1, blD);
      R(x + 2, y + 25, w - 4, 1, blL); R(x + w - 4, y + 25, 2, 20, blD); R(x + 2, y + 25, 1, 20, blL);
      if (t === "casal"){
        for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++){
          const sx = x + 7 + i * 8 + (j % 2) * 4, sy = y + 28 + j * 4;
          if ((i + j) % 3 === 0){ P(sx, sy - 1, "#F4E9B8"); R(sx - 1, sy, 3, 1, "#F4E9B8"); P(sx, sy + 1, "#F4E9B8"); } else P(sx, sy, sh(bl, .42));
        }
      } else {
        for (let j = 0; j < 3; j++){ R(x + 3, y + 28 + j * 6, w - 7, 2, blL); R(x + 3, y + 30 + j * 6, w - 7, 1, sh(bl, .45)); }
      }
      R(x + 2, y + 44, w - 4, 1, blD);
      // pé da cama
      rbox(x, y + 45, w, 3, C.woodD);
      break; }
    case "sofa": {
      const sf = "#7C69CC", sfD = "#6453B0", sfDD = "#4E3F92", sfL = "#9A89E0";
      rbox(x + 3, y - 6, 42, 11, sfDD);
      for (let i = 0; i < 3; i++){ rbox(x + 5 + i * 13, y - 5, 12, 9, sfD); P(x + 10 + i * 13, y - 1, sfDD); P(x + 11 + i * 13, y - 1, sf); }
      R(x + 5, y + 4, 38, 1, sfDD);
      R(x + 5, y + 5, 38, 7, sfL); R(x + 5, y + 5, 38, 1, "#B3A4EE"); R(x + 5, y + 11, 38, 1, sf);
      R(x + 17, y + 5, 1, 7, sf); R(x + 30, y + 5, 1, 7, sf);
      R(x + 4, y + 12, 40, 3, sfD); R(x + 4, y + 14, 40, 1, sfDD);
      rbox(x, y - 2, 6, 17, sfD); rbox(x + 42, y - 2, 6, 17, sfD);
      R(x + 1, y - 1, 4, 2, sfL); R(x + 43, y - 1, 4, 2, sfL); R(x + 1, y + 11, 4, 3, sfDD); R(x + 43, y + 11, 4, 3, sfDD);
      // almofadas
      rbox(x + 7, y - 2, 8, 7, C.gold); R(x + 9, y, 4, 1, "#FCE9B8"); R(x + 9, y + 2, 4, 1, "#FCE9B8");
      rbox(x + 34, y - 1, 7, 6, C.mint); P(x + 36, y + 1, "#FFFFFF"); P(x + 38, y + 2, "#FFFFFF"); P(x + 36, y + 3, "#FFFFFF");
      R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 44, y + 15, 2, 1, C.woodDD);
      break; }
    case "tv": {
      // rack
      box(x + 1, y + 6, 30, 9, C.wood); R(x + 1, y + 6, 30, 2, C.woodL);
      R(x + 3, y + 9, 12, 5, C.woodD); R(x + 17, y + 9, 12, 5, C.woodD); R(x + 4, y + 10, 10, 3, C.wood); R(x + 18, y + 10, 10, 3, C.wood);
      R(x + 4, y + 10, 10, 1, C.woodL); R(x + 18, y + 10, 10, 1, C.woodL);
      P(x + 13, y + 11, C.gold); P(x + 18, y + 11, C.gold);
      R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 28, y + 15, 2, 1, C.woodDD);
      // aparelho
      R(x + 12, y + 5, 8, 1, C.ink); R(x + 10, y + 6, 12, 1, C.inkL);
      rbox(x + 3, y - 9, 26, 14, C.ink);
      if (!f){ R(x + 5, y - 7, 22, 10, "#2A3550"); R(x + 6, y - 6, 6, 1, "#42537A"); R(x + 6, y - 5, 3, 1, "#42537A"); P(x + 6, y - 4, "#42537A"); R(x + 20, y + 1, 5, 1, "#34415F"); }
      else {
        const sky = ["#7EC8F0", "#F4A77C", "#2A2F6E", "#B49CF4"][f - 1], gr = ["#5DBB7D", "#C97842", "#3E7A3A", "#E06B92"][f - 1];
        R(x + 5, y - 7, 22, 6, sky); R(x + 5, y - 3, 22, 1, sh(sky, .25)); R(x + 5, y - 1, 22, 4, gr); R(x + 5, y - 1, 22, 1, sh(gr, .22));
        R(x + 20, y - 6, 3, 3, f === 3 ? "#F4F1FB" : "#FFE08A");
        R(x + 7 + f * 2, y - 3, 5, 2, sh(gr, -.12)); R(x + 8 + f * 2, y - 4, 3, 1, sh(gr, -.12));
        R(x + 7 + f, y - 6, 4, 1, "#FFFFFF"); R(x + 8 + f, y - 5, 4, 1, "#FFFFFF");
        if (f === 3){ P(x + 8, y - 5, "#FFFFFF"); P(x + 14, y - 6, "#FFFFFF"); }
        R(x + 5, y - 7, 22, 1, "rgba(255,255,255,.25)");
      }
      P(x + 26, y + 3, f ? "#7FE0A8" : "#C4504A");
      break; }
    case "game":
      box(x + 1, y + 7, 14, 8, C.wood); R(x + 1, y + 7, 14, 2, C.woodL); R(x + 3, y + 10, 10, 4, C.woodDD);
      R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 12, y + 15, 2, 1, C.woodDD);
      rbox(x + 3, y + 1, 10, 6, "#F1EDF7"); R(x + 4, y + 4, 5, 1, "#B9B2C8"); P(x + 11, y + 4, f ? "#6FE0A0" : "#9A93AC"); R(x + 4, y + 2, 3, 1, "#FFFFFF");
      rbox(x + 4, y + 11, 8, 3, C.ink); P(x + 5, y + 12, C.coral); P(x + 10, y + 12, C.sky); P(x + 7, y + 12, C.inkL); P(x + 8, y + 12, C.inkL);
      P(x + 8, y + 7, C.ink); P(x + 8, y + 8, C.ink); P(x + 8, y + 9, C.ink);
      break;
    case "geladeira": {
      const g = "#BFE5DA", gL = "#E4F6F0", gD = "#9CCBBE", gDD = "#74A89A";
      rbox(x + 1, y - 12, 14, 27, g);
      R(x + 2, y - 11, 1, 25, gL); R(x + 12, y - 11, 2, 25, gD); R(x + 3, y - 11, 9, 1, gL);
      R(x + 1, y - 3, 14, 1, gDD); R(x + 2, y - 2, 10, 1, gL);
      R(x + 11, y - 9, 1, 4, C.metalD); P(x + 11, y - 9, C.metalL); R(x + 11, y, 1, 6, C.metalD); P(x + 11, y, C.metalL);
      // bilhete e ímãs
      R(x + 4, y - 9, 4, 4, C.cream); R(x + 5, y - 7, 2, 1, C.rose); P(x + 5, y - 10, C.coral); P(x + 6, y - 10, C.coral);
      P(x + 4, y + 2, C.coral); P(x + 6, y + 2, C.coral); R(x + 4, y + 3, 3, 1, C.coral); P(x + 5, y + 4, C.coral);
      R(x + 7, y + 7, 2, 2, C.gold); P(x + 4, y + 9, C.sky);
      R(x + 2, y + 15, 3, 1, C.inkL); R(x + 11, y + 15, 3, 1, C.inkL);
      break; }
    case "fogao": {
      const fg = "#F4EEE6";
      rbox(x + 1, y - 5, 14, 4, "#DDD5CA"); R(x + 6, y - 4, 4, 2, C.ink); P(x + 7, y - 4, f ? "#7FE0A8" : "#6A6478"); P(x + 3, y - 3, C.coral); P(x + 12, y - 3, C.inkL);
      R(x + 1, y - 2, 14, 9, C.ink); R(x + 1, y - 2, 14, 1, C.inkL);
      for (const [a, b] of [[3, -1], [9, -1], [3, 3], [9, 3]]){ R(x + a, y + b, 4, 3, "#1F1A28"); R(x + a + 1, y + b + 1, 2, 1, "#77708A"); }
      box(x + 1, y + 7, 14, 8, fg);
      for (let i = 0; i < 4; i++) P(x + 3 + i * 3, y + 8, "#6A6478");
      R(x + 3, y + 10, 10, 4, C.ink); R(x + 4, y + 11, 8, 2, f ? "#F2A65A" : "#5A546C"); if (f) R(x + 5, y + 11, 3, 1, "#FAD08A"); else P(x + 5, y + 11, "#77708A");
      R(x + 3, y + 10, 10, 1, C.metal);
      R(x + 2, y + 15, 2, 1, C.inkL); R(x + 12, y + 15, 2, 1, C.inkL);
      if (f){
        R(x + 3, y + 4, 4, 1, "#6FB8F0"); P(x + 4 + (f - 1), y + 3, "#F2A65A"); P(x + 5 - (f - 1), y + 4, "#FFE08A");
        rbox(x + 8, y - 4, 6, 5, "#B9C2CC"); R(x + 9, y - 4, 4, 1, "#E4EAF0"); P(x + 7, y - 2, "#8D9BAA"); P(x + 14, y - 2, "#8D9BAA"); R(x + 9, y + 1, 4, 1, f === 1 ? "#6FB8F0" : "#F2A65A");
      }
      break; }
    case "pia":
      box(x, y + 5, 16, 10, C.creamD); R(x + 2, y + 8, 5, 6, C.cream); R(x + 9, y + 8, 5, 6, C.cream); R(x + 2, y + 13, 5, 1, "#D6C3A6"); R(x + 9, y + 13, 5, 1, "#D6C3A6");
      P(x + 6, y + 10, C.gold); P(x + 9, y + 10, C.gold); R(x, y + 15, 16, 1, "#A8977E");
      R(x, y, 16, 6, "#DCE4EA"); R(x, y, 16, 1, "#F6FAFC"); R(x, y + 5, 16, 1, "#A9B5C0");
      R(x + 3, y + 1, 10, 4, "#AEBECB"); R(x + 4, y + 2, 8, 2, f ? "#7FB8E8" : "#CBD8E2"); P(x + 5, y + 2, f ? "#E6F4FD" : "#E4EDF3"); if (!f) P(x + 8, y + 3, "#8D9BAA");
      R(x + 7, y - 4, 2, 5, C.metal); R(x + 6, y - 4, 4, 1, C.metalL); P(x + 8, y - 2, C.metalD); P(x + 5, y - 1, C.coral); P(x + 10, y - 1, C.sky);
      if (f) R(x + 7, y + 1, 1, 2, "#BFE0F5");
      R(x + 13, y + 1, 2, 2, C.rose); P(x + 13, y + 1, "#F9C9D6");
      break;
    case "mesa":
      // cadeira de trás
      rbox(x + 10, y - 4, 12, 8, C.woodD); R(x + 12, y - 2, 2, 4, C.wood); R(x + 15, y - 2, 2, 4, C.wood); R(x + 18, y - 2, 2, 4, C.wood);
      // tampo
      rbox(x + 1, y + 2, 30, 24, C.wood); R(x + 2, y + 3, 28, 1, C.woodL);
      for (const [a, b, l] of [[4, 6, 6], [21, 9, 7], [5, 14, 4], [22, 21, 5], [4, 22, 7], [23, 5, 4]]) R(x + a, y + b, l, 1, sh(C.wood, -.09));
      R(x + 2, y + 26, 28, 2, C.woodDD); R(x + 2, y + 26, 28, 1, C.woodD);
      // caminho de mesa
      R(x + 12, y + 2, 8, 24, C.cream); R(x + 12, y + 2, 1, 24, C.creamD); R(x + 19, y + 2, 1, 24, C.creamD);
      R(x + 13, y + 4, 6, 1, C.rose); R(x + 13, y + 23, 6, 1, C.rose); P(x + 14, y + 6, C.rose); P(x + 17, y + 6, C.rose); P(x + 14, y + 21, C.rose); P(x + 17, y + 21, C.rose);
      // pratos e canecas
      rbox(x + 3, y + 6, 7, 6, "#FFFFFF"); R(x + 5, y + 8, 3, 2, "#EFE8F4");
      rbox(x + 22, y + 16, 7, 6, "#FFFFFF"); R(x + 24, y + 18, 3, 2, "#EFE8F4");
      R(x + 5, y + 15, 3, 4, C.sky); R(x + 5, y + 15, 3, 1, "#6B4630"); P(x + 8, y + 16, C.sky); P(x + 5, y + 18, sh(C.sky, -.2));
      R(x + 24, y + 8, 3, 4, C.rose); R(x + 24, y + 8, 3, 1, "#6B4630"); P(x + 23, y + 9, C.rose); P(x + 26, y + 11, sh(C.rose, -.2));
      // vaso com flores
      R(x + 14, y + 13, 4, 5, "#8FC1EC"); R(x + 14, y + 13, 1, 5, "#C5E0F6"); R(x + 14, y + 17, 4, 1, "#5F96C8");
      R(x + 15, y + 10, 1, 3, C.leafD); P(x + 16, y + 11, C.leaf); P(x + 14, y + 11, C.leaf);
      R(x + 12, y + 8, 3, 3, C.coral); P(x + 13, y + 9, C.gold); R(x + 17, y + 8, 3, 3, "#9C8AE6"); P(x + 18, y + 9, C.gold); R(x + 14, y + 6, 3, 3, C.rose); P(x + 15, y + 7, "#FFFFFF");
      // cadeira da frente
      rbox(x + 10, y + 27, 12, 5, C.woodD); R(x + 11, y + 28, 10, 2, C.rose); R(x + 11, y + 28, 10, 1, "#F9C9D6");
      break;
    case "chuveiro":
      // base de azulejo
      rbox(x, y + 1, 16, 15, "#E3EEF4"); R(x + 2, y + 3, 12, 11, "#C3DCEA");
      R(x + 2, y + 6, 12, 1, "#B0CFE1"); R(x + 2, y + 10, 12, 1, "#B0CFE1"); R(x + 6, y + 3, 1, 11, "#B0CFE1"); R(x + 10, y + 3, 1, 11, "#B0CFE1");
      R(x + 2, y + 3, 12, 1, "#D6E9F3"); R(x + 7, y + 8, 2, 2, "#7FA6C9"); P(x + 7, y + 8, "#5F86A9");
      // cano e chuveiro
      R(x + 8, y - 7, 2, 9, C.metal); R(x + 8, y - 7, 1, 9, C.metalL);
      rbox(x + 5, y - 10, 8, 3, C.metal); R(x + 6, y - 8, 6, 1, C.metalD);
      P(x + 11, y - 1, C.coral); P(x + 12, y - 1, C.sky);
      // cortina
      R(x, y - 6, 16, 1, C.metalD);
      for (let i = 0; i < 4; i++){ R(x + i, y - 5, 1, 19 - (i % 2), i % 2 ? "#F9C9D6" : C.rose); }
      R(x, y - 5, 4, 1, "#FFFFFF");
      break;
    case "vaso":
      rbox(x + 3, y - 5, 10, 8, "#F4F7FA"); R(x + 4, y - 4, 8, 1, "#FFFFFF"); R(x + 9, y - 3, 2, 1, C.metal); R(x + 3, y + 2, 10, 1, "#C9D3DC");
      rbox(x + 3, y + 3, 10, 11, "#FFFFFF");
      R(x + 5, y + 5, 6, 7, "#D5DEE6"); R(x + 6, y + 6, 4, 5, "#A9D3EA"); P(x + 6, y + 6, "#E6F6FF"); P(x + 7, y + 6, "#E6F6FF"); R(x + 6, y + 10, 4, 1, "#8FBFDA");
      R(x + 5, y + 14, 6, 1, "#C9D3DC");
      break;
    case "pc":
      box(x, y + 2, 32, 9, C.wood); R(x, y + 2, 32, 1, C.woodL); R(x + 2, y + 5, 5, 1, sh(C.wood, -.09)); R(x + 24, y + 8, 5, 1, sh(C.wood, -.09));
      R(x + 1, y + 11, 30, 4, C.woodD); R(x + 3, y + 12, 17, 3, C.woodDD); R(x + 21, y + 11, 9, 4, C.wood); R(x + 21, y + 11, 9, 1, C.woodL); R(x + 24, y + 13, 3, 1, C.gold);
      R(x + 1, y + 15, 2, 1, C.woodDD); R(x + 29, y + 15, 2, 1, C.woodDD);
      // monitor
      R(x + 14, y + 3, 4, 1, C.ink); R(x + 12, y + 4, 8, 1, C.inkL);
      rbox(x + 8, y - 9, 16, 12, C.ink); R(x + 10, y - 7, 12, 8, f ? "#5FA8E8" : "#2A3550");
      if (f){ R(x + 11, y - 6, 7, 1, "#F1F8FE"); R(x + 11, y - 4, 9, 1, "#C5E0F6"); R(x + 11, y - 2, 5, 1, "#F1F8FE"); R(x + 19, y - 6, 2, 1, C.rose); R(x + 10, y - 7, 12, 1, "#8CC4F2"); }
      else { R(x + 11, y - 6, 4, 1, "#42537A"); R(x + 11, y - 5, 2, 1, "#42537A"); }
      P(x + 21, y + 1, f ? "#7FE0A8" : "#6A6478");
      // teclado, mouse, caneca e cacto
      rbox(x + 10, y + 6, 12, 3, "#F1EDF7"); R(x + 11, y + 7, 10, 1, "#C9C2D8"); R(x + 24, y + 6, 2, 3, "#F1EDF7"); P(x + 24, y + 6, C.rose);
      R(x + 3, y + 5, 3, 4, C.coral); R(x + 3, y + 5, 3, 1, "#6B4630"); P(x + 6, y + 6, C.coral);
      R(x + 27, y + 4, 3, 3, "#D0794A"); R(x + 27, y + 4, 3, 1, "#E79A6C"); R(x + 28, y + 1, 1, 3, C.leaf); P(x + 27, y + 2, C.leaf); P(x + 29, y + 3, C.leafD);
      break;
    case "estante": {
      rbox(x, y - 14, 32, 3, C.wood); box(x, y - 11, 32, 26, C.woodD); R(x, y - 11, 1, 26, C.wood);
      const cs = [C.coral, C.sky, C.gold, C.mint, C.rose, "#9C8AE6", C.cream];
      const rows = [[-10, 7], [-1, 7], [8, 6]];
      rows.forEach(([yy, hh], r) => {
        R(x + 2, y + yy, 28, hh, C.woodDD); R(x + 2, y + yy, 28, 1, "#4E3220");
        let bx = x + 3, i = 0;
        while (bx < x + 27){
          if (r === 0 && i === 6){ R(bx, y + yy + 2, 5, 5, C.cream); R(bx + 1, y + yy + 3, 3, 3, "#F9C9D6"); P(bx + 2, y + yy + 4, C.coral); bx += 6; i++; continue; }
          if (r === 1 && i === 3){ R(bx + 1, y + yy + 4, 4, 3, "#D0794A"); R(bx + 1, y + yy + 4, 4, 1, "#E79A6C"); R(bx, y + yy + 1, 2, 3, C.leaf); R(bx + 3, y + yy, 2, 4, C.leafD); P(bx + 2, y + yy + 2, C.leafL); P(bx + 5, y + yy + 2, C.leaf); bx += 7; i++; continue; }
          if (r === 2 && i === 5){ R(bx, y + yy + 2, 4, 4, C.gold); R(bx + 1, y + yy + 1, 2, 1, C.gold); P(bx + 1, y + yy + 3, "#FCE9B8"); bx += 5; i++; continue; }
          const bw = 2 + ((i + r) % 3 === 0 ? 1 : 0), bh = hh - 1 - ((i * 2 + r) % 3 === 0 ? 1 : 0), col = cs[(i * 3 + r * 2) % 7];
          R(bx, y + yy + hh - bh, bw, bh, col); R(bx, y + yy + hh - bh, bw, 1, sh(col, .35)); R(bx + bw - 1, y + yy + hh - bh + 1, 1, bh - 1, sh(col, -.18));
          if (bh > 4) R(bx, y + yy + hh - 3, bw, 1, sh(col, .45));
          bx += bw + (i % 5 === 4 ? 1 : 0); i++;
        }
        R(x + 2, y + yy + hh, 28, 1, C.woodL);
      });
      R(x + 1, y + 15, 3, 1, C.woodDD); R(x + 28, y + 15, 3, 1, C.woodDD);
      break; }
    case "som": {
      // toca-discos em cima de um móvel de madeira
      rbox(x + 1, y - 8, 14, 3, C.woodD);
      R(x + 1, y - 6, 14, 6, C.woodL); R(x + 1, y - 1, 14, 1, C.wood);
      R(x + 4, y - 5, 6, 4, "#241E2C"); R(x + 3, y - 4, 8, 2, "#241E2C"); R(x + 6, y - 4, 2, 2, f === 2 ? C.gold : C.coral); P(x + (f === 2 ? 5 : 8), y - 5, "#5A546C");
      R(x + 12, y - 5, 1, 3, C.metal); P(x + 11, y - 3, C.metalD); P(x + 12, y - 6, C.metalD);
      box(x + 1, y, 14, 15, C.wood);
      R(x + 3, y + 2, 10, 8, C.creamD);
      for (let j = 0; j < 8; j++) for (let i = j % 2; i < 10; i += 2) P(x + 3 + i, y + 2 + j, "#D6C3A6");
      const g = f === 1 ? 1 : 0;
      R(x + 5 - g, y + 3, 6 + g * 2, 6, "#8C7A62"); R(x + 6, y + 4, 4, 4, "#5E5040"); R(x + 7, y + 5, 2, 2, f ? C.gold : "#8C7A62");
      P(x + 4, y + 12, C.gold); P(x + 7, y + 12, C.coral); P(x + 11, y + 12, f ? "#7FE0A8" : C.woodDD); R(x + 3, y + 11, 10, 1, C.woodD);
      R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 12, y + 15, 2, 1, C.woodDD);
      break; }
    case "planta": {
      if (arteBitglow(t, x, y, f)) break;
      const s = f === 1 ? -1 : f === 2 ? 1 : 0;
      // folhas
      R(x + 7, y + 1, 2, 7, C.leafD);
      R(x + 2, y + 2, 4, 4, C.leafD); R(x + 1, y + 3, 3, 3, C.leaf); P(x + 2, y + 3, C.leafL); R(x + 4, y + 5, 3, 2, C.leafD);
      R(x + 10, y + 2, 4, 4, C.leafD); R(x + 12, y + 2, 3, 3, C.leaf); P(x + 13, y + 2, C.leafL); R(x + 9, y + 5, 3, 2, C.leafD);
      R(x + 3 + s, y - 4, 3, 5, C.leaf); P(x + 3 + s, y - 4, C.leafL); P(x + 4 + s, y - 5, C.leaf);
      R(x + 10 + s, y - 5, 3, 5, C.leaf); P(x + 12 + s, y - 5, C.leafL); P(x + 11 + s, y - 6, C.leaf);
      R(x + 6 + s, y - 6, 4, 8, C.leaf); R(x + 7 + s, y - 8, 2, 2, C.leaf); R(x + 8 + s, y - 6, 1, 7, C.leafL); P(x + 7 + s, y - 3, C.leafL); P(x + 9 + s, y - 5, C.leafL);
      // vaso de barro
      rbox(x + 4, y + 9, 8, 7, "#D0794A"); R(x + 3, y + 8, 10, 2, "#E79A6C"); R(x + 3, y + 9, 10, 1, "#B5623A"); R(x + 5, y + 12, 6, 1, "#F6D9B8"); R(x + 4, y + 8, 3, 1, "#F4B58C");
      break; }
    case "armario":
      rbox(x, y - 14, 32, 4, C.woodD); R(x + 1, y - 13, 30, 1, C.woodL);
      box(x + 1, y - 10, 30, 24, C.wood);
      R(x + 3, y - 8, 12, 20, C.woodL); R(x + 17, y - 8, 12, 20, C.woodL); R(x + 15, y - 9, 2, 22, C.woodD);
      R(x + 3, y + 11, 12, 1, C.wood); R(x + 17, y + 11, 12, 1, C.wood);
      // espelho na porta esquerda
      R(x + 5, y - 6, 8, 13, C.woodD); R(x + 6, y - 5, 6, 11, "#CFE8F4"); R(x + 7, y - 4, 1, 4, "#FFFFFF"); R(x + 8, y - 4, 1, 2, "#FFFFFF"); R(x + 10, y + 2, 1, 3, "#E9F6FC"); R(x + 6, y + 5, 6, 1, "#A9CFE2");
      // almofadas da porta direita
      for (const yy of [-6, 3]){ R(x + 19, y + yy, 8, 7, C.wood); R(x + 19, y + yy, 8, 1, C.woodD); R(x + 19, y + yy, 1, 7, C.woodD); R(x + 20, y + yy + 6, 7, 1, "#E4B988"); }
      R(x + 14, y + 1, 1, 3, C.gold); R(x + 17, y + 1, 1, 3, C.gold);
      R(x + 1, y + 14, 30, 1, C.woodDD); R(x + 2, y + 15, 3, 1, C.woodDD); R(x + 27, y + 15, 3, 1, C.woodDD);
      break;
    case "abajur":
      if (arteBitglow(t, x, y, f)) break;
      // mesinha
      box(x + 2, y + 8, 12, 7, C.wood); R(x + 2, y + 8, 12, 2, C.woodL); R(x + 4, y + 11, 8, 3, C.woodD); R(x + 7, y + 12, 2, 1, C.gold);
      R(x + 3, y + 15, 2, 1, C.woodDD); R(x + 11, y + 15, 2, 1, C.woodDD);
      // base de cerâmica e cúpula
      rbox(x + 5, y + 2, 6, 6, C.rose); P(x + 6, y + 3, "#FBD7E1"); R(x + 7, y, 2, 2, "#B98A4A");
      R(x + 4, y - 8, 8, 1, "#FCE9B8"); R(x + 3, y - 7, 10, 3, "#FADB8E"); R(x + 2, y - 4, 12, 4, C.gold); R(x + 2, y - 1, 12, 1, "#E0A848");
      R(x + 4, y - 7, 2, 5, "#FEF3D2"); R(x + 11, y - 5, 2, 4, "#EDB95A");
      break;
    case "canteiro":
      // canteiro de madeira pintada de verde, com terra à mostra
      rbox(x, y + 1, 16, 7, C.woodD); R(x + 1, y + 1, 14, 1, C.woodL);
      R(x + 2, y + 2, 12, 5, "#5A3B26"); R(x + 2, y + 2, 12, 1, "#3E2819"); R(x + 2, y + 6, 12, 1, "#6B4630");
      for (const [a, b] of [[4, 4], [9, 3], [12, 5], [6, 5], [3, 3]]) P(x + a, y + b, "#7A5236");
      box(x + 1, y + 7, 14, 8, "#6FA35C"); R(x + 1, y + 7, 14, 1, "#8FC27A"); R(x + 1, y + 10, 14, 1, "#5A8A4A"); R(x + 1, y + 13, 14, 1, "#5A8A4A");
      R(x + 1, y + 7, 1, 8, "#5A8A4A"); R(x + 14, y + 7, 1, 8, "#4E7A40");
      P(x + 7, y + 8, C.leafL); P(x + 8, y + 8, C.leafL); P(x + 7, y + 9, C.leafD); // folhinha pintada
      R(x + 2, y + 15, 2, 1, C.woodDD); R(x + 12, y + 15, 2, 1, C.woodDD);
      break;
    case "pote":
      rbox(x + 1, y + 10, 14, 5, C.sky); R(x + 2, y + 10, 12, 1, sh(C.sky, .3)); P(x + 3, y + 13, "#FFFFFF"); P(x + 12, y + 12, "#FFFFFF");
      rbox(x + 3, y + 6, 10, 7, C.coral); R(x + 4, y + 6, 8, 1, "#F4A08E");
      R(x + 4, y + 7, 8, 2, f ? "#B5763E" : "#7A3328");
      if (f){ P(x + 5, y + 7, "#D9A060"); P(x + 8, y + 8, "#D9A060"); P(x + 10, y + 7, "#8C5A2C"); P(x + 6, y + 8, "#8C5A2C"); }
      R(x + 4, y + 9, 8, 1, sh(C.coral, -.18));
      pixHeart(x + 6, y + 10, "#FFF4E0");
      break;
    case "churrasqueira": {
      const bk = "#C2604A", bkD = "#9C4634", bkL = "#DB8466", mo = "#E9CDB0";
      // chaminé
      box(x + 22, y - 7, 7, 7, bk); R(x + 22, y - 7, 7, 1, bkL); R(x + 22, y - 4, 7, 1, mo);
      rbox(x + 21, y - 10, 9, 3, "#5A546C"); R(x + 22, y - 10, 7, 1, "#77708A");
      // corpo de tijolinho
      box(x + 1, y - 2, 30, 17, bk); R(x + 1, y - 2, 30, 1, bkL);
      for (let j = 0; j < 3; j++){
        const yy = y + 2 + j * 4; R(x + 1, yy, 30, 1, mo);
        for (let i = (j % 2) * 4 + 3; i < 29; i += 8) R(x + 1 + i, yy + 1, 1, 3, mo);
        R(x + 2, yy + 1, 28, 1, bkL);
      }
      R(x + 1, y + 14, 30, 1, bkD);
      // grelha
      R(x + 2, y - 4, 19, 6, "#2E2638"); R(x + 2, y - 4, 19, 1, "#4A4258");
      for (let i = 0; i < 6; i++) R(x + 4 + i * 3, y - 3, 1, 4, "#77708A");
      if (f){
        for (const [a, b] of [[5, 0], [11, 1], [16, 0], [8, 1]]) P(x + a, y + b, f === 1 ? "#F2A65A" : "#FFD27A");
        rbox(x + 4, y - 3, 6, 3, "#A8502E"); R(x + 5, y - 3, 4, 1, "#D07A4A");
        rbox(x + 12, y - 2, 6, 3, "#B85A30"); R(x + 13, y - 2, 4, 1, "#E08A58");
      }
      // boca da lenha
      R(x + 5, y + 6, 14, 7, "#3A2433"); R(x + 5, y + 6, 14, 1, bkD);
      R(x + 7, y + 10, 10, 2, C.woodD); R(x + 8, y + 10, 4, 1, C.wood);
      if (f){ R(x + 8, y + 9, 8, 1, "#F2A65A"); P(x + 10, y + 8, "#FFD27A"); P(x + 13, y + 8, "#F2A65A"); }
      // bancada de lado
      rbox(x + 22, y + 1, 8, 4, C.wood); R(x + 23, y + 1, 6, 1, C.woodL); P(x + 25, y + 2, C.metal); P(x + 26, y + 2, C.metal);
      R(x + 2, y + 15, 3, 1, bkD); R(x + 27, y + 15, 3, 1, bkD);
      break; }
    case "rede": {
      const bal = f === 1 ? 1 : 0;
      // postes
      for (const px of [x + 1, x + 44]){ R(px, y - 6, 3, 20, C.woodD); R(px, y - 6, 1, 20, C.wood); R(px - 1, y + 13, 5, 2, C.woodDD); R(px, y - 7, 3, 1, C.woodL); }
      // cordas
      R(x + 4, y - 4, 4, 1, C.creamD); R(x + 40, y - 4, 4, 1, C.creamD); P(x + 5, y - 3, C.creamD); P(x + 42, y - 3, C.creamD);
      // pano listrado, caindo no meio
      const cores = [C.rose, "#F9C9D6", C.cream, C.mint, C.cream, "#D97A96"];
      for (let i = 0; i < 32; i++){
        const sag = Math.round(Math.sin(Math.PI * i / 31) * 5) + (i > 4 && i < 27 ? bal : 0);
        for (let j = 0; j < 6; j++) P(x + 8 + i, y - 4 + sag + j, cores[j]);
        if (i % 3 === 1) P(x + 8 + i, y + 2 + sag, C.creamD);
      }
      // sombra no chão
      R(x + 12, y + 13, 24, 1, "rgba(35,18,40,.22)"); R(x + 16, y + 14, 16, 1, "rgba(35,18,40,.14)");
      break; }
    case "piscina": {
      const ring = "#6FB3E8", ringD = "#4E8FC8", ringL = "#A8D8F6", agua = "#8FD6EE", aguaD = "#6CC2E2";
      rbox(x + 1, y - 2, 30, 33, ring);
      R(x + 3, y - 2, 26, 1, ringL); R(x + 1, y + 2, 1, 24, ringL); R(x + 3, y + 30, 26, 1, ringD); R(x + 30, y + 2, 1, 24, ringD);
      // listras do bote
      for (const [a, b, w, h] of [[8, -2, 4, 4], [20, -2, 4, 4], [1, 10, 4, 4], [27, 10, 4, 4], [8, 27, 4, 4], [20, 27, 4, 4]]) R(x + a, y + b, w, h, C.rose);
      // água
      rbox(x + 5, y + 2, 22, 25, aguaD); R(x + 6, y + 3, 20, 23, agua); R(x + 6, y + 3, 20, 2, aguaD);
      const o = f || 0;
      R(x + 8 + o, y + 8, 4, 1, "#E6F8FD"); R(x + 18 - o, y + 13, 5, 1, "#E6F8FD"); R(x + 9, y + 20 + (o % 2), 3, 1, "#E6F8FD"); P(x + 22, y + 22 - o, "#E6F8FD");
      // patinho
      const dx = x + 17 + (o === 1 ? 1 : 0), dy = y + 18;
      R(dx, dy + 1, 6, 3, C.gold); R(dx + 4, dy - 1, 3, 3, C.gold); P(dx + 7, dy, "#F08A3A"); P(dx + 5, dy, C.ink); R(dx + 1, dy + 1, 2, 1, "#FCE9B8"); R(dx, dy + 4, 6, 1, aguaD);
      break; }
    case "balanco": {
      const mt = "#E8735F", mtD = "#B8524A", mtL = "#F4A08E", bal = f === 1 ? -1 : f === 2 ? 1 : 0;
      // pernas e trave
      for (const px of [x + 1, x + 28]){ R(px, y - 14, 3, 29, mt); R(px, y - 14, 1, 29, mtL); R(px + 2, y - 14, 1, 29, mtD); R(px - 1, y + 14, 5, 1, mtD); }
      rbox(x, y - 17, 32, 4, mtD); R(x + 1, y - 17, 30, 1, mtL); P(x + 9, y - 15, C.metal); P(x + 22, y - 15, C.metal);
      // dois assentos
      for (const [sx, d] of [[x + 6, bal], [x + 19, -bal]]){
        R(sx + 1, y - 14, 1, 17 + (d ? 0 : 0), C.creamD); R(sx + 6, y - 14, 1, 17, C.creamD);
        rbox(sx + d, y + 3, 8, 3, C.wood); R(sx + 1 + d, y + 3, 6, 1, C.woodL); R(sx + 1 + d, y + 6, 6, 1, "rgba(35,18,40,.2)");
      }
      R(x + 4, y + 12, 24, 1, "rgba(35,18,40,.18)");
      break; }
    case "piquenique": {
      // banco de trás
      rbox(x + 4, y - 3, 40, 5, C.woodD); R(x + 5, y - 3, 38, 1, C.wood);
      // tampo de tábuas
      rbox(x + 2, y + 3, 44, 18, C.wood); R(x + 3, y + 4, 42, 1, C.woodL);
      R(x + 3, y + 9, 42, 1, C.woodD); R(x + 3, y + 15, 42, 1, C.woodD);
      R(x + 3, y + 21, 42, 2, C.woodDD);
      // toalha xadrez
      for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) R(x + 13 + i * 3, y + 6 + j * 3, 3, 3, (i + j) % 2 ? "#E8607A" : "#FFF4E0");
      R(x + 13, y + 18, 18, 1, "#C9466A");
      // melancia, cesta e suco
      R(x + 5, y + 7, 6, 3, "#E8445E"); R(x + 5, y + 10, 6, 1, "#F4E9B8"); R(x + 5, y + 11, 6, 1, "#5DB070"); P(x + 7, y + 8, C.ink); P(x + 9, y + 8, C.ink);
      rbox(x + 34, y + 7, 9, 7, "#C9965E"); R(x + 35, y + 9, 7, 1, "#A87A44"); R(x + 35, y + 11, 7, 1, "#A87A44"); R(x + 36, y + 5, 5, 1, "#8C5E3A"); P(x + 35, y + 6, "#8C5E3A"); P(x + 41, y + 6, "#8C5E3A"); P(x + 37, y + 8, "#E8445E");
      R(x + 6, y + 14, 3, 4, C.gold); R(x + 6, y + 14, 3, 1, "#FFFFFF"); P(x + 9, y + 15, C.gold);
      // pés e banco da frente
      R(x + 7, y + 23, 2, 2, C.woodDD); R(x + 39, y + 23, 2, 2, C.woodDD);
      rbox(x + 4, y + 25, 40, 5, C.woodD); R(x + 5, y + 25, 38, 1, C.wood); R(x + 6, y + 30, 2, 1, C.woodDD); R(x + 40, y + 30, 2, 1, C.woodDD);
      break; }
    case "poltrona": {
      // poltrona mostarda com botões no encosto
      const c = "#E9A94B", cD = "#C9873A", cDD = "#A66A2A", cL = "#F6CE84";
      rbox(x + 1, y - 8, 14, 13, cD); R(x + 2, y - 7, 12, 1, cL);
      R(x + 3, y - 6, 10, 9, c); R(x + 3, y - 6, 10, 1, sh(c, .2)); P(x + 5, y - 3, cDD); P(x + 10, y - 3, cDD); P(x + 8, y, cDD); P(x + 5, y + 1, cDD); P(x + 10, y + 1, cDD);
      R(x + 3, y + 4, 10, 1, cDD);
      R(x + 3, y + 5, 10, 6, cL); R(x + 3, y + 5, 10, 1, "#FBE3B0"); R(x + 3, y + 10, 10, 1, c);
      R(x + 3, y + 11, 10, 3, cD); R(x + 3, y + 13, 10, 1, cDD);
      for (const ax of [x, x + 12]){ rbox(ax, y - 2, 4, 16, c); R(ax + 1, y - 2, 2, 2, cL); R(ax + 1, y + 11, 2, 2, cDD); }
      R(x + 1, y + 15, 2, 1, C.woodDD); R(x + 13, y + 15, 2, 1, C.woodDD);
      break; }
    case "banheira": {
      // banheira de pé de leão, com torneira, patinho e espuma quando está em uso
      const bw = "#FFFFFF", bD = "#D5DEE6", bDD = "#AEBBC8", ag = "#8FD0EE", agD = "#6CB8DE";
      R(x + 2, y - 7, 2, 4, C.metal); R(x + 2, y - 7, 4, 1, C.metalL); P(x + 5, y - 6, C.metalD); P(x + 1, y - 5, C.coral); P(x + 4, y - 4, C.sky);
      rbox(x + 1, y - 4, 30, 18, bw); R(x + 2, y - 4, 28, 1, "#FFFFFF"); R(x + 29, y - 2, 1, 14, bD);
      rbox(x + 3, y - 2, 26, 10, agD); R(x + 4, y - 1, 24, 8, ag); R(x + 4, y - 1, 24, 1, agD);
      R(x + 7, y + 2, 4, 1, "#C9EEFA"); R(x + 18, y + 4, 5, 1, "#C9EEFA"); P(x + 24, y + 1, "#C9EEFA");
      if (f){ for (const [a, b] of [[5, 1], [9, 4], [14, 2], [20, 5], [25, 2], [12, 6], [23, 6]]){ R(x + a, y + b, 2, 2, "#FFFFFF"); P(x + a + 1, y + b + 1, "#E6F4FB"); } }
      R(x + 3, y + 8, 26, 1, bD); R(x + 2, y + 9, 28, 1, "#FFFFFF");
      R(x + 2, y + 10, 28, 3, "#F4F7FA"); R(x + 2, y + 12, 28, 1, bD); R(x + 3, y + 13, 26, 1, bDD);
      // patinho na borda
      R(x + 24, y - 5, 4, 2, C.gold); R(x + 26, y - 7, 2, 2, C.gold); P(x + 28, y - 6, "#F08A3A"); P(x + 27, y - 7, C.ink);
      for (const fx of [x + 3, x + 26]){ R(fx, y + 14, 3, 1, C.gold); P(fx + 1, y + 15, "#D8963A"); }
      break; }
    case "tapete": {
      const a = "#DC6A86", b = "#F6CDD6", d = "#B8475F";
      for (let i = 0; i < 13; i++){ P(x + 1, y + 4 + i * 2, C.cream); P(x + 46, y + 4 + i * 2, C.cream); P(x + 2, y + 3 + i * 2, C.creamD); P(x + 45, y + 3 + i * 2, C.creamD); }
      R(x + 4, y + 2, 40, 28, d); R(x + 3, y + 3, 42, 26, d);
      R(x + 5, y + 4, 38, 24, b); R(x + 6, y + 5, 36, 22, a);
      for (let i = 0; i < 9; i++){ P(x + 8 + i * 4, y + 7, b); P(x + 8 + i * 4, y + 24, b); }
      for (let j = 1; j < 4; j++){ P(x + 8, y + 7 + j * 4 + 1, b); P(x + 40, y + 7 + j * 4 + 1, b); }
      // losango central com coração
      for (let r = -6; r <= 6; r++){ const hw = (7 - Math.abs(r)) * 2; R(x + 24 - hw, y + 16 + r, hw * 2, 1, r === -6 || r === 6 ? b : d); if (hw > 2) R(x + 24 - hw + 2, y + 16 + r, hw * 2 - 4, 1, b); }
      pixHeart(x + 22, y + 14, "#E8607A");
      for (const sx of [12, 36]){ P(x + sx, y + 14, b); R(x + sx - 1, y + 15, 3, 2, b); P(x + sx, y + 17, b); P(x + sx, y + 15, C.gold); }
      break; }
    default: if (FURN_EXTRA[t]) FURN_EXTRA[t](x, y, f); // leva 5: móveis novos (ursinho)
  }
}

// efeitos soltos por cima dos móveis em uso (vapor, água), sem contorno
function drawFx(t, x, y, tm){
  if (t === "chuveiro"){
    for (let i = 0; i < 10; i++){ const ph = (tm / 55 + i * 37) % 21; R(x + 5 + (i * 5) % 8, y - 7 + ph, 1, 2, "rgba(220,240,255,.85)"); }
    for (let i = 0; i < 3; i++){ const ph = (tm / 1300 + i / 3) % 1; ctx.globalAlpha = .55 * (1 - ph); R(x + 3 + i * 4 + Math.round(Math.sin(tm / 400 + i * 2)), y - 2 - ph * 12, 3, 2, "#FFFFFF"); }
  } else if (t === "fogao"){
    for (let i = 0; i < 3; i++){ const ph = (tm / 1200 + i / 3) % 1; ctx.globalAlpha = .75 * (1 - ph); R(x + 10 + Math.round(Math.sin(tm / 300 + i * 2.1)), y - 6 - ph * 10, 2, 2, "#FFFFFF"); }
  } else if (t === "mesa"){
    for (let i = 0; i < 2; i++){ const ph = (tm / 1400 + i / 2) % 1; ctx.globalAlpha = .7 * (1 - ph); P(x + 6 + Math.round(Math.sin(tm / 350 + i * 3)), y + 13 - ph * 7, "#FFFFFF"); P(x + 25 + Math.round(Math.sin(tm / 330 + i * 3 + 1)), y + 6 - ph * 7, "#FFFFFF"); }
  } else if (t === "pia"){
    ctx.globalAlpha = .8; P(x + 6 + Math.floor(tm / 120) % 3, y + 1, "#FFFFFF"); P(x + 9 - Math.floor(tm / 150) % 2, y + 2, "#FFFFFF");
  } else if (t === "churrasqueira"){
    for (let i = 0; i < 4; i++){ const ph = (tm / 1500 + i / 4) % 1; ctx.globalAlpha = .65 * (1 - ph); R(x + 24 + Math.round(Math.sin(tm / 380 + i * 1.7) * 1.5), y - 12 - ph * 14, 3, 2, "#E6E2EE"); }
    for (let i = 0; i < 2; i++){ const ph = (tm / 1100 + i / 2) % 1; ctx.globalAlpha = .5 * (1 - ph); R(x + 8 + i * 6 + Math.round(Math.sin(tm / 300 + i)), y - 6 - ph * 9, 2, 2, "#FFFFFF"); }
  } else if (t === "piscina"){
    for (let i = 0; i < 4; i++){ const ph = (tm / 650 + i / 4) % 1; ctx.globalAlpha = .9 * (1 - ph); P(x + 9 + i * 5, y + 8 - ph * 7 + (i % 2) * 6, "#E6F8FD"); }
  } else if (t === "banheira"){
    for (let i = 0; i < 3; i++){ const ph = (tm / 1500 + i / 3) % 1; ctx.globalAlpha = .55 * (1 - ph); R(x + 6 + i * 9 + Math.round(Math.sin(tm / 420 + i * 2)), y - 6 - ph * 12, 3, 2, "#FFFFFF"); }
  } else if (t === "som"){ // leva 5: notinhas saindo do toca-discos
    for (let i = 0; i < 3; i++){ const ph = (tm / 1700 + i / 3) % 1; ctx.globalAlpha = .9 * Math.min(1, (1 - ph) * 1.6); pixNote(x + 3 + i * 4 + Math.round(Math.sin(tm / 320 + i * 2) * 2) + Math.round(ph * (i - 1) * 5), y - 7 - ph * 10, ["#CECBF6", "#F9C9D6", "#BFE5DA"][i]); }
  }
  ctx.globalAlpha = 1;
}
