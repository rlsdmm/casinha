"use strict";
// Casinha · leva 13: família (relações entre cada par, pedido de casamento e cerimônia, filhos que crescem, gêmeos, mais bichinhos)
// Carregado ANTES do 18-laco.js. Ganchos: embrulha addLeva10Objs, drawLabels11, sobreAvatar7, euAt12b, acaoTerminada,
// menuSocial7, bannerLeva7, musicaAtiva, avatarSprite, leva11Ouvir/leva11Reset; o laço chama leva13Pose() (18-laco.js).
// =====================================================================
// LEVA 13 — dados novos:
//   casa/rel/<idA>_<idB> (ids em ordem) = { a, b, amizade -100..100, romance 0..100, status: ""|paquera|namorando|noivos|casados,
//        n (interações), ult, noivosAt?, casadosAt?, anel? }       ids genéricos: jogador (p…), visita, filho (f…) e, no futuro, NPCs
//   casa/pedido/<push> = { tipo: namoro|casamento, de, para, anel?, estado: pedido|aceito|ainda|cancelado|expirou, criado, fimAt }
//   casa/casamento = { a, b, rk, anel, local: sala|quintal|varanda, andar, ax, ay (altar), data, estado: marcado|fim,
//        votos: {pid: texto}, chegou: {pid: ts}, ini (os dois no altar), contado, fimAt }          um casamento por vez
//   casa/sobrenome = "Silva"            sobrenome da casa (opcional, depois de casados)
//   casa/filhos/<fid> = { nome, nasceu, pais, quem, pele, cabelo, estilo, corpo, roupa, gemeo?, (bebê: fome, fralda, carinho, colo, dormindo, sugest)
//        comeu, brincou, estudo, estudoAt, dormirAte, com: {por, tipo, ini, ate, x, y}, festas: {fase: ts}, boletim: {AAAA-MM-DD: nota},
//        tracos: [2] (adolescente), desejos: {bloco: pid} }                                         até FAMILIA.max filhos
//   casa/pets/<id> = { nome, tipo: gato|cachorro|coelho|peixe|passarinho, raca?: mingau, comeu, carinho, limpo (aquário), criado, ... } até 3
//   jogadores/<pid>/anel = modelo (ANEIS) comprado na joalheria · alianca = modelo (casados) · antesCasamento = { traje, acess, roupa }
//   casa/leva13 = ts   migração: casa/bebe → casa/filhos (mesmos dados), casa/pet → casa/pets/pet0 (08-casa.js), casais que já
//        namoravam começam "namorando". casa/bebe e casa/pet de casas antigas: o bebê é copiado com id fixo e o nó antigo apagado.
// Ganchos pras próximas levas: relMudar(a, b, {amizade, romance, status}) e relDe(a, b) aceitam qualquer id (NPC também) ·
//   filhoFase(f), famEstado(fid, t), famPos(fid), FI_ACOES, DES_TEEN · PET13 (tipos de bichinho) · FAMILIA (tempos, máximo, gêmeos, escola)
// Teste: famAvancar(dias) · famHora(h, diaDaSemana) / famHora(null) · L13.gemeos = true · famBoletim() · csAvancar(s) · petsAdotarTeste(tipo)
// =====================================================================
const FAMILIA = { dia: 24 * HORA, tempos: { engatinhando: 7, crianca: 14, adolescente: 30 }, max: 4, gemeos: .1, escola: { ini: 8, fim: 13 }, petsMax: 3, horaTeste: null, diaTeste: null };
const L13 = { gemeos: null };
const FASE_NOME = { bebe: "Bebê", engatinhando: "Engatinhando", crianca: "Criança", adolescente: "Adolescente" };
// relógio de Brasília (UTC-3, sem horário de verão): rotina da escola e de dormir das crianças
function agoraBR(t){
  const d = new Date((t || srvNow()) - 3 * HORA);
  return { h: FAMILIA.horaTeste != null ? FAMILIA.horaTeste : d.getUTCHours() + d.getUTCMinutes() / 60, dw: FAMILIA.diaTeste != null ? FAMILIA.diaTeste : d.getUTCDay(), d };
}
function famHora(h, dw){ FAMILIA.horaTeste = h == null ? null : h; FAMILIA.diaTeste = dw == null ? null : dw; return agoraBR(); }
function filhoFase(f, t){
  if (!f || !f.nasceu) return "bebe";
  const d = ((t || srvNow()) - f.nasceu) / FAMILIA.dia, k = FAMILIA.tempos;
  return d >= k.adolescente ? "adolescente" : d >= k.crianca ? "crianca" : d >= k.engatinhando ? "engatinhando" : "bebe";
}
const ehInfante = f => { const x = filhoFase(f); return x === "bebe" || x === "engatinhando"; };
const ehMaior = f => !!f && !!f.nasceu && !ehInfante(f);
// engatinhando dorme no berço: de noite, ou numa soneca de 2h depois de "colocar pra dormir"
function engDorme(f){ if (!f) return false; const h = agoraBR().h; return h >= 21 || h < 7 || (!!f.dormindo && srvNow() - (f.carinho || 0) < 2 * HORA); }
// visual herdado dos pais: pele no meio das duas, cabelo e penteado de um ou de outro
function visualFilho(ja, jb, seed){
  const va = visual(ja), vb = visual(jb), h = hash(seed | 0, salaSeed, 31);
  return { pele: Math.round((va.pele + vb.pele) / 2 + (va.pele !== vb.pele && h % 2 ? .4 : 0)) % PELES.length, cabelo: (h >>> 2) % 2 ? va.cabelo : vb.cabelo,
    estilo: (h >>> 4) % 2 ? va.estilo : vb.estilo, corpo: ["ela", "ele", "neutro"][(h >>> 6) % 3], roupa: (h >>> 9) % 8 };
}
function famOrdem(){ return Object.keys(filhos).filter(k => filhos[k] && filhos[k].nasceu).sort((a, b) => (filhos[a].nasceu - filhos[b].nasceu) || (a < b ? -1 : 1)); }
const nomeFilho = fid => (filhos[fid] && filhos[fid].nome) || (ehInfante(filhos[fid] || {}) ? "o bebê" : "Sem nome");
function famProxFaseTxt(fid){
  const f = filhos[fid]; if (!f) return "";
  const t = srvNow(), fase = filhoFase(f, t), ord = ["engatinhando", "crianca", "adolescente"], prox = ord[ord.indexOf(fase) + 1] || (fase === "bebe" ? "engatinhando" : null);
  if (!prox) return "";
  const falta = f.nasceu + FAMILIA.tempos[prox] * FAMILIA.dia - t;
  return falta > 0 ? { engatinhando: "Começa a engatinhar", crianca: "Vira criança", adolescente: "Vira adolescente" }[prox] + " em " + faltaTxt(falta) + "." : "";
}
function famSig(){ const a = agoraBR(); return [Math.floor(a.h * 4), a.dw]; }
// teste: envelhece todos os filhos (dias podem ser fracionários)
function famAvancar(dias){ const up = {}; for (const k of famOrdem()) up[k + "/nasceu"] = filhos[k].nasceu - dias * FAMILIA.dia; return Object.keys(up).length ? ref("casa/filhos").update(up) : null; }

// =====================================================================
// 1. RELAÇÕES (casa/rel)
// =====================================================================
let rels = {}, relCarregado = false;
const relKey = (a, b) => a < b ? a + "_" + b : b + "_" + a;
const relDe = (a, b) => rels[relKey(a, b)] || null;
const ehFilhoId = id => !!filhos[id];
const amizadeDe = (a, b) => { const r = relDe(a, b); return r ? +r.amizade || 0 : 0; };
const romanceDe = (a, b) => { const r = relDe(a, b); return r ? +r.romance || 0 : 0; };
const REL_ROM = ["", "paquera", "namorando", "noivos", "casados"];
const ROM_TXT = { paquera: ["Paquera", "😉"], namorando: ["Namorando", "💕"], noivos: ["Noivos", "💍"], casados: ["Casados", "💒"] };
function romRank(a, b){ const r = relDe(a, b); if (!r) return 0; const i = REL_ROM.indexOf(r.status || ""); return i > 0 ? i : (+r.romance || 0) >= 15 ? 1 : 0; }
// romance só entre gente grande que aceita (opção da leva 7) e mora na casa; filhos (e qualquer NPC criança) nunca
function romPermitido(a, b){ if (ehFilhoId(a) || ehFilhoId(b) || a === b) return false; return romanceOk(a) && romanceOk(b); }
function estAmizade(r){
  const a = r ? +r.amizade || 0 : 0;
  if (!r || (!r.n && !a)) return { k: "desconhecido", nome: "Desconhecidos", ic: "❔" };
  if (a <= -30) return { k: "desafeto", nome: "Não se bicam", ic: "😤" };
  if (a < 20) return { k: "conhecido", nome: "Conhecidos", ic: "🙂" };
  if (a < 45) return { k: "amigo", nome: "Amigos", ic: "😊" };
  if (a < 75) return { k: "bomAmigo", nome: "Bons amigos", ic: "🤝" };
  return { k: "melhorAmigo", nome: "Melhores amigos", ic: "💛" };
}
function relMudar(a, b, d){
  if (!a || !b || a === b || !salaRef) return Promise.resolve(false);
  const k = relKey(a, b), x = a < b ? a : b, y = a < b ? b : a, rom = romPermitido(a, b);
  return txn("casa/rel/" + k, cur => {
    const r = Object.assign({ a: x, b: y, amizade: 0, romance: 0, n: 0 }, cur || {});
    r.amizade = clamp(Math.round((+r.amizade || 0) + (d.amizade || 0)), -100, 100);
    r.romance = rom ? clamp(Math.round((+r.romance || 0) + (d.romance || 0)), 0, 100) : (+r.romance || 0);
    if (d.status !== undefined) r.status = d.status || null;
    if (!r.status && rom && r.romance >= 15) r.status = "paquera";
    if (d.set) Object.assign(r, d.set);
    if (!d.semConta) r.n = (r.n || 0) + 1;
    r.ult = srvNow();
    return r;
  });
}
// traço e charme mexem no quanto cada interação rende (só o lado de quem fez)
function relBonus(d){
  const c = 1 + .05 * (habNv("charme") - 1);
  return { amizade: (d.amizade || 0) * c * (temTraco("sociavel") ? 1.25 : 1) * (temTraco("timido") ? .9 : 1), romance: (d.romance || 0) * c * (temTraco("romantico") ? 1.3 : 1) };
}
const REL_SOCIAL = { conversar: { amizade: 4 }, abracar: { amizade: 3, romance: 1 }, dancar: { amizade: 4, romance: 1 }, cocegas: { amizade: 3 }, beijo: { amizade: 1, romance: 5 }, chute: { amizade: 2, romance: 1 },
  flertar: { amizade: 2, romance: 6 }, cafune: { amizade: 5, romance: 2 }, travesseiro: { amizade: 5 }, segredo: { amizade: 7 }, massagem: { amizade: 4, romance: 3 }, dancarLento: { amizade: 2, romance: 5 } };
const nivelAmigo = n => (a, b) => amizadeDe(a, b) >= n;
// ações sociais novas (algumas só a partir de certo nível da relação)
SOCIAL.push(
  { id: "flertar", nome: "Flertar 😉", dur: 4, eu: { social: 20, diversao: 5 }, outro: { social: 20 }, txt: "flertou com você 😉", mostrar: id => romPermitido(pid, id) && romRank(pid, id) < 3 && amizadeDe(pid, id) >= 5 },
  { id: "cafune", nome: "Cafuné 🥰", dur: 6, eu: { social: 25 }, outro: { social: 30, energia: 8 }, txt: "fez cafuné em você 🥰", mostrar: id => nivelAmigo(20)(pid, id) || romRank(pid, id) >= 2 },
  { id: "travesseiro", nome: "Guerra de travesseiro 🪶", dur: 6, eu: { diversao: 25, social: 15 }, outro: { diversao: 25, social: 15 }, txt: "começou uma guerra de travesseiro 🪶", mostrar: id => nivelAmigo(20)(pid, id) },
  { id: "segredo", nome: "Contar um segredo 🤫", dur: 6, eu: { social: 30 }, outro: { social: 30 }, txt: "te contou um segredo 🤫", mostrar: id => nivelAmigo(45)(pid, id) },
  { id: "massagem", nome: "Fazer massagem 💆", dur: 8, eu: { social: 15 }, outro: { social: 20, energia: 15 }, txt: "te fez uma massagem 💆", mostrar: id => nivelAmigo(45)(pid, id) || romRank(pid, id) >= 2 },
  { id: "dancarLento", nome: "Dançar lento 💃", dur: 10, eu: { social: 30, diversao: 20 }, outro: { social: 30, diversao: 20 }, txt: "dançou agarradinho com você 💃", mostrar: id => romPermitido(pid, id) && romRank(pid, id) >= 2 }
);
{ const bj = SOCIAL.find(s => s.id === "beijo"); if (bj) bj.mostrar = id => romPermitido(pid, id) && romRank(pid, id) >= 1; } // beijinho: a partir da paquera
// o que precisa pra destravar (aparece no painel Relações)
const DESTRAVA = [["Flertar 😉", "conhecidos e romance ligado"], ["Beijinho", "paquera"], ["Declarar-se 💌", "romance 35"], ["Cafuné e guerra de travesseiro", "amigos"], ["Contar segredo e massagem", "bons amigos"], ["Dançar lento e namorar", "namorando"], ["Pedir em casamento 💍", "namorando, romance 70 e um anel"]];
{ const f0 = acaoTerminada; acaoTerminada = function(a){
  f0(a);
  try {
    const m = /^s-(.+)$/.exec(a.id || ""); if (m && a.alvo && REL_SOCIAL[m[1]]) relMudar(pid, a.alvo, relBonus(REL_SOCIAL[m[1]]));
    const fi = /^fi-(.+)$/.exec(a.id || ""); if (fi) famAcaoFim(a, fi[1]);
  } catch(e){ console.error(e); }
}; }
// menu da pessoa: "Namorar" só namorando; declarar-se; pedir em casamento; ver a relação
{ const f0 = menuSocial7; menuSocial7 = function(id){
  let it = f0(id);
  if (romRank(pid, id) < 2) it = it.filter(x => x.nome !== "Namorar 😏");
  if (romPermitido(pid, id) && !visitando){
    const r = romRank(pid, id), rom = romanceDe(pid, id), anel = dadosEu().anel;
    if (r < 2 && rom >= 35) it.push({ nome: "Declarar-se 💌", info: "Pedir em namoro", fn: () => pedir(id, "namoro") });
    if (r === 2) it.push(anel && rom >= 70 && ANEIS[anel] ? { nome: "Pedir em casamento 💍", info: ANEIS[anel].nome, fn: () => pedir(id, "casamento") }
      : { nome: "Pedir em casamento 💍", info: rom < 70 ? "Romance " + rom + "/70" : "Falta o anel", fn: () => rom < 70 ? toast("Ainda não é a hora: romance " + rom + "/70 💭") : openJoalheria() });
  }
  it.push({ nome: "Nossa relação", info: (romRank(pid, id) >= 2 ? ROM_TXT[(relDe(pid, id) || {}).status][0] : estAmizade(relDe(pid, id)).nome), fn: () => openRelacoes() });
  return it;
}; }

// =====================================================================
// 2. PEDIDOS (declarar-se e pedir em casamento): o outro responde num painel; recusar não tem punição
// =====================================================================
let pedidos = {}, pdCarregado = false, pdAberto = {}, pdVisto = {};
const PD_TEMPO = 90000;
const pedidoAberto = p => Object.entries(pedidos).find(([, g]) => g && g.estado === "pedido" && (g.de === p || g.para === p)) || null;
function pedir(outro, tipo){
  const j = jogadores[outro];
  if (!j || !j.online){ toast(nomeDe(outro) + " não está na casa agora."); return; }
  if ((j.andar || 0) !== andarAtual){ toast(nomeDe(outro) + " está " + ondeTxt(j.andar || 0) + "."); return; }
  if (pedidoAberto(pid) || pedidoAberto(outro)){ toast("Já tem um pedido no ar 💭"); return; }
  if (tipo === "casamento" && !(ANEIS[dadosEu().anel])){ openJoalheria(); return; }
  const d = disp[outro] || { x: j.x, y: j.y }, ox = Math.round(d.x), oy = Math.round(d.y);
  goTo(null, (x, y) => Math.abs(x - ox) + Math.abs(y - oy) === 1, () => {
    faceTo(ox, oy);
    let id = null;
    startAcao({ id: "pedido-" + tipo, nome: tipo === "casamento" ? "Pedindo " + nomeDe(outro) + " em casamento 💍" : "Se declarando pra " + nomeDe(outro) + " 💌", dur: PD_TEMPO / 1000, ganho: {},
      antes: () => {
        id = ref("casa/pedido").push().key;
        return ref("casa/pedido/" + id).set({ tipo, de: pid, para: outro, anel: tipo === "casamento" ? dadosEu().anel : null, estado: "pedido", criado: srvNow() }).then(() => { sfx("notif"); return true; }, () => false);
      },
      cancel: () => { if (id) txn("casa/pedido/" + id, cur => cur && cur.estado === "pedido" ? Object.assign(cur, { estado: "cancelado", fimAt: srvNow() }) : undefined); } }, null, outro);
  });
}
function responderPedido(id, sim){
  const g0 = pedidos[id]; if (!g0) return;
  txn("casa/pedido/" + id, cur => cur && cur.estado === "pedido" && cur.para === pid ? Object.assign(cur, { estado: sim ? "aceito" : "ainda", fimAt: srvNow() }) : undefined).then(ok => {
    closePanel();
    if (!ok){ toast("Esse pedido já era."); return; }
    const g = g0, cas = g.tipo === "casamento";
    if (!sim){ toast("Tudo bem. Ainda não 💭"); return; }
    relMudar(pid, g.de, { romance: 10, amizade: 5, status: cas ? "noivos" : "namorando", set: cas ? { noivosAt: srvNow(), anel: g.anel || "classico" } : { namoroAt: srvNow() } });
    if (cas){ toastEspecial("Noivos! 💍", "Agora é marcar a data do casamento."); historia("noivos_" + relKey(pid, g.de), "💍", nomeDe(g.de) + " pediu " + nomeEu9() + " em casamento, e foi sim!"); }
    else { toastEspecial("Namorando! 💕", nomeDe(g.de) + " e você agora são um casal."); historia("namoro_" + relKey(pid, g.de), "💕", nomeDe(g.de) + " e " + nomeEu9() + " começaram a namorar"); }
    confete(); sfx("beijo"); xpCasal(cas ? 40 : 15);
  });
}
function openPedido(id){
  const g = pedidos[id]; if (!g || g.estado !== "pedido" || g.para !== pid) return;
  pdAberto[id] = 1;
  const cas = g.tipo === "casamento";
  openPanel("pedido", cas ? "Um pedido de casamento 💍" : "Uma declaração 💌", corpo => {
    if (cas && ANEIS[g.anel]){ const cv = iconeSpr(anelSprite(g.anel)); cv.className = "anel13"; corpo.append(cv); }
    corpo.append(el("p", "pedido13", cas ? nomeDe(g.de) + " se ajoelhou, abriu uma caixinha e perguntou: casa comigo?" : nomeDe(g.de) + " se declarou: quer namorar comigo?"));
    const bb = el("div", "grid2"), sim = btn("", "btn escolha", () => responderPedido(id, true)), nao = btn("", "btn ghost escolha", () => responderPedido(id, false));
    sim.append(el("strong", null, cas ? "Sim! 💍" : "Quero! 💕"), el("small", null, cas ? "Ficamos noivos" : "Começamos a namorar"));
    nao.append(el("strong", null, "Ainda não 💭"), el("small", null, "Sem problema nenhum"));
    bb.append(sim, nao); corpo.append(bb);
    return () => { const x = pedidos[id]; if (!x || x.estado !== "pedido") closePanel(); };
  });
}
function aoMudarPedidos(novo){
  const ant = pedidos; pedidos = novo;
  if (pdCarregado && me) for (const [id, g] of Object.entries(pedidos)){
    if (!g) continue; const a = ant[id];
    if (g.para === pid && g.estado === "pedido" && !a){ sfx("notif"); if (!painel) setTimeout(() => { if (!painel) openPedido(id); }, 1800); }
    if (g.de === pid && a && a.estado === "pedido" && g.estado !== "pedido"){
      if (me.acao && /^pedido-/.test(me.acao.id)){ me.acao.acabou = true; setAcao(null); }
      if (g.estado === "aceito"){
        toastEspecial(g.tipo === "casamento" ? "Disse sim! 💍" : "Topou! 💕", g.tipo === "casamento" ? nomeDe(g.para) + " aceitou casar com você!" : nomeDe(g.para) + " quer namorar com você!");
        confete(); burst(me.px, me.py, "heart");
        if (g.tipo === "casamento") ref("jogadores/" + pid + "/anel").set(null).catch(() => {}); // o anel foi pro dedo
      } else if (g.estado === "ainda") toast(nomeDe(g.para) + " disse: ainda não 💭 Tá tudo bem, tem tempo.");
      else if (g.estado === "expirou") toast(nomeDe(g.para) + " não viu o pedido a tempo.");
    }
  }
  pdCarregado = true; refreshPanel("pedido"); refreshPanel("relacoes");
}
function vigiarPedidos(){
  const t = srvNow();
  for (const [id, g] of Object.entries(pedidos)){
    if (!g) continue;
    if (g.estado === "pedido" && g.de === pid && t - (g.criado || 0) > PD_TEMPO) txn("casa/pedido/" + id, cur => cur && cur.estado === "pedido" ? Object.assign(cur, { estado: "expirou", fimAt: srvNow() }) : undefined);
    else if (g.estado === "pedido" && g.de === pid && !(me.acao && /^pedido-/.test(me.acao.id)) && t - (g.criado || 0) > 4000) txn("casa/pedido/" + id, cur => cur && cur.estado === "pedido" ? Object.assign(cur, { estado: "cancelado", fimAt: srvNow() }) : undefined);
    else if (g.estado !== "pedido" && t - (g.fimAt || g.criado || 0) > 5 * 60000 && (g.de === pid || g.para === pid) && !pdVisto[id]){ pdVisto[id] = 1; ref("casa/pedido/" + id).remove().catch(() => {}); }
    else if (t - (g.criado || 0) > 3 * HORA && !pdVisto[id]){ pdVisto[id] = 1; ref("casa/pedido/" + id).remove().catch(() => {}); }
  }
}

