"use strict";
// Casinha · v49: coisas pra fazer juntos
//  1. Presente escondido: um esconde dinheiro e um bilhete dentro de um móvel; o outro procura com "quente ou frio".
//  2. Foguinho: dias seguidos em que todos os moradores (até 2) entraram na casinha; prêmio a cada 7 dias.
//  3. Desafio da semana: uma meta pro casal (contadores de casa/stats), troca toda segunda; prêmio pra cada um.
//  4. Coleção de achadinhos: coisas raras que aparecem fazendo atividades (praia, horta, faxina, sono, leitura, passeios).
//  5. Cápsula do tempo: carta lacrada que só abre na data escolhida.
// Dados:
//   casa/escondidos/<push> = { de, para, mov, andar, onde, valor, bilhete, at, achado? }
//   casa/foguinho = { dias: { AAAA-MM-DD: { pid: true } }, seq: { n, dia, ini, rec }, premio: { <ini>_<n>: { pid: ts } } }
//   casa/desafio = { semana, i, base, meta, premio: { pid: ts } }
//   casa/colecao/<conjunto>/<i> = { por, at } · casa/colecao/_premio/<conjunto>/<pid> = ts
//   casa/capsulas/<push> = { de, para: "todos" | pid, texto, at, abre, lida: { pid: ts } }
// Ganchos: painel 💞 Nós (nosBotoes9), aba 🎮 Diversão (ITENS16.diversao), faixa do topo (bannerLeva10), menu dos móveis
//   (furnMenu/openMenu), fim das ações (acaoTerminada), selo 🔥 no cabeçalho.

let esc39 = {}, escCarregado39 = false, modo39 = null, extra39 = null;
let fogo39 = {}, fogoCarregado39 = false;
let des39 = null, desCarregado39 = false;
let col39 = {}, colCarregada39 = false, ultAtiv39 = null;
let cap39 = {}, capCarregada39 = false, capAvisadas39 = {};
const moradores39 = () => Object.entries(jogadores).filter(([, j]) => j && j.nome && !j.visita).map(([id]) => id);
const movTodos39 = id => (typeof todosMoveis === "object" && todosMoveis[id]) || moveis[id] || null;
const ontem39 = () => dataDe(srvNow() - 24 * HORA);
const dataTxt39 = ts => { const d = new Date(ts); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(); };

