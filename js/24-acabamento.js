"use strict";
// Casinha · leva 16a: site instalável (PWA), tela de abertura, menu principal por assunto e tutorial
// =====================================================================
// 1. PWA: service worker (sw.js), aviso de versão nova, botão "Instalar no celular", última casa ao abrir pelo ícone
// 2. Tela de abertura (splash) e "Sem internet"
// 3. Menu principal: barra de baixo com 5 abas (Casa, Nós, Eu, Diversão, Ajustes) e contadores
// 4. Tutorial da primeira vez (balões apontando pras coisas de verdade)
// Os botões antigos do HUD (#bMural, #bTarefas...) continuam no DOM, escondidos: as abas tocam neles (.click()),
// assim os textos que cada leva atualiza ("Tarefas 2/3", "Faxina 3"...) e os bloqueios da visita seguem valendo.
// =====================================================================

// ---------------------------------------------------------------------
// 1. PWA
// ---------------------------------------------------------------------
const VERSAO16 = ((document.querySelector('meta[name="casinha-versao"]') || {}).content || "").trim();
const standalone16 = () => (!!window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const iOS16 = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// aberto pelo ícone (start_url "./?app=1", sem #casa): volta pra última casa aberta neste aparelho
(() => {
  if (location.hash) return;
  const app = new URLSearchParams(location.search).has("app") || standalone16(), s = store.get("casinha-ultima-sala");
  if (app && s && /^[a-z0-9-]{10,40}$/.test(s)) history.replaceState(null, "", location.pathname + location.search + "#" + s);
})();
{ const f0 = boot; boot = function(){ f0(); if (sala && !visitando) store.set("casinha-ultima-sala", sala); }; }

// service worker: "sw.js?v=N" (N = versão desta página). Versão nova no index = endereço novo = SW novo instalado.
let swReg = null, swRecarregar = false;
if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js?v=" + encodeURIComponent(VERSAO16 || "0"), { scope: "./" }).then(reg => {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) swEsperando(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) swEsperando(w); });
      });
    }).catch(e => console.warn("Casinha: service worker não registrou", e));
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (swRecarregar){ swRecarregar = false; location.reload(); } });
}
// SW novo baixado e esperando. Se ele é da versão desta página (a página já veio nova pela rede), só troca, sem recarregar.
// Se é de uma versão mais nova que a página, mostra o aviso "Versão nova!".
function swEsperando(w){
  let v = ""; try { v = new URL(w.scriptURL).searchParams.get("v") || ""; } catch(e){}
  if (v === VERSAO16){ w.postMessage({ tipo: "pular" }); return; }
  avisarVersaoNova(v);
}
// toque no aviso "Versão nova!" (18-laco.js): SW esperando = assume e recarrega; senão recarrega por um endereço novo
// (o index vem da rede primeiro, então chega o novo, que registra o SW novo)
function atualizarAgora(t){
  const ir = () => location.replace(location.pathname + "?atualizar=" + encodeURIComponent(t || Date.now()) + location.hash);
  const w = swReg && swReg.waiting;
  if (w){ swRecarregar = true; w.postMessage({ tipo: "pular" }); setTimeout(ir, 4000); return; }
  ir();
}

