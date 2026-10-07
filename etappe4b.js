// Trip to Japan – Etappe 4b: Schnellboot-Flucht (Risiko, "1 Tag").
// Laedt nach etappe4.js und flucht_glb.js. Gleiche Welt (story.welt(4)), gleicher Hafen.
// Kenji kapert das Schnellboot am Kai, zwei Polizeiboote verfolgen ihn: eines von hinten, eines
// kommt an einer Abzweigung aus dem Seitenarm. Strecke: raus aus dem Hafenbecken, dann ein Kanal mit
// fuenf Kurven bis zur Muendung (gerechnet in C:\tmp\sfg\e4\kanal.js).
//   Geschafft (Muendung erreicht) -> 1 Tag. Eingeholt (Polizei < FANG_R) oder 3 Felskontakte ->
//   kurze Geschichte (7 Tage Gefaengnis) -> 7 Tage.
// Kurve 1 zeigt haarscharf, dass Vollgas nicht reicht (Konzept): Wendekreis bei Vollgas ~ Kurvenradius.
(function(){
'use strict';
const story = window.STORY;
function e4(){ return story.etappe === 4; }
function hier(){ return e4() && locale === 'earth'; }

// ---- Kanal (Mittellinie x(z), wie der Fluss in Etappe 3) -------------------------------------
const KANAL_B = 60;               // m Breite (Live-Test: 60 m zu leicht, 40/50 m mit schnellerer Polizei nicht zu schaffen -> wieder 60)
const KANAL_Z0 = -130, KANAL_Z1 = -1650;   // Anfang (Becken-Ausfahrt) / Muendung
// Live-Test (2x): fast alle Kurven gingen mit Vollgas, 500-600 m Vorsprung. Jetzt sieben Kurven, enger,
// und ein schmalerer Kanal; abgestimmt mit dem Bot im Spiel (C:\tmp\sfg\test_e4bot.js).
// [Mitte z, Versatz x, Laenge]
// Kurvenradien 69-119 m -> Kurventempo ~73-93 km/h bei 150 km/h auf der Geraden (C:\tmp\sfg\e4\kurven4.js).
// (Erster Versuch mit 39-49 m war zusammen mit dem steifen Ruder unfahrbar.)
const KNICKE = [[-250, 70, 200], [-480, -80, 170], [-730, 70, 170], [-960, -75, 160], [-1190, 80, 170], [-1410, -70, 160], [-1580, 55, 160]];
const X0 = 60;
function mitteX(z){ let x = X0; for(const [zk, a, KL] of KNICKE){ const u = (zk + KL / 2 - z) / KL;
  if(u >= 1) x += a; else if(u > 0) x += a * (1 - Math.cos(Math.PI * u)) / 2; } return x; }
function lage(x, z){
  const d1 = (mitteX(z + 2) - mitteX(z - 2)) / 4, n = Math.hypot(1, d1);
  return { d: (x - mitteX(z)) / n, rx: -d1 / n, rz: -1 / n };
}
// Hafenbecken (Wasser): vor dem Kai bis zur Kanal-Einfahrt
const BECKEN = { x0: 12, x1: 130, z0: 160, z1: KANAL_Z0 - 20 };
function imBecken(x, z){ return x > BECKEN.x0 && x < BECKEN.x1 && z < BECKEN.z0 && z > BECKEN.z1; }
function imKanal(x, z, rand){ return z <= KANAL_Z0 + 30 && z >= KANAL_Z1 - 60 && Math.abs(lage(x, z).d) < KANAL_B / 2 - (rand || 0); }
// Seitenarm fuer Polizeiboot 2 auf der Geraden zwischen Kurve 2 und 3 (vorher mitten in Kurve 2 – dort sah er
// wie ein Teil der Kurve aus, Live-Test: nicht zu sehen). Mit eigenen Mauern und Einfahrt.
const ARM = { z: -595, laenge: 140, b: 26 };
function imArm(x, z){
  const xm = mitteX(ARM.z);
  return Math.abs(z - ARM.z) < ARM.b / 2 && x > xm && x < xm + KANAL_B / 2 + ARM.laenge;
}
// Offenes Meer hinter der Muendung (Live-Test: der Kanal endete an grauem Belag)
// Live-Test: hinter dem Ziel graues Land am Horizont -> Meer bis weit hinter die Sichtweite (Nebel 3000 m)
const MEER = { z0: KANAL_Z1 + 20, z1: KANAL_Z1 - 4200, halb: 3600 };
function imMeer(x, z){ return z < MEER.z0 && z > MEER.z1 && Math.abs(x - mitteX(KANAL_Z1)) < MEER.halb; }
const ZIEL_Z = KANAL_Z1 - 260;                     // Ziel draussen auf dem Meer
function nass(x, z, rand){ return imBecken(x, z) || imKanal(x, z, rand) || imArm(x, z) || imMeer(x, z); }
story.flucht4 = { nass, imKanal, mitteX };          // fuer etappe4.js (Wasser) und Tests

// ---- Felsen: aussen in den Kurven, Kurve 1 so, dass Vollgas haarscharf aussen streift ---------
const FELSEN = [];
(function(){
  let s = 53; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for(let z = KANAL_Z0 - 60; z > KANAL_Z1 + 60; ){
    const krumm = mitteX(z + 40) - 2 * mitteX(z) + mitteX(z - 40);
    const kurve = Math.abs(krumm) > 2;
    z -= kurve ? 50 + rnd() * 35 : 110 + rnd() * 60;
    const seite = kurve ? -Math.sign(krumm) : (rnd() < 0.5 ? -1 : 1);
    const anteil = kurve ? 0.45 + rnd() * 0.4 : 0.1 + rnd() * 0.5;
    const L = lage(mitteX(z), z), nx = -L.rz, nz = L.rx;
    FELSEN.push({ x: mitteX(z) + nx * seite * anteil * KANAL_B / 2, z: z + nz * seite * anteil * KANAL_B / 2, r: 3.5 + rnd() * 2.5 });
  }
})();

story.flucht4.FELSEN = FELSEN;

// ---- Modelle --------------------------------------------------------------------------------
function ladeGlb(daten, fertig){
  if(!daten || !THREE.GLTFLoader) return;
  const b64 = daten.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (g) => fertig(g.scene), (e) => console.warn('Flucht-Modell', e));
}
// auf Laenge l, Unterkante auf yUnten, Laenge auf z (Bug nach -z wie in der Engine)
function normiere(o, l, laengsX){
  if(laengsX) o.rotation.y = Math.PI / 2;
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), s = new THREE.Vector3(); b.getSize(s);
  o.scale.multiplyScalar(l / Math.max(s.x, s.z));
  o.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(o), c = new THREE.Vector3(); b2.getCenter(c);
  o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y;
  const w = new THREE.Group(); w.add(o); return w;
}
const fl = story.flucht = { aktiv: false, fertig: false, laeuft: false, t: 0, kontakte: 0, cool: 0, rede: null,
  hudEl: null, boot: null, polizei: [], kulisse: false, parkBoot: null };

