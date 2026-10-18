// Die Abenteuer von Samu (SFG) – Objekt-Katalog und Grenzen. Uebernommen aus Spiel_JFG/objekte.js (16.10.2026),
// ohne den JFG-eigenen Teil (Orcas, Fuchs). Laedt direkt nach story.js.
//
// Grundsatz: jedes Objekt wird EINMAL global als Typ definiert (story.typ) und erst dann in eine Welt gesetzt
// (story.setze). Egal in welcher Etappe – es hat dort immer dieselben Eigenschaften:
//   - Grenze in seiner exakten Form: jedes Bauteil (Mesh) ist ein eigener Koerper in seinen eigenen Achsen. Quader
//     bleiben Quader, Zylinder Zylinder, Kugeln Kugeln; frei geformte Teile (GLB-Modelle) werden laengs in Scheiben
//     zerlegt. Das Ganze in 3D: unter hohen Teilen geht man durch, ueber ganz niedrige (unter STUFE) steigt man.
//   - Die Grenze haengt am Objekt selbst (an seiner matrixWorld): bewegt es sich (beweglich: true – Boot, Zug), wandert
//     sie mit.
//   - Ausnahmen werden am Bauteil markiert: userData.begehbar (Boden, Planken – man steht darauf), userData.keinKoerper
//     (Deko ohne eigene Masse), userData.deko (Effekte, Tiere ohne Grenze: Schatten, Moewen).
//   - Beim Setzen wird geprueft, ob dort schon etwas steht (oder Samu): dann am naechsten freien Platz daneben.
//   - Verhaken gibt es nicht: wer schon in einer Grenze steckt, darf jeden Schritt machen, der ihn nicht tiefer
//     hineinbringt.
// Samu ist eine Saeule: Kugeln uebereinander von Fuss + STUFE bis zum Kopf.
//
// Neues Objekt:   story.typ('name', { bau(opt) { ...; return obj (Unterkante y = 0) oder Promise }, form?, untergrund?, beweglich? })
// Einbauen:       story.setze('name', etappe, { x, z, y?, dreh?, auf?: Object3D, fest?: true })
//   form:       (leer) = jedes Bauteil einzeln; 'kreis' = ein Zylinder um das Ganze; 'quader' = ein Quader um das Ganze
//   untergrund: 'land' (Standard, fester Boden), 'wasser' oder 'egal'
//   fest:       genau an diese Stelle (gebaute Kulisse), kein Ausweichen
//   auf:        Ablage (Mesh): es liegt darauf und rueckt auf ihr zur Seite, nie auf den Boden
//   in:         Gruppe, in die es gehaengt wird (Standard: die Welt); x, z bleiben trotzdem Weltkoordinaten
// Ein schon gebautes Objekt (z. B. aus einer Etappe) anmelden: story.ding(obj, { welt, form, beweglich })
(function(){
'use strict';
const story = window.STORY;
const klemme = (v, a, b) => Math.max(a, Math.min(b, v));
const wd = (a, b) => { const d = b - a; return Math.atan2(Math.sin(d), Math.cos(d)); };

const STUFE = 0.2;                                   // m: so niedrige Dinge steigt man einfach drueber (Stegkante 0,14 m)
const SPRUNG = 0.25;                                 // m: im Sprung zaehlen die Fuesse so viel hoeher
const FIGUR = { r: 0.28, h: 1.55, stufe: STUFE };    // Samu (SAMU_H, story.js)
story.masse = { figur: FIGUR };

// ---- Katalog ---------------------------------------------------------------------------------
const katalog = new Map();
function typ(name, def){
  if(katalog.has(name)) console.warn('Objekttyp doppelt definiert:', name);
  def.name = name; katalog.set(name, def); return def;
}
story.typ = typ; story.katalog = katalog;

const dinge = [];                                    // alles, was eine Grenze hat (gesetzt oder angemeldet)
story.dinge = dinge;
let bildNr = 0;

// Setzt ein Objekt des Typs name in die Welt weltN. Rueckgabe sofort: das Ding { typ, welt, obj, bereit }. Bei
// geladenen Modellen (GLB) kommt obj erst spaeter – bereit ist ein Promise darauf.
function setze(name, weltN, opt){
  opt = opt || {};
  const def = katalog.get(name);
  const d = { typ: name, welt: weltN, obj: null, koerper: [], bb: new THREE.Box3(), beweglich: !!(def && def.beweglich), aus: false };
  if(!def){ console.warn('Unbekannter Objekttyp – erst mit story.typ definieren:', name); d.bereit = Promise.resolve(d); return d; }
  const fertig = (obj) => {
    if(!obj) return d;
    (opt.in || story.welt(weltN)).add(obj);
    obj.rotation.y = opt.dreh || 0;
    d.obj = obj; obj.userData.ding = d;
    d.koerper = koerperAus(obj, def.form);
    platziere(d, def, opt);
    dinge.push(d); aktualisiere(d, true);
    if(def.danach) def.danach(d, opt);
    return d;
  };
  const r = def.bau(opt);
  if(r && typeof r.then === 'function') d.bereit = r.then(fertig);
  else { fertig(r); d.bereit = Promise.resolve(d); }
  return d;
}
story.setze = setze;
// Ein schon vorhandenes Objekt anmelden (z. B. ein Modell aus einer Etappe). opt: { welt ('*' = ueberall), form, beweglich }
function ding(obj, opt){
  opt = opt || {};
  const d = { typ: opt.typ || obj.name || '?', welt: opt.welt !== undefined ? opt.welt : story.etappe, obj, koerper: koerperAus(obj, opt.form),
    bb: new THREE.Box3(), beweglich: !!opt.beweglich, aus: false, nurZuFuss: !!opt.nurZuFuss };
  obj.userData.ding = d; dinge.push(d); aktualisiere(d, true);
  return d;
}
story.ding = ding;
// Instanzen (InstancedMesh: Baeume, Container, Felsen) anmelden – jede Instanz ein eigener Koerper in ihrer Matrix.
// form: 'kreis' (Zylinder: Stamm, Kaktus), 'quader' (Container) oder 'kugel' (Felsen). nur(i): nur diese Instanzen
// (z. B. bei Baeumen nur die Staemme). Rueckgabe: das Ding (eines fuer alle Instanzen).
story.instanzen = function(inst, opt){
  opt = opt || {};
  inst.updateMatrixWorld(true);
  const geo = inst.geometry; geo.computeBoundingBox();
  const art = opt.form === 'kugel' ? 'kugel' : opt.form === 'kreis' ? 'zyl' : 'box';
  const koerper = [], mi = new THREE.Matrix4();
  for(let i = 0; i < inst.count; i++){
    if(opt.nur && !opt.nur(i)) continue;
    inst.getMatrixAt(i, mi);
    const ersatz = { matrixWorld: new THREE.Matrix4().multiplyMatrices(inst.matrixWorld, mi) };   // wie ein Mesh fuer aktualisiereK
    koerper.push(neuK(ersatz, art, opt.box || geo.boundingBox));
  }
  const d = { typ: opt.typ || inst.name || 'instanzen', welt: opt.welt !== undefined ? opt.welt : story.etappe, obj: inst, koerper, bb: new THREE.Box3(), beweglich: false, aus: false };
  inst.userData.ding = d; dinge.push(d); d.stand = undefined;
  d.bb.makeEmpty(); for(const k of koerper){ aktualisiereK(k); d.bb.union(k.wb); } d.stand = bildNr;
  rastern(d);
  return d;
};
// Viele Koerper (tausende Palmen auf km Laenge): in ZELLE-m-Felder einsortieren, tiefe() fragt nur die Felder um (x, z)
const ZELLE = 20;
function rastern(d){
  if(d.koerper.length < 64) return;
  d.zellen = new Map();
  for(const k of d.koerper){
    const w = k.wb;
    for(let i = Math.floor(w.min.x / ZELLE); i <= Math.floor(w.max.x / ZELLE); i++)
      for(let j = Math.floor(w.min.z / ZELLE); j <= Math.floor(w.max.z / ZELLE); j++){
        const key = i * 100003 + j; let l = d.zellen.get(key); if(!l) d.zellen.set(key, l = []); l.push(k); }
  }
}
const _leer = [];
function koerperBei(d, x, z, r){
  if(!d.zellen) return d.koerper;
  const i0 = Math.floor((x - r) / ZELLE), i1 = Math.floor((x + r) / ZELLE), j0 = Math.floor((z - r) / ZELLE), j1 = Math.floor((z + r) / ZELLE);
  if(i0 === i1 && j0 === j1) return d.zellen.get(i0 * 100003 + j0) || _leer;
  const s = new Set(); for(let i = i0; i <= i1; i++) for(let j = j0; j <= j1; j++){ const l = d.zellen.get(i * 100003 + j); if(l) for(const k of l) s.add(k); }
  return s;
}

// ---- Koerper aus den Bauteilen -----------------------------------------------------------------
function ausgenommen(o, root){
  for(let p = o; p; p = p.parent){ const u = p.userData; if(u.begehbar || u.keinKoerper || u.deko) return true; if(p === root) break; }
  return false;
}
function neuK(m, art, bb){
  const k = { m, art, box: bb.clone(), c: bb.getCenter(new THREE.Vector3()), inv: new THREE.Matrix4(), s: new THREE.Vector3(1, 1, 1), wb: new THREE.Box3() };
  const sz = bb.getSize(new THREE.Vector3());
  if(art === 'zyl'){ k.R = Math.max(sz.x, sz.z) / 2; k.hh = sz.y / 2; }
  if(art === 'kugel') k.R = Math.max(sz.x, sz.y, sz.z) / 2;
  return k;
}
const _b = new THREE.Box3(), _m4 = new THREE.Matrix4();
function koerperAus(root, form){
  root.updateMatrixWorld(true);
  if(form === 'kreis' || form === 'quader'){
    // eine Form um das ganze Objekt, in dessen eigenen Achsen
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), bb = new THREE.Box3();
    root.traverse(o => { if(!o.isMesh || ausgenommen(o, root)) return; o.geometry.computeBoundingBox();
      _m4.multiplyMatrices(inv, o.matrixWorld); bb.union(_b.copy(o.geometry.boundingBox).applyMatrix4(_m4)); });
    return bb.isEmpty() ? [] : [neuK(root, form === 'kreis' ? 'zyl' : 'box', bb)];
  }
  const liste = [];
  root.traverse(o => {
    if(!o.isMesh || ausgenommen(o, root)) return;
    const geo = o.geometry; if(!geo || !geo.attributes || !geo.attributes.position) return;
    geo.computeBoundingBox();
    const t = geo.type || '';
    if(/^Cylinder/.test(t)) liste.push(neuK(o, 'zyl', geo.boundingBox));
    else if(/^Sphere/.test(t)) liste.push(neuK(o, 'kugel', geo.boundingBox));
    else if(/^(Box|Plane|Circle|Shape|Ring|Cone|Torus)/.test(t)) liste.push(neuK(o, 'box', geo.boundingBox));
    else for(const b of scheiben(geo, o)) liste.push(neuK(o, 'box', b));
  });
  return liste;
}
// Frei geformtes Teil: laengs seiner laengsten Achse in Scheiben (~0,4 m), jede so gross wie das, was in ihr liegt.
// Die Dreiecke werden dafuer abgetastet (ein grosses Dreieck hat nur drei Ecken – die allein faenden die Mitte nicht).
const scheibenCache = new Map();
function scheiben(geo, mesh){
  const e = mesh.matrixWorld.elements, s = Math.max(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])) || 1;
  const bb = geo.boundingBox, sz = bb.getSize(new THREE.Vector3());
  const ax = sz.x >= sz.y && sz.x >= sz.z ? 'x' : (sz.y >= sz.z ? 'y' : 'z');
  const n = klemme(Math.ceil(sz[ax] * s / 0.4), 1, 24);
  const key = geo.uuid + ':' + n;
  if(scheibenCache.has(key)) return scheibenCache.get(key);
  if(n === 1){ const r = [bb.clone()]; scheibenCache.set(key, r); return r; }
  const boxen = Array.from({ length: n }, () => new THREE.Box3());
  const pos = geo.attributes.position, idx = geo.index, nTri = (idx ? idx.count : pos.count) / 3;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3();
  const abst = sz[ax] / n / 2;                         // Tastabstand: halbe Scheibe
  for(let t = 0; t < nTri; t++){
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const kk = klemme(Math.ceil(Math.max(a.distanceTo(b), a.distanceTo(c), b.distanceTo(c)) / abst), 1, 24);
    for(let i = 0; i <= kk; i++) for(let j = 0; j <= kk - i; j++){
      p.copy(a).addScaledVector(b.clone().sub(a), i / kk).addScaledVector(c.clone().sub(a), j / kk);
      const sl = klemme(Math.floor((p[ax] - bb.min[ax]) / sz[ax] * n), 0, n - 1);
      boxen[sl].expandByPoint(p);
    }
  }
  const r = boxen.filter(x => !x.isEmpty());
  scheibenCache.set(key, r);
  return r;
}
function aktualisiereK(k){
  const mw = k.m.matrixWorld, e = mw.elements;
  k.inv.copy(mw).invert();
  k.s.set(Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10]));
  if(k.art === 'box') k.wb.copy(k.box).applyMatrix4(mw);
  else { const R = k.R, hh = k.art === 'zyl' ? k.hh : k.R;
    k.wb.min.set(k.c.x - R, k.c.y - hh, k.c.z - R); k.wb.max.set(k.c.x + R, k.c.y + hh, k.c.z + R); k.wb.applyMatrix4(mw); }
}
// Bewegliche Dinge einmal pro Bild nachfuehren, feste nur beim Anmelden
function aktualisiere(d, zwingen){
  if(!d.obj) return;
  if(!zwingen && (d.beweglich ? d.stand === bildNr : d.stand !== undefined)) return;
  d.stand = bildNr;
  if(d.beweglich || zwingen) d.obj.updateMatrixWorld(true);
  d.bb.makeEmpty();
  for(const k of d.koerper){ aktualisiereK(k); d.bb.union(k.wb); }
}
story.dingNeu = (d) => aktualisiere(d, true);
// Ding aus der Welt nehmen (z. B. in den Rucksack gesteckt): Grenze weg, Objekt bleibt dem Aufrufer
story.entferne = function(d){ const i = dinge.indexOf(d); if(i >= 0) dinge.splice(i, 1); if(d.obj && d.obj.parent) d.obj.parent.remove(d.obj); };      // nach dem Verschieben eines festen Dings
// unsichtbare Dinge sperren nicht (z. B. die geparkte Kulisse eines Fliegers, waehrend man selbst darin sitzt)
// nurZuFuss: Fahrzeuge (Boote, U-Boote) sperren nur Samus Schritte – faehrt er selbst, rammt er sie nicht (Verfolgung)
function aktiv(d){ return d.obj && d.obj.parent && d.obj.visible && !d.aus && (!d.nurZuFuss || !!eva) && (d.welt === '*' || d.welt === story.etappe) && locale === (d.ort || 'earth'); }

