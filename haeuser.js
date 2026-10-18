// Die Abenteuer von Samu (SFG) – Haeuser im Stil ihrer Region, im Anime-Look (Live-Wunsch 16.10.2026). Laedt nach
// objekte.js.
//
// Global gleich fuer jedes Haus (story.typ 'haus'): Grundflaeche b x t, Wandhoehe h, Dach darueber, Tuer vorn (lokal +z)
// – und damit die Grenze (objekte.js: jedes Bauteil in seiner echten Form; man laeuft nicht hinein oder hindurch).
// Je Region nur das AUSSEHEN: HAUS_STILE[stil] = { waende, daecher, holz, bau(g, b, t, h, rnd, S) } – Farben, Dachform
// und Details (Saeulen, Laternen, Fensterlaeden ...). Neuer Stil = ein Eintrag hier, die Etappe setzt nur noch:
//   story.setze('haus', etappe, { x, z, y, dreh, stil, b, t, h, seed, fest: true })
// Stile: 'deutsch' (Etappe 1), 'hafen' (Etappe 4: Backstein-Wohnhaus) und 'halle' (Lagerhalle), 'china' (Etappe 5),
// 'japan' (Etappe 6), 'turm' (Hochhaus, alle Staedte).
//
// Anime-Look: Toon-Shading (MeshToonMaterial mit drei harten Lichtstufen statt weicher Verlaeufe) und ein dunkler
// Umriss (die Rueckseiten einer etwas groesseren Huelle, wie bei Cel-Shading in Anime-Spielen).
// Leistung: die Grenze rechnet der Katalog aus den einzelnen Bauteilen; danach werden sie je Material zu EINEM Mesh
// verschmolzen (plus ein Umriss-Mesh). Die Einzelteile bleiben unsichtbar im Haus – ihre Matrizen tragen die Grenze.
(function(){
'use strict';
const story = window.STORY;

// ---- Toon-Material und Umriss ------------------------------------------------------------------------------------
let stufen = null;
function stufenTex(){
  if(stufen) return stufen;
  // drei Lichtstufen: Schatten, Mitte, Licht (NearestFilter = harte Kanten, wie gezeichnet)
  const d = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 235, 235, 235, 255]);
  stufen = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  stufen.minFilter = stufen.magFilter = THREE.NearestFilter; stufen.generateMipmaps = false; stufen.needsUpdate = true;
  return stufen;
}
const matCache = new Map();
function toon(farbe, doppelt){
  const k = farbe + (doppelt ? 'd' : '');
  if(!matCache.has(k)) matCache.set(k, new THREE.MeshToonMaterial({ color: farbe, gradientMap: stufenTex(), side: doppelt ? THREE.DoubleSide : THREE.FrontSide }));
  return matCache.get(k);
}
story.toon = toon;
const UMRISS = 0.12;                                 // m Strichstaerke
let umrissMat = null;
function umrissMaterial(){
  if(!umrissMat){
    umrissMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { dicke: { value: UMRISS }, farbe: { value: new THREE.Color(0x1d1520) } },
      // "kante": an Positionen gemittelte Normale (umrissNormalen) – mit den Flaechennormalen risse der Umriss an jeder Ecke auf
      vertexShader: 'uniform float dicke; attribute vec3 kante; void main(){ vec3 p = position + normalize(kante) * dicke;' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 farbe; void main(){ gl_FragColor = vec4(farbe, 1.0); }' });
  }
  return umrissMat;
}
story.umrissMaterial = umrissMaterial;
// Teil bauen: Geometrie + Toon-Farbe (opt: rot, deko = sperrt nicht, ohneUmriss, doppelt = beidseitig)
function teil(g, geo, farbe, x, y, z, opt){
  const m = new THREE.Mesh(geo, toon(farbe, opt && opt.doppelt));
  m.position.set(x, y, z);
  if(opt && opt.rot) m.rotation.set(opt.rot[0] || 0, opt.rot[1] || 0, opt.rot[2] || 0);
  if(opt && opt.deko) m.userData.keinKoerper = true;   // flache Details (Fensterrahmen, Laternen) sperren nicht
  if(opt && opt.ohneUmriss) m.userData.ohneUmriss = true;
  g.add(m); return m;
}
story.toonTeil = teil;