// =====================================================================
// 1. PRESENTE ESCONDIDO
// =====================================================================
const escPraMim39 = () => Object.entries(esc39).filter(([, e]) => e && e.para === pid && !e.achado);
const escMeus39 = () => Object.entries(esc39).filter(([, e]) => e && e.de === pid && !e.achado);
function temperatura39(e){
  const m = movTodos39(e.mov); if (!m || !me) return { ic: "❔", tx: "Sumiu?", n: 0 };
  if ((m.andar || 0) !== andarAtual) return { ic: "🧊", tx: "Tá em outro andar", n: 0 };
  const c = CAT[m.t] || { w: 1, h: 1 };
  const dx = Math.max(m.x - me.tx, 0, me.tx - (m.x + c.w - 1)), dy = Math.max(m.y - me.ty, 0, me.ty - (m.y + c.h - 1)), d = dx + dy;
  return d <= 1 ? { ic: "🔥🔥", tx: "Pelando!", n: 5 } : d <= 3 ? { ic: "🔥", tx: "Quente", n: 4 } : d <= 6 ? { ic: "🙂", tx: "Morno", n: 3 } : d <= 10 ? { ic: "🥶", tx: "Frio", n: 2 } : { ic: "🧊", tx: "Gelado", n: 1 };
}
function openEscondido39(){
  const outros = moradores39().filter(id => id !== pid), st = { para: outros.length === 1 ? outros[0] : null, valor: 10 };
  openPanel("escondido39", "Presente escondido 🔍", corpo => {
    const caca = el("div", "list"), meus = el("div", "list"), pessoas = el("div", "grid2"), valores = el("div", "hbtns");
    const ta = el("textarea"); ta.maxLength = 140; ta.placeholder = "Um bilhetinho pra quem achar"; ta.setAttribute("aria-label", "Bilhete do presente escondido");
    const ir = btn("Escolher o esconderijo 🤫", "btn", () => {
      if (!st.para){ toast("Escolha pra quem é."); return; }
      if (escMeus39().some(([, e]) => e.para === st.para)){ toast("Você já tem um presente escondido pra " + nomeDe(st.para) + " 🤫"); return; }
      if (me.dinheiro < st.valor){ toast("Faltam $" + Math.ceil(st.valor - me.dinheiro) + "."); return; }
      modo39 = { para: st.para, valor: st.valor, bilhete: ta.value.trim().slice(0, 140) };
      closePanel(); toast("Toque no móvel onde quer esconder 🤫 (pode ser em qualquer cômodo)");
    });
    corpo.append(caca, meus, el("h3", null, "Esconder um presente"), el("p", "muted", "Você esconde um dinheirinho e um bilhete dentro de um móvel. Quem for procurar vê se está quente ou frio enquanto anda pela casa."),
      el("h3", null, "Pra quem?"), pessoas, el("h3", null, "Quanto vai junto?"), valores, ta, ir);
    let sig = null;
    const upd = () => {
      const s = JSON.stringify([st, esc39, me && me.tx, me && me.ty, andarAtual]); if (s === sig) return; sig = s;
      caca.textContent = ""; meus.textContent = "";
      for (const [, e] of escPraMim39()){
        const t = temperatura39(e), row = el("div", "rowi"), tx = el("div", "tx");
        tx.append(el("strong", null, "🔍 " + nomeDe(e.de) + " escondeu um presente pra você!"), el("small", null, t.ic + " " + t.tx + " · toque nos móveis e escolha Procurar aqui"));
        row.append(tx); caca.append(row);
      }
      for (const [id, e] of escMeus39()){
        const row = el("div", "rowi"), tx = el("div", "tx");
        tx.append(el("strong", null, "🤫 No(a) " + String(e.onde || "móvel").toLowerCase() + " pra " + nomeDe(e.para)), el("small", null, (e.valor ? "$" + e.valor + " e bilhete" : "Só o bilhete") + " · ainda não achou"));
        row.append(tx, btn("Pegar de volta", "btn ghost small", () => desistir39(id))); meus.append(row);
      }
      pessoas.textContent = "";
      if (!outros.length) pessoas.append(el("p", "muted", "Chame alguém pra casa pelo botão Convidar 💌"));
      for (const id of outros){ const b = btn("", "btn ghost escolha", () => { st.para = id; upd(); }); b.append(el("strong", null, nomeDe(id)), el("small", null, jogadores[id].online ? "Na casa agora" : "Vai ver quando entrar")); b.setAttribute("aria-pressed", String(st.para === id)); pessoas.append(b); }
      valores.textContent = "";
      for (const v of [0, 10, 25, 50]){ const b = btn(v ? "$" + v : "Só bilhete", "btn ghost small", () => { st.valor = v; upd(); }); b.setAttribute("aria-pressed", String(st.valor === v)); valores.append(b); }
      ir.disabled = !st.para || !me || me.dinheiro < st.valor;
    };
    upd(); return upd;
  });
}
function esconderEm39(id){
  const m = moveis[id], st = modo39; if (!m || !st || !me) return;
  goTo(null, adjTo(m), () => {
    faceTo(m.x, m.y);
    startAcao({ id: "esconder", nome: "Escondendo… 🤫", dur: 1.6, ganho: {}, fim: () => {
      const mm = moveis[id]; if (!mm || modo39 !== st) return;
      if (st.valor && !gastar(st.valor, "o presente escondido")) return;
      modo39 = null;
      ref("casa/escondidos").push({ de: pid, para: st.para, mov: id, andar: andarAtual, onde: CAT[mm.t].nome, valor: st.valor, bilhete: st.bilhete, at: TS() }).then(() => {
        sfx("papel"); toast("Escondido! 🤫 Agora é com " + nomeDe(st.para) + (st.valor ? " (-$" + st.valor + ")" : ""));
      }, () => { ganhar(st.valor); toast("Não deu pra esconder agora."); });
    } });
  });
}
function procurar39(id){
  const m = moveis[id]; if (!m || !me) return;
  goTo(null, adjTo(m), () => { faceTo(m.x, m.y); startAcao({ id: "procurar", nome: "Procurando… 🔍", dur: 1.8, ganho: {}, fim: () => conferir39(id) }); });
}
function conferir39(id){
  const achou = escPraMim39().find(([, e]) => e.mov === id);
  if (!achou){ const e = escPraMim39()[0]; toast("Não tá aqui… " + (e ? temperatura39(e[1]).ic + " " + temperatura39(e[1]).tx : "")); return; }
  const [eid, e] = achou;
  txn("casa/escondidos/" + eid, cur => cur && cur.para === pid && !cur.achado ? Object.assign(cur, { achado: srvNow() }) : undefined).then(ok => {
    if (!ok) return;
    if (e.valor) ganhar(e.valor);
    ganharNeeds({ diversao: 25, social: 15 }); xpCasal(10); statMais("achados"); confete();
    const m = moveis[id]; if (m) burst(m.x, m.y - .3, "heart");
    toastEspecial("Achou! 🔍🎁", (e.valor ? "+$" + e.valor + ". " : "") + "Estava no(a) " + String(e.onde || "móvel").toLowerCase());
    historia("esc_" + eid, "🔍", nomeEu9() + " achou o presente que " + nomeDe(e.de) + " escondeu no(a) " + String(e.onde || "móvel").toLowerCase());
    setTimeout(() => verBilhete39(eid), 1300);
  });
}
function verBilhete39(eid){
  const e = esc39[eid]; if (!e) return;
  openPanel("bilhete39", "🔍 Presente de " + nomeDe(e.de), corpo => {
    corpo.append(el("p", "muted", (e.valor ? "$" + e.valor + " · " : "") + "escondido no(a) " + String(e.onde || "móvel").toLowerCase()),
      el("div", "bilhete9", e.bilhete ? String(e.bilhete).slice(0, 140) : "(sem bilhete, mas escondido com carinho)"), btn("Fechar", "btn", closePanel));
  });
}
function desistir39(id){
  txn("casa/escondidos/" + id, cur => cur && cur.de === pid && !cur.achado ? null : undefined).then(ok => {
    if (!ok){ toast("Esse já foi achado 🔍"); return; }
    const e = esc39[id]; ganhar((e && e.valor) || 0); toast("Presente tirado do esconderijo.");
  });
}
function aoMudarEsc39(novo){
  const ant = esc39; esc39 = novo;
  if (escCarregado39 && me) for (const [id, e] of Object.entries(novo)){
    if (!e) continue; const a = ant[id];
    if (!a && e.para === pid && !e.achado){ toast("🔍 " + nomeDe(e.de) + " escondeu um presente pra você em algum móvel da casa!"); sfx("notif"); avisar("presente", nomeDe(e.de) + " escondeu um presente pra você 🔍"); }
    if (a && !a.achado && e.achado && e.de === pid) toast(nomeDe(e.para) + " achou seu presente escondido no(a) " + String(e.onde || "móvel").toLowerCase() + "! 🔍💞");
  }
  escCarregado39 = true; bannerKey = null; refreshPanel("escondido39");
}
function vigiarEsc39(){
  if (!me || !escCarregado39 || !moveisCarregados) return;
  const velho = srvNow() - 30 * 24 * HORA;
  for (const [id, e] of Object.entries(esc39)){
    if (!e) continue;
    if (e.achado && e.achado < velho && (e.de === pid || e.para === pid)) ref("casa/escondidos/" + id).remove().catch(() => {});
    if (!e.achado && e.de === pid && !todosMoveis[e.mov]) txn("casa/escondidos/" + id, cur => cur && !cur.achado ? null : undefined).then(ok => { if (ok){ ganhar(e.valor || 0); toast("O móvel do esconderijo saiu da casa: o presente voltou pra você 🤫"); } });
  }
}
// menu dos móveis: escolher o esconderijo / procurar aqui
{ const f0 = openMenu; openMenu = function(p, titulo, items){ if (extra39){ const x = extra39; extra39 = null; items = x.concat(items); } return f0(p, titulo, items); }; }
{ const f0 = furnMenu; furnMenu = function(id, p){
  const m = moveis[id];
  if (!m || visitando) return f0(id, p);
  const nome = (CAT[m.t] || {}).nome || "Móvel";
  if (modo39) return openMenu(p, nome, [{ nome: "Esconder aqui 🤫", info: modo39.valor ? "$" + modo39.valor + " e bilhete" : "Só o bilhete", fn: () => esconderEm39(id) },
    { nome: "Escolher outro móvel", fn: () => toast("Toque em outro móvel 🤫") }, { nome: "Desistir de esconder", fn: () => { modo39 = null; toast("Tudo bem, fica pra depois 🤫"); } }]);
  const caca = escPraMim39();
  if (!caca.length) return f0(id, p);
  const it = { nome: "Procurar aqui 🔍", info: temperatura39(caca[0][1]).ic + " " + temperatura39(caca[0][1]).tx, fn: () => procurar39(id) };
  extra39 = [it]; f0(id, p);
  if (extra39){ extra39 = null; $("toast").hidden = true; openMenu(p, nome, [it]); } // móvel só de decoração (o original não abre menu)
}; }

