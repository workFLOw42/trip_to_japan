// Trip to Japan – Etappe 4: Suedostasien (Hafen). Container-Kran bei Wind vs. Schnellboot-Flucht.
// Laedt nach etappe3.js und hafen_glb.js, vor der Engine. Aktiv erst, wenn story.etappe === 4.
// Welt: Hafenbecken (Meer der Engine, Inseln aus) mit Kai, Frachtschiff laengsseits, Container-Kran
// auf dem Kai, Containerstapel. Die Schnellboot-Flucht folgt als zweiter Schritt (vorerst Hinweis).
//   Sicher (Kran): 4 Container in 6 min, hoechstens 2 Fehler -> 4 Tage, sonst 7.
//     Wind in Zyklen links/rechts, je von 0 langsam auf voll, dann ruckartig auf 0 (nicht angesagt).
//     Luecke 1+2 Doppel-Luecke mittig (2 = Praezision: nur bei Flaute, Pendel ruhig),
//     Luecke 3 seitlich ausserhalb des Drehbereichs (Windtrick: Seitenwind, langes Seil, fallen
//     lassen = 1 Fehler),
//     Luecke 4 hinten diagonal, aus der Kamera schlecht zu sehen (Ladeplan, Marker).
(function(){
'use strict';
const story = window.STORY;
function e4(){ return story.etappe === 4; }
function hier(){ return e4() && locale === 'earth'; }

// ---- Hafen-Layout (gerechnet in C:\tmp\sfg\e4\layout_sim.js) ----------------------------------
// Ursprung = Kranturm. +x = Richtung Schiff (quer zum Kai), z = laengs. Kai ist Land bis x = KAI_X.
const KAI_X = 12;                 // Kaikante
const KAI_Y = 2.5;                // Kaihoehe ueber dem Wasser
const DECK_Y = 7;                 // Boden des Laderaums (gemessen per Strahl von oben)
const BUCHT = 6.4, REIHE = 2.6;   // Rasterabstand der Stellplaetze (laengs / quer)
// Laderaum gemessen: x 20..42, z -25..25 -> 7 Buchten x 8 Reihen
const BUCHTEN = 7, REIHEN = 8;
const bucht = i => -19.2 + i * BUCHT, reihe = j => 21.3 + j * REIHE;
const CONT = { l: 6.1, b: 2.44, h: 2.6 };          // 20-Fuss-Container
// Ausleger: dreht um den Turm, Laufkatze faehrt KATZE_MIN..KATZE_MAX hinaus
const TURM_Y = 34;                // Hoehe des Auslegers
const KATZE_MIN = 8, KATZE_MAX = 46;
const SEIL_MIN = 6, SEIL_MAX = 40; // Seillaenge (Haken unter dem Ausleger)
const SEIL_V = (SEIL_MAX - SEIL_MIN) / 10;          // ganz ein/aus in ~10 s (Konzept)
// RASTER (Live-Test: frei fahren war Glueckssache). Ein Druck = eine Stufe; der Kran faehrt sanft zur
// naechsten Stufe (wer schnell hintereinander drueckt, bringt die Last trotzdem ins Pendeln).
// Lueckenmitten und Lagerplaetze liegen GENAU auf Rasterpunkten: "-25° · Marker 13" heisst dort.
// Gerechnet in C:\tmp\sfg\e4\raster.js.
// FAECHER: die Ladung steht in Strahlen vom Turm aus, jeder Container auf einem Rasterpunkt (Winkel x
// Marker), laengs zum Strahl. So liegen Luecken, Winkel und Marker immer genau aufeinander (ein
// rechteckiges Deck liess sich mit runden Winkeln nur bis ~1 m genau treffen). Gerechnet in
// C:\tmp\sfg\e4\faecher.js: Marker = Boegen im Abstand einer Containerlaenge.
const W_STUFE = 5;                // Grad pro Druck
const DREH_MAX_GRAD = 30;         // Drehbereich zu jeder Seite – Luecke 3 liegt bei 35 Grad
const DREH_MAX = DREH_MAX_GRAD * Math.PI / 180;
// Marker 0 = Lager am Kai, 1..4 = Boegen auf dem Schiff
const MARKER_R = [11, 24, 30.25, 36.5, 42.75];
const M_MAX = MARKER_R.length - 1;
const rVon = m => MARKER_R[Math.max(0, Math.min(M_MAX, m))];
function markerVon(r){ let b = 0; for(let m = 1; m <= M_MAX; m++) if(Math.abs(MARKER_R[m] - r) < Math.abs(MARKER_R[b] - r)) b = m; return b; }
function rasterPunkt(grad, marker){ const a = grad * Math.PI / 180, r = rVon(marker); return { x: Math.cos(a) * r, z: Math.sin(a) * r }; }
const DREH_V = 0.18, KATZE_V = 2.2;                 // rad/s, m/s beim Anfahren der naechsten Stufe
// Ziel-Luecken. tol = Toleranz in m (Mitte Container zu Mitte Luecke); auf dem Raster ist man genau da.
// Luecke 3 liegt ausserhalb des Drehbereichs (40 Grad): es fehlen 5,1 m, voller Wind am langen Seil
// versetzt 5,9 m – nur so kommt man hin (dann fallen lassen = 1 Fehler).
const LUECKEN = [
  Object.assign({ n: 1, grad: 0,   m: 2, tol: 0.6 }, rasterPunkt(0, 2)),
  Object.assign({ n: 2, grad: 0,   m: 3, tol: 0.35, praezise: true }, rasterPunkt(0, 3)),
  Object.assign({ n: 3, grad: 35,  m: 2, tol: 1.2, weit: true }, rasterPunkt(35, 2)),
  Object.assign({ n: 4, grad: -25, m: 3, tol: 0.8 }, rasterPunkt(-25, 3)),
];
// Container auf dem Kai zwischen Kran und Kaikante, Marker 0
const STAPEL = [ [-20, 0], [-10, 0], [10, 0], [20, 0] ].map(([g, m]) => Object.assign({ grad: g, m }, rasterPunkt(g, m)));
const ZEIT_MAX = 360, FEHLER_MAX = 2;

// ---- Wind (Konzept: links, rechts, links ... je 0 -> voll langsam, dann ruckartig 0) ---------
// Phase: Aufbau WIND_AUF s, kurz voll, dann sofort 0, kurze Flaute WIND_FLAUTE s, Richtung wechselt.
// Luecke 3 fehlen 2,64 m. Der Wind muss den Container bei ABSETZHOEHE (Seil ~27 m) hinueberdruecken, nicht
// am 40-m-Seil – dort steht er schon auf der Ladung. Gerechnet mit Pendel (C:\tmp\sfg\e4\wind2.js): 1,1 m/s^2
// schafft bei 26,5..30 m Seil 3,2..3,7 m. (0,75 reichte im Live-Test nicht.)
const WIND_MAX = 1.1;
const WIND_AUF = 22, WIND_VOLL = 6, WIND_FLAUTE = 7;   // voller Wind 6 s: Zeit zum Absenken in Luecke 3
const wind = { t: 0, richtung: 1 };
function windJetzt(){
  const T = WIND_AUF + WIND_VOLL + WIND_FLAUTE;
  const u = wind.t % T;
  if(u < WIND_AUF) return wind.richtung * WIND_MAX * Math.pow(u / WIND_AUF, 1.6);
  if(u < WIND_AUF + WIND_VOLL) return wind.richtung * WIND_MAX;
  return 0;
}
function windTick(dt){
  const T = WIND_AUF + WIND_VOLL + WIND_FLAUTE;
  const vor = Math.floor(wind.t / T);
  wind.t += dt;
  if(Math.floor(wind.t / T) !== vor) wind.richtung *= -1;
}
// Windrichtung in der Welt: quer zum Kai (x) - "links/rechts" vom Kranfuehrer aus
const WIND_DIR = { x: 0, z: 1 };

// ---- Gelaende: Hafenland (Meeresgitter als Beton), Wasser nur in Becken, Kanal, Seitenarm --------
// Wie der Fluss in Etappe 3: das Meeresgitter der Engine wird zum Boden, das Wasser ist eine eigene
// GLATTE Flaeche (etappe4b.js). Vorher war es das Meer mit 3 m Duenung – fuer Kran-Schiff und Kanal-
// Rennboot unpassend, und das Boot haette auf jeder Welle getanzt.
function nass4(x, z, rand){ return !!(story.flucht4 && story.flucht4.nass(x, z, rand)); }
const LAND_Y = KAI_Y;
const BODEN_BETON = new THREE.Color(0x5f5b55);
let bodenX4 = NaN, bodenZ4 = NaN;
function bodenRaster4(){ ground.position.x = Math.round(ground.position.x / SEA_STEP) * SEA_STEP; ground.position.z = Math.round(ground.position.z / SEA_STEP) * SEA_STEP; }
// Live-Test (X-Wing): bei Mach 2 ruckelte der Hafen (36 von 355 Bildern ueber 33 ms) – je Rasterschritt 9409 Punkte
// mal 9 Nachbarpruefungen nass4 = 84.681 Abfragen. Jetzt ein Raster: jeder Punkt einmal nass4, "nahe am Wasser" aus den
// 8 Nachbarn im Raster gelesen (genau eine Gitterweite = dasselbe Ergebnis wie vorher). Normalen nur bei Aenderung.
let _nass4 = null;                                    // Raster erst beim ersten Aufruf: seaPos gibt es erst mit der Engine
function updateBoden4(erzwingen){
  bodenRaster4();
  const ox = ground.position.x, oz = ground.position.z;
  if(!erzwingen && ox === bodenX4 && oz === bodenZ4) return;
  bodenX4 = ox; bodenZ4 = oz;
  const N = SEA_SEG + 1;
  if(!_nass4) _nass4 = new Uint8Array(seaPos.count);
  for(let i = 0; i < seaPos.count; i++) _nass4[i] = nass4(seaBaseX[i] + ox, seaBaseZ[i] + oz) ? 1 : 0;
  let neu = false;
  for(let i = 0; i < seaPos.count; i++){
    // Gitter grob (62,5 m): liegt innerhalb einer Gitterweite Wasser, wird der Punkt tief gelegt – sonst
    // spannt das Gitter seine Dreiecke ueber den Wasserrand (Live-Bild: Landstreifen mitten im Becken).
    // Den Uferrand zeichnen die Kaimauern (etappe4b.js) und der Kai-Klotz.
    const r = Math.floor(i / N), c = i % N;
    let nah = _nass4[i] === 1;
    for(let dr = -1; dr <= 1 && !nah; dr++) for(let dc = -1; dc <= 1 && !nah; dc++){
      const rr = r + dr, cc = c + dc;
      if(rr >= 0 && rr < N && cc >= 0 && cc < N && _nass4[rr * N + cc]) nah = true;
    }
    const y = nah ? -3 : LAND_Y;
    if(seaPos.getY(i) !== y){ seaPos.setY(i, y); neu = true; }
    seaCol.setXYZ(i, BODEN_BETON.r, BODEN_BETON.g, BODEN_BETON.b);
  }
  seaPos.needsUpdate = true; seaCol.needsUpdate = true;
  if(neu || erzwingen) seaGeo.computeVertexNormals();
}
story.boden4 = updateBoden4;
function hookWelt4(){
  const isOnLandOrig = isOnLand, surfaceYOrig = surfaceY, evaFootYOrig = evaFootY, isOpenWaterOrig = isOpenWater,
        isOnBeachOrig = isOnBeach, hitsBuildingOrig = hitsBuilding, seaYAtOrig = seaYAt, seaSurfaceYOrig = seaSurfaceY,
        seabedYOrig = seabedY, updateSeaOrig = updateSea, seaFloorNeededOrig = seaFloorNeeded;
  const wasser = (x, z) => nass4(x, z) && !imSchiff(x, z);
  isOnLand    = function(x, z){ return hier() ? !nass4(x, z) : isOnLandOrig.apply(this, arguments); };
  isOnBeach   = function(x, z){ return hier() ? false : isOnBeachOrig.apply(this, arguments); };
  isOpenWater = function(x, z){ return hier() ? wasser(x, z) : isOpenWaterOrig.apply(this, arguments); };
  surfaceY    = function(x, z){ return hier() ? (nass4(x, z) ? 0 : LAND_Y) : surfaceYOrig.apply(this, arguments); };
  evaFootY    = function(x, z){ return hier() ? (nass4(x, z) ? 0 : LAND_Y) : evaFootYOrig.apply(this, arguments); };
  seaYAt      = function(x, z, t){ return hier() ? 0 : seaYAtOrig.apply(this, arguments); };
  seaSurfaceY = function(dx, dz, t){ return hier() ? 0 : seaSurfaceYOrig.apply(this, arguments); };
  seabedY     = function(x, z){ return hier() ? -6 : seabedYOrig.apply(this, arguments); };
  seaFloorNeeded = function(){ return hier() ? false : seaFloorNeededOrig(); };
  updateSea   = function(dt){ if(!hier()) return updateSeaOrig.apply(this, arguments); updateBoden4(); };
  const recycleOrig = recycleWorld;
  recycleWorld = function(){ const r = recycleOrig.apply(this, arguments); if(hier()) bodenRaster4(); return r; };
  hitsBuilding = function(){ return hier() ? false : hitsBuildingOrig.apply(this, arguments); };
  const updateTrafficOrig = updateTraffic, updateFlybyOrig = updateFlyby, updateShipsSeaOrig = updateShipsSea;
  updateTraffic = function(dt){
    if(hier()){ if(fleet.length){ for(const e of fleet) removePlane(e); fleet.length = 0; }
      if(typeof clearAiEffects === 'function') clearAiEffects(); return; }
    return updateTrafficOrig(dt);
  };
  updateFlyby = function(dt){ if(hier()){ if(typeof clearFlyby === 'function') clearFlyby(); return; } return updateFlybyOrig(dt); };
  updateShipsSea = function(dt){ if(hier()){ if(typeof clearSeaShips === 'function') clearSeaShips(); return; } return updateShipsSeaOrig(dt); };
  const updateFireOrig = updateFire;
  updateFire = function(dt){ if(hier()) return; return updateFireOrig.apply(this, arguments); };
}
// Schiffsrumpf (fuer Wasser/Boot): laengs z -45..45, quer x 18..44
function imSchiff(x, z){ return x > 18 && x < 44 && Math.abs(z) < 48; }

// ---- Modelle --------------------------------------------------------------------------------
function ladeGlb(daten, fertig){
  if(!daten || !THREE.GLTFLoader) return;
  const b64 = daten.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (g) => fertig(g), (e) => console.warn('Hafen-Modell', e));
}
// auf Laenge l (groesste waagerechte Ausdehnung) skalieren, Unterkante auf 0, mittig
function normiere(obj, l){
  obj.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(obj), s = new THREE.Vector3(); b.getSize(s);
  obj.scale.multiplyScalar(l / Math.max(s.x, s.z));
  obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj), c = new THREE.Vector3(); b2.getCenter(c);
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  const w = new THREE.Group(); w.add(obj); return w;
}
const hafen = { kran: null, dreh: null, katze: null, contVorlage: null, schiff: null, plaetze: [] };
story.hafen4 = hafen;                              // fuer Tests (Schiff, Kran ausmessen)

