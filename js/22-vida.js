"use strict";
// Casinha · leva 12: vida própria (fila de ações, vontade própria, humor com motivos, traços, desejos, habilidades e hobbies)
// =====================================================================
// LEVA 12 — dados novos, todos em jogadores/<pid>/ (só o dono escreve):
//   fila = [{ n, ic }]             ações enfileiradas (só pra mostrar; quem executa é o aparelho do dono)
//   vontade = false                vontade própria desligada (ausente = ligada)
//   efeitos/<id> = { v, ate }      efeitos de humor com prazo (EFEITOS). As condições (fome, bagunça, saudade, bichinho...)
//                                  saem na hora de CONDICOES e não são gravadas.
//   tracos = ["romantico", ...]    3 traços de personalidade (TRACOS)
//   hab/<k> = xp                   habilidades (HAB); o nível 1–10 sai de HAB_XP
//   desejos = { s0, s1, s2: { id, txt, ic, pts, alvo?, at }, prox }   3 desejos; prox = quando o próximo vago se preenche
//   pontos = n                     pontos de satisfação (desejos cumpridos), gastos na loja (LOJA12)
//   bonus/<id> = ate               recompensas da loja ativas (nuncaCansado, pePano, ima, aprendiz)
//   quadros/<id> = { t, q, at }    quadros pintados no cavalete (t = tipo de decoração "pint_<tema>_<q>" ou "quadroNos")
// Pendurado, o quadro vira casa/decor/<id> = { t, x, y, por } (mesmo esquema da decoração da leva 6).
// Ganchos pras próximas levas:
//   addEfeito(id, { v, min, quieto })  · EFEITOS (gravados) · CONDICOES (calculadas) · humorDe(j, eu) · HUMOR (níveis e multiplicadores)
//   TRACOS[k] = { queda, pref, ganho, xp } · temTraco(k) · HAB + ganharHab(k, xp) + habNv(k) · XP_ACAO
//   DESEJOS (pode/cria/ok) + checarDesejos(ev) · LOJA12 · bonusAtivo(k) · VIDA (testes: VIDA.agir(), VIDA.ocioso)
// =====================================================================
const MIN = 60000;
const VIDA = { ocioso: 20000, ultUpd: 0, ultId: null, ultAgir: 0 };
const dadosEu = () => (me && me.dados) || {};
const hashStr = s => { let h = 7; for (const ch of String(s)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0; return h >>> 0; };

// ---------------- traços ----------------
// queda: multiplica a queda da necessidade · pref: peso na vontade própria (por id de ação) · ganho: multiplica o que a ação enche · xp: habilidade
const TRACOS = {
  romantico:   { nome: "Romântico(a)", ic: "💘", desc: "Beijo e abraço rendem 30% mais e deixam apaixonado(a). Sente mais saudade.", pref: { "s-conversar": 1.4 }, ganho: { "s-beijo": 1.3, "s-abracar": 1.3 }, xp: { charme: 1.3 } },
  preguicoso:  { nome: "Preguiçoso(a)", ic: "🦥", desc: "Sofá, rede e cochilo rendem 30% mais; trabalhar cansa mais. Quase nunca limpa sozinho.", queda: { energia: 1.1 }, pref: { relaxar: 1.8, poltrona: 1.6, rede: 1.8, cochilo: 1.6, limpar: .4, dancar: .6 }, ganho: { relaxar: 1.3, poltrona: 1.3, rede: 1.3, cochilo: 1.2 } },
  cozinheiro:  { nome: "Cozinheiro(a) de mão cheia", ic: "🧑‍🍳", desc: "Cozinha 20% mais rápido e aprende culinária 50% mais rápido.", pref: { comer: 1.3, receitas: 1.8 }, xp: { culinaria: 1.5 } },
  bagunceiro:  { nome: "Bagunceiro(a)", ic: "🌀", desc: "Nem liga pra bagunça (e nunca limpa sozinho). Precisa de banho mais cedo.", queda: { higiene: 1.2 }, pref: { limpar: 0 } },
  organizado:  { nome: "Organizado(a)", ic: "🧹", desc: "Qualquer sujeira incomoda, mas limpar deixa de bem com a vida. Adora uma faxina.", queda: { higiene: .9 }, pref: { limpar: 2.5 } },
  brincalhao:  { nome: "Brincalhão(ona)", ic: "🤹", desc: "Videogame e fliperama divertem 25% mais. Se entedia mais rápido.", queda: { diversao: 1.1 }, pref: { jogar: 1.8, fliperama: 1.8, foguete: 1.5 }, ganho: { jogar: 1.25, fliperama: 1.25, foguete: 1.25 }, xp: { logica: 1.1 } },
  caseiro:     { nome: "Caseiro(a)", ic: "🏠", desc: "TV rende 25% mais e se entedia devagar. Passeio anima menos.", queda: { diversao: .85 }, pref: { tv: 1.5, ler: 1.3, relaxar: 1.2 }, ganho: { tv: 1.25 } },
  aventureiro: { nome: "Aventureiro(a)", ic: "🧭", desc: "Passeio marca muito mais. Dançar e brincar lá fora rendem 25% mais; se entedia rápido.", queda: { diversao: 1.15 }, pref: { dancar: 1.6, piscina: 1.6, balancar: 1.5 }, ganho: { dancar: 1.25, piscina: 1.25, balancar: 1.25 }, xp: { danca: 1.3 } },
  bichos:      { nome: "Amante de bichos", ic: "🐾", desc: "Carinho no bichinho dá um humorzão; fica triste se ele estiver tristinho.", pref: { pet: 2.5 } },
  artista:     { nome: "Artista", ic: "🎨", desc: "Pintura e música sobem 50% mais rápido, divertem mais e inspiram.", pref: { pintar: 2.2, violao: 2, compor: 2 }, ganho: { pintar: 1.3, violao: 1.3, compor: 1.3 }, xp: { pintura: 1.5, musica: 1.5 } },
  nerd:        { nome: "Nerd", ic: "🤓", desc: "Lógica sobe 50% mais rápido; ler e ver vídeos divertem 30% mais.", queda: { social: .9 }, pref: { ler: 1.8, videos: 1.6 }, ganho: { ler: 1.3, videos: 1.3 }, xp: { logica: 1.5 } },
  dorminhoco:  { nome: "Dorminhoco(a)", ic: "😴", desc: "Cansa mais rápido, mas dormir rende 25% mais.", queda: { energia: 1.25 }, pref: { dormir: 1.6, cochilo: 1.8 }, ganho: { dormir: 1.25, cochilo: 1.25 } },
  comilao:     { nome: "Comilão(ona)", ic: "🍔", desc: "Fica com fome mais rápido e comer deixa muito feliz.", queda: { fome: 1.3 }, pref: { comer: 1.6, lanche: 1.5 }, ganho: { comer: 1.2, lanche: 1.2 } },
  sociavel:    { nome: "Sociável", ic: "🗣️", desc: "Conversar rende 25% mais e é o que mais gosta. Fica carente mais rápido.", queda: { social: 1.2 }, pref: { "s-conversar": 2 }, ganho: { "s-conversar": 1.25 }, xp: { charme: 1.3 } },
  timido:      { nome: "Tímido(a)", ic: "🙈", desc: "Fica carente bem devagar e prefere ficar na sua.", queda: { social: .75 }, pref: { "s-conversar": .4, ler: 1.3 } },
  jardineiro:  { nome: "Jardineiro(a)", ic: "🌻", desc: "Jardinagem sobe 50% mais rápido; mexer na horta diverte o dobro e dá bom humor.", pref: { regar: 2.5 }, ganho: { regar: 2, colher: 2, plantar: 2 }, xp: { jardinagem: 1.5 } }
};
const TRACOS_X = [["bagunceiro", "organizado"], ["sociavel", "timido"], ["preguicoso", "aventureiro"]]; // não combinam
function tracosDe(j){ const t = j && j.tracos; const l = Array.isArray(t) ? t : t && typeof t === "object" ? Object.values(t) : []; return l.filter(k => TRACOS[k]).slice(0, 3); }
const meusTracos = () => tracosDe(dadosEu());
const temTraco = k => meusTracos().includes(k);
const prefTraco = aid => meusTracos().reduce((m, t) => { const p = TRACOS[t].pref; return m * (p && p[aid] != null ? p[aid] : 1); }, 1);

// criador/espelho: 3 traços (06-criador chama em montarCriador)
function montarTracos(){
  const box = $("swTracos"); if (!box) return;
  const sel = creator.tracos = (creator.tracos || []).filter(k => TRACOS[k]).slice(0, 3);
  box.textContent = "";
  for (const [k, t] of Object.entries(TRACOS)){
    const on = sel.includes(k), briga = TRACOS_X.find(p => p.includes(k) && p.some(o => o !== k && sel.includes(o)));
    const b = btn("", "btn ghost small traco12", () => {
      const i = sel.indexOf(k);
      if (i >= 0) sel.splice(i, 1);
      else if (briga) toast("Não combina com " + TRACOS[briga.find(o => o !== k)].nome.toLowerCase() + ".");
      else if (sel.length >= 3) toast("Já são 3. Toque num escolhido pra tirar.");
      else sel.push(k);
      $("cTracoTx").textContent = t.ic + " " + t.nome + ": " + t.desc;
      montarTracos(); const nb = [...$("swTracos").children].find(x => x.dataset.k === k); if (nb) nb.focus({ preventScroll: true });
    });
    b.dataset.k = k; b.textContent = t.ic + " " + t.nome; b.title = t.desc;
    b.setAttribute("aria-pressed", String(on));
    if (!on && (sel.length >= 3 || briga)) b.classList.add("fosco");
    box.append(b);
  }
  $("lTracos").textContent = "Jeito de ser · " + sel.length + "/3";
}

// ---------------- habilidades ----------------
const HAB = {
  culinaria:  { nome: "Culinária", ic: "🍳", sobe: "Cozinhar, ajudar no fogão, estudar o livro de receitas", efeito: n => (n > 3 ? "+" + Math.floor((n - 1) / 3) + " porção por prato · " : "") + "cozinha " + Math.round(2.5 * (n - 1)) + "% mais rápido · receitas novas no nível 2, 3, 5 e 7 (com o livro de receitas)" },
  charme:     { nome: "Charme", ic: "💋", sobe: "Conversar, abraçar, beijar, namorar, jantar", efeito: n => "+" + 4 * (n - 1) + "% de social nas interações" },
  jardinagem: { nome: "Jardinagem", ic: "🌱", sobe: "Regar, plantar e colher", efeito: n => "cada rega adianta +" + 4 * (n - 1) + "% do crescimento · " + 10 * (n - 1) + "% de chance de colheita extra" },
  logica:     { nome: "Lógica", ic: "🧠", sobe: "Trabalhar, ler, partidas de minigame", efeito: n => "+" + 5 * (n - 1) + "% no pagamento do trabalho" },
  musica:     { nome: "Música", ic: "🎸", sobe: "Tocar violão", efeito: n => n >= 3 ? "destravou: compor uma música no violão" : "no nível 3 destrava compor músicas" },
  pintura:    { nome: "Pintura", ic: "🎨", sobe: "Pintar no cavalete", efeito: n => "quadros mais bonitos (valem mais)" + (n >= 4 ? " · destravou: retrato do casal" : " · nível 4 destrava o retrato do casal") },
  danca:      { nome: "Dança", ic: "💃", sobe: "Dançar no som ou junto com alguém", efeito: n => "+" + 4 * (n - 1) + "% de diversão dançando" }
};
const HAB_XP = [0, 30, 75, 135, 210, 300, 410, 540, 690, 860]; // xp acumulado pra cada nível (1..10)
const habXp = k => +((dadosEu().hab || {})[k]) || 0;
function nvDeXp(x){ let n = 1; while (n < 10 && x >= HAB_XP[n]) n++; return n; }
const habNv = k => nvDeXp(habXp(k));
const XP_ACAO = { receitas: [["culinaria", 10]], "coz-ajuda": [["culinaria", 7]], "s-conversar": [["charme", 6]], "s-beijo": [["charme", 4]], "s-abracar": [["charme", 4]], "s-cocegas": [["charme", 2]],
  "s-dancar": [["charme", 3], ["danca", 6]], dancar: [["danca", 10]], regar: [["jardinagem", 6]], colher: [["jardinagem", 12]], plantar: [["jardinagem", 5]], podar: [["jardinagem", 6]],
  trabalhar: [["logica", 10]], ler: [["logica", 5]], violao: [["musica", 12]], compor: [["musica", 18]], pintar: [["pintura", 14]], retrato: [["pintura", 18]] };
function xpDaAcao(a){ const id = a.id || ""; if (/^coz-/.test(id) && id !== "coz-ajuda") return [["culinaria", 14]]; return XP_ACAO[id] || []; }
function ganharHab(k, xp){
  if (!me || visitando || !HAB[k] || !(xp > 0)) return;
  const mt = meusTracos().reduce((m, t) => m * (((TRACOS[t].xp || {})[k]) || 1), 1);
  const ganho = xp * mt * humorAgora().mult * (bonusAtivo("aprendiz") ? 1.5 : 1);
  const x0 = habXp(k), n0 = nvDeXp(x0), x1 = Math.round((x0 + ganho) * 10) / 10, n1 = nvDeXp(x1);
  me.dados.hab = Object.assign({}, me.dados.hab, { [k]: x1 });
  ref("jogadores/" + pid + "/hab/" + k).set(x1).catch(() => {});
  flutua(HAB[k].ic + " +" + Math.max(1, Math.round(ganho)));
  if (n1 > n0){
    sfx("nivel"); toastEspecial(HAB[k].ic + " " + HAB[k].nome + ": nível " + n1 + "!", destravouTxt(k, n1));
    addEfeito("aprendeu", { quieto: 1 });
    checarDesejos({ nivel: k });
  }
}
function destravouTxt(k, n){
  if (k === "culinaria"){ const l = Object.entries(RECEITAS12).filter(([, r]) => r.hab === n).map(([, r]) => r.nome); if (l.length) return "Destravou: " + l.join(", ") + (temLivro() ? "." : " (precisa do livro de receitas em casa)."); }
  if (k === "musica" && n === 3) return "Destravou: compor uma música no violão 🎶";
  if (k === "pintura" && n === 4) return "Destravou: retrato do casal no cavalete 🖼️";
  return HAB[k].efeito(n).replace(/^./, c => c.toUpperCase()) + ".";
}

// ---------------- humor: efeitos com prazo e condições ----------------
const EFEITOS = {
  comeuBem:    { ic: "🍽️", nome: "Comeu bem", v: 2, min: 60, txt: "Barriguinha cheia." },
  banquete:    { ic: "🍲", nome: "Comida caprichada", v: 3, min: 120, txt: "Comeu uma receita especial." },
  chef:        { ic: "🧑‍🍳", nome: "Orgulho de chef", v: 2, min: 90, txt: "Cozinhou com mão de mestre." },
  descansado:  { ic: "😌", nome: "Descansado(a)", v: 2, min: 90, txt: "Dormiu bem." },
  abracadinho: { ic: "🫂", nome: "Dormiu abraçadinho", v: 4, min: 240, txt: "Noite de conchinha na mesma cama." },
  banho:       { ic: "🛁", nome: "Banho tomado", v: 2, min: 90, txt: "Cheirosinho(a)." },
  carinho:     { ic: "💕", nome: "Recebeu carinho", v: 2, min: 60, txt: "Alguém te deu um abraço, beijinho ou cócegas." },
  apaixonado:  { ic: "💘", nome: "Apaixonado(a)", v: 3, min: 120, txt: "Romântico(a) depois de um beijo ou abraço." },
  presente:    { ic: "🎁", nome: "Ganhou presente", v: 4, min: 240, txt: "Abriu um presente." },
  musica:      { ic: "🎶", nome: "Música boa", v: 2, min: 30, txt: "Tocou ou ouviu violão por perto." },
  passeio:     { ic: "🚗", nome: "Passeio inesquecível", v: 4, min: 360, txt: "Voltou de um passeio de carro." },
  desejo:      { ic: "⭐", nome: "Desejo realizado", v: 3, min: 120, txt: "Cumpriu um desejo." },
  aprendeu:    { ic: "📈", nome: "Aprendeu algo novo", v: 2, min: 120, txt: "Subiu de nível numa habilidade." },
  bichinho:    { ic: "🐾", nome: "Amor de bichinho", v: 3, min: 90, txt: "Fez carinho no bichinho (amante de bichos)." },
  jardim:      { ic: "🌱", nome: "Mão na terra", v: 2, min: 60, txt: "Cuidou da horta (jardineiro)." },
  ordem:       { ic: "✨", nome: "Casa em ordem", v: 2, min: 60, txt: "Limpou a casa (organizado)." },
  venceu:      { ic: "🏆", nome: "Ganhou no jogo", v: 2, min: 60, txt: "Venceu uma partida." },
  noite:       { ic: "🍿", nome: "Sessão a dois", v: 3, min: 180, txt: "Viu um filme juntinho." },
  obra:        { ic: "🖼️", nome: "Obra-prima!", v: 3, min: 180, txt: "Pintou um quadro lindo." },
  inspirado:   { ic: "💡", nome: "Inspirado(a)", v: 2, min: 90, txt: "Arte faz bem (artista)." },
  mente:       { ic: "🧠", nome: "Mente afiada", v: 1, min: 60, txt: "Leu um bom livro (nerd)." },
  reencontro:  { ic: "💞", nome: "Matou a saudade", v: 4, min: 180, txt: "Reencontrou quem estava longe." },
  astral:      { ic: "🌈", nome: "Astral lá em cima", v: 3, min: 1440, txt: "Recompensa da loja de pontos." }
};
// condições: fn(j, eu, tracos) → { id, ic, nome, v, txt } | null   (eu = é o meu boneco: aí dá pra olhar a casa)
const N12 = (j, k) => { const n = j === dadosEu() && me ? me.needs : (j.needs || {}); return typeof n[k] === "number" ? n[k] : 80; };
const CONDICOES = [
  (j, eu, tr) => j.nuvens > srvNow() ? { id: "nuvens", ic: "☁️", nome: "Nas nuvens", v: 5, txt: "Depois de um namoro ou jantar romântico." } : null,
  (j, eu, tr) => N12(j, "fome") < 25 ? { id: "fome", ic: "😣", nome: "Com fome", v: tr.includes("comilao") ? -4 : -3, txt: "Fome abaixo de 25." } : null,
  (j, eu, tr) => N12(j, "energia") < 25 ? { id: "cansado", ic: "🥱", nome: "Cansado(a)", v: tr.includes("dorminhoco") ? -4 : -3, txt: "Energia abaixo de 25." } : null,
  (j, eu, tr) => N12(j, "higiene") < 25 ? { id: "sujo", ic: "🫧", nome: "Precisando de banho", v: -2, txt: "Higiene abaixo de 25." } : null,
  (j, eu, tr) => N12(j, "diversao") < 25 ? { id: "tedio", ic: "😑", nome: "Entediado(a)", v: -2, txt: "Diversão abaixo de 25." } : null,
  (j, eu, tr) => N12(j, "social") < 25 ? { id: "carente", ic: "🥺", nome: "Carente", v: tr.includes("sociavel") ? -3 : tr.includes("timido") ? -1 : -2, txt: "Social abaixo de 25." } : null,
  (j, eu, tr) => {
    if (!eu || tr.includes("bagunceiro") || typeof sujeiraNoAndar !== "function") return null;
    const n = sujeiraNoAndar(), org = tr.includes("organizado");
    return n >= (org ? 2 : 5) ? { id: "bagunca", ic: "🗑️", nome: "Casa bagunçada", v: org ? -3 : -2, txt: n + " sujeiras por aqui" + (org ? " (organizado não aguenta)." : ".") } : null;
  },
  (j, eu, tr) => {
    if (!eu || visitando) return null;
    const fora = Object.entries(jogadores).filter(([id, o]) => id !== pid && o && o.nome && !o.visita && !o.online && o.visto && srvNow() - o.visto > 4 * HORA);
    return fora.length ? { id: "saudade", ic: "🧸", nome: "Saudade", v: tr.includes("romantico") ? -3 : -2, txt: "Faz tempo que " + nomesLista(fora.map(([id]) => nomeDe(id))) + " não aparece." } : null;
  },
  (j, eu, tr) => {
    if (!eu || !pet || typeof petTriste !== "function") return null;
    if (petTriste()) return { id: "petTriste", ic: "😿", nome: petNome() + " tristinho", v: tr.includes("bichos") ? -3 : -1, txt: "O bichinho precisa de comida ou carinho." };
    return tr.includes("bichos") && petFome() > 60 && petCarinho() > 60 ? { id: "petFeliz", ic: "🐱", nome: petNome() + " feliz", v: 1, txt: "Amante de bichos adora ver o bichinho bem." } : null;
  },
  (j, eu, tr) => eu && typeof musicaAtiva === "function" && (() => { const mu = musicaAtiva(); return mu && mu.andar === andarAtual; })() ? { id: "som", ic: "🎵", nome: "Som rolando", v: 1, txt: "Tem música tocando na casa." } : null
];
const HUMOR = [
  { id: "muitoFeliz", min: 8, nome: "Muito feliz", em: "😄", cor: "#5DCAA5", mult: 1.35, trab: .8, desejoMin: 3 },
  { id: "feliz", min: 3, nome: "Feliz", em: "🙂", cor: "#9AD67E", mult: 1.15, trab: .9, desejoMin: 5 },
  { id: "ok", min: -2, nome: "De boa", em: "😐", cor: "#CECBF6", mult: 1, trab: 1, desejoMin: 8 },
  { id: "chateado", min: -7, nome: "Chateado(a)", em: "😕", cor: "#EF9F27", mult: .85, trab: 1.1, desejoMin: 11 },
  { id: "triste", min: -Infinity, nome: "Triste", em: "😢", cor: "#F0707A", mult: .7, trab: 1.25, desejoMin: 15 }
];
function humorDe(j, eu){
  j = j || {}; const tr = tracosDe(j), t = srvNow(), lista = [];
  for (const [k, e] of Object.entries(j.efeitos || {})) if (e && EFEITOS[k] && e.ate > t) lista.push(Object.assign({ id: k, ate: e.ate }, EFEITOS[k], { v: +e.v || EFEITOS[k].v }));
  for (const f of CONDICOES){ try { const c = f(j, eu, tr); if (c) lista.push(c); } catch(e){} }
  lista.sort((a, b) => Math.abs(b.v) - Math.abs(a.v) || (a.id < b.id ? -1 : 1));
  const soma = lista.reduce((s, e) => s + e.v, 0);
  return { soma, lista, n: HUMOR.find(h => soma >= h.min) };
}
let humorCache = null, humorCacheT = 0, humorUlt = null;
function humorAgora(){
  if (!me) return HUMOR[2];
  if (!humorCache || Date.now() - humorCacheT > 800){ humorCache = humorDe(me.dados, true); humorCacheT = Date.now(); }
  return humorCache.n;
}
function meuHumor(){ humorAgora(); return humorCache; }
const humorOutros = {};
function humorDoOutro(id, j){ const c = humorOutros[id]; if (c && Date.now() - c.t < 2000) return c.h; const h = humorDe(j, false); humorOutros[id] = { h, t: Date.now() }; return h; }
function addEfeito(id, o){
  const e = EFEITOS[id]; if (!e || !me || visitando) return;
  o = o || {};
  const v = o.v != null ? o.v : e.v, ate = srvNow() + (o.min || e.min) * MIN;
  me.dados.efeitos = Object.assign({}, me.dados.efeitos, { [id]: { v, ate } });
  ref("jogadores/" + pid + "/efeitos/" + id).set({ v, ate }).catch(() => {});
  humorCache = null;
  if (!o.quieto) flutua(e.ic + " " + (v > 0 ? "+" : "") + v);
}
// textinho que sobe acima da cabeça (ganhos de humor e habilidade), em vez de mais um toast
const flutua12 = [];
function flutua(txt){ flutua12.push({ txt, at: Date.now() + flutua12.filter(f => Date.now() - f.at < 600).length * 450 }); if (flutua12.length > 6) flutua12.shift(); }
// o painel e o HUD mostram o humor no lugar do antigo "mood" (Nas nuvens, bagunça etc. viraram efeitos/condições)
mood = function(){
  if (!me) return "";
  const h = meuHumor(), top = h.lista[0];
  return h.n.em + " " + h.n.nome + (top ? " · " + top.ic + " " + top.nome : "");
};

// ---------------- recompensas, desejos ----------------
const bonusAtivo = k => (+((dadosEu().bonus || {})[k]) || 0) > srvNow();
const LOJA12 = [
  { id: "nuncaCansado", ic: "⚡", nome: "Nunca cansado", desc: "A energia não cai por 1 dia (nem trabalhando).", pts: 500, horas: 24 },
  { id: "pePano", ic: "🧑‍🍳", nome: "Pé de pano", desc: "Cozinha 2x mais rápido por 1 dia.", pts: 300, horas: 24 },
  { id: "ima", ic: "🧲", nome: "Ímã de dinheiro", desc: "+20% no pagamento do trabalho por 1 dia.", pts: 400, horas: 24 },
  { id: "aprendiz", ic: "📚", nome: "Aprendiz rápido", desc: "Habilidades sobem 50% mais rápido por 1 dia.", pts: 350, horas: 24 },
  { id: "astral", ic: "🌈", nome: "Astral lá em cima", desc: "+3 de humor por 1 dia.", pts: 250, efeito: 1 },
  { id: "quadroNos", ic: "🖼️", nome: "Quadro “Nós dois”", desc: "Decoração exclusiva de parede, moldura dourada. Vai pros seus quadros.", pts: 600, item: 1 }
];
const temMovel = (...ts) => Object.values(todosMoveis).some(m => m && ts.includes(baseT(m.t)));
const parceiro = () => { const l = Object.entries(jogadores).filter(([id, j]) => id !== pid && j && j.nome && !j.visita).sort((a, b) => (b[1].online ? 1 : 0) - (a[1].online ? 1 : 0)); return l.length ? l[0][0] : null; };
const aId = (ev, re) => !!(ev.a && re.test(ev.a.id || ""));
// pode(): dá pra aparecer agora · cria(): campos extras (alvo, txt) · ok(ev, d): cumpriu (ev = { a } ação, { nivel: k }, { dinheiro }, { passeio })
const DESEJOS = {
  dancarCom:  { ic: "💃", pts: 120, peso: { romantico: 2, aventureiro: 1, sociavel: 1 }, pode: () => !!parceiro(), cria: () => { const o = parceiro(); return { alvo: o, txt: "Dançar com " + nomeDe(o) }; },
    ok: (ev, d) => ev.a && ((ev.a.id === "s-dancar" && (ev.recebido || ev.a.alvo === d.alvo)) || (ev.a.id === "dancar" && !!ev.a.junto)) },
  abracar:    { ic: "🫂", pts: 80, peso: { romantico: 1.5, sociavel: 1 }, pode: () => !!parceiro(), cria: () => { const o = parceiro(); return { alvo: o, txt: "Abraçar " + nomeDe(o) }; }, ok: (ev, d) => aId(ev, /^s-abracar$/) && (ev.recebido || ev.a.alvo === d.alvo) },
  beijo:      { ic: "💋", pts: 90, peso: { romantico: 3 }, pode: () => !!parceiro(), cria: () => { const o = parceiro(); return { alvo: o, txt: "Dar um beijinho em " + nomeDe(o) }; }, ok: (ev, d) => aId(ev, /^s-beijo$/) && (ev.recebido || ev.a.alvo === d.alvo) },
  conversar:  { ic: "💬", pts: 70, peso: { sociavel: 3, timido: -.7 }, pode: () => !!parceiro(), cria: () => ({ txt: "Bater um papo com alguém" }), ok: ev => aId(ev, /^s-conversar$/) },
  bolo:       { ic: "🎂", pts: 140, peso: { cozinheiro: 2, comilao: 1.5 }, pode: () => temMovel("fogao", "fogareiro", "fogaoChique"), cria: () => ({ txt: "Cozinhar um bolo de morango" }), ok: ev => aId(ev, /^coz-bolo$/) },
  cozinhar:   { ic: "🍳", pts: 100, peso: { cozinheiro: 2.5 }, pode: () => temMovel("fogao", "fogareiro", "fogaoChique"), cria: () => ({ txt: "Cozinhar alguma coisa gostosa" }), ok: ev => aId(ev, /^coz-(?!ajuda)/) },
  filme:      { ic: "🎬", pts: 100, peso: { caseiro: 2, romantico: 1 }, pode: () => temMovel("tv", "tvG"), cria: () => ({ txt: "Ver um filme" }), ok: ev => aId(ev, /^(cinema|tv)$/) },
  regar:      { ic: "🪴", pts: 70, peso: { jardineiro: 3 }, pode: () => temMovel("canteiro", "planta", "samambaia"), cria: () => ({ txt: "Regar o jardim" }), ok: ev => aId(ev, /^regar$/) },
  dinheiro:   { ic: "💰", pts: 150, peso: { nerd: .5 }, cria: () => { const a = Math.floor(me.dinheiro) + 200; return { alvo: a, txt: "Ganhar $200 (chegar a $" + a + ")" }; }, ok: (ev, d) => ev.dinheiro != null && ev.dinheiro >= d.alvo },
  nivel:      { ic: "📈", pts: 160, peso: { nerd: 1, artista: 1, cozinheiro: 1 }, cria: () => {
      const ks = Object.keys(HAB).filter(k => habNv(k) < 10), pesoK = k => 1 + meusTracos().reduce((s, t) => s + (((TRACOS[t].xp || {})[k] || 1) - 1) * 4, 0) + (habXp(k) > 0 ? 1 : 0);
      let tot = ks.reduce((s, k) => s + pesoK(k), 0), r = Math.random() * tot, k = ks[0];
      for (const q of ks){ r -= pesoK(q); if (r <= 0){ k = q; break; } }
      return { alvo: k, txt: "Subir de nível em " + HAB[k].nome.toLowerCase() };
    }, ok: (ev, d) => ev.nivel === d.alvo },
  banho:      { ic: "🛁", pts: 60, peso: { organizado: 1 }, pode: () => temMovel("chuveiro", "ducha", "banheira"), cria: () => ({ txt: "Tomar um banho caprichado" }), ok: ev => aId(ev, /^(banho|banheira|jacuzzi)$/) },
  cochilo:    { ic: "😴", pts: 60, peso: { preguicoso: 2, dorminhoco: 2.5 }, cria: () => ({ txt: "Tirar um cochilo" }), ok: ev => aId(ev, /^(cochilo|dormir)$/) },
  carinhoPet: { ic: "🐾", pts: 80, peso: { bichos: 3.5 }, pode: () => !!pet, cria: () => ({ txt: "Fazer carinho em " + petNome() }), ok: ev => aId(ev, /^pet-carinho$/) },
  ler:        { ic: "📖", pts: 70, peso: { nerd: 3, caseiro: 1, timido: 1 }, pode: () => temMovel("estante"), cria: () => ({ txt: "Ler um livro" }), ok: ev => aId(ev, /^ler$/) },
  violao:     { ic: "🎸", pts: 100, peso: { artista: 3 }, pode: () => temMovel("violao"), cria: () => ({ txt: "Tocar violão" }), ok: ev => aId(ev, /^(violao|compor)$/) },
  pintar:     { ic: "🎨", pts: 110, peso: { artista: 3 }, pode: () => temMovel("cavalete"), cria: () => ({ txt: "Pintar um quadro" }), ok: ev => aId(ev, /^(pintar|retrato)$/) },
  videogame:  { ic: "🎮", pts: 70, peso: { brincalhao: 3, nerd: 1 }, pode: () => temMovel("game", "fliperama"), cria: () => ({ txt: "Jogar videogame" }), ok: ev => aId(ev, /^(jogar|fliperama)$/) },
  trabalhar:  { ic: "💼", pts: 90, peso: { preguicoso: -.7 }, pode: () => temMovel("pc") || casaZero, cria: () => ({ txt: "Fazer um turno de trabalho" }), ok: ev => aId(ev, /^trabalhar$/) },
  limpar:     { ic: "🧹", pts: 80, peso: { organizado: 3, bagunceiro: -1 }, cria: () => ({ txt: "Limpar uma sujeira da casa" }), ok: ev => aId(ev, /^limpar$/) },
  comer:      { ic: "🍽️", pts: 60, peso: { comilao: 3 }, pode: () => temMovel("mesa", "piquenique"), cria: () => ({ txt: "Comer um prato feito na mesa" }), ok: ev => aId(ev, /^comer$/) },
  passeio:    { ic: "🚗", pts: 180, peso: { aventureiro: 3, caseiro: -.8 }, pode: () => !!parceiro() && !visitando, cria: () => ({ txt: "Fazer um passeio de carro" }), ok: ev => !!ev.passeio },
  minigame:   { ic: "🎲", pts: 110, peso: { brincalhao: 2.5 }, pode: () => !!parceiro() && temMovel("tv", "tvG", "pc"), cria: () => ({ txt: "Jogar uma partida com alguém" }), ok: ev => aId(ev, /^minigame$/) }
};
const SLOTS = ["s0", "s1", "s2"];
function intervaloDesejo(){ return humorAgora().desejoMin * MIN; }
function sortearDesejo(usados){
  const tr = meusTracos(), l = [];
  for (const [id, d] of Object.entries(DESEJOS)){
    if (usados.has(id)) continue;
    try { if (d.pode && !d.pode()) continue; } catch(e){ continue; }
    const p = Math.max(.15, 1 + tr.reduce((s, t) => s + ((d.peso || {})[t] || 0), 0)); l.push([id, p]);
  }
  if (!l.length) return null;
  let r = Math.random() * l.reduce((s, x) => s + x[1], 0), id = l[0][0];
  for (const [k, p] of l){ r -= p; if (r <= 0){ id = k; break; } }
  const d = DESEJOS[id], extra = d.cria ? d.cria() : {};
  return Object.assign({ id, ic: d.ic, pts: d.pts, at: srvNow() }, extra);
}
function preencherDesejos(){
  if (!me || visitando || !me.dados.nome) return;
  const tem = !!me.dados.desejos, dd = me.dados.desejos || {}, t = srvNow();
  const vagos = SLOTS.filter(s => !dd[s] || !DESEJOS[dd[s].id] || t - (dd[s].at || 0) > 24 * HORA);
  if (!vagos.length || (tem && t < (dd.prox || 0))) return;
  const usados = new Set(SLOTS.map(s => dd[s] && dd[s].id).filter(Boolean)), upd = {};
  for (const s of tem ? vagos.slice(0, 1) : vagos){ const nv = sortearDesejo(usados); if (!nv) break; usados.add(nv.id); upd[s] = nv; }
  upd.prox = t + intervaloDesejo();
  me.dados.desejos = Object.assign({}, dd, upd);
  ref("jogadores/" + pid + "/desejos").update(upd).catch(() => {});
}
const desejoPend = new Set();
function checarDesejos(ev){
  if (!me || visitando) return;
  const dd = me.dados.desejos || {};
  for (const s of SLOTS){
    const d = dd[s], def = d && DESEJOS[d.id]; if (!def || desejoPend.has(s + d.at)) continue;
    let ok = false; try { ok = def.ok(ev, d); } catch(e){}
    if (ok){ desejoPend.add(s + d.at); cumprirDesejo(s, d); }
  }
}
function cumprirDesejo(s, d){
  const pts = d.pts || 50, novo = (+me.dados.pontos || 0) + pts;
  me.dados.pontos = novo; me.dados.desejos = Object.assign({}, me.dados.desejos, { [s]: null, prox: srvNow() + intervaloDesejo() });
  ref("jogadores/" + pid).update({ pontos: novo, ["desejos/" + s]: null, "desejos/prox": me.dados.desejos.prox }).catch(() => {});
  sfx("fanfarra"); toastEspecial("⭐ Desejo realizado!", d.ic + " " + d.txt + " · +" + pts + " pontos");
  addEfeito("desejo", { quieto: 1 }); flutua("⭐ +" + pts);
}
function trocarDesejo(s){
  const dd = me.dados.desejos || {}; if (!dd[s]) return;
  const prox = Math.min(dd.prox && dd.prox > srvNow() ? dd.prox : Infinity, srvNow() + 2 * MIN);
  me.dados.desejos = Object.assign({}, dd, { [s]: null, prox });
  ref("jogadores/" + pid + "/desejos").update({ [s]: null, prox }).catch(() => {});
  toast("Desejo dispensado. Outro aparece daqui a pouco.");
}
function comprarLoja12(it){
  if (!me || visitando) return;
  if ((+me.dados.pontos || 0) < it.pts){ toast("Faltam " + (it.pts - (+me.dados.pontos || 0)) + " pontos. Cumpra desejos ⭐"); return; }
  txn("jogadores/" + pid + "/pontos", cur => (+cur || 0) >= it.pts ? (+cur || 0) - it.pts : undefined).then(ok => {
    if (!ok){ toast("Não deu pra trocar agora."); return; }
    me.dados.pontos = (+me.dados.pontos || 0) - it.pts;
    if (it.horas){ const ate = Math.max(srvNow(), (dadosEu().bonus || {})[it.id] || 0) + it.horas * HORA; me.dados.bonus = Object.assign({}, me.dados.bonus, { [it.id]: ate }); ref("jogadores/" + pid + "/bonus/" + it.id).set(ate).catch(() => {}); }
    if (it.efeito) addEfeito("astral");
    if (it.item) ref("jogadores/" + pid + "/quadros").push({ t: "quadroNos", q: 3, at: TS() }).catch(() => {});
    sfx("moeda"); toastEspecial(it.ic + " " + it.nome, it.item ? "Está em Meus quadros, no cavalete ou nas habilidades." : "Aproveite!");
    refreshPanel("vida");
  });
}

// ---------------- fila de ações ----------------
let fila = [], filaExec = false, menuClique = false, dentro12 = false, autoMarcar = false, autoCtx = false, autoIni = 0, alvo12 = null, filaProxEm = 0, idleDesde = Date.now();
const IC12 = [[/^(dormir|cochilo)/, "😴"], [/^coz-|^pipoca/, "🍳"], [/comer|lanche|suco|docinho|^cafe|^cha$|jantar/, "🍽️"], [/banho|banheira|jacuzzi|maos/, "🛁"], [/^banheiro$/, "🚽"],
  [/^tv$|cinema|videos/, "📺"], [/^ler$|receitas/, "📖"], [/dancar/, "💃"], [/regar|plantar|colher|arrancar|podar/, "🪴"], [/^s-conversar/, "💬"], [/^s-beijo/, "💋"], [/^s-abracar/, "🫂"], [/^s-/, "😊"],
  [/^pet-/, "🐾"], [/limpar/, "🧹"], [/trabalhar/, "💼"], [/jogar|fliperama|minigame/, "🎮"], [/violao|compor/, "🎸"], [/pintar|retrato/, "🎨"], [/relaxar|poltrona|rede|pufe|toco|solzinho/, "🛋️"], [/admirar/, "👀"], [/compras/, "🛒"]];
function icDe(id){ id = id || ""; const r = IC12.find(([re]) => re.test(id)); return r ? r[1] : "✨"; }
const autoAcao = () => !!(me && me.acao && me.acao.def && me.acao.def.auto12);
function ocupado(){
  if (!me) return false;
  if (me.acao) return !autoAcao();
  return !!me.plano && !autoMarcar;
}
function enfileirar(nome, id, fn){
  if (fila.length >= 5){ toast("A fila já tem 5 coisas. Tire uma ou espere."); return; }
  fila.push({ nome: String(nome || "Ação").replace(/^💭 /, ""), id, ic: icDe(id), fn });
  syncFila(); renderFila(); sfx("pop");
  toast("Na fila (" + fila.length + "/5): " + fila[fila.length - 1].nome.toLowerCase());
}
function syncFila(){ if (me && !visitando) ref("jogadores/" + pid + "/fila").set(fila.length ? fila.map(f => ({ n: f.nome.slice(0, 40), ic: f.ic })) : null).catch(() => {}); }
// roda f0 marcando "o que estou indo fazer" (o 1º ícone da fila); toque do jogador tira a marca de vontade própria
function passa(nome, id, fn){
  if (!autoCtx){ autoMarcar = false; }
  alvo12 = { nome: autoCtx ? "💭 " + nome : nome, ic: icDe(id) };
  dentro12 = true; try { return fn(); } finally { dentro12 = false; }
}
function embrulhar(nomeFn, info){
  const f0 = window[nomeFn];
  window[nomeFn] = function(...args){
    if (dentro12 || !me) return f0.apply(this, args);
    const [nome, id] = info(...args);
    if (menuClique && !filaExec && ocupado()){ enfileirar(nome, id, () => window[nomeFn](...args)); return; }
    return passa(nome, id, () => f0.apply(this, args));
  };
}
embrulhar("useFurn", (id, a) => [a ? a.nome : "Ação", a ? a.id : ""]);
embrulhar("social", (id, s) => [(s ? s.nome : "Conversar") + " com " + nomeDe(id), "s-" + (s ? s.id : "")]);
embrulhar("petIrAte", a => [a ? a.nome : "Bichinho", a ? a.id : "pet-"]);
embrulhar("irLimpar", () => ["Limpar a sujeira", "limpar"]);
embrulhar("irParede", () => ["Ir até a parede", "admirar"]);
// itens dos menus de toque (móvel, pessoa, bichinho, parede): ocupado → vai pra fila
{ const f0 = openMenu; openMenu = function(p, titulo, items){
  return f0(p, titulo, (items || []).map(it => it && it.fn && !it.nota ? Object.assign({}, it, { fn: () => { menuClique = true; try { it.fn(); } finally { menuClique = false; } } }) : it));
}; }
function pararAtual(){
  if (!me) return;
  if (me.acao) setAcao(null);
  me.path = []; me.plano = null; alvo12 = null; renderHud(); renderFila();
}
function renderFila(){
  const box = $("fila12"); if (!box || !me) return;
  const cur = me.acao ? { nome: me.acao.nome, ic: icDe(me.acao.id) } : me.plano && alvo12 ? alvo12 : null;
  const sig = (cur ? cur.nome : "") + "|" + fila.map(f => f.nome).join("|");
  if (box.dataset.sig === sig) return; box.dataset.sig = sig;
  box.textContent = ""; box.hidden = !fila.length;
  if (!fila.length) return;
  if (cur){ const b = btn("", "fila12b atual", pararAtual); b.append(el("span", "ic", cur.ic)); b.setAttribute("aria-label", "Agora: " + cur.nome + ". Toque pra cancelar"); b.title = "Cancelar: " + cur.nome; box.append(b, el("span", "seta12", "›")); }
  fila.forEach((f, i) => {
    const b = btn("", "fila12b", () => { fila.splice(i, 1); syncFila(); renderFila(); });
    b.append(el("span", "ic", f.ic), el("span", "x", "×")); b.setAttribute("aria-label", "Tirar da fila: " + f.nome); b.title = f.nome; box.append(b);
  });
  box.append(el("small", "muted", fila.length + "/5"));
}
function filaProx(){
  if (!fila.length || me.acao || me.path.length || me.plano || performance.now() < filaProxEm) return;
  filaProxEm = performance.now() + 400;
  const it = fila.shift(); syncFila(); renderFila();
  filaExec = true; try { it.fn(); } catch(e){ console.error(e); } finally { filaExec = false; }
}

// ---------------- vontade própria ----------------
const vontadeOn = () => dadosEu().vontade !== false;
const AUTO_NAO = new Set(["namorar", "desejo", "telefone", "estatua"]);
const pertoDe = new Map(); // conversa automática: um intervalo por pessoa
function candidatosAuto(){
  const n = me.needs, out = [];
  const w = k => Math.pow(clamp(1 - (n[k] != null ? n[k] : 80) / 100, 0, 1), 2) * 3 + .03;
  const add = (aid, nome, ganho, fn, o) => {
    o = o || {};
    let s = o.base || 0;
    for (const [k, v] of Object.entries(ganho || {})) s += v > 0 ? v * w(k) : v * (n[k] < 30 ? .12 : .02);
    s = s * prefTraco(aid) * (o.mult || 1) / (1 + (o.dist || 0) / 25) * (.85 + Math.random() * .3);
    if (VIDA.ultId === aid) s *= .45;
    if (s > 0) out.push({ aid, nome, s, fn });
  };
  for (const [id, m] of Object.entries(moveis)){
    const c = CAT[m.t]; if (!c) continue;
    const dist = Math.abs(m.x - me.tx) + Math.abs(m.y - me.ty);
    let ok = null; const chega = () => ok != null ? ok : (ok = !!bfs(me.tx, me.ty, adjTo(m)));
    for (const a of c.acoes || []){
      if (a.antes || a.dinheiro || a.roupa || AUTO_NAO.has(a.id)) continue;
      if (a.id === "dormir" && n.energia > 45) continue;
      if (!chega()) break;
      add(a.id, a.nome, a.ganho, () => useFurn(id, a), { dist });
    }
    const b = baseT(m.t);
    if ((b === "mesa" || b === "piquenique") && n.fome < 55 && pratosOrdenados().length && MENU_EXTRA[m.t] && chega()){
      const it = MENU_EXTRA[m.t](id, m).find(x => x.fn && /^Comer /.test(x.nome)), rk = it && pratosOrdenados()[0][1].receita;
      if (it) add("comer", it.nome, (RECEITAS[rk] || {}).ganho || { fome: 40 }, it.fn, { dist });
    }
    if (b === "canteiro" && jardim[id] && !climaAgora() && chega()){
      const inf = plantaInfo(jardim[id]);
      if (inf && !inf.pronta && (inf.sede || inf.murcha)){ const it = (MENU_EXTRA.canteiro(id) || []).find(x => x.nome === "Regar"); if (it) add("regar", "Regar " + inf.s.nome.toLowerCase(), { diversao: 5 }, it.fn, { base: inf.murcha ? 1.2 : .6, dist }); }
    }
  }
  // conversar com quem está perto (social leve: só um papo; nada de beijo, namoro ou convite)
  const conv = SOCIAL.find(s => s.id === "conversar");
  for (const [id, j] of Object.entries(jogadores)){
    if (id === pid || !j || !j.online || !j.nome || (j.andar || 0) !== andarAtual || leva10Esconde(id, j)) continue;
    const a = j.acao && Date.now() - (j.acao.ini || 0) < (j.acao.dur || 0) + 3000 ? j.acao.id || "" : "";
    if (/^(dormir|cochilo|namoro|jantar|cinema|minigame|escada|trabalhar)$/.test(a)) continue;
    const d = Math.abs((j.x || 0) - me.tx) + Math.abs((j.y || 0) - me.ty);
    if (d > 8 || Date.now() - (pertoDe.get(id) || 0) < 4 * MIN) continue;
    add("s-conversar", "Conversar com " + nomeDe(id), conv.eu, () => { pertoDe.set(id, Date.now()); social(id, conv); }, { dist: d, mult: temTraco("romantico") && id === parceiro() ? 1.3 : 1 });
  }
  // bichinho
  if (pet && andarAtual === 0 && petCarinho() < 75) add("pet", "Fazer carinho em " + petNome(), { social: 10, diversao: 8 }, petFazerCarinho, { base: petTriste() ? 1 : .2 });
  // sujeira (organizado adora; bagunceiro nunca)
  const suj = Object.entries(sujeira).filter(([, q]) => sujVisivel(q)).sort((a, b) => Math.hypot(a[1].x - me.tx, a[1].y - me.ty) - Math.hypot(b[1].x - me.tx, b[1].y - me.ty))[0];
  if (suj) add("limpar", "Limpar a sujeira", { diversao: 2 }, () => irLimpar(suj[0]), { base: .4 + sujeiraNoAndar() * .12 });
  return out.sort((a, b) => b.s - a.s);
}
function agirSozinho(){
  idleDesde = Date.now(); VIDA.ultAgir = Date.now();
  const c = candidatosAuto()[0]; if (!c) return null;
  VIDA.ultId = c.aid;
  autoMarcar = true; autoCtx = true; autoIni = Date.now();
  try { c.fn(); } catch(e){ console.error(e); } finally { autoCtx = false; }
  if (!me.plano && !me.acao && !me.path.length) autoMarcar = false;
  return c;
}
VIDA.agir = agirSozinho;
VIDA.cands = () => candidatosAuto().map(c => c.aid + " " + c.s.toFixed(2));
function podeAgir(){
  return vontadeOn() && !visitando && mode === "live" && !painel && !menuEl && !document.hidden && !$("screenGame").hidden && !fila.length &&
    !me.acao && !me.path.length && !me.plano && !leva10Esconde(pid, jogadores[pid]) && !(typeof jogoAtivoDe === "function" && jogoAtivoDe(pid));
}
for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => { idleDesde = Date.now(); }, { passive: true, capture: true });

