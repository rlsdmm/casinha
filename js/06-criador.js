"use strict";
// Casinha · criador do bonequinho e espelho
// ===================== criação do boneco =====================
// o mesmo editor serve pra entrar na casa e pro espelho do guarda-roupa (edit = true)
let creatorEdit = false, creatorRefazer = false; // edit = guarda-roupa (só roupa); refazer = criador completo de novo
function guardaDe(){ return (me && me.dados && me.dados.guarda) || {}; }
// peças pagas escolhidas: [chave em jogadores/<pid>/guarda, preço, nome]
function itensPagos(c){
  const r = [], t = TRAJES[c.traje], a = ACESS[c.acess];
  if (t && t.preco) r.push(["traje-" + c.traje, t.preco, t.nome]);
  if (a && a.preco) r.push(["acess-" + c.acess, a.preco, a.nome]);
  return r;
}
function openCreator(edit, refazer){
  const d = edit && me ? me.dados : null;
  if (d) creator = Object.assign({ nome: d.nome || "", sorteado: true, tracos: tracosDe(d) }, visual(d)); // leva 12: traços
  else if (!creator.sorteado){
    const rnd = n => Math.floor(Math.random() * n), gratis = TRAJES.map((t, i) => t.preco || t.nivel || t.casamento ? -1 : i).filter(i => i >= 0);
    Object.assign(creator, { sorteado: true, corpo: Math.random() < .5 ? "ele" : "ela", barba: 0, acess: 0, roupa: rnd(ROUPAS.length), cabelo: rnd(6), estilo: 0, pele: rnd(PELES.length), traje: gratis[rnd(gratis.length)] });
    { const ok = estilosDe(creator.corpo); creator.estilo = ok[rnd(ok.length)]; }
  }
  creatorEdit = !!d; creatorRefazer = !!(d && refazer);
  showScreen("screenCreator");
  $("cName").value = creator.nome || "";
  montarCriador();
  if (typeof renderQuemSouCriador === "function") renderQuemSouCriador(); // 28-quem-sou
  window.scrollTo(0, 0);
}
// opções em botões; ao clicar, redesenha tudo e devolve o foco ao mesmo botão
function opcoes(id, itens){
  const box = $(id); box.innerHTML = "";
  itens.forEach((it, i) => {
    const b = btn(it.nome, it.cor ? "swatch" : "btn ghost small", () => { it.fn(); montarCriador(); const nb = $(id).children[i]; if (nb) nb.focus({ preventScroll: true }); });
    if (it.cor){ b.textContent = ""; b.style.background = it.cor; b.setAttribute("aria-label", it.nome); }
    b.setAttribute("aria-pressed", String(!!it.on));
    if (it.off){ b.disabled = true; b.title = it.tit || "Libera no guarda-roupa da casa"; }
    box.append(b);
  });
}
function itemPago(campo, i, it){
  if (it.presente && !guardaDe()[campo + "-" + i]) return { nome: it.nome + " 🎁", on: creator[campo] === i, off: true, tit: "Só ganhando de presente", fn: () => {} }; // leva 9
  if (it.nivel && nivelCasal() < it.nivel) return { nome: it.nome + " 🔒 Nível " + it.nivel, on: creator[campo] === i, off: true, tit: "Libera no nível " + it.nivel + " do casal", fn: () => {} }; // leva 6
  const tem = !it.preco || guardaDe()[campo + "-" + i], trava = !tem && !creatorEdit;
  return { nome: it.nome + (tem ? "" : trava ? " 🔒" : " · $" + it.preco), on: creator[campo] === i, off: trava, fn: () => creator[campo] = i };
}
function montarCriador(){
  const ed = creatorEdit, soRoupa = ed && !creatorRefazer; // guarda-roupa: corpo e cabelo não mudam aqui (cabelo é no salão)
  $("cTitulo").textContent = soRoupa ? "Guarda-roupa" : ed ? "Refazer meu bonequinho" : "Monte seu bonequinho";
  $("cGo").textContent = soRoupa ? "Vestir" : ed ? "Salvar o bonequinho" : "Entrar na casa";
  const faltaTraco = !me || !me.dados || tracosDe(me.dados).length < 3;
  for (const k of ["Corpo", "Forma", "Altura", "Fisico", "Estilo", "Cabelo", "Pele"]){ $("l" + k).hidden = soRoupa; $("sw" + k).hidden = soRoupa; }
  for (const id of ["lTracos", "swTracos", "cTracoTx"]) $(id).hidden = soRoupa && !faltaTraco;
  $("cName").hidden = soRoupa; $("cName").previousElementSibling.hidden = soRoupa;
  $("cBack").hidden = !ed;
  opcoes("swCorpo", CORPOS.filter(([k]) => k !== "neutro").map(([k, n]) => ({ nome: n, on: creator.corpo === k, fn: () => { creator.corpo = k; if (k !== "ele") creator.barba = 0; creator.estilo = estiloPara(k, creator.estilo); } })));
  const vc = visual(creator); // leva 12b: formato do corpo, altura e físico (com desenhinho em cada botão)
  opcoes("swForma", FORMAS.map(([k, n]) => ({ nome: n, on: vc.forma === k, fn: () => creator.forma = k })));
  opcoes("swAltura", ALTURAS.map(([k, n]) => ({ nome: n, on: vc.altura === k, fn: () => creator.altura = k })));
  opcoes("swFisico", FISICOS.map(([k, n]) => ({ nome: n, on: vc.fisico === k, fn: () => creator.fisico = k })));
  if (typeof iconesCorpo12b === "function") iconesCorpo12b();
  $("rowBarba").hidden = creator.corpo !== "ele" || soRoupa;
  opcoes("swBarba", [["Sem barba", 0], ["Com barba", 1]].map(([n, b]) => ({ nome: n, on: (creator.barba || 0) === b, fn: () => creator.barba = b })));
  opcoes("swTraje", TRAJES.map((t, i) => { // ✨ = roupa com arte nova no espelho (js/30-retratos.js)
    const it = itemPago("traje", i, t);
    if (it && typeof temRetratoPronto === "function" && temRetratoPronto(Object.assign({}, vc, { traje: i, barriga: 0 }))) it.nome += " ✨";
    return it;
  }));
  opcoes("swRoupa", ROUPAS.map((c, i) => ({ nome: "Cor da roupa " + (i + 1), cor: c, on: creator.roupa === i, fn: () => creator.roupa = i })));
  opcoes("swEstilo", estilosDe(creator.corpo).map(i => ({ nome: ESTILOS[i], on: creator.estilo === i, fn: () => creator.estilo = i })));
  opcoes("swCabelo", CABELOS.map((c, i) => ({ nome: "Cor do cabelo " + (i + 1), cor: c, on: creator.cabelo === i, fn: () => creator.cabelo = i })));
  opcoes("swAcess", ACESS.map((a, i) => itemPago("acess", i, a)));
  opcoes("swPele", PELES.map((c, i) => ({ nome: "Tom de pele " + (i + 1), cor: c, on: creator.pele === i, fn: () => creator.pele = i })));
  const novos = itensPagos(creator).filter(([k]) => !guardaDe()[k]), custo = novos.reduce((s, x) => s + x[1], 0);
  $("cDica").textContent = ed ? (custo ? "Peça nova: " + novos.map(x => x[2]).join(" e ") + " por $" + custo + ". Você tem $" + Math.floor(me ? me.dinheiro : 0) + ". Paga uma vez só." : soRoupa ? "Quase tudo é de graça. ✨ = roupa com arte nova no espelho. Cabelo e barba se mudam no salão do bairro 💇" : "Quase tudo é de graça. Peças com preço você paga uma vez só.")
    : "O corpo é pra sempre 💞 Roupa e acessório se trocam no guarda-roupa; cabelo, no salão do bairro.";
  montarTracos(); // leva 12: 3 traços de personalidade
  drawCreator();
}
// prévia de frente, de lado e de costas, alternando parado, andando e dançando
const POSES_PREVIA = [["stand", "Parado"], ["walk", "Andando"], ["arms", "Dançando"]];
function drawCreator(){
  const c = $("cPreview"); if (!c || $("screenCreator").hidden) return;
  const x = c.getContext("2d"), t = Date.now(), fase = Math.floor(t / 2600) % 3, [ps, nome] = POSES_PREVIA[fase];
  x.imageSmoothingEnabled = false; x.clearRect(0, 0, 60, 32);
  withCtx(x, 1, () => { R(0, 25, 60, 7, "#30264A"); R(0, 25, 60, 1, "#3E3260"); });
  ["down", "right", "up"].forEach((dir, i) => {
    let pose = "stand", fr = 0;
    if (ps === "walk") fr = Math.floor(t / 150) % 4;
    else if (ps === "arms"){ const k = Math.floor(t / 300) % 2; pose = k ? "arms" : "stand"; fr = k ? 1 : 3; }
    else if (t % 3200 < 160) pose = "blink";
    x.drawImage(avatarSprite(creator, dir, fr, pose).c, 0, AV_Y0, 18, 29, 1 + i * 20, 1, 18, 29);
  });
  const lp = $("cPose"); if (lp.textContent !== nome) lp.textContent = nome;
}
setInterval(drawCreator, 120);
$("cName").addEventListener("input", e => creator.nome = e.target.value);
$("cBack").onclick = () => { showScreen("screenGame"); resize(); };
$("cGo").onclick = () => {
  const nome = $("cName").value.trim().slice(0, 16);
  if (!nome){ toast("Escreva um nome pro seu bonequinho."); $("cName").focus(); return; }
  creator.nome = nome;
  const v = visual(creator);
  const travado = [[TRAJES[v.traje], "roupa"], [ACESS[v.acess], "acessório"]].find(([it]) => it && it.nivel && nivelCasal() < it.nivel); // leva 6
  if (travado){ toast("Esse " + travado[1] + " libera no nível " + travado[0].nivel + " do casal."); return; }
  if (ACESS[v.acess] && ACESS[v.acess].presente && !guardaDe()["acess-" + v.acess]){ toast("Esse acessório só ganhando de presente 🎁"); return; } // leva 9
  const tr = (creator.tracos || []).filter(k => TRACOS[k]); // leva 12: 3 traços de personalidade
  if (tr.length !== 3){ toast("Escolha 3 traços do jeito de ser (faltam " + (3 - tr.length) + ")."); const b = $("swTracos"); if (b) b.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
  let base = { nome, roupa: v.roupa, cabelo: v.cabelo, estilo: v.estilo, pele: v.pele, corpo: v.corpo, traje: v.traje, barba: v.barba, acess: v.acess, forma: v.forma, altura: v.altura, fisico: v.fisico, tracos: tr.slice(0, 3) };
  if (creatorEdit && !creatorRefazer && me){ // guarda-roupa: só a roupa (e os traços, se ainda faltavam)
    base = { roupa: v.roupa, traje: v.traje, acess: v.acess };
    if (tracosDe(me.dados).length < 3) base.tracos = tr.slice(0, 3);
  }
  if (creatorEdit && me){
    const novos = itensPagos(v).filter(([k]) => !guardaDe()[k]), custo = novos.reduce((s, x) => s + x[1], 0);
    if (custo && !gastar(custo, "o visual novo")) return;
    for (const [k] of novos) base["guarda/" + k] = true;
    ref("jogadores/" + pid).update(base).then(() => toast(custo ? "Visual novo! -$" + custo + ". Agora é seu pra sempre." : "Visual novo! Ficou ótimo."), () => { if (custo) ganhar(custo); toast("Não deu pra salvar. Tente de novo."); });
    showScreen("screenGame"); resize(); return;
  }
  if (itensPagos(v).length){ toast("Essa peça se compra no guarda-roupa. Escolha outra por enquanto."); return; }
  const [x, y] = freeSpot();
  const n = {}; NEEDS.forEach(k => n[k.id] = 80);
  ref("jogadores/" + pid).set(Object.assign(base, { x, y, dir: "down", needs: n, dinheiro: 500, online: true, entrou: Date.now() })).catch(() => toast("Não deu pra entrar. Tente de novo."));
};
$("createRoom").onclick = () => {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789"; let c = ""; const r = new Uint32Array(14); crypto.getRandomValues(r); for (const v of r) c += abc[v % abc.length];
  location.hash = c;
};
