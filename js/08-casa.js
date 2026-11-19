"use strict";
// Casinha · leva 1: painéis, bichinho, horta, cozinha e mural
// =====================================================================
// LEVA 1: casa viva (bichinho, horta, mural de bilhetes, cozinha)
// Tudo compartilhado fica em salas/<sala>/casa/{pet, jardim, mural, despensa, pratos}.
// Tempos guardados são do servidor (srvNow / TS), para valerem igual em todos os aparelhos.
// =====================================================================
let srvOff = 0;
const srvNow = () => Date.now() + srvOff;
const TS = () => firebase.database.ServerValue.TIMESTAMP;
const HORA = 3600000;
let pet = null, jardim = {}, mural = {}, despensa = {}, pratos = {};
let pets = {}, petPid = null, criarPetTentou = false; // leva 13: casa/pets/<id>; pet = pets[petPid] (o principal)
let casaPronta = false, muralCarregado = false, muralAvisado = false, salaSeed = 1;
let petView = null;

// ---- moedas: dinheiro de cada jogador (jogadores/<pid>/dinheiro) ----
function gastar(v, oque){
  if (!me) return false;
  if (me.dinheiro < v){ toast("Faltam $" + Math.ceil(v - me.dinheiro) + (oque ? " pra " + oque : "") + "."); return false; }
  me.dinheiro -= v; saveNeeds(true); return true;
}
function ganhar(v){ if (me){ me.dinheiro += v; saveNeeds(true); if (v > 0) sfx("moeda"); } }
function ganharNeeds(g){ if (!me) return; for (const [k, v] of Object.entries(g || {})) me.needs[k] = clamp(me.needs[k] + v, 0, 100); saveNeeds(true); }
// transação: fn(atual) devolve o novo valor, ou undefined para desistir. Resolve true se gravou.
function txn(path, fn){ return ref(path).transaction(fn).then(r => !!r.committed, () => false); }

// ---- painéis: folha que sobe de baixo ----
// openPanel(id, título, monta): monta(corpo) desenha e pode devolver upd(), chamado por refreshPanel(id)
let painel = null;
function openPanel(id, titulo, monta){
  closePanel(); closeMenu();
  const fundo = el("div", "sheet-bg"), folha = el("div", "sheet");
  folha.setAttribute("role", "dialog"); folha.setAttribute("aria-modal", "true"); folha.setAttribute("aria-label", titulo);
  const hd = el("div", "sheet-hd"), fx = btn("×", "xbtn", closePanel); fx.setAttribute("aria-label", "Fechar");
  hd.append(el("h2", null, titulo), fx);
  const corpo = el("div"); corpo.style.cssText = "display:flex;flex-direction:column;gap:12px";
  folha.append(hd, corpo); fundo.append(folha); document.body.append(fundo);
  fundo.addEventListener("click", e => { if (e.target === fundo) closePanel(); });
  fundo.addEventListener("touchmove", e => { if (!folha.contains(e.target)) e.preventDefault(); }, { passive: false }); // fundo não rola atrás
  document.documentElement.classList.add("travado");
  painel = { id, el: fundo, upd: null };
  painel.upd = monta(corpo) || null;
  fx.focus({ preventScroll: true });
}
function closePanel(){ if (painel){ painel.el.remove(); painel = null; } document.documentElement.classList.remove("travado"); }
function refreshPanel(id){ if (painel && painel.id === id && painel.upd) painel.upd(); }
function btn(txt, cls, fn){ const b = el("button", cls || "btn", txt); b.type = "button"; if (fn) b.onclick = fn; return b; }
function quando(ts){
  const d = srvNow() - ts;
  if (d < 60000) return "agora";
  if (d < HORA) return "há " + Math.floor(d / 60000) + " min";
  if (d < 24 * HORA) return "há " + Math.floor(d / HORA) + " h";
  const dt = new Date(ts); return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function duracao(ms){ const m = Math.max(1, Math.ceil(ms / 60000)); return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : ""); }
// ícone pixelado (sprite em cache) para listas dos painéis
function iconeSpr(s){ const cv = el("canvas"); cv.width = s.c.width; cv.height = s.c.height; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(s.c, 0, 0); return cv; }
function barra(v, cor){ const b = el("div", "bar"), i = el("i"); i.style.width = Math.round(v) + "%"; i.style.background = v < 25 ? "var(--bad)" : cor; b.append(i); return b; }

// começa uma ação do meu boneco. a.antes() (opcional, pode ser promessa) decide se começa;
// a.fim({ junto }) roda ao terminar; a.cancel() roda se parar antes; a.junto = 1 (mesma ação) ou função(acaoDoOutro)
function startAcao(a, mov, alvo){
  const go = () => setAcao({ id: a.id, nome: a.nome, ini: Date.now(), dur: a.dur * 1000, mov: mov || null, alvo: alvo || null, sobre: a.sobre || 0, deitar: a.deitar || 0, tela: a.tela || null, cima: a.cima || 0, jogo: a.jogo || null, esc: a.esc || 0, def: a });
  if (!a.antes) return go();
  Promise.resolve(a.antes()).then(ok => { if (ok) go(); });
}
function primeiro(t){ const ks = Object.keys(moveis).filter(k => moveis[k].t === t).sort(); return ks.length ? ks[0] : null; }
function acharLugar(t){ for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (canPlace(t, x, y)) return [x, y]; return null; }

// casa já existe: cria o que faltar (itens da leva 1 em casas antigas, bichinho)
function garantirCasa(){
  if (casaPronta || andarAtual !== 0) return;
  if (!casaOk) return; // leva 11/14: casa ainda sendo criada (a escolha do modo vem antes); nada de migração antes disso
  casaPronta = true; // migração usa o mapa do térreo
  ref("casa/leva1").transaction(cur => cur ? undefined : true).then(r => {
    if (!r.committed) return;
    for (const [t, x, y] of EXTRAS_LEVA1){ const pos = canPlace(t, x, y) ? [x, y] : acharLugar(t); if (pos) ref("casa/moveis").push({ t, x: pos[0], y: pos[1] }); }
  }).catch(() => {});
  criarPet();
}
// só depois de ler casa/pet (senão a transação mostra um bichinho "fantasma" antes da resposta do servidor)
let petCarregado = false;
// leva 13: o bichinho antigo (casa/pet) vira casa/pets/pet0 com tudo dele (casa/pet fica lá, só pra versões antigas)
function criarPet(){
  if (!casaPronta || !petCarregado || pet || criarPetTentou) return;
  criarPetTentou = true;
  ref("casa/pet").once("value").then(s => {
    const v = s.val(), novo = v && v.tipo ? Object.assign({}, v, { migrado: srvNow() }) : { nome: "Pipoca", tipo: "gato", comeu: srvNow(), carinho: srvNow() };
    return ref("casa/pets/pet0").transaction(cur => cur ? undefined : novo);
  }).catch(() => { criarPetTentou = false; });
}
// principal = primeiro gato/cachorro (pela ordem de chegada); é ele que aprende truques e aparece no HUD
function petPrincipalId(){
  const l = Object.keys(pets).filter(k => pets[k] && (pets[k].tipo === "gato" || pets[k].tipo === "cachorro")).sort((a, b) => ((pets[a].criado || 0) - (pets[b].criado || 0)) || (a < b ? -1 : 1));
  return l[0] || null;
}
const petNo = sub => "casa/pets/" + (petPid || "pet0") + (sub ? "/" + sub : "");