// ---- Kulisse: Wasserflaeche, Ufer, Felsen, Muendung, Seitenarm ------------------------------
function band(d0, d1, y, mat, z0, z1){
  const STEP = 6, Q = 4, zs = []; for(let z = z0; z >= z1; z -= STEP) zs.push(z);
  const pos = new Float32Array(zs.length * (Q + 1) * 3), idx = [];
  zs.forEach((z, i) => { const L = lage(mitteX(z), z), nx = -L.rz, nz = L.rx, mx = mitteX(z);
    for(let k = 0; k <= Q; k++){ const d = d0 + (d1 - d0) * k / Q, o = (i * (Q + 1) + k) * 3;
      pos[o] = mx + nx * d; pos[o + 1] = y; pos[o + 2] = z + nz * d;
      if(i > 0 && k > 0){ const a = (i - 1) * (Q + 1) + k - 1, b = a + 1, c = i * (Q + 1) + k - 1, e = c + 1; idx.push(a, c, b, b, c, e); } } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.material.side = THREE.DoubleSide; return m;
}
// Senkrechte Kaimauer entlang des Kanals bei Querabstand d (von unter Wasser bis zur Kaikante)
function wand(d, mat, z0, z1){
  const STEP = 6, zs = []; for(let z = z0; z >= z1; z -= STEP) zs.push(z);
  const pos = new Float32Array(zs.length * 6), idx = [];
  zs.forEach((z, i) => { const L = lage(mitteX(z), z), x = mitteX(z) - L.rz * d, zz = z + L.rx * d;
    pos.set([x, -1, zz, x, KAI_Y4, zz], i * 6);
    if(i > 0){ const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}
const UFER_B = 160;                                  // m Uferbeton beidseits des Kanals
// Haeuser entlang des Kanals: Lagerhallen und Wohnhaeuser, Front zum Wasser (fester Zufall)
function baueHaeuser(w){
  let s = 911; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const waende = [0xd8cbb4, 0xb9a48a, 0x9fb3c2, 0xc7a28f, 0xe6e0d4, 0x8f9a84].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const daecher = [0x8a3b2c, 0x4f5660, 0x6b4a33, 0x3d5a6e].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const fenster = new THREE.MeshLambertMaterial({ color: 0x2b3a4a });
  const box = new THREE.BoxGeometry(1, 1, 1), dach = new THREE.ConeGeometry(0.72, 1, 4);
  const g = new THREE.Group();
  for(let z = BECKEN.z1 - 40; z > KANAL_Z1 + 40; z -= 34 + rnd() * 30){
    for(const seite of [-1, 1]){
      const r = [rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd()];
      if(r[0] < 0.25) continue;
      if(seite > 0 && Math.abs(z - ARM.z) < ARM.b / 2 + 30) continue;     // Seitenarm frei
      const halle = r[1] < 0.35;
      const b = halle ? 22 + r[2] * 16 : 9 + r[2] * 8, t = halle ? 16 + r[3] * 10 : 9 + r[3] * 7;
      const h = halle ? 7 + r[4] * 4 : 8 + r[4] * 18;
      const ab = KANAL_B / 2 + 14 + t / 2 + r[5] * 40;
      const L = lage(mitteX(z), z), nx = -L.rz, nz = L.rx;
      const hx = mitteX(z) + nx * seite * ab, hz = z + nz * seite * ab;
      // In engen Kurven ragt die Querlinie zum Kanal der Nachbarkurve: dann kein Haus
      const rad = Math.hypot(b, t) / 2 + 12;
      if([[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => imKanal(hx + a * rad, hz + c * rad, -12) || imArm(hx + a * rad, hz + c * rad))) continue;
      const haus = new THREE.Group();
      const k = new THREE.Mesh(box, waende[Math.floor(r[6] * waende.length)]); k.scale.set(b, h, t); k.position.y = h / 2; haus.add(k);
      if(halle){ const d = new THREE.Mesh(box, daecher[1]); d.scale.set(b + 1, 0.8, t + 1); d.position.y = h + 0.4; haus.add(d); }
      else if(h < 16){ const dh = Math.min(5, h * 0.45), d = new THREE.Mesh(dach, daecher[Math.floor(r[7] * daecher.length)]);
        d.scale.set(Math.max(b, t), dh, Math.max(b, t)); d.rotation.y = Math.PI / 4; d.position.y = h + dh / 2; haus.add(d); }
      // Zur Kanalseite: Tor (Halle) bzw. Fensterbaender je Stockwerk (Wohnhaus)
      if(halle){ const tor = new THREE.Mesh(box, fenster); tor.scale.set(b * 0.4, h * 0.6, 0.3); tor.position.set(0, h * 0.3, -t / 2 - 0.1); haus.add(tor); }
      else for(let y = 3; y < h - 1.5; y += 3.2){ const f = new THREE.Mesh(box, fenster); f.scale.set(b * 0.8, 1.2, 0.3); f.position.set(0, y, -t / 2 - 0.1); haus.add(f); }
      haus.position.set(hx, KAI_Y4, hz);
      haus.rotation.y = Math.atan2(nx * seite, nz * seite);                        // lokal -z zeigt zum Kanal
      g.add(haus);
    }
  }
  // Je Material zu EINEM Mesh verschmelzen: ~1000 Einzelteile (jedes Fenster) waren ~350 Zeichenaufrufe
  g.updateMatrixWorld(true);
  const proMat = new Map();
  g.traverse(o => { if(!o.isMesh) return; const geo = o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed();
    if(!proMat.has(o.material)) proMat.set(o.material, []); proMat.get(o.material).push(geo); });
  for(const [mat, geos] of proMat){
    let n = 0; for(const q of geos) n += q.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    for(const q of geos){ pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); o += q.attributes.position.count; q.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    w.add(new THREE.Mesh(geo, mat));
  }
  box.dispose(); dach.dispose();
}
// Offenes Meer hinter der Muendung: Schiffe (Engine-Modelle), ruhige eigene Fahrt auf der glatten Flaeche.
// [Typ, x relativ zur Muendung, z relativ zur Muendung, Kurs]
const MEER_SCHIFFE = [['container', 700, -900, 1.2], ['cruise', -900, -1500, -0.5], ['liberty', 400, -1900, 2.4],
  ['sail', -250, -700, 0.9], ['container', -600, -2400, 1.9], ['sail', 1100, -1300, -2.2]];
const meerSchiffe = [];
function baueMeerSchiffe(w){
  if(meerSchiffe.length) return;
  for(const [key, dx, dz, kurs] of MEER_SCHIFFE){
    const def = SHIP_TYPES.find(d => d.key === key); if(!def) continue;
    meerSchiffe.push({ key, x: mitteX(KANAL_Z1) + dx, z: KANAL_Z1 + dz, kurs, v: def.spd, g: null, w });
  }
}
function meerSchiffeUpdate(dt){
  const mx = mitteX(KANAL_Z1);
  for(const o of meerSchiffe){
    // Modell erst einsetzen, wenn es geladen ist (sonst nur der Platzhalterklotz der Engine)
    if(!o.g){ if(!shipTemplates[o.key]) continue; o.g = makeSeaShipBody(o.key); o.g.userData.fremd = true; o.w.add(o.g); }
    o.x += -Math.sin(o.kurs) * o.v * dt; o.z += -Math.cos(o.kurs) * o.v * dt;
    // Draussen bleiben (nicht vor die Muendung, nicht aus dem Meer): sonst langsam zur Mitte drehen
    if(Math.abs(o.x - mx) > 1500 || o.z > KANAL_Z1 - 500 || o.z < KANAL_Z1 - 2700){
      const soll = Math.atan2(-(mx - o.x), -(KANAL_Z1 - 1600 - o.z));
      let d = soll - o.kurs; while(d > Math.PI) d -= 2 * Math.PI; while(d < -Math.PI) d += 2 * Math.PI;
      o.kurs += Math.sign(d) * Math.min(Math.abs(d), 0.05 * dt);
    }
    o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.kurs;
  }
}
story.meerSchiffe4 = meerSchiffeUpdate;
const WASSER = new THREE.MeshLambertMaterial({ color: 0x2a6f93 });
const KAI_Y4 = 2.5;                                  // wie KAI_Y in etappe4.js
function baueKulisse(){
  if(fl.kulisse) return; fl.kulisse = true;
  const w = story.welt(4);
  // Wasser: Becken (Rechteck), Kanal (Band), Seitenarm (Rechteck)
  const becken = new THREE.Mesh(new THREE.PlaneGeometry(BECKEN.x1 - BECKEN.x0, BECKEN.z0 - BECKEN.z1), WASSER);
  becken.rotation.x = -Math.PI / 2; becken.position.set((BECKEN.x0 + BECKEN.x1) / 2, 0, (BECKEN.z0 + BECKEN.z1) / 2); w.add(becken);
  w.add(band(-KANAL_B / 2, KANAL_B / 2, 0.01, WASSER, KANAL_Z0 + 30, KANAL_Z1 - 60));
  const arm = new THREE.Mesh(new THREE.PlaneGeometry(KANAL_B / 2 + ARM.laenge, ARM.b), WASSER);
  arm.rotation.x = -Math.PI / 2; arm.position.set(mitteX(ARM.z) + (KANAL_B / 2 + ARM.laenge) / 2, 0.012, ARM.z); w.add(arm);
  // Kaimauern am Kanal (Beton)
  const beton = new THREE.MeshLambertMaterial({ color: 0x77736c });
  // Ufer erst unterhalb des Beckens (BECKEN.z1), sonst ueberdeckt das Band die Kanaleinfahrt.
  // UFER_B breit (vorher 70 m): das Bodengitter (62,5 m) liegt neben dem Wasser tief, bei 70 m sah
  // man dahinter durch (Live-Bild: linke Mauer an der Einfahrt offen).
  w.add(band(KANAL_B / 2, KANAL_B / 2 + UFER_B, KAI_Y4 + 0.03, beton, BECKEN.z1, ARM.z + ARM.b / 2));
  w.add(band(KANAL_B / 2, KANAL_B / 2 + UFER_B, KAI_Y4 + 0.03, beton, ARM.z - ARM.b / 2, KANAL_Z1));
  w.add(band(-KANAL_B / 2 - UFER_B, -KANAL_B / 2, KAI_Y4 + 0.03, beton, BECKEN.z1, KANAL_Z1));
  // Senkrechte Mauern am Wasser (vorher nur die Deckflaeche: man sah unter die Kante)
  const mauer = new THREE.MeshLambertMaterial({ color: 0x5f5b55, side: THREE.DoubleSide });
  w.add(wand(KANAL_B / 2, mauer, BECKEN.z1, ARM.z + ARM.b / 2));
  w.add(wand(KANAL_B / 2, mauer, ARM.z - ARM.b / 2, KANAL_Z1));
  w.add(wand(-KANAL_B / 2, mauer, BECKEN.z1, KANAL_Z1));
  // Seitenarm: Mauern links und rechts, damit man die Abzweigung sieht (das Kanalufer ist dort offen)
  const armMauer = new THREE.MeshLambertMaterial({ color: 0x8a857c });
  for(const s of [-1, 1]){
    const m = new THREE.Mesh(new THREE.BoxGeometry(ARM.laenge + 4, KAI_Y4 + 3, 3), armMauer);
    m.position.set(mitteX(ARM.z) + KANAL_B / 2 + ARM.laenge / 2, (KAI_Y4 - 3) / 2, ARM.z + s * (ARM.b / 2 + 1.5)); w.add(m);
  }
  // Warnschild an der Einfahrt (rot-weiss)
  const schild = new THREE.Mesh(new THREE.BoxGeometry(1, 5, 4), new THREE.MeshLambertMaterial({ color: 0xd23c2c }));
  schild.position.set(mitteX(ARM.z) + KANAL_B / 2 + 2, 2.5 + KAI_Y4, ARM.z - ARM.b / 2 - 4); w.add(schild);
  // Beckenrand gegenueber dem Kai (Landzunge bis zur Kanaleinfahrt)
  const zunge = new THREE.Mesh(new THREE.BoxGeometry(80, KAI_Y4 + 3, BECKEN.z0 - BECKEN.z1 + 40), beton);
  zunge.position.set(BECKEN.x1 + 40, (KAI_Y4 - 3) / 2, (BECKEN.z0 + BECKEN.z1) / 2); w.add(zunge);
  // Felsen
  const fels = new THREE.MeshLambertMaterial({ color: 0x5e5a54 });
  for(const f of FELSEN){ const m = new THREE.Mesh(new THREE.DodecahedronGeometry(f.r, 0), fels);
    m.position.set(f.x, 0.6, f.z); m.scale.y = 0.7; m.rotation.set(f.x, f.z, 0); w.add(m); }
  // Muendung: Meer (weites Wasserfeld) hinter dem Kanal, Molenkoepfe mit Leuchtfeuer, Ziel draussen
  const meer = new THREE.Mesh(new THREE.PlaneGeometry(MEER.halb * 2, MEER.z0 - MEER.z1),
    new THREE.MeshLambertMaterial({ color: 0x1f5f86 }));
  meer.rotation.x = -Math.PI / 2; meer.position.set(mitteX(KANAL_Z1), 0.005, (MEER.z0 + MEER.z1) / 2); w.add(meer);
  const L = lage(mitteX(KANAL_Z1), KANAL_Z1), nx = -L.rz, nz = L.rx;
  const mole = new THREE.MeshLambertMaterial({ color: 0x77736c }), feuer = [0xd23c2c, 0x2c9e4a];
  [-1, 1].forEach((s, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 8), mole);
    m.position.set(mitteX(KANAL_Z1) + nx * s * (KANAL_B / 2 + 4), 1.5, KANAL_Z1 + nz * s * (KANAL_B / 2 + 4)); w.add(m);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 7, 10), new THREE.MeshLambertMaterial({ color: feuer[i] }));
    t.position.set(m.position.x, 6.5, m.position.z); w.add(t);
  });
  const boje = new THREE.MeshLambertMaterial({ color: 0xffd23f });
  for(const s of [-1, 1]){ const b = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 10), boje);
    b.position.set(mitteX(KANAL_Z1) + s * 22, 1.3, ZIEL_Z); w.add(b); }
  const saeule = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 160, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  saeule.position.set(mitteX(KANAL_Z1), 80, ZIEL_Z); saeule.renderOrder = 995; w.add(saeule);
  baueHaeuser(w);
  baueMeerSchiffe(w);
  // Schnellboot am Kai (Kulisse, solange man nicht drin ist)
  ladeGlb(window.FLUCHT_RENNBOOT_GLB, (o) => {
    const b = normiere(o, 13, false); b.position.set(START.x, -0.5, START.z); b.rotation.y = START.yaw + Math.PI;   // Bug bei +z im Modell
    w.add(b); fl.parkBoot = b; fl.bootVorlage = o;
  });
  // Polizeiboote (zwei Klone), warten an ihren Plaetzen
  ladeGlb(window.FLUCHT_POLIZEI_GLB, (o) => {
    for(let i = 0; i < 2; i++){
      const b = normiere(i === 0 ? o : o.clone(true), 14, true);
      b.children[0].rotation.y += Math.PI;          // Bug zeigte nach +z (Live-Test: fuhr rueckwaerts) – vorne = -z
      // Blaulicht
      const licht = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3b82ff }));
      licht.position.y = 6; b.add(licht);
      w.add(b);
      fl.polizei.push({ obj: b, licht, x: 0, z: 0, yaw: 0, v: 0, aktiv: false, spurI: 0 });
    }
    polizeiParken();
  });
}

