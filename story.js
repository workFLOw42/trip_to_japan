// Trip to Japan – Spiellogik. Haengt sich per Wrapper in die unveraenderte Flugspiel-Engine
// (engine/engine.js) ein. Ladeordnung: kenji_glb.js -> story.js -> engine/engine.js.
// Die Engine ruft am Ende ihres Boot-Blocks zwei Hooks auf (eingefuegt von tools/build_engine.ps1):
//   STORY_HOOK  – bevor Inseln und Startplatz berechnet werden: hier werden Funktionen ersetzt.
//   STORY_START – vor dem ersten Bild: hier wird die Startszene aufgebaut.
// Wichtig: story.js laeuft VOR der Engine. Engine-Funktionen und let/const-Globals (state, eva,
// locale, ...) gibt es erst ab STORY_HOOK – auf Top-Level hier also nichts davon anfassen.
(function(){
'use strict';

const story = window.STORY = {
  etappe: 1,
  tage: 0,          // vergangene Tage (6 Wochen = 42 Tage Budget)
};

// ---- Neue Version erkennen (Service Worker) --------------------------------------------------
// Der Browser fragt sw.js am HTTP-Cache vorbei ab (updateViaCache 'none'), beim Start und dann jede
// Minute. Liegt eine neue Version bereit, laedt die Seite am Startbildschirm sofort neu; mitten im
// Spiel nur ein Hinweis – ein laufendes Spiel wird nicht abgebrochen.
let neueVersion = false;
function versionNeuLaden(){
  if(story.gestartet){ zeigeUpdateHinweis(); return; }
  location.reload();
}
function zeigeUpdateHinweis(){
  if(document.getElementById('updatehinweis')) return;
  const el = document.createElement('div'); el.id = 'updatehinweis';
  el.style.cssText = 'position:absolute;right:16px;bottom:40px;padding:6px 12px;border-radius:8px;'
    + 'background:rgba(0,0,0,.55);color:#cfe;font:13px system-ui,sans-serif;z-index:40;pointer-events:none;';
  el.textContent = 'Neue Version bereit – wird beim nächsten Start geladen';
  document.body.appendChild(el);
}
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    // Erste Installation: der SW uebernimmt die Seite per clients.claim() – das ist kein Update.
    // Jede weitere Uebernahme schon.
    let warSchonGesteuert = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      setInterval(() => reg.update().catch(() => {}), 60000);
    }).catch((e) => console.warn('Service Worker:', e));
    // ein neuer SW hat die Seite uebernommen -> neue Version ist aktiv
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if(!warSchonGesteuert){ warSchonGesteuert = true; return; }   // erste Installation: nicht neu laden
      if(neueVersion) return;
      neueVersion = true;
      versionNeuLaden();
    });
  });
}

// ---- Highscores (bleiben im Browser, am Datei-Cache vorbei) ----------------------------------
// VORBEREITUNG – im Spiel noch nirgends angezeigt oder erwaehnt. Erst wenn das Spiel fertig ist,
// kommt eine Anzeige dazu, und zwar nur fuer das, was der Spieler schon kennt: wer zum ersten Mal
// spielt, soll nicht wissen, dass es eine Startsequenz gibt (und von der mit Kurzschluss erst, wenn
// er so weit war). Dafuer merkt story.gesehen(name), was schon einmal vorkam.
// localStorage gehoert zur Seite, nicht zum Service-Worker-Cache: es ueberlebt jedes Update und
// funktioniert offline (gilt pro Geraet/Browser). Gespeichert wird jeweils die beste Zeit.
const HS_KEY = 'reise-nach-japan-highscores';
function highscores(){
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || {}; } catch(e){ return {}; }
}
// neueZeit(name, sekunden) -> true, wenn neuer Rekord
function neueZeit(name, s){
  const hs = highscores();
  const alt = hs[name];
  if(alt !== undefined && alt <= s) return false;
  hs[name] = Math.round(s * 100) / 100;
  try { localStorage.setItem(HS_KEY, JSON.stringify(hs)); } catch(e){ return false; }
  return true;
}
story.highscores = highscores;
const GESEHEN_KEY = 'reise-nach-japan-gesehen';
function gesehen(name){
  try {
    const g = JSON.parse(localStorage.getItem(GESEHEN_KEY)) || {};
    if(!g[name]){ g[name] = Date.now(); localStorage.setItem(GESEHEN_KEY, JSON.stringify(g)); }
  } catch(e){}
}
story.gesehen = gesehen;
story.wasGesehen = () => { try { return JSON.parse(localStorage.getItem(GESEHEN_KEY)) || {}; } catch(e){ return {}; } };

// ---- Welt fuer Etappe 1 ----------------------------------------------------------------------
// Nur die Startinsel. Keine Flugzeugtraeger. Der X-Wing parkt am Strand neben dem U-Boot
// (statt im Todesstern-Hangar zu starten, so gewuenscht).
function hookWelt(){
  wantHangarStart = false;

  const islandOrig = _islandInfoCalc;
  _islandInfoCalc = function(cx, cz){
    if(cx !== 0 || cz !== 0) return null;
    return islandOrig(cx, cz);
  };
  carrierInfo = function(){ return null; };
  // Auf der Startinsel stehen in Etappe 1 nur X-Wing und U-Boot zur Wahl: kein Vorfeld mit
  // Flugzeugen, kein Feuerwehrboot. Das Jetpack gibt es im ganzen Spiel nicht (Y ins Leere tut nichts).
  _parkLocalCalc = function(){ return null; };
  // Kein Steg (Hafen-Modell) an den Inseln: Modell nicht laden, Kollision aus (harborHeight < 0).
  // harborLocal bleibt – daran haengen nur noch Freiflaechen-Pruefungen fuer andere Bauten.
  preloadHarbor = function(){};
  harborHeight = -10;
  // Im All bleiben ISS, Todesstern und Sternenzerstoerer als Objekte, gelandet wird dort aber nicht:
  // alle Anflugstellen pruefen den Rueckgabewert und fliegen bei false einfach weiter.
  enterHangar = function(){ return false; };
  preloadHangar = function(){};          // ohne Hangar-Innenraum faellt auch der Reset dorthin weg
  // Keine zufaelligen Brandherde (Absturz-Feuer auf dem Wasser bleiben)
  hookFeuer();
  harborSubNear = function(){ return imRing() ? { cx: 0, cz: 0 } : null; };
  harborBoatLocal = function(){ return null; };     // Loeschboot am Strand: weder Modell noch Einstieg
  evaStartJet = function(){};
  // Ohne Traeger braucht es auch das Traeger-Modell nicht. Sein Lade-Callback ruft ausserdem
  // placeAtStart auf, das Kenji (EVA) wieder einsammeln wuerde.
  preloadFord = function(){};
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear();
  hookWracks();

  // Startplatz des X-Wings = Strand. Gilt auch fuer jeden Reset (R, Absturz) und fuer den
  // nachtraeglichen placeAtStart, den die Engine nach dem Laden des Traeger-Modells macht.
  const findStartOrig = findStart;
  findStart = function(name){
    if(name === 'XWing' && story.etappe === 1){
      const p = story.xwingPlatz || (story.xwingPlatz = xwingStrandPlatz());
      return { x: p.x, y: ISLAND_Y, z: p.z, yaw: p.yaw };
    }
    return findStartOrig(name);
  };
}

// ---- Wracks fuer den U-Boot-Weg --------------------------------------------------------------
// Genau fuenf echte Wracks, keine kleinen: 2x Segler, 3x Liberty. Im Ring 700-1500 m um die
// Startinsel (dort ist es ueberall > 80 m tief), gleiche Typen nicht nebeneinander. Die Bucht vor
// dem U-Boot-Liegeplatz bleibt frei, damit man nicht beim Ablegen schon darauf stoesst.
// Winkel relativ zum Liegeplatz, Abstand von der Inselmitte.
const WRACKS = [
  { key: 'liberty', a:  1.2, r: 1150 },
  { key: 'sail',    a:  2.4, r:  900 },
  { key: 'liberty', a:  3.4, r: 1400 },
  { key: 'sail',    a:  4.3, r: 1100 },
  { key: 'liberty', a:  5.3, r:  800 },
];
story.wracks = [];
function hookWracks(){
  const info0 = () => islandInfo(0, 0);
  const proZelle = new Map();
  let fertig = false;
  function berechnen(){
    if(fertig) return;
    fertig = true;
    const info = info0(), bl = harborSubLocal(0, 0);
    const a0 = bl ? Math.atan2(bl.z, bl.x) : 0;
    WRACKS.forEach((w, i) => {
      const wx = info.wx + Math.cos(a0 + w.a) * w.r, wz = info.wz + Math.sin(a0 + w.a) * w.r;
      const y = seabedY(wx, wz);
      const rot = cellRnd(i, 7, 4) * Math.PI * 2;
      const def = SHIP_TYPES.find(d => d.key === w.key);
      const len = def ? def.len : 100;
      const wi = { wx, wz, y, key: w.key, gross: true, len, rot,
                   roll: (0.5 + cellRnd(i, 7, 5) * 0.5) * (i % 2 ? -1 : 1),
                   pitch: wreckPitch(wx, wz, rot, len, w.key), nr: i };
      const k = Math.round(wx / CELL) + ',' + Math.round(wz / CELL);
      if(!proZelle.has(k)) proZelle.set(k, []);
      proZelle.get(k).push(wi);
      story.wracks.push(wi);
    });
  }
  _wreckInfosCalc = function(cx, cz){
    if(story.etappe !== 1) return [];
    berechnen();
    return proZelle.get(cx + ',' + cz) || [];
  };
  _wreckCache.clear();
}

// ---- Keine Brandherde ----------------------------------------------------------------------
// Die zufaelligen Braende (spawnFire, fuer Canadair / Feuerwehrboot) entfallen. Feuer auf dem
// Wasser gibt es weiterhin, wenn ein Flugzeug abstuerzt – das laeuft ueber aiCrash, nicht hier.
function hookFeuer(){
  spawnFire = function(){ return false; };
}

// Parkplatz des X-Wings: auf dem Land knapp vor dem Sand, XWING_NEBEN m entlang des Ufers neben
// dem U-Boot-Einstieg (Ring). Nah genug, dass man beide zusammen sieht, aber nicht in einer
// Sichtachse hintereinander (beide stehen am Ufer). Gesucht wird, bis kein Gebaeude im Weg steht.
const XWING_NEBEN = 70;      // m
function xwingStrandPlatz(){
  const info = islandInfo(0, 0);
  const rg = ubootRingPlatz();
  const a0 = rg ? Math.atan2(rg.z - info.wz, rg.x - info.wx) : -Math.PI/2;
  const rr = rg ? Math.hypot(rg.x - info.wx, rg.z - info.wz) : info.radius * 0.9;
  const da = XWING_NEBEN / rr;                                // Winkel fuer ~70 m Bogen
  for(let s = 0; s <= 24; s++){
    for(const v of (s === 0 ? [0] : [1, -1])){
      const a = a0 + da + v * s * 0.02;
      for(const f of [1.0, 0.95, 0.9, 0.85]){
        const x = info.wx + Math.cos(a) * rr * f;
        const z = info.wz + Math.sin(a) * rr * f;
        if(!isOnLand(x, z)) continue;
        if(hitsBuilding(x, ISLAND_Y + 2, z, false)) continue;
        // Nase zum Wasser (radial nach aussen): Gesicht -Z  ->  yaw = atan2(-dx, -dz)
        return { x, z, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) };
      }
    }
  }
  return { x: info.wx, z: info.wz + 110, yaw: 0 };   // Notfall: Landebahn
}

// ---- U-Boot-Einstieg am Strand ---------------------------------------------------------------
// Das U-Boot liegt draussen im Wasser. Statt hinzuschwimmen (oder mit dem Schlauchboot zu fahren)
// steigt man an einem leuchtenden Ring am Strand direkt davor ein: im Ring Y = im U-Boot.
const RING_R = 6;            // m Radius des Einstiegsrings
function ubootRingPlatz(){
  if(story.ring) return story.ring;
  const info = islandInfo(0, 0), bl = harborSubLocal(0, 0);
  if(!info || !bl) return null;
  const sx = info.wx + bl.x, sz = info.wz + bl.z;
  let dx = info.wx - sx, dz = info.wz - sz; const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
  // vom U-Boot Richtung Inselmitte: der erste Punkt auf festem Land (Gras), dann noch ein Stueck
  // weiter. Auf dem Sand hebt die Welle den Boden bis 1,6 m an (evaFootY) und ueberspuelte den Ring.
  for(let s = 0; s < n; s += 2){
    const x = sx + dx * s, z = sz + dz * s;
    if(isOnLand(x, z)){
      const x2 = x + dx * (RING_R + 3), z2 = z + dz * (RING_R + 3);
      return (story.ring = { x: x2, z: z2, nx: -dx, nz: -dz });   // n = Richtung zum U-Boot
    }
  }
  return null;
}
function imRing(){
  const r = ubootRingPlatz();
  if(!eva || !r) return false;
  return Math.hypot(eva.group.position.x - r.x, eva.group.position.z - r.z) < RING_R;
}
let ringMesh = null;
function updateRing(zeigen){
  const r = ubootRingPlatz();
  if(!r) return;
  if(!ringMesh){
    ringMesh = new THREE.Mesh(new THREE.RingGeometry(RING_R - 0.7, RING_R, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8,
        side: THREE.DoubleSide, depthWrite: false }));
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.renderOrder = 996;
    scene.add(ringMesh);
  }
  ringMesh.visible = zeigen;
  if(!zeigen) return;
  ringMesh.position.set(r.x, ISLAND_Y + 0.06, r.z);
  const t = performance.now() / 1000;
  ringMesh.material.opacity = 0.55 + 0.35 * Math.sin(t * 3);
}

// ---- Kenji statt Astronaut -------------------------------------------------------------------
// Kenji ist ein Skinned Mesh mit Mixamo-Animationen. clone(true) taugt dafuer nicht (das Skelett
// wuerde geteilt), und es gibt ohnehin nur einen Kenji: makeAstronaut gibt also immer dasselbe
// Objekt zurueck, eingehaengt in eine neue Group (die Engine entfernt nur die Group).
const KENJI_H = 1.55;            // Koerpergroesse in Metern (Schueler)
const kenji = story.kenji = { obj: null, mixer: null, acts: {}, cur: null, last: null };
let evaJumpOrig = () => {};

