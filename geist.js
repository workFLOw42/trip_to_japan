// Trip to Japan – Geist an der Schultuer (Live-Wunsch 14.10.2026). Laedt nach etappe1.js und geist_glb.js, vor der Engine.
// Laeuft Samu in Etappe 1 zurueck an die Schultuer: Schwarzblende, der Geist erscheint bildfuellend (eigene kleine
// Szene in einem Vollbild-Canvas – Engine-Kamera, Nebel und Licht stoeren so nicht), Schwarzblende zurueck, Samu steht
// wieder vor der Tuer mit Blick auf den Strand.
// Modell: "Ghost classic" von skalson (CC-BY-4.0), Sketchfab. Zwei Animationen: CameraAction (10 s, schwebt) und
// EvilEyes (0,67 s, Augen). Im Modell liegt er gekippt: das Gesicht zeigt nach GESICHT (Modellkoordinaten, ausgemessen
// ueber die Augen-Meshes "Material.001"), die Zipfel nach -GESICHT... genauer: der Kopf liegt Richtung KOPF.
(function(){
'use strict';
const story = window.STORY;

const DAUER = 2.6;            // s Geist im Bild
const TUER_R = 2.2;           // m: so nah an der Tuermitte (Wandseite) loest es aus
const geist = { aktiv: false, gltf: null, laedt: false, sperre: 0 };

function lade(fertig){
  if(geist.gltf) return fertig(geist.gltf);
  if(geist.laedt || !window.GEIST_GLB || !THREE.GLTFLoader) return;
  geist.laedt = true;
  const b = atob(window.GEIST_GLB.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (g) => { geist.gltf = g; fertig(g); }, (e) => console.warn('Geist-GLB', e));
}

// Vollbild-Szene: schwarzer Grund, kaltes Licht, der Geist leuchtet blaeulich; er kommt aus der Tiefe nah heran und wackelt
function zeigeGeist(fertig){
  lade((g) => {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:28;pointer-events:none;opacity:0;transition:opacity .25s;';
    document.body.appendChild(cv);
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: false });
    r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(innerWidth, innerHeight, false); r.setClearColor(0x000000);
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0x9fbfff, 0x05050f, 0.55));
    const spot = new THREE.PointLight(0x9fd0ff, 0.6, 0, 0); s.add(spot);
    const o = g.scene; s.add(o);
    // Augen (Material.001) leuchtend cyan, Koerper zartes Blau mit eigenem Schimmer
    let duch = null, augMat = null;
    o.traverse(m => { if(m.name === 'duch') duch = m;
      if(m.isMesh){ m.frustumCulled = false;
        // eigene, einfache Materialien: das Modell hat Emissive-Maps, die den Koerper komplett weiss ueberstrahlten
        // Material.002 = Augen (kleines Mesh), Material.001 = Koerper – ausgemessen ueber die Mesh-Groesse
        if(m.material && m.material.name === 'Material.002'){ augMat = m.material = new THREE.MeshBasicMaterial({ color: 0x40e8ff }); }
        else if(m.material){ m.material = new THREE.MeshLambertMaterial({ color: 0xbfd6f2, emissive: 0x1c3456 }); } } });
    // Die Modell-Animationen fliegen den Geist herum und kippen ihn – nicht abspielen. Knoten auf seine eigenen Achsen:
    // so schaut er nach +y, der Kopf liegt bei -z (ausgemessen). Bewegung (Heranschweben, Wackeln) gibt die Kamera.
    if(duch){ duch.position.set(0, 0, 0); duch.quaternion.identity(); duch.scale.set(1, 1, 1); }
    o.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(o), mitte = bb.getCenter(new THREE.Vector3()), R = bb.getSize(new THREE.Vector3()).length();
    const gesicht = new THREE.Vector3(0, 1, 0), oben = new THREE.Vector3(0, 0, 1);    // Kopf bei +z (Zipfel -z) im Bild oben
    const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.001, R * 20);
    let t = 0, prev = performance.now(), ende = false;
    requestAnimationFrame(() => { cv.style.opacity = '1'; });
    geistTon();
    (function bild(now){
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now; t += dt;
      // aus der Ferne schnell heran (bildfuellend), dann schweben und wackeln; Augen pulsieren
      const k = Math.min(1, t / 0.6), e = k * k * (3 - 2 * k), nah = 0.85 + 2.6 * (1 - e);
      const wack = new THREE.Vector3(Math.sin(t * 6) * 0.025, 0, Math.sin(t * 4.3) * 0.03).multiplyScalar(R);
      cam.position.copy(mitte).addScaledVector(gesicht, R * nah).add(wack); cam.position.z += R * 0.16;
      cam.up.copy(oben); cam.lookAt(mitte.x, mitte.y, mitte.z + R * 0.16);   // Blick aufs Gesicht (oben im Bild)
      if(augMat){ const p = 0.75 + Math.sin(t * 9) * 0.25; augMat.color.setRGB(0.25 * p, 0.9 * p, 1.0 * p); }   // Augen pulsieren
      spot.position.copy(cam.position);
      cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
      r.render(s, cam);      if(t < DAUER) return requestAnimationFrame(bild);
      if(ende) return; ende = true;
      fertig(() => { cv.remove(); s.remove(o); r.dispose(); });
    })(prev);
  });
}

