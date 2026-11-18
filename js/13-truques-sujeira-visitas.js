"use strict";
// Casinha · leva 5: truques do bichinho, sujeira e faxina, visitas
// ---------------- truques do bichinho ----------------
const TRUQUES = [
  { id: "senta", nome: "Sentar", fala: "Senta!", meta: 10 },
  { id: "pata", nome: "Dar a pata", fala: "Dá a pata!", meta: 25 },
  { id: "rolar", nome: "Rolar", fala: "Rola!", meta: 50 },
  { id: "pirueta", nome: "Pirueta no ar", fala: "Pirueta!", meta: 100 }
];
const TRUQUE_MS = 3600;
const carinhosTotal = () => stats.carinhos || 0;
const truquesSabe = () => TRUQUES.filter(t => carinhosTotal() >= t.meta);
const proxTruque = () => TRUQUES.find(t => carinhosTotal() < t.meta);
function truqueAtivo(t){ const q = pet && pet.truque; return q && q.at && t - q.at >= 0 && t - q.at < TRUQUE_MS && TRUQUES.some(x => x.id === q.tipo) ? q : null; }
function pedirTruque(tq){
  if (petLonge()) return;
  if (truqueAtivo(srvNow())){ toast(petNome() + " ainda está no meio do truque."); return; }
  petIrAte({ id: "pet-truque", nome: "Pedindo: " + tq.fala, dur: 1.2, ganho: {}, fim: () => {
    ref("jogadores/" + pid).update({ fala: tq.fala, falaAt: TS() }).catch(() => {});
    ref("casa/pet/truque").set({ tipo: tq.id, at: TS(), por: pid }).catch(() => {});
    ganharNeeds({ diversao: 6 });
  } });
}
function menuTruques(p){
  const sabe = truquesSabe(), prox = proxTruque();
  if (!sabe.length){ toast(petNome() + " aprende o primeiro truque com " + TRUQUES[0].meta + " carinhos. Faltam " + (TRUQUES[0].meta - carinhosTotal()) + "."); return; }
  openMenu(p, "Truques de " + petNome(), sabe.map(t => ({ nome: t.nome, info: t.fala, fn: () => pedirTruque(t) }))
    .concat(prox ? [{ nota: 1, nome: "Próximo: " + prox.nome.toLowerCase() + " (" + carinhosTotal() + "/" + prox.meta + " carinhos)" }] : []));
}
function montarTruques(box){
  box.textContent = "";
  const n = carinhosTotal(), prox = proxTruque(), w = el("div", "need"), r = el("div", "row");
  if (prox){
    const i = TRUQUES.indexOf(prox), base = i ? TRUQUES[i - 1].meta : 0;
    r.append(el("span", null, "Próximo: " + prox.nome), el("span", null, n + "/" + prox.meta + " carinhos"));
    const b = barra((n - base) / (prox.meta - base) * 100, "#B49CF4"); b.firstChild.style.background = "#B49CF4"; w.append(r, b);
  } else { r.append(el("span", null, "Sabe todos os truques!"), el("span", null, n + " carinhos")); const b = barra(100, "#B49CF4"); w.append(r, b); }
  box.append(w);
  for (const t of TRUQUES){
    const sabe = n >= t.meta, row = el("div", "rowi" + (sabe ? "" : " off")), esq = el("div", "me"), tx = el("div", "tx"), ck = el("span", "chk", sabe ? "✓" : "");
    if (sabe){ ck.style.background = "var(--good)"; ck.style.borderColor = "var(--good)"; }
    esq.style.gap = "10px"; tx.append(el("strong", null, t.nome), el("small", null, sabe ? "“" + t.fala + "”" : "Aprende com " + t.meta + " carinhos"));
    esq.append(ck, tx); row.append(esq);
    if (sabe){ const b = btn("Pedir", "btn small", () => { closePanel(); pedirTruque(t); }); b.setAttribute("aria-label", "Pedir: " + t.nome); row.append(b); }
    box.append(row);
  }
}
let carinhosVistos = null;
function checarTruqueNovo(){
  if (!statsCarregados) return;
  const n = carinhosTotal();
  if (carinhosVistos != null && n > carinhosVistos){ const t = TRUQUES.find(x => carinhosVistos < x.meta && n >= x.meta); if (t) toastEspecial("Truque novo!", petNome() + " aprendeu: " + t.nome.toLowerCase() + ". Peça no menu do bichinho."); }
  if (n !== carinhosVistos) refreshPanel("pet");
  carinhosVistos = n;
}
function aoMudarPet(ant){
  const q = pet && pet.truque;
  if (q && (!ant || !ant.truque || ant.truque.at !== q.at) && andarAtual === 0 && srvNow() - q.at < TRUQUE_MS){
    sfx("truque"); setTimeout(() => sfx(pet && pet.tipo === "cachorro" ? "latido" : "miau"), 450);
  }
}
// arte dos truques: caixa 17x16 (chão na linha y+15), virado pra direita; o espelhado sai do mesmo sprite
function drawPetTruque(tipo, x, y, pose, f){
  const p = PET_TIPOS[tipo] || PET_TIPOS.gato, c = p.c, cL = p.cL, cD = p.cD, ink = "#2E2638", bl = "rgba(238,96,110,.6)", gato = tipo !== "cachorro";
  const cabeca = (X, Y, feliz) => {
    if (gato){ R(X, Y - 1, 2, 1, c); P(X, Y - 2, c); P(X + 1, Y - 1, p.orelha); R(X + 5, Y - 1, 2, 1, c); P(X + 6, Y - 2, c); P(X + 5, Y - 1, p.orelha); }
    rbox(X, Y, 7, 6, c); R(X + 1, Y, 5, 1, cL); if (gato) R(X + 3, Y, 2, 1, cD);
    else { R(X - 1, Y + 1, 2, 4, p.orelha); R(X + 6, Y + 1, 2, 4, p.orelha); P(X - 1, Y + 4, sh(p.orelha, -.2)); P(X + 7, Y + 4, sh(p.orelha, -.2)); }
    if (feliz) for (const ex of [X + 1, X + 4]){ P(ex, Y + 3, ink); P(ex + 1, Y + 2, ink); P(ex + 2, Y + 3, ink); }
    else { R(X + 2, Y + 2, 1, 2, ink); R(X + 5, Y + 2, 1, 2, ink); }
    if (gato){ R(X + 2, Y + 4, 4, 1, cL); R(X + 3, Y + 3, 2, 1, p.nariz); }
    else { R(X + 2, Y + 3, 4, 2, cL); R(X + 3, Y + 3, 2, 1, p.nariz); P(X + 4, Y + 5, "#F07A90"); }
    P(X + 1, Y + 4, bl); P(X + 6, Y + 4, bl);
  };
  if (pose === "senta" || pose === "pata"){
    const ergue = pose === "pata" && f, ab = pose === "senta" ? f : 0;
    if (gato){ R(x + 1, y + 14, 3, 1, c); P(x, y + 13 - ab, c); P(x, y + 12 - ab, cD); }
    else { R(x + 1, y + 13, 2, 1, c); P(x, y + 12 - ab, cL); }
    rbox(x + 2, y + 9, 7, 6, c); R(x + 3, y + 9, 4, 1, cL);           // anca sentada
    if (gato){ P(x + 4, y + 11, cD); P(x + 6, y + 11, cD); P(x + 5, y + 12, cD); }
    R(x + 4, y + 14, 3, 1, cL);                                         // pé de trás
    rbox(x + 7, y + 6, 5, 8, c); R(x + 9, y + 8, 2, 5, cL);           // peito em pé
    R(x + 8, y + 12, 2, 3, cD); P(x + 8, y + 14, sh(cD, .25));          // pata de trás (longe)
    if (ergue){ R(x + 11, y + 10, 4, 2, c); R(x + 14, y + 10, 1, 2, cL); P(x + 11, y + 11, cD); } // dá a pata
    else { R(x + 10, y + 12, 2, 3, c); R(x + 10, y + 14, 2, 1, cL); }
    cabeca(x + 8, y + 2, !!ergue);
    R(x + 9, y + 8, 5, 1, p.coleira); P(x + 11, y + 9, C.gold);
    return;
  }
  if (pose === "deitado"){ // de lado no chão, feliz (meio do rolar)
    if (gato){ R(x, y + 13, 3, 1, c); P(x, y + 12, cD); } else { R(x, y + 12, 2, 1, c); P(x, y + 11, cL); }
    rbox(x + 2, y + 10, 10, 5, c); R(x + 3, y + 10, 7, 1, cL); R(x + 4, y + 13, 6, 1, cL);
    if (gato){ P(x + 5, y + 11, cD); P(x + 7, y + 11, cD); P(x + 9, y + 11, cD); }
    R(x + 1, y + 14, 3, 1, cD); R(x + 12, y + 14, 4, 1, c); P(x + 15, y + 14, cL);
    cabeca(x + 9, y + 7, true);
    R(x + 10, y + 13, 5, 1, p.coleira);
    return;
  }
  if (pose === "barriga"){ // de barriga pra cima, patinhas pro alto
    if (gato){ R(x, y + 12, 2, 1, c); P(x, y + 11, cD); P(x + 1, y + 13, c); } else { R(x, y + 12, 2, 1, c); P(x, y + 11, cL); }
    for (const [lx, h] of [[3, 3], [5, 2], [8, 3], [10, 2]]){ R(x + lx, y + 10 - h, 2, h, c); R(x + lx, y + 10 - h, 2, 1, cL); }
    rbox(x + 2, y + 10, 10, 5, c); R(x + 3, y + 10, 8, 2, cL); P(x + 6, y + 11, sh(cL, .25));
    const X = x + 10, Y = y + 8;
    rbox(X, Y, 7, 6, c); R(X + 1, Y + 5, 5, 1, cL);
    if (gato){ R(X, Y + 6, 2, 1, c); P(X, Y + 7, c); P(X + 1, Y + 6, p.orelha); R(X + 5, Y + 6, 2, 1, c); P(X + 6, Y + 7, c); P(X + 5, Y + 6, p.orelha); }
    else { R(X - 1, Y + 1, 2, 4, p.orelha); R(X + 6, Y + 1, 2, 4, p.orelha); P(X + 4, Y, "#F07A90"); }
    for (const ex of [X + 1, X + 4]){ P(ex, Y + 3, ink); P(ex + 1, Y + 4, ink); P(ex + 2, Y + 3, ink); }
    if (gato){ R(X + 2, Y + 1, 4, 1, cL); R(X + 3, Y + 2, 2, 1, p.nariz); } else { R(X + 2, Y + 1, 4, 2, cL); R(X + 3, Y + 2, 2, 1, p.nariz); }
    P(X + 1, Y + 2, bl); P(X + 6, Y + 2, bl);
    return;
  }
}
function petTruqueSpr(tipo, pose, f, esq){
  const key = ["pett", tipo, pose, f].join(":");
  const base = sprite(key, 17, 16, (ox, oy) => drawPetTruque(tipo, ox, oy, pose, f));
  if (!esq) return base;
  return sprite(key + ":esq", 17, 16, () => { ctx.save(); ctx.translate(base.c.width, 0); ctx.scale(-1, 1); ctx.drawImage(base.c, 0, 0); ctx.restore(); }, false);
}
// o bichinho para onde estava quando pediram e faz o truque (todos no térreo veem igual)
function addPetTruque(objs, tm, now, tq){
  const st = petEstado(tq.at), e = now - tq.at, tipo = pet.tipo in PET_TIPOS ? pet.tipo : "gato";
  const cx = Math.round((st.x + .5) * T), by = Math.round((st.y + 1) * T - 3), esq = st.esq;
  let spr, oy = 0, brilha = false;
  if (tq.tipo === "senta") spr = petTruqueSpr(tipo, "senta", Math.floor(e / 300) % 2, esq);
  else if (tq.tipo === "pata") spr = e < 700 ? petTruqueSpr(tipo, "senta", 0, esq) : petTruqueSpr(tipo, "pata", Math.floor((e - 700) / 450) % 2 ? 0 : 1, esq);
  else if (tq.tipo === "rolar"){ const k = Math.floor(e / 300) % 4; spr = k % 2 ? petTruqueSpr(tipo, "barriga", 0, k === 3 ? !esq : esq) : petTruqueSpr(tipo, "deitado", 0, k === 2 ? !esq : esq); }
  else { // pirueta: três pulos dando uma cambalhota no ar
    const ph = (e % 1200) / 1200, ar = ph > .12 && ph < .88;
    oy = ar ? -Math.round(Math.sin((ph - .12) / .76 * Math.PI) * 13) : 0; brilha = ar;
    const k = Math.floor(e / 110) % 4;
    spr = !ar ? petTruqueSpr(tipo, "senta", 0, esq) : k === 1 || k === 3 ? petTruqueSpr(tipo, "barriga", 0, k === 3 ? !esq : esq) : petSprite(tipo, "jump", 0, k === 2 ? !esq : esq, false);
  }
  petView = { cx, by, pose: "jump", triste: false };
  objs.push({ z: by - .5, f: () => {
    R(cx - 5 - oy / 3, by + 1, 10 + Math.round(oy / 1.5), 1, "rgba(35,18,40,.25)");
    ctx.drawImage(spr.c, cx - 9, by - spr.c.height + 2 + oy);
    if (brilha) for (let i = 0; i < 3; i++){ const a = tm / 160 + i * 2.1, sx = Math.round(cx + Math.cos(a) * 11), sy = Math.round(by - 8 + oy + Math.sin(a) * 6); P(sx, sy, "#FFFFFF"); P(sx - 1, sy, C.gold); P(sx + 1, sy, C.gold); P(sx, sy - 1, C.gold); P(sx, sy + 1, C.gold); }
  } });
}

