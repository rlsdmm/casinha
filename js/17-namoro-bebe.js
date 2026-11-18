"use strict";
// Casinha · leva 7: namoro, gravidez e bebê
// =====================================================================
// LEVA 7: namoro (sempre por convite aceito), gravidez e bebê. Tudo sugestivo: coberta, espuma, manta, corações e "fade".
//   casa/namoro/<id> = { a (quem chamou), b, mov, lugar (cama|banheira|sofa|rede), prot (1 = com preservativo),
//                        estado: convite|aceito|fim|recusado|cancelado|expirou, criado, aceitoAt, chegou: {pid: ts},
//                        ini (os dois chegaram: o clima começa), pago: {pid}, contado, fimAt, motivo, quem }
//   casa/stats/namoros, casa/stats/nl_<lugar>, casa/stats/bebes, casa/stats/fraldas   contadores das conquistas
//   casa/gravidez = { a, b, quem (vazio até escolherem), ini, avisado: {pid: ts}, desejos: {bloco: pid} }   uma por vez
//   casa/bebe = { nome, nasceu, pais: {pid: true}, quem, pele, cabelo, fome, fralda, carinho (ts da última vez),
//                 colo (pid de quem está segurando), dormindo, sugest: {pid: nome} }        um bebê por vez
//   casa/bebes = false                   "Bebês na casa" desligado: sem chance de gravidez
//   jogadores/<pid>/romance = false      não aceita convites românticos (a opção some pra quem tenta)
//   jogadores/<pid>/nuvens = ts          humor "Nas nuvens" até essa hora
//   Teste: L7.chance = 1 (força a gravidez sem preservativo) · gvAvancar(horas) · bbAvancar(horas)
//   Gancho: bebeFase() devolve "engatinhando" depois de BB_CRESCE; gêmeos/mais filhos ficariam em casa/filhos.
// =====================================================================
const NM_GRUPO = { casal: "cama", dossel: "cama", banheira: "banheira", sofa: "sofa", namoradeira: "sofa", rede: "rede" };
const NM_LUGAR = { cama: "na cama", banheira: "na banheira", sofa: "no sofá", rede: "na rede" };
const NM_PAQ = 6000, NM_DUR = 24000, NM_DEP = 8000, NM_TOTAL = NM_PAQ + NM_DUR + NM_DEP;
const NM_CONVITE = 45000, NM_ESPERA = 75000, NM_XP = 25, NM_CHANCE = .25, NUVENS_MS = 40 * 60000;
const GV_POS = 6 * HORA, GV_DUR = 4 * 24 * HORA, GV_DESEJO = 3 * HORA;
const BB_FOME = 5 * HORA, BB_FRALDA = 7 * HORA, BB_CARINHO = 4 * HORA, BB_CRESCE = 7 * 24 * HORA;
const FRASES_NM = ["Que momento, hein? 😏", "Os vizinhos nem desconfiam 🤫", "Coração acelerado 💕", "Isso que é cuidar da relação 😌", "Ficou um clima bom na casa ✨"];
const L7 = { chance: null };
let namoros = {}, nmCarregado = false, gravidez = null, gvCarregada = false, bebe = null, bbCarregado = false, bebesOn = true;
let nmTx = {}, nmFeito = {}, nmSpots = {}, nmBeijou = {}, nmFalou = {}, nmSom = 0, nmPart = 0;
let gvTentou = 0, nasceuTentou = 0, quemAberto = false, bbChoroSom = 0, bbChorava = false, bbVoltou = 0, bbColoLimpo = false, bebeView = null;
Object.assign(SFX_MIN, { cabeceira: 600, choro: 4000, chute: 400, risada: 1200 });

const romanceOk = id => !!jogadores[id] && jogadores[id].romance !== false && !jogadores[id].visita; // leva 10: visita não namora
function namoroDe(p){ return Object.entries(namoros).find(([, g]) => g && (g.estado === "convite" || g.estado === "aceito") && (g.a === p || g.b === p)) || null; }
// fase do namoro a partir de ini (relógio do servidor): paquera → clima → abraçadinhos → fim
function nmFase(g, t){
  if (!g || !g.ini) return null;
  const d = t - g.ini; if (d < 0) return null;
  if (d < NM_PAQ) return { f: "paq", p: d / NM_PAQ, d };
  if (d < NM_PAQ + NM_DUR) return { f: "dur", p: (d - NM_PAQ) / NM_DUR, d };
  if (d < NM_TOTAL) return { f: "dep", p: (d - NM_PAQ - NM_DUR) / NM_DEP, d };
  return { f: "fim", p: 1, d };
}
function nmTxn(k, path, fn){ if (nmTx[k] && Date.now() - nmTx[k] < 5000) return; nmTx[k] = Date.now(); txn(path, fn); }

