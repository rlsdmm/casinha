"use strict";
// Casinha · tela do jogo: toque, menus, ações sociais, modo construir e HUD
// ===================== tela do jogo =====================
const canvas = $("game");
function resize(){
  const w = canvas.clientWidth || canvas.parentElement.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * H / W * dpr);
  canvas.style.height = (w * H / W) + "px";
}
window.addEventListener("resize", () => { if (!$("screenGame").hidden) resize(); });

function worldFromEvent(e){
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W * T, y: (e.clientY - r.top) / r.height * H * T, sx: e.clientX - r.left, sy: e.clientY - r.top };
}
function playerAt(wx, wy, folga){
  let best = null, bd = 12 + (folga || 0);
  for (const [id, j] of Object.entries(jogadores)){
    if (id === pid || !disp[id] || (j.andar || 0) !== andarAtual) continue;
    const d = disp[id], cx = (d.x + .5) * T, cy = (d.y + 1) * T - 2;
    const dd = Math.hypot(wx - cx, (wy - (cy - 8)) * .8);
    if (dd < bd){ bd = dd; best = id; }
  }
  return best;
}
function furnAt(tx, ty){
  let found = occ[ty] && occ[ty][tx];
  if (found) return found;
  // móveis altos: toque um tile acima também conta
  if (occ[ty + 1] && occ[ty + 1][tx] && ["geladeira", "geladeiraG", "estante", "armario", "tv", "tvG", "pc", "som", "canteiro", "violao", "cavalete"].includes(baseT((moveis[occ[ty + 1][tx]] || {}).t || "")) /* leva 12: girados também */) return occ[ty + 1][tx];
  return null;
}

canvas.addEventListener("pointermove", e => { if (mode !== "build") return; const p = worldFromEvent(e); hover = { x: Math.floor(p.x / T), y: Math.floor(p.y / T) }; });
canvas.addEventListener("pointerleave", () => { hover = null; });
canvas.addEventListener("click", e => {
  if (!me) return;
  const p = worldFromEvent(e), tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
  closeMenu();
  if (leva10Click(p, tx, ty, toque0(e))) return; // leva 10: viagem de carro, pelúcia de quem saiu, carrinho
  if (mode === "build"){ hover = { x: tx, y: ty }; buildClick(tx, ty, p); return; }
  // no toque (dedo), alvos pequenos (pessoa, bichinho, mural, troféus, placa) aceitam um raio maior
  const toque = toque0(e);
  const other = playerAt(p.x, p.y, toque ? 4 : 0);
  if (other) return socialMenu(other, p);
  if (euAt12b(p, toque)) return; // leva 12b: tocar no próprio boneco abre "Me ver no espelho"
  if (petAt(p.x, p.y, toque ? 5 : 0)) return petMenu(p);
  if (leva9Click(p, tx, ty, toque)) return; // leva 9: presente embrulhado no chão
  if (leva5Click(p, tx, ty, toque)) return; // leva 5: visitas e sujeira
  if (naEscada(tx, ty)) return irEscada(); // leva 4: toque na escada sobe ou desce
  const ativos = HOTSPOTS.filter(h => (h.andar || 0) === andarAtual && (!h.ativo || h.ativo()));
  const hs = ativos.find(h => h.x === tx && h.y === ty);
  if (hs) return hs.fn();
  // leva 8: na parede, a decoração vem antes do "toque um quadrado acima" dos móveis altos
  // (casas antigas podem ter quadro atrás de estante; antes o toque sempre ia pro móvel)
  const f = (occ[ty] && occ[ty][tx]) || (decorEm(tx, ty) ? null : furnAt(tx, ty));
  if (f) return furnMenu(f, p);
  if (decorClickVivo(tx, ty, p)) return; // leva 6: quadros, relógio, espelho na parede
  const fg = toque ? 7 : 3, perto = ativos.find(h => p.x >= h.x * T - fg && p.x < (h.x + 1) * T + fg && p.y >= h.y * T - fg && p.y < (h.y + 1) * T + fg);
  if (perto) return perto.fn();
  if (walkable(tx, ty)) goTo(() => tx === me.tx && ty === me.ty ? true : null, (x, y) => x === tx && y === ty, null);
});

