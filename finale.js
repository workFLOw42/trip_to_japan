// Trip to Japan – Finale am Fukuoka-Beach (nach Etappe 6) mit der C-400 auf dem Vorfeld (Live-Wunsch 13.10.2026: Transall statt
// Mustang). Laedt nach etappe6c.js, vor der Engine. Welche Stufe es gibt, haengt an den verbrauchten Tagen (Konzept.md, 5-Stufen-Finale):
//   Stufe 1 (6 Tage)    "Abenteuer" (Fuji-Sprung): Kenji fliegt selbst hoch ueber den Fuji. Ueber der Piste uebernimmt der Pilot, B = abspringen,
//                       freier Fall (linker Stick lenkt), der Schirm geht von allein auf, Landung auf der verschneiten Piste.
//                       Danach die Snowboard-Abfahrt (Felsen, Rampen, Rail, Tricks) und die Mega-Rampe hinaus aufs Meer.
//   Stufe 2 (9-12 Tage) "Rundflug": Kenji fliegt selbst durch Ringe um den Fuji und ueber den Gipfel, dann zurueck und landen.
// Steigen bis 500 m ueber den Gipfel (maxAlt 2500 m). Absturz oder daneben = noch einmal (Blende, zurueck an die C-400).
(function(){
'use strict';
const story = window.STORY;
function e6(){ return story.etappe === 6; }
function hier(){ return e6() && locale === 'earth'; }

function stufe(){ const t = story.tage; return t <= 6 ? 1 : t <= 12 ? 2 : t <= 21 ? 3 : t <= 39 ? 4 : 5; }
story.finaleStufe = stufe;
story.finaleSchild = () => ({ 1: 'Abenteuer', 2: 'Rundflug' })[stufe()] || 'Außer Betrieb';   // Schild ueber der C-400 (Live-Wunsch)

const MAX_ALT = 2500;            // Gipfel 2000 m + 500 m (Live-Wunsch)
const SPRUNG_MIN = 2300;         // ab dieser Hoehe uebernimmt der Pilot ueber der Piste
const SPRUNG_R = 600;            // Radius um den Zielpunkt ueber der Piste
const SCHIRM_AUF = 120;          // m ueber Grund: der Schirm geht von allein auf
const PISTE_B = 44;              // Breite der Piste
const RING_R = 70, RING_TREFFER = 170;

const fin = { aktiv: false, art: null, schritt: null, hudEl: null, ringe: [], ringNr: 0, abgehoben: false, crash: false,
  k: null, flieger: null, piste: null, yaw: 0, hoehe: 0, zurueck: false };
story.finale = fin;
const L = () => story.e6;

// Fuji-Oberflaeche am Modell. Das Modell ist am Hang hoeher als die Formel fujiY (etappe6.js): auf halbem Radius ~870 statt 640 m.
const _ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(0, -1, 0);
function fujiMeshY(x, z){
  const F = L().FUJI, m = story.e6fujiMesh;
  if(!m || Math.hypot(x - F.x, z - F.z) > F.r) return -Infinity;
  _o.set(x, 5000, z); _ray.set(_o, _d);
  const h = _ray.intersectObject(m, false);
  return h.length ? h[0].point.y : -Infinity;
}
story.finaleFujiY = fujiMeshY;
let pyI = 0;                                              // zuletzt gefundener Abschnitt (Suche lokal von dort)
function pisteYschnell(x, z){
  const P = fin.piste && fin.piste.pts; if(!P || !P[0].hq) return null;
  const n = P.length - 1, d2 = i => { const p = P[i]; return (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z); };
  if(fin.schritt !== 'abfahrt' || ab.i === undefined || ab.bauen) return null;     // nur in der Fahrt, nicht beim Aufbau
  const start = ab.i;
  let i = Math.max(0, Math.min(n - 1, start)), best = d2(i);
  for(let k = Math.max(0, i - 12), e = Math.min(n, i + 12); k <= e; k++){ const d = d2(k); if(d < best){ best = d; i = k; } }
  if(best > 30 * 30 || Math.abs(i - start) > 15) return null;                     // nicht in Kenjis Naehe -> Raycast
  if(best > 60 * 60) return null;                         // weit weg von der Piste
  pyI = i;
  // Abschnitt [i0, i0+1] mit dem Lot von (x, z) dazwischen
  let i0 = i; const pi = P[i]; if(i > 0){ const q = P[i - 1], vx = pi.x - q.x, vz = pi.z - q.z; if((x - pi.x) * vx + (z - pi.z) * vz < 0) i0 = i - 1; }
  if(i0 >= n) i0 = n - 1;
  const a = P[i0], b = P[i0 + 1], lx = b.x - a.x, lz = b.z - a.z, ll = lx * lx + lz * lz || 1;
  const f0 = ((x - a.x) * lx + (z - a.z) * lz) / ll; if(f0 < -0.25 || f0 > 1.25) return null;
  const f = Math.max(0, Math.min(1, f0));
  const mx = a.x + lx * f, mz = a.z + lz * f, nx = a.nx + (b.nx - a.nx) * f, nz = a.nz + (b.nz - a.nz) * f;
  const s = ((x - mx) * nx + (z - mz) * nz) / (PISTE_B / 2);  // quer: -1 .. 1
  if(Math.abs(s) > 1.4) return null;                      // weiter draussen (Boeschung) -> Raycast
  const u = (Math.max(-1, Math.min(1, s)) + 1) * 3, j = Math.min(5, Math.floor(u)), w = u - j;
  const ha = a.hq[j] + (a.hq[j + 1] - a.hq[j]) * w, hb = b.hq[j] + (b.hq[j + 1] - b.hq[j]) * w;
  return ha + (hb - ha) * f;
}
function pisteY(x, z){
  if(!fin.piste) return -Infinity;
  const sy = pisteYschnell(x, z); if(sy !== null) return sy;
  _o.set(x, 5000, z); _ray.set(_o, _d);
  const h = _ray.intersectObject(fin.piste.mesh, false);
  return h.length ? h[0].point.y : -Infinity;
}
story.finalePisteY = pisteY;
function bodenY(x, z){ return Math.max(fujiMeshY(x, z), aufPiste(x, z) ? pisteY(x, z) : -Infinity, isOnLand(x, z) ? ISLAND_Y : 0); }

// ---- Piste: breiter Schneestreifen, der sich vom Gipfel zur Meerseite hinunterschlaengelt (Richtung Fukuoka-Beach) -------
const PISTE_DIR = (() => { const l = Math.hypot(0.35, 0.94); return { x: -0.35 / l, z: -0.94 / l }; })();
function bauePiste(){
  if(fin.piste || !story.e6fujiMesh) return;
  const F = L().FUJI; story.e6fujiMesh.updateMatrixWorld(true);
  const N = 640, r0 = 0.1 * F.r, r1 = 0.955 * F.r, qx = -PISTE_DIR.z, qz = PISTE_DIR.x;   // endet vor der Steilkante des Modells
  const pts = [];
  for(let i = 0; i <= N; i++){
    const t = i / N, r = r0 + (r1 - r0) * t, seit = Math.sin(t * Math.PI * 7) * (50 + 230 * t);   // 3,5 Boegen, unten weiter
    pts.push({ x: F.x + PISTE_DIR.x * r + qx * seit, z: F.z + PISTE_DIR.z * r + qz * seit });
  }
  const pos = [], idx = [];
  for(let i = 0; i <= N; i++){
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)], dl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = -(b.z - a.z) / dl, nz = (b.x - a.x) / dl, p = pts[i];
    p.y = Math.max(fujiMeshY(p.x, p.z), 0.5);
    // je Schnitt QN Punkte: Boeschung links, 7 Punkte quer ueber die Fahrbahn, Boeschung rechts
    const B = PISTE_B / 2, QN = 9;
    const xl = p.x - nx * (B + 8), zl = p.z - nz * (B + 8), xr = p.x + nx * (B + 8), zr = p.z + nz * (B + 8);
    pos.push(xl, Math.max(fujiMeshY(xl, zl), 0.5) - 3, zl);
    p.hq = []; p.nx = nx; p.nz = nz;
    for(let j = 0; j < 7; j++){ const s = -1 + j / 3, x = p.x + nx * s * B, z = p.z + nz * s * B, y = Math.max(fujiMeshY(x, z), p.y - 6, 0.5) + 2.5; pos.push(x, y, z); p.hq.push(y); }
    pos.push(xr, Math.max(fujiMeshY(xr, zr), 0.5) - 3, zr);
    if(i < N){ const k = i * QN; for(let j = 0; j < QN - 1; j++) idx.push(k + j, k + j + 1, k + j + QN, k + j + 1, k + j + QN + 1, k + j + QN); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xf4f8ff, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false; story.welt(6).add(mesh);
  fin.piste = { mesh, pts, ziel: pts[Math.round(N * 0.08)] };
  story.finalePiste = fin.piste;                       // fuer die Snowboard-Abfahrt
  baueWald();
}
function pisteAbstand(x, z){
  if(!fin.piste) return Infinity;
  let best = Infinity; for(const p of fin.piste.pts){ const d = Math.hypot(x - p.x, z - p.z); if(d < best) best = d; }
  return best;
}
function aufPiste(x, z){ return pisteAbstand(x, z) < PISTE_B / 2 + 4; }

// ---- Ringe fuer den Rundflug: drei um den Berg (Suedseite zuerst, zum Strand hin), dann ueber den Gipfel ---------------
function baueRinge(){
  if(fin.ringe.length || !story.e6fujiMesh) return;
  // Sechs Ringe rund um den Berg (Strandseite zuerst), dann ueber den Gipfel. Hoehe = hoechster Hang auf dem Weg vom
  // vorigen Ring + 180 m: wer dem roten Punkt geradeaus folgt, fliegt nie in die Bergschulter.
  const F = L().FUJI, R = 2300; story.e6fujiMesh.updateMatrixWorld(true);
  const pk = [-90, -30, 30, 90, 150, 210].map(g => { const a = g * Math.PI / 180; return { x: F.x + Math.cos(a) * R, z: F.z + Math.sin(a) * R }; });
  pk.push({ x: F.x, z: F.z, gipfel: true });
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, fog: false });
  const geo = new THREE.TorusGeometry(RING_R, 4, 8, 40);
  let vx = L().FLUGFELD.x, vz = L().FLUGFELD.z;
  for(const p of pk){
    let hang = 0;
    if(!p.gipfel) for(let s = 0; s <= 20; s++){ const x = vx + (p.x - vx) * s / 20, z = vz + (p.z - vz) * s / 20; hang = Math.max(hang, fujiMeshY(x, z)); }
    const y = p.gipfel ? Math.min(MAX_ALT - 60, fujiMeshY(p.x, p.z) + 250) : Math.min(MAX_ALT - 60, hang + 180);
    const m = new THREE.Mesh(geo, mat); m.position.set(p.x, y, p.z);
    m.rotation.y = Math.atan2(p.x - vx, p.z - vz);     // Ringachse in Flugrichtung
    m.visible = false; story.welt(6).add(m);
    fin.ringe.push({ x: p.x, y, z: p.z, gipfel: !!p.gipfel, mesh: m }); vx = p.x; vz = p.z;
  }
}

// ---- Einsteigen ------------------------------------------------------------------------------------------------
function c400Nah(){
  const v = L() && L().VORFELD;
  return !!(hier() && story.phase === 'ankunft' && eva && v && stufe() <= 2 && Math.hypot(eva.group.position.x - v.x, eva.group.position.z - v.z) < 22);
}
story.c400Nah = c400Nah;
const TEXT_RUNDFLUG = [
  'Willkommen an Bord der C-400! Heute fliegst du selbst – einmal rund um den Fuji.',
  'Erst die Startsequenz, dann Vollgas und abheben. Flieg durch die gelben Ringe, der rote Punkt im Radar zeigt dir den nächsten.',
  'Zum Schluss geht es über den Gipfel. Danach bringst du uns zurück und landest hier auf der Bahn.',
];
const TEXT_SPRUNG = [
  'Willkommen an Bord! Heute wird es wild: Du fliegst uns hoch über den Fuji.',
  'Erst die Startsequenz, dann steig auf mindestens zweitausenddreihundert Meter und flieg zum roten Punkt über der weißen Piste.',
  'Dort übernehme ich das Steuer, und du springst mit B ab. Im freien Fall lenkst du mit dem linken Stick, der Schirm geht von allein auf. Lande auf der Piste!',
];
function bahnStart(){
  const FL = L().FLUGFELD;
  state.pos.set(FL.x, ISLAND_Y, FL.z - FL.laenge / 2 + 40);
  state.quat.setFromEuler(new THREE.Euler(0, Math.PI, 0, 'YXZ'));     // Nase nach +z, zum Fuji
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false; state.crashTimer = 0;
  state.falling = false; state.ejected = false; state.stalling = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.scale.setScalar(1);
}
function einsteigen(){
  fin.aktiv = true; fin.art = stufe() === 1 ? 'sprung' : 'rundflug'; fin.schritt = 'ansage';
  fin.abgehoben = false; fin.crash = false; fin.ringNr = 0;
  story.phase = 'finale'; story.hinweis('');
  story.schwarz('', 0.6, () => {                       // von der C-400 auf dem Vorfeld an den Anfang der Bahn
    clearEva();
    currentModel = MODEL_NAMES.indexOf('Transall');
    document.getElementById('mdl').textContent = 'C-400';
    buildModel('Transall'); spec = Object.assign({}, PLANE_SPECS.Transall || DEFAULT_SPEC, { maxAlt: MAX_ALT });
    bahnStart(); planeGroup.visible = true; snapCamera();
    const c = story.e6c400 && story.e6c400(); if(c) c.visible = false;
    if(fin.art === 'sprung'){ bauePiste(); ladeBrett(); } else baueRinge();
    story.sprich(fin.art === 'sprung' ? TEXT_SPRUNG : TEXT_RUNDFLUG, () => {
      if(!fin.aktiv || fin.schritt !== 'ansage') return;
      fin.schritt = 'sequenz';
      story.pfStart({ kurzschluss: false, ohneZeit: true, still: true, danach: () => {
        if(!fin.aktiv) return;
        fin.schritt = 'flug'; zielSetzen();
        story.sprich(['Sehr gut! Vollgas und ab in die Luft.'], null, 'pilot');
      }});
    }, 'pilot');
  });
}
function zielSetzen(){
  if(fin.art === 'rundflug'){
    const r = fin.ringe[fin.ringNr];
    story.ziel = r ? { x: r.x, z: r.z } : { x: L().FLUGFELD.x, z: L().FLUGFELD.z };
  } else if(fin.piste) story.ziel = { x: fin.piste.ziel.x, z: fin.piste.ziel.z };
}