// ---- Start, Polizei ---------------------------------------------------------------------------
const START = { x: 24, z: -110, yaw: 0 };           // vor dem Kai, Bug nach -z (Engine: vorne = -z) zum Kanal
function polizeiParken(){
  if(fl.polizei.length < 2) return;
  const p1 = fl.polizei[0], p2 = fl.polizei[1];
  Object.assign(p1, { x: 40, z: -20, yaw: 0, v: 0, aktiv: false, spurI: 0, px: 40, pz: -20 });   // im Becken hinter Kenji
  Object.assign(p2, { x: mitteX(ARM.z) + KANAL_B / 2 + 40, z: ARM.z, yaw: Math.PI / 2, v: 0, aktiv: false, spurI: 0, wartet: true });
  for(const p of fl.polizei){ p.obj.position.set(p.x, -0.6, p.z); p.obj.rotation.y = p.yaw; }
}
// Kenjis Spur (alle 4 m ein Punkt): Polizei 1 faehrt sie nach
const spur = [];
function spurMerken(){
  const l = spur[spur.length - 1];
  if(!l || Math.hypot(state.pos.x - l.x, state.pos.z - l.z) > 4) spur.push({ x: state.pos.x, z: state.pos.z });
}

// Fahrwerte: Rennboot schnell, Ruder je Fahrt (wie Etappe 3, aber wendiger – Kurve 1 haarscharf)
// Schwerer als das Feuerwehrboot (Live-Wunsch): steiferes Ruder bei Tempo (0,26), mehr Querrutschen (0,4).
// 150 km/h (41,7 m/s). Ruder: langsam wendig (0,8), bei Tempo steif (0,22 ab 30 m/s) – Vollgas-Wendekreis 211 m,
// keine Kurve geht mit Vollgas.
// Querrutschen klingt langsamer ab (0,3; Feuerwehrboot 0,45).
const RB = { vMax: 41.7, accel: 8, ruderMin: 0.22, ruderMax: 0.8, quer: 0.3, vRef: 30 };
// Polizei kennt den Kanal (abgestimmt mit dem Bot, C:\tmp\sfg\test_e4bot.js)
const POL = { v1: 41, v2: 33, aq: 5 };               // Boot 2 deutlich langsamer (Live-Test: zu stark), nur Druck von hinten
// Kurventempo nach Radius: v = Wurzel(aq * R), 40 m Vorausschau. Vorher galt "Kurve" schon ab kleinster
// Kruemmung -> 86 % des Kanals mit 20 m/s (72 km/h); Live-Test: mit 50 % Schub (75 km/h) 260 m Vorsprung.
// Ziel (Risiko-Variante): nur perfekt gefahren (Vollgas, vor jeder Kurve passend runter) knapp entkommen.
// C:\tmp\e4perfekt.js: perfekt = Kurventempo aus Wendekreis*1,25 <= Radius -> 62 s, Boot 1 am Ziel ~58 m
// hinter Kenji (Boot 2 ~140 m). Je 10 % schlechter in den Kurven ~ 3 s / 60 m mehr -> eingeholt.
function kanalRadius(z){ const d1 = (mitteX(z - 2) - mitteX(z + 2)) / 4, d2 = (mitteX(z - 2) - 2 * mitteX(z) + mitteX(z + 2)) / 4;
  return Math.pow(1 + d1 * d1, 1.5) / Math.max(1e-9, Math.abs(d2)); }