function preloadKenji(){
  if(!window.KENJI_GLB || !THREE.GLTFLoader) return;
  const b64 = window.KENJI_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (gltf) => {
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.multiplyScalar(KENJI_H / Math.max(0.001, size.y));
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.y -= box2.min.y;              // Fuesse auf y = 0
    obj.rotation.y = Math.PI;                  // Modell schaut +Z, Engine erwartet -Z
    obj.traverse(o => { if(o.isMesh){ o.castShadow = true; o.frustumCulled = false; } });
    const wrap = new THREE.Group(); wrap.add(obj);
    kenji.obj = wrap;
    kenji.mixer = new THREE.AnimationMixer(obj);
    for(const clip of gltf.animations){
      // Root Motion entfernen: die Engine bewegt die Figur selbst
      clip.tracks = clip.tracks.filter(t => !/Hips\.position$/.test(t.name));
      kenji.acts[clip.name] = kenji.mixer.clipAction(clip);
    }
    kenjiAnim('idle');
    // Steht schon der Platzhalter in der Welt, gegen Kenji tauschen
    if(eva && eva.group){ eva.group.clear(); eva.group.add(kenji.obj); }
  }, (err) => { console.warn('Kenji-GLB Ladefehler:', err); });
}

function kenjiAnim(name){
  if(kenji.cur === name || !kenji.acts[name]) return;
  const a = kenji.acts[name];
  if(!Object.values(TRICK_CLIP).includes(name)){ a.setLoop(THREE.LoopRepeat); a.clampWhenFinished = false; }
  a.reset().play();
  if(kenji.cur && kenji.acts[kenji.cur]) kenji.acts[kenji.cur].crossFadeTo(a, 0.25, false);
  kenji.cur = name;
}

function hookKenji(){
  preloadKenji();
  const makeOrig = makeAstronaut;
  makeAstronaut = function(){
    if(!kenji.obj) return makeOrig();
    if(kenji.obj.parent) kenji.obj.parent.remove(kenji.obj);
    const g = new THREE.Group(); g.add(kenji.obj);
    kenji.last = null;
    return g;
  };
}

// ---- Kenji zu Fuss: Tempo nach Stick-Ausschlag, Tasten fuer Tricks ---------------------------
// Stick bis 50 % = gehen, darueber = rennen. Abseits der Fahrzeuge:
//   A / Leertaste = springen · B = Aerial Evade · X = Silly Dance · Y = Butterfly Twirl
//   L3 (linken Stick druecken) / M halten = Moonwalk – gelaufen wird dabei mit dem linken Stick
// Am Fahrzeug bleibt Y Einsteigen. Tanz/Twirl spielen einmal ab; Stick bewegen bricht sie ab.
const GEH_MAX = 0.3;          // Anteil von EVA_SPEED bei 50 % Stick (≈ 1,8 m/s)
const TRICK_CLIP = { tanz: 'dance_silly', twirl: 'butterfly_twirl', evade: 'aerial_evade' };
const tricks = story.tricks = { aktiv: null, t: 0, moon: false, ausschlag: 0, prev: {} };

function amFahrzeug(){ return !!eva && (evaCanBoard() || !!harborSubNear() || marsSteinNah()); }

// Rohzustand der vier Tasten (Controller + Tastatur)
function trickTasten(){
  const k = { a: !!keys['Space'], b: !!keys['KeyB'], x: !!keys['KeyX'], y: !!keys['KeyY'], moon: !!keys['KeyM'] };
  if(gamepadIndex !== null){
    const gp = navigator.getGamepads()[gamepadIndex];
    if(gp){
      const d = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      k.a = k.a || d(0); k.b = k.b || d(1); k.x = k.x || d(2); k.y = k.y || d(3); k.moon = k.moon || d(10);
    }
  }
  return k;
}

function trickStart(name){
  const a = kenji.acts[TRICK_CLIP[name]];
  if(!a) return;
  tricks.aktiv = name; tricks.t = 0;
  a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true;
  kenji.cur = null;                       // erzwingt den Wechsel in kenjiAnim
  kenjiAnim(TRICK_CLIP[name]);
}

// Vor updateEva: Eingabe umformen (Tempo-Kurve, Stillstand bei Tricks/Moonwalk)
function kenjiEingabe(inp){
  if(!eva || eva.rover || eva.boat || !steuerbar()) return inp;
  const roh = -(inp.pitch || 0);
  const a = Math.abs(roh);
  tricks.ausschlag = a;
  if(a > 0.15 && tricks.aktiv) tricks.aktiv = null;           // Stick bricht den Trick ab
  if(tricks.aktiv) return Object.assign({}, inp, { pitch: 0, yaw: 0 });
  let f;
  if(a <= 0.5) f = a / 0.5 * GEH_MAX;                         // gehen
  else f = GEH_MAX + (a - 0.5) / 0.5 * (1 - GEH_MAX);         // rennen
  if(tricks.moon) f = Math.min(f, GEH_MAX) * 0.6;             // Moonwalk: langsam
  return Object.assign({}, inp, { pitch: -Math.sign(roh) * f });
}

// Tastatur-Druecke als Ereignis merken: ein kurzer Tipp kann zwischen zwei Bildern liegen und
// waere im Tastenzustand pro Bild nie zu sehen.
const tippTaste = { Space: 'a', KeyB: 'b', KeyX: 'x', KeyY: 'y' };
const getippt = {};
addEventListener('keydown', e => { if(!e.repeat && tippTaste[e.code]) getippt[tippTaste[e.code]] = true; });

// Tasten auswerten (Flanken), einmal pro Bild
function kenjiTasten(){
  // Tricks ueberall, wo Kenji zu Fuss ist – auch auf Mond und Mars (dort springt er dank geringer
  // Schwerkraft viel hoeher). Gesperrt nur hinter dem Platzhalter-Schild und waehrend des Globus.
  if(!eva || eva.rover || eva.boat || sw.aktiv || !steuerbar() || story.phase === 'platzhalter' || story.phase === 'reise'){
    for(const n in getippt) delete getippt[n];
    return;
  }
  const k = trickTasten(), pr = tricks.prev;
  const neu = n => (k[n] && !pr[n]) || getippt[n];
  const frei = !amFahrzeug();
  if(neu('a') && eva.onGround){ tricks.aktiv = null; evaJumpOrig(); }
  tricks.moon = frei && k.moon && !tricks.aktiv;
  if(frei && neu('b')) trickStart('evade');
  if(frei && neu('x')) trickStart('tanz');
  if(frei && neu('y')) trickStart('twirl');
  tricks.prev = k;
  for(const n in getippt) delete getippt[n];
}

// Animation nach Zustand
function updateKenji(dt){
  if(!kenji.mixer) return;
  kenji.mixer.update(dt);
  if(!eva || !eva.group || kenji.obj.parent !== eva.group) return;
  if(tricks.aktiv){
    const a = kenji.acts[TRICK_CLIP[tricks.aktiv]];
    tricks.t += dt;
    if(a && tricks.t < a.getClip().duration) return;
    tricks.aktiv = null;
  }
  const a = tricks.ausschlag;
  if(sw.aktiv){ kenjiAnim('swim'); return; }
  if(!eva.onGround) kenjiAnim('jump');
  else if(tricks.moon) kenjiAnim('moonwalk');
  else if(a > 0.5) kenjiAnim('run');
  else if(a > 0.05) kenjiAnim('walk');
  else kenjiAnim('idle');
}

// ---- Stimme + Untertitel ---------------------------------------------------------------------
// Browser erlauben Sprachausgabe erst nach einer Nutzergeste – deshalb der Startbildschirm.
// Ohne Stimme (oder wenn sie haengt) laeuft der Untertitel nach Wortanzahl weiter.
let subEl = null;
function untertitel(text){
  if(!subEl){
    subEl = document.createElement('div');
    subEl.style.cssText = 'position:absolute;left:50%;bottom:9%;transform:translateX(-50%);'
      + 'max-width:min(900px,90vw);padding:12px 18px;border-radius:10px;background:rgba(0,0,0,.6);'
      + 'color:#fff;font:20px/1.4 system-ui,sans-serif;text-align:center;pointer-events:none;'
      + 'transition:opacity .4s;z-index:20;';
    document.body.appendChild(subEl);
  }
  subEl.textContent = text || '';
  subEl.style.opacity = text ? '1' : '0';
}
// Spricht die Saetze nacheinander und zeigt jeweils den aktuellen als Untertitel.
// fertig() wird genau einmal gerufen.
// Ton an: die Stimme spricht, OHNE Untertitel. Ton aus: Untertitel, ohne Stimme (D-Pad runter / N).
// Umschalten faengt nicht von vorne an: die Ansage laeuft weiter und setzt an dem Wort fort, an dem
// sie gerade ist – gemeldet von der Stimme (onboundary), sonst nach dem Sprechtempo geschaetzt.
const reden = new Set();
const ZEICHEN_PRO_S = 14;
// Stimme nach Rolle: 'pilot' = maennlich, sonst ('funk') weiblich. Gewaehlt wird nach Namen, weil die
// Browser kein Geschlecht melden. Edge bringt zusaetzlich natuerliche Online-Stimmen mit.
const STIMME_M = /Conrad|Killian|Florian|Stefan|Ralf|Kasper|Bernd|Christoph|male|männlich/i;
const STIMME_W = /Katja|Amala|Seraphina|Louisa|Hedda|Elke|Klarissa|Tanja|Google Deutsch|female|weiblich/i;
function stimmeFuer(rolle){
  const de = window.speechSynthesis.getVoices().filter(v => /^de/i.test(v.lang));
  const bevorzugt = (re) => de.filter(v => re.test(v.name)).sort((a, b) => (a.localService ? 1 : 0) - (b.localService ? 1 : 0))[0];
  return (rolle === 'pilot' ? bevorzugt(STIMME_M) : bevorzugt(STIMME_W)) || de[0] || null;
}      // Sprechtempo bei rate 1.0 (fuer Schaetzung und Untertitel-Takt)
function satzDauer(s){ return 1200 + s.length / ZEICHEN_PRO_S * 1000; }   // ms, Untertitel-Takt
function sprich(saetze, fertig, rolle){
  let i = -1, done = false, timer = null, utt = null;
  let laut = false, pos0 = 0, t0 = 0, bPos = null;     // aktueller Satz: ab Zeichen pos0 seit t0
  const synth = window.speechSynthesis;
  const tonAn = () => !!(synth && story.ton && soundOn && synth.getVoices().length);

  // Wo im aktuellen Satz ist die Ansage gerade (Zeichen)?
  function aktPos(){
    const s = saetze[i]; if(!s) return 0;
    const ms = performance.now() - t0;
    if(laut) return Math.min(s.length, bPos !== null ? bPos : pos0 + ms / 1000 * ZEICHEN_PRO_S);
    return Math.min(s.length, pos0 + ms * s.length / satzDauer(s));
  }
  // Den aktuellen Satz ab Zeichen p fortsetzen – je nach Ton als Stimme oder als Untertitel
  function weiterAb(p){
    clearTimeout(timer); utt = null; bPos = null;
    const s = saetze[i];
    while(p > 0 && s[p - 1] !== ' ') p--;               // auf den Wortanfang zurueck
    pos0 = p; t0 = performance.now(); laut = tonAn();
    const rest = s.slice(p);
    if(!rest.trim()){ naechster(); return; }
    if(laut){
      untertitel('');
      const u = utt = new SpeechSynthesisUtterance(rest);
      const stimme = stimmeFuer(rolle);
      u.lang = 'de-DE'; if(stimme) u.voice = stimme; u.rate = 1.0;
      // ohne maennliche Stimme klingt der Pilot wenigstens tiefer
      u.pitch = rolle === 'pilot' && !(stimme && STIMME_M.test(stimme.name)) ? 0.75 : 1.0;
      u.onboundary = e => { if(utt === u) bPos = p + (e.charIndex || 0); };
      u.onend = u.onerror = () => { if(utt === u) naechster(); };
      synth.speak(u);
      // falls onend nie kommt
      timer = setTimeout(() => { if(utt === u) naechster(); }, (rest.length / ZEICHEN_PRO_S * 1000 + 1500) * 2.5);
    } else {
      untertitel(s);
      timer = setTimeout(naechster, satzDauer(s) * (s.length - p) / s.length);
    }
  }
  function naechster(){
    clearTimeout(timer); utt = null;
    if(done) return;
    if(++i >= saetze.length){ done = true; reden.delete(r); untertitel(''); if(fertig) fertig(); return; }
    weiterAb(0);
  }
  const r = {
    abbrechen(){ done = true; reden.delete(r); clearTimeout(timer); utt = null; if(synth) synth.cancel(); untertitel(''); },
    tonGeaendert(){
      if(done || i < 0) return;
      const p = Math.floor(aktPos());
      utt = null;
      if(synth) synth.cancel();
      weiterAb(p);
    },
  };
  reden.add(r);
  naechster();
  return r;
}
function hookTon(){
  // Das grosse Ton-Symbol nicht ueber Filmszene/Globus zeigen (z. B. beim automatischen Einschalten
  // am Startbildschirm)
  const showToggleOrig = showToggle;
  showToggle = function(sym){
    if(document.body.classList.contains('filmszene') || gl.aktiv || !story.gestartet || story.phase === 'reise') return;
    return showToggleOrig.call(this, sym);
  };
  const orig = toggleSound;
  toggleSound = function(){
    const r = orig.apply(this, arguments);
    for(const rd of [...reden]) rd.tonGeaendert();
    return r;
  };
}

