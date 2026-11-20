"use strict";
// Casinha · leva 10: perto mesmo de longe (modo saudade, recado de voz, avisos, passeio de carro, bairro e visitas)
// Carregado ANTES do 18-laco.js (o laço chama leva10Update, addLeva10Objs, leva10Esconde, drawLabels10 e drawViagem).
// =====================================================================
// LEVA 10
//   casa/saudade/<pid> = { lugar (id do móvel; ausente = automático), log: { <push>: { de, nome, tipo: abraco|beijo|recado, texto?, at } } }
//      quem está fora vira pelúcia no "lugar"; quem está em casa abraça, manda beijo e deixa recado; o dono lê o log quando volta (e apaga)
//   casa/reencontro/<pidA>_<pidB> = ts   última vez que os dois estavam online juntos (pids em ordem): "Fazia X horas que vocês não se viam"
//   casa/vozMeta/<push> = { de, nome, para (pid | "todos"), at, dur (ms), mime, ouvido: { pid: ts } }
//   casa/vozAudio/<mesmo id> = "data:audio/...;base64,..."   o áudio fica separado e só é baixado quando alguém toca (como o álbum)
//   casa/passeio = { por, estado: convite|viajando|fim|cancelado, criado, vai: {pid: true}, conv: {pid: true (esperando) | false (recusou)},
//                    ini, destino, foram: {destino: true}, ativ: {pid: {id, at}}, fimAt, contado }
//   casa/nome = nome da casa · casa/vizinhos/<codigo> = { nome, adicionado, por }   (listar salas é proibido: o bairro é uma lista de casas conhecidas)
//   jogadores/<pid>.visita = código da casa de onde a visita veio (o nó some quando ela sai; visita não é moradora)
//   casa/historia/visita10_<pid>_<dia>, passeio_<ini> · casa/stats/saudades, passeios · casa/leva10 = ts (migração: telefone na sala)
//   localStorage: casinha-avisos (tipos), casinha-avisos-on, casinha-vpid-<sala> (quem sou na casa visitada), casinha-visita-eu (visual levado)
//   Endereço da visita: #<codigo da casa>?visita=<codigo da minha casa>
//   Teste: L10 (estado e atalhos: L10.reencontroMin, L10.notifs, L10.psAvancar(s))
// =====================================================================
let saudade = {}, sdCarregada = false, sdVis = [], sdMostrando = false;
let reencontro = {}, reCarregado = false;
const reVisto = {};
let vozMeta = {}, vozCarregada = false;
const vozSrc = new Map(), vozPend = new Map();
let passeio = null, psCarregado = false, psPartindo = 0, psFeito = null, psSemNinguem = 0, psUltSig = "";
const psAtivFeito = new Set();
let vizinhos = {}, nomeCasa = "", nomeCarregado = false;
let visitaDe = null, visitando = false, visitaChecada = null, visitaEntrando = false;
let leva10Tentou = false, jog10Pronto = false, carroVis = null, telVis = [];
const L10 = { reencontroMin: 60 * 60000, notifs: [], get saudade(){ return saudade; }, get voz(){ return vozMeta; }, get passeio(){ return passeio; }, get vizinhos(){ return vizinhos; },
  get visitando(){ return visitando; }, psAvancar(s){ return passeio && passeio.ini ? ref("casa/passeio/ini").set(passeio.ini - s * 1000) : null; } };
Object.assign(SFX_MIN, { foto: SFX_MIN.foto || 600 });

const moradores = () => Object.entries(jogadores).filter(([, j]) => j && j.nome && !j.visita);
const nomeEu10 = () => (me && me.dados && me.dados.nome) || "Alguém";
function nomesLista(l){ l = l.filter(Boolean); return !l.length ? "Alguém" : l.length === 1 ? l[0] : l.slice(0, -1).join(", ") + " e " + l[l.length - 1]; }
function tempoTxt(ms){
  const h = ms / HORA;
  if (h < 1) return Math.max(1, Math.round(ms / 60000)) + " minutos";
  if (h < 48) { const n = Math.floor(h); return n + (n === 1 ? " hora" : " horas"); }
  const d = Math.floor(h / 24); return d + " dias";
}
function disco(cx, cy, r, c){ for (let dy = -r; dy <= r; dy++){ const w = Math.round(Math.sqrt(r * r - dy * dy)); R(cx - w, cy + dy, w * 2 + 1, 1, c); } }
function faixas(cores, y0, y1){
  const n = cores.length, h = (y1 - y0) / n;
  for (let i = 0; i < n; i++){
    const a = Math.round(y0 + i * h), b = Math.round(y0 + (i + 1) * h); R(0, a, W * T, b - a, cores[i]);
    if (i) for (let x = i % 2; x < W * T; x += 2) P(x, a, cores[i - 1]);
  }
}
function nuvem(x, y, w){ x = Math.round(x); rbox(x, y, w, 6, "#FFFFFF"); rbox(x + 4, y - 4, Math.max(4, w - 10), 6, "#FFFFFF"); R(x + 1, y + 5, w - 2, 1, "#E3EEF7"); }

// =====================================================================
// 1. AVISOS (notificação do navegador com a página aberta, título e favicon com contagem)
// =====================================================================
const AVISO_TIPOS = [["entrou", "Alguém entra na casa"], ["mural", "Bilhete no mural"], ["presente", "Presente pra você"], ["voz", "Recado de voz"],
  ["convite", "Convites (jogo, namoro, jantar, cinema, passeio)"], ["bebe", "Bebê chorando"], ["visita", "Visita chegou (vizinha, carteiro, gatinho)"]];
const TITULO10 = document.title;
const iconEl10 = document.querySelector('link[rel="icon"]'), iconBase10 = iconEl10 ? iconEl10.getAttribute("href") : "";
const iconDot10 = iconBase10.replace(/%3C\/svg%3E$/, "%3Ccircle cx='12' cy='4' r='3.6' fill='%23F0707A' stroke='%23FFFFFF' stroke-width='1'/%3E%3C/svg%3E");
let avisosPend = 0;
function avisosPrefs(){ try { return JSON.parse(store.get("casinha-avisos") || "{}") || {}; } catch(e){ return {}; } }
const notifSuporte = () => typeof window.Notification === "function";
const avisosLigados = () => store.get("casinha-avisos-on") === "1" && notifSuporte() && Notification.permission === "granted";
function avisar(tipo, texto){
  if (!me || avisosPrefs()[tipo] === false) return;
  if (document.hidden){ avisosPend++; document.title = "(" + avisosPend + ") " + TITULO10; if (iconEl10 && iconDot10) iconEl10.setAttribute("href", iconDot10); }
  const fundo = document.hidden || (typeof document.hasFocus === "function" && !document.hasFocus());
  if (!fundo || !avisosLigados()) return;
  try {
    const n = new Notification("Casinha", { body: String(texto).slice(0, 140), tag: "casinha-" + tipo, renotify: true, lang: "pt-BR" });
    n.onclick = () => { try { window.focus(); } catch(e){} n.close(); };
    L10.notifs.push({ tipo, texto, at: Date.now() });
  } catch(e){} // Android sem service worker não deixa criar Notification: fica só o título com a contagem
}
function limparAvisos(){ if (document.hidden) return; avisosPend = 0; if (document.title !== TITULO10) document.title = TITULO10; if (iconEl10 && iconEl10.getAttribute("href") !== iconBase10) iconEl10.setAttribute("href", iconBase10); }
document.addEventListener("visibilitychange", limparAvisos);
window.addEventListener("focus", limparAvisos);
function openAvisos(){
  openPanel("avisos", "Avisos 🔔", corpo => {
    const topo = el("div", "list"), lista = el("div", "list");
    corpo.append(el("p", "muted", "Sem servidor próprio (o site mora no GitHub Pages), os avisos só chegam enquanto a Casinha estiver aberta numa aba, mesmo em segundo plano."), topo, el("h3", null, "Avisar quando..."), lista);
    const upd = () => {
      topo.textContent = ""; lista.textContent = "";
      const p = avisosPrefs(), st = el("p", null);
      if (!notifSuporte()) st.textContent = "Este navegador não mostra avisos. Com a aba em segundo plano, o título mostra a contagem, tipo “(2) Casinha”.";
      else if (Notification.permission === "denied") st.textContent = "Os avisos estão bloqueados nas configurações do navegador pra este site. O título da aba ainda mostra a contagem.";
      else if (avisosLigados()) st.textContent = "Avisos ligados neste aparelho ✅";
      else st.textContent = "Os avisos do navegador estão desligados neste aparelho.";
      topo.append(st);
      if (notifSuporte() && Notification.permission !== "denied"){
        if (avisosLigados()) topo.append(btn("Desligar avisos do navegador", "btn ghost", () => { store.set("casinha-avisos-on", null); upd(); }));
        else topo.append(btn("🔔 Ligar avisos do navegador", "btn", () => {
          const r = Notification.requestPermission(ok => fim(ok)); if (r && r.then) r.then(fim);
          function fim(res){ if (res === "granted"){ store.set("casinha-avisos-on", "1"); toast("Avisos ligados 🔔"); } else if (res === "denied") toast("O navegador bloqueou os avisos."); upd(); }
        }));
      }
      for (const [k, nome] of AVISO_TIPOS){
        const on = p[k] !== false, b = btn("", "btn ghost escolha", () => { const q = avisosPrefs(); if (on) q[k] = false; else delete q[k]; store.set("casinha-avisos", JSON.stringify(q)); upd(); });
        b.setAttribute("aria-pressed", String(on)); b.append(el("strong", null, (on ? "✅ " : "⬜ ") + nome), el("small", null, on ? "Avisa" : "Não avisa")); lista.append(b);
      }
    };
    upd(); return upd;
  });
}

