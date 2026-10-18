// Die Abenteuer von Samu (SFG) – Tanzende Aliens auf dem Mond (Live-Wunsch 18.10.2026). Laedt nach story.js, objekte.js,
// spuren.js und alien_glb.js (window.ALIEN_GROSS_GLB, window.ALIEN_KLEIN_GLB), vor der Engine.
// Wann: beim ZWEITEN Mal auf dem Mond (Etappe 2 ging schon zum Mond: story.e2weg === 'mond', jetzt wieder ein Mond-Trip).
// Was: beim Stein tanzt ein PAAR – ein grosser und ein kleiner Alien nebeneinander. Stellt Samu sich davor oder
//   dazu (GRUPPE_R) und TANZT SELBST (X), wird das Paar zur grossen Gruppe vor ihm: 5 Grosse, davor 4 Kleine in den
//   Luecken, alle 10 s wandern die Kleinen zurueck zwischen die Grossen und wieder vor – Grosse und Kleine je synchron. Hoert Samu auf zu tanzen, beamen die acht wieder weg, das Paar geht an seinen Platz zurueck.
// Modelle: "Alien Hip Hop Dancing" by nonny (gross, schlank, grau) und "Funky Alien (Rigged & Animated)" by jungle_jim
//   (klein, grosser Kopf), beide CC-BY-4.0, Texturen auf 1024 px JPEG verkleinert. Kopf beider auf +Z.
// Grenzen: jeder Alien ist ein Kreis (story.tierQuelleOrt('moon')) – Samu und Barki laufen nicht hindurch.
(function(){
'use strict';
const story = window.STORY;
const GROSS_H = 2.2, KLEIN_H = 1.1;              // m (Samu 1,55 m)
const PAARE = [[9, 0]];                                          // Live-Wunsch: EIN Paar, 9 m vor dem Stein (zum Landeplatz hin)
const GRUPPE_R = 6, REIHE_ABST = 1.6, REIHE_TIEFE = 2.4, SICHT = 220, ANIM = 120;
const vorlagen = {};
const al = { paare: [], an: false, ort: null, gruppe: null };
story.aliens = al;

function lade(name, daten, hoehe, fertig){
  const v = vorlagen[name];
  if(v){ if(v.tpl) fertig(v); else v.warten.push(fertig); return; }
  const neu = vorlagen[name] = { tpl: null, clip: null, warten: [fertig] };
  if(!daten || !THREE.GLTFLoader) return;
  const bin = atob(daten.split(',')[1]), u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (g) => {
    const o = g.scene; o.traverse(m => { if(m.isMesh){ m.frustumCulled = false; m.castShadow = false; } });
    const clip = g.animations[0], mx = new THREE.AnimationMixer(o); if(clip) mx.clipAction(clip).play(); mx.update(0.01); o.updateMatrixWorld(true);
    // Groesse aus der gehaeuteten Haltung (die Bindepose-Box passt nicht), Fuesse auf y = 0, mittig
    const bb = new THREE.Box3(), p = new THREE.Vector3();
    o.traverse(m => { if(m.isSkinnedMesh){ const n = m.geometry.attributes.position.count; for(let i = 0; i < n; i += 3){ m.boneTransform(i, p); p.applyMatrix4(m.matrixWorld); bb.expandByPoint(p); } } });
    if(bb.isEmpty()) bb.setFromObject(o);
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = hoehe / sz.y;
    o.scale.multiplyScalar(k); o.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
    mx.stopAllAction(); mx.uncacheRoot(o);
    const tpl = new THREE.Group(); tpl.add(o);
    neu.tpl = tpl; neu.clip = clip;
    for(const f of neu.warten) f(neu); neu.warten.length = 0;
  }, (e) => console.warn('Alien-GLB ' + name, e));
}
function neuerAlien(v, groesse){
  const k = cloneSkinned(v.tpl); k.userData.deko = true;
  let mixer = null; if(v.clip){ mixer = new THREE.AnimationMixer(k); mixer.clipAction(v.clip).play(); }   // Takt setzt takt() (synchron)
  const dauer = v.clip ? v.clip.duration : 0;
  scene.add(k);                                                    // global-ok: steht auf dem Mond, nicht in einer Erd-Welt
  if(story.tierSchatten) story.tierSchatten(k, groesse * 0.45, groesse * 0.35);
  return { k, mixer, dauer, gross: groesse > 1.5, beam: 0, verz: 0, x: 0, z: 0, ziel: null };
}
function setze(a, x, z, yaw){ a.x = x; a.z = z; a.k.position.set(x, evaFootY(x, z), z); a.k.rotation.y = yaw; }
// Lichtsaeule beim Hereinbeamen (wie beim leuchtenden Stein): der Neue waechst darin heran, dann vergeht sie
let beamGeo = null;
function beamen(a){
  if(!beamGeo) beamGeo = new THREE.CylinderGeometry(0.7, 0.7, 6, 14, 1, true);
  const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(0, 3, 0); m.userData.deko = true; m.userData.geteilt = true;   // beamGeo bleibt (geteilt)
  a.k.add(m); a.beam = 1; a.beamM = m; a.k.scale.setScalar(0.01);
}

// ---- Aufbau: beim zweiten Mondbesuch, sobald Samu ausgestiegen ist ---------------------------------------------------
function zweiterMond(){ return story.e2weg === 'mond' && story.etappe >= 3 && locale === 'moon' && story.phase === 'mars'; }
// Live-Wunsch 18.10.2026: die Paare stehen beim Stein (dort muss man hin, so nimmt man sie wahr) – vom Landeplatz aus gesehen
// davor und rundherum; ohne Stein (noch nicht gelegt) um den Landeplatz
function aufbauen(){
  const st = story.marsSteinPlatz && story.marsSteinPlatz();
  if(!st && story.e2weg === 'mond' && (al.warte = (al.warte || 0) + 1) < 300) return;   // Stein kommt gleich (Basis wird gestellt)
  const p = st ? { x: st.x, z: st.z } : { x: state.pos.x, z: state.pos.z }; al.an = true; al.ort = locale;
  // Blick vom Landeplatz zum Stein – die Paare stehen so, dass man sie auf dem Weg dorthin vor sich hat
  const blick = st ? Math.atan2(state.pos.x - st.x, state.pos.z - st.z) : (eva ? Math.atan2(-Math.sin(eva.yaw), -Math.cos(eva.yaw)) : 0);
  lade('gross', window.ALIEN_GROSS_GLB, GROSS_H, (vg) => lade('klein', window.ALIEN_KLEIN_GLB, KLEIN_H, (vk) => {
    if(!al.an) return;
    for(const [r, w] of PAARE){
      const a = blick + w, cx = p.x + Math.sin(a) * r, cz = p.z + Math.cos(a) * r;
      const zuMitte = Math.atan2(p.x - cx, p.z - cz);              // Kopf +Z: schaut zum Landeplatz
      const qx = Math.cos(zuMitte), qz = -Math.sin(zuMitte);       // quer zur Blickrichtung
      const g = neuerAlien(vg, GROSS_H), k = neuerAlien(vk, KLEIN_H);
      setze(g, cx - qx * 0.9, cz - qz * 0.9, zuMitte); setze(k, cx + qx * 0.7, cz + qz * 0.7, zuMitte);
      al.paare.push({ x: cx, z: cz, blick: zuMitte, aliens: [g, k], gross: false, heim: { g: { x: g.x, z: g.z }, k: { x: k.x, z: k.z } } });
    }
  }));
}
function abbauen(){
  for(const P of al.paare) for(const a of P.aliens){ if(story.entsorgen) story.entsorgen(a.k); else scene.remove(a.k); }
  al.paare.length = 0; al.an = false; al.gruppe = null;
}

// ---- Grosse Gruppe: 5 Grosse und 4 Kleine VOR Samu, ihm zugewandt (Live-Wuensche 18.10.2026) --------------------------
// Die Kamera ist hinter Samu – die Gruppe steht deshalb vor ihm (in seiner Blickrichtung) und schaut zu ihm. Choreografie im
// WECHSEL_T-Takt: A = die 4 Kleinen stehen leicht vor den 5 Grossen in deren Luecken; B = die Grossen ruecken etwas auseinander
// und die Kleinen wandern zurueck in die Luecken (eine Reihe aus 9). Dann wieder vor. Grosse und Kleine tanzen je unter sich
// synchron (takt). Das Paar nimmt die Mitte (Grosser) bzw. den Platz links der Mitte (Kleiner) ein, die anderen beamen herein.
const GRUPPE_VOR = 4.6;                             // Abstand der vorderen Reihe: dazwischen tollt Barki (TOLL_ABST 3,2 m)
const WECHSEL_T = 10, GROSS_ABST = 1.7, GROSS_WEIT = 2.3, KLEIN_VOR = 1.4;
function formation(P, b){
  // b = 0: Kleine vorn (A), b = 1: Kleine in den Luecken, Grosse weiter auseinander (B)
  const { gx, gz, fx, fz, lx, lz } = P.bezug, reiheG = GRUPPE_VOR + KLEIN_VOR, abst = GROSS_ABST + (GROSS_WEIT - GROSS_ABST) * b;
  const pos = (vor, quer) => ({ x: gx + fx * vor + lx * quer, z: gz + fz * vor + lz * quer });
  const plaetze = [];
  for(let i = 0; i < 5; i++) plaetze.push(pos(reiheG, (i - 2) * abst));                    // die 5 Grossen
  for(let i = 0; i < 4; i++) plaetze.push(pos(reiheG - KLEIN_VOR * (1 - b), (i - 1.5) * abst));   // die 4 Kleinen in den Luecken
  return plaetze;
}
function gruppeBilden(P){
  const vg = vorlagen.gross, vk = vorlagen.klein; if(!vg || !vk || !vg.tpl || !vk.tpl) return;
  const g = eva.group.position, yaw = eva.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), lx = -Math.cos(yaw), lz = Math.sin(yaw);
  const blick = Math.atan2(-fx, -fz);                              // Kopf +Z der Aliens: zu Samu (gegen seinen Blick)
  P.bezug = { gx: g.x, gz: g.z, fx, fz, lx, lz }; P.form = 0; P.formT = 0;
  const plaetze = formation(P, 0);
  const altG = P.aliens.find(a => a.gross), altK = P.aliens.find(a => !a.gross);
  const neu = [];
  for(let i = 0; i < 9; i++){
    const gross = i < 5, q = plaetze[i];
    let a = (gross && i === 2) ? altG : (!gross && i === 6) ? altK : null;
    if(a){ a.ziel = q; a.k.rotation.y = blick; }
    else { a = neuerAlien(gross ? vg : vk, gross ? GROSS_H : KLEIN_H); setze(a, q.x, q.z, blick); beamen(a); a.verz = 0.15 * neu.length; }
    a.platzNr = i; neu.push(a);
  }
  P.aliens = neu; P.gross = true; P.vorn = { x: g.x + fx * GRUPPE_VOR, z: g.z + fz * GRUPPE_VOR }; P.fx = fx; P.fz = fz;
  P.paarG = altG; P.paarK = altK; al.gruppe = P;
}
// alle WECHSEL_T s zwischen A und B wechseln, gleitend (die Ziele wandern, updateAlien laeuft hin)
function choreo(P, dt){
  if(!P.bezug) return;
  P.formT += dt;
  if(P.formT >= WECHSEL_T){ P.formT = 0; P.form = 1 - P.form; const pl = formation(P, P.form); for(const a of P.aliens) if(a.platzNr !== undefined) a.ziel = pl[a.platzNr]; }
}
// Synchron (Live-Wunsch 18.10.2026): alle Aliens tanzen auf derselben Uhr al.t, jeder Clip auf seine eigene Laenge
// umgebrochen – die Grossen untereinander und die Kleinen untereinander sind damit immer im selben Takt
function takt(a){ if(a.mixer && a.dauer) a.mixer.setTime(al.t % a.dauer); }
function updateAlien(a, dt){
  if(a.ziel){                                                      // in die Mitte der Reihe gleiten
    const dx = a.ziel.x - a.x, dz = a.ziel.z - a.z, d = Math.hypot(dx, dz);
    if(d > 0.02){ const s = Math.min(d, 1.2 * dt); a.x += dx / d * s; a.z += dz / d * s; } else a.ziel = null;
    a.k.position.set(a.x, evaFootY(a.x, a.z), a.z);
  }
  if(a.beam > 0){
    if(a.verz > 0){ a.verz -= dt; return; }
    a.beam = Math.max(0, a.beam - dt * 1.4);
    a.k.scale.setScalar(Math.min(1, (1 - a.beam) * 1.6 + 0.01));
    if(a.beamM){ a.beamM.material.opacity = 0.6 * a.beam; if(a.beam <= 0){ a.k.remove(a.beamM); a.beamM.material.dispose(); a.beamM = null; } }
  }
}
// Aufloesen (Live-Wunsch 18.10.2026): hoert Samu auf zu tanzen oder geht weg, beamen die acht Zusaetzlichen weg und das
// Paar gleitet zurueck an seinen Platz
function gruppeAufloesen(){
  const P = al.gruppe; if(!P) return;
  const bleiben = [];
  for(const a of P.aliens){
    if(a === P.paarG || a === P.paarK){ a.ziel = a === P.paarG ? P.heim.g : P.heim.k; a.k.rotation.y = P.blick; a.platzNr = undefined; bleiben.push(a); }
    else { a.weg = 1; a.ziel = null; P.gehen = (P.gehen || []).concat(a); }
  }
  P.aliens = bleiben; P.gross = false; P.bezug = null; al.gruppe = null;
}
function wegBeamen(P, dt){
  if(!P.gehen) return;
  for(let i = P.gehen.length - 1; i >= 0; i--){
    const a = P.gehen[i];
    if(!a.beamM){ beamen(a); a.beam = 0; a.k.scale.setScalar(1); }
    a.weg -= dt * 1.6; a.k.scale.setScalar(Math.max(0.01, a.weg)); if(a.beamM) a.beamM.material.opacity = 0.6 * (1 - a.weg);
    if(a.weg <= 0){ if(story.entsorgen) story.entsorgen(a.k); else scene.remove(a.k); P.gehen.splice(i, 1); }
  }
}

