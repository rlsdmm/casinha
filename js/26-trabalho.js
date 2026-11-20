"use strict";
// Casinha · leva 14: carreiras com horário e cargos (expediente pelo relógio), contas da casa e serviços (delivery, faxineira, babá, jardineiro)
// Carregado ANTES do 18-laco.js. Ganchos: embrulha avatarSprite, retrato, itemPago, opcoes, openCreator, leva10Esconde, leva10Update,
// leva10Click, addLeva10Objs, drawLabels10, leva11Luzes, carroAnim, abrirPasseio, useFurn, agirSozinho, bannerLeva7, contadores16,
// ITENS16.casa/ajustes, MENU_EXTRA.pc, openTarefas, openPanel("cozinha"), desejoAtual, bebeNeeds, filhoNeeds, nomeDe, pessoasRel,
// rostoCanvas, leva11Ouvir/leva11Reset; empurra CONDICOES (humor) e CONQUISTAS.
// =====================================================================
// LEVA 14 — dados novos:
//   jogadores/<pid>/carreira = { id, cargo (0..), desemp 0..100, turnos, promo, desde, ultDia "AAAA-MM-DD" (Brasília) }
//   jogadores/<pid>/trab = { car, cargo, ini, fim, dia, hum (soma do humor na saída), carro 0|1, ev: { op } , pago (ts) }   o expediente
//   jogadores/<pid>/antesTrab = { traje, roupa, acess }   roupa de antes do uniforme (volta no resumo)
//   casa/contas/<segunda AAAA-MM-DD> = { luz, agua, internet, base, total, criada, pago: { pid: valor }, quitada? }
//   casa/contasInicio = "AAAA-MM-DD" (1ª semana sem conta)  ·  casa/contasOff = true (Ajustes desligou)
//   casa/servicos/pedidos/<push> = { por, comida, porcoes, ini, chega, entregue?, lado }
//   casa/servicos/visitas/<push> = { tipo: faxina|jardim, por, ini, alvos: [[x, y, id]], feito: { id: 1 } }
//   casa/servicos/faxSemanal = { por, prox }  ·  casa/servicos/baba = { on, por, desde, pagoAte }  ·  casa/servicos/babaVisita = { ini, por }
//   casa/servicos/deve/<pid> = $ que a assinatura (faxina semanal) cobrou com a pessoa fora; paga quando ela entra
//   casa/rel/<npc-…_pid>  amizade com os NPCs de serviço (ids "npc-beto", "npc-rosa", "npc-lu", "npc-tiao")
// Ganchos pra leva 15: SERV_NPC (NPCs com nome, visual e papel), npcServEstado/rotaServico (NPC que anda pela casa com alvos),
//   portaRua() (onde se chega de fora), entradaTile() (primeiro quadrado de dentro), luzCortada(), contaAtrasada(), noTrabalho(j)
// Teste: trabAvancar(min) · TRAB.duracao (ms) · famHora(h, dia) (horário de Brasília do 25-familia) · carreiraTeste(id, cargo, desemp)
//   contasAvancar(dias) · contasGerarAgora() · pedirTeste(comida) · faxinaTeste() · CONTAS.desloc
// =====================================================================
const TRAB = { duracao: 25 * 60000, evento: .35, sai: 6500, custo: { energia: -22, diversao: -18, fome: -12, higiene: -8 }, xp: 15 };
const DIAS_SEM = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
// salários por expediente (um por dia de trabalho); hab = nível da habilidade pra chegar no cargo
const CARREIRAS = {
  cozinha: { nome: "Cozinha", ic: "🍳", hab: "culinaria", dias: [2, 3, 4, 5, 6], janela: [10, 20], unif: "chef",
    cargos: [["Lavador(a) de pratos", 150], ["Auxiliar de cozinha", 190], ["Cozinheiro(a) de linha", 240], ["Confeiteiro(a)", 300], ["Subchef", 370], ["Chef de cozinha", 450], ["Chef estrelado(a)", 560]] },
  tecnologia: { nome: "Tecnologia", ic: "💻", hab: "logica", dias: [1, 2, 3, 4, 5], janela: [8, 16], unif: "tech",
    cargos: [["Estagiário(a) de TI", 150], ["Suporte técnico", 190], ["Programador(a) júnior", 240], ["Programador(a) pleno", 300], ["Programador(a) sênior", 370], ["Líder técnico(a)", 450], ["Diretor(a) de tecnologia", 560]] },
  artes: { nome: "Artes", ic: "🎨", hab: "pintura", dias: [1, 2, 3, 4, 5], janela: [10, 19], unif: "artes",
    cargos: [["Ajudante de ateliê", 150], ["Ilustrador(a)", 190], ["Muralista", 240], ["Designer gráfico", 300], ["Artista de galeria", 370], ["Diretor(a) de arte", 450], ["Artista renomado(a)", 560]] },
  saude: { nome: "Saúde", ic: "🩺", hab: "charme", dias: [1, 3, 5, 6], janela: [7, 20], unif: "saude",
    cargos: [["Recepcionista da clínica", 160], ["Auxiliar de enfermagem", 200], ["Técnico(a) de enfermagem", 250], ["Enfermeiro(a)", 310], ["Enfermeiro(a)-chefe", 380], ["Médico(a) residente", 460], ["Médico(a)-chefe", 580]] },
  jardinagem: { nome: "Jardinagem e paisagismo", ic: "🌻", hab: "jardinagem", dias: [1, 2, 3, 4, 5, 6], janela: [6, 13], unif: "jardim",
    cargos: [["Ajudante de jardim", 140], ["Jardineiro(a)", 180], ["Florista", 230], ["Paisagista júnior", 290], ["Paisagista", 360], ["Designer de jardins", 440], ["Mestre paisagista", 540]] },
  musica: { nome: "Música", ic: "🎵", hab: "musica", dias: [0, 3, 4, 5, 6], janela: [17, 23], unif: "musica",
    cargos: [["Músico(a) de rua", 140], ["Músico(a) de barzinho", 180], ["Instrumentista de banda", 230], ["Professor(a) de música", 290], ["Músico(a) de estúdio", 360], ["Maestro(ina)", 440], ["Estrela da música", 560]] }
};
const HAB_CARGO = [1, 1, 2, 3, 4, 5, 6]; // nível da habilidade pedido pra CHEGAR em cada cargo
function horarioTxt(c){
  const d = c.dias; let ini = -1;
  if (d.length > 2) for (const s of d) if (d.every(x => d.includes((x + 6) % 7) || x === s) && d.every((x, i) => d.includes((s + i) % 7))){ ini = s; break; }
  return (ini >= 0 ? DIAS_SEM[ini] + "–" + DIAS_SEM[(ini + d.length - 1) % 7] : d.map(x => DIAS_SEM[x]).join(", ")) + " · saída das " + c.janela[0] + "h às " + c.janela[1] + "h";
}

// ---------------- uniformes (trajes de trabalho; também vestem os NPCs de serviço) ----------------
// base = traje desenhado por baixo; roupa = cor; hat = some o acessório (chapéu no lugar)
const UNIF = {
  chef:   { nome: "Dólmã de chef", base: 0, roupa: () => R_BRANCO, hat: 1 },
  tech:   { nome: "Moletom com crachá", base: 4, roupa: () => 2 },
  artes:  { nome: "Macacão de ateliê", base: 3, roupa: () => 0, hat: 1 },
  saude:  { nome: "Jaleco", base: 0, roupa: () => 0 },
  jardim: { nome: "Macacão de jardineiro", base: 3, roupa: () => 6, hat: 1 },
  musica: { nome: "Traje de palco", base: 8, roupa: () => 7 },
  moto:   { nome: "Jaqueta de entregador", base: 0, roupa: () => 1, hat: 1 },
  faxina: { nome: "Uniforme de faxina", base: 3, roupa: () => 5, hat: 1 },
  baba:   { nome: "Avental de babá", base: 1, roupa: () => 4 }
};
const TJ_UNIF = {}; // índice em TRAJES -> chave do UNIF
for (const k of Object.keys(UNIF)){ TJ_UNIF[TRAJES.length] = k; UNIF[k].tj = TRAJES.length; TRAJES.push({ nome: UNIF[k].nome, trabalho: 1 }); }
const unifDe = p => p && TJ_UNIF[p.traje] ? UNIF[TJ_UNIF[p.traje]] : null;
function vUnif(v){ const u = unifDe(v); return u ? Object.assign({}, v, { traje: u.base, roupa: u.roupa(), acess: u.hat ? 0 : v.acess }) : v; }
// detalhes por cima do traje base (em pé): chapéus, crachá, jaleco, avental, respingos de tinta
function unifOverlay(k, v, cx, by, dir, frame, pose){
  if (pose.indexOf("sit") === 0 || pose.indexOf("lie") === 0) return;
  const g = corpoGeo(v), walk = frame === 1 || frame === 3, bob = pose.indexOf("breath") >= 0 ? 1 : walk ? -1 : 0;
  const ty = by - 9 + bob - g.dh, hy = by - 18 + bob - g.dh, side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  const W0 = g.w[0], st = v.estilo, alto = st === 8 ? 3 : st === 3 || st === 9 ? 2 : 0;
  if (k === "chef"){ // toque branco alto
    const y = hy - 3 - alto, b = "#FFFFFF", bD = "#DCD6EA";
    R(cx - 4, y + 1, 8, 2, b); R(cx - 4, y + 2, 8, 1, bD); R(cx - 5, y - 3, 10, 4, b); R(cx - 4, y - 4, 8, 1, b); P(cx + 3, y - 2, bD); P(cx + 4, y - 1, bD); P(cx - 2, y - 3, bD);
    if (dir === "down"){ for (const yy of [ty + 1, ty + 3]){ P(cx - 2, yy, "#3A2433"); P(cx + 1, yy, "#3A2433"); } R(cx - 1, ty, 2, 1, "#D9483D"); }
  } else if (k === "tech"){ // crachá no cordão e fone com microfone
    const f = "#8E8AA6";
    R(cx - 5, hy - 1 - alto, 10, 1, f);
    if (!side){ R(cx - 6, hy + 2, 1, 3, f); R(cx + 5, hy + 2, 1, 3, f); if (dir === "down"){ P(cx - 5, hy + 5, f); P(cx - 4, hy + 6, f); P(cx - 3, hy + 6, "#7FB8E8"); } }
    else { R(X(1, 2), hy + 2, 2, 3, f); P(X(-1, 1), hy + 6, f); P(X(-2, 1), hy + 6, "#7FB8E8"); }
    if (dir === "down"){ P(cx - 2, ty, "#7FB8E8"); P(cx + 1, ty, "#7FB8E8"); P(cx - 1, ty + 1, "#7FB8E8"); R(cx - 1, ty + 2, 3, 2, "#FFFFFF"); P(cx, ty + 3, "#378ADD"); }
  } else if (k === "artes"){ // boina vermelha e respingos de tinta
    const y = hy - 2 - alto, c = "#D9483D";
    R(cx - 5, y, 9, 2, c); R(cx - 4, y - 1, 8, 1, c); P(cx - 4, y, sh(c, .25)); P(cx, y - 2, c); R(cx - 5, y + 1, 9, 1, sh(c, -.2));
    if (dir !== "up"){ P(cx - 2, ty + 3, "#F6C667"); P(cx + 1, ty + 4, "#7FB8E8"); P(cx - 1, ty + 6, "#E8607A"); P(cx + 2, by - 3, "#B49CF4"); }
  } else if (k === "saude"){ // jaleco branco aberto e estetoscópio
    const b = "#FFFFFF", bD = "#DCD6EA";
    if (dir === "down"){ R(cx - W0, ty, 2, 6, b); R(cx + W0 - 2, ty, 2, 6, b); R(cx + W0 - 1, ty + 1, 1, 5, bD); P(cx - 1, ty, "#6E6A80"); P(cx, ty, "#6E6A80"); P(cx - 1, ty + 1, "#6E6A80"); P(cx - 1, ty + 2, "#9A96AE"); }
    else if (dir === "up"){ R(cx - W0, ty, 2 * W0, 6, b); R(cx - W0, ty + 5, 2 * W0, 1, bD); R(cx, ty + 2, 1, 4, bD); }
    else { R(X(-W0, 2 * W0), ty, 2 * W0, 6, b); R(X(-W0, 1), ty, 1, 6, bD); }
  } else if (k === "jardim"){ // chapéu de palha de aba larga
    const y = hy - 2 - alto, pa = "#F2D58A", paD = "#D9B45A";
    R(cx - 7, y + 2, 14, 1, pa); R(cx - 6, y + 3, 12, 1, paD); R(cx - 4, y - 1, 8, 3, pa); R(cx - 3, y - 2, 6, 1, pa); R(cx - 4, y + 1, 8, 1, "#B5651D"); P(cx - 3, y - 1, "#FCE9B8");
  } else if (k === "musica"){ // gravata-borboleta e broche de nota
    if (dir === "down"){ R(cx - 1, ty + 1, 2, 3, sh(ROUPAS[7], .1)); R(cx - 2, ty, 4, 1, "#1B1528"); P(cx - 2, ty, "#3A2433"); P(cx + 1, ty, "#3A2433"); P(cx + 2, ty + 2, C.gold); }
  } else if (k === "moto"){ // boné vermelho de entregador e logo
    const y = hy - 2 - alto, c = "#D9483D";
    R(cx - 4, y, 8, 1, c); R(cx - 5, y + 1, 10, 2, c); P(cx - 1, y - 1, sh(c, -.25));
    if (dir === "down") R(cx - 5, y + 3, 10, 1, sh(c, -.25)); else if (side) R(X(-8, 4), y + 3, 4, 1, sh(c, -.25));
    if (dir === "down"){ P(cx - 1, ty + 2, "#F6C667"); P(cx, ty + 2, "#F6C667"); P(cx, ty + 3, "#F6C667"); }
  } else if (k === "faxina"){ // lenço na cabeça
    const y = hy - 1 - alto, c = "#F49AAE";
    R(cx - 5, y, 10, 2, c); R(cx - 4, y - 1, 8, 1, c); P(cx - 3, y - 1, "#F9C9D6"); P(cx + 1, y + 1, "#FFFFFF"); P(cx - 3, y + 1, "#FFFFFF");
    if (dir === "up"){ R(cx - 1, y + 2, 2, 2, c); P(cx - 2, y + 3, c); P(cx + 1, y + 3, c); } else if (side) R(X(3, 2), y + 1, 2, 2, c);
  } else if (k === "baba"){ // avental branco com bolso de coração
    if (dir === "down"){ R(cx - 2, ty + 2, 4, 5, "#FFFFFF"); R(cx - 2, ty + 6, 4, 1, "#DCD6EA"); P(cx - 1, ty + 4, "#F0707A"); P(cx, ty + 4, "#F0707A"); R(cx - 3, ty + 2, 1, 1, "#FFFFFF"); P(cx + 2, ty + 2, "#FFFFFF"); }
    else if (side) R(X(-3, 2), ty + 2, 2, 5, "#FFFFFF");
  }
}
{ const f0 = avatarSprite; avatarSprite = function(p, dir, frame, pose){
  const k = p && TJ_UNIF[p.traje]; if (!k) return f0(p, dir, frame, pose);
  const v0 = visual(p), v = vUnif(v0), al = p.alianca && typeof ANEIS !== "undefined" && ANEIS[p.alianca] ? p.alianca : "";
  const key = ["av14", k, v.corpo, v.roupa, v.traje, v.cabelo, v.estilo, v.pele, v.barba, v.acess, v.barriga, v.forma, v.altura, v.fisico, dir, frame, pose, al].join(":");
  return sprite(key, 16, 29, (ox, oy) => { const ps = String(pose || "stand"); drawAvatarLocal(v, ox + 8, oy + 27, dir, frame, pose); unifOverlay(k, v, ox + 8, oy + 27, dir, frame, ps); if (al) anelNaMao(v, ox + 8, oy + 27, dir, frame, ps, al); });
}; }
{ const f0 = retrato; retrato = function(v, ...r){ return f0(v ? vUnif(v) : v, ...r); }; }
// no criador, os uniformes não aparecem (são só do trabalho)
{ const f0 = itemPago; itemPago = function(campo, i, it){ return it && it.trabalho ? null : f0(campo, i, it); }; }
{ const f0 = opcoes; opcoes = function(id, itens){ return f0(id, (itens || []).filter(Boolean)); }; }
{ const f0 = openCreator; openCreator = function(edit, refazer){
  f0(edit, refazer);
  if (TRAJES[creator.traje] && TRAJES[creator.traje].trabalho){ const a = dadosEu().antesTrab; creator.traje = a ? a.traje | 0 : 0; if (a){ creator.roupa = a.roupa | 0; creator.acess = a.acess | 0; } montarCriador(); }
}; }

