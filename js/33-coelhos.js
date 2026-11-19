"use strict";
// Casinha · v44: casal de coelhos e filhotes
//   casa/pets/<id> (coelho): sexo "macho"|"femea", cor 0..3 (COELHO_CORES), filhote = quando nasceu (vira adulto em
//   COELHO_CRESCE), mae, pai; prenhe = { pai, desde, ate } enquanto espera filhotes; ninhada = quando teve a última.
// Coelho não ocupa as vagas dos outros bichinhos (FAMILIA.petsMax): tem as suas, até COELHOS_MAX.
// Teste: coelhoPrenheTeste() deixa a primeira fêmea esperando filhotes que nascem em 10 s.
const COELHOS_MAX = 6, COELHO_CRESCE = 4 * 24 * HORA, COELHO_GESTA = 24 * HORA, COELHO_INTERVALO = 3 * 24 * HORA;
const COELHO_CORES = [
  { nome: "Branquinho", c: "#F4EEE6", cL: "#FFFFFF", cD: "#D9CFC4", sw: "#F4EEE6" },
  { nome: "Caramelo", c: "#D9A46A", cL: "#EBC08E", cD: "#B07D4C", sw: "#D9A46A" },
  { nome: "Cinza", c: "#A9A6AE", cL: "#C8C5CC", cD: "#86838D", sw: "#A9A6AE" },
  { nome: "Chocolate", c: "#8A5E44", cL: "#A87A5C", cD: "#6A4632", sw: "#8A5E44" }
];
const NOMES_FILHOTE = ["Pipoquinha", "Floquinho", "Pompom", "Nuvem", "Mel", "Paçoca", "Biscoito", "Pingo", "Fofura", "Amora"];
const coelhoPal = cor => COELHO_CORES[cor | 0] || COELHO_CORES[0];
const ehFilhoteCoelho = p => !!p && p.tipo === "coelho" && !!p.filhote && srvNow() - p.filhote < COELHO_CRESCE;
const coelhosDaCasa = () => petsOrdem().filter(k => pets[k].tipo === "coelho");
const nPetsConta = () => petsOrdem().filter(k => pets[k].tipo !== "coelho").length;
const sexoDe = id => { const p = pets[id]; return p && (p.sexo === "macho" || p.sexo === "femea") ? p.sexo : (hashStr(id) % 2 ? "macho" : "femea"); };
function cabePet(tipo){ return tipo === "coelho" ? coelhosDaCasa().length < COELHOS_MAX : nPetsConta() < FAMILIA.petsMax; }
const cabeAlgum = () => cabePet("coelho") || cabePet("gato");