// =====================================================================
// 2. MODO SAUDADE (pelúcia de quem está fora, abraço, beijo, recado, resumo e reencontro)
// =====================================================================
const LUGARES_PELUCIA = ["casal", "dossel", "solteiro", "sofa", "namoradeira", "poltrona", "rede", "macaron", "pufePlaneta", "cadeiraPraia", "toco"];
function lugarPelucia(id){
  const esc = (saudade[id] || {}).lugar, m = esc && todosMoveis[esc];
  if (m && LUGARES_PELUCIA.includes(m.t)) return esc;
  const ks = Object.keys(todosMoveis).filter(k => todosMoveis[k] && LUGARES_PELUCIA.includes(todosMoveis[k].t));
  ks.sort((a, b) => ((todosMoveis[a].andar || 0) - (todosMoveis[b].andar || 0)) || (LUGARES_PELUCIA.indexOf(todosMoveis[a].t) - LUGARES_PELUCIA.indexOf(todosMoveis[b].t)) || (a < b ? -1 : 1));
  return ks[0] || null;
}
function peluciaSpr(j){
  const v = visual(j);
  return sprite("pel10:" + [v.corpo, v.roupa, v.cabelo, v.estilo, v.pele, v.acess, v.barba].join(":"), 18, 28, (ox, oy) => drawPelucia(v, ox + 9, oy + 27));
}
// pelúcia sentadinha: cabeça do boneco com olhos de botão e boca costurada, corpo fofo na cor da roupa, patinhas e costuras
function drawPelucia(v, cx, by){
  const pele = PELES[v.pele], cab = CABELOS[v.cabelo], cor = ROUPAS[v.roupa], corL = sh(cor, .32), corD = sh(cor, -.25), pD = sh(pele, -.16), cost = sh(cor, .6);
  rbox(cx - 7, by - 5, 6, 5, cor); rbox(cx + 1, by - 5, 6, 5, cor); R(cx - 6, by - 3, 3, 2, "#FFF4E0"); R(cx + 3, by - 3, 3, 2, "#FFF4E0"); // perninhas e solinhas
  rbox(cx - 5, by - 12, 10, 9, cor); R(cx - 4, by - 12, 8, 1, corL); R(cx + 4, by - 11, 1, 7, corD);
  rbox(cx - 3, by - 10, 6, 5, corL); pixHeart(cx - 2, by - 9, "#F49AAE"); // barriguinha com coração
  for (let y = by - 11; y < by - 4; y += 2) P(cx - 4, y, cost); // costura do lado
  rbox(cx - 8, by - 11, 3, 6, cor); rbox(cx + 5, by - 11, 3, 6, cor); P(cx - 7, by - 6, pele); P(cx + 6, by - 6, pele); // bracinhos
  R(cx + 5, by - 4, 2, 2, "#FFFFFF"); // etiqueta
  const hy = by - 21;
  R(cx - 4, hy, 8, 1, pele); R(cx - 5, hy + 1, 10, 6, pele); R(cx - 4, hy + 7, 8, 1, pele); R(cx - 3, hy + 8, 6, 1, pele);
  P(cx - 4, hy + 7, pD); P(cx + 3, hy + 7, pD); R(cx + 4, hy + 3, 1, 4, pD);
  for (const ex of [cx - 3, cx + 1]){ R(ex, hy + 4, 2, 2, "#2E2638"); P(ex, hy + 4, "#8C7A9A"); } // olhos de botão
  R(cx - 5, hy + 6, 2, 1, "rgba(238,96,110,.7)"); R(cx + 3, hy + 6, 2, 1, "rgba(238,96,110,.7)");
  P(cx - 1, hy + 7, "#B0506A"); P(cx, hy + 7, "#B0506A"); P(cx - 2, hy + 6, "#B0506A"); P(cx + 1, hy + 6, "#B0506A"); // sorriso costurado
  hairDraw(cx, hy, "down", v.estilo, cab);
  acessDraw(cx, hy, "down", v);
  P(cx - 5, hy + 3, pD); P(cx - 5, hy + 5, pD); // costura da cabeça
}
// lugar de cada pelúcia neste andar: [{ id, cx, by, z, mov }]
function peluciasAqui(){
  const out = [], porMov = {};
  for (const [id, j] of moradores()){
    if (id === pid || j.online) continue;
    const mov = lugarPelucia(id), m = mov && todosMoveis[mov];
    if (m){ if ((m.andar || 0) !== andarAtual || !CAT[m.t]) continue; (porMov[mov] = porMov[mov] || []).push(id); }
    else if ((j.andar || 0) === andarAtual) out.push({ id, cx: Math.round((j.x + .5) * T), by: Math.round((j.y + 1) * T - 3), z: (j.y + 1) * T - 3, mov: null });
  }
  for (const [mov, ids] of Object.entries(porMov)){
    const m = todosMoveis[mov], c = CAT[m.t], se = SENTAR[m.t];
    const by = m.y * T + (/casal|dossel|solteiro/.test(m.t) ? 17 : m.t === "rede" ? 10 : se && se.vagas ? se.vagas[0].by - 1 : 13);
    ids.sort().forEach((id, i) => out.push({ id, cx: Math.round((m.x + c.w / 2) * T + (i - (ids.length - 1) / 2) * 10), by, z: (m.y + c.h) * T + .4 + i * .01, mov }));
  }
  return out;
}
function peluciaNoToque(wx, wy, toque){
  const f = toque ? 5 : 1;
  for (const p of sdVis) if (Math.abs(wx - p.cx) < 8 + f && wy > p.by - 24 - f && wy < p.by + 2 + f) return p;
  return null;
}
function menuPelucia(p, pt){
  const nome = nomeDe(p.id);
  openMenu(pt, "🧸 " + nome + " (fora)", [
    { nome: "Abraçar a pelúcia 🤗", info: "Abraço de saudade", fn: () => abracarPelucia(p.id) },
    { nome: "Deixar um recado 💌", info: nome + " lê quando voltar", fn: () => recadoPelucia(p.id) },
    { nome: "Mandar um beijo 😘", fn: () => beijoPelucia(p.id) }
  ]);
}
function logSaudade(id, d){
  const n = Object.keys((saudade[id] || {}).log || {}).length; if (n >= 80) return Promise.resolve(false);
  return ref("casa/saudade/" + id + "/log").push(Object.assign({ de: pid, nome: nomeEu10(), at: TS() }, d)).then(() => true, () => false);
}
function abracarPelucia(id){
  const p = peluciasAqui().find(q => q.id === id); if (!p) return;
  const m = p.mov && moveis[p.mov], tx = Math.floor(p.cx / T), ty = Math.floor((p.by - 2) / T);
  const goal = m ? adjTo(m) : (x, y) => Math.abs(x - tx) + Math.abs(y - ty) === 1;
  goTo(null, goal, () => {
    const q = peluciasAqui().find(r => r.id === id); if (!q) { toast(nomeDe(id) + " acabou de chegar! Vai lá abraçar de verdade 💞"); return; }
    faceTo(q.cx / T - .5, q.by / T - 1);
    setAcao({ id: "s-abracar-pelucia", nome: "Abraçando a pelúcia de " + nomeDe(id), ini: Date.now(), dur: 3500, def: { ganho: { social: 8 } } });
    for (let i = 0; i < 3; i++) setTimeout(() => burst(q.cx / T - .5, q.by / T - .4, "heart"), i * 500);
    sfx("beijo");
    logSaudade(id, { tipo: "abraco" }); statMais("saudades");
  });
}
function beijoPelucia(id){
  const p = peluciasAqui().find(q => q.id === id); if (!p) return;
  burst(p.cx / T - .5, p.by / T - .4, "heart"); burst(me.px, me.py, "heart"); sfx("beijo");
  logSaudade(id, { tipo: "beijo" }).then(ok => toast(ok ? "Beijo mandado pra " + nomeDe(id) + " 😘" : "A pelúcia já está cheia de carinho 😅"));
}
function recadoPelucia(id){
  openPanel("recado10", "Recado pra " + nomeDe(id) + " 💌", corpo => {
    const inp = el("textarea", "txt10"); inp.maxLength = 120; inp.rows = 3; inp.placeholder = "Escreva um recadinho (até 120 letras)"; inp.setAttribute("aria-label", "Recado");
    const bb = el("div", "hbtns"), ok = btn("Deixar com a pelúcia", "btn", () => {
      const t = inp.value.replace(/\s+/g, " ").trim().slice(0, 120); if (!t){ toast("Escreva alguma coisa 😉"); return; }
      ok.disabled = true; logSaudade(id, { tipo: "recado", texto: t }).then(r => { closePanel(); toast(r ? "Recado guardado com a pelúcia 💌" : "Não deu pra guardar agora."); if (r) sfx("pop"); });
    });
    bb.append(ok, btn("Cancelar", "btn ghost", closePanel));
    corpo.append(el("p", "muted", nomeDe(id) + " vê quando voltar pra casa."), inp, bb);
    setTimeout(() => inp.focus(), 50);
  });
}
// quando eu volto: "Enquanto você estava fora..."
function vigiarSaudade(){
  if (!me || visitando || !sdCarregada || sdMostrando) return;
  const log = (saudade[pid] || {}).log; if (!log || !Object.keys(log).length) return;
  if (painel) return; // espera o painel aberto fechar
  sdMostrando = true;
  const itens = Object.values(log).filter(Boolean).sort((a, b) => (a.at || 0) - (b.at || 0));
  ref("casa/saudade/" + pid + "/log").remove().catch(() => {});
  const por = {};
  for (const it of itens){ const k = it.de || "?"; const g = por[k] = por[k] || { nome: it.nome || nomeDe(k), abraco: 0, beijo: 0, recados: [] }; if (it.tipo === "abraco") g.abraco++; else if (it.tipo === "beijo") g.beijo++; else if (it.tipo === "recado" && it.texto) g.recados.push(it); }
  const frases = Object.values(por).map(g => {
    const p = [];
    if (g.abraco) p.push("te abraçou " + (g.abraco === 1 ? "1 vez" : g.abraco + " vezes") + " 💕");
    if (g.beijo) p.push("mandou " + (g.beijo === 1 ? "1 beijo" : g.beijo + " beijos") + " 😘");
    if (g.recados.length) p.push("deixou " + (g.recados.length === 1 ? "1 recado" : g.recados.length + " recados"));
    return g.nome + " " + nomesLista(p);
  });
  openPanel("saudadeVolta", "Enquanto você estava fora 🧸", corpo => {
    for (const f of frases) corpo.append(el("p", "big10", f));
    const recs = itens.filter(i => i.tipo === "recado" && i.texto);
    if (recs.length){ const l = el("div", "list"); for (const r of recs){ const row = el("div", "rowi"), tx = el("div", "tx"); tx.append(el("strong", null, "“" + r.texto + "”"), el("small", null, (r.nome || "Alguém") + " · " + quando(r.at || 0))); row.append(tx); l.append(row); } corpo.append(el("h3", null, "Recados 💌"), l); }
    corpo.append(btn("Que saudade boa 💞", "btn", closePanel));
  });
  sfx("notif"); setTimeout(() => { sdMostrando = false; }, 1500);
}
function openSaudade(){
  openPanel("saudade", "Modo saudade 🧸", corpo => {
    const lista = el("div", "list");
    corpo.append(el("p", "muted", "Quando você sai da casa, seu bonequinho vira uma pelúcia com as suas cores. Quem estiver lá pode abraçar, mandar beijo e deixar recado — você vê tudo quando voltar."),
      el("h3", null, "Onde minha pelúcia fica"), lista);
    const upd = () => {
      lista.textContent = "";
      const atual = (saudade[pid] || {}).lugar || null, valido = atual && todosMoveis[atual];
      const mk = (mov, tit, sub) => { const on = mov === (valido ? atual : null); const b = btn("", "btn ghost escolha", () => ref("casa/saudade/" + pid + "/lugar").set(mov).then(() => toast("Pelúcia vai ficar " + (mov ? "aí 🧸" : "no lugar automático 🧸")))); b.setAttribute("aria-pressed", String(on)); b.append(el("strong", null, (on ? "✅ " : "") + tit), el("small", null, sub)); return b; };
      lista.append(mk(null, "Automático", "A primeira cama ou sofá da casa"));
      const ks = Object.keys(todosMoveis).filter(k => todosMoveis[k] && LUGARES_PELUCIA.includes(todosMoveis[k].t)).sort((a, b) => LUGARES_PELUCIA.indexOf(todosMoveis[a].t) - LUGARES_PELUCIA.indexOf(todosMoveis[b].t));
      for (const k of ks){ const m = todosMoveis[k]; lista.append(mk(k, CAT[m.t].nome, COMODOS[comodoDeMovel(m)] || "")); }
    };
    upd(); return upd;
  });
}
function comodoDeMovel(m){ if ((m.andar || 0) === andarAtual) return comodo(m.x, m.y); return (m.andar || 0) ? "jogos" : "sala"; }
// reencontro: os dois online de novo depois de um tempão
function vigiarReencontro(){
  if (!me || visitando || !reCarregado) return;
  const t = srvNow();
  for (const [id, j] of moradores()){
    if (id === pid) continue;
    const k = [pid, id].sort().join("_");
    if (!j.online){ delete reVisto[k]; continue; }
    let v = reVisto[k];
    if (!v){
      v = reVisto[k] = { desde: t, gravou: 0 };
      const ult = reencontro[k];
      if (ult && t - ult >= L10.reencontroMin) celebrarReencontro(id, t - ult);
    }
    if (t - v.desde > 15000 && t - v.gravou > 60000){ v.gravou = t; ref("casa/reencontro/" + k).set(TS()).catch(() => {}); }
  }
}
function celebrarReencontro(id, gap){
  toastEspecial("Fazia " + tempoTxt(gap) + " que vocês não se viam 💞", nomeDe(id) + " está aqui!");
  sfx("fanfarra");
  const d = disp[id], j = jogadores[id];
  for (let i = 0; i < 4; i++) setTimeout(() => { if (!me) return; burst(me.px, me.py, "heart"); const dd = disp[id] || d || j; if (dd && (j.andar || 0) === andarAtual) burst(dd.x, dd.y, "heart"); }, i * 450);
}