// ---------------- relógio de Brasília (o mesmo do 25-familia: famHora(h, dia) vale pra testar) ----------------
const dia14 = t => new Date((t || srvNow()) - 3 * HORA).toISOString().slice(0, 10);
function janelaAberta(c, t){ const a = agoraBR(t); return c.dias.includes(a.dw) && a.h >= c.janela[0] && a.h < c.janela[1]; }
// próxima saída possível (texto)
function proxJanelaTxt(c){
  const a = agoraBR();
  if (c.dias.includes(a.dw) && a.h < c.janela[0]) return "hoje às " + c.janela[0] + "h";
  for (let i = 1; i <= 7; i++){ const d = (a.dw + i) % 7; if (c.dias.includes(d)) return (i === 1 ? "amanhã" : DIAS_SEM[d]) + " às " + c.janela[0] + "h"; }
  return "—";
}
const horaTxt = t => { const d = new Date(t - 3 * HORA); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); };

// ---------------- estado da carreira e do expediente ----------------
const carreiraDe = j => { const c = j && j.carreira; return c && CARREIRAS[c.id] ? c : null; };
const minhaCarreira = () => carreiraDe(dadosEu());
const trabDe = j => { const tr = j && j.trab; return tr && tr.ini && !tr.pago && CARREIRAS[tr.car] ? tr : null; };
const noTrabalho = (j, t) => { const tr = trabDe(j); t = t || srvNow(); return !!tr && t >= tr.ini && t < tr.fim; };
const meuTrab = () => trabDe(dadosEu());
const meNoTrabalho = () => !!me && !visitando && !!meuTrab(); // até o resumo, o boneco está fora
const cargoDe = c => CARREIRAS[c.id].cargos[clamp(c.cargo | 0, 0, CARREIRAS[c.id].cargos.length - 1)];
function salarioDe(c){ const car = CARREIRAS[c.id], [, s] = cargoDe(c); return Math.round(s * (1 + .03 * (habNv(car.hab) - 1)) * (bonusAtivo("ima") ? 1.2 : 1)); }
const humorBonus = soma => soma >= 8 ? 6 : soma >= 3 ? 3 : soma >= -2 ? 0 : soma >= -7 ? -3 : -5;
function reqPromo(c){
  const car = CARREIRAS[c.id], prox = (c.cargo | 0) + 1; if (prox >= car.cargos.length) return null;
  const hn = HAB_CARGO[prox] || prox, h = meuHumor();
  return { prox, cargo: car.cargos[prox], hab: car.hab, habNv: hn, habOk: habNv(car.hab) >= hn, desemp: +c.desemp || 0, desOk: (+c.desemp || 0) >= 100, humOk: h.soma >= -2, humTxt: h.n.em + " " + h.n.nome };
}
function escolherCarreira(id){
  if (!me || visitando) return;
  const c = minhaCarreira();
  if (meNoTrabalho()){ toast("Você está no meio do expediente 💼"); return; }
  const novo = { id, cargo: 0, desemp: 0, turnos: 0, promo: c && c.id === id ? c.promo || 0 : 0, desde: srvNow(), ultDia: c ? c.ultDia || null : null };
  ref("jogadores/" + pid + "/carreira").set(novo).then(() => { toast(CARREIRAS[id].ic + " Bem-vindo(a) à " + CARREIRAS[id].nome + "! Cargo: " + CARREIRAS[id].cargos[0][0] + "."); sfx("pop"); if (!c) historia("carreira_" + pid + "_" + id, CARREIRAS[id].ic, nomeDe(pid) + " começou a trabalhar com " + CARREIRAS[id].nome.toLowerCase()); refreshPanel("trabalho"); });
}
// lugar de saída: quadrado de dentro mais perto da rua (embaixo); no 2º andar sai direto
function linhaSaida(){ return H > H_CASA ? H - 2 : HC - 1; }
function irTrabalhar(){
  if (!me || visitando) return;
  const c = minhaCarreira(); if (!c){ openTrabalho(); return; }
  const car = CARREIRAS[c.id], t = srvNow();
  if (meuTrab()){ toast("Você já está no trabalho 💼"); return; }
  if (c.ultDia === dia14(t)){ toast("Hoje já teve expediente. Até a próxima! 😊"); return; }
  if (!janelaAberta(car)){ toast("Fora do horário. Próxima saída: " + proxJanelaTxt(car) + "."); return; }
  if (me.needs.energia < 15){ toast("Cansado(a) demais pra trabalhar 😴 Descanse um pouco antes."); return; }
  closePanel();
  const d = dadosEu(), u = UNIF[car.unif], up = { traje: u.tj };
  if (!TJ_UNIF[d.traje]) up.antesTrab = { traje: d.traje | 0, roupa: d.roupa | 0, acess: d.acess | 0 };
  ref("jogadores/" + pid).update(up).catch(() => {});
  if (me.acao) setAcao(null);
  const sair = () => {
    const t0 = srvNow(), carro = !!carroPos() && andarAtual === 0 && !psAtivo() && !Object.entries(jogadores).some(([id, j]) => id !== pid && noTrabalho(j, t0) && j.trab.carro);
    const tr = { car: c.id, cargo: c.cargo | 0, ini: t0, sd: t0, fim: t0 + TRAB.duracao, dia: dia14(t0), hum: meuHumor().soma, carro: carro ? 1 : 0 };
    trabSnap = Object.assign({}, me.needs); me.path = []; me.plano = null;
    ref("jogadores/" + pid).update({ trab: tr, "carreira/ultDia": tr.dia, acao: null }).then(() => {
      toast(car.ic + " Bom trabalho! Volta às " + horaTxt(tr.fim) + ". Pode fechar o jogo: o expediente conta sozinho.");
      sfx("porta");
    });
  };
  if (andarAtual !== 0){ sair(); return; }
  const ly = linhaSaida();
  const path = bfs(me.tx, me.ty, (x, y) => y === ly);
  if (!path){ sair(); return; }
  toast("Vestindo o uniforme e saindo pra trabalhar…");
  goTo(null, (x, y) => y === ly, () => { faceTo(me.tx, me.ty + 1); setTimeout(sair, 400); });
}
// eventos de escolha (1 por expediente): ops = { t, desemp, needs, $, sorte (chance de dar certo), xp }
const EVENTOS_TRAB = {
  geral: [
    { txt: "Um colega pediu ajuda bem na hora do seu relatório.", ops: [{ t: "Ajudar o colega 🤝", desemp: 4, needs: { social: 15 }, res: "O colega ficou te devendo uma!" }, { t: "Terminar o relatório 📄", desemp: 7, needs: { diversao: -6 }, res: "Relatório entregue no capricho." }] },
    { txt: "A chefia perguntou quem topa ficar um pouquinho mais.", ops: [{ t: "Eu fico! ⏰", desemp: 8, $: 40, needs: { energia: -10 }, res: "Hora extra paga: +$40." }, { t: "Hoje não dá 🙏", desemp: 0, needs: { diversao: 6 }, res: "Saiu na hora certinha." }] },
    { txt: "Bateu aquele sono depois do almoço…", ops: [{ t: "Cafezinho e foco ☕", desemp: 5, needs: { energia: 6 }, res: "Produtividade lá em cima." }, { t: "Fechar o olho 5 minutinhos 😴", desemp: -2, needs: { energia: 14 }, res: "Ninguém viu… acho." }] },
    { txt: "Você teve uma ideia ousada pra apresentar na reunião.", ops: [{ t: "Apresentar agora! 💡", sorte: .6, desemp: 12, falha: -3, res: "A chefia amou a ideia!", resFalha: "Não colou dessa vez 😅" }, { t: "Amadurecer a ideia", desemp: 3, res: "Fica pra próxima reunião." }] }
  ],
  cozinha: [{ txt: "Um cliente famoso pediu um prato fora do cardápio!", ops: [{ t: "Improvisar uma receita 👩‍🍳", sorte: .65, desemp: 12, falha: -2, xp: 10, res: "Ele pediu bis!", resFalha: "Passou do ponto…" }, { t: "Seguir o cardápio", desemp: 3, res: "Clássico nunca falha." }] }],
  tecnologia: [{ txt: "O sistema caiu em plena hora do pico!", ops: [{ t: "Consertar na raça 🛠️", desemp: 10, xp: 8, needs: { energia: -12 }, res: "Você salvou o dia!" }, { t: "Chamar o suporte 📞", desemp: 3, res: "Resolvido, sem drama." }] }],
  artes: [{ txt: "Uma galeria quer ver seu portfólio hoje.", ops: [{ t: "Mostrar o trabalho novo 🖼️", sorte: .6, desemp: 12, falha: -2, xp: 8, res: "Eles querem expor!", resFalha: "Ainda não era a hora." }, { t: "Mostrar os clássicos", desemp: 4, res: "Elogios garantidos." }] }],
  saude: [{ txt: "Um paciente está muito nervoso na sala de espera.", ops: [{ t: "Conversar com calma 💬", desemp: 9, xp: 8, needs: { social: 10 }, res: "Ele saiu sorrindo." }, { t: "Chamar alguém de plantão", desemp: 2, res: "Tudo sob controle." }] }],
  jardinagem: [{ txt: "Começou a chover no meio do serviço!", ops: [{ t: "Terminar na chuva 🌧️", desemp: 9, needs: { higiene: -12 }, xp: 6, res: "Jardim impecável (e você encharcado)." }, { t: "Esperar a chuva passar ☂️", desemp: 2, needs: { diversao: 4 }, res: "Um cafezinho até estiar." }] }],
  musica: [{ txt: "O público está pedindo bis!", ops: [{ t: "Tocar mais uma 🎸", desemp: 9, xp: 10, needs: { energia: -8, diversao: 10 }, res: "Casa abaixo!" }, { t: "Agradecer e sair", desemp: 3, res: "Deixou gostinho de quero mais." }] }]
};
function eventoDe(tr){
  const l = EVENTOS_TRAB.geral.concat(EVENTOS_TRAB[tr.car] || []), h = hash((tr.sd || tr.ini) / 1000 | 0, salaSeed, 1401);
  return l[h % l.length];
}
const eventoAberto = (tr, t) => !!tr && !tr.ev && (t || srvNow()) >= tr.ini + TRAB.duracao * TRAB.evento && (t || srvNow()) < tr.fim;
function escolherEvento(i){
  const tr = meuTrab(); if (!tr || tr.ev) return;
  ref("jogadores/" + pid + "/trab/ev").set({ op: i, at: srvNow() }).then(() => { toast("Anotado! Isso conta no resumo do dia."); refreshPanel("trabalho"); bannerKey = null; });
}
let trabSnap = null, trabFechando = false;
// fim do expediente (no meu aparelho, online): paga, desempenho, habilidade, promoção, resumo
function fecharExpediente(){
  const tr = meuTrab(); if (!tr || trabFechando || srvNow() < tr.fim) return;
  trabFechando = true;
  txn("jogadores/" + pid + "/trab/pago", c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    const c0 = minhaCarreira() || { id: tr.car, cargo: tr.cargo, desemp: 0, turnos: 0, promo: 0 }, car = CARREIRAS[tr.car];
    const c = Object.assign({}, c0, c0.id === tr.car ? {} : { id: tr.car, cargo: tr.cargo, desemp: 0 });
    const ev = eventoDe(tr), op = tr.ev && ev.ops[tr.ev.op];
    let dDes = 12 + humorBonus(tr.hum || 0) + Math.min(6, habNv(car.hab) - 1), extra = 0, evTxt = "";
    if (op){
      const deu = op.sorte == null || (hash((tr.sd || tr.ini) / 1000 | 0, salaSeed, 1402) % 100) / 100 < op.sorte;
      dDes += deu ? op.desemp || 0 : op.falha || 0; extra += deu ? op.$ || 0 : 0; evTxt = deu ? op.res : op.resFalha;
      if (op.needs) ganharNeedsSem(op.needs);
      if (op.xp && deu) ganharHab(car.hab, op.xp);
    }
    const sal = salarioDe(c), pago = pagaMudanca(sal) + extra;
    const desAnt = +c.desemp || 0; c.desemp = clamp(desAnt + dDes, 0, 100); c.turnos = (c.turnos || 0) + 1;
    // volta cansado(a)
    const custo = Object.assign({}, TRAB.custo); if (temTraco("preguicoso")) custo.energia = Math.round(custo.energia * 1.4); if (bonusAtivo("nuncaCansado")) custo.energia = 0;
    const fat = humorAgora().trab || 1; for (const k of Object.keys(custo)) custo[k] = Math.round(custo[k] * (k === "energia" ? fat : 1));
    trabSnap = null; ganharNeedsSem(custo);
    me.dinheiro += pago; saveNeeds(true); sfx("moeda");
    ganharHab(car.hab, TRAB.xp);
    // promoção
    const rq = reqPromo(c); let promo = null;
    if (rq && rq.desOk && rq.habOk && (tr.hum || 0) >= -2){ c.cargo = rq.prox; c.desemp = 20; c.promo = (c.promo || 0) + 1; promo = rq.cargo; }
    const up = { carreira: c, trab: null };
    const a = dadosEu().antesTrab; if (a){ up.traje = a.traje | 0; up.roupa = a.roupa | 0; up.acess = a.acess | 0; up.antesTrab = null; }
    ref("jogadores/" + pid).update(up).catch(() => {});
    statMais("expedientes"); xpCasal(8);
    if (typeof tarefaCheck === "function") tarefaCheck({ id: "trabalhar" });
    if (typeof checarDesejos === "function") checarDesejos({ a: { id: "trabalhar" } });
    const top = promo && c.cargo === car.cargos.length - 1;
    if (promo){
      setTimeout(() => { toastEspecial(car.ic + " Promoção! " + promo[0], "Agora ganha $" + promo[1] + " por expediente."); confete(); }, 600);
      historia("promo_" + pid + "_" + tr.car + "_" + c.cargo, "🎉", nomeDe(pid) + " foi promovido(a) a " + promo[0] + (top ? " — o topo da carreira!" : ""));
      statMais("promocoes"); addEfeito("promovido");
    }
    abrirResumo({ car, c, pago, extra, dDes, evTxt, promo, top, rq: reqPromo(c), desAnt });
  }).catch(() => {}).then(() => { trabFechando = false; });
}
function barra14(v){ const b = barra(v, "#7FD1B2"); b.firstChild.style.background = "#7FD1B2"; return b; }
function ganharNeedsSem(g){ if (!me) return; for (const [k, v] of Object.entries(g || {})) if (typeof me.needs[k] === "number") me.needs[k] = clamp(me.needs[k] + v, 0, 100); }
EFEITOS.promovido = { ic: "🎉", nome: "Promovido(a)!", v: 4, min: 360, txt: "Subiu de cargo no trabalho." };
EFEITOS.diaBom = { ic: "💼", nome: "Dia produtivo", v: 1, min: 120, txt: "Mandou bem no trabalho." };
function abrirResumo(r){
  const bom = r.dDes >= 12;
  if (bom) addEfeito("diaBom", { quieto: 1 });
  openPanel("resumoTrab", r.promo ? "Promoção! 🎉" : bom ? "Dia produtivo! 💼" : "Fim do expediente 💼", corpo => {
    corpo.append(el("p", "money", "+$" + r.pago + (r.extra ? " (com $" + r.extra + " de hora extra)" : "")));
    const ln = el("p", null, "Desempenho " + (r.dDes >= 0 ? "▲ +" : "▼ ") + r.dDes + " · " + Math.round(r.c.desemp) + "/100"); corpo.append(ln);
    corpo.append(barra14(r.c.desemp));
    if (r.evTxt) corpo.append(el("p", "muted", "💭 " + r.evTxt));
    if (r.promo) corpo.append(el("p", null, "🎉 Agora você é " + r.promo[0] + ": $" + r.promo[1] + " por expediente." + (r.top ? " Chegou ao topo da carreira!" : "")));
    else if (r.rq && r.c.desemp >= 100 && !r.rq.habOk) corpo.append(el("p", "muted", "Desempenho no máximo! Falta " + HAB[r.rq.hab].ic + " " + HAB[r.rq.hab].nome + " nível " + r.rq.habNv + " pra virar " + r.rq.cargo[0] + "."));
    else if (r.rq && r.c.desemp >= 100) corpo.append(el("p", "muted", "Desempenho no máximo! A promoção vem num dia de bom humor (De boa ou melhor)."));
    corpo.append(el("p", "muted", "Voltou cansado(a): energia e diversão caíram um pouco."));
    corpo.append(btn("Que bom 😊", "btn", closePanel));
  });
}
// teste: adianta o expediente (minutos)
function trabAvancar(min){ const tr = meuTrab(); if (!tr) return null; const d = (min || 0) * 60000; return ref("jogadores/" + pid + "/trab").update({ ini: tr.ini - d, fim: tr.fim - d }); }
function carreiraTeste(id, cargo, desemp){ return ref("jogadores/" + pid + "/carreira").set({ id, cargo: cargo | 0, desemp: desemp == null ? 0 : desemp, turnos: 0, promo: 0, desde: srvNow(), ultDia: null }); }

