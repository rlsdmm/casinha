"use strict";
// Casinha · leva 6: reflexo, desenhar e adivinhar, perguntas
Object.assign(JOGO_TIPOS, { reflexo: "Reflexo", desenho: "Desenhar e adivinhar", perguntas: "Perguntas sobre o outro" });
Object.assign(JOGO_DESC, { reflexo: "Toque quando ficar verde. Antes do sinal perde a rodada. Melhor de 5.", desenho: "Um desenha, o outro adivinha. 4 rodadas, acerto rápido vale mais.", perguntas: "Um responde sobre si, o outro tenta adivinhar. Quanto vocês se conhecem?" });
const txJT = {};
function txJ(id, k, fn){ const key = id + k; if (txJT[key] && Date.now() - txJT[key] < 1500) return; txJT[key] = Date.now(); txn("casa/jogos/" + id, fn); }
const ladoDe = g => g.a === pid ? "a" : "b";
const foraDesde = {};
function vigiarJogo6(id, g, t){
  const outro = outroDe(g), jo = jogadores[outro];
  if (!jo || !jo.online){
    foraDesde[id] = foraDesde[id] || Date.now();
    if (Date.now() - foraDesde[id] > SAIU_MS) txJ(id, "wo", cur => { if (!cur || cur.estado !== "jogando") return; Object.assign(cur, { estado: "fim", vencedor: pid, motivo: "saiu", quem: outro, fimAt: srvNow() }); return cur; });
  } else delete foraDesde[id];
  JOGO6[g.tipo].tick(id, g, t);
}
function cardJogador(p, txt, vez){
  const c = el("div", "pl" + (vez ? " vez" : "")), av = el("canvas"), tx = el("div", "tx");
  av.width = 18; av.height = 22; const x = av.getContext("2d"); x.imageSmoothingEnabled = false;
  x.drawImage(avatarSprite(jogadores[p] || {}, "down", 0, "stand").c, 0, 0, 18, 22, 0, 0, 18, 22);
  tx.append(el("strong", null, p === pid ? "Você" : nomeDe(p)), el("small", null, txt)); c.append(av, tx); return c;
}
function abrirJogo6(id){
  const g0 = jogos[id], def = JOGO6[g0.tipo];
  openPanel("jogo", JOGO_TIPOS[g0.tipo], corpo => {
    const placar = el("div", "placar"), status = el("p", "jstatus"), area = el("div", "jarea"), acoes = el("div", "hbtns");
    status.setAttribute("aria-live", "polite");
    corpo.append(placar, status, area, acoes);
    const ui = def.montar(area, id);
    let sigP = null, sigA = null;
    const upd = () => {
      const g = jogos[id];
      if (!g){ status.textContent = "Esse jogo acabou."; area.hidden = true; if (sigA !== "x"){ sigA = "x"; acoes.textContent = ""; acoes.append(btn("Fechar", "btn ghost", closePanel)); } return; }
      const outro = outroDe(g), nO = nomeDe(outro), on = !!(jogadores[outro] || {}).online, jogando = g.estado === "jogando";
      const pl = [[pid, ladoDe(g)], [outro, ladoDe(g) === "a" ? "b" : "a"]].map(([p, l]) => [p, def.placar(g, l, p), jogando && def.vez(g, p)]);
      const sp = JSON.stringify(pl) + (jogadores[g.a] || {}).roupa + (jogadores[g.b] || {}).roupa;
      if (sp !== sigP){ sigP = sp; placar.textContent = ""; for (const [p, txt, vez] of pl) placar.append(cardJogador(p, txt, vez)); }
      const fimTxt = () => g.tipo === "perguntas" && !g.motivo ? def.fimTxt(g) :
        g.vencedor === pid ? (g.motivo ? nO + " saiu do jogo. Vitória sua! +$" + JOGO_PREMIO : "Você ganhou! +$" + JOGO_PREMIO) :
        g.vencedor === "empate" ? (g.motivo === "tempo" ? "O jogo parou. Empate." : "Empate! +$" + JOGO_EMPATE + " pra cada.") : g.motivo && g.quem === pid ? "Você saiu do jogo." : nO + " ganhou essa.";
      status.textContent = g.estado === "convite" ? (g.a === pid ? "Esperando " + nO + " aceitar..." : nO + " te chamou. Aceita?") :
        jogando ? def.status(g) + (on ? "" : " " + nO + " saiu; se não voltar, a vitória é sua.") :
        g.estado === "fim" ? fimTxt() : g.estado === "recusado" ? (g.a === pid ? nO + " não pode agora." : "Convite recusado.") :
        g.estado === "expirou" ? "O convite expirou." : "Convite cancelado.";
      area.hidden = g.estado !== "jogando" && g.estado !== "fim";
      ui.upd(g);
      const sa = g.estado + (g.b === pid) + on + !!moveis[g.mov];
      if (sa !== sigA){
        sigA = sa; acoes.textContent = "";
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
      }
    };
    upd();
    painel.tick = () => { const g = jogos[id]; if (g && g.estado === "jogando"){ const t = srvNow(); ui.tick(g, t); def.tick(id, g, t); } };
    return upd;
  });
  bannerKey = null; renderBannerJogo();
}

