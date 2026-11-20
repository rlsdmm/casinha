"use strict";
// Casinha · v49: datas especiais do ano
//  Natal: de 1 a 24/12 o presente pode ser "de Natal" (amigo secreto): fica embaixo da árvore e só abre no dia 25.
//    Ceia na mesa na noite do dia 24 e no dia 25, bônus e um capítulo na Nossa história.
//  Réveillon: fogos dos vizinhos nas janelas na noite do dia 31, contagem regressiva a partir das 23h, show de fogos
//    da meia-noite à 1h, bônus, história e convite pra escrever uma cápsula do tempo pro próximo ano.
//  Dia dos Namorados (12/6): varal de coraçõezinhos na parede de cima, pétalas perto da cama, bônus e história.
//  Páscoa (sábado e domingo): caça aos ovos de chocolate pela casa; quem pega primeiro leva.
// Dados:
//   casa/presentes/<id>.natal = ano          presente de Natal (não abre antes de 25/12 daquele ano)
//   casa/festas/<AAAA-MM-DD>_<evento>/<pid> = ts   bônus do dia (mesmo esquema das datas do casal, 19-momentos)
//   casa/pascoa/<ano>/<i> = pid              ovo i já pego por pid
// Teste: ?mes=12&dia=24&hora=20  (mes e hora já existiam; dia é novo). Natal: ?mes=12&dia=25 · virada: ?mes=12&dia=31&hora=23
//   ano novo: ?mes=1&dia=1&hora=0 · namorados: ?mes=6&dia=12 · Páscoa 2027: ?mes=3&dia=28

const DIA_TESTE38 = (n => n >= 1 && n <= 31 ? n : null)(parseInt(URLP.get("dia"), 10));
function hoje38(){ const d = new Date(srvNow()); return { a: d.getFullYear(), m: mesAgora(), d: DIA_TESTE38 || d.getDate(), h: hourNow() }; }
const chave38 = t => t.a + "-" + pad2(t.m) + "-" + pad2(t.d);
function pascoa38(a){ // domingo de Páscoa (algoritmo de Meeus)
  const b = a % 19, c = Math.floor(a / 100), d = a % 100, e = Math.floor(c / 4), f = c % 4, g = Math.floor((c + 8) / 25), h = Math.floor((c - g + 1) / 3);
  const i = (19 * b + c - e - h + 15) % 30, k = Math.floor(d / 4), l = d % 4, mm = (32 + 2 * f + 2 * k - i - l) % 7, n = Math.floor((b + 11 * i + 22 * mm) / 451);
  return { m: Math.floor((i + mm - 7 * n + 114) / 31), d: ((i + mm - 7 * n + 114) % 31) + 1 };
}
function evento38(){
  const t = hoje38();
  if (t.m === 12 && ((t.d === 24 && t.h >= 18) || t.d === 25)) return "natal";
  if (t.m === 12 && t.d === 31 && t.h >= 20) return "virada";
  if (t.m === 1 && t.d === 1) return "anonovo";
  if (t.m === 6 && t.d === 12) return "namorados";
  const p = pascoa38(t.a), dias = Math.round((new Date(t.a, p.m - 1, p.d) - new Date(t.a, t.m - 1, t.d)) / 864e5);
  if (dias === 0 || dias === 1) return "pascoa";
  return null;
}
// bônus do dia, uma vez por pessoa (e limpa os de mais de uma semana)
function festa38(evt, emoji, tit, sub, bonus, hist){
  const t = hoje38(), k = chave38(t) + "_" + evt;
  txn("casa/festas/" + k + "/" + pid, c => c ? undefined : srvNow()).then(ok => {
    if (!ok) return; ganhar(bonus); ganharNeeds({ diversao: 20, social: 20 }); xpCasal(5);
    setTimeout(() => toast("Presente do dia: +$" + bonus + " " + emoji), 4800);
  });
  confete(); setTimeout(confete, 900); toastEspecial(tit, sub);
  if (hist) historia(hist[0], emoji, hist[1]);
  ref("casa/festas").once("value").then(s => { const corte = dataDe(srvNow() - 7 * 24 * HORA); s.forEach(f => { if (f.key.slice(0, 10) < corte) f.ref.remove().catch(() => {}); }); }).catch(() => {});
}
function umaVez38(k){ const kk = "casinha-38-" + sala + "-" + k; if (store.get(kk)) return false; store.set(kk, "1"); return true; }