// ---------------- bichinho ----------------
// casa/pet = { nome, tipo: "gato"|"cachorro", comeu, carinho, comeuPor, carinhoPor }
// Fome e carinho saem do tempo desde o último cuidado (funciona com todo mundo fora).
// A posição é calculada do relógio: mesma em todos os aparelhos, sem ninguém sincronizar.
const PET_TIPOS = {
  gato:     { nome: "Gatinho", c: "#F2A65A", cL: "#FBD39A", cD: "#C9773E", orelha: "#F4A0B4", coleira: C.sky, nariz: "#E87A90" },
  cachorro: { nome: "Cachorrinho", c: "#E2BC8A", cL: "#F6E3C4", cD: "#B38A5A", orelha: "#8C5E3A", coleira: C.coral, nariz: "#3A2433" }
};
const PET_FOME_H = 10, PET_CARINHO_H = 14, PET_TRISTE = 25;
const PET_SLOT = 20000, PET_COMER_MS = 25000;
function petNivel(ts, horas, t){ return ts ? clamp(100 - ((t || srvNow()) - ts) / (horas * HORA) * 100, 0, 100) : 0; }
function petFome(t){ return pet ? petNivel(pet.comeu, PET_FOME_H, t) : 0; }
function petCarinho(t){ return pet ? petNivel(pet.carinho, PET_CARINHO_H, t) : 0; }
function petTriste(t){ return !!pet && (petFome(t) < PET_TRISTE || petCarinho(t) < PET_TRISTE); }
function petPoteCheio(){ return !!pet && srvNow() - (pet.comeu || 0) < 3 * HORA; }
function petNome(){ return (pet && pet.nome) || "Bichinho"; }

let petTiles = [], petCantos = [], occVer = 0;
const petPaths = new Map();
function rebuildPetTiles(){
  petTiles = []; petCantos = []; occVer++; petPaths.clear();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
    if (MAP[y][x] !== 0 || !walkable(x, y)) continue;
    petTiles.push([x, y]);
    const bloq = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx, dy]) => !walkable(x + dx, y + dy)).length;
    if (bloq >= 2) petCantos.push([x, y]);
  }
}
function petPick(k, triste){
  const lista = triste && petCantos.length ? petCantos : petTiles;
  if (!lista.length) return [10, 4];
  // triste: fica no mesmo canto por uma hora
  return lista[(triste ? hash(Math.floor(k * PET_SLOT / HORA), salaSeed, 91) : hash(k, salaSeed, 77)) % lista.length];
}
function poteSpot(){
  const id = primeiro("pote"); if (!id) return null; const m = moveis[id];
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (walkable(m.x + dx, m.y + dy)) return [m.x + dx, m.y + dy, m.x];
  return null;
}
// pontos de parada no tempo: um por "slot" de 20 s, mais a ida ao pote quando alguém dá comida
function petAncoras(t){
  const k = Math.floor(t / PET_SLOT); let out = [];
  for (let i = k - 4; i <= k; i++) out.push({ t: i * PET_SLOT, k: i });
  const ps = poteSpot();
  if (pet && pet.comeu && ps && pet.comeu > t - 4 * PET_SLOT && pet.comeu <= t){
    const c0 = pet.comeu, c1 = c0 + PET_COMER_MS;
    out = out.filter(a => !(a.t >= c0 && a.t < c1));
    out.push({ t: c0, comer: ps });
    if (c1 <= t) out.push({ t: c1, k: Math.floor(c1 / PET_SLOT) });
  }
  out.sort((a, b) => a.t - b.t);
  return out.slice(-2);
}
function petTileDe(a){ return a.comer ? [a.comer[0], a.comer[1]] : petPick(a.k, petTriste(a.t)); }
function petPath(a, b){
  const key = a + "|" + b + "|" + occVer;
  if (!petPaths.has(key)){ if (petPaths.size > 300) petPaths.clear(); petPaths.set(key, a[0] === b[0] && a[1] === b[1] ? [] : bfs(a[0], a[1], (x, y) => x === b[0] && y === b[1])); }
  return petPaths.get(key);
}
function petEstado(t){
  const [A, B] = petAncoras(t), from = petTileDe(A), to = petTileDe(B), triste = petTriste(t);
  const path = petPath(from, to), vel = triste ? 1.3 : 2.4, passos = (t - B.t) / 1000 * vel;
  const st = { x: to[0], y: to[1], pose: "sit", esq: hash(B.k || 3, salaSeed, 8) % 2 === 0, triste };
  const pts = path ? [from].concat(path) : [to];
  const ladoAte = i => { for (let j = Math.min(i, pts.length - 1); j > 0; j--){ const d = pts[j][0] - pts[j - 1][0]; if (d) return d < 0; } return st.esq; };
  if (path && passos < path.length){
    const i = Math.floor(passos), f = passos - i, p0 = pts[i], p1 = pts[i + 1];
    st.x = p0[0] + (p1[0] - p0[0]) * f; st.y = p0[1] + (p1[1] - p0[1]) * f; st.pose = "walk"; st.esq = ladoAte(i + 1);
  } else {
    st.esq = ladoAte(pts.length - 1);
    if (B.comer){ st.pose = "eat"; st.esq = B.comer[2] < to[0]; }
    else if (!triste){ const h = hourNow(), noite = h >= 22 || h < 7; if (hash(B.k, salaSeed, 5) % 4 < (noite ? 3 : 1)) st.pose = "sleep"; }
  }
  return st;
}

