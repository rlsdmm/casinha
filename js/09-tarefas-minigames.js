"use strict";
// Casinha · leva 2: conquistas, tarefas, emprego, jogo da velha/memória e quintal
// =====================================================================
// LEVA 2: minigames, tarefas do dia e emprego, conquistas do casal, quintal
//   casa/jogos/<id>        partida (convite → jogando → fim), cada jogada por transação
//   casa/diario/<data>     { feitos: {pid}, bonus: {pid}, dupla: ts, noite: ts }
//   casa/stats/<contador>  contadores do casal (sempre por transação: statMais)
//   casa/conquistas/<id>   { at, por }  data em que destravou
//   casa/cofre             { total, por: {pid: $}, liberado: ts, porta: x }  quintal
//   jogadores/<pid>/tarefas/<data> = { feitas: {tarefa: true}, completo, turnos }
// =====================================================================
let jogos = {}, stats = {}, conquistas = {}, cofre = {}, diario = {};
let jogosCarregados = false, statsCarregados = false, conqCarregadas = false, cofreCarregado = false, bannerKey = null;
function dataDe(ts){ const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
const hoje = () => dataDe(srvNow());
function statMais(k, n){ return txn("casa/stats/" + k, v => (v || 0) + (n || 1)); }

// ---- toast de conquista e confete ----
function toastEspecial(tit, sub){
  const espera = especialAte - Date.now();
  if (espera > 0){ setTimeout(() => toastEspecial(tit, sub), espera + 50); return; }
  const t = $("toast"); t.className = "toast gold"; t.textContent = ""; sfx("fanfarra");
  const tx = el("div"); tx.append(el("strong", null, tit), el("span", null, sub || ""));
  t.append(iconeSpr(trofeuSprite(true)), tx); t.hidden = false;
  especialAte = Date.now() + 4500; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 4500);
}
function confete(){
  const cores = ["#F6C667", "#E8607A", "#7FD1B2", "#7FB8E8", "#B49CF4", "#FFFFFF"];
  for (let i = 0; i < 80; i++) particles.push({ x: Math.random() * W * T, y: -Math.random() * 70, vx: Math.random() * 14 - 7, vy: 18 + Math.random() * 24, life: 5, kind: "conf", cor: cores[i % cores.length], ph: Math.random() * 6 });
}

// ---------------- conquistas ----------------
const CONQUISTAS = [
  { id: "danca1", nome: "Primeira dança", txt: "Dançaram juntos pela primeira vez.", st: "dancas", meta: 1 },
  { id: "danca10", nome: "Pé de valsa", txt: "10 danças a dois.", st: "dancas", meta: 10 },
  { id: "abraco10", nome: "10 abraços", txt: "Dez abraços apertados.", st: "abracos", meta: 10 },
  { id: "beijo1", nome: "Primeiro beijinho", txt: "Um beijinho na casa nova.", st: "beijos", meta: 1 },
  { id: "beijo25", nome: "Melosos", txt: "25 beijinhos.", st: "beijos", meta: 25 },
  { id: "noite1", nome: "De conchinha", txt: "Uma noite juntinhos na cama de casal.", st: "noites", meta: 1 },
  { id: "noite7", nome: "7 noites juntinhos", txt: "Sete noites dormindo juntos.", st: "noites", meta: 7 },
  { id: "chef1", nome: "Chef a quatro mãos", txt: "Cozinharam um prato juntos.", st: "pratosJuntos", meta: 1 },
  { id: "chef10", nome: "Restaurante do casal", txt: "10 pratos feitos a dois.", st: "pratosJuntos", meta: 10 },
  { id: "verde", nome: "Dedo verde", txt: "10 colheitas na horta.", st: "colheitas", meta: 10 },
  { id: "jogo1", nome: "Hora do jogo", txt: "Primeira partida um contra o outro.", st: "partidas", meta: 1 },
  { id: "jogo20", nome: "Rivais de sofá", txt: "20 partidas jogadas.", st: "partidas", meta: 20 },
  { id: "dupla1", nome: "Dia em dupla", txt: "Fizeram as tarefas no mesmo dia.", st: "diasDupla", meta: 1 },
  { id: "pet20", nome: "Xodó do bichinho", txt: "20 carinhos no bichinho.", st: "carinhos", meta: 20 },
  { id: "quintal", nome: "Quintal nosso", txt: "Juntaram dinheiro e compraram o quintal.", meta: 1, val: () => cofre.liberado ? 1 : 0 },
  { id: "andar2", nome: "Casa de dois andares", txt: "Juntaram dinheiro e construíram o 2º andar.", meta: 1, val: () => cofre2.liberado ? 1 : 0 },
  // leva 5
  { id: "faxina50", nome: "Faxineiros", txt: "50 sujeiras limpas pela casa.", st: "limpezas", meta: 50 },
  { id: "truques", nome: "Bichinho sabido", txt: "O bichinho aprendeu todos os truques.", st: "carinhos", meta: 100 },
  { id: "mingau", nome: "Amigo do bairro", txt: "O gatinho de rua virou amigo da casa.", meta: 1, val: () => visitaDB.gato && visitaDB.gato.amigo ? 1 : 0 }
];
const conqValor = c => c.val ? c.val() : (stats[c.st] || 0);
const conqTentou = {};
function checarConquistas(){
  if (!me || !statsCarregados || !conqCarregadas || !cofreCarregado) return;
  for (const c of CONQUISTAS){
    if (conquistas[c.id] || conqTentou[c.id] || conqValor(c) < c.meta) continue;
    conqTentou[c.id] = 1;
    txn("casa/conquistas/" + c.id, cur => cur ? undefined : { at: srvNow(), por: pid }).then(() => { setTimeout(() => { conqTentou[c.id] = 0; }, 5000); });
  }
}
function celebrar(c){ toastEspecial("Conquista: " + c.nome, c.txt); confete(); }
function drawTrofeu(x, y, on){
  const g = on ? "#F6C667" : "#8A8398", gL = on ? "#FCE9B8" : "#B4AECB", gD = on ? "#D8963A" : "#625C72";
  R(x, y + 1, 1, 3, g); P(x + 1, y + 1, g); P(x + 1, y + 4, g); R(x + 11, y + 1, 1, 3, g); P(x + 10, y + 1, g); P(x + 10, y + 4, g);
  R(x + 2, y, 8, 5, g); R(x + 3, y + 5, 6, 1, g); R(x + 4, y + 6, 4, 1, gD);
  R(x + 3, y + 1, 1, 3, gL); P(x + 4, y + 1, gL); R(x + 8, y + 1, 1, 4, gD); R(x + 2, y, 8, 1, gL);
  R(x + 5, y + 7, 2, 2, gD);
  rbox(x + 2, y + 9, 8, 3, on ? C.woodD : "#4A4258"); R(x + 3, y + 9, 6, 1, on ? C.wood : "#5E5670");
  if (on){ P(x + 6, y + 2, "#FFFFFF"); pixHeart(x + 4, y + 2, "#E8607A"); }
}
const trofeuSprite = on => sprite("trofeu:" + (on ? 1 : 0), 12, 12, (ox, oy) => drawTrofeu(ox, oy, on));
// quadro de troféus na parede da cozinha (ao lado do relógio): uma taça acende com 1, 5 e 10 conquistas
const QUADRO = { x: 9, y: 8 };
function drawQuadroTrofeus(tm){
  const px = QUADRO.x * T, py = QUADRO.y * T, n = CONQUISTAS.filter(c => conquistas[c.id]).length;
  R(px + 1, py + 3, 14, 10, C.woodD); R(px + 1, py + 3, 14, 1, C.wood); R(px + 1, py + 12, 14, 1, C.woodDD);
  R(px + 2, py + 4, 12, 8, "#4E3F92"); R(px + 2, py + 4, 12, 1, "#3E3075"); R(px + 2, py + 10, 12, 1, C.wood); R(px + 2, py + 11, 12, 1, "#3E3075");
  [1, 5, 10].forEach((meta, i) => {
    const on = n >= meta, x = px + 3 + i * 4, y = py + 5, g = on ? "#F6C667" : "#6A5FA8", gD = on ? "#D8963A" : "#5A4E94";
    R(x, y, 3, 2, g); P(x + 1, y + 2, gD); P(x + 1, y + 3, gD); R(x, y + 4, 3, 1, on ? C.woodD : gD);
    if (on) P(x, y, "#FCE9B8");
  });
  const k = Math.floor(tm / 260) % 14; if (n && k < 3){ ctx.globalAlpha = .9; P(px + 4 + k * 4, py + 5, "#FFFFFF"); ctx.globalAlpha = 1; }
}
function openTrofeus(){
  openPanel("trofeus", "Troféus do casal", corpo => {
    const resumo = el("p", "muted"), grade = el("div", "trofs");
    corpo.append(resumo, grade);
    const upd = () => {
      const n = CONQUISTAS.filter(c => conquistas[c.id]).length;
      resumo.textContent = n + " de " + CONQUISTAS.length + " conquistas. Vale o que todo mundo da casa faz junto.";
      grade.textContent = "";
      const ord = CONQUISTAS.slice().sort((a, b) => (conquistas[b.id] ? 1 : 0) - (conquistas[a.id] ? 1 : 0));
      for (const c of ord){
        const on = !!conquistas[c.id], card = el("div", "trof " + (on ? "on" : "off")), tx = el("div", "tx");
        tx.append(el("strong", null, c.nome), el("small", null, c.txt));
        if (on){ const at = conquistas[c.id].at; tx.append(el("small", null, "Destravada em " + new Date(at).toLocaleDateString("pt-BR"))); }
        else { const v = Math.min(conqValor(c), c.meta), w = el("div", "need"), r = el("div", "row"); r.append(el("span", null, "Progresso"), el("span", null, v + "/" + c.meta)); const bar = barra(v / c.meta * 100, "#B49CF4"); bar.firstChild.style.background = "#B49CF4"; w.append(r, bar); tx.append(w); }
        card.append(iconeSpr(trofeuSprite(on)), tx); grade.append(card);
      }
    };
    upd(); return upd;
  });
}

