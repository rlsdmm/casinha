"use strict";
// Casinha · conversa: o campo de falar fica colado embaixo da casa (antes ficava lá embaixo, no painel, e no celular o
// teclado escondia os bonequinhos e os balões). As últimas falas aparecem também por escrito no canto da casa,
// pra quem está digitando não perder o que a outra pessoa disse.

const conversa29 = []; // { k, nome, txt, at }
const vistas29 = {};   // id -> falaAt já mostrado
let digitando29 = false;
function falasNovas29(){
  if (!sala) return;
  const box = $("conversa29"); if (!box) return;
  const agora = Date.now();
  for (const [id, j] of Object.entries(jogadores || {})){
    if (!j || !j.fala || !j.falaAt || !j.nome) continue;
    if (vistas29[id] === j.falaAt) continue;
    const novo = vistas29[id] !== undefined || agora - j.falaAt < 15000; // ao entrar, não puxa fala velha
    vistas29[id] = j.falaAt;
    if (!novo || Math.abs(agora - j.falaAt) > 120000) continue;
    // o horário do servidor chega em dois tempos (estimativa local, depois o certo): mesma fala = a mesma linha
    if (conversa29.some(c => c.id === id && c.txt === String(j.fala).slice(0, 60) && agora - c.at < 8000)) continue;
    conversa29.push({ id, k: id + j.falaAt, nome: id === pid ? "Você" : j.nome, txt: String(j.fala).slice(0, 60), at: agora });
  }
  while (conversa29.length > 4) conversa29.shift();
  // fica 20 s na tela (com o teclado aberto, as 4 últimas ficam paradas lá)
  const vivas = conversa29.filter(c => digitando29 || agora - c.at < 20000);
  const sig = vivas.map(c => c.k + (agora - c.at > 18000 && !digitando29 ? "v" : "")).join("|");
  if (sig === box.dataset.sig) return;
  box.dataset.sig = sig; box.innerHTML = "";
  for (const c of vivas){
    const p = el("p"); if (agora - c.at > 18000 && !digitando29) p.className = "velha";
    p.append(el("b", null, c.nome + ": "), document.createTextNode(c.txt));
    box.append(p);
  }
  box.hidden = !vivas.length;
}
setInterval(falasNovas29, 400);

// teclado aberto no celular: some o menu de baixo e a casa + o campo ficam juntos na parte que sobra da tela
function encaixar29(){
  if (!digitando29) return;
  const f = $("talk"), vv = window.visualViewport; if (!f || !vv) return;
  const r = f.getBoundingClientRect(), fundo = vv.offsetTop + vv.height;
  const dy = r.bottom + 6 - fundo;
  if (Math.abs(dy) > 4) window.scrollBy(0, dy);
}
$("say").addEventListener("focus", () => {
  digitando29 = true; document.body.classList.add("digitando29");
  setTimeout(encaixar29, 250); setTimeout(encaixar29, 600);
});
$("say").addEventListener("blur", () => { digitando29 = false; document.body.classList.remove("digitando29"); });
if (window.visualViewport) window.visualViewport.addEventListener("resize", () => setTimeout(encaixar29, 60));