// arte: bichinho visto de lado, virado para a direita (17x13); o espelhado sai do mesmo sprite
function drawPet(tipo, x, y, pose, f, triste){
  const p = PET_TIPOS[tipo] || PET_EXTRA[tipo] || PET_TIPOS.gato, c = p.c, cL = p.cL, cD = p.cD, ink = "#2E2638", bl = "rgba(238,96,110,.6)", gato = tipo !== "cachorro";
  if (pose === "sleep"){
    rbox(x + 2, y + 6 - f, 12, 7 + f, c); R(x + 3, y + 6 - f, 9, 1, cL);
    if (gato){ P(x + 5, y + 8, cD); P(x + 7, y + 7, cD); P(x + 9, y + 8, cD); } else R(x + 4, y + 7, 3, 2, p.orelha);
    R(x + 3, y + 11, 7, 1, sh(c, -.12)); P(x + 2, y + 11, gato ? cD : cL);
    rbox(x + 9, y + 5, 7, 6, c); R(x + 10, y + 5, 5, 1, cL);
    if (gato){ P(x + 9, y + 4, c); P(x + 15, y + 4, c); P(x + 10, y + 5, p.orelha); P(x + 14, y + 5, p.orelha); }
    else { R(x + 8, y + 6, 2, 4, p.orelha); R(x + 15, y + 6, 2, 4, p.orelha); }
    R(x + 10, y + 8, 2, 1, ink); R(x + 13, y + 8, 2, 1, ink);
    R(x + 12, y + 9, 1, 1, p.nariz); P(x + 10, y + 9, bl); P(x + 15, y + 9, bl);
    return;
  }
  const walk = pose === "walk", eat = pose === "eat", jump = pose === "jump";
  // cauda
  if (triste){ R(x + 1, y + 7, 1, 3, c); P(x, y + 10, gato ? cD : cL); }
  else if (gato){ R(x + 1, y + 3, 1, 4, c); if (f){ P(x + 1, y + 2, c); P(x + 2, y + 1, cD); } else { P(x, y + 2, c); P(x, y + 1, cD); } }
  else { R(x + 1, y + 4, 1, 3, c); P(f ? x + 2 : x, y + 3, cL); }
  // patas do fundo, corpo e patas da frente
  const near = walk && f ? [2, 10] : [3, 9], far = walk && f ? [5, 7] : [5, 11];
  for (const a of far) R(x + a, y + 10, 1, 3, cD);
  rbox(x + 2, y + 5, 10, 5, c); R(x + 3, y + 5, 7, 1, cL); R(x + 4, y + 9, 6, 1, cL);
  if (gato){ P(x + 5, y + 6, cD); P(x + 7, y + 6, cD); P(x + 9, y + 6, cD); P(x + 5, y + 7, cD); P(x + 7, y + 7, cD); }
  else { R(x + 4, y + 6, 3, 2, p.orelha); P(x + 4, y + 6, sh(p.orelha, .2)); }
  for (const a of near){ R(x + a, y + 10, 2, 3, c); R(x + a, y + 12, 2, 1, cL); }
  // cabeça (comendo: abaixada)
  const hx = x + (eat ? 1 : 0), hy = y + (eat ? 4 + f : triste ? 2 : 1);
  if (gato){
    if (triste){ R(hx + 7, hy + 2, 2, 1, cD); R(hx + 15, hy + 2, 2, 1, cD); }
    else { R(hx + 9, hy, 2, 1, c); P(hx + 9, hy - 1, c); P(hx + 10, hy, p.orelha); R(hx + 14, hy, 2, 1, c); P(hx + 15, hy - 1, c); P(hx + 14, hy, p.orelha); }
  }
  rbox(hx + 9, hy + 1, 7, 6, c); R(hx + 10, hy + 1, 5, 1, cL);
  if (gato) R(hx + 12, hy + 1, 2, 1, cD);
  else { const oy = triste ? 3 : jump ? 1 : 2, oh = triste ? 5 : 4; R(hx + 8, hy + oy, 2, oh, p.orelha); R(hx + 15, hy + oy, 2, oh, p.orelha); P(hx + 8, hy + oy + oh - 1, sh(p.orelha, -.2)); P(hx + 16, hy + oy + oh - 1, sh(p.orelha, -.2)); }
  // rosto
  if (eat){ R(hx + 10, hy + 4, 2, 1, ink); R(hx + 13, hy + 4, 2, 1, ink); }
  else if (jump){ for (const ex of [10, 13]){ P(hx + ex, hy + 4, ink); P(hx + ex + 1, hy + 3, ink); P(hx + ex + 2, hy + 4, ink); } }
  else if (triste){ P(hx + 11, hy + 4, ink); P(hx + 14, hy + 4, ink); P(hx + 10, hy + 3, cD); P(hx + 15, hy + 3, cD); P(hx + 11, hy + 5, "#9FD3F2"); }
  else { R(hx + 11, hy + 3, 1, 2, ink); R(hx + 14, hy + 3, 1, 2, ink); }
  if (gato){ R(hx + 11, hy + 5, 4, 1, cL); R(hx + 12, hy + 4, 2, 1, p.nariz); }
  else { R(hx + 11, hy + 4, 4, 2, cL); R(hx + 12, hy + 4, 2, 1, p.nariz); if (jump || (!triste && !eat && f)) P(hx + 13, hy + 6, "#F07A90"); }
  if (!triste){ P(hx + 10, hy + 5, bl); P(hx + 15, hy + 5, bl); }
  // coleira (o gatinho de rua não tem)
  if (!p.semColeira){ R(hx + 10, hy + 7, 5, 1, p.coleira); P(hx + 12, hy + 8, C.gold); }
}
function petSprite(tipo, pose, f, esq, triste){
  const key = ["pet", tipo, pose, f, triste ? 1 : 0].join(":");
  const base = sprite(key, 17, 13, (ox, oy) => drawPet(tipo, ox, oy, pose, f, triste));
  if (!esq) return base;
  return sprite(key + ":esq", 17, 13, () => { ctx.save(); ctx.translate(base.c.width, 0); ctx.scale(-1, 1); ctx.drawImage(base.c, 0, 0); ctx.restore(); }, false);
}
function drawNuvem(cx, ty, tm){
  R(cx - 3, ty, 6, 1, "#B4BACC"); R(cx - 4, ty + 1, 8, 2, "#B4BACC"); R(cx - 3, ty + 3, 6, 1, "#8E94AA"); P(cx - 2, ty, "#DDE1EC"); P(cx - 3, ty + 1, "#DDE1EC");
  const g = Math.floor(tm / 160) % 5; if (g < 4){ P(cx - 2, ty + 4 + g, "#7FB8E8"); P(cx + 1, ty + 5 + (g + 2) % 4, "#7FB8E8"); }
}
function addPetObj(objs, tm){
  petView = null;
  if (!pet || !PET_TIPOS[pet.tipo]) return;
  const now = srvNow();
  const tq = truqueAtivo(now); if (tq) return addPetTruque(objs, tm, now, tq); // leva 5: truque em andamento
  const st = petEstado(now);
  const alegre = now - Math.max(pet.carinho || 0, pet.comeu || 0) < 3500;
  let pose = st.pose, f = 0, oy = 0;
  if (pose === "walk") f = Math.floor(tm / 150) % 2;
  else if (pose === "eat") f = Math.floor(tm / 260) % 2;
  else if (pose === "sleep") f = Math.floor(tm / 1100) % 2;
  else f = Math.floor(tm / 650) % 2;
  if (alegre && pose !== "walk"){ pose = "jump"; f = 0; oy = -Math.round(Math.abs(Math.sin(tm / 140)) * 5); }
  const cx = Math.round((st.x + .5) * T), by = Math.round((st.y + 1) * T - 3);
  petView = { cx, by, pose, triste: st.triste };
  objs.push({ z: by - .5, f: () => {
    R(cx - 5 - oy / 2, by + 1, 10 + oy, 1, "rgba(35,18,40,.25)");
    ctx.drawImage(petSprite(pet.tipo, pose, f, st.esq, st.triste).c, cx - 9, by - 13 + oy);
    if (st.triste) drawNuvem(cx + (st.esq ? -3 : 3), by - 19, tm);
  } });
}
function petAt(wx, wy, folga){ return petView && Math.hypot(wx - petView.cx, wy - (petView.by - 6)) < 11 + (folga || 0); }
// cuidar: grava o timestamp e quem cuidou (todos veem e o bichinho pula)
function petCuidar(campo){
  if (!pet) return;
  ref(petNo()).update({ [campo]: TS(), [campo + "Por"]: pid }).catch(() => {});
  if (campo === "carinho"){ ganharNeeds({ social: 10, diversao: 8 }); toast(petNome() + (pet.tipo === "cachorro" ? " abanou o rabinho de felicidade." : " ronronou de felicidade.")); statMais("carinhos"); sfx(pet.tipo === "cachorro" ? "latido" : "ronronar"); }
  else avisarComeu(null, petNome(), petNome() + " comeu tudinho 😋");
}
// v40: encher o pote não é o bichinho comer: ele ainda vai andando até lá. Avisa que está vindo, toca o som quando ele
// chega no pote e só diz "comeu tudinho" quando termina de comer (PET_COMER_MS depois). Sem pote, come na hora.
function avisarComeu(id, nome, msgFim){
  if (!poteSpot()){ toast(msgFim); sfx("comida"); return; }
  toast(nome + " ouviu a ração e está vindo comer 🐾");
  const fim = srvNow() + PET_COMER_MS; let chegou = false;
  const tick = setInterval(() => {
    const p = id ? pets[id] : pet; if (!p){ clearInterval(tick); return; }
    const st = id && typeof comPet === "function" ? comPet(id, () => (typeof petEstado0 === "function" ? petEstado0 : petEstado)(srvNow())) : petEstado(srvNow());
    if (!chegou && st.pose === "eat"){ chegou = true; sfx("comida"); }
    if (srvNow() >= fim){ clearInterval(tick); toast(msgFim); }
  }, 500);
}
const ACAO_POTE = { id: "pet-comida", nome: "Enchendo o pote", dur: 3, ganho: {}, fim: () => petCuidar("comeu") };
function petIrAte(acao){
  const pv = petEstado(srvNow()), tx = Math.round(pv.x), ty = Math.round(pv.y);
  goTo(null, (x, y) => Math.abs(x - tx) + Math.abs(y - ty) <= 1, () => { faceTo(tx, ty); startAcao(acao); });
}
const petLonge = () => { if (andarAtual === 0) return false; toast(petNome() + " está lá embaixo. Desça a escada pra cuidar."); return true; }; // leva 4
function petDarComida(){ if (petLonge()) return; const pt = primeiro("pote"); if (pt) useFurn(pt, ACAO_POTE); else petIrAte({ id: "pet-comida", nome: "Dando comida", dur: 3, ganho: {}, fim: () => petCuidar("comeu") }); }
function petFazerCarinho(){ if (petLonge()) return; petIrAte({ id: "pet-carinho", nome: "Fazendo carinho em " + petNome(), dur: 3, ganho: {}, fim: () => petCuidar("carinho") }); }
function petMenu(p){
  if (!pet) return;
  openMenu(p, petNome() + (petTriste() ? " está tristinho" : ""), [
    { nome: "Dar comida", info: "Fome " + Math.round(petFome()) + "%", fn: petDarComida },
    { nome: "Fazer carinho", info: "Carinho " + Math.round(petCarinho()) + "%", fn: petFazerCarinho },
    { nome: "Pedir truque", info: truquesSabe().length ? truquesSabe().length + (truquesSabe().length > 1 ? " truques" : " truque") : carinhosTotal() + "/" + TRUQUES[0].meta + " carinhos", fn: () => menuTruques(p) }, // leva 5
    { nome: "Nome e jeitinho", fn: openPetPanel }
  ]);
}
function openPetPanel(){
  if (!pet) return;
  openPanel("pet", "Bichinho da casa", corpo => {
    const tipo = { v: pet.tipo || "gato" };
    const lbl = el("label", "lbl", "Nome"); lbl.htmlFor = "petNome";
    const inp = el("input"); inp.type = "text"; inp.id = "petNome"; inp.maxLength = 16; inp.value = petNome();
    const seg = el("div", "seg");
    const pinta = () => { for (const b of seg.children) b.setAttribute("aria-pressed", String(b.dataset.t === tipo.v)); };
    for (const [k, t] of Object.entries(PET_TIPOS)){ const b = btn(t.nome, "btn ghost", () => { tipo.v = k; pinta(); }); b.dataset.t = k; seg.append(b); }
    pinta();
    const salvar = btn("Salvar", "btn", () => {
      const nome = inp.value.trim().slice(0, 16); if (!nome){ toast("Dê um nome pro bichinho."); inp.focus(); return; }
      ref(petNo()).update({ nome, tipo: tipo.v }).then(() => { toast("Agora é " + nome + "."); closePanel(); }).catch(() => toast("Não deu pra salvar."));
    });
    const est = el("div", "petbars"), dica = el("p", "muted");
    const acoes = el("div", "hbtns");
    acoes.append(btn("Dar comida", "btn ghost", () => { closePanel(); petDarComida(); }), btn("Fazer carinho", "btn ghost", () => { closePanel(); petFazerCarinho(); }));
    const fim = el("div"); fim.append(salvar);
    const truq = el("div", "list"); // leva 5: truques e barra até o próximo
    corpo.append(est, dica, acoes, el("h3", null, "Truques"), truq, lbl, inp, el("span", "lbl", "Tipo"), seg, fim);
    const upd = () => {
      if (!pet) return;
      montarTruques(truq);
      est.textContent = "";
      for (const [n, v, cor] of [["Fome", petFome(), "#EF9F27"], ["Carinho", petCarinho(), "#D4537E"]]){ const w = el("div", "need"), r = el("div", "row"); r.append(el("span", null, n), el("span", null, Math.round(v) + "%")); w.append(r, barra(v, cor)); est.append(w); }
      dica.textContent = petTriste() ? petNome() + " está tristinho e quietinho num canto. Um carinho e comida resolvem." : "Comeu " + quando(pet.comeu || 0) + " · último carinho " + quando(pet.carinho || 0) + ".";
    };
    upd(); return upd;
  });
}

