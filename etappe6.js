// Trip to Japan – Etappe 6: Japan (Tokio) mit dem Fuji. Am Ende geht es nach Fukuoka (Strand, Ziel), Globus mit 🌊.
// Laedt nach etappe5b.js, vor der Engine. Aktiv erst, wenn story.etappe === 6.
// Welt: die Startinsel der Engine (Zelle 0,0) als Stadt. Auf der einen Seite die Startbahn mit dem Alpha Jet, auf der
// anderen ein Bahnhof mit dem Shinkansen (Einstieg ueber einen Ring; 6a folgt -> vorerst nur ein Hinweis). Kenji schaut
// nach vorne (-z) zum Fuji: 2 km hoch, steht im Meer (Kegel geht direkt ins Wasser ueber). Hinter dem Fuji beginnt das
// Festland: grosser Strand, dahinter eine Wiese mit Flugfeld (C-400 auf dem Vorfeld) und Bahnhof (Ziel von 6c),
// Mini-Godzillas, Samurai und Moewen.
//   6b (Alpha Jet, "1 Tag"): Startsequenz mit Countdown, dann zum Ziel kurz vor dem Fuji. Dort Blende -> Hoehle im Vulkan
//   (etappe6b.js): Autopilot durch die ersten Kurven, Ansage, dann selbst, immer Vollgas durch die kurvige Roehre ->
//   Ausgang ins Licht -> Filmsequenz (Jet senkrecht aus dem Krater, Ausbruch) -> am Strand-Flughafen landen.
//   Geschafft -> 1 Tag, sonst 7 Tage (Live-Wunsch 08.10.2026). Danach geht die Reise weiter (story.js: Etappe 7 folgt).
(function(){
'use strict';
const story = window.STORY;
function e6(){ return story.etappe === 6; }
function hier(){ return e6() && locale === 'earth'; }

// ---- Lage ---------------------------------------------------------------------------------------
// Startinsel (0,0), Radius 260, Startbahn 24 x 260 m laengs z (Engine). Alpha Jet am +z-Ende, Nase nach -z (zum Fuji).
const RW_HALB = 130;
const ALPHA = { x: 0, z: RW_HALB - 20, yaw: 0 };
// Bahnhof am Westufer (x < 0), Gleis laengs z; Kenji zwischen Bahnhof und Bahn, Blick nach -z (zum Fuji).
const BAHNHOF = { x: -120, z: 20, laenge: 110 };       // Bahnsteigmitte, Gleis bei x = BAHNHOF.x - 7
const RING6 = { x: BAHNHOF.x + 12, z: BAHNHOF.z };     // Einstieg Shinkansen: auf der Wiese vor dem Bahnsteig (Bahnsteig bis x + 5)
const START6 = { x: -55, z: 90, yaw: 0.2 };            // Kenji: Bahnhof links, Alpha rechts, Fuji voraus (leicht nach rechts zur Bahnmitte)
// Fuji im Meer, 2 km hoch (Live-Wunsch). Fuss 3,4 km Radius: so liegt der Hang flach genug fuer die Ansicht von der Stadt
// und reicht bis ins Wasser. Kein eigener Fels-Boden: der Kegel steht auf dem Meeresgrund, das Meer laeuft dran.
// Live-Test: bei 7,5 km verschwand er im Nebel (Engine: fog.far 3 km) -> 4,6 km weit, eigenes Material ohne Nebel
// (fog: false), dafuer zum Himmel hin aufgehellt (Dunst), damit er wie ein ferner Berg wirkt.
const FUJI = { x: 0, z: -4600, r: 3400, h: 2000 };
// Ziel des Hinflugs: kurz vor dem Berg (am Fuss), auf Hoehlenhoehe angeflogen -> Blende
// Live-Feedback: die Blende kam schon nach wenigen hundert Metern -> Ziel am Hang, ~2,6 km Flug ab der Bahn
const ZIEL6 = { x: 0, z: FUJI.z + 2200, r: 300 };
// Festland hinter dem Fuji (Live-Wunsch 09.10.2026, vorher eine Engine-Insel mit Ariane). Der Alpha landet nach -z; dabei
// liegt links (-x) der Strand, in der Mitte die Bahn, rechts (+x) der Bahnhof (Ziel des Shinkansen, 6c). Das Land ist ein
// grosser Kreis (R 6 km) oestlich der Kueste (FEST.x laeuft an der Bahn vorbei): die Engine behandelt ihn wie eine Insel
// (Meer verdeckt, Duenung laeuft am Ufer aus), die Kueste biegt in weitem Bogen um den Fuji (sein Fuss reicht ans Land).
const FLUGFELD = { x: 105, z: -11000, laenge: 1000, breite: 30 }; // Landen = Etappe geschafft (Bahn 90..120)
// Live-Wunsch 09.10.2026 (kompakter): Kueste 60 m westlich der Bahn-Vorfeld-Kante, Strand 60 m breit, Vorfeld zwischen
// Strand und Bahn, Bahnhof gleich oestlich der Bahn, Stadt dahinter. Querschnitt (x): Meer < -60 < Strand < 0 < Wiese,
// Vorfeld 15..75, Bahn 90..120, Bahnhof ~145, Stadt 175..460.
const FEST = { x: -60, z: FLUGFELD.z, strand: 60, R: 6000 };
const BAHNHOF2 = { x: FLUGFELD.x + 45, z: FLUGFELD.z, laenge: 110 };   // Bahnsteig oestlich der Bahn, Gleis laengs z
const STRANDPLATZ = { x: FEST.x + 14, z: FLUGFELD.z + 250, yaw: Math.PI / 2 };    // Kenji nach der Etappe, Blick aufs Meer (-x)
// Sehenswuerdigkeiten vor dem Strand (Vorbild Sakurai-Futamigaura, Itoshima): Torii im flachen Wasser vor Kenji, die zwei
// Felsen der Meoto-Iwa weiter draussen, leicht nach rechts versetzt (wie auf dem Foto). Kueste an der Stelle: x ~ FEST.x.
const TORII = { x: FEST.x - 12, z: STRANDPLATZ.z + 4 };       // direkt vor Kenji im flachen Wasser (Live-Wunsch: nicht weit laufen)
const SURF = { x: FEST.x + 6, z: STRANDPLATZ.z - 11 };         // Surfbrett rechts neben dem Torii im Sand (Blick -x: rechts = -z)
const MEOTO = { x: FEST.x - 230, z: STRANDPLATZ.z - 120 };    // rechts dahinter (Blick -x: rechts = -z)
const FEUER = { x: FEST.x + 30, z: STRANDPLATZ.z + 90 };       // Lagerfeuer auf einem freien Strandabschnitt links von Kenji
const SAMURAI_GRUPPE = { x: FEST.x + 28, z: STRANDPLATZ.z - 92 };   // stehende Samurai, freie Flaeche rechts von Kenji
story.e6 = { ALPHA, BAHNHOF, RING6, START6, FUJI, ZIEL6, FEST, FLUGFELD, BAHNHOF2, STRANDPLATZ, FEUER, SAMURAI_GRUPPE, get STADT(){ return STADT; } };

// Fuji-Hoehe an (x, z): Kegel nach dem vereinfachten Modell (fuji_glb.js, Hoehe 1 bei Radius 0, 0 bei Radius 1). Fuer
// Kollision (Berg rammen) und damit die Hoehle (etappe6b.js) weiss, wo der Fels ist.
function fujiY(x, z){
  const d = Math.hypot(x - FUJI.x, z - FUJI.z) / FUJI.r;
  if(d >= 1) return -Infinity;
  return FUJI.h * Math.pow(1 - d, 1.25);              // leicht konkav wie der echte Fuji
}
story.e6fujiY = fujiY;

// ---- Inseln: nur die Startinsel (das Festland haengt in hookE6) ---------------------------------------
function inselnSetzen(){
  _islandInfoCalc = function(cx, cz){
    if(cx === 0 && cz === 0) return { isStart: true, wx: 0, wz: 0, radius: 260 };
    return null;
  };
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear(); _wreckCache.clear();
  refreshIslands();
}

// ---- Welt bauen -------------------------------------------------------------------------------------
const welt = { gebaut: false, zug: null, fuji: null, ring: null, c400: null };
let s0 = 613; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
function baueWelt(){
  if(welt.gebaut) return; welt.gebaut = true;
  const w = story.welt(6);
  s0 = 613;
  baueStadt(w);
  baueBahnhof(w, BAHNHOF, '東京 Tokio', true, 0);
  baueTokioGleis(w);
  baueFuji(w);
  baueFestland(w);
}
// Stadt: Haeuser und ein paar Tuerme rund um die Bahn, frei: Bahn (+-20 m), Bahnhof, Kenjis Weg, Ring, Alpha-Platz
const stadtHaeuser = [];
function baueStadt(w){
  const box = new THREE.BoxGeometry(1, 1, 1), kegel = new THREE.ConeGeometry(0.75, 1, 4);
  const wand = [0xe8ddc8, 0xd8c0a0, 0xcfe0ec, 0xf0d0c0, 0xbfc7cf].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const dach = [0x6a6a72, 0x3d4f66, 0x8a5a3a, 0xb04030].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const turm = [0x9aa7b4, 0x6f7f8f, 0xc9d2da].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const frei = (x, z, r) => {
    if(Math.hypot(x, z) > 235 - r) return false;                        // auf der Insel, nicht am Strand
    if(Math.abs(x) < 24 + r && Math.abs(z) < RW_HALB + 30) return false;          // Startbahn
    if(Math.abs(x - BAHNHOF.x) < 26 + r && Math.abs(z - BAHNHOF.z) < BAHNHOF.laenge / 2 + 20) return false;   // Bahnhof
    if(Math.abs(x - (BAHNHOF.x - 7)) < 8 + r && Math.abs(z) < RING_R) return false;                             // Gleis gerade
    if(Math.abs(Math.hypot(x, z) - RING_R) < 8 + r) return false;                                                // Ringgleis
    if(Math.hypot(x - START6.x, z - START6.z) < 30 + r) return false;            // Kenji
    if(x > BAHNHOF.x && x < 0 && z > START6.z - 140 && z < START6.z + 10 && Math.abs(x - START6.x) < 18 + r) return false; // Blick nach vorn
    return !stadtHaeuser.some(h => Math.hypot(x - h.x, z - h.z) < h.r + r + 4);
  };
  for(let i = 0; i < 260 && stadtHaeuser.length < 70; i++){
    const a = rnd() * Math.PI * 2, rr = 40 + rnd() * 190, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const hoch = rnd() < 0.18, b = hoch ? 14 + rnd() * 8 : 8 + rnd() * 6, t = hoch ? 14 + rnd() * 8 : 8 + rnd() * 6;
    const r = Math.max(b, t) / 2;
    if(!frei(x, z, r)) continue;
    const h = hoch ? 30 + rnd() * 50 : 5 + rnd() * 6;
    const g = new THREE.Group();
    const k = new THREE.Mesh(box, hoch ? turm[Math.floor(rnd() * turm.length)] : wand[Math.floor(rnd() * wand.length)]);
    k.scale.set(b, h, t); k.position.y = h / 2; g.add(k);
    if(!hoch){ const d = new THREE.Mesh(kegel, dach[Math.floor(rnd() * dach.length)]); d.scale.set(Math.max(b, t), 3, Math.max(b, t)); d.rotation.y = Math.PI / 4; d.position.y = h + 1.5; g.add(d); }
    g.position.set(x, ISLAND_Y, z); g.rotation.y = (rnd() - 0.5) * 0.4;
    w.add(g); stadtHaeuser.push({ x, z, r: r + 0.5, h: h + (hoch ? 0 : 3) });
  }
}
// Bahnhof: Bahnsteig, Dach auf Stuetzen, Gleis; der Shinkansen (zug_glb.js: Triebwagen vorn + Mittelwagen + Triebwagen
// hinten, aus dem Original geschnitten) steht am Bahnsteig, Nase nach -z.
// Tokio (Live-Wunsch 09.10.2026: der Damm uebers Wasser sah "komplett bloed" aus): das Gleis laeuft gerade am Bahnhof
// vorbei und biegt an beiden Enden in einem Bogen am Ufer entlang (auf der Wiese, Inselradius 260 m, Sand ab ~235 m).
// Die Boegen laufen weiter um die Insel herum und treffen sich – ein Ring auf der Insel, ohne sichtbares Ende.
const RING_R = 215;
function baueTokioGleis(w){
  const gx = BAHNHOF.x - 7, stahl = new THREE.MeshLambertMaterial({ color: 0x5c6670 }), schotter = new THREE.MeshLambertMaterial({ color: 0x6b6258 });
  // gerades Stueck bei x = gx (Bahnhof im Westen) von z = +halb nach z = -halb, dann ein Kreisbogen (Radius RING_R) ueber
  // Norden, Osten, Sueden zurueck zum Anfang. Winkel a = atan2(z, x): Anfang des Bogens bei a0 = atan2(-halb, gx), Ende
  // bei a1 = atan2(+halb, gx); gx < 0 -> a0 ~ -2,6, a1 ~ +2,6; der Bogen laeuft ueber 0 (Osten), also von a0 aufwaerts bis a1.
  const halb = Math.sqrt(Math.max(0, RING_R * RING_R - gx * gx));
  const a0 = Math.atan2(-halb, gx), a1 = Math.atan2(halb, gx), N = 120, pts = [];
  for(let i = 0; i <= 20; i++) pts.push(new THREE.Vector3(gx, 0, halb - 2 * halb * i / 20));
  for(let i = 1; i < N; i++){ const a = a0 + (a1 - a0) * i / N; pts.push(new THREE.Vector3(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R)); }  const kurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const L = kurve.getLength(), seg = Math.ceil(L / 4);
  // Schotterbett + zwei Schienen als flache Baender entlang der Kurve
  const band = (breite, hoehe, mat, versatz) => {
    const pos = [], idx = [];
    for(let i = 0; i <= seg; i++){
      const t = i / seg, p = kurve.getPointAt(t % 1), tg = kurve.getTangentAt(t % 1), nx = -tg.z, nz = tg.x, nl = Math.hypot(nx, nz) || 1;
      for(const s of [-1, 1]){ const q = versatz + s * breite / 2; pos.push(p.x + nx / nl * q, ISLAND_Y + hoehe, p.z + nz / nl * q); }
      if(i < seg) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide; w.add(m);
  };
  band(5, 0.3, schotter, 0);
  band(0.16, 0.42, stahl, -0.72); band(0.16, 0.42, stahl, 0.72);
  story.e6tokioGleis = kurve;
}
// Fukuoka-Beach: das Gleis folgt der Kueste (Live-Wunsch: lief gerade uebers Meer). Bogen um die Festland-Mitte mit dem
// Radius, den das Gleis am Bahnhof hat; je 7 km in beide Richtungen (Nebel 3 km). Schotter + zwei Schienen als Baender.
function baueKuestenGleis(g){
  const gxB = BAHNHOF2.x - 7, rG = Math.hypot(gxB - FEST_MX, BAHNHOF2.z - FEST_MZ), aB = Math.atan2(BAHNHOF2.z - FEST_MZ, gxB - FEST_MX);
  const da = 7000 / rG, N = 700;
  const stahl = new THREE.MeshLambertMaterial({ color: 0x5c6670 }), schotter = new THREE.MeshLambertMaterial({ color: 0x6b6258 });
  const band = (breite, hoehe, mat, versatz) => {
    const pos = [], idx = [];
    for(let i = 0; i <= N; i++){
      const a = aB - da + 2 * da * i / N, r1 = rG + versatz - breite / 2, r2 = rG + versatz + breite / 2;
      pos.push(FEST_MX + Math.cos(a) * r1, ISLAND_Y + hoehe, FEST_MZ + Math.sin(a) * r1, FEST_MX + Math.cos(a) * r2, ISLAND_Y + hoehe, FEST_MZ + Math.sin(a) * r2);
      if(i < N) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide; m.frustumCulled = false; g.add(m);
  };
  band(5, 0.3, schotter, 0); band(0.16, 0.42, stahl, -0.72); band(0.16, 0.42, stahl, 0.72);
}
function baueBahnhof(w, B, name, mitZug, gleis){
  const gx = B.x - 7;
  const beton = new THREE.MeshLambertMaterial({ color: 0x8c8a85 }), stahl = new THREE.MeshLambertMaterial({ color: 0x5c6670 });
  const steig = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, B.laenge), beton); steig.position.set(B.x, ISLAND_Y + 0.55, B.z); w.add(steig);
  // Live-Wunsch: das Gleis geht in beide Richtungen bis in den Nebel (3 km) – hier je 4 km. Ueber Wasser liegt es auf einem
  // Damm, der bis unter die Wasserlinie reicht (Tokio: der Bahnhof steht auf einer Insel).
  if(gleis > 0){                                      // Fukuoka-Beach: gerade (Festland), Tokio: eigener Ring (baueTokioGleis)
  const schotter = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, gleis), new THREE.MeshLambertMaterial({ color: 0x6b6258 })); schotter.position.set(gx, ISLAND_Y + 0.15, B.z); w.add(schotter);
  for(const sgn of [-1, 1]){ const sch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, gleis), stahl); sch.position.set(gx + sgn * 0.72, ISLAND_Y + 0.4, B.z); w.add(sch); }
  }
  // Dach: weiss, auf Stuetzen
  const dachM = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const dach = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, B.laenge * 0.8), dachM); dach.position.set(B.x - 2, ISLAND_Y + 7, B.z); w.add(dach);
  for(let z = -B.laenge * 0.35; z <= B.laenge * 0.35; z += 14){ const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), stahl); st.position.set(B.x + 3, ISLAND_Y + 4, B.z + z); w.add(st); }
  // Schild
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const cx = cv.getContext('2d');
  cx.fillStyle = '#123a6a'; cx.fillRect(0, 0, 512, 128); cx.fillStyle = '#fff'; cx.font = 'bold 60px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText(name, 256, 66);
  const schild = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  schild.position.set(B.x + 5.3, ISLAND_Y + 5, B.z); schild.rotation.y = Math.PI / 2; w.add(schild);
  if(mitZug) ladeZug(w, gx);
}
// Zug: Modelleinheiten (nach der fbx-Matrix x0,01): Laenge laengs +x, Nase bei +x; Wagenteilung 8,9; Kastenmitten
// Triebwagen 129,68, Mittelwagen 120,79 (C:\tmp\sfg\e6\zug.html). Echter N700: 25 m je Wagen -> Faktor 25 / 8,9.
const ZUG_K = 25 / 8.9;
function ladeZug(w, gx){
  if(!window.ZUG_END_GLB || !THREE.GLTFLoader) return;
  const lade = (d, f) => { const b = atob(d.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); new THREE.GLTFLoader().parse(u.buffer, '', g => f(g.scene), e => console.warn('Zug-GLB', e)); };
  lade(window.ZUG_END_GLB, (end) => lade(window.ZUG_MITTE_GLB, (mit) => {
    if(!e6()) return;
    const TEIL = 8.9, M_END = 129.68, M_MITTE = 120.79;
    const zug = new THREE.Group(), innen = new THREE.Group();
    const hinten = new THREE.Group(); hinten.add(end.clone(true)); hinten.rotation.y = Math.PI; hinten.position.set((M_MITTE - TEIL) + M_END, 0, 0);
    innen.add(end, mit, hinten);
    innen.position.x = -M_MITTE;                                        // Mittelwagen auf den Ursprung
    zug.add(innen);
    zug.scale.setScalar(ZUG_K);
    zug.rotation.y = Math.PI / 2;                                       // +x (Nase) -> -z (zum Fuji)
    zug.position.set(gx, ISLAND_Y + 0.55 + 0.25 * ZUG_K, BAHNHOF.z);   // Unterkante (-0,25) auf die Schienen
    w.add(zug); welt.zug = zug;
  }));
}
story.e6zugVorlage = () => welt.zug;                 // etappe6c.js: Kopie fuer die Fahrt
// Fuji: dasselbe vereinfachte Modell wie die Inselberge (tiere.js, FUJI_DATEN), hier gross ins Meer gestellt. Der Fuss
// liegt unter dem Meer (bis -60 m), damit kein Spalt am Wasser bleibt.
function baueFuji(w){
  if(!window.FUJI_DATEN) return;
  const d = window.FUJI_DATEN, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
  const col = new Float32Array(d.col.length), wald = [0.16, 0.3, 0.12], dunst = [0.53, 0.72, 0.91], DUNST = 0.18;
  for(let i = 0; i < d.col.length; i += 3){ const yy = d.pos[i + 1], f = Math.max(0, Math.min(1, (0.4 - yy) / 0.4)) * 0.55;
    for(let k = 0; k < 3; k++){ const c = Math.pow(d.col[i + k], 2.2) * (1 - f) + wald[k] * f; col[i + k] = c * (1 - DUNST) + dunst[k] * DUNST; } }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(d.idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }));
  m.scale.set(FUJI.r, FUJI.h + 60, FUJI.r); m.position.set(FUJI.x, -60, FUJI.z); m.frustumCulled = false;
  w.add(m); welt.fuji = m; story.e6fujiMesh = m;
}