// =====================================================================
// 3. JOALHERIA, ANÉIS, ALIANÇAS E ROUPAS DE CASAMENTO
// =====================================================================
const ANEIS = {
  classico: { nome: "Solitário clássico", preco: 350, aro: "#F6C667", aroD: "#D8963A", pedra: "#EAF6FF", pedraD: "#A9D3F0" },
  coracao:  { nome: "Coração rosé", preco: 550, aro: "#EDB59A", aroD: "#C98E72", pedra: "#F7A3B5", pedraD: "#D9708A" },
  azul:     { nome: "Diamante azul", preco: 900, aro: "#E6EAF0", aroD: "#AAB4C2", pedra: "#7FB8E8", pedraD: "#4E86C8" }
};
function drawAnel(k, ox, oy){
  const a = ANEIS[k] || ANEIS.classico;
  R(ox + 2, oy + 5, 7, 1, a.aro); R(ox + 1, oy + 6, 1, 3, a.aro); R(ox + 9, oy + 6, 1, 3, a.aroD); R(ox + 2, oy + 9, 7, 1, a.aroD); P(ox + 2, oy + 6, a.aro); P(ox + 8, oy + 8, a.aroD);
  if (k === "coracao"){ R(ox + 3, oy + 1, 2, 1, a.pedra); R(ox + 6, oy + 1, 2, 1, a.pedra); R(ox + 3, oy + 2, 5, 1, a.pedra); R(ox + 4, oy + 3, 3, 1, a.pedraD); P(ox + 5, oy + 4, a.pedraD); P(ox + 3, oy + 1, "#FFFFFF"); }
  else { R(ox + 4, oy + 1, 3, 1, a.pedra); R(ox + 3, oy + 2, 5, 1, a.pedra); R(ox + 4, oy + 3, 3, 1, a.pedraD); P(ox + 5, oy + 4, a.aro); P(ox + 4, oy + 1, "#FFFFFF"); if (k === "azul"){ P(ox + 3, oy + 2, a.pedraD); P(ox + 7, oy + 2, "#FFFFFF"); } }
}
const anelSprite = k => sprite("anel13:" + k, 11, 11, (ox, oy) => drawAnel(k, ox, oy));
function openJoalheria(){
  if (visitando){ toast("A joalheria é da sua casa 😉"); return; }
  openPanel("joalheria", "Joalheria 💍", corpo => {
    const lista = el("div", "list"), info = el("p", "muted");
    corpo.append(el("p", "muted", "Pra pedir em casamento: namorando, romance 70 e um anel na caixinha. O anel vira a aliança dos dois."), info, lista);
    const upd = () => {
      const tem = dadosEu().anel; lista.textContent = "";
      info.textContent = tem && ANEIS[tem] ? "Na sua caixinha: " + ANEIS[tem].nome + " 💍" : "Você tem $" + Math.floor(me ? me.dinheiro : 0) + ".";
      for (const [k, a] of Object.entries(ANEIS)){
        const row = el("div", "rowi"), esq = el("div", "me"), tx = el("div", "tx");
        tx.append(el("strong", null, a.nome), el("small", null, "$" + a.preco));
        esq.style.gap = "10px"; esq.append(iconeSpr(anelSprite(k)), tx); row.append(esq);
        const b = btn(tem === k ? "É seu ✓" : "Comprar", tem === k ? "btn ghost small" : "btn small", () => {
          if (tem){ toast("Já tem um anel na caixinha 💍"); return; }
          if (!gastar(a.preco, "o anel")) return;
          ref("jogadores/" + pid + "/anel").set(k).then(() => { toast(a.nome + " na caixinha 💍 Agora é escolher a hora certa."); sfx("moeda"); }, () => { ganhar(a.preco); toast("Não deu pra comprar agora."); });
        });
        b.disabled = !!tem; b.setAttribute("aria-label", (tem === k ? "Seu anel: " : "Comprar ") + a.nome + " por $" + a.preco); row.append(b); lista.append(row);
      }
    };
    upd(); return upd;
  });
}
// roupas: vestido de noiva e terno de noivo (livres pros noivos/casados, qualquer corpo), véu e aliança
const R_BRANCO = ROUPAS.length; ROUPAS.push("#FBF7F0");
const TJ_NOIVA = TRAJES.length, TJ_NOIVO = TJ_NOIVA + 1; TRAJES.push({ nome: "Vestido de noiva", casamento: 1 }, { nome: "Terno de noivo", casamento: 1 });
const AC_VEU = ACESS.length; ACESS.push({ nome: "Véu de noiva", casamento: 1 });
const roupaCasamentoLiberada = () => Object.values(rels).some(r => r && (r.a === pid || r.b === pid) && (r.status === "noivos" || r.status === "casados"));
function vRoupa13(v){ // o vestido é o de festa (7) em branco; o terno de noivo é o terno (8) escuro
  if (v.traje === TJ_NOIVA) return Object.assign({}, v, { traje: 7, roupa: R_BRANCO });
  if (v.traje === TJ_NOIVO) return Object.assign({}, v, { traje: 8, roupa: 7 });
  return v;
}
{ const f0 = avatarSprite; avatarSprite = function(p, dir, frame, pose){
  const al = p && p.alianca && ANEIS[p.alianca] ? p.alianca : "";
  if (!p || (p.traje !== TJ_NOIVA && p.traje !== TJ_NOIVO && !al)) return f0(p, dir, frame, pose);
  const v0 = visual(p), v = vRoupa13(v0);
  const key = ["av13", v0.traje, v.corpo, v.roupa, v.traje, v.cabelo, v.estilo, v.pele, v.barba, v.acess, v.barriga, v.forma, v.altura, v.fisico, dir, frame, pose, al].join(":");
  return sprite(key, 16, 29, (ox, oy) => { drawAvatarLocal(v, ox + 8, oy + 27, dir, frame, pose); if (al) anelNaMao(v, ox + 8, oy + 27, dir, frame, String(pose || "stand"), al); });
}; }
{ const f0 = retrato; retrato = function(v, ...r){ return f0(v ? vRoupa13(v) : v, ...r); }; }
// aliança: um pontinho dourado na mão esquerda (em pé, de frente e de lado)
function anelNaMao(v, cx, by, dir, frame, pose, k){
  if (pose.indexOf("sit") === 0 || pose.indexOf("lie") === 0 || pose === "arms" || dir === "up") return;
  const g = corpoGeo(v), walk = frame === 1 || frame === 3, bob = pose.indexOf("breath") >= 0 ? 1 : walk ? -1 : 0, ty = by - 9 + bob - g.dh, cor = ANEIS[k].aro;
  if (dir === "down"){ const aL = frame === 1 ? -1 : frame === 3 ? 1 : 0; P(cx - g.ax, ty + 4 + aL, cor); }
  else { const sw = frame === 1 ? 1 : frame === 3 ? -1 : 0; P(dir === "right" ? cx - 1 + sw : cx - 1 - sw, ty + 4, cor); }
}
// véu: tiara com florzinha e o tule caindo atrás
{ const f0 = acessLeva6; acessLeva6 = function(a, cx, hy, dir, v){
  if (a !== AC_VEU) return f0(a, cx, hy, dir, v);
  const tu = "#F4F1FA", tuD = "#DCD6EA", side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (q, w) => m > 0 ? cx + q : cx - q - w;
  const y = v.estilo === 8 ? hy - 5 : v.estilo === 3 || v.estilo === 9 ? hy - 4 : hy - 3;
  if (dir === "up"){ R(cx - 5, y + 1, 10, 11, tu); R(cx - 5, y + 11, 10, 1, tuD); R(cx + 3, y + 2, 2, 9, tuD); }
  else if (side){ R(X(1, 4), y + 1, 4, 11, tu); R(X(4, 1), y + 2, 1, 10, tuD); }
  else { R(cx - 6, y + 2, 1, 9, tu); R(cx + 5, y + 2, 1, 9, tuD); }
  R(cx - 4, y, 8, 1, "#FFFFFF"); P(cx - 1, y - 1, "#F9B8CC"); P(cx, y - 1, "#F9B8CC"); P(cx, y, "#F6C667");
}; }
{ const f0 = itemPago; itemPago = function(campo, i, it){
  if (it && it.casamento && !roupaCasamentoLiberada()) return { nome: it.nome + " 💍", on: creator[campo] === i, off: true, tit: "Libera quando ficarem noivos", fn: () => {} };
  return f0(campo, i, it);
}; }
{ const g0 = $("cGo").onclick; $("cGo").onclick = () => {
  const v = visual(creator);
  if ([TRAJES[v.traje], ACESS[v.acess]].some(x => x && x.casamento) && !roupaCasamentoLiberada()){ toast("Roupa de casamento libera quando ficarem noivos 💍"); return; }
  g0();
}; }
function vestirCasamento(qual){
  const d = dadosEu(); if (!me || visitando) return;
  const up = {};
  if (qual === "voltar"){ const a = d.antesCasamento; if (!a){ toast("Você já está com a sua roupa 😉"); return; } Object.assign(up, { traje: a.traje | 0, acess: a.acess | 0, roupa: a.roupa | 0, antesCasamento: null }); }
  else {
    if (!d.antesCasamento) up.antesCasamento = { traje: d.traje | 0, acess: d.acess | 0, roupa: d.roupa | 0 };
    if (qual === "vestido"){ up.traje = TJ_NOIVA; up.acess = AC_VEU; } else { up.traje = TJ_NOIVO; if (d.acess === AC_VEU) up.acess = 0; }
  }
  ref("jogadores/" + pid).update(up).then(() => toast(qual === "voltar" ? "De volta à roupa de antes." : qual === "vestido" ? "Que noiva linda 👰" : "Que elegância 🤵"));
}

