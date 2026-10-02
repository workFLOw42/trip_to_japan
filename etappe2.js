// Trip to Japan – Etappe 2: Die Wüste (Flugschule & X-Wing-Falle).
// Laedt nach story.js, vor der Engine. Haengt sich in dieselben Hooks wie story.js, aktiv erst, wenn
// story.etappe === 2 (nach der Globus-Reise aus Etappe 1).
// Welt: nur Wueste, kein Wasser. Das Meeresgitter der Engine (6 x 6 km, folgt dem Spieler) wird zum
// Sandboden mit Duenen; Land ist ueberall. Flugfeld am Ursprung, Oase als Abwurfziel.
(function(){
'use strict';
const story = window.STORY;

// ---- Gelaende -------------------------------------------------------------------------------
const FELD_R   = 450;        // m um den Ursprung: flaches Flugfeld (Bahn, Abstellplatz)
const FELD_RAND = 250;       // m Uebergang Flugfeld -> Duenen
const DUENE_H  = 14;         // m Duenenhoehe (Amplitude)
const OASE     = { x: 600, z: -3200, r: 70 };   // Abwurfziel: Wasserstelle mit Palmen
const OASE_RAND = 160;       // m flacher Bereich um die Oase

function e2(){ return story.etappe === 2; }

// Duenenhoehe an (x, z): zwei Wellenzuege, flach am Flugfeld und an der Oase
function duene(x, z){
  const r0 = Math.hypot(x, z);
  const ro = Math.hypot(x - OASE.x, z - OASE.z);
  const f0 = Math.min(1, Math.max(0, (r0 - FELD_R) / FELD_RAND));
  const fo = Math.min(1, Math.max(0, (ro - OASE_RAND) / 120));
  const f = Math.min(f0, fo);
  if(f <= 0) return 0;
  // Grosse Duenenzuege (0..1) plus kleine Riffel; immer >= 0, damit nirgends Loecher entstehen
  const gross = 0.5 + 0.5 * Math.sin(x * 0.0061 + Math.sin(z * 0.0023) * 2.1);
  const quer  = 0.5 + 0.5 * Math.sin(z * 0.0047 + x * 0.0019);
  const riffel = 0.5 + 0.5 * Math.sin((x * 0.8 + z) * 0.021);
  return (gross * gross * 0.65 + quer * 0.25 + riffel * 0.1) * DUENE_H * f;
}
story.duene = duene;

const SAND_HELL  = new THREE.Color(0xc9a46a);   // dunkel gewaehlt: das Licht (hemi 1,0 + Sonne) hellt stark auf
const SAND_DUNKEL = new THREE.Color(0x7e5a30);
const _c2 = new THREE.Color();
let sandFertig = false;
function updateSand(){
  const ox = ground.position.x, oz = ground.position.z;
  for(let i = 0; i < seaPos.count; i++){
    const wx = seaBaseX[i] + ox, wz = seaBaseZ[i] + oz;
    const y = duene(wx, wz);
    seaPos.setY(i, y);
    // Hoehe hell/dunkel und Hangneigung (Licht von Westen): so sieht man die Duenen auch ohne Schatten
    const hang = (duene(wx + 6, wz) - duene(wx - 6, wz)) / 12;
    const k = Math.max(0, Math.min(1, y / DUENE_H * 0.55 + 0.45 - hang * 4.5));
    _c2.copy(SAND_DUNKEL).lerp(SAND_HELL, k);
    seaCol.setXYZ(i, _c2.r, _c2.g, _c2.b);
  }
  seaPos.needsUpdate = true; seaCol.needsUpdate = true;
  seaGeo.computeVertexNormals();
  sandFertig = true;
}

// ---- Kulisse: Flugfeld, Felsen, Kakteen, Oase ------------------------------------------------
const kulisse = { gruppe: null };
function baueKulisse(){
  if(kulisse.gruppe) return;
  const g = new THREE.Group();
  const bahnMat = new THREE.MeshLambertMaterial({ color: 0x8a8274 });
  const bahn = new THREE.Mesh(new THREE.PlaneGeometry(40, 600), bahnMat);
  bahn.rotation.x = -Math.PI / 2; bahn.position.set(18, 0.05, 0); g.add(bahn);
  const strich = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  for(let z = -280; z <= 280; z += 40){
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 18), strich);
    s.rotation.x = -Math.PI / 2; s.position.set(18, 0.07, z); g.add(s);
  }
  // kleiner Tower
  const tw = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 8), new THREE.MeshLambertMaterial({ color: 0xd8cbb0 }));
  tw.position.set(130, 7, 120); g.add(tw);
  const kanzel = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 10), new THREE.MeshLambertMaterial({ color: 0x4a6a80 }));
  kanzel.position.set(130, 16, 120); g.add(kanzel);
  // Felsen und Kakteen verstreut (fester Zufall)
  const fels = new THREE.MeshLambertMaterial({ color: 0xa47b52 });
  const kaktus = new THREE.MeshLambertMaterial({ color: 0x4f7a3a });
  let s = 17;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for(let i = 0; i < 140; i++){
    const a = rnd() * Math.PI * 2, r = FELD_R + 40 + rnd() * 2600;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if(Math.hypot(x - OASE.x, z - OASE.z) < OASE_RAND + 30) continue;
    if(rnd() < 0.6){
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rnd() * 6, 0), fels);
      m.position.set(x, duene(x, z) + 1, z); m.rotation.set(rnd(), rnd(), rnd()); g.add(m);
    } else {
      const k = new THREE.Group();
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), kaktus); st.position.y = 2.5; k.add(st);
      const ar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 2, 8), kaktus);
      ar.position.set(0.9, 3, 0); ar.rotation.z = -0.3; k.add(ar);
      k.position.set(x, duene(x, z), z); g.add(k);
    }
  }
  // Oase: Wasserstelle, Gras, Palmen, Zelte
  const o = new THREE.Group();
  const gras = new THREE.Mesh(new THREE.CircleGeometry(OASE.r + 35, 40), new THREE.MeshLambertMaterial({ color: 0x7fa34a }));
  gras.rotation.x = -Math.PI / 2; gras.position.y = 0.06; o.add(gras);
  const wasser = new THREE.Mesh(new THREE.CircleGeometry(OASE.r * 0.55, 40), new THREE.MeshLambertMaterial({ color: 0x2f8fc0 }));
  wasser.rotation.x = -Math.PI / 2; wasser.position.y = 0.1; o.add(wasser);
  const stamm = new THREE.MeshLambertMaterial({ color: 0x8b6a3e }), blatt = new THREE.MeshLambertMaterial({ color: 0x3f8a3a, side: THREE.DoubleSide });
  for(let i = 0; i < 14; i++){
    const a = i / 14 * Math.PI * 2 + rnd() * 0.3, r = OASE.r * (0.7 + rnd() * 0.5);
    const p = new THREE.Group();
    const h = 9 + rnd() * 5;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, h, 8), stamm);
    st.position.y = h / 2; st.rotation.z = (rnd() - 0.5) * 0.25; p.add(st);
    for(let b = 0; b < 7; b++){
      const bl = new THREE.Mesh(new THREE.ConeGeometry(0.8, 6, 4, 1, true), blatt);
      bl.position.y = h; bl.rotation.set(1.9, b / 7 * Math.PI * 2, 0); bl.translateY(2.6); p.add(bl);
    }
    p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); o.add(p);
  }
  const zeltM = new THREE.MeshLambertMaterial({ color: 0xf2e6c8 });
  for(let i = 0; i < 4; i++){
    const z = new THREE.Mesh(new THREE.ConeGeometry(5, 5, 4), zeltM);
    const a = 0.6 + i * 0.5;
    z.position.set(Math.cos(a) * (OASE.r + 22), 2.5, Math.sin(a) * (OASE.r + 22)); z.rotation.y = Math.PI / 4; o.add(z);
  }
  o.position.set(OASE.x, 0, OASE.z);
  g.add(o);
  scene.add(g);
  kulisse.gruppe = g;
}

