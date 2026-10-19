// Die Abenteuer von Samu (SFG) – Hund als Begleiter (Live-Wunsch 18.10.2026, Vorbild: der Fuchs in "Das Geheimland").
// Laedt nach tiere.js (und shiba_glb.js, bellen_snd.js), vor der Engine.
// Modell: Shiba Inu Doggy by aaadragon (Sketchfab), CC-BY-4.0 – Clips Dog|Idle, Dog|Walk, Dog|Run, Dog|Jump, Dog|SitDown
// (alle auf der Stelle; bewegt wird er hier). Kopf auf +Z. Bellen: Friendly Big Dog Bark 1 von yodguard (Pixabay).
//
// Verhalten (wie der Fuchs):
//   streifen – laeuft Samu, begleitet er ihn frei: Punkte um Samu herum, bevorzugt vor ihm, schnuppern, mal kurz
//              sitzen, Freudensprung. Entfernt sich Samu, kommt er hinterher.
//   kommen   – bleibt Samu stehen, kommt er an und setzt sich neben ihn (links, gleiche Blickrichtung).
//   tollen   – geht Samu in den Leerlauf (Moonwalk von selbst) oder tanzt Hip Hop, springt er vor ihm hin und her.
//   knien    – B: Samu kniet, der Hund rennt vor ihn, springt freudig (spielen) und setzt sich dann neben ihn.
//   strand   – Finale (Fallschirm, Snowboard, Surfen): er bleibt am Fukuoka-Beach sitzen.
// Der Hund ist ein Koerper: Samu laeuft nicht durch ihn, er laeuft nicht durch Grenzen (story.tiefe), nicht ins Wasser
// und um die anderen Tiere herum (story.tierListe, tiere.js). Sitzende Moewen fliegen vor ihm auf (story.scheuchQuellen).
// Nicht dabei: im Fahrzeug, im Wasser (Samu schwimmt: er wartet am Ufer), im All. Auf Mond und Mars ist er dabei
// (Live-Wunsch 18.10.2026): dort haengt er in der Szene, denn die Erd-Welten sind dort ausgeblendet.
(function(){
'use strict';
const story = window.STORY;
const klemme = (v, a, b) => Math.max(a, Math.min(b, v));
function winkelDiff(a, b){ const d = b - a; return Math.atan2(Math.sin(d), Math.cos(d)); }

const HUND_LANG = 0.78;                    // m Nase bis Schwanz (Shiba: ~0,7-0,8 m)
const HUND_R = 0.22, HUND_H = 0.55;        // Koerper (Saeule) fuer Grenzen
const SAMU_R = 0.28, ABSTAND_MIN = SAMU_R + HUND_R;
const HA = { stehen: 'Dog|Idle', gehen: 'Dog|Walk', rennen: 'Dog|Run', springen: 'Dog|Jump', sitzen: 'Dog|SitDown' };
// SitDown (3,96 s) = hinsetzen (bis 0,9 s), sitzen (bis ~2,9 s), aufstehen (bis zum Ende) – als ein Clip, hier zerlegt
const SITZ_AB = 0.9, SITZ_BIS = 2.85;
const STREIF_R = 8, STREIF_MAX = 15, NACHHOLEN = 60;
// Live-Befund 19.10.2026: "wenn Samu rennt, bleibt Barki immer hinten dran". Samu rennt 6 m/s (EVA_SPEED), Barki lief
// hoechstens 7 – und seine Ziele lagen da, wo Samu beim Aussuchen WAR, dazu wartete er an jedem 0,8 bis 3,3 s. Jetzt:
// laeuft Samu, sind die Ziele an ihm festgemacht (vor/quer relativ zu Samu, sie wandern mit), Barki sprintet bis
// HUND_SPRINT, wenn er hinten liegt. Schnuppern darf er (Live-Wunsch 19.10.2026: "er kann ja schnuppern, aber rennt immer
// ein wenig vorne weg; aendert Samu die Richtung, muss er halt schnell ueberholen") – nur kurz, und sobald Samu an ihm
// vorbei ist oder woanders hinlaeuft (er liegt nicht mehr VOR ihm), bricht er ab und sprintet wieder nach vorn.
const HUND_SPRINT = 9.5;                   // m/s, wenn er hinter dem laufenden Samu liegt (Samu rennt 6)
// Live-Wunsch 19.10.2026: "Barki kann einfach immer ca. 5 bis 10 m Vorsprung haben". Laeuft Samu, haelt Barki einen Platz
// VORAUS_MIN..VORAUS_MAX vor ihm in Laufrichtung (die zeigt der Stick: eva.yaw), leicht zur Seite versetzt und ab und zu
// wechselnd; dort schnuppert er, faellt er zurueck, sprintet er wieder vor. Liegt in Laufrichtung ein Einstieg (Y: Ring,
// Flieger – story.einstiege), laeuft er schon hin, setzt sich und wartet; dreht Samu ab, steht er auf und ueberholt.
const VORAUS_MIN = 5, VORAUS_MAX = 10, VORAUS_QUER = 2.5;
const EINSTIEG_SICHT = 40;                 // m: so weit voraus erkennt er einen Einstieg
const EINSTIEG_KEGEL = 0.35;               // rad (20 Grad) um die Laufrichtung
// Schrecksekunde (Live-Wunsch 19.10.2026: "sonst wirkt es, als wuerde man ihn mitsteuern"): Barki folgt beim Vorauslaufen
// nicht Samus Richtung selbst, sondern seiner Wahrnehmung davon (V.blick). Kleine Aenderungen zieht er gleich weich mit;
// eine deutliche (ueber SCHRECK_WINKEL) merkt er erst nach SCHRECK_MIN..MAX s und dreht dann zuegig nach (SCHRECK_DREH).
const SCHRECK_WINKEL = 0.45, SCHRECK_MIN = 0.5, SCHRECK_MAX = 0.8, SCHRECK_DREH = 4.5, KLEIN_DREH = 2.0;
function barkiBlick(V, dt){
  if(V.blick === undefined){ V.blick = eva.yaw; V.schreck = 0; }
  const diff = winkelDiff(V.blick, eva.yaw);
  if(Math.abs(diff) < SCHRECK_WINKEL && !(V.schreck > 0)){ V.blick += klemme(diff, -KLEIN_DREH * dt, KLEIN_DREH * dt); return V.blick; }
  // deutliche Aenderung: erst die Schrecksekunde, dann nachdrehen
  if(!(V.schreck > 0) && !V.dreht){ V.schreck = SCHRECK_MIN + Math.random() * (SCHRECK_MAX - SCHRECK_MIN); }
  if(V.schreck > 0){ V.schreck -= dt; if(V.schreck <= 0){ V.schreck = 0; V.dreht = true; } return V.blick; }
  V.blick += klemme(diff, -SCHRECK_DREH * dt, SCHRECK_DREH * dt);
  if(Math.abs(winkelDiff(V.blick, eva.yaw)) < 0.05) V.dreht = false;
  return V.blick;
}
const STEH_KOMMEN = 1.2;                   // s Samu steht -> Hund kommt und setzt sich
// Live-Befund 19.10.2026: Barki tollte und bellte schon nach 14 s, Samu ging aber erst nach 25 s in den Leerlauf (Moonwalk,
// story.js MOON_NACH). Jetzt haengt das Tollen an Samus Leerlauf selbst und nicht an einer eigenen Uhr: es beginnt, wenn
// sein Moonwalk beginnt. Darf er dort nicht (am Wasser), bleibt er stehen – dann tollt Barki ab TOLL_NACH trotzdem.
const TOLL_NACH = 30;                      // s Samu steht, ohne in den Leerlauf zu gehen -> der Hund tollt trotzdem
const TOLL_ABST = 3.2, TOLL_BREIT = 1.6;   // m vor Samu, m zur Seite
const hund = story.hund = { obj: null, inner: null, mixer: null, acts: {}, cur: null, yaw: 0, aktiv: false,
  modus: 'streifen', ziel: null, warte: 0, t: 0, sitzt: false, tun: null, steht: 0, kniet: false, bellT: 3 };

// ---- Laden ---------------------------------------------------------------------------------------------
function ladeHund(){
  if(!window.SHIBA_GLB || !THREE.GLTFLoader) return;
  const b = atob(window.SHIBA_GLB.split(',')[1]), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  new THREE.GLTFLoader().parse(u.buffer, '', (g) => {
    const obj = g.scene;
    obj.traverse(o => { if(o.isMesh){ o.frustumCulled = false; o.castShadow = false; } });
    // Mass in der Stehhaltung (gemessen in C:\tmp\sfg\hund\t2.html: 0,78 m lang, Kopf +Z, Fuesse bei y = 0)
    const mx = new THREE.AnimationMixer(obj);
    for(const c of g.animations) hund.acts[c.name] = mx.clipAction(c);
    if(hund.acts[HA.stehen]) hund.acts[HA.stehen].play();
    mx.update(0.01); obj.updateMatrixWorld(true);
    const bb = new THREE.Box3(), p = new THREE.Vector3();
    obj.traverse(m => { if(!m.isSkinnedMesh) return; const n = m.geometry.attributes.position.count;
      for(let i = 0; i < n; i += 2){ m.boneTransform(i, p); p.applyMatrix4(m.matrixWorld); bb.expandByPoint(p); } });
    if(bb.isEmpty()) bb.setFromObject(obj);
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()), k = HUND_LANG / Math.max(0.01, sz.z);
    const inner = new THREE.Group(); inner.add(obj);
    obj.scale.multiplyScalar(k); obj.position.set(-c.x * k, -bb.min.y * k, -c.z * k);
    const wrap = new THREE.Group(); wrap.add(inner); wrap.name = 'hund';
    // Grenzen: der Hund ist ein Begleiter mit eigenen Regeln, kein Ding (objekte.js) – sonst sperrte er sich selbst
    wrap.userData.agent = true; wrap.userData.deko = true;
    wrap.userData.fremd = true;                        // weltEntsorgen: nur abhaengen, er kommt in die naechste Welt mit
    // eigener weicher Bodenschatten (wie Samus Ovalschatten, blasser)
    if(typeof ovalShadowMat !== 'undefined'){
      const s = new THREE.Mesh(new THREE.CircleGeometry(1, 24), ovalShadowMat.clone());
      s.material.opacity = 0.22; s.rotation.x = -Math.PI / 2; s.scale.set(0.2, 0.42, 1); s.position.y = 0.05; s.userData.deko = true;
      wrap.add(s); hund.schatten = s;
    }
    hund.obj = wrap; hund.inner = inner; hund.mixer = mx; hund.cur = HA.stehen;
  }, (e) => console.warn('Hund-GLB:', e));
}

// ---- Animation -----------------------------------------------------------------------------------------
function anim(name, blend){
  if(hund.cur === name || !hund.acts[name]) return;
  const a = hund.acts[name], alt = hund.cur && hund.acts[hund.cur];
  for(const n in hund.acts){ const b = hund.acts[n]; if(b !== a && b !== alt) b.stop(); }
  a.reset(); a.setEffectiveWeight(1);
  if(name === HA.springen || name === HA.sitzen){ a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
  else a.setLoop(THREE.LoopRepeat);
  a.play();
  if(alt && alt !== a) alt.crossFadeTo(a, blend || 0.25, false);
  hund.cur = name;
}
function laeuft(name){ const a = hund.acts[name]; return hund.cur === name && a && a.time < a.getClip().duration - 0.03; }
// Hinsetzen: SitDown bis zur Sitzhaltung abspielen und dort anhalten; aufstehen: den Rest abspielen
function setzen(){
  if(hund.sitzt) return;
  hund.sitzt = true; hund.sitzT = 0; anim(HA.sitzen, 0.25);
  const a = hund.acts[HA.sitzen]; if(a){ a.paused = false; a.timeScale = 1; }
}
function aufstehen(){
  if(!hund.sitzt) return;
  hund.sitzt = false;
  const a = hund.acts[HA.sitzen];
  if(a && hund.cur === HA.sitzen){ a.paused = false; if(a.time < SITZ_BIS) a.time = SITZ_BIS; a.timeScale = 1.4; }
}
function sitzPflege(){
  const a = hund.acts[HA.sitzen]; if(!a || hund.cur !== HA.sitzen) return;
  if(hund.sitzt){ if(a.time >= SITZ_AB + 0.6) { a.time = SITZ_AB + 0.6; a.paused = true; } }
}
function stehtAuf(){ return hund.cur === HA.sitzen && !hund.sitzt && laeuft(HA.sitzen); }

// ---- Wo darf er hin? -----------------------------------------------------------------------------------
function tierNah(x, z){
  const l = story.tierListe && story.tierListe(); if(!l) return false;
  for(const t of l) if(Math.hypot(x - t.x, z - t.z) < (t.r || 0.5) + HUND_R) return true;
  return false;
}
function frei(x, z, von){
  if(!evaSolid(x, z) || locale === 'space') return false;
  if(locale !== 'earth'){                                    // Mond/Mars: Boden, das Fahrzeug (story.tiefe), sonst frei
    const fy = evaFootY(x, z), t = story.tiefe ? story.tiefe(x, z, fy, HUND_H, HUND_R, 0.15) : -1;
    return !(t > 0 && !(von && t <= story.tiefe(von.x, von.z, evaFootY(von.x, von.z), HUND_H, HUND_R, 0.15) + 1e-6));
  }
  const fy = evaFootY(x, z);
  if(typeof seaYAt === 'function' && fy < seaYAt(x, z) - 0.15) return false;     // nicht ins Wasser
  if(story.tiefe){
    const t = story.tiefe(x, z, fy, HUND_H, HUND_R, 0.15);
    if(t > 0 && !(von && t <= story.tiefe(von.x, von.z, evaFootY(von.x, von.z), HUND_H, HUND_R, 0.15) + 1e-6)) return false;
  }
  const hb = story.hitsOhneDinge || hitsBuilding;
  if(hb(x, fy + 0.4, z, false) && !(von && hb(von.x, evaFootY(von.x, von.z) + 0.4, von.z, false))) return false;
  if(tierNah(x, z) && !(von && tierNah(von.x, von.z))) return false;
  return true;
}
function schrittFrei(hp, x, z){
  if(!frei(x, z, hp)) return false;
  if(eva && eva.group){ const g = eva.group.position, neu = Math.hypot(x - g.x, z - g.z);
    if(neu < ABSTAND_MIN && neu < Math.hypot(hp.x - g.x, hp.z - g.z)) return false; }
  return true;
}
// "Bei Fuss" (Live-Wunsch 18.10.2026, Barki): dicht links neben Samu, auf Hoehe seiner Fuesse – Koerper an Koerper
// (Samu 0,28 m + Hund 0,22 m Radius, dazu 5 cm Luft). Gesetzt wird erst dort; wer blockiert ist, setzt sich nur, wenn er
// schon fast da ist (sonst sass er vorher irgendwo rechts, weil der Weg um Samu herum kurz blockiert war).
const FUSS_VOR = 0.12, FUSS_LINKS = ABSTAND_MIN + 0.05, FUSS_NAH = 0.6;
function beiFuss(){ return neben(FUSS_VOR, FUSS_LINKS); }
function beiFussSetzen(d){ if(d < 0.12 || (hund.blockiert && d < FUSS_NAH)){ setzen(); return true; } return false; }
function neben(vor, links, blick){
  const p = eva.group.position, y = blick === undefined ? eva.yaw : blick;
  const fx = -Math.sin(y), fz = -Math.cos(y), lx = -Math.cos(y), lz = Math.sin(y);
  return { x: p.x + fx * vor + lx * links, z: p.z + fz * vor + lz * links };
}
// freien Platz nahe (x, z) fuer den Hund
function freierPlatz(x, z){
  if(frei(x, z)) return { x, z };
  for(let r = 0.3; r <= 6; r += 0.3) for(let i = 0; i < 12; i++){
    const a = i / 12 * Math.PI * 2 + r, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if(frei(px, pz)) return { x: px, z: pz };
  }
  return null;
}

// Laufen zum Punkt (zx, zz), tempo m/s. Um Samu und Hindernisse herum (wie fuchsLaufe). Rueckgabe: Restabstand.
function laufe(dt, zx, zz, tempo){
  const hp = hund.obj.position;
  const dx = zx - hp.x, dz = zz - hp.z, d = Math.hypot(dx, dz);
  if(d < 0.05) return d;
  if(hund.sitzt) aufstehen();                       // aus dem Sitzen heraus: erst aufstehen
  if(stehtAuf()) return d;
  let soll = Math.atan2(dx, dz);
  if(eva && eva.group){
    const g = eva.group.position, gx = g.x - hp.x, gz = g.z - hp.z, gd = Math.hypot(gx, gz);
    const vor = (gx * dx + gz * dz) / d, seit = (gx * dz - gz * dx) / d, UM = ABSTAND_MIN + 0.35;
    if(vor > 0 && vor < d + 0.2 && Math.abs(seit) < UM && gd > 0.05)
      soll = Math.atan2(gx, gz) + (seit > 0 ? -1 : 1) * Math.min(Math.PI / 2, Math.asin(Math.min(1, UM / gd)) + 0.15);
  }
  const schritt = Math.max(0.15, tempo * dt);
  const geht = (w) => schrittFrei(hp, hp.x + Math.sin(w) * schritt, hp.z + Math.cos(w) * schritt);
  if(!geht(soll)){
    let gefunden = null;
    const seiten = hund.umSeite ? [hund.umSeite, -hund.umSeite] : [1, -1];
    for(let a = 0.3; a <= 2.1 && gefunden === null; a += 0.3) for(const sd of seiten){ if(geht(soll + sd * a)){ gefunden = soll + sd * a; hund.umSeite = sd; break; } }
    if(gefunden !== null){ soll = gefunden; hund.umT = 0.6; }
  } else if((hund.umT = (hund.umT || 0) - dt) <= 0) hund.umSeite = 0;
  const dw = winkelDiff(hund.yaw, soll);
  hund.yaw += klemme(dw, -6 * dt, 6 * dt);
  const s = Math.min(d, tempo * dt) * Math.max(0.3, Math.cos(dw));
  const nx = hp.x + Math.sin(hund.yaw) * s, nz = hp.z + Math.cos(hund.yaw) * s;
  hund.blockiert = !schrittFrei(hp, nx, nz);
  if(!hund.blockiert){ hp.x = nx; hp.z = nz; if(!laeuft(HA.springen)) anim(tempo >= 3.5 ? HA.rennen : HA.gehen, 0.2);
    const a = hund.acts[hund.cur]; if(a && (hund.cur === HA.gehen || hund.cur === HA.rennen)) a.timeScale = klemme(tempo / (hund.cur === HA.rennen ? 6 : 1.4), 0.6, 1.4); }
  else if(!geht(soll)){ hund.ziel = null; if(!laeuft(HA.springen)) anim(HA.stehen, 0.3); }
  else hund.blockiert = false;
  return d;
}
function schaue(dt, x, z, rate){
  const hp = hund.obj.position;
  hund.yaw += klemme(winkelDiff(hund.yaw, Math.atan2(x - hp.x, z - hp.z)), -rate * dt, rate * dt);
}
function springe(){ if(hund.sitzt) return; hund.cur = null; anim(HA.springen, 0.12); hund.sprung = 0; }

// ---- Ist der Hund dabei? ----------------------------------------------------------------------------------
// zu Fuss auf der Erde, nicht im Fahrzeug (eva = null), nicht im Finale, nicht hinter Globus/Schild/Intro
// Live-Wunsch 18.10.2026: auch auf Mond und Mars dabei (nicht im All)
function samuZuFuss(){
  return !!(eva && eva.group && !eva.boat && !eva.rover && !eva.jet && locale !== 'space' && !story.samuVersteckt);
}
function imFinale(){ return story.phase === 'finale'; }
// Ort-Schluessel: Etappe, auf Mond/Mars dazu der Himmelskoerper – wechselt er, wird der Hund neben Samu neu abgesetzt
function weltNr(){ return locale === 'earth' ? story.etappe : story.etappe + ':' + locale; }
// Gruppe, in die er gehoert: auf der Erde die Welt der Etappe, auf Mond/Mars die Szene (die Welten sind dort aus)
function gruppe(){ return locale === 'earth' ? story.welt(story.etappe) : scene; }
// in die Welt der aktuellen Etappe haengen (neben Samu absetzen)
function absetzen(){
  const w = gruppe(); if(!w) return;
  if(hund.obj.parent !== w) w.add(hund.obj);
  const v = neben(-1.2, 0.9), n = freierPlatz(v.x, v.z) || freierPlatz(eva.group.position.x + 1, eva.group.position.z + 1);
  if(!n){ hund.aktiv = false; return; }
  hund.obj.position.set(n.x, evaFootY(n.x, n.z), n.z);
  hund.yaw = eva.yaw + Math.PI; hund.aktiv = true; hund.etappe = weltNr();
  hund.modus = 'streifen'; hund.ziel = null; hund.warte = 1; hund.sitzt = false; hund.cur = null; anim(HA.stehen, 0.01);
}
// ---- Startszene (Live-Wunsch 18.10.2026) ----------------------------------------------------------------------------------
// Waehrend der Kamerafahrt des Intros (story.intro.phase 'laeuft'): der Hund kommt hinter der rechten Ecke der Schule hervor
// (aus Samus Blick aufs Meer rechts), laeuft zu Samu, umrundet ihn einmal und setzt sich auf seinen Platz links neben ihm.
// Phasen: 'hin' (zur Ecke vor Samu), 'rund' (Kreis um Samu, ~1 Umlauf), 'setzen' (links neben ihn), danach normal.
const INTRO_KREIS_R = 2.2, INTRO_KREIS_V = 4.2;
function introAuftritt(dt){
  const I = story.intro, S = story.e1 && story.e1.SCHULE;
  if(!I || !S || story.etappe !== 1 || locale !== 'earth' || !eva || !hund.obj) { hund.intro = null; return false; }
  // Kamerafahrt vorbei: einen angefangenen Auftritt noch zu Ende laufen, ein fertiger gibt ab (danach normal)
  if(I.phase !== 'laeuft' && !(hund.intro && hund.intro.schritt !== 'fertig')){ hund.intro = null; return false; }
  if(!hund.intro){
    if(I.phase !== 'laeuft') return false;
    // rechts von Samu (Blick -x -> rechts = -z): hinter der Schulecke bei z = -B/2 - 3, an der Rueckseite der Schule
    const w = gruppe(); if(!w) return false;
    if(hund.obj.parent !== w) w.add(hund.obj);
    const x = S.x + S.T / 2 - 2, z = S.z - S.B / 2 - 3;
    hund.obj.position.set(x, evaFootY(x, z), z); hund.yaw = Math.atan2(eva.group.position.x - x, eva.group.position.z - z);
    hund.aktiv = true; hund.etappe = weltNr(); hund.sitzt = false; hund.cur = null; anim(HA.stehen, 0.01);
    hund.obj.visible = true;
    hund.intro = { schritt: 'warte', t: 0, w0: 0, w: 0 };
  }
  const A = hund.intro, hp = hund.obj.position, g = eva.group.position;
  A.t += dt;
  if(A.schritt === 'warte'){ anim(HA.stehen, 0.2); if(A.t > 1.2){ A.schritt = 'hin'; A.t = 0; } }     // Samu kommt erst aus der Tuer
  else if(A.schritt === 'hin'){
    // an der Fassade entlang zur Ecke, dann auf Samus rechte Seite (Kreisanfang)
    const ecke = { x: S.x - S.T / 2 - 2, z: S.z - S.B / 2 - 2 };
    const r = neben(0, -INTRO_KREIS_R), ziel = hp.x > ecke.x + 1 ? ecke : r;
    const d = laufe(dt, ziel.x, ziel.z, 5);
    if(ziel === r && (d < 0.4 || A.t > 10)){ A.schritt = 'rund'; A.t = 0; A.w0 = Math.atan2(hp.x - g.x, hp.z - g.z); A.w = 0; }
  } else if(A.schritt === 'rund'){
    // ein Umlauf um Samu (gegen den Uhrzeigersinn von oben: rechts -> vorn -> links -> hinten -> rechts)
    A.w += INTRO_KREIS_V / INTRO_KREIS_R * dt;
    const a = A.w0 + A.w, zx = g.x + Math.sin(a) * INTRO_KREIS_R, zz = g.z + Math.cos(a) * INTRO_KREIS_R;
    laufe(dt, zx, zz, INTRO_KREIS_V * 1.3);
    if(A.w > Math.PI * 2 || A.t > 8){ A.schritt = 'setzen'; A.t = 0; }
  } else if(A.schritt === 'setzen'){
    const l = beiFuss(), d = laufe(dt, l.x, l.z, 1.6);
    if(beiFussSetzen(d) || A.t > 5){ setzen(); hund.modus = 'kommen'; hund.stehT = STEH_KOMMEN + 0.1; A.schritt = 'fertig'; }
  } else if(A.schritt === 'fertig'){
    hund.yaw += klemme(winkelDiff(hund.yaw, eva.yaw + Math.PI), -3 * dt, 3 * dt);
    if(I.phase !== 'laeuft'){ hund.intro = null; return false; }            // ab 'frei' wieder normal
  }
  hund.obj.rotation.y = hund.yaw;
  return true;
}
// Finale: am Strand neben Samus Platz sitzen bleiben
function strandSitzen(){
  const e = story.e6; if(!e || !e.STRANDPLATZ || !hund.obj) return;
  const w = story.welt(6); if(hund.obj.parent !== w) w.add(hund.obj);
  if(hund.modus !== 'strand'){
    const S = e.STRANDPLATZ, n = freierPlatz(S.x + 1.5, S.z + 1.2) || { x: S.x + 1.5, z: S.z + 1.2 };
    hund.obj.position.set(n.x, evaFootY(n.x, n.z), n.z);
    hund.yaw = -Math.PI / 2;                           // Blick aufs Meer (-x)
    hund.modus = 'strand'; hund.aktiv = true; hund.sitzt = false; hund.cur = null; setzen();
  }
}

// ---- Bellen -------------------------------------------------------------------------------------------------
// Alle paar Sekunden (zufaellig), doppelt so oft beim Tollen; beim Auffliegen von Moewen, die er aufscheucht. Leiser,
// je weiter er von Samu (bzw. der Kamera im Fahrzeug) weg ist. Ton nur, wenn er an ist und nicht im Globus.
const BELL_VOL = 0.5, BELL_WEIT = 35;      // Lautstaerke direkt neben Samu, ab hier stumm
let bellBuf = null, bellLaedt = false, bellLetzt = 0;
function bellen(){
  if(!soundOn || !audioCtx || audioCtx.state !== 'running' || !window.BELLEN_SND || !hund.obj || !hund.obj.visible) return;
  if(story.globusAktiv && story.globusAktiv()) return;
  if(!bellBuf){ if(!bellLaedt){ bellLaedt = true; decodeSound(window.BELLEN_SND).then(b => { bellBuf = b; }).catch(e => console.warn('Bellen:', e)); } return; }
  const hp = hund.obj.position, zu = eva && eva.group ? eva.group.position : camera.position;
  const d = Math.hypot(hp.x - zu.x, hp.z - zu.z), k = Math.max(0, 1 - d / BELL_WEIT);
  if(k <= 0.02) return;
  const q = audioCtx.createBufferSource(); q.buffer = bellBuf; q.playbackRate.value = 0.95 + Math.random() * 0.12;
  const g = audioCtx.createGain(); g.gain.value = BELL_VOL * k * k;
  q.connect(g).connect(audioCtx.destination); q.start();
  bellLetzt = performance.now();
}
function bellTakt(dt){
  const toll = hund.modus === 'tollen';
  if((hund.bellT -= dt * (toll ? 2 : 1)) <= 0){ hund.bellT = 5 + Math.random() * 9; bellen(); }
}
// tiere.js meldet jedes Auffliegen einer sitzenden Moewe mit der Quelle (Samu oder Hund)
const aufgeschrecktVorher = story.moeweAufgeschreckt;
story.moeweAufgeschreckt = function(quelle){
  if(aufgeschrecktVorher) aufgeschrecktVorher.apply(this, arguments);
  if(!quelle || !hund.obj || !hund.aktiv) return;
  const hp = hund.obj.position;
  if(Math.hypot(quelle.x - hp.x, quelle.z - hp.z) > 0.05) return;
  if(performance.now() - bellLetzt < 2000) return;
  bellen();
};
// Moewen fliegen auch vor dem Hund auf
(story.scheuchQuellen = story.scheuchQuellen || []).push(() => (hund.obj && hund.aktiv && hund.obj.visible && hund.modus !== 'strand') ? hund.obj.position : null);

// ---- Knien (B) --------------------------------------------------------------------------------------------
// story.js stellt Samus Clip jedes Bild nach dem Zustand (updateSamu -> samuAnim(STAND) im Stehen). Damit es beim Knien
// nicht gegeneinander arbeitet, zeigt der Stehen-Eintrag (acts.stand / acts.idle) solange auf den Knie- bzw.
// Aufsteh-Clip: story.js spielt ihn dann selbst und blendet sauber zurueck, wenn er wieder auf "stand" zeigt.
const knie = { an: false, aufT: 0, stand: null, standName: null };
function standUmlenken(clip){
  const S = story.samu; if(!S) return;
  if(!knie.standName) knie.standName = S.acts.stand ? 'stand' : 'idle';
  if(!knie.stand) knie.stand = S.acts[knie.standName];
  const ziel = clip ? S.acts[clip] : knie.stand;
  if(!ziel || S.acts[knie.standName] === ziel) return;
  ziel.setLoop(clip ? THREE.LoopOnce : THREE.LoopRepeat); ziel.clampWhenFinished = !!clip;
  S.acts[knie.standName] = ziel;
  ziel.paused = false; ziel.zuletzt = undefined;
  if(S.cur === knie.standName) S.cur = 'neu';        // neu einblenden lassen (samuAnim prueft den Namen)
}
function samuKnien(an){
  const S = story.samu; if(!S || !S.acts.kneel) return;
  knie.an = an;
  if(an){
    if(story.tricks) story.tricks.aktiv = null;
    standUmlenken('kneel');
    hund.kniet = true;
    if(hund.aktiv && hund.modus !== 'strand'){ hund.modus = 'knien'; hund.ziel = null; hund.spielN = 0; aufstehen(); }
  } else {
    if(S.acts.crouch_to_stand){ standUmlenken('crouch_to_stand'); knie.aufT = S.acts.crouch_to_stand.getClip().duration - 0.25; }
    else standUmlenken(null);
    hund.kniet = false;
    if(hund.modus === 'knien'){ hund.modus = 'streifen'; hund.ziel = null; hund.warte = 0.6; aufstehen(); }
  }
}
function darfKnien(){
  return samuZuFuss() && eva.onGround && !(story.schwimm && story.schwimm.aktiv) && story.phase !== 'reise' && story.phase !== 'platzhalter'
    && !imFinale() && !(story.tricks && story.tricks.aktiv) && (!story.intro || story.intro.phase === 'aus' || story.intro.phase === 'frei')
    && !(document.getElementById('hint') && document.getElementById('hint').classList.contains('show'));
}

// ---- Jedes Bild ------------------------------------------------------------------------------------------------
function update(dt){
  if(!hund.obj) return;
  hund.mixer.update(dt);
  hund.t += dt;
  // Finale: Hund bleibt am Strand
  if(imFinale() && story.etappe === 6){ strandSitzen(); pflegen(dt); return; }
  if(hund.modus === 'strand'){ hund.modus = 'streifen'; hund.aktiv = false; }
  const zuFuss = samuZuFuss();
  // Live-Wunsch 18.10.2026: steigt Samu ins Fahrzeug, steigt der Hund mit ein – er ist weg und kommt beim Aussteigen neben
  // Samu wieder. Ausnahme: der Fukuoka-Strand (Etappe 6 nach der Ankunft) – dort wartet er sitzend.
  const amStrand = story.etappe === 6 && story.phase === 'ankunft';
  if(!zuFuss && !amStrand && hund.aktiv){ hund.aktiv = false; hund.obj.visible = false; hund.intro = null; return; }
  // Startszene (Etappe 1): rechts an der Schule vorbei, einmal um Samu herum, dann links neben ihn setzen
  if(introAuftritt(dt)){ pflegen(dt); return; }
  // Etappe gewechselt oder Welt entsorgt: neu absetzen, sobald Samu wieder zu Fuss ist
  if(hund.aktiv && (hund.etappe !== weltNr() || !hund.obj.parent || (hund.obj.parent !== scene && !hund.obj.parent.parent))) hund.aktiv = false;
  if(!hund.aktiv){
    hund.obj.visible = false;
    if(zuFuss && story.phase !== 'reise' && !(story.globusAktiv && story.globusAktiv()) && (!story.intro || story.intro.phase !== 'warten')) absetzen();
    if(!hund.aktiv) return;
  }
  hund.obj.visible = locale !== 'space';
  if(!zuFuss){ // Samu im Fahrzeug: der Hund sitzt, wo er ist, und wartet (im Bild, falls man vorbeifaehrt)
    if(!hund.sitzt && !stehtAuf()) setzen();
    pflegen(dt); return;
  }
  const hp = hund.obj.position, g = eva.group.position;
  const dSamu = Math.hypot(g.x - hp.x, g.z - hp.z);
  if(dSamu > NACHHOLEN){                                   // abgehaengt (Fahrt, Teleport): neben Samu holen
    const v = neben(-1.5, 1), n = freierPlatz(v.x, v.z);
    if(n){ hp.set(n.x, evaFootY(n.x, n.z), n.z); hund.ziel = null; hund.sitzt = false; hund.cur = null; anim(HA.stehen, 0.01); }
  }
  // Samu: steht er? tanzt er? kniet er?
  const T = story.tricks || {}, S = story.samu || {};
  const tanzt = S.cur === 'dance_hiphop';
  const leerlauf = S.cur === 'moonwalk' && !T.moon;          // Moonwalk von selbst (gehaltenes M zaehlt nicht)
  const steht = (T.ausschlag || 0) <= 0.05 && eva.onGround && !T.aktiv && !T.moon && !knie.an;
  const tollen = tanzt || (steht && leerlauf) || hund.stehT > TOLL_NACH;
  hund.stehT = steht ? (hund.stehT || 0) + dt : 0;
  const schwimmt = !!(story.schwimm && story.schwimm.aktiv);

  if(knie.an){
    // Knien: vor Samu rennen, zwei Freudenspruenge, dann neben ihn setzen
    if(stehtAuf()){ /* erst aufstehen */ }
    else if(hund.modus !== 'knien'){ hund.modus = 'knien'; hund.spielN = 0; aufstehen(); }
    else if(hund.spielN < 2){
      const v = neben(1.0, 0.3);
      const d = laufe(dt, v.x, v.z, Math.hypot(v.x - hp.x, v.z - hp.z) > 3 ? 6 : 2.2);
      if(d < 0.25 || hund.blockiert){ schaue(dt, g.x, g.z, 6); if(!laeuft(HA.springen)){ if(hund.spielN++ < 2) springe(); } }
    } else if(laeuft(HA.springen)) schaue(dt, g.x, g.z, 6);
    else if(!hund.sitzt){
      const l = beiFuss(), d = laufe(dt, l.x, l.z, 1.5);
      beiFussSetzen(d);
    } else {
      hund.yaw += klemme(winkelDiff(hund.yaw, eva.yaw + Math.PI), -3 * dt, 3 * dt);
      if((hund.sitzT += dt) > 9){ hund.spielN = 0; aufstehen(); }          // nach einer Weile wieder spielen
    }
  } else if(tollen && !schwimmt){
    // Tollen: vor Samu hin und her, immer wieder ein Sprung (beim Hip Hop und wenn Samu lange steht)
    if(hund.modus !== 'tollen'){ hund.modus = 'tollen'; hund.toll = { seite: 1, naechste: 0.8 }; aufstehen(); }
    if(!stehtAuf()){
      const M = hund.toll;
      let ab = TOLL_ABST; while(ab > 1.4){ const q = neben(ab, 0); if(frei(q.x, q.z)) break; ab -= 0.3; }
      if(laeuft(HA.springen)){ const a = hund.acts[HA.springen]; const s = 1.4 * dt; const nx = hp.x + Math.sin(hund.yaw) * s, nz = hp.z + Math.cos(hund.yaw) * s; if(schrittFrei(hp, nx, nz)){ hp.x = nx; hp.z = nz; } }
      else if((M.naechste -= dt) <= 0){ springe(); M.naechste = 1.0 + Math.random() * 1.4; }
      else { const z = neben(ab, M.seite * TOLL_BREIT), d = laufe(dt, z.x, z.z, 3.8); if(d < 0.35 || hund.blockiert) M.seite = -M.seite; }
    }
  } else if(steht && hund.stehT > STEH_KOMMEN && !schwimmt && dSamu < STREIF_MAX){
    // Samu bleibt stehen: kommen und links neben ihn setzen
    // Live-Befund 19.10.2026: sass Barki schon (eine Laune beim Streifen, oder Samu hatte sich gedreht), blieb er sitzen, wo
    // er war, und drehte sich nur zu Samu. Jetzt zaehlt nur der Platz links neben Samu: sitzt er nicht dort, steht er auf
    // und laeuft hin (FUSS_NAH Spielraum, damit er nicht bei jedem kleinen Drehen von Samu aufspringt).
    if(hund.modus !== 'kommen'){ hund.modus = 'kommen'; hund.ziel = null; }
    const l = beiFuss(), weg = Math.hypot(l.x - hp.x, l.z - hp.z);
    if(hund.sitzt && weg > FUSS_NAH && !hund.blockiert) aufstehen();
    if(stehtAuf()){ /* erst aufstehen */ }
    else if(!hund.sitzt){
      const d = laufe(dt, l.x, l.z, weg > 4 ? 5 : 1.6);
      beiFussSetzen(d);
    } else hund.yaw += klemme(winkelDiff(hund.yaw, eva.yaw + Math.PI), -3 * dt, 3 * dt);
  } else {
    // streifen: frei begleitend
    if(hund.modus !== 'streifen'){ hund.modus = 'streifen'; hund.ziel = null; hund.warte = 0.3; aufstehen(); }
    // Samu steht: beim naechsten Loslaufen gilt seine Richtung, keine alte (die Schrecksekunde gilt nur fuer Wechsel im Lauf)
    if(!((T.ausschlag || 0) > 0.05) && hund.voraus) hund.voraus.blick = undefined;
    if(stehtAuf() || laeuft(HA.springen)){ /* fertig aufstehen / springen */ }
    else if((T.ausschlag || 0) > 0.05 && eva.onGround){ voraus(dt, g, hp, T.ausschlag); }
    else if(dSamu > STREIF_MAX){
      const h = neben(-2.2, 1.2); laufe(dt, h.x, h.z, HUND_SPRINT); hund.ziel = null; hund.warte = 0.4; hund.tun = null;   // aufholen (vorher 7 m/s: kaum schneller als Samu)
    } else if(hund.ziel){
      const lauf = T.ausschlag || 0, Z = hund.ziel;
      let tempo = Z.tempo;
      if(Z.mit && lauf > 0.05){
        const q = neben(Z.mit.vor, Z.mit.quer); Z.x = q.x; Z.z = q.z;            // mit Samu mitwandern
        // liegt er hinter Samu (Ziel vor ihm und weiter weg), sprinten – sonst haelt er das Tempo von Samu nie
        const fx = -Math.sin(eva.yaw), fz = -Math.cos(eva.yaw), hinten = (hp.x - g.x) * fx + (hp.z - g.z) * fz < Z.mit.vor - 1;
        const evaV = lauf > 0.5 ? EVA_SPEED * lauf : EVA_SPEED * 0.3 * lauf / 0.5;
        tempo = Math.max(tempo, hinten ? Math.min(HUND_SPRINT, evaV + 3.5) : evaV + 0.5);
      }
      const d = laufe(dt, Z.x, Z.z, tempo);
      if(d < 0.3 || (hund.blockiert && (hund.zielT = (hund.zielT || 0) + dt) > 1)){
        hund.ziel = null; hund.zielT = 0;
        // laeuft Samu: kurz schnuppern (nicht sitzen) – die Wache unten holt ihn nach vorn, sobald Samu vorbei ist;
        // steht er, wie bisher eine Weile und nach Laune
        if(lauf > 0.05){ hund.warte = 0.6 + Math.random() * 1.4; hund.tun = Math.random() < 0.8 ? 'schnuppern' : 'springen'; }
        else { hund.warte = 0.8 + Math.random() * 2.5; hund.tun = laune(); }
      }
    } else {
      hund.warte -= dt;
      // Samu laeuft und Barki ist nicht mehr vor ihm (Samu ist vorbei oder hat die Richtung geaendert): Schnuppern
      // abbrechen und nach vorn – neuesZiel legt das Ziel vor Samu, der Sprint oben holt ihn dorthin
      const lauf = T.ausschlag || 0, fx = -Math.sin(eva.yaw), fz = -Math.cos(eva.yaw);
      if(lauf > 0.05 && (hp.x - g.x) * fx + (hp.z - g.z) * fz < 1){ if(hund.sitzt) aufstehen(); hund.warte = 0; hund.tun = null; }
      else beschaeftigt(dt, g);
      if(hund.warte <= 0) neuesZiel(g);
    }
  }
  pflegen(dt);
  bellTakt(dt);
}
// Samu laeuft: voraus (siehe VORAUS_MIN). Barki hat einen Platz vor Samu (V.vor, V.quer relativ zu ihm, wandert mit), an
// dem er schnuppert; liegt ein Einstieg in Laufrichtung, ist das sein Platz, und er setzt sich dort.
function voraus(dt, g, hp, lauf){
  const V = hund.voraus || (hund.voraus = { vor: 7, quer: VORAUS_QUER, wechsel: 3, schnuppern: 0 });
  const blick = barkiBlick(V, dt);                          // Samus Richtung, wie Barki sie wahrnimmt (Schrecksekunde)
  const fx = -Math.sin(blick), fz = -Math.cos(blick);
  const evaV = lauf > 0.5 ? EVA_SPEED * lauf : EVA_SPEED * 0.3 * lauf / 0.5;
  // Einstieg in Laufrichtung voraus?
  let ein = null, bestD = EINSTIEG_SICHT;
  for(const e of (story.einstiege ? story.einstiege() : [])){
    const dx = e.x - g.x, dz = e.z - g.z, d = Math.hypot(dx, dz);
    if(d < 3 || d > bestD) continue;
    if(Math.acos(klemme((dx * fx + dz * fz) / d, -1, 1)) > EINSTIEG_KEGEL) continue;
    ein = e; bestD = d;
  }
  if(ein){
    // vor dem Einstieg auf Samus Seite warten (nicht mitten im Ring, dort steigt Samu ein): Platz zwischen Samu und Einstieg
    const dx = ein.x - g.x, dz = ein.z - g.z, d = Math.hypot(dx, dz);
    const ab = Math.min(d - 1, Math.max(2, d - (ein.r || 4) - 1.5));
    const q = freierPlatz(g.x + dx / d * ab + dz / d * 1.2, g.z + dz / d * ab - dx / d * 1.2) || { x: g.x + dx / d * ab, z: g.z + dz / d * ab };
    if(hund.sitzt){ hund.yaw += klemme(winkelDiff(hund.yaw, Math.atan2(g.x - hp.x, g.z - hp.z)), -3 * dt, 3 * dt); return; }   // wartet, schaut zu Samu
    if(stehtAuf()) return;
    const w = laufe(dt, q.x, q.z, Math.min(HUND_SPRINT, evaV + 3.5));
    if(w < 0.4 || (hund.blockiert && w < FUSS_NAH * 2)) setzen();
    return;
  }
  // kein Einstieg: sass er (wartete auf einen, Samu ist abgedreht), aufstehen und ueberholen
  if(hund.sitzt){ aufstehen(); return; }
  if(stehtAuf()) return;
  // ab und zu die Seite / den Abstand wechseln, damit er nicht starr vorausfaehrt
  if((V.wechsel -= dt) <= 0){ V.wechsel = 3 + Math.random() * 4; V.quer = (Math.random() < 0.5 ? -1 : 1) * VORAUS_QUER * (0.4 + Math.random() * 0.6); V.vor = VORAUS_MIN + Math.random() * (VORAUS_MAX - VORAUS_MIN); }
  const q = neben(V.vor, V.quer, blick);
  const vorJetzt = (hp.x - g.x) * fx + (hp.z - g.z) * fz;
  // am Platz (oder schon gut voraus): kurz schnuppern, solange er nicht unter VORAUS_MIN zurueckfaellt
  if(V.schnuppern > 0){
    V.schnuppern -= dt;
    if(vorJetzt > VORAUS_MIN * 0.6){ if(!laeuft(HA.springen)) anim(HA.stehen, 0.3); hund.yaw += Math.sin(hund.t * 1.3) * 0.6 * dt; return; }
    V.schnuppern = 0;                                       // zu weit zurueck: weiter
  }
  // hinten (unter dem Platz): sprinten, sonst knapp ueber Samus Tempo, damit er nicht davonzieht
  const tempo = vorJetzt < V.vor - 1.5 ? Math.min(HUND_SPRINT, evaV + 3.5) : Math.max(1.6, evaV + 0.6);
  const d = laufe(dt, q.x, q.z, tempo);
  if(d < 0.6 && Math.random() < dt * 0.5) V.schnuppern = 0.8 + Math.random() * 1.2;   // ab und zu am Platz schnuppern
}
function laune(){ const r = Math.random(); return r < 0.6 ? 'schnuppern' : r < 0.8 ? 'sitzen' : 'springen'; }
function beschaeftigt(dt, g){
  if(hund.tun === 'sitzen'){ if(!hund.sitzt){ setzen(); hund.warte = Math.max(hund.warte, 3); } schaue(dt, g.x, g.z, 1.5); if(hund.warte <= 0.6) aufstehen(); }
  else if(hund.tun === 'springen'){ springe(); hund.tun = 'schnuppern'; }
  else { if(!stehtAuf()) anim(HA.stehen, 0.3); hund.yaw += Math.sin(hund.t * 1.3) * 0.6 * dt; }
}
// Neues Ziel: Punkt um Samu, bevorzugt vor ihm (da, wo er hinlaeuft); laeuft Samu, oefter und schneller
function neuesZiel(g){
  const hp = hund.obj.position, lauf = (story.tricks && story.tricks.ausschlag) || 0;
  for(let i = 0; i < 12; i++){
    const vor = (Math.random() * 1.6 - 0.3 + lauf) * STREIF_R * 0.7, quer = (Math.random() * 2 - 1) * STREIF_R * 0.7;
    const z = neben(vor, quer);
    if(Math.hypot(z.x - g.x, z.z - g.z) < 1.8 || Math.hypot(z.x - hp.x, z.z - hp.z) < 2) continue;
    if(!frei(z.x, z.z)) continue;
    const weit = Math.hypot(z.x - hp.x, z.z - hp.z) > 6;
    // laeuft Samu, merkt sich das Ziel seine Lage relativ zu ihm (vor, quer) und wandert mit (siehe streifen)
    hund.ziel = { x: z.x, z: z.z, tempo: lauf > 0.5 ? 7 : weit && Math.random() < 0.6 ? 5 : 1.6, mit: lauf > 0.05 ? { vor, quer } : null }; hund.tun = null;
    return;
  }
  hund.warte = 0.6;
}
// Hoehe, Drehung, Sprungbogen, Sitzclip
function pflegen(dt){
  const hp = hund.obj.position;
  hp.y = evaFootY(hp.x, hp.z);
  sitzPflege();
  if(hund.cur === HA.sitzen && !hund.sitzt && !laeuft(HA.sitzen)) anim(HA.stehen, 0.2);
  if(hund.cur === HA.springen && !laeuft(HA.springen)) anim(HA.stehen, 0.15);
  hund.obj.rotation.y = hund.yaw;
}

// ---- Einhaengen ---------------------------------------------------------------------------------------------------
function hookBegleiter(){
  ladeHund();
  // B zu Fuss: hinknien / aufstehen (vorher Aerial Evade, story.js samuTasten – der Trick wird hier abgefangen)
  const evaBOrig = evaActionB;
  evaActionB = function(){ if(darfKnien() || knie.an){ samuKnien(!knie.an); return; } return evaBOrig.apply(this, arguments); };
  // Samu laeuft nicht durch den Hund (nur seine eigenen Schritte, story.schrittVon aus objekte.js)
  const hitsOrig = hitsBuilding;
  hitsBuilding = function(x, y, z){
    const von = story.schrittVon && story.schrittVon();
    if(von && hund.obj && hund.aktiv && hund.obj.visible && locale !== 'space'){
      const h = hund.obj.position, neu = Math.hypot(x - h.x, z - h.z);
      if(neu < ABSTAND_MIN && neu < Math.hypot(von.x - h.x, von.z - h.z) && Math.abs(y - 1 - h.y) < 1) return true;
    }
    return hitsOrig.apply(this, arguments);
  };
  // Mond und Mars: dort fragt die Engine fuer Samus Schritte nur evaSolid (nicht hitsBuilding) – der Hund sperrt dort
  // ueber evaSolid, ebenfalls nur fuer Samus eigenen Schritt (story.schrittVon)
  const solidOrig = evaSolid;
  evaSolid = function(x, z){
    const r = solidOrig.apply(this, arguments);
    const von = r && locale !== 'earth' && locale !== 'space' && story.schrittVon && story.schrittVon();
    if(von && hund.obj && hund.aktiv && hund.obj.visible){
      const h = hund.obj.position, neu = Math.hypot(x - h.x, z - h.z);
      if(neu < ABSTAND_MIN && neu < Math.hypot(von.x - h.x, von.z - h.z)) return false;
    }
    return r;
  };
  // Kniend laeuft Samu nicht; der Stick laesst ihn aufstehen
  const updOrig = updateEva;
  updateEva = function(dt, inp){
    if(knie.an && eva && inp){
      if(Math.abs(inp.pitch || 0) > 0.3 || Math.abs(inp.yaw || 0) > 0.3) samuKnien(false);
      else return updOrig.call(this, dt, Object.assign({}, inp, { pitch: 0, yaw: 0 }));
    }
    if(knie.aufT > 0 && eva && inp) return updOrig.call(this, dt, Object.assign({}, inp, { pitch: 0, yaw: 0 }));
    return updOrig.apply(this, arguments);
  };
  const loopOrig = loop;
  let tPrev = performance.now();
  loop = function(){
    const now = performance.now(), dt = Math.min(0.1, (now - tPrev) / 1000); tPrev = now;
    const pause = document.getElementById('hint') && document.getElementById('hint').classList.contains('show');
    if(!pause && !(story.globusAktiv && story.globusAktiv())){
      try { update(dt); } catch(e){ console.warn('Hund:', e); }
      // Knien abbrechen, wenn Samu nicht mehr zu Fuss ist; nach dem Aufstehen wieder normal stehen
      if(knie.an && (!samuZuFuss() || (story.schwimm && story.schwimm.aktiv) || imFinale() || story.phase === 'reise')){ knie.an = false; hund.kniet = false; knie.aufT = 0; standUmlenken(null); }
      if(knie.aufT > 0 && (knie.aufT -= dt) <= 0) standUmlenken(null);
      // samuAnim (story.js) stellt jeden Clip ausser den Tricks auf Wiederholen – Knien und Aufstehen am Ende festhalten
      const S = story.samu;
      for(const n of ['kneel', 'crouch_to_stand']){ const a = S && S.acts[n]; if(!a || !a.isRunning()) continue;
        const ende = a.getClip().duration - 0.02; if(a.time >= ende - 0.03 || (a.zuletzt !== undefined && a.time < a.zuletzt)){ a.time = ende; a.paused = true; } a.zuletzt = a.time; }
    }    return loopOrig.apply(this, arguments);
  };
  // B war zu Fuss Aerial Evade – story.js startet ihn seit 18.10.2026 nicht mehr auf B. Sicherheitsnetz: ohne den Clip
  // startet der Trick ohnehin nicht (trickStart prueft samu.acts), Samus Specials bleiben X (Hip Hop) und Y (Butterfly Twirl)
  (function warte(){ if(story.samu && story.samu.mixer && story.samu.acts.kneel){ delete story.samu.acts.aerial_evade; } else setTimeout(warte, 300); })();
}
const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hookBegleiter(); };
})();