// ---- Flug (Kenji steuert) ---------------------------------------------------------------------------------------
function flugUpdate(){
  if(state.crashed){
    if(!fin.crash){ fin.crash = true; story.ziel = null;
      story.sprich(['Oh nein! Das ging schief. Keine Sorge – wir versuchen es gleich noch einmal.'], null, 'pilot');
      story.spaeter(3.5, () => zurueck('Noch ein Versuch!')); }
    return;
  }
  if(!fin.abgehoben && !state.onGround && state.pos.y - ISLAND_Y > 20) fin.abgehoben = true;
  if(fin.art === 'rundflug'){
    rundflugUpdate();
    if(inEruption()){ if(!fin.ruettel || performance.now() - fin.ruettel > 400){ fin.ruettel = performance.now(); if(typeof rumble === 'function') rumble(380, 0.9, 0.7); }
      state.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.03))); }
  } else sprungFlugUpdate();
}
function rundflugUpdate(){
  if(fin.ringNr < fin.ringe.length){
    const r = fin.ringe[fin.ringNr];
    r.mesh.visible = true; r.mesh.material.opacity = 0.65 + 0.25 * Math.sin(performance.now() / 250);
    if(Math.hypot(state.pos.x - r.x, state.pos.z - r.z) < RING_TREFFER && Math.abs(state.pos.y - r.y) < RING_TREFFER){
      r.mesh.visible = false; fin.ringNr++; zielSetzen();
      // Keine Ansagen unterwegs (Live-Wunsch), nur nach der Landung
    }
    return;
  }
  // Heimweg: auf dem Flugfeld landen und ausrollen
  const FL = L().FLUGFELD;
  if(fin.abgehoben && state.onGround && state.vel.length() < 3 && Math.hypot(state.pos.x - FL.x, state.pos.z - FL.z) < FL.laenge){
    fin.schritt = 'fertig'; story.ziel = null; state.throttle = 0;
    story.sprich(['Und jetzt ab an den Strand: Die Wellen sind heute richtig hoch!'], () => zurueck('', 'Surfen auf hohen Wellen kommt bald!'), 'pilot');
  }
}
// Vulkan beim Rundflug (Live-Wunsch): bricht immer wieder aus (20-30 s Ruhe, 18-25 s Ausbruch) und sicher, sobald man auf den
// Gipfel-Ring zufliegt – man fliegt durch die Eruption. Durchfliegen ist kein Absturz, nur Ruetteln und Rauchschwaden.
const vulkan = { t: 8, an: false };
function vulkanUpdate(dt){
  if(!story.e6ausbruch) return;
  const R = fin.ringe[fin.ringNr], zumGipfel = !!(R && R.gipfel);
  if(zumGipfel && !vulkan.an){ vulkan.an = true; vulkan.t = 999; story.e6ausbruch(); return; }
  vulkan.t -= dt;
  if(vulkan.t > 0) return;
  if(vulkan.an){ if(zumGipfel) return; vulkan.an = false; vulkan.t = 20 + Math.random() * 10; story.e6ausbruchStopp(); }
  else { vulkan.an = true; vulkan.t = 18 + Math.random() * 7; story.e6ausbruch(); }
}
function vulkanAus(){ vulkan.an = false; vulkan.t = 8; if(story.e6ausbruchStopp) story.e6ausbruchStopp(); }
// In der Rauchsaeule ueber dem Krater: ruetteln (Controller) und leicht durchschuetteln
function inEruption(){
  if(!(story.e6ausbruchLaeuft && story.e6ausbruchLaeuft())) return false;
  const F = L().FUJI, d = Math.hypot(state.pos.x - F.x, state.pos.z - F.z), ueber = state.pos.y - F.h;
  return d < 260 && ueber > -40 && ueber < 1400;
}
function sprungFlugUpdate(){
  const z = fin.piste && fin.piste.ziel; if(!z || fin.schritt !== 'flug') return;
  const d = Math.hypot(state.pos.x - z.x, state.pos.z - z.z);
  if(d < SPRUNG_R && !state.onGround && state.pos.y - ISLAND_Y >= SPRUNG_MIN - 50){   // 50 m Spielraum (HUD rundet)
    fin.schritt = 'pilot'; fin.yaw = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ').y; fin.hoehe = state.pos.y;
    story.sprich(['Ich übernehme! Wir kreisen über der Piste. Spring mit B, wenn du bereit bist!'], null, 'pilot');
  }
}
// Der Pilot kreist in der Hoehe ueber dem Zielpunkt (die Engine-Physik ist solange aus)
const KREIS_R = 150;                                     // Kreisbahn des Piloten um den Zielpunkt (m)
function pilotSchritt(dt){
  const z = fin.piste.ziel, p = state.pos, V = 62;
  // Erst auf den Kreis, dann darauf bleiben: Sollrichtung = Tangente plus Zug zum Radius (gegen den Uhrzeigersinn)
  const dx = p.x - z.x, dz = p.z - z.z, d = Math.hypot(dx, dz) || 1;
  const tx = -dz / d, tz = dx / d, zug = Math.max(-1, Math.min(1, (d - KREIS_R) / 120));
  const sx = tx - (dx / d) * zug * 1.5, sz = tz - (dz / d) * zug * 1.5;
  let dy = Math.atan2(-sx, -sz) - fin.yaw; while(dy > Math.PI) dy -= 2 * Math.PI; while(dy < -Math.PI) dy += 2 * Math.PI;
  const w = Math.max(-0.6, Math.min(0.6, dy * 2));
  fin.yaw += w * dt;
  state.quat.setFromEuler(new THREE.Euler(0, fin.yaw, w * 0.9, 'YXZ'));
  state.vel.set(-Math.sin(fin.yaw), 0, -Math.cos(fin.yaw)).multiplyScalar(V);
  fin.hoehe = Math.min(MAX_ALT - 20, fin.hoehe + 25 * dt);             // nach der Uebernahme langsam hoeher (mehr Fallhoehe)
  p.addScaledVector(state.vel, dt); p.y = fin.hoehe;
  state.throttle = 0.85; state.onGround = false;
  planeGroup.position.copy(p); planeGroup.quaternion.copy(state.quat);
}

// ---- Absprung, freier Fall, Schirm, Landung ---------------------------------------------------------------------
function kAnim(n, einmal){
  const k = story.kenji; if(!k || !k.acts[n] || k.cur === n) return;
  const a = k.acts[n];
  if(einmal){ a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(THREE.LoopRepeat); a.clampWhenFinished = false; }
  const alt = k.cur === 'haltung' ? k.acts.land : k.acts[k.cur];
  if(alt === a) a.paused = false;
  if(alt && alt.paused){ alt.paused = false; alt.stop(); a.reset().play(); k.cur = n; return; }   // eingefrorene Haltung: hart wechseln
  a.reset().play();
  if(alt && alt !== a) alt.crossFadeTo(a, 0.25, false);
  k.cur = n;
}
function stick(){
  let x = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0), y = (keys['ArrowDown'] ? 1 : 0) - (keys['ArrowUp'] ? 1 : 0);
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(gp){ const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0; if(Math.abs(ax) > 0.15) x = ax; if(Math.abs(ay) > 0.15) y = ay; }
  return { x, y };
}
function aktionB(){
  if(fin.schritt === 'welle') welleSpringen();
  else if(fin.schritt === 'abfahrt') springen();
  else if(fin.schritt === 'pilot') abspringen();
  else if(fin.schritt === 'flug' && fin.art === 'sprung'){
    story.hinweis('Erst zum roten Punkt über der Piste – mindestens ' + SPRUNG_MIN + ' m hoch!'); story.spaeter(4, () => story.hinweis(''));
  }
}
const frei = { rolle: 0, salto: 0, r0: 0, s0: 0 };
function freiflugStart(){ frei.rolle = 0; frei.salto = 0; frei.r0 = 0; frei.s0 = 0; }
function freiflugSchritt(dt){
  const rs = rStick();
  frei.rolle -= rs.x * 4.5 * dt;                            // ~1,4 s je Rolle
  frei.salto += rs.y * 3.5 * dt;                            // R-Stick vor (negativ) = Kopf runter / abtauchen
  const ganz = (w, w0) => Math.trunc((w - w0) / (2 * Math.PI));
  const nr = ganz(frei.rolle, frei.r0), ns = ganz(frei.salto, frei.s0);
  if(nr){ frei.r0 += nr * 2 * Math.PI; trick('Rolle'); }
  if(ns){ frei.s0 += ns * 2 * Math.PI; trick(ns < 0 ? 'Salto vorwärts' : 'Salto rückwärts'); }
}
function freiflugAufrichten(dt){
  const z = w => Math.round(w / (2 * Math.PI)) * 2 * Math.PI, f = Math.min(1, dt * 2.5);
  frei.rolle += (z(frei.rolle) - frei.rolle) * f; frei.salto += (z(frei.salto) - frei.salto) * f;
}
// Figur g mit der Koerpermitte auf m setzen: Blickrichtung yaw, Salto um die Querachse, Rolle um die Laengsachse
// ('fly' liegt flach, Kopf voraus: die Laengsachse ist die Blickrichtung)
const _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion(), _fm = new THREE.Vector3();
function freiflugPose(g, m, yaw){
  g.quaternion.setFromAxisAngle(_Y, yaw).multiply(_fq.setFromAxisAngle(_X, frei.salto)).multiply(_fq2.setFromAxisAngle(_Z, frei.rolle));
  _fm.set(0, 0.8, 0).applyQuaternion(g.quaternion);
  g.position.set(m.x - _fm.x, m.y - _fm.y, m.z - _fm.z);
}
// Trick zaehlen (Freiflug, Snowboard, Rail, Mega)
function trick(name){ ab.tricks.push(name); zeige('✨ ' + name + '!', 1.8); }
function abspringen(){
  fin.schritt = 'fall';
  // Der Flieger fliegt als Kopie geradeaus weiter; state.pos folgt ab jetzt Kenji (Radar, Hoehe im HUD)
  const f = planeGroup.clone(true); scene.add(f); planeGroup.visible = false;
  fin.flieger = { g: f, v: state.vel.clone(), t: 0 };
  const g = makeAstronaut(), back = new THREE.Vector3(0, 0, 1).applyQuaternion(state.quat);
  g.position.set(state.pos.x + back.x * 8, state.pos.y - 3, state.pos.z + back.z * 8);
  scene.add(g);
  fin.k = { g, v: state.vel.clone().multiplyScalar(0.6), yaw: fin.yaw, t: 0, m: g.position.clone().add(new THREE.Vector3(0, 0.8, 0)) }; fin.k.v.y = 0;
  let best = null, bd = 1e9; fin.piste.pts.forEach((q, i) => { if(i < 8) return; const dd = Math.hypot(q.x - g.position.x, q.z - g.position.z); if(dd < bd){ bd = dd; best = q; } });
  fin.k.lande = { x: best.x, z: best.z, sx: 0, sz: 0 };   // sx/sz: Versatz durch den Stick (bleibt auf der Pistenbreite)
  kAnim('fly'); state.throttle = 0; freiflugStart(); ab.tricks = []; ab.v = 0;
  if(story.hudSichtbar) story.hudSichtbar(false);          // Live-Wunsch: ab dem Fallschirmsprung kein HUD
  story.sprich(['Viel Spaß!'], null, 'pilot');
  story.hinweis('');
}
function schirmAuf(){
  const k = fin.k; if(!k || fin.schritt !== 'fall') return;
  fin.schritt = 'schirm';
  const g = makeParachute(); g.position.copy(k.m ? k.m : k.g.position); if(k.m) g.position.y -= 0.8;
  scene.remove(k.g); scene.add(g); k.g = g; k.m = null;
  frei.rolle = 0; frei.salto = 0; if(fx) fx.wind.material.opacity = 0;
  kAnim('hang');
  k.v.y = Math.max(k.v.y, -20);
  story.hinweis('');
}
function sprungSchritt(dt){
  const f = fin.flieger;
  if(f){ f.t += dt; f.g.position.addScaledVector(f.v, dt); if(f.t > 14){ scene.remove(f.g); fin.flieger = null; } }
  const k = fin.k; if(!k) return;
  k.t += dt;
  const st = stick(), p = fin.schritt === 'fall' && k.m ? k.m : k.g.position;
  // Gleitpfad: waagerecht genau so schnell zum Landepunkt, dass er bei der Landung erreicht ist (Restzeit aus der Hoehe)
  const L0 = k.lande, lx = L0.x + L0.sx, lz = L0.z + L0.sz;
  L0.sx += st.x * 6 * dt * Math.cos(k.yaw); L0.sz -= st.x * 6 * dt * Math.sin(k.yaw);
  const ls = Math.hypot(L0.sx, L0.sz), lmax = PISTE_B / 2 - 4; if(ls > lmax){ L0.sx *= lmax / ls; L0.sz *= lmax / ls; }
  const hoehe = Math.max(1, p.y - bodenY(lx, lz));
  const sink = fin.schritt === 'fall' ? Math.max(15, -k.v.y) : 7;
  const rest = fin.schritt === 'fall' ? (Math.max(0, hoehe - SCHIRM_AUF) / sink + SCHIRM_AUF / 7) : hoehe / sink;
  const ex = lx - p.x, ez = lz - p.z, ed = Math.hypot(ex, ez);
  const vSoll = Math.min(fin.schritt === 'fall' ? 30 : 16, ed / Math.max(1, rest));
  const zx = ed > 0.5 ? ex / ed * vSoll : 0, zz = ed > 0.5 ? ez / ed * vSoll : 0;
  if(fin.schritt === 'fall'){
    k.yaw -= st.x * 1.3 * dt;
    const a = Math.min(1, dt * 0.8);
    k.v.x += (zx - k.v.x) * a; k.v.z += (zz - k.v.z) * a;
    k.v.y = Math.max(-55, k.v.y - 9.81 * dt);
    freiflugSchritt(dt);
    if(p.y - 0.8 - bodenY(p.x, p.z) < SCHIRM_AUF) schirmAuf();
    state.vel.copy(k.v); fahrtwind(dt);
  } else if(fin.schritt === 'schirm'){
    // Blick in Flugrichtung (zum Landepunkt), der Stick dreht etwas mit
    if(ed > 2){ let dy = Math.atan2(-ex, -ez) - k.yaw; while(dy > Math.PI) dy -= 2 * Math.PI; while(dy < -Math.PI) dy += 2 * Math.PI; k.yaw += dy * Math.min(1, dt * 1.2); }
    const a = Math.min(1, dt * 1.5);
    k.v.x += (zx - k.v.x) * a; k.v.z += (zz - k.v.z) * a;
    k.v.y += (-7 - k.v.y) * a;
    k.g.rotation.set(0, k.yaw, Math.sin(k.t * 1.3) * 0.06, 'YXZ');
  }
  if(fin.schritt === 'fall' || fin.schritt === 'schirm'){
    p.addScaledVector(k.v, dt);
    if(fin.schritt === 'schirm' && p.y - bodenY(lx, lz) < 25){ const f = Math.min(1, dt * 3); p.x += (lx - p.x) * f; p.z += (lz - p.z) * f; }
    const gy = bodenY(p.x, p.z);
    if(p.y <= gy){ p.y = gy; gelandet(p); }
  }
  if(fin.schritt === 'fall') freiflugPose(k.g, k.m, k.yaw);
  state.pos.copy(p); state.vel.copy(k.v); state.onGround = false; state.throttle = 0;
}
function gelandet(p){
  const k = fin.k; fin.schritt = 'gelandet'; k.v.set(0, 0, 0);
  while(k.g.children.length > 1) k.g.remove(k.g.children[k.g.children.length - 1]);   // Schirm ab (Kenji ist das erste Kind)
  k.g.rotation.set(0, k.yaw, 0, 'YXZ'); kAnim('land', true);
  const kl = story.kenji && story.kenji.acts.land; story.spaeter(kl ? kl.getClip().duration : 0.5, () => { if(fin.k === k && fin.schritt === 'gelandet') kAnim('idle'); });
  story.hinweis(''); story.ziel = null;
  if(aufPiste(p.x, p.z)){                                // Live-Wunsch: ohne Ansage gleich aufs Snowboard, es geht sofort los
    brettUnter(k.g);
    if(story.finaleAbfahrt){ story.finaleAbfahrt(k); return; }
    return;
  }
  const wasser = fujiMeshY(p.x, p.z) < 1 && !isOnLand(p.x, p.z);
  story.sprich([wasser ? 'Platsch! Das war das Meer, nicht die Piste. Noch einmal!' : 'Knapp daneben – das war nicht die Piste. Noch einmal!'],
    () => zurueck('Noch ein Versuch!'));
}

