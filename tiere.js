// Trip to Japan – Tiere fuer mehrere Etappen: fliegende Moewen (1, 4, 5), Hunde (1), Pandas (5).
// Laedt nach story.js und den Modell-Dateien (moewe_glb.js, hund_glb.js, panda_glb.js), vor der Engine.
// Jedes Tier ist ein eigener Klon mit eigenem Skelett (cloneSkinned der Engine) und eigenem Mixer mit Zeitversatz.
// Die sitzenden Moewen am Kai (Etappe 4) und Kamele/Schildkroeten (Etappe 2/3) stehen weiter in ihren Etappen-Dateien.
(function(){
'use strict';
const story = window.STORY;

// ---- Laden: einmal je Modell, gemessen in der gehaeuteten Haltung -------------------------------------
// Die Bindepose-Box eines Skinned Mesh passt nicht zur animierten Haltung (Moewe: Fluegel ausgebreitet) – deshalb
// nach dem ersten Animationsschritt ueber boneTransform messen. mass = Zielmass auf der Achse 'x' | 'z' | 'y'.
const vorlagen = {};
function vorlage(name, daten, mass, achse, clipName, fertig){
  const v = vorlagen[name];
  if(v){ if(v.tpl) fertig(v); else v.warten.push(fertig); return; }
  const neu = vorlagen[name] = { tpl: null, clips: [], warten: [fertig] };
  if(!daten || !THREE.GLTFLoader) return;
  const b64 = daten.split(',')[1], bin = atob(b64), bytes = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  new THREE.GLTFLoader().parse(bytes.buffer, '', (g) => {
    const obj = g.scene;
    obj.traverse(o => { if(o.isMesh){ o.frustumCulled = false; o.castShadow = false; } });
    const clip = (clipName && g.animations.find(a => a.name === clipName)) || g.animations[0];
    const mx = new THREE.AnimationMixer(obj); if(clip) mx.clipAction(clip).play(); mx.update(0.01);
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3(), p = new THREE.Vector3();
    obj.traverse(m => { if(!m.isSkinnedMesh) return; const n = m.geometry.attributes.position.count;
      for(let i = 0; i < n; i += 3){ m.boneTransform(i, p); p.applyMatrix4(m.matrixWorld); bb.expandByPoint(p); } });
    if(bb.isEmpty()) bb.setFromObject(obj);
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const k = mass / (achse === 'x' ? sz.x : achse === 'y' ? sz.y : sz.z);
    obj.scale.multiplyScalar(k);
    obj.position.set(-c.x * k, -bb.min.y * k, -c.z * k);    // mittig, Fuesse auf y = 0
    mx.stopAllAction(); mx.uncacheRoot(obj);
    const tpl = new THREE.Group(); tpl.add(obj);
    neu.tpl = tpl; neu.clips = g.animations; neu.clip = clip;
    for(const f of neu.warten) f(neu);
    neu.warten.length = 0;
  }, (e) => console.warn('Tier-Modell ' + name, e));
}
// Live-Feedback: Godzillas zu dunkel – die Textur ist in godzilla_glb.js aufgehellt; hier nur matt (keine Spiegelung)
function godzillaHell(v){
  if(v.hell) return; v.hell = true;
  v.tpl.traverse(o => { if(o.isMesh && o.material){ const ms = Array.isArray(o.material) ? o.material : [o.material];
    for(const m of ms){ m.metalness = 0; m.roughness = 0.9; m.needsUpdate = true; } } });
}
function tierNeu(v, w, rnd, clipName){
  if(v === vorlagen.godzilla) godzillaHell(v);
  const k = cloneSkinned(v.tpl);
  w.add(k);
  const clip = (clipName && v.clips.find(a => a.name === clipName)) || v.clip;
  let mixer = null, aktion = null;
  if(clip){ mixer = new THREE.AnimationMixer(k); aktion = mixer.clipAction(clip); aktion.play(); mixer.setTime(rnd() * clip.duration); mixer.timeScale = 0.8 + rnd() * 0.4; }
  return { k, mixer, aktion, v };
}
function zufall(seed){ let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const SICHT = 500, ANIM = 180;                        // m: bis hier gezeichnet / bis hier animiert
function sichtAnim(o, dt){
  const cp = camera.position, d = Math.hypot(o.k.position.x - cp.x, o.k.position.z - cp.z);
  o.k.visible = locale === 'earth' && d < SICHT;
  if(o.k.visible && o.mixer && d < ANIM) o.mixer.update(dt);
}

// ---- Fliegende Moewen ---------------------------------------------------------------------------------
// Ring-Billed Gull - in Flight (Oregon State University Ecampus, CC-BY-4.0). Kopf im Modell auf +Z, Spannweite auf X.
// Live-Wunsch: die fliegenden in Etappe 4 "sind toll" – dieselben jetzt auch in Etappe 1 und 5.
// Spannweite 1,6 m (echt ~1,2 m; etwas groesser, damit man sie gegen den Himmel sieht).
const MOEWE_FLUG_B = 1.6;
const flieger = {};                                    // Etappe -> [Moewen]
// kreise: [{ x, z, r, y, n }] – je Kreis ein paar Tiere mit eigener Phase, ~8 m/s, leicht auf und ab
story.moewenKreise = function(n, w, kreise){
  const liste = flieger[n] = [];
  const rnd = zufall(71 + n);
  vorlage('moeweFlug', window.MOEWE_FLUG_GLB, MOEWE_FLUG_B, 'x', null, (v) => {
    if(story.etappe !== n || flieger[n] !== liste) return;
    for(const kr of kreise){
      const dreh = rnd() < 0.5 ? 1 : -1;
      for(let i = 0; i < kr.n; i++){
        const o = tierNeu(v, w, rnd);
        o.kreis = { x: kr.x, z: kr.z, r: kr.r * (0.8 + rnd() * 0.4), y: kr.y + (rnd() - 0.5) * 6,
          w: dreh * (7 + rnd() * 3) / kr.r, a: rnd() * Math.PI * 2, hub: 1 + rnd() * 2, t: rnd() * 10 };
        liste.push(o);
      }
    }
  });
};
function updateFlieger(n, dt){
  const liste = flieger[n]; if(!liste) return;
  for(const o of liste){
    const kr = o.kreis;
    kr.a += kr.w * dt; kr.t += dt;
    o.k.position.set(kr.x + Math.cos(kr.a) * kr.r, kr.y + Math.sin(kr.t * 0.7) * kr.hub, kr.z + Math.sin(kr.a) * kr.r);
    const vx = -Math.sin(kr.a) * kr.w, vz = Math.cos(kr.a) * kr.w;
    o.k.rotation.set(0, Math.atan2(vx, vz), 0);       // Kopf (+Z) in Flugrichtung
    o.k.rotateZ(Math.sign(kr.w) * 0.35);              // in die Kurve geneigt
    sichtAnim(o, dt);
  }
}

// ---- Bodentiere: Hunde (Etappe 1), Pandas (Etappe 5) -----------------------------------------------------
// Sie stehen, schauen herum und laufen ab und zu ein Stueck (Hund: walk/iddle, Panda: eine Animation, beim Gehen
// schneller abgespielt). frei(x, z) sagt, wo sie hinduerfen (Wiese, nicht auf Bahn/Ring/Fahrzeug).
const boden = {};                                      // Etappe -> [Tiere]
// opt: { name, daten, mass, achse, kopf ('z' | '-z'), gehen, stehen, tempo, n, gruppen: [{x, z, r, n}], y, frei }
story.bodenTiere = function(n, w, opt){
  const liste = boden[n] = boden[n] || [];
  const rnd = zufall(97 + n * 13 + liste.length);
  vorlage(opt.name, opt.daten, opt.mass, opt.achse, opt.stehen, (v) => {
    if(story.etappe !== n || boden[n] !== liste) return;
    for(const gr of opt.gruppen){
      for(let i = 0; i < gr.n; i++){
        let x = gr.x, z = gr.z;
        for(let t = 0; t < 12; t++){ const a = rnd() * Math.PI * 2, r = rnd() * gr.r; x = gr.x + Math.cos(a) * r; z = gr.z + Math.sin(a) * r; if(opt.frei(x, z)) break; }
        if(!opt.frei(x, z)) continue;
        const o = tierNeu(v, w, rnd, opt.stehen);
        o.k.position.set(x, opt.y, z);
        o.yaw = rnd() * Math.PI * 2; o.k.rotation.y = o.yaw + (opt.kopf === '-z' ? Math.PI : 0);
        o.k.scale.setScalar(0.9 + rnd() * 0.2);
        o.opt = opt; o.heim = { x: gr.x, z: gr.z, r: gr.r + 4 }; o.warte = 2 + rnd() * 6; o.ziel = null; o.rnd = rnd;
        liste.push(o);
      }
    }
  });
};
function gehAnim(o, gehen){
  const opt = o.opt, clip = gehen ? opt.gehen : opt.stehen;
  if(o.gehtJetzt === gehen) return;
  o.gehtJetzt = gehen;
  const c = (clip && o.v.clips.find(a => a.name === clip)) || null;
  if(c && o.mixer){ const neu = o.mixer.clipAction(c); if(neu !== o.aktion){ neu.reset().play(); if(o.aktion) o.aktion.crossFadeTo(neu, 0.3, false); o.aktion = neu; } }
  else if(o.mixer) o.mixer.timeScale = gehen ? 1.6 : 0.9;   // nur eine Animation: beim Gehen schneller
}
function updateBoden(n, dt){
  const liste = boden[n]; if(!liste) return;
  for(const o of liste){
    const opt = o.opt, p = o.k.position;
    if(o.ziel){
      const dx = o.ziel.x - p.x, dz = o.ziel.z - p.z, d = Math.hypot(dx, dz);
      if(d < 0.3){ o.ziel = null; o.warte = 3 + o.rnd() * 8; gehAnim(o, false); }
      else {
        // weich zum Ziel drehen, dann vorwaerts
        const soll = Math.atan2(dx, dz); let dy = soll - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        o.yaw += Math.max(-2 * dt, Math.min(2 * dt, dy));
        const s = Math.min(d, opt.tempo * dt) * Math.max(0, Math.cos(dy));
        const nx = p.x + Math.sin(o.yaw) * s, nz = p.z + Math.cos(o.yaw) * s;
        if(opt.frei(nx, nz)){ p.x = nx; p.z = nz; } else { o.ziel = null; o.warte = 1; gehAnim(o, false); }
      }
    } else if((o.warte -= dt) <= 0){
      const a = o.rnd() * Math.PI * 2, r = o.rnd() * o.heim.r;
      const x = o.heim.x + Math.cos(a) * r, z = o.heim.z + Math.sin(a) * r;
      if(opt.frei(x, z)){ o.ziel = { x, z }; gehAnim(o, true); } else o.warte = 1;
    }
    o.k.rotation.y = o.yaw + (opt.kopf === '-z' ? Math.PI : 0);
    sichtAnim(o, dt);
  }
}

// ---- Etappen ---------------------------------------------------------------------------------------------
// Nur einmal je Etappe aufbauen (beim ersten Bild in ihr); beim Wechsel raeumt story.weltEntsorgen die Welt weg,
// die Listen hier werden mit geleert.
const gebaut = {};
function etappeAufbauen(n){
  if(gebaut[n] || !eva || locale !== 'earth') return;
  if(n === 1) { if(!aufbau1()) return; }
  else if(n === 5) { if(!aufbau5()) return; }
  else if(n === 4) { if(!aufbau4()) return; }
  else if(n === 6) { if(!aufbau6()) return; }
  gebaut[n] = true;
}
// Etappe 1: Startinsel (Zelle 0,0). Moewen ueber Strand und Hafen, Hunde auf der Wiese bei der Schule.
function inselFrei(x, z){
  if(!isOnLand(x, z) || hitsBuilding(x, ISLAND_Y + 0.5, z, false)) return false;
  const xp = story.xwingPlatz, rg = story.ubootRingPlatz && story.ubootRingPlatz();
  if(xp && Math.hypot(x - xp.x, z - xp.z) < 12) return false;
  if(rg && Math.hypot(x - rg.x, z - rg.z) < 8) return false;
  return !(typeof isOnRunway === 'function' && isOnRunway(x, z));
}
function aufbau1(){
  const info = islandInfo(0, 0); if(!info) return false;
  const w = story.welt(1), i0 = story.intro && story.intro.start;
  const sx = i0 ? i0.x : info.wx, sz = i0 ? i0.z : info.wz;
  // Festland (etappe1.js): Moewen ueber Strand und Meer vor Kenji, Hunde auf der Wiese bei der Schule
  const K = story.e1 && story.e1.FEST;
  story.moewenKreise(1, w, K ? [
    { x: K.x - 40, z: 0, r: 70, y: 24, n: 4 }, { x: sx, z: sz, r: 40, y: 18, n: 2 },
    { x: K.x - 10, z: 130, r: 60, y: 14, n: 3 }, { x: K.x - 30, z: -140, r: 60, y: 20, n: 3 },
  ] : [
    { x: info.wx, z: info.wz, r: info.radius * 0.9, y: 28, n: 3 }, { x: sx, z: sz, r: 40, y: 18, n: 2 },
    { x: info.wx + info.radius, z: info.wz, r: 60, y: 14, n: 3 }, { x: info.wx - info.radius * 0.7, z: info.wz - info.radius * 0.6, r: 50, y: 20, n: 2 },
  ]);
  if(window.HUND_GLB) story.bodenTiere(1, w, {
    name: 'hund', daten: window.HUND_GLB, mass: 1.1, achse: 'z', kopf: 'z',   // Labrador ~1,1 m lang, Kopf auf +Z (C:\tmp\sfg\labi\t3.png)
    tempo: 1.3,                                                               // eine Animation: beim Gehen schneller abgespielt
    gruppen: K ? [{ x: sx + 4, z: sz - 24, r: 6, n: 1 }, { x: sx + 10, z: sz + 26, r: 8, n: 2 }, { x: sx + 40, z: sz - 60, r: 15, n: 2 }]
               : [{ x: sx + 12, z: sz - 6, r: 6, n: 1 }, { x: sx - 10, z: sz - 14, r: 8, n: 2 }, { x: info.wx, z: info.wz, r: 60, n: 2 }],
    y: ISLAND_Y, frei: inselFrei,
  });
  return true;
}
// Etappe 4: fliegende Moewen ueber Becken und Kai (die sitzenden stehen in etappe4.js)
function aufbau4(){
  story.moewenKreise(4, story.welt(4), [
    { x: 40, z: 20, r: 45, y: 22, n: 3 }, { x: -20, z: -40, r: 35, y: 16, n: 2 }, { x: 70, z: -80, r: 60, y: 30, n: 3 },
    { x: 10, z: 110, r: 40, y: 19, n: 2 }, { x: 60, z: 130, r: 30, y: 12, n: 2 },
  ]);
  return true;
}
// Etappe 5: Startinsel mit der Mustang. Moewen ueber Insel und Strand, Pandas auf der Wiese neben der Bahn.
function aufbau5(){
  const info = islandInfo(0, 0); if(!info) return false;
  const w = story.welt(5);
  const an = story.e5ankunft ? story.e5ankunft() : { x: info.wx + 60, z: info.wz };
  const vorn = { x: -Math.sin(eva.yaw), z: -Math.cos(eva.yaw) };   // Kenjis Blick (Gesicht -Z)
  const rg = (story.ubootRingPlatz && story.ubootRingPlatz()) || an;
  story.moewenKreise(5, w, [
    { x: info.wx, z: info.wz, r: info.radius * 0.8, y: 30, n: 3 }, { x: an.x, z: an.z, r: 45, y: 17, n: 3 },
    { x: info.wx - info.radius, z: info.wz + 40, r: 70, y: 15, n: 2 }, { x: info.wx + info.radius, z: info.wz - 60, r: 60, y: 22, n: 2 },
  ]);
  if(window.PANDA_GLB) story.bodenTiere(5, w, {
    name: 'panda', daten: window.PANDA_GLB, mass: 1.5, achse: 'z', kopf: 'z',   // Kopf auf +Z (C:\tmp\sfg\panda\t.png)
    tempo: 0.6,
    // vor Kenji (wie die Kamele in Etappe 2): 12 m in seiner Blickrichtung, dazu zwei Gruppen seitlich
    // vor Kenji (wie die Kamele in Etappe 2), dazu am Uferdorf beim U-Boot (Live-Wunsch 08.10.: "dort die Pandas")
    gruppen: [{ x: an.x + vorn.x * 12, z: an.z + vorn.z * 12, r: 4, n: 3 },
      { x: rg.x + (an.x - rg.x) * 0.15, z: rg.z + (an.z - rg.z) * 0.15, r: 8, n: 4 },
      { x: rg.x + (an.x - rg.x) * 0.35 + 20, z: rg.z + (an.z - rg.z) * 0.35, r: 8, n: 3 },
      { x: rg.x + (an.x - rg.x) * 0.35 - 20, z: rg.z + (an.z - rg.z) * 0.35, r: 6, n: 2 }],
    y: ISLAND_Y, frei: inselFrei,
  });
  return true;
}
// ---- Moewen an jeder Insel (Live-Wunsch 08.10.2026) ------------------------------------------------------------
// buildIsland der Engine baut jede Insel als Gruppe (Ursprung = Inselmitte). Jede bekommt 3-5 kreisende Moewen ueber
// Strand und Hafen; sie haengen in der Inselgruppe, verschwinden also mit ihr (updateIslands baut/verwirft Zellen).
// Fester Zufall je Zelle, damit eine Insel immer dieselben Moewen hat. Hoechstens INSEL_MOEWEN_MAX gleichzeitig.
const INSEL_MOEWEN_MAX = 60;
const inselMoewen = new Set();
function inselMoewenAn(g, cx, cz){
  const info = islandInfo(cx, cz); if(!info) return;
  if(inselMoewen.size >= INSEL_MOEWEN_MAX) return;
  vorlage('moeweFlug', window.MOEWE_FLUG_GLB, MOEWE_FLUG_B, 'x', null, (v) => {
    const key = cx + ',' + cz;
    if(islandCells.has(key) && islandCells.get(key) !== g) return;   // Insel inzwischen verworfen (synchron: noch nicht eingetragen)
    const rnd = zufall(1009 + ((cx * 73856093) ^ (cz * 19349663)) % 100000);
    const n = 3 + Math.floor(rnd() * 3), dreh = rnd() < 0.5 ? 1 : -1;
    for(let i = 0; i < n && inselMoewen.size < INSEL_MOEWEN_MAX; i++){
      const o = tierNeu(v, g, rnd);                    // lokal zur Insel
      const a0 = rnd() * Math.PI * 2, rr = info.radius * (0.6 + rnd() * 0.6);
      o.kreis = { x: Math.cos(a0) * rr * 0.3, z: Math.sin(a0) * rr * 0.3, r: 25 + rnd() * 45, y: 14 + rnd() * 20,
        w: dreh * (7 + rnd() * 3) / 50, a: rnd() * Math.PI * 2, hub: 1 + rnd() * 2, t: rnd() * 10 };
      o.insel = g; o.zelle = cx + ',' + cz; inselMoewen.add(o);
    }
  });
}
function updateInselMoewen(dt){
  const cp = camera.position;
  for(const o of inselMoewen){
    if(islandCells.get(o.zelle) !== o.insel){ if(islandCells.has(o.zelle) || !o.insel.parent) inselMoewen.delete(o); continue; }   // Insel verworfen
    const kr = o.kreis;
    kr.a += kr.w * dt; kr.t += dt;
    o.k.position.set(kr.x + Math.cos(kr.a) * kr.r, ISLAND_Y + kr.y + Math.sin(kr.t * 0.7) * kr.hub, kr.z + Math.sin(kr.a) * kr.r);
    const vx = -Math.sin(kr.a) * kr.w, vz = Math.cos(kr.a) * kr.w;
    o.k.rotation.set(0, Math.atan2(vx, vz), 0); o.k.rotateZ(Math.sign(kr.w) * 0.35);
    const ip = o.insel.position, d = Math.hypot(ip.x + o.k.position.x - cp.x, ip.z + o.k.position.z - cp.z);
    o.k.visible = locale === 'earth' && d < SICHT;
    if(o.k.visible && o.mixer && d < ANIM) o.mixer.update(dt);
  }
}

// ---- Mount Fuji statt der Kegel-Huegel (Live-Wunsch 08.10.2026) -----------------------------------------------------
// Modell: Mount Fuji - Honshu, Japan by Rafael Kenji Horota, CC-BY-4.0. Das Original (374.000 Dreiecke, 11,9 MB) ist
// fuer bis zu ~90 Berge gleichzeitig viel zu schwer. fuji_glb.js enthaelt deshalb eine daraus abgetastete Fassung
// (C:\tmp\sfg\fuji\backen.html): 2.752 Dreiecke, Hoehe/Farbe vom Original, Grundradius 1, Hoehe 1, Fuss auf y = 0.
// makeHill gibt dieselben Masse zurueck wie vorher (Radius r, Hoehe h) – Kollision, Feuerwehr- und Raketen-Sperren der
// Engine rechnen weiter mit ihrem Kegel, und der Fuji ist selbst ein Kegel mit derselben Grundflaeche und Hoehe.
let fujiGeo = null, fujiMat = null;
function fujiVorlage(){
  if(fujiGeo || !window.FUJI_DATEN) return !!fujiGeo;
  const d = window.FUJI_DATEN;
  fujiGeo = new THREE.BufferGeometry();
  fujiGeo.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
  // Farben: in sRGB gemessen (Texturpixel) -> linear (sonst wirkt der Berg violett ausgewaschen). Ab halber Hoehe
  // abwaerts zur Inselwiese hin gruener; der Schnee oben bleibt.
  const col = new Float32Array(d.col.length), wiese = [0.24, 0.42, 0.16];
  for(let i = 0; i < d.col.length; i += 3){
    const yy = d.pos[i + 1], f = Math.max(0, Math.min(1, (0.45 - yy) / 0.45)) * 0.6;
    for(let k = 0; k < 3; k++){ const lin = Math.pow(d.col[i + k], 2.2); col[i + k] = lin * (1 - f) + wiese[k] * f; }
  }
  fujiGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  fujiGeo.setIndex(d.idx); fujiGeo.computeVertexNormals();
  fujiMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return true;
}
function hookInseln(){
  const hillOrig = makeHill;
  makeHill = function(x, z, rnd, rnd2){
    if(!fujiVorlage()) return hillOrig.apply(this, arguments);
    // Etappe 6: der grosse Fuji steht im Blick – keine kleinen Fuji-Huegel auf den Inseln (leere Gruppe, gleiche Masse:
    // die Engine rechnet weiter mit ihrem Kegel, auf Inseln in Etappe 6 sind die Huegel damit unsichtbar)
    if(story.etappe === 6) return { mesh: new THREE.Group(), w: 0, d: 0, h: 0, isHill: true };
    const r = 30 + rnd * 50, h = 20 + rnd2 * 40;                 // wie makeHill der Engine
    const g = new THREE.Group();
    const m = new THREE.Mesh(fujiGeo, fujiMat);
    m.scale.set(r, h, r); m.rotation.y = rnd2 * Math.PI * 2;     // jeder Berg etwas anders gedreht
    m.userData.geteilt = true; g.add(m);
    g.position.set(x, ISLAND_Y, z);
    return { mesh: g, w: r * 2, d: r * 2, h, isHill: true };
  };
  const buildOrig = buildIsland;
  buildIsland = function(cx, cz){
    const g = buildOrig.apply(this, arguments);
    if(g && window.MOEWE_FLUG_GLB) inselMoewenAn(g, cx, cz);
    return g;
  };
}
const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hookInseln(); };

// ---- Etappe 6: Stadt (Moewen) und Festland hinter dem Fuji (Godzillas, Samurai, Moewen) --------------------------------
// Mini-Godzilla: Godzilla by savounited, CC-BY-4.0 (godzilla_glb.js, verkleinert) – 1 m hoch (Live-Wunsch), Gruppen,
// nicht auf dem Flugfeld. Samurai: Susanoo by tranb95, CC-BY-4.0 (samurai_glb.js, unveraendert: Transparenz/Outline),
// Animationen "Idle Sit", "Talk Sit", "Idle Stand"; sitzende und stehende Gruppen.
function aufbau6(){
  const info = islandInfo(0, 0); if(!info) return false;
  const FL = story.e6festland, e = story.e6; if(!FL || !FL.g || !e) return false;   // Festland (etappe6.js) noch nicht gebaut
  const w = story.welt(6);
  story.moewenKreise(6, w, [
    { x: e.FEST.x + 100, z: e.FEST.z + 200, r: 150, y: 22, n: 4 }, { x: e.FEST.x + 80, z: e.FEST.z - 500, r: 90, y: 16, n: 3 },
    { x: e.FLUGFELD.x, z: e.FLUGFELD.z, r: 220, y: 35, n: 3 },
    { x: info.wx, z: info.wz, r: info.radius * 0.8, y: 32, n: 3 }, { x: -60, z: 60, r: 45, y: 18, n: 3 },
    { x: info.wx - info.radius, z: info.wz, r: 70, y: 16, n: 2 }, { x: info.wx, z: info.wz - info.radius, r: 60, y: 22, n: 3 },
  ]);
  // Live-Feedback: "keine Mini-Godzillas rumlaufen" -> auch in der Stadt, Gruppen auf der Wiese, eine direkt vor Kenji.
  // Nicht auf der Bahn (|x| < 30), nicht am Bahnhof, nicht in Haeusern (hitsBuilding kennt die Stadt).
  const frei = (x, z) => { if(!isOnLand(x, z) || Math.hypot(x, z) > 225) return false;
    if(Math.abs(x) < 30 && Math.abs(z) < 160) return false;
    if(e && Math.abs(x - e.BAHNHOF.x) < 22 && Math.abs(z - e.BAHNHOF.z) < e.BAHNHOF.laenge / 2 + 15) return false;
    return !hitsBuilding(x, ISLAND_Y + 0.5, z, false); };
  const an = e ? e.START6 : { x: -55, z: 90 };
  if(window.GODZILLA_GLB) story.bodenTiere(6, w, {
    name: 'godzilla', daten: window.GODZILLA_GLB, mass: 1.0, achse: 'y', kopf: 'z', tempo: 0.9,
    gruppen: [{ x: an.x + 4, z: an.z - 16, r: 5, n: 3 }, { x: -70, z: -40, r: 10, n: 4 }, { x: 60, z: -70, r: 10, n: 3 },
      { x: 70, z: 80, r: 10, n: 4 }, { x: -150, z: -90, r: 12, n: 3 }],
    y: ISLAND_Y, frei,
  });
  // Riesen-Godzilla: 60 m hoch, laeuft hinter Kenji (Kenji schaut nach -z) quer durch die Stadt, z ~ +200, zwischen
  // x -200 und +200 hin und her. Nur Kulisse (keine Kollision), Animation langsam wie ein schweres Tier.
  if(window.GODZILLA_GLB) vorlage('godzilla', window.GODZILLA_GLB, 1.0, 'y', null, (v) => {
    if(story.etappe !== 6) return;
    godzillaHell(v);
    const k = cloneSkinned(v.tpl); k.scale.setScalar(RIESE.h); w.add(k);
    let mixer = null; if(v.clip){ mixer = new THREE.AnimationMixer(k); mixer.clipAction(v.clip).play(); mixer.timeScale = 0.35; }
    riese.o = { k, mixer, x: -RIESE.weg, dir: 1, t: 0 };
    // Live-Wunsch 09.10.2026: auch durch Fukuoka laeuft ein Riese – hinten in der Stadt hinter dem Bahnhof, laengs z
    // (parallel zur Kueste), so sieht man ihn vom Strand aus ueber den Daechern
    const S = story.e6 && story.e6.STADT; if(S){
      const k2 = cloneSkinned(v.tpl); k2.scale.setScalar(130); w.add(k2);   // ueberragt die Tuerme (bis ~140 m, meist weniger)
      let m2 = null; if(v.clip){ m2 = new THREE.AnimationMixer(k2); m2.clipAction(v.clip).play(); m2.timeScale = 0.33; m2.setTime(1.3); }
      riese2.o = { k: k2, mixer: m2, x: S.riese, z: (S.z0 + S.z1) / 2 + 250, weg: 260, dir: 1, t: 0, s: 0 };   // vor Kenjis Strandplatz (z +250) hin und her
    }
  });
  festlandTiere();
  return true;
}
const RIESE = { h: 60, z: 205, weg: 210, v: 6 };          // Hoehe m, Laufbahn z, halbe Breite m, Tempo m/s
const riese = { o: null }, riese2 = { o: null };
function updateRiese(dt){
  const o = riese.o; if(!o) return;
  if(story.etappe !== 6){ riese.o = null; riese2.o = null; return; }
  o.t += dt; o.x += o.dir * RIESE.v * dt;
  if(Math.abs(o.x) > RIESE.weg){ o.dir = -o.dir; o.x = Math.sign(o.x) * RIESE.weg; }
  // Kopf +Z: laeuft er nach +x, schaut er nach +x (yaw pi/2), sonst -x; dazu ein schweres Schwanken
  o.k.position.set(o.x, ISLAND_Y, RIESE.z + Math.sin(o.t * 0.4) * 12);
  o.k.rotation.set(0, o.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.sin(o.t * 1.1) * 0.04);
  o.k.visible = locale === 'earth';
  if(o.mixer) o.mixer.update(dt);
  const p = riese2.o; if(!p) return;
  p.t += dt; p.s += p.dir * RIESE.v * dt;
  if(Math.abs(p.s) > p.weg){ p.dir = -p.dir; p.s = Math.sign(p.s) * p.weg; }
  // Kopf +Z: laeuft er nach +z, yaw 0, sonst pi; leichtes Schwanken quer
  p.k.position.set(p.x + Math.sin(p.t * 0.4) * 6, ISLAND_Y, p.z + p.s);
  p.k.rotation.set(0, p.dir > 0 ? 0 : Math.PI, Math.sin(p.t * 1.1) * 0.04);
  p.k.visible = locale === 'earth';
  if(p.mixer) p.mixer.update(dt);
}
// Festland hinter dem Fuji (etappe6.js: story.e6festland, Gruppe im Weltursprung): Godzillas und Samurai rund um das
// Flugfeld als eigene Liste, Update wie die Bodentiere. frei = Wiese, nicht auf Bahn, Vorfeld oder Bahnhof.
const strandTiere = [];
function festlandTiere(){
  const FL = story.e6festland, e6 = story.e6; if(!FL || !FL.g || !e6) return;
  const g = FL.g, frei = FL.frei, rnd = zufall(4711);
  const info = { wx: e6.FLUGFELD.x, wz: e6.FLUGFELD.z };
  const setze = (v, n, gx, gz, gr, clip, kopf) => {
    for(let i = 0; i < n; i++){
      let x = gx, z = gz; for(let t = 0; t < 14; t++){ const a = rnd() * Math.PI * 2, r = rnd() * gr; x = gx + Math.cos(a) * r; z = gz + Math.sin(a) * r; if(frei(x, z)) break; }
      if(!frei(x, z)) continue;
      const o = tierNeu(v, g, rnd, clip);
      o.k.position.set(x - info.wx, ISLAND_Y, z - info.wz);
      o.k.rotation.y = rnd() * Math.PI * 2 + (kopf === '-z' ? Math.PI : 0);
      o.k.scale.setScalar(0.9 + rnd() * 0.2);
      o.insel = g; o.lauf = !clip; o.heim = { x: x - info.wx, z: z - info.wz }; o.yaw = o.k.rotation.y; o.warte = 1 + rnd() * 5; o.rnd = rnd;
      o.frei = (lx, lz) => frei(lx + info.wx, lz + info.wz);
      strandTiere.push(o);
    }
  };
  // Godzillas: 4 Gruppen beiderseits der Bahn (heller: siehe godzillaHell)
  vorlage('godzilla', window.GODZILLA_GLB, 1.0, 'y', null, (v) => {
    if(FL.g !== g || !g.parent) return;
    for(const [dx, dz, n] of [[-70, -60, 4], [80, -90, 3], [-90, 70, 4], [70, 110, 3]]) setze(v, n, info.wx + dx, info.wz + dz, 9, null, 'z');
    // Live-Feedback: auch am Strand (Kenji steht nach der Etappe dort): zwei kleine Gruppen links und rechts von ihm
    const S = e6.STRANDPLATZ; if(S){ setze(v, 3, S.x - 2, S.z + 30, 5, null, 'z'); setze(v, 3, S.x + 2, S.z - 34, 5, null, 'z'); }
  });
  // Samurai: sitzende Runden (Idle Sit / Talk Sit) und stehende Gruppen (Idle Stand)
  vorlage('samurai', window.SAMURAI_GLB, 1.75, 'y', 'Armature|Idle Stand', (v) => {
    if(FL.g !== g || !g.parent) return;
    for(const [dx, dz, n, clip] of [[-60, 10, 4, 'Armature|Idle Sit'], [55, -30, 3, 'Armature|Talk Sit'], [-40, -110, 3, 'Armature|Idle Stand'], [60, 60, 4, 'Armature|Idle Stand'], [-110, -10, 3, 'Armature|Talk Sit']])
      setze(v, n, info.wx + dx, info.wz + dz, 6, clip, 'z');
    // am Strand: eine sitzende Runde links vom Torii (schaut aufs Meer), eine stehende Gruppe rechts hinter dem Surfbrett
    const S = e6.STRANDPLATZ; if(S){ setze(v, 4, S.x - 4, S.z + 16, 3, 'Armature|Talk Sit', 'z'); setze(v, 3, S.x - 3, S.z - 22, 3, 'Armature|Idle Stand', 'z'); }
    // Live-Wunsch: eine kleine Gruppe stehender Samurai auf einer freien Strandflaeche (schauen zur Mitte der Gruppe)
    const SG = e6.SAMURAI_GRUPPE; if(SG) for(const [dx, dz] of [[-2.4, 0.4], [2.2, -0.6], [0.3, 2.5], [-0.4, -2.6], [2.6, 2.2]]){
      const x = SG.x + dx, z = SG.z + dz, o = tierNeu(v, g, rnd, 'Armature|Idle Stand');
      o.k.position.set(x - info.wx, ISLAND_Y, z - info.wz); o.k.rotation.y = Math.atan2(SG.x - x, SG.z - z); o.yaw = o.k.rotation.y;
      o.insel = g; o.lauf = false; o.heim = { x: x - info.wx, z: z - info.wz }; o.warte = 1e9; o.rnd = rnd; o.frei = () => false;
      strandTiere.push(o);
    }
    // Live-Wunsch: zwei sitzende Samurai am Lagerfeuer, Blick zum Feuer (Kopf +Z -> yaw = atan2(dx, dz))
    const F = e6.FEUER; if(F) for(const [dx, dz, clip] of [[-2.2, 1.2, 'Armature|Talk Sit'], [2.1, 1.6, 'Armature|Idle Sit']]){
      const x = F.x + dx, z = F.z + dz, o = tierNeu(v, g, rnd, clip);
      o.k.position.set(x - info.wx, ISLAND_Y, z - info.wz); o.k.rotation.y = Math.atan2(F.x - x, F.z - z); o.yaw = o.k.rotation.y;
      o.insel = g; o.lauf = false; o.heim = { x: x - info.wx, z: z - info.wz }; o.warte = 1e9; o.rnd = rnd; o.frei = () => false;
      strandTiere.push(o);
    }
  });
}
// Godzilla am Strand: wie die Bodentiere – warten, dann ein Stueck zu einem Punkt nahe der Gruppe tappen (Kopf +Z)
function strandLaufen(o, dt){
  const p = o.k.position;
  if(o.ziel){
    const dx = o.ziel.x - p.x, dz = o.ziel.z - p.z, d = Math.hypot(dx, dz);
    if(d < 0.3){ o.ziel = null; o.warte = 2 + o.rnd() * 6; if(o.mixer) o.mixer.timeScale = 0.9; }
    else { const soll = Math.atan2(dx, dz); let dy = soll - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      o.yaw += Math.max(-2 * dt, Math.min(2 * dt, dy));
      const sch = Math.min(d, 0.9 * dt) * Math.max(0, Math.cos(dy)), nx = p.x + Math.sin(o.yaw) * sch, nz = p.z + Math.cos(o.yaw) * sch;
      if(o.frei(nx, nz)){ p.x = nx; p.z = nz; } else { o.ziel = null; o.warte = 1; }
      o.k.rotation.y = o.yaw; }
  } else if((o.warte -= dt) <= 0){
    const a = o.rnd() * Math.PI * 2, r = o.rnd() * 10, x = o.heim.x + Math.cos(a) * r, z = o.heim.z + Math.sin(a) * r;
    if(o.frei(x, z)){ o.ziel = { x, z }; if(o.mixer) o.mixer.timeScale = 1.7; } else o.warte = 1;
  }
}
function updateStrandTiere(dt){
  const cp = camera.position;
  for(let i = strandTiere.length - 1; i >= 0; i--){
    const o = strandTiere[i];
    if(!o.insel.parent){ strandTiere.splice(i, 1); continue; }                // Welt 6 entsorgt
    if(o.lauf) strandLaufen(o, dt);
    const ip = o.insel.position, d = Math.hypot(ip.x + o.k.position.x - cp.x, ip.z + o.k.position.z - cp.z);
    o.k.visible = locale === 'earth' && d < SICHT;
    if(o.k.visible && o.mixer && d < ANIM) o.mixer.update(dt);
  }
}

story.tiereUpdate = function(dt){
  updateRiese(dt);
  updateStrandTiere(dt);
  updateInselMoewen(dt);
  for(const n of Object.keys(gebaut)) if(+n !== story.etappe){ delete gebaut[n]; delete flieger[n]; delete boden[n]; }
  etappeAufbauen(story.etappe);
  updateFlieger(story.etappe, dt);
  updateBoden(story.etappe, dt);
};
})();
