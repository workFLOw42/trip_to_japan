// Trip to Japan – Etappe 6c: Shinkansen (sicherer Weg, "4 Tage"). Laedt nach etappe6b.js.
// Geschichte: Das Stellwerk ist ausgefallen und einige Weichen sind defekt. Der Lokfuehrer bittet Kenji, die Gleise zu waehlen.
// Ablauf (Live-Wunsch 09.10.2026):
//   - Einstieg im gelben Ring am Bahnsteig in Tokio -> Blende -> eigene Szene (gerade Strecke weit ab der Welt, wie die
//     Hoehle): der Zug beschleunigt langsam von 0 auf 300 km/h und bremst wieder auf 0 (~40 s).
//   - Runden: Symbole erscheinen (HUD: je Gleis eine Gruppe nebeneinander, darin 2 Symbole uebereinander = die naechsten
//     zwei Weichen). Gruen = Weiche ok, rot durchgestrichen = defekt. Genau ein Gleis ist in beiden Reihen gruen.
//     ~85 s Fahrt (Live-Wunsch: doppelt so lang), ~15 Runden.
//     Solange die Symbole zu sehen sind, waehlt man (L-Stick / Pfeile: ein Druck = ein Gleis weiter, der Zug bleibt dort).
//     Dann verschwinden sie ohne Hinweis, es gilt das gewaehlte Gleis. Danach 3 s Ruhe: der Zug faehrt ueber die beiden
//     Weichen (defekte liegen verbogen und rot markiert im Gleis), dann die naechste Runde. Ruhe 2 s (Live-Wunsch).
//   - Zeit zum Waehlen nach Tempo: bis 150 km/h 2 s, bis 250 km/h 1,5 s, darueber 1 s (Live-Feedback: "viel zu leicht").
//   - Signale und defekte Weichen im Gleis erst nach der Wahl sichtbar (vorher konnte man sie von weitem sehen).
//   - Gleise: zwei; drei erst, wenn der Zug beim Bremsen wieder bei 200 km/h ist ("man denkt, man hat es geschafft").
//   - Streng: falsches Gleis -> Notbremsung -> 7 Tage. Alles richtig -> Einfahrt Bahnhof Fukuoka-Beach -> 4 Tage.
// Danach (beides) steht Kenji am Strand neben dem Flugfeld (etappe6.js: story.e6ankunft).
(function(){
'use strict';
const story = window.STORY;
function e6(){ return story.etappe === 6; }
function hier(){ return e6() && locale === 'earth'; }
const E = story.e6;

// ---- Strecke --------------------------------------------------------------------------------------------
// Gerade laengs -z bei x = Z0.x, weit ausserhalb der Welt (Inseln, Fuji, Hoehle bei x = 20 km). s = gefahrene Strecke.
const Z0 = { x: -20000, z: 0, y: 0.3 };
const ABSTAND = 5;                        // m zwischen den Gleisen
const V_MAX = 300 / 3.6;                  // m/s
// Tempo-Verlauf (Zeit in s), Rampen mit weichen Enden (smoothstep): anfahren auf 300, Spitze, zuegig auf V3 (knapp unter
// 200 km/h = ab hier 3 Gleise), dann lange von V3 bis zum Halt. Live-Wunsch: der 3-Gleis-Teil laenger (~11 Runden).
// Gerechnet: C:\tmp\sfg\e6\sim.js
const V3 = 195 / 3.6;
const T_AN = 20, T_SPITZE = 18, T_B1 = 10, T_B2 = 50, T_GESAMT = T_AN + T_SPITZE + T_B1 + T_B2;   // 98 s
function tempo(t){
  const sm = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  if(t < T_AN) return V_MAX * sm(t / T_AN);
  if(t < T_AN + T_SPITZE) return V_MAX;
  if(t < T_AN + T_SPITZE + T_B1) return V_MAX - (V_MAX - V3) * sm((t - T_AN - T_SPITZE) / T_B1);
  // langsam bremsen, erst am Ende stark (Potenz): so bleibt der Zug lange im 3-Gleis-Bereich ueber ~100 km/h
  const u = Math.max(0, Math.min(1, (t - T_AN - T_SPITZE - T_B1) / T_B2));
  return V3 * (1 - Math.pow(u, 2.2));
}
// Weg bis t: numerisch (fein genug, einmal vorab)
const WEG = []; { let s = 0; for(let i = 0; i <= T_GESAMT * 20; i++){ WEG.push(s); s += tempo(i / 20) / 20; } }
function wegBis(t){ const i = Math.max(0, Math.min(WEG.length - 1, t * 20)), a = Math.floor(i), f = i - a; return WEG[a] + ((WEG[Math.min(WEG.length - 1, a + 1)] || WEG[a]) - WEG[a]) * f; }
const S_ENDE = wegBis(T_GESAMT);
function bedenkzeit(v){ const k = v * 3.6; return k <= 150 ? 2 : k <= 250 ? 1.5 : 1; }
const RUHE = 2;                          // Live-Wunsch (vorher 3 s)
const BAHNHOF_FREI = 300;                 // m vor dem Halt ohne Weichen (Bahnsteig 260 m)

// ---- Runden vorab planen ------------------------------------------------------------------------------------
// Erste Runde nach 3 s Anfahrt. Jede Runde: Symbole ab t0 fuer bedenkzeit(v(t0)) s, danach RUHE. Die zwei Weichen liegen
// in der Ruhe: bei 1/3 und 2/3 der Ruhestrecke. Gleiszahl: 3, wenn beim Bremsen 200 km/h unterschritten sind.
// Im Bahnhof keine Weiche mehr (Live-Wunsch): die letzte liegt BAHNHOF_FREI m vor dem Halt.
function plane(seed){
  let s0 = seed; const rnd = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647;
  const runden = []; let t = 3, gleis = 1;               // Start: mittleres (bzw. bei 2 Gleisen: rechtes) Gleis
  while(true){
    const v = tempo(t), bz = bedenkzeit(v), tw = t + bz;
    const t1 = tw + RUHE / 3, t2 = tw + RUHE * 2 / 3;
    if(wegBis(t2) > S_ENDE - BAHNHOF_FREI || tempo(t2) * 3.6 < 35) break;
    const n = (t > T_AN + T_SPITZE && tempo(t) * 3.6 <= 200) ? 3 : 2;
    // Loesung: ein Gleis, gerne ein anderes als das aktuelle (damit man handeln muss); bei 3 Gleisen gern ein Sprung
    // Live-Feedback "zu leicht": das Ziel liegt fast immer woanders, bei 3 Gleisen meist ganz auf der anderen Seite
    // (2 Druecke); die anderen Gleise sind meist Fallen (naechste Weiche gruen, erst die uebernaechste defekt).
    const g0 = n === 3 && runden.length && runden[runden.length - 1].n === 2 ? (gleis === 0 ? 0 : 2) : gleis;   // 2 -> 3: aussen
    let ziel;
    // Live-Wunsch 'oefter wechseln': bei 2 Gleisen ~85 %, bei 3 Gleisen immer ein anderes Gleis, meist ganz hinueber
    do { ziel = Math.floor(rnd() * n); } while((ziel === g0 && (n === 3 || rnd() < 0.85)) || (n === 3 && Math.abs(ziel - g0) < 2 && rnd() < 0.55));
    // Symbole: je Gleis 2 Reihen; das Ziel ist in beiden gruen, jedes andere Gleis hat mindestens eine rote Weiche.
    // Fallen: mal ist die naechste Weiche gruen und erst die uebernaechste rot (genau hinschauen).
    const reihen = [[], []];
    for(let g = 0; g < n; g++){
      if(g === ziel){ reihen[0][g] = true; reihen[1][g] = true; continue; }
      const f = rnd();
      if(f < 0.6){ reihen[0][g] = true; reihen[1][g] = false; }        // Falle: erst ok, dann defekt
      else if(f < 0.85){ reihen[0][g] = false; reihen[1][g] = true; }
      else { reihen[0][g] = false; reihen[1][g] = false; }
    }
    runden.push({ t0: t, bz, tw, t1, t2, s1: wegBis(t1), s2: wegBis(t2), n, ziel, reihen, objs: [] });
    gleis = ziel;
    t = tw + RUHE;
  }
  return runden;
}

// ---- Bau der Szene ----------------------------------------------------------------------------------------
const bau = { g: null, zug: null, defekt: [] };
// x eines Gleises bei n Gleisen. Bei 2 Gleisen liegen sie aussen (wie links/rechts bei 3), damit am Uebergang keiner
// schwenkt (Live-Wunsch): das neue Gleis entsteht in der Mitte.
function gx(gleis, n){ return n === 2 ? Z0.x + (gleis ? 1 : -1) * ABSTAND : Z0.x + (gleis - 1) * ABSTAND; }
function wpos(s){ return Z0.z - s; }
// Abbauen: der Zug ist ein Klon des Bahnhofszugs (geteilte Geometrie) -> vorher abhaengen, nicht freigeben
function abbauen(){ if(!bau.g) return; if(bau.zug) bau.g.remove(bau.zug); story.entsorgen(bau.g); bau.g = null; bau.zug = null; bau.defekt.length = 0; }
function baue(runden){
  abbauen();
  const w = story.welt(6), g = new THREE.Group(); w.add(g); bau.g = g;
  // Live-Wunsch: Gleise in beide Richtungen "in die Unendlichkeit" -> vor dem Start und nach dem Ziel je 3,5 km (Nebel 3 km)
  const VOR = 3500, L = S_ENDE + 3800, mitte = wpos(L / 2 - VOR);
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const schotterM = M(0x6b6258), stahlM = M(0x9aa3ab), schwelleM = M(0x5a4a3c), feldM = M(0x7fa64a), feld2M = M(0x9bbf5a),
        wegM = M(0xb8a888), rotM = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  // Boden: Reisfelder (Streifen), Damm mit Schotter
  const boden = new THREE.Mesh(new THREE.PlaneGeometry(1600, L + 1600), feldM);
  boden.rotation.x = -Math.PI / 2; boden.position.set(Z0.x, Z0.y - 0.6, mitte); g.add(boden);
  for(let i = 0; i < 40; i++){ const b = 30 + (i % 3) * 15, x = Z0.x + (i % 2 ? 1 : -1) * (40 + (i * 37) % 500);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(b, L + 1200), i % 3 ? feld2M : feldM); st.rotation.x = -Math.PI / 2; st.position.set(x, Z0.y - 0.55, mitte); g.add(st); }
  // Damm: bei 2 Gleisen schmaler, ab dem Uebergang breiter (Damm erst unten gebaut, wenn sWechsel bekannt ist)
  // Gleise: 3 Spuren immer da (die aeussere rechte erst spaeter "angeschlossen" -> optisch gleich, nur im HUD)
  // Schienen je Gleis-Position bei 2 und 3 Gleisen. Einfach: die 3 Positionen der 3-Gleis-Lage + die 2 der 2-Gleis-Lage
  // wuerden sich ueberlagern; deshalb Abschnitte: bis zur ersten 3-Gleis-Runde 2 Gleise, danach 3, Uebergang mit Weiche.
  // Uebergang 2 -> 3 Gleise direkt hinter der letzten Weiche der 2-Gleis-Runden (Live-Test: mit 2 s Ruhe lag er vorher
  // noch VOR dieser Weiche -> das rechte Gleis hiess schon 'Gleis 3' und loeste die Notbremse aus)
  const i3 = runden.findIndex(r => r.n === 3), sWechsel = i3 > 0 ? runden[i3 - 1].s2 + 8 : (i3 === 0 ? 0 : L);
  bau.sWechsel = sWechsel + 20;                        // ab hier gilt die 3-Gleis-Lage (update; x der Aussengleise gleich)
  { const B2 = ABSTAND * 2 + 6, B3 = ABSTAND * 2 + 13, RAMPE = 60, s0 = -VOR, s1 = L - VOR;
    const stueck = (b, a, e) => { if(e <= a) return; const d = new THREE.Mesh(new THREE.BoxGeometry(b, 0.9, e - a), schotterM); d.position.set(Z0.x, Z0.y - 0.45, wpos((a + e) / 2)); g.add(d); };
    stueck(B2, s0, Math.min(sWechsel, s1));
    // Rampe: das Bett wird auf RAMPE m gleichmaessig breiter (Trapez, Ober- und Seitenflaechen)
    if(sWechsel < s1){
      const z0 = wpos(sWechsel), z1 = wpos(sWechsel + RAMPE), y0 = Z0.y - 0.9, y1 = Z0.y, h2 = B2 / 2, h3 = B3 / 2, x = Z0.x;
      const P = [x - h2, y1, z0, x + h2, y1, z0, x + h3, y1, z1, x - h3, y1, z1,  x - h2, y0, z0, x + h2, y0, z0, x + h3, y0, z1, x - h3, y0, z1];
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setIndex([0, 2, 1, 0, 3, 2,  0, 4, 7, 0, 7, 3,  1, 2, 6, 1, 6, 5]); geo.computeVertexNormals();
      const r = new THREE.Mesh(geo, schotterM); r.material.side = THREE.DoubleSide; g.add(r);
    }
    stueck(B3, sWechsel + RAMPE, s1); }
  const schiene = (x, s0, s1) => { const len = s1 - s0; if(len <= 0) return;
    for(const d of [-0.72, 0.72]){ const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, len), stahlM); m.position.set(x + d, Z0.y + 0.1, wpos(s0 + len / 2)); g.add(m); } };
  schiene(gx(0, 3), -VOR, L - VOR);                   // links und rechts laufen gerade durch
  schiene(gx(2, 3), -VOR, L - VOR);
  const ABZW = 70;                                     // Laenge der Abzweigung des Mittelgleises
  schiene(gx(1, 3), sWechsel + ABZW, L - 300);
  // Abzweigung: vom linken Gleis schraeg in die Mitte (beide Schienen), dazu eine Weichenzunge am Abzweig
  { const a = gx(0, 3), b = gx(1, 3), len = Math.hypot(b - a, ABZW), rot = Math.atan2(b - a, ABZW);
    for(const d of [-0.72, 0.72]){ const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, len), stahlM);
      m.position.set((a + b) / 2 + d, Z0.y + 0.1, wpos(sWechsel + ABZW / 2)); m.rotation.y = -rot; g.add(m); } }
  // Schwellen als InstancedMesh (alle 2,5 m je Gleis)
  { const geo = new THREE.BoxGeometry(2.6, 0.12, 0.3), n = Math.ceil(L / 2.5) * 3, inst = new THREE.InstancedMesh(geo, schwelleM, n), m4 = new THREE.Matrix4();
    let k = 0; for(let s = -VOR; s < L - VOR; s += 2.5){ for(const q of (s < sWechsel + ABZW ? [0, 2] : [0, 1, 2])){ if(k >= n) break; m4.makeTranslation(gx(q, 3), Z0.y, wpos(s)); inst.setMatrixAt(k++, m4); } }
    inst.count = k; inst.frustumCulled = false; g.add(inst); }
  // Weichen je Runde: an s1/s2 je Gleis eine Weichenzunge; defekte: verbogene rote Zunge + Warnbake
  for(const r of runden) for(const [ri, s] of [[0, r.s1], [1, r.s2]]) for(let q = 0; q < r.n; q++){
    const x = gx(q, r.n), ok = r.reihen[ri][q];
    // Weichenzunge (heil: Stahl, defekt: verbogen und rot) und Signal am Mast. Live-Feedback: man sah die Signale von weit
    // her und konnte vorher reagieren -> Zunge und Lampe erst nach der Wahl sichtbar (update), Mast immer (grau, neutral)
    const zunge = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 9), ok ? stahlM : rotM);
    zunge.position.set(x + 0.35, Z0.y + 0.18, wpos(s)); zunge.rotation.y = ok ? 0.04 : 0.22; if(!ok) zunge.rotation.z = 0.3; g.add(zunge);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.5, 0.2), M(0x444444)); mast.position.set(x + 1.9, Z0.y + 2.25, wpos(s - 20)); g.add(mast);
    const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshBasicMaterial({ color: ok ? 0x30ff60 : 0xff2020 }));
    lampe.position.set(x + 1.9, Z0.y + 4.6, wpos(s - 20)); g.add(lampe);
    zunge.visible = lampe.visible = false; r.objs.push(zunge, lampe);
  }
  // Landschaft: Haeuser, Baeume, Strommasten (Oberleitung), in Gruppen; dazu der Fuji weit voraus
  let sd = 33; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const box = new THREE.BoxGeometry(1, 1, 1), kegel = new THREE.ConeGeometry(0.75, 1, 4), baumG = new THREE.ConeGeometry(1, 1, 7), stammG = new THREE.CylinderGeometry(0.15, 0.2, 1, 6);
  const wand = [0xe8ddc8, 0xd8c0a0, 0xcfe0ec, 0xf0d0c0].map(M), dach = [0x3d4f66, 0x6a6a72, 0xb04030].map(M), gruen = [0x2f6a2a, 0x3d7d33, 0x4f8c3a].map(M), stamm = M(0x6b4a2a);
  for(let s = -VOR + 100; s < L - VOR - 100; s += 40 + rnd() * 50){
    const seite = rnd() < 0.5 ? -1 : 1, x = Z0.x + seite * (22 + rnd() * 220);
    if(rnd() < 0.45){ const b = 7 + rnd() * 6, h = 4 + rnd() * 6, t = 7 + rnd() * 6;
      const k = new THREE.Mesh(box, wand[Math.floor(rnd() * 4)]); k.scale.set(b, h, t); k.position.set(x, Z0.y + h / 2, wpos(s)); g.add(k);
      const d = new THREE.Mesh(kegel, dach[Math.floor(rnd() * 3)]); d.scale.set(Math.max(b, t), 3, Math.max(b, t)); d.rotation.y = Math.PI / 4; d.position.set(x, Z0.y + h + 1.5, wpos(s)); g.add(d); }
    else for(let i = 0; i < 4; i++){ const h = 6 + rnd() * 8, bx = x + (rnd() - 0.5) * 20, bz = wpos(s + (rnd() - 0.5) * 20);
      const kr = new THREE.Mesh(baumG, gruen[Math.floor(rnd() * 3)]); kr.scale.set(h * 0.35, h * 0.8, h * 0.35); kr.position.set(bx, Z0.y + h * 0.6, bz); g.add(kr);
      const st = new THREE.Mesh(stammG, stamm); st.scale.set(1, h * 0.3, 1); st.position.set(bx, Z0.y + h * 0.15, bz); g.add(st); }
  }
  // Oberleitungsmasten alle 25 m beiderseits + Querjoch (gibt das Tempo-Gefuehl; Live-Feedback: fuehlte sich zu langsam an)
  { const mastG = new THREE.BoxGeometry(0.35, 7.5, 0.35), jochG = new THREE.BoxGeometry(ABSTAND * 2 + 17, 0.3, 0.3), mm = M(0x8a8f96);
    const nM = Math.ceil(L / 25) * 3, inst = new THREE.InstancedMesh(mastG, mm, nM), ij = new THREE.InstancedMesh(jochG, mm, Math.ceil(L / 25) + 1), m4 = new THREE.Matrix4();
    let k = 0, j = 0; for(let s = -VOR; s < L - VOR; s += 25){ for(const sx of [-1, 1]){ m4.makeTranslation(Z0.x + sx * (ABSTAND + 8.5), Z0.y + 3.75, wpos(s)); inst.setMatrixAt(k++, m4); }
      m4.makeTranslation(Z0.x, Z0.y + 7.4, wpos(s)); ij.setMatrixAt(j++, m4); }
    inst.count = k; ij.count = j; inst.frustumCulled = ij.frustumCulled = false; g.add(inst, ij); }
  // Zaunpfosten dicht neben dem Damm (alle 6 m): ziehen nah an der Kamera vorbei -> Tempo-Gefuehl
  { const pg = new THREE.BoxGeometry(0.25, 1.4, 0.25), pm = M(0xd8d2c4), nP = Math.ceil(L / 6) * 2, ip = new THREE.InstancedMesh(pg, pm, nP), m4 = new THREE.Matrix4();
    let k = 0; for(let s = -VOR; s < L - VOR && k < nP - 1; s += 6) for(const sx of [-1, 1]){ m4.makeTranslation(Z0.x + sx * (ABSTAND + 11), Z0.y + 0.3, wpos(s)); ip.setMatrixAt(k++, m4); }
    ip.count = k; ip.frustumCulled = false; g.add(ip); }
  // Zielbahnhof: Bahnsteig + Dach + Schild am Ende (Halt bei S_ENDE)
  { const steig = new THREE.Mesh(new THREE.BoxGeometry(6, 1.1, 260), M(0x8c8a85)); steig.position.set(gx(2, 3) + 6, Z0.y + 0.55, wpos(S_ENDE - 60)); g.add(steig);
    const dachS = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 200), M(0xeeeeee)); dachS.position.set(gx(2, 3) + 6, Z0.y + 7, wpos(S_ENDE - 60)); g.add(dachS);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const cx = cv.getContext('2d');
    cx.fillStyle = '#123a6a'; cx.fillRect(0, 0, 512, 128); cx.fillStyle = '#fff'; cx.font = 'bold 54px system-ui,sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText('Fukuoka-Beach', 256, 66);
    const sch = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
    sch.position.set(gx(2, 3) + 4, Z0.y + 5, wpos(S_ENDE + 10)); g.add(sch); }
  // Fuji in der Ferne (voraus, leicht rechts): einfacher Kegel ohne Nebel
  if(window.FUJI_DATEN){ const d = window.FUJI_DATEN, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3)); const col = d.col.map(c => Math.pow(c, 2.2) * 0.82 + 0.16);   // wie etappe6.js: linear + Dunst
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(d.idx); geo.computeVertexNormals();
    const f = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, fog: false })); f.scale.set(3400, 2000, 3400); f.position.set(Z0.x + 2500, -60, wpos(S_ENDE + 5000)); f.frustumCulled = false; g.add(f); }
  // Zug: Kopie des Bahnhofszugs (etappe6.js laedt das Modell); faehrt mit der Szene
  bau.zug = null;
  const vor = story.e6zugVorlage && story.e6zugVorlage();
  if(vor){ const z = vor.clone(true); z.rotation.y = Math.PI / 2; g.add(z); bau.zug = z; }
}