// =====================================================================
// 2. FOGUINHO
// =====================================================================
function fogoN39(){ const s = fogo39.seq; if (!s) return 0; return s.dia === hoje() || s.dia === ontem39() ? (s.n || 0) : 0; }
function fogoHoje39(){ const d = (fogo39.dias || {})[hoje()] || {}; return moradores39().filter(id => d[id] || id === pid); }
function vigiarFogo39(){
  if (!me || !fogoCarregado39 || visitando || !salaRef) return;
  const h = hoje(), dias = fogo39.dias || {}, hojeD = dias[h] || {}, mor = moradores39();
  if (!hojeD[pid]) ref("casa/foguinho/dias/" + h + "/" + pid).set(true).catch(() => {});
  const need = Math.min(2, mor.length), n = fogoHoje39().length, s = fogo39.seq || {};
  if (n >= need && s.dia !== h){
    const on = ontem39();
    txn("casa/foguinho/seq", cur => { cur = cur || {}; if (cur.dia === h) return; const nn = cur.dia === on ? (cur.n || 0) + 1 : 1; return { n: nn, dia: h, ini: nn === 1 ? h : (cur.ini || h), rec: Math.max(cur.rec || 0, nn) }; })
      .then(ok => { if (ok && need > 1 && umaVezDia39("fogo-ok")) toast("🔥 Foguinho aceso hoje: " + fogoN39() + (fogoN39() === 1 ? " dia" : " dias seguidos") + "!"); });
  } else if (n < need && umaVezDia39("fogo-falta")){
    const falta = mor.filter(id => !hojeD[id] && id !== pid).map(nomeDe);
    const atual = s.dia === on39() ? (s.n || 0) : 0;
    if (falta.length && atual) setTimeout(() => toast("🔥 Foguinho em " + atual + (atual === 1 ? " dia" : " dias") + ". Falta " + falta.join(" e ") + " entrar hoje pra não apagar!"), 7000);
  }
  const cur = fogoN39();
  if (cur && cur % 7 === 0 && s.dia === h){
    txn("casa/foguinho/premio/" + (s.ini || "x") + "_" + cur + "/" + pid, c => c ? undefined : srvNow()).then(ok => {
      if (!ok) return; const v = Math.min(200, 30 + cur * 5); ganhar(v); xpCasal(10); confete();
      toastEspecial("🔥 " + cur + " dias seguidos!", "+$" + v + " pelo foguinho de vocês");
      if ([7, 30, 100, 365].includes(cur)) historia("fogo_" + (s.ini || "x") + "_" + cur, "🔥", cur + " dias seguidos jogando juntos");
    });
  }
  const corte = dataDe(srvNow() - 10 * 24 * HORA);
  for (const k of Object.keys(dias)) if (k < corte) ref("casa/foguinho/dias/" + k).remove().catch(() => {});
  renderFogo39();
}
const on39 = () => ontem39();
function umaVezDia39(k){ const kk = "casinha-39-" + sala + "-" + k + "-" + hoje(); if (store.get(kk)) return false; store.set(kk, "1"); return true; }
let fogoEl39 = null;
function renderFogo39(){
  if (!fogoEl39){ const c = $("clima"); if (!c) return; fogoEl39 = btn("", "clima fogo39", () => openFoguinho39()); fogoEl39.type = "button"; c.after(fogoEl39); }
  const n = fogoN39(), t = "🔥 " + n;
  fogoEl39.hidden = visitando || !fogoCarregado39;
  if (fogoEl39.textContent !== t){ fogoEl39.textContent = t; fogoEl39.setAttribute("aria-label", "Foguinho: " + n + (n === 1 ? " dia seguido" : " dias seguidos")); }
  fogoEl39.classList.toggle("apagado39", !n);
}
function openFoguinho39(){
  openPanel("fogo39", "Foguinho 🔥", corpo => {
    const box = el("div"); corpo.append(box);
    const upd = () => {
      box.textContent = "";
      const n = fogoN39(), s = fogo39.seq || {}, mor = moradores39(), d = (fogo39.dias || {})[hoje()] || {};
      box.append(el("p", "pct", "🔥 " + n), el("p", null, n ? n + (n === 1 ? " dia seguido" : " dias seguidos") + " em que " + (mor.length > 1 ? "vocês dois entraram" : "você entrou") + " na casinha." : "O foguinho está apagado. Entrem os dois hoje pra acender!"),
        el("p", "muted", "Recorde: " + (s.rec || 0) + (s.rec === 1 ? " dia" : " dias") + ". A cada 7 dias seguidos tem prêmio em dinheiro pra cada um."));
      const l = el("div", "list");
      for (const id of mor){ const ok = d[id] || id === pid, row = el("div", "rowi" + (ok ? " feita" : "")), tx = el("div", "tx"); tx.append(el("strong", null, (ok ? "✅ " : "⏳ ") + (id === pid ? "Você" : nomeDe(id))), el("small", null, ok ? "Já entrou hoje" : "Ainda não entrou hoje")); row.append(tx); l.append(row); }
      box.append(el("h3", null, "Hoje"), l);
    };
    upd(); return upd;
  });
}