// ---------------- tarefas do dia e emprego ----------------
const TAREFAS = [
  { id: "regar", nome: "Regar o jardim", dica: "Num canteiro ou numa planta", ok: a => a.id === "regar" },
  { id: "cozinhar", nome: "Cozinhar um prato", dica: "No fogão", ok: a => /^coz-/.test(a.id) && a.id !== "coz-ajuda" },
  { id: "carinho", nome: "Fazer carinho no bichinho", dica: "Toque no bichinho", ok: a => a.id === "pet-carinho" },
  { id: "comida", nome: "Dar comida pro bichinho", dica: "No pote do bichinho", ok: a => a.id === "pet-comida" },
  { id: "banho", nome: "Tomar banho", dica: "No chuveiro ou na banheira", ok: a => a.id === "banho" || a.id === "banheira" },
  { id: "dancar", nome: "Dançar com alguém", dica: "Toque em alguém ou dancem no som", ok: a => a.id === "s-dancar" || (a.id === "dancar" && !!a.junto) },
  { id: "ler", nome: "Ler um livro", dica: "Na estante", ok: a => a.id === "ler" },
  { id: "tv", nome: "Assistir TV", dica: "Na TV", ok: a => a.id === "tv" },
  { id: "abraco", nome: "Dar um abraço", dica: "Toque em alguém", ok: a => a.id === "s-abracar" },
  { id: "conversar", nome: "Conversar com alguém", dica: "Toque em alguém", ok: a => a.id === "s-conversar" },
  { id: "cafe", nome: "Tomar um café", dica: "Na mesa", ok: a => a.id === "cafe" },
  { id: "trabalhar", nome: "Trabalhar um turno", dica: "No computador", ok: a => a.id === "trabalhar" },
  { id: "jogar", nome: "Jogar uma partida", dica: "Na TV ou no computador, com alguém", ok: a => a.id === "minigame" },
  { id: "dormir", nome: "Dormir ou tirar um cochilo", dica: "Na cama", ok: a => a.id === "dormir" || a.id === "cochilo" },
  { id: "faxina", nome: "Limpar 3 sujeiras", dica: "Toque nas sujeiras pela casa (ou no botão Faxina)", ok: a => a.id === "limpar3" } // leva 5
];
const TAREFA_PAGA = 30, DIA_COMPLETO = 50, DIA_DUPLA = 80, TURNOS_DIA = 4;
// 3 por dia, sorteadas pela data + código da sala: iguais em todos os aparelhos
function tarefasDoDia(d){
  let sd = salaSeed; for (const ch of d) sd = (Math.imul(sd, 31) + ch.charCodeAt(0)) | 0;
  const out = []; for (let i = 0; out.length < 3 && i < 60; i++){ const t = TAREFAS[hash(sd, i, 61) % TAREFAS.length]; if (!out.includes(t)) out.push(t); }
  return out;
}
function minhasTarefas(d){ const j = jogadores[pid]; return (j && j.tarefas && j.tarefas[d || hoje()]) || {}; }
const tarefaPend = {};
function tarefaCheck(a){
  if (!me || !a || !a.id) return;
  const d = hoje(), lista = tarefasDoDia(d), base = "jogadores/" + pid + "/tarefas/" + d;
  for (const t of lista){
    if ((minhasTarefas(d).feitas || {})[t.id] || tarefaPend[d + t.id] || !t.ok(a)) continue;
    tarefaPend[d + t.id] = 1;
    txn(base + "/feitas/" + t.id, cur => cur ? undefined : true).then(ok => {
      if (!ok) return;
      ganhar(TAREFA_PAGA); toast("Tarefa feita: " + t.nome.toLowerCase() + ". +$" + TAREFA_PAGA);
      const f = Object.assign({}, minhasTarefas(d).feitas || {}, { [t.id]: true });
      if (!lista.every(x => f[x.id])) return;
      txn(base + "/completo", c => c ? undefined : true).then(ok2 => {
        if (!ok2) return;
        ganhar(DIA_COMPLETO); toastEspecial("Tarefas do dia feitas!", "+$" + DIA_COMPLETO + " de bônus. Amanhã tem outras.");
        ref("casa/diario/" + d + "/feitos/" + pid).set(true).then(checarDupla, () => {});
      });
    });
  }
}
// dois ou mais com as 3 tarefas no mesmo dia: cada um pega o próprio bônus uma vez; o dia conta uma vez
function checarDupla(){
  if (!me) return;
  const d = hoje(), dia = diario[d] || {}, feitos = Object.keys(dia.feitos || {});
  if (feitos.length < 2) return;
  if (feitos.includes(pid) && !(dia.bonus || {})[pid] && !tarefaPend["bonus" + d]){
    tarefaPend["bonus" + d] = 1;
    txn("casa/diario/" + d + "/bonus/" + pid, c => c ? undefined : true).then(ok => {
      if (!ok) return; ganhar(DIA_DUPLA);
      toastEspecial("Dia em dupla! +$" + DIA_DUPLA, feitos.filter(p => p !== pid).map(nomeDe).join(", ") + " também fez tudo hoje."); confete();
    });
  }
  if (!dia.dupla && !tarefaPend["dupla" + d]){
    tarefaPend["dupla" + d] = 1;
    txn("casa/diario/" + d + "/dupla", c => c ? undefined : srvNow()).then(ok => { if (ok){ statMais("diasDupla"); xpCasal(20); } });
  }
}
let diarioLimpo = false;
function limparDiario(){
  if (diarioLimpo || !me) return; diarioLimpo = true;
  const corte = dataDe(srvNow() - 4 * 24 * HORA);
  for (const k of Object.keys(diario)) if (k < corte) ref("casa/diario/" + k).remove().catch(() => {});
}
function limparTarefasVelhas(d){
  const ok = [hoje(), dataDe(srvNow() - 24 * HORA)];
  for (const k of Object.keys((d && d.tarefas) || {})) if (!ok.includes(k)) ref("jogadores/" + pid + "/tarefas/" + k).remove().catch(() => {});
}
function acaoTerminada(a){
  if (a.id !== "minigame") tarefaCheck(a); // partida conta quando termina de verdade (pagarJogo)
  acaoTerminada7(a); // leva 7: desejo de grávida, cuidados com o bebê
  if (a.id === "dancar" && a.junto && pid < a.junto) statMais("dancas"); // dança no som: conta uma vez por par
  if (a.junto) xpCasal(XP_JUNTO); else if (/^s-/.test(a.id)) xpCasal(XP_SOCIAL); // leva 6: nível do casal
}
// noites juntinhos: dois dormindo na mesma cama de casal; no máximo uma por noite (data de 12h atrás)
function checarNoite(a){
  const m = a.mov && moveis[a.mov]; if (!m || (m.t !== "casal" && m.t !== "dossel")) { a.noiteOk = true; return; }
  const par = Object.entries(jogadores).find(([id, j]) => id !== pid && j.online && j.acao && j.acao.id === "dormir" && j.acao.mov === a.mov && Date.now() - (j.acao.ini || 0) < (j.acao.dur || 0) + 3000);
  if (!par) return;
  a.noiteOk = true;
  txn("casa/diario/" + dataDe(srvNow() - 12 * HORA) + "/noite", c => c ? undefined : srvNow()).then(ok => { if (ok){ statMais("noites"); xpCasal(15); toast("Dormindo de conchinha com " + nomeDe(par[0]) + "."); } });
}
const turnosHoje = () => minhasTarefas().turnos || 0;
const TRABALHO = { id: "trabalhar", nome: "Trabalhando (home office)", dur: 15, ganho: { diversao: -10, energia: -8 }, dinheiro: 90,
  antes: () => {
    if (turnosHoje() >= TURNOS_DIA){ toast("Chega de trabalho por hoje. Amanhã tem mais."); return false; }
    if (me.needs.energia < 12){ toast("Cansado(a) demais pra trabalhar. Vá dormir um pouco."); return false; }
    return true;
  },
  fim: () => txn("jogadores/" + pid + "/tarefas/" + hoje() + "/turnos", v => (v || 0) + 1) };