// =====================================================================
// 2. CONTAS DA CASA (toda segunda-feira, horário de Brasília)
// =====================================================================
// valor por semana: base pelo tamanho + luz por aparelho elétrico + água por ponto de água + internet
const CONTAS = { desloc: 0, base: 35, baseZero: 10, comodoZero: 5, quintal: 15, andar2: 25, luz: 4, agua: 3, internet: 15, internetSem: 8, vence: 3, corta: 7 };
const ELETRICOS = new Set(["tv", "tvG", "tvTubo", "game", "pc", "som", "radio", "jukebox", "fliperama", "abajur", "andon", "lava", "cogumelo", "cupcake", "saturno", "geladeira", "geladeiraG", "frigobar", "fogaoChique", "aquario", "jacuzzi", "telefone", "telmesa", "vitrineDoces", "lareira"]);
const HIDRAULICOS = new Set(["chuveiro", "ducha", "banheira", "pia", "vaso", "piscina", "jacuzzi", "fonte"]);
const APARELHOS_PARAM = new Set(["tv", "tvG", "tvTubo", "game", "pc", "som", "radio", "jukebox", "fliperama", "jacuzzi"]); // não ligam sem luz
let contas = {}, contasCarregadas = false, contasInicio = null, contasOff = false, ctTentou = {};
const agoraCt = () => srvNow() + CONTAS.desloc;
function segundaDe(t){ const d = new Date(t - 3 * HORA); const dw = d.getUTCDay(); d.setUTCDate(d.getUTCDate() - ((dw + 6) % 7)); return d.toISOString().slice(0, 10); }
const segundaTs = k => Date.parse(k + "T03:00:00Z"); // 00h de Brasília
const ehDe = (m, set) => set.has(m.t) || set.has(baseT(m.t));
function calcConta(){
  const ms = Object.values(todosMoveis).filter(m => m && CAT[m.t]);
  const nl = ms.filter(m => ehDe(m, ELETRICOS)).length, na = ms.filter(m => ehDe(m, HIDRAULICOS)).length;
  const net = ms.some(m => ["pc", "tv", "game", "tvTubo"].includes(baseT(m.t)));
  let base;
  if (casaZero){ const nc = Object.keys(obra.comodos || {}).length; base = CONTAS.baseZero + CONTAS.comodoZero * Math.max(1, nc); }
  else base = CONTAS.base + (temQuintal() ? CONTAS.quintal : 0) + (temAndar2() ? CONTAS.andar2 : 0);
  const luz = nl * CONTAS.luz, agua = na * CONTAS.agua, internet = net ? CONTAS.internet : CONTAS.internetSem;
  return { base, luz, agua, internet, total: base + luz + agua + internet, nl, na };
}
const pagoDe = c => Object.values((c && c.pago) || {}).reduce((s, v) => s + (+v || 0), 0);
const restaDe = c => Math.max(0, ((c && c.total) || 0) - pagoDe(c));
const nMoradores = () => Math.max(1, moradores().length);
const parteDe = c => Math.ceil((c.total || 0) / nMoradores());
function contasAbertas(){ if (contasOff) return []; return Object.entries(contas).filter(([, c]) => c && c.total && restaDe(c) > 0).sort((a, b) => a[0] < b[0] ? -1 : 1); }
const diasAtraso = k => (agoraCt() - segundaTs(k)) / (24 * HORA);
function contaAtrasada(){ return contasAbertas().some(([k]) => diasAtraso(k) > CONTAS.vence); }
function luzCortada(){ return !visitando && contasAbertas().some(([k]) => diasAtraso(k) > CONTAS.corta); }
function statusConta(k, c){
  if (restaDe(c) <= 0) return { tx: "Paga ✓", cls: "ok" };
  const d = diasAtraso(k), f = Math.ceil(CONTAS.vence - d);
  if (d > CONTAS.corta) return { tx: "Luz cortada 🔌", cls: "mal" };
  if (d > CONTAS.vence) return { tx: "Atrasada 📬", cls: "mal" };
  return { tx: "Vence em " + Math.max(1, f) + (f > 1 ? " dias" : " dia"), cls: "" };
}
// gera a conta da semana (quem estiver online na segunda ou depois); a primeira semana do jogo não tem conta
function vigiarContas(){
  if (!me || visitando || !contasCarregadas || !moveisCarregados || !cofreCarregado || !casaOk || contasOff) return;
  const sem = segundaDe(agoraCt());
  if (!contasInicio){ if (!ctTentou.ini){ ctTentou.ini = 1; txn("casa/contasInicio", c => c ? undefined : sem); } return; }
  if (sem > contasInicio && !contas[sem] && !ctTentou[sem]){
    ctTentou[sem] = 1;
    const v = calcConta();
    txn("casa/contas/" + sem, c => c ? undefined : { base: v.base, luz: v.luz, agua: v.agua, internet: v.internet, total: v.total, criada: srvNow() }).then(ok => {
      if (ok){ toast("📬 Chegou a conta da semana: $" + v.total + ". Dá pra dividir!"); sfx("notif"); }
    });
  }
  // avisos amigáveis (1x por conta e por nível neste aparelho)
  for (const [k] of contasAbertas()){
    const d = diasAtraso(k), ch = "casinha-ct-" + sala + "-" + k;
    const nv = d > CONTAS.corta ? "2" : d > CONTAS.vence ? "1" : "";
    if (nv && store.get(ch) !== nv){ store.set(ch, nv); toast(nv === "2" ? "🔌 A luz foi cortada! Paguem a conta pra voltar (Casa → Contas)." : "📬 A conta da semana está atrasada. Sem estresse: paguem quando der (Casa → Contas)."); }
  }
}
function pagarConta(k, quanto){
  const c = contas[k]; if (!c || !me) return;
  const resta = restaDe(c), meu = (c.pago || {})[pid] || 0;
  const v = quanto === "parte" ? Math.min(resta, Math.max(0, parteDe(c) - meu)) : resta;
  if (v <= 0){ toast("Sua parte já está paga ✓"); return; }
  if (!gastar(v, "a conta")) return;
  const estavaCortada = luzCortada();
  txn("casa/contas/" + k, cur => { if (!cur) return; const r = Math.max(0, (cur.total || 0) - pagoDe(cur)); if (r <= 0) return; const vv = Math.min(v, r); cur.pago = cur.pago || {}; cur.pago[pid] = (+cur.pago[pid] || 0) + vv; if (r - vv <= 0) cur.quitada = srvNow(); return cur; }).then(ok => {
    if (!ok){ ganhar(v); toast("Essa conta já foi paga 😉"); return; }
    sfx("moeda"); const c2 = contas[k];
    if (c2 && restaDe(c2) <= 0){
      toast("Conta paga! ✓" + (estavaCortada && !luzCortada() ? " A luz voltou 💡" : ""));
      if (diasAtraso(k) <= CONTAS.vence) statMais("contasEmDia");
    } else toast("Você pagou $" + v + ". Falta $" + restaDe(c2 || c) + ".");
    refreshPanel("contas");
  });
}
// teste
function contasAvancar(dias){ CONTAS.desloc += (dias || 0) * 24 * HORA; ctTentou = {}; humorCache = null; refreshPanel("contas"); return segundaDe(agoraCt()); }
function contasGerarAgora(){ const ini = segundaDe(agoraCt() - 7 * 24 * HORA); return ref("casa/contasInicio").set(ini).then(() => { ctTentou = {}; contasInicio = ini; vigiarContas(); return segundaDe(agoraCt()); }); }
function openContas(){
  openPanel("contas", "Contas da casa 📬", corpo => {
    const topo = el("div"), lista = el("div", "list"), prox = el("div", "rowi"), nota = el("p", "muted");
    topo.style.cssText = "display:flex;flex-direction:column;gap:8px";
    corpo.append(topo, lista, el("h3", null, "Próxima conta"), prox, nota);
    let sig = null;
    const upd = () => {
      const v = calcConta(), s = JSON.stringify([contas, contasOff, Math.floor(me ? me.dinheiro : 0), v.total, Math.floor(agoraCt() / 60000), nMoradores()]); if (s === sig) return; sig = s;
      topo.textContent = ""; lista.textContent = ""; prox.textContent = "";
      if (contasOff) topo.append(el("p", "muted", "As contas estão desligadas (⚙️ Ajustes → Contas da casa)."));
      else topo.append(el("p", "muted", "Toda segunda chega a conta da semana (luz, água e internet). Qualquer um paga, ou cada um paga a sua parte. Atrasou 3 dias: bate um climinha chato. Atrasou 7: a luz corta até pagarem. Ninguém perde a casa."));
      if (luzCortada()) topo.append(el("p", "aviso14", "🔌 A luz está cortada: TV, computador e som não ligam e a casa fica escura à noite."));
      const ks = Object.keys(contas).filter(k => contas[k] && contas[k].total).sort().reverse().slice(0, 6);
      if (!ks.length) lista.append(el("p", "muted", contasOff ? "Nenhuma conta." : "Nenhuma conta ainda. A primeira chega na segunda que vem 📬"));
      for (const k of ks){
        const c = contas[k], st = statusConta(k, c), row = el("div", "conta14" + (st.cls ? " " + st.cls : "")), tx = el("div", "tx"), resta = restaDe(c);
        const d = new Date(segundaTs(k));
        tx.append(el("strong", null, "Semana de " + String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + " · $" + c.total),
          el("small", null, "🏠 Casa $" + (c.base || 0) + " · 💡 Luz $" + c.luz + " · 🚿 Água $" + c.agua + " · 📶 Internet $" + c.internet),
          el("small", null, st.tx + (pagoDe(c) ? " · pagaram: " + Object.entries(c.pago || {}).map(([p, x]) => (p === pid ? "você" : nomeDe(p)) + " $" + x).join(", ") : "")));
        row.append(tx);
        if (resta > 0 && !contasOff && !visitando){
          const bb = el("div", "hbtns"), meu = (c.pago || {})[pid] || 0, parte = Math.min(resta, Math.max(0, parteDe(c) - meu)), divide = nMoradores() > 1 && parte > 0 && parte < resta;
          if (divide){ const b1 = btn("Pagar minha parte $" + parte, "btn small", () => pagarConta(k, "parte")); b1.disabled = me.dinheiro < parte; bb.append(b1); }
          const b2 = btn("Pagar tudo $" + resta, divide ? "btn ghost small" : "btn small", () => pagarConta(k, "tudo")); b2.disabled = me.dinheiro < resta; bb.append(b2);
          row.append(bb);
        }
        lista.append(row);
      }
      const tx = el("div", "tx");
      tx.append(el("strong", null, "~$" + v.total + " por semana"), el("small", null, "Casa $" + v.base + " · " + v.nl + " aparelhos elétricos $" + v.luz + " · " + v.na + " pontos de água $" + v.agua + " · internet $" + v.internet));
      prox.append(tx);
      nota.textContent = "Cada aparelho elétrico soma $" + CONTAS.luz + " e cada ponto de água $" + CONTAS.agua + " por semana." + (nMoradores() > 1 ? " Dividindo, cada um paga ~$" + Math.ceil(v.total / nMoradores()) + "." : "");
    };
    upd(); return upd;
  });
}
function setContasOff(off){
  const up = { contasOff: off ? true : null }; if (!off) up.contasInicio = segundaDe(agoraCt()); // religou: sem conta retroativa
  ref("casa").update(up).then(() => { toast(off ? "Contas da casa desligadas." : "Contas da casa ligadas 📬 A primeira chega na segunda que vem."); refreshPanel("aba-ajustes"); });
}
// humor: conta atrasada pesa um pouquinho
CONDICOES.push((j, eu) => eu && !visitando && contaAtrasada() ? { id: "contaAtrasada", ic: "📬", nome: "Conta atrasada", v: -1, txt: "Tem conta da casa atrasada (Casa → Contas)." } : null);
// sem luz: aparelhos não ligam
{ const f0 = useFurn; useFurn = function(id, a){
  const m = moveis[id];
  if (m && luzCortada() && ehDe(m, APARELHOS_PARAM)){ toast("🔌 Sem luz! Paguem a conta da casa pra ligar de novo."); return; }
  return f0(id, a);
}; }

