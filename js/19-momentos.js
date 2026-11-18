"use strict";
// Casinha · leva 9: momentos (presentes, jantar à luz de velas, cinema em casa, álbum de fotos, datas especiais e nossa história)
// Carregado ANTES do 18-laco.js (o laço chama os ganchos daqui: leva9Update, addLeva9Objs, leva9Luzes, leva9Pose, drawLabels9).
// =====================================================================
// LEVA 9
//   casa/presentes/<push> = { de, para, item, movel?, laco, bilhete (até 140), pago, at, x, y, andar, aberto? (ts) }
//      fica embrulhado no chão perto da cama até o destinatário abrir; aberto há mais de 30 dias é apagado
//   casa/encontros/<push> = { a (quem chamou), b, mov (mesa), andar, estado: convite|aceito|fim|recusado|cancelado|expirou,
//                             criado, aceitoAt, chegou: {pid: ts}, ini (os dois sentaram), comida (receita|delivery|pao), pago: {pid}, contado, fimAt }
//   casa/musica.jantar = id do jantar: a faixa "velas" toca na mesa; .antes = o disco que tocava antes (volta no fim)
//   casa/cinema = { tv, sofa, andar, genero, titulo, ini, por, pipoca, vistos: {pid: ts}, contado }   um filme por vez na casa
//   casa/album/<push> = { autor, nome, at, legenda, andar, w, h }
//   casa/albumImg/<mesmo id> = "data:image/...;base64,..."   a imagem fica separada e só é baixada quando alguém olha
//   casa/datas/<push> = { tipo: namoro|niver|outra, nome, emoji, d, m, a, quem?, por, at }
//   casa/festas/<AAAA-MM-DD>_<id da data>/<pid> = ts      bônus do dia especial (uma vez por pessoa)
//   casa/historia/<chave> = { at, emoji, texto, por?, foto? (id do álbum), manual? }   "Nossa história" (casa/diario é das tarefas!)
//      chave fixa por evento = sem duplicata: conq_<id>, nivel_<n>, bebe_<nasceu>, pr_<id>, jantar_<id>, filme_<ini>, foto_<id>,
//      data_<id>_<ano>, colheita_<n>, visita_<id>; as escritas à mão usam push
//   casa/stats/presentes, jantares, filmes, fotos       contadores das conquistas
//   casa/leva9 = ts      migração: marca casa/criada em casa antiga e põe na história conquistas, nível e bebê que já existiam
//   jogadores/<pid>/guarda/acess-<ACESS_COLAR> = true    colar ganho de presente (só ganhando)
//   Teste: L9 (estado) · jtAvancar(s) · cnAvancar(s)   ("O 💞 Nós" abriga Presentes, Álbum, Nossa história e Datas)
// =====================================================================
let presentes = {}, prCarregado = false, prAvisou = false, prVis = [];
let encontros = {}, enCarregado = false, enTx = {}, enFeito = {}, enComida = {};
let cinema = null, cnCarregado = false, cnFeito = {}, cnDispensado = 0, cnMomUlt = "";
let album = {}, alCarregado = false, historiaCache = null;
let datas = {}, dtCarregadas = false, festaHoje = [];
let leva9Tentou = false, conq9 = null, nivel9 = null, bebeSig9 = "", visita9 = null, colheita9 = null, jtPart = 0;
const pos9 = {};
const L9 = { get presentes(){ return presentes; }, get encontros(){ return encontros; }, get cinema(){ return cinema; }, get album(){ return album; }, get datas(){ return datas; } };
Object.assign(SFX_MIN, { foto: 600, papel: 500, pipoca: 250, susto: 900, fosforo: 900 });

const nomeEu9 = () => (me && me.dados && me.dados.nome) || "Alguém";
const outrosJog = () => Object.entries(jogadores).filter(([id, j]) => id !== pid && j && j.nome && !j.visita); // leva 10: visita não é moradora
const pad2 = n => String(n).padStart(2, "0");
function historia(chave, emoji, texto, extra){
  if (!salaRef) return Promise.resolve(false);
  return txn("casa/historia/" + chave, c => c ? undefined : Object.assign({ at: srvNow(), emoji, texto: String(texto).slice(0, 160) }, extra || {}))
    .then(ok => { if (ok) historiaCache = null; return ok; });
}
// cômodo escurecido (cinema, jantar): máscara do cômodo em cache e brilhos por cima (sprites de luz em cache, nada de gradiente por quadro)
const mascaras = new Map();
function mascaraComodo(cm){
  const k = andarAtual + "|" + H + "|" + cm; let c = mascaras.get(k); if (c) return c;
  c = document.createElement("canvas"); c.width = W * T; c.height = H * T;
  const x = c.getContext("2d"); x.fillStyle = "#1C0E30";
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (comodo(xx, y) === cm) x.fillRect(xx * T, y * T, T, T);
  if (mascaras.size > 24) mascaras.clear();
  mascaras.set(k, c); return c;
}
function escurecer(objs, cm, a, brilhos, z){
  if (a <= 0) return;
  objs.push({ z: z || 1e9 - 1, f: () => {
    ctx.globalAlpha = clamp(a, 0, 1); ctx.drawImage(mascaraComodo(cm), 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, r, c, p] of brilhos || []){ const r2 = r * .7; ctx.globalAlpha = clamp(p, 0, 1); ctx.drawImage(luzSpr(c, r, 1), x - r2, y - r2, r2 * 2, r2 * 2); }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
  } });
}
// letrinhas de 3x5 (datas na foto, contagem do filme, calendário)
const FONTE3 = { "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001", "5": "111100111001111",
  "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111", "/": "001001010100100", "F": "111100110100100", "I": "111010010010111", "M": "101111111101101", " ": "000000000000000" };
function txt3(s, x, y, cor){ for (const ch of String(s)){ const g = FONTE3[ch] || FONTE3[" "]; for (let i = 0; i < 15; i++) if (g[i] === "1") P(x + i % 3, y + Math.floor(i / 3), cor); x += 4; } }
// balão com texto/emoji em alta resolução (por cima do nome)
function bolha9(mctx, fs, sx, sy, txt){
  const f2 = Math.round(fs * 1.05); mctx.font = "700 " + f2 + "px Nunito, sans-serif";
  const tw = mctx.measureText(txt).width, bw = tw + 12, bh = f2 * 1.5, bx = clamp(sx - bw / 2, 2, canvas.width - bw - 2), by = sy - bh;
  mctx.fillStyle = "#FFFFFF"; mctx.beginPath(); if (mctx.roundRect) mctx.roundRect(bx, by, bw, bh, 8); else mctx.rect(bx, by, bw, bh); mctx.fill();
  mctx.beginPath(); mctx.moveTo(sx - 4, by + bh - 1); mctx.lineTo(sx + 4, by + bh - 1); mctx.lineTo(sx, by + bh + 5); mctx.fill();
  mctx.fillStyle = "#1B1528"; mctx.textAlign = "left"; mctx.fillText(txt, bx + 6, by + bh - f2 * .3); mctx.textAlign = "center";
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
}