// ---------------- Natal ----------------
const natalJanela38 = () => { const t = hoje38(); return t.m === 12 && t.d <= 24; };
function natalLiberado38(g){ const t = hoje38(); return !g.natal || t.a > g.natal || (t.a === +g.natal && t.m === 12 && t.d >= 25); }
function faltaNatal38(){ const t = hoje38(), n = t.m === 12 ? 25 - t.d : 0; return n > 1 ? "Presente de Natal 🎄 Só abre dia 25: faltam " + n + " dias!" : n === 1 ? "Presente de Natal 🎄 Só abre amanhã!" : "Presente de Natal 🎄 Só abre no dia 25!"; }
const arvore38 = () => Object.values(moveis).find(m => m && baseT(m.t) === "arvoreNatal") || null;
function spotArvore38(){
  const a = arvore38(); if (!a) return null;
  const c = CAT[a.t] || { w: 1, h: 1 }, usados = {};
  for (const g of Object.values(presentes)) if (g && !g.aberto && (g.andar || 0) === andarAtual){ const k = g.x + "," + g.y; usados[k] = (usados[k] || 0) + 1; }
  const ok = (x, y) => MAP[y] && walkable(x, y) && MAP[y][x] === 0 && !naEscada(x, y) && (usados[x + "," + y] || 0) < 3;
  const cands = [];
  for (let y = a.y; y <= a.y + c.h; y++) for (let x = a.x - 1; x <= a.x + c.w; x++) if (ok(x, y)) cands.push([x, y]);
  if (!cands.length) return null;
  cands.sort((p, q) => (usados[p.join(",")] || 0) - (usados[q.join(",")] || 0) || Math.abs(p[1] - a.y - c.h) - Math.abs(q[1] - a.y - c.h));
  return [cands[0][0], cands[0][1], andarAtual];
}
let natalEnvio38 = false;
{ const f0 = enviarPresente; enviarPresente = function(st, texto){
  if (!natalEnvio38 || !natalJanela38()) return f0(st, texto);
  if (!me || !st.para || !jogadores[st.para]){ toast("Escolha pra quem é o presente."); return; }
  if (!st.item || (st.item === "movel" && !st.movel)){ toast("Escolha o presente."); return; }
  const preco = precoPresente(st), naArvore = spotArvore38(), pos = naArvore || spotPresente();
  if (!pos){ toast("Não achei um cantinho livre no chão pra deixar o presente."); return; }
  if (!gastar(preco, "o presente")) return;
  const g = { de: pid, para: st.para, item: st.item, laco: st.laco, bilhete: String(texto || "").trim().slice(0, 140), pago: preco, at: TS(), x: pos[0], y: pos[1], andar: pos[2], natal: hoje38().a };
  if (st.item === "movel") g.movel = st.movel;
  ref("casa/presentes").push(g).then(() => {
    closePanel(); sfx("papel"); natalEnvio38 = false;
    toast((naArvore ? "Presente embaixo da árvore 🎄" : "Presente de Natal embrulhado perto da cama 🎄") + " Só abre dia 25! -$" + preco);
  }, () => { ganhar(preco); toast("Não deu pra deixar o presente agora."); });
}; }
{ const f0 = openPresentes; openPresentes = function(){
  f0();
  if (!natalJanela38() || !painel || painel.id !== "presentes") return;
  const b = [...painel.el.querySelectorAll("button")].find(x => /^Embrulhar/.test(x.textContent)); if (!b) return;
  const lab = el("label", "check38"), cb = el("input"); cb.type = "checkbox"; cb.checked = natalEnvio38;
  const txt = () => { b.textContent = natalEnvio38 ? "Embrulhar pro Natal 🎄" : "Embrulhar e deixar na casa"; };
  cb.onchange = () => { natalEnvio38 = cb.checked; txt(); };
  lab.append(cb, el("span", null, arvore38() ? "Presente de Natal: fica embaixo da árvore e só abre dia 25 🎄" : "Presente de Natal: só abre dia 25 🎄 (com árvore de Natal, fica embaixo dela)"));
  b.before(lab); txt();
}; }
{ const f0 = irAbrir; irAbrir = function(id){ const g = presentes[id]; if (g && g.para === pid && !natalLiberado38(g)){ closeMenu(); toast(faltaNatal38()); return; } f0(id); }; }
{ const f0 = abrirPresente; abrirPresente = function(id){ const g = presentes[id]; if (g && !natalLiberado38(g)) return; f0(id); }; }
{ const f0 = menuPresente; menuPresente = function(id, p){
  const g = presentes[id];
  if (!g || natalLiberado38(g)) return f0(id, p);
  const it = [{ nota: 1, nome: (g.para === pid ? "De " + nomeDe(g.de) + ". " : "Pra " + nomeDe(g.para) + ". ") + faltaNatal38().replace(/^Presente de Natal 🎄 /, "") }];
  if (g.de === pid) it.push({ nome: "Pegar de volta", info: "+$" + (g.pago || 0), fn: () => desistirPresente(id) });
  openMenu(p, "🎄 Presente de Natal", it);
}; }
const ceiaSpr38 = () => sprite("ceia38", 18, 11, (ox, oy) => {
  R(ox, oy + 8, 18, 3, "#F4F1FA"); R(ox + 1, oy + 10, 16, 1, "#C9BFD8"); // travessa
  rbox(ox + 3, oy + 3, 11, 7, "#B5652E"); R(ox + 4, oy + 3, 8, 2, "#D9893F"); P(ox + 5, oy + 4, "#F2B66A"); P(ox + 12, oy + 8, "#8A4520"); // chester assado
  R(ox + 1, oy + 2, 2, 3, "#F4EEE6"); R(ox + 14, oy + 2, 2, 3, "#F4EEE6"); P(ox + 1, oy + 2, "#E8445E"); P(ox + 15, oy + 2, "#E8445E"); // coxinhas com papel
  for (const [x, y, c] of [[2, 7, "#7A3E8E"], [3, 6, "#9A5AAE"], [15, 7, "#5DBB7D"], [16, 6, "#7FD1B2"], [9, 1, "#5DBB7D"]]) P(ox + x, oy + y, c); // uvas e salsinha
});
const rabanadaSpr38 = () => sprite("rabanada38", 9, 6, (ox, oy) => { R(ox, oy + 4, 9, 2, "#F4F1FA"); rbox(ox + 1, oy + 1, 3, 3, "#E9B66A"); rbox(ox + 5, oy + 1, 3, 3, "#E9B66A"); P(ox + 2, oy + 1, "#FFFFFF"); P(ox + 6, oy + 1, "#FFFFFF"); });