// ---- Geparkte Fahrzeuge (Kulisse, bis man einsteigt) -----------------------------------------
// Der X-Wing ist das "eigene" Fahrzeug (state/planeGroup) und braucht keine Kulisse. Nur die
// Transall steht als Kulisse am Bahnende, bis man einsteigt.
// Ankunft wie in Etappe 1: Kenji schaut nach Norden (-Z), der X-Wing steht ~30 Grad links, die
// Transall ~30 Grad rechts vor ihm, je gut 100 m entfernt – keiner direkt voraus.
const ANKUNFT    = { x: 0, z: 380 };
const XWING_PARK = { x: -18, z: 320, yaw: Math.PI * 0.15 };   // 75 % naeher an der Transall als vorher (60 -> 18 m)
const PARK = {
  Transall: { x: 18, z: 320, yaw: 0, obj: null },   // Nase nach Norden (-Z), Bahn liegt laengs Z
};
story.e2xwing = XWING_PARK;
story.e2park = PARK;
function ladeKulissenModell(name, fertig){
  const def = GLB_CONFIG[name];
  const daten = def && def.data();
  if(!daten || !THREE.GLTFLoader) return;
  const b64 = daten.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (gltf) => {
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj), size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(def.span / Math.max(size.x, size.z));
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj), c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    const w = new THREE.Group(); w.add(obj);
    fertig(w);
  }, (e) => console.warn('Kulissenmodell ' + name, e));
}
function stelleFahrzeuge(){
  for(const name of Object.keys(PARK)){
    const p = PARK[name];
    if(p.obj){ p.obj.visible = MODEL_NAMES[currentModel] !== name || !!eva; continue; }
    ladeKulissenModell(name, (w) => {
      w.position.set(p.x, 0, p.z); w.rotation.y = p.yaw;
      scene.add(w); p.obj = w;
    });
  }
}