// ---- Abfrage: wie tief steckt eine Kugel / Saeule in den Grenzen? ---------------------------------------------
const _l = new THREE.Vector3(), _q = new THREE.Vector3(), _p = new THREE.Vector3();
// > 0 = steckt drin (m), <= 0 = frei (Abstand)
function eindringen(k, p, r){
  _l.copy(p).applyMatrix4(k.inv);
  if(k.art === 'kugel') return r - (_l.distanceTo(k.c) - k.R) * Math.max(k.s.x, k.s.y, k.s.z);
  if(k.art === 'zyl'){
    const dx = _l.x - k.c.x, dy = _l.y - k.c.y, dz = _l.z - k.c.z, rad = Math.hypot(dx, dz);
    if(rad <= k.R && Math.abs(dy) <= k.hh) return r + Math.min((k.R - rad) * Math.max(k.s.x, k.s.z), (k.hh - Math.abs(dy)) * k.s.y);
    const f = rad > k.R ? k.R / rad : 1;
    _q.set(k.c.x + dx * f, k.c.y + klemme(dy, -k.hh, k.hh), k.c.z + dz * f).applyMatrix4(k.m.matrixWorld);
    return r - _q.distanceTo(p);
  }
  const b = k.box;
  const qx = klemme(_l.x, b.min.x, b.max.x), qy = klemme(_l.y, b.min.y, b.max.y), qz = klemme(_l.z, b.min.z, b.max.z);
  if(qx === _l.x && qy === _l.y && qz === _l.z)
    return r + Math.min((_l.x - b.min.x) * k.s.x, (b.max.x - _l.x) * k.s.x, (_l.y - b.min.y) * k.s.y, (b.max.y - _l.y) * k.s.y,
                        (_l.z - b.min.z) * k.s.z, (b.max.z - _l.z) * k.s.z);
  _q.set(qx, qy, qz).applyMatrix4(k.m.matrixWorld);
  return r - _q.distanceTo(p);
}
// Saeule bei (x, z): Kugeln mit Radius r von fuss + stufe bis fuss + h. Rueckgabe: tiefste Eindringung.
function tiefe(x, z, fuss, h, r, stufe, ausser){
  if(stufe === undefined) stufe = STUFE;
  const y0 = fuss + stufe + r, y1 = Math.max(y0, fuss + h - r);
  const n = Math.max(1, Math.ceil((y1 - y0) / 0.3) + 1);
  let t = -Infinity;
  for(const d of dinge){
    if(d === ausser || !aktiv(d)) continue;
    aktualisiere(d);
    const bb = d.bb;
    if(x < bb.min.x - r || x > bb.max.x + r || z < bb.min.z - r || z > bb.max.z + r || y1 + r < bb.min.y || y0 - r > bb.max.y) continue;
    for(const k of koerperBei(d, x, z, r)){
      const w = k.wb;
      if(x < w.min.x - r || x > w.max.x + r || z < w.min.z - r || z > w.max.z + r) continue;
      for(let i = 0; i < n; i++){
        const y = n === 1 ? y0 : y0 + (y1 - y0) * i / (n - 1);
        if(y + r < w.min.y || y - r > w.max.y) continue;
        const e = eindringen(k, _p.set(x, y, z), r);
        if(e > t) t = e;
      }
    }
  }
  return t;
}
story.tiefe = tiefe;
// ---- Tiere als Koerper (Live-Wunsch 18.10.2026: "durch die Tiere moechte ich nicht durchlaufen") ------------------
// Tiere sind animiert und laufen umher – statt ihrer Bauteile zaehlt eine aufrechte Saeule (Kreis r, Hoehe h) um ihren
// Platz. Jede Tierdatei meldet ihre Liste an: story.tierQuelle(() => [{ x, z, y, r, h }, ...]) in Weltkoordinaten.
// story.tierListe() liefert alle der aktuellen Etappe (auch fuer den Hund: drumherum laufen).
const tierQuellen = [];
story.tierQuelle = (f) => tierQuellen.push(f);
let tierBild = -1, tierCache = [];
story.tierListe = function(){
  if(tierBild === bildNr) return tierCache;
  tierBild = bildNr; tierCache = [];
  if(locale === 'space') return tierCache;
  // Quellen gelten auf der Erde; eine Quelle mit ort ('moon' / 'mars', z. B. die Aliens) gilt nur dort
  for(const f of tierQuellen){ if((f.ort || 'earth') !== locale) continue; try { const l = f(); if(l) for(const t of l) tierCache.push(t); } catch(e){ console.warn('Tierquelle', e); } }
  return tierCache;
};
story.tierQuelleOrt = (ort, f) => { f.ort = ort; tierQuellen.push(f); };
// > 0 = steckt drin (wie tiefe)
function tierTiefe(x, z, fuss, r){
  let t = -Infinity;
  for(const a of story.tierListe()){
    if(a.y !== undefined && (fuss > a.y + (a.h || 1) || fuss + FIGUR.h < a.y)) continue;   // drueber / drunter
    const e = r + a.r - Math.hypot(x - a.x, z - a.z);
    if(e > t) t = e;
  }
  return t;
}
story.tierTiefe = tierTiefe;
// ---- Setzen: freier Platz, auf derselben Flaeche ------------------------------------------------------------
const _f = new THREE.Box3();
const ueber = (a, b) => a.min.x < b.max.x - 0.01 && a.max.x > b.min.x + 0.01 && a.min.y < b.max.y - 0.01 && a.max.y > b.min.y + 0.01 &&
                        a.min.z < b.max.z - 0.01 && a.max.z > b.min.z + 0.01;
