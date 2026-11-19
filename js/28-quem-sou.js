"use strict";
// Casinha · "Já tenho bonequinho aqui": quem a casa é fica só no localStorage (casinha-pid-<sala>). Outro celular, outro
// navegador, o app instalado (no iPhone tem memória separada do Safari) ou dados apagados = o jogo acha que é gente nova.
// Na tela do criador (e em ⚙️ Ajustes) dá pra escolher um morador que já existe e voltar a ser ele.

function moradoresQuemSou(){
  return Object.entries(jogadores).filter(([id, j]) => id !== pid && j && j.nome && !j.visita)
    .sort((a, b) => (b[1].visto || 0) - (a[1].visto || 0));
}
function virarMorador(id){
  const j = jogadores[id]; if (!j || !sala) return;
  const meu = pid, eraNovo = !jogadores[meu] || !jogadores[meu].nome;
  store.set("casinha-pid-" + sala, id);
  // o nó do "eu novo" que nem chegou a ter nome (sobra do onDisconnect) não fica na casa
  if (eraNovo && meu && salaRef){ const r = ref("jogadores/" + meu); r.onDisconnect().cancel().catch(() => {}); r.remove().catch(() => {}); }
  toast("Oi de novo, " + j.nome + " 💞");
  boot();
}
function montarQuemSou(box, aoEscolher){
  box.innerHTML = "";
  for (const [id, j] of moradoresQuemSou()){
    const b = btn((j.online ? "🟢 " : "") + j.nome, "btn ghost", () => {
      if (j.online && !confirm(j.nome + " está aberto em outro aparelho agora. Entrar como " + j.nome + " aqui também?")) return;
      if (aoEscolher) aoEscolher();
      virarMorador(id);
    });
    b.setAttribute("aria-label", "Sou " + j.nome);
    box.append(b);
  }
}
// tela do criador: aparece só pra quem está criando (não no espelho) e quando a casa já tem moradores
function renderQuemSouCriador(){
  const sec = $("cJaSou"), box = $("cJaSouLista"); if (!sec || !box) return;
  const mostra = !creatorEdit && !visitando && !$("screenCreator").hidden && moradoresQuemSou().length > 0;
  sec.hidden = !mostra;
  // só redesenha quando a lista muda (redesenhar a cada checagem engolia o toque)
  const sig = mostra ? moradoresQuemSou().map(([id, j]) => id + ":" + j.nome + ":" + !!j.online).join("|") : "";
  if (mostra && sig !== sigQuemSou) montarQuemSou(box);
  sigQuemSou = sig;
}
let sigQuemSou = "";
function openQuemSou(){
  openPanel("quemsou", "Entrar como outro morador 🔄", corpo => {
    const p = el("p", "muted", "Abriu a casa em outro celular ou no app instalado e virou gente nova? Toque no seu nome pra voltar a ser você.");
    const box = el("div", "list");
    corpo.append(p, box);
    if (!moradoresQuemSou().length) box.append(el("p", "muted", "Ninguém mais mora aqui ainda."));
    else montarQuemSou(box, () => closePanel());
  });
}
// a lista de moradores chega do banco depois do criador abrir: confere de vez em quando enquanto ele está na tela
setInterval(() => { if (!$("screenCreator").hidden) renderQuemSouCriador(); }, 1500);