// ===== Reflexo =====
// rf = { r (rodada), pa, pb, ini (antes disso o toque não conta), sinal (servidor), ta/tb (toques), ult: { w, m, ta, tb, s }, res ("a"/"b"/"-"), vaz }
const RF_PREP = 2400, RF_GRACA = 900, RF_SEM = 6000, RF_META = 3;
function rfDecidir(cur, w, m){
  const rf = cur.rf, now = srvNow();
  rf.ult = { w: w || "", m: m || "", ta: rf.ta || 0, tb: rf.tb || 0, s: rf.sinal };
  if (w){ rf["p" + w] = (rf["p" + w] || 0) + 1; rf.vaz = 0; } else rf.vaz = (rf.vaz || 0) + 1;
  rf.res = (rf.res || "") + (w || "-"); rf.r = (rf.r || 0) + 1; rf.ta = null; rf.tb = null;
  if ((rf.pa || 0) >= RF_META || (rf.pb || 0) >= RF_META) Object.assign(cur, { estado: "fim", vencedor: (rf.pa || 0) > (rf.pb || 0) ? cur.a : cur.b, fimAt: now });
  else if (rf.vaz >= 3) Object.assign(cur, { estado: "fim", vencedor: (rf.pa || 0) > (rf.pb || 0) ? cur.a : (rf.pb || 0) > (rf.pa || 0) ? cur.b : "empate", motivo: "tempo", quem: "", fimAt: now });
  else { rf.ini = now + RF_PREP; rf.sinal = rf.ini + 1200 + Math.floor(Math.random() * 3800); }
  cur.ultima = now;
}
function rfTocar(id){
  const g = jogos[id]; if (!g || g.estado !== "jogando" || !g.rf) return;
  const tt = srvNow(), r = g.rf.r, eu = ladoDe(g);
  if (tt < (g.rf.ini || 0) || g.rf["t" + eu]) return;
  sfx(tt < g.rf.sinal ? "erro" : "pop", .8);
  txn("casa/jogos/" + id, cur => {
    if (!cur || cur.estado !== "jogando" || !cur.rf || cur.rf.r !== r) return;
    const rf = cur.rf, e = cur.a === pid ? "a" : "b", ele = e === "a" ? "b" : "a";
    if (rf["t" + e] || tt < (rf.ini || 0)) return;
    rf["t" + e] = tt;
    if (tt < rf.sinal) rfDecidir(cur, ele, "cedo" + e);                 // queimou a largada: ponto do outro
    else { const o = rf["t" + ele]; if (o) rfDecidir(cur, o <= tt ? ele : e, ""); else cur.ultima = srvNow(); } // os dois tocaram: menor tempo
    return cur;
  });
}
const tRF = {
  st: "reflexos",
  criar(g){ g.rf = { r: 0, pa: 0, pb: 0, res: "", vaz: 0 }; },
  comecar(cur, now){ cur.rf = cur.rf || { r: 0, pa: 0, pb: 0, res: "", vaz: 0 }; cur.rf.ini = now + 1200; cur.rf.sinal = cur.rf.ini + 1500 + Math.floor(Math.random() * 3500); },
  placar: (g, l) => ((g.rf || {})["p" + l] || 0) + " de " + RF_META,
  vez: () => false,
  status: g => "Rodada " + (((g.rf || {}).r || 0) + 1) + ". Quem fizer " + RF_META + " primeiro ganha.",
  tick(id, g, t){
    const rf = g.rf; if (!rf) return;
    const um = rf.ta && rf.tb ? null : (rf.ta || rf.tb);
    if (um && t > um + RF_GRACA) txJ(id, "rg" + rf.r, cur => {
      if (!cur || cur.estado !== "jogando" || !cur.rf || cur.rf.r !== rf.r) return;
      const c = cur.rf; if (c.ta && c.tb) return; const w = c.ta ? "a" : c.tb ? "b" : null; if (!w || srvNow() < c["t" + w] + RF_GRACA) return;
      rfDecidir(cur, w, ""); return cur;
    });
    else if (!rf.ta && !rf.tb && t > rf.sinal + RF_SEM) txJ(id, "rv" + rf.r, cur => {
      if (!cur || cur.estado !== "jogando" || !cur.rf || cur.rf.r !== rf.r || cur.rf.ta || cur.rf.tb || srvNow() < cur.rf.sinal + RF_SEM) return;
      rfDecidir(cur, "", "ninguem"); return cur;
    });
  },
  montar(area, id){
    const big = btn("", "rfbtn"), hist = el("div", "rfhist"), dica = el("p", "muted", "Quando ficar verde, toque o mais rápido que puder. Tocar antes do sinal dá o ponto pro outro.");
    big.setAttribute("aria-live", "assertive"); area.append(big, hist, dica);
    big.addEventListener("pointerdown", e => { e.preventDefault(); rfTocar(id); });
    big.addEventListener("click", e => { if (e.detail === 0) rfTocar(id); }); // leitor de tela / teclado sem pointer
    let ant = "", histSig = "";
    const pinta = (g, t) => {
      const rf = g.rf || {}, eu = ladoDe(g), nO = nomeDe(outroDe(g));
      let cls, txt;
      if (g.estado !== "jogando"){ cls = "prep"; txt = g.estado === "fim" ? "Fim de jogo" : "Esperando..."; }
      else if (t < (rf.ini || 0)){
        cls = "prep"; const u = rf.ult;
        if (!u) txt = "Prepare-se...";
        else if (/^cedo/.test(u.m)) txt = u.m.slice(4) === eu ? "Você tocou antes do sinal! Ponto de " + nO + "." : nO + " tocou antes do sinal! Ponto seu.";
        else if (u.m === "ninguem") txt = "Ninguém tocou. De novo!";
        else { const ms = u["t" + u.w] - u.s; txt = (u.w === eu ? "Ponto seu! " : "Ponto de " + nO + ". ") + ms + " ms"; }
      }
      else if (rf["t" + eu]){ cls = "espera"; txt = "Você: " + (rf["t" + eu] - rf.sinal) + " ms. Esperando " + nO + "..."; }
      else if (t < rf.sinal){ cls = "espera"; txt = "Espere o verde..."; }
      else { cls = "agora"; txt = "TOQUE!"; }
      if (cls + txt !== ant){ if (cls === "agora" && ant.indexOf("agora") !== 0) sfx("sinal"); ant = cls + txt; big.className = "rfbtn " + cls; big.textContent = txt; }
      const hs = (rf.res || "") + eu; if (hs !== histSig){ histSig = hs; hist.textContent = ""; for (const c of rf.res || ""){ const s = el("span", c === "-" ? "" : c === eu ? "eu" : "ele"); s.title = c === "-" ? "ninguém" : c === eu ? "você" : nO; hist.append(s); } }
    };
    return { upd: g => pinta(g, srvNow()), tick: (g, t) => pinta(g, t) };
  },
  tela(g, sx, sy, sw, shh, tm){
    const rf = g.rf || {}, t = srvNow(), verde = g.estado === "jogando" && t >= (rf.sinal || 0) && t >= (rf.ini || 0), cx = sx + Math.floor(sw / 2) - 2, cy = sy + Math.floor(shh / 2) - 2;
    rbox(cx, cy, 4, 4, verde ? "#5DCAA5" : g.estado === "fim" ? C.gold : "#F0707A"); P(cx + 1, cy + 1, "#FFFFFF");
    for (let i = 0; i < (rf.pa || 0); i++) P(sx + 1 + i * 2, sy + shh - 2, "#F08A7A");
    for (let i = 0; i < (rf.pb || 0); i++) P(sx + sw - 2 - i * 2, sy + shh - 2, "#7FD0F5");
  }
};