// ---------------- horta ----------------
// casa/jardim/<id do canteiro> = { tipo, plantado, ultimaRega, cresc, por }
// cresc = crescimento (ms) acumulado até a última rega. Cada rega vale JARDIM_SECA_H horas;
// depois disso a planta murcha e para de crescer até alguém regar.
const SEMENTES = {
  flor:     { nome: "Flor", preco: 10, horas: 2, colhe: { moedas: 35 } },
  tomate:   { nome: "Tomate", preco: 15, horas: 3, colhe: { despensa: { tomate: 3 } } },
  morango:  { nome: "Morango", preco: 20, horas: 4, colhe: { despensa: { morango: 3 } } },
  girassol: { nome: "Girassol", preco: 25, horas: 6, colhe: { moedas: 110 } }
};
const JARDIM_SECA_H = 2;
function plantaInfo(p, t){
  const s = p && SEMENTES[p.tipo]; if (!s) return null;
  t = t || srvNow();
  const seca = JARDIM_SECA_H * HORA, { g, desde } = crescAte(p, t), total = s.horas * HORA, pr = clamp(g / total, 0, 1);
  return { s, pr, estagio: pr >= 1 ? 3 : pr >= .55 ? 2 : pr >= .15 ? 1 : 0, pronta: pr >= 1, murcha: pr < 1 && desde > seca, sede: pr < 1 && desde > seca * .7, falta: total - g };
}
function drawPlanta(tipo, est, murcha, x, y){
  const lf = murcha ? "#B7A24E" : C.leaf, lD = murcha ? "#8F7A35" : C.leafD, lL = murcha ? "#D2C070" : C.leafL;
  if (est === 0){ R(x + 3, y + 14, 6, 2, "#7A5236"); R(x + 4, y + 13, 4, 1, "#7A5236"); P(x + 5, y + 13, "#F1DFA8"); P(x + 7, y + 14, "#F1DFA8"); if (!murcha) P(x + 6, y + 12, C.leafL); return; }
  if (est === 1){ R(x + 6, y + 11, 1, 5, lD); R(x + 3, y + 10, 3, 2, lf); P(x + 3, y + 10, lL); R(x + 7, y + 9, 3, 2, lf); P(x + 9, y + 9, lL); return; }
  if (tipo === "morango" && est === 3){
    R(x + 1, y + 10, 10, 5, lf); R(x + 2, y + 9, 8, 1, lf); P(x + 3, y + 10, lL); P(x + 8, y + 10, lL); R(x + 5, y + 11, 2, 4, lD);
    for (const [a, b] of [[2, 12], [8, 11], [5, 13]]){ R(x + a, y + b, 2, 2, "#E8445E"); P(x + a, y + b + 2, "#E8445E"); P(x + a + 1, y + b, "#FCE9A0"); }
    return;
  }
  const alto = tipo === "girassol" ? 2 : 5;
  R(x + 6, y + alto, 1, 16 - alto, lD);
  R(x + 2, y + 11, 4, 2, lf); P(x + 2, y + 11, lL); R(x + 7, y + 9, 4, 2, lf); P(x + 10, y + 9, lL);
  R(x + 3, y + 6, 3, 2, lf); R(x + 7, y + 5, 3, 2, lf); P(x + 7, y + 5, lL);
  if (est === 2){
    if (tipo === "flor") R(x + 5, y + 3, 3, 2, murcha ? "#C9A0A8" : "#F9C9D6");
    else if (tipo === "girassol") R(x + 5, y + 1, 3, 2, lD);
    else if (tipo === "tomate"){ P(x + 3, y + 9, "#9ACB5A"); P(x + 9, y + 7, "#9ACB5A"); }
    else { P(x + 3, y + 10, "#FFFFFF"); P(x + 9, y + 8, "#FFFFFF"); }
    return;
  }
  if (tipo === "flor"){ const pe = "#EE9AB2"; R(x + 5, y + 0, 3, 1, pe); R(x + 4, y + 1, 5, 3, pe); R(x + 5, y + 4, 3, 1, pe); P(x + 5, y + 1, "#F9C9D6"); P(x + 6, y + 2, C.gold); P(x + 7, y + 2, "#E0A848"); }
  else if (tipo === "girassol"){ const am = "#F6C431"; R(x + 4, y + 0, 5, 1, am); R(x + 3, y + 1, 7, 4, am); R(x + 4, y + 5, 5, 1, am); R(x + 5, y + 2, 3, 2, "#7A4A22"); P(x + 5, y + 2, "#A0662E"); P(x + 3, y + 1, "#FCE08A"); }
  else { for (const [a, b] of [[2, 8], [8, 10], [7, 4]]){ R(x + a, y + b, 3, 3, "#E04A3A"); P(x + a, y + b, "#F4806E"); P(x + a + 1, y + b - 1, C.leafD); } }
}
function plantaSprite(tipo, est, murcha){ return sprite(["pl", tipo, est, murcha ? 1 : 0].join(":"), 12, 16, (ox, oy) => drawPlanta(tipo, est, murcha, ox, oy)); }
function drawGota(x, y){ P(x + 1, y, "#9FD3F2"); R(x, y + 1, 3, 2, "#7FB8E8"); P(x + 1, y + 3, "#5F96C8"); P(x, y + 1, "#DDF1FC"); }
function regar(id){
  return txn("casa/jardim/" + id, cur => {
    if (!cur) return;
    const t = srvNow();
    cur.cresc = crescAte(cur, t).g; cur.ultimaRega = t; cur.regouPor = pid; // crescAte já conta a chuva como rega
    return cur;
  }).then(ok => toast(ok ? "Planta regada. Ela agradece." : "Não tinha planta pra regar."));
}
function plantar(id, tipo){
  const s = SEMENTES[tipo];
  return txn("casa/jardim/" + id, cur => { if (cur) return; const t = srvNow(); return { tipo, plantado: t, ultimaRega: t, cresc: 0, por: pid }; })
    .then(ok => { if (ok) toast(s.nome + " plantado. Fica pronto em " + s.horas + "h se regarem."); else { ganhar(s.preco); toast("Alguém plantou antes. Devolvi o dinheiro."); } });
}
function colher(id){
  return txn("casa/jardim/" + id, cur => { const inf = plantaInfo(cur); if (!inf || !inf.pronta) return; return null; }).then(ok => {
    const p = jardimAntes[id]; const s = p && SEMENTES[p.tipo];
    if (!ok || !s){ toast("Não tinha nada pronto pra colher."); return; }
    if (s.colhe.moedas){ ganhar(s.colhe.moedas); toast("Colheu " + s.nome.toLowerCase() + ". Vendeu por $" + s.colhe.moedas + "."); }
    if (s.colhe.despensa){ mexerDespensa(s.colhe.despensa); toast("Colheu " + Object.values(s.colhe.despensa)[0] + " " + s.nome.toLowerCase() + (Object.values(s.colhe.despensa)[0] > 1 ? "s" : "") + ". Foi pra despensa."); }
    ganharNeeds({ diversao: 8 });
    statMais("colheitas");
  });
}
let jardimAntes = {};
MENU_EXTRA.canteiro = id => {
  const p = jardim[id], inf = plantaInfo(p);
  if (!inf) return [{ nota: 1, nome: "Vazio. Escolha uma semente:" }].concat(Object.entries(SEMENTES).map(([k, s]) => ({
    nome: "Plantar " + s.nome.toLowerCase(), info: "$" + s.preco + " · " + s.horas + "h",
    fn: () => useFurn(id, { id: "plantar", nome: "Plantando " + s.nome.toLowerCase(), dur: 3, ganho: { diversao: 4 }, antes: () => gastar(s.preco, "a semente"), cancel: () => ganhar(s.preco), fim: () => plantar(id, k) })
  })));
  const fase = inf.pronta ? "pronto pra colher" : inf.murcha ? "murchou, precisa de água" : ["semente", "broto", "crescendo", ""][inf.estagio] + " · falta " + duracao(inf.falta);
  const it = [{ nota: 1, nome: inf.s.nome + ": " + fase }];
  if (inf.pronta) it.push({ nome: "Colher", info: inf.s.colhe.moedas ? "+$" + inf.s.colhe.moedas : "Despensa", fn: () => useFurn(id, { id: "colher", nome: "Colhendo", dur: 2, ganho: {}, antes: () => { jardimAntes[id] = jardim[id]; return true; }, fim: () => colher(id) }) });
  else it.push({ nome: "Regar", info: climaAgora() ? "A chuva já rega" : inf.murcha ? "Urgente" : inf.sede ? "Com sede" : "Tudo certo", fn: () => useFurn(id, { id: "regar", nome: "Regando", dur: 3, ganho: { diversao: 5 }, fim: () => regar(id) }) });
  if (!inf.pronta) it.push({ nome: "Arrancar", info: "Perde a planta", fn: () => useFurn(id, { id: "arrancar", nome: "Arrancando", dur: 2, ganho: {}, fim: () => ref("casa/jardim/" + id).remove().then(() => toast("Canteiro vazio de novo.")) }) });
  return it;
};
MENU_EXTRA.pote = () => [{ nome: "Encher o pote", info: petNome(), fn: () => petDarComida() }];

