// Trip to Japan – Finale am Fukuoka-Beach (nach Etappe 6) mit der C-400 auf dem Vorfeld (Live-Wunsch 13.10.2026: Transall statt
// Mustang). Laedt nach etappe6c.js, vor der Engine. Welche Stufe es gibt, haengt an den verbrauchten Tagen (Konzept.md, 5-Stufen-Finale):
//   Stufe 1 (6 Tage)    "Abenteuer" (Fuji-Sprung): Kenji fliegt selbst hoch ueber den Fuji. Ueber der Piste uebernimmt der Pilot, B = abspringen,
//                       freier Fall (linker Stick lenkt), der Schirm geht von allein auf, Landung auf der verschneiten Piste.
//                       Die Snowboard-Abfahrt folgt im naechsten Schritt.
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
function pisteY(x, z){
  if(!fin.piste) return -Infinity;
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
  const N = 320, r0 = 0.1 * F.r, r1 = 0.97 * F.r, qx = -PISTE_DIR.z, qz = PISTE_DIR.x;
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
    for(const s of [-1, 1]){
      const x = p.x + nx * s * PISTE_B / 2, z = p.z + nz * s * PISTE_B / 2;
      pos.push(x, Math.max(fujiMeshY(x, z), p.y - 6, 0.5) + 2.5, z);
    }
    if(i < N){ const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xf4f8ff, side: THREE.DoubleSide, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  mesh.frustumCulled = false; story.welt(6).add(mesh);
  fin.piste = { mesh, pts, ziel: pts[Math.round(N * 0.08)] };
  story.finalePiste = fin.piste;                       // fuer die Snowboard-Abfahrt
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
  a.reset().play();
  if(k.cur && k.acts[k.cur]) k.acts[k.cur].crossFadeTo(a, 0.25, false);
  k.cur = n;
}
function stick(){
  let x = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0), y = (keys['ArrowDown'] ? 1 : 0) - (keys['ArrowUp'] ? 1 : 0);
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(gp){ const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0; if(Math.abs(ax) > 0.15) x = ax; if(Math.abs(ay) > 0.15) y = ay; }
  return { x, y };
}
function aktionB(){
  if(fin.schritt === 'pilot') abspringen();
  else if(fin.schritt === 'flug' && fin.art === 'sprung'){
    story.hinweis('Erst zum roten Punkt über der Piste – mindestens ' + SPRUNG_MIN + ' m hoch!'); story.spaeter(4, () => story.hinweis(''));
  }
}
function abspringen(){
  fin.schritt = 'fall';
  // Der Flieger fliegt als Kopie geradeaus weiter; state.pos folgt ab jetzt Kenji (Radar, Hoehe im HUD)
  const f = planeGroup.clone(true); scene.add(f); planeGroup.visible = false;
  fin.flieger = { g: f, v: state.vel.clone(), t: 0 };
  const g = makeAstronaut(), back = new THREE.Vector3(0, 0, 1).applyQuaternion(state.quat);
  g.position.set(state.pos.x + back.x * 8, state.pos.y - 3, state.pos.z + back.z * 8);
  scene.add(g);
  fin.k = { g, v: state.vel.clone().multiplyScalar(0.6), yaw: fin.yaw, t: 0 }; fin.k.v.y = 0;
  let best = null, bd = 1e9; fin.piste.pts.forEach((q, i) => { if(i < 8) return; const dd = Math.hypot(q.x - g.position.x, q.z - g.position.z); if(dd < bd){ bd = dd; best = q; } });
  fin.k.lande = { x: best.x, z: best.z, sx: 0, sz: 0 };   // sx/sz: Versatz durch den Stick (bleibt auf der Pistenbreite)
  kAnim('fly'); state.throttle = 0;
  story.sprich(['Viel Spaß!'], null, 'pilot');
  story.hinweis('Freier Fall! Der Schirm geht von allein auf – mit dem linken Stick lenkst du auf der Piste nach links und rechts');
}
function schirmAuf(){
  const k = fin.k; if(!k || fin.schritt !== 'fall') return;
  fin.schritt = 'schirm';
  const g = makeParachute(); g.position.copy(k.g.position);
  scene.remove(k.g); scene.add(g); k.g = g;
  kAnim('hang');
  k.v.y = Math.max(k.v.y, -20);
  story.hinweis('🪂 Schirm offen – du schwebst zur weißen Piste');
}
function sprungSchritt(dt){
  const f = fin.flieger;
  if(f){ f.t += dt; f.g.position.addScaledVector(f.v, dt); if(f.t > 14){ scene.remove(f.g); fin.flieger = null; } }
  const k = fin.k; if(!k) return;
  k.t += dt;
  const st = stick(), p = k.g.position;
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
    k.g.rotation.set(0, k.yaw, 0, 'YXZ');                // 'fly' liegt schon flach (Bauch nach unten, Kopf voraus)
    if(p.y - bodenY(p.x, p.z) < SCHIRM_AUF) schirmAuf();
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
  state.pos.copy(p); state.vel.copy(k.v); state.onGround = false; state.throttle = 0;
}
function gelandet(p){
  const k = fin.k; fin.schritt = 'gelandet'; k.v.set(0, 0, 0);
  while(k.g.children.length > 1) k.g.remove(k.g.children[k.g.children.length - 1]);   // Schirm ab (Kenji ist das erste Kind)
  k.g.rotation.set(0, k.yaw, 0, 'YXZ'); kAnim('land', true);
  const kl = story.kenji && story.kenji.acts.land; story.spaeter(kl ? kl.getClip().duration : 0.5, () => { if(fin.k === k) kAnim('idle'); });
  story.hinweis(''); story.ziel = null;
  if(aufPiste(p.x, p.z)){                                // Live-Wunsch: ohne Ansage gleich aufs Snowboard, es geht sofort los
    brettUnter(k.g);
    if(story.finaleAbfahrt){ story.finaleAbfahrt(k); return; }
    story.hinweis('🏂 Die Snowboard-Abfahrt kommt im nächsten Schritt!');
    story.spaeter(4, () => zurueck(''));
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
function brettUnter(g){
  if(!brettVorlage) return;
  const b = brettVorlage.clone(true); b.rotation.y = Math.PI / 2; b.position.y = 0.02;
  g.add(b); g.userData.brett = b; g.position.y += 0.06;
}

// ---- Zurueck an die C-400 (geschafft oder noch einmal) -------------------------------------------------------------
function aufraeumen(){
  fin.aktiv = false; fin.schritt = null; story.ziel = null;
  if(fin.k){ scene.remove(fin.k.g); fin.k = null; }
  if(fin.flieger){ scene.remove(fin.flieger.g); fin.flieger = null; }
  for(const r of fin.ringe) r.mesh.visible = false;
  vulkanAus();
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
  const titel = fin.art === 'sprung' ? '🪂 Abenteuer: Fuji-Sprung' : '✈️ Rundflug um den Fuji', zeilen = [];
  if(fin.schritt === 'ansage' || fin.schritt === 'sequenz') zeilen.push(['Start', 'Startsequenz, dann Vollgas und abheben']);
  else if(fin.schritt === 'fall' || fin.schritt === 'schirm'){
    zeilen.push(['Über Grund', Math.max(0, Math.round(p.y - bodenY(p.x, p.z))) + ' m']);
    zeilen.push(['Piste', Math.round(Math.max(0, pisteAbstand(p.x, p.z) - PISTE_B / 2)) + ' m']);
    zeilen.push(['Lenken', fin.schritt === 'fall' ? 'linker Stick – Schirm geht bei ' + SCHIRM_AUF + ' m von allein auf' : 'linker Stick nach links und rechts']);
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
  const st = document.getElementById('status'), sym = fin.schritt === 'fall' || fin.schritt === 'schirm' ? '🪂' : (fin.schritt === 'gelandet' ? '🏂' : '✈️');
  if(st && st.textContent !== sym) st.textContent = sym;
}

// ---- Hooks --------------------------------------------------------------------------------------------------------
function hookFinale(){
  // Test-Einstieg "Finale 1/2" (Startmenue): Tage passend setzen, gleich ans Ende von Etappe 6 (Strand, C-400)
  const startOrig = story.etappe6Start;
  story.etappe6Start = function(){
    const r = startOrig.apply(this, arguments);
    const n = story.finaleDirekt; if(!n) return r;
    story.finaleDirekt = 0;
    story.spaeter(1, () => { if(!e6()) return; story.tage = n === 1 ? 5 : 11; story.e6ankunft(1, 'Test-Sprung Finale ' + n, true); });
    return r;
  };
  // Y an der C-400 (am Strand, nach Etappe 6)
  const boardYOrig = evaBoardY;
  evaBoardY = function(){ if(c400Nah()){ einsteigen(); return; } return boardYOrig.apply(this, arguments); };
  // B in der Transall: abspringen / Schirm (statt Kiste). Beim Rundflug tut B nichts (Live-Wunsch)
  const dropOrig = dropCrate;
  dropCrate = function(){ if(fin.aktiv && hier()){ aktionB(); return; } return dropOrig.apply(this, arguments); };
  const hudOrig = updateHUD;
  updateHUD = function(){ const r = hudOrig.apply(this, arguments); if(fin.aktiv && hier()) hud(); return r; };
  // Aufgabe im Finale (vor allen Etappen-Texten; sonst fiel sie auf Etappe 1 zurueck)
  const aufgabeE6Orig = story.aufgabeE6;
  story.aufgabeE6 = function(){ if(fin.aktiv && hier()) return aufgabe(); return aufgabeE6Orig ? aufgabeE6Orig.apply(this, arguments) : null; };
  const cratesOrig = updateCrates, scoopOrig = updateScoopHint;
  updateCrates = function(){ if(fin.aktiv && hier()){ crateLoad = 0; crateLoadT = 0; return; } return cratesOrig.apply(this, arguments); };
  updateScoopHint = function(){ if(fin.aktiv && hier()){ if(scoopEl) scoopEl.style.opacity = '0'; return; } return scoopOrig.apply(this, arguments); };
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(!(fin.aktiv && hier())) return physOrig.apply(this, arguments);
    if(fin.schritt === 'ansage'){ state.vel.set(0, 0, 0); state.throttle = 0; return; }
    if(fin.schritt === 'pilot'){ pilotSchritt(dt); hud(); return; }
    if(fin.schritt === 'fall' || fin.schritt === 'schirm' || fin.schritt === 'gelandet'){ sprungSchritt(dt); hud(); return; }
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
  updateCamera = function(){
    if(!(fin.aktiv && hier() && fin.k)) return camOrig.apply(this, arguments);
    const k = fin.k, p = k.g.position, fx = -Math.sin(k.yaw), fz = -Math.cos(k.yaw);
    const fall = fin.schritt === 'fall', hinten = fall ? 10 : (fin.schritt === 'gelandet' ? 8 : 16), hoch = fall ? 7 : 4;
    _cp.set(p.x - fx * hinten, p.y + hoch, p.z - fz * hinten);
    camera.up.set(0, 1, 0);
    camera.position.x += (_cp.x - camera.position.x) * 0.12; camera.position.z += (_cp.z - camera.position.z) * 0.12;
    camera.position.y = Math.max(_cp.y, bodenY(camera.position.x, camera.position.z) + 3);
    camera.lookAt(p.x + fx * 6, p.y - (fall ? 8 : 1), p.z + fz * 6);
  };
}
const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookOrig) hookOrig(); hookFinale(); };
})();