// ---- Ablauf -----------------------------------------------------------------------------------------------
const zf = story.zugfahrt = { aktiv: false, t: 0, gleis: 1, n: 2, x: 0, runden: [], ri: 0, zeigt: false, fertig: false, halt: false, hudEl: null, _st: 0, rede: null, start: false };
const ANSAGE = [
  'Hallo Kenji! Das Stellwerk ist ausgefallen und einige Weichen sind defekt!',
  'Wähl mit dem linken Stick das Gleis, auf dem beide Weichen grün leuchten. Los geht\'s!',
];
function einsteigen(){
  story.phase = 'zug'; story.ziel = null; story.hinweis('');
  story.schwarz('', 0.6, () => {
    zf.runden = plane(1 + Math.floor(Math.random() * 1e6));
    baue(zf.runden);
    if(eva) clearEva();
    planeGroup.visible = false;
    Object.assign(zf, { aktiv: true, t: 0, gleis: 1, n: 2, x: gx(1, 2), _sig: '', ri: 0, zeigt: false, fertig: false, halt: false, start: false, _st: 0, vHalt: 0 });
    zugSetzen(0);
    kamera(true);
    hudEngine(false);
    hud();
    zf.rede = story.sprich(ANSAGE, () => { zf.start = true; }, 'pilot');
  });
}
story.e6zugEinsteigen = einsteigen;
story.e6zugAbbauen = abbauen;
function sLage(){ return zf.halt ? zf.sHalt : wegBis(zf.t); }
function zugSetzen(dt){
  const s = sLage();
  // seitlich weich zum Gleis gleiten (ueber die Weiche)
  const soll = gx(zf.gleis, zf.n); zf.x += (soll - zf.x) * Math.min(1, dt * 2.2);
  // s = Zugspitze; das Modell hat den Ursprung in der Mitte des Mittelwagens (3 Wagen a 25 m -> Nase 37,5 m davor)
  if(bau.zug) bau.zug.position.set(zf.x, Z0.y + 0.2 + 0.25 * (25 / 8.9), wpos(s) + 37.5);
  // Engine-Fokus (Meer, Wolken, Radar) = Zug: der Flieger steht unsichtbar mit
  state.pos.set(zf.x, Z0.y, wpos(s)); state.vel.set(0, 0, 0); state.throttle = 0; state.onGround = true;
}
function eingabe(){
  // Stufen: ein Druck (Flanke) = ein Gleis. L-Stick, Pfeile, A/D
  let ax = 0;
  if(keys['ArrowLeft'] || keys['KeyA']) ax = -1; else if(keys['ArrowRight'] || keys['KeyD']) ax = 1;
  const gp = gamepadIndex !== null ? navigator.getGamepads()[gamepadIndex] : null;
  if(gp){ const v = gp.axes[0] || 0; if(Math.abs(v) > 0.6) ax = Math.sign(v); else if(gp.buttons[14] && gp.buttons[14].pressed) ax = -1; else if(gp.buttons[15] && gp.buttons[15].pressed) ax = 1; }
  if(ax && ax !== zf._st){ zf.gleis = Math.max(0, Math.min(zf.n - 1, zf.gleis + ax)); }
  zf._st = ax;
}
function update(dt){
  if(!zf.aktiv) return;
  if(zf.halt){
    // Notbremsung: rasch auf 0
    zf.vHalt = Math.max(0, zf.vHalt - 9 * dt); zf.sHalt += zf.vHalt * dt;
    zugSetzen(dt); hud(); return;
  }
  if(!zf.start){ zugSetzen(dt); hud(); return; }
  zf.t += dt;
  const r = zf.runden[zf.ri];
  // Waehlen nur, solange Symbole zu sehen sind
  zf.zeigt = !!(r && zf.t >= r.t0 && zf.t < r.tw);
  if(r && !r.sicht && zf.t >= r.tw){ r.sicht = true; for(const o of r.objs) o.visible = true; }   // erst jetzt im Gleis zu sehen
  if(zf.zeigt){
    eingabe();
  } else zf._st = 0;
  // 2 -> 3 Gleise am Uebergang: der Zug faehrt gerade weiter (links bleibt links, rechts bleibt rechts), nur der Index
  if(zf.n === 2 && wegBis(zf.t) >= bau.sWechsel){ zf.gleis = zf.gleis === 0 ? 0 : 2; zf.n = 3; }
  // Weichen ueberfahren
  if(r){
    const s = wegBis(zf.t);
    if(!r.p1 && s >= r.s1){ r.p1 = true; if(!r.reihen[0][zf.gleis]){ notbremse(); return; } }
    if(!r.p2 && s >= r.s2){ r.p2 = true; if(!r.reihen[1][zf.gleis]){ notbremse(); return; } zf.ri++; }
  }
  zugSetzen(dt);
  hud();
  if(zf.t >= T_GESAMT) geschafft();
}
function notbremse(){
  zf.halt = true; zf.zeigt = false; zf.sHalt = wegBis(zf.t); zf.vHalt = tempo(zf.t);
  if(typeof playCrash === 'function') playCrash();
  // keine Ansage (Live-Wunsch): man sieht den Zug bremsen, die Blende danach nennt die 7 Tage
  const warte = () => { if(zf.vHalt > 0.5) story.spaeter(0.3, warte); else story.spaeter(1, () => ende(false)); };
  warte();
}
function geschafft(){
  if(zf.fertig) return; zf.fertig = true; zf.zeigt = false;
  // Live-Wunsch: steht der Zug, gleich der Globus (die Ansage laeuft hinein)
  story.sprich(['Perfekt, Kenji! Auf die Sekunde pünktlich.', 'Willkommen in Fukuoka-Beach!'], null, 'pilot');
  story.spaeter(1.2, () => ende(true));
}
function ende(ok){
  if(!zf.aktiv) return;
  zf.aktiv = false; zf.fertig = true; hudAus();
  story.ende = true;
  story.e6ankunft(ok ? 4 : 7, ok ? 'mit dem Shinkansen' : 'Notbremsung, defekte Weiche', false);
  camera.fov = 60; camera.updateProjectionMatrix();   // abgebaut wird nach dem Globus (story.e6zugAbbauen)
  hudEngine(true);
}