// =====================================================================
// 3. SERVIÇOS: delivery, faxineira, babá e jardineiro (NPCs com nome, uniforme e amizade)
// =====================================================================
const SERV_NPC = {
  "npc-beto": { nome: "Beto", papel: "Entregador", av: { corpo: "ele", traje: UNIF.moto.tj, cabelo: 0, estilo: 0, pele: 2, barba: 1 }, falas: ["Saindo quentinha! 🍕", "Hoje o trânsito tá de boa.", "Capricha na gorjeta? Brincadeira! 😄", "Essa casa tem a melhor vista do bairro."] },
  "npc-rosa": { nome: "Dona Rosa", papel: "Faxineira", av: { corpo: "ela", traje: UNIF.faxina.tj, cabelo: 4, estilo: 2, pele: 3 }, falas: ["Casa limpa, coração leve! ✨", "Achei uma meia embaixo do sofá…", "Vocês são um amor de patrões.", "Água sanitária resolve tudo, meu bem."] },
  "npc-lu": { nome: "Tia Lu", papel: "Babá", av: { corpo: "ela", traje: UNIF.baba.tj, cabelo: 1, estilo: 6, pele: 1, acess: 4 }, falas: ["Os pequenos se comportaram! 💕", "Contei uma história e dormiram rapidinho.", "Que família linda vocês têm.", "Pode ir tranquilo(a), eu cuido."] },
  "npc-tiao": { nome: "Seu Tião", papel: "Jardineiro", av: { corpo: "ele", traje: UNIF.jardim.tj, cabelo: 4, estilo: 0, pele: 3, barba: 1 }, falas: ["Planta gosta de conversa, sabia? 🌱", "Esse canteiro tá uma beleza.", "Rega de manhã cedinho é o segredo.", "Na roça a gente plantava de tudo."] }
};
const SERV = {
  comidas: {
    pizza: { nome: "Pizza", ic: "🍕", preco: 36, porcoes: 4, ganho: { fome: 55, diversao: 10 } },
    hamburguer: { nome: "Hambúrguer", ic: "🍔", preco: 28, porcoes: 2, ganho: { fome: 50, diversao: 8 } },
    japones: { nome: "Combinado japonês", ic: "🍣", preco: 45, porcoes: 2, ganho: { fome: 50, energia: 10, diversao: 8 } },
    acai: { nome: "Açaí", ic: "🍧", preco: 20, porcoes: 2, ganho: { fome: 25, energia: 12, diversao: 20 } }
  },
  entrega: 30000, moto: 9000, pe: 3500,
  faxina: 45, faxinaSemana: 35, baba: 30, babaJa: 15, jardim: 20,
  passo: 400, parada: 2600, babaAlivio: .6, babaVisita: 90000
};
// pratos de delivery entram nas receitas da mesa (não aparecem no fogão nem nos desejos da gravidez)
for (const [k, c] of Object.entries(SERV.comidas)) RECEITAS[k] = { nome: c.nome, ing: {}, dur: 0, porcoes: c.porcoes, ganho: c.ganho, delivery: 1 };
const ehDelivery = rk => !!(RECEITAS[rk] && RECEITAS[rk].delivery);
{ const f0 = drawPrato; drawPrato = function(rk, x, y){
  if (!ehDelivery(rk)) return f0(rk, x, y);
  if (rk === "pizza"){ rbox(x, y + 1, 9, 6, "#E9C48A"); R(x + 1, y + 2, 7, 4, "#F2D58A"); for (const [a, b] of [[2, 2], [5, 3], [3, 4], [6, 2]]) P(x + a, y + b, "#D9483D"); P(x + 4, y + 2, "#7FC27A"); R(x + 1, y + 5, 7, 1, "#C99A5A"); return; }
  rbox(x, y + 1, 9, 6, "#FFFFFF"); R(x + 1, y + 5, 7, 1, "#E6DDF0");
  if (rk === "hamburguer"){ R(x + 2, y + 1, 5, 2, "#E0A93A"); P(x + 3, y + 1, "#F2C56A"); R(x + 2, y + 3, 5, 1, "#7FC27A"); R(x + 2, y + 4, 5, 1, "#6B3A2A"); R(x + 2, y + 5, 5, 1, "#E0A93A"); }
  else if (rk === "japones"){ for (const a of [1, 4]){ rbox(x + a + 1, y + 2, 3, 3, "#FFFFFF"); P(x + a + 2, y + 3, "#F49A6A"); R(x + a + 1, y + 4, 3, 1, "#2E3A2E"); } P(x + 7, y + 3, "#7FC27A"); }
  else { rbox(x + 2, y + 1, 5, 4, "#6A3A8C"); R(x + 3, y + 1, 3, 1, "#9A5ABF"); P(x + 3, y + 2, "#F6E27A"); P(x + 5, y + 2, "#F6E27A"); P(x + 4, y + 1, "#E8445E"); }
}; }
{ const f0 = openPanel; openPanel = function(id, titulo, monta){
  if (id !== "cozinha") return f0(id, titulo, monta);
  const tira = corpo => { for (const row of corpo.querySelectorAll(".rowi")){ const st = row.querySelector("strong"); if (st && Object.values(SERV.comidas).some(c => c.nome === st.textContent)) row.remove(); } };
  return f0(id, titulo, corpo => { const upd = monta(corpo); tira(corpo); return () => { if (upd) upd(); tira(corpo); }; });
}; }
if (typeof desejoAtual === "function"){ desejoAtual = function(){ // mesmo sorteio de antes (sem os pratos de delivery na lista)
  const g = gravidez; if (!g || !g.quem || !g.ini) return null;
  const d = srvNow() - g.ini; if (d < GV_POS) return null;
  const bl = Math.floor(d / GV_DESEJO), ks = Object.keys(RECEITAS).filter(k => !ehDelivery(k)), rk = ks[hash(salaSeed, bl, 77 + (g.ini % 1000)) % ks.length];
  return { bl, rk, feito: (g.desejos || {})[bl] || null };
}; }

let servicos = {}, servCarregado = false, svTentou = {};
const svPedidos = () => Object.entries(servicos.pedidos || {}).filter(([, p]) => p && p.ini && SERV.comidas[p.comida]);
const pedidoAtivo = () => svPedidos().find(([, p]) => srvNow() < p.chega + SERV.pe + SERV.moto + 2000) || null;
// onde a rua encosta na casa (porta da frente): quadrado e altura do chão (px)
function portaRua(lado){
  const [sx, sy] = visitaSpot({ tipo: "vizinho", lado: lado || 0 });
  return { sx, sy, cx: sx * T + 8, by: sy > HC ? (sy + 1) * T - 3 : H * T - 3 };
}
function pedirComida(k){
  const c = SERV.comidas[k]; if (!me || !c || visitando) return;
  if (pedidoAtivo()){ toast("Já tem um pedido a caminho 🛵"); return; }
  if (!gastar(c.preco, "o pedido")) return;
  const t = srvNow(), porcoes = Math.max(c.porcoes, nMoradores());
  ref("casa/servicos/pedidos").push({ por: pid, comida: k, porcoes, ini: t, chega: t + SERV.entrega, lado: hash(t / 1000 | 0, salaSeed, 7) % 2 }).then(() => {
    toast(c.ic + " Pedido feito! " + SERV_NPC["npc-beto"].nome + " chega em uns 30 segundos."); sfx("pop"); closePanel();
  }, () => { ganhar(c.preco); toast("Não deu pra pedir agora."); });
}
// delivery: chegou → vira prato na mesa (porções pra todo mundo)
function vigiarDelivery(){
  const t = srvNow();
  for (const [id, p] of svPedidos()){
    if (!p.entregue && t >= p.chega && (p.por === pid || !(jogadores[p.por] && jogadores[p.por].online) || t > p.chega + 15000) && !svTentou["e" + id]){
      svTentou["e" + id] = 1;
      txn("casa/servicos/pedidos/" + id + "/entregue", c => c ? undefined : t).then(ok => {
        if (!ok) return;
        ref("casa/pratos").push({ receita: p.comida, porcoes: p.porcoes, por: p.por, at: TS(), delivery: 1 }).catch(() => {});
        const c = SERV.comidas[p.comida];
        if (me && andarAtual === 0) sfx("toc");
        toast(c.ic + " " + c.nome + " chegou! " + p.porcoes + " porções " + (temMovel("mesa", "piquenique") ? "na mesa." : "(dá pra comer pelo ⚙️ Casa → Serviços)."));
        statMais("deliverys");
      });
    }
    if (t > p.chega + 10 * 60000 && p.por === pid) ref("casa/servicos/pedidos/" + id).remove().catch(() => {});
  }
}
// comer sem mesa: pelo painel de serviços
function comerDelivery(){
  const l = pratosOrdenados().filter(([, p]) => ehDelivery(p.receita)); if (!l.length || !me) return;
  const [pk, p] = l[0], r = RECEITAS[p.receita];
  closePanel(); if (me.acao) setAcao(null); me.path = [];
  startAcao({ id: "comer", nome: "Comendo " + r.nome.toLowerCase(), dur: 10, ganho: r.ganho, junto: 1, juntoMult: 1.6, juntoSocial: 3, antes: () => pegarPorcao(pk) });
}