// ---- Festland: Strand, Wiese, Flugfeld, Bahnhof -------------------------------------------------------------
const FEST_MX = FEST.x + FEST.R, FEST_MZ = FEST.z;      // Mitte des grossen Kreises (Land = innen)
function festland(x, z){ return Math.hypot(x - FEST_MX, z - FEST_MZ) < FEST.R + 20; }   // bis zum Ende des Sands (Ring bis R + 20)
function aufWiese(x, z){ return Math.hypot(x - FEST_MX, z - FEST_MZ) < FEST.R - FEST.strand; }
function aufBahn(x, z){ return Math.abs(x - FLUGFELD.x) <= FLUGFELD.breite / 2 && Math.abs(z - FLUGFELD.z) <= FLUGFELD.laenge / 2; }
const VORFELD = { x: FLUGFELD.x - 60, z: STRANDPLATZ.z - 20, b: 60, l: 80 };   // zwischen Strand und Bahn, auf Hoehe von Kenjis Platz
const STADT = { x0: BAHNHOF2.x + 30, x1: BAHNHOF2.x + 320, z0: FLUGFELD.z - 450, z1: FLUGFELD.z + 450 };   // hinter dem Bahnhof
STADT.riese = STADT.x0 + (STADT.x1 - STADT.x0) * 0.35;      // Laufschneise des Riesen-Godzillas (frei von Haeusern)
// Tiere (tiere.js) kommen in die Gruppe g; frei = Wiese, nicht auf Bahn, Vorfeld, Bahnhof
// Land fuer die Tiere: Wiese und Sand (10 m Abstand zum Wasser), nicht am Torii und nicht im Surf-Ring
story.e6festland = { g: null, frei: (x, z) => Math.hypot(x - FEST_MX, z - FEST_MZ) < FEST.R - 10
  && Math.hypot(x - SURF.x, z - SURF.z) > 9 && Math.hypot(x - TORII.x, z - TORII.z) > 9
  && !(Math.abs(x - FLUGFELD.x) < 30 && Math.abs(z - FLUGFELD.z) < FLUGFELD.laenge / 2 + 20)
  && !(Math.abs(x - VORFELD.x) < VORFELD.b / 2 + 6 && Math.abs(z - VORFELD.z) < VORFELD.l / 2 + 6)
  && !(Math.abs(x - BAHNHOF2.x) < 22 && Math.abs(z - BAHNHOF2.z) < 820)
  && Math.abs(Math.hypot(x - FEST_MX, z - FEST_MZ) - Math.hypot(BAHNHOF2.x - 7 - FEST_MX, BAHNHOF2.z - FEST_MZ)) > 6 };