// ---- Startbildschirm -------------------------------------------------------------------------
// Startbildschirm: Auswahl "Neues Spiel" oder (zum Testen) direkt Etappe 2..6.
// Linker Stick / Pfeile links-rechts waehlen, A / Enter / Leertaste / Klick startet.
function startbildschirm(weiter){
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;'
    + 'justify-content:center;background:rgba(0,0,0,.55);color:#fff;font-family:system-ui,sans-serif;'
    + 'z-index:30;text-align:center;user-select:none;';
  const OPT = [{ n: 1, t: 'Neues Spiel' }, { n: 2, t: 'E2' }, { n: 3, t: 'E3' }, { n: 4, t: 'E4' }, { n: 5, t: 'E5' }, { n: 6, t: 'E6' }];
  el.innerHTML = '<div style="font-size:52px;font-weight:700;letter-spacing:1px">Reise nach Japan</div>'
    + '<div style="display:flex;gap:10px;justify-content:center;margin-top:34px">'
    + OPT.map((o, i) => '<button data-i="' + i + '" style="min-width:' + (i ? 54 : 170) + 'px;height:44px;border-radius:10px;'
      + 'border:2px solid rgba(255,255,255,.45);background:rgba(255,255,255,.1);color:#fff;font:600 18px system-ui;'
      + 'cursor:pointer;transition:all .12s">' + o.t + '</button>').join('') + '</div>'
    + '<div style="font-size:14px;margin-top:16px;opacity:.7">Linker Stick / ← → wählen · A / Enter starten'
    + '<br><span style="font-size:12px;opacity:.8">E2–E6: Test – direkt zur Etappe</span></div>';
  document.body.appendChild(el);
  const knoepfe = [...el.querySelectorAll('button')];
  let wahl = 0;
  function zeige(){
    knoepfe.forEach((b, i) => {
      const an = i === wahl;
      b.style.background = an ? '#ffd23f' : 'rgba(255,255,255,.1)';
      b.style.color = an ? '#1a1a1a' : '#fff';
      b.style.borderColor = an ? '#ffd23f' : 'rgba(255,255,255,.45)';
      b.style.transform = an ? 'scale(1.08)' : 'none';
    });
  }
  zeige();
  let los = false;
  function start(){
    if(los) return; los = true;
    el.remove();
    window.removeEventListener('keydown', taste, true);
    story.ton = true;
    story.gestartet = true;
    if(!soundOn) toggleSound();      // die Geste erlaubt jetzt Audio: Ton an (D-Pad runter / N schaltet um)
    const n = OPT[wahl].n;
    if(n > 1){ springeZu(n); return; }
    weiter();
  }
  function schritt(d){ wahl = (wahl + d + OPT.length) % OPT.length; zeige(); }
  function taste(e){
    if(los) return;
    if(e.code === 'ArrowRight' || e.code === 'KeyD'){ e.preventDefault(); e.stopPropagation(); schritt(1); return; }
    if(e.code === 'ArrowLeft'  || e.code === 'KeyA'){ e.preventDefault(); e.stopPropagation(); schritt(-1); return; }
    if(e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter'){ e.preventDefault(); e.stopPropagation(); start(); }
  }
  window.addEventListener('keydown', taste, true);
  knoepfe.forEach((b, i) => {
    b.addEventListener('pointerenter', () => { wahl = i; zeige(); });
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); wahl = i; zeige(); start(); });
  });
  // Gamepad: Stick/D-Pad links-rechts waehlen, A startet (Flanken, damit nichts durchrutscht)
  let prevA = true, prevL = true, prevR = true;       // erst nach dem Loslassen zaehlen
  (function pad(){
    if(los) return;
    for(const gp of (navigator.getGamepads ? navigator.getGamepads() : [])){
      if(!gp) continue;
      const x = gp.axes[0] || 0;
      const a = !!(gp.buttons[0] && gp.buttons[0].pressed);
      const l = x < -0.5 || !!(gp.buttons[14] && gp.buttons[14].pressed);
      const r = x >  0.5 || !!(gp.buttons[15] && gp.buttons[15].pressed);
      if(l && !prevL) schritt(-1);
      if(r && !prevR) schritt(1);
      if(a && !prevA){ start(); return; }
      prevA = a; prevL = l; prevR = r;
      break;
    }
    requestAnimationFrame(pad);
  })();
}

// ---- TEST: direkt zu Etappe n springen ------------------------------------------------------
// Etappe 1 laeuft normal. Fuer Etappe n > 1 tut das Spiel so, als waeren die Etappen davor mit dem
// sicheren Weg (4 Tage) geschafft: Reise und Tage vorbelegt, dann die Globus-Reise nach Etappe n.
function springeZu(n){
  intro.phase = 'aus';
  hudSichtbar(true);
  if(intro.rede) intro.rede.abbrechen();
  if(story.schule){ story.schule.visible = false; }
  story.e1aufraeumen && story.e1aufraeumen();
  story.reise = [];
  for(let i = 0; i < n - 1; i++) story.reise.push(i);     // 0 .. n-2 schon besucht
  story.e1weg = story.e1weg || 'uboot';
  story.tage = (n - 2) * 4;                                // die Etappen vor der letzten Reise
  story.etappe = n - 1;
  story.phase = 'reise';
  const text = tageVergangen(4) + ' (Test-Sprung) · noch ' + (42 - story.tage) + ' von 42 Tagen';
  story.globusReise(n - 1, text, () => {
    story.etappe = n;
    if(n === 2 && story.etappe2Start){ hinweis(''); story.etappe2Start(); return; }
    platzhalter('Etappe ' + n + ' (folgt) – Tag ' + story.tage + ' von 42');
  });
}
story.springeZu = springeZu;
story.sprich = sprich;

// ---- Schule ----------------------------------------------------------------------------------
// Einfaches Schulgebaeude (kein Modell vorhanden). Steht mit der Tuer zum Strand.
function baueSchule(x, z, yaw){
  const g = new THREE.Group();
  const wand  = new THREE.MeshLambertMaterial({ color: 0xe8d9b5 });
  const dach  = new THREE.MeshLambertMaterial({ color: 0x8a3b2a });
  const glas  = new THREE.MeshLambertMaterial({ color: 0x3d5a73 });
  const tuerM = new THREE.MeshLambertMaterial({ color: 0x5b3a22 });
  const B = 32, H = 9, T = 14;
  const haus = new THREE.Mesh(new THREE.BoxGeometry(B, H, T), wand);
  haus.position.y = H/2; g.add(haus);
  const d = new THREE.Mesh(new THREE.BoxGeometry(B + 1.5, 0.8, T + 1.5), dach);
  d.position.y = H + 0.4; g.add(d);
  // Fenster in zwei Reihen auf der Vorderseite (-Z ist vorne, wie bei der Engine)
  for(let r = 0; r < 2; r++){
    for(let k = -3; k <= 3; k++){
      if(r === 0 && k === 0) continue;               // dort ist die Tuer
      const f = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), glas);
      f.position.set(k * 4.2, 2.6 + r * 3.6, -T/2 - 0.02); f.rotation.y = Math.PI; g.add(f);
    }
  }
  const tuer = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.0), tuerM);
  tuer.position.set(0, 1.5, -T/2 - 0.03); tuer.rotation.y = Math.PI; g.add(tuer);
  // Schild ueber der Tuer
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#1d3b6a'; cx.fillRect(0, 0, 512, 128);
  cx.fillStyle = '#fff'; cx.font = 'bold 72px system-ui,sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('SCHULE', 256, 66);
  const schild = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  schild.position.set(0, 4.0, -T/2 - 0.04); schild.rotation.y = Math.PI; g.add(schild);
  g.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(x, evaFootY(x, z) - 0.05, z);
  g.rotation.y = yaw;
  scene.add(g);
  return g;
}

// ---- Intro -----------------------------------------------------------------------------------
const INTRO_TEXT = [
  'Endlich Ferien!',
  'Kenji wurde eingeladen, den Sommer mit seinem Freund in Japan zu verbringen.',
  'Da er aber kein Geld hat und seine Eltern ihm keines geben wollen, muss er versuchen, auf eigene Faust den Weg zu meistern.',
  'Er hat volle sechs Wochen Zeit, sein Ziel zu erreichen, muss aber schwierige Aufgaben meistern.',
  'Am Ende winkt ein Abenteuer, das er so noch nie erlebt hat – und vielleicht der größte Spaß seines Lebens.',
];
const INTRO_GEH = 0.3;     // Stick-Ausschlag beim Gehen im Intro (EVA_SPEED * 0.3 ≈ 1,8 m/s)
const INTRO_WEG = 7;       // m: so weit geht er von der Schultuer weg, dann bleibt er stehen
const INTRO_FAHRT = 9;     // s: Kamera faehrt von vorne auf Kenji zu
const INTRO_DREH  = 7;     // s: Kamera kreist 180° hinter ihn

// Startpunkt vor der Schultuer. Nach dem Intro sollen X-Wing und U-Boot BEIDE im Bild sein, links
// und rechts vor Kenji, keines direkt voraus. Das U-Boot liegt draussen am Liegeplatz (~375 m von
// der Inselmitte), der X-Wing auf dem Land (~235 m) – eine feste Formel passt deshalb nicht.
// Gesucht wird im Raster ein freier Platz, von dem beide 60-260 m entfernt sind, zusammen unter
// 70 Grad liegen (Bildbreite ~87 Grad) und moeglichst gleich weit weg sind. Hinter Kenji muss Platz
// fuer die Schule sein, und der Weg von der Tuer (INTRO_WEG) muss frei sein.
function introPlatz(){
  const info = islandInfo(0, 0);
  const bl = harborSubLocal(0, 0);
  const xp = story.xwingPlatz;
  const rg = ubootRingPlatz();
  const sx = rg ? rg.x : xp.x + 70, sz = rg ? rg.z : xp.z;   // U-Boot-Seite = Einstiegsring
  const frei = (x, z) => isOnLand(x, z) && !hitsBuilding(x, ISLAND_Y + 1, z, false);
  let best = null, bestWert = Infinity;
  for(let x = info.wx - 250; x <= info.wx + 250; x += 10){
    for(let z = info.wz - 250; z <= info.wz + 250; z += 10){
      if(!frei(x, z)) continue;
      const d1 = Math.hypot(xp.x - x, xp.z - z), d2 = Math.hypot(sx - x, sz - z);
      if(d1 < 45 || d2 < 45 || d1 > 160 || d2 > 160) continue;
      const a1 = Math.atan2(xp.x - x, xp.z - z), a2 = Math.atan2(sx - x, sz - z);
      let dw = Math.abs(a1 - a2); if(dw > Math.PI) dw = 2 * Math.PI - dw;
      if(dw > 70 * Math.PI / 180) continue;
      // Blick auf die Mitte; Schule 8,5 m dahinter (+ Gebaeudebreite) und Weg nach vorn frei?
      const mx = (xp.x + sx) / 2 - x, mz = (xp.z + sz) / 2 - z, ml = Math.hypot(mx, mz) || 1;
      const fx = mx / ml, fz = mz / ml;
      let ok = true;
      for(const [b, q] of [[8.5, 0], [8.5, 15], [8.5, -15], [14, 0]]){
        if(!frei(x - fx * b - fz * q, z - fz * b + fx * q)) { ok = false; break; }
      }
      for(let s = 0; s <= INTRO_WEG + 4 && ok; s += 2) ok = frei(x + fx * s, z + fz * s);
      if(!ok) continue;
      const wert = Math.abs(d1 - d2) + Math.abs(dw * 180 / Math.PI - 55);   // gleich weit, ~55 Grad
      if(wert < bestWert){ bestWert = wert; best = { x, z, fx, fz }; }
    }
  }
  if(!best){   // Notfall: zwischen beiden, Richtung Inselmitte versetzt
    const x = (xp.x + sx) / 2 * 0.4, z = (xp.z + sz) / 2 * 0.4;
    const mx = (xp.x + sx) / 2 - x, mz = (xp.z + sz) / 2 - z, ml = Math.hypot(mx, mz) || 1;
    best = { x, z, fx: mx / ml, fz: mz / ml };
  }
  // Startpunkt = Schultuer; er geht INTRO_WEG nach vorn und steht dann am gefundenen Platz
  const x0 = best.x - best.fx * INTRO_WEG, z0 = best.z - best.fz * INTRO_WEG;
  return { x: x0, z: z0, yaw: Math.atan2(-best.fx, -best.fz),        // Gesicht -Z
           schuleX: x0 - best.fx * 8.5, schuleZ: z0 - best.fz * 8.5 };
}

const intro = story.intro = { phase: 'aus', t: 0, rede: null, fertigRede: false };

function hudSichtbar(an){
  document.body.classList.toggle('filmszene', !an);
}
function introVorbereiten(){
  if(!document.getElementById('filmszene-css')){
    const st = document.createElement('style'); st.id = 'filmszene-css';
    st.textContent = 'body.filmszene #hud, body.filmszene #radar, body.filmszene #gyro, '
      + 'body.filmszene #pad, body.filmszene #big { visibility: hidden; }';
    document.head.appendChild(st);
  }
  hudSichtbar(false);
  const ip = introPlatz();
  story.schule = baueSchule(ip.schuleX, ip.schuleZ, ip.yaw);
  const g = eva.group;
  g.position.set(ip.x, evaFootY(ip.x, ip.z), ip.z);
  eva.yaw = ip.yaw; g.rotation.y = ip.yaw;
  intro.start = { x: ip.x, z: ip.z };
  kenji.last = null;
  intro.phase = 'warten'; intro.t = 0;
  startbildschirm(() => {
    intro.phase = 'laeuft'; intro.t = 0;
    intro.rede = sprich(INTRO_TEXT, () => { intro.fertigRede = true; });
  });
}

// Phasen: warten (Startbildschirm) -> laeuft (Kamerafahrt, Kenji geht allein) -> frei (Schwenk
// fertig, Ansage laeuft noch: Kenji ist steuerbar, nur Einsteigen/Reset warten) -> aus.
function introDt(dt){
  if(intro.phase !== 'laeuft' && intro.phase !== 'frei') return;
  intro.t += dt;
  if(intro.phase === 'laeuft' && intro.t > INTRO_FAHRT + INTRO_DREH){
    intro.phase = 'frei';
    hudSichtbar(true);
    evaOrbit = 0; evaPitch = 0;
  }
  if(intro.phase === 'frei' && intro.fertigRede) introEnde();
}

function introEnde(){
  const warFrei = intro.phase === 'frei';
  intro.phase = 'aus';
  hudSichtbar(true);
  if(!warFrei){ evaOrbit = 0; evaPitch = 0; }
  if(story.onIntroEnde) story.onIntroEnde();
}
// steuerbar = nach dem Schwenk (frei) oder nach dem Intro (aus)
function steuerbar(){ return intro.phase === 'aus' || intro.phase === 'frei'; }

