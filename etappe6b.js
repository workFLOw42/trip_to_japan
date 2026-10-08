// Trip to Japan – Etappe 6b: die Hoehle im Fuji (Alpha Jet). Laedt nach etappe6.js.
// Nach dem Hinflug (Blende am Ziel vor dem Berg) spawnt der Alpha in einer engen, kurvigen Felsroehre im Vulkan.
//   1. Autopilot: fliegt perfekt (100 %) durch die ersten Kurven, waehrenddessen die Ansage
//      "Wie bist du hier reingeraten? ... 3... 2... 1... LOS!" – ab dann selbst fliegen.
//   2. Selbst fliegen (~15 s): eng und kurvig, Gyroskop ausgeblendet (man verliert das Gefuehl fuer oben – soll wie der
//      Aufstieg im Schlot wirken). Jede Beruehrung beendet die Reise (Krankenhaus), unter 100 % Schub = zu langsam.
//   3. Am Ende ein Ausgang mit Himmel. Durch -> Schwarzblende -> Zwischenszene (~3 s): der Jet rast senkrecht aus dem Krater,
//      dicht gefolgt vom Ausbruch -> Schwarzblende -> normal fliegen (500 m, 50 % Schub), "Du bist der Wahnsinn ..." ->
//      am Strand-Flughafen landen = geschafft (1 Tag).
// Der fruehere Senkrechtflug (Countdown, Dom, Lavaschacht) liegt mit Erklaerung in _intern/archiv/e6b_senkrechtschacht/.
// Gescheitert (Fels, zu langsam, Absturz) -> 7 Tage.
(function(){
'use strict';
const story = window.STORY;
function e6(){ return story.etappe === 6; }
function hier(){ return e6() && locale === 'earth'; }
const E = story.e6;

// ---- Hoehle: eigene Szene ------------------------------------------------------------------------------
// Live-Wunsch: "einfach Hoehle und dann Schacht" – Laenge egal (kein Zeitlimit). Deshalb liegt die Hoehle als geschlossene
// Felsroehre weit ab vom Fuji (H0), dort gibt es kein Gelaende, das stoert; man kommt per Blende hinein und oben am Schacht
// per Blende ueber den Krater des Fuji. u laeuft nach -z, v quer (rechts = +x), y = Hoehe ueber HOEHE_Y.
// Hoehe: 100 m statt 1000 m – der senkrechte Schacht braucht Platz unter der Alpha-Grenze (3000 m)
const HOEHE_Y = 100;
const H0 = { x: 20000, z: 0 };            // Eingang (u = 0), weit ausserhalb der Welt (Inseln, Fuji, Meer-Gitter egal)
// Verlauf: Knicke wie Fluss/Schlucht [Mitte u, Versatz v, Laenge]. Aus den Air-Race-Hin-Toren (x 0 -> 100 -> -60 -> 0)
// gedreht auf u; Kurven gestreckt (Laenge 380-420 m), damit sie bei 361 m/s (Alpha Vollgas) mit Rollen + Ziehen gehen.
// Radius einer Cos-Rampe (Versatz a, Laenge L): ~ L^2 / (pi^2/2 * a) -> 100 m auf 400 m ergibt ~325 m.
// Live-Test mit dem Bot: bei 420 m Kurvenlaenge (Radius ab 224 m) kam der Alpha bei 1300 km/h nicht sauber durch ->
// laenger (kleinster Radius 621 m; gemessen schafft er bei 90 Grad Querlage ~140 m) und die Kurven weiter auseinander,
// damit Engstellen und Messer-Felsen je auf einer eigenen Geraden liegen (nicht kurven UND einfaedeln).
// Freier Teil (u 0..7200, ~20 s): Kurven alle ~1100 m, Radien > 600 m (gemessen schafft der Alpha ~140 m)
// Live-Feedback: waagerecht nur ~15 s frei (5,4 km) -> 4 Kurven, die letzte endet bei 4350; danach Gerade fuer den Countdown
const KNICKE = [[700, 100, 620], [1800, -160, 700], [2900, 120, 620], [4000, -140, 700]];
// Anlauf fuer den Autopiloten vor der eigentlichen Hoehle: ANLAUF m (bei 361 m/s ~22 s – laenger als die Ansage), sanfte
// Kurven (Radius > 1,5 km), damit es wie Hoehle aussieht, aber nichts passieren kann.
// Autopilot-Teil (u -7000..0, ~19 s – die Ansage dauert ~18 s): gleiche Hoehle, gleiche Art Kurven
const ANLAUF = 7000;
const KNICKE_ANLAUF = [[-6200, 90, 620], [-5100, -140, 700], [-4000, 110, 620], [-2900, -120, 700], [-1800, 80, 620], [-700, -60, 560]];
function mitteV(u){ let v = 0; for(const [uk, a, K] of KNICKE_ANLAUF.concat(KNICKE)){ const s = (u - (uk - K / 2)) / K;
  if(s >= 1) v += a; else if(s > 0) v += a * (1 - Math.cos(Math.PI * s)) / 2; } return v; }
// Querschnitt: 60 m breit (Torbreite 40 m + 50 %, Live-Feedback), 75 m hoch (2 Pylonen + 50 %), ueberall gleich.
const PYLON = 25, HOEHE = 2 * PYLON * 1.5, BREITE = 60;
// Ende: Ausgang bei U_AUS (nach der letzten Kurve, Gerade zum Licht). Die Roehre weitet sich auf den letzten AUS_TRICHTER m
// leicht auf, dahinter eine helle Flaeche in Himmelsfarbe (Licht am Ende des Tunnels).
const U_AUS = 5200, AUS_TRICHTER = 260;
const U_WAND = U_AUS + 400;               // hinter dem Ausgang frei: man fliegt noch ~0,5 s ins Licht (Live-Wunsch)
const AUS_NACH = 0.5;                     // s Flug hinter dem Ausgang bis zur Blende
function breite(u){
  if(u > U_AUS - AUS_TRICHTER){ const f = (u - (U_AUS - AUS_TRICHTER)) / AUS_TRICHTER; return BREITE * (1 + 0.6 * f * f); }
  return BREITE;
}
function hoehe(u){
  let h = HOEHE;
  if(u > U_AUS - AUS_TRICHTER){ const f = (u - (U_AUS - AUS_TRICHTER)) / AUS_TRICHTER; h = HOEHE * (1 + 0.6 * f * f); }
  return h;
}
// Welt <-> lokal
function punkt(u, v, y){ return new THREE.Vector3(H0.x + v, HOEHE_Y + (y || 0), H0.z - u); }
function lokal(x, z){ return { u: H0.z - z, v: x - H0.x }; }
story.e6hoehle = { mitteV, breite, hoehe, punkt, lokal, U_AUS, U_WAND, HOEHE_Y };   // fuer Tests

// ---- Treffer -------------------------------------------------------------------------------------------
// Alpha Jet: ~13 m lang, 9,4 m Spannweite (Engine normiert auf 9). Rumpf als Linie (Bug/Mitte/Heck), Fluegel als
// Punkte links/rechts (mit Querlage gedreht). Eine Beruehrung = vorbei (Live-Wunsch).
const RUMPF = 6, SPANN = 4.5, HOCH = 1.6;
function im(u, v, y){
  if(u > U_AUS) return true;                                        // hinter dem Ausgang: frei (Licht, Himmel)
  if(u < -ANLAUF - 40) return false;                                // vor dem Anlauf
  const q = v - mitteV(u), b = breite(u) / 2, h = hoehe(u);
  if(Math.abs(q) > b || y < 0 || y > h) return false;
  return true;
}
function treffer(){
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat), r = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quat), o = new THREE.Vector3(0, 1, 0).applyQuaternion(state.quat);
  const p = state.pos;
  const pkte = [[RUMPF, 0, 0], [0, 0, 0], [-RUMPF, 0, 0], [0, SPANN, 0], [0, -SPANN, 0], [0, 0, HOCH], [-RUMPF, 0, HOCH * 1.6]];
  for(const [a, b, c] of pkte){
    const x = p.x + f.x * a + r.x * b + o.x * c, y = p.y + f.y * a + r.y * b + o.y * c, z = p.z + f.z * a + r.z * b + o.z * c;
    const L = lokal(x, z);
    if(!im(L.u, L.v, y - HOEHE_Y)) return true;
  }
  return false;
}