// ---- Sounds ---------------------------------------------------------------------------------
// Kein Meer und keine Moewen in der Wueste. Dafuer: Wuestenwind als Dauerloop in derselben
// Lautstaerke wie das Meeresrauschen (AMB_OCEAN_VOL) und zu Beginn ganz leise arabische Musik,
// bis sie zu Ende ist oder man einsteigt. Beide Dateien werden wie die Engine-Kulisse auf denselben
// Spitzenwert normiert (normalizePeak), die Lautstaerke steuert allein der Gain.
const MUSIK_VOL = 0.12;           // knapp unter dem Wind (AMB_OCEAN_VOL 0,13), sonst ging sie unter
const snd = { wind: null, windGain: null, musik: null, musikGain: null, musikAus: false, laedt: false };
function sndStart(url, loop, fertig){
  if(!audioCtx || !url) return;
  decodeSound(url).then((buf) => {
    normalizePeak(buf, 0.9);
    const s = audioCtx.createBufferSource(); s.buffer = buf; s.loop = loop;
    const g = audioCtx.createGain(); g.gain.value = 0;
    s.connect(g).connect(audioCtx.destination); s.start();
    fertig(s, g);
  }).catch((e) => console.warn('Wuesten-Sound:', e));
}
function updateWuesteSound(dt){
  if(!audioCtx || audioCtx.state !== 'running' || !window.WUESTE_SND) return;
  const an = e2() && locale === 'earth' && soundOn && !(story.globusAktiv && story.globusAktiv());
  if(e2() && !snd.laedt){
    snd.laedt = true;
    sndStart(window.WUESTE_SND.wind, true, (s, g) => { snd.wind = s; snd.windGain = g; });
    sndStart(window.WUESTE_SND.musik, false, (s, g) => { snd.musik = s; snd.musikGain = g; s.onended = () => { snd.musikAus = true; }; });
  }
  const k = Math.min(1, 0.7 * dt);
  if(snd.windGain){
    const y = eva ? eva.group.position.y : state.pos.y;
    const hoehe = 1 - Math.max(0, Math.min(1, (y - duene(state.pos.x, state.pos.z)) / AMB_MAX_Y));
    const ziel = an ? AMB_OCEAN_VOL * hoehe : 0;
    snd.windGain.gain.value += (ziel - snd.windGain.gain.value) * k;
  }
  if(snd.musikGain){
    if(!eva) snd.musikAus = true;                     // eingestiegen: Musik aus
    const ziel = an && !snd.musikAus ? MUSIK_VOL : 0;
    snd.musikGain.gain.value += (ziel - snd.musikGain.gain.value) * Math.min(1, (snd.musikAus ? 0.6 : 1.5) * dt);
    if(snd.musikAus && snd.musikGain.gain.value < 0.001 && snd.musik){ try { snd.musik.stop(); } catch(e){} snd.musik = null; }
  }
}