// Snowboard unter Kenjis Fuesse (snowboard_glb.js, 1,45 m, Laenge entlang Z); quer wie beim Snowboarden
let brettVorlage = null;
function ladeBrett(){
  if(brettVorlage !== null || !window.SNOWBOARD_GLB || !THREE.GLTFLoader) return; brettVorlage = false;
  const b = atob(window.SNOWBOARD_GLB.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (g) => { brettVorlage = g.scene; }, (e) => { console.warn('Snowboard-GLB', e); brettVorlage = null; });
}
story.finaleBrett = () => brettVorlage || null;
// Kenji auf dem Brett (Live-Befund 13.10.2026): in 'idle' steht der linke Fuss vor dem rechten. Die Figur bleibt deshalb in
// Fahrtrichtung (linker Fuss vorne auf dem Brett), nur Becken und Oberkoerper drehen 90° nach rechts zur Seite, der Kopf
// schaut zurueck in Fahrtrichtung – die typische Snowboard-Haltung. Die Drehung kommt nach dem Mixer auf die Knochen (haltungKnochen).
const BRETT_DREH = { mixamorigSpine: 0.35, mixamorigSpine1: 0.3, mixamorigSpine2: 0.25, mixamorigNeck: 0.25, mixamorigHead: 0.25 };   // Three.js nimmt den ':' aus den Namen
function brettUnter(g){
  if(!brettVorlage) return;
  const b = brettVorlage.clone(true); b.position.y = 0;
  g.add(b); g.userData.brett = b;
  if(g.children[0] && g.children[0] !== b) g.children[0].position.y = 0.045;   // Kenji steht auf der Brettoberseite
}
const _qk = new THREE.Quaternion(), _ya = new THREE.Vector3(0, 1, 0);
let knochen = null;
function haltungKnochen(){
  const k = story.kenji; if(!k || !k.obj || !fin.k || !fin.k.g.userData.brett) return;
  if(!knochen){ knochen = []; k.obj.traverse(o => { if(BRETT_DREH[o.name] !== undefined) knochen.push([o, BRETT_DREH[o.name]]); }); }
  for(const [o, w] of knochen){
    const u = o.userData;
    if(!u.qSet || !o.quaternion.equals(u.qSet)) u.qBase = (u.qBase || new THREE.Quaternion()).copy(o.quaternion);   // Mixer hat neu geschrieben
    o.quaternion.copy(u.qBase).multiply(_qk.setFromAxisAngle(_ya, w));
    u.qSet = (u.qSet || new THREE.Quaternion()).copy(o.quaternion);
  }
}

// ---- Nadelwald unterhalb der Baumgrenze (Live-Wunsch 13.10.2026: ab ~1500 m links und rechts der Piste) -----------------
const BAUMGRENZE = 1500;
function baueWald(){
  const P = fin.piste.pts;
  let sd = 1500; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const kr = [0x2f5e2a, 0x3b6e30, 0x264f24].map(c => new THREE.MeshLambertMaterial({ color: c, fog: false }));
  const stamm = new THREE.MeshLambertMaterial({ color: 0x5a3e26, fog: false });
  const kegelG = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), stammG = new THREE.CylinderGeometry(0.18, 0.24, 1, 5).translate(0, 0.5, 0);
  const N = 2400, inst = kr.map(m => new THREE.InstancedMesh(kegelG, m, N)), st = new THREE.InstancedMesh(stammG, stamm, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const n = [0, 0, 0]; let ns = 0;
  for(let i = 1; i < P.length && ns < N; i++){
    const p = P[i], a = P[i - 1]; if(p.y > BAUMGRENZE + 40) continue;
    const l = Math.hypot(p.x - a.x, p.z - a.z) || 1, tx = (p.x - a.x) / l, tz = (p.z - a.z) / l;
    for(const seite of [-1, 1]) for(let j = 0; j < 2 && ns < N; j++){   // 2 je Punkt und Seite (Piste hat 640 Punkte)
      const off = PISTE_B / 2 + 4 + Math.pow(rnd(), 1.5) * 80, along = (rnd() - 0.5) * l;
      const x = p.x - tz * seite * off + tx * along, z = p.z + tx * seite * off + tz * along;
      const y = fujiMeshY(x, z); if(!(y > 4)) continue;
      const dicht = (BAUMGRENZE - y) / 90; if(rnd() > dicht) continue;   // ueber 1500 m keine, darunter schnell dicht
      if(pisteAbstand(x, z) < PISTE_B / 2 + 3) continue;                  // nicht auf die Piste (Kehren)
      const h = (7 + rnd() * 9) * Math.min(1, 0.5 + Math.max(0, dicht) * 0.5), k = Math.floor(rnd() * 3);
      q.setFromAxisAngle(Y, rnd() * 6.28);
      sc.set(h * 0.27, h * 0.85, h * 0.27); ps.set(x, y - 0.4 + h * 0.15, z); m4.compose(ps, q, sc); inst[k].setMatrixAt(n[k]++, m4);
      sc.set(1, h * 0.22, 1); ps.set(x, y - 0.6, z); m4.compose(ps, q, sc); st.setMatrixAt(ns++, m4);
    }
  }
  const w = story.welt(6);
  inst.forEach((m, k) => { m.count = n[k]; m.frustumCulled = false; w.add(m); }); st.count = ns; st.frustumCulled = false; w.add(st);
  fin.wald = ns;
}

// ---- Snowboard-Abfahrt (Live-Wunsch 13.10.2026) -------------------------------------------------------------------------
// Kein Gas: der Hang beschleunigt bis 50 km/h. L-Stick = links/rechts auf der Piste, B = springen (Hoehe/Weite nach Tempo),
// LT/RT in der Luft = Drehung 180, 360 …, R-Stick vor/zurueck = Front-/Backflip (Live-Wunsch 13.10.2026). Felsen und Rail-Anfang:
// anstossen = abbremsen, weiterfahren. Unsauber gelandet = abbremsen. Kleine Rampen springen weit, eine Rail zum Grinden
// (von oben draufspringen), am Ende die Mega-Rampe weit aufs Meer – beim Aufkommen wird das Snowboard zum Surfbrett.
// Gefahren wird in Pisten-Koordinaten: s = Strecke entlang der Mittellinie, q = quer dazu (rechts positiv).
const AB_VMAX = 50 / 3.6, AB_RAND = PISTE_B / 2 - 2.5, RAIL_H = 0.8, RAIL_L = 26;
const ab = { s: 0, q: 0, qv: 0, v: 0, y: 0, vy: 0, luft: false, spin: 0, spin0: 0, flip: 0, luftT: 0, grind: null, rampe: null,
  i: 0, hinder: [], g: null, stolper: 0, tricks: [], mega: null, surfT: 0, ende: false, hid: 0 };
