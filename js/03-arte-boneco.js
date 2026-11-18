"use strict";
// Casinha · bonequinhos (em pé, sentado, deitado), cabelos e acessórios
// ---- bonequinhos ----
// visual normalizado: jogadores antigos (sem corpo/traje/acess) continuam como eram (neutro, camiseta)
const idxDe = (v, arr) => Number.isInteger(v) && v >= 0 && v < arr.length ? v : 0;
function visual(p){
  p = p || {};
  const corpo = p.corpo === "ele" || p.corpo === "ela" ? p.corpo : "neutro";
  return { corpo, roupa: idxDe(p.roupa, ROUPAS), traje: idxDe(p.traje, TRAJES), cabelo: idxDe(p.cabelo, CABELOS), estilo: idxDe(p.estilo, ESTILOS), pele: idxDe(p.pele, PELES), barba: corpo === "ele" && p.barba ? 1 : 0, acess: idxDe(p.acess, ACESS), barriga: p.barriga >= 1 && p.barriga <= 3 ? p.barriga | 0 : 0 };
}
function avatarSprite(p, dir, frame, pose){
  const v = visual(p);
  const key = ["av", v.corpo, v.roupa, v.traje, v.cabelo, v.estilo, v.pele, v.barba, v.acess, v.barriga, dir, frame, pose].join(":");
  return sprite(key, 16, 27, (ox, oy) => drawAvatarLocal(v, ox + 8, oy + 25, dir, frame, pose));
}
function blitAvatar(p, cx, by, dir, frame, pose){ const s = avatarSprite(p, dir, frame, pose); ctx.drawImage(s.c, Math.round(cx - 9), Math.round(by - 26)); }

