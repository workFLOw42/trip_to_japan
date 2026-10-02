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
  harborBoatLocal = function(){ return null; };     // Loeschboot am Strand: weder Modell noch Einstieg
  evaStartJet = function(){};
  // Ohne Traeger braucht es auch das Traeger-Modell nicht. Sein Lade-Callback ruft ausserdem
  // placeAtStart auf, das Kenji (EVA) wieder einsammeln wuerde.
  preloadFord = function(){};
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear();

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

// Parkplatz des X-Wings: auf dem Land knapp vor dem Sand, ~50 Grad entlang des Strandes neben dem
// U-Boot-Liegeplatz – so stehen die beiden nicht hintereinander in einer Sichtachse.
// Gesucht wird in kleinen Schritten, bis kein Gebaeude im Weg steht.
const XWING_VERSATZ = 0.9;   // rad entlang des Strandes
function xwingStrandPlatz(){
  const info = islandInfo(0, 0);
  const bl = harborSubLocal(0, 0);
  const a0 = (bl ? Math.atan2(bl.z, bl.x) : -Math.PI/2) + XWING_VERSATZ;
  for(let s = 0; s <= 24; s++){
    for(const v of (s === 0 ? [0] : [1, -1])){
      const a = a0 + v * s * 0.04;
      for(const f of [0.9, 0.85, 0.8]){
        const x = info.wx + Math.cos(a) * info.radius * f;
        const z = info.wz + Math.sin(a) * info.radius * f;
        if(!isOnLand(x, z)) continue;
        if(hitsBuilding(x, ISLAND_Y + 2, z, false)) continue;
        // Nase zum Wasser (radial nach aussen): Gesicht -Z  ->  yaw = atan2(-dx, -dz)
        return { x, z, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) };
      }
    }
  }
  return { x: info.wx, z: info.wz + 110, yaw: 0 };   // Notfall: Landebahn
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
  if(name !== TRICK_CLIP.tanz && name !== TRICK_CLIP.twirl){ a.setLoop(THREE.LoopRepeat); a.clampWhenFinished = false; }
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
//   A / Leertaste = springen · B (halten) = Moonwalk · X = Silly Dance · Y = Butterfly Twirl
// Am Fahrzeug bleibt Y Einsteigen. Tanz/Twirl spielen einmal ab; Stick bewegen bricht sie ab.
const GEH_MAX = 0.3;          // Anteil von EVA_SPEED bei 50 % Stick (≈ 1,8 m/s)
const TRICK_CLIP = { tanz: 'dance_silly', twirl: 'butterfly_twirl' };
const tricks = story.tricks = { aktiv: null, t: 0, moon: false, ausschlag: 0, prev: {} };

function amFahrzeug(){ return !!eva && (evaCanBoard() || !!harborSubNear()); }