story.flucht4.POL = POL;                             // fuer den Bot (C:\tmp\sfg\test_e4bot2.js)
function polizeiTempo(z, vMax){ let v = vMax; for(let l = 0; l <= 40; l += 5) v = Math.min(v, Math.sqrt(POL.aq * kanalRadius(z - l)) + l * 0.3); return v; }
const FANG_R = 15, KONTAKT_MAX = 2;                  // Fang-Abstand 15 m (vorher 20) – mehr Toleranz
function ruderFaktor(){ const v = Math.hypot(state.vel.x, state.vel.z), k = Math.min(1, v / RB.vRef); return RB.ruderMax - (RB.ruderMax - RB.ruderMin) * k; }

// Risiko-Variante: keine Erklaerung, wie man faehrt (Live-Wunsch). Nur der Ruf der Polizei.
const FLUCHT_TEXT = [ 'Halt! Polizei! Stehen bleiben!' ];
function fluchtStart(){
  story.phase = 'flucht';
  Object.assign(fl, { aktiv: true, fertig: false, laeuft: false, t: 0, kontakte: 0, cool: 0 });
  spur.length = 0;
  const idx = MODEL_NAMES.indexOf('Boat');
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = 'Schnellboot';
  buildModel('Boat');
  // Rennboot statt Feuerwehrboot: Modell tauschen
  // In den modelHolder der Engine (wie buildModel), NICHT planeGroup leeren: sonst hing der Halter danach nicht mehr
  // im Flieger, und in Etappe 5 sah man in der Mustang das Rennboot (Live-Bild).
  if(fl.bootVorlage){ while(modelHolder.children.length) modelHolder.remove(modelHolder.children[0]);
    const b = normiere(fl.bootVorlage.clone(true), 13, false); b.position.y = BOAT_DRAFT - 0.5;
    b.rotation.y = Math.PI;                          // Modell hat den Bug bei +z, die Engine faehrt nach -z (Live-Test)
    modelHolder.add(b); }
  spec = Object.assign({}, PLANE_SPECS.Boat || DEFAULT_SPEC, { vMax: RB.vMax, accel: RB.accel });
  state.pos.set(START.x, 0, START.z);
  state.quat.setFromEuler(new THREE.Euler(0, START.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  planeGroup.visible = true;                         // hafenStart blendet den X-Wing aus – das Boot muss zu sehen sein
  if(fl.parkBoot) fl.parkBoot.visible = false;
  polizeiParken();
  snapCamera();
  story.hinweis('');
  fluchtHud();
  // Sirene + Ansage, dann geht es los (Polizei startet 3 s spaeter)
  fl.rede = story.sprich(FLUCHT_TEXT, () => {
    fl.laeuft = true;
    story.hinweis('Durch den Kanal aufs Meer – gelbe Bojen!');
    story.spaeter(6, () => { if(fl.aktiv) story.hinweis(''); });
    story.spaeter(1.5, () => { if(fl.aktiv && fl.polizei[0]) fl.polizei[0].aktiv = true; });
  }, 'pilot');
}

// ---- Pro Bild --------------------------------------------------------------------------------
let quer = 0;
function fluchtPhysik(dt, inp, physOrig){
  const vorX = state.vel.x, vorZ = state.vel.z;
  const r = physOrig(dt, Object.assign({}, inp, { yaw: (inp.yaw || 0) * ruderFaktor() }));
  // Querschlupf zurueckgeben (stepBoat baut ihn mit 4/s ab) – das Boot rutscht in der Kurve
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat), sx = -fwd.z, sz = fwd.x;
  const ziel = (vorX * sx + vorZ * sz) * Math.exp(-RB.quer * dt), jetzt = state.vel.x * sx + state.vel.z * sz, add = ziel - jetzt;
  const nx = state.pos.x + sx * add * dt, nz = state.pos.z + sz * add * dt;
  if(nass(nx, nz, BOAT_HALF_W)){ state.vel.x += sx * add; state.vel.z += sz * add; state.pos.x = nx; state.pos.z = nz; }
  else { state.vel.x -= sx * jetzt; state.vel.z -= sz * jetzt; }             // an der Mauer: Querfahrt weg
  // Ufer / Kaimauer kostet Fahrt
  // Bug an der Mauer: Fahrt fast ganz weg (wie Feuerwehrboot, Vorausschau mit dem Tempo)
  const vor = 6 + Math.hypot(state.vel.x, state.vel.z) * 0.15;
  if(!nass(state.pos.x + fwd.x * vor, state.pos.z + fwd.z * vor, BOAT_HALF_W * 0.5)){
    state.vel.multiplyScalar(Math.max(0, 1 - 4.5 * dt));
    // Live-Wunsch: das Ufer zaehlt wie ein Felsen (1,5 s Ruhe, sonst zaehlte ein Schrammen mehrfach)
    if(fl.laeuft && fl.cool <= 0){ fl.cool = 1.5; kontakt('Autsch, die Mauer!'); }
  }
  fl.mauerT = Math.max(0, (fl.mauerT || 0) - dt);
  planeGroup.position.copy(state.pos);
  return r;
}
// Felsen oder Ufer beruehrt: zaehlt, beim dritten ist das Boot hin
function kontakt(erster){
  if(typeof rumble === 'function') rumble(300, 1, 0.7);
  fl.kontakte++;
  if(fl.kontakte > KONTAKT_MAX){ fluchtEnde(false, 'zerschellt'); return; }
  story.sprich([fl.kontakte === 1 ? erster : 'Noch einer! Beim nächsten ist das Boot hin.'], null, 'pilot');
}
function fluchtUpdate(dt){
  if(!fl.aktiv) return;
  sirenenUpdate(dt);
  spurMerken();
  // Felsen
  fl.cool = Math.max(0, fl.cool - dt);
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  for(const f of FELSEN){
    let hit = false;
    for(const s of [5, 0, -5]) if(Math.hypot(state.pos.x + fwd.x * s - f.x, state.pos.z + fwd.z * s - f.z) < f.r + 1.8){ hit = true; break; }
    if(!hit) continue;
    const dx = state.pos.x - f.x, dz = state.pos.z - f.z, d = Math.hypot(dx, dz) || 1, soll = f.r + 5;
    if(d < soll){ state.pos.x = f.x + dx / d * soll; state.pos.z = f.z + dz / d * soll; }
    if(fl.cool <= 0){
      fl.cool = 1.5; state.vel.multiplyScalar(-0.3);
      if(typeof rumble === 'function') rumble(300, 1, 0.7);
      if(fl.laeuft){ kontakt('Autsch, ein Felsen!'); if(fl.fertig) return; }
    }
    planeGroup.position.copy(state.pos);
  }
  // Stroemung: im Kanal nach -z (in der Mitte voll, zur Mauer schwaecher), schiebt Kenji wie die Polizei
  if(imKanal(state.pos.x, state.pos.z)){
    const L = lage(state.pos.x, state.pos.z), k = 1 - Math.min(1, Math.abs(L.d) / (KANAL_B / 2)) * 0.6;
    const nx = state.pos.x + L.rx * STROM_V * k * dt, nz = state.pos.z + L.rz * STROM_V * k * dt;
    if(nass(nx, nz, BOAT_HALF_W)){ state.pos.x = nx; state.pos.z = nz; planeGroup.position.copy(state.pos); }
  }
  if(fl.laeuft){
    fl.t += dt;
    polizeiUpdate(dt);
    // Ziel: Muendung
    if(state.pos.z < ZIEL_Z + 10 && Math.abs(state.pos.x - mitteX(KANAL_Z1)) < 40){ fluchtEnde(true, 'entkommen'); return; }
  }
  fluchtHud();
}
// Polizei: faehrt AUF DER KANALLINIE (sie kennt den Kanal). Vorher fuhr Boot 1 Kenjis Spur nach – stand
// Kenji, blieb es am letzten Spurpunkt stehen (Live-Test: Abstand blieb konstant), und in Kurven klebte
// es an der Mauer (es bewegte sich nur, wenn der naechste Schritt nass war: 300 m Vorsprung nach Kurve 2).
// Jetzt: Position z entlang des Kanals, x = Kanalmitte + Querversatz zu Kenji hin. Bremst nur in Kurven.
// Unter NAH m faehrt sie direkt auf Kenji zu – wer steht, wird eingeholt.
const NAH = 60;                                      // direkt auf Kenji zu erst unter 60 m (vorher 90)
// Stroemung Richtung Muendung (nach -z) im Kanal; im Becken still
const STROM_V = 2.5;
function polizeiFahre(p, vSoll, dt){
  p.v += Math.sign(vSoll - p.v) * Math.min(Math.abs(vSoll - p.v), 6 * dt);
  const dz = state.pos.z - p.z, d = Math.hypot(state.pos.x - p.x, dz);
  if(d < NAH){
    // direkt auf Kenji zu
    const ux = (state.pos.x - p.x) / (d || 1), uz = dz / (d || 1);
    p.x += ux * p.v * dt; p.z += uz * p.v * dt;
  } else {
    // entlang des Kanals Richtung Kenji (nach -z), seitlich langsam zu seiner Querlage
    p.z -= p.v * dt * Math.sign(-dz || -1);
    const L = lage(mitteX(p.z), p.z), quer = Math.max(-KANAL_B / 2 + 6, Math.min(KANAL_B / 2 - 6, lage(state.pos.x, state.pos.z).d));
    const zielX = mitteX(p.z) + (-L.rz) * quer * 0.5;
    p.x += (zielX - p.x) * Math.min(1, 1.5 * dt);
  }
  // Fahrtrichtung fuers Modell
  const vx = p.x - (p.px ?? p.x), vz = p.z - (p.pz ?? p.z);
  if(Math.hypot(vx, vz) > 0.01) p.yaw = Math.atan2(-vx, -vz);
  p.px = p.x; p.pz = p.z;
}
function polizeiUpdate(dt){
  const t = performance.now() / 1000;
  for(const [i, p] of fl.polizei.entries()){
    p.licht.material.color.set(Math.floor(t * 4 + i) % 2 ? 0x3b82ff : 0xff3030);
    // Boot 2 schiesst erst heraus, wenn Kenji an der Einfahrt VORBEI ist – es wird zum zweiten Verfolger hinter
    // ihm (Live-Test: startete 140 m davor und stand ihm im Weg, man konnte nicht entkommen)
    if(i === 1 && p.wartet && state.pos.z < ARM.z - 30){ p.wartet = false; p.aktiv = true; p.v = 10; p.ausArm = true; }
    if(!p.aktiv) continue;
    if(p.ausArm){
      // Boot 2: erst aus dem Seitenarm auf die Kanalmitte
      const zx = mitteX(ARM.z);
      p.v += Math.sign(POL.v2 * 0.6 - p.v) * Math.min(Math.abs(POL.v2 * 0.6 - p.v), 6 * dt);
      p.x -= p.v * dt;
      p.yaw = Math.PI / 2;
      if(p.x <= zx + 2){ p.ausArm = false; p.px = p.x; p.pz = p.z; }
    } else {
      polizeiFahre(p, polizeiTempo(p.z, i === 0 ? POL.v1 : POL.v2), dt);
      p.z -= STROM_V * dt;                       // Stroemung traegt auch die Polizei
    }
    p.obj.position.set(p.x, -0.6, p.z); p.obj.rotation.y = p.yaw;
    if(Math.hypot(p.x - state.pos.x, p.z - state.pos.z) < FANG_R){ fluchtEnde(false, 'eingeholt'); return; }
  }
}
// ---- Sirenen: je Polizeiboot ein auf- und abschwellendes Heulen, je naeher desto lauter --------
// Live-Wunsch: Druck machen, aber nicht zu laut. Hoechstens SIRENE_MAX (Engine-Feuerwehr: 0,06), ab
// SIRENE_WEIT m still. Das Heulen macht ein langsamer Oszillator (kein setInterval – laeuft nicht in der
// Pause weiter). Stereo-Panner: man hoert, ob das Boot links oder rechts ist. Laeuft ueber
// audioCtx.destination = Master-Gain der Story, der Globus blendet es also mit aus.
const SIRENE_MAX = 0.07, SIRENE_WEIT = 420;
function sireneNeu(){
  if(!audioCtx) return null;
  const osc = audioCtx.createOscillator(), lfo = audioCtx.createOscillator(), tiefe = audioCtx.createGain();
  const filt = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
  const pan = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  osc.type = 'sawtooth'; osc.frequency.value = 760;
  lfo.type = 'sine'; lfo.frequency.value = 0.55 + Math.random() * 0.15;   // ein Heulen ~1,7 s, je Boot leicht anders
  tiefe.gain.value = 260;                                                  // 500..1020 Hz
  lfo.connect(tiefe).connect(osc.frequency);
  filt.type = 'lowpass'; filt.frequency.value = 1800;                      // weniger schrill
  gain.gain.value = 0;
  osc.connect(filt).connect(gain);
  if(pan){ gain.connect(pan).connect(audioCtx.destination); } else gain.connect(audioCtx.destination);
  osc.start(); lfo.start();
  return { osc, lfo, gain, pan };
}
function sireneAus(s){ if(!s) return; try { s.osc.stop(); s.lfo.stop(); } catch(e){} }
function sirenenUpdate(dt){
  const an = fl.aktiv && !fl.fertig && soundOn && !(story.globusAktiv && story.globusAktiv());
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat), rx = -fwd.z, rz = fwd.x;   // rechts vom Boot
  for(const p of fl.polizei){
    if(an && p.aktiv && !p.sirene) p.sirene = sireneNeu();
    if(!p.sirene) continue;
    const dx = p.x - state.pos.x, dz = p.z - state.pos.z, d = Math.hypot(dx, dz);
    const k = Math.max(0, 1 - d / SIRENE_WEIT);
    const ziel = an && p.aktiv ? SIRENE_MAX * k * k : 0;                  // quadratisch: nah deutlich lauter
    p.sirene.gain.gain.value += (ziel - p.sirene.gain.gain.value) * Math.min(1, 4 * dt);
    if(p.sirene.pan) p.sirene.pan.pan.value = Math.max(-1, Math.min(1, (dx * rx + dz * rz) / Math.max(d, 1) * 0.8));
  }
}
function sirenenStopp(){ for(const p of fl.polizei){ sireneAus(p.sirene); p.sirene = null; } }
function naechstePolizei(){ let b = Infinity; for(const p of fl.polizei) if(p.aktiv) b = Math.min(b, Math.hypot(p.x - state.pos.x, p.z - state.pos.z)); return b; }