// ---------------- cozinha ----------------
// casa/despensa = { ingrediente: quantidade }   (compartilhada; mexer só por mexerDespensa)
// casa/pratos/<push> = { receita, porcoes, por, at, junto }
const INGREDIENTES = {
  ovo:      { nome: "Ovo", preco: 4 },
  leite:    { nome: "Leite", preco: 6 },
  farinha:  { nome: "Farinha", preco: 5 },
  macarrao: { nome: "Macarrão", preco: 8 },
  alface:   { nome: "Alface", preco: 5 },
  tomate:   { nome: "Tomate", preco: 6, horta: 1 },
  morango:  { nome: "Morango", preco: 9, horta: 1 }
};
const RECEITAS = {
  omelete:  { nome: "Omelete", ing: { ovo: 2, leite: 1 }, dur: 8, porcoes: 2, ganho: { fome: 45 } },
  macarrao: { nome: "Macarrão ao sugo", ing: { macarrao: 1, tomate: 2 }, dur: 12, porcoes: 3, ganho: { fome: 60 } },
  salada:   { nome: "Salada", ing: { alface: 1, tomate: 1 }, dur: 6, porcoes: 2, ganho: { fome: 30, energia: 8 } },
  bolo:     { nome: "Bolo de morango", ing: { farinha: 1, ovo: 2, leite: 1, morango: 2 }, dur: 16, porcoes: 4, ganho: { fome: 35, diversao: 20 } }
};
function mexerDespensa(delta){
  return txn("casa/despensa", cur => {
    const d = Object.assign({}, cur || {});
    for (const [k, v] of Object.entries(delta)){ const n = (d[k] || 0) + v; if (n < 0) return; d[k] = n || null; }
    return d;
  });
}
const negativo = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, -v]));
const temTudo = ing => Object.entries(ing).every(([k, v]) => (despensa[k] || 0) >= v);
function drawIngr(k, x, y){
  switch (k){
    case "ovo": rbox(x + 2, y + 1, 4, 6, "#FFF8EC"); R(x + 1, y + 3, 6, 3, "#FFF8EC"); P(x + 3, y + 2, "#FFFFFF"); R(x + 2, y + 6, 4, 1, "#E9D8BE"); break;
    case "leite": R(x + 2, y + 2, 4, 6, "#FFFFFF"); R(x + 2, y + 1, 4, 1, C.sky); P(x + 3, y, C.sky); R(x + 2, y + 4, 4, 2, C.sky); P(x + 5, y + 2, "#E6EEF4"); break;
    case "farinha": rbox(x + 1, y + 2, 6, 6, "#F1E4C8"); R(x + 2, y + 1, 4, 1, "#D9C49A"); R(x + 2, y + 4, 4, 2, "#D9C49A"); P(x + 3, y + 4, "#FFF8EC"); break;
    case "macarrao": R(x + 1, y + 2, 6, 5, "#F2D58A"); R(x + 1, y + 3, 6, 1, "#E0B85A"); R(x + 1, y + 5, 6, 1, "#E0B85A"); R(x + 3, y + 2, 2, 5, C.coral); break;
    case "alface": rbox(x + 1, y + 2, 6, 6, "#7FC27A"); R(x + 2, y + 3, 4, 4, "#A8DC8C"); P(x + 4, y + 4, "#6DBB5A"); R(x + 3, y + 1, 2, 1, "#7FC27A"); break;
    case "tomate": rbox(x + 1, y + 2, 6, 6, "#E04A3A"); P(x + 2, y + 3, "#F4806E"); R(x + 3, y + 1, 2, 1, C.leaf); P(x + 4, y, C.leafD); break;
    case "morango": R(x + 2, y + 2, 4, 4, "#E8445E"); R(x + 3, y + 6, 2, 1, "#E8445E"); R(x + 2, y + 1, 4, 1, C.leaf); P(x + 3, y + 3, "#FCE9A0"); P(x + 5, y + 4, "#FCE9A0"); P(x + 3, y + 5, "#FCE9A0"); break;
  }
}
function drawPrato(rk, x, y){
  rbox(x, y + 1, 9, 6, "#FFFFFF"); R(x + 1, y + 5, 7, 1, "#E6DDF0");
  if (rk === "omelete"){ rbox(x + 2, y + 2, 5, 3, "#F6D25A"); P(x + 3, y + 2, "#FCE9A0"); P(x + 5, y + 3, "#E0A93A"); P(x + 4, y + 3, "#7FC27A"); }
  else if (rk === "macarrao"){ R(x + 2, y + 2, 5, 3, "#F2D58A"); P(x + 3, y + 2, "#FCE9B8"); R(x + 3, y + 3, 3, 1, "#D9483D"); P(x + 4, y + 2, "#E8735F"); P(x + 5, y + 4, "#7FC27A"); }
  else if (rk === "salada"){ R(x + 2, y + 2, 5, 3, "#6DBB5A"); P(x + 3, y + 2, "#9AD67E"); P(x + 6, y + 2, "#9AD67E"); P(x + 5, y + 3, "#E04A3A"); P(x + 3, y + 4, "#E04A3A"); }
  else { R(x + 2, y + 1, 5, 4, "#F9C9D6"); R(x + 2, y + 1, 5, 1, "#FFFFFF"); R(x + 2, y + 3, 5, 1, "#E8607A"); P(x + 4, y, "#E8445E"); }
}
const ingSprite = k => sprite("ing:" + k, 8, 8, (ox, oy) => drawIngr(k, ox, oy));
const pratoSprite = rk => sprite("prato:" + rk, 9, 7, (ox, oy) => drawPrato(rk, ox, oy));
function comprar(k){
  const ing = INGREDIENTES[k]; if (!gastar(ing.preco, ing.nome.toLowerCase())) return;
  mexerDespensa({ [k]: 1 }).then(ok => { if (ok) toast(ing.nome + " na despensa. -$" + ing.preco); else { ganhar(ing.preco); toast("Não deu pra comprar agora."); } refreshPanel("cozinha"); });
}
function cozinhar(fogaoId, rk){
  const r = RECEITAS[rk];
  useFurn(fogaoId, {
    id: "coz-" + rk, nome: "Cozinhando " + r.nome.toLowerCase(), dur: r.dur, ganho: { diversao: 4 },
    junto: ja => /^coz-/.test(ja.id), juntoSocial: 2,
    antes: () => mexerDespensa(negativo(r.ing)).then(ok => { if (!ok) toast("Faltou ingrediente. Alguém usou antes?"); return ok; }),
    cancel: () => { mexerDespensa(r.ing); toast("Parou de cozinhar. Os ingredientes voltaram pra despensa."); },
    aoJuntar: (a, oid) => {
      const passou = Date.now() - a.ini, resta = Math.max(0, a.dur - passou);
      a.dur = Math.round(passou + resta * .65); setAcao(a);
      toast("Cozinhando com " + nomeDe(oid) + ": fica mais rápido e rende mais.");
    },
    fim: info => {
      const n = r.porcoes + (info.junto ? 1 : 0);
      if (info.junto) statMais("pratosJuntos");
      sujarLouca(fogaoId); // leva 5: louça na pia
      ref("casa/pratos").push({ receita: rk, porcoes: n, por: pid, at: TS(), junto: info.junto ? 1 : 0 }).catch(() => {});
      toast(r.nome + " na mesa: " + n + " porções" + (info.junto ? " (uma a mais por cozinharem juntos)." : ".") + (Object.values(todosMoveis).some(m => m && m.t === "mesa") ? "" : " Coloque uma mesa pra servir."));
    }
  });
}
const ACAO_AJUDAR = { id: "coz-ajuda", nome: "Ajudando na cozinha", dur: 10, ganho: { diversao: 12 }, junto: ja => /^coz-/.test(ja.id), juntoSocial: 3 };
function alguemCozinhando(){ return Object.entries(jogadores).find(([id, j]) => id !== pid && j.online && (j.andar || 0) === andarAtual && j.acao && /^coz-/.test(j.acao.id) && j.acao.id !== "coz-ajuda" && Date.now() - j.acao.ini < j.acao.dur + 2000); }
MENU_EXTRA.fogao = id => {
  const it = [{ nome: "Cozinhar uma receita", info: "Despensa", fn: () => openCozinha({ fogao: id }) }];
  const c = alguemCozinhando(); if (c) it.unshift({ nome: "Ajudar " + nomeDe(c[0]), info: "Mais rápido", fn: () => useFurn(id, ACAO_AJUDAR) });
  return it;
};
MENU_EXTRA.geladeira = id => [{ nome: "Fazer compras", info: "Ingredientes", fn: () => useFurn(id, { id: "compras", nome: "Olhando a geladeira", dur: 1, ganho: {}, fim: () => openCozinha({ loja: true }) }) }];
function pratosOrdenados(){ return Object.entries(pratos).filter(([, p]) => p && RECEITAS[p.receita] && p.porcoes > 0).sort((a, b) => (a[1].at || 0) - (b[1].at || 0)); }
function pegarPorcao(pk){
  return txn("casa/pratos/" + pk, cur => { if (!cur || !(cur.porcoes > 0)) return; if (cur.porcoes <= 1) return null; cur.porcoes--; return cur; })
    .then(ok => { if (!ok) toast("Acabou! Alguém comeu antes."); return ok; });
}
// um item por receita (soma as porções); come do prato mais antigo daquela receita
MENU_EXTRA.mesa = id => {
  const porRec = {};
  for (const [, p] of pratosOrdenados()) porRec[p.receita] = (porRec[p.receita] || 0) + p.porcoes;
  return Object.entries(porRec).map(([rk, n]) => {
    const r = RECEITAS[rk];
    return { nome: "Comer " + r.nome.toLowerCase(), info: n + (n > 1 ? " porções" : " porção"), fn: () => useFurn(id, {
      id: "comer", nome: "Comendo " + r.nome.toLowerCase(), dur: 10, ganho: r.ganho, junto: 1, juntoMult: 1.6, juntoSocial: 3,
      aoJuntar: (a, oid) => toast("Comendo junto com " + nomeDe(oid) + ": enche mais e dá social."),
      antes: () => { const p = pratosOrdenados().find(([, q]) => q.receita === rk); if (!p){ toast("Acabou! Alguém comeu antes."); return false; } return pegarPorcao(p[0]); }
    }) };
  });
};
function openCozinha(opts){
  opts = opts || {};
  openPanel("cozinha", opts.fogao ? "Fogão" : opts.loja ? "Geladeira" : "Despensa", corpo => {
    const ingBox = el("div", "list"), recBox = el("div", "list"), dinheiro = el("p", "money");
    const dica = el("p", "muted", opts.fogao ? "Escolha a receita. Se alguém ajudar no fogão, fica pronto mais rápido e rende uma porção a mais." :
      opts.loja ? "Tudo que comprar vai pra despensa da casa e qualquer um pode usar." : "Compre na geladeira, colha na horta e cozinhe no fogão.");
    const blocoIng = [el("h3", null, "Ingredientes"), ingBox], blocoRec = [el("h3", null, "Receitas"), recBox];
    corpo.append(dica, dinheiro, ...(opts.fogao ? blocoRec.concat(blocoIng) : blocoIng.concat(blocoRec)));
    const upd = () => {
      dinheiro.textContent = me ? "$ " + Math.floor(me.dinheiro) : "";
      ingBox.textContent = "";
      for (const [k, ing] of Object.entries(INGREDIENTES)){
        const row = el("div", "rowi"), tx = el("div", "tx"), n = despensa[k] || 0;
        tx.append(el("strong", null, ing.nome), el("small", null, n + " na despensa" + (ing.horta ? " · vem da horta" : "")));
        const esq = el("div", "me"); esq.style.gap = "10px"; esq.append(iconeSpr(ingSprite(k)), tx); row.append(esq);
        if (opts.loja){ const b = btn("Comprar $" + ing.preco, "btn small", () => comprar(k)); b.disabled = !me || me.dinheiro < ing.preco; b.setAttribute("aria-label", "Comprar " + ing.nome + " por $" + ing.preco); row.append(b); }
        ingBox.append(row);
      }
      recBox.textContent = "";
      for (const [rk, r] of Object.entries(RECEITAS)){
        const row = el("div", "rowi"), tx = el("div", "tx");
        const precisa = Object.entries(r.ing).map(([k, v]) => v + "× " + INGREDIENTES[k].nome.toLowerCase() + ((despensa[k] || 0) < v ? " (tem " + (despensa[k] || 0) + ")" : "")).join(", ");
        tx.append(el("strong", null, r.nome), el("small", null, precisa), el("small", null, r.porcoes + " porções · " + r.dur + " s"));
        const esq = el("div", "me"); esq.style.gap = "10px"; esq.append(iconeSpr(pratoSprite(rk)), tx); row.append(esq);
        if (opts.fogao){ const b = btn("Cozinhar", "btn small", () => { closePanel(); cozinhar(opts.fogao, rk); }); b.disabled = !temTudo(r.ing); row.append(b); }
        recBox.append(row);
      }
    };
    upd(); return upd;
  });
}

