"use strict";
// Casinha · leva 4: segundo andar, escada e cofrinho
// =====================================================================
// LEVA 4: poses sentadas e segundo andar
//   casa/cofre2 = { total, por: {pid: $}, liberado: ts, liberouPor }   cofrinho do 2º andar ($1500), separado do quintal
//   casa/andar2pronto = ts      feito uma vez (transação): tira móveis de cima da escada e mobilia o 2º andar
//   casa/pisos2/<cômodo>        pisos lá de cima (suite, lavabo, jogos, varanda)
//   casa/moveis/<id>/andar = 1  móvel do 2º andar (sem o campo = térreo: casas antigas não mudam)
//   jogadores/<pid>/andar = 0|1 andar do boneco; cada aparelho desenha só o andar do próprio jogador
// =====================================================================
const ANDAR2_PRECO = 1500;
let cofre2 = {}, cofre2Carregado = false, andar2Tentou = false, andarUISig = "";
const temAndar2 = () => !!cofre2.liberado;
const ondeTxt = a => a > andarAtual ? "lá em cima" : "lá embaixo";
function remontar(){ montarMapa(temQuintal(), cofre.porta); }
// roda fn vendo o andar n (mapa e móveis) e volta. Nada de gravar no banco aqui dentro (os ouvintes rodariam no andar errado)
function noAndar(n, fn){
  if (andarAtual === n) return fn();
  const a = andarAtual; andarAtual = n; remontar(); aplicarMoveis();
  try { return fn(); } finally { andarAtual = a; remontar(); aplicarMoveis(); }
}
function aplicarAndar2(festa){
  escadaOn = temAndar2();
  if (!escadaOn && andarAtual === 1 && me){ trocarAndar(0, true); return; }
  remontar(); rebuildOcc(); tamanhoCena();
  if (me && !walkable(me.tx, me.ty) && !me.acao){ const [x, y] = freeSpot(); me.tx = me.px = x; me.ty = me.py = y; me.path = []; savePos(); }
  if (mode === "build") renderBuild();
  if (festa){ toastEspecial("2º andar pronto!", "A escada fica no canto da sala. Subam pra conhecer!"); confete(); }
  prepararAndar2();
}
// troca o andar que eu vejo e onde estou. Chega saindo da escada (ou direto, sem animar)
function trocarAndar(n, semAnimar){
  if (!me || (n === 1 && !temAndar2())) return;
  closeMenu(); tool = null;
  andarAtual = n; me.andar = n; remontar(); aplicarMoveis(); tamanhoCena(); disp = {};
  const [ex, ey, sx, sy] = chegadaEscada(n);
  me.tx = ex; me.ty = ey; me.plano = null; me.dir = n ? "up" : "down";
  if (semAnimar){ me.px = ex; me.py = ey; me.path = []; } else { me.px = sx; me.py = sy; me.path = [[ex, ey]]; }
  ref("jogadores/" + pid).update({ andar: n, x: ex, y: ey, dir: me.dir }).catch(() => {});
  renderPeople(); renderHud(); if (mode === "build") renderBuild(); andarUISig = ""; renderAndarUI();
  garantirCasa(); prepararAndar2();
  if (n === 1 && !store.get("casinha-andar2-" + sala)){ store.set("casinha-andar2-" + sala, "1"); toast("Bem-vindo(a) ao 2º andar: suíte, sala de jogos e varanda."); }
}
// onde se chega: patamar (em cima) ou pé da escada (embaixo); e de onde sai andando (o degrau da ponta)
function chegadaEscada(n){
  const cand = n ? TOPO_ESCADA.concat([[14, 1], [14, 2]]) : PE_ESCADA.concat([[14, 5], [14, 4]]);
  const gente = (x, y) => Object.entries(jogadores).some(([id, j]) => id !== pid && j.online && (j.andar || 0) === n && j.x === x && j.y === y);
  const p = cand.find(([x, y]) => walkable(x, y) && !gente(x, y)) || cand.find(([x, y]) => walkable(x, y)) || freeSpot();
  return [p[0], p[1], clamp(p[0], ESCADA.x, ESCADA.x + ESCADA.w - 1), n ? ESCADA.y : ESCADA.y + ESCADA.h - 1];
}
function pertoDaEscada(){
  if (!me || !temAndar2()) return false;
  const alvos = andarAtual ? TOPO_ESCADA.concat([[14, 1], [14, 2], [14, 3], [14, 4]]) : PE_ESCADA;
  return alvos.some(([x, y]) => Math.abs(x - me.tx) + Math.abs(y - me.ty) <= 2);
}
// anda até a escada e sobe/desce (no modo construir, troca de andar direto)
function irEscada(){
  if (!me || !temAndar2() || (me.acao && me.acao.id === "escada")) return;
  const sobe = andarAtual === 0;
  if (mode === "build"){ trocarAndar(sobe ? 1 : 0, true); return; }
  closeMenu();
  goTo(null, (x, y) => naLista(sobe ? PE_ESCADA : TOPO_ESCADA, x, y), () => {
    me.dir = sobe ? "up" : "down"; savePos();
    startAcao({ id: "escada", nome: sobe ? "Subindo a escada" : "Descendo a escada", dur: 1.3, ganho: {}, esc: sobe ? 1 : -1, fim: () => trocarAndar(sobe ? 1 : 0) });
  });
}
// uma vez por casa, quando o 2º andar é liberado: libera a escada no térreo e mobilia lá em cima
function prepararAndar2(){
  if (andar2Tentou || !me || !temAndar2() || !moveisCarregados || andarAtual !== 0) return;
  andar2Tentou = true;
  ref("casa/andar2pronto").transaction(cur => cur ? undefined : srvNow()).then(r => {
    if (!r.committed) return;
    liberarEscada(); mobiliarAndar2();
  }).catch(() => { andar2Tentou = false; });
}
// lugar livre mais perto de (x0, y0), primeiro no mesmo cômodo; tapete não vai pra baixo de outro móvel
function lugarPerto(t, x0, y0){
  const c = CAT[t], cm = comodo(x0, y0), cands = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++){
    if (!canPlace(t, x, y)) continue;
    if (c.chao){ let livre = true; for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++) if (occ[y + dy][x + dx] || MAP[y + dy][x + dx] !== 0) livre = false; if (!livre) continue; }
    cands.push([x, y, (comodo(x, y) === cm ? 0 : 1000) + Math.hypot(x - x0, y - y0)]);
  }
  cands.sort((a, b) => a[2] - b[2]);
  return cands.length ? [cands[0][0], cands[0][1]] : null;
}
// térreo: o que estiver em cima da escada (ou no pé dela) vai pra um lugar livre. Nunca apaga; se não couber embaixo, sobe
function liberarEscada(){
  const muda = [];
  for (const [id, m] of Object.entries(moveis)){
    const c = CAT[m.t]; if (!c) continue;
    let naEsc = false, noPe = false;
    for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++){ if (naEscada(m.x + dx, m.y + dy)) naEsc = true; if (naLista(PE_ESCADA, m.x + dx, m.y + dy)) noPe = true; }
    if (!naEsc && (c.chao || !noPe)) continue; // tapete no pé da escada pode ficar
    let pos = lugarPerto(m.t, m.x, m.y), up = false;
    if (!pos){ pos = noAndar(1, () => lugarPerto(m.t, 8, 6)); up = !!pos; }
    if (!pos) continue;
    delete moveis[id]; if (!up) moveis[id] = Object.assign({}, m, { x: pos[0], y: pos[1] }); rebuildOcc();
    muda.push([id, up ? { x: pos[0], y: pos[1], andar: 1 } : { x: pos[0], y: pos[1] }]);
  }
  // se o pé da escada ficou cercado (móvel colado nele), muda os vizinhos até abrir caminho
  for (let tent = 0; tent < 4 && !escadaAlcanca(); tent++){
    const viz = PE_ESCADA.flatMap(([x, y]) => [[x - 1, y], [x + 1, y], [x, y + 1]]).map(([x, y]) => occ[y] && occ[y][x]).find(k => k && moveis[k] && !CAT[moveis[k].t].chao);
    if (!viz) break;
    const m = moveis[viz]; delete moveis[viz]; rebuildOcc();
    const pos = lugarPerto(m.t, m.x, m.y);
    if (!pos){ moveis[viz] = m; rebuildOcc(); break; }
    moveis[viz] = Object.assign({}, m, { x: pos[0], y: pos[1] }); rebuildOcc();
    muda.push([viz, { x: pos[0], y: pos[1] }]);
  }
  for (const [id, u] of muda) ref("casa/moveis/" + id).update(u).catch(() => {});
  if (muda.length) toast(muda.length === 1 ? "Um móvel saiu da frente da escada." : muda.length + " móveis saíram da frente da escada.");
}
function mobiliarAndar2(){
  const novos = noAndar(1, () => {
    const out = [];
    MOVEIS_ANDAR2.forEach(([t, x, y], i) => {
      const pos = canPlace(t, x, y) ? [x, y] : lugarPerto(t, x, y); if (!pos) return;
      moveis["_n" + i] = { t, x: pos[0], y: pos[1], andar: 1 }; rebuildOcc();
      out.push({ t, x: pos[0], y: pos[1], andar: 1 });
    });
    return out;
  });
  for (const m of novos) ref("casa/moveis").push(m).catch(() => {});
}
// ---- cofrinho do 2º andar (igual ao do quintal, em casa/cofre2) ----
function porNoCofre2(v){
  if (temAndar2()) return;
  v = Math.min(v, ANDAR2_PRECO - (cofre2.total || 0)); if (v <= 0) return;
  if (!gastar(v, "o cofrinho")) return;
  let aceito = 0;
  txn("casa/cofre2", cur => {
    cur = cur || {}; aceito = 0; if (cur.liberado) return;
    const t = cur.total || 0; aceito = Math.min(v, ANDAR2_PRECO - t); if (aceito <= 0) return;
    cur.total = t + aceito; cur.por = cur.por || {}; cur.por[pid] = (cur.por[pid] || 0) + aceito;
    if (cur.total >= ANDAR2_PRECO) Object.assign(cur, { liberado: srvNow(), liberouPor: pid });
    return cur;
  }).then(ok => {
    const volta = v - (ok ? aceito : 0); if (volta > 0) ganhar(volta);
    if (ok && !temAndar2()) toast("$" + aceito + " no cofrinho do 2º andar. Faltam $" + (ANDAR2_PRECO - (cofre2.total || 0)) + ".");
    else if (!ok) toast("Não deu pra guardar agora. O dinheiro voltou.");
  });
}
function openAndar2(){
  openPanel("andar2", "Cofrinho do 2º andar", corpo => {
    const intro = el("p", "muted"), prog = el("div", "need"), row = el("div", "row"), lab = el("span"), val = el("span");
    row.append(lab, val); const barBox = el("div"); prog.append(row, barBox);
    const din = el("p", "money"), bts = el("div", "hbtns"), lista = el("div", "list");
    corpo.append(intro, prog, din, bts, el("h3", null, "Quem já pôs"), lista);
    const upd = () => {
      const total = cofre2.total || 0, falta = ANDAR2_PRECO - total;
      intro.textContent = temAndar2() ? "2º andar pronto! A escada fica no canto da sala: toque nela pra subir. Lá em cima tem suíte com banheira, sala de jogos e varanda com vista."
        : "Juntem $" + ANDAR2_PRECO + " e a casa ganha um 2º andar: escada na sala, suíte com banheira, sala de jogos e uma varanda com vista. Cada um põe o quanto puder.";
      lab.textContent = temAndar2() ? "Pago" : "Guardado"; val.textContent = "$" + total + " de $" + ANDAR2_PRECO;
      barBox.textContent = ""; barBox.append(barra(Math.min(100, total / ANDAR2_PRECO * 100), "#FAC775"));
      din.textContent = me ? "Você tem $ " + Math.floor(me.dinheiro) : "";
      bts.textContent = ""; bts.hidden = temAndar2();
      for (const v of [50, 100, 200]){ if (v >= falta) continue; const b = btn("+$" + v, "btn ghost", () => porNoCofre2(v)); b.disabled = !me || me.dinheiro < v; bts.append(b); }
      if (falta > 0){ const b = btn("Completar $" + falta, "btn", () => porNoCofre2(falta)); b.disabled = !me || me.dinheiro < falta; bts.append(b); }
      lista.textContent = "";
      const por = Object.entries(cofre2.por || {}).sort((a, b) => b[1] - a[1]);
      if (!por.length) lista.append(el("p", "muted", "Ninguém ainda. Que tal começar?"));
      for (const [p, v] of por){ const r = el("div", "rowi"); r.append(el("strong", null, p === pid ? "Você" : nomeDe(p)), el("span", "money", "$" + v)); lista.append(r); }
    };
    upd(); return upd;
  });
}
$("bAndar").onclick = () => openAndar2();
// canto da tela: quem está no outro andar (toque leva até a escada) e o botão Subir/Descer quando estou perto
function renderAndarUI(){
  const box = $("andarUI"); if (!box) return;
  const outros = me ? Object.entries(jogadores).filter(([id, j]) => id !== pid && j.online && j.nome && (j.andar || 0) !== andarAtual) : [];
  const agora = Date.now(), lista = outros.map(([id, j]) => [id, j.nome, j.andar || 0, j.fala && j.falaAt && agora - j.falaAt < 7000 && agora - j.falaAt > -60000 ? String(j.fala).slice(0, 60) : ""]);
  const subindo = !!(me && me.acao && me.acao.id === "escada"), botao = !!me && temAndar2() && !subindo && (mode === "build" || pertoDaEscada());
  const sig = JSON.stringify([lista, botao, andarAtual, mode]);
  if (sig === andarUISig) return; andarUISig = sig;
  box.textContent = "";
  for (const [id, nome, a, fala] of lista){
    const b = btn("", "achip", () => irEscada());
    const cv = el("canvas"); cv.width = 16; cv.height = 14; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
    x.drawImage(avatarSprite(jogadores[id], "down", 0, "stand").c, 1, 2 + AV_Y0, 16, 14, 0, 0, 16, 14);
    const onde = ondeTxt(a);
    b.append(cv, el("span", "tx", nome + " está " + onde + (fala ? ": “" + fala + "”" : "")), el("span", "seta", a > andarAtual ? "⬆" : "⬇"));
    b.setAttribute("aria-label", nome + " está " + onde + (fala ? " e disse: " + fala : "") + ". Toque para ir até a escada.");
    box.append(b);
  }
  if (botao){
    const txt = mode === "build" ? (andarAtual ? "⬇ Ver o térreo" : "⬆ Ver o 2º andar") : andarAtual ? "⬇ Descer" : "⬆ Subir";
    const b = btn(txt, "btn small escadaBtn", () => irEscada()); box.append(b);
  }
  box.hidden = !box.children.length;
}