const GEFAENGNIS = [
  'Halt, Polizei! Das war\'s mit der Flucht.',
  'Kenji muss mit auf die Wache. Ein geklautes Boot ist kein Spaß.',
  'Nach einer Woche im Gefängnis darf er wieder gehen. Er hat viel Zeit gehabt, über alles nachzudenken.',
];
function fluchtEnde(ok, wie){
  if(fl.fertig) return;
  fl.fertig = true; fl.laeuft = false;
  // Sirenen: entkommen -> ueber 2 s ausblenden; eingeholt -> bleiben bis zum Globus (die Polizei ist ja da)
  for(const p of fl.polizei) if(p.sirene && audioCtx){ const g = p.sirene.gain.gain, t = audioCtx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(ok ? 0 : SIRENE_MAX * 0.8, t + (ok ? 2 : 0.5)); }
  state.throttle = 0;
  if(fl.rede) fl.rede.abbrechen();
  const weiter = () => story.spaeter(1, () => {
    sirenenStopp();
    fl.aktiv = false; fluchtHud(); story.hinweis('');
    story.etappeEnde(ok ? 1 : 7, ok ? 'mit dem Schnellboot' : (wie === 'zerschellt' ? 'Boot zerschellt, Gefängnis' : 'eingeholt, Gefängnis'));
  });
  if(ok){ story.sprich(['Geschafft! Die Polizei ist weit hinten. Ab aufs offene Meer!'], weiter, 'pilot'); return; }
  story.sprich([wie === 'zerschellt' ? 'Krach! Das Boot ist am Felsen zerschellt, und schon ist die Polizei da.' : GEFAENGNIS[0]].concat(GEFAENGNIS.slice(1)), weiter, 'pilot');
}