// =====================================================================
// 4. CASAMENTO (casa/casamento)
// =====================================================================
let casamento = null, csCarregado = false, csTx = {}, csFeito = {}, sobrenome = "", csFalou = {};
const CS = { entrada: 9000, voto: 4500, beijo: 6000, festa: 24000, espera: 20 * 60000 };
const VOTO_PADRAO = "Prometo te amar e cuidar de você todos os dias 💞";
const LOCAIS = { sala: { nome: "Sala", ic: "🛋️", andar: 0 }, quintal: { nome: "Quintal", ic: "🌳", andar: 0 }, varanda: { nome: "Varanda", ic: "🌇", andar: 1 } };
function localOk(k){ return k === "sala" || (k === "quintal" && temQuintal()) || (k === "varanda" && temAndar2()); }
function pedacos(txt, n){
  const ws = String(txt || "").replace(/\s+/g, " ").trim().split(" "), out = []; let cur = "";
  for (const w of ws){ if (!w) continue; if ((cur + " " + w).trim().length > n && cur){ out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) out.push(cur); return out.slice(0, 7);
}
function csPartes(c){
  const v = c.votos || {}, va = pedacos(v[c.a] || VOTO_PADRAO, 22), vb = pedacos(v[c.b] || VOTO_PADRAO, 22);
  const t0 = CS.entrada, tA = t0 + va.length * CS.voto, tB = tA + vb.length * CS.voto, tK = tB + CS.beijo;
  return { va, vb, t0, tA, tB, tK, tFim: tK + CS.festa };
}
function csFase(t){
  const c = casamento; if (!c || !c.ini) return null;
  const p = csPartes(c), d = (t || srvNow()) - c.ini; if (d < 0) return null;
  if (d < p.t0) return { f: "entrada", d, p };
  if (d < p.tA) return { f: "votoA", i: Math.floor((d - p.t0) / CS.voto), d, p };
  if (d < p.tB) return { f: "votoB", i: Math.floor((d - p.tA) / CS.voto), d, p };
  if (d < p.tK) return { f: "beijo", d: d - p.tB, p };
  if (d < p.tFim) return { f: "festa", d: d - p.tK, p };
  return { f: "fim", d, p };
}
const csAtivo = () => { const F = csFase(); return !!F && F.f !== "fim"; };
const csNoivo = p => !!casamento && (casamento.a === p || casamento.b === p);
const csHora = () => !!casamento && casamento.estado === "marcado" && srvNow() >= (casamento.data || 0);
function csCadeiras(c){
  const l = [];
  for (const dy of [2, 3]) for (const dx of [-2, -1, 1, 2]) l.push([c.ax + dx, c.ay + dy]);
  return l.filter(([x, y]) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && MAP[y] && MAP[y][x] === 0);
}
// altar: um quadrado com os dois lados livres (os noivos ficam um de cada lado) e espaço pras cadeiras na frente
function altarPara(local){
  const L = LOCAIS[local]; if (!L) return null;
  return noAndar(L.andar, () => {
    const no = (x, y) => local === "quintal" ? y > HC : local === "varanda" ? comodo(x, y) === "varanda" : y < HC && (comodo(x, y) === "sala" || casaZero);
    const tiles = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (no(x, y) && walkable(x, y)) tiles.push([x, y]);
    if (!tiles.length) return null;
    const mx = tiles.reduce((s, p) => s + p[0], 0) / tiles.length, my = tiles.reduce((s, p) => s + p[1], 0) / tiles.length;
    let best = null;
    for (const [x, y] of tiles){
      if (!walkable(x - 1, y) || !walkable(x + 1, y) || !no(x - 1, y) || !no(x + 1, y)) continue;
      if ([-1, 0, 1].some(dx => occ[y - 1] && occ[y - 1][x + dx])) continue; // o arco não fica atrás de móvel
      let livres = 0; for (const dy of [1, 2, 3]) for (const dx of [-2, -1, 0, 1, 2]) if (walkable(x + dx, y + dy) && no(x + dx, y + dy)) livres++;
      const sc = livres * 10 - Math.hypot(x - mx, y - my) * 2 - (y > my + 1 ? 15 : 0);
      if (!best || sc > best.sc) best = { x, y, sc };
    }
    return best ? { andar: L.andar, x: best.x, y: best.y } : null;
  });
}
function proxVinte(){ const a = agoraBR(), t = srvNow(); let h = 20 - a.h; if (h <= .25) h += 24; return t + h * HORA; }
function openCasamento(){
  const r = Object.values(rels).find(x => x && (x.a === pid || x.b === pid) && (x.status === "noivos" || x.status === "casados"));
  if (!r){ toast("Primeiro, um pedido de casamento 💍"); return; }
  const outro = r.a === pid ? r.b : r.a, rk = relKey(pid, outro);
  openPanel("casamento", "Nosso casamento 💒", corpo => {
    const topo = el("div", "list"), cfg = el("div"), vot = el("div"), roupas = el("div"), sob = el("div");
    corpo.append(topo, cfg, vot, roupas, sob);
    let esc = { local: "sala", quando: "agora" }, sig = null;
    const upd = () => {
      const c = casamento, meu = c && c.rk === rk && c.estado !== "fim", rr = rels[rk] || r, cas = rr.status === "casados";
      const s = JSON.stringify([c, rr.status, esc, sobrenome, dadosEu().traje, !!dadosEu().antesCasamento]); if (s === sig) return; sig = s;
      topo.textContent = ""; cfg.textContent = ""; vot.textContent = ""; roupas.textContent = ""; sob.textContent = "";
      if (cas){
        topo.append(el("p", null, "Vocês são casados desde " + quando(rr.casadosAt || rr.ult || srvNow()) + " 💒"));
        const inp = el("input"), linha = el("div", "nomein"); inp.type = "text"; inp.maxLength = 24; inp.placeholder = "Ex.: Silva, Moreira…"; inp.value = sobrenome; inp.setAttribute("aria-label", "Sobrenome da casa");
        linha.append(inp, btn("Salvar", "btn", () => { const v = limpaNome(inp.value).slice(0, 24); ref("casa/sobrenome").set(v || null).then(() => toast(v ? "Agora é a família " + v + " 🏡" : "Sem sobrenome na casa.")); }));
        sob.append(el("h3", null, "Sobrenome da casa (opcional)"), linha);
        return;
      }
      if (c && !meu && c.estado !== "fim"){ topo.append(el("p", "muted", "Já tem um casamento marcado na casa (" + nomeDe(c.a) + " e " + nomeDe(c.b) + "). Depois dele é a vez de vocês 💞")); return; }
      if (meu){
        const L = LOCAIS[c.local] || LOCAIS.sala, row = el("div", "rowi"), tx = el("div", "tx");
        tx.append(el("strong", null, "Marcado: " + L.ic + " " + L.nome), el("small", null, srvNow() >= c.data ? "Chegou a hora! Os dois no altar e a cerimônia começa." : "Começa em " + faltaTxt(c.data - srvNow())));
        row.append(tx); topo.append(row);
        const bb = el("div", "hbtns");
        if (srvNow() >= c.data && !(c.chegou || {})[pid]) bb.append(btn("Ir pro altar 💒", "btn", () => { closePanel(); irAltar(); }));
        if (!c.ini) bb.append(btn("Desmarcar", "btn ghost", () => txn("casa/casamento", cur => cur && cur.rk === rk && !cur.ini ? null : undefined).then(ok => toast(ok ? "Casamento desmarcado. Fica pra outro dia 💭" : "Agora não dá pra desmarcar."))));
        topo.append(bb);
        // votos (cada um escreve o seu; o outro só vê na hora)
        const v = (c.votos || {})[pid] || "", ta = el("textarea", "votos13"); ta.maxLength = 140; ta.rows = 3; ta.value = v; ta.placeholder = "Seus votos (até 140 letras). Aparecem em balões na cerimônia."; ta.setAttribute("aria-label", "Seus votos");
        const ok2 = (c.votos || {})[outro] ? nomeDe(outro) + " já escreveu os votos 💌" : nomeDe(outro) + " ainda não escreveu os votos.";
        vot.append(el("h3", null, "Votos"), ta, btn("Guardar meus votos", "btn ghost", () => {
          const tx2 = String(ta.value || "").replace(/\s+/g, " ").trim().slice(0, 140);
          ref("casa/casamento/votos/" + pid).set(tx2 || null).then(() => toast(tx2 ? "Votos guardados 💌" : "Sem votos: vale o padrão."), () => toast("Não deu pra guardar."));
        }), el("p", "muted", ok2));
      } else {
        cfg.append(el("h3", null, "Onde?"));
        const g = el("div", "grid2");
        for (const [k, L] of Object.entries(LOCAIS)){
          const b = btn("", "btn ghost escolha", () => { esc.local = k; sig = null; upd(); }); b.setAttribute("aria-pressed", String(esc.local === k));
          b.append(el("strong", null, L.ic + " " + L.nome), el("small", null, localOk(k) ? (k === "varanda" ? "No 2º andar" : "Com arco de flores") : k === "quintal" ? "Precisa do quintal" : "Precisa do 2º andar")); b.disabled = !localOk(k); g.append(b);
        }
        cfg.append(g, el("h3", null, "Quando?"));
        const g2 = el("div", "grid2");
        for (const [k, n, sub] of [["agora", "Agora 💨", "Assim que os dois chegarem no altar"], ["1h", "Daqui a 1 hora", "Dá tempo de chamar os amigos"], ["20h", "Às 20h", "Hora de Brasília"]]){
          const b = btn("", "btn ghost escolha", () => { esc.quando = k; sig = null; upd(); }); b.setAttribute("aria-pressed", String(esc.quando === k)); b.append(el("strong", null, n), el("small", null, sub)); g2.append(b);
        }
        cfg.append(g2, btn("Marcar o casamento 💒", "btn", () => marcarCasamento(rk, outro, esc)));
      }
      roupas.append(el("h3", null, "Roupa de casamento"));
      const h = el("div", "hbtns"), tj = dadosEu().traje;
      h.append(btn(tj === TJ_NOIVA ? "Vestido ✓" : "Vestir vestido de noiva 👰", "btn ghost", () => vestirCasamento("vestido")), btn(tj === TJ_NOIVO ? "Terno ✓" : "Vestir terno de noivo 🤵", "btn ghost", () => vestirCasamento("terno")));
      if (dadosEu().antesCasamento) h.append(btn("Voltar à roupa de antes", "btn ghost", () => vestirCasamento("voltar")));
      roupas.append(h, el("p", "muted", "Vestido, terno e véu ficam liberados no espelho pros dois."));
    };
    upd(); let ult = 0; painel.tick = () => { if (Date.now() - ult > 1000){ ult = Date.now(); upd(); } }; return upd;
  });
}
function marcarCasamento(rk, outro, esc){
  if (!localOk(esc.local)){ toast("Esse lugar ainda não existe na casa."); return; }
  const al = altarPara(esc.local); if (!al){ toast("Não coube o altar aí. Liberem um espacinho 😅"); return; }
  const data = esc.quando === "agora" ? srvNow() : esc.quando === "1h" ? srvNow() + HORA : proxVinte();
  const a = pid < outro ? pid : outro, b = pid < outro ? outro : pid, r = rels[rk] || {};
  txn("casa/casamento", cur => cur && cur.estado !== "fim" && cur.rk !== rk ? undefined : { a, b, rk, anel: r.anel || "classico", local: esc.local, andar: al.andar, ax: al.x, ay: al.y, data, estado: "marcado", criado: srvNow(), votos: cur && cur.rk === rk ? cur.votos || null : null })
    .then(ok => { if (!ok){ toast("Já tem outro casamento marcado na casa."); return; } toast(esc.quando === "agora" ? "Casamento marcado: agora! Bora pro altar 💒" : "Casamento marcado 💒"); sfx("notif"); historia("casamentoMarcado_" + rk, "💒", nomeDe(a) + " e " + nomeDe(b) + " marcaram o casamento"); });
}
function irAltar(){
  const c = casamento; if (!c || !csNoivo(pid)) return;
  if ((c.andar || 0) !== andarAtual){ toast("O altar fica " + ondeTxt(c.andar || 0) + "."); return; }
  const x = c.a === pid ? c.ax - 1 : c.ax + 1, y = c.ay;
  goTo(null, (xx, yy) => xx === x && yy === y, () => {
    me.dir = c.a === pid ? "right" : "left"; savePos();
    startAcao({ id: "cas-altar", nome: "No altar 💒", dur: 900, ganho: { social: 20, diversao: 10 },
      antes: () => { ref("casa/casamento/chegou/" + pid).set(srvNow()).catch(() => {}); return true; } });
  });
}
function assistirCasamento(){
  const c = casamento; if (!c) return;
  if ((c.andar || 0) !== andarAtual){ toast("O casamento é " + ondeTxt(c.andar || 0) + "."); return; }
  const ocup = new Set(Object.entries(jogadores).filter(([k, j]) => k !== pid && j.online && j.acao && j.acao.id === "cas-assistir").map(([, j]) => j.x + "," + j.y));
  const cad = csCadeiras(c).filter(([x, y]) => !ocup.has(x + "," + y) && walkable(x, y));
  if (!cad.length){ toast("As cadeiras estão todas ocupadas 😅 Dá pra ver de pé."); return; }
  goTo(null, (x, y) => cad.some(q => q[0] === x && q[1] === y), () => {
    me.dir = "up"; savePos();
    startAcao({ id: "cas-assistir", nome: "Assistindo o casamento 💒", dur: 900, ganho: { social: 25, diversao: 20 } });
  });
}
// 1x por segundo: começa a cerimônia, votos em balões, beijo, festa e fim
function vigiarCasamento(){
  const c = casamento; if (!c || !me) return;
  const t = srvNow(), noivo = csNoivo(pid), ch = c.chegou || {};
  if (c.estado === "marcado" && !c.ini && noivo && ch[c.a] && ch[c.b] && !csTx.ini){ csTx.ini = 1; txn("casa/casamento/ini", v => v ? undefined : srvNow()).then(() => { csTx.ini = 0; }); }
  if (c.estado === "fim"){ if (me.acao && /^cas-/.test(me.acao.id)){ me.acao.acabou = true; setAcao(null); } if (noivo && t - (c.fimAt || 0) > 5 * 60000) txn("casa/casamento", cur => cur && cur.estado === "fim" ? null : undefined); return; }
  // ninguém apareceu no altar por muito tempo: o convite expira (sem punição)
  if (!c.ini && noivo && t - (c.data || 0) > CS.espera && !Object.keys(ch).length){ txn("casa/casamento", cur => cur && !cur.ini && cur.rk === c.rk ? null : undefined).then(ok => { if (ok) toast("O casamento ficou pra outro dia 💭"); }); return; }
  const F = csFase(t); if (!F) return;
  const k = c.ini + ":";
  if (noivo){
    const lado = c.a === pid ? "votoA" : "votoB", lista = c.a === pid ? F.p.va : F.p.vb;
    if (F.f === lado && !csFalou[k + F.i]){ csFalou[k + F.i] = 1; ref("jogadores/" + pid).update({ fala: lista[F.i] || "💞", falaAt: TS() }).catch(() => {}); }
    if (F.f === "beijo" && !csFalou[k + "bj"]){ csFalou[k + "bj"] = 1; ref("jogadores/" + pid).update({ fala: "Sim! 💍", falaAt: TS() }).catch(() => {}); }
    if ((F.f === "beijo" || F.f === "festa") && !csFeito[k + "al"]){ csFeito[k + "al"] = 1; ref("jogadores/" + pid + "/alianca").set(c.anel || "classico").catch(() => {}); }
  }
  if (F.f === "entrada" && !csFeito[k + "in"]){ csFeito[k + "in"] = 1; if (noivo || (me.acao && me.acao.id === "cas-assistir")) toast("A cerimônia começou 💒"); }
  if ((F.f === "beijo" && F.d > 1500 || F.f === "festa") && !csFeito[k + "sim"]){
    csFeito[k + "sim"] = 1;
    if ((c.andar || 0) === andarAtual){ confete(); for (const p of [c.a, c.b]){ const d = p === pid ? { x: me.px, y: me.py } : disp[p]; if (d) burst(d.x, d.y, "heart"); } }
    toastEspecial("Casados! 💍", nomeDe(c.a) + " e " + nomeDe(c.b) + " disseram sim!"); sfx("beijo");
    const dono = [c.a, c.b].find(p => jogadores[p] && jogadores[p].online) || c.a;
    if (dono === pid) txn("casa/casamento/contado", v => v ? undefined : srvNow()).then(ok => {
      if (!ok) return;
      relMudar(c.a, c.b, { romance: 15, amizade: 5, status: "casados", set: { casadosAt: srvNow() }, semConta: 1 });
      statMais("casamentos"); xpCasal(60);
      historia("casamento_" + c.ini, "💒", nomeDe(c.a) + " e " + nomeDe(c.b) + " se casaram " + ((LOCAIS[c.local] || {}).nome ? "na " + LOCAIS[c.local].nome.toLowerCase() : "em casa") + " 💍");
      setTimeout(() => { if ((c.andar || 0) === andarAtual) fotoCasamento(c); }, 2200);
      setTimeout(checarConquistas, 3000);
    });
  }
  if (F.f === "fim" && noivo && c.estado !== "fim"){ txn("casa/casamento", cur => cur && cur.ini === c.ini && cur.estado !== "fim" ? Object.assign(cur, { estado: "fim", fimAt: srvNow() }) : undefined); }
  if (F.f === "fim" && me.acao && /^cas-/.test(me.acao.id)){ me.acao.acabou = true; setAcao(null); }
}
function csAvancar(s){ return casamento && casamento.ini ? ref("casa/casamento/ini").set(casamento.ini - s * 1000) : casamento ? ref("casa/casamento/data").set(srvNow() - 1000) : null; }
// foto automática no álbum (quem fecha o casamento tira, vendo a cena)
function fotoCasamento(c){
  if (!me || mode !== "live") return;
  try { draw(performance.now()); } catch(e){}
  const w = lo.width, h = lo.height, pad = 5, base = 13, cv = document.createElement("canvas"); cv.width = w + pad * 2; cv.height = h + pad + base;
  const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  withCtx(x, 1, () => { R(0, 0, cv.width, cv.height, "#FFF8EC"); ctx.drawImage(lo, pad, pad); const d = new Date(srvNow()); txt3(pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(), pad + 1, h + pad + 4, "#8C7A9A"); pixHeart(cv.width - pad - 6, h + pad + 4, "#E8607A"); pixHeart(cv.width - pad - 13, h + pad + 4, "#F6C667"); });
  const f = el("div", "flash9"); $("stage").append(f); setTimeout(() => f.remove(), 500); sfx("foto");
  const url = codificarFoto(cv); if (!url) return;
  const l = fotosOrdem();
  guardarFoto(url, cv.width, cv.height, "Nosso casamento 💍 " + nomeDe(c.a) + " e " + nomeDe(c.b), l.length >= ALBUM_MAX ? l[l.length - 1][0] : undefined);
}
// música própria da cerimônia (toca do altar enquanto a cerimônia dura; também fica no toca-discos)
FAIXAS.push({ id: "casamento", nome: "Marcha dos Noivos", desc: "Pra entrar no altar de mãos dadas", bpm: 72, inst: "piano", batida: 0,
  acordes: [[48, [60, 64, 67, 72]], [53, [60, 65, 69, 72]], [55, [59, 62, 67, 71]], [48, [55, 60, 64, 67]]], escala: [60, 62, 64, 67, 69, 72, 74, 76] });
{ const fx = FAIXAS[FAIXAS.length - 1], i = FAIXAS.length - 1; fx.mel = [];
  for (let s = 0; s < 64; s++){ const bar = Math.floor(s / 8), pos = s % 8, se = bar >= 4 && bar < 6 ? s - 32 : s, h = hash(i + 11, se, 733), ch = pos === 0 ? 62 : pos % 2 ? 14 : 40;
    fx.mel.push(h % 100 >= ch || (bar % 4 === 3 && pos >= 6) ? null : { m: fx.escala[2 + (h >>> 8) % 5], d: 1 + (h >>> 13) % 3 }); } }
{ const f0 = musicaAtiva; musicaAtiva = function(){
  const c = casamento;
  if (c && c.ini && csAtivo()) return { fx: FAIXAS.find(f => f.id === "casamento"), desde: c.ini, mov: null, por: c.a, andar: c.andar || 0, m: { x: c.ax, y: c.ay, andar: c.andar || 0 }, jantar: false };
  return f0();
}; }

// =====================================================================
// 5. FILHOS QUE CRESCEM (casa/filhos): bebê → engatinhando → criança → adolescente
// =====================================================================
// ---- arte: criança e adolescente em pixel art chibi (mesmo contorno automático dos bonecos) ----
const lookFilho = f => ({ pele: idxDe(f.pele, PELES), cabelo: idxDe(f.cabelo, CABELOS), estilo: idxDe(f.estilo, ESTILOS), corpo: f.corpo === "ela" || f.corpo === "ele" ? f.corpo : "neutro", roupa: (f.roupa | 0) % 8 });
const CAB_LONGO = new Set([1, 2, 6, 7]);
// cx = meio, by = linha dos pés. Criança: ~16 px de altura; adolescente: ~20 (adulto: ~27)
function drawKid(teen, L, cx, by, dir, frame, pose, mochila){
  const skin = PELES[L.pele], skD = sh(skin, -.16), hair = CABELOS[L.cabelo], hL = sh(hair, .28), cor = ROUPAS[L.roupa], corD = sh(cor, -.24), corL = sh(cor, .25);
  const ink = "#2E2638", shoe = "#F1EDF7", ela = L.corpo === "ela", longo = CAB_LONGO.has(L.estilo) || ela, calca = teen ? "#56609E" : ela ? sh(cor, .4) : "#56609E";
  const side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  const walk = frame === 1 || frame === 3, bob = pose === "jump" ? 0 : walk ? -1 : 0, braco = pose === "arms" || pose === "jump";
  const lh = teen ? 4 : 2, th = teen ? 6 : 4, tw = teen ? 4 : 3; // perna, tronco, meia-largura do tronco
  const ly = by - lh, ty = ly - th + bob, hy = ty - 7;
  // pernas e sapatos
  if (side){
    if (!walk){ R(X(-2, 3), ly, 3, lh - 1, calca); R(X(-3, 4), by - 1, 4, 1, shoe); }
    else { R(X(1, 2), ly, 2, lh - 1, sh(calca, -.2)); P(X(2, 1), by - 1, shoe); R(X(-3, 2), ly, 2, lh - 1, calca); R(X(-4, 3), by - 1, 3, 1, shoe); }
  } else {
    const lL = frame === 1 ? 1 : 0, rL = frame === 3 ? 1 : 0;
    R(cx - 2, ly, 2, lh - 1 - lL, ela && !teen ? skin : calca); R(cx - 2, by - 1 - lL, 2, 1, shoe);
    R(cx, ly, 2, lh - 1 - rL, ela && !teen ? skin : calca); R(cx, by - 1 - rL, 2, 1, shoe);
  }
  // tronco (menina pequena: vestidinho; adolescente: camiseta mais comprida)
  R(cx - tw, ty, 2 * tw, th, cor); R(cx + tw - 1, ty + 1, 1, th - 1, corD); R(cx - tw, ty + th - 1, 2 * tw, 1, corD);
  if (ela && !teen){ R(cx - tw - 1, ty + th - 1, 2 * tw + 2, 2, cor); R(cx - tw - 1, ty + th, 2 * tw + 2, 1, corD); }
  if (dir === "down"){ P(cx - 1, ty, skD); P(cx, ty, skD); P(cx - tw + 1, ty + 1, corL); }
  if (teen && dir === "down") P(cx - 2, ty + 2, corL);
  // mochila
  if (mochila){
    const mc = "#E8735F", mD = sh(mc, -.25);
    if (dir === "up"){ rbox(cx - tw + 1, ty, 2 * tw - 2, th, mc); R(cx - tw + 2, ty + 1, 2 * tw - 4, 1, mD); }
    else if (side) { rbox(X(2, 3), ty, 3, th, mc); }
    else { P(cx - tw + 1, ty, mD); P(cx + tw - 2, ty, mD); P(cx - tw + 1, ty + 1, mD); P(cx + tw - 2, ty + 1, mD); }
  }
  // braços
  if (braco){ R(cx - tw - 1, ty - 3, 1, 4, cor); P(cx - tw - 1, ty - 4, skin); R(cx + tw, ty - 3, 1, 4, corD); P(cx + tw, ty - 4, skin); }
  else if (side){ const s = frame === 1 ? 1 : frame === 3 ? -1 : 0; R(X(-1 - s, 2), ty + 1, 2, th - 2, corD); R(X(-1 - s, 2), ty + th - 1, 2, 1, skin); }
  else { const aL = frame === 1 ? -1 : frame === 3 ? 1 : 0; R(cx - tw - 1, ty + 1 + aL, 1, th - 2, cor); P(cx - tw - 1, ty + th - 1 + aL, skin); R(cx + tw, ty + 1 - aL, 1, th - 2, corD); P(cx + tw, ty + th - 1 - aL, skin); }
  // cabeça (8x7) e cabelo
  if (dir === "up"){
    rbox(cx - 4, hy, 8, 7, hair); R(cx - 3, hy, 4, 1, hL);
    if (longo) { R(cx - 4, hy + 6, 8, teen ? 4 : 3, hair); R(cx - 3, hy + 6 + (teen ? 4 : 3), 6, 1, sh(hair, -.15)); }
    if (L.estilo === 7 || (ela && !teen)){ rbox(cx - 7, hy + 2, 3, 3, hair); rbox(cx + 4, hy + 2, 3, 3, hair); }
    return;
  }
  rbox(cx - 4, hy, 8, 7, skin); P(cx + 3, hy + 5, skD);
  const olhoF = pose === "blink" || pose === "sleep";
  if (side){
    const ex = X(-3, 1);
    if (olhoF) P(ex, hy + 4, ink); else R(ex, hy + 3, 1, 2, ink);
    P(X(-4, 1), hy + 5, "rgba(238,96,110,.65)");
    R(X(-1, 5), hy - 1, 5, 2, hair); R(X(-4, 4), hy - 1, 4, 2, hair); R(X(1, 4), hy + 1, 4, longo ? (teen ? 9 : 7) : 4, hair); P(X(-2, 1), hy - 1, hL);
    if (L.estilo === 7 || (ela && !teen)) rbox(X(4, 3), hy + 2, 3, 3, hair);
  } else {
    if (olhoF){ P(cx - 2, hy + 4, ink); P(cx + 1, hy + 4, ink); } else { R(cx - 2, hy + 3, 1, 2, ink); R(cx + 1, hy + 3, 1, 2, ink); P(cx - 2, hy + 3, "#5A4A6A"); }
    P(cx - 3, hy + 5, "rgba(238,96,110,.65)"); P(cx + 2, hy + 5, "rgba(238,96,110,.65)");
    if (braco || pose === "feliz"){ R(cx - 1, hy + 5, 2, 1, "#C0566A"); }
    R(cx - 4, hy - 1, 8, 2, hair); R(cx - 5, hy, 1, longo ? (teen ? 9 : 7) : 4, hair); R(cx + 4, hy, 1, longo ? (teen ? 9 : 7) : 4, sh(hair, -.12)); R(cx - 3, hy + 1, 3, 1, hair); P(cx + 1, hy + 1, hair); P(cx - 2, hy - 1, hL); P(cx - 1, hy - 1, hL);
    if (L.estilo === 7 || (ela && !teen)){ rbox(cx - 7, hy + 1, 3, 3, hair); rbox(cx + 4, hy + 1, 3, 3, hair); P(cx - 5, hy + 1, "#E8607A"); P(cx + 4, hy + 1, "#E8607A"); }
    if (L.estilo === 8){ R(cx - 5, hy - 2, 10, 2, hair); }
  }
}
const kidSprite = (teen, L, dir, frame, pose, moch) => sprite(["kid", teen ? 1 : 0, L.pele, L.cabelo, L.estilo, L.corpo, L.roupa, dir, frame, pose, moch ? 1 : 0].join(":"), 16, 24, (ox, oy) => drawKid(teen, L, ox + 8, oy + 23, dir, frame, pose, moch));
// engatinhando, de lado (virado pra esquerda; o espelhado sai do mesmo desenho)
function drawEngatinha(L, ox, oy, f){
  const skin = PELES[L.pele], skD = sh(skin, -.16), hair = CABELOS[L.cabelo], mac = ["#BFD9F2", "#F9C9D6", "#C6E8C8", "#D9CCF4"][L.roupa % 4], mD = sh(mac, -.2), ink = "#2E2638";
  // macacãozinho com a fralda branca pra cima (de quatro), mãos e joelhos alternando
  rbox(ox + 5, oy + 4, 7, 4, mac); R(ox + 6, oy + 4, 5, 1, sh(mac, .3));
  rbox(ox + 9, oy + 2, 4, 4, "#FFFFFF"); P(ox + 12, oy + 5, "#E6E2F0"); P(ox + 10, oy + 2, "#F4F1FA");
  R(ox + 2 + f, oy + 7, 2, 2, skin); R(ox + 5 - f, oy + 7, 1, 2, skD); // mãos
  R(ox + 8 + f, oy + 8, 2, 1, mD); R(ox + 11 - f, oy + 8, 2, 1, mac); P(ox + 13, oy + 7 - f, skin); // joelhos e pezinho
  // cabeça grande virada pra quem olha
  rbox(ox, oy, 7, 6, skin); P(ox + 6, oy + 4, skD); R(ox + 1, oy + 5, 5, 1, skD);
  R(ox + 1, oy - 1, 4, 1, hair); P(ox + 3, oy - 2, hair); P(ox + 2, oy, hair); P(ox + 3, oy, sh(hair, .25));
  P(ox + 2, oy + 3, ink); P(ox + 4, oy + 3, ink); P(ox + 1, oy + 4, "rgba(238,96,110,.6)"); P(ox + 5, oy + 4, "rgba(238,96,110,.6)"); P(ox + 3, oy + 4, "#C0566A");
}
function engSprite(L, f, esq){
  const k = ["eng", L.pele, L.cabelo, L.roupa, f].join(":"), base = sprite(k, 14, 11, (ox, oy) => drawEngatinha(L, ox, oy + 2, f));
  if (!esq) return base;
  return sprite(k + ":d", 14, 11, () => { ctx.save(); ctx.translate(base.c.width, 0); ctx.scale(-1, 1); ctx.drawImage(base.c, 0, 0); ctx.restore(); }, false);
}
// dormindo: cabeça no travesseiro, coberta por cima (na caminha ou num colchonete)
function kidDormindo(L, x, y, teen, cob){
  const skin = PELES[L.pele], hair = CABELOS[L.cabelo];
  rbox(x + 4, y + 1, 8, 6, skin); R(x + 4, y, 8, 2, hair); R(x + 3, y + 1, 1, 4, hair); R(x + 12, y + 1, 1, 4, hair);
  R(x + 6, y + 4, 1, 1, "#2E2638"); R(x + 9, y + 4, 1, 1, "#2E2638"); P(x + 5, y + 5, "rgba(238,96,110,.65)"); P(x + 10, y + 5, "rgba(238,96,110,.65)");
  const h = teen ? 18 : 14; rbox(x + 1, y + 7, 14, h, cob); R(x + 2, y + 7, 12, 1, sh(cob, .3)); R(x + 1, y + 9, 14, 1, "#FFF4E0"); R(x + 4, y + 13, 8, 1, sh(cob, -.15));
}
const fiDormeSpr = (L, teen, cob) => sprite(["kidz", L.pele, L.cabelo, teen ? 1 : 0, cob].join(":"), 16, 26, (ox, oy) => kidDormindo(L, ox, oy, teen, cob));

// ---- móveis novos: caminha, mesa de estudos, cavalinho, bloquinhos, cama de adolescente ----
Object.assign(CAT, {
  camaInfantil: { nome: "Cama infantil", w: 1, h: 2, preco: 220, acoes: [] },
  camaTeen:     { nome: "Cama de adolescente", w: 1, h: 2, preco: 300, acoes: [] },
  mesaEstudos:  { nome: "Mesa de estudos", w: 2, h: 1, preco: 180, acoes: [] },
  cavalinho:    { nome: "Cavalinho de balanço", w: 1, h: 1, preco: 90, acoes: [{ id: "cavalinho", nome: "Balançar no cavalinho", dur: 5, ganho: { diversao: 12 } }] },
  bloquinhos:   { nome: "Bloquinhos de montar", w: 1, h: 1, preco: 40, acoes: [{ id: "bloquinhos", nome: "Montar uma torre", dur: 6, ganho: { diversao: 10 } }] }
});
Object.assign(TOP, { camaInfantil: 3, camaTeen: 4, mesaEstudos: 9, cavalinho: 6, bloquinhos: 0 });
Object.assign(FRAME6, { cavalinho: (on, tm) => on ? 1 + Math.floor(tm / 300) % 2 : 0 });
FURN_EXTRA.camaInfantil = (x, y) => {
  const w = "#F2B8C6", wD = sh(w, -.2), cob = "#7FD1B2";
  rbox(x + 1, y - 3, 14, 6, w); R(x + 2, y - 2, 12, 1, sh(w, .3)); for (const sx of [4, 8, 11]) P(x + sx, y, "#FFF4E0"); // cabeceira com estrelinhas
  R(x + 1, y + 3, 14, 26, wD); R(x + 2, y + 3, 12, 25, "#FFF8EC"); rbox(x + 3, y + 4, 10, 5, "#FFFFFF"); // colchão e travesseiro
  rbox(x + 2, y + 11, 12, 17, cob); R(x + 3, y + 11, 10, 1, sh(cob, .3)); R(x + 2, y + 13, 12, 1, "#FFF4E0");
  for (const [a, b] of [[5, 17], [9, 21], [6, 25]]) P(x + a, y + b, "#FFF4E0");
  R(x + 1, y + 28, 14, 2, wD); R(x + 1, y + 30, 2, 2, wD); R(x + 13, y + 30, 2, 2, wD);
};
FURN_EXTRA.camaTeen = (x, y) => {
  const w = C.woodD, cob = "#5246B0";
  rbox(x, y - 4, 16, 8, w); R(x + 1, y - 3, 14, 1, C.wood); R(x + 3, y - 1, 10, 2, "#3A3448"); P(x + 5, y - 1, "#E8607A"); P(x + 9, y - 1, "#7FB8E8"); // cabeceira com adesivos
  R(x + 1, y + 4, 14, 26, C.woodDD); R(x + 2, y + 4, 12, 25, "#EEF0F6"); rbox(x + 3, y + 5, 10, 5, "#FFFFFF");
  rbox(x + 2, y + 12, 12, 17, cob); R(x + 3, y + 12, 10, 1, sh(cob, .3)); for (let i = 0; i < 4; i++) R(x + 2, y + 15 + i * 4, 12, 1, sh(cob, -.2));
  R(x + 1, y + 29, 14, 2, w);
};
FURN_EXTRA.mesaEstudos = (x, y) => {
  rbox(x + 1, y - 2, 30, 6, C.woodL); R(x + 2, y - 2, 28, 1, sh(C.woodL, .3)); R(x + 2, y + 4, 2, 11, C.woodD); R(x + 28, y + 4, 2, 11, C.woodD); R(x + 20, y + 4, 8, 8, C.wood); R(x + 21, y + 7, 6, 1, C.woodD); P(x + 24, y + 9, C.gold);
  rbox(x + 4, y - 6, 8, 5, "#FFFFFF"); R(x + 5, y - 5, 6, 1, "#C9D6EA"); R(x + 5, y - 3, 5, 1, "#C9D6EA"); R(x + 13, y - 4, 1, 3, "#E8735F"); // caderno e lápis
  R(x + 22, y - 10, 1, 8, C.metalD); R(x + 19, y - 11, 5, 2, "#F6C667"); P(x + 20, y - 9, "#FFF0B8"); // luminária
  R(x + 15, y - 5, 4, 3, "#7FB8E8"); R(x + 15, y - 5, 4, 1, "#BFE0F6"); // livro
};
FURN_EXTRA.cavalinho = (x, y, f) => {
  const c = "#E39A48", cD = sh(c, -.25), off = f === 1 ? -1 : f === 2 ? 1 : 0;
  R(x + 1, y + 11, 14, 2, "#B5814F"); R(x + 1, y + 10 + (off > 0 ? 0 : 1), 3, 1, "#B5814F"); R(x + 12, y + 10 + (off < 0 ? 0 : 1), 3, 1, "#B5814F"); // base curva
  R(x + 4, y + 6 + off, 1, 5, cD); R(x + 11, y + 6 - off, 1, 5, cD);
  rbox(x + 3, y + 2, 10, 5, c); R(x + 4, y + 2, 8, 1, sh(c, .3)); rbox(x + 10, y - 3 + off, 5, 6, c); P(x + 13, y - 1 + off, "#2E2638"); R(x + 9, y - 4 + off, 2, 5, "#8C5222"); // cabeça e crina
  R(x + 1, y + 2, 2, 3, "#8C5222"); R(x + 6, y + 1, 3, 2, "#E8607A"); // rabo e selinha
};
FURN_EXTRA.bloquinhos = (x, y) => {
  for (const [a, b, c] of [[2, 9, "#E8735F"], [7, 9, "#7FB8E8"], [12, 10, "#F6C667"], [4, 5, "#7FD1B2"], [9, 5, "#B49CF4"], [6, 1, "#E8607A"]]){ rbox(x + a, y + b, 4, 4, c); P(x + a + 1, y + b + 1, sh(c, .35)); }
};

// ---- rotina das crianças (calculada pelo relógio: igual em todos os aparelhos, como o bichinho) ----
const NPC_SLOT = 20000, famDisp = {}, famViews = [];
let famUltDraw = 0, petBrincaCache = { t: 0, v: false };
const npcTile = (seed, k) => petTiles.length ? petTiles[hash(k, seed, 191) % petTiles.length] : [10, 4];
function camasFilhos(){ return Object.keys(todosMoveis).filter(k => todosMoveis[k] && (todosMoveis[k].t === "camaInfantil" || todosMoveis[k].t === "camaTeen")).sort(); }
function camaDe(fid){ const l = famOrdem().filter(k => ehMaior(filhos[k])), i = l.indexOf(fid); return i >= 0 ? camasFilhos()[i] || null : null; }
function saidaEscola(){ const v = visitaSpot({ tipo: "vizinho", lado: 0, premio: 0 }); const [x, y] = v; for (const [dx, dy] of [[0, -1], [0, 0], [-1, -1], [1, -1], [0, -2]]) if (walkable(x + dx, y + dy)) return [x + dx, y + dy]; return npcTile(7, 0); }
function naEscola(f, t){
  const fase = filhoFase(f, t); if (fase !== "crianca" && fase !== "adolescente") return null;
  const a = agoraBR(t), E = FAMILIA.escola; if (a.dw === 0 || a.dw === 6) return null;
  if (a.h >= E.ini - .25 && a.h < E.ini) return "saindo";
  if (a.h >= E.ini && a.h < E.fim) return "escola";
  if (a.h >= E.fim && a.h < E.fim + .2) return "voltando";
  return null;
}
// v42: a ida até a cama (quando mandam dormir, ou na hora de dormir). Anda do lugar onde estava até o lado da cama
// e só então aparece deitada. Calculado pelo relógio, igual em todos os aparelhos.
function vizinhoCama(m){
  const c = CAT[m.t] || { w: 1, h: 2 }, cand = [];
  for (let y = m.y; y < m.y + c.h; y++) cand.push([m.x - 1, y], [m.x + c.w, y]);
  for (let x = m.x; x < m.x + c.w; x++) cand.push([x, m.y + c.h]);
  return cand.find(([x, y]) => walkable(x, y)) || null;
}
function indoPraCama(fid, f, t, seed, teen){
  const cid = camaDe(fid), m = cid && todosMoveis[cid]; if (!m || (m.andar || 0) !== 0 || andarAtual !== 0) return null;
  let ini, de;
  if (f.indoCama && f.dormirAte && t < f.dormirAte){ ini = f.indoCama.ini; de = [f.indoCama.x, f.indoCama.y]; }
  else {
    const a = agoraBR(t), h0 = teen ? 22.5 : 21; if (a.h < h0 || FAMILIA.horaTeste != null) return null;
    const hx = a.d.getUTCHours() + a.d.getUTCMinutes() / 60 + a.d.getUTCSeconds() / 3600 + a.d.getUTCMilliseconds() / 3600000; // com segundos (a.h é só em minutos)
    ini = t - (hx - h0) * HORA; const p = npcAndar(seed, ini, teen ? 2.2 : 2.6); de = [Math.round(p.x), Math.round(p.y)];
  }
  if (t < ini) return null;
  const alvo = vizinhoCama(m); if (!alvo) return null;
  const path = petPath(de, alvo); if (!path || !path.length) return null;
  const passos = (t - ini) / 1000 * 2.4; if (passos >= path.length) return null;
  const pts = [de].concat(path), i = Math.floor(passos), fr = passos - i, p0 = pts[i], p1 = pts[i + 1], dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  return { x: p0[0] + dx * fr, y: p0[1] + dy * fr, moving: true, dir: dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up" };
}
function dormeAgora(f, t){
  if (f.dormirAte && t < f.dormirAte) return true;
  const a = agoraBR(t), teen = filhoFase(f, t) === "adolescente", fds = a.dw === 0 || a.dw === 6;
  return a.h >= (teen ? 22.5 : 21) || a.h < (fds ? 8 : 6.5);
}
function npcAndar(seed, t, vel, alvo){
  const k = Math.floor(t / NPC_SLOT), pick = kk => (alvo && alvo(kk)) || npcTile(seed, kk);
  const A = pick(k - 1), B = pick(k), path = petPath(A, B), passos = (t - k * NPC_SLOT) / 1000 * vel;
  const pts = path ? [A].concat(path) : [B];
  if (path && passos < path.length){
    const i = Math.floor(passos), fr = passos - i, p0 = pts[i], p1 = pts[i + 1], dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    return { x: p0[0] + dx * fr, y: p0[1] + dy * fr, moving: true, dir: dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up", k };
  }
  return { x: B[0], y: B[1], moving: false, dir: ["down", "left", "right", "down"][hash(k, seed, 9) % 4], k };
}
// brincando com o bichinho: em alguns trechos de 20 s a criança vai até onde o bichinho vai parar
const petAlvoKid = (seed, k) => { if (!pet || !PET_TIPOS[pet.tipo] || hash(k, seed, 5) % 5) return null; const h = agoraBR(k * NPC_SLOT).h; if (h < 8 || h > 20) return null; const st = petEstado0(k * NPC_SLOT + NPC_SLOT - 1), x = Math.round(st.x), y = Math.round(st.y); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walkable(x + dx, y + dy)) return [x + dx, y + dy]; return null; };
function famEstado(fid, t){
  const f = filhos[fid]; if (!f || !f.nasceu) return null;
  t = t || srvNow();
  const fase = filhoFase(f, t), seed = hashStr(fid) | 0, teen = fase === "adolescente";
  if (fase === "bebe") return null;
  if (fase === "engatinhando"){
    if (f.colo && jogadores[f.colo] && jogadores[f.colo].online) return { onde: "colo" };
    if (engDorme(f)) return { onde: "berco" };
    if (f.com && t >= f.com.ini && t < f.com.ate) return { onde: "casa", x: f.com.x, y: f.com.y, dir: f.com.dir || "down", moving: false, pose: "stand", fase };
    const st = npcAndar(seed, t, .7); return Object.assign(st, { onde: "casa", fase, pose: st.moving ? "walk" : "stand" });
  }
  const esc = naEscola(f, t);
  if (esc === "escola") return { onde: "escola", fase };
  if (f.com && t >= f.com.ini && t < f.com.ate) return { onde: "casa", x: f.com.x, y: f.com.y, dir: f.com.dir || "down", moving: false, pose: { brincar: "jump", abracar: "arms", lanche: "feliz", historia: "feliz" }[f.com.tipo] || "stand", fase, com: f.com };
  if (dormeAgora(f, t) && !esc){ // v42: antes de deitar, vai andando até a cama
    const ida = indoPraCama(fid, f, t, seed, teen); if (ida) return Object.assign(ida, { onde: "casa", fase, pose: "walk" });
    return { onde: "cama", fase, cama: camaDe(fid) };
  }
  if (esc === "saindo"){ const s = saidaEscola(), st = npcAndar(seed, t, 2.2, kk => kk >= Math.floor(t / NPC_SLOT) - 0 ? s : null); const a = agoraBR(t), al = clamp((8 - a.h) / .05, 0, 1); return Object.assign(st, { onde: "casa", fase, mochila: 1, alpha: al, pose: st.moving ? "walk" : "stand" }); }
  const st = npcAndar(seed, t, teen ? 2.2 : 2.6, kk => (esc === "voltando" && kk === Math.floor(t / NPC_SLOT) - 1) ? saidaEscola() : petAlvoKid(seed, kk));
  st.onde = "casa"; st.fase = fase; st.pose = st.moving ? "walk" : "stand";
  if (esc === "voltando"){ st.mochila = 1; st.alpha = clamp((agoraBR(t).h - FAMILIA.escola.fim) / .03, .2, 1); }
  else if (!st.moving && petAlvoKid(seed, st.k) && pet && andarAtual === 0){ const ps = petEstado0(t); if (Math.hypot(ps.x - st.x, ps.y - st.y) < 1.6){ st.brincaPet = 1; st.pose = Math.floor(t / 380) % 2 ? "jump" : "feliz"; st.dir = ps.x < st.x ? "left" : ps.x > st.x ? "right" : "down"; } }
  return st;
}
// posição mostrada (suaviza os saltos: fim de uma brincadeira, volta da escola)
function famPos(fid){
  const st = famEstado(fid); if (!st || st.onde !== "casa") return null;
  const d = famDisp[fid]; return d ? { x: d.x, y: d.y } : { x: st.x, y: st.y };
}
function filhoBrincaPet(t){
  if (Math.abs(t - petBrincaCache.t) < 120) return petBrincaCache.v;
  let v = false; for (const fid of famOrdem()) if (ehMaior(filhos[fid])){ const st = famEstado(fid, t); if (st && st.brincaPet){ v = true; break; } }
  petBrincaCache = { t, v }; return v;
}
const petEstado0 = petEstado;
{ const f0 = petEstado; petEstado = function(t){ const st = f0(t); if (st.pose !== "walk" && st.pose !== "eat" && !st.triste && andarAtual === 0 && filhoBrincaPet(t)) st.pose = Math.floor(t / 420) % 2 ? "jump" : "sit"; return st; }; }

// ---- necessidades, humor, traços e desejos ----
const nivelTs = (ts, h, t) => ts ? clamp(100 - (t - ts) / (h * HORA) * 100, 0, 100) : 50;
function filhoNeeds(f, t){
  t = t || srvNow();
  return { fome: nivelTs(f.comeu || f.fome, 8, t), diversao: nivelTs(f.brincou || f.carinho, 10, t), estudo: estudoDe(f, t) };
}
function estudoDe(f, t){ return clamp((f.estudo != null ? +f.estudo : 40) - ((t || srvNow()) - (f.estudoAt || f.nasceu || t)) / FAMILIA.dia * 12, 0, 100); }
function filhoHumor(f, t){
  const n = filhoNeeds(f, t), v = (n.fome + n.diversao + Math.max(n.estudo, 40)) / 3 + (f.desejoOk && t - f.desejoOk < 3 * HORA ? 15 : 0);
  return v >= 75 ? { em: "😄", nome: "Feliz da vida" } : v >= 55 ? { em: "🙂", nome: "De boa" } : v >= 35 ? { em: "😐", nome: "Meio sem graça" } : { em: "😢", nome: "Tristinho(a)" };
}
const NB_FI = { fome: "Fome", diversao: "Diversão", estudo: "Estudo" };
function tracosTeen(fid){
  const ks = Object.keys(TRACOS), out = [];
  for (let i = 0; out.length < 2 && i < 40; i++){
    const k = ks[hash(hashStr(fid) | 0, i, 61) % ks.length];
    if (out.includes(k) || TRACOS_X.some(([a, b]) => (a === k && out.includes(b)) || (b === k && out.includes(a)))) continue;
    out.push(k);
  }
  return out;
}
const DES_TEEN = [
  { id: "lanche", ic: "🍕", txt: "Quer um lanche especial", acao: "lanche" },
  { id: "papo", ic: "💬", txt: "Quer conversar sobre a escola", acao: "conversar" },
  { id: "jogo", ic: "🎮", txt: "Quer jogar junto", acao: "brincar" },
  { id: "prova", ic: "✏️", txt: "Tem prova: precisa de ajuda na lição", acao: "licao" },
  { id: "abraco", ic: "🤗", txt: "Tá precisando de um abraço", acao: "abracar" }
];
function desejoTeen(fid, f, t){
  if (filhoFase(f, t) !== "adolescente") return null;
  const bl = Math.floor((t || srvNow()) / (3 * HORA)), d = DES_TEEN[hash(hashStr(fid) | 0, bl, 67) % DES_TEEN.length];
  return Object.assign({ bl, feito: (f.desejos || {})[bl] || null }, d);
}

// ---- ações dos pais com as crianças ----
const FI_ACOES = {
  lanche:    { menu: "Dar um lanche 🍎", nome: "Dando um lanche", dur: 5, ganho: { social: 6 }, preco: 5, rel: 3 },
  brincar:   { menu: "Brincar 🤸", nome: "Brincando", dur: 8, ganho: { diversao: 20, social: 8 }, rel: 4 },
  licao:     { menu: "Ajudar na lição ✏️", nome: "Ajudando na lição de casa", dur: 10, ganho: { social: 4 }, rel: 3, estudo: 20 },
  historia:  { menu: "Ler uma história 📖", nome: "Lendo uma história", dur: 8, ganho: { social: 8, diversao: 6 }, rel: 4, estudo: 5, so: "crianca" },
  dormir:    { menu: "Colocar pra dormir 🌙", nome: "Colocando pra dormir", dur: 4, ganho: { social: 4 }, rel: 2 },
  conversar: { menu: "Conversar 💬", nome: "Conversando", dur: 6, ganho: { social: 20 }, rel: 5 },
  abracar:   { menu: "Abraçar 🤗", nome: "Abraçando", dur: 3, ganho: { social: 15 }, rel: 4 }
};
const noiteBR = () => { const h = agoraBR().h; return h >= 19 || h < 6; };
function famAcoesDe(fid){ const f = filhos[fid]; const fase = filhoFase(f); return Object.keys(FI_ACOES).filter(k => (!FI_ACOES[k].so || FI_ACOES[k].so === fase) && (k !== "dormir" || noiteBR())); }
function famIrAte(fid, def){
  const p = famPos(fid); if (!p){ toast(nomeFilho(fid) + " não está por aqui agora."); return; }
  if (andarAtual !== 0){ toast(nomeFilho(fid) + " está lá embaixo."); return; }
  const tx = Math.round(p.x), ty = Math.round(p.y);
  closePanel(); closeMenu();
  goTo(null, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1 || (x === tx && y === ty && !walkable(tx + 1, ty) && !walkable(tx - 1, ty)), () => { faceTo(tx, ty); startAcao(def, null, null); });
}
function famAcao(fid, k){
  const f = filhos[fid], A = FI_ACOES[k]; if (!f || !A || !me) return;
  if (visitando){ toast("Quem cuida são os pais 😉"); return; }
  const st = famEstado(fid);
  if (!st || st.onde === "escola"){ toast(nomeFilho(fid) + " está na escola até as " + FAMILIA.escola.fim + "h 🎒"); return; }
  if (st.onde === "cama"){ toast(nomeFilho(fid) + " está dormindo 😴"); return; }
  const def = { id: "fi-" + k, nome: A.nome + " com " + nomeFilho(fid), dur: A.dur, ganho: A.ganho, fid,
    antes: () => {
      if (A.preco && !gastar(A.preco, "o lanche")) return false;
      // a criança vem pro lado de quem está cuidando
      const fz = filhos[fid]; if (!fz) return false;
      const d = me.dir, v = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[d] || [0, 1];
      let x = me.tx + v[0], y = me.ty + v[1]; if (!walkable(x, y)){ const q = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [me.tx + a, me.ty + b]).find(([a, b]) => walkable(a, b)); if (q){ x = q[0]; y = q[1]; } }
      const t = srvNow(); ref("casa/filhos/" + fid + "/com").set({ por: pid, tipo: k, ini: t, ate: t + A.dur * 1000 + 400, x, y, dir: x > me.tx ? "left" : x < me.tx ? "right" : y > me.ty ? "up" : "down" }).catch(() => {});
      faceTo(x, y); return true;
    } };
  if (k === "licao"){ const ms = Object.keys(moveis).filter(m => moveis[m].t === "mesaEstudos").sort()[0]; if (ms && andarAtual === 0) return useFurn(ms, def); }
  famIrAte(fid, def);
}
function famAcaoFim(a, k){
  const fid = a.def && a.def.fid, f = filhos[fid], A = FI_ACOES[k]; if (!f || !A) return;
  const t = srvNow(), up = {};
  if (k === "lanche") up.comeu = t;
  if (k === "brincar" || k === "historia") up.brincou = t;
  if (A.estudo){ up.estudo = Math.round(clamp(estudoDe(f, t) + A.estudo, 0, 100)); up.estudoAt = t; }
  if (k === "dormir"){ const h = agoraBR(t).h; up.dormirAte = t + ((h >= 7 ? 31 - h : 7 - h) * HORA); const c = f.com || {}; up.indoCama = { ini: t, x: Math.round(c.x != null ? c.x : me.tx), y: Math.round(c.y != null ? c.y : me.ty) }; toast(nomeFilho(fid) + " foi pra caminha 😴 Boa noite!"); } // v42: vai andando até a cama
  if (k === "licao"){ ganharHab("logica", 10); toast(nomeFilho(fid) + " entendeu a matéria ✏️ (+estudo)"); }
  if (k === "brincar") sfx("risada");
  ref("casa/filhos/" + fid).update(up).catch(() => {});
  relMudar(pid, fid, { amizade: A.rel });
  const dz = desejoTeen(fid, f, t);
  if (dz && !dz.feito && dz.acao === k) txn("casa/filhos/" + fid + "/desejos/" + dz.bl, c => c ? undefined : pid).then(ok => { if (!ok) return; ref("casa/filhos/" + fid + "/desejoOk").set(srvNow()).catch(() => {}); xpCasal(6); ganharNeeds({ social: 10 }); toastEspecial(nomeFilho(fid) + " adorou! 🌟", "Desejo realizado: " + dz.txt.toLowerCase() + "."); });
}
function famMenu(fid, p){
  const f = filhos[fid]; if (!f) return;
  const fase = filhoFase(f), nm = nomeFilho(fid);
  if (fase === "engatinhando") return comBebe(fid, () => openMenu(p, nm + " · engatinhando", BEBE_ACOES.map(a => ({ nome: a.k === "mamadeira" ? "Dar papinha 🥣" : a.menu, info: a.k === "mamadeira" ? ((despensa.leite || 0) > 0 ? "Leite da despensa" : "$6") : "", fn: () => comBebe(fid, () => irBebe(a)) })).concat([{ nome: "Ver no painel", fn: openFamilia }])));
  const n = filhoNeeds(f, srvNow()), items = [{ nota: 1, nome: filhoHumor(f, srvNow()).em + " Fome " + Math.round(n.fome) + " · Diversão " + Math.round(n.diversao) + " · Estudo " + Math.round(n.estudo) }];
  const dz = desejoTeen(fid, f, srvNow()); if (dz && !dz.feito) items.push({ nota: 1, nome: "🌟 " + dz.txt });
  if (!visitando) for (const k of famAcoesDe(fid)) items.push({ nome: FI_ACOES[k].menu, info: FI_ACOES[k].preco ? "$" + FI_ACOES[k].preco : "", fn: () => famAcao(fid, k) });
  items.push({ nome: "Ver no painel", fn: openFamilia });
  if (typeof openFilhoPertinho === "function") items.splice(1, 0, { nome: "👀 Ver " + nm + " de pertinho", fn: () => openFilhoPertinho(fid) }); // v39
  openMenu(p, nm + " · " + FASE_NOME[fase].toLowerCase(), items);
}
// canvas pequeno com o rosto (relações e painel)
function rostoCanvas(id){
  const cv = el("canvas", "rosto13"); cv.width = 16; cv.height = 14; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  const f = filhos[id];
  if (f){ const L = lookFilho(f), fase = filhoFase(f); if (fase === "bebe" || fase === "engatinhando") x.drawImage(sprite("bbface:" + L.pele + ":" + L.cabelo, 8, 7, (ox, oy) => drawBebe("berco", "acordado", ox, oy, PELES[L.pele], CABELOS[L.cabelo])).c, 4, 4); else x.drawImage(kidSprite(fase === "adolescente", L, "down", 0, "stand", 0).c, 0, fase === "adolescente" ? 1 : 3, 16, 14, 0, 0, 16, 14); }
  else { const j = id === pid ? (me && me.dados) : jogadores[id]; if (j) x.drawImage(avatarSprite(j, "down", 0, "stand").c, 1, 6, 16, 14, 0, 0, 16, 14); }
  cv.setAttribute("aria-hidden", "true"); return cv;
}
function famSecaoFilho(fid, box){
  const f = filhos[fid], t = srvNow(), fase = filhoFase(f, t), st = famEstado(fid, t), h = filhoHumor(f, t), n = filhoNeeds(f, t);
  const head = el("div", "rowi"), esq = el("div", "me"), tx = el("div", "tx");
  const onde = !st ? "" : st.onde === "escola" ? "Na escola até as " + FAMILIA.escola.fim + "h 🎒" : st.onde === "cama" ? "Dormindo 😴" : st.brincaPet ? "Brincando com " + petNome() + " 🐾" : st.mochila ? "Com a mochila 🎒" : "Em casa";
  tx.append(el("strong", null, (f.nome || "Sem nome") + " · " + FASE_NOME[fase] + (f.gemeo ? " (gêmeo/a)" : "")), el("small", null, h.em + " " + h.nome + " · " + onde + " · " + Math.floor((t - f.nasceu) / FAMILIA.dia) + " dias"));
  esq.style.gap = "10px"; esq.append(rostoCanvas(fid), tx); head.append(esq);
  if (!f.nome) head.append(btn("Dar nome", "btn small", () => openNomeBebe(fid)));
  box.append(head);
  const nb = el("div", "bbneeds");
  for (const [k, v] of Object.entries(n)){ const w = el("div", "need"), r = el("div", "row"); r.append(el("span", null, NB_FI[k]), el("span", "v", String(Math.round(v)))); w.append(r, barra(v, k === "estudo" ? "#B49CF4" : "#7FB8E8")); nb.append(w); }
  box.append(nb);
  const extra = [];
  if (fase === "adolescente"){ const tr = (Array.isArray(f.tracos) ? f.tracos : tracosTeen(fid)).filter(k => TRACOS[k]); if (tr.length) extra.push("Jeito: " + tr.map(k => TRACOS[k].ic + " " + TRACOS[k].nome).join(", ")); const dz = desejoTeen(fid, f, t); if (dz) extra.push((dz.feito ? "✓ " : "🌟 ") + dz.txt + (dz.feito ? " (feito)" : "")); }
  const bk = Object.keys(f.boletim || {}).sort().pop(); if (bk) extra.push("📝 Último boletim: nota " + f.boletim[bk]);
  const prox = famProxFaseTxt(fid); if (prox) extra.push(prox);
  if (extra.length) box.append(el("p", "muted", extra.join(" · ")));
  if (!visitando){ const g = el("div", "grid2"); for (const k of famAcoesDe(fid)) g.append(btn(FI_ACOES[k].menu, "btn ghost", () => famAcao(fid, k))); box.append(g); }
}
// ---- 1x por segundo: aniversários de fase, boletim, camas ----
let famFestaVista = {}, famBolo = {}, famTentou = {};
function famAoMudarFilhos(ant, carregado){
  if (!carregado || !me) return;
  for (const [fid, f] of Object.entries(filhos)){
    if (!f) continue; const a = ant[fid] || {};
    for (const [fase, ts] of Object.entries(f.festas || {})){
      if ((a.festas || {})[fase] || srvNow() - ts > 15 * 60000 || famFestaVista[fid + fase] || fase !== filhoFase(f)) continue;
      famFestaVista[fid + fase] = 1; famBolo[fid] = Date.now() + 30 * 60000;
      toastEspecial("Feliz aniversário, " + (f.nome || "pequeno(a)") + "! 🎂", { engatinhando: "Já está engatinhando pela casa!", crianca: "Agora é criança: vai pra escola!", adolescente: "Virou adolescente!" }[fase] || "");
      if (andarAtual === 0) confete(); sfx("risada");
    }
    for (const [sem, nota] of Object.entries(f.boletim || {})) if (!(a.boletim || {})[sem] && ant[fid]) toast("📝 Boletim de " + (f.nome || "nosso filho") + ": nota " + nota + (nota >= 9 ? " 🌟 Que orgulho!" : nota >= 7 ? " 👏" : nota >= 5 ? " · dá pra melhorar ✏️" : " · precisa de ajuda na lição 📚"));
  }
}
// sexta-feira às 13h (Brasília) mais recente: chave do boletim da semana
function sextaBoletim(t){
  const a = agoraBR(t), dd = (a.dw - 5 + 7) % 7; let base = t - dd * FAMILIA.dia;
  const hb = agoraBR(base).h; base -= (hb - FAMILIA.escola.fim) * HORA;
  if (base > t) base -= 7 * FAMILIA.dia;
  const d = new Date(base - 3 * HORA); return { ts: base, k: d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()) };
}
function famBoletim(fid){ // teste: força o boletim desta semana
  for (const k of fid ? [fid] : famOrdem()){ const f = filhos[k]; if (!f || !ehMaior(f)) continue; const nota = Math.round(clamp(estudoDe(f, srvNow()) / 10 + ((hash(hashStr(k) | 0, Date.now() / 1000 | 0, 3) % 3) - 1) * .5, 0, 10)); ref("casa/filhos/" + k + "/boletim/teste" + Date.now()).set(nota); }
}
function vigiarFilhos(){
  if (!me || !bbCarregado || visitando) return;
  const t = srvNow();
  for (const fid of famOrdem()){
    const f = filhos[fid], fase = filhoFase(f, t), pai = (f.pais || {})[pid];
    if (fase !== "bebe" && !(f.festas || {})[fase] && !famTentou[fid + fase]){
      famTentou[fid + fase] = 1;
      txn("casa/filhos/" + fid + "/festas/" + fase, c => c ? undefined : t).then(ok => {
        if (!ok) return;
        const up = {}; for (const fz of ["engatinhando", "crianca", "adolescente"]){ if (fz === fase) break; if (!(f.festas || {})[fz]) up["festas/" + fz] = t - 1; }
        if (fase === "adolescente" && !f.tracos) up.tracos = tracosTeen(fid);
        if (fase === "crianca" && f.estudo == null){ up.estudo = 50; up.estudoAt = t; }
        if (Object.keys(up).length) ref("casa/filhos/" + fid).update(up).catch(() => {});
        historia("fase_" + fid + "_" + fase, "🎂", (f.nome || "Nosso filho") + { engatinhando: " começou a engatinhar", crianca: " virou criança e foi pra escola", adolescente: " virou adolescente" }[fase]);
        statMais("aniversarios");
        if (fase === "crianca" || fase === "adolescente") setTimeout(() => garantirCamaFilho(fid, fase), 1500);
      });
    }
    // boletim semanal (sexta 13h): quem estiver online gera
    if (ehMaior(f)){
      const sx = sextaBoletim(t);
      if (t - sx.ts < 7 * FAMILIA.dia && ehMaior(Object.assign({}, f, { nasceu: f.nasceu })) && filhoFase(f, sx.ts) !== "bebe" && filhoFase(f, sx.ts) !== "engatinhando" && !(f.boletim || {})[sx.k] && !famTentou[fid + sx.k]){
        famTentou[fid + sx.k] = 1;
        const nota = Math.round(clamp(estudoDe(f, t) / 10 + ((hash(hashStr(fid) | 0, sx.ts / 1000 | 0, 3) % 3) - 1) * .5, 0, 10));
        txn("casa/filhos/" + fid + "/boletim/" + sx.k, c => c != null ? undefined : nota).then(ok => { if (ok) historia("boletim_" + fid + "_" + sx.k, "📝", "Boletim de " + (f.nome || "nosso filho") + ": nota " + nota); });
      }
    }
    // a brincadeira acabou: limpa o "com"
    if (f.com && t > f.com.ate + 60000 && f.com.por === pid) ref("casa/filhos/" + fid + "/com").remove().catch(() => {});
    void pai;
  }
}
function garantirCamaFilho(fid, fase){
  const tipo = fase === "adolescente" ? "camaTeen" : "camaInfantil";
  if (camaDe(fid) && todosMoveis[camaDe(fid)] && (fase !== "adolescente" || todosMoveis[camaDe(fid)].t === "camaTeen")) return;
  if (fase === "adolescente"){ const c = camaDe(fid); if (c && todosMoveis[c] && todosMoveis[c].t === "camaInfantil" && (todosMoveis[c].andar || 0) === andarAtual){ ref("casa/moveis/" + c + "/t").set("camaTeen").catch(() => {}); return; } } // a caminha vira cama de adolescente
  if (camaDe(fid)) return;
  const pos = noAndar(0, () => lugarPerto(tipo, 3, 2)); if (!pos) return;
  ref("casa/moveis").push({ t: tipo, x: pos[0], y: pos[1] }).catch(() => {});
}