// ---------------- sujeira e faxina ----------------
let sujeira = {}, sujAte = 0, sujCarregada = false, sujTentou = 0, sujVarrida = 0;
const SUJ_SLOT = 45 * 60000, SUJ_MAX = 8, SUJ_LIMPA = 5;
const SUJ_TIPOS = { po: "Pó", migalhas: "Migalhas", louca: "Louça suja", roupa: "Roupa jogada", folhas: "Folhas", lama: "Pegadas de lama", pelos: "Pelos do bichinho" };
const sujVisivel = q => q && SUJ_TIPOS[q.tipo] && (q.andar || 0) === andarAtual && (q.tipo === "louca" ? !!moveis[q.mov] : !(occ[q.y] && occ[q.y][q.x]));
const sujeiraNoAndar = () => Object.values(sujeira).filter(sujVisivel).length;
// um sorteio por bloco de 45 min (hash da sala): tipo e lugar dependem da casa naquele momento
function sortearSujeira(s, novas){
  const t = s * SUJ_SLOT, h = i => hash(salaSeed, s, 610 + i), dois = temAndar2();
  const opc = [["po", 3], ["roupa", 2]];
  if (Object.values(todosMoveis).some(m => m && (m.t === "mesa" || m.t === "piquenique") && !m.andar)) opc.push(["migalhas", 2]);
  if (pet) opc.push(["pelos", 2]);
  if (temQuintal() || dois) opc.push(["folhas", estacao() === "outono" ? 4 : 2]);
  if (climaBloco(Math.floor(t / BLOCO_CLIMA))) opc.push(["lama", 4]);
  let r = h(0) % opc.reduce((a, o) => a + o[1], 0), tipo = opc[0][0];
  for (const [k, w] of opc){ if (r < w){ tipo = k; break; } r -= w; }
  let andar = 0;
  if (dois && (tipo === "po" || tipo === "roupa") && h(1) % 100 < 40) andar = 1;
  if (tipo === "folhas") andar = temQuintal() ? (dois && h(1) % 2 ? 1 : 0) : 1;
  const usadas = new Set(Object.values(sujeira).concat(Object.values(novas)).filter(Boolean).map(q => (q.andar || 0) + ":" + q.x + ":" + q.y));
  const pos = noAndar(andar, () => {
    let cands = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
      if (MAP[y][x] !== 0 || !walkable(x, y) || naEscada(x, y) || naLista(PE_ESCADA, x, y) || usadas.has(andar + ":" + x + ":" + y)) continue;
      const cm = comodo(x, y);
      if (tipo === "roupa" && cm !== "quarto" && cm !== "suite") continue;
      if (tipo === "folhas" && cm !== "quintal" && cm !== "varanda") continue;
      if (tipo !== "folhas" && cm === "quintal") continue;
      cands.push([x, y]);
    }
    const perto = (x0, y0, n) => cands.sort((a, b) => Math.hypot(a[0] - x0, a[1] - y0) - Math.hypot(b[0] - x0, b[1] - y0)).slice(0, n);
    if (tipo === "migalhas"){ const m = Object.values(moveis).find(q => q.t === "mesa" || q.t === "piquenique"); if (m){ const c = CAT[m.t]; cands = cands.filter(([x, y]) => x >= m.x - 1 && x <= m.x + c.w && y >= m.y - 1 && y <= m.y + c.h); } }
    if (tipo === "pelos"){ const p = petEstado(t); cands = perto(Math.round(p.x), Math.round(p.y), 5); }
    if (tipo === "lama") cands = portaQ ? perto(portaQ, HC - 1, 6) : cands.filter(([x, y]) => comodo(x, y) === "cozinha" || comodo(x, y) === "sala");
    return cands.length ? cands[h(2) % cands.length] : null;
  });
  return pos ? { tipo, x: pos[0], y: pos[1], andar, criada: t, v: h(3) % 4 } : null;
}
function gerarSujeira(){
  if (!sujCarregada || !moveisCarregados || mode !== "live" || Date.now() - sujTentou < 20000) return;
  const k = Math.floor(srvNow() / SUJ_SLOT); if (sujAte >= k) return;
  sujTentou = Date.now();
  let de = 0;
  txn("casa/sujeiraAte", cur => { de = cur || 0; if (de >= k) return; return k; }).then(ok => {
    if (!ok) return;
    const novas = {}; let n = Object.values(sujeira).filter(Boolean).length;
    for (let s = Math.max(de + 1, k - 3); s <= k && n < SUJ_MAX; s++){
      if (hash(salaSeed, s, 601) % 100 >= 60) continue;
      const q = sortearSujeira(s, novas); if (q){ novas["k" + s] = q; n++; }
    }
    if (Object.keys(novas).length) ref("casa/sujeira").update(novas).catch(() => {});
  });
}
// teste: sujar(3) cria sujeira na hora
function sujar(n){
  const novas = {};
  for (let i = 0; i < (n || 3); i++){ const s = Math.floor(Math.random() * 1e9), q = sortearSujeira(s, novas); if (q){ q.criada = srvNow(); novas["t" + s] = q; } }
  return ref("casa/sujeira").update(novas).then(() => Object.keys(novas).length);
}
// depois de cozinhar: louça na pia mais perto do fogão
function sujarLouca(fogaoId){
  const f = moveis[fogaoId]; if (!f) return;
  const pias = Object.entries(moveis).filter(([, m]) => m.t === "pia").sort((a, b) => Math.hypot(a[1].x - f.x, a[1].y - f.y) - Math.hypot(b[1].x - f.x, b[1].y - f.y));
  if (!pias.length) return;
  const [pk, pm] = pias[0];
  txn("casa/sujeira/l" + pk, cur => cur ? undefined : { tipo: "louca", x: pm.x, y: pm.y, andar: pm.andar || 0, mov: pk, criada: srvNow(), v: 0 });
}
// sujeira que ficou embaixo de um móvel (ou louça de uma pia que foi vendida) some sozinha
function varrerSujeiraEscondida(){
  if (!sujCarregada || !moveisCarregados || Date.now() - sujVarrida < 10000) return; sujVarrida = Date.now();
  for (const [id, q] of Object.entries(sujeira)){
    if (!q) continue;
    if (q.tipo === "louca" ? !todosMoveis[q.mov] : (q.andar || 0) === andarAtual && occ[q.y] && occ[q.y][q.x]) ref("casa/sujeira/" + id).remove().catch(() => {});
  }
}
const acaoLimpar = id => ({
  id: "limpar", nome: "Limpando: " + (SUJ_TIPOS[(sujeira[id] || {}).tipo] || "sujeira").toLowerCase(), dur: 4, ganho: { diversao: 2 },
  junto: ja => ja.id === "limpar", juntoMult: 1.5, juntoSocial: 2,
  antes: () => { if (!sujeira[id]){ toast("Alguém já limpou."); return false; } return true; },
  aoJuntar: (a, oid) => toast("Faxina a dois com " + nomeDe(oid) + "! Vale +50%."),
  fim: info => limparSujeira(id, !!info.junto)
});
function irLimpar(id){
  const q = sujeira[id]; if (!q || !me) return;
  if ((q.andar || 0) !== andarAtual){ toast("Essa sujeira fica " + ondeTxt(q.andar || 0) + "."); return; }
  if (q.tipo === "louca"){ if (moveis[q.mov]) useFurn(q.mov, acaoLimpar(id)); return; }
  goTo(null, (x, y) => Math.abs(x - q.x) + Math.abs(y - q.y) <= 1, () => { if (me.tx !== q.x || me.ty !== q.y) faceTo(q.x, q.y); startAcao(acaoLimpar(id), null, id); });
}
function limparSujeira(id, junto){
  const q = sujeira[id];
  txn("casa/sujeira/" + id, cur => cur ? null : undefined).then(ok => {
    if (!ok){ toast("Alguém limpou antes."); return; }
    const v = junto ? Math.round(SUJ_LIMPA * 1.5) : SUJ_LIMPA; ganhar(v);
    toast(junto ? "Faxina a dois! +$" + v : "Limpinho! +$" + v);
    if (q) for (let i = 0; i < 6; i++) particles.push({ x: q.x * T + 3 + Math.random() * 10, y: q.y * T + 4 + Math.random() * 8, vx: Math.random() * 6 - 3, vy: -6 - Math.random() * 6, life: 1.2, kind: "brilho" });
    statMais("limpezas");
    ref("jogadores/" + pid + "/tarefas/" + hoje() + "/limpezas").transaction(n => (n || 0) + 1)
      .then(r => { if (r.committed && r.snapshot.val() >= 3) tarefaCheck({ id: "limpar3" }); }, () => {});
  });
}
MENU_EXTRA.pia = id => sujeira["l" + id] ? [{ nome: "Lavar a louça", info: "+$" + SUJ_LIMPA, fn: () => irLimpar("l" + id) }] : [];
function sujeiraMenu(id, p){
  const q = sujeira[id], outro = Object.entries(jogadores).find(([k, j]) => k !== pid && j.online && (j.andar || 0) === andarAtual && j.acao && j.acao.id === "limpar");
  openMenu(p, SUJ_TIPOS[q.tipo], [{ nome: "Limpar", info: "+$" + SUJ_LIMPA + (outro ? " · faxina a dois" : ""), fn: () => irLimpar(id) }]);
}
function irFaxina(){
  const aqui = Object.entries(sujeira).filter(([, q]) => sujVisivel(q));
  if (!aqui.length){ const n = Object.values(sujeira).filter(Boolean).length; toast(n ? "Por aqui está limpinho. Tem sujeira " + ondeTxt(andarAtual ? 0 : 1) + "." : "Casa limpinha! ✨"); return; }
  aqui.sort((a, b) => Math.hypot(a[1].x - me.tx, a[1].y - me.ty) - Math.hypot(b[1].x - me.tx, b[1].y - me.ty));
  irLimpar(aqui[0][0]);
}
// arte da sujeira: decalques de chão (sem contorno), roupa e louça com contorno
function drawSujeira(tipo, x, y, v){
  const sv = (i, k) => hash(v, i, k);
  switch (tipo){
    case "po": {
      const g = "#B7AEA6", gL = "#DCD4CC", gD = "#8F857E";
      const blobs = [[2, 9], [9, 4], [9, 11], [4, 3]];
      for (let i = 0; i < 2 + v % 2; i++){ const [bx, by] = blobs[(i + v) % 4];
        rbox(x + bx, y + by, 5, 3, g); R(x + bx + 1, y + by, 3, 1, gL); P(x + bx + 4, y + by + 2, gD); P(x + bx - 1, y + by + 1, g); P(x + bx + 5, y + by + 1, gL); P(x + bx + 2, y + by - 1, gL); }
      for (let i = 0; i < 4; i++) P(x + 1 + sv(i, 1) % 14, y + 1 + sv(i, 2) % 14, i % 2 ? g : gD);
      break; }
    case "migalhas":
      for (let i = 0; i < 10; i++) P(x + 2 + sv(i, 3) % 12, y + 2 + sv(i, 4) % 12, i % 3 ? "#E3B878" : "#B57A40");
      R(x + 3 + v, y + 6, 2, 1, "#D9A85E"); R(x + 10 - v, y + 11, 2, 2, "#E9C890"); P(x + 10 - v, y + 11, "#F6E2B8");
      break;
    case "roupa": {
      const c = ["#E8735F", "#7FB8E8", "#7FD1B2", "#B49CF4"][v % 4];
      R(x + 3, y + 5, 7, 6, c); R(x + 1, y + 5, 2, 3, c); R(x + 10, y + 6, 2, 3, c); R(x + 4, y + 11, 5, 1, c);
      R(x + 5, y + 5, 3, 1, sh(c, -.35)); R(x + 4, y + 8, 4, 1, sh(c, -.15)); R(x + 4, y + 6, 2, 1, sh(c, .3)); P(x + 9, y + 9, sh(c, -.2));
      R(x + 11, y + 10, 2, 3, "#F4EEE6"); R(x + 11, y + 12, 4, 2, "#F4EEE6"); R(x + 11, y + 10, 2, 1, C.coral); P(x + 14, y + 13, "#D9D0E2");
      break; }
    case "folhas": {
      const cs = ["#E8952F", "#D9622B", "#E8C23F", "#8DBB4A"];
      const folha = (lx, ly, c) => { R(lx, ly + 1, 4, 1, c); R(lx + 1, ly, 2, 3, c); P(lx + 1, ly + 1, sh(c, -.25)); P(lx + 2, ly + 1, sh(c, -.25)); P(lx + 4, ly + 2, "#7A5234"); };
      folha(x + 2, y + 3, cs[v % 4]); folha(x + 9, y + 2, cs[(v + 1) % 4]); folha(x + 5, y + 9, cs[(v + 2) % 4]); if (v % 2) folha(x + 10, y + 11, cs[(v + 3) % 4]);
      break; }
    case "lama": {
      const m = "#6E4B30", mL = "#8C6440";
      const pe = (px, py) => { R(px, py + 1, 3, 3, m); P(px + 1, py, m); R(px, py + 5, 3, 2, m); P(px + 1, py + 1, mL); };
      pe(x + 3, y + 8); pe(x + 9, y + 1);
      P(x + 7, y + 12, mL); P(x + 13, y + 9, m); P(x + 2, y + 4, mL);
      break; }
    case "pelos": {
      const pp = pet && PET_TIPOS[pet.tipo] ? PET_TIPOS[pet.tipo] : PET_TIPOS.gato;
      for (const [a, b] of [[2, 4], [8, 9], [10, 3], [4, 12]].slice(0, 3 + v % 2)){ P(x + a, y + b, pp.c); P(x + a + 1, y + b - 1, pp.c); P(x + a + 2, y + b, pp.cL); P(x + a + 3, y + b - 1, pp.cD); P(x + a + 1, y + b + 1, pp.cL); }
      break; }
  }
}
const sujSprite = (tipo, v) => sprite("suj:" + tipo + ":" + v + (tipo === "pelos" && pet ? pet.tipo : ""), 16, 16, (ox, oy) => drawSujeira(tipo, ox, oy, v), tipo === "roupa");
const loucaSprite = () => sprite("louca", 13, 7, (ox, oy) => {
  R(ox, oy + 3, 9, 3, "#E6DDF0"); R(ox, oy + 3, 9, 1, "#FFFFFF"); R(ox + 1, oy + 5, 7, 1, "#C9BFD8");
  R(ox + 1, oy + 1, 7, 2, "#FFFFFF"); R(ox + 2, oy + 1, 5, 1, "#F4F1FA");
  P(ox + 3, oy + 2, "#E0A93A"); P(ox + 5, oy + 1, "#D9483D"); P(ox + 6, oy + 2, "#7FC27A");
  R(ox + 9, oy + 1, 3, 5, C.sky); R(ox + 9, oy + 1, 3, 1, "#BFE0F5"); P(ox + 12, oy + 2, C.sky); P(ox + 12, oy + 3, C.sky); P(ox + 10, oy + 3, "#5F96C8");
  R(ox + 4, oy, 1, 2, C.metal);
});
function drawSujeiraChao(){
  for (const q of Object.values(sujeira)){ if (!sujVisivel(q) || q.tipo === "louca") continue; ctx.drawImage(sujSprite(q.tipo, q.v || 0).c, q.x * T - 1, q.y * T - 1); }
}
// vassoura (ou pano, na pia) de quem está limpando
const vassouraSpr = () => sprite("vassoura", 7, 16, (ox, oy) => {
  R(ox + 3, oy, 1, 10, C.wood); P(ox + 3, oy, C.woodL); R(ox + 2, oy + 10, 3, 1, C.coral);
  R(ox + 1, oy + 11, 5, 2, "#E8C27A"); R(ox, oy + 13, 7, 3, "#E8C27A"); R(ox + 1, oy + 11, 5, 1, "#F3DB9E");
  for (let i = 0; i < 4; i++) P(ox + i * 2, oy + 15, "#C9A04E");
});
const panoSpr = () => sprite("pano", 5, 4, (ox, oy) => { rbox(ox, oy, 5, 4, C.mint); R(ox + 1, oy, 3, 1, "#BFEFDC"); P(ox + 3, oy + 2, "#5BB896"); });
function drawVassoura(cx, by, dir, tm, pano){
  const sw = Math.round(Math.sin(tm / 130) * 2);
  if (pano){
    if (dir !== "up") ctx.drawImage(panoSpr().c, cx + 1 + sw, by - 12);
    for (let i = 0; i < 2; i++){ const ph = (tm / 900 + i / 2) % 1; ctx.globalAlpha = .8 * (1 - ph); P(cx - 2 + i * 6 + sw, by - 14 - Math.round(ph * 6), "#FFFFFF"); }
    ctx.globalAlpha = 1; return;
  }
  const esq = dir === "left";
  ctx.drawImage(vassouraSpr().c, cx + (esq ? -9 : 2) + sw, by - 16);
  for (let i = 0; i < 2; i++){ const ph = (tm / 700 + i / 2) % 1; ctx.globalAlpha = .55 * (1 - ph); R(cx + (esq ? -6 : 5) + sw + i * 3, by - 1 - Math.round(ph * 5), 2, 1, "#E6DED6"); }
  ctx.globalAlpha = 1;
}

