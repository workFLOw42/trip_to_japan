// Trip to Japan – Etappe 5b: U-Boot durch die Felsenschlucht (Risiko, "1 Tag").
// Laedt nach etappe5.js. Gleiche Welt (story.welt(5)), gleiche Startinsel wie Etappe 1: Kenji steigt im Ring am
// Strand ins grosse U-Boot (Engine-Einstieg ueber harborSubNear/imRing, Liegeplatz harborSubLocal(0,0)).
//   1. Ziffernfeld im HUD, nur EIN Versuch: Stick/Pfeile waehlen (senfgelber Rahmen), B drueckt, * loescht die letzte
//      Ziffer, # bestaetigt. Der Code 14 02 stand nur in Etappe 1 auf dem U-Boot-Weg (nicht gesprochen).
//      Falsch -> kurze Geschichte -> 7 Tage.
//   2. Schlucht am Meeresgrund (~110 m tief) in Bugrichtung: Felswaende links/rechts, oben eine Felsdecke (sonst
//      faehrt man darueber hinweg), Kurven, Felsboegen (darunter durchtauchen) und Rippen am Grund (darueber steigen).
//      Zwei Kontakte erlaubt, der dritte beendet die Fahrt; dazu ein Zeitlimit. Ausgang der Schlucht = Ziel -> 1 Tag.
//      Sonar-Ping (B) zeigt Waende und Hindernisse auf der Scheibe (eigener Massstab, 300 m).
// Ausgelegt auf das grosse U-Boot (95 x 23 m, 14 m/s, 0,55 rad/s, Tiefe max. ~5 m/s, C:\tmp\sfg\e5s_geo.js):
// Kanal 60 m breit, Kurvenradien 120-170 m (Heck schwenkt ~10 m aus), Hindernisse mit Abstand zu den Kurven.
(function(){
'use strict';
const story = window.STORY;
function e5(){ return story.etappe === 5; }
function hier(){ return e5() && locale === 'earth'; }

// ---- Schlucht: lokale Achsen ab dem Liegeplatz (u = laengs in Bugrichtung, v = quer, rechts positiv) ----
// Live-Test: das erste Hindernis kam zu ploetzlich -> erstes Hindernis erst nach zwei Kurven; insgesamt 2,1 km.
const SCH = { u0: 150, u1: 3100, b: 60 };            // Beginn/Ende laengs (m ab Liegeplatz), Kanalbreite (Plan: C:\tmp\e5s_plan2.js)
// Hoehe: Grund ~ -110 m, Felsdecke DECKE m darueber (Live-Wunsch: ohne Deckel fuhr man ueber alles hinweg). Innen 70 m –
// genug fuer Rippe (Wasserlinie >= 36 m ueber Grund, Turm +4) und Bogen (Wasserlinie <= 26 m).
const DECKE = 70;
// Knicke [Mitte u, Versatz v, Laenge] – Cosinus-Rampen wie im Fluss/Kanal (min. Radius ~120-170 m)
// Live-Wunsch: vor der ersten Rippe war es zu lange geradeaus -> enge Kurve gleich nach der Einfahrt (Radius 73 m, das Heck
// schwenkt ~15 m aus: im 60-m-Kanal bleiben ~22 m Spielraum), die anderen 130-146 m.
const KNICKE = [[380, 90, 180], [780, 80, 240], [1130, -100, 260], [1570, 90, 240], [2000, -90, 240], [2420, 70, 220], [2820, -60, 200]];
function mitteV(u){ let v = 0; for(const [uk, a, K] of KNICKE){ const s = (u - (uk - K / 2)) / K;
  if(s >= 1) v += a; else if(s > 0) v += a * (1 - Math.cos(Math.PI * s)) / 2; } return v; }
// Hindernisse (u, Art) auf den Geraden zwischen den Kurven: Bogen = Felsbalken quer, Unterkante BOGEN_UNTEN ueber Grund ->
// darunter durch; Rippe = Wall am Grund, Oberkante RIPPE_OBEN -> darueber hinweg. Keine Ansage (Live-Wunsch) – zu sehen per Sonar.
// 3. Feld = Luecke: -1 / +1 = an dieser Seite bleibt ein Durchgang von LUECKE m, 0 = ueber die ganze Breite (derzeit alle 0;
// live gewuenscht war statt halber Hindernisse: Bogen/Rippe mitten in einer Engstelle, siehe ENG).
const HIND = [[950, 'rippe', 0], [1785, 'bogen', 0], [2625, 'rippe', 0], [2970, 'bogen', 0]];
const LUECKE = 33;
// Querbereich [von, bis] eines Hindernisses (Abstand zur Mittellinie)
function hindQuer(luecke){ return luecke < 0 ? [-SCH.b / 2 + LUECKE, SCH.b / 2] : luecke > 0 ? [-SCH.b / 2, SCH.b / 2 - LUECKE] : [-SCH.b / 2, SCH.b / 2]; }
// Bogen: frei bis 30 m ueber Grund. Mit 22 m war er nicht passierbar: die Engine haelt das U-Boot (Wasserlinie) mindestens
// 12 m ueber Grund (SUB_FLOOR_CLR), bei Nase unten mehr – gemessen blieb es bei 20 m, der Turm (+4) stiess an.
// So bleibt ein Korridor von ~12-26 m (Wasserlinie), man muss tief, kommt aber durch.
const BOGEN_UNTEN = 34, BOGEN_DICK = 16;              // +4 m gegen die Glaettung des Grunds (Kuppen)
const RIPPE_OBEN = 24, RIPPE_DICK = 14;              // Rippe: 24 m hoch, 14 m dick
// Risikofahrt: zuegig UND genau. Strecke 2,95 km, 5 Engstellen (2 davon mit Bogen/Rippe), Bot C:\tmp\sfg\test_e5sbot.js:
// Vollgas 230 s ohne Kontakt, 80 % > 240 s. 250 s -> Vollgas mit 20 s Puffer; wer vorsichtig langsam faehrt, ist zu langsam.
const ZEIT_MAX = 250, KONTAKT_MAX = 2;
// Engstellen (Live-Wunsch: anspruchsvoller): eine Felsnase ragt von einer Seite in den Kanal, frei bleiben nur ENG_FREI m.
// Das U-Boot ist 23 m breit -> neben ihm noch ~6 m je Seite (live: 5 m war zu eng). [Mitte u, Seite -1 links / +1 rechts]. Auf der freien Geraden und
// in den sanften Kurven (Radius 130-137 m, das Heck schwenkt dort ~8 m aus), nicht an Rippen/Boegen und nicht in der engen Kurve.
// erste Engstelle 90 m hinter der engen Kurve (endet bei 470): Zeit zum Ausrichten, das Boot kam sonst schraeg hinein
// zweite Engstelle nicht direkt vor dem Bogen (1250): sonst gleichzeitig abtauchen und durchzirkeln – fuer das traege Boot zu viel
const ENG = [[565, -1], [1355, 1], [1785, 1], [2215, -1], [2625, -1]];   // je mittig auf einer Geraden; 1785/2625 = mit Bogen/Rippe
const ENG_FREI = 35, ENG_L = 50, ENG_RAMPE = 30;     // freie Breite, Laenge der Engstelle, weicher Uebergang davor/danach
// Kanalgrenzen an der Stelle u (Querabstand von der Mittellinie): links (negativ) und rechts (positiv)
function grenzen(u){
  let li = -SCH.b / 2, re = SCH.b / 2;
  for(const [ue, seite] of ENG){
    const d = Math.abs(u - ue);
    if(d > ENG_L / 2 + ENG_RAMPE) continue;
    const k = d <= ENG_L / 2 ? 1 : 1 - (d - ENG_L / 2) / ENG_RAMPE;   // 1 in der Engstelle, 0 am Rampenende
    const s = k * k * (3 - 2 * k), rein = (SCH.b - ENG_FREI) * s;   // so weit ragt die Felsnase hinein
    if(seite < 0) li = Math.max(li, -SCH.b / 2 + rein); else re = Math.min(re, SCH.b / 2 - rein);
  }
  return [li, re];
}
const CODE = '1402';
// Weltlage: Ursprung = Liegeplatz, Achse u = Bugrichtung des Kulissen-U-Boots
const lage = { ok: false, ox: 0, oz: 0, ux: 0, uz: -1, vx: 1, vz: 0, grund: -105 };
function lageRechnen(){
  if(lage.ok) return true;
  const info = islandInfo(0, 0), bl = harborSubLocal(0, 0);
  if(!info || !bl) return false;
  lage.ox = info.wx + bl.x; lage.oz = info.wz + bl.z;
  const f = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), bl.rot);
  lage.ux = f.x; lage.uz = f.z; lage.vx = -f.z; lage.vz = f.x;          // v = rechts vom Bug
  let g = 0, n = 0; for(let u = SCH.u0; u <= SCH.u1; u += 50){ g += seabedY(...punkt(u, 0)); n++; }
  lage.grund = g / n;
  lage.ok = true; return true;
}
function punkt(u, v){ return [lage.ox + lage.ux * u + lage.vx * v, lage.oz + lage.uz * u + lage.vz * v]; }
function lokal(x, z){ const dx = x - lage.ox, dz = z - lage.oz; return [dx * lage.ux + dz * lage.uz, dx * lage.vx + dz * lage.vz]; }
const _grund = new Map();
function grundY(u){                                   // echter Meeresgrund auf der Mittellinie, ueber +-40 m geglaettet
  const k = Math.round(u / 10);
  if(!_grund.has(k)){ let g = 0, n = 0; for(let d = -40; d <= 40; d += 10){ const uu = k * 10 + d, [x, z] = punkt(uu, mitteV(uu)); g += seabedY(x, z); n++; } _grund.set(k, g / n); }
  return _grund.get(k);
}
story.e5schlucht = { lage, mitteV, punkt, lokal, HIND, SCH, ENG, grenzen, grundY: (u) => grundY(u) };   // fuer Tests