function schritt(dt){
  al.t = (al.t || 0) + dt;
  if(!al.an){ if(zweiterMond() && eva && window.ALIEN_GROSS_GLB) aufbauen(); return; }
  if(locale !== al.ort){ abbauen(); return; }                      // Mond verlassen: weg
  const cp = camera.position;
  for(const P of al.paare){ wegBeamen(P, dt); if(P.gross) choreo(P, dt); }
  for(const P of al.paare) for(const a of P.aliens){
    updateAlien(a, dt);
    const d = Math.hypot(a.x - cp.x, a.z - cp.z);
    a.k.visible = d < SICHT;
    if(a.k.visible && d < ANIM && a.beam <= 0.5) takt(a);
  }
  if(!eva) return;
  const g = eva.group.position;
  if(!al.gruppe){
    // Live-Wunsch 18.10.2026: das Paar tanzt schon – steht Samu vor ihm (GRUPPE_R, ihm zugewandt) und tanzt SELBST
    // (X = Hip Hop), kommen die anderen dazu
    const tanzt = story.tricks && story.tricks.aktiv === 'tanz';
    const P = tanzt && al.paare.find(P => {
      if(P.gross || Math.hypot(g.x - P.x, g.z - P.z) > GRUPPE_R) return false;
      const fx = -Math.sin(eva.yaw), fz = -Math.cos(eva.yaw), dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz) || 1;
      return (dx * fx + dz * fz) / d > 0.3;                          // Samu schaut grob zum Paar
    });
    if(P) gruppeBilden(P);
  } else {
    const G = al.gruppe, tanzt = story.tricks && story.tricks.aktiv === 'tanz';
    if(!tanzt || Math.hypot(g.x - G.vorn.x, g.z - G.vorn.z) > 10) gruppeAufloesen();
  }
}

// Grenzen auf dem Mond: jeder Alien ein Kreis (Samu und Barki laufen nicht hindurch)
if(story.tierQuelleOrt) story.tierQuelleOrt('moon', () => {
  if(!al.an) return null;
  const l = [];
  for(const P of al.paare) for(const a of P.aliens) if(a.k.visible && a.beam <= 0) l.push({ x: a.x, z: a.z, y: a.k.position.y, r: a.gross ? 0.35 : 0.3, h: a.gross ? GROSS_H : KLEIN_H });
  return l;
});

let tVor = 0;
const startVorher = window.STORY_START;
window.STORY_START = function(){
  const loopOrig = loop;
  loop = function(){
    const r = loopOrig.apply(this, arguments);
    const t = performance.now(), dt = tVor ? Math.min(0.1, (t - tVor) / 1000) : 0; tVor = t;
    const pause = document.getElementById('hint') && document.getElementById('hint').classList.contains('show');
    if(!pause) schritt(dt);
    return r;
  };
  if(startVorher) return startVorher.apply(this, arguments);
};
})();