// =====================================================================
// 3. DESAFIO DA SEMANA
// =====================================================================
const DESAFIOS39 = [
  { st: "dancas", meta: 3, txt: "Dançar juntos 3 vezes", ic: "💃" },
  { st: "beijos", meta: 10, txt: "Dar 10 beijinhos", ic: "😘" },
  { st: "abracos", meta: 8, txt: "Dar 8 abraços", ic: "🤗" },
  { st: "filmes", meta: 2, txt: "Ver 2 filmes no sofá", ic: "🎬", ok: () => temMovel("tv") },
  { st: "jantares", meta: 1, txt: "Ter um jantar à luz de velas", ic: "🕯️", ok: () => temMovel("mesa") },
  { st: "fotos", meta: 5, txt: "Tirar 5 fotos pro álbum", ic: "📸" },
  { st: "pratosJuntos", meta: 3, txt: "Cozinhar 3 pratos juntos", ic: "🍳", ok: () => temMovel("fogao") },
  { st: "limpezas", meta: 15, txt: "Limpar 15 sujeiras", ic: "🧹" },
  { st: "colheitas", meta: 5, txt: "Colher 5 vezes na horta", ic: "🥕", ok: () => temMovel("canteiro", "horta") },
  { st: "carinhos", meta: 15, txt: "Fazer 15 carinhos no bichinho", ic: "🐾", ok: () => Object.keys(pets || {}).length > 0 },
  { st: "partidas", meta: 4, txt: "Jogar 4 partidas juntos", ic: "🎮", ok: () => temMovel("tv", "pc") },
  { st: "passeios", meta: 1, txt: "Fazer um passeio de carro", ic: "🚗", ok: () => !!carroPos() },
  { st: "presentes", meta: 2, txt: "Abrir 2 presentes", ic: "🎁" },
  { st: "achados", meta: 1, txt: "Achar um presente escondido", ic: "🔍" }
];
const DES_PREMIO39 = 80;
function desAtual39(){ const d = des39; if (!d || d.semana !== semanaInfo().num) return null; const x = DESAFIOS39[d.i]; if (!x) return null; return { d, x, prog: Math.min(d.meta, Math.max(0, (+stats[x.st] || 0) - (d.base || 0))) }; }
function vigiarDesafio39(){
  if (!me || !statsCarregados || !desCarregado39 || visitando || !moveisCarregados) return;
  const sem = semanaInfo().num, d = des39;
  if (!d || d.semana !== sem){
    const disp = DESAFIOS39.map((x, i) => [x, i]).filter(([x]) => { try { return !x.ok || x.ok(); } catch (e){ return false; } });
    const [x, i] = disp[hash(sem, salaSeed, 39) % disp.length];
    txn("casa/desafio", cur => cur && cur.semana === sem ? undefined : { semana: sem, i, base: +stats[x.st] || 0, meta: x.meta });
    return;
  }
  const a = desAtual39(); if (!a) return;
  if (a.prog >= a.d.meta && !(a.d.premio && a.d.premio[pid])) txn("casa/desafio/premio/" + pid, c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return; ganhar(DES_PREMIO39); xpCasal(20); confete();
    toastEspecial("🎯 Desafio da semana completo!", a.x.txt + " · +$" + DES_PREMIO39);
    historia("desafio_" + sem, "🎯", "Desafio da semana: " + a.x.txt.charAt(0).toLowerCase() + a.x.txt.slice(1));
  });
}
function openDesafio39(){
  openPanel("desafio39", "Desafio da semana 🎯", corpo => {
    const box = el("div"); corpo.append(box);
    const upd = () => {
      box.textContent = ""; const a = desAtual39();
      if (!a){ box.append(el("p", "muted", "Sorteando o desafio desta semana…")); return; }
      const dias = Math.max(0, Math.ceil((semanaInfo().fim - srvNow()) / (24 * HORA))), feito = a.prog >= a.d.meta;
      box.append(el("p", "pct", a.x.ic + " " + a.prog + "/" + a.d.meta), el("p", null, a.x.txt + (feito ? " ✅" : "")),
        el("p", "muted", feito ? "Completo! Cada um ganhou $" + DES_PREMIO39 + ". Segunda tem desafio novo." : "Vale o que os dois fizerem juntos na casa. Prêmio: $" + DES_PREMIO39 + " pra cada um. " + (dias <= 1 ? "Último dia!" : "Faltam " + dias + " dias.")));
    };
    upd(); return upd;
  });
}