// =====================================================================
// 6. MAIS BICHINHOS (casa/pets): gato e cachorro de sempre, coelho, peixinho (aquário) e passarinho (gaiola). Até 3.
// =====================================================================
const PET13 = {
  gato:       { nome: "Gatinho", ic: "🐱", preco: 40, fome: 10, car: 14, comida: "Dar ração", cuida: "Fazer carinho", ch: "carinho" },
  cachorro:   { nome: "Cachorrinho", ic: "🐶", preco: 40, fome: 10, car: 14, comida: "Dar ração", cuida: "Fazer carinho", ch: "carinho" },
  coelho:     { nome: "Coelhinho", ic: "🐰", preco: 35, fome: 9, car: 14, comida: "Dar cenoura 🥕", cuida: "Fazer carinho", ch: "carinho" },
  peixe:      { nome: "Peixinho", ic: "🐟", preco: 20, fome: 24, car: 72, comida: "Dar ração", cuida: "Limpar o aquário 🫧", ch: "limpo", item: "aquario" },
  passarinho: { nome: "Passarinho", ic: "🐦", preco: 30, fome: 12, car: 18, comida: "Dar alpiste", cuida: "Assobiar junto 🎶", ch: "carinho", item: "gaiola" }
};
const petsOrdem = () => Object.keys(pets).filter(k => pets[k] && PET13[pets[k].tipo]).sort((a, b) => ((pets[a].criado || 0) - (pets[b].criado || 0)) || (a < b ? -1 : 1));
const petsExtras = () => petsOrdem().filter(k => k !== petPid);
function comPet(id, fn){ const p0 = pet, s0 = salaSeed; pet = pets[id]; salaSeed = (s0 ^ (hashStr(id) | 0)) | 0; try { return fn(); } finally { pet = p0; salaSeed = s0; } }
function petNec(id, t){ const p = pets[id], d = p && PET13[p.tipo]; if (!d) return null; t = t || srvNow(); return { fome: petNivel(p.comeu, d.fome, t), cuida: petNivel(p[d.ch], d.car, t) }; }
const petTristeId = (id, t) => { const n = petNec(id, t); return !!n && (n.fome < PET_TRISTE || n.cuida < PET_TRISTE); };
const mingauAdotado = () => Object.values(pets).some(p => p && p.raca === "mingau");
// a casa do peixe e do passarinho: um aquário/gaiola por bichinho, na ordem de chegada
function casaDoPet(id){ const p = pets[id], d = p && PET13[p.tipo]; if (!d || !d.item) return null; const bs = petsOrdem().filter(k => pets[k].tipo === p.tipo), ms = Object.keys(todosMoveis).filter(k => todosMoveis[k] && todosMoveis[k].t === d.item).sort(); return ms[bs.indexOf(id)] || null; }
function petDoMovel(mid){ const m = todosMoveis[mid]; if (!m) return null; const tipo = m.t === "aquario" ? "peixe" : m.t === "gaiola" ? "passarinho" : m.t === "hamsterGaiola" ? "hamster" : null; if (!tipo) return null; const ms = Object.keys(todosMoveis).filter(k => todosMoveis[k] && todosMoveis[k].t === m.t).sort(); return petsOrdem().filter(k => pets[k].tipo === tipo)[ms.indexOf(mid)] || null; }
// ---- arte ----
function drawCoelho(x, y, pose, f, triste){
  const c = "#F4EEE6", cL = "#FFFFFF", cD = "#D9CFC4", or = "#F7A3B5", ink = "#2E2638";
  if (pose === "sleep"){ rbox(x + 2, y + 6, 11, 6, c); R(x + 3, y + 6, 9, 1, cL); R(x + 9, y + 5, 5, 2, c); R(x + 9, y + 4, 4, 1, cD); P(x + 12, y + 8, ink); P(x + 13, y + 8, ink); R(x + 1, y + 8, 2, 2, cL); return; }
  const hop = pose === "walk" && f ? -2 : 0, eat = pose === "eat";
  R(x + 1, y + 6 + hop, 2, 2, cL); // rabinho
  rbox(x + 2, y + 5 + hop, 9, 6, c); R(x + 3, y + 5 + hop, 7, 1, cL); R(x + 3, y + 10 + hop, 7, 1, cD);
  R(x + 3, y + 11 + hop, 3, 1, cD); R(x + 8, y + 11 + hop, 2, 1, c);
  const hx = x + 8, hy = y + (eat ? 5 : 2) + hop;
  rbox(hx, hy, 6, 6, c); R(hx + 1, hy, 4, 1, cL);
  if (triste){ R(hx - 1, hy + 1, 4, 2, c); P(hx, hy + 1, or); } else { R(hx + 1, hy - 5, 2, 5, c); P(hx + 1, hy - 4, or); P(hx + 1, hy - 3, or); R(hx + 3, hy - 4, 2, 4, cD); P(hx + 3, hy - 3, or); }
  if (pose === "jump"){ P(hx + 3, hy + 2, ink); P(hx + 4, hy + 1, ink); P(hx + 5, hy + 2, ink); } else R(hx + 4, hy + 2, 1, 2, ink);
  P(hx + 5, hy + 4, or); P(hx + 2, hy + 4, "rgba(238,96,110,.55)");
  if (eat){ R(hx + 5, hy + 5, 3, 1, "#F2883A"); P(hx + 8, hy + 4, "#7FD1B2"); }
}
function coelhoSprite(pose, f, esq, triste){
  const k = ["coelho", pose, f, triste ? 1 : 0].join(":"), base = sprite(k, 15, 13, (ox, oy) => drawCoelho(ox, oy + 1, pose, f, triste));
  if (!esq) return base;
  return sprite(k + ":e", 15, 13, () => { ctx.save(); ctx.translate(base.c.width, 0); ctx.scale(-1, 1); ctx.drawImage(base.c, 0, 0); ctx.restore(); }, false);
}
Object.assign(CAT, {
  aquario: { nome: "Aquário pequeno", w: 1, h: 1, preco: 120, acoes: [] },
  gaiola:  { nome: "Gaiola do passarinho", w: 1, h: 1, preco: 110, acoes: [] }
});
Object.assign(TOP, { aquario: 8, gaiola: 18 });
FURN_EXTRA.aquario = (x, y) => {
  R(x + 1, y + 6, 14, 9, C.woodD); R(x + 2, y + 7, 12, 1, C.wood); R(x + 3, y + 9, 4, 4, C.wood); R(x + 9, y + 9, 4, 4, C.wood); P(x + 6, y + 11, C.gold); P(x + 9, y + 11, C.gold);
  rbox(x + 1, y - 8, 14, 14, "#DCEFF7"); R(x + 2, y - 6, 12, 11, "#8FD0EE"); R(x + 2, y - 6, 12, 2, "#BFE7F6"); R(x + 2, y + 3, 12, 2, "#E9D8BE"); P(x + 4, y + 3, "#C9B79A"); P(x + 10, y + 4, "#C9B79A");
  R(x + 4, y - 2, 1, 5, C.leaf); P(x + 3, y - 1, C.leafL); P(x + 5, y, C.leafL); R(x + 11, y - 3, 1, 6, C.leafD); P(x + 12, y - 2, C.leaf);
  R(x + 1, y - 9, 14, 1, C.metalD); P(x + 13, y - 5, "#FFFFFF"); P(x + 13, y - 4, "#FFFFFF");
};
FURN_EXTRA.gaiola = (x, y) => {
  R(x + 7, y - 2, 2, 15, C.metalD); R(x + 4, y + 13, 8, 2, C.metalD); R(x + 5, y + 12, 6, 1, C.metal);
  const g = "#DCE4EC", gD = "#9AA8B8";
  R(x + 2, y - 4, 12, 2, gD); R(x + 3, y - 3, 10, 1, g);
  for (let i = 0; i < 6; i++) R(x + 3 + i * 2, y - 16, 1, 12, i % 2 ? gD : g);
  R(x + 4, y - 18, 8, 2, g); R(x + 6, y - 20, 4, 2, g); P(x + 7, y - 21, gD); P(x + 8, y - 21, gD);
  R(x + 3, y - 10, 10, 1, C.woodD); // poleiro
  R(x + 2, y - 17, 1, 1, g); R(x + 13, y - 17, 1, 1, g);
};
const passSpr = (f, esq) => sprite("pass:" + f + (esq ? "e" : ""), 6, 5, (ox, oy) => {
  const c = "#F6C667", cD = "#E0A53A", m = esq ? -1 : 1, X = a => esq ? ox + 5 - a : ox + a;
  R(esq ? ox + 1 : ox, oy + 1, 4, 3, c); P(X(3), oy, c); P(X(4), oy, c); P(X(4), oy + 1, "#2E2638"); P(X(5), oy + 1, "#F2883A"); P(X(1), oy + 2, cD); P(X(0), oy + 3 - (f ? 1 : 0), cD); void m;
});
const peixeSpr = (f, esq, cor) => sprite("peixe:" + f + (esq ? "e" : "") + cor, 6, 4, (ox, oy) => {
  const X = a => esq ? ox + 5 - a : ox + a;
  R(esq ? ox + 1 : ox + 1, oy + 1, 4, 2, cor); P(X(2), oy, cor); P(X(4), oy + 1, "#2E2638"); P(X(0), oy + (f ? 0 : 1), sh(cor, -.2)); P(X(0), oy + (f ? 3 : 2), sh(cor, -.2));
}, false);
// cantinho do passarinho: um "piu-piu" curto, sintetizado
function piar(vol){
  if (!audioPronto() || !prefOn("casinha-som") || !AUD.sfx) return;
  const c = AUD.ctx, t = c.currentTime + .01, v = vol == null ? 1 : vol;
  try { for (const [k, f0, f1] of [[0, 2600, 3400], [.13, 2900, 3800], [.3, 3100, 2400]]) tom(AUD.sfx, t + k, { f: f0, f2: f1, dur: .09, g: .035 * v, tipo: "sine" }); } catch(e){}
}
// ---- cuidar ----
function petCuidar13(id, campo){
  const p = pets[id], d = p && PET13[p.tipo]; if (!d) return;
  if (id === petPid && (campo === "comeu" || campo === "carinho")) return petCuidar(campo);
  ref("casa/pets/" + id).update({ [campo]: TS(), [campo + "Por"]: pid }).catch(() => {});
  const nm = p.nome || d.nome;
  if (campo === "comeu"){
    const msg = nm + (p.tipo === "coelho" ? " roeu a cenoura todinha 🥕" : p.tipo === "peixe" ? " pegou a ração na superfície 🫧" : p.tipo === "passarinho" ? " beliscou o alpiste 🐦" : p.tipo === "hamster" ? " encheu as bochechas de sementinhas 🐹" : " comeu tudinho 😋");
    if (!d.item) avisarComeu(id, nm, msg); else { toast(msg); sfx("comida"); } // v40: quem anda até o pote só "comeu" quando termina
  }
  else if (campo === "limpo"){ toast("Aquário limpinho! " + nm + " agradece 🫧"); ganharNeeds({ diversao: 4 }); }
  else { ganharNeeds({ social: 8, diversao: 8 }); statMais("carinhos"); if (p.tipo === "passarinho"){ piar(1); toast(nm + " cantou junto 🎶"); } else if (p.tipo === "gato") { sfx("ronronar"); toast(nm + " ronronou de felicidade."); } else if (p.tipo === "cachorro"){ sfx("latido"); toast(nm + " abanou o rabinho."); } else toast(nm + " fez um pulinho de felicidade 🐰"); }
  if (temTraco("bichos")) addEfeito("bichinho");
}
function petIrAte13(id, acao){
  if (andarAtual !== 0){ toast("Os bichinhos moram lá embaixo."); return; }
  closePanel(); closeMenu();
  const p = pets[id]; if (!p) return;
  if (PET13[p.tipo].item){ const mid = casaDoPet(id); if (!mid || !moveis[mid]){ toast("Falta " + (p.tipo === "peixe" ? "o aquário" : "a gaiola") + ". Coloque no modo Construir."); return; } return useFurn(mid, acao); }
  if (id === petPid) return petIrAte(acao);
  const st = comPet(id, () => petEstado0(srvNow())), tx = Math.round(st.x), ty = Math.round(st.y);
  if (typeof petEsperar === "function") petEsperar("casa/pets/" + id, tx, ty); // v41: espera parado até a pessoa chegar
  goTo(null, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) <= 1, () => { faceTo(tx, ty); startAcao(acao); });
}
function petAcao13(id, qual){
  const p = pets[id], d = p && PET13[p.tipo]; if (!d) return;
  const nm = p.nome || d.nome;
  if (qual === "comida"){ if (id === petPid) return petDarComida(); return petIrAte13(id, { id: "pet-comida", nome: d.comida + " pra " + nm, dur: 3, ganho: {}, fim: () => petCuidar13(id, "comeu") }); }
  if (id === petPid) return petFazerCarinho();
  petIrAte13(id, { id: d.ch === "limpo" ? "pet-limpar" : "pet-carinho", nome: d.cuida + (d.ch === "limpo" ? "" : " em " + nm), dur: d.ch === "limpo" ? 6 : 3, ganho: d.ch === "limpo" ? { diversao: 3 } : {}, fim: () => petCuidar13(id, d.ch) });
}
function petMenu13(id, p){
  const pt = pets[id], d = pt && PET13[pt.tipo]; if (!d) return;
  const n = petNec(id);
  openMenu(p, (pt.nome || d.nome) + (petTristeId(id) ? " está tristinho" : ""), [
    { nome: d.comida, info: "Fome " + Math.round(n.fome) + "%", fn: () => petAcao13(id, "comida") },
    { nome: d.cuida, info: (d.ch === "limpo" ? "Limpeza " : "Carinho ") + Math.round(n.cuida) + "%", fn: () => petAcao13(id, "cuida") },
    { nome: "Todos os bichinhos", fn: openPets }
  ]);
}
["aquario", "gaiola"].forEach(t => { MENU_EXTRA[t] = id => { const pk = petDoMovel(id); if (!pk) return [{ nota: 1, nome: t === "aquario" ? "Aquário vazio. Adote um peixinho 🐟" : "Gaiola vazia. Adote um passarinho 🐦" }, { nome: "Adotar bichinho", fn: openAdocao }]; const pt = pets[pk], d = PET13[pt.tipo], n = petNec(pk); return [{ nota: 1, nome: (pt.nome || d.nome) + " " + d.ic }, { nome: d.comida, info: "Fome " + Math.round(n.fome) + "%", fn: () => petAcao13(pk, "comida") }, { nome: d.cuida, info: Math.round(n.cuida) + "%", fn: () => petAcao13(pk, "cuida") }]; }; });
// ---- painel dos bichinhos e adoção ----
function iconePet(id){
  const p = pets[id], cv = el("canvas"); cv.width = 17; cv.height = 15; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  if (!p) return cv;
  if (p.tipo === "coelho") x.drawImage(coelhoSprite("stand", 0, false, false).c, 1, 1);
  else if (p.tipo === "peixe"){ x.fillStyle = "#8FD0EE"; x.fillRect(1, 3, 15, 10); x.drawImage(peixeSpr(0, false, p.cor || "#F2A65A").c, 5, 6); }
  else if (p.tipo === "passarinho") x.drawImage(passSpr(0, false).c, 5, 5);
  else if (p.tipo === "hamster"){ if (!(typeof iconeHamster === "function" && iconeHamster(x))){ x.fillStyle = "#E8C08A"; x.fillRect(4, 6, 9, 6); } }
  else x.drawImage(petSprite(p.raca === "mingau" ? "mingau" : p.tipo, "sit", 0, false, false).c, 0, 1);
  return cv;
}
function openPets(){
  openPanel("pets", "Bichinhos 🐾", corpo => {
    const lista = el("div", "list"), rod = el("div");
    corpo.append(lista, rod);
    let sig = null;
    const upd = () => {
      const l = petsOrdem(), s = JSON.stringify([l.map(k => [pets[k].nome, pets[k].tipo, Math.round(petNec(k).fome / 5), Math.round(petNec(k).cuida / 5)]), petPid]);
      if (s === sig) return; sig = s; lista.textContent = ""; rod.textContent = "";
      for (const id of l){
        const p = pets[id], d = PET13[p.tipo], n = petNec(id), box = el("div", "rowi pet13"), esq = el("div", "me"), tx = el("div", "tx");
        tx.append(el("strong", null, d.ic + " " + (p.nome || d.nome)), el("small", null, (p.raca === "mingau" ? "O Mingau, adotado da rua" : d.nome) + (id === petPid ? " · aprende truques" : "") + (petTristeId(id) ? " · tristinho" : "")));
        for (const [nn, v, c] of [["Fome", n.fome, "#EF9F27"], [d.ch === "limpo" ? "Limpeza" : "Carinho", n.cuida, "#D4537E"]]){ const w = el("div", "need"), r = el("div", "row"); r.append(el("span", null, nn), el("span", null, Math.round(v) + "%")); w.append(r, barra(v, c)); tx.append(w); }
        esq.style.gap = "10px"; esq.append(iconePet(id), tx);
        const bb = el("div", "hbtns pbtn13");
        bb.append(btn(d.comida, "btn ghost small", () => petAcao13(id, "comida")), btn(d.cuida, "btn ghost small", () => petAcao13(id, "cuida")));
        if (id === petPid) bb.append(btn("Nome e truques", "btn ghost small", openPetPanel));
        else bb.append(btn("Nome", "btn ghost small", () => renomearPet(id)));
        box.append(esq, bb); lista.append(box);
      }
      if (!visitando) rod.append(btn(l.length < FAMILIA.petsMax ? "🐾 Adotar bichinho (" + l.length + "/" + FAMILIA.petsMax + ")" : "Casa cheia de bichinhos (" + FAMILIA.petsMax + "/" + FAMILIA.petsMax + ")", "btn", openAdocao));
    };
    upd(); let ult = 0; painel.tick = () => { if (Date.now() - ult > 2000){ ult = Date.now(); upd(); } }; return upd;
  });
}
function renomearPet(id){
  const p = pets[id]; if (!p) return;
  openPanel("petNome", "Nome do bichinho", corpo => {
    const inp = el("input"), linha = el("div", "nomein"); inp.type = "text"; inp.maxLength = 16; inp.value = p.nome || ""; inp.setAttribute("aria-label", "Nome do bichinho");
    linha.append(inp, btn("Salvar", "btn", () => { const v = limpaNome(inp.value).slice(0, 16); if (!v){ toast("Dê um nome."); return; } ref("casa/pets/" + id + "/nome").set(v).then(() => { toast("Agora é " + v + "."); openPets(); }); }));
    corpo.append(linha);
  });
}
function openAdocao(){
  if (visitando){ toast("Adoção é na sua casa 😉"); return; }
  openPanel("adocao", "Adotar bichinho 🐾", corpo => {
    const n = petsOrdem().length, cheio = n >= FAMILIA.petsMax;
    corpo.append(el("p", "muted", cheio ? "A casa já tem " + FAMILIA.petsMax + " bichinhos. Cuidem bem deles 💞" : "Preço simbólico pro abrigo. Peixinho vem com aquário, passarinho e hamster com gaiola, se a casa ainda não tiver."));
    if (cheio) return;
    const inp = el("input"), sel = { t: "coelho" }; inp.type = "text"; inp.maxLength = 16; inp.placeholder = "Nome (opcional)"; inp.setAttribute("aria-label", "Nome do bichinho novo");
    const g = el("div", "grid2"), pinta = () => { for (const b of g.children) b.setAttribute("aria-pressed", String(b.dataset.t === sel.t)); };
    for (const [k, d] of Object.entries(PET13)){
      const b = btn("", "btn ghost escolha", () => { sel.t = k; pinta(); }); b.dataset.t = k;
      b.append(el("strong", null, d.ic + " " + d.nome), el("small", null, "$" + d.preco + (d.item ? " · com " + CAT[d.item].nome.toLowerCase() : ""))); g.append(b);
    }
    if (gatoAmigo() && !mingauAdotado()){ const b = btn("", "btn ghost escolha", () => { sel.t = "mingau"; pinta(); }); b.dataset.t = "mingau"; b.append(el("strong", null, "🐈 O Mingau"), el("small", null, "O gatinho de rua amigo · de graça")); g.append(b); }
    pinta();
    corpo.append(g, inp, btn("Adotar 🐾", "btn", () => adotarPet(sel.t, inp.value)));
  });
}
function adotarPet(tipo, nome){
  if (petsOrdem().length >= FAMILIA.petsMax){ toast("A casa já tem " + FAMILIA.petsMax + " bichinhos."); return; }
  const ming = tipo === "mingau", d = PET13[ming ? "gato" : tipo]; if (!d) return;
  if (!ming && !gastar(d.preco, "a adoção")) return;
  const t = srvNow(), nm = limpaNome(nome).slice(0, 16) || (ming ? "Mingau" : { gato: "Mimi", cachorro: "Bolinha", coelho: "Algodão", peixe: "Nemo", passarinho: "Piu" }[tipo]);
  const p = { nome: nm, tipo: ming ? "gato" : tipo, comeu: t, carinho: t, limpo: t, criado: t };
  if (ming) p.raca = "mingau"; if (tipo === "peixe") p.cor = ["#F2A65A", "#E8607A", "#F6C667", "#7FB8E8"][hash(t | 0, 1, 2) % 4];
  const id = ref("casa/pets").push().key;
  ref("casa/pets/" + id).set(p).then(() => {
    closePanel(); toastEspecial("Bem-vindo(a), " + nm + "! 🐾", ming ? "O Mingau agora mora com vocês." : d.nome + " adotado com carinho."); confete();
    historia("pet_" + id, d.ic, nm + (ming ? ", o gatinho de rua, ganhou um lar" : " chegou pra morar na casa"));
    if (d.item && !casaDoPet(id)){ const pos = noAndar(0, () => lugarPerto(d.item, 10, 6)); if (pos) ref("casa/moveis").push({ t: d.item, x: pos[0], y: pos[1] }).catch(() => {}); else toast("Não coube " + CAT[d.item].nome.toLowerCase() + ". Coloque no modo Construir."); }
    setTimeout(checarConquistas, 1500);
  }, () => { if (!ming) ganhar(d.preco); toast("Não deu pra adotar agora."); });
}
function petsAdotarTeste(tipo){ if (me) me.dinheiro += 100; adotarPet(tipo || "coelho"); }
let petsAnt = {};
function petsAoMudar(){
  if (me) for (const [id, p] of Object.entries(pets)){ const a = petsAnt[id]; if (!p || !a || id === petPid) continue; if (p.carinho !== a.carinho && p.carinhoPor && p.carinhoPor !== pid) toast(nomeDe(p.carinhoPor) + " cuidou de " + (p.nome || "um bichinho") + "."); if (p.comeu !== a.comeu && p.comeuPor && p.comeuPor !== pid) toast(nomeDe(p.comeuPor) + " deu comida pra " + (p.nome || "um bichinho") + "."); }
  petsAnt = Object.assign({}, pets);
}
// o Mingau adotado não aparece mais como visita
{ const f0 = visitaAgora; visitaAgora = function(){ const v = f0(); return v && v.tipo === "gato" && mingauAdotado() ? null : v; }; }