// ---- HUD ------------------------------------------------------------------------------------
function fluchtHud(){
  if(!fl.hudEl){
    fl.hudEl = document.createElement('div'); fl.hudEl.dataset.etappeHud = '1';
    fl.hudEl.style.cssText = 'position:absolute;left:50%;top:56px;transform:translateX(-50%);padding:8px 16px;border-radius:10px;'
      + 'background:rgba(0,0,0,.72);color:#fff;font:600 18px system-ui,sans-serif;pointer-events:none;z-index:20;white-space:nowrap;';
    document.body.appendChild(fl.hudEl);
  }
  if(!fl.aktiv || !e4()){ fl.hudEl.style.display = 'none'; return; }   // nach dem Etappenwechsel nicht stehen lassen
  fl.hudEl.style.display = '';
  const pol = naechstePolizei(), weg = Math.max(0, state.pos.z - ZIEL_Z);
  const polTxt = pol === Infinity ? '🚓 —' : '🚓 <span style="color:' + (pol < 60 ? '#ff5a3c' : pol < 120 ? '#ffd23f' : '#fff') + '">' + Math.round(pol) + ' m</span>';
  const fels = '🪨'.repeat(fl.kontakte) + '·'.repeat(Math.max(0, KONTAKT_MAX + 1 - fl.kontakte));
  const html = polTxt + '  ·  🏁 ' + Math.round(weg) + ' m  ·  ' + fels;
  if(fl.hudEl._h !== html){ fl.hudEl.innerHTML = html; fl.hudEl._h = html; }
}