// instalar: Android/Chrome guarda o beforeinstallprompt; iPhone mostra o caminho pelo Safari
let instalarEvt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); instalarEvt = e; refreshPanel("aba-ajustes"); });
window.addEventListener("appinstalled", () => { instalarEvt = null; toast("Casinha instalada 📲"); refreshPanel("aba-ajustes"); });
function instalarApp(){
  if (standalone16()){ toast("A Casinha já está instalada 📲"); return; }
  if (instalarEvt){
    const e = instalarEvt; instalarEvt = null;
    e.prompt(); e.userChoice.then(r => toast(r && r.outcome === "accepted" ? "Instalando… 📲" : "Tudo bem, dá pra instalar depois em ⚙️ Ajustes.")).catch(() => {});
    return;
  }
  openPanel("instalar", "Instalar no celular 📲", corpo => {
    const passos = el("ol", "passos16");
    const li = t => passos.append(el("li", null, t));
    if (iOS16){
      li("Abra a casa no Safari (o link da casa de vocês)."); li("Toque em Compartilhar (o quadradinho com a seta pra cima ⬆️)."); li("Role e toque em \"Adicionar à Tela de Início\"."); li("Toque em \"Adicionar\". Pronto: a casinha vira um ícone.");
    } else {
      li("Abra a casa no Chrome (ou no navegador do celular)."); li("Toque no menu ⋮ do navegador."); li("Toque em \"Instalar app\" ou \"Adicionar à tela inicial\"."); li("Confirme. A casinha vira um ícone na tela.");
    }
    corpo.append(el("p", null, "Instalada, a Casinha abre direto na casa de vocês, em tela cheia, como um app."), passos,
      el("p", "muted", "Se o botão de instalar não aparecer, o navegador já instalou ou não deixa. Nada se perde: a casa é a mesma pelo link."));
  });
}

// ---------------------------------------------------------------------
// 2. TELA DE ABERTURA E "SEM INTERNET"
// ---------------------------------------------------------------------
let splashFim = false; const splashIni = Date.now();
function esconderSplash(){
  if (splashFim) return; splashFim = true;
  const s = $("splash16"); if (!s) return; s.classList.add("some"); setTimeout(() => { s.hidden = true; }, 400);
}
function vigiarSplash(){
  if (splashFim) return;
  const tela = !$("screenRoom").hidden || !$("screenCreator").hidden || (!$("screenGame").hidden && me) || document.querySelector(".sheet-bg");
  if (tela){ esconderSplash(); return; }
  const passou = Date.now() - splashIni, semRede = !navigator.onLine || (passou > 10000 && !conectado);
  if (passou > 5000 && semRede && $("splashTenta").hidden){
    $("splashTx").textContent = navigator.onLine ? "Conexão fraca 📡" : "Sem internet 📡";
    const sub = $("splashSub"); sub.hidden = false; sub.textContent = "A casa abre sozinha assim que a conexão voltar.";
    const foto = sala && store.get("casinha-foto-" + sala);
    if (foto && /^data:image\/png;base64,/.test(foto)){ const im = $("splashFoto"); im.src = foto; im.hidden = false; sub.textContent = "Essa é a casa da última vez. Ela abre sozinha assim que a conexão voltar."; }
    $("splashTenta").hidden = false;
  }
}
$("splashTenta").onclick = () => location.reload();
// dentro da casa: perdeu a conexão por mais de 3 s = faixa "Sem internet" (o Firebase reconecta sozinho)
let semRedeDesde = 0;
function vigiarRede(){
  const b = $("semRede16"); if (!b) return;
  const off = !!me && !$("screenGame").hidden && (!navigator.onLine || !conectado);
  if (!off) semRedeDesde = 0; else if (!semRedeDesde) semRedeDesde = Date.now();
  const mostra = !!semRedeDesde && Date.now() - semRedeDesde > 3000;
  if (b.hidden === mostra) b.hidden = !mostra;
}
// foto da casa pra mostrar na abertura sem internet (a cada minuto, só a cena pequena: ~30 KB)
let fotoUlt = Date.now() - 50000; // a primeira uns 10 s depois de abrir (com a casa já desenhada)
function guardarFotoCasa(){
  if (!me || visitando || !sala || $("screenGame").hidden || mode !== "live" || document.hidden || Date.now() - fotoUlt < 60000 || PERF.draws < 30) return;
  fotoUlt = Date.now();
  try { store.set("casinha-foto-" + sala, lo.toDataURL("image/png")); } catch(e){}
}

// ---------------------------------------------------------------------
// 3. MENU PRINCIPAL (barra de baixo)
// ---------------------------------------------------------------------
const ABAS16 = { casa: ["🏠", "Casa"], nos: ["💞", "Nós"], eu: ["✨", "Eu"], diversao: ["🎮", "Diversão"], ajustes: ["⚙️", "Ajustes"] };
const txB = id => { const b = $(id), t = b && b.querySelector(".tx"); return t ? t.textContent : ""; };
const tocar16 = id => () => { const b = $(id); if (b) b.click(); };
for (const b of document.querySelectorAll("#nav16 button")) b.onclick = () => abrirAba(b.dataset.aba);