function baueHafen(){
  const w = story.welt(4);
  // Kai: Betonflaeche
  const beton = new THREE.MeshLambertMaterial({ color: 0x6e6a64 });
  const kai = new THREE.Mesh(new THREE.BoxGeometry(132, KAI_Y + 3, 320), beton);
  kai.position.set(KAI_X - 66, (KAI_Y - 3) / 2, 0); w.add(kai);
  // Kaikante gelb markiert
  const kante = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 320), new THREE.MeshBasicMaterial({ color: 0xf2c200 }));
  kante.position.set(KAI_X - 0.4, KAI_Y + 0.06, 0); w.add(kante);
  // Frachtschiff (verkleinert). Gemessen im geladenen Modell: Laenge auf x, y ist oben (7,8 x 2,6 x 2,1)
  ladeGlb(window.HAFEN_SCHIFF_GLB, (g) => {
    const o = g.scene;
    const s = normiere(o, 96);
    s.rotation.y = Math.PI / 2;                    // Laenge auf z (laengs am Kai)
    s.position.set(31, -3.2, 0);                   // Wasserlinie bei 0 (glatt)
    s.userData.fremd = false;
    w.add(s); hafen.schiff = s;
  });
  // Container-Vorlage
  ladeGlb(window.HAFEN_CONTAINER_GLB, (g) => {
    const o = g.scene;
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), s = new THREE.Vector3(); b.getSize(s);
    // auf 6,1 x 2,6 x 2,44 m: laengste Seite = Laenge
    const lang = Math.max(s.x, s.y, s.z);
    o.scale.multiplyScalar(CONT.l / lang);
    o.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(o), c = new THREE.Vector3(); b2.getCenter(c);
    o.position.sub(c);
    const v = new THREE.Group(); v.add(o);
    // Laenge auf z drehen, falls das Modell sie auf x hat
    const s2 = new THREE.Vector3(); b2.getSize(s2);
    if(s2.x > s2.z) o.rotation.y = Math.PI / 2;
    hafen.contVorlage = v;
    baueLadung();
  });
  // Kran
  ladeGlb(window.HAFEN_KRAN_GLB, (g) => baueKran(g, w));
  ladeMoewen(w);
  baueHinterland(w);
}

