"use strict";
// Casinha · leva 3: estações, chuva e pisca-pisca
// =====================================================================
// LEVA 3: visual novo (corpo, roupas, cabelos, acessórios, espelho), estações e chuva, celular
//   jogadores/<pid>: corpo ("ele" | "ela" | "neutro"), traje, barba, acess, guarda/{"traje-N" | "acess-N": true}
//   Clima não vai pro banco: a chuva sai de um hash(sala, bloco de 3h), igual pra todo mundo da casa.
//   Teste: ?estacao=inverno  ?chuva=1 | garoa | 0  ?mes=6 (bandeirinhas) | 12 (pisca-pisca)  ?hora=NN
// =====================================================================
MENU_EXTRA.armario = id => [{ nome: "Trocar o visual", info: "Espelho", fn: () => useFurn(id, { id: "roupa", nome: "Trocar o visual", dur: 1, ganho: {}, roupa: 1 }) }];

const URLP = new URLSearchParams(location.search);
const ESTACAO_TESTE = ["verao", "outono", "inverno", "primavera"].includes(URLP.get("estacao")) ? URLP.get("estacao") : null;
const CHUVA_TESTE = URLP.has("chuva") ? (URLP.get("chuva") === "0" ? "" : URLP.get("chuva") === "garoa" ? "garoa" : "chuva") : null;
const MES_TESTE = (n => n >= 1 && n <= 12 ? n : null)(parseInt(URLP.get("mes"), 10));
// hemisfério sul: verão dez–fev, outono mar–mai, inverno jun–ago, primavera set–nov. chance = % de blocos com chuva
const ESTACOES = {
  verao: { nome: "Verão", chance: 38, ic: "☀️" },
  outono: { nome: "Outono", chance: 22, ic: "🍂" },
  inverno: { nome: "Inverno", chance: 30, ic: "❄️" },
  primavera: { nome: "Primavera", chance: 25, ic: "🌸" }
};
const BLOCO_CLIMA = 3 * HORA;
const estacaoDoMes = m => m === 12 || m <= 2 ? "verao" : m <= 5 ? "outono" : m <= 8 ? "inverno" : "primavera";
const mesAgora = () => MES_TESTE || new Date(srvNow()).getMonth() + 1;
const estacao = () => ESTACAO_TESTE || estacaoDoMes(mesAgora());
const blocoAgora = () => Math.floor(srvNow() / BLOCO_CLIMA);
// null (sem chuva), "chuva" ou "garoa" (no inverno é sempre garoa)
function climaBloco(b, est){
  est = est || estacaoDoMes(new Date(b * BLOCO_CLIMA).getMonth() + 1);
  if (hash(salaSeed, b, 911) % 100 >= ESTACOES[est].chance) return null;
  return est === "inverno" || hash(salaSeed, b, 912) % 4 === 0 ? "garoa" : "chuva";
}
function climaAgora(){ return CHUVA_TESTE != null ? (CHUVA_TESTE || null) : climaBloco(blocoAgora(), ESTACAO_TESTE); }
const choveuNoBloco = b => b === blocoAgora() ? !!climaAgora() : !!climaBloco(b);
// horta: chuva conta como rega. Crescimento calculado sem gravar nada (idempotente), olhando até 10 dias pra trás
function crescAte(p, t){
  const seca = JARDIM_SECA_H * HORA; let cur = p.ultimaRega || p.plantado || t, g = p.cresc || 0;
  if (t > cur){
    const bt = Math.floor(t / BLOCO_CLIMA);
    for (let b = Math.max(Math.floor(cur / BLOCO_CLIMA), bt - 80); b <= bt; b++){
      const s = b * BLOCO_CLIMA, e = s + BLOCO_CLIMA;
      if (e <= cur || s >= t || !choveuNoBloco(b)) continue;
      const rs = Math.max(s, cur), re = Math.min(e, t);
      g += Math.min(rs - cur, seca) + (re - rs); cur = re;
    }
  }
  return { g: g + Math.min(Math.max(0, t - cur), seca), desde: Math.max(0, t - cur) };
}
// gotas animadas só na área de fora (laterais, jardim de baixo, quintal) e nos vidros das janelas
function drawChuva(tm, tipo){
  const garoa = tipo === "garoa", Ww = W * T, Hh = H * T, cor = garoa ? "rgba(228,238,255,.55)" : "rgba(212,230,255,.78)", len = garoa ? 2 : 4;
  ctx.save(); ctx.beginPath();
  if (zeroAqui()) chuvaClipZero(); // leva 11: casa do zero: chove em todo o lado de fora
  else { ctx.rect(0, -TOPO, 9, Hh + TOPO); ctx.rect(Ww - 9, -TOPO, 9, Hh + TOPO); ctx.rect(0, HC * T + 7, Ww, Hh - HC * T - 7); }
  if (andarAtual === 1) ctx.rect((VX + 1) * T, 9 * T, (W - VX - 1) * T, 3 * T + 7); // varanda é aberta
  const jan = [...janelas()].map(w => w.split(",").map(Number)).filter(([, y]) => y !== 0); // v47: as da parede alta têm gota própria
  for (const [x, y] of jan) ctx.rect(x * T + 4, y * T + 5, 9, 7);
  ctx.clip();
  ctx.fillStyle = cor;
  const n = garoa ? 90 : 190;
  for (let i = 0; i < n; i++){
    const h = hash(i, 31, 5), vel = (garoa ? 55 : 160) + (h >> 9) % 50;
    const y = ((h >> 4) % (Hh + TOPO + 30) + tm / 1000 * vel) % (Hh + TOPO + 30) - 15 - TOPO;
    const x = (((h % Ww) - Math.floor(y / 5)) % Ww + Ww) % Ww; // inclinação leve
    ctx.fillRect(x, Math.floor(y), 1, len);
  }
  for (const [x, y] of jan) for (let i = 0; i < (garoa ? 2 : 4); i++){
    const h = hash(x, i, 6), yy = ((h >> 5) % 9 + tm / 1000 * (garoa ? 9 : 22)) % 10;
    ctx.fillRect(x * T + 4 + h % 9, y * T + 4 + Math.floor(yy), 1, garoa ? 1 : 2);
  }
  if (!garoa){ // respingos
    const passo = Math.floor(tm / 170), y0 = HC * T + 9, alt = Hh - y0 - 3;
    for (let i = 0; i < (portaQ ? 14 : 6); i++){ const h = hash(passo, i, 9), x = h % Ww, y = y0 + (h >> 8) % Math.max(4, portaQ ? alt : 6); ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); }
    if (andarAtual === 1) for (let i = 0; i < 7; i++){ const h = hash(passo, i, 19), x = (VX + 1) * T + 2 + h % ((W - VX - 2) * T - 4), y = 9 * T + 3 + (h >> 8) % (3 * T - 5); ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); }
  }
  ctx.restore();
}
// Natal (dezembro): pisca-pisca na parede de cima
function drawPiscaPisca(tm){
  const cores = ["#FF6E78", "#FFDC78", "#82DCAA", "#8CB4FF"], fase = Math.floor(tm / 450);
  for (let x = 1; x < W - 1; x++){
    if (x === VX) continue;
    const px = x * T; R(px, 4, T, 1, "#3E5A3A");
    for (let q = 0; q < 4; q++){ const n = x * 4 + q, on = (n + fase) % 3 !== 0; ctx.globalAlpha = on ? 1 : .4; R(px + 1 + q * 4, 5, 1, 2, cores[n % 4]); if (on) P(px + 1 + q * 4, 5, "#FFFFFF"); }
    ctx.globalAlpha = 1;
  }
}
// indicador no canto da tela: estação e clima. Avisa quando começa a chover
let climaVisto;
function renderClima(){
  const e = ESTACOES[estacao()], c = climaAgora(), noite = skyKind(hourNow()) === "noite";
  const ic = c === "chuva" ? "🌧️" : c === "garoa" ? "🌦️" : noite ? "🌙" : e.ic;
  const txt = ic + " " + e.nome + (c === "garoa" ? " · garoa" : c ? " · chuva" : "");
  const b = $("clima"); b.hidden = false;
  if (b.textContent !== txt){ b.textContent = txt; b.setAttribute("aria-label", e.nome + (c ? ", " + (c === "chuva" ? "chovendo" : "garoando") : ", tempo firme")); }
  if (climaVisto !== undefined && c && !climaVisto) toast(c === "chuva" ? "Começou a chover. A horta agradece." : "Começou uma garoa lá fora.");
  climaVisto = c;
}