// ---- Kamera: ueber dem Zug, man sieht nur das vordere Drittel (Live-Wunsch), Blick die Gleise hinab ------------------
const _cam = new THREE.Vector3();
function kamera(sofort){
  const s = sLage();
  // 32 m hinter der Nase (ueber dem Ende des Triebwagens), 11 m hoch; folgt dem Gleiswechsel direkt (nicht nur zu 60 %)
  _cam.set(zf.x, Z0.y + 11, wpos(s) + 32);
  if(sofort) camera.position.copy(_cam); else camera.position.lerp(_cam, 0.35);
  // Live-Feedback: 150 und 300 km/h fuehlten sich gleich an -> Blickwinkel waechst mit dem Tempo (60 -> 78 Grad) und die
  // Kamera zittert leicht (bis 6 cm), beides mit dem Tempo
  const v = zf.halt ? zf.vHalt : (zf.start ? tempo(zf.t) : 0), f = v / V_MAX, tt = performance.now() / 1000;
  const fov = 60 + 18 * f; if(Math.abs(camera.fov - fov) > 0.05){ camera.fov = fov; camera.updateProjectionMatrix(); }
  camera.position.y += Math.sin(tt * 37) * 0.06 * f; camera.position.x += Math.sin(tt * 23 + 1) * 0.04 * f;
  camera.up.set(0, 1, 0);
  camera.lookAt(zf.x, Z0.y + 1, wpos(s) - 70);
}