// ---- Sitzende Moewen am Kai (die fliegenden kommen aus tiere.js) ---------------------------------------
// Modell: Ring-Billed Gull by Oregon State University Ecampus, CC-BY-4.0 (moewe_glb.js), Skelett + "Head Turn" 2,5 s;
// jedes Tier ein eigener Klon (cloneSkinned der Engine) mit eigenem Mixer und Zeitversatz. Kopf im Modell auf +Z.
// Live-Wunsch: "etwas zu wenig und fallen auf dem Weg zum Rennboot nicht auf" -> 0,7 m statt 0,45 m (echt ~45 cm,
// aus der Verfolgerkamera aber kaum zu sehen) und doppelt so viele, die meisten an der Kaikante zwischen Kenjis
// Ankunft (-30, -30) und dem Rennboot-Ring (6, -110). kante: true = lockere Reihe an der Kante, Blick aufs Wasser.
const MOEWE_SITZ_L = 0.7;
const MOEWEN_SITZ = [
  { x: 10.6, z: -40, n: 6, kante: true }, { x: 10.6, z: -68, n: 5, kante: true }, { x: 10.6, z: -92, n: 4, kante: true },
  { x: -8, z: -58, n: 5 }, { x: -20, z: -84, n: 4 }, { x: -2, z: -128, n: 5 },          // auf dem Weg zum Ring
  { x: 10.6, z: 40, n: 5, kante: true }, { x: 10.6, z: 120, n: 6, kante: true }, { x: 10.6, z: -150, n: 4, kante: true },
  { x: -18, z: -12, n: 3 }, { x: -45, z: 60, n: 4 },
];
const moewen = [];
function moeweVorlage(gltf, mass){
  const obj = gltf.scene;
  obj.traverse(o => { if(o.isMesh){ o.frustumCulled = false; o.castShadow = false; } });
  // Groesse aus der gehaeuteten Haltung messen (Bindepose-Box stimmt bei Skinned Meshes nicht)
  const mx = new THREE.AnimationMixer(obj); if(gltf.animations[0]) mx.clipAction(gltf.animations[0]).play(); mx.update(0.01);
  obj.updateMatrixWorld(true);
  const bb = new THREE.Box3(), v = new THREE.Vector3();
  obj.traverse(m => { if(!m.isSkinnedMesh) return; const n = m.geometry.attributes.position.count;
    for(let i = 0; i < n; i += 5){ m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld); bb.expandByPoint(v); } });
  obj.scale.setScalar(mass / bb.getSize(new THREE.Vector3()).z);
  obj.position.y -= bb.min.y * obj.scale.x;          // Fuesse auf y = 0
  mx.stopAllAction(); mx.uncacheRoot(obj);
  const tpl = new THREE.Group(); tpl.add(obj);
  return { tpl, clip: gltf.animations[0] };
}
function ladeMoewen(w){
  moewen.length = 0;
  let s = 53;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  ladeGlb(window.MOEWE_SITZ_GLB, (g) => {
    if(!e4()) return;
    const v = moeweVorlage(g, MOEWE_SITZ_L);
    for(const gr of MOEWEN_SITZ){
      const blick = gr.kante ? Math.PI / 2 : rnd() * Math.PI * 2;     // an der Kante: Blick aufs Wasser (+x; Kopf +Z -> yaw pi/2)
      for(let i = 0; i < gr.n; i++){
        const x = gr.kante ? gr.x + (rnd() - 0.5) * 0.8 : gr.x + (rnd() - 0.5) * 6;
        const z = gr.kante ? gr.z + (i - (gr.n - 1) / 2) * (0.9 + rnd() * 0.8) : gr.z + (rnd() - 0.5) * 6;
        const k = cloneSkinned(v.tpl);
        k.position.set(Math.min(KAI_X - 0.4, x), KAI_Y, z);
        k.rotation.y = blick + (rnd() - 0.5) * (gr.kante ? 1.2 : 2.5);
        k.scale.setScalar(0.9 + rnd() * 0.2);
        w.add(k);
        let mixer = null;
        if(v.clip){ mixer = new THREE.AnimationMixer(k); mixer.clipAction(v.clip).play(); mixer.setTime(rnd() * v.clip.duration); mixer.timeScale = 0.8 + rnd() * 0.4; }
        moewen.push({ k, mixer });
      }
    }
  });
}
const MOEWE_SICHT = 300, MOEWE_ANIM = 120;          // m: bis hier gezeichnet / bis hier animiert
function updateMoewen(dt){
  const cp = camera.position, auf = locale === 'earth';
  for(const o of moewen){
    const d = Math.hypot(o.k.position.x - cp.x, o.k.position.z - cp.z);
    o.k.visible = auf && d < MOEWE_SICHT;
    if(o.k.visible && o.mixer && d < MOEWE_ANIM) o.mixer.update(dt);
  }
}

// ---- Hinter Kenji: Containerlager, dahinter eine grosse Stadt ----------------------------------------------
// Live-Wunsch: hinter Kenji (er schaut zum Rennboot, also nach Nordost) lag nur leerer Beton. Jetzt erst ein
// Containerlager (Stapel bis 4 hoch, Gassen dazwischen), dahinter eine Hochhaus-Stadt wie die Skyline in Etappe 5.
// Containerfarben wie die Ladung (FARBEN); als InstancedMesh-Kisten mit Riffelstreifen (ein Aufruf je Farbe).
// Lager: x -110..-60, z 0..150 (hinter Kenji, abseits von Kran, Ring und X-Wing bei (-80, 80) -> dort eine Gasse frei).
const LAGER = { x0: -112, x1: -58, z0: 10, z1: 150 };
function baueHinterland(w){
  let s = 211;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const box = new THREE.BoxGeometry(1, 1, 1);
  const proFarbe = FARBEN.map(() => []);
  for(let x = LAGER.x0; x <= LAGER.x1; x += CONT.b * 4 + 5){              // Reihen zu je 4 Containern quer, 5 m Gasse
    for(let z = LAGER.z0; z <= LAGER.z1; z += CONT.l + 1.2){
      if(Math.hypot(x + 80, z - 80) < 22) continue;                        // X-Wing-Platz (-80, 80) frei
      if(rnd() < 0.12) continue;                                           // Luecken im Lager
      for(let q = 0; q < 4; q++){
        const hoch = 1 + Math.floor(rnd() * 4);
        for(let h = 0; h < hoch; h++){
          const m = new THREE.Matrix4().compose(new THREE.Vector3(x + q * (CONT.b + 0.15), KAI_Y + CONT.h * (h + 0.5), z),
            new THREE.Quaternion(), new THREE.Vector3(CONT.b, CONT.h, CONT.l));
          proFarbe[Math.floor(rnd() * FARBEN.length)].push(m);
        }
      }
    }
  }
  // Stadt: dicht hinter dem Lager, nach hinten hoeher (Hochhaeuser bis ~260 m), bis 1,6 km weit
  const tuerme = [0x9aa7b4, 0x6f7f8f, 0xc9d2da, 0x4f5d6b, 0xb7c4cf, 0x8c97a1, 0xd8cbb0];
  const proTurm = tuerme.map(() => []);
  for(let i = 0; i < 520; i++){
    const tief = Math.pow(rnd(), 0.8);                                      // 0 = gleich hinter dem Lager
    const x = -150 - tief * 1500, z = -900 + rnd() * 2200;
    if(x > -260 && z < -40) continue;                                       // vorn links frei (Kanalufer-Haeuser stehen dort)
    const b = 18 + rnd() * 30, t = 18 + rnd() * 30;
    const h = 20 + Math.pow(rnd(), 1.6) * (60 + 220 * Math.min(1, tief * 1.6));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, KAI_Y + h / 2 - 1, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.3), new THREE.Vector3(b, h, t));
    proTurm[Math.floor(rnd() * tuerme.length)].push(m);
  }
  const setze = (liste, farben) => liste.forEach((ms, i) => {
    if(!ms.length) return;
    const inst = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: farben[i] }), ms.length);
    ms.forEach((m, k) => inst.setMatrixAt(k, m)); inst.frustumCulled = false; w.add(inst);
  });
  setze(proFarbe, FARBEN); setze(proTurm, tuerme);
  // Betonflaeche bis zur Stadt (der Kai-Klotz endet bei x -120)
  const flaeche = new THREE.Mesh(new THREE.BoxGeometry(1700, KAI_Y + 3, 2400), new THREE.MeshLambertMaterial({ color: 0x6e6a64 }));
  flaeche.position.set(-120 - 850, (KAI_Y - 3) / 2, 300); w.add(flaeche);
}

