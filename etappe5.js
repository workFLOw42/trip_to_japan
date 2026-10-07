// Trip to Japan – Etappe 5: Chinesisches Meer (Hongkong). Air Race mit der Mustang vs. U-Boot-Schlucht.
// Laedt nach etappe4b.js, vor der Engine. Aktiv erst, wenn story.etappe === 5.
// Welt: die Startinsel der Engine (Zelle 0,0: Gras, Strand, Startbahn laengs z) im offenen Meer, dahinter
// eine Hochhaus-Skyline als Kulisse. Die Mustang steht am +z-Ende der Startbahn, Nase nach -z.
//   Sicher (Air Race, "4 Tage"): Startsequenz mit Ansager (ohne Zeit, ohne Kurzschluss), dann ein Parcours
//     aus Pylonen-Toren ueber dem Meer, gewertet AUF ZEIT wie beim Red Bull Air Race: Tor verpasst +5 s,
//     Pylon gestreift +3 s, zu hoch durchs Tor +2 s. Ziel (letztes Tor) unter der Zielzeit -> 4 Tage,
//     darueber oder Absturz -> 7 Tage.
//   Risiko (U-Boot-Schlucht, "1 Tag"): folgt im naechsten Schritt (Ring am Strand, vorerst Hinweis).
(function(){
'use strict';
const story = window.STORY;
function e5(){ return story.etappe === 5; }
function hier(){ return e5() && locale === 'earth'; }

// ---- Startplatz -------------------------------------------------------------------------------
// Startinsel der Engine: Mitte (0,0), Radius 260 m, Startbahn 24 x 260 m laengs z durch die Mitte.
const RW_HALB = 130;
const MUSTANG = { x: 0, z: RW_HALB - 20, yaw: 0 };   // +z-Ende der Bahn, Nase nach -z (die ganze Bahn voraus)
// U-Boot-Ring = der Strandring aus Etappe 1 (dieselbe Startinsel): Engine-Einstieg ueber harborSubNear/imRing.
// Kenji kommt zwischen Mustang und Ring an, damit beide gleich weit weg sind (der Ring liegt am anderen Ufer).
function ubootRing(){ return (story.ubootRingPlatz && story.ubootRingPlatz()) || { x: 200, z: -260 }; }
function ankunft(){ const r = ubootRing(); return { x: (MUSTANG.x + r.x) / 2 + 30, z: (MUSTANG.z + r.z) / 2 }; }

// ---- Parcours ---------------------------------------------------------------------------------
// Live-Wunsch: Looping, Steilflug und Messerflug gehoeren hinein (die Schraube im Steilflug ist wieder raus: zwischen
// den Ringen drehte die Maschine weg, der Weg war zu kurz zum Abfangen). Jedes Tor ist eine Flaeche im
// Raum mit Mitte, Durchflugrichtung (3D) und Form; gezaehlt wird, wenn die Mustang die Torebene in
// Durchflugrichtung durchstoesst – innerhalb der Flaeche = geschafft, daneben = verpasst.
//   pylon  – zwei Pylonen am Wasser (Breite b, bis zur Spitze PYLON_H), Durchflug waagerecht
//   messer – zwei hohe Pylonen, nur MESSER_B breit: mit 11 m Spannweite passt man nur mit ~90 Grad Querlage
//            durch (Querlage wird geprueft, nicht nur die Fluegel)
//   ring   – Ring mit Radius r (senkrecht = Looping-Ein-/Ausgang, liegend = Steigflug)
// Richtung: 'nz' (nach -z), 'pz' (nach +z), 'hoch' (senkrecht nach oben) oder Winkel d.
// Gerechnet mit der Spielphysik (C:\tmp\sfg\test_figuren.js): Looping 3,8 s, 110-175 m hoch; senkrecht steigt
// sie von 160 auf 1300 m und rollt dabei 4x; Messerflug sinkt in 4 s nur 4 m.
const TORE = [
  // Live-Test: zu unuebersichtlich, bei dem Tempo hilft das Radar nicht -> Tore ~550 m auseinander (vorher ~300 m),
  // und sichtbar sind nur das aktuelle (leuchtet) und das naechste Tor (torSichtbar).
  { typ: 'pylon', x:    0, z:  -600, b: 40, d:  0.0 },
  { typ: 'pylon', x:  100, z: -1150, b: 36, d:  0.2 },
  { typ: 'pylon', x:  -60, z: -1700, b: 34, d: -0.3 },
  // Messerflug: gerade anfliegen, 90 Grad rollen, durch, zurueckrollen
  { typ: 'messer', x:   0, z: -2250, d: 0.0, text: 'Messerflug! Leg die Mustang auf die Seite.' },
  // Looping: Eingangsring und Ausgangsring tief ueber dem Wasser, beide nach -z (Live-Test: ein Ring oben im Scheitel
  // war nicht zu treffen, die Tore lagen zu dicht). Dazwischen prueft das Spiel den Flug (loopingPruefen): die Nase
  // muss einmal ganz herum (>= 300 Grad Nicken) und man muss dabei auf dem Ruecken gewesen sein. Ein Looping hat bei
  // 300-500 km/h 50-85 m Radius und versetzt kaum nach vorn – 350 m bis zum Ausgangsring reichen zum Ausrichten.
  { typ: 'ring',  x:    0, y:  25, z: -2850, r: 22, dir: 'nz', loopEin: true, text: 'Jetzt der Looping! Durch den Ring, dann voll ziehen und durch den zweiten Ring wieder raus.' },
  { typ: 'ring',  x:    0, y:  25, z: -3200, r: 22, dir: 'nz', loopAus: true },
  // Steilflug: unten durch den liegenden Ring hochziehen, senkrecht weiter, oben durch den zweiten
  { typ: 'ring',  x:    0, y:  80, z: -3600, r: 28, dir: 'hoch', text: 'Steilflug! Unter dem Ring senkrecht hochziehen und durch beide Ringe nach oben.' },
  { typ: 'ring',  x:    0, y: 420, z: -3600, r: 30, dir: 'hoch', text: 'Weiter senkrecht hoch, durch den oberen Ring!' },
  // runter und zurueck zur Insel: oben ueber den Ruecken abkippen, dann fliegt man nach +z. Von ~540 m auf Pylonen-
  // hoehe braucht es 600-900 m Strecke (30-40 Grad Sinkflug), daher das erste Tor 750 m hinter dem Ring, und der
  // Rueckweg seitlich (x 350) neben den Toren des Hinwegs.
  { typ: 'pylon', x:  350, z: -2850, b: 44, d: Math.PI, text: 'Über den Rücken abkippen und zurück zur Insel!' },
  { typ: 'pylon', x:  400, z: -2250, b: 38, d: 3.2 },
  { typ: 'pylon', x:  320, z: -1650, b: 38, d: 3.3 },
  { typ: 'pylon', x:  220, z: -1050, b: 40, d: 3.4, text: 'Letzte Figur: bis zum Zielring eine Schraube – einmal ganz um die eigene Achse rollen!' },
  // Live-Wunsch: nach der letzten Pylone noch eine Schraube (waagerecht, viel Platz: 600 m bis zum Zielring)
  { typ: 'ring',  x:   80, y: 25, z: -480, r: 24, dir: 'pz', schraube: true, ziel: true },
];
const PYLON_H = 25;            // m hoch, Tor gilt bis zur Pylonenspitze
const PYLON_R = 1.6;           // m Radius
const PYLON_TREFF = 3;         // m dazu: Rumpf + etwas – die Fluegel duerfen ueber den Schlauch (fairer fuers Kind)
const MESSER_B = 13.5, MESSER_H = 45, MESSER_Y = 22; // Messertor: 13,5 m breit (Live-Wunsch: 9 m +50 %), 45 m hohe Pylonen, Mitte auf 22 m
const MESSER_QUER = 60 * Math.PI / 180;             // mindestens 60 Grad Querlage gilt als Messerflug
// Looping auslassen kostet mehr als er dauert (Live-Test: durch beide Ringe geradeaus kostete nur 3 s, der Looping mehr)
const STRAFE = { verpasst: 5, pylon: 3, hoch: 2, messer: 3, looping: 15, schraube: 3 };
// Zielzeit (Bot C:\tmp\sfg\test_e5bot2.js, fliegt alle Figuren): 70 % Schub 60,6 s Flugzeit, mit 11 s Strafen
// (2 Pylonen, 1 Tor) 71,6 s. Ohne Figuren war der Slalom 51 s – die drei Figuren kosten ~10 s. 85 s: ein sauberer
// Flug mit ein, zwei Fehlern reicht; wer Figuren auslaesst (+3..5 s je) oder viel streift, wird knapp.
// Live-Test nach dem Auseinanderziehen der Tore (~550 m): 100 s, dann 90 s reichen.
// Live-Test: zuverlaessig in 69 s geflogen -> 80 s (gut 10 s Puffer fuer Fehler)
const ZIELZEIT = 80;
const START_GAS = 0.0;

// ---- Tore: Lage im Raum ------------------------------------------------------------------------
// n = Durchflugrichtung (Normale der Torebene), m = Mitte, quer/hoch = Achsen in der Ebene (fuer die Form)
function torLage(T){
  const n = new THREE.Vector3(), m = new THREE.Vector3(T.x, 0, T.z);
  if(T.dir === 'hoch') n.set(0, 1, 0);
  else if(T.dir === 'pz') n.set(0, 0, 1);
  else if(T.dir === 'nz') n.set(0, 0, -1);
  else n.set(-Math.sin(T.d || 0), 0, -Math.cos(T.d || 0));
  if(T.typ === 'ring') m.y = T.y;
  else if(T.typ === 'messer') m.y = MESSER_Y;
  else m.y = PYLON_H / 2;
  // quer: waagerecht in der Ebene (beim liegenden Ring: x); hoch: senkrecht dazu in der Ebene
  const quer = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), n).normalize();
  const hoch = new THREE.Vector3().crossVectors(n, quer).normalize();
  return { n, m, quer, hoch };
}
// Liegt der Durchstosspunkt in der Torflaeche? (u = quer, v = hoch, relativ zur Mitte)
function imTor(T, u, v){
  if(T.typ === 'ring') return Math.hypot(u, v) <= T.r;
  if(T.typ === 'messer') return Math.abs(u) <= MESSER_B / 2 && Math.abs(v) <= MESSER_H / 2;
  return Math.abs(u) <= T.b / 2 && v <= PYLON_H / 2 + 0.01;     // Pylonen: bis zur Spitze (unten ist Wasser)
}
// Pylonen eines Tors (fuer die Kollision): Fusspunkte und Hoehe
function torPylone(T, L){
  if(T.typ === 'ring') return [];
  const b = T.typ === 'messer' ? MESSER_B : T.b, h = T.typ === 'messer' ? MESSER_H + MESSER_Y - MESSER_H / 2 : PYLON_H;
  return [-1, 1].map(s => ({ x: T.x + L.quer.x * s * b / 2, z: T.z + L.quer.z * s * b / 2, h }));
}