// poses: "stand", "breath" (respirando), "blink", "blinkbreath", "arms", "lie"
// trajes: 0 camiseta, 1 vestido, 2 saia e blusa, 3 macacão, 4 moletom com capuz, 5 regata com short
function drawAvatarLocal(v, cx, by, dir, frame, pose){
  const skin = PELES[v.pele], hair = CABELOS[v.cabelo], cor = ROUPAS[v.roupa], st = v.estilo, tj = v.traje;
  const ela = v.corpo === "ela", o = v.corpo === "ele" ? 1 : 0; // ele: ombros 1px mais largos de cada lado
  pose = String(pose || "stand");
  // leva 7: "blush" (corado), "happy" (olhinhos de satisfeito), "messy" (cabelo bagunçado), "open" (deitado de olho aberto)
  const fx7 = { blush: pose.indexOf("blush") >= 0, happy: pose.indexOf("happy") >= 0 };
  if (pose.indexOf("lie") === 0){ const hy = by - 10; headDraw(cx, hy, "down", skin, pose.indexOf("open") < 0 || pose.indexOf("blink") > 0, v, hair, fx7); hairDraw(cx, hy, "down", st, hair); if (pose.indexOf("messy") > 0) cabeloBaguncado(cx, hy, st, hair); acessDraw(cx, hy, "down", v); return; }
  const blink = pose.indexOf("blink") >= 0, breath = pose.indexOf("breath") >= 0, armsUp = pose === "arms";
  const side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  const walk = frame === 1 || frame === 3, bob = breath ? 1 : walk ? -1 : 0;
  const JEANS = "#56609E", CREME = "#FFF4E0", shoe = "#F1EDF7";
  // leva 6: 6 pijama de bichinho, 7 vestido de festa, 8 terno (terno = cor escurecida)
  const terno = tj === 8 ? mix(cor, "#1E1A2A", .55) : null;
  const top = tj === 2 || tj === 3 ? CREME : terno || cor;
  const shL = sh(top, .3), shD = sh(top, -.22), skD = sh(skin, -.16), corD = sh(cor, -.24), corL = sh(cor, .28);
  const quadril = tj === 1 || tj === 2 || tj === 3 || tj === 6 || tj === 7 ? cor : terno || JEANS;
  const perna = tj === 3 || tj === 6 ? cor : terno || (tj === 0 || tj === 4 ? JEANS : skin), pernaD = perna === skin ? skD : sh(perna, -.2);
  const manga = tj === 5 || tj === 7 ? skin : top, mangaD = tj === 5 || tj === 7 ? skD : shD, mangaN = tj === 4 || tj === 6 || tj === 8 ? 3 : 2;
  if (pose.indexOf("sit") === 0){ drawSentado(v, cx, by, dir, frame, pose, { skin, hair, cor, top, shL, shD, skD, corD, corL, quadril, perna, pernaD, manga, mangaD, mangaN, shoe, ela, o, tj, st, fx7 }); return; }
  // pernas
  R(cx - 3, by - 5, 6, 2, quadril);
  if (side){
    if (!walk){ R(X(-2, 4), by - 3, 4, 2, perna); R(X(1, 1), by - 3, 1, 2, pernaD); R(X(-3, 5), by - 1, 5, 1, shoe); }
    else {
      const a = frame === 1 ? perna : pernaD, b = frame === 1 ? pernaD : perna;
      R(X(1, 2), by - 3, 2, 1, b); R(X(2, 2), by - 2, 2, 1, shoe);
      R(X(-4, 3), by - 3, 3, 2, a); R(X(-5, 3), by - 1, 3, 1, shoe);
    }
  } else {
    const lL = frame === 1 ? 1 : 0, rL = frame === 3 ? 1 : 0;
    R(cx - 3, by - 3, 2, 2 - lL, perna); R(cx - 3, by - 1 - lL, 2, 1, shoe);
    R(cx + 1, by - 3, 2, 2 - rL, perna); R(cx + 1, by - 1 - rL, 2, 1, shoe);
    P(cx - 1, by - 4, sh(quadril, -.2)); P(cx, by - 4, sh(quadril, -.2));
  }
  // corpo
  const ty = by - 9 + bob;
  if (ela){ R(cx - 2, ty, 4, 1, top); R(cx - 3, ty + 1, 6, 4, top); }
  else { R(cx - 3 - o, ty, 6 + 2 * o, 2, top); R(cx - 3, ty + 2, 6, 3, top); if (o) R(cx + 3, ty, 1, 2, shD); }
  R(cx + 2, ty + 1, 1, 4, shD); R(cx - 3, ty + 4, 6, 1, shD);
  if (ela && tj !== 1 && tj !== 2) R(cx - 4, ty + 4, 8, 1, shD); // barra rodadinha
  if (dir === "down"){ R(cx - 1, ty, 2, 1, skD); P(cx - 2, ty, shL); P(cx + 1, ty, shL); P(cx - 2, ty + 2, shL); }
  else if (dir === "up"){ R(cx - 2, ty, 4, 1, shL); }
  else { P(X(-3, 1), ty, shL); }
  if (tj === 1 || tj === 2){ // saia (vestido: mais comprida)
    const h = tj === 1 ? 4 : 3;
    R(cx - 4, ty + 4, 8, h, cor); R(cx - 4, ty + 3 + h, 8, 1, corD); R(cx + 2, ty + 5, 2, h - 2, corD); P(cx - 3, ty + 5, corL);
    if (tj === 2){ R(cx - 3, ty + 4, 6, 1, sh(cor, -.12)); if (dir === "down") P(cx - 1, ty + 1, "#E9D8BE"); }
    else if (dir !== "up") R(cx - 3, ty + 3, 6, 1, corD); // cinto do vestido
  } else if (tj === 3){ // macacão: peitilho e alças
    R(cx - 3, ty + 3, 6, 2, cor); R(cx - 3, ty + 4, 6, 1, corD);
    if (dir === "down"){ R(cx - 2, ty + 2, 4, 1, cor); R(cx - 2, ty, 1, 2, cor); R(cx + 1, ty, 1, 2, cor); P(cx - 2, ty + 2, C.gold); P(cx + 1, ty + 2, C.gold); }
    else if (dir === "up"){ R(cx - 2, ty, 1, 3, cor); R(cx + 1, ty, 1, 3, cor); P(cx - 1, ty + 2, cor); P(cx, ty + 2, cor); }
    else R(X(0, 1), ty, 1, 3, cor);
  } else if (tj === 4){ // moletom com capuz
    R(cx - 3, ty + 5, 6, 1, shD);
    if (dir === "down"){ P(cx - 2, ty, shD); P(cx + 1, ty, shD); P(cx - 1, ty + 1, shoe); P(cx, ty + 2, shoe); R(cx - 2, ty + 3, 4, 1, shD); }
    else if (dir === "up"){ R(cx - 3, ty, 6, 2, shD); R(cx - 2, ty + 2, 4, 1, shD); R(cx - 2, ty, 4, 1, top); }
    else R(X(1, 3), ty, 3, 2, shD);
  } else if (tj === 5){ // regata
    if (!ela){ P(cx - 3 - o, ty, skin); P(cx + 2 + o, ty, skin); }
    if (dir === "down") R(cx - 1, ty, 2, 1, skin);
  } else if (tj >= 6) trajeLeva6(tj, cx, ty, by, dir, { cor, corD, corL, skin, top, shD, ela, o, X, side });
  if (v.barriga) barrigaEmPe(v.barriga, cx, ty, dir, X, tj === 3 ? cor : top); // leva 7: gravidez
  // braços
  if (!armsUp){
    if (side){ const sw = frame === 1 ? 1 : frame === 3 ? -1 : 0; R(X(-1 - sw, 2), ty + 1, 2, mangaN, mangaD); R(X(-1 - sw, 2), ty + 1 + mangaN, 2, 4 - mangaN, skin); }
    else {
      const aL = frame === 1 ? -1 : frame === 3 ? 1 : 0, ax = 4 + o;
      R(cx - ax, ty + 1 + aL, 1, mangaN, manga); R(cx - ax, ty + 1 + mangaN + aL, 1, 4 - mangaN, skin);
      R(cx + ax - 1, ty + 1 - aL, 1, mangaN, mangaD); R(cx + ax - 1, ty + 1 + mangaN - aL, 1, 4 - mangaN, skin);
    }
  }
  // cabeça, cabelo e acessório
  const hy = by - 18 + bob;
  headDraw(cx, hy, dir, skin, blink, v, hair, fx7);
  hairDraw(cx, hy, dir, st, hair);
  if (pose.indexOf("messy") >= 0) cabeloBaguncado(cx, hy, st, hair);
  acessDraw(cx, hy, dir, v);
  if (armsUp){
    const a = 5 + o;
    R(cx - a, ty, 2, 1, manga); R(cx - a - 1, ty - 2, 1, 3, manga); R(cx - a - 1, ty - 5, 1, 3, skin);
    R(cx + a - 2, ty, 2, 1, mangaD); R(cx + a, ty - 2, 1, 3, mangaD); R(cx + a, ty - 5, 1, 3, skin);
    if (tj === 4){ R(cx - a - 1, ty - 4, 1, 2, manga); R(cx + a, ty - 4, 1, 2, mangaD); }
  }
}
// ---- sentado (leva 4) ----
// pose: "sit" + atividade ("eat" garfo, "drink" xícara, "pc" mãos no teclado/controle, "arms" comemorando) + "blink"/"breath".
// frame: quadro da atividade (0 = mão embaixo; 1 = mão na boca, ou a outra mão no teclado).
// De frente/de lado, by = chão onde ficam os pés (coxa pra frente, canela, pé). De costas, by = assento (pernas somem na frente).
function drawSentado(v, cx, by, dir, frame, pose, k){
  const { skin, hair, cor, top, shL, shD, skD, corD, quadril, perna, manga, mangaD, mangaN, shoe, ela, o, tj, st, fx7 } = k;
  const blink = pose.indexOf("blink") >= 0, breath = pose.indexOf("breath") >= 0;
  // atividade logo depois de "sit" ("sitbreath" não pode virar "eat")
  const resto = pose.slice(3), act = /^eat/.test(resto) ? "eat" : /^drink/.test(resto) ? "drink" : /^pc/.test(resto) ? "pc" : /^arms/.test(resto) ? "arms" : "";
  const barr = v.barriga, bcol = tj === 3 ? cor : top; // leva 7: gravidez
  const b = breath ? 1 : 0, f = frame ? 1 : 0, ax = 4 + o;
  const lap = quadril, lapL = sh(lap, .2), lapD = sh(lap, -.26);
  const m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  const cMao = (lado, c) => lado < 0 ? c : (c === manga ? mangaD : c); // braço do lado direito da tela fica na sombra
  const metal = "#C6D0DA", xic = "#7FB8E8";
  // tronco de frente ou de costas (5 linhas; o colo cobre o fim)
  const torso = (ty, d) => {
    if (ela){ R(cx - 2, ty, 4, 1, top); R(cx - 3, ty + 1, 6, 4, top); }
    else { R(cx - 3 - o, ty, 6 + 2 * o, 2, top); R(cx - 3, ty + 2, 6, 3, top); if (o) R(cx + 3, ty, 1, 2, shD); }
    R(cx + 2, ty + 1, 1, 4, shD);
    if (d === "down"){ R(cx - 1, ty, 2, 1, skD); P(cx - 2, ty, shL); P(cx + 1, ty, shL); P(cx - 2, ty + 2, shL); }
    else R(cx - 2, ty, 4, 1, shL);
    if (tj === 1 && d === "down") R(cx - 3, ty + 3, 6, 1, corD); // cinto do vestido
    else if (tj === 2 && d === "down") P(cx - 1, ty + 1, "#E9D8BE");
    else if (tj === 3){ // macacão: peitilho e alças
      R(cx - 3, ty + 3, 6, 2, cor);
      if (d === "down"){ R(cx - 2, ty + 2, 4, 1, cor); R(cx - 2, ty, 1, 2, cor); R(cx + 1, ty, 1, 2, cor); P(cx - 2, ty + 2, C.gold); P(cx + 1, ty + 2, C.gold); }
      else { R(cx - 2, ty, 1, 3, cor); R(cx + 1, ty, 1, 3, cor); P(cx - 1, ty + 2, cor); P(cx, ty + 2, cor); }
    } else if (tj === 4){ // moletom: cordão e bolso / capuz nas costas
      if (d === "down"){ P(cx - 2, ty, shD); P(cx + 1, ty, shD); P(cx - 1, ty + 1, shoe); P(cx, ty + 2, shoe); R(cx - 2, ty + 3, 4, 1, shD); }
      else { R(cx - 3, ty, 6, 2, shD); R(cx - 2, ty + 2, 4, 1, shD); R(cx - 2, ty, 4, 1, top); }
    } else if (tj === 5){ if (!ela){ P(cx - 3 - o, ty, skin); P(cx + 2 + o, ty, skin); } if (d === "down") R(cx - 1, ty, 2, 1, skin); }
    else if (tj >= 6) trajeLeva6(tj, cx, ty, null, d, { cor, corD: sh(cor, -.24), corL: sh(cor, .28), skin, top, shD, ela, o, X: (a, w) => cx + a, side: false });
  };
  // braços pra cima (comemorando), desenhados depois da cabeça como em pé
  const bracosAlto = ty => {
    const a = 5 + o;
    R(cx - a, ty, 2, 1, manga); R(cx - a - 1, ty - 2, 1, 3, manga); R(cx - a - 1, ty - 5, 1, 3, skin);
    R(cx + a - 2, ty, 2, 1, mangaD); R(cx + a, ty - 2, 1, 3, mangaD); R(cx + a, ty - 5, 1, 3, skin);
    if (tj === 4){ R(cx - a - 1, ty - 4, 1, 2, manga); R(cx + a, ty - 4, 1, 2, mangaD); }
  };
  const cabeca = (hy, d) => { headDraw(cx, hy, d, skin, blink, v, hair, fx7); hairDraw(cx, hy, d, st, hair); if (pose.indexOf("messy") >= 0) cabeloBaguncado(cx, hy, st, hair); acessDraw(cx, hy, d, v); };

  if (dir === "up"){ // de costas (olhando a TV, no computador, na cadeira da frente da mesa)
    const ty = by - 7 + b, hy = by - 16 + b;
    torso(ty, "up");
    if (barr >= 2){ R(cx - 4, ty + 2, 1, 2, bcol); R(cx + 3, ty + 2, 1, 2, sh(bcol, -.22)); } // leva 7: a barriga aparece dos lados
    R(cx - 4, by - 2, 8, 2, lap); R(cx - 4, by - 2, 8, 1, lapD); P(cx - 4, by - 1, lapD); P(cx + 3, by - 1, lapD); P(cx - 1, by - 1, lapL);
    for (const lado of [-1, 1]){
      const x0 = lado < 0 ? cx - ax : cx + ax - 1, mc = cMao(lado, manga), pele = lado < 0 ? skin : skD;
      if (act === "arms") continue;
      if (act === "pc"){ // antebraços pra frente, até o teclado/controle; as mãos alternam
        const up = (lado < 0) === !f;
        R(x0, ty + 1, 1, 2, mc); R(x0, ty - (up ? 1 : 0), 1, up ? 2 : 1, mangaN > 2 ? mc : pele);
      } else if ((act === "eat" || act === "drink") && lado > 0 && f){ // cotovelo sobe levando o garfo à boca
        R(x0, ty + 1, 1, 1, mc); P(x0 + 1, ty + 1, mc); P(x0 + 1, ty, mc); P(x0, ty - 1, mangaN > 2 ? mc : pele);
      } else { R(x0, ty + 1, 1, Math.min(mangaN, 3), mc); if (mangaN < 3) R(x0, ty + 1 + mangaN, 1, 3 - mangaN, pele); }
    }
    cabeca(hy, "up");
    if (act === "arms") bracosAlto(ty);
    return;
  }
  // sentado fica 2px mais baixo que em pé: tronco de 4 linhas, colo de 2, canela de 1 e o pé
  const ty = by - 7 + b, hy = by - 16 + b, ly = by - 4;
  if (dir === "left" || dir === "right"){ // de lado: coxa pra frente, canela descendo, pé apontando
    R(X(-5, 2), by - 2, 2, 1, perna); R(X(-6, 3), by - 1, 3, 1, shoe); P(X(-6, 1), by - 1, sh(shoe, -.15));
    R(cx - 3, ty, 6, 4, top); P(X(-3, 1), ty, shL);
    if (tj === 3) R(X(0, 1), ty, 1, 3, cor); else if (tj === 4) R(X(1, 3), ty, 3, 2, shD); else if (tj === 1) R(cx - 3, ty + 3, 6, 1, corD);
    R(X(-5, 8), ly, 8, 2, lap); R(X(-5, 8), ly, 8, 1, lapL); P(X(-5, 1), ly + 1, lapD); R(X(2, 1), ly, 1, 2, lapD);
    if (tj === 1) R(X(-5, 1), ly + 2, 1, 1, cor); // vestido cai do joelho
    if (barr){ R(X(-4, 1), ty + 1, 1, 3, bcol); if (barr >= 2) R(X(-5, 1), ty + 2, 1, 2, bcol); if (barr >= 3){ R(X(-6, 1), ty + 2, 1, 2, bcol); P(X(-5, 1), ty + 1, bcol); } P(X(-4, 1), ty + 1, sh(bcol, .3)); P(X(-3 - barr, 1), ty + 3, sh(bcol, -.22)); } // leva 7
    const mc = mangaD, pele = skD;
    if (act === "pc"){ R(X(-1, 2), ty + 1, 2, 2, mc); R(X(-4, 3), ty + 2 + f, 3, 1, mangaN > 2 ? mc : pele); }
    else if ((act === "eat" || act === "drink") && f){ R(X(-1, 2), ty + 1, 2, 1, mc); R(X(-3, 2), ty, 2, 1, mangaN > 2 ? mc : pele); }
    else if (act !== "arms"){ R(X(-1, 2), ty + 1, 2, mangaN, mc); if (mangaN < 3) R(X(-1, 2), ty + 1 + mangaN, 2, 3 - mangaN, pele); R(X(-4, 3), ly, 3, 1, skin); }
    cabeca(hy, dir);
    if ((act === "eat" || act === "drink") && f){ P(X(-4, 1), hy + 8, skin); if (act === "eat"){ P(X(-5, 1), hy + 7, metal); P(X(-6, 1), hy + 6, metal); } else R(X(-6, 2), hy + 6, 2, 2, xic); }
    if (act === "arms") bracosAlto(ty);
    return;
  }
  // de frente: canelas curtas, pés pra frente (sola larga), tronco, colo (coxas vindo pra frente), mãos no colo
  R(cx - 3, by - 2, 2, 1, perna); R(cx + 1, by - 2, 2, 1, perna);
  R(cx - 4, by - 1, 3, 1, shoe); R(cx + 1, by - 1, 3, 1, shoe); P(cx - 4, by - 1, sh(shoe, -.15)); P(cx + 3, by - 1, sh(shoe, -.15));
  torso(ty, "down");
  R(cx - 4, ly, 8, 2, lap); R(cx - 4, ly, 8, 1, lapL); P(cx - 1, ly + 1, lapD); P(cx, ly + 1, lapD); P(cx - 4, ly + 1, lapD); P(cx + 3, ly + 1, lapD);
  if (tj === 1 || tj === 7){ R(cx - 4, ly + 2, 8, 1, cor); R(cx - 3, ly + 2, 6, 1, corD); } // vestido cobre os joelhos
  else if (tj === 2){ R(cx - 4, ly + 1, 8, 1, cor); R(cx - 4, ly + 2, 8, 1, corD); } // saia rodada por cima dos joelhos
  if (barr){ // leva 7: barriga redondinha caindo por cima do colo
    const w = barr === 1 ? 4 : barr === 2 ? 6 : 8;
    R(cx - w / 2, ly, w, 1, bcol); if (barr >= 2) R(cx - w / 2 + 1, ly + 1, w - 2, 1, bcol);
    if (barr >= 3) R(cx - 3, ly + 2, 6, 1, sh(bcol, -.22)); else R(cx - w / 2 + 1, ly + (barr >= 2 ? 2 : 1), w - 2, 1, sh(bcol, -.22));
    R(cx - 2, ty + 2, 2, 1, sh(bcol, .3)); if (barr >= 2) P(cx - 2, ly, sh(bcol, .3));
    if (barr >= 2){ R(cx - 5 - (barr > 2 ? 1 : 0), ty + 2, 1 + (barr > 2 ? 1 : 0), 2, bcol); R(cx + 4, ty + 2, 1 + (barr > 2 ? 1 : 0), 2, sh(bcol, -.22)); }
  }
  for (const lado of [-1, 1]){
    if (act === "arms") continue;
    const x0 = lado < 0 ? cx - ax : cx + ax - 1, mc = cMao(lado, manga), pele = lado < 0 ? skin : skD;
    if (lado > 0 && f && (act === "eat" || act === "drink")){ R(x0, ty + 1, 1, 1, mc); continue; } // esse sobe até a boca (depois da cabeça)
    R(x0, ty + 1, 1, Math.min(mangaN, 3), mc); if (mangaN < 3) R(x0, ty + 1 + mangaN, 1, 3 - mangaN, pele);
    const hx = x0 - lado, hyy = act === "pc" ? ly - ((lado < 0) === !f ? 1 : 0) : ly;
    P(hx, hyy, skin);
    if (lado > 0 && act === "eat" && !f){ P(hx, hyy - 1, metal); P(hx, hyy - 2, metal); }
    if (lado > 0 && act === "drink" && !f) R(hx - 1, hyy - 2, 2, 2, xic);
  }
  cabeca(hy, "down");
  if ((act === "eat" || act === "drink") && f){
    const x0 = cx + ax - 1;
    P(x0, ty, mangaN > 2 ? mangaD : skD); P(x0, hy + 8, skin); P(x0 - 1, hy + 8, skin);
    if (act === "eat"){ P(x0 - 2, hy + 7, metal); P(x0 - 3, hy + 7, "#F6D25A"); }
    else { R(x0 - 3, hy + 7, 2, 2, xic); P(x0 - 3, hy + 7, "#D6ECFA"); P(x0 - 1, hy + 8, sh(xic, -.25)); }
  }
  if (act === "arms") bracosAlto(ty);
}
function headDraw(cx, hy, dir, skin, closed, v, hair, fx){
  const dark = hexRGB(skin)[0] < 170, skD = sh(skin, -.14), eye = dark ? "#1E1220" : "#3A2433", mo = sh(skin, -.4);
  const corado = fx && fx.blush, feliz = fx && fx.happy, bl = corado ? "rgba(238,80,100,.85)" : feliz ? "rgba(238,96,110,.7)" : "rgba(238,96,110,.5)";
  const ela = v && v.corpo === "ela", bc = v && v.barba ? sh(hair || "#2B1D14", -.1) : null;
  R(cx - 4, hy, 8, 1, skin); R(cx - 5, hy + 1, 10, 6, skin); R(cx - 4, hy + 7, 8, 1, skin); R(cx - 3, hy + 8, 6, 1, skin);
  P(cx - 4, hy + 7, skD); P(cx + 3, hy + 7, skD); P(cx - 3, hy + 8, skD); P(cx + 2, hy + 8, skD);
  if (dir === "down"){
    R(cx + 4, hy + 3, 1, 4, skD);
    if (feliz){ R(cx - 3, hy + 4, 2, 1, eye); P(cx - 4, hy + 5, eye); R(cx + 1, hy + 4, 2, 1, eye); P(cx + 3, hy + 5, eye); } // leva 7: olhinhos ^ ^
    else if (closed){ R(cx - 3, hy + 5, 2, 1, eye); R(cx + 1, hy + 5, 2, 1, eye); }
    else { R(cx - 3, hy + 4, 2, 2, eye); R(cx + 1, hy + 4, 2, 2, eye); P(cx - 3, hy + 4, "#FFFFFF"); P(cx + 1, hy + 4, "#FFFFFF"); }
    if (ela && !feliz){ const y = closed ? hy + 4 : hy + 3; P(cx - 4, y, eye); P(cx + 3, y, eye); } // cílios
    R(cx - 4, hy + 6, 2, 1, bl); R(cx + 2, hy + 6, 2, 1, bl);
    if (corado){ P(cx - 5, hy + 5, bl); P(cx + 4, hy + 5, bl); }
    R(cx - 1, hy + 7, 2, 1, mo);
    if (feliz){ P(cx - 2, hy + 6, mo); P(cx + 1, hy + 6, mo); } // sorrisão
    if (bc){ R(cx - 5, hy + 4, 1, 3, bc); R(cx + 4, hy + 4, 1, 3, bc); R(cx - 4, hy + 7, 3, 1, bc); R(cx + 1, hy + 7, 3, 1, bc); R(cx - 3, hy + 8, 6, 1, bc); }
  } else if (dir === "left" || dir === "right"){
    const m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
    if (feliz){ P(X(-4, 1), hy + 4, eye); P(X(-3, 1), hy + 5, eye); }
    else { R(X(-4, 1), hy + (closed ? 5 : 4), 1, closed ? 1 : 2, eye); if (!closed && dark) P(X(-5, 1), hy + 4, "#FFFFFF"); }
    if (ela && !feliz) P(X(-3, 1), hy + (closed ? 4 : 3), eye);
    R(X(-5, 2), hy + 6, 2, 1, bl); if (corado) P(X(-3, 1), hy + 6, bl); P(X(-6, 1), hy + 5, skin); P(X(-4, 1), hy + 7, mo);
    if (bc){ R(X(-1, 1), hy + 5, 1, 2, bc); R(X(-3, 3), hy + 7, 3, 1, bc); R(X(-3, 4), hy + 8, 4, 1, bc); P(X(-4, 1), hy + 8, bc); }
  }
}
function hairDraw(cx, hy, dir, st, hair){
  const hl = sh(hair, .3), dk = sh(hair, -.25), side = dir === "left" || dir === "right", tie = "#E8607A";
  const m = dir === "right" ? -1 : 1, X = (a, w) => m > 0 ? cx + a : cx - a - w;
  if (st === 4 || st === 9){ // raspado e topete: cabelo rente
    R(cx - 4, hy - 1, 8, 1, hair); R(cx - 5, hy, 10, 2, hair);
    if (dir === "down"){ P(cx - 5, hy + 2, hair); P(cx + 4, hy + 2, hair); }
    else if (dir === "up"){ R(cx - 5, hy + 2, 10, 4, hair); R(cx - 4, hy + 6, 8, 1, hair); R(cx - 2, hy + 3, 1, 2, dk); R(cx + 2, hy + 2, 1, 2, dk); }
    else { R(X(0, 5), hy + 2, 5, 3, hair); R(X(1, 3), hy + 5, 3, 1, hair); P(X(2, 1), hy + 3, dk); }
    for (const [a, b] of [[-3, 0], [1, 0], [-1, 1], [3, 1]]) P(cx + a, hy + b, dk);
    if (st === 9){ // topete
      R(cx - 2, hy - 5, 4, 1, hair); R(cx - 4, hy - 4, 7, 1, hair); R(cx - 4, hy - 3, 8, 2, hair);
      R(cx - 2, hy - 4, 3, 1, hl); P(cx - 3, hy - 3, hl); P(cx + 3, hy - 2, dk); P(cx - 1, hy - 2, dk);
      if (side){ R(X(-6, 3), hy - 3, 3, 2, hair); P(X(-6, 1), hy - 3, hl); }
    } else R(cx - 3, hy - 1, 3, 1, hl);
    return;
  }
  if (st === 8){ // black power
    R(cx - 5, hy - 6, 10, 1, hair); R(cx - 7, hy - 5, 14, 1, hair); R(cx - 8, hy - 4, 16, 6, hair);
    if (dir === "down"){ R(cx - 8, hy + 2, 3, 4, hair); R(cx + 5, hy + 2, 3, 4, hair); R(cx - 7, hy + 6, 2, 1, hair); R(cx + 5, hy + 6, 2, 1, hair); R(cx - 5, hy + 2, 2, 1, hair); R(cx + 3, hy + 2, 2, 1, hair); P(cx - 7, hy + 4, dk); P(cx + 6, hy + 3, dk); }
    else if (dir === "up"){ R(cx - 8, hy + 2, 16, 5, hair); R(cx - 7, hy + 7, 14, 1, hair); P(cx - 4, hy + 4, dk); P(cx + 3, hy + 5, dk); P(cx, hy + 3, dk); }
    else { R(X(0, 8), hy + 2, 8, 5, hair); R(X(1, 6), hy + 7, 6, 1, hair); R(X(-8, 3), hy + 2, 3, 1, hair); P(X(4, 1), hy + 4, dk); }
    for (const [a, b] of [[-6, -3], [-2, -5], [3, -4], [6, -1], [-7, 1], [0, -2], [4, 0], [-4, 0], [5, -3], [-3, -2]]) P(cx + a, hy + b, dk);
    for (const [a, b] of [[-5, -4], [-1, -5], [-6, -2], [2, -5], [-4, -5]]) P(cx + a, hy + b, hl);
    return;
  }
  // topo
  if (st === 3){ R(cx - 5, hy - 4, 10, 1, hair); R(cx - 6, hy - 3, 12, 2, hair); R(cx - 7, hy - 1, 14, 4, hair); }
  else { R(cx - 4, hy - 2, 8, 1, hair); R(cx - 5, hy - 1, 10, 3, hair); }
  // franja, nuca ou lateral
  if (dir === "down"){ if (st === 5){ R(cx - 5, hy + 2, 10, 2, hair); P(cx - 2, hy + 3, dk); P(cx + 2, hy + 3, dk); } else { R(cx - 5, hy + 2, 3, 1, hair); R(cx + 1, hy + 2, 4, 1, hair); P(cx - 5, hy + 3, hair); P(cx + 4, hy + 3, hair); } }
  else if (dir === "up"){ R(cx - 5, hy + 2, 10, 5, hair); R(cx - 4, hy + 7, 8, 1, hair); R(cx - 3, hy + 3, 1, 3, dk); R(cx + 1, hy + 4, 1, 3, dk); }
  else { R(X(0, 5), hy + 2, 5, 4, hair); R(X(-1, 1), hy + 2, 1, 2, hair); R(X(1, 4), hy + 6, 4, 1, hair); R(X(-5, 2), hy + 2, 2, 1, hair); P(X(2, 1), hy + 4, dk); }
  if (st === 0){ R(cx + 1, hy - 3, 2, 1, hair); }
  else if (st === 1){
    if (dir === "down"){ R(cx - 6, hy, 2, 11, hair); R(cx + 4, hy, 2, 11, hair); R(cx - 6, hy + 10, 2, 1, dk); R(cx + 4, hy + 10, 2, 1, dk); P(cx - 6, hy + 4, hl); P(cx - 6, hy + 5, hl); }
    else if (dir === "up"){ R(cx - 6, hy, 12, 11, hair); R(cx - 5, hy + 11, 10, 1, dk); R(cx - 3, hy + 5, 1, 6, dk); R(cx + 2, hy + 4, 1, 7, dk); R(cx - 1, hy + 6, 1, 4, hl); }
    else { R(X(0, 6), hy + 2, 6, 9, hair); R(X(1, 4), hy + 11, 4, 1, dk); R(X(3, 1), hy + 5, 1, 5, dk); P(X(-5, 1), hy + 3, hair); }
  }
  else if (st === 2){
    const bx = side ? X(-1, 6) : cx - 3;
    R(bx + 2, hy - 6, 2, 1, hair); R(bx + 1, hy - 5, 4, 3, hair); P(bx + 1, hy - 5, hl); P(bx + 2, hy - 5, hl); P(bx + 4, hy - 3, dk);
    R(bx + 1, hy - 2, 4, 1, "#FFF4E0");
  }
  else if (st === 3){
    if (dir === "down"){ R(cx - 7, hy + 3, 2, 3, hair); R(cx + 5, hy + 3, 2, 3, hair); P(cx - 6, hy + 6, hair); P(cx + 5, hy + 6, hair); }
    else if (dir === "up"){ R(cx - 7, hy + 3, 14, 4, hair); R(cx - 6, hy + 7, 12, 1, hair); }
    else { R(X(0, 7), hy + 3, 7, 4, hair); R(X(1, 5), hy + 7, 5, 1, hair); }
    for (const [a, b] of [[-5, -2], [-2, -3], [2, -2], [5, 0], [-6, 1], [0, -1], [3, 1], [-3, 0]]) P(cx + a, hy + b, dk);
    for (const [a, b] of [[-4, -3], [1, -4], [4, -2], [-6, -1]]) P(cx + a, hy + b, hl);
  }
  else if (st === 5){ // franja reta e cabelo na altura do queixo
    if (dir === "down"){ R(cx - 6, hy, 2, 8, hair); R(cx + 4, hy, 2, 8, hair); R(cx - 6, hy + 7, 2, 1, dk); R(cx + 4, hy + 7, 2, 1, dk); P(cx - 6, hy + 3, hl); }
    else if (dir === "up"){ R(cx - 6, hy, 12, 8, hair); R(cx - 5, hy + 8, 10, 1, dk); R(cx - 2, hy + 3, 1, 4, dk); R(cx + 2, hy + 3, 1, 4, dk); }
    else { R(X(0, 6), hy + 2, 6, 6, hair); R(X(1, 4), hy + 8, 4, 1, dk); R(X(-6, 3), hy + 2, 3, 2, hair); P(X(2, 1), hy + 5, dk); }
  }
  else if (st === 6){ // rabo de cavalo
    if (dir === "down"){ R(cx + 5, hy, 2, 3, hair); R(cx + 6, hy + 3, 1, 4, hair); P(cx + 5, hy, tie); P(cx + 6, hy + 6, dk); }
    else if (dir === "up"){ R(cx - 1, hy + 1, 2, 1, tie); R(cx - 2, hy + 2, 1, 6, dk); R(cx + 1, hy + 2, 1, 6, dk); R(cx - 1, hy + 2, 2, 8, hair); P(cx - 1, hy + 3, hl); P(cx, hy + 9, dk); }
    else { P(X(4, 1), hy + 1, tie); R(X(5, 2), hy + 1, 2, 3, hair); R(X(6, 2), hy + 4, 2, 4, hair); P(X(6, 1), hy + 7, dk); P(X(5, 1), hy + 2, hl); }
  }
  else if (st === 7){ // maria-chiquinha
    const tufo = x0 => { R(x0, hy + 2, 3, 4, hair); R(x0 + (x0 < cx ? 0 : 1), hy + 6, 2, 1, hair); P(x0 + 1, hy + 3, hl); P(x0 + 1, hy + 5, dk); };
    if (!side){ tufo(cx - 8); tufo(cx + 5); P(cx - 6, hy + 2, tie); P(cx + 5, hy + 2, tie); }
    else { const x0 = m > 0 ? cx + 4 : cx - 7; tufo(x0); P(m > 0 ? x0 : x0 + 2, hy + 2, tie); }
  }
  // brilho
  R(cx - 3, hy - 1, 3, 1, hl); P(cx - 4, hy, hl); P(cx + 3, hy + 1, dk);
}
// leva 7: cabelo bagunçado (fios espetados pra fora do topo do penteado)
function cabeloBaguncado(cx, hy, st, hair){
  const y = st === 8 ? hy - 6 : st === 3 ? hy - 4 : st === 9 ? hy - 5 : st === 4 ? hy - 1 : hy - 2, hl = sh(hair, .3);
  P(cx - 3, y - 1, hair); P(cx - 2, y - 2, hair); P(cx + 1, y - 1, hl); P(cx + 2, y - 2, hair); P(cx + 5, y + 1, hair); P(cx - 6, y + 2, hair); P(cx + 6, y + 3, hair);
}
// acessórios: 1 óculos, 2 laço, 3 boné, 4 flor
function acessDraw(cx, hy, dir, v){
  if (v.traje === 6) capuzBichinho(cx, hy, dir, v); // leva 6: capuz com orelhinhas do pijama
  const a = v.acess; if (!a) return;
  if (a >= 5){ acessLeva6(a, cx, hy, dir, v); return; }
  const st = v.estilo, side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (q, w) => m > 0 ? cx + q : cx - q - w;
  if (a === 1){
    const f = "#C68A3E"; // armação cor de casco: o olho continua aparecendo
    if (dir === "down"){ R(cx - 4, hy + 3, 3, 1, f); R(cx + 1, hy + 3, 3, 1, f); P(cx - 1, hy + 4, f); P(cx, hy + 4, f); P(cx - 4, hy + 4, f); P(cx + 3, hy + 4, f); P(cx - 4, hy + 5, f); P(cx + 3, hy + 5, f); R(cx - 3, hy + 6, 2, 1, f); R(cx + 1, hy + 6, 2, 1, f); }
    else if (side){ R(X(-5, 2), hy + 3, 2, 1, f); P(X(-5, 1), hy + 4, f); P(X(-5, 1), hy + 5, f); P(X(-4, 1), hy + 6, f); R(X(-3, 3), hy + 4, 3, 1, f); }
  } else if (a === 2){
    const c = "#E8607A", cD = "#B8405A", cL = "#F7A3B5";
    const bx = st === 8 ? cx + 3 : side ? X(-1, 5) : dir === "up" ? cx - 6 : cx + 1, y = st === 8 ? hy - 5 : st === 3 || st === 9 ? hy - 5 : st === 4 ? hy - 3 : hy - 4;
    R(bx, y, 2, 3, c); R(bx + 3, y, 2, 3, c); P(bx + 2, y + 1, cD); P(bx, y, cL); P(bx + 3, y, cL); P(bx + 1, y + 2, cD); P(bx + 4, y + 2, cD);
  } else if (a === 3){
    const c = "#E8735F", cD = sh(c, -.25), cL = sh(c, .3), y = st === 8 ? hy - 6 : hy - 2;
    R(cx - 4, y, 8, 1, c); R(cx - 5, y + 1, 10, 2, c); R(cx - 3, y, 3, 1, cL); P(cx - 1, y - 1, cD);
    if (dir === "down"){ R(cx - 5, y + 3, 10, 1, cD); P(cx, y + 1, "#FFFFFF"); P(cx - 1, y + 2, "#FFFFFF"); }
    else if (dir === "up"){ R(cx - 5, y + 3, 10, 1, c); P(cx - 1, y + 3, "#FFF4E0"); P(cx, y + 3, "#FFF4E0"); }
    else { R(X(-5, 10), y + 3, 10, 1, c); R(X(-8, 4), y + 3, 4, 1, cD); }
  } else if (a === 4){
    const p = "#F9B8CC", pD = "#E58FB5", ce = "#FFE08A";
    const fx = st === 8 ? (dir === "up" ? cx + 4 : side ? X(2, 3) : cx - 8) : dir === "up" ? cx + 3 : side ? X(1, 3) : cx - 6, fy = st === 8 ? hy - 3 : hy - 1;
    P(fx + 1, fy, p); P(fx, fy + 1, p); P(fx + 2, fy + 1, pD); P(fx + 1, fy + 2, pD); P(fx + 1, fy + 1, ce);
  }
}
function pixHeart(x, y, c){ x = Math.round(x); y = Math.round(y); R(x, y, 2, 1, c); R(x + 3, y, 2, 1, c); R(x, y + 1, 5, 1, c); R(x + 1, y + 2, 3, 1, c); R(x + 2, y + 3, 1, 1, c); }
function pixNote(x, y, c){ x = Math.round(x); y = Math.round(y); R(x + 2, y, 1, 4, c); R(x + 3, y, 2, 1, c); R(x, y + 3, 3, 2, c); }