// =====================================================================
// 7. DESENHO: crianças, bichinhos novos, cerimônia (arco, tapete, cadeiras), caixinha do anel
// =====================================================================
const petViews13 = [];
function drawArco(x, y, tm){ // x,y = canto de cima do quadrado do meio; o arco cobre 3 quadrados
  const L = x - T + 2, Rr = x + 2 * T - 4, top = y - 22, br = "#FFF8EC", brD = "#E9D8BE", fl = ["#F9B8CC", "#FFFFFF", "#F6C667", "#E8607A"];
  R(L, top + 8, 2, 30, br); R(L + 1, top + 8, 1, 30, brD); R(Rr, top + 8, 2, 30, br); R(Rr + 1, top + 8, 1, 30, brD);
  for (let i = 0; i <= 20; i++){ const a = Math.PI * i / 20, xx = Math.round((L + Rr) / 2 - Math.cos(a) * (Rr - L) / 2), yy = Math.round(top + 9 - Math.sin(a) * 9); R(xx, yy, 2, 2, br); }
  for (let i = 0; i < 16; i++){ const a = Math.PI * i / 15, xx = Math.round((L + Rr) / 2 - Math.cos(a) * (Rr - L) / 2), yy = Math.round(top + 9 - Math.sin(a) * 9); P(xx - 1, yy + 1, C.leaf); P(xx + 2, yy, C.leafD); P(xx, yy - 1, fl[i % 4]); P(xx + 1, yy - 1, fl[(i + 1) % 4]); }
  for (let j = 0; j < 7; j++){ for (const sx of [L, Rr]){ P(sx - 1, top + 12 + j * 4, C.leaf); P(sx + 2, top + 14 + j * 4, C.leafD); P(sx + (j % 2 ? -1 : 2), top + 13 + j * 4, fl[j % 4]); } }
  const bal = Math.round(Math.sin(tm / 600)); R((L + Rr) / 2 - 2, top + 3 + bal, 5, 4, "#F7A3B5"); P((L + Rr) / 2, top + 7 + bal, "#E8607A"); // sininho de flores
}
function drawCadeira13(x, y, frente){ // x,y = canto de cima do quadrado
  const b = "#FFFFFF", bD = "#D6D0E2";
  if (!frente){ R(x + 3, y + 9, 10, 3, b); R(x + 3, y + 11, 10, 1, bD); R(x + 4, y + 12, 1, 3, bD); R(x + 11, y + 12, 1, 3, bD); }
  else { R(x + 3, y + 13, 10, 2, b); R(x + 3, y + 14, 10, 1, bD); P(x + 4, y + 15, bD); P(x + 11, y + 15, bD); R(x + 6, y + 13, 1, 1, "#F9B8CC"); }
}
function addCasamentoObjs(objs, tm){
  const c = casamento; if (!c || c.estado === "fim" || (c.andar || 0) !== andarAtual) return;
  if (!c.ini && srvNow() < (c.data || 0) - 2 * HORA) return; // a decoração aparece 2h antes
  const x = c.ax * T, y = c.ay * T;
  objs.push({ z: y + 1, f: () => drawArco(x, y, tm) });
  objs.push({ z: -1e6, f: () => { for (let k = 1; k <= 3; k++){ if (!MAP[c.ay + k] || MAP[c.ay + k][c.ax] !== 0) break; R(x + 4, y + k * T, 8, T, "#FFF4E8"); R(x + 4, y + k * T, 1, T, "#E8607A"); R(x + 11, y + k * T, 1, T, "#E8607A"); for (let i = 0; i < 3; i++) P(x + 5 + hash(k, i, 41) % 6, y + k * T + 2 + i * 5, "#F7A3B5"); } } }); // tapete com pétalas
  for (const [cx, cy] of csCadeiras(c)){ objs.push({ z: (cy + 1) * T - 3.5, f: () => drawCadeira13(cx * T, cy * T, false) }); objs.push({ z: (cy + 1) * T - 2.5, f: () => drawCadeira13(cx * T, cy * T, true) }); }
}
function addFamObjs(objs, tm){
  famViews.length = 0; petViews13.length = 0;
  const t = srvNow(), now = Date.now(), dt = Math.min(.1, (now - (famUltDraw || now)) / 1000); famUltDraw = now;
  addCasamentoObjs(objs, tm);
  // crianças
  for (const fid of famOrdem()){
    const f = filhos[fid], st = famEstado(fid, t); if (!st) continue;
    const L = lookFilho(f), teen = st.fase === "adolescente";
    if (st.onde === "cama"){
      const cid = st.cama, m = cid && todosMoveis[cid];
      if (m && (m.andar || 0) === andarAtual){ const spr = fiDormeSpr(L, teen, m.t === "camaTeen" ? "#5246B0" : "#7FD1B2"); const dy36 = typeof COZY !== "undefined" && COZY.ok ? 6 : 0; objs.push({ z: (m.y + 2) * T - 1, f: () => ctx.drawImage(spr.c, m.x * T - 1, m.y * T + 1 + dy36) }); /* v36: camas da Cozy têm a cabeceira mais baixa */ famViews.push({ fid, cx: m.x * T + 8, by: m.y * T + 10, dorme: 1 }); }
      else if (!m && andarAtual === 0){ const [fx, fy] = npcTile(hashStr(fid) | 0, 3), spr = fiDormeSpr(L, teen, "#F2A65A"); objs.push({ z: (fy + 1) * T - 4, f: () => { R(fx * T, fy * T + 2, 16, 26, "#E9D8BE"); ctx.drawImage(spr.c, fx * T - 1, fy * T - 1); } }); famViews.push({ fid, cx: fx * T + 8, by: fy * T + 8, dorme: 1 }); }
      continue;
    }
    if (st.onde !== "casa" || andarAtual !== 0) { delete famDisp[fid]; continue; }
    let d = famDisp[fid]; if (!d) d = famDisp[fid] = { x: st.x, y: st.y };
    const dx = st.x - d.x, dy = st.y - d.y, dist = Math.hypot(dx, dy);
    if (dist > 5){ d.x = st.x; d.y = st.y; } else if (dist > .01){ const s = Math.min(dist, 4.5 * dt); d.x += dx / dist * s; d.y += dy / dist * s; }
    const andando = st.moving || dist > .08, cx = Math.round((d.x + .5) * T), by = Math.round((d.y + 1) * T - 3), pisca = (tm + hashStr(fid) % 900) % 3600 < 140;
    if (st.fase === "engatinhando"){
      const fr = andando ? Math.floor(tm / 260) % 2 : 0, esq = st.dir === "right", spr = engSprite(L, fr, esq);
      objs.push({ z: by, f: () => { R(cx - 5, by + 1, 10, 1, "rgba(35,18,40,.22)"); ctx.drawImage(spr.c, cx - 8, by - 10); } });
      const est = comBebe(fid, () => bebeEstado(t)); famViews.push({ fid, cx, by: by - 2, chora: est && est.k === "chora", eng: 1 });
      continue;
    }
    let pose = andando ? "walk" : st.pose || "stand", fr = andando ? Math.floor(tm / 120) % 4 : 0, oy = 0;
    if (pose === "walk") pose = "stand"; if (pose === "jump"){ oy = -Math.round(Math.abs(Math.sin(tm / 160)) * 3); } if (pose === "stand" && pisca) pose = "blink";
    const dir = andando && dist > .08 && !st.moving ? (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up") : st.dir || "down";
    const spr = kidSprite(teen, L, dir, fr, pose, st.mochila), al = st.alpha == null ? 1 : st.alpha;
    objs.push({ z: by, f: () => {
      ctx.globalAlpha = al; R(cx - 3, by, 7, 1, "rgba(35,18,40,.25)"); ctx.drawImage(spr.c, cx - 9, by - 24 + oy);
      if (famBolo[fid] && Date.now() < famBolo[fid]){ ctx.drawImage(propSpr("bolo").c, cx + 5, by - 7); const fl = Math.floor(tm / 200) % 2; P(cx + 9, by - 9 - fl, "#F6C667"); P(cx + 9, by - 8, "#FFFFFF"); }
      ctx.globalAlpha = 1;
    } });
    famViews.push({ fid, cx, by: by + oy, h: teen ? 20 : 16, brincaPet: st.brincaPet, humor: filhoHumor(f, t) });
  }
  // bichinhos novos
  for (const id of petsExtras()){
    const p = pets[id], d = PET13[p.tipo];
    if (d.item){
      const mid = casaDoPet(id), m = mid && moveis[mid]; if (!m) continue;
      const x = m.x * T, y = m.y * T, triste = petTristeId(id, t), n = petNec(id, t);
      if (p.tipo === "peixe"){
        const cz = typeof COZY !== "undefined" && COZY.ok, aq = cz ? -6 : 0; // v33: o aquário da Cozy fica em cima de uma mesinha (a água é mais alta)
        const per = 4200 + hashStr(id) % 1500, ph = (tm % per) / per, esq = ph > .5, px = x + 3 + Math.round((esq ? 1 - (ph - .5) * 2 : ph * 2) * 6), py = y - 4 + aq + Math.round(Math.sin(tm / 500) * 1.5) + (triste ? 3 : 0);
        objs.push({ z: (m.y + 1) * T - .3, f: () => {
          ctx.drawImage(peixeSpr(Math.floor(tm / 250) % 2, esq, p.cor || "#F2A65A").c, px, py);
          if (n.cuida < 40){ ctx.globalAlpha = clamp((40 - n.cuida) / 50, .1, .55); R(x + 2, y - 6 + aq, 12, 9, "#6E9E5A"); ctx.globalAlpha = 1; }
          const b = (tm / 900 + hashStr(id) % 7) % 1; ctx.globalAlpha = 1 - b; P(px + (esq ? 0 : 5), py - 1 - Math.round(b * 5), "#FFFFFF"); ctx.globalAlpha = 1;
        } });
        petViews13.push({ id, cx: x + 8, by: y + 2, triste });
      } else if (p.tipo === "hamster"){ // v38: o hamster já corre na rodinha dentro da gaiola animada
        petViews13.push({ id, cx: x + 8, by: y + 4, triste });
      } else {
        const k = Math.floor(tm / 1400 + hashStr(id) % 5), pos = [[4, -14], [9, -14], [6, -9]][k % 3], hop = (tm % 1400) < 200 ? -1 : 0, esq = k % 2 === 1;
        objs.push({ z: (m.y + 1) * T - .3, f: () => { if (typeof passaroCozy === "function" && passaroCozy(x, y, tm + hashStr(id) % 900, triste)) return; ctx.drawImage(passSpr(Math.floor(tm / 300) % 2, esq).c, x + pos[0] - 1, y + pos[1] - 1 - (triste ? 0 : hop) + (triste ? 5 : 0)); } }); // v33: passarinho da Cozy em cima da gaiola
        petViews13.push({ id, cx: x + 8, by: y - 8, triste, passaro: 1 });
      }
      continue;
    }
    if (andarAtual !== 0) continue;
    const st = comPet(id, () => petEstado0(t)), alegre = t - Math.max(p.carinho || 0, p.comeu || 0) < 3500;
    let pose = st.pose, f = pose === "walk" ? Math.floor(tm / 150) % 2 : pose === "eat" ? Math.floor(tm / 260) % 2 : pose === "sleep" ? Math.floor(tm / 1100) % 2 : Math.floor(tm / 650) % 2, oy = 0;
    if (alegre && pose !== "walk"){ pose = "jump"; f = 0; oy = -Math.round(Math.abs(Math.sin(tm / 140)) * 5); }
    if (p.tipo === "coelho" && pose === "walk") oy = -Math.round(Math.abs(Math.sin(tm / 130)) * 2);
    const cx = Math.round((st.x + .5) * T), by = Math.round((st.y + 1) * T - 3);
    const spr = p.tipo === "coelho" ? coelhoSprite(pose === "sit" ? "stand" : pose, f, st.esq, st.triste) : petSprite(p.raca === "mingau" ? "mingau" : p.tipo, pose, f, st.esq, st.triste);
    objs.push({ z: by - .4, f: () => { R(cx - 5, by + 1, 10, 1, "rgba(35,18,40,.25)"); ctx.drawImage(spr.c, cx - 9, by - 13 + oy); if (st.triste) drawNuvem(cx + (st.esq ? -3 : 3), by - 19, tm); } });
    petViews13.push({ id, cx, by, pose, triste: st.triste });
  }
}
{ const f0 = addLeva10Objs; addLeva10Objs = function(objs, tm){ f0(objs, tm); try { addFamObjs(objs, tm); } catch(e){ console.error(e); } }; }
// caixinha do anel abrindo na mão de quem pede
{ const f0 = sobreAvatar7; sobreAvatar7 = function(id, cx, by, dir, pose, deitado, sentado, movT, tm){
  f0(id, cx, by, dir, pose, deitado, sentado, movT, tm);
  const a = id === pid ? me && me.acao : jogadores[id] && jogadores[id].acao;
  if (a && a.id === "pedido-casamento"){
    const pr = Date.now() - (id === pid ? a.ini : Date.now() - 2000), bx = dir === "left" ? cx - 9 : cx + 4, yy = by - 9, aberta = pr > 1500 || id !== pid;
    R(bx, yy + 2, 5, 3, "#8C2B4A"); R(bx, yy + 2, 5, 1, "#B8405A");
    if (aberta){ R(bx, yy - 1, 5, 2, "#8C2B4A"); R(bx + 1, yy + 1, 3, 1, "#FFF4E0"); P(bx + 2, yy, "#F6C667"); if (Math.floor(tm / 250) % 2) P(bx + 2, yy - 2, "#FFFFFF"); }
    else R(bx, yy + 1, 5, 1, "#B8405A");
  }
}; }
// poses da leva 13 (chamado pelo laço pra cada pessoa)
function leva13Pose(id, aid, acao, tm, pisca, dir, pose){
  if (!aid) return null;
  if (/^pedido-/.test(aid)){
    const o = acao.alvo && (acao.alvo === pid ? { x: me.px } : disp[acao.alvo]), eu = id === pid ? { x: me.px } : disp[id];
    const d = o && eu ? (o.x < eu.x ? "left" : "right") : dir === "up" || dir === "down" ? "right" : dir;
    return aid === "pedido-casamento" ? { pose: "sit" + (pisca ? "blink" : ""), dir: d, dy: 1, sentado: false } : { dir: d, pose: "blush" + (pisca ? "blink" : "") };
  }
  if (aid === "cas-assistir") return { pose: "sit" + (pisca ? "blink" : ""), dir: "up", sentado: true, dy: -2 };
  if (aid === "cas-altar"){
    const c = casamento; if (!c) return null;
    const F = csFase(), lado = c.a === id ? -1 : 1;
    if (!F || F.f === "entrada") return { dir: "down" };
    if (F.f === "votoA" || F.f === "votoB") return { dir: lado < 0 ? "right" : "left", pose: (F.f === (lado < 0 ? "votoA" : "votoB") ? "blush" : "stand") + (pisca ? "blink" : "") };
    if (F.f === "beijo") return { dir: lado < 0 ? "right" : "left", dx: -lado * Math.min(10, Math.round(F.d / 200)), pose: "blush" };
    if (F.f === "festa") return { dir: "down", pose: Math.floor(tm / 300) % 2 ? "arms" : "stand", frame: Math.floor(tm / 300) % 2 ? 1 : 3 };
  }
  if (/^fi-(abracar|brincar)/.test(aid)) return { pose: Math.floor(tm / 400) % 2 ? "arms" : "stand" };
  return null;
}
// nomes das crianças, zZ, humor, "buá!" de quem engatinha, notinhas do passarinho
function famLabels(mctx, K, fs, tm){
  if (mode !== "live") return;
  const f2 = Math.round(fs * .82);
  for (const v of famViews){
    const f = filhos[v.fid]; if (!f) continue;
    if (v.dorme){ mctx.fillStyle = "#CECBF6"; mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.fillText("zZ", (v.cx + 5) * K, (v.by - 6) * K - Math.sin(tm / 400) * K * 1.5); continue; }
    if (v.eng){ if (v.chora) drawLabelBebe(mctx, K, fs, tm, { x: v.cx, y: v.by - 8, chora: 1 }); continue; }
    const top = (v.by - v.h - 3) * K, nm = f.nome || "";
    if (nm){ mctx.font = "700 " + f2 + "px 'Pixelify Sans', monospace"; mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K); mctx.strokeStyle = "rgba(18,14,28,.85)"; mctx.strokeText(nm, v.cx * K, top); mctx.fillStyle = "#FFE6F0"; mctx.fillText(nm, v.cx * K, top); }
    const fase = (tm + hashStr(v.fid) % 9000) % 16000;
    if (v.brincaPet || fase < 2200){ mctx.font = Math.round(fs * 1.05) + "px sans-serif"; mctx.fillText(v.brincaPet ? "🐾" : v.humor.em, v.cx * K + 8 * K, top - f2 * .9 + Math.sin(tm / 260) * K * .8); }
  }
  for (const v of petViews13){
    if (v.passaro && !v.triste && (tm + hashStr(v.id) % 5000) % 9000 < 1800){ mctx.fillStyle = "#FFF0B8"; mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.fillText("♪", (v.cx + 6) * K, (v.by - 4) * K - ((tm % 1800) / 1800) * K * 6); }
    if (v.pose === "sleep"){ mctx.fillStyle = "#CECBF6"; mctx.fillText("zZ", (v.cx + 7) * K, (v.by - 12) * K - Math.sin(tm / 300) * K * 1.5); }
  }
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
}
{ const f0 = drawLabels11; drawLabels11 = function(mctx, K, fs){ f0(mctx, K, fs); try { famLabels(mctx, K, fs, Date.now()); } catch(e){ console.error(e); } }; }
// toque: criança, quem engatinha e bichinhos novos (antes do bichinho principal)
function famClick(p, toque){
  if (mode !== "live") return false;
  const fg = toque ? 5 : 0;
  for (const v of famViews){ const h = v.h || 8; if (Math.hypot(p.x - v.cx, (p.y - (v.by - h / 2)) * .8) < 8 + h / 4 + fg){ famMenu(v.fid, p); return true; } }
  for (const v of petViews13){ if (Math.hypot(p.x - v.cx, p.y - (v.by - 6)) < 10 + fg){ petMenu13(v.id, p); return true; } }
  return false;
}
{ const f0 = euAt12b; euAt12b = function(p, toque){ if (famClick(p, toque)) return true; return f0(p, toque); }; }
document.addEventListener("DOMContentLoaded", () => { const f0 = precisaFluido; precisaFluido = function(){ return f0() || Object.values(famDisp).length > 0 || csAtivo(); }; }); // o laço (18) carrega depois
// passarinho canta baixinho de vez em quando (quem está no térreo ouve)
let piuUlt = 0;
function vigiarPassaros(){
  if (andarAtual !== 0 || Date.now() - piuUlt < 45000) return;
  const id = petsExtras().find(k => pets[k].tipo === "passarinho" && !petTristeId(k)); if (!id) return;
  const m = moveis[casaDoPet(id)]; if (!m) return;
  piuUlt = Date.now() + (hashStr(id) % 20000); piar(clamp(1 - Math.hypot(me.px - m.x, me.py - m.y) / 16, .25, 1) * .7);
}

