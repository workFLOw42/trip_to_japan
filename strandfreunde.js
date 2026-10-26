// Trip to Japan – Joshi und Fuchsi am Fukuoka-Beach (Live-Wunsch 23.10.2026). Laedt nach abspann.js, vor der Engine.
// Wann: in jedem Ende der Reise – sobald Samu am Fukuoka-Beach angekommen ist (Etappe 6, story.phase 'ankunft'; damit auch
//   nach dem Surfen, im Abspann und bei "Ab zum Strand").
// Was: Joshi (aus "Das Geheimland") laeuft auf der freien Sandflaeche rund um das Surfbrett hin und her, schaut sich um und
//   kniet sich hin – dann kommt Fuchsi angerannt, spielt vor ihm und setzt sich zu ihm. Sonst streift Fuchsi um Joshi herum.
// Tanzt Samu (X) in Joshis Naehe (JAM_R), dreht Joshi sich zu ihm und spielt Luftgitarre (dazu der EDM-Drop in Schleife),
//   Fuchsi tanzt vor Joshi (Saltos, Hopser, Schwanzschlag), Barki tollt vor Samu (begleiter.js). Wie bei den Aliens auf dem
//   Mond tanzt Samu dann endlos weiter (story.js: story.strandFreunde.jam), bis der Stick ihn bewegt oder eine andere Taste kommt.
// Modelle: Joshi = Spielfigur aus "Das Geheimland" (nur die Clips idle walk look kneel guitar, Textur 1024 px JPEG), Fox von
//   pxltiger (CC-BY-4.0, nur die benutzten Clips). Grenzen: beide sind Kreise (story.tierQuelle) – Samu und Barki laufen nicht
//   hindurch; die zwei weichen ihrerseits Samu und Barki aus.
(function(){
'use strict';
const story = window.STORY;
const JOSHI_H = 1.20, FUCHS_LANG = 0.9;
const RING_MIN = 9.5, RING_MAX = 22, GANG_MAX = 12;   // m um das Surfbrett (Einstiegsring bleibt frei) / hoechstens so weit je Gang
const JAM_R = 12;                 // m: tanzt Samu naeher an Joshi, spielt er Luftgitarre
const GEH_V = 0.95, SICHT = 220, ANIM = 120;
const JOSHI_R = 0.3, FUCHS_R = 0.25, SAMU_R = 0.35, HUND_R = 0.36;
const GITARRE_VOL = 0.09, GITARRE_WEIT = 40;          // Lautstaerke direkt bei Joshi, bis GITARRE_WEIT m leiser bis 0
const FA = { stehen: 'Fox_Idle', gehen: 'Fox_Walk_InPlace', rennen: 'Fox_Run_InPlace', setzen: 'Fox_Sit1', sitzen: 'Fox_Sit2_Idle',
  sitzPause: 'Fox_Sit_Idle_Break', aufstehen: 'Fox_Sit3_StandUp', pfoten: 'Fox_Attack_Paws', huepfen: 'Fox_Jump_Pivot_InPlace' };
const TANZ_DREH = ['Fox_Somersault_InPlace', 'Fox_Jump_Pivot_InPlace', 'Fox_Somersault_InPlace', 'Fox_Attack_Tail'];
const FUCHS_LANGSAM = { Fox_Attack_Paws: 0.75, Fox_Attack_Tail: 0.7, Fox_Somersault_InPlace: 0.75, Fox_Jump_Pivot_InPlace: 0.85 };
const EINMAL = [FA.setzen, FA.aufstehen, FA.sitzPause, FA.pfoten, FA.huepfen, 'Fox_Somersault_InPlace', 'Fox_Attack_Tail', 'kneel', 'look'];
const fr = story.strandFreunde = { an: false, jam: false, g: null, j: null, f: null, laedt: false };

// am Strand: nach der Ankunft – und auch, wenn Samu im Finale wieder zu Fuss ist (vor dem Start aus der Transall ausgestiegen)
function hier(){ const FL = story.e6festland; return story.etappe === 6 && locale === 'earth' && (story.phase === 'ankunft' || (story.phase === 'finale' && !!eva)) && !!story.e6 && !!FL && !!FL.g && !!FL.g.parent; }   // global-ok: Engine (eva)
const wd = (a, b) => { let d = b - a; while(d > Math.PI) d -= 2 * Math.PI; while(d < -Math.PI) d += 2 * Math.PI; return d; };
const kl = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Laden ------------------------------------------------------------------------------------------------------
function glb(daten, name, fertig){
  const b = atob(daten.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', fertig, (e) => console.warn(name + '-GLB', e));
}
function aktionen(w, mixer, clips){
  w.acts = {}; w.mixer = mixer;
  for(const c of clips){ const a = w.acts[c.name] = mixer.clipAction(c); if(EINMAL.includes(c.name)){ a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } }
}
function ladeJoshi(fertig){
  glb(window.JOSHI_GLB, 'Joshi', (g) => {
    const obj = g.scene; obj.updateMatrixWorld(true);
    const sz = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(JOSHI_H / Math.max(0.001, sz.y)); obj.updateMatrixWorld(true);
    obj.position.y -= new THREE.Box3().setFromObject(obj).min.y;                // Fuesse auf y = 0, Blick +Z
    // wie im Geheimland: matt (FBX2glTF setzt metallic 0,4), kein Schattenwurf (eigener Ovalschatten)
    obj.traverse(o => { if(!o.isMesh) return; o.castShadow = false; o.frustumCulled = false; if(o.material){ o.material.metalness = 0; o.material.roughness = 0.85; } });
    // Hueftspur waagerecht festhalten – bewegt wird Joshi hier im Code
    for(const c of g.animations) for(const t of c.tracks){ if(!/Hips\.position$/.test(t.name)) continue;
      const v = t.values, x0 = v[0], z0 = v[2]; for(let i = 0; i < v.length; i += 3){ v[i] = x0; v[i + 2] = z0; } }
    const wrap = new THREE.Group(); wrap.add(obj); wrap.userData.deko = true;
    const J = { obj: wrap, cur: null, x: 0, z: 0, yaw: 0, modus: 'warten', t: 2, ziel: null, blockT: 0, r: JOSHI_R };
    aktionen(J, new THREE.AnimationMixer(obj), g.animations);
    anim(J, 'idle'); fertig(J);
  });
}
function ladeFuchs(fertig){
  glb(window.FUCHSI_GLB, 'Fuchs', (g) => {
    const obj = g.scene; obj.traverse(o => { if(o.isMesh){ o.frustumCulled = false; o.castShadow = false; } });
    const F = { cur: null, x: 0, z: 0, yaw: 0, modus: 'folgen', t: 1, ziel: null, langsam: FUCHS_LANGSAM, r: FUCHS_R, laune: 0 };
    aktionen(F, new THREE.AnimationMixer(obj), g.animations);
    // in der gehaeuteten Haltung messen (die Bindepose-Box passt nicht), wie im Geheimland
    F.acts[FA.stehen].play(); F.mixer.update(0.01); obj.updateMatrixWorld(true);
    const bb = new THREE.Box3(), p = new THREE.Vector3();
    obj.traverse(m => { if(!m.isSkinnedMesh) return; const n = m.geometry.attributes.position.count;
      for(let i = 0; i < n; i += 3){ m.boneTransform(i, p); p.applyMatrix4(m.matrixWorld); bb.expandByPoint(p); } });
    if(bb.isEmpty()) bb.setFromObject(obj);
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    let kopf = null; obj.traverse(o => { if(!kopf && o.isBone && /head/i.test(o.name)) kopf = o; if(!F.becken && o.isBone && /Pelvis/i.test(o.name)) F.becken = o; });
    const kp = kopf ? kopf.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 0, 1);
    F.kopf = Math.atan2(kp.x - c.x, kp.z - c.z);                               // Blickrichtung des Modells
    const k = FUCHS_LANG / Math.max(sz.x, sz.z);
    obj.scale.multiplyScalar(k); obj.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
    const wrap = new THREE.Group(); wrap.add(obj); wrap.userData.deko = true;
    if(F.becken){ wrap.updateMatrixWorld(true); F.beckenRuhe = F.becken.getWorldPosition(new THREE.Vector3()).y; F.inner = obj; F.innerY = obj.position.y; }
    F.obj = wrap; F.cur = FA.stehen; fertig(F);
  });
}
// Clip wechseln mit Ueberblendung (nur neuer und ausblendender laufen)
function anim(w, name, blend){
  const a = w.acts[name]; if(!a || w.cur === name) return;
  const sl = w.langsam && w.langsam[name]; a.timeScale = sl || 1; if(sl) blend = Math.min(blend || 0.3, 0.08);
  const alt = w.cur && w.acts[w.cur];
  for(const n in w.acts){ const b = w.acts[n]; if(b !== a && b !== alt) b.stop(); }
  a.reset(); a.setEffectiveWeight(1); a.play();
  if(alt) alt.crossFadeTo(a, blend || 0.25, false);
  w.cur = name;
}
// von vorn, auch wenn der Clip gerade laeuft (zweimal Pfoten, Tanzdrehungen)
function vonVorn(w, name){
  const a = w.acts[name]; if(!a) return;
  a.timeScale = (w.langsam && w.langsam[name]) || 1;
  for(const n in w.acts){ const b = w.acts[n]; if(b !== a && b.isRunning()) b.fadeOut(0.08); }
  a.reset(); a.setEffectiveWeight(1); a.fadeIn(0.08); a.play(); w.cur = name;
}
function laeuft(w, name){ const a = w.acts[name]; return w.cur === name && a && a.time < a.getClip().duration - 0.03; }

// ---- Wo sie laufen duerfen ----------------------------------------------------------------------------------------
// Sand und Wiese, 3 m Abstand zum Wasser, nicht in den Einstiegsring, nicht in die Samurai-Gruppen, nicht ins Feuer
function landeinwaerts(x, z){ const F = story.e6.FEST; return F.R - Math.hypot(x - (F.x + F.R), z - F.z); }
function bodenFrei(x, z){
  const E = story.e6, S = E.STRANDPLATZ;
  if(!isOnLand(x, z) || landeinwaerts(x, z) < 3) return false;
  if(Math.hypot(x - E.SURF.x, z - E.SURF.z) < RING_MIN - 1.5) return false;
  const kreise = [[S.x - 4, S.z + 16, 4.5], [S.x - 3, S.z - 22, 4]];        // Samurai am Strand (tiere.js)
  if(E.SAMURAI_GRUPPE) kreise.push([E.SAMURAI_GRUPPE.x, E.SAMURAI_GRUPPE.z, 5]);
  if(E.FEUER) kreise.push([E.FEUER.x, E.FEUER.z, 4]);
  for(const [kx, kz, r] of kreise) if(Math.hypot(x - kx, z - kz) < r) return false;
  return true;
}
// Andere Koerper: Samu, Barki und der jeweils andere. Ein Schritt ist frei, wenn er auf freiem Boden landet und keinem
// Koerper naeher kommt als erlaubt – steckt er schon zu nah (Samu ist herangelaufen), darf er sich jederzeit entfernen.
// nah: der Fuchs darf dicht an Joshi heran (Spielen, Sitzen, Tanzen)
const _hw = new THREE.Vector3(), _ow = new THREE.Vector3();
function koerper(w, nah){
  const l = [];
  if(eva && eva.group) l.push([eva.group.position.x, eva.group.position.z, w.r + SAMU_R + 0.05]);
  const H = story.hund; if(H && H.obj && H.obj.visible && H.obj.parent){ const p = H.obj.getWorldPosition(_hw); l.push([p.x, p.z, w.r + HUND_R + 0.05]); }
  const o = w === fr.j ? fr.f : fr.j; if(o) l.push([o.x, o.z, nah ? 0.4 : w.r + o.r + 0.05]);
  return l;
}
function schrittFrei(w, x, z, nah){
  if(!bodenFrei(x, z) && bodenFrei(w.x, w.z)) return false;
  for(const [kx, kz, min] of koerper(w, nah)){
    const neu = Math.hypot(x - kx, z - kz);
    if(neu < min && neu < Math.hypot(w.x - kx, w.z - kz)) return false;
  }
  return true;
}
// Laeuft zum Punkt (zx, zz) mit tempo m/s, um Hindernisse herum. Rueckgabe: Restabstand (Infinity = kein Weg)
function laufe(w, dt, zx, zz, tempo, gehClip, rennClip, nah){
  const dx = zx - w.x, dz = zz - w.z, d = Math.hypot(dx, dz);
  if(d < 0.05) return d;
  let soll = Math.atan2(dx, dz);
  const st = Math.max(0.12, tempo * dt);
  const frei = (a) => schrittFrei(w, w.x + Math.sin(a) * st, w.z + Math.cos(a) * st, nah);
  if(!frei(soll)){
    let gef = null; const seiten = w.umSeite ? [w.umSeite, -w.umSeite] : [1, -1];
    for(let a = 0.3; a <= 2.1 && gef === null; a += 0.3) for(const s of seiten) if(frei(soll + s * a)){ gef = soll + s * a; w.umSeite = s; break; }
    if(gef === null){ anim(w, w === fr.j ? 'idle' : FA.stehen, 0.3); return Infinity; }
    soll = gef;
  } else w.umSeite = 0;
  const dw = wd(w.yaw, soll);
  w.yaw += kl(dw, -5 * dt, 5 * dt);
  const s = Math.min(d, tempo * dt) * Math.max(0.25, Math.cos(dw));
  const nx = w.x + Math.sin(w.yaw) * s, nz = w.z + Math.cos(w.yaw) * s;
  if(schrittFrei(w, nx, nz, nah)){ w.x = nx; w.z = nz; }
  anim(w, rennClip && tempo >= 3 ? rennClip : gehClip, 0.25);
  return d;
}
function schaue(w, dt, x, z, rate){ w.yaw += kl(wd(w.yaw, Math.atan2(x - w.x, z - w.z)), -rate * dt, rate * dt); }
// Punkt relativ zu Joshi: vor = in seiner Blickrichtung, links = zu seiner Linken
function beiJoshi(vor, links){ const J = fr.j, fx = Math.sin(J.yaw), fz = Math.cos(J.yaw); return { x: J.x + fx * vor + fz * links, z: J.z + fz * vor - fx * links }; }

// ---- Joshi --------------------------------------------------------------------------------------------------------
// Neues Ziel im Ring um das Surfbrett, nicht zu weit, Weg dorthin frei
function neuesZiel(J){
  const E = story.e6;
  for(let i = 0; i < 40; i++){
    const a = Math.random() * Math.PI * 2, r = RING_MIN + Math.random() * (RING_MAX - RING_MIN);
    const x = E.SURF.x + Math.sin(a) * r, z = E.SURF.z + Math.cos(a) * r, d = Math.hypot(x - J.x, z - J.z);
    if(d < 3 || d > GANG_MAX || !bodenFrei(x, z)) continue;
    let ok = true; for(let s = 0.5; s < d && ok; s += 0.5) ok = bodenFrei(J.x + (x - J.x) * s / d, J.z + (z - J.z) * s / d);
    if(ok) return { x, z };
  }
  return null;
}
function samuTanztNah(J){
  if(!eva || !eva.group || !story.tricks || story.tricks.aktiv !== 'tanz') return false;
  return Math.hypot(eva.group.position.x - J.x, eva.group.position.z - J.z) < JAM_R;
}
function joshiSchritt(J, dt){
  const tanzt = samuTanztNah(J);
  if(tanzt && J.modus !== 'jam'){ J.modus = 'jam'; J.ziel = null; fr.jam = true; fuchsModus('tanzen'); }
  if(J.modus === 'jam'){
    if(!tanzt){ J.modus = 'warten'; J.t = 1.5 + Math.random() * 2; fr.jam = false; anim(J, 'idle', 0.4); fuchsModus('folgen'); return; }
    const g = eva.group.position; schaue(J, dt, g.x, g.z, 3);
    anim(J, 'guitar', 0.4); return;
  }
  if(J.modus === 'gehen'){
    const d = laufe(J, dt, J.ziel.x, J.ziel.z, GEH_V, 'walk');
    if(d === Infinity){ if((J.blockT += dt) > 1.5){ J.modus = 'warten'; J.t = 1; } } else J.blockT = 0;
    if(d < 0.3){ J.modus = 'warten'; J.t = 1.5 + Math.random() * 3; anim(J, 'idle', 0.3); }
    return;
  }
  if(J.modus === 'schauen'){ if(!laeuft(J, 'look')){ J.modus = 'warten'; J.t = 1 + Math.random() * 2; anim(J, 'idle', 0.4); } return; }
  if(J.modus === 'knien'){
    if((J.t -= dt) <= 0){ J.modus = 'warten'; J.t = 1.5 + Math.random() * 2; anim(J, 'idle', 0.35); fuchsModus('folgen'); }
    return;
  }
  // warten: kurz stehen, dann gehen, umschauen oder hinknien
  anim(J, 'idle', 0.3);
  if((J.t -= dt) > 0) return;
  const r = Math.random();
  if(r < 0.5){ const z = neuesZiel(J); if(z){ J.ziel = z; J.modus = 'gehen'; J.blockT = 0; return; } }
  if(r < 0.75){ J.modus = 'schauen'; vonVorn(J, 'look'); return; }
  if(r < 0.95){ J.modus = 'knien'; J.t = 7 + Math.random() * 4; anim(J, 'kneel', 0.35); fuchsModus('kommen'); return; }
  J.t = 2 + Math.random() * 2;
}

// ---- Fuchsi -------------------------------------------------------------------------------------------------------
function aufstehen(F){ if(F.sitzt){ anim(F, FA.aufstehen, 0.2); F.sitzt = false; } }
function fuchsModus(m){
  const F = fr.f; if(!F || F.modus === m) return;
  aufstehen(F);
  F.modus = m; F.ziel = null; F.t = 0.4; F.laune = 0; F.spiel = 0; F.platz = null;
  F.tanz = m === 'tanzen' ? { seite: 1, dreh: 0, naechste: 1.2, clip: null } : null;
}
function fuchsSitzen(F, dt, blickX, blickZ){
  if(!F.sitzt){ F.sitzt = true; anim(F, FA.setzen, 0.25); return; }
  schaue(F, dt, blickX, blickZ, 3);
  if(F.cur === FA.setzen && !laeuft(F, FA.setzen)) anim(F, FA.sitzen, 0.2);
  else if(F.cur === FA.sitzen && Math.random() < dt / 9) anim(F, FA.sitzPause, 0.2);
  else if(F.cur === FA.sitzPause && !laeuft(F, FA.sitzPause)) anim(F, FA.sitzen, 0.2);
}
function fuchsSchritt(F, dt){
  const J = fr.j;
  if(F.cur === FA.aufstehen && laeuft(F, FA.aufstehen)) return;               // erst aufstehen
  if(F.modus === 'kommen'){
    // zu Joshi rennen, direkt vor ihm zweimal mit den Pfoten spielen, dann neben ihm hinsetzen und ihn anschauen
    if(F.spiel === 0){
      const vor = beiJoshi(0.75, 0), d = Math.hypot(vor.x - F.x, vor.z - F.z);
      const r = laufe(F, dt, vor.x, vor.z, d > 2 ? 6 : 2.5, FA.gehen, FA.rennen, true);
      if(r < 0.3 || (r === Infinity && d < 1.2)){ F.spiel = 1; F.yaw = Math.atan2(J.x - F.x, J.z - F.z); vonVorn(F, FA.pfoten); }
      return;
    }
    if(F.spiel <= 2){ schaue(F, dt, J.x, J.z, 4); if(!laeuft(F, FA.pfoten) && ++F.spiel <= 2) vonVorn(F, FA.pfoten); return; }
    if(!F.sitzt){
      const neben = beiJoshi(0.35, 0.65), r = laufe(F, dt, neben.x, neben.z, 1.5, FA.gehen, null, true);
      if(r > 0.2 && r !== Infinity && (F.t -= dt) > -3) return;
    }
    fuchsSitzen(F, dt, J.x, J.z); return;
  }
  if(F.modus === 'strand'){
    // Joshi surft: Fuchsi setzt sich vorn an den Rand des Einstiegsrings (zum Meer hin) und schaut aufs Wasser
    if(!F.platz){ const E = story.e6; let best = null;
      for(let i = 0; i < 36; i++){ const a = i / 36 * Math.PI * 2, x = E.SURF.x + Math.sin(a) * RING_MIN, z = E.SURF.z + Math.cos(a) * RING_MIN;
        if(bodenFrei(x, z) && (!best || x < best.x)) best = { x, z }; }
      F.platz = best || { x: F.x, z: F.z }; }
    if(!F.sitzt){ const r = laufe(F, dt, F.platz.x, F.platz.z, Math.hypot(F.platz.x - F.x, F.platz.z - F.z) > 3 ? 6 : 2, FA.gehen, FA.rennen, false);
      if(r > 0.3 && r !== Infinity) return; }
    fuchsSitzen(F, dt, F.x - 10, F.z); return;
  }
  if(F.modus === 'tanzen' && eva && eva.group){
    // neben Joshi (etwas zu Samu hin, auf der Seite ohne Barki – der tollt vor Samu) hin und her, immer wieder eine
    // Drehung – endlos, solange er spielt
    const T = F.tanz, g = eva.group.position, ds = Math.hypot(g.x - J.x, g.z - J.z) || 1;
    const ux = (g.x - J.x) / ds, uz = (g.z - J.z) / ds;
    if(!T.platz){ const H = story.hund, h = H && H.obj ? H.obj.getWorldPosition(_hw) : g;
      T.platz = ((h.x - J.x) * uz - (h.z - J.z) * ux) > 0 ? -1 : 1; }
    const vor = Math.min(1.2, ds * 0.3), mx = J.x + ux * vor + uz * 1.8 * T.platz, mz = J.z + uz * vor - ux * 1.8 * T.platz;
    if(T.clip){ if(laeuft(F, T.clip)) return; T.clip = null; }
    if((T.naechste -= dt) <= 0){ const c = TANZ_DREH[T.dreh++ % TANZ_DREH.length]; if(F.acts[c]){ vonVorn(F, c); T.clip = c; } T.naechste = 1.4 + Math.random() * 1.2; return; }
    const zx = mx + ux * 0.9 * T.seite, zz = mz + uz * 0.9 * T.seite;   // in Joshis Blickrichtung vor und zurueck
    const d = laufe(F, dt, zx, zz, 2.4, FA.gehen, FA.rennen, true);
    if(d < 0.3 || d === Infinity) T.seite = -T.seite;
    return;
  }
  // folgen: in Joshis Naehe bleiben, schnuppern, mal kurz sitzen oder vor Freude huepfen
  const dj = Math.hypot(J.x - F.x, J.z - F.z);
  if(F.ziel){
    const d = laufe(F, dt, F.ziel.x, F.ziel.z, F.ziel.v, FA.gehen, FA.rennen, false);
    if(d < 0.3 || d === Infinity){ F.ziel = null; F.t = 1.5 + Math.random() * 4; F.laune = Math.random(); }
    return;
  }
  if(dj > 4){ aufstehen(F); const a = Math.random() * Math.PI * 2; F.ziel = { x: J.x + Math.sin(a) * 1.8, z: J.z + Math.cos(a) * 1.8, v: dj > 7 ? 6 : 2.5 }; return; }
  if(F.laune > 0.6 && F.laune < 0.85) fuchsSitzen(F, dt, J.x, J.z);
  else if(F.laune >= 0.85 && !F.gehuepft){ F.gehuepft = true; vonVorn(F, FA.huepfen); }
  else if(!(F.cur === FA.huepfen && laeuft(F, FA.huepfen)) && !F.sitzt) anim(F, FA.stehen, 0.3);
  if((F.t -= dt) <= 0){
    aufstehen(F); F.gehuepft = false; F.laune = 0;
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.5;
    const x = J.x + Math.sin(a) * r, z = J.z + Math.cos(a) * r;
    if(bodenFrei(x, z)) F.ziel = { x, z, v: 1.3 }; else F.t = 1;
  }
}
// Pivot-Hopser: die halbe Drehung macht der Code (der Clip dreht kaum), Salto/Schwanzschlag: Becken nicht unter den Boden
const _fb = new THREE.Vector3();
function fuchsHaltung(F){
  let dreh = 0;
  if(F.cur === FA.huepfen && F.acts[F.cur]){
    const a = F.acts[F.cur], k = Math.min(1, a.time / a.getClip().duration), e = k * k * (3 - 2 * k);
    dreh = Math.PI * e; F.obj.position.y += Math.sin(Math.PI * k) * 0.22;     // kleiner Bogen in der Luft
    if(k >= 0.999 && !F.drehFertig){ F.yaw += Math.PI; F.drehFertig = true; dreh = 0; }
  } else F.drehFertig = false;
  F.obj.rotation.y = F.yaw - F.kopf + dreh;
  if(F.inner && F.becken && F.beckenRuhe !== undefined){
    F.inner.position.y = F.innerY; F.obj.updateMatrixWorld(true);
    const tief = F.beckenRuhe - (F.becken.getWorldPosition(_fb).y - F.obj.getWorldPosition(_ow).y);
    if(tief > 0.01 && FUCHS_LANGSAM[F.cur]) F.inner.position.y = F.innerY + tief * 0.85;
  }
}

// ---- Musik beim Tanzen (Live-Wunsch 23.10.2026): "EMD Drop (inkl. Riser)" von sioaar1 (Pixabay) in Schleife, solange Samu,
// Joshi und die Tiere zusammen tanzen – leiser mit dem Abstand zur Kamera. Vorher spielte hier der Gitarren-Loop aus dem
// Geheimland.
const TANZ_VOL = 0.32;
function tanzMusik(an, d){ musik(an, d, tanz, window.TANZ_SND, TANZ_VOL); }
const tanz = { buf: null, laedt: false, quelle: null, gain: null };
// ---- Gitarre (Pixabay: idoberg, Punk Rock Guitar Loop – wie im Geheimland), leiser mit dem Abstand zur Kamera ---------
const git = { buf: null, laedt: false, quelle: null, gain: null };
// Live-Befund 26.10.2026: der Tanz-Track klingt nach dem letzten Schlag (24 s) noch ~13 s bis zur Stille aus – die Schleife
// endet deshalb dort, wo es noch hoerbar ist (letzte 0,25 s mit mindestens 8 % des lautesten Abschnitts, RMS)
function hoerbarBis(b){
  const d = b.getChannelData(0), w = Math.floor(b.sampleRate / 4), rms = [];
  for(let i = 0; i + w <= d.length; i += w){ let s = 0; for(let j = i; j < i + w; j++) s += d[j] * d[j]; rms.push(Math.sqrt(s / w)); }
  const max = Math.max(0, ...rms); let n = rms.length; while(n > 1 && rms[n - 1] < max * 0.08) n--;
  return n * w / b.sampleRate;
}
function musik(an, d, m, url, vol){
  const ok = an && soundOn && audioCtx && audioCtx.state === 'running' && url;
  if(!ok){ if(m.quelle){ try { m.quelle.stop(); } catch(e){} m.quelle = null; } return; }
  if(!m.buf){ if(!m.laedt){ m.laedt = true; decodeSound(url).then(b => { m.buf = b; m.ende = hoerbarBis(b); }).catch(e => { m.laedt = false; console.warn('Tanzmusik:', e); }); } return; }
  if(!m.gain){ m.gain = audioCtx.createGain(); m.gain.connect(audioCtx.destination); }
  m.gain.gain.value = vol * Math.max(0, 1 - d / GITARRE_WEIT);
  if(m.quelle) return;
  const s = audioCtx.createBufferSource(); s.buffer = m.buf; s.loop = true; if(m.ende) s.loopEnd = m.ende; s.connect(m.gain); s.start(); m.quelle = s;
}
function gitarre(an, d){ tanzMusik(an, d); }

// ---- Joshi surft mit (Live-Wunsch 23.10.2026) ---------------------------------------------------------------------
// Geht Samu surfen (finale.js: story.surfLage), faehrt Joshi auf einem eigenen Brett mit: ~10 m neben Samu auf derselben
// Welle, mit eigener Linie (pendelt langsam vor/zurueck und weiter/naeher). Alle paar Sekunden springt er und macht einen
// echten Trick – Salto vorwaerts oder rueckwaerts, 360 links oder rechts herum, Salto mit 360 –, die Drehung ist vor dem
// Aufsetzen immer ganz fertig (er landet jeden). Haltung: Mixamo "Skateboarding". Fuchsi wartet am Strand und schaut zu.
// Ist Samu wieder an Land, steht Joshi neben dem Surfbrett im Sand.
// Im Clip 'skate' (Mixamo "Skateboarding") stehen die Sohlen 5,8 cm hoch – fuers Skateboard (gemessen 26.10.2026). Auf
// Snowboard und Surfbrett (Oberseite 4,5 cm, wie bei Samu) wird Joshi darum so weit abgesenkt.
const SKATE_SOHLE = 0.058, BRETT_OBEN = 0.045, JOSHI_AUF_BRETT = BRETT_OBEN - SKATE_SOHLE;
const SURF_SEIT = 10, SURF_SPRUNG = 7.5, SURF_G = 14, SURF_DREHPUNKT = 0.6;
const SURF_TRICKS = [{ flip: 1, spin: 0 }, { flip: -1, spin: 0 }, { flip: 0, spin: 1 }, { flip: 0, spin: -1 }, { flip: 1, spin: 1 }, { flip: -1, spin: -1 }];
const sf = { an: false, x: 0, z: 0, y: 0, vx: 0, vz: 0, yaw: 0, luft: false, vy: 0, lt: 0, T: 1, trick: null, naechster: 3, seite: 1, t: 0, sx: 0, sz: 0, brett: null, neig: 0, roll: 0 };
const _qy = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _sY = new THREE.Vector3(0, 1, 0), _sX = new THREE.Vector3(1, 0, 0), _sZ = new THREE.Vector3(0, 0, 1), _sp = new THREE.Vector3();
// Groesse der Engine-Spur (tierSchatten hat Joshi mit seiner Koerpergroesse angemeldet; auf dem Brett macht er mehr Welle)
function spurGroesse(o, g){ if(typeof spuren === 'undefined') return; const q = spuren.quellen.find(e => e.o === o); if(q) q.g = g; else if(typeof spurQuelle === 'function') spurQuelle(o, { groesse: g }); }   // global-ok: Engine
function felsNah(x, z){
  const E = story.e6; if(!E.MEOTO || !E.MEOTO_FELS) return false;
  return E.MEOTO_FELS.some(F => Math.hypot(x - E.MEOTO.x, z - (E.MEOTO.z + F.dz)) < (F.rW || F.b * 0.7) + 4);
}
function wellenY(x, z){ return story.surfWellenY ? story.surfWellenY(x, z) : 0; }
function surfStart(J, S){
  const V = story.surfBrettVorlage && story.surfBrettVorlage(); if(!V) return false;   // Brett laedt noch
  sf.an = true; sf.seite = Math.random() < 0.5 ? 1 : -1; sf.t = Math.random() * 10;
  sf.x = S.x; sf.z = S.z + SURF_SEIT * sf.seite; sf.vx = sf.vz = 0; sf.y = wellenY(sf.x, sf.z); sf.luft = false; sf.naechster = 3 + Math.random() * 3;
  sf.sx = S.x; sf.sz = S.z; sf.yaw = Math.PI / 2;
  sf.brett = V.clone(true); J.obj.add(sf.brett);                               // Nase +Z wie Joshi
  J.obj.children[0].position.y += JOSHI_AUF_BRETT;
  if(J.obj.userData.schatten) J.obj.userData.schatten.visible = false;
  spurGroesse(J.obj, 1.6);                                          // Ringe und Gischt der Engine auf der Welle (finale.js spurWasserY)
  J.modus = 'surfen'; J.ziel = null; vonVorn(J, 'skate'); anim(J, 'skate');
  fuchsModus('strand');
  return true;
}
function surfEnde(J){
  sf.an = false;
  if(sf.brett){ J.obj.remove(sf.brett); sf.brett = null; J.obj.children[0].position.y -= JOSHI_AUF_BRETT; }
  if(J.obj.userData.schatten) J.obj.userData.schatten.visible = true;
  spurGroesse(J.obj, 0.5);
  J.obj.quaternion.identity();
  strandSetzen(J);
}
// zurueck an Land: neben dem Surfbrett im Sand (Samu landet im Ring)
function strandSetzen(J){
  const E = story.e6;
  for(let i = 0; i < 24; i++){ const a = Math.PI * 0.5 + i * 0.4; J.x = E.SURF.x + Math.sin(a) * (RING_MIN + 1); J.z = E.SURF.z + Math.cos(a) * (RING_MIN + 1); if(bodenFrei(J.x, J.z)) break; }
  J.yaw = -Math.PI / 2; J.modus = 'warten'; J.t = 2; anim(J, 'idle', 0.3); J.obj.quaternion.identity(); J.obj.visible = true;
  fuchsModus('folgen');
}
function surfSchritt(J, dt, S){
  // Samu wurde versetzt (Blende "Wieder raus zu den Wellen", Waschgang): Joshi kommt mit
  if(Math.hypot(S.x - sf.sx, S.z - sf.sz) > 25){ sf.x = S.x; sf.z = S.z + SURF_SEIT * sf.seite; sf.vx = sf.vz = 0; sf.luft = false; sf.y = wellenY(sf.x, sf.z); }
  const svx = (S.x - sf.sx) / Math.max(dt, 0.008), svz = (S.z - sf.sz) / Math.max(dt, 0.008);
  sf.sx = S.x; sf.sz = S.z; sf.t += dt;
  // eigene Linie: seitlich 7..13 m, vor/zurueck +-4 m, langsam pendelnd; an den Felsen auf die andere Seite
  let tx = S.x + 4 * Math.sin(sf.t * 0.23 + 1), tz = S.z + sf.seite * (SURF_SEIT + 3 * Math.sin(sf.t * 0.35));
  if(felsNah(tx, tz) || felsNah(sf.x, sf.z)){ sf.seite = -sf.seite; tz = S.z + sf.seite * SURF_SEIT; }
  if(!S.blende && dt > 0){
    // Tempo: Samus Tempo plus Zug zum eigenen Platz (weich, hoechstens 20 m/s)
    const wx = svx + (tx - sf.x) * 1.2, wz = svz + (tz - sf.z) * 1.2, k = Math.min(1, dt * 3);
    sf.vx += (kl(wx, -20, 20) - sf.vx) * k; sf.vz += (kl(wz, -20, 20) - sf.vz) * k;
    sf.x += sf.vx * dt; sf.z += sf.vz * dt;
  }
  // Blickrichtung = Fahrtrichtung (weich); die Wellen laufen mit WEL.V zum Strand, darauf faehrt er schraeg
  if(Math.hypot(sf.vx, sf.vz) > 1) sf.yaw += kl(wd(sf.yaw, Math.atan2(sf.vx, sf.vz)), -3 * dt, 3 * dt);
  const wy = wellenY(sf.x, sf.z);
  let flip = 0, spin = 0;
  if(sf.luft){
    sf.lt += dt; sf.vy -= SURF_G * dt; sf.y += sf.vy * dt;
    // Drehung nach der Flugzeit (ohne Welle: 2 v / g), schon bei 85 % fertig – so steht er beim Aufsetzen immer gerade
    const k = Math.min(1, sf.lt / (0.85 * sf.T)), e = k * k * (3 - 2 * k);
    flip = sf.trick.flip * Math.PI * 2 * e; spin = sf.trick.spin * Math.PI * 2 * e;
    if(sf.y <= wy && sf.lt > 0.3){ sf.y = wy; sf.luft = false; sf.naechster = 3 + Math.random() * 5; flip = spin = 0; }
  } else {
    sf.y = wy;
    if(!S.wasch && !S.blende && (sf.naechster -= dt) <= 0){
      sf.luft = true; sf.lt = 0; sf.vy = SURF_SPRUNG; sf.T = 2 * SURF_SPRUNG / SURF_G;
      sf.trick = SURF_TRICKS[Math.floor(Math.random() * SURF_TRICKS.length)];
    }
  }
  // auf dem Wasser: Nase mit dem Gefaelle der Welle (wie Samus Brett), in der Luft gerade
  const fx = Math.sin(sf.yaw), fz = Math.cos(sf.yaw);
  const neig = sf.luft ? 0 : Math.atan2(wellenY(sf.x + fx * 0.7, sf.z + fz * 0.7) - wellenY(sf.x - fx * 0.7, sf.z - fz * 0.7), 1.4);
  sf.neig += (neig - sf.neig) * Math.min(1, dt * 6);
  // ... und quer in die Welle gelegt wie Samu (finale.js: roll ueber 0,8 m): auf der steilen Front stach sonst die bergseitige
  // Kante samt Joshi in die Wasserwand (Live-Befund 23.10.2026). Rechts = -x im Modell (Blick +z)
  const rx = -Math.cos(sf.yaw), rz = Math.sin(sf.yaw);
  const roll = sf.luft ? 0 : Math.atan2(wellenY(sf.x + rx * 0.4, sf.z + rz * 0.4) - wellenY(sf.x - rx * 0.4, sf.z - rz * 0.4), 0.8);
  sf.roll += (roll - sf.roll) * Math.min(1, dt * 6);
  J.x = sf.x; J.z = sf.z;
  // Haltung: Drehung um einen Punkt SURF_DREHPUNKT ueber dem Brett (Koerpermitte), Brett bleibt an den Fuessen
  _qy.setFromAxisAngle(_sY, sf.yaw); _qs.setFromAxisAngle(_sY, spin); _qf.setFromAxisAngle(_sX, flip - sf.neig);
  J.obj.quaternion.copy(_qy).multiply(_qs).multiply(_qf).multiply(_qr.setFromAxisAngle(_sZ, -sf.roll));
  _sp.set(0, SURF_DREHPUNKT, 0).applyQuaternion(J.obj.quaternion);
  const g = fr.g;
  J.obj.position.set(sf.x - g.position.x - _sp.x, sf.y + 0.02 + SURF_DREHPUNKT - _sp.y - g.position.y, sf.z - g.position.z - _sp.z);
}


// ---- Joshi faehrt Snowboard mit (Live-Wunsch 23.10.2026, Finale Stufe 1) --------------------------------------------
// Auf der Piste (finale.js story.abLage) faehrt Joshi selbststaendig in Samus Naehe: mal nebenher, mal ueberholt er ihn und
// nimmt einen Kicker vor ihm, mal laesst er sich ueberholen, ab und zu laesst er einen Kicker aus. Grinden kann er nicht – Rails
// und Felsen faehrt er aus dem Weg. Auf den Kickern dieselben Tricks wie beim Surfen (Salto vor/zurueck, 360 links/rechts, Salto
// mit 360), immer sauber gelandet; sie zaehlen nicht zur Statistik. Er wirbelt Schnee auf und zieht Kantenspuren (in der Kurve
// nur die Innenkante, wie bei Samu). Er ist ein Koerper: Samu prallt an ihm ab (finale.js), Joshi weicht Samu aus. Ueber die
// Mega-Rampe fliegt er mit hinaus aufs Meer, verschwindet im Wasser und surft dann wieder neben Samu (sf oben).
// Beim Fallschirmsprung ist er nicht zu sehen (er ist erst auf der Piste da).
const SB = { abst: 6, rand: 0, rampenAus: 0.3, g: 14 };
const jb = { an: false, s: 0, q: 0, v: 2, y: 0, luft: false, vy: 0, hh: 0, lt: 0, T: 1, trick: null, modus: 'neben', modusT: 0, i: 0, ausLassen: new Set(),
  brett: null, spur: null, spurN: 0, spurLetzt: null, spray: [], sprayT: 0, mega: null, weg: false, qv: 0, schatten: null };
story.abJoshi = () => (jb.an && !jb.weg && !jb.mega ? { s: jb.s, q: jb.q, luft: jb.luft } : null);
function jbStart(J, A){
  const V = story.finaleBrett && story.finaleBrett(); if(!V) return false;
  Object.assign(jb, { an: true, s: A.s - 14, q: Math.max(-SB.rand, Math.min(SB.rand, A.q + (A.q > 0 ? -5 : 5))), v: Math.max(2, A.v), luft: false, vy: 0, hh: 0, lt: 0,
    trick: null, modus: 'neben', modusT: 6, i: 0, mega: null, weg: false, qv: 0, spurLetzt: null, spin: 0, flip: 0 });
  jb.ausLassen.clear();
  SB.rand = story.abMass.RAND;
  jb.brett = V.clone(true); J.obj.add(jb.brett); J.obj.children[0].position.y += JOSHI_AUF_BRETT;
  // Schatten: der Engine-Tierschatten haengt an Joshi (laege unter dem Brett, floege im Sprung mit) – auf der Piste stattdessen
  // Samus Hangschatten auf dem Schnee (finale.js hangSchatten)
  if(J.obj.userData.schatten) J.obj.userData.schatten.visible = false;
  if(!jb.schatten && story.abSchattenNeu){ jb.schatten = story.abSchattenNeu(); scene.add(jb.schatten); }   // global-ok: liegt auf der Piste
  spurGroesse(J.obj, 0.5); J.obj.userData.keineSpur = true;         // Engine-Staub aus: eigene Schneespur (wie Samu)
  J.modus = 'snowboard'; J.ziel = null; vonVorn(J, 'skate'); anim(J, 'skate');
  if(!jb.spur){ const P = new Float32Array(220 * 12), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    jb.spur = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa9bfd6, transparent: true, opacity: 0.8, fog: false })); jb.spur.frustumCulled = false; jb.spurPos = P;
    scene.add(jb.spur); jb.sprayMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }); }   // global-ok: liegt auf der Piste
  jb.spur.visible = true; jb.spurN = 0; jb.spur.geometry.setDrawRange(0, 0);
  return true;
}
function jbEnde(J){
  jb.an = false;
  if(jb.brett){ J.obj.remove(jb.brett); jb.brett = null; J.obj.children[0].position.y -= JOSHI_AUF_BRETT; }
  if(jb.spur) jb.spur.visible = false; if(jb.schatten) jb.schatten.visible = false; for(const p of jb.spray) p.m.visible = false;
  J.obj.userData.keineSpur = false; J.obj.quaternion.identity();
  if(J.obj.userData.schatten) J.obj.userData.schatten.visible = true;
  J.obj.visible = true;
}
// Was liegt vor Joshi? Hindernisse in (von, bis) m voraus
function vorJoshi(von, bis){ return (story.abHinder() || []).filter(h => h.s - jb.s > von && h.s - jb.s < bis); }
function jbSchritt(J, dt, A){
  const RAND = SB.rand, VMAX = story.abMass.VMAX;
  // Mega-Rampe: eigener Bogen hinaus aufs Meer, im Wasser verschwindet er (dann surft er, sobald Samu surft)
  if(jb.mega){
    const m = jb.mega; m.t += dt; m.vy -= 9.81 * dt; m.y += m.vy * dt; m.x += m.tx * m.vh * dt; m.z += m.tz * m.vh * dt;
    const k = Math.min(1, m.t / 1.4), e = k * k * (3 - 2 * k), flip = jb.megaTrick.flip * Math.PI * 2 * e, spin = jb.megaTrick.spin * Math.PI * 2 * e;
    J.x = m.x; J.z = m.z;
    const meer = typeof seaYAt === 'function' ? seaYAt(m.x, m.z) : 0;                                      // global-ok: Engine
    if(jb.schatten) jb.schatten.visible = false;
    if(m.y < meer + 0.3){ jb.weg = true; J.obj.visible = false; return; }
    jbPose(J, m.x, m.y, m.z, Math.atan2(m.tx, m.tz), 0, 0, spin, flip, false); return;
  }
  if(jb.weg) return;
  // Modus wechseln: nebenher, ueberholen (vor ihm Kicker nehmen), sich ueberholen lassen
  if((jb.modusT -= dt) <= 0){ const r = Math.random(); jb.modus = r < 0.35 ? 'neben' : r < 0.7 ? 'vorne' : 'hinten'; jb.modusT = 8 + Math.random() * 7; }
  const sollAb = jb.modus === 'vorne' ? 14 : jb.modus === 'hinten' ? -14 : 1.5;
  // Tempo: auf Samu abgestimmt, darf etwas schneller sein (zum Ueberholen)
  if(!jb.luft){ const soll = A.v + (A.s + sollAb - jb.s) * 0.3; jb.v += (Math.max(1.5, Math.min(VMAX * 1.15, soll)) - jb.v) * Math.min(1, dt * 1.2); }
  // Querlage: neben Samu (SB.abst), Felsen und Rails ausweichen, Kicker anfahren (ausser er laesst ihn aus)
  let zielQ = A.q + (jb.q >= A.q ? SB.abst : -SB.abst);
  if(Math.abs(zielQ) > RAND - 1) zielQ = A.q - Math.sign(zielQ) * SB.abst;
  for(const h of vorJoshi(-2, 28)){
    if(h.typ === 'rampe' && !jb.ausLassen.has(h)){ if(h.s - jb.s > 26 && Math.random() < SB.rampenAus * dt * 2) jb.ausLassen.add(h); else if(!jb.ausLassen.has(h)) zielQ = h.q; }
    if(h.typ === 'mega') zielQ = Math.max(-h.W / 2 + 2, Math.min(h.W / 2 - 2, zielQ));
  }
  for(const h of vorJoshi(-3, 22)){
    const breite = h.typ === 'fels' ? h.r + 1.6 : h.typ === 'rail' ? 2.2 : h.typ === 'rampe' && jb.ausLassen.has(h) ? h.W / 2 + 1.5 : 0;
    if(breite && Math.abs(zielQ - h.q) < breite) zielQ = h.q + (zielQ >= h.q ? breite : -breite);
    if(h.typ === 'rail' && jb.s > h.s - 3 && jb.s < h.s + story.abMass.RAIL_L + 1 && Math.abs(zielQ - h.q) < 2.2) zielQ = h.q + (jb.q >= h.q ? 2.4 : -2.4);
  }
  // Samu ist ein Koerper: nah bei ihm Abstand halten
  if(Math.abs(A.s - jb.s) < 3 && Math.abs(zielQ - A.q) < 2) zielQ = A.q + (jb.q >= A.q ? 2.2 : -2.2);
  zielQ = Math.max(-RAND, Math.min(RAND, zielQ));
  if(!jb.luft){ jb.qv += (Math.max(-6, Math.min(6, (zielQ - jb.q) * 1.6)) - jb.qv) * Math.min(1, dt * 4); jb.q += jb.qv * dt; }
  jb.q = Math.max(-RAND, Math.min(RAND, jb.q));
  jb.s += jb.v * (jb.luft ? 1.15 : 1) * dt;
  const o = story.abOrt(jb, jb.s, jb.q), grund = grundJ(0, 0);
  // Kicker / Mega unter ihm?
  let auf = null, hKick = 0;
  if(!jb.luft) for(const h of story.abHinder()) if((h.typ === 'rampe' || h.typ === 'mega') && jb.s > h.s - h.L && jb.s <= h.s && Math.abs(jb.q - h.q) < h.W / 2){ auf = h; hKick = h.H * (jb.s - (h.s - h.L)) / h.L; }
  let spin = 0, flip = 0;
  if(jb.luft){
    jb.lt += dt; jb.vy -= SB.g * dt; jb.hh += jb.vy * dt;
    const k = Math.min(1, jb.lt / (0.85 * jb.T)), e = k * k * (3 - 2 * k);
    if(jb.trick){ flip = jb.trick.flip * Math.PI * 2 * e; spin = jb.trick.spin * Math.PI * 2 * e; }
    if(jb.hh <= 0 && jb.lt > 0.25){ jb.luft = false; jb.hh = 0; jb.trick = null; schneePuff(o, 8); }
    jb.y = grund + Math.max(0, jb.hh);
  } else {
    if(jb.rampe && jb.rampe !== auf && jb.s > jb.rampe.s - 0.5){
      if(jb.rampe.typ === 'mega'){ megaJoshi(J, o); return; }
      // abheben wie Samu ohne B: ~8 m ueber den Hang, ein Trick, Drehung vor dem Aufsetzen fertig
      jb.luft = true; jb.lt = 0; jb.hh = jb.rampe.H; jb.vy = 8 + jb.v * 0.35;
      jb.T = (jb.vy + Math.sqrt(jb.vy * jb.vy + 2 * SB.g * jb.hh)) / SB.g;
      jb.trick = SURF_TRICKS[Math.floor(Math.random() * SURF_TRICKS.length)];
    }
    jb.rampe = auf;
    jb.y = grund + hKick;
  }
  J.x = o.x; J.z = o.z;
  const carve = -jb.qv * 0.06;                                         // in die Kurve legen
  jbPose(J, o.x, jb.y, o.z, Math.atan2(o.tx, o.tz) + jb.qv * 0.03, jb.luft ? 0 : neigung(), carve, spin, flip, !jb.luft);
  if(jb.schatten){ jb.schatten.visible = J.obj.visible; if(J.obj.visible) story.abSchatten(jb.schatten, { x: o.x, y: jb.y, z: o.z }, o, grundJ); }
  schneeSpur(o, !jb.luft && !auf, dt);
}
// Schneehoehe v m vor und r m rechts von Joshi – aus seinen Pisten-Koordinaten (finale.js abGrundSQ, glatt; abGrund(x, z) ruckelte)
function grundJ(v, r){ if(story.abGrundSQ) return story.abGrundSQ(jb, jb.s + v, jb.q + r); const o = story.abOrt(jb, jb.s + v, jb.q + r); return story.abGrund(o.x, o.z); }
// Gefaelle in Fahrtrichtung (1,4 m Brett)
function neigung(){ return Math.atan2(grundJ(0.7, 0) - grundJ(-0.7, 0), 1.4); }
const _jq = new THREE.Quaternion(), _jq2 = new THREE.Quaternion(), _jq3 = new THREE.Quaternion(), _jq4 = new THREE.Quaternion(), _jp = new THREE.Vector3();
// Drehpunkt wie bei Samu (finale.js pose): am Boden die Brettmitte unten (liegt satt auf – um 0,6 m darueber gedreht hob ihn
// das Gefaelle an, Live-Befund 26.10.2026), in der Luft die Koerpermitte (Tricks drehen um den Bauch)
function jbPose(J, x, y, z, yaw, neig, roll, spin, flip, amBoden){
  J.obj.quaternion.setFromAxisAngle(_sY, yaw).multiply(_jq.setFromAxisAngle(_sY, spin)).multiply(_jq2.setFromAxisAngle(_sX, flip - neig)).multiply(_jq3.setFromAxisAngle(_sZ, roll));
  const mitte = amBoden ? 0 : SURF_DREHPUNKT;
  _jp.set(0, mitte, 0).applyQuaternion(J.obj.quaternion); const g = fr.g;
  J.obj.position.set(x - g.position.x - _jp.x, y + 0.03 + mitte - _jp.y - g.position.y, z - g.position.z - _jp.z);
}
// Mega-Rampe: wie Samu weit hinaus, mit einem Trick im Bogen
function megaJoshi(J, o){
  jb.mega = { x: o.x, z: o.z, tx: o.tx, tz: o.tz, vh: 30 + jb.v, y: jb.y, vy: 16 + jb.v * 0.5, t: 0 };
  jb.megaTrick = SURF_TRICKS[Math.floor(Math.random() * SURF_TRICKS.length)];
}
// Kantenspuren (je Kante ein Strich pro 0,6 m; in der Kurve nur die Innenkante) und Schneespray hinter dem Brett
function schneeSpur(o, amBoden, dt){
  const p = { x: o.x, z: o.z };
  if(amBoden){
    const qx = -o.tz * 0.13, qz = o.tx * 0.13, L = [p.x - qx, p.z - qz], R = [p.x + qx, p.z + qz], l = jb.spurLetzt;
    if(!l || Math.hypot(p.x - l[4], p.z - l[5]) > 0.6){
      if(l){ const P = jb.spurPos, i = (jb.spurN % 220) * 12, yl = story.abGrund(L[0], L[1]) + 0.05, yr = story.abGrund(R[0], R[1]) + 0.05, links = jb.qv < 2, rechts = jb.qv > -2;
        P.set(links ? [l[0], l[6], l[1], L[0], yl, L[1]] : [l[0], -1e4, l[1], l[0], -1e4, l[1]], i);
        P.set(rechts ? [l[2], l[7], l[3], R[0], yr, R[1]] : [l[2], -1e4, l[3], l[2], -1e4, l[3]], i + 6);
        jb.spurN++; jb.spur.geometry.attributes.position.needsUpdate = true; jb.spur.geometry.setDrawRange(0, Math.min(jb.spurN, 220) * 4); }
      jb.spurLetzt = [L[0], L[1], R[0], R[1], p.x, p.z, story.abGrund(L[0], L[1]) + 0.05, story.abGrund(R[0], R[1]) + 0.05];
    }
    jb.sprayT -= dt;
    if(jb.sprayT <= 0 && jb.v > 4){ jb.sprayT = 0.035; let s = jb.spray.find(q => !q.m.visible);
      if(!s && jb.spray.length < 50){ s = { m: new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), jb.sprayMat), v: new THREE.Vector3() }; scene.add(s.m); jb.spray.push(s); }   // global-ok
      if(s){ const seite = (Math.random() < 0.5 ? -1 : 1) + jb.qv * 0.1; s.m.visible = true; s.t = 0; s.m.position.set(o.x - o.tx * 0.8, jb.y + 0.1, o.z - o.tz * 0.8);
        s.v.set(-o.tx * jb.v * 0.25 - o.tz * seite * 2.5, 1.5 + Math.random() * 2, -o.tz * jb.v * 0.25 + o.tx * seite * 2.5); } }
  } else jb.spurLetzt = null;
  for(const s of jb.spray) if(s.m.visible){ s.t += dt; s.v.y -= 9.81 * dt; s.m.position.addScaledVector(s.v, dt); s.m.scale.setScalar(Math.max(0.1, 1 - s.t * 1.5)); if(s.t > 0.6) s.m.visible = false; }
}
function schneePuff(o, n){
  for(let i = 0; i < n; i++){ let s = jb.spray.find(q => !q.m.visible); if(!s) return; const a = Math.random() * 6.28;
    s.m.visible = true; s.t = 0; s.m.position.set(o.x, jb.y + 0.1, o.z); s.v.set(Math.cos(a) * 3, 1.5 + Math.random() * 2, Math.sin(a) * 3); }
}

