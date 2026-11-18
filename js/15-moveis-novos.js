"use strict";
// Casinha · leva 6: móveis, roupas e acessórios novos
// ---------------- móveis novos: presentes de nível e coleções da loja ----------------
const SENTA6 = (id, nome) => [{ id, nome, dur: 6, ganho: { energia: 8, diversao: 6 }, sobre: 1 }];
Object.assign(CAT, {
  // presentes do nível do casal (nivel = a partir de qual nível aparece no catálogo)
  aquario:     { nome: "Aquário", w: 2, h: 1, preco: 380, nivel: 3, acoes: [{ id: "aquario", nome: "Ver os peixinhos", dur: 8, ganho: { diversao: 20, energia: 5 }, junto: 1, juntoSocial: 2 }] },
  lareira:     { nome: "Lareira", w: 2, h: 1, preco: 520, nivel: 5, acoes: [{ id: "lareira", nome: "Esquentar na lareira", dur: 10, ganho: { energia: 15, diversao: 10 }, junto: 1, juntoSocial: 3 }] },
  fliperama:   { nome: "Fliperama", w: 1, h: 1, preco: 420, nivel: 7, acoes: [{ id: "fliperama", nome: "Jogar fliperama", dur: 10, ganho: { diversao: 40, energia: -3 } }] },
  telescopio:  { nome: "Telescópio", w: 1, h: 1, preco: 360, nivel: 9, fora: 1, acoes: [{ id: "estrelas", nome: "Olhar as estrelas", dur: 8, ganho: { diversao: 25 }, junto: 1, juntoSocial: 3 }] },
  dossel:      { nome: "Cama com dossel", w: 3, h: 3, preco: 800, nivel: 10, acoes: DORMIR },
  jacuzzi:     { nome: "Jacuzzi", w: 2, h: 2, preco: 900, nivel: 13, fora: 1, soQuintal: 1, acoes: [{ id: "jacuzzi", nome: "Relaxar na jacuzzi", dur: 12, ganho: { higiene: 40, diversao: 25, energia: 10 }, sobre: 1, junto: 1, juntoSocial: 3 }] },
  namoradeira: { nome: "Namoradeira", w: 2, h: 1, preco: 480, nivel: 16, acoes: [{ id: "namorar", nome: "Namorar no sofazinho", dur: 10, ganho: { social: 20, diversao: 15, energia: 8 }, sobre: 1, junto: 1, juntoSocial: 4 }] },
  fonte:       { nome: "Fonte dos desejos", w: 2, h: 2, preco: 700, nivel: 19, fora: 1, acoes: [{ id: "desejo", nome: "Jogar uma moedinha ($1)", dur: 4, ganho: { diversao: 12 }, junto: 1, antes: () => gastar(1, "a moedinha"), cancel: () => ganhar(1) }] },
  estatua:     { nome: "Estátua do amor", w: 1, h: 1, preco: 1000, nivel: 20, acoes: [{ id: "estatua", nome: "Admirar a estátua", dur: 4, ganho: { diversao: 8, social: 8 }, junto: 1 }] },
  // coleções da loja da semana (loja = tema; só entram no catálogo depois de compradas)
  guardasol:    { nome: "Guarda-sol", w: 1, h: 1, preco: 120, livre: 1, loja: "praia", acoes: [] },
  cadeiraPraia: { nome: "Cadeira de praia", w: 1, h: 1, preco: 140, livre: 1, loja: "praia", acoes: [{ id: "solzinho", nome: "Pegar um solzinho", dur: 8, ganho: { energia: 10, diversao: 12 }, sobre: 1 }] },
  prancha:      { nome: "Prancha de surfe", w: 1, h: 1, preco: 160, livre: 1, loja: "praia", acoes: [] },
  boia:         { nome: "Boia de rosquinha", w: 1, h: 1, preco: 90, livre: 1, loja: "praia", acoes: [{ id: "boia", nome: "Brincar com a boia", dur: 5, ganho: { diversao: 12 } }] },
  andon:        { nome: "Luminária de papel", w: 1, h: 1, preco: 110, loja: "japa", acoes: [] },
  bonsai:       { nome: "Bonsai", w: 1, h: 1, preco: 130, loja: "japa", acoes: [{ id: "podar", nome: "Podar o bonsai", dur: 5, ganho: { diversao: 10 } }] },
  biombo:       { nome: "Biombo de cerejeira", w: 2, h: 1, preco: 220, loja: "japa", acoes: [] },
  chabudai:     { nome: "Mesinha de chá", w: 2, h: 1, preco: 200, loja: "japa", acoes: [{ id: "cha", nome: "Tomar um chá", dur: 6, ganho: { energia: 10, diversao: 8 }, junto: 1, juntoSocial: 3 }] },
  jukebox:      { nome: "Jukebox", w: 1, h: 1, preco: 260, loja: "retro", acoes: [{ id: "dancar", nome: "Dançar na jukebox", dur: 10, ganho: { diversao: 30, energia: -5 }, junto: 1 }] },
  tvTubo:       { nome: "TV de tubo", w: 1, h: 1, preco: 150, loja: "retro", acoes: [{ id: "tv", nome: "Ver desenho antigo", dur: 10, ganho: { diversao: 30 } }] },
  lava:         { nome: "Luminária de lava", w: 1, h: 1, preco: 100, loja: "retro", acoes: [] },
  telefone:     { nome: "Telefone de disco", w: 1, h: 1, preco: 120, loja: "retro", acoes: [{ id: "telefone", nome: "Ligar pra um amigo", dur: 6, ganho: { social: 15 } }] },
  toco:         { nome: "Banquinho de toco", w: 1, h: 1, preco: 70, livre: 1, loja: "floresta", acoes: SENTA6("toco", "Sentar no toco") },
  cogumelo:     { nome: "Luminária cogumelo", w: 1, h: 1, preco: 110, livre: 1, loja: "floresta", acoes: [] },
  samambaia:    { nome: "Samambaia", w: 1, h: 1, preco: 80, livre: 1, loja: "floresta", acoes: [{ id: "regar", nome: "Regar", dur: 3, ganho: { diversao: 5 } }] },
  casinhaPassaro: { nome: "Casinha de passarinho", w: 1, h: 1, preco: 150, livre: 1, loja: "floresta", acoes: [{ id: "passaro", nome: "Ver o passarinho", dur: 5, ganho: { diversao: 12 }, junto: 1 }] },
  macaron:      { nome: "Pufe macaron", w: 1, h: 1, preco: 120, loja: "doce", acoes: SENTA6("pufe", "Sentar no pufe") },
  cupcake:      { nome: "Abajur cupcake", w: 1, h: 1, preco: 110, loja: "doce", acoes: [] },
  pirulito:     { nome: "Pirulito gigante", w: 1, h: 1, preco: 90, livre: 1, loja: "doce", acoes: [] },
  vitrineDoces: { nome: "Vitrine de doces", w: 2, h: 1, preco: 280, loja: "doce", acoes: [{ id: "docinho", nome: "Comer um docinho", dur: 5, ganho: { fome: 15, diversao: 10 }, junto: 1 }] },
  foguete:      { nome: "Foguete de brinquedo", w: 1, h: 1, preco: 160, loja: "espaco", acoes: [{ id: "foguete", nome: "Brincar de astronauta", dur: 6, ganho: { diversao: 18 } }] },
  saturno:      { nome: "Luminária Saturno", w: 1, h: 1, preco: 120, loja: "espaco", acoes: [] },
  astronauta:   { nome: "Astronauta de pelúcia", w: 1, h: 1, preco: 100, loja: "espaco", acoes: [{ id: "urso", nome: "Abraçar o astronauta", dur: 4, ganho: { diversao: 10, social: 6 } }] },
  pufePlaneta:  { nome: "Pufe planeta", w: 1, h: 1, preco: 120, loja: "espaco", acoes: SENTA6("pufe", "Sentar no pufe") }
});
Object.assign(TOP, { aquario: 12, lareira: 18, fliperama: 14, telescopio: 10, dossel: 22, jacuzzi: 4, namoradeira: 10, fonte: 14, estatua: 14,
  guardasol: 16, cadeiraPraia: 6, prancha: 16, boia: 0, andon: 10, bonsai: 6, biombo: 14, chabudai: 4, jukebox: 14, tvTubo: 8, lava: 10, telefone: 6,
  toco: 2, cogumelo: 8, samambaia: 12, casinhaPassaro: 16, macaron: 2, cupcake: 10, pirulito: 16, vitrineDoces: 12, foguete: 16, saturno: 8, astronauta: 8, pufePlaneta: 2 });