// =====================================================================
// 8. PAINEL "RELAÇÕES" (aba Nós), botões e abas
// =====================================================================
function pessoasRel(){
  const ids = [];
  if (me) ids.push(pid);
  for (const [id, j] of Object.entries(jogadores)) if (id !== pid && j && j.nome) ids.push(id);
  for (const fid of famOrdem()) ids.push(fid);
  return ids;
}
const nomeRel = id => id === pid ? "Você" : filhos[id] ? nomeFilho(id) : nomeDe(id);
function barraAmizade(v){ const b = el("div", "bar amz13"), i = el("i"); const p = clamp(v, -100, 100); i.style.left = (p < 0 ? 50 + p / 2 : 50) + "%"; i.style.width = Math.abs(p) / 2 + "%"; i.style.background = p < 0 ? "var(--bad)" : "#7FD1B2"; b.append(i); return b; }
function openRelacoes(){
  openPanel("relacoes", "Relações 💞", corpo => {
    const lista = el("div", "list"), dica = el("details", "dica13");
    const sm = el("summary", null, "O que cada nível destrava"); dica.append(sm);
    const ul = el("ul"); for (const [a, b] of DESTRAVA) ul.append(el("li", null, a + ": " + b)); dica.append(ul);
    const topo = el("div", "hbtns");
    if (!visitando) topo.append(btn("💍 Joalheria", "btn ghost", openJoalheria));
    if (roupaCasamentoLiberada()) topo.append(btn("💒 Casamento", "btn ghost", openCasamento));
    corpo.append(topo, lista, dica);
    let sig = null;
    const upd = () => {
      const ids = pessoasRel(), s = JSON.stringify([ids, rels, sobrenome, Object.keys(filhos).length]); if (s === sig) return; sig = s; lista.textContent = "";
      if (sobrenome) lista.append(el("p", "muted", "Família " + sobrenome + " 🏡"));
      const pares = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++){
        const a = ids[i], b = ids[j]; if (ehFilhoId(a) && ehFilhoId(b)) continue;
        const r = relDe(a, b); if (!r && a !== pid && b !== pid) continue;
        pares.push([a, b, r, (a === pid || b === pid ? 1000 : 0) + (r ? Math.abs(+r.amizade || 0) + (+r.romance || 0) : 0)]);
      }
      pares.sort((x, y) => y[3] - x[3]);
      if (!pares.length) lista.append(el("p", "muted", "Ninguém por aqui ainda. Conversem, abracem, brinquem: as relações aparecem aqui."));
      for (const [a, b, r] of pares){
        const row = el("div", "rel13"), cab = el("div", "relcab13"), faces = el("div", "faces13"), tx = el("div", "tx");
        faces.append(rostoCanvas(a), rostoCanvas(b));
        const am = estAmizade(r), st = r && ROM_TXT[r.status] && romPermitido(a, b) ? ROM_TXT[r.status] : null, filho = ehFilhoId(a) || ehFilhoId(b);
        tx.append(el("strong", null, nomeRel(a) + " e " + nomeRel(b)), el("small", null, (st ? st[1] + " " + st[0] + " · " : "") + am.ic + " " + (filho ? (am.k === "desconhecido" ? "Ainda se conhecendo" : am.nome.replace(/^Conhecidos$/, "Pertinho")) : am.nome)));
        cab.append(faces, tx); row.append(cab);
        const w1 = el("div", "need"), r1 = el("div", "row"); r1.append(el("span", null, "Amizade"), el("span", null, String(r ? +r.amizade || 0 : 0))); w1.append(r1, barraAmizade(r ? +r.amizade || 0 : 0)); row.append(w1);
        if (romPermitido(a, b) && r && (+r.romance || 0) > 0){ const w2 = el("div", "need"), r2 = el("div", "row"); r2.append(el("span", null, "Romance"), el("span", null, String(+r.romance || 0))); const br = barra(+r.romance || 0, "#F28CB0"); br.firstChild.style.background = "#F28CB0"; w2.append(r2, br); row.append(w2); }
        lista.append(row);
      }
    };
    upd(); return upd;
  });
}
// "Nós": relações, joalheria, casamento; título com o sobrenome
{ const f0 = nosBotoes9; nosBotoes9 = function(){
  const g = f0(), mk = (ic, tx, sub, fn) => { const b = btn("", "btn ghost escolha", () => { closePanel(); fn(); }); b.append(el("strong", null, ic + " " + tx), el("small", null, sub)); b.setAttribute("aria-label", tx + ": " + sub); return b; };
  const meus = Object.values(rels).filter(r => r && (r.a === pid || r.b === pid)), cas = meus.find(r => r.status === "noivos" || r.status === "casados");
  g.prepend(mk("💞", "Relações", meus.length ? meus.length + (meus.length === 1 ? " relação" : " relações") + " · níveis e destraves" : "Amizade e romance de cada par", openRelacoes));
  if (!visitando){
    g.append(mk("💍", "Joalheria", dadosEu().anel ? "Anel na caixinha ✓" : "Anéis de noivado", openJoalheria));
    if (cas) g.append(mk("💒", cas.status === "casados" ? "Casados" : "Casamento", cas.status === "casados" ? "Sobrenome da casa" : casamento && casamento.rk === relKey(cas.a, cas.b) ? "Marcado!" : "Marcar a data", openCasamento));
  }
  return g;
}; }
{ const f0 = openFamilia; openFamilia = function(){ f0(); if (painel && painel.id === "familia" && sobrenome){ const h = painel.el.querySelector(".sheet-hd h2"); if (h) h.textContent = "Família " + sobrenome + " 💞"; } }; }
// ⚙️ aba Casa: todos os bichinhos e adoção
{ const f0 = ITENS16.casa; ITENS16.casa = function(){
  const l = f0(), i = l.findIndex(x => x.ic === "🐱");
  const n = petsOrdem().length, it = { ic: "🐾", t: "Bichinhos", sub: petsOrdem().map(k => pets[k].nome || PET13[pets[k].tipo].nome).join(", ") || "O bichinho da casa", fn: openPets };
  if (i >= 0) l[i] = it; else l.push(it);
  if (!visitando && n < FAMILIA.petsMax) l.push({ ic: "🏠", t: "Adotar bichinho", sub: "Coelho, peixinho, passarinho… (" + n + "/" + FAMILIA.petsMax + ")", fn: openAdocao });
  return l;
}; }
// computador: joalheria e adoção (dá pra fazer pelo celular também, nas abas)
{ const f0 = MENU_EXTRA.pc; MENU_EXTRA.pc = (id, m) => { const l = f0(id, m); if (!visitando) l.push({ nome: "Joalheria 💍", info: "Anéis de noivado", fn: openJoalheria }, { nome: "Adotar bichinho 🐾", info: petsOrdem().length + "/" + FAMILIA.petsMax, fn: openAdocao }); return l; }; }
// avisos no banner: pedido, hora do casamento, convite pra assistir
{ const f0 = bannerLeva7; bannerLeva7 = function(){
  if (me){
    const pd = Object.entries(pedidos).find(([, g]) => g && g.para === pid && g.estado === "pedido");
    if (pd){ const [id, g] = pd; return { key: "p13" + id, partes: () => [el("span", null, nomeDe(g.de) + (g.tipo === "casamento" ? " está te pedindo em casamento 💍" : " está se declarando pra você 💌")), btn("Ver", "btn small", () => openPedido(id))] }; }
    const c = casamento;
    if (c && csHora() && !csAtivo() && !(c.ini && csFase() && csFase().f === "fim")){
      if (csNoivo(pid) && !(c.chegou || {})[pid]) return { key: "n13" + c.criado, partes: () => [el("span", null, "Chegou a hora do casamento! 💒"), btn("Ir pro altar", "btn small", irAltar)] };
      if (!csNoivo(pid) && !(me.acao && me.acao.id === "cas-assistir")) return { key: "w13" + c.criado, partes: () => [el("span", null, "Casamento de " + nomeDe(c.a) + " e " + nomeDe(c.b) + "! 💒"), btn("Assistir", "btn small", assistirCasamento)] };
    }
    if (c && csAtivo() && !csNoivo(pid) && !(me.acao && me.acao.id === "cas-assistir")) return { key: "w13a" + c.ini, partes: () => [el("span", null, "A cerimônia está acontecendo 💒"), btn("Assistir", "btn small", assistirCasamento)] };
  }
  return f0();
}; }
CONQUISTAS.push(
  { id: "casados", nome: "Casados 💍", txt: "Disseram sim na casinha.", meta: 1, val: () => Object.values(rels).some(r => r && r.status === "casados") ? 1 : 0 },
  { id: "melhoresAmigos", nome: "Unha e carne", txt: "Uma dupla de melhores amigos na casa.", meta: 1, val: () => Object.values(rels).some(r => r && (+r.amizade || 0) >= 75) ? 1 : 0 },
  { id: "familiaGrande", nome: "Família grande", txt: "Três filhos na casinha.", meta: 3, val: () => numFilhos() },
  { id: "zoologico", nome: "Mini zoológico", txt: "Três bichinhos morando juntos.", meta: 3, val: () => petsOrdem().length },
  { id: "boletim10", nome: "Nota 10", txt: "Um boletim nota 10.", meta: 1, val: () => Object.values(filhos).some(f => f && Object.values(f.boletim || {}).some(n => n >= 10)) ? 1 : 0 }
);