// ---------------- menu da pessoa: namorar e cuidar do bebê que está no colo dela ----------------
function menuSocial7(id){
  const it = [];
  if (romanceOk(id) && romanceOk(pid)) it.push({ nome: "Namorar 😏", info: "Chamar pra namorar", fn: () => escolherNamoro(id) });
  if (bebe && coloDe() === id) for (const a of BEBE_ACOES) if (a.k !== "ninar" && a.k !== "dormir") it.push({ nome: a.menu, info: "No colo de " + nomeDe(id), fn: () => irBebe(a) });
  return it;
}
function escolherNamoro(outro){
  if (!jogadores[outro] || !jogadores[outro].online){ toast(nomeDe(outro) + " não está na casa agora."); return; }
  if (!romanceOk(outro)) return;
  if (namoroDe(pid)){ toast("Já tem um convite seu no ar 😉"); return; }
  if (namoroDe(outro)){ toast(nomeDe(outro) + " está ocupado(a) agora 😉"); return; }
  if (coloDe() === pid){ toast("Coloque o bebê no berço antes 😅"); return; }
  const lugares = Object.entries(moveis).filter(([, m]) => NM_GRUPO[m.t]).sort((a, b) => Object.keys(NM_LUGAR).indexOf(NM_GRUPO[a[1].t]) - Object.keys(NM_LUGAR).indexOf(NM_GRUPO[b[1].t]) || (a[0] < b[0] ? -1 : 1)).slice(0, 8);
  openPanel("namoro", "Namorar com " + nomeDe(outro) + " 😏", corpo => {
    corpo.append(el("p", "muted", nomeDe(outro) + " recebe o convite e decide se topa. \"Agora não\" também é resposta 💞"));
    const lab = el("label", "chkrow"), cb = el("input"), tx = el("span", null, "Com preservativo");
    cb.type = "checkbox"; cb.checked = true;
    tx.append(el("small", null, bebesOn ? "Sem ele, pode ser que venha um bebê por aí 🍼" : "Os bebês estão desligados nesta casa."));
    lab.append(cb, tx); corpo.append(lab, el("h3", null, "Onde?"));
    if (!lugares.length){ corpo.append(el("p", "muted", "Precisa de uma cama de casal, banheira, sofá ou rede neste andar 😅")); return; }
    const g = el("div", "grid2");
    for (const [mid, m] of lugares){
      const b = btn("", "btn ghost escolha", () => { closePanel(); convidarNamoro(outro, mid, cb.checked); });
      b.append(el("strong", null, CAT[m.t].nome), el("small", null, COMODOS[comodo(m.x, m.y)] || "")); g.append(b);
    }
    corpo.append(g);
  });
}
function convidarNamoro(outro, mov, prot){
  const m = moveis[mov]; if (!m || !romanceOk(outro) || namoroDe(pid)) return;
  const id = ref("casa/namoro").push().key;
  ref("casa/namoro/" + id).set({ a: pid, b: outro, mov, lugar: NM_GRUPO[m.t], prot: prot ? 1 : 0, estado: "convite", criado: srvNow() })
    .then(() => { toast("Convite enviado 💌 Agora é com " + nomeDe(outro) + "."); sfx("pop"); }, () => toast("Não deu pra chamar agora."));
}
function aceitarNamoro(id){
  if (coloDe() === pid){ toast("Coloque o bebê no berço antes 😅"); return; }
  txn("casa/namoro/" + id, cur => { if (!cur || cur.estado !== "convite" || cur.b !== pid) return; cur.estado = "aceito"; cur.aceitoAt = srvNow(); return cur; })
    .then(ok => { if (!ok){ toast("Esse convite já era."); return; } irNamoro(id); });
}
function recusarNamoro(id){
  txn("casa/namoro/" + id, cur => { if (!cur || cur.estado !== "convite") return; cur.estado = cur.a === pid ? "cancelado" : "recusado"; cur.fimAt = srvNow(); return cur; });
}
// parar no meio: antes do fim desfaz o clima; já nos abraçadinhos, conta como feito
function cancelarNamoro(id, motivo){
  const g = namoros[id];
  if (g && g.ini && srvNow() >= g.ini + NM_PAQ + NM_DUR){ namoroConcluir(id); return; }
  txn("casa/namoro/" + id, cur => {
    if (!cur || (cur.estado !== "convite" && cur.estado !== "aceito")) return;
    Object.assign(cur, { estado: "cancelado", motivo: motivo || "parou", quem: pid, fimAt: srvNow() }); return cur;
  });
}
function irNamoro(id){
  const g = namoros[id]; if (!g) return;
  const m = moveis[g.mov];
  if (!m){ toast("Esse lugar ficou em outro andar."); cancelarNamoro(id, "longe"); return; }
  closePanel(); closeMenu();
  useFurn(g.mov, acaoNamoro(id, m));
}
function acaoNamoro(id, m){
  const grp = NM_GRUPO[m.t];
  return { id: "namoro", nome: "Namorando " + NM_LUGAR[grp] + " 😏", dur: 120, ganho: {}, sobre: 1, deitar: grp === "cama" || grp === "rede" ? 1 : 0, nm: id,
    antes: () => {
      const g = namoros[id];
      if (!g || g.estado !== "aceito"){ toast("O clima passou… fica pra próxima 😉"); return false; }
      ref("casa/namoro/" + id + "/chegou/" + pid).set(srvNow()).catch(() => {});
      return true;
    },
    fim: () => namoroFim(id), cancel: () => cancelarNamoro(id, "parou") };
}
// quando os dois chegaram (ini), a minha ação passa a terminar junto com a cena
function ajustarAcaoNamoro(){
  const a = me && me.acao; if (!a || a.id !== "namoro" || !a.def || !a.def.nm || a.nmAjust) return;
  const g = namoros[a.def.nm]; if (!g || !g.ini) return;
  a.nmAjust = 1; a.dur = Math.max(1000, g.ini + NM_TOTAL - srvOff - a.ini); setAcao(a);
}
function terminarNamoroMeu(id){ if (me && me.acao && me.acao.id === "namoro" && me.acao.def && me.acao.def.nm === id){ me.acao.acabou = true; setAcao(null); } }
function namoroFim(id){
  const g = namoros[id];
  if (!g || !g.ini || srvNow() < g.ini + NM_TOTAL - 2500){ cancelarNamoro(id, "tempo"); if (!g || !g.ini) toast("Não rolou dessa vez… fica pra próxima 😉"); return; }
  namoroConcluir(id);
}
// cada um ganha o próprio bônus uma vez; quem chegar primeiro em "contado" faz a parte da casa (contador, roupas, sorteio)
function namoroConcluir(id){
  const g = namoros[id]; if (!g || nmFeito[id] || (g.a !== pid && g.b !== pid)) return; nmFeito[id] = 1;
  txn("casa/namoro/" + id + "/pago/" + pid, c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    ganharNeeds({ social: 45, diversao: 35, energia: -12, higiene: -25 });
    xpCasal(NM_XP);
    ref("jogadores/" + pid).update({ nuvens: srvNow() + NUVENS_MS }).catch(() => {});
    toast(FRASES_NM[Math.floor(Math.random() * FRASES_NM.length)]);
  });
  txn("casa/namoro/" + id + "/contado", c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    statMais("namoros"); txn("casa/stats/nl_" + g.lugar, v => v ? undefined : 1);
    deixarRoupas(g); sortearGravidez(g);
    ref("casa/namoro/" + id).update({ estado: "fim", fimAt: srvNow() }).catch(() => {});
  });
}
// roupas jogadas no chão do lado: aparecem na cena e depois viram "Roupa jogada" (sujeira da leva 5) até alguém recolher
function roupaSpots(g, m){
  const k = g.mov + ":" + g.criado; if (nmSpots[k]) return nmSpots[k];
  const c = CAT[m.t], perto = adjTo(m), cands = [];
  for (let y = m.y - 1; y <= m.y + c.h; y++) for (let x = m.x - 1; x <= m.x + c.w; x++) if (perto(x, y) && walkable(x, y) && MAP[y][x] === 0 && !naEscada(x, y)) cands.push([x, y]);
  const h = hash(g.criado | 0, salaSeed, 707), out = [];
  for (let i = 0; i < 2 && cands.length; i++){ const j = hash(h, i, 708) % cands.length; out.push([cands[j][0], cands[j][1], (h >>> (i * 3)) % 4]); cands.splice(j, 1); }
  return (nmSpots[k] = out);
}
function deixarRoupas(g){
  const m = moveis[g.mov]; if (!m) return;
  const novas = {};
  roupaSpots(g, m).forEach(([x, y, v], i) => { novas["nm" + (g.criado || 0) + i] = { tipo: "roupa", x, y, andar: m.andar || 0, criada: srvNow(), v }; });
  if (Object.keys(novas).length) ref("casa/sujeira").update(novas).catch(() => {});
}
function sortearGravidez(g){
  if (g.prot || !bebesOn || gravidez || bebe) return;
  const ch = L7.chance != null ? L7.chance : NM_CHANCE; if (Math.random() >= ch) return;
  const ca = visual(jogadores[g.a]).corpo, cb = visual(jogadores[g.b]).corpo;
  const quem = ca === "ela" && cb !== "ela" ? g.a : cb === "ela" && ca !== "ela" ? g.b : null; // senão, perguntam no dia do positivo
  txn("casa/gravidez", cur => cur ? undefined : { a: g.a, b: g.b, quem, ini: srvNow() });
}
function aoMudarNamoro(novo){
  const ant = namoros; namoros = novo;
  if (nmCarregado && me) for (const [id, g] of Object.entries(namoros)){
    if (!g) continue; const a = ant[id] || null;
    if (g.b === pid && g.estado === "convite" && !a){ toast(nomeDe(g.a) + " te chamou pra namorar " + (NM_LUGAR[g.lugar] || "") + " 😏"); sfx("notif"); }
    if (!a || a.estado === g.estado) continue;
    if (g.a === pid && a.estado === "convite"){
      if (g.estado === "aceito"){ toast(nomeDe(g.b) + " topou 😏"); irNamoro(id); }
      else if (g.estado === "recusado") toast(nomeDe(g.b) + " agora não pode. Fica pra próxima 😉");
      else if (g.estado === "expirou") toast(nomeDe(g.b) + " não viu o convite a tempo.");
    }
    if ((g.a === pid || g.b === pid) && a.estado === "aceito"){
      if (g.estado === "cancelado"){ terminarNamoroMeu(id); if (g.quem !== pid) toast("O clima passou… fica pra próxima 😉"); }
      else if (g.estado === "fim"){ terminarNamoroMeu(id); namoroConcluir(id); }
    }
  }
  nmCarregado = true; ajustarAcaoNamoro();
}
function vigiarNamoro(){
  if (!me || !nmCarregado) return;
  const t = srvNow();
  for (const [id, g] of Object.entries(namoros)){
    if (!g) continue;
    const meu = g.a === pid || g.b === pid, path = "casa/namoro/" + id;
    if (g.estado === "convite"){
      if (meu && t - (g.criado || 0) > NM_CONVITE) nmTxn(id + "exp", path, cur => { if (!cur || cur.estado !== "convite") return; cur.estado = "expirou"; cur.fimAt = srvNow(); return cur; });
      else if (!meu && t - (g.criado || 0) > 10 * 60000) nmTxn(id + "rm", path, () => null);
      continue;
    }
    if (g.estado === "aceito"){
      if (!meu){ if (t - (g.aceitoAt || 0) > 10 * 60000) nmTxn(id + "rm", path, () => null); continue; }
      const ch = g.chegou || {}, outro = g.a === pid ? g.b : g.a, jo = jogadores[outro];
      if (!g.ini && ch[g.a] && ch[g.b]) nmTxn(id + "ini", path + "/ini", c => c ? undefined : srvNow());
      else if (!g.ini && (t - (g.aceitoAt || 0) > NM_ESPERA || ((!jo || !jo.online) && t - (g.aceitoAt || 0) > 8000))) cancelarNamoro(id, "demorou");
      else if (g.ini && t > g.ini + NM_TOTAL + 20000) namoroConcluir(id); // ninguém fechou (recarregaram a página no meio)
      continue;
    }
    if (meu) terminarNamoroMeu(id);
    if (t - (g.fimAt || g.criado || 0) > 120000) nmTxn(id + "rm", path, () => null);
  }
  ajustarAcaoNamoro();
}
// posição e carinha de quem está namorando (no laço de desenho)
function namoroPose(id, acao, m, tm, pisca){
  const ng = namoroDe(id), grp = NM_GRUPO[m.t]; if (!ng || ng[1].mov !== acao.mov || !grp) return null;
  const g = ng[1], lado = id === g.a ? -1 : 1, F = nmFase(g, srvNow()), f = F ? (F.f === "fim" ? "dep" : F.f) : "esp";
  const x0 = m.x * T, y0 = m.y * T, meio = x0 + CAT[m.t].w * T / 2;
  const beijo = f === "paq" && F.d > 2300 && F.d < 3700;
  const seps = { cama: [11, 8, 6, 5], rede: [8, 7, 5, 5], sofa: m.t === "sofa" ? [9, 7, 6, 5] : [7, 6, 6, 5], banheira: [6, 6, 5, 5] }[grp];
  const sep = beijo ? 4 : seps[{ esp: 0, paq: 1, dur: 2, dep: 3 }[f]];
  if (grp === "cama" || grp === "rede"){
    const by = y0 + (grp === "cama" ? 21 : 8) + (f === "dur" ? Math.round(Math.sin(tm / 260 + lado) * .7) : 0);
    const pose = f === "dep" ? "liehappymessy" : f === "dur" ? "lieblush" : "lieopenblush" + (pisca ? "blink" : "");
    return { cx: Math.round(meio + lado * sep), by, pose, dir: "down", lie: 1 };
  }
  const virados = f === "esp" || f === "paq";
  const by = y0 + (grp === "banheira" ? 13 : m.t === "sofa" ? 15 : 14);
  const pose = "sit" + (f === "dep" ? "happymessy" : "blush") + (virados && pisca ? "blink" : "");
  return { cx: Math.round(meio + lado * sep), by, pose, dir: virados ? (lado < 0 ? "right" : "left") : "down", lie: 0, semVaga: grp === "banheira" };
}
// o que cobre os dois: coberta ondulando (cama), manta (sofá e rede), espuma subindo (banheira). Só as cabeças aparecem.
function drawCoberta7(m, f, F, tm){
  const x = m.x * T, y = m.y * T, grp = NM_GRUPO[m.t], OL = "#2D1C30";
  if (grp === "cama"){
    if (f !== "dur") return;
    const w = CAT[m.t].w * T, bl = BED_BL.casal, blL = sh(bl, .22), blD = sh(bl, -.22), meio = x + w / 2;
    for (let i = 0; i < w - 4; i++){
      const xx = x + 2 + i, onda = Math.sin(tm / 190 + i * .32) * 1.3 + Math.sin(tm / 310 - i * .21) * .9;
      const topo = Math.round(y + 19 + onda);
      P(xx, topo - 1, OL); R(xx, topo, 1, y + 45 - topo, bl);
      R(xx, topo, 1, 2, C.cream); P(xx, topo + 2, C.creamD); P(xx, topo + 3, blD);
      // os dois montinhos embaixo da coberta, subindo e descendo
      const b = Math.max(0, 1 - Math.abs(xx - (meio - 6)) / 8) + Math.max(0, 1 - Math.abs(xx - (meio + 6)) / 8);
      if (b > .25){ const yy = y + 28 + Math.round(Math.sin(tm / 210 + (xx < meio ? 0 : 1.6)) * 1.5); P(xx, yy, blL); if (b > .6) P(xx, yy + 1, blL); P(xx, yy + 5, blD); }
      if ((i + Math.floor(tm / 400)) % 9 === 0) P(xx, topo + 9 + (i % 3) * 4, "#F4E9B8"); // estrelinhas da estampa
    }
    R(x + 2, y + 44, w - 4, 1, blD);
  } else if (grp === "rede"){
    if (f !== "dur" && f !== "dep") return;
    const c = "#7FD1B2", cL = "#BFEFDC", cD = "#5BB896";
    for (let i = 2; i < 30; i++){
      const xx = x + 8 + i, sag = Math.round(Math.sin(Math.PI * i / 31) * 5), onda = f === "dur" ? Math.round(Math.sin(tm / 200 + i * .5) * .9) : 0;
      const topo = y + 1 + sag + onda, alt = 5;
      P(xx, topo - 1, OL); R(xx, topo, 1, alt, i % 5 === 0 ? C.cream : c); P(xx, topo, cL); P(xx, topo + alt - 1, cD); P(xx, topo + alt, OL);
    }
    for (const xx of [x + 9, x + 38]){ const s = Math.round(Math.sin(Math.PI * (xx - x - 8) / 31) * 5); R(xx, y + 1 + s, 1, 5, OL); }
  } else if (grp === "sofa"){
    if (f !== "dur" && f !== "dep") return;
    const by = y + (m.t === "sofa" ? 15 : 14), meio = x + CAT[m.t].w * T / 2, half = m.t === "sofa" ? 13 : 12;
    const c = "#F2A65A", cL = "#F8C98E", cD = "#D9843C";
    for (let i = -half; i < half; i++){
      const xx = meio + i, onda = f === "dur" ? Math.round(Math.sin(tm / 210 + i * .45) * .9) : 0, topo = by - 8 + onda, fundo = by + 1;
      P(xx, topo - 1, OL); R(xx, topo, 1, fundo - topo, (i + 40) % 6 === 0 ? C.cream : c);
      P(xx, topo, cL); if ((i + 40) % 6 !== 0) P(xx, topo + 4, cD); P(xx, fundo, OL);
    }
    R(meio - half - 1, by - 8, 1, 9, OL); R(meio + half, by - 8, 1, 9, OL);
  } else if (grp === "banheira"){
    const nivel = f === "esp" ? 7 : f === "paq" ? 7 - 3 * F.p : f === "dur" ? 4 : f === "dep" ? 4 + 3 * F.p : 7;
    for (let i = 0; i < 26; i++){
      const xx = x + 3 + i, topo = Math.round(y + nivel + Math.sin(tm / 330 + i * .8) * .8 - (f === "dur" && i % 7 === 3 ? 1 : 0));
      R(xx, topo, 1, y + 9 - topo, "#FFFFFF"); P(xx, topo, i % 3 ? "#FFFFFF" : "#E6F4FB"); if (i % 4 === 1) P(xx, topo + 2, "#D6ECF7");
    }
    if (f === "dur" || f === "paq") for (let k = 0; k < 6; k++){ // bolhas subindo
      const ph = (tm / 1500 + k / 6) % 1, bx = Math.round(x + 6 + k * 4 + Math.sin(tm / 300 + k) * 1.5), byy = Math.round(y + 3 - ph * 12);
      ctx.globalAlpha = 1 - ph; P(bx, byy - 1, "#CFEFFF"); P(bx - 1, byy, "#CFEFFF"); P(bx + 1, byy, "#CFEFFF"); P(bx, byy + 1, "#CFEFFF");
    }
    ctx.globalAlpha = 1;
    blitFurnParte("banheira", furnFrame("banheira", true, tm, 0), x, y, [-1, 8, 34, 10]); // borda da frente por cima
  }
}
function leva7Luzes(lights, tm){
  const t = srvNow();
  for (const g of Object.values(namoros)){
    if (!g || g.estado !== "aceito" || !g.ini) continue;
    const m = moveis[g.mov], F = nmFase(g, t); if (!m || !F || F.f === "fim") continue;
    const k = F.f === "paq" ? F.p : F.f === "dur" ? 1 : 1 - F.p, cm = comodo(m.x, m.y);
    for (const L of lights){ if (L[2] > 20 && comodo(clamp(Math.floor(L[0] / T), 0, W - 1), clamp(Math.floor(L[1] / T), 0, H - 1)) === cm) L[4] *= 1 - .65 * k; } // abajur baixinho
    lights.push([m.x * T + CAT[m.t].w * T / 2, m.y * T + 10, 40, "255,140,190", .7 * k]);
  }
}