// ---------------- visitas surpresa ----------------
const VISITA_BLOCO = 2 * HORA, VIS_ANDA = 7000, VIS_TOC = 4000;
const VISITAS = {
  vizinho: { nome: "Dona Cida", dur: 22 * 60000, av: { corpo: "ela", roupa: 4, traje: 1, cabelo: 4, estilo: 2, pele: 1, acess: 1 } },
  carteiro: { nome: "Carteiro", dur: 14 * 60000, av: { corpo: "ele", roupa: 3, traje: 0, cabelo: 1, estilo: 0, pele: 3, acess: 3, barba: 1 } },
  gato: { nome: "Gatinho", dur: 35 * 60000 }
};
const PEDIDOS = { farinha: "uma xícara de farinha", ovo: "um ovo", leite: "um pouco de leite" };
const PET_EXTRA = {
  rua: { nome: "Gatinho de rua", c: "#A9A4BC", cL: "#D6D2E2", cD: "#7E7896", orelha: "#F4A0B4", coleira: "#A9A4BC", nariz: "#E87A90", semColeira: 1 },
  mingau: { nome: "Mingau", c: "#A9A4BC", cL: "#D6D2E2", cD: "#7E7896", orelha: "#F4A0B4", coleira: C.mint, nariz: "#E87A90" }
};
const URL_VISITA = URLP.get("visita");
let visitaDB = {}, visitaCarregada = false, visitaForcada = null, visView = null, visVista = null, visLimpo = false;
const gatoInfo = () => visitaDB.gato || {};
const diasGato = () => Object.keys(gatoInfo().dias || {}).length;
const gatoAmigo = () => !!gatoInfo().amigo;
const gatoTipo = () => gatoAmigo() ? "mingau" : "rua";
function visitaDoBloco(b){
  const h = i => hash(salaSeed, b, 520 + i);
  let tipo = null;
  if (h(0) % 100 < 45) tipo = ["vizinho", "carteiro", "gato"][h(1) % 3];
  else if (gatoAmigo() && h(0) % 100 < 70) tipo = "gato"; // amigo da casa aparece mais
  if (!tipo) return null;
  const ini = b * VISITA_BLOCO + (h(2) % 60) * 60000;
  return { id: "b" + b, tipo, ini, fim: ini + VISITAS[tipo].dur, pedido: ["bolo", "farinha", "ovo", "leite"][h(3) % 4], lado: h(4) % 2, premio: h(5) };
}
function visitaAgora(){
  const t = srvNow();
  if (visitaForcada) return t < visitaForcada.fim ? visitaForcada : null;
  const b = Math.floor(t / VISITA_BLOCO);
  if (URL_VISITA && VISITAS[URL_VISITA]) return { id: "b" + b, tipo: URL_VISITA, ini: b * VISITA_BLOCO, fim: (b + 1) * VISITA_BLOCO, pedido: URLP.get("pedido") || "bolo", lado: 0, premio: b };
  const v = visitaDoBloco(b);
  return v && t >= v.ini && t < v.fim ? v : null;
}
// teste: forcarVisita("vizinho" | "carteiro" | "gato", pedido) faz chegar agora, neste aparelho
function forcarVisita(tipo, pedido){
  const t = srvNow(); tipo = VISITAS[tipo] ? tipo : "vizinho";
  visitaForcada = { id: "t" + Math.floor(t / 1000), tipo, ini: t, fim: t + VISITAS[tipo].dur, pedido: pedido || "bolo", lado: 0, premio: Math.floor(t / 1000) };
  visVista = null; return visitaForcada;
}
const visitaFase = (v, t) => t - v.ini < VIS_ANDA ? "chegando" : v.fim - t < VIS_ANDA ? "indo" : "aqui";
function visitaNome(v){ return v.tipo === "gato" ? (gatoAmigo() ? "Mingau" : "Gatinho de rua") : VISITAS[v.tipo].nome; }
// onde a visita para (só no térreo): do lado de fora, colada na parede de baixo; com quintal, perto da porta dele
function visitaSpot(v){
  const quint = temQuintal();
  if (v.tipo === "gato"){
    if (quint){ const ts = []; for (let y = HC + 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (walkable(x, y)) ts.push([x, y]); if (ts.length) return ts[v.premio % ts.length]; }
    return [[2, 4, 9, 13, 15][v.premio % 5], HC];
  }
  if (quint){ const x = clamp(portaQ + (v.lado ? 1 : -1), 1, W - 2); return [walkable(x, HC + 1) ? x : portaQ, HC + 1]; }
  for (const x of [12, 13, 11, 14, 9, 15, 4, 3, 5, 2]) if (walkable(x, HC - 1)) return [x, HC];
  return [12, HC];
}
function visitaEstado(v, t){
  const [sx, sy] = visitaSpot(v), cx = sx * T + 8, by = sy > HC ? (sy + 1) * T - 3 : H * T - 3, x0 = v.lado ? W * T + 12 : -12, fase = visitaFase(v, t);
  if (fase === "chegando"){ const k = (t - v.ini) / VIS_ANDA; return { sx, sy, cx: Math.round(x0 + (cx - x0) * k), by, anda: true, dir: v.lado ? "left" : "right", fase }; }
  if (fase === "indo"){ const k = 1 - (v.fim - t) / VIS_ANDA; return { sx, sy, cx: Math.round(cx + (x0 - cx) * k), by, anda: true, dir: v.lado ? "right" : "left", fase }; }
  return { sx, sy, cx, by, anda: false, dir: v.tipo !== "gato" && sy === HC && t - v.ini < VIS_ANDA + VIS_TOC ? "up" : "down", fase };
}
function visitaPendente(v){
  const rec = visitaDB[v.id] || {};
  if (v.tipo === "vizinho") return v.pedido === "bolo" ? !rec.bolo : !rec.deu;
  if (v.tipo === "carteiro") return !rec.pacote;
  return !(gatoInfo().dias || {})[hoje()];
}
function drawProp(k, x, y){
  if (k === "bolo"){ R(x, y + 5, 10, 1, "#F4F1FA"); R(x + 1, y + 6, 8, 1, "#C9BFD8"); rbox(x + 1, y + 1, 8, 5, "#F9C9D6"); R(x + 1, y + 1, 8, 1, "#FFFFFF"); R(x + 2, y + 3, 6, 1, "#E8607A"); P(x + 3, y, "#E8445E"); P(x + 6, y, "#E8445E"); P(x + 4, y + 2, "#FFFFFF"); }
  else if (k === "xicara"){ R(x, y + 1, 4, 4, "#FFFFFF"); R(x, y + 1, 4, 1, "#E6DDF0"); R(x + 4, y + 2, 1, 2, "#FFFFFF"); R(x, y + 4, 4, 1, "#D9D0E2"); P(x + 1, y + 2, C.coral); }
  else if (k === "pacote"){ rbox(x, y + 1, 8, 6, "#D9A86A"); R(x + 1, y + 1, 6, 1, "#EBC48E"); R(x + 1, y + 6, 6, 1, "#B9844A"); R(x + 4, y + 1, 1, 6, C.sky); R(x, y + 3, 8, 1, C.sky); P(x + 3, y, C.sky); P(x + 5, y, C.sky); P(x + 1, y + 5, "#B9844A"); }
  else if (k === "bolsa"){ rbox(x, y, 6, 5, "#9C6A3E"); R(x, y, 6, 2, "#B5814F"); P(x + 3, y + 2, C.gold); }
  else if (k === "pote"){ rbox(x, y + 1, 6, 3, C.coral); R(x + 1, y, 4, 1, "#B5763E"); P(x + 2, y, "#D9A060"); }
}
const propSpr = k => sprite("prop:" + k, { bolo: 10, xicara: 5, pacote: 8, bolsa: 6, pote: 6 }[k], { bolo: 7, xicara: 5, pacote: 7, bolsa: 5, pote: 4 }[k], (ox, oy) => drawProp(k, ox, oy));
function addVisitaObjs(objs, tm){
  visView = null;
  const v = andarAtual === 0 ? visitaAgora() : null; if (!v) return;
  const now = srvNow(), st = visitaEstado(v, now), rec = visitaDB[v.id] || {};
  visView = Object.assign({ v }, st);
  const { cx, by } = st;
  if (v.tipo === "gato"){
    const g = gatoInfo(), comendo = st.fase === "aqui" && g.comeu && now - g.comeu < 25000 && now - g.comeu > -5000;
    let pose = st.anda ? "walk" : comendo ? "eat" : "sit", f = 0;
    if (pose === "sit" && hash(Math.floor(now / 40000), salaSeed, 44) % 3 === 0) pose = "sleep";
    f = pose === "walk" ? Math.floor(tm / 150) % 2 : pose === "eat" ? Math.floor(tm / 260) % 2 : pose === "sleep" ? Math.floor(tm / 1100) % 2 : Math.floor(tm / 650) % 2;
    const esq = st.anda ? st.dir === "left" : v.lado === 1;
    visView.pose = pose;
    objs.push({ z: by - .5, f: () => {
      R(cx - 5, by + 1, 10, 1, "rgba(35,18,40,.25)");
      if (comendo) ctx.drawImage(propSpr("pote").c, cx + (esq ? -12 : 6), by - 4);
      ctx.drawImage(petSprite(gatoTipo(), pose, f, esq, false).c, cx - 9, by - 13);
    } });
    return;
  }
  const d = VISITAS[v.tipo], frame = st.anda ? Math.floor(tm / 115) % 4 : 0;
  const pisca = !st.anda && tm % 3700 < 140, pose = pisca ? "blink" : !st.anda && Math.floor(tm / 800) % 2 ? "breath" : "stand";
  objs.push({ z: by, f: () => {
    R(cx - 3, by - 1, 6, 1, "rgba(35,18,40,.22)"); R(cx - 5, by, 10, 1, "rgba(35,18,40,.3)"); R(cx - 4, by + 1, 8, 1, "rgba(35,18,40,.2)");
    blitAvatar(d.av, cx, by, st.dir, frame, pose);
    if (st.dir === "up") return;
    if (v.tipo === "carteiro"){
      if (!rec.pacote) ctx.drawImage(propSpr("pacote").c, cx - 5, by - 12); // chega com o pacote no colo
      else { for (let i = 0; i < 5; i++) P(cx - 3 + i, by - 12 + i, "#7A4E2E"); ctx.drawImage(propSpr("bolsa").c, cx + 1, by - 10); } // entregou: só a bolsa
    } else if (v.pedido === "bolo"){ if (!rec.bolo) ctx.drawImage(propSpr("bolo").c, cx - 6, by - 13); }
    else if (!rec.deu) ctx.drawImage(propSpr("xicara").c, cx - 3, by - 12);
  } });
}
function drawVisitaLabels(mctx, K, fs, tm){
  if (!visView || mode !== "live") return;
  const { v, cx, by, fase } = visView, gato = v.tipo === "gato", now = srvNow();
  const knock = !gato && fase === "aqui" && now - v.ini < VIS_ANDA + VIS_TOC;
  const top = (by - (gato ? 13 : 27)) * K, sx = cx * K;
  const nm = knock ? "toc toc!" : gato ? (gatoAmigo() ? "Mingau" : "") : visitaNome(v);
  if (nm){ mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, sx, top); mctx.fillStyle = knock ? "#FFFFFF" : "#FAC775"; mctx.fillText(nm, sx, top); }
  const icon = gato && visView.pose === "sleep" ? "zZ" : !knock && fase === "aqui" && visitaPendente(v) ? "!" : null;
  if (icon){ mctx.fillStyle = icon === "!" ? "#FAC775" : "#CECBF6"; mctx.fillText(icon, sx + 8 * K, top - (nm ? fs * .9 : 0) - Math.abs(Math.sin(tm / 250)) * K * 2); }
}
function visitaAt(wx, wy, folga){
  if (!visView) return false;
  const gato = visView.v.tipo === "gato";
  return Math.hypot(wx - visView.cx, (wy - (visView.by - (gato ? 6 : 11))) * .8) < (gato ? 11 : 13) + (folga || 0);
}
function visitaMenu(p){
  const v = visView.v, rec = visitaDB[v.id] || {}, nome = visitaNome(v);
  if (visView.fase === "indo"){ toast(nome + " já está indo embora. Tchau!"); return; }
  const it = [];
  let titulo = nome;
  if (v.tipo === "vizinho"){
    titulo = v.pedido === "bolo" ? "Dona Cida trouxe um bolo" : "Dona Cida veio pedir " + PEDIDOS[v.pedido];
    it.push({ nome: "Conversar", info: "Social", fn: () => visitaAcao(v, "conversar") });
    if (v.pedido === "bolo"){ if (!rec.bolo) it.push({ nome: "Aceitar o bolo", info: "Vai pra mesa", fn: () => visitaAcao(v, "bolo") }); }
    else if (!rec.deu) it.push({ nome: "Emprestar " + INGREDIENTES[v.pedido].nome.toLowerCase(), info: (despensa[v.pedido] || 0) + " na despensa", fn: () => visitaAcao(v, "emprestar") });
    else it.push({ nota: 1, nome: (rec.deu === pid ? "Você" : nomeDe(rec.deu)) + " já ajudou." });
  } else if (v.tipo === "carteiro"){
    titulo = "Carteiro com um pacote";
    if (!rec.pacote) it.push({ nome: "Pegar o pacote", info: "Presente!", fn: () => visitaAcao(v, "pacote") });
    else it.push({ nota: 1, nome: (rec.pacote.por === pid ? "Você" : nomeDe(rec.pacote.por)) + " já pegou o pacote." });
    it.push({ nome: "Dar um tchauzinho", info: "Social", fn: () => visitaAcao(v, "tchau") });
  } else {
    const comeu = (gatoInfo().dias || {})[hoje()];
    if (!gatoAmigo()) titulo = "Gatinho de rua · " + Math.min(3, diasGato()) + "/3 dias";
    it.push(comeu ? { nota: 1, nome: "Já comeu hoje. Barriguinha cheia!" } : { nome: "Dar um sachê", info: "$5", fn: () => visitaAcao(v, "sache") });
    it.push({ nome: "Fazer carinho", info: "Diversão", fn: () => visitaAcao(v, "carinho") });
  }
  openMenu(p, titulo, it);
}
function visitaAcao(v, k){
  if (andarAtual !== 0){ toast("A visita está lá embaixo. Desça a escada."); return; }
  const nome = visitaNome(v), base = "casa/visita/" + v.id, ing = v.pedido;
  const reivindica = (campo, valor, msg) => txn(base + "/" + campo, c => c ? undefined : valor).then(ok => { if (!ok) toast(msg); return ok; });
  const A = {
    conversar: { id: "v-conversa", nome: "Conversando com " + nome, dur: 6, ganho: { social: 30, diversao: 6 } },
    tchau: { id: "v-tchau", nome: "Dando tchau pro carteiro", dur: 2, ganho: { social: 10 } },
    bolo: { id: "v-bolo", nome: "Recebendo o bolo", dur: 2, ganho: { social: 10 },
      antes: () => reivindica("bolo", pid, "Alguém já pegou o bolo."),
      fim: () => { ref("casa/pratos").push({ receita: "bolo", porcoes: 3, por: pid, at: TS(), visita: 1 }).catch(() => {}); toast("Dona Cida deixou um bolo de morango. Tá na mesa!" + (Object.values(todosMoveis).some(m => m && m.t === "mesa") ? "" : " (Coloque uma mesa pra servir.)")); } },
    emprestar: { id: "v-emprestar", nome: "Emprestando " + (PEDIDOS[ing] || ""), dur: 3, ganho: { social: 12 },
      antes: () => { if ((despensa[ing] || 0) < 1){ toast("Não tem " + (INGREDIENTES[ing] || { nome: "isso" }).nome.toLowerCase() + " na despensa. Dá pra comprar na geladeira."); return false; } return reivindica("deu", pid, "Alguém já ajudou a Dona Cida."); },
      fim: () => { mexerDespensa({ [ing]: -1 }); ganhar(40); toast("Dona Cida agradeceu e deixou $40. Que vizinha!"); } },
    pacote: { id: "v-pacote", nome: "Abrindo o pacote", dur: 3, ganho: { diversao: 10 },
      antes: () => reivindica("pacote", { por: pid, at: srvNow() }, "Alguém já pegou o pacote."),
      fim: () => abrirPresente(v), cancel: () => abrirPresente(v) },
    sache: { id: "v-sache", nome: "Dando um sachê pro gatinho", dur: 3, ganho: { diversao: 8 },
      antes: () => { if (!gastar(5, "o sachê")) return false; return txn("casa/visita/gato/dias/" + hoje(), c => c ? undefined : pid).then(ok => { if (!ok){ ganhar(5); toast("Alguém já deu comida pra ele hoje."); } return ok; }); },
      fim: () => {
        ref("casa/visita/gato/comeu").set(TS()).catch(() => {}); sfx("comida");
        const n = diasGato();
        if (n >= 3 && !gatoAmigo()) txn("casa/visita/gato/amigo", c => c ? undefined : srvNow()).then(ok => { if (ok){ toastEspecial("O gatinho virou amigo da casa!", "Agora ele se chama Mingau e vem visitar mais vezes."); confete(); } });
        else toast(gatoAmigo() ? "Mingau comeu tudo e lambeu o focinho." : "O gatinho comeu tudinho! " + Math.min(3, n) + "/3 dias");
      } },
    carinho: { id: "v-gato", nome: "Fazendo carinho no " + (gatoAmigo() ? "Mingau" : "gatinho"), dur: 3, ganho: { diversao: 8, social: 4 },
      fim: () => { sfx("ronronar"); if (visView) burst(visView.cx / T - .5, visView.by / T - .4, "heart"); } }
  };
  const a = A[k]; if (!a) return;
  const [sx, sy] = visitaSpot(v), fora = sy > HC;
  const goal = fora ? (x, y) => Math.abs(x - sx) + Math.abs(y - sy) === 1 : (x, y) => y === HC - 1 && Math.abs(x - sx) <= 1;
  if (!bfs(me.tx, me.ty, goal)){ if (me.acao) setAcao(null); me.path = []; startAcao(a); return; } // não chega na porta: conversa daqui mesmo
  goTo(null, goal, () => { faceTo(sx, sy); startAcao(a); });
}
// presente do carteiro: um enfeite pra casa (perto de quem abriu) ou um envelope com moedas
function abrirPresente(v){
  if (abrirPresente.feito === v.id) return; abrirPresente.feito = v.id;
  const r = v.premio % 100, t = ["urso", "planta", "abajur"][(v.premio >>> 8) % 3];
  if (r < 55 && me){
    const pos = lugarPerto(t, me.tx, me.ty);
    if (pos){
      const novo = { t, x: pos[0], y: pos[1], por: pid }; if (andarAtual === 1) novo.andar = 1;
      ref("casa/moveis").push(novo).catch(() => {});
      toastEspecial("Presente do correio!", "Veio " + (t === "urso" ? "um ursinho de pelúcia" : t === "planta" ? "uma planta" : "um abajur") + ". Já está na casa."); return;
    }
  }
  const din = 40 + (v.premio >>> 4) % 81; ganhar(din);
  toastEspecial("Presente do correio!", "Um envelope com $" + din + ". Que sorte!");
}
function avisoVisita(v){
  const lugar = temQuintal() ? "no quintal" : "no jardim";
  const txt = v.tipo === "vizinho" ? (v.pedido === "bolo" ? "Dona Cida, a vizinha, bateu na porta com um bolo!" : "Dona Cida, a vizinha, bateu na porta pra pedir " + PEDIDOS[v.pedido] + ".")
    : v.tipo === "carteiro" ? "O carteiro chegou com um pacote!" : gatoAmigo() ? "O Mingau veio visitar " + lugar + "!" : "Apareceu um gatinho de rua " + lugar + ".";
  toast(txt + (andarAtual ? " (lá embaixo)" : ""));
  sfx(v.tipo === "gato" ? "miau" : "toc"); setTimeout(() => sfx("notif", .7), 500);
}
function vigiarVisita(){
  const v = visitaAgora(); if (!v || v.id === visVista) return;
  if (visitaFase(v, srvNow()) === "indo") return;
  visVista = v.id;
  const k = "casinha-visita-" + sala; if (store.get(k) === v.id) return;
  store.set(k, v.id); avisoVisita(v);
}
function limparVisitasVelhas(){
  if (visLimpo || !visitaCarregada || !me) return; visLimpo = true;
  const b = Math.floor(srvNow() / VISITA_BLOCO);
  for (const k of Object.keys(visitaDB)){
    if (k === "gato") continue;
    const n = +k.slice(1);
    if (!isFinite(n) || (k[0] === "b" ? n < b - 2 : n * 1000 < srvNow() - 3 * HORA)) ref("casa/visita/" + k).remove().catch(() => {});
  }
}