function hookIntro(){
  // Im Intro geht Kenji von allein; die Spielereingaben werden ignoriert.
  const updateEvaOrig = updateEva;
  updateEva = function(dt, inp){
    if(intro.phase === 'warten'){ tricks.ausschlag = 0; return updateEvaOrig(dt, {}); }
    if(intro.phase === 'laeuft'){
      const s = intro.start, p = eva.group.position;
      const geht = Math.hypot(p.x - s.x, p.z - s.z) < INTRO_WEG;
      tricks.ausschlag = geht ? 0.3 : 0;                      // Animation: gehen bzw. stehen
      return updateEvaOrig(dt, { pitch: geht ? -INTRO_GEH : 0 });
    }
    if(sw.aktiv){ schwimmUpdate(dt, inp); return; }
    return updateEvaOrig(dt, kenjiEingabe(inp));
  };
  // Einsteigen (Y) und Reset (R) erst nach der Ansage. Y abseits der Fahrzeuge = Twirl (kenjiTasten).
  const introAktiv = () => intro.phase !== 'aus';     // Einsteigen erst, wenn die Ansage fertig ist
  const boardYOrig = evaBoardY;
  evaBoardY = function(){ if(introAktiv() || !amFahrzeug()) return; return boardYOrig.apply(this, arguments); };
  const resetO = resetPlane;
  resetPlane = function(){ if(introAktiv()) return; return resetO.apply(this, arguments); };
  // B ist zu Fuss Moonwalk statt Huepfen; gesprungen wird mit A (kenjiTasten -> evaJumpOrig)
  evaJumpOrig = evaJump;
  evaActionB = function(){};
  // Modellwechsel (M / D-Pad rechts) gibt es im Spiel nicht – Fahrzeuge waehlt die Geschichte
  cycleModel = function(){};
  // Kamera: erst vorne (Gesicht), langsam heran, dann 180° nach hinten herum.
  const camOrig = updateCamera;
  updateCamera = function(){
    if(eva && sw.aktiv && steuerbar()){
      const p = eva.group.position, yaw = eva.yaw + evaOrbit;
      const tief = seaYAt(p.x, p.z) - p.y;                     // wie weit unter der Oberflaeche
      const k = Math.min(1, Math.max(0, (tief - 0.5) / 2));    // 0 = an der Oberflaeche, 1 = getaucht
      const dist = 6 - 2 * k, hoch = 2.2 - 1.8 * k;
      const soll = new THREE.Vector3(p.x + Math.sin(yaw) * dist, p.y + hoch, p.z + Math.cos(yaw) * dist);
      if(sideView !== 0){
        // von links / rechts: quer zur Blickrichtung, auf Hoehe von Kenji
        const qx = Math.cos(eva.yaw), qz = -Math.sin(eva.yaw);
        soll.set(p.x + qx * 6 * sideView, p.y + 0.6 + 0.6 * (1 - k), p.z + qz * 6 * sideView);
      }
      camera.position.lerp(soll, Math.min(1, 6 * dtCam));
      camera.up.set(0, 1, 0);
      camera.lookAt(p.x, p.y + 0.4, p.z);
      return;
    }
    if(!eva || (intro.phase !== 'warten' && intro.phase !== 'laeuft')) return camOrig();   // ab 'frei': normale Kamera
    const p = eva.group.position, yaw = eva.yaw;
    let a, dist, hoch;
    const t = intro.phase === 'warten' ? 0 : intro.t;
    if(t < INTRO_FAHRT){
      const k = t / INTRO_FAHRT, e = k * k * (3 - 2 * k);
      a = 0; dist = 16 - 9 * e; hoch = 2.2 - 0.6 * e;
    } else {
      const k = Math.min(1, (t - INTRO_FAHRT) / INTRO_DREH), e = k * k * (3 - 2 * k);
      a = Math.PI * e; dist = 7; hoch = 1.6 + 1.0 * e;
    }
    // a = 0: vor ihm (Blickrichtung -Z gedreht um yaw), a = PI: hinter ihm
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const ox = fx * Math.cos(a) - fz * Math.sin(a);
    const oz = fz * Math.cos(a) + fx * Math.sin(a);
    camera.up.set(0, 1, 0);
    camera.position.set(p.x + ox * dist, p.y + hoch, p.z + oz * dist);
    camera.lookAt(p.x, p.y + KENJI_H * 0.65, p.z);
  };
}

// ---- Schwimmen -------------------------------------------------------------------------------
// Laeuft Kenji ins Meer, schwimmt er (statt im Schlauchboot zu sitzen): linker Stick bewegt und
// dreht ihn, RT taucht ab, LT taucht auf (Tastatur: E / Q). An Land steht er wieder auf.
const SCHWIMM_V   = 1.8;     // m/s
const TAUCH_V     = 1.4;     // m/s auf und ab
const SCHWIMM_TIEF = 0.9;    // m: so tief liegt der Koerper an der Oberflaeche im Wasser
const sw = story.schwimm = { aktiv: false };

function schwimmStart(x, z){
  sw.aktiv = true;
  const g = eva.group;
  g.position.set(x, seaYAt(x, z) - SCHWIMM_TIEF, z);
  eva.vy = 0; eva.onGround = true;
  evaJumpFrom = null;
}

function tauchEingabe(){
  let d = 0;
  if(keys['KeyE']) d -= 1;
  if(keys['KeyQ']) d += 1;
  if(gamepadIndex !== null){
    const gp = navigator.getGamepads()[gamepadIndex];
    if(gp){
      d -= gp.buttons[7] ? gp.buttons[7].value : 0;    // RT = runter
      d += gp.buttons[6] ? gp.buttons[6].value : 0;    // LT = rauf
    }
  }
  return Math.max(-1, Math.min(1, d));
}

function schwimmUpdate(dt, inp){
  const g = eva.group;
  eva.yaw -= (inp.yaw || 0) * EVA_TURN * dt;
  g.rotation.y = eva.yaw;
  const v = -(inp.pitch || 0) * SCHWIMM_V;
  const nx = g.position.x - Math.sin(eva.yaw) * v * dt;
  const nz = g.position.z - Math.cos(eva.yaw) * v * dt;
  tricks.ausschlag = Math.abs(inp.pitch || 0);
  // Ans Ufer: wieder zu Fuss
  if(evaSolid(nx, nz) && !isOpenWater(nx, nz) || isOnBeach(nx, nz) || isOnLand(nx, nz)){
    sw.aktiv = false;
    g.position.set(nx, evaFootY(nx, nz), nz);
    eva.vy = 0; eva.onGround = true;
    return;
  }
  g.position.x = nx; g.position.z = nz;
  const oben = seaYAt(nx, nz, dt) - SCHWIMM_TIEF;
  const unten = seabedY(nx, nz) + 1.0;
  let y = g.position.y + tauchEingabe() * TAUCH_V * dt;
  // ohne Tauch-Eingabe treibt er langsam nach oben
  if(tauchEingabe() === 0 && y < oben) y = Math.min(oben, y + 0.4 * dt);
  g.position.y = Math.max(unten, Math.min(oben, y));
  eva.onGround = true;
  state.pos.copy(eva.planeAt);
  evaKmh = Math.abs(v) * 3.6;
}

function hookSchwimmen(){
  evaEnterDinghy = function(x, z){ if(eva && !eva.boat && !sw.aktiv) schwimmStart(x, z); };
}

// ---- Warp: Bewegungsstreifen statt Ring ------------------------------------------------------
// Ab Warp 1 rasen Lichtstreifen von vorn an der Kamera vorbei. Mit dem Warpfaktor (1 -> 10) wachsen
// LINEAR: Zahl der Streifen, ihre Laenge, Geschwindigkeit und Helligkeit – und sie ruecken naeher an
// die Flugachse. Die normalen Kometenstreifen der Engine (unter Warp 1) bleiben.
const WS_N      = 420;       // Streifen insgesamt (bei Warp 10 alle sichtbar)
const WS_TIEFE  = 1400;      // m: so weit vor der Kamera tauchen sie auf
const WS_R_MAX  = 520;       // m Abstand zur Flugachse bei Warp 1 ...
const WS_R_MIN  = 70;        // ... und bei Warp 10
const WS_V_MIN  = 400;       // m/s scheinbare Geschwindigkeit bei Warp 1 ...
const WS_V_MAX  = 5200;      // ... und bei Warp 10
const WS_L_MIN  = 30;        // m Streifenlaenge bei Warp 1 ...
const WS_L_MAX  = 420;       // ... und bei Warp 10
const ws = { mesh: null, mat: null, z: null, a: null, r: null };
const _wsM = new THREE.Matrix4(), _wsQ = new THREE.Quaternion(), _wsP = new THREE.Vector3(),
      _wsS = new THREE.Vector3(), _wsF = new THREE.Vector3(), _wsU = new THREE.Vector3(),
      _wsR = new THREE.Vector3(), _wsX = new THREE.Vector3(1, 0, 0);

function wsEnsure(){
  if(ws.mesh) return;
  ws.mat = new THREE.MeshBasicMaterial({ map: makeCometTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  ws.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), ws.mat, WS_N);
  ws.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ws.mesh.frustumCulled = false;
  ws.mesh.renderOrder = 996;
  ws.z = new Float32Array(WS_N); ws.a = new Float32Array(WS_N); ws.r = new Float32Array(WS_N);
  for(let i = 0; i < WS_N; i++){ ws.z[i] = Math.random() * WS_TIEFE; wsNeu(i); }
  scene.add(ws.mesh);
}
function wsNeu(i){
  ws.a[i] = Math.random() * Math.PI * 2;
  ws.r[i] = 0.25 + Math.random() * 0.75;        // Anteil am Radius (nicht genau auf der Achse)
}
function updateWarpStreifen(dt){
  if(warpRing) warpRing.visible = false;         // der Ring entfaellt
  const warp = locale === 'space' ? state.vel.length() / SPACE_C : 0;
  const k = Math.max(0, Math.min(1, (warp - 1) / (WARP_MAX - 1)));   // 0 bei Warp 1, 1 bei Warp 10
  if(warp < 1){ if(ws.mesh) ws.mesh.visible = false; return; }
  wsEnsure();
  ws.mesh.visible = true;
  const n = Math.round(WS_N * (0.12 + 0.88 * k));
  const R = WS_R_MAX + (WS_R_MIN - WS_R_MAX) * k;
  const v = WS_V_MIN + (WS_V_MAX - WS_V_MIN) * k;
  const L = WS_L_MIN + (WS_L_MAX - WS_L_MIN) * k;
  ws.mat.opacity = 0.35 + 0.6 * k;
  // Achsen: vorn = Flugrichtung, dazu zwei Querachsen
  _wsF.set(0, 0, -1).applyQuaternion(state.quat);
  _wsU.set(0, 1, 0).applyQuaternion(state.quat);
  _wsR.crossVectors(_wsF, _wsU);
  _wsQ.setFromUnitVectors(_wsX, _wsF);           // Streifen (Ebene in X) entlang der Flugrichtung
  _wsS.set(L, 1.1 + 1.4 * k, 1);
  const c = camera.position;
  for(let i = 0; i < WS_N; i++){
    if(i >= n){ _wsM.makeScale(0, 0, 0); ws.mesh.setMatrixAt(i, _wsM); continue; }
    ws.z[i] -= v * dt;
    if(ws.z[i] < -L){ ws.z[i] += WS_TIEFE + L; wsNeu(i); }
    const rr = R * ws.r[i], a = ws.a[i];
    _wsP.copy(c).addScaledVector(_wsF, ws.z[i])
      .addScaledVector(_wsR, Math.cos(a) * rr).addScaledVector(_wsU, Math.sin(a) * rr);
    _wsM.compose(_wsP, _wsQ, _wsS);
    ws.mesh.setMatrixAt(i, _wsM);
  }
  ws.mesh.instanceMatrix.needsUpdate = true;
}
function hookWarp(){
  const updateWarpOrig = updateWarp;
  updateWarp = function(dt){
    const r = updateWarpOrig.apply(this, arguments);
    updateWarpStreifen(dt);
    return r;
  };
}

// ---- Globus-Reise ---------------------------------------------------------------------------
// Zwischen zwei Etappen: Schwarzblende -> Globus, der Faden waechst vom letzten zum neuen Ort ->
// Schwarzblende. Der Weg bleibt gespeichert (story.reise): je mehr Etappen, desto laenger der Faden.
const ORTE = [
  { name: 'Start: München',              lat: 48.14, lon: 11.58 },
  { name: 'Etappe 2: Die Wüste',         lat: 23.5, lon:  46.0 },
  { name: 'Etappe 3: Der Indische Ozean',lat:  8.0, lon:  73.0 },
  { name: 'Etappe 4: Südostasien',       lat:  3.0, lon: 101.0 },
  { name: 'Etappe 5: Chinesisches Meer', lat: 22.3, lon: 114.2 },
  { name: 'Etappe 6: Japan – Fukuoka',   lat: 33.59, lon: 130.40 },  // Ziel: dort wohnt Kenjis Freund
];
story.reise = [0];                 // besuchte Orte (Index in ORTE), Start ist immer dabei
const GLOBUS_R = 1;
const GLOBUS_FAHRT = 4.5;          // s Kamerafahrt + Faden waechst
const GLOBUS_HALT = 2.5;           // s danach stehen bleiben
const gl = { szene: null, kam: null, erde: null, faden: null, punkte: null, aktiv: false, t: 0,
             von: 0, nach: 0, fertig: null, textEl: null };

function latLon(lat, lon, r){
  const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
}
// Grosskreis zwischen zwei Orten, leicht ueber der Oberflaeche (Bogen hebt sich in der Mitte)
function bogen(a, b, n){
  const va = latLon(a.lat, a.lon, 1), vb = latLon(b.lat, b.lon, 1);
  const out = [];
  const w = va.angleTo(vb);
  for(let i = 0; i <= n; i++){
    const t = i / n;
    const v = new THREE.Vector3().copy(va).multiplyScalar(Math.sin((1 - t) * w) / Math.sin(w))
      .addScaledVector(vb, Math.sin(t * w) / Math.sin(w));
    v.normalize().multiplyScalar(GLOBUS_R * (1.01 + 0.09 * Math.sin(Math.PI * t)));
    out.push(v);
  }
  return out;
}

function globusBauen(){
  if(gl.szene) return;
  gl.szene = new THREE.Scene();
  gl.szene.background = new THREE.Color(0x02040a);
  gl.kam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 100);
  gl.szene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sonne = new THREE.DirectionalLight(0xffffff, 0.9); sonne.position.set(3, 2, 4);
  gl.szene.add(sonne);
  // Sterne
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(1500 * 3);
  for(let i = 0; i < 1500; i++){
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(30 + Math.random() * 20);
    sp[i*3] = v.x; sp[i*3+1] = v.y; sp[i*3+2] = v.z;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  gl.szene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08 })));
  // Erde: eigene Kugel (bekannte UV-Abbildung), Textur aus dem Erd-GLB der Engine
  gl.erde = new THREE.Mesh(new THREE.SphereGeometry(GLOBUS_R, 64, 48),
    new THREE.MeshLambertMaterial({ color: 0x3a6ea5 }));
  gl.szene.add(gl.erde);
  if(window.EARTH_GLB && THREE.GLTFLoader){
    const b64 = window.EARTH_GLB.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    new THREE.GLTFLoader().parse(bytes.buffer, '', (g) => {
      g.scene.traverse(o => { if(o.isMesh && o.material && o.material.map && !gl.erde.material.map){
        const tex = o.material.map;
        // Die Karte im GLB liegt auf dem Kopf (Sueden oben): hier wieder richtig herum
        tex.flipY = !tex.flipY; tex.needsUpdate = true;
        gl.erde.material.map = tex; gl.erde.material.color.set(0xffffff); gl.erde.material.needsUpdate = true;
      } });
    }, (e) => console.warn('Globus-Textur:', e));
  }
  gl.punkte = new THREE.Group(); gl.erde.add(gl.punkte);
  gl.faden = new THREE.Group(); gl.erde.add(gl.faden);
}