// =====================================================================
// 1. PRESENTES
// =====================================================================
const LACOS = [["Vermelho", "#E8445E"], ["Rosa", "#F49AAE"], ["Dourado", "#F6C667"], ["Azul", "#7FB8E8"], ["Verde", "#5DBB7D"], ["Lilás", "#B49CF4"]];
const PRESENTES = {
  flores:    { nome: "Buquê de flores", art: "um buquê de flores", ic: "💐", preco: 40, papel: "#BFE5DA", efeito: { social: 25, diversao: 15 }, movel: "flores", txt: "Vira um vaso de flores na casa" },
  chocolate: { nome: "Caixa de bombons", art: "uma caixa de bombons", ic: "🍫", preco: 25, papel: "#F9C9D6", efeito: { fome: 20, diversao: 25 }, txt: "Docinho pra adoçar o dia" },
  ursinho:   { nome: "Ursinho de pelúcia", art: "um ursinho de pelúcia", ic: "🧸", preco: 80, papel: "#FCE9A0", efeito: { social: 20, diversao: 15 }, movel: "urso", txt: "Fica na casa pra abraçar" },
  carta:     { nome: "Cartinha de amor", art: "uma cartinha de amor", ic: "💌", preco: 5, papel: "#FFF4E0", efeito: { social: 35 }, txt: "Só o bilhete, caprichado" },
  colar:     { nome: "Colar de coração", art: "um colar de coração", ic: "💝", preco: 120, papel: "#5246B0", efeito: { social: 25, diversao: 10 }, acess: 1, txt: "Acessório novo no guarda-roupa" },
  perfume:   { nome: "Perfume", art: "um perfume", ic: "🌸", preco: 50, papel: "#E2D6FA", efeito: { higiene: 40, social: 15 }, txt: "Cheirinho bom o dia todo" },
  massagem:  { nome: "Vale-massagem", art: "um vale-massagem", ic: "💆", preco: 15, papel: "#C5E0F6", efeito: { energia: 30, social: 20, diversao: 10 }, txt: "Relaxa na hora de abrir" },
  movel:     { nome: "Móvel embrulhado", art: "um móvel novo", ic: "🛋️", preco: 10, papel: "#D9A86A", efeito: { diversao: 20, social: 10 }, txt: "Móvel novo pra casa (+$10 do embrulho)" }
};
const MOVEIS_PRESENTE = ["planta", "abajur", "poltrona", "estante", "game", "som", "flores"];
// colar: só ganhando de presente (06-criador trava quem não ganhou)
ACESS.push({ nome: "Colar de coração", presente: 1 });
const ACESS_COLAR = ACESS.length - 1;
function acessLeva9(a, cx, hy, dir, v){
  if (a !== ACESS_COLAR) return;
  const y = hy + 9, ou = "#F6C667", ouD = "#D8963A", co = "#E8445E", coL = "#F7A3B5", side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (q, w) => m > 0 ? cx + q : cx - q - w;
  if (dir === "down"){ P(cx - 3, y, ouD); P(cx + 2, y, ouD); P(cx - 2, y + 1, ou); P(cx + 1, y + 1, ou); R(cx - 1, y + 1, 2, 2, co); P(cx - 1, y + 1, coL); }
  else if (dir === "up"){ R(cx - 2, y, 4, 1, ouD); }
  else if (side){ P(X(-3, 1), y, ouD); P(X(-4, 1), y + 1, ou); P(X(-4, 1), y + 2, co); }
}
// vaso de flores (vem de presente e também fica no catálogo)
CAT.flores = { nome: "Vaso de flores", w: 1, h: 1, preco: 50, acoes: [{ id: "flores", nome: "Cheirar as flores", dur: 3, ganho: { diversao: 8, social: 4 } }] };
TOP.flores = 8;
FURN_EXTRA.flores = (x, y) => {
  const v = "#7FB8E8", vD = "#5A8FC4", vL = "#B5D8F5";
  const flor = (fx, fy, c) => { P(fx + 1, fy, c); P(fx, fy + 1, c); P(fx + 2, fy + 1, c); P(fx + 1, fy + 2, c); P(fx + 1, fy + 1, c === "#F6C667" ? "#E8735F" : "#F6C667"); };
  R(x + 7, y - 2, 1, 9, C.leafD); P(x + 5, y + 1, C.leafD); P(x + 6, y + 3, C.leafD); P(x + 9, y + 2, C.leafD); P(x + 10, y + 1, C.leafD); P(x + 8, y + 4, C.leafD);
  P(x + 4, y + 3, C.leaf); P(x + 5, y + 4, C.leaf); P(x + 10, y + 4, C.leaf); P(x + 11, y + 3, C.leaf);
  flor(x + 3, y - 2, "#F49AAE"); flor(x + 9, y - 3, "#F6C667"); flor(x + 6, y - 6, "#FFFFFF"); flor(x + 10, y, "#E8445E"); flor(x + 2, y + 1, "#B49CF4");
  R(x + 5, y + 6, 6, 1, vD); rbox(x + 4, y + 7, 8, 7, v); R(x + 5, y + 8, 1, 4, vL); R(x + 5, y + 13, 6, 1, vD); P(x + 8, y + 10, "#FFFFFF");
};
const meusPresentes = () => Object.entries(presentes).filter(([, g]) => g && g.para === pid && !g.aberto);
const presenteDef = g => PRESENTES[g && g.item] || PRESENTES.carta;
const papelDe9 = g => presenteDef(g).papel;
function presenteSpr(laco, papel){
  return sprite("pr9:" + laco + ":" + papel, 10, 10, (ox, oy) => {
    const L = (LACOS[laco] || LACOS[0])[1], LD = sh(L, -.25), LL = sh(L, .35), pD = sh(papel, -.18), pL = sh(papel, .35), pM = sh(papel, .12);
    R(ox + 1, oy + 5, 8, 5, papel); R(ox + 1, oy + 9, 8, 1, pD); R(ox + 8, oy + 5, 1, 5, pD); P(ox + 2, oy + 6, pL); P(ox + 7, oy + 8, pL); P(ox + 2, oy + 8, pM);
    R(ox, oy + 3, 10, 2, pM); R(ox, oy + 3, 10, 1, pL); R(ox, oy + 4, 10, 1, pD);
    R(ox + 4, oy + 3, 2, 7, L); R(ox + 5, oy + 5, 1, 5, LD); P(ox + 4, oy + 3, LL);
    R(ox + 1, oy, 3, 3, L); P(ox + 2, oy + 1, LD); P(ox + 1, oy, LL); R(ox + 6, oy, 3, 3, L); P(ox + 7, oy + 1, LD); P(ox + 6, oy, LL);
    R(ox + 4, oy + 1, 2, 2, LD);
  });
}
// onde deixar: chão do lado de uma cama (de casal primeiro); se todos os lugares já têm presente, vira pilha (até 3)
function spotPresente(){
  const tenta = n => noAndar(n, () => {
    const usados = {};
    for (const g of Object.values(presentes)) if (g && !g.aberto && (g.andar || 0) === n){ const k = g.x + "," + g.y; usados[k] = (usados[k] || 0) + 1; }
    const ok = (x, y) => walkable(x, y) && MAP[y][x] === 0 && !naEscada(x, y) && !(n === 0 && escadaOn && naLista(PE_ESCADA, x, y)) && (usados[x + "," + y] || 0) < 3;
    const camas = Object.values(moveis).filter(m => m.t === "casal" || m.t === "dossel" || m.t === "solteiro").sort((a, b) => (a.t === "solteiro") - (b.t === "solteiro"));
    let cands = [];
    for (const c of camas){ const perto = adjTo(c), cc = CAT[c.t]; for (let y = c.y - 1; y <= c.y + cc.h; y++) for (let x = c.x - 1; x <= c.x + cc.w; x++) if (perto(x, y) && ok(x, y)) cands.push([x, y]); }
    if (!cands.length) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (ok(x, y) && comodo(x, y) !== "quintal") cands.push([x, y]);
    if (!cands.length) return null;
    // móvel alto logo abaixo esconderia o presente: fica por último
    const custo = ([x, y]) => (usados[x + "," + y] || 0) * 10 + (occ[y + 1] && occ[y + 1][x] && (TOP[moveis[occ[y + 1][x]].t] || 0) >= 4 ? 5 : 0);
    cands.sort((a, b) => custo(a) - custo(b));
    return [cands[0][0], cands[0][1], n];
  });
  return tenta(andarAtual) || (temAndar2() ? tenta(andarAtual ? 0 : 1) : null);
}
function presenteNoToque(wx, wy, toque){
  const f = toque ? 5 : 1; let best = null, bd = 1e9;
  for (const [id, g, k] of prVis){
    const cx = g.x * T + 8, cy = g.y * T + 9 - k * 6;
    if (Math.abs(wx - cx) <= 6 + f && Math.abs(wy - cy) <= 6 + f){ const d = Math.hypot(wx - cx, wy - cy); if (d < bd){ bd = d; best = id; } }
  }
  return best;
}
function menuPresente(id, p){
  const g = presentes[id]; if (!g) return;
  const def = presenteDef(g), it = [];
  if (g.para === pid) it.push({ nome: "Abrir o presente 🎁", info: "De " + nomeDe(g.de), fn: () => irAbrir(id) });
  else it.push({ nota: 1, nome: "Pra " + nomeDe(g.para) + ", de " + (g.de === pid ? "você" : nomeDe(g.de)) + ". Só " + nomeDe(g.para) + " pode abrir 🤫" });
  if (g.de === pid) it.push({ nome: "Pegar de volta", info: "+$" + (g.pago || 0), fn: () => desistirPresente(id) });
  openMenu(p, def.ic + " Presente", it);
}
function irAbrir(id){
  const g = presentes[id]; if (!g || !me) return;
  closePanel(); closeMenu();
  if ((g.andar || 0) !== andarAtual){ toast("Seu presente está " + ondeTxt(g.andar || 0) + " 🎁"); return; }
  goTo(null, (x, y) => Math.abs(x - g.x) + Math.abs(y - g.y) <= 1, () => { if (me.tx !== g.x || me.ty !== g.y) faceTo(g.x, g.y); startAcao({ id: "presente", nome: "Abrindo o presente 🎁", dur: 2.2, ganho: {}, fim: () => abrirPresente(id) }); });
}
function desistirPresente(id){
  txn("casa/presentes/" + id, cur => cur && cur.de === pid && !cur.aberto ? null : undefined).then(ok => {
    if (!ok){ toast("Esse presente já foi aberto 🎁"); return; }
    const g = presentes[id]; ganhar((g && g.pago) || 0); toast("Presente desembrulhado e guardado de volta.");
  });
}
// papel voando e confete; quem abriu ganha também o confete na tela toda
function efeitoAbrir(g, meu){
  const L = (LACOS[g.laco] || LACOS[0])[1], cores = [papelDe9(g), L, "#FFFFFF", sh(papelDe9(g), -.2)];
  for (let i = 0; i < 28; i++) particles.push({ x: g.x * T + 8 + Math.random() * 6 - 3, y: g.y * T + 8, vx: Math.random() * 44 - 22, vy: -26 - Math.random() * 26, life: 2.4, kind: "conf", cor: cores[i % cores.length], ph: Math.random() * 6 });
  burst(g.x, g.y - .3, "heart"); sfx("papel");
  if (meu) confete();
}
function abrirPresente(id){
  const g0 = presentes[id]; if (!g0 || g0.para !== pid || g0.aberto) return;
  // transação no nó do presente (não na folha "aberto": se o presente sumiu, não recria um nó pela metade)
  txn("casa/presentes/" + id, cur => cur && cur.para === pid && !cur.aberto ? Object.assign(cur, { aberto: srvNow() }) : undefined).then(ok => {
    if (!ok){ toast("Esse presente já foi aberto."); return; }
    const g = presentes[id] || g0, def = presenteDef(g);
    efeitoAbrir(g, true);
    ganharNeeds(def.efeito); xpCasal(8); statMais("presentes");
    let extra = "";
    const t = def.movel || (g.item === "movel" && CAT[g.movel] ? g.movel : null);
    if (t){
      const pos = lugarPerto(t, g.x, g.y);
      if (pos){ const m = { t, x: pos[0], y: pos[1], por: g.de }; if (andarAtual === 1) m.andar = 1; ref("casa/moveis").push(m).catch(() => {}); extra = CAT[t].nome + " já está na casa."; }
      else { ganhar(CAT[t].preco); extra = "Não coube na casa: virou $" + CAT[t].preco + " pra comprar no Construir."; }
    }
    if (def.acess){ ref("jogadores/" + pid + "/guarda/acess-" + ACESS_COLAR).set(true).catch(() => {}); extra = "Tá no guarda-roupa: use no espelho."; }
    toastEspecial(def.ic + " " + (g.item === "movel" && CAT[g.movel] ? CAT[g.movel].nome : def.nome) + "!", "De " + nomeDe(g.de) + ". " + (extra || def.txt + "."));
    historia("pr_" + id, def.ic, nomeDe(g.de) + " deu " + (g.item === "movel" && CAT[g.movel] ? "um móvel novo (" + CAT[g.movel].nome.toLowerCase() + ")" : def.art) + " pra " + nomeEu9());
    setTimeout(() => verBilhete(id), 1100);
  });
}
function verBilhete(id){
  const g = presentes[id]; if (!g) return;
  const def = presenteDef(g);
  openPanel("presenteAberto", def.ic + " Presente de " + nomeDe(g.de), corpo => {
    const b = el("div", "bilhete9", g.bilhete ? String(g.bilhete).slice(0, 140) : "(sem bilhete, mas com muito carinho)");
    corpo.append(el("p", "muted", (g.item === "movel" && CAT[g.movel] ? CAT[g.movel].nome : def.nome) + " · " + quando(g.at || srvNow())), b, btn("Fechar", "btn", closePanel));
  });
}
function openPresentes(){
  const st = { para: null, item: null, movel: null, laco: 0 };
  const cands = outrosJog();
  if (cands.length === 1) st.para = cands[0][0];
  openPanel("presentes", "Presentes 🎁", corpo => {
    const meus = el("div", "list"), hist = el("div", "list");
    const pessoas = el("div", "grid2"), itens = el("div", "itens9"), movs = el("div", "grid2"), lacos = el("div", "swatches");
    const ta = el("textarea"); ta.maxLength = 140; ta.placeholder = "Escreva um bilhetinho (só quem ganhar vai ler)"; ta.setAttribute("aria-label", "Bilhete do presente");
    const cont = el("small", "muted", "0/140"); ta.addEventListener("input", () => cont.textContent = ta.value.length + "/140");
    const total = el("p", "money"), enviar = btn("Embrulhar e deixar na casa", "btn", () => enviarPresente(st, ta.value));
    const hMov = el("h3", null, "Qual móvel?");
    corpo.append(meus, el("h3", null, "Dar um presente"), el("p", "muted", "Fica embrulhado perto da cama. Só quem ganhou pode abrir 🤫"),
      el("h3", null, "Pra quem?"), pessoas, el("h3", null, "O quê?"), itens, hMov, movs, el("h3", null, "Cor do laço"), lacos, ta, cont, total, enviar, el("h3", null, "Já abertos"), hist);
    LACOS.forEach(([n, c], i) => { const b = btn("", "swatch", () => { st.laco = i; upd(); }); b.style.background = c; b.setAttribute("aria-label", "Laço " + n); lacos.append(b); });
    let sig = null;
    const upd = () => {
      const s = JSON.stringify([st, presentes, Math.floor(me ? me.dinheiro : 0), cands.length]); if (s === sig) return; sig = s;
      meus.textContent = "";
      const mp = meusPresentes();
      if (mp.length){
        meus.append(el("h3", null, "Pra você abrir 💝"));
        for (const [id, g] of mp){ const row = el("div", "rowi"), tx = el("div", "tx"); tx.append(el("strong", null, "🎁 De " + nomeDe(g.de)), el("small", null, "Embrulhado " + ((g.andar || 0) === andarAtual ? "aqui no andar" : ondeTxt(g.andar || 0)) + " · " + quando(g.at || srvNow()))); row.append(tx, btn("Abrir", "btn small", () => irAbrir(id))); meus.append(row); }
      }
      pessoas.textContent = "";
      if (!cands.length) pessoas.append(el("p", "muted", "Chame alguém pra casa pelo botão Convidar 💌"));
      for (const [id, j] of cands){ const b = btn("", "btn ghost escolha", () => { st.para = id; upd(); }); b.append(el("strong", null, j.nome), el("small", null, j.online ? "Na casa agora" : "Fora (vai ver quando entrar)")); b.setAttribute("aria-pressed", String(st.para === id)); pessoas.append(b); }
      itens.textContent = "";
      for (const [k, d] of Object.entries(PRESENTES)){
        const b = btn("", "btn ghost", () => { st.item = k; if (k !== "movel") st.movel = null; upd(); });
        b.append(el("span", "ic", d.ic), el("span", null, d.nome), el("small", null, k === "movel" ? "móvel + $10" : "$" + d.preco)); b.title = d.txt;
        b.setAttribute("aria-pressed", String(st.item === k)); b.setAttribute("aria-label", d.nome + ", " + (k === "movel" ? "preço do móvel mais $10" : "$" + d.preco) + ". " + d.txt); itens.append(b);
      }
      hMov.hidden = movs.hidden = st.item !== "movel"; movs.textContent = "";
      if (st.item === "movel") for (const t of MOVEIS_PRESENTE){ if (!CAT[t]) continue; const b = btn("", "btn ghost escolha", () => { st.movel = t; upd(); }); b.append(el("strong", null, CAT[t].nome), el("small", null, "$" + (CAT[t].preco + 10))); b.setAttribute("aria-pressed", String(st.movel === t)); movs.append(b); }
      [...lacos.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === st.laco)));
      const pr = precoPresente(st);
      total.textContent = pr ? "Total: $" + pr + " · você tem $" + Math.floor(me ? me.dinheiro : 0) : "";
      enviar.disabled = !st.para || !st.item || (st.item === "movel" && !st.movel) || !me || me.dinheiro < pr;
      hist.textContent = "";
      const abertos = Object.entries(presentes).filter(([, g]) => g && g.aberto).sort((a, b) => b[1].aberto - a[1].aberto).slice(0, 12);
      if (!abertos.length) hist.append(el("p", "muted", "Nenhum ainda. Que tal ser o primeiro mimo?"));
      for (const [id, g] of abertos){
        const d = presenteDef(g), row = el("div", "rowi"), tx = el("div", "tx");
        tx.append(el("strong", null, d.ic + " " + (g.de === pid ? "Você" : nomeDe(g.de)) + " → " + (g.para === pid ? "você" : nomeDe(g.para))), el("small", null, (g.item === "movel" && CAT[g.movel] ? CAT[g.movel].nome : d.nome) + " · " + quando(g.aberto)));
        row.append(tx); if (g.para === pid || g.de === pid) row.append(btn("Bilhete", "btn ghost small", () => verBilhete(id))); hist.append(row);
      }
    };
    upd(); return upd;
  });
}
const precoPresente = st => !st.item ? 0 : st.item === "movel" ? (st.movel && CAT[st.movel] ? CAT[st.movel].preco + 10 : 0) : PRESENTES[st.item].preco;
function enviarPresente(st, texto){
  if (!me || !st.para || !jogadores[st.para]){ toast("Escolha pra quem é o presente."); return; }
  if (!st.item || (st.item === "movel" && !st.movel)){ toast("Escolha o presente."); return; }
  const preco = precoPresente(st);
  const pos = spotPresente(); if (!pos){ toast("Não achei um cantinho livre no chão pra deixar o presente."); return; }
  if (!gastar(preco, "o presente")) return;
  const g = { de: pid, para: st.para, item: st.item, laco: st.laco, bilhete: String(texto || "").trim().slice(0, 140), pago: preco, at: TS(), x: pos[0], y: pos[1], andar: pos[2] };
  if (st.item === "movel") g.movel = st.movel;
  ref("casa/presentes").push(g).then(() => {
    closePanel(); sfx("papel");
    toast("Presente embrulhado " + (pos[2] === andarAtual ? "perto da cama" : ondeTxt(pos[2])) + " 🎁 -$" + preco);
  }, () => { ganhar(preco); toast("Não deu pra deixar o presente agora."); });
}
function aoMudarPresentes(novo){
  const ant = presentes; presentes = novo;
  if (prCarregado && me) for (const [id, g] of Object.entries(novo)){
    if (!g) continue; const a = ant[id];
    if (!a && g.para === pid && !g.aberto){ toast("Tem um presente pra você 🎁 (de " + nomeDe(g.de) + ")"); sfx("notif"); avisar("presente", nomeDe(g.de) + " te deu um presente 🎁"); }
    if (a && !a.aberto && g.aberto){
      if (g.para !== pid && (g.andar || 0) === andarAtual) efeitoAbrir(g, false);
      if (g.de === pid && g.para !== pid) toast(nomeDe(g.para) + " abriu seu presente " + presenteDef(g).ic + " 💞");
    }
  }
  prCarregado = true; refreshPanel("presentes");
}
function vigiarPresentes(){
  if (!me || !prCarregado) return;
  if (!prAvisou){ prAvisou = true; const n = meusPresentes().length; if (n) setTimeout(() => toast(n === 1 ? "Tem um presente pra você 🎁" : "Tem " + n + " presentes pra você 🎁"), 2600); }
  const velho = srvNow() - 30 * 24 * HORA;
  for (const [id, g] of Object.entries(presentes)) if (g && g.aberto && g.aberto < velho && (g.para === pid || g.de === pid)) ref("casa/presentes/" + id).remove().catch(() => {});
  const b = $("bFamilia"), n = meusPresentes().length; let d = b && b.querySelector(".dot");
  if (b){ if (n && !d){ d = el("span", "dot"); b.append(d); } if (d){ if (n){ if (d.textContent !== String(n)) d.textContent = n; } else d.remove(); } }
}
function addPresentesObjs(objs, tm){
  prVis = [];
  const porTile = {};
  const lista = Object.entries(presentes).filter(([, g]) => g && !g.aberto && (g.andar || 0) === andarAtual).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  for (const [id, g] of lista){
    const k = g.x + "," + g.y, i = porTile[k] = (porTile[k] === undefined ? 0 : porTile[k] + 1);
    if (i > 2) continue;
    prVis.push([id, g, i]);
    const meu = g.para === pid, x = g.x * T + 2 - (i % 2), y = g.y * T + 4 - i * 6, pulo = meu && Math.floor((tm + i * 300) / 260) % 9 === 0 ? 1 : 0;
    objs.push({ z: (g.y + 1) * T - 6 + i * .01, f: () => {
      if (!i) R(g.x * T + 3, g.y * T + 15, 10, 1, "rgba(35,18,40,.25)");
      ctx.drawImage(presenteSpr(g.laco | 0, papelDe9(g)).c, x, y - pulo);
      if (meu && Math.floor(tm / 420 + i) % 5 === 0){ const sx = x + 2 + (Math.floor(tm / 420) % 3) * 3; P(sx, y - 2, "#FFFFFF"); P(sx - 1, y - 2, "#FFF0B8"); P(sx + 1, y - 2, "#FFF0B8"); P(sx, y - 3, "#FFF0B8"); P(sx, y - 1, "#FFF0B8"); }
    } });
  }
}

