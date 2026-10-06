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
function imFluss(x, z, rand){
  if(z > FLUSS_Z0 + 40 || z < FLUSS_Z1 - 40) return false;
  return Math.abs(flussLage(x, z).d) < FLUSS_B / 2 - (rand || 0);
}
// Bodenhoehe: Wiese 0,3 m (wie die Inseln), Ufer faellt ins Flussbett
const WIESE_Y = 0.3, WASSER_Y = 0, BETT_Y = -3;
function bodenY(x, z){
  if(z > FLUSS_Z0 + 40 || z < FLUSS_Z1 - 40) return WIESE_Y;
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
// Nur bei einem Rasterwechsel neu rechnen (wie die Wueste, R12)
function updateBoden(erzwingen){
  bodenRaster();
  const ox = ground.position.x, oz = ground.position.z;
  if(!erzwingen && ox === bodenX && oz === bodenZ) return;
  bodenX = ox; bodenZ = oz;
  for(let i = 0; i < seaPos.count; i++){
    const wx = seaBaseX[i] + ox, wz = seaBaseZ[i] + oz;
    // Gitterpunkte in Flussnaehe liegen tief (unter dem Wasserband), sonst Wiese. Das Gitter ist
    // grob – daher grosszuegig absenken, das Wasserband deckt den Uebergang ab, die Ufer-Sandstreifen
    // liegen als eigenes Band darueber.
    const a = Math.abs(flussLage(wx, wz).d);
    const nah = wz <= FLUSS_Z0 + 40 && wz >= FLUSS_Z1 - 40 && a < FLUSS_B / 2 + UFER_SAND + SEA_STEP * 0.5;
    seaPos.setY(i, nah ? BETT_Y : WIESE_Y);
    if(nah) _c3.copy(BODEN_BETT);
    else _c3.copy(BODEN_GRAS).offsetHSL(0, 0, (Math.sin(wx * 0.013) * Math.sin(wz * 0.017)) * 0.04);
    seaCol.setXYZ(i, _c3.r, _c3.g, _c3.b);
  }
  seaPos.needsUpdate = true; seaCol.needsUpdate = true;
  seaGeo.computeVertexNormals();
}

function hookWelt3(){
  const isOnLandOrig = isOnLand, isOnBeachOrig = isOnBeach, surfaceYOrig = surfaceY,
        isOpenWaterOrig = isOpenWater, seaYAtOrig = seaYAt, seabedYOrig = seabedY,
        updateSeaOrig = updateSea, hitsBuildingOrig = hitsBuilding, evaFootYOrig = evaFootY,
        seaSurfaceYOrig = seaSurfaceY;
  // Die Gelaende-Schicht gehoert zusammen (R10): alle Abfragen kennen denselben Fluss.
  isOnLand    = function(x, z){ return hier() ? !imFluss(x, z) && Math.abs(flussLage(x, z).d) >= FLUSS_B / 2 + UFER_SAND : isOnLandOrig.apply(this, arguments); };
  isOnBeach   = function(x, z){ if(!hier()) return isOnBeachOrig.apply(this, arguments);
    const a = Math.abs(flussLage(x, z).d); return !imFluss(x, z) && a < FLUSS_B / 2 + UFER_SAND && z <= FLUSS_Z0 + 40 && z >= FLUSS_Z1 - 40; };
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
  // Baeume beidseits des Flusses (fester Zufall), nicht auf dem Ufer. Live-Wunsch: mehr und hoeher, dichter
  // am Fluss -> 1100 Stueck (vorher 420, 6-14 m) als InstancedMesh (drei Zeichenaufrufe statt 2200).
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const stamm = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const krone = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
  const krone2 = new THREE.MeshLambertMaterial({ color: 0x3f7f30 });
  const g = new THREE.Group();
  const N = 1100, stI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.6, 1, 6), stamm, N);
  const krGeo = new THREE.ConeGeometry(1, 1, 7), krI = [new THREE.InstancedMesh(krGeo, krone, N), new THREE.InstancedMesh(krGeo, krone2, N)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), yAchse = new THREE.Vector3(0, 1, 0);
  const frei = [xwingPlatz(), ankunft(), stegPlatz()];
  let nS = 0; const nK = [0, 0];
  for(let i = 0; i < N; i++){
    const z = FLUSS_Z0 + 300 - rnd() * (FLUSS_Z0 - FLUSS_Z1 + 600);
    const seite = rnd() < 0.5 ? -1 : 1;
    const ab = FLUSS_B / 2 + UFER_SAND + 12 + Math.pow(rnd(), 1.6) * 650;     // mehr nah am Fluss
    const x = mitteX(z) + seite * ab;
    const h = 10 + rnd() * 16, dick = 0.8 + h / 20, kk = rnd() < 0.5 ? 0 : 1, dreh = rnd() * 6.28;
    if(Math.abs(flussLage(x, z).d) < FLUSS_B / 2 + UFER_SAND + 6) continue;   // in Kurven liegt der Fluss schraeg
    if(FEUER_DEF.some(f => Math.hypot(x - feuerPos(f).x, z - feuerPos(f).z) < 45)) continue;   // Feuerplatz frei
    if(frei.some(p => Math.hypot(x - p.x, z - p.z) < 60)) continue;          // X-Wing, Ankunft, Steg frei
    q.setFromAxisAngle(yAchse, dreh);
    sc.set(dick, h * 0.45, dick); ps.set(x, WIESE_Y + h * 0.22, z); m4.compose(ps, q, sc); stI.setMatrixAt(nS++, m4);
    sc.set(h * 0.32, h * 0.75, h * 0.32); ps.set(x, WIESE_Y + h * 0.62, z); m4.compose(ps, q, sc); krI[kk].setMatrixAt(nK[kk]++, m4);
  }
  stI.count = nS; krI[0].count = nK[0]; krI[1].count = nK[1];
  for(const m of [stI, krI[0], krI[1]]){ m.frustumCulled = false; g.add(m); }   // Huelle gilt nur um den Ursprung
  w.add(g); kul.baeume = g;
  // Fluss als Band entlang der Mittellinie: Wasser (WASSER_Y) und beidseits ein Sandstreifen, der
  // von der Wiese zum Wasser abfaellt. Fein aufgeloest (alle 8 m ein Querschnitt), damit das Ufer
  // scharf ist.
  w.add(flussBand(-FLUSS_B / 2, FLUSS_B / 2, () => WASSER_Y, new THREE.MeshLambertMaterial({ color: 0x2c6a8f, transparent: true, opacity: 0.92 })));
  const sand = new THREE.MeshLambertMaterial({ color: 0x8f7a4c });
  w.add(flussBand(FLUSS_B / 2 - 2, FLUSS_B / 2 + UFER_SAND, (q) => 0.02 + WIESE_Y * q, sand));
  w.add(flussBand(-FLUSS_B / 2 - UFER_SAND, -FLUSS_B / 2 + 2, (q) => 0.02 + WIESE_Y * (1 - q), sand));
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
function flussBand(d0, d1, hoehe, mat){
  const STEP = 8, QUER = 4;
  const zs = []; for(let z = FLUSS_Z0 + 60; z >= FLUSS_Z1 - 60; z -= STEP) zs.push(z);
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
  // landeinwaerts hinter dem Ufer, etwas flussaufwaerts
  return { x: sp.x + nx * 70 - L.rx * 40, z: sp.z + nz * 70 - L.rz * 40, yaw: Math.atan2(-L.rx, -L.rz) };
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
  // Blick zwischen Boot und X-Wing
  const bp = bootPlatz();
  const mx = (bp.x + xp.x) / 2 - an.x, mz = (bp.z + xp.z) / 2 - an.z;
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

// Radarziel nach geschaffter Startsequenz: flussabwaerts weit voraus
const zielVorher = story.zielFuer;
story.zielFuer = function(et){ return et === 3 ? { x: mitteX(-6000) + 2500, z: -6000 } : (zielVorher ? zielVorher(et) : { x: 0, z: -9000 }); };

// Marken ueber den Fahrzeugen (wie Etappe 1/2)
const marken = [];
function updateMarken(){
  if(!marken.length && story.baueMarke){
    const xp = xwingPlatz(), rp = ringPlatz();
    marken.push({ m: story.baueMarke(0xffffff, '1 Tag'),  x: xp.x, z: xp.z, h: 9 });
    marken.push({ m: story.baueMarke(0xffd23f, '4 Tage'), x: rp.x, z: rp.z, h: 6 });
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
    boot.hudEl = document.createElement('div');
    boot.hudEl.style.cssText = 'position:absolute;left:50%;top:60px;transform:translateX(-50%);padding:6px 14px;'
      + 'border-radius:8px;background:rgba(0,0,0,.5);color:#fff;font:16px system-ui,sans-serif;pointer-events:none;z-index:20;';
    document.body.appendChild(boot.hudEl);
  }
  if(!boot.aktiv){ boot.hudEl.style.display = 'none'; return; }
  boot.hudEl.style.display = '';
  const aus = kul.feuer.filter(f => f.aus).length;
  const rest = Math.max(0, ZEIT_MAX - boot.t);
  const zeit = Math.floor(rest / 60) + ':' + String(Math.floor(rest % 60)).padStart(2, '0');
  const fels = '🪨'.repeat(boot.kontakte) + '·'.repeat(Math.max(0, KONTAKT_MAX + 1 - boot.kontakte));
  const html = '🔥 ' + aus + '/3  ·  ⏱ ' + (boot.laeuft || boot.schluss || boot.fertig ? zeit : '2:00') + '  ·  Felsen ' + fels;
  if(boot.hudEl._h !== html){ boot.hudEl.textContent = html; boot.hudEl._h = html; }
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
  if(!e3()) return;
  updateMarken();
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