// ---- Welt -------------------------------------------------------------------------------------
// Skyline-Kueste links der Strecke: Wasserkante bei x = KUESTE.x, von z0 (hinter der Insel) bis z1 (hinter dem letzten Tor)
const KUESTE = { x: -1000, z0: 1400, z1: -4400 };
const welt = { gebaut: false, pylone: [], tore: [], marken: [] };
story.e5tore = welt.tore;                           // fuer den Bot (C:\tmp\sfg\test_e5bot.js)
function baueWelt(){
  if(welt.gebaut) return; welt.gebaut = true;
  const w = story.welt(5);
  // Skyline (Hongkong) als Kueste LINKS entlang des ganzen Parcours (Live-Test: man sah sie nicht – sie stand hinter der
  // Insel, im Rennen fliegt man bis 3,6 km davon weg, der Nebel endet bei 3 km). Jetzt 0,9-2 km seitlich der Strecke.
  // Hochhaeuser dicht an der Wasserkante, nach hinten niedriger; Landstreifen darunter.
  let s = 517; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const farben = [0x9aa7b4, 0x6f7f8f, 0xc9d2da, 0x4f5d6b, 0xb7c4cf, 0x8c97a1];
  const proFarbe = farben.map(() => []);
  const box = new THREE.BoxGeometry(1, 1, 1);
  for(let i = 0; i < 420; i++){
    const z = KUESTE.z0 - rnd() * (KUESTE.z0 - KUESTE.z1);
    const tief = Math.pow(rnd(), 1.4);                 // 0 = an der Wasserkante, 1 = landeinwaerts
    const x = KUESTE.x - 20 - tief * 900;
    const nah = 1 - tief;
    const b = 22 + rnd() * 34, t = 22 + rnd() * 34, h = 50 + Math.pow(rnd(), 1.5) * (160 + 320 * nah);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2 - 2, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rnd() - 0.5) * 0.4),
      new THREE.Vector3(b, h, t));
    proFarbe[Math.floor(rnd() * farben.length)].push(m);
  }
  proFarbe.forEach((ms, i) => {
    if(!ms.length) return;
    const inst = new THREE.InstancedMesh(box, new THREE.MeshLambertMaterial({ color: farben[i] }), ms.length);
    ms.forEach((m, k) => inst.setMatrixAt(k, m)); inst.frustumCulled = false; w.add(inst);
  });
  // Landstreifen unter der Skyline (leicht ueber dem Wasser, Kante zum Meer)
  const land = new THREE.Mesh(new THREE.BoxGeometry(1200, 4, KUESTE.z0 - KUESTE.z1 + 400), new THREE.MeshLambertMaterial({ color: 0x5d6a4f }));
  land.position.set(KUESTE.x - 600, 0, (KUESTE.z0 + KUESTE.z1) / 2); w.add(land);
  // Tore: Pylonen (Kegel-Schlauch rot/weiss wie beim Air Race), Messertor (hoch, schmal), Ringe (Looping/Steigflug)
  const rot = new THREE.MeshLambertMaterial({ color: 0xe8352b }), weiss = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const ringMat = new THREE.MeshLambertMaterial({ color: 0xe8352b, emissive: 0x401008 });
  const pylon = (h, r) => {
    const g = new THREE.Group();
    const u = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.1, r * 1.6, h * 0.55, 14), rot); u.position.y = h * 0.275; g.add(u);
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 1.1, h * 0.45, 14), weiss); o.position.y = h * 0.775; g.add(o);
    return g;
  };
  TORE.forEach((T, i) => {
    // je Tor eine eigene Gruppe: sichtbar sind nur das aktuelle und das naechste (torSichtbar)
    const L = torLage(T), tor = { i, T, L, x: L.m.x, z: L.m.z, pyl: [], g: new THREE.Group() };
    w.add(tor.g);
    if(T.typ === 'ring'){
      // Ring: Torus, Achse = Durchflugrichtung; rot-weiss in Segmenten wie die Pylonen
      const g = new THREE.Group();
      const seg = 12;
      for(let k = 0; k < seg; k++){
        const m = new THREE.Mesh(new THREE.TorusGeometry(T.r, 2.4, 8, 6, Math.PI * 2 / seg), k % 2 ? weiss : ringMat);
        m.rotation.z = k * Math.PI * 2 / seg; g.add(m);
      }
      g.position.copy(L.m);
      g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), L.n);
      tor.g.add(g); tor.ring = g;
      // Ring hoch ueber dem Wasser: ein Mast darunter, damit man sieht, wo er steht
      if(T.dir !== 'hoch' || T.y > 100){
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, L.m.y - T.r, 8), weiss);
        mast.position.set(L.m.x, (L.m.y - T.r) / 2, L.m.z);
        if(T.dir === 'hoch'){ mast.position.x += T.r + 2; mast.scale.y = (L.m.y) / (L.m.y - T.r); mast.position.y = L.m.y / 2; }
        tor.g.add(mast);
      }
    } else {
      for(const q of torPylone(T, L)){
        const g = pylon(q.h, T.typ === 'messer' ? PYLON_R * 0.9 : PYLON_R);
        if(T.ziel){ g.children[0].material = weiss; g.children[1].material = rot; }   // Ziel umgekehrt gefaerbt
        g.position.set(q.x, 0, q.z); tor.g.add(g);
        tor.pyl.push({ x: q.x, z: q.z, h: q.h, g, getroffen: false });
      }
    }
    // Leucht-Variante der Materialien fuer das aktuelle Tor
    tor.g.traverse(o => { if(o.isMesh){ o.userData.basis = o.material; o.userData.hell = hell(o.material); } });
    welt.tore.push(tor);
  });
  torSichtbar(true);
}
// Leuchtende Kopie eines Materials (einmal je Material)
const _hell = new Map();
function hell(m){
  if(!_hell.has(m)){ const h = m.clone(); h.emissive = new THREE.Color(m.color).multiplyScalar(0.75); _hell.set(m, h); }
  return _hell.get(m);
}
// Live-Test: beim Looping war nicht klar, wo in der Luft Ringe haengen. Das aktuelle Tor bekommt eine Leuchtsaeule
// (wie die Ziel-Saeulen der anderen Etappen) vom Wasser bis hoch in den Himmel; sie steht in der Tormitte.
let saeule = null;
function torSaeule(t){
  if(!saeule){
    saeule = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    saeule.renderOrder = 995; story.welt(5).add(saeule);
  }
  saeule.visible = !!t && ar.laeuft;                           // Live-Wunsch: erst nach der Startsequenz
  if(!saeule.visible) return;
  // ab der Oberkante des Tors 30 m hoch (Live-Wunsch): der Durchflug selbst bleibt frei
  const unten = t.T.typ === 'ring' ? t.L.m.y + (t.T.dir === 'hoch' ? 6 : t.T.r + 4) : (t.pyl[0] ? t.pyl[0].h + 4 : 30);
  const h = 30;
  saeule.scale.set(1, h, 1); saeule.position.set(t.L.m.x, unten + h / 2, t.L.m.z);
}
// Nur das aktuelle (leuchtend) und das naechste Tor zeigen; vor dem Rennen die ersten beiden
let torSichtbarN = -1;
// Live-Wunsch: der Looping-Ausgangsring verwirrt, solange man noch hochzieht – er erscheint erst ab der Haelfte des
// Loopings (Nase > 180 Grad herum), vorher ist er weder als naechstes noch als aktuelles Tor zu sehen (auch kein Pfeil).
function ausgangVersteckt(t){ return !!(t && t.T.loopAus && (ar.naechstes < t.i || ar.loopWinkel < Math.PI)); }
function torSichtbar(immer){
  const n = ar.aktiv ? (ar.landen || ar.fertig ? -9 : ar.naechstes) : 0;
  const k = n + (ausgangVersteckt(welt.tore[n]) || ausgangVersteckt(welt.tore[n + 1]) ? 0.5 : 0) + (ar.laeuft ? 0.25 : 0);   // Schluessel inkl. Versteck, Rennen laeuft
  if(k === torSichtbarN && !immer) return;
  torSichtbarN = k;
  for(const t of welt.tore){
    // im Looping (Ausgang noch versteckt) gar nichts zeigen – sonst rueckte das Tor danach als naechstes nach
    t.g.visible = (t.i === n || t.i === n + 1) && !ausgangVersteckt(t) && !ausgangVersteckt(welt.tore[n]);
    const an = t.i === n;
    t.g.traverse(o => { if(o.isMesh && o.userData.basis) o.material = an ? o.userData.hell : o.userData.basis; });
  }
  torSaeule(welt.tore[n] && !ausgangVersteckt(welt.tore[n]) ? welt.tore[n] : null);
}
// ---- Rennen -----------------------------------------------------------------------------------
const ar = story.airRace = { aktiv: false, laeuft: false, t: 0, naechstes: 0, strafe: 0, fehler: [], hudEl: null, fertig: false,
  seite: null, rede: null, loopWinkel: 0, loopKopf: false, naseVor: null, rolle: 0, obenVor: null, landen: false, zeitZiel: 0 };