// =====================================================================
// 2. JANTAR À LUZ DE VELAS
// =====================================================================
const JT_CONVITE = 45000, JT_ESPERA = 75000, JT_VELAS = 3000, JT_COMER = 24000, JT_DUR = 42000, JT_XP = 20, JT_DELIVERY = 30;
// tampo (x, y, w, h a partir do topo do quadrado), pratos de cada lugar e o castiçal
// (as velas ficam nas pontas: no meio, as costas de quem senta na frente escondem tudo)
const JT_GEO = { mesa: { tb: [1, 2, 30, 24], pr: [[12, 6], [12, 17]], velas: [[5, 12], [27, 12]] }, piquenique: { tb: [2, 3, 44, 18], pr: [[12, 6], [28, 13]], velas: [[6, 9], [41, 9]] } };
const FRASES_JT = ["Que noite linda 🕯️", "Isso sim é um encontro 💕", "Dá pra repetir toda semana? 😍", "O melhor jantar da vida 🥰"];
function jantarDe(p){ return Object.entries(encontros).find(([, g]) => g && (g.estado === "convite" || g.estado === "aceito") && (g.a === p || g.b === p)) || null; }
function jtFase(g, t){ if (!g || !g.ini) return null; const d = t - g.ini; if (d < 0) return null; return { f: d < JT_VELAS ? "velas" : d < JT_COMER ? "comer" : d < JT_DUR ? "papo" : "fim", d }; }
function jantarTocando(id){ const g = encontros[id]; return !!g && g.estado === "aceito" && !!g.ini && srvNow() < g.ini + JT_DUR + 4000; }
function jtTxn(k, path, fn){ if (enTx[k] && Date.now() - enTx[k] < 5000) return Promise.resolve(false); enTx[k] = Date.now(); return txn(path, fn); }
const jtCandidatos = () => outrosJog().filter(([id, j]) => j.online && (j.andar || 0) === andarAtual && romanceOk(id));
const pratoParaDois = () => pratosOrdenados().find(([, p]) => p.porcoes >= 2) || null;
function menuJantar(id, m){
  if (!romanceOk(pid) || !JT_GEO[m.t] || !jtCandidatos().length) return [];
  return [{ nome: "Jantar à luz de velas 🕯️", info: "Convite romântico", fn: () => escolherJantar(id) }];
}
{ const base = MENU_EXTRA.mesa; MENU_EXTRA.mesa = (id, m) => (base ? base(id, m) : []).concat(menuJantar(id, m)); }
{ const base = MENU_EXTRA.piquenique; MENU_EXTRA.piquenique = (id, m) => (base ? base(id, m) : []).concat(menuJantar(id, m)); }
function escolherJantar(mov){
  if (jantarDe(pid)){ toast("Já tem um convite seu no ar 😉"); return; }
  const cands = jtCandidatos(); if (!cands.length){ toast("Não tem ninguém aqui no andar pra chamar."); return; }
  const prato = pratoParaDois();
  if (!prato && (!me || me.dinheiro < JT_DELIVERY)){ toast("Sem prato pronto e faltam $" + Math.ceil(JT_DELIVERY - (me ? me.dinheiro : 0)) + " pro delivery. Cozinhe algo antes 😉"); return; }
  const info = prato ? "Vocês vão comer " + RECEITAS[prato[1].receita].nome.toLowerCase() + " (2 porções da mesa)." : "Sem prato pronto: vem comida delivery ($" + JT_DELIVERY + ", você paga).";
  openPanel("jantar", "Jantar à luz de velas 🕯️", corpo => {
    corpo.append(el("p", "muted", "Toalha, velas e uma música só pra vocês. Quem você chama recebe o convite e decide se topa 💞"), el("p", null, info));
    const g = el("div", "grid2");
    for (const [id, j] of cands){ const b = btn("", "btn ghost escolha", () => { closePanel(); convidarJantar(id, mov); }); b.append(el("strong", null, j.nome), el("small", null, "Chamar pro jantar")); g.append(b); }
    corpo.append(g);
  });
}
function convidarJantar(outro, mov){
  const m = moveis[mov]; if (!m || !romanceOk(outro) || jantarDe(pid)) return;
  if (jantarDe(outro)){ toast(nomeDe(outro) + " está ocupado(a) agora 😉"); return; }
  const id = ref("casa/encontros").push().key;
  ref("casa/encontros/" + id).set({ a: pid, b: outro, mov, andar: andarAtual, estado: "convite", criado: srvNow() })
    .then(() => { toast("Convite enviado 🕯️ Agora é com " + nomeDe(outro) + "."); sfx("pop"); }, () => toast("Não deu pra chamar agora."));
}
function aceitarJantar(id){
  txn("casa/encontros/" + id, cur => { if (!cur || cur.estado !== "convite" || cur.b !== pid) return; cur.estado = "aceito"; cur.aceitoAt = srvNow(); return cur; })
    .then(ok => { if (!ok){ toast("Esse convite já era."); return; } irJantar(id); });
}
function recusarJantar(id){ txn("casa/encontros/" + id, cur => { if (!cur || cur.estado !== "convite") return; cur.estado = cur.a === pid ? "cancelado" : "recusado"; cur.fimAt = srvNow(); return cur; }); }
function cancelarJantar(id, motivo){
  const g = encontros[id];
  if (g && g.ini && srvNow() >= g.ini + JT_COMER){ jantarConcluir(id); return; } // já comeram: conta
  txn("casa/encontros/" + id, cur => { if (!cur || (cur.estado !== "convite" && cur.estado !== "aceito")) return; Object.assign(cur, { estado: "cancelado", motivo: motivo || "parou", quem: pid, fimAt: srvNow() }); return cur; });
}
function irJantar(id){
  const g = encontros[id]; if (!g) return;
  if (!moveis[g.mov]){ toast("A mesa ficou em outro andar."); cancelarJantar(id, "longe"); return; }
  closePanel(); closeMenu(); useFurn(g.mov, acaoJantar(id));
}
function acaoJantar(id){
  return { id: "jantar", nome: "Jantar à luz de velas 🕯️", dur: 150, ganho: {}, jt: id,
    antes: () => { const g = encontros[id]; if (!g || g.estado !== "aceito"){ toast("O jantar foi desmarcado 😕"); return false; } ref("casa/encontros/" + id + "/chegou/" + pid).set(srvNow()).catch(() => {}); return true; },
    fim: () => jantarFim(id), cancel: () => cancelarJantar(id, "parou") };
}
function ajustarAcaoJantar(){
  const a = me && me.acao; if (!a || a.id !== "jantar" || !a.def || !a.def.jt || a.jtAjust) return;
  const g = encontros[a.def.jt]; if (!g || !g.ini) return;
  a.jtAjust = 1; a.dur = Math.max(1000, g.ini + JT_DUR - srvOff - a.ini); setAcao(a);
}
function terminarJantarMeu(id){ if (me && me.acao && me.acao.id === "jantar" && me.acao.def && me.acao.def.jt === id){ me.acao.acabou = true; setAcao(null); } }
function jantarFim(id){
  const g = encontros[id];
  if (!g || !g.ini || srvNow() < g.ini + JT_DUR - 2500){ cancelarJantar(id, "tempo"); if (!g || !g.ini) toast("Não rolou dessa vez… fica pra próxima 😉"); return; }
  jantarConcluir(id);
}
const comidaTxt = k => RECEITAS[k] ? RECEITAS[k].nome.toLowerCase() : k === "delivery" ? "comida delivery" : k === "pao" ? "pão com ovo improvisado" : "";
function jantarConcluir(id){
  const g = encontros[id]; if (!g || enFeito[id] || (g.a !== pid && g.b !== pid)) return; enFeito[id] = 1;
  const path = "casa/encontros/" + id;
  txn(path + "/pago/" + pid, c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    ganharNeeds({ social: 45, diversao: 30, fome: 50, energia: 5 }); xpCasal(JT_XP);
    ref("jogadores/" + pid).update({ nuvens: srvNow() + 20 * 60000 }).catch(() => {});
    toast(FRASES_JT[Math.floor(Math.random() * FRASES_JT.length)]);
  });
  txn(path + "/contado", c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    statMais("jantares");
    const cm = comidaTxt(g.comida);
    historia("jantar_" + id, "🕯️", "Jantar à luz de velas: " + nomeDe(g.a) + " e " + nomeDe(g.b) + (cm ? " (" + cm + ")" : ""));
    ref(path).update({ estado: "fim", fimAt: srvNow() }).catch(() => {});
    voltarMusica(id);
  });
}
// música: a faixa romântica toca na mesa; no fim volta o disco que estava tocando
function musicaJantar(id){
  const g = encontros[id]; if (!g) return;
  txn("casa/musica", cur => ({ faixa: "velas", desde: srvNow(), por: pid, mov: g.mov, jantar: id, antes: cur ? (cur.jantar ? cur.antes || null : cur) : null }));
}
function voltarMusica(id){ txn("casa/musica", cur => cur && cur.jantar === id ? (cur.antes || null) : undefined); }
function servirJantar(id){
  if (enComida[id]) return; enComida[id] = 1;
  const set = k => ref("casa/encontros/" + id + "/comida").set(k).catch(() => {});
  const delivery = () => {
    if (gastar(JT_DELIVERY, "o delivery")){ set("delivery"); toast("O delivery chegou! 🛵 -$" + JT_DELIVERY); sfx("toc"); }
    else { set("pao"); toast("Sem dinheiro pro delivery: pão com ovo à luz de velas 😅"); }
  };
  const p = pratoParaDois();
  if (!p) return delivery();
  txn("casa/pratos/" + p[0], cur => { if (!cur || !(cur.porcoes >= 2)) return; if (cur.porcoes === 2) return null; cur.porcoes -= 2; return cur; })
    .then(ok => { if (ok) set(p[1].receita); else delivery(); });
}
function aoMudarEncontros(novo){
  const ant = encontros; encontros = novo;
  if (enCarregado && me) for (const [id, g] of Object.entries(encontros)){
    if (!g) continue; const a = ant[id] || null;
    if (g.b === pid && g.estado === "convite" && !a){ toast(nomeDe(g.a) + " te chamou pra um jantar à luz de velas 🕯️"); sfx("notif"); }
    if (!a || a.estado === g.estado) continue;
    if (g.a === pid && a.estado === "convite"){
      if (g.estado === "aceito"){ toast(nomeDe(g.b) + " topou 🥰"); irJantar(id); }
      else if (g.estado === "recusado") toast(nomeDe(g.b) + " agora não pode. Fica pra próxima 😉");
      else if (g.estado === "expirou") toast(nomeDe(g.b) + " não viu o convite a tempo.");
    }
    if ((g.a === pid || g.b === pid) && a.estado === "aceito"){
      if (g.estado === "cancelado"){ terminarJantarMeu(id); if (g.quem !== pid) toast("O jantar acabou antes da hora 😕"); }
      else if (g.estado === "fim"){ terminarJantarMeu(id); jantarConcluir(id); }
    }
  }
  enCarregado = true; ajustarAcaoJantar();
}
function vigiarJantar(){
  if (!me || !enCarregado) return;
  const t = srvNow();
  for (const [id, g] of Object.entries(encontros)){
    if (!g) continue;
    const meu = g.a === pid || g.b === pid, path = "casa/encontros/" + id;
    if (g.estado === "convite"){
      if (meu && t - (g.criado || 0) > JT_CONVITE) jtTxn(id + "exp", path, cur => { if (!cur || cur.estado !== "convite") return; cur.estado = "expirou"; cur.fimAt = srvNow(); return cur; });
      else if (!meu && t - (g.criado || 0) > 10 * 60000) jtTxn(id + "rm", path, () => null);
      continue;
    }
    if (g.estado === "aceito"){
      if (!meu){ if (t - (g.aceitoAt || 0) > 10 * 60000) jtTxn(id + "rm", path, () => null); continue; }
      const ch = g.chegou || {}, outro = g.a === pid ? g.b : g.a, jo = jogadores[outro];
      if (!g.ini && ch[g.a] && ch[g.b]) jtTxn(id + "ini", path + "/ini", c => c ? undefined : srvNow()).then(ok => { if (ok){ musicaJantar(id); sfx("fosforo"); } });
      else if (!g.ini && (t - (g.aceitoAt || 0) > JT_ESPERA || ((!jo || !jo.online) && t - (g.aceitoAt || 0) > 8000))) cancelarJantar(id, "demorou");
      else if (g.ini && !g.comida && g.a === pid) servirJantar(id);
      else if (g.ini && t > g.ini + JT_DUR + 20000) jantarConcluir(id);
      continue;
    }
    if (meu) terminarJantarMeu(id);
    if (t - (g.fimAt || g.criado || 0) > 120000) jtTxn(id + "rm", path, () => null);
  }
  if (musica && musica.jantar && !jantarTocando(musica.jantar)) jtTxn("mus" + musica.jantar, "casa/musica", cur => cur && cur.jantar && !jantarTocando(cur.jantar) ? (cur.antes || null) : undefined);
  ajustarAcaoJantar();
}
const comidaSpr = k => RECEITAS[k] ? pratoSprite(k) : sprite("prato9:" + k, 9, 7, (ox, oy) => {
  rbox(ox, oy + 1, 9, 6, "#FFFFFF"); R(ox + 1, oy + 5, 7, 1, "#E6DDF0");
  if (k === "delivery"){ R(ox + 2, oy + 2, 5, 3, "#F2C06A"); R(ox + 2, oy + 2, 5, 1, "#C98A3A"); P(ox + 3, oy + 3, "#D9483D"); P(ox + 5, oy + 4, "#D9483D"); P(ox + 4, oy + 3, "#FFF4E0"); }
  else if (k === "pao"){ rbox(ox + 2, oy + 2, 5, 3, "#D9A86A"); P(ox + 3, oy + 2, "#F2C48A"); R(ox + 4, oy + 3, 2, 1, "#FFF4E0"); P(ox + 4, oy + 3, "#F6D25A"); }
});
function drawJantar(m, geo, g, F, tm){
  const x = m.x * T, y = m.y * T, [tx, ty, tw, th] = geo.tb;
  const vi = "#8E3B5A", viL = "#B0567A", viD = "#6E2A45", renda = "#FFF4E0";
  // toalha cor de vinho com renda caindo na frente
  R(x + tx + 1, y + ty + 1, tw - 2, th - 2, vi); R(x + tx + 1, y + ty + 1, tw - 2, 1, viL);
  for (let i = 3; i < tw - 3; i += 6) P(x + tx + i, y + ty + 4 + (i % 4), viL);
  R(x + tx, y + ty + th - 2, tw, 3, viD); R(x + tx, y + ty + th - 2, tw, 1, vi);
  for (let i = 0; i < tw; i += 2) P(x + tx + i, y + ty + th + 1, renda);
  // pratos (vazios até a comida chegar)
  for (const [px, py] of geo.pr){
    if (g.comida) ctx.drawImage(comidaSpr(g.comida).c, x + px - 1, y + py - 1);
    else { rbox(x + px, y + py + 1, 9, 6, "#FFFFFF"); R(x + px + 2, y + py + 3, 5, 2, "#EFE8F4"); }
  }
  // dois castiçais nas pontas da mesa; as velas acendem quando os dois sentam
  const acesa = F && (F.f !== "velas" || F.d > 900);
  geo.velas.forEach(([vx, vy], i) => {
    const X = x + vx, Y = y + vy, ch = 5 - i;
    R(X - 2, Y + 5, 5, 1, C.gold); R(X - 1, Y + 6, 3, 1, "#D8963A"); P(X, Y + 4, C.gold);
    R(X, Y + 4 - ch, 2, ch, C.cream); P(X + 1, Y + 5 - ch, C.creamD); P(X, Y + 4 - ch, "#FFFFFF");
    if (acesa){ const fr = (Math.floor(tm / 140) + i) % 3, cy = Y + 3 - ch; P(X, cy, "#FFE08A"); P(X + 1, cy, "#F6A04A"); P(X + (fr === 1 ? 1 : 0), cy - 1, "#FFF4C8"); if (fr !== 2) P(X, cy - 2, "#FFE08A"); }
  });
  // pétalas de rosa na toalha
  for (const [a, b] of [[4, 9], [tw - 6, 7], [7, th - 6], [tw - 9, th - 8]]) P(x + tx + a, y + ty + b, "#F49AAE");
}
function addJantarObjs(objs, tm){
  const t = srvNow();
  for (const g of Object.values(encontros)){
    if (!g || g.estado !== "aceito") continue;
    const m = moveis[g.mov], geo = m && JT_GEO[m.t]; if (!geo) continue;
    const F = jtFase(g, t); if (F && F.f === "fim") continue;
    if (!F && !Object.keys(g.chegou || {}).length) continue;
    objs.push({ z: (m.y + CAT[m.t].h) * T - .6, f: () => drawJantar(m, geo, g, F, tm) });
    if (F){
      const k = F.f === "velas" ? F.d / JT_VELAS : 1, fl = .85 + .15 * ((Math.floor(tm / 150) % 3) / 2);
      escurecer(objs, comodo(m.x, m.y), .3 * k, geo.velas.map(([vx, vy]) => [m.x * T + vx + 1, m.y * T + vy, 30, "255,170,90", (F.d > 900 ? .55 : 0) * fl]));
    }
  }
}

