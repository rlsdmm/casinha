"use strict";
// Casinha · laço principal: update e draw; boot()
// ===================== laço =====================
let last = performance.now(), hudT = 0, clockSkew = 0;
function tick(now){
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (me && !$("screenGame").hidden){ update(dt); draw(now); hudT += dt; if (hudT > .25){ hudT = 0; renderHudLight(); } }
  requestAnimationFrame(tick);
}
function renderHudLight(){
  if (!me) return;
  const pb = $("progBar"); if (pb && me.acao) pb.style.width = clamp((Date.now() - me.acao.ini) / me.acao.dur * 100, 0, 100) + "%";
  for (const w of $("needs").children){ const id = w.dataset.id, v = Math.round(me.needs[id]); w.querySelector(".v").textContent = v; const i = w.querySelector("i"); i.style.width = v + "%"; i.style.background = v < 25 ? "var(--bad)" : NEEDS.find(q => q.id === id).cor; }
  $("meMood").textContent = mood(); $("money").textContent = "$ " + Math.floor(me.dinheiro);
  if (mode === "build") $("money2").textContent = "$ " + Math.floor(me.dinheiro);
  renderHouseCard(); renderLeva2Hud(); renderClima(); renderAndarUI(); renderLeva5Hud();
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
      if (d.dinheiro){ me.dinheiro += d.dinheiro; toast("+$" + d.dinheiro + " pelo trabalho."); sfx("moeda"); }
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
  if (performance.now() - lastSave > 4000){ lastSave = performance.now(); saveNeeds(false); }
}