story.finaleAb = ab;
function pisteMass(){
  const P = fin.piste.pts; if(P[0].S !== undefined) return;
  let S = 0; P.forEach((p, i) => { if(i) S += Math.hypot(p.x - P[i - 1].x, p.z - P[i - 1].z); p.S = S; });
  for(let i = 0; i < P.length; i++){ const j = Math.min(i, P.length - 2), a = P[j], b = P[j + 1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; P[i].tx = (b.x - a.x) / l; P[i].tz = (b.z - a.z) / l; }
  fin.piste.S = S;
}
const _ort = { x: 0, z: 0, tx: 0, tz: -1 };
function ort(s, q){
  const P = fin.piste.pts, n = P.length - 1;
  while(ab.i < n - 1 && P[ab.i + 1].S <= s) ab.i++;
  while(ab.i > 0 && P[ab.i].S > s) ab.i--;
  const a = P[ab.i], b = P[ab.i + 1], f = Math.max(0, Math.min(1, (s - a.S) / ((b.S - a.S) || 1)));
  const tx = a.tx + (b.tx - a.tx) * f, tz = a.tz + (b.tz - a.tz) * f, tl = Math.hypot(tx, tz) || 1;
  _ort.tx = tx / tl; _ort.tz = tz / tl;
  _ort.x = a.x + (b.x - a.x) * f - _ort.tz * q; _ort.z = a.z + (b.z - a.z) * f + _ort.tx * q;   // quer = (-tz, tx) = rechts
  return _ort;
}
function grundAb(x, z){ const s = pisteYschnell(x, z); if(s !== null) return s; const y = pisteY(x, z), b = fujiMeshY(x, z) + 2.5; return y > -1e8 ? Math.max(y, b) : Math.max(b, 0); }   // nie unter dem Berg
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1), _X = new THREE.Vector3(1, 0, 0);
const _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _pv = new THREE.Vector3();
// Keil (Rampe): Laenge entlang +X (Fahrtrichtung), hinten H hoch, W breit
function keil(L, H, W){
  const a = [0, 0, -W / 2], b = [L, 0, -W / 2], c = [L, 0, W / 2], d = [0, 0, W / 2], e = [L, H, -W / 2], f = [L, H, W / 2];
  const tri = [a, e, f, a, f, d, b, c, f, b, f, e, a, b, e, d, f, c, a, d, c, a, c, b];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat(), 3)); g.computeVertexNormals();
  return g;
}
// Kicker als Flaeche ueber der Piste: Raster entlang (s, q), jeder Punkt = Schnee + Hoehe (0 vorne -> H an der Kante). Dazu die
// senkrechte Kante hinten und die Seitenwangen. Die Fahrhoehe auf dem Kicker (abfahrtSchritt) rechnet mit derselben Formel.
function kickerGeo(s0, q, L, H, W){
  const o0 = ort(s0, q), bx = o0.x, bz = o0.z, tx = o0.tx, tz = o0.tz;            // feste Richtung: gerader Keil
  const NL = 8, NW = 2, pos = [], idx = [], P = (u, w, y) => { const x = bx + tx * u - tz * w, z = bz + tz * u + tx * w; pos.push(x, grundAb(x, z) + y, z); return pos.length / 3 - 1; };
  const top = [];
  for(let i = 0; i <= NL; i++){ top.push([]); for(let j = 0; j <= NW; j++){ const u = L * i / NL, w = -W / 2 + W * j / NW; top[i].push(P(u, w, H * i / NL)); } }
  for(let i = 0; i < NL; i++) for(let j = 0; j < NW; j++){ const a = top[i][j], b = top[i + 1][j], c = top[i + 1][j + 1], d = top[i][j + 1]; idx.push(a, b, c, a, c, d); }
  const k0 = P(L, -W / 2, 0), k1 = P(L, W / 2, 0); idx.push(top[NL][0], k0, k1, top[NL][0], k1, top[NL][NW]);   // Kante hinten
  for(const [j, w] of [[0, -W / 2], [NW, W / 2]]){ let alt = P(0, w, 0);                                     // Seitenwangen
    for(let i = 1; i <= NL; i++){ const unten = P(L * i / NL, w, 0); idx.push(alt, unten, top[i][j], alt, top[i][j], top[i - 1][j]); alt = unten; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Objekt an (s, q) auf die Piste legen: +X in Fahrtrichtung, um das Gefaelle auf L Meter geneigt
function aufPisteLegen(m, s, q, L){
  const o = ort(s, q), x0 = o.x, z0 = o.z, h = Math.atan2(-o.tx, -o.tz), y0 = grundAb(x0, z0);
  const o2 = ort(s + L, q), y1 = grundAb(o2.x, o2.z);
  m.position.set(x0, y0 - 0.05, z0);
  m.quaternion.setFromAxisAngle(_Y, h + Math.PI / 2).multiply(_qb.setFromAxisAngle(_Z, -Math.atan2(y0 - y1, L)));
}
// Effekte auf dem Brett (Live-Wunsch): weicher Schatten unter dem Brett, zwei Kantenspuren im Schnee, Staubwolke bei der Landung,
// Fahrtwind-Striche je nach Tempo. Alles in einer Gruppe, die beim Aufraeumen mit verschwindet.
let fx = null;
function fxBauen(){
  if(fx) return fx;
  const g = new THREE.Group(); scene.add(g);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
  const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  const schatten = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
  schatten.renderOrder = 2; g.add(schatten);
  // Spuren: Ringpuffer aus Strichen (je Kante einer pro 0,6 m), verblassen ueber 6 s
  const SP = 220, spurPos = new Float32Array(SP * 2 * 2 * 3), spurGeo = new THREE.BufferGeometry();
  spurGeo.setAttribute('position', new THREE.BufferAttribute(spurPos, 3));
  const spur = new THREE.LineSegments(spurGeo, new THREE.LineBasicMaterial({ color: 0xa9bfd6, transparent: true, opacity: 0.8, fog: false }));
  spur.frustumCulled = false; g.add(spur);
  // Staub: kleine Kugeln, die auseinanderfliegen und schrumpfen
  const staubM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false }), staub = [];
  // Wind: duenne helle Striche vor/neben der Kamera, ziehen nach hinten
  const WN = 40, windPos = new Float32Array(WN * 2 * 3), windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute('position', new THREE.BufferAttribute(windPos, 3));
  const wind = new THREE.LineSegments(windGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false }));
  wind.frustumCulled = false; g.add(wind);
  const windT = []; for(let i = 0; i < WN; i++) windT.push({ x: 0, y: 0, z: 0, life: 0 });
  fx = { g, schatten, spur, spurPos, spurN: 0, spurLetzt: null, staub, staubM, wind, windPos, windT,
    puff(p, k){ for(let i = 0; i < 10 * k; i++){ let s = staub.find(x => !x.m.visible); if(!s){ if(staub.length > 40) return; s = { m: new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), staubM), v: new THREE.Vector3() }; g.add(s.m); staub.push(s); }
      const a = Math.random() * 6.28; s.m.visible = true; s.t = 0; s.m.position.set(p.x, p.y + 0.1, p.z); s.v.set(Math.cos(a) * (2 + Math.random() * 3), 1 + Math.random() * 2, Math.sin(a) * (2 + Math.random() * 3)); } } };
  return fx;
}
function fxWeg(){ if(!fx) return; scene.remove(fx.g); fx.g.traverse(o => { if(o.geometry) o.geometry.dispose(); }); fx = null; }
function fxSchritt(dt, o, amBoden){
  const f = fxBauen(), p = state.pos; f.schatten.visible = true; f.spur.visible = true;
  // Schatten: auf dem Schnee unter Kenji, im Sprung kleiner und heller
  const boden = grundAb(p.x, p.z), hoehe = Math.max(0, p.y - boden), k = 1 / (1 + hoehe * 0.15);
  // Hangebene aus vier Punkten um Kenji (1 m vor/hinter, links/rechts) -> Normale; Schatten liegt darin, 8 cm ueber dem Schnee
  const rx = -o.tz, rz = o.tx;
  const yv = grundAb(p.x + o.tx, p.z + o.tz), yh = grundAb(p.x - o.tx, p.z - o.tz), yr = grundAb(p.x + rx, p.z + rz), yl = grundAb(p.x - rx, p.z - rz);
  const ax = new THREE.Vector3(2 * o.tx, yv - yh, 2 * o.tz), az = new THREE.Vector3(2 * rx, yr - yl, 2 * rz), nrm = new THREE.Vector3().crossVectors(az, ax).normalize();
  if(nrm.y < 0) nrm.negate();
  f.schatten.position.set(p.x, boden + 0.08, p.z);
  // Ebene: lokale Z-Achse des Schattens = Normale, lokale Y-Achse (lange Seite) = Fahrtrichtung in der Ebene
  const lang = ax.clone().normalize(), quer = new THREE.Vector3().crossVectors(lang, nrm).normalize();
  f.schatten.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(quer, lang, nrm));
  f.schatten.scale.set(0.9 * k + 0.25, 1.9 * k + 0.35, 1); f.schatten.material.opacity = Math.max(0.15, k);
  // Spuren: am Boden alle 0,6 m ein Strich je Kante
  if(amBoden){
    const qx = -o.tz * 0.13, qz = o.tx * 0.13, kurve = ab.qv;     // > 0 = nach rechts gelenkt
    const L = [p.x - qx, p.z - qz], R = [p.x + qx, p.z + qz];
    const jetzt = [L[0], L[1], R[0], R[1]];
    const l = f.spurLetzt;
    if(!l || Math.hypot(p.x - l[4], p.z - l[5]) > 0.6){
      if(l){ const P = f.spurPos, i = (f.spurN % 220) * 12, yl = grundAb(L[0], L[1]) + 0.05, yr = grundAb(R[0], R[1]) + 0.05;
        // in der Kurve zeichnet nur die Innenkante (die greift), geradeaus beide; die andere wird unsichtbar (Laenge 0)
        const links = kurve < 2, rechts = kurve > -2;
        P.set(links ? [l[0], l[6], l[1], jetzt[0], yl, jetzt[1]] : [l[0], -1e4, l[1], l[0], -1e4, l[1]], i);
        P.set(rechts ? [l[2], l[7], l[3], jetzt[2], yr, jetzt[3]] : [l[2], -1e4, l[3], l[2], -1e4, l[3]], i + 6);
        f.spurN++; f.spur.geometry.attributes.position.needsUpdate = true; f.spur.geometry.setDrawRange(0, Math.min(f.spurN, 220) * 4); }
      f.spurLetzt = [...jetzt, p.x, p.z, grundAb(L[0], L[1]) + 0.05, grundAb(R[0], R[1]) + 0.05];
    }
  } else f.spurLetzt = null;
  // Staub
  for(const s of f.staub) if(s.m.visible){ s.t += dt; s.v.y -= 6 * dt; s.m.position.addScaledVector(s.v, dt); s.m.scale.setScalar(Math.max(0.05, 1 - s.t * 1.6)); if(s.t > 0.6) s.m.visible = false; }
  fahrtwind(dt);
}
const _wd = new THREE.Vector3(), _wa = new THREE.Vector3(), _wb = new THREE.Vector3(), _wu = new THREE.Vector3(0, 1, 0);
function fahrtwind(dt){
  const f = fxBauen(), v = state.vel.length(), st = Math.max(0, Math.min(1, (v - 5) / 15));
  f.wind.material.opacity = 0.55 * st;
  if(v < 0.5) return;
  _wd.copy(state.vel).multiplyScalar(1 / v);                                     // Bewegungsrichtung
  _wa.crossVectors(_wd, Math.abs(_wd.y) > 0.9 ? _X : _wu).normalize(); _wb.crossVectors(_wd, _wa).normalize();   // quer dazu
  const c = camera.position;
  f.windT.forEach((w, i) => {
    w.life -= dt;
    if(w.life <= 0){ w.life = 0.25 + Math.random() * 0.3;
      const vor = 8 + Math.random() * 14, a = Math.random() * 6.28, r = 3 + Math.random() * 4;   // Ring um die Achse (Mitte frei)
      const qa = Math.cos(a) * r, qb = Math.sin(a) * r * 0.7;
      w.x = c.x + _wd.x * vor + _wa.x * qa + _wb.x * qb; w.y = c.y + _wd.y * vor + _wa.y * qa + _wb.y * qb; w.z = c.z + _wd.z * vor + _wa.z * qa + _wb.z * qb; }
    const k = v * 1.2 * dt; w.x -= _wd.x * k; w.y -= _wd.y * k; w.z -= _wd.z * k;    // relativ zur Kamera: auf sie zu
    w.x += state.vel.x * dt; w.y += state.vel.y * dt; w.z += state.vel.z * dt;     // die Kamera faehrt mit
    const len = 0.8 + v * 0.06;
    f.windPos.set([w.x, w.y, w.z, w.x + _wd.x * len, w.y + _wd.y * len, w.z + _wd.z * len], i * 6);
  });
  f.wind.geometry.attributes.position.needsUpdate = true;
}
// Schneespray hinter dem Brett: kleine weisse Flocken, die zur Seite und nach hinten wegfliegen (Tempo-Gefuehl)
const spray = { teile: [], mat: null, t: 0 };
function schneeSpray(dt, o){
  if(!ab.g) return;
  if(!spray.mat) spray.mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
  spray.t -= dt;
  if(!ab.luft && !ab.grind && spray.t <= 0 && ab.v > 4){
    spray.t = 0.03;
    let s = spray.teile.find(p => !p.m.visible);
    if(!s){ if(spray.teile.length > 60) return; s = { m: new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), spray.mat), v: new THREE.Vector3() }; ab.g.add(s.m); spray.teile.push(s); }
    const seite = (Math.random() < 0.5 ? -1 : 1) + ab.qv * 0.1;
    s.m.visible = true; s.t = 0; s.m.position.set(o.x - o.tx * 0.8, ab.y + 0.1, o.z - o.tz * 0.8);
    s.v.set(-o.tx * ab.v * 0.25 - o.tz * seite * 2.5, 1.5 + Math.random() * 2, -o.tz * ab.v * 0.25 + o.tx * seite * 2.5);
  }
  for(const p of spray.teile) if(p.m.visible){ p.t += dt; p.v.y -= 9.81 * dt; p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(Math.max(0.1, 1 - p.t * 1.5)); if(p.t > 0.6) p.m.visible = false; }
}
function kurvig(s, L){ const a = ort(s, 0), ax = a.tx, az = a.tz, b = ort(s + L, 0); return Math.acos(Math.max(-1, Math.min(1, ax * b.tx + az * b.tz))); }
function abWeg(){
  spray.teile.length = 0;
  if(ab.g){ if(story.entsorgen) story.entsorgen(ab.g); else if(ab.g.parent) ab.g.parent.remove(ab.g); }
  ab.g = null; ab.hinder = [];
}
function baueHindernisse(s0){
  ab.bauen = true; try { baueHindernisse2(s0); } finally { ab.bauen = false; }
}
function baueHindernisse2(s0){
  abWeg();
  const g = new THREE.Group(); story.welt(6).add(g); ab.g = g;
  let sd = 4242; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const SE = fin.piste.S, fels = new THREE.MeshLambertMaterial({ color: 0x6b6460, fog: false });
  const schnee = new THREE.MeshLambertMaterial({ color: 0x8fb6e0, side: THREE.DoubleSide, fog: false });   // Rampen: kraeftiges Eisblau (hebt sich vom Schnee ab)
  const metall = new THREE.MeshLambertMaterial({ color: 0xa8b2bc, fog: false }), orange = new THREE.MeshLambertMaterial({ color: 0xff7a1a, fog: false });
  const neu = (typ, s, q) => {
    const h = { typ, s, q, weg: false };
    if(typ === 'fels'){
      h.r = 0.8 + rnd() * 0.5; h.h = h.r * 1.05;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(h.r, 0), fels); m.scale.set(1.1, 0.75, 1); m.rotation.y = rnd() * 6;
      const o = ort(s, q); m.position.set(o.x, grundAb(o.x, o.z) + h.r * 0.3, o.z); g.add(m);
    } else if(typ === 'rampe' || typ === 'mega'){
      const mega = typ === 'mega'; h.L = mega ? 32 : 9; h.H = mega ? 11 : 2.2; h.W = mega ? PISTE_B - 4 : 9;
      const kg = kickerGeo(s - h.L, q, h.L, h.H, h.W), m = new THREE.Mesh(kg, schnee); g.add(m);
      g.add(new THREE.LineSegments(new THREE.EdgesGeometry(kg, 20), new THREE.LineBasicMaterial({ color: 0x000000, fog: false })));   // Live-Wunsch: Rampen erkennbar
      if(mega) for(const sx of [-1, 1]){
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 6).translate(0, 3, 0), orange);
        const o = ort(s, q + sx * (h.W / 2 + 1)); st.position.set(o.x, grundAb(o.x, o.z) + h.H, o.z); g.add(st);
      }
    } else if(typ === 'rail'){
      const pts = [];
      for(let u = 0; u <= RAIL_L; u += 2){
        const o = ort(s + u, q), y = grundAb(o.x, o.z); pts.push(new THREE.Vector3(o.x, y + RAIL_H, o.z));
        if(u % 6 === 0){ const pf = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, RAIL_H, 5).translate(0, RAIL_H / 2, 0), metall); pf.position.set(o.x, y, o.z); g.add(pf); }
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.07, 6, false), metall));
    }
    ab.hinder.push(h);
  };
  // alle 75-130 m etwas: meist Felsen (einzeln oder zu zweit mit Luecke), jede vierte Stelle eine kleine Rampe, einmal die Rail
  // Rail-Kombinationen (Live-Wunsch): Rail – 9 m Luecke – Rail (am Ende abspringen, auf der naechsten landen) und zwei
  // Rails nebeneinander (seitlich hinueberspringen). Dort wird sonst nichts gebaut.
  const kombi = [{ s: s0 + (SE - s0) * 0.3, L: 2 * RAIL_L + 9 }, { s: s0 + (SE - s0) * 0.62, L: RAIL_L + 6 }];
  neu('rail', kombi[0].s, -4); neu('rail', kombi[0].s + RAIL_L + 9, -4);
  neu('rail', kombi[1].s, -2.5); neu('rail', kombi[1].s + 6, 2.5);
  const frei = s => kombi.every(k => s < k.s - 45 || s > k.s + k.L + 30);
  let nr = 0, letzteRail = -1e9, nachRail = false;
  for(let s = s0 + 70; s < SE - 140; s += 55 + rnd() * 35){
    if(!frei(s)) continue;
    nr++; const w = rnd();
    if(w < 0.15 && s - letzteRail > 250){ neu('rail', s, (rnd() - 0.5) * 16); letzteRail = s; s += RAIL_L; nachRail = true; continue; }
    if((w < 0.55 || nachRail) && kurvig(s - 12, 40) < 0.35){                       // keine Kicker in engen Kehren (> 20° auf 40 m)
      nachRail = false; const qk = (rnd() - 0.5) * (PISTE_B - 20); neu('rampe', s, qk);
      if(rnd() < 0.35 && s - letzteRail > 120){ neu('rail', s + 24, qk); letzteRail = s + 24; s += 24 + RAIL_L; continue; }   // Kicker -> Rail (Landung drauf)
      if(rnd() < 0.3) neu('fels', s - 4, qk + (qk > 0 ? -1 : 1) * (12 + rnd() * 4));   // daneben ein Fels: links oder rechts
      continue;
    }
    const q1 = (rnd() - 0.5) * (PISTE_B - 10); neu('fels', s, q1);
    if(rnd() < 0.4) neu('fels', s + (rnd() - 0.5) * 6, q1 + (q1 > 0 ? -1 : 1) * (9 + rnd() * 8));
  }
  neu('mega', fin.piste.megaS || SE - 4, 0);
}
let surfVorlage = null;
function ladeSurf(){
  if(surfVorlage !== null || !window.SURF_GLB || !THREE.GLTFLoader) return; surfVorlage = false;
  const b = atob(window.SURF_GLB.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (g) => { surfVorlage = g.scene; }, (e) => { console.warn('Surfbrett-GLB', e); surfVorlage = null; });
}
function abfahrtStart(k){
  pisteMass(); ladeSurf();
  const P = fin.piste.pts, p = k.g.position;
  let bi = 0, bd = 1e9; P.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.z - p.z); if(d < bd){ bd = d; bi = i; } });
  bi = Math.min(bi, P.length - 2);
  const a = P[bi], dx = p.x - a.x, dz = p.z - a.z;
  Object.assign(ab, { s: a.S + dx * a.tx + dz * a.tz, q: Math.max(-AB_RAND, Math.min(AB_RAND, -dx * a.tz + dz * a.tx)), qv: 0, v: 2, vy: 0,
    luft: false, spin: 0, spin0: 0, flip: 0, luftT: 0, extra: false, weit: 1, grind: null, rampe: null, i: bi, stolper: 0, tricks: ab.tricks || [], mega: null, surfT: 0, ende: false });
  baueHindernisse(ab.s);
  const o = ort(ab.s, ab.q); ab.y = grundAb(o.x, o.z);
  figurZurueck(); fin.kal = false; ab.kalT = 0; fin.camY = undefined;
  fin.schritt = 'abfahrt';
  if(story.hudSichtbar) story.hudSichtbar(false);        // Live-Wunsch: auf dem Brett kein HUD
  haltung();
  story.hinweis('');
}
story.finaleAbfahrt = abfahrtStart;
let zeigeErlaubt = false;
const hinweisOrig = story.hinweis;
story.hinweis = function(text){ if(text && fin.aktiv && fin.k && !zeigeErlaubt) return; return hinweisOrig.apply(this, arguments); };
function zeige(t, sek){ const id = ++ab.hid; zeigeErlaubt = true; story.hinweis(t); zeigeErlaubt = false; story.spaeter(sek || 2, () => { if(ab.hid === id) story.hinweis(''); }); }
// Trick-Eingaben (Live-Wunsch): x = Drehung/Rolle aus LT/RT (RT rechtsherum, Tastatur Q/E), y = Flip/Abtauchen vom rechten Stick
// (vor = Kopf runter, Tastatur I/K)
function rStick(){
  let x = (keys['KeyE'] ? 1 : 0) - (keys['KeyQ'] ? 1 : 0), y = (keys['KeyK'] ? 1 : 0) - (keys['KeyI'] ? 1 : 0);
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(gp){
    const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0;
    if(Math.abs(rt - lt) > 0.1) x = rt - lt;
    const ay = gp.axes[3] || 0; if(Math.abs(ay) > 0.25) y = ay;
  }
  return { x, y };
}
function trickName(){
  const deg = Math.round(Math.abs(ab.spin - ab.spin0) / Math.PI) * 180, nf = Math.round(ab.flip / (2 * Math.PI)), t = [];
  if(deg >= 180) t.push(String(deg));
  if(nf){ const n = Math.abs(nf); t.push((n === 2 ? 'Doppel-' : n >= 3 ? n + 'fach-' : '') + (nf > 0 ? 'Backflip' : 'Frontflip')); }
  return t.join(' ');
}
function anstossen(text){
  ab.v = Math.min(ab.v, 2.5); ab.stolper = 0.8; ab.qv = 0; ab.spin = Math.round(ab.spin / (2 * Math.PI)) * 2 * Math.PI; ab.flip = 0;   // wieder vorwaerts
  if(typeof rumble === 'function') rumble(260, 0.7, 0.5);
  zeige(text, 2);
}
// Landen: sauber = Drehung auf 180°-Schritte und Flip auf ganze Umdrehungen (mit Spielraum), sonst abbremsen
function landen(){
  const sr = ab.spin - Math.round(ab.spin / Math.PI) * Math.PI, fr = ab.flip - Math.round(ab.flip / (2 * Math.PI)) * 2 * Math.PI;
  ab.luft = false; ab.vy = 0;
  if(Math.abs(sr) > 0.87 || Math.abs(fr) > 1.05){ anstossen('Uff – unsauber gelandet!'); return false; }   // Toleranz +-50° / +-60°
  const name = ab.kante && Math.abs(ab.spin - ab.spin0) < 1 && Math.abs(ab.flip) < 1 ? '' : trickName(); ab.kante = false;
  ab.spin = Math.round(ab.spin / Math.PI) * Math.PI; ab.flip = 0;
  if(name) trick(name);
  if(fx) fx.puff(state.pos, 1);                              // Schneestaub bei der Landung
  return true;
}
// Grind beendet: einmal pro Rail zaehlen (ab 3 m Grind), auch wenn man auf derselben Rail wieder landet
function grindEnde(){
  const r = ab.grind; ab.grind = null; if(!r) return;
  const weg = ab.s - (ab.grindS0 === undefined ? ab.s : ab.grindS0);
  if(weg >= 3 && !r.gezaehlt){ r.gezaehlt = true; trick('Rail-Grind'); }
}
function springen(){
  if(fin.schritt !== 'abfahrt') return;
  if(ab.grind){ grindEnde(); ab.luft = true; ab.vy = 5.5 + ab.v * 0.12; ab.hh = RAIL_H; ab.luftT = 0; ab.spin0 = ab.spin; ab.flip = 0; return; }   // von der Rail: genauso hoch wie am Boden, ab Railhoehe
  if(ab.luft || ab.stolper > 0) return;
  if(ab.rampe){ ab.extra = true; return; }   // auf dem Kicker: an der Kante extra hoch und weit
  ab.kante = false; ab.luft = true; ab.luftT = 0; ab.spin0 = ab.spin; ab.flip = 0; ab.hh = 0; ab.vy = 5.5 + ab.v * 0.12;   // bei 50 km/h ~1,9 m hoch, ~1 s
}
function abheben(h){
  ab.kante = false; ab.luft = true; ab.luftT = 0; ab.spin0 = ab.spin; ab.flip = 0;
  if(h.typ === 'mega'){ megaStart(); return; }
  const o = ort(ab.s, ab.q), extra = ab.extra; ab.extra = false; ab.rampe = null;
  ab.hh = ab.y - grundAb(o.x, o.z);                                                    // Hoehe ueber der Piste (Kante = Kickerhoehe)
  ab.vy = extra ? 12 + ab.v * 0.45 : 8 + ab.v * 0.35;                                // ohne B ~8 m, mit B ~13 m ueber dem Hang
  ab.weit = extra ? 1.35 : 1.15;                                                       // in der Luft schneller voraus (weiter)

}
const BRETT_HALB = 0.72;                                  // halbe Brettlaenge (Snowboard 1,45 m)
function pose(x, y, z, tx, tz, extraYaw, neig, amBoden){
  const k = fin.k, h = Math.atan2(-tx, -tz); k.yaw = h;
  if(amBoden){                                            // Neigung und Hoehe aus der Oberflaeche unter Spitze und Ende
    const yv = grundAb(x + tx * BRETT_HALB, z + tz * BRETT_HALB), yh = grundAb(x - tx * BRETT_HALB, z - tz * BRETT_HALB);
    neig = Math.atan2(yh - yv, 2 * BRETT_HALB);
    const qx = -tz * 0.15, qz = tx * 0.15, ym = (yv + yh) / 2;   // Kanten 15 cm links/rechts
    const ueber = Math.max(0, grundAb(x, z) - ym, grundAb(x + qx, z + qz) - ym, grundAb(x - qx, z - qz) - ym);
    y = Math.max(y, ym + ueber);
  }
  const wack = ab.stolper > 0 ? Math.sin(k.t * 28) * 0.18 * ab.stolper : 0;
  // Gefaelle (neig, rad, Nase nach unten), Backflip = Nase hoch ueber die Querachse X, Kurvenlage um die Laengsachse Z
  k.g.quaternion.setFromAxisAngle(_Y, h + ab.spin + (extraYaw || 0) + wack)
    .multiply(_qb.setFromAxisAngle(_X, -(neig || 0) + ab.flip)).multiply(_qc.setFromAxisAngle(_Z, -ab.qv * 0.03));
  // Drehpunkt: am Boden die Brettmitte unten (liegt satt auf), in der Luft die Koerpermitte (Tricks drehen um den Bauch)
  const mitte = amBoden ? 0 : 0.8;
  _pv.set(0, mitte, 0).applyQuaternion(k.g.quaternion);
  k.g.position.set(x - _pv.x, y + 0.03 + mitte - _pv.y, z - _pv.z);
  haltung();
  state.pos.set(x, y, z); state.onGround = !ab.luft; state.throttle = 0;
}
function abfahrtSchritt(dt){
  const k = fin.k; if(!k) return;
  k.t += dt; ab.kalT = (ab.kalT || 0) + dt;
  if(ab.mega && ab.mega.brett){ const B = ab.mega.brett; B.v.y -= 9.81 * dt; B.b.position.addScaledVector(B.v, dt); B.b.rotation.x += B.w.x * dt; B.b.rotation.y += B.w.y * dt; B.b.rotation.z += B.w.z * dt;
    if(B.b.position.y < -5){ scene.remove(B.b); ab.mega.brett = null; } }
  if(fin.schritt === 'mega'){ megaSchritt(dt); return; }
  if(fin.schritt === 'surf'){ surfSchritt(dt); return; }
  const st = stick(), rs = rStick(), P = fin.piste.pts;
  if(!ab.luft && !ab.grind){                                   // Tempo nur aus dem Hang, hoechstens 50 km/h
    const a = P[ab.i], b = P[ab.i + 1], hang = (a.y - b.y) / ((b.S - a.S) || 1);
    ab.v = Math.max(1.5, Math.min(AB_VMAX, ab.v + (9.81 * hang / Math.hypot(1, hang) * 0.85 - 0.4) * dt));
  }
  if(ab.stolper > 0) ab.stolper -= dt;
  if(!ab.grind){
    ab.qv += ((ab.stolper > 0 ? 0 : st.x * 9) - ab.qv) * Math.min(1, dt * (ab.luft ? 2.5 : 5));
    ab.q += ab.qv * dt;
    if(Math.abs(ab.q) > AB_RAND){ ab.q = Math.sign(ab.q) * AB_RAND; ab.qv = 0; if(!ab.luft) ab.v = Math.max(1.5, ab.v - 6 * dt); }
  }
  ab.s += ab.v * (ab.luft ? (ab.weit || 1) : 1) * dt;
  if(!ab.luft) ab.weit = 1;
  const o = ort(ab.s, ab.q);
  const pisteGrund = grundAb(o.x, o.z);
  let grund = pisteGrund, auf = null;
  if(!ab.luft) for(const h of ab.hinder) if((h.typ === 'rampe' || h.typ === 'mega') && ab.s > h.s - h.L && ab.s <= h.s && Math.abs(ab.q - h.q) < h.W / 2){
    auf = h; grund += h.H * (ab.s - (h.s - h.L)) / h.L;
  }
  if(ab.grind){
    const r = ab.grind; ab.y = grund + RAIL_H; ab.q += (r.q - ab.q) * Math.min(1, dt * 10);
    if(ab.s > r.s + RAIL_L){ grindEnde(); ab.luft = true; ab.vy = 3.5; ab.hh = RAIL_H; ab.luftT = 0; ab.spin0 = ab.spin; ab.flip = 0; }   // am Ende: kleiner Hopser
  } else if(ab.luft){
    // ballistisch ueber dem Hang: Hoehe ab.hh (Schwerkraft etwas kraeftiger, damit es knackig wirkt), Boden folgt darunter mit
    ab.luftT += dt; ab.vy -= 14 * dt; ab.hh += ab.vy * dt; ab.y = grund + ab.hh;
    ab.spin -= rs.x * 8 * dt; ab.flip += rs.y * 7.5 * dt;      // R-Stick: rechts = rechtsherum drehen, vor = Frontflip (Nase runter)
    for(const h of ab.hinder) if(h.typ === 'rail' && ab.vy < 0 && ab.s > h.s + 0.5 && ab.s < h.s + RAIL_L - 1 && Math.abs(ab.q - h.q) < 1.4
      && ab.hh <= RAIL_H + 0.4 && ab.hh >= RAIL_H - 0.8){
      if(landen()){ ab.grind = h; if(ab.grindS0 === undefined || h !== ab.letzteRail) ab.grindS0 = ab.s; ab.letzteRail = h; ab.y = grund + RAIL_H; ab.qv = 0; }
      break;
    }
    // auf einem Kicker gelandet (selten): dort aufsetzen, nicht hindurchfallen
    let kick = 0; for(const h of ab.hinder) if(h.typ === 'rampe' && ab.s > h.s - h.L && ab.s <= h.s && Math.abs(ab.q - h.q) < h.W / 2) kick = h.H * (ab.s - (h.s - h.L)) / h.L;
    if(ab.luft && ab.hh <= kick){ ab.y = grund + kick; ab.hh = 0; ab.rampe = null; landen(); }
  } else {
    if(ab.rampe && ab.rampe !== auf && ab.s > ab.rampe.s - 0.5) abheben(ab.rampe);
    else if(ab.y - grund > 1.2 && !ab.rampe){ ab.luft = true; ab.vy = 0; ab.hh = ab.y - grund; ab.luftT = 0; ab.spin0 = ab.spin; ab.flip = 0; ab.kante = true; }   // ueber eine Kante
    else ab.y = Math.max(grund, ab.y - 9.81 * 0.5 * dt * Math.max(1, ab.v));       // an Kuppen am Boden bleiben (sanft folgen)
    if(!ab.luft) ab.rampe = auf;
    if(!auf && !ab.luft) ab.extra = false;
    if(!ab.luft){ ab.grindS0 = undefined; ab.letzteRail = null; }
    { const z = Math.round(ab.spin / (2 * Math.PI)) * 2 * Math.PI; ab.spin += (z - ab.spin) * Math.min(1, dt * 3); }   // zurueck nach vorn
    for(const h of ab.hinder) if(h.typ === 'rail' && !h.weg && ab.s > h.s - 0.5 && ab.s < h.s + 1.5 && Math.abs(ab.q - h.q) < 0.8){ h.weg = true; anstossen('Autsch – die Rail! Mit B draufspringen.'); }
  }
  if(fin.schritt !== 'abfahrt') return;                                         // Mega-Rampe: abgehoben
  for(const h of ab.hinder) if(h.typ === 'fels' && !h.weg){
    if(ab.s > h.s + h.r + 1){ h.weg = true; continue; }
    if(Math.abs(ab.s - h.s) < h.r + 0.4 && Math.abs(ab.q - h.q) < h.r + 0.5 && (ab.luft ? ab.hh : 0) < h.h * 0.85){ h.weg = true; anstossen('Autsch – ein Felsen!'); }
  }
  const a = P[ab.i], b2 = P[ab.i + 1], neig = Math.atan2(a.y - b2.y, (b2.S - a.S) || 1);
  pose(o.x, ab.y, o.z, o.tx, o.tz, ab.grind ? -Math.PI / 2 : 0, ab.grind ? 0 : neig, !ab.luft && !ab.grind && !ab.rampe);
  state.vel.set(o.tx * ab.v, ab.luft ? ab.vy : 0, o.tz * ab.v);
  schneeSpray(dt, o);
  fxSchritt(dt, o, !ab.luft && !ab.grind && !ab.rampe);
}
// Mega-Rampe: weit hinaus aufs Meer (bei 50 km/h ~34 m/s weg und 18 m/s hoch), Tricks gehen weiter
function megaStart(){
  if(fx){ fx.schatten.visible = false; fx.spur.visible = false; }
  const o = ort(ab.s, ab.q);
  const m = ab.mega = { x: o.x, z: o.z, tx: o.tx, tz: o.tz, vh: 30 + ab.v, y: ab.y, y0: ab.y, ueberMeer: false };
  ab.vy = 16 + ab.v * 0.5; fin.schritt = 'mega'; ab.spin0 = ab.spin; ab.flip = 0; m.phase = 'brett'; m.t = 0;
  if(typeof rumble === 'function') rumble(400, 0.8, 0.8);
}
const MEGA_SCHIRM = 45;                                   // m ueber dem Meer: Schirm geht auf (~5 s bis aufs Wasser)
function megaSchritt(dt){
  const m = ab.mega, rs = rStick();
  m.t += dt; ab.luftT += dt;
  if(m.phase === 'schirm'){ megaSchirm(dt); return; }
  // Klippensprung: Bogen hinaus, dann faellt er (hoechstens 55 m/s im Freiflug)
  ab.vy = Math.max(m.phase === 'frei' ? -55 : -75, ab.vy - 9.81 * dt); m.y += ab.vy * dt;
  m.vh = Math.max(18, m.vh - 3 * dt); m.x += m.tx * m.vh * dt; m.z += m.tz * m.vh * dt;
  if(m.phase === 'brett'){
    ab.spin -= rs.x * 8 * dt; ab.flip += rs.y * 7.5 * dt;
    if(m.t > 1.5) brettWeg(m);                             // nach kurzer Zeit verliert er das Snowboard
  } else {
    freiflugSchritt(dt);
    const k = fin.k; k.yaw = Math.atan2(-m.tx, -m.tz);
    if(!m.mitte) m.mitte = new THREE.Vector3();
    m.mitte.set(m.x, m.y + 0.8, m.z); freiflugPose(k.g, m.mitte, k.yaw);
    state.pos.set(m.x, m.y, m.z); state.vel.set(m.tx * m.vh, ab.vy, m.tz * m.vh); state.onGround = false; fahrtwind(dt);
    if(m.ueberMeer && m.y - (typeof seaYAt === 'function' ? seaYAt(m.x, m.z) : 0) < MEGA_SCHIRM) megaSchirmAuf(m);
    if(!m.ueberMeer && fujiMeshY(m.x, m.z) === -Infinity) m.ueberMeer = true;
    return;
  }
  if(!m.ueberMeer && fujiMeshY(m.x, m.z) === -Infinity) m.ueberMeer = true;      // vom Berg weg: keine Abfrage mehr (Ruckeln)
  const meer = typeof seaYAt === 'function' ? seaYAt(m.x, m.z) : 0, berg = m.ueberMeer ? -Infinity : fujiMeshY(m.x, m.z) + 2.5;
  if(m.y <= Math.max(meer, berg)){
    m.y = Math.max(meer, berg);
    // im Meer zaehlt jeder volle Trick, auch schraeg gelandet (Wasser verzeiht); danach geht es so oder so weiter
    const name = trickName(); if(name){ ab.tricks.push('Mega ' + name); zeige('✨ Mega ' + name + '!', 2.5); } else zeige('Platsch! 🌊', 2.5);
    ab.luft = false; ab.vy = 0; ab.stolper = 0; ab.spin = Math.round(ab.spin / (2 * Math.PI)) * 2 * Math.PI; ab.flip = 0;
    fin.schritt = 'surf'; ab.surfT = 0; ab.v = m.vh * 0.45;
    const g = fin.k.g, alt = g.userData.brett; if(alt) g.remove(alt);       // Snowboard -> Surfbrett
    if(surfVorlage){ const b = surfVorlage.clone(true); b.position.y = 0.02; g.add(b); g.userData.brett = b; }
    if(typeof rumble === 'function') rumble(500, 1.0, 0.8);
  }
  pose(m.x, m.y, m.z, m.tx, m.tz);
  state.vel.set(m.tx * m.vh, ab.vy, m.tz * m.vh);
}
// Snowboard fliegt davon (eigene Bahn, dreht sich), Kenji geht in den Freiflug
function brettWeg(m){
  const name = trickName(); if(name) trick('Mega ' + name);
  ab.spin = 0; ab.flip = 0; m.phase = 'frei'; freiflugStart();
  const g = fin.k.g, b = g.userData.brett; g.userData.brett = null;
  if(b){ g.updateMatrixWorld(true); const w = new THREE.Vector3(); b.getWorldPosition(w); g.remove(b); b.position.copy(w); scene.add(b);
    m.brett = { b, v: new THREE.Vector3(m.tx * m.vh * 0.6 - m.tz * 4, ab.vy + 3, m.tz * m.vh * 0.6 + m.tx * 4), w: new THREE.Vector3(3, 1.2, 2) }; }
  kAnim('fly'); figurZurueck(); fin.kal = false;   // erst fly (beendet die eingefrorene Haltung), dann Figur zuruecksetzen

}
function megaSchirmAuf(m){
  m.phase = 'schirm';
  const k = fin.k, g = makeParachute(); g.position.set(m.x, m.y, m.z);
  scene.remove(k.g); scene.add(g); k.g = g; frei.rolle = 0; frei.salto = 0; if(fx) fx.wind.material.opacity = 0;
  kAnim('hang'); ab.vy = Math.max(ab.vy, -12);
}
function megaSchirm(dt){
  const m = ab.mega, k = fin.k, a = Math.min(1, dt * 1.6);
  ab.vy += (-9 - ab.vy) * a; m.vh += (8 - m.vh) * a;
  m.y += ab.vy * dt; m.x += m.tx * m.vh * dt; m.z += m.tz * m.vh * dt;
  k.yaw = Math.atan2(-m.tx, -m.tz); k.g.position.set(m.x, m.y, m.z); k.g.rotation.set(0, k.yaw, Math.sin(k.t * 1.3) * 0.06, 'YXZ');
  state.pos.set(m.x, m.y, m.z); state.vel.set(m.tx * m.vh, ab.vy, m.tz * m.vh);
  const meer = typeof seaYAt === 'function' ? seaYAt(m.x, m.z) : 0;
  if(m.y <= meer) insWasser(m, meer);
}
// Aufs Wasser: Schirm weg, Kenji steht auf dem Surfbrett (wie auf dem Snowboard)
function insWasser(m, meer){
  m.y = meer; ab.luft = false; ab.vy = 0; ab.stolper = 0; ab.spin = 0; ab.flip = 0;
  fin.schritt = 'surf'; ab.surfT = 0; ab.v = Math.max(6, m.vh);
  const alt = fin.k.g; scene.remove(alt);
  const g = makeAstronaut(); scene.add(g); fin.k.g = g;
  if(surfVorlage){ const b = surfVorlage.clone(true); g.add(b); g.userData.brett = b; if(g.children[0] !== b) g.children[0].position.y = 0.045; }
  fin.kal = false; ab.kalT = 0; knochen = null; haltung();
  if(typeof rumble === 'function') rumble(400, 0.8, 0.6);
  surfenStart(true);                                      // Live-Wunsch: nach dem Mega-Sprung gleich auf die Brandungswellen
}
function surfSchritt(dt){
  const m = ab.mega;
  ab.surfT += dt; ab.v *= 1 - Math.min(1, dt * 0.25);
  m.x += m.tx * ab.v * dt; m.z += m.tz * ab.v * dt;
  m.y = typeof seaYAt === 'function' ? seaYAt(m.x, m.z) : 0;
  pose(m.x, m.y - 0.05, m.z, m.tx, m.tz);
  state.vel.set(m.tx * ab.v, 0, m.tz * ab.v);
  if(ab.surfT > 6 && !ab.ende){
    ab.ende = true;
    zeige('🌊 ' + (ab.tricks.length ? ab.tricks.length + ' Tricks! ' : '') + 'Monsterwellen-Surfen kommt bald!', 5);
    story.spaeter(5, () => zurueck(''));
  }
}