// =====================================================================
// 9. MIGRAÇÃO, OUVINTES E O RELÓGIO DE 1 SEGUNDO
// =====================================================================
let l13Migrou = false, l13BebeTentou = 0;
function migrarLeva13(){
  if (!me || !casaOk || visitando || l13Migrou || !relCarregado || !bbCarregado || !statsCarregados || !moveisCarregados) return;
  l13Migrou = true;
  Promise.all([ref("casa/bebe").once("value"), ref("casa/leva13").once("value")]).then(([sb, sl]) => {
    const b = sb.val();
    // bebê da versão antiga → filho (id fixo pelo nascimento: duas migrações ao mesmo tempo dão no mesmo filho)
    if (b && b.nasceu){
      const fid = "f" + Math.floor(b.nasceu).toString(36) + "a", ps = Object.keys(b.pais || {});
      const dados = Object.assign(visualFilho(jogadores[ps[0]] || {}, jogadores[ps[1]] || {}, b.nasceu | 0), b, { migrado: srvNow() });
      txn("casa/filhos/" + fid, cur => cur ? undefined : dados).then(() => ref("casa/bebe").remove().catch(() => {}));
    }
    if (sl.exists()) return;
    return txn("casa/leva13", c => c ? undefined : srvNow()).then(ok => {
      if (!ok) return;
      const mor = Object.entries(jogadores).filter(([, j]) => j && j.nome && !j.visita).map(([k]) => k);
      let casal = null;
      if (b && b.pais){ const ps = Object.keys(b.pais).filter(k => jogadores[k]); if (ps.length === 2) casal = ps; }
      if (!casal && gravidez && gravidez.a && gravidez.b) casal = [gravidez.a, gravidez.b];
      const temCama = Object.values(todosMoveis).some(m => m && ["casal", "dossel"].includes(baseT(m.t)));
      if (!casal && mor.length === 2 && ((stats.namoros || 0) > 0 || temCama)) casal = mor;
      for (let i = 0; i < mor.length; i++) for (let j = i + 1; j < mor.length; j++){
        const a = mor[i], bb = mor[j], ehCasal = casal && casal.includes(a) && casal.includes(bb) && romanceOk(a) && romanceOk(bb);
        const x = a < bb ? a : bb, y = a < bb ? bb : a;
        txn("casa/rel/" + relKey(a, bb), cur => { // quem já tinha interagido não perde nada: só sobe até o ponto de partida
          const r = Object.assign({ a: x, b: y, amizade: 0, romance: 0, n: 0 }, cur || {});
          r.amizade = Math.max(+r.amizade || 0, ehCasal ? 60 : 30); r.n = Math.max(r.n || 0, 1); r.ult = srvNow(); r.migrado = 1;
          if (ehCasal){ r.romance = Math.max(+r.romance || 0, 75); if (REL_ROM.indexOf(r.status || "") < 2) r.status = "namorando"; }
          return r;
        });
      }
    });
  }).catch(() => { l13Migrou = false; });
}
{ const f0 = leva11Ouvir; leva11Ouvir = function(){
  f0();
  on(ref("casa/rel"), "value", s => { rels = s.val() || {}; relCarregado = true; refreshPanel("relacoes"); refreshPanel("casamento"); checarConquistas(); });
  on(ref("casa/pedido"), "value", s => aoMudarPedidos(s.val() || {}));
  on(ref("casa/casamento"), "value", s => { const ant = casamento; casamento = s.val(); csCarregado = true; if (ant && casamento && !ant.ini && casamento.ini && me && (casamento.andar || 0) === andarAtual) sfx("fanfarra"); refreshPanel("casamento"); bannerKey = null; });
  on(ref("casa/sobrenome"), "value", s => { sobrenome = String(s.val() || "").slice(0, 24); refreshPanel("relacoes"); });
}; }
{ const f0 = leva11Reset; leva11Reset = function(){
  f0();
  rels = {}; relCarregado = false; pedidos = {}; pdCarregado = false; pdAberto = {}; pdVisto = {};
  casamento = null; csCarregado = false; csTx = {}; csFeito = {}; csFalou = {}; sobrenome = "";
  famFestaVista = {}; famBolo = {}; famTentou = {}; petsAnt = {}; l13Migrou = false;
  for (const k of Object.keys(famDisp)) delete famDisp[k];
}; }
setInterval(() => {
  if (!me) return;
  try {
    migrarLeva13(); vigiarPedidos(); vigiarCasamento(); vigiarFilhos(); vigiarPassaros();
    if (!$("screenGame").hidden){ refreshPanel("relacoes"); }
  } catch(e){ console.error(e); }
}, 1000);