const VIDEOS = { id: "videos", nome: "Ver vídeos", dur: 8, ganho: { diversao: 20 } };
MENU_EXTRA.pc = id => {
  const n = tarefasDoDia(hoje()).filter(t => (minhasTarefas().feitas || {})[t.id]).length;
  return [
    { nome: "Trabalhar", info: "+$" + TRABALHO.dinheiro + " · " + turnosHoje() + "/" + TURNOS_DIA + " hoje", fn: () => useFurn(id, TRABALHO) },
    { nome: "Ver vídeos", info: "Diversão", fn: () => useFurn(id, VIDEOS) },
    { nome: "Tarefas de hoje", info: n + "/3", fn: openTarefas }
  ].concat(jogarItens(id));
};
MENU_EXTRA.tv = id => jogarItens(id);
function openTarefas(){
  openPanel("tarefas", "Tarefas de hoje", corpo => {
    const info = el("p", "muted"), lista = el("div", "list"), dupla = el("p"), trab = el("div", "rowi");
    dupla.style.fontWeight = "700";
    corpo.append(info, lista, dupla, el("h3", null, "Emprego"), trab);
    let sig = null;
    const upd = () => {
      const d = hoje(), ts = tarefasDoDia(d), mt = minhasTarefas(d), f = mt.feitas || {}, dia = diario[d] || {};
      const s = JSON.stringify([d, mt, dia.feitos || {}, Math.floor(me ? me.dinheiro : 0)]); if (s === sig) return; sig = s;
      info.textContent = "São as mesmas pra todo mundo da casa e mudam todo dia. Cada uma vale +$" + TAREFA_PAGA + "; fazendo as 3, mais +$" + DIA_COMPLETO + ".";
      lista.textContent = "";
      for (const t of ts){
        const feita = !!f[t.id], row = el("div", "rowi" + (feita ? " feita" : "")), esq = el("div", "me"), tx = el("div", "tx");
        esq.style.gap = "10px"; tx.append(el("strong", null, t.nome), el("small", null, feita ? "Feita" : t.dica));
        esq.append(el("span", "chk", feita ? "✓" : ""), tx); row.append(esq, el("span", "money", feita ? "" : "+$" + TAREFA_PAGA));
        lista.append(row);
      }
      const quem = Object.keys(dia.feitos || {});
      dupla.textContent = quem.length >= 2 ? "Dia em dupla! " + quem.map(nomeDe).join(" e ") + " fizeram tudo hoje: +$" + DIA_DUPLA + " pra cada."
        : quem.length === 1 ? (quem[0] === pid ? "Você fez as 3." : nomeDe(quem[0]) + " já fez as 3.") + " Se mais alguém fizer hoje, é dia em dupla: +$" + DIA_DUPLA + " pra cada."
        : "Se dois ou mais fizerem as 3 hoje, é dia em dupla: +$" + DIA_DUPLA + " pra cada.";
      trab.textContent = "";
      const tx = el("div", "tx"), tn = turnosHoje(), pc = primeiro("pc");
      tx.append(el("strong", null, "Home office no computador"), el("small", null, "+$" + TRABALHO.dinheiro + " por turno · cansa um pouco · " + tn + "/" + TURNOS_DIA + " turnos hoje"));
      const b = btn(tn >= TURNOS_DIA ? "Folga" : "Trabalhar", "btn small", () => { closePanel(); useFurn(pc, TRABALHO); });
      b.disabled = !pc || tn >= TURNOS_DIA; trab.append(tx, b);
    };
    upd(); return upd;
  });
}