// ---- Welt umschalten -------------------------------------------------------------------------
function hookWelt2(){
  const isOnLandOrig = isOnLand, isOnBeachOrig = isOnBeach, surfaceYOrig = surfaceY,
        isOpenWaterOrig = isOpenWater, seaYAtOrig = seaYAt, seabedYOrig = seabedY,
        updateSeaOrig = updateSea, hitsBuildingOrig = hitsBuilding, evaFootYOrig = evaFootY;
  isOnLand    = function(x, z){ return e2() && locale === 'earth' ? true  : isOnLandOrig.apply(this, arguments); };
  isOnBeach   = function(x, z){ return e2() && locale === 'earth' ? false : isOnBeachOrig.apply(this, arguments); };
  isOpenWater = function(x, z){ return e2() && locale === 'earth' ? false : isOpenWaterOrig.apply(this, arguments); };
  surfaceY    = function(x, z){ return e2() && locale === 'earth' ? duene(x, z) : surfaceYOrig.apply(this, arguments); };
  evaFootY    = function(x, z){ return e2() && locale === 'earth' ? duene(x, z) : evaFootYOrig.apply(this, arguments); };
  // "Wasserhoehe" = weit unter dem Sand (kein Schwimmen, keine Wellen)
  seaYAt      = function(x, z, t){ return e2() && locale === 'earth' ? -500 : seaYAtOrig.apply(this, arguments); };
  seabedY     = function(x, z){ return e2() && locale === 'earth' ? -600 : seabedYOrig.apply(this, arguments); };
  // alle Argumente durchreichen: das 5. ist das Schiff, das sich selbst nicht treffen darf – mit nur
  // vier Argumenten stiess jedes Handelsschiff gegen sich selbst und drehte auf der Stelle
  hitsBuilding = function(){ return e2() && locale === 'earth' ? false : hitsBuildingOrig.apply(this, arguments); };
  const seaFloorNeededOrig = seaFloorNeeded, updateFishOrig = updateFish, updateReefFishOrig = updateReefFish,
        updateOrcasOrig = updateOrcas;
  seaFloorNeeded = function(){ return e2() && locale === 'earth' ? false : seaFloorNeededOrig(); };
  updateFish     = function(dt){ if(!(e2() && locale === 'earth')) return updateFishOrig(dt); };
  updateReefFish = function(dt){ if(!(e2() && locale === 'earth')) return updateReefFishOrig(dt); };
  updateOrcas    = function(dt){ if(!(e2() && locale === 'earth')) return updateOrcasOrig(dt); };
  // Kein KI-Luftverkehr in der Wueste: die Flotte sucht Inseln/Traeger zum Landen und stuerzte
  // sonst ab – ihre Absturzfeuer (flameMat) brannten dann auf dem Sand.
  const updateTrafficOrig = updateTraffic, updateFlybyOrig = updateFlyby;
  updateTraffic = function(dt){
    if(e2() && locale === 'earth'){
      if(fleet.length){ for(const e of fleet) removePlane(e); fleet.length = 0; }
      if(typeof clearAiEffects === 'function') clearAiEffects();
      return;
    }
    return updateTrafficOrig(dt);
  };
  updateFlyby = function(dt){ if(e2() && locale === 'earth'){ if(typeof clearFlyby === 'function') clearFlyby(); return; } return updateFlybyOrig(dt); };
  const updateAmbientOrig = updateAmbient;
  updateAmbient = function(dt){
    if(!(e2() && locale === 'earth')) return updateAmbientOrig(dt);
    const k = Math.min(1, AMB_RATE * dt);
    if(ambGullGain)  ambGullGain.gain.value  += (0 - ambGullGain.gain.value) * k;
    if(ambOceanGain) ambOceanGain.gain.value += (0 - ambOceanGain.gain.value) * k;
  };
  // keine Schiffe auf dem Sand
  const updateShipsSeaOrig = updateShipsSea;
  updateShipsSea = function(dt){ if(e2() && locale === 'earth'){ if(typeof clearSeaShips === 'function') clearSeaShips(); return; } return updateShipsSeaOrig(dt); };
  updateSea   = function(dt){
    if(!(e2() && locale === 'earth')) return updateSeaOrig.apply(this, arguments);
    updateSand();
  };
}