const AR_TEXT = [
  'Willkommen beim Air Race über dem Chinesischen Meer! Ich bin heute dein Ansager.',
  'Du fliegst die Mustang durch ' + TORE.length + ' Tore: zwischen den Pylonen hindurch, unter der Spitze, und durch die Ringe.',
  'Dazu kommen drei Figuren: ein Messerflug durch ein ganz schmales Tor, ein Looping und ein Steilflug senkrecht hoch durch zwei Ringe übereinander. Zum Schluss eine Schraube, und nach dem Ziel landest du auf der Insel.',
  'Gewertet wird die Zeit. Ein verpasstes Tor kostet fünf Sekunden, ein gestreifter Pylon oder eine vergessene Figur drei.',
  'Schaffst du es unter ' + ZIELZEIT + ' Sekunden, geht es schon morgen weiter nach Japan.',
  'Es leuchtet immer das Tor, durch das du als Nächstes musst, dahinter siehst du schon das folgende. Ich sage dir an, wenn eine Figur kommt.',
  'Erst die Startsequenz, dann geht es los!',
];

function mustangEinsteigen(){
  story.phase = 'airrace';
  Object.assign(ar, { aktiv: true, laeuft: false, t: 0, naechstes: 0, strafe: 0, fehler: [], fertig: false, seite: null, loopWinkel: 0, loopKopf: false, naseVor: null, rolle: 0, obenVor: null, landen: false, zeitZiel: 0 });
  for(const t of welt.tore) for(const p of t.pyl){ p.getroffen = false; p.g.rotation.z = 0; }
  torSichtbar(true);
  const idx = MODEL_NAMES.indexOf('Mustang');
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = 'Mustang';
  buildModel('Mustang'); spec = PLANE_SPECS.Mustang || DEFAULT_SPEC;
  state.pos.set(MUSTANG.x, ISLAND_Y, MUSTANG.z);
  state.quat.setFromEuler(new THREE.Euler(0, MUSTANG.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = START_GAS; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat); planeGroup.visible = true;
  if(park.obj) park.obj.visible = false;
  snapCamera();
  story.hinweis('');
  ar.rede = story.sprich(AR_TEXT, () => {
    story.pfStart({ kurzschluss: false, ohneZeit: true, still: true, danach: () => {
      ar.laeuft = true; ar.t = 0;
      story.ziel = zielPunkt();
      story.sprich(['Startsequenz abgeschlossen. Die Zeit läuft – Vollgas und ab durchs erste Tor!'], null, 'pilot');
    }});
  }, 'pilot');
}
function zielPunkt(){ const t = welt.tore[ar.naechstes]; return t ? { x: t.L.m.x, z: t.L.m.z } : null; }


function arUpdate(dt){
  if(!ar.laeuft || ar.fertig) return;
  ar.t += dt;
  const p = state.pos;
  // Pylonen gestreift (einmal je Pylon): Messertor-Pylonen eng (nur der Rumpf), sonst Rumpf + etwas
  for(const t of welt.tore) for(const q of t.pyl){
    if(q.getroffen || p.y > q.h + 2) continue;
    if(Math.hypot(p.x - q.x, p.z - q.z) < PYLON_R + (t.T.typ === 'messer' ? 1.2 : PYLON_TREFF)){
      q.getroffen = true; q.g.rotation.z = 0.35;           // knickt weg wie der Luftschlauch
      strafe('pylon', 'Pylon gestreift! Plus drei Sekunden.');
    }
  }
  _arU.set(0, 1, 0).applyQuaternion(state.quat);                 // Flieger-Oben (Messerflug-Pruefung)
  _arF.set(0, 0, -1).applyQuaternion(state.quat);                // Nase
  // Zwischen Eingangs- und Ausgangsring: Nickdrehung aufsummieren (Winkel der Nase je Bild) und Rueckenlage merken
  const tl = welt.tore[ar.naechstes];
  if(tl && tl.T.loopAus && ar.naseVor){
    ar.loopWinkel += Math.acos(Math.max(-1, Math.min(1, _arF.dot(ar.naseVor))));
    if(_arU.y < -0.5) ar.loopKopf = true;
  }
  // Vor dem Schraubenring: Rolle um die Nase aufsummieren (Oben des letzten Bilds senkrecht zur Nase gestellt)
  if(tl && tl.T.schraube && ar.obenVor){
    _arV.copy(ar.obenVor).addScaledVector(_arF, -ar.obenVor.dot(_arF));
    if(_arV.lengthSq() > 1e-6){ _arV.normalize();
      ar.rolle += Math.acos(Math.max(-1, Math.min(1, _arV.dot(_arU)))) * (Math.sign(_arF.dot(_arW.crossVectors(_arV, _arU))) || 1); }
  }
  ar.obenVor = (ar.obenVor || new THREE.Vector3()).copy(_arU);
  ar.naseVor = (ar.naseVor || new THREE.Vector3()).copy(_arF);
  const t = welt.tore[ar.naechstes];
  if(!t) return;
  const L = t.L;
  const s = _arV.copy(p).sub(L.m).dot(L.n);                 // < 0 davor, > 0 durch
  if(ar.seite !== null && ar.seite < 0 && s >= 0){
    _arV.copy(p).sub(L.m);
    const u = _arV.dot(L.quer), v = _arV.dot(L.hoch);
    if(imTor(t.T, u, v)){
      if(t.T.typ === 'pylon' && p.y > PYLON_H) strafe('hoch', 'Zu hoch! Plus zwei Sekunden.');
      if(t.T.typ === 'messer'){
        // Querlage: Fluegel-Oben steht waagerecht (Oben quer zur Welt-Senkrechten)
        if(Math.abs(_arU.y) > Math.cos(MESSER_QUER)) strafe('messer', 'Nicht auf der Seite! Plus drei Sekunden.');
        else story.sprich(['Messerflug, super!'], null, 'pilot');
      }
      if(t.T.loopEin){ ar.loopWinkel = 0; ar.loopKopf = false; }
      if(t.T.schraube){
        if(Math.abs(ar.rolle) < 2 * Math.PI * 0.9) strafe('schraube', 'Keine Schraube gedreht! Plus drei Sekunden.');
        else story.sprich(['Schraube, klasse!'], null, 'pilot');
      }
      if(t.T.loopAus){
        if(ar.loopWinkel < 300 * Math.PI / 180 || !ar.loopKopf) strafe('looping', 'Kein ganzer Looping! Plus fünfzehn Sekunden.');
        else story.sprich(['Looping geschafft!'], null, 'pilot');
      }

      torGeschafft();
    } else if(Math.hypot(u, v) < 300){
      strafe('verpasst', 'Tor verpasst! Plus fünf Sekunden.');
      torGeschafft();
    }
  } else if(ar.seite !== null && s > 250){
    // weit daran vorbei (nie die Ebene in Reichweite durchstossen): verpasst, weiter zum naechsten.
    strafe('verpasst', 'Tor verpasst! Plus fünf Sekunden.');
    torGeschafft();
  }
  const tn = welt.tore[ar.naechstes];
  ar.seite = tn ? _arV.copy(p).sub(tn.L.m).dot(tn.L.n) : null;
  if(ar.t + ar.strafe > ZIELZEIT + 0.001 && !ar.fertig) arEnde(false, 'zu langsam');
}
const _arF = new THREE.Vector3(), _arU = new THREE.Vector3(), _arV = new THREE.Vector3(), _arW = new THREE.Vector3();
story.e5arUpdate = arUpdate;                        // fuer Tests (C:\tmp\sfg\test_loop2.js, test_loop3.js)
story.e5torSichtbar = () => torSichtbar();
function strafe(art, text){
  ar.strafe += STRAFE[art]; ar.fehler.push(art);
  if(typeof rumble === 'function' && art === 'pylon') rumble(250, 0.8, 0.5);
  story.sprich([text], null, 'pilot');
}
function torGeschafft(){
  ar.naechstes++;
  ar.rolle = 0;                                              // Schraube zaehlt ab dem letzten Tor
  if(ar.naechstes >= welt.tore.length){ zielDurch(); return; }
  const tn = welt.tore[ar.naechstes];
  if(tn.T.text) story.sprich([tn.T.text], null, 'pilot');
  story.ziel = zielPunkt();
}
// Live-Wunsch: nach dem Ziel nicht einfach abstuerzen, sondern sauber landen – die Zeit ist dann schon gestoppt.
// Zu langsam bleibt zu langsam (keine Landung noetig); sonst gilt das Rennen erst mit der Landung auf der Insel.
function zielDurch(){
  ar.zeitZiel = ar.t + ar.strafe;
  if(ar.zeitZiel > ZIELZEIT){ arEnde(false, 'zu langsam'); return; }
  ar.landen = true; ar.laeuft = false;
  story.ziel = { x: MUSTANG.x, z: 0 };                       // Radar: zur Startbahn
  torSichtbar(true);
  // Zeit erst nach der Landung ansagen (Live-Wunsch: nicht doppelt); 20 % Schub reichen, die Sinkrate ist nur etwas hoeher
  story.sprich(['Im Ziel! Die Zeit ist gestoppt – jetzt noch sauber auf der Insel landen.',
    'Gas auf zwanzig Prozent, langsam runter und auf der Bahn aufsetzen.'], null, 'pilot');
}
function landungPruefen(){
  if(!ar.landen || ar.fertig) return;
  if(state.crashed){ arEnde(false, 'absturz'); return; }
  const sp = Math.hypot(state.vel.x, state.vel.z);
  if(state.onGround && sp < 2 && isOnLand(state.pos.x, state.pos.z)){ ar.landen = false; arEnde(true, 'ziel'); }
}
function arEnde(ok, wie){
  if(ar.fertig) return;
  ar.fertig = true; ar.laeuft = false;
  story.ziel = null;
  const zeit = ar.zeitZiel || (ar.t + ar.strafe);
  if(ok && story.neueZeit) story.neueZeit('airrace', zeit);
  const txt = ok ? ['Sauber gelandet! ' + fmt(zeit) + ' Sekunden – super geflogen!']
    : wie === 'absturz' ? ['Oh nein, die Mustang ist abgestürzt! Das Rennen ist vorbei.']
    : ['Die Zeit ist um. Schade – das war leider zu langsam.'];
  story.sprich(txt, () => story.spaeter(1.5, () => {
    ar.aktiv = false; arHud();
    story.etappeEnde(ok ? 4 : 7, ok ? 'Air Race geschafft' : (wie === 'absturz' ? 'Absturz beim Air Race' : 'Air Race zu langsam'));
  }), 'pilot');
}
function fmt(t){ return t.toFixed(1).replace('.', ','); }
// ---- Richtungspfeil zum aktuellen Tor ------------------------------------------------------------
// Live-Test: nach dem Looping verliert man die Orientierung, das Radar hilft bei dem Tempo nicht. Liegt das
// leuchtende Tor nicht im Bild, zeigt ein grosser Pfeil am Bildrand, wohin man schauen bzw. drehen muss.
const _pfV = new THREE.Vector3();
function torPfeil(){
  if(!ar.pfeilEl){
    ar.pfeilEl = document.createElement('div'); ar.pfeilEl.dataset.etappeHud = '1';
    ar.pfeilEl.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:21;'
      + 'border-left:26px solid transparent;border-right:26px solid transparent;border-bottom:52px solid #ffd23f;'
      + 'filter:drop-shadow(0 0 6px rgba(0,0,0,.7));transform-origin:26px 26px;';
    document.body.appendChild(ar.pfeilEl);
  }
  const t = welt.tore[ar.naechstes];
  if(!ar.laeuft || !t || ausgangVersteckt(t)){ ar.pfeilEl.style.display = 'none'; return; }
  _pfV.copy(t.L.m).project(camera);
  const vorn = _pfV.z < 1;                                   // vor der Kamera?
  const imBild = vorn && Math.abs(_pfV.x) < 0.85 && Math.abs(_pfV.y) < 0.85;
  if(imBild){ ar.pfeilEl.style.display = 'none'; return; }
  // Richtung in Bildkoordinaten (hinter der Kamera: gespiegelt)
  let x = _pfV.x, y = _pfV.y;
  if(!vorn){ x = -x; y = -y; }
  const l = Math.hypot(x, y) || 1; x /= l; y /= l;
  const W = innerWidth, H = innerHeight, r = Math.min(W, H) * 0.38;
  const px = W / 2 + x * r - 26, py = H / 2 - y * r - 26;
  const winkel = Math.atan2(x, y) * 180 / Math.PI;           // 0 = nach oben
  ar.pfeilEl.style.display = '';
  ar.pfeilEl.style.transform = 'translate(' + px.toFixed(0) + 'px,' + py.toFixed(0) + 'px) rotate(' + winkel.toFixed(0) + 'deg)';
}
function arHud(){
  if(!ar.hudEl){
    ar.hudEl = document.createElement('div'); ar.hudEl.dataset.etappeHud = '1';
    ar.hudEl.style.cssText = 'position:absolute;left:50%;top:56px;transform:translateX(-50%);padding:8px 16px;border-radius:10px;'
      + 'background:rgba(0,0,0,.72);color:#fff;font:600 18px system-ui,sans-serif;pointer-events:none;z-index:20;white-space:nowrap;';
    document.body.appendChild(ar.hudEl);
  }
  if(!ar.aktiv || !ar.laeuft && !ar.fertig && !ar.landen){ ar.hudEl.style.display = 'none'; return; }
  ar.hudEl.style.display = '';
  if(ar.landen){ const h = '⏱ ' + fmt(ar.zeitZiel) + ' s ✔  ·  🛬 jetzt landen'; if(ar.hudEl._h !== h){ ar.hudEl.innerHTML = h; ar.hudEl._h = h; } return; }
  const zeit = ar.t + ar.strafe, rest = ZIELZEIT - zeit;
  const farbe = rest < 10 ? '#ff5a3c' : rest < 25 ? '#ffd23f' : '#fff';
  const html = '⏱ <span style="color:' + farbe + '">' + Math.max(0, Math.ceil(rest)) + ' s</span>'
    + (ar.strafe ? '  ·  <span style="color:#ff8a6a">+' + ar.strafe + ' s</span>' : '')
    + '  ·  🚩 Tor ' + Math.min(ar.naechstes + 1, welt.tore.length) + '/' + welt.tore.length
;
  if(ar.hudEl._h !== html){ ar.hudEl.innerHTML = html; ar.hudEl._h = html; }
}

// ---- Kulisse: geparkte Mustang, Marken, Ringe ---------------------------------------------------
const park = { obj: null };
function ladeParkMustang(){
  if(park.obj || !glbTemplates['Mustang']) return;
  const g = new THREE.Group(), m = glbTemplates['Mustang'].clone(true);
  m.rotation.y = TRAFFIC_ROT.Mustang || 0; g.add(m);
  g.position.set(MUSTANG.x, ISLAND_Y, MUSTANG.z); g.rotation.y = MUSTANG.yaw;
  g.userData.fremd = true;                        // Modell geteilt (Engine-Vorlage): nur abhaengen
  story.welt(5).add(g); park.obj = g;
}
const marken = [];
function updateMarken(){
  if(!marken.length && story.baueMarke){
    marken.push({ m: story.baueMarke(0xffd23f, '4 Tage'), x: MUSTANG.x, z: MUSTANG.z, h: 3 });   // h = Fahrzeug-Oberkante (story.setzeMarke)
    const rg = ubootRing(); marken.push({ m: story.baueMarke(0xffffff, '1 Tag'),  x: rg.x, z: rg.z, h: 0 });
  }
  const zeigen = e5() && !!eva && locale === 'earth' && !story.phase;
  for(const o of marken) story.setzeMarke(o.m, o.x, ISLAND_Y, o.z, o.h, zeigen);
}
function mustangNah(){ return !!(e5() && !story.phase && eva && !(park.obj && !park.obj.visible)
  && Math.hypot(eva.group.position.x - MUSTANG.x, eva.group.position.z - MUSTANG.z) < 12); }

// ---- Start der Etappe -------------------------------------------------------------------------
function etappe5Start(){
  // Nur die Startinsel (Zelle 0,0) – Etappe 2-4 haben die Inseln abgeschaltet
  _islandInfoCalc = function(cx, cz){ return cx === 0 && cz === 0 ? { isStart: true, wx: 0, wz: 0, radius: 260 } : null; };
  _islandCache.clear(); _subBerthCache.clear(); _xwpCache.clear(); _parkCache.clear(); _wreckCache.clear();
  refreshIslands();
  if(typeof clearSeaShips === 'function') clearSeaShips();          // neu gesetzt: ausserhalb des Parcours
  // Orcas/Fische/Unterwasser-Zellen neu setzen (wie Etappe 2-4): sonst behielten sie ihre Plaetze aus der Etappe davor –
  // aus dem Hafenbecken von Etappe 4 lagen alle sechs Orcas mitten auf der Insel (Live-Bild: Wale springen ueber die Insel)
  if(typeof clearOrcas === 'function') clearOrcas();
  if(typeof clearUwCells === 'function') clearUwCells();
  if(typeof clearFish === 'function') clearFish();
  if(typeof clearArrows === 'function') clearArrows();
  if(typeof clearFire === 'function') clearFire();
  seabedMesh.visible = true;
  if(story.e1aufraeumen) story.e1aufraeumen();
  for(const n of [2, 3, 4]) story.weltEntsorgen(n);
  // Schnellboot-Flucht aus Etappe 4 beenden: ihr HUD blieb sonst oben stehen (fl.aktiv wurde nie zurueckgesetzt)
  const fl = story.flucht; if(fl){ fl.aktiv = false; fl.laeuft = false; if(fl.hudEl) fl.hudEl.style.display = 'none'; }
  baueWelt();
  if(locale !== 'earth') enterEarth();
  clearEva();
  currentModel = MODEL_NAMES.indexOf('Mustang');
  buildModel('Mustang'); spec = PLANE_SPECS.Mustang || DEFAULT_SPEC;
  state.pos.set(MUSTANG.x, ISLAND_Y, MUSTANG.z);
  state.quat.setFromEuler(new THREE.Euler(0, MUSTANG.yaw, 0, 'YXZ'));
  state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true; state.crashed = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  planeGroup.visible = false;                       // die geparkte Mustang ist Kulisse, bis man einsteigt
  evaExit();
  const an = ankunft(), rg = ubootRing();
  eva.group.position.set(an.x, ISLAND_Y, an.z);
  const mx = (MUSTANG.x + rg.x) / 2 - an.x, mz = (MUSTANG.z + rg.z) / 2 - an.z;
  eva.yaw = Math.atan2(-mx, -mz); eva.group.rotation.y = eva.yaw;
  evaOrbit = 0; evaPitch = 0;
  snapCamera();
  if(!welt.ringUboot) welt.ringUboot = story.einstiegsRing(rg.x, ISLAND_Y, rg.z);
  ladeParkMustang();
  if(park.obj) park.obj.visible = true;
  marken.length = 0;
  ar.aktiv = false; ar.fertig = false;
  story.phase = null;
  story.ende = false;
  story.hinweis('Zwei Wege: U-Boot (weißer Ring am Strand) oder Air Race mit der Mustang (gelb) – hinlaufen und Y drücken');
  story.spaeter(12, () => { if(eva && !story.phase) story.hinweis(''); });
}
story.etappe5Start = etappe5Start;

// ---- Hooks ------------------------------------------------------------------------------------
function hookE5(){
  // Auf der Race-Bahn darf niemand starten und landen: die Engine-Flotte sucht sich Inseln mit Bahn, und hier gibt es
  // nur diese eine. Am Himmel fliegen trotzdem Maschinen (story.js: himmelUpdate, nur Reiseflug, keine Landung).
  const updateTrafficOrig = updateTraffic, updateFlybyOrig = updateFlyby;
  updateTraffic = function(dt){
    if(hier()){ if(fleet.length){ for(const e of fleet) removePlane(e); fleet.length = 0; } if(typeof clearAiEffects === 'function') clearAiEffects(); return; }
    return updateTrafficOrig(dt);
  };
  updateFlyby = function(dt){ if(hier()){ if(typeof clearFlyby === 'function') clearFlyby(); return; } return updateFlybyOrig(dt); };  // Engine-Schiffe nicht durch den Parcours (Live-Bild: Kreuzfahrtschiff zwischen den Toren) – dort gilt
  // fuer sie "kein Wasser", sie drehen ab wie an einer Kueste. Rechteck um alle Tore + 350 m Rand.
  const sx = TORE.map(t => t.x), sz = TORE.map(t => t.z);
  const RAND = 350, PX0 = Math.min(...sx) - RAND, PX1 = Math.max(...sx) + RAND, PZ0 = Math.min(...sz) - RAND, PZ1 = Math.max(...sz) + RAND;
  const shipWaterOrig = seaShipWaterFor;
  seaShipWaterFor = function(sh, x, z){
    if(hier() && ((x > PX0 && x < PX1 && z > PZ0 && z < PZ1) || x < KUESTE.x + 150)) return false;   // Parcours, Kueste
    return shipWaterOrig.apply(this, arguments);
  };
  // Mustang hier; ins U-Boot geht es ueber den Engine-Einstieg am Strandring (etappe5b.js haengt sich dort ein)
  const boardYOrig = evaBoardY;
  evaBoardY = function(){
    if(hier() && mustangNah()){ mustangEinsteigen(); return; }
    return boardYOrig.apply(this, arguments);
  };
  // Waehrend der Ansage steht die Mustang mit Bremse auf der Bahn
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(hier() && story.phase === 'airrace' && ar.aktiv && !ar.laeuft && !ar.landen && !story.preflight.aktiv && !ar.fertig){
      state.vel.set(0, 0, 0); state.throttle = 0; return;
    }
    const r = physOrig.apply(this, arguments);
    if(hier() && story.phase === 'airrace'){
      arUpdate(dt);
      if(state.crashed && ar.laeuft && !ar.fertig) arEnde(false, 'absturz');
      landungPruefen();
    }
    return r;
  };
  // Nach einem Absturz kein Reset auf den Startplatz: das Ende kommt ueber arEnde
  const resetOrig = resetPlane;
  resetPlane = function(){ if(hier() && story.phase === 'airrace') return; return resetOrig.apply(this, arguments); };
}

