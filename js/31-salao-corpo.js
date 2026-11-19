"use strict";
// Casinha · o corpo é pra sempre, o resto muda com a vida:
//  1. Salão de cabeleireiro no fim da rua (lote "salao" no js/27-bairro.js): corte, cor do cabelo e barba, pagos.
//  2. Físico que muda devagar: comer soma, exercício tira. Uma vez por dia o saldo é conferido.
//     jogadores/<pid>/corpoPts (saldo) e corpoDia (último dia conferido)
//  3. Traços: só na criação; de vez em quando, um "mudou de jeito" troca um traço.  jogadores/<pid>/jeitoAt

// ---------------- 1. salão ----------------
const SALAO_PRECO = { estilo: 25, cabelo: 20, barba: 10 };
function openSalao(){
  if (!me || !me.dados){ return; }
  if (visitando){ toast("O salão é pra quem mora no bairro 💇"); return; }
  const d0 = visual(me.dados), novo = { estilo: d0.estilo, cabelo: d0.cabelo, barba: d0.barba || 0 };
  sfx("porta");
  openPanel("salao", "Salão 💇", corpo => {
    corpo.classList.add("esp12b");
    const cv = el("canvas", "espCanvas12b"); cv.width = ESP_W; cv.height = ESP_H; cv.setAttribute("role", "img");
    const boxE = el("div", "swatches"), boxC = el("div", "swatches"), boxB = el("div", "swatches");
    const conta = el("p", "muted"); conta.setAttribute("aria-live", "polite");
    const pagar = btn("", "btn", () => {
      const custo = custoSalao();
      if (!custo){ closePanel(); return; }
      if (!gastar(custo, "o salão")) return;
      const up = { estilo: novo.estilo, cabelo: novo.cabelo }; if (d0.corpo === "ele") up.barba = novo.barba;
      ref("jogadores/" + pid).update(up).then(() => { sfx("moeda"); toastEspecial("Visual novo! 💇", "Ficou lindo. -$" + custo); }, () => { ganhar(custo); toast("Não deu pra salvar. Tente de novo."); });
      closePanel();
    });
    corpo.append(cv, el("span", "lbl", "Corte · $" + SALAO_PRECO.estilo), boxE, el("span", "lbl", "Cor · $" + SALAO_PRECO.cabelo), boxC);
    if (d0.corpo === "ele") corpo.append(el("span", "lbl", "Barba · $" + SALAO_PRECO.barba), boxB);
    corpo.append(conta, el("div", "hbtns"));
    corpo.lastChild.append(pagar);
    const custoSalao = () => (novo.estilo !== d0.estilo ? SALAO_PRECO.estilo : 0) + (novo.cabelo !== d0.cabelo ? SALAO_PRECO.cabelo : 0) + (novo.barba !== (d0.barba || 0) ? SALAO_PRECO.barba : 0);
    const botoes = (box, itens, campo, cor) => {
      box.textContent = "";
      itens.forEach((it, i) => {
        const b = btn(cor ? "" : it, cor ? "swatch" : "btn ghost small", () => { novo[campo] = i; upd(); const nb = box.children[i]; if (nb) nb.focus({ preventScroll: true }); });
        if (cor){ b.style.background = it; b.setAttribute("aria-label", "Cor do cabelo " + (i + 1)); }
        b.setAttribute("aria-pressed", String(novo[campo] === i));
        box.append(b);
      });
    };
    const upd = () => {
      botoes(boxE, ESTILOS, "estilo"); botoes(boxC, CABELOS, "cabelo", true); botoes(boxB, ["Sem barba", "Com barba"], "barba");
      const custo = custoSalao();
      pagar.textContent = custo ? "Pagar $" + custo : "Sair sem mudar";
      conta.textContent = custo ? "Você tem $" + Math.floor(me.dinheiro) + "." : "Escolha um corte, uma cor" + (d0.corpo === "ele" ? " ou a barba." : ".");
      desenha();
    };
    const desenha = () => {
      const v = Object.assign({}, visual(me.dados), novo);
      pintarEspelho(cv, v, "down", "pe", "feliz", Date.now());
      cv.setAttribute("aria-label", "Prévia do cabelo novo");
    };
    upd();
    clearInterval(espTimer); espTimer = setInterval(() => { if (!painel || painel.id !== "salao"){ clearInterval(espTimer); return; } desenha(); }, 130);
  });
}