// Verschmelzen: alle Bauteile je Material zu einem Mesh, dazu ein Umriss-Mesh. Die Einzelteile werden unsichtbar
// (Grenzen und Matrizen bleiben). Ziel: ziel = Gruppe, in die das Ergebnis kommt (ihre Koordinaten); quellen = Haeuser.
// Eine ganze Stadt auf einmal (stadtBauen): je Material EIN Mesh fuer alle Haeuser einer Welt – vorher 240 Haeuser mit
// je ~7 Meshes = 1800 Zeichenaufrufe, Etappe 6 lief mit 43 statt 60 Bildern pro Sekunde.
const _mi = new THREE.Matrix4();
function verschmelzen(quellen, ziel){
  ziel.updateMatrixWorld(true);
  _mi.copy(ziel.matrixWorld).invert();
  const proMat = new Map(), umriss = [];
  for(const g of quellen){ g.updateMatrixWorld(true); g.traverse(o => {
    if(!o.isMesh || o.userData.verschmolzen) return;
    const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(_mi, o.matrixWorld));
    const nicht = geo.index ? geo.toNonIndexed() : geo; if(nicht !== geo) geo.dispose();
    if(!nicht.attributes.normal) nicht.computeVertexNormals();
    for(const n of Object.keys(nicht.attributes)) if(n !== 'position' && n !== 'normal') nicht.deleteAttribute(n);
    if(!proMat.has(o.material)) proMat.set(o.material, []);
    proMat.get(o.material).push(nicht);
    if(!o.userData.ohneUmriss) umriss.push(nicht);
    o.visible = false;
  }); }
  const zusammen = (geos) => {
    let n = 0; for(const q of geos) n += q.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let off = 0;
    for(const q of geos){ pos.set(q.attributes.position.array, off * 3); nor.set(q.attributes.normal.array, off * 3); off += q.attributes.position.count; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return geo;
  };
  for(const [mat, geos] of proMat){ const m = new THREE.Mesh(zusammen(geos), mat); m.userData.verschmolzen = true; m.userData.deko = true; m.frustumCulled = false; ziel.add(m); }
  if(umriss.length){ const ug = zusammen(umriss); umrissNormalen(ug);
    const u = new THREE.Mesh(ug, umrissMaterial()); u.userData.verschmolzen = true; u.userData.deko = true; u.renderOrder = -1; u.frustumCulled = false; ziel.add(u); }
  for(const geos of proMat.values()) for(const q of geos) q.dispose();
}
story.hausVerschmelzen = verschmelzen;
// Warteliste: gesetzte Haeuser/Zelte je Welt-Gruppe; einmal je Bild werden alle wartenden zusammengefasst
const warten = new Map();                            // Ziel-Gruppe -> [Haeuser]
function vormerken(d){
  const ziel = d.obj.parent; if(!ziel) return;
  if(!warten.has(ziel)) warten.set(ziel, []);
  warten.get(ziel).push(d.obj);
}
function stadtBauen(){
  if(!warten.size) return;
  for(const [ziel, liste] of warten){
    // in Paketen (eine Stadt = ein Paket je Bild): eine sehr grosse Geometrie haette > 65k Punkte – das ist bei
    // nicht indizierter Geometrie egal, aber ein Paket von 60 Haeusern haelt jede einzelne Rechnung klein
    for(let i = 0; i < liste.length; i += 60) verschmelzen(liste.slice(i, i + 60), ziel);
  }
  warten.clear();
}
story.stadtBauen = stadtBauen;
// Je Eckpunkt (gleiche Position, auf 1 mm gerundet) die Normalen aller angrenzenden Flaechen mitteln -> Attribut "kante"
function umrissNormalen(geo){
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, n = pos.length / 3, summe = new Map(), schl = new Array(n);
  for(let i = 0; i < n; i++){
    const k = Math.round(pos[i * 3] * 1000) + ',' + Math.round(pos[i * 3 + 1] * 1000) + ',' + Math.round(pos[i * 3 + 2] * 1000); schl[i] = k;
    const v = summe.get(k) || [0, 0, 0]; v[0] += nor[i * 3]; v[1] += nor[i * 3 + 1]; v[2] += nor[i * 3 + 2]; summe.set(k, v);
  }
  const kante = new Float32Array(n * 3);
  for(let i = 0; i < n; i++){ const v = summe.get(schl[i]), l = Math.hypot(v[0], v[1], v[2]) || 1; kante[i * 3] = v[0] / l; kante[i * 3 + 1] = v[1] / l; kante[i * 3 + 2] = v[2] / l; }
  geo.setAttribute('kante', new THREE.BufferAttribute(kante, 3));
}