// ---------------- Réveillon: fogos ----------------
const FOGOS38 = ["#FF6E78", "#FFDC78", "#82DCAA", "#8CB4FF", "#E39BFF", "#FFFFFF"];
function fogosAgora38(){ // período entre explosões (ms) por janela; 0 = sem fogos
  const t = hoje38();
  if (t.m === 1 && t.d === 1 && t.h < 1) return 900;
  if (t.m === 12 && t.d === 31 && t.h >= 20) return t.h >= 23.9 ? 1400 : 4200;
  return 0;
}
const fogoUlt38 = {};
function fogoDe38(x, tm, per){ const s = tm + x * 977, k = Math.floor(s / per), q = hash(x, k, 333); return { age: s % per, k, q, cor: FOGOS38[q % FOGOS38.length] }; }
{ const f0 = janelaAltaAnim35; janelaAltaAnim35 = function(px, x, tm, hr){
  f0(px, x, tm, hr);
  const per = fogosAgora38(); if (!per || skyKind(hr) !== "noite") return;
  const { gy, gh, gw } = JAN35, gx = px + 4, f = fogoDe38(x, tm, per);
  if (f.age > 1000) return;
  if (fogoUlt38[x] !== f.k){ fogoUlt38[x] = f.k; if (f.age < 120) sfx("pop", per < 1000 ? .5 : .25); }
  const cx = gx + 2 + f.q % (gw - 4), cy = gy + 2 + (f.q >> 5) % 6, r = Math.min(4, 1 + f.age / 190);
  const ok = (ax, ay) => ax >= gx && ax < gx + gw && ax !== px + 8 && ay >= gy && ay < gy + gh - 2 && ay !== gy + 6;
  ctx.globalAlpha = Math.max(0, 1 - f.age / 1000);
  for (let i = 0; i < 8; i++){ const an = i / 8 * Math.PI * 2, ax = Math.round(cx + Math.cos(an) * r), ay = Math.round(cy + Math.sin(an) * r * .9 + f.age / 400); if (ok(ax, ay)) P(ax, ay, i % 2 ? f.cor : "#FFFFFF"); }
  if (f.age < 220 && ok(cx, cy)) P(cx, cy, "#FFFFFF");
  ctx.globalAlpha = 1;
}; }

