"use strict";
// Casinha · v48: detalhes que se mexem lá fora (chamado no draw do 18-laco, depois dos objetos)
//  - sombra de nuvem passando devagar pela grama (de dia, sem chuva);
//  - borboletas no jardim na primavera e no verão; folhas voando no outono;
//  - a cortina das janelas altas balança com a brisa de vez em quando (no janelaAltaAnim35, 35-paredes).
// Tudo só do lado de fora da casa (mesmo recorte da chuva).

function clipFora37(){
  ctx.beginPath();
  if (typeof zeroAqui === "function" && zeroAqui()) chuvaClipZero();
  else {
    const Ww = W * T, Hh = H * T;
    ctx.rect(0, -TOPO, 9, Hh + TOPO); ctx.rect(Ww - 9, -TOPO, 9, Hh + TOPO); ctx.rect(0, HC * T + 7, Ww, Hh - HC * T - 7);
  }
  ctx.clip();
}
function borboleta37(x, y, f, cor){
  const asa = f ? 1 : 2, c2 = sh(cor, -.25);
  P(x, y, "#3A2A3A"); P(x, y + 1, "#3A2A3A");
  R(x - asa, y - (f ? 0 : 1), asa, 2, cor); R(x + 1, y - (f ? 0 : 1), asa, 2, cor);
  if (!f){ P(x - 2, y + 1, c2); P(x + 2, y + 1, c2); }
}
function vidaFora37(tm, hr){
  if (andarAtual !== 0) return;
  const kind = skyKind(hr), chuva = climaAgora(), est = estacao(), Ww = W * T, Hh = H * T, yB = HC * T + 10;
  ctx.save(); clipFora37();
  if (kind !== "noite" && !chuva){
    // sombra de nuvem atravessando a tela da esquerda pra direita
    const per = 46000, f = (tm % per) / per, cx = -60 + f * (Ww + 120), cy = Hh * .5 + Math.sin(tm / per * 6.3) * 40;
    ctx.fillStyle = "rgba(25,40,70,.07)";
    for (let dy = -22; dy <= 22; dy += 2){ const hw = Math.round(Math.sqrt(484 - dy * dy) * 2.2); ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2, 2); }
    if (est === "primavera" || est === "verao"){
      const cores = ["#FFFFFF", "#FFE08A", "#F9B8CC"];
      for (let i = 0; i < 3; i++){
        const t = tm / 1000 + i * 37, f2 = Math.floor(tm / 120 + i) % 2;
        let x, y;
        if (i === 0){ x = ((t * 9) % (Ww + 40)) - 20; y = yB + 2 + Math.sin(t * 1.7) * 2.5; } // embaixo, de um lado pro outro
        else { const lado = i === 1 ? 4 : Ww - 5, per2 = Hh + TOPO; y = ((t * 7 * (i === 1 ? 1 : -1)) % per2 + per2) % per2 - TOPO; x = lado + Math.sin(t * 2.1) * 2.5; } // nas laterais, subindo e descendo
        borboleta37(Math.round(x), Math.round(y), f2, cores[i]);
      }
    }
    if (est === "outono"){
      const gp = GRAMAS.outono;
      for (let i = 0; i < 4; i++){
        const t = tm / 1000 + i * 23, x = ((t * 14 + i * 70) % (Ww + 20)) - 10, y = yB - 1 + ((t * 3 + i * 3) % 7) + Math.sin(t * 2 + i) * 1.5;
        const c = gp.flores[i % gp.flores.length]; R(Math.round(x), Math.round(y), 2, 1, c); P(Math.round(x) + (Math.floor(t * 4) % 2), Math.round(y) + 1, sh(c, -.2));
      }
    }
  }
  ctx.restore();
}
// brisa na cortina: de vez em quando uma janela de cada vez, a ponta de baixo da cortina vai 1 px pra dentro e volta
function brisa37(px, x, tm, hr){
  if (skyKind(hr) === "noite" || climaAgora()) return;
  const per = 7000, f = ((tm + x * 1900) % per) / per; if (f > .18) return;
  const ida = Math.sin(f / .18 * Math.PI), d = ida > .5 ? 1 : 0; if (!d) return;
  const room = comodo(x, 1), [m, , dd] = CORTINA35[room] || [C.rose, "#F9C9D6", "#D97A96"], { gy, gh } = JAN35;
  for (let j = 11; j < gh + 3; j++){ P(px + 4 + (j > 13 ? 1 : 0), gy + j, m); P(px + 11 - (j > 13 ? 1 : 0), gy + j, dd); }
}
{ const f0 = janelaAltaAnim35; janelaAltaAnim35 = function(px, x, tm, hr){ f0(px, x, tm, hr); brisa37(px, x, tm, hr); }; }