// ---- Bau -------------------------------------------------------------------------------------------------
// Leistung (Live-Feedback 08.10.2026: lange schwarz am Anfang, Ruckeln im Tunnel). Gemessen vorher: 56 Punktlichter (erstes
// Bild 2,9 s, alle Shader neu), 77.500 Brocken der ganzen Hoehle immer gezeichnet (6,3 Mio. Dreiecke/Bild), 1.930 Einzel-
// Meshes fuer Lava. Jetzt: Abschnitte zu ABSCHNITT m (je eigene InstancedMeshes), sichtbar nur HINTEN hinter und VORAUS vor
// dem Flieger ("der Tunnel hinter mir kann vergessen werden"); keine Punktlichter (Fels leuchtet leicht selbst, Lava ist
// MeshBasic); Lavastreifen je Abschnitt ein InstancedMesh; Brocken mit Detail 0 (20 statt 80 Dreiecke).
const ABSCHNITT = 400, VORAUS = 4, HINTEN = 1;
const bau = { fertig: false, lava: [], abschnitte: [] };
function baueHoehle(){
  if(bau.fertig) return; bau.fertig = true;
  const w = story.welt(6);
  // Fels: Lambert mit Eigenleuchten (ohne Punktlichter sonst fast schwarz), dazu warmer Schimmer von der Lava
  const mats = [0x2e2a27, 0x3b342e, 0x332d29].map(c => new THREE.MeshLambertMaterial({ color: c, emissive: 0x2a1408, flatShading: true }));
  let s = 91; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const formen = [];
  for(let k = 0; k < 4; k++){
    const g = new THREE.IcosahedronGeometry(0.5, 0), pp = g.attributes.position, mapV = new Map();
    for(let i = 0; i < pp.count; i++){ const key = pp.getX(i).toFixed(3) + ',' + pp.getY(i).toFixed(3) + ',' + pp.getZ(i).toFixed(3);
      if(!mapV.has(key)) mapV.set(key, 0.78 + rnd() * 0.44); const f = mapV.get(key); pp.setXYZ(i, pp.getX(i) * f, pp.getY(i) * f, pp.getZ(i) * f); }
    g.computeVertexNormals(); formen.push(g);
  }
  const lavaM = new THREE.MeshBasicMaterial({ color: 0xff5a1a });
  const streifenGeo = new THREE.PlaneGeometry(1.4, 22).rotateX(-Math.PI / 2);
  const richtung = (u) => { const a = punkt(u - 3, mitteV(u - 3)), b = punkt(u + 3, mitteV(u + 3)); return Math.atan2(b.x - a.x, b.z - a.z); };
  // Teile je Abschnitt sammeln (Index = Abschnitt ab -ANLAUF); der Schacht ist ein eigener Abschnitt (immer, wenn nah)
  const U0 = -ANLAUF - 60, nAbs = Math.ceil((U_WAND + 60 - U0) / ABSCHNITT) + 1;
  const proAbs = []; for(let i = 0; i < nAbs; i++) proAbs.push({ teile: [], lava: [] });
  const abs = (u) => proAbs[Math.max(0, Math.min(nAbs - 1, Math.floor((u - U0) / ABSCHNITT)))];
  const brocken = (A, x, y, z, sx, sy, sz, rot) => A.teile.push({ x, y, z, sx, sy, sz, rot, kipp: (rnd() - 0.5) * 0.5, f: Math.floor(rnd() * 4), m: Math.floor(rnd() * 3) });
  for(let u = U0; u <= U_AUS; u += 10){
    const A = abs(u), rot = richtung(u), b = breite(u) / 2, h = hoehe(u), mv = mitteV(u);
    for(const sgn of [-1, 1]) for(let y = -6; y < h + 6; y += 12){
      const gr = 15 + rnd() * 6; const p = punkt(u + (rnd() - 0.5) * 4, mv + sgn * (b + gr * 0.42), y + gr * 0.3);
      brocken(A, p.x, p.y, p.z, gr, gr * 1.1, 14 + rnd() * 6, rot);
    }
    for(let q = -b - 10; q <= b + 10; q += 10){
      const gr = 17 + rnd() * 6;
      const pb = punkt(u + (rnd() - 0.5) * 4, mv + q, -gr * 0.42); brocken(A, pb.x, pb.y, pb.z, gr, gr, 14 + rnd() * 5, rot);
      const pd = punkt(u + (rnd() - 0.5) * 4, mv + q, h + gr * 0.42); brocken(A, pd.x, pd.y, pd.z, gr * 1.3, gr * 1.4, 16 + rnd() * 5, rot);
    }
    if(Math.round(u) % 70 === 0 && u > -ANLAUF + 60 && u < U_AUS - 60) A.lava.push({ p: punkt(u, mv, 0.4), rot });
  }
  // Ausgang: helle Flaeche in Himmelsfarbe quer zur Roehre, etwas groesser als der Querschnitt, ohne Nebel/Licht –
  // "Licht am Ende des Tunnels", von weit her als heller Fleck zu sehen. Eigener Abschnitt, damit er frueh sichtbar ist.
  const S = { teile: [], lava: [], ausgang: true }; proAbs.push(S);
  { const u = U_AUS + 30, mv = mitteV(u), c = punkt(u, mv, hoehe(U_AUS) / 2), ri = richtung(u);
    const himmel = new THREE.Mesh(new THREE.PlaneGeometry(breite(U_AUS) * 1.6, hoehe(U_AUS) * 1.6),
      new THREE.MeshBasicMaterial({ color: 0xbfe3ff, fog: false, side: THREE.DoubleSide }));
    himmel.position.copy(c); himmel.rotation.y = ri; w.add(himmel); bau.lava.push(himmel);
    const glanz = new THREE.Mesh(new THREE.PlaneGeometry(breite(U_AUS) * 0.7, hoehe(U_AUS) * 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    glanz.position.copy(c).add(new THREE.Vector3(Math.sin(ri), 0, Math.cos(ri)).multiplyScalar(-1)); glanz.rotation.y = ri; w.add(glanz); bau.lava.push(glanz); }
  // je Abschnitt: eine Gruppe mit InstancedMeshes je Form/Material + ein InstancedMesh fuer die Lavastreifen
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), Eu = new THREE.Euler(), eins = new THREE.Vector3(1, 1, 1);
  proAbs.forEach((A, i) => {
    const g = new THREE.Group(); g.visible = false; w.add(g);
    for(let f = 0; f < 4; f++) for(let m = 0; m < 3; m++){
      const liste = A.teile.filter(t => t.f === f && t.m === m); if(!liste.length) continue;
      const inst = new THREE.InstancedMesh(formen[f], mats[m], liste.length);
      liste.forEach((t, k) => { q4.setFromEuler(Eu.set(t.kipp, t.rot, t.kipp * 0.7, 'YXZ')); m4.compose(new THREE.Vector3(t.x, t.y, t.z), q4, new THREE.Vector3(t.sx, t.sy, t.sz)); inst.setMatrixAt(k, m4); });
      inst.frustumCulled = false; g.add(inst);
    }
    if(A.lava.length){
      const li = new THREE.InstancedMesh(streifenGeo, lavaM, A.lava.length);
      A.lava.forEach((L, k) => { q4.setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.rot); m4.compose(L.p, q4, eins); li.setMatrixAt(k, m4); });
      li.frustumCulled = false; g.add(li);
    }
    bau.abschnitte.push({ g, i, ausgang: !!A.ausgang });
  });
  bau.U0 = U0; bau.teile = proAbs.reduce((n, A) => n + A.teile.length, 0);
}
// Sichtbar nur die Abschnitte um den Flieger; der Schacht ab dem Dom. Kostet pro Bild nur ein paar Vergleiche.
function abschnitteZeigen(){
  if(!bau.fertig) return;
  const L = lokal(state.pos.x, state.pos.z), ia = Math.floor((L.u - bau.U0) / ABSCHNITT);
  const nahAusgang = L.u > U_AUS - 2600;                            // das Licht sieht man von weit her
  for(const A of bau.abschnitte){
    const an = A.ausgang ? nahAusgang : (A.i >= ia - HINTEN && A.i <= ia + VORAUS);
    if(A.g.visible !== an) A.g.visible = an;
  }
  for(const b of bau.lava) b.visible = nahAusgang;
}