Object.assign(SENTAR, {
  namoradeira: { vagas: [{ dx: -7, by: 14 }, { dx: 7, by: 14 }], cima: 11 },
  jacuzzi: { empe: 1, vagas: [{ dx: -7, by: 22 }, { dx: 7, by: 22 }] },
  cadeiraPraia: { vagas: [{ dx: 0, by: 14 }] }, toco: { vagas: [{ dx: 0, by: 14 }] }, macaron: { vagas: [{ dx: 0, by: 15 }] }, pufePlaneta: { vagas: [{ dx: 0, by: 15 }] }
});
// quadro de animação: sempre mexendo (aquário, fogo, fonte...) ou só em uso
const FRAME6 = {
  aquario: (on, tm) => Math.floor(tm / 500) % 4, lareira: (on, tm) => Math.floor(tm / 170) % 3, fliperama: (on, tm) => Math.floor(tm / (on ? 160 : 420)) % 3,
  jacuzzi: (on, tm) => Math.floor(tm / 330) % 3, fonte: (on, tm) => Math.floor(tm / 240) % 3, jukebox: (on, tm) => Math.floor(tm / (on ? 220 : 600)) % 3,
  tvTubo: (on, tm) => on ? 1 + Math.floor(tm / 300) % 2 : 0, lava: (on, tm) => Math.floor(tm / 650) % 4,
  samambaia: (on, tm, ph) => [0, 1, 0, 2][Math.floor((tm + ph * 233) / 700) % 4], casinhaPassaro: (on, tm, ph) => Math.floor((tm + ph * 97) / 900) % 4
};
Object.assign(FURN_EXTRA, {
  aquario(x, y, f){
    rbox(x + 1, y + 5, 30, 11, C.woodD); R(x + 2, y + 6, 28, 1, C.wood); R(x + 15, y + 8, 1, 6, C.woodDD); P(x + 13, y + 10, C.gold); P(x + 18, y + 10, C.gold);
    R(x + 2, y - 10, 28, 15, "#7FC8E8"); R(x + 2, y - 10, 28, 2, "#A9DDF2");
    R(x + 1, y - 12, 30, 2, "#5A546C"); R(x + 1, y - 12, 30, 1, "#8D9BAA"); R(x + 1, y - 10, 1, 15, "#B9E4F4"); R(x + 30, y - 10, 1, 15, "#5FA9CC");
    R(x + 2, y + 2, 28, 3, "#F3DDBE"); P(x + 6, y + 3, "#E8C9A0"); P(x + 21, y + 2, "#FFFFFF"); P(x + 25, y + 3, C.coral);
    R(x + 5, y - 4, 1, 6, C.leaf); R(x + 6, y - 2, 1, 4, C.leafD); R(x + 4, y - 1, 1, 3, C.leafL); R(x + 25, y - 6, 1, 8, C.leafD); R(x + 26, y - 3, 1, 5, C.leaf); rbox(x + 15, y, 5, 3, "#8D9BAA");
    const p1 = [8, 11, 14, 11][f], p2 = [20, 18, 16, 18][f];
    R(x + p1, y - 6, 3, 2, "#F29A4A"); P(x + p1 - 1, y - 7, "#F29A4A"); P(x + p1 - 1, y - 4, "#F29A4A"); P(x + p1 + 2, y - 6, C.ink);
    R(x + p2, y - 2, 3, 2, "#F6C667"); P(x + p2 + 3, y - 3, "#F6C667"); P(x + p2 + 3, y, "#F6C667"); P(x + p2, y - 2, C.ink);
    P(x + 22, y - 4 - f, "#E6F8FD"); P(x + 23, y - 7 - (f % 2), "#E6F8FD"); R(x + 3, y - 8, 1, 4, "#E6F8FD");
  },
  lareira(x, y, f){
    const pe = "#B9ADA8", pD = "#968882", pL = "#D6CCC6";
    R(x + 2, y - 12, 28, 23, pe);
    for (let j = 0; j < 6; j++){ R(x + 2, y - 9 + j * 4, 28, 1, pD); for (let i = (j % 2 ? 6 : 2); i < 30; i += 8){ R(x + i, y - 12 + j * 4, 1, 3, pD); P(x + i + 1, y - 12 + j * 4, pL); } }
    R(x, y - 15, 32, 3, C.woodD); R(x, y - 15, 32, 1, C.wood); R(x + 1, y - 13, 30, 1, C.woodDD);
    R(x + 4, y - 17, 2, 2, C.cream); P(x + 4, y - 18, C.gold); R(x + 22, y - 18, 6, 3, C.gold); R(x + 23, y - 17, 4, 1, "#F9C9D6");
    rbox(x + 8, y - 5, 16, 15, "#2E2638"); R(x + 9, y - 4, 14, 1, "#3E3050");
    R(x + 10, y + 7, 12, 2, C.woodDD); R(x + 11, y + 6, 10, 1, C.woodD);
    R(x + 11, y + 2, 10, 4, "#E8735F"); R(x + 12, y - 1 + (f === 1 ? 1 : 0), 3, 4, "#F29A4A"); R(x + 17, y + (f === 2 ? 1 : -1), 3, 4, "#F29A4A");
    R(x + 13, y + 2, 2, 3, "#F6C667"); R(x + 17, y + 2 + (f === 0 ? 1 : 0), 2, 3, "#F6C667"); P(x + 15, y + (f ? 0 : 1), "#FCE9B8"); P(x + 14 + f, y - 2, "#F6C667");
    R(x + 1, y + 10, 30, 5, pD); R(x + 1, y + 10, 30, 1, pL);
  },
  fliperama(x, y, f){
    const c = "#5246B0", cD = "#3E3075", cL = "#6F5CC0";
    rbox(x + 1, y - 14, 14, 29, c); R(x + 14, y - 12, 1, 26, cD); R(x + 2, y - 11, 1, 24, cL);
    R(x + 2, y - 13, 12, 3, "#E8607A"); R(x + 3, y - 12, 10, 1, "#F9C9D6");
    R(x + 3, y - 9, 10, 8, "#1E2440");
    R(x + 4 + f * 2, y - 3, 3, 1, "#7FD1B2"); P(x + 5 + f * 2, y - 4, "#7FD1B2");
    P(x + 5 + (f * 3) % 7, y - 8 + f, "#F6C667"); P(x + 10 - f, y - 7 + f * 2, "#F0707A"); P(x + 11, y - 8, "#FFFFFF");
    R(x + 1, y, 14, 3, cD); R(x + 1, y, 14, 1, cL); P(x + 4, y - 1, "#E8607A"); P(x + 4, y, "#2E2638"); P(x + 9, y + 1, C.gold); P(x + 11, y + 1, C.mint);
    R(x + 6, y + 6, 4, 3, "#2E2638"); P(x + 7, y + 7, C.gold);
  },
  telescopio(x, y){
    const m = "#5A546C";
    for (let i = 0; i < 9; i++){ P(x + 7 - (i >> 1), y + 6 + i, m); P(x + 8 + (i >> 1), y + 6 + i, m); }
    R(x + 7, y + 4, 2, 11, sh(m, .15)); rbox(x + 6, y + 3, 4, 3, C.gold);
    for (let i = 0; i < 9; i++) R(x + 3 + i, y + 4 - i, 3, 3, i < 2 ? m : i > 6 ? "#5246B0" : "#E8E2F0");
    for (let i = 2; i < 7; i++) P(x + 3 + i, y + 4 - i, "#FFFFFF");
    P(x + 13, y - 4, "#9FD3F2"); R(x + 7, y - 1, 2, 1, C.gold);
  },
  dossel(x, y, f){
    drawFurn("casal", x, y, f);
    for (const px of [x + 1, x + 44]){ R(px, y - 20, 3, 26, C.woodD); R(px, y - 20, 1, 26, C.woodL); }
    R(x, y - 22, 48, 5, "#F5DCE6"); R(x, y - 22, 48, 1, "#FFFFFF"); R(x, y - 18, 48, 1, "#E8BFD0");
    for (let i = 0; i < 48; i += 4){ R(x + i, y - 17, 3, 1, "#E8BFD0"); P(x + i + 1, y - 16, "#E8BFD0"); }
    pixHeart(x + 22, y - 21, "#E8607A");
    for (const [cx0, d] of [[x + 3, 1], [x + 42, -1]]){ R(cx0, y - 16, 3, 17, "#F5DCE6"); R(cx0 + (d > 0 ? 2 : 0), y - 16, 1, 17, "#E8BFD0"); R(cx0 - 1, y - 3, 5, 2, C.gold); R(cx0, y - 1, 3, 6, "#F5DCE6"); }
    for (const px of [x, x + 45]){ R(px, y + 35, 3, 12, C.woodD); R(px, y + 35, 1, 12, C.woodL); rbox(px - 1, y + 32, 5, 4, C.gold); }
  },
  jacuzzi(x, y, f){
    rbox(x, y - 3, 32, 34, "#E8E2F0"); R(x + 1, y - 2, 30, 1, "#FFFFFF"); R(x + 1, y + 29, 30, 1, "#B9B2C8");
    rbox(x + 3, y + 1, 26, 26, "#5FB8DE"); R(x + 4, y + 2, 24, 2, "#8FD6EE"); R(x + 4, y + 24, 24, 2, "#4FA0C8");
    [[8, 8], [20, 10], [12, 18], [23, 21], [7, 22], [16, 12], [24, 15]].forEach(([a, b], i) => { if ((i + f) % 3 === 0) return; R(x + a, y + b, 2, 2, "#E6F8FD"); P(x + a + 1, y + b - 1 - (f + i) % 2, "#FFFFFF"); });
    for (const [a, b] of [[3, 12], [28, 12], [15, 26]]) P(x + a, y + b, "#3F8FB0");
    R(x + 10, y + 28, 12, 3, "#CFC3B4"); R(x + 10, y + 28, 12, 1, "#F4EEE6");
    R(x + 27, y - 2, 4, 3, "#C6D0DA"); P(x + 28, y - 2, "#FFFFFF");
  },
  namoradeira(x, y){
    const r = "#E8607A", rD = "#B8405A", rL = "#F49AAE", cu = "#F9C9D6";
    rbox(x + 1, y - 10, 15, 13, r); rbox(x + 16, y - 10, 15, 13, r);
    for (let j = 0; j < 4; j++) R(x + 4 + j * 2, y + 1 + j, 24 - j * 4, 1, r);
    R(x + 4, y - 9, 6, 1, rL); R(x + 19, y - 9, 6, 1, rL); R(x + 15, y - 9, 2, 3, rD); R(x + 3, y - 7, 1, 4, rL);
    pixHeart(x + 14, y - 5, rL); P(x + 8, y - 4, rD); P(x + 23, y - 4, rD);
    rbox(x + 2, y + 1, 28, 8, cu); R(x + 3, y + 1, 26, 1, "#FFFFFF"); R(x + 16, y + 2, 1, 6, "#E8BFD0");
    R(x + 1, y + 8, 30, 5, r); R(x + 1, y + 12, 30, 1, rD); R(x + 2, y + 9, 28, 1, rL);
    rbox(x, y - 1, 4, 13, rD); rbox(x + 28, y - 1, 4, 13, rD); R(x + 1, y - 1, 2, 1, rL); R(x + 29, y - 1, 2, 1, rL);
    R(x + 2, y + 13, 1, 2, C.woodD); R(x + 29, y + 13, 1, 2, C.woodD); P(x + 2, y + 14, C.gold); P(x + 29, y + 14, C.gold);
  },
  fonte(x, y, f){
    const p = "#D6D0DE", pD = "#A9A2B8", ag = "#7FC8E8", agL = "#C4E8F8";
    rbox(x + 1, y + 10, 30, 21, pD); rbox(x + 1, y + 9, 30, 20, p); R(x + 2, y + 9, 28, 1, "#F1EDF7");
    rbox(x + 4, y + 12, 24, 14, ag); R(x + 5, y + 13, 22, 1, agL); R(x + 9 + f * 3, y + 19, 3, 1, agL); R(x + 19 - f * 2, y + 22, 3, 1, agL); P(x + 7, y + 23, C.gold); P(x + 22, y + 16, C.gold);
    R(x + 14, y - 4, 4, 18, p); R(x + 14, y - 4, 1, 18, "#FFFFFF"); R(x + 17, y - 4, 1, 18, pD);
    rbox(x + 8, y - 7, 16, 4, p); R(x + 9, y - 7, 14, 1, "#FFFFFF"); R(x + 10, y - 6, 12, 1, ag);
    rbox(x + 13, y - 12, 6, 5, p); R(x + 14, y - 12, 4, 1, "#FFFFFF"); P(x + 15, y - 14, agL); P(x + 16, y - 13, agL);
    for (let i = 0; i < 4; i++){ const ph = (f + i) % 3; P(x + 8 - (i >> 1) + ph % 2, y - 3 + i * 3 + ph, agL); P(x + 23 + (i >> 1) - ph % 2, y - 3 + i * 3 + ph, agL); }
  },
  estatua(x, y){
    rbox(x + 3, y + 3, 10, 12, "#E8E2F0"); R(x + 4, y + 4, 8, 1, "#FFFFFF"); R(x + 3, y + 7, 10, 1, "#C6C0D2"); R(x + 2, y + 12, 12, 3, "#C6C0D2"); R(x + 2, y + 12, 12, 1, "#E8E2F0");
    const g = "#F6C667", gD = "#D8963A", gL = "#FCE9B8";
    R(x + 3, y - 12, 4, 1, g); R(x + 9, y - 12, 4, 1, g); R(x + 2, y - 11, 12, 4, g); R(x + 3, y - 7, 10, 2, g); R(x + 4, y - 5, 8, 2, g); R(x + 5, y - 3, 6, 2, g); R(x + 6, y - 1, 4, 2, g); R(x + 7, y + 1, 2, 2, gD);
    R(x + 4, y - 10, 2, 2, gL); P(x + 3, y - 11, gL); R(x + 13, y - 10, 1, 3, gD); R(x + 11, y - 6, 2, 1, gD); R(x + 9, y - 2, 2, 1, gD);
  },
  guardasol(x, y){
    R(x + 7, y - 10, 2, 24, "#F4EEE6"); R(x + 8, y - 10, 1, 24, "#CFC3B4"); rbox(x + 4, y + 12, 8, 3, "#E9D8BE");
    const cs = ["#E8607A", "#FFF4E0"], fx = [[6, 4], [3, 10], [1, 14], [0, 16], [0, 16], [0, 16]];
    fx.forEach(([a, w], j) => { for (let i = a; i < a + w; i++) P(x + i, y - 16 + j, j === 0 ? cs[0] : cs[Math.floor(i / 4) % 2]); });
    for (let i = 0; i < 16; i++) if (i % 4 !== 3) P(x + i, y - 10, cs[Math.floor(i / 4) % 2]);
    R(x + 2, y - 14, 3, 1, "#F49AAE"); R(x, y - 11, 16, 1, "rgba(0,0,0,.08)");
  },
  cadeiraPraia(x, y){
    R(x + 2, y - 6, 1, 18, C.wood); R(x + 13, y - 6, 1, 18, C.wood);
    for (let i = 0; i < 10; i++) R(x + 3 + i, y - 6, 1, 12, i % 4 < 2 ? "#378ADD" : "#FFFFFF");
    R(x + 2, y + 6, 12, 1, C.woodD);
    for (let i = 0; i < 10; i++) R(x + 3 + i, y + 7, 1, 4, i % 4 < 2 ? "#2A6AB0" : "#E6EEF7");
    R(x + 1, y + 11, 14, 1, C.woodD); R(x + 2, y + 12, 1, 3, C.woodD); R(x + 13, y + 12, 1, 3, C.woodD);
  },
  prancha(x, y){
    R(x + 7, y - 16, 3, 1, "#7FD1B2"); rbox(x + 5, y - 15, 7, 29, "#7FD1B2");
    R(x + 8, y - 14, 1, 27, "#F6C667"); R(x + 6, y - 12, 1, 20, "#BFF0DD"); R(x + 11, y - 13, 1, 24, "#4FA88A"); R(x + 6, y - 6, 5, 1, "#E8607A");
    R(x + 3, y + 13, 11, 2, C.woodD); R(x + 3, y + 13, 11, 1, C.wood);
  },
  boia(x, y){
    const r = "#F29AB8", rD = "#D9678C", rL = "#FCD3E0";
    rbox(x + 1, y + 2, 14, 12, r); ctx.clearRect(Math.round((x + 5) * S), Math.round((y + 6) * S), Math.round(6 * S), Math.round(4 * S));
    R(x + 5, y + 5, 6, 1, rD); R(x + 3, y + 2, 9, 1, rL); P(x + 2, y + 4, rL);
    for (const [a, b, c] of [[3, 4, "#FFFFFF"], [10, 3, "#F6C667"], [12, 7, "#7FD1B2"], [6, 11, "#FFFFFF"], [3, 9, "#7FB8E8"], [11, 11, "#F6C667"]]) P(x + a, y + b, c);
    R(x + 2, y + 12, 12, 1, rD);
  },
  andon(x, y){
    R(x + 4, y + 12, 8, 3, C.woodDD); rbox(x + 3, y - 9, 10, 22, C.woodD);
    R(x + 4, y - 8, 8, 20, "#FFF4D6"); R(x + 4, y - 8, 2, 20, "#FFFBEA"); R(x + 4, y - 2, 8, 1, C.woodD); R(x + 4, y + 5, 8, 1, C.woodD); R(x + 8, y - 8, 1, 20, "#E9D8BE");
    rbox(x + 2, y - 10, 12, 2, C.woodDD); P(x + 10, y + 1, "#F49AAE"); P(x + 11, y + 2, "#F49AAE");
  },
  bonsai(x, y){
    rbox(x + 2, y + 8, 12, 6, "#3E5A8C"); R(x + 3, y + 8, 10, 1, "#5A7AB0"); R(x + 3, y + 13, 1, 2, "#2E4470"); R(x + 12, y + 13, 1, 2, "#2E4470");
    R(x + 3, y + 7, 10, 1, "#6B4429");
    R(x + 7, y + 2, 2, 6, C.woodDD); P(x + 6, y + 4, C.woodDD); R(x + 5, y + 2, 2, 1, C.woodDD); P(x + 9, y + 1, C.woodDD); R(x + 10, y, 1, 2, C.woodDD);
    rbox(x + 1, y - 2, 7, 5, C.leafD); rbox(x + 8, y - 6, 7, 5, C.leaf); rbox(x + 4, y - 5, 6, 4, C.leaf);
    R(x + 9, y - 6, 4, 1, C.leafL); R(x + 2, y - 2, 3, 1, C.leaf); P(x + 5, y - 5, C.leafL);
  },
  biombo(x, y){
    for (let i = 0; i < 4; i++){ const px = x + i * 8, s = i % 2; R(px, y - 13, 8, 27, s ? C.woodDD : C.woodD); R(px + 1, y - 12, 6, 23, s ? "#EFE2CC" : "#FFF4E0"); R(px + 1, y - 4, 6, 1, s ? "#D9C9AE" : "#EDE0C8"); }
    for (let i = 0; i < 26; i++){ const xx = 3 + i; if (xx % 8 === 0 || xx % 8 === 7) continue; P(x + xx, y - 8 + Math.round(Math.sin(i / 4) * 2), "#6B4429"); }
    for (const [a, b] of [[5, -10], [11, -7], [18, -9], [22, -6], [27, -9], [14, -5]]){ P(x + a, y + b, "#F49AAE"); P(x + a + 1, y + b, "#F9C9D6"); P(x + a, y + b + 1, "#F9C9D6"); }
    R(x + 1, y + 14, 2, 1, C.woodDD); R(x + 29, y + 14, 2, 1, C.woodDD);
  },
  chabudai(x, y){
    rbox(x + 1, y + 1, 30, 9, C.wood); R(x + 2, y + 1, 28, 1, C.woodL); R(x + 1, y + 9, 30, 2, C.woodD); R(x + 3, y + 11, 2, 3, C.woodDD); R(x + 27, y + 11, 2, 3, C.woodDD);
    rbox(x + 12, y - 3, 7, 5, "#4F7A5A"); R(x + 13, y - 3, 5, 1, "#6F9A7A"); P(x + 15, y - 4, "#4F7A5A"); P(x + 19, y - 2, "#4F7A5A"); P(x + 20, y - 3, "#4F7A5A"); R(x + 11, y - 2, 1, 2, C.woodD);
    rbox(x + 5, y, 4, 3, "#FFF4E0"); R(x + 6, y, 2, 1, "#7FD1B2"); rbox(x + 23, y, 4, 3, "#FFF4E0"); R(x + 24, y, 2, 1, "#7FD1B2");
  },
  jukebox(x, y, f){
    const c = "#C9612F", cL = "#E8894F", cD = "#8C3E1E";
    rbox(x + 1, y - 10, 14, 25, c); R(x + 3, y - 14, 10, 1, c); R(x + 2, y - 13, 12, 3, c); R(x + 4, y - 14, 8, 1, cL);
    R(x + 4, y - 12, 8, 6, "#F6C667"); R(x + 5, y - 11, 6, 4, "#FCE9B8");
    for (let i = 0; i < 3; i++) R(x + 5 + i * 2, y - 5, 1, 7, ["#E8607A", "#7FD1B2", "#7FB8E8"][(i + f) % 3]);
    R(x + 3, y + 3, 10, 3, "#2E2638"); for (let i = 0; i < 4; i++) P(x + 4 + i * 2, y + 4, i === f ? C.gold : C.cream);
    R(x + 4, y + 8, 8, 5, cD); R(x + 5, y + 9, 6, 1, "#5A2E1A"); R(x + 5, y + 11, 6, 1, "#5A2E1A");
    R(x + 2, y - 9, 1, 22, cL); R(x + 14, y - 9, 1, 22, cD);
  },
  tvTubo(x, y, f){
    P(x + 5, y - 8, "#8D9BAA"); P(x + 6, y - 7, "#8D9BAA"); P(x + 11, y - 8, "#8D9BAA"); P(x + 10, y - 7, "#8D9BAA");
    rbox(x + 1, y - 6, 14, 13, C.wood); R(x + 2, y - 5, 12, 1, C.woodL);
    rbox(x + 2, y - 4, 9, 9, "#3A4A48");
    if (!f){ R(x + 3, y - 3, 7, 7, "#4F6866"); P(x + 4, y - 2, "#8FB0AC"); P(x + 5, y - 2, "#8FB0AC"); P(x + 4, y - 1, "#8FB0AC"); }
    else { R(x + 3, y - 3, 7, 7, "#9FD3F2"); R(x + 3, y + 2, 7, 2, "#6DB37A"); rbox(x + 4 + f, y - 1, 3, 3, "#F6C667"); P(x + 5 + f, y, C.ink); P(x + 8, y - 2, "#FFFFFF"); }
    P(x + 12, y - 3, C.gold); P(x + 12, y, C.gold); R(x + 12, y + 2, 2, 1, "#2E2638");
    R(x + 3, y + 7, 1, 7, C.woodDD); R(x + 12, y + 7, 1, 7, C.woodDD); R(x + 3, y + 10, 10, 1, C.woodD);
  },
  lava(x, y, f){
    R(x + 5, y + 8, 6, 5, "#C6D0DA"); R(x + 4, y + 12, 8, 2, "#8D9BAA"); R(x + 5, y + 8, 2, 4, "#EEF3F7");
    R(x + 6, y - 9, 4, 2, "#8D9BAA"); P(x + 6, y - 9, "#C6D0DA");
    rbox(x + 5, y - 7, 6, 15, "#B46FD0"); R(x + 5, y - 6, 1, 13, "#D3A2E6"); R(x + 10, y - 6, 1, 13, "#8E4FB0");
    const b1 = [0, 2, 4, 2][f], b2 = [3, 1, 0, 2][f];
    R(x + 7, y + 3 - b1 * 2, 2, 3, "#F6A04A"); R(x + 6, y - 5 + b2, 3, 2, "#F6A04A"); P(x + 8, y + 6, "#F6A04A"); P(x + 7, y + 3 - b1 * 2, "#FCD3A0");
  },
  telefone(x, y){
    rbox(x + 2, y + 2, 12, 5, C.wood); R(x + 3, y + 2, 10, 1, C.woodL); R(x + 3, y + 7, 2, 8, C.woodD); R(x + 11, y + 7, 2, 8, C.woodD); R(x + 3, y + 11, 10, 1, C.woodD);
    rbox(x + 4, y - 3, 8, 6, "#D9483D"); R(x + 5, y - 3, 6, 1, "#F07A6A");
    rbox(x + 3, y - 6, 10, 3, "#D9483D"); R(x + 4, y - 6, 8, 1, "#F07A6A"); R(x + 3, y - 4, 2, 2, "#A8322B"); R(x + 11, y - 4, 2, 2, "#A8322B");
    R(x + 6, y - 1, 4, 3, "#FFF4E0"); P(x + 7, y, "#2E2638"); P(x + 8, y, "#2E2638");
    P(x + 12, y + 1, "#2E2638"); P(x + 13, y + 2, "#2E2638");
  },
  toco(x, y){
    rbox(x + 2, y + 1, 12, 13, "#8C5E3A"); R(x + 3, y + 5, 1, 8, "#6B4429"); R(x + 7, y + 6, 1, 7, "#6B4429"); R(x + 11, y + 5, 1, 8, "#6B4429");
    rbox(x + 2, y - 1, 12, 7, "#E0B27A"); R(x + 4, y + 1, 8, 3, "#C9935A"); R(x + 6, y + 2, 4, 1, "#E0B27A"); P(x + 7, y + 2, "#B07A44"); R(x + 3, y - 1, 6, 1, "#F0CC98");
    R(x + 1, y + 12, 2, 2, "#6B4429"); R(x + 13, y + 12, 2, 2, "#6B4429"); P(x + 3, y + 9, C.leaf); P(x + 4, y + 10, C.leafL); P(x + 12, y + 8, C.leaf);
  },
  cogumelo(x, y){
    rbox(x + 5, y + 1, 6, 13, "#FFF4E0"); R(x + 9, y + 2, 1, 11, "#E9D8BE"); R(x + 4, y + 12, 8, 2, "#E9D8BE");
    rbox(x + 1, y - 7, 14, 9, "#D9483D"); R(x + 2, y - 7, 12, 1, "#F07A6A"); R(x + 1, y, 14, 2, "#A8322B");
    for (const [a, b] of [[3, -5], [8, -6], [11, -3], [5, -2]]) R(x + a, y + b, 2, 2, "#FFFFFF");
  },
  samambaia(x, y, f){
    const s = f === 1 ? -1 : f === 2 ? 1 : 0;
    rbox(x + 4, y + 7, 8, 7, "#B5651D"); R(x + 5, y + 7, 6, 1, "#D2873D"); R(x + 4, y + 10, 8, 1, "#8C4A14");
    const fr = [[-1, 0], [-2, -1], [-3, -2], [-4, -2], [-5, -3], [-6, -3], [-7, -2]];
    for (const k of [1, -1]) fr.forEach(([dx, dy], i) => { const px = x + 8 + dx * k + (k > 0 ? -1 : 0) + s, py = y + 6 + dy; P(px, py, C.leafD); P(px, py - 1, i % 2 ? C.leaf : C.leafL); });
    for (let i = 0; i < 9; i++){ const px = x + 7 + s + (i > 6 ? s : 0); P(px, y + 5 - i, C.leaf); if (i % 2){ P(px - 1, y + 5 - i, C.leafL); P(px + 1, y + 5 - i, C.leafD); } }
    for (let i = 0; i < 7; i++){ P(x + 9 + s + (i >> 1), y + 5 - i, C.leafD); P(x + 5 + s - (i >> 1), y + 5 - i, C.leaf); if (i % 2){ P(x + 10 + s + (i >> 1), y + 5 - i, C.leaf); P(x + 4 + s - (i >> 1), y + 5 - i, C.leafL); } }
  },
  casinhaPassaro(x, y, f){
    R(x + 7, y - 4, 2, 18, C.woodD); R(x + 7, y - 4, 1, 18, C.wood); R(x + 5, y + 13, 6, 2, C.woodDD);
    rbox(x + 3, y - 11, 10, 9, "#7FB8E8"); R(x + 4, y - 11, 8, 1, "#A9D0F2"); R(x + 12, y - 10, 1, 7, "#5A96C8");
    R(x + 7, y - 16, 2, 1, "#D9483D"); R(x + 5, y - 15, 6, 1, "#D9483D"); R(x + 3, y - 14, 10, 1, "#D9483D"); R(x + 2, y - 13, 12, 2, "#D9483D"); R(x + 2, y - 12, 12, 1, "#A8322B"); P(x + 6, y - 15, "#F07A6A");
    rbox(x + 6, y - 9, 4, 4, "#2E2638"); R(x + 4, y - 3, 8, 1, C.woodD);
    if (f !== 3){ const bx = x + (f === 1 ? 8 : 4), by = y - 6 - (f === 2 ? 1 : 0); R(bx, by + 1, 3, 2, "#F6C667"); P(bx + (f === 1 ? 0 : 2), by, "#F6C667"); P(bx + (f === 1 ? -1 : 3), by, "#EF9F27"); P(bx + (f === 1 ? 2 : 0), by + 2, "#D8963A"); }
  },
  macaron(x, y){
    rbox(x + 1, y + 7, 14, 7, "#E58FB5"); R(x + 2, y + 12, 12, 1, "#C9709A");
    R(x + 1, y + 6, 14, 2, "#FFF4E0"); for (let i = 2; i < 14; i += 3) P(x + i, y + 8, "#FFF4E0");
    rbox(x + 1, y - 1, 14, 8, "#F29AB8"); R(x + 3, y, 10, 1, "#FCD3E0"); R(x + 2, y + 1, 2, 1, "#FCD3E0");
    for (let i = 2; i < 14; i += 2) P(x + i, y + 5, "#E58FB5");
  },
  cupcake(x, y){
    R(x + 4, y + 4, 8, 10, "#7FD1B2"); for (let i = 5; i < 12; i += 2) R(x + i, y + 4, 1, 10, "#5BB896"); R(x + 3, y + 4, 10, 1, "#BFEFDC"); R(x + 5, y + 14, 6, 1, "#5BB896");
    rbox(x + 2, y - 4, 12, 9, "#F9C9D6"); rbox(x + 4, y - 8, 8, 5, "#F9C9D6"); R(x + 5, y - 8, 4, 1, "#FFFFFF"); R(x + 3, y - 3, 3, 1, "#FFFFFF"); R(x + 2, y + 2, 12, 1, "#E8A6BC");
    R(x + 7, y - 10, 2, 2, "#D9483D"); P(x + 7, y - 10, "#F07A6A");
    P(x + 4, y - 1, "#7FB8E8"); P(x + 9, y - 2, "#F6C667"); P(x + 11, y, "#7FD1B2"); P(x + 6, y - 6, "#B49CF4"); P(x + 10, y - 5, "#7FB8E8");
  },
  pirulito(x, y){
    R(x + 7, y - 2, 2, 15, "#FFFFFF"); R(x + 8, y - 2, 1, 15, "#DDD6E8"); rbox(x + 4, y + 12, 8, 3, "#B49CF4"); R(x + 6, y - 2, 4, 1, "#E8607A");
    for (let j = 0; j < 14; j++) for (let i = 0; i < 14; i++){
      const dx = i - 6.5, dy = j - 6.5; if (dx * dx + dy * dy > 46) continue;
      P(x + 1 + i, y - 16 + j, (i + j) % 6 < 2 ? "#FFFFFF" : (i - j + 24) % 6 < 2 ? "#7FD1B2" : "#F29AB8");
    }
    R(x + 4, y - 15, 3, 1, "#FFFFFF");
  },
  vitrineDoces(x, y){
    rbox(x + 1, y + 1, 30, 14, C.cream); R(x + 2, y + 1, 28, 1, "#FFFFFF"); R(x + 1, y + 13, 30, 2, C.creamD); for (let i = 4; i < 29; i += 6) R(x + i, y + 4, 3, 7, "#F9C9D6");
    R(x + 2, y - 11, 28, 12, "#DDF1FC"); R(x + 2, y - 11, 28, 1, "#FFFFFF"); R(x + 2, y - 5, 28, 1, "#B9DCEF"); R(x + 3, y - 10, 1, 9, "#FFFFFF");
    R(x + 5, y - 4, 8, 4, "#F9E3C8"); R(x + 5, y - 4, 8, 1, "#E58FB5"); P(x + 9, y - 5, "#D9483D"); R(x + 5, y - 2, 8, 1, "#E8A6BC");
    R(x + 16, y - 3, 3, 3, "#7FD1B2"); R(x + 16, y - 4, 3, 1, "#F9C9D6"); R(x + 21, y - 3, 3, 3, "#F6C667"); R(x + 21, y - 4, 3, 1, "#B49CF4"); R(x + 26, y - 3, 3, 3, "#7FB8E8"); R(x + 26, y - 4, 3, 1, "#FFFFFF");
    for (const dx of [6, 13]){ R(x + dx, y - 9, 4, 3, "#D9A877"); R(x + dx, y - 9, 4, 1, "#E58FB5"); P(x + dx + 1, y - 8, "#DDF1FC"); P(x + dx + 2, y - 8, "#DDF1FC"); }
    R(x + 20, y - 8, 3, 2, "#B49CF4"); R(x + 24, y - 8, 3, 2, "#7FD1B2"); R(x + 20, y - 7, 3, 1, "#FFF4E0"); R(x + 24, y - 7, 3, 1, "#FFF4E0");
  },
  foguete(x, y){
    const b = "#F1EDF7", bD = "#C6C0D2", r = "#E8607A";
    R(x + 7, y - 16, 2, 1, r); R(x + 6, y - 15, 4, 2, r); R(x + 5, y - 13, 6, 1, r);
    rbox(x + 5, y - 12, 6, 22, b); R(x + 10, y - 11, 1, 20, bD); R(x + 6, y - 11, 1, 18, "#FFFFFF");
    rbox(x + 6, y - 8, 4, 4, "#378ADD"); P(x + 7, y - 7, "#9FD3F2");
    R(x + 2, y + 3, 3, 8, r); R(x + 11, y + 3, 3, 8, r); R(x + 3, y + 1, 2, 2, r); R(x + 11, y + 1, 2, 2, r); R(x + 5, y + 4, 6, 1, r);
    R(x + 6, y + 10, 4, 2, "#5A546C"); R(x + 4, y + 12, 8, 3, "#8D9BAA"); R(x + 4, y + 12, 8, 1, "#C6D0DA");
  },
  saturno(x, y){
    R(x + 7, y + 4, 2, 9, "#5A546C"); rbox(x + 4, y + 12, 8, 3, "#3A3448"); R(x + 5, y + 12, 6, 1, "#5A546C");
    rbox(x + 4, y - 7, 8, 9, "#F29A4A"); R(x + 5, y - 6, 3, 1, "#FCD3A0"); R(x + 5, y - 4, 6, 1, "#E07B2E"); R(x + 5, y, 6, 1, "#E07B2E");
    R(x + 1, y - 3, 14, 2, "#F6C667"); R(x + 1, y - 3, 3, 1, "#FCE9B8"); R(x + 12, y - 2, 3, 1, "#D8963A");
  },
  astronauta(x, y){
    const s = "#F1EDF7", sD = "#C6C0D2";
    rbox(x + 3, y + 9, 4, 5, s); rbox(x + 9, y + 9, 4, 5, s); R(x + 3, y + 12, 4, 2, "#8D9BAA"); R(x + 9, y + 12, 4, 2, "#8D9BAA");
    rbox(x + 3, y + 1, 10, 10, s); R(x + 12, y + 2, 1, 8, sD); R(x + 6, y + 4, 4, 3, "#7FB8E8"); P(x + 7, y + 5, "#E8607A"); P(x + 9, y + 5, "#F6C667");
    rbox(x + 1, y + 3, 3, 6, s); rbox(x + 12, y + 3, 3, 6, s);
    rbox(x + 2, y - 8, 12, 10, s); R(x + 13, y - 7, 1, 8, sD);
    rbox(x + 4, y - 6, 8, 6, "#3E5A8C"); R(x + 5, y - 5, 2, 2, "#9FD3F2"); P(x + 10, y - 2, "#7FB8E8");
  },
  pufePlaneta(x, y){
    rbox(x + 1, y - 1, 14, 15, "#378ADD"); R(x + 3, y - 1, 8, 1, "#7FB8E8"); R(x + 1, y + 11, 14, 2, "#2A6AB0");
    R(x + 3, y + 2, 4, 3, C.leaf); R(x + 4, y + 5, 2, 2, C.leaf); R(x + 9, y + 1, 4, 2, C.leaf); R(x + 10, y + 7, 3, 3, C.leafD); P(x + 11, y + 3, C.leaf); P(x + 3, y + 2, C.leafL);
    R(x + 6, y - 1, 3, 1, "#FFFFFF"); R(x + 7, y + 8, 2, 1, "#FFFFFF");
  }
});