function punkt(ort, farbe, gross){
  const m = new THREE.Mesh(new THREE.SphereGeometry(gross ? 0.028 : 0.02, 16, 12),
    new THREE.MeshBasicMaterial({ color: farbe }));
  m.position.copy(latLon(ort.lat, ort.lon, GLOBUS_R * 1.012));
  gl.punkte.add(m);
}
function fadenStueck(a, b, anteil){
  const pts = bogen(a, b, 48);
  const n = Math.max(2, Math.round(pts.length * anteil));
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, n)), Math.max(4, n * 2), 0.009, 8, false);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe02020 }));
  gl.faden.add(m);
  return m;
}
// Zustand zeichnen: alle bisherigen Fadenstuecke + Punkte, das letzte Stueck bis "anteil"
function globusZeichnen(anteil){
  gl.punkte.clear(); gl.faden.clear();
  const r = story.reise;
  for(let i = 1; i < r.length; i++){
    const letztes = i === r.length - 1;
    fadenStueck(ORTE[r[i - 1]], ORTE[r[i]], letztes ? anteil : 1);
  }
  punkt(ORTE[0], 0x3b82ff, true);                                   // Start blau
  for(let i = 1; i < r.length; i++){
    if(i === r.length - 1 && anteil < 1) continue;                  // neuer Punkt erst bei Ankunft
    if(r[i] !== ORTE.length - 1) punkt(ORTE[r[i]], 0xffd23f, false); // Etappen gelb
  }
  punkt(ORTE[ORTE.length - 1], 0xb04cff, true);                     // Ziel Japan lila
}

// Kamera: schaut auf einen Punkt zwischen "von" und "nach", sanft dazwischen
function globusKamera(k){
  const a = ORTE[gl.von], b = ORTE[gl.nach];
  const e = k * k * (3 - 2 * k);
  const lat = a.lat + (b.lat - a.lat) * e, lon = a.lon + (b.lon - a.lon) * e;
  const v = latLon(lat, lon, 1).normalize();
  gl.kam.position.copy(v).multiplyScalar(4.2 - 0.6 * Math.sin(Math.PI * e));
  gl.kam.up.set(0, 1, 0);
  gl.kam.lookAt(0, 0, 0);
}

function globusText(text){
  if(!gl.textEl){
    gl.textEl = document.createElement('div');
    gl.textEl.style.cssText = 'position:absolute;left:0;right:0;bottom:12%;text-align:center;color:#fff;'
      + 'font:600 30px system-ui,sans-serif;text-shadow:0 2px 8px #000;pointer-events:none;z-index:26;'
      + 'transition:opacity .6s;';
    document.body.appendChild(gl.textEl);
  }
  gl.textEl.innerHTML = text || '';
  gl.textEl.style.opacity = text ? '1' : '0';
}

// Oeffentlich: reise(nachIndex, tageText, fertig) – Schwarzblende, Globus, Schwarzblende, fertig()
function globusReise(nach, tageText, fertig){
  globusBauen();
  // ein stehendes Platzhalter-Schild (spaetere Etappen) wieder freigeben
  if(schwarzEl){ schwarzEl.innerHTML = ''; schwarzEl.style.transition = 'opacity .8s'; }
  if(story.phase === 'platzhalter') story.phase = 'reise';
  schwarz('', 0.1, () => {
    hudSichtbar(false);                       // kein HUD ueber dem Globus
    gl.von = story.reise[story.reise.length - 1];
    gl.nach = nach;
    story.reise.push(nach);
    gl.aktiv = true; gl.t = 0; gl.fertig = fertig;
    globusZeichnen(0); globusKamera(0);
    globusText(ORTE[nach].name + '<div style="font-size:20px;font-weight:400;margin-top:6px;opacity:.85">'
      + (tageText || '') + '</div>');
    gl.textEl.style.opacity = '0';
  });
}
function globusUpdate(dt){
  gl.t += dt;
  const k = Math.min(1, gl.t / GLOBUS_FAHRT);
  globusZeichnen(k);
  globusKamera(k);
  if(gl.t > 0.6) gl.textEl.style.opacity = '1';
  gl.erde.rotation.y = 0;
  if(gl.t > GLOBUS_FAHRT + GLOBUS_HALT && !gl.ende){
    gl.ende = true;
    schwarz('', 0.6, () => {
      gl.aktiv = false; gl.ende = false;
      globusText('');
      hudSichtbar(true);
      const f = gl.fertig; gl.fertig = null;
      if(f) f();
    });
  }
}
story.globusReise = globusReise;
story.globusAktiv = () => gl.aktiv;

// ---- Hauptschleife ---------------------------------------------------------------------------
function hookLoop(){
  const loopOrig = loop;
  let tPrev = performance.now();
  loop = function(){
    const now = performance.now();
    const dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    if(hilfeOffen()) return loopOrig.apply(this, arguments);   // Pause (Anleitung offen)
    if(gl.aktiv){
      globusUpdate(dt);
      gl.kam.aspect = innerWidth / innerHeight; gl.kam.updateProjectionMatrix();
      renderer.render(gl.szene, gl.kam);
      requestAnimationFrame(loop);
      return;
    }
    updateKenji(dt);
    kenjiWache(dt);
    // Die Schule steht in Weltkoordinaten – Mond/Mars nutzen denselben Raum, dort darf sie nicht stehen
    if(story.schule) story.schule.visible = locale === 'earth';
    kenjiTasten();
    updateAufgabe();
    if(eva && story.phase === 'mars') marsUpdate(dt);
    if(story.updateE2) story.updateE2(dt);
    introDt(dt);
    updateMarken();
    return loopOrig.apply(this, arguments);
  };
}

// ---- Radar -----------------------------------------------------------------------------------
// Zu Fuss: die beiden Wege von Etappe 1 (X-Wing weiss, U-Boot gelb). In Fahrzeugen: story.ziel.
const COL_XWING = '#ffffff', COL_SUB = '#ffd23f', COL_ZIEL = '#ff5a3c';
function hookRadar(){
  const footOrig = footTargets;
  footTargets = function(){
    if(story.etappe !== 1 || locale !== 'earth') return footOrig();
    const out = [{ x: eva.planeAt.x, z: eva.planeAt.z, col: COL_XWING }];
    const rg = ubootRingPlatz();
    if(rg) out.push({ x: rg.x, z: rg.z, col: COL_SUB });
    return out;
  };
  const activeOrig = activeTarget;
  activeTarget = function(){
    if(story.etappe === 1 && !eva && locale === 'earth')      // keine Brandherde o. Ae. aus der Engine
      return story.ziel ? { x: story.ziel.x, z: story.ziel.z, col: COL_ZIEL } : null;
    return activeOrig();
  };
}

// Radar-Anzeige: die SPITZE des Dreiecks ist der eigene Standort. Ist man am Ziel, sitzt der Punkt
// genau auf der Spitze (vorher hielt die Engine 8-10 px Mindestabstand zur Mitte, man musste das
// Ziel "ins Dreieck" bringen). Sonst wie in der Engine; das Periskop (U-Boot) bleibt unveraendert.
function hookRadarAnzeige(){
  // Periskop: die Engine malt ihr Dreieck mittig (Spitze 7 px ueber der Mitte). Danach das alte
  // Dreieck mit Wasserfarbe abdecken (unter dem U-Boot ist nie Land) und das neue mit der Spitze auf
  // der Mitte malen – gleiches Prinzip wie beim Radar.
  //
  // Ausserdem zeigt das Periskop nur nach einem Sonar-Ping (B) ein Bild: voll fuer PERI_HALT s, dann
  // blendet es aus, bis es nach PERI_ZEIT s weg ist. Jeder Ping baut es neu auf und startet die Zeit
  // von vorn. So gewoehnt man sich an, den Ping zu benutzen.
  const PERI_ZEIT = 10, PERI_HALT = 2;
  let periPingT = -1;                                      // s seit dem letzten Ping (-1 = keiner)
  const pingOrig = sonarPing;
  sonarPing = function(){
    const neu = sonarCool <= 0;                            // nur ein echter Ping, nicht in der Sperre
    const r = pingOrig.apply(this, arguments);
    if(neu){ periPingT = 0; periT = 0; }                   // periT = 0: Umgebung jetzt neu abtasten
    return r;
  };
  const periOrig = updatePeriscope;
  updatePeriscope = function(dt){
    const r = periOrig.apply(this, arguments);
    if(!r){ periPingT = -1; return r; }
    if(periPingT >= 0) periPingT += dt || 0;
    const W = radarCv.width, H = radarCv.height, cx = W/2, cy = H/2, R = W/2 - 6, g = radarCtx;
    // Deckkraft des Sonarbilds: 1 bis PERI_HALT, dann linear auf 0 bei PERI_ZEIT
    const sicht = periPingT < 0 ? 0
      : Math.max(0, Math.min(1, 1 - (periPingT - PERI_HALT) / (PERI_ZEIT - PERI_HALT)));
    // Bild mit (1 - sicht) leerer Scheibe ueberdecken
    if(sicht < 1){
      g.save();
      g.globalAlpha = 1 - sicht;
      g.fillStyle = 'rgb(20,70,90)';
      g.beginPath(); g.arc(cx, cy, R - 1, 0, Math.PI*2); g.fill();
      g.restore();
    }
    // altes, mittiges Dreieck abdecken und neues mit der Spitze auf der Mitte malen
    g.fillStyle = 'rgb(20,70,90)';
    g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx - 6.5, cy + 7); g.lineTo(cx + 6.5, cy + 7); g.closePath(); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 5, cy + 13); g.lineTo(cx + 5, cy + 13); g.closePath(); g.fill();
    // ohne Bild: kleiner Hinweis auf den Ping
    if(sicht <= 0){
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = '11px system-ui,sans-serif'; g.textAlign = 'center';
      g.fillText('B: Ping', cx, cy + 30);
    }
    return r;
  };
  updateRadar = function(){
    if(updatePeriscope(dtCam)) return;
    const W = radarCv.width, H = radarCv.height, cx = W/2, cy = H/2, R = W/2 - 6;
    const g = radarCtx;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(10,25,40,0.55)';
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI*2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI*2); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 5, cy + 13); g.lineTo(cx + 5, cy + 13);
    g.closePath(); g.fill();
    const blips = (locale === 'space') ? spaceTargets()
                : eva ? footTargets()
                : (() => { const a = activeTarget(); return a ? [a] : []; })();
    if(!blips.length) return;
    const selfX = eva ? eva.group.position.x : state.pos.x;
    const selfZ = eva ? eva.group.position.z : state.pos.z;
    const head = eva ? eva.yaw + Math.PI
               : (() => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat); return Math.atan2(f.x, f.z); })();
    const RMAX = R - 8;
    const radiusFor = (dist) => {
      if(eva) return Math.min(RMAX, dist/500*RMAX);
      if(locale !== 'space') return Math.min(RMAX, dist/2500*RMAX);
      const NEAR = 1000, FAR = 900000;
      const d = Math.max(NEAR, Math.min(FAR, dist));
      return 12 + Math.log(d/NEAR) / Math.log(FAR/NEAR) * (RMAX - 12);
    };
    for(const t of blips){
      const dx = t.x - selfX, dz = t.z - selfZ;
      const rel = head - Math.atan2(dx, dz);
      const rr = radiusFor(Math.hypot(dx, dz));
      g.fillStyle = t.col;
      g.beginPath(); g.arc(cx + Math.sin(rel)*rr, cy - Math.cos(rel)*rr, 5, 0, Math.PI*2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
    }
  };
}

// ---- Hinweis oben (kurze Aufgabe) ------------------------------------------------------------
let hinweisEl = null;
function hinweis(text){
  if(!hinweisEl){
    hinweisEl = document.createElement('div');
    hinweisEl.style.cssText = 'position:absolute;left:50%;top:14px;transform:translateX(-50%);'
      + 'padding:8px 16px;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;'
      + 'font:17px system-ui,sans-serif;pointer-events:none;z-index:20;transition:opacity .4s;';
    document.body.appendChild(hinweisEl);
  }
  hinweisEl.textContent = text || '';
  hinweisEl.style.opacity = text ? '1' : '0';
}

// ---- Schwarzblende mit Text ------------------------------------------------------------------
// schwarz(text, dauerSek, mitte) : blendet ab, ruft mitte() im Schwarzen, blendet wieder auf.
let schwarzEl = null;
function schwarz(text, dauer, mitte){
  if(!schwarzEl){
    schwarzEl = document.createElement('div');
    schwarzEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;display:flex;'
      + 'align-items:center;justify-content:center;color:#fff;font:600 34px system-ui,sans-serif;'
      + 'text-align:center;transition:opacity .8s;pointer-events:none;z-index:25;';
    document.body.appendChild(schwarzEl);
  }
  schwarzEl.textContent = '';
  schwarzEl.style.opacity = '1';
  setTimeout(() => {
    schwarzEl.textContent = text || '';
    if(mitte) mitte();
    setTimeout(() => { if(story.phase !== 'platzhalter') schwarzEl.style.opacity = '0'; }, (dauer || 2) * 1000);
  }, 900);
}

// ---- Tage ------------------------------------------------------------------------------------
function tageVergangen(n){
  story.tage += n;
  return n === 1 ? 'Ein Tag vergangen' : (n + ' Tage vergangen');
}

// ---- Startsequenz (im Konzept: Preflight-Check; die Stimme kann das Wort nicht sprechen) -----
// Reihenfolge laut Konzept: Bremse halten -> links -> rechts -> hoch -> runter -> Bremse los -> Gas.
// Gewertet wird die Eingabe (in Etappe 1 ohne Kurzschluss). Beliebig oft neu beginnen; 10 s Zeit.
const PF_ZEIT = 10;
const PF_SCHRITTE = ['Bremse halten', 'Links', 'Rechts', 'Hoch', 'Runter', 'Bremse los', 'Gas'];
const pf = story.preflight = { aktiv: false, t: 0, schritt: 0, gruen: false, el: null };

function pfHud(){
  if(!pf.el){
    pf.el = document.createElement('div');
    pf.el.style.cssText = 'position:absolute;left:16px;top:50%;transform:translateY(-50%);'
      + 'padding:12px 16px;border-radius:10px;background:rgba(0,0,0,.6);color:#fff;'
      + 'font:16px/1.6 system-ui,sans-serif;min-width:210px;z-index:20;';
    document.body.appendChild(pf.el);
  }
  const lamp = pf.gruen ? '#2ecc40' : (pf.schritt > 0 ? '#ffb000' : '#e03c31');
  let h = '<div style="display:flex;align-items:center;gap:10px;font-weight:700;margin-bottom:6px">'
    + '<span style="width:16px;height:16px;border-radius:50%;background:' + lamp
    + ';box-shadow:0 0 10px ' + lamp + '"></span>STARTSEQUENZ'
    + (pf.kurzschluss ? '<span title="" style="margin-left:8px;padding:0 6px;border-radius:4px;background:#e03c31;'
        + 'box-shadow:0 0 10px #e03c31;font-size:15px">⇄</span>' : '')
    + '<span style="margin-left:auto;font-family:monospace;font-size:20px">'
    + Math.max(0, PF_ZEIT - pf.t).toFixed(1) + '</span></div>';
  // Keine Anleitung: wer die Startsequenz nicht kennt, soll scheitern (Etappe 1). Nur Leuchte + Zeit.
  pf.el.innerHTML = h;
  pf.el.style.display = pf.aktiv || pf.gruen ? '' : 'none';
}