function abaAberta(){
  if (!painel) return "";
  if (painel.id === "familia" || painel.id === "visitaNos") return "nos";
  return painel.id.indexOf("aba-") === 0 ? painel.id.slice(4) : "";
}
function abrirAba(k){
  if (!me || !ABAS16[k]) return;
  closeMenu();
  if (abaAberta() === k){ closePanel(); return; }
  if (k === "nos"){ $("bFamilia").click(); return; } // o painel "Nós" de sempre (na visita, a captura da leva 10 abre o da visita)
  const [ic, nome] = ABAS16[k];
  openPanel("aba-" + k, ic + " " + nome, corpo => {
    const g = el("div", "menu16"), extra = el("div", "extra16");
    corpo.append(g, extra);
    let sig = null, sigX = null;
    const upd = () => {
      const itens = ITENS16[k]();
      const s = JSON.stringify(itens.map(i => [i.ic, i.t, i.sub, i.n, i.on]));
      if (s !== sig){ sig = s; g.textContent = ""; for (const it of itens) g.append(botao16(it)); }
      if (k === "ajustes"){
        const sx = JSON.stringify([romanceOk(pid), bebesOn, visitando]);
        if (sx !== sigX){ sigX = sx; extra.textContent = ""; const box = el("div", "list"); montarAjustesRomance(box);
          extra.append(el("h3", null, "Romance e bebês"), box, el("p", "muted versao16", "Casinha · versão " + (VERSAO16 || "?") + (standalone16() ? " · instalada 📲" : ""))); }
      }
    };
    upd(); return upd;
  });
}
function botao16(it){
  const b = btn("", "btn ghost escolha", () => { if (it.fecha !== false) closePanel(); it.fn(); });
  b.append(el("strong", null, it.ic + " " + it.t)); if (it.sub) b.append(el("small", null, it.sub));
  if (it.n) b.append(el("span", "dot", String(it.n)));
  b.setAttribute("aria-label", it.t + (it.sub ? ": " + it.sub : "") + (it.n ? " (" + it.n + (it.n === "!" ? " aviso" : " novo") + ")" : ""));
  if (it.on != null) b.setAttribute("aria-pressed", String(!!it.on));
  return b;
}
// móvel do meu andar (pc/tv) pra jogar e pro cinema
const movDe16 = (...ts) => Object.keys(moveis).find(k => moveis[k] && ts.includes(baseT(moveis[k].t))) || null;