// ---- Aufbau und Schritt -------------------------------------------------------------------------------------------
function setzeIn(w){ const g = fr.g; w.obj.position.set(w.x - g.position.x, evaFootY(w.x, w.z) - g.position.y, w.z - g.position.z); }
function aufbauen(){
  const g = story.e6festland.g;
  if(fr.j && fr.f){ fr.g = g; g.add(fr.j.obj); g.add(fr.f.obj); return; }    // Welt neu gebaut: umhaengen
  if(fr.laedt || !window.JOSHI_GLB || !window.FUCHSI_GLB || !THREE.GLTFLoader) return;
  fr.laedt = true;
  ladeJoshi((J) => ladeFuchs((F) => {
    const E = story.e6, a0 = Math.PI * 0.35;                                    // Startplatz: im Ring, zum Land hin
    for(let i = 0; i < 24; i++){ const a = a0 + i * 0.5; J.x = E.SURF.x + Math.sin(a) * 13; J.z = E.SURF.z + Math.cos(a) * 13; if(bodenFrei(J.x, J.z)) break; }
    J.yaw = Math.atan2(E.SURF.x - J.x, E.SURF.z - J.z);
    F.x = J.x + 1.4; F.z = J.z + 0.6; F.yaw = J.yaw;
    fr.j = J; fr.f = F; fr.g = story.e6festland.g;
    for(const w of [J, F]){ fr.g.add(w.obj); setzeIn(w); }
    if(story.tierSchatten){ story.tierSchatten(J.obj, 0.5, 0.42); story.tierSchatten(F.obj, 0.75, 0.3); }
  }));
}
function schritt(dt){
  const S = story.surfLage && story.surfLage(), A = story.abLage && story.abLage();
  if(!hier() && !S && !A){ if(fr.j) fr.j.obj.visible = fr.f.obj.visible = false; fr.jam = false; gitarre(false); return; }   // Transall, Fallschirm: nicht zu sehen
  if(!fr.j || fr.g !== story.e6festland.g) aufbauen();
  const J = fr.j, F = fr.f; if(!J || !F || !J.obj.parent) return;
  // Piste (Snowboard), Meer (Surfen), Strand – in dieser Reihenfolge
  if(A && !jb.an && !S){ if(sf.an) surfEnde(J); if(!jbStart(J, A)) return; fuchsModus('strand'); }
  if(!A && jb.an){ jbEnde(J); if(!S) strandSetzen(J); }
  if(S && !sf.an && !jb.an && !surfStart(J, S)) return;
  if(!S && sf.an) surfEnde(J);
  const cp = camera.position, d = Math.hypot(J.x - cp.x, J.z - cp.z), dF = Math.hypot(F.x - cp.x, F.z - cp.z);
  J.obj.visible = d < SICHT && !(jb.an && jb.weg); F.obj.visible = dF < SICHT;
  if(jb.an){ fr.jam = false; jbSchritt(J, dt, A); }
  else if(sf.an){ fr.jam = false; surfSchritt(J, dt, S); }
  else { joshiSchritt(J, dt); J.obj.rotation.set(0, J.yaw, 0); setzeIn(J); }
  fuchsSchritt(F, dt); setzeIn(F); fuchsHaltung(F);
  if(d < ANIM) J.mixer.update(dt);
  if(dF < ANIM) F.mixer.update(dt);
  gitarre(J.modus === 'jam', d);
}