// Auf dem Brett: Kenjis normale Stehhaltung (idle), 90° nach rechts gedreht (brettUnter)
function haltung(){
  if(!(fin.k && fin.k.g && fin.k.g.userData.brett)) return;   // nur auf dem Brett
  kAnim('idle');
  const a = story.kenji && story.kenji.acts.idle;
  if(a && !a.paused){ a.time = 0.4; a.paused = true; }       // feste Stehhaltung, keine wandernden Fuesse
}
// Fuesse auf der Brettachse (Live-Test: stand noch schraeg): Fusslinie links->rechts auf +Z drehen (linker Fuss vorne = -Z),
// Mitte auf das Brett schieben. Einmal je Abfahrt, nachdem Haltung und Ueberblendung stehen.
const _fl = new THREE.Vector3(), _fr = new THREE.Vector3(), _mi = new THREE.Matrix4();
function fussPunkte(g){
  g.updateMatrixWorld(true); _mi.copy(g.matrixWorld).invert(); let l = null, r = null;
  g.traverse(o => { if(o.name === 'mixamorigLeftFoot') l = o; else if(o.name === 'mixamorigRightFoot') r = o; });
  if(!l || !r) return false; l.getWorldPosition(_fl).applyMatrix4(_mi); r.getWorldPosition(_fr).applyMatrix4(_mi); return true;
}
function fuesseAusrichten(){
  const g = fin.k && fin.k.g, fig = g && g.children[0]; if(!fig || fin.kal || !(ab.kalT > 0.6)) return;
  for(let i = 0; i < 4; i++){
    if(!fussPunkte(g)) return;
    const w = Math.atan2(_fr.x - _fl.x, _fr.z - _fl.z); if(Math.abs(w) < 0.03) break;
    fig.rotation.y -= w;
  }
  if(!fussPunkte(g)) return;
  fig.position.x -= (_fl.x + _fr.x) / 2; fig.position.z -= (_fl.z + _fr.z) / 2;
  fin.kal = true;
}
function figurZurueck(){
  const g = fin.k && fin.k.g, fig = g && g.children[0]; if(fig && fig !== g.userData.brett){ fig.rotation.set(0, 0, 0); fig.position.set(0, g.userData.brett ? 0.045 : 0, 0); }
  const k = story.kenji; if(k && k.acts.idle) k.acts.idle.paused = false;
}

