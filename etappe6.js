// Trip to Japan – Etappe 6: Japan (Fukuoka) mit dem Fuji. Hier zuerst der Weg 6b (Alpha Jet), 6a (Shinkansen) folgt.
// Laedt nach etappe5b.js, vor der Engine. Aktiv erst, wenn story.etappe === 6.
// Welt: die Startinsel der Engine (Zelle 0,0) als Stadt. Auf der einen Seite die Startbahn mit dem Alpha Jet, auf der
// anderen ein Bahnhof mit dem Shinkansen (Einstieg ueber einen Ring; 6a folgt -> vorerst nur ein Hinweis). Kenji schaut
// nach vorne (-z) zum Fuji: 2 km hoch, steht im Meer (Kegel geht direkt ins Wasser ueber). Hinter dem Fuji ein zweiter
// Flughafen am Strand (Engine-Insel) mit C-400 auf dem Parkplatz, Mini-Godzillas, Samurai und Moewen.
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
const RING6 = { x: BAHNHOF.x + 8, z: BAHNHOF.z };      // Einstieg Shinkansen: auf dem Bahnsteig vor dem Zug
const START6 = { x: -55, z: 90, yaw: 0.2 };            // Kenji: Bahnhof links, Alpha rechts, Fuji voraus (leicht nach rechts zur Bahnmitte)
// Fuji im Meer, 2 km hoch (Live-Wunsch). Fuss 3,4 km Radius: so liegt der Hang flach genug fuer die Ansicht von der Stadt
// und reicht bis ins Wasser. Kein eigener Fels-Boden: der Kegel steht auf dem Meeresgrund, das Meer laeuft dran.
// Live-Test: bei 7,5 km verschwand er im Nebel (Engine: fog.far 3 km) -> 4,6 km weit, eigenes Material ohne Nebel
// (fog: false), dafuer zum Himmel hin aufgehellt (Dunst), damit er wie ein ferner Berg wirkt.
const FUJI = { x: 0, z: -4600, r: 3400, h: 2000 };
// Ziel des Hinflugs: kurz vor dem Berg (am Fuss), auf Hoehlenhoehe angeflogen -> Blende
// Live-Feedback: die Blende kam schon nach wenigen hundert Metern -> Ziel am Hang, ~2,6 km Flug ab der Bahn
const ZIEL6 = { x: 0, z: FUJI.z + 2200, r: 300 };
// Zweiter Flughafen am Strand: Engine-Insel hinter dem Fuji (Zelle 0,-15 -> z ~ -12750). Landen = Etappe geschafft.
const STRAND = { cx: 0, cz: -15, radius: 300 };
story.e6 = { ALPHA, BAHNHOF, RING6, START6, FUJI, ZIEL6, STRAND };

// Fuji-Hoehe an (x, z): Kegel nach dem vereinfachten Modell (fuji_glb.js, Hoehe 1 bei Radius 0, 0 bei Radius 1). Fuer
// Kollision (Berg rammen) und damit die Hoehle (etappe6b.js) weiss, wo der Fels ist.
function fujiY(x, z){
  const d = Math.hypot(x - FUJI.x, z - FUJI.z) / FUJI.r;
  if(d >= 1) return -Infinity;
  return FUJI.h * Math.pow(1 - d, 1.25);              // leicht konkav wie der echte Fuji
}
story.e6fujiY = fujiY;

// ---- Inseln: Startinsel + Strand-Flughafen ----------------------------------------------------------
function inselnSetzen(){
  _islandInfoCalc = function(cx, cz){
    if(cx === 0 && cz === 0) return { isStart: true, wx: 0, wz: 0, radius: 260 };
    if(cx === STRAND.cx && cz === STRAND.cz) return { isStart: false, wx: cx * CELL, wz: cz * CELL, radius: STRAND.radius };
    return null;
  };
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear(); _wreckCache.clear();
  refreshIslands();
}
function strandInfo(){ return islandInfo(STRAND.cx, STRAND.cz); }

// ---- Welt bauen -------------------------------------------------------------------------------------
const welt = { gebaut: false, zug: null, fuji: null, ring: null, c400: null };
let s0 = 613; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
function baueWelt(){
  if(welt.gebaut) return; welt.gebaut = true;
  const w = story.welt(6);
  s0 = 613;
  baueStadt(w);
  baueBahnhof(w);
  baueFuji(w);
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
function baueBahnhof(w){
  const B = BAHNHOF, gx = B.x - 7;
  const beton = new THREE.MeshLambertMaterial({ color: 0x8c8a85 }), stahl = new THREE.MeshLambertMaterial({ color: 0x5c6670 });
  const steig = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, B.laenge), beton); steig.position.set(B.x, ISLAND_Y + 0.55, B.z); w.add(steig);
  const schotter = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, B.laenge + 120), new THREE.MeshLambertMaterial({ color: 0x6b6258 })); schotter.position.set(gx, ISLAND_Y + 0.15, B.z); w.add(schotter);
  for(const sgn of [-1, 1]){ const sch = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, B.laenge + 120), stahl); sch.position.set(gx + sgn * 0.72, ISLAND_Y + 0.4, B.z); w.add(sch); }
  // Dach: weiss, auf Stuetzen
  const dachM = new THREE.MeshLambertMaterial({ color: 0xeeeeee });
  const dach = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, B.laenge * 0.8), dachM); dach.position.set(B.x - 2, ISLAND_Y + 7, B.z); w.add(dach);
  for(let z = -B.laenge * 0.35; z <= B.laenge * 0.35; z += 14){ const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5), stahl); st.position.set(B.x + 3, ISLAND_Y + 4, B.z + z); w.add(st); }
  // Schild
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const cx = cv.getContext('2d');
  cx.fillStyle = '#123a6a'; cx.fillRect(0, 0, 512, 128); cx.fillStyle = '#fff'; cx.font = 'bold 60px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('博多 Hakata', 256, 66);
  const schild = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  schild.position.set(B.x + 5.3, ISLAND_Y + 5, B.z); schild.rotation.y = Math.PI / 2; w.add(schild);
  // Zug
  ladeZug(w, gx);
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
  w.add(m); welt.fuji = m;
}

