// Trip to Japan – Etappe 1 als Festland (Live-Wunsch 09.10.2026, Vorbild Fukuoka-Beach aus etappe6.js). Laedt nach story.js.
// Statt der runden Startinsel: Meer im Westen (U-Boot, Wracks, Schiffe, Orcas), Strand (etwas dunkler), Wiese mit
// Nadelbaeumen, die Schule "AEG" als festes Gebaeude, dahinter eine Stadt (ohne Gleise), die Ariane schraeg hinter der Schule.
// Am Strand ein kleiner Parkplatz mit dem X-Wing, daneben der U-Boot-Ring, das U-Boot draussen im Wasser.
// Die Engine-Startinsel (Zelle 0,0) bleibt als Rechengrundlage (islandInfo, harborSubLocal: Liegeplatz, Einstieg, Wracks),
// wird aber nicht gebaut und zaehlt nicht als Land; Land ist allein das Festland. Das Sonar zeigt damit eine Kueste.
(function(){
'use strict';
const story = window.STORY;
function e1(){ return story.etappe === 1; }
function hier(){ return e1() && locale === 'earth'; }

// ---- Lage (Blick von der Schultuer aufs Meer = -x) ------------------------------------------------------
const FEST = { x: -60, z: 0, strand: 60, R: 6000 };          // Kueste bei x = -60, Strand bis x = 0, dann Wiese
const FEST_MX = FEST.x + FEST.R, FEST_MZ = FEST.z;
function festland(x, z){ return Math.hypot(x - FEST_MX, z - FEST_MZ) < FEST.R + 20; }      // inkl. Sand bis zur Wasserlinie
function aufWiese(x, z){ return Math.hypot(x - FEST_MX, z - FEST_MZ) < FEST.R - FEST.strand; }
const RING1  = { x: FEST.x + 38, z: 0, nx: -1, nz: 0 };       // U-Boot-Ring im Sand, ~38 m vor dem Wasser
const UBOOT1 = { x: FEST.x - 100, z: 0, rot: Math.PI / 2 };   // U-Boot draussen, Bug aufs Meer (-x)
const XWING1 = { x: FEST.x + 32, z: 75, yaw: Math.PI / 2 };   // X-Wing auf dem kleinen Parkplatz am Strand, Nase zum Meer
const PARK1  = { x: XWING1.x, z: XWING1.z, b: 26, l: 26 };
const SCHULE = { x: 30, z: 0, yaw: Math.PI / 2, B: 32, T: 14 };   // Tuer zum Meer (-x)
const START1 = { x: SCHULE.x - SCHULE.T / 2 - 1.5, z: 0, yaw: Math.PI / 2 };   // Schultuer, Kenji schaut aufs Meer
const ARIANE = { x: 75, z: -62 };                             // schraeg hinter der Schule
const STADT  = { x0: 110, x1: 430, z0: -420, z1: 420 };
story.e1 = { FEST, RING1, UBOOT1, XWING1, SCHULE, START1, ARIANE, festland };

// ---- Kollision: Schule, Stadt, Ariane (Kenji laeuft nicht hindurch; Flieger stossen dagegen) -----------------------
const feste = [];                                              // { x, z, hx, hz, h, rot }
function trifftFest(x, y, z){
  for(const f of feste){
    if(y > ISLAND_Y + f.h) continue;
    const dx = x - f.x, dz = z - f.z, c = Math.cos(f.rot), s = Math.sin(f.rot);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;          // in Gebaeude-Achsen
    if(Math.abs(lx) < f.hx && Math.abs(lz) < f.hz) return true;
  }
  return false;
}

// ---- Welt bauen ----------------------------------------------------------------------------------------------
const welt = { gebaut: false, uboot: null, xwing: null, ariane: null };
function baueWelt(){
  if(welt.gebaut) return; welt.gebaut = true;
  const w = story.welt(1);
  baueBoden(w);
  baueParkplatz(w);
  baueNadelbaeume(w);
  baueStadt(w);
  feste.push({ x: SCHULE.x, z: SCHULE.z, hx: SCHULE.T / 2 + 0.3, hz: SCHULE.B / 2 + 0.3, h: 10, rot: 0 });   // Schule (quer zum Meer)
}
// Strand etwas dunkler als in Fukuoka (eigenes Material, Live-Wunsch), Wiese mit der Engine-Graskachel
function baueBoden(w){
  const sand = new THREE.Mesh(new THREE.RingGeometry(FEST.R - FEST.strand - 5, FEST.R + 20, 256, 1), new THREE.MeshLambertMaterial({ color: 0xa8955e }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(FEST_MX, ISLAND_Y - 0.05, FEST_MZ); w.add(sand);
  const wg = new THREE.CircleGeometry(FEST.R - FEST.strand, 256), uv = wg.attributes.uv, p = wg.attributes.position;
  for(let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + FEST_MX) / GRASS_TILE_M, (p.getY(i) - FEST_MZ) / GRASS_TILE_M);
  const wiese = new THREE.Mesh(wg, grassMat);
  wiese.rotation.x = -Math.PI / 2; wiese.position.set(FEST_MX, ISLAND_Y, FEST_MZ);
  wiese.userData.fremd = true; w.add(wiese);
}
function baueParkplatz(w){
  const beton = new THREE.Mesh(new THREE.PlaneGeometry(PARK1.b, PARK1.l), new THREE.MeshLambertMaterial({ color: 0x8a8a86 }));
  beton.rotation.x = -Math.PI / 2; beton.position.set(PARK1.x, ISLAND_Y + 0.03, PARK1.z); w.add(beton);
  const lin = new THREE.MeshLambertMaterial({ color: 0xffffff });
  for(const s of [-1, 1]){ const l = new THREE.Mesh(new THREE.PlaneGeometry(0.4, PARK1.l - 2), lin); l.rotation.x = -Math.PI / 2; l.position.set(PARK1.x + s * (PARK1.b / 2 - 1), ISLAND_Y + 0.05, PARK1.z); w.add(l); }
}
// Nadelbaeume (Kegel, zwei Gruentoene + Stamm) links und rechts vom Startbereich, nicht auf dem Strand, nicht in der Stadt
function baueNadelbaeume(w){
  let sd = 1701; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const kr = [0x2f5e2a, 0x3b6e30, 0x264f24].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const stamm = new THREE.MeshLambertMaterial({ color: 0x5a3e26 });
  const kegelG = new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0), stammG = new THREE.CylinderGeometry(0.18, 0.24, 1, 6).translate(0, 0.5, 0);
  const N = 420, inst = kr.map(m => new THREE.InstancedMesh(kegelG, m, N)), st = new THREE.InstancedMesh(stammG, stamm, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), y = new THREE.Vector3(0, 1, 0);
  const n = [0, 0, 0]; let ns = 0;
  for(let i = 0; i < N * 4 && ns < N; i++){
    const z = (rnd() - 0.5) * 2400, x = 6 + rnd() * 300;
    if(Math.abs(z) < 110 && x < STADT.x0) continue;                 // Startbereich (Schule, Ring, X-Wing, Ariane) frei
    if(x > STADT.x0 - 10 && Math.abs(z) < STADT.z1 + 10) continue;   // Stadt frei
    if(!aufWiese(x, z)) continue;
    const h = 8 + rnd() * 10, k = Math.floor(rnd() * 3);
    q.setFromAxisAngle(y, rnd() * 6.28);
    sc.set(h * 0.28, h * 0.85, h * 0.28); ps.set(x, ISLAND_Y + h * 0.15, z); m4.compose(ps, q, sc); inst[k].setMatrixAt(n[k]++, m4);
    sc.set(1, h * 0.2, 1); ps.set(x, ISLAND_Y, z); m4.compose(ps, q, sc); st.setMatrixAt(ns++, m4);
  }
  inst.forEach((m, k) => { m.count = n[k]; m.frustumCulled = false; w.add(m); }); st.count = ns; st.frustumCulled = false; w.add(st);
}
// Stadt hinter der Schule: Raster wie in Fukuoka, zur Schule hin niedriger, keine Gleise
function baueStadt(w){
  const box = new THREE.BoxGeometry(1, 1, 1), kegel = new THREE.ConeGeometry(0.75, 1, 4);
  const wand = [0xe6dccb, 0xd5c2a2, 0xcfdbe6, 0xeed3c2, 0xc0c7ce].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const dach = [0x5f6068, 0x3d4f66, 0x8a5a3a, 0xa83c2e].map(c => new THREE.MeshLambertMaterial({ color: c }));
  const turm = [0x9aa7b4, 0x6f7f8f, 0xc9d2da, 0x8fa3b8].map(c => new THREE.MeshLambertMaterial({ color: c }));
  let sd = 3131; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const RASTER = 34;
  for(let x = STADT.x0; x < STADT.x1; x += RASTER) for(let z = STADT.z0; z < STADT.z1; z += RASTER){
    if(rnd() < 0.12) continue;
    const cx = x + RASTER / 2 + (rnd() - 0.5) * 4, cz = z + RASTER / 2 + (rnd() - 0.5) * 4;
    if(Math.hypot(cx - ARIANE.x, cz - ARIANE.z) < 40) continue;      // Platz um die Rampe
    const tief = (x - STADT.x0) / (STADT.x1 - STADT.x0), hoch = rnd() < 0.06 + tief * 0.3;
    const b = hoch ? 14 + rnd() * 8 : 9 + rnd() * 7, t = hoch ? 14 + rnd() * 8 : 9 + rnd() * 7;
    const h = hoch ? 28 + rnd() * (35 + tief * 45) : 5 + rnd() * 7;
    const k = new THREE.Mesh(box, hoch ? turm[Math.floor(rnd() * turm.length)] : wand[Math.floor(rnd() * wand.length)]);
    k.scale.set(b, h, t); k.position.set(cx, ISLAND_Y + h / 2, cz); w.add(k);
    if(!hoch){ const d = new THREE.Mesh(kegel, dach[Math.floor(rnd() * dach.length)]); d.scale.set(Math.max(b, t), 3, Math.max(b, t)); d.rotation.y = Math.PI / 4; d.position.set(cx, ISLAND_Y + h + 1.5, cz); w.add(d); }
    feste.push({ x: cx, z: cz, hx: b / 2 + 0.3, hz: t / 2 + 0.3, h: h + (hoch ? 0 : 3), rot: 0 });
  }
}
// Modelle aus den Engine-Vorlagen, sobald sie geladen sind (U-Boot, X-Wing geparkt, Ariane mit Rampe)
function stelleModelle(){
  const w = story.welt(1);
  if(!welt.uboot && typeof shipTemplates !== 'undefined' && shipTemplates.sub && !isSub()){
    const o = shipTemplates.sub.clone(true); o.position.set(UBOOT1.x, 0, UBOOT1.z); o.rotation.y = UBOOT1.rot;
    o.userData.fremd = true; w.add(o); welt.uboot = o;
  }
  if(welt.uboot) welt.uboot.visible = !isSub();
  if(!welt.ariane && typeof rocketTemplate !== 'undefined' && rocketTemplate && padTemplate){
    const g = new THREE.Group(); g.add(padTemplate.clone(true)); const r = rocketTemplate.clone(true); g.add(r);
    g.position.set(ARIANE.x, ISLAND_Y, ARIANE.z); g.userData.fremd = true; w.add(g); welt.ariane = g;
    feste.push({ x: ARIANE.x, z: ARIANE.z, hx: 7, hz: 7, h: 62, rot: 0 });
  }
}

// ---- Hooks ----------------------------------------------------------------------------------------------------
function hookE1(){
  // Startinsel nicht bauen (leere Gruppe): ihre Daten (Liegeplatz, Wracks) bleiben fuer die Engine-Rechnungen
  const buildOrig = buildIsland;
  buildIsland = function(cx, cz){ if(e1() && cx === 0 && cz === 0) return new THREE.Group(); return buildOrig.apply(this, arguments); };
  // Land = Festland. Die Startinsel zaehlt nicht (sonst laege eine runde Insel unter dem Meer, im Sonar, im Meeresgitter).
  const onLandOrig = isOnLand, beachOrig = isOnBeach, runwayOrig = isOnRunway, seaIslOrig = collectSeaIslands, sbIslOrig = collectSeabedIslands;
  isOnLand  = function(x, z){ if(hier()) return festland(x, z); return onLandOrig.apply(this, arguments); };
  isOnBeach = function(x, z){ if(hier()) return false; return beachOrig.apply(this, arguments); };   // der Sand gehoert zum Festland
  isOnRunway = function(x, z){ if(hier()) return false; return runwayOrig.apply(this, arguments); };
  collectSeaIslands = function(){ const r = seaIslOrig.apply(this, arguments);
    if(hier()){ _seaIslands.length = 0; const Rr = FEST.R, rs = Rr + 20, ra = rs + SHORE_FADE_W; _seaIslands.push(FEST_MX, FEST_MZ, rs, ra * ra, rs * rs); } return r; };
  const bedOrig = seabedY;
  seabedY = function(x, z, islands){ if(hier() && !islands) return bedOrig.call(this, x, z, [FEST_MX, FEST_MZ, FEST.R + 20]); return bedOrig.apply(this, arguments); };
  collectSeabedIslands = function(){ const r = sbIslOrig.apply(this, arguments); if(hier()){ _sbIslands.length = 0; _sbIslands.push(FEST_MX, FEST_MZ, FEST.R + 20); } return r; };
  // Gebaeude: Schule, Stadt, Ariane (Engine-Inselhaeuser gibt es keine)
  const hitsOrig = hitsBuilding;
  hitsBuilding = function(x, y, z){ if(hier()) return trifftFest(x, y, z); return hitsOrig.apply(this, arguments); };
  // U-Boot-Liegeplatz der Engine = UBOOT1 (Einstieg ueber den Ring nutzt harborSubLocal(0, 0))
  const subOrig = harborSubLocal;
  harborSubLocal = function(cx, cz){ if(e1() && cx === 0 && cz === 0){ const i = islandInfo(0, 0); return { x: UBOOT1.x - i.wx, z: UBOOT1.z - i.wz, rot: UBOOT1.rot }; } return subOrig.apply(this, arguments); };
  // X-Wing-Platz am Strand, Ring, Intro: feste Plaetze (story.js fragt diese Hooks)
  story.e1xwingPlatz = () => ({ x: XWING1.x, z: XWING1.z, yaw: XWING1.yaw });
  story.e1ringPlatz = () => RING1;
  story.e1introPlatz = () => ({ x: START1.x, z: START1.z, yaw: START1.yaw,
    schuleX: SCHULE.x, schuleZ: SCHULE.z, schuleYaw: SCHULE.yaw });
}
story.updateE1 = function(){ if(!hier()) return; baueWelt(); stelleModelle(); };
story.e1festlandBauen = baueWelt;

const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hookE1(); };
})();