// ---------------- minigames: jogo da velha e jogo da memória ----------------
// casa/jogos/<id> = { tipo, a (quem chamou, X), b, estado: convite|jogando|fim|recusado|cancelado|expirou,
//   mov (TV/PC), criado, ultima (última jogada), vez, vencedor (pid|"empate"), motivo, quem, fimAt, pago: {pid}, contado,
//   velha: tab ("x", "o" ou "." × 9), linha;  memória: cartas (12 dígitos), abertas ("a"/"b"/"." × 12), viradas ("i,j"), pa, pb }
const JOGO_TIPOS = { velha: "Jogo da velha", memoria: "Jogo da memória" };
const JOGO_DESC = { velha: "Três em linha. Quem chamou começa com X.", memoria: "Achem os pares. Acertou, joga de novo." };
const MEMO_ICONES = ["ovo", "leite", "macarrao", "alface", "tomate", "morango"];
const JOGO_PREMIO = 40, JOGO_EMPATE = 10, CONVITE_MS = 45000, SAIU_MS = 15000, PARADO_MS = 180000;
const ATIVO = g => g && (g.estado === "convite" || g.estado === "jogando");
const outroDe = g => g.a === pid ? g.b : g.a;
const setCh = (s, i, c) => s.slice(0, i) + c + s.slice(i + 1);
function jogoAtivoDe(p){ return Object.entries(jogos).find(([, g]) => ATIVO(g) && (g.a === p || g.b === p)); }
function jogarItens(mov){
  const at = jogoAtivoDe(pid);
  if (at) return [{ nome: "Voltar pro jogo", info: JOGO_TIPOS[at[1].tipo], fn: () => { abrirJogo(at[0]); if (!(me.acao && me.acao.jogo === at[0]) && moveis[at[1].mov]) irJogar(at[0]); } }];
  const outros = Object.entries(jogadores).filter(([id, j]) => id !== pid && j.online && j.nome);
  if (!outros.length) return [{ nota: 1, nome: "Chame alguém pra jogar junto." }];
  return outros.slice(0, 3).map(([id, j]) => ({ nome: "Jogar com " + nomeDe(id), info: (j.andar || 0) !== andarAtual ? "Está " + ondeTxt(j.andar || 0) : "Escolha o jogo", fn: () => escolherJogo(mov, id) }));
}
function escolherJogo(mov, outro){
  openPanel("escolher", "Jogar com " + nomeDe(outro), corpo => {
    corpo.append(el("p", "muted", nomeDe(outro) + " recebe o convite na hora. Quem ganhar leva +$" + JOGO_PREMIO + "."));
    const g = el("div", "grid2");
    for (const [k, n] of Object.entries(JOGO_TIPOS)){
      const b = btn("", "btn ghost escolha", () => { closePanel(); convidarJogo(mov, outro, k); });
      b.append(el("strong", null, n), el("small", null, JOGO_DESC[k])); g.append(b);
    }
    corpo.append(g);
  });
}
function convidarJogo(mov, outro, tipo){
  if (!moveis[mov]) return;
  if (!jogadores[outro] || !jogadores[outro].online){ toast(nomeDe(outro) + " não está na casa agora."); return; }
  const meu = jogoAtivoDe(pid); if (meu){ abrirJogo(meu[0]); return; }
  if (jogoAtivoDe(outro)){ toast(nomeDe(outro) + " já está jogando."); return; }
  const id = ref("casa/jogos").push().key, t = srvNow();
  const g = { tipo, a: pid, b: outro, estado: "convite", mov, criado: t, ultima: t, vez: pid };
  if (tipo === "velha") g.tab = ".........";
  else if (JOGO6[tipo]) JOGO6[tipo].criar(g); // leva 6: reflexo, desenho, perguntas
  else {
    const c = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5];
    for (let i = c.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
    Object.assign(g, { cartas: c.join(""), abertas: "............", viradas: "", pa: 0, pb: 0 });
  }
  ref("casa/jogos/" + id).set(g).then(() => { abrirJogo(id); irJogar(id); }, () => toast("Não deu pra chamar agora."));
}
// sofá de frente para a TV (se tiver): os dois jogam sentados, olhando pra tela
function sofaDaTv(m){
  const ids = Object.keys(moveis).filter(k => { const s = moveis[k]; return s.t === "sofa" && s.y > m.y && s.y - m.y <= 7 && s.x < m.x + CAT.tv.w && s.x + CAT.sofa.w > m.x; });
  return ids.sort()[0] || null;
}
function irJogar(id){
  const g = jogos[id]; if (!g) return;
  if (!moveis[g.mov]){ // leva 4: a TV/PC do jogo está no outro andar; o jogo funciona pelo painel mesmo assim
    const mm = todosMoveis[g.mov];
    if (mm) toast("A " + (mm.t === "pc" ? "tela do computador" : "TV") + " desse jogo fica " + ondeTxt(mm.andar || 0) + ". Dá pra jogar daqui, ou " + ((mm.andar || 0) > andarAtual ? "suba" : "desça") + " pra jogar juntinho.");
    return;
  }
  const m = moveis[g.mov], sofa = m.t === "tv" ? sofaDaTv(m) : null;
  useFurn(sofa || g.mov, {
    id: "minigame", nome: JOGO_TIPOS[g.tipo] + " com " + nomeDe(outroDe(g)), dur: 3600, ganho: {}, tela: g.mov, cima: sofa ? 1 : 0, sobre: sofa ? 1 : 0, jogo: id,
    antes: () => ATIVO(jogos[id]),
    cancel: () => desistirJogo(id)
  });
}
function aceitarJogo(id){
  txn("casa/jogos/" + id, cur => { if (!cur || cur.estado !== "convite" || cur.b !== pid) return; cur.estado = "jogando"; cur.ultima = srvNow(); cur.vez = cur.a; if (JOGO6[cur.tipo]) JOGO6[cur.tipo].comecar(cur, srvNow()); return cur; })
    .then(ok => { if (!ok){ toast("Esse convite já era."); return; } abrirJogo(id); irJogar(id); });
}
function desistirJogo(id){
  txn("casa/jogos/" + id, cur => {
    if (!cur) return;
    if (cur.estado === "convite"){ cur.estado = cur.a === pid ? "cancelado" : "recusado"; cur.fimAt = srvNow(); return cur; }
    if (cur.estado === "jogando"){ Object.assign(cur, { estado: "fim", vencedor: cur.a === pid ? cur.b : cur.a, motivo: "desistiu", quem: pid, fimAt: srvNow() }); return cur; }
  });
}
const LINHAS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function velhaVence(t){ for (const l of LINHAS) if (t[l[0]] !== "." && t[l[0]] === t[l[1]] && t[l[1]] === t[l[2]]) return l; return null; }
function jogar(id, i){
  txn("casa/jogos/" + id, cur => {
    if (!cur || cur.estado !== "jogando" || cur.vez !== pid) return;
    const t = srvNow(), outro = cur.a === pid ? cur.b : cur.a;
    if (cur.tipo === "velha"){
      if (cur.tab[i] !== ".") return;
      cur.tab = setCh(cur.tab, i, cur.a === pid ? "x" : "o");
      const l = velhaVence(cur.tab);
      if (l) Object.assign(cur, { estado: "fim", vencedor: pid, linha: l.join(""), fimAt: t });
      else if (!cur.tab.includes(".")) Object.assign(cur, { estado: "fim", vencedor: "empate", fimAt: t });
      else cur.vez = outro;
    } else {
      if (cur.abertas[i] !== ".") return;
      let v = cur.viradas ? cur.viradas.split(",").map(Number) : [];
      if (v.length >= 2) v = []; // o erro de antes já foi visto: vira de volta
      if (v.includes(i)) return;
      v.push(i);
      if (v.length === 2){
        const lado = cur.a === pid ? "a" : "b";
        if (cur.cartas[v[0]] === cur.cartas[v[1]]){
          cur.abertas = setCh(setCh(cur.abertas, v[0], lado), v[1], lado); cur["p" + lado] = (cur["p" + lado] || 0) + 1; v = [];
          if (!cur.abertas.includes(".")) Object.assign(cur, { estado: "fim", vencedor: cur.pa > cur.pb ? cur.a : cur.pb > cur.pa ? cur.b : "empate", fimAt: t });
        } else cur.vez = outro;
      }
      cur.viradas = v.join(",");
    }
    cur.ultima = t; return cur;
  });
}
// resultado: diversão pra todos que jogaram, moedas pro vencedor (cada um paga a si mesmo uma vez)
const jogoPago = {};
function pagarJogo(id, g){
  jogoPago[id] = 1;
  txn("casa/jogos/" + id + "/pago/" + pid, c => c ? undefined : true).then(ok => {
    if (!ok) return;
    const nO = nomeDe(outroDe(g)), ganhei = g.vencedor === pid, empate = g.vencedor === "empate";
    ganharNeeds({ diversao: 25, social: 10 });
    const pq = g.tipo === "perguntas" ? ((g.pq || {}).ac || 0) : 0;
    xpCasal(g.tipo === "perguntas" ? 6 + pq * 2 : 8); // leva 6: partida conta pro nível do casal
    if (g.tipo === "perguntas" && !g.motivo){ const v = pq * PQ_PAGA; if (v) ganhar(v); toast("Vocês acertaram " + pq + " de " + PQ_RODADAS + "." + (v ? " +$" + v + " pra cada." : "")); }
    else if (g.motivo === "tempo" && empate) toast("O jogo ficou parado e acabou.");
    else if (ganhei){ ganhar(JOGO_PREMIO); toast((g.motivo ? nO + " saiu do jogo. " : "") + "Vitória sua! +$" + JOGO_PREMIO); }
    else if (empate){ ganhar(JOGO_EMPATE); toast("Empate! +$" + JOGO_EMPATE + " pra cada."); }
    else toast(g.motivo === "desistiu" && g.quem === pid ? "Você saiu do jogo." : nO + " ganhou essa. Revanche?");
    tarefaCheck({ id: "minigame" });
    txn("casa/jogos/" + id + "/contado", c => c ? undefined : true).then(ok2 => { if (!ok2) return; statMais("partidas"); if (JOGO6[g.tipo]) statMais(JOGO6[g.tipo].st); if (g.tipo === "perguntas" && !g.motivo && pq >= PQ_RODADAS) statMais("perfeitos"); });
  });
}
function terminarAcaoJogo(id){ if (me && me.acao && me.acao.jogo === id){ me.acao.acabou = true; setAcao(null); } }
function aoMudarJogos(novo){
  const ant = jogos; jogos = novo;
  if (jogosCarregados && me) for (const [id, g] of Object.entries(jogos)){
    if (!g) continue; const a = ant[id];
    if (g.b === pid && g.estado === "convite" && !a) toast(nomeDe(g.a) + " te chamou pra jogar " + JOGO_TIPOS[g.tipo].toLowerCase() + ".");
    if (g.a === pid && a && a.estado === "convite" && g.estado !== "convite"){
      if (g.estado === "jogando") toast(nomeDe(g.b) + " aceitou. Bora jogar!");
      else if (g.estado === "recusado") toast(nomeDe(g.b) + " não pode agora.");
      else if (g.estado === "expirou") toast(nomeDe(g.b) + " não respondeu o convite.");
    }
  }
  jogosCarregados = true; refreshPanel("jogo"); vigiarJogos();
}
// roda a cada segundo: convites vencidos, quem saiu no meio, prêmios e limpeza
const jogoTx = {};
function jogoTxn(id, k, fn){ const key = id + k; if (jogoTx[key] && Date.now() - jogoTx[key] < 5000) return; jogoTx[key] = Date.now(); txn("casa/jogos/" + id, fn); }
function vigiarJogos(){
  if (!me || !jogosCarregados) return;
  const t = srvNow();
  for (const [id, g] of Object.entries(jogos)){
    if (!g) continue;
    const meu = g.a === pid || g.b === pid;
    if (!ATIVO(g)){
      if (meu) terminarAcaoJogo(id);
      if (meu && g.estado === "fim" && !(g.pago || {})[pid] && !jogoPago[id]) pagarJogo(id, g);
      if (t - (g.fimAt || g.ultima || 0) > 120000) jogoTxn(id, "rm", () => null);
      continue;
    }
    if (!meu){ if (t - (g.ultima || 0) > 15 * 60000) jogoTxn(id, "rm", () => null); continue; }
    if (g.estado === "convite" && t - (g.criado || 0) > CONVITE_MS)
      jogoTxn(id, "exp", cur => { if (!cur || cur.estado !== "convite") return; cur.estado = "expirou"; cur.fimAt = srvNow(); return cur; });
    else if (g.estado === "jogando" && JOGO6[g.tipo]) vigiarJogo6(id, g, t); // leva 6: jogos ao mesmo tempo (sem vez)
    else if (g.estado === "jogando" && g.vez !== pid){
      const jo = jogadores[g.vez], saiu = !jo || !jo.online;
      if ((saiu && t - g.ultima > SAIU_MS) || t - g.ultima > PARADO_MS)
        jogoTxn(id, "wo", cur => {
          if (!cur || cur.estado !== "jogando" || cur.vez === pid) return;
          const j2 = jogadores[cur.vez], s2 = !j2 || !j2.online, tt = srvNow();
          if (!(s2 && tt - cur.ultima > SAIU_MS) && tt - cur.ultima <= PARADO_MS) return;
          Object.assign(cur, { estado: "fim", vencedor: pid, motivo: s2 ? "saiu" : "tempo", quem: cur.vez, fimAt: tt }); return cur;
        });
    }
  }
  if (me.acao && me.acao.jogo && !jogos[me.acao.jogo] && Date.now() - me.acao.ini > 5000) terminarAcaoJogo(me.acao.jogo);
  renderBannerJogo();
}
// faixa no topo da tela: convite recebido, ou "sua vez" com o painel fechado
function renderBannerJogo(){
  const b = $("banner"); let key = "", partes = null;
  const conv = Object.entries(jogos).find(([, g]) => g && g.b === pid && g.estado === "convite");
  const at = jogoAtivoDe(pid), aberto = painel && painel.id === "jogo";
  if (conv){
    const [id, g] = conv; key = "c" + id;
    partes = () => { const bb = el("div", "bb"); bb.append(btn("Aceitar", "btn small", () => aceitarJogo(id)), btn("Agora não", "btn ghost small", () => desistirJogo(id))); return [el("span", null, nomeDe(g.a) + " te chamou pra jogar " + JOGO_TIPOS[g.tipo].toLowerCase() + "."), bb]; };
  } else if (at && at[1].estado === "jogando" && !aberto){
    const [id, g] = at, minha = g.vez === pid; key = "v" + id + minha;
    partes = () => [el("span", null, (minha && !JOGO6[g.tipo] ? "Sua vez: " : "Jogando: ") + JOGO_TIPOS[g.tipo].toLowerCase() + "."), btn("Abrir", "btn small", () => abrirJogo(id))];
  }
  if (!partes){ const b7 = bannerLeva7(); if (b7){ key = b7.key; partes = b7.partes; } } // leva 7: convite pra namorar, bebê
  if (!partes){ const b9 = bannerLeva9(); if (b9){ key = b9.key; partes = b9.partes; } } // leva 9: convite pro jantar, filme passando
  if (key === bannerKey) return; bannerKey = key;
  b.className = "banner jogo"; b.textContent = ""; b.hidden = !partes;
  if (partes) b.append(...partes());
}
function abrirJogo(id){
  const g0 = jogos[id];
  if (g0 && JOGO6[g0.tipo]) return abrirJogo6(id); // leva 6
  openPanel("jogo", g0 ? JOGO_TIPOS[g0.tipo] : "Jogo", corpo => {
    const placar = el("div", "placar"), status = el("p", "jstatus"), tab = el("div"), acoes = el("div", "hbtns");
    status.setAttribute("aria-live", "polite");
    corpo.append(placar, status, tab, acoes);
    let sig = null;
    const upd = () => {
      const g = jogos[id];
      const s = JSON.stringify(g || 0) + (g ? String(!!(jogadores[outroDe(g)] || {}).online) : ""); if (s === sig) return; sig = s;
      placar.textContent = ""; tab.textContent = ""; acoes.textContent = "";
      if (!g){ status.textContent = "Esse jogo acabou."; acoes.append(btn("Fechar", "btn ghost", closePanel)); return; }
      const outro = outroDe(g), eu = g.a === pid ? "a" : "b", nO = nomeDe(outro), on = !!(jogadores[outro] || {}).online, velha = g.tipo === "velha";
      for (const [p, lado] of [[pid, eu], [outro, eu === "a" ? "b" : "a"]]){
        const c = el("div", "pl" + (g.estado === "jogando" && g.vez === p ? " vez" : "")), av = el("canvas"), tx = el("div", "tx");
        av.width = 18; av.height = 22; const x = av.getContext("2d"); x.imageSmoothingEnabled = false;
        x.drawImage(avatarSprite(jogadores[p] || {}, "down", 0, "stand").c, 0, 0, 18, 22, 0, 0, 18, 22);
        const pts = g["p" + lado] || 0;
        tx.append(el("strong", null, p === pid ? "Você" : nomeDe(p)), el("small", null, velha ? (lado === "a" ? "X" : "O") : pts + (pts === 1 ? " par" : " pares")));
        c.append(av, tx); placar.append(c);
      }
      const jogando = g.estado === "jogando", minha = jogando && g.vez === pid;
      status.textContent =
        g.estado === "convite" ? (g.a === pid ? "Esperando " + nO + " aceitar..." : nO + " te chamou. Aceita?") :
        jogando ? (minha ? "Sua vez." : "Vez de " + nO + "." + (on ? "" : " " + nO + " saiu; se não voltar, a vitória é sua.")) :
        g.estado === "fim" ? (g.vencedor === pid ? (g.motivo ? nO + " saiu do jogo. Vitória sua! +$" + JOGO_PREMIO : "Você ganhou! +$" + JOGO_PREMIO)
          : g.vencedor === "empate" ? "Empate! +$" + JOGO_EMPATE + " pra cada." : g.motivo && g.quem === pid ? "Você saiu do jogo." : nO + " ganhou essa.") :
        g.estado === "recusado" ? (g.a === pid ? nO + " não pode agora." : "Convite recusado.") :
        g.estado === "expirou" ? "O convite expirou." : "Convite cancelado.";
      if (velha){
        const grid = el("div", "velha"), linha = g.linha || "";
        for (let i = 0; i < 9; i++){
          const c = g.tab[i], b = btn(c === "." ? "" : c.toUpperCase(), c === "." ? "cel" : c, () => jogar(id, i));
          if (linha.includes(String(i))) b.classList.add("win");
          b.setAttribute("aria-label", "Casa " + (i + 1) + (c === "." ? ", vazia" : ", " + c.toUpperCase()));
          b.disabled = !minha || c !== "."; grid.append(b);
        }
        tab.append(grid);
      } else {
        const grid = el("div", "memo"), vir = g.viradas ? g.viradas.split(",").map(Number) : [];
        for (let i = 0; i < 12; i++){
          const dono = g.abertas[i], up = dono !== "." || vir.includes(i), b = btn(up ? "" : "?", up ? (dono !== "." ? dono : "up") : "cel", () => jogar(id, i));
          const ing = MEMO_ICONES[+g.cartas[i]];
          if (up) b.append(iconeSpr(ingSprite(ing)));
          b.setAttribute("aria-label", "Carta " + (i + 1) + (up ? ", " + INGREDIENTES[ing].nome : ", virada pra baixo"));
          b.disabled = !minha || dono !== "." || (vir.length === 1 && vir[0] === i); grid.append(b);
        }
        tab.append(grid);
      }
      if (g.estado === "convite" && g.b === pid) acoes.append(btn("Aceitar", "btn", () => aceitarJogo(id)), btn("Agora não", "btn ghost", () => desistirJogo(id)));
      else if (g.estado === "convite") acoes.append(btn("Cancelar convite", "btn ghost", () => desistirJogo(id)));
      else if (jogando){
        const d = btn("Desistir", "btn ghost"); let certo = false;
        d.onclick = () => { if (!certo){ certo = true; d.textContent = "Certeza?"; setTimeout(() => { certo = false; d.textContent = "Desistir"; }, 3000); return; } desistirJogo(id); };
        acoes.append(d, btn("Minimizar", "btn ghost", closePanel));
      } else {
        if (on && moveis[g.mov]) acoes.append(btn("Revanche", "btn", () => convidarJogo(g.mov, outro, g.tipo)));
        acoes.append(btn("Fechar", "btn ghost", closePanel));
      }
    };
    upd(); return upd;
  });
  bannerKey = null; renderBannerJogo();
}
// tabuleiro em miniatura na tela da TV ou do PC
function addJogoObjs(objs, tm){
  for (const g of Object.values(jogos)){
    if (!g || !(g.estado === "jogando" || (g.estado === "fim" && srvNow() - (g.fimAt || 0) < 20000))) continue;
    const m = moveis[g.mov]; if (!m || (m.t !== "tv" && m.t !== "pc")) continue;
    objs.push({ z: (m.y + 1) * T + 1, f: () => drawTelaJogo(g, m.t, m.x * T, m.y * T, tm) });
  }
}
function drawTelaJogo(g, t, x, y, tm){
  const tv = t === "tv", sx = tv ? x + 5 : x + 10, sy = y - 7, sw = tv ? 22 : 12, shh = tv ? 10 : 8;
  R(sx, sy, sw, shh, "#1E2440"); R(sx, sy, sw, 1, "#2E3866");
  const velha = g.tipo === "velha", bw = velha ? 8 : 11, bx = sx + Math.floor((sw - bw) / 2), by = sy + Math.floor((shh - 8) / 2);
  if (JOGO6[g.tipo]) JOGO6[g.tipo].tela(g, sx, sy, sw, shh, tm); // leva 6
  else if (velha){
    R(bx + 2, by, 1, 8, "#5A4E8A"); R(bx + 5, by, 1, 8, "#5A4E8A"); R(bx, by + 2, 8, 1, "#5A4E8A"); R(bx, by + 5, 8, 1, "#5A4E8A");
    for (let i = 0; i < 9; i++){ const c = (g.tab || "")[i]; if (c === "x" || c === "o") R(bx + (i % 3) * 3, by + Math.floor(i / 3) * 3, 2, 2, c === "x" ? "#F08A7A" : "#7FD0F5"); }
  } else {
    const vir = g.viradas ? g.viradas.split(",").map(Number) : [];
    for (let i = 0; i < 12; i++){ const d = (g.abertas || "")[i]; R(bx + (i % 4) * 3, by + Math.floor(i / 4) * 3, 2, 2, d === "a" ? "#F08A7A" : d === "b" ? "#7FD0F5" : vir.includes(i) ? "#FFFFFF" : "#8E7CF0"); }
  }
  if (tv){ pixHeart(sx + 1, sy + 1, g.vez === g.a ? "#F08A7A" : "#7FD0F5"); }
  if (g.estado === "fim" && Math.floor(tm / 300) % 2){ R(sx, sy, sw, 1, C.gold); R(sx, sy + shh - 1, sw, 1, C.gold); }
}