function toque0(e){ return e.pointerType === "touch" || e.pointerType === "pen" || (!e.pointerType && !!window.matchMedia && matchMedia("(pointer: coarse)").matches); }
function openMenu(p, titulo, items){
  closeMenu();
  const m = el("div", "menu"); m.setAttribute("role", "menu");
  m.append(el("div", "ttl", titulo));
  for (const it of items){
    if (it.nota){ const n = el("div", "ttl", it.nome); n.style.cssText = "font-family:var(--body);font-size:.82rem;font-weight:700"; m.append(n); continue; } // linha de texto, sem ação
    const b = el("button"); b.type = "button"; b.setAttribute("role", "menuitem");
    b.append(el("span", null, it.nome)); if (it.info) b.append(el("small", null, it.info));
    b.onclick = ev => { ev.stopPropagation(); closeMenu(); it.fn(); };
    m.append(b);
  }
  document.body.append(m);
  const r = canvas.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
  let x = r.left + p.sx + 10; if (x + m.offsetWidth > vw - 6) x = r.left + p.sx - 10 - m.offsetWidth; // vira pro outro lado do dedo
  m.style.left = clamp(x, 6, Math.max(6, vw - m.offsetWidth - 6)) + "px";
  m.style.top = clamp(r.top + p.sy - 16, 6, Math.max(6, vh - m.offsetHeight - 6)) + "px";
  menuEl = m; const first = m.querySelector("button"); if (first) first.focus({ preventScroll: true });
}
function closeMenu(){ if (menuEl){ menuEl.remove(); menuEl = null; } }
document.addEventListener("keydown", e => { if (e.key === "Escape"){ closeMenu(); closePanel(); } });
document.addEventListener("click", e => { if (menuEl && !menuEl.contains(e.target) && e.target !== canvas) closeMenu(); });
window.addEventListener("scroll", () => { if (menuEl) closeMenu(); }, { passive: true });
window.addEventListener("resize", () => { if (menuEl) closeMenu(); });

function ganhoTxt(a){
  const parts = [];
  if (a.dinheiro) parts.push("+$" + a.dinheiro);
  for (const [k, v] of Object.entries(a.ganho || {})) if (v > 0) parts.push(NEEDS.find(n => n.id === k).nome);
  return parts.slice(0, 2).join(", ");
}
function furnMenu(id, p){
  const m = moveis[id], c = CAT[m.t];
  const items = c.acoes.map(a => ({ nome: a.nome, info: ganhoTxt(a), fn: () => useFurn(id, a) }));
  if (MENU_EXTRA[m.t]) items.push(...MENU_EXTRA[m.t](id, m));
  if (!items.length){ toast(c.nome + " é só decoração. Fica lindo, né?"); return; }
  openMenu(p, c.nome, items);
}
function socialMenu(id, p){
  const items = SOCIAL.filter(s => !s.mostrar || s.mostrar(id)).map(s => ({ nome: s.nome, fn: () => social(id, s) }));
  openMenu(p, nomeDe(id), [itemVerPessoa(id)].concat(items, menuSocial7(id))); // leva 7: namorar, bebê no colo; v31: "ver de pertinho" no topo
}