const ITENS16 = {
  casa(){
    if (visitando) return [
      { ic: "🧹", t: txB("bFaxina") || "Faxina", sub: "Dar uma mãozinha na limpeza", fn: tocar16("bFaxina") },
      { ic: "🐱", t: petNome(), sub: "Carinho e comida", fn: tocar16("bPet") },
      { ic: "🏠", t: "Voltar pra minha casa", sub: "Sair da visita", fn: voltarPraCasa }
    ];
    const l = [
      mode === "build" ? { ic: "🚶", t: "Voltar a viver", sub: "Sair do modo construir", fn: () => setMode("live") }
        : { ic: "🔨", t: "Construir e decorar", sub: "Móveis, pisos, paredes" + (zeroAqui() ? " e obras" : ""), fn: () => { setMode("build"); const bp = $("buildPanel"); if (bp && !bp.hidden) bp.scrollIntoView({ behavior: "smooth", block: "nearest" }); } },
      { ic: "✅", t: txB("bTarefas") || "Tarefas", sub: "Tarefas do dia e emprego", fn: tocar16("bTarefas") },
      { ic: "🧹", t: txB("bFaxina") || "Faxina", sub: "Limpar a bagunça da casa", fn: tocar16("bFaxina") },
      { ic: "🧺", t: "Despensa", sub: "Ingredientes e receitas", fn: tocar16("bDespensa") },
      { ic: "🐱", t: petNome(), sub: "O bichinho da casa", fn: tocar16("bPet") },
      { ic: "🛍️", t: "Loja da semana", sub: semanaInfo().tema.ic + " " + semanaInfo().tema.nome, fn: () => openLoja() }
    ];
    // mesmas condições do renderLeva2Hud (que só roda com o laço; aqui a aba pode abrir antes)
    if (cofreCarregado && !temQuintal()) l.push({ ic: "🐷", t: "Quintal $" + (cofre.total || 0), sub: "Cofrinho pro quintal", fn: tocar16("bQuintal") });
    if (cofre2Carregado && !temAndar2() && !casaZero) l.push({ ic: "🏠", t: "2º andar $" + (cofre2.total || 0), sub: "Cofrinho pro 2º andar", fn: tocar16("bAndar") });
    if (zeroAqui()) l.push({ ic: "🏡", t: "Metas do lar", sub: METAS.filter(m => metas[m.id]).length + "/" + METAS.length + " · " + proximaMetaTxt(), fn: () => openMetas() });
    return l;
  },
  eu(){
    const h = meuHumor(), tr = meusTracos(), pts = +dadosEu().pontos || 0;
    const l = [
      { ic: h.n.em, t: "Humor", sub: h.n.nome + " (" + (h.soma > 0 ? "+" : "") + h.soma + ")", fn: () => openVida("humor") },
      { ic: "🎭", t: "Traços", sub: tr.length < 3 ? "Escolha seus 3 traços" : tr.map(k => TRACOS[k].nome).join(", "), n: tr.length < 3 && !visitando ? "!" : 0, fn: () => openVida("tracos") },
      { ic: "🌟", t: "Desejos", sub: "⭐ " + pts + " pontos pra trocar", fn: () => openVida("desejos") },
      { ic: "📈", t: "Habilidades", sub: Object.values(HAB).slice(0, 3).map(x => x.nome).join(", ") + "…", fn: () => openVida("hab") },
      { ic: "🪞", t: "Me ver no espelho", sub: "De corpo inteiro, girando", fn: () => openEspelho(pid) }
    ];
    if (!visitando) l.push({ ic: "👗", t: "Trocar o visual", sub: "Roupa, cabelo e jeito de ser", fn: () => openCreator(true) });
    const on = vontadeOn();
    l.push({ ic: "💭", t: "Vontade própria: " + (on ? "sim" : "não"), sub: on ? "Parado, o boneco escolhe o que fazer" : "Só faz o que você mandar", on, fecha: false, fn: () => {
      const v = !vontadeOn(); me.dados.vontade = v ? null : false; ref("jogadores/" + pid + "/vontade").set(v ? null : false).catch(() => {});
      toast(v ? "Vontade própria ligada 💭" : "Vontade própria desligada"); refreshPanel("aba-eu");
    } });
    const nq = Object.keys(dadosEu().quadros || {}).length;
    if (nq || temMovel("cavalete")) l.push({ ic: "🖼️", t: "Meus quadros", sub: nq + (nq === 1 ? " quadro" : " quadros"), fn: () => openQuadros() });
    return l;
  },
  diversao(){
    const l = [], mov = movDe16("pc", "tv");
    if (!mov) l.push({ ic: "🎮", t: "Jogar junto", sub: "Precisa de TV ou computador neste andar", fn: () => toast("Coloque uma TV ou um computador pra jogar junto 🎮") });
    else {
      const its = jogarItens(mov);
      if (its.length && its[0].nota) l.push({ ic: "🎮", t: "Jogar junto", sub: "Ninguém mais em casa agora", fn: () => toast(its[0].nome + " O link fica em ⚙️ Ajustes → Convidar.") });
      else for (const it of its) l.push({ ic: "🎮", t: it.nome, sub: it.info || "", fn: it.fn });
    }
    const tv = movDe16("tv");
    if (cinemaAtivo() && cinema && moveis[cinema.tv]) l.push({ ic: "🍿", t: "Assistir o filme junto", sub: "“" + cinema.titulo + "”", n: me.acao && me.acao.id === "cinema" ? 0 : "!", fn: () => irCinema() });
    else l.push({ ic: "🎬", t: "Cinema em casa", sub: tv ? "Filme no sofá" : "Precisa de uma TV neste andar", fn: () => tv ? openCinema(tv) : toast("Coloque uma TV pra ter cinema em casa 🎬") });
    if (!visitando && carroPos()) l.push({ ic: "🚗", t: "Passear de carro", sub: psAtivo() && passeio.estado === "convite" ? "Tem convite rolando!" : "$" + PS_GAS + " de gasolina", n: psConvite16() ? 1 : 0, fn: () => abrirPasseio() });
    const mu = musicaAtiva();
    l.push({ ic: "🎵", t: "Música", sub: mu ? "♪ " + mu.fx.nome : "Toca-discos e sons", fn: () => openSom(null) },
      { ic: "🏆", t: txB("bTrofeus") || "Troféus", sub: "Conquistas da casa", fn: tocar16("bTrofeus") },
      { ic: "♥", t: ($("nivelTx").textContent || "Nível").replace(/^♥\s*/, ""), sub: "Nível do casal · " + $("nivelXp").textContent, fn: () => openNivel() });
    return l;
  },
  ajustes(){
    const so = prefOn("casinha-som"), mu = prefOn("casinha-musica");
    const l = [
      { ic: so || mu ? "🔊" : "🔇", t: "Som e música", sub: (so ? "Sons ligados" : "Sons desligados") + " · " + (mu ? "música ligada" : "música desligada"), fn: tocar16("bSom") }
    ];
    if (!visitando) l.push({ ic: "🔔", t: "Avisos", sub: avisosLigados() ? "Ligados" : "Avisar quando alguém chegar…", fn: () => openAvisos() });
    if (!standalone16()) l.push({ ic: "📲", t: "Instalar no celular", sub: instalarEvt ? "Vira um app na tela inicial" : iOS16 ? "Safari: Compartilhar → Tela de Início" : "Como pôr na tela inicial", fn: instalarApp });
    if (!visitando){
      const nz = Object.keys(vizinhos).length;
      l.push({ ic: "🔗", t: "Convidar pelo link", sub: "Chamar mais gente pra casa", fn: openConvite },
        { ic: "🧑‍🎨", t: "Refazer meu bonequinho", sub: "Corpo, rosto e jeito de novo, do zero", fn: () => { if (confirm("Refazer seu bonequinho do zero? Corpo, cabelo e jeito de ser podem mudar. Dinheiro, casa e lembranças continuam.")){ closePanel(); openCreator(true, true); } } },
        { ic: "🔄", t: "Entrar como outro morador", sub: "Abriu em outro celular e virou gente nova?", fn: () => openQuemSou() },
        { ic: "🏘️", t: "Bairro", sub: nz ? nz + (nz === 1 ? " casa de amigo" : " casas de amigos") : "Visitar amigos", fn: () => openBairro() });
    }
    l.push({ ic: "🎓", t: "Ver tutorial de novo", sub: "Os balões do começo", fn: () => setTimeout(() => iniciarTutorial(), 50) });
    return l;
  }
};
const psConvite16 = () => !!passeio && passeio.estado === "convite" && passeio.por !== pid && !!passeio.conv && passeio.conv[pid] === true;