// Kran: Teile des Modells benutzen – Null_1 dreht (Ausleger), Cube = Laufkatze, Sweep_3 = Haken (weg).
function baueKran(g, w){
  const o = g.scene;
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), s = new THREE.Vector3(); b.getSize(s);
  // Massstab ueber die Hoehe des Auslegers (Laufkatze), nicht ueber die Gesamthoehe: gemessen liegt
  // die Katze bei y = 565,9 Modelleinheiten (Turmfuss bei ~0). So haengt der Ausleger auf TURM_Y.
  const katze0 = o.getObjectByName('Cube'), kw = new THREE.Vector3();
  katze0.getWorldPosition(kw);
  const k = TURM_Y / (kw.y - b.min.y);
  o.scale.multiplyScalar(k);
  o.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(o);
  o.position.y -= b2.min.y;
  // Turm (Drehpunkt Null_1) genau auf den Ursprung des Kran-Objekts
  o.updateMatrixWorld(true);
  const dw = new THREE.Vector3(); o.getObjectByName('Null_1').getWorldPosition(dw);
  o.position.x -= dw.x; o.position.z -= dw.z;
  const dreh = o.getObjectByName('Null_1'), katze = o.getObjectByName('Cube'), haken = o.getObjectByName('Sweep_3');
  if(haken) haken.visible = false;
  if(katze) katze.visible = false;                  // eigene Laufkatze (unten), genau am Seil
  // Die Animation des Modells wird nicht abgespielt; wir drehen/schieben selbst.
  const kran = new THREE.Group(); kran.add(o);
  kran.position.set(0, KAI_Y, 0);
  kranAusrichten(kran, o);
  kran.userData.fremd = false;
  w.add(kran);
  hafen.kran = kran; hafen.dreh = dreh; hafen.katze = katze;
  // Eigene Laufkatze: gelber Kasten auf dem Ausleger, faehrt mit kran.r und dreht mit
  hafen.katze2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 2.4), new THREE.MeshLambertMaterial({ color: 0xf2c200 }));
  w.add(hafen.katze2);

  // Seil + Haken (selbst gebaut)
  const seilMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  hafen.seil = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6), seilMat);
  hafen.haken = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), new THREE.MeshLambertMaterial({ color: 0xf2c200 }));
  w.add(hafen.seil, hafen.haken);
  kranZeigen();
}

// Ausleger muss Richtung +x (Schiff) zeigen. Wohin zeigt die Laufkatze in Weltkoordinaten? Liegt sie
// bei -x, den Kran um 180 Grad drehen. (Seitenansicht: der Ausleger schwang vom Schiff weg.)
// Gemessen ueber den Ausleger selbst (Cube_6, Box -237..+538 entlang seiner Achse): dessen Mitte muss
// bei +x liegen, sonst um 180 Grad drehen. Danach liegt der Drehpunkt (Null_1) wieder auf dem Ursprung.
function kranAusrichten(kran, o){
  const arm = o.getObjectByName('Cube_6') || o.getObjectByName('Sweep_2');
  kran.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(arm), c = new THREE.Vector3(); b.getCenter(c);
  if(c.x < 0) o.rotation.y += Math.PI;
  kran.updateMatrixWorld(true);
  const dw = new THREE.Vector3(); o.getObjectByName('Null_1').getWorldPosition(dw);
  o.position.x -= dw.x; o.position.z -= dw.z;
  kran.updateMatrixWorld(true);
}
// Ladung: Deck voll bis auf die 4 Luecken, Kai-Stapel mit 4 Containern
const FARBEN = [0xb8412c, 0x2f5f9e, 0x3c7d3a, 0xc98a1b, 0x777777, 0x8a2f6b];
function containerNeu(farbe){
  const c = hafen.contVorlage.clone(true);
  c.traverse(o => { if(o.isMesh){ o.material = o.material.clone(); o.material.color = new THREE.Color(farbe); } });
  return c;
}
// Rasterpunkte der Ladung: alle Winkel/Marker, deren Container ganz im Laderaum liegt (x 20,5..41,5,
// |z| < 24) – dieselbe Pruefung wie in faecher.js. Marker 1 nur in der Mitte (dort eng).
function ladungsPunkte(){
  const out = [];
  for(let m = 1; m <= M_MAX; m++) for(let g = -45; g <= 45; g += W_STUFE){
    const a = g * Math.PI / 180, r = rVon(m), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
    const ok = [[1,1],[1,-1],[-1,1],[-1,-1]].every(([s, t]) => {
      const ex = x + ux * s * CONT.l / 2 + vx * t * CONT.b / 2, ez = z + uz * s * CONT.l / 2 + vz * t * CONT.b / 2;
      return ex > 20.5 && ex < 41.5 && Math.abs(ez) < 24;
    });
    if(ok && !(m === 1 && Math.abs(g) > 0)) out.push({ grad: g, m, x, z });     // Marker 1: nur 0 Grad (sonst Ueberlappung)
  }
  return out;
}
function baueLadung(){
  const w = story.welt(4);
  hafen.plaetze = [];
  let n = 0;
  for(const q of ladungsPunkte()){
    if(LUECKEN.some(l => l.grad === q.grad && l.m === q.m)) continue;          // genau ein Loch je Luecke
    const c = containerNeu(FARBEN[(n * 5 + q.m) % FARBEN.length]);
    c.position.set(q.x, DECK_Y + CONT.h / 2, q.z); c.rotation.y = -q.grad * Math.PI / 180 + Math.PI / 2;
    w.add(c); hafen.plaetze.push({ x: q.x, z: q.z, y: DECK_Y + CONT.h / 2, grad: q.grad, m: q.m });
    n++;
  }
  // Ladung (4 Container am Kai)
  kran.lager = [];
  STAPEL.forEach((p, i) => {
    const c = containerNeu([0xd94f2b, 0x1f7fbf, 0x2e9e4a, 0xe0a020][i]);
    c.position.set(p.x, KAI_Y + CONT.h / 2, p.z); c.rotation.y = -p.grad * Math.PI / 180 + Math.PI / 2;
    w.add(c); kran.lager.push({ obj: c, ziel: null, fertig: false });
  });
}

// ---- Kran: Zustand und Physik --------------------------------------------------------------
// dreh = Winkel des Auslegers (rad, 0 = Richtung +x zum Schiff), r = Laufkatze, L = Seillaenge,
// Pendel als Winkel (phiR radial, phiT tangential) – beim Einziehen bleibt der Winkel, der
// Ausschlag in Metern schrumpft (gerechnet in C:\tmp\sfg\e4\pendel_sim.js).
const DAEMPF = 0.06, DAEMPF_KURZ = 0.9;          // Daempfung = DAEMPF + DAEMPF_KURZ / Seillaenge
const kran = story.kran4 = { aktiv: false, fertig: false, laeuft: false, t: 0, fehler: 0, voll: 0,
  dreh: 0, r: 20, L: 20, phiR: 0, phiT: 0, wR: 0, wT: 0, haengt: null, lager: [], rede: null,
  vDreh: 0, vKatze: 0, plan: true, hudEl: null, planEl: null, zielGrad: 0, zielM: 0 };