// ---------------- gravidez ----------------
function gvEstagio(t){
  const g = gravidez; if (!g || !g.quem || !g.ini) return 0;
  const d = t - g.ini; if (d < GV_POS) return 0;
  const f = d / GV_DUR; return f < .4 ? 1 : f < .7 ? 2 : 3;
}
function barrigaDe(p){ return gravidez && gravidez.quem === p ? gvEstagio(srvNow()) : 0; }
const avCache = {};
function avDe(id, j){
  const b = barrigaDe(id); if (!b) return j;
  const c = avCache[id]; if (c && c.j === j && c.b === b) return c.v;
  const v = Object.assign({}, j, { barriga: b }); avCache[id] = { j, b, v }; return v;
}
// barriga em pé: de frente cai um pouquinho por cima da cintura; de lado aparece pra frente; de costas, só nos lados
function barrigaEmPe(b, cx, ty, dir, X, col){
  const cL = sh(col, .3), cD = sh(col, -.22);
  if (dir === "left" || dir === "right"){
    R(X(-4, 1), ty + 2, 1, 3, col); if (b >= 2){ R(X(-5, 1), ty + 2, 1, 3, col); P(X(-4, 1), ty + 5, col); }
    if (b >= 3){ R(X(-6, 1), ty + 3, 1, 2, col); P(X(-5, 1), ty + 5, col); }
    P(X(-4, 1), ty + 2, cL); P(X(-3 - b, 1), ty + 4, cD);
  } else if (dir === "up"){
    if (b >= 2){ P(cx - 4, ty + 5, col); P(cx + 3, ty + 5, cD); }
  } else {
    const w = b === 1 ? 4 : b === 2 ? 6 : 8;
    R(cx - w / 2, ty + 5, w, 1, col); R(cx - w / 2 + 1, ty + 6, w - 2, 1, cD);
    R(cx - 2, ty + 2, 2, 1, cL); if (b >= 2) P(cx - 2, ty + 3, cL);
    if (b >= 2){ R(cx - 5 - (b > 2 ? 1 : 0), ty + 3, 1 + (b > 2 ? 1 : 0), 3, col); R(cx + 4, ty + 3, 1 + (b > 2 ? 1 : 0), 3, cD); } // aparece dos lados, por fora dos braços
  }
}
function desejoAtual(){
  const g = gravidez; if (!g || !g.quem || !g.ini) return null;
  const d = srvNow() - g.ini; if (d < GV_POS) return null;
  const bl = Math.floor(d / GV_DESEJO), ks = Object.keys(RECEITAS), rk = ks[hash(salaSeed, bl, 77 + (g.ini % 1000)) % ks.length];
  return { bl, rk, feito: (g.desejos || {})[bl] || null };
}
const nuvemDesejoSpr = () => sprite("nuvemDesejo", 15, 14, (ox, oy) => { rbox(ox, oy, 15, 10, "#FFFFFF"); R(ox + 1, oy + 9, 13, 1, "#E6E2F0"); rbox(ox + 4, oy + 10, 3, 2, "#FFFFFF"); P(ox + 3, oy + 13, "#FFFFFF"); });
function drawDesejo(cx, y, rk, tm){
  const b = Math.round(Math.sin(tm / 400));
  ctx.drawImage(nuvemDesejoSpr().c, cx - 8, y + b); ctx.drawImage(pratoSprite(rk).c, cx - 5, y + 2 + b);
}
const testeSpr = () => sprite("testeFarmacia", 9, 3, (ox, oy) => { R(ox, oy, 9, 3, "#FFFFFF"); R(ox, oy, 3, 3, C.sky); R(ox + 4, oy + 1, 4, 1, "#F4F1FA"); P(ox + 5, oy + 1, "#E8607A"); P(ox + 7, oy + 1, "#E8607A"); R(ox + 3, oy + 2, 6, 1, "#E6E2F0"); });
function testeVisivel(){ const g = gravidez; if (!g || !g.ini) return false; const t = srvNow(); return t >= g.ini + GV_POS && t < g.ini + GV_POS + 24 * HORA; }
function piaDoTeste(){
  const pias = Object.keys(moveis).filter(k => moveis[k].t === "pia").sort();
  return pias.find(k => /banheiro|lavabo|lavanderia/.test(tipoC(comodo(moveis[k].x, moveis[k].y)))) || pias[0] || null;
}
{ const base = MENU_EXTRA.pia; MENU_EXTRA.pia = (id, m) => { const l = base(id, m); if (testeVisivel() && piaDoTeste() === id) l.unshift({ nome: "Olhar o teste de farmácia", info: "🍼", fn: () => toast("Dois risquinhos cor-de-rosa: positivo! 🍼") }); return l; }; }
function avisoPositivo(){
  const g = gravidez; if (!g) return;
  if (!g.quem || g.quem === pid) toastEspecial("Teste positivo! 🍼", g.quem ? "Tem um bebê a caminho. Que notícia!" : "Tem um bebê a caminho! Agora é decidir quem carrega.");
  else toastEspecial("Notícia boa! 🍼", nomeDe(g.quem) + " está esperando um bebê de vocês!");
  confete(); if (me) burst(me.px, me.py, "heart");
}
function openQuem(){
  if (!gravidez || gravidez.quem) return;
  const g = gravidez;
  openPanel("quem", "Quem vai carregar o bebê? 🍼", corpo => {
    corpo.append(el("p", "muted", "Deu positivo! Escolham juntos quem fica com o barrigão. Vale o que for escolhido primeiro."));
    const grade = el("div", "grid2");
    for (const p of [g.a, g.b]){ const b = btn("", "btn ghost escolha", () => escolherQuem(p)); b.append(el("strong", null, p === pid ? "Eu 🤰" : nomeDe(p) + " 🤰"), el("small", null, p === pid ? "Eu carrego" : nomeDe(p) + " carrega")); grade.append(b); }
    const s = btn("", "btn ghost escolha", () => escolherQuem(Math.random() < .5 ? g.a : g.b)); s.append(el("strong", null, "Sorteia 🎲"), el("small", null, "Deixa a sorte decidir")); grade.append(s);
    corpo.append(grade);
    return () => { if (!gravidez || gravidez.quem) closePanel(); };
  });
}
function escolherQuem(p){ if (!gravidez) return; txn("casa/gravidez/quem", c => c ? undefined : p).then(ok => { closePanel(); if (!ok) toast("Já escolheram 😉"); }); }
function vigiarGravidez(){
  const g = gravidez; if (!me || !gvCarregada || !g || !g.ini) return;
  const t = srvNow(), meu = g.a === pid || g.b === pid;
  if (t < g.ini + GV_POS) return; // ainda ninguém sabe
  if (meu && !(g.avisado || {})[pid] && Date.now() - gvTentou > 8000){ gvTentou = Date.now(); txn("casa/gravidez/avisado/" + pid, c => c ? undefined : t).then(ok => { if (ok) avisoPositivo(); }); }
  if (meu && !g.quem && !quemAberto && !painel && (g.avisado || {})[pid]){ quemAberto = true; openQuem(); }
  if (g.quem === pid && t >= g.ini + GV_DUR && Date.now() - nasceuTentou > 10000){ nasceuTentou = Date.now(); nascer(); }
}
function nascer(){
  const g = gravidez; if (!g || g.quem !== pid || bebe) return;
  const ja = jogadores[g.a] || {}, jb = jogadores[g.b] || {}, t = srvNow();
  const pele = Math.round((visual(ja).pele + visual(jb).pele) / 2), cabelo = visual(hash(g.ini | 0, 3, 5) % 2 ? ja : jb).cabelo;
  txn("casa/bebe", cur => cur ? undefined : { nasceu: t, pais: { [g.a]: true, [g.b]: true }, quem: pid, pele, cabelo, fome: t, fralda: t, carinho: t, dormindo: true })
    .then(ok => { if (!ok) return; ref("casa/gravidez").remove().catch(() => {}); statMais("bebes"); garantirBerco(); });
}
function bercoId(){ return Object.keys(todosMoveis).filter(k => todosMoveis[k] && todosMoveis[k].t === "berco").sort()[0] || null; }
// berço no quarto (do lado da cama de casal), se a casa ainda não tiver um
function garantirBerco(){
  if (bercoId()) return;
  // leva 8: prefere a cama de casal do andar onde está quem teve o bebê (antes pegava a primeira da lista, às vezes a do outro andar)
  const camas = Object.values(todosMoveis).filter(m => m && (m.t === "casal" || m.t === "dossel"));
  const cama = camas.find(m => (m.andar || 0) === andarAtual) || camas[0];
  const andar = cama && cama.andar === 1 && temAndar2() ? 1 : 0;
  const pos = noAndar(andar, () => cama && (cama.andar || 0) === andar ? lugarPerto("berco", cama.x + 3, cama.y + 1) : lugarPerto("berco", 3, 3));
  if (!pos){ toast("Não coube um berço. Coloque um no modo Construir."); return; }
  const m = { t: "berco", x: pos[0], y: pos[1] }; if (andar) m.andar = 1;
  ref("casa/moveis").push(m).catch(() => {});
}