// =====================================================================
// 4. COLEÇÃO DE ACHADINHOS
// =====================================================================
const COLECOES39 = {
  conchas: { nome: "Conchas da praia", ic: "🐚", onde: "Nas brincadeiras do passeio à praia", chance: .45, itens: [["Concha rosa", "🐚"], ["Estrela-do-mar", "⭐"], ["Caranguejinho", "🦀"], ["Búzio", "🐌"], ["Pérola", "🦪"]] },
  postais: { nome: "Cartões-postais", ic: "🖼️", onde: "Um em cada lugar do passeio de carro", itens: [["Praia", "🏖️"], ["Cachoeira", "💦"], ["Cidade à noite", "🌃"], ["Campo de girassóis", "🌻"], ["Parque de diversões", "🎡"]], fixo: ["praia", "cachoeira", "cidade", "girassois", "parque"] },
  flores: { nome: "Flores raras", ic: "🌸", onde: "Cuidando da horta e do jardim", chance: .12, re: /^(regar|colher|plantar|podar)$/, itens: [["Orquídea", "🌺"], ["Tulipa", "🌷"], ["Girassol gigante", "🌻"], ["Flor de cerejeira", "🌸"], ["Rosa azul", "🌹"]] },
  achados: { nome: "Achados da faxina", ic: "🪙", onde: "Limpando a casa", chance: .1, re: /^limpar$/, itens: [["Moeda antiga", "🪙"], ["Chave misteriosa", "🗝️"], ["Bilhete esquecido", "📝"], ["Anel de lata", "💍"], ["Brinco de brilhante", "💎"]] },
  sonhos: { nome: "Sonhos", ic: "🌙", onde: "Dormindo ou tirando um cochilo", chance: .3, re: /^(dormir|cochilo)$/, itens: [["Voando sobre a cidade", "☁️"], ["Casa de doces", "🍭"], ["Fundo do mar", "🐠"], ["Dançando na chuva", "☔"], ["Viagem pra lua", "🌙"]] },
  livros: { nome: "Marcadores de livro", ic: "🔖", onde: "Lendo livros", chance: .15, re: /^ler$/, itens: [["Marcador de gatinho", "🐱"], ["Marcador de folha", "🍃"], ["Marcador de coração", "💗"], ["Marcador de estrela", "⭐"], ["Marcador dourado", "✨"]] }
};
const COL_PREMIO39 = 60;
const temItem39 = (c, i) => !!(col39[c] && col39[c][i]);
const nCol39 = c => COLECOES39[c].itens.filter((_, i) => temItem39(c, i)).length;
function sortear39(c){ // o último de cada coleção é o raro (peso 1, os outros 3)
  const n = COLECOES39[c].itens.length, pesos = COLECOES39[c].itens.map((_, i) => i === n - 1 ? 1 : 3), tot = pesos.reduce((s, v) => s + v, 0);
  let r = Math.random() * tot; for (let i = 0; i < n; i++){ r -= pesos[i]; if (r < 0) return i; } return 0;
}
function achar39(c, i, msgAntes){
  const def = COLECOES39[c], [nome, ic] = def.itens[i];
  txn("casa/colecao/" + c + "/" + i, cur => cur ? undefined : { por: pid, at: srvNow() }).then(ok => {
    if (!ok){ ganhar(3); toast((msgAntes || "") + ic + " " + nome + " de novo (vocês já tinham) +$3"); return; }
    sfx("acerto", .7); const n = nCol39(c) + (temItem39(c, i) ? 0 : 1);
    toast((msgAntes || "Achadinho! ") + ic + " " + nome + " · " + def.nome + " " + Math.min(n, def.itens.length) + "/" + def.itens.length);
  });
}
function rolarAcao39(a){
  if (!me || visitando || !colCarregada39) return;
  for (const [c, def] of Object.entries(COLECOES39)){
    if (!def.re || !def.re.test(a.id) || Math.random() >= def.chance) continue;
    achar39(c, sortear39(c), c === "sonhos" ? "Sonhou com: " : "Achadinho! "); break;
  }
}
function vigiarPasseio39(){
  if (!me || !colCarregada39 || typeof passeio === "undefined" || !passeio) return;
  const a = passeio.ativ && passeio.ativ[pid]; if (!a || !a.at) return;
  if (ultAtiv39 === null){ ultAtiv39 = a.at; return; } // o que já estava lá quando abri não conta
  if (a.at === ultAtiv39) return; ultAtiv39 = a.at;
  const dest = passeio.destino, ip = COLECOES39.postais.fixo.indexOf(dest);
  if (ip >= 0 && !temItem39("postais", ip)) achar39("postais", ip, "Cartão-postal! ");
  else if (dest === "praia" && Math.random() < COLECOES39.conchas.chance) achar39("conchas", sortear39("conchas"), "Achou na areia: ");
}
function vigiarColecao39(){
  if (!me || !colCarregada39 || visitando) return;
  for (const [c, def] of Object.entries(COLECOES39)){
    if (nCol39(c) < def.itens.length) continue;
    if (((col39._premio || {})[c] || {})[pid]) continue;
    txn("casa/colecao/_premio/" + c + "/" + pid, v => v ? undefined : srvNow()).then(ok => {
      if (!ok) return; ganhar(COL_PREMIO39); xpCasal(15); confete();
      toastEspecial(def.ic + " Coleção completa!", def.nome + " · +$" + COL_PREMIO39);
      historia("col_" + c, def.ic, "Completaram a coleção: " + def.nome.toLowerCase());
    });
  }
}
function openColecao39(){
  openPanel("colecao39", "Coleção de achadinhos 🧺", corpo => {
    const box = el("div"); corpo.append(el("p", "muted", "Coisinhas raras aparecem enquanto vocês fazem as coisas da casa e passeiam. Completar uma coleção dá $" + COL_PREMIO39 + " pra cada um."), box);
    let sig = null;
    const upd = () => {
      const s = JSON.stringify(col39); if (s === sig) return; sig = s; box.textContent = "";
      for (const [c, def] of Object.entries(COLECOES39)){
        const n = nCol39(c), g = el("div", "col39");
        box.append(el("h3", null, def.ic + " " + def.nome + " · " + n + "/" + def.itens.length + (n === def.itens.length ? " ✅" : "")), el("p", "muted", def.onde));
        def.itens.forEach(([nome, ic], i) => {
          const tem = temItem39(c, i), v = tem ? col39[c][i] : null, cel = el("div", "cel39" + (tem ? "" : " falta39"));
          cel.append(el("span", "ic39", tem ? ic : "❔"), el("strong", null, tem ? nome : "???"), el("small", null, tem ? (v.por === pid ? "Você achou" : nomeDe(v.por) + " achou") : i === def.itens.length - 1 ? "Raro ✨" : ""));
          g.append(cel);
        });
        box.append(g);
      }
    };
    upd(); return upd;
  });
}
{ const f0 = acaoTerminada; acaoTerminada = function(a){ f0(a); try { rolarAcao39(a); } catch (e){ console.error(e); } }; }