// convite pelo link (era o cartão "Chamar mais gente", que abria embaixo da casa)
function openConvite(){
  if (visitando){ toast("Visita não convida 😉"); return; }
  openPanel("convite", "Convidar 🔗", corpo => {
    const box = el("div", "linkbox"); box.append(el("code", null, link()));
    box.append(btn("Copiar link", "btn small", async () => { try { await navigator.clipboard.writeText(link()); toast("Link copiado."); } catch(e){ toast("Segure o dedo no link para copiar."); } }));
    if (navigator.share) box.append(btn("Enviar", "btn ghost small", () => navigator.share({ title: "Casinha", text: "Vem pra nossa casinha!", url: link() }).catch(() => {})));
    corpo.append(el("p", "muted", "Quem abrir este link entra na casa e monta o próprio bonequinho. Dá pra mandar pelo WhatsApp."), box);
  });
}

// contadores das abas: bilhete novo, presente, recado de voz e bebê chorando no Nós; convite de jogo/passeio na Diversão; traços no Eu
function contadores16(){
  if (!me) return {};
  const c = {};
  if (!visitando){
    const n = muralNovos() + meusPresentes().length + vozNovas().length, chora = algumBebeChorando(); // leva 13: qualquer filho bebê
    c.nos = chora ? "😢" : n || 0;
    c.eu = meusTracos().length < 3 ? "!" : 0;
  }
  const jogo = Object.values(jogos || {}).filter(g => g && g.b === pid && g.estado === "convite").length;
  c.diversao = jogo + (psConvite16() ? 1 : 0) || 0;
  return c;
}
let nav16Sig = "";
function renderNav16(){
  const nav = $("nav16"); if (!nav) return;
  const mostra = !!me && !$("screenGame").hidden;
  if (nav.hidden === mostra) nav.hidden = !mostra;
  document.body.classList.toggle("comNav16", mostra);
  if (!mostra) return;
  const c = contadores16(), aberta = abaAberta(), s = JSON.stringify([c, aberta]);
  if (s === nav16Sig) return; nav16Sig = s;
  for (const b of nav.querySelectorAll("button")){
    const k = b.dataset.aba, n = c[k], d = b.querySelector(".dot16");
    d.hidden = !n; d.textContent = n ? String(n) : "";
    b.setAttribute("aria-expanded", String(aberta === k));
    b.setAttribute("aria-label", ABAS16[k][1] + (n ? (n === "😢" ? ", bebê chorando" : n === "!" ? ", tem aviso" : ", " + n + (n === 1 ? " novidade" : " novidades")) : ""));
  }
}
// painel "Nós": mural entra (com contador), avisos e bairro vão pros Ajustes, metas do lar pra Casa; contadores nos botões
{ const f0 = nosBotoes9; nosBotoes9 = function(){
  const g = f0();
  for (const b of [...g.children]){
    const l = b.getAttribute("aria-label") || "";
    if (/^(Avisos|Bairro|Metas do lar)/.test(l)) { b.remove(); continue; }
    const n = /^Presentes/.test(l) ? meusPresentes().length : /^Recados de voz/.test(l) ? vozNovas().length : 0;
    if (n){ b.classList.add("comDot16"); b.append(el("span", "dot", String(n))); }
  }
  if (!visitando){
    const n = muralNovos(), b = btn("", "btn ghost escolha comDot16", () => { closePanel(); $("bMural").click(); });
    b.append(el("strong", null, "📌 Mural"), el("small", null, n ? n + (n === 1 ? " bilhete novo!" : " bilhetes novos!") : "Bilhetes da casa"));
    if (n) b.append(el("span", "dot", String(n)));
    b.setAttribute("aria-label", "Mural: " + (n ? n + " bilhetes novos" : "bilhetes da casa")); g.prepend(b);
  }
  return g;
}; }
// atualiza a aba aberta (contadores e textos mudam com o jogo)
function refreshAba16(){ const k = abaAberta(); if (k && k !== "nos") refreshPanel("aba-" + k); }