// ---- Strand-Flughafen: C-400 auf dem Parkplatz, Godzillas, Samurai (Tiere: tiere.js) ------------------------------
function stelleC400(){
  if(welt.c400 || !glbTemplates.Transall) return;
  const info = strandInfo(); if(!info) return;
  const g = new THREE.Group(), m = glbTemplates.Transall.clone(true); g.add(m);
  // neben der Bahn (Bahn liegt laengs z durch die Inselmitte, 24 m breit): 45 m seitlich, quer zur Bahn
  g.position.set(info.wx + 45, ISLAND_Y, info.wz + 30); g.rotation.y = -Math.PI / 2;
  g.userData.fremd = true; story.welt(6).add(g); welt.c400 = g;
}
story.e6strand = () => strandInfo();

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
  if(!welt.ring) welt.ring = story.einstiegsRing(RING6.x, ISLAND_Y + 1.1, RING6.z);
  ladeParkAlpha();
  if(park.obj) park.obj.visible = true;
  marken.length = 0;
  story.phase = null; story.ende = false;
  flug.aktiv = false;
  story.hinweis('Zwei Wege: Alpha Jet (weiß) oder Shinkansen (gelber Ring am Bahnsteig) – hinlaufen und Y drücken');
  story.spaeter(12, () => { if(eva && !story.phase) story.hinweis(''); });
  // Test-Shortcut vom Startbildschirm ("E6 Höhle"): einsteigen, Startsequenz und Hinflug ueberspringen, Hoehle mit Autopilot
  if(story.hoehleDirekt){ story.hoehleDirekt = false; story.spaeter(1.5, hoehleDirekt); }
}
function hoehleDirekt(){
  if(!e6() || !eva) return;
  alphaEinsteigen();
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
function alphaEinsteigen(){
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
  // Live-Feedback: keine Ansage zu Beginn, nur das Startsequenz-HUD mit Countdown (wie Etappe 1)
  story.pfStart({ kurzschluss: false, still: true, danach: nachSequenz });
}
// Startsequenz nicht geschafft (Zeit um): noch einmal – der Alpha bleibt auf der Bahn
function nachSequenz(ok){
  if(!flug.aktiv) return;
  // Live-Wunsch: Startsequenz nicht geschafft -> 7 Tage, Gefaengnis (wer ohne Sequenz losfliegt, wird festgenommen)
  if(!ok){ story.sprich(['Die Startsequenz hat nicht geklappt – ohne Startsequenz darf hier keiner fliegen.', 'Die Flughafenpolizei nimmt Kenji fest. Eine Woche Gefängnis.'],
    () => story.spaeter(1, () => flugEnde(false, 'Startsequenz verpasst, Gefängnis')), 'pilot'); return; }
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
  story.sprich(['Oh nein, abgestürzt!', 'Kenji kommt ins Krankenhaus und muss eine Woche bleiben.'], () => story.spaeter(1, () => flugEnde(false, 'Absturz, Krankenhaus')), 'pilot');
}
story.e6absturz = absturz;
function flugEnde(ok, wie){
  if(story.ende) return;
  story.ende = true; flug.aktiv = false; flug.laeuft = false; story.ziel = null;
  story.etappeEnde(ok ? 1 : 7, wie);
}
story.e6flugEnde = flugEnde;

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
  // Y: Alpha einsteigen, Shinkansen-Ring (6a folgt)
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(hier() && alphaNah()){ alphaEinsteigen(); return; }
    if(hier() && ringNah()){ story.hinweis('Die Fahrt mit dem Shinkansen kommt bald – nimm heute den Alpha Jet!'); story.spaeter(5, () => story.hinweis('')); return; }
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
}
story.updateE6 = updateE6;
story.aufgabeE6 = () => (story.aufgabeE6b && story.aufgabeE6b()) || (flug.aktiv ? ['Alpha Jet zum Fuji', [
  ['Start', 'Startsequenz, dann Vollgas und abheben'],
  ['Ziel', 'roter Punkt im Radar, kurz vor dem Fuji'],
]] : (e6() && !story.phase ? ['Etappe 6: Japan – der Fuji', [
  ['Alpha Jet (weiß)', '1 Tag'],
  ['Shinkansen (gelb)', 'kommt bald'],
  ['Einsteigen', 'hinlaufen, Y'],
  ['Zeit', (42 - story.tage) + ' von 42 Tagen übrig'],
]] : null));

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookE6();
};
})();
