// Die Abenteuer von Samu (SFG) – Haeuser im Stil ihrer Region, im Anime-Look (Live-Wunsch 16.10.2026). Laedt nach
// objekte.js.
//
// Global gleich fuer jedes Haus (story.typ 'haus'): Grundflaeche b x t, Wandhoehe h, Dach darueber, Tuer vorn (lokal +z)
// – und damit die Grenze (objekte.js: jedes Bauteil in seiner echten Form; man laeuft nicht hinein oder hindurch).
// Je Region nur das AUSSEHEN: HAUS_STILE[stil] = { waende, daecher, holz, bau(g, m, b, t, h, rnd) } – Farben, Dachform und
// Details (Saeulen, Laternen, Fensterlaeden ...). Neuer Stil = ein Eintrag hier, die Etappe setzt nur noch:
//   story.setze('haus', etappe, { x, z, dreh, stil: 'china', b, t, h, seed })
//
// Anime-Look: Toon-Shading (MeshToonMaterial mit drei harten Lichtstufen statt weicher Verlaeufe) und ein dunkler
// Umriss (die Rueckseiten einer etwas groesseren Huelle, wie bei Cel-Shading in Anime-Spielen). Der Umriss ist Deko
// (userData.deko): er zaehlt nicht zur Grenze.
(function(){
'use strict';
const story = window.STORY;

// ---- Toon-Material und Umriss ------------------------------------------------------------------------------------
let stufen = null;
function stufenTex(){
  if(stufen) return stufen;
  // drei Lichtstufen: Schatten, Mitte, Licht (NearestFilter = harte Kanten, wie gezeichnet)
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  stufen = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  stufen.minFilter = stufen.magFilter = THREE.NearestFilter; stufen.generateMipmaps = false; stufen.needsUpdate = true;
  return stufen;
}
const matCache = new Map();
function toon(farbe){
  if(!matCache.has(farbe)) matCache.set(farbe, new THREE.MeshToonMaterial({ color: farbe, gradientMap: stufenTex() }));
  return matCache.get(farbe);
}
story.toon = toon;
const UMRISS = 0.06;                                 // m Strichstaerke
let umrissMat = null;
// Umriss um ein Bauteil: Kopie der Geometrie, an den Normalen um UMRISS nach aussen geschoben, nur Rueckseiten, dunkel
function umriss(mesh){
  if(!umrissMat){
    umrissMat = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { dicke: { value: UMRISS }, farbe: { value: new THREE.Color(0x1d1520) } },
      vertexShader: 'uniform float dicke; void main(){ vec3 p = position + normalize(normal) * dicke / length(modelMatrix[0].xyz);' +
        ' gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform vec3 farbe; void main(){ gl_FragColor = vec4(farbe, 1.0); }' });
  }
  const u = new THREE.Mesh(mesh.geometry, umrissMat);
  u.userData.deko = true; u.renderOrder = -1; mesh.add(u);
  return u;
}
// Teil bauen: Geometrie + Toon-Farbe + Umriss
function teil(g, geo, farbe, x, y, z, opt){
  const m = new THREE.Mesh(geo, toon(farbe));
  m.position.set(x, y, z);
  if(opt && opt.rot) m.rotation.set(opt.rot[0] || 0, opt.rot[1] || 0, opt.rot[2] || 0);
  if(opt && opt.deko) m.userData.keinKoerper = true;   // flache Details (Fensterrahmen, Laternen) sperren nicht
  if(!(opt && opt.ohneUmriss)) umriss(m);
  g.add(m); return m;
}
story.toonTeil = teil;