// Rohzustand der vier Tasten (Controller + Tastatur)
function trickTasten(){
  const k = { a: !!keys['Space'], b: !!keys['KeyB'], x: !!keys['KeyX'], y: !!keys['KeyY'] };
  if(gamepadIndex !== null){
    const gp = navigator.getGamepads()[gamepadIndex];
    if(gp){
      const d = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      k.a = k.a || d(0); k.b = k.b || d(1); k.x = k.x || d(2); k.y = k.y || d(3);
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
  if(!eva || eva.rover || eva.boat || intro.phase !== 'aus') return inp;
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
const tippTaste = { Space: 'a', KeyX: 'x', KeyY: 'y' };
const getippt = {};
addEventListener('keydown', e => { if(!e.repeat && tippTaste[e.code]) getippt[tippTaste[e.code]] = true; });

// Tasten auswerten (Flanken), einmal pro Bild
function kenjiTasten(){
  if(!eva || eva.rover || eva.boat || intro.phase !== 'aus' || story.phase){
    for(const n in getippt) delete getippt[n];
    return;
  }
  const k = trickTasten(), pr = tricks.prev;
  const neu = n => (k[n] && !pr[n]) || getippt[n];
  const frei = !amFahrzeug();
  if(neu('a') && eva.onGround){ tricks.aktiv = null; evaJumpOrig(); }
  tricks.moon = frei && k.b;
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
function sprich(saetze, fertig){
  let i = 0, done = false, timer = null;
  const synth = window.speechSynthesis;
  const stimme = synth && synth.getVoices().find(v => /^de/i.test(v.lang));
  function naechster(){
    clearTimeout(timer);
    if(done) return;
    if(i >= saetze.length){ done = true; untertitel(''); if(fertig) fertig(); return; }
    const s = saetze[i++];
    untertitel(s);
    const dauer = 1200 + s.split(/\s+/).length * 420;   // Ersatz-Takt ohne Stimme
    if(synth && story.ton && soundOn){
      const u = new SpeechSynthesisUtterance(s);
      u.lang = 'de-DE'; if(stimme) u.voice = stimme; u.rate = 1.0;
      u.onend = naechster; u.onerror = naechster;
      synth.speak(u);
      timer = setTimeout(naechster, dauer * 2.5);       // falls onend nie kommt
    } else {
      timer = setTimeout(naechster, dauer);
    }
  }
  naechster();
  return { abbrechen(){ done = true; clearTimeout(timer); if(synth) synth.cancel(); untertitel(''); } };
}

// ---- Startbildschirm -------------------------------------------------------------------------
function startbildschirm(weiter){
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;'
    + 'justify-content:center;background:rgba(0,0,0,.55);color:#fff;font-family:system-ui,sans-serif;'
    + 'z-index:30;cursor:pointer;text-align:center;';
  el.innerHTML = '<div style="font-size:52px;font-weight:700;letter-spacing:1px">Trip to Japan</div>'
    + '<div style="font-size:20px;margin-top:18px;opacity:.85">Klicken oder Taste drücken zum Starten</div>';
  document.body.appendChild(el);
  let los = false;
  function start(e){
    if(e && e.stopPropagation) e.stopPropagation();
    if(los) return; los = true;
    el.remove();
    window.removeEventListener('keydown', start, true);
    story.ton = true;
    if(!soundOn) toggleSound();      // die Geste erlaubt jetzt Audio: Ton an (D-Pad runter / N schaltet um)
    weiter();
  }
  el.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start, true);
  // Gamepad: jede Taste startet
  (function pad(){
    if(los) return;
    for(const gp of (navigator.getGamepads ? navigator.getGamepads() : [])){
      if(gp && gp.buttons.some(b => b.pressed)){ start(); return; }
    }
    requestAnimationFrame(pad);
  })();
}

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
const INTRO_FAHRT = 9;     // s: Kamera faehrt von vorne auf Kenji zu
const INTRO_DREH  = 7;     // s: Kamera kreist 180° hinter ihn

// Startpunkt vor der Schultuer: vom X-Wing ins Inselinnere, auf freiem Weg (keine Gebaeude).
function introPlatz(){
  const p = story.xwingPlatz;
  const info = islandInfo(0, 0);
  let dx = info.wx - p.x, dz = info.wz - p.z;
  const n = Math.hypot(dx, dz) || 1; dx /= n; dz /= n;
  let best = 30;
  for(let d = 30; d <= 70; d += 2){
    let frei = true;
    for(let s = 0; s <= d + 12 && frei; s += 2){
      const x = p.x + dx * s, z = p.z + dz * s;
      if(!isOnLand(x, z) || hitsBuilding(x, ISLAND_Y + 1, z, false)) frei = false;
    }
    if(!frei) break;
    best = d;
  }
  return { x: p.x + dx * best, z: p.z + dz * best,
           yaw: Math.atan2(dx, dz),               // Blick zum Strand (Gesicht -Z: atan2(-(-dx), -(-dz)))
           schuleX: p.x + dx * (best + 8.5), schuleZ: p.z + dz * (best + 8.5) };
}

const intro = story.intro = { phase: 'aus', t: 0, rede: null, fertigRede: false };

function introVorbereiten(){
  const ip = introPlatz();
  baueSchule(ip.schuleX, ip.schuleZ, ip.yaw);
  const g = eva.group;
  g.position.set(ip.x, evaFootY(ip.x, ip.z), ip.z);
  eva.yaw = ip.yaw; g.rotation.y = ip.yaw;
  kenji.last = null;
  intro.phase = 'warten'; intro.t = 0;
  startbildschirm(() => {
    intro.phase = 'laeuft'; intro.t = 0;
    intro.rede = sprich(INTRO_TEXT, () => { intro.fertigRede = true; });
  });
}

function introDt(dt){
  if(intro.phase !== 'laeuft') return;
  intro.t += dt;
  if(intro.fertigRede && intro.t > INTRO_FAHRT + INTRO_DREH + 1) introEnde();
}

function introEnde(){
  intro.phase = 'aus';
  evaOrbit = 0; evaPitch = 0;
  if(story.onIntroEnde) story.onIntroEnde();
}

function hookIntro(){
  // Im Intro geht Kenji von allein; die Spielereingaben werden ignoriert.
  const updateEvaOrig = updateEva;
  updateEva = function(dt, inp){
    if(intro.phase === 'warten') return updateEvaOrig(dt, {});
    if(intro.phase === 'laeuft'){
      const xp = story.xwingPlatz;
      const p = eva.group.position;
      const weit = Math.hypot(xp.x - p.x, xp.z - p.z) > 14;
      return updateEvaOrig(dt, { pitch: weit ? -INTRO_GEH : 0 });
    }
    return updateEvaOrig(dt, kenjiEingabe(inp));
  };
  // Einsteigen (Y) und Reset (R) erst nach dem Intro. Y abseits der Fahrzeuge = Twirl (kenjiTasten).
  const introAktiv = () => intro.phase === 'warten' || intro.phase === 'laeuft';
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
    if(!eva || (intro.phase !== 'warten' && intro.phase !== 'laeuft')) return camOrig();
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

// ---- Hauptschleife ---------------------------------------------------------------------------
function hookLoop(){
  const loopOrig = loop;
  let tPrev = performance.now();
  loop = function(){
    const now = performance.now();
    const dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    if(hilfeOffen()) return loopOrig.apply(this, arguments);   // Pause (Anleitung offen)
    updateKenji(dt);
    kenjiWache(dt);
    kenjiTasten();
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
    const info = islandInfo(0, 0), bl = harborSubLocal(0, 0);
    if(info && bl) out.push({ x: info.wx + bl.x, z: info.wz + bl.z, col: COL_SUB });
    return out;
  };
  const activeOrig = activeTarget;
  activeTarget = function(){
    if(story.etappe === 1 && !eva && locale === 'earth')      // keine Brandherde o. Ae. aus der Engine
      return story.ziel ? { x: story.ziel.x, z: story.ziel.z, col: COL_ZIEL } : null;
    return activeOrig();
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
    + '<span style="margin-left:auto;font-family:monospace;font-size:20px">'
    + Math.max(0, PF_ZEIT - pf.t).toFixed(1) + '</span></div>';
  PF_SCHRITTE.forEach((s, i) => {
    const ok = pf.gruen || i < pf.schritt;
    h += '<div style="opacity:' + (ok || i === pf.schritt ? 1 : .55) + '">'
      + (ok ? '✅ ' : (i === pf.schritt ? '▶️ ' : '▫️ ')) + s + '</div>';
  });
  h += '<div style="font-size:12px;opacity:.7;margin-top:6px">Bremse: A / C · Gas: X / Shift / W<br>'
    + 'Lenken: Stick / Pfeiltasten</div>';
  pf.el.innerHTML = h;
  pf.el.style.display = pf.aktiv || pf.gruen ? '' : 'none';
}

function pfStart(){
  pf.aktiv = true; pf.t = 0; pf.schritt = 0; pf.gruen = false;
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
  return { bremse, gas, links: lr < -0.6, rechts: lr > 0.6, hoch: inp.pitch > 0.6, runter: inp.pitch < -0.6 };
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
    sprich(['Startsequenz abgeschlossen. Guten Flug!']);
    setTimeout(() => { pf.gruen = false; pfHud(); }, 2500);
    story.phase = 'freiflug';
    story.ziel = { x: 0, z: -9000 };     // Richtung Etappe 2 (Radarpunkt)
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

// Vorlaeufiges Schild fuer noch nicht gebaute Teile
function platzhalter(text){
  story.phase = 'platzhalter';
  schwarzEl.style.transition = 'none';
  schwarzEl.style.opacity = '1';
  schwarzEl.innerHTML = '<div>' + text + '<div style="font-size:18px;opacity:.7;margin-top:12px">(Taste R: neu starten)</div></div>';
  window.addEventListener('keydown', e => { if(e.code === 'KeyR') location.reload(); });
}

// ---- Freiflug zum Radarpunkt ----------------------------------------------------------------
const ZIEL_R = 250;   // m: so nah (waagerecht) muss man ueber den Radarpunkt
function freiflugUpdate(){
  if(locale !== 'earth' || !story.ziel) return;
  if(state.crashed && !story.ende){
    story.ende = true;
    schwarz(tageVergangen(7), 3, () => platzhalter('Etappe 2 (folgt) – nach Absturz: 7 Tage vergangen'));
    return;
  }
  const d = Math.hypot(state.pos.x - story.ziel.x, state.pos.z - story.ziel.z);
  if(d < ZIEL_R && !story.ende){
    story.ende = true;
    schwarz(tageVergangen(1), 3, () => platzhalter('Etappe 2 (folgt) – geschafft: 1 Tag vergangen'));
  }
}

// ---- Einsteigen ------------------------------------------------------------------------------
function hookEinsteigen(){
  const boardOrig = evaBoard;
  evaBoard = function(){
    const r = boardOrig.apply(this, arguments);
    if(story.etappe === 1 && !story.phase && isXWing()) pfStart();
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
    if(story.phase === 'platzhalter'){ state.vel.set(0, 0, 0); return; }   // Spiel steht hinter dem Schild
    const r = physOrig.apply(this, arguments);
    if(story.phase === 'freiflug') freiflugUpdate();
    return r;
  };
  // Aussteigen (Y) waehrend Startsequenz/Autostart/danach nicht erlaubt
  const buttonYOrig = buttonY;
  buttonY = function(){
    if(!eva && (story.phase || pf.aktiv)) return;
    return buttonYOrig.apply(this, arguments);
  };
  // Reset (R) nur gesperrt, solange Story-Sequenzen laufen
  const resetOrig = resetPlane;
  resetPlane = function(){
    if(pf.aktiv || auto.aktiv || story.phase === 'platzhalter') return;
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
function baueMarke(col){
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 300, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const pfeil = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 12),
    new THREE.MeshBasicMaterial({ color: col }));
  pfeil.rotation.x = Math.PI;                    // Spitze nach unten
  saeule.renderOrder = 995; scene.add(saeule); scene.add(pfeil);
  const m = { saeule, pfeil, x: 0, y: 0, z: 0, hoehe: 10 };
  marken.push(m);
  return m;
}
function setzeMarken(){
  if(!marken.length){ baueMarke(0xffffff); baueMarke(0xffd23f); }
  const xp = story.xwingPlatz;
  const info = islandInfo(0, 0), bl = harborSubLocal(0, 0);
  marken[0].x = xp.x; marken[0].z = xp.z; marken[0].y = ISLAND_Y; marken[0].hoehe = 9;
  if(info && bl){ marken[1].x = info.wx + bl.x; marken[1].z = info.wz + bl.z; marken[1].y = 0; marken[1].hoehe = 16; }
}
function updateMarken(){
  if(!marken.length) return;
  const zeigen = !!eva && story.etappe === 1 && locale === 'earth' && !story.phase
    && intro.phase === 'aus';
  const t = performance.now() / 1000;
  for(const m of marken){
    m.saeule.visible = m.pfeil.visible = zeigen;
    if(!zeigen) continue;
    m.saeule.position.set(m.x, m.y + 150, m.z);
    m.pfeil.position.set(m.x, m.y + m.hoehe + Math.sin(t * 2.5) * 0.8, m.z);
    m.pfeil.rotation.y = t * 1.5;
  }
}

// ---- HUD: zu Fuss "Kenji" statt Fahrzeugname, kein Astronauten-Symbol ------------------------
function hookHud(){
  const mdlEl = document.getElementById('mdl');
  const statEl = document.getElementById('status');
  const hudOrig = updateHUD;
  updateHUD = function(){
    const r = hudOrig.apply(this, arguments);
    if(eva){
      if(mdlEl && mdlEl.textContent !== 'Kenji') mdlEl.textContent = 'Kenji';
      if(statEl){
        const ein = evaCanBoard() || harborSubNear();
        const s = ein ? 'Y: einsteigen' : '';
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
// Beide nutzen das #hint-Overlay der Engine: solange es offen ist, steht das Spiel still.
// Der Inhalt wird je nach Taste getauscht.
const ANLEITUNG = [
  ['🎮 Controller', [
    ['L-Stick', 'laufen · bis zur Hälfte gehen, weiter rennen'],
    ['R-Stick', 'umsehen'],
    ['A', 'springen'],
    ['B (halten)', 'Moonwalk'],
    ['X', 'Silly Dance'],
    ['Y', 'Butterfly Twirl · am Fahrzeug: einsteigen'],
    ['D-Pad ↑', 'diese Anleitung (Pause)'],
    ['D-Pad ←', 'aktuelle Aufgabe (Pause)'],
    ['D-Pad ↓', 'Ton an/aus (auch die Stimme)'],
  ]],
  ['⌨️ Tastatur', [
    ['↑ ↓ ← →', 'laufen und drehen'],
    ['J L I K', 'umsehen'],
    ['Leertaste', 'springen'],
    ['B (halten)', 'Moonwalk'],
    ['X / Y', 'Silly Dance / Butterfly Twirl'],
    ['Y am Fahrzeug', 'einsteigen'],
    ['H / T', 'Anleitung / Aufgabe (Pause)'],
    ['N', 'Ton an/aus'],
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
    ['1', 'Bremse halten (A / C)'],
    ['2', 'links, dann rechts lenken'],
    ['3', 'Nase hoch, dann runter'],
    ['4', 'Bremse loslassen'],
    ['5', 'Gas geben (X / Shift / W)'],
    ['Zeit', '10 Sekunden · beliebig oft neu beginnen'],
  ]];
  if(story.phase === 'freiflug') return ['Ziel', [
    ['Radar', 'fliege zum roten Punkt'],
    ['Zeit', 'Fliegen kostet keine Zeit – erst über dem Ziel geht es weiter'],
  ]];
  return ['Etappe 1: Der Aufbruch am Strand', [
    ['X-Wing (weiß)', 'schnell, aber riskant: vor dem Start muss die Startsequenz in 10 s klappen'],
    ['U-Boot (gelb)', 'sicher, aber langsamer'],
    ['Einsteigen', 'hinlaufen und Y drücken'],
    ['Zeit', (42 - story.tage) + ' von 42 Tagen übrig'],
  ]];
}
function hilfeHtml(spalten){
  return spalten.map(([titel, zeilen]) => '<div class="hcol"><div class="htitle">' + titel + '</div>'
    + zeilen.map(([k, v]) => '<div class="hrow"><span>' + k + '</span><b>' + v + '</b></div>').join('')
    + '</div>').join('');
}
const hilfe = { art: null };
function hilfeEl(){ return document.getElementById('hint'); }
function hilfeOffen(){ const h = hilfeEl(); return !!(h && h.classList.contains('show')); }
function zeigeHilfe(art){
  const h = hilfeEl(); if(!h) return;
  if(hilfeOffen() && hilfe.art === art){ h.classList.remove('show'); hilfe.art = null; return; }
  h.innerHTML = art === 'aufgabe' ? hilfeHtml([aufgabeText()]) : hilfeHtml(ANLEITUNG);
  h.classList.add('show'); hilfe.art = art;
}
function hookHilfe(){
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
  hookEinsteigen();
  hookHud();
  hookHilfe();
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