// ==== Surfen auf Brandungswellen (Live-Wunsch 13.10.2026) ==============================================================
// Eigenes, feines Wellenfeld (die Engine-Duenung ist mit 62,5 m Stuetzabstand und +-1,6 m zu grob): Wellenreihen laufen von der
// See (-x) auf den Fukuoka-Beach zu (+x), Kaemme laengs z. Profil: steile Front, flacher Ruecken, Schaum am Kamm. Hoehe nach
// Stufe (1: 5 m, 2: 3,5 m, 3: 2 m, 4: 1 m; 5: kein Surfen). Kenji steht automatisch auf der Welle; die Welle schiebt ihn
// (Tempo aus dem Gefaelle), L-Stick lenkt quer an der Welle entlang und hoch/runter, B springt an der Lippe, LT/RT drehen,
// R-Stick Flips. Wipeout = Waschgang (kurz unter, auf dem Brett wieder auf, naechste Welle). Y = aussteigen -> Ring am Strand.
const WEL = { L: 46, V: 9.5, X0: -140, X1: 18 };          // Wellenlaenge (m), Laufgeschwindigkeit (m/s), Feld von/bis Kueste (relativ)
function wellenHoehe(){ return ({ 1: 5, 2: 3.5, 3: 2, 4: 1 })[stufe()] || 0; }
const welle = { aktiv: false, t: 0, mesh: null, cx: 0, cz: 0, H: 2, wasch: 0, ersteMal: true, abspann: false };
story.finaleWelle = welle;
// Brandungsprofil einer Reihe: u = Phase in [0, 1) (0 = Kamm/Lippe, Front davor bei u ~0,9..1, Ruecken danach)
function wellenProfil(u){
  // Front steil (letzte 18 % der Wellenlaenge), Ruecken flach (Rest), Kamm bei u = 0/1
  if(u > 0.82){ const f = (u - 0.82) / 0.18; return Math.pow(f, 1.6); }        // Front: von Tal (0) steil hoch zum Kamm (1)
  const r = u / 0.82; return Math.pow(1 - r, 2.2);                                // Ruecken: vom Kamm flach ab ins Tal
}
// Wellenhoehe an (x, z) in Weltkoordinaten. Kuestenabstand d = x - KX (KX = Wasserlinie): weit draussen klein, an der
// Brandungszone voll, kurz vor dem Strand bricht sie und laeuft aus.
function wellenY(x, z){
  const K = L().FEST.x, d = x - K;                                               // < 0 = auf See
  if(d > 6) return -0.3;
  const zone = Math.max(0, Math.min(1, (d + 150) / 70)) * Math.max(0, Math.min(1, (6 - d) / 30));
  const u = (((x - welle.t * WEL.V) / WEL.L) % 1 + 1) % 1;
  const wackel = 1 + 0.08 * Math.sin(z * 0.045 + welle.t * 0.7);                 // Kamm nicht schnurgerade
  return welle.H * zone * wackel * wellenProfil(u) - 0.3 + Math.sin(z * 0.11 + welle.t * 1.6) * 0.06;
}
story.finaleWellenY = wellenY;
// Steigung der Welle in Laufrichtung (+x), fuer Tempo und Neigung
function wellenGef(x, z){ return (wellenY(x + 0.6, z) - wellenY(x - 0.6, z)) / 1.2; }
// Feines Mesh, das mit Kenji mitwandert (rastet auf 1,5 m ein)
function wellenBauen(){
  if(welle.mesh) return;
  const NX = 140, NZ = 110, S = 1.5, geo = new THREE.PlaneGeometry(NX * S, NZ * S, NX, NZ); geo.rotateX(-Math.PI / 2);
  const col = new Float32Array(geo.attributes.position.count * 3); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.96, fog: false }));
  m.frustumCulled = false; m.renderOrder = 1; scene.add(m);
  welle.mesh = m; welle.S = S; welle.base = Float32Array.from(geo.attributes.position.array);
}
function wellenWeg(){ if(!welle.mesh) return; scene.remove(welle.mesh); welle.mesh.geometry.dispose(); welle.mesh.material.dispose(); welle.mesh = null; }
const _wt = new THREE.Color(0x0e5d86), _wm = new THREE.Color(0x2fa6cf), _ws = new THREE.Color(0xffffff), _ww = new THREE.Color(0x0b4f74), _wc = new THREE.Color();
function wellenMesh(){
  const m = welle.mesh; if(!m) return;
  const S = welle.S, cx = Math.round(state.pos.x / S) * S, cz = Math.round(state.pos.z / S) * S;
  m.position.set(cx, 0, cz);
  const P = m.geometry.attributes.position, C = m.geometry.attributes.color, B = welle.base;
  for(let i = 0; i < P.count; i++){
    const x = B[i * 3] + cx, z = B[i * 3 + 2] + cz, y = wellenY(x, z);
    P.setY(i, y);
    // Farbe: Tal tuerkis-dunkel, oben hell, an der steilen Front kurz vor dem Kamm Schaum
    const h = welle.H > 0 ? Math.max(0, Math.min(1, (y + 0.3) / welle.H)) : 0, g = wellenGef(x, z);
    // steile Wand (Front) dunkler, Ruecken heller; oben an der Front Schaumkrone
    const wand = Math.max(0, Math.min(1, g * 1.6));
    _wc.copy(_wt).lerp(_wm, h).lerp(_ww, wand * (1 - h) * 0.8);
    if(h > 0.72 && g > 0.15) _wc.lerp(_ws, Math.min(1, (h - 0.72) / 0.18));
    C.setXYZ(i, _wc.r, _wc.g, _wc.b);
  }
  P.needsUpdate = true; C.needsUpdate = true; m.geometry.computeVertexNormals();
}
// ---- Surfen starten / Schritt / Waschgang / aussteigen ----------------------------------------------------------------
function surfenStart(vonMega){
  if(fx){ fx.schatten.visible = false; fx.spur.visible = false; }
  welle.aktiv = true; welle.H = wellenHoehe(); welle.wasch = 0;
  wellenBauen();
  fin.aktiv = true; fin.art = 'surfen'; fin.schritt = 'welle'; story.phase = 'finale';
  if(story.hudSichtbar) story.hudSichtbar(false);
  ladeSurf();
  if(!vonMega){
    clearEva();
    const g = makeAstronaut(); scene.add(g);
    fin.k = { g, v: new THREE.Vector3(), yaw: -Math.PI / 2, t: 0 };
    ab.tricks = ab.tricks || [];
  }
  const g = fin.k.g;
  if(!g.userData.brett && surfVorlage){ const b = surfVorlage.clone(true); g.add(b); g.userData.brett = b; if(g.children[0] !== b) g.children[0].position.y = 0.045; }
  // Startpunkt: draussen auf der Front der naechsten Welle, Blick zum Strand (+x)
  const K = L().FEST.x, z0 = vonMega && ab.mega ? ab.mega.z : L().STRANDPLATZ.z;
  ab.x = K - 70; ab.z = z0; ab.vx = WEL.V; ab.vz = 0; ab.v = WEL.V; ab.luft = false; ab.vy = 0; ab.hh = 0;
  ab.spin = 0; ab.spin0 = 0; ab.flip = 0; ab.stolper = 0; ab.kurs = 1.05; ab.kalT = 0; fin.kal = false; knochen = null;   // ~60° quer zur Welle
  welleFangen();
  figurZurueck(); haltung();
  story.hinweis(''); welle.hinweisSperre = true;
}
story.finaleSurfen = surfenStart;
// Kenji auf die naechste Front setzen (automatisch auf der Welle)
function welleFangen(){
  // auf die Front einer Welle (Phase u = 0,9), und zwar die erste, die mindestens 55 m vor dem Strand laeuft
  const K = L().FEST.x, phase = x => (((x - welle.t * WEL.V) / WEL.L) % 1 + 1) % 1;
  let x = K - 55; x += (0.9 - phase(x)) * WEL.L; while(x > K - 55) x -= WEL.L;
  ab.x = x; ab.v = WEL.V; ab.y = wellenY(ab.x, ab.z);
}
function brettNachreichen(){
  const g = fin.k && fin.k.g; if(!g || g.userData.brett || !surfVorlage) return;
  const b = surfVorlage.clone(true); g.add(b); g.userData.brett = b; if(g.children[0] !== b) g.children[0].position.y = 0.045;
  fin.kal = false; ab.kalT = 0; knochen = null;
}
function welleSchritt(dt){
  const k = fin.k; if(!k) return;
  brettNachreichen();
  k.t += dt; ab.kalT = (ab.kalT || 0) + dt; welle.t += dt;
  const st = stick(), rs = rStick(), K = L().FEST.x;
  if(welle.wasch > 0){ waschgang(dt); return; }
  // Steuerung: L-Stick links/rechts = Kurs (Winkel zur Wellenrichtung), vor/zurueck = an der Welle hoch / runter
  // Kurs: links/rechts wechselt die Fahrtrichtung an der Wand (+-60°), losgelassen haelt er die Seite
  if(!ab.luft && Math.abs(st.x) > 0.3) ab.kursSoll = Math.sign(st.x) * 1.05;
  if(ab.kursSoll === undefined) ab.kursSoll = 1.05;
  ab.kurs += (ab.kursSoll - ab.kurs) * Math.min(1, dt * 2.2);
  const gef = wellenGef(ab.x, ab.z);
  if(!ab.luft){
    // Die Welle schiebt (Front = positive Steigung in Laufrichtung): je steiler, desto schneller, max ~45 km/h
    const schub = Math.max(0, gef) * 9.81 * 0.9, bremse = 0.6 + Math.max(0, -gef) * 6;
    ab.v = Math.max(WEL.V * 0.4, Math.min(12.5, ab.v + (schub - bremse) * dt));
  }
  // Richtung: Grundlauf mit der Welle (+x), Kurs dreht quer (z), L-Stick vor = die Welle hinunter (schneller, mehr +x)
  const quer = Math.sin(ab.kurs), laeng = Math.cos(ab.kurs);
  const vx = WEL.V + (ab.v - WEL.V) * laeng - st.y * 2.2, vz = ab.v * quer;   // Grundlauf = Welle; Gefaelle und Stick dazu
  ab.x += vx * dt; ab.z += vz * dt;
  const tx = vx / (Math.hypot(vx, vz) || 1), tz = vz / (Math.hypot(vx, vz) || 1);
  // Welle verloren (hinter ihr zurueckgefallen) oder am Strand -> neue Welle
  const u = (((ab.x - welle.t * WEL.V) / WEL.L) % 1 + 1) % 1;
  if(!ab.luft && (u < 0.55 || ab.x - K > -4)) welleFangen();
  const wy = wellenY(ab.x, ab.z);
  if(ab.luft){
    ab.luftT += dt; ab.vy -= 14 * dt; ab.hh += ab.vy * dt; ab.y = wy + ab.hh;
    ab.spin -= rs.x * 8 * dt; ab.flip += rs.y * 7.5 * dt;
    if(ab.hh <= 0){ ab.hh = 0; ab.y = wy;
      const sr = ab.spin - Math.round(ab.spin / Math.PI) * Math.PI, fr = ab.flip - Math.round(ab.flip / (2 * Math.PI)) * 2 * Math.PI;
      if(Math.abs(sr) > 0.87 || Math.abs(fr) > 1.05){ waschgangStart(); return; }   // unsauber = Waschgang
      landen(); if(fx) fx.puff(state.pos, 1);
    }
  } else {
    ab.y = wy;
    // Lippe: an der Kante (Kamm) mit B oder automatisch bei hoher Fahrt nach oben (st.y < 0 = hoch) abheben
    const lippe = u > 0.97 || u < 0.02;
    if(lippe && ab.springWunsch){ ab.springWunsch = false; ab.luft = true; ab.luftT = 0; ab.hh = 0; ab.spin0 = ab.spin; ab.flip = 0; ab.vy = 4 + welle.H * 1.2 + ab.v * 0.2; ab.kante = false; }
    { const z = Math.round(ab.spin / (2 * Math.PI)) * 2 * Math.PI; ab.spin += (z - ab.spin) * Math.min(1, dt * 3); }
  }
  // Pose: Neigung aus der Welle unter dem Brett (vor/hinter), Gruppe zeigt in Fahrtrichtung
  const neig = Math.atan2(wellenY(ab.x - tx * 0.7, ab.z - tz * 0.7) - wellenY(ab.x + tx * 0.7, ab.z + tz * 0.7), 1.4);
  pose(ab.x, ab.y + 0.02, ab.z, tx, tz, 0, ab.luft ? 0 : neig, false);
  state.vel.set(vx, ab.luft ? ab.vy : 0, vz);
  fahrtwind(dt);
  gischt(dt, tx, tz);
}
// B auf der Welle: Sprungwunsch fuer die naechste Lippe (oder sofort, wenn man an ihr ist)
function welleSpringen(){ if(welle.wasch > 0 || ab.luft) return; ab.springWunsch = true; story.spaeter(0.6, () => { ab.springWunsch = false; }); }
// Gischt: weisse Spritzer hinter dem Brett, in der Kurve mehr (Snowboard-Spray-Baustein mit anderer Farbe)
const gisch = { teile: [], mat: null, t: 0 };
function gischt(dt, tx, tz){
  if(!gisch.mat) gisch.mat = new THREE.MeshBasicMaterial({ color: 0xeafaff, transparent: true, opacity: 0.85, fog: false });
  if(!gisch.g){ gisch.g = new THREE.Group(); scene.add(gisch.g); }
  gisch.t -= dt;
  const kurve = Math.abs(ab.kurs);
  if(!ab.luft && gisch.t <= 0){
    gisch.t = 0.025 / (1 + kurve * 2);
    let s = gisch.teile.find(p => !p.m.visible);
    if(!s && gisch.teile.length < 80){ s = { m: new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), gisch.mat), v: new THREE.Vector3() }; gisch.g.add(s.m); gisch.teile.push(s); }
    if(s){ const seite = Math.sign(ab.kurs || 1) * -1; s.m.visible = true; s.t = 0; s.m.position.set(ab.x - tx * 0.8, ab.y + 0.1, ab.z - tz * 0.8);
      s.v.set(-tx * 3 + -tz * seite * (2 + kurve * 5), 2 + Math.random() * 2 + kurve * 2, -tz * 3 + tx * seite * (2 + kurve * 5)); }
  }
  for(const p of gisch.teile) if(p.m.visible){ p.t += dt; p.v.y -= 9.81 * dt; p.m.position.addScaledVector(p.v, dt); p.m.scale.setScalar(Math.max(0.1, 1 - p.t * 1.4)); if(p.t > 0.7) p.m.visible = false; }
}
function gischtWeg(){ if(gisch.g){ scene.remove(gisch.g); gisch.g.traverse(o => { if(o.geometry) o.geometry.dispose(); }); gisch.g = null; } gisch.teile.length = 0; }
// Waschgang: Kenji faellt ins Wasser, kurz unter (gedreht), taucht auf dem Brett auf, naechste Welle
function waschgangStart(){
  welle.wasch = 1.8; ab.luft = false; ab.spin = 0; ab.flip = 0; ab.hh = 0;
  zeige('🌊 Waschgang!', 1.5); if(typeof rumble === 'function') rumble(500, 0.9, 0.7);
  if(fx) fx.puff(state.pos, 2);
  kAnim('swim');
}
function waschgang(dt){
  welle.wasch -= dt;
  const k = fin.k, wy = wellenY(ab.x, ab.z), tief = Math.sin(Math.min(1, (1.8 - welle.wasch) / 1.2) * Math.PI) * 1.6;
  ab.x += WEL.V * 0.5 * dt;
  k.g.position.set(ab.x, wy - tief, ab.z); k.g.rotation.set(Math.sin(k.t * 7) * 0.8, k.yaw + k.t * 2, Math.cos(k.t * 5) * 0.6, 'YXZ');
  state.pos.set(ab.x, wy, ab.z); state.vel.set(WEL.V * 0.5, 0, 0);
  if(welle.wasch <= 0){ welle.wasch = 0; welleFangen(); figurZurueck();
    const K = story.kenji; if(K && K.acts.swim){ K.acts.swim.stop(); K.cur = null; }   // hart zurueck auf die Stehhaltung
    haltung(); fin.kal = false; ab.kalT = 0; }
}
// Y: aussteigen -> im Ring am Strand; beim ersten Mal laeuft der Abspann
function surfenAussteigen(){
  if(!welle.aktiv) return;
  welle.aktiv = false;
  story.schwarz('', 1.2, () => {
    wellenWeg(); gischtWeg();
    aufraeumen();
    bahnStart(); planeGroup.visible = false;
    const c = story.e6c400 && story.e6c400(); if(c) c.visible = true;
    evaExit();
    const S = L().SURF || L().STRANDPLATZ;
    if(eva){ eva.group.position.set(S.x + 2, ISLAND_Y, S.z); eva.yaw = -Math.PI / 2; eva.group.rotation.y = eva.yaw; evaOrbit = 0; evaPitch = 0; }
    snapCamera(); story.phase = 'ankunft';
    if(!welle.abspann){ welle.abspann = true; if(story.abspann) story.abspann(); }
  });
}
story.finaleSurfenAus = surfenAussteigen;