// tela de criar casa: colar o link (no app instalado não tem barra de endereço)
{
  const box = el("form", "colar16"), inp = el("input"), b = el("button", "btn ghost", "Entrar");
  inp.type = "text"; inp.placeholder = "Cole aqui o link da casa"; inp.setAttribute("aria-label", "Link da casa"); b.type = "submit";
  box.append(inp, b);
  box.addEventListener("submit", e => {
    e.preventDefault(); const v = inp.value.trim();
    const m = /#([a-z0-9-]{10,40})/i.exec(v) || /^([a-z0-9-]{10,40})$/i.exec(v);
    if (!m){ toast("Esse link não parece ser de uma casa."); return; }
    location.hash = m[1].toLowerCase();
  });
  $("screenRoom").append(box);
}

// ---------------------------------------------------------------------
// 4. TUTORIAL (primeira vez de cada jogador; visita tem um curtinho)
// ---------------------------------------------------------------------
// alvo(): um elemento da página ou um retângulo da tela { x, y, w, h } (pra coisas desenhadas no canvas)
function rectTile16(x, y, w, h){ const r = canvas.getBoundingClientRect(), k = r.width / (W * T); return { x: r.left + x * T * k, y: r.top + y * T * k, w: w * T * k, h: h * T * k }; }
function alvoChao16(){
  if (!me) return canvas;
  for (const [dx, dy] of [[2, 1], [-2, 1], [2, -1], [-2, -1], [1, 2], [3, 0], [-3, 0], [0, 2]]){ const x = me.tx + dx, y = me.ty + dy; if (walkable(x, y)) return rectTile16(x, y, 1, 1); }
  return rectTile16(me.tx, me.ty, 1, 1);
}
function alvoMovel16(){
  for (const t of ["geladeira", "sofa", "casal", "tv", "pc", "chuveiro", "mesa"]){
    const id = movDe16(t); if (!id) continue; const m = moveis[id], c = CAT[m.t], top = Math.ceil((TOP[m.t] || 0) / T);
    return rectTile16(m.x, m.y - top, c.w, c.h + top);
  }
  return canvas;
}
function alvoOutro16(){
  const o = Object.entries(jogadores).find(([id, j]) => id !== pid && j.online && (j.andar || 0) === andarAtual && disp[id]);
  if (o){ const d = disp[o[0]]; return rectTile16(d.x - .25, d.y - 1.2, 1.5, 2.2); }
  return $("people");
}
const TUT16 = [
  { alvo: alvoChao16, tx: "Toque no chão pra andar. Seu bonequinho vai sozinho até lá." },
  { alvo: alvoMovel16, tx: "Toque num móvel pra usar: geladeira mata a fome, cama dá energia, sofá descansa, chuveiro limpa." },
  { alvo: alvoOutro16, tx: "Toque em outra pessoa pra chamar: conversar, abraçar, jogar junto, namorar. Fazer coisas juntos rende mais 💞" },
  { alvo: () => $("n16casa"), tx: "🏠 Casa: construir e decorar, tarefas do dia, faxina, despensa e a loja da semana." },
  { alvo: () => $("n16nos"), tx: "💞 Nós: mural de bilhetes, presentes, bebê, datas, álbum, saudade e a nossa história." },
  { alvo: () => $("n16eu"), tx: "✨ Eu: humor, traços, desejos, habilidades e o espelho." },
  { alvo: () => $("n16diversao"), tx: "🎮 Diversão: jogos a dois, cinema, passeio de carro, música e troféus." },
  { alvo: () => $("n16ajustes"), tx: "⚙️ Ajustes: convide pelo link, instale no celular, som e avisos. Este tutorial fica aqui também." }
];
const TUT16_VISITA = [
  { alvo: alvoChao16, tx: "Você está de visita 🏡 Toque no chão pra andar pela casa." },
  { alvo: alvoOutro16, tx: "Toque nos donos da casa pra conversar e abraçar. Dá pra jogar e usar as coisas também." },
  { alvo: () => document.querySelector(".visitaBar .btn") || $("n16casa"), tx: "Pra ir embora, toque em \"🏠 Voltar pra minha casa\"." }
];
let tut16 = null;
function chaveTut16(){ return visitando ? "casinha-tutorial-visita" : "casinha-tutorial-" + sala + "-" + pid; }
function marcarTutorial16(){
  store.set(chaveTut16(), "1");
  if (!visitando && me) ref("jogadores/" + pid + "/tutorial").set(firebase.database.ServerValue.TIMESTAMP).catch(() => {});
}
function iniciarTutorial(){
  if (tut16 || !me || $("screenGame").hidden) return;
  closePanel(); closeMenu(); if (mode !== "live") setMode("live");
  const passos = visitando ? TUT16_VISITA : TUT16;
  const fundo = el("div", "tut16"), alvo = el("div", "alvo16"), bal = el("div", "bal16");
  bal.setAttribute("role", "dialog"); bal.setAttribute("aria-modal", "true"); bal.setAttribute("aria-labelledby", "tut16tx");
  const tx = el("p", "tx16"), cont = el("span", "cont16"), bb = el("div", "bb16"), dir = el("div", "bbd16");
  tx.id = "tut16tx"; tx.setAttribute("aria-live", "polite");
  let i = 0;
  const pular = btn("Pular", "btn ghost small", () => fim(true)), prox = btn("Próximo", "btn small", () => ir(i + 1));
  dir.append(pular, prox); bb.append(cont, dir); bal.append(tx, bb); fundo.append(alvo, bal); document.body.append(fundo);
  const pos = () => {
    let a = passos[i].alvo(); if (!a) a = canvas;
    const r0 = a.getBoundingClientRect ? a.getBoundingClientRect() : null, r = r0 ? { x: r0.left, y: r0.top, w: r0.width, h: r0.height } : a;
    const pad = 6, vw = document.documentElement.clientWidth, vh = window.innerHeight;
    Object.assign(alvo.style, { left: (r.x - pad) + "px", top: (r.y - pad) + "px", width: (r.w + pad * 2) + "px", height: (r.h + pad * 2) + "px" });
    const bw = bal.offsetWidth, bh = bal.offsetHeight;
    let top = r.y + r.h + pad + 10; if (top + bh > vh - 8) top = r.y - pad - 10 - bh;
    bal.style.top = clamp(top, 8, Math.max(8, vh - bh - 8)) + "px";
    bal.style.left = clamp(r.x + r.w / 2 - bw / 2, 8, Math.max(8, vw - bw - 8)) + "px";
  };
  const ir = n => {
    if (n >= passos.length){ fim(false); return; }
    i = n; tx.textContent = passos[i].tx; cont.textContent = (i + 1) + " de " + passos.length;
    prox.textContent = i === passos.length - 1 ? "Começar!" : "Próximo";
    if (i < 3) canvas.scrollIntoView({ block: "nearest" });
    pos(); prox.focus({ preventScroll: true });
  };
  const fim = pulou => {
    if (!tut16) return; tut16 = null; fundo.remove(); window.removeEventListener("resize", pos); marcarTutorial16();
    toast(pulou ? "Dá pra ver o tutorial de novo em ⚙️ Ajustes." : "Pronto! Divirtam-se 💞");
  };
  fundo.addEventListener("keydown", e => { if (e.key === "Escape"){ e.stopPropagation(); fim(true); } if (e.key === "Tab"){ e.preventDefault(); (document.activeElement === prox ? pular : prox).focus(); } });
  fundo.addEventListener("click", e => { if (e.target === fundo) prox.focus(); }); // fora do balão não faz nada (e não mexe na casa)
  tut16 = { pos, ir, fim };
  window.addEventListener("resize", pos);
  ir(0);
}
// abre sozinho na primeira vez: casa na tela, sem painel aberto, uns segundos depois de entrar
let tutChecado = "", tutVisivelDesde = 0;
function vigiarTutorial(){
  if (!me || !me.dados || $("screenGame").hidden){ tutVisivelDesde = 0; return; }
  const chave = chaveTut16(); if (tutChecado === chave) return;
  if (store.get(chave) || (!visitando && me.dados.tutorial)){ tutChecado = chave; return; }
  if (!tutVisivelDesde) tutVisivelDesde = Date.now();
  if (Date.now() - tutVisivelDesde < 2500 || painel || menuEl || tut16 || mode !== "live") return;
  tutChecado = chave; iniciarTutorial();
}

// ---------------------------------------------------------------------
// ritmo: 4x por segundo (barato: cada parte só mexe no DOM quando algo muda)
// ---------------------------------------------------------------------
let ritmo16 = 0;
setInterval(() => {
  try {
    vigiarSplash(); renderNav16();
    if (++ritmo16 % 4) return; // o resto, 1x por segundo
    vigiarRede(); refreshAba16(); vigiarTutorial(); guardarFotoCasa();
    if (tut16) tut16.pos();
  } catch(e){ console.error(e); }
}, 250);