function baueFestland(w){
  // Strand (Ring) und Wiese (Scheibe) mit den Engine-Materialien (Gras-Kachel in Metern wie auf den Inseln) -> fremd.
  // Der Sand reicht 20 m ueber die Kueste ins Wasser (wie der Sandrand der Inseln), dort laeuft die Duenung flach aus.
  const sand = new THREE.Mesh(new THREE.RingGeometry(FEST.R - FEST.strand - 5, FEST.R + 20, 256, 1), sandMat);
  sand.rotation.x = -Math.PI / 2; sand.position.set(FEST_MX, ISLAND_Y - 0.05, FEST_MZ);
  sand.userData.fremd = true; w.add(sand);
  const wg = new THREE.CircleGeometry(FEST.R - FEST.strand, 256), uv = wg.attributes.uv, p = wg.attributes.position;
  for(let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + FEST_MX) / GRASS_TILE_M, (p.getY(i) - FEST_MZ) / GRASS_TILE_M);
  const wiese = new THREE.Mesh(wg, grassMat);
  wiese.rotation.x = -Math.PI / 2; wiese.position.set(FEST_MX, ISLAND_Y, FEST_MZ);
  wiese.userData.fremd = true; w.add(wiese);
  // Flugfeld: Bahn mit Mittelstrichen und Schwellen, Vorfeld
  const g = new THREE.Group(); w.add(g);
  const rwM = new THREE.MeshLambertMaterial({ color: 0x888888 }), lnM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const F = FLUGFELD, flach = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.rotation.x = -Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
  flach(new THREE.PlaneGeometry(F.breite, F.laenge), rwM, F.x, ISLAND_Y + 0.02, F.z);
  flach(new THREE.PlaneGeometry(VORFELD.b, VORFELD.l), rwM, VORFELD.x, ISLAND_Y + 0.02, VORFELD.z);
  const rollweg = (FLUGFELD.x - F.breite / 2) - (VORFELD.x + VORFELD.b / 2);
  flach(new THREE.PlaneGeometry(rollweg + 2, 18), rwM, VORFELD.x + VORFELD.b / 2 + rollweg / 2, ISLAND_Y + 0.02, VORFELD.z);
  const strich = new THREE.PlaneGeometry(1.2, 10);
  for(let z = -F.laenge / 2 + 30; z <= F.laenge / 2 - 30; z += 25) flach(strich, lnM, F.x, ISLAND_Y + 0.04, F.z + z);
  for(const e of [-1, 1]) for(let k = -5; k <= 5; k++) if(k) flach(strich, lnM, F.x + k * 2.4, ISLAND_Y + 0.04, F.z + e * (F.laenge / 2 - 8));
  // Bahnhof fuer den Shinkansen (6c), Gleis 1,6 km laengs z
  baueBahnhof(g, BAHNHOF2, 'Fukuoka-Beach', false, 0);
  baueKuestenGleis(g);
  baueTorii(g); baueMeotoIwa(g); ladeSurfbrett(g);
  baueStadt2(g); baueStrandPalmen(g); ladeFeuer(g);
  // Gruppe fuer die Tiere (tiere.js), Ursprung = Bahnmitte (die Tiere rechnen lokal dazu)
  const tg = new THREE.Group(); tg.position.set(F.x, 0, F.z); w.add(tg);
  story.e6festland.g = tg;
}
// Ryobu-Torii (weiss): zwei Saeulen, oben der runde Kasagi (an den Enden etwas ueberstehend), darunter der gerade Nuki,
// jede Saeule mit einem kleinen Stuetzgestell (zwei kurze Pfosten + Querriegel) davor und dahinter. Steht im Wasser
// (Fuesse unter der Wasserlinie), ~10 m hoch, quer zur Blickrichtung (Saeulen entlang z).
function baueTorii(g){
  const weiss = new THREE.MeshLambertMaterial({ color: 0xf4f4f0 }), T = new THREE.Group();
  const SA = 4.2, H = 12, R = 0.52;                   // halber Saeulenabstand, Hoehe, Saeulenradius
  const saeule = new THREE.CylinderGeometry(R, R * 1.08, H + 2, 16);
  for(const sz of [-1, 1]){
    const s1 = new THREE.Mesh(saeule, weiss); s1.position.set(0, H / 2 - 1, sz * SA); T.add(s1);
    // Stuetzgestell: zwei kurze Pfosten vor und hinter der Saeule, mit Querriegeln (Ryobu)
    for(const sx of [-1, 1]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 4.6, 10), weiss); p.position.set(sx * 1.5, 1.3, sz * SA); T.add(p); }
    for(const y of [1.2, 2.9]){ const q = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.32, 0.32), weiss); q.position.set(0, y, sz * SA); T.add(q); }
  }
  const kasagi = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, SA * 2 + 3.4, 18), weiss);
  kasagi.rotation.x = Math.PI / 2; kasagi.position.set(0, H - 0.6, 0); T.add(kasagi);
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, SA * 2 + 1.2), weiss); nuki.position.set(0, H - 2.7, 0); T.add(nuki);
  T.position.set(TORII.x, -0.6, TORII.z);             // Fuesse im Wasser
  g.add(T);
}
// Meoto-Iwa: zwei zerklueftete Felsen (gestreckte Ikosaeder, Grau-Braun), der linke etwas niedriger, dazwischen das
// Shimenawa (dickes Strohseil, leicht durchhaengend) mit weissen Papierstreifen (Shide).
function baueMeotoIwa(g){
  const fels = [0x5e5650, 0x6e655c, 0x4f4842].map(c => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  let sd = 77; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const brocken = (r, d) => { const geo = new THREE.IcosahedronGeometry(r, d), p = geo.attributes.position, m = new Map();
    for(let i = 0; i < p.count; i++){ const k = p.getX(i).toFixed(2) + p.getY(i).toFixed(2) + p.getZ(i).toFixed(2); if(!m.has(k)) m.set(k, 0.8 + rnd() * 0.4); const f = m.get(k); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f); }
    geo.computeVertexNormals(); return geo; };
  const M = new THREE.Group();
  // [Versatz quer, Hoehe, Breite]: links kleiner (Frau), rechts groesser (Mann), wie auf dem Foto
  const steine = [[-22, 16, 13], [20, 22, 16]], spitzen = [];   // links (naeher am Torii) kleiner, rechts groesser
  steine.forEach(([dz, h, b], i) => {
    const f = new THREE.Mesh(brocken(1, 1), fels[i]); f.scale.set(b * 0.8, h, b); f.position.set(0, h * 0.35 - 2, dz); f.rotation.y = rnd() * 3; M.add(f);
    const fuss = new THREE.Mesh(brocken(1, 0), fels[2]); fuss.scale.set(b * 1.3, 2.5, b * 1.5); fuss.position.set(0, -1, dz); M.add(fuss);   // flacher Sockel im Wasser
    spitzen.push(new THREE.Vector3(0, h * 0.35 - 2 + h * 0.62, dz));
  });
  // Shimenawa: Bogen zwischen den Felsen (etwas unter den Spitzen), Strohfarbe
  const a = spitzen[0].clone().add(new THREE.Vector3(0, -1.2, 4)), b = spitzen[1].clone().add(new THREE.Vector3(0, -2.5, -4));
  const mitte = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -2.2, 0));
  const kurve = new THREE.QuadraticBezierCurve3(a, mitte, b);
  M.add(new THREE.Mesh(new THREE.TubeGeometry(kurve, 24, 0.32, 8, false), new THREE.MeshLambertMaterial({ color: 0xd9c38a })));
  // Shide: weisse Papierstreifen am Seil
  const shideM = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), shideG = new THREE.PlaneGeometry(0.35, 1.3);
  for(let i = 1; i < 6; i++){ const p = kurve.getPoint(i / 6), sh = new THREE.Mesh(shideG, shideM); sh.position.copy(p).add(new THREE.Vector3(0, -0.75, 0)); sh.rotation.y = Math.PI / 2; M.add(sh); }
  M.position.set(MEOTO.x, 0, MEOTO.z);
  g.add(M);
}
// Surfbrett steckt schraeg im Sand (Nase nach oben, leicht zum Meer geneigt), drumherum der Einstiegsring, darueber der
// gelbe Pfeil mit Schild "Surfen" (story.baueMarke). Surfen folgt -> im Ring nur ein Hinweis.
const surf = { obj: null, ring: null, marke: null };
function ladeSurfbrett(g){
  if(!window.SURF_GLB || !THREE.GLTFLoader) return;
  const b = atob(window.SURF_GLB.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (gl) => {
    if(!e6()) return;
    const h = new THREE.Group(), m = gl.scene; h.add(m);
    m.rotation.x = -Math.PI / 2 + 0.2;                // Nase (+Z) nach oben, leicht nach hinten gelehnt
    h.position.set(SURF.x, ISLAND_Y - 0.25, SURF.z);   // ~25 cm im Sand
    h.rotation.y = -Math.PI / 2;                       // Deck (Muster) zum Land, also zum Spieler, der vom Strand kommt
    h.scale.setScalar(1.5);                            // als Wahrzeichen am Strand sonst kaum zu sehen
    g.add(h); surf.obj = h;
  }, (e) => console.warn('Surfbrett-GLB', e));
}
function surfNah(){ return !!(surf.ring && surf.ring.drin()); }
// Stadt hinter dem Bahnhof (Fukuoka): Haeuser mit Dach, dazwischen Hochhaeuser, Strassenraster frei, zum Bahnhof hin
// niedriger. Kollision ueber stadtHaeuser (dieselbe Liste wie die Stadt in Tokio, hitsBuilding).
function baueStadt2(g){
  const box = new THREE.BoxGeometry(1, 1, 1), kegel = new THREE.ConeGeometry(0.75, 1, 4);
  const wand = [0xece2cf, 0xd9c6a8, 0xd4e2ec, 0xf2d6c6, 0xc4cbd2].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const dach = [0x5f6068, 0x3d4f66, 0x8a5a3a, 0xa83c2e].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const turm = [0x9aa7b4, 0x6f7f8f, 0xc9d2da, 0x8fa3b8].map(c => new THREE.MeshLambertMaterial({ color: c }));
  let sd = 4242; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const RASTER = 34;                                                  // Block 34 m, Strassen dazwischen frei
  for(let x = STADT.x0; x < STADT.x1; x += RASTER) for(let z = STADT.z0; z < STADT.z1; z += RASTER){
    if(rnd() < 0.12) continue;                                         // ein paar Luecken (Plaetze)
    if(Math.abs(x + RASTER / 2 - STADT.riese) < 28) continue;          // Schneise fuer den Riesen-Godzilla
    { const rG = Math.hypot(BAHNHOF2.x - 7 - FEST_MX, BAHNHOF2.z - FEST_MZ), rH = Math.hypot(x + RASTER / 2 - FEST_MX, z + RASTER / 2 - FEST_MZ);
      if(Math.abs(rH - rG) < 30) continue; }                           // nicht auf dem Kuestengleis
    const tief = (x - STADT.x0) / (STADT.x1 - STADT.x0);               // 0 am Bahnhof .. 1 hinten
    const hoch = rnd() < 0.08 + tief * 0.35;
    const b = hoch ? 14 + rnd() * 8 : 9 + rnd() * 7, t = hoch ? 14 + rnd() * 8 : 9 + rnd() * 7;
    const h = hoch ? 30 + rnd() * (40 + tief * 50) : 5 + rnd() * 7;
    const cx = x + RASTER / 2 + (rnd() - 0.5) * 4, cz = z + RASTER / 2 + (rnd() - 0.5) * 4;
    const k = new THREE.Mesh(box, hoch ? turm[Math.floor(rnd() * turm.length)] : wand[Math.floor(rnd() * wand.length)]);
    k.scale.set(b, h, t); k.position.set(cx, ISLAND_Y + h / 2, cz); g.add(k);
    if(!hoch){ const d = new THREE.Mesh(kegel, dach[Math.floor(rnd() * dach.length)]); d.scale.set(Math.max(b, t), 3, Math.max(b, t)); d.rotation.y = Math.PI / 4; d.position.set(cx, ISLAND_Y + h + 1.5, cz); g.add(d); }
    stadtHaeuser.push({ x: cx, z: cz, r: Math.max(b, t) / 2 + 0.5, h: h + (hoch ? 0 : 3) });
  }
}
// Palmen am Strand links und rechts von Kenjis Platz (nicht dort, wo er herumlaeuft, nicht am Surfbrett, nicht im Wasser),
// dasselbe Modell wie am Fluss in Etappe 3 (story.palmenGeo), drei InstancedMeshes
function baueStrandPalmen(g){
  if(!story.palmenGeo) return;
  const pg = story.palmenGeo(), PH = story.PALME_H || 12;
  const stamm = new THREE.MeshLambertMaterial({ color: 0x8b6a3e });
  const kr = [0x3f8a3a, 0x55963a].map(c => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
  const N = 160, stI = new THREE.InstancedMesh(pg.stamm, stamm, N), krI = kr.map(m => new THREE.InstancedMesh(pg.krone, m, N));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
  let sd = 909; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  let nS = 0; const nK = [0, 0];
  for(let i = 0; i < N * 3 && nS < N; i++){
    const z = STRANDPLATZ.z + (rnd() - 0.5) * 1600, x = FEST.x + 6 + rnd() * (FEST.strand - 10);
    if(Math.abs(z - STRANDPLATZ.z) < 55) continue;                     // Kenjis Platz, Torii, Surfbrett, Tiere frei
    if(Math.hypot(x - FEUER.x, z - FEUER.z) < 22) continue;              // Lagerfeuer frei
    if(Math.hypot(x - SAMURAI_GRUPPE.x, z - SAMURAI_GRUPPE.z) < 20) continue;   // Samurai-Gruppe frei
    if(!festland(x, z) || aufWiese(x, z) && Math.hypot(x - VORFELD.x, z - VORFELD.z) < 60) continue;
    const h = 7 + rnd() * 7, kk = rnd() < 0.5 ? 0 : 1;
    q.setFromAxisAngle(y, -Math.PI / 2 + (rnd() - 0.5) * 1.6);         // meist zum Meer geneigt (Stamm neigt nach +x des Modells)
    sc.setScalar(h / PH); ps.set(x, ISLAND_Y, z); m4.compose(ps, q, sc);
    stI.setMatrixAt(nS++, m4); krI[kk].setMatrixAt(nK[kk]++, m4);
  }
  stI.count = nS; krI[0].count = nK[0]; krI[1].count = nK[1];
  for(const m of [stI, ...krI]){ m.frustumCulled = false; g.add(m); }
}
// Lagerfeuer (Live-Wunsch: animiert lassen): Modell 1,5 m breit, Z oben (Sketchfab-Knoten drehen es richtig), Animation
// "fire armAction" laeuft; dazu ein warmes, flackerndes Punktlicht (eins – nicht pro Bild neu, siehe Speicher-Fix in 6b)
const feuer = { mixer: null, licht: null, t: 0 };
function ladeFeuer(g){
  if(!window.CAMPFIRE_GLB || !THREE.GLTFLoader) return;
  const b = atob(window.CAMPFIRE_GLB.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (gl) => {
    if(!e6()) return;
    const m = gl.scene; m.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(m), sz = bb.getSize(new THREE.Vector3());
    const k = 1.6 / Math.max(sz.x, sz.z); m.scale.multiplyScalar(k);
    m.position.set(FEUER.x - (bb.min.x + bb.max.x) / 2 * k, ISLAND_Y - bb.min.y * k, FEUER.z - (bb.min.z + bb.max.z) / 2 * k);
    m.traverse(o => { if(o.isMesh){ o.frustumCulled = false; if(o.material && o.material.name === 'fire.001'){ o.material.emissive = new THREE.Color(0xff7a20); o.material.emissiveIntensity = 1.2; } } });
    g.add(m);
    if(gl.animations.length){ feuer.mixer = new THREE.AnimationMixer(m); for(const a of gl.animations) feuer.mixer.clipAction(a).play(); }
    feuer.licht = new THREE.PointLight(0xff8a30, 2.2, 40, 1.6); feuer.licht.position.set(FEUER.x, ISLAND_Y + 1.6, FEUER.z); g.add(feuer.licht);
  }, (e) => console.warn('Lagerfeuer-GLB', e));
}
function updateFeuer(dt){
  if(!feuer.mixer) return;
  feuer.t += dt; feuer.mixer.update(dt);
  if(feuer.licht) feuer.licht.intensity = 2 + Math.sin(feuer.t * 13) * 0.35 + Math.sin(feuer.t * 7.3) * 0.25;
}
// Gelber Pfeil ueber der C-400 mit (noch) leerem Schild (Live-Wunsch: das Fahrzeug kommt spaeter dran)
let c400Marke = null;
function stelleC400(){
  if(welt.c400 || !glbTemplates.Transall) return;
  const g = new THREE.Group(), m = glbTemplates.Transall.clone(true); g.add(m);
  g.position.set(VORFELD.x, ISLAND_Y, VORFELD.z); g.rotation.y = Math.PI / 2;    // auf dem Vorfeld, Nase zur Bahn (+x)
  g.userData.fremd = true; story.welt(6).add(g); welt.c400 = g;
}
story.e6strand = () => ({ wx: FLUGFELD.x, wz: FLUGFELD.z, radius: FLUGFELD.laenge / 2 + 50 });   // 6b: Ziel der Landung

// ---- Marken und Ring -----------------------------------------------------------------------------------
const marken = [];
function updateMarken(){
  if(!marken.length && story.baueMarke){
    marken.push({ m: story.baueMarke(0xffffff, '1 Tag'),  x: ALPHA.x, z: ALPHA.z, h: 4 });
    marken.push({ m: story.baueMarke(0xffd23f, '4 Tage'), x: RING6.x, z: RING6.z, h: 0 });
  }
  const zeigen = e6() && !!eva && locale === 'earth' && !story.phase;
  for(const o of marken) story.setzeMarke(o.m, o.x, ISLAND_Y, o.z, o.h, zeigen);
}
const park = { obj: null };
function ladeParkAlpha(){
  if(park.obj || !glbTemplates.AlphaJet) return;
  const g = new THREE.Group(), m = glbTemplates.AlphaJet.clone(true);
  m.rotation.y = (typeof TRAFFIC_ROT !== 'undefined' && TRAFFIC_ROT.AlphaJet) || Math.PI / 2; g.add(m);
  g.position.set(ALPHA.x, ISLAND_Y, ALPHA.z); g.rotation.y = ALPHA.yaw;
  g.userData.fremd = true; story.welt(6).add(g); park.obj = g;
}
function alphaNah(){ return !!(e6() && !story.phase && eva && Math.hypot(eva.group.position.x - ALPHA.x, eva.group.position.z - ALPHA.z) < 12); }
function ringNah(){ return !!(e6() && !story.phase && welt.ring && welt.ring.drin()); }
story.alphaNah6 = alphaNah;
story.ringNah6 = ringNah;

// ---- Start der Etappe ---------------------------------------------------------------------------------
function etappe6Start(){
  inselnSetzen();
  if(typeof clearSeaShips === 'function') clearSeaShips();
  if(typeof clearOrcas === 'function') clearOrcas();
  if(typeof clearUwCells === 'function') clearUwCells();
  if(typeof clearFish === 'function') clearFish();
  if(typeof clearArrows === 'function') clearArrows();
  if(typeof clearFire === 'function') clearFire();
  seabedMesh.visible = true;
  if(story.e1aufraeumen) story.e1aufraeumen();
  for(const n of [2, 3, 4, 5]) story.weltEntsorgen(n);
  const fl = story.flucht; if(fl){ fl.aktiv = false; fl.laeuft = false; if(fl.hudEl) fl.hudEl.style.display = 'none'; }
  baueWelt();
  if(story.e6ausbruchWeg) story.e6ausbruchWeg();                     // Neustart: kein alter Ausbruch mehr
  if(story.e6hoehleAus) story.e6hoehleAus();
  if(locale !== 'earth') enterEarth();
  clearEva();
  currentModel = MODEL_NAMES.indexOf('AlphaJet');
  buildModel('AlphaJet'); spec = PLANE_SPECS.AlphaJet || DEFAULT_SPEC;
  state.pos.set(ALPHA.x, ISLAND_Y, ALPHA.z);
  state.quat.setFromEuler(new THREE.Euler(0, ALPHA.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  planeGroup.visible = false;                         // der geparkte Alpha ist Kulisse, bis man einsteigt
  evaExit();
  eva.group.position.set(START6.x, ISLAND_Y, START6.z);
  eva.yaw = START6.yaw; eva.group.rotation.y = eva.yaw;
  evaOrbit = 0; evaPitch = 0;
  snapCamera();
  if(!welt.ring) welt.ring = story.einstiegsRing(RING6.x, ISLAND_Y, RING6.z);   // auf der Wiese vor dem Bahnsteig (Live-Bild: schwebte)
  ladeParkAlpha();
  if(park.obj) park.obj.visible = true;
  marken.length = 0;
  story.phase = null; story.ende = false;
  flug.aktiv = false;
  story.hinweis('Zwei Wege: Alpha Jet (weiß) oder Shinkansen (gelber Ring am Bahnsteig) – hinlaufen und Y drücken');
  story.spaeter(12, () => { if(eva && !story.phase) story.hinweis(''); });
  // Test-Shortcut vom Startbildschirm ("E6 Höhle"): einsteigen, Startsequenz und Hinflug ueberspringen, Hoehle mit Autopilot
  if(story.hoehleDirekt){ story.hoehleDirekt = false; story.spaeter(1.5, hoehleDirekt); }
  // Test-Shortcut "E6 Zug": gleich in den Shinkansen (der Zug muss geladen sein)
  if(story.vulkanDirekt){ story.vulkanDirekt = false; story.spaeter(1.5, () => { if(!e6() || !eva) return; alphaEinsteigen(true);
    story.preflight.aktiv = false; if(story.preflight.el) story.preflight.el.style.display = 'none';
    flug.laeuft = true; flug.hoehleFertig = true; story.ziel = null; story.hinweis('');
    if(story.e6szeneStart) story.e6szeneStart(); }); }
  if(story.zugDirekt){ story.zugDirekt = false; const los = () => { if(welt.zug && story.e6zugEinsteigen) story.e6zugEinsteigen(); else story.spaeter(0.5, los); }; story.spaeter(1.5, los); }
}
function hoehleDirekt(){
  if(!e6() || !eva) return;
  alphaEinsteigen(true);
  story.preflight.aktiv = false; if(story.preflight.el) story.preflight.el.style.display = 'none';
  flug.laeuft = true; story.ziel = null; story.hinweis('');
  if(story.hoehleStart) story.hoehleStart();
}
story.etappe6Start = etappe6Start;

// ---- 6b: Alpha Jet – Startsequenz, Flug zum Fuji, Blende in die Hoehle ------------------------------------------
const flug = { aktiv: false, laeuft: false, rede: null };
story.e6flug = flug;
const ALPHA_TEXT = [
  'Willkommen im Alpha Jet! Wir fliegen zum Fuji.',
  'Zuerst die Startsequenz, du kennst sie schon. Dann Vollgas, abheben und dem roten Punkt im Radar folgen.',
];
function alphaEinsteigen(ohneSequenz){
  story.phase = 'alpha';
  flug.aktiv = true; flug.laeuft = false; flug.abgestuerzt = false; flug.hoehleFertig = false;
  const idx = MODEL_NAMES.indexOf('AlphaJet');
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = 'AlphaJet';
  buildModel('AlphaJet'); spec = PLANE_SPECS.AlphaJet || DEFAULT_SPEC;
  state.pos.set(ALPHA.x, ISLAND_Y, ALPHA.z);
  state.quat.setFromEuler(new THREE.Euler(0, ALPHA.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.visible = true;
  if(park.obj) park.obj.visible = false;
  snapCamera();
  story.hinweis('');
  // Startsequenz wie beim X-Wing: Ansage "Bitte Startsequenz durchfuehren!" und 10-s-Countdown (Live-Wunsch 09.10.2026,
  // vorher still)
  if(ohneSequenz) return;                                             // Test-Einstiege (E6 Hoehle / E6 Vulkan)
  story.pfStart({ kurzschluss: false, danach: nachSequenz });
}
// Startsequenz nicht geschafft (Zeit um): noch einmal – der Alpha bleibt auf der Bahn
function nachSequenz(ok){
  if(!flug.aktiv) return;
  // Live-Wunsch: Startsequenz nicht geschafft -> 7 Tage, Gefaengnis (wer ohne Sequenz losfliegt, wird festgenommen)
  // Ansagen wie beim X-Wing mit der Startsequenz-Stimme (weiblich, SPRECHTEXTE_2.md)
  if(!ok){ story.sprich(['Die Startsequenz hat nicht geklappt – ohne Startsequenz darf hier keiner fliegen.', 'Die Flughafenpolizei nimmt Kenji fest. Eine Woche Gefängnis.'],
    () => story.spaeter(1, () => flugEnde(false, 'Startsequenz verpasst, Gefängnis'))); return; }
  story.sprich(['Startsequenz abgeschlossen. Guten Flug!']);
  flug.laeuft = true;
  story.ziel = { x: ZIEL6.x, z: ZIEL6.z };
  story.hinweis('Folge dem roten Punkt im Radar – Start: X / Shift halten');
  story.spaeter(8, () => story.hinweis(''));
}
// Hinflug: am Ziel (kurz vor dem Berg) Blende -> Hoehle. Absturz -> 7 Tage.
function flugUpdate(){
  if(!flug.aktiv || !flug.laeuft || flug.blende || flug.hoehleFertig) return;   // nach der Hoehle: nie wieder hinein
  if(state.crashed){ absturz(); return; }
  const d = Math.hypot(state.pos.x - ZIEL6.x, state.pos.z - ZIEL6.z);
  if(d < ZIEL6.r && !state.onGround){
    flug.blende = true;
    story.ziel = null;
    story.schwarz('', 0.6, () => { flug.blende = false; flug.laeuft = false; if(story.hoehleStart) story.hoehleStart(); });
  }
}
// Absturz (Live-Wunsch): 7 Tage, Krankenhaus
function absturz(){
  if(flug.abgestuerzt) return; flug.abgestuerzt = true; flug.laeuft = false; story.ziel = null;
  story.spaeter(2.5, () => flugEnde(false, 'Absturz, Krankenhaus'));   // keine Ansage (Live-Wunsch): die Blende sagt die 7 Tage
}
story.e6absturz = absturz;
function flugEnde(ok, wie){
  if(story.ende) return;
  story.ende = true; flug.aktiv = false; flug.laeuft = false; story.ziel = null;
  ankunft(ok ? 1 : 7, wie, ok);
}
story.e6flugEnde = flugEnde;
// Ende der Etappe (Live-Wunsch 09.10.2026): egal ob geschafft oder nicht, Schwarzblende mit den Tagen, danach steht Kenji
// am Strand neben dem Flugfeld (geschafft: der Alpha steht am Ende der Bahn). 6c (Shinkansen) endet hier genauso.
// Die Reise geht spaeter von hier weiter (Etappe 7 / Finale).
function ankunft(tage, wie, alphaDa){
  story.phase = 'reise'; story.verdreht = false;
  story.tage += tage;
  const txt = (tage === 1 ? 'Ein Tag vergangen' : tage + ' Tage vergangen') + ' (' + wie + ') · noch ' + (42 - story.tage) + ' von 42 Tagen';
  story.globusAnkunft('Ziel: Fukuoka', txt, () => {
    if(story.e6zugAbbauen) story.e6zugAbbauen();                     // Zugstrecke (6c) freigeben
    if(typeof clearRescue === 'function') clearRescue();
    if(typeof clearParachute === 'function') clearParachute();
    if(typeof clearFire === 'function') clearFire();
    const ho = story.hoehle; if(ho){ ho.steht = false; ho.landen = false; ho.aktiv = false; ho.szene = null; }
    if(story.e6ausbruchWeg) story.e6ausbruchWeg();                   // Rauch/Lava freigeben (Speicher)
    if(story.e6hoehleAus) story.e6hoehleAus();                       // Hoehlenabschnitte nicht weiter zeichnen
    story.kunstflugAus = false;
    state.crashed = false; state.crashTimer = 0; state.falling = false; state.ejected = false;
    if(eva) clearEva();
    // Flieger am Ende der Bahn (nur sichtbar, wenn er heil gelandet ist), Kenji steigt dort aus und steht dann am Strand
    state.pos.set(FLUGFELD.x, ISLAND_Y, FLUGFELD.z + FLUGFELD.laenge / 2 - 60);
    state.quat.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
    state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true;
    planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.scale.setScalar(1);
    planeGroup.visible = !!alphaDa;
    evaExit();
    if(eva){
      eva.group.position.set(STRANDPLATZ.x, ISLAND_Y, STRANDPLATZ.z);
      eva.yaw = STRANDPLATZ.yaw; eva.group.rotation.y = eva.yaw;
      evaOrbit = 0; evaPitch = 0;
    }
    snapCamera();
    story.phase = 'ankunft';
    story.spaeter(4, () => { story.hinweis('Angekommen am Strand neben dem Fuji – die Reise geht bald weiter …'); story.spaeter(10, () => story.hinweis('')); });
  });
}
story.e6ankunft = ankunft;

// ---- Hooks --------------------------------------------------------------------------------------------
function hookE6(){
  const updateTrafficOrig = updateTraffic, updateFlybyOrig = updateFlyby;
  updateTraffic = function(dt){
    if(hier()){ if(fleet.length){ for(const e of fleet) removePlane(e); fleet.length = 0; } if(typeof clearAiEffects === 'function') clearAiEffects(); return; }
    return updateTrafficOrig(dt);
  };
  updateFlyby = function(dt){ if(hier()){ if(typeof clearFlyby === 'function') clearFlyby(); return; } return updateFlybyOrig(dt); };
  // Schiffe nicht in den Fuji
  const shipWaterOrig = seaShipWaterFor;
  seaShipWaterFor = function(sh, x, z){ if(hier() && Math.hypot(x - FUJI.x, z - FUJI.z) < FUJI.r + 200) return false; return shipWaterOrig.apply(this, arguments); };
  // Festland: fuer die Engine Land wie eine Insel (Boden, Landebahn); im Meeresgitter als riesige Insel eingetragen,
  // damit das Wasser darunter verschwindet und die Duenung am Strand auslaeuft (shoreFade), dazu der Meeresgrund
  const onLandOrig = isOnLand, runwayOrig = isOnRunway, seaIslOrig = collectSeaIslands, sbIslOrig = collectSeabedIslands;
  // story.e6nurMeer (Vulkanszene, etappe6b.js): kein Land im Meeresgitter – Festland und Startinsel weg, nur Meer
  isOnLand = function(x, z){ if(hier() && story.e6nurMeer) return false; return (hier() && festland(x, z)) || onLandOrig.apply(this, arguments); };
  isOnRunway = function(x, z){ return (hier() && aufBahn(x, z)) || runwayOrig.apply(this, arguments); };
  collectSeaIslands = function(){
    const r = seaIslOrig.apply(this, arguments);
    if(hier() && story.e6nurMeer){ _seaIslands.length = 0; return r; }
    if(hier()){ const Rr = FEST.R, rs = Rr + 20, ra = rs + SHORE_FADE_W; _seaIslands.push(FEST_MX, FEST_MZ, rs, ra * ra, Rr * Rr); }
    return r;
  };
  collectSeabedIslands = function(){ const r = sbIslOrig.apply(this, arguments); if(hier() && story.e6nurMeer){ _sbIslands.length = 0; return r; } if(hier()) _sbIslands.push(FEST_MX, FEST_MZ, FEST.R + 20); return r; };
  // Y: Alpha einsteigen, Shinkansen-Ring (6a folgt)
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(hier() && story.phase === 'ankunft'){                            // am Strand: der Alpha bleibt stehen
      if(surfNah()){ story.hinweis('Surfen kommt bald – die Reise geht weiter!'); story.spaeter(5, () => story.hinweis('')); }
      return;
    }
    if(hier() && alphaNah()){ alphaEinsteigen(); return; }
    if(hier() && ringNah() && story.e6zugEinsteigen){ story.e6zugEinsteigen(); return; }
    return boardYOrig.apply(this, arguments);
  };
  // Fuji und Stadthaeuser sind Hindernisse (Berg rammen = Absturz)
  const hitsOrig = hitsBuilding;
  hitsBuilding = function(x, y, z){
    if(hier()){
      if(y < fujiY(x, z) && !(story.hoehle && story.hoehle.aktiv)) return true;
      if(stadtHaeuser.some(h => Math.hypot(x - h.x, z - h.z) < h.r && y < ISLAND_Y + h.h)) return true;
    }
    return hitsOrig.apply(this, arguments);
  };
  // Waehrend der Ansage steht der Alpha mit Bremse
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(hier() && story.phase === 'alpha' && flug.aktiv && !flug.laeuft && !story.preflight.aktiv && !(story.hoehle && story.hoehle.aktiv)){
      state.vel.set(0, 0, 0); state.throttle = 0; return;
    }
    const r = physOrig.apply(this, arguments);
    if(hier() && story.phase === 'alpha') flugUpdate();
    return r;
  };
  const resetOrig = resetPlane;
  resetPlane = function(){ if(hier() && story.phase === 'alpha') return; return resetOrig.apply(this, arguments); };
}

function updateE6(dt){
  story.etappenMusik(6, window.MUSIK_SND && window.MUSIK_SND.e6, dt || 0);
  if(!e6()) return;
  ladeParkAlpha();
  if(park.obj) park.obj.visible = locale === 'earth' && story.phase !== 'alpha';
  stelleC400();
  updateMarken();
  if(welt.ring) welt.ring.zeigen(!!eva && locale === 'earth' && !story.phase);
  if(story.updateE6b) story.updateE6b(dt);
  if(story.updateE6c) story.updateE6c(dt);
  updateFeuer(dt || 0);
  // Surfbrett am Fukuoka-Beach: Ring + gelber Pfeil "Surfen", nur zu Fuss und nach der Ankunft
  if(story.phase === 'ankunft' && eva){
    if(!surf.ring) surf.ring = story.einstiegsRing(SURF.x, ISLAND_Y, SURF.z);
    if(!surf.marke && story.baueMarke) surf.marke = story.baueMarke(0xffd23f, 'Surfen');
  }
  const surfZeigen = story.phase === 'ankunft' && !!eva && locale === 'earth';
  if(surf.ring) surf.ring.zeigen(surfZeigen);
  if(surf.marke) story.setzeMarke(surf.marke, SURF.x, ISLAND_Y, SURF.z, 1.9, surfZeigen);
  if(surfZeigen && !c400Marke && story.baueMarke) c400Marke = story.baueMarke(0xffd23f, '');
  if(c400Marke) story.setzeMarke(c400Marke, VORFELD.x, ISLAND_Y, VORFELD.z, 9, surfZeigen && !!welt.c400);
}
story.updateE6 = updateE6;
story.aufgabeE6 = () => (story.aufgabeE6c && story.aufgabeE6c()) || (e6() && story.phase === 'ankunft' ? ['Etappe 6: am Strand neben dem Fuji', [
  ['Geschafft', 'die Reise geht bald weiter'],
  ['Zeit', (42 - story.tage) + ' von 42 Tagen übrig'],
]] : null) || (story.aufgabeE6b && story.aufgabeE6b()) || (flug.aktiv ? ['Alpha Jet zum Fuji', [
  ['Start', 'Startsequenz, dann Vollgas und abheben'],
  ['Ziel', 'roter Punkt im Radar, kurz vor dem Fuji'],
]] : (e6() && !story.phase ? ['Etappe 6: Japan – der Fuji', [
  ['Alpha Jet (weiß)', '1 Tag'],
  ['Shinkansen (gelb)', '4 Tage – Weichen wählen'],
  ['Einsteigen', 'hinlaufen, Y'],
  ['Zeit', (42 - story.tage) + ' von 42 Tagen übrig'],
]] : null));

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookE6();
};
})();