// ===== Desenhar e adivinhar =====
// ds = { r, pa, pb, pal ("i,j,k,l" índices em PALAVRAS), ini (servidor), fim, ok: { t, pts }, ch: [chutes errados] }; tracos/<r>/<push> = { s, c, p: "x,y,x,y..." } ou { x: 1 } (apagou)
const PALAVRAS = ["casa", "gato", "cachorro", "sol", "lua", "estrela", "árvore", "flor", "coração", "peixe", "pássaro", "bolo", "pizza", "banana", "maçã", "sorvete",
  "carro", "bicicleta", "avião", "barco", "chuva", "nuvem", "montanha", "praia", "cama", "sofá", "cadeira", "mesa", "porta", "janela", "chave", "relógio",
  "óculos", "chapéu", "sapato", "camiseta", "guarda-chuva", "livro", "lápis", "telefone", "televisão", "violão", "bola", "pipa", "balão", "presente", "vela",
  "abacaxi", "morango", "uva", "cenoura", "ovo", "café", "xícara", "garfo", "panela", "borboleta", "abelha", "cobra", "tartaruga", "coelho", "urso", "porco",
  "vaca", "galinha", "girafa", "elefante", "foguete", "robô", "fantasma", "coroa", "anel", "arco-íris", "cogumelo", "boneco de neve", "sereia", "dinossauro",
  "castelo", "ponte", "trem", "lâmpada", "tesoura", "escova de dentes", "travesseiro", "aranha", "caracol", "pinguim", "piscina"];