// =====================================================================
// 3. RECADO DE VOZ PELO TELEFONE
// =====================================================================
CAT.telmesa = { nome: "Mesinha do telefone", w: 1, h: 1, preco: 90, acoes: [] };
TOP.telmesa = 6;
FURN_EXTRA.telmesa = function(x, y){
  rbox(x + 2, y + 3, 12, 4, C.wood); R(x + 3, y + 3, 10, 1, C.woodL); R(x + 3, y + 7, 2, 8, C.woodD); R(x + 11, y + 7, 2, 8, C.woodD); R(x + 5, y + 11, 6, 1, C.woodD);
  R(x + 3, y + 5, 10, 2, C.cream); P(x + 4, y + 7, C.cream); P(x + 7, y + 7, C.cream); P(x + 10, y + 7, C.cream); // paninho de crochê
  rbox(x + 4, y - 1, 8, 6, "#7FD1B2"); R(x + 5, y - 1, 6, 1, "#A8E6CC");
  rbox(x + 3, y - 4, 10, 3, "#5DBB9A"); R(x + 4, y - 4, 8, 1, "#A8E6CC"); R(x + 3, y - 2, 2, 2, "#3F9A7C"); R(x + 11, y - 2, 2, 2, "#3F9A7C");
  R(x + 6, y + 1, 4, 3, C.cream); P(x + 7, y + 2, C.ink); P(x + 8, y + 2, C.ink);
  P(x + 12, y + 3, C.ink); P(x + 13, y + 4, C.ink); P(x + 12, y + 5, C.ink);
};
const VOZ_MAX = 30, VOZ_SEG = 15, VOZ_MAX_CH = 140000;
const vozOk = v => typeof v === "string" && v.length < 200000 && /^data:audio\/(webm|ogg|mp4|aac|mpeg|x-m4a)[^,]*;base64,[A-Za-z0-9+/=]+$/.test(v);
const vozParaMim = g => !visitando && !!g && g.de !== pid && (g.para === pid || g.para === "todos");
const vozNova = g => vozParaMim(g) && !(g.ouvido && g.ouvido[pid]);
const vozNovas = () => Object.entries(vozMeta).filter(([, g]) => vozNova(g));
function mimeVoz(){
  if (typeof window.MediaRecorder !== "function" || !MediaRecorder.isTypeSupported) return null;
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch(e){ return false; } }) || null;
}
const podeGravar = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && mimeVoz());
function menuTelefone(id, m){
  if (visitando) return [];
  const n = vozNovas().length;
  return [{ nome: "Recados de voz 📞", info: n ? n + (n === 1 ? " novo pra você!" : " novos pra você!") : "Gravar ou ouvir", fn: openVoz }];
}
MENU_EXTRA.telmesa = menuTelefone;
{ const base = MENU_EXTRA.telefone; MENU_EXTRA.telefone = (id, m) => (base ? base(id, m) : []).concat(menuTelefone(id, m)); }
let grav = { estado: "parado", para: "todos" };
function pararGravacao(descartar){
  const g = grav;
  if (g.timer) clearInterval(g.timer); g.timer = 0;
  if (g.raf) cancelAnimationFrame(g.raf); g.raf = 0;
  if (descartar) g.descartar = true;
  try { if (g.rec && g.rec.state !== "inactive") g.rec.stop(); } catch(e){}
  if (g.stream) try { g.stream.getTracks().forEach(t => t.stop()); } catch(e){}
  if (g.ac) try { g.ac.close(); } catch(e){}
  g.stream = null; g.ac = null;
  if (descartar){ grav = { estado: "parado", para: g.para }; }
}
function gravarVoz(render){
  const mime = mimeVoz(); if (!podeGravar()){ toast("Seu navegador não grava áudio aqui."); return; }
  grav = { estado: "pedindo", para: grav.para }; render();
  const g = grav;
  navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } }).then(stream => {
    if (grav !== g || !painel || painel.id !== "voz"){ stream.getTracks().forEach(t => t.stop()); return; }
    let rec; try { rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 20000 }); } catch(e){ try { rec = new MediaRecorder(stream); } catch(e2){ stream.getTracks().forEach(t => t.stop()); grav = { estado: "parado", para: g.para }; render(); toast("Seu navegador não grava áudio aqui."); return; } }
    const pedacos = [];
    g.stream = stream; g.rec = rec; g.t0 = Date.now(); g.estado = "gravando";
    rec.ondataavailable = e => { if (e.data && e.data.size) pedacos.push(e.data); };
    rec.onstop = () => {
      if (g.descartar) return;
      const dur = Math.min(VOZ_SEG * 1000, Date.now() - g.t0);
      const blob = new Blob(pedacos, { type: (rec.mimeType || mime || "audio/webm").split(";")[0] });
      const fr = new FileReader();
      fr.onload = () => {
        if (grav !== g) return;
        let url = String(fr.result || "");
        url = url.replace(/^data:[^;,]*/, "data:" + (rec.mimeType || mime || "audio/webm").split(";")[0]);
        if (!vozOk(url) || url.length > VOZ_MAX_CH){ grav = { estado: "parado", para: g.para }; render(); toast(url.length > VOZ_MAX_CH ? "O recado ficou pesado demais 😅 Tente mais curtinho." : "Não deu pra gravar. Tente de novo."); return; }
        Object.assign(g, { estado: "pronto", url, dur, mime: (rec.mimeType || mime || "").split(";")[0] }); render();
      };
      fr.readAsDataURL(blob);
    };
    rec.start(250);
    try { // onda simples com o volume do microfone
      const AC = window.AudioContext || window.webkitAudioContext; g.ac = new AC(); const src = g.ac.createMediaStreamSource(stream), an = g.ac.createAnalyser(); an.fftSize = 256; src.connect(an); g.an = an; g.buf = new Uint8Array(an.fftSize);
    } catch(e){ g.an = null; }
    render();
    g.timer = setInterval(() => {
      if (!painel || painel.id !== "voz"){ pararGravacao(true); return; }
      const s = (Date.now() - g.t0) / 1000, tx = document.getElementById("vozTempo"); if (tx) tx.textContent = "0:" + pad2(Math.min(VOZ_SEG, Math.floor(s))) + " / 0:" + VOZ_SEG;
      if (s >= VOZ_SEG) pararGravacao(false);
    }, 200);
    const onda = () => {
      if (grav !== g || g.estado !== "gravando") return;
      const cv = document.getElementById("vozOnda"); if (cv){
        const x = cv.getContext("2d"), w = cv.width, h = cv.height; x.clearRect(0, 0, w, h); x.fillStyle = "#8E7CF0";
        if (g.an){ g.an.getByteTimeDomainData(g.buf); for (let i = 0; i < 48; i++){ const v = Math.abs(g.buf[Math.floor(i * g.buf.length / 48)] - 128) / 128, bh = Math.max(2, Math.round(v * h * 1.6)); x.fillRect(i * (w / 48), (h - bh) / 2, w / 48 - 1, Math.min(h, bh)); } }
        else { const t = Date.now() / 120; for (let i = 0; i < 48; i++){ const bh = 4 + Math.abs(Math.sin(t + i * .7)) * (h - 6); x.fillRect(i * (w / 48), (h - bh) / 2, w / 48 - 1, bh); } }
      }
      g.raf = requestAnimationFrame(onda);
    };
    g.raf = requestAnimationFrame(onda);
  }, () => { grav = { estado: "parado", para: g.para }; render(); toast("Sem acesso ao microfone. Libere nas configurações do navegador."); });
}
function enviarVoz(){
  const g = grav; if (g.estado !== "pronto" || !g.url) return;
  const lista = Object.entries(vozMeta).filter(([, v]) => v).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  const up = {};
  let sobra = lista.length + 1 - VOZ_MAX;
  if (sobra > 0) for (const [id, v] of lista){ // apaga os mais antigos já ouvidos
    if (sobra <= 0) break;
    const ouv = v.ouvido || {}, ouvido = v.para === "todos" ? Object.keys(ouv).length > 0 : !!ouv[v.para];
    if (ouvido){ up["vozMeta/" + id] = null; up["vozAudio/" + id] = null; sobra--; }
  }
  if (sobra > 0){ toast("A caixa de recados está cheia (" + VOZ_MAX + "). Ouçam ou apaguem alguns antes 📞"); return; }
  const id = ref("casa/vozMeta").push().key;
  up["vozMeta/" + id] = { de: pid, nome: nomeEu10(), para: g.para || "todos", at: TS(), dur: Math.round(g.dur || 0), mime: g.mime || "" };
  up["vozAudio/" + id] = g.url;
  grav = { estado: "enviando", para: g.para }; refreshPanel("voz");
  ref("casa").update(up).then(() => { vozSrc.set(id, g.url); grav = { estado: "parado", para: g.para }; refreshPanel("voz"); toast("Recado enviado 📞"); sfx("pop"); }, () => { grav = g; refreshPanel("voz"); toast("Não deu pra enviar agora."); });
}
function carregarVoz(id){
  if (vozSrc.has(id)) return Promise.resolve(vozSrc.get(id));
  if (vozPend.has(id)) return vozPend.get(id);
  const p = ref("casa/vozAudio/" + id).once("value").then(s => { vozPend.delete(id); const v = s.val(); if (!vozOk(v)) return null; vozSrc.set(id, v); return v; }, () => { vozPend.delete(id); return null; });
  vozPend.set(id, p); return p;
}
let vozTocando = null;
function ouvirVoz(id){
  const g = vozMeta[id]; if (!g) return;
  carregarVoz(id).then(src => {
    if (!src){ toast("Esse recado não carregou."); return; }
    try { if (vozTocando) vozTocando.pause(); } catch(e){}
    const a = new Audio(src); vozTocando = a;
    const p = a.play(); if (p && p.catch) p.catch(() => toast("Não deu pra tocar aqui (o navegador não abre esse formato)."));
    if (vozParaMim(g) && !(g.ouvido && g.ouvido[pid])) ref("casa/vozMeta/" + id + "/ouvido/" + pid).set(TS()).catch(() => {});
  });
}
function apagarVoz(id){ ref("casa").update({ ["vozMeta/" + id]: null, ["vozAudio/" + id]: null }).then(() => { vozSrc.delete(id); toast("Recado apagado."); }, () => toast("Não deu pra apagar agora.")); }
const durTxt = ms => "0:" + pad2(Math.max(1, Math.round((ms || 0) / 1000)));
function openVoz(){
  if (visitando){ toast("O telefone é dos moradores 😉"); return; }
  openPanel("voz", "Recados de voz 📞", corpo => {
    const gb = el("div", "list grav10"), lista = el("div", "list");
    corpo.append(gb, el("h3", null, "Recados"), lista);
    let gsig = null, lsig = null;
    const render = () => {
      const s = grav.estado + "|" + grav.para + "|" + JSON.stringify(moradores().map(([id]) => id)); if (s === gsig) return; gsig = s;
      gb.textContent = "";
      if (!podeGravar()){ gb.append(el("p", "muted", "Seu navegador não grava áudio aqui. Dá pra ouvir os recados normalmente.")); return; }
      const para = el("div", "chips10"); para.setAttribute("role", "group"); para.setAttribute("aria-label", "Pra quem");
      const outros = moradores().filter(([id]) => id !== pid);
      if (grav.para !== "todos" && !outros.some(([id]) => id === grav.para)) grav.para = "todos";
      for (const [k, nome] of [["todos", "Todos"]].concat(outros.map(([id, j]) => [id, j.nome]))){
        const b = btn(nome, "btn ghost small", () => { grav.para = k; gsig = null; render(); }); b.setAttribute("aria-pressed", String(grav.para === k)); para.append(b);
      }
      gb.append(el("span", "lbl", "Pra quem"), para);
      const row = el("div", "hbtns");
      if (grav.estado === "parado") row.append(btn("🎙️ Gravar recado (até " + VOZ_SEG + " s)", "btn", () => gravarVoz(() => { gsig = null; render(); })));
      else if (grav.estado === "pedindo") row.append(el("span", "muted", "Pedindo o microfone..."));
      else if (grav.estado === "gravando"){
        const cv = el("canvas", "onda10"); cv.id = "vozOnda"; cv.width = 240; cv.height = 40; cv.setAttribute("aria-hidden", "true");
        const tt = el("span", "rec10", "0:00 / 0:" + VOZ_SEG); tt.id = "vozTempo";
        gb.append(cv); row.append(el("span", "dotrec10", "● Gravando"), tt, btn("⏹ Parar", "btn", () => pararGravacao(false)));
      } else if (grav.estado === "pronto"){
        row.append(btn("▶ Ouvir antes", "btn ghost", () => { try { new Audio(grav.url).play().catch(() => toast("Não deu pra tocar aqui.")); } catch(e){} }),
          btn("Enviar 📨", "btn", enviarVoz), btn("Descartar", "btn ghost", () => { pararGravacao(true); gsig = null; render(); }));
        gb.append(el("p", "muted", "Recado de " + durTxt(grav.dur) + " pronto."));
      } else row.append(el("span", "muted", "Enviando..."));
      gb.append(row);
    };
    const upd = () => {
      render();
      const itens = Object.entries(vozMeta).filter(([, g]) => g && (vozParaMim(g) || g.de === pid)).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      const s = JSON.stringify(itens) + Math.floor(srvNow() / 60000); if (s === lsig) return; lsig = s;
      lista.textContent = "";
      if (!itens.length){ lista.append(el("p", "muted", "Nenhum recado ainda. Grave o primeiro! 📞")); return; }
      for (const [id, g] of itens){
        const row = el("div", "rowi"), tx = el("div", "tx"), bb = el("div", "bb10"), meu = g.de === pid, novo = vozNova(g);
        const pra = g.para === "todos" ? "todos" : g.para === pid ? "você" : nomeDe(g.para);
        const ouv = Object.keys(g.ouvido || {}).filter(k => k !== g.de).map(k => k === pid ? "você" : nomeDe(k));
        tx.append(el("strong", null, (novo ? "🔴 Novo · " : "") + (meu ? "Você → " + pra : (g.nome || nomeDe(g.de)) + " → " + pra)), el("small", null, quando(g.at || 0) + " · " + durTxt(g.dur) + (ouv.length ? " · ouvido por " + nomesLista(ouv) : meu ? " · ainda não ouvido" : "")));
        const b1 = btn("▶ Ouvir", "btn small", () => ouvirVoz(id)); b1.setAttribute("aria-label", "Ouvir recado de " + (meu ? "você" : g.nome || "alguém"));
        bb.append(b1);
        if (meu || vozParaMim(g)){ const b2 = btn("🗑", "btn ghost small", () => apagarVoz(id)); b2.setAttribute("aria-label", "Apagar recado"); bb.append(b2); }
        row.append(tx, bb); lista.append(row);
      }
    };
    upd(); return upd;
  });
}
function aoMudarVoz(novo){
  const ant = vozMeta; vozMeta = novo;
  if (vozCarregada && me) for (const [id, g] of Object.entries(novo)){
    if (!g || ant[id] || !vozParaMim(g)) continue;
    const t = (g.nome || nomeDe(g.de)) + " deixou um recado de voz 📞"; toast(t); sfx("notif"); avisar("voz", t);
  }
  for (const k of [...vozSrc.keys()]) if (!novo[k]) vozSrc.delete(k);
  vozCarregada = true; refreshPanel("voz");
}