// filhote: um coelhinho pequeno (cabe no mesmo quadro de 15x13 do coelho adulto)
function drawFilhoteCoelho(x, y, pose, f, triste, pal){
  const c = pal.c, cL = pal.cL, cD = pal.cD, or = "#F7A3B5", ink = "#2E2638";
  if (pose === "sleep"){ rbox(x + 4, y + 8, 7, 4, c); R(x + 5, y + 8, 5, 1, cL); R(x + 9, y + 7, 3, 2, c); P(x + 10, y + 9, ink); P(x + 3, y + 10, cL); return; }
  const hop = pose === "walk" && f ? -1 : 0, eat = pose === "eat";
  P(x + 3, y + 9 + hop, cL);
  rbox(x + 4, y + 8 + hop, 6, 4, c); R(x + 5, y + 8 + hop, 4, 1, cL); R(x + 5, y + 11 + hop, 4, 1, cD);
  const hx = x + 8, hy = y + (eat ? 8 : 6) + hop;
  rbox(hx, hy, 4, 4, c); R(hx + 1, hy, 2, 1, cL);
  if (triste){ R(hx - 1, hy + 1, 2, 1, c); } else { R(hx + 1, hy - 3, 1, 3, c); P(hx + 1, hy - 2, or); R(hx + 2, hy - 2, 1, 2, cD); }
  if (pose === "jump"){ P(hx + 2, hy + 1, ink); P(hx + 3, hy + 2, ink); } else P(hx + 2, hy + 1, ink);
  P(hx + 3, hy + 2, or);
  if (eat){ R(hx + 3, hy + 3, 2, 1, "#F2883A"); }
}
function infoCoelho(p, id){
  if (!p || p.tipo !== "coelho") return "";
  const s = sexoDe(id), cor = coelhoPal(p.cor).nome.toLowerCase();
  return " · " + (s === "femea" ? "♀ fêmea" : "♂ macho") + ", " + cor + (ehFilhoteCoelho(p) ? " · filhote 🍼" : "") + (p.prenhe ? " · esperando filhotes 🤰" : "");
}
function doarCoelho(id){
  const p = pets[id]; if (!p || p.tipo !== "coelho") return;
  if (!confirm("Doar " + (p.nome || "o coelhinho") + " pra uma família que vai cuidar bem dele?")) return;
  ref("casa/pets/" + id).remove().then(() => { toast((p.nome || "O coelhinho") + " foi pra um lar cheio de amor 💝"); historia("doou_" + id, "💝", (p.nome || "Um coelhinho") + " ganhou uma família nova"); }).catch(() => toast("Não deu pra doar agora."));
}

// ---- casal: de vez em quando a fêmea fica esperando filhotes; um dia depois eles nascem ----
function nascerFilhotes(mae){
  const pm = pets[mae]; if (!pm || !pm.prenhe) return;
  txn("casa/pets/" + mae + "/prenhe", cur => cur && srvNow() >= cur.ate ? null : undefined).then(ok => {
    if (!ok) return;
    const t = srvNow(), pai = pets[pm.prenhe.pai], vagas = COELHOS_MAX - coelhosDaCasa().length;
    const n = Math.max(1, Math.min(vagas, 1 + Math.floor(Math.random() * 3))), usados = new Set(Object.values(pets).map(p => p && p.nome));
    const nomes = NOMES_FILHOTE.filter(x => !usados.has(x)), novos = [];
    for (let i = 0; i < n; i++){
      const nm = nomes[i] || ("Filhote " + (i + 1)), cor = Math.random() < .5 ? (pm.cor | 0) : ((pai && pai.cor) | 0);
      const p = { nome: nm, tipo: "coelho", sexo: Math.random() < .5 ? "macho" : "femea", cor, filhote: t, mae, pai: pm.prenhe.pai || null, comeu: t, carinho: t, limpo: t, criado: t + i };
      novos.push(nm); ref("casa/pets").push(p).catch(() => {});
    }
    ref("casa/pets/" + mae + "/ninhada").set(t).catch(() => {});
    toastEspecial((n > 1 ? "Nasceram " + n + " coelhinhos! " : "Nasceu um coelhinho! ") + "🐰🍼", novos.join(", ") + (n > 1 ? " chegaram" : " chegou") + " pra alegrar a casa.");
    if (typeof confete === "function") confete();
    historia("ninhada_" + mae + "_" + t, "🐰", (pm.nome || "A coelha") + " teve " + (n > 1 ? n + " filhotes: " : "um filhote: ") + novos.join(", "));
  });
}
function vigiarCoelhos(){
  if (!me || visitando || typeof pets === "undefined" || !petsOrdem) return;
  const t = srvNow(), lista = coelhosDaCasa();
  for (const id of lista){ const p = pets[id]; if (p && p.prenhe && t >= p.prenhe.ate) nascerFilhotes(id); }
  if (lista.length >= COELHOS_MAX) return;
  const adultos = lista.filter(k => !ehFilhoteCoelho(pets[k]) && !petTristeId(k, t));
  const maes = adultos.filter(k => sexoDe(k) === "femea" && !pets[k].prenhe && t - (pets[k].ninhada || 0) > COELHO_INTERVALO);
  const pais = adultos.filter(k => sexoDe(k) === "macho");
  if (!maes.length || !pais.length || lista.some(k => pets[k].prenhe)) return;
  if (Math.random() > 1 / 90) return; // checa a cada minuto: em média, uma vez a cada hora e meia de casa aberta
  const mae = maes[0], pai = pais[0];
  txn("casa/pets/" + mae + "/prenhe", cur => cur ? undefined : { pai, desde: t, ate: t + COELHO_GESTA }).then(ok => {
    if (ok) toastEspecial((pets[mae].nome || "A coelha") + " está esperando filhotes! 🐰🍼", "Em um dia nascem os bebês de " + (pets[mae].nome || "dela") + " e " + (pets[pai].nome || "do coelho") + ".");
  });
}
setInterval(vigiarCoelhos, 60000);
function coelhoPrenheTeste(){
  const mae = coelhosDaCasa().find(k => sexoDe(k) === "femea"), pai = coelhosDaCasa().find(k => sexoDe(k) === "macho");
  if (!mae) return "sem fêmea"; const t = srvNow();
  ref("casa/pets/" + mae + "/prenhe").set({ pai: pai || null, desde: t, ate: t + 10000 }); setTimeout(vigiarCoelhos, 11000); return mae;
}