// ---- Hooks -----------------------------------------------------------------------------------
function hookFlucht(){
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(hier() && !story.phase && story.bootNah4 && story.bootNah4()){ fluchtStart(); return; }
    return boardYOrig.apply(this, arguments);
  };
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(!(hier() && fl.aktiv)) return physOrig.apply(this, arguments);
    if(!fl.laeuft && !fl.fertig){ state.vel.set(0, 0, 0); state.throttle = 0; planeGroup.position.copy(state.pos); return; }
    const r = fluchtPhysik(dt, inp, (d, i) => physOrig.call(this, d, i));
    fluchtUpdate(dt);
    return r;
  };
  const buttonYOrig = buttonY;
  buttonY = function(){ if(hier() && fl.aktiv) return; return buttonYOrig.apply(this, arguments); };
  // Das Schnellboot laeuft intern als Engine-Modell 'Boat' – B wuerde den Loeschstrahl des Feuerwehrboots
  // ausloesen (Live-Test: es spritzte Wasser). Waehrend der Flucht hat B keine Aufgabe.
  const buttonBOrig = buttonB;
  buttonB = function(){ if(hier() && fl.aktiv) return; return buttonBOrig.apply(this, arguments); };
  const activeOrig = activeTarget;
  activeTarget = function(){
    if(hier() && fl.aktiv) return { x: mitteX(KANAL_Z1), z: ZIEL_Z, col: '#ffd23f' };
    return activeOrig.apply(this, arguments);
  };
}
story.fluchtKulisse = baueKulisse;
story.aufgabeE4b = () => fl.aktiv ? ['Schnellboot-Flucht', [
  ['Ziel', 'durch den Kanal aufs Meer (gelbe Bojen)'],
  ['Polizei', 'nicht einholen lassen'],
  ['Felsen/Ufer', fl.kontakte + ' von ' + KONTAKT_MAX + ' erlaubt'],
]] : null;

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookFlucht();
};
})();