// ---- HUD ----------------------------------------------------------------------------------------------------
// Gruppen nebeneinander (links, Mitte, rechts), je 2 Symbole uebereinander (oben = uebernaechste Weiche). Das eigene Gleis
// ist unten markiert (auch in der Ruhe zu sehen), die Symbole nur waehrend der Wahl.
function symbol(ok){
  return ok ? '<svg viewBox="0 0 40 40" width="56" height="56"><rect x="1" y="1" width="38" height="38" rx="7" fill="#123d1e" stroke="#3dff7a" stroke-width="2"/>'
    + '<path d="M14 6 V34 M26 6 V34" stroke="#3dff7a" stroke-width="3"/><path d="M11 11 H29 M11 18 H29 M11 25 H29 M11 32 H29" stroke="#3dff7a" stroke-width="2"/></svg>'
    : '<svg viewBox="0 0 40 40" width="56" height="56"><rect x="1" y="1" width="38" height="38" rx="7" fill="#3d1212" stroke="#ff4a3a" stroke-width="2"/>'
    + '<path d="M14 6 V34 M26 6 V34" stroke="#ff4a3a" stroke-width="3"/><path d="M11 11 H29 M11 18 H29 M11 25 H29 M11 32 H29" stroke="#ff4a3a" stroke-width="2"/>'
    + '<path d="M6 34 L34 6" stroke="#fff" stroke-width="4"/><path d="M6 34 L34 6" stroke="#ff2a1a" stroke-width="2.5"/></svg>';
}
function hud(){
  if(!zf.hudEl){
    zf.hudEl = document.createElement('div'); zf.hudEl.setAttribute('data-etappe-hud', '1');
    zf.hudEl.style.cssText = 'position:absolute;left:50%;top:70px;transform:translateX(-50%);display:flex;gap:26px;pointer-events:none;z-index:12;font-family:system-ui,sans-serif;';
    document.body.appendChild(zf.hudEl);
    zf.tachoEl = document.createElement('div'); zf.tachoEl.setAttribute('data-etappe-hud', '1');
    // Live-Wunsch: Tempo oben links wie das Flieger-HUD (das ist im Zug aus), nicht unten rechts
    zf.tachoEl.style.cssText = 'position:absolute;top:10px;left:12px;color:#fff;font-size:18px;line-height:1.5;text-shadow:1px 1px 2px rgba(0,0,0,.7);pointer-events:none;user-select:none;z-index:12;';
    document.body.appendChild(zf.tachoEl);
  }
  zf.hudEl.style.display = zf.aktiv ? 'flex' : 'none'; zf.tachoEl.style.display = zf.aktiv ? 'block' : 'none';
  const r = zf.runden[zf.ri], n = zf.zeigt && r ? r.n : zf.n;
  const sig = (zf.zeigt ? 'z' + zf.ri : 'r') + '|' + n + '|' + zf.gleis;
  if(sig !== zf._sig){
    zf._sig = sig;
    let h = '';
    for(let q = 0; zf.zeigt && r && q < n; q++){                           // Ruhe: HUD leer (Live-Wunsch: keine Platzhalter)
      const ich = q === zf.gleis;
      h += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">'
        + (zf.zeigt && r ? symbol(r.reihen[1][q]) + symbol(r.reihen[0][q]) : '<div style="width:56px;height:118px"></div>')
        + '<div style="width:46px;height:8px;border-radius:4px;background:' + (ich ? '#ffd23f' : 'rgba(255,255,255,.25)') + '"></div></div>';
    }
    zf.hudEl.innerHTML = h;
  }
  const v = zf.halt ? zf.vHalt : (zf.start ? tempo(zf.t) : 0);
  zf.tachoEl.innerHTML = 'Shinkansen<br>Speed: ' + Math.round(v * 3.6) + ' km/h';
}
// Flieger-HUD (Modell, Hoehe, Schub) und Schubbalken passen nicht zum Zug -> waehrend der Fahrt aus
// (der Schubbalken folgt planeGroup.visible -> aus, solange der Flieger unsichtbar ist)
function hudEngine(an){ for(const id of ['hud', 'gyro']){ const el = document.getElementById(id); if(el) el.style.visibility = an ? '' : 'hidden'; } }
function hudAus(){ if(zf.hudEl){ zf.hudEl.style.display = 'none'; zf.tachoEl.style.display = 'none'; } }