// ---- Zurueck an die C-400 (geschafft oder noch einmal) -------------------------------------------------------------
function aufraeumen(){
  fin.aktiv = false; fin.schritt = null; story.ziel = null;
  if(fin.k){ scene.remove(fin.k.g); fin.k = null; }
  if(fin.flieger){ scene.remove(fin.flieger.g); fin.flieger = null; }
  for(const r of fin.ringe) r.mesh.visible = false;
  vulkanAus(); abWeg(); fxWeg(); wellenWeg(); gischtWeg(); welle.aktiv = false; figurZurueck(); if(ab.mega && ab.mega.brett){ scene.remove(ab.mega.brett.b); ab.mega.brett = null; } if(story.hudSichtbar) story.hudSichtbar(true); if(camera.fov !== 60){ camera.fov = 60; camera.updateProjectionMatrix(); }
  if(fin.hudEl) fin.hudEl.style.display = 'none';
  state.crashed = false; state.crashTimer = 0; state.falling = false; state.ejected = false; state.stalling = false;
  if(typeof clearRescue === 'function') clearRescue();
  if(typeof clearParachute === 'function') clearParachute();
  const pf = story.preflight; if(pf){ pf.aktiv = false; pf.gruen = false; if(pf.el) pf.el.style.display = 'none'; }
}
function zurueck(text, danach){
  if(fin.zurueck) return; fin.zurueck = true;
  story.schwarz(text || '', 1.6, () => {
    fin.zurueck = false;
    aufraeumen();
    bahnStart(); planeGroup.visible = false;
    const c = story.e6c400 && story.e6c400(); if(c) c.visible = true;
    evaExit();
    const V = L().VORFELD;
    if(eva){ eva.group.position.set(V.x - 22, ISLAND_Y, V.z); eva.yaw = -Math.PI / 2; eva.group.rotation.y = eva.yaw; evaOrbit = 0; evaPitch = 0; }
    snapCamera();
    story.phase = 'ankunft';
    if(danach) story.spaeter(2, () => { story.hinweis(danach); story.spaeter(8, () => story.hinweis('')); });
  });
}

// ---- Aufgabe (D-Pad links / T) und Status-Symbol ----------------------------------------------------------------
function aufgabe(){
  const p = state.pos, agl = Math.max(0, Math.round(p.y - ISLAND_Y)), z = story.ziel, d = z ? Math.round(Math.hypot(z.x - p.x, z.z - p.z)) : 0;
  const titel = fin.schritt === 'welle' ? '🏄 Surfen' : (fin.art === 'sprung' ? '🪂 Abenteuer: Fuji-Sprung' : '✈️ Rundflug um den Fuji'), zeilen = [];
  if(fin.schritt === 'ansage' || fin.schritt === 'sequenz') zeilen.push(['Start', 'Startsequenz, dann Vollgas und abheben']);
  else if(['fall', 'schirm', 'gelandet', 'abfahrt', 'mega', 'surf', 'welle'].includes(fin.schritt)){
    // Live-Wunsch: nur Tempo, Tricks je Trick, Rest der Piste
    const kmh = Math.round((fin.schritt === 'abfahrt' || fin.schritt === 'surf' || fin.schritt === 'welle' ? ab.v : state.vel.length()) * 3.6);
    zeilen.push(['Tempo', kmh + ' km/h']);
    const n = {}; for(const x of ab.tricks || []) n[x] = (n[x] || 0) + 1;
    const liste = Object.keys(n);
    if(!liste.length) zeilen.push(['Tricks', 'noch keine']);
    for(const x of liste) zeilen.push([x, n[x] + '×']);
    const rest = fin.piste && fin.piste.S !== undefined && fin.schritt === 'abfahrt' ? Math.max(0, Math.round(fin.piste.S - ab.s)) : null;
    if(fin.schritt === 'welle') zeilen.push(['Welle', welle.H.toFixed(1).replace('.', ',') + ' m · Y: aussteigen']);
    else zeilen.push(['Piste übrig', rest === null ? (fin.schritt === 'mega' || fin.schritt === 'surf' ? 'geschafft' : '–') : rest + ' m']);
  } else if(fin.art === 'rundflug'){
    zeilen.push(['Höhe', agl + ' m (Gipfel 2000, max ' + MAX_ALT + ')']);
    if(fin.ringNr < fin.ringe.length){ zeilen.push(['Ring', (fin.ringNr + 1) + ' / ' + fin.ringe.length + ' · ' + d + ' m']); zeilen.push(['Ringhöhe', Math.round(fin.ringe[fin.ringNr].y) + ' m']); }
    else { zeilen.push(['Ziel', 'zurück zur Bahn · ' + d + ' m']); zeilen.push(['Landen', 'Gas auf 20–30 %, langsam sinken']); }
  } else if(fin.schritt === 'pilot') zeilen.push(['Der Pilot fliegt', 'B: abspringen!']);
  else if(fin.schritt === 'flug'){
    zeilen.push(['Höhe', agl + ' m (mindestens ' + SPRUNG_MIN + ')']);
    zeilen.push(['Piste', d + ' m – roter Punkt im Radar']);
    zeilen.push(['Dort', 'übernimmt der Pilot, B = abspringen']);
  }
  return [titel, zeilen];
}
function hud(){
  if(fin.hudEl) fin.hudEl.style.display = 'none';
  const st = document.getElementById('status'), sym = fin.schritt === 'fall' || fin.schritt === 'schirm' ? '🪂' : (fin.schritt === 'surf' || fin.schritt === 'welle' ? '🏄' : (fin.schritt === 'gelandet' || fin.schritt === 'abfahrt' || fin.schritt === 'mega' ? '🏂' : '✈️'));
  if(st && st.textContent !== sym) st.textContent = sym;
}