// =====================================================================
// 4. PASSEIO DE CARRO
// =====================================================================
const PS_GAS = 20, PS_SAI = 2600, PS_CONVITE = 60000;
const DESTINOS = {
  praia:     { nome: "Praia", em: "🏖️", txt: "à praia", chao: 182, x: 118, mold: ["#FFF3D6", "#7CC8EE"], ativ: [["castelo", "Castelo de areia 🏰"], ["mergulho", "Mergulho 🌊"], ["picole", "Picolé 🍦"]] },
  cachoeira: { nome: "Cachoeira", em: "💦", txt: "à cachoeira", chao: 198, x: 144, mold: ["#EAF6EE", "#5DAA5E"], ativ: [["banho", "Banho de cachoeira 💦"], ["pedras", "Pular pedras 🪨"], ["piquenique", "Piquenique 🧺"]] },
  cidade:    { nome: "Cidade à noite", em: "🌃", txt: "ver a cidade à noite", chao: 178, x: 144, mold: ["#2B235F", "#F6D77A"], ativ: [["sorvete", "Sorvete 🍨"], ["fogos", "Ver os fogos 🎆"], ["dancar", "Dançar na rua 💃"]] },
  girassois: { nome: "Campo de girassóis", em: "🌻", txt: "ao campo de girassóis", chao: 196, x: 144, mold: ["#FFF6D0", "#F7C93E"], ativ: [["colher", "Colher um girassol 🌻"], ["coroa", "Coroa de flores 👑"], ["correr", "Correr no campo 🏃"]] },
  parque:    { nome: "Parque de diversões", em: "🎡", txt: "ao parque de diversões", chao: 192, x: 150, mold: ["#FCE4F0", "#B5609E"], ativ: [["roda", "Roda-gigante 🎡"], ["algodao", "Algodão-doce 🍭"], ["carrossel", "Carrossel 🎠"]] }
};
const psAtivo = () => !!passeio && (passeio.estado === "convite" || passeio.estado === "viajando");
const psVai = id => !!(passeio && passeio.vai && passeio.vai[id]);
const emViagem = () => !!me && !!passeio && passeio.estado === "viajando" && psVai(pid);
const viagemOn = () => emViagem() && srvNow() >= (passeio.ini || 0) + PS_SAI;
const psIds = () => passeio ? Object.keys(passeio.vai || {}).filter(id => jogadores[id] && jogadores[id].nome).sort() : [];
const vb = (um, varios) => psIds().length > 1 ? varios : um;
const psNomes = () => nomesLista(psIds().map(id => id === pid ? "você" : nomeDe(id)));
function destinosTxt(p){ const ks = Object.keys((p && p.foram) || {}).filter(k => DESTINOS[k]); return ks.length ? nomesLista(ks.map(k => DESTINOS[k].txt + " " + DESTINOS[k].em)) : "passear de carro 🚗"; }
// onde o carro fica: no quintal (canto de baixo, num lugar livre) ou na faixa de grama de baixo, na frente da casa
function carroPos(){
  if (andarAtual !== 0) return null;
  if (temQuintal()){
    for (let y = H - 2; y > HC; y--) for (let x = 1; x < W - 2; x++){
      if (portaQ && Math.abs(x - portaQ) <= 1) continue;
      if (MAP[y][x] === 0 && MAP[y][x + 1] === 0 && !occ[y][x] && !occ[y][x + 1]) return { x: x * T + 1, by: (y + 1) * T - 1, tx: x, ty: y, z: (y + 1) * T - 1 };
    }
  }
  return { x: 9 * T + 1, by: H_CASA * T - 1, tx: 9, ty: HC - 1, z: H * T + 50, rua: 1 };
}
function carroSpr(roda){
  return sprite("carro10:" + roda, 30, 16, (ox, oy) => {
    const c = "#F49AAE", cL = "#F9C9D6", cD = "#D9708C", vd = "#BFE6F7";
    rbox(ox + 1, oy + 7, 28, 6, c); R(ox + 2, oy + 7, 26, 1, cL); R(ox + 1, oy + 12, 28, 1, cD);
    rbox(ox + 7, oy + 1, 15, 7, c); R(ox + 8, oy + 1, 13, 1, cL);
    R(ox + 9, oy + 3, 5, 4, vd); R(ox + 15, oy + 3, 5, 4, vd); P(ox + 9, oy + 3, "#FFFFFF"); P(ox + 15, oy + 3, "#FFFFFF"); R(ox + 14, oy + 3, 1, 4, cD);
    R(ox + 27, oy + 8, 2, 2, "#FFF0A0"); R(ox + 1, oy + 8, 1, 2, "#E8445E"); P(ox + 15, oy + 9, cD);
    pixHeart(ox + 19, oy + 8, "#FFFFFF");
    for (const wx of [7, 22]){ rbox(ox + wx - 3, oy + 10, 7, 6, "#2E2638"); R(ox + wx - 1, oy + 12, 3, 2, "#C6D0DA"); P(ox + wx - 1 + roda, oy + 12 + roda, "#8D9BAA"); }
  });
}
function cabecinhas(x, y, ids, k){ // quem está dentro do carro (janela), k = escala
  ids.slice(0, 2).forEach((id, i) => { const v = visual(jogadores[id]); const hx = x + (10 + i * 6) * k, hy = y + 3 * k; R(hx, hy + k, 4 * k, 3 * k, PELES[v.pele]); R(hx, hy, 4 * k, 2 * k, CABELOS[v.cabelo]); });
}
// deslocamento do carro: saindo (pra direita) ou chegando (vindo da esquerda)
function carroAnim(t){
  if (!passeio) return { dx: 0, show: true, dentro: null };
  if (passeio.estado === "viajando"){ const p = (t - (passeio.ini || 0)) / PS_SAI; return p >= 1 ? { show: false } : { dx: Math.round(Math.max(0, p) * Math.max(0, p) * 240), show: true, dentro: psIds(), roda: 1 }; }
  if (passeio.estado === "fim" && passeio.fimAt){ const p = (t - passeio.fimAt) / PS_SAI; if (p < 1) return { dx: -Math.round((1 - Math.max(0, p)) * (1 - Math.max(0, p)) * 240), show: true, dentro: psIds(), roda: 1 }; }
  return { dx: 0, show: true, dentro: null };
}
function addCarroObjs(objs, tm){
  carroVis = null;
  const cp = carroPos(); if (!cp) return;
  const a = carroAnim(srvNow()); if (!a.show) return;
  const x = cp.x + a.dx, y = cp.by - 16, roda = a.roda ? Math.floor(tm / 90) % 2 : 0;
  carroVis = { x, y, w: 30, h: 16 };
  objs.push({ z: cp.z, f: () => {
    R(x + 2, cp.by - 1, 26, 2, "rgba(20,30,20,.28)");
    ctx.drawImage(carroSpr(roda).c, x - 1, y - 1);
    if (a.dentro && a.dentro.length) cabecinhas(x, y, a.dentro, 1);
  } });
}
function carroNoToque(wx, wy, toque){ const c = carroVis, f = toque ? 6 : 2; return !!c && wx >= c.x - f && wx <= c.x + c.w + f && wy >= c.y - f && wy <= c.y + c.h + f; }
function menuCarro(pt){
  if (visitando){ toast("Esse carrinho é dos donos da casa 🚗"); return; }
  const it = [{ nome: "Passear 🚗", info: "$" + PS_GAS + " de gasolina", fn: abrirPasseio }];
  if (psAtivo() && passeio.estado === "convite") it.unshift({ nome: "Ver o convite do passeio", fn: abrirPasseio });
  openMenu(pt, "Carrinho", it);
}
function abrirPasseio(){
  if (!me) return;
  if (visitando){ toast("Esse carrinho é dos donos da casa 🚗"); return; }
  if (psAtivo()){
    if (passeio.estado === "convite" && passeio.por === pid){ toast("Esperando a resposta do convite 🚗"); return; }
    if (passeio.estado === "convite" && passeio.conv && passeio.conv[pid] === true){ aceitarPasseio(); return; }
    toast("O carro já está ocupado agora 🚗"); return;
  }
  if (me.dinheiro < PS_GAS){ toast("Faltam $" + Math.ceil(PS_GAS - me.dinheiro) + " pra gasolina."); return; }
  if (me.needs.energia < 12){ toast("Cansado(a) demais pra passear 😴 Descanse um pouco."); return; }
  const cands = moradores().filter(([id, j]) => id !== pid && j.online);
  const sel = new Set(cands.map(([id]) => id));
  openPanel("passeio", "Passear de carro 🚗", corpo => {
    const lista = el("div", "list"), bb = el("div", "hbtns");
    corpo.append(el("p", "muted", "Vocês entram no carrinho e escolhem o destino na estrada: praia, cachoeira, cidade à noite, girassóis ou parque. Gasolina: $" + PS_GAS + " (você paga)."), lista, bb);
    const upd = () => {
      lista.textContent = ""; bb.textContent = "";
      if (cands.length){
        lista.append(el("span", "lbl", "Chamar junto"));
        for (const [id, j] of cands){ const on = sel.has(id); const b = btn("", "btn ghost escolha", () => { if (on) sel.delete(id); else sel.add(id); upd(); }); b.setAttribute("aria-pressed", String(on)); b.append(el("strong", null, (on ? "✅ " : "⬜ ") + j.nome), el("small", null, on ? "Vai receber o convite" : "Fica em casa")); lista.append(b); }
      } else lista.append(el("p", null, "Ninguém mais está em casa agora. Dá pra ir sozinho(a) mesmo 😉"));
      bb.append(btn(sel.size ? "Convidar e esperar 🚗" : "Partir sozinho(a) 🚗", "btn", () => { closePanel(); criarPasseio([...sel]); }), btn("Agora não", "btn ghost", closePanel));
    };
    upd(); return upd;
  });
}
function criarPasseio(conv){
  const c = {}; conv.forEach(id => c[id] = true);
  txn("casa/passeio", cur => cur && (cur.estado === "convite" || cur.estado === "viajando") ? undefined : { por: pid, estado: "convite", criado: srvNow(), vai: { [pid]: true }, conv: conv.length ? c : null })
    .then(ok => { if (!ok){ toast("O carro já está ocupado agora 🚗"); return; } if (!conv.length) partir(); else { toast("Convite enviado 🚗 Esperando " + nomesLista(conv.map(nomeDe)) + "."); sfx("pop"); } });
}
function aceitarPasseio(){
  if (me && me.needs.energia < 8){ toast("Cansado(a) demais pra passear agora 😴"); return; }
  txn("casa/passeio", cur => { if (!cur || cur.estado !== "convite" || !cur.conv || cur.conv[pid] !== true) return; delete cur.conv[pid]; cur.vai = cur.vai || {}; cur.vai[pid] = true; return cur; })
    .then(ok => { toast(ok ? "Bora! 🚗 Esperando sair..." : "Esse convite já era."); });
}
function recusarPasseio(){ txn("casa/passeio", cur => { if (!cur || cur.estado !== "convite" || !cur.conv || cur.conv[pid] !== true) return; cur.conv[pid] = false; return cur; }); }
function cancelarPasseio(){ txn("casa/passeio", cur => { if (!cur || cur.estado !== "convite") return; cur.estado = "cancelado"; cur.fimAt = srvNow(); return cur; }); }
function partir(){
  if (psPartindo && Date.now() - psPartindo < 5000) return; psPartindo = Date.now();
  if (!passeio || passeio.estado !== "convite" || passeio.por !== pid) return;
  if (!gastar(PS_GAS, "a gasolina")){ cancelarPasseio(); return; }
  txn("casa/passeio", cur => { if (!cur || cur.estado !== "convite" || cur.por !== pid) return; cur.estado = "viajando"; cur.ini = srvNow(); delete cur.conv; return cur; })
    .then(ok => { if (!ok){ ganhar(PS_GAS); return; } toast("-$" + PS_GAS + " de gasolina. Partiu! 🚗💨"); });
}
function escolherDestino(d){
  if (!DESTINOS[d]) return;
  txn("casa/passeio", cur => { if (!cur || cur.estado !== "viajando" || !cur.vai || !cur.vai[pid]) return; cur.destino = d; cur.foram = cur.foram || {}; cur.foram[d] = true; cur.destIni = srvNow(); cur.ativ = null; return cur; })
    .then(ok => { if (ok) sfx("porta"); });
}
const FRASES_ATIV = { castelo: "Castelo pronto 🏰", mergulho: "Que água boa! 🌊", picole: "Picolé de morango 🍦", banho: "Que geladinha! 💦", pedras: "Pulou todas! 🪨", piquenique: "Piquenique delícia 🧺",
  sorvete: "Sorvete de casquinha 🍨", fogos: "Uaaau! 🎆", dancar: "Dança na rua 💃", colher: "Um girassol pra levar 🌻", coroa: "Coroa de flores 👑", correr: "Correndo no campo 🏃", roda: "Lá de cima dá pra ver tudo 🎡", algodao: "Algodão-doce 🍭", carrossel: "Upa, cavalinho! 🎠" };