function istIn(o, wurzel){ for(let p = o; p; p = p.parent) if(p === wurzel) return true; return false; }
function agenten(){
  const a = [];
  if(eva && eva.group){ const p = eva.group.position; a.push({ x: p.x, y: p.y, z: p.z, r: FIGUR.r, h: FIGUR.h }); }
  return a;
}
function bodenY(def, x, z, opt){
  if(opt.auf) return _f.setFromObject(opt.auf).max.y;
  if(opt.y !== undefined) return opt.y;
  if(def.untergrund === 'wasser') return 0;
  return evaFootY(x, z);
}
function untergrundOk(def, x, z){
  if(def.untergrund === 'egal') return true;
  if(def.untergrund === 'wasser') return isOpenWater(x, z);
  return evaSolid(x, z);
}
const _w = new THREE.Vector3();
function stelleFrei(d, def, opt, x, z){
  const obj = d.obj;
  // x, z (und die Hoehe) sind Weltkoordinaten – liegt das Objekt in einer Untergruppe (opt.in, z. B. auf dem Tisch im
  // Raum), wird in deren Koordinaten umgerechnet
  _w.set(x, bodenY(def, x, z, opt), z);
  obj.parent.updateMatrixWorld(true); obj.position.copy(obj.parent.worldToLocal(_w));
  obj.updateMatrixWorld(true);
  d.bb.makeEmpty(); for(const k of d.koerper){ aktualisiereK(k); d.bb.union(k.wb); }
  if(opt.fest) return true;
  if(opt.auf){ const f = _f.setFromObject(opt.auf);
    if(d.bb.min.x < f.min.x - 1e-3 || d.bb.max.x > f.max.x + 1e-3 || d.bb.min.z < f.min.z - 1e-3 || d.bb.max.z > f.max.z + 1e-3) return false; }
  else if(!untergrundOk(def, x, z)) return false;
  for(const e of dinge){
    if(!e.obj || !e.obj.parent || e.aus || (e.welt !== d.welt && e.welt !== '*')) continue;
    aktualisiere(e);
    if(!ueber(e.bb, d.bb)) continue;
    for(const k of e.koerper){
      if(opt.auf && istIn(k.m, opt.auf)) continue;              // die Ablage selbst traegt es nur
      if(!ueber(k.wb, d.bb)) continue;
      for(const m of d.koerper) if(ueber(k.wb, m.wb)) return false;
    }
  }
  if(d.welt === story.etappe) for(const a of agenten()){
    const b = d.bb;
    if(b.max.y > a.y + STUFE && b.min.y < a.y + a.h && b.min.x - a.r < a.x && b.max.x + a.r > a.x && b.min.z - a.r < a.z && b.max.z + a.r > a.z) return false;
  }
  return true;
}
function platziere(d, def, opt){
  const x0 = opt.x || 0, z0 = opt.z || 0;
  if(stelleFrei(d, def, opt, x0, z0)) return;
  // Ringe um den Wunschplatz, Schrittweite nach der Groesse des Objekts
  const sz = d.bb.getSize(new THREE.Vector3()), gross = Math.hypot(sz.x, sz.z) / 2;
  const schritt = klemme(gross / 3, 0.03, 0.5), weit = opt.weit || Math.max(3, gross * 4);
  let versuche = 0;
  for(let r = schritt; r <= weit && versuche < 900; r += schritt){
    const n = Math.max(8, Math.ceil(2 * Math.PI * r / schritt));
    for(let i = 0; i < n; i++, versuche++){
      const a = i / n * Math.PI * 2 + r;
      if(stelleFrei(d, def, opt, x0 + Math.cos(a) * r, z0 + Math.sin(a) * r)) return;
    }
  }
  console.warn('Kein freier Platz fuer', d.typ, '– bleibt an der gewuenschten Stelle');
  stelleFrei(d, def, Object.assign({}, opt, { fest: true }), x0, z0);
}
// Freier Platz fuer Samu bei (x, z): fester Boden, keine Grenze
story.freierPlatz = function(x, z){
  const hits = story.hitsOhneDinge || hitsBuilding;
  const ok = (px, pz) => {
    if(!evaSolid(px, pz)) return false;
    const fy = evaFootY(px, pz);
    if(hits(px, fy + 1, pz, false)) return false;
    return tiefe(px, pz, fy, FIGUR.h, FIGUR.r, FIGUR.stufe) <= 0;
  };
  if(ok(x, z)) return { x, z };
  for(let r = 0.15; r <= 4; r += 0.15) for(let i = 0; i < 16; i++){
    const a = i / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if(ok(px, pz)) return { x: px, z: pz };
  }
  return { x, z };
};
// Pruefung fuer Tests: Bauteile einer Welt ohne Grenze und ohne Markierung (sollte leer sein)
story.pruefeWelt = function(n){
  const g = story.welt(n), erfasst = new Set(), offen = [];
  for(const d of dinge) if(d.obj) d.obj.traverse(o => erfasst.add(o));
  g.traverse(o => { if(!o.isMesh || erfasst.has(o)) return;
    for(let p = o; p; p = p.parent){ const u = p.userData; if(u.begehbar || u.keinKoerper || u.deko || u.agent) return; }
    offen.push((o.name || o.geometry.type) + ' @' + o.getWorldPosition(new THREE.Vector3()).toArray().map(v => v.toFixed(1)).join(',')); });
  return offen;
};
// Welt entsorgt -> ihre Dinge mit
const entsOrig = story.weltEntsorgen;
story.weltEntsorgen = function(n){ for(let i = dinge.length - 1; i >= 0; i--) if(dinge[i].welt === n) dinge.splice(i, 1); return entsOrig.apply(this, arguments); };

