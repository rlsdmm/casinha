"use strict";
// Casinha · estado, caminhos (bfs), Firebase: boot, ouvintes e presença
// ===================== estado =====================
function salaFromHash(){ const h = decodeURIComponent(location.hash.replace(/^#/, "")).split("?")[0].trim().toLowerCase(); return /^[a-z0-9-]{10,40}$/.test(h) ? h : null; } // leva 10: "#casa?visita=minhacasa"
let sala = null, fdb = null, salaRef = null, listeners = [];
let pid = null;
let moveis = {}, pisos = {}, jogadores = {};
// leva 4: todosMoveis = casa/moveis inteiro; moveis = só os do andar que estou vendo (m.andar ausente = térreo)
let todosMoveis = {}, pisos2 = {}, moveisCarregados = false;
let occ = [];
let me = null;            // estado local do meu boneco
let disp = {};            // posições exibidas dos outros
let mode = "live", buildTab = "mov", tool = null;
let hover = null, menuEl = null, particles = [], lastSave = 0, lastNeedsSent = "";
let creator = { nome: "", roupa: 0, cabelo: 0, estilo: 0, pele: 1, corpo: "neutro", traje: 0, barba: 0, acess: 0 };

function link(){ return location.origin + location.pathname + "#" + sala; }
function nomeDe(id){ const j = jogadores[id]; return (j && j.nome) || "Alguém"; }

function rebuildOcc(){
  occ = MAP.map(r => r.map(() => null));
  for (const [id, m] of Object.entries(moveis)){
    const c = CAT[m.t]; if (!c || c.chao) continue;
    for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++){ const yy = m.y + dy, xx = m.x + dx; if (occ[yy] && xx < W) occ[yy][xx] = id; }
  }
  rebuildPetTiles();
}
function aplicarMoveis(){
  moveis = {};
  for (const [id, m] of Object.entries(todosMoveis)) if (m && (m.andar || 0) === andarAtual) moveis[id] = m;
  rebuildOcc();
}
const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && MAP[y][x] !== 1 && MAP[y][x] !== 4 && !occ[y][x];

function bfs(sx, sy, isGoal){
  const prev = new Map(), k = (x, y) => y * W + x, q = [[sx, sy]]; prev.set(k(sx, sy), null);
  while (q.length){
    const [x, y] = q.shift();
    if (isGoal(x, y)){ const path = []; let cur = k(x, y); while (cur != null){ path.unshift([cur % W, Math.floor(cur / W)]); cur = prev.get(cur); } path.shift(); return path; }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx = x + dx, ny = y + dy; if (walkable(nx, ny) && !prev.has(k(nx, ny))){ prev.set(k(nx, ny), k(x, y)); q.push([nx, ny]); } }
  }
  return null;
}
function adjTo(m){
  const c = CAT[m.t], set = new Set();
  for (let dy = -1; dy <= c.h; dy++) for (let dx = -1; dx <= c.w; dx++){
    const inside = dx >= 0 && dy >= 0 && dx < c.w && dy < c.h; if (inside) continue;
    if ((dx === -1 || dx === c.w) && (dy === -1 || dy === c.h)) continue;
    set.add((m.y + dy) * W + (m.x + dx));
  }
  return (x, y) => set.has(y * W + x);
}
function freeSpot(){ for (const [x, y] of [[10,4],[11,4],[12,4],[9,3],[13,3],[11,7],[9,6]]) if (walkable(x, y)) return [x, y]; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (walkable(x, y)) return [x, y]; return [10, 4]; }

// ===================== Firebase =====================
function ref(p){ return salaRef.child(p); }
function on(r, ev, fn){ r.on(ev, fn); listeners.push(() => r.off(ev, fn)); }
function stop(){
  // leva 8: trocou de casa (hash) com o jogo aberto: sai da casa antiga em vez de ficar "online" lá até fechar a aba
  // leva 10: desliga os ouvintes ANTES de marcar "fora" (senão o reparo de presença da leva 8 via o próprio online=false e voltava pra true)
  const saindo = !!(me && salaRef && pid);
  listeners.forEach(f => f()); listeners = [];
  if (saindo){
    if (visitando){ const r = ref("jogadores/" + pid); r.onDisconnect().cancel().catch(() => {}); r.remove().catch(() => {}); } // leva 10: visita não deixa rastro
    else { const r = ref("jogadores/" + pid + "/online"); r.onDisconnect().cancel().catch(() => {}); r.set(false).catch(() => {}); }
  }
  moveis = {}; pisos = {}; jogadores = {}; me = null; disp = {};
  casaOk = false; casaNova = false; casaCriando = false; // leva 14
  pet = null; pets = {}; petPid = null; criarPetTentou = false; jardim = {}; mural = {}; despensa = {}; pratos = {}; casaPronta = false; petCarregado = false; muralCarregado = false; muralAvisado = false; petView = null;
  leva5Reset(); leva6Reset(); leva7Reset(); leva9Reset(); leva10Reset(); leva11Reset();
  if (typeof closePanel === "function") closePanel();
  // leva 2
  jogos = {}; stats = {}; conquistas = {}; cofre = {}; diario = {};
  jogosCarregados = statsCarregados = conqCarregadas = cofreCarregado = false; bannerKey = null; $("banner").hidden = true;
  // leva 4
  todosMoveis = {}; pisos2 = {}; cofre2 = {}; cofre2Carregado = moveisCarregados = andar2Tentou = false; andarUISig = "";
  if (portaQ || andarAtual || escadaOn){ andarAtual = 0; escadaOn = false; montarMapa(false); tamanhoCena(); }
  if ($("andarUI")) $("andarUI").hidden = true;
  diarioLimpo = false; lastNeedsSent = ""; if (mode !== "live") setMode("live");
}

function showScreen(id){ for (const s of ["screenRoom", "screenCreator", "screenGame"]) $(s).hidden = s !== id; }

// leva 14 (correção da criação): casaOk = a casa existe de verdade (casa/modo ou casa/pisos gravados)
let casaOk = false, casaNova = false, casaCriando = false;
function marcarCasaOk(){
  if (casaOk) return; casaOk = true; casaNova = false;
  if (painel && painel.id === "modo") closePanel(); // outra pessoa criou enquanto eu escolhia
  const mine = jogadores[pid];
  if (!me && !visitando && mine && mine.nome) startMe(mine);
  else if (me) garantirCasa();
}
function criarCasaNova(sr){
  if (casaCriando || casaOk) return; casaCriando = true;
  escolherModoNovo().then(modo => {
    if (salaRef !== sr || casaOk) return;
    const eu = pid;
    return ref("casa/criando").transaction(cur => cur && (cur.feito || (cur.por !== eu && Date.now() - (cur.at || 0) < 60000)) ? undefined : { por: eu, at: Date.now() }).then(r => {
      if (!r.committed || salaRef !== sr || casaOk) return;
      const t = srvNow();
      let dados;
      if (modo === "zero") dados = casaZeroDados(t);
      else { const mv = {}; MOVEIS_INICIAIS.forEach(([tp, x, y], i) => mv["m" + i] = { t: tp, x, y }); dados = { moveis: mv, pisos: PISO_PADRAO, leva1: true, modo: "pronta", pet: { nome: "Pipoca", tipo: "gato", comeu: t, carinho: t } }; }
      // casa quebrada pelo bug antigo: apaga o que as migrações gravaram antes da hora (elas rodam de novo, agora na ordem certa)
      dados = Object.assign({ leva5: null, leva6: null, leva9: null, leva10: null, leva13: null, sujeira: null, sujeiraAte: null, historia: null, pets: null }, dados);
      dados.criada = t; dados.criando = { por: eu, at: t, feito: 1 };
      return ref("casa").update(dados).then(() => { if (modo === "zero") historia("casa_zero", "🧱", "Começaram do zero: um terreno, uma kitnet e muitos planos"); });
    });
  }).catch(() => {}).then(() => { casaCriando = false; });
}

function boot(){
  stop(); closeMenu();
  sala = salaFromHash();
  renderPeople();
  if (!sala){ showScreen("screenRoom"); return; }
  if (!window.firebase){ showScreen("screenRoom"); toast("Não deu pra carregar o jogo. Confira a internet."); return; }
  if (!fdb){ firebase.initializeApp({ databaseURL: DB_URL }); fdb = firebase.database(); }
  salaRef = fdb.ref("salas/" + sala);
  if (leva10Boot()) return; // leva 10: visita (confere se a casa existe antes de entrar; a visita tem pid próprio)
  if (!visitando){
    pid = store.get("casinha-pid-" + sala);
    if (!pid){ pid = "p" + Math.random().toString(36).slice(2, 10); store.set("casinha-pid-" + sala, pid); }
  }

  salaSeed = [...sala].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);
  // Cria a casa uma vez só (nunca transação no nó "casa" inteiro: com o cache parcial ela chegou a sobrescrever a casa toda).
  // leva 14 (correção): a casa só EXISTE quando casa/modo ou casa/pisos estão gravados (toda casa pronta grava pisos desde
  // a versão 1; a do zero grava modo). Antes disso ninguém entra (startMe espera) e, como toda migração (levaN, pets,
  // história, sujeira…) depende de "me", nada é gravado. Antes, quem entrava com a escolha do modo ainda aberta disparava
  // as migrações, a da leva 9 gravava casa/criada e a criação (transação em casa/criada) desistia: casa sem os móveis.
  // Quem decide quem cria é a folha casa/criando (trava de 60 s; "feito" depois de criada). Casa quebrada por aquele bug
  // (sem modo e sem pisos) volta a mostrar a escolha e é criada por cima (moveis é trocado inteiro).
  const sr = salaRef;
  if (visitando) casaOk = true;
  else Promise.all([ref("casa/modo").once("value"), ref("casa/pisos").once("value"), ref("casa/criada").once("value")]).then(([mo, pi, cr]) => {
    if (salaRef !== sr) return;
    if (mo.exists() || pi.exists()){ marcarCasaOk(); if (!cr.exists()) ref("casa/criada").transaction(cur => cur ? undefined : Date.now()).catch(() => {}); return; }
    if (!casaOk){ casaNova = true; criarCasaNova(sr); }
  }).catch(() => {});

  on(fdb.ref(".info/serverTimeOffset"), "value", s => { srvOff = s.val() || 0; });
  on(ref("casa/moveis"), "value", s => {
    todosMoveis = s.val() || {}; moveisCarregados = true; aplicarMoveis();
    if (Object.keys(todosMoveis).length) garantirCasa();
    if (me && !walkable(me.tx, me.ty) && !me.acao){ const [x, y] = freeSpot(); me.tx = x; me.ty = y; me.px = x; me.py = y; me.path = []; savePos(); }
    if (mode === "build") renderBuild();
    prepararAndar2();
  });
  // leva 4: 2º andar (cofrinho próprio, independente do quintal) e pisos de lá de cima
  on(ref("casa/cofre2"), "value", s => {
    const tinha = temAndar2(), carregado = cofre2Carregado; cofre2 = s.val() || {}; cofre2Carregado = true;
    if (temAndar2() !== tinha) aplicarAndar2(carregado && !tinha && !!me);
    else if (me && andarAtual === 1 && !temAndar2()) trocarAndar(0, true); // estava lá em cima, mas a casa não tem 2º andar
    refreshPanel("andar2"); checarConquistas(); renderAndarUI();
  });
  on(ref("casa/pisos2"), "value", s => { pisos2 = s.val() || {}; });
  // leva 1: dados compartilhados da casa
  // leva 13: casa/pets/<id> (até 3). "pet" é o bichinho principal (o primeiro gato/cachorro); os outros ficam no 25-familia.js
  on(ref("casa/pets"), "value", s => {
    const ant = pet, antId = petPid; pets = s.val() || {}; petPid = petPrincipalId(); pet = petPid ? pets[petPid] : null; petCarregado = true;
    if (!pet){ criarPet(); refreshPanel("pets"); return; }
    if (ant && me && antId === petPid){
      if (pet.carinho !== ant.carinho){ if (petView) burst(petView.cx / T - .5, petView.by / T - .6, "heart"); if (pet.carinhoPor && pet.carinhoPor !== pid) toast(nomeDe(pet.carinhoPor) + " fez carinho em " + petNome() + "."); }
      if (pet.comeu !== ant.comeu && pet.comeuPor && pet.comeuPor !== pid) toast(nomeDe(pet.comeuPor) + " deu comida pra " + petNome() + ".");
      aoMudarPet(ant); // leva 5: som do truque
    }
    petsAoMudar(); refreshPanel("pet"); refreshPanel("pets");
  });
  on(ref("casa/jardim"), "value", s => { jardim = s.val() || {}; });
  on(ref("casa/despensa"), "value", s => { despensa = s.val() || {}; refreshPanel("cozinha"); });
  on(ref("casa/pratos"), "value", s => { pratos = s.val() || {}; });
  on(ref("casa/mural"), "value", s => {
    const ant = mural; mural = s.val() || {};
    if (muralCarregado && me) for (const [k, b] of Object.entries(mural)) if (!ant[k] && b && b.autor !== pid) { toast((b.nome || "Alguém") + " deixou um bilhete no mural."); avisar("mural", (b.nome || "Alguém") + " deixou um bilhete no mural 📌"); }
    muralCarregado = true; avisoMural(); refreshPanel("mural");
  });
  on(ref("casa/pisos"), "value", s => { pisos = s.val() || {}; if (s.exists()) marcarCasaOk(); }); // leva 14: casa criada de verdade
  // leva 2: quintal (cofrinho), jogos, tarefas do dia, contadores e conquistas
  on(ref("casa/cofre"), "value", s => {
    const tinha = temQuintal(), carregado = cofreCarregado; cofre = s.val() || {}; cofreCarregado = true;
    if (temQuintal() !== tinha || (temQuintal() && portaQ !== (cofre.porta || 13))) aplicarQuintal(carregado && !tinha && !!me);
    refreshPanel("quintal"); checarConquistas();
  });
  on(ref("casa/jogos"), "value", s => aoMudarJogos(s.val() || {}));
  on(ref("casa/diario"), "value", s => { diario = s.val() || {}; limparDiario(); refreshPanel("tarefas"); checarDupla(); });
  on(ref("casa/stats"), "value", s => { stats = s.val() || {}; statsCarregados = true; checarConquistas(); refreshPanel("trofeus"); });
  on(ref("casa/conquistas"), "value", s => {
    const ant = conquistas; conquistas = s.val() || {};
    if (conqCarregadas && me) for (const c of CONQUISTAS) if (conquistas[c.id] && !ant[c.id]) celebrar(c);
    conqCarregadas = true; checarConquistas(); refreshPanel("trofeus");
  });
  on(ref("jogadores"), "value", s => {
    const ant = jogadores; jogadores = s.val() || {};
    // leva 4: quem chega no meu andar sai da escada andando (em vez de aparecer do nada)
    for (const [id, j] of Object.entries(jogadores)){
      if (id === pid || !ant[id] || (ant[id].andar || 0) === (j.andar || 0)) continue;
      if ((j.andar || 0) === andarAtual && j.x >= ESCADA.x - 1 && j.x < ESCADA.x + ESCADA.w + 1) disp[id] = { x: clamp(j.x, ESCADA.x, ESCADA.x + ESCADA.w - 1), y: andarAtual ? ESCADA.y : ESCADA.y + ESCADA.h - 1, moving: true };
      else delete disp[id];
    }
    const mine = jogadores[pid];
    // leva 8: nó sem nome (sobra de um onDisconnect depois de apagarem o jogador) = jogador novo, vai pro criador
    if (!mine || !mine.nome){ if (visitando) entrarVisita(); else if (!me && $("screenCreator").hidden) openCreator(); } // leva 10: visita entra com o visual que trouxe
    else if (!me){
      if (casaOk || visitando) startMe(mine);
      else if (casaNova && !casaCriando){ toast("Primeiro, escolham como vai ser a casa 🏠"); criarCasaNova(salaRef); } // leva 14: casa ainda não criada
    }
    else {
      me.dados = mine;
      // leva 8: presença. O onDisconnect de uma conexão velha (página recarregada no celular, outra aba fechada)
      // pode chegar no servidor DEPOIS do set(true) desta conexão e me deixar "fora" estando aqui. Se isso acontecer, volto.
      if (mine.online === false && conectado && Date.now() - onlineReparo > 3000){ onlineReparo = Date.now(); setOnline(); }
    }
    // leva 8: cada passo de qualquer jogador chega aqui; junta os redesenhos do HUD num só
    leva10Jogadores(ant); // leva 10: avisos de quem chegou
    agendarUI(renderPeople); agendarUI(renderHud); agendarUI(uiJogadores);
  });
  on(fdb.ref(".info/connected"), "value", s => { conectado = !!s.val(); if (conectado && me) setOnline(); });
  leva5Ouvir(); // sujeira, visitas e música
  leva6Ouvir(); // paredes, decoração, nível do casal, loja da semana
  leva7Ouvir(); // namoro, gravidez e bebê
  leva9Ouvir(); // presentes, jantar, cinema, álbum, datas e história
  leva10Ouvir(); // saudade, recados de voz, passeio, bairro
  leva11Ouvir(); // modo da casa, obras e metas do lar
}