// ---- Gemeinsame Bausteine ----------------------------------------------------------------------------------------
const box = (b, h, t) => new THREE.BoxGeometry(b, h, t);
// Geschwungenes Dach (China/Japan): Flaechen, die zur Traufe hin flacher werden, an den Ecken hochgezogen.
// ue = Ueberstand, dh = Dachhoehe, schwung = wie stark die Ecken hochgehen
function schwungDach(b, t, dh, ue, schwung){
  const B = b / 2 + ue, T = t / 2 + ue, N = 10, pos = [], idx = [];
  const first = b >= t ? { lang: B, kurz: T } : { lang: T, kurz: B };
  for(let i = 0; i <= N; i++) for(let j = 0; j <= N; j++){
    const u = i / N * 2 - 1, v = j / N * 2 - 1;
    const x = u * B, z = v * T;
    const qu = b >= t ? Math.abs(v) : Math.abs(u), qe = b >= t ? Math.abs(u) : Math.abs(v);
    const firstNah = Math.max(0, (qe * first.lang - (first.lang - first.kurz)) / first.kurz);   // Walm an den Enden
    const k = Math.max(qu, firstNah);                                                          // 0 First .. 1 Traufe
    const y = dh * (1 - Math.pow(k, 0.7)) + schwung * Math.pow(Math.abs(u * v), 3) * dh;
    pos.push(x, y, z);
  }
  for(let i = 0; i < N; i++) for(let j = 0; j < N; j++){ const a = i * (N + 1) + j, c = a + N + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
// Satteldach (Europa): Prisma laengs der laengeren Seite, mit Ueberstand
function satteldach(b, t, dh, ue){
  const lang = b >= t, L = (lang ? b : t) / 2 + ue, Q = (lang ? t : b) / 2 + ue;
  const s = new THREE.Shape(); s.moveTo(-Q, 0); s.lineTo(Q, 0); s.lineTo(0, dh); s.lineTo(-Q, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: L * 2, bevelEnabled: false });
  geo.translate(0, 0, -L); if(lang) geo.rotateY(Math.PI / 2);
  return geo;
}
// Fensterreihen auf einer Wand: Rahmen (holz) + Glas, je Stockwerk; seite: 'vorn' | 'hinten' | 'links' | 'rechts'
function fenster(g, b, t, h, stock, farbeRahmen, farbeGlas, seite, breite, abst){
  const vorn = seite === 'vorn' || seite === 'hinten', w = vorn ? b : t, sg = seite === 'vorn' || seite === 'rechts' ? 1 : -1;
  const n = Math.max(1, Math.floor((w - 1) / abst));
  for(let s = 0; s < stock; s++){
    const y = 0.3 + h / stock * (s + 0.55);
    for(let i = 0; i < n; i++){
      const q = (i - (n - 1) / 2) * abst;
      if(seite === 'vorn' && s === 0 && Math.abs(q) < 1.2) continue;      // Tuer
      const px = vorn ? q : sg * (b / 2 + 0.04), pz = vorn ? sg * (t / 2 + 0.04) : q;
      const rb = vorn ? [breite + 0.2, 1.3, 0.1] : [0.1, 1.3, breite + 0.2], gb = vorn ? [breite, 1.05, 0.12] : [0.12, 1.05, breite];
      teil(g, box(...rb), farbeRahmen, px, y, pz, { deko: true });
      teil(g, box(...gb), farbeGlas, px * (vorn ? 1 : 1.004), y, pz * (vorn ? 1.004 : 1), { deko: true, ohneUmriss: true });
    }
  }
}

// ---- Stile je Region ---------------------------------------------------------------------------------------------
// bau(g, b, t, h, rnd, S): Dach und Details auf das Grundhaus (Waende stehen schon, Tuer vorn bei +z)
const HAUS_STILE = {
  // Deutsches Wohnhaus (Etappe 1): helle Putzwand, rotes Satteldach mit Ueberstand, Sprossenfenster, Schornstein
  deutsch: {
    waende: [0xf0dfb8, 0xe8c99a, 0xd6e2e8, 0xf2cdb2], daecher: [0xc2412a, 0xa33a26, 0xb5502c], holz: 0x6b4428, sockel: 0x8d8478,
    bau(g, b, t, h, rnd){
      const dh = Math.min(b, t) * 0.45, dach = this.daecher[Math.floor(rnd() * this.daecher.length)];
      teil(g, satteldach(b, t, dh, 0.5), dach, 0, h, 0);
      teil(g, box(0.7, 1.8, 0.7), 0x9a4a3a, b * 0.25, h + dh * 0.6, -t * 0.15);              // Schornstein
      const stock = Math.max(1, Math.round((h - 0.3) / 2.8));
      for(const s of ['vorn', 'hinten', 'links', 'rechts']) fenster(g, b, t, h - 0.3, stock, 0xfaf6ee, 0x3b5670, s, 1.0, 2.4);
    },
  },
  // Hafen-Wohnhaus (Etappe 4): Backstein, Flachdach mit Attika, Fensterbaender
  hafen: {
    waende: [0xb4553a, 0x9a4632, 0xc07a52, 0x8fa9bd, 0xd6bf98], daecher: [0x4f5660], holz: 0x3c3f44, sockel: 0x6e6a64,
    bau(g, b, t, h){
      teil(g, box(b + 0.3, 0.5, t + 0.3), this.daecher[0], 0, h + 0.25, 0);                  // Attika
      const stock = Math.max(1, Math.round((h - 0.3) / 3.2));
      for(const s of ['vorn', 'hinten', 'links', 'rechts']) fenster(g, b, t, h - 0.3, stock, 0xe9e4da, 0x2b3a4a, s, 1.4, 2.6);
    },
  },
  // Lagerhalle (Etappe 4): Wellblech in Signalfarbe, flaches Pultdach, grosses Tor vorn, Oberlichter
  halle: {
    waende: [0x5f86a6, 0xa8583a, 0xd1a23e, 0x6f8a5a, 0x9aa3ad], daecher: [0x4f5660, 0x5c4a3e], holz: 0x2b3a4a, sockel: 0x6e6a64,
    bau(g, b, t, h, rnd){
      teil(g, box(b + 0.8, 0.6, t + 0.8), this.daecher[Math.floor(rnd() * this.daecher.length)], 0, h + 0.3, 0);
      teil(g, box(b * 0.45, h * 0.62, 0.2), this.holz, 0, h * 0.31 + 0.1, t / 2 + 0.12, { deko: true });   // Tor
      for(let i = 0; i < 5; i++) teil(g, box(b * 0.45 - 0.2, 0.08, 0.24), 0x546270, 0, 0.5 + i * h * 0.12, t / 2 + 0.16, { deko: true, ohneUmriss: true });
      for(const sx of [-1, 1]) teil(g, box(0.1, 0.8, t * 0.7), 0xd9e6ee, sx * (b / 2 + 0.05), h - 0.8, 0, { deko: true, ohneUmriss: true });
    },
  },
  // Chinesisches Fischerdorf (Etappe 5, Kueste am Chinesischen Meer): weisse Waende, roter Holzrahmen und rote Saeulen
  // vor der Tuer, geschwungenes graues Ziegeldach mit hochgezogenen Ecken, rote Laternen
  china: {
    waende: [0xf4ead2, 0xeadcc0, 0xf2e6cc], daecher: [0x3e4a56, 0x4e3e36, 0x335066], holz: 0xc2301f, sockel: 0x8d8478,
    bau(g, b, t, h, rnd){
      const dach = this.daecher[Math.floor(rnd() * this.daecher.length)], dh = Math.max(2.2, Math.min(b, t) * 0.38);
      teil(g, box(b + 0.3, 0.35, t + 0.3), this.holz, 0, h + 0.17, 0);                   // Gesims
      teil(g, schwungDach(b, t, dh, 1.4, 0.35), dach, 0, h + 0.35, 0, { doppelt: true });
      const lang = Math.max(b, t) + 1.6, fx = b >= t;
      teil(g, box(fx ? lang - 2.6 : 0.45, 0.4, fx ? 0.45 : lang - 2.6), dach, 0, h + 0.35 + dh - 0.1, 0);  // First
      for(const sx of [-1.2, 1.2]) teil(g, new THREE.CylinderGeometry(0.16, 0.18, h * 0.85, 10), this.holz, sx, h * 0.425, t / 2 + 1.0);
      teil(g, box(3.2, 0.25, 1.6), dach, 0, h * 0.85 + 0.12, t / 2 + 0.75);              // Vordach
      for(const sx of [-0.9, 0.9]){ const l = teil(g, new THREE.SphereGeometry(0.28, 12, 8), 0xe23c2c, sx, h * 0.85 - 0.45, t / 2 + 1.25, { deko: true }); l.scale.y = 1.25; }
      for(const sz of [-1, 1]) for(const q of [-0.25, 0.25]){
        teil(g, box(0.12, 1.1, 1.1), this.holz, sz * (b / 2 + 0.03), h * 0.55, q * t, { deko: true });
        teil(g, box(0.1, 0.8, 0.8), 0x2f2a3a, sz * (b / 2 + 0.05), h * 0.55, q * t, { deko: true, ohneUmriss: true });
      }
    },
  },
  // Japanisches Stadthaus (Etappe 6): helle Wand mit dunklem Holzfachwerk, Shoji-Fenster, dunkles geschwungenes Dach,
  // Noren (Stoffvorhang) ueber der Tuer, bei zwei Stockwerken ein Zwischendach
  japan: {
    waende: [0xf2e4c4, 0xe9d8b4, 0xf4e8cc], daecher: [0x2a323c, 0x3a3434, 0x283850], holz: 0x4a3020, sockel: 0x7d766c,
    bau(g, b, t, h, rnd){
      const dach = this.daecher[Math.floor(rnd() * this.daecher.length)], dh = Math.max(1.8, Math.min(b, t) * 0.3);
      // Fachwerk: Pfosten an den Ecken und in der Mitte, waagerechter Balken
      for(const sx of [-1, 0, 1]) for(const sz of [-1, 1]) teil(g, box(0.25, h, 0.25), this.holz, sx * b / 2, h / 2, sz * t / 2, { deko: true });
      teil(g, box(b + 0.1, 0.22, t + 0.1), this.holz, 0, h * 0.5, 0, { deko: true });
      if(h > 5.5) teil(g, schwungDach(b, t, 0.6, 0.9, 0.15), dach, 0, h * 0.5, 0, { doppelt: true });   // Zwischendach
      teil(g, schwungDach(b, t, dh, 1.1, 0.22), dach, 0, h, 0, { doppelt: true });
      // Shoji: helles Papier mit dunklem Gitter
      for(const s of ['links', 'rechts', 'hinten']) fenster(g, b, t, h, h > 5.5 ? 2 : 1, this.holz, 0xf7f0dc, s, 1.4, 2.6);
      teil(g, box(1.8, 0.7, 0.06), 0x24467a, 0, 2.15, t / 2 + 0.1, { deko: true });       // Noren
    },
  },
  // Suedostasiatisches Shophouse (Etappe 4, Live-Wunsch 18.10.2026: "landestypisch"): Pastellwand, unten die
  // ueberdachte Arkade ("five-foot way") mit Pfeilern, weisses Gesims, flach geschwungenes Ziegeldach in Terrakotta,
  // Fensterlaeden in Gruen
  asien: {
    waende: [0xf3c9a0, 0xa8d8c8, 0xf2e28a, 0xe9a8b8, 0x9cc4e4, 0xf4ece0], daecher: [0xc8562e, 0xb5482a, 0xd06a34], holz: 0x3f7a5a, sockel: 0x8d8478,
    bau(g, b, t, h, rnd){
      const dach = this.daecher[Math.floor(rnd() * this.daecher.length)], dh = Math.max(1.4, Math.min(b, t) * 0.26), ah = Math.min(h * 0.45, 3.4);
      teil(g, box(b + 0.3, 0.3, 2.4), 0xf4f0e6, 0, ah, t / 2 + 1.2);                       // Decke der Arkade (Balkon darueber)
      for(const q of [-0.48, 0, 0.48]) teil(g, new THREE.CylinderGeometry(0.2, 0.22, ah, 10), 0xf4f0e6, q * b, ah / 2, t / 2 + 2.15);
      teil(g, box(b + 0.3, 0.6, 0.12), this.holz, 0, ah + 0.5, t / 2 + 2.4, { deko: true });   // Balkongelaender
      teil(g, box(b + 0.3, 0.4, t + 0.3), 0xffffff, 0, h + 0.2, 0);                        // Gesims
      teil(g, schwungDach(b, t, dh, 0.9, 0.12), dach, 0, h + 0.4, 0, { doppelt: true });
      const stock = Math.max(1, Math.round((h - 0.3) / 3));
      for(const s of ['vorn', 'links', 'rechts', 'hinten']) fenster(g, b, t, h - 0.3, stock, this.holz, 0x2b3a4a, s, 1.0, 2.2);
      if(rnd() < 0.5) teil(g, box(b * 0.6, 0.8, 0.08), [0xd9332a, 0x2a5fb0, 0xe0a020][Math.floor(rnd() * 3)], 0, ah + 1.4, t / 2 + 0.1, { deko: true, ohneUmriss: true });   // Ladenschild
    },
  },
  // Thai-Tempel (Wat, Etappe 4): weisser Sockelbau, drei uebereinander gestaffelte, steile Daecher (rot/gruen) mit stark
  // hochgezogenen Ecken, goldene Spitze; daneben eine goldene Stupa
  tempel: {
    waende: [0xf6f2ea], daecher: [0xd9532a, 0x2f8a4a], holz: 0xc9a227, sockel: 0xe8e2d4, ohneTuer: false,
    bau(g, b, t, h){
      const gold = 0xe6b422;
      for(let i = 0; i < 3; i++){ const s = 1 - i * 0.22;
        teil(g, schwungDach(b * s, t * s, 2.4, 1.3, 0.6), this.daecher[i % 2], 0, h + i * 1.8, 0, { doppelt: true }); }
      teil(g, new THREE.ConeGeometry(0.5, 4.5, 8), gold, 0, h + 3 * 1.8 + 1.6, 0);
      for(const sx of [-1, -0.35, 0.35, 1]) teil(g, new THREE.CylinderGeometry(0.28, 0.3, h, 10), gold, sx * b * 0.45, h / 2, t / 2 + 0.9);
      // Stupa: Sockel, Glocke, Spitze (seitlich neben dem Tempel)
      const sx = b / 2 + 5;
      teil(g, new THREE.CylinderGeometry(2.6, 3.0, 1.6, 16), 0xf2e8d0, sx, 0.8, 0);
      teil(g, new THREE.SphereGeometry(2.2, 16, 10), gold, sx, 3.0, 0);
      teil(g, new THREE.ConeGeometry(0.9, 6, 12), gold, sx, 7.4, 0);
    },
  },
  // Japanische Pagode (Etappe 6, Live-Wunsch 18.10.2026): schmaler Holzturm mit fuenf dunklen, geschwungenen Daechern,
  // nach oben kleiner, rote Balken, Sorin (Bronzespitze mit Ringen) oben
  pagode: {
    waende: [0xf0e6d2], daecher: [0x2a323c], holz: 0xb83a2a, sockel: 0x8d8478, ohneTuer: true, grundH: (h) => h / 5 - 0.6,
    bau(g, b, t, h){
      const stufe = h / 5;
      for(let i = 0; i < 5; i++){ const s = 1 - i * 0.12, y = stufe * (i + 1);
        if(i) teil(g, box(b * s * 0.62, stufe * 0.75, t * s * 0.62), this.waende[0], 0, y - stufe * 0.42, 0);   // Geschoss zwischen den Daechern
        teil(g, box(b * s * 0.84, 0.3, t * s * 0.84), this.holz, 0, y - 0.15, 0, { deko: true });
        teil(g, schwungDach(b * s, t * s, 1.4, 2.6, 0.6), this.daecher[0], 0, y - 0.2, 0, { doppelt: true }); }   // weit ausladend
      teil(g, new THREE.CylinderGeometry(0.18, 0.25, 7, 8), 0x8a6a3a, 0, h + 4.2, 0);
      for(let i = 0; i < 6; i++) teil(g, new THREE.TorusGeometry(0.55 - i * 0.04, 0.1, 6, 12), 0x8a6a3a, 0, h + 2.2 + i * 0.75, 0, { rot: [Math.PI / 2, 0, 0], deko: true });
    },
  },
  // Hochhaus (alle Staedte): Glas-/Betonturm, Fensterbaender je Stockwerk, Dachaufbau
  turm: {
    waende: [0x8fa0b2, 0x6c7e92, 0xb8c6d4, 0x7f9bb8, 0xa6b8c8], daecher: [0x5d6670], holz: 0x3a4a5a, sockel: 0x6e6a64, ohneTuer: true,
    bau(g, b, t, h, rnd){
      const glas = [0x37506b, 0x2f5b75, 0x41627a][Math.floor(rnd() * 3)];
      // je Stockwerk ein Glasband rundum (vorn/hinten so breit wie b, links/rechts so tief wie t), knapp vor der Wand
      for(let y = 3; y < h - 2; y += 3.6){
        for(const sz of [-1, 1]) teil(g, box(b * 0.92, 1.5, 0.1), glas, 0, y, sz * (t / 2 + 0.03), { deko: true, ohneUmriss: true });
        for(const sx of [-1, 1]) teil(g, box(0.1, 1.5, t * 0.92), glas, sx * (b / 2 + 0.03), y, 0, { deko: true, ohneUmriss: true });
      }
      teil(g, box(b * 0.4, 2.2, t * 0.4), this.daecher[0], 0, h + 1.1, 0);                 // Technikaufbau
    },
  },
};
story.hausStile = HAUS_STILE;

// ---- Beduinenzelt (Etappe 2: Wueste, Oase) ---------------------------------------------------------------------
// Breites, flaches Zeltdach aus dunklem Ziegenhaar-Stoff mit hellen Streifen, auf Stangen; Rueck- und Seitenwaende,
// vorn offen (lokal +z) mit einem roten Teppich davor; Abspannseile zu Pfloecken (Deko). Grenze: Dach, Waende, Stangen.
// opt: { b (Breite), t (Tiefe), h (Firsthoehe), seed }
story.typ('zelt', {
  untergrund: 'egal',
  bau(opt){
    let s = ((opt.seed || 1) * 16807) % 2147483647 || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const b = opt.b || 8 + rnd() * 4, t = opt.t || 5 + rnd() * 2, h = opt.h || 3.0 + rnd() * 0.6;
    const stoff = [0x1f1612, 0x2a1d16, 0x231a15][Math.floor(rnd() * 3)], streifen = 0xb89a68, holz = 0x6a4a2e;   // Ziegenhaar: fast schwarz
    const g = new THREE.Group(); g.name = 'zelt';
    // Dach: Stoffbahnen ueber die Mittelstangen gespannt – in der Mitte hoch (First), nach vorn und hinten tief
    // abfallend (typische Silhouette), helle Laengsstreifen. Je Seite eine Bahn vom First bis zur Traufe.
    const fall = h * 0.45, neig = Math.atan2(fall, t / 2), lang = Math.hypot(t / 2, fall) + 0.5;
    for(const sz of [-1, 1]){
      const mz = sz * (t / 4 + 0.15), my = h - fall / 2 - 0.05;
      teil(g, box(b + 0.8, 0.12, lang), stoff, 0, my, mz, { rot: [sz * neig, 0, 0] });
      for(let i = -2; i <= 2; i++) teil(g, box(0.16, 0.14, lang), streifen, i * b / 5, my + 0.01, mz, { rot: [sz * neig, 0, 0], deko: true, ohneUmriss: true });
    }
    // Rueckwand und Seitenwaende (vorn offen)
    const traufe = h - fall;
    teil(g, box(b, traufe, 0.1), stoff, 0, traufe / 2, -t / 2);
    for(const sx of [-1, 1]) teil(g, box(0.1, traufe, t * 0.8), stoff, sx * b / 2, traufe / 2, -t * 0.1);
    // Stangen: vorn an der Traufe, in der Mitte die hohen Firststangen
    for(const sx of [-1, -0.33, 0.33, 1]) teil(g, new THREE.CylinderGeometry(0.06, 0.07, traufe, 6), holz, sx * b / 2 * 0.95, traufe / 2, t / 2 - 0.2);
    for(const sx of [-0.5, 0, 0.5]) teil(g, new THREE.CylinderGeometry(0.07, 0.08, h, 6), holz, sx * b / 2, h / 2, 0);
    // Teppich vor dem Eingang, Kissen (Deko)
    teil(g, box(b * 0.5, 0.05, 2.2), 0xa8322a, 0, 0.1, t / 2 + 1.0, { deko: true, ohneUmriss: true });          // ueber dem Oasengras (0,06)
    teil(g, box(b * 0.5 - 0.4, 0.06, 0.25), 0xe0b04a, 0, 0.12, t / 2 + 2.0, { deko: true, ohneUmriss: true });
    for(const sx of [-1, 1]) teil(g, box(0.9, 0.35, 0.6), [0x3f6aa8, 0xc77a2a][sx > 0 ? 1 : 0], sx * b * 0.15, 0.18, t / 2 - 0.6, { deko: true });
    // Abspannseile zu Pfloecken (duenne Linien, Deko)
    const seil = new THREE.LineBasicMaterial({ color: 0x5a4632 });
    for(const sx of [-1, 1]) for(const sz of [-1, 1]){
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx * (b / 2 + 0.3), traufe, sz * t / 2), new THREE.Vector3(sx * (b / 2 + 1.8), 0, sz * (t / 2 + 1.2))]);
      const l = new THREE.Line(geo, seil); l.userData.deko = true; g.add(l);
    }
    g.userData.masse = { b, t, h };
    return g;
  },
  danach(d){ vormerken(d); },
});

