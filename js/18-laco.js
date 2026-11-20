"use strict";
// Casinha · laço principal: update e draw; boot()
// ===================== laço =====================
// leva 8: quadros por segundo. 60 enquanto alguém anda, há partículas ou o modo construir está mexendo;
// parado, 30 (as animações da casa são lentas e não perdem nada). Aba escondida: o navegador já pausa o rAF.
// PERF: contadores pra medir no console (PERF.draws, PERF.drawMs / PERF.draws = ms por quadro).
const PERF = { draws: 0, drawMs: 0, pulados: 0 };
let last = performance.now(), hudT = 0, ultDraw = 0;
function precisaFluido(){
  if (!me) return false;
  if (me.path.length || particles.length || (mode === "build" && hover)) return true;
  if (me.acao && me.acao.id === "escada") return true;
  for (const id in disp) if (disp[id].moving) return true;
  return false;
}
function tick(now){
  requestAnimationFrame(tick);
  if (!me || $("screenGame").hidden || document.hidden){ last = now; return; }
  // telas de 90/120 Hz: no máximo 60 quadros; parado, 30
  if (now - ultDraw < (precisaFluido() ? 1000 / 60 : 1000 / 30) - 4){ PERF.pulados++; return; }
  ultDraw = now;
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  update(dt);
  const a = performance.now(); if (!drawViagem(now)) draw(now); PERF.drawMs += performance.now() - a; PERF.draws++;
  hudT += dt; if (hudT > .25){ hudT = 0; renderHudLight(); }
}
// leva 8: só mexe no DOM quando o valor muda (evita recalcular estilo/layout 4x por segundo à toa)
const setTx = (e, t) => { if (e && e.textContent !== t) e.textContent = t; };
function renderHudLight(){
  if (!me) return;
  const pb = $("progBar"); if (pb && me.acao){ const w = Math.round(clamp((Date.now() - me.acao.ini) / me.acao.dur * 100, 0, 100)) + "%"; if (pb.style.width !== w) pb.style.width = w; }
  for (const w of $("needs").children){
    const id = w.dataset.id, v = Math.round(me.needs[id]);
    if (w.dataset.v === String(v)) continue;
    w.dataset.v = v; w.querySelector(".v").textContent = v;
    const i = w.querySelector("i"); i.style.width = v + "%"; i.style.background = v < 25 ? "var(--bad)" : NEEDS.find(q => q.id === id).cor;
  }
  setTx($("meMood"), mood()); setTx($("money"), "$ " + Math.floor(me.dinheiro));
  if (mode === "build") setTx($("money2"), "$ " + Math.floor(me.dinheiro));
  if (mode === "live") renderHouseCard();
  renderLeva2Hud(); renderClima(); renderAndarUI(); renderLeva5Hud();
}

const SPEED = 4.2;
function update(dt){
  // necessidades caem enquanto você está na casa
  for (const n of NEEDS) me.needs[n.id] = clamp(me.needs[n.id] - n.queda * dt, 0, 100);
  // andar
  if (me.path.length){
    const [nx, ny] = me.path[0];
    const dx = nx - me.px, dy = ny - me.py, dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > Math.abs(dy)) me.dir = dx > 0 ? "right" : "left"; else if (dy) me.dir = dy > 0 ? "down" : "up";
    const stp = SPEED * dt;
    if (dist <= stp){
      me.px = nx; me.py = ny; me.tx = nx; me.ty = ny; me.path.shift(); savePos();
      if (!walkable(nx, ny)){ me.path = []; }
      if (!me.path.length){ renderHud(); if (me.plano){ const f = me.plano; me.plano = null; f(); } }
    } else { me.px += dx / dist * stp; me.py += dy / dist * stp; }
  }
  // ação em andamento
  if (me.acao){
    const a = me.acao, d = a.def || {};
    let mult = 1;
    if (d.junto){
      // junto = 1: outra pessoa perto fazendo a mesma ação; ou uma função que aceita a ação do outro
      const igual = typeof d.junto === "function" ? d.junto : (ja => ja.id === a.id);
      const par = Object.entries(jogadores).find(([id, j]) => id !== pid && j.online && (j.andar || 0) === andarAtual && j.acao && igual(j.acao) && Date.now() - (j.acao.ini || 0) < (j.acao.dur || 0) + 3000 && Math.hypot(j.x - me.tx, j.y - me.ty) < 5);
      if (par){
        mult = d.juntoMult || 1.5; me.needs.social = clamp(me.needs.social + (d.juntoSocial || 1.2) * dt, 0, 100);
        if (!a.junto){ a.junto = par[0]; if (d.aoJuntar) d.aoJuntar(a, par[0]); }
      }
    }
    for (const [k, v] of Object.entries(d.ganho || {})) me.needs[k] = clamp(me.needs[k] + v * mult * dt / (a.dur / 1000), 0, 100);
    if (me.acao === a && Date.now() - a.ini >= a.dur){
      if (d.dinheiro){ const v = pagaMudanca(d.dinheiro); me.dinheiro += v; toast("+$" + v + " pelo trabalho" + (v > d.dinheiro ? " (com ajuda de mudança)." : ".")); sfx("moeda"); } // leva 11
      a.acabou = true; setAcao(null); saveNeeds(true);
      if (d.fim) d.fim({ junto: a.junto || null });
      acaoTerminada(a);
    }
    if (me.acao === a && a.id === "dormir" && !a.noiteOk) checarNoite(a);
  }
  // outros jogadores
  for (const [id, j] of Object.entries(jogadores)){
    if (id === pid) continue;
    const d = disp[id] || (disp[id] = { x: j.x, y: j.y, moving: false });
    const dx = j.x - d.x, dy = j.y - d.y, dist = Math.hypot(dx, dy);
    if (dist > 4) { d.x = j.x; d.y = j.y; d.moving = false; }
    else if (dist > .01){ const s = Math.min(dist, SPEED * dt); d.x += dx / dist * s; d.y += dy / dist * s; d.moving = true; }
    else d.moving = false;
  }
  for (const id of Object.keys(disp)) if (!jogadores[id]) delete disp[id];
  // partículas
  particles = particles.filter(p => (p.life -= dt) > 0);
  for (const p of particles){ p.x += p.vx * dt; p.y += p.vy * dt; }
  particles.forEach(p => { if (p.kind === "conf") p.vy = Math.min(p.vy + 6 * dt, 40); });
  leva5Update(dt); // passos, sons das ações, casa bagunçada
  leva7Update(dt); // namoro (corações, toc toc), gravidez (cansaço), choro do bebê
  leva9Update(dt); // jantar (corações), cinema (sons das reações)
  leva10Update(dt); // leva 10: card da viagem, barra da visita
  if (performance.now() - lastSave > 4000){ lastSave = performance.now(); saveNeeds(false); }
}