// ---------------- ganchos nas ações ----------------
// ação nova: traços, habilidades e recompensas mexem no que ela enche, no tempo e no pagamento
function modDef(a, d){
  const n = Object.assign({}, d, { _v12: 1 }), id = a.id || "";
  if (d.ganho){
    const g = {}, tr = meusTracos();
    for (const [k, v] of Object.entries(d.ganho)){
      let m = 1;
      if (v > 0){
        for (const t of tr){ const gt = TRACOS[t].ganho; if (gt && gt[id]) m *= gt[id]; }
        if (/^s-/.test(id) && k === "social") m *= 1 + .04 * (habNv("charme") - 1);
        if (/dancar/.test(id) && k === "diversao") m *= 1 + .04 * (habNv("danca") - 1);
      } else if (k === "energia"){ if (bonusAtivo("nuncaCansado")) m = 0; else if (id === "trabalhar" && tr.includes("preguicoso")) m = 1.5; }
      g[k] = v * m;
    }
    n.ganho = g;
  }
  if (id === "trabalhar" && d.dinheiro) n.dinheiro = Math.round(d.dinheiro * (1 + .05 * (habNv("logica") - 1)) * (bonusAtivo("ima") ? 1.2 : 1));
  return n;
}
function durMult(a){
  const id = a.id || "";
  if (/^coz-/.test(id) && id !== "coz-ajuda") return (bonusAtivo("pePano") ? .5 : 1) * (temTraco("cozinheiro") ? .8 : 1) * (1 - .025 * (habNv("culinaria") - 1));
  if (id === "trabalhar") return humorAgora().trab;
  if (id === "pintar" || id === "retrato") return 1 - .03 * (habNv("pintura") - 1);
  return 1;
}
{ const f0 = setAcao; setAcao = function(a){
  if (a && me && a !== me.acao && a.def && !a.def._v12){
    a.def = modDef(a, a.def);
    const k = durMult(a); if (k !== 1) a.dur = Math.max(1500, Math.round(a.dur * k));
    if (autoMarcar){ a.def.auto12 = 1; a.nome = "💭 " + a.nome; autoMarcar = false; }
  }
  const r = f0(a);
  if (a && (a.id === "violao" || a.id === "compor")){ VIOL.meu = pid + a.ini; tocarViolao(VIOL.meu, a.ini, a.dur); }
  renderFila();
  return r;
}; }
let emTermino = false;
{ const f0 = acaoTerminada; acaoTerminada = function(a){
  emTermino = true; try { f0(a); } finally { emTermino = false; }
  try { vidaAcaoFim(a); } catch(e){ console.error(e); }
}; }
function vidaAcaoFim(a){
  if (!me || visitando) return;
  const id = a.id || "", d = a.def || {};
  for (const [k, xp] of xpDaAcao(a)) ganharHab(k, xp);
  if (d.auto12) idleDesde = Date.now();
  // efeitos de humor
  if (id === "comer"){ const esp = Object.values(RECEITAS12).some(r => (a.nome || "").toLowerCase().includes(r.nome.toLowerCase())); addEfeito(esp ? "banquete" : "comeuBem", temTraco("comilao") ? { v: (esp ? 3 : 2) + 1 } : null); }
  else if (/^(lanche|suco|docinho)$/.test(id) && temTraco("comilao")) addEfeito("comeuBem");
  else if (id === "dormir"){
    const par = a.mov && Object.entries(jogadores).some(([k, j]) => k !== pid && j.online && j.acao && /^(dormir|cochilo)$/.test(j.acao.id) && j.acao.mov === a.mov);
    addEfeito(par ? "abracadinho" : "descansado");
  }
  else if (id === "cochilo" && temTraco("dorminhoco")) addEfeito("descansado", { v: 1 });
  else if (/^(banho|banheira|jacuzzi)$/.test(id)) addEfeito("banho");
  else if (/^s-(beijo|abracar)$/.test(id) && temTraco("romantico")) addEfeito("apaixonado");
  else if (id === "pet-carinho" && temTraco("bichos")) addEfeito("bichinho");
  else if (/^(regar|colher|plantar)$/.test(id) && temTraco("jardineiro")) addEfeito("jardim");
  else if (id === "limpar" && temTraco("organizado")) addEfeito("ordem");
  else if (id === "ler" && temTraco("nerd")) addEfeito("mente");
  else if (id === "cinema" && a.junto) addEfeito("noite");
  else if (id === "violao" || id === "compor") addEfeito("musica", id === "compor" ? { v: 3, min: 60 } : null);
  // culinária: porções extras e orgulho de chef
  if (/^coz-/.test(id) && id !== "coz-ajuda"){
    const rk = id.slice(4), nv = habNv("culinaria"), extra = Math.floor((nv - 1) / 3);
    if (RECEITAS[rk] && extra > 0){ ref("casa/pratos").push({ receita: rk, porcoes: extra, por: pid, at: TS(), chef: nv }).catch(() => {}); toast("Mão de chef: +" + extra + (extra > 1 ? " porções" : " porção") + " de " + RECEITAS[rk].nome.toLowerCase() + " 🧑‍🍳"); }
    if (nv >= 5) addEfeito("chef");
  }
  checarDesejos({ a });
}
{ const f0 = tarefaCheck; tarefaCheck = function(a){
  f0(a);
  if (emTermino || !me || !a || !/^s-/.test(a.id || "")) return;
  // veio de outra pessoa (evento social recebido)
  if (/^s-(abracar|beijo|cocegas)$/.test(a.id)) addEfeito("carinho");
  checarDesejos({ a, recebido: 1 });
}; }
{ const f0 = pagarJogo; pagarJogo = function(id, g){
  const ja = jogoPago[id]; f0(id, g);
  if (ja || !me || !g) return;
  ganharHab("logica", 8); if (g.vencedor === pid) addEfeito("venceu");
  checarDesejos({ a: { id: "minigame" } });
}; }
{ const f0 = abrirPresente; abrirPresente = function(id){
  const g = presentes[id], meu = g && g.para === pid && !g.aberto; f0(id);
  if (meu) setTimeout(() => { if (!presentes[id] || presentes[id].aberto) addEfeito("presente"); }, 1500);
}; }
{ const f0 = chegarEmCasa; chegarEmCasa = function(p){
  f0(p); if (!me) return;
  addEfeito("passeio", temTraco("aventureiro") ? { v: 6, min: 600 } : temTraco("caseiro") ? { v: 2 } : null);
  checarDesejos({ passeio: 1 });
}; }
{ const f0 = celebrarReencontro; celebrarReencontro = function(id, gap){ f0(id, gap); addEfeito("reencontro"); }; }
{ const f0 = terminarJantarMeu; terminarJantarMeu = function(id){ const era = me && me.acao && me.acao.id === "jantar"; f0(id); if (era){ ganharHab("charme", 10); checarDesejos({ a: { id: "jantar" } }); } }; }
// jardinagem: rega adianta o crescimento; colheita pode vir em dobro
{ const f0 = regar; regar = function(id){
  const nv = habNv("jardinagem"); if (nv <= 1) return f0(id);
  return txn("casa/jardim/" + id, cur => {
    if (!cur) return;
    const t = srvNow(), s = SEMENTES[cur.tipo];
    cur.cresc = crescAte(cur, t).g + (s ? s.horas * HORA * .04 * (nv - 1) : 0); cur.ultimaRega = t; cur.regouPor = pid;
    return cur;
  }).then(ok => toast(ok ? "Planta regada com mão de jardineiro (+" + 4 * (nv - 1) + "% de crescimento) 🌱" : "Não tinha planta pra regar."));
}; }
{ const f0 = colher; colher = function(id){
  const p = jardimAntes[id], nv = habNv("jardinagem");
  return Promise.resolve(f0(id)).then(() => {
    const s = p && SEMENTES[p.tipo]; if (!s || nv < 2 || (jardim[id] && jardim[id].plantado === p.plantado)) return;
    if (Math.random() >= .1 * (nv - 1)) return;
    if (s.colhe.moedas){ const v = Math.round(s.colhe.moedas * .3); ganhar(v); toast("Colheita extra de jardineiro: +$" + v + " 🌻"); }
    else { const k = Object.keys(s.colhe.despensa)[0]; mexerDespensa({ [k]: 1 }); toast("Colheita extra: +1 " + INGREDIENTES[k].nome.toLowerCase() + " 🌻"); }
  });
}; }
// necessidades: traços mudam a queda; "nunca cansado" segura a energia. Fila e vontade própria andam aqui (só com o laço rodando)
let vidaSeg = 0, notaSeg = 0;
document.addEventListener("DOMContentLoaded", () => { const f0 = update; update = function(dt){
  const e0 = me.needs.energia;
  f0(dt);
  VIDA.ultUpd = Date.now();
  const tr = meusTracos();
  if (tr.length) for (const nd of NEEDS){ let m = 1; for (const t of tr) m *= ((TRACOS[t].queda || {})[nd.id]) || 1; if (m !== 1) me.needs[nd.id] = clamp(me.needs[nd.id] - nd.queda * dt * (m - 1), 0, 100); }
  if (bonusAtivo("nuncaCansado")) me.needs.energia = Math.max(me.needs.energia, e0);
  filaProx();
  if (me.acao || me.path.length || me.plano || mode !== "live" || painel || menuEl) idleDesde = Math.max(idleDesde, Date.now() - (me.acao || me.path.length || me.plano ? 0 : VIDA.ocioso / 2));
  if (autoMarcar && !me.plano && !me.acao && !me.path.length && Date.now() - autoIni > 3000) autoMarcar = false;
  vidaSeg += dt;
  if (vidaSeg > 1){ vidaSeg = 0; if (Date.now() - idleDesde > VIDA.ocioso && podeAgir()) agirSozinho(); }
  notaSeg += dt;
  if (notaSeg > .7){ notaSeg = 0; notasViolao(); }
};
  // precisa de 60 fps enquanto um textinho sobe
  const f1 = precisaFluido; precisaFluido = function(){ return f1() || flutua12.some(f => Date.now() - f.at < 1800 && Date.now() >= f.at); };
});