// ---- Der globale Haustyp ------------------------------------------------------------------------------------------
// opt: { stil, b, t, h, seed } – Masse in m; ohne Angabe je nach Stil zufaellig (fester seed = immer gleich)
// jedes Bild (vor dem Zeichnen) die wartenden Haeuser zusammenfassen
(function(){ const vorher = window.STORY_START; window.STORY_START = function(){
  const loopOrig = loop; loop = function(){ stadtBauen(); return loopOrig.apply(this, arguments); };
  if(vorher) return vorher.apply(this, arguments); }; })();
story.typ('haus', {
  untergrund: 'egal',
  bau(opt){
    const S = HAUS_STILE[opt.stil] || HAUS_STILE.deutsch;
    let s = ((opt.seed || 1) * 16807) % 2147483647 || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const b = opt.b || 7 + rnd() * 4, t = opt.t || 6 + rnd() * 3, h = opt.h || 3.2 + rnd() * 1.2;
    const g = new THREE.Group(); g.name = 'haus_' + (opt.stil || 'deutsch');
    // Grundhaus: Sockel + Waende + Tuer (vorn, +z)
    teil(g, box(b + 0.4, 0.3, t + 0.4), S.sockel, 0, 0.15, 0);
    const wh = S.grundH ? S.grundH(h) : h;                                // Pagode: nur das Erdgeschoss als Grundkasten
    teil(g, box(b, wh, t), S.waende[Math.floor(rnd() * S.waende.length)], 0, wh / 2 + 0.3, 0);
    if(!S.ohneTuer) teil(g, box(1.3, 2.2, 0.12), S.holz, 0, 1.4, t / 2 + 0.06, { deko: true });
    S.bau(g, b, t, h + 0.3, rnd, S);
    g.userData.masse = { b, t, h };
    return g;
  },
  danach(d){ vormerken(d); },
});
})();