// ---- Hooks ----------------------------------------------------------------------------------------------------
function hookE6c(){
  const physOrig = stepPhysics;
  stepPhysics = function(dt, inp){ if(hier() && zf.aktiv){ update(dt); return; } return physOrig.apply(this, arguments); };
  const camOrig = updateCamera;
  updateCamera = function(){ if(hier() && zf.aktiv){ kamera(false); return; } return camOrig.apply(this, arguments); };
  const resetOrig = resetPlane;
  resetPlane = function(){ if(hier() && zf.aktiv) return; return resetOrig.apply(this, arguments); };
  const hitsOrig = hitsBuilding;
  hitsBuilding = function(){ if(hier() && zf.aktiv) return false; return hitsOrig.apply(this, arguments); };
  // Land unter der Strecke: im Meeresgitter eine grosse Insel (Wasser verschwindet), Boden flach
  const LAND = { x: Z0.x, z: Z0.z - S_ENDE / 2, r: 7000 };
  const onLandOrig = isOnLand, seaIslOrig = collectSeaIslands;
  isOnLand = function(x, z){ return (hier() && zf.aktiv && Math.hypot(x - LAND.x, z - LAND.z) < LAND.r) || onLandOrig.apply(this, arguments); };
  collectSeaIslands = function(){ const r = seaIslOrig.apply(this, arguments);
    if(hier() && zf.aktiv){ const ra = LAND.r + SHORE_FADE_W; _seaIslands.push(LAND.x, LAND.z, LAND.r, ra * ra, LAND.r * LAND.r); } return r; };
  // Y im Zug: nichts (kein Aussteigen)
  const yOrig = buttonY;
  buttonY = function(){ if(hier() && zf.aktiv) return; return yOrig.apply(this, arguments); };
  // Schatten des (unsichtbaren) Fliegers nicht aufs Gleis
  const schattenOrig = updateShadow;
  updateShadow = function(){ if(hier() && zf.aktiv){ if(planeShadow) planeShadow.visible = false; if(ovalShadow) ovalShadow.visible = false; return; } return schattenOrig.apply(this, arguments); };
  const gyroOrig = updateGyro;
  updateGyro = function(){ if(hier() && zf.aktiv){ const g = document.getElementById('gyro'); if(g) g.style.display = 'none'; return; } return gyroOrig.apply(this, arguments); };
}
story.aufgabeE6c = () => zf.aktiv ? ['Shinkansen – Weichen wählen', [
  ['Symbole', 'je Gleis die nächsten zwei Weichen: grün ok, rot defekt'],
  ['Wählen', 'das Gleis, das bei beiden grün ist (L-Stick / ← →, ein Druck = ein Gleis)'],
  ['Achtung', 'die Zeichen sind nur kurz zu sehen – bis zum Schluss'],
]] : null;
story.updateE6c = function(){ if(!e6() && zf.aktiv){ zf.aktiv = false; hudAus(); } };
story.e6zugTest = { plane, tempo, wegBis, S_ENDE, T_GESAMT };

const hookOrig = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookOrig) hookOrig(); hookE6c(); };
})();