// =====================================================================
// 3. CINEMA EM CASA
// =====================================================================
const CN_DUR = 75000, CN_INI = 1500;
const REACOES = { rir: "😂", susto: "😱", abraco: "🥰", own: "🥰", chorar: "😢", uau: "🤩", viva: "🎉" };
const GENEROS = {
  comedia: { nome: "Comédia", ic: "😂", titulos: ["O Pato que Sabia Demais", "Sogra em Apuros 3", "Meu Vizinho é um Sofá", "Férias no Brejo", "Quem Comeu Meu Pudim?"],
    mom: [[12, 17, "rir"], [30, 34, "rir"], [48, 54, "rir"], [64, 69, "rir"]] },
  romance: { nome: "Romance", ic: "💕", titulos: ["Amor em Pixel", "Cartas pro Padeiro", "Dois Corações e um Guarda-chuva", "O Último Pão de Queijo", "Te Encontro na Feira"],
    mom: [[20, 26, "own"], [42, 49, "chorar"], [60, 67, "own"]] },
  terror: { nome: "Terror", ic: "👻", titulos: ["A Geladeira que Respira", "Não Abra o Armário", "O Chinelo Assombrado", "Noite na Casa da Vó", "O Wi-Fi Caiu"],
    mom: [[17, 19, "susto"], [19, 26, "abraco"], [44, 46, "susto"], [46, 53, "abraco"], [63, 65, "susto"]] },
  animacao: { nome: "Animação", ic: "🐣", titulos: ["Pipoca e a Ilha dos Gatos", "Dino Bebê", "O Rei Leitão", "Frutinhas ao Resgate", "Nuvenzinha Quer Chover"],
    mom: [[14, 18, "rir"], [30, 36, "own"], [52, 57, "rir"], [63, 68, "viva"]] },
  aventura: { nome: "Aventura", ic: "🗺️", titulos: ["Capitã Farofa e o Mapa Perdido", "Os Piratas do Rio Tietê", "Missão: Padaria", "A Lhama de Ouro", "Volta ao Mundo de Patinete"],
    mom: [[13, 17, "uau"], [30, 33, "susto"], [45, 50, "uau"], [60, 66, "viva"]] }
};
const cinemaAtivo = () => !!cinema && !!cinema.ini && srvNow() < cinema.ini + CN_DUR + 3000;
function momentoAgora(c, t){
  const G = c && GENEROS[c.genero]; if (!G) return null;
  const d = (t - c.ini) / 1000, mo = G.mom.find(([a, b]) => d >= a && d < b);
  return mo ? { tipo: mo[2], t0: c.ini + mo[0] * 1000, k: mo[0] } : null;
}
{ const base = MENU_EXTRA.tv; MENU_EXTRA.tv = (id, m) => {
  const l = base ? base(id, m) : [];
  if (cinemaAtivo() && cinema.tv === id) l.unshift({ nome: "Assistir o filme junto 🍿", info: "“" + cinema.titulo + "”", fn: irCinema });
  else l.unshift({ nome: "Cinema em casa 🎬", info: "Filme no sofá", fn: () => openCinema(id) });
  return l;
}; }
function openCinema(tvId){
  if (cinemaAtivo()){ toast((cinema.tv === tvId ? "Já tem filme passando: “" : "Já tem filme passando na outra TV: “") + cinema.titulo + "”"); return; }
  const tv = moveis[tvId]; if (!tv) return;
  if (!sofaDaTv(tv)){ toast("Coloque um sofá na frente da TV pra fazer a sessão 🛋️"); return; }
  openPanel("cinema", "Cinema em casa 🎬", corpo => {
    const fg = primeiro("fogao");
    const lab = el("label", "chkrow"), cb = el("input"), tx = el("span", null, "Com pipoca 🍿");
    cb.type = "checkbox"; cb.checked = true; tx.append(el("small", null, fg ? "Estoura no fogão antes ($3)" : "Sem fogão neste andar: pipoca comprada ($8)"));
    lab.append(cb, tx);
    corpo.append(el("p", "muted", "A luz da sala baixa, o filme passa na TV (uns 75 s) e quem sentar junto no sofá ganha diversão, social e XP do casal."), lab, el("h3", null, "Escolha o filme"));
    const g = el("div", "list");
    for (const [k, G] of Object.entries(GENEROS)){
      const titulo = G.titulos[Math.floor(Math.random() * G.titulos.length)], row = el("div", "rowi"), t2 = el("div", "tx");
      t2.append(el("strong", null, "“" + titulo + "”"), el("small", null, G.ic + " " + G.nome));
      row.append(t2, btn("▶ Ver", "btn small", () => comecarFilme(tvId, k, titulo, cb.checked))); g.append(row);
    }
    corpo.append(g);
  });
}
function comecarFilme(tvId, gen, titulo, pipoca){
  const tv = moveis[tvId], sofa = tv && sofaDaTv(tv); if (!sofa){ toast("Coloque um sofá na frente da TV 🛋️"); return; }
  closePanel();
  const vai = () => txn("casa/cinema", cur => cur && cur.ini && srvNow() < cur.ini + CN_DUR + 3000 ? undefined :
    { tv: tvId, sofa, andar: andarAtual, genero: gen, titulo, ini: srvNow() + CN_INI, por: pid, pipoca: pipoca ? 1 : 0 })
    .then(ok => { if (!ok){ toast("Alguém botou outro filme agora mesmo 🎬"); return; } setTimeout(irCinema, 60); });
  if (pipoca){
    const fg = primeiro("fogao");
    if (fg) return useFurn(fg, { id: "pipoca", nome: "Estourando pipoca 🍿", dur: 4, ganho: { fome: 8 }, antes: () => { if (!gastar(3, "o milho")) return false; sfx("pipoca"); return true; }, cancel: () => ganhar(3), fim: () => vai() });
    if (!gastar(8, "a pipoca")) return;
    toast("Pipoca comprada 🍿 -$8");
  }
  vai();
}
function irCinema(){
  const c = cinema; if (!cinemaAtivo() || !me) return;
  closePanel(); closeMenu();
  const tv = moveis[c.tv]; if (!tv){ toast("O filme está passando " + ondeTxt(c.andar || 0) + " 🎬"); return; }
  const sofa = c.sofa && moveis[c.sofa] ? c.sofa : sofaDaTv(tv); if (!sofa){ toast("Cadê o sofá? 🛋️"); return; }
  useFurn(sofa, acaoCinema(c));
}
function acaoCinema(c){
  return { id: "cinema", nome: "Cinema: “" + c.titulo + "” 🎬", dur: CN_DUR / 1000 + 5, ganho: { diversao: 30 }, tela: c.tv, cima: 1, sobre: 1, cn: c.ini,
    junto: ja => ja.id === "cinema", juntoMult: 1.4, juntoSocial: 2.5, aoJuntar: (a, oid) => toast("Vendo junto com " + nomeDe(oid) + " 🍿"),
    antes: () => { if (!cinemaAtivo() || cinema.ini !== c.ini){ toast("O filme acabou 🎬"); return false; } ref("casa/cinema/vistos/" + pid).set(srvNow()).catch(() => {}); return true; },
    fim: info => cinemaFim(c, info) };
}
function ajustarAcaoCinema(){
  const a = me && me.acao; if (!a || a.id !== "cinema" || !a.def || a.cnAjust || !cinema || cinema.ini !== a.def.cn) return;
  a.cnAjust = 1; a.dur = Math.max(3000, cinema.ini + CN_DUR - srvOff - a.ini); setAcao(a);
}
function cinemaFim(c, info){
  if (cnFeito[c.ini]) return; cnFeito[c.ini] = 1;
  const G = GENEROS[c.genero] || GENEROS.comedia;
  ganharNeeds({ diversao: 15, social: info.junto ? 20 : 4 });
  if (info.junto) xpCasal(10);
  toast(info.junto ? "Que sessão boa juntinhos! " + G.ic : "Fim do filme " + G.ic);
  // a entrada da história (chave fixa) é o "contado": quem gravar primeiro soma o contador
  const quem = Object.keys((cinema && cinema.ini === c.ini && cinema.vistos) || {}).map(nomeDe);
  historia("filme_" + c.ini, "🎬", "Sessão de cinema: “" + c.titulo + "” (" + G.nome.toLowerCase() + ")" + (quem.length > 1 ? " com " + quem.join(" e ") : ""))
    .then(ok => { if (ok) statMais("filmes"); });
}
function aoMudarCinema(c){
  const ant = cinema; cinema = c;
  if (cnCarregado && me && c && (!ant || ant.ini !== c.ini) && c.por !== pid && (c.andar || 0) !== andarAtual) toast(nomeDe(c.por) + " botou um filme " + ondeTxt(c.andar || 0) + " 🎬");
  cnCarregado = true; ajustarAcaoCinema();
}
function vigiarCinema(){
  if (!me || !cinema || !cinema.ini) return;
  const c = cinema, t = srvNow();
  const vendo = Object.entries(jogadores).some(([k, j]) => { const a = k === pid ? me.acao : j.online && j.acao; return a && a.id === "cinema" && Date.now() - (a.ini || 0) < (a.dur || 0) + 3000; });
  if (t > c.ini + CN_DUR + 8000 || (!vendo && t > c.ini + 15000 && (c.por === pid || t > c.ini + 30000))) jtTxn("cn" + c.ini, "casa/cinema", cur => cur && cur.ini === c.ini ? null : undefined);
  ajustarAcaoCinema();
}
const baldeSpr = () => sprite("balde9", 6, 8, (ox, oy) => {
  R(ox + 1, oy, 4, 1, "#FFF8EC"); R(ox, oy + 1, 6, 2, "#FFF4D0"); P(ox + 1, oy + 1, "#FFFFFF"); P(ox + 4, oy + 1, "#F6D25A"); P(ox + 2, oy + 2, "#F6D25A"); P(ox + 3, oy, "#FFFFFF");
  for (let j = 0; j < 5; j++){ const w = j < 3 ? 6 : 6 - (j - 2), x0 = ox + Math.floor((6 - w) / 2); R(x0, oy + 3 + j, w, 1, "#E8445E"); P(x0 + 1, oy + 3 + j, "#FFFFFF"); if (w > 4) P(x0 + 4, oy + 3 + j, "#FFFFFF"); }
});
// cenas em pixel na tela da TV, conforme o gênero e o momento do filme
function drawFilme(c, m, tm){
  const sx = m.x * T + 5, sy = m.y * T - 7, t = srvNow(), d = t - c.ini, mo = momentoAgora(c, t), ink = "#1A1626";
  clipRect(sx, sy, 22, 10, () => {
    if (d < 3000){ // contagem do rolo de filme
      R(sx, sy, 22, 10, "#2A2438"); const n = clamp(3 - Math.floor(Math.max(0, d) / 1000), 1, 3), cx = sx + 11, cy = sy + 5, a = (d / 1000) * Math.PI * 2;
      for (let i = 0; i < 16; i++){ const an = i / 16 * Math.PI * 2; P(Math.round(cx + Math.cos(an) * 4.4), Math.round(cy + Math.sin(an) * 4.4), "#8D86A8"); }
      for (let r = 1; r < 4; r++) P(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), "#5A5370");
      txt3(String(n), cx - 1, cy - 2, "#FFFFFF"); return;
    }
    if (d > CN_DUR - 4000){ R(sx, sy, 22, 10, ink); txt3("FIM", sx + 5, sy + 3, "#F6C667"); return; }
    ({ comedia: cenaComedia, romance: cenaRomance, terror: cenaTerror, animacao: cenaAnimacao, aventura: cenaAventura }[c.genero] || cenaComedia)(sx, sy, d, mo, t, tm);
  });
}
function cenaComedia(sx, sy, d, mo){
  R(sx, sy, 22, 7, "#9FD3F2"); R(sx, sy + 7, 22, 3, "#7FC27A"); R(sx, sy + 7, 22, 1, "#9AD67E"); R(sx + 2, sy + 2, 4, 1, "#FFFFFF"); P(sx + 3, sy + 1, "#FFFFFF"); R(sx + 15, sy + 1, 3, 1, "#FFFFFF");
  const am = "#F6D25A", la = "#E8735F", ink = "#2E2638";
  if (mo && mo.tipo === "rir"){ // escorregou na casca de banana: de pernas pro ar
    const px = sx + 9;
    R(px, sy + 6, 5, 2, am); R(px - 2, sy + 7, 2, 2, am); P(px - 3, sy + 8, la); P(px - 2, sy + 7, ink); P(px + 1, sy + 5, la); P(px + 3, sy + 4, la);
    R(px + 7, sy + 8, 3, 1, "#F6E05A"); P(px + 8, sy + 7, "#C9A43A");
    if (Math.floor(d / 200) % 2){ P(px - 1, sy + 3, "#FFE08A"); P(px + 2, sy + 2, "#FFFFFF"); P(px + 5, sy + 3, "#FFE08A"); }
    return;
  }
  const px = sx + Math.floor((d / 90) % 28) - 4, pe = Math.floor(d / 180) % 2;
  R(px, sy + 5, 4, 2, am); R(px + 3, sy + 3, 2, 2, am); P(px + 5, sy + 4, la); P(px + 4, sy + 3, ink); P(px, sy + 5, "#FCE9A0");
  P(px + 1, sy + 7, la); P(px + 2 + pe, sy + 7, la);
}
function cenaRomance(sx, sy, d, mo){
  const chuva = mo && mo.tipo === "chorar", junto = mo && mo.tipo === "own";
  R(sx, sy, 22, 3, chuva ? "#7C7AA8" : "#F4A77C"); R(sx, sy + 3, 22, 3, chuva ? "#9A98C2" : "#F7C6A0"); R(sx, sy + 6, 22, 4, chuva ? "#8B6E9A" : "#E58FB5");
  if (!chuva) R(sx + 9, sy + 4, 4, 2, "#FFE08A");
  const sep = junto ? 0 : chuva ? 5 : 2 + Math.round(1.5 + 1.5 * Math.sin(d / 1600));
  const fig = (x, c, cab) => { R(x, sy + 3, 2, 2, "#F6D2B0"); P(x, sy + 3, cab); P(x + 1, sy + 3, cab); R(x, sy + 5, 2, 3, c); P(x, sy + 8, sh(c, -.25)); };
  fig(sx + 9 - sep, "#5246B0", "#2B1D14"); fig(sx + 11 + sep, "#D9483D", "#B5651D");
  if (junto){ pixHeart(sx + 8, sy - 1 + (Math.floor(d / 300) % 2), "#E8445E"); }
  if (chuva) for (let i = 0; i < 7; i++) P(sx + (i * 7 + Math.floor(d / 90)) % 22, sy + (i * 3 + Math.floor(d / 70)) % 10, "#C4E8F8");
}
function cenaTerror(sx, sy, d, mo, t){
  const bg = "#141020", sil = "#2A2140";
  R(sx, sy, 22, 10, bg); R(sx + 17, sy + 1, 3, 3, "#F4F1FB"); P(sx + 17, sy + 1, bg);
  R(sx + 3, sy + 5, 8, 5, sil); R(sx + 4, sy + 4, 6, 1, sil); R(sx + 5, sy + 3, 4, 1, sil); R(sx + 6, sy + 2, 2, 1, sil);
  const pisca = Math.floor(d / 700) % 4 !== 0;
  P(sx + 5, sy + 6, mo && mo.tipo === "abraco" ? "#F0707A" : pisca ? "#F6C667" : "#3A3060"); P(sx + 8, sy + 6, mo && mo.tipo === "abraco" ? "#F0707A" : "#3A3060");
  R(sx + 13, sy + 6, 1, 4, "#3A2E1E"); P(sx + 12, sy + 6, "#3A2E1E"); P(sx + 14, sy + 5, "#3A2E1E"); // árvore seca
  if (d % 9000 < 140) R(sx, sy, 22, 10, "rgba(255,255,255,.55)"); // relâmpago
  if (mo && mo.tipo === "susto"){
    const dd = t - mo.t0;
    if (dd < 220){ R(sx, sy, 22, 10, "#FFFFFF"); return; }
    const fy = sy + (dd < 600 ? 3 - Math.floor(dd / 200) : 0);
    R(sx + 6, fy + 1, 10, 9, "#F4F1FB"); R(sx + 7, fy, 8, 1, "#F4F1FB"); for (let i = 0; i < 5; i++) P(sx + 6 + i * 2, fy + 10, bg);
    R(sx + 8, fy + 3, 2, 2, bg); R(sx + 12, fy + 3, 2, 2, bg); R(sx + 10, fy + 6, 2, 3, bg);
  }
}
function cenaAnimacao(sx, sy, d, mo){
  R(sx, sy, 22, 10, "#BFEFDC"); R(sx, sy + 7, 22, 3, "#5DBB7D"); R(sx + 2, sy + 6, 7, 1, "#5DBB7D"); R(sx + 13, sy + 6, 7, 1, "#5DBB7D"); R(sx + 3, sy + 5, 4, 1, "#5DBB7D");
  R(sx + 17, sy + 1, 2, 2, "#FFE08A");
  if (mo && mo.tipo === "viva"){ R(sx + 3, sy + 1, 16, 1, "#E8445E"); R(sx + 4, sy + 2, 14, 1, "#F6C667"); R(sx + 5, sy + 3, 12, 1, "#5DBB7D"); R(sx + 6, sy + 4, 10, 1, "#7FB8E8"); }
  const x = sx + 2 + Math.floor((d / 70) % 18), y = sy + 4 - Math.round(Math.abs(Math.sin(d / 260)) * 3);
  R(x, y + 1, 3, 3, "#F6D25A"); P(x + 3, y + 2, "#E8735F"); P(x + 2, y + 1, "#2E2638"); P(x, y + 1, "#FCE9A0");
  if (mo && mo.tipo === "own") pixHeart(x - 1, y - 4, "#F49AAE");
  if (mo && mo.tipo === "rir") for (let i = 0; i < 4; i++) P(sx + 3 + i * 5, sy + 1 + (i + Math.floor(d / 150)) % 4, ["#E8445E", "#7FB8E8", "#B49CF4", "#F6C667"][i]);
}
function cenaAventura(sx, sy, d, mo){
  R(sx, sy, 22, 6, "#7EC8F0"); R(sx, sy + 6, 22, 4, "#378ADD"); R(sx + 15, sy + 1, 3, 1, "#FFFFFF");
  for (let i = 0; i < 5; i++) P(sx + (i * 5 + Math.floor(d / 150)) % 22, sy + 6 + (i % 2), "#C4E8F8");
  const bx = sx + 6 + Math.round(Math.sin(d / 1500) * 4), by = sy + 5 + Math.floor(d / 400) % 2;
  R(bx, by, 6, 2, "#8C5E3A"); R(bx + 1, by + 2, 4, 1, "#6B4429"); R(bx + 3, by - 4, 1, 4, "#5E4430"); R(bx + 4, by - 4, 2, 3, "#FFFFFF"); P(bx + 4, by - 4, "#E8445E");
  if (mo && mo.tipo === "susto"){ const fx = bx + 9; P(fx, sy + 4, "#8D9BAA"); R(fx - 1, sy + 5, 3, 1, "#8D9BAA"); }
  if (mo && mo.tipo === "uau"){ R(sx + 16, sy + 7, 4, 2, "#C9965E"); R(sx + 16, sy + 7, 4, 1, C.gold); if (Math.floor(d / 160) % 2){ P(sx + 15, sy + 5, "#FFE08A"); P(sx + 20, sy + 6, "#FFFFFF"); } }
  if (mo && mo.tipo === "viva") for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2, r = 1 + (Math.floor(d / 120) % 3); P(Math.round(sx + 15 + Math.cos(a) * r), Math.round(sy + 2 + Math.sin(a) * r), ["#F6C667", "#E8445E", "#FFFFFF"][i % 3]); }
}
function addCinemaObjs(objs, tm){
  const c = cinema; if (!cinemaAtivo() || (c.andar || 0) !== andarAtual) return;
  const tv = moveis[c.tv]; if (!tv) return;
  const d = srvNow() - c.ini, k = clamp(Math.min((d + CN_INI) / 2000, (CN_DUR + 3000 - d) / 3000), 0, 1);
  escurecer(objs, comodo(tv.x, tv.y), .4 * k, [[tv.x * T + 16, tv.y * T - 2, 40, "140,190,255", .45 * k * (.85 + .15 * Math.sin(tm / 170))]], 1e9 - 1);
  objs.push({ z: 1e9 - .5, f: () => drawFilme(c, tv, tm) }); // a tela fica acesa por cima do escuro
  const sofa = c.sofa && moveis[c.sofa];
  if (c.pipoca && sofa) objs.push({ z: (sofa.y + 1) * T + .5, f: () => ctx.drawImage(baldeSpr().c, sofa.x * T + 24 - 4, sofa.y * T + 4) });
}