// ---------------- bebê ----------------
function coloDe(){ const c = bebe && bebe.colo; return c && jogadores[c] && jogadores[c].online ? c : null; }
function bebeFase(t){ return bebe && t - (bebe.nasceu || t) > BB_CRESCE ? "engatinhando" : "recem"; } // gancho pra crescer
function bebeNeeds(t){
  const b = bebe; if (!b) return null;
  const v = (ts, ms) => clamp(100 - (t - (ts || t)) / ms * 100, 0, 100);
  return { fome: v(b.fome, BB_FOME), fralda: v(b.fralda, BB_FRALDA), carinho: coloDe() ? 100 : v(b.carinho, BB_CARINHO) };
}
function alguemFazendo(re){ return Object.entries(jogadores).some(([k, j]) => { const a = k === pid ? me && me.acao : j.online && j.acao; return a && re.test(a.id || "") && Date.now() - (a.ini || 0) < (a.dur || 0) + 1500; }); }
function bebeEstado(t){
  const n = bebeNeeds(t); if (!n) return null;
  const min = Math.min(n.fome, n.fralda, n.carinho);
  if (min < 25 && !alguemFazendo(/^bebe-(mamadeira|fralda|brincar|ninar)/)) return { k: "chora", n, min };
  if (alguemFazendo(/^bebe-brincar/)) return { k: "feliz", n, min };
  return { k: bebe.dormindo && !coloDe() ? "dorme" : "acordado", n, min };
}
const BB_NOMES = { fome: "Fome", fralda: "Fralda", carinho: "Carinho" };
const BEBE_ACOES = [
  { k: "mamadeira", menu: "Dar mamadeira 🍼", nome: "Dando mamadeira", dur: 6, ganho: { social: 6 }, campo: "fome" },
  { k: "fralda", menu: "Trocar a fralda", nome: "Trocando a fralda", dur: 5, ganho: { social: 3 }, campo: "fralda" },
  { k: "brincar", menu: "Brincar com o bebê", nome: "Brincando com o bebê", dur: 8, ganho: { diversao: 22, social: 10 }, campo: "carinho" },
  { k: "ninar", menu: "Pegar no colo e ninar", nome: "Ninando o bebê", dur: 10, ganho: { social: 12, energia: 3 }, campo: "carinho" },
  { k: "dormir", menu: "Colocar pra dormir", nome: "Colocando pra dormir", dur: 3, ganho: {} }
];
function acaoBebe(a){
  return { id: "bebe-" + a.k, nome: a.nome, dur: a.dur, ganho: a.ganho, junto: ja => /^bebe-/.test(ja.id), juntoMult: 1.3, juntoSocial: 3,
    aoJuntar: (x, oid) => toast("Cuidando junto com " + nomeDe(oid) + " 💞"),
    antes: () => {
      if (!bebe){ toast("Cadê o bebê?"); return false; }
      if (a.k === "mamadeira"){
        if ((despensa.leite || 0) > 0) return mexerDespensa({ leite: -1 }).then(ok => ok || gastar(6, "o leite em pó"));
        if (!gastar(6, "o leite em pó")) return false;
        toast("Sem leite na despensa: leite em pó, -$6."); return true;
      }
      if (a.k === "ninar") return txn("casa/bebe/colo", c => c && c !== pid && jogadores[c] && jogadores[c].online ? undefined : pid)
        .then(ok => { if (!ok){ toast("Alguém pegou o bebê antes 🥰"); return false; } if (bebe) ref("casa/bebe/dormindo").set(false).catch(() => {}); return true; });
      return true;
    },
    fim: () => {
      if (!bebe) return;
      const t = srvNow();
      if (a.campo) ref("casa/bebe/" + a.campo).set(t).catch(() => {});
      if (a.k === "fralda"){ statMais("fraldas"); if (me) for (let i = 0; i < 6; i++) particles.push({ x: me.px * T + 4 + Math.random() * 10, y: me.py * T + Math.random() * 6, vx: Math.random() * 6 - 3, vy: -6 - Math.random() * 6, life: 1.2, kind: "brilho" }); }
      if (a.k === "brincar") sfx("risada");
      if (a.k === "dormir"){ ref("casa/bebe").update({ colo: null, dormindo: true, carinho: t }).catch(() => {}); toast((bebe.nome || "O bebê") + " dormiu 😴"); }
    } };
}
function irPessoa(oid, def){
  const j = jogadores[oid]; if (!j) return;
  const d = disp[oid] || { x: j.x, y: j.y }, ox = Math.round(d.x), oy = Math.round(d.y);
  goTo(null, (x, y) => Math.abs(x - ox) + Math.abs(y - oy) === 1, () => { faceTo(ox, oy); startAcao(def, null, oid); });
}
function irBebe(a){
  if (!bebe || !me) return; closePanel(); closeMenu();
  const def = acaoBebe(a), colo = coloDe(), cr = bercoId();
  if (a.k === "dormir" && colo && colo !== pid){ toast(nomeDe(colo) + " está com o bebê no colo."); return; }
  if (colo === pid){ if (a.k === "dormir" && cr && moveis[cr]) return useFurn(cr, def); return startAcao(def); }
  if (colo){
    const j = jogadores[colo];
    if ((j.andar || 0) !== andarAtual){ toast(nomeDe(colo) + " está com o bebê " + ondeTxt(j.andar || 0) + "."); return; }
    return irPessoa(colo, def);
  }
  if (cr && moveis[cr]) return useFurn(cr, def);
  if (cr){ toast("O berço fica " + ondeTxt(todosMoveis[cr].andar || 0) + "."); return; }
  startAcao(def); // sem berço: cuida ali mesmo
}
CAT.berco = { nome: "Berço", w: 1, h: 1, preco: 180, acoes: [] };
TOP.berco = 8;
Object.assign(FURN_EXTRA, {
  berco(x, y){
    const wd = "#F4EEE6", wD = "#D9CFC4", col = "#9FC3E0", colL = "#C4DDF2";
    rbox(x + 1, y - 7, 14, 9, wd); R(x + 2, y - 6, 12, 1, "#FFFFFF"); R(x + 3, y - 4, 1, 4, wD); R(x + 12, y - 4, 1, 4, wD);
    pixHeart(x + 5, y - 5, "#F7A3B5"); P(x + 6, y - 5, "#FBC9D6");
    R(x + 1, y + 1, 1, 13, wD); R(x + 14, y + 1, 1, 13, wD);
    R(x + 2, y + 1, 12, 9, "#FFFFFF"); R(x + 2, y + 1, 12, 1, "#F4F1FA");
    R(x + 2, y + 5, 12, 5, col); R(x + 2, y + 5, 12, 1, colL); P(x + 4, y + 7, colL); P(x + 9, y + 8, colL); P(x + 12, y + 6, colL); R(x + 2, y + 9, 12, 1, sh(col, -.15));
    R(x + 1, y + 9, 14, 1, wd); R(x + 1, y + 9, 14, 1, "#FFFFFF");
    for (let i = 0; i < 6; i++) R(x + 3 + i * 2, y + 10, 1, 3, wd);
    R(x + 1, y + 13, 14, 1, wd); R(x + 1, y + 14, 14, 1, wD); P(x + 1, y + 15, wD); P(x + 14, y + 15, wD);
  }
});
MENU_EXTRA.berco = id => {
  if (!bebe) return [{ nota: 1, nome: "Berço vazio, esperando alguém 🍼" }];
  const colo = coloDe(), aqui = !colo && bercoId() === id, nm = bebe.nome || "o bebê", l = [];
  if (aqui || colo === pid) for (const a of BEBE_ACOES){
    if (a.k === "dormir" && aqui && bebe.dormindo) continue;
    l.push({ nome: a.k === "ninar" && colo === pid ? "Ninar mais um pouco" : a.menu, info: a.k === "mamadeira" ? ((despensa.leite || 0) > 0 ? "Leite da despensa" : "Leite em pó $6") : "", fn: () => irBebe(a) });
  } else if (colo) l.push({ nota: 1, nome: nomeDe(colo) + " está com " + nm + " no colo 🥰" });
  l.push({ nome: "Ver como " + (bebe.nome ? bebe.nome + " está" : "o bebê está"), fn: openFamilia });
  return l;
};
// arte do bebê: cabecinha com tufinho, olhos (aberto, dormindo com chupeta, chorando com lágrima), trouxinha no colo
function drawBebe(tipo, k, ox, oy, pele, cab, esp){
  const skD = sh(pele, -.16), eye = hexRGB(pele)[0] < 170 ? "#1E1220" : "#3A2433", bl = "rgba(238,96,110,.65)", fe = sh(pele, -.38);
  const cabeca = hx => {
    const hy = oy + 1;
    rbox(hx, hy, 6, 5, pele); P(hx + 5, hy + 3, skD); P(hx + 1, hy + 4, skD);
    P(hx + 2, hy - 1, cab); P(hx + 3, hy - 1, cab); P(hx + 3, hy, cab); P(hx + 2, hy, sh(cab, .25));
    if (k === "dorme"){ P(hx + 1, hy + 2, fe); P(hx + 4, hy + 2, fe); R(hx + 2, hy + 3, 2, 1, "#F7A3B5"); P(hx, hy + 3, bl); P(hx + 5, hy + 3, bl); }
    else if (k === "chora"){ P(hx + 1, hy + 2, fe); P(hx + 4, hy + 2, fe); R(hx + 2, hy + 3, 2, 1, "#9C3E52"); P(hx, hy + 3, "#8FD0EE"); P(hx + 5, hy + 3, "#8FD0EE"); }
    else { P(hx + 1, hy + 2, eye); P(hx + 4, hy + 2, eye); P(hx, hy + 3, bl); P(hx + 5, hy + 3, bl); if (k === "feliz"){ P(hx + 2, hy + 3, "#C0566A"); P(hx + 3, hy + 3, "#C0566A"); } }
  };
  if (tipo === "berco"){ cabeca(ox + 1); P(ox, oy + 6, pele); P(ox + 7, oy + 6, pele); return; }
  const mx = esp ? ox : ox + 4; // trouxinha: manta azul-clarinha com a cabecinha numa ponta
  rbox(mx, oy + 2, 7, 5, "#BFD9F2"); R(mx + 1, oy + 2, 5, 1, "#DCEBF8"); P(mx + 3, oy + 4, "#9FC3E0"); P(mx + (esp ? 1 : 5), oy + 5, "#9FC3E0");
  cabeca(esp ? ox + 5 : ox);
}
function bebeSprite(tipo, k, esp){
  const pele = PELES[idxDe(bebe && bebe.pele, PELES)], cab = CABELOS[idxDe(bebe && bebe.cabelo, CABELOS)];
  return sprite("bb:" + tipo + ":" + k + ":" + pele + ":" + cab + (esp ? ":e" : ""), tipo === "colo" ? 11 : 8, 7, (ox, oy) => drawBebe(tipo, k, ox, oy, pele, cab, esp));
}
const mamadeiraSpr = () => sprite("mamadeira", 3, 6, (ox, oy) => { P(ox + 1, oy, "#F2C48A"); R(ox, oy + 1, 3, 1, C.sky); R(ox, oy + 2, 3, 4, "#FFFFFF"); R(ox, oy + 4, 3, 2, "#FFF4E0"); });
function drawBebeColo(cx, by, dir, pose, tm){
  const est = bebeEstado(srvNow()); if (!est) return;
  const sit = pose.indexOf("sit") === 0, ty = by - (sit ? 7 : 9), mama = alguemFazendo(/^bebe-mamadeira/);
  const bal = alguemFazendo(/^bebe-ninar/) ? Math.round(Math.sin(tm / 300)) : 0; // ninando: balança de leve
  const k = est.k === "dorme" ? "acordado" : est.k;
  if (dir === "up"){ ctx.drawImage(bebeSprite("berco", k).c, cx, ty - 5); bebeView = { x: cx + 4, y: ty - 6, chora: est.k === "chora" }; return; } // cabecinha por cima do ombro
  const esq = dir === "left", dir2 = dir === "right", esp = dir2;
  const x = dir === "down" ? cx - 6 + bal : esq ? cx - 10 : cx - 1;
  ctx.drawImage(bebeSprite("colo", k, esp).c, x, ty + 1);
  if (mama) ctx.drawImage(mamadeiraSpr().c, esp ? x + 4 : x + 5, ty + 2);
  bebeView = { x: esp ? x + 9 : x + 4, y: ty, chora: est.k === "chora" };
}
function addBebeObjs(objs, tm){
  if (!bebe || coloDe()) return;
  const cr = bercoId(), m = cr && moveis[cr]; if (!m) return;
  const x = m.x * T, y = m.y * T, est = bebeEstado(srvNow()); if (!est) return;
  objs.push({ z: (m.y + 1) * T - .8, f: () => {
    const pulo = est.k === "chora" ? Math.floor(tm / 180) % 2 : 0;
    ctx.drawImage(bebeSprite("berco", est.k).c, x + 3, y - 2 - pulo);
    if (alguemFazendo(/^bebe-mamadeira/)) ctx.drawImage(mamadeiraSpr().c, x + 11, y);
    bebeView = { x: x + 8, y: y - 2, chora: est.k === "chora", dorme: est.k === "dorme" };
  } });
}
function addLeva7Objs(objs, tm){
  bebeView = null;
  const t = srvNow();
  for (const g of Object.values(namoros)){
    if (!g || g.estado !== "aceito") continue;
    const m = moveis[g.mov]; if (!m || !NM_GRUPO[m.t]) continue;
    const ali = [g.a, g.b].some(p => { const a = p === pid ? me && me.acao : jogadores[p] && jogadores[p].online && jogadores[p].acao; return a && a.id === "namoro" && a.mov === g.mov; });
    if (!ali) continue;
    const F = nmFase(g, t), f = F ? (F.f === "fim" ? "dep" : F.f) : "esp", z = (m.y + CAT[m.t].h) * T + .5;
    objs.push({ z, f: () => drawCoberta7(m, f, F, tm) });
    if (f === "dur" || f === "dep") for (const [x, y, v] of roupaSpots(g, m)) objs.push({ z: (y + 1) * T - 12, f: () => ctx.drawImage(sujSprite("roupa", v).c, x * T - 1, y * T - 1) });
    if (F && F.f !== "fim") objs.push({ z: 1e9, f: () => { const a = f === "paq" ? F.p * .24 : f === "dur" ? .24 : .24 * (1 - F.p); ctx.fillStyle = "rgba(28,14,48," + a.toFixed(3) + ")"; ctx.fillRect(0, 0, W * T, H * T); } });
  }
  addBebeObjs(objs, tm);
  if (testeVisivel()){ const pk = piaDoTeste(), m = pk && moveis[pk]; if (m) objs.push({ z: (m.y + 1) * T - .4, f: () => ctx.drawImage(testeSpr().c, m.x * T + 3, m.y * T - 4) }); }
}
// por cima de cada bonequinho: bebê no colo, barriga embaixo da coberta, nuvenzinha do desejo
function sobreAvatar7(id, cx, by, dir, pose, deitado, sentado, movT, tm){
  const b = barrigaDe(id);
  if (b && deitado){
    const c = movT === "rede" ? C.rose : BED_BL[movT === "solteiro" ? "solteiro" : "casal"], w = 4 + b * 2, yy = by + (movT === "rede" ? 1 : 6);
    const x0 = cx - w / 2, cO = sh(c, -.45);
    R(x0 + 1, yy - 2, w - 2, 1, cO); P(x0, yy - 1, cO); P(x0 + w - 1, yy - 1, cO); R(x0 - 1, yy, 1, 3, cO); R(x0 + w, yy, 1, 3, cO);
    R(x0 + 1, yy - 1, w - 2, 1, sh(c, .35)); R(x0, yy, w, 3, sh(c, .14)); R(x0 + 1, yy, 2, 1, sh(c, .4)); R(x0, yy + 3, w, 1, sh(c, -.3));
  }
  if (bebe && coloDe() === id && !deitado) drawBebeColo(cx, by, dir, pose, tm);
  if (b && !deitado && gravidez.quem === id){ const dz = desejoAtual(); if (dz && !dz.feito && Math.floor(tm / 6000) % 3 === 0) drawDesejo(cx, by - (sentado ? 37 : 39), dz.rk, tm); }
}
function drawLabels7(mctx, K, fs, tm){
  const v = bebeView; if (!v) return;
  const sx = v.x * K, sy = v.y * K;
  if (v.chora){
    const txt = "buá!", f2 = Math.round(fs * .85); mctx.font = "700 " + f2 + "px Nunito, sans-serif";
    const tw = mctx.measureText(txt).width, bh = f2 * 1.4, bx = clamp(sx - tw / 2 - 5, 2, canvas.width - tw - 12), byy = sy - bh - 6 * K / 4 - Math.abs(Math.sin(tm / 200)) * K;
    mctx.fillStyle = "#FFFFFF"; mctx.beginPath(); if (mctx.roundRect) mctx.roundRect(bx, byy, tw + 10, bh, 6); else mctx.rect(bx, byy, tw + 10, bh); mctx.fill();
    mctx.fillStyle = "#3A6FA8"; mctx.textAlign = "left"; mctx.fillText(txt, bx + 5, byy + bh - f2 * .25); mctx.textAlign = "center";
    mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
  } else if (v.dorme){ mctx.fillStyle = "#CECBF6"; mctx.fillText("z", sx + 6 * K, sy - Math.sin(tm / 400) * K * 1.5); }
}
function vigiarBebe(){
  if (!me || !bbCarregado || !bebe) return;
  if (!bbColoLimpo){ bbColoLimpo = true; if (bebe.colo === pid && !(me.acao && /^bebe-/.test(me.acao.id))) ref("casa/bebe/colo").set(null).catch(() => {}); } // recarregou a página: o bebê volta pro berço
  const est = bebeEstado(srvNow()), chora = !!est && est.k === "chora";
  if (chora && !bbChorava && (bebe.pais || {})[pid]){ const falta = Object.entries(est.n).sort((a, b) => a[1] - b[1])[0][0]; toast((bebe.nome || "O bebê") + " está chorando 😢 " + { fome: "Acho que é fome.", fralda: "Hora de trocar a fralda.", carinho: "Quer um colinho." }[falta]); avisar("bebe", (bebe.nome || "O bebê") + " está chorando 😢"); }
  bbChorava = chora;
}
function leva7Update(dt){
  const t = srvNow(), b = barrigaDe(pid);
  if (b) me.needs.energia = clamp(me.needs.energia - .006 * b * dt, 0, 100); // grávida cansa mais rápido
  // namoro: corações e estrelinhas subindo, o beijo, o toc toc da cabeceira, o balão depois
  for (const [id, g] of Object.entries(namoros)){
    if (!g || g.estado !== "aceito" || !g.ini) continue;
    const m = moveis[g.mov], F = nmFase(g, t); if (!m || !F || F.f === "fim") continue;
    const c = CAT[m.t], wx = m.x * T + c.w * T / 2, wy = m.y * T + (NM_GRUPO[m.t] === "cama" ? 14 : 0);
    nmPart += dt * (F.f === "dur" ? 2.4 : F.f === "paq" ? 1.3 : .8);
    while (nmPart > 1){ nmPart--; particles.push({ x: wx + Math.random() * 22 - 11, y: wy + Math.random() * 6, vx: Math.random() * 6 - 3, vy: -9 - Math.random() * 7, life: 1.8, kind: Math.random() < .65 ? "heart" : "brilho" }); }
    if (F.f === "paq" && F.d > 2300 && !nmBeijou[id]){ nmBeijou[id] = 1; sfx("beijo"); }
    if (F.f === "dur" && NM_GRUPO[m.t] === "cama" && Date.now() - nmSom > 1700){ nmSom = Date.now(); sfx("cabeceira", clamp(1 - Math.hypot(me.px - m.x - 1.5, me.py - m.y - 1.5) / 16, .25, 1) * .8); }
    if (F.f === "dep" && (g.a === pid || g.b === pid) && !nmFalou[id]){ nmFalou[id] = 1; ref("jogadores/" + pid).update({ fala: g.a === pid ? "😏" : "💕", falaAt: TS() }).catch(() => {}); }
  }
  if (!bebe) return;
  // segurando o bebê e foi deitar/sentar em outra coisa: ele volta pro berço
  if (bebe.colo === pid && me.acao && (me.acao.sobre || me.acao.deitar) && !/^bebe-/.test(me.acao.id) && Date.now() - bbVoltou > 5000){ bbVoltou = Date.now(); ref("casa/bebe").update({ colo: null }).catch(() => {}); toast((bebe.nome || "O bebê") + " voltou pro berço."); }
  // chorinho curto, mais baixo longe (só no andar onde ele está)
  if (bbChorava && Date.now() - bbChoroSom > 6000){
    const colo = coloDe(), cr = bercoId(), j = colo && (colo === pid ? { x: me.px, y: me.py, andar: me.andar } : jogadores[colo]), m = !colo && cr && moveis[cr];
    const pos = j && (j.andar || 0) === andarAtual ? [j.x, j.y] : m ? [m.x, m.y] : null;
    if (pos){ bbChoroSom = Date.now(); sfx("choro", clamp(1 - Math.hypot(me.px - pos[0], me.py - pos[1]) / 18, .2, 1) * .8); }
  }
}
function acaoTerminada7(a){
  const r = /^coz-(.+)$/.exec(a.id || "");
  if (r && r[1] !== "ajuda" && gravidez){
    const dz = desejoAtual();
    if (dz && !dz.feito && dz.rk === r[1]) txn("casa/gravidez/desejos/" + dz.bl, c => c ? undefined : pid).then(ok => {
      if (!ok) return; ganhar(25); xpCasal(6);
      toastEspecial("Desejo realizado! 🤤", gravidez && gravidez.quem === pid ? "Era exatamente isso que você queria. +$25" : nomeDe(gravidez.quem) + " vai amar esse prato. +$25");
    });
  }
}
SOCIAL.push({ id: "chute", nome: "Sentir o bebê chutar 🥹", dur: 4, eu: { social: 25, diversao: 10 }, outro: { social: 25 }, txt: "sentiu o bebê chutar", mostrar: id => barrigaDe(id) >= 2 });