let conectado = false, onlineReparo = 0;
const uiJogadores = () => { refreshPanel("tarefas"); refreshPanel("jogo"); renderAndarUI(); };
// junta chamadas de UI vindas do banco (vários ouvintes no mesmo instante) e roda cada função uma vez só
const uiPend = new Set(); let uiTimer = 0;
function agendarUI(fn){
  uiPend.add(fn);
  if (!uiTimer) uiTimer = setTimeout(() => { uiTimer = 0; const l = [...uiPend]; uiPend.clear(); for (const f of l){ try { f(); } catch(e){ console.error(e); } } }, 50);
}
// fechar/recarregar a página: desconecta limpo, pra o servidor rodar o onDisconnect já (e não depois da conexão nova)
window.addEventListener("pagehide", () => { if (fdb) try { fdb.goOffline(); } catch(e){} });
window.addEventListener("pageshow", e => { if (e.persisted && fdb) try { fdb.goOnline(); } catch(err){} });
function setOnline(){
  const r = ref("jogadores/" + pid + "/online");
  r.onDisconnect().set(false); r.set(true).catch(() => {});
  ref("jogadores/" + pid + "/visto").onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
}

function startMe(d){
  me = { dados: d, px: d.x, py: d.y, tx: d.x, ty: d.y, path: [], dir: d.dir || "down", acao: null, plano: null, needs: Object.assign({}, d.needs || {}), dinheiro: d.dinheiro || 0, andar: d.andar === 1 ? 1 : 0 };
  for (const n of NEEDS) if (typeof me.needs[n.id] !== "number") me.needs[n.id] = 80;
  // leva 4: volta pro andar em que estava (se o 2º andar sumir, cofre2 manda de volta pro térreo)
  if (me.andar === 1 && cofre2Carregado && !temAndar2()) me.andar = 0;
  if (me.andar !== andarAtual){ andarAtual = me.andar; remontar(); aplicarMoveis(); tamanhoCena(); }
  if (!walkable(me.tx, me.ty)){ const [x, y] = freeSpot(); me.tx = me.px = x; me.ty = me.py = y; }
  showScreen("screenGame");
  setOnline();
  ref("jogadores/" + pid).update({ acao: null, x: me.tx, y: me.ty, andar: me.andar });
  on(ref("eventos/" + pid), "child_added", s => {
    const ev = s.val(); s.ref.remove().catch(() => {});
    if (!ev || Date.now() - (ev.at || 0) > 60000) return;
    const so = SOCIAL.find(x => x.id === ev.tipo); if (!so) return;
    for (const [k, v] of Object.entries(so.outro)) me.needs[k] = clamp(me.needs[k] + v, 0, 100);
    burst(me.px, me.py, ev.tipo === "beijo" || ev.tipo === "abracar" || ev.tipo === "chute" ? "heart" : "note");
    sfx(ev.tipo === "beijo" ? "beijo" : ev.tipo === "chute" ? "chute" : "pop");
    toast(nomeDe(ev.de) + " " + so.txt + ".");
    saveNeeds(true);
    tarefaCheck({ id: "s-" + ev.tipo }); // quem recebe também cumpre "dançar/conversar com alguém"
  });
  limparTarefasVelhas(d);
  resize(); renderHud(); renderInvite(); avisoMural(); prepararAndar2(); garantirCasa();
}

function savePos(){ if (me) ref("jogadores/" + pid).update({ x: me.tx, y: me.ty, dir: me.dir }).catch(() => {}); }
function saveNeeds(force){
  if (!me) return;
  const n = {}; for (const k of NEEDS) n[k.id] = Math.round(me.needs[k.id]);
  const sig = JSON.stringify(n) + me.dinheiro;
  if (!force && sig === lastNeedsSent) return;
  lastNeedsSent = sig;
  ref("jogadores/" + pid).update({ needs: n, dinheiro: Math.round(me.dinheiro) }).catch(() => {});
}
function setAcao(a){
  const prev = me.acao;
  if (prev && prev !== a && !prev.acabou && prev.def && prev.def.cancel) prev.def.cancel();
  me.acao = a;
  if (a && a !== prev) sfxInicio(a.id); // leva 5
  ref("jogadores/" + pid + "/acao").set(a ? { id: a.id, nome: a.nome, ini: a.ini, dur: a.dur, mov: a.mov || null, alvo: a.alvo || null, sobre: a.sobre || 0, deitar: a.deitar || 0, tela: a.tela || null, cima: a.cima || 0, jogo: a.jogo || null, esc: a.esc || 0 } : null).catch(() => {});
  renderHud();
}