// ---- Das eigene Fahrzeug der Engine (planeGroup) -------------------------------------------------------------------
// Live-Befund 18.10.2026: durch den geparkten Flieger (X-Wing, Alpha Jet am Bahnende, Transall ...) lief Samu hindurch –
// er ist kein Kulissen-Klon, sondern das Engine-Fahrzeug. Es bekommt dieselbe Grenze in seiner echten Form, aber NUR,
// solange Samu ausgestiegen ist: sitzt er drin, fragt die Engine hitsBuilding fuer den Absturz – da darf der Flieger
// nicht an sich selbst haengen bleiben. Wechselt das Modell (buildModel), wird die Grenze neu gebaut.
const eigen = { d: null, mesh: null };
function eigenesFahrzeug(){
  if(typeof planeGroup === 'undefined' || typeof modelHolder === 'undefined') return;
  const m = modelHolder.children[0] || null;
  if(m !== eigen.mesh){
    if(eigen.d){ const i = dinge.indexOf(eigen.d); if(i >= 0) dinge.splice(i, 1); eigen.d = null; }
    eigen.mesh = m;
    if(m){ eigen.d = ding(planeGroup, { welt: '*', typ: 'fahrzeug', beweglich: true });
      // Schatten, Schubbalken o. Ae. der Engine haengen nicht am Modell: nur das Modell zaehlt
      eigen.d.koerper = koerperAus(modelHolder); eigen.d.obj = planeGroup; }
  }
  if(eigen.d){
    // auch auf Mond und Mars (Live-Wunsch 18.10.2026): dort steht der Flieger auf dem Boden des Himmelskoerpers
    const amBoden = locale === 'earth' ? (state.onGround || state.pos.y < ISLAND_Y + 3) : state.onGround;
    eigen.d.aus = !eva || !planeGroup.visible || locale === 'space' || !amBoden;
    eigen.d.ort = locale;                                            // aktiv() vergleicht ort mit locale
  }
}
story.eigenesFahrzeug = () => eigen.d;               // fuer Tests