const lo = document.createElement("canvas"); lo.width = W * T; lo.height = H * T + TOPO; // v47: + faixa da parede alta
const lc = document.createElement("canvas"); lc.width = W * T; lc.height = H * T + TOPO;
// leva 8: luz radial em cache por cor e raio (tipo 0: mapa de luz, 3 paradas; tipo 1: brilho, 2 paradas, raio * .7).
// Desenhada com globalAlpha = força; mesmo resultado do gradiente com alfa embutido.
let luzSig = "";
const luzCache = new Map();
function luzSpr(c, r, tipo){
  const key = c + "|" + r + "|" + tipo; let s = luzCache.get(key); if (s) return s;
  const rr = tipo ? r * .7 : r, n = Math.max(2, Math.ceil(rr * 2));
  s = document.createElement("canvas"); s.width = s.height = n;
  const x = s.getContext("2d"), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, "rgba(" + c + ",1)"); if (!tipo) g.addColorStop(.45, "rgba(" + c + ",.6)"); g.addColorStop(1, "rgba(" + c + ",0)");
  x.fillStyle = g; x.fillRect(0, 0, n, n);
  if (luzCache.size > 200) luzCache.clear();
  luzCache.set(key, s); return s;
}
// troca o tamanho da cena (com ou sem quintal): canvases internos, vinheta e largura máxima da tela
function tamanhoCena(){
  for (const c of [bg, lo, lc, vig]){ c.width = W * T; c.height = H * T + TOPO; }
  desenharVinheta(); bgKey = null;
  $("stage").style.maxWidth = H > H_CASA ? "min(100%, 78vh)" : "";
  if (!$("screenGame").hidden) resize();
}
let blinkUntil = {};
const labelTop16 = {}; // id -> topo do nome na tela (depois de empilhar os nomes que se encavalam)
function draw(now){
  const mctx = canvas.getContext("2d");
  ctx = lo.getContext("2d"); S = 1; ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, TOPO); // v47: a cena desce TOPO px; em cima fica a parede alta
  const tm = Date.now(), hr = hourNow();
  // fundo guardado em cache: jardim, pisos, paredes, portas e janelas
  ensureBg(hr);
  ctx.drawImage(bg, 0, -TOPO);
  drawWindowAnim(tm, hr);
  const clima = climaAgora(), est = estacao(), natal = mesAgora() === 12;
  if (natal && !zeroAqui()) drawPiscaPisca(tm);
  if (andarAtual === 0 && !casaZero){ drawMural(tm); drawQuadroTrofeus(tm); } // leva 11: no zero, mural e troféus são itens de parede
  drawDecorParede(tm, hr); // leva 6: quadros, luzinhas, relógio e companhia
  if (andarAtual === 0 && escadaOn){ const ex = ESCADA.x * T, ey = (ESCADA.y + ESCADA.h) * T; R(ex + 1, ey - 1, ESCADA.w * T, 2, "rgba(35,18,40,.24)"); R(ex + ESCADA.w * T, ESCADA.y * T + 4, 1, ESCADA.h * T - 4, "rgba(35,18,40,.18)"); }
  // tapetes
  for (const m of Object.values(moveis)) if (CAT[m.t] && CAT[m.t].chao){ R(m.x * T + 4, m.y * T + CAT[m.t].h * T - 2, CAT[m.t].w * T - 8, 1, "rgba(35,18,40,.18)"); blitFurn(m.t, m.x * T, m.y * T, 0, m.cor); }
  drawSujeiraChao(); // leva 5: pó, migalhas, roupa, folhas, lama, pelos
  if (typeof sombrasMoveis34 === "function") sombrasMoveis34(); // v46: sombra macia dos móveis
  // sombras dos móveis (em degraus, para ficarem suaves)
  for (const [id, m] of Object.entries(moveis)){
    const c = CAT[m.t]; if (!c || c.chao) continue;
    if (tool && tool.kind === "mover" && tool.id === id) continue;
    const x0 = m.x * T, y1 = (m.y + c.h) * T, w = c.w * T;
    if (!isWallAt(m.x, m.y + c.h)){ R(x0 + 1, y1 - 1, w, 2, "rgba(35,18,40,.26)"); R(x0 + 2, y1 + 1, w - 2, 1, "rgba(35,18,40,.16)"); R(x0 + 4, y1 + 2, w - 6, 1, "rgba(35,18,40,.08)"); }
    if (!isWallAt(m.x + c.w, m.y)){ R(x0 + w, m.y * T + 4, 1, c.h * T - 4, "rgba(35,18,40,.2)"); R(x0 + w + 1, m.y * T + 6, 1, c.h * T - 7, "rgba(35,18,40,.1)"); }
  }
  // grade do modo construir
  if (mode === "build"){ ctx.fillStyle = "rgba(255,255,255,.22)"; for (let y = 1; y < H; y++) for (let x = 1; x < W; x++) ctx.fillRect(x * T, y * T, 1, 1); }

  // objetos ordenados pela base
  const objs = [], ativo = {};
  for (const j of Object.values(jogadores)) if (j.online && j.acao && tm - j.acao.ini < j.acao.dur + 3000){ if (j.acao.mov) ativo[j.acao.mov] = 1; if (j.acao.tela) ativo[j.acao.tela] = 1; }
  if (me && me.acao){ if (me.acao.mov) ativo[me.acao.mov] = 1; if (me.acao.tela) ativo[me.acao.tela] = 1; }
  leva5Ativo(ativo);
  for (const [id, m] of Object.entries(moveis)){
    const c = CAT[m.t]; if (!c || c.chao) continue;
    if (tool && tool.kind === "mover" && tool.id === id) continue;
    const fr = furnFrame(m.t, !!ativo[id], tm, m.x * 3 + m.y * 5), z = (m.y + c.h) * T - 1;
    const cobre = mode === "build" && cobreDecor(m); // leva 16a: no construir, móvel alto na frente de decoração fica meio transparente
    objs.push({ z, f: () => { if (cobre) ctx.globalAlpha = .5; blitFurn(m.t, m.x * T, m.y * T, fr, m.cor); if (cobre) ctx.globalAlpha = 1; } }); // leva 11: cor do móvel
    if (ativo[id]) objs.push({ z: z + 3, f: () => drawFx(m.t, m.x * T, m.y * T, tm) });
  }
  addCasaObjs(objs, tm); // leva 1: plantas, pratos na mesa e bichinho
  addJogoObjs(objs, tm); // leva 2: tabuleiro na tela da TV/PC
  addLeva5Objs(objs, tm); // leva 5: visitas e louça na pia
  addLeva7Objs(objs, tm); // leva 7: coberta/espuma/manta do namoro, roupas, berço com o bebê, teste de farmácia
  addLeva9Objs(objs, tm); // leva 9: presentes embrulhados, toalha e velas, tela do cinema, festa do dia especial
  addLeva10Objs(objs, tm); // leva 10: pelúcias de quem saiu, carrinho, luzinha do telefone
  addDecorFrente(objs, tm); // leva 16a: decoração de parede atrás de móvel alto, desenhada por cima dele
  if (escadaOn || andarAtual === 1) objs.push({ z: ESC_Z, f: blitEscada }); // leva 4: escada / guarda-corpo do vão
  const labels = [], lights = [];
  if (andarAtual === 1){ for (const [k, d] of Object.entries(DECOR2)) if (d === "arandela"){ const [x, y] = k.split(",").map(Number); lights.push([x * T + 8, y * T + 9, 30, "255,214,150", .95]); } }
  else if (escadaOn) lights.push([(ESCADA.x + 1) * T, ESCADA.y * T + 2, 22, "255,214,160", .45]); // luz que desce lá de cima
  for (const [id, m] of Object.entries(moveis)){
    if (m.t === "abajur") lights.push([m.x * T + 8, m.y * T - 6, 58, "255,206,130", 1]); // v27: abajur da Cozy (cabeça mais baixa)
    if (ativo[id] && m.t === "tv") lights.push([m.x * T + 16, m.y * T + 2, 38, "140,190,255", .8 + .2 * Math.sin(tm / 110) * Math.sin(tm / 370)]);
    if (ativo[id] && m.t === "pc") lights.push([m.x * T + 16, m.y * T, 24, "140,190,255", .85]);
    if (ativo[id] && m.t === "churrasqueira") lights.push([m.x * T + 12, m.y * T, 26, "255,150,80", .85 + .15 * Math.sin(tm / 80)]);
    if (ativo[id] && m.t === "fogao") lights.push([m.x * T + 8, m.y * T + 2, 20, "255,170,90", .8 + .2 * Math.sin(tm / 90)]);
    if (m.t === "geladeira") lights.push([m.x * T + 8, m.y * T + 4, 12, "220,235,255", .25]);
  }
  leva6Luzes(lights, ativo, tm); // leva 6: luzinhas, neon, lareira, luminárias novas
  leva7Luzes(lights, tm); // leva 7: abajur baixinho no namoro
  leva9Luzes(lights, tm); // leva 9: velas do jantar, sala escura no cinema
  leva10Luzes(lights, tm); // leva 10: luzinha do telefone com recado novo
  leva11Luzes(lights, ativo, tm); // leva 11: móveis novos e girados; mural/troféus de parede
  for (const [id, j] of Object.entries(jogadores)){
    if (!j.nome) continue;
    if (id !== pid && (j.andar || 0) !== andarAtual) continue; // leva 4: cada um vê só o próprio andar
    if (leva10Esconde(id, j)) continue; // leva 10: quem saiu vira pelúcia (addLeva10Objs); quem foi passear não está em casa
    let x, y, dir = j.dir || "down", moving = false, acao = j.acao;
    if (id === pid){ if (!me) continue; x = me.px; y = me.py; dir = me.dir; moving = me.path.length > 0; acao = me.acao; }
    else { const d = disp[id]; if (!d) continue; x = d.x; y = d.y; moving = d.moving; if (acao && tm - acao.ini > acao.dur + 3000) acao = null; }
    let cx = Math.round((x + .5) * T), by = Math.round((y + 1) * T - 3), pose = "stand", frame = moving ? Math.floor(tm / 115) % 4 : 0;
    let deitado = false, sobre = false, sentado = false, movT = null, mv = null, vg = null, slot = 0, esc = null;
    const respira = !moving && Math.floor((tm + (id.charCodeAt(2) || 0) * 97) / 800) % 2 === 1; // respirando parado
    if (!blinkUntil[id] || tm > blinkUntil[id] + 3500 + (id.charCodeAt(1) % 7) * 300) blinkUntil[id] = tm + 140;
    const pisca = tm < blinkUntil[id] && !moving;
    pose = (pisca ? "blink" : "") + (respira ? "breath" : "") || "stand";
    const aid = acao ? (acao.id || "") : "";
    const m0 = acao && acao.mov ? moveis[acao.mov] : null, se0 = m0 ? SENTAR[m0.t] : null;
    if (m0 && (acao.sobre || (se0 && se0.sempre))){
      const c = CAT[m0.t]; mv = m0; movT = m0.t; sobre = true;
      // vaga: ordem entre quem está no mesmo móvel (dois no sofá não ficam um em cima do outro)
      const aqui = Object.keys(jogadores).filter(k => { const aa = k === pid ? (me && me.acao) : jogadores[k].acao; return aa && aa.mov === acao.mov && (k === pid || jogadores[k].online); });
      const nv = se0 && se0.vagas ? se0.vagas.length : 2;
      slot = Math.max(0, aqui.indexOf(id)) % nv;
      if (acao.deitar){ deitado = true; pose = "lie"; const s2 = Object.keys(jogadores).indexOf(id) % 2; cx = m0.x * T + (m0.t === "dossel" || m0.t === "casal" ? (c.w > 2 ? (s2 ? 35 : 13) : (s2 ? 23 : 9)) : m0.t === "rede" ? 24 : c.w * T / 2); /* v37: dossel 2x2 */ by = m0.y * T + (m0.t === "rede" ? 8 : 21);
        if (c.virt){ const largo = c.w > 2 && c.h > 2; cx = Math.round((m0.x + c.w / 2) * T) + (largo ? (s2 ? 10 : -10) : 0); by = Math.round((m0.y + c.h / 2) * T) + 6; } } // leva 11: cama girada
      else {
        vg = se0 ? se0.vagas[slot] : null;
        const usa = vg && (se0.fixas || aqui.length > 1);
        cx = Math.round((m0.x + c.w / 2) * T) + (usa ? vg.dx : 0);
        by = vg ? m0.y * T + (acao.cima && se0.cima ? se0.cima : vg.by) : (m0.y + c.h) * T - 3;
        if (vg && !se0.empe){
          sentado = true; dir = acao.cima ? dirTela(acao, m0) : vg.dir || "down"; // leva 12: olha pra tela (sofá girado: de lado)
          if (m0.t === "balanco"){ const fb = furnFrame("balanco", true, tm, 0), d = fb === 1 ? -1 : fb === 2 ? 1 : 0; cx += slot ? -d : d; } // vai e volta com o assento
        } else vg = null; // em pé em cima (chuveiro, piscina)
      }
    }
    if (sentado){
      // atividade sentada: comer/piquenique leva o garfo à boca, café a xícara, computador e jogo nas mãos; comemora de vez em quando
      let act = aid === "comer" || aid === "piquenique" || aid === "jantar" ? "eat" : aid === "cafe" ? "drink" : aid === "minigame" || movT === "pc" ? "pc" : "";
      if (aid === "minigame" && Math.floor((tm + id.charCodeAt(1) * 131) / 900) % 5 === 0) act = "arms";
      frame = act === "pc" ? Math.floor((tm + id.charCodeAt(1) * 53) / 170) % 2 : act === "eat" || act === "drink" ? (Math.floor((tm + id.charCodeAt(1) * 211) / 650) % 3 === 2 ? 1 : 0) : 0;
      pose = "sit" + act + (pisca ? "blink" : "") + (respira && !act ? "breath" : "");
    } else if (!deitado){
      if (/dancar/.test(aid)){ pose = Math.floor(tm / 260) % 2 ? "arms" : "stand"; frame = Math.floor(tm / 260) % 2 ? 1 : 3; }
      if (/^s-(cocegas|abracar|beijo)/.test(aid)) pose = "arms";
      if (aid === "minigame" && Math.floor((tm + id.charCodeAt(1) * 131) / 900) % 5 === 0) pose = "arms"; // comemora de vez em quando
    }
    // leva 7: namorando: os dois juntinhos no lugar escolhido (posição e carinha dependem da fase)
    const n7 = aid === "namoro" && m0 ? namoroPose(id, acao, m0, tm, pisca) : null;
    if (n7){ cx = n7.cx; by = n7.by; pose = n7.pose; dir = n7.dir; frame = 0; deitado = !!n7.lie; sentado = !n7.lie && !n7.empe; if (n7.semVaga) vg = null; } // v32: no chuveiro ficam em pé
    // leva 9: jantar (conversa corada) e cinema (rir, susto, abraço, choro, comemorar, pipoca)
    const p9 = sentado && (id === pid || j.online) ? leva9Pose(id, aid, acao, m0, tm, cx, by, pisca) : null;
    if (p9){ cx += p9.dx || 0; by += p9.dy || 0; if (p9.pose) pose = p9.pose; if (p9.frame != null) frame = p9.frame; }
    // leva 13: pedido de casamento (ajoelhado), noivos no altar, convidados sentados, cuidando dos filhos
    const p13 = leva13Pose(id, aid, acao, tm, pisca, dir, pose);
    if (p13){ cx += p13.dx || 0; by += p13.dy || 0; if (p13.pose) pose = p13.pose; if (p13.dir) dir = p13.dir; if (p13.frame != null) frame = p13.frame; if (p13.sentado) sentado = true; }
    // leva 4: subindo ou descendo a escada (anda pelos degraus e some no alto, ou afunda no vão)
    if (aid === "escada" && acao.esc){
      const p = clamp((tm - acao.ini) / acao.dur, 0, 1), sobe = acao.esc > 0, xm = (ESCADA.x + ESCADA.w / 2) * T;
      cx = Math.round(cx + (xm - cx) * Math.min(1, p * 3));
      by = Math.round(by + (sobe ? -1 : 1) * (p * 3.2 * T + p * (sobe ? 6 : 10)));
      dir = sobe ? "up" : "down"; frame = Math.floor(tm / 115) % 4; pose = "stand";
      esc = { a: p > .55 ? Math.max(0, 1 - (p - .55) / .45) : 1, corte: sobe ? 0 : (ESCADA.y + ESCADA.h) * T };
    }
    const off = !j.online && id !== pid;
    if (off) pose = sentado ? "sitblink" : deitado ? "lie" : "blink";
    const jv = avDe(id, j); // leva 7: barriga de grávida
    // sentado ou deitado: o boneco fica por cima do móvel (quem senta atrás da mesa vem antes do tampo)
    let z = deitado || sobre ? (mv.y + CAT[mv.t].h) * T + (vg && vg.z || 0) : by;
    if (andarAtual === 0 && escadaOn && (esc || naEscada(Math.floor(x + .5), Math.floor(y + .5)))) z = Math.max(z, ESC_Z + 1);
    if (andarAtual === 1 && (esc || naEscada(Math.floor(x + .5), Math.floor(y + .5)))) z = Math.min(z, ESC_Z - .5);
    const pele = PELES[visual(j).pele];
    objs.push({ z, f: () => {
      if (esc){ ctx.save(); if (esc.corte){ ctx.beginPath(); ctx.rect(0, 0, W * T, esc.corte); ctx.clip(); } ctx.globalAlpha = esc.a; }
      if (!deitado && !sobre && !esc){ R(cx - 3, by - 1, 6, 1, "rgba(35,18,40,.22)"); R(cx - 5, by, 10, 1, "rgba(35,18,40,.3)"); R(cx - 4, by + 1, 8, 1, "rgba(35,18,40,.2)"); }
      if (off) ctx.globalAlpha = .55;
      if (vg && vg.cadeira) cadeiraPc(cx, by, false);
      const nu35 = typeof banhoAgora7 === "function" && banhoAgora7(id, aid, movT); // v35: banho e namoro sem roupa
      blitAvatar(nu35 ? Object.assign({}, jv, { banho: 1 }) : jv, cx, by, dir, frame, pose);
      if (aid === "banho" && !deitado && !sentado && (movT === "chuveiro" || movT === "ducha")) vaporBanho(cx, by, tm);
      if (aid === "limpar") drawVassoura(cx, by, dir, tm, !!(m0 && baseT(m0.t) === "pia")); // leva 5
      if (vg && vg.cadeira) cadeiraPc(cx, by, true);
      if (vg){
        const mx = mv.x * T, my = mv.y * T;
        if (vg.banho){ // espuma até o peito
          ctx.globalAlpha = .9; R(cx - 6, my + 6, 12, 3, "#8FD0EE"); ctx.globalAlpha = off ? .55 : 1;
          for (const [a, b] of [[-6, 5], [-4, 6], [-1, 5], [2, 6], [4, 5], [-3, 4], [5, 7]]){ R(cx + a, my + b, 2, 1, "#FFFFFF"); P(cx + a, my + b + 1, "#E6F4FB"); }
        }
        if (vg.frente){ const fr = furnFrame(mv.t, true, tm, mv.x * 3 + mv.y * 5); for (const r of vg.frente) blitFurnParte(mv.t, fr, mx, my, r, mv.cor); }
        if (vg.mesa){ // mãos em cima do tampo (a do garfo sobe até a boca)
          const ty = my + vg.mesa, levanta = /eat|drink/.test(pose) && frame === 1;
          for (const hx of levanta ? [cx - 4] : [cx - 4, cx + 2]){ R(hx - 1, ty - 1, 4, 3, "#2D1C30"); R(hx, ty - 1, 2, 2, pele); P(hx + (hx < cx ? 1 : 0), ty - 1, sh(pele, .2)); R(hx - 1, ty + 2, 4, 1, "rgba(35,18,40,.25)"); }
        }
        if (vg.cordas){ // cordas do balanço por cima, com as mãos segurando
          const fb = furnFrame("balanco", true, tm, 0), d = (fb === 1 ? -1 : fb === 2 ? 1 : 0) * (slot ? -1 : 1);
          for (const rx of vg.cordas){ R(mx + rx + d, by - 8, 1, my + 3 - (by - 8), C.creamD); P(mx + rx + d, by - 6, pele); }
        }
      }
      if (deitado && movT === "rede"){ R(cx - 8, by - 2, 16, 2, C.rose); R(cx - 7, by - 3, 14, 1, "#F9C9D6"); R(cx - 8, by, 16, 1, "#D97A96"); }
      else if (deitado){ const hw = ["solteiro", "camaTeen", "camaInfantil"].includes(baseT(movT)) ? 5 : 7; R(cx - hw, by - 2, hw * 2, 2, C.cream); R(cx - hw + 1, by - 3, hw * 2 - 2, 1, "#FFFFFF"); R(cx - hw, by, hw * 2, 1, C.creamD); } /* v37: coberta do tamanho da cama de solteiro */
      if (sobre && !sentado && !deitado && (movT === "piscina" || movT === "jacuzzi")){ ctx.globalAlpha = .82; R(cx - 7, by - 6, 14, 5, "#8FD6EE"); ctx.globalAlpha = 1; R(cx - 6, by - 6, 12, 1, "#E6F8FD"); }
      sobreAvatar7(id, cx, by, dir, pose, deitado, sentado, movT, tm); // leva 7: bebê no colo, barriga na coberta, desejo
      ctx.globalAlpha = 1;
      if (esc) ctx.restore();
    } });
    if (!esc || esc.a > .3) lights.push([cx, by - 9, 16, "255,236,214", .55]);
    labels.push({ id, j, cx, by: sentado ? by + 2 : by, acao, off, deitado, some: esc && esc.a < .6 });
  }
  objs.sort((a, b) => a.z - b.z).forEach(o => o.f());
  if (typeof raiosSol34 === "function") raiosSol34(tm, hr); // v46: raios de sol pelas janelas

  // fantasma do modo construir
  if (mode === "build" && tool && hover && (tool.kind === "novo" || tool.kind === "mover")){
    const c = CAT[tool.t], ok = canPlace(tool.t, hover.x, hover.y, tool.id);
    ctx.fillStyle = ok ? "rgba(93,202,165,.35)" : "rgba(240,112,122,.45)"; ctx.fillRect(hover.x * T, hover.y * T, c.w * T, c.h * T);
    ctx.globalAlpha = .75; blitFurn(tool.t, hover.x * T, hover.y * T, 0); ctx.globalAlpha = 1;
  }
  leva6Fantasma(); // leva 6: onde dá pra pendurar e cômodo do papel de parede
  leva11Fantasma(); // leva 11: prévia das obras (paredes, portas, janelas) e cômodo em foco
  if (mode === "build" && tool && tool.kind === "piso" && hover && MAP[hover.y] && MAP[hover.y][hover.x] !== 1){
    const cm = comodo(hover.x, hover.y); ctx.fillStyle = "rgba(142,124,240,.28)";
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (MAP[y][x] !== 1 && comodo(x, y) === cm) ctx.fillRect(x * T, y * T, T, T);
  }
  // partículas
  for (const p of particles){
    ctx.globalAlpha = clamp(p.life, 0, 1);
    if (p.kind === "conf") R(Math.round(p.x + Math.sin(tm / 220 + p.ph) * 2), Math.round(p.y), 2, Math.floor(tm / 140 + p.ph) % 2 ? 2 : 1, p.cor);
    else if (p.kind === "heart") pixHeart(p.x - 2, p.y, "#F0707A");
    else if (p.kind === "brilho"){ const x = Math.round(p.x), y = Math.round(p.y); P(x, y, "#FFFFFF"); P(x - 1, y, "#FFF0B8"); P(x + 1, y, "#FFF0B8"); P(x, y - 1, "#FFF0B8"); P(x, y + 1, "#FFF0B8"); }
    else pixNote(p.x - 2, p.y, "#CECBF6");
  }
  ctx.globalAlpha = 1;
  // chuva (leva 3): gotas no jardim, no quintal e nas janelas
  if (clima) drawChuva(tm, clima);
  if (natal && !zeroAqui()) for (let i = 0; i < 8; i++) lights.push([24 + i * 34, -7, 18, ["255,110,120", "255,220,120", "130,220,170", "140,180,255"][i % 4], .95]);
  // luz do dia e da noite: um mapa de luz colorido multiplicado sobre a cena (chuva escurece o céu)
  let dk = darkness(hr); if (clima) dk = Math.min(.5, dk + (clima === "garoa" ? .08 : .15));
  const k = dk * 2;
  if (k > 0){
    if (k > .5) for (const w of janelas()){ const [wx, wy] = w.split(",").map(Number); lights.push([wx * T + 9, wy * T + 26, 24, "150,175,255", .45]); }
    const warm = clima ? [186, 196, 224] : hr < 12 ? [255, 214, 214] : [255, 198, 156], night = [116, 110, 182];
    const A = k < .5 ? [255, 255, 255] : warm, B = k < .5 ? warm : night, t = k < .5 ? k * 2 : (k - .5) * 2;
    const base = "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")";
    // leva 8: o mapa de luz só é refeito quando alguma luz (ou o escuro) muda; as luzes são sprites em cache
    // (antes: dois createRadialGradient por luz, a cada quadro)
    let lsig = base + lc.width + "x" + lc.height;
    for (const L of lights) lsig += "|" + Math.round(L[0]) + "," + Math.round(L[1]) + "," + L[2] + "," + L[3] + "," + Math.round(L[4] * 50);
    if (lsig !== luzSig){
      luzSig = lsig;
      const l = lc.getContext("2d");
      l.setTransform(1, 0, 0, 1, 0, 0);
      l.globalCompositeOperation = "source-over"; l.globalAlpha = 1;
      l.fillStyle = base; l.fillRect(0, 0, lc.width, lc.height);
      l.setTransform(1, 0, 0, 1, 0, TOPO); // v47: luzes na posição da cena
      l.globalCompositeOperation = "lighter";
      for (const [x, y, r, c, pw] of lights){ l.globalAlpha = clamp(pw * k, 0, 1); l.drawImage(luzSpr(c, r, 0), x - r, y - r, r * 2, r * 2); }
      l.globalAlpha = 1; l.globalCompositeOperation = "source-over"; l.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.globalCompositeOperation = "multiply"; ctx.drawImage(lc, 0, -TOPO);
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, r, c, pw] of lights){
      if (r < 20) continue;
      const r2 = r * .7; ctx.globalAlpha = clamp(.2 * k * pw, 0, 1); ctx.drawImage(luzSpr(c, r, 1), x - r2, y - r2, r2 * 2, r2 * 2);
    }
    ctx.globalAlpha = 1;
    // vaga-lumes no jardim
    if (k > .7 && !clima) for (let i = 0; i < 7; i++){
      const fx = 10 + ((i * 41 + tm / 260 * (i % 2 ? 1 : -1)) % (W * T - 20) + (W * T - 20)) % (W * T - 20), fy = H * T - 5 + Math.sin(tm / 600 + i * 1.7) * 2.5;
      ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(tm / 450 + i * 2.3)); P(Math.round(fx), Math.round(fy), "#F6F2A0");
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  // tom quente de dia e vinheta nos cantos
  if (k < 1 && !clima){ ctx.fillStyle = est === "verao" ? "rgba(255,206,110," + (.11 * (1 - k)) + ")" : est === "inverno" ? "rgba(200,220,255," + (.06 * (1 - k)) + ")" : "rgba(255,196,120," + (.06 * (1 - k)) + ")"; ctx.fillRect(0, -TOPO, lo.width, lo.height); }
  ctx.drawImage(vig, 0, -TOPO);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // v47
  // amplia a arte para a tela
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(lo, 0, 0, canvas.width, canvas.height);

  // textos em alta resolução
  const K = canvas.width / (W * T), dpr = Math.min(window.devicePixelRatio || 1, 3);
  mctx.save(); mctx.translate(0, Math.round(TOPO * K)); // v47: nomes e balões acompanham a cena que desceu
  const fs = Math.round(clamp(4.6 * K, 12 * dpr, 17 * dpr));
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.textAlign = "center"; mctx.textBaseline = "bottom";
  // leva 8: nomes de quem está lado a lado não se encavalam ("AnBeto"): quem esbarra num nome já posto sobe uma linha
  const postos = [];
  for (const L of labels.slice().sort((a, b) => b.by - a.by || a.cx - b.cx)){
    L.sx = L.cx * K; L.top = (L.by - (L.deitado ? 12 : 27)) * K;
    if (L.some || mode !== "live") continue;
    L.nm = L.j.nome + (L.j.visita ? " · visita" : "") + (L.off ? " · fora" : ""); // leva 10: crachá de visita
    const w = mctx.measureText(L.nm).width + 6 * dpr, x0 = L.sx - w / 2, x1 = L.sx + w / 2;
    for (let i = 0; i < 4; i++){
      const bate = postos.find(r => x0 < r[1] && x1 > r[0] && L.top > r[2] - fs * .95 && L.top - fs * .95 < r[2]);
      if (!bate) break;
      L.top = bate[2] - fs * 1.02;
    }
    postos.push([x0, x1, L.top, L.id]);
  }
  for (const k in labelTop16) delete labelTop16[k];
  for (const L of labels) labelTop16[L.id] = L.top; // leva 16a: o humor da leva 12 acompanha o nome que subiu
  // leva 16a: balões de fala também não se encavalam (com outro balão nem com o nome de outra pessoa): quem esbarra sobe
  const falaOn = L => L.j.fala && L.j.falaAt && tm - L.j.falaAt < 7000 && tm - L.j.falaAt > -60000;
  const obst = postos.map(r => [r[0], r[1], r[2] - fs * .95, r[2], r[3]]);
  mctx.font = "700 " + fs + "px Nunito, sans-serif";
  for (const L of labels.slice().sort((a, b) => b.by - a.by || a.cx - b.cx)){
    L.bal = null; if (L.some || !falaOn(L)) continue;
    const txt = String(L.j.fala), tw = Math.min(mctx.measureText(txt).width, 80 * K), bh = fs * 1.5;
    let bx = clamp(L.sx - tw / 2 - 6, 2, canvas.width - tw - 14);
    const w = tw + 12, bate = (x, y) => obst.find(r => r[4] !== L.id && x < r[1] && x + w > r[0] && y < r[3] + 2 && y + bh > r[2] - 2);
    // lugares possíveis, do mais perto pro mais longe: em cima da cabeça (subindo de linha em linha), depois embaixo dos pés;
    // em cada altura tenta no meio, um pouco pra direita e pra esquerda
    const base = L.top - fs - bh - 4, pe = (L.by + 3) * K, ys = [], xs = [0, .6, -.6, 1.2, -1.2].map(f => clamp(bx + f * w, 2, canvas.width - w - 2));
    for (let k = 0; k < 4; k++) ys.push(base - k * (bh + 4)); for (let k = 0; k < 3; k++) ys.push(pe + k * (bh + 4));
    let byy = Math.max(2, base), achou = false;
    for (const y of ys){ if (y < 2 || y + bh > canvas.height - 2) continue; for (const x of xs) if (!bate(x, y)){ bx = x; byy = y; achou = true; break; } if (achou) break; }
    obst.push([bx, bx + tw + 12, byy, byy + bh, L.id]);
    L.bal = { txt, tw, bh, bx, byy };
  }
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
  for (const L of labels){
    if (L.some) continue;
    const sx = L.sx, top = L.top;
    if (mode === "live"){
      const nm = L.nm;
      mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, sx, top);
      mctx.fillStyle = L.id === pid ? "#FFFFFF" : "#E6DEFF"; mctx.fillText(nm, sx, top);
    }
    let icon = null;
    if (L.off) icon = "zZ";
    else if (L.acao){ const id = L.acao.id || ""; icon = /dormir|cochilo/.test(id) ? "zZ" : /dancar/.test(id) ? "♪" : /^s-(beijo|abracar|chute)|^namoro|^bebe-|^jantar/.test(id) ? "♥" :/^s-/.test(id) ? "…" : /trabalhar/.test(id) ? "$" : id === "minigame" ? "★" : /pet-carinho/.test(id) ? "♥" : /^coz-|lanche|cafe|comer/.test(id) ? "~" : null; }
    if (icon){ mctx.fillStyle = icon === "♥" ? "#F0707A" : icon === "$" ? "#FAC775" : "#CECBF6"; mctx.fillText(icon, sx + 8 * K, top - fs * .9 - Math.sin(tm / 300) * K * 1.5); }
    if (L.id === pid && L.acao && L.acao.id !== "minigame"){
      const w = 16 * K, pr = clamp((tm - L.acao.ini) / L.acao.dur, 0, 1), bh = Math.max(4, K * 1.2);
      mctx.fillStyle = "rgba(18,14,28,.85)"; mctx.fillRect(sx - w / 2 - 1, top + 2, w + 2, bh + 2);
      mctx.fillStyle = "#8E7CF0"; mctx.fillRect(sx - w / 2, top + 3, w * pr, bh);
    }
    if (L.bal){
      const { txt, tw, bh, bx, byy } = L.bal; mctx.font = "700 " + fs + "px Nunito, sans-serif";
      mctx.fillStyle = "#FFFFFF"; mctx.beginPath(); if (mctx.roundRect) mctx.roundRect(bx, byy, tw + 12, bh, 6); else mctx.rect(bx, byy, tw + 12, bh); mctx.fill();
      const tx0 = clamp(sx, bx + 6, bx + tw + 6); // balão que escorregou pro lado: o rabinho fica na ponta mais perto
      if (byy > top) mctx.fillRect(tx0 - 3, byy - 4, 6, 5); // balão embaixo dos pés: rabinho pra cima
      else mctx.fillRect(tx0 - 3, byy + bh - 1, 6, 5);
      const pe = top - fs - 4; if (byy < top && pe > byy + bh + 4) mctx.fillRect(tx0 - 1, byy + bh, 2, pe - byy - bh); // balão que subiu: rabinho comprido até o nome
      mctx.fillStyle = "#1B1528"; mctx.textAlign = "left"; mctx.fillText(txt, bx + 6, byy + bh - fs * .25, 80 * K); mctx.textAlign = "center";
      mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
    }
  }
  drawCasaLabels(mctx, K, fs, tm);
  drawVisitaLabels(mctx, K, fs, tm); // leva 5
  drawLabels7(mctx, K, fs, tm); // leva 7: "buá!" do bebê
  drawLabels9(mctx, K, fs, tm); // leva 9: balões do jantar, reações do cinema, "!" no presente
  drawLabels10(mctx, K, fs, tm); // leva 10: nome da pelúcia, "foram à praia", telefone com recado
  drawLabels11(mctx, K, fs); // leva 11: nome dos cômodos no modo construir (casa do zero)
  for (const L of labels){ if (L.acao && /^s-(beijo|abracar)/.test(L.acao.id || "") && Math.random() < .04) burst(L.cx / T - .5, L.by / T - 1, "heart"); }
  mctx.restore(); // v47
}