// ---- Bau --------------------------------------------------------------------------------------
const bau = { fertig: false };
function baueSchlucht(){
  if(bau.fertig || !lageRechnen()) return;
  bau.fertig = true;
  const w = story.welt(5);
  // dunkle, unruhige Felsfarben – unter dem hellen Wasserlicht wirkten die ersten Toene wie Beton
  const mats = [0x3a3631, 0x4b4239, 0x433d36].map(c => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  let s = 77; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // Live-Wunsch: Felsen sahen aus wie Wuerfel -> unregelmaessige Brocken: Ikosaeder, Ecken zufaellig verschoben
  // (4 Formen, als Instanzen verteilt, kosten so viel wie vorher die Quader)
  const formen = [];
  for(let k = 0; k < 4; k++){
    const g = new THREE.IcosahedronGeometry(0.5, 1), p = g.attributes.position, mapV = new Map();
    for(let i = 0; i < p.count; i++){
      const key = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);   // gleiche Ecke = gleicher Versatz (kein Riss)
      if(!mapV.has(key)) mapV.set(key, 0.78 + rnd() * 0.44);
      const f = mapV.get(key); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
    }
    g.computeVertexNormals(); formen.push(g);
  }
  const richtung = (u) => { const [x0, z0] = punkt(u - 3, mitteV(u - 3)), [x1, z1] = punkt(u + 3, mitteV(u + 3)); return Math.atan2(x1 - x0, z1 - z0); };
  const teile = [];                                   // { x, y, z, sx, sy, sz, rot, kipp, f (Form), m (Material) }
  const brocken = (x, y, z, sx, sy, sz, rot) => teile.push({ x, y, z, sx, sy, sz, rot, kipp: (rnd() - 0.5) * 0.6, f: Math.floor(rnd() * 4), m: Math.floor(rnd() * 3) });
  // Waende: je Seite gestapelte Brocken (unten gross, oben kleiner) bis zur Decke; Innenkante auf der Kanalgrenze
  for(let u = SCH.u0 - 60; u <= SCH.u1 + 60; u += 11){
    const rot = richtung(u);
    const gz = grenzen(u), gy = grundY(u);
    for(const sgn of [-1, 1]){
      const kante = sgn < 0 ? gz[0] : gz[1];                // Innenkante (in Engstellen weiter drin)
      for(let h = 0; h < DECKE + 8; ){
        const gr = 16 + rnd() * 10 - h * 0.06, quer = gr * (1.1 + rnd() * 0.5) + Math.abs(kante - sgn * SCH.b / 2);
        const v = mitteV(u) + kante + sgn * (quer / 2 - 3);
        const [x, z] = punkt(u + (rnd() - 0.5) * 6, v);
        brocken(x, gy + h + gr * 0.4, z, quer, gr * 1.1, 16 + rnd() * 8, rot);
        h += gr * 0.7;
      }
    }
  }
  // Decke: Brocken quer ueber den Kanal auf DECKE, von unten unregelmaessig
  for(let u = SCH.u0 + 40; u <= SCH.u1 + 20; u += 14){
    const rot = richtung(u), gy = grundY(u);
    for(let q = -SCH.b / 2 - 10; q <= SCH.b / 2 + 10; q += 16){
      const [x, z] = punkt(u + (rnd() - 0.5) * 6, mitteV(u) + q);
      const dick = 14 + rnd() * 10;
      brocken(x, gy + DECKE + dick * 0.35, z, 20 + rnd() * 8, dick, 18 + rnd() * 6, rot);
    }
  }
  // Hindernisse quer ueber den Kanal: Bogen (Balken oben) und Rippe (Wall unten), aus mehreren Brocken
  for(const [u, art, luecke] of HIND){
    const rot = richtung(u), [qa, qb] = hindQuer(luecke), gy = grundY(u);
    for(let q = qa - (luecke < 0 ? -3 : 4); q <= qb + (luecke > 0 ? -3 : 4); q += 9){
      const [x, z] = punkt(u + (rnd() - 0.5) * 3, mitteV(u) + q);
      if(art === 'bogen'){
        // vom Balken bis zur Decke geschlossen (sonst haette man ueber dem Bogen durchschluepfen koennen)
        for(let h = BOGEN_UNTEN; h < DECKE; h += 10) brocken(x, gy + h + 6, z, 13, 13 + rnd() * 4, BOGEN_DICK + 6, rot);
      } else {
        for(let h = 0; h < RIPPE_OBEN; h += 9) brocken(x, gy + h + 4, z, 13, 12 + rnd() * 4, RIPPE_DICK + 6, rot);
      }
    }
  }
  // je Form und Material ein InstancedMesh (12 Zeichenaufrufe fuer die ganze Schlucht)
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), E = new THREE.Euler();
  for(let f = 0; f < 4; f++) for(let m = 0; m < 3; m++){
    const liste = teile.filter(t => t.f === f && t.m === m);
    if(!liste.length) continue;
    const inst = new THREE.InstancedMesh(formen[f], mats[m], liste.length);
    liste.forEach((t, k) => { q4.setFromEuler(E.set(t.kipp, t.rot, t.kipp * 0.7, 'YXZ')); m4.compose(new THREE.Vector3(t.x, t.y, t.z), q4, new THREE.Vector3(t.sx, t.sy, t.sz)); inst.setMatrixAt(k, m4); });
    inst.frustumCulled = false; w.add(inst);
  }
  bau.teile = teile.length;
  // Leuchtbojen am Schluchtende (Ziel), damit man es von weitem sieht (unter Wasser 150 m Sicht)
  const [zx, zz] = punkt(SCH.u1, mitteV(SCH.u1));
  const ziel = new THREE.Mesh(new THREE.TorusGeometry(SCH.b / 2 - 4, 2.2, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  ziel.position.set(zx, grundY(SCH.u1) + 30, zz); ziel.rotation.y = Math.atan2(lage.ux, lage.uz); w.add(ziel);
  bau.ziel = { x: zx, z: zz };
}

// ---- Ziffernfeld ------------------------------------------------------------------------------
const TASTEN = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const pad = { offen: false, wahl: 0, eingabe: '', el: null, prev: {} };
function padZeigen(){
  // Live-Wunsch: Aussehen und Platz wie das Ziffernfeld in Etappe 1 (story.js ziffernfeld: unten rechts, 34 px Tasten),
  // dazu nur der senfgelbe Rahmen um die gewaehlte Taste. Anzeige im selben Format "14 02" (fehlende Stellen: _).
  if(!pad.el){
    pad.el = document.createElement('div'); pad.el.dataset.etappeHud = '1';
    pad.el.style.cssText = 'position:absolute;right:16px;bottom:16px;padding:10px;border-radius:10px;'
      + 'background:#1c1f24;border:2px solid #444;box-shadow:0 4px 14px rgba(0,0,0,.5);z-index:20;'
      + 'font-family:monospace;';
    document.body.appendChild(pad.el);
  }
  const z = (pad.eingabe + '____').slice(0, 4), anzeige = z.slice(0, 2) + ' ' + z.slice(2);
  pad.el.innerHTML = '<div style="background:#0b0d0f;color:#ff2a2a;font-size:28px;letter-spacing:4px;'
    + 'padding:4px 10px;margin-bottom:8px;text-align:right;text-shadow:0 0 8px #f00;border-radius:4px">'
    + anzeige + '</div><div style="display:grid;grid-template-columns:repeat(3,34px);gap:5px">'
    + TASTEN.map((t, i) => '<div style="background:#3a3f46;color:#ddd;text-align:center;line-height:26px;'
      + 'border-radius:4px;font-size:15px;box-sizing:border-box;height:30px;border:2px solid ' + (i === pad.wahl ? '#d4a017' : 'transparent') + '">' + t + '</div>').join('') + '</div>';
  pad.el.style.display = '';
}
function padAus(){ pad.offen = false; if(pad.el) pad.el.style.display = 'none'; }
function padBewegen(dx, dy){
  const sp = pad.wahl % 3, ze = Math.floor(pad.wahl / 3);
  pad.wahl = Math.max(0, Math.min(3, ze + dy)) * 3 + Math.max(0, Math.min(2, sp + dx));
  padZeigen();
}
function padDruck(){
  const t = TASTEN[pad.wahl];
  if(t === '*'){ pad.eingabe = pad.eingabe.slice(0, -1); padZeigen(); return; }
  if(t === '#'){ if(pad.eingabe.length) padFertig(); return; }
  if(pad.eingabe.length < 4){ pad.eingabe += t; padZeigen(); }
}
function padFertig(){
  padAus();
  if(pad.eingabe === CODE){
    story.sprich(['Code richtig! Das U-Boot ist frei. Abtauchen und durch die Felsenschlucht – vorsichtig, die Wände sind nah.'], () => schluchtStart(), 'pilot');
  } else {
    story.sprich(['Falscher Code. Das U-Boot bleibt gesperrt.',
      'Ein Fischer nimmt Kenji mit – sein Kutter ist langsam, die Fahrt dauert eine Woche.'], () => {
      story.spaeter(1, () => { sb.aktiv = false; story.etappeEnde(7, 'falscher Code'); });
    }, 'pilot');
  }
}
// Tastatur: Pfeile/WASD, B, auch Ziffern direkt? Nein – Live-Wunsch: ueber das Pad. Capture, damit nichts in die Engine geht.
addEventListener('keydown', (e) => {
  if(!pad.offen) return;
  const c = e.code;
  if(c === 'ArrowLeft') padBewegen(-1, 0); else if(c === 'ArrowRight') padBewegen(1, 0);
  else if(c === 'ArrowUp') padBewegen(0, -1); else if(c === 'ArrowDown') padBewegen(0, 1);
  else if(c === 'KeyB' && !e.repeat) padDruck();
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);
// Controller: linker Stick / D-Pad (Flanke), B = Knopf 1
function padController(){
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(!gp){ pad.prev = {}; return; }
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, bt = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const j = { l: ax < -0.5 || bt(14), r: ax > 0.5 || bt(15), o: ay < -0.5 || bt(12), u: ay > 0.5 || bt(13), b: bt(1) };
  const p = pad.prev;
  if(j.l && !p.l) padBewegen(-1, 0); if(j.r && !p.r) padBewegen(1, 0);
  if(j.o && !p.o) padBewegen(0, -1); if(j.u && !p.u) padBewegen(0, 1);
  if(j.b && !p.b) padDruck();
  pad.prev = j;
}

// ---- Fahrt ------------------------------------------------------------------------------------
const sb = story.schlucht = { aktiv: false, laeuft: false, fertig: false, t: 0, kontakte: 0, cool: 0, hudEl: null, rede: null };
function ubootEinsteigen5(){
  if(!lageRechnen()) return;
  baueSchlucht();
  story.phase = 'schlucht';
  // Live-Test: das U-Boot war unsichtbar – etappe5Start blendet den Flieger aus (die geparkte Mustang ist Kulisse)
  planeGroup.visible = true;
  Object.assign(sb, { aktiv: true, laeuft: false, fertig: false, t: 0, kontakte: 0, cool: 0 }); sonarT = -1;
  state.vel.set(0, 0, 0); state.throttle = 0;
  story.hinweis('');
  // Wie in Etappe 1: jemand hilft per Funk – aber den Code sagt diesmal niemand
  sb.rede = story.sprich(['Hallo! Bitte den Universal-Code für U-Boote eingeben.', 'Du hast nur einen Versuch.', 'Mit Raute bestätigst du, mit Stern löschst du die letzte Ziffer.'], () => {
    pad.offen = true; pad.wahl = 0; pad.eingabe = ''; pad.prev = { b: true }; padZeigen();
  }, 'pilot');
}
function schluchtStart(){
  sb.laeuft = true; sb.t = 0;
  story.ziel = bau.ziel ? { x: bau.ziel.x, z: bau.ziel.z } : null;
  story.hinweis('Abtauchen (Stick nach vorn / Pfeil hoch) und durch die Schlucht zum gelben Ring!');
  story.spaeter(7, () => { if(sb.aktiv) story.hinweis(''); });
}
// Kollision: Waende (quer), Decke, Bogen (darueber/Unterkante), Rippe (Oberkante). Rumpf: 3 Punkte laengs (Bug, Mitte, Heck).
// state.pos.y ist die WASSERLINIE des Modells (Engine: wl 0,1537 x 95 m), nicht die Rumpfmitte: der Kiel liegt ~12 m darunter,
// die Oberkante mit Turm ~4 m darueber (Bot-Test: mit Hoehe 6 um den Ursprung meldete er Rippen, die es dort nicht gab).
// Hoehen von Rippe, Bogen und Decke gelten in der RUMPFMITTE: das U-Boot steuert die Tiefe ueber die Nase, die beim Halten
// 8-10 Grad pendelt – bei 95 m Laenge streifte sonst der Bug, obwohl das Boot passte.
const RUMPF_L = 47, RUMPF_B = 11, KIEL = 12, OBEN = 4;
function treffer(){
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  const y = state.pos.y;
  for(const d of [RUMPF_L, 0, -RUMPF_L]){
    const x = state.pos.x + f.x * d, z = state.pos.z + f.z * d;
    const [u, v] = lokal(x, z);
    if(u < SCH.u0 - 40 || u > SCH.u1 + 40) continue;               // ausserhalb der Schlucht: frei
    const gy = grundY(u);
    const quer = v - mitteV(u), [li, re] = grenzen(u);
    if(quer - RUMPF_B < li - 4) return { art: 'wand', d, sgn: -1 };
    if(quer + RUMPF_B > re + 4) return { art: 'wand', d, sgn: 1 };
    if(u > SCH.u0 + 40 && y + OBEN > gy + DECKE) return { art: 'decke', d };
    for(const [uh, art, luecke] of HIND){
      const dick = art === 'bogen' ? BOGEN_DICK : RIPPE_DICK;
      if(Math.abs(u - uh) > dick / 2 + 10) continue;
      const [qa, qb] = hindQuer(luecke);
      if(quer + RUMPF_B < qa || quer - RUMPF_B > qb) continue;      // ganz in der Luecke: frei
      if(art === 'bogen' && y + OBEN > gy + BOGEN_UNTEN) return { art: 'bogen', d, uh };
      if(art === 'rippe' && y - KIEL < gy + RIPPE_OBEN) return { art: 'rippe', d, uh };
    }
  }
  return null;
}
// Live-Wunsch: nach einem Anstoss krachte man gleich dreimal – das Boot blieb im Hindernis und fuhr mit Restgas weiter.
// Jetzt: Fahrt UND Schub auf null, das Boot wird aus dem Hindernis herausgeschoben (nicht nur ein paar Meter) und hat
// SCHONZEIT s Ruhe, um seinen Fehler zu korrigieren.
const SCHONZEIT = 3;
function kontakt(t){
  if(sb.cool > 0) return;
  sb.cool = SCHONZEIT;
  if(typeof rumble === 'function') rumble(400, 1, 0.8);
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat);
  if(t.art === 'wand'){ state.pos.x -= lage.vx * t.sgn * 6; state.pos.z -= lage.vz * t.sgn * 6; }
  else if(t.art === 'decke'){ state.pos.y -= 6; }
  else {
    // zurueck, bis der Rumpf (Bug/Heck je 47 m) aus dem Hindernis heraus ist
    const [u] = lokal(state.pos.x, state.pos.z), dick = t.art === 'bogen' ? BOGEN_DICK : RIPPE_DICK;
    const vor = Math.sign(f.x * lage.ux + f.z * lage.uz) || 1;          // faehrt das Boot in u-Richtung?
    const ziel = t.uh - vor * (RUMPF_L + dick / 2 + 10 + 20);            // Bug klar vor dem Hindernis
    const um = ziel - u;
    state.pos.x += lage.ux * um; state.pos.z += lage.uz * um;
  }
  state.vel.set(0, 0, 0); state.throttle = 0;
  planeGroup.position.copy(state.pos);
  sb.kontakte++;
  if(sb.kontakte > KONTAKT_MAX){ ende(false, 'zerschellt'); return; }
  story.sprich([sb.kontakte === 1 ? (t.art === 'wand' ? 'Autsch, die Felswand!' : t.art === 'decke' ? 'Bumm, die Felsdecke! Nicht so hoch!'
      : t.art === 'bogen' ? 'Bumm! Unter dem Felsbogen musst du tiefer!' : 'Krach! Über die Felsrippe musst du höher!')
    : 'Noch ein Treffer! Beim nächsten ist der Rumpf leck.'], null, 'pilot', 3);
}
function schluchtUpdate(dt){
  if(!sb.aktiv) return;
  if(pad.offen){ padController(); state.vel.set(0, 0, 0); state.throttle = 0; return; }
  if(!sb.laeuft || sb.fertig) return;
  sb.t += dt; sb.cool = Math.max(0, sb.cool - dt);
  if(sb.cool <= 0){ const t = treffer(); if(t) kontakt(t); if(sb.fertig) return; }
  // Ziel: hinter dem Schluchtende
  const [u] = lokal(state.pos.x, state.pos.z);
  if(u > SCH.u1 + 20){ ende(true, 'durch'); return; }
  if(sb.t > ZEIT_MAX) ende(false, 'zeit');
  hud();
}
function ende(ok, wie){
  if(sb.fertig) return;
  sb.fertig = true; sb.laeuft = false; story.ziel = null; state.throttle = 0;
  hud();
  const txt = ok ? ['Geschafft! Durch die ganze Schlucht – das war Maßarbeit!']
    : wie === 'zerschellt' ? ['Krach! Der Rumpf ist leck, das U-Boot muss auftauchen.', 'Bis es repariert ist, vergeht eine Woche.']
    : ['Die Zeit ist um – der Sauerstoff wird knapp, das U-Boot muss auftauchen.', 'Die Fahrt dauert jetzt viel länger: eine ganze Woche.'];
  story.sprich(txt, () => story.spaeter(1, () => { sb.aktiv = false; hud(); story.etappeEnde(ok ? 1 : 7, ok ? 'U-Boot-Schlucht' : (wie === 'zerschellt' ? 'U-Boot leck' : 'Schlucht zu langsam')); }), 'pilot');
}
function hud(){
  if(!sb.hudEl){
    sb.hudEl = document.createElement('div'); sb.hudEl.dataset.etappeHud = '1';
    sb.hudEl.style.cssText = 'position:absolute;left:50%;top:56px;transform:translateX(-50%);padding:8px 16px;border-radius:10px;'
      + 'background:rgba(0,0,0,.72);color:#fff;font:600 18px system-ui,sans-serif;pointer-events:none;z-index:20;white-space:nowrap;';
    document.body.appendChild(sb.hudEl);
  }
  if(!sb.aktiv || !sb.laeuft && !sb.fertig){ sb.hudEl.style.display = 'none'; return; }
  sb.hudEl.style.display = '';
  const rest = Math.max(0, ZEIT_MAX - sb.t), [u] = lage.ok ? lokal(state.pos.x, state.pos.z) : [0];
  const weg = Math.max(0, Math.round(SCH.u1 - u));
  const fels = '🪨'.repeat(sb.kontakte) + '·'.repeat(Math.max(0, KONTAKT_MAX + 1 - sb.kontakte));
  const html = '⏱ <span style="color:' + (rest < 20 ? '#ff5a3c' : rest < 45 ? '#ffd23f' : '#fff') + '">' + Math.ceil(rest) + ' s</span>'
    + '  ·  🏁 ' + weg + ' m  ·  ' + fels + '  ·  ↕ ' + Math.round(-state.pos.y) + ' m';
  if(sb.hudEl._h !== html){ sb.hudEl.innerHTML = html; sb.hudEl._h = html; }
}

// ---- Sonar-Karte der Schlucht -----------------------------------------------------------------------------
// Live-Wunsch: Schlucht und Hindernisse per Ping sehen. Das Periskop der Engine zeigt Land in 1.400 m Reichweite – der
// 60-m-Kanal waere dort 3 Pixel breit. In der Schlucht malt diese Karte darueber: SONAR_R m Reichweite, gedreht in
// Fahrtrichtung (oben = vorne, wie das Periskop), Waende als Linien, Bogen gelb, Rippe orange. Nach jedem Ping (B)
// voll sichtbar, dann blendet sie aus (wie in Etappe 1).
const SONAR_R = 300, SONAR_HALT = 3, SONAR_ZEIT = 12;
let sonarT = -1;
function sonarKarte(dt){
  if(!sb.aktiv || !sb.laeuft || !lage.ok || sonarT < 0) return;
  sonarT += dt || 0;
  const sicht = Math.max(0, Math.min(1, 1 - (sonarT - SONAR_HALT) / (SONAR_ZEIT - SONAR_HALT)));
  if(sicht <= 0) return;
  const W = radarCv.width, H = radarCv.height, cx = W / 2, cy = H / 2, R = W / 2 - 6, g = radarCtx;
  const f = new THREE.Vector3(0, 0, -1).applyQuaternion(state.quat), kurs = Math.atan2(f.x, f.z);
  const cosK = Math.cos(kurs), sinK = Math.sin(kurs);
  // Weltpunkt -> Bildpunkt (dieselbe Drehung wie updatePeriscope der Engine)
  const bild = (x, z) => { const rx = x - state.pos.x, rz = z - state.pos.z;
    const dx = sinK * rz - cosK * rx, dz = cosK * rz + sinK * rx;
    return [cx + (dx / SONAR_R) * (R - 2), cy - (dz / SONAR_R) * (R - 2)]; };
  g.save();
  g.globalAlpha = sicht;
  g.beginPath(); g.arc(cx, cy, R - 1, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(10,40,55,0.92)'; g.fillRect(0, 0, W, H);   // Engine-Bild abdecken
  const [u0] = lokal(state.pos.x, state.pos.z);
  // Waende
  g.strokeStyle = '#8fc7d6'; g.lineWidth = 2;
  for(const sgn of [-1, 1]){
    g.beginPath(); let erst = true;
    for(let u = Math.max(SCH.u0, u0 - SONAR_R); u <= Math.min(SCH.u1 + 40, u0 + SONAR_R); u += 6){
      const gz = grenzen(u), [x, z] = punkt(u, mitteV(u) + (sgn < 0 ? gz[0] : gz[1])), [bx, by] = bild(x, z);
      if(erst){ g.moveTo(bx, by); erst = false; } else g.lineTo(bx, by);
    }
    g.stroke();
  }
  // Hindernisse als dicke Querbalken
  for(const [uh, art, luecke] of HIND){
    if(Math.abs(uh - u0) > SONAR_R) continue;
    const [qa0, qb0] = hindQuer(luecke), [li, re] = grenzen(uh), qa = Math.max(qa0, li), qb = Math.min(qb0, re);
    const [x1, z1] = punkt(uh, mitteV(uh) + qa), [x2, z2] = punkt(uh, mitteV(uh) + qb);
    const [a1, b1] = bild(x1, z1), [a2, b2] = bild(x2, z2);
    g.strokeStyle = art === 'bogen' ? '#ffd23f' : '#ff8a3c'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke();
  }
  // Ziel
  if(Math.abs(SCH.u1 - u0) < SONAR_R){
    const [x, z] = punkt(SCH.u1, mitteV(SCH.u1)), [bx, by] = bild(x, z);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(bx, by, 4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  // U-Boot massstaeblich (Live-Wunsch: Spitze = echter Bug, sonst kann man nicht verlaesslich navigieren).
  // state.pos ist die Rumpfmitte; Bug/Heck RUMPF_L davor/dahinter, halbe Breite 11,5 m.
  const s = (R - 2) / SONAR_R, bug = RUMPF_L * s, hb = Math.max(2, 11.5 * s);
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(cx, cy - bug); g.lineTo(cx + hb, cy - bug * 0.55); g.lineTo(cx + hb, cy + bug * 0.85);
  g.lineTo(cx, cy + bug); g.lineTo(cx - hb, cy + bug * 0.85); g.lineTo(cx - hb, cy - bug * 0.55); g.closePath(); g.fill(); g.stroke();
}

// ---- Hooks ------------------------------------------------------------------------------------
function hookE5b(){
  // Einsteigen ins Strand-U-Boot (Engine, ueber den Ring): in Etappe 5 startet die Schlucht
  const subOrig = evaBoardHarborSub;
  // Der Ring liegt am lila Punkt, das echte Boot (und die Schlucht) am Engine-Liegeplatz: kurze Schwarzblende, im
  // Schwarzen einsteigen. So faellt der Ortswechsel nicht auf (Live-Hinweis 08.10.2026).
  evaBoardHarborSub = function(){
    if(!hier() || story.phase || sb.blende){ const r = subOrig.apply(this, arguments); if(hier() && !story.phase && isSub()) ubootEinsteigen5(); return r; }
    const args = arguments, self = this;
    sb.blende = true;
    story.schwarz('', 0.4, () => { sb.blende = false; subOrig.apply(self, args); if(hier() && !story.phase && isSub()) ubootEinsteigen5(); });
  };
  // Waehrend das Pad offen ist: keine Steuerung, kein Sonar (B gehoert dem Pad)
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){
    if(hier() && sb.aktiv && (pad.offen || (!sb.laeuft && !sb.fertig))){ state.vel.set(0, 0, 0); state.throttle = 0; schluchtUpdate(dt); return; }
    const r = physOrig.apply(this, arguments);
    if(hier() && sb.aktiv) schluchtUpdate(dt);
    return r;
  };
  // Sonar: nach einem Ping die Schluchtkarte zeigen (ueber dem Periskop-Bild der Engine bzw. von Etappe 1)
  const pingOrig = sonarPing;
  sonarPing = function(){ const neu = sonarCool <= 0; const r = pingOrig.apply(this, arguments); if(neu && hier() && sb.aktiv) sonarT = 0; return r; };
  const periOrig = updatePeriscope;
  updatePeriscope = function(dt){ const r = periOrig.apply(this, arguments); if(r && hier()) sonarKarte(dt); return r; };
  const bOrig = buttonB;
  buttonB = function(){ if(hier() && pad.offen) return; return bOrig.apply(this, arguments); };
}
function updateE5b(){
  if(!e5()) return;
  if(!bau.fertig && lageRechnen()) baueSchlucht();
}
story.updateE5b = updateE5b;
story.aufgabeE5b = () => sb.aktiv ? ['U-Boot-Schlucht', [
  ['Code', pad.offen ? 'Stick/Pfeile wählen, B drücken, * löscht, # bestätigt – nur ein Versuch' : 'eingegeben'],
  ['Ziel', 'durch die Schlucht zum gelben Ring'],
  ['Tauchen', 'Stick nach vorn / Pfeil hoch = tiefer'],
  ['Hindernisse', 'unter Felsbögen durch, über Felsrippen hinweg'],
  ['Kontakte', sb.kontakte + ' von ' + KONTAKT_MAX + ' erlaubt'],
  ['Zeit', Math.ceil(Math.max(0, ZEIT_MAX - sb.t)) + ' s'],
]] : null;

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){
  if(hookOrig) hookOrig();
  hookE5b();
};
})();