// pose de quem janta ou assiste: conversa corada no jantar; reações no sofá (rir, susto, abraço, choro, comemorar)
function leva9Pose(id, aid, acao, m0, tm, cx, by, pisca){
  if (aid === "jantar" && m0){
    pos9[id] = { cx, by };
    const e = jantarDe(id), g = e && e[1], F = g && jtFase(g, srvNow());
    if (!F || F.f === "velas" || !g.comida) return { pose: "sit" + (pisca ? "blink" : ""), frame: 0 };
    if (F.f === "papo") return { pose: "sitblush" + (pisca ? "blink" : ""), frame: 0 };
    return null;
  }
  if (aid !== "cinema" || !m0 || !cinemaAtivo()) return null;
  const c = cinema, mo = momentoAgora(c, srvNow()), meio = (m0.x + CAT[m0.t].w / 2) * T, lado = cx < meio ? 1 : -1;
  let dx = 0, dy = 0, pose = c.pipoca ? "siteat" : "sit" + (pisca ? "blink" : ""), frame = c.pipoca ? (Math.floor((tm + id.charCodeAt(1) * 211) / 650) % 3 === 2 ? 1 : 0) : 0;
  if (mo){
    const dd = srvNow() - mo.t0; frame = 0; pose = "sit";
    if (mo.tipo === "rir") dy = Math.floor(tm / 110) % 2 ? -1 : 0;
    else if (mo.tipo === "susto"){ dy = dd < 450 ? -3 : -1; if (dd < 450) pose = "sitarms"; }
    else if (mo.tipo === "abraco"){ dx = lado * 4; pose = "sitblush"; }
    else if (mo.tipo === "own"){ dx = lado * 2; pose = "sitblush"; }
    else if (mo.tipo === "chorar") dy = Math.floor(tm / 500) % 2 ? -1 : 0;
    else if (mo.tipo === "uau") dy = -1;
    else if (mo.tipo === "viva"){ pose = "sitarms"; dy = Math.floor(tm / 200) % 2 ? -1 : 0; }
  }
  pos9[id] = { cx: cx + dx, by: by + dy, emo: mo ? REACOES[mo.tipo] : null };
  return { dx, dy, pose, frame };
}

