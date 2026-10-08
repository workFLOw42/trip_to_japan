// Trip to Japan – Etappe 3: Der Indische Ozean (Feuerwehrboot auf dem Fluss vs. X-Wing).
// Laedt nach etappe2.js, vor der Engine. Aktiv erst, wenn story.etappe === 3.
// Welt: gruene Uferlandschaft mit einem gewundenen Fluss. Das Meeresgitter der Engine (6 x 6 km,
// folgt dem Spieler) wird zum Boden – Ufer, Wiese und das Flussbett mit Wasserfarbe. Wasser ist nur
// im Fluss; das Feuerwehrboot faehrt mit der Bootsphysik der Engine, die Stroemung schiebt es
// flussabwaerts. Felsen im Fluss, drei Feuer am Ufer.
//   Sicher (Feuerwehrboot): Kapitaen erklaert Traegheit + Loeschen, dann 3 Feuer in < 2 min,
//     hoechstens 2 Felskontakte -> 4 Tage. 3. Felskontakt oder Zeit um -> 7 Tage. Nach dem letzten
//     Feuer zaehlen Felsen weiter, bis die Schlussansage zu Ende ist (Konzentration bis zum Schluss).
//   Risiko (X-Wing): normale Startsequenz (kein Kurzschluss). Geschafft -> Radarpunkt, 1 Tag.
//     Verpasst -> Autopilot zum Mond (story.js) -> 7 Tage.
(function(){
'use strict';
const story = window.STORY;
function e3(){ return story.etappe === 3; }
function hier(){ return e3() && locale === 'earth'; }

// ---- Fluss ------------------------------------------------------------------------------------
// Mittellinie als Kurve x(z): Start am Bootssteg (z = 300), flussabwaerts nach -Z, in Schlingen.
// Die Stroemung zeigt flussabwaerts; das Boot startet oben und faehrt mit der Stroemung durch die
// Kurven – genau dort, wo die Traegheit zaehlt.
const FLUSS_B   = 70;        // m Breite (Ufer zu Ufer)
const UFER_SAND = 14;        // m Sandstreifen am Ufer
const FLUSS_Z0  = 420, FLUSS_Z1 = -2270;      // Anfang / Ende der Strecke (z)
const STROM     = 4.5;       // m/s Stroemung in der Flussmitte (Boot max. 24 m/s)
// Rhythmus Gerade – Kurve – Gerade: fuenf enge Kurven (seitlicher Versatz a auf KNICK_L Laenge,
// Radius ~120 m), dazwischen 180 m Gerade. Auf der Geraden Gas, vor der Kurve bremsen – genau das, was
// der Kapitaen erklaert. Vorher: entweder keine Kurve unter 326 m (Vollgas ging ueberall) oder 72 %
// der Strecke Kurve (vorsichtig fahren dauerte 240 s ohne Loeschen; C:\tmp\sfg\fluss_tempo.js).
// Jede Kurve ist eine Cosinus-Rampe: stetig, ohne Knick, Kruemmung am Anfang/Ende am groessten.
const KNICK_L = 240;
// Zwischen Feuer 2 und 3 liegen seit dem Live-Test zwei Kurven statt einer (+330 m Weg).
const KNICKE = [[140, 100], [-280, -110], [-700, 100], [-1120, -100], [-1420, 100], [-1840, -100]];   // [Mitte z, Versatz x]
function mitteX(z){
  let x = 0;
  for(const [zk, a] of KNICKE){
    const u = (zk + KNICK_L / 2 - z) / KNICK_L;          // 0 am Kurvenanfang .. 1 am Ende (flussabwaerts)
    if(u >= 1) x += a; else if(u > 0) x += a * (1 - Math.cos(Math.PI * u)) / 2;
  }
  return x;
}
// Abstand von (x, z) zur Mittellinie (waagerecht, mit Kurvenkorrektur) und Flussrichtung dort
function flussLage(x, z){
  const dxdz = (mitteX(z + 2) - mitteX(z - 2)) / 4;
  const n = Math.hypot(1, dxdz);
  const d = (x - mitteX(z)) / n;              // senkrecht zur Flussrichtung
  return { d, rx: -dxdz / n, rz: -1 / n };    // Richtung flussabwaerts (nach -Z)
}
// Live-Wunsch: der Fluss laeuft in beide Richtungen endlos weiter (vorher endete er bei FLUSS_Z0 / FLUSS_Z1 in der
// Wiese). Ausserhalb der Knicke ist mitteX konstant, der Fluss dort also gerade; FLUSS_Z0/Z1 begrenzen nur noch
// Strecke, Felsen und das fein aufgeloeste Flussband.
function imFluss(x, z, rand){
  return Math.abs(flussLage(x, z).d) < FLUSS_B / 2 - (rand || 0);
}
// Bodenhoehe: Wiese 0,3 m (wie die Inseln), Ufer faellt ins Flussbett
const WIESE_Y = 0.3, WASSER_Y = 0, BETT_Y = -3;
function bodenY(x, z){
  const a = Math.abs(flussLage(x, z).d);
  if(a >= FLUSS_B / 2 + UFER_SAND) return WIESE_Y;
  if(a >= FLUSS_B / 2) return WIESE_Y * (a - FLUSS_B / 2) / UFER_SAND;          // Sand faellt zum Wasser
  return BETT_Y * (1 - a / (FLUSS_B / 2)) * 0.9;                                 // Bett, Mitte am tiefsten
}
story.flussY = bodenY;
story.fluss3 = { mitteX, feuer: () => kul.feuer };

// ---- Felsen im Fluss ---------------------------------------------------------------------------
// Fest verteilt (gleicher Zufall wie die Wueste): in den Kurven auf der Aussenseite, dazwischen
// einzelne in der Mitte. Kontakt = Bootsrumpf naeher als r + BOAT_HALF_W.
const FELSEN = [];
(function(){
  let s = 31;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for(let z = FLUSS_Z0 - 200; z > FLUSS_Z1 + 100; ){
    const krumm = (mitteX(z + 40) - 2 * mitteX(z) + mitteX(z - 40));             // Kruemmung: Vorzeichen = Aussenseite
    // In der Kurve aussen (dort traegt die Fahrt hin, wer zu schnell ist), auf der Geraden vereinzelt
    const kurve = Math.abs(krumm) > 2;
    z -= kurve ? 55 + rnd() * 40 : 85 + rnd() * 50;
    const seite = kurve ? -Math.sign(krumm) : (rnd() < 0.5 ? -1 : 1);
    // Anteil der halben Breite: in der Kurve nur aussen (innen bleibt eine Gasse), auf der Geraden mittig-seitlich
    const lage = kurve ? 0.4 + rnd() * 0.4 : 0.05 + rnd() * 0.6;
    const r = 3 + rnd() * 3;
    const L = flussLage(mitteX(z), z);
    const nx = -L.rz, nz = L.rx;                                                  // quer zum Fluss
    FELSEN.push({ x: mitteX(z) + nx * seite * lage * FLUSS_B / 2, z: z + nz * seite * lage * FLUSS_B / 2, r });
  }
  // Weitere genau in der Flussmitte (Live-Test: wer mittig fuhr, kam zu leicht durch – mit 5 blieben
  // noch 35 s, Ziel 10-20 s). Nur auf Geraden, >= 60 m vor den Feuern, >= 45 m untereinander.
  for(const z of [330, 0, -130, -990, -1270, -1560, -1700, -2010, -2090, -2160]){
    FELSEN.push({ x: mitteX(z), z, r: 4 + rnd() * 1.5 });
  }
  // Felsgruppe zwischen Feuer 1 und 2, am Ausgang von Kurve 2 (Live-Test: dort kam man ohne Bremsen
  // durch). Drei lockere Reihen mit je 3 Felsen, 22 m Abstand, jede zweite um 11 m versetzt, 60 m
  // zwischen den Reihen. Live-Test: das war die beste Variante (ein Zickzack aus halben Reihen war mit
  // vier Reihen unmoeglich).
  // Zufallsfelsen in diesem Bereich fallen weg, sonst wuerde eine Luecke zugestellt.
  const GRUPPE = [
    [-420, [-16.5, 5.5, 27.5]],
    [-480, [-27.5, -5.5, 16.5]],
    [-540, [-16.5, -5.5, 5.5, 27.5]],            // -5,5: Live-Test (Screenshot), dort ging es gerade durch
  ];
  for(let i = FELSEN.length - 1; i >= 0; i--) if(FELSEN[i].z < -400 && FELSEN[i].z > -560) FELSEN.splice(i, 1);
  for(const [z, quer] of GRUPPE){
    const L = flussLage(mitteX(z), z), nx = -L.rz, nz = L.rx;
    for(const d of quer) FELSEN.push({ x: mitteX(z) + nx * d, z: z + nz * d, r: 4.5 });
  }
})();

// ---- Feuer am Ufer -----------------------------------------------------------------------------
// Drei Feuer auf der Wiese, knapp hinter dem Sandstreifen – vom Wasser aus mit dem Strahl erreichbar
// (Engine: Strahl 80 m voraus, Loeschradius 80 m). Reihenfolge flussabwaerts.
const FEUER_DEF = [
  { z: -70,   seite:  1 },
  { z: -910,  seite: -1 },
  { z: -1630, seite:  1 },
];
const FEUER_ABSTAND = FLUSS_B / 2 + UFER_SAND + 18;   // m von der Flussmitte
const ZEIT_MAX = 120;         // s fuer alle drei Feuer (Live-Test: mit 3 min blieben 1:37 uebrig)
const KONTAKT_MAX = 2;        // erlaubte Felskontakte (der dritte ist zu viel)

// ---- Gelaende einhaengen (wie hookWelt2 der Wueste) -------------------------------------------
// Dunkel gewaehlt: das Licht (hemi 1,0 + Sonne) hellt stark auf – wie bei der Wueste
const BODEN_GRAS = new THREE.Color(0x3c5e22), BODEN_SAND = new THREE.Color(0x8f7a4c),
      BODEN_BETT = new THREE.Color(0x4a5a3a);
const _c3 = new THREE.Color();
let bodenX = NaN, bodenZ = NaN;
function bodenRaster(){
  ground.position.x = Math.round(ground.position.x / SEA_STEP) * SEA_STEP;
  ground.position.z = Math.round(ground.position.z / SEA_STEP) * SEA_STEP;
}
// Nur bei einem Rasterwechsel neu rechnen (wie die Wueste, R12).
// Live-Test: im X-Wing ruckelte es (gemessen bei Mach 2: 30 von 337 Bildern ueber 33 ms, bis 95 ms) – nicht der
// Speicher, sondern dieser Neuaufbau: 9409 Gitterpunkte je flussLage() (2x mitteX ueber 6 Knicke), dazu offsetHSL
// und computeVertexNormals, bei Mach 2 elf Mal pro Sekunde. Jetzt:
//   - weit vom Fluss (Querabstand ueber die naechste Mittellinie sicher > Ufer + 1 Gitterweite) gar nicht rechnen,
//     der Punkt ist Wiese; der Querabstand wird grob ueber |wx - mitteX(wz)| abgeschaetzt (in Schlingen ist der
//     echte Abstand kleiner, daher der Rand MITTE_RAND)
//   - Wiesenfarbe direkt in RGB statt offsetHSL
//   - Normalen nur neu, wenn sich eine Hoehe wirklich geaendert hat (die Wiese ist eben)
const MITTE_RAND = 2.2;                               // Sicherheitsfaktor fuer die grobe Abschaetzung
// erst beim Aufruf rechnen: SEA_STEP gibt es erst, wenn die Engine geladen ist (diese Datei laedt davor)
const fern = () => (FLUSS_B / 2 + UFER_SAND + SEA_STEP * 0.5) * MITTE_RAND;
function updateBoden(erzwingen){
  bodenRaster();
  const ox = ground.position.x, oz = ground.position.z;
  if(!erzwingen && ox === bodenX && oz === bodenZ) return;
  bodenX = ox; bodenZ = oz;
  let hoeheNeu = false;
  const FERN = fern();
  const gr = BODEN_GRAS.r, gg = BODEN_GRAS.g, gb = BODEN_GRAS.b;
  for(let i = 0; i < seaPos.count; i++){
    const wx = seaBaseX[i] + ox, wz = seaBaseZ[i] + oz;
    // Gitterpunkte in Flussnaehe liegen tief (unter dem Wasserband), sonst Wiese. Das Gitter ist
    // grob – daher grosszuegig absenken, das Wasserband deckt den Uebergang ab, die Ufer-Sandstreifen
    // liegen als eigenes Band darueber.
    const nah = Math.abs(wx - mitteX(wz)) < FERN
      && Math.abs(flussLage(wx, wz).d) < FLUSS_B / 2 + UFER_SAND + SEA_STEP * 0.5;
    const y = nah ? BETT_Y : WIESE_Y;
    if(seaPos.getY(i) !== y){ seaPos.setY(i, y); hoeheNeu = true; }
    if(nah) seaCol.setXYZ(i, BODEN_BETT.r, BODEN_BETT.g, BODEN_BETT.b);
    else { const l = 1 + (Math.sin(wx * 0.013) * Math.sin(wz * 0.017)) * 0.08;   // leichte Helligkeit wie vorher (+-4 % L)
      seaCol.setXYZ(i, gr * l, gg * l, gb * l); }
  }
  seaPos.needsUpdate = true; seaCol.needsUpdate = true;
  if(hoeheNeu || erzwingen) seaGeo.computeVertexNormals();
}
story.boden3 = updateBoden;                         // fuer Tests (C:\tmp\sfg\fps_e3b.js)

function hookWelt3(){
  const isOnLandOrig = isOnLand, isOnBeachOrig = isOnBeach, surfaceYOrig = surfaceY,
        isOpenWaterOrig = isOpenWater, seaYAtOrig = seaYAt, seabedYOrig = seabedY,
        updateSeaOrig = updateSea, hitsBuildingOrig = hitsBuilding, evaFootYOrig = evaFootY,
        seaSurfaceYOrig = seaSurfaceY;
  // Die Gelaende-Schicht gehoert zusammen (R10): alle Abfragen kennen denselben Fluss.
  isOnLand    = function(x, z){ return hier() ? !imFluss(x, z) && Math.abs(flussLage(x, z).d) >= FLUSS_B / 2 + UFER_SAND : isOnLandOrig.apply(this, arguments); };
  isOnBeach   = function(x, z){ if(!hier()) return isOnBeachOrig.apply(this, arguments);
    const a = Math.abs(flussLage(x, z).d); return !imFluss(x, z) && a < FLUSS_B / 2 + UFER_SAND; };
  isOpenWater = function(x, z){ return hier() ? imFluss(x, z) : isOpenWaterOrig.apply(this, arguments); };
  surfaceY    = function(x, z){ return hier() ? (imFluss(x, z) ? WASSER_Y : bodenY(x, z)) : surfaceYOrig.apply(this, arguments); };
  evaFootY    = function(x, z){ return hier() ? (imFluss(x, z) ? WASSER_Y : bodenY(x, z)) : evaFootYOrig.apply(this, arguments); };
  // Flusswasser ist glatt: keine Duenung
  seaYAt      = function(x, z, t){ return hier() ? WASSER_Y : seaYAtOrig.apply(this, arguments); };
  seaSurfaceY = function(dx, dz, t){ return hier() ? WASSER_Y : seaSurfaceYOrig.apply(this, arguments); };
  seabedY     = function(x, z){ return hier() ? bodenY(x, z) : seabedYOrig.apply(this, arguments); };
  hitsBuilding = function(){ return hier() ? false : hitsBuildingOrig.apply(this, arguments); };
  const seaFloorNeededOrig = seaFloorNeeded, updateFishOrig = updateFish, updateReefFishOrig = updateReefFish,
        updateOrcasOrig = updateOrcas;
  seaFloorNeeded = function(){ return hier() ? false : seaFloorNeededOrig(); };
  updateFish     = function(dt){ if(!hier()) return updateFishOrig(dt); };
  updateReefFish = function(dt){ if(!hier()) return updateReefFishOrig(dt); };
  updateOrcas    = function(dt){ if(!hier()) return updateOrcasOrig(dt); };
  const updateTrafficOrig = updateTraffic, updateFlybyOrig = updateFlyby;
  updateTraffic = function(dt){
    if(hier()){
      if(fleet.length){ for(const e of fleet) removePlane(e); fleet.length = 0; }
      if(typeof clearAiEffects === 'function') clearAiEffects();
      return;
    }
    return updateTrafficOrig(dt);
  };
  updateFlyby = function(dt){ if(hier()){ if(typeof clearFlyby === 'function') clearFlyby(); return; } return updateFlybyOrig(dt); };
  const updateShipsSeaOrig = updateShipsSea;
  updateShipsSea = function(dt){ if(hier()){ if(typeof clearSeaShips === 'function') clearSeaShips(); return; } return updateShipsSeaOrig(dt); };
  updateSea = function(dt){
    if(!hier()) return updateSeaOrig.apply(this, arguments);
    updateBoden();
  };
  const recycleOrig = recycleWorld;
  recycleWorld = function(){
    const r = recycleOrig.apply(this, arguments);
    if(hier()) bodenRaster();
    return r;
  };
  // Keine Moewen/Meeresrauschen am Fluss (das Meer ist weit weg)
  const updateAmbientOrig = updateAmbient;
  updateAmbient = function(dt){
    if(!hier()) return updateAmbientOrig(dt);
    const k = Math.min(1, AMB_RATE * dt);
    if(ambGullGain)  ambGullGain.gain.value  += (0 - ambGullGain.gain.value) * k;
    if(ambOceanGain) ambOceanGain.gain.value += (0.04 - ambOceanGain.gain.value) * k;   // leises Rauschen = Fluss
  };
}

// ---- Kulisse: Baeume, Felsen, Steg, Feuer -----------------------------------------------------
const kul = { baeume: null, felsen: [], feuer: [] };
function baueKulisse(){
  const w = story.welt(3);
  // Palmen beidseits des Flusses (fester Zufall), nicht auf dem Ufer. Live-Wunsch: Indischer Ozean statt
  // Skandinavien -> Palmen statt Kegel-Nadelbaeumen. Ueber 8,7 statt 3,3 km Flusslaenge verteilt, weil der Fluss jetzt
  // endlos ist. Live-Wunsch "mehr Palmen": 5000 statt 2900 (~1,7-fache Dichte wie vorher). InstancedMesh: Stamm + zwei Kronenfarben = drei Zeichenaufrufe.
  // Ein Modell, je Palme gedreht (der Stamm neigt sich so in verschiedene Richtungen) und skaliert.
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const stamm = new THREE.MeshLambertMaterial({ color: 0x8b6a3e });
  const krone = new THREE.MeshLambertMaterial({ color: 0x3f8a3a, side: THREE.DoubleSide });
  const krone2 = new THREE.MeshLambertMaterial({ color: 0x55963a, side: THREE.DoubleSide });
  const pg = palmenGeo();
  const g = new THREE.Group();
  const Z_VON = FLUSS_Z0 + 3000, Z_LAENGE = FLUSS_Z0 - FLUSS_Z1 + 6000;
  const N = 5000, stI = new THREE.InstancedMesh(pg.stamm, stamm, N);
  const krI = [new THREE.InstancedMesh(pg.krone, krone, N), new THREE.InstancedMesh(pg.krone, krone2, N)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), yAchse = new THREE.Vector3(0, 1, 0);
  const frei = [xwingPlatz(), ankunft(), stegPlatz()];
  let nS = 0; const nK = [0, 0];
  for(let i = 0; i < N; i++){
    const z = Z_VON - rnd() * Z_LAENGE;
    const seite = rnd() < 0.5 ? -1 : 1;
    const ab = FLUSS_B / 2 + UFER_SAND + 8 + Math.pow(rnd(), 1.6) * 650;      // mehr nah am Fluss
    const x = mitteX(z) + seite * ab;
    const h = 8 + rnd() * 9, kk = rnd() < 0.5 ? 0 : 1, dreh = rnd() * 6.28;
    if(Math.abs(flussLage(x, z).d) < FLUSS_B / 2 + UFER_SAND + 4) continue;   // in Kurven liegt der Fluss schraeg
    if(FEUER_DEF.some(f => Math.hypot(x - feuerPos(f).x, z - feuerPos(f).z) < 45)) continue;   // Feuerplatz frei
    if(frei.some(p => Math.hypot(x - p.x, z - p.z) < 45)) continue;          // X-Wing, Ankunft, Steg frei
    q.setFromAxisAngle(yAchse, dreh); sc.setScalar(h / PALME_H); ps.set(x, WIESE_Y, z);
    m4.compose(ps, q, sc); stI.setMatrixAt(nS++, m4); krI[kk].setMatrixAt(nK[kk]++, m4);
  }
  stI.count = nS; krI[0].count = nK[0]; krI[1].count = nK[1];
  for(const m of [stI, krI[0], krI[1]]){ m.frustumCulled = false; g.add(m); }   // Huelle gilt nur um den Ursprung
  w.add(g); kul.baeume = g;
  // Fluss als Band entlang der Mittellinie: Wasser (WASSER_Y) und beidseits ein Sandstreifen, der
  // von der Wiese zum Wasser abfaellt. Fein aufgeloest (alle 8 m ein Querschnitt), damit das Ufer
  // scharf ist.
  const wasser = new THREE.MeshLambertMaterial({ color: 0x2c6a8f, transparent: true, opacity: 0.92 });
  const sand = new THREE.MeshLambertMaterial({ color: 0x8f7a4c });
  const baender = [
    [-FLUSS_B / 2, FLUSS_B / 2, () => WASSER_Y, wasser],
    [FLUSS_B / 2 - 2, FLUSS_B / 2 + UFER_SAND, (q) => 0.02 + WIESE_Y * q, sand],
    [-FLUSS_B / 2 - UFER_SAND, -FLUSS_B / 2 + 2, (q) => 0.02 + WIESE_Y * (1 - q), sand],
  ];
  for(const [d0, d1, hoehe, mat] of baender) w.add(flussBand(d0, d1, hoehe, mat));
  baueFlussEnden(w, baender);
  baueWiese(w);
  // Felsen im Fluss (sichtbar ueber Wasser)
  const fels = new THREE.MeshLambertMaterial({ color: 0x6f6a62 });
  for(const f of FELSEN){
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(f.r, 0), fels);
    m.position.set(f.x, 0.4, f.z); m.scale.y = 0.75; m.rotation.set(f.x, f.z, 0);
    w.add(m); kul.felsen.push(m);
  }
  // Steg am Start (kleines Holzdeck am rechten Ufer, daneben liegt das Boot)
  const holz = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const steg = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 26), holz);
  const sp = stegPlatz();
  steg.position.set(sp.x, 0.45, sp.z); steg.rotation.y = sp.yaw;
  w.add(steg);
}
// Band entlang des Flusses zwischen den Querabstaenden d0..d1 (Meter von der Mitte). hoehe(q) gibt
// die Hoehe fuer q = 0 (bei d0) bis 1 (bei d1).
// Palme in Bezugsgroesse PALME_H: leicht gebogener Stamm (neigt sich nach +X), Krone aus 9 flachen Wedeln, die
// abwechselnd waagerecht und haengend vom Stammende abgehen (wie die Oasenpalmen in Etappe 2, nur flach statt rund).
const PALME_H = 12, PALME_NEIG = 1.8;
function palmenGeo(){
  const stamm = new THREE.CylinderGeometry(0.22, 0.4, PALME_H, 6, 6, true).translate(0, PALME_H / 2, 0);
  const p = stamm.attributes.position;
  for(let i = 0; i < p.count; i++){ const f = p.getY(i) / PALME_H; p.setX(i, p.getX(i) + PALME_NEIG * f * f); }
  stamm.computeVertexNormals();
  const g = new THREE.Group();
  for(let b = 0; b < 9; b++){
    const w = new THREE.ConeGeometry(0.85, 5.5, 4, 1, true).translate(0, 2.75, 0).scale(1, 1, 0.22);
    w.rotateX(b % 2 ? 1.95 : 1.6);                         // Spitze nach aussen, jeder zweite haengt
    w.rotateY(b / 9 * Math.PI * 2 + (b % 2) * 0.2);
    w.translate(PALME_NEIG, PALME_H - 0.2, 0);
    g.add(new THREE.Mesh(w));
  }
  const krone = mergeGroup(g, null).geometry;              // Engine-Helfer: ein Puffer statt neun
  for(const m of g.children) m.geometry.dispose();
  return { stamm, krone };
}
function flussBand(d0, d1, hoehe, mat, zs){
  const STEP = 8, QUER = 4;
  if(!zs){ zs = []; for(let z = FLUSS_Z0 + 60; z >= FLUSS_Z1 - 60; z -= STEP) zs.push(z); }
  const pos = new Float32Array(zs.length * (QUER + 1) * 3), idx = [];
  zs.forEach((z, i) => {
    const L = flussLage(mitteX(z), z), nx = -L.rz, nz = L.rx, mx = mitteX(z);
    for(let k = 0; k <= QUER; k++){
      const q = k / QUER, d = d0 + (d1 - d0) * q, o = (i * (QUER + 1) + k) * 3;
      pos[o] = mx + nx * d; pos[o + 1] = hoehe(q); pos[o + 2] = z + nz * d;
      if(i > 0 && k > 0){
        const a = (i - 1) * (QUER + 1) + k - 1, b = a + 1, c = i * (QUER + 1) + k - 1, e = c + 1;
        idx.push(a, c, b, b, c, e);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.material.side = THREE.DoubleSide;
  return m;
}
// Gerade Enden des Flusses: je ein ENDE_L langes Stueck ober- und unterhalb (dort ist der Fluss gerade, zwei
// Querschnitte reichen). updateFlussEnden schiebt sie mit der Kamera, damit der Fluss nie aufhoert; an der
// Strecke stossen sie genau an das feine Band (kein Ueberlappen, sonst wird das halbdurchsichtige Wasser dunkler).
const ENDE_L = 12000, Z_OBEN = FLUSS_Z0 + 60, Z_UNTEN = FLUSS_Z1 - 60;
const enden = [];
function baueFlussEnden(w, baender){
  enden.length = 0;
  for(const [d0, d1, hoehe, mat] of baender){
    const o = flussBand(d0, d1, hoehe, mat, [Z_OBEN + ENDE_L, Z_OBEN]); o.frustumCulled = false; w.add(o); enden.push({ m: o, oben: true });
    const u = flussBand(d0, d1, hoehe, mat, [Z_UNTEN, Z_UNTEN - ENDE_L]); u.frustumCulled = false; w.add(u); enden.push({ m: u, oben: false });
  }
}
// ---- Blumenwiese wie auf den Inseln (Etappe 1 und 5) -----------------------------------------------------------
// Live-Wunsch: "die Wiese so blumig machen wie Etappe 1 und 5". Die Inseln tragen grassMat der Engine (gemalte Kachel
// mit Blueten, GRASS_TILE_M je Kachel). Hier liegt diese Textur als je ein Streifen links und rechts des Flusses
// knapp ueber dem Boden; der Streifen beginnt am Sandufer (FLUSS_B / 2 + UFER_SAND) und folgt dem Fluss in den
// Kurven (Querschnitte wie das Flussband), gerade Enden laufen mit der Kamera wie updateFlussEnden.
const WIESE_B = 1400;
function wieseBand(seite, zs){
  const Q = 6, pos = [], uv = [], idx = [];
  zs.forEach((z, i) => {
    const L = flussLage(mitteX(z), z), nx = -L.rz, nz = L.rx, mx = mitteX(z);
    for(let k = 0; k <= Q; k++){
      const d = seite * (FLUSS_B / 2 + UFER_SAND - 0.5 + WIESE_B * (k / Q) * (k / Q));      // innen dichter (Kurven)
      const x = mx + nx * d, zz = z + nz * d;
      pos.push(x, WIESE_Y + 0.03, zz); uv.push(x / GRASS_TILE_M, zz / GRASS_TILE_M);
      if(i > 0 && k > 0){ const a = (i - 1) * (Q + 1) + k - 1, b = a + 1, c = i * (Q + 1) + k - 1, e = c + 1;
        if(seite > 0) idx.push(a, b, c, b, e, c); else idx.push(a, c, b, b, c, e); }   // Normale nach oben (grassMat ist einseitig)
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, grassMat); m.frustumCulled = false; m.userData.fremd = true;   // Engine-Material: nicht freigeben
  return m;
}
const wiesen = [];
function baueWiese(w){
  wiesen.length = 0;
  const zs = []; for(let z = Z_OBEN; z >= Z_UNTEN; z -= 8) zs.push(z);
  for(const seite of [-1, 1]){
    w.add(wieseBand(seite, zs));
    // gerade Enden: die UVs folgen der Weltposition nicht mit, deshalb in Kachelschritten verschieben
    const o = wieseBand(seite, [Z_OBEN + ENDE_L, Z_OBEN]); w.add(o); wiesen.push({ m: o, oben: true });
    const u = wieseBand(seite, [Z_UNTEN, Z_UNTEN - ENDE_L]); w.add(u); wiesen.push({ m: u, oben: false });
  }
}
function updateFlussEnden(){
  const cz = camera.position.z;
  for(const e of wiesen){
    let dz = e.oben ? Math.max(0, cz - Z_OBEN - ENDE_L / 2) : Math.min(0, cz - Z_UNTEN + ENDE_L / 2);
    dz = Math.round(dz / GRASS_TILE_M) * GRASS_TILE_M;   // Kachelraster: das Muster springt nicht
    e.m.position.z = dz;
  }
  for(const e of enden) e.m.position.z = e.oben ? Math.max(0, cz - Z_OBEN - ENDE_L / 2) : Math.min(0, cz - Z_UNTEN + ENDE_L / 2);
}
function feuerPos(f){
  const L = flussLage(mitteX(f.z), f.z);
  const nx = -L.rz, nz = L.rx;
  return { x: mitteX(f.z) + nx * f.seite * FEUER_ABSTAND, z: f.z + nz * f.seite * FEUER_ABSTAND };
}
// Feuer: eigene Flammen (wie makeFire der Engine, aber in der Welt und ohne deren Loesch-Logik)
const flamme = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.9 });
const rauch  = new THREE.MeshLambertMaterial({ color: 0x555555, transparent: true, opacity: 0.55 });
function baueFeuer(){
  for(const f of kul.feuer) story.entsorgen(f.g);
  kul.feuer = [];
  FEUER_DEF.forEach((d, i) => {
    const p = feuerPos(d);
    const g = new THREE.Group(); const flammen = [];
    for(let k = 0; k < 12; k++){
      const a = k / 12 * 6.28, r = (k % 3) * 5;
      const fl = new THREE.Mesh(new THREE.ConeGeometry(1.8 + (k % 2), 6 + (k % 4) * 1.5, 6), flamme);
      fl.position.set(Math.cos(a) * r, WIESE_Y + 3, Math.sin(a) * r); g.add(fl); flammen.push(fl);
      const sm = new THREE.Mesh(new THREE.SphereGeometry(3, 6, 5), rauch);
      sm.position.set(Math.cos(a) * r, WIESE_Y + 11 + (k % 3) * 2, Math.sin(a) * r); g.add(sm);
    }
    g.position.set(p.x, 0, p.z);
    story.welt(3).add(g);
    kul.feuer.push({ i, x: p.x, z: p.z, g, flammen, aus: false });
  });
}

// ---- Fahrzeuge am Start ------------------------------------------------------------------------
// Kenji steht am Steg. Links das Feuerwehrboot am Wasser, rechts auf der Wiese der X-Wing.
function stegPlatz(){
  const z = FLUSS_Z0 - 40;
  const L = flussLage(mitteX(z), z);
  const nx = -L.rz, nz = L.rx;
  const ab = FLUSS_B / 2 - 6;
  return { x: mitteX(z) + nx * ab, z: z + nz * ab, yaw: Math.atan2(-L.rx, -L.rz) };
}
function bootPlatz(){
  const sp = stegPlatz();
  const L = flussLage(sp.x, sp.z);
  const nx = -L.rz, nz = L.rx;
  // 9 m vom Steg Richtung Flussmitte, Nase flussabwaerts
  return { x: sp.x - nx * 9, z: sp.z - nz * 9, yaw: Math.atan2(-L.rx, -L.rz) };
}
function xwingPlatz(){
  const sp = stegPlatz();
  const L = flussLage(sp.x, sp.z);
  const nx = -L.rz, nz = L.rx;
  // Live-Wunsch (Screenshot 08.10.2026, lila Punkt): landeinwaerts knapp hinter dem Sandstreifen und 47 m flussabwaerts –
  // rechts im Bild, wenn Kenji zum Fluss schaut. Vorher 70 m landeinwaerts und 40 m flussaufwaerts, also hinter Kenji.
  // Der Punkt lag 22 m vom Steg (Sand endet bei 20 m); mit ~10 m Spannweite 28 m, damit kein Fluegel im Sand steht.
  return { x: sp.x + nx * 28 + L.rx * 47, z: sp.z + nz * 28 + L.rz * 47, yaw: Math.atan2(-L.rx, -L.rz) };
}
function ankunft(){
  const sp = stegPlatz();
  const L = flussLage(sp.x, sp.z);
  const nx = -L.rz, nz = L.rx;
  return { x: sp.x + nx * 40 + L.rx * 30, z: sp.z + nz * 40 + L.rz * 30 };
}
const park = { boot: null, ring: null };
// Ring auf der Wiese hinter dem Sandstreifen, gegenueber dem Boot (wie der U-Boot-Ring in Etappe 1)
function ringPlatz(){
  const bp = bootPlatz();
  const L = flussLage(bp.x, bp.z);
  const nx = -L.rz, nz = L.rx;
  const seite = Math.sign(L.d) || 1;                    // Boot liegt auf dieser Seite der Mitte
  const ab = FLUSS_B / 2 + UFER_SAND + 6 - Math.abs(L.d);
  return { x: bp.x + nx * seite * ab, z: bp.z + nz * seite * ab };
}
function ladeBootModell(){
  if(park.boot || !story.welt) return;
  const g = makeFireBoat();               // Engine-Boot (GLB, falls geladen), geteilte Materialien
  g.userData.fremd = true;
  const bp = bootPlatz();
  g.position.set(bp.x, -BOAT_DRAFT, bp.z); g.rotation.y = bp.yaw;
  story.welt(3).add(g); park.boot = g;
}
function bootNah(){
  return !!(e3() && !story.phase && park.ring && park.ring.drin());
}
story.bootNah = bootNah;

// ---- Ankunft (nach der Globus-Reise) ----------------------------------------------------------
function flussStart(){
  _islandInfoCalc = function(){ return null; };
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear(); _wreckCache.clear();
  refreshIslands();
  if(typeof clearSeaShips === 'function') clearSeaShips();
  if(typeof clearOrcas === 'function') clearOrcas();
  if(typeof clearUwCells === 'function') clearUwCells();
  if(typeof clearFish === 'function') clearFish();
  seabedMesh.visible = false;
  if(story.e1aufraeumen) story.e1aufraeumen();     // Zustaende (Startsequenz, Mond-Trip) zuruecksetzen
  story.weltEntsorgen(2);                          // Wueste weg (Kulisse, Transall, Kiste, Marken)
  if(typeof clearArrows === 'function') clearArrows();
  if(typeof clearFire === 'function') clearFire();
  baueKulisse();
  baueFeuer();
  ladeSchildkroeten();
  ladeKrokodile();
  if(locale !== 'earth') enterEarth();
  // X-Wing parkt auf der Wiese, Kenji steht am Steg
  const xp = xwingPlatz();
  clearEva();
  currentModel = MODEL_NAMES.indexOf('XWing');
  buildModel('XWing'); spec = PLANE_SPECS.XWing || DEFAULT_SPEC;
  state.pos.set(xp.x, WIESE_Y, xp.z);
  state.quat.setFromEuler(new THREE.Euler(0, xp.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  ground.position.set(xp.x, 0, xp.z);
  updateBoden(true);
  evaExit();
  const an = ankunft();
  eva.group.position.set(an.x, WIESE_Y, an.z);
  // Blick quer ueber den Fluss (Live-Wunsch, Screenshot 08.10.2026): Boot und Steg links, X-Wing rechts vorn am Ufer.
  // Vorher schaute Kenji zwischen Boot und X-Wing, der X-Wing stand dabei hinter ihm.
  const La = flussLage(an.x, an.z), seite = Math.sign(La.d) || 1;
  // senkrecht zur Flussrichtung zum Wasser hin, etwas flussaufwaerts gedreht (~11 Grad), damit Ring und Schild links im Bild sind
  const mx = La.rz * seite - La.rx * 0.2, mz = -La.rx * seite - La.rz * 0.2;
  eva.yaw = Math.atan2(-mx, -mz); eva.group.rotation.y = eva.yaw;
  evaOrbit = 0; evaPitch = 0;
  snapCamera();
  park.boot = null; ladeBootModell();
  const rp = ringPlatz();
  park.ring = story.einstiegsRing(rp.x, WIESE_Y, rp.z);
  marken.length = 0;
  story.phase = null;
  story.ende = false;
  boot.aktiv = false; boot.fertig = false;
  story.hinweis('Zwei Wege: X-Wing (weiß) oder Feuerwehrboot (gelber Ring am Ufer) – hinlaufen und Y drücken');
  story.spaeter(12, () => { if(eva && !story.phase) story.hinweis(''); });
}
story.etappe3Start = flussStart;

// ---- Schildkroeten: kleine Gruppen auf der Wiese (wie die Kamele in Etappe 2) ------------------
// Modell: Tortoise - turtle by Daniel Zuleta Art, CC-BY-4.0 (schildkroete_glb.js). Normal-Maps entfernt, Farbtexturen als
// 512er JPEG und aufgehellt (im Original fast schwarz, Mittel ~25/255) -> 1,2 statt 5,2 MB. Ohne Animation: sie stehen.
// Gruppe: z am Fluss, seite wie FEUER_DEF (+1 = Ufer mit Steg und Kenji), ab = m hinter dem Sandstreifen.
const SK_LAENGE = 1.4;        // m Riesenschildkroete (~0,6 m hoch; Kenji 1,55 m)
// Live-Wunsch "mehr Schildkroeten": 16 Gruppen mit je 3-6 Tieren (vorher 9 mit 3-4), drei davon nah am Start.
const SK_GRUPPEN = [
  { z: 330, seite: -1, ab: 30, n: 5 }, { z: 150, seite: 1, ab: 60, n: 5 }, { z: -250, seite: -1, ab: 25, n: 4 },
  { z: -520, seite: 1, ab: 90, n: 5 }, { z: -1000, seite: 1, ab: 35, n: 4 }, { z: -1300, seite: -1, ab: 50, n: 5 },
  { z: -1750, seite: -1, ab: 30, n: 4 }, { z: -2100, seite: 1, ab: 45, n: 4 },
  { z: 420, seite: 1, ab: 45, n: 4 }, { z: 260, seite: 1, ab: 25, n: 3 }, { z: 0, seite: -1, ab: 40, n: 5 },
  { z: -400, seite: -1, ab: 70, n: 4 }, { z: -800, seite: 1, ab: 55, n: 5 }, { z: -1500, seite: 1, ab: 30, n: 4 },
  { z: -1950, seite: -1, ab: 60, n: 5 },
  { vorKenji: true, n: 6 },    // direkt vor Kenji, auf dem Weg zum Boot
];
const SK_SICHT = 700;         // m: weiter weg nicht zeichnen (je Tier 26.000 Dreiecke)
const schildkroeten = [];
function skMitte(gr){
  if(gr.vorKenji){
    const an = ankunft(), bp = bootPlatz();
    const dx = bp.x - an.x, dz = bp.z - an.z, l = Math.hypot(dx, dz) || 1;
    return { x: an.x + dx / l * 9, z: an.z + dz / l * 9, r: 3 };
  }
  const L = flussLage(mitteX(gr.z), gr.z), nx = -L.rz, nz = L.rx, ab = FLUSS_B / 2 + UFER_SAND + gr.ab;
  return { x: mitteX(gr.z) + nx * gr.seite * ab, z: gr.z + nz * gr.seite * ab, r: 8 };
}
function skFrei(x, z){
  if(Math.abs(flussLage(x, z).d) < FLUSS_B / 2 + UFER_SAND + 3) return false;                    // nicht am Ufer
  if(FEUER_DEF.some(f => Math.hypot(x - feuerPos(f).x, z - feuerPos(f).z) < 25)) return false;   // Feuerplatz
  const xp = xwingPlatz(), rp = ringPlatz(), an = ankunft();
  return Math.hypot(x - xp.x, z - xp.z) > 12 && Math.hypot(x - rp.x, z - rp.z) > 8 && Math.hypot(x - an.x, z - an.z) > 5;
}
function ladeSchildkroeten(){
  schildkroeten.length = 0;
  if(!window.SCHILDKROETE_GLB || !THREE.GLTFLoader) return;
  const b64 = window.SCHILDKROETE_GLB.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (gltf) => {
    if(!e3()) return;
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(SK_LAENGE / Math.max(size.x, size.z));
    obj.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(obj), c = new THREE.Vector3(); b2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
    const tpl = new THREE.Group(); tpl.add(obj);
    let s = 41;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for(const gr of SK_GRUPPEN){
      const m = skMitte(gr), blick = rnd() * Math.PI * 2;
      for(let i = 0; i < gr.n; i++){
        const a = rnd() * Math.PI * 2, r = 1.5 + rnd() * m.r;
        const x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r;
        if(!skFrei(x, z)) continue;
        const k = tpl.clone(true);
        k.position.set(x, bodenY(x, z), z);
        k.rotation.y = blick + (rnd() - 0.5) * 2;
        k.scale.setScalar(0.85 + rnd() * 0.3);
        story.welt(3).add(k); schildkroeten.push(k);
      }
    }
  }, (e) => console.warn('Schildkroeten-GLB', e));
}
// ---- Krokodile im Fluss -----------------------------------------------------------------------------------------
// Modell: Nile Crocodile Swimming by Monster, CC-BY-NC-ND-4.0 (krokodil_glb.js) – ND: das Modell bleibt unveraendert
// (keine verkleinerten Texturen), es wird nur im Spiel skaliert/gedreht. Skelett + "Swim" 5 s; jedes Tier ein eigener
// Klon (cloneSkinned der Engine), eigener Mixer mit Zeitversatz. Im Modell 10,3 m lang, Kopf auf -Z.
// Sie schwimmen in sanften Schlangenlinien auf und ab (mit und gegen die Stroemung), Ruecken knapp unter der
// Oberflaeche – Augen und Panzer schauen heraus. Keine Kollision: sie sind Kulisse, das Boot faehrt durch.
// KROKO_TIEF: Unterkante unter Wasser. Gemessen in der Schwimmhaltung (C:\tmp\sfg\kroko\nah.js): nur 0,63 m hoch – mit
// 0,55 lag der Ruecken bei -0,01 m, also ganz unter Wasser (nur als Schatten). 0,25: Ruecken und Augen ~0,2 m darueber.
const KROKO_L = 4.5, KROKO_TIEF = 0.25;            // m Laenge (grosses Nilkrokodil), m Unterkante unter Wasser
const KROKO_PLAETZE = [                            // [z, Querlage (Anteil der halben Breite), Richtung +1 flussab]
  [380, 0.45, 1], [250, -0.5, -1], [60, 0.3, 1], [-200, -0.35, -1], [-620, 0.5, 1], [-860, -0.4, 1],
  [-1180, 0.35, -1], [-1500, -0.5, 1], [-1880, 0.4, -1], [-2150, -0.3, 1],
];
const krokodile = [];
function ladeKrokodile(){
  krokodile.length = 0;
  if(!window.KROKODIL_GLB || !THREE.GLTFLoader) return;
  const b64 = window.KROKODIL_GLB.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (gltf) => {
    if(!e3()) return;
    const obj = gltf.scene, clip = gltf.animations[0];
    obj.traverse(o => { if(o.isMesh){ o.frustumCulled = false; o.castShadow = false; } });
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const k = KROKO_L / sz.z;
    obj.scale.multiplyScalar(k); obj.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
    const tpl = new THREE.Group(); tpl.add(obj);
    let s = 83;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for(const [z, q, dir] of KROKO_PLAETZE){
      const k2 = cloneSkinned(tpl);
      k2.scale.setScalar(0.85 + rnd() * 0.3);
      story.welt(3).add(k2);
      let mixer = null;
      if(clip){ mixer = new THREE.AnimationMixer(k2); mixer.clipAction(clip).play(); mixer.setTime(rnd() * clip.duration); mixer.timeScale = 0.7 + rnd() * 0.3; }
      krokodile.push({ k: k2, mixer, z, q, dir, z0: z, t: rnd() * 20, v: 0.9 + rnd() * 0.6 });
    }
  }, (e) => console.warn('Krokodil-GLB', e));
}
function updateKrokodile(dt){
  const cp = camera.position, auf = locale === 'earth';
  for(const o of krokodile){
    // auf ~250 m um den Startplatz hin und her, Querlage pendelt langsam (Schlangenlinie)
    o.t += dt; o.z += o.dir * o.v * dt;
    if(Math.abs(o.z - o.z0) > 120){ o.dir = -o.dir; o.z = o.z0 + Math.sign(o.z - o.z0) * 120; }
    const quer = o.q + Math.sin(o.t * 0.25) * 0.15;
    const L = flussLage(mitteX(o.z), o.z), nx = -L.rz, nz = L.rx;
    const x = mitteX(o.z) + nx * quer * (FLUSS_B / 2 - 8), z = o.z + nz * quer * (FLUSS_B / 2 - 8);
    o.k.position.set(x, WASSER_Y - KROKO_TIEF, z);
    // Kopf (-Z) in Schwimmrichtung: flussab = (L.rx, L.rz), dazu das Pendeln
    const fx = L.rx * o.dir, fz = L.rz * o.dir;
    o.k.rotation.y = Math.atan2(-fx, -fz) + Math.cos(o.t * 0.25) * 0.12 * o.dir;
    const d = Math.hypot(x - cp.x, z - cp.z);
    o.k.visible = auf && d < 600;
    if(o.k.visible && o.mixer && d < 200) o.mixer.update(dt);
  }
}
function updateSchildkroeten(){
  const cp = camera.position, auf = locale === 'earth';
  for(const k of schildkroeten) k.visible = auf && Math.hypot(k.position.x - cp.x, k.position.z - cp.z) < SK_SICHT;
}

// Radarziel nach geschaffter Startsequenz: flussabwaerts weit voraus
const zielVorher = story.zielFuer;
story.zielFuer = function(et){ return et === 3 ? { x: mitteX(-6000) + 2500, z: -6000 } : (zielVorher ? zielVorher(et) : { x: 0, z: -9000 }); };

// Marken ueber den Fahrzeugen (wie Etappe 1/2)
const marken = [];
function updateMarken(){
  if(!marken.length && story.baueMarke){
    const xp = xwingPlatz(), rp = ringPlatz();
    marken.push({ m: story.baueMarke(0xffffff, '1 Tag'),  x: xp.x, z: xp.z, h: 3.3 });   // h = Fahrzeug-Oberkante (story.setzeMarke)
    marken.push({ m: story.baueMarke(0xffd23f, '4 Tage'), x: rp.x, z: rp.z, h: 2.8 });
  }
  const zeigen = e3() && !!eva && locale === 'earth' && !story.phase;
  for(const o of marken) story.setzeMarke(o.m, o.x, WIESE_Y, o.z, o.h, zeigen);
}
// Radar zu Fuss: X-Wing (weiss) und Boot (gelb)
function hookRadar3(){
  const footOrig = footTargets;
  footTargets = function(){
    if(!hier() || story.phase) return footOrig();
    const rp = ringPlatz();
    return [{ x: eva.planeAt.x, z: eva.planeAt.z, col: '#ffffff' }, { x: rp.x, z: rp.z, col: '#ffd23f' }];
  };
}

// ---- Feuerwehrboot: Kapitaen, Aufgabe, Stroemung, Felsen --------------------------------------
const KAPITAEN_TEXT = [
  'Ahoi! Gut, dass du da bist. Weiter unten am Fluss brennt es an drei Stellen, und wir brauchen jede Hand.',
  'Mit dem rechten Stick oder W und S gibst du Gas, gelenkt wird mit dem linken Stick oder den Pfeilen.',
  'Pass auf: Ein Boot ist schwer. Es fährt in der Kurve weiter geradeaus, bevor es dreht, und je schneller du bist, desto schlechter gehorcht das Ruder. Vor jeder Kurve nimmst du also Gas zurück und lenkst früh ein.',
  'Die Strömung schiebt uns flussabwärts. Wer zu schnell ist, landet auf den Felsen.',
  'Zum Löschen bremst du ab und stellst dich quer, mit der Nase zum Feuer am Ufer. Dann schaltest du mit B den Wasserstrahl ein.',
  'Drei Feuer in zwei Minuten. Und höchstens zwei Mal an einen Felsen, sonst ist das Boot hin. Los geht\'s!',
];
const boot = story.boot3 = { aktiv: false, fertig: false, t: 0, kontakte: 0, rede: null, hudEl: null, fels: null, cool: 0 };
function bootEinsteigen(){
  story.phase = 'boot';
  boot.aktiv = true; boot.fertig = false; boot.t = 0; boot.kontakte = 0; boot.laeuft = false; boot.cool = 0; boot.schluss = false;
  quer = { x: 0, z: 0 };
  const bp = bootPlatz();
  const idx = MODEL_NAMES.indexOf('Boat');
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = 'Feuerwehrboot';
  buildModel('Boat'); spec = Object.assign({}, PLANE_SPECS.Boat || DEFAULT_SPEC, { accel: BOOT_ACCEL });   // traeger (nur hier)
  state.pos.set(bp.x, -BOAT_DRAFT, bp.z);
  state.quat.setFromEuler(new THREE.Euler(0, bp.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  if(park.boot) park.boot.visible = false;
  snapCamera();
  story.hinweis('');
  baueFeuer();
  bootHud();
  boot.rede = story.sprich(KAPITAEN_TEXT, () => {
    boot.laeuft = true;                       // Zeit laeuft erst nach der Erklaerung
    story.hinweis('Lösche die drei Feuer flussabwärts – B: Wasserstrahl');
    story.spaeter(8, () => { if(boot.aktiv) story.hinweis(''); });
  }, 'pilot');
}
function bootHud(){
  if(!boot.hudEl){
    boot.hudEl = document.createElement('div'); boot.hudEl.dataset.etappeHud = '1';
    boot.hudEl.style.cssText = 'position:absolute;left:50%;top:56px;transform:translateX(-50%);padding:8px 16px;border-radius:10px;'
      + 'background:rgba(0,0,0,.72);color:#fff;font:600 18px system-ui,sans-serif;pointer-events:none;z-index:20;white-space:nowrap;';
    document.body.appendChild(boot.hudEl);
  }
  if(!boot.aktiv){ boot.hudEl.style.display = 'none'; return; }
  boot.hudEl.style.display = '';
  const aus = kul.feuer.filter(f => f.aus).length;
  const rest = Math.max(0, ZEIT_MAX - boot.t);
  const zeit = '<span style="color:' + (rest < 20 ? '#ff5a3c' : rest < 45 ? '#ffd23f' : '#fff') + '">' + Math.ceil(rest) + ' s</span>';
  const fels = '🪨'.repeat(boot.kontakte) + '·'.repeat(Math.max(0, KONTAKT_MAX + 1 - boot.kontakte));
  const html = '⏱ ' + zeit + '  ·  🔥 ' + aus + '/3  ·  ' + fels;
  if(boot.hudEl._h !== html){ boot.hudEl.innerHTML = html; boot.hudEl._h = html; }
}
// naechstes brennendes Feuer (fuer den Radarpunkt)
function naechstesFeuer(){
  let best = null, bd = Infinity;
  for(const f of kul.feuer){ if(f.aus) continue;
    const d = Math.hypot(f.x - state.pos.x, f.z - state.pos.z); if(d < bd){ bd = d; best = f; } }
  return best;
}
// Traegheit auf dem Fluss. Die Engine-Bootsphysik (stepBoat) bremst mit 9 m/s^2, lenkt mit 0,9 rad/s
// und baut das Seitwaertsrutschen in ~0,25 s ab – das Boot faehrt praktisch auf Schienen, mit
// Vollgas kam man ueberall durch. Das U-Boot ist deutlich traeger (5 m/s^2, 0,55 rad/s). Hier, nur in
// Etappe 3, wird das Feuerwehrboot schwer:
//   - Beschleunigen/Bremsen 3,5 m/s^2 (spec.accel)
//   - Ruder je nach Fahrt (ruderFaktor): langsam wendig, schnell steif
//   - Querschlupf: die Fahrt quer zur Nase bleibt erhalten und klingt erst mit QUER_ABBAU ab. In der
//     Kurve faehrt das Boot also erst weiter geradeaus und dreht sich nur langsam in die neue Richtung.
const BOOT_ACCEL = 3.5, QUER_ABBAU = 0.45;                       // 1/s – Engine: 4
// Ruder abhaengig von der Fahrt: langsam wendig, schnell steif. Bei 24 m/s und der Engine-Wendigkeit
// (0,9 rad/s) war der kleinste Wendekreis 27 m – kleiner als jede Kurve (~106 m), Vollgas ging
// ueberall. Jetzt: stehend 0,7, ab ~60 % Fahrt (14 m/s) bleiben 0,22 -> Wendekreis 24/(0,9*0,22) =
// 121 m: bei Vollgas kommt man durch keine Kurve, ohne aussen am Felsen oder Ufer zu landen.
function ruderFaktor(){
  const v = Math.hypot(state.vel.x, state.vel.z);
  const k = Math.min(1, v / 14);
  return 0.7 - (0.7 - 0.22) * k;
}
let quer = { x: 0, z: 0 };                                       // Fahrt quer zur Nase, die die Engine sonst wegdaempft
function bootTraegheit(dt, fwdVor){
  // stepBoat hat die Querfahrt mit 4/s abgebaut. Was davor quer war (quer + neue Drehung), wird hier
  // zurueckgegeben und nur langsam abgebaut.
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  const sx = -fwd.z, sz = fwd.x;
  // Querkomponente der Fahrt VOR dem Schritt in der neuen Ausrichtung: genau das, was eine Drehung
  // an "Weiterrutschen" erzeugt
  const vq = fwdVor.vx * sx + fwdVor.vz * sz;
  const ziel = vq * Math.exp(-QUER_ABBAU * dt);
  const jetzt = state.vel.x * sx + state.vel.z * sz;
  const add = ziel - jetzt;
  // nur, wenn das Wasser vorne frei ist (sonst ins Ufer gedrueckt)
  const nx = state.pos.x + sx * add * dt, nz = state.pos.z + sz * add * dt;
  if(imFluss(nx, nz, BOAT_HALF_W)){
    state.vel.x += sx * add; state.vel.z += sz * add;
    state.pos.x = nx; state.pos.z = nz;
  } else {
    // Ufer: Querfahrt wird abgefangen (Boot schrammt am Sand entlang)
    state.vel.x -= sx * jetzt; state.vel.z -= sz * jetzt;
  }
  // Auf Grund gelaufen (Rumpf beruehrt das Ufer): die Engine laesst das Boot dort mit 85 % der Fahrt
  // weitergleiten – so schob man sich mit Vollgas am Sand entlang. Hier kostet Ufer fast die ganze
  // Fahrt; man muss zurueck ins Wasser manoevrieren.
  if(!imFluss(state.pos.x + fwd.x * BOAT_LOOK, state.pos.z + fwd.z * BOAT_LOOK, BOAT_HALF_W * 0.5)){
    state.vel.multiplyScalar(Math.max(0, 1 - 3.5 * dt));
  }
}
// Pro Bild im Boot (nach stepBoat): Stroemung, Felsen, Loeschen, Zeit
function bootUpdate(dt){
  if(!boot.aktiv) return;
  // Stroemung: in der Mitte voll, zum Ufer hin schwaecher
  if(imFluss(state.pos.x, state.pos.z)){
    const L = flussLage(state.pos.x, state.pos.z);
    const k = 1 - Math.min(1, Math.abs(L.d) / (FLUSS_B / 2)) * 0.7;
    const nx = state.pos.x + L.rx * STROM * k * dt, nz = state.pos.z + L.rz * STROM * k * dt;
    if(imFluss(nx, nz, BOAT_HALF_W)){ state.pos.x = nx; state.pos.z = nz; }
    planeGroup.position.copy(state.pos);
  }
  // Felsen: Kontakt = Rumpf (Bug, Mitte, Heck) im Felsradius. Danach 2 s Ruhe, sonst zaehlte
  // ein einziges Schrammen mehrfach. Das Boot prallt ab (Fahrt umgekehrt und gedaempft).
  boot.cool = Math.max(0, boot.cool - dt);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  for(const f of FELSEN){
    let hit = false;
    for(const s of [BOAT_LOOK, 0, -BOAT_LOOK]){
      if(Math.hypot(state.pos.x + fwd.x * s - f.x, state.pos.z + fwd.z * s - f.z) < f.r + BOAT_HALF_W){ hit = true; break; }
    }
    if(!hit) continue;
    // aus dem Felsen schieben
    const dx = state.pos.x - f.x, dz = state.pos.z - f.z, d = Math.hypot(dx, dz) || 1;
    const soll = f.r + BOAT_HALF_W + BOAT_LOOK * 0.6;
    if(d < soll){ state.pos.x = f.x + dx / d * soll; state.pos.z = f.z + dz / d * soll; }
    if(boot.cool <= 0){
      boot.cool = 2;
      state.vel.multiplyScalar(-0.35);
      if(typeof rumble === 'function') rumble(300, 0.9, 0.6);
      if(boot.laeuft || boot.schluss){
        boot.kontakte++;
        if(boot.kontakte > KONTAKT_MAX){ bootEnde(false, 'Boot am Felsen kaputt'); return; }
        story.sprich([boot.kontakte === 1 ? 'Vorsicht, ein Felsen! Langsamer in den Kurven.' : 'Noch ein Felsen! Beim nächsten ist das Boot hin.'], null, 'pilot');
      }
    }
    planeGroup.position.copy(state.pos);
  }
  // Loeschen: der Strahl der Engine (boatSpray) zielt BOAT_SPRAY_R voraus – dort loeschen wir unsere
  // eigenen Feuer, solange er laeuft (die Engine kennt sie nicht).
  if(boatSpray_ && boot.laeuft){
    const tx = state.pos.x + fwd.x * BOAT_SPRAY_R, tz = state.pos.z + fwd.z * BOAT_SPRAY_R;
    for(const f of kul.feuer){
      if(f.aus) continue;
      if(Math.hypot(f.x - tx, f.z - tz) < BOAT_SPRAY_R * 0.75){
        f.loeschT = (f.loeschT || 0) + dt;
        if(f.loeschT > 1.2){ f.aus = true; story.entsorgen(f.g); if(typeof showThumb === 'function') showThumb();
          const n = kul.feuer.filter(q => q.aus).length;
          if(n < 3) story.sprich([n === 1 ? 'Super, das erste Feuer ist aus!' : 'Klasse, nur noch eins!'], null, 'pilot');
        }
      }
    }
  }
  for(const f of kul.feuer) if(!f.aus) for(const fl of f.flammen) fl.scale.y = 0.7 + Math.random() * 0.6;
  if(boot.laeuft){
    boot.t += dt;
    if(kul.feuer.every(f => f.aus)){ bootGeschafft(); return; }
    if(boot.t >= ZEIT_MAX){ bootEnde(false, 'Zeit abgelaufen'); return; }
  }
  bootHud();
}
// Alle Feuer aus: der Kapitaen spricht – das Boot faehrt weiter (Spieler steuert), Felsen zaehlen
// weiter. Erst wenn der Satz zu Ende ist, kommt der Globus. Wer waehrenddessen zum dritten Mal
// rammt, scheitert doch noch (bootEnde mit 7 Tagen).
function bootGeschafft(){
  if(boot.schluss || boot.fertig) return;
  boot.schluss = true; boot.laeuft = false;      // Uhr steht, Felsen zaehlen (boot.schluss)
  boot.rede = story.sprich(['Großartig! Alle Feuer sind aus. Du bist ein echter Held!'], () => {
    if(boot.fertig) return;                      // inzwischen am Felsen gescheitert
    bootEnde(true, 'mit dem Feuerwehrboot', true);
  }, 'pilot');
}
function bootEnde(ok, wie, schonGesagt){
  if(boot.fertig) return;
  boot.fertig = true; boot.laeuft = false; boot.schluss = false;
  state.throttle = 0;
  if(boot.rede) boot.rede.abbrechen();
  story.boots_wissen = ok;                  // fuer Etappe 4 (Schnellboot-Flucht)
  // Globus erst NACH der Ansage (vorher nach festen 4 s – der Satz wurde abgeschnitten), dazu eine
  // kurze Pause, damit der letzte Satz nicht direkt in die Schwarzblende laeuft.
  const weiter = () => story.spaeter(1, () => {
    boot.aktiv = false; bootHud();
    story.hinweis('');
    story.etappeEnde(ok ? 4 : 7, wie);
  });
  if(schonGesagt){ weiter(); return; }           // Erfolg: der Satz ist schon durch (bootGeschafft)
  story.sprich([wie === 'Zeit abgelaufen' ? 'Oh nein, das hat zu lange gedauert. Die Feuerwehr vom Land übernimmt.'
                                          : 'Autsch! Das Boot ist leck. Wir müssen abschleppen lassen.'], weiter, 'pilot');
}

// Feuer-Radar: im Boot der naechste Brand, sonst wie gehabt
function hookBoot(){
  // Y am Boot: einsteigen
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(hier() && !story.phase && bootNah()){ bootEinsteigen(); return; }
    return boardYOrig.apply(this, arguments);
  };
  // Waehrend der Erklaerung steht das Boot (sonst triebe es schon ab)
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(hier() && boot.aktiv && !boot.laeuft && !boot.schluss && !boot.fertig){
      state.vel.set(0, 0, 0); state.throttle = 0;
      planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
      return;
    }
    if(!(hier() && boot.aktiv)) return physOrig.apply(this, arguments);
    const vor = { vx: state.vel.x, vz: state.vel.z };
    const inp2 = Object.assign({}, inp, { yaw: (inp.yaw || 0) * ruderFaktor() });   // schnell = steif
    const r = physOrig.call(this, dt, inp2);
    bootTraegheit(dt, vor);
    planeGroup.position.copy(state.pos);
    bootUpdate(dt);
    return r;
  };
  // Aussteigen aus dem Boot gibt es in der Aufgabe nicht
  const buttonYOrig = buttonY;
  buttonY = function(){ if(hier() && boot.aktiv) return; return buttonYOrig.apply(this, arguments); };
  const activeOrig = activeTarget;
  activeTarget = function(){
    if(hier() && boot.aktiv){ const f = naechstesFeuer(); return f ? { x: f.x, z: f.z, col: '#ff5a3c' } : null; }
    return activeOrig.apply(this, arguments);
  };
  // Engine-Feuer (updateFire) bleiben in Etappe 3 aus: die Brandsuche braucht Inseln
  const updateFireOrig = updateFire;
  updateFire = function(dt){ if(hier()) return; return updateFireOrig.apply(this, arguments); };
}

// Pro Bild (hookLoop von story.js ruft story.updateE3)
function updateE3(dt){
  story.etappenMusik(3, window.FLUSS_SND && window.FLUSS_SND.musik, dt || 0);   // story.js, wie Etappe 2
  if(!e3()) return;
  updateMarken();
  updateSchildkroeten();
  updateKrokodile(dt || 0);
  if(enden.length) updateFlussEnden();
  if(park.boot) park.boot.visible = !boot.aktiv;
  if(park.ring) park.ring.zeigen(!!eva && locale === 'earth' && !story.phase);
}
story.updateE3 = updateE3;
story.aufgabeE3 = () => boot.aktiv ? ['Feuerwehrboot', [
  ['Ziel', '3 Feuer flussabwärts löschen'],
  ['Zeit', boot.laeuft ? Math.max(0, Math.ceil(ZEIT_MAX - boot.t)) + ' s übrig' : '2 Minuten'],
  ['Felsen', boot.kontakte + ' von ' + KONTAKT_MAX + ' erlaubt'],
  ['Löschen', 'bremsen, quer stellen (Nase zum Feuer), B'],
  ['Kurven', 'früh Gas weg, früh lenken'],
]] : null;

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookWelt3();
  hookRadar3();
  hookBoot();
};
})();