// ---------------- quintal (cofrinho) ----------------
const QUINTAL_PRECO = 800;
const temQuintal = () => !!cofre.liberado;
function aplicarQuintal(festa){
  montarMapa(temQuintal(), cofre.porta); rebuildOcc(); tamanhoCena();
  if (mode === "build") renderBuild();
  if (festa){ toastEspecial("Quintal liberado!", "Saiam pela porta da cozinha e aproveitem."); confete(); }
}
// porta: primeira coluna da cozinha com o chão livre logo acima da parede de baixo
function escolherPorta(){ for (const x of [13, 12, 14, 11, 10, 15, 9, 16, 8]) if (MAP[HC - 1][x] === 0 && !(occ[HC - 1] || [])[x]) return x; return 13; }
function porNoCofre(v){
  if (temQuintal()) return;
  v = Math.min(v, QUINTAL_PRECO - (cofre.total || 0)); if (v <= 0) return;
  if (!gastar(v, "o cofrinho")) return;
  let aceito = 0; const porta = noAndar(0, escolherPorta); // leva 8: a porta é do térreo, mesmo pagando lá de cima
  txn("casa/cofre", cur => {
    cur = cur || {}; aceito = 0; if (cur.liberado) return;
    const t = cur.total || 0; aceito = Math.min(v, QUINTAL_PRECO - t); if (aceito <= 0) return;
    cur.total = t + aceito; cur.por = cur.por || {}; cur.por[pid] = (cur.por[pid] || 0) + aceito;
    if (cur.total >= QUINTAL_PRECO) Object.assign(cur, { liberado: srvNow(), porta, liberouPor: pid });
    return cur;
  }).then(ok => {
    const volta = v - (ok ? aceito : 0); if (volta > 0) ganhar(volta);
    if (ok && !temQuintal()) toast("$" + aceito + " no cofrinho. Faltam $" + (QUINTAL_PRECO - (cofre.total || 0)) + ".");
    else if (!ok) toast("Não deu pra guardar agora. O dinheiro voltou.");
  });
}
function openQuintal(){
  openPanel("quintal", "Cofrinho do quintal", corpo => {
    const intro = el("p", "muted"), prog = el("div", "need"), row = el("div", "row"), lab = el("span"), val = el("span");
    row.append(lab, val); const barBox = el("div"); prog.append(row, barBox);
    const din = el("p", "money"), bts = el("div", "hbtns"), lista = el("div", "list");
    corpo.append(intro, prog, din, bts, el("h3", null, "Quem já pôs"), lista);
    const upd = () => {
      const total = cofre.total || 0, falta = QUINTAL_PRECO - total;
      intro.textContent = temQuintal() ? "Quintal liberado! A porta fica na parede de baixo da cozinha. Os móveis de área externa estão no modo Construir."
        : "Juntem $" + QUINTAL_PRECO + " e o terreno atrás da casa vira quintal: grama, cerca e espaço pra churrasqueira, rede, piscininha, balanço e mesa de piquenique. Cada um põe o quanto puder.";
      lab.textContent = temQuintal() ? "Pago" : "Guardado"; val.textContent = "$" + total + " de $" + QUINTAL_PRECO;
      barBox.textContent = ""; barBox.append(barra(Math.min(100, total / QUINTAL_PRECO * 100), "#FAC775"));
      din.textContent = me ? "Você tem $ " + Math.floor(me.dinheiro) : "";
      bts.textContent = ""; bts.hidden = temQuintal();
      for (const v of [50, 100, 200]){ if (v >= falta) continue; const b = btn("+$" + v, "btn ghost", () => porNoCofre(v)); b.disabled = !me || me.dinheiro < v; bts.append(b); }
      if (falta > 0){ const b = btn("Completar $" + falta, "btn", () => porNoCofre(falta)); b.disabled = !me || me.dinheiro < falta; bts.append(b); }
      lista.textContent = "";
      const por = Object.entries(cofre.por || {}).sort((a, b) => b[1] - a[1]);
      if (!por.length) lista.append(el("p", "muted", "Ninguém ainda. Que tal começar?"));
      for (const [p, v] of por){ const r = el("div", "rowi"); r.append(el("strong", null, p === pid ? "Você" : nomeDe(p)), el("span", "money", "$" + v)); lista.append(r); }
    };
    upd(); return upd;
  });
}
HOTSPOTS.push({ x: QUADRO.x, y: QUADRO.y, fn: () => openTrofeus() }, { x: PLACA.x, y: PLACA.y, fn: () => openQuintal(), ativo: () => !temQuintal() });