// ---------------- hobbies: violão, cavalete, livro de receitas ----------------
Object.assign(CAT, {
  violao:        { nome: "Violão", w: 1, h: 1, preco: 220, livre: 1, acoes: [{ id: "violao", nome: "Tocar violão", dur: 10, ganho: { diversao: 25 } }] },
  cavalete:      { nome: "Cavalete de pintura", w: 1, h: 1, preco: 260, livre: 1, acoes: [{ id: "pintar", nome: "Pintar um quadro", dur: 14, ganho: { diversao: 22 }, fim: () => pintarFim(null) }] },
  livroReceitas: { nome: "Livro de receitas", w: 1, h: 1, preco: 120, acoes: [{ id: "receitas", nome: "Estudar receitas", dur: 8, ganho: { diversao: 8 } }] }
});
Object.assign(TOP, { violao: 13, cavalete: 14, livroReceitas: 7 });
Object.assign(FRAME6, { violao: (on, tm) => on ? 1 + Math.floor(tm / 140) % 2 : 0, cavalete: (on, tm) => on ? 1 + Math.floor(tm / 900) % 3 : 0 });
FURN_EXTRA.violao = (x, y, f) => {
  const b = "#E39A48", bL = "#F6C27A", bD = "#B8702E", bDD = "#8C5222", br = "#5E4430";
  R(x + 4, y + 13, 1, 3, C.metalD); R(x + 11, y + 13, 1, 3, C.metalD); R(x + 5, y + 13, 6, 1, C.metalD); R(x + 7, y + 14, 2, 2, C.metalD); // suporte
  R(x + 7, y - 8, 2, 10, br); P(x + 7, y - 8, "#7A5A3E");
  rbox(x + 6, y - 13, 4, 6, "#4E3826"); R(x + 7, y - 12, 2, 1, "#6B4E36");
  for (const yy of [-12, -10]){ P(x + 5, y + yy, C.metalL); P(x + 10, y + yy, C.metalL); }
  rbox(x + 4, y + 1, 8, 6, b); rbox(x + 3, y + 5, 10, 9, b);
  R(x + 5, y + 2, 1, 3, bL); R(x + 4, y + 6, 1, 6, bL); R(x + 11, y + 7, 1, 5, bD); R(x + 4, y + 13, 8, 1, bD); P(x + 10, y + 2, bD);
  R(x + 6, y + 5, 4, 3, bDD); R(x + 7, y + 5, 2, 3, "#2E2638"); // boca
  R(x + 6, y + 10, 4, 1, "#4E3826"); // cavalete das cordas
  for (let j = -7; j < 10; j++) if (j < 5 || j > 7) P(x + 8, y + j, "#F4E9D0");
  for (let j = -7; j < -1; j += 2) P(x + 7, y + j, "#C6D0DA"); // trastes
  if (f){ const s = f === 1 ? 7 : 9; for (let j = 1; j < 10; j += 2) if (j < 5 || j > 7) P(x + s, y + j, "#FFF8EC"); } // corda vibrando
};
FURN_EXTRA.cavalete = (x, y, f) => {
  const w = C.wood, wD = C.woodD, wL = C.woodL;
  R(x + 7, y + 2, 2, 12, sh(wD, -.15)); // perna de trás
  for (let j = 0; j < 26; j++){ const yy = y - 10 + j, d = Math.floor(j / 8); P(x + 6 - d, yy, wD); P(x + 9 + d, yy, wD); }
  R(x + 6, y - 13, 4, 3, w); R(x + 6, y - 13, 4, 1, wL); // topo
  rbox(x + 2, y - 10, 12, 12, "#FFF8EC"); R(x + 3, y - 10, 10, 1, "#FFFFFF");
  const px = x + 3, py = y - 9;
  if (!f){ R(px + 2, py + 6, 6, 1, "#E2D8EC"); R(px + 4, py + 3, 2, 1, "#E2D8EC"); P(px + 6, py + 4, "#E2D8EC"); } // esboço
  else {
    R(px, py, 10, 5, "#BFE5F6");
    if (f >= 2){ R(px, py + 5, 10, 4, "#8DBB8A"); R(px + 2, py + 4, 4, 1, "#8DBB8A"); P(px + 1, py + 5, "#A8DC8C"); }
    else R(px + 1, py + 6, 6, 2, "#E2D8EC");
    if (f >= 3){ R(px + 7, py + 1, 2, 2, "#FFE08A"); P(px + 4, py + 6, "#EE9AB2"); P(px + 6, py + 7, "#F6C667"); }
  }
  R(x + 1, y + 2, 14, 2, w); R(x + 1, y + 2, 14, 1, wL); // apoio
  R(x + 2, y + 1, 2, 1, C.coral); R(x + 5, y + 1, 2, 1, C.sky); R(x + 11, y + 1, 2, 1, C.gold); // tubinhos de tinta
  R(x + 12, y - 2, 1, 4, C.woodDD); P(x + 12, y - 3, f ? C.coral : "#F1EDF7"); // pincel
};
FURN_EXTRA.livroReceitas = (x, y) => {
  R(x + 7, y + 3, 2, 10, C.woodD); R(x + 4, y + 13, 8, 2, C.wood); R(x + 4, y + 13, 8, 1, C.woodL); // pé
  rbox(x + 2, y - 1, 12, 5, C.wood); R(x + 3, y - 1, 10, 1, C.woodL); // tampo
  R(x + 1, y - 7, 14, 8, "#D9483D"); R(x + 1, y + 0, 14, 1, "#B53A30"); // capa
  R(x + 2, y - 7, 6, 7, "#FFF4E0"); R(x + 8, y - 7, 6, 7, "#FFF8EC"); R(x + 7, y - 7, 2, 7, "#E9D8BE");
  for (let k = 0; k < 3; k++) R(x + 3, y - 5 + k * 2, 4, 1, "#C9B79A");
  R(x + 9, y - 6, 4, 3, "#F9C9D6"); R(x + 9, y - 6, 4, 1, "#FFFFFF"); P(x + 11, y - 7, "#E8445E"); R(x + 9, y - 3, 4, 1, "#C9B79A"); // bolo desenhado
  R(x + 10, y + 1, 1, 3, C.rose); // fitinha
};
MENU_EXTRA.violao = () => habNv("musica") >= 3 ? [{ nome: "Compor uma música", info: "Música nível 3+", fn: () => usarPrimeiro("violao", { id: "compor", nome: "Compondo uma música", dur: 16, ganho: { diversao: 35 } }) }]
  : [{ nota: 1, nome: "Música nível " + habNv("musica") + ": no 3 destrava compor." }];