// ---------------- mural de bilhetes ----------------
// casa/mural/<push> = { autor: pid, nome, texto (até 200), cor (índice de PAPEIS), at }
// A última leitura fica no aparelho: localStorage "casinha-mural-<sala>".
const PAPEIS = ["#FCE9A0", "#F9C9D6", "#BFE5DA", "#C5E0F6", "#E2D6FA"];
const NOMES_PAPEL = ["Amarelo", "Rosa", "Verde", "Azul", "Lilás"];
const MURAL = { x: 11, y: 8 }; // quadro de cortiça fixo na parede da cozinha
// pontos fixos clicáveis na casa (paredes): { x, y, fn }
const HOTSPOTS = [{ x: MURAL.x, y: MURAL.y, fn: () => openMural() }];
let muralCor = 0;
function muralLido(){ return +(store.get("casinha-mural-" + sala) || 0); }
function muralLista(){ return Object.entries(mural).filter(([, b]) => b && b.texto).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)); }
function muralNovos(){ const l = muralLido(); return muralLista().filter(([, b]) => b.autor !== pid && (b.at || 0) > l).length; }
function avisoMural(){
  if (muralAvisado || !muralCarregado || !me) return; muralAvisado = true;
  const n = muralNovos(); if (n) setTimeout(() => toast(n === 1 ? "Tem um bilhete novo no mural." : "Tem " + n + " bilhetes novos no mural."), 900);
}
function drawMural(tm){
  const px = MURAL.x * T, py = MURAL.y * T, lista = muralLista().slice(0, 5), novos = muralNovos();
  R(px + 1, py + 3, 14, 10, C.woodD); R(px + 1, py + 3, 14, 1, C.wood); R(px + 1, py + 12, 14, 1, C.woodDD);
  R(px + 2, py + 4, 12, 8, "#C9965E");
  for (const [a, b] of [[3, 6], [9, 5], [12, 10], [6, 10], [11, 7], [4, 9]]) P(px + a, py + b, "#B07E48");
  [[3, 5], [8, 5], [11, 6], [4, 8], [8, 8]].forEach(([a, b], i) => {
    if (!lista[i]) return; const cor = PAPEIS[lista[i][1].cor] || PAPEIS[0];
    R(px + a, py + b, 3, 3, cor); P(px + a + 2, py + b + 2, sh(cor, -.15)); P(px + a + 1, py + b, "#E8607A");
  });
  if (novos){ ctx.globalAlpha = .45 + .45 * Math.sin(tm / 260); const g = "#FFE08A"; R(px, py + 2, 16, 1, g); R(px, py + 13, 16, 1, g); R(px, py + 2, 1, 12, g); R(px + 15, py + 2, 1, 12, g); ctx.globalAlpha = 1; }
}
function openMural(){
  const lidoAntes = muralLido();
  const marcarLido = () => { const max = muralLista().reduce((m, [, b]) => Math.max(m, b.at || 0), lidoAntes); store.set("casinha-mural-" + sala, String(max)); };
  marcarLido();
  openPanel("mural", "Mural de bilhetes", corpo => {
    const ta = el("textarea"); ta.maxLength = 200; ta.placeholder = "Escreva um bilhetinho..."; ta.setAttribute("aria-label", "Bilhete");
    const cont = el("small", "muted", "0/200");
    ta.addEventListener("input", () => cont.textContent = ta.value.length + "/200");
    const cores = el("div", "swatches");
    const pinta = () => { [...cores.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === muralCor))); ta.style.background = PAPEIS[muralCor]; ta.style.color = "#2E2638"; };
    PAPEIS.forEach((c, i) => { const b = btn("", "paper", () => { muralCor = i; pinta(); }); b.style.background = c; b.setAttribute("aria-label", "Papel " + NOMES_PAPEL[i]); cores.append(b); });
    pinta();
    const enviar = btn("Colar no mural", "btn", () => {
      const texto = ta.value.trim().slice(0, 200); if (!texto){ toast("Escreva alguma coisa primeiro."); ta.focus(); return; }
      enviar.disabled = true;
      ref("casa/mural").push({ autor: pid, nome: (me && me.dados && me.dados.nome) || "Alguém", texto, cor: muralCor, at: TS() })
        .then(() => { ta.value = ""; cont.textContent = "0/200"; toast("Bilhete colado no mural."); }, () => toast("Não deu pra colar o bilhete."))
        .then(() => { enviar.disabled = false; });
    });
    const linha = el("div", "toolbar"); linha.append(cores, cont);
    const notas = el("div", "notes"), vazio = el("p", "muted", "Nenhum bilhete ainda. Que tal deixar o primeiro?");
    corpo.append(ta, linha, enviar, el("h3", null, "Bilhetes"), vazio, notas);
    const upd = () => {
      notas.textContent = ""; const lista = muralLista(); vazio.hidden = lista.length > 0;
      for (const [k, b] of lista.slice(0, 60)){
        const n = el("div", "note" + (b.autor !== pid && (b.at || 0) > lidoAntes ? " new" : "")); n.style.background = PAPEIS[b.cor] || PAPEIS[0];
        const meta = el("div", "meta"); meta.append(el("span", null, (b.nome || "Alguém") + " · " + quando(b.at || 0)));
        if (b.autor === pid){
          const del = btn("Apagar", null); let certo = false;
          del.onclick = () => { if (!certo){ certo = true; del.textContent = "Certeza?"; setTimeout(() => { certo = false; del.textContent = "Apagar"; }, 3000); return; } ref("casa/mural/" + k).remove().then(() => toast("Bilhete apagado.")); };
          meta.append(del);
        }
        n.append(el("p", null, String(b.texto).slice(0, 200)), meta); notas.append(n);
      }
      marcarLido();
    };
    upd(); return upd;
  });
}

