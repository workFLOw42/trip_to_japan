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
  // Ohne Traeger braucht es auch das Traeger-Modell nicht. Sein Lade-Callback ruft ausserdem
  // placeAtStart auf, das Kenji (EVA) wieder einsammeln wuerde.
  preloadFord = function(){};
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear();

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

// Parkplatz des X-Wings: auf dem Land, Richtung U-Boot-Liegeplatz, knapp vor dem Sand.
// Gesucht wird in kleinen Schritten, bis kein Gebaeude im Weg steht.
function xwingStrandPlatz(){
  const info = islandInfo(0, 0);
  const bl = harborSubLocal(0, 0);
  const a0 = bl ? Math.atan2(bl.z, bl.x) : -Math.PI/2;
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

// Animation nach Laufgeschwindigkeit (aus der Positionsaenderung der Figur)
function updateKenji(dt){
  if(!kenji.mixer) return;
  kenji.mixer.update(dt);
  if(!eva || !eva.group || kenji.obj.parent !== eva.group) return;
  const p = eva.group.position;
  if(kenji.last && dt > 0){
    const v = Math.hypot(p.x - kenji.last.x, p.z - kenji.last.z) / dt;
    if(!eva.onGround) kenjiAnim('jump');
    else if(v > 4.5) kenjiAnim('run');
    else if(v > 0.4) kenjiAnim('walk');
    else kenjiAnim('idle');
  }
  kenji.last = p.clone();
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
    if(synth && story.ton){
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
    return updateEvaOrig(dt, inp);
  };
  // Einsteigen (Y), Springen (B) und Reset (R) erst nach dem Intro
  const introAktiv = () => intro.phase === 'warten' || intro.phase === 'laeuft';
  for(const name of ['evaBoardY', 'evaActionB', 'resetPlane']){
    const orig = window[name];
    window[name] = function(){ if(introAktiv()) return; return orig.apply(this, arguments); };
  }
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
    updateKenji(dt);
    introDt(dt);
    return loopOrig.apply(this, arguments);
  };
}

// ---- Startszene ------------------------------------------------------------------------------
function startStrand(){
  placeAtStart('XWing');           // -> findStart-Wrapper: am Strand
  fadeHold = 0; flashFade(1.0);    // den Hangar-Vorhang der Engine nicht abwarten
  evaExit();                       // Kenji steht neben dem X-Wing ...
  introVorbereiten();              // ... und wird vor die Schultuer gestellt
}

window.STORY_HOOK = function(){
  hookWelt();
  hookKenji();
  hookIntro();
  hookLoop();
};
window.STORY_START = function(){
  startStrand();
};
})();