function fazerAtivPasseio(aid){ // v49: era fazerAtiv, mas o 27-bairro tem outra fazerAtiv(c, a) que sobrescrevia esta
  if (!emViagem() || !passeio.destino) return;
  ref("casa/passeio/ativ/" + pid).set({ id: aid, at: TS() }).catch(() => {});
  const k = passeio.ini + ":" + passeio.destino + ":" + aid;
  if (!psAtivFeito.has(k)){ psAtivFeito.add(k); ganharNeeds({ diversao: 12, social: 6 }); }
  toast(FRASES_ATIV[aid] || "Que legal!"); sfx("pop");
}
function voltarDoPasseio(){
  txn("casa/passeio", cur => { if (!cur || cur.estado !== "viajando" || !cur.vai || !cur.vai[pid]) return; cur.estado = "fim"; cur.fimAt = srvNow(); return cur; });
}
function vagaPorta(i){ // i-ésimo lugar livre mais perto do carro (cada um aparece num quadrado)
  const cp = carroPos() || { tx: 9, ty: HC - 1 }, l = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (walkable(x, y)) l.push([x, y, Math.abs(x - cp.tx) + Math.abs(y - (cp.rua ? HC : cp.ty)) + x * .001]);
  l.sort((a, b) => a[2] - b[2]);
  const v = l[Math.min(i || 0, l.length - 1)]; return v ? [v[0], v[1]] : freeSpot();
}
function chegarEmCasa(p){
  if (!me) return;
  if (andarAtual !== 0 && typeof trocarAndar === "function") trocarAndar(0, true);
  const [x, y] = vagaPorta(Math.max(0, Object.keys(p.vai || {}).sort().indexOf(pid))); me.tx = me.px = x; me.ty = me.py = y; me.path = []; me.plano = null; me.dir = "down"; savePos();
  ganharNeeds({ diversao: 30, social: 25, energia: -15 });
  toast("De volta em casa! 🚗 Que passeio bom 💞");
  txn("casa/passeio/contado", c => c ? undefined : true).then(ok => {
    if (!ok) return;
    statMais("passeios"); xpCasal(12);
    const em = Object.keys(p.foram || {}).map(k => DESTINOS[k] && DESTINOS[k].em).filter(Boolean)[0] || "🚗";
    historia("passeio_" + p.ini, em, nomesLista(Object.keys(p.vai || {}).map(nomeDe)) + (Object.keys(p.vai || {}).length > 1 ? " foram " : " foi ") + destinosTxt(p));
  });
}
function aoMudarPasseio(novo){
  const ant = passeio; passeio = novo;
  if (psCarregado && me && novo){
    const meu = psVai(pid), nomes = psNomes();
    if (novo.estado === "convite" && novo.conv && novo.conv[pid] === true && !(ant && ant.conv && ant.conv[pid] === true)){ toast(nomeDe(novo.por) + " te chamou pra passear de carro 🚗"); sfx("notif"); }
    if (ant && novo.por === pid && novo.estado === "convite" && novo.conv && ant.conv) for (const [id, v] of Object.entries(ant.conv)) if (v === true && novo.conv[id] === false) toast(nomeDe(id) + " não pode agora.");
    if (novo.estado === "viajando" && (!ant || ant.estado !== "viajando")){
      if (meu){ closeMenu(); closePanel(); if (mode !== "live") setMode("live"); me.path = []; me.plano = null; if (me.acao) setAcao(null); sfx("porta"); }
      else toast(nomes + vb(" saiu", " saíram") + " de carro 🚗");
    }
    if (novo.estado === "viajando" && novo.destino && (!ant || ant.destino !== novo.destino) && !meu){ const d = DESTINOS[novo.destino]; if (d) toast(nomes + vb(" foi ", " foram ") + d.txt + " " + d.em); }
    if (novo.estado === "fim" && ant && ant.estado === "viajando" && !meu) toast(nomes + vb(" voltou", " voltaram") + " do passeio 🚗");
    if (novo.estado === "cancelado" && ant && ant.estado === "convite" && (novo.por === pid || (ant.vai && ant.vai[pid])) && novo.por !== pid) toast("O passeio ficou pra próxima 🚗");
  }
  psCarregado = true;
  if (me && passeio && passeio.estado === "fim" && psVai(pid) && psFeito !== passeio.ini && srvNow() - (passeio.fimAt || 0) < 15000){ psFeito = passeio.ini; chegarEmCasa(passeio); }
  syncViagemUI(); if (typeof renderBannerJogo === "function") renderBannerJogo();
}
function vigiarPasseio(){
  if (!me || !psCarregado || !passeio || visitando) return;
  const t = srvNow(), p = passeio;
  if (p.estado === "convite"){
    const pend = Object.entries(p.conv || {}).filter(([, v]) => v === true), aceitos = Object.keys(p.vai || {}).length;
    if (p.por === pid){
      if (!pend.length && aceitos > 0 && (Object.keys(p.conv || {}).length === 0 || aceitos > 1)) partir();
      else if (!pend.length) { cancelarPasseio(); toast("Ninguém pôde ir… fica pra próxima 🚗"); }
      else if (t - (p.criado || 0) > PS_CONVITE){ if (aceitos > 1) partir(); else { cancelarPasseio(); toast("Ninguém respondeu… fica pra próxima 🚗"); } }
    } else if (t - (p.criado || 0) > PS_CONVITE + 30000) cancelarPasseio();
  } else if (p.estado === "viajando"){
    const alguem = Object.keys(p.vai || {}).some(id => jogadores[id] && jogadores[id].online);
    if (alguem) psSemNinguem = 0; else if (!psSemNinguem) psSemNinguem = Date.now();
    if ((psSemNinguem && Date.now() - psSemNinguem > 60000) || t - (p.ini || 0) > 3 * HORA) txn("casa/passeio", cur => { if (!cur || cur.estado !== "viajando") return; cur.estado = "fim"; cur.fimAt = srvNow(); return cur; });
  } else if ((p.estado === "fim" || p.estado === "cancelado") && t - (p.fimAt || p.criado || 0) > 20000){
    txn("casa/passeio", cur => cur && (cur.estado === "fim" || cur.estado === "cancelado") && srvNow() - (cur.fimAt || cur.criado || 0) > 20000 ? null : undefined);
  }
  if (p.estado === "fim" && psVai(pid) && psFeito !== p.ini && t - (p.fimAt || 0) < 15000){ psFeito = p.ini; chegarEmCasa(p); }
}
function bannerLeva10(){
  if (!me || !passeio || visitando) return null;
  const p = passeio;
  if (p.estado === "convite" && p.conv && p.conv[pid] === true)
    return { key: "p" + p.criado, partes: () => { const bb = el("div", "bb"); bb.append(btn("Bora! 🚗", "btn small", aceitarPasseio), btn("Agora não", "btn ghost small", recusarPasseio)); return [el("span", null, nomeDe(p.por) + " te chamou pra passear de carro 🚗"), bb]; } };
  if (p.estado === "convite" && p.por === pid){
    const pend = Object.entries(p.conv || {}).filter(([, v]) => v === true).map(([id]) => nomeDe(id));
    return { key: "w" + p.criado + pend.join(","), partes: () => { const bb = el("div", "bb"); bb.append(btn("Partir já", "btn small", partir), btn("Cancelar", "btn ghost small", cancelarPasseio)); return [el("span", null, pend.length ? "Passeio: esperando " + nomesLista(pend) + "… 🚗" : "Saindo... 🚗"), bb]; } };
  }
  return null;
}
// ---- a viagem: card no lugar do HUD e cena desenhada no canvas do jogo ----
const viagemCard = el("div", "card viagem10"); viagemCard.id = "viagemCard"; viagemCard.hidden = true; viagemCard.setAttribute("aria-live", "polite");
$("stage").after(viagemCard);
function syncViagemUI(){
  const on = emViagem(), saindo = on && !viagemOn();
  document.body.classList.toggle("viajando", on);
  const p = passeio, sig = on ? [saindo, p.destino || "", psIds().join(","), Object.keys(p.foram || {}).join(",")].join("|") : "";
  if (sig === psUltSig) return; psUltSig = sig;
  viagemCard.hidden = !on; viagemCard.textContent = "";
  if (!on) return;
  if (saindo){ viagemCard.append(el("h2", null, "Saindo de carro… 🚗💨"), el("p", "muted", "Com " + psNomes() + ".")); return; }
  const d = DESTINOS[p.destino];
  if (!d){
    viagemCard.append(el("h2", null, "Pra onde vamos? 🚗"), el("p", "muted", "Na estrada com " + psNomes() + ". Qualquer um escolhe."));
    const g = el("div", "dest10");
    for (const [k, v] of Object.entries(DESTINOS)){ const b = btn("", "btn ghost escolha", () => escolherDestino(k)); b.append(el("strong", null, v.em + " " + v.nome), el("small", null, (p.foram || {})[k] ? "Já foram hoje" : "Ir " + v.txt)); g.append(b); }
    viagemCard.append(g, btn("🏠 Voltar pra casa", "btn ghost", voltarDoPasseio));
    return;
  }
  viagemCard.append(el("h2", null, d.em + " " + d.nome), el("p", "muted", "Com " + psNomes() + "."));
  const at = el("div", "hbtns"); for (const [aid, nome] of d.ativ) at.append(btn(nome, "btn", () => fazerAtivPasseio(aid)));
  const bb = el("div", "hbtns"); bb.append(btn("📸 Foto", "btn ghost", fotoViagem), btn("🗺️ Outro destino", "btn ghost", () => txn("casa/passeio", cur => { if (!cur || cur.estado !== "viajando" || !cur.vai || !cur.vai[pid]) return; cur.destino = null; cur.ativ = null; return cur; })), btn("🏠 Voltar pra casa", "btn ghost", voltarDoPasseio));
  viagemCard.append(at, bb);
}
// ---- cenas (288 x 208, desenhadas em cima do céu quando a cena é mais alta) ----
const cenaCache = new Map();
let cidadeJan = [];
const CENAS = {
  praia: {
    ceu: "#6EC1EC",
    bg(){
      faixas(["#6EC1EC", "#86CBEF", "#9FD6F2", "#BAE2F5"], 0, 92);
      disco(232, 30, 13, "#FFE9A0"); disco(232, 30, 10, "#FFF6CF");
      nuvem(36, 24, 24); nuvem(128, 44, 16); nuvem(186, 14, 12);
      R(0, 92, 288, 48, "#3C9ED4"); R(0, 92, 288, 3, "#2E86BE"); R(0, 95, 288, 1, "#5AB2DE");
      for (let i = 0; i < 40; i++){ const h = hash(i, 3, 9); P(h % 288, 98 + (h >>> 9) % 38, "#7CC6EA"); }
      R(0, 140, 288, 68, "#F2D6A0"); R(0, 140, 288, 4, "#E3C08A");
      for (let i = 0; i < 140; i++){ const h = hash(i, 7, 2); P(h % 288, 146 + (h >>> 9) % 60, i % 2 ? "#E2BF84" : "#FBE8C4"); }
      // coqueiro
      for (let i = 0; i < 64; i += 4){ const x = 22 + Math.round(Math.sin(i / 34) * 8); R(x, 196 - i - 4, 6, 4, i % 8 ? "#B5814F" : "#8C5E3A"); R(x + 4, 196 - i - 4, 2, 4, "#8C5E3A"); }
      const tx = 30, ty = 130;
      for (const [dx, dy] of [[1, 0], [-1, 0], [1, .5], [-1, .5], [.3, -1]]) for (let k = 0; k < 13; k++) R(tx + Math.round(dx * k * 2), ty + Math.round(dy * k * 2 + k * k * .09), 4, 3, k % 3 ? "#4FA568" : "#35804F");
      disco(tx + 1, ty + 4, 2, "#8C5E3A"); disco(tx + 5, ty + 5, 2, "#6B4429");
      // guarda-sol e toalha
      R(244, 140, 2, 46, "#FFFFFF"); R(245, 140, 1, 46, "#D3DAE1");
      for (let dy = 0; dy < 11; dy++){ const w = Math.round(20 * Math.sqrt(1 - Math.pow((10 - dy) / 11, 2))); for (let xx = -w; xx <= w; xx++) P(245 + xx, 130 + dy, Math.floor((xx + 21) / 7) % 2 ? "#E8445E" : "#FFFFFF"); }
      for (let xx = -20; xx <= 20; xx += 7) R(245 + xx, 141, 4, 1, "#C23A52");
      rbox(214, 184, 26, 9, "#7FB8E8"); R(214, 187, 26, 2, "#FFFFFF");
      rbox(70, 196, 5, 4, "#F49AAE"); P(71, 196, "#FFFFFF"); P(196, 168, "#F6A04D"); P(195, 169, "#F6A04D"); P(197, 169, "#F6A04D"); P(196, 170, "#F6A04D");
    },
    anim(tm){
      for (const [row, sp, c] of [[100, 40, "#9FD6F2"], [113, 55, "#BFE6F7"], [126, 70, "#D8F0FA"]]) for (let i = 0; i < 9; i++){ const x = ((i * 37 + tm / sp) % 320) - 16; R(Math.round(x), row + Math.round(Math.sin(tm / 500 + i)), 7, 1, c); }
      for (let x = 0; x < 288; x += 4){ const y = 139 + Math.round(Math.sin(x / 17 + tm / 650) * 1.6); R(x, y, 4, 2, "#FFFFFF"); R(x, y + 2, 4, 1, "#E8CDA0"); }
      const gx = Math.round((tm / 45) % 340 - 30), gy = Math.round(54 + Math.sin(tm / 700) * 4), fl = Math.floor(tm / 220) % 2;
      P(gx - 2, gy - 1 + fl, "#FFFFFF"); P(gx - 1, gy, "#FFFFFF"); P(gx, gy, "#FFFFFF"); P(gx + 1, gy, "#FFFFFF"); P(gx + 2, gy - 1 + fl, "#FFFFFF");
    }
  },
  cachoeira: {
    ceu: "#8FD0E6",
    bg(){
      faixas(["#8FD0E6", "#A6DAEA", "#C2E6EE"], 0, 52);
      for (const [x0, x1] of [[0, 120], [170, 288]]) for (let x = x0; x < x1; x += 4){
        const top = 28 + hash(x, 1, 1) % 10 + (x0 ? Math.round((x - 170) / 12) : Math.round((120 - x) / 14));
        R(x, top, 4, 152 - top, "#857A72"); R(x, top - 3, 4, 4, "#5DAA5E"); if (hash(x, 2, 2) % 3 === 0) R(x, top + 6 + hash(x, 4, 4) % 40, 3, 2, "#9C918A");
        if (hash(x, 3, 3) % 4 === 0) R(x, top + 12 + hash(x, 5, 5) % 60, 4, 1, "#6E645E");
      }
      for (const [cx, cy, r] of [[18, 26, 12], [48, 18, 10], [90, 30, 9], [196, 34, 10], [236, 22, 13], [270, 36, 9]]){ R(cx - 1, cy + r - 2, 3, 8, "#6B4429"); disco(cx, cy, r, "#3F8F56"); disco(cx - 2, cy - 2, r - 4, "#5DB070"); P(cx - 4, cy - 5, "#8AD490"); }
      R(120, 30, 50, 122, "#7CC8E8"); R(120, 30, 2, 122, "#A9DDF2"); R(168, 30, 2, 122, "#5FA9CC");
      R(0, 148, 288, 60, "#78B860");
      R(30, 148, 228, 34, "#4FA6D4"); R(30, 148, 228, 3, "#3F8FB0");
      for (let x = 28; x < 260; x += 9){ rbox(x, 178 + hash(x, 6, 6) % 3, 9, 5, "#A39A92"); P(x + 2, 179, "#C9C2B8"); }
      for (let i = 0; i < 50; i++){ const h = hash(i, 8, 8); const x = h % 288, y = 186 + (h >>> 9) % 20; P(x, y, "#5E9E45"); P(x, y - 1, "#8FC46F"); }
      for (const [x, y, c] of [[14, 192, "#F9B8CC"], [262, 196, "#FFE08A"], [40, 202, "#FFFFFF"], [230, 188, "#C9B6F2"]]){ P(x, y, c); P(x - 1, y + 1, c); P(x + 1, y + 1, c); P(x, y + 1, "#F6C667"); }
    },
    anim(tm){
      for (let i = 0; i < 12; i++){ const x = 122 + i * 4, off = (tm / 35 + i * 9) % 20; for (let k = -1; k < 7; k++){ const y = Math.round(30 + k * 20 + off); if (y < 30 || y > 144) continue; R(x, y, 2, 7, "#D6F1FB"); } }
      for (let i = 0; i < 16; i++){ const a = tm / 280 + i * 1.3, r = 4 + (i % 4) * 5; R(Math.round(145 + Math.cos(a) * r * 1.8), Math.round(151 + Math.sin(a) * 2), 2, 2, "#FFFFFF"); }
      for (let k = 0; k < 3; k++){ const r = (tm / 30 + k * 20) % 60; R(Math.round(145 - r * 1.6), 158 + k * 6, 8, 1, "#9FD3EE"); R(Math.round(145 + r * 1.6 - 8), 158 + k * 6, 8, 1, "#9FD3EE"); }
      const bx = Math.round(60 + Math.sin(tm / 900) * 30), by = Math.round(110 + Math.sin(tm / 400) * 8), f = Math.floor(tm / 180) % 2;
      P(bx, by, "#2E2638"); P(bx - 1, by - f, "#F49AAE"); P(bx + 1, by - f, "#F49AAE"); P(bx - 1, by + 1, "#F9C9D6"); P(bx + 1, by + 1, "#F9C9D6");
    }
  },
  cidade: {
    ceu: "#13113A",
    bg(){
      faixas(["#13113A", "#191645", "#211C52", "#2B235F", "#372B6B"], 0, 170);
      disco(44, 32, 10, "#FFF3C4"); disco(49, 28, 9, "#191645");
      cidadeJan = [];
      let x = -4, i = 0;
      while (x < 288){
        const h = hash(x + 9, 5, 5), w = 22 + h % 20, ht = 46 + (h >>> 5) % 84, cor = ["#1C1934", "#231F40", "#2A2449", "#19162E"][h % 4];
        R(x, 170 - ht, w, ht, cor); R(x, 170 - ht, w, 1, sh(cor, .35)); R(x, 170 - ht, 1, ht, sh(cor, .15)); R(x + w - 2, 170 - ht, 2, ht, sh(cor, -.2));
        if (h % 3 === 0){ R(x + Math.floor(w / 2), 170 - ht - 6, 1, 6, "#4A4258"); }
        for (let wy = 170 - ht + 5; wy < 162; wy += 6) for (let wx = x + 3; wx < x + w - 4; wx += 5){ R(wx, wy, 2, 3, "#14122A"); cidadeJan.push([wx, wy, hash(wx, wy, 1)]); }
        if (i === 3) { R(x + 2, 170 - ht + 2, w - 6, 9, "#1E1A36"); }
        x += w + 2; i++;
      }
      R(0, 170, 288, 12, "#5B5470"); R(0, 170, 288, 1, "#7A7290"); R(0, 181, 288, 1, "#7A7290");
      R(0, 182, 288, 26, "#2E2A3C"); for (let x2 = 4; x2 < 288; x2 += 20) R(x2, 195, 10, 1, "#E8C860");
      for (const lx of [64, 224]){ R(lx, 130, 2, 40, "#4A4258"); rbox(lx - 3, 126, 8, 5, "#4A4258"); R(lx - 2, 130, 6, 1, "#FFE9A0"); }
    },
    anim(tm){
      for (let i = 0; i < 26; i++){ const h = hash(i, 11, 3); if ((Math.floor(tm / 520) + i) % 6 === 0) continue; P(h % 288, (h >>> 9) % 80, i % 3 ? "#FFFFFF" : "#FFE9A0"); }
      const ciclo = Math.floor(tm / 2600);
      for (const [x, y, h] of cidadeJan) if ((h + ciclo * 7) % 5 > 1) R(x, y, 2, 3, h % 7 === 0 ? "#9FD3F2" : "#F6D77A");
      if (Math.floor(tm / 650) % 3) pixHeart(120, 74, "#FF7AB0");
      const cx = Math.round((tm / 14) % 420) - 60; rbox(cx, 186, 18, 6, "#7FB8E8"); R(cx + 4, 184, 9, 3, "#5A8FC8"); R(cx + 17, 188, 2, 2, "#FFF0A0"); R(cx + 2, 191, 3, 2, "#1E1A2A"); R(cx + 13, 191, 3, 2, "#1E1A2A");
      ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = .55;
      for (const lx of [64, 224]){ const s = luzSpr("255,214,150", 30, 1); ctx.drawImage(s, lx + 1 - 21, 132 - 21, 42, 42); }
      ctx.globalAlpha = .35; ctx.drawImage(luzSpr("255,122,176", 22, 1), 122 - 15, 76 - 15, 30, 30);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
  },
  girassois: {
    ceu: "#76C0EE",
    bg(){
      faixas(["#76C0EE", "#8ECBF0", "#A8D7F2", "#C4E4F3"], 0, 102);
      disco(246, 26, 12, "#FFE9A0"); disco(246, 26, 9, "#FFF6CF");
      for (let x = 0; x < 288; x++){ const y = Math.round(100 + Math.sin(x / 40) * 5 + Math.sin(x / 17) * 2); R(x, y, 1, 114 - y, "#8FC46F"); P(x, y, "#A8D486"); }
      R(0, 112, 288, 96, "#5E9E45");
      for (let i = 0; i < 90; i++){ const h = hash(i, 13, 1); R(h % 288, 114 + (h >>> 9) % 94, 3, 1, "#4F8A3B"); }
      for (let y = 112; y < 208; y++){ const half = Math.round(6 + (y - 112) * .45); R(144 - half, y, half * 2, 1, "#D9C08A"); if (y % 5 === 0){ P(144 - half + (y * 7) % (half * 2), y, "#C4A970"); } }
    },
    anim(tm){
      for (let i = 0; i < 3; i++) nuvem(((tm / (170 + i * 50)) + i * 110) % 380 - 50, 16 + i * 13, 18 + i * 4);
      for (let i = 0; i < 46; i++){
        const h = hash(i, 9, 9), x = h % 288, y = 117 + (h >>> 9) % 28; if (Math.abs(x - 144) < 9 + (y - 112) * .45) continue;
        const s = Math.round(Math.sin(tm / 900 + i * .6)); R(x, y, 1, 4, "#3E7A34"); R(x - 1 + s, y - 3, 3, 3, "#F7C93E"); P(x + s, y - 2, "#7A4A22");
      }
      for (let i = 0; i < 18; i++){
        const lado = i % 2 ? 1 : -1, k = Math.floor(i / 2), y = 158 + (k % 5) * 11 + (hash(i, 2, 7) % 4), half = 6 + (y - 112) * .45;
        const x = Math.round(144 + lado * (half + 12 + (k * 23 + hash(i, 4, 7) % 9) % 100)); if (x < -6 || x > 294) continue;
        const s = Math.round(Math.sin(tm / 800 + i * .9) * 1.2), hx = x + 1 + s, hy = y - 17;
        R(x, y - 14, 2, 14, "#3E7A34"); R(x + 2, y - 8, 3, 2, "#4F9A3E"); R(x - 3, y - 5, 3, 2, "#4F9A3E");
        R(hx - 4, hy - 2, 9, 5, "#F7C93E"); R(hx - 2, hy - 4, 5, 9, "#F7C93E"); R(hx - 3, hy - 3, 7, 7, "#F7C93E"); P(hx - 3, hy - 3, "#FFE08A");
        rbox(hx - 2, hy - 2, 5, 5, "#7A4A22"); P(hx - 1, hy - 1, "#9A6232");
      }
      for (let k = 0; k < 2; k++){ const bx = Math.round(144 + Math.sin(tm / 700 + k * 2) * 70), by = Math.round(132 + Math.sin(tm / 350 + k) * 10); R(bx, by, 2, 1, "#F7C93E"); P(bx + 2, by, "#2E2638"); P(bx + 1, by - 1 - Math.floor(tm / 90) % 2, "#FFFFFF"); }
    }
  },
  parque: {
    ceu: "#3E2F7E",
    bg(){
      faixas(["#3E2F7E", "#5E3C8E", "#8A4A98", "#BE5E92", "#E98A86", "#F5B486"], 0, 168);
      const cx = 200, cy = 80;
      for (let t = 0; t <= 1; t += .01){ R(Math.round(cx + (176 - cx) * t), Math.round(cy + (168 - cy) * t), 2, 1, "#E8E2F0"); R(Math.round(cx + (224 - cx) * t), Math.round(cy + (168 - cy) * t), 2, 1, "#E8E2F0"); }
      for (let a = 0; a < Math.PI * 2; a += .02){ P(Math.round(cx + Math.cos(a) * 52), Math.round(cy + Math.sin(a) * 52), "#F1EDF7"); P(Math.round(cx + Math.cos(a) * 51), Math.round(cy + Math.sin(a) * 51), "#C9C0E0"); P(Math.round(cx + Math.cos(a) * 20), Math.round(cy + Math.sin(a) * 20), "#E8E2F0"); }
      // carrossel
      rbox(16, 150, 92, 10, "#E8735F"); R(17, 150, 90, 2, "#F4A08E");
      for (let x = 22; x < 104; x += 20) R(x, 120, 2, 30, "#F6C667");
      for (let dy = 0; dy < 22; dy++){ const w = Math.round(6 + dy * 2.1); for (let xx = -w; xx <= w; xx++) P(62 + xx, 100 + dy, Math.floor((xx + 60) / 6) % 2 ? "#F49AAE" : "#FFFFFF"); }
      R(61, 92, 2, 8, "#F6C667"); R(63, 92, 5, 3, "#E8445E");
      // barraca de algodão-doce
      rbox(238, 140, 42, 26, "#F9C9D6"); R(239, 140, 40, 2, "#FFFFFF");
      for (let xx = 0; xx < 46; xx++) R(236 + xx, 128, 1, 8, Math.floor(xx / 6) % 2 ? "#E8607A" : "#FFFFFF");
      R(240, 136, 2, 6, "#D9708C"); R(276, 136, 2, 6, "#D9708C");
      for (const [x, y] of [[248, 146], [258, 144], [268, 147]]){ disco(x, y, 3, "#F49AAE"); R(x, y + 3, 1, 6, "#FFF4E0"); }
      R(0, 168, 288, 40, "#D8B98C"); R(0, 166, 288, 2, "#7FB86A");
      for (let i = 0; i < 70; i++){ const h = hash(i, 17, 5); P(h % 288, 170 + (h >>> 9) % 36, i % 2 ? "#C4A370" : "#E9D2A8"); }
    },
    anim(tm){
      const cx = 200, cy = 80, a0 = tm / 5000;
      for (let k = 0; k < 8; k++){ const a = a0 + k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); for (let r = 4; r < 51; r += 1.5) P(Math.round(cx + c * r), Math.round(cy + s * r), "#D8D0EA"); }
      disco(cx, cy, 4, "#F6C667");
      const on = Math.floor(tm / 320);
      for (let k = 0; k < 16; k++){ const a = a0 + k * Math.PI / 8; P(Math.round(cx + Math.cos(a) * 52), Math.round(cy + Math.sin(a) * 52), (on + k) % 2 ? "#FFE9A0" : "#FF7AB0"); }
      const cores = ["#E8445E", "#7FB8E8", "#F6C667", "#7FD1B2"];
      for (let k = 0; k < 8; k++){
        if (k === 0 && rodaAgora()) continue;
        const a = a0 + k * Math.PI / 4 + Math.PI / 8, gx = Math.round(cx + Math.cos(a) * 52), gy = Math.round(cy + Math.sin(a) * 52);
        R(gx, gy, 1, 3, "#D8D0EA"); rbox(gx - 4, gy + 3, 9, 7, cores[k % 4]); R(gx - 3, gy + 4, 7, 2, "#BFE6F7");
      }
      for (let k = 0; k < 4; k++){ const hx = 26 + k * 20, hy = 136 + Math.round(Math.sin(tm / 300 + k * 1.5) * 3); rbox(hx - 1, hy, 9, 5, "#FFFFFF"); R(hx + 6, hy - 3, 3, 4, "#FFFFFF"); P(hx + 8, hy - 2, "#2E2638"); R(hx, hy + 5, 1, 3, "#FFFFFF"); R(hx + 6, hy + 5, 1, 3, "#FFFFFF"); R(hx + 1, hy - 1, 3, 1, ["#E8445E", "#7FB8E8", "#F6C667", "#B49CF4"][k]); }
      for (let k = 0; k < 13; k++) P(22 + k * 7, 121, (on + k) % 2 ? "#FFE9A0" : "#FF7AB0");
      for (let k = 0; k < 24; k++){ const x = k * 12 + 6, y = 8 + Math.round(Math.sin(k * .5) * 3 + Math.abs(Math.sin(k * .26)) * 6); P(x, y, ["#FFE9A0", "#FF7AB0", "#7FD1B2", "#7FB8E8"][(k + on) % 4]); P(x, y + 1, "#2E2638"); }
    }
  }
};
function rodaAgora(){ return !!passeio && Object.values(passeio.ativ || {}).some(a => a && a.id === "roda" && srvNow() - (a.at || 0) < 7000); }
function cenaBg(d){
  const k = d + "|" + lo.height; let c = cenaCache.get(k); if (c) return c;
  c = document.createElement("canvas"); c.width = W * T; c.height = lo.height;
  const oy = c.height - 208;
  withCtx(c.getContext("2d"), 1, () => { R(0, 0, W * T, c.height, CENAS[d].ceu); ctx.save(); ctx.translate(0, oy); CENAS[d].bg(); ctx.restore(); });
  if (cenaCache.size > 12) cenaCache.clear();
  cenaCache.set(k, c); return c;
}
function cenaEstrada(tm){ // escolhendo o destino: o carrinho na estrada
  faixas(["#7EC4F0", "#97D0F2", "#B4DDF4"], 0, 120); nuvem(((tm / 60) % 380) - 40, 30, 22); nuvem(((tm / 90 + 200) % 380) - 40, 52, 14);
  for (let x = 0; x < 288; x += 2){ const y = Math.round(116 + Math.sin((x + tm / 25) / 30) * 6); R(x, y, 2, 160 - y, "#8FC46F"); }
  R(0, 150, 288, 58, "#6FA94E"); R(0, 160, 288, 30, "#4A4458"); R(0, 160, 288, 2, "#D3DAE1"); R(0, 188, 288, 2, "#D3DAE1");
  for (let k = 0; k < 12; k++){ const x = Math.round(((k * 30 - tm / 6) % 360 + 360) % 360) - 40; R(x, 174, 14, 2, "#F6E7A0"); }
  for (let k = 0; k < 5; k++){ const x = Math.round(((k * 80 - tm / 10) % 400 + 400) % 400) - 40; R(x + 4, 140, 3, 12, "#6B4429"); disco(x + 5, 134, 9, "#3F8F56"); disco(x + 3, 132, 5, "#5DB070"); }
  const bob = Math.floor(tm / 150) % 2, s = carroSpr(Math.floor(tm / 90) % 2).c;
  ctx.drawImage(s, 112, 146 + bob, s.width * 2, s.height * 2);
  cabecinhas(114, 148 + bob, psIds(), 2);
}
function bonecosViagem(d, tm){
  const D = DESTINOS[d], ids = psIds(), n = ids.length, t = srvNow();
  ids.forEach((id, i) => {
    const j = jogadores[id]; if (!j) return;
    const a = (passeio.ativ || {})[id], aid = a && t - (a.at || 0) < 6000 ? a.id : "";
    let x = Math.round(D.x + (i - (n - 1) / 2) * 22), by = D.chao, pose = Math.floor((tm + i * 700) / 2200) % 6 === 0 ? "blink" : Math.floor((tm + i * 400) / 800) % 2 ? "breath" : "stand", dir = "down", frame = 0;
    const jv = avDe(id, j);
    if (aid === "mergulho"){ const yb = 136 + Math.round(Math.sin(tm / 300 + i) * 1.5), xs = 150 + i * 24; ctx.save(); ctx.beginPath(); ctx.rect(xs - 10, 100, 20, yb - 112); ctx.clip(); blitAvatar(jv, xs, yb, "down", 0, pose); ctx.restore(); R(xs - 7, yb - 13, 14, 1, "#D8F0FA"); if (Math.floor(tm / 300) % 3 === 0){ P(xs - 8, yb - 15, "#FFFFFF"); P(xs + 8, yb - 16, "#FFFFFF"); } posNome[id] = [xs, yb - 10]; return; }
    if (aid === "banho"){ const xs = 138 + i * 14, yb = 170; ctx.save(); ctx.beginPath(); ctx.rect(xs - 10, 120, 20, 40); ctx.clip(); blitAvatar(jv, xs, yb, "down", 0, "arms"); ctx.restore(); R(xs - 8, 159, 16, 2, "#D6F1FB"); for (let k = 0; k < 4; k++) P(xs - 4 + k * 3, 140 + ((tm / 40 + k * 5) % 14), "#FFFFFF"); posNome[id] = [xs, 150]; return; }
    if (aid === "roda"){ const a0 = tm / 5000 + Math.PI / 8, gx = Math.round(200 + Math.cos(a0) * 52), gy = Math.round(80 + Math.sin(a0) * 52); if (i === 0){ R(gx, gy, 1, 3, "#D8D0EA"); rbox(gx - 9, gy + 3, 19, 10, "#E8445E"); } ctx.save(); ctx.beginPath(); ctx.rect(gx - 8, gy + 3, 17, 6); ctx.clip(); blitAvatar(jv, gx - 4 + (i % 2) * 8, gy + 21, "down", 0, pose); ctx.restore(); R(gx - 8, gy + 9, 17, 1, "#C23A52"); posNome[id] = [gx, gy - 4]; return; }
    if (aid === "carrossel"){ const k = i % 4, hx = 26 + k * 20, hy = 136 + Math.round(Math.sin(tm / 300 + k * 1.5) * 3); blitAvatar(jv, hx + 4, hy + 3, "down", 0, "sitblink"); posNome[id] = [hx + 4, hy - 22]; return; }
    if (aid === "correr"){ const ph = tm / 600 + i; x = Math.round(144 + Math.sin(ph) * 34 + (i - (n - 1) / 2) * 10); dir = Math.cos(ph) > 0 ? "right" : "left"; frame = Math.floor(tm / 115) % 4; pose = "stand"; }
    if (aid === "pedras"){ const ph = (tm / 260 + i * 1.7) % (Math.PI * 2); by -= Math.round(Math.abs(Math.sin(ph)) * 8); x += Math.round(Math.sin(tm / 520 + i) * 12); dir = "right"; frame = 1; for (let k = -1; k <= 1; k++) rbox(Math.round(D.x + (i - (n - 1) / 2) * 22) + k * 12 - 4, D.chao - 1, 8, 3, "#A39A92"); }
    if (aid === "piquenique" && i === 0){ rbox(Math.round(D.x - 22), by - 6, 44 + (n - 1) * 8, 9, "#E8445E"); for (let xx = 0; xx < 44; xx += 4) R(Math.round(D.x - 22) + xx, by - 6, 2, 9, "#FFFFFF"); rbox(Math.round(D.x + 16), by - 12, 8, 7, "#C08A5A"); R(Math.round(D.x + 17), by - 14, 6, 1, "#8C5E3A"); }
    if (aid === "piquenique"){ pose = Math.floor((tm + i * 500) / 650) % 3 === 2 ? "siteat" : "sit"; frame = pose === "siteat" ? 1 : 0; by -= 2; }
    if (aid === "dancar"){ pose = Math.floor(tm / 260) % 2 ? "arms" : "stand"; frame = Math.floor(tm / 260) % 2 ? 1 : 3; if (Math.random() < .03) particles.push({ x, y: by - 24, vx: Math.random() * 8 - 4, vy: -10, life: 1.4, kind: "note" }); }
    if (aid === "fogos"){ dir = "up"; pose = "stand"; }
    if (aid === "castelo" && i === 0){ const cx = x - 26, cb = by; rbox(cx, cb - 8, 14, 8, "#E8C890"); R(cx - 1, cb - 13, 4, 5, "#E8C890"); R(cx + 11, cb - 13, 4, 5, "#E8C890"); R(cx + 5, cb - 16, 4, 8, "#E8C890"); P(cx + 6, cb - 19, "#8C5E3A"); R(cx + 7, cb - 19, 3, 2, "#E8445E"); R(cx + 6, cb - 5, 2, 3, "#C9A26A"); }
    blitAvatar(jv, x, by, dir, frame, pose);
    if (aid === "picole" || aid === "sorvete"){ const hx = x + 5, hy = by - 13; if (aid === "picole"){ R(hx, hy + 4, 1, 3, "#D2A06C"); rbox(hx - 1, hy - 1, 4, 6, "#F49AAE"); P(hx, hy, "#FFFFFF"); } else { R(hx, hy + 2, 3, 4, "#D2A06C"); P(hx + 1, hy + 6, "#D2A06C"); rbox(hx - 1, hy - 2, 5, 5, "#F9C9D6"); P(hx, hy - 1, "#FFFFFF"); } }
    if (aid === "algodao"){ R(x + 5, by - 12, 1, 6, "#FFF4E0"); disco(x + 5, by - 16, 4, "#F9C9D6"); P(x + 4, by - 18, "#FFFFFF"); }
    if (aid === "colher"){ R(x + 5, by - 20, 1, 10, "#3E7A34"); R(x + 2, by - 25, 7, 6, "#F7C93E"); rbox(x + 3, by - 24, 5, 4, "#7A4A22"); }
    if (aid === "coroa"){ const hy = by - 19; for (let k = -4; k <= 4; k += 2) P(x + k, hy - (Math.abs(k) < 3 ? 1 : 0), k % 4 ? "#F7C93E" : "#FFFFFF"); }
    posNome[id] = [x, by - 27];
  });
  const fogos = Object.values(passeio.ativ || {}).some(a => a && a.id === "fogos" && t - (a.at || 0) < 6000);
  if (fogos && Math.random() < .07){ const fx = 30 + Math.random() * 228, fy = 30 + Math.random() * 50, c = ["#FF7AB0", "#F6D77A", "#7FD1B2", "#9FD3F2", "#B49CF4"][Math.floor(Math.random() * 5)]; for (let k = 0; k < 14; k++){ const a = k / 14 * Math.PI * 2; particles.push({ x: fx, y: fy, vx: Math.cos(a) * 22, vy: Math.sin(a) * 22 - 6, life: 1.3, kind: "conf", cor: c, ph: k }); } }
}
const posNome = {};
function particulasCena(tm){
  for (const p of particles){
    ctx.globalAlpha = clamp(p.life, 0, 1);
    if (p.kind === "conf") R(Math.round(p.x + Math.sin(tm / 220 + p.ph) * 2), Math.round(p.y), 2, Math.floor(tm / 140 + p.ph) % 2 ? 2 : 1, p.cor);
    else if (p.kind === "heart") pixHeart(p.x - 2, p.y, "#F0707A");
    else pixNote(p.x - 2, p.y, "#CECBF6");
  }
  ctx.globalAlpha = 1;
}
function drawViagem(now){
  if (!viagemOn()) return false;
  const mctx = canvas.getContext("2d");
  ctx = lo.getContext("2d"); S = 1; ctx.imageSmoothingEnabled = false;
  const tm = Date.now(), d = passeio.destino, oy = lo.height - 208;
  for (const k in posNome) delete posNome[k];
  if (!d || !CENAS[d]){ R(0, 0, W * T, Math.max(0, oy), "#7EC4F0"); ctx.save(); ctx.translate(0, oy); cenaEstrada(tm); particulasCena(tm); ctx.restore(); }
  else { ctx.drawImage(cenaBg(d), 0, 0); ctx.save(); ctx.translate(0, oy); CENAS[d].anim(tm); bonecosViagem(d, tm); particulasCena(tm); ctx.restore(); }
  ctx.drawImage(vig, 0, 0);
  mctx.imageSmoothingEnabled = false; mctx.drawImage(lo, 0, 0, canvas.width, canvas.height);
  if (d){
    const K = canvas.width / (W * T), dpr = Math.min(window.devicePixelRatio || 1, 3), fs = Math.round(clamp(4.6 * K, 12 * dpr, 17 * dpr));
    mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.textAlign = "center"; mctx.textBaseline = "bottom"; mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1);
    for (const [id, [x, y]] of Object.entries(posNome)){ const nm = nomeDe(id); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, x * K, (y + oy) * K); mctx.fillStyle = id === pid ? "#FFFFFF" : "#E6DEFF"; mctx.fillText(nm, x * K, (y + oy) * K); }
  }
  return true;
}
function iconeDestino(d, x, y){
  if (d === "praia"){ disco(x + 3, y + 3, 3, "#F6C667"); }
  else if (d === "cachoeira"){ R(x + 2, y, 3, 6, "#7FB8E8"); R(x, y + 5, 7, 2, "#BFE6F7"); }
  else if (d === "cidade"){ disco(x + 3, y + 3, 3, "#FFF3C4"); disco(x + 4, y + 2, 2, "#FFF8EC"); }
  else if (d === "girassois"){ R(x, y + 1, 7, 5, "#F7C93E"); R(x + 1, y, 5, 7, "#F7C93E"); R(x + 2, y + 2, 3, 3, "#7A4A22"); }
  else { for (let a = 0; a < 6.28; a += .5) P(Math.round(x + 3 + Math.cos(a) * 3), Math.round(y + 3 + Math.sin(a) * 3), "#B5609E"); P(x + 3, y + 3, "#F6C667"); }
}
function fotoViagem(){
  if (!viagemOn() || !passeio.destino){ toast("Escolham um destino antes 📸"); return; }
  try { drawViagem(performance.now()); } catch(e){}
  const D = DESTINOS[passeio.destino], w = lo.width, h = lo.height, pad = 5, base = 13;
  const c = document.createElement("canvas"); c.width = w + pad * 2; c.height = h + pad + base;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  withCtx(x, 1, () => {
    R(0, 0, c.width, c.height, D.mold[0]);
    for (let i = 3; i < c.width - 3; i += 6) P(i, 2, D.mold[1]);
    for (let j = 6; j < h; j += 6){ P(2, j, D.mold[1]); P(c.width - 3, j, D.mold[1]); }
    ctx.drawImage(lo, pad, pad);
    const dt = new Date(srvNow());
    txt3(pad2(dt.getDate()) + "/" + pad2(dt.getMonth() + 1) + "/" + dt.getFullYear(), pad + 1, h + pad + 4, D.mold[0] === "#2B235F" ? "#F6D77A" : "#8C7A9A");
    iconeDestino(passeio.destino, c.width - pad - 8, h + pad + 3); pixHeart(c.width - pad - 18, h + pad + 4, "#E8607A");
  });
  const f = el("div", "flash9"); $("stage").append(f); setTimeout(() => f.remove(), 500);
  sfx("foto");
  const url = codificarFoto(c); if (!url){ toast("A foto ficou pesada demais 😅 Tente de novo."); return; }
  openFotoNova(url, c.width, c.height);
  const inp = painel && painel.el.querySelector("input"); if (inp) inp.value = D.em + " " + D.nome;
}