// ---------------- HUD da casa e desenho ----------------
function renderHouseCard(){
  const box = $("petLine"); if (!box) return;
  if (!box.firstChild){
    const nm = el("p", "nm"), sub = el("p", "muted"), bars = el("div", "petbars");
    sub.style.fontSize = ".82rem";
    for (const [id, n, cor] of [["f", "Fome", "#EF9F27"], ["c", "Carinho", "#D4537E"]]){ const w = el("div", "need"), r = el("div", "row"); r.append(el("span", null, n), el("span", "v")); w.append(r, barra(0, cor)); w.dataset.id = id; w.dataset.cor = cor; bars.append(w); }
    box.append(nm, sub, bars);
  }
  const [nm, sub, bars] = box.children;
  if (!pet){ nm.textContent = "Bichinho"; sub.textContent = "Chegando..."; return; }
  const pose = petView ? petView.pose : "", fr = Math.floor(Date.now() / 650) % 2;
  // leva 8: nada mudou desde a última vez: não mexe no DOM
  const sig = [petNome(), pet.tipo, pose, fr, petTriste(), Math.round(petFome()), Math.round(petCarinho()), muralNovos()].join("|");
  if (box.dataset.sig === sig) return; box.dataset.sig = sig;
  nm.textContent = petNome();
  const av = $("petAv"), ax = av.getContext("2d");
  ax.imageSmoothingEnabled = false; ax.clearRect(0, 0, 21, 17);
  ax.drawImage(petSprite(pet.tipo in PET_TIPOS ? pet.tipo : "gato", pose === "sleep" ? "sleep" : "sit", pose === "sleep" ? 0 : fr, false, petTriste()).c, 1, 1);
  sub.textContent = petTriste() ? "Tristinho. Precisa de carinho e comida." : pose === "sleep" ? "Dormindo." : pose === "eat" ? "Comendo." : "Feliz da vida.";
  for (const w of bars.children){ const v = w.dataset.id === "f" ? petFome() : petCarinho(), i = w.querySelector("i"); w.querySelector(".v").textContent = Math.round(v) + "%"; i.style.width = v + "%"; i.style.background = v < 25 ? "var(--bad)" : w.dataset.cor; }
  const bm = $("bMural"), n = muralNovos(); let d = bm.querySelector(".dot");
  if (n && !d){ d = el("span", "dot"); bm.append(d); } if (d){ if (n) d.textContent = n; else d.remove(); }
  bm.setAttribute("aria-label", n ? "Mural, " + n + " bilhete(s) novo(s)" : "Mural");
}
$("bMural").onclick = () => openMural();
$("bDespensa").onclick = () => openCozinha({});
$("bPet").onclick = () => openPets(); // leva 13: todos os bichinhos