// ---------------- Páscoa: ovos pela casa ----------------
let ovos38 = {}, ovosAno38 = 0, ovosSig38 = "", ovosPos38 = [];
const OVO_CORES38 = [["#F49AAE", "#FFFFFF"], ["#7FB8E8", "#FFE08A"], ["#7FD1B2", "#F49AAE"], ["#FFE08A", "#B49CF4"], ["#B49CF4", "#FFFFFF"], ["#E8735F", "#FFE08A"], ["#9ED48A", "#FFFFFF"], ["#8C5E3A", "#F6C667"]];
function posOvos38(){ // mesmos lugares em todos os aparelhos: sorteados pelo ano entre os quadrados livres de cada andar
  const ano = hoje38().a, andares = temAndar2() ? [0, 1] : [0];
  const sig = ano + "|" + andares.join() + "|" + JSON.stringify(Object.keys(moveis).length) + "|" + (typeof todosMoveis === "object" ? Object.keys(todosMoveis).length : 0);
  if (sig === ovosSig38) return ovosPos38;
  ovosSig38 = sig; ovosPos38 = [];
  andares.forEach((n, ia) => noAndar(n, () => {
    const cands = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (walkable(x, y) && MAP[y][x] === 0 && comodo(x, y) !== "quintal" && !naEscada(x, y)) cands.push([x, y]);
    cands.sort((a, b) => hash(a[0], a[1], ano + n * 7) - hash(b[0], b[1], ano + n * 7));
    const quero = n === 0 ? (andares.length > 1 ? 6 : 8) : 4, pegos = [];
    for (const c of cands){ if (pegos.length >= quero) break; if (pegos.every(p => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) >= 3)) pegos.push(c); }
    for (const [x, y] of pegos) ovosPos38.push({ i: ovosPos38.length, x, y, andar: n });
  }));
  return ovosPos38;
}
const ovoSpr38 = i => sprite("ovo38:" + i, 6, 8, (ox, oy) => {
  const [c, f] = OVO_CORES38[i % OVO_CORES38.length];
  R(ox + 1, oy, 4, 8, c); R(ox, oy + 2, 6, 5, c); R(ox + 1, oy + 4, 4, 1, f); P(ox + 2, oy + 2, f); P(ox + 4, oy + 6, f); P(ox + 1, oy + 1, sh(c, .45)); R(ox + 1, oy + 7, 4, 1, sh(c, -.2));
}, true);
function ovosLivres38(){ if (evento38() !== "pascoa") return []; return posOvos38().filter(o => !ovos38[o.i]); }
function ovoNoToque38(wx, wy, toque){
  const f = toque ? 5 : 2;
  return ovosLivres38().find(o => (o.andar || 0) === andarAtual && Math.abs(wx - (o.x * T + 8)) <= 4 + f && Math.abs(wy - (o.y * T + 11)) <= 5 + f) || null;
}
function pegarOvo38(o){
  goTo(null, (x, y) => Math.abs(x - o.x) + Math.abs(y - o.y) <= 1, () => {
    faceTo(o.x, o.y);
    startAcao({ id: "ovo", nome: "Pegando o ovo 🥚", dur: 1, ganho: { diversao: 10 }, fim: () => {
      txn("casa/pascoa/" + hoje38().a + "/" + o.i, c => c ? undefined : pid).then(ok => {
        if (!ok){ toast("Ih, alguém pegou antes 😅"); return; }
        ganhar(8); burst(o.x, o.y - .3, "brilho"); sfx("acerto", .7);
        const tot = posOvos38().length, ach = Object.keys(ovos38).length + 1;
        toast("Achou um ovo de chocolate! 🍫 +$8 (" + Math.min(ach, tot) + " de " + tot + ")");
      });
    } });
  });
}
function resumoOvos38(){
  const n = {}; for (const p of Object.values(ovos38)) n[p] = (n[p] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([p, k]) => (p === pid ? "você" : nomeDe(p)) + " " + k).join(", ");
}

