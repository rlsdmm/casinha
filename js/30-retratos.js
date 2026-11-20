"use strict";
// Casinha · retratos prontos do espelho. Arte gerada no PixelLab (uma vez só, guardada aqui no jogo): quando o visual
// de alguém bate com um retrato pronto, o espelho mostra essa arte em vez do desenho feito no código.
// Cada folha (img/retratos/<nome>.png) tem 64x64 por quadro: colunas = frente, direita, costas, esquerda;
// as primeiras linhas são as roupas e as de baixo, na mesma ordem, a máscara da peça principal (branco = pinta com a cor
// da roupa escolhida). Corpo, pele e cabelo ficam como foram gerados, por isso a pessoa precisa bater nesses campos.

const RETRATOS_PRONTOS = [
  { src: "img/retratos/amanda.png?v=1", corpo: "ela", pele: 2, cabelo: 0, estilo: 6, acess: 2,
    trajes: { 2: 0, 1: 1, 4: 2 } }, // saia e blusa, vestido, moletom (linha na folha)
  // v51: Luisi desenhado a partir do moletom da Amanda (cabelo curto preto, orelhas, pele um tom mais clara); só moletom
  { src: "img/retratos/luisi.png?v=1", corpo: "ele", pele: 1, cabelo: 5, estilo: 0, acess: 0,
    trajes: { 4: 0 } },
];
const RP_COL = { down: 0, right: 1, up: 2, left: 3 };

function rpFolha(def){
  if (def.img) return def.img.complete && def.img.naturalWidth ? def.img : null;
  def.img = new Image(); def.img.src = def.src;
  def.img.onload = () => retratoProntoCache.clear();
  return null;
}
function rpAchar(v){
  if (!v || v.barriga) return null; // barriga de grávida a arte não tem: fica o desenho do código
  return RETRATOS_PRONTOS.find(d => d.corpo === v.corpo && d.pele === v.pele && d.cabelo === v.cabelo &&
    d.estilo === v.estilo && d.acess === v.acess && d.trajes[v.traje] !== undefined) || null;
}
const temRetratoPronto = v => !!rpAchar(v);

const retratoProntoCache = new Map();
function retratoPronto(v, vista){
  const def = rpAchar(v); if (!def) return null;
  const img = rpFolha(def); if (!img) return null;
  const linha = def.trajes[v.traje], col = RP_COL[vista] || 0, nLinhas = img.naturalHeight / 128;
  const key = def.src + "|" + linha + "|" + col + "|" + v.roupa;
  let c = retratoProntoCache.get(key); if (c) return c;
  c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(img, col * 64, linha * 64, 64, 64, 0, 0, 64, 64);
  const m = document.createElement("canvas"); m.width = 64; m.height = 64;
  const mx = m.getContext("2d", { willReadFrequently: true });
  mx.drawImage(img, col * 64, (linha + nLinhas) * 64, 64, 64, 0, 0, 64, 64);
  pintarPeca(x.getImageData(0, 0, 64, 64), mx.getImageData(0, 0, 64, 64).data, ROUPAS[v.roupa] || ROUPAS[0], x);
  retratoProntoCache.set(key, c);
  return c;
}
// pinta a peça com a cor escolhida mantendo luz e sombra da arte (o brilho de cada pixel em relação à média da peça)
function pintarPeca(d, mk, hex, x){
  const a = d.data, alvo = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16));
  const lum = i => .299 * a[i] + .587 * a[i + 1] + .114 * a[i + 2];
  let soma = 0, n = 0;
  for (let i = 0; i < a.length; i += 4) if (mk[i + 3] > 0 && a[i + 3] > 0){ soma += lum(i); n++; }
  if (!n) return;
  const media = Math.max(8, soma / n);
  for (let i = 0; i < a.length; i += 4){
    if (!(mk[i + 3] > 0 && a[i + 3] > 0)) continue;
    const k = Math.max(.35, Math.min(1.9, lum(i) / media));
    for (let j = 0; j < 3; j++){
      const c = alvo[j];
      a[i + j] = Math.round(k <= 1 ? c * k : c + (255 - c) * Math.min(1, (k - 1) * .55));
    }
  }
  x.putImageData(d, 0, 0);
}