// Grenzen: Samu und Barki laufen nicht durch die zwei hindurch (Joshi auf dem Wasser zaehlt nicht)
if(story.tierQuelle) story.tierQuelle(() => {
  if(!fr.j || !(hier() || sf.an || jb.an)) return null;
  const l = [];
  if(!sf.an && !jb.an && fr.j.obj.visible) l.push({ x: fr.j.x, z: fr.j.z, y: evaFootY(fr.j.x, fr.j.z), r: JOSHI_R, h: JOSHI_H });
  if(fr.f.obj.visible) l.push({ x: fr.f.x, z: fr.f.z, y: evaFootY(fr.f.x, fr.f.z), r: FUCHS_R, h: 0.5 });
  return l;
});
story.surfJoshiTest = () => sf;                                    // Tests
story.strandFreundeTest = () => Object.assign(fr, { tanzMusik: tanz });   // Tests

let tVor = 0;
const startVorher = window.STORY_START;
window.STORY_START = function(){
  // vor dem Rendern (in updateCamera, wie finale.js): nach loop() gesetzt hinkte Joshi ein Bild hinter Samu und der Kamera her
  // und ruckelte bei schwankender Bildrate auf der Piste (Live-Befund 26.10.2026)
  const camOrig = updateCamera;
  updateCamera = function(){
    // Zeit wie die Engine (dtCam): bei niedriger Bildrate bremst sie ihre Zeit – Joshi faehrt sonst Samu davon (Live-Pruefung)
    const t = performance.now(), dt = tVor ? (typeof dtCam === 'number' ? dtCam : Math.min(0.1, (t - tVor) / 1000)) : 0; tVor = t;   // global-ok: Engine
    schritt(dt);
    return camOrig.apply(this, arguments);
  };
  // Pause (Hilfe offen): die Engine ruft updateCamera nicht – dann die Musik aus
  const loopOrig = loop;
  loop = function(){
    const r = loopOrig.apply(this, arguments);
    if(document.getElementById('hint') && document.getElementById('hint').classList.contains('show')) gitarre(false);
    return r;
  };
  if(startVorher) return startVorher.apply(this, arguments);
};
})();