// ---- NPC que anda pela casa (faxineira, jardineiro): rota calculada igual em todo aparelho ----
function entradaTile(){
  if (andarAtual !== 0) return null;
  const ly = linhaSaida(), p = portaRua();
  for (let d = 0; d < W; d++) for (const x of [p.sx + d, p.sx - d]) if (x > 0 && x < W - 1 && walkable(x, ly)) return [x, ly];
  for (let y = ly; y > 0; y--) for (let x = 1; x < W - 1; x++) if (walkable(x, y)) return [x, y];
  return null;
}
function bfsDe(sx, sy, gx, gy){
  const goal = (x, y) => (x === gx && y === gy) || (!walkable(gx, gy) && Math.abs(x - gx) + Math.abs(y - gy) === 1);
  return bfs(sx, sy, goal);
}
const rotaCache = new Map();
function rotaServico(v){
  const key = v.id + "|" + Object.keys(moveis).length + "|" + H;
  let r = rotaCache.get(key); if (r) return r;
  const e = entradaTile(); if (!e) return null;
  const segs = []; let cur = e, total = 0;
  const anda = path => { if (!path || !path.length) return; const pts = [cur].concat(path); segs.push({ k: "anda", pts, ini: total, dur: path.length * SERV.passo }); total += path.length * SERV.passo; cur = path[path.length - 1]; };
  for (const a of v.alvos || []){
    const [ax, ay, aid] = a, path = bfsDe(cur[0], cur[1], ax, ay);
    if (path) anda(path);
    segs.push({ k: "faz", at: cur, alvo: [ax, ay], aid, ini: total, dur: SERV.parada }); total += SERV.parada;
  }
  anda(bfsDe(cur[0], cur[1], e[0], e[1]));
  r = { segs, total: total + 900, entrada: e }; rotaCache.set(key, r); if (rotaCache.size > 30) rotaCache.clear();
  return r;
}
// posição do NPC no instante t (ms desde a chegada)
function npcServEstado(v, t){
  const r = rotaServico(v); if (!r) return null;
  const dt = t - v.ini; if (dt < 0 || dt > r.total) return null;
  for (const s of r.segs){
    if (dt < s.ini || dt >= s.ini + s.dur) continue;
    if (s.k === "faz"){ const dx = s.alvo[0] - s.at[0], dy = s.alvo[1] - s.at[1]; return { x: s.at[0], y: s.at[1], moving: false, dir: dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "up" : "down", faz: s, alpha: 1 }; }
    const p = (dt - s.ini) / SERV.passo, i = Math.min(Math.floor(p), s.pts.length - 2), f = p - i, a = s.pts[i], b = s.pts[i + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    return { x: a[0] + dx * f, y: a[1] + dy * f, moving: true, dir: dx ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up", alpha: 1 };
  }
  const e = r.entrada, a = dt < 900 ? dt / 900 : dt > r.total - 900 ? (r.total - dt) / 900 : 1;
  return { x: e[0], y: e[1], moving: false, dir: "down", alpha: clamp(a, 0, 1) };
}
const svVisitas = () => Object.entries(servicos.visitas || {}).filter(([, v]) => v && v.ini && (v.tipo === "faxina" || v.tipo === "jardim")).map(([id, v]) => Object.assign({ id }, v));
const VISITA_MAX = 4 * 60000;
function criarVisitaServ(tipo, por, semPagar){
  const t = srvNow(); let alvos = [];
  if (tipo === "faxina"){
    const l = Object.entries(sujeira).filter(([, q]) => q && SUJ_TIPOS[q.tipo] && !(q.andar || 0)).map(([id, q]) => { if (q.tipo === "louca" && todosMoveis[q.mov]){ const m = todosMoveis[q.mov]; return [m.x, m.y, id]; } return [q.x, q.y, id]; });
    alvos = ordenarPerto(l);
  } else {
    alvos = ordenarPerto(Object.entries(todosMoveis).filter(([id, m]) => m && baseT(m.t) === "canteiro" && !(m.andar || 0) && jardim[id] && plantaInfo(jardim[id]) && !plantaInfo(jardim[id]).pronta).map(([id, m]) => [m.x, m.y, id]));
  }
  return ref("casa/servicos/visitas").push({ tipo, por, ini: t, alvos: alvos.slice(0, 14), semPagar: semPagar ? 1 : null });
}
function ordenarPerto(l){
  const e = entradaTile() || [9, HC - 1], out = []; let cur = e; l = l.slice();
  while (l.length){ l.sort((a, b) => Math.abs(a[0] - cur[0]) + Math.abs(a[1] - cur[1]) - Math.abs(b[0] - cur[0]) - Math.abs(b[1] - cur[1])); const n = l.shift(); out.push(n); cur = n; }
  return out;
}
function chamarServico(tipo){
  if (!me || visitando) return;
  if (svVisitas().some(v => v.tipo === tipo)){ toast(tipo === "faxina" ? "A Dona Rosa já está aí 🧹" : "O Seu Tião já está aí 🌱"); return; }
  const preco = tipo === "faxina" ? SERV.faxina : SERV.jardim;
  if (tipo === "jardim" && !Object.entries(todosMoveis).some(([id, m]) => m && baseT(m.t) === "canteiro" && jardim[id])){ toast("Não tem nada plantado na horta ainda 🌱"); return; }
  if (!gastar(preco, tipo === "faxina" ? "a faxineira" : "o jardineiro")) return;
  criarVisitaServ(tipo, pid).then(() => { toast(tipo === "faxina" ? "🧹 A Dona Rosa está chegando!" : "🌱 O Seu Tião está chegando!"); sfx("toc"); closePanel(); }, () => ganhar(preco));
}
// conclui o que o NPC já fez (quem estiver online e no térreo; no fim, qualquer um conclui o resto)
function vigiarVisitasServ(){
  const t = srvNow();
  for (const v of svVisitas()){
    const r = andarAtual === 0 ? rotaServico(v) : null, feito = v.feito || {};
    const acabou = r ? t > v.ini + r.total : t > v.ini + VISITA_MAX;
    for (const s of r ? r.segs : []){
      if (s.k !== "faz" || feito[s.aid] || svTentou["f" + v.id + s.aid] || t < v.ini + s.ini + s.dur * .8) continue;
      svTentou["f" + v.id + s.aid] = 1; concluirAlvo(v, s.aid);
    }
    if (acabou && !svTentou["x" + v.id]){
      svTentou["x" + v.id] = 1;
      txn("casa/servicos/visitas/" + v.id, c => c ? null : undefined).then(ok => {
        if (!ok) return;
        for (const a of v.alvos || []) if (!feito[a[2]]) concluirAlvo(v, a[2], true);
        if (v.tipo === "faxina") for (const [id, q] of Object.entries(sujeira)) if (q && (q.andar || 0) === 1) ref("casa/sujeira/" + id).remove().catch(() => {}); // lá em cima ela limpa no fim
        toast(v.tipo === "faxina" ? "🧹 A Dona Rosa terminou a faxina. Casa brilhando! ✨" : "🌱 O Seu Tião regou a horta toda.");
        statMais(v.tipo === "faxina" ? "faxinas" : "jardineiro");
      });
    }
  }
}
function concluirAlvo(v, aid, quieto){
  ref("casa/servicos/visitas/" + v.id + "/feito/" + aid).set(1).catch(() => {});
  if (v.tipo === "faxina"){ if (sujeira[aid]) ref("casa/sujeira/" + aid).remove().then(() => { if (!quieto && me && andarAtual === 0) sfx("limpar"); }).catch(() => {}); }
  else if (jardim[aid]) txn("casa/jardim/" + aid, cur => { if (!cur) return; const tt = srvNow(); cur.cresc = crescAte(cur, tt).g; cur.ultimaRega = tt; cur.regouPor = "npc-tiao"; return cur; }).then(ok => { if (ok && !quieto && me && andarAtual === 0) sfx("regar"); });
}
// faxina semanal (assinatura): a cada 7 dias a Dona Rosa vem sozinha; cobra de quem assinou
function vigiarFaxSemanal(){
  const fs = servicos.faxSemanal, t = srvNow(); if (!fs || !fs.prox || t < fs.prox || svTentou["s" + fs.prox]) return;
  svTentou["s" + fs.prox] = 1;
  txn("casa/servicos/faxSemanal", c => c && c.prox && srvNow() >= c.prox ? Object.assign({}, c, { prox: c.prox + 7 * 24 * HORA * Math.max(1, Math.ceil((srvNow() - c.prox + 1) / (7 * 24 * HORA))) }) : undefined).then(ok => {
    if (!ok) return;
    if (!svVisitas().some(v => v.tipo === "faxina")) criarVisitaServ("faxina", fs.por, true);
    txn("casa/servicos/deve/" + fs.por, v => (+v || 0) + SERV.faxinaSemana);
  });
}
function assinarFaxina(on){
  if (!me) return;
  if (!on){ ref("casa/servicos/faxSemanal").remove().then(() => { toast("Faxina semanal cancelada."); refreshPanel("servicos"); }); return; }
  if (!gastar(SERV.faxinaSemana, "a primeira faxina")) return;
  ref("casa/servicos/faxSemanal").set({ por: pid, prox: srvNow() + 7 * 24 * HORA, desde: srvNow() }).then(() => {
    if (!svVisitas().some(v => v.tipo === "faxina")) criarVisitaServ("faxina", pid, true);
    toast("🧹 Faxina toda semana! A primeira é agora."); sfx("toc"); refreshPanel("servicos");
  }, () => ganhar(SERV.faxinaSemana));
}
// babá: contrato por dia (cobrado de quem contratou quando entra) ou visita na hora
const babaInfo = () => servicos.baba && servicos.baba.on ? servicos.baba : null;
function babaCobre(t){ const b = babaInfo(); t = t || srvNow(); return !!b && t < (b.pagoAte || 0) + 2 * 24 * HORA; } // sem pagar há 2 dias: ela não vem
const temFilhos = () => typeof famOrdem === "function" && famOrdem().length > 0;
function contratarBaba(on){
  if (!me || visitando) return;
  if (!on){ ref("casa/servicos/baba").remove().then(() => { toast("Contrato da babá encerrado."); refreshPanel("servicos"); }); return; }
  if (!temFilhos()){ toast("Babá é pra quando tiver bebê ou filhos 👶"); return; }
  if (!gastar(SERV.baba, "o primeiro dia da babá")) return;
  const t = srvNow();
  ref("casa/servicos/baba").set({ on: true, por: pid, desde: t, pagoAte: t + 24 * HORA }).then(() => { toast("👩‍🍼 A Tia Lu agora cuida das crianças (as necessidades caem bem mais devagar)."); refreshPanel("servicos"); }, () => ganhar(SERV.baba));
}
function chamarBabaAgora(){
  if (!me || visitando) return;
  if (!temFilhos()){ toast("Babá é pra quando tiver bebê ou filhos 👶"); return; }
  if (!gastar(SERV.babaJa, "a babá")) return;
  const t = srvNow(), up = {};
  for (const fid of famOrdem()){ const f = filhos[fid]; if (!f) continue; if (ehInfante(f)){ up[fid + "/fome"] = t; up[fid + "/fralda"] = t; up[fid + "/carinho"] = t; } else { up[fid + "/comeu"] = t; up[fid + "/brincou"] = t; } }
  ref("casa/filhos").update(up).then(() => { ref("casa/servicos/babaVisita").set({ ini: t, por: pid }); toast("👩‍🍼 A Tia Lu deu comida, trocou fralda e brincou com todo mundo!"); closePanel(); }, () => ganhar(SERV.babaJa));
}
// a babá alivia a queda das necessidades enquanto o contrato vale (mesma conta em todo aparelho: só timestamps)
function ajustaTs(ts, t){ const b = babaInfo(); if (!b || !ts) return ts; const fim = Math.min(t, (b.pagoAte || 0) + 2 * 24 * HORA), ini = Math.max(ts, b.desde || 0); return fim > ini ? ts + (fim - ini) * SERV.babaAlivio : ts; }
if (typeof bebeNeeds === "function"){ const f0 = bebeNeeds; bebeNeeds = function(t){
  const b0 = bebe; if (!b0 || !babaInfo()) return f0(t);
  const tt = t || srvNow(); bebe = Object.assign({}, b0, { fome: ajustaTs(b0.fome, tt), fralda: ajustaTs(b0.fralda, tt), carinho: ajustaTs(b0.carinho, tt) });
  try { return f0(t); } finally { bebe = b0; }
}; }
if (typeof filhoNeeds === "function"){ const f0 = filhoNeeds; filhoNeeds = function(f, t){
  if (!f || !babaInfo()) return f0(f, t);
  const tt = t || srvNow(), g = Object.assign({}, f);
  for (const k of ["comeu", "fome", "brincou", "carinho"]) if (g[k]) g[k] = ajustaTs(g[k], tt);
  return f0(g, t);
}; }
// cobranças pendentes (babá por dia, faxina semanal que veio com você fora): paga o que der; sem dinheiro, cancela sem drama
function cobrarServicos(){
  if (!me || visitando || !servCarregado) return;
  const t = srvNow(), b = babaInfo();
  if (b && b.por === pid && t > (b.pagoAte || 0) && !svTentou["b" + b.pagoAte]){
    svTentou["b" + b.pagoAte] = 1;
    const dias = Math.min(3, Math.ceil((t - b.pagoAte) / (24 * HORA))), v = dias * SERV.baba;
    if (me.dinheiro >= v){ me.dinheiro -= v; saveNeeds(true); ref("casa/servicos/baba/pagoAte").set(b.pagoAte + dias * 24 * HORA); toast("👩‍🍼 Diária da babá: -$" + v + "."); }
    else { ref("casa/servicos/baba").remove(); toast("👩‍🍼 Sem dinheiro pra diária, a Tia Lu deu um tempo. Dá pra chamar de novo em Serviços."); }
  }
  const dv = +((servicos.deve || {})[pid]) || 0;
  if (dv > 0 && !svTentou["d" + dv]){
    svTentou["d" + dv] = 1;
    const v = Math.min(dv, Math.floor(me.dinheiro));
    txn("casa/servicos/deve/" + pid, c => (+c || 0) > 0 ? null : undefined).then(ok => {
      if (!ok) return;
      if (v > 0){ me.dinheiro -= v; saveNeeds(true); }
      if (v < dv && servicos.faxSemanal && servicos.faxSemanal.por === pid) ref("casa/servicos/faxSemanal").remove();
      toast("🧹 Faxina da semana: -$" + v + (v < dv ? " (o resto ficou por conta da casa; assinatura pausada)." : "."));
    });
  }
}
// conversar com os NPCs de serviço (amizade na relação genérica)
const npcFalou = {};
function conversarNpc(id){
  const n = SERV_NPC[id]; if (!n || !me) return;
  if (Date.now() - (npcFalou[id] || 0) < 60000){ toast(n.nome + ": \"Já já a gente conversa mais, tá?\" 😊"); return; }
  npcFalou[id] = Date.now();
  const r = relDe(pid, id), am = r ? +r.amizade || 0 : 0, fala = n.falas[(hash(Date.now() / 60000 | 0, id.length, 3) + Math.floor(am / 10)) % n.falas.length];
  relMudar(pid, id, relBonus({ amizade: 5 })).then(() => refreshPanel("servicos"));
  ganharNeeds({ social: 12 }); ganharHab("charme", 3); sfx("pop");
  toast(n.nome + ": \"" + fala + "\"");
}
function gorjetaNpc(id){
  const n = SERV_NPC[id]; if (!n || !gastar(5, "a gorjeta")) return;
  relMudar(pid, id, relBonus({ amizade: 8 })); toast(n.nome + " agradeceu a gorjeta 💛"); sfx("moeda");
}
// teste
function pedirTeste(k){ const c = SERV.comidas[k || "pizza"]; if (me && me.dinheiro < c.preco) me.dinheiro += c.preco; return pedirComida(k || "pizza"); }
function faxinaTeste(){ if (me && me.dinheiro < SERV.faxina) me.dinheiro += SERV.faxina; return chamarServico("faxina"); }
function openServicos(){
  openPanel("servicos", "Serviços 🛎️", corpo => {
    const dl = el("div", "list"), cs = el("div", "list"), amg = el("div", "list");
    corpo.append(el("h3", null, "🛵 Delivery"), dl, el("h3", null, "🏠 Em casa"), cs, el("h3", null, "🤝 Quem trabalha pra vocês"), amg);
    let sig = null;
    const upd = () => {
      const pa0 = pedidoAtivo(), s = JSON.stringify([servicos, Math.floor(me ? me.dinheiro : 0), pratosOrdenados().length, Object.keys(SERV_NPC).map(k => relDe(pid, k)), pa0 && !pa0[1].entregue ? Math.floor(srvNow() / 2000) : 0, svVisitas().length, Math.floor(srvNow() / 60000)]); if (s === sig) return; sig = s;
      dl.textContent = ""; cs.textContent = ""; amg.textContent = "";
      const pa = pedidoAtivo(), restos = pratosOrdenados().filter(([, p]) => ehDelivery(p.receita));
      if (pa){ const [, p] = pa, c = SERV.comidas[p.comida], f = p.chega - srvNow(); dl.append(el("p", "aviso14", c.ic + " " + c.nome + (p.entregue ? " entregue! Bom apetite 😋" : f > 0 ? " a caminho: chega em " + Math.ceil(f / 1000) + " s" : " chegando na porta…"))); }
      for (const [k, c] of Object.entries(SERV.comidas)){
        const row = el("div", "rowi svc14"), tx = el("div", "tx");
        tx.append(el("strong", null, c.ic + " " + c.nome), el("small", null, Math.max(c.porcoes, nMoradores()) + " porções · chega em ~30 s"));
        const b = btn("$" + c.preco, "btn small", () => pedirComida(k)); b.disabled = !!pa || me.dinheiro < c.preco || visitando; b.setAttribute("aria-label", "Pedir " + c.nome + " por $" + c.preco);
        row.append(tx, b); dl.append(row);
      }
      if (restos.length){ const n = restos.reduce((a, [, p]) => a + p.porcoes, 0); const b = btn("😋 Comer da entrega (" + n + (n > 1 ? " porções)" : " porção)"), "btn ghost", comerDelivery); dl.append(b); }
      // faxineira
      const fs = servicos.faxSemanal, fv = svVisitas().find(v => v.tipo === "faxina");
      { const row = el("div", "rowi svc14"), tx = el("div", "tx"), bb = el("div", "hbtns");
        tx.append(el("strong", null, "🧹 Faxineira · Dona Rosa"), el("small", null, fv ? "Limpando a casa agora ✨" : fs ? "Toda semana ($" + SERV.faxinaSemana + "/visita) · próxima " + faltaTxt(fs.prox - srvNow()) + (fs.por !== pid ? " · assinada por " + nomeDe(fs.por) : "") : "$" + SERV.faxina + " a visita · ou toda semana por $" + SERV.faxinaSemana));
        const b1 = btn("Chamar $" + SERV.faxina, "btn small", () => chamarServico("faxina")); b1.disabled = !!fv || me.dinheiro < SERV.faxina || visitando;
        const b2 = fs ? btn("Cancelar semanal", "btn ghost small", () => assinarFaxina(false)) : btn("Toda semana", "btn ghost small", () => assinarFaxina(true)); if (!fs) b2.disabled = me.dinheiro < SERV.faxinaSemana || visitando; else b2.disabled = visitando;
        bb.append(b1, b2); row.append(tx, bb); cs.append(row); }
      // babá
      { const row = el("div", "rowi svc14"), tx = el("div", "tx"), bb = el("div", "hbtns"), b = babaInfo(), tf = temFilhos();
        tx.append(el("strong", null, "👩‍🍼 Babá · Tia Lu"), el("small", null, !tf ? "Pra quando tiver bebê ou filhos" : b ? "Contratada por " + (b.por === pid ? "você" : nomeDe(b.por)) + " · $" + SERV.baba + "/dia · as crianças precisam bem menos de vocês" : "$" + SERV.baba + "/dia (cuida quando vocês não estão) · ou $" + SERV.babaJa + " pra cuidar de tudo agora"));
        const b1 = b ? btn("Encerrar", "btn ghost small", () => contratarBaba(false)) : btn("Contratar $" + SERV.baba + "/dia", "btn small", () => contratarBaba(true)); b1.disabled = visitando || (!b && (!tf || me.dinheiro < SERV.baba));
        const b2 = btn("Agora $" + SERV.babaJa, "btn ghost small", chamarBabaAgora); b2.disabled = visitando || !tf || me.dinheiro < SERV.babaJa;
        bb.append(b1, b2); row.append(tx, bb); cs.append(row); }
      // jardineiro
      { const row = el("div", "rowi svc14"), tx = el("div", "tx"), jv = svVisitas().find(v => v.tipo === "jardim");
        tx.append(el("strong", null, "🌱 Jardineiro · Seu Tião"), el("small", null, jv ? "Regando a horta agora 💧" : "$" + SERV.jardim + " · rega todos os canteiros do térreo"));
        const b1 = btn("Chamar $" + SERV.jardim, "btn small", () => chamarServico("jardim")); b1.disabled = !!jv || me.dinheiro < SERV.jardim || visitando;
        row.append(tx, b1); cs.append(row); }
      for (const [id, n] of Object.entries(SERV_NPC)){
        const r = relDe(pid, id), am = r ? +r.amizade || 0 : 0, row = el("div", "rowi svc14"), esq = el("div", "me"), tx = el("div", "tx");
        esq.style.gap = "10px"; tx.append(el("strong", null, n.nome + " · " + n.papel), el("small", null, estAmizade(r).ic + " " + estAmizade(r).nome + " (" + am + ")"));
        esq.append(rostoCanvas(id), tx); row.append(esq); amg.append(row);
      }
      amg.append(el("p", "muted", "Dá pra conversar com eles tocando neles quando estiverem aqui. Amizade sobe a cada papo."));
    };
    upd(); return upd;
  });
}

// =====================================================================
// 4. PAINEL "TRABALHO" (aba Casa ou computador)
// =====================================================================
function openTrabalho(){
  if (visitando){ toast("Na visita não dá pra mexer na carreira 😉"); return; }
  openPanel("trabalho", "Trabalho 💼", corpo => {
    const box = el("div"); box.style.cssText = "display:flex;flex-direction:column;gap:12px"; corpo.append(box);
    let sig = null, verLista = false;
    const upd = () => {
      const c = minhaCarreira(), tr = meuTrab(), t = srvNow(), a = agoraBR();
      const s = JSON.stringify([c, tr, verLista, Math.floor(t / 60000), Math.floor(me ? me.dinheiro : 0), a.dw, Math.floor(a.h * 4), meuHumor().soma, dadosEu().hab]); if (s === sig) return; sig = s;
      box.textContent = "";
      if (tr){ // no trabalho
        const car = CARREIRAS[tr.car], falta = tr.fim - t;
        box.append(el("p", "aviso14", car.ic + " " + (falta > 0 ? "No trabalho até " + horaTxt(tr.fim) + " (faltam " + duracao(falta) + "). Pode fechar o jogo: o expediente conta pelo relógio." : "Expediente terminado! Fechando o dia…")));
        if (eventoAberto(tr, t)){
          const ev = eventoDe(tr), g = el("div", "list");
          g.append(el("strong", null, "💭 " + ev.txt));
          ev.ops.forEach((o, i) => { const b = btn(o.t, "btn ghost escolha", () => escolherEvento(i)); g.append(b); });
          box.append(g);
        } else if (tr.ev){ const ev = eventoDe(tr); box.append(el("p", "muted", "💭 Você escolheu: " + (ev.ops[tr.ev.op] || {}).t + ". O resultado vem no resumo.")); }
        else box.append(el("p", "muted", "💭 No meio do expediente pode aparecer uma decisão rápida (opcional)."));
        return;
      }
      if (!c || verLista){
        box.append(el("p", "muted", "Escolha uma carreira. Cada uma tem dias e horário de saída, 7 cargos e uma habilidade que ajuda a subir. No horário, toque em “Ir trabalhar”: o boneco sai de uniforme e volta em " + Math.round(TRAB.duracao / 60000) + " min com o pagamento, mesmo com o jogo fechado. Trocar de carreira recomeça do primeiro cargo."));
        const g = el("div", "list");
        for (const [k, cr] of Object.entries(CARREIRAS)){
          const b = btn("", "btn ghost escolha" + (c && c.id === k ? " atual14" : ""), () => { if (c && c.id === k){ verLista = false; upd(); return; } if (c && !confirm("Trocar de carreira? Você recomeça como " + cr.cargos[0][0] + ".")) return; verLista = false; escolherCarreira(k); });
          b.append(el("strong", null, cr.ic + " " + cr.nome + (c && c.id === k ? " ✓" : "")), el("small", null, horarioTxt(cr)), el("small", null, cr.cargos[0][0] + " $" + cr.cargos[0][1] + " → " + cr.cargos[cr.cargos.length - 1][0] + " $" + cr.cargos[cr.cargos.length - 1][1] + " · " + HAB[cr.hab].ic + " " + HAB[cr.hab].nome));
          g.append(b);
        }
        box.append(g);
        if (c) box.append(btn("Voltar", "btn ghost", () => { verLista = false; upd(); }));
        return;
      }
      const car = CARREIRAS[c.id], [cn] = cargoDe(c), sal = salarioDe(c), hojeFeito = c.ultDia === dia14(t), aberta = janelaAberta(car);
      const cab = el("div", "rowi"), tx = el("div", "tx");
      tx.append(el("strong", null, car.ic + " " + cn), el("small", null, car.nome + " · cargo " + ((c.cargo | 0) + 1) + " de " + car.cargos.length), el("small", null, "$" + sal + " por expediente · " + horarioTxt(car)));
      cab.append(tx); box.append(cab);
      const w = el("div", "need"), r1 = el("div", "row"); r1.append(el("span", null, "Desempenho"), el("span", null, Math.round(+c.desemp || 0) + "/100")); w.append(r1, barra14(+c.desemp || 0)); box.append(w);
      const rq = reqPromo(c);
      if (rq){
        const l = el("ul", "req14");
        l.append(el("li", null, (rq.desOk ? "✅" : "⬜") + " Desempenho 100 (sobe a cada expediente, mais com bom humor)"),
          el("li", null, (rq.habOk ? "✅" : "⬜") + " " + HAB[rq.hab].ic + " " + HAB[rq.hab].nome + " nível " + rq.habNv + " (você tem " + habNv(rq.hab) + ")"),
          el("li", null, (rq.humOk ? "✅" : "⬜") + " Humor “De boa” ou melhor no dia (agora: " + rq.humTxt + ")"));
        box.append(el("p", null, "Próximo cargo: " + rq.cargo[0] + " ($" + rq.cargo[1] + ")"), l);
      } else box.append(el("p", null, "🏆 Topo da carreira! Mais nada a conquistar aqui… a não ser trocar de carreira."));
      const bb = el("div", "hbtns");
      const ir = btn(hojeFeito ? "Hoje já foi ✓" : aberta ? "💼 Ir trabalhar" : "Fora do horário", "btn", irTrabalhar); ir.disabled = hojeFeito || !aberta;
      bb.append(ir, btn("Ver carreiras", "btn ghost", () => { verLista = true; upd(); }));
      box.append(bb);
      box.append(el("p", "muted", hojeFeito ? "Próximo expediente: " + proxJanelaTxt(car) + "." : aberta ? "Dá pra sair até as " + car.janela[1] + "h. Fica fora " + Math.round(TRAB.duracao / 60000) + " min (dá pra fechar o jogo). Faltar não tem castigo: só não ganha o dia." : "Próxima saída: " + proxJanelaTxt(car) + "."));
      // freela (o antigo "Trabalhar" do computador) continua: bico curto, sem horário
      const tn = turnosHoje(), pc = primeiro("pc"), celular = !pc && casaZero, fr = el("div", "rowi svc14"), ft = el("div", "tx");
      ft.append(el("strong", null, celular ? "📱 Bico pelo celular" : "💻 Freela no computador"), el("small", null, "+$" + pagaMudanca(TRABALHO.dinheiro) + " por bico rápido · " + tn + "/" + TURNOS_DIA + " hoje · sem horário"));
      const fb = btn(tn >= TURNOS_DIA ? "Folga" : "Fazer", "btn small", () => { closePanel(); if (celular){ if (me.acao) setAcao(null); me.path = []; startAcao(TRABALHO); } else useFurn(pc, TRABALHO); });
      fb.disabled = (!pc && !celular) || tn >= TURNOS_DIA; fr.append(ft, fb); box.append(fr);
      const cl = el("details", "dica13"); cl.append(el("summary", null, "Todos os cargos de " + car.nome));
      const ul = el("ul"); car.cargos.forEach(([n, v], i) => ul.append(el("li", null, (i === (c.cargo | 0) ? "👉 " : i < (c.cargo | 0) ? "✓ " : "") + n + " · $" + v + (i ? " · " + HAB[car.hab].nome + " " + HAB_CARGO[i] : "")))); cl.append(ul); box.append(cl);
    };
    upd(); return upd;
  });
}

// =====================================================================
// 5. DESENHO: quem sai pra trabalhar, carro, delivery, NPCs de serviço, envelope da conta
// =====================================================================
const motoSpr = (cor) => sprite("moto14:" + cor, 20, 12, (ox, oy) => {
  const c = cor || "#D9483D", cD = sh(c, -.25);
  for (const wx of [4, 15]){ rbox(ox + wx - 3, oy + 6, 6, 6, "#2E2638"); R(ox + wx - 1, oy + 8, 2, 2, "#C6D0DA"); }
  R(ox + 3, oy + 6, 14, 3, c); R(ox + 4, oy + 5, 6, 1, sh(c, .25)); R(ox + 3, oy + 8, 14, 1, cD); R(ox + 14, oy + 2, 2, 5, "#5A5268"); R(ox + 13, oy + 1, 4, 1, "#2E2638"); P(ox + 18, oy + 5, "#FFF0A0");
  rbox(ox, oy, 7, 6, "#F6C667"); R(ox + 1, oy + 2, 5, 1, c); P(ox + 3, oy + 1, "#FFFFFF");
});
const caixaSpr = () => sprite("caixa14", 9, 5, (ox, oy) => { rbox(ox, oy, 9, 5, "#E9C48A"); R(ox + 1, oy + 1, 7, 1, "#F6E2B8"); R(ox + 3, oy + 2, 3, 2, "#D9483D"); });
const maletaSpr = () => sprite("maleta14", 6, 5, (ox, oy) => { rbox(ox, oy + 1, 6, 4, "#7A4E2E"); R(ox + 2, oy, 2, 1, "#3A2433"); P(ox + 3, oy + 2, C.gold); });
const envelopeSpr = () => sprite("envelope14", 8, 6, (ox, oy) => { rbox(ox, oy, 8, 6, "#FFF4E0"); for (let i = 0; i < 4; i++){ P(ox + i, oy + i, "#D9C49A"); P(ox + 7 - i, oy + i, "#D9C49A"); } P(ox + 3, oy + 3, "#E8445E"); P(ox + 4, oy + 3, "#E8445E"); });
const caixaCorreioSpr = (cheia) => sprite("correio14:" + (cheia ? 1 : 0), 8, 12, (ox, oy) => { R(ox + 3, oy + 5, 2, 7, "#7A5236"); rbox(ox, oy, 8, 6, "#5B8FD0"); R(ox + 1, oy + 1, 6, 1, "#8FB8E8"); R(ox + 1, oy + 4, 6, 1, "#3F6FB0"); if (cheia){ R(ox + 7, oy - 2, 1, 4, "#E8445E"); R(ox + 7, oy - 2, 2, 2, "#E8445E"); R(ox + 1, oy + 2, 5, 1, "#FFF4E0"); } });
let svVis = [], correioVis = null;
function npcBlit(av, cx, by, dir, frame, pose, alpha){
  if (alpha != null && alpha < 1) ctx.globalAlpha = Math.max(0, alpha);
  R(cx - 3, by - 1, 6, 1, "rgba(35,18,40,.22)"); R(cx - 5, by, 10, 1, "rgba(35,18,40,.3)"); R(cx - 4, by + 1, 8, 1, "rgba(35,18,40,.2)");
  blitAvatar(av, cx, by, dir, frame, pose); ctx.globalAlpha = 1;
}
const poseIdle = (tm, k) => { const pisca = (tm + k * 377) % 3700 < 140; return pisca ? "blink" : Math.floor((tm + k * 211) / 800) % 2 ? "breath" : "stand"; };
// carro: quem foi de carro pro trabalho leva o carrinho (sai e volta com a cabecinha na janela)
const CARRO_TRAB = 3000;
function carroTrab(t){
  for (const [id, j] of Object.entries(jogadores)){
    const tr = trabDe(j); if (!tr || !tr.carro || t < tr.ini) continue;
    if (t < tr.ini + CARRO_TRAB){ const p = (t - tr.ini) / CARRO_TRAB; return { dx: Math.round(p * p * 240), show: true, dentro: [id], roda: 1 }; }
    if (t < tr.fim) return { show: false };
    if (t < tr.fim + CARRO_TRAB){ const p = (t - tr.fim) / CARRO_TRAB; return { dx: -Math.round((1 - p) * (1 - p) * 240), show: true, dentro: [id], roda: 1 }; }
  }
  return null;
}
{ const f0 = carroAnim; carroAnim = function(t){ if (passeio && (psAtivo() || (passeio.estado === "fim" && t < (passeio.fimAt || 0) + PS_SAI))) return f0(t); return carroTrab(t) || f0(t); }; }
{ const f0 = abrirPasseio; abrirPasseio = function(){ const w = carroTrab(srvNow()); if (w && !w.show && !psAtivo()){ toast("🚗 O carrinho está no trabalho com " + nomesLista(Object.entries(jogadores).filter(([, j]) => noTrabalho(j) && j.trab.carro).map(([id]) => nomeDe(id))) + "."); return; } return f0(); }; }
// quem foi a pé: anda pela rua com a maleta (saindo e voltando)
function addTrabObjs(objs, tm, t){
  if (andarAtual !== 0) return;
  for (const [id, j] of Object.entries(jogadores)){
    const tr = trabDe(j); if (!tr || tr.carro) continue;
    let k = null, ida = true;
    if (t >= tr.ini && t < tr.ini + TRAB.sai){ k = (t - tr.ini) / TRAB.sai; }
    else if (t >= tr.fim && t < tr.fim + TRAB.sai && (j.online || id === pid)){ k = (t - tr.fim) / TRAB.sai; ida = false; }
    if (k == null) continue;
    const lado = hash(tr.ini / 1000 | 0, 3, 5) % 2, p = portaRua(lado), x0 = lado ? W * T + 14 : -14;
    const cx = Math.round(ida ? p.cx + (x0 - p.cx) * k : x0 + (p.cx - x0) * k), dir = (ida ? x0 > p.cx : p.cx > x0) ? "right" : "left";
    const av = id === pid && me ? me.dados : j;
    objs.push({ z: p.by, f: () => { npcBlit(av, cx, p.by, dir, Math.floor(tm / 115) % 4, "stand"); ctx.drawImage(maletaSpr().c, cx + (dir === "right" ? -7 : 2), p.by - 9); } });
  }
}
// delivery: moto chega pela rua, entregador leva a caixa até a porta e volta
function deliveryEstado(p, t){
  const pr = portaRua(p.lado), x0 = p.lado ? W * T + 24 : -24, cp = carroPos(), park = pr.cx + (cp && cp.rua ? (pr.cx > cp.x + 15 ? 22 : -22) : p.lado ? 20 : -20), a = p.chega - SERV.pe - SERV.moto, b = p.chega - SERV.pe, volta = p.chega + 2500;
  if (t < a || t > volta + SERV.pe + SERV.moto) return null;
  const st = { by: pr.by, mx: park, moto: true, rider: false, cx: park, dir: p.lado ? "left" : "right", anda: false, caixa: !p.entregue, porta: false };
  if (t < b){ const k = (t - a) / SERV.moto, e = 1 - (1 - k) * (1 - k); st.mx = Math.round(x0 + (park - x0) * e); st.rider = true; st.cx = st.mx; st.dir = park > x0 ? "right" : "left"; }
  else if (t < p.chega){ const k = (t - b) / SERV.pe; st.cx = Math.round(park + (pr.cx - park) * k); st.anda = true; st.dir = pr.cx > park ? "right" : "left"; }
  else if (t < volta){ st.cx = pr.cx; st.dir = pr.sy === HC ? "up" : "down"; st.porta = true; }
  else if (t < volta + SERV.pe){ const k = (t - volta) / SERV.pe; st.cx = Math.round(pr.cx + (park - pr.cx) * k); st.anda = true; st.dir = park > pr.cx ? "right" : "left"; st.caixa = false; }
  else { const k = (t - volta - SERV.pe) / SERV.moto; st.mx = Math.round(park + (x0 - park) * k * k); st.rider = true; st.cx = st.mx; st.dir = x0 > park ? "right" : "left"; st.caixa = false; }
  return st;
}
function addServObjs(objs, tm, t){
  svVis = []; correioVis = null;
  if (andarAtual !== 0) return;
  const beto = SERV_NPC["npc-beto"];
  for (const [, p] of svPedidos()){
    const st = deliveryEstado(p, t); if (!st) continue;
    const fr = st.anda ? Math.floor(tm / 115) % 4 : 0;
    objs.push({ z: st.by + .2, f: () => {
      if (st.rider){ blitAvatar(beto.av, st.cx + (st.dir === "right" ? -2 : 2), st.by - 3, st.dir, 0, "stand"); }
      const s = motoSpr(); ctx.save(); if (st.dir === "left"){ ctx.translate(st.mx * 2, 0); ctx.scale(-1, 1); } ctx.drawImage(s.c, st.mx - 11, st.by - 11); ctx.restore();
      if (!st.rider){ npcBlit(beto.av, st.cx, st.by, st.dir, fr, st.anda ? "stand" : poseIdle(tm, 1)); if (st.caixa && st.dir !== "up") ctx.drawImage(caixaSpr().c, st.cx - 5, st.by - 12); }
    } });
    if (!st.rider) svVis.push({ id: "npc-beto", cx: st.cx, by: st.by, nome: st.porta && !p.entregue ? "toc toc!" : beto.nome });
  }
  // faxineira e jardineiro andando pela casa
  for (const v of svVisitas()){
    const st = npcServEstado(v, t); if (!st) continue;
    const id = v.tipo === "faxina" ? "npc-rosa" : "npc-tiao", n = SERV_NPC[id], cx = Math.round((st.x + .5) * T), by = Math.round((st.y + 1) * T - 3);
    const fz = st.faz, feito = fz && (v.feito || {})[fz.aid];
    objs.push({ z: by, f: () => {
      npcBlit(n.av, cx, by, st.dir, st.moving ? Math.floor(tm / 115) % 4 : 0, st.moving ? "stand" : fz ? "stand" : poseIdle(tm, 2), st.alpha);
      if (fz && !feito){
        if (v.tipo === "faxina") drawVassoura(cx, by, st.dir, tm, false);
        else { const gx = fz.alvo[0] * T + 8, gy = fz.alvo[1] * T - 2 + ((tm / 90) % 8); ctx.globalAlpha = .9; drawGota(gx - 1, gy); ctx.globalAlpha = 1; }
      }
    } });
    svVis.push({ id, cx, by, nome: n.nome });
  }
  // babá: perto das crianças enquanto o contrato vale (ou na visita "agora")
  const bv = servicos.babaVisita, naVisita = bv && t - bv.ini < SERV.babaVisita;
  if ((babaCobre(t) || naVisita) && temFilhos()){
    const pos = babaPos(); if (pos){
      const n = SERV_NPC["npc-lu"], cx = Math.round((pos.x + .5) * T), by = Math.round((pos.y + 1) * T - 3);
      const pose = Math.floor(tm / 2600) % 5 === 0 ? "arms" : poseIdle(tm, 3);
      objs.push({ z: by, f: () => npcBlit(n.av, cx, by, pos.dir, 0, pose) });
      svVis.push({ id: "npc-lu", cx, by, nome: n.nome });
    }
  }
  // envelope da conta: no mural (casa pronta) e na caixa de correio da frente
  const aberta = contasAbertas().length > 0;
  if (!visitando){
    const cx = T + 4, by = H * T - 2;
    correioVis = { x: cx - 1, y: by - 13, w: 10, h: 14 };
    objs.push({ z: by - 1, f: () => ctx.drawImage(caixaCorreioSpr(aberta).c, cx - 1, by - 13) });
    if (aberta && !casaZero && andarAtual === 0) objs.push({ z: 0, f: () => ctx.drawImage(envelopeSpr().c, MURAL.x * T + 8, MURAL.y * T + 1) });
  }
}
function babaPos(){
  const ids = famOrdem();
  for (const fid of ids){
    const p = typeof famPos === "function" ? famPos(fid) : null;
    if (p){ const x = Math.round(p.x), y = Math.round(p.y); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy, dir: dx > 0 ? "left" : dx < 0 ? "right" : dy > 0 ? "up" : "down" }; }
  }
  const b = Object.values(moveis).find(m => m && /berco/i.test(baseT(m.t)));
  if (b){ const c = CAT[b.t]; for (let dx = 0; dx < c.w; dx++) if (walkable(b.x + dx, b.y + c.h)) return { x: b.x + dx, y: b.y + c.h, dir: "up" }; }
  const [x, y] = freeSpot(); return { x, y, dir: "down" };
}
{ const f0 = addLeva10Objs; addLeva10Objs = function(objs, tm){ f0(objs, tm); try { const t = srvNow(); addTrabObjs(objs, tm, t); addServObjs(objs, tm, t); } catch(e){ console.error(e); } }; }
// quem está no trabalho some de casa (e não vira pelúcia enquanto o expediente corre)
{ const f0 = leva10Esconde; leva10Esconde = function(id, j){
  const tr = trabDe(j);
  if (tr){ const t = srvNow(); if (id === pid || t < tr.fim || (j.online && t < tr.fim + TRAB.sai)) return true; }
  return f0(id, j);
}; }
// sem luz: a casa fica no escuro (só sobra a luz das pessoas e da janela)
{ const f0 = leva11Luzes; leva11Luzes = function(lights, ativo, tm){ f0(lights, ativo, tm); if (luzCortada()) lights.length = 0; }; }
function bolhaNome14(mctx, K, nm, cx, by, cor){
  const top = (by - 27) * K; mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, cx * K, top); mctx.fillStyle = cor || "#FAC775"; mctx.fillText(nm, cx * K, top);
}
{ const f0 = drawLabels10; drawLabels10 = function(mctx, K, fs, tm){
  f0(mctx, K, fs, tm);
  if (mode !== "live") return;
  try {
    for (const v of svVis) bolhaNome14(mctx, K, v.nome, v.cx, v.by, v.nome === "toc toc!" ? "#FFFFFF" : "#FAC775");
    if (correioVis && contasAbertas().length){ mctx.fillStyle = luzCortada() ? "#F0707A" : "#FAC775"; mctx.fillText("!", (correioVis.x + 9) * K, (correioVis.y - 2) * K - Math.abs(Math.sin(tm / 250)) * K * 2); }
    if (andarAtual === 0){
      const t = srvNow(), fora = Object.entries(jogadores).filter(([id, j]) => id !== pid && noTrabalho(j, t) && t > j.trab.ini + TRAB.sai);
      if (fora.length){ const cp = carroPos(), x = cp && carroTrab(t) && !carroTrab(t).show ? cp.x + 15 : portaRua(0).cx; bolha9(mctx, fs, x * K, (H * T - 20) * K, "💼 " + nomesLista(fora.map(([id]) => nomeDe(id))) + (fora.length > 1 ? " estão" : " está") + " no trabalho"); }
    }
  } catch(e){ console.error(e); }
}; }