// ---- Ablauf -----------------------------------------------------------------------------------------------
const ho = story.hoehle = { aktiv: false, auto: false, t: 0, phase: '', fertig: false, rede: null, hudEl: null, ausbruch: null };
const AUTO_U = 0;                         // Autopilot fliegt hoechstens bis hier (Ende des Anlaufs), dann uebernimmt man
const ANSAGE = ['Wie bist du hier reingeraten? Egal!', 'Du musst da schleunigst raus, der Vulkan bricht gleich aus.', 'Immer Vollgas durch die Höhle.', 'Drei', 'Zwei', 'Eins', 'LOS!'];
function hoehleStart(){
  baueHoehle();
  Object.assign(ho, { aktiv: true, auto: true, t: 0, phase: 'auto', fertig: false, steht: false, szene: null, raus: 0 });
  gyroZeigen(false);                                                  // Live-Wunsch: in der Hoehle kein Gyroskop
  story.kunstflugAus = true;                                          // eigene ruhige Kamera (hookE6b)
  if(story.preflight && story.preflight.el) story.preflight.el.style.display = 'none';   // Startsequenz-HUD nicht in die Hoehle mitnehmen
  story.phase = 'hoehle';
  // Live-Bild: weisse Kugel um den Jet = Ueberschall-Dampfkegel der Engine (Flanke "unter -> ueber Schall" beim Spawn mit
  // Vollgas). Als schon ueberschallschnell melden, dann gibt es weder Knall noch Kegel.
  if(typeof wasSupersonic !== 'undefined') wasSupersonic = true;
  if(typeof vaporT !== 'undefined') vaporT = 0;
  // Spawn im Eingang, Vollgas, Nase in Hoehlenrichtung
  const p = punkt(-ANLAUF + 20, mitteV(-ANLAUF + 20), hoehe(0) / 2);
  state.pos.copy(p); state.throttle = 1; state.onGround = false; state.crashed = false;
  autoAusrichten(-ANLAUF + 20);
  state.vel.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat).multiplyScalar(spec.vMax));
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.visible = true;
  abschnitteZeigen();
  snapCamera();
  hud();
  ho.rede = story.sprich(ANSAGE, () => { ho.auto = false; ho.phase = 'frei'; story.hinweis('Vollgas! Durch die Höhle – nichts berühren!'); story.spaeter(4, () => story.hinweis('')); }, 'pilot');
}
story.hoehleStart = hoehleStart;
// Autopilot: Lage genau entlang der Mittellinie, Hoehe Mitte
function autoAusrichten(u){
  const a = punkt(u, mitteV(u), hoehe(u) / 2), b = punkt(u + 20, mitteV(u + 20), hoehe(u + 20) / 2);
  const d = b.clone().sub(a).normalize();
  // Nase des Modells = -Z: Matrix4.lookAt(eye, target, up) richtet +Z von target zu eye -> target = d (nicht -d)
  state.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), d, new THREE.Vector3(0, 1, 0)));
}
function hoehleUpdate(dt){
  if(!ho.aktiv || ho.fertig) return;
  abschnitteZeigen();
  ho.t += dt;
  const L = lokal(state.pos.x, state.pos.z);
  if(ho.auto){
    // Autopilot bis AUTO_U: genau auf der Mittellinie, wartet am Ende der Strecke, bis die Ansage fertig ist (Schleife)
    // kein Neustart mehr (Live-Feedback): am Ende des Anlaufs vorzeitig uebergeben, die Ansage laeuft weiter
    let u = L.u + spec.vMax * dt;
    if(u > AUTO_U){ ho.auto = false; ho.phase = 'frei'; story.hinweis('Vollgas! Durch die Höhle – nichts berühren!'); story.spaeter(4, () => story.hinweis('')); return; }
    state.pos.copy(punkt(u, mitteV(u), hoehe(u) / 2)); autoAusrichten(u);
    state.throttle = 1; state.vel.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat).multiplyScalar(spec.vMax));
    planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
    hud(); return;
  }
  // Selbst fliegen: Vollgas Pflicht, Beruehrung = Ende
  if(state.throttle < 0.995){ ende(false, 'zu langsam'); return; }
  // Live-Feedback: nach dem Krachen nicht noch aus der Hoehle fliegen -> sofort Schwarzblende, Flieger steht
  if(state.crashed || treffer()){ state.vel.set(0, 0, 0); state.throttle = 0; ho.steht = true; story.schwarz('', 1.5, () => {}); ende(false, 'Fels'); return; }
  // Ausgang passiert -> Schwarzblende -> Zwischenszene
  if(L.u > U_AUS && !ho.blende){
    ho.raus = (ho.raus || 0) + dt;                                    // noch kurz ins Licht fliegen
    if(ho.raus > AUS_NACH){ ho.blende = true; state.vel.set(0, 0, 0); story.schwarz('', 0.3, () => { ho.blende = false; szeneStart(); }); return; }
  }
  hud();
}
// Gyro: die Engine (updateGyro) setzt es jedes Bild sichtbar -> dort einhaengen (hookE6b), hier nur der Merker
let gyroAus = false;
function gyroZeigen(an){ gyroAus = !an; const g = document.getElementById('gyro'); if(g) g.style.display = an ? '' : 'none'; }
// ---- Zwischenszene "Jet rast aus dem Vulkan" (~3 s) -------------------------------------------------------------------
// Feste Kamera von weitem: Krater in der Bildmitte, unteres Drittel; der Jet schiesst senkrecht heraus, nach ~0,4 s der
// Ausbruch. Danach Schwarzblende und normaler Flug.
const SZENE_T = 3.0;
const SZENE_RICHT = new THREE.Vector3(1900, 0, 1800).normalize();   // von dort schaut die Kamera auf den Krater (waagerecht)
function szeneKamera(z){
  // Live-Wunsch: Krater bleibt Mitte unteres Drittel, die Kamera zieht so auf, dass der Jet im oberen Drittel bleibt.
  // Bildhoehe in der Entfernung d: B = 2 d tan(fov/2). Krater bei 1/3 von unten, Jet bei 2/3 -> Jet - Krater = B/3.
  // -> d = 3 H / (2 tan(fov/2)); Blick auf die Bildmitte = Krater + B/6 = Krater + H/2. Anfangs (H klein) Mindestabstand,
  // damit man den ganzen Berg sieht; dort steht der Jet knapp ueber dem Krater.
  const fov = camera.fov * Math.PI / 180, t2 = 2 * Math.tan(fov / 2);
  const H = Math.max(0, state.pos.y - z.krater.y);
  const dMin = 1600, d = Math.max(dMin, 3 * H / t2), B = d * t2;   // ab ~1,7 s zieht die Kamera mit zurueck
  const mitte = z.krater.clone().add(new THREE.Vector3(0, B / 6, 0));   // Krater liegt so bei 1/3 von unten
  z.cam.copy(mitte).addScaledVector(SZENE_RICHT, d);
  z.ziel.copy(mitte);
}
function szeneStart(){
  ho.aktiv = false; ho.phase = 'szene'; story.phase = 'alpha';
  const F = E.FUJI, krater = new THREE.Vector3(F.x, F.h, F.z);
  // Kamera: 2,6 km seitlich, auf ~1,7 km Hoehe, Blick etwas UEBER den Krater -> Krater liegt im unteren Drittel
  const cam = new THREE.Vector3(F.x + 1900, F.h - 300, F.z + 1800);
  const ziel = krater.clone().add(new THREE.Vector3(0, 520, 0));
  ho.szene = { t: 0, cam, ziel, krater, ausbruch: false, knall: false };
  state.pos.copy(krater).add(new THREE.Vector3(0, -40, 0));
  state.quat.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'YXZ'));   // Nase senkrecht nach oben
  state.vel.set(0, spec.vMax, 0); state.throttle = 1; state.onGround = false; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.visible = true;
  planeGroup.scale.setScalar(4);                                      // aus 3,5 km sonst nur ein Punkt
  szeneKamera(ho.szene);
  camera.position.copy(ho.szene.cam); camera.up.set(0, 1, 0); camera.lookAt(ho.szene.ziel);
}
function szeneUpdate(dt){
  const z = ho.szene; if(!z) return;
  z.t += dt;
  // Jet: senkrecht hoch mit voller Fahrt (eigene Bewegung, keine Physik)
  state.pos.y += spec.vMax * dt;                                      // volle Fahrt senkrecht (3 s ~ 1,1 km)
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  // Live-Wunsch: beim Verlassen des Kraters Ueberschallknall + Dampfkegel (Engine: triggerSonicBoom / updateSonic)
  if(!z.knall && state.pos.y > z.krater.y + 5){ z.knall = true; if(typeof triggerSonicBoom === 'function') triggerSonicBoom(); }
  if(typeof updateSonic === 'function'){ if(typeof wasSupersonic !== 'undefined') wasSupersonic = true; updateSonic(dt); }
  szeneKamera(z);
  if(!z.ausbruch && z.t > 0.8){ z.ausbruch = true; ausbruch(); }   // erst den Jet herausschiessen sehen, dann der Ausbruch
  if(z.t > SZENE_T && !ho.blende){ ho.blende = true; story.schwarz('', 0.4, () => { ho.blende = false; raus(); }); }
}
// Danach: normal fliegen, waagerecht 500 m, 50 % Schub, Richtung Strand-Flughafen; Ansage, Radarpunkt = Bahnmitte
function raus(){
  planeGroup.scale.setScalar(1);
  ho.aktiv = false; ho.szene = null; ho.phase = 'landen'; story.phase = 'alpha';
  story.kunstflugAus = false; gyroZeigen(true);
  // Live-Wunsch: waagerecht auf ~500 m mit 50 % Schub, hinter dem Fuji in Richtung Strand (-z), Nase zur Bahn
  const info = story.e6strand && story.e6strand();
  // Live-Test: bei 0,55 r war der Hang dort noch ~740 m hoch -> der Jet startete IM Berg (Kollision, Schub 0). 0,9 r: ~110 m
  const F = E.FUJI, start = new THREE.Vector3(F.x, 500, F.z - F.r * 0.9);
  const zx = info ? info.wx : 0, zz = info ? info.wz : start.z - 6000;
  state.pos.copy(start);
  state.quat.setFromEuler(new THREE.Euler(0, Math.atan2(-(zx - start.x), -(zz - start.z)), 0, 'YXZ'));
  state.throttle = 0.5;
  state.vel.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat).multiplyScalar(spec.vMax * 0.5));
  state.onGround = false; state.crashed = false;
  if(story.e6flug){ story.e6flug.laeuft = true; story.e6flug.hoehleFertig = true; }   // sonst haelt etappe6.js den Jet fest (Live-Test: stand)
  if(story.pfGasLos) story.pfGasLos();                                  // Gas-Sperre der Startsequenz loesen (sonst Schub 0)
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  snapCamera();
  story.ziel = info ? { x: info.wx, z: info.wz } : null;          // Mitte der Landebahn (Bahn liegt in der Inselmitte)
  // Live-Wunsch: die Ansage erst, wenn man sieht, wie der Jet auf der Strandseite vom Fuji wegfliegt – raus() laeuft noch
  // im Schwarzen (Blende ~1,3 s), deshalb 2 s spaeter
  story.spaeter(2, () => {
    if(!ho.landen || ho.fertig) return;
    story.sprich(['Du bist der Wahnsinn – ein wahres Fliegerass!', 'Jetzt noch landen, dann hast du es geschafft.'], null, 'pilot');
    story.hinweis('Lande am Flughafen am Strand (roter Punkt im Radar)'); story.spaeter(8, () => story.hinweis(''));
  });
  ho.landen = true;
  hud();
}
function ende(ok, wie){
  if(ho.fertig) return;
  ho.fertig = true; ho.aktiv = false; ho.landen = false; ho.szene = null; gyroZeigen(true); planeGroup.scale.setScalar(1);
  story.kunstflugAus = false;
  story.ziel = null;
  const txt = ok ? ['Sauber gelandet! Was für ein Flug!']
    : wie === 'zu langsam' ? ['Zu langsam! Du musst immer Vollgas fliegen – der Vulkan war schneller.']
    : wie === 'absturz' ? ['Oh nein, abgestürzt!', 'Kenji kommt ins Krankenhaus und muss eine Woche bleiben.']
    : ['Krach – der Alpha ist am Fels zerschellt!', 'Kenji wird gerettet, muss aber eine Woche ins Krankenhaus.'];
  if(!ok){ state.vel.set(0, 0, 0); state.throttle = 0; }
  story.sprich(txt, () => story.spaeter(1.5, () => { hudAus(); story.e6flugEnde(ok, ok ? 'durch den Fuji' : (wie === 'zu langsam' ? 'zu langsam in der Höhle' : 'Absturz, Krankenhaus')); }), 'pilot');
}
// Landung am Strand-Flughafen
function landungPruefen(){
  if(!ho.landen || ho.fertig) return;
  if(state.crashed){ ende(false, 'absturz'); return; }
  const info = story.e6strand && story.e6strand(); if(!info) return;
  const sp = Math.hypot(state.vel.x, state.vel.z);
  if(state.onGround && sp < 2 && Math.hypot(state.pos.x - info.wx, state.pos.z - info.wz) < info.radius) ende(true, 'ziel');
}