// =====================================================================
// 4. ÁLBUM DE FOTOS
// =====================================================================
const ALBUM_MAX = 60, FOTO_MAX_CH = 90000;
const fotoSrc = new Map(), fotoPend = new Map(), fotoMini = new Map();
const fotoOk = v => typeof v === "string" && v.length < 200000 && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v);
function carregarFoto(id){
  if (fotoSrc.has(id)) return Promise.resolve(fotoSrc.get(id));
  if (fotoPend.has(id)) return fotoPend.get(id);
  const p = ref("casa/albumImg/" + id).once("value").then(s => { fotoPend.delete(id); const v = s.val(); if (!fotoOk(v)) return null; fotoSrc.set(id, v); return v; }, () => { fotoPend.delete(id); return null; });
  fotoPend.set(id, p); return p;
}
const fotosOrdem = () => Object.entries(album).filter(([, a]) => a).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
// miniaturas de 4x3 pro mural de fotos da parede (tiradas da imagem, reduzidas)
function prepararMinis(){
  if (!Object.values(decor).some(d => d && d.t === "muralFotos")) return;
  for (const [id] of fotosOrdem().slice(0, 3)){
    if (fotoMini.has(id)) continue; fotoMini.set(id, null);
    carregarFoto(id).then(src => {
      if (!src){ fotoMini.delete(id); return; }
      const im = new Image(); im.onload = () => {
        const c = document.createElement("canvas"); c.width = 4; c.height = 3; const x = c.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
        x.drawImage(im, 5, 5, im.width - 10, im.height - 20, 0, 0, 4, 3); fotoMini.set(id, c); muralChave9(); // o mural da parede é sprite: a chave muda e ele redesenha
      };
      im.src = src;
    });
  }
}
function tirarFoto(){
  if (!me) return;
  if (mode !== "live"){ toast("Volte pro modo Viver pra tirar foto 📸"); return; }
  try { draw(performance.now()); } catch(e){}
  const w = lo.width, h = lo.height, pad = 5, base = 13;
  const c = document.createElement("canvas"); c.width = w + pad * 2; c.height = h + pad + base;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = false;
  withCtx(x, 1, () => {
    R(0, 0, c.width, c.height, "#FFF8EC"); R(0, c.height - 1, c.width, 1, "#E9D8BE"); R(c.width - 1, 0, 1, c.height, "#E9D8BE");
    ctx.drawImage(lo, pad, pad); R(pad, pad + h, w, 1, "#E9D8BE");
    const d = new Date(srvNow());
    txt3(pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear(), pad + 1, h + pad + 4, "#8C7A9A");
    pixHeart(c.width - pad - 6, h + pad + 4, "#E8607A");
  });
  const f = el("div", "flash9"); $("stage").append(f); setTimeout(() => f.remove(), 500);
  sfx("foto");
  const url = codificarFoto(c);
  if (!url){ toast("A foto ficou pesada demais 😅 Tente de novo."); return; }
  openFotoNova(url, c.width, c.height);
}
function codificarFoto(c){
  const u = c.toDataURL("image/png"); if (u.length <= 60000) return u;
  for (const [tipo, q] of [["image/webp", .9], ["image/webp", .8], ["image/jpeg", .85], ["image/jpeg", .7], ["image/jpeg", .55]]){
    const v = c.toDataURL(tipo, q); if (v.indexOf("data:" + tipo) === 0 && v.length <= FOTO_MAX_CH) return v;
  }
  return null;
}
function imgFoto(src, cls){ const im = el("img", cls); im.alt = ""; im.decoding = "async"; if (src) im.src = src; return im; }
function openFotoNova(url, w, h){
  openPanel("fotoNova", "Foto nova 📸", corpo => {
    const inp = el("input"); inp.type = "text"; inp.maxLength = 80; inp.placeholder = "Legenda (opcional)"; inp.setAttribute("aria-label", "Legenda da foto");
    const bb = el("div", "hbtns"), guarda = btn("Guardar no álbum", "btn", () => { guarda.disabled = true; guardarFoto(url, w, h, inp.value); });
    bb.append(guarda, btn("Descartar", "btn ghost", closePanel));
    corpo.append(imgFoto(url, "foto9"), inp, bb, el("p", "muted", "Fica no álbum da casa, pra todo mundo ver. Até " + ALBUM_MAX + " fotos."));
  });
}
function guardarFoto(url, w, h, legenda, apagar){
  legenda = String(legenda || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const lista = fotosOrdem();
  if (lista.length >= ALBUM_MAX && !apagar){
    const velha = lista[lista.length - 1];
    openPanel("fotoNova", "Álbum cheio 📸", corpo => {
      const bb = el("div", "hbtns");
      bb.append(btn("Apagar a mais antiga e guardar", "btn", () => guardarFoto(url, w, h, legenda, velha[0])), btn("Cancelar", "btn ghost", closePanel));
      corpo.append(el("p", null, "O álbum já tem " + lista.length + " fotos. Pra guardar essa, dá pra apagar a mais antiga (de " + (velha[1].autor === pid ? "você" : velha[1].nome || "alguém") + ", " + quando(velha[1].at || 0) + ")."), bb);
    });
    return;
  }
  const id = ref("casa/album").push().key, meta = { autor: pid, nome: nomeEu9(), at: TS(), legenda, andar: andarAtual, w, h };
  const up = { ["album/" + id]: meta, ["albumImg/" + id]: url };
  if (apagar){ up["album/" + apagar] = null; up["albumImg/" + apagar] = null; }
  ref("casa").update(up).then(() => {
    fotoSrc.set(id, url); closePanel(); toast("Foto guardada no álbum 📸"); statMais("fotos");
    historia("foto_" + id, "📸", legenda ? "Foto: " + legenda : nomeEu9() + " tirou uma foto da casa", { foto: id, por: pid });
  }, () => toast("Não deu pra guardar a foto agora."));
}
function openAlbum(){
  openPanel("album", "Álbum de fotos 📸", corpo => {
    const topo = el("div", "hbtns"), conta = el("p", "muted"), grade = el("div", "album9");
    topo.append(btn("📸 Tirar uma foto agora", "btn", () => { closePanel(); tirarFoto(); }));
    corpo.append(topo, conta, grade);
    let sig = null;
    const upd = () => {
      const lista = fotosOrdem(), s = JSON.stringify(lista.map(([id, a]) => [id, a.legenda]));
      conta.textContent = lista.length ? lista.length + "/" + ALBUM_MAX + " fotos · toque pra ver grande" : "Nenhuma foto ainda. Tire a primeira pelo botão 📸 no canto da casa!";
      if (s === sig) return; sig = s; grade.textContent = "";
      for (const [id, a] of lista){
        const b = btn("", null, () => openFoto(id)), im = imgFoto(fotoSrc.get(id), null);
        b.setAttribute("aria-label", "Foto " + (a.legenda || "sem legenda") + ", de " + (a.nome || "alguém"));
        if (!fotoSrc.has(id)) carregarFoto(id).then(src => { if (src) im.src = src; });
        b.append(im, el("span", null, a.legenda || quando(a.at || 0))); grade.append(b);
      }
    };
    upd(); return upd;
  });
}
function openFoto(id){
  const a0 = album[id]; if (!a0) return;
  openPanel("foto", "Foto 📸", corpo => {
    const im = imgFoto(fotoSrc.get(id), "foto9"), meta = el("p", "muted"), leg = el("p"), inp = el("input");
    if (!fotoSrc.has(id)) carregarFoto(id).then(src => { if (src) im.src = src; });
    leg.style.fontWeight = "800"; inp.type = "text"; inp.maxLength = 80; inp.placeholder = "Escreva uma legenda"; inp.setAttribute("aria-label", "Legenda da foto"); inp.value = a0.legenda || "";
    const bb = el("div", "hbtns");
    bb.append(btn("Salvar legenda", "btn ghost", () => { const v = inp.value.replace(/\s+/g, " ").trim().slice(0, 80); ref("casa/album/" + id + "/legenda").set(v).then(() => toast("Legenda salva."), () => toast("Não deu pra salvar.")); }));
    if (a0.autor === pid){
      const del = btn("Apagar foto", "btn ghost"); let certo = false;
      del.onclick = () => { if (!certo){ certo = true; del.textContent = "Certeza? Toque de novo"; setTimeout(() => { certo = false; del.textContent = "Apagar foto"; }, 3000); return; }
        ref("casa").update({ ["album/" + id]: null, ["albumImg/" + id]: null }).then(() => { fotoSrc.delete(id); fotoMini.delete(id); toast("Foto apagada."); openAlbum(); }); };
      bb.append(del);
    }
    bb.append(btn("Voltar ao álbum", "btn ghost", openAlbum));
    corpo.append(im, leg, meta, inp, bb);
    const upd = () => { const a = album[id]; if (!a){ closePanel(); return; } leg.textContent = a.legenda || ""; leg.hidden = !a.legenda; meta.textContent = "Por " + (a.autor === pid ? "você" : a.nome || "alguém") + " · " + quando(a.at || 0) + ((a.andar || 0) ? " · 2º andar" : ""); };
    upd(); return upd;
  });
}

// =====================================================================
// 5. DATAS ESPECIAIS
// =====================================================================
const DATA_TIPOS = { namoro: { nome: "Namoro", emoji: "💕" }, niver: { nome: "Aniversário", emoji: "🎂" }, outra: { nome: "Outra data", emoji: "✨" } };
const EMOJIS_DATA = ["✨", "🎉", "💍", "🏡", "✈️", "🐶", "🌹", "⭐"];
const diasNoMes = (y, m) => new Date(y, m, 0).getDate();
function hojeLocal(){ const d = new Date(srvNow()); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function proximaVez(dt){
  const h = hojeLocal(), y = h.getFullYear(), mk = yy => new Date(yy, dt.m - 1, Math.min(dt.d, diasNoMes(yy, dt.m)));
  let a = mk(y); if (a < h) a = mk(y + 1);
  return { data: a, dias: Math.round((a - h) / 864e5) };
}
const emojiData = dt => dt.emoji || (DATA_TIPOS[dt.tipo] || DATA_TIPOS.outra).emoji;
function quemData(dt){ return dt.quem && jogadores[dt.quem] ? (dt.quem === pid ? null : nomeDe(dt.quem)) : (dt.nome || "alguém"); }
function msgFalta(dt, dias){
  const pro = dt.tipo === "namoro" ? "pro nosso aniversário" : dt.tipo === "niver" ? (dt.quem === pid ? "pro seu aniversário" : "pro aniversário de " + quemData(dt)) : "até “" + (dt.nome || "a data") + "”";
  return (dias === 1 ? "Falta 1 dia " : "Faltam " + dias + " dias ") + pro + " " + emojiData(dt);
}
function tempoJuntos(dt){
  if (!dt.a) return "";
  const h = hojeLocal(); let meses = (h.getFullYear() - dt.a) * 12 + (h.getMonth() - (dt.m - 1)) - (h.getDate() < dt.d ? 1 : 0);
  if (meses < 0) return ""; const an = Math.floor(meses / 12), me2 = meses % 12;
  return (an ? an + (an === 1 ? " ano" : " anos") : "") + (an && me2 ? " e " : "") + (me2 || !an ? me2 + (me2 === 1 ? " mês" : " meses") : "") + " juntos";
}
function msgHoje(dt){
  if (dt.tipo === "namoro"){ const an = dt.a ? hojeLocal().getFullYear() - dt.a : 0; return "Hoje é o nosso aniversário de namoro! " + (an >= 1 ? an + (an === 1 ? " ano" : " anos") + " juntos " : "") + "💕"; }
  if (dt.tipo === "niver") return dt.quem === pid ? "Hoje é o seu aniversário! Parabéns 🎂" : "Hoje é o aniversário de " + quemData(dt) + "! 🎂";
  return "Hoje é dia de “" + (dt.nome || "data especial") + "”! " + emojiData(dt);
}
function msgData(dt){ const pv = proximaVez(dt); return pv.dias === 0 ? msgHoje(dt) : msgFalta(dt, pv.dias); }
function proximaDataTxt(){
  const l = Object.values(datas).filter(Boolean).map(dt => [dt, proximaVez(dt).dias]).sort((a, b) => a[1] - b[1]);
  return l.length ? msgData(l[0][0]) : "";
}
function openDatas(){
  const st = { tipo: "namoro", quem: null, emoji: EMOJIS_DATA[0] };
  openPanel("datas", "Datas especiais 📅", corpo => {
    const lista = el("div", "list"), tipos = el("div", "seg9"), quem = el("div", "grid2"), nome = el("input"), emos = el("div", "swatches emo9"), dia = el("input"), lDia = el("label", "lbl", "Data");
    nome.type = "text"; nome.maxLength = 30; nome.placeholder = "Nome da data (ex.: Viagem pra praia)"; nome.setAttribute("aria-label", "Nome da data");
    dia.type = "date"; dia.id = "data9"; lDia.htmlFor = "data9"; dia.min = "1900-01-01"; dia.max = "2100-12-31";
    const salvar = btn("Guardar data", "btn", () => guardarData(st, nome.value, dia.value));
    corpo.append(lista, el("h3", null, "Nova data"), tipos, quem, nome, emos, lDia, dia, salvar);
    for (const [k, d] of Object.entries(DATA_TIPOS)){ const b = btn(d.emoji + " " + d.nome, "btn ghost", () => { st.tipo = k; desenha(); }); b.dataset.k = k; tipos.append(b); }
    EMOJIS_DATA.forEach(e => { const b = btn(e, "btn ghost", () => { st.emoji = e; desenha(); }); b.setAttribute("aria-label", "Emoji " + e); emos.append(b); });
    const desenha = () => {
      for (const b of tipos.children) b.setAttribute("aria-pressed", String(b.dataset.k === st.tipo));
      for (const b of emos.children) b.setAttribute("aria-pressed", String(b.textContent === st.emoji));
      quem.hidden = st.tipo !== "niver"; emos.hidden = st.tipo !== "outra"; nome.hidden = st.tipo === "namoro" || (st.tipo === "niver" && !!st.quem);
      nome.placeholder = st.tipo === "niver" ? "De quem? (nome)" : "Nome da data (ex.: Viagem pra praia)";
      quem.textContent = "";
      if (st.tipo === "niver"){
        for (const [id, j] of Object.entries(jogadores).filter(([, j]) => j && j.nome)){ const b = btn("", "btn ghost escolha", () => { st.quem = id; desenha(); }); b.append(el("strong", null, id === pid ? "Eu" : j.nome), el("small", null, "Aniversário")); b.setAttribute("aria-pressed", String(st.quem === id)); quem.append(b); }
        const o = btn("", "btn ghost escolha", () => { st.quem = null; desenha(); }); o.append(el("strong", null, "Outra pessoa"), el("small", null, "Escreva o nome")); o.setAttribute("aria-pressed", String(!st.quem)); quem.append(o);
      }
      lDia.textContent = st.tipo === "namoro" ? "Quando começaram a namorar" : st.tipo === "niver" ? "Data de nascimento" : "Data";
    };
    desenha();
    let sig = null;
    const upd = () => {
      const s = JSON.stringify(datas) + hoje(); if (s === sig) return; sig = s; lista.textContent = "";
      const l = Object.entries(datas).filter(([, d]) => d).map(([id, d]) => [id, d, proximaVez(d)]).sort((a, b) => a[2].dias - b[2].dias);
      if (!l.length) lista.append(el("p", "muted", "Cadastre o aniversário de namoro, os aniversários de cada um e outras datas. A casa avisa quando estiver chegando e faz festa no dia 🎉"));
      for (const [id, d, pv] of l){
        const row = el("div", "rowi" + (pv.dias === 0 ? " hoje9" : "")), tx = el("div", "tx");
        const tit = d.tipo === "namoro" ? "Aniversário de namoro" : d.tipo === "niver" ? "Aniversário " + (d.quem === pid ? "seu" : "de " + quemData(d)) : d.nome || "Data especial";
        tx.append(el("strong", null, emojiData(d) + " " + tit), el("small", null, msgData(d)), el("small", null, pad2(d.d) + "/" + pad2(d.m) + (d.a ? "/" + d.a : "") + (d.tipo === "namoro" && tempoJuntos(d) ? " · " + tempoJuntos(d) + " 💕" : "")));
        const del = btn("Apagar", "btn ghost small"); let certo = false;
        del.onclick = () => { if (!certo){ certo = true; del.textContent = "Certeza?"; setTimeout(() => { certo = false; del.textContent = "Apagar"; }, 3000); return; } ref("casa/datas/" + id).remove().then(() => toast("Data apagada.")); };
        row.append(tx, del); lista.append(row);
      }
    };
    upd(); return upd;
  });
}
function guardarData(st, nome, valor){
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor || ""));
  if (!mt){ toast("Escolha a data."); return; }
  const a = +mt[1], m = +mt[2], d = +mt[3];
  if (a < 1900 || a > 2100 || m < 1 || m > 12 || d < 1 || d > diasNoMes(a, m)){ toast("Essa data não existe 🤔"); return; }
  nome = String(nome || "").replace(/\s+/g, " ").trim().slice(0, 30);
  if (st.tipo === "outra" && !nome){ toast("Dê um nome pra data."); return; }
  if (st.tipo === "niver" && !st.quem && !nome){ toast("De quem é o aniversário?"); return; }
  const dt = { tipo: st.tipo, d, m, a, por: pid, at: TS(), emoji: st.tipo === "outra" ? st.emoji : DATA_TIPOS[st.tipo].emoji };
  if (st.tipo === "niver" && st.quem) dt.quem = st.quem; else if (st.tipo !== "namoro") dt.nome = nome;
  ref("casa/datas").push(dt).then(() => { toast("Data guardada " + dt.emoji); }, () => toast("Não deu pra guardar a data."));
}
function vigiarDatas(){
  if (!me || !dtCarregadas) return;
  const hj = hoje(); festaHoje = [];
  for (const [id, dt] of Object.entries(datas)){
    if (!dt) continue; const pv = proximaVez(dt);
    if (pv.dias === 0){
      festaHoje.push([id, dt]);
      const k = "casinha-festa-" + sala + "-" + id + "-" + hj;
      if (!store.get(k)){ store.set(k, "1"); festejar(id, dt); }
    } else if (pv.dias <= 3){
      const k = "casinha-falta-" + sala + "-" + id + "-" + hj;
      if (!store.get(k)){ store.set(k, "1"); setTimeout(() => toast(msgFalta(dt, pv.dias)), 3500); }
    }
  }
}
function festejar(id, dt){
  confete(); setTimeout(confete, 900);
  toastEspecial("Dia especial! " + emojiData(dt), msgHoje(dt));
  txn("casa/festas/" + hoje() + "_" + id + "/" + pid, c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return; ganhar(25); ganharNeeds({ diversao: 20, social: 20 }); xpCasal(5);
    setTimeout(() => toast("Presente do dia especial: +$25 🎉"), 4800);
  });
  historia("data_" + id + "_" + hojeLocal().getFullYear(), emojiData(dt), msgHoje(dt));
  // limpa os bônus de dias que já passaram
  ref("casa/festas").once("value").then(s => { const corte = dataDe(srvNow() - 7 * 24 * HORA); s.forEach(f => { if (f.key.slice(0, 10) < corte) f.ref.remove().catch(() => {}); }); }).catch(() => {});
}
const boloFestaSpr = () => sprite("bolo9", 12, 11, (ox, oy) => {
  R(ox, oy + 9, 12, 2, "#F4F1FA"); R(ox + 1, oy + 10, 10, 1, "#C9BFD8");
  rbox(ox + 1, oy + 4, 10, 6, "#F9C9D6"); R(ox + 1, oy + 4, 10, 2, "#FFFFFF"); P(ox + 3, oy + 6, "#FFFFFF"); P(ox + 7, oy + 6, "#FFFFFF"); R(ox + 1, oy + 7, 10, 1, "#E8607A");
  P(ox + 5, oy + 8, "#E8445E"); P(ox + 9, oy + 8, "#7FB8E8");
  R(ox + 3, oy + 1, 1, 3, "#7FB8E8"); R(ox + 6, oy + 1, 1, 3, "#F6C667"); R(ox + 9, oy + 1, 1, 3, "#B49CF4");
});
function addFestaObjs(objs, tm){
  if (!festaHoje.length) return;
  const cores = ["#E8445E", "#F6C667", "#7FD1B2", "#7FB8E8", "#B49CF4"];
  objs.push({ z: -1, f: () => { // bandeirinhas na parede de cima da casa
    for (let px = 17; px < W * T - 17; px++){ const yy = 3 + Math.round(2 * Math.sin(((px - 17) % 34) / 34 * Math.PI)); P(px, yy, "#8C5E3A"); }
    for (let px = 19, i = 0; px < W * T - 21; px += 6, i++){
      const yy = 4 + Math.round(2 * Math.sin(((px - 17) % 34) / 34 * Math.PI)), c = cores[i % cores.length];
      R(px, yy, 4, 1, c); R(px, yy + 1, 4, 1, c); R(px + 1, yy + 2, 2, 1, c); P(px + 1, yy + 3, sh(c, -.2)); P(px, yy, sh(c, .35));
    }
  } });
  objs.push({ z: 14, f: () => { // balões nos cantos da sala
    for (const [bx, i] of [[8 * T + 3, 0], [8 * T + 9, 1], [W * T - 22, 2], [W * T - 16, 3]]){
      const by = 2 + (i % 2) * 2 + Math.round(Math.sin(tm / 700 + i)), c = cores[(i + 1) % cores.length];
      R(bx + 2, by + 7, 1, 7, "#E9D8BE"); rbox(bx, by, 5, 6, c); P(bx + 1, by + 1, sh(c, .5)); P(bx + 2, by + 6, sh(c, -.25));
    }
  } });
  const mesa = mesaPrincipal();
  if (mesa && !Object.values(encontros).some(g => g && g.estado === "aceito" && g.mov === primeiro("mesa"))){
    const x = mesa.x * T + 10, y = mesa.y * T + 7;
    objs.push({ z: (mesa.y + 2) * T - .45, f: () => {
      ctx.drawImage(boloFestaSpr().c, x - 1, y - 1);
      for (const [cx, i] of [[x + 3, 0], [x + 6, 1], [x + 9, 2]]){ const fr = (Math.floor(tm / 160) + i) % 2; P(cx, y, "#FFE08A"); if (fr) P(cx, y - 1, "#F6A04A"); }
    } });
  }
}