MENU_EXTRA.cavalete = () => {
  const it = [];
  if (habNv("pintura") >= 4) it.push({ nome: "Pintar retrato do casal", info: "Pintura nível 4+", fn: () => usarPrimeiro("cavalete", { id: "retrato", nome: "Pintando o retrato do casal", dur: 18, ganho: { diversao: 28, social: 8 }, fim: () => pintarFim("casal") }) });
  it.push({ nome: "Meus quadros", info: Object.keys(dadosEu().quadros || {}).length + " guardados", fn: openQuadros });
  return it;
};
MENU_EXTRA.livroReceitas = () => {
  const nv = habNv("culinaria");
  return [{ nota: 1, nome: "Culinária nível " + nv }].concat(Object.entries(RECEITAS12).map(([, r]) => ({ nota: 1, nome: (nv >= r.hab ? "✓ " : "🔒 ") + r.nome + (nv >= r.hab ? "" : " · nível " + r.hab) })));
};
const usarPrimeiro = (t, a) => { const id = Object.keys(moveis).filter(k => baseT(moveis[k].t) === t).sort()[0]; if (id) useFurn(id, a); };
// violão: acordes sintetizados (C, G, Am, F), quem está perto ouve e ganha humor
const VIOL = { tocados: new Set(), bus: null, dono: null };
function tocarViolao(chave, ini, dur){
  if (VIOL.tocados.has(chave) || !audioPronto() || !prefOn("casinha-som") || !AUD.sfx) return;
  VIOL.tocados.add(chave); if (VIOL.tocados.size > 40) VIOL.tocados.clear();
  try {
    const c = AUD.ctx, bus = c.createGain(); bus.gain.value = .9; bus.connect(AUD.sfx);
    if (VIOL.bus) try { VIOL.bus.gain.setTargetAtTime(0, c.currentTime, .1); } catch(e){}
    VIOL.bus = bus; VIOL.dono = chave;
    const ACORDES = [[48, 55, 60, 64, 67], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [41, 48, 53, 57, 60]];
    const passou = Math.max(0, (Date.now() - ini) / 1000), resto = Math.min(16, dur / 1000 - passou), t0 = c.currentTime + .05;
    for (let i = 0; i * 1.1 < resto; i++){
      const ac = ACORDES[(Math.floor(passou / 1.1) + i) % 4], baixo = i % 2 === 0;
      ac.forEach((m, k) => tom(bus, t0 + i * 1.1 + (baixo ? k : ac.length - 1 - k) * .018, { f: mtof(m), tipo: "triangle", dur: 1.25, g: .05, at: .003, lp: 2600 }));
      tom(bus, t0 + i * 1.1 + .55, { f: mtof(ac[2] + 12), tipo: "triangle", dur: .5, g: .025, lp: 2600 }); // batida no meio
    }
  } catch(e){ AUD.erro = String(e); }
}
function notasViolao(){
  if (!me) return;
  const t = Date.now();
  for (const [id, j] of Object.entries(jogadores)){
    const a = id === pid ? me.acao : j && j.online && j.acao;
    if (!a || !/^(violao|compor)$/.test(a.id || "") || t - (a.ini || 0) > (a.dur || 0) || (id !== pid && (j.andar || 0) !== andarAtual)) continue;
    const m = a.mov && moveis[a.mov]; if (!m) continue;
    particles.push({ x: (m.x + .5) * T + Math.random() * 8 - 4, y: m.y * T - 8, vy: -9 - Math.random() * 6, vx: Math.random() * 6 - 3, life: 1.5, kind: "note" });
    // quem ouve perto: som e humor (uma vez por música)
    if (id !== pid && Math.hypot((m.x || 0) - me.tx, (m.y || 0) - me.ty) < 7){
      const k = id + a.ini; if (!VIOL.tocados.has(k)){ tocarViolao(k, a.ini, a.dur); if (!visitando) addEfeito("musica", a.id === "compor" ? { v: 3, min: 45 } : null); }
    }
  }
  // parou de tocar (cancelou): o som do meu violão some
  if (VIOL.bus && VIOL.dono && VIOL.dono === VIOL.meu && !(me.acao && /^(violao|compor)$/.test(me.acao.id || "") && VIOL.dono === pid + me.acao.ini)){
    try { VIOL.bus.gain.setTargetAtTime(0, AUD.ctx.currentTime, .15); } catch(e){}
    VIOL.bus = null; VIOL.dono = null; VIOL.meu = null;
  }
}