const DS_MS = 80000, DS_ENTRE = 4000, DS_RODADAS = 4, DS_W = 160, DS_H = 120;
const DS_CORES = ["#2E2638", "#E8607A", "#378ADD", "#4FA568", "#F6C667", "#8C5E3A", "#FFF8EC"];
const DS_NOMES = ["Preto", "Vermelho", "Azul", "Verde", "Amarelo", "Marrom", "Borracha"];
const normTxt = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function chuteCerto(chute, pal){ const a = normTxt(chute), b = normTxt(pal); return !!a && (a === b || a + "s" === b || a === b + "s" || a.replace(/ /g, "") === b.replace(/ /g, "")); }
const dsDesenhista = g => (g.ds || {}).r % 2 === 0 ? g.a : g.b;
const dsPalavra = g => { const ds = g.ds || {}, i = +String(ds.pal || "").split(",")[ds.r]; return PALAVRAS[i] || ""; };
function dsChutar(id, txt){
  const g = jogos[id]; if (!g || !g.ds || g.estado !== "jogando") return;
  const r = g.ds.r, chute = String(txt).trim().slice(0, 30); if (!chute) return;
  const certo = chuteCerto(chute, dsPalavra(g));
  txn("casa/jogos/" + id, cur => {
    if (!cur || cur.estado !== "jogando" || !cur.ds || cur.ds.r !== r || cur.ds.fim) return;
    const ds = cur.ds, now = srvNow(); if (now < ds.ini || dsDesenhista(cur) === pid) return;
    if (chuteCerto(chute, dsPalavra(cur))){
      const tempo = now - ds.ini, pts = clamp(10 - Math.floor(tempo / 8000), 3, 10), eu = cur.a === pid ? "a" : "b", ele = eu === "a" ? "b" : "a";
      ds["p" + eu] = (ds["p" + eu] || 0) + pts; ds["p" + ele] = (ds["p" + ele] || 0) + Math.ceil(pts / 2);
      ds.fim = now; ds.ok = { t: tempo, pts };
    } else { const ch = Array.isArray(ds.ch) ? ds.ch.filter(Boolean) : Object.values(ds.ch || {}); ch.push(chute); ds.ch = ch.slice(-5); }
    cur.ultima = now; return cur;
  }).then(ok => { if (ok) sfx(certo ? "acerto" : "erro", .7); });
}
// lotes do traço: o desenhista junta os pontos e manda a cada 300 ms
const dsBuf = { id: null, r: -1, lotes: [] };
setInterval(() => {
  if (!dsBuf.lotes.length || !dsBuf.id) return;
  const g = jogos[dsBuf.id], lotes = dsBuf.lotes; dsBuf.lotes = [];
  if (!g || g.estado !== "jogando" || !g.ds || g.ds.r !== dsBuf.r || g.ds.fim || dsDesenhista(g) !== pid) return;
  const base = ref("casa/jogos/" + dsBuf.id + "/tracos/" + dsBuf.r);
  for (const l of lotes) base.push(l.x ? { x: 1, s: l.s } : { s: l.s, c: l.c, p: l.p.join(",") }).catch(() => {});
}, 300);
function dsLote(id, r, s, c, pt){
  if (dsBuf.id !== id || dsBuf.r !== r){ dsBuf.id = id; dsBuf.r = r; dsBuf.lotes = []; }
  const ult = dsBuf.lotes[dsBuf.lotes.length - 1];
  if (pt === "x"){ dsBuf.lotes.push({ x: 1, s }); return; }
  if (ult && !ult.x && ult.s === s) ult.p.push(pt[0], pt[1]); else dsBuf.lotes.push({ s, c, p: [pt[0], pt[1]] });
}
const tDS = {
  st: "desenhos",
  criar(g){ const idx = PALAVRAS.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } g.ds = { r: 0, pa: 0, pb: 0, pal: idx.slice(0, DS_RODADAS).join(",") }; },
  comecar(cur, now){ cur.ds.ini = now + 1500; },
  placar: (g, l) => ((g.ds || {})["p" + l] || 0) + " pontos",
  vez: (g, p) => !!g.ds && dsDesenhista(g) === p,
  status(g){ const ds = g.ds || {}; return "Rodada " + Math.min(DS_RODADAS, (ds.r || 0) + 1) + " de " + DS_RODADAS + "."; },
  tick(id, g, t){
    const ds = g.ds; if (!ds) return;
    if (!ds.fim && t > ds.ini + DS_MS) txJ(id, "dt" + ds.r, cur => {
      if (!cur || cur.estado !== "jogando" || !cur.ds || cur.ds.r !== ds.r || cur.ds.fim || srvNow() < cur.ds.ini + DS_MS) return;
      cur.ds.fim = srvNow(); cur.ds.ok = null; cur.ultima = srvNow(); return cur;
    });
    else if (ds.fim && t > ds.fim + DS_ENTRE) txJ(id, "dn" + ds.r, cur => {
      if (!cur || cur.estado !== "jogando" || !cur.ds || cur.ds.r !== ds.r || !cur.ds.fim || srvNow() < cur.ds.fim + DS_ENTRE) return;
      const c = cur.ds, now = srvNow();
      c.r++; c.fim = null; c.ok = null; c.ch = null; cur.tracos = null; cur.ultima = now;
      if (c.r >= DS_RODADAS) Object.assign(cur, { estado: "fim", vencedor: (c.pa || 0) > (c.pb || 0) ? cur.a : (c.pb || 0) > (c.pa || 0) ? cur.b : "empate", fimAt: now });
      else c.ini = now + 1500;
      return cur;
    });
  },
  montar(area, id){
    const info = el("p", "dsinfo"), tempo = el("div", "prog"), ti = el("i"); tempo.append(ti);
    const cv = el("canvas", "dscv"); cv.width = DS_W; cv.height = DS_H; cv.setAttribute("aria-label", "Quadro de desenho");
    const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false;
    const ferr = el("div", "dsferr"), chutes = el("div", "dschutes"), form = el("form", "talk"), inp = el("input");
    inp.type = "text"; inp.maxLength = 30; inp.placeholder = "Qual é a palavra?"; inp.setAttribute("aria-label", "Seu chute"); inp.autocomplete = "off"; inp.setAttribute("autocapitalize", "off");
    const enviar = btn("Chutar", "btn small"); enviar.type = "submit"; form.append(inp, enviar);
    form.addEventListener("submit", e => { e.preventDefault(); const v = inp.value; inp.value = ""; dsChutar(id, v); inp.focus({ preventScroll: true }); });
    area.append(info, tempo, cv, ferr, form, chutes);
    let cor = 0, stroke = null, meus = new Set(), vistos = new Set(), ultPt = {}, rodada = -1, sigF = "", sigC = "";
    const pinta = (x0, y0, x1, y1, c) => { // linha de quadradinhos (pixel)
      const t = c === 6 ? 6 : 2, n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); cx.fillStyle = DS_CORES[c] || DS_CORES[0];
      for (let i = 0; i <= n; i++){ const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); cx.fillRect(x - (t >> 1), y - (t >> 1), t, t); }
    };
    const limpa = () => { cx.fillStyle = "#FFF8EC"; cx.fillRect(0, 0, DS_W, DS_H); ultPt = {}; };
    limpa();
    const replay = g => {
      const r = (g.ds || {}).r; if (r !== rodada){ rodada = r; vistos = new Set(); meus = new Set(); limpa(); }
      const lote = ((g.tracos || {})[r]) || {};
      for (const k of Object.keys(lote).sort()){
        if (vistos.has(k)) continue; vistos.add(k);
        const b = lote[k]; if (!b) continue;
        if (b.x){ if (!meus.has(b.s)) limpa(); continue; }
        if (meus.has(b.s)) continue;
        const p = String(b.p || "").split(",").map(Number); let prev = ultPt[b.s];
        for (let i = 0; i + 1 < p.length; i += 2){ const q = [p[i], p[i + 1]]; if (prev) pinta(prev[0], prev[1], q[0], q[1], b.c); else pinta(q[0], q[1], q[0], q[1], b.c); prev = q; }
        ultPt[b.s] = prev;
      }
    };
    const podeDesenhar = () => { const g = jogos[id]; return !!g && g.estado === "jogando" && !!g.ds && !g.ds.fim && dsDesenhista(g) === pid && srvNow() >= g.ds.ini; };
    const ponto = e => { const r = cv.getBoundingClientRect(); return [clamp(Math.floor((e.clientX - r.left) / r.width * DS_W), 0, DS_W - 1), clamp(Math.floor((e.clientY - r.top) / r.height * DS_H), 0, DS_H - 1)]; };
    cv.addEventListener("pointerdown", e => {
      if (!podeDesenhar()) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch(err){}
      const g = jogos[id], q = ponto(e); stroke = { s: Math.floor(Math.random() * 1e9), c: cor, last: q, r: g.ds.r }; meus.add(stroke.s);
      pinta(q[0], q[1], q[0], q[1], cor); dsLote(id, g.ds.r, stroke.s, cor, q);
    });
    cv.addEventListener("pointermove", e => {
      if (!stroke) return; e.preventDefault(); if (!podeDesenhar()){ stroke = null; return; }
      const q = ponto(e); if (q[0] === stroke.last[0] && q[1] === stroke.last[1]) return;
      pinta(stroke.last[0], stroke.last[1], q[0], q[1], stroke.c); stroke.last = q; dsLote(id, stroke.r, stroke.s, stroke.c, q);
    });
    const solta = () => { stroke = null; };
    cv.addEventListener("pointerup", solta); cv.addEventListener("pointercancel", solta); cv.addEventListener("lostpointercapture", solta);
    const montaFerr = () => {
      ferr.textContent = "";
      DS_CORES.forEach((c, i) => { const b = btn(i === 6 ? "⌫" : "", "swatch", () => { cor = i; montaFerr(); }); b.style.background = c; if (i === 6) b.style.color = "#2E2638"; b.setAttribute("aria-label", DS_NOMES[i]); b.setAttribute("aria-pressed", String(cor === i)); ferr.append(b); });
      ferr.append(btn("Apagar tudo", "btn ghost small", () => { if (!podeDesenhar()) return; const s = Math.floor(Math.random() * 1e9); meus.add(s); limpa(); dsLote(id, jogos[id].ds.r, s, 0, "x"); }));
    };
    montaFerr();
    const pintaInfo = (g, t) => {
      const ds = g.ds || {}, eu = dsDesenhista(g) === pid, nD = nomeDe(dsDesenhista(g)), pal = dsPalavra(g);
      const resta = Math.max(0, (ds.ini || 0) + DS_MS - t), antes = t < (ds.ini || 0);
      ti.style.width = (ds.fim ? 0 : antes ? 100 : resta / DS_MS * 100) + "%"; ti.style.background = resta < 15000 ? "var(--bad)" : "var(--accent)";
      let html;
      if (g.estado !== "jogando") html = ["", "Fim de jogo."];
      else if (ds.fim) html = ds.ok ? [pal.toUpperCase(), (eu ? nomeDe(outroDe(g)) + " acertou" : "Você acertou") + " em " + Math.round(ds.ok.t / 1000) + " s! +" + ds.ok.pts + (eu ? "" : " pra você, +" + Math.ceil(ds.ok.pts / 2) + " pra quem desenhou") + ". Era: "] : [pal.toUpperCase(), "Tempo esgotado! Era: "];
      else if (eu) html = [pal.toUpperCase(), antes ? "Prepare-se pra desenhar: " : "Desenhe: "];
      else html = ["", antes ? nD + " vai desenhar..." : nD + " está desenhando. " + pal.replace(/[^ -]/g, "_ ").replace(/ {2}/g, "   ").trim() + " (" + pal.replace(/[ -]/g, "").length + " letras) · " + Math.ceil(resta / 1000) + " s"];
      const s = html.join("|");
      if (s !== info.dataset.s){ info.dataset.s = s; info.textContent = html[1]; if (html[0]) info.append(el("b", null, html[0])); }
    };
    return {
      upd(g){
        replay(g);
        const eu = dsDesenhista(g) === pid, ativo = g.estado === "jogando" && !(g.ds || {}).fim;
        const f = String(eu) + ativo; if (f !== sigF){ sigF = f; ferr.hidden = !eu || !ativo; form.hidden = eu || !ativo; cv.style.cursor = eu && ativo ? "crosshair" : "default"; }
        const ch = (g.ds || {}).ch, lista = Array.isArray(ch) ? ch.filter(Boolean) : Object.values(ch || {}), sc = lista.join("|");
        if (sc !== sigC){ sigC = sc; chutes.textContent = ""; for (const c of lista) chutes.append(el("span", null, c)); }
        pintaInfo(g, srvNow());
      },
      tick(g, t){ pintaInfo(g, t); }
    };
  },
  tela(g, sx, sy, sw, shh, tm){
    R(sx + 1, sy + 1, sw - 2, shh - 2, "#FFF8EC");
    const r = (g.ds || {}).r || 0, n = Object.keys(((g.tracos || {})[r]) || {}).length;
    for (let i = 0; i < Math.min(n, 12); i++){ const h = hash(r, i, 33); P(sx + 2 + h % (sw - 4), sy + 2 + (h >> 5) % (shh - 4), DS_CORES[(h >> 9) % 6]); }
  }
};