function hakenPos(){
  const ca = Math.cos(kran.dreh), sa = Math.sin(kran.dreh);
  // Aufhaengepunkt
  const ax = ca * kran.r, az = sa * kran.r, ay = KAI_Y + TURM_Y;
  // Auslenkung: radial (entlang Ausleger) und tangential
  const dr = Math.sin(kran.phiR) * kran.L, dt = Math.sin(kran.phiT) * kran.L;
  const y = ay - kran.L * Math.cos(kran.phiR) * Math.cos(kran.phiT);
  return { x: ax + ca * dr - sa * dt, z: az + sa * dr + ca * dt, y, ax, az, ay };
}
function kranPhysik(dt, inp){
  // Eingabe: L-Stick / Pfeile <-> drehen, LT/RT bzw. Q/E Laufkatze (RT/E = nach aussen), R-Stick / W S Seil.
  // (Live-Test: Laufkatze auf dem Stick verwechselte man mit dem Drehen.)
  // Stick rechts = Ausleger nach rechts (Kamera hinter dem Turm: rechts im Bild = +z = +dreh)
  const dreh = (inp.yaw || 0), katze = (inp.roll || 0);
  let seil = 0;
  if(keys['KeyW']) seil = -1; else if(keys['KeyS']) seil = 1;
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(gp){ const ry = gp.axes[3] || 0; if(Math.abs(ry) > 0.2) seil = ry; }
  // Stufen: ein Druck (Flanke) = eine Stufe weiter. Der Kran faehrt sanft zum Ziel (Rampe), das Ziel
  // ist immer ein Rasterpunkt.
  const dS = dreh > 0.6 ? 1 : dreh < -0.6 ? -1 : 0, kS = katze > 0.6 ? 1 : katze < -0.6 ? -1 : 0;
  if(dS && dS !== kran._dS) kran.zielGrad = Math.max(-DREH_MAX_GRAD, Math.min(DREH_MAX_GRAD, kran.zielGrad + dS * W_STUFE));
  if(kS && kS !== kran._kS) kran.zielM = Math.max(0, Math.min(M_MAX, kran.zielM + kS));
  kran._dS = dS; kran._kS = kS;
  const zielDreh = kran.zielGrad * Math.PI / 180, zielR = rVon(kran.zielM);
  const fahr = (ist, ziel, vIst, vMax, a) => {               // Rampe: beschleunigen, rechtzeitig bremsen
    const rest = ziel - ist, bremsWeg = vIst * vIst / (2 * a);
    let vSoll = Math.sign(rest) * Math.min(vMax, Math.sqrt(2 * a * Math.abs(rest)));
    if(Math.abs(rest) < 1e-4) vSoll = 0;
    const dv = vSoll - vIst;
    return vIst + Math.sign(dv) * Math.min(Math.abs(dv), a * dt);
  };
  kran.vDreh = fahr(kran.dreh, zielDreh, kran.vDreh, DREH_V, 0.12);
  kran.vKatze = fahr(kran.r, zielR, kran.vKatze, KATZE_V, 1.6);
  kran.dreh += kran.vDreh * dt; kran.r += kran.vKatze * dt;
  if(Math.abs(kran.dreh - zielDreh) < 0.0006 && Math.abs(kran.vDreh) < 0.004){ kran.dreh = zielDreh; kran.vDreh = 0; }
  if(Math.abs(kran.r - zielR) < 0.01 && Math.abs(kran.vKatze) < 0.03){ kran.r = zielR; kran.vKatze = 0; }
  const Lalt = kran.L;
  kran.L = Math.max(SEIL_MIN, Math.min(SEIL_MAX, kran.L + seil * SEIL_V * dt));
  // Pendel: Beschleunigung des Aufhaengepunkts treibt es an (ruckartig = Schwingen), Wind ebenso.
  // Tangentiale Beschleunigung des Aufhaengepunkts = r * Winkelbeschleunigung
  const aTang = kran.r * (kran.vDreh - (kran._vDreh || 0)) / Math.max(dt, 1e-4);
  const aRad  = (kran.vKatze - (kran._vKatze || 0)) / Math.max(dt, 1e-4);
  kran._vDreh = kran.vDreh; kran._vKatze = kran.vKatze;
  // Wind in Ausleger-Koordinaten zerlegen
  const w = windJetzt();
  const ca = Math.cos(kran.dreh), sa = Math.sin(kran.dreh);
  const wR = (WIND_DIR.x * ca + WIND_DIR.z * sa) * w, wT = (-WIND_DIR.x * sa + WIND_DIR.z * ca) * w;
  const g = 9.81, L = kran.L;
  // Ohne Last haengt der Haken senkrecht (Live-Test: sein Pendeln kostete nur Zeit). Ganz oben (kurzes
  // Seil) haengt die Last fest unter der Katze – erst beim Absenken kann sie schwingen. So kann man
  // oben auf die Flaute warten und dann senkrecht ablassen.
  const FEST_L = SEIL_MIN + 2;
  if(!kran.haengt || L <= FEST_L){
    const k = Math.min(1, (kran.haengt ? 6 : 10) * dt);
    kran.phiR -= kran.phiR * k; kran.phiT -= kran.phiT * k; kran.wR = 0; kran.wT = 0;
    return;
  }
  // Uebergang: knapp unter der Festhaltung stark gedaempft, dann normal
  const nahOben = Math.max(0, 1 - (L - FEST_L) / 6);
  const daempf = DAEMPF + DAEMPF_KURZ / L + nahOben * 1.5;
  kran.wR += (-(g / L) * Math.sin(kran.phiR) - (aRad - wR) / L * Math.cos(kran.phiR) - daempf * kran.wR) * dt;
  kran.wT += (-(g / L) * Math.sin(kran.phiT) - (aTang - wT) / L * Math.cos(kran.phiT) - daempf * kran.wT) * dt;
  // Gegen den Wind drehen bremst das Nachschwingen (Konzept): wenn Drehrichtung gegen den Wind
  if(Math.abs(kran.vDreh) > 0.01 && Math.sign(kran.vDreh * kran.r) === -Math.sign(wT)) kran.wT *= Math.max(0, 1 - Math.abs(wT) * 0.6 * dt);
  // Seil einziehen: der Winkel bleibt, der Ausschlag in Metern (L * phi) schrumpft mit – so beruhigt
  // Hochziehen. (Vorher wurde hier die Winkelgeschwindigkeit hochgerechnet: das pumpte Schwung hinein.)
  kran.phiR += kran.wR * dt; kran.phiT += kran.wT * dt;
  kran.phiR = Math.max(-0.6, Math.min(0.6, kran.phiR)); kran.phiT = Math.max(-0.6, Math.min(0.6, kran.phiT));
}
// Pendel ruhig? (Ausschlag + Bewegung klein)
// Ruhig = kaum Bewegung UND nah an der Lage, in die der Wind den Container gerade drueckt. Gegen die
// Senkrechte gemessen war das bei Wind nie erreichbar (Live-Test: man konnte nie setzen).
function windLage(){
  const w = windJetzt(), ca = Math.cos(kran.dreh), sa = Math.sin(kran.dreh), g = 9.81;
  return { r: Math.atan((WIND_DIR.x * ca + WIND_DIR.z * sa) * w / g), t: Math.atan((-WIND_DIR.x * sa + WIND_DIR.z * ca) * w / g) };
}
function ruhig(){
  const s = windLage();
  return Math.abs(kran.L * (kran.phiR - s.r)) < 0.3 && Math.abs(kran.L * (kran.phiT - s.t)) < 0.3
    && Math.abs(kran.L * kran.wR) < 0.25 && Math.abs(kran.L * kran.wT) < 0.25;
}
function steht(){ return Math.abs(kran.vDreh) < 0.003 && Math.abs(kran.vKatze) < 0.03; }