function pfStart(){
  pf.kurzschluss = story.etappe >= 2;          // Etappe 2: die X-Wing-Falle
  pf.aktiv = true; pf.t = 0; pf.schritt = 0; pf.gruen = false;
  gesehen(pf.kurzschluss ? 'startsequenzKurzschluss' : 'startsequenz');
  hinweis('');
  sprich(['Bitte Startsequenz durchführen!']);
  pfHud();
}

// Eingaben roh lesen (unabhaengig davon, was die Engine daraus macht)
function pfEingabe(inp){
  let bremse = !!keys['KeyC'], gas = !!(keys['ShiftLeft'] || keys['ShiftRight'] || keys['KeyW'] || keys['Space']);
  if(gamepadIndex !== null){
    const gp = navigator.getGamepads()[gamepadIndex];
    if(gp){
      if(gp.buttons[0] && gp.buttons[0].pressed) bremse = true;
      if(gp.buttons[2] && gp.buttons[2].pressed) gas = true;
      if((gp.axes[3] || 0) < -0.5) gas = true;
    }
  }
  const lr = (inp.yaw || 0) + (inp.roll || 0);   // links/rechts: Stick, Pfeile oder LT/RT, Q/E
  const e = { bremse, gas, links: lr < -0.6, rechts: lr > 0.6, hoch: inp.pitch > 0.6, runter: inp.pitch < -0.6 };
  if(!pf.kurzschluss) return e;
  // Kurzschluss: alle Eingaben vertauscht – Bremse <-> Gas, links <-> rechts, hoch <-> runter
  return { bremse: e.gas, gas: e.bremse, links: e.rechts, rechts: e.links, hoch: e.runter, runter: e.hoch };
}

function pfSchritt(e){
  const s = pf.schritt;
  // Bremse muss bis "Bremse los" gehalten werden, sonst von vorne
  if(s >= 1 && s <= 5 && !e.bremse){ pf.schritt = 0; return; }
  if(s === 0){ if(e.bremse) pf.schritt = 1; }
  else if(s === 1){ if(e.links) pf.schritt = 2; }
  else if(s === 2){ if(e.rechts) pf.schritt = 3; }
  else if(s === 3){ if(e.hoch) pf.schritt = 4; }
  else if(s === 4){ if(e.runter) pf.schritt = 5; }
}

function pfUpdate(dt, inp){
  pf.t += dt;
  const e = pfEingabe(inp);
  // "Bremse los" (5 -> 6) und "Gas" (6 -> gruen) hier, weil pfSchritt Loslassen als Abbruch wertet
  if(pf.schritt === 5 && !e.bremse) pf.schritt = 6;
  else if(pf.schritt === 6){
    if(e.bremse) pf.schritt = 1;
    else if(e.gas){ pf.gruen = true; pf.schritt = 7; }
  } else pfSchritt(e);
  pfHud();
  if(pf.gruen){ pfFertig(true); return; }
  if(pf.t >= PF_ZEIT) pfFertig(false);
}

function pfFertig(ok){
  pf.aktiv = false;
  story.preflightZeit = ok ? pf.t : null;
  if(ok){
    neueZeit(pf.kurzschluss ? 'startsequenzKurzschluss' : 'startsequenz', pf.t);   // still speichern
    sprich(['Startsequenz abgeschlossen. Guten Flug!']);
    setTimeout(() => { pf.gruen = false; pfHud(); }, 2500);
    story.phase = 'freiflug';
    story.ziel = story.zielFuer ? story.zielFuer(story.etappe) : { x: 0, z: -9000 };   // Radarpunkt
    story.verdreht = pf.kurzschluss;     // Kurzschluss gilt weiter, bis man am Ziel ist
    hinweis('Folge dem roten Punkt im Radar – Start: X / Shift halten');
    setTimeout(() => hinweis(''), 8000);
  } else {
    pfHud();
    autostart();
  }
}

// ---- Autostart (Startsequenz verpasst) -> Weltall --------------------------------------------
// Die Kamera bleibt am Strand stehen, der X-Wing steigt allein senkrecht und dann steil weg.
const auto = story.autostart = { aktiv: false, t: 0, camPos: null };
function autostart(){
  story.phase = 'autostart';
  auto.aktiv = true; auto.t = 0;
  auto.camPos = camera.position.clone();
  // ein Stueck zurueck und hoeher, damit man den Start sieht
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(state.quat);
  auto.camPos.set(state.pos.x + back.x * 45, state.pos.y + 9, state.pos.z + back.z * 45);
}
function autoUpdate(dt){
  auto.t += dt;
  const q = state.quat;
  if(auto.t < 3.5){
    // Senkrecht abheben
    state.onGround = false;
    state.vel.set(0, Math.min(14, auto.t * 6), 0);
    state.pos.addScaledVector(state.vel, dt);
  } else {
    // Nase hoch und davon
    const k = Math.min(1, (auto.t - 3.5) / 2.5);
    const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
    q.setFromEuler(new THREE.Euler(k * 1.2, yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const v = 20 + (auto.t - 3.5) * 60;
    state.vel.copy(fwd).multiplyScalar(v);
    state.pos.addScaledVector(state.vel, dt);
  }
  state.throttle = 1;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(q);
  if(auto.t > 9 && !auto.blende){
    auto.blende = true;
    schwarz('', 2.5, () => {
      auto.aktiv = false;
      if(story.onWeltall) story.onWeltall();
      else platzhalter('Weiter im Weltall: Mars-Trip (folgt im nächsten Schritt)');
    });
  }
}

// Absturz im Flugzweig von Etappe 1 (Freiflug oder Mars-Trip, egal wo): 7 Tage
function absturzEnde(){
  if(story.ende) return;
  story.ende = true;
  if(mars.phase) mars.phase = 'fertig';
  hinweis('');
  state.vel.set(0, 0, 0);
  etappeEnde(7, story.phase === 'mars' ? 'Absturz auf dem ' + TRIP[mars.ort || 'mars'].ziel + '-Trip' : 'nach Absturz');
}

story.e1aufraeumen = function(){
  for(const m of marken){ m.saeule.visible = m.pfeil.visible = false; if(m.schild) m.schild.visible = false; }
  if(ringMesh) ringMesh.visible = false;
  if(mars.steinObj){ scene.remove(mars.steinObj); mars.steinObj = null; }
  if(ub.padEl) ub.padEl.style.display = 'none';
  if(ub.fotoEl) ub.fotoEl.style.display = 'none';
  if(pf.el) pf.el.style.display = 'none';
  ub.aktiv = false; mars.phase = null; pf.aktiv = false; auto.aktiv = false;
  story.ziel = null;
};

// Etappe 1 geschafft: Globus-Reise nach Etappe 2, dann (vorerst) Platzhalter
function etappeEnde(tage, wie){
  if(story.etappe === 1) story.e1weg = story.phase === 'mars' || mars.phase === 'fertig' ? 'mars'
    : (ub.fotos && Object.keys(ub.fotos).length >= 2 ? 'uboot' : 'xwing');
  story.phase = 'reise';
  story.verdreht = false;                  // Kurzschluss endet mit der Etappe
  const text = tageVergangen(tage) + ' (' + wie + ') · noch ' + (42 - story.tage) + ' von 42 Tagen';
  story.globusReise(story.etappe, text, () => {
    story.etappe++;
    if(story.etappe === 2 && story.etappe2Start){ hinweis(''); story.etappe2Start(); return; }
    platzhalter('Etappe ' + story.etappe + ' (folgt) – Tag ' + story.tage + ' von 42');
  });
}

// Vorlaeufiges Schild fuer noch nicht gebaute Teile
function platzhalter(text){
  story.phase = 'platzhalter';
  schwarzEl.style.transition = 'none';
  schwarzEl.style.opacity = '1';
  schwarzEl.innerHTML = '<div>' + text + '<div style="font-size:18px;opacity:.7;margin-top:12px">(Taste R: neu starten)</div></div>';
  window.addEventListener('keydown', e => { if(e.code === 'KeyR') location.reload(); });
}

// ---- Mars-Trip (Startsequenz verpasst) -------------------------------------------------------
// Nach dem Autostart: im All, Blick zum Mars. Hinfliegen, landen, aussteigen, den leuchtenden Stein
// holen (Y), wieder einsteigen (ohne Startsequenz) und zurueck zur Erde -> 7 Tage.
// Etappe 2 (X-Wing-Falle verpasst): Autopilot zum Mond. Text je nach Etappe 1:
// - war schon auf dem Mars: kurz ("Du schon wieder ...")
// - U-Boot oder Startsequenz geschafft: wie der Mars-Text, nur fuer den Mond (mit Flugerklaerung)
const MOND_KURZ = [
  'Du schon wieder. Wohl immer noch ein wenig nervös, was?',
  'Diesmal war es aber nicht deine Schuld. Der Flieger hatte einen Kurzschluss, deshalb war die Startsequenz nicht wie gewohnt.',
  'Wir haben das wieder automatisch geregelt. Alles andere kennst du schon.',
  'Der Unterschied ist: Diesmal fliegst du zum Mond und holst von dort einen Stein. Bis in einer Woche dann!',
];
function mondLang(){
  return [
    'Hallo. Da hatte der Flieger wohl einen Kurzschluss, deshalb war die Startsequenz nicht wie gewohnt.',
    'Aber keine Sorge, wir haben die Startsequenz und den Start automatisch durchgeführt.',
    'Zur Erinnerung: Du hast dich freiwillig gemeldet, als erster Mensch zum Mond zu fliegen und als Beweis einen Stein mitzubringen.',
  ].concat(MARS_TEXT.slice(3, 9)).concat([MARS_TEXT[9]]);   // Flugerklaerung + Schluss wie beim Mars
}
const TRIP = {
  mars: { text: () => MARS_TEXT, ziel: 'Mars', stein: 'Stein', farbe: 0xff7a2a, glanz: 0xff4400 },
  moon: { text: () => story.e1weg === 'mars' ? MOND_KURZ : mondLang(), ziel: 'Mond', stein: 'Stein', farbe: 0xd8d8e6, glanz: 0x8888aa },
};
function tripOrt(){ return story.etappe >= 2 ? 'moon' : 'mars'; }
const MARS_TEXT = [
  'Hallo. Du bist wohl etwas nervös gewesen.',
  'Aber keine Sorge, wir haben die Startsequenz und den Start automatisch durchgeführt.',
  'Zur Erinnerung: Du hast dich freiwillig gemeldet, als erster Mensch zum Mars zu fliegen und als Beweis einen Stein mitzubringen.',
  'Falls du vergessen hast, wie man fliegt, erklären wir es noch einmal kurz.',
  'Mit dem linken Stick lenkst du und hebst oder senkst die Nase. Mit L T und R T rollst du.',
  'Mit dem rechten Stick stellst du den Schub ein. Bei vollem Schub springt der Warp-Antrieb an, so kommst du schnell zum Mars.',
  'Der rote Punkt im Radar zeigt dir den Weg. Kurz vor dem Mars bremst der Antrieb von selbst ab.',
  'Zum Landen gehst du auf zehn Prozent Schub, dann sinkt der X-Wing langsam und setzt senkrecht auf.',
  'Mit Y steigst du aus und wieder ein. Zum Starten gibst du zwanzig Prozent Schub, dann steigst du senkrecht auf.',
  'Du kommst schon klar. Wir sehen und hören uns dann in einer Woche wieder. Viel Spaß!',
];
const STEIN_R = 4;           // m: so nah muss Kenji fuer Y heran
const mars = story.mars = { phase: null, stein: null, steinObj: null, steinSaeule: null, rede: null };

function marsStart(){
  story.phase = 'mars';
  mars.phase = 'hin';
  // ins All: hoch ueber die Insel, Weltall betreten, dann die Nase auf den Mars richten
  state.pos.set(state.pos.x, SPACE_Y + 2000, state.pos.z);
  state.onGround = false; state.crashed = false;
  enterSpace();
  mars.ort = tripOrt();
  const m = bodyOf(mars.ort);
  if(m){
    const d = m.center.clone().sub(state.pos).normalize();
    state.quat.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d);
  }
  state.vel.set(0, 0, 0); state.throttle = 0.3;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  snapCamera();
  story.verdreht = false;                 // der Autopilot hat uebernommen: Steuerung normal
  mars.rede = sprich(TRIP[mars.ort].text(), () => {
    hinweis('Flieg zum ' + TRIP[mars.ort].ziel + ' und hol ' + (mars.ort === 'moon' ? 'Mondgestein' : 'einen Stein'));
    setTimeout(() => { if(mars.phase === 'hin') hinweis(''); }, 9000);
  });
}

// Stein neben dem Landeplatz: leuchtend orange, mit Lichtsaeule
function marsStein(){
  if(mars.steinObj || mars.stein === 'geholt') return;
  const x = state.pos.x + 22, z = state.pos.z + 10;
  const y = surfaceY(x, z);
  const g = new THREE.Group();
  const stein = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0),   // ein Brocken zum Mitnehmen
    new THREE.MeshLambertMaterial({ color: TRIP[mars.ort || 'mars'].farbe, emissive: TRIP[mars.ort || 'mars'].glanz, emissiveIntensity: 0.9 }));
  stein.position.y = 0.28; stein.rotation.set(0.4, 0.7, 0.2);
  g.add(stein);
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 200, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  saeule.position.y = 100; saeule.renderOrder = 995;
  g.add(saeule);
  g.position.set(x, y, z);
  scene.add(g);
  mars.steinObj = g; mars.stein = { x, z };
}

function marsUpdate(dt){
  if(!mars.phase) return;
  if(mars.steinObj) mars.steinObj.children[0].rotation.y += dt * 1.5;
  if(locale === (mars.ort || 'mars')){
    if(mars.phase === 'hin'){ mars.phase = 'gelandet'; hinweis('Lande mit 10 % Schub, steig mit Y aus und hol das ' + TRIP[mars.ort || 'mars'].stein); }
    if(state.onGround || eva) marsStein();
    if(eva && mars.phase === 'gelandet' && !mars.hinweisWeg){ mars.hinweisWeg = true; hinweis('Hol den leuchtenden Stein'); setTimeout(() => { if(mars.phase === 'gelandet') hinweis(''); }, 6000); }
  } else if(mars.steinObj && locale !== (mars.ort || 'mars')){
    scene.remove(mars.steinObj); mars.steinObj = null;
  }
}

// Y zu Fuss am Stein
function marsSteinNah(){
  if(!eva || !mars.stein || mars.stein === 'geholt' || locale !== (mars.ort || 'mars')) return false;
  const p = eva.group.position;
  return Math.hypot(p.x - mars.stein.x, p.z - mars.stein.z) < STEIN_R;
}
function marsSteinHolen(){
  mars.stein = 'geholt';
  if(mars.steinObj){ scene.remove(mars.steinObj); mars.steinObj = null; }
  mars.phase = 'zurueck';
  blitz();
  const st = TRIP[mars.ort || 'mars'].stein;
  sprich(['Super, du hast das ' + st + '! Jetzt zurück zur Erde.']);
  hinweis('🪨 ' + st + ' an Bord – zurück zur Erde (blauer Punkt)');
  setTimeout(() => { if(mars.phase === 'zurueck') hinweis(''); }, 9000);
}