function goTo(_unused, isGoal, after){
  if (me.acao) setAcao(null);
  const path = bfs(me.tx, me.ty, isGoal);
  if (!path){ toast("Não dá pra chegar aí."); return; }
  me.path = path; me.plano = after;
  if (!path.length && after) { me.plano = null; after(); }
  renderHud();
}
function useFurn(id, a){
  const m = moveis[id]; if (!m) return;
  // leva 4: assistir TV é sentado no sofá da frente (de costas, olhando a tela), se tiver um
  if (m.t === "tv" && a.id === "tv"){ const s = sofaDaTv(m); if (s) return useFurn(s, Object.assign({}, a, { tela: id, cima: 1, sobre: 1 })); }
  goTo(null, adjTo(m), () => {
    const mm = moveis[id]; if (!mm) return;
    const c = CAT[mm.t];
    if (a.roupa){ openCreator(true); return; }
    faceTo(mm.x + c.w / 2 - .5, mm.y + c.h / 2 - .5);
    startAcao(a, id);
  });
}
function social(id, s){
  const j = jogadores[id]; if (!j) return;
  if (!j.online){ toast(nomeDe(id) + " não está na casa agora."); return; }
  if ((j.andar || 0) !== andarAtual){ toast(nomeDe(id) + " está " + ondeTxt(j.andar || 0) + "."); return; }
  const d = disp[id] || { x: j.x, y: j.y }; const ox = Math.round(d.x), oy = Math.round(d.y);
  const goal = (x, y) => Math.abs(x - ox) + Math.abs(y - oy) === 1;
  goTo(null, goal, () => {
    const jj = jogadores[id]; if (!jj) return;
    faceTo(jj.x, jj.y);
    setAcao({ id: "s-" + s.id, nome: s.nome + " com " + nomeDe(id), ini: Date.now(), dur: s.dur * 1000, alvo: id, def: { ganho: s.eu, social: s } });
    ref("eventos/" + id).push({ tipo: s.id, de: pid, at: firebase.database.ServerValue.TIMESTAMP }).catch(() => {});
    const stK = { dancar: "dancas", abracar: "abracos", beijo: "beijos" }[s.id]; if (stK) statMais(stK);
    burst(me.px, me.py, s.id === "beijo" || s.id === "abracar" || s.id === "chute" ? "heart" : "note");
    sfx(s.id === "beijo" ? "beijo" : s.id === "chute" ? "chute" : "pop");
  });
}
function faceTo(x, y){
  const dx = x - me.tx, dy = y - me.ty;
  me.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  savePos();
}