// Wo steht die Unterkante des haengenden Containers auf? (Deck mit Ladung, Kai, Wasser)
function aufsetzHoehe(x, z){
  if(imSchiff(x, z)){
    for(const p of hafen.plaetze) if(Math.hypot(p.x - x, p.z - z) < CONT.b * 0.9) return p.y + CONT.h / 2;
    for(const c of kran.lager) if(c.fertig && Math.hypot(c.obj.position.x - x, c.obj.position.z - z) < CONT.b * 0.9) return c.obj.position.y + CONT.h / 2;
    return DECK_Y;
  }
  if(x < KAI_X) return KAI_Y;
  return -2;
}
// Haken nah genug ueber einem Lager-Container? (waagerecht 2 m, hoechstens 3 m ueber der Oberkante)
// Haken ueber einem Lager-Container: auf dessen Rasterpunkt (2,5 m Spiel) und hoechstens 4 m ueber
// der Oberkante. Kein Pendeln ohne Last, also ist das sicher erreichbar (Live-Test: vorher Glueckssache).
function greifbar(c, h){
  const p = c.obj.position, oben = p.y + CONT.h / 2;
  return Math.hypot(p.x - h.x, p.z - h.z) < 2.5 && h.y - oben < 4 && h.y > oben - 0.5;
}
const SEIL_GREIFEN = 31, SEIL_UEBER_LADUNG = 24, SEIL_IN_LUECKE = 26.5;
// Abstand: Haken (ohne Last) bzw. Container-Unterkante (mit Last) zu dem, was darunter liegt
function hoeheUeberGrund(){
  const h = hakenPos();
  if(kran.haengt){ const c = kran.haengt.obj.position; return c.y - CONT.h / 2 - aufsetzHoehe(c.x, c.z); }
  let unter = aufsetzHoehe(h.x, h.z);
  for(const c of kran.lager){ if(c.fertig || c === kran.haengt) continue;
    const q = c.obj.position; if(Math.hypot(q.x - h.x, q.z - h.z) < 2.5) unter = Math.max(unter, q.y + CONT.h / 2); }
  return h.y - unter;
}
function hoeheHtml(){
  const a = Math.max(0, hoeheUeberGrund());
  const f = a < 0.4 ? '#2ecc40' : a < 3 ? '#ffd23f' : '#fff';
  return '<span>Seil ' + kran.L.toFixed(1) + ' m</span><span>' + (kran.haengt ? '📦' : '🪝') + ' <span style="font-size:22px;color:' + f + '">'
    + (a < 0.4 ? 'aufgesetzt' : '↕ ' + a.toFixed(1) + ' m') + '</span></span>';
}
function greifHinweis(){
  if(!kran.laeuft) return '';
  const h = hakenPos();
  if(kran.haengt) return '';
  for(const c of kran.lager){
    if(c.fertig || c.ziel) continue;
    const p = c.obj.position;
    if(Math.hypot(p.x - h.x, p.z - h.z) >= 2.5) continue;
    if(greifbar(c, h)) return 'B: anhängen';
    return '▼ tiefer';                         // ueber einem Container, aber noch zu hoch
  }
  return '';
}
// B: greifen / loesen
function kranB(){
  if(!kran.aktiv || !kran.laeuft) return;
  const h = hakenPos();
  if(!kran.haengt){
    // greifen: Haken knapp ueber einem Lager-Container
    for(const c of kran.lager){
      if(c.fertig || c.ziel) continue;
      const p = c.obj.position;
      if(greifbar(c, h)){
        kran.haengt = c; c.ziel = 'haengt';
        story.sprich(['Angehängt.'], null, 'pilot');
        return;
      }
    }
    return;
  }
  // loesen: in einer Luecke? sanft aufgesetzt? ruhig?
  const c = kran.haengt, p = c.obj.position;
  const unten = p.y - CONT.h / 2, boden = aufsetzHoehe(p.x, p.z);
  const hoehe = unten - boden;
  const luecke = LUECKEN.find(l => !l.belegt && Math.hypot(l.x - p.x, l.z - p.z) < Math.max(l.tol, 1.4) + 1.2);
  kran.haengt = null;
  if(!luecke){
    // irgendwo abgesetzt: zurueck auf den Lagerplatz (nicht verloren), 1 Fehler wenn es faellt
    if(hoehe > 0.6){ fehler('Container fallen gelassen'); }
    c.ziel = null; legeZurueck(c);
    return;
  }
  const abstand = Math.hypot(luecke.x - p.x, luecke.z - p.z);
  // Jeder Versuch kostet hoechstens EINEN Fehler (vorher konnten "daneben" und "fallen gelassen"
  // zusammenkommen).
  if(luecke.weit){
    // Windtrick (Konzept): der Wind bringt den Container nur in die Naehe, dann faellt er schraeg in die
    // Luecke – das ist ein Fehler, aber er SITZT. Live-Test: vorher wurde er bei > 1,2 m zurueckgesetzt.
    if(abstand > 2.2){ fehler('daneben – Container stößt an'); c.ziel = null; legeZurueck(c); return; }
    if(abstand > luecke.tol * 0.5 || hoehe > 0.8) fehler('fallen gelassen');
  } else {
    if(abstand > luecke.tol){ fehler('daneben – Container stößt an'); c.ziel = null; legeZurueck(c); return; }
    // praezise: nur bei Flaute und ruhig
    if(luecke.praezise && (Math.abs(windJetzt()) > 0.05 || !ruhig() || !steht())){
      fehler('zu unruhig für die enge Lücke'); c.ziel = null; legeZurueck(c); return;
    }
    if(hoehe > 0.8) fehler('zu hart aufgesetzt');
    else if(!ruhig() && !kran.aufgesetzt) fehler('pendelt noch beim Lösen');
  }
  if(kran.fertig) return;
  luecke.belegt = true; c.fertig = true; c.ziel = luecke.n;
  c.obj.position.set(luecke.x, DECK_Y + CONT.h / 2, luecke.z); c.obj.rotation.set(0, -luecke.grad * Math.PI / 180 + Math.PI / 2, 0);
  kran.voll++;
  if(kran.voll >= 4){ kranGeschafft(); return; }
  story.sprich([['Sehr gut, der erste sitzt!', 'Prima, schon zwei!', 'Klasse, nur noch einer!'][kran.voll - 1]], null, 'pilot');
}
function legeZurueck(c){
  const i = kran.lager.indexOf(c), p = STAPEL[i];
  c.obj.position.set(p.x, KAI_Y + CONT.h / 2, p.z); c.obj.rotation.set(0, -p.grad * Math.PI / 180 + Math.PI / 2, 0);
}
function fehler(grund){
  if(kran.fertig) return;
  kran.fehler++;
  if(typeof rumble === 'function') rumble(300, 0.8, 0.5);
  if(kran.fehler > FEHLER_MAX){ kranEnde(false, 'zu viele Fehler'); return; }
  story.sprich([grund.charAt(0).toUpperCase() + grund.slice(1) + '. ' + (kran.fehler === 1 ? 'Ein Fehler.' : 'Zwei Fehler – der nächste ist zu viel.')], null, 'pilot');
}

// ---- Ablauf -----------------------------------------------------------------------------------
const KRAN_TEXT = [
  'Hallo! Wir müssen vier Container auf das Schiff laden, und es weht ganz schön.',
  'Mit dem linken Stick drehst du den Ausleger, jedes Mal um fünf Grad. Mit der rechten Schultertaste fährt die Laufkatze einen Marker nach außen… mit der linken nach innen.',
  'Mit dem rechten Stick hebst und senkst du den Haken. Mit der Taste B hängst du einen Container an… oder löst ihn wieder.',
  'Der Container hängt am Seil wie eine Schaukel! Wer schnell hintereinander fährt, bringt ihn zum Pendeln. Ganz oben hängt er fest unter der Katze, dort beruhigt er sich sofort.',
  'Rechts siehst du den Ladeplan: das Schiff von oben, die vier Lücken… und wo dein Haken gerade ist. Dazu für jede Lücke Winkel und Marker. Mit der Taste P blendest du den Plan aus und ein.',
  'Oben siehst du, wie hoch dein Container über dem Ziel hängt. Grün heißt: perfekt aufgesetzt! Im Plan stehen die Seillängen zum Greifen und Absetzen.',
  'Sechs Minuten hast du Zeit… und höchstens zwei Fehler! Lass dir Zeit. Los geht\'s!',
];
function kranEinsteigen(){
  story.phase = 'kran';
  Object.assign(kran, { aktiv: true, fertig: false, laeuft: false, t: 0, fehler: 0, voll: 0, dreh: 0, r: 16, L: 20,
    phiR: 0, phiT: 0, wR: 0, wT: 0, haengt: null, vDreh: 0, vKatze: 0, _vDreh: 0, _vKatze: 0, plan: true,
    zielGrad: 0, zielM: 0, _dS: 0, _kS: 0 });
  kran.r = rVon(kran.zielM);
  for(const l of LUECKEN) l.belegt = false;
  for(const c of kran.lager){ c.fertig = false; c.ziel = null; legeZurueck(c); }
  wind.t = 0; wind.richtung = 1;
  // Kenji steigt "in den Kran" – zu Fuss bleibt er in der Kabine (unsichtbar), gesteuert wird der Kran
  story.kenjiVersteckt = true; if(eva) eva.group.visible = false;
  story.hinweis('');
  kranHud(); planZeigen();
  kran.rede = story.sprich(KRAN_TEXT, () => {
    kran.laeuft = true;
    story.hinweis('Vier Container aufs Schiff – B: anhängen / lösen');
    story.spaeter(8, () => { if(kran.aktiv) story.hinweis(''); });
  }, 'pilot');
}
function kranGeschafft(){
  if(kran.fertig) return;
  kran.laeuft = false;
  story.sprich(['Großartig! Alle vier Container sind an Bord. Das war echte Geduldsarbeit!'], () => kranEnde(true, 'mit dem Kran', true), 'pilot');
}
function kranEnde(ok, wie, schonGesagt){
  if(kran.fertig) return;
  kran.fertig = true; kran.laeuft = false;
  if(kran.rede) kran.rede.abbrechen();
  const weiter = () => story.spaeter(1, () => {
    kran.aktiv = false; kranHud(); planZeigen();
    story.kenjiVersteckt = false; if(eva) eva.group.visible = true;
    story.hinweis('');
    story.etappeEnde(ok ? 4 : 7, wie);
  });
  if(schonGesagt){ weiter(); return; }
  story.sprich([wie === 'Zeit abgelaufen' ? 'Oh, die Zeit ist um. Das Schiff muss ohne die Container auslaufen.'
                                          : 'Oh nein, das waren zu viele Fehler. Wir brechen ab.'], weiter, 'pilot');
}