// ---------------- quadros pintados ----------------
const TEMAS_Q = { paisagem: "Paisagem", flor: "Flores", gato: "Gatinho", mar: "Mar", abstrato: "Abstrato", casal: "Retrato do casal" };
const QUAL = ["", "Rabisco", "Bonito", "Obra-prima"], QUAL_PRECO = [0, 25, 70, 160];
function drawQuadro12(tema, q, x, y){
  const mold = q === 3 ? "#E0A93A" : q === 2 ? C.wood : C.woodD, moldL = q === 3 ? "#F6C667" : q === 2 ? C.woodL : C.wood;
  R(x + 2, y + 3, 12, 10, mold); R(x + 2, y + 3, 12, 1, moldL); R(x + 2, y + 12, 12, 1, sh(mold, -.25));
  const ix = x + 3, iy = y + 4; // 10 x 8 por dentro
  const tosco = q === 1;
  switch (tema){
    case "paisagem":
      R(ix, iy, 10, 5, "#9FD3F2"); R(ix, iy + 5, 10, 3, "#6DB37A"); R(ix + 1, iy + 4, 4, 1, "#6DB37A"); P(ix + 2, iy + 3, tosco ? "#6DB37A" : "#8DBB8A");
      R(ix + (tosco ? 6 : 7), iy + 1, 2, 2, "#FFE08A");
      if (!tosco){ R(ix + 6, iy + 4, 4, 1, "#4FA568"); R(ix + 2, iy + 1, 3, 1, "#FFFFFF"); }
      if (q === 3){ R(ix + 1, iy + 5, 1, 2, C.woodD); R(ix, iy + 3, 3, 2, C.leafD); P(ix + 5, iy + 6, "#EE9AB2"); P(ix + 8, iy + 7, "#FFE08A"); }
      break;
    case "flor":
      R(ix, iy, 10, 8, "#F9E3C8"); R(ix + 3, iy + 5, 4, 3, tosco ? "#7FB8E8" : "#5F96C8"); R(ix + 4, iy + 2, 1, 3, C.leaf);
      R(ix + 3, iy, 3, 3, "#EE9AB2"); P(ix + 4, iy + 1, C.gold);
      if (!tosco){ P(ix + 5, iy + 3, C.leafL); R(ix + 3, iy + 5, 4, 1, "#9FD3F2"); }
      if (q === 3){ R(ix + 6, iy + 1, 2, 2, "#B49CF4"); P(ix + 6, iy + 3, C.leaf); P(ix + 1, iy + 1, "#FFFFFF"); }
      break;
    case "gato":
      R(ix, iy, 10, 8, "#E2D6FA"); R(ix + 2, iy + 3, 6, 4, "#E8A55A"); P(ix + 2, iy + 2, "#E8A55A"); P(ix + 7, iy + 2, "#E8A55A");
      P(ix + 3, iy + 4, C.ink); P(ix + 6, iy + 4, C.ink);
      if (!tosco){ P(ix + 4, iy + 5, "#E8607A"); P(ix + 5, iy + 5, "#E8607A"); P(ix + 3, iy + 2, "#F4A0B4"); P(ix + 6, iy + 2, "#F4A0B4"); }
      if (q === 3){ R(ix + 2, iy + 6, 6, 1, "#FBD39A"); P(ix + 1, iy + 5, "#FFFFFF"); P(ix + 8, iy + 5, "#FFFFFF"); pixHeart(ix + 6, iy, "#E8445E"); }
      break;
    case "mar":
      R(ix, iy, 10, 4, "#BFE5F6"); R(ix, iy + 4, 10, 4, "#378ADD"); R(ix + 1, iy + 5, 3, 1, "#7FB8E8"); R(ix + 6, iy + 6, 3, 1, "#7FB8E8");
      if (!tosco){ R(ix + 3, iy + 3, 4, 1, C.woodD); R(ix + 5, iy, 1, 3, C.woodDD); R(ix + 6, iy + 1, 2, 2, "#FFFFFF"); }
      if (q === 3){ R(ix + 8, iy, 2, 2, "#FFE08A"); P(ix + 1, iy + 1, "#FFFFFF"); P(ix + 2, iy + 1, "#FFFFFF"); P(ix + 8, iy + 7, "#C4E8F8"); }
      break;
    case "abstrato":
      R(ix, iy, 10, 8, "#FFF4E0"); R(ix + 1, iy + 1, tosco ? 5 : 4, 3, "#E8735F"); R(ix + 5, iy + 4, 4, 3, "#378ADD");
      if (!tosco){ R(ix + 6, iy + 1, 3, 1, "#F6C667"); P(ix + 2, iy + 6, "#7FD1B2"); R(ix + 1, iy + 6, 1, 1, C.ink); }
      if (q === 3){ R(ix + 4, iy + 2, 1, 4, C.ink); P(ix + 8, iy + 6, "#B49CF4"); P(ix + 3, iy + 5, "#E8445E"); }
      break;
    default: { // retrato do casal (cores de quem mora na casa)
      R(ix, iy, 10, 8, "#F9C9D6");
      const cs = casalVisual();
      [[0, 1], [1, 6]].forEach(([i, dx]) => {
        const v = cs[i] || { cabelo: i ? 3 : 0, pele: i ? 0 : 2, roupa: i ? 4 : 2 };
        R(ix + dx, iy + 2, 3, 1, CABELOS[v.cabelo]); R(ix + dx, iy + 3, 3, 2, PELES[v.pele]); R(ix + dx, iy + 5, 3, 3, ROUPAS[v.roupa]);
        if (!tosco){ P(ix + dx + (i ? 2 : 0), iy + 3, CABELOS[v.cabelo]); P(ix + dx + 1, iy + 4, sh(PELES[v.pele], -.3)); }
      });
      pixHeart(ix + 3, iy, q === 1 ? "#F49AAE" : "#E8445E");
    }
  }
  if (q === 3){ P(x + 2, y + 3, "#FFF8D0"); P(x + 13, y + 3, "#FFF8D0"); P(x + 2, y + 12, "#FFF8D0"); P(x + 13, y + 12, "#FFF8D0"); }
}
for (const tema of Object.keys(TEMAS_Q)) for (const q of [1, 2, 3]){
  DECOR_CAT["pint_" + tema + "_" + q] = { nome: TEMAS_Q[tema] + " (" + QUAL[q].toLowerCase() + ")", preco: QUAL_PRECO[q], loja: 1, pintado: 1,
    chave: tema === "casal" ? () => casalVisual().map(v => [v.cabelo, v.pele, v.roupa].join(".")).join("-") : undefined, d(x, y){ drawQuadro12(tema, q, x, y); } };
}
DECOR_CAT.quadroNos = { nome: "Quadro “Nós dois”", preco: 200, loja: 1, pintado: 1, chave: () => casalVisual().map(v => [v.cabelo, v.pele, v.roupa].join(".")).join("-"), d(x, y){
  R(x + 1, y + 2, 14, 12, "#E0A93A"); R(x + 1, y + 2, 14, 1, "#F6C667"); R(x + 1, y + 13, 14, 1, "#B9822A");
  R(x + 2, y + 3, 12, 10, "#FCE9F1"); R(x + 2, y + 11, 12, 2, "#F9C9D6");
  const cs = casalVisual();
  [[0, 3], [1, 9]].forEach(([i, dx]) => {
    const v = cs[i] || { cabelo: i ? 3 : 0, pele: i ? 0 : 2, roupa: i ? 4 : 2 };
    R(x + dx, y + 6, 4, 1, CABELOS[v.cabelo]); R(x + dx, y + 7, 4, 3, PELES[v.pele]); P(x + dx + (i ? 3 : 0), y + 7, CABELOS[v.cabelo]);
    P(x + dx + 1, y + 8, C.ink); P(x + dx + 2, y + 8, C.ink); R(x + dx, y + 10, 4, 3, ROUPAS[v.roupa]);
  });
  pixHeart(x + 6, y + 3, "#E8445E"); P(x + 1, y + 2, "#FFF8D0"); P(x + 14, y + 2, "#FFF8D0"); P(x + 1, y + 13, "#FFF8D0"); P(x + 14, y + 13, "#FFF8D0");
} };
function pintarFim(tema){
  if (!me || visitando) return;
  const nv = habNv("pintura"), hb = { muitoFeliz: .15, feliz: .08, ok: 0, chateado: -.08, triste: -.15 }[humorAgora().id] || 0;
  const r = nv / 10 + hb + Math.random() * .5, q = r > .85 ? 3 : r > .45 ? 2 : 1;
  if (!tema){ const l = Object.keys(TEMAS_Q).filter(k => k !== "casal"); tema = l[Math.floor(Math.random() * l.length)]; }
  const t = "pint_" + tema + "_" + q;
  ref("jogadores/" + pid + "/quadros").push({ t, q, at: TS() }).catch(() => {});
  toast("Pintou “" + TEMAS_Q[tema] + "” (" + QUAL[q].toLowerCase() + "). Está em Meus quadros 🖼️");
  if (q === 3) addEfeito("obra");
  if (temTraco("artista")) addEfeito("inspirado", { quieto: q === 3 ? 1 : 0 });
}
const valorQuadro = qd => Math.round((DECOR_CAT[qd.t] ? DECOR_CAT[qd.t].preco : 20) * (1 + .05 * (habNv("pintura") - 1)));
function openQuadros(){
  openPanel("quadros", "Meus quadros 🖼️", corpo => {
    const info = el("p", "muted", "Pendure na parede de cima de um cômodo (fica pra casa toda) ou venda. Quanto maior a habilidade de pintura, mais bonito e valioso."), lista = el("div", "list");
    corpo.append(info, lista);
    let sig = null;
    const upd = () => {
      const qs = Object.entries(dadosEu().quadros || {}).filter(([, q]) => q && DECOR_CAT[q.t]).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      const s = JSON.stringify(qs.map(([k]) => k)); if (s === sig) return; sig = s;
      lista.textContent = "";
      if (!qs.length){ lista.append(el("p", "muted", "Nenhum quadro guardado. Pinte no cavalete 🎨")); return; }
      for (const [k, qd] of qs){
        const row = el("div", "rowi"), esq = el("div", "esq12"), tx = el("div", "tx"), bs = el("div", "bts12"), cv = decorIcone(qd.t, 64, 48);
        cv.className = "qd12"; tx.append(el("strong", null, DECOR_CAT[qd.t].nome), el("small", null, "Vale $" + valorQuadro(qd)));
        esq.append(cv, tx);
        bs.append(btn("Pendurar", "btn small", () => pendurarQuadro(k, qd)), btn("Vender", "btn ghost small", () => venderQuadro(k, qd)));
        row.append(esq, bs); lista.append(row);
      }
    };
    upd(); return upd;
  });
}
function pendurarQuadro(k, qd){
  closePanel(); setMode("build"); buildTab = "parede";
  tool = { kind: "decor", t: qd.t, quadro: k, preco: 0 }; renderBuild();
  toast("Toque numa parede marcada de verde pra pendurar o quadro.");
}
function venderQuadro(k, qd){
  const v = valorQuadro(qd);
  txn("jogadores/" + pid + "/quadros/" + k, cur => cur ? null : undefined).then(ok => { if (!ok){ toast("Esse quadro já saiu."); return; } ganhar(v); toast("Quadro vendido: +$" + v); });
}
{ const f0 = leva6BuildClick; leva6BuildClick = function(tx, ty, p){
  if (!(tool && tool.kind === "decor" && tool.quadro)) return f0(tx, ty, p);
  if (!decorSpotOk(tx, ty)){ toast("Quadro vai na parede de cima de um cômodo (as marcadas de verde)."); return true; }
  const k = tool.quadro, t = tool.t; tool = null; renderBuild();
  txn("jogadores/" + pid + "/quadros/" + k, cur => cur ? null : undefined).then(ok => {
    if (!ok){ toast("Esse quadro não está mais com você."); return; }
    const novo = { t, x: tx, y: ty, por: pid }; if (andarAtual === 1) novo.andar = 1;
    ref("casa/decor").push(novo).then(() => { toast(DECOR_CAT[t].nome + " na parede 🖼️"); sfx("pop"); }, () => toast("Não deu pra pendurar agora."));
  });
  return true;
}; }