function updateE5(dt){
  if(!e5()) return;
  ladeParkMustang();
  if(park.obj) park.obj.visible = locale === 'earth' && !(story.phase === 'airrace');
  updateMarken();
  if(welt.ringUboot) welt.ringUboot.zeigen(!!eva && locale === 'earth' && !story.phase);
  if(welt.gebaut) torSichtbar();
  if(story.phase === 'airrace'){ arHud(); torPfeil(); } else if(ar.pfeilEl) ar.pfeilEl.style.display = 'none';
  if(story.updateE5b) story.updateE5b(dt);
}
story.updateE5 = updateE5;
story.aufgabeE5 = () => (story.aufgabeE5b && story.aufgabeE5b()) || (ar.aktiv ? ['Air Race', [
  ['Ziel', 'alle ' + TORE.length + ' Tore zwischen den Pylonen, unter ' + ZIELZEIT + ' s'],
  ['Figuren', 'Messerflug (auf die Seite), Looping, Steilflug durch 2 Ringe, zum Schluss eine Schraube'],
  ['Danach', 'Zeit stoppt im Zielring, dann auf der Insel landen'],
  ['Strafen', 'Tor verpasst +5 s · Pylon/Figur +3 s · zu hoch +2 s'],
  ['Weg', 'das leuchtende Tor, dahinter das nächste'],
  ['Zeit', ar.laeuft ? fmt(ar.t + ar.strafe) + ' s' : 'läuft ab dem Start'],
]] : (e5() && !story.phase ? ['Etappe 5: Chinesisches Meer', [
  ['U-Boot (weiß)', '1 Tag'],
  ['Mustang (gelb)', '4 Tage, Air Race über dem Meer'],
  ['Einsteigen', 'hinlaufen, Y'],
  ['Zeit', (42 - story.tage) + ' von 42 Tagen übrig'],
]] : null));

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookE5();
};
})();