// ---------------- ursinho de pelúcia (vem no pacote do carteiro; também à venda) ----------------
CAT.urso = { nome: "Ursinho de pelúcia", w: 1, h: 1, preco: 90, acoes: [{ id: "urso", nome: "Abraçar o ursinho", dur: 4, ganho: { diversao: 10, social: 6 } }] };
TOP.urso = 8;
const FURN_EXTRA = {
  urso(x, y){
    const b = "#C08A5A", bL = "#DDAA78", bD = "#8C5E3A", mz = "#F3DDBE", ink = "#2E2638";
    rbox(x + 2, y + 10, 5, 5, b); rbox(x + 9, y + 10, 5, 5, b); R(x + 3, y + 12, 3, 2, mz); R(x + 10, y + 12, 3, 2, mz);
    rbox(x + 4, y + 2, 8, 10, b); R(x + 5, y + 3, 6, 1, bL); rbox(x + 6, y + 5, 4, 5, mz);
    rbox(x + 2, y + 4, 3, 5, bD); rbox(x + 11, y + 4, 3, 5, bD);
    rbox(x + 2, y - 8, 4, 4, b); rbox(x + 10, y - 8, 4, 4, b); P(x + 3, y - 7, mz); P(x + 11, y - 7, mz);
    rbox(x + 3, y - 6, 10, 9, b); R(x + 4, y - 6, 8, 1, bL);
    rbox(x + 6, y - 2, 4, 3, mz); R(x + 7, y - 2, 2, 1, ink); P(x + 7, y, sh(mz, -.25)); P(x + 8, y, sh(mz, -.25));
    R(x + 5, y - 4, 1, 2, ink); R(x + 10, y - 4, 1, 2, ink); P(x + 4, y - 1, "rgba(238,96,110,.6)"); P(x + 11, y - 1, "rgba(238,96,110,.6)");
    R(x + 5, y + 2, 2, 2, C.rose); R(x + 9, y + 2, 2, 2, C.rose); R(x + 7, y + 2, 2, 2, "#D97A96");
  }
};