function mesaPrincipal(){ const id = primeiro("mesa"); return id ? moveis[id] : null; }
// plantas, pratos e bichinho entram na lista de objetos ordenados pela base
function addCasaObjs(objs, tm){
  for (const [id, m] of Object.entries(moveis)){
    if (m.t !== "canteiro" || !jardim[id]) continue;
    const inf = plantaInfo(jardim[id]); if (!inf) continue;
    const x = m.x * T, y = m.y * T;
    objs.push({ z: (m.y + 1) * T - .5, f: () => {
      ctx.drawImage(plantaSprite(jardim[id].tipo, inf.estagio, inf.murcha).c, x + 1, y - 12);
      if (inf.sede) drawGota(x + 11, y - 9 + Math.round(Math.sin(tm / 300)));
      if (inf.pronta){ const k = Math.floor(tm / 350 + m.x) % 6; if (k < 3){ ctx.globalAlpha = .9; P(x + 3 + k * 4, y - 9 + k * 3, "#FFFFFF"); ctx.globalAlpha = 1; } }
    } });
  }
  const mesa = mesaPrincipal(), lista = pratosOrdenados();
  if (mesa && lista.length){
    const x = mesa.x * T, y = mesa.y * T;
    objs.push({ z: (mesa.y + 2) * T - .5, f: () => {
      [[2, 5], [21, 15]].forEach(([a, b], i) => {
        const p = lista[i]; if (!p) return;
        ctx.drawImage(pratoSprite(p[1].receita).c, x + a - 1, y + b - 1);
        if (srvNow() - (p[1].at || 0) < 180000) for (let j = 0; j < 2; j++){ const ph = (tm / 1300 + j / 2) % 1; ctx.globalAlpha = .7 * (1 - ph); P(x + a + 3 + j * 3 + Math.round(Math.sin(tm / 300 + j)), y + b - 1 - ph * 7, "#FFFFFF"); }
        ctx.globalAlpha = 1;
      });
    } });
  }
  if (andarAtual === 0) addPetObj(objs, tm); else petView = null; // o bichinho mora no térreo
}
// textos em alta resolução da leva 1 (ícones do bichinho e aviso do mural)
function drawCasaLabels(mctx, K, fs, tm){
  if (petView){
    const icon = petView.pose === "sleep" ? "zZ" : petView.pose === "jump" ? "♥" : null;
    if (icon){ mctx.fillStyle = icon === "♥" ? "#F0707A" : "#CECBF6"; mctx.fillText(icon, (petView.cx + 7) * K, (petView.by - 12) * K - Math.sin(tm / 300) * K * 1.5); }
  }
  if (mode === "live" && andarAtual === 0 && muralNovos()){ mctx.fillStyle = "#FAC775"; mctx.fillText("!", (MURAL.x * T + 8) * K, (MURAL.y * T + 3) * K - Math.abs(Math.sin(tm / 250)) * K * 2); }
}