// =====================================================================
// 5. CÁPSULA DO TEMPO
// =====================================================================
const capPraMim39 = () => Object.entries(cap39).filter(([, c]) => c && (c.para === "todos" || c.para === pid || c.de === pid));
const capAberta39 = c => srvNow() >= (c.abre || 0);
function openCapsulas39(anoNovo){
  const outros = moradores39().filter(id => id !== pid), d0 = new Date(srvNow());
  const QUANDO = [["1 mês", () => new Date(d0.getFullYear(), d0.getMonth() + 1, d0.getDate(), 9).getTime()], ["6 meses", () => new Date(d0.getFullYear(), d0.getMonth() + 6, d0.getDate(), 9).getTime()],
    ["1 ano", () => new Date(d0.getFullYear() + 1, d0.getMonth(), d0.getDate(), 9).getTime()], ["No próximo Ano Novo", () => new Date(d0.getFullYear() + 1, 0, 1, 0, 0).getTime()]];
  const st = { para: outros.length ? "todos" : pid, q: anoNovo ? 2 : 0 };
  openPanel("capsulas39", "Cápsula do tempo ⏳", corpo => {
    const lista = el("div", "list"), pessoas = el("div", "hbtns"), quando = el("div", "hbtns");
    const ta = el("textarea"); ta.maxLength = 600; ta.rows = 5; ta.placeholder = anoNovo ? "O que vocês querem lembrar de " + (d0.getFullYear() - (d0.getMonth() === 0 && d0.getDate() === 1 ? 1 : 0)) + "? E o que esperam do ano que vem?" : "Escreva pro futuro: como está a vida agora, o que vocês sonham, um recado…";
    ta.setAttribute("aria-label", "Texto da cápsula do tempo");
    const cont = el("small", "muted", "0/600"); ta.addEventListener("input", () => cont.textContent = ta.value.length + "/600");
    const lacrar = btn("Lacrar a cápsula ⏳", "btn", () => {
      const tx = ta.value.trim(); if (tx.length < 3){ toast("Escreva alguma coisa pro futuro 💌"); return; }
      const abre = QUANDO[st.q][1]();
      ref("casa/capsulas").push({ de: pid, para: st.para, texto: tx.slice(0, 600), at: TS(), abre }).then(() => {
        closePanel(); sfx("papel"); toast("Cápsula lacrada ⏳ Abre em " + dataTxt39(abre)); xpCasal(5);
        historia("cap_" + abre + "_" + pid, "⏳", nomeEu9() + " lacrou uma cápsula do tempo pra abrir em " + dataTxt39(abre));
      }, () => toast("Não deu pra lacrar agora."));
    });
    corpo.append(lista, el("h3", null, "Escrever uma cápsula"), el("p", "muted", "Fica lacrada: ninguém lê antes do dia. Quando chegar a hora, o jogo avisa."),
      el("h3", null, "Pra quem?"), pessoas, el("h3", null, "Abrir daqui a…"), quando, ta, cont, lacrar);
    let sig = null;
    const upd = () => {
      const s = JSON.stringify([st, cap39, Math.floor(srvNow() / 60000)]); if (s === sig) return; sig = s;
      lista.textContent = "";
      const minhas = capPraMim39().sort((a, b) => (a[1].abre || 0) - (b[1].abre || 0));
      for (const [id, c] of minhas){
        const row = el("div", "rowi"), tx = el("div", "tx"), aberta = capAberta39(c);
        const quem = c.de === pid ? "Você" : nomeDe(c.de), pra = c.para === "todos" ? "pros dois" : c.para === pid ? (c.de === pid ? "pra você mesmo" : "pra você") : "pra " + nomeDe(c.para);
        if (aberta){ tx.append(el("strong", null, "💌 " + quem + " escreveu " + pra), el("small", null, "Lacrada em " + dataTxt39(c.at || 0) + " · aberta em " + dataTxt39(c.abre))); row.append(tx, btn("Ler", "btn small", () => lerCap39(id))); }
        else {
          const dias = Math.ceil((c.abre - srvNow()) / (24 * HORA));
          tx.append(el("strong", null, "🔒 " + quem + " escreveu " + pra), el("small", null, "Abre em " + dataTxt39(c.abre) + " · " + (dias <= 1 ? "falta 1 dia" : "faltam " + dias + " dias")));
          row.append(tx); if (c.de === pid) row.append(btn("Desistir", "btn ghost small", () => { if (confirm("Desistir desta cápsula? O texto é apagado.")) ref("casa/capsulas/" + id).remove().catch(() => {}); }));
        }
        lista.append(row);
      }
      pessoas.textContent = "";
      const ops = (outros.length ? [["todos", "Nós dois"]] : []).concat(outros.map(id => [id, nomeDe(id)]), [[pid, "Eu mesmo"]]);
      for (const [v, n] of ops){ const b = btn(n, "btn ghost small", () => { st.para = v; upd(); }); b.setAttribute("aria-pressed", String(st.para === v)); pessoas.append(b); }
      quando.textContent = "";
      QUANDO.forEach(([n], i) => { const b = btn(n, "btn ghost small", () => { st.q = i; upd(); }); b.setAttribute("aria-pressed", String(st.q === i)); quando.append(b); });
    };
    upd(); return upd;
  });
}
function lerCap39(id){
  const c = cap39[id]; if (!c || !capAberta39(c)) return;
  if (!(c.lida && c.lida[pid])) ref("casa/capsulas/" + id + "/lida/" + pid).set(srvNow()).catch(() => {});
  openPanel("capsula39", "💌 Cápsula do tempo", corpo => {
    corpo.append(el("p", "muted", (c.de === pid ? "Você" : nomeDe(c.de)) + " escreveu em " + dataTxt39(c.at || 0) + " pra abrir em " + dataTxt39(c.abre)),
      el("div", "bilhete9 cap39", String(c.texto || "")), btn("Fechar", "btn", closePanel));
  });
}
const capNovas39 = () => capPraMim39().filter(([, c]) => capAberta39(c) && !(c.lida && c.lida[pid]));
function vigiarCap39(){
  if (!me || !capCarregada39 || visitando) return;
  for (const [id, c] of capNovas39()){ if (capAvisadas39[id]) continue; capAvisadas39[id] = 1; toast("💌 Uma cápsula do tempo abriu! " + (c.de === pid ? "A sua" : "A de " + nomeDe(c.de)) + ", de " + dataTxt39(c.at || 0)); sfx("notif"); bannerKey = null; }
}