// ===================== construir =====================
const naLista = (l, x, y) => l.some(([a, b]) => a === x && b === y);
// a escada tem que continuar alcançável: caminho da porta (7,3) até o pé (térreo) ou o patamar (em cima), sem passar por móvel
function escadaAlcanca(ignorar, bloq){
  const alvo = andarAtual === 1 ? TOPO_ESCADA : PE_ESCADA, vis = new Set([3 * W + 7]), q = [[7, 3]];
  while (q.length){
    const [x, y] = q.shift(); if (naLista(alvo, x, y)) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      const nx = x + dx, ny = y + dy, k = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || vis.has(k)) continue;
      const v = MAP[ny][nx]; if (v === 1 || v === 4 || (occ[ny][nx] && occ[ny][nx] !== ignorar) || (bloq && bloq.has(k))) continue;
      vis.add(k); q.push([nx, ny]);
    }
  }
  return false;
}
function fechaEscada(t, x, y, ignore){
  const c = CAT[t]; if (c.chao || !(escadaOn || andarAtual === 1)) return false;
  const bloq = new Set(); for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++) bloq.add((y + dy) * W + x + dx);
  return escadaAlcanca(ignore) && !escadaAlcanca(ignore, bloq);
}
function canPlace(t, x, y, ignore){
  const c = CAT[t], cima = andarAtual === 1;
  for (let dy = 0; dy < c.h; dy++) for (let dx = 0; dx < c.w; dx++){
    const xx = x + dx, yy = y + dy;
    if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1 || MAP[yy][xx] !== 0) return false;
    if (!c.chao && occ[yy][xx] && occ[yy][xx] !== ignore) return false;
    if (cima){ // 2º andar: externos só na varanda (piscininha só no quintal); patamar da escada fica livre
      if (c.fora && (t === "piscina" || c.soQuintal || comodo(xx, yy) !== "varanda")) return false;
      if (!c.chao && naLista(RESERVA_ANDAR2, xx, yy)) return false;
      continue;
    }
    if (c.fora ? yy <= HC : (!c.livre && yy > HC)) return false; // externo só no quintal; móveis de dentro só em casa
    if (portaQ && xx === portaQ && (yy === HC - 1 || yy === HC + 1) && !c.chao) return false; // passagem da porta do quintal
    if (c.fora && y === HC + 1 && (TOP[t] || 0) > 6) return false; // alto colado na parede de baixo invadiria a cozinha
    if (escadaOn && !c.chao && naLista(PE_ESCADA, xx, yy)) return false; // pé da escada fica livre
  }
  if (c.chao){ for (const [id, m] of Object.entries(moveis)){ if (id === ignore || !CAT[m.t] || !CAT[m.t].chao) continue; const o = CAT[m.t];
    if (x < m.x + o.w && x + c.w > m.x && y < m.y + o.h && y + c.h > m.y) return false; } }
  if (!c.chao){ for (const [id, j] of Object.entries(jogadores)){ if (!j.online || (id === pid && me ? me.andar : j.andar || 0) !== andarAtual) continue; const d = id === pid && me ? { x: me.tx, y: me.ty } : j; if (d.x >= x && d.x < x + c.w && d.y >= y && d.y < y + c.h) return false; } }
  if (fechaEscada(t, x, y, ignore)) return false; // leva 4: não fecha o caminho da escada
  if (escondeDecor(t, x, y)) return false; // leva 8: móvel alto não vai na frente de quadro da parede
  return true;
}
function buildClick(tx, ty, p){
  if (leva6BuildClick(tx, ty, p)) return; // leva 6: papel de parede e decoração
  if (tool && tool.kind === "piso"){
    if (!MAP[ty] || MAP[ty][tx] === 1) return;
    const cm = comodo(tx, ty);
    if (cm === "quintal"){ toast("O quintal é de grama."); return; }
    ref((COMODOS2.has(cm) ? "casa/pisos2/" : "casa/pisos/") + cm).set(tool.idx).then(() => toast(COMODOS[cm] + " com piso novo."));
    return;
  }
  if (!tool && naEscada(tx, ty)){ toast("A escada fica fixa aí."); return; }
  if (tool && (tool.kind === "novo" || tool.kind === "mover")){
    const t = tool.t, cima = andarAtual === 1;
    if (CAT[t].fora && !cima && !temQuintal()){ toast("Esse é pro quintal. Juntem $" + QUINTAL_PRECO + " no cofrinho pra liberar."); return; }
    if (cima && (t === "piscina" || CAT[t].soQuintal)){ toast((t === "piscina" ? "A piscininha" : CAT[t].nome) + " só cabe no quintal."); return; }
    if (CAT[t].nivel && nivelCasal() < CAT[t].nivel){ toast(CAT[t].nome + " libera no nível " + CAT[t].nivel + " do casal."); return; }
    if (!canPlace(t, tx, ty, tool.id)){
      toast(naEscada(tx, ty) || (cima ? naLista(RESERVA_ANDAR2, tx, ty) : escadaOn && naLista(PE_ESCADA, tx, ty)) ? "Aí é a passagem da escada." :
        MAP[ty] && MAP[ty][tx] === 0 && fechaEscada(t, tx, ty, tool.id) ? "Aí fecha o caminho até a escada." :
        escondeDecor(t, tx, ty) ? "Esse móvel é alto e esconderia a decoração da parede." :
        cima ? (CAT[t].fora && comodo(tx, ty) !== "varanda" ? "Esse vai lá fora, na varanda." : "Não cabe aí. Tente outro lugar.") :
        CAT[t].fora && ty <= HC ? "Esse vai lá fora, no quintal." : !CAT[t].fora && !CAT[t].livre && ty > HC ? "Esse móvel é de dentro de casa." : "Não cabe aí. Tente outro lugar.");
      return;
    }
    if (tool.kind === "novo"){
      const preco = tool.preco != null ? tool.preco : CAT[t].preco;
      if (me.dinheiro < preco){ toast("Faltam $" + (preco - Math.floor(me.dinheiro)) + ". Trabalhe no computador pra ganhar mais."); return; }
      me.dinheiro -= preco; saveNeeds(true);
      const novo = { t, x: tx, y: ty, por: pid }; if (cima) novo.andar = 1;
      ref("casa/moveis").push(novo).then(() => { toast(CAT[t].nome + (cima ? " lá em cima" : " na casa") + ". -$" + preco); if (CAT[t].loja) ref("casa/loja/" + t).set(true).catch(() => {}); });
      tool = null; renderBuild(); // v25: comprou e colocou, solta a seleção (pra outro, escolhe de novo no catálogo)
    } else {
      // leva 8: se alguém vendeu enquanto isso, não recria um móvel "fantasma" só com x e y
      txn("casa/moveis/" + tool.id, cur => cur ? Object.assign(cur, { x: tx, y: ty }) : undefined).then(ok => toast(ok ? "Móvel no lugar novo." : "Esse móvel não está mais na casa."));
      tool = null; renderBuild();
    }
    return;
  }
  const f = furnAt(tx, ty) || tapeteAt(tx, ty);
  if (f){
    const m = moveis[f], c = CAT[m.t], volta = Math.round(c.preco * .7);
    openMenu(p, c.nome, [
      { nome: "Mover", fn: () => { tool = { kind: "mover", t: m.t, id: f }; renderBuild(); toast("Toque no lugar novo."); } },
      // leva 8: por transação, pra dois tocando "Vender" ao mesmo tempo não receberem os dois
      { nome: "Vender", info: "+$" + volta, fn: () => { txn("casa/moveis/" + f, cur => cur ? null : undefined).then(ok => { if (!ok){ toast("Esse móvel já saiu da casa."); return; } if (m.t === "canteiro") ref("casa/jardim/" + f).remove().catch(() => {}); me.dinheiro += volta; saveNeeds(true); toast("Venda feita: " + c.nome + ". +$" + volta); }); } }
    ]);
  }
}
function tapeteAt(tx, ty){ for (const [id, m] of Object.entries(moveis)){ const c = CAT[m.t]; if (c && c.chao && tx >= m.x && tx < m.x + c.w && ty >= m.y && ty < m.y + c.h) return id; } return null; }

