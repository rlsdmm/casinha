"use strict";
// Casinha · leva 5: efeitos sonoros e música (Web Audio)
// =====================================================================
// LEVA 5: truques do bichinho, visitas surpresa, sujeira e faxina, música no toca-discos e sons
//   casa/pet/truque = { tipo, at, por }     último truque pedido; todos veem a animação por TRUQUE_MS
//   casa/stats/carinhos                       carinhos acumulados (já existia): destrava os truques
//   casa/visita/<id da visita> = { bolo: pid, deu: pid, pacote: { por, at } }
//   casa/visita/gato = { dias: { "AAAA-MM-DD": pid }, comeu: ts, amigo: ts }
//     a visita sai de hash(sala, bloco de 2h): a mesma, na mesma hora, pra todo mundo da casa
//   casa/sujeira/<id> = { tipo, x, y, andar, criada, v, mov? }   (mov = pia da louça)
//   casa/sujeiraAte = último bloco de 45 min já sorteado (transação: só um aparelho sorteia cada bloco)
//   casa/musica = { faixa, desde, por, mov }  toca pra todos, sincronizada pela posição no tempo
//   casa/leva5 = true                         migração: põe um toca-discos se a casa não tiver
//   jogadores/<pid>/tarefas/<data>/limpezas   conta pra tarefa "Limpar 3 sujeiras"
//   localStorage (de cada aparelho): casinha-som, casinha-musica ("0" = desligado), casinha-vol-som, casinha-vol-musica (0..1)
//   Teste: ?visita=vizinho|carteiro|gato   forcarVisita("carteiro")   sujar(3)   AUD (estado do áudio)
// =====================================================================

// ---------------- áudio: tudo sintetizado com Web Audio, sem arquivos ----------------
// O AudioContext só nasce no primeiro toque/tecla (regra dos navegadores). Antes disso, sfx() não faz nada.
// sfx(tipo, vol): passo, porta, toc, moeda, agua, regar, panela, fritura, ronronar, latido, miau, pop, beijo,
//                 notif, fanfarra, limpar, truque, comida, disco. Cada tipo tem um intervalo mínimo (não repete a cada quadro).
const AUD = { ctx: null, tocadas: 0, sfxTocados: 0, ultimo: {}, erro: null, avisou: false };
const prefOn = k => store.get(k) !== "0";
const prefVol = (k, d) => { const v = parseFloat(store.get(k)); return isFinite(v) ? clamp(v, 0, 1) : d; };
const audioPronto = () => !!AUD.ctx && AUD.ctx.state === "running";
function audioDesbloquear(){
  try {
    if (!AUD.ctx){
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      AUD.ctx = new AC(); montarAudio();
      AUD.ctx.onstatechange = () => { refreshPanel("som"); };
    }
    if (AUD.ctx.state === "suspended" && !document.hidden) AUD.ctx.resume().catch(() => {});
  } catch(e){ AUD.erro = String(e); }
}
for (const ev of ["pointerdown", "keydown", "touchend"]) document.addEventListener(ev, audioDesbloquear, { passive: true, capture: true });
document.addEventListener("visibilitychange", () => {
  if (!AUD.ctx) return;
  if (document.hidden) AUD.ctx.suspend().catch(() => {}); else AUD.ctx.resume().catch(() => {});
});
function montarAudio(){
  const c = AUD.ctx;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.connect(c.destination);
  AUD.master = c.createGain(); AUD.master.gain.value = .9; AUD.master.connect(comp);
  AUD.sfx = c.createGain(); AUD.sfx.connect(AUD.master);
  // música: entra em musIn, passa por um passa-baixa (lo-fi) e um reverb curtinho; AUD.mus = volume (preferência × distância)
  AUD.mus = c.createGain(); AUD.mus.gain.value = 0; AUD.mus.connect(AUD.master);
  AUD.musIn = c.createGain();
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3400; lp.Q.value = .5;
  const rev = c.createConvolver(); rev.buffer = impulsoReverb(c, 2.4);
  const wet = c.createGain(); wet.gain.value = .3;
  AUD.musIn.connect(lp); lp.connect(AUD.mus); lp.connect(rev); rev.connect(wet); wet.connect(AUD.mus);
  const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  AUD.ruido = n;
  aplicarVolSom();
}
function impulsoReverb(c, seg){
  const len = Math.floor(c.sampleRate * seg), b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++){ const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}