// ---------------- ganchos no desenho, no clique e no laço ----------------
function leva5Ativo(ativo){ const mu = musicaAtiva(); if (mu && moveis[mu.mov]) ativo[mu.mov] = 1; } // disco girando e notinhas
function addLeva5Objs(objs, tm){
  addVisitaObjs(objs, tm);
  for (const q of Object.values(sujeira)){
    if (!q || q.tipo !== "louca" || !sujVisivel(q)) continue;
    const m = moveis[q.mov], px = m.x * T, py = m.y * T;
    objs.push({ z: (m.y + 1) * T - .5, f: () => {
      ctx.drawImage(loucaSprite().c, px + 1, py - 4);
      for (let i = 0; i < 2; i++){ const ph = (tm / 1500 + i / 2) % 1; ctx.globalAlpha = .75 * (1 - ph); P(px + 5 + i * 4, py - 4 - Math.round(ph * 5), "#FFFFFF"); }
      ctx.globalAlpha = 1;
    } });
  }
}
function leva5Click(p, tx, ty, toque){
  if (visitaAt(p.x, p.y, toque ? 5 : 0)){ visitaMenu(p); return true; }
  for (const [id, q] of Object.entries(sujeira)){
    if (q && q.tipo !== "louca" && q.x === tx && q.y === ty && sujVisivel(q)){ sujeiraMenu(id, p); return true; }
  }
  return false;
}
let passoUlt = null;
function leva5Update(dt){
  const k = me.tx + "," + me.ty + "," + andarAtual;
  if (k !== passoUlt){ if (passoUlt){ sfx("passo"); if (MAP[me.ty] && MAP[me.ty][me.tx] === 2) sfx("porta"); } passoUlt = k; }
  const a = me.acao;
  if (a){
    if (a.id === "limpar") sfx("limpar", .8);
    else if (/^coz-/.test(a.id)) sfx("fritura", .7);
    else if (a.id === "banho" || a.id === "banheira") sfx("agua", .7);
  }
  // casa bagunçada: quem está no andar perde um pouquinho de higiene e diversão
  const n = sujeiraNoAndar();
  if (n >= 4){ me.needs.higiene = clamp(me.needs.higiene - .008 * (n - 3) * dt, 0, 100); me.needs.diversao = clamp(me.needs.diversao - .005 * (n - 3) * dt, 0, 100); }
}
function renderLeva5Hud(){
  const setTxt = (id, t, ic, lbl) => { const b = $(id), tx = b.querySelector(".tx"), i = b.querySelector(".ic"); if (tx.textContent !== t) tx.textContent = t; if (ic && i.textContent !== ic) i.textContent = ic; b.setAttribute("aria-label", lbl || t); };
  const n = Object.values(sujeira).filter(Boolean).length;
  setTxt("bFaxina", n ? "Faxina " + n : "Limpinha", null, n ? "Faxina: " + n + (n > 1 ? " sujeiras" : " sujeira") + " pela casa" : "Faxina: casa limpinha");
  const so = prefOn("casinha-som"), mu = prefOn("casinha-musica");
  setTxt("bSom", "Som", so || mu ? "🔊" : "🔇", "Som e música" + (so ? "" : ", sons desligados") + (mu ? "" : ", música desligada"));
}
$("bFaxina").onclick = () => irFaxina();
$("bSom").onclick = () => openSom(null);
// migração: casa sem toca-discos ganha um (a música precisa dele)
let leva5Tentou = false;
function garantirLeva5(){
  if (leva5Tentou || !moveisCarregados || andarAtual !== 0 || !casaPronta) return; leva5Tentou = true;
  ref("casa/leva5").transaction(cur => cur ? undefined : true).then(r => {
    if (!r.committed || Object.values(todosMoveis).some(m => m && m.t === "som")) return;
    const pos = lugarPerto("som", 8, 1); if (pos) ref("casa/moveis").push({ t: "som", x: pos[0], y: pos[1] }).catch(() => {});
  }).catch(() => {});
}
function leva5Ouvir(){
  on(ref("casa/sujeira"), "value", s => { sujeira = s.val() || {}; sujCarregada = true; });
  on(ref("casa/sujeiraAte"), "value", s => { sujAte = s.val() || 0; });
  on(ref("casa/visita"), "value", s => { visitaDB = s.val() || {}; visitaCarregada = true; limparVisitasVelhas(); refreshPanel("pet"); });
  on(ref("casa/musica"), "value", s => {
    const ant = musica; musica = s.val();
    if (musicaCarregada && me && musica && musica.por && musica.por !== pid && (!ant || ant.desde !== musica.desde)){ const fx = FAIXAS.find(f => f.id === musica.faixa); if (fx) toast(nomeDe(musica.por) + " colocou “" + fx.nome + "” no toca-discos."); }
    musicaCarregada = true; refreshPanel("som");
  });
}
function leva5Reset(){
  musica = null; musicaCarregada = false; musParar();
  sujeira = {}; sujAte = 0; sujCarregada = false; sujTentou = 0;
  visitaDB = {}; visitaCarregada = false; visView = null; visVista = null; visLimpo = false; visitaForcada = null;
  carinhosVistos = null; leva5Tentou = false; passoUlt = null;
}
setInterval(() => { if (!me) return; gerarSujeira(); varrerSujeiraEscondida(); vigiarVisita(); checarTruqueNovo(); garantirLeva5(); limparVisitasVelhas(); }, 1000);