// ---- Ausbruch: Rauchsaeule und Lavabrocken aus dem Krater ---------------------------------------------------
function ausbruch(){
  // Live-Test: blasse Wolke, kaum zu sehen -> dunkler, dichter Rauchpilz, viele gluehende Lavabrocken in hohen Boegen,
  // Feuerschein im Krater; kein Nebel (fog: false), damit man ihn auch aus Kilometern sieht.
  const w = story.welt(6), k = new THREE.Vector3(E.FUJI.x, E.FUJI.h - 10, E.FUJI.z);
  const rauchM = [0x2a2522, 0x3a3430, 0x4a423c].map(c => new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: 0.92, fog: false }));
  const lavaM = new THREE.MeshBasicMaterial({ color: 0xff4a10, fog: false }), glutM = new THREE.MeshBasicMaterial({ color: 0xffb030, fog: false });
  const g = new THREE.Group(); w.add(g);
  const schein = new THREE.Mesh(new THREE.SphereGeometry(110, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.55, fog: false }));
  schein.position.copy(k); g.add(schein);
  const licht = new THREE.PointLight(0xff6a20, 3, 2500, 1.2); licht.position.copy(k).add(new THREE.Vector3(0, 80, 0)); g.add(licht);
  const teile = [];
  for(let i = 0; i < 70; i++){
    const rauch = i < 34;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rauch ? 90 + Math.random() * 90 : 10 + Math.random() * 14, 1), rauch ? rauchM[i % 3] : (i % 3 ? lavaM : glutM));
    m.position.copy(k); g.add(m);
    const a = Math.random() * Math.PI * 2, r = Math.random();
    const v = rauch ? new THREE.Vector3(Math.cos(a) * 25 * r, 70 + Math.random() * 60, Math.sin(a) * 25 * r)
                    : new THREE.Vector3(Math.cos(a) * (60 + 140 * r), 140 + Math.random() * 160, Math.sin(a) * (60 + 140 * r));
    teile.push({ m, v, rauch, t: -i * (rauch ? 0.12 : 0.05) });
  }
  ho.ausbruch = { g, teile, t: 0, schein, licht };
}
function ausbruchUpdate(dt){
  const a = ho.ausbruch; if(!a) return;
  a.t += dt;
  a.schein.scale.setScalar(1 + 0.15 * Math.sin(a.t * 6)); a.licht.intensity = 2.5 + Math.sin(a.t * 9);
  for(const p of a.teile){
    p.t += dt; if(p.t < 0) continue;
    p.m.position.addScaledVector(p.v, dt);
    if(p.rauch){ p.v.y *= 1 - 0.05 * dt; p.m.scale.multiplyScalar(1 + 0.09 * dt); }
    else { p.v.y -= 9.81 * dt; if(p.m.position.y < 0){ // Lava faellt ins Meer/auf den Hang -> neu aus dem Krater
        p.m.position.set(E.FUJI.x, E.FUJI.h - 10, E.FUJI.z); const an = Math.random() * Math.PI * 2, r = Math.random();
        p.v.set(Math.cos(an) * (60 + 140 * r), 140 + Math.random() * 160, Math.sin(an) * (60 + 140 * r)); } }
  }
}