// =====================================================================
// 6. NOSSA HISTÓRIA (linha do tempo)
// =====================================================================
const TXT_CONQ = { namoro1: ["💕", "Uma noite especial"], namoro10: ["💕", "Dez momentos especiais a dois"], namoroLugar: ["💕", "Momentos especiais pela casa toda"],
  danca1: ["💃", "A primeira dança"], beijo1: ["😘", "O primeiro beijinho na casa nova"], noite1: ["🌙", "A primeira noite de conchinha"], papais: ["👶", "Viraram papais de primeira viagem"],
  quintal: ["🌳", "Compraram o quintal"], andar2: ["🏠", "Construíram o 2º andar"], jantar1: ["🕯️", "O primeiro jantar à luz de velas"], mimo1: ["🎁", "O primeiro presente"], cinema1: ["🎬", "A primeira sessão de cinema em casa"], foto1: ["📸", "A primeira foto do álbum"] };
function historiaConq(c, at){ const t = TXT_CONQ[c.id] || ["🏆", "Conquista: " + c.nome]; historia("conq_" + c.id, t[0], t[1], { at: at || srvNow() }); }
function historiaConquistas(novo){
  const ant = conq9; conq9 = novo;
  if (!ant || !me) return;
  for (const c of CONQUISTAS){ const v = novo[c.id]; if (v && !ant[c.id] && v.por === pid) historiaConq(c, v.at); }
}
function historiaNivel(xp){
  const n = nivelDe(xp);
  if (nivel9 != null && me && n > nivel9) for (let k = Math.max(2, nivel9 + 1); k <= n; k++) historia("nivel_" + k, "♥", "Chegaram ao nível " + k + " do casal");
  nivel9 = n;
}
function historiaBebe(b){
  if (!b || !b.nasceu || !me) return;
  const tx = b.nome ? "Nasceu " + String(b.nome).slice(0, 20) + ", o bebê da casa" : "Nasceu o bebê da casa", sig = b.nasceu + tx;
  if (sig === bebeSig9) return; bebeSig9 = sig;
  txn("casa/historia/bebe_" + b.nasceu, cur => cur && cur.texto === tx ? undefined : Object.assign({ at: b.nasceu, emoji: "👶" }, cur || {}, { texto: tx }));
}
const COLHEITAS9 = [1, 10, 25, 50, 100, 200];
function vigiarHistoria(){
  if (!me) return;
  if (statsCarregados){
    const n = stats.colheitas || 0;
    if (colheita9 != null && n > colheita9) for (const m of COLHEITAS9) if (colheita9 < m && m <= n) historia("colheita_" + m, "🍅", m === 1 ? "A primeira colheita da horta" : m + " colheitas na horta");
    colheita9 = n;
  }
  if (visitaCarregada){
    const feitas = Object.entries(visitaDB).filter(([k, r]) => k !== "gato" && r && (r.bolo || r.deu || r.pacote)).map(([k]) => k);
    if (visita9) for (const k of feitas){
      if (visita9.has(k)) continue;
      const r = visitaDB[k], v = visitaAgora(), meu = r.bolo === pid || r.deu === pid || (r.pacote && r.pacote.por === pid);
      if (!meu) continue;
      const tipo = v && v.id === k ? v.tipo : r.pacote ? "carteiro" : "vizinho";
      historia("visita_" + k, tipo === "carteiro" ? "📦" : "🏡", tipo === "carteiro" ? "O carteiro trouxe um pacote" : "A Dona Cida veio visitar" + (r.bolo ? " e trouxe bolo 🍰" : ""));
    }
    visita9 = new Set(feitas);
  }
}
const MESES9 = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const EMOJIS_HIST = ["💕", "🏡", "🎉", "🌧️", "🍰", "✨", "😂", "🌙"];
function openHistoria(){
  const st = { emoji: EMOJIS_HIST[0] };
  openPanel("historia", "Nossa história 📖", corpo => {
    const inp = el("input"), emos = el("div", "swatches emo9"), lista = el("div", "list"), add = btn("Escrever na história", "btn", () => {
      const v = inp.value.replace(/\s+/g, " ").trim().slice(0, 120); if (!v){ toast("Escreva alguma coisa."); inp.focus(); return; }
      add.disabled = true;
      ref("casa/historia").push({ at: TS(), emoji: st.emoji, texto: v, por: pid, manual: 1 }).then(() => { inp.value = ""; historiaCache = null; carregar(); toast("Guardado na história " + st.emoji); }, () => toast("Não deu pra guardar.")).then(() => { add.disabled = false; });
    });
    inp.type = "text"; inp.maxLength = 120; inp.placeholder = "Um momento pra lembrar..."; inp.setAttribute("aria-label", "Escrever um momento");
    EMOJIS_HIST.forEach(e => { const b = btn(e, "btn ghost", () => { st.emoji = e; [...emos.children].forEach(x => x.setAttribute("aria-pressed", String(x.textContent === e))); }); b.setAttribute("aria-label", "Emoji " + e); b.setAttribute("aria-pressed", String(e === st.emoji)); emos.append(b); });
    corpo.append(el("p", "muted", "Os momentos de vocês ficam aqui sozinhos: conquistas, presentes, jantares, filmes, fotos, datas... e o que vocês quiserem escrever."), inp, emos, add, lista);
    const render = () => {
      lista.textContent = "";
      const l = Object.entries(historiaCache || {}).filter(([, h]) => h && h.texto).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      if (!l.length){ lista.append(el("p", "muted", "A história começa agora 💞")); return; }
      let mes = null;
      for (const [k, h] of l.slice(0, 300)){
        const d = new Date(h.at || 0), mk = d.getFullYear() * 12 + d.getMonth();
        if (mk !== mes){ mes = mk; lista.append(el("h3", "mes9", MESES9[d.getMonth()] + " de " + d.getFullYear())); }
        const row = el("div", "hrow9"), tx = el("div", "tx");
        tx.append(el("strong", null, String(h.texto).slice(0, 160)), el("small", null, pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + " · " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + (h.manual && h.por ? " · por " + (h.por === pid ? "você" : nomeDe(h.por)) : "")));
        row.append(el("span", "em", String(h.emoji || "✨").slice(0, 4)), tx);
        if (h.foto && album[h.foto]){ const im = imgFoto(fotoSrc.get(h.foto), null); if (!fotoSrc.has(h.foto)) carregarFoto(h.foto).then(src => { if (src) im.src = src; }); row.append(im); }
        if (h.manual && h.por === pid){
          const del = btn("×", "btn ghost small"); del.setAttribute("aria-label", "Apagar este momento"); let certo = false;
          del.onclick = () => { if (!certo){ certo = true; del.textContent = "?"; setTimeout(() => { certo = false; del.textContent = "×"; }, 3000); return; } ref("casa/historia/" + k).remove().then(() => { historiaCache = null; carregar(); }); };
          row.append(del);
        }
        lista.append(row);
      }
    };
    const carregar = () => { if (historiaCache){ render(); return; } lista.textContent = ""; lista.append(el("p", "muted", "Carregando...")); ref("casa/historia").once("value").then(s => { historiaCache = s.val() || {}; if (painel && painel.id === "historia") render(); }).catch(() => {}); };
    carregar();
    return () => carregar();
  });
}