// ---------------- receitas novas (culinária + livro de receitas) ----------------
Object.assign(INGREDIENTES, { queijo: { nome: "Queijo", preco: 7 }, maca: { nome: "Maçã", preco: 6 }, arroz: { nome: "Arroz", preco: 5 }, peixe: { nome: "Peixe", preco: 14 }, chocolate: { nome: "Chocolate", preco: 8 } });
const RECEITAS12 = {
  brigadeiro: { nome: "Brigadeiro", ing: { chocolate: 1, leite: 1 }, dur: 8, porcoes: 4, ganho: { fome: 15, diversao: 20 }, hab: 2 },
  lasanha:    { nome: "Lasanha", ing: { macarrao: 1, queijo: 1, tomate: 2, leite: 1 }, dur: 18, porcoes: 5, ganho: { fome: 70, diversao: 8 }, hab: 3 },
  torta:      { nome: "Torta de maçã", ing: { farinha: 1, maca: 2, ovo: 1 }, dur: 16, porcoes: 4, ganho: { fome: 40, diversao: 18 }, hab: 5 },
  sushi:      { nome: "Sushi caseiro", ing: { arroz: 1, peixe: 1, alface: 1 }, dur: 14, porcoes: 3, ganho: { fome: 50, energia: 10, diversao: 10 }, hab: 7 }
};
Object.assign(RECEITAS, RECEITAS12);
const temLivro = () => temMovel("livroReceitas");
const receitaOk = rk => !RECEITAS12[rk] || (habNv("culinaria") >= RECEITAS12[rk].hab && temLivro());
{ const f0 = drawIngr; drawIngr = function(k, x, y){
  switch (k){
    case "queijo": R(x + 1, y + 3, 6, 4, "#F6D25A"); R(x + 2, y + 2, 5, 1, "#FCE9A0"); P(x + 6, y + 1, "#FCE9A0"); P(x + 3, y + 4, "#E0B33A"); P(x + 5, y + 5, "#E0B33A"); R(x + 1, y + 6, 6, 1, "#E0B33A"); return;
    case "maca": rbox(x + 1, y + 2, 6, 6, "#D9483D"); P(x + 2, y + 3, "#F4806E"); P(x + 4, y + 1, C.woodD); R(x + 5, y, 2, 1, C.leaf); P(x + 4, y + 2, "#B53A30"); return;
    case "arroz": rbox(x + 1, y + 1, 6, 7, "#F1EDF7"); R(x + 2, y + 3, 4, 2, "#7FB8E8"); P(x + 3, y + 6, "#FFFFFF"); P(x + 5, y + 6, "#FFFFFF"); R(x + 2, y + 1, 4, 1, "#D8CFE6"); return;
    case "peixe": R(x + 1, y + 3, 5, 3, "#8FC1E0"); R(x + 2, y + 2, 3, 1, "#8FC1E0"); R(x + 2, y + 6, 3, 1, "#6FA3C8"); R(x + 6, y + 2, 1, 5, "#6FA3C8"); P(x + 7, y + 2, "#6FA3C8"); P(x + 7, y + 6, "#6FA3C8"); P(x + 2, y + 4, C.ink); P(x + 3, y + 3, "#DDF1FC"); return;
    case "chocolate": R(x + 1, y + 1, 6, 6, "#6B3A2A"); R(x + 1, y + 3, 6, 1, "#8C5236"); R(x + 3, y + 1, 1, 3, "#8C5236"); R(x + 1, y + 5, 6, 2, C.coral); P(x + 2, y + 1, "#9C6644"); return;
  }
  return f0(k, x, y);
}; }
{ const f0 = drawPrato; drawPrato = function(rk, x, y){
  if (!RECEITAS12[rk]) return f0(rk, x, y);
  rbox(x, y + 1, 9, 6, "#FFFFFF"); R(x + 1, y + 5, 7, 1, "#E6DDF0");
  if (rk === "brigadeiro"){ for (const [a, b] of [[2, 2], [5, 2], [3, 4]]){ R(x + a, y + b, 2, 2, "#6B3A2A"); P(x + a, y + b, "#9C6644"); } P(x + 3, y + 2, "#F6C667"); P(x + 6, y + 3, "#EE9AB2"); P(x + 4, y + 4, "#7FB8E8"); }
  else if (rk === "lasanha"){ R(x + 2, y + 2, 5, 3, "#F2D58A"); R(x + 2, y + 3, 5, 1, "#D9483D"); R(x + 2, y + 2, 5, 1, "#F6D25A"); P(x + 3, y + 2, "#E0A93A"); P(x + 5, y + 4, "#FCE9B8"); }
  else if (rk === "torta"){ R(x + 2, y + 2, 5, 3, "#E0A93A"); R(x + 2, y + 2, 5, 1, "#F2C56A"); P(x + 3, y + 3, "#B9822A"); P(x + 5, y + 3, "#B9822A"); P(x + 4, y + 2, "#D9483D"); }
  else { for (const a of [1, 4]){ rbox(x + a + 1, y + 2, 3, 3, "#2E3A2E"); P(x + a + 2, y + 3, "#F4A0B4"); P(x + a + 1, y + 2, "#FFFFFF"); } P(x + 7, y + 4, "#7FC27A"); }
}; }
// painel da cozinha: receita da leva 12 fica trancada até ter nível de culinária e o livro de receitas em casa
function travarReceitas(corpo){
  for (const row of corpo.querySelectorAll(".rowi")){
    const st = row.querySelector("strong"), nome = st && st.textContent, e = Object.entries(RECEITAS12).find(([, r]) => r.nome === nome);
    if (!e || receitaOk(e[0])) continue;
    const r = e[1], sm = row.querySelector("small"), nv = habNv("culinaria");
    if (sm) sm.textContent = "🔒 " + (nv < r.hab ? "Culinária nível " + r.hab + " (você tem " + nv + ")" : "") + (nv < r.hab && !temLivro() ? " + " : "") + (!temLivro() ? "livro de receitas em casa" : "");
    row.classList.add("off");
    const b = row.querySelector("button"); if (b && b.textContent === "Cozinhar") b.disabled = true;
  }
}
{ const f0 = openPanel; openPanel = function(id, titulo, monta){
  if (id !== "cozinha") return f0(id, titulo, monta);
  return f0(id, titulo, corpo => { const upd = monta(corpo); travarReceitas(corpo); return () => { if (upd) upd(); travarReceitas(corpo); }; });
}; }
{ const f0 = cozinhar; cozinhar = function(fogaoId, rk){ if (!receitaOk(rk)){ toast("Essa receita ainda está trancada 🔒"); return; } return f0(fogaoId, rk); }; }