// Erde erreicht: mit Stein -> 7 Tage; ohne Stein -> zurueck ins All
function marsErde(){
  if(mars.phase === 'zurueck'){
    mars.phase = 'fertig';
    etappeEnde(7, 'mit dem ' + TRIP[mars.ort || 'mars'].ziel + '-Trip');
    return true;
  }
  return false;
}

function hookMars(){
  story.onWeltall = marsStart;
  // Rover gibt es in Etappe 1 nicht (der Stein liegt nah genug)
  const roverObjOrig = roverObjFor;
  roverObjFor = function(){ return story.etappe <= 2 ? null : roverObjOrig.apply(this, arguments); };
  // Y am Stein
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(marsSteinNah()){ marsSteinHolen(); return; }
    return boardYOrig.apply(this, arguments);
  };
  // Zur Erde: mit Stein -> Ende; ohne Stein darf man nicht zurueck (wird ins All zurueckgeschoben)
  const enterEarthOrig = enterEarth;
  enterEarth = function(){
    if(story.etappe <= 2 && mars.phase && mars.phase !== 'fertig'){
      if(marsErde()) return enterEarthOrig.apply(this, arguments);
      // noch kein Stein: ein Stueck von der Erde weg zurueck ins All
      const n = state.pos.clone().sub(earthHome).normalize();
      state.pos.copy(earthHome).addScaledVector(n, EARTH_R + EARTH_Y + 3000);
      state.vel.multiplyScalar(-0.3);
      hinweis('Ohne Stein vom Mars geht es nicht zurück!');
      setTimeout(() => hinweis(''), 4000);
      return;
    }
    return enterEarthOrig.apply(this, arguments);
  };
}

// ---- Kurzschluss im Flug (X-Wing-Falle gemeistert) --------------------------------------------
// Nach geschaffter Startsequenz mit Kurzschluss bleibt die Steuerung vertauscht, bis man am Ziel ist:
// links <-> rechts, hoch <-> runter, rollen gespiegelt; Bremse <-> Gas (C/A <-> Shift/X).
function hookVerdreht(){
  const readInputOrig = readInput;
  readInput = function(){
    const inp = readInputOrig.apply(this, arguments);
    if(!story.verdreht || eva || pf.aktiv) return inp;
    // Bremse (C / A) gibt jetzt Gas
    const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
    if(keys['KeyC'] || (gp && gp.buttons[0] && gp.buttons[0].pressed)) state.throttle = 1;
    return { pitch: -inp.pitch, roll: -inp.roll, yaw: -inp.yaw };
  };
  const boostOrig = boostDruck;
  boostDruck = function(){
    if(story.verdreht && !eva){ state.throttle = -0.2; return; }      // "Gas" bremst
    return boostOrig.apply(this, arguments);
  };
}

// ---- Freiflug zum Radarpunkt ----------------------------------------------------------------
const ZIEL_R = 250;   // m: so nah (waagerecht) muss man ueber den Radarpunkt
function freiflugUpdate(){
  if(locale !== 'earth' || !story.ziel) return;
  if(state.crashed) return;                 // Absturz: nach der Loeschsequenz ueber resetPlane
  const d = Math.hypot(state.pos.x - story.ziel.x, state.pos.z - story.ziel.z);
  if(d < ZIEL_R && !story.ende){
    story.ende = true;
    etappeEnde(1, 'mit dem X-Wing');
  }
}

// ---- U-Boot-Weg ------------------------------------------------------------------------------
// Stimme + Ziffernfeld (Code 14 02 – kommt in Etappe 6 wieder!), dann frei tauchen. Zwei
// UNTERSCHIEDLICHE Wracks fotografieren (X / F) -> 4 Tage. Scheitern kann man hier nicht.
const UBOOT_TEXT = [   // den Code NICHT aussprechen – er steht gross genug im Ziffernfeld
  'Hallo, danke für deine Hilfe.',
  'Du siehst jung aus, und als würdest du zum ersten Mal ein U-Boot fahren. Wir helfen dir.',
  'Wir haben den universellen Code für U-Boote für dich eingegeben.',
  'Jetzt erklären wir dir kurz die Steuerung.',
  'Mit dem rechten Stick oder W und S gibst du Fahrt. Ohne Fahrt kann das U-Boot nicht tauchen.',
  'Linker Stick nach vorn oder Pfeil hoch taucht ab, nach hinten taucht wieder auf. Gelenkt wird nach links und rechts.',
  'Mit B schickst du einen Sonar-Ping: Je näher ein Wrack ist, desto lauter kommt er zurück. Nach jedem Ping zeigt dir die Scheibe oben rechts kurz die Wracks als rote Punkte.',
  'Wir möchten die Wracks nachbauen, um daraus künstliche Riffe zu erschaffen.',
  'Wir wissen, dass es hier in der Nähe viele Wracks gibt.',
  'Finde zwei unterschiedliche Schiffswracks und mache jeweils ein Foto davon, dann können wir der Umwelt helfen.',
  'Fotografiert wird mit X oder F, wenn du nah genug dran bist. Viel Spaß!',
];
const FOTO_R = 130;             // m waagerecht vom Wrack
const FOTO_TIEFE = -10;         // m: getaucht
const ub = story.uboot = { aktiv: false, fotos: {}, rede: null, padEl: null, fotoEl: null, nah: null };

function ziffernfeld(code){
  if(!ub.padEl){
    ub.padEl = document.createElement('div');
    ub.padEl.style.cssText = 'position:absolute;right:16px;bottom:16px;padding:10px;border-radius:10px;'
      + 'background:#1c1f24;border:2px solid #444;box-shadow:0 4px 14px rgba(0,0,0,.5);z-index:20;'
      + 'font-family:monospace;';
    document.body.appendChild(ub.padEl);
  }
  const tasten = ['1','2','3','4','5','6','7','8','9','*','0','#'];
  ub.padEl.innerHTML = '<div style="background:#0b0d0f;color:#ff2a2a;font-size:28px;letter-spacing:4px;'
    + 'padding:4px 10px;margin-bottom:8px;text-align:right;text-shadow:0 0 8px #f00;border-radius:4px">'
    + code + '</div><div style="display:grid;grid-template-columns:repeat(3,34px);gap:5px">'
    + tasten.map(t => '<div style="background:#3a3f46;color:#ddd;text-align:center;line-height:30px;'
      + 'border-radius:4px;font-size:15px">' + t + '</div>').join('') + '</div>';
  ub.padEl.style.display = '';
}

function ubootStart(){
  ub.aktiv = true; story.phase = 'uboot';
  hinweis('');
  ziffernfeld('14 02');
  ub.rede = sprich(UBOOT_TEXT, () => {
    if(ub.padEl) ub.padEl.style.display = 'none';        // Code-Anzeige nach der Ansage weg
    hinweis('Finde zwei unterschiedliche Wracks und fotografiere sie (X / F)');
    setTimeout(() => { if(ub.aktiv) hinweis(''); }, 9000);
  });
}

function fotoAnzeige(){
  if(!ub.fotoEl){
    ub.fotoEl = document.createElement('div');
    ub.fotoEl.style.cssText = 'position:absolute;left:50%;top:60px;transform:translateX(-50%);'
      + 'padding:6px 14px;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;'
      + 'font:16px system-ui,sans-serif;pointer-events:none;z-index:20;';
    document.body.appendChild(ub.fotoEl);
  }
  const n = Object.keys(ub.fotos).length;
  ub.fotoEl.textContent = '📷 Fotos ' + n + '/2' + (ub.nah ? '  ·  X / F: Foto machen' : '');
}

// naechstes Wrack in Fotoreichweite (oder null): getaucht, nah genug und VOR dem U-Boot
// (hoechstens 60 Grad seitlich) – fotografiert wird, was man sieht.
const FOTO_KEGEL = Math.cos(60 * Math.PI / 180);
function wrackNah(){
  if(state.pos.y > FOTO_TIEFE) return null;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  const fl = Math.hypot(fwd.x, fwd.z) || 1;
  let best = null, bd = FOTO_R;
  for(const w of story.wracks){
    const dx = w.wx - state.pos.x, dz = w.wz - state.pos.z;
    const d = Math.hypot(dx, dz);
    if(d >= bd) continue;
    if(d > 20 && (dx * fwd.x + dz * fwd.z) / (d * fl) < FOTO_KEGEL) continue;
    bd = d; best = w;
  }
  return best;
}

let blitzEl = null;
function blitz(){
  if(!blitzEl){
    blitzEl = document.createElement('div');
    blitzEl.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;'
      + 'z-index:24;transition:opacity .5s;';
    document.body.appendChild(blitzEl);
  }
  blitzEl.style.transition = 'none'; blitzEl.style.opacity = '0.85';
  requestAnimationFrame(() => { blitzEl.style.transition = 'opacity .6s'; blitzEl.style.opacity = '0'; });
}

const NAME = { liberty: 'Frachter', sail: 'Segelschiff' };
function fotoMachen(){
  const w = ub.nah;
  if(!w || !ub.aktiv) return;
  blitz();
  if(ub.fotos[w.key]){
    sprich(['Diesen Schiffstyp haben wir schon. Such ein anderes Schiff!']);
    return;
  }
  ub.fotos[w.key] = true;
  const n = Object.keys(ub.fotos).length;
  if(n < 2){
    sprich(['Super, ein ' + NAME[w.key] + '! Jetzt fehlt noch ein anderes Schiff.']);
  } else {
    sprich(['Toll gemacht! Mit beiden Fotos können wir die Riffe bauen. Danke!']);
    ub.aktiv = false; story.phase = 'uboot-fertig';
    ub.nah = null; fotoAnzeige();
    setTimeout(() => {
      ub.fotoEl.style.display = 'none'; ub.padEl.style.display = 'none';
      etappeEnde(4, 'mit dem U-Boot');
    }, 3500);
  }
}

function ubootUpdate(){
  if(!ub.aktiv) return;
  ub.nah = wrackNah();
  fotoAnzeige();
  // X am Controller (sonst Boost) bzw. F: Foto
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  const x = !!(gp && gp.buttons[2] && gp.buttons[2].pressed);
  if(x && !ub.xPrev) fotoMachen();
  ub.xPrev = x;
}
addEventListener('keydown', e => { if(e.code === 'KeyF' && !e.repeat) fotoMachen(); });

// ---- Einsteigen ------------------------------------------------------------------------------
function hookEinsteigen(){
  const subOrig = evaBoardHarborSub;
  evaBoardHarborSub = function(){
    const r = subOrig.apply(this, arguments);
    if(story.etappe === 1 && !story.phase && isSub()) ubootStart();
    return r;
  };
  const boardOrig = evaBoard;
  evaBoard = function(){
    const r = boardOrig.apply(this, arguments);
    if(story.etappe <= 2 && !story.phase && isXWing()) pfStart();
    return r;
  };
  // Waehrend Startsequenz und Autostart: Flieger steht bzw. fliegt allein (keine Physik/Eingabe)
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(pf.aktiv){
      pfUpdate(dt, inp);
      state.vel.set(0, 0, 0); state.throttle = 0;
      return;
    }
    if(auto.aktiv){ autoUpdate(dt); return; }
    if(story.phase === 'platzhalter' || story.phase === 'reise'){ state.vel.set(0, 0, 0); return; }   // Spiel steht hinter Schild/Globus
    const r = physOrig.apply(this, arguments);
    if(story.phase === 'freiflug') freiflugUpdate();
    if(story.phase === 'mars') marsUpdate(dt);
    if(ub.aktiv){ ubootUpdate(); boosting = false; }      // X ist im U-Boot das Foto, kein Boost
    return r;
  };
  // Aussteigen (Y) waehrend Startsequenz/Autostart/danach nicht erlaubt
  const buttonYOrig = buttonY;
  buttonY = function(){
    if(!eva && (pf.aktiv || (story.phase && !(story.phase === 'mars' && GROUNDS[locale])))) return;
    return buttonYOrig.apply(this, arguments);
  };
  // Reset (R) nur gesperrt, solange Story-Sequenzen laufen
  const resetOrig = resetPlane;
  resetPlane = function(){
    if(pf.aktiv || auto.aktiv || story.phase === 'platzhalter' || story.phase === 'reise') return;
    if(story.etappe <= 2 && (story.phase === 'mars' || story.phase === 'freiflug') && state.crashed){
      absturzEnde();
      return;
    }
    return resetOrig.apply(this, arguments);
  };
  // Kamera beim Autostart: bleibt am Boden und schaut dem X-Wing nach
  const camOrig = updateCamera;
  updateCamera = function(){
    if(auto.aktiv){
      camera.up.set(0, 1, 0);
      camera.position.copy(auto.camPos);
      camera.lookAt(state.pos);
      return;
    }
    return camOrig();
  };
}