// =====================================================================
// 5. BAIRRO E VISITAS
// =====================================================================
function codigoDe(txt){
  txt = String(txt || "").trim(); const m = /#([^?#\s]+)/.exec(txt); let c = m ? m[1] : txt;
  try { c = decodeURIComponent(c); } catch(e){}
  c = c.trim().toLowerCase(); return /^[a-z0-9-]{10,40}$/.test(c) ? c : null;
}
function casaExiste(cod){ const r = fdb.ref("salas/" + cod + "/casa"); return Promise.all([r.child("criada").once("value"), r.child("leva1").once("value")]).then(([a, b]) => a.exists() || b.exists()); }
const nomeCasaPadrao = () => "Casa de " + nomesLista(moradores().map(([, j]) => j.nome));
function casinhaSpr(cod, luz){
  const h = [...cod].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) | 0, 7) >>> 0;
  const teto = ["#8E7CF0", "#E8735F", "#5DBB7D", "#7FB8E8", "#F49AAE", "#F6C667"][h % 6], parede = ["#FFF4E0", "#F3E3D3", "#E8F1F7", "#FBE8EF"][(h >>> 4) % 4];
  return sprite("casa10:" + (h % 24) + ":" + luz, 46, 38, (ox, oy) => {
    R(ox, oy + 34, 46, 4, "#78B860"); R(ox, oy + 34, 46, 1, "#97CE80");
    rbox(ox + 8, oy + 16, 30, 19, parede); R(ox + 9, oy + 33, 28, 1, sh(parede, -.15));
    for (let i = 0; i < 12; i++) R(ox + 6 + i, oy + 16 - i, 34 - i * 2, 1, i % 3 ? teto : sh(teto, -.15));
    R(ox + 30, oy + 4, 4, 8, "#9C6644"); R(ox + 30, oy + 4, 4, 1, "#C08A5A");
    R(ox + 20, oy + 24, 6, 10, C.woodD); P(ox + 24, oy + 29, C.gold);
    for (const wx of [11, 30]){ R(ox + wx, oy + 21, 6, 5, luz ? "#F6D77A" : "#9FC3E0"); R(ox + wx + 2, oy + 21, 1, 5, "#FFFFFF"); R(ox + wx, oy + 23, 6, 1, "#FFFFFF"); }
    disco(ox + 3, oy + 28, 4, "#3F8F56"); R(ox + 2, oy + 31, 2, 4, "#6B4429");
    R(ox + 41, oy + 28, 1, 6, "#8C5E3A"); rbox(ox + 39, oy + 25, 5, 4, "#E8445E");
  });
}
function casinhaCanvas(cod, luz){ const s = casinhaSpr(cod, luz).c, cv = el("canvas", "casa10cv"); cv.width = s.width; cv.height = s.height; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(s, 0, 0); cv.setAttribute("aria-hidden", "true"); return cv; }
const infoVizinho = new Map();
function lerVizinho(cod){
  const c = infoVizinho.get(cod); if (c && Date.now() - c.t < 30000) return Promise.resolve(c);
  const base = fdb.ref("salas/" + cod);
  return Promise.all([base.child("jogadores").once("value"), base.child("casa/nome").once("value")]).then(([js, nm]) => {
    const on = Object.values(js.val() || {}).filter(j => j && j.nome && j.online).map(j => j.nome + (j.visita ? " (visita)" : ""));
    const r = { t: Date.now(), on, nome: typeof nm.val() === "string" ? nm.val() : null }; infoVizinho.set(cod, r); return r;
  }, () => ({ t: Date.now(), on: [], nome: null, erro: 1 }));
}
function adicionarVizinho(txt, done){
  const cod = codigoDe(txt);
  if (!cod){ toast("Cole o link ou o código da casa do amigo."); done(false); return; }
  if (cod === sala){ toast("Essa é a sua casa 😉"); done(false); return; }
  if (vizinhos[cod]){ toast("Essa casa já está na rua."); done(false); return; }
  if (Object.keys(vizinhos).length >= 20){ toast("A rua já está cheia (20 casas)."); done(false); return; }
  casaExiste(cod).then(ok => {
    if (!ok){ toast("Essa casa não existe."); done(false); return; }
    return lerVizinho(cod).then(info => ref("casa/vizinhos/" + cod).set({ nome: (info.nome || "Casa do amigo").slice(0, 30), adicionado: TS(), por: pid })).then(() => { toast("Casa adicionada na rua 🏘️"); sfx("pop"); done(true); });
  }).catch(() => { toast("Não deu pra achar essa casa agora."); done(false); });
}
function irVisitar(cod){
  if (!me) return;
  if (visitando){ toast("Volte pra sua casa antes de visitar outra 😉"); return; }
  if (emViagem()){ toast("Vocês estão passeando de carro 🚗"); return; }
  const d = me.dados || {}, v = visual(d);
  store.set("casinha-visita-eu", JSON.stringify({ de: sala, nome: d.nome, corpo: v.corpo, roupa: v.roupa, traje: v.traje, cabelo: v.cabelo, estilo: v.estilo, pele: v.pele, barba: v.barba, acess: v.acess, forma: v.forma, altura: v.altura, fisico: v.fisico, needs: me.needs, dinheiro: Math.floor(me.dinheiro) }));
  closePanel();
  location.hash = cod + "?visita=" + sala;
}
function lerVisitante(){ try { const v = JSON.parse(store.get("casinha-visita-eu") || "null"); return v && typeof v.nome === "string" && v.nome ? v : null; } catch(e){ return null; } }
function visitaPid(){ const k = "casinha-vpid-" + sala; let p = store.get(k); if (!p){ p = "v" + Math.random().toString(36).slice(2, 10); store.set(k, p); } return p; }
// chamado no boot(), logo depois de salaRef: devolve true quando o boot para aqui (conferindo se a casa visitada existe)
function leva10Boot(){
  let m = null; try { m = /[?&]visita=([a-z0-9-]{10,40})/.exec(decodeURIComponent(location.hash)); } catch(e){}
  visitaDe = m && m[1] !== sala ? m[1] : null; visitando = !!visitaDe;
  document.body.classList.toggle("visitando", visitando);
  if (!visitando) return false;
  pid = visitaPid();
  if (visitaChecada === sala) return false;
  showScreen("nenhuma"); toast("Batendo na porta… 🏡");
  const s0 = sala, casa = salaRef.child("casa");
  Promise.all([casa.child("criada").once("value"), casa.child("leva1").once("value")]).then(([a, b]) => {
    if (sala !== s0) return;
    if (!a.exists() && !b.exists()){ toast("Essa casa não existe."); voltarPraCasa(); return; }
    if (!lerVisitante()){ toast("Abra a visita pelo 🏘️ Bairro da sua casa."); voltarPraCasa(); return; }
    visitaChecada = sala; boot();
  }, () => { if (sala === s0){ toast("Não deu pra bater na porta agora."); voltarPraCasa(); } });
  return true;
}
function entrarVisita(){
  if (me || visitaEntrando) return;
  const v = lerVisitante(); if (!v){ voltarPraCasa(); return; }
  visitaEntrando = true;
  const [x, y] = freeSpot();
  const d = { nome: String(v.nome).slice(0, 16), corpo: v.corpo, roupa: v.roupa, traje: v.traje, cabelo: v.cabelo, estilo: v.estilo, pele: v.pele, barba: v.barba || 0, acess: v.acess, forma: v.forma || null, altura: v.altura || null, fisico: v.fisico || null,
    x, y, dir: "down", needs: v.needs || null, dinheiro: v.dinheiro || 0, visita: visitaDe, romance: false, online: true };
  ref("jogadores/" + pid).set(d).then(() => { historia("visita10_" + pid + "_" + hoje(), "🏡", d.nome + " veio visitar"); }, () => { visitaEntrando = false; toast("Não deu pra entrar agora."); });
}
function voltarPraCasa(){
  const casa = visitaDe;
  if (salaRef && pid && visitando){ const r = ref("jogadores/" + pid); r.onDisconnect().cancel().catch(() => {}); r.remove().catch(() => {}); }
  visitaChecada = null; closePanel();
  location.hash = casa || "";
}
function openBairro(){
  openPanel("bairro", "Bairro 🏘️", corpo => {
    const nomeIn = el("input"), linha = el("div", "nomein"), linkB = el("div", "linkbox"), addIn = el("input"), addL = el("div", "nomein"), rua = el("div", "rua10"), aviso = el("p", "muted");
    nomeIn.type = "text"; nomeIn.maxLength = 30; nomeIn.placeholder = nomeCasaPadrao(); nomeIn.value = nomeCasa || ""; nomeIn.setAttribute("aria-label", "Nome da casa");
    linha.append(nomeIn, btn("Salvar", "btn ghost", () => { const v = nomeIn.value.replace(/\s+/g, " ").trim().slice(0, 30); ref("casa/nome").set(v || null).then(() => toast(v ? "A casa agora se chama " + v + " 🏡" : "Nome apagado.")); }));
    linkB.append(el("code", null, link()), btn("Copiar link", "btn small", async () => { try { await navigator.clipboard.writeText(link()); toast("Link copiado."); } catch(e){ toast("Segure o dedo no link para copiar."); } }));
    addIn.type = "text"; addIn.placeholder = "Cole o link ou o código da casa do amigo"; addIn.setAttribute("aria-label", "Link da casa do amigo");
    const addB = btn("Adicionar", "btn", () => { addB.disabled = true; adicionarVizinho(addIn.value, ok => { addB.disabled = false; if (ok){ addIn.value = ""; } }); });
    addL.append(addIn, addB);
    corpo.append(el("span", "lbl", "Nome da nossa casa"), linha, el("span", "lbl", "Link da nossa casa (pra amigos adicionarem)"), linkB,
      el("h3", null, "A rua"), rua, aviso, el("span", "lbl", "Adicionar a casa de um amigo"), addL,
      el("p", "muted", "Na visita, você entra com o seu bonequinho: dá pra andar, conversar e jogar, mas nada de construir, gastar ou mexer nas coisas da casa."));
    let sig = null;
    const upd = () => {
      const lista = Object.entries(vizinhos).filter(([, v]) => v).sort((a, b) => (a[1].adicionado || 0) - (b[1].adicionado || 0));
      const s = JSON.stringify([lista, nomeCasa, moradores().map(([, j]) => [j.nome, j.online])]); if (s === sig) return; sig = s;
      rua.textContent = "";
      const eu = el("div", "casa10 minha"); eu.append(casinhaCanvas(sala, true), el("strong", null, nomeCasa || nomeCasaPadrao()), el("small", null, "🟢 " + nomesLista(moradores().filter(([, j]) => j.online).map(([id, j]) => id === pid ? "você" : j.nome))), el("span", "tag10", "Nossa casa"));
      rua.append(eu);
      for (const [cod, v] of lista){
        const card = el("div", "casa10"), cvBox = el("div"), st = el("small", null, "Olhando a janela..."), nm = el("strong", null, v.nome || "Casa do amigo");
        cvBox.append(casinhaCanvas(cod, false));
        const bv = btn("Visitar", "btn small", () => irVisitar(cod)); bv.setAttribute("aria-label", "Visitar " + (v.nome || "a casa do amigo"));
        const bx = btn("Tirar da rua", "btn ghost small", () => ref("casa/vizinhos/" + cod).remove().then(() => toast("Casa tirada da rua.")));
        const bb = el("div", "bb10"); bb.append(bv, bx);
        card.append(cvBox, nm, st, bb); rua.append(card);
        lerVizinho(cod).then(info => {
          if (info.nome && info.nome !== v.nome) nm.textContent = info.nome;
          st.textContent = info.erro ? "Não deu pra olhar agora" : info.on.length ? "🟢 " + nomesLista(info.on) : "Ninguém em casa agora";
          cvBox.textContent = ""; cvBox.append(casinhaCanvas(cod, !!info.on.length));
        });
      }
      aviso.textContent = lista.length ? "" : "Nenhuma casa de amigo ainda. Peça o link da casa deles e cole aqui embaixo.";
    };
    upd(); return upd;
  });
}
// barra da visita (no lugar de Viver/Construir/Convidar)
const visitaBar = el("div", "visitaBar"), visitaTx = el("span", "vtx", "");
visitaBar.append(visitaTx, btn("🏠 Voltar pra minha casa", "btn small", voltarPraCasa));
document.querySelector("#screenGame .toolbar").prepend(visitaBar);
function renderVisitaBar(){ if (!visitando) return; const n = nomeCasa || nomeCasaPadrao(); if (visitaTx.textContent !== "🏡 Visita: " + n) visitaTx.textContent = "🏡 Visita: " + n; }
function openVisitaPainel(){
  openPanel("visitaNos", "Visita 🏡", corpo => {
    corpo.append(el("p", null, "Você está visitando " + (nomeCasa || nomeCasaPadrao()) + "."), el("p", "muted", "Visita pode andar, conversar, fazer carinho, jogar e usar as coisas da casa, mas não constrói, não gasta e não mexe na despensa, nos cofrinhos nem no bebê."),
      btn("🏠 Voltar pra minha casa", "btn", voltarPraCasa));
  });
}
// visita: botões que não valem (pega o clique antes do botão)
const BLOQ_VISITA = "#mBuild, #bDespensa, #bTarefas, #bQuintal, #bAndar, #bLojaB, #invite, #reskin";
document.addEventListener("click", e => {
  if (!visitando || !e.target || !e.target.closest) return;
  if (e.target.closest("#bFamilia")){ e.preventDefault(); e.stopPropagation(); openVisitaPainel(); return; }
  if (e.target.closest(BLOQ_VISITA)){ e.preventDefault(); e.stopPropagation(); toast("Visita não mexe nisso 😉"); }
}, true);
// visita: o que não pode (dinheiro, construir, painéis da casa, romance e menus de móveis da casa)
{ const g0 = gastar; gastar = function(v, oque){ if (visitando){ toast("Visita não gasta aqui 😉 Seu dinheiro fica na sua casa."); return false; } return g0(v, oque); }; }
{ const g0 = ganhar; ganhar = function(v){ if (visitando) return; return g0(v); }; }
{ const x0 = xpCasal; xpCasal = function(n){ if (visitando) return; return x0(n); }; }
{ const s0 = setMode; setMode = function(m){ if (m === "build" && visitando){ toast("Visita não constrói 😉"); return; } if (m === "build" && emViagem()){ toast("Vocês estão passeando 🚗"); return; } return s0(m); }; }
for (const nome of ["openQuintal", "openAndar2", "openCozinha", "openTarefas", "openLoja", "openPresentes", "openDatas", "openQuem", "openNomeBebe", "openSaudade", "openAvisos", "openBairro"]){
  const f = window[nome]; if (typeof f !== "function") continue;
  window[nome] = function(){ if (visitando){ toast("Isso é coisa dos moradores 😉"); return; } return f.apply(this, arguments); };
}
const MENUS_VISITA = new Set(["pc", "tv", "som", "pia"]);
{ const f0 = furnMenu; furnMenu = function(id, p){
  if (!visitando) return f0(id, p);
  const m = moveis[id]; if (!m) return; const c = CAT[m.t];
  const items = c.acoes.map(a => ({ nome: a.nome, info: ganhoTxt(a), fn: () => useFurn(id, a) }));
  if (MENU_EXTRA[m.t] && MENUS_VISITA.has(m.t)) items.push(...MENU_EXTRA[m.t](id, m).filter(it => !/Trabalhar|Freela|Tarefas|Loja/.test(it.nome))); // dinheiro e tarefas são da casa dela
  if (!items.length){ toast(c.nome + " é só decoração. Fica lindo, né?"); return; }
  openMenu(p, c.nome, items);
}; }
{ const f0 = socialMenu; socialMenu = function(id, p){
  const j = jogadores[id];
  if (!visitando && !(j && j.visita)) return f0(id, p);
  openMenu(p, nomeDe(id) + (j && j.visita ? " (visita)" : ""), [itemVerPessoa(id)].concat(SOCIAL.filter(s => s.id !== "chute" && (!s.mostrar || s.mostrar(id))).map(s => ({ nome: s.nome, fn: () => social(id, s) }))));
}; }
{ const f0 = tirarFoto; tirarFoto = function(){ if (viagemOn()) return fotoViagem(); return f0(); }; }
{ const f0 = setOnline; setOnline = function(){
  if (!visitando) return f0();
  const r = ref("jogadores/" + pid); r.onDisconnect().remove(); ref("jogadores/" + pid + "/online").set(true).catch(() => {});
}; }
// painel "Nós": mais quatro botões
{ const f0 = nosBotoes9; nosBotoes9 = function(){
  const g = f0();
  const mk = (ic, tx, sub, fn) => { const b = btn("", "btn ghost escolha", fn); b.append(el("strong", null, ic + " " + tx), el("small", null, sub)); b.setAttribute("aria-label", tx + ": " + sub); return b; };
  const nv = vozNovas().length, nz = Object.keys(vizinhos).length;
  g.append(mk("🧸", "Saudade", "Onde minha pelúcia fica", openSaudade), mk("📞", "Recados de voz", nv ? nv + (nv === 1 ? " novo!" : " novos!") : "Gravar e ouvir", openVoz),
    mk("🔔", "Avisos", avisosLigados() ? "Ligados" : "Avisar quando...", openAvisos), mk("🏘️", "Bairro", nz ? nz + (nz === 1 ? " casa de amigo" : " casas de amigos") : "Visitar amigos", openBairro));
  return g;
}; }