// ---- HUD: Pendel, Winkel, Wind, Seil, Fehler, Zeit, Zaehler + Ladeplan -----------------------
function kranHud(){
  if(!kran.hudEl){
    kran.hudEl = document.createElement('div'); kran.hudEl.dataset.etappeHud = '1';
    kran.hudEl.style.cssText = 'position:absolute;left:50%;top:56px;transform:translateX(-50%);display:flex;gap:16px;align-items:center;'
      + 'padding:8px 16px;border-radius:10px;background:rgba(0,0,0,.72);color:#fff;font:600 18px system-ui,sans-serif;pointer-events:none;z-index:20;white-space:nowrap;';
    document.body.appendChild(kran.hudEl);
  }
  if(!kran.aktiv){ kran.hudEl.style.display = 'none'; return; }
  kran.hudEl.style.display = 'flex';
  const rest = Math.max(0, ZEIT_MAX - kran.t);
  const zeit = '<span style="color:' + (rest < 20 ? '#ff5a3c' : rest < 45 ? '#ffd23f' : '#fff') + '">' + Math.ceil(rest) + ' s</span>';
  const w = windJetzt(), st = Math.round(Math.abs(w) / WIND_MAX * 5);
  const windTxt = (w < -0.02 ? '◀' : w > 0.02 ? '▶' : '·') + ' ' + '█'.repeat(st) + '░'.repeat(5 - st);
  // Pendel-Punkt in einem Kreis (gruen = ruhig)
  const wl = windLage();
  const px = Math.max(-1, Math.min(1, kran.L * (kran.phiT - wl.t) / 2)) * 11, py = Math.max(-1, Math.min(1, kran.L * (kran.phiR - wl.r) / 2)) * 11;
  const farbe = ruhig() ? '#2ecc40' : '#ffb000';
  const pendel = '<span style="position:relative;display:inline-block;width:28px;height:28px;border:2px solid #fff;border-radius:50%">'
    + '<span style="position:absolute;left:' + (11 + px).toFixed(0) + 'px;top:' + (11 + py).toFixed(0) + 'px;width:6px;height:6px;border-radius:50%;background:' + farbe + '"></span></span>';
  const fehlerTxt = '●'.repeat(kran.fehler) + '○'.repeat(Math.max(0, FEHLER_MAX - kran.fehler));
  const winkel = kran.zielGrad;
  const gh = greifHinweis();
  const gross = 'font-size:24px;color:#ffd23f;font-variant-numeric:tabular-nums';
  const html = (gh ? '<b style="color:#ffd23f">' + gh + '</b>' : '') + pendel
    + '<span style="' + gross + '">' + (winkel > 0 ? '+' : '') + winkel + '°</span>'
    + '<span>Marker <span style="' + gross + '">' + kran.zielM + '</span></span>' + hoeheHtml()
    + '<span>Wind ' + windTxt + '</span><span>📦 ' + kran.voll + '/4</span><span>' + fehlerTxt + '</span><span>⏱ ' + zeit + '</span>';
  if(kran.hudEl._h !== html){ kran.hudEl.innerHTML = html; kran.hudEl._h = html; }
}
// Ladeplan als Draufsicht: man sieht direkt, wo Ausleger und Haken stehen und wo die Luecken liegen.
// Gemalt wird aus Sicht des Kranfuehrers (Turm unten, Schiff oben, rechts = Stick rechts).
// Darunter je Luecke Winkel und Marker. Wie man eine Luecke schafft (Flaute, Windtrick), steht hier
// bewusst nicht – das soll Kenji selbst herausfinden (Konzept).
const PLAN_W = 260, PLAN_H = 250;
function planZeigen(){
  if(!kran.planEl){
    kran.planEl = document.createElement('div');
    kran.planEl.style.cssText = 'position:absolute;right:12px;top:290px;padding:10px;border-radius:10px;background:rgba(10,25,40,.82);'
      + 'color:#fff;font:600 15px/1.45 system-ui,sans-serif;pointer-events:none;z-index:19;';
    kran.planEl.innerHTML = '<div style="margin-bottom:6px">📋 Ladeplan <span style="opacity:.6;font-weight:400">(P)</span></div>'
      + '<canvas width="' + PLAN_W + '" height="' + PLAN_H + '" style="display:block;border-radius:6px"></canvas><div class="pl"></div>';
    document.body.appendChild(kran.planEl);
    kran.planCv = kran.planEl.querySelector('canvas');
    kran.planTxt = kran.planEl.querySelector('.pl');
  }
  if(!kran.aktiv || !kran.plan){ kran.planEl.style.display = 'none'; return; }
  kran.planEl.style.display = '';
  const g = kran.planCv.getContext('2d');
  // Weltkoordinaten -> Bild: Turm unten Mitte, +x (zum Schiff) nach oben, +z nach RECHTS – so wie die
  // Kamera hinter dem Turm es zeigt (Blick Richtung +x, rechts = +z). Vorher gespiegelt.
  const S = 4.6, ox = PLAN_W / 2, oy = PLAN_H - 18;
  const P = (x, z) => [ox + z * S, oy - x * S];
  g.clearRect(0, 0, PLAN_W, PLAN_H);
  g.fillStyle = '#163650'; g.fillRect(0, 0, PLAN_W, PLAN_H);
  // Kai (unten) und Kaikante
  const [, kaiY] = P(KAI_X, 0);
  g.fillStyle = '#5a5650'; g.fillRect(0, kaiY, PLAN_W, PLAN_H - kaiY);
  // Laderaum mit Raster
  // Ladung: genau die Plaetze, die wirklich belegt sind (hafen.plaetze)
  // Container als gedrehtes Rechteck (laengs zum Strahl): im Bild zeigt der Strahl bei Winkel g um g aus
  // der Senkrechten (oben = +x) nach rechts
  const box = (x, z, grad, fuell, rand) => {
    const [cx, cy] = P(x, z);
    g.save(); g.translate(cx, cy); g.rotate(grad * Math.PI / 180);
    g.fillStyle = fuell; g.fillRect(-CONT.b * S / 2, -CONT.l * S / 2, CONT.b * S, CONT.l * S);
    if(rand){ g.strokeStyle = rand; g.lineWidth = 2; g.strokeRect(-CONT.b * S / 2, -CONT.l * S / 2, CONT.b * S, CONT.l * S); }
    g.restore();
  };
  for(const q of hafen.plaetze) box(q.x, q.z, q.grad, '#6b5a4a');
  for(const l of LUECKEN){
    box(l.x, l.z, l.grad, l.belegt ? '#2e9e4a' : '#0b1a26', l.belegt ? null : '#ffd23f');
    if(!l.belegt){ const [cx, cy] = P(l.x, l.z); g.fillStyle = '#ffd23f'; g.font = 'bold 13px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(l.n), cx, cy + 1); }
  }
  // Marker-Boegen (duenn), damit man sieht, wo Marker 1..4 liegen
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
  for(let m = 0; m <= M_MAX; m++){ g.beginPath(); g.arc(ox, oy, rVon(m) * S, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9); g.stroke(); }
  // Drehbereich als Faecher
  g.fillStyle = 'rgba(255,210,63,0.10)'; g.beginPath(); g.moveTo(ox, oy);
  for(let a = -DREH_MAX; a <= DREH_MAX + 1e-6; a += DREH_MAX / 12){ const [qx, qy] = P(Math.cos(a) * KATZE_MAX, Math.sin(a) * KATZE_MAX); g.lineTo(qx, qy); }
  g.closePath(); g.fill();
  // Ausleger und Haken
  const ca = Math.cos(kran.dreh), sa = Math.sin(kran.dreh);
  const [ex, ey] = P(ca * (KATZE_MAX + 3), sa * (KATZE_MAX + 3));
  g.strokeStyle = '#f2c200'; g.lineWidth = 3; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex, ey); g.stroke();
  const h = hakenPos();
  const [hx, hy] = P(h.x, h.z);
  g.fillStyle = kran.haengt ? '#ff8a3c' : '#fff'; g.beginPath(); g.arc(hx, hy, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f2c200'; g.fillRect(ox - 5, oy - 5, 10, 10);
  // Lager-Container (am Kai) als Rechtecke
  kran.lager.forEach((c, i) => { if(c.fertig || c === kran.haengt) return; box(c.obj.position.x, c.obj.position.z, STAPEL[i].grad, '#c96a2b'); });
  // Liste: Winkel + Marker je Luecke (genau die Rasterwerte), dazu der Lagerplatz
  const vz = n => (n > 0 ? '+' : '') + n;
  const txt = LUECKEN.map(l => '<div style="opacity:' + (l.belegt ? 0.45 : 1) + '">' + (l.belegt ? '✔' : '▢') + ' <b style="color:#ffd23f">' + l.n + '</b>  '
      + vz(l.grad) + '° · Marker ' + l.m + '</div>').join('')
    + '<div style="opacity:.75;margin-top:4px">Lager: ' + STAPEL.map(s => vz(s.grad) + '°').join(' ') + ' · Marker 0</div>'
    + '<div style="opacity:.75;margin-top:6px;border-top:1px solid rgba(255,255,255,.2);padding-top:4px">Seil: greifen ' + SEIL_GREIFEN + ' m · über Ladung bis ' + SEIL_UEBER_LADUNG + ' m · in der Lücke ' + SEIL_IN_LUECKE + ' m</div>';
  if(kran.planTxt._h !== txt){ kran.planTxt.innerHTML = txt; kran.planTxt._h = txt; }
}

// ---- Darstellung: Kranteile, Seil, haengender Container ---------------------------------------
function kranZeigen(){
  if(!hafen.kran) return;
  if(hafen.dreh) hafen.dreh.rotation.y = -kran.dreh;
  // Laufkatze im Modell entlang x verschieben (Modelleinheiten)

  const h = hakenPos();
  const oben = new THREE.Vector3(h.ax, h.ay, h.az), unten = new THREE.Vector3(h.x, h.y, h.z);
  const mitte = oben.clone().add(unten).multiplyScalar(0.5);
  hafen.seil.position.copy(mitte);
  hafen.seil.scale.set(1, oben.distanceTo(unten), 1);
  hafen.seil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), oben.clone().sub(unten).normalize());
  hafen.haken.position.copy(unten);
  if(hafen.katze2){ hafen.katze2.position.set(h.ax, h.ay + 0.7, h.az); hafen.katze2.rotation.y = -kran.dreh; }
  if(kran.haengt){
    const c = kran.haengt.obj;
    // Unterkante darf nicht durch Deck/Ladung/Kai: Container setzt auf und das Seil wird schlaff
    let y = h.y - 0.3 - CONT.h / 2;
    const boden = aufsetzHoehe(h.x, h.z) + CONT.h / 2;
    if(y < boden){ y = boden; kran.wR *= 0.85; kran.wT *= 0.85; kran.aufgesetzt = true; } else kran.aufgesetzt = false;
    c.position.set(h.x, y, h.z);
    c.rotation.set(kran.phiR * 0.3, -kran.dreh + Math.PI / 2, kran.phiT * 0.3);
  }
}
// Kamera: hinter und ueber dem Haken, Blick auf Haken/Ziel, folgt dem Ausleger
function kranKamera(){
  const h = hakenPos();
  const ca = Math.cos(kran.dreh), sa = Math.sin(kran.dreh);
  // hinter dem Turm (gegenueber dem Ausleger), etwas seitlich und ueber dem Ausleger: man sieht den
  // Ausleger schraeg, die Laufkatze, das Seil und das Deck darunter
  const qx = -sa, qz = ca;                                     // quer zum Ausleger
  const soll = new THREE.Vector3(-ca * 22 + qx * 9, KAI_Y + TURM_Y + 12, -sa * 22 + qz * 9);
  camera.position.lerp(soll, Math.min(1, 3 * (dtCam || 0.016)));
  camera.up.set(0, 1, 0);
  camera.lookAt(h.x, Math.max(DECK_Y, h.y - 4), h.z);
}

