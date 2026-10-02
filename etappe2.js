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
  bahn.rotation.x = -Math.PI / 2; bahn.position.set(60, 0.05, 0); g.add(bahn);
  const strich = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  for(let z = -280; z <= 280; z += 40){
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 18), strich);
    s.rotation.x = -Math.PI / 2; s.position.set(60, 0.07, z); g.add(s);
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
const ANKUNFT    = { x: 0, z: 420 };
const XWING_PARK = { x: -60, z: 320, yaw: Math.PI * 0.15 };
const PARK = {
  Transall: { x: 60, z: 320, yaw: 0, obj: null },   // Nase nach Norden (-Z), Bahn liegt laengs Z
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
  isOnLand    = function(x, z){ return e2() && locale === 'earth' ? true  : isOnLandOrig(x, z); };
  isOnBeach   = function(x, z){ return e2() && locale === 'earth' ? false : isOnBeachOrig(x, z); };
  isOpenWater = function(x, z){ return e2() && locale === 'earth' ? false : isOpenWaterOrig(x, z); };
  surfaceY    = function(x, z){ return e2() && locale === 'earth' ? duene(x, z) : surfaceYOrig(x, z); };
  evaFootY    = function(x, z){ return e2() && locale === 'earth' ? duene(x, z) : evaFootYOrig(x, z); };
  // "Wasserhoehe" = weit unter dem Sand (kein Schwimmen, keine Wellen)
  seaYAt      = function(x, z, t){ return e2() && locale === 'earth' ? -500 : seaYAtOrig(x, z, t); };
  seabedY     = function(x, z){ return e2() && locale === 'earth' ? -600 : seabedYOrig(x, z); };
  hitsBuilding = function(x, y, z, a){ return e2() && locale === 'earth' ? false : hitsBuildingOrig(x, y, z, a); };
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
  eva.yaw = 0; eva.group.rotation.y = 0;               // Blick nach Norden zwischen die beiden
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

// Kulisse jedes Bild nachfuehren (Fahrzeug-Kulisse ein-/ausblenden)
function updateE2(dt){
  updateWuesteSound(dt || 0);
  if(!e2()) return;
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
};
})();