// ---------------- painel "Nós": ajustes, gravidez e bebê ----------------
function openNomeBebe(){
  if (!bebe) return;
  openPanel("nome", "Nome do bebê 👶", corpo => {
    const linha = el("div", "nomein"), inp = el("input"), lista = el("div", "list");
    inp.type = "text"; inp.maxLength = 20; inp.placeholder = "Ex.: Luna, Theo, Bia..."; inp.setAttribute("aria-label", "Nome do bebê");
    linha.append(inp, btn("Sugerir", "btn ghost", () => { const v = limpaNome(inp.value); if (!v){ toast("Escreva um nome."); return; } ref("casa/bebe/sugest/" + pid).set(v).then(() => toast("Sugestão enviada 💌")); }), btn("Confirmar", "btn", () => confirmarNome(inp.value)));
    corpo.append(el("p", "muted", "Os dois podem sugerir. O primeiro nome confirmado é o que vale."), linha, lista);
    let sig = null;
    const upd = () => {
      if (!bebe || bebe.nome){ closePanel(); return; }
      const sg = bebe.sugest || {}, k = JSON.stringify(sg); if (k === sig) return; sig = k; lista.textContent = "";
      for (const [p, n] of Object.entries(sg)){ if (!n) continue; const row = el("div", "rowi"), tx = el("div", "tx"); tx.append(el("strong", null, n), el("small", null, "Sugestão de " + (p === pid ? "você" : nomeDe(p)))); row.append(tx, btn("Esse!", "btn small", () => confirmarNome(n))); lista.append(row); }
    };
    upd(); return upd;
  });
}
const limpaNome = v => String(v || "").replace(/\s+/g, " ").trim().slice(0, 20);
function confirmarNome(v){
  v = limpaNome(v); if (!v){ toast("Escreva um nome."); return; } if (!bebe) return;
  txn("casa/bebe/nome", c => c ? undefined : v).then(ok => { closePanel(); if (!ok) toast("Já escolheram: " + ((bebe && bebe.nome) || "") + " 💞"); });
}
function openFamilia(){
  openPanel("familia", "Nós 💞", corpo => { // leva 9: o "Nós" abriga Presentes, Álbum, Nossa história e Datas (nosBotoes9)
    const ajustes = el("div", "list"), gvBox = el("div", "list"), bbBox = el("div", "list"), rodape = el("p", "muted");
    corpo.append(nosBotoes9(), bbBox, gvBox, el("h3", null, "Ajustes"), ajustes, rodape); // leva 9: presentes, álbum, história e datas
    const chave = (txt, sub, on, fn) => { const b = btn("", "btn ghost escolha", fn); b.setAttribute("aria-pressed", String(on)); b.append(el("strong", null, txt + ": " + (on ? "sim" : "não")), el("small", null, sub)); return b; };
    let sig = null;
    const upd = () => {
      const t = srvNow(), g = gravidez, est = bebe ? bebeEstado(t) : null;
      const s = JSON.stringify([romanceOk(pid), bebesOn, g, bebe, stats.namoros || 0, est && est.k, est && Object.values(est.n).map(Math.round), Math.floor(t / 60000)]);
      if (s === sig) return; sig = s;
      ajustes.textContent = "";
      ajustes.append(chave("Aceitar convites românticos", romanceOk(pid) ? "Quem toca em você vê a opção \"Namorar\". Só acontece se você aceitar." : "Ninguém vê a opção \"Namorar\" com você.", romanceOk(pid), () => {
        const on = romanceOk(pid); ref("jogadores/" + pid + "/romance").set(on ? false : null).then(() => toast(on ? "Convites românticos desligados." : "Convites românticos ligados 💞"));
      }));
      ajustes.append(chave("Bebês na casa", bebesOn ? "Namorar sem preservativo pode dar bebê. Vale pra casa toda." : "Desligado: nada de gravidez, nem sem preservativo.", bebesOn, () => {
        const on = bebesOn; ref("casa/bebes").set(on ? false : null).then(() => toast(on ? "Bebês desligados nesta casa." : "Bebês ligados nesta casa 🍼"));
      }));
      rodape.textContent = (stats.namoros ? "Momentos a dois: " + stats.namoros + " 😏 · " : "") + "Cada um escolhe o próprio ajuste romântico.";
      // gravidez (só depois do positivo)
      gvBox.textContent = "";
      if (g && g.ini && t >= g.ini + GV_POS){
        gvBox.append(el("h3", null, "Bebê a caminho 🍼"));
        if (!g.quem){ const row = el("div", "rowi"), tx = el("div", "tx"); tx.append(el("strong", null, "Teste positivo!"), el("small", null, "Falta escolher quem carrega o bebê.")); row.append(tx, btn("Escolher", "btn small", openQuem)); gvBox.append(row); }
        else {
          const est2 = gvEstagio(t), falta = g.ini + GV_DUR - t, row = el("div", "rowi"), tx = el("div", "tx");
          tx.append(el("strong", null, (g.quem === pid ? "Você está" : nomeDe(g.quem) + " está") + " esperando um bebê 🤰"), el("small", null, ["", "Barriguinha aparecendo", "Barrigão", "Reta final"][est2] + " · " + (falta > 0 ? "chega em " + faltaTxt(falta) : "chega a qualquer momento!")));
          const w = el("div", "need"); w.append(barra(clamp((t - g.ini) / GV_DUR * 100, 0, 100), "#F7A3B5")); w.querySelector("i").style.background = "#F7A3B5"; tx.append(w);
          row.append(tx); gvBox.append(row);
          const dz = desejoAtual();
          if (dz){ const r2 = el("div", "rowi"), t2 = el("div", "tx"); t2.append(el("strong", null, "Desejo do momento: " + RECEITAS[dz.rk].nome + " 🤤"), el("small", null, dz.feito ? "Realizado por " + (dz.feito === pid ? "você" : nomeDe(dz.feito)) + " 💞" : "Quem cozinhar ganha +$25. Muda a cada 3 horas.")); const e2 = el("div", "me"); e2.style.gap = "10px"; e2.append(iconeSpr(pratoSprite(dz.rk)), t2); r2.append(e2); gvBox.append(r2); }
          if (g.quem !== pid && est2 >= 2 && jogadores[g.quem] && jogadores[g.quem].online) gvBox.append(btn("Sentir o bebê chutar 🥹", "btn ghost", () => { closePanel(); social(g.quem, SOCIAL.find(s => s.id === "chute")); }));
        }
      }
      // bebê
      bbBox.textContent = "";
      if (bebe){
        const head = el("div", "rowi"), esq = el("div", "me"), tx = el("div", "tx"), cv = el("canvas", "bebeav");
        cv.width = 24; cv.height = 24; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(bebeSprite("berco", est.k).c, 7, 7);
        const colo = coloDe(), fase = bebeFase(t);
        tx.append(el("strong", null, (bebe.nome || "Bebê sem nome") + (fase === "engatinhando" ? " · já engatinha" : "")), el("small", null, { dorme: "Dormindo 😴", acordado: "Acordadinho 👀", chora: "Chorando 😢", feliz: "Rindo à toa 😊" }[est.k] + (colo ? " · no colo de " + (colo === pid ? "você" : nomeDe(colo)) : "") + " · nasceu " + quando(bebe.nasceu)));
        esq.style.gap = "10px"; esq.append(cv, tx); head.append(esq);
        if (!bebe.nome) head.append(btn("Dar nome", "btn small", openNomeBebe));
        bbBox.append(head);
        const nb = el("div", "bbneeds");
        for (const [k, v] of Object.entries(est.n)){ const w = el("div", "need"), r = el("div", "row"); r.append(el("span", null, BB_NOMES[k]), el("span", "v", String(Math.round(v)))); w.append(r, barra(v, "#7FB8E8")); nb.append(w); }
        bbBox.append(nb);
        const acoes = el("div", "grid2");
        for (const a of BEBE_ACOES){
          if (a.k === "dormir" && !(colo === pid || (!colo && !bebe.dormindo))) continue;
          if (a.k === "ninar" && colo && colo !== pid) continue;
          acoes.append(btn(a.menu, "btn ghost", () => irBebe(a)));
        }
        bbBox.append(acoes, el("p", "muted", "Cuidar junto (um nina, o outro dá mamadeira) rende XP do casal. Se ninguém cuidar, o bebê só fica tristinho até alguém chegar."));
      }
    };
    upd();
    let ult = 0; painel.tick = () => { if (Date.now() - ult > 1000){ ult = Date.now(); upd(); } };
    return upd;
  });
}
function renderFamiliaBtn(){
  const b = $("bFamilia"); if (!b) return;
  const g = gravidez, gvOk = g && g.quem && srvNow() >= g.ini + GV_POS, est = bebe && bebeEstado(srvNow());
  const [ic, tx, lbl] = bebe ? [est && est.k === "chora" ? "😢" : "👶", bebe.nome || "Bebê", "Bebê" + (bebe.nome ? " " + bebe.nome : "") + (est && est.k === "chora" ? ", chorando" : "") + ", ajustes"] : gvOk ? ["🤰", "Gravidez", "Gravidez e ajustes"] : ["💞", "Nós", "Nós: ajustes, gravidez e bebê"];
  const i = b.querySelector(".ic"), t = b.querySelector(".tx");
  if (i.textContent !== ic) i.textContent = ic; if (t.textContent !== tx) t.textContent = tx; b.setAttribute("aria-label", lbl);
}
$("bFamilia").onclick = () => openFamilia();
function bannerLeva7(){
  if (!me) return null;
  const conv = Object.entries(namoros).find(([, g]) => g && g.b === pid && g.estado === "convite");
  if (conv){
    const [id, g] = conv;
    return { key: "n" + id, partes: () => { const bb = el("div", "bb"); bb.append(btn("Aceitar", "btn small", () => aceitarNamoro(id)), btn("Agora não", "btn ghost small", () => recusarNamoro(id))); return [el("span", null, nomeDe(g.a) + " te chamou pra namorar " + (NM_LUGAR[g.lugar] || "") + " 😏"), bb]; } };
  }
  const g = gravidez;
  if (g && g.ini && !g.quem && (g.a === pid || g.b === pid) && srvNow() >= g.ini + GV_POS) return { key: "q", partes: () => [el("span", null, "Teste positivo! 🍼 Quem vai carregar?"), btn("Escolher", "btn small", openQuem)] };
  if (bebe && !bebe.nome && (bebe.pais || {})[pid]) return { key: "b", partes: () => [el("span", null, "O bebê chegou e ainda não tem nome 👶"), btn("Dar um nome", "btn small", openNomeBebe)] };
  return null;
}
// teste: adianta a gestação / envelhece as necessidades do bebê (horas)
function gvAvancar(h){ return gravidez ? ref("casa/gravidez/ini").set(gravidez.ini - h * HORA) : null; }
function bbAvancar(h){ if (!bebe) return null; const d = h * HORA; return ref("casa/bebe").update({ fome: (bebe.fome || srvNow()) - d, fralda: (bebe.fralda || srvNow()) - d, carinho: (bebe.carinho || srvNow()) - d }); }
CONQUISTAS.push(
  { id: "namoro1", nome: "Primeira vez a dois", txt: "Um momento só de vocês 😏", st: "namoros", meta: 1 },
  { id: "namoro10", nome: "Fogo no parquinho", txt: "10 momentos a dois.", st: "namoros", meta: 10 },
  { id: "namoroLugar", nome: "Em todos os cômodos", txt: "Namoraram em 3 lugares diferentes da casa.", meta: 3, val: () => ["cama", "banheira", "sofa", "rede"].filter(k => stats["nl_" + k]).length },
  { id: "papais", nome: "Papais de primeira viagem", txt: "O primeiro bebê chegou na casinha.", st: "bebes", meta: 1 },
  { id: "fraldas100", nome: "100 fraldas", txt: "Cem fraldas trocadas com amor.", st: "fraldas", meta: 100 }
);
function leva7Ouvir(){
  on(ref("casa/namoro"), "value", s => aoMudarNamoro(s.val() || {}));
  on(ref("casa/bebes"), "value", s => { bebesOn = s.val() !== false; refreshPanel("familia"); });
  on(ref("casa/gravidez"), "value", s => {
    const ant = gravidez; gravidez = s.val();
    const g = gravidez, meu = g && (g.a === pid || g.b === pid);
    if (gvCarregada && me && g && ant){
      if (g.quem === pid) for (const [k, por] of Object.entries(g.desejos || {})) if (!(ant.desejos || {})[k] && por !== pid){ toast(nomeDe(por) + " realizou seu desejo 🥹"); ganharNeeds({ fome: 30, diversao: 15 }); }
      if (meu && !ant.quem && g.quem) toast(g.quem === pid ? "Combinado: o bebê vem com você 🤰" : nomeDe(g.quem) + " vai carregar o bebê 🤰");
    }
    gvCarregada = true; refreshPanel("familia"); refreshPanel("quem");
  });
  on(ref("casa/bebe"), "value", s => {
    const ant = bebe; bebe = s.val();
    if (bbCarregado && me && bebe && !ant){
      toastEspecial("Nasceu! 👶", "Um bebê novinho chegou na casinha!"); confete(); setTimeout(() => sfx("risada"), 500);
      if ((bebe.pais || {})[pid] && !bebe.nome) setTimeout(() => { if (!painel && bebe && !bebe.nome) openNomeBebe(); }, 4800);
    } else if (bbCarregado && me && bebe && ant && bebe.nome && !ant.nome) toastEspecial("Bem-vindo(a), " + bebe.nome + "! 👶", "Agora é cuidar com carinho.");
    bbCarregado = true; refreshPanel("familia"); refreshPanel("nome");
  });
}
function leva7Reset(){
  namoros = {}; nmCarregado = false; gravidez = null; gvCarregada = false; bebe = null; bbCarregado = false; bebesOn = true;
  nmTx = {}; nmFeito = {}; nmSpots = {}; nmBeijou = {}; nmFalou = {}; quemAberto = false; bbChorava = false; bbColoLimpo = false; bebeView = null;
}
setInterval(() => { if (!me) return; vigiarNamoro(); vigiarGravidez(); vigiarBebe(); renderFamiliaBtn(); }, 1000);