// =====================================================================
// 6. GANCHOS: toques, laço, vontade própria, banner, abas, computador, tarefas, relações
// =====================================================================
const svAt = (wx, wy, folga) => svVis.find(v => Math.hypot(wx - v.cx, (wy - (v.by - 11)) * .8) < 12 + (folga || 0));
{ const f0 = leva10Click; leva10Click = function(p, tx, ty, toque){
  if (f0(p, tx, ty, toque)) return true;
  if (mode !== "live") return false;
  if (meNoTrabalho()){ toast("Você está no trabalho 💼 Volta às " + horaTxt(meuTrab().fim) + "."); openTrabalho(); return true; }
  const v = svAt(p.x, p.y, toque ? 5 : 0);
  if (v){ const n = SERV_NPC[v.id]; openMenu(p, n.nome + " · " + n.papel, [{ nome: "Conversar 💬", info: "Amizade", fn: () => conversarNpc(v.id) }, { nome: "Dar gorjeta 💛", info: "$5", fn: () => gorjetaNpc(v.id) }]); return true; }
  const c = correioVis, f = toque ? 5 : 1;
  if (c && p.x >= c.x - f && p.x <= c.x + c.w + f && p.y >= c.y - f && p.y <= c.y + c.h + f){ openContas(); return true; }
  if (!casaZero && andarAtual === 0 && contasAbertas().length && tx === MURAL.x && ty === MURAL.y && p.x > MURAL.x * T + 7){ openContas(); return true; }
  return false;
}; }
// no trabalho as necessidades ficam paradas (o custo do dia vem no resumo)
{ const f0 = leva10Update; leva10Update = function(dt){
  if (meNoTrabalho()){ if (!trabSnap) trabSnap = Object.assign({}, me.needs); else Object.assign(me.needs, trabSnap); if (me.path.length){ me.path = []; me.plano = null; } if (me.acao) setAcao(null); }
  else trabSnap = null;
  f0(dt);
}; }
{ const f0 = agirSozinho; agirSozinho = function(){ if (meNoTrabalho()){ VIDA.ultAgir = Date.now(); return null; } return f0(); }; }
{ const f0 = bannerLeva10; bannerLeva10 = function(){
  const tr = me && !visitando ? meuTrab() : null;
  if (tr){
    const t = srvNow(), car = CARREIRAS[tr.car];
    if (eventoAberto(tr, t)) return { key: "t14e" + tr.ini, partes: () => [el("span", null, "💭 Decisão rápida no trabalho!"), btn("Ver", "btn small", openTrabalho)] };
    return { key: "t14" + tr.ini + (t >= tr.fim), partes: () => [el("span", null, car.ic + " No trabalho até " + horaTxt(tr.fim)), btn("Ver", "btn small", openTrabalho)] };
  }
  const b = f0(); if (b) return b;
  if (me && !visitando && luzCortada()) return { key: "k14corte", partes: () => [el("span", null, "🔌 A luz foi cortada"), btn("Pagar a conta", "btn small", openContas)] };
  return null;
}; }
{ const f0 = contadores16; contadores16 = function(){
  const c = f0(); if (!me || visitando) return c;
  const n = contasAbertas().length + (meuTrab() && eventoAberto(meuTrab()) ? 1 : 0);
  if (n) c.casa = luzCortada() ? "!" : n;
  return c;
}; }
{ const f0 = ITENS16.casa; ITENS16.casa = function(){
  const l = f0(); if (visitando) return l;
  const c = minhaCarreira(), tr = meuTrab(), ab = contasAbertas(), i = Math.max(0, l.findIndex(x => x.ic === "✅")) + 1;
  const tb = tr ? "No trabalho até " + horaTxt(tr.fim) : c ? cargoDe(c)[0] + (c.ultDia === dia14() ? " · hoje já foi" : janelaAberta(CARREIRAS[c.id]) ? " · dá pra ir agora!" : " · " + proxJanelaTxt(CARREIRAS[c.id])) : "Escolha uma carreira";
  l.splice(i, 0,
    { ic: "💼", t: "Trabalho", sub: tb, n: tr && eventoAberto(tr) ? "!" : 0, fn: openTrabalho },
    { ic: "📬", t: "Contas", sub: contasOff ? "Desligadas" : ab.length ? (luzCortada() ? "Luz cortada! " : "") + "$" + ab.reduce((s, [, x]) => s + restaDe(x), 0) + " pra pagar" : "Em dia ✓", n: ab.length ? (luzCortada() ? "!" : ab.length) : 0, fn: openContas },
    { ic: "🛎️", t: "Serviços", sub: pedidoAtivo() ? "Pedido a caminho 🛵" : "Delivery, faxineira, babá, jardineiro", fn: openServicos });
  return l;
}; }
{ const f0 = ITENS16.ajustes; ITENS16.ajustes = function(){
  const l = f0(); if (visitando) return l;
  l.splice(1, 0, { ic: "📬", t: "Contas da casa: " + (contasOff ? "desligadas" : "ligadas"), sub: contasOff ? "Sem conta semanal de luz, água e internet" : "Conta semanal de luz, água e internet", on: !contasOff, fecha: false, fn: () => setContasOff(!contasOff) });
  return l;
}; }
{ const f0 = MENU_EXTRA.pc; MENU_EXTRA.pc = (id, m) => { const l = f0(id, m); if (!visitando) l.splice(1, 0, { nome: "Carreira 💼", info: minhaCarreira() ? cargoDe(minhaCarreira())[0] : "Escolher", fn: openTrabalho }, { nome: "Contas 📬", info: contasAbertas().length ? "Pra pagar" : "Em dia", fn: openContas }, { nome: "Serviços 🛎️", info: "Delivery e mais", fn: openServicos }); return l; }; }
{ const f0 = openTarefas; openTarefas = function(){ f0(); if (painel && painel.id === "tarefas" && !visitando){ const c = painel.el.querySelector(".sheet > div:last-child"); if (c) c.append(btn("💼 Minha carreira (expediente com horário)", "btn ghost", () => { closePanel(); openTrabalho(); })); } }; }
// relações: NPCs de serviço entram na lista depois do primeiro papo
{ const f0 = nomeDe; nomeDe = function(id){ return SERV_NPC[id] ? SERV_NPC[id].nome : f0(id); }; }
{ const f0 = pessoasRel; pessoasRel = function(){ const l = f0(); for (const id of Object.keys(SERV_NPC)) if (relDe(pid, id)) l.push(id); return l; }; }
{ const f0 = rostoCanvas; rostoCanvas = function(id){
  if (!SERV_NPC[id]) return f0(id);
  const cv = el("canvas", "rosto13"); cv.width = 16; cv.height = 14; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(avatarSprite(SERV_NPC[id].av, "down", 0, "stand").c, 1, 7, 16, 14, 0, 0, 16, 14); cv.setAttribute("aria-hidden", "true"); return cv;
}; }
CONQUISTAS.push(
  { id: "promo1", nome: "Primeira promoção", txt: "Alguém da casa subiu de cargo.", meta: 1, val: () => moradores().some(([, j]) => carreiraDe(j) && (j.carreira.promo || 0) >= 1) ? 1 : 0 },
  { id: "chefeCasa", nome: "Chefe da casa", txt: "Chegou ao topo de uma carreira.", meta: 1, val: () => moradores().some(([, j]) => { const c = carreiraDe(j); return c && (c.cargo | 0) >= CARREIRAS[c.id].cargos.length - 1; }) ? 1 : 0 },
  { id: "contasDia", nome: "Contas em dia", txt: "4 contas da casa pagas antes de atrasar.", st: "contasEmDia", meta: 4 },
  { id: "pizza1", nome: "Noite da pizza", txt: "O primeiro delivery da casa.", st: "deliverys", meta: 1 }
);