// ---- HUD ---------------------------------------------------------------------------------------------
function hud(){
  if(!ho.hudEl){
    ho.hudEl = document.createElement('div'); ho.hudEl.dataset.etappeHud = '1';
    ho.hudEl.style.cssText = 'position:absolute;left:16px;top:62%;transform:translateY(-50%);padding:10px 14px;border-radius:10px;'
      + 'background:rgba(0,0,0,.55);color:#fff;font:15px/1.6 system-ui,sans-serif;min-width:200px;z-index:20;';
    document.body.appendChild(ho.hudEl);
  }
  const schub = Math.round(Math.max(0, state.throttle) * 100), farbe = schub >= 100 ? '#2ecc40' : '#e03c31';
  const zeile = ho.phase === 'auto' ? 'Autopilot …' : ho.phase === 'landen' ? 'Am Strand landen' : 'Durch die Höhle zum Licht!';
  ho.hudEl.innerHTML = '<div style="font-weight:700;margin-bottom:4px">🌋 Vulkan</div>'
    + '<div>Schub <b style="color:' + farbe + '">' + schub + ' %</b> <span style="opacity:.7">(100 % Pflicht)</span></div>'
    + '<div style="opacity:.75;font-size:13px;margin-top:4px">' + zeile + '</div>';
  ho.hudEl.style.display = 'none';                                     // Live-Feedback: Info-Box im Vulkan ausgeblendet
}
function hudAus(){ if(ho.hudEl) ho.hudEl.style.display = 'none'; }