// =====================================================================
// GANCHOS: Nós, Diversão, faixa do topo, ouvintes, laço
// =====================================================================
{ const f0 = nosBotoes9; nosBotoes9 = function(){
  const g = f0(); if (visitando) return g;
  const mk = (ic, tx, sub, fn, n) => { const b = btn("", "btn ghost escolha" + (n ? " comDot16" : ""), () => { closePanel(); fn(); }); b.append(el("strong", null, ic + " " + tx), el("small", null, sub)); if (n) b.append(el("span", "dot", String(n))); b.setAttribute("aria-label", tx + ": " + sub); return b; };
  const caca = escPraMim39().length, nc = capNovas39().length, fogo = fogoN39(), tot = Object.values(COLECOES39).reduce((s, d) => s + d.itens.length, 0), ach = Object.keys(COLECOES39).reduce((s, c) => s + nCol39(c), 0);
  g.append(mk("🔍", "Presente escondido", caca ? "Tem um pra você achar!" : "Esconder um mimo num móvel", openEscondido39, caca),
    mk("⏳", "Cápsula do tempo", nc ? "Uma cápsula abriu!" : "Cartas pro futuro", () => openCapsulas39(false), nc),
    mk("🧺", "Coleção", ach + "/" + tot + " achadinhos", openColecao39),
    mk("🔥", "Foguinho", fogo ? fogo + (fogo === 1 ? " dia seguido" : " dias seguidos") : "Entrem os dois hoje", openFoguinho39));
  return g;
}; }
{ const f0 = ITENS16.diversao; ITENS16.diversao = function(){
  const l = f0(); if (visitando) return l;
  const a = desAtual39();
  l.unshift({ ic: a ? a.x.ic : "🎯", t: "Desafio da semana", sub: a ? a.x.txt + " · " + a.prog + "/" + a.d.meta + (a.prog >= a.d.meta ? " ✅" : "") : "Sorteando…", fn: openDesafio39 });
  return l;
}; }
function bannerJuntos39(){
  if (!me || visitando) return null;
  const nc = capNovas39();
  if (nc.length){ const [id, c] = nc[0]; return { key: "x39c" + id, partes: () => [el("span", null, "💌 A cápsula do tempo " + (c.de === pid ? "que você escreveu" : "de " + nomeDe(c.de)) + " abriu!"), btn("Ler", "btn small", () => { lerCap39(id); bannerKey = null; })] }; }
  if (modo39) return { key: "x39m", partes: () => [el("span", null, "🤫 Toque no móvel onde quer esconder o presente"), btn("Desistir", "btn ghost small", () => { modo39 = null; bannerKey = null; renderBannerJogo(); })] };
  const caca = escPraMim39();
  if (caca.length){ const [, e] = caca[0], t = temperatura39(e); return { key: "x39e" + t.n + e.at, partes: () => [el("span", null, "🔍 " + nomeDe(e.de) + " escondeu um presente pra você! " + t.ic + " " + t.tx)] }; }
  return null;
}
{ const f0 = bannerLeva10; bannerLeva10 = function(){ return f0() || bannerJuntos39(); }; }
let ouvindo39 = null;
function ouvir39(){
  if (!salaRef || ouvindo39 === salaRef) return; ouvindo39 = salaRef;
  esc39 = {}; escCarregado39 = false; fogo39 = {}; fogoCarregado39 = false; des39 = null; desCarregado39 = false; col39 = {}; colCarregada39 = false; ultAtiv39 = null; cap39 = {}; capCarregada39 = false; capAvisadas39 = {}; modo39 = null;
  on(ref("casa/escondidos"), "value", s => aoMudarEsc39(s.val() || {}));
  on(ref("casa/foguinho"), "value", s => { fogo39 = s.val() || {}; fogoCarregado39 = true; renderFogo39(); refreshPanel("fogo39"); });
  on(ref("casa/desafio"), "value", s => { des39 = s.val(); desCarregado39 = true; refreshPanel("desafio39"); });
  on(ref("casa/colecao"), "value", s => { col39 = s.val() || {}; colCarregada39 = true; refreshPanel("colecao39"); });
  on(ref("casa/capsulas"), "value", s => { cap39 = s.val() || {}; capCarregada39 = true; refreshPanel("capsulas39"); bannerKey = null; });
}
setInterval(() => {
  if (!me || !salaRef) return;
  try { ouvir39(); vigiarFogo39(); vigiarEsc39(); vigiarDesafio39(); vigiarPasseio39(); vigiarColecao39(); vigiarCap39(); if (painel && painel.id === "escondido39") refreshPanel("escondido39"); } catch (e){ console.error(e); }
}, 1000);