// ---- Mond und Mars: Fuesse auf der SICHTBAREN Oberflaeche (Live-Befund 18.10.2026, Screenshot: Samu und Barki bis
// ueber die Schuhe im Boden) -------------------------------------------------------------------------------------------
// Die Engine rechnet dort mit einem groben Hoehenraster (+1,5 m Aufschlag) und nur an EINER Stelle je Bild genau (Raycast
// unter dem Fokus, gilt 1,5 m weit). Je nach Gelaende stand man daneben in der Flaeche oder darueber. evaFootY (Fusshoehe
// fuer Samu, Barki, Aliens) misst hier jetzt selbst per Raycast gegen die Bodenkachel unter dem Punkt, zwischengespeichert
// auf 0,25 m genau. surfaceY (Flieger, Landung) bleibt, wie die Engine es braucht.
const _bRay = new THREE.Raycaster(), _bVon = new THREE.Vector3(), _bAb = new THREE.Vector3(0, -1, 0);
const bodenCache = new Map(); let bodenOrt = null;
function bodenGenau(x, z){
  const G = typeof GROUNDS !== 'undefined' && GROUNDS[locale]; if(!G || !G.tiles) return null;
  if(bodenOrt !== locale){ bodenCache.clear(); bodenOrt = locale; }
  const key = Math.round(x * 4) + ',' + Math.round(z * 4);
  if(bodenCache.has(key)) return bodenCache.get(key);
  const T = G.tile, tile = G.tiles.get(Math.round(x / T) + ',' + Math.round(z / T)); if(!tile) return null;
  _bVon.set(x, 4000, z); _bRay.set(_bVon, _bAb);
  let y = null;
  const hit = _bRay.intersectObject(tile, true); if(hit.length) y = hit[0].point.y;
  if(locale === 'moon' && typeof moonBaseObj !== 'undefined' && moonBaseObj && moonBaseObj.visible){   // Plattform der Basis
    const h2 = _bRay.intersectObject(moonBaseObj, true); for(const h of h2) if(y === null || h.point.y > y) y = h.point.y; }
  if(y === null) return null;                                     // Kachel da, aber kein Treffer: nicht merken
  if(bodenCache.size > 4000) bodenCache.clear();
  bodenCache.set(key, y);
  return y;
}
story.bodenGenau = bodenGenau;
function hookBodenGenau(){
  const fussOrig = evaFootY;
  evaFootY = function(x, z){
    if(locale === 'moon' || locale === 'mars'){ const y = bodenGenau(x, z); if(y !== null) return y; }
    return fussOrig.apply(this, arguments);
  };
  // (Kacheln werden beim Weiterlaufen neu geklont, haben an derselben Stelle aber dieselbe Form – gemerkte Werte bleiben gueltig)
}