// ---------------- pendências da leva 11: tipos girados e da mesma família ----------------
// primeiro("fogao") também acha fogão girado/fogareiro/fogão chique; som não (a música exige o toca-discos)
primeiro = function(t){ const ks = Object.keys(moveis).filter(k => { const b = baseT(moveis[k].t); return b === t || (t !== "som" && FAM[b] === t); }).sort(); return ks.length ? ks[0] : null; };
NM_GRUPO.sofaG = "sofa";
for (const k of Object.keys(NM_GRUPO)) for (const r of [1, 2, 3]) if (CAT[k + "@" + r]) NM_GRUPO[k + "@" + r] = NM_GRUPO[k];
// sentado vendo a tela: olha pra ela (sofá girado assiste de lado)
function dirTela(acao, m0){
  const tv = acao && acao.tela && moveis[acao.tela], ct = tv && CAT[tv.t], cs = m0 && CAT[m0.t];
  if (!ct || !cs || (!ct.virt && !cs.virt)) return "up";
  const dx = (tv.x + ct.w / 2) - (m0.x + cs.w / 2), dy = (tv.y + ct.h / 2) - (m0.y + cs.h / 2);
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}
// cinema na TV grande: o filme passa no meio da tela grande; TV girada não mostra a tela de frente
{ const f0 = drawFilme; drawFilme = function(c, m, tm){
  const ct = m && CAT[m.t]; if (!ct || ct.virt) return;
  if (baseT(m.t) === "tvG") return f0(c, { x: m.x + .5, y: m.y - 1 / 16, t: "tv" }, tm);
  return f0(c, m, tm);
}; }
// TV girada ligada: a tela de lado acende (o sprite de lado não tem quadro "ligado")
function ativos12(){
  const at = {}, tm = Date.now();
  for (const [k, j] of Object.entries(jogadores)){ const a = k === pid ? me && me.acao : j.online && j.acao; if (a && tm - a.ini < a.dur + 3000){ if (a.mov) at[a.mov] = 1; if (a.tela) at[a.tela] = 1; } }
  return at;
}
let frame12 = 0;
const pos12 = {};
{ const f0 = addLeva10Objs; addLeva10Objs = function(objs, tm){
  f0(objs, tm); frame12 = tm;
  let at = null;
  for (const [id, m] of Object.entries(moveis)){
    const c = CAT[m.t]; if (!c || !c.virt || (c.base !== "tv" && c.base !== "tvG") || (c.rot !== 1 && c.rot !== 3)) continue;
    at = at || ativos12(); if (!at[id]) continue;
    const sx = m.x * T + (c.rot === 1 ? 5 : 11), sy = m.y * T - 6, h = c.h * T - 13 + 6;
    objs.push({ z: (m.y + c.h) * T - .5, f: () => {
      const k = Math.floor(tm / 120);
      for (let j = 0; j < h; j++) P(sx, sy + j, (j + k) % 5 === 0 ? "#FFFFFF" : (j + k) % 3 ? "#9FD3F2" : "#CFEFFF");
      ctx.globalAlpha = .35 + .15 * Math.sin(tm / 110); R(sx + (c.rot === 1 ? -1 : 1), sy + 1, 1, h - 2, "#9FD3F2"); ctx.globalAlpha = 1;
    } });
  }
}; }
{ const f0 = sobreAvatar7; sobreAvatar7 = function(id, cx, by, dir, pose, deitado, sentado, movT, tm){
  pos12[id] = { cx, by: sentado ? by + 2 : by, deitado, tm };
  return f0(id, cx, by, dir, pose, deitado, sentado, movT, tm);
}; }
// humor acima da cabeça de vez em quando (e quando muda); textinhos subindo pros ganhos
const humorMudou = {};
{ const f0 = drawLabels11; drawLabels11 = function(mctx, K, fs){
  f0(mctx, K, fs);
  if (mode !== "live") return;
  const t = Date.now();
  for (const [id, p] of Object.entries(pos12)){
    if (p.tm !== frame12) continue;
    const j = id === pid ? (me && me.dados) : jogadores[id]; if (!j || !j.nome || (id !== pid && !j.online)) continue;
    const top = typeof labelTop16 !== "undefined" && labelTop16[id] != null ? labelTop16[id] : (p.by - (p.deitado ? 12 : 27)) * K, sx = p.cx * K; // leva 16a: nome empilhado
    const fala = j.fala && j.falaAt && t - j.falaAt < 7000 && t - j.falaAt > -60000;
    const fase = (t + hashStr(id) % 9000) % 20000, mostra = fase < 2600 || t - (humorMudou[id] || 0) < 3200;
    if (mostra && !fala){
      const h = id === pid ? meuHumor() : humorDoOutro(id, j), bob = Math.sin(t / 260) * K * .8;
      mctx.font = Math.round(fs * 1.15) + "px sans-serif"; mctx.textAlign = "center";
      mctx.fillText(h.n.em, sx - 7 * K, top - fs * .95 + bob);
    }
    if (id === pid) for (const f of flutua12){
      const age = t - f.at; if (age < 0 || age > 1800) continue;
      mctx.globalAlpha = clamp(1.6 - age / 1100, 0, 1);
      mctx.font = "700 " + Math.round(fs * .9) + "px 'Pixelify Sans', monospace"; mctx.textAlign = "center";
      const yy = top - fs * 2 - age / 1800 * fs * 1.6;
      mctx.lineWidth = Math.max(3, K); mctx.strokeStyle = "rgba(18,14,28,.9)"; mctx.strokeText(f.txt, sx + 4 * K, yy);
      mctx.fillStyle = "#FFF4E0"; mctx.fillText(f.txt, sx + 4 * K, yy); mctx.globalAlpha = 1;
    }
  }
  mctx.font = "700 " + fs + "px 'Pixelify Sans', monospace";
}; }