// ---- Markierung ueber den Fahrzeugen ---------------------------------------------------------
// Leuchtsaeule (wie die Engine sie auf Mond/Mars zeigt) + wippender Pfeil, in der Radarfarbe.
// Nur zu Fuss sichtbar.
const marken = [];
// Schild ueber dem Fahrzeug: was der Weg kostet ("1 Tag" / "4 Tage", wie im Konzept)
function baueSchild(text, col){
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.beginPath(); g.roundRect ? g.roundRect(8, 8, 496, 144, 36) : g.rect(8, 8, 496, 144); g.fill();
  g.font = 'bold 92px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 10; g.strokeStyle = '#000'; g.strokeText(text, 256, 84);
  g.fillStyle = col; g.fillText(text, 256, 84);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv),
    depthTest: false, transparent: true }));
  sp.scale.set(12, 3.75, 1);
  sp.renderOrder = 999;
  scene.add(sp);
  return sp;
}
function baueMarke(col){
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 300, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const pfeil = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12),
    new THREE.MeshBasicMaterial({ color: col }));
  pfeil.rotation.x = Math.PI;                    // Spitze nach unten
  saeule.renderOrder = 995; scene.add(saeule); scene.add(pfeil);
  const m = { saeule, pfeil, schild: null, x: 0, y: 0, z: 0, hoehe: 10 };
  if(story.etappe === 1) marken.push(m);        // Etappe-1-Marken steuert updateMarken
  return m;
}
// Fuer spaetere Etappen: eine Marke (Saeule + Pfeil + Schild) bauen und jedes Bild setzen
story.baueMarke = function(farbe, text){
  const m = baueMarke(farbe);
  m.schild = baueSchild(text, '#' + new THREE.Color(farbe).getHexString());
  return m;
};
story.setzeMarke = function(m, x, y, z, hoehe, zeigen){
  m.saeule.visible = m.pfeil.visible = zeigen;
  if(m.schild) m.schild.visible = zeigen;
  if(!zeigen) return;
  const t = performance.now() / 1000;
  m.saeule.position.set(x, y + 150, z);
  m.pfeil.position.set(x, y + hoehe + Math.sin(t * 2.5) * 0.8, z);
  m.pfeil.rotation.y = t * 1.5;
  if(m.schild){
    const d = Math.hypot(camera.position.x - x, camera.position.z - z);
    const s = Math.max(1, d / 45);
    m.schild.scale.set(12 * s, 3.75 * s, 1);
    m.schild.position.set(x, y + hoehe + 3 + 2.2 * s, z);
  }
};
function setzeMarken(){
  if(!marken.length){
    baueMarke(0xffffff).schild = baueSchild('1 Tag', '#ffffff');
    baueMarke(0xffd23f).schild = baueSchild('4 Tage', '#ffd23f');
  }
  const xp = story.xwingPlatz;
  const info = islandInfo(0, 0), bl = harborSubLocal(0, 0);
  marken[0].x = xp.x; marken[0].z = xp.z; marken[0].y = ISLAND_Y; marken[0].hoehe = 9;
  const rg = ubootRingPlatz();
  if(rg){ marken[1].x = rg.x; marken[1].z = rg.z; marken[1].y = ISLAND_Y; marken[1].hoehe = 6; }
  else if(info && bl){ marken[1].x = info.wx + bl.x; marken[1].z = info.wz + bl.z; marken[1].y = 0; marken[1].hoehe = 16; }
}
function updateMarken(){
  if(!marken.length) return;
  const zeigen = !!eva && story.etappe === 1 && locale === 'earth' && !story.phase
    && steuerbar();
  updateRing(zeigen);
  const t = performance.now() / 1000;
  for(const m of marken){
    m.saeule.visible = m.pfeil.visible = zeigen;
    if(m.schild) m.schild.visible = zeigen;
    if(!zeigen) continue;
    if(m.schild){
      const d = Math.hypot(camera.position.x - m.x, camera.position.z - m.z);
      const s = Math.max(1, d / 45);                 // ab 45 m mitwachsen
      m.schild.scale.set(12 * s, 3.75 * s, 1);
      m.schild.position.set(m.x, m.y + m.hoehe + 3 + 2.2 * s, m.z);
    }
    m.saeule.position.set(m.x, m.y + 150, m.z);
    m.pfeil.position.set(m.x, m.y + m.hoehe + Math.sin(t * 2.5) * 0.8, m.z);
    m.pfeil.rotation.y = t * 1.5;
  }
}

// ---- HUD: zu Fuss "Kenji" statt Fahrzeugname, kein Astronauten-Symbol ------------------------
function hookHud(){
  // Das grosse Bestaetigungssymbol in der Bildmitte zeigt beim Aussteigen einen Astronauten –
  // Kenji ist keiner. Andere Symbole (z. B. U-Boot beim Einsteigen) bleiben.
  const showBigOrig = showBig;
  showBig = function(t){
    if(t && /\u{1F9D1}\u200D\u{1F680}/u.test(t)) t = '';
    return showBigOrig.call(this, t);
  };
  const mdlEl = document.getElementById('mdl');
  const statEl = document.getElementById('status');
  const hudOrig = updateHUD;
  updateHUD = function(){
    const r = hudOrig.apply(this, arguments);
    if(eva){
      if(mdlEl && mdlEl.textContent !== 'Kenji') mdlEl.textContent = 'Kenji';
      if(sw.aktiv){
        const gp = eva.group.position;
        const t = Math.max(0, Math.round(seaYAt(gp.x, gp.z) - gp.y - SCHWIMM_TIEF));
        const lbl = document.getElementById('altlbl'), alt = document.getElementById('alt');
        if(lbl && lbl.textContent !== 'Tiefe') lbl.textContent = 'Tiefe';
        if(alt && alt.textContent !== String(t)) alt.textContent = String(t);
      }
      if(statEl){
        const ein = evaCanBoard() || harborSubNear();
        const s = marsSteinNah() ? 'Y: ' + TRIP[mars.ort || 'mars'].stein + ' aufheben' : (ein ? 'Y: einsteigen' : '');
        if(statEl.textContent !== s) statEl.textContent = s;
      }
    } else if(mdlEl && mdlEl.textContent !== MODEL_NAMES[currentModel]){
      mdlEl.textContent = MODEL_NAMES[currentModel];
    }
    return r;
  };
}

// ---- Kenji-Absicherung + Diagnose (?debug) ---------------------------------------------------
// Gemeldet: Kenji kurz sichtbar, dann unsichtbar (Schatten bleibt). Lokal nicht nachstellbar.
// Deshalb: jedes Bild pruefen, dass Kenji in eva.group haengt und sichtbar ist; mit ?debug in der
// URL steht unten links eine Zeile mit dem Zustand.
const DEBUG = /[?&]debug\b/.test(location.search);
let dbgEl = null, dbgT = 0;
function kenjiWache(dt){
  if(!kenji.obj || !eva || !eva.group || eva.rover || eva.boat) return;
  if(kenji.obj.parent !== eva.group){
    eva.group.clear(); eva.group.add(kenji.obj); kenji.last = null;
    story.kenjiRepariert = (story.kenjiRepariert || 0) + 1;
  }
  eva.group.visible = true;
  kenji.obj.traverse(o => { o.visible = true; if(o.isMesh) o.frustumCulled = false; });
  if(!DEBUG) return;
  dbgT -= dt; if(dbgT > 0) return; dbgT = 0.5;
  if(!dbgEl){
    dbgEl = document.createElement('div');
    dbgEl.style.cssText = 'position:absolute;left:8px;bottom:28px;color:#ff0;font:12px monospace;'
      + 'background:rgba(0,0,0,.5);padding:4px 6px;z-index:40;pointer-events:none;white-space:pre;';
    document.body.appendChild(dbgEl);
  }
  const p = eva.group.position, w = new THREE.Vector3(), s = new THREE.Vector3();
  let mesh = null; kenji.obj.traverse(o => { if(o.isMesh) mesh = o; });
  if(mesh){ mesh.getWorldPosition(w); mesh.getWorldScale(s); }
  const gl = renderer.getContext(), di = gl.getExtension('WEBGL_debug_renderer_info');
  dbgEl.textContent = 'Kenji ' + kenji.cur + ' eva=' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ',' + p.z.toFixed(1)
    + ' mesh=' + w.x.toFixed(1) + ',' + w.y.toFixed(1) + ',' + w.z.toFixed(1) + ' skal=' + s.x.toFixed(2)
    + ' repariert=' + (story.kenjiRepariert || 0) + '\n'
    + (di ? gl.getParameter(di.UNMASKED_RENDERER_WEBGL) : '') + ' | ' + navigator.userAgent.slice(0, 90);
}

// ---- Anleitung (D-Pad hoch / H) und Aufgabe (D-Pad links / T) --------------------------------
// Die Anleitung nutzt das #hint-Overlay der Engine: solange es offen ist, steht das Spiel still.
// Die Aufgabe ist ein eigenes Fenster im selben Stil und laeuft NICHT als Pause – sonst gewaenne
// man damit Bedenkzeit (z. B. waehrend der 10 s Startsequenz).
const ANLEITUNG = [
  ['🎮 Controller', [
    ['L-Stick', 'laufen · bis zur Hälfte gehen, weiter rennen'],
    ['R-Stick', 'umsehen'],
    ['A', 'springen'],
    ['B', 'Aerial Evade'],
    ['L3 (halten) + L-Stick', 'Moonwalk'],
    ['X', 'Silly Dance'],
    ['Y', 'Butterfly Twirl · am Fahrzeug: einsteigen'],
    ['im Wasser', 'L-Stick schwimmen · RT tauchen · LT auftauchen'],
    ['D-Pad ↑', 'diese Anleitung (Pause)'],
    ['D-Pad ←', 'aktuelle Aufgabe (Pause)'],
    ['D-Pad ↓', 'Ton an (Stimme) / aus (Untertitel)'],
  ]],
  ['⌨️ Tastatur', [
    ['↑ ↓ ← →', 'laufen und drehen'],
    ['J L I K', 'umsehen'],
    ['Leertaste', 'springen'],
    ['B', 'Aerial Evade'],
    ['M (halten) + Pfeile', 'Moonwalk'],
    ['X / Y', 'Silly Dance / Butterfly Twirl'],
    ['Y am Fahrzeug', 'einsteigen (U-Boot: im gelben Ring am Strand)'],
    ['im Wasser', 'Pfeile schwimmen · E tauchen · Q auftauchen'],
    ['H / T', 'Anleitung / Aufgabe (Pause)'],
    ['N', 'Ton an (Stimme) / aus (Untertitel)'],
  ]],
  ['✈️ Im X-Wing', [
    ['L-Stick / Pfeile', 'lenken, Nase hoch/runter'],
    ['LT / RT · Q / E', 'rollen'],
    ['R-Stick ↕ · W / S', 'Schub'],
    ['X · Shift', 'Boost / Senkrechtstart'],
    ['A · C', 'Bremse'],
  ]],
];
function aufgabeText(){
  if(pf.aktiv) return ['Startsequenz', [
    ['Zeit', '10 Sekunden'],
  ]];
  if(story.phase === 'mars') return [TRIP[mars.ort || 'mars'].ziel + '-Trip', [
    ['Ziel', mars.phase === 'zurueck' ? 'zurück zur Erde (blauer Punkt im Radar)' : TRIP[mars.ort || 'mars'].ziel + ' im Radar, ' + TRIP[mars.ort || 'mars'].stein + ' holen'],
    ['Warp', '100 % Schub halten'],
    ['Landen', '10 % Schub, senkrecht aufsetzen'],
    ['Stein', 'aussteigen (Y), hinlaufen, Y'],
    ['Starten', '20 % Schub: senkrecht hoch'],
  ]];
  if(story.phase === 'freiflug') return ['Ziel', [
    ['Radar', 'fliege zum roten Punkt'],
    ['Zeit', 'Fliegen kostet keine Zeit – erst über dem Ziel geht es weiter'],
  ]];
  return ['Etappe 1: Der Aufbruch am Strand', [
    ['X-Wing (weiß)', '1 Tag Reisedauer, aber riskant'],
    ['U-Boot (gelb)', '4 Tage Reisedauer'],
    ['Einsteigen', 'hinlaufen und Y drücken'],
    ['Zeit', (42 - story.tage) + ' von 42 Tagen übrig'],
  ]];
}
function hilfeHtml(spalten){
  return spalten.map(([titel, zeilen]) => '<div class="hcol"><div class="htitle">' + titel + '</div>'
    + zeilen.map(([k, v]) => '<div class="hrow"><span>' + k + '</span><b>' + v + '</b></div>').join('')
    + '</div>').join('');
}
function hilfeEl(){ return document.getElementById('hint'); }
function hilfeOffen(){ const h = hilfeEl(); return !!(h && h.classList.contains('show')); }
let aufgabeEl = null, aufgabeAuf = false;
function zeigeHilfe(art){
  if(art === 'aufgabe'){
    if(!aufgabeEl){
      aufgabeEl = document.createElement('div');
      aufgabeEl.id = 'aufgabe';
      // gleicher Stil wie #hint (siehe index.html), aber eigenes Element -> keine Pause
      aufgabeEl.style.cssText = 'position:absolute;bottom:12px;left:12px;color:#fff;display:none;gap:26px;'
        + 'background:rgba(10,25,40,0.72);border-radius:10px;padding:12px 16px;font-size:13px;'
        + 'line-height:1.55;pointer-events:none;user-select:none;z-index:15;';
      document.body.appendChild(aufgabeEl);
    }
    aufgabeAuf = !aufgabeAuf;
    if(aufgabeAuf){ const h = hilfeEl(); if(h) h.classList.remove('show'); }
    aufgabeEl.style.display = aufgabeAuf ? 'flex' : 'none';
    return;
  }
  const h = hilfeEl(); if(!h) return;
  if(hilfeOffen()){ h.classList.remove('show'); return; }
  h.innerHTML = hilfeHtml(ANLEITUNG);
  h.classList.add('show');
  if(aufgabeAuf) zeigeHilfe('aufgabe');      // Aufgabe schliessen, damit sich nichts ueberlappt
}
// Inhalt der Aufgabe folgt dem Spielstand (Phase, Tage), solange sie offen ist
function updateAufgabe(){
  if(!aufgabeAuf || !aufgabeEl) return;
  const html = hilfeHtml([aufgabeText()]).replace(/class="hcol"/, 'class="hcol" style="min-width:210px"');
  if(aufgabeEl._html !== html){ aufgabeEl.innerHTML = html; aufgabeEl._html = html; }
}
function hookHilfe(){
  { const h = hilfeEl(); if(h) h.innerHTML = hilfeHtml(ANLEITUNG); }   // Flugspiel-Text sofort weg
  const st = document.createElement('style');
  st.textContent = '#aufgabe .htitle{font-weight:bold;font-size:14px;margin-bottom:5px;color:#cfe}'
    + '#aufgabe .hrow{display:flex;justify-content:space-between;gap:10px}'
    + '#aufgabe .hrow span{color:#9cf;white-space:nowrap}';
  document.head.appendChild(st);
  toggleHelp = function(){ zeigeHilfe('anleitung'); };
  addEventListener('keydown', e => { if(e.code === 'KeyT' && !e.repeat) zeigeHilfe('aufgabe'); });
  // D-Pad links (14) – die Engine wertet es nicht aus, also eigene Flanke
  let prev = false;
  (function pad(){
    const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
    const d = !!(gp && gp.buttons[14] && gp.buttons[14].pressed);
    if(d && !prev) zeigeHilfe('aufgabe');
    prev = d;
    requestAnimationFrame(pad);
  })();
}

// ---- Startszene ------------------------------------------------------------------------------
function startStrand(){
  placeAtStart('XWing');           // -> findStart-Wrapper: am Strand
  fadeHold = 0; flashFade(1.0);    // den Hangar-Vorhang der Engine nicht abwarten
  evaExit();                       // Kenji steht neben dem X-Wing ...
  introVorbereiten();              // ... und wird vor die Schultuer gestellt
  setzeMarken();
}

window.STORY_HOOK = function(){
  hookWelt();
  hookKenji();
  hookIntro();
  hookRadar();
  hookRadarAnzeige();
  hookEinsteigen();
  hookHud();
  hookHilfe();
  hookTon();
  hookSchwimmen();
  hookWarp();
  hookMars();
  hookVerdreht();
  hookLoop();
};
window.STORY_START = function(){
  startStrand();
};
story.onIntroEnde = function(){
  hinweis('Zwei Wege: X-Wing (weiß) oder U-Boot (gelb) – hinlaufen und Y drücken');
  setTimeout(() => { if(eva) hinweis(''); }, 12000);
};
})();