// =====================================================================
// 6. GANCHOS: boot, jogadores, clique, desenho, laço, ouvintes
// =====================================================================
function leva10Jogadores(ant){
  if (!me){ jog10Pronto = false; return; }
  if (!jog10Pronto){ jog10Pronto = true; return; }
  for (const [id, j] of Object.entries(jogadores)){
    if (id === pid || !j || !j.nome) continue;
    const a = ant[id];
    if (j.online && (!a || !a.online)){
      if (j.visita){ toast(j.nome + " veio visitar 🏡"); sfx("toc"); avisar("entrou", j.nome + " veio visitar a casa 🏡"); }
      else if (!visitando) avisar("entrou", j.nome + " entrou na casa 🏡");
    }
  }
}
function leva10Click(p, tx, ty, toque){
  if (viagemOn()) return true; // na viagem o canvas é só a cena
  if (mode !== "live") return false;
  const pl = peluciaNoToque(p.x, p.y, toque); if (pl){ menuPelucia(pl, p); return true; }
  if (carroNoToque(p.x, p.y, toque)){ menuCarro(p); return true; }
  return false;
}
// true = não desenha o boneco normal (pelúcia no lugar de quem saiu; quem está no carro ou viajando)
function leva10Esconde(id, j){
  if (!j) return false;
  if (id !== pid && !j.online && !j.visita) return true;
  if (passeio && psVai(id)){
    const t = srvNow();
    if (passeio.estado === "viajando") return true;
    if (passeio.estado === "fim" && t < (passeio.fimAt || 0) + PS_SAI) return true;
  }
  return false;
}
function addLeva10Objs(objs, tm){
  sdVis = [];
  if (mode === "live") for (const p of peluciasAqui()){
    const j = jogadores[p.id]; if (!j) continue; sdVis.push(p);
    objs.push({ z: p.z, f: () => { if (!p.mov){ R(p.cx - 5, p.by, 10, 1, "rgba(35,18,40,.25)"); } ctx.drawImage(peluciaSpr(j).c, Math.round(p.cx - 10), Math.round(p.by - 28)); } });
  }
  addCarroObjs(objs, tm);
  telVis = [];
  const novo = vozNovas().length > 0;
  for (const [id, m] of Object.entries(moveis)){
    if (m.t !== "telmesa" && m.t !== "telefone") continue;
    telVis.push(m);
    if (!novo || Math.floor(tm / 450) % 2) continue;
    const lx = m.x * T + 12, ly = m.y * T - (m.t === "telefone" ? 6 : 5);
    objs.push({ z: (m.y + 1) * T + .5, f: () => { R(lx, ly, 2, 2, "#FF4D6A"); P(lx, ly, "#FFC2CC"); } });
  }
}
function leva10Luzes(lights, tm){ if (vozNovas().length && Math.floor(tm / 450) % 2 === 0) for (const m of telVis) lights.push([m.x * T + 13, m.y * T - 4, 10, "255,80,110", .9]); }
function drawLabels10(mctx, K, fs, tm){
  if (mode !== "live") return;
  for (const p of sdVis){ const j = jogadores[p.id]; if (!j) continue; const nm = "🧸 " + j.nome + " · fora", top = (p.by - 25) * K; mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, p.cx * K, top); mctx.fillStyle = "#E6DEFF"; mctx.fillText(nm, p.cx * K, top); }
  if (passeio && (passeio.estado === "viajando" || (passeio.estado === "fim" && srvNow() < (passeio.fimAt || 0) + PS_SAI)) && !psVai(pid) && andarAtual === 0 && srvNow() > (passeio.ini || 0) + PS_SAI){
    const cp = carroPos(); if (cp){ const d = DESTINOS[passeio.destino]; bolha9(mctx, fs, (cp.x + 15) * K, (cp.by - 4) * K, psNomes() + (d ? vb(" foi ", " foram ") + d.txt + " " + d.em : vb(" saiu", " saíram") + " de carro 🚗")); }
  }
  if (vozNovas().length) for (const m of telVis) bolha9(mctx, fs, (m.x * T + 8) * K, (m.y * T - 8) * K - Math.abs(Math.sin(tm / 300)) * K * 1.5, "📞");
}
function leva10Update(dt){ syncViagemUI(); renderVisitaBar(); }
function garantirLeva10(){
  if (leva10Tentou || !me || !casaOk || visitando || !moveisCarregados || andarAtual !== 0) return; leva10Tentou = true;
  txn("casa/leva10", c => c ? undefined : srvNow()).then(ok => {
    if (!ok || Object.values(todosMoveis).some(m => m && (m.t === "telmesa" || m.t === "telefone"))) return;
    let pos = null;
    for (const [x, y] of [[9, 5], [13, 5], [14, 4], [8, 4], [9, 6], [14, 6]]) if (canPlace("telmesa", x, y)){ pos = [x, y]; break; }
    if (!pos){ const lp = lugarPerto("telmesa", 10, 4); if (lp && comodo(lp[0], lp[1]) === "sala") pos = lp; }
    if (pos) ref("casa/moveis").push({ t: "telmesa", x: pos[0], y: pos[1] }).catch(() => {});
  });
}
CONQUISTAS.push(
  { id: "saudade10", nome: "Coração apertado", txt: "10 abraços de saudade numa pelúcia.", st: "saudades", meta: 10 },
  { id: "passeio1", nome: "Pé na estrada", txt: "O primeiro passeio de carro.", st: "passeios", meta: 1 },
  { id: "passeio10", nome: "Viajantes", txt: "10 passeios de carro.", st: "passeios", meta: 10 }
);
function leva10Ouvir(){
  on(ref("casa/saudade"), "value", s => { saudade = s.val() || {}; sdCarregada = true; refreshPanel("saudade"); });
  on(ref("casa/reencontro"), "value", s => { reencontro = s.val() || {}; reCarregado = true; });
  on(ref("casa/vozMeta"), "value", s => aoMudarVoz(s.val() || {}));
  on(ref("casa/passeio"), "value", s => aoMudarPasseio(s.val()));
  on(ref("casa/vizinhos"), "value", s => { vizinhos = s.val() || {}; refreshPanel("bairro"); });
  on(ref("casa/nome"), "value", s => { const v = s.val(); nomeCasa = typeof v === "string" ? v.slice(0, 30) : ""; nomeCarregado = true; renderVisitaBar(); refreshPanel("bairro"); });
}
function leva10Reset(){
  saudade = {}; sdCarregada = false; sdVis = []; sdMostrando = false;
  reencontro = {}; reCarregado = false; for (const k in reVisto) delete reVisto[k];
  vozMeta = {}; vozCarregada = false; vozSrc.clear(); vozPend.clear(); if (grav.estado === "gravando") pararGravacao(true);
  passeio = null; psCarregado = false; psPartindo = 0; psSemNinguem = 0; psUltSig = "x"; psAtivFeito.clear();
  vizinhos = {}; nomeCasa = ""; nomeCarregado = false; visitaEntrando = false;
  leva10Tentou = false; jog10Pronto = false; carroVis = null; telVis = []; infoVizinho.clear();
  document.body.classList.remove("viajando"); viagemCard.hidden = true;
}
setInterval(() => { if (!me) return; vigiarSaudade(); vigiarReencontro(); vigiarPasseio(); garantirLeva10(); }, 1000);