// =====================================================================
// 7. OUVINTES E RELÓGIO DE 1 SEGUNDO
// =====================================================================
{ const f0 = leva11Ouvir; leva11Ouvir = function(){
  f0();
  on(ref("casa/contas"), "value", s => { contas = s.val() || {}; contasCarregadas = true; refreshPanel("contas"); refreshAba16(); humorCache = null; });
  on(ref("casa/contasInicio"), "value", s => { contasInicio = s.val() || null; });
  on(ref("casa/contasOff"), "value", s => { contasOff = !!s.val(); refreshPanel("contas"); });
  on(ref("casa/servicos"), "value", s => { servicos = s.val() || {}; servCarregado = true; refreshPanel("servicos"); });
}; }
{ const f0 = leva11Reset; leva11Reset = function(){
  f0();
  contas = {}; contasCarregadas = false; contasInicio = null; contasOff = false; ctTentou = {}; servicos = {}; servCarregado = false; svTentou = {};
  trabSnap = null; trabFechando = false; svVis = []; correioVis = null; rotaCache.clear();
}; }
setInterval(() => {
  if (!me || !salaRef) return;
  try {
    if (!visitando){ fecharExpediente(); vigiarContas(); cobrarServicos(); }
    vigiarDelivery(); vigiarVisitasServ(); vigiarFaxSemanal();
    if (!$("screenGame").hidden){ refreshPanel("trabalho"); refreshPanel("servicos"); }
  } catch(e){ console.error(e); }
}, 1000);