// Beim Wechsel nach Etappe 2: Insel-Welt leeren, Wueste aufbauen, Ankunft am Flugfeld
function wuesteStart(){
  // Inseln und alles Maritime weg (Etappe-1-Wracks sind schon ueber story.etappe abgeschaltet)
  _islandInfoCalc = function(){ return null; };
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear(); _wreckCache.clear();
  refreshIslands();
  if(typeof clearSeaShips === 'function') clearSeaShips();
  if(typeof clearOrcas === 'function') clearOrcas();
  if(typeof clearUwCells === 'function') clearUwCells();
  if(typeof clearFish === 'function') clearFish();
  seabedMesh.visible = false;
  if(story.schule){ scene.remove(story.schule); story.schule = null; }
  // Etappe-1-Kulissen (Ring, Marken, Stein) verbergen
  if(story.e1aufraeumen) story.e1aufraeumen();
  if(typeof clearArrows === 'function') clearArrows();
  if(typeof clearCargoTarget === 'function') clearCargoTarget();
  if(typeof clearFire === 'function') clearFire();
  baueKulisse();
  // Ankunft: X-Wing (bzw. das Fahrzeug, mit dem man kam) steht am Flugfeld, Kenji steigt aus
  if(locale !== 'earth') enterEarth();
  const idx = MODEL_NAMES.indexOf('XWing');
  clearEva();
  currentModel = idx;
  buildModel('XWing'); spec = PLANE_SPECS.XWing || DEFAULT_SPEC;
  state.pos.set(XWING_PARK.x, 0, XWING_PARK.z);
  state.quat.setFromEuler(new THREE.Euler(0, XWING_PARK.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  ground.position.set(0, 0, 0);
  updateSand();
  evaExit();
  eva.group.position.set(ANKUNFT.x, duene(ANKUNFT.x, ANKUNFT.z), ANKUNFT.z);
  // Blick genau auf die Mitte zwischen beiden Flugzeugen (Gesicht -Z: yaw = atan2(-dx, -dz))
  const mx = (XWING_PARK.x + PARK.Transall.x) / 2 - ANKUNFT.x, mz = (XWING_PARK.z + PARK.Transall.z) / 2 - ANKUNFT.z;
  eva.yaw = Math.atan2(-mx, -mz); eva.group.rotation.y = eva.yaw;
  evaOrbit = 0; evaPitch = 0;
  snapCamera();
  stelleFahrzeuge();
  story.e2marken = true;
  story.phase = null;
  story.ende = false;
  story.e2 = { start: performance.now() };
}
story.etappe2Start = wuesteStart;

// Ziel des Freiflugs pro Etappe (Radarpunkt): Etappe 2 = weiter Richtung Etappe 3 (Sueden)
const zielVorher = story.zielFuer;
story.zielFuer = function(et){ return et === 2 ? { x: 2500, z: 9000 } : (zielVorher ? zielVorher(et) : { x: 0, z: -9000 }); };

// Marken ueber den Fahrzeugen (wie Etappe 1): weiss = X-Wing, gelb = Transall
const e2m = [];
function e2Marken(){
  if(e2m.length || !story.baueMarke) return;
  e2m.push({ m: story.baueMarke(0xffffff, '1 Tag'),  x: XWING_PARK.x, z: XWING_PARK.z, h: 9 });
  e2m.push({ m: story.baueMarke(0xffd23f, '4 Tage'), x: PARK.Transall.x, z: PARK.Transall.z, h: 14 });
}
function updateE2Marken(){
  e2Marken();
  const zeigen = e2() && !!eva && locale === 'earth' && !story.phase;
  for(const o of e2m) story.setzeMarke(o.m, o.x, 0, o.z, o.h, zeigen);
}

// ---- Transall-Flugschule ---------------------------------------------------------------------
// Ablauf (story.phase = 'flugschule', fs.schritt):
//   erklaeren  – am Boden: Pilot erklaert Startsequenz, Kurzschluss-Symbol, Start, Hoehe, Abwurf, Landung
//   frage      – am Boden: "Du kannst doch fliegen?" [JA] / [NEIN] (Auswahl wie im Startmenue)
//                NEIN -> "Fuer Anfaenger ist das nichts, steig aus" -> 7 Tage -> Etappe 3
//   sequenz    – JA: Startsequenz OHNE Zeitlimit und ohne Kurzschluss (sicherer Weg, kein Scheitern)
//   flug       – Kenji fliegt selbst zur Oase (Radar), Hoehenband 270-330 m, B = Kiste abwerfen
//   abwurf     – Kiste faellt (voller Schwung, kurz frei, dann Schirm); Treffer +-50 m -> 4 Tage, sonst 7
// Landen muss man nicht – der Pilot erklaert es nur.
const FS_HOEHE = 300;          // m ueber Grund
const FS_TEXT = [
  'Hallo, willkommen an Bord! Ich bin dein Pilot. Wir bringen Hilfsgüter zu einer Oase in der Wüste. Pass gut auf, dann lernst du was.',
  'Vor jedem Flug machen wir die Startsequenz: Bremse halten, Ruder links und rechts, Nase hoch und runter, Bremse los, Gas geben.',
  'Leuchtet dabei dieses rote Symbol mit den zwei Pfeilen, hat der Flieger einen Kurzschluss. Dann ist alles vertauscht, und du musst umgekehrt steuern.',
  'Zum Starten gibst du nach der Startsequenz Vollgas. Ab etwa hundertfünfzig Kilometern pro Stunde ziehst du die Nase sanft hoch.',
  'Wir fliegen auf dreihundert Metern. Halte die Höhe zwischen zweihundertsiebzig und dreihundertdreißig.',
  'Die Kisten fallen mit unserem Schwung nach vorne. Je schneller wir sind, desto früher musst du sie abwerfen.',
  'Merk dir: Schub in Prozent mal fünf gleich Meter vor dem Ziel. Bei sechzig Prozent wirfst du also dreihundert Meter vorher ab, bei hundert Prozent fünfhundert Meter.',
  'Abgeworfen wird mit B. Die Entfernung zur Oase steht in der Anzeige.',
  'Und zum Landen: Gas auf etwa sechzig Prozent, langsam sinken, die Nase leicht oben halten. Nicht schneller als zweihundert Kilometer pro Stunde, und die Flügel gerade. Kurz vor dem Boden Gas weg, aufsetzen und bremsen.',
];
const fsch = story.flugschule = { schritt: null, rede: null, frageEl: null, symbolEl: null };
fsch.zurFrage = () => { if(fsch.rede) fsch.rede.abbrechen(); fsSymbol(false); fsFrage(); };   // Erklaerung ueberspringen

function fsEinsteigen(){
  story.phase = 'flugschule';
  fsch.schritt = 'erklaeren';
  // in die Transall: Modell wechseln, an die Kulissenposition, Kulisse ausblenden
  const idx = MODEL_NAMES.indexOf('Transall');
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = 'Transall';
  buildModel('Transall'); spec = PLANE_SPECS.Transall || DEFAULT_SPEC;
  const tp = PARK.Transall;
  state.pos.set(tp.x, 0, tp.z);
  state.quat.setFromEuler(new THREE.Euler(0, tp.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  tp.weg = true;
  snapCamera();
  if(story.hinweis) story.hinweis('');
  kiste = null;
  fsch.rede = story.sprich(FS_TEXT, () => fsFrage(), 'pilot');
  // waehrend der Kurzschluss-Erklaerung das Symbol kurz zeigen
  setTimeout(() => { if(fsch.schritt === 'erklaeren') fsSymbol(true); }, 11000);
  setTimeout(() => fsSymbol(false), 20000);
}

function fsSymbol(an){
  if(!fsch.symbolEl){
    fsch.symbolEl = document.createElement('div');
    fsch.symbolEl.style.cssText = 'position:absolute;left:16px;top:50%;transform:translateY(-50%);padding:6px 12px;'
      + 'border-radius:8px;background:#e03c31;box-shadow:0 0 14px #e03c31;color:#fff;font:700 26px system-ui;z-index:20;';
    fsch.symbolEl.textContent = '⇄';
    document.body.appendChild(fsch.symbolEl);
  }
  fsch.symbolEl.style.display = an ? '' : 'none';
}

// Frage mit JA / NEIN (Stick links-rechts, A / Enter / Klick)
function fsFrage(){
  fsch.schritt = 'frage';
  story.sprich(['Und, du kannst doch fliegen, oder?'], null, 'pilot');
  if(!fsch.frageEl){
    fsch.frageEl = document.createElement('div');
    fsch.frageEl.style.cssText = 'position:absolute;left:50%;bottom:16%;transform:translateX(-50%);display:flex;gap:18px;z-index:22;';
    fsch.frageEl.innerHTML = ['JA', 'NEIN'].map((t, i) => '<button data-i="' + i + '" style="width:140px;height:54px;border-radius:12px;'
      + 'border:2px solid #fff;background:rgba(0,0,0,.5);color:#fff;font:700 22px system-ui;cursor:pointer">' + t + '</button>').join('');
    document.body.appendChild(fsch.frageEl);
    fsch.frageEl.querySelectorAll('button').forEach((b, i) => {
      b.addEventListener('pointerenter', () => { fsch.wahl = i; fsZeige(); });
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); fsch.wahl = i; fsAntwort(); });
    });
  }
  fsch.wahl = 0; fsch.frageEl.style.display = 'flex'; fsZeige();
  fsPrev = { l: true, r: true, a: true };          // erst nach Loslassen zaehlen
  window.addEventListener('keydown', fsTaste, true);
}
function fsZeige(){
  fsch.frageEl.querySelectorAll('button').forEach((b, i) => {
    const an = i === fsch.wahl;
    b.style.background = an ? '#ffd23f' : 'rgba(0,0,0,.5)'; b.style.color = an ? '#1a1a1a' : '#fff';
    b.style.transform = an ? 'scale(1.08)' : 'none';
  });
}
function fsAntwort(){
  if(fsch.schritt !== 'frage') return;
  fsch.frageEl.style.display = 'none';
  window.removeEventListener('keydown', fsTaste, true);
  if(fsch.wahl === 1){
    fsch.schritt = 'nein';
    story.sprich(['Oh man! Für Anfänger ist das leider nichts. Bitte steige wieder aus.'], () => {
      story.etappeEnde(7, 'ausgestiegen');
    }, 'pilot');
    return;
  }
  fsch.schritt = 'sequenz';
  story.sprich(['Super! Dann zeig mal, was du kannst. Erst die Startsequenz.'], null, 'pilot');
  story.pfStart({ kurzschluss: false, ohneZeit: true, still: true, danach: () => {
    fsch.schritt = 'flug';
    story.ziel = { x: OASE.x, z: OASE.z };              // roter Punkt im Radar
    story.sprich(['Sehr gut! Jetzt Vollgas und ab zur Oase. Der rote Punkt im Radar zeigt dir den Weg.'], null, 'pilot');
  }});
}
// Eingaben fuer die Frage: Pfeile/Stick links-rechts, A/Enter/Leertaste – als Tastendruck-Ereignis
// (Capture-Phase, stoppt die Weitergabe), damit nichts in die Flugsteuerung durchrutscht.
function fsTaste(e){
  if(fsch.schritt !== 'frage') return;
  if(e.code === 'ArrowLeft' || e.code === 'KeyA'){ fsch.wahl = 0; fsZeige(); }
  else if(e.code === 'ArrowRight' || e.code === 'KeyD'){ fsch.wahl = 1; fsZeige(); }
  else if(e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter'){ fsAntwort(); }
  else return;
  e.preventDefault(); e.stopPropagation();
}
let fsPrev = { l: true, r: true, a: true };
function fsFrageEingabe(){
  if(fsch.schritt !== 'frage') return;
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(!gp){ fsPrev = { l: false, r: false, a: false }; return; }
  const x = gp.axes[0] || 0;
  const l = x < -0.5 || !!(gp.buttons[14] && gp.buttons[14].pressed);
  const r = x >  0.5 || !!(gp.buttons[15] && gp.buttons[15].pressed);
  const a = !!(gp.buttons[0] && gp.buttons[0].pressed);
  if(l && !fsPrev.l){ fsch.wahl = 0; fsZeige(); }
  if(r && !fsPrev.r){ fsch.wahl = 1; fsZeige(); }
  if(a && !fsPrev.a) fsAntwort();
  fsPrev = { l, r, a };
}

// ---- Flug-HUD: Hoehe im Band 270-330 m, Entfernung zur Oase, Schub und Abwurfpunkt ---------
const FS_BAND = [270, 330];
const FS_TREFFER = 50;         // m Toleranz um die Oasenmitte
let fsHudEl = null;
function fsHud(){
  if(!fsHudEl){
    fsHudEl = document.createElement('div');
    fsHudEl.style.cssText = 'position:absolute;left:16px;top:62%;transform:translateY(-50%);padding:10px 14px;'
      + 'border-radius:10px;background:rgba(0,0,0,.55);color:#fff;font:15px/1.6 system-ui,sans-serif;min-width:200px;z-index:20;';
    document.body.appendChild(fsHudEl);
  }
  const agl = state.pos.y - duene(state.pos.x, state.pos.z);
  const imBand = agl >= FS_BAND[0] && agl <= FS_BAND[1];
  const dist = Math.hypot(OASE.x - state.pos.x, OASE.z - state.pos.z);
  const schub = Math.round(Math.max(0, state.throttle) * 100);
  const farbe = imBand ? '#2ecc40' : (Math.abs(agl - 300) < 60 ? '#ffb000' : '#e03c31');
  fsHudEl.innerHTML = '<div style="font-weight:700;margin-bottom:4px">📦 Abwurf Oase</div>'
    + '<div>Höhe <b style="color:' + farbe + '">' + Math.round(agl) + ' m</b> <span style="opacity:.7">(270–330)</span></div>'
    + '<div>Oase <b>' + Math.round(dist) + ' m</b></div>'
    + '<div>Schub <b>' + schub + ' %</b></div>'
    + '<div style="opacity:.75;font-size:13px;margin-top:4px">' + (fsch.schritt === 'flug' ? 'B: Kiste abwerfen' : 'Kiste fällt …') + '</div>';
  fsHudEl.style.display = '';
}
function fsHudAus(){ if(fsHudEl) fsHudEl.style.display = 'none'; }

// ---- Kiste: voller Schwung, kurz freier Fall, dann Schirm (von 300 m ~7 s) -------------------
// Abgestimmt mit C:\tmp\sfg\abwurf_sim.js: Weite ~ Schub% * 5 m, Rand des Hoehenbands bei Vollgas
// ~50 m daneben – Hoehe halten zaehlt.
const KISTE_FREI = 1.6, KISTE_SINK = 52;
let kiste = null;
function kisteAbwerfen(){
  if(fsch.schritt !== 'flug') return;
  fsch.schritt = 'abwurf';
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(state.quat);
  const g = makeCrate();
  g.position.set(state.pos.x + back.x * 6, state.pos.y - 2, state.pos.z + back.z * 6);
  g.children.forEach((o, i) => { if(i > 0) o.visible = false; });     // Schirm erst nach dem freien Fall
  scene.add(g);
  kiste = { g, vx: state.vel.x, vz: state.vel.z, vy: Math.min(0, state.vel.y), t: 0, gelandet: false };
  story.ziel = null;
}
function updateKiste(dt){
  if(!kiste) return;
  const k = kiste;
  if(k.gelandet){
    k.liegt += dt;
    if(k.liegt > 3.5 && !k.fertig){ k.fertig = true; fsErgebnis(k.abstand); }
    return;
  }
  k.t += dt;
  if(k.t < KISTE_FREI) k.vy -= 9.81 * dt;
  else {
    k.g.children.forEach(o => { o.visible = true; });
    k.vy += ((-KISTE_SINK) - k.vy) * Math.min(1, 3 * dt);
  }
  k.g.position.x += k.vx * dt; k.g.position.z += k.vz * dt; k.g.position.y += k.vy * dt;
  const boden = duene(k.g.position.x, k.g.position.z);
  if(k.g.position.y <= boden + 1.5){
    k.g.position.y = boden + 1.5;
    k.gelandet = true; k.liegt = 0;
    k.abstand = Math.hypot(k.g.position.x - OASE.x, k.g.position.z - OASE.z);
    story.hinweis && story.hinweis('📦 ' + Math.round(k.abstand) + ' m von der Oasenmitte');
  }
}
function fsErgebnis(abstand){
  fsHudAus();
  const treffer = abstand <= FS_TREFFER;
  story.sprich([treffer ? (abstand < 20 ? 'Perfekt! Mitten in die Oase!' : 'Gut gemacht! Die Kiste ist angekommen.')
                        : 'Oh, daneben. Die Leute müssen die Kiste jetzt suchen.'], null, 'pilot');
  setTimeout(() => {
    if(story.hinweis) story.hinweis('');
    story.etappeEnde(treffer ? 4 : 7, treffer ? 'Kiste getroffen' : 'Kiste daneben');
  }, 4000);
}
function fsFlug(dt){
  fsHud();
  updateKiste(dt);
}
// B = Abwurf (Tastatur B per Tastendruck-Ereignis – ein kurzer Tipp liegt sonst evtl. zwischen zwei
// Bildern –, Controller B per Flanke)
addEventListener('keydown', (e) => { if(e.code === 'KeyB' && !e.repeat && e2() && story.phase === 'flugschule') kisteAbwerfen(); });
let fsPrevB = true;
function fsAbwurfEingabe(){
  if(fsch.schritt !== 'flug') { fsPrevB = true; return; }
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  const b = !!(gp && gp.buttons[1] && gp.buttons[1].pressed);
  if(b && !fsPrevB) kisteAbwerfen();
  fsPrevB = b;
}

function hookFlugschule(){
  const dropOrig = dropCrate;
  dropCrate = function(){ if(e2() && story.phase === 'flugschule') return; return dropOrig.apply(this, arguments); };
  // Y an der Transall: einsteigen in die Flugschule
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(e2() && !story.phase && transallNah()){ fsEinsteigen(); return; }
    return boardYOrig.apply(this, arguments);
  };
  // Physik: waehrend Erklaerung/Frage/Reise fliegt der Autopilot
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(e2() && story.phase === 'flugschule' && (fsch.schritt === 'erklaeren' || fsch.schritt === 'frage' || fsch.schritt === 'nein')){
      // am Boden stehen bleiben, Bremse an, keine Spielereingabe
      state.vel.set(0, 0, 0); state.throttle = 0;
      return;
    }
    const r = physOrig.apply(this, arguments);
    if(e2() && story.phase === 'flugschule' && (fsch.schritt === 'flug' || fsch.schritt === 'abwurf')) fsFlug(dt);
    return r;
  };
}
function transallNah(){
  const tp = PARK.Transall;
  if(!eva || tp.weg) return false;
  return Math.hypot(eva.group.position.x - tp.x, eva.group.position.z - tp.z) < 16;
}
story.transallNah = transallNah;

// Kulisse jedes Bild nachfuehren (Fahrzeug-Kulisse ein-/ausblenden)
function updateE2(dt){
  updateWuesteSound(dt || 0);
  if(!e2()) return;
  if(story.phase === 'flugschule'){ fsFrageEingabe(); fsAbwurfEingabe(); }
  updateE2Marken();
  for(const name of Object.keys(PARK)){
    const p = PARK[name];
    if(p.obj) p.obj.visible = locale === 'earth' && (MODEL_NAMES[currentModel] !== name || !!eva) && !(p.weg);
  }
}
story.updateE2 = updateE2;

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookWelt2();
  hookFlugschule();
};
})();