function renderBuild(){
  $("money2").textContent = me ? "$ " + Math.floor(me.dinheiro) : "";
  $("tMov").setAttribute("aria-pressed", String(buildTab === "mov")); $("tPiso").setAttribute("aria-pressed", String(buildTab === "piso")); $("tParede").setAttribute("aria-pressed", String(buildTab === "parede"));
  $("cat").hidden = buildTab !== "mov"; $("floors").hidden = buildTab !== "piso"; $("paredesBox").hidden = buildTab !== "parede";
  renderLojaB();
  $("buildHint").textContent = (andarAtual === 1 ? "2º andar. " : "") + (tool && tool.kind === "mover" ? "Toque no lugar novo do móvel. Toque no mesmo móvel na lista para cancelar." :
    tool && tool.loja ? "Loja da semana: toque na casa para colocar " + (tool.kind === "decor" ? DECOR_CAT[tool.t].nome : CAT[tool.t].nome) + " ($" + tool.preco + ")." :
    buildTab === "parede" ? hintParede() :
    buildTab === "piso" ? "Escolha um piso e toque num cômodo para trocar." : "Escolha um móvel e toque na casa para colocar. Toque num móvel que já está lá para mover ou vender.");
  if (buildTab === "parede"){ renderParedes(); return; }
  if (buildTab === "mov"){
    const cat = $("cat"); cat.innerHTML = "";
    for (const [t, c] of Object.entries(CAT)){
      if (c.loja && !lojaDonos[t]) continue; // leva 6: item da loja da semana entra no catálogo depois de comprado
      if (c.virt) continue; // leva 11: móvel girado é só um jeito de mostrar (tipo virtual)
      const trava = !!c.nivel && nivelCasal() < c.nivel;
      const b = el("button", "item"); b.type = "button";
      const cv = el("canvas"); cv.width = 128; cv.height = 96;
      const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
      const spr = furnSprite(t, 0), sc = Math.min(128 / spr.c.width, 96 / spr.c.height, 4);
      x.drawImage(spr.c, Math.round((128 - spr.c.width * sc) / 2), Math.round((96 - spr.c.height * sc) / 2), Math.round(spr.c.width * sc), Math.round(spr.c.height * sc));
      const semQuintal = c.fora && (andarAtual === 1 ? t === "piscina" || !!c.soQuintal : !temQuintal());
      b.append(cv, el("span", null, c.nome), trava ? el("span", "lk", "🔒 Nível " + c.nivel) : el("span", "pr", "$" + c.preco + (semQuintal ? " · quintal" : c.fora && andarAtual === 1 ? " · varanda" : "")));
      if (trava){ cv.style.opacity = ".45"; b.setAttribute("aria-label", c.nome + ", libera no nível " + c.nivel + " do casal"); }
      b.setAttribute("aria-pressed", String(!!(tool && tool.kind === "novo" && tool.t === t && !tool.loja)));
      b.disabled = trava || semQuintal || (!!me && me.dinheiro < c.preco && !(tool && tool.t === t));
      if (semQuintal) b.title = "Precisa do quintal";
      b.onclick = () => { tool = tool && tool.kind === "novo" && tool.t === t && !tool.loja ? null : { kind: "novo", t }; renderBuild(); };
      cat.append(b);
    }
  } else {
    const fl = $("floors"); fl.innerHTML = "";
    PISOS.forEach((p, i) => {
      const b = el("button", "floor"); b.type = "button"; b.title = p.nome; b.setAttribute("aria-label", p.nome);
      const cv = el("canvas"); cv.width = 32; cv.height = 32; const x = cv.getContext("2d"); x.imageSmoothingEnabled = false;
      withCtx(x, 1, () => { drawFloorTile(0, 0, p); drawFloorTile(1, 0, p); drawFloorTile(0, 1, p); drawFloorTile(1, 1, p); });
      b.append(cv); b.setAttribute("aria-pressed", String(!!(tool && tool.kind === "piso" && tool.idx === i)));
      b.onclick = () => { tool = { kind: "piso", idx: i }; renderBuild(); };
      fl.append(b);
    });
  }
}
function setMode(m){
  mode = m; tool = null; closeMenu();
  $("mLive").setAttribute("aria-pressed", String(m === "live")); $("mBuild").setAttribute("aria-pressed", String(m === "build"));
  $("buildPanel").hidden = m !== "build"; $("hud").hidden = m === "build"; $("talk").hidden = m === "build";
  if (m === "build") renderBuild();
}
$("mLive").onclick = () => setMode("live");
$("mBuild").onclick = () => setMode("build");
$("tMov").onclick = () => { buildTab = "mov"; tool = null; renderBuild(); };
$("tPiso").onclick = () => { buildTab = "piso"; tool = null; renderBuild(); };
$("tParede").onclick = () => { buildTab = "parede"; tool = null; renderBuild(); };