// ---------------- painel do jogador: Humor, Traços, Desejos, Habilidades ----------------
let vidaAba = "humor";
function openVida(aba){
  if (!me) return;
  if (aba) vidaAba = aba;
  openPanel("vida", (dadosEu().nome || "Eu") + " ✨", corpo => {
    const tabs = el("div", "tabs12"), box = el("div", "vida12");
    tabs.setAttribute("role", "tablist"); box.setAttribute("role", "tabpanel");
    const ABAS = [["humor", "Humor"], ["tracos", "Traços"], ["desejos", "Desejos"], ["hab", "Habilidades"]];
    let sig = null;
    const bts = ABAS.map(([k, n]) => { const b = btn(n, "tab12", () => { vidaAba = k; sig = null; pinta(); upd(); }); b.setAttribute("role", "tab"); b.dataset.k = k; tabs.append(b); return b; });
    const pinta = () => bts.forEach(b => b.setAttribute("aria-selected", String(b.dataset.k === vidaAba)));
    corpo.append(tabs, box);
    const upd = () => {
      const d = dadosEu(), h = meuHumor();
      const s = JSON.stringify([vidaAba, h.lista.map(e => e.id + e.v + (e.ate ? Math.ceil((e.ate - srvNow()) / MIN) : "")), d.tracos, d.desejos, d.pontos, d.hab, d.bonus, Object.keys(d.quadros || {}).length, d.vontade, Math.floor(me.dinheiro / 10)]);
      if (s === sig) return; sig = s;
      box.textContent = "";
      ({ humor: abaHumor, tracos: abaTracos, desejos: abaDesejos, hab: abaHab })[vidaAba](box);
    };
    pinta(); upd(); return upd;
  });
}
const linha12 = (ic, titulo, sub, dir) => { const row = el("div", "rowi"), esq = el("div", "esq12"), tx = el("div", "tx"); tx.append(el("strong", null, titulo)); if (sub) tx.append(el("small", null, sub)); esq.append(el("span", "ic12", ic), tx); row.append(esq); if (dir) row.append(dir); return row; };
const faltaMin = ate => { const m = Math.max(1, Math.ceil((ate - srvNow()) / MIN)); return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + (m % 60 ? String(m % 60).padStart(2, "0") : ""); };
function abaHumor(box){
  const h = meuHumor(), topo = el("div", "humor12"), tx = el("div");
  topo.style.borderColor = h.n.cor;
  const nm = el("strong", null, h.n.nome); nm.style.color = h.n.cor;
  tx.append(nm, el("small", null, " · humor " + (h.soma > 0 ? "+" : "") + h.soma));
  tx.append(el("p", "muted", "Aprende ×" + String(h.n.mult).replace(".", ",") + " · trabalho " + (h.n.trab < 1 ? Math.round((1 - h.n.trab) * 100) + "% mais rápido" : h.n.trab > 1 ? Math.round((h.n.trab - 1) * 100) + "% mais lento" : "no ritmo normal") + " · desejo novo a cada " + h.n.desejoMin + " min"));
  topo.append(el("span", "em", h.n.em), tx);
  // vontade própria
  const lab = el("label", "chkrow"), cb = el("input"), t2 = el("span", null, "💭 Vontade própria");
  cb.type = "checkbox"; cb.checked = vontadeOn();
  t2.append(el("small", null, "Parado(a) por uns 20 s, o boneco escolhe sozinho o que fazer, conforme a necessidade mais baixa e os traços. Seu toque sempre manda."));
  cb.onchange = () => { me.dados.vontade = cb.checked ? null : false; ref("jogadores/" + pid + "/vontade").set(cb.checked ? null : false).catch(() => {}); toast(cb.checked ? "Vontade própria ligada 💭" : "Vontade própria desligada"); };
  lab.append(cb, t2);
  const lista = el("div", "list");
  if (!h.lista.length) lista.append(el("p", "muted", "Nada mexendo no humor agora. Comer bem, dormir, banho, carinho e desejos cumpridos deixam mais feliz."));
  for (const e of h.lista){
    const v = el("span", "val12 " + (e.v > 0 ? "pos" : "neg"), (e.v > 0 ? "+" : "−") + Math.abs(e.v));
    lista.append(linha12(e.ic, e.nome, (e.txt || "") + (e.ate ? " · mais " + faltaMin(e.ate) : ""), v));
  }
  box.append(topo, lab, el("h3", null, "O que está mexendo no humor"), lista);
}
function abaTracos(box){
  const tr = meusTracos();
  if (tr.length < 3){
    box.append(el("p", null, tr.length ? "Faltam " + (3 - tr.length) + " traços." : "Você ainda não escolheu seu jeito de ser."),
      el("p", "muted", "São 3 traços: cada um muda o que cansa mais rápido, o que rende mais, o que o boneco faz sozinho e o que mexe no humor."),
      btn("🪞 Escolher no espelho", "btn", () => { closePanel(); openCreator(true); }));
  }
  const lista = el("div", "list");
  for (const k of tr){ const t = TRACOS[k]; lista.append(linha12(t.ic, t.nome, t.desc)); }
  box.append(lista);
  if (tr.length >= 3) box.append(btn("🪞 Trocar no espelho", "btn ghost", () => { closePanel(); openCreator(true); }));
}
function abaDesejos(box){
  const d = dadosEu(), dd = d.desejos || {}, pts = +d.pontos || 0;
  const hd = el("div", "lojahd"); hd.append(el("span", "pts12", "⭐ " + pts + " pontos"), el("small", "muted", "Cumpra desejos pra ganhar pontos e humor."));
  const lista = el("div", "list");
  for (const s of SLOTS){
    const x = dd[s];
    if (x && DESEJOS[x.id]) lista.append(linha12(x.ic, x.txt, "+" + x.pts + " pontos", btn("Trocar", "btn ghost small", () => trocarDesejo(s))));
    else lista.append(linha12("💭", "Pensando no próximo desejo…", dd.prox && dd.prox > srvNow() ? "Em uns " + faltaMin(dd.prox) : "Já já"));
  }
  const loja = el("div", "list");
  for (const it of LOJA12){
    const ativo = it.horas && bonusAtivo(it.id), b = btn(it.pts + " ⭐", "btn small", () => comprarLoja12(it));
    b.disabled = pts < it.pts; b.setAttribute("aria-label", "Trocar " + it.pts + " pontos por " + it.nome);
    loja.append(linha12(it.ic, it.nome, it.desc + (ativo ? " · ativo, mais " + faltaMin(d.bonus[it.id]) : ""), b));
  }
  box.append(hd, lista, el("h3", null, "Loja de recompensas"), loja);
}
function abaHab(box){
  const lista = el("div", "list");
  for (const [k, hb] of Object.entries(HAB)){
    const x = habXp(k), n = nvDeXp(x), a = HAB_XP[n - 1], b = n < 10 ? HAB_XP[n] : a, pr = n < 10 ? (x - a) / (b - a) * 100 : 100;
    const row = linha12(hb.ic, hb.nome + " · nível " + n, (n > 1 ? hb.efeito(n) : "Ainda sem bônus: cada nível melhora") + ". Sobe com: " + hb.sobe.toLowerCase() + "."), tx = row.querySelector(".tx");
    tx.append(barra(pr, "#8E7CF0")); row.classList.add("hab12"); lista.append(row);
  }
  const nq = Object.keys(dadosEu().quadros || {}).length;
  box.append(el("p", "muted", "Habilidades sobem fazendo as coisas. Bom humor ajuda a aprender mais rápido."), lista);
  if (nq || temMovel("cavalete")) box.append(btn("🖼️ Meus quadros (" + nq + ")", "btn ghost", openQuadros));
}
$("bVida").onclick = () => openVida();
$("meAv").style.cursor = "pointer"; $("meAv").onclick = () => openVida("humor");

// ---------------- 1 vez por segundo: desejos, efeitos vencidos, avisos ----------------
let avisouTracos = false, nuvensAnt = null;
const efeitoLimpo = new Set();
setInterval(() => {
  if (!me || !me.dados || !me.dados.nome) return;
  try {
    const d = me.dados, t = srvNow();
    for (const [k, e] of Object.entries(d.efeitos || {})) if (e && e.ate <= t && !efeitoLimpo.has(k + e.ate)){ efeitoLimpo.add(k + e.ate); if (!visitando) ref("jogadores/" + pid + "/efeitos/" + k).remove().catch(() => {}); }
    if (!visitando){
      preencherDesejos();
      checarDesejos({ dinheiro: me.dinheiro });
      if (nuvensAnt != null && (d.nuvens || 0) > nuvensAnt + 60000) ganharHab("charme", 12); // namoro ou jantar romântico
      nuvensAnt = d.nuvens || 0;
      if (!avisouTracos && meusTracos().length < 3 && !$("screenGame").hidden){ avisouTracos = true; setTimeout(() => { if (me && meusTracos().length < 3) toast("Escolha 3 traços no espelho 🪞 (ou toque em ✨ Eu)"); }, 4000); }
    }
    const h = meuHumor().n.id; if (humorUlt && h !== humorUlt) humorMudou[pid] = Date.now(); humorUlt = h;
    const el12 = $("meMood"); if (el12 && el12.style.color !== meuHumor().n.cor) el12.style.color = meuHumor().n.cor;
    renderFila();
    refreshPanel("vida"); refreshPanel("quadros");
  } catch(e){ console.error(e); }
}, 1000);
{ const f0 = leva11Reset; leva11Reset = function(){
  f0();
  fila = []; filaExec = menuClique = dentro12 = autoMarcar = autoCtx = false; alvo12 = null; humorCache = null; humorUlt = null; nuvensAnt = null; avisouTracos = false;
  desejoPend.clear(); pertoDe.clear(); flutua12.length = 0; for (const k of Object.keys(pos12)) delete pos12[k];
  const b = $("fila12"); if (b){ b.hidden = true; b.textContent = ""; b.dataset.sig = ""; }
}; }