// ===== Perguntas sobre o outro =====
// pq = { r, qs ("i,j,k,l,m" em PERGUNTAS), ra (resposta de quem é perguntado), rg (chute do outro), rev (revelou), ac (acertos), res ("1"/"0") }
const PERGUNTAS = [
  ["Comida favorita?", ["Pizza", "Sushi", "Feijoada", "Hambúrguer"]], ["Praia ou montanha?", ["Praia", "Montanha"]], ["Café da manhã dos sonhos?", ["Pão de queijo", "Panqueca", "Frutas", "Tapioca"]],
  ["Bicho que mais combina?", ["Gato", "Cachorro", "Coelho", "Preguiça"]], ["Domingo ideal?", ["Dormir até tarde", "Passeio no parque", "Maratona de série", "Almoço com a família"]],
  ["Doce preferido?", ["Brigadeiro", "Sorvete", "Pudim", "Chocolate"]], ["Que superpoder escolheria?", ["Voar", "Ficar invisível", "Teletransporte", "Ler mentes"]],
  ["Estação do ano favorita?", ["Verão", "Outono", "Inverno", "Primavera"]], ["Filme pra ver juntinhos?", ["Comédia", "Terror", "Romance", "Animação"]],
  ["Bebida que mais gosta?", ["Café", "Suco", "Refrigerante", "Chá"]], ["Viagem dos sonhos?", ["Japão", "Paris", "Nordeste", "Disney"]], ["Acorda cedo ou dorme tarde?", ["Acorda cedo", "Dorme tarde"]],
  ["O que faz quando está triste?", ["Come um docinho", "Dorme", "Liga pra alguém", "Ouve música"]], ["Cor favorita?", ["Azul", "Rosa", "Verde", "Roxo"]],
  ["Pizza com abacaxi?", ["Amo", "Nunca!"]], ["Tarefa de casa que menos gosta?", ["Lavar louça", "Varrer", "Lavar roupa", "Limpar banheiro"]], ["Música pra cantar no chuveiro?", ["Sertanejo", "Pop", "MPB", "Rock"]],
  ["Presente que mais ama ganhar?", ["Flores", "Comida", "Cartinha", "Surpresa"]], ["Jeito favorito de receber carinho?", ["Abraço", "Beijinho", "Cafuné", "Elogio"]],
  ["Se fosse um doce de festa, seria...", ["Brigadeiro", "Beijinho", "Cajuzinho", "Bem-casado"]], ["Lugar preferido da casa?", ["Cama", "Sofá", "Cozinha", "Varanda"]],
  ["Dia de chuva é pra...", ["Dormir", "Ver filme", "Cozinhar", "Dançar na chuva"]], ["Qual lanche da madrugada?", ["Miojo", "Pão com manteiga", "Bolacha", "Fruta"]],
  ["Time de cachorro ou de gato?", ["Cachorro", "Gato", "Os dois!"]], ["O que nunca falta na mala?", ["Carregador", "Moletom", "Remédio", "Lanchinho"]],
  ["Programa de sexta à noite?", ["Pizza em casa", "Barzinho", "Cinema", "Dormir cedo"]], ["Mania que tem?", ["Roer unha", "Cantarolar", "Organizar tudo", "Falar sozinho(a)"]],
  ["Personagem que seria?", ["Princesa/príncipe", "Vilã(o) charmoso", "Ajudante engraçado", "Herói/heroína"]], ["Sobremesa de domingo?", ["Pudim", "Pavê", "Sorvete", "Bolo"]],
  ["Qual cheiro mais gosta?", ["Café passando", "Bolo assando", "Chuva na terra", "Roupa limpa"]], ["Na hora da briga, você...", ["Fica quieto(a)", "Quer conversar na hora", "Faz piada", "Pede abraço"]],
  ["Lugar pra um encontro perfeito?", ["Piquenique", "Restaurante", "Cinema", "Em casa de pijama"]], ["Se ganhasse na loteria, primeiro...", ["Viajaria", "Compraria uma casa", "Ajudaria a família", "Guardaria tudo"]],
  ["Jogo preferido?", ["Videogame", "Cartas", "Tabuleiro", "Jogo da velha"]], ["Calor ou frio?", ["Calor", "Frio"]], ["Fruta favorita?", ["Manga", "Morango", "Uva", "Melancia"]],
  ["Como gosta do ovo?", ["Frito", "Mexido", "Cozido", "Omelete"]], ["Animal de estimação dos sonhos?", ["Gatinho", "Cachorrão", "Calopsita", "Tartaruga"]],
  ["O que te faz rir mais?", ["Meme", "Tombo", "Piada ruim", "Vídeo de bichinho"]], ["Hora favorita do dia?", ["Manhã", "Tarde", "Noite", "Madrugada"]],
  ["Sabor de sorvete?", ["Chocolate", "Morango", "Flocos", "Limão"]], ["Que casa ia preferir?", ["Apartamento na cidade", "Casinha no campo", "Casa na praia", "Cabana na montanha"]]
];
const PQ_RODADAS = 5, PQ_PAGA = 8, PQ_REVELA = 4500;
const pqAlvo = g => (g.pq || {}).r % 2 === 0 ? g.a : g.b;
function pqResponder(id, op){
  const g = jogos[id]; if (!g || !g.pq || g.estado !== "jogando") return;
  const r = g.pq.r;
  txn("casa/jogos/" + id, cur => {
    if (!cur || cur.estado !== "jogando" || !cur.pq || cur.pq.r !== r || cur.pq.rev) return;
    const pq = cur.pq, campo = pqAlvo(cur) === pid ? "ra" : "rg";
    if (pq[campo] != null) return;
    pq[campo] = op;
    if (pq.ra != null && pq.rg != null){ const ok = pq.ra === pq.rg; pq.ac = (pq.ac || 0) + (ok ? 1 : 0); pq.res = (pq.res || "") + (ok ? "1" : "0"); pq.rev = srvNow(); }
    cur.vez = pq.rev ? null : pq.ra == null ? pqAlvo(cur) : (pqAlvo(cur) === cur.a ? cur.b : cur.a);
    cur.ultima = srvNow(); return cur;
  }).then(ok => { if (ok) sfx("pop", .6); });
}
const tPQ = {
  st: "perguntas",
  criar(g){ const idx = PERGUNTAS.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } g.pq = { r: 0, ac: 0, res: "", qs: idx.slice(0, PQ_RODADAS).join(",") }; },
  comecar(){},
  placar(g, l, p){ const pq = g.pq || {}, alvo = pqAlvo(g) === p, ja = alvo ? pq.ra != null : pq.rg != null; return pq.rev || g.estado !== "jogando" ? "Acertos: " + (pq.ac || 0) + "/" + PQ_RODADAS : (alvo ? "Responde" : "Adivinha") + (ja ? " ✓" : "..."); },
  vez: (g, p) => { const pq = g.pq || {}; return !pq.rev && (pqAlvo(g) === p ? pq.ra == null : pq.rg == null); },
  status: g => "Pergunta " + Math.min(PQ_RODADAS, ((g.pq || {}).r || 0) + 1) + " de " + PQ_RODADAS + ".",
  fimTxt(g){ const n = (g.pq || {}).ac || 0; return (n >= 5 ? "Almas gêmeas! " : n >= 3 ? "Vocês se conhecem muito bem! " : n >= 1 ? "Ainda tem muito pra descobrir. " : "Bora conversar mais! ") + n + " de " + PQ_RODADAS + " (+$" + n * PQ_PAGA + " pra cada)."; },
  tick(id, g, t){
    const pq = g.pq; if (!pq) return;
    if (pq.rev && t > pq.rev + PQ_REVELA) txJ(id, "pn" + pq.r, cur => {
      if (!cur || cur.estado !== "jogando" || !cur.pq || cur.pq.r !== pq.r || !cur.pq.rev || srvNow() < cur.pq.rev + PQ_REVELA) return;
      const c = cur.pq, now = srvNow(); c.r++; c.ra = null; c.rg = null; c.rev = null; cur.ultima = now; cur.vez = null;
      if (c.r >= PQ_RODADAS) Object.assign(cur, { estado: "fim", vencedor: "empate", fimAt: now });
      return cur;
    });
    else if (!pq.rev && t - (g.ultima || 0) > PARADO_MS) txJ(id, "pp", cur => {
      if (!cur || cur.estado !== "jogando" || srvNow() - (cur.ultima || 0) <= PARADO_MS) return;
      Object.assign(cur, { estado: "fim", vencedor: "empate", motivo: "tempo", quem: "", fimAt: srvNow() }); return cur;
    });
  },
  montar(area, id){
    const quem = el("p", "muted"), q = el("p", "pqq"), ops = el("div", "pqops"), rev = el("p", "jstatus"), med = el("div", "need");
    quem.style.textAlign = "center"; area.append(quem, q, ops, rev, med);
    let sig = null;
    return {
      upd(g){
        const pq = g.pq || {}, s = JSON.stringify([pq, g.estado]); if (s === sig) return; sig = s;
        const i = +String(pq.qs || "").split(",")[Math.min(pq.r || 0, PQ_RODADAS - 1)], [pergunta, opcoes] = PERGUNTAS[i] || PERGUNTAS[0];
        const alvo = pqAlvo(g), souAlvo = alvo === pid, nA = nomeDe(alvo), meu = souAlvo ? pq.ra : pq.rg, fim = g.estado !== "jogando";
        quem.textContent = fim ? "" : souAlvo ? "Responda sobre você (" + nomeDe(outroDe(g)) + " vai tentar adivinhar):" : "O que " + nA + " responderia?";
        q.textContent = fim ? "" : pergunta;
        ops.textContent = ""; ops.hidden = fim;
        if (!fim) opcoes.forEach((o, k) => {
          const b = btn(o, "btn ghost", () => pqResponder(id, k));
          b.setAttribute("aria-pressed", String(meu === k));
          if (pq.rev){ if (k === pq.ra) b.classList.add("certa"); else if (k === pq.rg) b.classList.add("errada"); }
          b.disabled = meu != null || !!pq.rev; ops.append(b);
        });
        rev.textContent = fim ? "" : pq.rev ? (pq.ra === pq.rg ? "Acertou! " : "Errou! ") + nA + " respondeu “" + opcoes[pq.ra] + "”" + (pq.ra === pq.rg ? "." : "; o chute foi “" + opcoes[pq.rg] + "”.") :
          meu != null ? "Resposta enviada. Esperando " + nomeDe(outroDe(g)) + "..." : "";
        med.textContent = ""; const r = el("div", "row"); r.append(el("span", null, "Quanto vocês se conhecem"), el("span", null, (pq.ac || 0) + "/" + PQ_RODADAS));
        const br = barra((pq.ac || 0) / PQ_RODADAS * 100, "#E8607A"); br.firstChild.style.background = "#E8607A"; med.append(r, br);
      },
      tick(){}
    };
  },
  tela(g, sx, sy, sw, shh){
    const cx = sx + Math.floor(sw / 2) - 2, cy = sy + Math.floor(shh / 2) - 3;
    R(cx, cy, 4, 1, "#FCE9B8"); P(cx + 3, cy + 1, "#FCE9B8"); R(cx + 1, cy + 2, 2, 1, "#FCE9B8"); P(cx + 1, cy + 3, "#FCE9B8"); P(cx + 1, cy + 5, "#FCE9B8");
    const n = (g.pq || {}).ac || 0; for (let i = 0; i < n; i++) P(sx + 1 + i * 2, sy + shh - 2, "#F08A7A");
  }
};
const JOGO6 = { reflexo: tRF, desenho: tDS, perguntas: tPQ };