// ---- adoção: coelho escolhe sexo e cor; coelhos têm as próprias vagas ----
function openAdocao(){
  if (visitando){ toast("Adoção é na sua casa 😉"); return; }
  openPanel("adocao", "Adotar bichinho 🐾", corpo => {
    const nP = nPetsConta(), nC = coelhosDaCasa().length;
    corpo.append(el("p", "muted", "Preço simbólico pro abrigo. Peixinho vem com aquário, passarinho e hamster com gaiola, se a casa ainda não tiver. " +
      "Bichinhos: " + nP + "/" + FAMILIA.petsMax + " · coelhos: " + nC + "/" + COELHOS_MAX + " (um casal pode ter filhotes 🐰)."));
    if (!cabeAlgum()){ corpo.append(el("p", "muted", "A casa já está cheia de bichinhos. Cuidem bem deles 💞")); return; }
    const inp = el("input"), sel = { t: cabePet("coelho") ? "coelho" : "gato" };
    inp.type = "text"; inp.maxLength = 16; inp.placeholder = "Nome (opcional)"; inp.setAttribute("aria-label", "Nome do bichinho novo");
    // sexo: o contrário do coelho adulto que já mora aqui (pra formar um casal)
    const adulto = coelhosDaCasa().find(k => !ehFilhoteCoelho(pets[k]));
    const ex = { sexo: adulto ? (sexoDe(adulto) === "femea" ? "macho" : "femea") : "femea", cor: Math.floor(Math.random() * COELHO_CORES.length) };
    const g = el("div", "grid2"), extra = el("div");
    const pinta = () => {
      for (const b of g.children) b.setAttribute("aria-pressed", String(b.dataset.t === sel.t));
      extra.hidden = sel.t !== "coelho"; extra.textContent = "";
      if (sel.t !== "coelho") return;
      extra.append(el("span", "lbl", "Sexo"));
      const sx = el("div", "hbtns");
      for (const [k, n] of [["femea", "♀ Fêmea"], ["macho", "♂ Macho"]]){ const b = btn(n, "btn ghost small", () => { ex.sexo = k; pinta(); }); b.setAttribute("aria-pressed", String(ex.sexo === k)); sx.append(b); }
      extra.append(sx, el("span", "lbl", "Cor"));
      const cs = el("div", "swatches");
      COELHO_CORES.forEach((c, i) => { const b = btn("", "swatch", () => { ex.cor = i; pinta(); }); b.style.background = c.sw; b.title = c.nome; b.setAttribute("aria-label", "Coelho " + c.nome.toLowerCase()); b.setAttribute("aria-pressed", String(ex.cor === i)); cs.append(b); });
      extra.append(cs);
      if (adulto) extra.append(el("p", "muted", "Com " + (pets[adulto].nome || "o outro coelho") + " (" + (sexoDe(adulto) === "femea" ? "fêmea" : "macho") + "), " + (ex.sexo !== sexoDe(adulto) ? "vira um casal e pode ter filhotes 🐰💕" : "fica uma dupla de amigos (sem filhotes).")));
    };
    for (const [k, d] of Object.entries(PET13)){
      const cabe = cabePet(k), b = btn("", "btn ghost escolha", () => { if (!cabe){ toast(k === "coelho" ? "Já tem " + COELHOS_MAX + " coelhos." : "As vagas dos outros bichinhos estão cheias (" + FAMILIA.petsMax + ")."); return; } sel.t = k; pinta(); });
      b.dataset.t = k; if (!cabe) b.style.opacity = ".45";
      b.append(el("strong", null, d.ic + " " + d.nome), el("small", null, "$" + d.preco + (d.item ? " · com " + CAT[d.item].nome.toLowerCase() : ""))); g.append(b);
    }
    if (gatoAmigo() && !mingauAdotado() && cabePet("gato")){ const b = btn("", "btn ghost escolha", () => { sel.t = "mingau"; pinta(); }); b.dataset.t = "mingau"; b.append(el("strong", null, "🐈 O Mingau"), el("small", null, "O gatinho de rua amigo · de graça")); g.append(b); }
    pinta();
    corpo.append(g, extra, inp, btn("Adotar 🐾", "btn", () => adotarPet(sel.t, inp.value, sel.t === "coelho" ? ex : null)));
  });
}
function adotarPet(tipo, nome, ex){
  const ming = tipo === "mingau", d = PET13[ming ? "gato" : tipo]; if (!d) return;
  if (!cabePet(ming ? "gato" : tipo)){ toast(tipo === "coelho" ? "Já tem " + COELHOS_MAX + " coelhos." : "A casa já tem " + FAMILIA.petsMax + " bichinhos."); return; }
  if (!ming && !gastar(d.preco, "a adoção")) return;
  const t = srvNow(), nm = limpaNome(nome).slice(0, 16) || (ming ? "Mingau" : { gato: "Mimi", cachorro: "Bolinha", coelho: coelhosDaCasa().length ? "Pompom" : "Algodão", peixe: "Nemo", passarinho: "Piu", hamster: "Bolinha" }[tipo] || d.nome);
  const p = { nome: nm, tipo: ming ? "gato" : tipo, comeu: t, carinho: t, limpo: t, criado: t };
  if (ming) p.raca = "mingau"; if (tipo === "peixe") p.cor = ["#F2A65A", "#E8607A", "#F6C667", "#7FB8E8"][hash(t | 0, 1, 2) % 4];
  if (tipo === "coelho"){ p.sexo = ex && ex.sexo === "macho" ? "macho" : "femea"; p.cor = ex ? ex.cor | 0 : 0; }
  const id = ref("casa/pets").push().key;
  ref("casa/pets/" + id).set(p).then(() => {
    closePanel(); toastEspecial("Bem-vindo(a), " + nm + "! 🐾", ming ? "O Mingau agora mora com vocês." : d.nome + " adotado com carinho."); confete();
    historia("pet_" + id, d.ic, nm + (ming ? ", o gatinho de rua, ganhou um lar" : " chegou pra morar na casa"));
    if (d.item && !casaDoPet(id)){ const pos = noAndar(0, () => lugarPerto(d.item, 10, 6)); if (pos) ref("casa/moveis").push({ t: d.item, x: pos[0], y: pos[1] }).catch(() => {}); else toast("Não coube " + CAT[d.item].nome.toLowerCase() + ". Coloque no modo Construir."); }
  }, () => toast("Não deu pra adotar agora."));
}