// ---- Hooks ---------------------------------------------------------------------------------------------
function hookE6b(){
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(hier() && ho.aktiv && ho.auto){ hoehleUpdate(dt); return; }     // Autopilot: keine Physik
    if(hier() && ho.szene){ szeneUpdate(dt); return; }                  // Zwischenszene: eigene Bewegung, keine Physik
    if(hier() && ho.blende) return;                                     // waehrend einer Blende steht alles
    if(hier() && ho.steht){ state.vel.set(0, 0, 0); state.throttle = 0; return; }   // gekracht: steht bis zum Etappenende
    const r = physOrig.apply(this, arguments);
    if(hier() && ho.aktiv) hoehleUpdate(dt);
    if(hier() && ho.landen) landungPruefen();
    return r;
  };
  // In der Hoehle zaehlt nur die eigene Kollision (Fuji-Kegel ist dort hohl)
  const hitsOrig = hitsBuilding;
  hitsBuilding = function(){ if(hier() && ho.aktiv) return false; return hitsOrig.apply(this, arguments); };
  const resetOrig = resetPlane;
  resetPlane = function(){ if(hier() && (ho.aktiv || ho.landen)) return; return resetOrig.apply(this, arguments); };
  const gyroOrig = updateGyro;
  updateGyro = function(){ if(gyroAus && hier()){ const g = document.getElementById('gyro'); if(g) g.style.display = 'none'; return; } return gyroOrig.apply(this, arguments); };
  // Eigene Kamera (Live-Feedback: sprang hin und her, im Schacht verdreht). Blick = Fahrtrichtung, "oben" = Kabinendach des
  // Fliegers, im Waagerechtflug sanft zur Welt-Senkrechten gezogen. Oben wird immer senkrecht zur Blickrichtung gemacht
  // (Gram-Schmidt) -> lookAt kann nie kippen, auch nicht beim Uebergang in den senkrechten Steigflug.
  const camOrig = updateCamera, _r = new THREE.Vector3(), _soll = new THREE.Vector3(), _up = new THREE.Vector3(), _dach = new THREE.Vector3(), _camUp = new THREE.Vector3(0, 1, 0);
  updateCamera = function(){
    if(hier() && ho.szene){ camera.position.copy(ho.szene.cam); camera.up.set(0, 1, 0); camera.lookAt(ho.szene.ziel); return; }   // Zwischenszene: feste Kamera
    if(!(hier() && (ho.aktiv || ho.steht))) return camOrig.apply(this, arguments);
    _r.copy(state.vel); if(_r.lengthSq() < 1) _r.set(0, 0, -1).applyQuaternion(state.quat); _r.normalize();
    _dach.set(0, 1, 0).applyQuaternion(state.quat);                  // Kabinendach
    const waag = 1 - Math.min(1, Math.abs(_r.y) / 0.7);             // 1 waagerecht .. 0 ab ~45 Grad Steigen
    _up.copy(_dach).lerp(new THREE.Vector3(0, 1, 0), 0.85 * waag);   // im Waagerechtflug fast Welt-Oben, steil: Dach
    _up.addScaledVector(_r, -_up.dot(_r));                           // senkrecht zur Blickrichtung machen
    if(_up.lengthSq() < 1e-4) _up.copy(_dach).addScaledVector(_r, -_dach.dot(_r));
    _up.normalize();
    _camUp.lerp(_up, 0.12); _camUp.addScaledVector(_r, -_camUp.dot(_r)); if(_camUp.lengthSq() < 1e-4) _camUp.copy(_up); _camUp.normalize();
    _soll.copy(state.pos).addScaledVector(_r, -26).addScaledVector(_camUp, 6);
    camera.position.lerp(_soll, 0.3);
    camera.up.copy(_camUp);
    camera.lookAt(state.pos.x + _r.x * 40, state.pos.y + _r.y * 40, state.pos.z + _r.z * 40);
  };
}
story.updateE6b = function(dt){ if(!e6()) return; ausbruchUpdate(dt || 0); };
story.aufgabeE6b = () => ho.aktiv || ho.landen ? ['Vulkan', [
  ['Schub', 'immer 100 % – sonst nicht geschafft'],
  ['Höhle', 'nichts berühren – eng und kurvig'],
  ['Ende', 'zum Licht – dem Ausgang am Ende der Höhle'],
  ['Danach', 'am Flughafen am Strand landen'],
]] : null;

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookOrig) hookOrig(); hookE6b(); };
})();