// leva 8: aviso de versão nova. Quem está com a página aberta (ou com o HTML velho no cache do Pages) vê um botão
// pra recarregar. Compara o <meta name="casinha-versao"> desta página com o version.txt publicado.
const VERSAO = ((document.querySelector('meta[name="casinha-versao"]') || {}).content || "").trim();
let versaoAvisada = false, versaoUlt = 0;
function checarVersao(){
  if (versaoAvisada || !VERSAO || document.hidden || Date.now() - versaoUlt < 60000) return;
  versaoUlt = Date.now();
  fetch("version.txt?" + Date.now(), { cache: "no-store" }).then(r => r.ok ? r.text() : "").then(t => {
    t = String(t || "").trim();
    if (!t || t === VERSAO || versaoAvisada || t.length > 20) return;
    avisarVersaoNova(t);
  }).catch(() => {});
}
// leva 16a: o aviso também aparece quando o service worker novo já baixou tudo e está esperando (ver 24-acabamento.js).
// O toque chama atualizarAgora(): troca o service worker (skipWaiting) e recarrega na versão nova.
function avisarVersaoNova(t){
  if (versaoAvisada) return; versaoAvisada = true;
  const b = el("button", "versaoNova", "Versão nova! Toque pra atualizar"); b.type = "button";
  b.onclick = () => { b.disabled = true; b.textContent = "Atualizando…"; atualizarAgora(t || ""); };
  document.body.append(b);
}
setTimeout(checarVersao, 15000); setInterval(checarVersao, 5 * 60000);
document.addEventListener("visibilitychange", checarVersao);

window.addEventListener("hashchange", boot);
document.fonts && document.fonts.load("700 12px 'Pixelify Sans'").catch(() => {});
boot();
requestAnimationFrame(tick);