// ===================== HUD =====================
function mood(){
  if (!me) return "";
  const low = NEEDS.filter(n => me.needs[n.id] < 25);
  if (low.length) return { fome: "Com fome", energia: "Cansado(a)", diversao: "Entediado(a)", social: "Carente", higiene: "Precisando de um banho" }[low[0].id];
  if (me.dados && me.dados.nuvens > srvNow()) return "Nas nuvens ☁️"; // leva 7: depois de namorar
  if (sujeiraNoAndar() >= 5) return "Incomodado(a) com a bagunça"; // leva 5
  const avg = NEEDS.reduce((s, n) => s + me.needs[n.id], 0) / NEEDS.length;
  return avg > 75 ? "Muito feliz" : avg > 50 ? "De boa" : "Meio pra baixo";
}
function renderHud(){
  if (!me || $("screenGame").hidden) return;
  const d = me.dados || {};
  $("meName").textContent = d.nome || "";
  $("meMood").textContent = mood();
  $("money").textContent = "$ " + Math.floor(me.dinheiro);
  const av = $("meAv"), x = av.getContext("2d"); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 24, 24);
  x.drawImage(avatarSprite(d, "down", 0, "stand").c, 0, AV_Y0, 18, 22, 3, 2, 18, 22);
  const nb = $("needs");
  if (!nb.children.length) for (const n of NEEDS){
    const w = el("div", "need"); const r = el("div", "row"); r.append(el("span", null, n.nome), el("span", "v"));
    const bar = el("div", "bar"); const i = el("i"); bar.append(i); w.append(r, bar); w.dataset.id = n.id; nb.append(w);
  }
  for (const w of nb.children){
    const id = w.dataset.id, v = Math.round(me.needs[id]), n = NEEDS.find(q => q.id === id);
    w.querySelector(".v").textContent = v;
    const i = w.querySelector("i"); i.style.width = v + "%"; i.style.background = v < 25 ? "var(--bad)" : n.cor;
  }
  // leva 8: só refaz a linha de status quando ela muda (antes era refeita a cada passo de qualquer jogador
  // e o botão "Parar" podia sumir entre o toque e o clique)
  const st = $("status"), stSig = me.acao ? "a" + me.acao.nome + me.acao.ini : me.path.length ? "w" : "l";
  if (st.dataset.sig === stSig) return;
  st.dataset.sig = stSig; st.innerHTML = "";
  if (me.acao){
    st.append(el("span", null, me.acao.nome));
    const pr = el("div", "prog"); const i = el("i"); i.id = "progBar"; pr.append(i); st.append(pr);
    const b = el("button", "btn ghost small", "Parar"); b.type = "button"; b.onclick = () => setAcao(null); st.append(b);
  } else st.append(el("span", "muted", me.path.length ? "Andando..." : "Livre. Toque em algo na casa."));
}
function renderPeople(){
  const box = $("people");
  const sig = JSON.stringify(Object.entries(jogadores).map(([id, j]) => [id, j.nome, j.online, j.roupa, j.andar || 0, j.visita || 0])) + pid + andarAtual + !!me;
  if (box.dataset.sig === sig) return; // leva 8: não refaz os chips a cada passo
  box.dataset.sig = sig; box.innerHTML = "";
  for (const [id, j] of Object.entries(jogadores)){
    const c = el("span", "chip" + (j.online ? "" : " off")); const sw = el("span", "sw"); sw.style.background = ROUPAS[j.roupa] || ROUPAS[0];
    const outroAndar = id !== pid && j.online && me && (j.andar || 0) !== andarAtual; // leva 4
    c.append(sw, (j.nome || "Alguém") + (id === pid ? " (você)" : "") + (j.visita ? " · visita" : "") + (j.online ? (outroAndar ? " · " + ondeTxt(j.andar || 0) : "") : " · fora")); // leva 10: crachá de visita
    box.append(c);
  }
}
function renderInvite(){
  const b = $("inviteBox"); b.innerHTML = "";
  const box = el("div", "linkbox"); box.append(el("code", null, link()));
  const cp = el("button", "btn small", "Copiar link"); cp.type = "button";
  cp.onclick = async () => { try { await navigator.clipboard.writeText(link()); toast("Link copiado."); } catch(e){ toast("Segure o dedo no link para copiar."); } };
  box.append(cp);
  if (navigator.share){ const sh = el("button", "btn ghost small", "Enviar"); sh.type = "button"; sh.onclick = () => navigator.share({ title: "Casinha", text: "Vem pra nossa casinha!", url: link() }).catch(() => {}); box.append(sh); }
  b.append(box);
}
$("invite").onclick = () => { const p = $("invitePanel"); p.hidden = !p.hidden; if (!p.hidden) p.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
$("reskin").onclick = () => openCreator(true);
$("talk").addEventListener("submit", e => {
  e.preventDefault(); const v = $("say").value.trim().slice(0, 60); if (!v || !me) return;
  ref("jogadores/" + pid).update({ fala: v, falaAt: firebase.database.ServerValue.TIMESTAMP }); $("say").value = "";
});

// ===================== partículas =====================
function burst(x, y, kind){ for (let i = 0; i < 6; i++) particles.push({ x: (x + .5) * T + (Math.random() * 12 - 6), y: (y + 1) * T - 20, vy: -8 - Math.random() * 10, vx: Math.random() * 8 - 4, life: 1.6, kind }); }