function aplicarVolSom(){ if (AUD.sfx) AUD.sfx.gain.setTargetAtTime(prefOn("casinha-som") ? .5 * prefVol("casinha-vol-som", .6) : 0, AUD.ctx.currentTime, .05); }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// tom: oscilador com envelope. o = { f, f2 | curva: [[freq, dt]], dur, g, at, tipo, sus, rel, lp }
function tom(dest, t, o){
  const c = AUD.ctx, os = c.createOscillator(), g = c.createGain();
  os.type = o.tipo || "sine"; os.frequency.setValueAtTime(o.f, t);
  if (o.curva) for (const [fq, dt] of o.curva) os.frequency.exponentialRampToValueAtTime(fq, t + dt);
  else if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
  const at = o.at || .005, pk = Math.max(.0002, o.g || .2), fim = t + o.dur;
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(pk, t + at);
  if (o.sus){ g.gain.setValueAtTime(pk, Math.max(t + at, fim - (o.rel || .3))); g.gain.linearRampToValueAtTime(.0001, fim); }
  else g.gain.exponentialRampToValueAtTime(.0001, fim);
  let saida = g;
  if (o.lp){ const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; g.connect(f); saida = f; }
  os.connect(g); saida.connect(dest); os.start(t); os.stop(fim + .05);
  AUD.tocadas++;
}
// ruído filtrado: o = { filtro, f, f2, q, dur, g, at }
function ruido(dest, t, o){
  const c = AUD.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AUD.ruido; s.loop = true;
  f.type = o.filtro || "lowpass"; f.frequency.setValueAtTime(o.f || 1000, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur); f.Q.value = o.q || .7;
  const at = o.at || .004, pk = Math.max(.0002, o.g || .1);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(pk, t + at); g.gain.exponentialRampToValueAtTime(.0001, t + o.dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * .5); s.stop(t + o.dur + .05);
  AUD.tocadas++;
}
const SFX_MIN = { passo: 210, porta: 1200, toc: 900, moeda: 90, agua: 1200, regar: 900, panela: 1500, fritura: 900, ronronar: 1500, latido: 900, miau: 1200, pop: 150, beijo: 200, notif: 600, fanfarra: 1500, limpar: 450, truque: 800, comida: 800, disco: 800 };
function sfx(tipo, vol){
  if (!audioPronto() || !prefOn("casinha-som") || !AUD.sfx) return false;
  const agora = performance.now();
  if (agora - (AUD.ultimo[tipo] || 0) < (SFX_MIN[tipo] || 100)) return false;
  AUD.ultimo[tipo] = agora;
  const c = AUD.ctx, t = c.currentTime + .01, d = AUD.sfx, v = vol == null ? 1 : vol;
  try {
    switch (tipo){
      case "passo": AUD.pe = !AUD.pe; ruido(d, t, { f: AUD.pe ? 520 : 430, dur: .07, g: .07 * v }); tom(d, t, { f: AUD.pe ? 95 : 84, f2: 60, dur: .06, g: .05 * v }); break;
      case "porta": tom(d, t, { f: 150, f2: 95, dur: .16, g: .14 * v, tipo: "triangle" }); ruido(d, t, { f: 700, dur: .1, g: .05 * v }); break;
      case "toc": for (const k of [0, .17]){ tom(d, t + k, { f: 210, f2: 120, dur: .09, g: .22 * v, tipo: "triangle" }); ruido(d, t + k, { filtro: "bandpass", f: 1200, dur: .04, g: .08 * v }); } break;
      case "moeda": tom(d, t, { f: 988, dur: .09, g: .13 * v, tipo: "triangle" }); tom(d, t + .07, { f: 1319, dur: .24, g: .13 * v, tipo: "triangle" }); break;
      case "agua": ruido(d, t, { filtro: "bandpass", f: 2200, q: .8, dur: 1.3, at: .15, g: .05 * v }); break;
      case "regar": ruido(d, t, { filtro: "bandpass", f: 3000, q: 1, dur: .8, at: .1, g: .045 * v }); break;
      case "panela": tom(d, t, { f: 1250, dur: .35, g: .05 * v, tipo: "triangle" }); tom(d, t, { f: 1870, dur: .25, g: .025 * v }); tom(d, t + .12, { f: 1180, dur: .3, g: .04 * v, tipo: "triangle" }); break;
      case "fritura": for (let i = 0; i < 10; i++) ruido(d, t + Math.random() * .8, { filtro: "highpass", f: 3000 + Math.random() * 3000, dur: .03, g: (.02 + Math.random() * .03) * v }); break;
      case "ronronar": {
        const s = c.createBufferSource(); s.buffer = AUD.ruido; s.loop = true;
        const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 240;
        const am = c.createGain(); am.gain.value = .5;
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 23; lg.gain.value = .5; lfo.connect(lg); lg.connect(am.gain);
        const env = c.createGain(); env.gain.setValueAtTime(.0001, t); env.gain.linearRampToValueAtTime(.4 * v, t + .25); env.gain.setValueAtTime(.4 * v, t + 1.1); env.gain.linearRampToValueAtTime(.0001, t + 1.5);
        s.connect(f); f.connect(am); am.connect(env); env.connect(d);
        s.start(t); lfo.start(t); s.stop(t + 1.6); lfo.stop(t + 1.6); AUD.tocadas++; break;
      }
      case "latido": for (const k of [0, .19]) tom(d, t + k, { f: 680, f2: 430, dur: .12, g: .07 * v, tipo: "sawtooth", lp: 1500, at: .01 }); break;
      case "miau": tom(d, t, { f: 600, curva: [[900, .14], [560, .45]], dur: .48, g: .07 * v, tipo: "triangle", lp: 2200, at: .03 }); break;
      case "pop": tom(d, t, { f: 380, f2: 980, dur: .12, g: .12 * v }); break;
      case "beijo": tom(d, t, { f: 1500, f2: 2600, dur: .06, g: .08 * v }); ruido(d, t + .02, { filtro: "highpass", f: 2500, dur: .03, g: .05 * v }); tom(d, t + .1, { f: 700, f2: 1100, dur: .1, g: .05 * v }); break;
      case "notif": tom(d, t, { f: 880, dur: .5, g: .07 * v }); tom(d, t + .13, { f: 1318.5, dur: .7, g: .07 * v }); break;
      case "fanfarra": [72, 76, 79, 84].forEach((m, i) => tom(d, t + i * .09, { f: mtof(m), dur: .5, g: .06 * v, tipo: "triangle" })); break;
      case "limpar": ruido(d, t, { filtro: "bandpass", f: 1800, f2: 4200, q: 1.2, dur: .22, at: .06, g: .06 * v }); break;
      case "truque": [67, 71, 74, 79].forEach((m, i) => tom(d, t + i * .07, { f: mtof(m), dur: .25, g: .06 * v })); break;
      case "comida": for (let i = 0; i < 4; i++) ruido(d, t + i * .11, { filtro: "bandpass", f: 2400, q: 1.5, dur: .05, g: .07 * v }); break;
      case "nivel": [72, 76, 79, 84, 88].forEach((m, i) => { tom(d, t + i * .08, { f: mtof(m), dur: .35, g: .06 * v, tipo: "triangle" }); tom(d, t + i * .08 + .02, { f: mtof(m + 12), dur: .2, g: .02 * v }); }); break; // leva 6
      case "sinal": tom(d, t, { f: 1046, dur: .16, g: .12 * v, tipo: "square", lp: 2600 }); tom(d, t + .1, { f: 1568, dur: .22, g: .1 * v, tipo: "square", lp: 2600 }); break;
      case "erro": tom(d, t, { f: 220, f2: 150, dur: .25, g: .1 * v, tipo: "sawtooth", lp: 900 }); break;
      case "acerto": [76, 79, 84].forEach((m, i) => tom(d, t + i * .07, { f: mtof(m), dur: .3, g: .07 * v, tipo: "triangle" })); break;
      case "disco": for (let i = 0; i < 6; i++) ruido(d, t + Math.random() * .4, { filtro: "highpass", f: 4000, dur: .02, g: .05 * v }); tom(d, t + .05, { f: 60, dur: .15, g: .08 * v }); break;
      // leva 7
      case "cabeceira": for (const k of [0, .3]){ tom(d, t + k, { f: 92, f2: 62, dur: .13, g: .13 * v, tipo: "triangle", lp: 420 }); ruido(d, t + k, { f: 260, dur: .05, g: .03 * v }); } break; // toc toc abafado
      case "choro": tom(d, t, { f: 560, curva: [[720, .12], [500, .42]], dur: .45, g: .04 * v, tipo: "triangle", lp: 1700, at: .05 }); tom(d, t + .55, { f: 600, curva: [[760, .12], [470, .5]], dur: .55, g: .035 * v, tipo: "triangle", lp: 1700, at: .05 }); break;
      case "chute": tom(d, t, { f: 180, f2: 110, dur: .1, g: .1 * v, tipo: "triangle", lp: 600 }); tom(d, t + .12, { f: 520, f2: 1100, dur: .12, g: .06 * v }); break;
      case "risada": [86, 90, 88, 93].forEach((m, i) => tom(d, t + i * .09, { f: mtof(m), dur: .1, g: .035 * v, tipo: "triangle", lp: 3000 })); break;
      // leva 9
      case "foto": ruido(d, t, { filtro: "highpass", f: 3000, dur: .05, g: .08 * v }); tom(d, t + .05, { f: 1800, f2: 900, dur: .05, g: .05 * v, tipo: "square", lp: 3000 }); ruido(d, t + .08, { filtro: "bandpass", f: 1500, dur: .14, g: .05 * v }); break;
      case "papel": for (let i = 0; i < 5; i++) ruido(d, t + i * .05, { filtro: "bandpass", f: 2400 + i * 450, q: .8, dur: .07, g: .06 * v }); break;
      case "pipoca": for (let i = 0; i < 4; i++) tom(d, t + Math.random() * .5, { f: 600 + Math.random() * 500, f2: 220, dur: .04, g: .07 * v, tipo: "triangle" }); break;
      case "susto": tom(d, t, { f: 180, f2: 90, dur: .3, g: .12 * v, tipo: "sawtooth", lp: 800 }); tom(d, t + .02, { f: 1400, f2: 2200, dur: .25, g: .03 * v, tipo: "square", lp: 3000 }); break;
      case "fosforo": ruido(d, t, { filtro: "bandpass", f: 2000, f2: 5000, q: .9, dur: .28, at: .02, g: .05 * v }); break;
      default: return false;
    }
  } catch(e){ AUD.erro = String(e); return false; }
  AUD.sfxTocados++; return true;
}
// som que acompanha o começo de uma ação minha
function sfxInicio(id){
  if (id === "regar") sfx("regar");
  else if (/^coz-/.test(id) && id !== "coz-ajuda") sfx("panela");
  else if (id === "pet-comida") sfx("comida");
  else if (id === "disco") sfx("disco");
  else if (id === "banho" || id === "banheira" || id === "piscina" || id === "jacuzzi") sfx("agua", .8);
}