// ---- Jedes Bild: Zaehler (bewegliche Grenzen einmal pro Bild nachfuehren) -------------------------------------
story.updateObjekte = function(){ bildNr++; eigenesFahrzeug(); };

// ---- Einhaengen: als AEUSSERSTE Huelle um hitsBuilding (nach allen anderen Hooks, also zum Start) ----------------
function hookAussen(){
  const hitsOrig = hitsBuilding;
  story.hitsOhneDinge = function(){ return hitsOrig.apply(this, arguments); };
  hitsBuilding = function(x, y, z){
    if(locale === 'earth' && dinge.length){
      const von = story.schrittVon && story.schrittVon();
      if(von){
        // Samus eigener Schritt: die Engine fragt 1 m ueber den Fuessen. Wer schon drinsteckt, darf hinaus.
        const luft = story.figurInLuft && story.figurInLuft() ? SPRUNG : 0;
        // Fusshoehe: die hoehere von "da, wo er steht" und "Boden dort". An einer Kante (Steg) liegt der Boden dahinter
        // tief im Wasser – von dort gesehen waere der Traeger unter dem Steg eine Wand, und er bliebe oben haengen
        // (Live-Regression: vom Steg seitlich ins Wasser ging nicht mehr). Er steht aber oben und tritt ueber die Kante.
        const fuss = Math.max(y - 1, von.y) + luft;
        const t = tiefe(x, z, fuss, FIGUR.h, FIGUR.r, FIGUR.stufe);
        if(t > 0 && t > tiefe(von.x, von.z, Math.max(evaFootY(von.x, von.z), von.y) + luft, FIGUR.h, FIGUR.r, FIGUR.stufe) + 1e-6) return true;
        // Tiere: nicht hindurch, wer drinsteckt (Tier lief in ihn hinein), darf hinaus
        const tt = tierTiefe(x, z, fuss, FIGUR.r);
        if(tt > 0 && tt > tierTiefe(von.x, von.z, fuss, FIGUR.r) + 1e-6) return true;
      } else if(tiefe(x, z, y - 1, FIGUR.h, FIGUR.r) > 0) return true;     // alle anderen (Kamera, Engine): Saeule um y
    }
    return hitsOrig.apply(this, arguments);
  };
  // Samus eigener Schritt (schrittVon): waehrend die Engine ihn bewegt; in der Luft zaehlen die Fuesse hoeher
  const evaOrig = updateEva;
  updateEva = function(){ schritt = true; try { return evaOrig.apply(this, arguments); } finally { schritt = false; } };
  story.schrittVon = () => (schritt && eva) ? eva.group.position : null;
  story.figurInLuft = () => !!(eva && !eva.onGround);
  // Mond und Mars: die Engine fragt dort fuer Samus Schritte nur evaSolid (hitsBuilding gilt nur auf der Erde) – das
  // eigene Fahrzeug ist dort trotzdem eine Grenze (Live-Wunsch 18.10.2026). Nur fuer Samus Schritt, wer drinsteckt, darf hinaus.
  const solidOrig = evaSolid;
  evaSolid = function(x, z){
    const r = solidOrig.apply(this, arguments);
    if(!r || locale === 'earth' || locale === 'space' || !schritt || !eva) return r;
    const von = eva.group.position, fuss = von.y;
    if(eigen.d && !eigen.d.aus){
      const t = tiefe(x, z, fuss, FIGUR.h, FIGUR.r, FIGUR.stufe);
      if(t > 0 && t > tiefe(von.x, von.z, fuss, FIGUR.h, FIGUR.r, FIGUR.stufe) + 1e-6) return false;
    }
    // Tiere / Aliens auf Mond und Mars (story.tierQuelleOrt)
    const tt = tierTiefe(x, z, fuss, FIGUR.r);
    return !(tt > 0 && tt > tierTiefe(von.x, von.z, fuss, FIGUR.r) + 1e-6);
  };
  // Zaehler je Bild (bewegliche Grenzen)
  const loopOrig = loop;
  loop = function(){ story.updateObjekte(); return loopOrig.apply(this, arguments); };
}
let schritt = false;
const startVorher = window.STORY_START;
window.STORY_START = function(){ hookAussen(); hookBodenGenau(); if(startVorher) return startVorher.apply(this, arguments); };
})();