// Ton: "Ghost woo" (Pixabay, shut_up_ghost) aus geist_snd.js – einmal dekodiert, nur bei Ton an
let tonBuf = null, tonLaedt = false;
function tonLaden(){
  if(tonBuf || tonLaedt || !window.GEIST_SND || typeof decodeSound !== 'function' || !audioCtx) return;
  tonLaedt = true; decodeSound(window.GEIST_SND).then(b => { tonBuf = b; }).catch(e => { tonLaedt = false; console.warn('Geist-Ton', e); });
}
function geistTon(){
  if(!soundOn || !audioCtx || audioCtx.state !== 'running' || !tonBuf) return;
  const q = audioCtx.createBufferSource(); q.buffer = tonBuf;
  const g = audioCtx.createGain(); g.gain.value = 0.8;
  q.connect(g).connect(audioCtx.destination); q.start();
}
// Schwarz (0,5 s) -> Geist -> schwarz -> Samu vor der Tuer, Blick zum Strand -> hell
let blende = null;
function schwarz(an, dauer){
  if(!blende){ blende = document.createElement('div'); blende.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:27;'; document.body.appendChild(blende); }
  blende.style.transition = 'opacity ' + dauer + 's'; blende.style.opacity = an ? '1' : '0';
}
function spuk(){
  if(geist.aktiv) return;
  geist.aktiv = true; story.geistAktiv = true;
  schwarz(true, 0.4);
  setTimeout(() => {
    zeigeGeist((aufraeumen) => {
      schwarz(true, 0.01);
      aufraeumen();
      const S = story.e1.START1;
      if(eva){
        eva.group.position.set(S.x, evaFootY(S.x, S.z), S.z);
        eva.yaw = S.yaw; eva.group.rotation.y = eva.yaw; eva.vy = 0; eva.onGround = true;
        evaOrbit = 0; evaPitch = 0;
        if(typeof snapCamera === 'function') snapCamera();
      }
      setTimeout(() => { schwarz(false, 0.6); geist.aktiv = false; story.geistAktiv = false; geist.sperre = 2; }, 500);
    });
  }, 450);
}

// Ausloeser: Samu zu Fuss in Etappe 1 an der Schultuer (Wand zum Meer, -x), Blick etwa zur Tuer
let tPrev = performance.now();
story.geistUpdate = function(){
  const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
  if(geist.sperre > 0){ geist.sperre -= dt; return; }
  if(geist.aktiv || story.etappe !== 1 || !eva || eva.boat || eva.rover || !story.e1) return;
  if(story.phase === 'platzhalter' || story.phase === 'reise') return;
  const S = story.e1.SCHULE, p = eva.group.position;
  const tuerX = S.x - S.T / 2, tuerZ = S.z;
  // nah an der Tuer und Blick Richtung Schule (+x): Engine-Blick = (-sin yaw, -cos yaw)
  const blickX = -Math.sin(eva.yaw);
  if(Math.abs(p.z - tuerZ) < TUER_R && p.x > tuerX - 0.9 && p.x < tuerX + 0.2 && blickX > 0.5 && (story.tricks ? story.tricks.ausschlag > 0.1 : true)) spuk();
};
story.geistSpuk = spuk;                                // fuer Tests

const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookVorher) hookVorher();
  const loopOrig = loop;
  loop = function(){ if(story.geistUpdate) story.geistUpdate(); tonLaden(); return loopOrig.apply(this, arguments); };
  lade(() => {});                                      // vorab laden, damit der Schreck sofort kommt
};
})();