// ---- Ankunft ---------------------------------------------------------------------------------
const ANKUNFT = { x: -30, z: -30 };
const SCHNELLBOOT = { x: 12, z: -110 };           // Ring am Kai, das Boot liegt davor im Becken (etappe4b.js)
function hafenStart(){
  _islandInfoCalc = function(){ return null; };
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear(); _wreckCache.clear();
  refreshIslands();
  if(typeof clearSeaShips === 'function') clearSeaShips();
  if(typeof clearOrcas === 'function') clearOrcas();
  if(typeof clearUwCells === 'function') clearUwCells();
  if(typeof clearFish === 'function') clearFish();
  seabedMesh.visible = false;
  if(story.e1aufraeumen) story.e1aufraeumen();
  story.weltEntsorgen(2); story.weltEntsorgen(3);
  if(typeof clearArrows === 'function') clearArrows();
  if(typeof clearFire === 'function') clearFire();
  baueHafen();
  if(story.fluchtKulisse) story.fluchtKulisse();
  if(locale !== 'earth') enterEarth();
  // Flieger/Boot: Kenji kommt zu Fuss an, das Fahrzeug der Reise (X-Wing) steht abseits auf dem Kai
  clearEva();
  currentModel = MODEL_NAMES.indexOf('XWing');
  buildModel('XWing'); spec = PLANE_SPECS.XWing || DEFAULT_SPEC;
  state.pos.set(-80, KAI_Y, 80);
  state.quat.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  planeGroup.visible = false;                       // in Etappe 4 gibt es keinen eigenen Flieger
  ground.position.set(0, 0, 0); updateBoden4(true);
  evaExit();
  eva.group.position.set(ANKUNFT.x, KAI_Y, ANKUNFT.z);
  const mx = 0 - ANKUNFT.x, mz = (SCHNELLBOOT.z + 0) / 2 - ANKUNFT.z;
  eva.yaw = Math.atan2(-mx, -mz); eva.group.rotation.y = eva.yaw;
  evaOrbit = 0; evaPitch = 0;
  snapCamera();
  hafen.ring = story.einstiegsRing(-6, KAI_Y, -4);   // Einstieg Kran: gelber Ring am Kranfuss
  hafen.ringBoot = story.einstiegsRing(SCHNELLBOOT.x - 6, KAI_Y, SCHNELLBOOT.z);
  marken.length = 0;
  story.phase = null;
  story.ende = false;
  kran.aktiv = false; kran.fertig = false;
  story.hinweis('Zwei Wege: Schnellboot (weiß) oder Container-Kran (gelber Ring) – hinlaufen und Y drücken');
  story.spaeter(12, () => { if(eva && !story.phase) story.hinweis(''); });
}
story.etappe4Start = hafenStart;

const marken = [];
function updateMarken(){
  if(!marken.length && story.baueMarke){
    marken.push({ m: story.baueMarke(0xffffff, '1 Tag'),  x: SCHNELLBOOT.x - 6, z: SCHNELLBOOT.z, h: 0 });   // h = Oberkante ueber Kai (Ring; Boot liegt tiefer)
    marken.push({ m: story.baueMarke(0xffd23f, '4 Tage'), x: -6, z: -4, h: 4.1 });
  }
  const zeigen = e4() && !!eva && locale === 'earth' && !story.phase;
  for(const o of marken) story.setzeMarke(o.m, o.x, KAI_Y, o.z, o.h, zeigen);
}
function kranNah(){ return !!(e4() && !story.phase && hafen.ring && hafen.ring.drin()); }
function bootNah4(){ return !!(e4() && !story.phase && hafen.ringBoot && hafen.ringBoot.drin()); }
story.kranNah = kranNah;
story.bootNah4 = bootNah4;

// ---- Hooks ------------------------------------------------------------------------------------
function hookKran(){
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(hier() && kranNah()){ kranEinsteigen(); return; }

    return boardYOrig.apply(this, arguments);
  };
  // Kran steuert statt Kenji: Eingabe nehmen, Kenji nicht laufen lassen
  const evaOrig = updateEva;
  updateEva = function(dt, inp){
    if(hier() && kran.aktiv){
      if(kran.laeuft || (!kran.fertig && kran.haengt)) kranPhysik(dt, inp || { yaw: 0, pitch: 0 });
      else if(!kran.laeuft && !kran.fertig) { /* Erklaerung: Kran steht */ }
      if(kran.laeuft){ kran.t += dt; windTick(dt); if(kran.t >= ZEIT_MAX) kranEnde(false, 'Zeit abgelaufen'); }
      else if(!kran.fertig) windTick(dt);           // Wind laeuft auch waehrend der Erklaerung (zum Zuschauen)
      kranZeigen(); kranHud(); planZeigen();
      return;
    }
    return evaOrig.apply(this, arguments);
  };
  const camOrig = updateCamera;
  updateCamera = function(){ if(hier() && kran.aktiv){ kranKamera(); return; } return camOrig.apply(this, arguments); };
  // B = greifen/loesen, Y = (in der Aufgabe kein Aussteigen)
  const bOrig = buttonB;
  buttonB = function(){ if(hier() && kran.aktiv){ kranB(); return; } return bOrig.apply(this, arguments); };
  const yOrig = buttonY;
  buttonY = function(){ if(hier() && kran.aktiv) return; return yOrig.apply(this, arguments); };
  // Ladeplan: P / D-Pad links (dort liegt sonst die Aufgabe – im Kran ersetzt der Plan sie)
  addEventListener('keydown', e => { if(e.code === 'KeyP' && !e.repeat && hier() && kran.aktiv){ kran.plan = !kran.plan; planZeigen(); } });
  // Radar: zu Fuss Boot (weiss) und Kran (gelb)
  const footOrig = footTargets;
  footTargets = function(){
    if(!hier() || story.phase) return footOrig();
    return [{ x: SCHNELLBOOT.x - 6, z: SCHNELLBOOT.z, col: '#ffffff' }, { x: -6, z: -4, col: '#ffd23f' }];
  };
}

function updateE4(dt){
  story.etappenMusik(4, window.MUSIK_SND && window.MUSIK_SND.e4, dt || 0);   // story.js: zu Beginn leise, wie Etappe 2
  if(!e4()) return;
  updateMarken();
  if(hafen.ring) hafen.ring.zeigen(!!eva && locale === 'earth' && !story.phase);
  if(hafen.ringBoot) hafen.ringBoot.zeigen(!!eva && locale === 'earth' && !story.phase);
  if(!kran.aktiv) kranZeigen();
  updateMoewen(dt || 0);
  if(story.meerSchiffe4 && locale === 'earth') story.meerSchiffe4(dt);
}
story.updateE4 = updateE4;
story.aufgabeE4 = () => (story.aufgabeE4b && story.aufgabeE4b()) || (kran.aktiv ? ['Container-Kran', [
  ['Ziel', '4 Container aufs Schiff (' + kran.voll + '/4)'],
  ['Zeit', kran.laeuft ? Math.max(0, Math.ceil(ZEIT_MAX - kran.t)) + ' s übrig' : '6 Minuten'],
  ['Fehler', kran.fehler + ' von ' + FEHLER_MAX + ' erlaubt'],
  ['Ruhig', 'Pendel-Punkt grün = Container hängt still'],
  ['Plan', 'P: Ladeplan ein- und ausblenden'],
]] : null);

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookWelt4();
  hookKran();
};
})();