// ---------------- desenho: ceia, coraçõezinhos, pétalas, ovos ----------------
function addDatasObjs38(objs, tm){
  const ev = evento38(); if (!ev || mode !== "live") return;
  if (ev === "natal"){
    const mesa = mesaPrincipal();
    if (mesa && (mesa.andar || 0) === andarAtual && !Object.values(encontros).some(g => g && g.estado === "aceito" && g.mov === primeiro("mesa"))){
      const x = mesa.x * T + 7, y = mesa.y * T + 5;
      objs.push({ z: (mesa.y + 2) * T - .44, f: () => {
        ctx.drawImage(ceiaSpr38().c, x - 1, y - 1); ctx.drawImage(rabanadaSpr38().c, x + 18, y + 4);
        if (Math.floor(tm / 700) % 2) P(x + 8, y - 2, "rgba(255,255,255,.6)"); // fumacinha
      } });
    }
  }
  if (ev === "namorados" && andarAtual === 0){
    objs.push({ z: 2 * T + .5, f: () => { // varal de coraçõezinhos na parede de cima
      const y0 = DY35 + 2;
      for (let px = 17; px < W * T - 17; px++){ const yy = y0 + Math.round(2 * Math.sin(((px - 17) % 34) / 34 * Math.PI)); P(px, yy, "#C47680"); }
      for (let px = 20, i = 0; px < W * T - 22; px += 8, i++){ const yy = y0 + 1 + Math.round(2 * Math.sin(((px - 17) % 34) / 34 * Math.PI)) + (Math.floor(tm / 600 + i) % 2); pixHeart(px, yy, i % 2 ? "#E8445E" : "#F49AAE"); }
    } });
    const cama = Object.values(moveis).find(m => m && ["casal", "dossel"].includes(baseT(m.t)));
    if (cama){
      const c = CAT[cama.t];
      objs.push({ z: 1, f: () => { // pétalas no chão em volta da cama
        for (let i = 0; i < 18; i++){
          const q = hash(cama.x, cama.y, 500 + i), x = (cama.x - 1) * T + q % ((c.w + 2) * T), y = (cama.y + c.h) * T + 1 + (q >> 7) % 12;
          if (!MAP[Math.floor(y / T)] || MAP[Math.floor(y / T)][Math.floor(x / T)] !== 0) continue;
          P(x, y, q % 3 ? "#E8445E" : "#F49AAE"); if (q % 4 === 0) P(x + 1, y, "#C43050");
        }
      } });
    }
  }
  if (ev === "pascoa") for (const o of ovosLivres38()){
    if ((o.andar || 0) !== andarAtual) continue;
    objs.push({ z: o.y * T + 13, f: () => {
      const x = o.x * T + 5, y = o.y * T + 6;
      R(x, y + 8, 6, 1, "rgba(35,18,40,.25)"); ctx.drawImage(ovoSpr38(o.i).c, x - 1, y - 1);
      if (Math.floor((tm + o.i * 700) / 260) % 9 === 0) P(x + 4, y, "#FFFFFF"); // brilhinho
    } });
  }
}
function luzesDatas38(lights, tm){
  const per = fogosAgora38(); if (!per) return;
  for (const k of janelas()){
    const [x, y] = k.split(",").map(Number); if (y !== 0) continue;
    const f = fogoDe38(x, tm, per); if (f.age > 450) continue;
    const c = hexRGB(f.cor).join(","); lights.push([x * T + 8, 22, 34, c, .9 * (1 - f.age / 450)]);
  }
}
{ const f0 = addLeva9Objs; addLeva9Objs = function(objs, tm){ f0(objs, tm); try { addDatasObjs38(objs, tm); } catch (e){ console.error(e); } }; }
{ const f0 = leva9Luzes; leva9Luzes = function(lights, tm){ f0(lights, tm); try { luzesDatas38(lights, tm); } catch (e){} }; }
{ const f0 = leva9Click; leva9Click = function(p, tx, ty, toque){ const o = ovoNoToque38(p.x, p.y, toque); if (o){ pegarOvo38(o); return true; } return f0(p, tx, ty, toque); }; }