// ---- Gemeinsame Bausteine ----------------------------------------------------------------------------------------
const box = (b, h, t) => new THREE.BoxGeometry(b, h, t);
// Geschwungenes Dach (China/Japan): vier Flaechen, die zur Traufe hin flacher werden und an den Ecken hochgezogen
// sind. ue = Ueberstand, dh = Dachhoehe, schwung = wie stark die Ecken hochgehen
function schwungDach(b, t, dh, ue, schwung){
  const B = b / 2 + ue, T = t / 2 + ue, N = 10, pos = [], idx = [];
  // Raster ueber das Rechteck; Hoehe aus dem Abstand zum First (laengs der laengeren Seite), Ecken hochgezogen
  const first = b >= t ? { lang: B, kurz: T } : { lang: T, kurz: B };
  for(let i = 0; i <= N; i++) for(let j = 0; j <= N; j++){
    const u = i / N * 2 - 1, v = j / N * 2 - 1;                // -1..1
    const x = u * B, z = v * T;
    const qu = b >= t ? Math.abs(v) : Math.abs(u), qe = b >= t ? Math.abs(u) : Math.abs(v);
    const firstNah = Math.max(0, (qe * first.lang - (first.lang - first.kurz)) / first.kurz);   // Walm an den Enden
    const k = Math.max(qu, firstNah);                           // 0 First .. 1 Traufe
    const y = dh * (1 - Math.pow(k, 0.7)) + schwung * Math.pow(Math.abs(u * v), 3) * dh;      // konkav + Ecken hoch
    pos.push(x, y, z);
  }
  for(let i = 0; i < N; i++) for(let j = 0; j < N; j++){
    const a = i * (N + 1) + j, c = a + N + 1;
    idx.push(a, a + 1, c, a + 1, c + 1, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
story.schwungDach = schwungDach;

// ---- Stile je Region ---------------------------------------------------------------------------------------------
// bau(g, b, t, h, rnd): Dach und Details auf das Grundhaus (Waende stehen schon, Tuer vorn bei +z)
const HAUS_STILE = {
  // Chinesisches Fischerdorf (Etappe 5, Kueste am Chinesischen Meer): weisse Waende, roter Holzrahmen und rote Saeulen
  // vor der Tuer, geschwungenes graues Ziegeldach mit hochgezogenen Ecken, rote Laternen
  china: {
    waende: [0xf2ece0, 0xe8e0d0, 0xf5efe6], daecher: [0x4b5560, 0x5a4a42, 0x3f5560], holz: 0xb3322a,
    bau(g, b, t, h, rnd){
      const dach = this.daecher[Math.floor(rnd() * this.daecher.length)];
      // umlaufendes rotes Gesims unter dem Dach
      teil(g, box(b + 0.3, 0.35, t + 0.3), this.holz, 0, h + 0.17, 0);
      const d = teil(g, schwungDach(b, t, Math.max(2.2, Math.min(b, t) * 0.38), 1.4, 0.35), dach, 0, h + 0.35, 0);
      d.material = d.material.clone(); d.material.side = THREE.DoubleSide;
      // First mit hochgebogenen Enden
      const lang = Math.max(b, t) + 1.6, fx = b >= t;
      teil(g, box(fx ? lang : 0.45, 0.45, fx ? 0.45 : lang), dach, 0, h + 0.35 + Math.max(2.2, Math.min(b, t) * 0.38), 0);
      // zwei rote Saeulen und ein Vordach vor der Tuer
      for(const sx of [-1.2, 1.2]) teil(g, new THREE.CylinderGeometry(0.16, 0.18, h * 0.85, 10), this.holz, sx, h * 0.425, t / 2 + 1.0);
      teil(g, box(3.2, 0.25, 1.6), dach, 0, h * 0.85 + 0.12, t / 2 + 0.75);
      // rote Laternen am Vordach (Deko, sperren nicht)
      for(const sx of [-0.9, 0.9]){ const l = teil(g, new THREE.SphereGeometry(0.28, 12, 8), 0xe23c2c, sx, h * 0.85 - 0.45, t / 2 + 1.25, { deko: true });
        l.scale.y = 1.25; }
      // Fenster mit rotem Rahmen an den Seiten
      for(const sz of [-1, 1]) for(const q of [-0.25, 0.25]){
        teil(g, box(0.12, 1.1, 1.1), this.holz, sz * (b / 2 + 0.03), h * 0.55, q * t, { deko: true });
        teil(g, box(0.1, 0.8, 0.8), 0x2f2a3a, sz * (b / 2 + 0.05), h * 0.55, q * t, { deko: true, ohneUmriss: true });
      }
    },
  },
};
story.hausStile = HAUS_STILE;

// ---- Der globale Haustyp ------------------------------------------------------------------------------------------
// opt: { stil, b, t, h, seed } – Masse in m; ohne Angabe je nach Stil zufaellig (fester seed = immer gleich)
story.typ('haus', {
  untergrund: 'land',
  bau(opt){
    const S = HAUS_STILE[opt.stil] || HAUS_STILE.china;
    let s = (opt.seed || 1) * 16807 % 2147483647 || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const b = opt.b || 7 + rnd() * 4, t = opt.t || 6 + rnd() * 3, h = opt.h || 3.2 + rnd() * 1.2;
    const g = new THREE.Group(); g.name = 'haus_' + (opt.stil || 'china');
    // Grundhaus: Sockel + Waende + Tuer (vorn, +z)
    teil(g, box(b + 0.4, 0.4, t + 0.4), 0x8d8478, 0, 0.2, 0);
    teil(g, box(b, h, t), S.waende[Math.floor(rnd() * S.waende.length)], 0, h / 2 + 0.2, 0);
    teil(g, box(1.3, 2.2, 0.12), S.holz, 0, 1.3, t / 2 + 0.06, { deko: true });
    S.bau(g, b, t, h + 0.2, rnd);
    g.userData.masse = { b, t, h };
    return g;
  },
});
})();