// ---------------- 2. físico que muda com o tempo ----------------
const CORPO_LIMITE = 15;
function corpoAcao31(a){
  if (!me || !me.dados || visitando) return;
  const d = a.def || {}, g = d.ganho || {};
  let v = 0;
  if (/^b-(esteira|pesos|saco|yoga)$|exerc|correr|malhar|danc/.test(a.id || "")) v = -2;
  else if (g.fome > 0) v = 1;
  if (!v) return;
  ref("jogadores/" + pid + "/corpoPts").transaction(c => Math.max(-40, Math.min(40, (+c || 0) + v))).catch(() => {});
}
function conferirCorpoDia(){
  if (!me || !me.dados || visitando || $("screenGame").hidden) return;
  const j = me.dados, hoje = dataDe(srvNow());
  if (j.corpoDia === hoje) return;
  if (!j.corpoDia){ ref("jogadores/" + pid).update({ corpoDia: hoje }).catch(() => {}); return; }
  const v = visual(j), up = { corpoDia: hoje }, pts = +j.corpoPts || 0, ordem = ["magro", "medio", "cheinho"];
  let i = ordem.indexOf(v.fisico); if (i < 0) i = 1;
  let msg = null;
  if (pts >= CORPO_LIMITE && i < 2){ up.fisico = ordem[i + 1]; up.corpoPts = 0; msg = ["Ficou mais cheinho 🍰", "Tanta comida gostosa deixou o corpo mais fofinho. Exercício equilibra."]; }
  else if (pts <= -CORPO_LIMITE){
    up.corpoPts = 0;
    if (i === 2){ up.fisico = "medio"; msg = ["Corpo em forma 💪", "Os exercícios deixaram o físico médio."]; }
    else if (i === 0){ up.fisico = "medio"; msg = ["Ganhou músculo 💪", "Os treinos deixaram o corpo mais firme."]; }
    else if (v.forma !== "atletico"){ up.forma = "atletico"; msg = ["Corpo atlético 🏋️", "Tanto treino deixou o corpo com cara de atleta."]; }
  } else up.corpoPts = Math.round(pts * .8 * 10) / 10; // sem exagero pra lado nenhum: o saldo vai esfriando
  // 3. de vez em quando a personalidade muda um pouquinho (no máximo 1 vez a cada 3 semanas, chance pequena por dia)
  const tr = tracosDe(j);
  if (!msg && tr.length === 3 && Date.now() - (j.entrou || 0) > 7 * 24 * HORA && Date.now() - (j.jeitoAt || 0) > 21 * 24 * HORA && Math.random() < 1 / 20){
    const sai = tr[Math.floor(Math.random() * 3)], resto = tr.filter(k => k !== sai);
    const ok = Object.keys(TRACOS).filter(k => !tr.includes(k) && !TRACOS_X.some(p => p.includes(k) && p.some(o => o !== k && resto.includes(o))));
    if (ok.length){
      const entra = ok[Math.floor(Math.random() * ok.length)];
      up.tracos = resto.concat(entra); up.jeitoAt = Date.now();
      msg = ["Mudou um pouco de jeito ✨", "Não é mais " + TRACOS[sai].nome.toLowerCase() + ". Agora é " + TRACOS[entra].ic + " " + TRACOS[entra].nome.toLowerCase() + "."];
    }
  }
  ref("jogadores/" + pid).update(up).then(() => { if (msg) toastEspecial(msg[0], msg[1]); }).catch(() => {});
}
setInterval(conferirCorpoDia, 60000);
setTimeout(conferirCorpoDia, 8000);