// ---------------- HUD ----------------
function renderLeva2Hud(){
  if (!me) return;
  const d = hoje(), f = minhasTarefas(d).feitas || {}, n = tarefasDoDia(d).filter(t => f[t.id]).length;
  const setTxt = (id, t) => { const b = $(id), tx = b.querySelector(".tx"); if (tx.textContent !== t){ tx.textContent = t; b.setAttribute("aria-label", t); } };
  setTxt("bTarefas", n >= 3 ? "Tarefas ✓" : "Tarefas " + n + "/3");
  setTxt("bTrofeus", "Troféus " + CONQUISTAS.filter(c => conquistas[c.id]).length + "/" + CONQUISTAS.length);
  const bq = $("bQuintal"); bq.hidden = !cofreCarregado || temQuintal();
  setTxt("bQuintal", "Quintal $" + (cofre.total || 0));
  $("bAndar").hidden = !cofre2Carregado || temAndar2();
  setTxt("bAndar", "2º andar $" + (cofre2.total || 0));
  refreshPanel("tarefas");
}
$("bTarefas").onclick = () => openTarefas();
$("bTrofeus").onclick = () => openTrofeus();
$("bQuintal").onclick = () => openQuintal();
setInterval(() => { if (!me) return; vigiarJogos(); checarConquistas(); checarDupla(); limparDiario(); }, 1000);