// ---------------- faixa do topo ----------------
let viradaVista38 = 0;
function bannerDatas38(){
  if (!me) return null;
  const ev = evento38(), t = hoje38();
  if (t.m === 12 && t.d === 31 && t.h >= 23){
    const min = Math.max(1, Math.ceil((24 - t.h) * 60));
    return { key: "x38v" + min, partes: () => [el("span", null, "🎆 " + (min === 1 ? "Falta 1 minuto" : "Faltam " + min + " minutos") + " pro Ano Novo!")] };
  }
  if (ev === "anonovo" && t.h < 1 && viradaVista38 !== t.a && typeof openCapsulas39 === "function"){
    return { key: "x38a" + t.a, partes: () => { const bb = el("div", "bb"); bb.append(btn("Escrever ⏳", "btn small", () => { viradaVista38 = t.a; bannerKey = null; openCapsulas39(true); }), btn("Agora não", "btn ghost small", () => { viradaVista38 = t.a; bannerKey = null; renderBannerJogo(); })); return [el("span", null, "🥂 Feliz " + t.a + "! Que tal uma cápsula do tempo pro próximo Ano Novo?"), bb]; } };
  }
  if (ev === "pascoa"){ const n = ovosLivres38().length; if (n) return { key: "x38p" + n, partes: () => [el("span", null, "🐣 Caça aos ovos! " + (n === 1 ? "Falta 1 ovo" : "Faltam " + n + " ovos") + " de chocolate pela casa")] }; }
  return null;
}
{ const f0 = bannerLeva10; bannerLeva10 = function(){ return f0() || bannerDatas38(); }; }

// ---------------- vigia: avisos, bônus e história de cada data ----------------
function vigiarDatas38(){
  if (!me || !salaRef || visitando) return;
  const ev = evento38(), t = hoje38(), dia = chave38(t);
  if (t.m === 12 && t.d <= 20 && !arvore38() && umaVez38("arvore-" + t.a)) setTimeout(() => toast("Dezembro chegou! 🎄 Dá pra montar a árvore de Natal no 🔨 Construir"), 6000);
  if (t.m === 12 && t.d <= 24 && umaVez38("amigo-" + t.a)) setTimeout(() => toast("🎁 Amigo secreto: presente de Natal só abre dia 25. Tá em 💞 Nós → Presentes"), 9000);
  if (!ev || !umaVez38("ev-" + dia + "-" + ev)) return;
  if (ev === "natal"){
    const nat = t.d === 25;
    festa38("natal", "🎄", nat ? "Feliz Natal! 🎄" : "Noite de Natal 🎄", nat ? "Os presentes de Natal já podem ser abertos. A ceia está na mesa!" : "A ceia está na mesa. Amanhã os presentes da árvore já abrem!", 30, ["natal_" + t.a, "Natal de " + t.a + " juntinhos"]);
  } else if (ev === "virada") toast("🎆 Último dia do ano! Os vizinhos já estão soltando fogos");
  else if (ev === "anonovo") festa38("anonovo", "🎆", "Feliz " + t.a + "! 🥂", "Um ano novinho pra casinha", 30, ["ano_" + t.a, "Viraram o ano juntos: chegou " + t.a]);
  else if (ev === "namorados") festa38("namorados", "💘", "Feliz Dia dos Namorados! 💘", "Tem coraçãozinho na parede e pétala no chão", 25, ["namorados_" + t.a, "Dia dos Namorados de " + t.a]);
  else if (ev === "pascoa") festa38("pascoa", "🐣", "Feliz Páscoa! 🐣", "Tem ovos de chocolate escondidos pela casa. Quem achar, leva!", 15, null);
}
function vigiarOvos38(){
  if (!me || !salaRef) return;
  const ano = hoje38().a, ev = evento38();
  if (ev === "pascoa" && ovosAno38 !== ano + "|" + sala){
    ovosAno38 = ano + "|" + sala; ovos38 = {};
    on(ref("casa/pascoa/" + ano), "value", s => {
      const ant = Object.keys(ovos38).length; ovos38 = s.val() || {}; bannerKey = null;
      const tot = posOvos38().length, n = Object.keys(ovos38).length;
      if (tot && n >= tot && ant < tot && umaVez38("ovos-fim-" + ano)){
        toastEspecial("Caça aos ovos completa! 🐣", resumoOvos38());
        historia("pascoa_" + ano, "🐣", "Caça aos ovos de " + ano + ": " + resumoOvos38());
      }
    });
  }
}
setInterval(() => { try { vigiarDatas38(); vigiarOvos38(); } catch (e){ console.error(e); } }, 2000);