// ---------------- música original no toca-discos ----------------
// Cada faixa: andamento, 4 acordes (baixo, vozes em MIDI), escala da melodia (pentatônica: tudo combina).
// A melodia sai de um hash fixo: 8 compassos que se repetem (AABA-ish), iguais em todo aparelho.
const FAIXAS = [
  { id: "domingo", nome: "Domingo de Manhã", desc: "Manhã preguiçosa, pão quentinho", bpm: 84, inst: "piano", batida: 1,
    acordes: [[48, [55, 59, 64, 67]], [45, [55, 57, 60, 64]], [41, [57, 60, 64, 65]], [43, [55, 59, 62, 65]]], escala: [60, 62, 64, 67, 69, 72, 74, 76] },
  { id: "chuva", nome: "Chuva na Janela", desc: "Gotinhas no vidro e um cobertor", bpm: 68, inst: "piano", gotas: 1,
    acordes: [[45, [57, 60, 64, 67]], [41, [57, 60, 64, 65]], [48, [55, 59, 60, 64]], [40, [55, 59, 62, 64]]], escala: [57, 60, 62, 64, 67, 69, 72, 74] },
  { id: "cafe", nome: "Café com Leite", desc: "Batidinha lo-fi pra cozinhar", bpm: 90, inst: "piano", batida: 1, swing: .18,
    acordes: [[41, [57, 60, 64, 65]], [38, [57, 60, 62, 65]], [43, [58, 62, 65, 67]], [36, [58, 62, 64, 67]]], escala: [65, 67, 69, 72, 74, 77, 79, 81] },
  { id: "noite", nome: "Noite Estrelada", desc: "Sininhos pra pegar no sono", bpm: 60, inst: "sino",
    acordes: [[38, [57, 61, 62, 66]], [35, [57, 59, 62, 66]], [43, [59, 62, 66, 67]], [45, [57, 61, 64, 69]]], escala: [69, 71, 74, 76, 78, 81, 83, 86] },
  { id: "cafune", nome: "Cafuné", desc: "Dengo de fim de tarde", bpm: 74, inst: "piano", batida: 2,
    acordes: [[43, [59, 62, 66, 67]], [40, [55, 59, 62, 67]], [36, [55, 59, 64, 67]], [38, [57, 62, 66, 69]]], escala: [67, 69, 71, 74, 76, 79, 81, 83] },
  // leva 9: toca sozinha no jantar à luz de velas (casa/musica.jantar); também dá pra pôr no toca-discos
  { id: "velas", nome: "Luz de Velas", desc: "Pra jantar a dois, bem juntinho", bpm: 64, inst: "piano", batida: 2,
    acordes: [[41, [57, 60, 64, 65]], [40, [55, 59, 62, 64]], [38, [57, 60, 62, 65]], [43, [55, 59, 62, 65]]], escala: [64, 67, 69, 72, 74, 76, 79, 81] }
];
FAIXAS.forEach((fx, i) => {
  fx.mel = [];
  for (let s = 0; s < 64; s++){
    const bar = Math.floor(s / 8), pos = s % 8, se = bar >= 4 && bar < 6 ? s - 32 : s, h = hash(i + 11, se, 733);
    const ch = (pos === 0 ? 62 : pos % 2 ? 14 : 40) * (fx.inst === "sino" ? .75 : 1);
    fx.mel.push(h % 100 >= ch || (bar % 4 === 3 && pos >= 6) ? null : { m: fx.escala[2 + (h >>> 8) % 5], d: 1 + (h >>> 13) % 3 });
  }
});
function padAcorde(fx, bar, t, dur, bus){
  fx.acordes[bar % 4][1].forEach((m, k) => tom(bus, t + k * .012, { f: mtof(m), dur: dur + .3, g: .028, tipo: "triangle", at: .35, sus: 1, rel: .5, lp: 1600 }));
}
function tocarPasso(fx, s, t, bus){
  const sd = 60 / fx.bpm / 2, bar = Math.floor(s / 8) % 8, pos = s % 8, baixo = fx.acordes[bar % 4][0];
  if (fx.swing && pos % 2) t += sd * fx.swing;
  if (pos === 0){ padAcorde(fx, bar, t, sd * 8, bus); tom(bus, t, { f: mtof(baixo), dur: sd * 3.2, g: .15, at: .015, lp: 600 }); }
  if (pos === (fx.batida === 2 ? 3 : 5)) tom(bus, t, { f: mtof(baixo + 7), dur: sd * 2, g: .1, at: .015, lp: 600 });
  if (pos === 6 && fx.batida) tom(bus, t, { f: mtof(baixo + 12), dur: sd * 1.5, g: .08, at: .015, lp: 600 });
  const n = fx.mel[s % 64];
  if (n){
    const f = mtof(n.m);
    if (fx.inst === "sino"){ tom(bus, t, { f, dur: 1.9, g: .045 }); tom(bus, t, { f: f * 2.4, dur: .7, g: .01 }); }
    else { tom(bus, t, { f, dur: n.d * sd + .45, g: .06, at: .006 }); tom(bus, t, { f: f * 2, dur: .3, g: .014, at: .004 }); }
  }
  if (fx.batida){
    if (pos === 0 || pos === 5) tom(bus, t, { f: 115, f2: 42, glide: .14, dur: .22, g: .2 });
    if (pos === 4) ruido(bus, t, { filtro: "bandpass", f: 1700, q: .7, dur: .16, g: .045 });
    if (pos % 2 === 0) ruido(bus, t, { filtro: "highpass", f: 7000, dur: .035, g: pos === 4 ? .012 : .018 });
  }
  if (fx.gotas && hash(s, 3, 717) % 100 < 22) tom(bus, t + sd * .5, { f: mtof(84 + (hash(s, 4, 717) % 4) * 3), dur: .3, g: .016 });
  if (hash(s, 5, 718) % 4 === 0) ruido(bus, t + sd * .37, { filtro: "highpass", f: 5200, dur: .012, g: .012 }); // chiado de vinil
}
let musica = null, musicaCarregada = false;
const MUSICA_MAX = 3 * HORA; // ninguém trocou o disco em 3h: acabou o lado do disco
const MUS = { key: null, bus: null, prox: 0 };
function musicaAtiva(){
  if (!musica || !musica.desde) return null;
  const fx = FAIXAS.find(f => f.id === musica.faixa), m = todosMoveis[musica.mov];
  // leva 9: no jantar à luz de velas a música sai da mesa (mov = mesa) enquanto o jantar dura
  const jt = !!musica.jantar && typeof jantarTocando === "function" && jantarTocando(musica.jantar);
  if (!fx || !m || (musica.jantar ? !jt : m.t !== "som") || srvNow() - musica.desde > MUSICA_MAX) return null;
  return { fx, desde: musica.desde, mov: jt ? null : musica.mov, por: musica.por, andar: m.andar || 0, m, jantar: jt };
}
function musParar(){
  MUS.key = null; if (!MUS.bus) return;
  const b = MUS.bus; MUS.bus = null;
  try { b.gain.setTargetAtTime(0, AUD.ctx.currentTime, .15); setTimeout(() => { try { b.disconnect(); } catch(e){} }, 1500); } catch(e){}
}
// agenda as notas dos próximos ~0,4 s, sempre a partir da posição da música no relógio do servidor
function musTick(){
  const mu = musicaAtiva(), jogo = !!me && !$("screenGame").hidden;
  if (mu && jogo && prefOn("casinha-musica") && !audioPronto() && !AUD.avisou){ AUD.avisou = true; toast("♪ Tem música no toca-discos. Toque na tela pra ouvir."); }
  if (!mu || !jogo || !prefOn("casinha-musica") || !audioPronto()){ musParar(); return; }
  const c = AUD.ctx, key = mu.fx.id + "|" + mu.desde, sd = 60 / mu.fx.bpm / 2, songT = Math.max(0, (srvNow() - mu.desde) / 1000);
  try {
    if (MUS.key !== key){
      musParar(); MUS.key = key; MUS.bus = c.createGain(); MUS.bus.connect(AUD.musIn); MUS.prox = Math.ceil(songT / sd);
      const s0 = Math.floor(songT / sd), resto = (8 - s0 % 8) * sd - (songT - s0 * sd);
      if (s0 % 8 && resto > .4) padAcorde(mu.fx, Math.floor(s0 / 8), c.currentTime + .02, resto, MUS.bus); // entrou no meio do compasso
    }
    if (songT - MUS.prox * sd > 1) MUS.prox = Math.ceil(songT / sd);
    const now = c.currentTime;
    while (MUS.prox * sd < songT + .4){ const ts = MUS.prox * sd; if (ts >= songT - .03) tocarPasso(mu.fx, MUS.prox, now + (ts - songT), MUS.bus); MUS.prox++; }
    // outro andar: bem baixinho; no mesmo andar, mais baixo quanto mais longe do toca-discos
    let fator = .3;
    if (mu.andar === andarAtual) fator = clamp(1.1 - Math.hypot(me.px - (mu.m.x + .5), me.py - (mu.m.y + .5)) / 18, .5, 1);
    AUD.mus.gain.setTargetAtTime(.7 * prefVol("casinha-vol-musica", .6) * fator, now, .4);
  } catch(e){ AUD.erro = String(e); }
}
setInterval(musTick, 80);
function somDaCasa(){ return primeiro("som") || Object.keys(todosMoveis).filter(k => todosMoveis[k] && todosMoveis[k].t === "som").sort()[0] || null; }
function escolherFaixa(fid, som){
  audioDesbloquear(); closePanel();
  if (moveis[som]) return useFurn(som, { id: "disco", nome: fid ? "Colocando um disco" : "Desligando o toca-discos", dur: 1.5, ganho: { diversao: 3 }, fim: () => definirMusica(fid, som) });
  definirMusica(fid, som); // toca-discos no outro andar: troca de longe mesmo
}
function definirMusica(fid, som){
  const fx = FAIXAS.find(f => f.id === fid);
  ref("casa/musica").set(fx ? { faixa: fid, desde: TS(), por: pid, mov: som } : null)
    .then(() => toast(fx ? "Tocando “" + fx.nome + "”." + (prefOn("casinha-musica") ? "" : " (A música está desligada neste aparelho.)") : "Toca-discos desligado."), () => toast("Não deu pra trocar o disco."));
}
MENU_EXTRA.som = id => {
  const mu = musicaAtiva(), aqui = mu && mu.mov === id;
  const it = [{ nome: "Escolher música", info: aqui ? "♪ " + mu.fx.nome : "Toca-discos", fn: () => openSom(id) }];
  if (aqui) it.push({ nome: "Desligar a música", fn: () => escolherFaixa(null, id) });
  return it;
};
function openSom(movId){
  openPanel("som", "Som e música", corpo => {
    const aviso = el("p", "muted"), linha = el("div", "hbtns"), tocando = el("p"), faixas = el("div", "list");
    tocando.style.fontWeight = "700";
    const chave = (k, rot, fem) => {
      const b = btn("", "btn ghost", () => {
        audioDesbloquear(); store.set(k, prefOn(k) ? "0" : "1"); aplicarVolSom(); upd(); renderLeva5Hud();
        if (k === "casinha-som" && prefOn(k)) setTimeout(() => sfx("pop"), 60);
      });
      b.dataset.k = k; b.dataset.rot = rot; b.dataset.fem = fem ? 1 : ""; return b;
    };
    const swSom = chave("casinha-som", "Sons"), swMus = chave("casinha-musica", "Música", 1);
    linha.append(swSom, swMus);
    const volume = (k, rot) => {
      const w = el("div", "need"), lab = el("label", null, rot), r = el("input");
      r.type = "range"; r.min = "0"; r.max = "100"; r.className = "rng"; r.id = "rng-" + k; lab.htmlFor = r.id;
      r.value = String(Math.round(prefVol(k, .6) * 100));
      r.oninput = () => { store.set(k, String(r.value / 100)); aplicarVolSom(); };
      r.onchange = () => { if (k === "casinha-vol-som") sfx("moeda"); };
      w.append(lab, r); return w;
    };
    corpo.append(aviso, el("h3", null, "Neste aparelho"), linha, volume("casinha-vol-som", "Volume dos sons"), volume("casinha-vol-musica", "Volume da música"),
      el("h3", null, "Toca-discos da casa"), tocando, faixas);
    const upd = () => {
      for (const b of [swSom, swMus]){ const on = prefOn(b.dataset.k); b.textContent = b.dataset.rot + ": " + (on ? (b.dataset.fem ? "ligada" : "ligados") : (b.dataset.fem ? "desligada" : "desligados")); b.setAttribute("aria-pressed", String(on)); }
      aviso.textContent = audioPronto() ? "Cada um escolhe o próprio volume. A música é a mesma pra todo mundo da casa, e fica mais baixa longe do toca-discos."
        : "O navegador só libera o som depois de um toque. Toque em qualquer lugar da tela e pronto.";
      const mu = musicaAtiva();
      tocando.textContent = mu ? "♪ Tocando: " + mu.fx.nome + (mu.por ? " · quem pôs: " + (mu.por === pid ? "você" : nomeDe(mu.por)) : "") : "O toca-discos está desligado.";
      faixas.textContent = "";
      const som = movId && todosMoveis[movId] ? movId : somDaCasa();
      if (!som){ faixas.append(el("p", "muted", "A casa ainda não tem toca-discos. Coloque um Som no modo Construir.")); return; }
      for (const fx of FAIXAS){
        const on = !!mu && mu.fx.id === fx.id, row = el("div", "rowi"), tx = el("div", "tx");
        tx.append(el("strong", null, fx.nome), el("small", null, fx.desc));
        const b = btn(on ? "Tocando ♪" : "Tocar", on ? "btn small" : "btn ghost small", () => escolherFaixa(fx.id, som));
        b.disabled = on; b.setAttribute("aria-label", (on ? "Tocando " : "Tocar ") + fx.nome);
        row.append(tx, b); faixas.append(row);
      }
      if (mu) faixas.append(btn("Desligar o toca-discos", "btn ghost", () => escolherFaixa(null, som)));
    };
    upd(); return upd;
  });
}