const lo = document.createElement("canvas"); lo.width = W * T; lo.height = H * T;
const lc = document.createElement("canvas"); lc.width = W * T; lc.height = H * T;
// troca o tamanho da cena (com ou sem quintal): canvases internos, vinheta e largura máxima da tela
function tamanhoCena(){
  for (const c of [bg, lo, lc, vig]){ c.width = W * T; c.height = H * T; }
  desenharVinheta(); bgKey = null;
  $("stage").style.maxWidth = H > H_CASA ? "min(100%, 78vh)" : "";
  if (!$("screenGame").hidden) resize();
}
let blinkUntil = {};
function draw(now){
  const mctx = canvas.getContext("2d");
  ctx = lo.getContext("2d"); S = 1; ctx.imageSmoothingEnabled = false;
  const tm = Date.now(), hr = hourNow();
  // fundo guardado em cache: jardim, pisos, paredes, portas e janelas
  ensureBg(hr);
  ctx.drawImage(bg, 0, 0);
  drawWindowAnim(tm, hr);
  const clima = climaAgora(), est = estacao(), natal = mesAgora() === 12;
  if (natal) drawPiscaPisca(tm);
  if (andarAtual === 0){ drawMural(tm); drawQuadroTrofeus(tm); }
  drawDecorParede(tm, hr); // leva 6: quadros, luzinhas, relógio e companhia
  if (andarAtual === 0 && escadaOn){ const ex = ESCADA.x * T, ey = (ESCADA.y + ESCADA.h) * T; R(ex + 1, ey - 1, ESCADA.w * T, 2, "rgba(35,18,40,.24)"); R(ex + ESCADA.w * T, ESCADA.y * T + 4, 1, ESCADA.h * T - 4, "rgba(35,18,40,.18)"); }
  // tapetes
  for (const m of Object.values(moveis)) if (CAT[m.t] && CAT[m.t].chao){ R(m.x * T + 4, m.y * T + CAT[m.t].h * T - 2, CAT[m.t].w * T - 8, 1, "rgba(35,18,40,.18)"); blitFurn(m.t, m.x * T, m.y * T, 0); }
  drawSujeiraChao(); // leva 5: pó, migalhas, roupa, folhas, lama, pelos
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
    objs.push({ z, f: () => blitFurn(m.t, m.x * T, m.y * T, fr) });
    if (ativo[id]) objs.push({ z: z + 3, f: () => drawFx(m.t, m.x * T, m.y * T, tm) });
  }
  addCasaObjs(objs, tm); // leva 1: plantas, pratos na mesa e bichinho
  addJogoObjs(objs, tm); // leva 2: tabuleiro na tela da TV/PC
  addLeva5Objs(objs, tm); // leva 5: visitas e louça na pia
  addLeva7Objs(objs, tm); // leva 7: coberta/espuma/manta do namoro, roupas, berço com o bebê, teste de farmácia
  if (escadaOn || andarAtual === 1) objs.push({ z: ESC_Z, f: blitEscada }); // leva 4: escada / guarda-corpo do vão
  const labels = [], lights = [];
  if (andarAtual === 1){ for (const [k, d] of Object.entries(DECOR2)) if (d === "arandela"){ const [x, y] = k.split(",").map(Number); lights.push([x * T + 8, y * T + 9, 30, "255,214,150", .95]); } }
  else if (escadaOn) lights.push([(ESCADA.x + 1) * T, ESCADA.y * T + 2, 22, "255,214,160", .45]); // luz que desce lá de cima
  for (const [id, m] of Object.entries(moveis)){
    if (m.t === "abajur") lights.push([m.x * T + 8, m.y * T - 2, 58, "255,206,130", 1]);
    if (ativo[id] && m.t === "tv") lights.push([m.x * T + 16, m.y * T + 2, 38, "140,190,255", .8 + .2 * Math.sin(tm / 110) * Math.sin(tm / 370)]);
    if (ativo[id] && m.t === "pc") lights.push([m.x * T + 16, m.y * T, 24, "140,190,255", .85]);
    if (ativo[id] && m.t === "churrasqueira") lights.push([m.x * T + 12, m.y * T, 26, "255,150,80", .85 + .15 * Math.sin(tm / 80)]);
    if (ativo[id] && m.t === "fogao") lights.push([m.x * T + 8, m.y * T + 2, 20, "255,170,90", .8 + .2 * Math.sin(tm / 90)]);
    if (m.t === "geladeira") lights.push([m.x * T + 8, m.y * T + 4, 12, "220,235,255", .25]);
  }
  leva6Luzes(lights, ativo, tm); // leva 6: luzinhas, neon, lareira, luminárias novas
  leva7Luzes(lights, tm); // leva 7: abajur baixinho no namoro
  for (const [id, j] of Object.entries(jogadores)){
    if (!j.nome) continue;
    if (id !== pid && (j.andar || 0) !== andarAtual) continue; // leva 4: cada um vê só o próprio andar
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
      if (acao.deitar){ deitado = true; pose = "lie"; const s2 = Object.keys(jogadores).indexOf(id) % 2; cx = m0.x * T + (m0.t === "casal" || m0.t === "dossel" ? (s2 ? 35 : 13) : m0.t === "rede" ? 24 : 16); by = m0.y * T + (m0.t === "rede" ? 8 : 21); }
      else {
        vg = se0 ? se0.vagas[slot] : null;
        const usa = vg && (se0.fixas || aqui.length > 1);
        cx = Math.round((m0.x + c.w / 2) * T) + (usa ? vg.dx : 0);
        by = vg ? m0.y * T + (acao.cima && se0.cima ? se0.cima : vg.by) : (m0.y + c.h) * T - 3;
        if (vg && !se0.empe){
          sentado = true; dir = acao.cima ? "up" : vg.dir || "down";
          if (m0.t === "balanco"){ const fb = furnFrame("balanco", true, tm, 0), d = fb === 1 ? -1 : fb === 2 ? 1 : 0; cx += slot ? -d : d; } // vai e volta com o assento
        } else vg = null; // em pé em cima (chuveiro, piscina)
      }
    }
    if (sentado){
      // atividade sentada: comer/piquenique leva o garfo à boca, café a xícara, computador e jogo nas mãos; comemora de vez em quando
      let act = aid === "comer" || aid === "piquenique" ? "eat" : aid === "cafe" ? "drink" : aid === "minigame" || movT === "pc" ? "pc" : "";
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
    if (n7){ cx = n7.cx; by = n7.by; pose = n7.pose; dir = n7.dir; frame = 0; deitado = !!n7.lie; sentado = !n7.lie; if (n7.semVaga) vg = null; }
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
      blitAvatar(jv, cx, by, dir, frame, pose);
      if (aid === "limpar") drawVassoura(cx, by, dir, tm, !!(m0 && m0.t === "pia")); // leva 5
      if (vg && vg.cadeira) cadeiraPc(cx, by, true);
      if (vg){
        const mx = mv.x * T, my = mv.y * T;
        if (vg.banho){ // espuma até o peito
          ctx.globalAlpha = .9; R(cx - 6, my + 6, 12, 3, "#8FD0EE"); ctx.globalAlpha = off ? .55 : 1;
          for (const [a, b] of [[-6, 5], [-4, 6], [-1, 5], [2, 6], [4, 5], [-3, 4], [5, 7]]){ R(cx + a, my + b, 2, 1, "#FFFFFF"); P(cx + a, my + b + 1, "#E6F4FB"); }
        }
        if (vg.frente){ const fr = furnFrame(mv.t, true, tm, mv.x * 3 + mv.y * 5); for (const r of vg.frente) blitFurnParte(mv.t, fr, mx, my, r); }
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
      else if (deitado){ R(cx - 7, by - 2, 14, 2, C.cream); R(cx - 6, by - 3, 12, 1, "#FFFFFF"); R(cx - 7, by, 14, 1, C.creamD); }
      if (sobre && !sentado && !deitado && (movT === "piscina" || movT === "jacuzzi")){ ctx.globalAlpha = .82; R(cx - 7, by - 6, 14, 5, "#8FD6EE"); ctx.globalAlpha = 1; R(cx - 6, by - 6, 12, 1, "#E6F8FD"); }
      sobreAvatar7(id, cx, by, dir, pose, deitado, sentado, movT, tm); // leva 7: bebê no colo, barriga na coberta, desejo
      ctx.globalAlpha = 1;
      if (esc) ctx.restore();
    } });
    if (!esc || esc.a > .3) lights.push([cx, by - 9, 16, "255,236,214", .55]);
    labels.push({ id, j, cx, by: sentado ? by + 2 : by, acao, off, deitado, some: esc && esc.a < .6 });
  }
  objs.sort((a, b) => a.z - b.z).forEach(o => o.f());

  // fantasma do modo construir
  if (mode === "build" && tool && hover && (tool.kind === "novo" || tool.kind === "mover")){
    const c = CAT[tool.t], ok = canPlace(tool.t, hover.x, hover.y, tool.id);
    ctx.fillStyle = ok ? "rgba(93,202,165,.35)" : "rgba(240,112,122,.45)"; ctx.fillRect(hover.x * T, hover.y * T, c.w * T, c.h * T);
    ctx.globalAlpha = .75; blitFurn(tool.t, hover.x * T, hover.y * T, 0); ctx.globalAlpha = 1;
  }
  leva6Fantasma(); // leva 6: onde dá pra pendurar e cômodo do papel de parede
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
  if (natal) for (let i = 0; i < 8; i++) lights.push([24 + i * 34, 6, 18, ["255,110,120", "255,220,120", "130,220,170", "140,180,255"][i % 4], .95]);
  // luz do dia e da noite: um mapa de luz colorido multiplicado sobre a cena (chuva escurece o céu)
  let dk = darkness(hr); if (clima) dk = Math.min(.5, dk + (clima === "garoa" ? .08 : .15));
  const k = dk * 2;
  if (k > 0){
    if (k > .5) for (const w of janelas()){ const [wx, wy] = w.split(",").map(Number); lights.push([wx * T + 9, wy * T + 26, 24, "150,175,255", .45]); }
    const warm = clima ? [186, 196, 224] : hr < 12 ? [255, 214, 214] : [255, 198, 156], night = [116, 110, 182];
    const A = k < .5 ? [255, 255, 255] : warm, B = k < .5 ? warm : night, t = k < .5 ? k * 2 : (k - .5) * 2;
    const l = lc.getContext("2d");
    l.globalCompositeOperation = "source-over";
    l.fillStyle = "rgb(" + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",") + ")"; l.fillRect(0, 0, lc.width, lc.height);
    l.globalCompositeOperation = "lighter";
    for (const [x, y, r, c, pw] of lights){
      const a = pw * k, g = l.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(" + c + "," + a + ")"); g.addColorStop(.45, "rgba(" + c + "," + a * .6 + ")"); g.addColorStop(1, "rgba(" + c + ",0)");
      l.fillStyle = g; l.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "multiply"; ctx.drawImage(lc, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, r, c, pw] of lights){
      if (r < 20) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * .7); g.addColorStop(0, "rgba(" + c + "," + (.2 * k * pw) + ")"); g.addColorStop(1, "rgba(" + c + ",0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // vaga-lumes no jardim
    if (k > .7 && !clima) for (let i = 0; i < 7; i++){
      const fx = 10 + ((i * 41 + tm / 260 * (i % 2 ? 1 : -1)) % (W * T - 20) + (W * T - 20)) % (W * T - 20), fy = H * T - 5 + Math.sin(tm / 600 + i * 1.7) * 2.5;
      ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(tm / 450 + i * 2.3)); P(Math.round(fx), Math.round(fy), "#F6F2A0");
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  // tom quente de dia e vinheta nos cantos
  if (k < 1 && !clima){ ctx.fillStyle = est === "verao" ? "rgba(255,206,110," + (.11 * (1 - k)) + ")" : est === "inverno" ? "rgba(200,220,255," + (.06 * (1 - k)) + ")" : "rgba(255,196,120," + (.06 * (1 - k)) + ")"; ctx.fillRect(0, 0, lo.width, lo.height); }
  ctx.drawImage(vig, 0, 0);
  // amplia a arte para a tela
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(lo, 0, 0, canvas.width, canvas.height);

  // textos em alta resolução
  const K = canvas.width / (W * T), dpr = Math.min(window.devicePixelRatio || 1, 3);
  const fs = Math.round(clamp(4.6 * K, 12 * dpr, 17 * dpr));
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace"; mctx.textAlign = "center"; mctx.textBaseline = "bottom";
  for (const L of labels){
    if (L.some) continue;
    const sx = L.cx * K, top = (L.by - (L.deitado ? 12 : 27)) * K;
    if (mode === "live"){
      const nm = L.j.nome + (L.off ? " · fora" : "");
      mctx.lineJoin = "round"; mctx.lineWidth = Math.max(3, K * 1.1); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(nm, sx, top);
      mctx.fillStyle = L.id === pid ? "#FFFFFF" : "#E6DEFF"; mctx.fillText(nm, sx, top);
    }
    let icon = null;
    if (L.off) icon = "zZ";
    else if (L.acao){ const id = L.acao.id || ""; icon = /dormir|cochilo/.test(id) ? "zZ" : /dancar/.test(id) ? "♪" : /^s-(beijo|abracar|chute)|^namoro|^bebe-/.test(id) ? "♥" :/^s-/.test(id) ? "…" : /trabalhar/.test(id) ? "$" : id === "minigame" ? "★" : /pet-carinho/.test(id) ? "♥" : /^coz-|lanche|cafe|comer/.test(id) ? "~" : null; }
    if (icon){ mctx.fillStyle = icon === "♥" ? "#F0707A" : icon === "$" ? "#FAC775" : "#CECBF6"; mctx.fillText(icon, sx + 8 * K, top - fs * .9 - Math.sin(tm / 300) * K * 1.5); }
    if (L.id === pid && L.acao && L.acao.id !== "minigame"){
      const w = 16 * K, pr = clamp((tm - L.acao.ini) / L.acao.dur, 0, 1), bh = Math.max(4, K * 1.2);
      mctx.fillStyle = "rgba(18,14,28,.85)"; mctx.fillRect(sx - w / 2 - 1, top + 2, w + 2, bh + 2);
      mctx.fillStyle = "#8E7CF0"; mctx.fillRect(sx - w / 2, top + 3, w * pr, bh);
    }
    if (L.j.fala && L.j.falaAt && tm - L.j.falaAt < 7000 && tm - L.j.falaAt > -60000){
      const txt = String(L.j.fala); mctx.font = "700 " + fs + "px Nunito, sans-serif";
      const tw = Math.min(mctx.measureText(txt).width, 80 * K), bh = fs * 1.5, bx = clamp(sx - tw / 2 - 6, 2, canvas.width - tw - 14), byy = top - fs - bh - 4;
      mctx.fillStyle = "#FFFFFF"; mctx.beginPath(); if (mctx.roundRect) mctx.roundRect(bx, byy, tw + 12, bh, 6); else mctx.rect(bx, byy, tw + 12, bh); mctx.fill();
      mctx.fillRect(sx - 3, byy + bh - 1, 6, 5);
      mctx.fillStyle = "#1B1528"; mctx.textAlign = "left"; mctx.fillText(txt, bx + 6, byy + bh - fs * .25, 80 * K); mctx.textAlign = "center";
      mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
    }
  }
  drawCasaLabels(mctx, K, fs, tm);
  drawVisitaLabels(mctx, K, fs, tm); // leva 5
  drawLabels7(mctx, K, fs, tm); // leva 7: "buá!" do bebê
  for (const L of labels){ if (L.acao && /^s-(beijo|abracar)/.test(L.acao.id || "") && Math.random() < .04) burst(L.cx / T - .5, L.by / T - 1, "heart"); }
}

window.addEventListener("hashchange", boot);
document.fonts && document.fonts.load("700 12px 'Pixelify Sans'").catch(() => {});
boot();
requestAnimationFrame(tick);
