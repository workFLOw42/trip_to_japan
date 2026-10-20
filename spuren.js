// Die Abenteuer von Samu (SFG) – Schatten, Laufspuren und Bootsgischt (Live-Wunsch 17.10.2026, wie "Das Geheimland").
// Laedt nach story.js.
//   - Schatten: Samus Bodenschatten so klein und blass wie Joshis (im Verhaeltnis zur Groesse), auf der echten Bodenhoehe
//     (der Rest steht in story.js hookSchatten – hier nur Groesse und Deckkraft).
//   - Laufspuren: hebt sich beim Gehen/Laufen ein Fuss vom Boden, wirbelt dort ein kleines Staubwoelkchen auf (erkannt am
//     Zehenknochen des Mixamo-Skeletts: war er unten und steigt ueber STAUB_HOCH). Farbe je Etappe (Sand, Wiese);
//     nicht auf Beton/Kai, Bahn, im Wasser, beim Schwimmen oder in einem Fahrzeug.
//   - Bootsgischt: in jedem Wasserfahrzeug der Engine (Feuerwehrboot, Schnellboot, Schlauchboot, U-Boot an der
//     Oberflaeche) spritzt es am Bug links und rechts, je schneller desto mehr (wie das Segelboot im Geheimland).
(function(){
'use strict';
const story = window.STORY;
const klemme = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Schatten ----------------------------------------------------------------------------------------------------
// Joshi (1,20 m): 0,38 m Radius, 60 % der Engine-Deckkraft. Samu (1,55 m) entsprechend 0,48 m. Die Engine rechnet mit
// 0,9 m (Astronaut, waechst mit der Sprunghoehe) -> Faktor 0,48 / 0,9.
const SCHATTEN_R = 0.48, SCHATTEN_DECK = 0.6;
function hookSchatten(){
  const orig = updateOvalShadow;
  updateOvalShadow = function(){
    const r = orig.apply(this, arguments);
    if(eva && !eva.boat && !eva.rover && ovalShadow.visible){
      const k = SCHATTEN_R / 0.9;
      ovalShadow.scale.x *= k; ovalShadow.scale.y *= k;
      ovalShadowMat.opacity *= SCHATTEN_DECK;
    }
    return r;
  };
}

// ---- Tierschatten (Live-Wunsch 18.10.2026: "die Kamele und die anderen Tiere brauchen auch einen kleinen Schatten") -----
// Eine weiche, blasse Ovalscheibe flach unter dem Tier (wie Samus und Barkis Schatten), am Tier selbst angehaengt: sie
// wandert und dreht mit. laenge/breite in m entlang der Kopfachse (lokal z) bzw. quer; wird das Tier spaeter skaliert,
// waechst sie mit (Masse daher im Massstab, den das Tier beim Anhaengen hat). Deko: keine Grenze. Je Schatten eigene
// Geometrie und eigenes Material (16 Dreiecke) – story.entsorgen gibt beim Etappenwechsel alles frei, auch Geteiltes.
story.tierSchatten = function(obj, laenge, breite, deck){
  if(!obj || obj.userData.schatten || typeof ovalShadowMat === 'undefined') return null;
  const mat = ovalShadowMat.clone(); mat.opacity = (deck || 0.24) * SHADOW_DECK; mat.depthWrite = false;
  const s = new THREE.Mesh(new THREE.CircleGeometry(1, 16), mat);
  obj.updateMatrixWorld(true);
  const sc = obj.getWorldScale(new THREE.Vector3()), k = 1 / (sc.x || 1);
  s.rotation.x = -Math.PI / 2; s.scale.set(breite / 2 * k, laenge / 2 * k, 1); s.position.y = SHADOW_LIFT * k;
  s.renderOrder = 1; s.userData.deko = true; s.frustumCulled = false;
  obj.add(s); obj.userData.schatten = s;
  if(typeof shadowFollowFeet === 'function') shadowFollowFeet(s, obj);   // folgt den Fuessen (Engine; flache Tiere bleiben starr)
  tierSpuren.push({ o: obj, l: laenge, x: NaN, z: NaN, t: Math.random() * 0.3 });   // Staub beim Laufen (updateTierSpuren)
  return s;
};
// Krokodile (etappe3.js): schwimmende Tiere melden sich hier an – sie ziehen eine Wasserspur wie ein kleines Boot
// wasserY: Hoehe der Wasserflaeche (Fluss in Etappe 3 hat eine eigene), sonst das Meer der Engine
story.wasserTier = function(obj, laenge, wasserY){ if(obj && !obj.userData.wasserSpur){ obj.userData.wasserSpur = true; tierSpuren.push({ o: obj, l: laenge, x: NaN, z: NaN, t: 0, wasser: true, wy: wasserY }); } };
const tierSpuren = [];

// ---- Laufspuren (Staub) ------------------------------------------------------------------------------------------
const STAUB_UNTEN = 0.08, STAUB_HOCH = 0.12, STAUB_DAUER = 0.8, STAUB_MAX = 30;
// Farbe je Etappe (Sprites sind unbeleuchtet: gedeckte Toene); null = kein Staub
// Bei Tag (heller Sand, helle Wiese) etwas dunkler als der Boden, sonst sieht man es nicht (im Geheimland ist es Nacht)
const STAUB_FARBE = { 1: 0xa59570, 2: 0xb08850, 3: 0x9c8c66, 4: null, 5: 0x9a9070, 6: 0xa3946c };
const staub = { teile: [], tex: null, fuesse: null, obj: null };
function staubTextur(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function staubPuff(p, stark, farbe){
  if(!staub.tex) staub.tex = staubTextur();
  let t = staub.teile.find(q => q.alter >= STAUB_DAUER);
  if(!t){
    if(staub.teile.length >= STAUB_MAX) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: staub.tex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.renderOrder = 3; scene.add(sp);                // global-ok: folgt Samu in jede Etappe
    t = { sp, alter: STAUB_DAUER }; staub.teile.push(t);
  }
  t.alter = 0; t.stark = stark; t.sp.visible = true; t.sp.material.color.setHex(farbe);
  t.sp.position.set(p.x + (Math.random() - 0.5) * 0.06, p.y + 0.03, p.z + (Math.random() - 0.5) * 0.06);
  t.dx = (Math.random() - 0.5) * 0.12; t.dz = (Math.random() - 0.5) * 0.12;
}
const _fp = new THREE.Vector3();
function bodenOk(x, z){
  if(locale !== 'earth' || !isOnLand(x, z)) return false;
  if(typeof isOnRunway === 'function' && isOnRunway(x, z)) return false;      // Startbahn: Beton
  if(seaYAt(x, z) > evaFootY(x, z) - 0.05) return false;                      // im Wasser / Waten
  return true;
}
function updateStaub(dt){
  for(const t of staub.teile){
    if(t.alter >= STAUB_DAUER){ t.sp.visible = false; continue; }
    t.alter += dt; const k = Math.min(1, t.alter / STAUB_DAUER);
    t.sp.position.x += t.dx * dt; t.sp.position.z += t.dz * dt; t.sp.position.y += 0.35 * dt * (1 - k);
    t.sp.scale.setScalar(0.28 + 0.9 * Math.sqrt(k) * t.stark);               // Samu ist groesser als Joshi
    t.sp.material.opacity = 0.75 * t.stark * (1 - k) * Math.min(1, t.alter / 0.08);
  }
  const S = story.samu;
  if(!S || !S.obj || !eva || eva.boat || eva.rover) return;
  if(staub.obj !== S.obj){                            // Zehenknochen einmal suchen (und neu, falls Samu neu geladen)
    staub.obj = S.obj; staub.fuesse = [];
    S.obj.traverse(o => { if(o.isBone && /ToeBase$/.test(o.name)) staub.fuesse.push({ bone: o, unten: true }); });
  }
  const farbe = STAUB_FARBE[story.etappe];
  const T = story.tricks, g = eva.group.position;
  const geht = farbe != null && T && T.ausschlag > 0.05 && eva.onGround && !(story.schwimm && story.schwimm.aktiv) && bodenOk(g.x, g.z);
  for(const f of staub.fuesse){
    f.bone.getWorldPosition(_fp);
    const boden = evaFootY(_fp.x, _fp.z), h = _fp.y - boden;
    if(h < STAUB_UNTEN) f.unten = true;
    else if(f.unten && h > STAUB_HOCH){ f.unten = false; if(geht && bodenOk(_fp.x, _fp.z)) staubPuff({ x: _fp.x, y: boden, z: _fp.z }, T.ausschlag > 0.5 ? 1 : 0.65, farbe); }
  }
}
story.staub = staub;
// ---- Spuren der Tiere (Live-Wunsch 18.10.2026: "bewegende Tiere wirbeln Staub auf, die Krokodile ziehen eine Wasserspur") ---
// Jedes Tier mit Schatten (tierSchatten) wird beobachtet: bewegt es sich auf Land, steigen hinter ihm in kurzen Abstaenden
// kleine Staubwoelkchen auf (Farbe der Etappe, je nach Groesse und Tempo), im Wasser entsteht eine Heckwelle (story.wasserTier).
// Nur in der Naehe der Kamera (TIER_SPUR_SICHT) und hoechstens TIER_STAUB_MAX eigene Woelkchen gleichzeitig.
const TIER_SPUR_SICHT = 90, TIER_STAUB_MAX = 40, _tw = new THREE.Vector3();
function tierStaubPuff(p, stark, farbe){
  if(staub.teile.filter(q => q.tier && q.alter < STAUB_DAUER).length >= TIER_STAUB_MAX) return;
  if(!staub.tex) staub.tex = staubTextur();
  let t = staub.teile.find(q => q.tier && q.alter >= STAUB_DAUER);
  if(!t){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: staub.tex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.renderOrder = 3; scene.add(sp); t = { sp, alter: STAUB_DAUER, tier: true }; staub.teile.push(t); }   // global-ok
  t.alter = 0; t.stark = stark; t.sp.visible = true; t.sp.material.color.setHex(farbe);
  t.sp.position.set(p.x + (Math.random() - 0.5) * 0.3, p.y + 0.03, p.z + (Math.random() - 0.5) * 0.3);
  t.dx = (Math.random() - 0.5) * 0.2; t.dz = (Math.random() - 0.5) * 0.2;
}
function tierWelle(x, z, rich, k, groesse, wy){
  gischtBauen();
  let w = gis.wellen.find(q => !q.m.visible);
  if(!w && gis.wellen.length < WELLE_MAX + 20){ w = { m: new THREE.Mesh(gis.wGeo, gis.wMat.clone()) }; w.m.renderOrder = 2; scene.add(w.m); gis.wellen.push(w); }   // global-ok
  if(!w) return;
  w.m.position.set(x, (wy !== undefined ? wy : seaYAt(x, z)) + 0.06, z); w.m.rotation.y = rich; w.m.visible = true; w.t = 0; w.k = k; w.g = groesse; w.wy = wy;
}
// Spritzer-Ring (Gischt-Teile der Boote): n Tropfen rund um (x, z) auf der Wasserflaeche wy, nach oben und aussen
function spritzer(x, wy, z, n, kraft){
  gischtBauen();
  for(let i = 0; i < n; i++){
    let t = gis.teile.find(q => !q.m.visible);
    if(!t){ if(gis.teile.length >= GISCHT_MAX + 80) return; t = { m: new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), gis.mat), v: new THREE.Vector3() }; scene.add(t.m); gis.teile.push(t); }   // global-ok
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.2 * kraft;
    t.m.position.set(x + Math.cos(a) * r, wy + 0.05, z + Math.sin(a) * r); t.m.visible = true; t.t = 0; t.s = (0.8 + Math.random() * 1.2) * Math.min(1.8, 0.6 + kraft * 0.5);
    const aus = (1 + Math.random() * 2.5) * kraft, hoch = (2.5 + Math.random() * 4.5) * kraft;
    t.v.set(Math.cos(a) * aus, hoch, Math.sin(a) * aus);
  }
}
story.spritzer = spritzer;
// Orcas der Engine (Live-Wunsch 18.10.2026): an der Oberflaeche eine Heckwelle und etwas Gischt, beim Sprung ein grosser
// Spritzer beim Auftauchen und beim Eintauchen. Ruecken = Unterkante + ORCA_BACK der Engine (seit dem Low-Poly-Orca 2,05 m).
// Erst beim Rechnen gelesen: spuren.js laedt VOR der Engine, ORCA_BACK gibt es beim Laden noch nicht.
const orcaRuecken = () => typeof ORCA_BACK === 'number' ? ORCA_BACK : 1.4, _ow = new THREE.Vector3();
function updateOrcaSpuren(dt){
  if(typeof orcas === 'undefined' || !orcas.length) return;
  const cp = camera.position;
  for(const o of orcas){
    if(!o.group || !o.placed || !o.group.visible) { o.spur = null; continue; }
    if(Math.hypot(o.x - cp.x, o.z - cp.z) > 400){ o.spur = null; continue; }
    const wy = seaYAt(o.x, o.z), oben = o.group.position.y + orcaRuecken() - wy;   // > 0: Ruecken ueber Wasser
    const S = o.spur || (o.spur = { oben, t: Math.random() * 0.2, gT: 0, unten: undefined });
    const fx = -Math.sin(o.heading), fz = -Math.cos(o.heading);
    // Sprung: zwei Ereignisse – der Ruecken schiesst aus dem Wasser (steigend), die Unterkante kommt von oben zurueck ins Wasser
    const unten = o.group.position.y - wy;                                    // Unterkante ueber der Wasserflaeche
    if(S.oben < 0.9 && oben >= 0.9 && oben - S.oben > 1.5 * dt) spritzer(o.x + fx * 2, wy, o.z + fz * 2, 26, 1.6);   // heraus
    if(S.unten !== undefined && S.unten > 0.1 && unten <= 0.1) spritzer(o.x, wy, o.z, 40, 2.0);                    // hinein
    S.unten = unten;
    S.oben = oben;
    // Schwimmen an der Oberflaeche (Ruecken knapp heraus): Heckwelle und ein wenig Bug-Gischt
    if(oben > -0.4 && oben < 0.9){
      S.t -= dt;
      if(S.t <= 0){ S.t = 0.3; tierWelle(o.x - fx * 4, o.z - fz * 4, Math.atan2(fx, fz), 0.55, 1.1); }
      S.gT -= dt;
      if(S.gT <= 0){ S.gT = 0.12; spritzer(o.x + fx * 3.6, wy, o.z + fz * 3.6, 2, 0.45); }
    }
  }
}
function updateTierSpuren(dt){
  if(locale !== 'earth') return;
  updateOrcaSpuren(dt);
  // Barki (begleiter.js, eigener Schatten): auch er wirbelt beim Laufen Staub auf (Live-Wunsch 18.10.2026)
  const H = story.hund; if(H && H.obj && !H.obj.userData.spur){ H.obj.userData.spur = true; tierSpuren.push({ o: H.obj, l: 0.9, x: NaN, z: NaN, t: 0 }); }
  const farbe = STAUB_FARBE[story.etappe], cp = camera.position;
  for(let i = tierSpuren.length - 1; i >= 0; i--){
    const s = tierSpuren[i], o = s.o;
    // abgehaengt (Welt entsorgt – oder Barki kurz zwischen zwei Welten): austragen; er meldet sich wieder an (userData.spur)
    if(!o.parent){ tierSpuren.splice(i, 1); o.userData.spur = false; continue; }
    if(!o.visible){ s.x = NaN; continue; }
    o.getWorldPosition(_tw);
    if(Math.hypot(_tw.x - cp.x, _tw.z - cp.z) > TIER_SPUR_SICHT){ s.x = _tw.x; s.z = _tw.z; continue; }
    const v = isNaN(s.x) || dt <= 0 ? 0 : Math.hypot(_tw.x - s.x, _tw.z - s.z) / dt;
    const rx = _tw.x - s.x, rz = _tw.z - s.z; s.x = _tw.x; s.z = _tw.z;
    if(v < 0.3 || v > 30) { s.t = Math.min(s.t, 0.1); continue; }            // steht (oder wurde versetzt)
    s.t -= dt; if(s.t > 0) continue;
    const rl = Math.hypot(rx, rz) || 1, hx = -rx / rl, hz = -rz / rl;      // hinter dem Tier
    if(s.wasser){
      s.t = 0.22 / (0.4 + Math.min(1, v / 2));
      tierWelle(_tw.x + hx * s.l * 0.45, _tw.z + hz * s.l * 0.45, Math.atan2(-hx, -hz), Math.min(1, v / 2), s.l / 6, s.wy);
    } else if(farbe != null && bodenOk(_tw.x, _tw.z)){
      s.t = 0.42 / (0.5 + Math.min(1.2, v / 2)) + Math.random() * 0.1;
      const gross = Math.min(1.3, 0.35 + s.l * 0.3);                      // Moewe klein, Kamel gross
      tierStaubPuff({ x: _tw.x + hx * s.l * 0.3, y: evaFootY(_tw.x, _tw.z), z: _tw.z + hz * s.l * 0.3 }, gross * Math.min(1, 0.45 + v / 4), farbe);
    }
  }
}

// ---- Bootsgischt -------------------------------------------------------------------------------------------------
// Spritzer am Bug links und rechts (kleine weisse Ikosaeder), fliegen seitlich hinaus, nach hinten und hoch, fallen
// zurueck. Dazu eine Heckwelle (helle, flache Scheiben, die hinter dem Boot auseinanderlaufen und vergehen).
const GISCHT_MAX = 140, WELLE_MAX = 40;
const gis = { teile: [], wellen: [], mat: null, wMat: null, wGeo: null, gT: 0, wT: 0 };
function gischtBauen(){
  if(gis.mat) return;
  gis.mat = new THREE.MeshBasicMaterial({ color: 0xf2f7fb, transparent: true, opacity: 0.9, depthWrite: false });
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 8, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  gis.wMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0 });
  gis.wGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
}
const _q = new THREE.Vector3(), _l = new THREE.Vector3(), _inv = new THREE.Matrix4();
// Halbe Breite des Rumpfs auf der Wasserlinie an der Laengsstelle u (-1 Heck .. +1 Bug), aus dem Modell gemessen:
// 9 Scheiben, je die groesste |x| der Punkte bis knapp ueber der Wasserlinie (einmal je Boot, gis.breiten)
function bordBreite(u){
  const b = gis.breiten; if(!b) return gis.breit || 1.2;
  const f = Math.max(0, Math.min(b.length - 1, (u + 1) / 2 * (b.length - 1))), i = Math.min(b.length - 2, Math.floor(f)), t = f - i;
  return b[i] + (b[i + 1] - b[i]) * t;
}
function breitenMessen(){
  // Gemeinsamer Messkern der Engine (hullSlices): Dreiecke statt Punkte, lueckenlos je Scheibe. Boots-Koordinaten
  // (planeGroup, Nase -z), bis knapp ueber der Wasserlinie; Scheibe k deckt u = -1 (Heck) .. +1 (Bug)
  // Laengsbereich um eine halbe Scheibe erweitert: so liegen die Scheibenmitten genau auf den 9 Stuetzstellen u = -1 .. +1
  const N = 9, Lz = gis.lang * (1 + 1 / (N - 1));
  const sl = hullSlices(modelHolder, { ref: planeGroup, ns: N, bands: [[-Infinity, 1.2]], z0: -Lz, z1: Lz });   // global-ok: Engine
  const b = new Array(N).fill(0);
  if(sl) for(let k = 0; k < N; k++) if(sl.hi[k] >= sl.lo[k]) b[N - 1 - k] = Math.max(-sl.lo[k], sl.hi[k]);   // z = -lang ist der Bug (u = +1)
  gis.breiten = b.map(x => Math.max(0.4, x));
}
// Liegt ein Punkt (Welt) ueber dem Rumpf? (Boots-Koordinaten: |z| < Laenge/2, |x| < Breite dort, in jeder Hoehe)
function imBoot(p){
  _l.copy(p).applyMatrix4(_inv.copy(planeGroup.matrixWorld).invert());
  if(Math.abs(_l.z) > gis.lang) return false;                     // egal in welcher Hoehe: ueber dem Boot nie
  return Math.abs(_l.x) < bordBreite(-_l.z / gis.lang) + 0.1;
}
function updateGischt(dt){
  gischtBauen();
  // Wasserfahrzeug der Engine, nicht getaucht, auf der Erde
  const an = !eva && locale === 'earth' && typeof isWaterCraft === 'function' && isWaterCraft() && planeGroup.visible
    && !(typeof isSub === 'function' && isSub() && state.pos.y < seaYAt(state.pos.x, state.pos.z) - 0.6);
  const v = an ? Math.hypot(state.vel.x, state.vel.z) : 0, k = klemme(v / 12, 0, 1);
  // Bug-/Heckrichtung aus der Lage des Bootes (Nase der Engine = -Z)
  _q.set(0, 0, -1).applyQuaternion(state.quat); _q.y = 0; const l = Math.hypot(_q.x, _q.z) || 1;
  const fx = _q.x / l, fz = _q.z / l, qx = fz, qz = -fx;      // vorn / quer (rechts)
  // halbe Laenge des Boots aus dem gerade gebauten Modell (Feuerwehrboot, Schnellboot ... sind verschieden lang)
  if(an && gis.modell !== modelHolder.children[0]){ gis.modell = modelHolder.children[0];
    const bb = new THREE.Box3().setFromObject(modelHolder), sz = bb.getSize(new THREE.Vector3()); gis.lang = Math.max(3, Math.max(sz.x, sz.z) / 2); gis.breit = Math.max(0.8, Math.min(sz.x, sz.z) / 2);
    gis.breiten = null; breitenMessen(); }
  const lang = gis.lang || 4;
  gis.gT -= dt;
  if(an && v > 1.0 && gis.gT <= 0){
    gis.gT = 0.014 / (0.3 + k);                             // bei voller Fahrt ~ 90 Spritzer pro Sekunde und Seite
    for(const seite of [-1, 1]){
      let t = gis.teile.find(q => !q.m.visible);
      if(!t){ if(gis.teile.length >= GISCHT_MAX) break; t = { m: new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), gis.mat), v: new THREE.Vector3() }; scene.add(t.m); gis.teile.push(t); }   // global-ok
      // knapp AUSSERHALB der Bordwand starten (Live-Befund 17.10.: Gischt sah man im Boot) – die Breite an dieser
      // Laengsstelle aus dem Modell gemessen (bordBreite), dazu 0,25 m
      const vor = lang * (0.45 + Math.random() * 0.35), breit = bordBreite(vor / lang) + 0.25 + Math.random() * 0.2;
      const px = state.pos.x + fx * vor + qx * seite * breit, pz = state.pos.z + fz * vor + qz * seite * breit;
      t.m.position.set(px, seaYAt(px, pz) + 0.05, pz); t.m.visible = true; t.t = 0; t.s = 0.7 + Math.random() * 1.1;
      const quer = (1.4 + Math.random() * 1.8) * (0.5 + k), hoch = 1.4 + Math.random() * 2.2 * (0.4 + k), zurueck = 0.6 + k * 1.6;
      t.v.set(qx * seite * quer - fx * zurueck, hoch, qz * seite * quer - fz * zurueck);
    }
  }
  for(const t of gis.teile) if(t.m.visible){
    t.t += dt; t.v.y -= 9.81 * dt; t.m.position.addScaledVector(t.v, dt);
    t.m.scale.setScalar(t.s * Math.max(0.15, 1 - t.t * 1.4));
    if(t.t > 0.75 || t.m.position.y < seaYAt(t.m.position.x, t.m.position.z) - 0.2) t.m.visible = false;
    else if(an && imBoot(t.m.position)) t.m.visible = false;   // nie im Boot
  }
  // Heckwelle: alle paar Zehntel eine helle Scheibe hinter dem Heck, die waechst und vergeht
  gis.wT -= dt;
  if(an && v > 2 && gis.wT <= 0){
    gis.wT = 0.12 / (0.4 + k);
    let w = gis.wellen.find(q => !q.m.visible);
    if(!w && gis.wellen.length < WELLE_MAX){ w = { m: new THREE.Mesh(gis.wGeo, gis.wMat.clone()) }; w.m.renderOrder = 2; scene.add(w.m); gis.wellen.push(w); }   // global-ok
    if(w){ const px = state.pos.x - fx * lang * 0.9, pz = state.pos.z - fz * lang * 0.9;
      w.m.position.set(px, seaYAt(px, pz) + 0.06, pz); w.m.rotation.y = Math.atan2(fx, fz); w.m.visible = true; w.t = 0; w.k = k; w.g = 1; w.wy = undefined; }
  }
  for(const w of gis.wellen) if(w.m.visible){
    w.t += dt; const a = w.t / 1.6;
    const gw = w.g || 1;                                     // Tierwellen (Krokodil) kleiner als die Bootswelle
    w.m.scale.set((2.4 + a * 7 * (0.5 + w.k)) * gw, 1, (1.6 + a * 3) * gw);
    w.m.position.y = (w.wy !== undefined ? w.wy : seaYAt(w.m.position.x, w.m.position.z)) + 0.06;
    w.m.material.opacity = 0.6 * (0.4 + w.k) * (1 - a);
    if(a >= 1) w.m.visible = false;
  }
}

// ---- Einhaengen --------------------------------------------------------------------------------------------------
let tVor = 0;
const startVorher = window.STORY_START;
window.STORY_START = function(){
  hookSchatten();
  const loopOrig = loop;
  loop = function(now){
    const r = loopOrig.apply(this, arguments);
    const t = performance.now(), dt = tVor ? Math.min(0.1, (t - tVor) / 1000) : 0; tVor = t;
    if(!(document.getElementById('hint') && document.getElementById('hint').classList.contains('show'))){ updateStaub(dt); updateGischt(dt); updateTierSpuren(dt); }
    return r;
  };
  if(startVorher) return startVorher.apply(this, arguments);
};
})();