// Test: in die C-400 und gleich ueber die Piste, der Pilot kreist schon (Startmenue "Finale 1")
function testPilot(){
  fin.aktiv = true; fin.art = 'sprung'; fin.abgehoben = true; fin.crash = false; fin.ringNr = 0;
  story.phase = 'finale'; story.hinweis('');
  clearEva();
  currentModel = MODEL_NAMES.indexOf('Transall');
  document.getElementById('mdl').textContent = 'C-400';
  buildModel('Transall'); spec = Object.assign({}, PLANE_SPECS.Transall || DEFAULT_SPEC, { maxAlt: MAX_ALT });
  const c = story.e6c400 && story.e6c400(); if(c) c.visible = false;
  bauePiste(); ladeBrett();
  const z = fin.piste.ziel;
  state.pos.set(z.x + KREIS_R, SPRUNG_MIN + 50, z.z); state.vel.set(0, 0, -62); state.quat.identity();
  state.onGround = false; state.crashed = false; state.throttle = 0.85;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.visible = true;
  fin.yaw = 0; fin.hoehe = state.pos.y; fin.schritt = 'pilot'; zielSetzen();
  snapCamera();
  story.sprich(['Ich übernehme! Wir kreisen über der Piste. Spring mit B, wenn du bereit bist!'], null, 'pilot');
}

// ---- Hooks --------------------------------------------------------------------------------------------------------
function hookFinale(){
  // Test-Einstieg "Finale 1/2" (Startmenue): Tage passend setzen, gleich ans Ende von Etappe 6 (Strand, C-400)
  const startOrig = story.etappe6Start;
  story.etappe6Start = function(){
    const r = startOrig.apply(this, arguments);
    const n = story.finaleDirekt; if(!n) return r;
    story.finaleDirekt = 0;
    // sofort (noch im Schwarzen): Globus Tokio -> Fukuoka, danach der Strand; Finale 1 dann gleich ueber die Piste
    story.e6ankunft(1, 'Test-Sprung Finale ' + n, true);
    if(n === 1) fin.testPilot = true;                     // nach dem Globus (der leert alle Timer), siehe updateHUD
    return r;
  };
  const yOrig = buttonY;
  buttonY = function(){ if(fin.aktiv && hier() && fin.schritt === 'welle'){ surfenAussteigen(); return; } return yOrig.apply(this, arguments); };
  // Y an der C-400 (am Strand, nach Etappe 6)
  const boardYOrig = evaBoardY;
  evaBoardY = function(){ if(c400Nah()){ einsteigen(); return; } return boardYOrig.apply(this, arguments); };
  // B in der Transall: abspringen / Schirm (statt Kiste). Beim Rundflug tut B nichts (Live-Wunsch)
  const dropOrig = dropCrate;
  dropCrate = function(){ if(fin.aktiv && hier()){ aktionB(); return; } return dropOrig.apply(this, arguments); };
  const hudOrig = updateHUD;
  updateHUD = function(){
    const r = hudOrig.apply(this, arguments);
    if(fin.testPilot && hier() && story.phase === 'ankunft' && eva && story.e6fujiMesh){ fin.testPilot = false; testPilot(); }
    if(hier() && story.phase === 'ankunft' && surfVorlage === null) ladeSurf();          // Surfbrett vorab laden
    if(fin.aktiv && hier()) hud();
    return r;
  };
  // Aufgabe im Finale (vor allen Etappen-Texten; sonst fiel sie auf Etappe 1 zurueck)
  const aufgabeE6Orig = story.aufgabeE6;
  story.aufgabeE6 = function(){ if(fin.aktiv && hier()) return aufgabe(); return aufgabeE6Orig ? aufgabeE6Orig.apply(this, arguments) : null; };
  const brettZeit = () => fin.aktiv && hier() && (fin.schritt === 'abfahrt' || fin.schritt === 'mega' || fin.schritt === 'surf' || fin.schritt === 'welle');
  const schubOrig = schubBalken;
  schubBalken = function(){ if(brettZeit()){ if(schubEl && schubAlt !== 'aus'){ schubEl.style.display = 'none'; schubAlt = 'aus'; } return; } return schubOrig.apply(this, arguments); };
  const bodenOrig = seaFloorNeeded;
  seaFloorNeeded = function(){ if(fin.aktiv && hier() && fin.k) return false; return bodenOrig.apply(this, arguments); };
  const schattenOrig = updateShadow;
  updateShadow = function(){ const r = schattenOrig.apply(this, arguments); if(fin.aktiv && hier() && fin.k){ if(planeShadow) planeShadow.visible = false; if(typeof ovalShadow !== 'undefined' && ovalShadow) ovalShadow.visible = false; } return r; };
  const tonOrig = updateEngineSound;
  updateEngineSound = function(){ const r = tonOrig.apply(this, arguments); if(fin.aktiv && hier() && fin.k && typeof engineGain !== 'undefined' && engineGain) engineGain.gain.value = 0; return r; };
  const cratesOrig = updateCrates, scoopOrig = updateScoopHint;
  updateCrates = function(){ if(fin.aktiv && hier()){ crateLoad = 0; crateLoadT = 0; return; } return cratesOrig.apply(this, arguments); };
  updateScoopHint = function(){ if(fin.aktiv && hier()){ if(scoopEl) scoopEl.style.opacity = '0'; return; } return scoopOrig.apply(this, arguments); };
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(!(fin.aktiv && hier())) return physOrig.apply(this, arguments);
    if(fin.schritt === 'ansage'){ state.vel.set(0, 0, 0); state.throttle = 0; return; }
    if(fin.schritt === 'pilot'){ pilotSchritt(dt); hud(); return; }
    if(fin.schritt === 'fall' || fin.schritt === 'schirm' || fin.schritt === 'gelandet'){ sprungSchritt(dt); hud(); return; }
    if(fin.schritt === 'welle'){ welleSchritt(dt); hud(); return; }
    if(fin.schritt === 'abfahrt' || fin.schritt === 'mega' || fin.schritt === 'surf'){ abfahrtSchritt(dt); hud(); return; }
    const r = physOrig.apply(this, arguments);
    if(fin.schritt === 'flug'){ flugUpdate(); hud(); }
    if(fin.art === 'rundflug' && (fin.schritt === 'flug' || fin.schritt === 'fertig')) vulkanUpdate(dt);
    return r;
  };
  // Absturz: kein Engine-Reset, das Finale bringt Kenji selbst zurueck
  const resetOrig = resetPlane;
  resetPlane = function(){ if(fin.aktiv && hier()) return; return resetOrig.apply(this, arguments); };
  // Der Fuji ist im Finale so hoch wie sein Modell (nicht nur wie die flachere Formel)
  const hitsOrig = hitsBuilding;
  hitsBuilding = function(x, y, z){ if(fin.aktiv && hier() && y < fujiMeshY(x, z)) return true; return hitsOrig.apply(this, arguments); };
  // Kamera beim Sprung: hinter Kenji, im freien Fall etwas hoeher
  const camOrig = updateCamera, _cp = new THREE.Vector3();
  let seitK = 0, seitS = 1;                                // Seitenblick-Blende 0..1 und zuletzt gewaehlte Seite
  updateCamera = function(){
    if(!(fin.aktiv && hier() && fin.k)) return camOrig.apply(this, arguments);
    haltungKnochen(); fuesseAusrichten();
    if(welle.aktiv) wellenMesh();
    if(sideView !== 0) seitS = sideView;
    seitK = sideView !== 0 ? Math.min(1, seitK + 0.12) : 0;
    if(seitK > 0.02 && fin.k){
      const fahrt = fin.schritt === 'abfahrt' || fin.schritt === 'mega' || fin.schritt === 'surf';
      const k = fin.k, p = fahrt ? state.pos : k.g.position, fx = -Math.sin(k.yaw), fz = -Math.cos(k.yaw);
      const rx = -fz, rz = fx, schirm = fin.schritt === 'schirm', w = schirm ? 12 : 7;   // rechts quer zur Blickrichtung
      const hy = schirm ? 2 : (fin.schritt === 'fall' ? 1 : 1.2);                         // am Schirm: Mitte zwischen Kenji und Schirm
      _cp.set(p.x + rx * w * seitS + fx * 1.5, p.y + hy + 1.5, p.z + rz * w * seitS + fz * 1.5);
      // aus der normalen Ansicht heruebergleiten: Position schrittweise zur Seite
      camera.position.lerp(_cp, Math.min(1, 0.1 + seitK * 0.3));
      if(!fahrt || fin.schritt === 'abfahrt') camera.position.y = Math.max(camera.position.y, bodenY(camera.position.x, camera.position.z) + 1.2);
      camera.up.set(0, 1, 0);
      camera.lookAt(p.x + fx * 2, p.y + hy + 0.6, p.z + fz * 2);
      if(sideView !== 0){ fin.camY = camera.position.y; return; }   // beim Loslassen gleitet die normale Kamera zurueck
    }
    const fahrt = fin.schritt === 'abfahrt' || fin.schritt === 'mega' || fin.schritt === 'surf' || fin.schritt === 'welle';
    const k = fin.k, p = fahrt ? state.pos : k.g.position, fx = -Math.sin(k.yaw), fz = -Math.cos(k.yaw);
    const fall = fin.schritt === 'fall', hinten = fahrt ? 6.5 : (fall ? 10 : (fin.schritt === 'gelandet' ? 8 : 16)), hoch = fahrt ? 2.4 : (fall ? 7 : 4);
    const fov = fahrt ? 60 + Math.min(1, ab.v / AB_VMAX) * 22 : 60;                       // Tempo: Sichtfeld weiter (60 -> 82°)
    if(Math.abs(camera.fov - fov) > 0.1){ camera.fov += (fov - camera.fov) * 0.08; camera.updateProjectionMatrix(); }
    _cp.set(p.x - fx * hinten, p.y + hoch, p.z - fz * hinten);
    const hoch2 = fahrt && fin.schritt === 'abfahrt' && ab.luft ? ab.hh : 0;
    fin.sprungK = (fin.sprungK || 0) + (Math.min(1, hoch2 / 8) - (fin.sprungK || 0)) * (hoch2 > 0 ? 0.12 : 0.08);   // 0..1 weich
    const zurueck = fin.sprungK * 6;                                                      // Zoom: weiter weg
    if(fin.schritt === 'welle' && sideView === 0){
      // hinter Kenji, aber zur See hin versetzt (-x), damit die anrollende Wand seitlich im Bild steht
      const hi = 7.5, ho = 3 + welle.H * 0.5;
      _cp.set(p.x - fx * hi - 4, p.y + ho, p.z - fz * hi); fin.camY = undefined;
      camera.position.lerp(_cp, 0.12); camera.up.set(0, 1, 0);
      camera.lookAt(p.x + fx * 8 + 2, p.y + welle.H * 0.3, p.z + fz * 8);
      return;
    }
    if(fin.schritt === 'mega'){
      const ph = ab.mega && ab.mega.phase, nah = ph === 'frei' || ph === 'schirm';
      const hi = ph === 'schirm' ? 12 : (nah ? 6 : 6.5), ho = ph === 'schirm' ? 2 : (nah ? 2.5 : 4);
      if(nah && Math.abs(camera.fov - 65) > 0.1){ camera.fov += (65 - camera.fov) * 0.15; camera.updateProjectionMatrix(); }
      _cp.set(p.x - fx * hi, p.y + ho, p.z - fz * hi); fin.camY = undefined;
      if(nah && fin.camPh !== ph){ camera.position.copy(_cp); fin.camPh = ph; } else if(!nah) fin.camPh = ph;
      camera.position.lerp(_cp, nah ? 0.35 : 0.08); camera.up.set(0, 1, 0);
      camera.lookAt(p.x + fx * (nah ? 4 : 25), p.y + (ph === 'schirm' ? 1.5 : (nah ? -1.5 : -6)), p.z + fz * (nah ? 4 : 25));
      return;
    }
    if(fahrt && fin.schritt === 'abfahrt'){ _cp.x -= fx * zurueck; _cp.z -= fz * zurueck; }
    if(fahrt){ const ziel = p.y - hoch2 * 0.45 + hoch + fin.sprungK * 1.5; fin.camY = fin.camY === undefined || Math.abs(ziel - fin.camY) > 6 ? ziel : fin.camY + (ziel - fin.camY) * (fin.schritt === 'abfahrt' ? 0.15 : 0.06); _cp.y = fin.camY; }
    camera.up.set(0, 1, 0);
    camera.position.x += (_cp.x - camera.position.x) * 0.12; camera.position.z += (_cp.z - camera.position.z) * 0.12;
    camera.position.y = Math.max(_cp.y, bodenY(camera.position.x, camera.position.z) + 3);
    const zit = fahrt && !ab.luft && fin.schritt === 'abfahrt' ? (ab.v / AB_VMAX) * 0.05 : 0;   // Pistenrauheit
    if(zit){ camera.position.x += (Math.random() - 0.5) * zit; camera.position.y += (Math.random() - 0.5) * zit; }
    // Blick: am Boden voraus, im Sprung naeher an Kenji heran (er bleibt oben im Bild)
    const vor = fahrt ? 14 - fin.sprungK * 8 : 6;
    camera.lookAt(p.x + fx * vor, p.y + (fahrt ? 0.3 - hoch2 * 0.25 : -(fall ? 8 : 1)), p.z + fz * vor);
  };
}
const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookOrig) hookOrig(); hookFinale(); };
})();