// =====================================================================
// 7. DECORAÇÃO DE PAREDE: mural de fotos e calendário
// =====================================================================
let muralKey9 = "";
function muralChave9(){ muralKey9 = fotosOrdem().slice(0, 3).map(([id]) => id + (fotoMini.get(id) ? "1" : "0")).join("-"); }
DECOR_CAT.muralFotos = { nome: "Mural de fotos", preco: 80, chave: () => muralKey9,
  d(x, y){
    R(x + 1, y + 3, 14, 10, C.woodD); R(x + 1, y + 3, 14, 1, C.wood); R(x + 1, y + 12, 14, 1, C.woodDD); R(x + 2, y + 4, 12, 8, "#C9965E");
    for (const [a, b] of [[3, 11], [12, 4], [8, 10]]) P(x + a, y + b, "#B07E48");
    const fs = fotosOrdem().slice(0, 3), pos = [[2, 4], [8, 5], [5, 7]], sim = ["#9FD3F2", "#F9C9D6", "#BFE5DA"];
    pos.forEach(([a, b], i) => {
      const f = fs[i], mini = f && fotoMini.get(f[0]);
      if (!f && i) return;
      R(x + a, y + b, 6, 5, "#FFFFFF"); R(x + a, y + b + 4, 6, 1, "#E9D8BE");
      if (mini) ctx.drawImage(mini, x + a + 1, y + b + 1); else { R(x + a + 1, y + b + 1, 4, 3, sim[i]); P(x + a + 2, y + b + 2, "#FFFFFF"); }
      P(x + a + 2, y + b, "#E8607A");
    });
  },
  menu: () => [{ nome: "Ver o álbum 📸", fn: openAlbum }] };
DECOR_CAT.calendario = { nome: "Calendário", preco: 40,
  d(x, y){
    R(x + 3, y + 3, 10, 10, "#FFFFFF"); R(x + 3, y + 3, 10, 3, "#E8445E"); R(x + 3, y + 5, 10, 1, "#C9364E"); R(x + 3, y + 12, 10, 1, "#E6E2F0");
    P(x + 5, y + 2, "#8D9BAA"); P(x + 10, y + 2, "#8D9BAA"); P(x + 5, y + 3, "#5A5370"); P(x + 10, y + 3, "#5A5370");
  },
  anim(x, y, tm){
    const d = new Date(srvNow()), festa = festaHoje.length > 0;
    txt3(pad2(d.getDate()), x + 4, y + 7, festa ? "#E8445E" : "#2E2638");
    if (festa && Math.floor(tm / 500) % 2) pixHeart(x + 11, y + 1, "#F49AAE");
  },
  menu: () => [{ nome: "Ver datas especiais 📅", info: proximaDataTxt() ? "" : "Cadastrar", fn: openDatas }] };

// =====================================================================
// 8. GANCHOS: painel "Nós", faixa do topo, clique, laço, luzes, rótulos
// =====================================================================
function nosBotoes9(){
  const g = el("div", "nos9");
  const mk = (ic, tx, sub, fn) => { const b = btn("", "btn ghost escolha", fn); b.append(el("strong", null, ic + " " + tx), el("small", null, sub)); b.setAttribute("aria-label", tx + ": " + sub); return b; };
  const np = meusPresentes().length, nf = Object.keys(album).length;
  g.append(mk("🎁", "Presentes", np ? np + " pra você abrir!" : "Dar um mimo", openPresentes), mk("📸", "Álbum", nf ? nf + (nf === 1 ? " foto" : " fotos") : "Primeira foto?", openAlbum),
    mk("📖", "Nossa história", "Linha do tempo", openHistoria), mk("📅", "Datas", proximaDataTxt() || "Aniversários e datas", openDatas));
  return g;
}
function bannerLeva9(){
  if (!me) return null;
  const conv = Object.entries(encontros).find(([, g]) => g && g.b === pid && g.estado === "convite");
  if (conv){
    const [id, g] = conv;
    return { key: "j" + id, partes: () => { const bb = el("div", "bb"); bb.append(btn("Aceitar", "btn small", () => aceitarJantar(id)), btn("Agora não", "btn ghost small", () => recusarJantar(id))); return [el("span", null, nomeDe(g.a) + " te chamou pra um jantar à luz de velas 🕯️"), bb]; } };
  }
  const c = cinema;
  if (cinemaAtivo() && c.por !== pid && (c.andar || 0) === andarAtual && srvNow() < c.ini + 40000 && !(me.acao && me.acao.id === "cinema") && cnDispensado !== c.ini){
    return { key: "c" + c.ini, partes: () => { const bb = el("div", "bb"); bb.append(btn("Assistir", "btn small", () => { cnDispensado = c.ini; irCinema(); }), btn("Agora não", "btn ghost small", () => { cnDispensado = c.ini; })); return [el("span", null, nomeDe(c.por) + " botou “" + c.titulo + "” na TV 🎬"), bb]; } };
  }
  return null;
}
function leva9Click(p, tx, ty, toque){
  const g = presenteNoToque(p.x, p.y, toque);
  if (g){ menuPresente(g, p); return true; }
  return false;
}
function leva9Update(dt){
  const t = srvNow();
  for (const g of Object.values(encontros)){ // corações subindo da mesa
    if (!g || g.estado !== "aceito" || !g.ini) continue;
    const m = moveis[g.mov], geo = m && JT_GEO[m.t], F = jtFase(g, t); if (!geo || !F || F.f === "fim" || F.f === "velas") continue;
    jtPart += dt * (F.f === "papo" ? 1.1 : .5);
    while (jtPart > 1){ jtPart--; particles.push({ x: m.x * T + CAT[m.t].w * T / 2 + Math.random() * 20 - 10, y: m.y * T + 4, vx: Math.random() * 4 - 2, vy: -7 - Math.random() * 5, life: 1.8, kind: "heart" }); }
  }
  if (me.acao && me.acao.id === "cinema" && cinemaAtivo()){ // som das reações do filme
    const mo = momentoAgora(cinema, t), k = mo ? cinema.ini + ":" + mo.k : "";
    if (k && k !== cnMomUlt){ if (mo.tipo === "rir") sfx("risada"); else if (mo.tipo === "susto") sfx("susto"); else if (mo.tipo === "viva" || mo.tipo === "uau") sfx("acerto", .7); }
    cnMomUlt = k;
    if (cinema.pipoca && Math.random() < dt * .25) sfx("pipoca", .35);
  }
}
function leva9Luzes(lights, tm){
  const t = srvNow();
  for (const g of Object.values(encontros)){
    if (!g || g.estado !== "aceito" || !g.ini) continue;
    const m = moveis[g.mov], geo = m && JT_GEO[m.t], F = jtFase(g, t); if (!geo || !F || F.f === "fim") continue;
    const k = F.f === "velas" ? F.d / JT_VELAS : 1, cm = comodo(m.x, m.y), fl = .88 + .12 * ((Math.floor(tm / 150) % 3) / 2);
    for (const L of lights){ if (L[2] > 20 && comodo(clamp(Math.floor(L[0] / T), 0, W - 1), clamp(Math.floor(L[1] / T), 0, H - 1)) === cm) L[4] *= 1 - .6 * k; }
    for (const [vx, vy] of geo.velas) lights.push([m.x * T + vx + 1, m.y * T + vy, 36, "255,170,100", .9 * k * fl]);
  }
  if (cinemaAtivo() && (cinema.andar || 0) === andarAtual && moveis[cinema.tv]){
    const tv = moveis[cinema.tv], cm = comodo(tv.x, tv.y);
    for (const L of lights){ if (L[2] > 20 && L[3] !== "140,190,255" && comodo(clamp(Math.floor(L[0] / T), 0, W - 1), clamp(Math.floor(L[1] / T), 0, H - 1)) === cm) L[4] *= .35; }
  }
}
function addLeva9Objs(objs, tm){
  for (const k in pos9) delete pos9[k];
  addPresentesObjs(objs, tm);
  addJantarObjs(objs, tm);
  addCinemaObjs(objs, tm);
  addFestaObjs(objs, tm);
}
function drawLabels9(mctx, K, fs, tm){
  if (mode !== "live") return;
  const t = srvNow();
  for (const g of Object.values(encontros)){ // balões de coração na conversa do jantar
    if (!g || g.estado !== "aceito") continue;
    const F = jtFase(g, t); if (!F || F.f !== "papo") continue;
    const fala = [g.a, g.b][Math.floor(F.d / 2600) % 2], p = pos9[fala]; if (!p || (F.d % 2600) > 2100) continue;
    bolha9(mctx, fs, p.cx * K, (p.by - 27) * K - fs * 1.2, ["💕", "🥰", "😊", "💞"][Math.floor(F.d / 2600) % 4]);
  }
  for (const [id, p] of Object.entries(pos9)) if (p.emo) bolha9(mctx, fs, p.cx * K, (p.by - 25) * K - fs * 1.35, p.emo); // reações do cinema
  const topo = {}; // "!" em cima da pilha que tem presente pra mim
  for (const [, g, k] of prVis){ const kk = g.x + "," + g.y; if (!topo[kk]) topo[kk] = { g, k, meu: false }; if (k > topo[kk].k) topo[kk].k = k; if (g.para === pid) topo[kk].meu = true; }
  mctx.fillStyle = "#FAC775";
  for (const v of Object.values(topo)) if (v.meu) mctx.fillText("!", (v.g.x * T + 8) * K, (v.g.y * T + 2 - v.k * 6) * K - Math.abs(Math.sin(tm / 250)) * K * 2);
}

// botão de foto no canto da tela do jogo
{ const b = btn("📸", "fotoBtn", () => tirarFoto()); b.setAttribute("aria-label", "Tirar uma foto da casa pro álbum"); b.title = "Tirar foto"; $("stage").append(b); }

// migração: casa antiga ganha o marcador casa/criada (nunca é recriada) e a história começa com o que já aconteceu
function garantirLeva9(){
  if (leva9Tentou || !me || !conqCarregadas || !moveisCarregados || !nivelCarregado) return; leva9Tentou = true;
  txn("casa/leva9", c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return;
    ref("casa/criada").transaction(c => c ? undefined : srvNow()).catch(() => {});
    for (const c of CONQUISTAS){ const v = conquistas[c.id]; if (v) historiaConq(c, v.at); }
    const n = nivelCasal(); if (n > 1) historia("nivel_" + n, "♥", "Chegaram ao nível " + n + " do casal");
    historia("diario", "📖", "A casinha ganhou um diário: a nossa história começa aqui");
  });
}
CONQUISTAS.push(
  { id: "mimo1", nome: "Mimo", txt: "O primeiro presente aberto na casa.", st: "presentes", meta: 1 },
  { id: "mimo10", nome: "Chuva de mimos", txt: "10 presentes abertos.", st: "presentes", meta: 10 },
  { id: "jantar1", nome: "Jantar à luz de velas", txt: "Um jantar romântico a dois.", st: "jantares", meta: 1 },
  { id: "cinema1", nome: "Sessão da tarde", txt: "O primeiro filme no sofá de casa.", st: "filmes", meta: 1 },
  { id: "cinema10", nome: "Cinéfilos", txt: "10 filmes assistidos em casa.", st: "filmes", meta: 10 },
  { id: "foto1", nome: "Xis!", txt: "A primeira foto no álbum.", st: "fotos", meta: 1 },
  { id: "foto30", nome: "Álbum de família", txt: "30 fotos tiradas na casa.", st: "fotos", meta: 30 }
);
function leva9Ouvir(){
  on(ref("casa/presentes"), "value", s => aoMudarPresentes(s.val() || {}));
  on(ref("casa/encontros"), "value", s => aoMudarEncontros(s.val() || {}));
  on(ref("casa/cinema"), "value", s => aoMudarCinema(s.val()));
  on(ref("casa/album"), "value", s => { album = s.val() || {}; alCarregado = true; for (const k of [...fotoMini.keys()]) if (!album[k]) fotoMini.delete(k); muralChave9(); prepararMinis(); refreshPanel("album"); refreshPanel("foto"); });
  on(ref("casa/datas"), "value", s => { datas = s.val() || {}; dtCarregadas = true; refreshPanel("datas"); vigiarDatas(); });
  on(ref("casa/conquistas"), "value", s => historiaConquistas(s.val() || {}));
  on(ref("casa/nivel/xp"), "value", s => historiaNivel(Math.max(0, +s.val() || 0)));
  on(ref("casa/bebe"), "value", s => historiaBebe(s.val()));
}
function leva9Reset(){
  presentes = {}; prCarregado = false; prAvisou = false; prVis = [];
  encontros = {}; enCarregado = false; enTx = {}; enFeito = {}; enComida = {};
  cinema = null; cnCarregado = false; cnFeito = {}; cnDispensado = 0; cnMomUlt = "";
  album = {}; alCarregado = false; historiaCache = null; fotoSrc.clear(); fotoPend.clear(); fotoMini.clear();
  datas = {}; dtCarregadas = false; festaHoje = [];
  leva9Tentou = false; conq9 = null; nivel9 = null; bebeSig9 = ""; visita9 = null; colheita9 = null; mascaras.clear();
}
// teste: adianta o jantar / o filme em s segundos
function jtAvancar(s){ const e = jantarDe(pid); return e && e[1].ini ? ref("casa/encontros/" + e[0] + "/ini").set(e[1].ini - s * 1000) : null; }
function cnAvancar(s){ return cinema ? ref("casa/cinema/ini").set(cinema.ini - s * 1000) : null; }
setInterval(() => { if (!me) return; vigiarPresentes(); vigiarJantar(); vigiarCinema(); vigiarDatas(); vigiarHistoria(); garantirLeva9(); prepararMinis(); }, 1000);