// ---------------- roupas e acessórios de nível ----------------
TRAJES.push({ nome: "Pijama de bichinho", nivel: 6 }, { nome: "Vestido de festa", nivel: 12 }, { nome: "Terno", nivel: 15 }); // 6, 7, 8
ACESS.push({ nome: "Coroa de flores", nivel: 2 }, { nome: "Cachecol", nivel: 8 }, { nome: "Chapéu de festa", nivel: 17 });   // 5, 6, 7
// detalhes do tronco (ty = primeira linha do tronco; by = chão, ou null sentado)
function trajeLeva6(tj, cx, ty, by, dir, k){
  const { cor, corD, corL, skin, top, ela, o, X, side } = k;
  if (tj === 6){ // pijama: barriguinha clara e rabinho
    if (dir === "down"){ R(cx - 1, ty + 2, 2, 2, corL); P(cx - 2, ty + 3, corL); P(cx + 1, ty + 3, sh(cor, .15)); }
    else if (dir === "up"){ if (by != null){ R(cx - 1, ty + 5, 2, 2, corL); P(cx, ty + 5, "#FFFFFF"); } }
    else if (side && by != null) R(X(3, 2), ty + 5, 2, 2, corL);
  } else if (tj === 7){ // vestido de festa: tomara que caia, cinto dourado e saia até o chão
    if (ela) R(cx - 2, ty, 4, 1, skin); else R(cx - 3 - o, ty, 6 + 2 * o, 1, skin);
    R(cx - 3, ty + 3, 6, 1, C.gold);
    if (by != null){
      const h = by - 1 - (ty + 4);
      R(cx - 4, ty + 4, 8, h, cor); R(cx - 5, by - 2, 10, 2, cor); R(cx - 5, by - 1, 10, 1, corD); R(cx + 2, ty + 5, 2, h - 1, corD);
      P(cx - 2, ty + 5, "#FFFFFF"); P(cx + 1, ty + 7, "#FCE9B8"); P(cx - 3, by - 3, "#FFFFFF");
    }
  } else if (tj === 8){ // terno: camisa branca, gravata e lapela
    if (dir === "down"){ R(cx - 1, ty, 2, 1, "#FFFFFF"); R(cx - 1, ty + 1, 2, 2, "#D9483D"); P(cx - 1, ty + 3, "#B8303A"); P(cx - 2, ty, sh(top, .3)); P(cx + 1, ty, sh(top, .3)); P(cx + 1, ty + 3, C.gold); }
    else if (side) P(X(-2, 1), ty, "#FFFFFF");
  }
}
function capuzBichinho(cx, hy, dir, v){
  const c = ROUPAS[v.roupa], cL = sh(c, .28), cD = sh(c, -.24), rosa = "#F9C9D6";
  const side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (q, w) => m > 0 ? cx + q : cx - q - w;
  R(cx - 4, hy - 3, 8, 1, c); R(cx - 5, hy - 2, 10, 2, c); R(cx - 3, hy - 3, 3, 1, cL);
  if (dir === "down"){ R(cx - 6, hy - 1, 2, 8, c); R(cx + 4, hy - 1, 2, 8, c); R(cx + 5, hy, 1, 6, cD); R(cx - 4, hy, 8, 1, cD); }
  else if (dir === "up"){ R(cx - 6, hy - 1, 12, 8, c); R(cx - 5, hy + 7, 10, 1, cD); R(cx + 4, hy, 1, 6, cD); }
  else { R(X(0, 6), hy - 1, 6, 8, c); R(X(1, 4), hy + 7, 4, 1, cD); R(X(-5, 5), hy, 5, 1, cD); }
  const orelha = (ox, inn) => { R(ox, hy - 5, 3, 2, c); P(ox + 1, hy - 6, c); if (inn) P(ox + 1, hy - 4, rosa); };
  if (!side){ orelha(cx - 5, dir === "down"); orelha(cx + 2, dir === "down"); }
  else orelha(X(0, 3), true);
}
function acessLeva6(a, cx, hy, dir, v){
  const st = v.estilo, side = dir === "left" || dir === "right", m = dir === "right" ? -1 : 1, X = (q, w) => m > 0 ? cx + q : cx - q - w;
  const yo = v.traje === 6 ? -1 : st === 8 ? -4 : st === 3 || st === 9 ? -2 : 0;
  if (a === 5){ // coroa de flores
    const y = hy - 2 + yo, folha = "#4FA568", fl = [["#F49AAE", -5, 1], ["#F6C667", -3, 0], ["#B49CF4", -1, 0], ["#F49AAE", 1, 0], ["#FFFFFF", 3, 0], ["#F6C667", 4, 1]];
    if (!side){ R(cx - 5, y + 1, 10, 1, folha); for (const [c, dx, dy] of fl) P(cx + dx, y + dy, c); P(cx - 2, y + 1, "#8AD490"); P(cx + 2, y + 1, "#8AD490"); }
    else { R(X(-4, 9), y + 1, 9, 1, folha); P(X(-3, 1), y, "#F49AAE"); P(X(0, 1), y, "#F6C667"); P(X(3, 1), y, "#B49CF4"); }
  } else if (a === 6){ // cachecol listrado
    const y = hy + 8, c = "#D9483D", s = "#F6C667";
    if (dir === "down"){ R(cx - 4, y, 8, 2, c); P(cx - 2, y, s); P(cx + 1, y + 1, s); R(cx + 1, y + 2, 2, 3, c); P(cx + 1, y + 3, s); P(cx + 1, y + 5, s); P(cx + 2, y + 5, sh(c, -.2)); }
    else if (dir === "up"){ R(cx - 4, y, 8, 2, c); P(cx, y, s); R(cx - 2, y + 2, 2, 3, c); P(cx - 2, y + 3, s); }
    else { R(X(-3, 7), y, 7, 2, c); P(X(0, 1), y, s); R(X(2, 2), y + 2, 2, 3, c); P(X(2, 1), y + 3, s); }
  } else if (a === 7){ // chapéu de festa (cone listrado com pompom)
    const y = st === 8 ? hy - 3 : hy - 2 + yo, c1 = "#7FB8E8", c2 = "#F6C667", px = side ? X(-1, 6) : cx - 3;
    R(px, y, 6, 1, c1); R(px + 1, y - 1, 4, 1, c2); R(px + 1, y - 2, 4, 1, c1); R(px + 2, y - 3, 2, 1, c2); R(px + 2, y - 4, 2, 1, c1); R(px + 2, y - 5, 2, 1, "#FFFFFF");
    P(px + 1, y - 1, "#E8607A"); P(px + 4, y - 2, "#E8607A");
  } else if (a >= 8) acessLeva9(a, cx, hy, dir, v); // leva 9: colar de presente
}

// ---------------- minigames novos: reflexo, desenhar e adivinhar, perguntas sobre o outro ----------------
// Os dois jogam ao mesmo tempo (sem "vez"); quem cair por SAIU_MS perde por W.O. Cada mudança é transação no nó do jogo.
// Tempos sempre do servidor (srvNow): o sinal do reflexo é sorteado e gravado por quem começa a rodada.
