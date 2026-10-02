// AUTOMATISCH ERZEUGT aus ../Flugspiel/Flugspiel.html (tools/build_engine.ps1) – nicht von Hand aendern
// ============================================================
//  Flugspiel v2 – FMS-Modelle, Start & Landung, Land+Meer.
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b8e8);
scene.fog = new THREE.Fog(0x87b8e8, 900, 3000);

// far muss bis zu den Himmelskoerpern reichen (Mond ~26 km, Sternenkuppel 40 km). Bei diesem
// Tiefenbereich braucht es einen logarithmischen Tiefenpuffer, sonst flimmern nahe Flaechen.
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.5, 1600000);
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x557755, 1.0);
scene.add(hemiLight);
// Zusaetzliches RICHTUNGSLOSES Licht, das nur unter Wasser aufgedreht wird (siehe updateUnderwater).
// Es loest ein Problem, das man auf einem Screenshot sofort sieht: das U-Boot war eine schwarze
// Silhouette. hemiLight wirft von oben die Himmel- und von unten die Bodenfarbe, eine SENKRECHTE
// Flanke bekommt davon aber fast nichts — und der Rumpf eines U-Boots ist rund, man sieht ihn also
// hauptsaechlich von der Seite. Ambient leuchtet jede Flaeche gleich, unabhaengig von ihrer
// Richtung, und genau so verhaelt sich Licht unter Wasser: es kommt gestreut aus allen Richtungen.
// An der Luft bleibt es aus (Intensitaet 0), damit sich oben nichts aendert.
const uwAmbient = new THREE.AmbientLight(0xbfe8f0, 0);
scene.add(uwAmbient);
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(200, 400, 100); scene.add(sun);

// ---------- Meer (große Ebene mit sanft animierten Wellen, folgt dem Flieger) ----------
const SEA_SIZE = 6000;
// Segmente pro Seite -> Wellen-Auflösung. Zwei Anforderungen ziehen hier gegeneinander:
//  · FEIN genug, damit die gezeichnete Fläche der Wellenformel folgt. Bei 80 lag nur alle 75 m ein
//    Stützpunkt und die Fläche wich dazwischen bis zu 0,73 m ab (gemessen) — für ein Flugzeug
//    belanglos, neben dem 16 m langen Feuerwehrboot aber sichtbar.
//  · GROB genug, um das Frame-Budget zu halten. updateSea läuft jeden Frame über alle Vertices;
//    gemessen kostet es bei 160 Segmenten 23 ms (waveY 13,6 + computeVertexNormals 8,8), und für
//    60 FPS stehen 16,7 ms für das GANZE Bild zur Verfügung. Das Spiel soll auf einem Tablet laufen.
// 96 trifft die Mitte: 62 m Stützpunktabstand (Fehler etwa halbiert) bei rund 9.400 Vertices.
// Die Zahl muss GERADE bleiben — dann fällt die Gittermitte, auf der das Boot sitzt, genau auf einen
// Stützpunkt, wo überhaupt nicht interpoliert wird. Dass das Boot auf der sichtbaren Wasserhöhe
// liegt, leistet ohnehin seaSurfaceY und nicht die Auflösung; sie macht nur die Wellen ringsum
// glatter.
const SEA_SEG = 96;
// Abstand zweier Stuetzpunkte (62,5 m). Zwischen ihnen ist das Wasser flach — siehe seaMeshY.
const SEA_STEP = SEA_SIZE / SEA_SEG;
const seaGeo = new THREE.PlaneGeometry(SEA_SIZE, SEA_SIZE, SEA_SEG, SEA_SEG);
seaGeo.rotateX(-Math.PI/2);
// side: DoubleSide, seit es eine Unterwasserwelt gibt. Vorher war die Meeresflaeche einseitig —
// wer im U-Boot abtauchte, sah nach oben ins Leere, weil die Rueckseiten weggeworfen wurden.
const ground = new THREE.Mesh(seaGeo, new THREE.MeshLambertMaterial({ vertexColors:true,
  side: THREE.DoubleSide }));
ground.position.y = 0;
scene.add(ground);
// Ausgangs-Höhen merken (für die Wellen-Animation) + Vertexfarben-Puffer
const seaPos = seaGeo.attributes.position;
const seaBaseX = new Float32Array(seaPos.count), seaBaseZ = new Float32Array(seaPos.count);
for(let i=0;i<seaPos.count;i++){ seaBaseX[i]=seaPos.getX(i); seaBaseZ[i]=seaPos.getZ(i); }
seaGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seaPos.count*3), 3));
const seaCol = seaGeo.attributes.color;
const seaDeep = new THREE.Color(0x1a5a94);   // Wellental (dunkelblau)
const seaMid  = new THREE.Color(0x2f8fd0);   // mittlere Höhe (helleres Blau)
const seaFoam = new THREE.Color(0xdff2ff);   // Wellenkamm/Gischt (fast weiß)
// Wellenhöhe. Von 1,6 auf 3,0 erhöht: der Hub wächst damit von 2,19 m auf 4,10 m (gemessen), das
// Meer wirkt deutlich lebendiger und die Boote arbeiten sichtbar darin.
// Mehr geht NICHT über kürzere Wellen: das Meeresgitter hat 62,5 m Punktabstand (SEA_SIZE/SEA_SEG),
// darstellbar sind damit erst Wellen ab etwa 250 m Länge. Eine kürzere Komponente würde durchs
// Raster fallen — sichtbar wäre nur ein Zappeln der Stützpunkte. Und mehr Segmente sind nicht drin:
// updateSea kostet bei 96 schon 8,3 ms von 16,7 (gemessen), bei 128 wären es 14,7.
const AMP = 3.0;
// Wie weit vor der Sandkante die Duenung ausláuft, und wieviel davon uebrig bleibt. Das ist der Fix
// zu "das verschwinden unter dem strand betrifft alle fzg direkt an der kuestenlinie. das wellental
// zieht sie unter die sichtlinie des strandes".
//
// GEMESSEN, nicht geschaetzt (C:/tmp/kueste4.js): der Sandteller ist eine FLACHE Scheibe auf
// y = 0,25 (buildIsland: ISLAND_Y - 0,05), waehrend das Wellental das Fahrzeug auf y = -4,04 zieht
// (Hub +/-2,944 m minus BOAT_DRAFT). Steht die Kamera dann landseitig hinter dem Fahrzeug, schneidet
// dieser Teller die Sichtlinie: in 11,2 % aller Kuestenlagen war das Boot verdeckt, bei allen drei
// Kameramodi (9,2 % im Standardmodus). Das Fahrzeug war also nie weg — es lag hinter dem Sand.
//
// Der Fix setzt an der URSACHE an und nicht an der Kamera: an einem echten Ufer laufen Wellen im
// Flachwasser aus, sie schlagen nicht in voller Hoehe gegen den Strand. Damit ist die Verdeckung in
// allen 22.176 geprueften Lagen und Kameramodi auf 0,0 % (vorher 9,2 %), und weil die Daempfung in
// waveY sitzt, gilt sie fuer ALLE Fahrzeuge zugleich — Boot, U-Boot, Schlauchboot, Canadair — sowie
// fuer das Gitter selbst. Eine Korrektur pro Fahrzeug haette vier Stellen gebraucht und das
// Fahrzeug neben die sichtbare Flaeche gesetzt.
//
// SHORE_FADE_W = 180 m: muss deutlich breiter sein als der Gitter-Punktabstand (SEA_STEP 62,5 m),
// sonst faellt der Auslauf durchs Raster und man sieht nur eine Kante statt eines Auslaufs. 120 m
// reichten fuer die Sichtlinie auch schon, 180 m verteilt den Uebergang auf knapp drei
// Stuetzpunkte. Gedaempft ist damit 26,9 % der Wasserflaeche, die mittlere Wellenhoehe bleibt bei
// 84,8 % — auf offener See aendert sich nichts.
// SHORE_FADE_REST = 0,08: NICHT null, sonst steht das Wasser am Ufer spiegelglatt und wirkt tot.
// Die Obergrenze ist gerechnet: die Wellenspitze an der Kante darf den Sandteller (0,25 m) nicht
// ueberragen, sonst laeuft sichtbar Wasser darueber. 0,08 * 2,944 = 0,236 m liegt knapp darunter,
// 0,10 waere mit 0,294 m schon zu hoch.
const SHORE_FADE_W    = 180;
const SHORE_FADE_REST = 0.08;
// Wie stark die Duenung an DIESER Stelle noch schwingt: 1 auf offener See, SHORE_FADE_REST an der
// Sandkante, dazwischen ein smoothstep (weicher Uebergang ohne sichtbare Kante).
//
// x/z sind GITTER-LOKAL (so speist updateSea die Wellenformel) — hier wird die Weltposition
// zurueckgerechnet, denn nur sie kennt den Abstand zur Insel.
//
// KOSTEN: das laeuft fuer jeden der 9.409 Gitterpunkte, also im heissesten Pfad des Spiels.
// Zwei Dinge halten es bezahlbar (gemessen 1,60 ms fuer alle Punkte gegen 0,84 ms fuer die
// covered-Pruefung allein, also 0,76 ms Zusatz von 16,7 ms Budget):
//   · die vorgesammelte Inselliste (_seaIslands, EINMAL pro Frame) statt islandInfo pro Punkt.
//     Mit islandInfo kostete dasselbe 26 ms und haette das Frame-Budget allein gesprengt.
//   · die Wurzel wird nur im Fade-BAND gezogen. Ausserhalb entscheidet der quadrierte Abstand,
//     und das ist der haeufigste Fall (73 % der Wasserflaeche liegt im vollen Seegang).
function shoreFade(x, z){
  const wx = x + ground.position.x, wz = z + ground.position.z;
  let best = SHORE_FADE_W;
  for(let k=0; k<_seaIslands.length; k+=5){
    const dx = wx-_seaIslands[k], dz = wz-_seaIslands[k+1];
    const q = dx*dx + dz*dz;
    if(q >= _seaIslands[k+3]) continue;        // ausserhalb Sandkante+Fade -> voller Seegang
    const r = Math.sqrt(q) - _seaIslands[k+2]; // Abstand zur SANDkante (negativ = auf dem Sand)
    if(r < best) best = r;
  }
  if(best >= SHORE_FADE_W) return 1;
  const f = best > 0 ? best/SHORE_FADE_W : 0;
  return SHORE_FADE_REST + (1-SHORE_FADE_REST) * f*f*(3-2*f);
}
// Wellenhoehe an einer Weltposition. Genau dieselbe Formel, die updateSea auf die Gitterpunkte legt —
// als Funktion herausgezogen, damit das Feuerwehrboot exakt auf der Duenung liegt und nicht daneben.
// seaTime laeuft weiter, die Wellen wandern also unter dem Boot durch.
// tOff verschiebt die Wellenzeit nach vorne: im Loop laeuft stepPhysics VOR updateSea, das seaTime
// erst danach weiterdreht. Das Boot wuerde also einen Frame hinter der Welle liegen (gemessen 3 cm
// bei 1,6 m Wellenhoehe — unsichtbar, aber unnoetig). Mit tOff = dt rechnet es auf demselben Stand,
// den das Meeresgitter im selben Bild bekommt.
//
// ACHTUNG bei den Koordinaten: updateSea speist diese Funktion mit GITTER-LOKALEN Werten
// (seaBaseX/seaBaseZ), und das Gitter wandert mit dem Spieler (ground.position). shoreFade braucht
// aber die WELTposition, um den Abstand zur Insel zu kennen — deshalb rechnet es sie sich selbst
// zurueck. Wer hier Weltkoordinaten hineingibt (seaYAt tut das nicht, es rechnet vorher um), bekommt
// den Auslauf an der falschen Stelle.
function waveY(x, z, tOff){
  const st = seaTime + (tOff || 0);
  const w = Math.sin(x*0.02 + st*1.2)*AMP*0.55
          + Math.sin(z*0.028 + st*0.9)*AMP*0.35
          + Math.sin((x+z)*0.05 + st*1.8)*AMP*0.15;
  return w * shoreFade(x, z);
}
// Die Hoehe der Flaeche, die man WIRKLICH SIEHT. Und die ist NICHT waveY: das Meeresgitter kennt
// die Welle nur an seinen Stuetzpunkten (62,5 m Abstand, SEA_SIZE/SEA_SEG) und spannt dazwischen
// flache Dreiecke. Im Wellenberg schneidet diese Sehne den Bogen ab, im Tal liegt sie darunter —
// die sichtbare Flaeche steht also bis zu 1,005 m HOEHER als waveY am selben Punkt (gemessen gegen
// das echte three.js-Mesh mit 18.432 Dreiecken, C:/tmp/fix1.js).
// Ein Boot, das seine Hoehe aus waveY nimmt, liegt damit im Wellenberg bis zu einem Meter zu tief:
// bei 44,5 % aller Stichproben stand der Innenboden unter Wasser, der Astronaut also im Meer.
// Deshalb rechnet diese Funktion genau die Dreiecke nach, die das Gitter aufspannt (Abweichung zum
// echten Mesh: 0,000000000 m). PlaneGeometry legt die Diagonale von (x0,z1) nach (x1,z0) — mit
// einem 2x2-Gitter nachgesehen, nicht geraten (C:/tmp/boot1c.js).
// NUR fuer Dinge, die auf dem Wasser LIEGEN. updateSea selbst muss weiter waveY nehmen: es SETZT
// die Stuetzpunkte, dort ist waveY die Wahrheit — und bei 9.409 Punkten waere das auch zu teuer.
function seaMeshY(dx, dz, tOff){
  const i = Math.floor(dx/SEA_STEP), j = Math.floor(dz/SEA_STEP);
  const x0 = i*SEA_STEP, z0 = j*SEA_STEP;
  const u = (dx-x0)/SEA_STEP, v = (dz-z0)/SEA_STEP;
  const h00 = waveY(x0, z0, tOff),          h10 = waveY(x0+SEA_STEP, z0, tOff);
  const h01 = waveY(x0, z0+SEA_STEP, tOff), h11 = waveY(x0+SEA_STEP, z0+SEA_STEP, tOff);
  // Welches der zwei Dreiecke der Zelle? Die Diagonale laeuft von (0,1) nach (1,0).
  if(u + v <= 1) return h00 + (h10-h00)*u + (h01-h00)*v;
  return h11 + (h01-h11)*(1-u) + (h10-h11)*(1-v);
}
// ACHTUNG bei der Rechenbasis: updateSea speist waveY mit den GITTER-LOKALEN Koordinaten
// (seaBaseX/seaBaseZ), und das Gitter wandert mit dem Flieger mit (ground.position = state.pos).
// Die Wasserhöhe, die man SIEHT, hängt also nicht an der Weltposition, sondern am Platz im Gitter.
// Wer mit Weltkoordinaten rechnet, liegt um bis zu 3,18 m daneben (gemessen) — das ist die halbe
// Bordwand des Boots. Deshalb diese Funktion für alles, was auf dem sichtbaren Wasser liegen soll:
// dx/dz sind der Abstand zur Gittermitte, also zum Flieger.
// Rechnet ueber seaMeshY, nicht ueber waveY: gefragt ist die Hoehe der SICHTBAREN Flaeche.
function seaSurfaceY(dx, dz, tOff){ return seaMeshY(dx || 0, dz || 0, tOff); }
// Dasselbe fuer eine WELTposition: rechnet sie erst in Gitter-Koordinaten um. Alles, was auf dem
// Wasser liegt und nicht der Flieger selbst ist (Schlauchboote, treibende Wracks), braucht das —
// sonst rechnet man versehentlich in Weltkoordinaten und liegt bis zu 3,18 m daneben.
function seaYAt(x, z, tOff){ return seaMeshY(x - ground.position.x, z - ground.position.z, tOff); }
let seaTime = 0;
const _c = new THREE.Color();
// Inseln, die das Meeresgitter gerade überdecken — EINMAL pro Frame gesammelt statt für jeden der
// 25.921 Gitterpunkte neu gesucht. Das Gitter ist SEA_SIZE groß, es können also nur Inseln in einem
// entsprechenden Zellenumfeld hineinragen. Wiederverwendetes Array, damit pro Frame kein Müll
// entsteht.
const _seaIslands = [];
function collectSeaIslands(ox, oz){
  _seaIslands.length = 0;
  const half = SEA_SIZE/2;
  const c0x = Math.round((ox-half)/CELL), c1x = Math.round((ox+half)/CELL);
  const c0z = Math.round((oz-half)/CELL), c1z = Math.round((oz+half)/CELL);
  for(let cz=c0z-1; cz<=c1z+1; cz++) for(let cx=c0x-1; cx<=c1x+1; cx++){
    const info = islandInfo(cx, cz);
    if(!info) continue;
    // Vier Werte je Insel, nicht drei: die Maskierung braucht den GRAS-Radius (dort endet die
    // Insel-Oberflaeche, darunter wird das Wasser versteckt), der Ufer-Auslauf dagegen den
    // SAND-Radius (radius*BEACH_FACTOR, so weit ist die Insel gezeichnet) und die Aussengrenze
    // des Fade-Bandes als Quadrat, damit shoreFade die Wurzel meist sparen kann.
    const rSand = info.radius*BEACH_FACTOR, rAussen = rSand + SHORE_FADE_W;
    _seaIslands.push(info.wx, info.wz, rSand, rAussen*rAussen, info.radius*info.radius);
  }
}
// Wie oft die sichtbare Meeresflaeche neu gerechnet wird, je nach Hoehe. Nachgemessen ist der
// Wellenhub am Bildschirm 333 px bei 10 m Hoehe, aber nur 6,7 px bei 500 m und 1,7 px bei 2.000 m —
// die Animation ist dort also unsichtbar, kostete aber weiter 8,3 ms pro Frame.
//
// Die Wellenfunktion (waveY, seaMeshY) bleibt davon UNBERUEHRT: Boote, Kollisionen, Schatten und
// das U-Boot fragen sie direkt ab und bekommen immer den exakten Wert. Gestaffelt wird nur, wie oft
// das GITTER neu gefuellt wird.
// Hoehe -> jeder N-te Frame. Die Grenzen sind gerechnet, nicht geschaetzt (siehe oben): unter
// 2.000 m ist ein uebersprungener Frame als Rutschen der Wellen zu sehen, darueber ist der
// Wellenhub selbst unter 1,5 px und damit unsichtbar.
const SEA_LOD = [[2000, 1], [4000, 3], [Infinity, 6]];
let seaSkip = 0;
function seaUpdateEvery(){
  const y = eva ? eva.group.position.y : state.pos.y;
  for(const [grenze, n] of SEA_LOD) if(y < grenze) return n;
  return 8;
}
function updateSea(dt){
  seaTime += dt;
  // seaTime laeuft IMMER weiter (die Wellen wandern also korrekt), auch wenn das Gitter diesen
  // Frame nicht neu gefuellt wird. Sonst blieben die Wellen bei jedem uebersprungenen Frame stehen
  // und die Boote, die seaMeshY abfragen, saessen ploetzlich neben der sichtbaren Flaeche.
  const jeder = seaUpdateEvery();
  if(jeder > 1){
    if(++seaSkip % jeder !== 0) return;
  } else seaSkip = 0;
  const ox = ground.position.x, oz = ground.position.z;   // Meer folgt dem Flieger
  collectSeaIslands(ox, oz);                              // Inseln im Gitterbereich (1x pro Frame)
  for(let i=0;i<seaPos.count;i++){
    const x=seaBaseX[i], z=seaBaseZ[i];
    // "liegt unter einer Insel?" gegen die vorgesammelte Liste prüfen (quadrierte Abstände, keine
    // Wurzel). Das ersetzt isOnLand pro Vertex — dort steckten 96 % der Meeres-Rechenzeit.
    const wx = x+ox, wz = z+oz;
    let covered = false;
    for(let k=0;k<_seaIslands.length;k+=5){
      const dx = wx-_seaIslands[k], dz = wz-_seaIslands[k+1];
      // Index +4 ist das GRAS-Radiusquadrat (siehe collectSeaIslands) — nicht +2, dort steht seit
      // dem Ufer-Auslauf der Sandradius. Mit +2 waere hier ein Radius mit einem Quadrat verglichen
      // worden und praktisch jede Wasserflaeche als "unter Land" versteckt.
      if(dx*dx + dz*dz < _seaIslands[k+4]){ covered = true; break; }
    }
    if(covered){
      seaPos.setY(i, -1);                     // unter Inseloberfläche -> unter dem Land verborgen
      seaCol.setXYZ(i, seaMid.r, seaMid.g, seaMid.b);
    } else {
      // mehrere überlagerte Wellen -> lebendige, deutlich sichtbare Dünung (Formel siehe waveY)
      const y = waveY(x, z);
      seaPos.setY(i, y);
      // Farbe nach Höhe: Tal dunkel -> Kamm hell/Gischt (starker Kontrast)
      const f = (y/AMP + 1) / 2;              // 0 (Tal) .. 1 (Kamm)
      if(f < 0.75){ _c.copy(seaDeep).lerp(seaMid, f/0.75); }
      else        { _c.copy(seaMid).lerp(seaFoam, (f-0.75)/0.25); }  // oberste 25% -> Gischt
      seaCol.setXYZ(i, _c.r, _c.g, _c.b);
    }
  }
  seaPos.needsUpdate = true;
  seaCol.needsUpdate = true;
  seaGeo.computeVertexNormals();   // damit das Licht auf den Wellen schimmert
}

// ---------- Meeresboden (Unterwasserwelt) ----------------------------------------------------
// Unter der Wasserflaeche war bis hierher NICHTS: seabed/underwater gab es im ganzen Quelltext
// nicht, man sah ins Leere. Das ist der Boden dazu, aufgebaut wie das Meer selbst — eine Ebene,
// die dem Spieler folgt.
//
// EIN Unterschied ist wesentlich, und er ist der Grund, warum das bezahlbar ist: das Meeresgitter
// rechnet JEDEN Frame alle 9.409 Punkte neu (die Wellen wandern ja). Der Boden bewegt sich nicht.
// Er RASTET deshalb auf ein festes Weltgitter ein (SEABED_STEP) und wird nur neu berechnet, wenn
// der Spieler eine Rasterzelle weiterfaehrt — also etwa alle 125 m statt 60-mal pro Sekunde.
// Ohne das kostete seabedY (es sucht pro Punkt die naechste Insel) mehr als das ganze uebrige Bild.
// Tiefe auf offener See (m). Von 200 auf 100 gesenkt — gewuenscht als "vielleicht reichen 100 m
// wassertiefe". Das ist mehr als eine Zahl, es aendert das Spielgefuehl an drei Stellen:
//   · Der Weg nach unten ist halb so lang. Nachgemessen dauert das Abtauchen auf 100 m 19,3 s
//     und das Auftauchen 21,4 s; vorher ging es bis zum Grund gut doppelt so weit.
//   · Es bleibt unten HELLER. Lichtdaempfung und Sichtweite laufen beide ueber -y/SEA_DEPTH
//     (siehe updateUnderwater) — der Grund liegt jetzt bei Anteil 1,0 auf 100 m statt auf 200 m,
//     also ist jede Tiefe darunter heller als vorher.
//   · Der Meeresgrund ist ueberhaupt zu sehen. Bei 16 m Sichtweite auf 200 m Tiefe kam er aus
//     dem Schwarzen; auf 100 m liegt er im Streulicht.
const SEA_DEPTH   = 100;
const SEABED_SIZE = 6000;   // wie das Meeresgitter (SEA_SIZE) — Boden und Wasser enden zusammen
const SEABED_SEG  = 48;     // halb so fein wie das Meer: der Boden hat keine Wellen, nur Relief
const SEABED_STEP = SEABED_SIZE / SEABED_SEG;   // 125 m Rasterschritt (siehe oben)
// Wie weit vor der Insel der Schelf liegt: innerhalb dieser Strecke steigt der Boden vom Tiefenwert
// bis unter den Strand. Von 400 auf 180 m verkuerzt — also kurze flache Zone, dann steiler Abfall.
//
// Der Grund ist das Abtauchen zwischen Inseln. Nachgerechnet: das U-Boot braucht mit 12 m
// Bodenfreiheit rund 20 m Wasser, und die waren bei 400 m Schelf erst 112 m vor der Sandkante da.
// Die engsten 10 % der Nachbarluecken sind aber nur 124 m breit — in deren Mitte ist man 62 m von
// jeder Kante entfernt, und dort lag der Grund bei 7,6 m. Von 975 Nachbarpaaren waren nur 81 %
// durchfahrbar; mit 180 m sind es 91 %, und fahrbar wird es schon ab 51 m.
//
// Was sonst an SHELF_W haengt, ist geprueft: der Suchradius in collectSeabedIslands und der span in
// seabedY wachsen einfach mit. UW_PLANT_BAND0/BANDW sind ANTEILE, und weil das smoothstep-Profil
// selbstaehnlich ist, treffen dieselben Anteile weiter dieselben Tiefen (9 bis 25 m) — sie bleiben
// also gueltig. WRECK_MIN_DEPTH und UW_PLANT_MIN_DEPTH sind absolute Tiefen und unberuehrt.
// Nebeneffekt zum Guten: das Riffband wird schmaler (26 statt 59 m), die Pflanzen stehen damit
// dichter zusammen (24 m Abstand statt 39 m) und wirken mehr wie ein Riff.
const SHELF_W     = 180;
// Bodenhoehe direkt am Strand, knapp unter dem Sand. Als ZAHL und nicht als ISLAND_Y - 1.5:
// dieser Block laeuft zur Ladezeit, und ISLAND_Y wird erst weiter unten deklariert (das
// Insel-System steht nach dem Meer). const wird nicht gehoistet — die Rechnung waere ein
// ReferenceError und das Spiel bliebe schwarz. Wer ISLAND_Y (0,30) aendert, muss hier mit.
const SEABED_SHORE_Y = -1.2;
// Bodenhoehe an einer WELTposition. Deterministisch, ohne Zufall pro Aufruf — dieselbe Stelle gibt
// immer denselben Wert, sonst wuerde der Boden beim Neurastern zappeln.
// islands ist die vorgesammelte Inselliste (siehe collectSeabedIslands); ohne sie fragt die
// Funktion die Zellen selbst ab — bequem fuer Einzelabfragen, zu teuer fuer 2.401 Gitterpunkte.
function seabedY(x, z, islands){
  let rand = 1e9;                     // Abstand zur naechsten Strandkante
  if(islands){
    for(let k=0;k<islands.length;k+=3){
      const d = Math.hypot(x-islands[k], z-islands[k+1]) - islands[k+2];
      if(d < rand) rand = d;
    }
  } else {
    const pcx = Math.round(x/CELL), pcz = Math.round(z/CELL);
    const span = Math.ceil(SHELF_W/CELL) + 1;
    for(let dz=-span; dz<=span; dz++) for(let dx=-span; dx<=span; dx++){
      const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
      const d = Math.hypot(x-info.wx, z-info.wz) - info.radius*BEACH_FACTOR;
      if(d < rand) rand = d;
    }
  }
  if(rand <= 0) return SEABED_SHORE_Y;           // unter Insel und Strand: knapp darunter
  // Vom Strand hinaus in die Tiefe. smoothstep und nicht linear: so entsteht ein flacher Schelf am
  // Ufer und danach eine sichtbare Abbruchkante, statt einer gleichmaessigen Rampe.
  const f = Math.min(1, rand / SHELF_W);
  const sm = f*f*(3 - 2*f);
  // Relief. Zwei ueberlagerte lange Wellen geben Sandbaenke und Huegel; sie greifen mit sm an,
  // damit der Schelf am Strand glatt bleibt und das Relief erst draussen einsetzt.
  // Die Amplituden 15 und 24 waren fuer 200 m Grundtiefe gewaehlt und ergeben +-39 m. Bei 100 m
  // waere das die HAELFTE der Gesamttiefe: der Grund haette zwischen -61 und -139 m geschwankt
  // (nachgerechnet), das Relief haette die Absenkung stellenweise also wieder aufgehoben.
  // Mit SEA_DEPTH/200 mitskaliert bleiben +-19,5 m, der Grund liegt zwischen -80 und -120 m —
  // rund 100 m, und die Sandbaenke behalten ihr Verhaeltnis zur Tiefe.
  const relief = SEA_DEPTH / 200;
  const dune = (Math.sin(x*0.0035)*Math.cos(z*0.0041)*15 + Math.sin((x+z)*0.0017)*24) * relief;
  return SEABED_SHORE_Y + (-SEA_DEPTH - SEABED_SHORE_Y)*sm + dune*sm;
}
const seabedGeo = new THREE.PlaneGeometry(SEABED_SIZE, SEABED_SIZE, SEABED_SEG, SEABED_SEG);
seabedGeo.rotateX(-Math.PI/2);
// ---- SANDTEXTUR fuer den Meeresboden -----------------------------------------------------------
// "der meeresboden ist quasi immer noch so wie auf dem screenshot" — nachgerechnet ist klar, warum
// er nicht als Flaeche zu erkennen war: das Bodengitter hat 48 Segmente auf 6 km, also 125 m
// Punktabstand. Bei 165 m Sichtweite sieht man EIN bis ZWEI Gitterzellen weit, und eine
// gleichmaessig gefaerbte Flaeche aus zwei Dreiecken ist von einem Farbverlauf nicht zu
// unterscheiden. Die Vertexfarben nach Tiefe helfen nicht: sie wechseln erst ueber Hunderte Meter.
//
// Ein feineres Gitter ist zu teuer (seabedY sucht pro Punkt die naechste Insel), also derselbe Weg
// wie bei der Wiese: eine kachelnde Textur, zur Laufzeit gemalt. Sie gibt Struktur auf JEDER Skala
// und kostet einmal 512x512 Pixel fuer den ganzen Meeresboden.
//
// Die Vertexfarben bleiben und wirken WEITER: das Material multipliziert Textur mal Vertexfarbe,
// also faerbt die Tiefe den Sand ein, waehrend die Textur die Koernung liefert. Deshalb ist die
// Textur grau-neutral gemalt — jede Eigenfarbe waere ein zweites Mal eingefaerbt worden.
const SAND_TILE_PX = 512;
const SAND_TILE_M  = 22;      // Meter je Kachel. Kleiner als bei der Wiese (30 m), weil man hier
                              // naeher am Boden ist: das U-Boot faehrt 12 m darueber.
let sandTex = null;
function makeSandTexture(){
  if(sandTex) return sandTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = SAND_TILE_PX;
  const g = cv.getContext('2d');
  let seed = 771771;
  const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed/0x7fffffff; };
  // Neutrales Mittelgrau als Basis: die eigentliche Farbe kommt aus den Vertexfarben (Sand am Ufer,
  // Schlick in der Tiefe). Ein farbiger Grund waere doppelt eingefaerbt.
  g.fillStyle = '#b4b4b4';
  g.fillRect(0, 0, SAND_TILE_PX, SAND_TILE_PX);
  // RIPPEL: der Sandboden im Flachwasser ist gewellt, und diese Streifen sind das Merkmal, an dem
  // man Bewegung ablesen kann. Zwei Richtungen ueberlagert, damit kein Wellblech entsteht.
  for(const [winkel, wellen, staerke] of [[0.4, 9, 0.16], [1.9, 14, 0.10]]){
    g.save();
    g.translate(SAND_TILE_PX/2, SAND_TILE_PX/2);
    g.rotate(winkel);
    for(let i=-40;i<40;i++){
      const y = i*(SAND_TILE_PX/wellen) + (rnd()-0.5)*6;
      const dick = 3 + rnd()*5;
      g.fillStyle = 'rgba(255,255,255,'+staerke.toFixed(2)+')';
      g.fillRect(-SAND_TILE_PX, y, SAND_TILE_PX*2, dick);
      g.fillStyle = 'rgba(60,60,60,'+(staerke*0.8).toFixed(2)+')';
      g.fillRect(-SAND_TILE_PX, y+dick, SAND_TILE_PX*2, dick*0.7);
    }
    g.restore();
  }
  // KOERNUNG: einzelne helle und dunkle Punkte. Sie sind es, die aus der Naehe Struktur geben —
  // ohne sie bliebe der Boden auch mit Rippeln glatt.
  for(let i=0;i<2600;i++){
    const x = rnd()*SAND_TILE_PX, y = rnd()*SAND_TILE_PX, r = 0.6 + rnd()*1.8;
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.20)' : 'rgba(50,50,50,0.18)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  // Dunkle Flecken: Seegrasreste, Steine, Vertiefungen. Sie brechen die Regelmaessigkeit der
  // Rippel, damit das Muster beim Fahren nicht als Kachel auffaellt.
  for(let i=0;i<45;i++){
    const x = rnd()*SAND_TILE_PX, y = rnd()*SAND_TILE_PX, r = 8 + rnd()*26;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(70,74,66,0.30)');
    grad.addColorStop(1, 'rgba(70,74,66,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  sandTex = new THREE.CanvasTexture(cv);
  sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping;
  // Der Boden wird sehr flach gesehen (die Kamera schaut fast waagerecht darueber), und ohne
  // anisotrope Filterung verschmiert die Kachel in der Tiefe zu einem grauen Band — genau der
  // Effekt, der behoben werden soll.
  sandTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // Die UVs der PlaneGeometry laufen von 0 bis 1 ueber die ganzen 6 km. Die Kachel muss sich also
  // oft wiederholen: 6000 / 22 = 273 mal.
  sandTex.repeat.set(SEABED_SIZE/SAND_TILE_M, SEABED_SIZE/SAND_TILE_M);
  return sandTex;
}
// Die Textur kommt ZUSAETZLICH zu den Vertexfarben: Three.js multipliziert beides, also faerbt die
// Tiefe (Sand am Ufer, Schlick unten) die Koernung der Textur ein. Deshalb ist die Textur neutral
// grau gemalt — mit eigener Farbe waere sie doppelt eingefaerbt.
const seabedMesh = new THREE.Mesh(seabedGeo, new THREE.MeshLambertMaterial({ vertexColors:true,
                                                                            map: makeSandTexture() }));
seabedMesh.position.y = 0;
scene.add(seabedMesh);
const seabedPos = seabedGeo.attributes.position;
const seabedBaseX = new Float32Array(seabedPos.count), seabedBaseZ = new Float32Array(seabedPos.count);
for(let i=0;i<seabedPos.count;i++){ seabedBaseX[i]=seabedPos.getX(i); seabedBaseZ[i]=seabedPos.getZ(i); }
seabedGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seabedPos.count*3), 3));
const seabedCol = seabedGeo.attributes.color;
// Farben nach Tiefe: heller Sand am Ufer, Schlick in der Mitte, fast schwarz im Tiefen.
// Deutlich heller als vorher (war cdbe8a / 6d7a63 / 1d2a33), gewuenscht als "den meeresboden bitte
// heller machen". Der Tiefenwert war mit 1d2a33 fast schwarz und schluckte alles, was darauf steht;
// jetzt ist auch der tiefste Grund ein helles Graublau, auf dem ein Wrack als Silhouette lesbar
// bleibt. Der Sand oben geht ins Cremeweiss — so wirkt der Schelf wie eine Lagune.
// Heller ALS FRUEHER, aber mit mehr KONTRAST zueinander als im letzten Versuch (f0e6c0/a8b294/
// 5f7684). Der war zu gleichmaessig: bei 120 m Sichtweite und flachem Blickwinkel verschwamm der
// Boden zu einer strukturlosen Flaeche — gemeldet als "der meeresboden ist quasi nicht zu
// erkennen". Jetzt liegen heller Sand und dunkler Schlick weiter auseinander, und die Uebergaenge
// zeichnen die Duenen nach.
const sbShallow = new THREE.Color(0xf2e2b0);
const sbMid     = new THREE.Color(0x8fa07a);
const sbDeep    = new THREE.Color(0x3c5766);
const _sbIslands = [];
function collectSeabedIslands(ox, oz){
  _sbIslands.length = 0;
  const half = SEABED_SIZE/2 + SHELF_W;
  const c0x = Math.round((ox-half)/CELL), c1x = Math.round((ox+half)/CELL);
  const c0z = Math.round((oz-half)/CELL), c1z = Math.round((oz+half)/CELL);
  for(let cz=c0z-1; cz<=c1z+1; cz++) for(let cx=c0x-1; cx<=c1x+1; cx++){
    const info = islandInfo(cx, cz);
    if(info) _sbIslands.push(info.wx, info.wz, info.radius*BEACH_FACTOR);
  }
}
let seabedAtX = null, seabedAtZ = null;      // Rasterstelle, fuer die der Boden gerechnet ist
// Fortschritt der HAEPPCHENWEISEN Neuberechnung (siehe updateSeabed). -1 heisst "fertig".
let seabedRow = -1, seabedPendX = 0, seabedPendZ = 0;
// Zeilen pro Frame. NACHGEMESSEN: die ganzen 49 Zeilen auf einmal kosten 9,3 ms, und das Meer
// braucht davor schon 6,7 von 16,7 ms — zusammen waere das Bild ueber dem Budget. Mit 6 Zeilen
// sind es rund 1,1 ms pro Frame, verteilt auf 9 Bilder (0,15 s). Dasselbe Verfahren, mit dem
// stepGroundFields das Hoehenraster von Mond und Mars ausmisst (8 Zeilen pro Frame).
const SEABED_ROWS_PER_FRAME = 6;
const _sbC = new THREE.Color();
// Braucht man den Meeresboden und die Unterwasserwelt ueberhaupt? Das ist der wirksamste Hebel
// gegen das Ruckeln: der Boden kostet 9,3 ms je Neuberechnung, und die Unterwasserzellen sind
// 616 Meshes pro Stueck. Beides ist aus der Luft NIE zu sehen — die Meeresflaeche verdeckt es
// vollstaendig, und unter Wasser sieht man ohnehin nur 165 bis 180 m weit.
//
// Gebraucht wird es: im U-Boot (immer, es kann jederzeit tauchen), zu Fuss oder im Schlauchboot
// (dort ist man auf Wasserhoehe und sieht beim Blick nach unten hinein) und im Flugzeug nur ganz
// tief — bis 120 m, denn ein Wasserflugzeug kann dort landen und der Blick geht schraeg ins Wasser.
function seaFloorNeeded(){
  if(locale !== 'earth') return false;
  if(isSub()) return true;
  const y = eva ? eva.group.position.y : state.pos.y;
  return y < 120;
}
function updateSeabed(){
  const F = worldFocus();
  // Auf das feste Weltraster einrasten (siehe oben). Damit sitzen die Gitterpunkte immer auf
  // denselben Weltkoordinaten und die Hoehen bleiben zwischen zwei Rasterschritten unveraendert.
  const sx = Math.round(F.x / SEABED_STEP) * SEABED_STEP;
  const sz = Math.round(F.z / SEABED_STEP) * SEABED_STEP;
  // Die Position wird SOFORT gesetzt, auch waehrend noch gerechnet wird: das Gitter soll dem
  // Spieler folgen, nicht dem Rechenfortschritt hinterherhaengen. Ein halb neu gerechneter Boden
  // sieht man nicht — die Hoehen aendern sich zwischen zwei Rasterschritten (125 m) nur wenig,
  // und die Sichtweite unter Wasser ist 16 bis 42 m.
  seabedMesh.position.x = sx;
  seabedMesh.position.z = sz;
  // Neuer Rasterplatz -> Neuberechnung anstossen (und eine laufende dabei verwerfen: der neue
  // Platz gilt, nicht der alte).
  if(sx !== seabedAtX || sz !== seabedAtZ){
    seabedAtX = sx; seabedAtZ = sz;
    seabedPendX = sx; seabedPendZ = sz;
    seabedRow = 0;
    collectSeabedIslands(sx, sz);
  }
  if(seabedRow < 0) return;                   // fertig, nichts zu tun
  const N = SEABED_SEG + 1;                   // Punkte je Zeile
  for(let n = 0; n < SEABED_ROWS_PER_FRAME && seabedRow < N; n++, seabedRow++){
    const base = seabedRow * N;
    for(let ix = 0; ix < N; ix++){
      const i = base + ix;
      const wx = seabedBaseX[i] + seabedPendX, wz = seabedBaseZ[i] + seabedPendZ;
      const y = seabedY(wx, wz, _sbIslands);
      seabedPos.setY(i, y);
      const t = Math.min(1, Math.max(0, (SEABED_SHORE_Y - y) / SEA_DEPTH));
      if(t < 0.35) _sbC.copy(sbShallow).lerp(sbMid, t/0.35);
      else         _sbC.copy(sbMid).lerp(sbDeep, (t-0.35)/0.65);
      seabedCol.setXYZ(i, _sbC.r, _sbC.g, _sbC.b);
    }
  }
  seabedPos.needsUpdate = true;
  seabedCol.needsUpdate = true;
  if(seabedRow >= N){
    seabedRow = -1;
    // Normalen erst am Ende: computeVertexNormals laeuft ueber das ganze Gitter und waere pro
    // Haeppchen neunmal umsonst gerechnet.
    seabedGeo.computeVertexNormals();
  }
}
// Beim ersten Bild soll der Boden schon KOMPLETT da sein — sonst sieht man beim Start einen halb
// gebauten Grund. Einmal alles auf einen Schlag, das kostet die gemessenen 9,3 ms genau einmal.
function seabedInit(){
  const sx = 0, sz = 0;
  seabedAtX = sx; seabedAtZ = sz; seabedPendX = sx; seabedPendZ = sz;
  collectSeabedIslands(sx, sz);
  seabedRow = 0;
  const N = SEABED_SEG + 1;
  while(seabedRow >= 0){
    const vorher = SEABED_ROWS_PER_FRAME;
    for(let n = 0; n < vorher && seabedRow < N; n++, seabedRow++){
      const base = seabedRow * N;
      for(let ix = 0; ix < N; ix++){
        const i = base + ix;
        const y = seabedY(seabedBaseX[i] + sx, seabedBaseZ[i] + sz, _sbIslands);
        seabedPos.setY(i, y);
        const t = Math.min(1, Math.max(0, (SEABED_SHORE_Y - y) / SEA_DEPTH));
        if(t < 0.35) _sbC.copy(sbShallow).lerp(sbMid, t/0.35);
        else         _sbC.copy(sbMid).lerp(sbDeep, (t-0.35)/0.65);
        seabedCol.setXYZ(i, _sbC.r, _sbC.g, _sbC.b);
      }
    }
    if(seabedRow >= N) seabedRow = -1;
  }
  seabedPos.needsUpdate = true;
  seabedCol.needsUpdate = true;
  seabedGeo.computeVertexNormals();
}
// seabedInit() wird NICHT hier gerufen: dieser Block laeuft vor dem Insel-System, und der Boden
// braucht CELL und islandInfo (siehe seabedY). Der Aufruf steht beim Spielstart, unten neben
// updateIslands() — dort ist alles deklariert.

// ---------- Insel-System (endloses, ortsfestes Zellen-Raster) ----------
// Jede Rasterzelle CELL×CELL enthält deterministisch (per Hash) evtl. eine Insel.
// Zelle (0,0) ist IMMER die Start-Insel mit Landebahn.
const CELL = 850;          // Rastergröße
const VIEW_CELLS = 3;      // Radius in Zellen, die um den Flieger sichtbar sind
const ISLAND_Y = 0.3;      // Höhe der Inseloberfläche über dem Meer
// Flugzeugträger (schwimmende Landebahn) + Hafen — Maße/Größen
const FORD_LEN = 280;      // Trägerlänge (m); Flugdeck entlang seiner Längsachse (Z) — 15% kleiner
const FORD_DECK_HALF_X = 19;   // halbe Deckbreite (X) für Kollision/Landefläche
const FORD_DECK_FRAC = 0.32;   // Deckhöhe = Anteil der Modell-Gesamthöhe (Flugdeck, nicht Mastspitze)
const HARBOR_SIZE = 60;    // Kantenlänge Hafen-GLB (Wharf Fishing Harbor) - 15% kleiner

// deterministischer Zufall je Zelle (mulberry32)
function cellRnd(cx, cz, salt) {
  let seed = (Math.imul(cx|0, 73856093) ^ Math.imul(cz|0, 19349663) ^ Math.imul(salt|0, 83492791)) >>> 0;
  let t = seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

const sandMat  = new THREE.MeshLambertMaterial({ color: 0xd9c98f });
// ---- WIESE: Grastextur mit Blueten -------------------------------------------------------------
// Die Insel war eine einfarbige Flaeche (grassMat 0x5fa048). Genau das war der Grund fuer "das pure
// schwarz oder die homogene wiese lassen die bewegung nicht spueren, obwohl man mit 22 km/h ja
// eigentlich schnell unterwegs ist": ohne Struktur im Boden gibt es keinen Bezugspunkt, an dem das
// Auge Bewegung ablesen kann. Der Astronaut laeuft 6,1 m/s — damit sich das anfuehlt, muessen
// mehrere Details pro Sekunde vorbeiziehen, also braucht es Struktur im Abstand von 3 bis 5 m.
//
// WARUM EINE TEXTUR und keine Objekte: nachgerechnet. Blueten als InstancedMesh im 3-m-Raster waeren
// 23.600 Instanzen pro 260-m-Insel (38.000 bei 330 m), und es sind bis zu 27 Inseln gleichzeitig
// geladen — das traegt kein Tablet. Vertexfarben scheitern an der Aufloesung: die Wiese hat als
// RingGeometry mit 7 Ringen nur alle 37 m einen Stuetzpunkt.
// Eine kachelnde Textur kostet dagegen EINMAL 1 MB fuer alle Inseln und liefert beliebig feines
// Detail. Sie wird zur Laufzeit gemalt (kein Download): Rauschen fuer die Grasflecken, dazu
// gestreute Blueten in Rot, Blau, Gelb und Weiss.
const GRASS_TILE_PX = 512;    // Kachelgroesse in Pixeln
const GRASS_TILE_M  = 30;     // wie viele Meter eine Kachel abdeckt -> 17 px/m, eine 0,5-m-Bluete
                              // ist damit 9 px gross und gut zu erkennen
const GRASS_FLOWERS = 90;     // Blueten je Kachel. Auf 900 m2 sind das eine alle 3,2 m — genau die
                              // Dichte, die beim Laufen mehrmals pro Sekunde etwas vorbeiziehen laesst
const GRASS_TUFTS   = 260;    // dunkle und helle Grasbueschel (die Fleckigkeit aus dem Vorbild)
let grassTex = null;
// Die Kachel malen. Deterministisch ueber einen eigenen Zaehler, damit sie bei jedem Start gleich
// aussieht — eine Wiese, die sich nach dem Neuladen umsortiert, faellt auf.
function makeGrassTexture(){
  if(grassTex) return grassTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = GRASS_TILE_PX;
  const g = cv.getContext('2d');
  let seed = 20260916;
  const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed/0x7fffffff; };
  // Grundton wie bisher, damit die Inseln aus der Luft unveraendert wirken.
  g.fillStyle = '#5fa048';
  g.fillRect(0, 0, GRASS_TILE_PX, GRASS_TILE_PX);
  // Grosse, weiche Flecken: unterschiedlich dichter Wuchs. Sie geben der Wiese Tiefe, ohne dass ein
  // Muster erkennbar wird.
  for(let i=0;i<70;i++){
    const x = rnd()*GRASS_TILE_PX, y = rnd()*GRASS_TILE_PX, r = 25 + rnd()*70;
    const hell = rnd() < 0.5;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, hell ? 'rgba(140,200,95,0.32)' : 'rgba(52,105,44,0.30)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.fill();
  }
  // Grasbueschel: kurze Striche in wechselnden Gruentoenen. Das ist die Struktur, die beim Laufen
  // vorbeizieht — kleiner als die Flecken, groesser als ein Pixel.
  g.lineWidth = 1.6;
  for(let i=0;i<GRASS_TUFTS;i++){
    const x = rnd()*GRASS_TILE_PX, y = rnd()*GRASS_TILE_PX;
    const len = 4 + rnd()*9, a = rnd()*Math.PI*2;
    const h = rnd();
    g.strokeStyle = h < 0.45 ? 'rgba(46,96,38,0.55)'
                  : h < 0.85 ? 'rgba(126,190,84,0.50)'
                             : 'rgba(178,214,110,0.45)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a)*len, y + Math.sin(a)*len);
    g.stroke();
  }
  // Blueten. Weiss ist die haeufigste (Gaensebluemchen im Vorbild), die Farben sind Akzente —
  // umgekehrt saehe die Wiese wie ein Blumenbeet aus.
  const cols = ['#fdfdf5','#fdfdf5','#fdfdf5','#e8422f','#3f6fd8','#f2d02c'];
  for(let i=0;i<GRASS_FLOWERS;i++){
    const x = rnd()*GRASS_TILE_PX, y = rnd()*GRASS_TILE_PX;
    const r = 2.2 + rnd()*2.6;
    g.fillStyle = cols[Math.floor(rnd()*cols.length)];
    // Fuenf Blaetter statt eines Kreises: bei 9 px ist der Unterschied zu sehen.
    for(let k=0;k<5;k++){
      const a = k/5*Math.PI*2 + rnd()*0.3;
      g.beginPath();
      g.arc(x + Math.cos(a)*r*0.6, y + Math.sin(a)*r*0.6, r*0.55, 0, Math.PI*2);
      g.fill();
    }
    // Gelbe Mitte, aber nicht bei den gelben Blueten selbst.
    if(g.fillStyle !== '#f2d02c'){
      g.fillStyle = 'rgba(240,200,60,0.9)';
      g.beginPath(); g.arc(x, y, r*0.45, 0, Math.PI*2); g.fill();
    }
  }
  grassTex = new THREE.CanvasTexture(cv);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  // Anisotrope Filterung: die Wiese wird flach und aus der Ferne gesehen, ohne sie verschmiert die
  // Kachel in der Tiefe zu Grau. Der Wert wird auf das Geraetemaximum begrenzt.
  grassTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return grassTex;
}
// Die Wiese traegt jetzt die gemalte Kachel (siehe makeGrassTexture). Der Grundton bleibt weiss,
// damit die Texturfarben unveraendert durchkommen — mit dem alten 0x5fa048 als color waeren sie
// ein zweites Mal gruen multipliziert worden.
const grassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: makeGrassTexture() });
const wallMats = [0xe8ddc8, 0xd8c0a0, 0xcfe0ec, 0xf0d0c0].map(c => new THREE.MeshLambertMaterial({ color: c }));
const roofMats = [0xb04030, 0x8a5a3a, 0x6a6a72, 0x9a4a4a].map(c => new THREE.MeshLambertMaterial({ color: c }));
const runwayMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
const lineMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const hillMat = new THREE.MeshLambertMaterial({ color: 0x4e8a3a });   // Hügel (grün)
const rockMat = new THREE.MeshLambertMaterial({ color: 0x8a7860 });   // Fels-/Steingipfel (braun)
const towerMats = [0x8fa5c0, 0x9db4c8, 0xa8b8c4, 0x7f97b5].map(c => new THREE.MeshLambertMaterial({ color: c }));
const towerGlass = new THREE.MeshLambertMaterial({ color: 0x66ccee });
// GETEILTE Einheitsgeometrie fuer alles, was aus Kisten und Kegeln besteht: eine 1x1x1-Box und ein
// Kegel mit Radius 1 und Hoehe 1, ueber mesh.scale auf die gewuenschte Groesse gebracht.
//
// Der Grund ist NICHT die Rechenzeit beim Bauen, sondern der GPU-Upload. Jede eigene Geometrie
// braucht ein eigenes Buffer-Paar im Grafikspeicher, und das wird beim ERSTEN Zeichnen angelegt —
// also im Frame NACH dem Bau, mitten im renderer.render(). Eine Wolkenkratzer-Stadt hat gemessen
// bis zu 132 Tuerme (Median 78) mit je 4 Meshes: das waren bis zu 528 neue Buffer-Paare in EINEM
// Frame. Mit einer geteilten Geometrie ist es keines, denn sie liegt schon im Speicher.
//
// Die Bauzeit sinkt nebenbei um Faktor 3,3 (132 Tuerme: 3,92 -> 1,18 ms), aber das war nie das
// Problem — 3,92 ms passen ins Frame-Budget. Der Upload passt nicht.
//
// scale statt Groesse in der Geometrie ist dabei kein Kompromiss: die Lichtberechnung nutzt die
// Normalmatrix, und die zieht die Skalierung korrekt heraus. Nur bei NEGATIVER Skalierung kippen
// Normalen um, und die kommt hier nicht vor (alle Werte sind Groessen, also positiv).
const UNIT_BOX  = new THREE.BoxGeometry(1, 1, 1);
// Der Kegel braucht seine Segmentzahl in der Geometrie (die kann scale nicht ersetzen), deshalb
// zwei Varianten: 4 Segmente fuer Hausdaecher (eine Pyramide), 16 fuer Huegel.
const UNIT_CONE4  = new THREE.ConeGeometry(1, 1, 4);
const UNIT_CONE16 = new THREE.ConeGeometry(1, 1, 16);
// Und eine 1x1-Flaeche fuer die Bahn- und Stellplatz-Markierungen. Die entstehen in Schleifen und
// sind ALLE gleich geformt — je Insel waren das bis zu 30 identische Geometrien.
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

// ---- Grafikspeicher freigeben, wenn eine Zelle verschwindet ------------------------------------
// scene.remove() nimmt ein Objekt nur aus dem Bild. Seine Geometrie behaelt Three.js trotzdem im
// Grafikspeicher (Puffer plus ein Vertex-Array-Objekt je Geometrie), bis jemand dispose() ruft —
// und das tat hier niemand. Gemessen im Browser (C:/tmp/leak2.js, 5 min Dauerflug auf 60 m Hoehe):
// renderer.info.memory.geometries stieg von 709 auf 8.900, rund 30 je Sekunde, und fiel nie. In der
// Szene standen dabei nur 3.000 bis 8.000 Knoten. Das ist das "nach einer weile faengt es an zu
// ruckeln": die ersten Minuten sind sauber, dann laeuft der Grafikspeicher voll.
//
// NICHT freigegeben werden darf, was geteilt ist: die Einheitsgeometrien oben, die Fisch-Geometrie
// und alles aus den GLB-Vorlagen — clone(true) kopiert die Knoten, teilt aber Geometrie und
// Material mit der Vorlage. Wuerde man die freigeben, laedt Three.js sie beim naechsten Zeichnen neu
// hoch (dispose loescht nur den GPU-Teil) — beim Feuerwehrboot 460.000 Punkte, genau der Ruckler,
// den das hier loswerden soll. Deshalb wird vorher gesammelt, was die Vorlagen benutzen.
// Materialien bleiben stehen: fast alle sind geteilt, und die Programmzahl blieb in der Messung
// konstant (29) — dort waechst nichts.
function sharedGeos(){
  const s = new Set([UNIT_BOX, UNIT_CONE4, UNIT_CONE16, UNIT_PLANE]);
  if(reefFishGeo) s.add(reefFishGeo);
  const tpls = [boatTemplate, truckTemplate, harborTemplate, rocketTemplate, padTemplate,
                xwingParkTpl, fordTemplate, orcaTpl, dinghyTemplate, chute2Template, parachuteTemplate,
                astronautTemplate, ...Object.values(glbTemplates), ...Object.values(shipTemplates)];
  for(const tp of tpls) if(tp) tp.traverse(o=>{ if(o.geometry) s.add(o.geometry); });
  return s;
}
function disposeTree(obj, shared){
  if(!obj) return;
  const keep = shared || sharedGeos();
  obj.traverse(o=>{
    if(o.geometry && !keep.has(o.geometry)) o.geometry.dispose();
    // Eine InstancedMesh hat zusaetzlich ihren eigenen Matrix-Puffer (die Riff-Schwaerme).
    if(o.isInstancedMesh) o.dispose();
  });
}
// Aus der Szene nehmen UND freigeben — fuer die Zell-Pools.
function dropFromScene(obj, shared){
  if(!obj) return;
  scene.remove(obj);
  disposeTree(obj, shared);
}

// baut ein Haus an (x,z). rnd steuert Größe/Farbe. Gibt {mesh, w, d, h} zurück (für Kollision).
function makeHouse(x, z, rnd, rnd2) {
  const g = new THREE.Group();
  // deutlich variablere Häuser: breit 5–16, tief 5–14, hoch 4–16
  const w = 5 + rnd*11, d = 5 + rnd2*9, h = 4 + rnd*rnd2*12 + rnd*4;
  const wi = Math.floor(rnd * wallMats.length) % wallMats.length;
  const ri = Math.floor(rnd2 * roofMats.length) % roofMats.length;
  // Geteilte Einheitsgeometrie plus scale (siehe UNIT_BOX): spart den GPU-Upload je Haus.
  const wall = new THREE.Mesh(UNIT_BOX, wallMats[wi]);
  wall.scale.set(w, h, d);
  wall.position.y = h/2; g.add(wall);
  const rr = Math.max(w,d)*0.72, rh = Math.min(h*0.5,4);
  const roof = new THREE.Mesh(UNIT_CONE4, roofMats[ri]);
  roof.scale.set(rr, rh, rr);
  roof.position.y = h + Math.min(h*0.25,2); roof.rotation.y = Math.PI/4; g.add(roof);
  g.position.set(x, ISLAND_Y, z);
  return { mesh:g, w:Math.max(w,d), d:Math.max(w,d), h: h + Math.min(h*0.5,4) };
}

// baut einen Wolkenkratzer an (x,z). Gibt {mesh, w, d, h} zurück.
function makeTower(x, z, rnd, rnd2) {
  const g = new THREE.Group();
  const w = 14 + rnd*10, d = 14 + rnd2*10, h = 70 + rnd*90;   // hoch: 70–160 m
  // Geteilte Einheitsgeometrie plus scale (siehe UNIT_BOX). Hier zaehlt es am meisten: eine Stadt
  // hat bis zu 132 Tuerme mal 4 Meshes, das waren bis zu 528 GPU-Uploads in einem Frame.
  const body = new THREE.Mesh(UNIT_BOX, towerMats[Math.floor(rnd*towerMats.length)%towerMats.length]);
  body.scale.set(w, h, d);
  body.position.y = h/2; g.add(body);
  // ein paar Glas-Bänder (Etagen) andeuten
  for(let k=1;k<=3;k++){
    const band = new THREE.Mesh(UNIT_BOX, towerGlass);
    band.scale.set(w*1.02, h*0.06, d*1.02);
    band.position.y = h*(0.25*k); g.add(band);
  }
  g.position.set(x, ISLAND_Y, z);
  return { mesh:g, w:Math.max(w,d), d:Math.max(w,d), h };
}

// baut einen Hügel an (x,z) mit steinigem Gipfel. Gibt {mesh, w, d, h} zurück.
function makeHill(x, z, rnd, rnd2) {
  const g = new THREE.Group();
  const r = 30 + rnd*50, h = 20 + rnd2*40;
  // Geteilte Einheitsgeometrie plus scale (siehe UNIT_BOX).
  const hill = new THREE.Mesh(UNIT_CONE16, hillMat);
  hill.scale.set(r, h, r);
  hill.position.y = h/2; g.add(hill);
  const cap = new THREE.Mesh(UNIT_CONE16, rockMat);  // brauner Gipfel
  cap.scale.set(r*0.45, h*0.35, r*0.45);
  cap.position.y = h*0.82; g.add(cap);
  g.position.set(x, ISLAND_Y, z);
  return { mesh:g, w:r*2, d:r*2, h, isHill:true };
}

// deterministische Insel-Daten je Zelle (ohne Geometrie) -> auch für isOnLand nutzbar
// Ergebnis-Cache. islandInfo ist eine reine Funktion von (cx,cz) — dieselbe Zelle liefert immer
// dasselbe —, wurde aber pro Aufruf mit vier cellRnd-Hashes neu gerechnet. Und aufgerufen wird sie
// sehr oft: isOnLand fragt 9 Zellen ab, und updateSea ruft isOnLand für JEDEN Gitterpunkt des
// Meeres (25.921 Stück, jeden Frame). Gemessen waren das 369 ms pro Frame für eine Handvoll
// tatsächlich verschiedener Zellen — 96 % der Meeres-Rechenzeit. Mit Cache ist es ein Map-Zugriff.
// Auch die "hier ist keine Insel"-Antwort wird gemerkt (als null), denn 45 % der Zellen sind Wasser
// und genau die wurden sonst immer wieder neu verworfen.
const _islandCache = new Map();
function islandInfo(cx, cz) {
  const key = cx + ',' + cz;
  const hit = _islandCache.get(key);
  if (hit !== undefined) return hit;
  const info = _islandInfoCalc(cx, cz);
  _islandCache.set(key, info);
  return info;
}
function _islandInfoCalc(cx, cz) {
  const isStart = (cx === 0 && cz === 0);
  if (!isStart && cellRnd(cx, cz, 1) > 0.55) return null;   // ~55% Inseln
  const jx = (cellRnd(cx, cz, 2) - 0.5) * CELL * 0.5;
  const jz = (cellRnd(cx, cz, 3) - 0.5) * CELL * 0.5;
  const wx = cx * CELL + (isStart ? 0 : jx);
  const wz = cz * CELL + (isStart ? 0 : jz);
  const radius = isStart ? 260 : (170 + cellRnd(cx, cz, 4) * 160);
  return { isStart, wx, wz, radius };
}

// Deterministische Flugzeugträger-Daten je Zelle: nur auf OFFENEM MEER (keine Insel in der Zelle),
// ~10% Häufigkeit (wie Städte). Ortsfest. Rückgabe {wx,wz,rot} oder null.
function carrierInfo(cx, cz){
  if(cx===0 && cz===0) return null;             // Startzelle frei halten
  if(islandInfo(cx, cz)) return null;           // eigene Zelle muss Wasser sein
  // Haeufigkeit. Die Schwelle gilt nur fuer WASSERzellen, und 53 % aller Zellen sind Inseln —
  // effektiv kamen bei 0,10 also nur 3,8 % aller Zellen auf einen Traeger (gemessen in 625 Zellen).
  // Auf 0,18 angehoben: rund 7 % aller Zellen, damit man ihnen oefter begegnet.
  if(cellRnd(cx, cz, 42) >= 0.18) return null;
  const wx = cx*CELL + (cellRnd(cx,cz,43)-0.5)*CELL*0.3;
  const wz = cz*CELL + (cellRnd(cx,cz,44)-0.5)*CELL*0.3;
  // Der lange Träger darf keine Insel überlappen: kein Inselrand näher als FORD_LEN/2+Puffer.
  const CLEAR = FORD_LEN*0.5 + 40;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const info = islandInfo(cx+dx, cz+dz); if(!info) continue;
    if(Math.hypot(wx-info.wx, wz-info.wz) < info.radius + CLEAR) return null;
  }
  const rot = cellRnd(cx,cz,45)*Math.PI*2;      // zufällige Ausrichtung
  return { wx, wz, rot };
}

// Liegt Weltposition (x,z) auf einer Insel-Grasfläche?
function isOnLand(x, z) {
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const info = islandInfo(pcx + dx, pcz + dz);
    if (info && Math.hypot(x - info.wx, z - info.wz) < info.radius) return true;
  }
  return false;
}

// Liegt (x,z) auf dem SANDRAND einer Insel? buildIsland zeichnet den Sand bis radius*1.12, während
// isOnLand nur die Grasfläche (radius) kennt. Für Flugzeuge ist der Unterschied belanglos — sie
// fliegen darüber —, fürs Feuerwehrboot nicht: ohne diese Prüfung fährt es sichtbar über den Strand.
const BEACH_FACTOR = 1.12;      // muss zum Sandradius in buildIsland passen
function isOnBeach(x, z) {
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const info = islandInfo(pcx + dx, pcz + dz);
    if (info && Math.hypot(x - info.wx, z - info.wz) < info.radius * BEACH_FACTOR) return true;
  }
  return false;
}

// Offenes Wasser? Kein Land, kein Strand, kein Traegerdeck, kein Bauwerk. Das ist die Flaeche, auf
// der Boote fahren duerfen — Feuerwehrboot und Schlauchboot benutzen dieselbe Pruefung, damit
// beide dieselbe Kuestenlinie sehen.
function isOpenWater(x, z){
  return !isOnLand(x, z) && !isOnBeach(x, z) && !isOnCarrier(x, z)
         && !hitsBuilding(x, ISLAND_Y+2, z, false);
}

// Liegt (x,z) auf der Landebahn einer Insel? (Bahn: 24 breit in X, rwLen lang in Z,
// zentriert auf der Inselmitte — gleiche Maße wie in buildIsland.)
function isOnRunway(x, z) {
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const info = islandInfo(pcx + dx, pcz + dz);
    if (!info) continue;
    const rwLen = Math.min(260, info.radius * 1.4);
    if (Math.abs(x - info.wx) <= 12 && Math.abs(z - info.wz) <= rwLen/2) return true;
  }
  return false;
}

// Liegt (x,z) auf dem Flugdeck eines Trägers? Gibt {info,cx,cz} oder null.
// Deck: FORD_DECK_HALF_X breit (X'), FORD_LEN/2 lang (Z') im gedrehten Träger-System.
function carrierAt(x, z){
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const info = carrierInfo(pcx+dx, pcz+dz); if(!info) continue;
    const rx = x-info.wx, rz = z-info.wz;
    // Welt->lokal (Inverse der three.js rotation.y): x_l=rx*cos-rz*sin, z_l=rx*sin+rz*cos
    const cs = Math.cos(info.rot), sn = Math.sin(info.rot);
    const lx = rx*cs - rz*sn, lz = rx*sn + rz*cs;
    if(Math.abs(lx) <= fordDeckHalfX && Math.abs(lz) <= FORD_LEN*0.5)
      return { info, cx:pcx+dx, cz:pcz+dz };
  }
  return null;
}
function isOnCarrier(x, z){ return !!carrierAt(x, z); }

// Darf das aktuelle Modell hier landen? (sonst = Crash, auch bei sanftem Aufsetzen)
//  Mustang/Transall: Insel (Gras+Bahn), NICHT Wasser.
//  Airbus/AlphaJet: NUR Landebahn (Insel) — AlphaJet zusätzlich Trägerdeck.
//  Mustang zusätzlich Trägerdeck.
//  Canadair (Löschflugboot): ÜBERALL auf der Erde — Wasser, Landebahn, Trägerdeck und Wiese. Sie ist
//  das Löschflugzeug, und ein Waldbrand liegt nicht immer neben einer Bahn. Wassertanken bleibt aufs
//  Wasser beschränkt (updateScoop prüft das selbst), Gebäude und Berge bleiben Hindernisse.
function canLandHere(x, z) {
  // Außerhalb der Erde ist jede Fläche landbar (Mond, Mars, Hangarboden) — dorthin kommt nur der X-Wing.
  if(GROUNDS[locale] || locale === 'death') return true;
  const model = MODEL_NAMES[currentModel];
  const onLand = isOnLand(x, z);
  const onRunway = isOnRunway(x, z);
  const onCarrier = isOnCarrier(x, z);
  if (model === 'XWing')    return true;                    // X-Wing: senkrecht -> überall (auch Wasser)
  if (model === 'AlphaJet') return onRunway || onCarrier;   // Jet: Bahn oder Trägerdeck
  if (model === 'Mustang')  return onLand   || onCarrier;   // Warbird: ganze Insel oder Trägerdeck
  if (model === 'Airbus')   return onRunway;
  // Die Canadair ist ein Flugboot: Wasser und Landebahn hatte sie schon, das Traegerdeck kommt
  // dazu (gewuenscht). Sie ist mit 18,5 m Spannweite breiter als der Alpha Jet (8,1 m), passt aber
  // auf die 38 m Deckbreite; und der Traeger ist mitten auf dem Meer der naechste Platz zum
  // Nachtanken. Der Strand bleibt ausgenommen, wie bisher.
  // Und jetzt auch auf der WIESE, nicht nur auf Wasser, Bahn und Deck (so gewuenscht). Damit landet
  // sie ueberall auf der Insel wie die Mustang und kann dort rollen — praktisch, weil sie das
  // Loeschflugzeug ist und ein Waldbrand nicht immer neben einer Landebahn liegt.
  //
  // `true` ist hier NICHT „ueberall im Spiel": Mond, Mars und Hangarboden sind oben schon behandelt
  // (GROUNDS/death), diese Funktion sieht nur noch die Erde. Und dort war sie ohnehin fast ueberall
  // erlaubt — es fehlte genau die Grasflaeche. Gebaeude, Berge und Raketenrampen bleiben Hindernisse:
  // die pruefen hitsBuilding, nicht canLandHere, und dort kracht man schon im Anflug hinein.
  if (model === 'Canadair') return true;
  if (model === 'Boat')     return !onLand && !onCarrier;                // Boot: nur offenes Wasser
  if (model === 'Sub')      return !onLand && !onCarrier;                // U-Boot: wie das Boot
  // Die Transall darf ebenfalls aufs Deck (gewuenscht) — sie ist der Transporter, und Fracht auf
  // einen Traeger zu bringen ist genau ihre Aufgabe. Mit 20 m Spannweite passt sie aufs 38 m breite
  // Deck, und traege ist sie nur in der Luft, nicht beim Aufsetzen.
  if (model === 'Transall') return onLand || onCarrier;
  return onLand;                                            // Default: Insel
}

// Deterministische Bauwerks-Liste einer Insel (lokale x/z relativ zur Inselmitte).
// Genutzt von buildIsland (zeichnen) UND der Kollision. Ergebnis wird gecacht.
const _bldgCache = new Map();
function islandBuildings(cx, cz) {
  const key = cx+','+cz;
  if(_bldgCache.has(key)) return _bldgCache.get(key);
  const info = islandInfo(cx, cz);
  if(!info){ _bldgCache.set(key, null); return null; }
  const { radius } = info;
  const rwLen = Math.min(260, radius * 1.4);
  // Jede 10. Insel (deterministisch) ist eine Wolkenkratzer-Stadt
  const isCity = (cellRnd(cx, cz, 99) < 0.10);
  const list = [];

  if(isCity){
    // Wolkenkratzer-STADT: dichtes Turm-Raster über die GANZE Insel.
    // Die mittlere Spalte (x≈0) bleibt frei = durchgehende Flugschneise entlang Z
    // (dieselbe Achse wie die Landebahn) -> Airbus fliegt durch, ohne zu landen.
    const STEP = 46;              // Rasterabstand (Gassenbreite ~46-24=22 seitlich)
    const AISLE = 26;             // halbe Breite der zentralen Flugschneise (frei)
    let idx=0;
    // Das Raster wird von x = 0 aus nach BEIDEN Seiten aufgebaut, nicht von -radius durchgezaehlt.
    // Vorher hing der Startwert am Inselradius, und der ist bei jeder Insel anders — die Landebahn
    // bei x = 0 lag deshalb an einer beliebigen Stelle im Raster. Die Schneise wurde symmetrisch
    // ausgeschnitten, aber die erste Turmreihe stand links und rechts unterschiedlich weit weg:
    // ueber 360 Staedte gemessen 290 schief (80,6 %), im schlimmsten Fall 40 m Unterschied. Beim
    // Anflug sah die Bahn dadurch aus, als laege sie am Rand der Stadt statt in ihrer Mitte.
    // Mit N Schritten je Seite liegt immer eine Rasterlinie genau auf 0, und die Gasse ist links
    // und rechts gleich breit.
    const N = Math.floor(radius / STEP);
    for(let ix=-N; ix<=N; ix++){
      const gx = ix * STEP;
      for(let iz=-N; iz<=N; iz++){
        const gz = iz * STEP;
        if(Math.hypot(gx,gz) >= radius*0.94) continue;      // nur auf der Insel
        if(Math.abs(gx) < AISLE) continue;                  // zentrale Schneise frei lassen
        idx++;
        list.push({ x:gx, z:gz, r1:cellRnd(cx,cz,70+idx), r2:cellRnd(cx,cz,300+idx), type:'tower' });
      }
    }
  } else {
    const nB = 8 + Math.floor(cellRnd(cx, cz, 5) * 10);   // 8–18 Bauwerke
    for(let i=0;i<nB;i++){
      const side = (i % 2 === 0) ? -1 : 1;
      const hx = side * (40 + cellRnd(cx, cz, 30 + i) * (radius * 0.55));
      const hz = (cellRnd(cx, cz, 50 + i) - 0.5) * radius * 1.3;
      if(Math.hypot(hx, hz) >= radius * 0.9) continue;     // außerhalb Gras -> weglassen
      const r1 = cellRnd(cx, cz, 70 + i), r2 = cellRnd(cx, cz, 130 + i);
      const type = (cellRnd(cx, cz, 200 + i) < 0.12) ? 'hill' : 'house';  // gelegentlich Hügel
      // tatsächliche Halbbreite abschätzen (wie in makeHill/makeHouse), damit auch BREITE
      // Hügel/Häuser NEBEN der Bahn diese nicht überragen -> Bahn (±12 X) bleibt garantiert frei.
      const hw = (type==='hill') ? (30 + r1*50) : Math.max(5 + r1*11, 5 + r2*9)/2;
      if(Math.abs(hx) - hw < 22 && Math.abs(hz) - hw < rwLen/2 + 10) continue;  // Bahn+Rand freihalten
      // Den PARKPLATZ genauso freihalten. Genau daran haengt, dass er auf jeder Insel passt: die
      // Suche nach einer freien Luecke gelang nur auf 76 % der Inseln (gemessen). Die Halbbreite hw
      // zaehlt mit, damit auch ein breites Haus NEBEN dem Platz nicht hineinragt  dieselbe
      // Rechnung, die eine Zeile darueber die Landebahn schuetzt.
      const pk0 = parkLocal(cx, cz);
      if(pk0 && inParkLocal(pk0, hx, hz, hw + 6)) continue;
      list.push({ x:hx, z:hz, r1, r2, type });
    }
  }
  _bldgCache.set(key, list);
  return list;
}

// Trifft das Flugzeug an Weltposition (x,y,z) ein Gebäude? (Türme/Häuser, keine Hügel-Extra).
// Nutzt dieselbe deterministische Bauwerks-Liste wie buildIsland.
function hitsBuilding(x, y, z, skipHarbor, exceptShip) {
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for (let dz=-1; dz<=1; dz++) for (let dx=-1; dx<=1; dx++) {
    const info = islandInfo(pcx+dx, pcz+dz);
    if(!info) continue;
    const list = islandBuildings(pcx+dx, pcz+dz);
    if(!list) continue;
    const lx = x - info.wx, lz = z - info.wz;        // lokal zur Inselmitte
    for(const b of list){
      const ay = y - ISLAND_Y;
      if(b.type === 'hill'){
        // Berg = Kegel (Maße wie makeHill: r=30+r1*50, h=20+r2*40; unabhängig von buildIsland).
        const rBase = 30 + b.r1*50, hh = 20 + b.r2*40;
        if(ay > hh) continue;                        // über dem Gipfel -> drüberfliegen ok
        const rHere = rBase * (1 - ay/hh);           // Kegel wird nach oben schmaler
        if(Math.hypot(lx - b.x, lz - b.z) < rHere + 3) return true;
        continue;
      }
      const hh = b.hh || 12;                         // Haus/Turm-Höhe
      if(ay > hh) continue;                          // über dem Dach -> kein Treffer
      const hw = b.hw || 8;                          // halbe Breite
      if(Math.abs(lx - b.x) < hw+3 && Math.abs(lz - b.z) < hw+3) return true;
    }
    // Hafen: solide Struktur am Inselrand -> Treffer bis ~20 m Höhe (Kräne/Masten)
    const hb = harborLocal(pcx+dx, pcz+dz);
    if(!skipHarbor && y - ISLAND_Y < harborHeight + 3 && Math.hypot(lx - hb.x, lz - hb.z) < HARBOR_SIZE*0.45) return true;
    // Startrampe und Rakete: zwei gestapelte Zylinder um denselben Mittelpunkt. Die Rampe steht
    // immer (sie bleibt beim Start stehen), die Rakete nur, solange sie nicht weggeflogen ist.
    // Das gehört genau hierher, in dieselbe Zellenschleife wie Häuser und Hafen: damit gilt die
    // Hülle in einem Zug für den Absturz des Fliegers, die Bootsfahrt, die Schritte des
    // Astronauten UND das Ausweichen der KI — die fragen alle über hitsBuilding.
    const rl = rocketLocal(pcx+dx, pcz+dz);
    if(rl){
      const dr = Math.hypot(lx - rl.x, lz - rl.z);
      const ay = y - ISLAND_Y;
      if(dr < PAD_R && ay < PAD_H) return true;                    // in den Startturm
      const rs = rocketState.get((pcx+dx) + ',' + (pcz+dz));
      const steht = !rs || rs.phase !== 'gone';                    // ohne Eintrag: sie steht
      const basis = rs ? rs.y : 0;                                 // beim Steigen wandert sie mit
      if(steht && dr < ROCKET_R && ay > basis - 2 && ay < basis + ROCKET_H) return true;
    }
  }
  // Fahrende Handelsschiffe: feste Hindernisse wie ein Berg (siehe hitsShip). Sie stehen nicht im
  // Zellenraster, deshalb hier separat — dafuer gilt es damit ueberall, wo auch Haeuser gelten:
  // Absturzpruefung, Bootsfahrt, Schritte des Astronauten.
  // exceptShip nimmt genau ein Schiff aus — das braucht die Flotte selbst (siehe seaShipWaterFor).
  if(typeof seaShips !== 'undefined' && hitsSeaShip(x, y, z, exceptShip)) return true;
  // Flugzeugträger: seitlich in den Rumpf/Aufbau fliegen = Treffer. Das Flugdeck (oben, landbar)
  // ist frei -> Treffer nur UNTERHALB der Deckhöhe (Bordwand) oder am Turm knapp über Deck.
  return _hitsBuildingCarrier(x, y, z);
}
// Schiebt (x,z) radial aus einem getroffenen Berg-Grundriss heraus an den Hangfuß (+Puffer),
// damit ein an einem Berg abgestürztes Flugzeug AUSSEN am Hang herunterrutscht (nicht durchfällt).
function pushOutOfHill(x, z){
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const list = islandBuildings(pcx+dx, pcz+dz); if(!list) continue;
    for(const b of list){
      if(b.type !== 'hill') continue;
      const cxw = info.wx + b.x, czw = info.wz + b.z;    // Bergmitte (Welt)
      const rBase = 30 + b.r1*50;
      const d = Math.hypot(x - cxw, z - czw);
      if(d < rBase + 4){
        const nx = d>0.001 ? (x-cxw)/d : 1, nz = d>0.001 ? (z-czw)/d : 0;
        return { x: cxw + nx*(rBase+4), z: czw + nz*(rBase+4) };  // an den Hangfuß nach außen
      }
    }
  }
  return null;
}
// Wie carrierAt, aber mit der vollen RUMPF-Breite (Bordwand ragt seitlich ueber das Deck hinaus).
// Nur fuer die Kollision: seitliches Einfliegen unter Deckhoehe soll die Flanke treffen.
function carrierHullAt(x, z){
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  const HULL_HALF_X = fordHullHalfX;   // aus GLB vermessene Rumpf-Halbbreite (Deck + Puffer)
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const info = carrierInfo(pcx+dx, pcz+dz); if(!info) continue;
    const rx = x-info.wx, rz = z-info.wz;
    const cs = Math.cos(info.rot), sn = Math.sin(info.rot);
    const lx = rx*cs - rz*sn, lz = rx*sn + rz*cs;
    if(Math.abs(lx) <= HULL_HALF_X && Math.abs(lz) <= FORD_LEN*0.5)
      return { info, cx:pcx+dx, cz:pcz+dz };
  }
  return null;
}
function _hitsBuildingCarrier(x, y, z){
  const car = carrierHullAt(x, z);
  if(car){
    if(y < fordDeckY - 1.5) return true;                       // unter dem Deck = in die Bordwand
    // Turm (Insel-Aufbau) steht seitlich auf dem Deck. Bevorzugt die aus dem echten GLB
    // VERMESSENE Box (fordTower); solange das Modell noch lädt, greift die Schätzung.
    const info=car.info, rx=x-info.wx, rz=z-info.wz;
    const cs=Math.cos(info.rot), sn=Math.sin(info.rot);
    const lx2=rx*cs - rz*sn, lz2=rx*sn + rz*cs;
    if(fordTower){
      const P=3;   // Puffer = Rasterweite (STEP): gleicht die Quantelung der Vermessung genau aus
      if(y < fordTower.top && lx2 > fordTower.minX-P && lx2 < fordTower.maxX+P
                           && lz2 > fordTower.minZ-P && lz2 < fordTower.maxZ+P) return true;
    } else {
      if(y < fordDeckY + 22 && Math.abs(lx2-(FORD_DECK_HALF_X-4)) < 10 && Math.abs(lz2-FORD_LEN*0.28) < 14) return true;
    }
  }
  return false;
}
// Ist (x,z) am Boden frei von Hindernissen (Gebäude, Hafen, Trägerdeck)? Für die Rettungsfahrzeuge,
// die weder durch Häuser noch durch Hafen/Carrier fahren dürfen und deren Wasserstrahl frei sein muss.
function spotFreeOfBuildings(x, z, pad){
  pad = pad || 6;
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const list = islandBuildings(pcx+dx, pcz+dz); if(!list) continue;
    const lx = x - info.wx, lz = z - info.wz;
    for(const b of list){
      // Berge zählen für die Feuerwehr/den Wasserstrahl AUCH als Hindernis (rund, breit).
      if(b.type === 'hill'){
        const hr = 30 + b.r1*50;                     // Basisradius (wie makeHill), robust ohne buildIsland
        if(Math.hypot(lx - b.x, lz - b.z) < hr + pad) return false;
        continue;
      }
      const hw = b.hw || 8;
      if(Math.abs(lx - b.x) < hw+pad && Math.abs(lz - b.z) < hw+pad) return false;
    }
    // Hafen (steht am Inselrand) als runde Sperrzone
    const hb = harborLocal(pcx+dx, pcz+dz);
    if(Math.hypot(lx - hb.x, lz - hb.z) < HARBOR_SIZE*0.5 + pad) return false;
  }
  // Trägerdeck (schwimmende Insel) ist ebenfalls tabu
  if(isOnCarrier(x, z)) return false;
  return true;
}
// Nächste gebäudefreie Stelle um (x,z) herum suchen (für Feuerwehr-Standplatz).
function freeSpotNear(x, z){
  if(spotFreeOfBuildings(x, z)) return { x, z };
  for(let r=18; r<=80; r+=14){
    for(let a=0; a<8; a++){
      const px = x + Math.cos(a/8*6.283)*r, pz = z + Math.sin(a/8*6.283)*r;
      if(spotFreeOfBuildings(px, pz)) return { x:px, z:pz };
    }
  }
  return { x:x+22, z:z+8 };   // Fallback (alte feste Position)
}
// Freie Sichtlinie zwischen (x1,z1) und (x2,z2)? (kein Gebäude dazwischen -> Wasserstrahl frei)
function lineOfSightFree(x1, z1, x2, z2){
  const steps = Math.max(4, Math.ceil(Math.hypot(x2-x1, z2-z1) / 6));
  for(let i=1; i<steps; i++){
    const f = i/steps;
    if(!spotFreeOfBuildings(x1+(x2-x1)*f, z1+(z2-z1)*f, 2)) return false;
  }
  return true;
}
// Rettungs-Standplatz nahe dem Wrack: hindernisfrei (Häuser/Hafen/Carrier) UND mit freier Sicht
// zum Wrack (Strahl geht durch nichts). onLand -> Stelle muss Land sein (Auto); sonst Wasser (Boot).
function rescueSpotNear(wx, wz, onLand, strict){
  for(let r=16; r<=90; r+=10){
    for(let a=0; a<12; a++){
      const px = wx + Math.cos(a/12*6.283)*r, pz = wz + Math.sin(a/12*6.283)*r;
      if((onLand ? isOnLand(px,pz) : !isOnLand(px,pz))
         && spotFreeOfBuildings(px, pz) && lineOfSightFree(px, pz, wx, wz)) return { x:px, z:pz };
    }
  }
  // strict: nur zurückgeben, wenn das gewünschte Element (Land/Wasser) NAH am Wrack existiert.
  return strict ? null : freeSpotNear(wx+22, wz+8);
}

// baut eine Insel für Zelle (cx,cz). Gibt eine Group zurück (oder null = kein Land).
function buildIsland(cx, cz) {
  const info = islandInfo(cx, cz);
  if (!info) return null;
  const { radius, wx, wz } = info;
  const g = new THREE.Group();

  // Sandrand (etwas größer) + Grasfläche
  const sand = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.12, 24), sandMat);
  sand.rotation.x = -Math.PI/2; sand.position.y = ISLAND_Y - 0.05;
  g.add(sand);
  // Die CircleGeometry hat UVs von 0 bis 1 ueber den GANZEN Kreis — die Kachel waere damit einmal
  // ueber die ganze Insel gespannt und aus 30 cm Gras wuerden 30 m grosse Flecken. Deshalb werden
  // die UVs auf Meter umgerechnet: eine Wiederholung je GRASS_TILE_M. Eigene Geometrie pro Insel,
  // weil der Radius variiert (170 bis 330 m) und die Kachelzahl mit ihm.
  const grassGeo = new THREE.CircleGeometry(radius, 48);
  const guv = grassGeo.attributes.uv, gp = grassGeo.attributes.position;
  for(let i=0;i<guv.count;i++){
    // Aus der Vertexposition rechnen und nicht aus den vorhandenen UVs: so sitzt das Muster an
    // WELTkoordinaten, laeuft also ueber Inselgrenzen durch und wiederholt sich nicht identisch.
    guv.setXY(i, (gp.getX(i) + wx)/GRASS_TILE_M, (gp.getY(i) + wz)/GRASS_TILE_M);
  }
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI/2; grass.position.y = ISLAND_Y;
  g.add(grass);

  // ---- Landebahn (Flughafen) auf JEDER Insel ----
  const rwLen = Math.min(260, radius * 1.4);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(24, rwLen), runwayMat);
  rw.rotation.x = -Math.PI/2; rw.position.y = ISLAND_Y + 0.02;
  g.add(rw);
  for (let z = -rwLen/2 + 15; z <= rwLen/2 - 15; z += 20) {
    const dash = new THREE.Mesh(UNIT_PLANE, lineMat);
    dash.scale.set(1.2, 8, 1);   // geteilte Einheitsflaeche (siehe UNIT_PLANE)
    dash.rotation.x = -Math.PI/2; dash.position.set(0, ISLAND_Y + 0.04, z);
    g.add(dash);
  }

  // ---- Parkplatz (Vorfeld) neben der Bahn, mit allen Flugzeugen ----
  // Er schliesst unmittelbar an die Landebahn an (PARK_GAP = 8 m Abstand zur Bahnkante), damit man
  // vom Stellplatz aus losrollen kann. Gebaut aus derselben Geometrie wie die Bahn selbst.
  const pk = parkLocal(cx, cz);
  if(pk){
    const pw = pk.xb - pk.xa, pl = pk.zb - pk.za;
    const ap = new THREE.Mesh(new THREE.PlaneGeometry(pw, pl), runwayMat);
    ap.rotation.x = -Math.PI/2;
    ap.position.set((pk.xa + pk.xb)/2, ISLAND_Y + 0.02, 0);
    g.add(ap);
    // Rollweg von der Bahn zum Vorfeld: ein Querstreifen auf halber Hoehe. Ohne ihn steht das
    // Vorfeld wie eine Insel im Gras, obwohl es an die Bahn anschliessen soll.
    const tw = new THREE.Mesh(new THREE.PlaneGeometry(PARK_GAP + 2, 16), runwayMat);
    tw.rotation.x = -Math.PI/2;
    tw.position.set(pk.side > 0 ? 12 + PARK_GAP/2 : -(12 + PARK_GAP/2), ISLAND_Y + 0.02, 0);
    g.add(tw);
    // Stellplatz-Markierungen: je Platz ein Querstrich, damit die Plaetze abgegrenzt sind.
    const nSlotsPerRow = Math.max(1, Math.floor(pk.len / PARK_SLOT));
    const parked = [];
    for(const s of parkSlots(cx, cz)){
      const mk = new THREE.Mesh(UNIT_PLANE, lineMat);
      mk.scale.set(pw/PARK_ROWS - 6, 1.2, 1);   // geteilte Einheitsflaeche (siehe UNIT_PLANE)
      mk.rotation.x = -Math.PI/2;
      mk.position.set(s.x, ISLAND_Y + 0.04, s.z + (s.yaw === 0 ? PARK_SLOT/2 - 1 : -(PARK_SLOT/2 - 1)));
      g.add(mk);
      // Und das Flugzeug darauf. Fehlt sein GLB noch, bleibt der Platz vorerst leer  preloadGLB
      // ruft nach dem Laden refreshIslands, dann steht es da (das musste dort ergaenzt werden:
      // vorher zog es nur das eigene Flugmodell nach, und die zuerst gebauten Inseln waeren
      // dauerhaft ohne Flugzeuge geblieben).
      // Laufender Index ueber ALLE Plaetze, nicht row*100+idx: 100 mod 5 ist 0, beide Reihen
      // waeren damit gleich besetzt. Fuer die zweite Reihe also weiterzaehlen.
      const nm = parkPlaneAt(cx, cz, s.row * nSlotsPerRow + s.idx, 0);
      // Das Modell, das man SELBST fliegt, steht nicht zusätzlich geparkt da — es wäre sonst doppelt
      // in der Welt (einmal unter dem Spieler, einmal auf dem Platz).
      //
      // AUSNAHME X-Wing, und die ist der Grund, warum er gemeldet fehlte: man startet in ihm
      // (currentModel 0), also war sein Platz immer leer — auf allen 226 Plätzen, die ihm über die
      // gezählten Inseln zugeteilt waren. Er ist aber das Fahrzeug, mit dem man ins Weltall kommt,
      // und genau danach sucht man auf dem Vorfeld. Doppelt in der Welt ist er trotzdem nicht
      // schlimm: es fliegen ohnehin KI-X-Wings herum (aiXwings), und einer, der neben dem eigenen
      // steht, sieht aus wie ein zweiter Jäger der Staffel und nicht wie ein Fehler.
      const eigenes = (nm === MODEL_NAMES[currentModel]) && nm !== 'XWing';
      const pl2 = eigenes ? null : makeParkedPlane(nm);
      if(pl2){
        pl2.position.set(s.x, ISLAND_Y, s.z);
        pl2.rotation.y = s.yaw;
        g.add(pl2);
        // Fuer updatePlaneLOD sammeln: die geparkten Flieger sind mit Abstand das schwerste
        // Gepaeck der Welt (siehe PARK_LOD_D) und werden nach Entfernung abgeschaltet.
        parked.push(pl2);
      }
    }
    // Nur hinterlegen, wenn wirklich Flieger stehen — updatePlaneLOD kann die Insel sonst
    // ueberspringen, ohne ein leeres Array zu durchlaufen.
    if(parked.length) g.userData.parked = parked;
  }
  // ---- Bauwerke (Häuser / Wolkenkratzer / Hügel) aus der deterministischen Liste ----
  for(const b of islandBuildings(cx, cz)){
    let built;
    if(b.type === 'tower') built = makeTower(b.x, b.z, b.r1, b.r2);
    else if(b.type === 'hill') built = makeHill(b.x, b.z, b.r1, b.r2);
    else built = makeHouse(b.x, b.z, b.r1, b.r2);
    g.add(built.mesh);
    b.hw = built.w/2; b.hh = built.h;    // Kollisionsmaße in die Liste zurückschreiben
  }

  // ---- Hafen am Inselrand (auf jeder Insel einer), quer zur Landebahn (X-Seite) ----
  const hb = harborLocal(cx, cz);   // lokale Position/Ausrichtung relativ zur Inselmitte
  if(harborTemplate){
    const h = harborTemplate.clone(true);
    h.position.set(hb.x, ISLAND_Y, hb.z);
    h.rotation.y = hb.rot;
    g.add(h);
    g.userData.harbor = h;   // fürs spätere Ersetzen, falls GLB später fertig lädt
  }
  // ---- Feuerwehrboot am Kai: an JEDEM Hafen liegt eines, zum Hinlaufen und Einsteigen mit Y.
  // Es liegt auf der Wasserlinie (BOAT_DRAFT unter dem Kiel, wie das fahrende Boot) und ruehrt sich
  // nicht — es ist Kulisse, bis man einsteigt. Dann wechselt das Modell (siehe harborBoatNear).
  // Nicht, waehrend man SELBST das Boot faehrt: dann sitzt man ja darin, und ein zweites am Kai
  // waere dasselbe Boot doppelt. refreshIslands baut die Zellen bei jedem Ein- und Aussteigen neu
  // (siehe evaBoardHarborBoat), der Wechsel ist also sofort sichtbar.
  // ---- U-Boot am Strand: an JEDEM Hafen liegt eines, zum Hinlaufen und Einsteigen mit Y.
  // Genau wie beim Feuerwehrboot NICHT, waehrend man es selbst faehrt (isSub()) — sonst stuende
  // dasselbe Boot doppelt da, einmal unter dem Spieler und einmal als Kulisse. Gemeldet war das
  // damals als "jetzt sind wenn man das boot nimmt 2 boote uebereinander"; refreshIslands baut die
  // Zellen bei jedem Ein- und Aussteigen neu, der Wechsel ist also sofort sichtbar.
  const sbl = isSub() ? null : harborSubLocal(cx, cz);
  if(sbl && shipTemplates['sub']){
    const su = shipTemplates['sub'].clone(true);
    // Starthoehe wie beim Kai-Boot (updateHarborSubs zieht sie jeden Frame nach) — so sitzt es
    // schon im ersten Bild richtig und rutscht nicht sichtbar an seinen Platz.
    su.position.set(sbl.x, 0, sbl.z);
    su.rotation.y = sbl.rot;
    g.add(su);
    g.userData.harborSub = su;   // fuers Nachfuehren der Wellenhoehe
  }
  const hbl = isBoat() ? null : harborBoatLocal(cx, cz);
  if(hbl){
    const fb = makeFireBoat();
    // Starthoehe wie am Strand (siehe updateHarborBoats, das sie jeden Frame nachfuehrt) — so sitzt
    // es schon im ersten Bild richtig und rutscht nicht sichtbar an seinen Platz.
    fb.position.set(hbl.x, ISLAND_Y - BOAT_DRAFT*0.6, hbl.z);
    fb.rotation.y = hbl.rot;
    g.add(fb);
    g.userData.harborBoat = fb;   // fuers spaetere Ersetzen, falls das GLB spaeter fertig laedt
  }

  // ---- Startrampe mit Rakete (auf jeder zweiten Nicht-Stadt-Insel) ----
  const rl = rocketLocal(cx, cz);
  if(rl){
    const rs = rocketStateFor(cx, cz);
    if(padTemplate){
      const p = padTemplate.clone(true);
      p.position.set(rl.x, ISLAND_Y, rl.z);
      g.add(p);
    }
    // Die Rakete kommt nur ins Bild, wenn sie noch nicht weg ist. Ihre Gruppe wird gemerkt, damit
    // updateRockets sie beim Steigen heben kann, ohne die ganze Insel neu zu bauen.
    if(rocketTemplate && rs.phase !== 'gone'){
      const r = rocketTemplate.clone(true);
      r.position.set(rl.x, ISLAND_Y + rs.y, rl.z);
      g.add(r);
      g.userData.rocket = r;
      // Flamme und Rauch unter dem Heck liegen fertig bereit und werden beim Start nur
      // eingeschaltet. Sie erst dann anzulegen würde mitten im Steigflug sichtbar ruckeln.
      const fg = new THREE.Group();
      for(let i = 0; i < 5; i++){
        const fl = new THREE.Mesh(new THREE.ConeGeometry(1.4 + Math.random()*0.8, 9 + Math.random()*5, 6), flameMat);
        fl.rotation.x = Math.PI;                       // Spitze nach unten, aus der Düse heraus
        fl.position.set((Math.random()-0.5)*2.4, -4, (Math.random()-0.5)*2.4);
        fg.add(fl);
      }
      for(let i = 0; i < 4; i++){
        const sm = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random()*2.5, 6, 5), smokeMat);
        sm.position.set((Math.random()-0.5)*9, -2 - Math.random()*4, (Math.random()-0.5)*9);
        fg.add(sm);
      }
      fg.visible = false;
      r.add(fg);
      r.userData.flame = fg;
    }
    g.userData.rocketCell = cx + ',' + cz;
  }

  // ---- Geparkter X-Wing (auf jeder Nicht-Stadt-Insel) ----
  // Nur wenn man ihn nicht selbst fliegt: sonst stuende das Modell doppelt in der Welt, einmal
  // geparkt und einmal unter dem Spieler.
  const xl = xwingLocal(cx, cz);
  if(xl && xwingParkTpl && MODEL_NAMES[currentModel] !== 'XWing'){
    const xw = xwingParkTpl.clone(true);
    xw.position.set(xl.x, ISLAND_Y, xl.z);
    xw.rotation.y = xl.yaw;
    g.add(xw);
    g.userData.xwingPark = xw;   // fuer updatePlaneLOD (siehe XPARK_LOD_D)
  }

  g.position.set(wx, 0, wz);
  return g;
}
// Hafen liegt am Rand (Sandkante) auf der +X-Seite, mit dem Steg zum Wasser gedreht.
function harborLocal(cx, cz){
  const info = islandInfo(cx, cz);
  const r = info.radius;
  const ang = -Math.PI/2 + (cellRnd(cx,cz,46)-0.5)*1.2;   // seitlich (nicht auf der Bahn-Achse Z)
  const rr = r * 1.02;                                    // knapp an der Sandkante
  return { x: Math.cos(ang)*rr, z: Math.sin(ang)*rr, rot: ang + Math.PI/2 };
}
// Das FEUERWEHRBOOT liegt AM STRAND, nicht am Kai: mit dem Heck im Sand und dem Bug im Wasser, wie
// ein Boot, das man an den Strand gezogen hat. Von hinten steigt man ein, dann faehrt man vorwaerts
// ins Wasser los; zum Aussteigen faehrt man wieder an den Strand.
//
// Zwei Versuche am Kai sind daran gescheitert, dass dort ueberall Wasser ist:
//  1. 34 m radial vor dem Hafen — lag genau auf dem Canadair-Startplatz (radius*1,14), auf der
//     Startinsel 3 m daneben. Beide standen ineinander.
//  2. Seitlich versetzt und im Wasser — richtig platziert, aber man musste durch Wasser hinlaufen,
//     und dort faengt das Schlauchboot an. Gemeldet: „einsteigen ins boot fast nicht moeglich".
// Am Strand ist der Grund FEST (evaSolid kennt den Sandrand), also faellt der ganze Konflikt weg.
//
// Der Sandrand reicht von radius bis radius*1,12 (BEACH_FACTOR). Die Bootsmitte liegt GENAU auf
// dieser Kante: das Heck (8 m dahinter) steht damit im Sand, der Bug (8 m davor) im Wasser — auf
// jeder Inselgroesse, weil der Wert relativ ist.
//
// 1,12 und nicht 1,10: stepBoat prueft die Weiterfahrt mit BOAT_LOOK = 8 m vor dem Bug, und dieser
// Punkt MUSS im Wasser liegen, sonst sitzt das Boot beim Losfahren fest (boatWaterFree schliesst den
// Strand ausdruecklich aus). Mit 1,10 waren es bei r=330 nur noch 1 m Luft, und bei groesseren Inseln
// waere der Punkt im Sand gelandet: der Sandrand waechst mit dem Radius, der Vorausblick bleibt 8 m.
// Seitlich vom Hafen weg, damit man nicht ueber den Kai klettern muss.
const HARBOR_BOAT_FAC  = 1.12;  // radial, als Anteil des Inselradius (Bootsmitte = Sandkante)
const HARBOR_BOAT_SIDE = 55;    // m seitlich neben dem Hafen (tangential)
// So weit um das Boot herum darf das SCHLAUCHBOOT nicht anspringen. Am Strand steht man auf festem
// Grund, aber der Bug ragt ins Wasser: wer vorne herumlaeuft, traete hinein, und dann setzt
// evaEnterDinghy ein — man saesse im Schlauchboot, statt einzusteigen. 26 m deckt das Boot (16 m
// lang) samt Einstiegsreichweite ab.
// ---- U-BOOT am Strand: hinlaufen und einsteigen ------------------------------------------------
// Eine KOPIE der Feuerwehrboot-Mechanik, Stueck fuer Stueck: derselbe Strandplatz-Aufbau
// (harborBoatLocal), dasselbe Einsteigen per Modellwechsel mit gemerktem Flieger-Platz
// (evaBoardHarborBoat / harborBoatFrom), dieselbe Sperre gegen das Schlauchboot und dieselbe
// Regel "nicht doppelt dastehen" (buildIsland fragt isSub()).
//
// Es liegt auf der DRITTEN Seite des Hafens. Zwei waren schon belegt: das Feuerwehrboot
// +HARBOR_BOAT_SIDE tangential, die Canadair -HARBOR_BOAT_SIDE (siehe findStart). Das U-Boot ist
// mit 95 m aber sechsmal so lang wie das Boot — mit 55 m Versatz laege es quer ueber beiden.
// Deshalb der doppelte Abstand auf der Bootsseite: 55 + 110 = 165 m von der Hafenmitte, und das
// Feuerwehrboot liegt bei 55. Zwischen den beiden Ruempfen bleiben damit 110 - 8 - 47 = 55 m Luft.
const HARBOR_SUB_SIDE = HARBOR_BOAT_SIDE + 110;
// Radial etwas WEITER draussen als das Feuerwehrboot (1,12 = Sandkante). Das U-Boot hat 13 m
// Rumpfdurchmesser und liegt tief: auf der Sandkante staeke sein halber Rumpf im Strand. 1,30
// setzt die Mitte ins Wasser, und weil der Wert relativ ist, gilt das auf jeder Inselgroesse.
// Erreichbar ist es auf zwei Wegen: zu Fuss von hinten heran (das Heck liegt in Strandnaehe, Y steigt
// ein), oder mit dem SCHLAUCHBOOT laengsseits — wer es damit beruehrt, steigt um. Der zweite Weg ist
// der Grund, warum hier KEINE Sperrzone gegen das Schlauchboot steht: am Kai-Feuerwehrboot gibt es
// eine, hier waere sie das Gegenteil von dem, was man will.
const HARBOR_SUB_FAC = 1.30;
// Liegt der ganze 95-m-Rumpf im Wasser? Geprueft wird an fuenf Stellen laengs, weil ein Boot dieser
// Laenge mit der Mitte im Wasser und dem Bug im Sand stecken kann. Weltkoordinaten, also faellt
// automatisch JEDE Insel auf (isOnLand/isOnBeach fragen das Zellenraster ab) — genau das fehlte
// vorher, wo nur mit der eigenen Insel gerechnet wurde.
function subBerthFree(wx, wz, rot){
  const fx = -Math.sin(rot), fz = -Math.cos(rot);      // Bugrichtung (-Z bei rot = 0)
  for(const d of [-47, -24, 0, 24, 47]){
    const qx = wx + fx*d, qz = wz + fz*d;
    if(isOnLand(qx, qz) || isOnBeach(qx, qz) || isOnCarrier(qx, qz)) return false;
  }
  return true;
}
// Gerechnete Liegeplaetze, Zelle -> {x,z,rot} oder null. Siehe harborSubLocal: die Suche kostet im
// schlechtesten Fall 125 Gelaendeabfragen, und sie laeuft aus dinghyTouchesHarborSub jeden Frame
// ueber 9 Nachbarzellen. Das Ergebnis haengt nur am Zellenraster, ist also fuer immer gueltig.
const _subBerthCache = new Map();
function harborSubLocal(cx, cz){
  const key = cx + ',' + cz;
  const hit = _subBerthCache.get(key);
  if(hit !== undefined) return hit;
  const res = _harborSubLocalCalc(cx, cz);
  _subBerthCache.set(key, res);
  return res;
}
function _harborSubLocalCalc(cx, cz){
  const info = islandInfo(cx, cz);
  if(!info) return null;
  const ang0 = -Math.PI/2 + (cellRnd(cx,cz,46)-0.5)*1.2;  // GLEICHER Winkel wie der Hafen
  const rr = info.radius * HARBOR_SUB_FAC;
  // Den Hafenwinkel bevorzugen und bei Bedarf ringsum ausweichen: erst der Sollplatz, dann in
  // wachsenden Schritten nach beiden Seiten. So bleibt das Boot so nah am Hafen wie moeglich und
  // liegt trotzdem im Wasser. Bis zu +-180 Grad, also wird notfalls die ganze Insel abgesucht.
  for(let s = 0; s <= 12; s++){
    for(const vz of (s === 0 ? [0] : [1, -1])){
      const ang = ang0 + vz * s * (Math.PI/12);
      const rx = Math.cos(ang), rz = Math.sin(ang);        // radial nach aussen
      const tx = -rz,           tz = rx;                   // tangential (90 Grad dazu)
      const lx = rx*rr + tx*HARBOR_SUB_SIDE;
      const lz = rz*rr + tz*HARBOR_SUB_SIDE;
      // RUECKWAERTS am Strand, wie das Feuerwehrboot (so gewuenscht): der Bug zeigt radial
      // nach AUSSEN aufs Wasser, das Heck zur Insel. Man laeuft also von hinten heran und
      // faehrt vorwaerts los. Dieselbe Rechnung wie in harborBoatLocal.
      const rot = Math.atan2(-rx, -rz);
      if(subBerthFree(info.wx + lx, info.wz + lz, rot)) return { x:lx, z:lz, rot };
    }
  }
  // Kein freier Platz rings um die Insel: dann liegt hier keines. Lieber gar kein U-Boot als eines
  // im Rasen — und die Nachbarinsel hat mit hoher Wahrscheinlichkeit einen freien Liegeplatz.
  return null;
}
// Die frueher hier stehende Sperrzone (nearHarborSub / HARBOR_SUB_NODINGHY) ist ENTFALLEN. Sie hielt
// das Schlauchboot vom U-Boot fern, damit man einsteigt statt hineinzufallen — wie am Kai-Feuerwehr-
// boot. Am U-Boot ist das Schlauchboot inzwischen aber der VORGESEHENE Weg: man faehrt heran und
// steigt bei Beruehrung um (dinghyTouchesHarborSub). Eine Sperre waere jetzt genau das Gegenteil.

const HARBOR_BOAT_NODINGHY = 26;
function harborBoatLocal(cx, cz){
  const info = islandInfo(cx, cz);
  if(!info) return null;
  const ang = -Math.PI/2 + (cellRnd(cx,cz,46)-0.5)*1.2;   // GLEICHER Winkel wie der Hafen
  const rr = info.radius * HARBOR_BOAT_FAC;
  // Auf dem Sandrand, seitlich neben dem Hafen (siehe HARBOR_BOAT_SIDE).
  const rx = Math.cos(ang), rz = Math.sin(ang);            // radial nach aussen
  const tx = -rz,           tz = rx;                       // tangential (90 Grad dazu)
  return { x: rx*rr + tx*HARBOR_BOAT_SIDE,
           z: rz*rr + tz*HARBOR_BOAT_SIDE,
           // Der BUG zeigt radial nach AUSSEN, also aufs Wasser: so steht das Heck im Sand, man
           // steigt von hinten ein und faehrt vorwaerts los. Der Bug des Modells liegt bei -Z (wie
           // bei allen Fahrzeugen), die Bugrichtung ist also (-sin(rot), -cos(rot)) — gleichgesetzt
           // mit der Radialrichtung (cos(ang), sin(ang)) ergibt das atan2(-cos, -sin).
           // Nachgerechnet fuer 0, 90, 180 und -90 Grad: Skalarprodukt jeweils 1,000.
           rot: Math.atan2(-rx, -rz) };
}
// Steht (x,z) so dicht an einem Kai-Feuerwehrboot, dass das Schlauchboot NICHT anspringen darf?
// Wird von evaEnterDinghy gefragt (beide Ausloeser: hineinlaufen und hineinfallen).
// Wo der eigene Flieger wartet, waehrend man das Kai-Feuerwehrboot faehrt:
// { model, x, y, z, yaw }. null heisst, man ist NICHT ueber den Kai ins Boot gekommen (etwa per
// Modellauswahl) — dann fuehrt Y auch nicht zurueck, sondern verhaelt sich wie bisher.
// Steht HIER und nicht bei den Boot-Funktionen weiter unten: buttonY liest es, und das steht davor.
let harborBoatFrom = null;
function nearHarborBoat(x, z){
  if(locale !== 'earth') return false;
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const bl = harborBoatLocal(pcx+dx, pcz+dz); if(!bl) continue;
    if(Math.hypot(x - (info.wx + bl.x), z - (info.wz + bl.z)) < HARBOR_BOAT_NODINGHY) return true;
  }
  return false;
}

// ---- Raketen-Startplatz auf der Insel ----------------------------------------------------
// Auf jeder zweiten Insel, die KEINE Stadt ist, steht eine Ariane 6 auf ihrer Startrampe.
// Beide Modelle sind ausgemessen (C:/tmp/mess_rp.js):
//   Rakete: 62,00 m hoch, Durchmesser 6,0 m (Halbmaß 3,05), Fuß steht bereits auf y = 0
//   Rampe:  22,73 m hoch, Grundriss 10 x 10 m (Halbmaß 5,00), Unterkante bei y = 0,51
const ROCKET_H    = 62;      // Rakete: gemessene Höhe
const ROCKET_R    = 3.5;     // Kollisionsradius Rakete (gemessen 3,05 + Puffer)
const PAD_H       = 22.73;   // Rampe/Turm: gemessene Höhe
const PAD_R       = 5.5;     // Kollisionsradius Rampe (gemessen 5,00 + Puffer)
const ROCKET_CLR  = 12;      // so viel freien Platz braucht das Gespann auf der Insel
const LAUNCH_DIST = 1500;    // näher als das kommt man nicht, ohne dass sie startet
const REGROW_T    = 45;      // Sekunden, bis auf der leeren Rampe die nächste Rakete steht
// Die Würfel-Salts sind 900 und 901. WICHTIG, weil es beim ersten Versuch schiefgegangen wäre:
// die Salts im Spiel sind BEREICHE, keine Einzelwerte. "70 + idx" der Stadt-Türme zählt bis
// idx = 128 hoch (gemessen in C:/tmp/platz.js) und belegt real 70..198, "300 + idx" bis 428.
// Ein naheliegendes 77 hätte also mitten in den Türmen gelegen und deren Zufall mit dem der
// Rakete verkoppelt — 900 und 901 liegen sicher jenseits aller Bereiche.
const _rockCache = new Map();
function rocketLocal(cx, cz){
  const key = cx + ',' + cz;
  if(_rockCache.has(key)) return _rockCache.get(key);
  const r = _rocketLocalCalc(cx, cz);
  _rockCache.set(key, r);
  return r;
}
function _rocketLocalCalc(cx, cz){
  const info = islandInfo(cx, cz);
  if(!info) return null;                             // kein Land -> keine Rampe
  if(cellRnd(cx, cz, 99) < 0.10) return null;        // Wolkenkratzer-Stadt bleibt raketenfrei
  if(cellRnd(cx, cz, 900) >= 0.5) return null;       // nur jede zweite der übrigen Inseln
  const rwLen = Math.min(260, info.radius * 1.4);    // Landebahn wie in buildIsland
  const hb = harborLocal(cx, cz);
  const pk = parkLocal(cx, cz);                      // das Vorfeld muss auch frei bleiben
  const list = islandBuildings(cx, cz) || [];
  // Auf einem Ring bei 62 % des Radius in 16 Richtungen suchen, Startwinkel gewürfelt — sonst
  // stände die Rakete auf jeder Insel an derselben Stelle. Deterministisch: dieselbe Insel gibt
  // beim Wiederbetreten dieselbe Antwort, sonst spränge die Rakete beim Nachladen der Zelle.
  const a0 = cellRnd(cx, cz, 901) * Math.PI * 2;
  for(let i = 0; i < 16; i++){
    const a = a0 + i * Math.PI * 2 / 16;
    const rr = info.radius * 0.62;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    // Landebahn frei halten (24 m breit in X, rwLen lang in Z, mittig)
    if(Math.abs(x) < 12 + ROCKET_CLR && Math.abs(z) < rwLen/2 + ROCKET_CLR) continue;
    if(Math.hypot(x - hb.x, z - hb.z) < HARBOR_SIZE*0.45 + ROCKET_CLR) continue;   // Hafen frei
    if(pk && inParkLocal(pk, x, z, ROCKET_CLR)) continue;                          // Parkplatz frei
    let frei = true;
    for(const b of list){
      // Halbbreite wie in islandBuildings geschätzt: b.hw wird erst von buildIsland
      // zurückgeschrieben, diese Funktion läuft aber davor (buildIsland fragt sie ja).
      const hw = (b.type === 'hill') ? (30 + b.r1*50)
                                     : Math.max(5 + b.r1*11, 5 + b.r2*9)/2;
      if(Math.hypot(x - b.x, z - b.z) < hw + ROCKET_CLR){ frei = false; break; }
    }
    if(!frei) continue;
    return { x, z };
  }
  return null;   // nichts frei -> diese Insel bleibt leer (bei 154 geprüften nie vorgekommen)
}
// Der Startzustand liegt AUSSERHALB der Inselgruppe, in einer eigenen Map. Grund: Zellen werden
// beim Wegfliegen abgeräumt und später neu gebaut (updateIslands). Läge er in der Gruppe, stünde
// die Rakete nach einer Runde ums Eck wieder unversehrt da, obwohl sie gerade gestartet ist.
//   phase 'stand'  = steht auf der Rampe
//   phase 'launch' = steigt (y = Höhe über der Rampe, v = Steiggeschwindigkeit)
//   phase 'gone'   = weg, t zählt bis zur nächsten Rakete herunter
const rocketState = new Map();
function rocketStateFor(cx, cz){
  const key = cx + ',' + cz;
  let s = rocketState.get(key);
  if(!s){ s = { phase:'stand', y:0, v:0, t:0 }; rocketState.set(key, s); }
  return s;
}

// ---- Parkplatz (Vorfeld) an der Landebahn, auf jeder Nicht-Stadt-Insel -------------------
// Hier stehen ALLE Flugzeuge des Spiels nebeneinander, damit man sieht, in welches man einsteigt.
// Das fertige Flughafen-GLB (airport_by_nermin) ist dafuer nicht zu gebrauchen: ausgemessen ist es
// ein 3000 x 1577 m grosses Gelaende mit nur 3,47 m hohen Aufbauten — auf 260 m Inselgroesse
// skaliert waeren die Terminals 30 cm hoch, niedriger als der Astronaut. Also ein eigenes Vorfeld,
// gebaut aus derselben Geometrie wie die Landebahn selbst.
//
// Der Platz wird FREIGEHALTEN, nicht gesucht. Das ist der entscheidende Unterschied zu Rakete und
// X-Wing, die sich einen freien Ring suchen: ein 200 x 70 m grosses Rechteck zwischen 8 bis 18
// gewuerfelte Bauwerke zu bekommen gelingt nur auf 76 % der Inseln (durchgerechnet ueber 7.218
// Inseln in C:/tmp/park_platz.js). Die Landebahn loest das schon laenger, indem islandBuildings
// ihren Streifen ausspart — der Parkplatz macht es jetzt genauso, und damit passt er auf 100 %.
const PARK_LEN  = 200;    // Laenge entlang Z, wie die Bahn (die ist 238 bis 260 m lang)
const PARK_WID  = 70;     // Breite in X: zwei Reihen a 34 m (Airbus 27,1 m Spannweite, gemessen)
const PARK_GAP  = 8;      // Abstand zwischen Bahnkante (x = 12) und Parkplatzkante
const PARK_SLOT = 34;     // Stellplatzraster: 27,1 m Spannweite + 6,9 m Luft
const PARK_ROWS = 2;      // zwei Reihen, Nasen zueinander
// Salt 904 fuer die Seitenwahl. Die Salt-Bereiche im Spiel sind BEREICHE, keine Einzelwerte:
// die Stadt-Tuerme belegen real 70..202 und 300..432 (nachgerechnet), Rakete und X-Wing sitzen
// auf 900..903. 904 liegt sicher dahinter.
const PARK_SALT = 904;
// Der Parkplatz einer Insel in LOKALEN Koordinaten, oder null (Staedte haben keinen).
const _parkCache = new Map();
function parkLocal(cx, cz){
  const key = cx + ',' + cz;
  if(_parkCache.has(key)) return _parkCache.get(key);
  const r = _parkLocalCalc(cx, cz);
  _parkCache.set(key, r);
  return r;
}
function _parkLocalCalc(cx, cz){
  const info = islandInfo(cx, cz);
  if(!info) return null;                             // kein Land
  if(cellRnd(cx, cz, 99) < 0.10) return null;        // Wolkenkratzer-Stadt: kein Parkplatz
  // Seite gewuerfelt, damit er nicht auf jeder Insel gleich liegt. Laenge notfalls kuerzen, damit
  // er auch auf der kleinsten Insel (Radius 170 m) ganz auf der Grasflaeche bleibt.
  const side = cellRnd(cx, cz, PARK_SALT) < 0.5 ? -1 : 1;
  const wid  = PARK_WID;
  const xi = 12 + PARK_GAP, xo = xi + wid;           // Innen- und Aussenkante vom Bahnrand
  // Die Ecken muessen innerhalb radius*0.9 liegen — dieselbe Grenze, die auch Bauwerke einhalten.
  let len = PARK_LEN;
  while(len > 60 && Math.hypot(xo, len/2) > info.radius*0.9) len -= 10;
  const xa = side > 0 ? xi : -xo, xb = side > 0 ? xo : -xi;
  return { xa, xb, za:-len/2, zb:len/2, side, len, wid, cx:(xa+xb)/2 };
}
// Liegt (lx,lz) INNERHALB des Parkplatzes einer Insel (lokale Koordinaten, mit Rand)?
// Damit halten islandBuildings, Rakete und X-Wing ihn frei.
function inParkLocal(pk, lx, lz, rand){
  const r = rand || 0;
  return lx > pk.xa - r && lx < pk.xb + r && lz > pk.za - r && lz < pk.zb + r;
}
// ---- Geparkter X-Wing auf jeder Insel, die keine Stadt ist -------------------------------
// Damit hat das Aussteigen einen Zweck: man laeuft zu ihm hin und steigt mit B ein. Er steht
// NICHT auf der Landebahn (sonst waere er beim Landen im Weg) und nicht im Hafen, sondern auf
// der Wiese — mit genug Abstand zu allem, damit klar ist, dass man ihn meint.
// Salt 902/903, aus demselben Grund wie 900/901 bei der Rakete: die Salts im Spiel sind
// BEREICHE. "70 + idx" der Stadt-Tuerme belegt real 70..198, "300 + idx" bis 428.
const XWP_CLR = 26;     // so viel Platz braucht der geparkte X-Wing um sich herum
const XWP_R   = 7;      // sein eigener Radius (Modell ist 12,5 m breit) — fuers Einsteigen
const _xwpCache = new Map();
function xwingLocal(cx, cz){
  const key = cx + ',' + cz;
  if(_xwpCache.has(key)) return _xwpCache.get(key);
  const r = _xwingLocalCalc(cx, cz);
  _xwpCache.set(key, r);
  return r;
}
function _xwingLocalCalc(cx, cz){
  // Der einzelne geparkte X-Wing auf der Wiese ist ENTFALLEN: er steht jetzt zusammen mit allen
  // anderen Flugzeugen auf dem Vorfeld an der Landebahn (PARK_MODELS). Zwei X-Wings auf derselben
  // Insel — einer im Gras, einer auf dem Parkplatz — waeren verwirrend gewesen, und der Parkplatz
  // ist der Ort, an dem man sich ein Flugzeug aussucht.
  //
  // Die Funktion bleibt bestehen und gibt null zurueck, statt sie samt Aufrufern auszubauen: sie
  // wird an fuenf Stellen gefragt (buildIsland, xwingParkNear, Radar, Rakete, Parkplatz), und alle
  // pruefen schon auf null. So faellt der Wiesen-X-Wing ueberall zugleich weg, ohne dass eine
  // dieser Stellen zu einer Baustelle wird. Der Platzhalter-Ring waere sonst spaeter nicht mehr
  // nachvollziehbar.
  return null;
}
// Die frueherer Suche nach einem freien Ringplatz — nicht mehr benutzt, siehe oben. Bleibt als
// Beleg stehen, wie der Platz gewuerfelt wurde (Salt 902/903), falls jemand ihn zurueckhaben will.
function _xwingLocalCalcAlt(cx, cz){
  const info = islandInfo(cx, cz);
  if(!info) return null;                             // kein Land
  if(cellRnd(cx, cz, 99) < 0.10) return null;        // Wolkenkratzer-Stadt: kein Platz dafuer
  const rwLen = Math.min(260, info.radius * 1.4);
  const hb = harborLocal(cx, cz);
  const list = islandBuildings(cx, cz) || [];
  const rl = rocketLocal(cx, cz);                    // die Startrampe muss auch frei bleiben
  const pk2 = parkLocal(cx, cz);                     // und das Vorfeld mit den Flugzeugen
  // Ring bei 45 % des Radius — deutlich innerhalb der Rakete (62 %), damit sich beide nicht
  // ins Gehege kommen. 16 Richtungen, Startwinkel gewuerfelt, deterministisch.
  const a0 = cellRnd(cx, cz, 902) * Math.PI * 2;
  for(let i = 0; i < 16; i++){
    const a = a0 + i * Math.PI * 2 / 16;
    const rr = info.radius * 0.45;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if(Math.abs(x) < 12 + XWP_CLR && Math.abs(z) < rwLen/2 + XWP_CLR) continue;   // Bahn frei
    if(Math.hypot(x - hb.x, z - hb.z) < HARBOR_SIZE*0.45 + XWP_CLR) continue;     // Hafen frei
    if(rl && Math.hypot(x - rl.x, z - rl.z) < PAD_R + XWP_CLR) continue;          // Rampe frei
    // Der Parkplatz ist tabu: dort stehen die Flugzeuge, in die man einsteigt. Ein zweiter X-Wing
    // mitten darin waere verwirrend, und er hat auf der Wiese ohnehin Platz.
    if(pk2 && inParkLocal(pk2, x, z, XWP_CLR)) continue;                          // Parkplatz frei
    let frei = true;
    for(const b of list){
      const hw = (b.type === 'hill') ? (30 + b.r1*50)
                                     : Math.max(5 + b.r1*11, 5 + b.r2*9)/2;
      if(Math.hypot(x - b.x, z - b.z) < hw + XWP_CLR){ frei = false; break; }
    }
    if(!frei) continue;
    // Nase quer zur Bahn stellen (yaw aus dem Winkel), damit er nicht wie ein Startender aussieht
    return { x, z, yaw: a + Math.PI/2 };
  }
  return null;   // nichts frei -> diese Insel hat keinen
}
// Bezugspunkt für alles, was die Welt nachzieht: Boden-Kacheln, exakte Bodenhöhe, Meer, Inseln.
// Normalerweise der Flieger — während der EVA aber der ASTRONAUT, denn dann steht der Flieger still.
// Ohne das richtete sich die Welt am Flieger aus, während man weglief: die Kachel unter den Füßen war
// nicht geladen, der Raycast traf nichts, und die Bodenhöhe kam von einer Stelle Hunderte Meter
// entfernt. Auf dem Mars mit seinem starken Relief blieb man deshalb hängen.
// Steht bewusst HIER, vor dem ersten Nutzer: `const` wird nicht gehoisted, ein Aufruf davor würde
// werfen. `eva` ist zu diesem Zeitpunkt noch nicht deklariert — das ist in Ordnung, weil worldFocus
// erst zur Laufzeit aufgerufen wird, aber `typeof` schützt gegen einen Aufruf während des Ladens.
const _wFocus = new THREE.Vector3();
function worldFocus(){
  if(typeof eva !== 'undefined' && eva) return _wFocus.copy(eva.group.position);
  return _wFocus.copy(state.pos);
}

// Pool aktiver Insel-Zellen: Key "cx,cz" -> Group (oder null wenn Wasser)
const islandCells = new Map();
function updateIslands() {
  // Bezugspunkt wie überall: während der EVA der Astronaut (siehe worldFocus).
  const F = worldFocus();
  const pcx = Math.round(F.x / CELL);
  const pcz = Math.round(F.z / CELL);
  const needed = new Set();
  // EINE Zelle pro Frame, nicht alle fehlenden. Das war die Ursache fuer "in der luft mit dem
  // mustang bei 500m hoehe zittert es komplett": beim Weiterfliegen um eine Zellbreite (850 m)
  // kommen 2*VIEW_CELLS+1 = 7 neue Zellen hinzu, und die wurden zusammen in einem Frame gebaut.
  // Beim Alpha Jet (900 km/h) passiert das alle 3,4 s, beim Mustang alle 4,4 s — jedes Mal ein Ruck.
  //
  // Eine Zelle ist teuer: Sandflaeche, Wiese mit eigener UV-Rechnung, Landebahn mit Markierungen,
  // 8 bis 18 Haeuser, Palmen, Huegel, Hafen, Feuerwehrboot, U-Boot — und auf dem Vorfeld geparkte
  // Flugzeuge, jedes ein Klon eines vollen GLB-Modells (Transall 79.302 Dreiecke, Canadair 55.006).
  //
  // Verteilt kostet es nichts: sieben Zellen brauchen 0,12 s, und die aeusserste liegt 2.550 m
  // entfernt — selbst der Alpha Jet braucht dafuer 10 s. Dieselbe Technik nutzen der Meeresboden
  // (SEABED_ROWS_PER_FRAME) und die Unterwasserzellen schon.
  //
  // WICHTIG ist die Reihenfolge: von innen nach aussen, damit die naechstgelegene Zelle zuerst
  // kommt. Eine Schleife von -VIEW_CELLS nach +VIEW_CELLS wuerde bei Rueckwaertsflug die ferne
  // Ecke zuerst bauen, waehrend vor der Nase noch nichts steht.
  let gebaut = 0;
  for(let ring = 0; ring <= VIEW_CELLS; ring++){
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        // Nur den RAND des Rings abarbeiten: das Innere kam in einer frueheren Runde dran.
        if(ring > 0 && Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        const cx = pcx + dx, cz = pcz + dz;
        const key = cx + ',' + cz;
        needed.add(key);
        if (!islandCells.has(key)) {
          if(gebaut >= 1) continue;      // erst im naechsten Frame weiter (siehe oben)
          const isl = buildIsland(cx, cz);
          if (isl) scene.add(isl);
          islandCells.set(key, isl); // null merken = keine Insel, nicht neu würfeln
          gebaut++;
        }
      }
    }
  }
  // nicht mehr benötigte Zellen entfernen
  let shared = null;     // erst sammeln, wenn wirklich etwas wegfaellt (siehe sharedGeos)
  for (const [key, isl] of islandCells) {
    if (!needed.has(key)) {
      if (isl) dropFromScene(isl, shared || (shared = sharedGeos()));
      islandCells.delete(key);
    }
  }
  updateCarriers(pcx, pcz, needed);
}
// Alle aktuell gebauten Inseln neu erzeugen (z.B. nachdem das Hafen-GLB spät geladen wurde).
// Alle gebauten Inseln VERWERFEN, damit updateIslands sie neu anlegt. Vorher baute diese Funktion
// sie gleich selbst neu — alle 49 Zellen in einem Frame, und das bei 13 Aufrufern, darunter jedes
// Ein- und Aussteigen. Jeder Aufruf war also genau der Ruckler, den updateIslands mit seinem
// Haeppchen-Aufbau gerade losgeworden ist.
//
// Nur wegwerfen ist billig, und der Wiederaufbau verteilt sich dann von selbst ueber 0,8 s — von
// innen nach aussen, die eigene Zelle also im naechsten Frame. Nebeneffekt: die Baulogik steht
// jetzt nur noch an EINER Stelle.
function refreshIslands(){
  const shared = sharedGeos();
  for(const [, isl] of islandCells) if(isl) dropFromScene(isl, shared);
  islandCells.clear();
}

// ---------- Flugzeugträger (schwimmende Landebahn) ----------
// Platzhalter-Deck (graues Rechteck), bis das echte GLB geladen ist. Baut ein sichtbares
// Flugdeck + Turm, damit man auch ohne/vor GLB landen kann.
function makeCarrier(info){
  const g = new THREE.Group();
  if(fordTemplate){
    g.add(fordTemplate.clone(true));
  } else {
    // Fallback: einfacher grauer Rumpf + Deck auf Deckhöhe. Der Rumpf reicht vom Tiefgang bis zum
    // Deck, liegt also wie das echte Modell IM Wasser statt darauf (siehe FORD_DRAFT).
    const hullH = fordDeckY + FORD_DRAFT;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(FORD_DECK_HALF_X*2+8, hullH, FORD_LEN),
      new THREE.MeshLambertMaterial({ color:0x555b63 }));
    hull.position.y = fordDeckY - hullH/2; g.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(FORD_DECK_HALF_X*2, 1.5, FORD_LEN),
      new THREE.MeshLambertMaterial({ color:0x3a3f45 }));
    deck.position.y = fordDeckY; g.add(deck);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(8,14,18),
      new THREE.MeshLambertMaterial({ color:0x6a7078 }));
    tower.position.set(FORD_DECK_HALF_X-4, fordDeckY+7, FORD_LEN*0.28); g.add(tower);
  }
  g.position.set(info.wx, 0, info.wz);
  g.rotation.y = info.rot;
  return g;
}
const carrierCells = new Map();   // Key "cx,cz" -> Group (oder null)
function updateCarriers(pcx, pcz, needed){
  for(const key of needed){
    if(carrierCells.has(key)) continue;
    const [cx,cz] = key.split(',').map(Number);
    const info = carrierInfo(cx, cz);
    const grp = info ? makeCarrier(info) : null;
    if(grp) scene.add(grp);
    carrierCells.set(key, grp);
  }
  for(const [key, grp] of carrierCells){
    if(!needed.has(key)){ if(grp) dropFromScene(grp); carrierCells.delete(key); }
  }
}
// Nach dem Nachladen des GLB: bereits gebaute Platzhalter-Träger durch echtes Modell ersetzen.
function refreshCarriers(){
  for(const [key, grp] of carrierCells){
    if(!grp) continue;
    const [cx,cz] = key.split(',').map(Number);
    const info = carrierInfo(cx, cz);
    dropFromScene(grp);
    const ng = info ? makeCarrier(info) : null;
    if(ng) scene.add(ng);
    carrierCells.set(key, ng);
  }
}

// ---------- Handelsschiffe auf dem Meer ----------
// Vier echte Schiffe fahren langsam ihre Bahnen über das offene Meer: Kreuzfahrtschiff, Liberty-
// Frachter, Containerschiff und ein Großsegler. Sie sind KEINE Kulisse, sondern feste Hindernisse
// (siehe hitsSeaShip) — wer hineinfliegt, stürzt ab, genau wie an einem Berg oder am Trägerrumpf.
//
// Größen zueinander maßstäblich, an den echten Vorbildern:
//   Containerschiff 300 m (Panamax-Klasse), Kreuzfahrtschiff 250 m, Liberty-Frachter 135 m
//   (die historische Länge dieser Baureihe), Großsegler 90 m Rumpflänge.
// Der Flugzeugträger im Spiel ist 280 m lang, die Schiffe liegen also in derselben Größenordnung.
//
// Die WASSERLINIE wurde für jedes Modell einzeln ausgemessen (Höhe, ab der der Rumpf seine volle
// Breite erreicht, jeweils mittschiffs — Bug und Heck sind immer schmal und verfälschen das).
// Angegeben in Prozent der Schiffslänge, weil die Modelle völlig verschiedene Eigenmaßstäbe haben
// (0,14 bis 27.000 Einheiten). Ohne diese Werte schwimmt ein Schiff sichtbar obenauf oder säuft ab.
// Maßgeblich ist der TIEFGANG DES VORBILDS, nicht eine am Modell gemessene Breitenregel — mit der
// habe ich mich zweimal in die Irre führen lassen:
//   Panamax-Container 300 m -> 13 m (der Rumpf gibt nur 4,2 her)  ·  Kreuzfahrtschiff 250 m -> 8 m
//   Liberty-Frachter 135 m -> 8,2 m (27 ft der Baureihe)          ·  Großsegler 90 m -> 5 m
// Daraus die Werte hier: 3,20 % · 6,07 % · 2,86 % · 5,56 %.
// Beim Kreuzfahrtschiff ist der Rumpf unter der Wasserlinie GAR NICHT modelliert (gemessen: nur
// 0,5 % der Fläche zeigt nach unten, das Modell ist dort abgeschnitten) — deshalb der kleine Wert.
// Zwei Werte sind nachträglich korrigiert, weil die 92-%-Breitenregel dort in die Irre führte:
//  · Container: erst stand seine Schraube über Wasser (tiefster Heckpunkt +0,58), dann schwebte er
//    sichtbar — sein ganzer roter Unterwasserrumpf war zu sehen. Ein Panamax-Schiff dieser Größe hat
//    rund 13 m Tiefgang; so tief geht es nicht, weil sein Rumpf nur bis y = -4,38 modelliert ist.
//    2,86 % holen 8,6 m heraus und nutzen den Rumpf fast vollständig aus (4,20 von 4,38 m).
//  · Segler: seine breiteste Stelle mittschiffs liegt bei y = -0,11, das ist das SCHANZKLEID. Sein
//    Deck stand damit praktisch im Wasser, während Back und Poop reichlich Luft hatten. Mit 6,00 %
//    hat er 3,74 m Freibord — nötig, weil er als kürzestes der vier Schiffe voll mit der Welle
//    schwingt UND nickt: bei 1,89 m tauchte sein Deck im Zusammenspiel von Wellenberg und Nicken um
//    1,08 m ein. Sein tiefster Heckpunkt (-9,03) bleibt trotzdem weit unter Wasser.
// rot180 dreht ein Modell, das gegen die Fahrtrichtung gebaut ist — beim Kreuzfahrtschiff und beim
// Liberty-Frachter nötig, beim Container NICHT.
// Bei Kastenrümpfen taugt keine gemessene Regel: Container und Kreuzfahrtschiff sind fast überall
// gleich breit, und die Brücke steht auch nicht zuverlässig am Heck (bei modernen Containerschiffen
// sitzt sie mittschiffs, damit vor ihr mehr Container gestapelt werden können — genau so ist dieses
// Modell gebaut). Ich habe den Container deshalb erst falsch gedreht. Wer hier etwas ändert:
// im Spiel nachsehen, nicht rechnen.
const SHIP_TYPES = [
  { key:'cruise',    glb:()=>window.CRUISE_GLB,    len:250, wl:0.0320, spd:5.5, sym:'🛳️', rot180:true },
  // rot180: das Modell zeigt mit dem Bug nach hinten — gemessen war die Breite vorne 16,5 und hinten
  // 15,0, also lief die schmale Seite falsch herum. Es fuhr sichtbar rueckwaerts.
  { key:'liberty',   glb:()=>window.LIBERTY_GLB,   len:135, wl:0.0607, spd:4.5, sym:'🚢', rot180:true },
  { key:'container', glb:()=>window.CONTAINER_GLB, len:300, wl:0.0286, spd:5.0, sym:'🚢' },
  { key:'sail',      glb:()=>window.EMPTY_GLB,     len:90,  wl:0.0556, spd:3.0, sym:'⛵' },
  // U-Boot (submarine by Helindu): faehrt langsam und TAUCHT im Wechsel — aufgetaucht liegt es auf
  // seiner Wasserlinie, getaucht ist der Rumpf ganz weg und nur die Turmspitze steht heraus.
  //
  // AUSGEMESSEN MIT NODE-TRANSFORMATIONEN (C:/tmp, 34.422 Punkte). Das ist der Kern: die erste
  // Messung las nur die Accessor-min/max, also die ROHKOORDINATEN der Meshes, ohne die
  // Transformationen der Nodes, in denen sie haengen. Dabei kam 23,67 x 3,61 x 4,01 heraus — die
  // echte Ausdehnung ist 1476 x 361 x 471. Faktor 62 daneben, und damit war jedes daraus
  // abgeleitete Mass falsch. Wer hier nachmisst: Node-Matrizen aufmultiplizieren, sonst misst man
  // ein Modell, das es nicht gibt.
  //
  // Auf 95 m Spiellaenge (Faktor 95/1476,4 = 0,0643) ist das Modell 30,3 m hoch und besteht aus
  // vier Teilen uebereinander — der Aufbau ist NICHT "Rumpf plus Turm":
  //    0,0 ..  4,6 m   Tiefenruder und Schraube (ragen UNTER den Druckkoerper)
  //    4,6 .. 17,6 m   Druckkoerper, 13,0 m dick, breiteste Stelle 23,2 m auf halber Hoehe
  //   15,9 .. 22,9 m   Turm, 7,0 m hoch
  //   22,9 .. 30,3 m   Periskop und Antennen
  // Das Rumpf-DECK liegt also bei 17,6 m, nicht bei 10,1 m (dort ist nur der dickste Querschnitt).
  //
  // wl 0,1537 senkt das Modell um 14,6 m: aufgetaucht stehen 3,0 m Rumpf ueber Wasser, also 23 %
  // des Durchmessers — ein aufgetauchtes U-Boot liegt fast auf der Wasserlinie (echt 20 bis 25 %),
  // anders als ein Frachter. Vorher stand wl auf 0,060, was aus der 62-fach falschen Messung kam:
  // es senkte nur 5,7 m, das Deck lag 11,9 m hoch und der halbe Druckkoerper schwebte ueber dem
  // Wasser — gemeldet als „im moment sind es etwa 2/3 des rumpfen".
  //
  // subDive ist der Tauchweg, subPeriod die Dauer eines ganzen Zyklus (auf und ab).
  //
  //                  aufgetaucht   getaucht
  //   Rumpfdeck          3,0 m      -2,8 m   -> Rumpf 2,8 m unter Wasser, ganz verschwunden
  //   Turmfuss           1,3 m      -4,5 m
  //   Turmspitze         8,3 m       2,5 m   -> 2,5 m Turm bleiben stehen (36 % von 7,0 m)
  //   Antenne (= top)   15,7 m       9,9 m   -> Kollisionsgrenze bleibt positiv
  //
  // Der Weg MUSS deutlich groesser sein als die Duenung, sonst sieht man ihn nicht: die schwankt um
  // +/-1,6 m, also 3,2 m Hub. 5,8 m sind das 1,8-fache. Zusammen mit der neuen Wasserlinie ist der
  // Wechsel jetzt so auffaellig wie moeglich: der ganze Rumpf taucht weg, statt sich um ein Drittel
  // zu heben und zu senken.
  //
  // 26 s Zyklus: eine halbe Periode (einmal ganz runter) dauert 13 s, ein Anflug 15 bis 30 s — man
  // sieht also mindestens eine vollstaendige Bewegung. 5,8 m in 13 s sind 0,45 m/s im Mittel, mit
  // der smoothstep-Spitze rund 0,7 m/s. Ein echtes U-Boot taucht mit 0,5 bis 1 m/s: passt sogar.
  //
  // Das Kollisionsband (y -2 bis 3 in loadShip) liegt damit auf Modellhoehe 12,6 bis 17,6 m — das
  // ist der obere Druckkoerper direkt unter dem Deck, also der richtige Umriss fuer ein Boot, das
  // daneben faehrt. Vorher traf das Band die Ruder unter dem Rumpf.
  //
  // Tempo 4,0 m/s = 14,4 km/h. Vorher 1,8 (6,5 km/h) — das war zwar Fahrt, sah aber wie Stillstand
  // aus: bei 95 m Laenge brauchte es 53 s fuer eine eigene Schiffslaenge, und ohne Bugwelle als
  // Bezug fehlt jeder Anhaltspunkt. Jetzt sind es 24 s, also 2,5 Laengen pro Minute — sichtbar
  // unterwegs, ohne zu huschen. Damit liegt es zwischen Grosssegler (10,8 km/h) und Liberty-Frachter
  // (16,2), und das ist immer noch untertrieben: ein echtes U-Boot faehrt aufgetaucht 12-20 kn,
  // also 22-37 km/h. spawnSeaShips streut jeden Wert um +/-20 %, hier also 11,5 bis 17,3 km/h.
  // Fuer die Ausweichlogik ist das Tempo gleichgueltig: bei Land voraus (47,5 m = halbe Rumpflaenge)
  // haelt das Schiff an und dreht nur, statt weiterzufahren — bei 0,08 m Weg pro Frame ist die
  // Vorausschau unabhaengig von der Geschwindigkeit reichlich.
  { key:'sub',       glb:()=>window.SUBMARINE_GLB, len:95,  wl:0.1537, spd:4.0, sym:'🛥️',
    subDive:5.8, subPeriod:26 },
];
// Wie viele Schiffe gleichzeitig um den Spieler herum fahren, und in welchem Ring. Das Meer soll
// belebt wirken, ohne dass man ständig ausweichen muss.
//
// 10 und nicht 7, weil spawnSeaShips die Typen per Modulo verteilt (SHIP_TYPES[i % 5]): mit 7 bekamen
// cruise und liberty je zwei, container, sail und das U-BOOT aber nur eines. Ein einzelnes U-Boot, das
// langsam faehrt und die halbe Zeit getaucht ist, findet man kaum — gemeldet als „ich habe noch keines
// gesehen". Mit 10 hat jeder der fuenf Typen genau zwei.
//
// Der Platz reicht: der Spawn-Ring (1.200 bis 2.400 m) hat 13,6 km², die zehn Schiffe belegen mit
// ihren SHIP_CLEAR-Abstandsringen zusammen 1,5 km² — also 11 % Auslastung. placeSeaShip probiert
// 24 Stellen und verschiebt den Versuch sonst auf spaeter, findet also zuverlaessig Platz.
const SHIP_COUNT     = 10;
const SHIP_SPAWN_MIN = 1200;    // näher als das taucht keines neu auf (kein Erscheinen vor der Nase)
// Beide Werte waren GROESSER als das Meeresgitter reicht (SEA_SIZE/2 = 3.000 m), und das Gitter ist
// quadratisch: quer zur Kante endet das Wasser schon bei 3.000 m. Gemessen (C:/tmp/edge.js) lagen
// 45,9 % aller moeglichen Schiffsplaetze GANZ OHNE gerendertes Wasser — ein Schiff nimmt seine Hoehe
// aus der Wellenformel und schwebte dort sichtbar in der Luft, mit dem gesamten schwarzen
// Unterwasserrumpf frei. Genau das zeigte der Screenshot.
// 2.400 m laesst auch quer zur Gitterkante Rand, 2.900 m gibt beim Recyceln Luft und bleibt drin.
const SHIP_SPAWN_MAX = 2400;
const SHIP_DESPAWN   = 2900;    // weiter weg wird es recycelt (bleibt INNERHALB des Meeresgitters)
const SHIP_TURN      = 0.02;    // rad/s: ganz sachte Kursänderungen, ein Frachter dreht träge
const SHIP_CLEAR     = 260;     // so weit muss ein Platz von Insel/Träger/anderen Schiffen frei sein
// Wie stark ein Schiff auf die Dünung reagiert — abhängig von SEINER LÄNGE, nicht als fester Wert.
// Ein 90-m-Segler arbeitet in der See sichtbar mit, ein 300-m-Containerschiff überbrückt mehrere
// Wellen und liegt fast ruhig. Mit einem Wert für alle wäre entweder der Segler zu starr oder der
// Frachter zu zappelig gewesen.
// Bezugslänge 120 m: darunter reagiert es voll, darüber im Verhältnis weniger. Gemessene Neigungen
// mit AMP 3,0 — Segler 2,09° · Liberty 1,29° · Kreuzfahrtschiff 0,22° · Container 0,10°, und zum
// Vergleich Feuerwehrboot 3,13° und Schlauchboot 3,81°. Die Staffelung von klein nach groß ergibt
// sich damit von allein, ohne Werte pro Schiff.
const SHIP_BOB_REF   = 120;     // Länge (m), bis zu der ein Schiff der Welle voll folgt
const SHIP_HEAVE_MAX = 0.55;    // so weit hebt sich höchstens eines mit der Welle (kurze Schiffe)
function shipWaveFactor(len){ return Math.min(1, SHIP_BOB_REF / Math.max(1, len)); }
const shipTemplates = {};       // key -> normiertes Modell (Wasserlinie auf y = 0)
const shipHalf = {};            // key -> {hl, hw, top}: halbe Länge/Breite und Höhe über Wasser
const seaShips = [];            // {key, group, x, z, heading, spd, len}
function preloadSeaShips(){
  if(!THREE.GLTFLoader) return;
  for(const def of SHIP_TYPES){
    const src = def.glb();
    if(!src) continue;
    const gl = new THREE.GLTFLoader();
    const b64 = src.split(',')[1];
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    gl.parse(bytes.buffer, '', (gltf)=>{
      const obj = gltf.scene;
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3(); box.getSize(size);
      // Auf die Ziellänge normieren. Die Längsachse ist je Modell verschieden (Container liegt auf X,
      // die anderen auf Z) — die größere der beiden waagerechten Achsen ist immer die Länge.
      const longest = Math.max(size.x, size.z);
      obj.scale.setScalar(def.len / Math.max(0.001, longest));
      // ZUERST drehen, DANN zentrieren — in dieser Reihenfolge, und das ist wichtig:
      // rotation.y dreht um den OBJEKTURSPRUNG, nicht um den Modellmittelpunkt. Zentriert man vorher,
      // hebt die Drehung das wieder auf. Gemessen stand der Container-Rumpf danach bei
      // x = -61,7 .. -19,4, also 40 m neben seiner Kollisionshülle (hw = 21,2 um x = 0): 86 % seiner
      // Punkte lagen außerhalb, davon 414 direkt an der Wasserlinie. Genau dort fährt ein Boot
      // hindurch, ohne etwas zu berühren — und genau das war zu sehen.
      // Längsachse auf Z bringen (Nase auf -Z, wie bei den Flugzeugen). Beim Container liegt sie auf X.
      if(size.x > size.z) obj.rotation.y = Math.PI/2;
      // Einzelne Modelle sind gegen die Fahrtrichtung modelliert -> um 180 Grad drehen.
      if(def.rot180) obj.rotation.y += Math.PI;
      obj.updateMatrixWorld(true);
      const box2 = new THREE.Box3().setFromObject(obj);
      const c = new THREE.Vector3(); box2.getCenter(c);
      obj.position.x -= c.x; obj.position.z -= c.z;
      // Wasserlinie auf y = 0: der ausgemessene Anteil der Länge über der Modell-Unterkante.
      obj.position.y -= box2.min.y + def.len * def.wl;
      const wrap = new THREE.Group();
      wrap.add(obj);
      shipTemplates[def.key] = wrap;
      wrap.updateMatrixWorld(true);
      const box4 = new THREE.Box3().setFromObject(wrap);
      // Halbmaße aus den TATSÄCHLICHEN Grenzen, nicht aus der Größe: liegt die Box (etwa wegen einer
      // unsymmetrischen Aufbaustruktur) nicht genau um 0, deckt die größere Seite beides ab. Sonst
      // steht ein Teil des Schiffs außerhalb seiner eigenen Kollisionshülle.
      // Die Huelle kommt aus dem RUMPF AN DER WASSERLINIE, nicht aus der Gesamtbox. Die Gesamtbox
      // enthaelt Masten, Rahen, Kraene und Bugspriet — und der Rumpf liegt darin ASYMMETRISCH.
      // Gemessen (C:/tmp/offset.js) stand beim Grosssegler die Barriere bei z = +-49 m, der Rumpf
      // aber nur bei z = -18,2 .. +34,7: hinten 30,8 m unsichtbare Wand, vorn 14,3 m. Genau das
      // ergibt "von einer Seite kann ich durchfahren, auf der anderen ist weit davor Schluss".
      // Quer war es dasselbe: Huelle +-18,1 m gegen einen 8,3 m breiten Rumpf (das sind die Rahen).
      // Gemessen wird in einem Band um die Wasserlinie — dort, wo ein Boot faehrt. Was darueber
      // aufragt, zaehlt weiter fuer die FLIEGER: dafuer bleibt top die volle Hoehe.
      const hullMin = new THREE.Vector3( 1e30,  1e30,  1e30);
      const hullMax = new THREE.Vector3(-1e30, -1e30, -1e30);
      const _hv = new THREE.Vector3();
      const hullPts = [];                     // Rumpfpunkte im Band, fuer das Profil weiter unten
      wrap.traverse((o)=>{
        if(!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
        const pa = o.geometry.attributes.position;
        for(let i=0;i<pa.count;i++){
          _hv.fromBufferAttribute(pa, i); o.localToWorld(_hv);
          if(_hv.y < -2 || _hv.y > 3) continue;         // nur das Band um die Wasserlinie
          if(_hv.x<hullMin.x)hullMin.x=_hv.x; if(_hv.x>hullMax.x)hullMax.x=_hv.x;
          if(_hv.z<hullMin.z)hullMin.z=_hv.z; if(_hv.z>hullMax.z)hullMax.z=_hv.z;
          hullPts.push(_hv.x, _hv.z);
        }
      });
      // Nichts im Band gefunden (darf nicht vorkommen — ein fehlendes Hindernis waere aber schlimmer
      // als ein zu grosses) -> auf die Gesamtbox zurueckfallen.
      const okHull = hullMin.x < hullMax.x && hullMin.z < hullMax.z;
      // HALBBREITEN-PROFIL: die Grenze folgt der Rumpfform statt einem Rechteck. Der Rumpf wird in
      // SHIP_SLICES Scheiben laengs geteilt, je Scheibe die groesste halbe Breite. Am spitzen Bug
      // wird die Sperre damit schmal, wie der Rumpf selbst — gemessen sind am Rechteck 20 bis 26 %
      // der Sperrzone ueberfluessig (C:/tmp/form.js).
      // Zwei Dinge sind wichtig:
      //  - Leere Scheiben werden aus den Nachbarn GEFUELLT. Die Vertexdichte ist ungleich, einzelne
      //    Scheiben treffen gar keinen Punkt — ohne Fuellen waere dort ein Loch im Rumpf, durch das
      //    man hindurchfaehrt. Das ist genau die Falle bei diesem Ansatz.
      //  - Jede Scheibe bekommt das MAXIMUM ihrer Nachbarschaft, nie weniger als der Rumpf breit ist.
      //    Zu breit ist harmlos (etwas Wasser gesperrt), zu schmal laesst einen durch den Stahl.
      let prof = null;
      if(okHull){
        const pz0 = hullMin.z, pzL = hullMax.z - hullMin.z;
        const raw = new Float32Array(SHIP_SLICES);
        for(let i=0;i<hullPts.length;i+=2){
          const px = hullPts[i], pz = hullPts[i+1];
          let s = Math.floor((pz - pz0) / pzL * SHIP_SLICES);
          if(s < 0) s = 0; else if(s >= SHIP_SLICES) s = SHIP_SLICES - 1;
          const w = Math.abs(px - (hullMax.x + hullMin.x)/2);
          if(w > raw[s]) raw[s] = w;
        }
        // Leere Scheiben aus den naechsten belegten Nachbarn fuellen (siehe oben).
        prof = new Float32Array(SHIP_SLICES);
        for(let s=0;s<SHIP_SLICES;s++){
          if(raw[s] > 0){ prof[s] = raw[s]; continue; }
          let l = -1, r = -1;
          for(let k=s-1;k>=0;k--) if(raw[k] > 0){ l = raw[k]; break; }
          for(let k=s+1;k<SHIP_SLICES;k++) if(raw[k] > 0){ r = raw[k]; break; }
          prof[s] = Math.max(l, r, 0);
        }
        // Und jede Scheibe auf das Maximum mit ihren direkten Nachbarn ziehen: so entsteht keine
        // Einschnuerung zwischen zwei Stuetzstellen, durch die eine Bootsnase schluepfen koennte.
        const glatt = new Float32Array(SHIP_SLICES);
        for(let s=0;s<SHIP_SLICES;s++)
          glatt[s] = Math.max(prof[Math.max(0,s-1)], prof[s], prof[Math.min(SHIP_SLICES-1,s+1)]);
        prof = glatt;
      }
      shipHalf[def.key] = okHull ? {
        // Halbmasse UND Mittenversatz: der Rumpf sitzt nicht zwangslaeufig um 0. Ohne den Versatz
        // laege die Huelle wieder auf der falschen Seite (Segler: Rumpfmitte bei z = +8,3).
        hl: (hullMax.z - hullMin.z)/2,
        hw: (hullMax.x - hullMin.x)/2,
        cz: (hullMax.z + hullMin.z)/2,
        cx: (hullMax.x + hullMin.x)/2,
        prof,
        top: box4.max.y } : {
        hl: Math.max(Math.abs(box4.min.z), Math.abs(box4.max.z)),
        hw: Math.max(Math.abs(box4.min.x), Math.abs(box4.max.x)),
        cz: 0, cx: 0,
        top: box4.max.y };
      // Schon fahrende Platzhalter dieses Typs gegen das echte Modell tauschen.
      for(const sh of seaShips) if(sh.key === def.key) refreshSeaShip(sh);
      // Und die Inseln neu bauen, sobald das U-BOOT-Modell da ist: an jedem Strand liegt eines als
      // Kulisse (siehe buildIsland), und die Inselzellen der ersten Sekunden wurden ohne es gebaut.
      // Ohne diesen Aufruf blieb der Platz dauerhaft leer — im laufenden Spiel nachgemessen, genau
      // wie es preloadBoat fuer das Kai-Feuerwehrboot loest.
      // Auch 'liberty' zaehlt: daraus entstehen die GROSSFUND-Wracks am Meeresboden, und
      // updateUwCells merkt eine Zelle absichtlich nicht als leer, solange die Vorlagen fehlen —
      // die Zellen sind dann aber schon gebaut und muessen einmal fallen.
      if(def.key === 'sub') refreshIslands();
      // 'sail' zaehlt seit dieser Runde mit: aus ihm entstehen in tiefem Wasser ebenfalls
      // Grossfund-Wracks (siehe wreckInfo1), und die Zellen der ersten Sekunden wurden ohne das
      // Modell gebaut.
      if(def.key === 'liberty' || def.key === 'sail') clearUwCells();
    }, (err)=>{ console.warn('Schiff-GLB Ladefehler ('+def.key+'):', err); });
  }
}
// Ersatzkörper, solange ein GLB noch lädt: ein grauer Kasten in den richtigen Maßen. Besser als
// nichts — sonst wäre dort ein unsichtbares Hindernis, an dem man ohne Grund abstürzt.
const shipStubMat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
function makeSeaShipBody(key){
  const def = SHIP_TYPES.find(d=>d.key===key);
  if(shipTemplates[key]) return shipTemplates[key].clone(true);
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(def.len*0.14, def.len*0.06, def.len), shipStubMat);
  hull.position.y = def.len*0.02; g.add(hull);
  return g;
}
function refreshSeaShip(sh){
  if(sh.group) scene.remove(sh.group);
  sh.group = makeSeaShipBody(sh.key);
  sh.group.position.set(sh.x, 0, sh.z);
  sh.group.rotation.y = sh.heading;
  scene.add(sh.group);
  const h = shipHalf[sh.key];
  sh.hl = h ? h.hl : sh.len/2;
  sh.hw = h ? h.hw : sh.len*0.07;
  // Mittenversatz des Rumpfes im Schiffssystem (siehe shipHalf): die Kollisionsmitte ist NICHT
  // zwangslaeufig der Modellursprung. Alles, was in Schiffskoordinaten rechnet, muss ihn abziehen.
  sh.cz = h ? (h.cz || 0) : 0;
  sh.cx = h ? (h.cx || 0) : 0;
  sh.prof = h ? (h.prof || null) : null;      // Halbbreiten-Profil (siehe shipHalf), null = Rechteck
  sh.top = h ? h.top : sh.len*0.08;
  // Der Wert bei AUFGETAUCHTEM Boot, von dem der Tauchweg abgezogen wird (siehe updateShipsSea).
  // Muss hier mitgesetzt werden: refreshSeaShip laeuft auch, wenn ein GLB nachtraeglich fertig laedt,
  // und sh.top aendert sich dabei von der Schaetzung auf den vermessenen Wert.
  sh.top0 = sh.top;
}
// Ist der Platz für ein Schiff dieser Länge frei? Ein 300 m langes Schiff braucht viel Wasser:
// keine Insel (auch nicht deren Strand), kein Träger, kein anderes Schiff, kein Hafen.
function seaShipSpotFree(x, z, len, skip){
  const r = len*0.5 + SHIP_CLEAR;
  // Inseln und Träger im Umfeld prüfen — in Zellenschritten, weil die Welt so aufgebaut ist.
  const span = Math.ceil(r / CELL) + 1;
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for(let dz=-span; dz<=span; dz++) for(let dx=-span; dx<=span; dx++){
    const info = islandInfo(pcx+dx, pcz+dz);
    if(info && Math.hypot(x-info.wx, z-info.wz) < info.radius*BEACH_FACTOR + len*0.5 + 120) return false;
    const car = carrierInfo(pcx+dx, pcz+dz);
    if(car && Math.hypot(x-car.wx, z-car.wz) < FORD_LEN*0.5 + len*0.5 + 120) return false;
  }
  for(const o of seaShips){
    if(o === skip) continue;
    if(Math.hypot(x-o.x, z-o.z) < (len + o.len)*0.5 + SHIP_CLEAR) return false;
  }
  return true;
}
// Ein Schiff (neu) irgendwo im Ring um den Bezugspunkt aussetzen. Gibt false zurück, wenn kein
// freier Platz gefunden wurde — dann wird es diesen Frame einfach nicht gesetzt und später erneut
// versucht, statt es in eine Insel zu stellen.
function placeSeaShip(sh, fx, fz){
  for(let tries=0; tries<24; tries++){
    const a = Math.random()*Math.PI*2;
    const d = SHIP_SPAWN_MIN + Math.random()*(SHIP_SPAWN_MAX-SHIP_SPAWN_MIN);
    const x = fx + Math.cos(a)*d, z = fz + Math.sin(a)*d;
    if(!seaShipWaterFor(sh, x, z)) continue;
    if(!seaShipSpotFree(x, z, sh.len, sh)) continue;
    sh.x = x; sh.z = z;
    sh.heading = Math.random()*Math.PI*2;
    if(sh.group){ sh.group.position.set(x, 0, z); sh.group.rotation.y = sh.heading; }
    return true;
  }
  return false;
}
function spawnSeaShips(){
  const F = worldFocus();
  for(let i=0; i<SHIP_COUNT; i++){
    const def = SHIP_TYPES[i % SHIP_TYPES.length];
    const sh = { key:def.key, group:null, x:0, z:0, heading:0, len:def.len,
                 spd:def.spd*(0.8+Math.random()*0.4), placed:false,
                 // Tauchweg und -dauer nur beim U-Boot gesetzt (siehe SHIP_TYPES); bei allen anderen
                 // bleibt dive 0, und der Tauch-Block in updateShipsSea laeuft dann gar nicht.
                 dive:def.subDive || 0,
                 divePeriod:(def.subPeriod || 30) * (0.85 + Math.random()*0.3) };
    refreshSeaShip(sh);
    sh.placed = placeSeaShip(sh, F.x, F.z);
    if(!sh.placed && sh.group){ scene.remove(sh.group); sh.group = null; }
    seaShips.push(sh);
  }
}
function clearSeaShips(){
  for(const sh of seaShips) if(sh.group) scene.remove(sh.group);
  seaShips.length = 0;
}
// ---- Raketenstarts auf den Inseln --------------------------------------------------------
// Eine Rakete startet, sobald man ihr auf unter LAUNCH_DIST nahe kommt. Sie steigt beschleunigt,
// und ab der Weltraumgrenze ist sie weg — dort begegnet man ihr als eines der Raumschiffe
// (SHIP_DEFS-Eintrag 'rocket'), genau wie Shuttle oder Falcon. Auf der leeren Rampe wächst nach
// REGROW_T Sekunden die nächste, damit die Insel nicht für immer kahl bleibt.
const ROCKET_A    = 9;       // m/s^2 — die echte Ariane 6 zieht anfangs ähnlich an
const ROCKET_VMAX = 900;     // m/s Deckel, sonst springt sie in einem Frame durchs halbe Bild
function updateRockets(dt){
  if(locale !== 'earth') return;      // Startrampen gibt es nur auf den Inseln
  const F = worldFocus();
  for(const [key, isl] of islandCells){
    if(!isl || !isl.userData.rocketCell) continue;
    const [cx, cz] = key.split(',').map(Number);
    const rl = rocketLocal(cx, cz);
    if(!rl) continue;
    const rs = rocketStateFor(cx, cz);
    const r = isl.userData.rocket;
    if(rs.phase === 'stand'){
      // Auslöser ist die Annäherung, gemessen in der Waagerechten zum Fuß der Rakete. So startet
      // sie auch, wenn man hoch darüber hinwegfliegt — dann sieht man sie von oben hochkommen.
      const d = Math.hypot(F.x - (isl.position.x + rl.x), F.z - (isl.position.z + rl.z));
      // Ohne geladenes Modell NICHT starten: buildIsland setzt rocketCell schon, solange die GLBs
      // noch laden. Sonst meldete das Spiel "Raketenstart" fuer eine Rakete, die niemand sieht —
      // und die Rampe blieb danach fuer immer leer, weil der Zustand schon weitergelaufen ist.
      if(d < LAUNCH_DIST && r){
        rs.phase = 'launch'; rs.v = 0;
        if(r && r.userData.flame) r.userData.flame.visible = true;
        // Bewusst OHNE Meldung: bei 1,5 km Startfenster geht auf einer Runde ueber mehrere Inseln
        // dauernd eine los, und ein Schriftzug bei jedem Start stand nur im Bild. Man sieht die
        // Rakete ja steigen — das ist die bessere Meldung.
      }
      continue;
    }
    if(rs.phase === 'launch'){
      // Ist die Insel inzwischen abgeraeumt und neu gebaut worden, waehrend die Rakete stieg, dann
      // gibt es ihre Gruppe nicht mehr (buildIsland setzt userData.rocket nur bei phase != gone,
      // und beim Neubau steht sie wieder unten). Sie zaehlt dann als weggeflogen — sonst blieb der
      // Zustand fuer immer auf 'launch' haengen und auf der Rampe wuchs nie wieder eine nach.
      if(!r){ rs.phase = 'gone'; rs.t = REGROW_T; continue; }
      rs.v = Math.min(ROCKET_VMAX, rs.v + ROCKET_A * dt);
      rs.y += rs.v * dt;
      if(r){
        r.position.y = ISLAND_Y + rs.y;
        // Flamme flackern lassen, wie es die Brände auf den Inseln auch tun (siehe fire.flames)
        const fg = r.userData.flame;
        if(fg) for(const fl of fg.children) fl.scale.y = 0.7 + Math.random()*0.6;
      }
      // Ab der Weltraumgrenze ist sie draußen. Sie wird ENTFERNT, nicht nur unsichtbar gemacht:
      // sonst bliebe ihre Geometrie in der Szene, und über rocketState stünde ihre
      // Kollisionshülle weiter im Weg.
      if(rs.y > SPACE_Y){
        rs.phase = 'gone'; rs.t = REGROW_T;
        if(r){ isl.remove(r); disposeTree(r); isl.userData.rocket = null; }
      }
      continue;
    }
    // 'gone': die Rampe steht leer, bis die nächste Rakete bereit ist.
    rs.t -= dt;
    if(rs.t <= 0){
      rs.phase = 'stand'; rs.y = 0; rs.v = 0;
      // Die Zelle wird nur AUSGETRAGEN, nicht hier neu gebaut: updateIslands sieht sie im selben
      // Frame als fehlend und baut sie mit seinem Budget von EINER Zelle pro Frame.
      //
      // Vorher stand hier ein synchrones buildIsland(cx, cz) — genau die Operation, die
      // updateIslands mit seinem Haeppchen-Aufbau entschaerft hat, hier aber ungebremst lief.
      // Gemeldet als "diese starten alle 1,5km. wenn man sehr schnell fliegt und es viele inseln
      // gibt passiert das sehr schnell hintereinander".
      //
      // GEMESSEN: 44 % der Inseln haben eine Rampe (0,333 je km^2, im Mittel alle 1,73 km eine).
      // Bei LAUNCH_DIST 1.500 m ist der Startkorridor 3.000 m breit, es laufen also 0,68 Rampen
      // pro Sekunde durch das Fenster (X-Wing), 0,36 beim Alpha Jet. Jede davon baut 99 s spaeter
      // (54 s Steigzeit + REGROW_T) eine ganze Insel neu: Sandflaeche, Wiese mit UV-Rechnung,
      // Landebahn, 8-18 Haeuser, Palmen, Huegel, Hafen und die Vorfeld-Flugzeuge.
      //
      // Ueber das Loeschen laeuft dieser Neubau durch dieselbe Drossel wie jede andere neue Zelle,
      // und mehrere gleichzeitig faellige Rampen koennen sich nicht mehr in einem Frame stapeln.
      dropFromScene(isl);
      islandCells.delete(key);
    }
  }
}
function updateShipsSea(dt){
  if(locale !== 'earth') return;
  if(!seaShips.length) spawnSeaShips();
  const F = worldFocus();
  for(const sh of seaShips){
    // Noch kein Platz gefunden (alles voll oder man steht mitten in einem Archipel)? Weiter versuchen.
    if(!sh.group){
      const tmp = { key:sh.key, len:sh.len, group:null };
      if(!placeSeaShip(tmp, F.x, F.z)) continue;
      sh.x = tmp.x; sh.z = tmp.z; sh.heading = tmp.heading;
      refreshSeaShip(sh);
      continue;
    }
    // Gemächlich Kurs halten, mit sachten Schlängeln — ein Frachter fährt nicht schnurgerade,
    // aber auch keine Kurven. Der Sinus über der Zeit gibt genau dieses langsame Wandern.
    sh.heading += Math.sin(seaTime*0.07 + sh.x*0.001) * SHIP_TURN * dt;
    const fx = -Math.sin(sh.heading), fz = -Math.cos(sh.heading);
    const nx = sh.x + fx*sh.spd*dt, nz = sh.z + fz*sh.spd*dt;
    // Vor dem Bug muss Wasser sein: geprüft wird eine halbe Schiffslänge voraus, sonst schiebt sich
    // ein 300-m-Schiff mit dem Bug in den Strand, bevor sein Mittelpunkt Land erreicht.
    const ax = nx + fx*sh.hl, az = nz + fz*sh.hl;
    if(seaShipWaterFor(sh, ax, az) && seaShipWaterFor(sh, nx, nz)){
      sh.x = nx; sh.z = nz;
    } else {
      // Land voraus -> abdrehen. Ein Schiff wendet langsam, also nur den Kurs ändern und diesen
      // Frame stehen bleiben. Über mehrere Sekunden dreht es sich sichtbar von der Küste weg.
      sh.heading += SHIP_TURN * 40 * dt;
    }
    // Zu weit weg -> an anderer Stelle im Ring wieder aussetzen (die Welt ist endlos, die Flotte
    // begleitet den Spieler wie der Flugverkehr).
    if(Math.hypot(sh.x - F.x, sh.z - F.z) > SHIP_DESPAWN) placeSeaShip(sh, F.x, F.z);
    sh.group.position.set(sh.x, 0, sh.z);
    sh.group.rotation.y = sh.heading;
    // Nicken in der Dünung — sehr wenig: ein 300-m-Schiff überbrückt mehrere Wellen und liegt ruhig.
    // Bezug ist die WELTposition (seaYAt), das Schiff sitzt nicht in der Gittermitte.
    const bowY  = seaYAt(sh.x + fx*sh.hl*0.7, sh.z + fz*sh.hl*0.7, dt);
    const stnY  = seaYAt(sh.x - fx*sh.hl*0.7, sh.z - fz*sh.hl*0.7, dt);
    const wf = shipWaveFactor(sh.len);
    sh.group.rotation.x = Math.atan2(bowY - stnY, sh.hl*1.4) * wf;
    // Höhe: ein kurzes Schiff hebt sich mit der Welle, ein langes bleibt nahe der Ruhewasserlinie —
    // bei ihm laufen die Wellen sichtbar am Rumpf hoch und runter, die Wasserlinie wandert also,
    // statt dass der ganze Rumpf mitschaukelt. Der Segler (90 m) schwingt mit, das 300-m-Contain-
    // erschiff praktisch nicht.
    sh.group.position.y = seaYAt(sh.x, sh.z, dt) * SHIP_HEAVE_MAX * wf;
    // ---- U-BOOT: langsam auf und ab tauchen. Der Sinus laeuft ueber subPeriod Sekunden, mit dem
    // eigenen x-Wert als Phase — so sind mehrere Boote nicht im Gleichschritt.
    //
    // Nur die HAELFTE des Sinus wird genutzt (0..1 statt -1..1): oben liegen 3,0 m Rumpf ueber
    // Wasser, unten ist der Rumpf 2,8 m tief weg und 2,5 m Turmspitze stehen noch heraus. Ganz
    // verschwinden soll es nicht, man soll es immer sehen (siehe subDive in SHIP_TYPES).
    //
    // Die Bewegung ist zusaetzlich abgeflacht (smoothstep): ein U-Boot verweilt oben und unten und
    // wechselt dazwischen zuegig, statt gleichmaessig durchzufahren wie ein Kolben.
    if(sh.dive){
      const t = 0.5 - 0.5*Math.cos(seaTime*(2*Math.PI/sh.divePeriod) + sh.x*0.0007);
      const g = t*t*(3 - 2*t);                       // smoothstep: langsam an den Enden
      sh.group.position.y -= sh.dive * g;
      // Getaucht liegt es ruhiger: die Duenung greift am Turm weniger an als am ganzen Rumpf.
      sh.group.rotation.x *= (1 - 0.7*g);
      // Die KOLLISIONS-Obergrenze sinkt mit: sonst bliebe ueber dem getauchten Boot eine unsichtbare
      // Wand stehen, an der man abstuerzt, wo nichts mehr ist. sh.top wird an vier Stellen gelesen
      // (hitsSeaShip, pushOutOfSeaShip, aiObstacleTopAt, aiShipAhead) — alle bekommen damit denselben
      // aktuellen Wert. sh.top0 ist der vermessene Wert bei aufgetauchtem Boot.
      sh.top = sh.top0 - sh.dive * g;
    }
  }
}
// Die Feuerwehrboote am Kai auf der Wasserlinie halten. Sie stecken in der Inselzelle und wurden beim
// Bauen einmal auf -BOAT_DRAFT gesetzt — also FEST, waehrend die Duenung um bis zu 1,6 m schwankt
// (AMP 3,0). Bei einem Wellenberg lag die Wasseroberflaeche damit 2 m ueber dem Kiel und nur der
// Aufbau schaute heraus: „das geparkte boot liegt unter der wasser linie".
//
// Gerechnet wie beim fahrenden Boot (stepBoat: seaSurfaceY - BOAT_DRAFT), nur mit seaYAt, weil das
// Boot nicht in der Gittermitte liegt. Die Inselgruppe steht auf y = 0, der Wert gilt also direkt.
// Dazu ein leichtes Nicken mit der Welle, damit es lebt statt bretteben zu liegen.
function updateHarborBoats(dt){
  if(locale !== 'earth') return;
  for(const [, isl] of islandCells){
    if(!isl) continue;
    const fb = isl.userData.harborBoat;
    if(!fb) continue;
    const wx = isl.position.x + fb.position.x, wz = isl.position.z + fb.position.z;
    // Es liegt AM STRAND: das Heck im Sand, der Bug im Wasser. Deshalb die Inselhoehe als Untergrenze
    // und die Wasserlinie darueber — sonst versaenke das Heck im Sand, wenn die Welle tief steht.
    // Mit reinem seaYAt lag es bei Ebbe unter dem Strand und bei Flut darueber.
    fb.position.y = Math.max(ISLAND_Y - BOAT_DRAFT*0.6, seaYAt(wx, wz, dt) - BOAT_DRAFT);
    // Leicht nach vorn geneigt, weil das Heck auf dem Sand aufliegt und der Bug im Wasser schwimmt —
    // so sieht man, dass es an den Strand gezogen wurde. Der Bug liegt bei -Z im gedrehten System.
    // Dazu die Duenung am Bug, damit es lebt: sie hebt die Nase, das Heck bleibt liegen.
    //
    // Der Faktor ist NICHT frei gewaehlt, er ist Nenner/Hebel = 14/7 = 2,0. Damit folgt der Bug der
    // Welle genau: 7*atan2(d,14)*fak ist fuer kleine Winkel 0,5*fak*d, und das ist d, wenn fak = 2.
    // Der Bug SCHWIMMT dann mit, statt in der Duenung zu stampfen — gemessen bleibt sein Abstand zur
    // Wasserlinie konstant bei -0,90 m, waehrend er bei 0,35 zwischen -0,99 und -0,28 m schwankte.
    //
    // Vorher stand hier 0,35, und das war fuer die UNGEDAEMPFTE Duenung kalibriert. Seit dem
    // Ufer-Auslauf (SHORE_FADE_W) schwingt das Wasser am Kai nur noch mit 8 %, das Nicken war damit
    // von 7,82 auf 0,84 Grad gefallen — 4 cm Bugbewegung, also praktisch bretteben. Mit 2,0 sind es
    // 59 cm Bug-Hub. Das Heck bleibt dabei 0,47 m im Sand, rutscht also nicht heraus.
    const fbx = -Math.sin(fb.rotation.y), fbz = -Math.cos(fb.rotation.y);
    const bow = seaYAt(wx + fbx*7, wz + fbz*7, dt);
    fb.rotation.x = -0.035 + Math.atan2(bow - ISLAND_Y, 14) * 2.0;
  }
}
// ---------- Geparkte Flugzeuge nach Entfernung abschalten ----------------------------------------
// Das ist der Fix zu "ruckeln mit schnellen flugzeugen in allen hoehen, oder mit allen flugzeugen
// in grossen hoehen" — und zum Nachtrag "realistisch ist auch, das man mit volldampf tiefer als
// 120m fliegt".
//
// GEMESSEN wurde zuerst alles andere, und genau das ist der Punkt: die CPU-Posten sind ALLE klein.
// updateSea voll 2,70 ms, ein Meeresboden-Haeppchen mit Normalen 0,65 ms, die Sonden der KI-Flotte
// unter 0,10 ms, ein clone(true) eines GLB-Modells 0,07 ms, shoreFade 0,84 ms. Zusammen unter 5 ms
// von 16,67 — davon ruckelt nichts. Auch die verdaechtige Haeppchen-Grenze war es nicht: sieben
// neue Zellen brauchen 0,12 s, und selbst der X-Wing braucht 1,2 s je Zellbreite.
//
// Was bleibt, ist die Zahl der DREIECKE in der Szene. 27 Inseln in Sicht (VIEW_CELLS 3 = 49 Zellen,
// davon rund 55 % mit Insel), je rund 10 Vorfeldplaetze, je Modell im Mittel 43.135 Dreiecke:
// 11,6 Millionen Dreiecke nur fuer geparkte Flugzeuge. Die Vorfelder sind damit das schwerste
// Gepaeck der Welt — schwerer als Meer, Boden, Haeuser und Unterwasserwelt zusammen.
//
// Und das erklaert BEIDE gemeldeten Faelle mit einer Ursache: schnell fliegen heisst, dass dieses
// Gepaeck im Sekundentakt aus- und eingeladen wird; hoch fliegen heisst, dass der Nebel (fog.far
// 3.000 m) weniger verdeckt und die Kamera flach ueber viele Vorfelder gleichzeitig blickt, statt
// dass die naechste Insel die dahinter verdeckt.
//
// PARK_LOD_D = 1200 m ist aus der Bildgroesse gerechnet, nicht geschaetzt: bei 27,1 m Spannweite,
// 60 Grad FOV und 1080p ist ein geparkter Flieger auf 1.200 m noch 21 px gross — gerade noch als
// Flugzeug erkennbar. Auf 1.700 m sind es 15 px und auf 2.550 m (Sichtrand) nur 10 px, also ein
// Fleck. Die Grenze bei 1.200 m spart 89 % dieser Dreiecke und nimmt nichts weg, was man als
// Flugzeug gesehen haette.
//
// Warum .visible und nicht Entfernen: visible = false ueberspringt Three.js beim Zeichnen samt
// aller Kinder, laesst die Klone aber stehen. Ein Entfernen und Neuaufbauen waere genau der
// Ruckler, den updateIslands mit seinem Haeppchen-Aufbau gerade losgeworden ist.
//
// Gemessen wird gegen die INSELMITTE und nicht je Flugzeug: ein Vergleich je Modell waere 270
// Rechnungen pro Frame statt 27 und wuerde am Ergebnis nichts aendern. Damit dabei kein Flieger
// zu frueh verschwindet, kommt der Inselradius als Zuschlag DAZU: das Vorfeld liegt
// am Inselrand, seine Flieger sind also bis zu einen Radius NAEHER als die Mitte. Ohne diesen
// Zuschlag waere die wirksame Grenze bei einer 330-m-Insel nur 870 m.
const PARK_LOD_D = 1200;
// ---- DIESELBE RECHNUNG fuer die Fahrzeuge am Strand, und hier war der groessere Posten ---------
// Nachgemessen (C:/tmp/ruck24.js) ist das Feuerwehrboot am Kai das mit ABSTAND schwerste Modell im
// ganzen Spiel: 461.941 Punkte fuer ein 16 m langes Boot — mehr als der Transall (66.272), der
// Containerfrachter (264.447) und der Flugzeugtraeger (3.362) zusammen. Es liegt an JEDEM Hafen,
// also auf jeder Insel, und hatte bisher kein LOD. Bei 26 Inselzellen in Sicht sind das
// 12,0 Millionen Punkte, die IMMER gezeichnet wurden — 81 % von allem, was nach dem Vorfeld-LOD
// ueberhaupt noch in der Szene stand.
//
// Auf 2.550 m (Sichtrand) ist dieses Boot 6 px gross. Es hat also 460.000 Punkte fuer sechs Pixel
// bezahlt, und genau das ist der Rest-Ruckler beim X-Wing: er legt 2.550 m in 3,6 s zurueck, das
// Gepaeck wird im Sekundentakt aus- und eingeladen.
//
// Die Grenzen sind aus der BILDGROESSE gerechnet, mit demselben Kriterium wie PARK_LOD_D (21 px,
// "gerade noch als Fahrzeug erkennbar", bei 60 Grad FOV und 1080p):
//   Feuerwehrboot  16 m -> 786 m   (auf 1.200 m nur noch 14 px)
//   X-Wing         13 m -> 638 m   (auf 1.200 m nur 11 px)
// Aufgerundet auf 800 bzw. 700 m, damit die Zahlen nicht falsche Genauigkeit vorgeben.
//
// Das U-BOOT bleibt ausdruecklich OHNE Grenze: es ist 95 m lang und am Sichtrand noch 38 px gross,
// also klar erkennbar — eine Grenze waere dort sichtbares Verschwinden bei kaum Ersparnis
// (63.963 Punkte, ein Siebtel des Bootes). Und der HAFEN mit 7.004 Punkten lohnt es nicht.
//
// Warum das Einsteigen davon unberuehrt bleibt: harborBoatNear prueft 12 m Abstand zum Boot und
// liest dafuer harborBoatLocal, NICHT die Sichtbarkeit. Wer nah genug zum Einsteigen ist, sieht es
// ohnehin — 12 m liegen weit innerhalb von 800 m.
const BEACH_LOD_D  = 800;    // Feuerwehrboot am Strand (461.941 Punkte!)
const XPARK_LOD_D  = 700;    // geparkter X-Wing (36.534 Punkte)
function updatePlaneLOD(){
  if(locale !== 'earth') return;
  const F = worldFocus();
  for(const [key, isl] of islandCells){
    if(!isl) continue;
    // Die Strand-Fahrzeuge zuerst: sie haengen nicht an userData.parked und wuerden vom continue
    // darunter sonst uebersprungen — auf einer Stadt-Insel (kein Vorfeld) also nie abgeschaltet.
    // Bezug ist ihre ECHTE Weltposition und nicht die Inselmitte: anders als die zehn Vorfeld-
    // Plaetze ist es je Insel nur ein Objekt, ein Abstand je Insel kostet also nichts, und der
    // Radius-Zuschlag (bis 330 m Unsicherheit) entfaellt damit — deshalb braucht es hier auch
    // kein islandInfo.
    const fb = isl.userData.harborBoat;
    if(fb){
      const z = Math.hypot(isl.position.x + fb.position.x - F.x,
                           isl.position.z + fb.position.z - F.z) < BEACH_LOD_D;
      if(fb.visible !== z) fb.visible = z;
    }
    const xw = isl.userData.xwingPark;
    if(xw){
      const z = Math.hypot(isl.position.x + xw.position.x - F.x,
                           isl.position.z + xw.position.z - F.z) < XPARK_LOD_D;
      if(xw.visible !== z) xw.visible = z;
    }
    const parked = isl.userData.parked;
    if(!parked) continue;
    // Inselmitte plus Inselradius als Zuschlag (siehe oben): so verschwindet kein Flieger, dessen
    // Vorfeld noch innerhalb der Grenze liegt, nur weil die Inselmitte weiter hinten sitzt.
    // Der Radius kommt aus dem Map-KEY ("cx,cz") — islandCells ist genau so verschluesselt, und
    // islandInfo ist gecacht, kostet hier also nur einen Map-Zugriff.
    const ki = key.indexOf(',');
    const inf = islandInfo(+key.slice(0, ki), +key.slice(ki + 1));
    const grenze = PARK_LOD_D + (inf ? inf.radius : 0);
    const zeigen = Math.hypot(isl.position.x - F.x, isl.position.z - F.z) < grenze;
    // Nur schreiben, wenn sich etwas aendert: das erspart Three.js das erneute Durchlaufen der
    // Kinder in jedem Frame, in dem die Insel ihren Zustand behaelt (der Normalfall).
    if(parked[0].visible !== zeigen) for(const pl of parked) pl.visible = zeigen;
  }
}
// ---------- Unterwasser-Welt: Wracks, Vegetation, Fische ----------------------------------------
// Alles hier haengt am DETERMINISTISCHEN Zellenraster, genau wie die Inseln (islandInfo) und die
// Traeger (carrierInfo): dieselbe Zelle enthaelt immer dasselbe. Das ist wichtiger, als es klingt —
// wer ein Wrack gefunden hat, findet es wieder, und ohne diese Eigenschaft waere eine
// Unterwasserwelt beim Wegfahren einfach vergessen.
//
// WRACKS: das Modell ist schon da. shipTemplates['liberty'] (135 m Frachter) wird fuer die
// Handelsschiffe geladen — als Wrack wird es nur gekippt und auf den Grund gesetzt. Kein neues GLB,
// kein Megabyte mehr, und weil es auf seine Wasserlinie normiert ist, kennt man seine Lage genau.
// Der Grossegler ('sail') taugt dafuer NICHT: seine 60 m hohen Masten ragen im gekippten Zustand
// weit zur Seite und fast bis zur Oberflaeche (siehe wreckInfo).
const WRECK_SALT   = 771;   // eigener Hash-Salt, damit Wracks nicht mit Inseln korrelieren
// Anteil der WASSERzellen mit einem Wrack. NACHGEMESSEN und deshalb so niedrig: mit 0,22 lag in
// 43x43 km alle 2,5 km eines, also dichter als die Flugzeugtraeger auf dem Meer — ein Wrack soll
// ein Fund sein, kein Schrottplatz. Und jede Kopie ist ein volles Schiffsmodell (die Liberty hat
// zehn UV-Saetze, siehe die Notizen zur GLB-Verkleinerung): drei gleichzeitig geladen kosten
// sichtbar Bildrate. Mit 0,07 findet man rund alle 4,5 km eines und selten mehr als eines zugleich.
// 55 % der Wasserzellen. Diese Zahl war vorher unmoeglich und ist es jetzt nicht mehr: der Absatz
// darueber warnt zu Recht davor, viele VOLLE Schiffsmodelle zu laden — aber seit die HAELFTE der
// Wracks Nachbauten aus Grundformen ist (rund 400 Dreiecke statt 12.263, siehe makeSimpleWreck),
// kostet ein Wrack im Mittel etwa so viel wie eine Handvoll Korallen.
//
// Nachgerechnet: 55 % der Wasserzellen sind 24,8 % ALLER Zellen, also im Mittel alle 1,7 km eines.
// Bei 50 km/h stoesst man damit etwa alle zwei Minuten auf ein Wrack — vorher waren es bei 14 %
// gut vier Minuten, und deshalb "hab immer noch kein wrack gesehen".
const WRECK_CHANCE = 0.55;
// ---- WIE TIEF MUSS DAS WASSER SEIN? ------------------------------------------------------------
// Die Antwort stand hier zweimal falsch, und beide Male war sie GESCHAETZT: erst "gut 20 m
// Aufbauhoehe" fuer den Frachter, dann eine Absenkung von 45 auf 25 m, damit die Wracks naeher an
// den Schelf duerfen. Beides fiel nicht auf, weil das Modell unsichtbar war (siehe makeWreck).
//
// AUSGEMESSEN an der echten Geometrie, ueber alle Kraengungen, Neigungen und Kurse, die wreckInfo1
// wuerfelt (C:/tmp/whoehe.js, C:/tmp/wnach2.js), ragt ein aufgesetztes Wrack ueber den Grund:
//   Liberty-Frachter   38,0 m
//   Grosssegler        48,1 m   (seine Masten)
//   Nachbau            0,460 mal Rumpflaenge, bei 150 m also 68,9 m
// Mit 25 m Mindesttiefe stand der Frachter bis 6 m AUS dem Wasser heraus — im 33-m-Flachwasser
// nachgerechnet, und genau das waere jetzt zu sehen, wo er sichtbar ist.
//
// Nicht die Hoehe des aufrechten Schiffs entscheidet, und auch nicht seine Laenge, sondern die
// senkrechte Ausdehnung in der LAGE, in der es liegt — auf der Seite ist das im Kern die
// Rumpfbreite (bei 80 Grad gemessen 20,5 m gegen 20,3 m Breite). Genau deshalb liegen die Wracks
// jetzt steiler (55 bis 85 Grad statt 34 bis 80): das senkt die noetige Tiefe deutlich, denn in den
// flachen Lagen wirkte noch die volle Aufbauhoehe. Dazu kommt die Neigung ueber Bug und Heck
// (+-10 Grad), die bei 135 m Rumpf ein Ende um rund 12 m hebt — die Laenge kippt also mit hinein.
const WRECK_CLEAR = 8;      // m Luft zwischen Wrackspitze und Wasseroberflaeche. Die Welle steht bis
                            // 2,1 m hoch, 8 m sind also reichlich Reserve — und ein Wrack soll man
                            // suchen muessen, nicht von oben sehen.
// Die kleinste Rumpflaenge ist 70 m, ein solcher Nachbau ragt 32,2 m hoch. Mit WRECK_CLEAR sind das
// 41 m — darunter passt ueberhaupt kein Wrack, also ist hier die Grenze. Es kostet fast nichts:
// 99,9 % der Wrackplaetze liegen bei 50 m oder tiefer (Median 100 m).
const WRECK_MIN_DEPTH = 41;
// Wie hoch ein Nachbau ragt, gemessen als Anteil seiner Rumpflaenge. Aus dieser Zahl wird umgekehrt
// die groesste Laenge bestimmt, die eine Stelle noch traegt (siehe wreckInfo1) — dadurch
// verschwindet kein Wrack im flacheren Wasser, es ist dort nur kleiner. Das ist auch stimmig:
// ein Kuestenfrachter sinkt eher in Kuestennaehe als ein Stueckgutschiff.
const WRECK_H_FACTOR = 0.48;   // 0,460 gemessen, aufgerundet: die Nachbildung der Masten in der
                               // Messung ist eine Naeherung, und ein Wrack, das zu klein ausfaellt,
                               // ist besser als eines, das aus dem Meer schaut.
// Die beiden Grossfund-Modelle brauchen feste Tiefen (ihre Groesse ist nicht verhandelbar):
const LIB_WRECK_MIN_DEPTH  = 46;   // 38,0 m hoch + WRECK_CLEAR
const SAIL_WRECK_MIN_DEPTH = 57;   // 48,1 m hoch + WRECK_CLEAR
// Wie viele Wracks eine Wasserzelle hoechstens tragen kann. Von 1 auf 2 ("die dichte der kleinen
// wracks um 1 erhoehen"): jeder Wurf wuerfelt eigenstaendig mit WRECK_CHANCE und eigenem Salt,
// zwei Wuerfe ergeben also nicht zwangslaeufig zwei Wracks.
// NACHGEMESSEN in 102,8 x 102,8 km (14.641 Zellen, C:/tmp/wmeas.js): aus 3.622 Wracks werden 6.903
// (nach dem Verwerfen zu enger Paare, siehe WRECK_MIN_GAP), also 47,1 % aller Zellen statt 24,7 %.
// Der Weg zum naechsten Wrack sinkt von 793 auf 619 m. Gleichzeitig geladen sind in den 3x3 Zellen
// im Mittel 4,5 Wracks, hoechstens 14 — tragbar, weil ein Nachbau rund 400 Dreiecke kostet und zu
// EINEM Draw-Call verschmolzen ist.
const WRECK_TRIES = 2;
// ---- EINFACHE WRACKS ---------------------------------------------------------------------------
// "hab immer noch kein wrack gesehen. wie werden die aufgebaut? dargestellt? vielleicht, weiter
// vereinfacht mehrere wracks"
//
// Bisher war ein Wrack eine Kopie des GANZEN Schiffsmodells (shipTemplates['liberty'], 12.263
// Dreiecke, 4 Texturen), umgefaerbt und gekippt. Das sieht gut aus, ist aber so teuer, dass die
// Haeufigkeit klein bleiben musste — bei 14 % Chance liegt im Mittel alle 3,4 km eines, also bei
// 50 km/h etwa alle vier Minuten. Kein Wunder, dass man keines findet.
//
// Deshalb ein NACHGEBAUTES Wrack aus Grundformen: Rumpf, Aufbau, Schornstein, Masten, dazu eine
// Bruchkante. Das kostet rund 400 Dreiecke statt 12.263 — Faktor 30 — und erlaubt damit eine Dichte,
// bei der man tatsaechlich auf Wracks stoesst. Die Vorbilder sind dieselben wie fuer die Korallen:
// die mitgelieferten Unterwasser-Szenen, in denen Wracks als kantige Silhouetten auf dem Sand liegen.
//
// Das GLB-Wrack bleibt als SELTENER Grossfund erhalten (siehe wreckInfo): ein echter Frachter ist
// eindrucksvoller als jeder Nachbau, und einer davon pro Gegend kostet nichts.
const wreckHullMat = new THREE.MeshLambertMaterial({ color:0x54544a });   // Rumpf, rostig-grau
const wreckDeckMat = new THREE.MeshLambertMaterial({ color:0x6a6a5c });   // Aufbau, etwas heller
const wreckRustMat = new THREE.MeshLambertMaterial({ color:0x6b4a34 });   // Rostflaechen
// Ein einfaches Frachterwrack. laenge bestimmt alles Weitere, damit die Proportionen stimmen.
function makeSimpleWreck(laenge, rnd, rnd2){
  const g = new THREE.Group();
  const br = laenge*0.16;          // Breite: ein Frachter ist etwa 1:6
  const hoehe = laenge*0.11;
  // WICHTIG: der Rumpf liegt entlang der Z-ACHSE, wie die GLB-Schiffsmodelle. Mein erster Aufbau
  // lag entlang X, und das war der Grund fuer "es steckte senkrecht im sand und lag nicht auf der
  // seite": makeWreck legt das Wrack mit rotation.set(pitch, rot, roll) hin, und roll dreht um Z.
  // Bei einem Rumpf entlang Z ist das eine KRAENGUNG (richtig), bei einem entlang X kippt es den
  // Bug nach oben — mit roll zwischen 34 und 80 Grad stand das Wrack also praktisch aufrecht.
  //
  // RUMPF als flacher Zylinder: ein Schiffsrumpf ist im Querschnitt rund, und ein Zylinder mit
  // 8 Segmenten liest sich als Rumpf, waehrend ein Kasten nach Kiste aussieht.
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(br*0.5, br*0.42, laenge, 8), wreckHullMat);
  hull.rotation.x = Math.PI/2;     // Zylinderachse von Y auf Z drehen
  // FLACHER, nicht schmaler: ein Rumpf ist breiter als hoch. Nach der X-Drehung ist die lokale
  // Z-Achse des Zylinders die Welt-Hoehe — die muss gestaucht werden. Mit scale.x kam ein hochkant
  // stehender Rumpf heraus (bei 110 m Laenge 12,7 m breit und 17,6 m hoch statt umgekehrt).
  hull.scale.z = 0.72;
  g.add(hull);
  // BUG als Kegel: gibt dem Rumpf eine Richtung, ohne die man nicht sieht, wie das Schiff lag.
  const bow = new THREE.Mesh(new THREE.ConeGeometry(br*0.48, laenge*0.22, 8), wreckHullMat);
  bow.rotation.x = -Math.PI/2;     // Spitze nach -Z, also nach vorne
  bow.position.z = -laenge*0.6;
  bow.scale.z = 0.72;              // dieselbe Stauchung wie am Rumpf (siehe dort)
  g.add(bow);
  // AUFBAU: zwei Kaesten unterschiedlicher Groesse im hinteren Drittel (+Z ist hinten).
  const auf = new THREE.Mesh(new THREE.BoxGeometry(br*0.7, hoehe*1.4, laenge*0.16), wreckDeckMat);
  auf.position.set(0, hoehe*0.9, laenge*0.22);
  g.add(auf);
  const bruecke = new THREE.Mesh(new THREE.BoxGeometry(br*0.5, hoehe*0.9, laenge*0.09), wreckDeckMat);
  bruecke.position.set(0, hoehe*2.1, laenge*0.22);
  g.add(bruecke);
  // SCHORNSTEIN: das Merkmal, an dem man ein Wrack als Schiff erkennt.
  const kamin = new THREE.Mesh(new THREE.CylinderGeometry(br*0.14, br*0.16, hoehe*1.3, 7), wreckRustMat);
  kamin.position.set(0, hoehe*2.4, laenge*0.3);
  g.add(kamin);
  // MASTEN: zwei duenne Stangen, eine davon abgebrochen und schief — das macht aus einem Schiff
  // ein WRACK. Ein aufrechtes, vollstaendiges Schiff auf dem Meeresgrund wirkt wie ein Fehler.
  // Die Kippung geht jetzt um X (nach vorne/hinten), passend zur Z-Laengsachse.
  for(const [pz, len, kipp] of [[-laenge*0.28, hoehe*2.6, 0.12], [laenge*0.05, hoehe*1.8, 0.5+rnd*0.6]]){
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(br*0.05, br*0.06, len, 5), wreckRustMat);
    mast.position.set(0, len*0.45*Math.cos(kipp), pz + Math.sin(kipp)*len*0.4);
    mast.rotation.x = kipp;
    g.add(mast);
  }
  // Hier lag einmal ein abgebrochenes Rumpfstueck abseits, als Hinweis auf den Untergang. Es ist
  // ERSATZLOS ENTFALLEN, weil es rechnerisch nicht funktionieren konnte: es sass 0,25 bis 0,5
  // Rumpflaengen VOR dem Bug (bei 150 m Laenge also 37 bis 75 m entfernt), und weil makeWreck die
  // ganze Gruppe um 34 bis 80 Grad kippt, drehte es sich um die Rumpfachse mit und schwebte weit
  // ueber dem Grund. Auf dem Screenshot war es als Zylinder in der Ferne zu sehen.
  // Den Untergang erzaehlen der gekippte Rumpf und der abgebrochene, schiefe Mast ohnehin.
  return g;
}
// EIN Wrack einer Zelle. k ist der Wurf (0 bis WRECK_TRIES-1) und geht in den Salt ein, damit die
// Wuerfe einer Zelle voneinander unabhaengig sind. Der Abstand von 20 zwischen den Salts ist
// grosszuegig gewaehlt: wreckInfo1 verbraucht selbst 10 aufeinanderfolgende Werte.
// k = 0 rechnet absichtlich GENAU wie vorher — ein Wrack, das man schon gefunden hat, liegt also
// weiter an derselben Stelle (die Ortstreue ist der Sinn des ganzen Zellenrasters).
function wreckInfo1(cx, cz, k){
  if(cx===0 && cz===0) return null;             // Startzelle frei halten
  if(islandInfo(cx, cz)) return null;           // die Zelle selbst muss Wasser sein
  const S = WRECK_SALT + k*20;
  if(cellRnd(cx, cz, S) >= WRECK_CHANCE) return null;
  const wx = cx*CELL + (cellRnd(cx,cz,S+1)-0.5)*CELL*0.6;
  const wz = cz*CELL + (cellRnd(cx,cz,S+2)-0.5)*CELL*0.6;
  const y = seabedY(wx, wz);
  if(y > -WRECK_MIN_DEPTH) return null;          // zu flach (siehe oben)
  // GLB-Grossfund oder einfaches Wrack? Jedes zweite Wrack ist der echte Frachter (12.263
  // Dreiecke), der Rest ein Nachbau aus Grundformen (rund 400).
  // Diese Zahl wurde zweimal erhoeht (0,2 -> 0,5), weil kein Grossfund zu finden war — beides
  // vergeblich, denn der Grund war nie die Seltenheit: das Modell wurde UEBERHAUPT NICHT GEZEICHNET
  // (siehe den Materialfehler in makeWreck). Die 0,5 bleibt trotzdem stehen; nachgemessen liegt
  // damit ein Grossfund alle 1.199 m, und ein Fund, den man sieht, darf so haeufig sein.
  // 'gross' ist hier nur der WUNSCH — ob es einer wird, entscheidet die Tiefe (echtGross unten).
  // Nur der ERSTE Wurf einer Zelle kann ein Grossfund sein. Ein zweiter GLB-Frachter in derselben
  // Zelle waere ein volles Schiffsmodell mehr (12.263 Dreiecke gegen 400) und nimmt dem Fund
  // ausserdem seine Besonderheit.
  const gross = k === 0 && cellRnd(cx,cz,S+8) < 0.5;
  const tiefe = -y;
  // Grossfund: Frachter ODER Grossegler. Der Segler war ausgeschlossen, weil die alte
  // Auflege-RECHNUNG ihn halb in den Boden zog — mit der halben Rumpfbreite gerechnet, waehrend
  // seine Masten gekippt weit zur Seite ragen. Seit makeWreck die Lage MISST statt sie zu schaetzen
  // (siehe dort), gilt das nicht mehr.
  //
  // Was hier liegen darf, entscheidet die TIEFE, denn beide Modelle haben eine feste Groesse:
  // tief genug fuer den Segler -> jeder zweite Grossfund ist einer; sonst der flachere Frachter;
  // reicht es auch fuer den nicht, wird es ein Nachbau (dessen Laenge passt sich an, siehe unten).
  let key = null, echtGross = false;
  if(gross && tiefe >= SAIL_WRECK_MIN_DEPTH && cellRnd(cx,cz,S+11) < 0.5){ key = 'sail'; echtGross = true; }
  else if(gross && tiefe >= LIB_WRECK_MIN_DEPTH){ key = 'liberty'; echtGross = true; }
  // Laenge des Nachbaus: 70 bis 150 m, also von Kuestenfrachter bis Stueckgutschiff — aber nur so
  // lang, wie die Stelle es traegt. Ohne diese Grenze ragte ein 150-m-Nachbau in 60 m Wasser
  // 9 m aus dem Meer (68,9 m hoch gemessen).
  const lenRoh = 70 + cellRnd(cx,cz,S+9)*80;
  const lenMax = (tiefe - WRECK_CLEAR) / WRECK_H_FACTOR;
  return { wx, wz, y, key, gross: echtGross,
           len: Math.min(lenRoh, lenMax),
           rot:  cellRnd(cx,cz,S+4)*Math.PI*2,      // Kurs, in dem es gesunken ist
           // Kraengung: auf welche Seite es gekippt liegt. 55 bis 85 Grad — es liegt also deutlich
           // AUF DER SEITE. Vorher waren es 34 bis 80 Grad, und die flachen Lagen hatten zwei
           // Nachteile: bei 34 Grad sieht ein Schiff noch fast fahrend aus, und weil dort die
           // aufrechte Hoehe noch voll wirkt, bestimmte gerade die FLACHSTE Lage die noetige
           // Wassertiefe. Auf der Seite liegend wird die Rumpfbreite zur Hoehe: gemessen 20,5 m
           // senkrechte Ausdehnung bei 80 Grad gegen 20,3 m Rumpfbreite (C:/tmp/wachse.js).
           // Damit sinkt die noetige Tiefe beim Frachter von 53 auf 46 m, beim Segler von 71 auf 57.
           roll: (0.96 + cellRnd(cx,cz,S+5)*0.52) * (cellRnd(cx,cz,S+6)<0.5?-1:1),
           // Und ueber Bug oder Heck geneigt, WEIL DER GRUND ABFAELLT — nicht gewuerfelt.
           // Das war die Ursache fuer "eine stelle liegt am grund, die andere schwebt in der luft":
           // pitch kam aus cellRnd, der Rumpf lag also in einem Winkel, der mit dem Gefaelle unter
           // ihm nichts zu tun hatte. Bei 135 m Rumpflaenge und dem Schelfhang (SEA_DEPTH ueber
           // SHELF_W = 180 m, also bis 0,5 m Fall je Meter) rutschte ein Ende dabei weit weg vom
           // Sand: NACHGEMESSEN (C:/tmp/wr11.js) schwebte der Frachter im Median 6,34 m, in 87,5 %
           // der Faelle mehr als 1 m, schlimmstenfalls 63,55 m — und steckte auf der anderen Seite
           // im Median 7,55 m im Boden. Der Segler mit 90 m lag bei 4,37 m Median.
           //
           // Jetzt kommt die Neigung aus dem Grund selbst: Bug- und Heckpunkt abfragen und den
           // Winkel zwischen ihnen nehmen. seabedY ist dieselbe Funktion, die den Grund zeichnet,
           // die Neigung passt also genau — und weil sie nur aus (cx,cz) folgt, bleibt das Wrack
           // ortstreu.
           //
           // Gemessen sinkt der Median damit von 6,34 m auf -0,31 m (es liegt also auf und sinkt
           // leicht ein) und der 90-%-Wert von 14,73 auf 6,35 m. Die restlichen Faelle sind die
           // GEWOELBTEN Stellen: liegt eine Delle oder ein Buckel zwischen Bug und Heck, kann ein
           // starrer Rumpf dort ueberhaupt nicht aufliegen, ganz gleich in welchem Winkel. Die
           // faengt die Woelbungsschwelle in wreckInfos ab (siehe WRECK_WOELB_MAX).
           pitch: wreckPitch(wx, wz, cellRnd(cx,cz,S+4)*Math.PI*2,
                             Math.min(lenRoh, lenMax), key) };
}
// Neigung ueber Bug und Heck aus dem GEFAELLE des Grundes. laenge ist die Rumpflaenge; beim
// Grossfund zaehlt die Modelllaenge aus SHIP_TYPES und nicht info.len (dasselbe, was wreckLen
// unterscheidet — mit info.len waere der Winkel fuer einen zu kurzen Rumpf gerechnet).
function wreckPitch(wx, wz, rot, len, key){
  const L = wreckModelLen(len, key);
  // -sin/-cos: dieselbe Vorwaertsrichtung, die faceTowards und die Boote benutzen (-Z ist die Front).
  const fx = -Math.sin(rot), fz = -Math.cos(rot);
  const yBug = seabedY(wx + fx*L/2, wz + fz*L/2);
  const yHeck = seabedY(wx - fx*L/2, wz - fz*L/2);
  return Math.atan2(yBug - yHeck, L);
}
// Rumpflaenge fuer Geometrie-Rechnungen: beim Grossfund die Modelllaenge, sonst die gewuerfelte.
// Als eigene Funktion, weil wreckPitch sie VOR dem Bau braucht (wreckLen bekommt ein fertiges info).
function wreckModelLen(len, key){
  if(!key) return len;
  const def = SHIP_TYPES.find(d=>d.key === key);
  return def ? def.len : len;
}
// ALLE Wracks einer Zelle. Reihenfolge und Inhalt sind allein aus (cx,cz) bestimmt — Aufrufer
// duerfen das Ergebnis also zwischenspeichern, muessen aber nichts pflegen.
//
// Zwei Wuerfe derselben Zelle koennen auf derselben Stelle landen: sie streuen unabhaengig ueber
// 60 % der Zellenbreite (510 m), und NACHGEMESSEN steckten 13,6 % der Paare ineinander — der
// engste Fall lag 5,3 m auseinander bei zusammen 82 m Rumpflaenge (C:/tmp/wnah.js). Zwei
// ineinander gebaute Wracks sehen nicht nach zwei Funden aus, sondern nach einem Fehler.
// Deshalb faellt der spaetere Wurf weg, wenn er einem frueheren zu nahe kommt. Der Preis dafuer
// ist klein: 412 von 7.315 Wracks entfallen, der Weg zum naechsten steigt von 601 auf 619 m.
const WRECK_MIN_GAP = 1.3;  // Vielfaches der halben Laengensumme, das zwischen zwei Wracks bleibt.
                            // 1,0 waere die Beruehrung der Rumpfe, 1,3 laesst Platz fuer die
                            // Aufbauten und die Kraengung (ein gekipptes Wrack ragt zur Seite).
// Wie lang ein Wrack WIRKLICH ist. Beim Nachbau ist das info.len, beim Grossfund aber die Laenge
// des Liberty-Frachters aus SHIP_TYPES (135 m) — info.len beschreibt dann nur den ungenutzten
// Nachbau. Mit info.len gerechnet lagen 40 der 783 Grossfund-Paare zu nah (C:/tmp/wgross.js);
// im schlimmsten Fall forderte der Code 141 m Abstand, wo 175 m noetig gewesen waeren.
function wreckLen(info){
  if(!info.gross) return info.len;
  const def = SHIP_TYPES.find(d=>d.key === info.key);
  return def ? def.len : info.len;
}
// Wieviel der Grund zwischen Bug und Heck von der GERADEN abweichen darf. Eine Neigung kann ein
// starrer Rumpf mitmachen (dafuer sorgt wreckPitch), eine WOELBUNG nicht: liegt eine Delle oder ein
// Buckel dazwischen, beruehrt er den Grund nur an zwei von drei Punkten — in welchem Winkel auch
// immer er liegt. Das sind die Faelle, die nach dem Neigungs-Fix als Rest uebrig blieben.
//
// NACHGEMESSEN (C:/tmp/wr11.js), Frachter mit 135 m Rumpf, Anteil mit mehr als 1 m Schwebespalt:
//   ohne Schwelle   24,0 %   (90-%-Wert 6,35 m)
//   3 m              5,0 %   (90-%-Wert 0,14 m), 20,5 % der Stellen entfallen
//   2 m              2,3 %   (90-%-Wert -0,18 m), 23,0 % der Stellen entfallen
// 3 m ist der Knick: es holt vier Fuenftel der schlechten Faelle und kostet ein Fuenftel der
// Stellen. Von 2 m auf 3 m gehen nur 2,5 Prozentpunkte mehr Stellen verloren, aber die Ausbeute
// steigt kaum noch — und Wracks sollen zu finden sein.
//
// Dass Stellen wegfallen, kostet nichts: WRECK_CHANCE liegt bei 0,55 mit zwei Wuerfen je Zelle,
// es bleiben also reichlich. Und wo eines wegfaellt, faellt es DETERMINISTISCH weg — die
// Ortstreue bleibt, weil seabedY nur von der Position abhaengt.
const WRECK_WOELB_MAX = 3;
// Traegt die Stelle einen starren Rumpf? Prueft die Woelbung zwischen Bug, Mitte und Heck.
function wreckPasst(info){
  const L = wreckLen(info);
  const fx = -Math.sin(info.rot), fz = -Math.cos(info.rot);
  const yBug  = seabedY(info.wx + fx*L/2, info.wz + fz*L/2);
  const yHeck = seabedY(info.wx - fx*L/2, info.wz - fz*L/2);
  return Math.abs(info.y - (yBug + yHeck)/2) <= WRECK_WOELB_MAX;
}
// Gecacht wie die Inseln, Parkplaetze und Rampen (_islandCache, _parkCache, _rockCache), und seit
// dem Neigungs-Fix lohnt es deutlicher: wreckInfos wird im Periskop und im Sonar JE FRAME ueber 49
// Zellen aufgerufen, und jedes Wrack kostet jetzt fuenf seabedY statt einem (Tiefe + Neigung +
// Woelbung). Gemessen sind das 0,19 ms je Frame ohne Cache — vertretbar, aber unnoetig, denn das
// Ergebnis haengt allein an (cx,cz) und aendert sich nie.
const _wreckCache = new Map();
function wreckInfos(cx, cz){
  const key = cx + ',' + cz;
  const hit = _wreckCache.get(key);
  if(hit) return hit;
  const r = _wreckInfosCalc(cx, cz);
  _wreckCache.set(key, r);
  return r;
}
function _wreckInfosCalc(cx, cz){
  const out = [];
  for(let k=0;k<WRECK_TRIES;k++){
    const wi = wreckInfo1(cx, cz, k);
    if(!wi) continue;
    if(!wreckPasst(wi)) continue;         // gewoelbter Grund: kein Rumpf liegt dort auf
    const lw = wreckLen(wi);
    let frei = true;
    for(const alt of out){
      if(Math.hypot(wi.wx-alt.wx, wi.wz-alt.wz) < (lw+wreckLen(alt))/2 * WRECK_MIN_GAP){ frei = false; break; }
    }
    if(frei) out.push(wi);
  }
  return out;
}
// Der TIEFSTE PUNKT eines gedrehten Objekts, aus der Geometrie gelesen.
//
// Warum nicht THREE.Box3().setFromObject? Weil die Box NICHT das Wrack ist. setFromObject nimmt je
// Mesh die vorberechnete geometry.boundingBox, transformiert deren ACHT ECKEN mit der Weltmatrix und
// umschliesst die — im three.js-Quelltext nachgelesen:
//   Nt.copy(e.boundingBox); Nt.applyMatrix4(t.matrixWorld); this.union(Nt);
// Bei einem GEDREHTEN Objekt ist das die Huelle einer gedrehten Huelle, und die ist immer groesser
// als das Objekt. Ihre Unterkante liegt damit unter dem Rumpf, und um genau diesen Betrag wurde das
// Wrack zu hoch gehoben: nachgemessen bis 9,4 m beim Frachter und 16,8 m beim Segler
// (C:/tmp/wbox.js) — deshalb schwebte es weiter, obwohl die Rechnung "gemessen" war.
//
// Diese Funktion geht die Punkte selbst durch. Das kostet beim Frachter 7.417 und beim Segler 10.063
// Transformationen, aber nur EINMAL beim Bauen des Wracks, und es wird ohnehin nur eine Zelle pro
// Frame gebaut (siehe updateUwCells).
const _wLow = new THREE.Vector3();
function lowestPointY(g){
  g.updateMatrixWorld(true);
  let min = Infinity;
  g.traverse(o=>{
    if(!o.isMesh || !o.geometry) return;
    const pos = o.geometry.attributes.position;
    if(!pos) return;
    for(let i=0;i<pos.count;i++){
      _wLow.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if(_wLow.y < min) min = _wLow.y;
    }
  });
  return min;
}
// Ein Wrack bauen. Es liegt auf dem Grund, also muss der Ursprung so hoch, dass der gekippte Rumpf
// genau aufliegt statt zu schweben oder im Sand zu stecken.
// Das wird GEMESSEN: erst die Drehung setzen, dann den tiefsten Punkt der Geometrie suchen, dann um
// ihn anheben. Jede Rechnung mit Breite und Aufbauhoehe war eine Schaetzung und lag daneben.
function makeWreck(info){
  // EINFACHES Wrack (der Normalfall): Nachbau aus Grundformen, rund 400 Dreiecke statt 12.263.
  // Es braucht kein geladenes Modell, ist also auch sofort da — beim GLB-Wrack musste man warten,
  // bis shipTemplates gefuellt war.
  if(!info.gross){
    const g0 = new THREE.Group();
    g0.add(makeSimpleWreck(info.len, cellRnd(Math.round(info.wx), Math.round(info.wz), 31),
                                     cellRnd(Math.round(info.wx), Math.round(info.wz), 32)));
    // Auf den Grund legen — GEMESSEN, wie beim Grossfund: erst drehen, dann den tiefsten PUNKT der
    // Geometrie suchen und um ihn anheben. Die alte Rechnung (|sin(roll)| mal Rumpfradius) liess
    // Aufbauten, Schornstein und Masten aussen vor und setzte damit zu tief oder zu hoch an.
    g0.rotation.set(info.pitch, info.rot, info.roll, 'YXZ');
    g0.position.set(info.wx, wreckRestY(info) - lowestPointY(g0), info.wz);
    return g0;
  }
  const tpl = shipTemplates[info.key];
  if(!tpl) return null;
  const g = new THREE.Group();
  const m = tpl.clone(true);
  // Farbe: ein Wrack ist nicht mehr weiss und rot. Alle Materialien nach Braungruen ziehen —
  // Rost und Algen. Eigene Materialinstanz je Mesh, sonst faerbt man die fahrenden Schiffe mit.
  m.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // Ob EIN Material oder eine Liste, muss VORHER feststehen: mats.map liefert immer ein Array,
    // also war die alte Rueckfrage (!Array.isArray(o.material)) nach der Zuweisung nie erfuellt.
    // Jedes Mesh bekam damit ein Array-Material — und genau daran war der Grossfund UNSICHTBAR:
    // three.js r128 zeichnet ein Array-Material ausschliesslich ueber geometry.groups, und die
    // Liberty ist ein einziges Mesh aus einem primitive (nachgesehen im GLB: 1 Mesh, 1 Material,
    // 12.263 Dreiecke, C:/tmp/glbmat.js) — ohne Gruppen wird nichts gemalt. Das Wrack war also
    // da, mit Fischschwaermen darueber und einem Punkt im Periskop, nur eben nicht zu sehen.
    // Deshalb half auch keine Erhoehung der Haeufigkeit: "es gibt immer noch kein echtes wrack".
    const warListe = Array.isArray(o.material);
    const neu = mats.map(src=>{
      const mat = src.clone();
      if(mat.color) mat.color.lerp(new THREE.Color(0x4a4a38), 0.72);
      if(mat.map) mat.map = null;      // Textur weg: sonst leuchtet die Lackierung durch
      return mat;
    });
    o.material = warListe ? neu : neu[0];
  });
  g.add(m);
  // AUFSETZEN WIRD GEMESSEN, NICHT GERECHNET — und zwar an der GEOMETRIE, nicht an ihrer Box.
  // Zwei Anlaeufe waren noetig:
  //   1. Ein Zuschlag aus halber Breite und halber Aufbauhoehe, mit |sin(roll)| gewichtet. Reine
  //      Schaetzung; der Frachter schwebte im Mittel 8,05 m, schlimmstenfalls 13,06 m.
  //   2. THREE.Box3().setFromObject auf das gedrehte Wrack. Klingt nach Messung, ist aber keine:
  //      die Box umschliesst die gedrehten ECKEN der ungedrehten Box, nicht das Schiff. Damit lag
  //      sie bis 9,4 m (Frachter) und 16,8 m (Segler) zu tief — das Wrack schwebte weiter.
  // Jetzt sucht lowestPointY den tiefsten PUNKT der gedrehten Geometrie. Das ist fuer jede Lage,
  // jedes Modell und jede Kraengung richtig, ohne Sonderfall — und die Masten des Seglers fallen
  // dabei einfach mit hinein.
  g.rotation.set(info.pitch, info.rot, info.roll, 'YXZ');
  g.position.set(info.wx, wreckRestY(info) - lowestPointY(g), info.wz);
  return g;
}
// Auf WELCHE Hoehe das Wrack aufsetzt. Das war vorher info.y minus 0,4 m, also die Tiefe in der
// MITTE — und damit nur bei ebenem Grund richtig. Seit die Neigung dem Gefaelle folgt (siehe
// wreckPitch), liegt der Rumpf schraeg ueber drei verschiedenen Bodenhoehen: unter Bug, Mitte und
// Heck. Der Bezug muss deshalb aus allen drei kommen.
//
// Genommen wird der MITTELWERT der drei Bedarfe und nicht der hoechste. Der hoechste hielte das
// Wrack sicher aus dem Boden, liesse es dafuer aber an den anderen Punkten schweben: gemessen
// (C:/tmp/wr9.js) 0,20 m Median Spalt statt 0,09 m, dabei nie Einsinken. Der Mittelwert halbiert
// beides — es sinkt an der tiefsten Stelle etwas ein UND schwebt an der hoechsten weniger.
//
// Und das ist genau richtig: ein Wrack liegt seit Jahrzehnten im Sand, es steht nicht darauf.
// Teilweise eingesunken sieht es aus wie gewachsen, schwebend wie ein Fehler. Deshalb kommen die
// 0,4 m Einsinken von vorher noch dazu.
const WRECK_SINK = 0.4;    // m, um die das Wrack im Sand steckt (siehe oben)
function wreckRestY(info){
  const L = wreckLen(info);
  const fx = -Math.sin(info.rot), fz = -Math.cos(info.rot);
  const yBug  = seabedY(info.wx + fx*L/2, info.wz + fz*L/2);
  const yHeck = seabedY(info.wx - fx*L/2, info.wz - fz*L/2);
  // Was Bug und Heck an Hoehe brauchen, ist um die Neigung zurueckzurechnen: der Bug sitzt
  // sin(pitch)*L/2 UEBER dem Bezugspunkt, das Heck ebenso weit darunter.
  const s = Math.sin(info.pitch) * L/2;
  return (yBug - s + yHeck + s + info.y)/3 - WRECK_SINK;
}
// ---- VEGETATION: Seegras und Korallen auf dem Schelf -------------------------------------------
// Nur im flachen Wasser am Inselsaum, wo Licht hinkommt — dort, wo auch echte Pflanzen wachsen.
// Gebaut wie die Palmen und Häuser: einfache Geometrie, deterministisch platziert.
const weedMat  = new THREE.MeshLambertMaterial({ color:0x2f6b3a, side:THREE.DoubleSide });
const coralMat = new THREE.MeshLambertMaterial({ color:0xc4665c });
const coral2Mat= new THREE.MeshLambertMaterial({ color:0xcf9a3d });
// ---- GEOMETRIEN VERSCHMELZEN ---------------------------------------------------------------------
// Der Meeresgrund kostete 5.544 Draw-Calls, weil jede Pflanze aus mehreren Meshes besteht: ein
// Korallenbusch aus 6 bis 10 (Zylinder plus Kugelspitzen), ein Seegrasbueschel aus 3 bis 5 Flaechen.
// Bei 9 geladenen Zellen und 120 Objekten je Zelle summiert sich das.
//
// Verschmelzen loest das, OHNE die Optik anzutasten: alle Teile eines Objekts wandern in EINE
// Geometrie, also ein Draw-Call statt zehn. Das geht hier, weil alle Teile einer Pflanze dasselbe
// Material haben — nur dann darf man zusammenfassen.
//
// Three.js bringt BufferGeometryUtils.mergeGeometries mit, aber die Datei ist im Projekt nicht
// eingebunden (und dafuer eine weitere zu laden waere unverhaeltnismaessig). Die Funktion hier macht
// genau das Noetige: Positionen und Normalen der Kinder in Weltkoordinaten der Gruppe umrechnen und
// hintereinander in einen Puffer schreiben.
function mergeGroup(g, mat){
  g.updateMatrixWorld(true);
  // Erst zaehlen, dann einmal allokieren — Arrays wachsen zu lassen kostet bei jedem Umkopieren.
  let n = 0;
  g.traverse(o=>{
    if(!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    n += idx ? idx.count : pos.count;
  });
  if(!n) return null;
  const P = new Float32Array(n*3), N = new Float32Array(n*3);
  let k = 0;
  const _v = new THREE.Vector3(), _nv = new THREE.Vector3();
  const _nm = new THREE.Matrix3();
  g.traverse(o=>{
    if(!o.isMesh) return;
    const geo = o.geometry;
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const idx = geo.index;
    // Die Weltmatrix der Gruppe herausrechnen: die Kinder sitzen relativ zu ihr, und das Ergebnis
    // soll wieder relativ zur Gruppe sein (die Gruppe wird spaeter positioniert und gedreht).
    o.updateMatrixWorld(true);
    const M = o.matrixWorld.clone().premultiply(new THREE.Matrix4().copy(g.matrixWorld).invert());
    // Normalen brauchen die inverse Transponierte, sonst kippen sie bei ungleicher Skalierung
    // (und genau die haben die Pflanzen: scale.y ist oft anders als scale.x).
    _nm.getNormalMatrix(M);
    const cnt = idx ? idx.count : pos.count;
    for(let i=0;i<cnt;i++){
      const j = idx ? idx.getX(i) : i;
      _v.fromBufferAttribute(pos, j).applyMatrix4(M);
      P[k*3] = _v.x; P[k*3+1] = _v.y; P[k*3+2] = _v.z;
      if(nor){
        _nv.fromBufferAttribute(nor, j).applyMatrix3(_nm).normalize();
        N[k*3] = _nv.x; N[k*3+1] = _nv.y; N[k*3+2] = _nv.z;
      }
      k++;
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return new THREE.Mesh(geo, mat);
}
// Ein Büschel Seegras: drei bis fünf schmale, hohe Fächer in leicht verschiedenen Winkeln.
function makeWeed(rnd, rnd2){
  const g = new THREE.Group();
  const n = 3 + Math.floor(rnd*3);
  for(let i=0;i<n;i++){
    const h = 2.2 + rnd2*3.4;
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + rnd*0.5, h), weedMat);
    bl.position.y = h/2;
    bl.rotation.y = (i/n)*Math.PI*2 + rnd*2;
    bl.rotation.z = (rnd2-0.5)*0.5;
    g.add(bl);
  }
  // Zu EINEM Mesh verschmelzen: alle Faecher haben dasselbe Material, also darf man das — und aus
  // 3 bis 5 Draw-Calls wird einer. Bei 60 Buescheln je Zelle und 9 Zellen sind das 1.080 Calls
  // weniger. Fallback auf die Gruppe, falls das Verschmelzen scheitert.
  return mergeGroup(g, weedMat) || g;
}
// Hier stand einmal makeCoral: ein gedrungener Zylinder mit zwei Kugeln obendrauf. Die Form war
// als Koralle nicht zu erkennen — gemeldet als "das orangene sollen das poller sein?". Ersetzt
// durch makeCoralBush (siehe weiter unten), der an deep_water_coral abgeschaut ist: mehrere
// verzweigte Stoecke unterschiedlicher Hoehe mit verdickten Spitzen.
// ---- Zellenverwaltung fuer alles unter Wasser ---------------------------------------------------
// Ein Pool wie islandCells: pro Zelle EINE Group mit Wrack, Seegras und Korallen. Sie entsteht,
// wenn die Zelle in Sichtweite kommt, und verschwindet, wenn sie hinausfaellt.
//
// Warum ein eigener Pool und nicht Teil von buildIsland: die Sachen unter Wasser liegen NICHT auf
// Inseln, sondern zwischen ihnen (Wracks brauchen Tiefe, Seegras den Saum). Sie folgen also einem
// anderen Raster als die Inselgruppen, und mit hineingebaut waeren sie beim refreshIslands jedes
// Ein- und Aussteigens neu gebaut worden — 40 Objekte pro Zelle, ohne Grund.
const uwCells = new Map();      // "cx,cz" -> Group (oder null: hier ist nichts)
// Radius in Zellen. Von 2 auf 1 gesenkt: bei 2 wurden 25 Zellen geladen, also ein Bereich von
// 1.700 m Radius — sichtbar sind unter Wasser aber nur 165 bis 180 m. Nachgerechnet sah man 0,9 %
// des geladenen Bereichs, der Rest kostete nur Draw-Calls und Culling-Tests (616 Meshes je Zelle).
// Mit 1 sind es 9 Zellen, und der Rand liegt immer noch 425 m entfernt — mehr als das Doppelte der
// Sichtweite, es kann also nichts sichtbar fehlen.
const UW_VIEW_CELLS = 1;
// Mehr als vorher (26/14), aber mit Maß. Gemeldet als "es gibt auch kein leben oder pflanzen auf
// dem boden als referenz", und das lag weniger an der Zahl als an der VERTEILUNG: sie stehen in
// einem Ring um die Insel, und der war 102 m breit — die Objekte verloren sich darin.
//
// Die Obergrenze ist hier die Zeichenlast, nicht der Geschmack: eine Pflanze ist KEIN einzelnes
// Mesh. makeWeed baut 3 bis 5 Plane-Meshes in einer Group, makeCoral 3. 60/34 Objekte sind also
// rund 340 Meshes pro Zelle und bei 25 geladenen Zellen 8.500. Mit meinem ersten Ansatz (90/50)
// waeren es 25.000 gewesen — das traegt kein Tablet.
// Dichter WIRKT es trotzdem, weil das Band jetzt schmaler ist (siehe UW_PLANT_BANDW): dieselbe
// Zahl auf einem Drittel der Flaeche.
const WEED_PER_CELL  = 60;      // Bueschel pro Zelle
const CORAL_PER_CELL = 34;
// Bis zu welcher Tiefe Pflanzen wachsen. Tiefer wird es dunkel, dort steht nichts mehr — das ist
// auch der Grund, warum die Tiefsee leer aussehen DARF: sie ist es wirklich.
// 45 m statt 40: nachgemessen fielen 8 % der Bandplaetze durch diese Grenze, weil das Duenenrelief
// +-19,5 m ausmacht und den Boden stellenweise darunter drueckt. Seit das Band nur bis 25 m Tiefe
// reicht (UW_PLANT_BANDW), ist die Grenze nicht mehr bindend — die 45 m sind der Sicherheitsabstand
// fuer eine Duene, die an einer Bandstelle besonders tief liegt.
const WEED_MAX_DEPTH = 45;
// Und wie FLACH sie hoechstens stehen duerfen. Gerechnet, nicht geschaetzt: das hoechste Objekt ist
// ein Seegrasbueschel mit 5,6 m (Koralle 4,2 m), und die Wellenflaeche sinkt im Tal auf -2,33 m.
// 5,6 + 2,33 = 7,9 m waeren die Grenze, bei der eine Spitze die Flaeche gerade beruehrt — 9 m gibt
// 1,1 m Luft. Vorher stand die Grenze bei 1,4 m, also ragten Pflanzen bis 4,2 m HERAUS.
const UW_PLANT_MIN_DEPTH = 9;
// Wo das Pflanzband liegt, als Anteil von SHELF_W. Beide Werte sind die Umkehrung des
// smoothstep-Schelfs aus seabedY fuer die zwei Tiefengrenzen (9 m und 40 m) bei SEA_DEPTH 100.
// Wer SEA_DEPTH aendert, muss sie nachrechnen — sonst stehen Pflanzen wieder im Flachen oder
// die Haelfte faellt durch den Filter.
const UW_PLANT_BAND0 = 0.172;   // Beginn: die 9-m-Linie
// Breite bis zur 25-m-Linie (0,325 - 0,172). Bewusst SCHMAL, und das ist der wirksamste Hebel fuer
// "es gibt kein leben auf dem boden": nachgerechnet fuer eine 260-m-Insel ist das Band bis 60 m
// Tiefe 157 m breit (286.000 m2), dieselbe Objektzahl steht darin alle 55 m — verloren. Bis 25 m
// sind es 59 m Breite (108.000 m2) und ein Abstand von 34 m, und die Pflanzen bleiben im hellen
// Bereich, wo man sie auch sieht.
const UW_PLANT_BANDW = 0.153;
// ---- BODENBEWUCHS AUF OFFENER SEE --------------------------------------------------------------
// Gemeldet als "ich sehe auch keine pflanzen oder ähnliches unter wasser. keine wracks etc." — und
// nachgerechnet stimmt das fuer den Ort, an dem man faehrt: Pflanzen standen NUR in einem 61 m
// breiten Ring um Inseln, das sind 11 % der Weltflaeche. Auf offenem Meer war der Grund leer.
//
// Das war als "die Tiefsee DARF leer sein" begruendet und ist als Physik richtig, im Spiel aber
// falsch: der Meeresboden ist die einzige Referenz, an der man unter Wasser Fahrt und Richtung
// ablesen kann. Also bekommt er ueberall Struktur — in der Tiefe andere Formen als am Riff.
//
// Die Formen sind an den mitgelieferten Modellen abgeschaut (deep_water_coral: verzweigte Stoecke
// unterschiedlicher Groesse in einem Buschel; underwater_scene: Felsbrocken und Schwaemme auf Sand)
// und dann als einfache Geometrie nachgebaut. Die Modelle selbst waeren nicht tragbar gewesen: die
// Koralle allein hat 151.616 Dreiecke, und im Riff stehen 850 Stueck gleichzeitig — das waeren
// 129 Mio. Dreiecke. Nachgebaut kostet ein Busch 20 bis 40.
const DEEP_PER_CELL = 26;     // Objekte je Zelle auf offener See
// Farben fuer die Tiefe: dort ist alles blaustichig und blass, weil Rot als erstes verschwindet.
// Das ist derselbe Grund, aus dem die Wracks braungruen sind.
const spongeMat = new THREE.MeshLambertMaterial({ color:0x8f7f9c });   // Schwamm, violettgrau
const sponge2Mat= new THREE.MeshLambertMaterial({ color:0xa8886f });   // Schwamm, sandbraun
// uwRockMat und nicht rockMat: den Namen gibt es schon fuer die braunen Gipfel der Inselberge
// (siehe dort). Unter Wasser ist Gestein blaugrau, nicht braun — Rot verschwindet im Wasser zuerst.
const uwRockMat = new THREE.MeshLambertMaterial({ color:0x6b7480 });   // Felsbrocken am Grund
// Ein Tiefenschwamm: ein bis drei Roehren unterschiedlicher Hoehe aus einem Fuss. Abgeschaut an den
// Roehrenschwaemmen im underwater_scene-Modell, gebaut aus offenen Zylindern.
function makeSponge(rnd, rnd2){
  const g = new THREE.Group();
  const mat = rnd < 0.5 ? spongeMat : sponge2Mat;
  const n = 1 + Math.floor(rnd2*3);
  for(let i=0;i<n;i++){
    const h = 1.8 + rnd*3.2 * (1 - i*0.25);
    const r = 0.45 + rnd2*0.5;
    // openEnded: eine Roehre ist innen hohl, und von der Seite sieht man das an der Kante.
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r*0.85, r, h, 7, 1, true), mat);
    tube.position.set((i-1)*r*1.6*rnd2, h/2, (rnd-0.5)*r*2);
    tube.rotation.z = (rnd2-0.5)*0.35;
    g.add(tube);
  }
  return mergeGroup(g, mat) || g;      // ein Draw-Call statt bis zu drei (siehe mergeGroup)
}
// Ein Felsbrocken: eine gestauchte Kugel mit wenigen Segmenten, damit sie kantig wirkt. Kantig ist
// hier richtig — ein runder Stein sieht nach Ball aus, ein facettierter nach Gestein.
function makeRock(rnd, rnd2){
  const r = 1.4 + rnd*3.0;
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), uwRockMat);
  m.scale.set(1, 0.55 + rnd2*0.4, 0.8 + rnd*0.4);
  m.position.y = r*0.3;
  m.rotation.set(rnd*0.4, rnd2*Math.PI*2, rnd2*0.4);
  return m;
}
// Ein verzweigter Korallenbusch, abgeschaut an deep_water_coral: mehrere Stoecke unterschiedlicher
// Hoehe aus einem Punkt, oben leicht verdickt. Deutlich besser als die alte Form (ein Zylinder mit
// zwei Kugeln), und mit 3 bis 5 Zylindern nicht teurer.
function makeCoralBush(rnd, rnd2){
  const g = new THREE.Group();
  const mat = rnd < 0.5 ? coralMat : coral2Mat;
  const n = 3 + Math.floor(rnd2*3);
  for(let i=0;i<n;i++){
    const h = 1.4 + rnd*2.4 * (0.6 + (i%3)*0.2);
    const r = 0.22 + rnd2*0.25;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(r*0.6, r, h, 5), mat);
    const a = (i/n)*Math.PI*2 + rnd*2;
    const neig = 0.15 + rnd2*0.35;
    // Schraeg nach aussen: die Zweige spreizen sich, statt parallel zu stehen.
    br.position.set(Math.cos(a)*h*0.28, h/2*Math.cos(neig), Math.sin(a)*h*0.28);
    br.rotation.set(Math.sin(a)*neig, 0, -Math.cos(a)*neig);
    g.add(br);
    // Verdickte Spitze, wie bei einer Steinkoralle.
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r*1.5, 5, 3), mat);
    tip.position.set(Math.cos(a)*h*0.55, h*Math.cos(neig), Math.sin(a)*h*0.55);
    g.add(tip);
  }
  // Zu EINEM Mesh verschmelzen (siehe mergeGroup): ein Busch besteht aus 6 bis 10 Teilen, die alle
  // dasselbe Material haben — daraus wird ein einziger Draw-Call. Bei 34 Buschen je Zelle und
  // 9 Zellen sind das rund 2.100 Calls weniger.
  return mergeGroup(g, mat) || g;
}
// ---- STANDORTTREUE FISCHSCHWAERME an Wracks und Riffen -----------------------------------------
// "gerne auch fest um die wracks und korallen drum rum dann sieht das meer lebendig aus" — und das
// ist auch biologisch das Richtige: Rifffische bleiben an ihrem Riff, nur Schwarmfische im Freiwasser
// wandern. Die wandernden Schwaerme (fishSchools) bleiben also und bekommen hier Gesellschaft.
//
// Der Unterschied im Aufbau ist wesentlich: diese Schwaerme haengen in der ZELLEN-GROUP, werden also
// mit ihr geladen und weggeraeumt und brauchen keine eigene Verwaltung. Sie bewegen sich auch nicht
// von der Stelle — sie kreisen um ihren Punkt. Deshalb genuegt EINE Matrixberechnung beim Aufbau,
// und die Animation laeuft ueber die Rotation der ganzen Group: ein Draw-Call, kein Rechenaufwand
// pro Fisch und Frame.
const REEF_FISH_N   = 22;     // Fische je Schwarm. Kleiner als die wandernden (34): ein Riffschwarm
                              // steht dichter zusammen, und es gibt viel mehr davon.
const REEF_FISH_R   = 6;      // m Radius der Wolke
const reefFishMats = [
  // Drei Farben, damit nicht jedes Riff gleich aussieht. Riffische sind bunt, aber im blauen Licht
  // bleibt davon wenig — deshalb gedeckte Toene mit einem Farbstich statt Signalfarben.
  new THREE.MeshLambertMaterial({ color:0x9fd6cf }),   // silbrig-blaugruen, wie die wandernden
  new THREE.MeshLambertMaterial({ color:0xe8c98a }),   // sandgelb
  new THREE.MeshLambertMaterial({ color:0xc79ad6 }),   // violett
];
let reefFishGeo = null;
// Einen standorttreuen Schwarm bauen. mx/my/mz ist sein Mittelpunkt, rnd steuert Farbe und Form.
function makeReefFish(mx, my, mz, rnd, rnd2){
  if(!reefFishGeo){
    reefFishGeo = new THREE.SphereGeometry(0.28, 6, 4);
    reefFishGeo.scale(1, 0.55, 2.4);      // flach und lang: ein Fischkoerper, wie bei den wandernden
  }
  const mat = reefFishMats[Math.floor(rnd*reefFishMats.length) % reefFishMats.length];
  const im = new THREE.InstancedMesh(reefFishGeo, mat, REEF_FISH_N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const p = new THREE.Vector3(), s = new THREE.Vector3(1,1,1);
  for(let i=0;i<REEF_FISH_N;i++){
    // Auf einer flachen Wolke verteilt: Riffische stehen breit ueber dem Riff, nicht als Kugel.
    // Der goldene Winkel streut sie gleichmaessig, ohne Zufall pro Fisch — dieselbe Technik wie bei
    // den wandernden Schwaermen.
    const a = i*2.399 + rnd*6.283;
    const rr = REEF_FISH_R * Math.sqrt((i+0.5)/REEF_FISH_N);
    p.set(Math.cos(a)*rr, (rnd2-0.5)*2.5 + Math.sin(a*1.7)*1.2, Math.sin(a)*rr*0.8);
    // Nase tangential zur Kreisbahn: so sieht es aus, als schwimme der Schwarm im Kreis.
    q.setFromEuler(new THREE.Euler(0, a + Math.PI/2, 0, 'YXZ'));
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
  }
  // Der Halter traegt die Position; die Animation dreht IHN, nicht die einzelnen Fische.
  const halter = new THREE.Group();
  halter.add(im);
  halter.position.set(mx, my, mz);
  // Eigene Drehgeschwindigkeit und -richtung, damit nicht alle Schwaerme im Gleichschritt kreisen.
  halter.userData.spin = (0.10 + rnd2*0.22) * (rnd < 0.5 ? 1 : -1);
  return halter;
}
// Alle standorttreuen Schwaerme drehen. Sie stehen in den uwCells, also wird ueber die gelaufen —
// eine eigene Liste waere doppelte Buchhaltung und muesste beim Zellenwechsel mitgepflegt werden.
function updateReefFish(dt){
  if(locale !== 'earth') return;
  for(const [, grp] of uwCells){
    if(!grp || !grp.userData.reefFish) continue;
    for(const h of grp.userData.reefFish) h.rotation.y += h.userData.spin * dt;
  }
}
function buildUwCell(cx, cz){
  const g = new THREE.Group();
  let leer = true;
  // Liste der standorttreuen Schwaerme dieser Zelle. updateReefFish dreht sie; sie haengen in
  // dieser Group, werden also mit der Zelle geladen und weggeraeumt.
  const reefFish = [];
  // Alle Wracks der Zelle (bis zu WRECK_TRIES, siehe wreckInfos).
  const wracks = wreckInfos(cx, cz);
  for(let wnr=0; wnr<wracks.length; wnr++){
    const wi = wracks[wnr];
    const w = makeWreck(wi);
    if(!w) continue;
    g.add(w); leer = false;
    // ZWEI Schwaerme ueber dem Wrack, versetzt. Ein Wrack ist ein kuenstliches Riff und zieht
    // Fische an — und genau das macht den Fund lebendig statt zu einem stillen Haufen Stahl.
    // wnr geht in den Salt ein, sonst kreisten ueber dem zweiten Wrack einer Zelle dieselben
    // Schwaerme in derselben Anordnung wie ueber dem ersten.
    for(let k=0;k<2;k++){
      const rk = cellRnd(cx, cz, 1600+k*3+wnr*7), rk2 = cellRnd(cx, cz, 1601+k*3+wnr*7);
      const fh = makeReefFish(wi.wx + (rk-0.5)*40, wi.y + 12 + rk2*14, wi.wz + (rk2-0.5)*40,
                              rk, rk2);
      g.add(fh); reefFish.push(fh);
    }
  }
  // Vegetation GEZIELT auf dem Schelf, nicht ueber die Zelle gestreut. Der erste Versuch verwarf
  // 34 von 40 Objekten (nachgemessen), weil eine 850-m-Zelle fast nur Tiefwasser ist und nur der
  // 400-m-Saum um eine Insel in Frage kommt. Jetzt wird die Insel der Zelle gesucht und ringsum
  // im Schelfband gesetzt: praktisch jedes Objekt bleibt stehen, und sie liegen dort, wo sie
  // hingehoeren — als Riff um die Insel, im Licht.
  // Traegt die Zelle keine Insel, waechst hier auch nichts (Tiefsee ist leer, und das ist richtig).
  const isl = islandInfo(cx, cz);
  if(isl){
    for(let i=0;i<WEED_PER_CELL+CORAL_PER_CELL;i++){
      const coral = i >= WEED_PER_CELL;
      const r1 = cellRnd(cx, cz, 780+i*3), r2 = cellRnd(cx, cz, 781+i*3), r3 = cellRnd(cx, cz, 782+i*3);
      // Rings um die Insel, im Band zwischen Sandkante und WEED_MAX_DEPTH. Die Kante selbst wird
      // ausgelassen (Faktor ab 1,04), sonst stehen Bueschel im Strand.
      const ang = r1*Math.PI*2;
      // Bandbreite 0,30 und nicht 0,55 mal SHELF_W — NACHGERECHNET, nicht geschaetzt: bei 0,55
      // reichte das Band 220 m hinaus, die 40-m-Tiefengrenze liegt aber schon bei rund 107 m
      // (aus dem smoothstep: 40 m Tiefe entsprechen sm = 0,195, also f = 0,27 von SHELF_W). Die
      // Haelfte aller Objekte fiel damit hinter der Grenze weg — gemessen 20,1 von 40.
      // Das Band liegt GENAU zwischen den beiden Tiefengrenzen, statt an der Sandkante anzufangen.
      // Nachgerechnet fuer SEA_DEPTH 100: die 9-m-Linie (UW_PLANT_MIN_DEPTH) liegt 0,172*SHELF_W
      // draussen, die 40-m-Linie (WEED_MAX_DEPTH) bei 0,428. Faengt das Band an der Kante an,
      // faellt alles Innere durch den Tiefenfilter — bei 0,42 Breite waren das 41 % der Wuerfe.
      // So bleibt praktisch jeder stehen, und die Pflanzen sitzen dort, wo sie hingehoeren.
      const rr = isl.radius*BEACH_FACTOR + (UW_PLANT_BAND0 + r2*UW_PLANT_BANDW)*SHELF_W;
      const x = isl.wx + Math.cos(ang)*rr, z = isl.wz + Math.sin(ang)*rr;
      if(isOnLand(x, z) || isOnBeach(x, z)) continue;       // andere Insel dazwischen
      const y = seabedY(x, z);
      // Nach unten die Lichtgrenze, nach oben MIT SICHERHEITSABSTAND unter die Wellen. Vorher
      // stand hier SEABED_SHORE_Y - 0,2 (also -1,4 m), und das war zu flach: eine Koralle ist bis
      // 4,2 m hoch, ein Seegrasbueschel bis 5,6 m — die Spitzen ragten aus dem Wasser, und weil
      // die Wellenflaeche um +-2,4 m wandert, sah es aus, als schwaemmen sie mit ihr mit.
      if(y < -WEED_MAX_DEPTH || y > -UW_PLANT_MIN_DEPTH) continue;
      // makeCoralBush statt der alten makeCoral: die war ein Zylinder mit zwei Kugeln obendrauf und
      // sah nach Poller aus (genau so gemeldet). Der Busch ist an deep_water_coral abgeschaut —
      // mehrere verzweigte Stoecke unterschiedlicher Hoehe — und kostet kaum mehr.
      const o = coral ? makeCoralBush(r3, r1) : makeWeed(r3, r2);
      o.position.set(x, y, z);
      o.rotation.y = r3*Math.PI*2;
      g.add(o);
      leer = false;
      // Ueber jedem achten Korallenbusch ein Schwarm. Nicht ueber jedem: dann waere das Riff eine
      // Fischwand. Achtel heisst bei 34 Buescheln rund vier Schwaerme je Insel — genug, dass
      // ueberall Leben ist, wenig genug, dass man die Korallen noch sieht.
      if(coral && r1 < 0.125){
        const fh = makeReefFish(x, y + 4 + r2*6, z, r1*8, r2);
        g.add(fh); reefFish.push(fh);
      }
    }
  }
  // ---- OFFENE SEE: Bewuchs auch OHNE Insel in der Zelle. Vorher gab es hier nichts, und das war
  // der Grund fuer "ich sehe auch keine pflanzen oder ähnliches unter wasser": die Vegetation stand
  // nur in einem 61 m breiten Ring um Inseln, nachgerechnet 11 % der Weltflaeche. Wer auf offenem
  // Meer taucht, sah einen leeren Grund — und damit keine Referenz fuer die eigene Bewegung.
  //
  // Verteilt wird ueber die ganze Zelle, deterministisch wie alles hier. Die Objekte stehen auf dem
  // Grund (seabedY), also auch auf den Duenen und Haengen.
  for(let i=0;i<DEEP_PER_CELL;i++){
    const r1 = cellRnd(cx, cz, 1400+i*4), r2 = cellRnd(cx, cz, 1401+i*4);
    const r3 = cellRnd(cx, cz, 1402+i*4), r4 = cellRnd(cx, cz, 1403+i*4);
    const x = cx*CELL + (r1-0.5)*CELL*0.92, z = cz*CELL + (r2-0.5)*CELL*0.92;
    if(isOnLand(x, z) || isOnBeach(x, z)) continue;
    const y = seabedY(x, z);
    // Nicht im Flachwasser: dort steht schon die Riff-Vegetation, und ein Felsbrocken duerfte nicht
    // aus dem Wasser ragen. Dieselbe Grenze wie fuer die Pflanzen.
    if(y > -UW_PLANT_MIN_DEPTH) continue;
    // Was waechst hier? Felsen ueberall, Schwaemme und Korallenbuesche eher im mittleren Wasser.
    // Kein Dogma, sondern Abwechslung: drei Formen, damit der Grund nicht gestempelt wirkt.
    const o = r4 < 0.40 ? makeRock(r3, r4)
            : r4 < 0.75 ? makeSponge(r3, r4)
                        : makeCoralBush(r3, r4);
    o.position.set(x, y, z);
    o.rotation.y = r3*Math.PI*2;
    g.add(o);
    leer = false;
  }
  if(reefFish.length) g.userData.reefFish = reefFish;
  return leer ? null : g;
}
function updateUwCells(){
  const F = worldFocus();
  const pcx = Math.round(F.x / CELL), pcz = Math.round(F.z / CELL);
  const needed = new Set();
  // EINE Zelle pro Frame, nicht alle fehlenden. Vorher wurden beim ersten Eintauchen 25 Zellen mal
  // 616 Meshes in einem einzigen Frame erzeugt — 15.400 Objekte, und das ist ein Ruckler, den man
  // nicht uebersehen kann. Verteilt auf 25 Frames (0,4 s) faellt es nicht auf, weil man nur 165 m
  // weit sieht und die naechste Zelle 850 m entfernt beginnt.
  // Dasselbe Verfahren wie updateSeabed mit seinen SEABED_ROWS_PER_FRAME.
  let gebaut = 0;
  for(let dz=-UW_VIEW_CELLS; dz<=UW_VIEW_CELLS; dz++) for(let dx=-UW_VIEW_CELLS; dx<=UW_VIEW_CELLS; dx++){
    const key = (pcx+dx) + ',' + (pcz+dz);
    needed.add(key);
    if(uwCells.has(key)) continue;
    if(gebaut >= 1) continue;      // erst im naechsten Frame weiter (siehe oben)
    // Die Vorlagen kommen asynchron (preloadSeaShips). Ist 'liberty' noch nicht da, wird die Zelle
    // NICHT als leer gemerkt — sonst blieben die Wracks fuer immer weg, wenn man schneller in der
    // Naehe ist als das GLB geladen war. Genau die Falle, die beim Kai-Feuerwehrboot schon einmal
    // aufgetreten ist (dort loest refreshIslands es).
    // GEZIELT warten: nur eine Zelle mit GROSSFUND braucht ein Schiffsmodell. Die alte Bedingung
    // hielt JEDE Zelle zurueck, bis beide Modelle geladen waren — also auch Pflanzen und Bewuchs,
    // die davon nichts brauchen. Sie ganz zu entfernen war aber ein Fehler: die Zelle wird unten
    // mit uwCells.set als FERTIG gemerkt und nie wieder gebaut, ein spaeter geladenes Modell kommt
    // also nie mehr an. Ergebnis war ein Grossfund, den es nie gab.
    if(wreckInfos(pcx+dx, pcz+dz).some(w=>w.gross && !shipTemplates[w.key])) continue;
    const grp = buildUwCell(pcx+dx, pcz+dz);
    if(grp) scene.add(grp);
    uwCells.set(key, grp);
    gebaut++;
  }
  let shared = null;
  for(const [key, grp] of uwCells){
    if(!needed.has(key)){ if(grp) dropFromScene(grp, shared || (shared = sharedGeos())); uwCells.delete(key); }
  }
}
function clearUwCells(){
  const shared = sharedGeos();
  for(const [, grp] of uwCells) if(grp) dropFromScene(grp, shared);
  uwCells.clear();
}
// ---- FISCHSCHWAERME ----------------------------------------------------------------------------
// Bewusst KEIN Modell: ein Schwarm sind viele kleine Koerper, und dafuer waere jedes GLB zu teuer
// (die Orcas sind Einzeltiere, deshalb dort ein Modell). Hier sind es abgeflachte Kugeln in einer
// InstancedMesh — 34 Fische kosten damit einen einzigen Draw-Call.
//
// Sie schwimmen als Wolke um einen Mittelpunkt, der selbst langsam wandert, jeder Fisch mit eigener
// Phase. Das reicht: aus 10 m sieht man Silhouetten, die sich bewegen, und mehr ist im Nebel gar
// nicht zu erkennen.
// Von 9 auf 14 wandernde Schwaerme, auf Wunsch ("und auch ueberall mehr fische"). Mit 34 Tieren
// pro Schwarm sind das 476 Fische auf 14 InstancedMeshes, also 14 Draw-Calls — vertretbar, weil
// jeder Schwarm nur EINEN kostet.
// Dazu kommen die STANDORTTREUEN Schwaerme an Wracks und Riffen (siehe buildUwCell): "gerne auch
// fest um die wracks und korallen drum rum, dann sieht das meer lebendig aus". Genau so verhalten
// sich echte Rifffische — sie bleiben an ihrem Riff, statt umherzuziehen.
const FISH_SCHOOLS = 14;        // wandernde Schwaerme um den Spieler
const FISH_PER     = 34;        // Fische pro Schwarm
const FISH_R       = 9;         // Radius der Wolke (m)
const FISH_SPD     = 1.8;       // m/s Wanderung des Schwarms
const FISH_SPAWN_MIN = 40, FISH_SPAWN_MAX = 260, FISH_DESPAWN = 420;
// Wie hoch UEBER DEM GRUND die Schwaerme schwimmen — nicht mehr als absolute Tiefe. Das war ein
// Fehler in beide Richtungen: erst standen sie auf grund+4 bis +14, also praktisch am Boden, und
// man sah sie beim Tauchen nie; daraufhin habe ich sie an eine feste Tiefe von 8 bis 35 m gehaengt
// — und weil der Grund bei 80 bis 120 m liegt, schwammen sie damit 45 bis 112 m darueber, also
// "praktisch an der wasseroberflaeche".
//
// 8 bis 30 m ueber dem Grund trifft beides: das U-Boot haelt 12 m Bodenfreiheit, faehrt also mitten
// durch diese Zone, und die Schwaerme sind trotzdem sichtbar vom Boden abgesetzt.
const FISH_OVER_MIN = 8, FISH_OVER_MAX = 30;
// Absolute Mindesttiefe, damit im Flachwasser nichts aus dem Meer ragt: der Wellenhub reicht bis
// 2,33 m herab und die Fischwolke schwingt selbst um 1,6 m. 8 m lassen gut 4 m Luft.
const FISH_MIN_Y = 8;
// Farbe: war 0xb9c46a, ein Gelbgruen — genau das, was als "das gelbe, was noch so rumschwimmt"
// aufgefallen ist. Ein silbriges Blaugruen sieht im Wasser nach Fisch aus statt nach Fremdkoerper.
const fishMat = new THREE.MeshLambertMaterial({ color:0x9fd6cf });
let fishGeo = null;
const fishSchools = [];
const _fishM = new THREE.Matrix4(), _fishQ = new THREE.Quaternion();
const _fishP = new THREE.Vector3(), _fishS = new THREE.Vector3(1,1,1);
function makeFishSchool(){
  if(!fishGeo){
    fishGeo = new THREE.SphereGeometry(0.32, 6, 4);
    fishGeo.scale(1, 0.55, 2.4);        // flach und lang: ein Fischkoerper
  }
  const im = new THREE.InstancedMesh(fishGeo, fishMat, FISH_PER);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return im;
}
// Ein Winkel im VORDEREN Kegel, um die Fahrtrichtung herum. Das ist der Fix zu einem stillen
// Missverhaeltnis: Schwaerme und Orcas werden bei DESPAWN (420 m) verworfen, aber nur bis
// SPAWN_MAX (260 bzw. 220 m) neu ausgesetzt — und zwar RUNDHERUM. Jeder zweite landete damit
// HINTER dem Fahrzeug und war sofort wieder faellig.
//
// NACHGEMESSEN (C:/tmp/fish4.js, 10 Minuten Vollfahrt mit dem U-Boot, 14 m/s):
//   rundherum   28,0 Umsetzungen/min, im Mittel  4,6 von 14 Schwaermen in Sicht
//   +-90 Grad   23,2                             5,8
//   +-60 Grad   21,3                             6,8
//   +-45 Grad   20,6                             7,2
// Also 24 % weniger Umsetzungen UND die Haelfte mehr sichtbare Schwaerme: beides verbessert sich,
// weil dieselbe Ursache hinter beidem steckt.
//
// +-60 Grad und nicht enger: bei +-45 Grad wird es kaum noch besser (0,7 Umsetzungen), aber der
// Kegel wird so schmal, dass man die Schwaerme nur noch geradeaus findet — links und rechts waere
// das Meer leer, und beim Drehen entstuende ein sichtbares Nachruecken.
//
// Im STAND (Tempo 0) hat der Kegel keine Richtung mehr und faellt auf Zufall zurueck; gemessen
// bleibt es dort bei 3,1 Umsetzungen/min wie vorher, also ohne Nachteil.
//
// Die Radien bleiben ausdruecklich UNVERAENDERT. SPAWN_MAX auf die Sichtgrenze zu ziehen war der
// naheliegende Gedanke, haette aber die DICHTE verfaelscht: dieselbe Zahl Schwaerme auf weniger
// Flaeche ist bei den Fischen der Faktor 2,14 (C:/tmp/fish2.js) — aus einem lebendigen Meer wuerde
// ein Aquarium.
const SPAWN_KEGEL = Math.PI/3;     // halber Oeffnungswinkel (60 Grad)
function spawnWinkel(){
  // Fahrtrichtung aus der Geschwindigkeit — und zwar der des BEZUGSPUNKTS, also derselben Logik wie
  // worldFocus: waehrend der EVA gehoert state.vel dem stehenden Fahrzeug und ist 0. Im
  // SCHLAUCHBOOT faehrt man aber, und dessen Fahrt steht in eva.boatVel (siehe stepDinghy).
  // Zu Fuss bleibt es bei 0 und damit beim Zufall, was richtig ist: ein Astronaut laeuft 3 m/s,
  // da wird ohnehin kaum etwas faellig.
  const v = (typeof eva !== 'undefined' && eva) ? eva.boatVel : state.vel;
  // Unter 0,5 m/s ist keine Richtung erkennbar (man steht) — dann rundherum wie vorher.
  if(!v || Math.hypot(v.x, v.z) < 0.5) return Math.random()*Math.PI*2;
  return Math.atan2(v.z, v.x) + (Math.random()-0.5)*2*SPAWN_KEGEL;
}
function placeFishSchool(f, fx, fz){
  for(let t=0;t<16;t++){
    const a = spawnWinkel();
    const d = FISH_SPAWN_MIN + Math.random()*(FISH_SPAWN_MAX-FISH_SPAWN_MIN);
    const x = fx + Math.cos(a)*d, z = fz + Math.sin(a)*d;
    if(isOnLand(x, z) || isOnBeach(x, z)) continue;
    const grund = seabedY(x, z);
    if(grund > -FISH_MIN_Y - 2) continue;            // zu flach fuer einen Schwarm
    f.x = x; f.z = z;
    // HOEHE UEBER DEM GRUND, nicht absolute Tiefe (siehe FISH_OVER_MIN): dort ist das Leben, und
    // dort faehrt auch das U-Boot. Mit einer festen Tiefe schwammen sie bei 80 bis 120 m Grund
    // hoch oben im Freiwasser.
    f.y = grund + FISH_OVER_MIN + Math.random()*(FISH_OVER_MAX - FISH_OVER_MIN);
    // Im Flachwasser nicht bis an die Oberflaeche: dort gewinnt die absolute Grenze.
    if(f.y > -FISH_MIN_Y) f.y = -FISH_MIN_Y;
    f.heading = Math.random()*Math.PI*2;
    f.t = Math.random()*100;
    return true;
  }
  return false;
}
// Schwaerme abraeumen. Herausgezogen, weil earthWorldVisible(false) sie SOFORT loswerden muss:
// updateFish laeuft im Loop erst nach dem Ortswechsel, und in dem einen Frame dazwischen stehen
// die Fische schon im Weltall. Nachgemessen hingen nach enterSpace() alle 5 InstancedMeshes noch
// in der Szene — dasselbe Muster wie clearSeaShips und clearOrcas, die genau deshalb dort stehen.
function clearFish(){
  for(const f of fishSchools) if(f.mesh) scene.remove(f.mesh);
  fishSchools.length = 0;
}
function updateFish(dt){
  if(locale !== 'earth'){
    if(fishSchools.length) clearFish();
    return;
  }
  const F = worldFocus();
  while(fishSchools.length < FISH_SCHOOLS){
    const f = { mesh:null, x:0, y:0, z:0, heading:0, t:0, placed:false };
    f.placed = placeFishSchool(f, F.x, F.z);
    fishSchools.push(f);
  }
  for(const f of fishSchools){
    if(!f.placed){ f.placed = placeFishSchool(f, F.x, F.z); continue; }
    if(!f.mesh){ f.mesh = makeFishSchool(); scene.add(f.mesh); }
    f.t += dt;
    f.heading += Math.sin(f.t*0.23 + f.x*0.01) * 0.4 * dt;
    const hx = -Math.sin(f.heading), hz = -Math.cos(f.heading);
    f.x += hx*FISH_SPD*dt; f.z += hz*FISH_SPD*dt;
    // Vor Land abdrehen und ueber dem Grund bleiben (er steigt zum Ufer hin an).
    if(isOnLand(f.x + hx*20, f.z + hz*20) || isOnBeach(f.x + hx*20, f.z + hz*20))
      f.heading += 1.5*dt*(1+Math.random());
    // Der Schwarm WANDERT, der Grund aendert sich also unter ihm. Deshalb wird die Hoehe hier
    // nachgefuehrt: sonst haengt ein Schwarm, der ueber einen Hang zieht, ploetzlich 60 m hoch
    // oder steckt im Boden.
    const grund = seabedY(f.x, f.z);
    const soll = grund + (FISH_OVER_MIN + FISH_OVER_MAX)*0.5;
    f.y += (soll - f.y) * Math.min(1, 0.35*dt);   // sanft, damit es kein Springen gibt
    if(f.y < grund + 3) f.y = grund + 3;
    // Deckel nach oben: FISH_MIN_Y (8 m). Der Wellenhub reicht bis -2,33 m herab und die Wolke
    // schwingt um +-1,6 m — naeher an der Oberflaeche ragten Fische heraus (waren als gelbe
    // Punkte auf dem Meer aufgefallen).
    if(f.y > -FISH_MIN_Y) f.y = -FISH_MIN_Y;
    if(Math.hypot(f.x-F.x, f.z-F.z) > FISH_DESPAWN){ placeFishSchool(f, F.x, F.z); continue; }
    // Nur rechnen, was man sehen kann: bei 16-42 m Sichtweite ist alles Weitere im Nebel.
    const nah = Math.hypot(f.x-camera.position.x, f.z-camera.position.z) < 200;
    f.mesh.visible = nah;
    if(!nah) continue;
    for(let i=0;i<FISH_PER;i++){
      const ph = f.t*0.9 + i*2.399;                 // 2,399 rad = goldener Winkel, streut gleichmaessig
      const rr = FISH_R * (0.35 + 0.65*((i*37)%100)/100);
      const px = f.x + Math.cos(ph)*rr;
      const pz = f.z + Math.sin(ph)*rr*0.7;
      const py = f.y + Math.sin(ph*1.7 + i)*1.6;
      _fishP.set(px, py, pz);
      // Nase in Schwimmrichtung: die Tangente der Kreisbahn.
      _fishQ.setFromEuler(new THREE.Euler(0, Math.atan2(-Math.sin(ph), -Math.cos(ph)*0.7) + Math.PI/2, 0, 'YXZ'));
      _fishM.compose(_fishP, _fishQ, _fishS);
      f.mesh.setMatrixAt(i, _fishM);
    }
    f.mesh.instanceMatrix.needsUpdate = true;
  }
}
// ---- BEWEGUNGSREFERENZ: Blasen, Staub, Pollen ---------------------------------------------------
// Gemeldet an drei Stellen, und es ist ueberall derselbe Mangel: "wenn man unterwasser ist fehlt
// eine referenz, die einem merken laesst das man faehrt", und dasselbe "beim astronaut beim laufen
// oder beim xwing im weltall — das pure schwarz oder die homogene wiese lassen die bewegung nicht
// spueren, obwohl man mit 22 km/h ja eigentlich schnell unterwegs ist".
//
// Der Grund ist Winkelgeschwindigkeit: was NAH ist, zieht sichtbar vorbei; was weit ist, steht.
// Unter Wasser, im All und ueber einer gleichmaessigen Wiese gibt es nichts Nahes — also fehlt das
// Tempogefuehl, egal wie schnell man wirklich ist.
//
// Ein Feld kleiner Partikel in einem Wuerfel um die Kamera loest das fuer alle drei Faelle. Wer
// hinausfaellt, kommt auf der Gegenseite wieder herein (Torus): die Dichte bleibt konstant, es
// wird nie etwas erzeugt oder geloescht, und weil die Partikel im WELTraum stehen, wandern sie
// relativ zum Spieler — sie zeigen also genau dessen Bewegung.
//
// EINE InstancedMesh wie bei den Fischen, also ein Draw-Call. Kein THREE.Points: Punktgroessen sind
// in WebGL geraetabhaengig und werden auf vielen Tablets auf 1 px geklemmt, winzige Kugeln nicht.
const DRIFT_N     = 90;     // Partikel. Genug fuer den Eindruck, wenig genug fuers Budget.
const DRIFT_BOX   = 26;     // halbe Kantenlaenge des Wuerfels um die Kamera (m)
const DRIFT_MIN   = 2.5;    // naeher als das nicht: sonst klebt einem etwas auf der Linse
// Eigenbewegung je Ort. Unter Wasser STEIGEN Blasen (das ist ihr halber Reiz), im All und auf Mond
// und Mars steht der Staub still — dort bewegt sich nur der Spieler, und genau das soll man sehen.
const DRIFT_RISE  = 1.6;    // m/s Aufstieg der Blasen
let driftMesh = null, driftPos = null, driftKind = null;
const _drM = new THREE.Matrix4(), _drQ = new THREE.Quaternion();
const _drP = new THREE.Vector3(), _drS = new THREE.Vector3(1,1,1);
// Welche Sorte gehoert hierher? null heisst: hier braucht es keine (es gibt genug Bezug).
//   'bubble' unter Wasser, 'dust' im Weltall und auf Mond/Mars (zu Fuss oder im Rover).
// Im FLUGZEUG ueber der Insel bewusst NICHT: dort gibt es Wellen, Inseln, Haeuser und Wolken als
// Bezug, und Partikel vor der Nase saehen bei 500 km/h wie ein Fehler aus.
function driftKindNow(){
  if(uwBlend > 0.35) return 'bubble';
  // IM WELTALL keine Punkte mehr: sie sassen in einem 52-m-Wuerfel um die Kamera und waren dort
  // bis 55 px gross — "eher auch wie grafikfehler weil immer direkt im vordergrund und nicht in der
  // szene selbst". 52 m sind im All auch nichts, wo der Todesstern 20 km gross ist.
  // Ersetzt durch Kometenstreifen in 120 bis 900 m Entfernung (siehe updateComets).
  // Zu Fuss und im Rover auf MOND und MARS: dort ist der Boden ein graues, gleichmaessiges
  // Hoehenraster ohne Textur, da fehlt der Bezug wirklich. Physikalisch ist Staub im Vakuum
  // fragwuerdig, aber ohne ihn laeuft man dort im Nichts.
  //
  // AUF DER ERDE NICHT MEHR: dort hat die Wiese jetzt eine eigene Struktur mit Grasbuescheln und
  // Blueten (siehe makeGrassTexture), und die ist die bessere Referenz — man laeuft ueber eine
  // Oberflaeche, statt durch schwebende Punkte. Die Pollen waren dort ein Notbehelf, und als
  // Schneetreiben vor der Nase auch keine Zierde.
  //
  // Im Hangar ebenfalls nichts: dessen Boden hat Struktur, Waende und Kanten.
  if(eva && !eva.boat && GROUNDS[locale]) return 'dust';
  return null;
}
function driftEnsure(kind){
  if(driftKind === kind) return;
  driftKind = kind;
  if(driftMesh){ scene.remove(driftMesh); driftMesh = null; }
  if(!kind) return;
  // Groesse und Farbe je Sorte. Blasen sind die groessten und hellsten (man soll sie sehen),
  // Staub im All ist fein und grau, Pollen dazwischen und warm.
  const g = kind === 'bubble' ? new THREE.SphereGeometry(0.16, 6, 4)
                              : new THREE.SphereGeometry(0.10, 5, 3);
  const c = kind === 'bubble' ? 0xdffbff : 0xb9c6d8;
  // MeshBasic und nicht Lambert: diese Partikel sollen ueberall gleich hell sein, auch im All ohne
  // Streulicht und unten im dunklen Wasser. Mit Lambert waeren sie genau dort unsichtbar, wo sie
  // gebraucht werden. depthWrite aus, damit sie sich nicht gegenseitig ausstanzen.
  const m = new THREE.MeshBasicMaterial({ color:c, transparent:true,
                                          opacity: kind === 'bubble' ? 0.75 : 0.55,
                                          depthWrite:false });
  driftMesh = new THREE.InstancedMesh(g, m, DRIFT_N);
  driftMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  driftMesh.frustumCulled = false;      // der Wuerfel umschliesst die Kamera; Culling wirft ihn sonst weg
  driftPos = new Float32Array(DRIFT_N*3);
  // Startverteilung rings um die Kamera, mit Mindestabstand.
  for(let i=0;i<DRIFT_N;i++) driftPlace(i);
  scene.add(driftMesh);
}
// Ein Partikel im Wuerfel um die Kamera setzen, mit Mindestabstand zur Linse.
function driftPlace(i){
  const c = camera.position;
  let x, y, z, n = 0;
  do {
    x = c.x + (Math.random()*2-1)*DRIFT_BOX;
    y = c.y + (Math.random()*2-1)*DRIFT_BOX;
    z = c.z + (Math.random()*2-1)*DRIFT_BOX;
    n++;
  } while(n < 8 && Math.hypot(x-c.x, y-c.y, z-c.z) < DRIFT_MIN);
  driftPos[i*3] = x; driftPos[i*3+1] = y; driftPos[i*3+2] = z;
}
const _drLast = new THREE.Vector3();
let _drHas = false;
function updateDrift(dt){
  const kind = driftKindNow();
  driftEnsure(kind);
  if(!kind || !driftMesh) return;
  const c = camera.position;
  // KAMERASPRUNG erkennen und das Feld neu setzen. Die Partikel stehen in Weltkoordinaten um die
  // Kamera; ein Ortswechsel springt aber ueber Kilometer (ins All 20.000 m), und dann liegt der
  // ganze Wuerfel dort, wo man war. Der Torus unten holt das nicht ein, er schiebt nur um eine
  // Kantenlaenge.
  //
  // Warum hier und nicht per clearDrift() in jedem Ortswechsel: es gibt acht Stellen, die locale
  // umsetzen, und zwei davon (leaveHangar, leaveGround) rufen earthWorldVisible nicht auf — dort
  // haette der Aufruf gefehlt. Ein Sprungtest deckt alle ab, auch kuenftige. Schwelle ist eine
  // Wuerfelkante: normale Fahrt macht selbst bei 500 km/h nur 2,3 m pro Frame.
  if(_drHas && _drLast.distanceTo(c) > DRIFT_BOX*2){
    for(let i=0;i<DRIFT_N;i++) driftPlace(i);
  }
  _drLast.copy(c); _drHas = true;
  // Eigenbewegung der Partikel (nicht die des Spielers — die entsteht automatisch daraus, dass
  // die Partikel im Weltraum stehen und die Kamera sich bewegt).
  const vy = kind === 'bubble' ? DRIFT_RISE : 0;
  const L = DRIFT_BOX*2;
  for(let i=0;i<DRIFT_N;i++){
    let x = driftPos[i*3], y = driftPos[i*3+1] + vy*dt, z = driftPos[i*3+2];
    // TORUS: pro Achse um die ganze Kantenlaenge zurueckschieben, wenn der Wuerfel verlassen wird.
    // Nicht neu wuerfeln — das gaebe ein Flackern an den Raendern. So wandert dasselbe Partikel
    // auf der Gegenseite herein, was man nicht sieht, weil es 26 m entfernt passiert.
    if(x - c.x >  DRIFT_BOX) x -= L; else if(x - c.x < -DRIFT_BOX) x += L;
    if(y - c.y >  DRIFT_BOX) y -= L; else if(y - c.y < -DRIFT_BOX) y += L;
    if(z - c.z >  DRIFT_BOX) z -= L; else if(z - c.z < -DRIFT_BOX) z += L;
    // Blasen NICHT ueber die Wasserflaeche steigen lassen: dort platzen sie, also unten neu.
    if(kind === 'bubble' && y > seaYAt(x, z) - 0.5) y = c.y - DRIFT_BOX*0.8;
    driftPos[i*3] = x; driftPos[i*3+1] = y; driftPos[i*3+2] = z;
    _drP.set(x, y, z);
    _drM.compose(_drP, _drQ, _drS);
    driftMesh.setMatrixAt(i, _drM);
  }
  driftMesh.instanceMatrix.needsUpdate = true;
}
// ---- WELTALL: Mini-Kometen mit Schweif ---------------------------------------------------------
// Die Staubpunkte im All waren "eher auch wie grafikfehler weil immer direkt im vordergrund und
// nicht in der szene selbst". Nachgerechnet stimmt das: der Wuerfel war nur 52 m gross und der
// Mindestabstand 2,5 m — dort ist eine 0,1-m-Kugel 55 px breit und klebt auf der Linse. Und 52 m
// sind im Weltall nichts, wo der Todesstern 20 km und die ISS 2,4 km gross ist.
//
// Vorgeschlagen: "langgezogene streifen entgegen der fahrtrichtung. quasi mini kometen mit schweif
// tiefer in der szene drinnen". Das loest beides auf einmal — ein Streifen zeigt die Richtung von
// sich aus, und in der Tiefe der Szene wird er Teil der Umgebung statt eines Flecks davor.
const COMET_N     = 40;       // Kometen gleichzeitig
const COMET_NEAR  = 120;      // m: naeher kommt keiner (sonst wieder ein Streifen auf der Linse)
const COMET_FAR   = 900;      // m: Wuerfelradius. Weit genug, dass sie in der Szene stehen, nah
                              // genug, dass die Bewegung sichtbar vorbeizieht.
const COMET_LEN   = 45;       // m Streifenlaenge. Bei 300 m Abstand rund 90 px — deutlich als
                              // Strich erkennbar, ohne das Bild zu zerschneiden.
const COMET_W     = 0.9;      // m Streifenbreite
let cometMesh = null, cometPos = null, cometMat = null;
const _coM = new THREE.Matrix4(), _coQ = new THREE.Quaternion();
const _coP = new THREE.Vector3(), _coS = new THREE.Vector3(1,1,1);
const _coDir = new THREE.Vector3(), _coUp = new THREE.Vector3(0,1,0);
// Die Streifen-Textur: hell am Kopf, nach hinten auslaufend. Genau das macht aus einem Rechteck
// einen Kometenschweif, und weil sie zur Laufzeit gemalt wird, kostet sie keinen Download.
let cometTex = null;
function makeCometTexture(){
  if(cometTex) return cometTex;
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 8;
  const g = cv.getContext('2d');
  // Links der Kopf, nach rechts der Schweif. Nicht linear: der Kopf bleibt kompakt hell, der
  // Schweif verglimmt lang — ein linearer Verlauf saehe wie ein Keil aus, nicht wie ein Komet.
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0.00, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, 'rgba(230,240,255,0.85)');
  grad.addColorStop(0.40, 'rgba(200,220,255,0.30)');
  grad.addColorStop(1.00, 'rgba(180,200,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 8);
  // Quer dazu ebenfalls ausblenden, sonst hat der Streifen harte Laengskanten.
  const quer = g.createLinearGradient(0, 0, 0, 8);
  quer.addColorStop(0.0, 'rgba(0,0,0,1)');
  quer.addColorStop(0.5, 'rgba(0,0,0,0)');
  quer.addColorStop(1.0, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = quer;
  g.fillRect(0, 0, 64, 8);
  cometTex = new THREE.CanvasTexture(cv);
  return cometTex;
}
function cometEnsure(){
  if(cometMesh) return;
  // Die Ebene liegt in der XY-Ebene und zeigt nach +Z. Laengs der X-Achse ist der Schweif.
  const geo = new THREE.PlaneGeometry(1, 1);
  cometMat = new THREE.MeshBasicMaterial({ map:makeCometTexture(), transparent:true,
                                           opacity:0.9, depthWrite:false,
                                           // Additiv, weil ein Komet LEUCHTET. Auf dem schwarzen
                                           // Weltraum addiert sich das Licht sauber, und ueberlappende
                                           // Schweife verstaerken sich statt sich auszustanzen.
                                           blending:THREE.AdditiveBlending });
  cometMesh = new THREE.InstancedMesh(geo, cometMat, COMET_N);
  cometMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cometMesh.frustumCulled = false;      // das Feld umschliesst die Kamera
  cometPos = new Float32Array(COMET_N*3);
  for(let i=0;i<COMET_N;i++) cometPlace(i);
  scene.add(cometMesh);
}
// Einen Kometen neu setzen: irgendwo in der Kugelschale zwischen NEAR und FAR um die Kamera.
// Kugelschale und nicht Wuerfel, damit keiner in der Ecke doppelt so weit weg ist wie in der Mitte.
function cometPlace(i){
  const c = camera.position;
  const a = Math.random()*Math.PI*2;
  const b = Math.acos(Math.random()*2-1);        // gleichmaessig auf der Kugel
  const r = COMET_NEAR + Math.random()*(COMET_FAR-COMET_NEAR);
  cometPos[i*3]   = c.x + Math.sin(b)*Math.cos(a)*r;
  cometPos[i*3+1] = c.y + Math.cos(b)*r;
  cometPos[i*3+2] = c.z + Math.sin(b)*Math.sin(a)*r;
}
function updateComets(dt){
  // Nur im Weltall, und nur wenn man auch FAEHRT: im Stillstand gibt es keine Bewegung zu zeigen,
  // und ruhende Streifen saehen wieder wie ein Grafikfehler aus.
  const v = state.vel.length();
  if(locale !== 'space' || v < 20){
    if(cometMesh){ scene.remove(cometMesh); cometMesh = null; }
    return;
  }
  cometEnsure();
  const c = camera.position;
  // Die Streifen liegen ENTGEGEN der Fahrtrichtung — sie zeigen, woher man kommt, wie die
  // Sternenstreifen im Hyperraum. Richtung aus der eigenen Geschwindigkeit, nicht aus der Nase:
  // wer seitlich driftet, soll das auch sehen.
  _coDir.copy(state.vel).normalize();
  // Die Ebene ausrichten: ihre lokale X-Achse soll auf die Flugrichtung zeigen. setFromUnitVectors
  // dreht (1,0,0) dorthin — damit liegt der Kopf vorne und der Schweif hinten.
  _coQ.setFromUnitVectors(new THREE.Vector3(1,0,0), _coDir);
  // Laenge mit dem Tempo: bei Warp wird der Streifen lang, im Anflug kurz. Der Faktor ist gedeckelt,
  // sonst reicht ein Streifen bei Warp 10 durch das ganze Bild.
  const laenge = COMET_LEN * Math.min(3, 0.6 + v/SPACE_C*1.4);
  _coS.set(laenge, COMET_W, 1);
  for(let i=0;i<COMET_N;i++){
    const dx = cometPos[i*3]-c.x, dy = cometPos[i*3+1]-c.y, dz = cometPos[i*3+2]-c.z;
    const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
    // Wer hinausfaellt oder zu nah kommt, wird neu gesetzt. Anders als beim Torus des Drift-Feldes
    // ist das hier unauffaellig, weil es in 120 bis 900 m Entfernung passiert.
    if(d > COMET_FAR*1.15 || d < COMET_NEAR*0.7){ cometPlace(i); continue; }
    _coP.set(cometPos[i*3], cometPos[i*3+1], cometPos[i*3+2]);
    _coM.compose(_coP, _coQ, _coS);
    cometMesh.setMatrixAt(i, _coM);
  }
  cometMesh.instanceMatrix.needsUpdate = true;
}
function clearComets(){
  if(cometMesh){ scene.remove(cometMesh); cometMesh = null; }
}
function clearDrift(){
  if(driftMesh){ scene.remove(driftMesh); driftMesh = null; }
  driftKind = null;
  _drHas = false;        // sonst vergleicht der naechste Frame gegen eine Stelle von vorher
}
// Die Strand-U-Boote schwimmen mit der Duenung, wie die Kai-Feuerwehrboote (updateHarborBoats).
// Ohne das lagen sie fest auf y = 0, waehrend das Wasser um bis zu 1,6 m schwankt — bei einem
// Wellenberg waere der halbe Rumpf verschwunden.
// KEINE Untergrenze auf Inselhoehe wie beim Feuerwehrboot: dieses Boot liegt nicht mit dem Heck im
// Sand, sondern ganz im Wasser (HARBOR_SUB_FAC 1,30 setzt es hinter die Sandkante).
function updateHarborSubs(dt){
  if(locale !== 'earth') return;
  for(const [, isl] of islandCells){
    if(!isl) continue;
    const su = isl.userData.harborSub;
    if(!su) continue;
    const wx = isl.position.x + su.position.x, wz = isl.position.z + su.position.z;
    su.position.y = seaYAt(wx, wz, dt);
    // Leichtes Nicken mit der Welle ueber die halbe Rumpflaenge, damit es lebt. Ein 95-m-Boot
    // folgt der Duenung kaum (shipWaveFactor waere 120/95) — deshalb nur ein gedaempfter Anteil.
    const sfx = -Math.sin(su.rotation.y), sfz = -Math.cos(su.rotation.y);
    const bow = seaYAt(wx + sfx*40, wz + sfz*40, dt);
    const stn = seaYAt(wx - sfx*40, wz - sfz*40, dt);
    su.rotation.x = Math.atan2(bow - stn, 80) * 0.6;
  }
}
// ---- ORCAS ------------------------------------------------------------------------------------
// Killerwale (killer_whale_by_Trouvaille) in zwei Rollen, die sich EINE Herde teilt:
//   - SPRINGER: durchbricht die Oberflaeche, fliegt einen flachen Bogen und taucht wieder ein.
//   - SCHULE:   schwimmt an der Oberflaeche, taucht ganz ab, kommt wieder hoch (wie das U-Boot,
//               aber NICHT mit derselben Mechanik — siehe ORCA_DIVE, das ging hier nicht).
//
// AUSGEMESSEN mit Node-Matrizen (1.656 Punkte, siehe Memory glb-node-transformationen): roh
// 482,98 x 366,55 x 919,85, Laengsachse Z. Auf ORCA_LEN skaliert ist das Tier 8,00 m lang, 4,20 m
// breit und 3,19 m hoch. Die Breite sind die BRUSTFLOSSEN — der Koerper selbst ist rund 1,4 m dick.
// Der Aufbau in Modellhoehe (bei 8 m Laenge):
//    0,00 .. 0,20 m   Brustflossen, 4,20 m Spannweite
//    0,20 .. 1,40 m   Koerper, rund, bis 2,06 m breit
//    1,60 .. 3,19 m   Rueckenfinne, nur 0,12 bis 0,53 m breit
// 8 m ist die Laenge eines ausgewachsenen Bullen, passt also unskaliert.
const ORCA_LEN   = 8;
const ORCA_H     = 3.19;    // Modellhoehe im Spielmassstab
const ORCA_BACK  = 1.40;    // Ruecken (Koerperoberkante) ueber Modellunterkante
//
// SPRUNG: 45 Grad Abwurf, 10 m Scheitelhoehe, 40 m Weite, 2,86 s in der Luft.
//
// Die Werte sind gerechnet, nicht gewaehlt, und zwar gegen drei Grenzen:
//  1. Die Form. Ein Halbkreis mit Radius R ist 2R weit und R hoch — eine Wurfparabel dieser Form
//     braucht 63 Grad Abwurf und startet damit fast senkrecht. Das ist eine Delfin-Bahn; ein
//     5-t-Orca kommt flacher heraus, und gewuenscht war "leicht gebogen". Bei 45 Grad ist die
//     Weite das VIERFACHE der Hoehe (H = W/4), der Bogen also lang und flach.
//  2. Die Duenung. AMP 3,0 heisst +/-1,6 m, also 3,2 m Hub. Ein realistischer Sprung (echte Orcas
//     kommen 2 bis 3 m heraus) waere nur doppelt so hoch wie die Welle und ginge darin unter —
//     genau der Fehler, der beim U-Boot zu "nicht abtauchen gesehen" gefuehrt hat. 10 m sind das
//     Dreifache der Wellenhoehe. Bewusst ueberzeichnet.
//  3. Das Bildfeld. Die Bootskamera sitzt 32 m hinter dem Spieler bei 60 Grad FOV (viewConfigs[1]
//     mal CAM_CFG.Boat). Ein Sprung von 40 x 10 m passt ab 30 m Entfernung ganz ins Bild — deshalb
//     springen sie ab ORCA_SPAWN_MIN Metern querab und nicht direkt vor dem Bug.
const ORCA_JUMP_H = 10;                                   // Scheitelhoehe ueber der Wasserlinie
const ORCA_JUMP_A = Math.PI/4;                            // Abwurfwinkel, 45 Grad
const ORCA_G      = 9.81;
// v0 aus der Steighoehe: H = (v0 sin a)^2 / 2g  ->  v0 = sqrt(2 g H) / sin a = 19,8 m/s.
// Nicht als Zahl hinschreiben: wer ORCA_JUMP_H aendert, soll nicht drei Werte nachrechnen muessen.
const ORCA_JUMP_V = Math.sqrt(2*ORCA_G*ORCA_JUMP_H) / Math.sin(ORCA_JUMP_A);
const ORCA_JUMP_T = 2*ORCA_JUMP_V*Math.sin(ORCA_JUMP_A) / ORCA_G;   // 2,86 s in der Luft
// Zwischen zwei Spruengen schwimmt ein Springer eine Weile normal weiter — sonst huepft er wie ein
// Flummi. 9 s Pause auf 2,86 s Flug heisst: man sieht ihn ueberwiegend schwimmen und wird vom
// Sprung ueberrascht.
// Nach dem Eintauchen geht er GANZ unter Wasser und kommt dann wieder herauf — gewuenscht als
// "beim eintauchen ganz unter wasser gehen und dann wieder etwas auftauchen". Ein Wal schiesst
// hinein, wird gebremst (Wasser ist rund 800-fach dichter als Luft) und steigt wieder.
//
// Die Bahn ist ein Sinusbogen: y = swimY - ORCA_DIVE_J * sin(pi*s) mit s = 0..1 ueber
// ORCA_UNDER_T Sekunden. sin (nicht sin^2 oder smoothstep) hat an beiden Enden die Steigung pi —
// er taucht also MIT Fahrt ein und kommt MIT Fahrt heraus, statt an der Oberflaeche zu kleben.
//
// Die Tiefe ist NICHT frei gewaehlt, sondern ergibt sich aus der Forderung, dass der Nickwinkel
// beim Eintauchen nicht springt. In der Luft kommt er mit -45 Grad an, also vy/vh = -1. Unter
// Wasser ist vh = ORCA_SPD (er bremst sofort auf Schwimmtempo), gebraucht wird also vy = -ORCA_SPD.
// Das Senkrechttempo am Bogenanfang ist ORCA_DIVE_J * pi / ORCA_UNDER_T, damit:
//     ORCA_DIVE_J = ORCA_SPD * ORCA_UNDER_T / pi
// Bei 6 s sind das 6,11 m Tiefe, und atan2(-3,20; 3,2) ergibt genau -45,0 Grad — kein Knick.
// Nachgerechnet ist die Oberkante am tiefsten Punkt bei -3,87 m, also deutlich unter dem Wellental
// (-1,6 m): er ist wirklich ganz weg und nicht nur halb.
// Reisetempo: 11,5 km/h. Orcas schwimmen 8-12 km/h, in Spitzen 50. Steht HIER und nicht bei den
// anderen Herden-Werten weiter unten, weil ORCA_DIVE_J es braucht — const wird nicht gehoisted,
// eine Nutzung vor der Deklaration wirft beim Laden einen ReferenceError und das Spiel bleibt
// schwarz. Genau das war beim ersten Einbau dieser Zeile der Fall.
const ORCA_SPD      = 3.2;
const ORCA_UNDER_T  = 6;
const ORCA_DIVE_J   = ORCA_SPD * ORCA_UNDER_T / Math.PI;
// ANLAUF vor dem Absprung. Ohne ihn sprang die Nase in EINEM Frame von 0 auf +45 Grad — beim
// Eintauchen hatte ich auf Stetigkeit geachtet, beim Absprung nicht, und die Simulation hat den
// 44,8-Grad-Knick dann gefunden. Ein Wal springt auch nicht aus dem Stand: er sinkt kurz ab und
// schiesst heraus.
//
// Die Bahn ist f(s) = -A s^2 (1-s) mit s = 0..1 ueber ORCA_RUNUP_T Sekunden. Diese Form ist
// gewaehlt, weil sie an BEIDEN Enden passt:
//   f(0) = 0 und f'(0) = 0   -> sie geht waagerecht aus dem Schwimmen heraus, kein Knick
//   f(1) = 0 und f'(1) = +A  -> sie endet auf Schwimmhoehe und STEIGT dort schon
// Fuer die +45 Grad des Absprungs braucht es vy = ORCA_SPD (weil vh = ORCA_SPD), also A = ORCA_SPD
// mal ORCA_RUNUP_T. Die Anlauftiefe ergibt sich daraus: Minimum bei s = 2/3, dort 4A/27 = 1,90 m.
const ORCA_RUNUP_T  = 4;
const ORCA_RUNUP_A  = ORCA_SPD * ORCA_RUNUP_T;
// Ein ganzer Springer-Zyklus: schwimmen, Anlauf, Flug, tauchen. 19,86 s.
const ORCA_JUMP_CYCLE = ORCA_RUNUP_T + ORCA_JUMP_T + ORCA_UNDER_T + 7;
//
// SCHULE: das U-Boot-Verfahren (Modell heben und senken) geht hier NICHT.
// Beim U-Boot sind 5,8 m Tauchweg moeglich, weil das Modell 30 m hoch ist. Der Orca ist 3,19 m
// hoch — also KLEINER als der Wellenhub von 3,2 m. Jeder Weg, der ins Tier passt, verschwindet in
// der Duenung; man saehe ein Auf und Ab, das die Welle sowieso macht.
// Deshalb taucht die Schule RICHTIG: ORCA_DIVE m unter die Oberflaeche, mit Nickwinkel wie beim
// Sprung. Der Wechsel ist damit "da / nicht da" und bei jeder Wellenhoehe sichtbar. Das ist auch,
// was Orcas tun: 20 bis 40 s tauchen, dann zum Blasen hoch.
const ORCA_DIVE   = 7;      // Tauchtiefe: doppelte Wellenhoehe unter Wasser, sicher weg
const ORCA_PERIOD = 22;     // ein ganzer Zyklus (unten -> oben -> unten)
// ---- TIEFSEE-SCHULE: die dritte Rolle, fuer das U-Boot -----------------------------------------
// Aus den offenen Punkten: "Die Orcas tauchen nur 7 m. Von unten sieht man sie jetzt, aber sie
// bleiben knapp unter der Oberflaeche. Waere schoen, wenn eine Schule mal am U-Boot vorbeizieht."
//
// Warum ORCA_DIVE dafuer NICHT einfach groesser werden darf: seine 7 m sind begruendet (doppelte
// Wellenhoehe, damit das Abtauchen bei jeder Duenung sichtbar ist), und ein Tier, das 60 m tief
// geht, waere von einem BOOT aus nie mehr zu sehen. Die Oberflaechen-Schule soll bleiben, wie sie
// ist — es fehlt eine eigene Rolle.
//
// NACHGERECHNET (C:/tmp/orca1.js), warum die vorhandene Schule das nicht leistet: das U-Boot faehrt
// zwischen 0 und 88 m (SEA_DEPTH 100 minus SUB_FLOOR_CLR 12). Bei 50 m Reisetiefe ist ein Orca auf
// 7 m Tiefe 43 m UEBER dem Boot — man muesste senkrecht nach oben schauen, um ihn zu sehen. Am
// Grund sind es 81 m, also mehr als die halbe Sichtweite, und das senkrecht nach oben.
//
// Die Tiefsee-Schule zieht deshalb auf der Tiefe, auf der das BOOT gerade faehrt. Damit begegnet man
// ihr seitlich und auf Augenhoehe, und sie ist bis zur Sichtgrenze (UW_FOG_DEEP, 165 m) sichtbar.
// Sie folgt der Bootstiefe traege nach (ORCA_DEEP_VY): ein Tier, das jeder Tiefenaenderung sofort
// folgt, klebte am Boot wie ein Anhaenger. So zieht es seine Bahn und man begegnet ihm.
const ORCA_DEEP_N    = 3;    // so viele der ORCA_COUNT Tiere sind Tiefsee-Tiere (die Haelfte)
const ORCA_DEEP_BAND = 18;   // m Streuung um die Bootstiefe, damit sie nicht auf einer Linie ziehen
// Wie STEIL ein Tiefsee-Tier hoechstens steigt oder sinkt. Das ist die entscheidende Groesse, und
// sie ist aus derselben Formel wie bei der Oberflaechen-Schule genommen statt geraten: dort ist der
// Bahnwinkel hergeleitet zu atan2(1,50 m/s; 3,2 m/s) = 25 Grad, und ein Wal bewegt sich nicht
// steiler, weil er tiefer schwimmt.
//
// Ein erster Versuch war ein Anteil je Sekunde ("folge der Bootstiefe mit 6 % pro Frame"), und der
// war nachgerechnet falsch: er holte 50 m Tiefenunterschied in 0,6 s auf, mit 180 m/s Sinkrate im
// ersten Moment und 89 Grad Nickwinkel (C:/tmp/orca2.js). Das Tier haette senkrecht nach unten
// gestanden und waere in einer halben Sekunde am Ziel gewesen — beides sieht nach Fehler aus, nicht
// nach Wal. Der Fehler steckte in der Form: ein Anteil je Zeit hat keine Geschwindigkeitsgrenze.
//
// Mit einer festen Sinkrate folgt das Tier dem Boot in 33 s ueber 50 m. Das ist genau das traege
// Nachziehen, das gewuenscht war: die Schule klebt nicht am Boot, sondern zieht ihre eigene Bahn und
// kommt mit der Zeit auf Tiefe.
const ORCA_DEEP_PMAX = 25 * Math.PI/180;            // hoechster Bahnwinkel (wie die Schule oben)
const ORCA_DEEP_VY   = ORCA_SPD * Math.tan(ORCA_DEEP_PMAX);   // 1,49 m/s senkrecht
// Nicht hoeher als hier: darueber liegt die Zone der Oberflaechen-Schule und der Springer, und ein
// Tiefsee-Tier, das in den Wellenhub geraet, ragte heraus. ORCA_DIVE + ORCA_H ist genau die
// Unterkante der Springer-Zone.
const ORCA_DEEP_MIN  = ORCA_DIVE + ORCA_H;
const ORCA_SURF   = 0.45;   // Ruecken so weit ueber Wasser, wenn oben (ein Wal liegt flach)
// Wie viele, wie weit weg, wie schnell.
// Die Herde begleitet den Spieler wie die Handelsflotte, aber viel naeher: die Schiffe tauchen erst
// ab 1.200 m auf (SHIP_SPAWN_MIN), damit keins vor der Nase erscheint. Ein 8-m-Tier ist auf 1.200 m
// zwei Pixel gross — es MUSS naeher heran, sonst sieht man es nie. 60 bis 220 m ist die Spanne, in
// der ein Sprung ganz ins Bild passt (ab 30 m) und man ihn noch als Tier erkennt.
const ORCA_COUNT     = 6;
const ORCA_SPAWN_MIN = 60;
const ORCA_SPAWN_MAX = 220;
const ORCA_DESPAWN   = 420;     // weiter weg -> an neuer Stelle aussetzen
const ORCA_POD       = 26;      // Radius, in dem eine Gruppe zusammenbleibt
const orcas = [];               // {group, mixer, x, z, heading, t, jumper, y, pitch, placed}
let orcaTpl = null;             // Vorlage; Klone brauchen cloneSkinned (siehe unten)
let orcaLoading = false;        // laeuft gerade ein gl.parse? (siehe preloadOrca)
// Ein Modell mit Skeleton laesst sich NICHT mit .clone(true) vervielfaeltigen: SkinnedMesh.copy in
// three.js r128 uebernimmt das Skeleton PER REFERENZ (this.skeleton = t.skeleton, im Minifikat
// nachgelesen). Alle Klone haengen dann am selben Knochensatz und nehmen zwangslaeufig dieselbe Pose
// ein — sechs Orcas wuerden im Gleichschritt zappeln, egal wie die Mixer laufen.
// Genau das loest three.js' SkeletonUtils.clone; die Datei liegt nicht im Repo, und fuer einen
// Klon-Helfer lohnt sie nicht. Die Kurzfassung: normal klonen, dabei die Knochen-Klone nach Namen
// einsammeln, und jedem SkinnedMesh ein NEUES Skeleton aus genau diesen Knochen binden.
function cloneSkinned(src){
  const dst = src.clone(true);
  // Knochen im Klon nach Namen finden. Die Namen sind im Modell eindeutig (_rootJoint, joint2_00,
  // joint6_01, ... — 12 Joints, alle verschieden).
  const bones = {};
  dst.traverse((o)=>{ if(o.isBone) bones[o.name] = o; });
  // Die SkinnedMeshes beider Baeume in derselben Reihenfolge durchlaufen: traverse ist
  // deterministisch (Tiefensuche in Kind-Reihenfolge), und der Klon hat denselben Aufbau.
  const orig = [];
  src.traverse((o)=>{ if(o.isSkinnedMesh) orig.push(o); });
  let i = 0;
  dst.traverse((o)=>{
    if(!o.isSkinnedMesh) return;
    const src2 = orig[i++];
    if(!src2 || !src2.skeleton) return;
    const nb = src2.skeleton.bones.map((b)=> bones[b.name] || b);
    const inv = src2.skeleton.boneInverses.map((m)=> m.clone());
    // bindMatrix des Originals MITGEBEN, nicht neu berechnen lassen: bind() ohne zweites Argument
    // nimmt die aktuelle matrixWorld, und die haengt davon ab, wo der Klon gerade steht. Das Tier
    // wuerde je nach Spawnstelle verzerrt.
    o.bind(new THREE.Skeleton(nb, inv), src2.bindMatrix);
  });
  return dst;
}
// Die Vorlage einmal bauen: laden, auf ORCA_LEN normieren, Nase auf -Z (wie alle Flugzeuge und
// Schiffe), Unterkante auf y = 0. Die Animation wird hier NICHT gestartet — jeder Klon bekommt
// seinen eigenen Mixer mit eigenem Zeitversatz, sonst schlagen alle Fluken im Takt.
function preloadOrca(){
  // orcaLoading MUSS mitgeprueft werden, nicht nur orcaTpl: gl.parse arbeitet asynchron und setzt
  // orcaTpl erst im Callback. updateOrcas ruft diese Funktion aber JEDEN FRAME, solange die Vorlage
  // fehlt — ohne das Flag liefen bei 60 fps dutzende Parse-Vorgaenge parallel auf demselben GLB.
  if(!window.ORCA_GLB || !THREE.GLTFLoader || orcaTpl || orcaLoading) return;
  orcaLoading = true;
  const gl = new THREE.GLTFLoader();
  const b64 = window.ORCA_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(ORCA_LEN / Math.max(0.001, Math.max(size.x, size.z)));
    // Laengsachse auf Z (beim Orca liegt sie schon dort, die Zeile ist die gleiche Absicherung wie
    // bei den Schiffen). ZUERST drehen, DANN zentrieren — rotation.y dreht um den Objektursprung.
    if(size.x > size.z) obj.rotation.y = Math.PI/2;
    // Und um 180 Grad weiter: das Modell ist gegen die Fahrtrichtung gebaut, die Schnauze zeigt auf
    // +Z, das Spiel erwartet die Nase auf -Z. Ohne das schwimmt und springt es rueckwaerts, mit der
    // Fluke voran — genau so gemeldet.
    // Nachgemessen am Laengsschnitt (16 Baender ueber die 8 m): die Fluke ist flach und breit und
    // liegt bei Z = 0,0 (Hoehe 0,12 m, Breite 2,06), die Brustflossen sitzen bei Z = 5,0 bis 6,0
    // (Breite 4,16 bis 4,20) und die Rueckenfinne bei Z = 4,5 (Hoehe 3,01). Beim Orca sitzen
    // Brustflossen und Finne im vorderen Drittel, die Fluke am Ende — der Kopf liegt hier also bei
    // HOHEM Z. Dasselbe wie rot180 bei Kreuzfahrtschiff und Liberty-Frachter.
    obj.rotation.y += Math.PI;
    obj.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); b2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z;
    obj.position.y -= b2.min.y;               // Unterkante auf 0, wie bei den Schiffen
    // frustumCulled aus: die Bounding-Box eines SkinnedMesh gilt fuer die BINDEPOSE, nicht fuer die
    // verformte Haltung. three.js wuerde das Tier am Bildrand wegschneiden, waehrend die Fluke noch
    // sichtbar sein muesste. Schatten wirft es keinen (es liegt im Wasser).
    obj.traverse((o)=>{ if(o.isMesh || o.isSkinnedMesh){ o.castShadow = false; o.frustumCulled = false; } });
    const wrap = new THREE.Group();
    wrap.add(obj);
    orcaTpl = wrap;
    orcaTpl.userData.clips = gltf.animations || [];
    // Bereits ausgesetzte Tiere nachziehen: das GLB kann nach dem ersten Spawn fertig werden.
    for(const o of orcas) if(o.placed && !o.group) buildOrcaBody(o);
  }, ()=>{ orcaLoading = false; });   // Fehlerfall: Flag zuruecksetzen, sonst laedt es nie wieder
}
// Einem Orca seinen Koerper geben: eigener Klon, eigener Mixer, eigener Zeitversatz.
function buildOrcaBody(o){
  if(!orcaTpl) return;
  o.group = cloneSkinned(orcaTpl);
  o.group.position.set(o.x, 0, o.z);
  scene.add(o.group);
  const clips = orcaTpl.userData.clips || [];
  if(clips.length){
    o.mixer = new THREE.AnimationMixer(o.group);
    o.mixer.clipAction(clips[0]).play();
    // Eigener Startpunkt und leicht eigenes Tempo — sonst schwimmt die Herde im Gleichschritt.
    // Die Schleife ist 2,03 s lang und laeuft nahtlos (2,2 Grad Differenz zwischen erstem und
    // letztem Frame), ein Versatz faellt also nirgends auf.
    o.mixer.setTime(Math.random()*2.03);
    o.mixer.timeScale = 0.85 + Math.random()*0.3;
  }
}
// Einen Orca (neu) aussetzen. Anders als bei den Schiffen wird KEIN freier Platz gesucht: ein Tier
// von 8 m braucht keine 260-m-Schneise (SHIP_CLEAR), und es soll ausdruecklich nahe herankommen.
// Geprueft wird nur, dass es im offenen Wasser landet und nicht in einem Rumpf steckt.
function placeOrca(o, fx, fz){
  for(let tries=0; tries<20; tries++){
    const a = spawnWinkel();          // vorderer Kegel, siehe SPAWN_KEGEL bei den Fischen
    const d = ORCA_SPAWN_MIN + Math.random()*(ORCA_SPAWN_MAX-ORCA_SPAWN_MIN);
    const x = fx + Math.cos(a)*d, z = fz + Math.sin(a)*d;
    if(isOnLand(x, z) || isOnBeach(x, z) || isOnCarrier(x, z)) continue;
    if(hitsSeaShip(x, ISLAND_Y+2, z)) continue;
    o.x = x; o.z = z;
    o.heading = Math.random()*Math.PI*2;
    // Wer springt und wer nur taucht: jedes dritte Tier ist ein Springer. Alle springen zu lassen
    // waere Zirkus; keiner waere schade. Der Rest bildet die Schule.
    // ...aber ein Tiefsee-Tier bleibt eines, auch nach dem Umsetzen (siehe spawnOrcas: Springen und
    // Tiefsee schliessen sich aus). Ohne dieses o.deep waere jedes umgesetzte Tier mit 34 %
    // Wahrscheinlichkeit wieder Springer geworden, und nach einigen Minuten Fahrt haette die Herde
    // keine Tiefsee-Tiere mehr gehabt — ein stiller Ausfall, der erst im Spiel aufgefallen waere.
    o.jumper = !o.deep && (Math.random() < 0.34);
    o.t = Math.random() * (o.jumper ? ORCA_JUMP_CYCLE : ORCA_PERIOD);
    // Die Tiefsee-Rolle wird HIER NICHT gewuerfelt, sondern in spawnOrcas fest zugeteilt (siehe
    // dort): sonst haette eine Herde zufaellig gar kein Tiefsee-Tier oder nur solche.
    // Ihre Bandlage (Versatz zur Bootstiefe) wird hier aber neu gezogen, damit eine Schule nach dem
    // Umsetzen nicht auf derselben Linie wie vorher zieht.
    o.band = (Math.random()-0.5)*2*ORCA_DEEP_BAND;
    if(o.group) o.group.position.set(o.x, 0, o.z);
    return true;
  }
  return false;
}
function spawnOrcas(){
  const F = worldFocus();
  // Sie kommen in Gruppen: ein Leittier setzt die Stelle, die naechsten zwei bleiben in ORCA_POD
  // Metern daneben. So schwimmen sie als Rudel und nicht als sechs Einzelgaenger im Kreis.
  for(let i=0; i<ORCA_COUNT; i++){
    const o = { group:null, mixer:null, x:0, z:0, heading:0, t:0, jumper:false, y:0, pitch:0, placed:false,
                // Tiefsee-Tier? Die ERSTEN ORCA_DEEP_N der Herde sind es, fest und nicht gewuerfelt
                // (siehe ORCA_DEEP_N): so hat jede Herde verlaesslich beide Rollen.
                deep: i < ORCA_DEEP_N, band: 0, deepY: 0 };
    const lead = orcas.length ? orcas[orcas.length-1] : null;
    if(i % 3 === 0 || !lead || !lead.placed){
      o.placed = placeOrca(o, F.x, F.z);
    } else {
      const a = Math.random()*Math.PI*2, d = 8 + Math.random()*ORCA_POD;
      o.x = lead.x + Math.cos(a)*d; o.z = lead.z + Math.sin(a)*d;
      o.heading = lead.heading + (Math.random()-0.5)*0.5;
      o.jumper = (Math.random() < 0.34);
      o.t = Math.random() * (o.jumper ? ORCA_JUMP_CYCLE : ORCA_PERIOD);
      o.band = (Math.random()-0.5)*2*ORCA_DEEP_BAND;   // wie in placeOrca, das hier nicht laeuft
      o.placed = !isOnLand(o.x, o.z) && !isOnBeach(o.x, o.z) && !isOnCarrier(o.x, o.z);
      if(!o.placed) o.placed = placeOrca(o, F.x, F.z);
    }
    // Ein TIEFSEE-Tier springt nicht. Beides zusammen waere ein Widerspruch: der Springer-Zweig in
    // updateOrcas rechnet seine ganze Bahn gegen die Wasseroberflaeche (swimY), ein Tier auf 60 m
    // Tiefe wuerde also fuer den Anlauf schlagartig nach oben schnappen. Und ein Wal, der aus 60 m
    // heraufschiesst, um zu springen, waere ohnehin kein Tiefseetier mehr.
    // Die Zuweisung steht NACH beiden Zweigen, weil o.jumper in jedem von ihnen gesetzt wird.
    if(o.deep) o.jumper = false;
    if(o.placed) buildOrcaBody(o);
    orcas.push(o);
  }
}
function clearOrcas(){
  for(const o of orcas) if(o.group) scene.remove(o.group);
  orcas.length = 0;
}
// Jeden Frame: schwimmen, springen oder tauchen.
//
// Die Hoehe bezieht sich immer auf die SICHTBARE Wasseroberflaeche an der Stelle des Tieres
// (seaYAt, nicht waveY — das Meeresgitter spannt flache Dreiecke zwischen seinen Stuetzpunkten und
// liegt darum bis zu 1 m ueber waveY). Ein Wal, der in der Welle steckt statt auf ihr zu liegen,
// sieht falsch aus; beim Astronauten am Strand war genau das schon ein gemeldeter Fehler.
//
// Orcas sind KEINE Hindernisse: sie stehen in keiner Kollisionsliste. Ein Tier von 8 m, das dicht
// am Boot auftaucht, wuerde sonst zum Absturz fuehren, wo man nichts falsch gemacht hat — und ein
// Wal weicht aus, ein Frachter nicht.
function updateOrcas(dt){
  if(locale !== 'earth'){ if(orcas.length) clearOrcas(); return; }
  if(!orcaTpl){ preloadOrca(); return; }
  if(!orcas.length){ spawnOrcas(); return; }
  const F = worldFocus();
  for(const o of orcas){
    if(!o.placed){ o.placed = placeOrca(o, F.x, F.z); if(o.placed) buildOrcaBody(o); continue; }
    if(!o.group){ buildOrcaBody(o); if(!o.group) continue; }
    if(o.mixer) o.mixer.update(dt);
    o.t += dt;
    // Weiterschwimmen. Ein leichter Bogen im Kurs, damit sie nicht schnurgerade ziehen — dieselbe
    // Machart wie bei den Handelsschiffen (updateShipsSea).
    o.heading += Math.sin(seaTime*0.11 + o.x*0.002) * 0.10 * dt;
    // Nase auf -Z, also dieselbe Rechnung wie bei den Schiffen.
    const fx = -Math.sin(o.heading), fz = -Math.cos(o.heading);
    o.x += fx * ORCA_SPD * dt;
    o.z += fz * ORCA_SPD * dt;
    // Vor Land, Schiffen und dem Traeger abdrehen, statt hineinzuschwimmen. 30 m Vorausschau sind
    // bei 3,2 m/s rund 9 s Reaktionsweg.
    const ax = o.x + fx*30, az = o.z + fz*30;
    if(isOnLand(ax, az) || isOnBeach(ax, az) || isOnCarrier(ax, az) || hitsSeaShip(ax, ISLAND_Y+2, az))
      o.heading += 1.2 * dt * (1 + Math.random());
    // Zu weit weg -> an neuer Stelle aussetzen (die Herde begleitet den Spieler wie die Flotte).
    if(Math.hypot(o.x - F.x, o.z - F.z) > ORCA_DESPAWN) placeOrca(o, F.x, F.z);
    const surf = seaYAt(o.x, o.z, dt);
    // Wo der Ruecken knapp aus dem Wasser schaut: das Modell sitzt mit der Unterkante auf y = 0,
    // der Ruecken liegt ORCA_BACK darueber. Soll er ORCA_SURF herausschauen, muss der Ursprung
    // (ORCA_BACK - ORCA_SURF) unter die Oberflaeche.
    const swimY = surf - (ORCA_BACK - ORCA_SURF);
    if(o.deep){
      // ---- TIEFSEE-SCHULE: zieht auf der Tiefe, auf der das U-BOOT faehrt (siehe ORCA_DEEP_N).
      // Ohne Boot in der Tiefe gibt es nichts zu begleiten: dann zieht sie auf ihrer Bandlage unter
      // der Oberflaechen-Zone weiter. Das kostet nichts (man sieht sie von oben ohnehin nicht) und
      // haelt ihre Tiefe stetig, damit sie beim Abtauchen nicht erst von 10 m heruntersinkt.
      const bootTief = (isSub() && !eva) ? state.pos.y : (surf - ORCA_DEEP_MIN);
      let ziel = bootTief + o.band;
      // ZWEI Grenzen, und beide wandern: oben die Oberflaechen-Zone, unten der Meeresboden.
      //
      // Der Grund wird VORAUS gelesen und nicht unter dem Tier. Das ist nachgerechnet noetig
      // (C:/tmp/orca4.js): der Schelf steigt vom offenen Wasser (-100 m) ueber SHELF_W = 180 m auf
      // SEABED_SHORE_Y (-1,2 m), also bis 0,55 m Anstieg je Meter. Mit 1,49 m/s Steigrate bei
      // 3,2 m/s Fahrt (ORCA_DEEP_VY) schafft das Tier 0,47 m je Meter — es kaeme also NICHT hinterher
      // und wuerde in den Hang laufen. Die Vorausschau ist 40 m, das sind bei ORCA_SPD 12,5 s.
      const grund = Math.max(seabedY(o.x, o.z), seabedY(o.x + fx*40, o.z + fz*40));
      const obenMax = surf - ORCA_DEEP_MIN;         // nicht in die Springer-/Schulzone hinauf
      const untenMin = grund + ORCA_H + 1;          // nicht in den Sand (Modellhoehe plus 1 m Luft)
      if(ziel > obenMax) ziel = obenMax;
      if(ziel < untenMin) ziel = untenMin;
      // Traegt die Stelle beides nicht mehr — flaches Wasser am Inselsaum, wo Grund und Oberflaeche
      // naeher zusammenliegen als das Tier hoch ist —, dann gilt WEDER das eine noch das andere:
      // untenMin waere der Sand, obenMax liesse den Ruecken herausragen. Gemessen ist das ab rund
      // 6 m Wassertiefe der Fall, und dort ragte der Ruecken 1,19 m aus dem Wellental.
      //
      // Ein Tiefseetier hat dort ohnehin nichts zu suchen: es DREHT AB. Das ist derselbe Weg, den es
      // vor Land, Schiffen und dem Traeger schon geht (siehe die Vorausschau oben), nur gegen die
      // Wassertiefe statt gegen ein Hindernis — und er braucht keine neue Mechanik.
      if(untenMin > obenMax){
        ziel = obenMax;                             // so tief wie moeglich, waehrend es abdreht
        o.heading += 1.2 * dt * (1 + Math.random());
      }
      // Mit BEGRENZTER Sinkrate folgen (siehe ORCA_DEEP_VY): so zieht das Tier seine Bahn und wird
      // nicht vom Boot gezogen — und der Nickwinkel bleibt dabei von selbst unter ORCA_DEEP_PMAX,
      // weil beides aus derselben Rechnung kommt.
      const rest = ziel - o.y;
      const schritt = Math.min(Math.abs(rest), ORCA_DEEP_VY*dt) * Math.sign(rest);
      o.y += schritt;
      // Nase in die Bewegungsrichtung — dieselbe Formel wie bei Sprung und Schule: atan2(vy, vHoriz).
      // Gerechnet wird aus dem SOLL-Schritt und nicht aus (o.y - vorher)/dt: das ist derselbe Wert,
      // aber ohne die Division, die bei dt = 0 (erster Frame) NaN ergeben haette.
      o.pitch = Math.atan2(dt > 0 ? schritt/dt : 0, ORCA_SPD);
    } else if(o.jumper){
      // ---- SPRINGER: schwimmen, Anlauf, Bogen durch die Luft, ganz unter Wasser, wieder hoch.
      // Der Zyklus hat VIER Abschnitte, hintereinander am Ende von ORCA_JUMP_CYCLE:
      //   ... 7 s schwimmen ... | ORCA_RUNUP_T Anlauf | ORCA_JUMP_T Flug | ORCA_UNDER_T unter Wasser |
      // Alle drei Uebergaenge sind STETIG in Hoehe UND Nickwinkel — nachgerechnet, siehe die
      // Herleitungen bei den Konstanten. Ein Knick faellt sofort auf: das Tier wuerde in einem Frame
      // die Nase umlegen.
      if(o.t >= ORCA_JUMP_CYCLE) o.t -= ORCA_JUMP_CYCLE;
      const tj = o.t - (ORCA_JUMP_CYCLE - ORCA_RUNUP_T - ORCA_JUMP_T - ORCA_UNDER_T);  // ab Anlaufbeginn
      if(tj >= 0 && tj < ORCA_RUNUP_T){
        // ANLAUF: absinken und mit Steigung herauskommen. f(s) = -A s^2 (1-s), Ableitung
        // f'(s) = -A (2s - 3s^2), die Zeitableitung also f'(s)/T.
        const s = tj / ORCA_RUNUP_T;
        o.y = swimY - ORCA_RUNUP_A * s*s*(1-s);
        const vyR = -ORCA_RUNUP_A * (2*s - 3*s*s) / ORCA_RUNUP_T;
        o.pitch = Math.atan2(vyR, ORCA_SPD);
      } else if(tj >= ORCA_RUNUP_T && tj < ORCA_RUNUP_T + ORCA_JUMP_T){
        // FLUG. Senkrecht eine reine Wurfparabel: vy0 = v0 sin a, y = vy0 t - g t^2 / 2. Bei tf = 0
        // und tf = ORCA_JUMP_T ist der Summand 0, er setzt also genau auf der Schwimmhoehe an und
        // kommt dort wieder an — kein Sprung aus dem Nichts und kein Ruck beim Eintauchen.
        const tf  = tj - ORCA_RUNUP_T;
        const vy0 = ORCA_JUMP_V * Math.sin(ORCA_JUMP_A);
        o.y = swimY + vy0*tf - 0.5*ORCA_G*tf*tf;
        // Nase folgt der Bahn — dieselbe Rechnung wie beim Flieger: pitch = atan2(vy, vHoriz).
        // Beim Absprung +45 Grad, am Scheitel waagerecht, beim Eintauchen -45 Grad. Genau das macht
        // aus der Parabel einen sichtbaren Bogen "mit der Schnauze voran".
        const vy = vy0 - ORCA_G*tf, vh = ORCA_JUMP_V * Math.cos(ORCA_JUMP_A);
        o.pitch = Math.atan2(vy, vh);
        // Im Flug zusaetzlich schneller vorwaerts: er springt aus der Fahrt heraus. vh statt ORCA_SPD
        // ist der Waagerechtanteil der Absprunggeschwindigkeit — daraus ergibt sich die Weite von
        // 40 m ganz von selbst, sie ist nirgends als Zahl hinterlegt.
        o.x += fx * (vh - ORCA_SPD) * dt;
        o.z += fz * (vh - ORCA_SPD) * dt;
      } else if(tj >= ORCA_RUNUP_T + ORCA_JUMP_T){
        // UNTER WASSER. Sinusbogen bis ORCA_DIVE_J Tiefe und zurueck (siehe die Herleitung dort):
        // y = swimY - D sin(pi s). Vorwaerts geht es mit ORCA_SPD weiter, das steht schon oben.
        const s = (tj - ORCA_RUNUP_T - ORCA_JUMP_T) / ORCA_UNDER_T;
        o.y = swimY - ORCA_DIVE_J * Math.sin(Math.PI*s);
        // Nase wieder aus der Bahn: vy = -D (pi/T) cos(pi s), vh = ORCA_SPD. Bei s = 0 ergibt das
        // atan2(-3,20; 3,2) = -45 Grad, also genau den Winkel, mit dem er in der Luft angekommen
        // ist — der Uebergang ist stetig, es gibt keinen Knick. Bei s = 1 entsprechend +45 Grad,
        // er kommt also mit der Schnauze nach oben heraus und geht von dort ins Schwimmen.
        const vyU = -ORCA_DIVE_J * (Math.PI/ORCA_UNDER_T) * Math.cos(Math.PI*s);
        o.pitch = Math.atan2(vyU, ORCA_SPD);
      } else {
        // SCHWIMMEN. Ruecken knapp heraus, Nase glatt ziehen. Die +45 Grad vom Auftauchen laufen
        // hier aus; nach 7 s ist die Nase praktisch waagerecht, und genau darauf setzt der Anlauf
        // mit f'(0) = 0 wieder auf.
        o.y = swimY;
        o.pitch += (0 - o.pitch) * Math.min(1, 3*dt);
      }
    } else {
      // ---- SCHULE: ganz abtauchen und wieder hoch. Halber Kosinus wie beim U-Boot, mit dem eigenen
      // x-Wert als Phase (sonst tauchen alle im Gleichschritt) und smoothstep, damit sie oben und
      // unten verweilen statt gleichmaessig durchzufahren.
      const ph = o.t*(2*Math.PI/ORCA_PERIOD) + o.x*0.01;
      const p  = 0.5 - 0.5*Math.cos(ph);
      const g  = p*p*(3 - 2*p);
      o.y = swimY - ORCA_DIVE*g;
      // Nase in die Bewegungsrichtung neigen — MIT DERSELBEN FORMEL WIE BEIM SPRUNG:
      // pitch = atan2(vy, vHoriz). Nichts anderes ist richtig, und der Weg dorthin ist lehrreich:
      // Mein erster Versuch war -dg/dt * ORCA_DIVE * 0,55, also "Ableitung mal Daumenfaktor". Das
      // ergab 47 Grad Ausschlag statt der angestrebten 25 — der Term hat gar keine Winkeleinheit,
      // der Faktor war reines Raten. Nachgerechnet: dg/dt = g'(p) p'(t) mit g'(p) = 6p(1-p) und
      // p'(t) = sin(ph) pi/ORCA_PERIOD; maximal 0,2142 pro Sekunde, mal 7 m Tauchweg also 1,50 m/s
      // Sinkgeschwindigkeit. Bei 3,2 m/s Fahrt ist der Bahnwinkel damit atan2(1,50; 3,2) = 25 Grad.
      // Genau der Wert, den ich vorher geschaetzt hatte — nur diesmal hergeleitet statt getroffen.
      const dgdt = 6*p*(1-p) * Math.sin(ph) * (Math.PI/ORCA_PERIOD);
      o.pitch = Math.atan2(-dgdt * ORCA_DIVE, ORCA_SPD);
    }
    o.group.position.set(o.x, o.y, o.z);
    // Reihenfolge YXZ wie ueberall im Spiel: erst Kurs (Y), dann Nickwinkel (X).
    o.group.rotation.set(o.pitch, o.heading, 0, 'YXZ');
  }
}
// Trifft (x,y,z) ein Handelsschiff? Wie hitsBuilding, aber für die fahrende Flotte. Gerechnet wird im
// Schiffs-Koordinatensystem (um -heading zurückgedreht), damit ein langes Schiff auch schräg als
// Rechteck wirkt und nicht als Kreis: sonst wäre um ein 300-m-Schiff eine 300 m breite Sperrzone,
// durch die man nicht mehr seitlich vorbeifliegen könnte.
// ACHTUNG bei der Rueckdrehung ins Schiffssystem — hier steckte ein Vorzeichenfehler, der die
// Kollision ALLER Schiffe an die falsche Stelle legte, und zwar kursabhaengig:
//   RICHTIG:  cs = cos(heading), sn = sin(heading);  lx = rx*cs - rz*sn;  lz = rx*sn + rz*cs
//   FALSCH war cos(-heading)/sin(-heading) bei sonst gleicher Rechnung. Das dreht um +heading statt
//   um -heading: die Huelle wandert MIT dem Schiff, anstatt zurueckzurechnen.
// Gemessen gegen echtes three.js (C:/tmp/rot2.js) lag die Huelle bei 90 Grad Kurs 204 m neben dem
// Rumpf; bei Kurs 0 und 180 Grad stimmt es zufaellig. Genau deshalb sah es "random" aus — es hing
// daran, wie das Schiff gerade lag, und liess sich an einem stehenden Testschiff nie reproduzieren.
// Wer das hier anfasst, rechnet es gegen three.js nach: beide Varianten sehen plausibel aus, und der
// Unterschied faellt nur im Spiel auf. Dasselbe Muster steht in pushOutOfSeaShip, aiObstacleTopAt
// und aiShipAhead — alle vier muessen gleich rechnen.
function hitsSeaShip(x, y, z, except){
  for(const sh of seaShips){
    if(!sh.group || sh === except) continue;
    if(y > sh.top + 4) continue;                      // über den Aufbauten -> drüberfliegen ok
    const rx = x - sh.x, rz = z - sh.z;
    const cs = Math.cos(sh.heading), sn = Math.sin(sh.heading);
    // Mittenversatz abziehen: die Huelle sitzt um die RUMPFmitte, nicht um den Modellursprung.
    const lx = rx*cs - rz*sn - sh.cx, lz = rx*sn + rz*cs - sh.cz;
    // Breite an DIESER Laengsstelle (Rumpfform, nicht Rechteck) — siehe shipHalfWidthAt.
    if(Math.abs(lz) < sh.hl + 4 && Math.abs(lx) < shipHalfWidthAt(sh, lz) + 4) return true;
  }
  return false;
}
// Fahrwasser für EIN BESTIMMTES Schiff: offenes Wasser, aber es selbst zählt nicht als Hindernis.
// isOpenWater allein geht hier nicht — es fragt hitsBuilding, und das kennt seit dem Einbau auch die
// Schiffe. Jedes Schiff hätte damit sein eigenes Fahrwasser gesperrt (gemessen: alle vier Typen).
function seaShipWaterFor(sh, x, z){
  return !isOnLand(x, z) && !isOnBeach(x, z) && !isOnCarrier(x, z)
         && !hitsBuilding(x, ISLAND_Y+2, z, false, sh);
}
// Ein Rumpf schiebt ein Boot beiseite — INNEN wie AUSSEN. Beides ist noetig, und zwar aus zwei
// ganz verschiedenen Gruenden:
//
// INNEN (steckt im Rumpf): sonst sitzt das Boot fest. coastSlide sucht nur nach VORNE (±120° um die
// Fahrtrichtung) und findet mitten im Rumpf nirgends Wasser — gemessen sass ein Boot 10 Sekunden
// bewegungslos in der Schiffsmitte, waehrend das Schiff darueber hinwegfuhr. Das sah aus, als fuehre
// man durch das Schiff hindurch. Geschoben wird QUER heraus: bei 16 m Halbbreite gegen 125 m halbe
// Laenge ist das der kurze Weg.
//   NICHT den "kuerzesten Weg" in alle vier Richtungen nehmen — das war mein erster Gedanke und ist
//   MESSBAR SCHLECHTER (C:/tmp/boot3.js): nach vorn hinausschieben heisst in Fahrtrichtung schieben,
//   und da kommt der Rumpf hinterher. Die Eindringung stieg bei der Liberty von 1,9 auf 14,5 m,
//   beim Containerschiff von 3,9 auf 27,2 m.
//
// AUSSEN (die Bugwelle, SHIP_WAKE): das ist der Grund fuers "es zieht mich bis zur Schiffsmitte".
// Die Sperre in updateDinghy haelt naemlich einwandfrei — bei Anfahrt auf die Flanke kommt das Boot
// aus KEINEM Winkel in den Rumpf (gemessen 0,0 m Eindringung, C:/tmp/boot6.js). Was man sieht, ist
// GLEITEN an der Zonengrenze: coastSlide haelt das Boot dort fest, der Spieler gibt weiter Gas
// dagegen, und das Schiff faehrt darunter durch — das Boot wandert relativ zum Schiff nach hinten.
// coastSlide kann das nicht verhindern: es sucht Wasser relativ zur WELT und kennt das Schiff nicht
// als BEWEGTES Hindernis. Gemessen an der Liberty: 115 s an der Bordwand, 25,5 m Wanderung, Ende bei
// 91 % der halben Laenge — also querab der Mitte, genau wie berichtet.
// Mit dem Saum drueckt der Rumpf schon NEBEN sich, wie eine Bugwelle: 13 s statt 115 s, 7,2 m statt
// 25,5 m, Ende bei 62 % statt 91 % (C:/tmp/fix2.js). Die Kraft laeuft nach aussen sanft aus, damit
// es sich wie Wasserverdraengung anfuehlt und nicht wie eine zweite unsichtbare Wand.
// In so viele Laengsscheiben wird ein Rumpf fuer sein Halbbreiten-Profil geteilt. 24 trifft bei einem
// 300-m-Schiff rund 12 m pro Scheibe — feiner als jedes Boot lang ist, also kann keines dazwischen
// durchrutschen, und die Bugform ist gut abgebildet.
const SHIP_SLICES = 24;
// Halbe Rumpfbreite an der Laengsstelle lz (beide im Schiffssystem, um die Rumpfmitte). Das ist die
// Antwort auf "die Grenze 1:1 an den Rumpf knuepfen": statt eines Rechtecks folgt sie der Form.
// Ohne Profil (GLB noch nicht geladen) gilt weiter die volle Halbbreite — lieber zu viel gesperrt
// als ein unsichtbares Loch.
function shipHalfWidthAt(sh, lz){
  if(!sh.prof) return sh.hw;
  let s = Math.floor((lz + sh.hl) / (2*sh.hl) * SHIP_SLICES);
  if(s < 0) s = 0; else if(s >= SHIP_SLICES) s = SHIP_SLICES - 1;
  return sh.prof[s];
}
const SHIP_PUSH = 30;      // m/s, mit denen ein Rumpf ein Boot beiseite drückt (deutlich über Schiffstempo)
const SHIP_WAKE = 8;       // m Saum AUSSERHALB der Sperrzone, in dem der Rumpf noch wegschiebt
// Wie viel von der Fahrt gegen die Bordwand zurueckkommt. 0 = tote Wand (Fahrt einfach weg),
// 1 = voll elastisch. 0,35 fuehlt sich wie ein Gummi-Schlauchboot an einer Stahlwand an: ein
// merklicher Stoss, aber man wird nicht katapultiert.
const BOAT_BOUNCE = 0.35;
function pushOutOfSeaShip(pos, vel, dt){
  for(const sh of seaShips){
    if(!sh.group) continue;
    const rx = pos.x - sh.x, rz = pos.z - sh.z;
    const cs = Math.cos(sh.heading), sn = Math.sin(sh.heading);
    // Lage im Schiffssystem, bezogen auf die RUMPFmitte (Versatz siehe shipHalf)
    const lx = rx*cs - rz*sn - sh.cx, lz = rx*sn + rz*cs - sh.cz;
    const gx = shipHalfWidthAt(sh, lz) + 4, gz = sh.hl + 4;   // Grenzen: Breite nach der Rumpfform
    // Laengs muss es neben dem Rumpf liegen; quer zaehlt der Saum mit.
    if(Math.abs(lz) >= gz || Math.abs(lx) >= gx + SHIP_WAKE) continue;
    const drin = Math.abs(lx) < gx;
    // Zur näheren Bordwand hinaus. Genau auf der Mittellinie (lx = 0) gibt es keine Richtung —
    // dann nach Steuerbord, damit es überhaupt eine gibt.
    const side = lx >= 0 ? 1 : -1;
    // Innen: bis nach draussen schieben. Aussen im Saum: mit nach aussen abnehmender Kraft — direkt
    // an der Bordwand am staerksten, am Saumrand null.
    const step = drin
      ? Math.min((gx + 2) - Math.abs(lx), SHIP_PUSH * dt)
      : SHIP_PUSH * 0.5 * (1 - (Math.abs(lx) - gx) / SHIP_WAKE) * dt;
    // Querrichtung des Schiffs in WELTkoordinaten — die Richtung, in der lx waechst.
    // Die Rueckdrehung oben rechnet lx = rx*cos(h) - rz*sin(h), das ist die Projektion auf
    // (cos h, -sin h). Genau dieser Vektor gehoert hierher.
    // Hier stand vorher (cos h, +SIN h), und das war falsch: gemessen gegen three.js
    // (C:/tmp/push.js) schob die Verdraengung bei 90 Grad Kurs mit 0,5 m pro Frame NACH INNEN,
    // zog das Boot also zur Mittellinie statt hinaus. Nur bei Kurs 0 und 180 Grad stimmte es
    // zufaellig (sin = 0) — deshalb faellt es an einem Testschiff mit heading 0 nie auf.
    // Ein alter Kommentar behauptete hier das Gegenteil ("mit -sin h schob es diagonal"). Das war
    // eine Fehldiagnose: damals war zusaetzlich die Rueckdrehung falsch, und die beiden Fehler
    // hoben sich bei heading 0 gegenseitig auf. Beide sind jetzt gegen three.js nachgerechnet.
    const qx = Math.cos(sh.heading) * side, qz = -Math.sin(sh.heading) * side;
    pos.x += qx * step;
    pos.z += qz * step;
    // ABPRALLEN, nicht umlenken. Vorher wurde die Fahrt auf "quer * Tempo * 0,6" gesetzt: das Boot
    // behielt 60 % seines Tempos, nur in eine andere Richtung — es GLITT heraus, statt anzustossen.
    // Jetzt wird nur der Anteil der Fahrt behandelt, der IN die Bordwand zeigt: der wird
    // weggenommen und zu BOAT_BOUNCE zurueckgeworfen. Die Fahrt LAENGS der Wand bleibt unberuehrt,
    // man schrammt also weiter entlang, statt quer weggedreht zu werden. Nur INNEN: im Saum wuerde
    // ein Eingriff in die Fahrt das Steuer aus der Hand nehmen, obwohl man noch im freien Wasser
    // faehrt — dort schiebt der Rumpf nur, gelenkt wird weiter selbst.
    if(vel && drin){
      const ein = vel.x*qx + vel.z*qz;      // <0 = fährt gegen die Ausschubrichtung, also in die Wand
      if(ein < 0){
        vel.x -= qx * ein * (1 + BOAT_BOUNCE);
        vel.z -= qz * ein * (1 + BOAT_BOUNCE);
      }
    }
    return drin;
  }
  return false;
}
// Das nächstgelegene Schiff (fürs Radar). Rückgabe {x,z,sym} oder null.
function nearestSeaShip(x, z){
  let best = null, bd = Infinity;
  for(const sh of seaShips){
    if(!sh.group) continue;
    const d = Math.hypot(sh.x - x, sh.z - z);
    if(d < bd){ bd = d; best = sh; }
  }
  return best ? { x:best.x, z:best.z, dist:bd } : null;
}

// ---------- Feuerwehr (Fahrzeug an Land / Boot auf dem Meer) ----------
const redMat   = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
const darkMat  = new THREE.MeshLambertMaterial({ color: 0x222222 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x88bbdd });
const blueMat  = new THREE.MeshLambertMaterial({ color: 0x2255cc, emissive: 0x1133aa });
const waterJetMat = new THREE.MeshLambertMaterial({ color: 0x9fd8ff, transparent:true, opacity:0.6 });

// Abgerundeter Quader (Box + Zylinder-Kanten + Eck-Kugeln) für weiche Optik
function roundedBox(w, h, d, r, mat){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w, h-2*r, d-2*r), mat));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w-2*r, h, d-2*r), mat));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(w-2*r, h-2*r, d), mat));
  // 4 waagerechte Längskanten (entlang X)
  for(const sy of [-1,1]) for(const sz of [-1,1]){
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w-2*r, 10), mat);
    c.rotation.z = Math.PI/2; c.position.set(0, sy*(h/2-r), sz*(d/2-r)); g.add(c);
  }
  // 4 senkrechte Kanten (entlang Y)
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h-2*r, 10), mat);
    c.position.set(sx*(w/2-r), 0, sz*(d/2-r)); g.add(c);
  }
  // 4 Kanten entlang Z
  for(const sx of [-1,1]) for(const sy of [-1,1]){
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d-2*r, 10), mat);
    c.rotation.x = Math.PI/2; c.position.set(sx*(w/2-r), sy*(h/2-r), 0); g.add(c);
  }
  // 8 Eck-Kugeln
  for(const sx of [-1,1]) for(const sy of [-1,1]) for(const sz of [-1,1]){
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat);
    s.position.set(sx*(w/2-r), sy*(h/2-r), sz*(d/2-r)); g.add(s);
  }
  return g;
}

function makeFireTruck() {
  // Echtes GLB-Auto (Mercedes Atego by Aeroux Games 3D), falls geladen
  if(truckTemplate){
    const g = new THREE.Group();
    const t = truckTemplate.clone(true);
    t.rotation.y = 0;    // GLB fuhr rückwärts -> 180° gedreht (Front voraus)
    g.add(t);
    return g;
  }
  const g = new THREE.Group();
  const body = roundedBox(6, 4, 12, 1, redMat);   body.position.y = 3; g.add(body);
  const cab  = roundedBox(5.6, 3, 4, 0.9, redMat); cab.position.set(0, 4.5, -5); g.add(cab);
  // Frontscheibe: flache dunkle Platte an der Kabinenvorderseite (statt Halbkreis)
  const win = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.8, 0.2), glassMat);
  win.position.set(0, 5.0, -7.0); g.add(win);
  for(const [x,z] of [[-3,-4],[3,-4],[-3,4],[3,4]]){
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,1.2,16), darkMat);
    w.rotation.z = Math.PI/2; w.position.set(x,1.4,z); g.add(w);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.5,8,6), glassMat);
    hub.position.set(x + (x>0?0.65:-0.65),1.4,z); g.add(hub);
  }
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.7,0.7,0.9,12), blueMat);
  beacon.position.set(0,6.3,-5); g.add(beacon); g.userData.beacon = beacon;
  return g;
}
function makeFireBoat() {
  // Echtes GLB-Boot (by gogiart), falls geladen
  if(boatTemplate){
    const g = new THREE.Group();
    const b = boatTemplate.clone(true);
    b.rotation.y = Math.PI/2;  // 90° im Uhrzeigersinn gegenüber vorher (Math.PI)
    g.add(b);
    return g;                  // kein Blaulicht-Node -> userData.beacon bleibt leer (ok)
  }
  const g = new THREE.Group();
  // Rumpf: halber Zylinder (rund unten) + Bug-Kegel
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 16, 20, 1, false, 0, Math.PI), redMat);
  hull.rotation.set(0, 0, Math.PI/2);            // Rundung nach unten
  hull.rotation.x = Math.PI/2;
  hull.position.y = 2; g.add(hull);
  // Deckplatte
  const deckTop = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.4, 16), redMat);
  deckTop.position.y = 2; g.add(deckTop);
  // Bug (rundlicher Abschluss)
  const bow = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 10, 0, Math.PI*2, 0, Math.PI/2), redMat);
  bow.rotation.x = -Math.PI/2; bow.position.set(0, 2, -8); g.add(bow);
  // Aufbau/Kabine rund
  const deck = roundedBox(5, 3, 6, 1, glassMat); deck.position.set(0, 4, -1); g.add(deck);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,6,8), darkMat);
  mast.position.set(0, 7, 3); g.add(mast);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.8,12), blueMat);
  beacon.position.set(0,6,-1); g.add(beacon); g.userData.beacon = beacon;
  return g;
}

// richtet ein Objekt so aus, dass seine Front (-Z) auf (tx,tz) zeigt (Fahrzeuge/Boote)
function faceTowards(obj, tx, tz){
  const ang = Math.atan2(tx - obj.position.x, tz - obj.position.z);
  obj.rotation.y = ang + Math.PI;   // -Z ist die Front
}

let rescueUnits = [];   // Liste aktiver Einheiten: [{group, jet, wreck, start, stop, t}]
// Eine Einheit (Auto=Land ODER Boot=Wasser) neben dem Wrack aufstellen. Gibt Einheit oder null.
function makeRescueUnit(x, z, onLand){
  const sp = rescueSpotNear(x, z, onLand, true);   // strict: nur wenn dieses Element NAH da ist
  if(!sp) return null;
  const g = onLand ? makeFireTruck() : makeFireBoat();
  const groundY = onLand ? ISLAND_Y : 0;
  const stop = new THREE.Vector3(sp.x, groundY, sp.z);
  // Startposition: in Verlängerung Wrack->Stop weiter außen, ebenfalls im richtigen Element.
  const ox = sp.x - x, oz = sp.z - z, ol = Math.hypot(ox, oz) || 1;
  let far = { x: sp.x + ox/ol*120, z: sp.z + oz/ol*120 };
  const farOk = (onLand ? isOnLand(far.x,far.z) : !isOnLand(far.x,far.z)) && spotFreeOfBuildings(far.x,far.z);
  if(!farOk){ const alt = rescueSpotNear(sp.x + ox/ol*120, sp.z + oz/ol*120, onLand, true); if(alt) far = alt; }
  const start = new THREE.Vector3(far.x, groundY, far.z);
  g.position.copy(start); faceTowards(g, x, z); scene.add(g);
  const jet = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1, 8), waterJetMat); scene.add(jet);
  return { group:g, jet, wreck:new THREE.Vector3(x, groundY+1.5, z), start, stop, t:0 };
}
function spawnRescue(x, z, onLand) {
  clearRescue();
  // An der Land/Wasser-Grenze (Hafen, Strand) kommen BEIDE — jedes sauber aus seinem Element.
  // Sonst nur das passende (mitten an Land nur Auto, mitten im Meer nur Boot).
  const truck = makeRescueUnit(x, z, true);    // Auto von Land
  const boat  = makeRescueUnit(x, z, false);   // Boot vom Wasser
  if(truck) rescueUnits.push(truck);
  if(boat)  rescueUnits.push(boat);
  // Sicherheitsnetz: falls keins ein sauberes Element nahe fand -> das zum Crashort passende erzwingen.
  if(rescueUnits.length === 0){
    const sp = rescueSpotNear(x, z, onLand, false);
    const groundY = onLand ? ISLAND_Y : 0;
    const g = onLand ? makeFireTruck() : makeFireBoat();
    const start = new THREE.Vector3(x + 140, groundY, z + 60);
    g.position.copy(start); faceTowards(g, x, z); scene.add(g);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1, 8), waterJetMat); scene.add(jet);
    rescueUnits.push({ group:g, jet, wreck:new THREE.Vector3(x, groundY+1.5, z),
      start, stop:new THREE.Vector3(sp.x, groundY, sp.z), t:0 });
  }
  startSiren();
}
// Die Feuerwehr rückt nur in der Erdwelt aus — im Weltall und auf dem Mond gibt es keine.
// Ohne sie läuft nur der Crash-Timer ab und resetPlane() setzt zurück auf die Erde.
function crashRescue(x, z, onLand){ if(locale === 'earth') spawnRescue(x, z, onLand); }
function clearRescue(){
  stopSiren();
  for(const r of rescueUnits){ scene.remove(r.group); scene.remove(r.jet); }
  rescueUnits = [];
}
function updateRescue(dt){
  if(!rescueUnits.length) return;
  for(const r of rescueUnits){
    r.t += dt;
    const driveT = Math.min(1, r.t / 1.6);            // Phase 1: ins Bild fahren, Phase 2: löschen
    const ease = 1 - Math.pow(1 - driveT, 3);
    r.group.position.lerpVectors(r.start, r.stop, ease);
    faceTowards(r.group, r.wreck.x, r.wreck.z);
    const beacon = r.group.userData.beacon;
    if(beacon) beacon.material = (Math.floor(r.t*6)%2===0) ? blueMat : darkMat;
    const jet = r.jet;
    if(driveT >= 1){
      jet.visible = (Math.floor(r.t*12)%2===0);
      const noz = r.group.position.clone(); noz.y += 5;
      const target = r.wreck;
      const mid = noz.clone().lerp(target, 0.5);
      jet.position.copy(mid);
      jet.scale.set(1, noz.distanceTo(target), 1);
      const dir = target.clone().sub(noz).normalize();
      jet.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0), dir);
    } else jet.visible = false;
  }
}

// ---------- Löschwasser (nur Canadair) ----------
// Aufnehmen: 3 s unter 20 m ÜBER WASSER fliegen -> Tank voll. Ablassen: Taste B.
const dropMat = new THREE.MeshLambertMaterial({ color:0x9fd8ff, transparent:true, opacity:0.7 });
let waterDrop = null;   // {mesh, t}
function isCanadair(){ return MODEL_NAMES[currentModel] === 'Canadair'; }
function isAlphaJet(){ return MODEL_NAMES[currentModel] === 'AlphaJet'; }
function isTransall(){ return MODEL_NAMES[currentModel] === 'Transall'; }
function isAirbus(){ return MODEL_NAMES[currentModel] === 'Airbus'; }
function isMustang(){ return MODEL_NAMES[currentModel] === 'Mustang'; }
function isXWing(){ return MODEL_NAMES[currentModel] === 'XWing'; }
function isBoat(){ return MODEL_NAMES[currentModel] === 'Boat'; }
// Steuert man das U-Boot?
function isSub(){ return MODEL_NAMES[currentModel] === 'Sub'; }
// Boot ODER U-Boot: alles, was auf dem Wasser statt in der Luft unterwegs ist. Es gibt eine Reihe
// Stellen, die genau das meinen (kein Gyro, keine Höhenzeile, ovaler Schatten, Bootsmotor) — die
// fragen diese Funktion, damit nicht jede von ihnen einzeln um das U-Boot erweitert werden muss.
function isWaterCraft(){ return isBoat() || isSub(); }
// TAUCHT das U-Boot gerade? Nur dann darf die Kamera unter die Wasserlinie (siehe updateCamera:
// drei Klemmen auf y = 2 hingen dort ohne Ausnahme). Die Abfrage ist absichtlich weit gefasst —
// sie gilt, sobald man im U-Boot sitzt, nicht erst ab einer Tiefe: schon beim Aufsetzen der Nase
// muss die Kamera mitkommen, sonst schneidet sie beim Abtauchen die erste Sekunde ab.
function subTaucht(){ return isSub() && locale === 'earth'; }
// Löschfahrzeuge: die Canadair aus der Luft, das Feuerwehrboot vom Wasser aus. Nur mit ihnen
// brechen Brände aus (updateFire) und nur sie können löschen.
function isFireFighter(){ return isCanadair() || isBoat(); }
// ---- B: nur noch AKTIONEN ----------------------------------------------------------------
// Ein- und Aussteigen liegt seit dieser Runde auf Y (buttonY), damit B exklusiv den Aktionen
// gehoert: Wasser abwerfen, loeschen, Schleudersitz, Kisten, Laser, huepfen. Vorher machte B
// beides, und wer neben seinem Flieger loeschen wollte, stieg stattdessen ein.
function buttonB(){
  // Draussen unterwegs: huepfen (das ist die Aktion des Astronauten).
  if(eva){ evaActionB(); return; }
  if(locale === 'space'){ fireLaser(); return; }    // im Weltall: Laser (Einzelschuss)
  if(isBoat()) boatSpray();
  // Im U-BOOT ist B das Sonar. Nur getaucht: an der Oberflaeche gibt es nichts zu orten, und
  // uwCamBlend ist derselbe Massstab, den auch die Meereskulisse benutzt.
  else if(isSub()){
    if(uwCamBlend > 0.6) sonarPing();
    else { showBig('\u{2B07}\u{FE0F}'); bigTimer = 1.2; }   // Hinweis: erst abtauchen
  }
  else if(isCanadair()) dropWater();
  else if(isAlphaJet() || isMustang()) ejectSeat();
  else if(isTransall()) dropCrate();
}
// ---- Y: EIN- UND AUSSTEIGEN --------------------------------------------------------------
// Eine Taste fuer alles, was man an einem Fahrzeug tun kann: aussteigen, einsteigen, umsteigen.
// Die Reihenfolge zaehlt: wer in einem Fahrzeug sitzt, will heraus; wer daneben steht, hinein.
function buttonY(){
  if(eva){ evaBoardY(); return; }
  // Im FEUERWEHRBOOT: Y steigt AM UFER aus — man faehrt an den Strand und geht von Bord, nicht
  // mitten auf dem Meer. Das muss VOR evaAllowed stehen, denn das sperrt Boote grundsaetzlich
  // (if(isBoat()) return false): ein Boot schwimmt, und ueber Wasser gibt es keinen Grund zum Stehen.
  // Am Ufer gibt es den, deshalb hier die feinere Pruefung.
  //
  // Gilt fuer BEIDE Wege ins Boot, und das war der Fehler: erst hing dieser Zweig an harborBoatFrom,
  // also nur am Strand-Einstieg. Wer das Boot ueber die MODELLAUSWAHL nahm, kam gar nicht mehr heraus
  // — Y tat nichts, weil evaAllowed die Boote sperrt. Gemeldet als „aussteigen bei feuerwehrboot
  // ueber modelauswahl nicht moeglich".
  //
  // Fuer die Pruefung zaehlt ein Punkt vor dem Bug, denn das Boot liegt selbst nie auf dem Sand — es
  // haelt davor an (boatWaterFree schliesst den Strand aus).
  if(isBoat()){
    const bf = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
    const px = state.pos.x + bf.x*BOAT_LOOK*1.6, pz = state.pos.z + bf.z*BOAT_LOOK*1.6;
    if(isOnLand(px, pz) || isOnBeach(px, pz)){
      // Ueber den Strand eingestiegen? Dann wartet der eigene Flieger an seinem gemerkten Platz.
      // Sonst (Modellauswahl) einfach zu Fuss von Bord, das Boot bleibt liegen, wo es ist.
      if(harborBoatFrom) leaveHarborBoat();
      else evaExitFromBoat(px, pz);
    }
    else { showBig('\u{1F3D6}\u{FE0F}'); bigTimer = 1.2; }   // Hinweis: erst an den Strand fahren
    return;
  }
  // Im U-BOOT laeuft der Ausstieg ANDERS als im Feuerwehrboot, und das ist die Loesung eines echten
  // Problems: das U-Boot haelt 85 m vor der Sandkante (95 m Rumpf, Liegeplatz weiter draussen), ein
  // dort an Land abgesetzter Astronaut stand IM WASSER — im laufenden Spiel gemessen (evaSolid false,
  // Fusshoehe 0,00 statt 0,30).
  //
  // Deshalb: Y setzt ihn ins SCHLAUCHBOOT, ueberall auf dem Wasser. Das ist dasselbe Muster, mit dem
  // das Spiel jede andere Wasserkante behandelt (Traegerdeck, Kaikante): das Boot faengt den Schritt
  // auf, statt ihn zu verbieten. Zurueck geht es ohne Strand — heranfahren, den Rumpf antippen
  // (dinghyTouchesHarborSub). Wer an den Strand faehrt und ueber ihn eingestiegen ist, kommt wie
  // gehabt zum gemerkten Flieger.
  //
  // Muss VOR evaAllowed stehen (das sperrt Wasserfahrzeuge grundsaetzlich). Getaucht wird gar nicht
  // ausgestiegen: wer 80 m unter Wasser von Bord geht, waere sofort ertrunken — erst auftauchen.
  if(isSub()){
    // Getaucht wird nicht ausgestiegen. Gefragt wird state.onGround und NICHT die Hoehe gegen
    // seaSurfaceY: aufgetaucht liegt das Boot auf der WELLE, und die steht bis 2,1 m hoch — ein
    // Hoehenvergleich hielt es im Wellenberg fuer getaucht und verweigerte den Ausstieg (im
    // laufenden Spiel nachgemessen). stepSub setzt onGround genau auf "liegt auf der Wasserlinie",
    // also gibt es so nur eine Wahrheit statt zweier, die auseinanderlaufen.
    if(!state.onGround){
      showBig('\u{2B06}\u{FE0F}'); bigTimer = 1.2;    // Hinweis: erst auftauchen
      return;
    }
    // AUSSTEIGEN GEHT UEBERALL auf dem Wasser — man landet im SCHLAUCHBOOT. Das ist der Kern der
    // Loesung: vorher musste ein Platz an Land gefunden werden, und weil das U-Boot 85 m vor der
    // Sandkante haelt, stand der Astronaut dabei IM WASSER (gemessen: evaSolid false, Fusshoehe
    // 0,00 statt 0,30). Jetzt gilt dasselbe Muster wie ueberall sonst am Wasser: das Schlauchboot
    // faengt den Schritt auf, statt ihn zu verbieten — so wie es den Schritt vom Traegerdeck und
    // ueber die Kaikante auffaengt. Zurueck ins U-Boot kommt man ohne Strand: heranfahren, antippen
    // (siehe dinghyTouchesHarborSub).
    //
    // Steht LAND voraus, geht es weiter wie beim Feuerwehrboot: wer ueber den Strand eingestiegen
    // ist, kommt mit Y zum gemerkten Flieger zurueck. Der alte Weg bleibt also erhalten.
    const sf = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
    let ufer = false;
    for(let s = SUB_LOOK*0.6; s <= SUB_UFER_R && !ufer; s += 6){
      const px = state.pos.x + sf.x*s, pz = state.pos.z + sf.z*s;
      if(isOnLand(px, pz) || isOnBeach(px, pz)) ufer = true;
    }
    if(ufer && harborBoatFrom){ leaveHarborBoat(); return; }
    evaExitToDinghy();
    return;
  }
  // Im Flieger: aussteigen, wo es erlaubt ist (am Boden, auf festem Grund - siehe evaAllowed).
  if(evaAllowed()){ evaExit(); return; }
}
// Y zu Fuss: aus dem Fahrzeug heraus, in ein Fahrzeug hinein, oder ins eigene zurueck.
// Und wenn WEIT UND BREIT KEIN Fahrzeug ist: das Jetpack zuenden. Y heisst damit ueberall dasselbe,
// naemlich "in ein Fahrzeug" — man muss sich nur eines aussuchen, und wenn keines da ist, hat man
// immer noch das auf dem Ruecken. Das gilt an JEDEM Ort: auf der Erde, auf Mond und Mars und im
// Hangar selber (dort startete es bisher nur, wenn man ueber die Hallenkante lief).
//
// Die Reihenfolge zaehlt: erst die echten Fahrzeuge in Reichweite, das Jetpack ganz zuletzt — sonst
// startete es einem vor der Nase, wo man einsteigen wollte.
function evaBoardY(){
  if(!eva) return;
  if(eva.jet) return;                                     // am Jetpack: zurueck geht ueber Andocken
  if(eva.rover){ evaLeaveRover(); return; }               // im Rover  -> aussteigen
  if(eva.boat) return;                                    // im Boot: es endet an Land von allein
  if(roverNear()){ evaEnterRover(); return; }             // daneben   -> einsteigen
  const pn = parkPlaneNear();
  if(pn){ evaBoardParked(pn.name, pn.cx, pn.cz); return; } // auf dem Vorfeld -> einsteigen
  if(evaCanBoard()){ evaBoard(); return; }                // am eigenen Flieger -> einsteigen
  const hbn = harborBoatNear();
  if(hbn){ evaBoardHarborBoat(hbn.cx, hbn.cz); return; }  // am Kai -> ins Feuerwehrboot
  const hsn = harborSubNear();
  if(hsn){ evaBoardHarborSub(hsn.cx, hsn.cz); return; }   // am Strand -> ins U-Boot
  // Nichts da zum Einsteigen — also selbst abheben. Die Koordinaten sind nur der Rueckfall:
  // evaStartJet setzt ihn vor den Todesstern, wenn ein Gastgeber bekannt ist.
  evaStartJet(eva.group.position.x, eva.group.position.z, eva.group.position.y + 0.6);
}
// B zu Fuss: huepfen. Das ist die einzige Aktion, die der Astronaut hat - im Boot und im Rover
// gibt es keine (dort faehrt man), und am Jetpack schon gar nicht.
function evaActionB(){
  if(!eva || eva.jet || eva.rover || eva.boat) return;
  evaJump();
}

// ---------- Feuerwehrboot: löschen mit B ----------
// Das Boot schöpft aus dem Meer, unter dem es fährt — es muss also nicht tanken. Ein Druck auf B
// gibt für BOAT_SPRAY_TIME Sekunden einen Wasserstrahl nach vorn, der alles Brennende in
// BOAT_SPRAY_R Metern löscht: die Wracks abgestürzter KI-Flieger genauso wie einen Waldbrand am
// Ufer. Der Strahl selbst ist derselbe Kegel, den auch die Rettungsboote benutzen.
const BOAT_SPRAY_TIME = 2.5;    // Sekunden Wasserstrahl pro Druck
// Löschradius um den Zielpunkt des Strahls, und der liegt selbst BOAT_SPRAY_R vor dem Bug — die
// Reichweite ist also das Doppelte. 80 m ergeben 160 m, und das braucht es: der Sandrand hält das
// Boot je nach Inselgröße 49–106 m vom Uferfeuer weg (gemessen), mit 60 m ging das nur knapp auf.
// Ein Kind legt nicht auf den Meter genau an.
const BOAT_SPRAY_R    = 80;
// Sitz der Bugkanone, am gebauten Modell ausgemessen (siehe updateBoatSpray): 6,4 m vor der
// Bootsmitte und 4,12 m über dem Kiel, also 3,0 m über der Wasserlinie (BOAT_DRAFT abgezogen).
const BOAT_NOZZLE_Z   = 6.4;
const BOAT_NOZZLE_Y   = 3.0;
let boatSpray_ = null;          // {mesh, t}
function boatSpray(){
  if(!isBoat() || boatSpray_) return;             // ein Strahl zur Zeit
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 10), waterJetMat);
  scene.add(mesh);
  boatSpray_ = { mesh, t: BOAT_SPRAY_TIME };
}
function clearBoatSpray(){
  if(boatSpray_){ scene.remove(boatSpray_.mesh); boatSpray_ = null; }
}
function updateBoatSpray(dt){
  if(!boatSpray_) return;
  boatSpray_.t -= dt;
  // Strahl aus der BUGKANONE schräg nach vorne, Ziel BOAT_SPRAY_R voraus auf Wasserhöhe.
  // Die Düse sitzt dort, wo sie im Modell auch steht — am gebauten Objekt ausgemessen
  // (C:/tmp/duese.js): das Kanonenteil liegt 6,4 m vor der Bootsmitte (der Bug endet bei 8,0) und
  // 4,12 m über dem Kiel. Der Kiel liegt BOAT_DRAFT unter state.pos, macht 3,0 m über pos.y.
  // Vorher standen hier 4 m und pos.y + 6: das sind 7,1 m über dem Kiel, das Boot ist aber nur
  // 6,4 m hoch — der Strahl begann also über dem Mast, mitten in der Luft. Genau das war zu sehen.
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const noz = new THREE.Vector3(state.pos.x + fwd.x*BOAT_NOZZLE_Z,
                               state.pos.y + BOAT_NOZZLE_Y,
                               state.pos.z + fwd.z*BOAT_NOZZLE_Z);
  const tgt = new THREE.Vector3(state.pos.x + fwd.x*BOAT_SPRAY_R, state.pos.y + 1,
                                state.pos.z + fwd.z*BOAT_SPRAY_R);
  const m = boatSpray_.mesh;
  m.visible = (Math.floor(boatSpray_.t*14)%2===0);      // flackert wie der Strahl der Feuerwehr
  m.position.copy(noz).lerp(tgt, 0.5);
  m.scale.set(1, noz.distanceTo(tgt), 1);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0), tgt.clone().sub(noz).normalize());
  // Gelöscht wird um den Zielpunkt des Strahls herum, nicht um das Boot — so kann man vom Wasser
  // aus einen Brand am Ufer erreichen, ohne aufzulaufen.
  extinguishNear(tgt.x, tgt.z, BOAT_SPRAY_R);
  if(boatSpray_.t <= 0) clearBoatSpray();
}

// Die nächstgelegene brennende Stelle — für den Radar-Blip. Es zählt dasselbe, was auch
// extinguishNear löschen kann: der eigene Waldbrand, die Brände der KI-Canadairs und die
// brennenden Wracks. Rückgabe {x,z} oder null.
function nearestFireXZ(){
  let best = null, bd = Infinity;
  const consider = (x, z)=>{
    const d = Math.hypot(x-state.pos.x, z-state.pos.z);
    if(d < bd){ bd = d; best = { x, z }; }
  };
  if(fire) consider(fire.x, fire.z);
  for(const f of aiFires) consider(f.x, f.z);
  for(const e of fleet) if(e.crashFire) consider(e.group.position.x, e.group.position.z);
  if(flyby && flyby.crashFire) consider(flyby.group.position.x, flyby.group.position.z);
  return best;
}

// Löscht alles Brennende um (x,z) im Radius r. Deckt beide Feuer-Arten ab:
//  1. den eigenen Waldbrand (updateFire) und die Brände der KI-Canadairs (aiFires),
//  2. die brennenden Wracks abgestürzter KI-Flieger (Flotte und Überschall-Vorbeiflug).
// Rückgabe: true, wenn etwas gelöscht wurde (dann gibt es den Daumen).
function extinguishNear(x, z, r){
  let hit = false;
  // --- eigener Waldbrand ---
  if(fire && Math.hypot(fire.x-x, fire.z-z) < r + fire.r){
    clearFire(); fireRespawnT = 20 + Math.random()*10; hit = true;
  }
  // --- Brände der KI-Canadairs ---
  for(let i=aiFires.length-1;i>=0;i--){
    const f = aiFires[i];
    if(Math.hypot(f.x-x, f.z-z) >= r + f.r) continue;
    const owner = f.owner;
    scene.remove(f.grp); aiFires.splice(i,1);
    if(owner){ owner.fireGrp=null; owner.fireXZ=null; assignMission(owner); }
    hit = true;
  }
  // --- brennende Wracks: die Flotte und der Überschall-Vorbeiflug ---
  const wrecks = [];
  for(const e of fleet) if(e.crashFire) wrecks.push(e);
  if(flyby && flyby.crashFire) wrecks.push(flyby);
  for(const w of wrecks){
    const wp = w.group.position;
    if(Math.hypot(wp.x-x, wp.z-z) >= r) continue;
    scene.remove(w.crashFire); w.crashFire = null;
    hit = true;
  }
  if(hit) showThumb();
  return hit;
}

const SCOOP_FULL = 2.0;   // Sekunden über Wasser für vollen Tank (1 s = 50 %)
const DROP_FULL  = 4.0;   // Sekunden Abwurfdauer bei vollem Tank (halb = 2 s)
function updateScoop(dt){
  if(!isCanadair()) return;
  const alt = state.pos.y - ISLAND_Y;
  // Das Traegerdeck zaehlt bewusst NICHT als Wasser, obwohl die Canadair dort inzwischen landen
  // darf: sie steht 12 m ueber der Oberflaeche und kann nicht schoepfen. Zum Tanken muss sie
  // aufs Meer — das ist der Sinn eines Flugboots.
  const overWater = !isOnLand(state.pos.x, state.pos.z) && !isOnCarrier(state.pos.x, state.pos.z);
  // Auffüllen: tief ÜBER Wasser fliegen ODER auf dem Wasser STEHEN (Start im Hafen -> sofort tanken).
  const tankingFlight = overWater && alt > 0.5 && alt < 20 && !state.onGround;
  const tankingFloat  = overWater && state.onGround;   // schwimmt am Wasser (z.B. Hafen-Start)
  if((tankingFlight || tankingFloat) && !waterDrop && state.water < 1){
    state.water = Math.min(1, state.water + dt / SCOOP_FULL);
  }
}
function dropWater(){
  if(!isCanadair() || state.water <= 0 || waterDrop) return;
  // Einmal drücken = kompletter Tank. Abwurfdauer proportional zur Menge.
  const dur = DROP_FULL * state.water;
  state.water = 0;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 3.0, 24, 14, 1, true), dropMat);
  scene.add(mesh);
  waterDrop = { mesh, t: dur };
}
function updateWaterDrop(dt){
  if(!waterDrop) return;
  waterDrop.t -= dt;
  waterDrop.mesh.position.set(state.pos.x, state.pos.y - 12, state.pos.z);
  const puls = 0.85 + 0.15*Math.sin(waterDrop.t*20);
  waterDrop.mesh.scale.set(puls, 1, puls);
  waterDrop.mesh.material.opacity = 0.65;
  // KI-Feuer löschen: Spieler-Wasser (Canadair) über einer KI-Feuerstelle -> Feuer aus (Daumen).
  // Läuft für jedes Löschfahrzeug — Canadair aus der Luft, Feuerwehrboot vom Wasser aus.
  if(typeof aiFires !== 'undefined' && aiFires.length){
    const alt = state.pos.y - ISLAND_Y;
    for(let i=aiFires.length-1;i>=0;i--){
      const f=aiFires[i];
      if(alt < 130 && Math.hypot(f.x-state.pos.x, f.z-state.pos.z) < f.r){
        const owner=f.owner; if(owner) owner.fireGrp=null;
        scene.remove(f.grp); aiFires.splice(i,1);
        if(owner){ owner.fireXZ=null; assignMission(owner); }
        showThumb();
      }
    }
  }
  if(waterDrop.t <= 0){ scene.remove(waterDrop.mesh); waterDrop = null; }
}

// ---------- Transall: Kisten am Fallschirm abwerfen ----------
const crateMat = new THREE.MeshLambertMaterial({ color:0x8a6a3a });   // Holzkiste
const CRATE_MAX = 4;        // max. Kisten
const CRATE_LOAD_TIME = 2;  // Sekunden auf der Bahn für volle Ladung (4 Kisten)
let crateLoad = 0;          // geladene Kisten (0..4)
let crateLoadT = 0;         // Ladefortschritt (Sekunden auf der Bahn)
const activeCrates = [];    // fallende Kisten
function makeCrate(){
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(3,3,3), crateMat);
  box.position.y = 1.5; g.add(box);
  // Fallschirm drüber — derselbe wie über dem Piloten (TopNotch Assets), damit es einheitlich
  // aussieht. Vorher hing hier ein anderes Modell.
  if(chute2Template){
    const pc = chute2Template.clone(true); pc.position.y = 3.4; g.add(pc);
  } else if(parachuteTemplate){
    const pc = parachuteTemplate.clone(true); pc.position.y = 8; g.add(pc);
  } else {
    const pc = new THREE.Mesh(new THREE.SphereGeometry(4,16,10,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshLambertMaterial({ color:0xff8822, side:THREE.DoubleSide }));
    pc.position.y = 8; g.add(pc);
  }
  return g;
}
let crateQueue = 0, crateTimer = 0;    // Abwurf-Warteschlange: Anzahl + Countdown
function dropCrate(){
  if(!isTransall() || crateLoad <= 0) return;
  crateQueue = crateLoad;              // alle geladenen Kisten in die Warteschlange
  crateLoad = 0;
  crateTimer = 0;                      // erste Kiste sofort
}
function releaseCrate(){
  const back = new THREE.Vector3(0,0,1).applyQuaternion(state.quat);
  const g = makeCrate();
  g.position.set(state.pos.x + back.x*6, state.pos.y - 2, state.pos.z + back.z*6);
  scene.add(g);
  activeCrates.push({ group:g, vy:-2, vx:state.vel.x*0.3, vz:state.vel.z*0.3 });
}
function updateCrates(dt){
  // Abwurf-Warteschlange: alle 0,3 s eine Kiste hintereinander rauswerfen
  if(crateQueue > 0){
    crateTimer -= dt;
    if(crateTimer <= 0){ releaseCrate(); crateQueue--; crateTimer = 0.3; }
  }
  // Graduelles Laden: auf der LANDEBAHN stehen/rollen -> alle 0,5 s eine Kiste (2 s = 4).
  // Geladen wird auf der Landebahn UND auf dem Traegerdeck. Das Deck kam mit der Landeerlaubnis
  // dazu: wer dort aufsetzen darf, muss dort auch Fracht aufnehmen koennen, sonst steht man auf
  // dem Deck und kann nichts tun.
  if(isTransall() && state.onGround && crateLoad < CRATE_MAX
     && (isOnRunway(state.pos.x, state.pos.z) || isOnCarrier(state.pos.x, state.pos.z))){
    crateLoadT += dt;
    crateLoad = Math.min(CRATE_MAX, Math.floor(crateLoadT / (CRATE_LOAD_TIME/CRATE_MAX)));
  } else if(!isOnRunway(state.pos.x, state.pos.z)){
    crateLoadT = crateLoad * (CRATE_LOAD_TIME/CRATE_MAX);   // Fortschritt = bereits geladene Kisten
  }
  // fallende Kisten animieren (sanft sinken am Fallschirm, dann liegen bleiben)
  for(let i=activeCrates.length-1; i>=0; i--){
    const c = activeCrates[i];
    c.vy = Math.max(c.vy - 4*dt, -6);       // Fallschirm bremst -> gemächliches Sinken
    c.group.position.x += c.vx*dt;
    c.group.position.z += c.vz*dt;
    c.group.position.y += c.vy*dt;
    c.vx *= 0.98; c.vz *= 0.98;
    const gy = isOnLand(c.group.position.x, c.group.position.z) ? ISLAND_Y : 0;
    if(c.group.position.y <= gy+1.5){ c.group.position.y = gy+1.5;
      if(!c.grounded){ c.grounded=true;
        // Kiste auf der Zielinsel gelandet? -> Lieferung zählen (fürs Transall-Minispiel)
        if(cargoTarget && Math.hypot(c.group.position.x-cargoTarget.x, c.group.position.z-cargoTarget.z) < cargoTarget.r+20)
          cargoTarget.delivered=(cargoTarget.delivered||0)+1;
      }
      c.landed=(c.landed||0)+dt;
      if(c.landed>4){ scene.remove(c.group); activeCrates.splice(i,1); } }  // 4 s liegen, dann weg
  }
}

// ---------- Waldbrand-Modus (nur Canadair): Feuer auf Inselwiesen löschen ----------
const flameMat = new THREE.MeshBasicMaterial({ color:0xff5510, transparent:true, opacity:0.9 });
const smokeMat = new THREE.MeshBasicMaterial({ color:0x555555, transparent:true, opacity:0.5 });
// Leitstrahl-Pfeile: kräftige Farben, VOLL sichtbar (depthTest:false -> nie von Terrain/Wellen verdeckt).
const arrowMat   = new THREE.MeshBasicMaterial({ color:0xff3b3b, transparent:true, opacity:0.95, depthTest:false }); // rot: leer/hin
const arrowMatMid= new THREE.MeshBasicMaterial({ color:0xffd21e, transparent:true, opacity:0.95, depthTest:false }); // gelb: beladen
const arrowMatOk = new THREE.MeshBasicMaterial({ color:0x2be63a, transparent:true, opacity:0.98, depthTest:false }); // grün: jetzt!
let fire = null;         // {group, x, z, r, flames:[]}
let fireRespawnT = -1;   // Countdown bis neues Feuer (-1 = inaktiv/erstes Feuer sofort)
let leadArrows = [];     // Pfeilkette (Cyberpunk-Style) zum Feuer
let thumbEl = null;      // grüner Daumen (DOM-Overlay)

// ---------- Kein Aufgaben-Schalter mehr ----------
// Die frueheren "Minispiele" (vorgegebenes Ziel + Erfolgsmeldung) sind ausgebaut: sie haben sich als
// unpraktisch erwiesen. Die FAEHIGKEITEN bleiben vollstaendig — Feuer bricht aus und laesst sich
// loeschen, der Airbus transportiert Leute, die Transall wirft Fracht ab. Weg ist nur das Vorgeben
// eines Ziels und das Loben danach: man fliegt frei und macht, was man mag.
let leadOn = false;      // LEITSTRAHL DEAKTIVIERT (Navigation nur noch über Radar). Code bleibt erhalten.

function makeFire(x, z){
  const g = new THREE.Group();
  const flames = [];
  for(let i=0;i<16;i++){
    const a = Math.random()*Math.PI*2, rr = Math.random()*24;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(2+Math.random()*2, 7+Math.random()*7, 6), flameMat);
    fl.position.set(Math.cos(a)*rr, ISLAND_Y+3, Math.sin(a)*rr); g.add(fl); flames.push(fl);
    const sm = new THREE.Mesh(new THREE.SphereGeometry(3+Math.random()*2, 6, 5), smokeMat);
    sm.position.set(Math.cos(a)*rr, ISLAND_Y+12, Math.sin(a)*rr); g.add(sm);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  return { group:g, x, z, r:60, flames };   // großzügiger Löschradius (60 m)
}
const FIRE_MAX_DIST = 1100;  // Feuer nur auf Inseln, die näher als das sind
function spawnFire(){
  clearFire();
  const pcx = Math.round(state.pos.x/CELL), pcz = Math.round(state.pos.z/CELL);
  // Flugrichtung (horizontal) für den 135°-Vorwärtskegel (±67,5°)
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const fdx = fwd.x, fdz = fwd.z;
  const flen = Math.hypot(fdx, fdz) || 1;
  const COS_HALF = Math.cos(67.5 * Math.PI/180);     // Grenze des Kegels
  // nächste WIESEN-Insel VOR dem Flieger (im Kegel) suchen; 2 Ringe weit
  let best=null, bestCx, bestCz, bestD=1e9;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
    const cx=pcx+dx, cz=pcz+dz;
    const info=islandInfo(cx,cz); if(!info) continue;
    if(cellRnd(cx,cz,99) < 0.10) continue;           // Stadt-Inseln überspringen (brennen nicht)
    const rx=info.wx-state.pos.x, rz=info.wz-state.pos.z;
    const d=Math.hypot(rx,rz);
    if(d < 60) continue;                             // nicht direkt auf dem Flieger
    // Winkel zur Flugrichtung: nur Inseln im 135°-Kegel nach vorne
    const dot=(rx*fdx + rz*fdz)/(d*flen);
    if(dot < COS_HALF) continue;
    if(d<bestD){bestD=d;best=info;bestCx=cx;bestCz=cz;}
  }
  if(!best || bestD > FIRE_MAX_DIST) return false;   // keine Wieseninsel vor mir nah genug
  // Feuerstelle auf der Wiese finden, die NICHT auf/neben einem Gebäude liegt
  const buildings = islandBuildings(bestCx, bestCz) || [];
  let fx, fz, ok=false;
  for(let tries=0; tries<20 && !ok; tries++){
    // Fürs Boot brennt es NAHE AM UFER: es kann nicht an Land, und der Wasserstrahl reicht nur
    // etwa 120 m weit (Strahlweite + Löschradius). Ein Brand mitten auf der Insel wäre für das
    // Boot unerreichbar. Die Canadair fliegt drüber, für sie bleibt die ganze Wiese offen.
    const band = isBoat() ? (0.78+Math.random()*0.16) : (0.35+Math.random()*0.4);
    const ang=Math.random()*Math.PI*2, rr=best.radius*band;
    const lx=Math.cos(ang)*rr, lz=Math.sin(ang)*rr;
    ok = true;
    for(const b of buildings){
      if(Math.hypot(lx-b.x, lz-b.z) < 40){ ok=false; break; }   // zu nah an Bauwerk
    }
    if(ok){ fx=best.wx+lx; fz=best.wz+lz; }
  }
  if(!ok) return false;                               // kein freier Wiesenfleck gefunden
  fire = makeFire(fx, fz);
  buildLeadArrows();
  return true;
}
// nächste Wasserstelle (für "erst Wasser holen"): aktuelle Pos wenn schon über Meer, sonst radial
function nearestWaterXZ(x, z){
  // Schon über Wasser? -> Zielpunkt WEIT VORAUS (in Flugrichtung), nicht die eigene Position,
  // damit der Leitstrahl eine echte Strecke nach vorne zeigt (sonst kollabiert die Kurve).
  if(!isOnLand(x, z)){
    const f = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
    const fl = Math.hypot(f.x, f.z) || 1;
    return { x: x + f.x/fl*400, z: z + f.z/fl*400 };
  }
  for(let r=80; r<=700; r+=70) for(let a=0; a<8; a++){
    const px=x+Math.cos(a/8*6.283)*r, pz=z+Math.sin(a/8*6.283)*r;
    if(!isOnLand(px, pz)) return { x:px, z:pz };
  }
  return { x, z };
}
function buildLeadArrows(){
  clearArrows();
  for(let i=0;i<14;i++){
    const ar = new THREE.Mesh(new THREE.ConeGeometry(5, 13, 5), arrowMat);
    ar.renderOrder = 998;
    scene.add(ar); leadArrows.push(ar);
  }
}
function clearArrows(){ for(const a of leadArrows) scene.remove(a); leadArrows=[]; }
function clearFire(){
  if(fire){ scene.remove(fire.group); fire=null; }
  clearArrows();
}
let thumbT = 0;   // Restanzeigedauer des Daumens
function showThumb(){
  if(!thumbEl){
    thumbEl = document.createElement('div');
    thumbEl.style.cssText='position:absolute;font-size:60px;opacity:0;transition:opacity .3s;pointer-events:none;transform:translate(-50%,-50%);';
    thumbEl.textContent='👍';
    document.body.appendChild(thumbEl);
  }
  thumbEl.style.opacity='1';
  thumbT = 1.8;
}
// Daumen über dem Flugzeug positionieren (3D->2D projiziert), solange thumbT läuft
const _thumbV = new THREE.Vector3();
function updateThumb(dt){
  if(!thumbEl || thumbT<=0) return;
  thumbT -= dt;
  if(thumbT<=0){ thumbEl.style.opacity='0'; return; }
  _thumbV.set(state.pos.x, state.pos.y+14, state.pos.z).project(camera);
  const sx = (_thumbV.x*0.5+0.5)*innerWidth;
  const sy = (-_thumbV.y*0.5+0.5)*innerHeight;
  thumbEl.style.left = sx+'px';
  thumbEl.style.top  = sy+'px';
}

// Kurzes Umschalt-Symbol mittig oben (🎯/🧭/🚫) – kindgerecht, kein Text.
let toggleEl = null, toggleT = 0;
function showToggle(sym){
  if(!toggleEl){
    toggleEl = document.createElement('div');
    toggleEl.style.cssText='position:absolute;left:50%;top:18%;font-size:72px;opacity:0;'+
      'transition:opacity .2s;pointer-events:none;transform:translate(-50%,-50%);';
    document.body.appendChild(toggleEl);
  }
  toggleEl.textContent = sym;
  toggleEl.style.opacity = '1';
  toggleT = 1.2;
}
function updateToggleHint(dt){

  if(!toggleEl || toggleT<=0) return;
  toggleT -= dt;
  if(toggleT<=0) toggleEl.style.opacity='0';
}

// LEITSTRAHL DEAKTIVIERT: toggleLead ist absichtlich wirkungslos (Navigation läuft nur über Radar).
// Die frühere Logik ist unten in drawLeadRoute erhalten, wird aber wegen leadOn=false nie sichtbar.
function toggleLead(){ /* deaktiviert */ }
// H / L4: Tastatur-/Controller-Belegung unten ein-/ausblenden (Standard: aus).
function toggleHelp(){
  const h = document.getElementById('hint');
  if(h) h.classList.toggle('show');
}

// Symbole über dem Flieger beim Aufnehmen/Beladen (gleicher Stil für alle):
//  Canadair 💧 beim Tanken (tief über Wasser), Transall 📦 beim Kistenladen (steht auf der Bahn).
let scoopEl = null;
const _scoopV = new THREE.Vector3();
function updateScoopHint(dt){
  const alt = state.pos.y - ISLAND_Y;
  const overWater = !isOnLand(state.pos.x, state.pos.z) && !isOnCarrier(state.pos.x, state.pos.z);
  const tanking = isCanadair() && !waterDrop && state.water < 1 && overWater
                  && ((!state.onGround && alt > 0.5 && alt < 20) || state.onGround);  // fliegend ODER schwimmend
  // Dieselbe Bedingung, unter der wirklich geladen wird (siehe crateLoad weiter oben): Landebahn
  // ODER Trägerdeck. Vorher stand hier nur die Bahn — auf dem Deck lud die Transall also, ohne dass
  // ein Kisten-Symbol erschien, und es sah aus wie ein Defekt.
  const loadingCrates = isTransall() && state.onGround && crateLoad < CRATE_MAX
                  && (isOnRunway(state.pos.x, state.pos.z) || isOnCarrier(state.pos.x, state.pos.z));
  if(!scoopEl){
    scoopEl = document.createElement('div');
    scoopEl.style.cssText='position:absolute;font-size:60px;opacity:0;transition:opacity .2s;pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap;';
    document.body.appendChild(scoopEl);
  }
  let sym = null;
  // Math.max(1, …) faengt hier zwar Negatives ab, aber repeatSym klemmt auch nach oben und
  // vertraegt NaN — eine Stelle, eine Regel.
  if(tanking)            sym = repeatSym('💧', Math.max(1, state.water*4), 4);   // 1..4 Tropfen
  else if(loadingCrates) sym = repeatSym('📦', Math.max(1, crateLoad), CRATE_MAX); // 1..4 Kisten
  if(sym){
    scoopEl.textContent = sym;
    _scoopV.set(state.pos.x, state.pos.y+14, state.pos.z).project(camera);
    scoopEl.style.left = ((_scoopV.x*0.5+0.5)*innerWidth)+'px';
    scoopEl.style.top  = ((-_scoopV.y*0.5+0.5)*innerHeight)+'px';
    scoopEl.style.opacity='1';
  } else {
    scoopEl.style.opacity='0';
  }
}

let arrowPhase = 0;
const _bez = new THREE.Vector3(), _bezT = new THREE.Vector3(), _upY = new THREE.Vector3(0,1,0);
function bezier3(p0,p1,p2,p3,t,out){     // kubische Bézier (2 Kontrollpunkte)
  const u=1-t, uu=u*u, tt=t*t;
  const a=uu*u, b=3*uu*t, c=3*u*tt, d=tt*t;
  out.set(
    a*p0.x + b*p1.x + c*p2.x + d*p3.x,
    a*p0.y + b*p1.y + c*p2.y + d*p3.y,
    a*p0.z + b*p1.z + c*p2.z + d*p3.z);
  return out;
}

// Gemeinsames Leitsystem: weiche Pfeil-Route (Bézier) zum Ziel; optional mit geradem
// Gleitpfad-Endanflug (opts.glideTo) für sauberen Anflugwinkel + Sinkflug-Linie.
//  arrows   = Pfeil-Array (Kegel), goal = {x,y,z}, arMat = Ampelmaterial (rot/gelb/grün)
//  opts.lowRoute = Kurve tief halten (leerer Tank), opts.glideTo = {tx,ty,tz,dirX,dirZ,len,angle}
// Bei !leadOn werden alle Pfeile versteckt (LB-Schalter) -> eine Stelle für alle Modelle.
function drawLeadRoute(arrows, goal, arMat, opts, dt){
  opts = opts || {};
  if(!leadOn){ for(const a of arrows) a.visible=false; return; }
  const p0 = new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z);
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const flat = new THREE.Vector3(fwd.x,0,fwd.z); if(flat.lengthSq()<1e-4) flat.set(0,0,-1); flat.normalize();
  // Endpunkt des KURVIGEN Teils: bei Gleitpfad = Anfang der Geraden, sonst = Ziel.
  const GS = opts.glideTo || null;
  const touch = GS ? new THREE.Vector3(GS.tx, GS.ty, GS.tz) : null;
  const climb = GS ? Math.tan(GS.angle) * GS.len : 0;
  let pEnd = GS
    ? new THREE.Vector3(GS.tx - GS.dirX*GS.len, GS.ty + climb, GS.tz - GS.dirZ*GS.len)
    : new THREE.Vector3(goal.x, goal.y, goal.z);
  // Robustheit: liegt der (Kurven-)Endpunkt zu nah am Flieger, würde die Kurve kollabieren und die
  // Pfeile klumpen. Dann Endpunkt auf eine Mindeststrecke NACH VORNE schieben -> sichtbarer Leitstrahl.
  let dxz = Math.hypot(pEnd.x-p0.x, pEnd.z-p0.z);
  if(dxz < 200){
    const fl = new THREE.Vector3(fwd.x,0,fwd.z); if(fl.lengthSq()<1e-4) fl.set(0,0,-1); fl.normalize();
    pEnd = new THREE.Vector3(p0.x + fl.x*260, pEnd.y, p0.z + fl.z*260);
  }
  const dist2 = p0.distanceTo(pEnd);
  const toGoal = new THREE.Vector3(pEnd.x-p0.x,0,pEnd.z-p0.z);
  if(toGoal.lengthSq()<1e-4) toGoal.copy(flat); else toGoal.normalize();
  const facing = flat.x*toGoal.x + flat.z*toGoal.z;   // 1=genau voraus, -1=hinter mir
  const side = new THREE.Vector3(-flat.z,0,flat.x);
  const sideSign = (side.x*toGoal.x + side.z*toGoal.z) >= 0 ? 1 : -1;
  side.multiplyScalar(sideSign);
  const lowRoute = !!opts.lowRoute;
  // Die Kurve beginnt IMMER auf aktueller Flughöhe (p0.y) -> nahtlos beim Flieger, Pfeile sichtbar
  // (nicht unter den Flieger gelegt). Bei "rot"/tiefem Anflug sinkt sie ERST zum Ziel hin ab (midY tief),
  // bleibt aber am Start hoch -> der weite Vorwärtsbogen bleibt erhalten.
  const startY = p0.y;
  const midY   = lowRoute ? (p0.y*0.55 + Math.max(ISLAND_Y+15, pEnd.y)*0.45)
                          : (p0.y + (pEnd.y-p0.y)*0.4);
  // IMMER eine WEICHE Kurve (ruhig, kinderfreundlich, keine 90°-Knicke):
  // P1 startet in Flugrichtung nach vorne (weiter Einlauf-Bogen), P2 nähert das Ziel von der Seite an.
  // Liegt das Ziel seitlich/hinter mir, wird der Bogen GROSS und ruhig (weite Runde) statt scharf.
  const lead = Math.max(260, dist2*0.6);            // etwas weiterer Vorwärtsbogen
  const turnAmt = (1 - facing) / 2;                 // 0 (voraus) .. 1 (genau hinter mir)
  const p1 = new THREE.Vector3(p0.x + flat.x*lead, startY, p0.z + flat.z*lead);
  const sideAmt = dist2 * (0.15 + 0.55*turnAmt);    // je weiter hinten, desto weiter außen = große Runde
  const p2 = new THREE.Vector3(
    pEnd.x + side.x*sideAmt - toGoal.x*dist2*0.12, midY,
    pEnd.z + side.z*sideAmt - toGoal.z*dist2*0.12);
  // Pfeile durchgehend RUHIG laufen lassen (leichtes Fließen, nicht hektisch).
  arrowPhase = (arrowPhase + dt*0.05) % 1;
  const N = arrows.length;
  const split = GS ? 0.62 : 1.0;   // letzten ~38 % = gerader Gleitpfad zur Schwelle
  // Pfeilgröße MIT der Distanz (weit weg = größer/sichtbar, nah = kleiner -> verdeckt die Sicht NICHT).
  const scl = Math.max(0.8, Math.min(1.9, dist2/800));
  // Vorderen Bereich AUSBLENDEN: je näher das Ziel, desto mehr Pfeile vorm Flieger weglassen. Beginnt
  // FRÜH (ab ~1200 m), damit sich schon lange vor dem Ziel kein Klumpen vor die Kamera schiebt.
  const hideFront = Math.max(0.10, Math.min(0.7, 1 - dist2/1200));
  for(let i=0;i<N;i++){
    const ar = arrows[i];
    const t = ((i/N) + arrowPhase) % 1;
    if(t < hideFront){ ar.visible=false; continue; }
    ar.visible = true;
    if(ar.material !== arMat) ar.material = arMat;
    ar.scale.setScalar(scl);
    if(t < split){
      const tt = t/split;
      bezier3(p0,p1,p2,pEnd,tt,_bez);
      bezier3(p0,p1,p2,pEnd,Math.min(tt+0.02,1),_bezT);
      const dir = _bezT.sub(_bez).normalize();
      ar.position.copy(_bez);
      ar.quaternion.setFromUnitVectors(_upY, dir);
    } else {
      const tt = (t-split)/(1-split);
      _bez.lerpVectors(pEnd, touch, tt);
      _bezT.subVectors(touch, pEnd).normalize();
      ar.position.copy(_bez);
      ar.quaternion.setFromUnitVectors(_upY, _bezT);
    }
  }
}
let airborneT = 0;   // wie lange schon in der Luft (fürs erste Feuer)
function updateFire(dt){
  // Feuer gibt es, solange man ein LOESCHFAHRZEUG steuert (Canadair oder Feuerwehrboot) —
  // ohne Schalter, denn die Aufgaben-Umschaltung ist ausgebaut.
  if(!isFireFighter()){ clearFire(); fireRespawnT=-1; airborneT=0; return; }
  if(!fire){
    // Erst 15 s unterwegs sein, bevor das erste Feuer ausbricht. Das Boot faehrt am Boden —
    // fuer es zaehlt die Fahrzeit, nicht die Flugzeit.
    if(state.onGround && !isBoat()){ airborneT = 0; return; }
    airborneT += dt;
    if(airborneT < 15) return;
    if(fireRespawnT < 0){ spawnFire(); return; }   // erstes Feuer sobald Insel in Reichweite
    fireRespawnT -= dt;
    if(fireRespawnT<=0){ if(!spawnFire()) fireRespawnT = 2; }  // kein Ziel? in 2s neu versuchen
    return;
  }
  for(const fl of fire.flames){ fl.scale.y = 0.7 + Math.random()*0.6; }

  // --- Ballistischer Auftreffpunkt: wohin fällt das Wasser, wenn ich JETZT abwerfe? ---
  const TARGET_ALT = 28;                             // optimale Überflughöhe über dem Feuer
  const alt = Math.max(0, state.pos.y - ISLAND_Y);
  const fallT = Math.sqrt(2*alt/9.81);
  const impactX = state.pos.x + state.vel.x * fallT;
  const impactZ = state.pos.z + state.vel.z * fallT;
  const impactDist = Math.hypot(fire.x-impactX, fire.z-impactZ);   // Abstand Auftreffpunkt<->Feuer
  const haveWater = (state.water>0 || waterDrop);

  // Ampel: rot = Tank leer, gelb = Wasser da, grün = Treffer sicher
  const aimOk = haveWater && alt < 120 && impactDist < fire.r + 25;
  const arMat = aimOk ? arrowMatOk : (haveWater ? arrowMatMid : arrowMat);
  const onTarget = haveWater && alt < 130 && (impactDist < fire.r || Math.hypot(fire.x-state.pos.x, fire.z-state.pos.z) < fire.r);

  // Leitroute: mit Wasser -> weiche Kurve zum Feuer (Überflughöhe). Ohne Wasser -> tiefer
  // Gleitpfad zur nächsten Wasserstelle (zeigt, wie tief man zum Tanken anfliegen muss).
  const goal = { x:fire.x, z:fire.z, y: ISLAND_Y + TARGET_ALT };
  let opts;
  if(haveWater){
    opts = { lowRoute:false };
  } else {
    const w = nearestWaterXZ(state.pos.x, state.pos.z);
    const toW = new THREE.Vector3(w.x-state.pos.x, 0, w.z-state.pos.z);
    if(toW.lengthSq()<1e-4) toW.set(0,0,-1); else toW.normalize();
    goal.x = w.x; goal.z = w.z; goal.y = ISLAND_Y + 12;
    opts = { lowRoute:true, glideTo:{ tx:w.x, ty:12, tz:w.z, dirX:toW.x, dirZ:toW.z, len:120, angle:0.09 } };
  }
  drawLeadRoute(leadArrows, goal, arMat, opts, dt);

  // Löschen: sobald abgeworfenes Wasser (waterDrop läuft) über dem Feuer ist.
  // Kleine Verzögerung (fire.extT) simuliert das Fallen; an fire gebunden -> sauber pro Feuer.
  if(waterDrop && onTarget && fire.extT === undefined){
    fire.extT = fallT + 0.15;          // Wasser fällt ~Fallzeit bis zum Boden
  }
  if(fire.extT !== undefined){
    fire.extT -= dt;
    if(fire.extT <= 0){
      clearFire();                     // setzt fire=null -> nächstes Feuer startet frisch
      showThumb();
      fireRespawnT = 20 + Math.random()*10;
    }
  }
}

// ================= Gemeinsame Missions-Helfer (Transall & Airbus) =================
// Pfeilkette erzeugen/verstecken (generisch, mehrere Ketten möglich).
function makeArrowChain(n){
  const arr=[];
  for(let i=0;i<n;i++){
    const ar=new THREE.Mesh(new THREE.ConeGeometry(5,13,5), arrowMat);
    ar.renderOrder=998; ar.visible=false; scene.add(ar); arr.push(ar);
  }
  return arr;
}
// Auf welcher Insel-Zelle steht der Flieger gerade? (oder null)
function currentIslandCell(){
  const pcx=Math.round(state.pos.x/CELL), pcz=Math.round(state.pos.z/CELL);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const info=islandInfo(pcx+dx,pcz+dz);
    if(info && Math.hypot(state.pos.x-info.wx, state.pos.z-info.wz) < info.radius) return {cx:pcx+dx,cz:pcz+dz,info};
  }
  return null;
}
// Nächste Insel im 135°-Vorwärtskegel, die pred(info,cx,cz) erfüllt (2 Ringe weit).
function findIslandInCone(pred){
  const pcx=Math.round(state.pos.x/CELL), pcz=Math.round(state.pos.z/CELL);
  const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const fdx=fwd.x,fdz=fwd.z,flen=Math.hypot(fdx,fdz)||1;
  const COS_HALF=Math.cos(67.5*Math.PI/180);
  let best=null,bcx,bcz,bd=1e9;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
    const cx=pcx+dx,cz=pcz+dz; const info=islandInfo(cx,cz); if(!info) continue;
    if(!pred(info,cx,cz)) continue;
    const rx=info.wx-state.pos.x, rz=info.wz-state.pos.z, d=Math.hypot(rx,rz);
    if(d<60) continue;
    if((rx*fdx+rz*fdz)/(d*flen) < COS_HALF) continue;
    if(d<bd){ bd=d; best=info; bcx=cx; bcz=cz; }
  }
  return best ? {info:best,cx:bcx,cz:bcz,d:bd} : null;
}
// Nächste Insel überhaupt (kein Kegel), die pred erfüllt — Fallback fürs Landen.
function findNearestIsland(pred){
  const pcx=Math.round(state.pos.x/CELL), pcz=Math.round(state.pos.z/CELL);
  let best=null,bcx,bcz,bd=1e9;
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
    const cx=pcx+dx,cz=pcz+dz; const info=islandInfo(cx,cz); if(!info) continue;
    if(!pred(info,cx,cz)) continue;
    const d=Math.hypot(info.wx-state.pos.x, info.wz-state.pos.z);
    if(d<bd){ bd=d; best=info; bcx=cx; bcz=cz; }
  }
  return best ? {info:best,cx:bcx,cz:bcz,d:bd} : null;
}
// Weit entfernte Insel (>= minCells Zellen Abstand) im Vorwärtskegel — damit man wirklich
// ein Stück FLIEGEN muss, statt sofort auf der Nachbarinsel zu landen (Airbus).
function findDistantIsland(pred, minCells){
  const pcx=Math.round(state.pos.x/CELL), pcz=Math.round(state.pos.z/CELL);
  const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const fdx=fwd.x,fdz=fwd.z,flen=Math.hypot(fdx,fdz)||1;
  const COS_HALF=Math.cos(67.5*Math.PI/180);
  const R=minCells+4;                 // Suchradius in Zellen
  let best=null,bcx,bcz,bd=1e9;
  for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz)) < minCells) continue;   // Mindest-Zellabstand
    const cx=pcx+dx,cz=pcz+dz; const info=islandInfo(cx,cz); if(!info) continue;
    if(!pred(info,cx,cz)) continue;
    const rx=info.wx-state.pos.x, rz=info.wz-state.pos.z, d=Math.hypot(rx,rz);
    if((rx*fdx+rz*fdz)/(d*flen) < COS_HALF) continue;              // nur nach vorne
    if(d<bd){ bd=d; best=info; bcx=cx; bcz=cz; }
  }
  // kein Ziel vorne? egal wohin, Hauptsache weit genug (dann darf man wenden)
  if(!best){
    for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){
      if(Math.max(Math.abs(dx),Math.abs(dz)) < minCells) continue;
      const cx=pcx+dx,cz=pcz+dz; const info=islandInfo(cx,cz); if(!info) continue;
      if(!pred(info,cx,cz)) continue;
      const d=Math.hypot(info.wx-state.pos.x, info.wz-state.pos.z);
      if(d<bd){ bd=d; best=info; bcx=cx; bcz=cz; }
    }
  }
  return best ? {info:best,cx:bcx,cz:bcz,d:bd} : null;
}
// Gleitpfad-Parameter für die Landebahn einer Insel (Anflug entlang Z-Achse zur nahen Schwelle).
function runwayGlide(info){
  const rwLen = Math.min(260, info.radius*1.4);
  const half = rwLen/2;
  const nearSign = (state.pos.z >= info.wz) ? 1 : -1;   // Schwelle auf der dem Flieger zugewandten Seite
  const tz = info.wz + nearSign*half;
  return { tx:info.wx, ty:ISLAND_Y+2, tz:tz, dirX:0, dirZ:-nearSign, len:220, angle:0.10 };
}

// ================= Transall: Fracht über kleine Insel abwerfen =================
const cargoRingMat = new THREE.MeshBasicMaterial({ color:0xffcc33, side:THREE.DoubleSide, transparent:true, opacity:0.9 });
let cargoTarget=null;   // {x,z,r,group,cx,cz,delivered}
let cargoArrows=[];
let cargoRespawnT=-1;
function makeCargoMarker(x,z,r){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.RingGeometry(r*0.75, r, 40), cargoRingMat);
  ring.rotation.x=-Math.PI/2; ring.position.set(0,0.6,0); g.add(ring);
  // Kleiner Zielmast in der Mitte (sichtbar von oben)
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,26,10), cargoRingMat);
  pole.position.set(0,13,0); g.add(pole);
  g.position.set(x, ISLAND_Y+0.3, z); scene.add(g); return g;
}
function clearCargoTarget(){
  if(cargoTarget){ if(cargoTarget.group) scene.remove(cargoTarget.group); cargoTarget=null; }
  for(const a of cargoArrows) a.visible=false;
}
function spawnCargoTarget(){
  clearCargoTarget();
  const cur = currentIslandCell();
  // nur KLEINE Inseln (radius<230), keine Städte (cellRnd,99>=0.10), nicht die aktuelle Insel
  const pred=(info,cx,cz)=> info.radius<230 && cellRnd(cx,cz,99)>=0.10 && !(cur&&cx===cur.cx&&cz===cur.cz);
  const hit = findIslandInCone(pred) || findNearestIsland(pred);
  if(!hit) return false;
  const r = Math.min(90, hit.info.radius*0.55);
  if(!cargoArrows.length) cargoArrows = makeArrowChain(14);
  cargoTarget={ x:hit.info.wx, z:hit.info.wz, r, cx:hit.cx, cz:hit.cz, group:makeCargoMarker(hit.info.wx,hit.info.wz,r), delivered:0 };
  return true;
}
// AUSGEBAUT: die Transall hat kein vorgegebenes Abwurfziel mehr (kein Ring, kein Zielmast, kein 👍).
// Laden auf der Bahn und Abwerfen mit B laufen unveraendert in updateCrates() — man wirft die Kisten
// dort ab, wo man mag. Die Zielsuche unten bleibt als toter Code stehen, damit man sie wiederbeleben
// koennte; aufgerufen wird sie nicht mehr.
function updateTransallMission(dt){
  clearCargoTarget(); cargoRespawnT=-1; return;
  // ---- ab hier unerreichbar (frueheres Frachtziel-Minispiel) ----
  if(!cargoTarget){
    if(cargoRespawnT<0){ spawnCargoTarget(); return; }
    cargoRespawnT-=dt; if(cargoRespawnT<=0){ if(!spawnCargoTarget()) cargoRespawnT=2; }
    return;
  }
  // Erfolg: mind. eine Kiste ist auf der Zielinsel gelandet und alle abgeworfen.
  if(cargoTarget.delivered>0 && crateQueue<=0){
    showThumb(); clearCargoTarget(); cargoRespawnT=20+Math.random()*10; return;
  }
  // Zielmarker sanft pulsieren
  const puls=0.9+0.1*Math.sin(arrowPhase*Math.PI*6);
  if(cargoTarget.group) cargoTarget.group.children[0].scale.set(puls,puls,puls);

  // Ballistik: wo landet die Kiste, wenn ich JETZT werfe?
  const alt=Math.max(0,state.pos.y-ISLAND_Y);
  const fallT=Math.sqrt(2*alt/9.81);
  const impactX=state.pos.x+state.vel.x*fallT, impactZ=state.pos.z+state.vel.z*fallT;
  const impactDist=Math.hypot(cargoTarget.x-impactX, cargoTarget.z-impactZ);
  const loaded = crateLoad>0;
  const aimOk = loaded && alt<160 && impactDist < cargoTarget.r;
  const arMat = aimOk?arrowMatOk:(loaded?arrowMatMid:arrowMat);

  let goal, opts;
  if(loaded){
    // beladen -> gelbe weiche Route direkt zum Abwurfziel (Überflughöhe)
    goal={x:cargoTarget.x, z:cargoTarget.z, y:ISLAND_Y+30}; opts={lowRoute:false};
  } else {
    // leer -> rote Route sanft runter über eine Landebahn (andere Insel) zum Beladen
    const cur=currentIslandCell();
    const pred=(info,cx,cz)=> !(cx===cargoTarget.cx&&cz===cargoTarget.cz) && !(cur&&cx===cur.cx&&cz===cur.cz);
    const rw = findIslandInCone(pred) || findNearestIsland(pred);
    if(rw){ goal={x:rw.info.wx, z:rw.info.wz, y:ISLAND_Y+2}; opts={lowRoute:true, glideTo:runwayGlide(rw.info)}; }
    else { goal={x:cargoTarget.x, z:cargoTarget.z, y:ISLAND_Y+30}; opts={lowRoute:true}; }
  }
  drawLeadRoute(cargoArrows, goal, arMat, opts, dt);
}

// ================= Airbus: Menschen zwischen Landebahnen transportieren =================
// Prinzip GENAU wie Transall-Kisten: auf einer Bahn STEHEN lädt graduell 4 Menschen ein (2 s = 4).
// Ist der Airbus voll und steht auf der ZIEL-Bahn, steigen sie aus -> 👍, neues Ziel.
const PAX_MAX = 4;          // max. Passagiere
const PAX_LOAD_TIME = 2;    // Sekunden Stehen für volle Ladung (4 Menschen)
let paxLoad = 0;            // eingestiegene Menschen (0..4)
let paxLoadT = 0;           // Ladefortschritt (Sekunden gestanden)
let paxTarget=null;         // {info,cx,cz,x,z}
let paxArrows=[];
let paxRespawnT=-1;
function clearPaxTarget(){ paxTarget=null; for(const a of paxArrows) a.visible=false; }
function spawnPaxTarget(){
  clearPaxTarget();
  const cur=currentIslandCell();
  const pred=(info,cx,cz)=> !(cur&&cx===cur.cx&&cz===cur.cz);   // irgendeine andere Insel (jede hat Bahn)
  // MIND. 5 Inseln/Zellen Abstand -> man muss ein Stück fliegen, nicht gleich nebenan landen.
  const hit = findDistantIsland(pred, 5);
  if(!hit) return false;
  if(!paxArrows.length) paxArrows = makeArrowChain(14);
  paxTarget={ info:hit.info, cx:hit.cx, cz:hit.cz, x:hit.info.wx, z:hit.info.wz };
  return true;
}
// "Steht der Airbus?" = am Boden (egal ob Insel, Stadt, Bahn oder Trägerdeck) und ~stillstehend.
// v wird nie ganz 0 -> Schwelle 3 km/h. Ein-/Aussteigen passiert bei JEDER Landung.
function airbusStanding(){
  return state.onGround && state.vel.length()*3.6 < 3;
}
// Mission = NUR Navigation + Erfolg (👍). Das Ein-/Aussteigen selbst passiert IMMER beim Landen
// (in updatePax), egal ob das Minispiel an ist. Hier nur: Ziel anzeigen, bei Ankunft am Ziel loben.
// AUSGEBAUT: kein vorgegebenes Ziel und kein 👍 mehr. Das Ein- und Aussteigen selbst laeuft
// unveraendert in updatePax() — bei JEDER Landung, auf jeder Bahn. Man fliegt die Leute also
// weiterhin von A nach B, sucht sich B aber selbst aus. Zielsuche bleibt als toter Code erhalten.
function updateAirbusMission(dt){
  clearPaxTarget(); paxRespawnT=-1; return;
  // ---- ab hier unerreichbar (frueheres Passagier-Minispiel) ----
  if(!paxTarget){
    if(paxRespawnT<0){ spawnPaxTarget(); return; }
    paxRespawnT-=dt; if(paxRespawnT<=0){ if(!spawnPaxTarget()) paxRespawnT=2; }
    return;
  }
  const onTargetRunway = airbusStanding() &&
        Math.hypot(state.pos.x-paxTarget.x, state.pos.z-paxTarget.z) < paxTarget.info.radius;
  const arMat = (paxLoad>=PAX_MAX) ? arrowMatMid : arrowMat;   // voll = gelb (zum Ziel), sonst rot
  const arMatOk = onTargetRunway ? arrowMatOk : arMat;         // am Ziel grün
  drawLeadRoute(paxArrows, {x:paxTarget.x, z:paxTarget.z, y:ISLAND_Y+2}, arMatOk,
                { lowRoute:true, glideTo:runwayGlide(paxTarget.info) }, dt);
  // Erfolg: VOLL am Ziel gelandet (paxLoad wird gleich in updatePax beim Aussteigen geleert).
  if(onTargetRunway && paxLoad>=PAX_MAX){
    showThumb(); clearPaxTarget(); paxRespawnT=0.1;
  }
}
// ---- Echte kleine Figuren, die seitlich ein-/aussteigen (im 0,3-s-Takt wie die Pakete) ----
// Figur = dieselbe Bauart wie der Fallschirm-Pilot (Körper-Zylinder + Kugelkopf), aber winzig.
const activePax = [];       // laufende Figuren {group, phase:'out'|'in', t, sx,sz, dx,dz}
let paxBoardQueue = 0, paxBoardTimer = 0;   // Einsteige-Warteschlange (Figur läuft rein)
let paxDropQueue  = 0, paxDropTimer  = 0;   // Aussteige-Warteschlange (Figur läuft raus)
let paxDropping = false;    // Aussteige-Sequenz am Ziel aktiv
let lastPaxLoad = 0;        // um Zuwächse beim Einsteigen zu erkennen
function makePerson(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.28,1.4,8), pilotMat);
  body.position.y = 0.7; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.38,10,8), pilotMat);
  head.position.y = 1.6; g.add(head);
  return g;
}
// Seiten-Punkt am Airbus (Tür) in Weltkoordinaten: rechts quer zur Nase, knapp über Boden.
function airbusDoorSide(sign){
  const right = new THREE.Vector3(1,0,0).applyQuaternion(state.quat);
  const gy = (isOnLand(state.pos.x,state.pos.z)?ISLAND_Y:0);
  return { x: state.pos.x + right.x*3*sign, z: state.pos.z + right.z*3*sign, y: gy,
           rx: right.x*sign, rz: right.z*sign };
}
function spawnPaxFigure(phase){
  const d = airbusDoorSide(1);
  const g = makePerson();
  const away = 14;  // wie weit seitlich sie laufen
  if(phase==='out'){ // erscheint an der Tür, läuft seitlich weg
    g.position.set(d.x, d.y, d.z);
    activePax.push({ group:g, phase:'out', t:0, x:d.x, z:d.z, dx:d.rx, dz:d.rz, away });
  } else {           // erscheint seitlich draußen, läuft zur Tür (dann verschwindet sie = eingestiegen)
    g.position.set(d.x + d.rx*away, d.y, d.z + d.rz*away);
    activePax.push({ group:g, phase:'in', t:0, x:d.x, z:d.z, dx:d.rx, dz:d.rz, away });
  }
  scene.add(g);
}
// Ein-/Aussteigen passiert bei JEDER Landung (Insel/Stadt/Bahn/Träger), unabhängig vom Minispiel:
// 1) beim Aufsetzen zuerst alle an Bord AUSsteigen (Figuren laufen raus), 2) dann bis voll EINsteigen.
// paxServiced verhindert Wiederholung, solange er steht; beim Abheben Reset für die nächste Landung.
let paxServiced = false;    // an diesem Standplatz schon aus-/eingestiegen?
function updatePax(dt){
  const standing = isAirbus() && airbusStanding();
  if(standing){
    // frisch angehalten und noch nicht bedient -> ggf. Aussteige-Sequenz starten
    if(!paxServiced && !paxDropping && paxBoardQueue<=0 && activePax.length===0){
      if(paxLoad > 0){ paxDropping = true; paxDropQueue = paxLoad; paxDropTimer = 0; }  // erst raus
      else { paxServiced = false; }   // niemand an Bord -> direkt einsteigen (unten)
    }
    // Einsteigen: wenn nicht (mehr) am Aussteigen und noch nicht voll
    if(!paxDropping && paxLoad < PAX_MAX){
      paxLoadT += dt;
      const nv = Math.min(PAX_MAX, Math.floor(paxLoadT / (PAX_LOAD_TIME/PAX_MAX)));
      if(nv > lastPaxLoad){ for(let i=0;i<nv-lastPaxLoad;i++) paxBoardQueue++; }  // je +1 = Figur rein
      paxLoad = nv; lastPaxLoad = nv;
      if(paxLoad >= PAX_MAX) paxServiced = true;    // voll -> Bedienung an diesem Stopp fertig
    }
  } else {
    // abgehoben/rollt schnell -> Zustand für die nächste Landung zurücksetzen
    paxServiced = false; paxLoadT = paxLoad * (PAX_LOAD_TIME/PAX_MAX); lastPaxLoad = paxLoad;
  }
  // Einsteige-Figuren im 0,3-s-Takt loslaufen lassen
  if(paxBoardQueue > 0){ paxBoardTimer -= dt;
    if(paxBoardTimer <= 0){ spawnPaxFigure('in'); paxBoardQueue--; paxBoardTimer = 0.3; } }
  // Aussteige-Sequenz: Figuren im 0,3-s-Takt raus; danach ist ausgestiegen -> Einsteigen beginnt.
  if(paxDropping){
    paxDropTimer -= dt;
    if(paxDropQueue > 0 && paxDropTimer <= 0){ spawnPaxFigure('out'); paxDropQueue--; paxDropTimer = 0.3; }
    if(paxDropQueue <= 0 && activePax.length === 0){
      paxDropping = false; paxLoad = 0; paxLoadT = 0; lastPaxLoad = 0;   // alle raus -> jetzt neu einladen
    }
  }
  // Figuren animieren (laufen seitlich, ~4 s, dann weg)
  for(let i=activePax.length-1;i>=0;i--){
    const pfg = activePax[i]; pfg.t += dt;
    const f = Math.min(1, pfg.t/1.5);               // 1,5 s Laufweg
    const dist = pfg.phase==='out' ? f*pfg.away : (1-f)*pfg.away;
    pfg.group.position.set(pfg.x + pfg.dx*dist, pfg.group.position.y, pfg.z + pfg.dz*dist);
    pfg.group.rotation.y = Math.atan2(pfg.dx*(pfg.phase==='out'?1:-1), pfg.dz*(pfg.phase==='out'?1:-1));
    if(pfg.t > 1.6){ scene.remove(pfg.group); activePax.splice(i,1); }
  }
}

// Höhen-Schatten: sichtbar ab <=20 m. Folgt X/Z, dreht mit dem Kurs mit,
// wird mit sinkender Höhe kleiner+dunkler (nah am Flieger = klein/scharf).
const SHADOW_MAXALT = 20;
// Der ovale Schatten fuer Boote und den Astronauten. Getrennt von updateShadow, weil die Bezugsgroessen
// andere sind: nicht state.pos und der Flugzeugkurs, sondern die Position des Boots bzw. der Figur.
// Beim Astronauten ist die Hoehe interessant (er huepft, auf dem Mond sechsmal so hoch) — der
// Schatten bleibt am BODEN stehen und waechst, dadurch sieht man die Sprunghoehe erst richtig.
function updateOvalShadow(){
  let px, pz, alt, yawS, rx, rz;
  // Die Halbmasse liegen rund 15 % ueber den echten Umrissen: ein Schatten ist nie so scharf wie das
  // Objekt, und knapp zu klein sah aus, als schwebte das Fahrzeug. Auf Wunsch etwas groesser gemacht.
  if(eva && eva.boat){                       // im Schlauchboot: Umriss des Boots
    px = eva.boat.position.x; pz = eva.boat.position.z; alt = 0;
    yawS = eva.yaw; rx = DINGHY_LEN*0.35; rz = DINGHY_LEN*0.60;
  } else if(eva){                            // zu Fuss: rund, klein
    px = eva.group.position.x; pz = eva.group.position.z;
    alt = Math.max(0, eva.group.position.y - evaFootY(px, pz));
    yawS = eva.yaw; rx = 0.9; rz = 0.9;
  } else if(isSub()){                        // U-Boot: 95 m langer Rumpf
    px = state.pos.x; pz = state.pos.z; alt = 0;
    const f = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
    yawS = Math.atan2(f.x, f.z) + Math.PI; rx = 7.5; rz = 50;
  } else {                                   // Feuerwehrboot: 16 m langer Rumpf
    px = state.pos.x; pz = state.pos.z; alt = 0;
    const f = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
    yawS = Math.atan2(f.x, f.z) + Math.PI; rx = 3.0; rz = 9.2;
  }
  if(alt > SHADOW_MAXALT){ ovalShadow.visible = false; return; }
  const onLand = isOnLand(px, pz), onCar = isOnCarrier(px, pz);
  // Auflagehoehe. Ueber Wasser die WELLENHOEHE AN DIESER STELLE — nicht ein fester Wert.
  // Mit den festen 1,4 m lag der Schatten bis zu 5,59 m ueber dem Boot (gemessen), und weil er mit
  // depthTest:false immer davor gezeichnet wird, erschien diese Hoehendifferenz als VERSATZ, der
  // sich mit dem Kamerawinkel aendert: "der Schatten wandert selbstaendig, und von der Seite
  // wandert er anders". Auf der Wellenhoehe liegt er wirklich unter dem Boot.
  // Auflagehoehe. An Land und auf dem Traegerdeck ist sie flach, ueber Wasser wandert sie mit der
  // Duenung. Der Schatten liegt dann auf dem HOECHSTEN Wellenpunkt unter seiner Flaeche, nicht auf
  // dem an seiner Mitte: er ist eine waagerechte Scheibe, und die Wasserflaeche darunter ist
  // geneigt — auf den Mittelwert gelegt tauchte der Rand ein (gemessen bis 0,47 m) und wurde mit
  // depthTest:true abgeschnitten, was flackert.
  // Die Scheibe zu NEIGEN waere eleganter, war aber messbar schlechter: mit meiner Euler-Rechnung
  // tauchten 45,5 % der Randpunkte ein statt 28 %, und die Laengsachse stand bei 90 Grad Kurs um
  // 88 Grad verdreht (C:/tmp/v18.js). Verworfen — die Reihenfolge ZYX mischt die Winkel anders, als
  // es aussieht. Der Umweg ueber das Maximum kostet nur die paar Zentimeter Anstieg und ist sicher.
  let surf;
  // Ausserhalb der Erdwelt (Hangar, Mond, Mars) liefert surfaceY die Bodenhoehe direkt — dort gibt es
  // kein Wasser, keinen Strand und keinen Traeger. Damit hat auch der Astronaut zu Fuss auf dem Mond
  // und im Hangar einen Schatten, so wie in der Inselwelt.
  if(locale !== 'earth') surf = surfaceY(px, pz);
  else if(onCar) surf = fordDeckY;
  // Der SANDRAND zaehlt als Land: er ist gezeichnet (buildIsland bis radius*1.12) und traegt den
  // Astronauten (siehe evaFootY). Vorher fragte hier nur isOnLand, also fiel der Schatten am Strand
  // in den Wasser-Zweig und lag auf Wellenhoehe statt auf dem Sand — gemeldet als „der astronaut hat
  // keinen schatten auf dem strand, im wasser aber schon". Er war nicht weg, er lag ueber ihm.
  // Nie unter der Wasserlinie, wie beim Astronauten selbst: am nassen Saum steigt die Duenung.
  else if(onLand) surf = ISLAND_Y;
  else if(isOnBeach(px, pz)) surf = Math.max(ISLAND_Y, seaYAt(px, pz));
  else {
    // Acht Punkte auf dem Rand plus die Mitte — mehr braucht es nicht, die Welle ist ueber wenige
    // Meter praktisch linear (Wellenlaenge ab 250 m, siehe AMP).
    surf = seaYAt(px, pz);
    const r = Math.max(rx, rz);
    for(let a = 0; a < 6.283; a += Math.PI/4){
      const s2 = seaYAt(px + Math.sin(a)*r, pz + Math.cos(a)*r);
      if(s2 > surf) surf = s2;
    }
  }
  ovalShadow.visible = true;
  ovalShadow.position.set(px, surf + 0.08, pz);
  // Nach rotation.x = -PI/2 dreht rotation.z IN der Bodenebene, und zwar mit +yaw. Vorzeichen und
  // Achse mit echtem three.js nachgemessen (C:/tmp/rot.js) — mit -yaw stand das Boot quer zur Fahrt.
  ovalShadow.rotation.z = yawS;
  const f = alt / SHADOW_MAXALT;             // 0 (am Boden) .. 1 (20 m hoch)
  const grow = 1 + f*0.8;
  // Die LOKALE Y-Achse ist nach der X-Drehung die Laengsrichtung am Boden -> lang auf scale.y.
  ovalShadow.scale.set(rx*grow, rz*grow, 1);
  ovalShadowMat.opacity = 0.18 + 0.22*(1-f);
}
function updateShadow(){
  // Im WELTALL gibt es keinen Boden, auf den ein Schatten fallen koennte -> aus. Ueberall sonst gibt
  // es einen: die Inselwelt, der Hangarboden, Mond und Mars. Vorher war der Schatten ausserhalb der
  // Erde ganz abgeschaltet ("auf dem Mond keine Insel-Referenzhoehe"), was nur fuer die alte
  // Rechnung mit ISLAND_Y stimmte — surfaceY kennt inzwischen jeden Ort: hangarFloorY in der Halle,
  // das Hoehenraster samt exaktem Raycast auf Mond und Mars, und die Flaeche der Mondbasis.
  if(locale === 'space'){
    if(planeShadow) planeShadow.visible = false;
    if(ovalShadow) ovalShadow.visible = false;
    return;
  }
  // Boote und der Astronaut bekommen den OVALEN Schatten (der Flugzeug-Umriss passt dort nicht) —
  // vorher hatten sie gar keinen. Er macht sichtbar, wo man auf dem Wasser steht, und laesst den
  // Astronauten beim Huepfen nicht mehr schwerelos wirken.
  if(isWaterCraft() || eva){
    planeShadow.visible = false;
    updateOvalShadow();
    return;
  }
  ovalShadow.visible = false;
  // Oberflaeche: ueber Land (samt Sandrand) die Inselhoehe, ueber Wasser die WELLENHOEHE AN DIESER
  // STELLE — nicht der feste Wert 1,4 m, der hier stand. Genau derselbe Fehler, der beim Feuerwehrboot
  // schon behoben wurde (siehe updateOvalShadow): eine Hoehendifferenz zur echten Wasserflaeche
  // erscheint als VERSATZ, der sich mit dem Kamerawinkel aendert — „der schatten der canadair bewegt
  // sich im wasser alleine". (Damals kam dazu, dass der Schatten mit depthTest:false immer davor
  // gezeichnet wurde; auch das ist inzwischen behoben, siehe shadowMat.)
  // Der Sandrand zaehlt als Land, sonst springt der Schatten am Ufer (dort ist der Boden bei 0,30 m).
  // Das TRÄGERDECK zaehlt als eigene Oberflaeche — der ovale Schatten (Boote, Astronaut) kennt das
  // laengst ueber onCar, hier fehlte es. Ueber dem Traeger rechnete der Flieger-Schatten also mit
  // Wasserhoehe 0 und lag im Wasser statt auf dem Deck.
  //
  // Aufgefallen ist das erst jetzt, und der Hinweis darauf war goldwert: solange das Deck 23,4 m ueber
  // Wasser lag, war der Schatten dort ohnehin AUS (SHADOW_MAXALT ist 20 m, gerechnet ab Wasser). Seit
  // der Traeger eintaucht, liegt das Deck bei 14,6 m — unter der Grenze, und der Fehler wurde sichtbar:
  // „man sieht den schatten auf dem wasser durch den carrier hindurch".
  // Ausserhalb der Erdwelt gibt es kein Wasser und keinen Traeger: dort liefert surfaceY die
  // Bodenhoehe direkt (Hangarboden, Hoehenraster von Mond und Mars samt Mondbasis-Flaeche).
  const erde = (locale === 'earth');
  const onCar = erde && isOnCarrier(state.pos.x, state.pos.z);
  const overLand = erde && (isOnLand(state.pos.x, state.pos.z) || isOnBeach(state.pos.x, state.pos.z));
  const seaHere = (!erde || onCar || overLand) ? 0 : seaYAt(state.pos.x, state.pos.z);
  const surfY = !erde ? surfaceY(state.pos.x, state.pos.z)
              : (onCar ? fordDeckY : (overLand ? ISLAND_Y : seaHere));
  // Gerechnet wird mit der ANGEZEIGTEN Hoehe (planeCamRef), nicht mit state.pos.y. Beim schwimmenden
  // Canadair fallen die beiden auseinander: dessen state.pos.y bleibt auf der Nulllinie, waehrend
  // planeGroup.position.y mit der Welle wandert (siehe floatCanadair). Der Schatten rechnete damit
  // alt = 0 - Wellenhoehe, wurde auf jedem Wellenberg negativ und schaltete sich ab — bei AMP = 3,0
  // also etwa die Haelfte der Zeit. Genau das war „wenn die canadair auf dem wasser schwimmt oder
  // faehrt verschwindet der schatten ab und zu und kommt dann wieder". Die Kamera loest dasselbe
  // Problem seit laengerem ueber planeCamRef.
  const refY = planeCamRef().y;
  const alt = refY - surfY;                   // echte Höhe über der jeweiligen Oberfläche
  // Die untere Grenze mit Toleranz: schwimmend liegt der Rumpf um CANADAIR_DRAFT unter der
  // Wasserlinie, alt ist dort also leicht negativ, ohne dass etwas falsch waere. Ohne die Toleranz
  // blinkte der Schatten weiter, nur seltener.
  if(alt > SHADOW_MAXALT || alt < -2){ planeShadow.visible = false; return; }
  planeShadow.visible = true;
  // Der Schatten ist eine waagerechte Flaeche, die Wasseroberflaeche darunter ist geneigt: auf den
  // Mittelwert gelegt taucht der Rand ein. Deshalb der HOECHSTE Wellenpunkt unter seiner Flaeche —
  // dieselbe Ueberlegung wie beim ovalen Schatten, dort mit acht Randpunkten nachgemessen.
  // 5,5 m ist die halbe Spannweite des Umrisses (shWing.scale.x), das groesste Mass des Schattens.
  // Nur ueber offenem Wasser die Wellen abtasten: an Land und auf dem TRAEGERDECK ist die Flaeche
  // eben, und ein seaYAt in der Naehe des Traegers wuerde den Schatten vom Deck ins Wasser ziehen.
  let shadowY = surfY + 0.15;
  if(erde && !overLand && !onCar){
    for(let a = 0; a < 6.283; a += Math.PI/4){
      const s2 = seaYAt(state.pos.x + Math.sin(a)*5.5, state.pos.z + Math.cos(a)*5.5);
      if(s2 + 0.15 > shadowY) shadowY = s2 + 0.15;
    }
  }
  planeShadow.position.set(state.pos.x, shadowY, state.pos.z);
  // Kurs (Gierwinkel) übernehmen, damit der Umriss in Flugrichtung zeigt
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  planeShadow.rotation.y = Math.atan2(fwd.x, fwd.z) + Math.PI;
  // je höher, desto größer & blasser (Schatten "wächst" beim Steigen)
  // Auf 0..1 geklemmt: schwimmend darf alt leicht negativ sein (der Rumpf liegt um CANADAIR_DRAFT
  // unter der Wasserlinie), und ohne Klemme wuerde der Schatten dort schrumpfen und dunkler werden
  // als vorgesehen — die Deckkraft ginge ueber ihren Sollwert hinaus.
  const f = Math.max(0, Math.min(1, alt / SHADOW_MAXALT));   // 0 (am Boden) .. 1 (20 m)
  const scale = 1 + f * 0.8;
  planeShadow.scale.set(scale, 1, scale);
  // nah = dunkel, hoch = blasser, aber Mindest-Deckkraft, damit er auf Wasser sichtbar bleibt
  shadowMat.opacity = 0.18 + 0.22 * (1 - f);
}

// ---------- Schleudersitz + Fallschirm (nur AlphaJet) ----------
const chuteMat = new THREE.MeshLambertMaterial({ color:0xff5522, side:THREE.DoubleSide });
const pilotMat = new THREE.MeshLambertMaterial({ color:0x223355 });
let parachute = null;   // {group, vy}
function makeParachute(){
  // Astronaut am Fallschirm: die Figur hängt unter dem Schirm, beide aus echten Modellen
  // (früher ein Halbkugel-Schirm mit Zylinder-Pilot). Der Ursprung der Gruppe liegt bei den
  // FÜSSEN des Astronauten — so kann der Aufsetzpunkt direkt auf die Bodenhöhe gesetzt werden.
  const g = new THREE.Group();
  const man = makeAstronaut();
  g.add(man);
  if(chute2Template){
    const pc = chute2Template.clone(true);
    // Der Schirm sitzt direkt über dem Kopf. Das Modell BRINGT SEINE LEINEN MIT (die vielen dünnen),
    // sie laufen an seiner Unterkante zusammen — deshalb wird dort angesetzt, wo die Figur hängt.
    // Früher standen hier zusätzlich vier eigene, dicke Leinen: die endeten frei in der Luft, weil
    // sie zu den Schultern zeigten, während die Modell-Leinen ihren eigenen Punkt haben.
    pc.position.y = ASTRONAUT_H * 0.9;
    g.add(pc);
  } else {
    // GLB noch nicht geladen -> einfacher Ersatzschirm, damit der Pilot nie nackt fällt
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.5, 18, 10, 0, Math.PI*2, 0, Math.PI/2), chuteMat);
    canopy.position.y = ASTRONAUT_H + 3; g.add(canopy);
  }
  return g;
}
// Wasserlandung eines Fallschirmspringers: er wird auf einem Schlauchboot gerettet, und der SCHIRM
// IST DANN WEG — im Wasser wird er als erstes abgeworfen, und ein Schirm ueber einem Boot sah aus,
// als haenge der Springer noch in der Luft. Gilt fuer den Spieler genauso wie fuer KI und Vorbeiflug.
// Erwartet ein Objekt {group, vy, ...}; setzt group auf den Innenboden des Boots und merkt es in
// .boat, damit es mitschwimmt und beim Aufraeumen wieder verschwindet.
// Rueckgabe: true, sobald der Springer im Boot steht (dann ist nichts mehr zu tun).
function chuteSeaRescue(ch, dt){
  if(ch.boat){
    // Gerettet: Boot auf der Duenung, Figur auf dem Innenboden. Es treibt langsam mit den Wellen —
    // gefahren wird es nicht (das kann nur der Spieler zu Fuss, siehe updateDinghy).
    ch.boat.position.y = seaYAt(ch.boat.position.x, ch.boat.position.z, dt) - DINGHY_DRAFT;
    ch.group.position.set(ch.boat.position.x,
                          ch.boat.position.y + (ch.boat.userData.floorY || 0),
                          ch.boat.position.z);
    return true;
  }
  const x = ch.group.position.x, z = ch.group.position.z;
  if(!isOpenWater(x, z)) return false;                 // kein Wasser -> normal weiter
  const wl = seaYAt(x, z, dt) - DINGHY_DRAFT + (dinghyFloorY || 0);
  if(ch.group.position.y > wl) return false;           // noch in der Luft
  const b = makeDinghy();
  b.position.set(x, seaYAt(x, z, dt) - DINGHY_DRAFT, z);
  b.rotation.y = Math.random()*Math.PI*2;              // beliebig ausgerichtet, es treibt ja nur
  scene.add(b);
  ch.boat = b;
  // Schirm weg: alles ausser dem Astronauten selbst aus der Gruppe nehmen. Der Astronaut ist das
  // ERSTE Kind (siehe makeParachute), der Schirm kommt danach — so bleibt die Figur stehen, ohne
  // dass hier ein Modellname geraten werden muesste.
  while(ch.group.children.length > 1) ch.group.remove(ch.group.children[ch.group.children.length-1]);
  ch.group.position.set(b.position.x, b.position.y + (b.userData.floorY || 0), b.position.z);
  ch.group.rotation.set(0, 0, 0);                      // Pendeln beenden — er steht jetzt
  return true;
}
// Ein gerettetes Boot mit abraeumen (wird ueberall dort aufgerufen, wo der Fallschirm entfernt wird).
function clearChuteBoat(ch){ if(ch && ch.boat){ scene.remove(ch.boat); ch.boat = null; } }
function ejectSeat(){
  if((!isAlphaJet() && !isMustang()) || state.onGround || state.ejected || state.crashed) return;
  state.ejected = true;
  // Fallschirm mit Pilot an aktueller Position, sinkt gemächlich
  parachute = { group: makeParachute(), vy: -9 };
  parachute.group.position.copy(state.pos);
  scene.add(parachute.group);
  // Flieger wird führerlos: kippt in einen Sturzflug (kein Schub mehr, trudelt)
  state.throttle = 0;
}
function updateParachute(dt){
  if(!parachute) return;
  // Ueber Wasser: auf dem Schlauchboot gerettet (Schirm weg). Steht das schon, ist hier Schluss —
  // das Boot treibt mit den Wellen, Sinken und Pendeln gibt es nicht mehr.
  if(chuteSeaRescue(parachute, dt)) return;
  // sanft sinken + leichtes Pendeln
  parachute.group.position.y += parachute.vy * dt;
  parachute.group.position.x += Math.sin(parachute.group.position.y*0.1) * 2 * dt;
  parachute.group.rotation.z = Math.sin(parachute.group.position.y*0.2) * 0.15;
  // Landefläche ortsabhängig: Trägerdeck > Insel > Wasser. Der Pilot landet OBEN DRAUF,
  // fällt nicht durch Carrier/Hafen hindurch.
  const px = parachute.group.position.x, pz = parachute.group.position.z;
  const surfY = isOnCarrier(px, pz) ? fordDeckY : (isOnLand(px, pz) ? ISLAND_Y : 0);
  // Der Ursprung der Gruppe liegt an den FÜSSEN des Astronauten (siehe makeParachute), er steht
  // also direkt auf der Fläche — vorher lag dort die Körpermitte und der Pilot schwebte 1 m hoch.
  if(parachute.group.position.y <= surfY){
    parachute.group.position.y = surfY;          // gelandet -> bleibt stehen
  }
}
function clearParachute(){
  if(parachute){ clearChuteBoat(parachute); scene.remove(parachute.group); parachute = null; }
}

// ================= Aussteigen und herumlaufen (EVA) =================
// Nach der Landung steigt man mit B aus und läuft als Astronaut umher: linker Stick / Pfeiltasten
// bewegen, B hüpft. Die Sprunghöhe hängt an der Anziehungskraft des Ortes — auf dem Mond (1,62 m/s²)
// kommt man rund sechsmal so hoch wie auf der Erde (9,81), auf dem Mars (3,71) etwa 2,6-mal.
// Genau das macht den Reiz aus, deshalb wird die Sprungkraft NICHT pro Ort ausgeglichen: es ist
// überall derselbe Absprung, nur die Schwerkraft bremst unterschiedlich.
// Das Flugzeug bleibt stehen, wo es steht. Kommt man ihm nahe, wird B zum Einsteigen (evaCanBoard).
// ---- Rover (Mond und Mars) ----
// Beide fahren gleich: 100 km/h Spitze, wie gewuenscht. Das ist viel fuer ein Mondauto (der echte
// Apollo-LRV machte 13 km/h), aber die Landschaften sind riesig — mit 13 km/h kaeme man nirgends hin.
const ROVER_VMAX  = 27.78;   // m/s = 100 km/h
const ROVER_ACCEL = 7;       // m/s^2 — zieht zuegig an, ohne zu schleudern
const ROVER_YAW   = 1.1;     // Lenkgeschwindigkeit (rad/s)
const ROVER_BOARD_R = 12;    // so nah muss man ihm sein, um einzusteigen
// Sitzhoehe: NICHT pauschal, sondern aus dem Modell. Im Browser ausgemessen ist der Perseverance
// 5,45 m hoch (er wird auf 10 m Laenge gestreckt, damit man ihn in der weiten Landschaft findet),
// der Apollo Lunar Rover 1,77 m. Mit einem festen Wert von 1,1 m sass der Astronaut also IM
// Perseverance, und die Kamera - die 5,1 m ueber ihm sitzt - steckte in dessen Dach: genau das
// gemeldete "die Kamera geht unter den Rover". Beim Mondrover fiel es nicht auf, weil 1,1 m dort
// zufaellig passte. Der Ursprung liegt bei beiden Modellen am Boden (minY = 0,00 gemessen), also
// ist die Oberkante direkt die Sitzhoehe.
function roverSeatY(loc){
  return (loc === 'mars') ? 5.45 : 1.77;
}
// ---- Jetpack (Weltall, ausserhalb des Hangars) ----
// Der dritte Sub-Modus neben eva.boat und eva.rover, nach genau demselben Muster: eigene Physik
// (updateJet), eigener Kamerafaktor, eigene HUD-Anzeige, eigener Eingabezweig. Er faengt den
// Schritt ueber die Hangarkante auf, so wie das Schlauchboot den Schritt ins Wasser auffaengt.
// Steuerung wie beim X-Wing, wie gewuenscht: der SCHUB (rechter Stick, W/S, Leertaste) ist das
// Gas, der linke Stick dreht (<->) und nickt (hoch/runter), und geflogen wird in Blickrichtung.
// Anders als der Flieger hat er keine Traegheitsachse quer dazu — ein Jetpack driftet nicht, es
// schiebt dorthin, wohin der Astronaut schaut. Das ist fuer ein Kind die einfachere Regel.
// Tempo an einem Ort MIT BODEN (Erde, Mond, Mars, Hangar): dort will man herumfliegen und schauen,
// nicht rasen — 45 m/s sind 162 km/h und damit schon zuegig.
const JET_VMAX   = 45;
// Im WELTALL gilt JET_VMAX NICHT: dort rechnet updateJet mit SPACE_C * warpFactor(), genau wie der
// Flieger. Mit 45 m/s war das Weltall unbenutzbar — der Mond ist ausgemessen 150 km weit weg, das
// waeren 56 Minuten Flug, der Mars 148 Minuten. Gemessen bewegte man sich voellig korrekt (403 m in
// 9 s), aber der Abstand zum Mond sank nur von 149.662 auf 149.259 m: das sieht aus wie Stillstand,
// und genau so wurde es gemeldet.
const JET_ACCEL  = 18;     // m/s^2, mit der er die Zielfahrt erreicht
const JET_YAW    = 1.3;    // Drehgeschwindigkeit (rad/s)
const JET_PITCH  = 1.0;    // Nickgeschwindigkeit (rad/s)
const JET_PMAX   = 1.25;   // rad (~72 Grad): so steil geht es hoch und runter, kein Ueberkopf
// Rollen mit LT/RT, wie beim Flieger. 2,2 rad/s liegt zwischen Airbus (1,4) und X-Wing (3,8) — ein
// Astronaut legt sich fixer als ein Verkehrsflugzeug, aber nicht so schnell wie ein Kunstflugjet.
const JET_ROLL   = 2.2;
// Querlage-Anschlag 60 Grad: der X-Wing darf ueber Kopf (Kunstflug), ein Astronaut soll nicht kopfueber
// haengen. 60 Grad reichen fuer eine deutliche Kurve und sehen noch nach Absicht aus.
const JET_RMAX   = 1.05;
// Kurve aus der Querlage (beim Flieger spec.turn, dort 0,7 bis 1,6). 1,1 bei voller Querlage von
// 1,05 rad ergibt gut 1,1 rad/s Drehung — vergleichbar mit dem Stick allein (JET_YAW 1,3).
const JET_TURN   = 1.1;
const JET_DAMP   = 0.6;    // Restschwung pro Sekunde, wenn das Gas aus ist (Bremsduesen)
// So weit hinter der Hangarkante beginnt das freie Weltall. Ohne diesen Saum stuende er genau auf
// der Kante und wechselte bei jedem Schritt hin und her (dasselbe Problem, das beim Schlauchboot
// der 8-m-Saum an der Zonengrenze loest).
const JET_EDGE   = 6;
const EVA_SPEED    = 6.0;     // Laufgeschwindigkeit (m/s) — flott, aber kein Sprint
const EVA_TURN     = 2.6;     // wie schnell er sich dreht (rad/s)
const EVA_JUMP_V   = 4.6;     // Absprunggeschwindigkeit (m/s) — auf der Erde gut 1 m hoch
// So nah am Flieger wird B zum Einsteigen statt zum Hüpfen. Vorher 22 m — das ist doppelt so weit
// wie die Spannweite eines X-Wing (11 m), man konnte also nicht direkt neben dem Flieger hüpfen.
const EVA_BOARD_R  = 8;
const EVA_MAX_DIST = 4000;    // weiter als das kommt man nicht weg (dann zieht es zurück)
// Freies Umsehen mit dem rechten Stick. Der ist beim Astronauten komplett frei: vertikal steuert er
// sonst den Schub, aber der Motor ist draußen aus, und horizontal war er ohnehin unbelegt.
const EVA_LOOK_SPEED  = 2.2;  // rad/s, mit der der Stick die Kamera herumzieht
const EVA_LOOK_RETURN = 3.0;  // wie schnell sie ohne Eingabe zurückgleitet
// Wie weit der Blick gehoben und gesenkt werden darf. Positiv = hinauf in den Himmel, negativ =
// hinunter auf den Boden vor sich. Nach oben deutlich mehr Weg als nach unten: in den Himmel
// (und zum Mars-Rover am Horizont) will man wirklich schauen, in den Boden nur ein Stück.
const EVA_PITCH_MIN   = -0.45; // rad ≈ -26° nach unten
const EVA_PITCH_MAX   = 1.25;  // rad ≈ +72° hinauf, fast senkrecht in den Himmel
const EVA_LOOK_AHEAD  = 14;    // m: so weit vor dem Astronauten liegt der Blickpunkt
// Wasser: statt einer harten Wand steigt der Astronaut in ein Schlauchboot. Die Wand am
// Traegerdeck wirkte befremdlich — man stand am Rand und kam nicht weiter, obwohl das Meer da war.
// Jetzt taucht das Boot genau dort auf, wo er sonst ins Wasser gefallen waere, und faehrt wie das
// Feuerwehrboot. Beruehrt es Land, steigt er von allein aus und das Boot verschwindet.
const DINGHY_VMAX  = 11;      // Hoechstfahrt (m/s ~ 40 km/h) — flotter als Laufen, weit unter dem Feuerwehrboot
const DINGHY_ACCEL = 7;       // wie schnell es die Zielfahrt erreicht (m/s^2)
const DINGHY_YAW   = 1.4;     // Ruderwirkung (rad/s) — wendiger als das 16-m-Feuerwehrboot
const DINGHY_ROLL  = 0.18;    // Kraengung in der Kurve (rein optisch)
const DINGHY_BOB   = 1.2;     // wie stark es mit der Duenung nickt — am staerksten von allen,
                              // es ist mit 4,2 m das kleinste Boot und liegt praktisch auf der Welle
const DINGHY_LAND_R = 3.0;    // so weit vor dem Bug wird auf Land geprueft -> dort steigt er aus
// So weit voraus wird nach Wasser gesucht, wenn er zu Fuss festsitzt. Muss ueber die BORDWAND des
// Traegers reichen: der Rumpf ist 4 m breiter als das Deck, von der Deckkante bis zum freien Wasser
// sind es 6,75 m (beides ausgemessen). 9 m gibt Luft, ohne dass er an einer Insel ueber den halben
// Strand ins Boot springt.
const EVA_WATER_REACH = 9;
let evaOrbit = 0, evaPitch = 0;   // aktueller Schwenk (0 = hinter ihm, wie bisher)
// Wohin das Jetpack zurueckkehrt, wenn man wieder andockt — dasselbe wie hangarHost beim Flieger.
// Steht HIER und nicht bei evaStartJet: let wird nicht gehoistet, ein Zugriff davor wuerde werfen.
let jetHost = null;
// Woher man mit dem Jetpack GESTARTET ist: { locale, x, y, z } der Stelle, an der der eigene Flieger
// steht, plus der Ort, an dem man war. Startet man von der ERDE oder von Mond/Mars aus, fuehrt das
// Andocken am Todesstern dorthin zurueck und nicht in den Hangar — sonst laesst ein Kind seinen
// Airbus auf einer Insel stehen und findet ihn nie wieder. Aus dem Hangar heraus bleibt es beim
// Hangar, dort steht der Flieger ja auch.
// Steht HIER und nicht bei evaStartJet: let wird nicht gehoistet, ein Zugriff davor wuerde werfen.
let jetFrom = null;
let eva = null;               // { group, vy, onGround, yaw, planeAt, boat, boatVel } oder null

// Darf man hier aussteigen? Nur am Boden, nicht abgestürzt, und nur auf FESTEM Grund —
// Wasser ist keine Bühne für einen Astronauten, und das Boot fährt selbst schon "zu Fuß".
function evaAllowed(){
  if(eva || state.crashed || state.ejected || state.falling || !state.onGround) return false;
  // Beide Wasserfahrzeuge: ueber Wasser gibt es keinen Grund zum Stehen. Der Ausstieg am Ufer
  // laeuft ueber den eigenen Zweig in buttonY, wie beim Feuerwehrboot.
  if(isWaterCraft()) return false;
  if(locale === 'space') return false;                 // im All gibt es keinen Boden
  if(GROUNDS[locale] || locale === 'death') return true;   // Mond, Mars, Hangarboden
  // Erde: Insel oder Trägerdeck, aber nicht das Wasser
  return isOnLand(state.pos.x, state.pos.z) || isOnCarrier(state.pos.x, state.pos.z);
}
// Fester Grund unter (x,z)? Ausserhalb der Erde ist alles Boden, in der Erdwelt nur Insel und
// Traegerdeck. Ins Wasser DARF er inzwischen — dort steigt er ins Schlauchboot (siehe updateEva),
// diese Funktion sagt nur, wo er zu FUSS stehen kann.
function evaSolid(x, z){
  // Im Hangar traegt nur die ausgemessene Bodenflaeche (siehe onHangarFloor). Vorher stand hier
  // pauschal true, und damit lief er ueber die Hallenkante hinaus ins Nichts weiter. Jenseits der
  // Kante uebernimmt jetzt das Jetpack (updateJet) — die Entsprechung zum Schlauchboot in der
  // Erdwelt, das den Schritt ins Wasser auffaengt statt ihn zu verbieten.
  if(locale === 'death') return onHangarFloor(x, z);
  if(GROUNDS[locale]) return true;
  // Der SANDRAND zaehlt mit: er ist gezeichnet (buildIsland, bis radius*1.12) und laeuft flach ins
  // Meer. Ohne ihn endete der feste Grund an der Grasflaeche und der Astronaut blieb 31 m vor der
  // Wasserlinie stehen (gemessen) — mitten auf dem sichtbaren Strand. Fuer FLUGZEUGE bleibt der
  // Strand weiterhin Wasser (canLandHere/surfaceY sind bewusst nicht angetastet).
  return isOnLand(x, z) || isOnBeach(x, z) || isOnCarrier(x, z);
}
// Bodenhoehe unter den FUESSEN. Wie surfaceY, aber der Strand liegt auf Inselhoehe statt auf 0:
// surfaceY kennt nur die Grasflaeche, und auf dem Sand waere der Astronaut sonst 30 cm eingesunken.
// surfaceY selbst bleibt unveraendert — daran haengt die Landelogik der Flugzeuge.
function evaFootY(x, z){
  if(locale === 'earth' && !isOnLand(x, z) && !isOnCarrier(x, z) && isOnBeach(x, z)){
    // Auf dem SANDRAND: Inselhoehe, aber nie unter der Wasseroberflaeche an dieser Stelle. ISLAND_Y
    // sind nur 0,30 m, die Duenung reicht aber bis rund 1,6 m (AMP 3,0) — bei jeder groesseren Welle
    // stand der Astronaut also UNTER Wasser und war weg. Gemeldet als „wenn eine welle kommt geht der
    // astronaut unter". Der Strand laeuft flach ins Meer, physikalisch ist das Untergehen dort
    // richtig; sichtbar verschwinden soll er aber nicht — also hebt ihn die Welle mit an, wie ein
    // Kind, das im Flachwasser steht.
    return Math.max(ISLAND_Y, seaYAt(x, z));
  }
  return surfaceY(x, z);
}
// Steht der Astronaut gerade im Schlauchboot?
function evaAfloat(){ return !!(eva && eva.boat); }
// Ins Schlauchboot steigen. Es taucht genau dort auf, wo er ins Wasser geraten waere, und liegt
// still: es uebernimmt NICHT den Schwung, mit dem er hineingelaufen (oder gesprungen) ist —
// sonst treibt es beim Einstieg unkontrolliert los, und ein Kind muesste erst gegensteuern.
function evaEnterDinghy(x, z){
  if(!eva || eva.boat) return;
  // NICHT am Kai-Feuerwehrboot: dort will man einsteigen, nicht ins Schlauchboot fallen (siehe
  // nearHarborBoat). Die Sperre steht HIER und nicht an den beiden Ausloesern, damit sie fuer beide
  // gilt — hineinlaufen und hineinfallen.
  if(nearHarborBoat(x, z)) return;
  // Am U-Boot gilt die Sperre NICHT (anders als am Kai-Feuerwehrboot): dort ist das Schlauchboot der
  // vorgesehene Weg. Wer neben dem U-Boot ins Wasser tritt, faehrt die letzten Meter im Schlauchboot
  // heran und steigt bei Beruehrung um (siehe dinghyTouchesHarborSub). Das ersetzt das Absetzen an
  // den Strand, bei dem der Astronaut im Wasser landete.
  const b = makeDinghy();
  b.position.set(x, seaYAt(x, z) - DINGHY_DRAFT, z);
  b.rotation.y = eva.yaw;
  scene.add(b);
  eva.boat = b;
  eva.boatVel = new THREE.Vector3(0, 0, 0);
  eva.boatThr = 0;
  state.throttle = 0;   // Gas beginnt bei 0 — es soll still liegen, nicht sofort losfahren
  // Ihn GLEICH auf den Innenboden setzen, nicht erst im naechsten Frame: sonst steht er ein Bild
  // lang noch auf der alten Hoehe (gemessen 19 cm daneben) und zuckt sichtbar.
  eva.group.position.set(x, b.position.y + (b.userData.floorY || 0), z);
  eva.group.rotation.y = eva.yaw;
  eva.vy = 0; eva.onGround = true;      // er steht im Boot, faellt nicht weiter
  evaJumpFrom = null;                   // ein laufender Sprung endet hier
  showBig('🛟'); bigTimer = 1.2;
}
// Aus dem Schlauchboot aussteigen — an Land, automatisch. Das Boot verschwindet: ein leeres Boot am
// Strand liegen zu lassen sieht aus wie ein Fehler, und wieder einsteigen kann man ueberall.
function evaLeaveDinghy(x, z){
  if(!eva || !eva.boat) return;
  scene.remove(eva.boat);
  eva.boat = null; eva.boatVel = null; eva.boatThr = 0;
  state.throttle = 0;   // an Land steht er wieder zu Fuss da, kein laufender Schub
  eva.group.position.set(x, evaFootY(x, z), z);
  eva.vy = 0; eva.onGround = true;
  showBig('🧑‍🚀'); bigTimer = 1.2;
}
// ---- Jetpack: ins Weltall hinauslaufen und dort schweben ---------------------------------
// Wo das Schlauchboot den Schritt ins Wasser auffaengt, faengt das Jetpack den Schritt ueber die
// Hangarkante auf. Beides nach demselben Muster: kein Verbot, sondern ein Uebergang.
// Das Jetpack ist ein FAHRZEUG wie der X-Wing, kein Anhaengsel des Hangars. Deshalb wechselt es
// den Ort wirklich ins Weltall (locale = 'space') und setzt den Astronauten dorthin, wo der
// Todesstern seinen Hangar hat — knapp ueber der Kugel, genau wie leaveHangar es fuer den Flieger
// macht. Damit gilt ohne eine Zeile eigener Arbeit: Planeten und Schiffe sind sichtbar, das Radar
// zeigt sie, und wer den Todesstern anfliegt, landet im Hangar (updateSpaceBodies).
//
// Vorher blieb locale 'death', und deshalb war draussen NUR Sternenhimmel: placeBodies blendet
// alles aus, was nicht 'space' ist, und der Rueckweg in die Halle war nicht zu finden.
// Kamera hart hinter den Astronauten setzen. Braucht es bei jedem Ortswechsel am Jetpack: das sind
// Spruenge ueber Hunderte Kilometer, und updateCamera zieht sie nur weich nach — sie waere
// minutenlang unterwegs, waehrend man vor einer leeren Sternenkulisse steht.
function jetSnapCam(){
  if(!eva) return;
  // GENAU dieselbe Formel wie im eva-Zweig von updateCamera — Abstand 7 m mal Faktor hinter ihm,
  // 3,4 m mal Faktor darüber, beides um den geklemmten Nickwinkel mitgedreht, Blick auf ihn.
  // Weicht sie ab, springt die Kamera im nächsten Bild um und der Ortswechsel sieht aus wie ein
  // Ruckler. Wer hier etwas ändert, muss es dort auch ändern.
  const bt = eva.jet ? 1.9 : 1;
  const jp = eva.jet ? eva.jetPitch : 0;
  const jr = eva.jet ? (eva.jetRoll || 0) : 0;
  const q  = new THREE.Quaternion().setFromEuler(new THREE.Euler(jp, eva.yaw, jr, 'YXZ'));
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const upV  = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const fwd  = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
  camera.position.copy(eva.group.position)
    .addScaledVector(back, 7*bt)
    .addScaledVector(upV,  3.4*bt);
  camera.up.copy(eva.jet ? upV : new THREE.Vector3(0, 1, 0));
  const ziel = eva.group.position.clone().addScaledVector(fwd, EVA_LOOK_AHEAD * 0.35);
  camera.lookAt(eva.jet ? ziel : eva.group.position);
}
// Das Jetpack wechselt den ORT NICHT MEHR. Es zuendet dort, wo man steht: auf einer Insel, auf dem
// Mond, auf dem Mars, im Hangar. Von dort fliegt man selbst weiter — auch ins Weltall, indem man
// einfach hoch genug steigt (updateLocale macht das fuer den Astronauten jetzt genauso wie fuer den
// Flieger). Vorher sprang es sofort auf locale = 'space' und beamte einen vor den Todesstern; das war
// der gemeldete Fehler „er wechselt auf der Erde automatisch in den Weltraum".
function evaStartJet(x, z, y){
  if(!eva || eva.jet) return;
  eva.jet = true;
  eva.jetVel = new THREE.Vector3(0, 0, 0);
  eva.jetPitch = 0;
  eva.jetRoll = 0;
  eva.vy = 0; eva.onGround = false;
  evaJumpFrom = null;                   // ein laufender Sprung endet hier
  // Startschub: an einem Ort MIT BODEN auf Schwebestufe, im Weltall auf null.
  // 0 % heisst am Boden jetzt „zuegig sinken" (VTOL_DROP, -20 m/s) — mit throttle = 0 ging das
  // Jetpack deshalb im selben Moment wieder aus, in dem es zuendete: gemessen kam „gezuendet" und
  // „aufgesetzt" im gleichen Frame. Genau dasselbe tut enterHangar fuer den X-Wing (VTOL_HOVER).
  // Im Weltall gibt es kein Schweben, dort ist 0 % einfach Stillstand.
  state.throttle = (locale === 'space') ? 0 : VTOL_HOVER;
  // Wo der eigene Flieger steht, bleibt gemerkt: kommt man spaeter aus dem Weltall zurueck, fuehrt
  // das Andocken dorthin und nicht in den Hangar. Sonst laesst ein Kind seinen Airbus auf einer
  // Insel stehen und findet ihn nie wieder.
  jetFrom = { locale: locale, x: eva.planeAt.x, y: eva.planeAt.y, z: eva.planeAt.z };
  // Deutlich ueber den Boden heben, damit er sichtbar abhebt und nicht in derselben Sekunde wieder
  // aufsetzt: die Schwebehoehe wird ohnehin auf VTOL_HOVER_ALT angeregelt, das ist der Weg dorthin.
  eva.group.position.y += 3;
  // Kamera hart hinter ihn: der Blickwinkel aendert sich beim Zuenden (sie folgt jetzt dem Nicken),
  // und ohne Snap schwenkt sie sichtbar herum.
  jetSnapCam();
  showBig('\u{1F680}'); bigTimer = 1.2;
  console.log('[Jetpack] gezuendet auf', locale, 'bei',
              eva.group.position.x.toFixed(0), eva.group.position.y.toFixed(0), eva.group.position.z.toFixed(0));
}
// Vom Jetpack aus ins WELTALL: erreicht man, indem man hoch genug steigt — dieselbe Regel und
// dieselbe Schwelle, die auch der Flieger hat (SPACE_Y auf der Erde, GROUNDS[..].leave auf Mond und
// Mars, die Hallengrenzen im Hangar). Gerufen wird das aus updateLocale.
function evaJetToSpace(){
  if(!eva || !eva.jet) return;
  const vonErde = (locale === 'earth');
  const vonWo = locale;          // MUSS hier gemerkt werden: unten steht locale schon auf 'space'
  // Die Koerper um die AKTUELLE Stelle herum legen. Von der Erde aus mit fromEarth: dann liegt der
  // Erdmittelpunkt genau EARTH_R unter dem Austrittspunkt, ihre Oberflaeche also dort, wo eben noch
  // die Insel war — genau wie beim Flieger in enterSpace.
  if(vonErde) layoutBodies(true);
  else if(!spacePlaced) layoutBodies();
  // Wohin ein Andocken am Todesstern zurueckfuehrt: nur wenn man auch WIRKLICH aus dem Hangar kommt.
  // Steigt man von der Erde, dem Mond oder dem Mars auf, ist der Hangar nicht der Heimatort — dort
  // steht der eigene Flieger nicht. hangarHost traegt aber noch den Wert vom letzten Hangarbesuch,
  // und mit dem waere man beim Andocken in die Halle geschickt worden, waehrend der Airbus auf einer
  // Insel stehen bleibt. Den Rueckweg zum echten Startort kennt jetFrom (siehe evaEndJetToEarth und
  // evaEndJetToGround), das in evaStartJet gesetzt wird.
  jetHost = (locale === 'death') ? hangarHost : null;
  if(vonErde) earthWorldVisible(false);
  locale = 'space';
  if(hangarObj) hangarObj.visible = false;
  for(const bb of bodies) if(bb.obj) bb.obj.visible = true;
  if(earthBall){ earthBall.position.copy(earthHome); earthBall.visible = true; }
  clearGroundTiles();
  // Freien Abstand zum Koerper schaffen, von dem man kommt — genau das macht leaveGround fuer den
  // Flieger (es setzt ihn auf r*1,4 ueber das Zentrum). Von der ERDE aus reichten die 4000 m des
  // Austritts nicht: der Erdmittelpunkt liegt dann 20.000 m tiefer, man steht also 24.000 m von ihm
  // entfernt, und die Rueckkehrschale beginnt schon bei 22.200 m — nur 1800 m Luft. Der Flieger kommt
  // mit 100 m/s heraus und ist sofort weg; ein Astronaut braucht dafuer viel laenger und faellt
  // vorher zurueck. Auf 1,4 mal EARTH_R gehoben sind es 28.000 m, also 5800 m Luft.
  //
  // `vonWo` ist der Ort VOR dem Umschalten (siehe oben) — hier ist locale schon 'space'.
  const abKoerper = vonErde ? null : bodyOf(vonWo);
  const zentrum = vonErde ? earthHome : (abKoerper ? abKoerper.center : null);
  const radius  = vonErde ? EARTH_R   : (abKoerper ? abKoerper.def.r : 0);
  if(zentrum && radius > 0){
    const nrm = eva.group.position.clone().sub(zentrum);
    if(nrm.lengthSq() < 1e-6) nrm.set(0, 1, 0);
    nrm.normalize();
    eva.group.position.copy(zentrum).addScaledVector(nrm, radius * 1.4);
  }
  eva.planeAt.copy(eva.group.position);   // sonst zieht die EVA-Leine sofort zurueck
  // state.pos traegt die gesamte Weltall-Logik (Anflug, Andocken, Asteroiden, Radar, Nebel).
  // _segFrom mit zuruecksetzen, sonst zieht pathDist eine Verbindungslinie vom alten Ort quer durch
  // den Flugraum und trifft Koerper unterwegs.
  state.pos.copy(eva.group.position);
  _segFrom.copy(state.pos); _segOk = false;
  // Kurz nicht andocken und nicht bremsen: man taucht dicht an dem Koerper auf, von dem man kommt.
  dockLock = 6; warpBrakeLock = 6; warpDrive = 0; warpVis = 0;
  // Erst umschauen, nicht gleich in den Hyperraum — genau wie enterSpace und leaveGround es fuer den
  // Flieger tun. Ohne das steht man mit Vollgas im All: der Hyperraum baut sofort auf, und ein Kind
  // ist weg, bevor es Erde, ISS und Mond gesehen hat. Am Jetpack faellt das noch mehr auf, weil man
  // zum Austritt ohnehin Vollgas gegeben hat, um hochzukommen.
  if(state.throttle > 0.5) state.throttle = 0.5;
  jetSnapCam();
  showSpaceHint('\u{1F680}');
  flashFade();
  console.log('[Jetpack] ins Weltall bei', eva.group.position.y.toFixed(0), 'm');
}
// Flug mit dem Jetpack — es wird wie ein FLUGGERAET behandelt, so wie der X-Wing, und zwar mit
// DERSELBEN Belegung: Schub gibt die Zielfahrt, der linke Stick dreht und nickt, LT/RT rollen, und
// aus der Querlage entsteht eine Kurve. Losgelassen richtet sich die Querlage von allein auf.
//
// Frueher stand hier „ein Jetpack hat keine Flaeche, die quer traegt, also gibt es keinen Kurvenflug
// aus der Querlage" — und LT/RT waren unbelegt. Das war meine Annahme, nicht die Anforderung: der
// Astronaut hat sichtbar Duesen ringsum, mit denen er sich legen und ziehen kann. Gemeldet als
// „schau auch, ob der jetpack nicht wie ein flieger behandelt wird, dann muesste ja auch lt und rt
// gehen". Jetzt gilt: was der X-Wing kann, kann das Jetpack auch.
//
// Im WELTALL laufen Anflug, Andocken, Asteroiden, Schiffe und Radar ueber die VORHANDENE
// Weltall-Logik — dafuer war keine eigene Zeile noetig. An einem Ort MIT Boden (Erde, Mond, Mars,
// Hangar) gilt derselbe Antrieb, nur ist dort der Boden fest: wer aufsetzt, steht wieder zu Fuss da.
function updateJet(dt, inp){
  // Sicherheitsnetz: das Jetpack kann INNERHALB dieses Frames ausgehen (Aufsetzen am Boden, Andocken
  // an einem Koerper). Danach ist eva.jetVel null, und ein zweiter Aufruf im selben Frame — oder ein
  // Aufruf gleich danach — lief in „Cannot read properties of null". Vorher war das unmoeglich, weil
  // das Jetpack nur ueber das Andocken endete und dabei immer der Ort wechselte.
  if(!eva || !eva.jet || !eva.jetVel) return;
  const g = eva.group, v = eva.jetVel;
  if(eva.jetRoll === undefined) eva.jetRoll = 0;      // Querlage, wie beim Flieger (rad)
  eva.yaw -= (inp.yaw || 0) * JET_YAW * dt;
  // Nase heben und senken. Der Stick nach vorn (negativ) soll nach UNTEN zeigen, wie im Flieger.
  eva.jetPitch += (inp.pitch || 0) * JET_PITCH * dt;
  eva.jetPitch = Math.max(-JET_PMAX, Math.min(JET_PMAX, eva.jetPitch));
  // ---- ROLLEN mit LT/RT, genau wie im Flieger (dort inp.roll * spec.roll). Vorzeichen wie dort:
  // RT (positiv) legt nach rechts. Begrenzt auf JET_RMAX, damit ein Kind nicht auf dem Kopf haengt —
  // der X-Wing darf ueber Kopf, weil er Kunstflug kann; ein Astronaut soll das nicht.
  eva.jetRoll -= (inp.roll || 0) * JET_ROLL * dt;
  eva.jetRoll = Math.max(-JET_RMAX, Math.min(JET_RMAX, eva.jetRoll));
  // Losgelassen richtet sich die Querlage von allein auf — dieselbe Eigenstabilitaet, die der Flieger
  // hat (AUTO_LEVEL_RATE). Ohne das bleibt man schraeg liegen und driftet dauernd aus dem Kurs.
  if(!(inp.roll)) eva.jetRoll += (0 - eva.jetRoll) * Math.min(1, AUTO_LEVEL_RATE * dt);
  // ---- KURVE aus der Querlage, wie beim Flieger (dort bank * spec.turn). Wer sich legt, zieht
  // herum, ohne den Stick zu drehen — das ist die Haelfte des Flieger-Fluggefuehls und fehlte hier.
  // Mit cos(bank) gewichtet, damit die Kurve bei extremer Querlage nicht kippt (dieselbe Ueberlegung
  // wie beim Flieger, dort fuer den Ueberkopfflug).
  eva.yaw += eva.jetRoll * JET_TURN * Math.max(0, Math.cos(eva.jetRoll)) * dt;
  // Blickrichtung im Raum: yaw um Y, dann der Nickwinkel. Genau die Richtung, in die er schiebt.
  // Die Querlage aendert die Flugrichtung NICHT (sie erzeugt die Kurve oben) — genau wie beim
  // Flieger, dessen forward auch nur aus Nase und Nicken kommt.
  const cp = Math.cos(eva.jetPitch), sp = Math.sin(eva.jetPitch);
  const dir = new THREE.Vector3(-Math.sin(eva.yaw)*cp, sp, -Math.cos(eva.yaw)*cp);
  // Spitzentempo: an einem Ort mit Boden gemuetliche 45 m/s, im WELTALL genau dieselbe Formel wie
  // beim Flieger — SPACE_C * warpFactor(). Bei Vollgas ohne Hyperraum ist das Warp 1 (3000 m/s, Mond
  // in 50 s), mit aufgebautem Hyperraum bis Warp 10 (Mond in 5 s). Das Modelltempo spielt im Vakuum
  // auch beim X-Wing keine Rolle.
  const imAll = (locale === 'space');
  const vMaxJ = imAll ? (SPACE_C * warpFactor()) : JET_VMAX;
  // Beschleunigung: im Weltall muss sie mitwachsen, sonst braucht er bei 686 m/s Zielfahrt mit
  // 18 m/s^2 gut 38 Sekunden zum Hochlaufen. Der X-Wing zieht im Vakuum mit SPACE_C durch.
  const accelJ = imAll ? SPACE_C : JET_ACCEL;
  // Schub = Zielgeschwindigkeit, angeregelt — dieselbe Formel wie beim Flieger und beim Boot.
  //
  // An einem Ort MIT BODEN steuert der Schub unter 30 % das senkrechte Steigen und Sinken statt der
  // Fahrt (siehe der VTOL-Block unten) — 20 % schweben, 10 % sinken, 0 % zuegig sinken. Und zwar
  // GENAU wie beim X-Wing: bei 20 % steht er exakt still, kein Millimeter Vortrieb.
  //
  // Dahin hat es drei Anlaeufe gebraucht. Erst war die Fahrt unter VTOL_FWD ganz aus — richtig, aber
  // damit kam man aus dem Hangar nicht heraus (der Ausgang liegt 200 m seitlich, man schwebte auf der
  // Stelle und sank beim Zurueckdrehen sofort wieder auf den Boden). Dann habe ich sie erhalten, erst
  // gedrittelt, dann voll — damit kam man heraus, aber 20 % war kein Schweben mehr, sondern ein
  // Gleiten mit 9 m/s. Gemeldet als „der xwing bleibt bei 20% exakt stehen, er schwebt. der astronaut
  // nicht".
  //
  // Aufgeloest wie beim Flieger: der Vortrieb wird mit (1 - jetMix) gewichtet, ist bei 20 % also
  // null und blendet zwischen 20 und 30 % ein. Aus dem Hangar kommt man damit mit 30 % Schub — genau
  // so, wie es der X-Wing auch tut. jetMix wird weiter unten gebraucht, deshalb steht es hier schon.
  const want = Math.max(0, state.throttle);
  const jetMix = (!imAll && want < VTOL_FWD)
    ? Math.min(1, (VTOL_FWD - want) / (VTOL_FWD - VTOL_HOVER)) : 0;
  const vtolRestJ = 1 - jetMix;                    // 0 beim Schweben, 1 im normalen Flug
  const targetV = vMaxJ * want;
  const fwdSpeed = v.dot(dir);
  const dv = targetV - fwdSpeed;
  const push = Math.sign(dv) * Math.min(Math.abs(dv)/Math.max(dt,1e-4), accelJ) * vtolRestJ;
  v.addScaledVector(dir, push * dt);
  // Gas aus: die Bremsduesen holen ihn zum Stehen. Im Vakuum gibt es keinen Luftwiderstand, aber
  // ein Jetpack, das man nicht anhalten kann, ist fuer ein Kind unbrauchbar — und der Astronaut
  // hat sichtbar Duesen ringsum. Schwerelos bleibt es trotzdem: kein Fallen, kein Auftrieb.
  //
  // Nur im WELTALL: am Boden uebernimmt der VTOL-Block die Daempfung selbst. Liesse man sie dort
  // mitlaufen, zoege sie auch an der Y-Achse gegen die Sinkregelung — nachgerechnet ein Gleichgewicht
  // bei 86,8 % der Sollrate, gemessen waren es -17,5 statt -20 m/s bei 0 % Schub.
  if(want < 0.01 && imAll){
    const k = Math.max(0, 1 - JET_DAMP*dt); v.multiplyScalar(k);
  }
  // Harte Deckelung, wie sie der Flieger auch hat. Ohne sie summiert sich Fahrt auf: die Schub-
  // regelung sieht nur die Fahrt LAENGS der Blickrichtung, und beim Nicken bleibt die alte Fahrt
  // quer dazu stehen. Gemessen wurden so 68,5 m/s statt der erlaubten 45 — beide Anteile addieren
  // sich geometrisch. Ein Kind kurvt viel, also passiert das dauernd.
  const vl = v.length();
  if(vl > vMaxJ) v.multiplyScalar(vMaxJ / vl);
  // ---- Die FAHRT der Blickrichtung nachfuehren. Genau das tut der Flieger mit seiner
  // Ruderwirksamkeit (siehe stepPhysics: dir.lerp(forward, base*authority)), und dem Jetpack fehlte
  // es: der Schub wirkt nur LAENGS dir, die alte Querfahrt blieb einfach stehen.
  //
  // Nachgerechnet: 3 s gerade Vollgas, dann 1 s drehen — der Astronaut zeigt dann 74,5 Grad zur
  // Seite, fliegt aber nur 12 Grad daneben, also 62,5 Grad SEITWAERTS. Gemeldet als „der astronaut
  // fliegt leicht seitwaerts" und „ueberhaupt scheint alles leicht verdreht". Und weil die Kamera
  // korrekt hinter seiner NASE sitzt, sah es zusaetzlich aus, als fahre sie um ihn herum — das war
  // der Rest des Kamera-Fehlers beim Steigen und Sinken.
  //
  // Ein Jetpack koppelt straffer als ein Flugzeug: es hat keine Flaeche, die traegt, sondern Duesen
  // ringsum, mit denen ein Astronaut die Fahrtrichtung direkt aendert. 5,5 pro Sekunde heisst, dass
  // nach gut einer halben Sekunde 95 % der Richtung stimmen — schnell genug, dass es sich gelenkt
  // anfuehlt, und weich genug, dass es kein Umschnappen ist.
  if(vl > 0.001){
    v.normalize().lerp(dir, Math.min(1, 5.5 * dt)).multiplyScalar(vl);
  }
  // ---- Schubstufen an einem Ort MIT BODEN: genau wie beim X-Wing (VTOL_HOVER/LAND/DROP).
  // 20 % schweben, 10 % ruhig sinken, 0 % zuegig sinken, ab 30 % vorwaerts fliegen. Ohne das kam man
  // gar nicht mehr herunter: das Jetpack war ueberall schwerelos, also blieb er einfach stehen, wo er
  // war. Im Weltall gilt es nicht — dort gibt es keinen Boden, und 0/10/20 % sind Fahrstufen.
  // jetMix ist oben bei der Schubregelung deklariert (es gewichtet dort den Vortrieb) — dieselbe
  // Groesse, die der Flieger als vtolMix benutzt: unter 20 % voll, zwischen 20 und 30 % ausblendend,
  // ab 30 % null.
  if(jetMix > 0){
    const fyJ = (locale === 'death') ? hangarFloorY : evaFootY(g.position.x, g.position.z);
    const aglJ = g.position.y - fyJ;                       // Hoehe ueber Grund
    let tvJ;
    if(want <= VTOL_LAND){
      // Zwischen 0 und 10 % durchgeblendet, wie beim Flieger — ein Analogstick geht durch alle Werte.
      const kL = Math.min(1, Math.max(0, want / VTOL_LAND));
      tvJ = VTOL_DROP + (VTOL_SINK - VTOL_DROP) * kL;
    } else {
      // Schweben: die Schwebehoehe wird angeregelt, nicht endlos gestiegen. Darueber bleibt er
      // stehen — sonst koennte man in der Luft nicht warten.
      const hov = Math.max(0, Math.min(VTOL_CLIMB, (VTOL_HOVER_ALT - aglJ) * 0.5));
      const kH  = Math.min(1, (want - VTOL_LAND) / (VTOL_HOVER - VTOL_LAND));
      tvJ = VTOL_SINK + (hov - VTOL_SINK) * kH;
    }
    // Senkrechtrate anregeln, mit jetMix gewichtet — genau wie beim Flieger.
    v.y += (tvJ - v.y) * Math.min(1, 4*dt) * jetMix;
    // Horizontalfahrt austrudeln lassen, mit jetMix gewichtet — die exakt gleiche Zeile, die der
    // Flieger in seinem VTOL-Block hat (vDamp). Damit steht er bei 20 % wirklich STILL: der Vortrieb
    // ist dort schon null (vtolRestJ oben), und was noch an Fahrt uebrig ist, bremst diese Daempfung
    // weg. Vorher lief sie nur bei Schub null, damit die Fahrt im Schwebeflug erhalten blieb — genau
    // das machte aus dem Schweben ein Gleiten.
    const dampJ = 1 - (1 - Math.exp(-1.2*dt)) * jetMix;
    v.x *= dampJ; v.z *= dampJ;
    // Landeanflug (0 bis 10 %): Nase und Querlage sanft waagerecht ziehen, damit er immer gerade
    // aufsetzt — dasselbe tut der Flieger in seinem VTOL-Block. Ohne das setzt man mit 20 Grad
    // gesenkter Nase auf, weil man ja gerade noch im Sinkflug war.
    if(want <= VTOL_LAND){
      const kV = Math.min(1, 2.5*dt);
      eva.jetPitch += (0 - eva.jetPitch) * kV;
      eva.jetRoll  += (0 - eva.jetRoll)  * kV;
    }
  }
  // Ausserhalb der Landestufen muss eine noch laufende SINKFAHRT weggehen: die Schubregelung wirkt
  // nur LAENGS der Blickrichtung, quer dazu bleibt alte Fahrt stehen. Wer mit 0 % sank (-20 m/s) und
  // dann waagerecht Vollgas gibt, sank sonst weiter mit -20 m/s und setzte im Vorwaertsflug auf dem
  // Boden auf, statt abzuheben. Bei gedrueckter Nase soll er natuerlich weiter sinken duerfen —
  // deshalb wird auf den Anteil geregelt, den die Blickrichtung vorgibt.
  //
  // Mit (1 - jetMix) gewichtet, damit es sich in der Uebergangszone (20 bis 30 %) mit der
  // Schweberegelung oben ergaenzt statt gegen sie zu arbeiten: bei 25 % greifen beide zur Haelfte,
  // genau wie beim Flieger, dessen VTOL-Block und normale Physik sich dort ebenfalls mischen.
  if(!imAll && jetMix < 1){
    const sollVy = v.length() * Math.sin(eva.jetPitch);
    v.y += (sollVy - v.y) * Math.min(1, 4*dt) * (1 - jetMix);
  }
  g.position.addScaledVector(v, dt);
  // Er liegt in Flugrichtung, wie ein Astronaut am Manoevriergeraet.
  // WICHTIG die Reihenfolge YXZ: bei der three.js-Vorgabe XYZ wird erst um X genickt und dann um Y
  // gedreht, wodurch die schon gekippte Laengsachse mitwandert und der Astronaut SEITLICH haengt —
  // gemessen 45,8 Grad Querlage bei halbem Nickwinkel und 71,6 Grad am Anschlag. Genau das war das
  // gemeldete Drehen nach rechts. Der Rest des Spiels rechnet ueberall in YXZ.
  // Nickwinkel mit POSITIVEM Vorzeichen: die Nase des Astronauten zeigt auf -Z (makeAstronaut dreht
  // die Vorlage dafuer um 180 Grad), und eine -Z-Nase wird von Euler.x = +pitch GEHOBEN. Mit dem
  // frueheren -eva.jetPitch kippte er genau verkehrt: beim Steigen schaute er nach unten und
  // umgekehrt. Nachgerechnet bei jetPitch = +0,5 (Flugrichtung dir.y = +0,479, also steigen) zeigte
  // die Nase auf y = -0,479. Die KAMERA stand dabei korrekt auf der Flugachse — es sah nur aus wie
  // ein Kamerafehler beim Steigen und Sinken, und genau so wurde es dreimal gemeldet.
  g.setRotationFromEuler(new THREE.Euler(eva.jetPitch, eva.yaw, eva.jetRoll, 'YXZ'));
  eva.vy = 0; eva.onGround = false;
  // state.pos MUSS mitwandern: daran haengt die gesamte Weltall-Logik (Anflug, Andocken,
  // Asteroiden, Sternenkuppel, Nebel, Kamera-Bezug). Ohne das schaut das Spiel weiter auf die
  // Stelle, an der der X-Wing steht, und man fliegt an allem vorbei, ohne dass etwas naeher kommt.
  // ---- Boden: an einem ORT MIT GRUND (Erde, Mond, Mars, Hangar) kann man nicht hindurchfliegen.
  // Das Jetpack ist ueberall schwerelos (kein Fallen, kein Schweben-Anregeln), aber der Boden ist
  // fest: wer aufsetzt, steht wieder und kann weiterlaufen. Im Weltall gibt es keinen Boden.
  //
  // WICHTIG: state.pos wird hier NICHT mitgezogen. Das gehoert dem stehenden Flieger, und auf der
  // Erde haengen die Inselzellen daran (updateIslands baut um state.pos herum auf) — der Astronaut
  // haette sonst die ganze Welt hinter sich hergeschleppt. Nur im Weltall unten ist state.pos der
  // Astronaut selbst, weil dort die Weltall-Logik daran haengt und kein Flieger unterwegs ist.
  if(locale !== 'space'){
    const fy = (locale === 'death') ? hangarFloorY : evaFootY(g.position.x, g.position.z);
    // Im Hangar traegt nur die ausgemessene Bodenflaeche; jenseits davon geht es hinunter ins Freie
    // (dieselbe Regel wie zu Fuss, siehe evaSolid).
    const traegt = (locale === 'death') ? onHangarFloor(g.position.x, g.position.z) : true;
    if(traegt && g.position.y <= fy){
      g.position.y = fy;
      if(v.y < 0) v.y = 0;
      // Aufgesetzt: das Jetpack aus, er steht wieder zu Fuss da. Genau wie beim X-Wing, der bei
      // 0 % Schub aufsetzt — kein Absturz, sondern eine Landung.
      eva.jet = false; eva.jetVel = null; eva.jetPitch = 0; eva.jetRoll = 0;
      eva.vy = 0; eva.onGround = true;
      g.rotation.set(0, eva.yaw, 0);       // wieder aufrecht hinstellen
      state.throttle = 0;
      evaKmh = 0;
      jetSnapCam();
      showBig('\u{1F9D1}\u{200D}\u{1F680}'); bigTimer = 1.2;
      console.log('[Jetpack] aufgesetzt auf', locale, 'bei', fy.toFixed(1), 'm');
      return;
    }
    evaKmh += (v.length()*3.6 - evaKmh) * Math.min(1, 8*dt);
    return;
  }
  state.pos.copy(g.position);
  state.vel.copy(v);
  eva.planeAt.copy(g.position);      // sonst zieht die EVA-Leine sofort zurueck
  // Andocken: an den Todesstern heran heisst zurueck in den Hangar — genau wie beim Flieger. Das
  // ist der Rueckweg. Man muss nicht die Oeffnung treffen, sondern nur den Todesstern anfliegen.
  if(dockLock <= 0 && spacePlaced){
    // Die ERDE zuerst, und sie steht NICHT in der Koerperliste (sie ist eine eigene Kugel, siehe
    // earthHome). Solange das Jetpack nur aus dem Hangar startete, brauchte es sie nicht — jetzt
    // startet man auch von der Erde aus, und ohne diesen Zweig gaebe es dorthin kein Zurueck: man
    // flog durch die Kugel hindurch, weil nur die bodies geprueft wurden. Dieselbe Schale wie beim
    // Flieger (EARTH_R + EARTH_Y), damit auch der senkrechte Rueckflug hier landet.
    if(g.position.distanceTo(earthHome) < EARTH_R + EARTH_Y){ evaEndJetToEarth(); return; }
    for(const b of bodies){
      if(!b.obj || !b.def.land) continue;
      const d = g.position.distanceTo(b.center);
      if(d < b.def.r + 1500){
        if(b.def.key === 'death'){ evaEndJetToHangar({ pos:b.center.clone(), up:b.def.r*1.4 }); return; }
        evaEndJetToGround(b.def.key); return;   // Mond und Mars haben Boden: dort aufsetzen
      }
    }
  }
  // Sonne und alles ohne Landeflaeche: nicht hineinfliegen. Dieselbe Orbit-Grenze wie beim Flieger
  // — seitlich zieht man vorbei, nur die Bewegung ZUM Koerper hin stoppt.
  if(spacePlaced){
    for(const b of bodies){
      if(!b.obj || b.def.land) continue;
      const d = g.position.distanceTo(b.center);
      if(d < b.def.r + 300){
        const n = g.position.clone().sub(b.center).normalize();
        const radial = v.dot(n);
        if(radial < 0) v.addScaledVector(n, -radial);
        g.position.copy(b.center).addScaledVector(n, b.def.r + 300);
        state.pos.copy(g.position);
      }
    }
  }
  // Zur Erde zurueck geht zu Fuss nicht — das waere ein Wiedereintritt ohne Schiff. Also auch hier
  // eine Orbit-Grenze, damit man an ihr vorbeischwebt statt hineinzufallen.
  if(earthBall && earthBall.visible){
    const d = g.position.distanceTo(earthHome);
    if(d < EARTH_R + 400){
      const n = g.position.clone().sub(earthHome).normalize();
      const radial = v.dot(n);
      if(radial < 0) v.addScaledVector(n, -radial);
      g.position.copy(earthHome).addScaledVector(n, EARTH_R + 400);
      state.pos.copy(g.position);
    }
  }
  evaKmh += (v.length()*3.6 - evaKmh) * Math.min(1, 8*dt);
}
// Zurueck in den Hangar: andocken und wieder auf dem Hallenboden stehen.
function evaEndJetToHangar(host){
  if(!eva) return;
  eva.jet = false; eva.jetVel = null; eva.jetPitch = 0; eva.jetRoll = 0;
  // enterHangar macht die ganze Arbeit: Ort umschalten, Koerper ausblenden, Halle einblenden,
  // Flieger setzen, Kamera, Ueberblendung. Die dockLock-Sperre gilt fuer den ANFLUG, nicht fuers
  // Andocken selbst — also kurz aufheben, sonst weist enterHangar einen ab.
  const alt = dockLock; dockLock = 0;
  const ok = enterHangar(host);
  if(!ok){ dockLock = alt; eva.jet = true; eva.jetVel = new THREE.Vector3(); return; }
  // Den X-Wing auf den Boden stellen statt schweben zu lassen: man kommt zu Fuss zurueck und will
  // einsteigen, nicht unter einem schwebenden Flieger stehen.
  state.pos.set(HANGAR_X, hangarFloorY, HANGAR_Z);
  state.vel.set(0,0,0); state.throttle = 0; state.onGround = true;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  eva.group.position.set(HANGAR_X + 6, hangarFloorY, HANGAR_Z);
  eva.group.rotation.set(0, eva.yaw, 0);
  eva.planeAt.set(state.pos.x, state.pos.y, state.pos.z);
  eva.vy = 0; eva.onGround = true;
  jetSnapCam();   // auf den ASTRONAUTEN, nicht auf den Flieger (Sprung ueber Hunderte km)
  showBig('\u{1F9D1}\u{200D}\u{1F680}'); bigTimer = 1.2;
  console.log('[Jetpack] angedockt, zurueck im Hangar');
}
// Auf Mond oder Mars aufsetzen: dort gibt es Boden, also laeuft man einfach weiter.
//
// Kommt man dorthin ZURUECK, wo man gestartet ist, wird der Flieger an seine gemerkte Stelle gesetzt
// (jetFrom): sonst steht der X-Wing irgendwo auf dem Mond, waehrend man selbst am anderen Ende des
// Kraters aufsetzt, und man findet ihn nicht wieder. Bei einem FREMDEN Koerper — vom Mond zum Mars
// geflogen — gibt es dort keinen geparkten Flieger; dann setzt setupApproach den Landeplatz, und der
// Flieger kommt einfach mit. Das ist gewollt: sonst waere man auf dem Mars gestrandet.
function evaEndJetToGround(key){
  if(!eva) return;
  // Das Jetpack bleibt AN: man fliegt Mond oder Mars an wie der X-Wing und landet selbst. Vorher
  // setzte es hier sofort auf — man kam aus dem Weltall und stand ploetzlich im Krater.
  eva.jetRoll = 0;
  enterGround(key);
  // Von HIER gestartet? Dann zurueck zum eigenen Flieger, nicht an einen zufaelligen Anflugpunkt.
  const heim = (jetFrom && jetFrom.locale === key);
  const tx = heim ? jetFrom.x : state.pos.x;
  const tz = heim ? jetFrom.z : state.pos.z;
  // Der Flieger steht am Ziel auf dem Boden (bei einem FREMDEN Koerper setzt enterGround ihn ueber
  // setupApproach an seinen eigenen Anflug — dann ist state.pos schon gesetzt und wird nur geerdet).
  const gy = vehicleGroundY(tx, tz);
  state.pos.set(tx, gy, tz);
  state.vel.set(0,0,0); state.onGround = true;
  planeGroup.position.copy(state.pos);
  // Und der Astronaut fliegt es an — das Hoehenraster von Mond und Mars wird ueber Frames aufgebaut,
  // groundHeightAt liefert am Anfang also 0. Das ist unkritisch: jetApproach setzt ihn 300 m ueber
  // diesen Wert, und bis er unten ist, steht das Raster laengst (8 Zeilen pro Frame, 128 noetig).
  jetApproach(key, tx, tz);
  // planeAt ist ab jetzt wieder der FLIEGER — dorthin fuehrt das Radar beim Anflug.
  eva.planeAt.set(state.pos.x, state.pos.y, state.pos.z);
  if(heim) jetFrom = null;
  showBig(key === 'mars' ? '\u{1F534}' : '\u{1F319}'); bigTimer = 1.2;
  console.log('[Jetpack] Anflug auf', key, heim ? '(zurueck zum Flieger)' : '(fremder Koerper)');
}
// Zurueck auf die ERDE. Das ist der Rueckweg fuer alle, die von dort gestartet sind: Y auf einer
// Insel zuendet das Jetpack, man fliegt zwischen den Planeten herum, und am Ende will man wieder
// dorthin, wo der eigene Flieger steht. Ohne diesen Weg blieb man im Weltall.
//
// jetFrom (in evaStartJet gemerkt) sagt, WO der Flieger geparkt ist. Er wird dorthin zurueckgesetzt
// — sonst laesst ein Kind seinen Airbus auf einer Insel stehen und findet ihn nie wieder. Ist nichts
// gemerkt (man kam ueber den Hangar), zaehlt die Startinsel bei (0,0): sie ist die einzige Zelle, die
// garantiert eine Insel traegt (islandInfo: isStart), also gibt es dort immer festen Grund.
function evaEndJetToEarth(){
  if(!eva) return;
  // Das Jetpack bleibt AN: man fliegt die Erde an, wie der X-Wing es tut, und landet selbst mit den
  // Schubstufen. Vorher wurde hier eva.jet abgeschaltet und der Astronaut auf den Boden gesetzt —
  // man kam aus dem Weltall und STAND ploetzlich auf der Insel.
  eva.jetRoll = 0;
  // Zielstelle BEVOR die Erdwelt aufgebaut wird: earthWorldVisible(true) ruft updateIslands(), und
  // das baut die Zellen um den Bezugspunkt herum. Stuende der noch im Weltall, entstuenden die
  // Inseln Hunderttausende Meter entfernt und man flog ueber leeres Wasser.
  const zurueck = (jetFrom && jetFrom.locale === 'earth');
  const tx = zurueck ? jetFrom.x : 0;
  const tz = zurueck ? jetFrom.z : 0;
  state.pos.set(tx, 0, tz);
  state.vel.set(0, 0, 0);
  locale = 'earth';
  warpDrive = 0; warpVis = 0;
  if(earthBall) earthBall.visible = false;
  for(const b of bodies) if(b.obj) b.obj.visible = false;
  if(issObj) issObj.visible = false;
  if(hangarObj) hangarObj.visible = false;
  clearGroundTiles();
  // Den Astronauten SCHON auf den Anflugpunkt setzen, bevor die Welt gebaut wird: updateIslands
  // nimmt waehrend der EVA ihn als Bezug (worldFocus), nicht state.pos.
  jetApproach('earth', tx, tz);
  earthWorldVisible(true);          // baut die Inselzellen um den Astronauten herum auf
  // Der eigene Flieger steht dort, wo man ihn gelassen hat — auf Bodenhoehe, damit man ihn beim
  // Landen wiederfindet. Erst JETZT die Hoehe holen: vor updateIslands kennt islandInfo die Zelle
  // zwar (sie ist gerechnet, nicht gezeichnet), aber der Traegertest haengt an gesetzten Gruppen.
  const gy = surfaceY(tx, tz);
  state.pos.y = gy; state.onGround = true; state.stalling = false;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  // planeAt ist ab jetzt wieder der FLIEGER (jetApproach hat es auf den Astronauten gesetzt, damit
  // die EVA-Leine beim Einsetzen nicht zieht) — dorthin fuehrt das Radar beim Anflug.
  eva.planeAt.set(state.pos.x, state.pos.y, state.pos.z);
  jetFrom = null;
  showBig('\u{1F30D}'); bigTimer = 1.2;
  showSpaceHint('\u{1F30D}');
  console.log('[Jetpack] Anflug auf die Erde, Ziel', tx.toFixed(0), tz.toFixed(0),
              zurueck ? '(zurueck zum Flieger)' : '(Startinsel)');
}
// ---- Die Rover als FAHRZEUGE (Mond und Mars) ---------------------------------------------
// Frueher war der Rover reine Deko: roverBesideEva() setzte ihn jeden Frame neben den Astronauten,
// einsteigen konnte man nicht. Dieser Follow-Modus ist entfallen — man laeuft jetzt entweder selbst
// oder fahrt, und dazu muss der Rover an einer festen Stelle stehen. Damit ist auch die orange
// Leuchtsaeule weg, die auf einen gewuerfelten Ankerpunkt 45-80 m weit zeigte: das Fahrzeug steht
// jetzt 30 m rechts neben dem gelandeten X-Wing, da gibt es nichts zu suchen.
const ROVER_SPAWN_SIDE = 30;      // so weit rechts neben dem X-Wing wird es abgesetzt
// Wo das Fahrzeug steht, je Ort. Bleibt liegen, bis man woanders neu landet.
const roverSpot = { moon:null, mars:null };
// Und wo der X-Wing steht, waehrend man zu Fuss oder im Rover unterwegs ist — dorthin fuehrt das
// Radar zurueck. eva.planeAt allein reicht nicht: im Rover ist eva.planeAt der Rover selbst.
let xwingSpot = { moon:null, mars:null };
// Bodenhoehe fuer ein mehrere Meter langes Fahrzeug: der hoechste Wert aus einem Kreuz um den
// Standplatz. Ein einzelner surfaceY-Wert liess es einsinken, weil das Hoehenraster von Mond und
// Mars nur alle 59 m einen Stuetzpunkt hat und dazwischen interpoliert — genau wie beim Flugzeug
// (GROUND_PROBES) muss also die Umgebung mitgemessen werden, sonst steckt es im Hang.
// Der Tastradius richtet sich nach dem Fahrzeug, nicht nach einer festen Zahl: der Perseverance ist
// ausgemessen 10,0 m lang und 6,55 m breit, der Lunar Rover 3,09 x 1,78 m. Mit pauschal 5 m tastete
// der Mondrover weit über sich hinaus (er wurde von Hügeln angehoben, die er nicht berührt), und der
// Perseverance zu kurz. Halbe Länge ist das richtige Maß — dieselbe Überlegung wie GROUND_PROBES
// beim Flugzeug, das über die Spannweite tastet.
function vehicleProbeR(loc){
  return (loc === 'mars') ? 5 : 1.6;
}
function vehicleGroundY(x, z){
  let gy = surfaceY(x, z);
  const r = vehicleProbeR(locale);
  for(const [dx, dz] of [[r,0],[-r,0],[0,r],[0,-r]]){
    const y = surfaceY(x+dx, z+dz);
    if(y > gy) gy = y;
  }
  return gy;
}
// Das Modell fuer den aktuellen Ort: Mars den Perseverance, Mond den Apollo-Rover.
function roverObjFor(loc){
  return loc === 'mars' ? roverObj : (loc === 'moon' ? lunarObj : null);
}
// Um wieviel muss das MODELL gegenueber der Fahrtrichtung gedreht werden? Ausgemessen im Browser:
// der Apollo Lunar Rover ist 3,09 (X) x 1,77 (Y) x 1,78 (Z) m gross — seine Laengsachse liegt auf
// X. Der Perseverance ist 6,55 x 5,45 x 10,0 m, dort liegt sie auf Z. updateRover dreht beide
// gleich (rotation.y = yaw, Fahrtrichtung -Z), also fuhr der Mondrover mit der linken Seite
// voran — genau wie gemeldet. Die Vierteldrehung gehoert ans Modell und nicht in die Fahrphysik,
// sonst muesste jede Rechnung dort zwei Faelle kennen.
function roverYawOff(loc){
  return loc === 'moon' ? Math.PI/2 : 0;
}
// Beim Landen auf Mond oder Mars das Fahrzeug 30 m rechts neben den X-Wing setzen — einmal, dann
// bleibt es liegen. Wird aus placeGroundBase gerufen (dort stand vorher der gewuerfelte Anker).
function roverSpawnBesideXwing(){
  if(locale !== 'moon' && locale !== 'mars') return;
  const obj = roverObjFor(locale);
  if(!obj) return;                       // Modell noch nicht geladen
  // Der X-Wing steht dort, wo er gelandet ist — waehrend der EVA ist das eva.planeAt.
  const px = eva ? eva.planeAt.x : state.pos.x;
  const pz = eva ? eva.planeAt.z : state.pos.z;
  xwingSpot[locale] = { x:px, z:pz };
  const spot = roverSpot[locale];
  // Neu setzen, wenn es noch keinen gibt oder man weit entfernt neu gelandet ist. Waehrend man
  // FAEHRT nicht anfassen, sonst zieht es einem das Fahrzeug unter dem Sitz weg.
  if(eva && eva.rover) return;
  // NUR wenn der X-Wing wirklich STEHT. Diese Funktion laeuft aus placeGroundBase jeden Frame, also
  // auch waehrend des Anflugs — und dann wandert der Flieger mit ueber 6 m pro Frame weiter,
  // waehrend der einmal gesetzte Spot liegen bleibt (er wird erst ab 400 m Abstand erneuert).
  // Gemessen war das Fahrzeug dadurch 47 bis 105 m entfernt statt 30 m. Solange geflogen wird, gibt
  // es also gar keins: zu sehen bekommt man es erst beim Aussteigen, und das geht nur am Boden.
  const steht = state.onGround || (eva && !eva.rover);
  if(!spot && !steht){ obj.visible = false; return; }
  if(!spot || Math.hypot(spot.x - px, spot.z - pz) > 400){
    // rechts neben dem Flieger: die rechte Achse aus seiner Ausrichtung
    const right = new THREE.Vector3(1,0,0).applyQuaternion(state.quat);
    const rx = px + right.x*ROVER_SPAWN_SIDE, rz = pz + right.z*ROVER_SPAWN_SIDE;
    const eul = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
    roverSpot[locale] = { x:rx, z:rz, yaw:eul.y };
  }
  const s = roverSpot[locale];
  obj.position.set(s.x, vehicleGroundY(s.x, s.z), s.z);
  // Der Modellversatz gehört auch hier dazu, nicht nur beim Fahren (updateRover): ohne ihn stand der
  // Lunar Rover quer zur eigenen Blickrichtung, bis man einstieg und losfuhr — es sah aus, als
  // wäre er falsch abgestellt worden. Eine Formel, zwei Stellen: roverYawOff.
  obj.rotation.y = (s.yaw || 0) + roverYawOff(locale);
  obj.visible = true;
}
// Steht man neben dem Rover? (nur zu Fuss, und nur wo es einen gibt)
function roverNear(){
  if(!eva || eva.rover || eva.boat) return false;
  const s = roverSpot[locale];
  if(!s || !roverObjFor(locale)) return false;
  return Math.hypot(eva.group.position.x - s.x, eva.group.position.z - s.z) < ROVER_BOARD_R;
}
function evaEnterRover(){
  if(!eva || eva.rover) return;
  const obj = roverObjFor(locale);
  const s = roverSpot[locale];
  if(!obj || !s) return;
  eva.rover = obj;
  eva.roverVel = new THREE.Vector3();
  eva.yaw = s.yaw || eva.yaw;
  state.throttle = 0;                   // nicht mit Vollgas losschiessen
  showBig('\ud83d\ude99'); bigTimer = 1.2;
}
function evaLeaveRover(){
  if(!eva || !eva.rover) return;
  const obj = eva.rover;
  // Neben dem Rover absetzen, auf festem Grund. Die Stelle wird als neuer Standplatz gemerkt,
  // damit er dort steht, wo man ihn verlassen hat.
  const right = new THREE.Vector3(Math.cos(eva.yaw), 0, -Math.sin(eva.yaw));
  const ex = obj.position.x + right.x*4, ez = obj.position.z + right.z*4;
  roverSpot[locale] = { x:obj.position.x, z:obj.position.z, yaw:eva.yaw };
  eva.rover = null; eva.roverVel = null;
  eva.group.position.set(ex, evaFootY(ex, ez), ez);
  eva.group.visible = true;
  eva.vy = 0; eva.onGround = true;
  state.throttle = 0;
  showBig('\ud83e\uddd1\u200d\ud83d\ude80'); bigTimer = 1.2;
}
// Rover fahren. Aufbau wie updateDinghy (Schlauchboot): lenken ueber inp.yaw, Gas ueber die
// Schubstufen in state.throttle — nicht ueber den linken Stick, damit es sich anfuehlt wie Boot
// und Flieger. Rueckwaerts geht mit Umkehrschub (A/C bzw. negativer Schub).
function updateRover(dt, inp){
  const obj = eva.rover, v = eva.roverVel;
  const spd = Math.hypot(v.x, v.z);
  // Auch im Stand lenkbar (Radfahrzeug mit Einzelradantrieb dreht auf der Stelle) — dieselbe
  // authority-Formel wie beim Boot, sonst kaeme man aus einer Senke nicht heraus.
  const authority = Math.min(1, 0.35 + Math.abs(state.throttle)*0.45 + spd/ROVER_VMAX);
  eva.yaw -= (inp.yaw || 0) * ROVER_YAW * authority * dt;
  const fwd = new THREE.Vector3(-Math.sin(eva.yaw), 0, -Math.cos(eva.yaw));
  const ziel = ROVER_VMAX * state.throttle;
  const fahrt = v.x*fwd.x + v.z*fwd.z;
  const dv = ziel - fahrt;
  const push = Math.sign(dv) * Math.min(Math.abs(dv)/Math.max(dt,1e-4), ROVER_ACCEL);
  v.x += fwd.x * push * dt; v.z += fwd.z * push * dt;
  // Querwiderstand: Raeder rutschen nicht seitlich weg (wie beim Boot)
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const quer = v.x*side.x + v.z*side.z;
  const damp = Math.min(1, 6*dt);
  v.x -= side.x * quer * damp; v.z -= side.z * quer * damp;
  // Rollwiderstand. Er ist NICHT die eigentliche Bremse: bei Schub 0 ist die Zielgeschwindigkeit 0,
  // und die Regelung darueber bremst schon mit den vollen ROVER_ACCEL. Nachgerechnet steht der Rover
  // aus 100 km/h nach 1,79 s — mit der Schubregelung allein waeren es 3,97 s, der Rollwiderstand
  // zieht das Ende der Kurve zusammen. "Gas weg = anhalten" ist gewollt und genau das Verhalten des
  // Feuerwehrboots (accel 9 bei vMax 24, Halt nach rund 2 s).
  if(Math.abs(state.throttle) < 0.02){
    const roll = Math.min(1, 0.8*dt);
    v.x -= v.x*roll; v.z -= v.z*roll;
  }
  // Deckel bei 100 km/h, unabhaengig von der Richtung
  const nun = Math.hypot(v.x, v.z);
  if(nun > ROVER_VMAX){ v.x *= ROVER_VMAX/nun; v.z *= ROVER_VMAX/nun; }
  const nx = obj.position.x + v.x*dt, nz = obj.position.z + v.z*dt;
  obj.position.set(nx, vehicleGroundY(nx, nz), nz);
  // Der Modellversatz (siehe roverYawOff): beim Lunar Rover liegt die Laengsachse auf X, er braucht
  // eine Vierteldrehung, damit er vorwaerts faehrt und nicht seitwaerts.
  obj.rotation.y = eva.yaw + roverYawOff(locale);
  obj.visible = true;
  // Der Astronaut sitzt oben drauf und wird unsichtbar gefuehrt: seine Position ist der Bezugspunkt
  // fuer Kamera, Radar und HUD (worldFocus), also muss sie mitwandern.
  eva.group.position.set(nx, obj.position.y + roverSeatY(locale), nz);
  eva.group.rotation.y = eva.yaw;
  eva.group.visible = false;
  roverSpot[locale] = { x:nx, z:nz, yaw:eva.yaw };
  // Tempoanzeige (dieselbe Groesse, die auch das Laufen fuellt)
  evaKmh += (Math.hypot(v.x, v.z)*3.6 - evaKmh) * Math.min(1, 8*dt);
}
function evaExit(){
  if(!evaAllowed()) return;
  const g = makeAstronaut();
  // Neben dem Flieger absetzen (rechts daneben), Blick in dieselbe Richtung.
  const right = new THREE.Vector3(1,0,0).applyQuaternion(state.quat);
  const eul = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  let x = state.pos.x + right.x*6, z = state.pos.z + right.z*6;
  // Kein Platz daneben -> auf der Stelle aussteigen. Die Gebäudeprüfung bleibt hier bewusst weg:
  // sie gilt nur für die Erdwelt (siehe updateEva), und 6 m neben dem gelandeten Flieger steht
  // ohnehin kein Haus — sonst wäre man beim Landen dagegen geflogen.
  if(!evaSolid(x, z)){ x = state.pos.x; z = state.pos.z; }
  g.position.set(x, evaFootY(x, z), z);
  g.rotation.y = eul.y;
  scene.add(g);
  eva = { group:g, vy:0, onGround:true, yaw:eul.y,
          planeAt:new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z) };
  // Im Hangar kann der X-Wing auch jenseits der Bodenflaeche stehen (er landet ueberall, siehe
  // canLandHere). Dort gibt es keinen Grund zum Stehen — also schwebt der Astronaut von der
  // ersten Sekunde an, statt auf unsichtbarem Boden zu landen.
  if(locale === 'death' && !onHangarFloor(x, z)) evaStartJet(x, z, g.position.y);
  state.throttle = 0;                 // Motor aus, während man draußen ist
  showBig('🧑‍🚀'); bigTimer = 1.2;     // kurze Bestätigung, dann wieder freie Sicht
  evaOrbit = 0; evaPitch = 0;         // Kamera beginnt hinter ihm
  // Der frueher hier stehende roverBesideEva()-Aufruf ist entfallen: der Rover folgt nicht mehr,
  // er steht an seiner Stelle (30 m rechts neben dem X-Wing, siehe roverSpawnBesideXwing).
}
function evaBoard(){
  if(!eva) return;
  if(eva.boat) scene.remove(eva.boat);   // sonst treibt ein leeres Boot fuer immer im Meer
  scene.remove(eva.group);
  eva = null;
  showBig('✈️'); bigTimer = 1.2;
}
// Steht der Astronaut nahe genug am Flieger, um einzusteigen?
function evaCanBoard(){
  if(!eva) return false;
  return eva.group.position.distanceTo(eva.planeAt) < EVA_BOARD_R;
}
function evaJump(){
  if(!eva || !eva.onGround) return;
  // Im Schlauchboot wird nicht gehuepft: er landete sofort wieder im Wasser, das Boot wuerde neu
  // "eingestiegen" und das Symbol blitzte endlos. An Land steigt er ohnehin von allein aus.
  if(eva.boat) return;
  eva.vy = EVA_JUMP_V;                // gleiche Absprungkraft überall — die Schwerkraft macht den Rest
  eva.onGround = false;
  // Absprungpunkt merken, damit die Weite gemessen werden kann (fürs HUD)
  evaJumpFrom = eva.group.position.clone();
  evaJumpDist = 0;
}
// B während der EVA: nah am Flieger einsteigen, sonst hüpfen.
// evaButtonB ist ENTFALLEN: seine Aufgaben liegen jetzt getrennt auf buttonY (ein-/aussteigen,
// umsteigen) und buttonB (huepfen). Vorher machte eine Taste beides, und wer neben seinem Flieger
// stand und huepfen wollte, stieg stattdessen ein. Siehe evaBoardY und evaActionB weiter oben.
// Wie schnell läuft der Astronaut gerade (km/h)? updateEva verschiebt ihn direkt, es gibt also
// keinen Geschwindigkeitsvektor wie beim Flugzeug — die Strecke des letzten Frames ist das Maß.
// Etwas geglättet, sonst zappelt die Anzeige bei schwankender Bildrate.
let evaKmh = 0;
function evaSpeedKmh(){ return evaKmh; }
// Sprungweite: waagerechte Strecke seit dem Absprung. Während des Sprungs wächst sie mit, nach der
// Landung bleibt der erreichte Wert stehen — sonst könnte man ihn nicht ablesen. Vom Dach der
// Mondbasis kommt man damit sichtbar weit, und genau das ist der Reiz.
let evaJumpFrom = null;   // Absprungpunkt, solange man in der Luft ist
let evaJumpDist = 0;      // erreichte Weite (m), bleibt nach der Landung stehen
// Fahrt im Schlauchboot. Steuerung genau wie beim Feuerwehrboot (linker Stick: <-> lenkt, hoch/runter
// gibt Gas), nur kleiner und wendiger. Der Astronaut steht mit im Boot und wird jeden Frame darauf
// gesetzt — deshalb braucht er hier keine eigene Physik.
function updateDinghy(dt, inp){
  const b = eva.boat, v = eva.boatVel;
  // Lenken: ein Aussenborder gibt auch im Stand Ruderdruck, deshalb dieselbe authority-Formel wie
  // beim Feuerwehrboot — sonst kaeme man aus einer Bucht nicht mehr heraus.
  const spd = Math.hypot(v.x, v.z);
  const authority = Math.min(1, 0.3 + Math.abs(state.throttle) * 0.5 + spd / DINGHY_VMAX);
  eva.yaw -= (inp.yaw || 0) * DINGHY_YAW * authority * dt;
  // Gas: derselbe Weg wie beim Feuerwehrboot — die SCHUBSTUFEN aus state.throttle (rechter Stick
  // hoch/runter, W/S, Leertaste = Vollgas, A/C = Umkehrschub zum Rueckwaertsfahren). Der linke
  // Stick lenkt nur. Vorher gab der linke Stick direkt Gas; das war eine zweite, andere
  // Bootssteuerung als beim Feuerwehrboot.
  const want = state.throttle;
  eva.boatThr = want;
  const fwd = new THREE.Vector3(-Math.sin(eva.yaw), 0, -Math.cos(eva.yaw));
  const targetV = DINGHY_VMAX * want;
  const fwdSpeed = v.x*fwd.x + v.z*fwd.z;
  const dv = targetV - fwdSpeed;
  const push = Math.sign(dv) * Math.min(Math.abs(dv)/Math.max(dt,1e-4), DINGHY_ACCEL);
  v.x += fwd.x * push * dt; v.z += fwd.z * push * dt;
  // Querwiderstand: es rutscht nicht seitlich weg (wie beim Feuerwehrboot).
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const sideSpd = v.x*side.x + v.z*side.z;
  const damp = Math.min(1, 4*dt);
  v.x -= side.x * sideSpd * damp; v.z -= side.z * sideSpd * damp;
  // Fahren, solange das Ziel offenes Wasser ist. Land haelt es nicht auf wie beim Feuerwehrboot —
  // dort steigt der Astronaut AUS. Geprueft wird ein Stueck VOR dem Bug (DINGHY_LAND_R), sonst
  // stiege er erst aus, wenn das halbe Boot schon im Sand steckt.
  const nx = b.position.x + v.x*dt, nz = b.position.z + v.z*dt;
  const ax = nx + fwd.x*DINGHY_LAND_R, az = nz + fwd.z*DINGHY_LAND_R;
  // Land voraus? Aussteigen — aber nur auf begehbarem Grund. Ein Bauwerk oder die Bordwand des
  // Traegers ist kein Ufer: dort gleitet es ab wie das Feuerwehrboot, sonst stuende der Astronaut
  // ploetzlich in einer Hauswand.
  if(isOnLand(ax, az) || isOnBeach(ax, az) || isOnCarrier(ax, az)){
    // Aussteigepunkt: der erste feste Grund vom Bug aus. Nicht einfach (ax,az) nehmen — der liegt
    // bei Strand womoeglich noch im Sand unter der Wasserlinie.
    let ex = ax, ez = az;
    for(let s = 0; s <= 8; s += 1){
      const px = nx + fwd.x*(DINGHY_LAND_R + s), pz = nz + fwd.z*(DINGHY_LAND_R + s);
      if(evaSolid(px, pz)){ ex = px; ez = pz; break; }
    }
    if(evaSolid(ex, ez)){ evaLeaveDinghy(ex, ez); return; }
    // Land voraus, aber nichts Begehbares (Bauwerk/Bordwand) -> abgleiten statt aussteigen.
    coastSlide(b.position, v, fwd, dt);
  } else if(isOpenWater(nx, nz)){
    b.position.x = nx; b.position.z = nz;
  } else {
    coastSlide(b.position, v, fwd, dt);
  }
  // Beruehrt es das U-Boot am Strand? Dann UMSTEIGEN — das ist der Weg hinein, seit der Ausstieg ins
  // Schlauchboot geht: heranfahren, antippen, drin. Geprueft VOR pushOutOfSeaShip, denn das liegende
  // U-Boot ist kein fahrendes Schiff und wird dort gar nicht gesehen.
  const treffer = dinghyTouchesHarborSub(b.position.x, b.position.z);
  // Erst wenn man die Huelle EINMAL verlassen hat, zaehlt eine Beruehrung als Einsteigen. Ohne diese
  // Sperre stiege man sofort wieder ein, weil das Schlauchboot beim Ausstieg direkt neben dem Rumpf
  // entsteht (gemessen: Umstieg nach 0 Frames, Aussteigen unmoeglich).
  if(eva.subLatch){ if(!treffer) eva.subLatch = false; }
  else if(treffer){ dinghyBoardSub(treffer); return; }
  // Wie beim Feuerwehrboot: ein fahrendes Schiff kann sich darueberschieben -> quer hinausdruecken.
  pushOutOfSeaShip(b.position, v, dt);
  // Auf der Duenung liegen und mit ihr nicken. Bezug ist die WELTposition -> seaYAt (das Boot ist
  // nicht der Flieger, der in der Gittermitte sitzt).
  b.position.y = seaYAt(b.position.x, b.position.z, dt) - DINGHY_DRAFT;
  const bowY   = seaYAt(b.position.x + fwd.x*DINGHY_LEN*0.5, b.position.z + fwd.z*DINGHY_LEN*0.5, dt);
  const sternY = seaYAt(b.position.x - fwd.x*DINGHY_LEN*0.5, b.position.z - fwd.z*DINGHY_LEN*0.5, dt);
  const pitchT = Math.atan2(bowY - sternY, DINGHY_LEN) * DINGHY_BOB;
  b.rotation.set(pitchT, eva.yaw, -(inp.yaw || 0) * DINGHY_ROLL);
  // Der Astronaut steht auf dem Innenboden und dreht sich mit dem Boot.
  const g = eva.group;
  g.position.set(b.position.x, b.position.y + (b.userData.floorY || 0), b.position.z);
  g.rotation.y = eva.yaw;
  eva.vy = 0; eva.onGround = true;
}
function updateEva(dt, inp){
  if(!eva) return;
  const g = eva.group;
  const _wasX = g.position.x, _wasZ = g.position.z;
  // Im Schlauchboot laeuft eine eigene Physik — Laufen, Springen und Bodenhoehe gelten dort nicht.
  // Tempo und Sprungweite werden trotzdem gefuehrt (dafuer der gemeinsame Schluss unten).
  if(eva.boat){
    updateDinghy(dt, inp);
    // Sicherheitsnetz: updateDinghy kann eva INNERHALB dieses Frames aufloesen — beim Umsteigen ins
    // U-Boot (dinghyBoardSub) und beim Aussteigen an Land. Ohne diese Pruefung wirft die Zeile
    // darunter, und das haelt den ganzen Frame an. Genau die Vorsicht, die updateJet schon uebt.
    if(!eva) return;
    const movedB = Math.hypot(g.position.x - _wasX, g.position.z - _wasZ);
    evaKmh += ((dt > 1e-6 ? movedB/dt*3.6 : 0) - evaKmh) * Math.min(1, 8*dt);
    // Und nur, solange er noch IM Boot sitzt: an Land steigt er aus, dann gilt der Zweig nicht mehr.
    if(eva.boat) state.pos.copy(eva.planeAt);
    return;
  }
  // Im Rover laeuft eine eigene Physik — Laufen, Springen und Bodenhoehe gelten dort nicht,
  // genau wie im Schlauchboot darueber.
  if(eva.rover){
    updateRover(dt, inp);
    state.pos.copy(eva.planeAt);      // der X-Wing bleibt, wo er steht
    return;
  }
  // Am Jetpack gilt eine eigene Physik: kein Boden, keine Schwerkraft, Fahrt in Blickrichtung.
  // Steht hier NACH Boot und Rover, damit die Reihenfolge dieselbe bleibt wie in evaButtonB.
  //
  // ANDERS als bei Boot und Rover wird state.pos hier NICHT auf eva.planeAt zurueckgesetzt.
  // Boot und Rover fahren auf der Erde bzw. auf dem Mond herum, waehrend der Flieger an seinem
  // Platz stehen bleibt — dort ist das richtig. Das Jetpack fliegt an JEDEM Ort: auf der Erde, auf
  // Mond und Mars, im Hangar und im Weltall. Nur im WELTALL fuehrt updateJet state.pos selbst mit,
  // weil dort die ganze vorhandene Logik daran haengt (Anflug, Andocken, Asteroiden, Sternenkuppel,
  // Nebel) und kein Flieger unterwegs ist. An einem Ort MIT Boden bleibt state.pos beim stehenden
  // Flieger — auf der Erde haengen die Inselzellen daran.
  if(eva.jet){
    updateJet(dt, inp);
    return;
  }
  // Drehen und laufen: ←→ dreht, ↕ läuft vor/zurück (wie ein Fahrzeug — für Kinder einfacher als
  // eine kameragebundene Steuerung, weil "vorwärts" immer die Blickrichtung ist).
  eva.yaw -= (inp.yaw || 0) * EVA_TURN * dt;
  g.rotation.y = eva.yaw;
  const fx = -Math.sin(eva.yaw), fz = -Math.cos(eva.yaw);      // Blickrichtung (-Z bei yaw 0)
  const walk = -(inp.pitch || 0);                              // Stick nach vorn = vorwärts
  if(Math.abs(walk) > 0.01){
    const nx = g.position.x + fx*walk*EVA_SPEED*dt;
    const nz = g.position.z + fz*walk*EVA_SPEED*dt;
    // Fester Grund und keine Wand: erst beides, dann X und Z einzeln (an einer Kante entlanglaufen).
    // Die Gebäudeprüfung gilt NUR in der Erdwelt: hitsBuilding rechnet Weltkoordinaten in
    // Insel-Rasterzellen um, und auf Mond und Mars gelten dieselben Koordinaten — dort fand es
    // Häuser, die es gar nicht gibt. Auf dem Mars landet man um (0,0), und Zelle (0,0) ist immer
    // die Startinsel mit acht Gebäuden: jeder Schritt war blockiert.
    const free = (x,z)=> evaSolid(x,z) &&
      (locale !== 'earth' || !hitsBuilding(x, evaFootY(x,z)+1, z, false));
    if(free(nx, nz)){ g.position.x = nx; g.position.z = nz; }
    else if(free(nx, g.position.z)) g.position.x = nx;
    else if(free(g.position.x, nz)) g.position.z = nz;
    // Steckt er WIRKLICH fest und davor liegt WASSER (kein Haus)? Dann steigt er dort ins
    // Schlauchboot, statt an einer unsichtbaren Wand stehen zu bleiben — genau das fuehlte sich am
    // Traegerdeck befremdlich an. Nur in der Erdwelt: Mond und Mars haben kein Wasser.
    //
    // Geprueft wird die tatsaechlich zurueckgelegte STRECKE, und zwar mit Schwelle. Zwei Fallen,
    // beide gemessen:
    //  1. Ein `else if` am Kettenende greift nie: laeuft er senkrecht aufs Wasser zu, liegt nz auf
    //     seinem eigenen z, und `free(g.position.x, nz)` ist trivial wahr (er steht ja dort).
    //     Gemessen: 60 Frames bewegungslos am Ufer.
    //  2. Ein exakter Vergleich auf "nichts bewegt" greift auch nicht. Bei yaw = -90 Grad ist fz
    //     nicht 0, sondern -6e-17 — er rutscht pro Frame um 1e-18 m zur Seite, und das zaehlte als
    //     Bewegung. Daher die Schwelle: weniger als ein Zehntel des gewollten Schritts heisst fest.
    // Bewegt er sich wirklich, laeuft er an der Kueste ENTLANG — das soll so bleiben, statt ihn beim
    // seitlichen Streifen sofort ins Boot zu setzen.
    const want = Math.abs(walk) * EVA_SPEED * dt;
    const got  = Math.hypot(g.position.x - _wasX, g.position.z - _wasZ);
    if(locale === 'earth' && eva.onGround && got < want*0.1){
      // Wasser suchen, und zwar ein STUECK weit voraus: direkt neben einer Deckkante liegt die
      // BORDWAND (der Rumpf ist 4 m breiter als das Deck, bis zum freien Wasser sind es von der
      // Kante 6,75 m — beides ausgemessen). Nur den naechsten Schritt zu pruefen fand dort niemals
      // Wasser, und der Astronaut stand an der Kante fest: genau die harte Grenze, die weg sollte.
      // Er springt also ueber die Bordwand hinweg ins freie Wasser daneben.
      const wx = -Math.sin(eva.yaw), wz = -Math.cos(eva.yaw);
      for(let s = 0; s <= EVA_WATER_REACH; s += 0.5){
        const px = g.position.x + wx*s, pz = g.position.z + wz*s;
        if(evaSolid(px, pz)) continue;          // noch Deck/Land davor -> weitersuchen
        if(!isOpenWater(px, pz)) continue;      // Bordwand oder Bauwerk -> daran vorbei
        // Steht er HOCH ueber dem Wasser (Flugdeck: 12 m), soll er sichtbar hinunterfallen statt
        // sofort im Boot zu stehen — genau dieser Sprung macht die Szene aus. Also nur ueber die
        // Kante SETZEN und der Schwerkraft ueberlassen (der Fall-Zweig unten faengt ihn im Boot auf).
        const wl = seaYAt(px, pz, dt);
        if(g.position.y > wl + 2.5){
          g.position.x = px; g.position.z = pz;
          eva.onGround = false;
          if(eva.vy > 0) eva.vy = 0;           // kein Restschwung nach oben
          evaJumpFrom = g.position.clone();    // die Sprungweite mitzaehlen (fuers HUD)
          evaJumpDist = 0;
          return;
        }
        evaEnterDinghy(px, pz); return;        // fast auf Wasserhoehe -> direkt einsteigen
      }
    }
  }
  // Im HANGAR endet der Boden an der ausgemessenen Hallenkante (siehe onHangarFloor). Wer dort
  // weiterlaeuft, tritt ins Weltall hinaus — und genau dort setzt das Jetpack ein, so wie in der
  // Erdwelt das Schlauchboot. Geprueft wird wie oben die tatsaechlich zurueckgelegte STRECKE mit
  // Schwelle: ein 'else if' am Kettenende griffe nie, weil free(x, nz) trivial wahr ist, wenn nz
  // auf seinem eigenen z liegt (derselbe Fall, der beim Schlauchboot gemessen wurde).
  if(locale === 'death' && eva.onGround && !eva.jet && Math.abs(walk) > 0.01){
    const wantD = Math.abs(walk) * EVA_SPEED * dt;
    const gotD  = Math.hypot(g.position.x - _wasX, g.position.z - _wasZ);
    if(gotD < wantD*0.1){
      // Ein Stueck weit voraus suchen, nicht nur den naechsten Schritt: an der Kante steht er
      // sonst fest, weil der erste Schritt noch auf dem Boden landet.
      const jx = -Math.sin(eva.yaw), jz = -Math.cos(eva.yaw);
      for(let s = 0.5; s <= JET_EDGE*2; s += 0.5){
        const px = g.position.x + jx*s, pz = g.position.z + jz*s;
        if(onHangarFloor(px, pz)) continue;        // noch Hallenboden davor -> weitersuchen
        // Ueber die Hallenkante hinaus: das Jetpack zuendet, aber es bleibt IM HANGAR. Ins Weltall
        // kommt man von hier aus, indem man selbst hinausfliegt (updateLocale) — vorher sprang es
        // sofort vor den Todesstern, was ungewollt war.
        evaStartJet(px, pz, g.position.y + 0.6); return;
      }
    }
  }
  // Springen und fallen mit der Schwerkraft DES ORTES — das ist der Witz an Mond und Mars.
  const grav = GRAV_AT[locale] !== undefined ? GRAV_AT[locale] : 9.81;
  // Ueber Wasser abwaerts unterwegs (vom Traegerdeck gesprungen, ueber die Kaikante gelaufen):
  // sobald er die Wasserlinie erreicht, faengt ihn das Schlauchboot auf. Es taucht unter ihm auf,
  // statt ihn durchzuschlagen — vom 12 m hohen Flugdeck ist das ein ordentlicher Sprung, und
  // "landet im Boot" soll genau so aussehen.
  if(locale === 'earth' && !evaSolid(g.position.x, g.position.z)
     && isOpenWater(g.position.x, g.position.z)){
    // AM KAI-FEUERWEHRBOOT: dort ist das Schlauchboot gesperrt (siehe nearHarborBoat), und ohne
    // eigene Behandlung fiele der Astronaut endlos weiter. Er steht dort auf der Wasserlinie — die
    // Zone ist nur die Bootslaenge breit, also flaches Hafenwasser direkt am Kai, in dem man watet.
    // So kann man ums Boot herumlaufen und mit Y einsteigen.
    if(nearHarborBoat(g.position.x, g.position.z)){
      const wlH = seaYAt(g.position.x, g.position.z, dt);
      if(g.position.y <= wlH){ g.position.y = wlH; eva.vy = 0; eva.onGround = true; }
      else { eva.vy -= grav * dt; g.position.y += eva.vy * dt; eva.onGround = false; }
      state.pos.copy(eva.planeAt);
      return;
    }
    const wl = seaYAt(g.position.x, g.position.z, dt) - DINGHY_DRAFT + (dinghyFloorY || 0);
    if(g.position.y <= wl){ evaEnterDinghy(g.position.x, g.position.z); return; }
    // noch in der Luft ueber dem Wasser: weiterfallen
    eva.vy -= grav * dt;
    g.position.y += eva.vy * dt;
    eva.onGround = false;
    if(evaJumpFrom) evaJumpDist = Math.hypot(g.position.x - evaJumpFrom.x, g.position.z - evaJumpFrom.z);
    state.pos.copy(eva.planeAt);
    return;
  }
  const gy = evaFootY(g.position.x, g.position.z);
  if(!eva.onGround || eva.vy > 0){
    eva.vy -= grav * dt;
    g.position.y += eva.vy * dt;
    if(g.position.y <= gy){ g.position.y = gy; eva.vy = 0; eva.onGround = true; }
  } else {
    g.position.y = gy;                 // am Boden der Fläche folgen (Mondkrater ist hügelig)
  }
  // Nicht endlos weglaufen: sonst verlässt man die geladene Weltzelle und steht im Nichts.
  const d = Math.hypot(g.position.x - eva.planeAt.x, g.position.z - eva.planeAt.z);
  if(d > EVA_MAX_DIST){
    const k = EVA_MAX_DIST / d;
    g.position.x = eva.planeAt.x + (g.position.x - eva.planeAt.x)*k;
    g.position.z = eva.planeAt.z + (g.position.z - eva.planeAt.z)*k;
  }
  // Tempo aus der zurückgelegten Strecke (fürs HUD), geglättet gegen Bildraten-Zappeln.
  const moved = Math.hypot(g.position.x - _wasX, g.position.z - _wasZ);
  const kmh = dt > 1e-6 ? moved/dt*3.6 : 0;
  evaKmh += (kmh - evaKmh) * Math.min(1, 8*dt);
  // Sprungweite mitzählen, solange man in der Luft ist. Nach der Landung bleibt der Wert stehen —
  // erst der nächste Absprung setzt ihn zurück (siehe evaJump).
  if(evaJumpFrom){
    evaJumpDist = Math.hypot(g.position.x - evaJumpFrom.x, g.position.z - evaJumpFrom.z);
    if(eva.onGround) evaJumpFrom = null;      // gelandet: Weite festhalten
  }
  // Der Flieger bleibt stehen, wo er war — planeGroup wird währenddessen nicht bewegt.
  state.pos.copy(eva.planeAt);
}
function clearEva(){
  // Das Schlauchboot mit abraeumen — sonst bleibt es beim Modellwechsel oder Reset im Meer liegen.
  if(eva && eva.boat) scene.remove(eva.boat);
  // Das Jetpack ist kein eigenes Objekt in der Szene (nur ein Zustand am Astronauten), es
  // verschwindet also mit ihm — anders als Boot und Rover, die eigene Modelle sind.
  if(eva){ scene.remove(eva.group); eva = null; }
  evaKmh = 0; evaJumpFrom = null; evaJumpDist = 0;
}

// ---------- Überschall: Knall + weißer Vapor-Cone (nur Kunstflug-Jets, ab Schallgeschwindigkeit) ----------
const SOUND_SPEED = 343;              // m/s (~1235 km/h)
let wasSupersonic = false;            // Flanke erkennen (Durchbruch = Übergang unter->über)
const vaporMat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false });
let vaporCone = null, vaporT = 0;
function makeVaporCone(){
  // flacher, nach hinten offener Kegel (Scheibe um den Rumpf), zeigt entgegen der Flugrichtung
  const c = new THREE.Mesh(new THREE.ConeGeometry(7, 10, 24, 1, true), vaporMat);
  c.renderOrder = 997;
  scene.add(c);
  return c;
}
function triggerSonicBoom(){
  playSonicBoom();
  rumble(400, 1.0, 0.9);              // kräftiger Stoß wie beim Crash
  if(!vaporCone) vaporCone = makeVaporCone();
  vaporT = 0.6;                       // sichtbar ~0,6 s
}
function updateSonic(dt){
  const speed = state.vel.length();
  const canSupersonic = spec.aero && speed >= SOUND_SPEED && locale === 'earth';   // nur in der Luft
  if(canSupersonic && !wasSupersonic && !state.onGround) triggerSonicBoom();  // Flanke: Durchbruch
  wasSupersonic = canSupersonic;
  // Vapor-Cone animieren: kurzes Aufblitzen am/hinter dem Flieger
  if(vaporCone){
    if(vaporT > 0){
      vaporT -= dt;
      vaporMat.opacity = Math.max(0, Math.min(0.5, vaporT));  // ein-/ausblenden
      const back = new THREE.Vector3(0,0,1).applyQuaternion(state.quat);
      vaporCone.position.set(state.pos.x + back.x*4, state.pos.y + back.y*4, state.pos.z + back.z*4);
      // Kegelspitze nach vorne (entgegen -Z-Nase): +Y-Achse des Kegels auf Flugrichtung legen
      const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
      vaporCone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), fwd.clone().negate());
      vaporCone.visible = true;
    } else {
      vaporCone.visible = false;
    }
  }
}

// ---------- Wolken ----------
const clouds = [];
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
function makeCloud() {
  const g = new THREE.Group(); const n = 3 + Math.floor(Math.random()*4);
  for (let i=0;i<n;i++){ const s=20+Math.random()*40;
    const p=new THREE.Mesh(new THREE.SphereGeometry(s,6,5),cloudMat);
    p.position.set((Math.random()-0.5)*80,(Math.random()-0.5)*15,(Math.random()-0.5)*80);
    p.scale.y=0.6; g.add(p);} return g;
}
const CLOUD_SPREAD = 2600;
for (let i=0;i<45;i++){ const c=makeCloud();
  c.position.set((Math.random()-0.5)*CLOUD_SPREAD, 260+Math.random()*380, (Math.random()-0.5)*CLOUD_SPREAD);
  clouds.push(c); scene.add(c);}

// ---------- FMS-Modelle bauen ----------
// "Canadair" ist ein eigengebautes Löschflugzeug (kein FMS-Mesh) und kommt ans Ende.
// Feste Reihenfolge (Wunsch): Löschflugzeug, Jet, Airbus, Eindecker, Doppeldecker.
// 'Canadair','AlphaJet' sind eigengebaut; SuperCup=Eindecker, Pitts=Doppeldecker.
// Reihenfolge = Durchschalt-Reihenfolge (Y / M). Der X-Wing steht vorn: mit ihm startet das Spiel.
// Am Ende steht das Feuerwehrboot: kein Flugzeug, sondern ein Boot, das auf dem Meer fährt und
// mit B löscht (siehe stepBoat und extinguishNear).
// Die Reihenfolge, in der M durchschaltet. So gewuenscht: erst die beiden, mit denen man am
// haeufigsten fliegt, dann die Mustang, dann das Boot, danach die grossen und traegen.
// Das U-BOOT steht ganz am Ende: es ist das jüngste Fahrzeug und das einzige, das taucht — wer es
// sucht, schaltet einmal durch. Ein eigenes Modell (kein Sub-Modus wie der Rover), nach genau
// demselben Muster wie das Feuerwehrboot: eigene Physik (stepSub), eigener Startplatz am Strand,
// Ein- und Aussteigen mit Y. Deshalb muss es hier UND in PLANE_SPECS, buildModel, canLandHere,
// findStart und CAM_CFG stehen — dieselben sechs Stellen, an denen auch 'Boat' vorkommt.
const MODEL_NAMES = ['XWing', 'Canadair', 'Mustang', 'Boat', 'AlphaJet', 'Airbus', 'Transall', 'Sub'];
const loader = new THREE.TextureLoader();
const planeGroup = new THREE.Group();  // Container, den wir bewegen
scene.add(planeGroup);
const modelHolder = new THREE.Group(); // enthält das aktuelle Mesh, korrekt gedreht/skaliert
planeGroup.add(modelHolder);
let propMeshes = [];   // rotierende Propeller (Canadair)
// Fahrwerk ist bei den FMS-Modellen fest im Mesh enthalten -> kein separates Fahrwerk.

// ---------- Externe GLB-Modelle (Sketchfab) ----------
//  Canadair CL-215 by AlessioPassera · Dornier Alpha Jet by 42manako
// Werden beim Start EINMAL geladen (async), normalisiert (Größe/Ausrichtung/Boden)
// und als Vorlage gecacht. buildModel() klont die Vorlage synchron.
const glbTemplates = {};       // name -> fertig ausgerichtete Group (Vorlage zum Klonen)
const GLB_CONFIG = {
  // yOff: manueller Höhen-Offset (negativ = tiefer setzen, falls das Modell schwebt)
  Canadair: { data: () => window.CANADAIR_GLB, span: 18.5, yOff: 0 },
  AlphaJet: { data: () => window.ALPHAJET_GLB, span: 11,   yOff: 0, recolor: 'wbr' },
  Airbus:   { data: () => window.AIRBUS_GLB,   span: 27.1, yOff: 0 },
  Mustang:  { data: () => window.MUSTANG_GLB,  span: 11,   yOff: 0 },
  Transall: { data: () => window.TRANSALL_GLB, span: 20,   yOff: 0 },
  // X-Wing: im Modell liegt die Nase auf +Z und die Spannweite auf X — die längere Achse (Z)
  // ist also die LÄNGE. 12,5 m Rumpflänge normiert ergibt ~10 m Spannweite (echt: 12,5 / 11 m).
  XWing:    { data: () => window.XWING_GLB,    span: 12.5, yOff: 0 },
};
function preloadGLB(name){
  const cfg = GLB_CONFIG[name];
  if(!cfg || !cfg.data() || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = cfg.data().split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    // auf Ziel-Spannweite normieren (größere Horizontalachse = Spannweite)
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(cfg.span / Math.max(size.x, size.z));
    // X/Z zentrieren, Unterseite auf y=0 (+ manueller Offset pro Modell)
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z;
    obj.position.y -= box2.min.y - (cfg.yOff || 0);
    if(cfg.recolor === 'wbr') recolorWBR(obj);   // zivile weiß-blau-rot Lackierung
    const wrap = new THREE.Group(); wrap.add(obj);
    glbTemplates[name] = wrap;
    if(MODEL_NAMES[currentModel] === name) buildModel(name);  // sofort ersetzen wenn aktiv
    // Die Inseln neu bauen, damit das Modell auch auf den PARKPLAETZEN erscheint. Die GLBs laden
    // asynchron und liegen als base64 im Skript  wer schneller auf einer Insel ist als der Airbus
    // geladen war, haette dort sonst dauerhaft eine Luecke im Vorfeld.
    if(PARK_MODELS.indexOf(name) >= 0) refreshIslands();
  }, (err)=>{ console.warn(name+'-GLB Ladefehler:', err); });
}
// Weiß-Blau-Rot in Höhenzonen: obere Hälfte weiß, schmaler roter Streifen, untere Hälfte blau.
// Ersetzt Textur durch Vertex-Farben (getrennte Materialinstanz je Mesh).
function recolorWBR(root){
  root.updateMatrixWorld(true);                   // Weltmatrizen sicher aktuell
  const box = new THREE.Box3().setFromObject(root);
  const yMin = box.min.y, h = Math.max(0.001, box.max.y - yMin);
  const white = new THREE.Color(0xf2f2f2), blue = new THREE.Color(0x1e50c8), red = new THREE.Color(0xcc2222);
  const v = new THREE.Vector3();
  root.traverse(o=>{
    if(!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const g = o.geometry, pos = g.attributes.position;
    const cols = new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);   // in Weltkoordinaten
      const f = (v.y - yMin) / h;                                  // 0 unten .. 1 oben
      const c = f > 0.55 ? white : (f > 0.42 ? red : blue);
      cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    o.material = new THREE.MeshLambertMaterial({ vertexColors:true });
  });
}
function preloadAllGLB(){ Object.keys(GLB_CONFIG).forEach(preloadGLB); }

// Feuerwehrboot-GLB (by gogiart) separat laden — kein fliegbares Modell.
let boatTemplate = null;
function preloadBoat(){
  if(!window.BOAT_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.BOAT_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(16 / Math.max(size.x, size.z));   // ~16 m lang
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    const wrap = new THREE.Group(); wrap.add(obj);
    boatTemplate = wrap;
    // Steuert man beim Laden schon das Boot, das Behelfs-Boot sofort gegen das echte tauschen
    // (analog preloadGLB bei den Flugzeugen).
    if(MODEL_NAMES[currentModel] === 'Boat') buildModel('Boat');
    // Und die Inseln neu bauen: an jedem Strand liegt ein Feuerwehrboot, und wer schneller auf einer
    // Insel ist als dieses 30-MB-GLB geladen war, haette dort sonst dauerhaft das Behelfs-Boot
    // (Zylinder mit Kegel) liegen. Dasselbe macht preloadGLB fuer die Flugzeuge auf dem Vorfeld.
    refreshIslands();
  }, (err)=>{ console.warn('Boot-GLB Ladefehler:', err); });
}

// Feuerwehrauto-GLB (Mercedes Atego by Aeroux Games 3D) separat laden.
let truckTemplate = null;
function preloadTruck(){
  if(!window.FIRETRUCK_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.FIRETRUCK_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(12 / Math.max(size.x, size.z));   // ~12 m lang
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    const wrap = new THREE.Group(); wrap.add(obj);
    truckTemplate = wrap;
  }, (err)=>{ console.warn('Auto-GLB Ladefehler:', err); });
}

// ---------- Astronaut (by LasquetiSpice) ----------
// Zwei Rollen: er hängt beim Absturz am Fallschirm (Spieler UND KI), und man kann mit ihm nach der
// Landung aussteigen und herumlaufen. Höhe wird auf ASTRONAUT_H normiert, die Füße auf y = 0 gesetzt,
// damit er sauber auf dem Boden steht. Die Vorlage zeigt mit dem Gesicht auf +Z; im Spiel schaut die
// Nase auf -Z, deshalb dreht makeAstronaut() ihn um 180°.
const ASTRONAUT_H = 1.9;         // Körperhöhe in Metern (Erwachsener im Raumanzug)
let astronautTemplate = null;
function preloadAstronaut(){
  if(!window.ASTRONAUT_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.ASTRONAUT_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    // Auf Körperhöhe normieren (y ist die Körperachse — ausgemessen: 3,08 roh)
    obj.scale.setScalar(ASTRONAUT_H / Math.max(0.001, size.y));
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z;    // X/Z zentrieren
    obj.position.y -= box2.min.y;                    // Füße auf y = 0
    const wrap = new THREE.Group(); wrap.add(obj);
    astronautTemplate = wrap;
  }, (err)=>{ console.warn('Astronaut-GLB Ladefehler:', err); });
}
// Baut eine Astronauten-Figur. Ohne geladenes GLB einen schlichten Ersatz, damit nie nichts da ist.
function makeAstronaut(){
  const g = new THREE.Group();
  if(astronautTemplate){
    const a = astronautTemplate.clone(true);
    a.rotation.y = Math.PI;      // Gesicht auf -Z drehen (wie die Flugzeugnasen)
    g.add(a);
    return g;
  }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.26,1.25,10), pilotMat);
  body.position.y = 0.62; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32,12,10), pilotMat);
  head.position.y = 1.55; g.add(head);
  return g;
}

// ---------- Schlauchboot (by Mike0916) ----------
// Rettungsboot fuer alles, was sonst im Wasser landen wuerde: der Astronaut zu Fuss und jeder
// Fallschirmspringer. Der Astronaut STEHT darin — sitzen kann er nicht, seine Pose ist beim
// Verkleinern fest in die Geometrie gebacken (skins: 0). Stehend passt es auch besser: das Boot ist
// nur 2,35 m lang und er 1,9 m hoch, sitzend verschwaende er hinter dem Wulst.
// Ausgemessen am Rohmodell: 2,35 lang (Z), 1,39 breit, 1,08 hoch. Bug auf +Z (die Breite laeuft
// dorthin auf 0,90 zusammen), Motor/Heck auf -Z (dort sitzt der hoechste Punkt, y=1,52).
// Der Innenboden liegt bei 24 % der Modellhoehe ueber dem Kiel — dort stehen die Figuren.
const DINGHY_LEN   = 4.2;    // Laenge im Spiel (m). Deutlich groesser als das reale 2,35-m-Modell:
                             // ein 1,9 m hoher Astronaut in einem 2,35-m-Boot sieht aus wie ein
                             // Riese in einer Badewanne. 4,2 m ist ein glaubwuerdiges Beiboot.
const DINGHY_FLOOR = 0.24;   // Anteil der Modellhoehe, auf dem der Innenboden liegt (ausgemessen)
// Tiefgang: um so viel liegt der Kiel UNTER der Wasserlinie. Mit 0,18 m schaute der Aussenborder
// heraus — genau derselbe Fehler wie beim Feuerwehrboot. Ausgemessen am normierten Modell (4,20 m
// lang, 1,93 hoch): der Antrieb an der Heck-Mittellinie reicht bis y = 0,10 ueber dem Kiel
// hinunter, der Innenboden liegt bei 0,46 und die Oberkante des Schlauchwulstes bei 1,31.
// Damit ist das brauchbare Fenster 0,10 (Antrieb gerade nass) bis 0,46 (Boden gerade trocken) —
// 0,55 hatte den Innenboden um 9 cm absaufen lassen, der Astronaut haette im Wasser gestanden.
// 0,32 war rechnerisch richtig, sah aber falsch aus: das Boot schwamm sichtbar obenauf, weil der
// 1,93 m hohe Schlauchwulst 1,61 m aus dem Wasser ragte. Ein Schlauchboot liegt tiefer IM Wasser.
// 0,42 lässt den Innenboden noch 4 cm trocken (er liegt bei 0,462 — gemessen) und versenkt den
// Antrieb 0,31 m. Mehr geht nicht: bei 0,46 stünde der Astronaut im Wasser.
// Das Nicken hebt das Heck nur um 0,14 m (stärkste Wellenneigung über 4,2 m Bootslänge, davon
// DINGHY_BOB), der Antrieb bleibt also auch im Wellenberg unter Wasser.
const DINGHY_DRAFT = 0.42;
// Tiefgang des Canadair als FLUGBOOT. Vorher sass es beim Aufsetzen starr auf der Nulllinie
// (surfaceY gibt ueber Wasser 0), waehrend die Duenung ringsum bis +2,94 m stieg (gemessen ueber
// 60 s an der Stelle des Fliegers). Der Rumpf des Modells ist nur rund 3,3 m hoch — die Welle
// deckte ihn also zu 89 % zu, wie gemeldet. Mit einem festen yOff war das nicht zu heilen: im
// Wellenberg schlaegt sie genauso darueber, im Tal schwebte es. Es muss also MITSCHWIMMEN.
// 0,55 m: der echte CL-215 hat 0,9 m Tiefgang bei 28,60 m Spannweite, im Modellmassstab
// (18,50 m) sind das 0,58 m — abgerundet, damit die Schwimmerlinie unter Wasser liegt.
const CANADAIR_DRAFT = 0.55;
let dinghyTemplate = null, dinghyFloorY = 0;
function preloadDinghy(){
  if(!window.DINGHY_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.DINGHY_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    // Auf DINGHY_LEN normieren. Die Laenge liegt auf Z (ausgemessen), aber sicherheitshalber die
    // groessere der beiden waagerechten Achsen nehmen — so bricht es nicht, wenn das Modell
    // einmal getauscht wird.
    const longest = Math.max(size.x, size.z);
    obj.scale.setScalar(DINGHY_LEN / Math.max(0.001, longest));
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z;     // X/Z zentrieren
    obj.position.y -= box2.min.y;                     // Kiel auf y = 0
    const box3 = new THREE.Box3().setFromObject(obj);
    dinghyFloorY = box3.max.y * DINGHY_FLOOR;         // Innenboden ueber dem Kiel
    const wrap = new THREE.Group(); wrap.add(obj);
    dinghyTemplate = wrap;
  }, (err)=>{ console.warn('Schlauchboot-GLB Ladefehler:', err); });
}
// Baut ein Schlauchboot. Der Ursprung liegt am KIEL, damit es wie das Feuerwehrboot auf die
// Wasserlinie gesetzt werden kann. Ohne geladenes GLB ein schlichter Ersatz — es darf nie passieren,
// dass jemand im Wasser steht, weil ein Modell fehlt.
const dinghyMat = new THREE.MeshLambertMaterial({ color:0x2a2a30 });
function makeDinghy(){
  const g = new THREE.Group();
  if(dinghyTemplate){
    // Das Modell zeigt mit dem Bug auf +Z, im Spiel zeigen alle Nasen auf -Z -> 180 Grad drehen.
    const d = dinghyTemplate.clone(true);
    d.rotation.y = Math.PI;
    g.add(d);
    g.userData.floorY = dinghyFloorY;
    return g;
  }
  const hull = new THREE.Mesh(new THREE.TorusGeometry(DINGHY_LEN*0.42, 0.22, 8, 16), dinghyMat);
  hull.rotation.x = -Math.PI/2; hull.position.y = 0.25; g.add(hull);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(DINGHY_LEN*0.36, 14), dinghyMat);
  floor.rotation.x = -Math.PI/2; floor.position.y = 0.18; g.add(floor);
  g.userData.floorY = 0.2;
  return g;
}

// ---------- Fallschirm 2 (by TopNotch Assets) ----------
// Ersetzt den früheren Schirm überall: an den Transall-Kisten UND über dem Piloten. Vorher war das
// ein GLB für die Kisten und ein selbstgebauter Halbkugel-Schirm für den Piloten — jetzt sieht
// beides gleich aus. Auf 7 m Durchmesser normiert (Rohmaß 7,14 x 6,36 x 3,54 ausgemessen), Kappe
// nach oben: der Ursprung liegt UNTEN an den Leinen, damit die Last direkt darunter hängt.
const CHUTE2_SPAN = 7;
let chute2Template = null;
function preloadChute2(){
  if(!window.CHUTE2_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.CHUTE2_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(CHUTE2_SPAN / Math.max(size.x, size.z));
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z;
    obj.position.y -= box2.min.y;            // Unterkante (Leinen) auf y = 0
    const wrap = new THREE.Group(); wrap.add(obj);
    chute2Template = wrap;
  }, (err)=>{ console.warn('Chute2-GLB Ladefehler:', err); });
}

// Fallschirm-GLB (by stroodledoodle) laden — Reserve, seit chute2 beide Rollen übernimmt.
let parachuteTemplate = null;
function preloadParachute(){
  if(!window.PARACHUTE_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.PARACHUTE_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(8 / Math.max(size.x, size.y, size.z));   // ~8 m groß
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.sub(c);           // zentrieren
    const wrap = new THREE.Group(); wrap.add(obj);
    parachuteTemplate = wrap;
  }, (err)=>{ console.warn('Parachute-GLB Ladefehler:', err); });
}

// Flugzeugträger-GLB (Gerald R. Ford by Usman Zia) — schwimmende Landebahn auf dem Meer.
// Tiefgang als ANTEIL der Rumpfhoehe, nicht als feste Meterzahl. Die echte Gerald R. Ford zieht 12 m
// und ihr Flugdeck liegt rund 20 m ueber Wasser — der Rumpf ist also 32 m hoch, davon 37,5 % unter
// Wasser. Das GLB-Modell ist flacher gebaut: bis zum Deck sind es ausgemessen 23,39 m, wo die reine
// Laengenskalierung 26,6 m erwarten liesse. Mit festen 10 m (dem skalierten Tiefgang) laege das Deck
// deshalb nur 13,4 m ueber Wasser statt der skalierten 16,6 — zu tief. Der Anteil haelt stattdessen die
// Proportionen DES MODELLS: 8,8 m Tiefgang, Deck 14,6 m ueber Wasser.
//
// Der zweite Messweg (Rumpfbreite je Hoehenscheibe, siehe preloadFord) deutet auf 11,7 m — er ist mit
// Scheiben von 2 % der Hoehe aber grob, und er misst die Breite des ausgestellten Flugdecks mit. Wo
// zwei Messungen auseinandergehen, zaehlt die, die das Modell selbst beschreibt.
const FORD_DRAFT_FRAC = 0.375;
let FORD_DRAFT = 10;              // in preloadFord aus der gemessenen Rumpfhoehe gesetzt
let fordTemplate = null, fordDeckY = 12;   // Deckhöhe über Wasser (nach Normierung gesetzt)
let fordTower = null;   // vermessener Turm/Aufbau (lokale Box) -> exakte Kollision statt Schätzung
// Deck-/Rumpf-Halbbreite werden aus dem echten GLB vermessen (Default = Schätzung, bis geladen).
// Das echte Ford-Deck ist ~35 m halbbreit, nicht 19 -> sonst Turm/Rand durchlässig & Landung zu schmal.
let fordDeckHalfX = FORD_DECK_HALF_X;       // landbares Deck (X')
let fordHullHalfX = FORD_DECK_HALF_X + 4;   // Rumpf/Kollision (etwas breiter als Deck)
function preloadFord(){
  if(!window.FORD_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.FORD_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(FORD_LEN / Math.max(size.x, size.z));   // ~330 m langer Träger
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    // Erst die Unterkante auf y = 0 — der Tiefgang kommt weiter unten dazu, wenn die Rumpfhoehe aus
    // dem Deck-Raycast bekannt ist (er ist ein Anteil davon, siehe FORD_DRAFT_FRAC).
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    const box3 = new THREE.Box3().setFromObject(obj);
    // Flugdeck-Höhe EXAKT per Raycast: von oben auf mehrere Punkte der Deck-Mittellinie schießen
    // (dort ist kein Aufbau/Mast -> trifft das ebene Flugdeck). Median der Treffer = Deckhöhe.
    obj.updateMatrixWorld(true);
    const ys=[];
    for(const fz of [-0.25,-0.1,0.1,0.25,0.35]){
      const ray = new THREE.Raycaster(new THREE.Vector3(0, box3.max.y+50, FORD_LEN*fz),
                                      new THREE.Vector3(0,-1,0));
      const hits = ray.intersectObject(obj, true);
      if(hits.length) ys.push(hits[0].point.y);
    }
    ys.sort((a,b)=>a-b);
    const deckUeberKiel = ys.length ? ys[Math.floor(ys.length/2)] : box3.max.y * FORD_DECK_FRAC;
    // JETZT eintauchen: der Traeger soll IM Wasser liegen, nicht darauf. Vorher stand der Kiel genau
    // auf der Wasserlinie und das ganze Schiff darueber — gemeldet als „der carrier sitzt nicht
    // richtig im wasser, sondern auf dem wasser".
    //
    // Der Tiefgang ist ein Anteil der gemessenen Rumpfhoehe (siehe FORD_DRAFT_FRAC): 37,5 % von den
    // 23,4 m bis zum Deck, also rund 8,8 m. Das Deck liegt danach bei rund 14,6 m ueber Wasser.
    FORD_DRAFT = deckUeberKiel * FORD_DRAFT_FRAC;
    obj.position.y -= FORD_DRAFT;
    obj.updateMatrixWorld(true);
    // fordDeckY ist ab hier die Hoehe des Decks UEBER WASSER — genau das, was alle anderen Stellen
    // erwarten: Landen und Starten, das Aufsetzfenster (rtAltCarrier), die KI-Anflughoehe, Bordwand-
    // und Turmkollision, beide Schatten, die Fallschirme, der Astronaut auf dem Deck und die
    // geparkten Flugzeuge. Keine davon rechnet die Deckhoehe selbst aus, sie folgen also von allein.
    fordDeckY = deckUeberKiel - FORD_DRAFT;
    // Echte Deck-/Rumpfbreite aus der Bounding-Box übernehmen (das Ford-Deck ist ~35 m halbbreit,
    // nicht die geschätzten 19). Damit landet man auf dem GANZEN sichtbaren Deck und Turm/Ränder
    // sind über die volle Breite kollidierbar. Länge (Z) stimmte bereits mit FORD_LEN/2 überein.
    fordDeckHalfX = Math.max(Math.abs(box3.min.x), Math.abs(box3.max.x));
    fordHullHalfX = fordDeckHalfX + 2;
    // Turm/Aufbau ("Insel") des echten Modells robust vermessen: Deck mit einem Raster von oben
    // abtasten (über die VOLLE Breite!) und Trefferhöhen speichern. Dann vom HÖCHSTEN Punkt
    // (Turmspitze/Mast) aus nur über ZUSAMMENHÄNGENDE, deutlich erhöhte Zellen "wachsen"
    // (Region-Growing). So bleibt die Box eng um den seitlichen Aufbau; niedrige Reling/Kanten
    // entlang der Schiffslänge zählen NICHT mit -> Bounding-Box reicht nicht in die Landebahn-Mitte.
    const HHX = fordDeckHalfX + 2, STEP = 3;
    const cells = new Map();   // "ix,iz" -> {gx,gz,y};  peak = höchste Zelle
    let peak = null;
    for(let ix=0, gx=-HHX; gx<=HHX; gx+=STEP, ix++){
      for(let iz=0, gz=-FORD_LEN*0.5; gz<=FORD_LEN*0.5; gz+=STEP, iz++){
        const rc = new THREE.Raycaster(new THREE.Vector3(gx, box3.max.y+50, gz), new THREE.Vector3(0,-1,0));
        const hh = rc.intersectObject(obj, true);
        if(hh.length){
          const cell = { gx, gz, y:hh[0].point.y };
          cells.set(ix+','+iz, cell);
          if(!peak || cell.y > peak.y) peak = { ix, iz, y:cell.y };
        }
      }
    }
    fordTower = null;
    if(peak && peak.y > fordDeckY + 8){
      const hiThresh = fordDeckY + 8;   // Reling/Catwalks (~1-2 m) fallen weg, Aufbau (>>8 m) bleibt
      const seen = new Set(), stack = [[peak.ix, peak.iz]];
      let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9,top=-1e9,cnt=0;
      while(stack.length){
        const [ix,iz] = stack.pop(), key = ix+','+iz;
        if(seen.has(key)) continue; seen.add(key);
        const c = cells.get(key);
        if(!c || c.y < hiThresh) continue;         // Lücke -> Wachstum stoppt hier
        cnt++;
        minX=Math.min(minX,c.gx); maxX=Math.max(maxX,c.gx);
        minZ=Math.min(minZ,c.gz); maxZ=Math.max(maxZ,c.gz); top=Math.max(top,c.y);
        for(let dix=-1;dix<=1;dix++)for(let diz=-1;diz<=1;diz++)
          if(dix||diz) stack.push([ix+dix, iz+diz]);
      }
      if(cnt >= 4) fordTower = { minX, maxX, minZ, maxZ, top };
    }
    const wrap = new THREE.Group(); wrap.add(obj);
    fordTemplate = wrap;
    refreshCarriers();   // bereits platzierte Platzhalter durch echtes Modell ersetzen
    placeAtStart(MODEL_NAMES[currentModel]);   // Flieger neu aufs echte Deck setzen (Höhe korrekt)
  }, (err)=>{ console.warn('Ford-GLB Ladefehler:', err); });
}

// Hafen-GLB (Low Poly Mini Harbor by IndiNest.io) — an jeder Insel ein Hafen.
let harborTemplate = null, harborHeight = 8;   // echte Hafenhöhe (flach); Default bis GLB geladen
function preloadHarbor(){
  if(!window.HARBOR_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.HARBOR_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(HARBOR_SIZE / Math.max(size.x, size.z));
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    const box3 = new THREE.Box3().setFromObject(obj);
    harborHeight = box3.max.y;   // echte Hafenhöhe (flach) -> Kollisionsobergrenze, drüber frei
    const wrap = new THREE.Group(); wrap.add(obj);
    harborTemplate = wrap;
    refreshIslands();   // bereits gebaute Inseln neu bauen -> alle bekommen jetzt einen Hafen
  }, (err)=>{ console.warn('Harbor-GLB Ladefehler:', err); });
}

// Rakete und Startrampe für die Inseln. Beide werden aufrecht gebraucht (Y ist die Längsachse,
// Fuß auf y = 0), deshalb ein eigener Ladeweg neben dem der Raumschiffe: die legen ihre Modelle
// in die Waagerechte, weil sie durchs Weltall fliegen. Dieselbe Rakete kommt dort separat noch
// einmal vor (SHIP_DEFS, Eintrag 'rocket'), damit man ihr im Orbit wieder begegnet.
let rocketTemplate = null, padTemplate = null;
function preloadRocketPad(){
  if(!THREE.GLTFLoader) return;
  const jobs = [
    { data: window.ROCKET_GLB, ziel:'rocket' },
    { data: window.PAD_GLB,    ziel:'pad'    },
  ];
  for(const j of jobs){
    if(!j.data) continue;
    const gl = new THREE.GLTFLoader();
    const b64 = j.data.split(',')[1];
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    gl.parse(bytes.buffer, '', (gltf)=>{
      const obj = gltf.scene;
      obj.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(obj);
      const c = new THREE.Vector3(); box.getCenter(c);
      // waagerecht zentrieren und den Fuß auf y = 0 setzen. Die Rampe ist gemessen 0,51 m über
      // dem Ursprung modelliert — ohne das Absenken schwebte sie sichtbar über dem Gras.
      obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
      const wrap = new THREE.Group(); wrap.add(obj);
      if(j.ziel === 'rocket') rocketTemplate = wrap; else padTemplate = wrap;
      refreshIslands();   // schon gebaute Inseln neu bauen -> sie bekommen ihre Rakete sofort
    }, (err)=>{ console.warn('Rakete/Rampe-GLB Ladefehler (' + j.ziel + '):', err); });
  }
}

// ---------- Geparkte Flugzeuge auf dem Vorfeld ----------
// Die Flugmodelle stecken in modelHolder und werden bewegt  fuer den Parkplatz braucht es Kopien,
// die stehen bleiben. Dieselbe Ueberlegung wie beim geparkten X-Wing (preloadXwingPark), nur fuer
// alle Modelle: geklont wird aus glbTemplates, sobald die geladen sind.
// Welche Flugzeuge auf dem Vorfeld stehen: ALLE sechs. Nur das Boot faellt weg, das faehrt im
// Wasser und steht am Hafen. Der X-Wing war zuerst draussen, weil er schon als einzelner geparkter
// Flieger auf der Wiese steht — aber wer sich ein Flugzeug aussuchen will, will auch ihn dort
// sehen, und ohne ihn sah das Vorfeld unvollstaendig aus.
const PARK_MODELS = ['XWing', 'Canadair', 'AlphaJet', 'Airbus', 'Transall', 'Mustang'];
// Ein geparktes Flugzeug bauen: wie buildModel, aber als eigenstaendige Kopie zum Hinstellen.
// Die Drehung je Modell muss dieselbe sein wie dort, sonst stehen sie quer zur Nase.
const PARK_GLB_ROT = { Canadair: Math.PI, AlphaJet: Math.PI/2, Airbus: Math.PI,
                       Mustang: -Math.PI, Transall: 0, XWing: Math.PI };
function makeParkedPlane(name){
  const tpl = glbTemplates[name];
  if(!tpl) return null;                      // noch nicht geladen  beim naechsten Bauen wieder da
  const m = tpl.clone(true);
  m.rotation.y = PARK_GLB_ROT[name] || 0;
  const g = new THREE.Group(); g.add(m);
  return g;
}
// Stellplaetze eines Parkplatzes: zwei Reihen, Nasen zur Mitte, im PARK_SLOT-Raster entlang Z.
// Ausgemessen im Browser (C:/tmp/mess_modelle.js): das groesste Flugzeug ist der Airbus mit 27,1 m
// Spannweite und 24,93 m Laenge  bei 34 m Raster bleiben also 6,9 m Luft zum Nachbarn, und die
// beiden Reihen liegen 35 m auseinander (Nasen 10 m voneinander entfernt).
function parkSlots(cx, cz){
  const pk = parkLocal(cx, cz);
  if(!pk) return [];
  const out = [];
  const rowW = pk.wid / PARK_ROWS;                 // 35 m je Reihe
  const n = Math.floor(pk.len / PARK_SLOT);        // Plaetze je Reihe
  const z0 = -(n-1) * PARK_SLOT / 2;               // mittig verteilen
  for(let r = 0; r < PARK_ROWS; r++){
    const rx = pk.xa + rowW*(r + 0.5);             // Reihenmitte in X
    // Reihe 0 (naeher an der Bahn) schaut nach -Z, Reihe 1 nach +Z: die Nasen zeigen zueinander,
    // so sieht es aus wie ein echtes Vorfeld und nicht wie eine Warteschlange.
    const yaw = (r === 0) ? 0 : Math.PI;
    for(let i = 0; i < n; i++) out.push({ x:rx, z:z0 + i*PARK_SLOT, yaw, row:r, idx:i });
  }
  return out;
}
// Welches Modell steht auf welchem Platz? Deterministisch aus der Zelle: dieselbe Insel zeigt
// beim Wiederbetreten dieselbe Aufstellung. Alle PARK_MODELS kommen mindestens einmal vor 
// darum geht es ja: man soll sich eines aussuchen koennen.
function parkPlaneAt(cx, cz, slotIdx, slotCount){
  const k = PARK_MODELS.length;
  // Die ersten k Plaetze bekommen je ein anderes Modell (durchgemischt per Startversatz), danach
  // wiederholt sich die Reihe. So ist jedes Modell garantiert da, auch wenn nur 5 Plaetze frei sind.
  const off = Math.floor(cellRnd(cx, cz, 905) * k);
  return PARK_MODELS[(slotIdx + off) % k];
}
// Der geparkte X-Wing auf den Inseln. Eigenes Template, obwohl der X-Wing als FLUGmodell schon
// geladen wird (buildModel): jenes steckt in modelHolder und wird bewegt, hier braucht es Kopien,
// die auf den Inseln stehen bleiben.
let xwingParkTpl = null;
function preloadXwingPark(){
  if(!window.XWING_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.XWING_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    // auf 12,5 m Spannweite bringen (wie das Flugmodell) und den Fuss auf y = 0 setzen
    obj.scale.setScalar(12.5 / Math.max(size.x, size.z));
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box2.getCenter(c);
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    const wrap = new THREE.Group(); wrap.add(obj);
    xwingParkTpl = wrap;
    refreshIslands();   // schon gebaute Inseln bekommen ihren X-Wing sofort
  }, (err)=>{ console.warn('X-Wing-Park-GLB Ladefehler:', err); });
}
// Steht man neben dem geparkten X-Wing? Geprueft werden die Zellen um den Astronauten herum.
// Nicht wenn man selbst gerade den X-Wing fliegt — dann steht dort naemlich keiner (siehe
// buildIsland), und man wuerde in sein eigenes Flugzeug umsteigen wollen.
function xwingParkNear(){
  if(!eva || eva.rover || eva.boat) return false;
  if(locale !== 'earth') return false;
  if(MODEL_NAMES[currentModel] === 'XWing') return false;
  const p = eva.group.position;
  const pcx = Math.round(p.x / CELL), pcz = Math.round(p.z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const xl = xwingLocal(pcx+dx, pcz+dz); if(!xl) continue;
    if(Math.hypot(p.x - (info.wx + xl.x), p.z - (info.wz + xl.z)) < EVA_BOARD_R + XWP_R)
      return true;
  }
  return false;
}
// ---- In ein geparktes Flugzeug auf dem Vorfeld einsteigen -------------------------------
// Genau der Zweck des Parkplatzes: hingehen, sehen was dort steht, einsteigen. Gebaut nach dem
// Vorbild von xwingParkNear/evaBoardXwing  nur dass hier fuenf verschiedene Modelle stehen und
// deshalb mitgegeben werden muss, WELCHES gemeint ist.
const PARK_BOARD_R = 14;   // so nah an einem Stellplatz wird B zum Einsteigen (Airbus ist 25 m lang)
// Das naechstgelegene geparkte Flugzeug in Reichweite: { name, x, z } oder null.
function parkPlaneNear(){
  if(!eva || eva.rover || eva.boat || eva.jet) return null;
  if(locale !== 'earth') return null;
  const p = eva.group.position;
  const pcx = Math.round(p.x / CELL), pcz = Math.round(p.z / CELL);
  let best = null, bd = Infinity;
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const cx = pcx+dx, cz = pcz+dz;
    const info = islandInfo(cx, cz); if(!info) continue;
    const pk = parkLocal(cx, cz); if(!pk) continue;
    const nRow = Math.max(1, Math.floor(pk.len / PARK_SLOT));
    for(const s of parkSlots(cx, cz)){
      const wx = info.wx + s.x, wz = info.wz + s.z;
      const d = Math.hypot(p.x - wx, p.z - wz);
      if(d < PARK_BOARD_R && d < bd){
        const nm = parkPlaneAt(cx, cz, s.row * nRow + s.idx, 0);
        // Der Platz des eigenen Modells ist leer (siehe buildIsland) — dort gibt es nichts
        // einzusteigen, sonst stiege man in ein unsichtbares Flugzeug ein. Dieselbe Ausnahme wie
        // dort: der X-Wing steht immer da, also kann man dort auch immer einsteigen.
        if(nm === MODEL_NAMES[currentModel] && nm !== 'XWing') continue;
        bd = d;
        best = { name: nm, x:wx, z:wz, dist:d, cx, cz };
      }
    }
  }
  return best;
}
// Einsteigen und auf der LANDEBAHN starten  wie beim geparkten X-Wing (evaBoardXwing) und aus
// demselben Grund: vom Stellplatz zwischen anderen Flugzeugen wegzurollen waere muehsam, und
// placeAtStart setzt Bahnanfang, Nase und Kamera schon richtig. Bewusst NICHT cycleModel: das
// zaehlt die Modelle durch und schickt den X-Wing in den Todesstern-Hangar.
// cx,cz ist die Zelle des Vorfelds: dorthin gehoert der Start, nicht irgendwohin.
function evaBoardParked(name, cx, cz){
  const idx = MODEL_NAMES.indexOf(name);
  if(idx < 0) return;
  const info = islandInfo(cx, cz);
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = MODEL_NAMES[idx];
  buildModel(MODEL_NAMES[idx]);
  spec = PLANE_SPECS[MODEL_NAMES[idx]] || DEFAULT_SPEC;
  // placeAtStart raeumt alles auf (Fallschirm, Rettung, Absturzflags, Kamera) und setzt danach die
  // MODELLTYPISCHE Startposition: AlphaJet und Mustang aufs Traegerdeck, die Canadair ins Wasser
  // neben den Hafen, den Airbus in eine Stadt. Das ist beim Modellwechsel per M richtig, hier aber
  // falsch: man steht auf DIESER Insel neben dem Flugzeug und soll auf DEREN Bahn starten  sonst
  // wird man beim Einsteigen ueber Kilometer woandershin versetzt. Gemessen: von 10 Stellplaetzen
  // landeten 6 nicht auf einer Landebahn. Also erst aufraeumen lassen, dann umsetzen.
  placeAtStart(MODEL_NAMES[idx]);
  if(info){
    const rwLen = Math.min(260, info.radius * 1.4);      // wie in buildIsland
    // Ans +Z-Ende der Bahn, Nase (-Z bei yaw = 0) laeuft die ganze Bahn entlang  dieselbe
    // Rechnung, die findStart fuer Transall und Airbus benutzt.
    state.pos.set(info.wx, ISLAND_Y, info.wz + rwLen*0.5 - 20);
    state.quat.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
    state.vel.set(0,0,0); state.throttle = 0; state.onGround = true;
    planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
    snapCamera();     // Kamera mitnehmen, sonst kriecht sie ueber die halbe Insel hinterher
  }
  // Inseln neu bauen: der Platz des neuen Modells wird leer, der des alten bekommt sein Flugzeug
  // zurueck. Ohne das stuende das gerade bestiegene Flugzeug noch auf seinem Stellplatz.
  refreshIslands();
  showBig('\u{2708}\u{FE0F}'); bigTimer = 1.2;
}
// ---------- Feuerwehrboot am Kai: einsteigen und zurueck ----------
// An jedem Hafen liegt ein Feuerwehrboot, zu dem man hinlaufen und mit Y einsteigen kann. Technisch
// ist es ein MODELLWECHSEL (das Boot ist ein eigenes Modell mit eigener Physik und dem Loeschstrahl,
// kein Sub-Modus wie der Rover) — aber der Platz des eigenen Fliegers wird gemerkt, damit man
// zurueckkommt. Fuer ein Kind fuehlt es sich wie Einsteigen an.
//
// Steht der Astronaut neben einem Kai-Boot? Gibt { cx, cz } der Inselzelle oder null.
function harborBoatNear(){
  if(!eva || eva.rover || eva.boat || eva.jet) return null;
  if(locale !== 'earth') return null;
  if(isWaterCraft()) return null;               // in einem Boot sitzt man schon
  const p = eva.group.position;
  const pcx = Math.round(p.x / CELL), pcz = Math.round(p.z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const bl = harborBoatLocal(pcx+dx, pcz+dz); if(!bl) continue;
    // 12 m: das Boot ist 16 m lang, man soll auch am Heck oder Bug einsteigen koennen.
    if(Math.hypot(p.x - (info.wx + bl.x), p.z - (info.wz + bl.z)) < 12)
      return { cx:pcx+dx, cz:pcz+dz };
  }
  return null;
}
// ---- U-Boot am Strand: einsteigen und zurueck --------------------------------------------------
// Wortgleich zu harborBoatNear/evaBoardHarborBoat, nur mit harborSubLocal und 'Sub'. Bewusst als
// Kopie und nicht als Verallgemeinerung: die beiden Fahrzeuge werden sich weiter auseinander
// entwickeln (das Boot loescht, das U-Boot taucht), und eine gemeinsame Funktion mit Fallunter-
// scheidungen waere schwerer zu lesen als zwei kurze.
//
// Steht der Astronaut neben dem Strand-U-Boot? Gibt { cx, cz } der Inselzelle oder null.
function harborSubNear(){
  if(!eva || eva.rover || eva.boat || eva.jet) return null;
  if(locale !== 'earth') return null;
  if(isSub()) return null;                      // im U-Boot sitzt man schon
  const p = eva.group.position;
  const pcx = Math.round(p.x / CELL), pcz = Math.round(p.z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const bl = harborSubLocal(pcx+dx, pcz+dz); if(!bl) continue;
    // 55 m: das Boot ist 95 m lang, man soll auch am Heck oder mittschiffs einsteigen koennen.
    // Beim 16-m-Feuerwehrboot sind es 12 m — dasselbe Verhaeltnis.
    if(Math.hypot(p.x - (info.wx + bl.x), p.z - (info.wz + bl.z)) < 55)
      return { cx:pcx+dx, cz:pcz+dz };
  }
  return null;
}
// ---- Umsteigen Schlauchboot <-> U-Boot ---------------------------------------------------------
// Der Weg, den ein Kind von selbst findet: aus dem U-Boot steigt man ins SCHLAUCHBOOT aus (nicht an
// den Strand), faehrt damit herum, und wer das U-Boot beruehrt, ist wieder drin. Damit gibt es das
// Wasserproblem gar nicht mehr — vorher musste der Astronaut an Land gesetzt werden, und weil das
// U-Boot 85 m vor der Sandkante haelt (95 m Rumpf, Liegeplatz weiter draussen als das
// Feuerwehrboot), stand er dabei im Wasser statt im Sand (gemessen: evaSolid false, Fusshoehe 0,00).
//
// Beruehrt wird der RUMPF, nicht ein Punkt: das Boot ist 95 m lang und 24 m breit, ein reiner
// Mittelpunktsabstand waere an Bug und Heck 47 m daneben. Gerechnet wird im Bootssystem — genau so,
// wie hitsSeaShip es fuer die fahrenden Schiffe macht.
const SUB_TOUCH_PAD = 6;     // m Puffer um den Rumpf: man muss nicht auf den Zentimeter treffen
// Beruehrt das Schlauchboot an (x,z) das Strand-U-Boot einer Insel? Gibt {cx,cz} oder null.
function dinghyTouchesHarborSub(x, z){
  if(locale !== 'earth') return null;
  // NICHT bei isSub() aussteigen — das war ein Fehler, und zwar der entscheidende: nach dem Ausstieg
  // ins Schlauchboot bleibt MODEL_NAMES weiter auf 'Sub' (das U-Boot ist das Fahrzeug, zu dem man
  // zurueckkehrt, genau wie der Flieger beim Aussteigen), und an seinem Strandplatz liegt keine
  // Kulisse, weil man ja darin sass. Mit der Sperre gab es also NIE einen Treffer: im laufenden Spiel
  // nachgemessen, nach 30 s Heranfahren kein Umstieg — man kam nicht zurueck.
  //
  // Zuerst deshalb das EIGENE U-Boot: eva.planeAt ist sein gemerkter Platz (dieselbe Groesse, mit der
  // evaCanBoard den Flieger wiederfindet). Es kann ueberall liegen, nicht nur am Strand.
  if(eva && eva.planeAt && isSub()){
    const kurs = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ').y;
    if(subHullNear(x, z, eva.planeAt.x, eva.planeAt.z, kurs)) return { eigen:true };
    return null;                                 // das eigene liegt woanders: keine Kulisse suchen
  }
  const pcx = Math.round(x / CELL), pcz = Math.round(z / CELL);
  for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
    const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
    const bl = harborSubLocal(pcx+dx, pcz+dz); if(!bl) continue;
    if(subHullNear(x, z, info.wx + bl.x, info.wz + bl.z, bl.rot)) return { cx:pcx+dx, cz:pcz+dz };
  }
  return null;
}
// Liegt (x,z) an der Huelle eines U-Boots, das mit (sx,sz) und Kurs rot liegt? Der Rumpf ist 95 m
// lang und 24 m breit — ein reiner Mittelpunktsabstand waere an Bug und Heck 47 m daneben, deshalb
// wird in das Bootssystem gedreht (lz laengs, lx quer), genau wie in hitsSeaShip.
function subHullNear(x, z, sx, sz, rot){
  const rx = x - sx, rz = z - sz;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const lx = rx*cs - rz*sn, lz = rx*sn + rz*cs;
  return Math.abs(lz) < SUB_LOOK + SUB_TOUCH_PAD && Math.abs(lx) < SUB_HALF_W + SUB_TOUCH_PAD;
}
// Vom Schlauchboot ins U-Boot umsteigen. Das Schlauchboot verschwindet dabei — ein leeres Boot neben
// dem U-Boot liegen zu lassen sieht aus wie ein Fehler, und beim naechsten Ausstieg gibt es sowieso
// ein neues. Dieselbe Begruendung, mit der evaLeaveDinghy es an Land entfernt.
function dinghyBoardSub(treffer){
  if(!eva || !eva.boat) return;
  scene.remove(eva.boat);
  eva.boat = null; eva.boatVel = null; eva.boatThr = 0;
  if(treffer.eigen){
    // Das EIGENE U-Boot: es steht schon da, mit seiner Lage und seinem Kurs. Also nur den
    // Astronauten entfernen — genau was evaBoard beim Flieger tut. Ein evaBoardHarborSub wuerde es
    // an einen Strandplatz VERSETZEN, und das waere ein Sprung.
    scene.remove(eva.group);
    eva = null;
    state.throttle = 0; state.vel.set(0, 0, 0);
    snapCamera();
    showBig('\u{1F6E5}\u{FE0F}'); bigTimer = 1.2;
    return;
  }
  evaBoardHarborSub(treffer.cx, treffer.cz);
}
// Aus dem U-Boot ins SCHLAUCHBOOT aussteigen — ueberall auf dem Wasser, ohne Strand.
// Warum nicht an Land: das U-Boot haelt 85 m vor der Sandkante (95 m Rumpf, Liegeplatz weiter
// draussen als das Feuerwehrboot), und ein Astronaut, den man dort absetzt, steht im Wasser statt
// im Sand — im laufenden Spiel gemessen. Das Schlauchboot ist die Antwort, die das Spiel an jeder
// anderen Wasserkante schon gibt: es faengt den Schritt auf, statt ihn zu verbieten.
// Das U-Boot bleibt liegen, wo es ist (eva.planeAt zeigt darauf) — man faehrt mit dem Schlauchboot
// heran und steigt bei Beruehrung wieder um, siehe dinghyTouchesHarborSub.
function evaExitToDinghy(){
  if(eva) return;
  const g = makeAstronaut();
  const eul = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  // Seitlich neben dem U-Boot ins Wasser, nicht mittendrin: sonst sitzt das Schlauchboot IM Rumpf
  // und dinghyTouchesHarborSub liesse einen sofort wieder einsteigen — ein Aussteigen, das nichts
  // tut. Quer versetzt um die halbe Rumpfbreite plus Puffer, dieselbe Huelle, die die Beruehrung
  // prueft (SUB_HALF_W + SUB_TOUCH_PAD).
  const seit = SUB_HALF_W + SUB_TOUCH_PAD + 4;
  const rx = Math.cos(eul.y), rz = -Math.sin(eul.y);      // quer zur Nasenrichtung
  const x = state.pos.x + rx*seit, z = state.pos.z + rz*seit;
  g.position.set(x, seaYAt(x, z), z);
  g.rotation.y = eul.y;
  scene.add(g);
  eva = { group:g, vy:0, onGround:true, yaw:eul.y,
          planeAt:new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z) };
  state.throttle = 0;
  // Und gleich ins Schlauchboot setzen. Nicht ueber evaEnterDinghy: das prueft nearHarborBoat und
  // wuerde am Kai gar nichts tun — hier ist das Boot ausdruecklich gewollt.
  const b = makeDinghy();
  b.position.set(x, seaYAt(x, z) - DINGHY_DRAFT, z);
  b.rotation.y = eul.y;
  scene.add(b);
  eva.boat = b;
  eva.boatVel = new THREE.Vector3(0, 0, 0);
  eva.boatThr = 0;
  eva.group.position.set(x, b.position.y + (b.userData.floorY || 0), z);
  // Solange gesetzt, zaehlt eine Beruehrung des U-Boots NICHT als Einsteigen (siehe updateDinghy):
  // das Schlauchboot liegt hier noch an seinem Rumpf, und ohne die Sperre saesse man sofort wieder
  // drin. Sie loest sich, sobald man ein Stueck weggefahren ist.
  eva.subLatch = true;
  jetSnapCam();      // Kamera auf den ASTRONAUTEN, nicht auf das U-Boot
  showBig('\u{1F6DF}'); bigTimer = 1.2;
}
function evaBoardHarborSub(cx, cz){
  const idx = MODEL_NAMES.indexOf('Sub');
  if(idx < 0) return;
  const info = islandInfo(cx, cz);
  const bl = harborSubLocal(cx, cz);
  if(!info || !bl) return;
  // Den Platz des eigenen Fliegers merken, BEVOR das Modell wechselt — wie beim Feuerwehrboot.
  // Es ist DASSELBE Merkfeld (harborBoatFrom): man sitzt immer nur in einem der beiden, und Y
  // fuehrt aus beiden auf denselben Weg zurueck.
  harborBoatFrom = { model: MODEL_NAMES[currentModel],
                     x: eva.planeAt.x, y: eva.planeAt.y, z: eva.planeAt.z,
                     yaw: new THREE.Euler().setFromQuaternion(state.quat, 'YXZ').y };
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = MODEL_NAMES[idx];
  buildModel(MODEL_NAMES[idx]);
  spec = PLANE_SPECS[MODEL_NAMES[idx]] || DEFAULT_SPEC;
  placeAtStart('Sub');
  // Aufgetaucht an seinem Strandplatz: y = 0 ist die Wasserlinie des Modells (siehe SUB_SURF_Y).
  state.pos.set(info.wx + bl.x, 0, info.wz + bl.z);
  state.quat.setFromEuler(new THREE.Euler(0, bl.rot, 0, 'YXZ'));
  state.vel.set(0,0,0); state.throttle = 0; state.onGround = true;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  snapCamera();      // Kamera mitnehmen, sonst kriecht sie ueber die halbe Insel hinterher
  refreshIslands();  // das Kulissen-U-Boot verschwindet: man sitzt jetzt darin
  showBig('\u{1F6E5}\u{FE0F}'); bigTimer = 1.2;
}
// Ein evaExitFromSub (zu Fuss an Land) gab es hier und ist ENTFALLEN: der Ausstieg aus dem U-Boot
// geht ins Schlauchboot (evaExitToDinghy). Grund war ein gemessener Fehler — das Boot haelt 85 m vor
// der Sandkante, ein dort abgesetzter Astronaut stand im Wasser.

function evaBoardHarborBoat(cx, cz){
  const idx = MODEL_NAMES.indexOf('Boat');
  if(idx < 0) return;
  const info = islandInfo(cx, cz);
  const bl = harborBoatLocal(cx, cz);
  if(!info || !bl) return;
  // Den Platz des eigenen Fliegers merken, BEVOR das Modell wechselt: eva.planeAt ist die Stelle, an
  // der er wartet (der Astronaut ist ja ausgestiegen).
  harborBoatFrom = { model: MODEL_NAMES[currentModel],
                     x: eva.planeAt.x, y: eva.planeAt.y, z: eva.planeAt.z,
                     yaw: new THREE.Euler().setFromQuaternion(state.quat, 'YXZ').y };
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = MODEL_NAMES[idx];
  buildModel(MODEL_NAMES[idx]);
  spec = PLANE_SPECS[MODEL_NAMES[idx]] || DEFAULT_SPEC;
  // placeAtStart raeumt auf (Fallschirm, Rettung, Absturzflags) und setzt dann die modelltypische
  // Startposition — die ist hier falsch, deshalb danach an den Kai umsetzen. Dasselbe Muster wie in
  // evaBoardParked.
  placeAtStart('Boat');
  state.pos.set(info.wx + bl.x, -BOAT_DRAFT, info.wz + bl.z);
  state.quat.setFromEuler(new THREE.Euler(0, bl.rot, 0, 'YXZ'));
  state.vel.set(0,0,0); state.throttle = 0; state.onGround = true;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  snapCamera();      // Kamera mitnehmen, sonst kriecht sie ueber die halbe Insel hinterher
  refreshIslands();  // das Kai-Boot verschwindet: man sitzt jetzt darin
  showBig('\u{1F692}'); bigTimer = 1.2;
}
// Zurueck zum eigenen Flieger. Er steht dort, wo man ihn gelassen hat — deshalb wurde der Platz beim
// Einsteigen gemerkt. Ohne das waere der Flieger nach einer Bootsfahrt unerreichbar.
// Aus dem Boot an Land gehen, OHNE gemerkten Flieger — also wenn man es ueber die Modellauswahl
// genommen hat. Das Boot bleibt liegen, wo es ist, und man steht zu Fuss davor. Weiterfliegen geht
// dann ueber ein geparktes Flugzeug auf dem Vorfeld oder ueber die Modellauswahl.
//
// eva.planeAt zeigt hier auf das BOOT: es ist das Fahrzeug, in dem man sass, und damit der Punkt, zu
// dem man zurueckkehrt (dieselbe Rolle wie der Flieger sonst). So kann man mit Y wieder einsteigen.
function evaExitFromBoat(x, z){
  if(eva) return;
  const g = makeAstronaut();
  const eul = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  g.position.set(x, evaFootY(x, z), z);
  g.rotation.y = eul.y;
  scene.add(g);
  eva = { group:g, vy:0, onGround:true, yaw:eul.y,
          planeAt:new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z) };
  state.throttle = 0;
  jetSnapCam();      // Kamera auf den ASTRONAUTEN, nicht auf das Boot
  showBig('\u{1F9D1}\u{200D}\u{1F680}'); bigTimer = 1.2;
}
// An Land aussteigen: man steht ZU FUSS am Strand, nicht ploetzlich wieder im Flieger. Der wartet
// dort, wo man ihn gelassen hat — man laeuft also zurueck und steigt mit Y ein, wie beim Rover.
//
// Vorher setzte diese Funktion einen direkt ins Flugzeug: „wenn man aus einem flugzeug aussteigt, in
// ein boot einsteigt, an land fährt und mit y aussteigt ist man wieder im flugzeug". Das ueberspringt
// den Weg und fuehlt sich wie Teleportieren an.
function leaveHarborBoat(){
  if(!harborBoatFrom) return;
  const f = harborBoatFrom;
  const idx = MODEL_NAMES.indexOf(f.model);
  if(idx < 0){ harborBoatFrom = null; return; }
  harborBoatFrom = null;
  // Wo der Astronaut hinsoll: AN LAND vor dem Bug — er soll im Sand stehen, nicht im Wasser. Das
  // Fahrzeug liegt ja selbst im Wasser, also ein Stueck voraus suchen, bis fester Grund kommt
  // (dieselbe Idee wie beim Schlauchboot-Ausstieg).
  //
  // Die REICHWEITE haengt am Fahrzeug, und das war ein Fehler: mit den festen BOAT_LOOK*3 = 24 m
  // stand man nach dem Ausstieg aus dem U-Boot IM WASSER (im laufenden Spiel gemessen: evaSolid
  // false, Fusshoehe 0,00 statt 0,30). 24 m passen fuers 16-m-Feuerwehrboot, das mit dem Heck im
  // Sand liegt — das U-Boot haelt 85 m vor der Sandkante (Liegeplatz weiter draussen, 95 m Rumpf).
  // Gefunden wurde nie etwas, und der Rueckfall ist die Bootsposition selbst.
  const bf = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const reich = isSub() ? SUB_UFER_R + 60 : BOAT_LOOK*3;
  const ab    = isSub() ? SUB_LOOK*0.6 : BOAT_LOOK;
  let ex = state.pos.x, ez = state.pos.z, gefunden = false;
  for(let s = ab; s <= reich; s += 2){
    const px = state.pos.x + bf.x*s, pz = state.pos.z + bf.z*s;
    if(evaSolid(px, pz)){ ex = px; ez = pz; gefunden = true; break; }
  }
  // Nichts voraus? Dann zur naechsten Insel hin suchen. Der Bug muss nicht genau auf den Strand
  // zeigen — man kann auch schraeg ankommen, und dann ist "vor dem Bug" die falsche Richtung.
  // Ohne diesen zweiten Weg stuende der Astronaut wieder im Wasser, nur seltener.
  if(!gefunden){
    const pcx = Math.round(state.pos.x / CELL), pcz = Math.round(state.pos.z / CELL);
    let best = null, bd = 1e9;
    for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
      const info = islandInfo(pcx+dx, pcz+dz); if(!info) continue;
      const d = Math.hypot(state.pos.x-info.wx, state.pos.z-info.wz);
      if(d < bd){ bd = d; best = info; }
    }
    if(best){
      const dx = best.wx - state.pos.x, dz = best.wz - state.pos.z;
      const L = Math.hypot(dx, dz) || 1;
      for(let s = 4; s <= L; s += 3){
        const px = state.pos.x + dx/L*s, pz = state.pos.z + dz/L*s;
        if(evaSolid(px, pz)){ ex = px; ez = pz; gefunden = true; break; }
      }
    }
  }
  // Zurueck auf das Modell, in dem man vorher sass — es steht ja an seinem gemerkten Platz.
  currentModel = idx;
  document.getElementById('mdl').textContent = MODEL_NAMES[idx];
  buildModel(MODEL_NAMES[idx]);
  spec = PLANE_SPECS[MODEL_NAMES[idx]] || DEFAULT_SPEC;
  placeAtStart(MODEL_NAMES[idx]);
  state.pos.set(f.x, f.y, f.z);
  state.quat.setFromEuler(new THREE.Euler(0, f.yaw, 0, 'YXZ'));
  state.vel.set(0,0,0); state.throttle = 0; state.onGround = true;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  // Und JETZT aussteigen: der Astronaut steht am Strand, der Flieger wartet an seinem Platz.
  // clearEva zuerst, damit kein alter Astronaut aus einer frueheren Runde stehen bleibt.
  clearEva();
  const g = makeAstronaut();
  const eul = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  g.position.set(ex, evaFootY(ex, ez), ez);
  g.rotation.y = eul.y;
  scene.add(g);
  eva = { group:g, vy:0, onGround:true, yaw:eul.y,
          planeAt:new THREE.Vector3(state.pos.x, state.pos.y, state.pos.z) };
  state.throttle = 0;
  refreshIslands();  // das Kai-Boot liegt wieder da (man faehrt es ja nicht mehr)
  jetSnapCam();      // Kamera auf den ASTRONAUTEN, nicht auf den Flieger
  // Derselbe Astronaut wie bei jedem anderen Ausstieg: Person + ZWJ + Rakete. Ohne die
  // ZWJ-Sequenz kommt nur die Person heraus, und das sah wie ein anderes Symbol aus.
  showBig('\u{1F9D1}\u{200D}\u{1F680}'); bigTimer = 1.2;
}
// In den geparkten X-Wing umsteigen. Er startet auf der LANDEBAHN, nicht am Parkplatz: von der
// Wiese zwischen Haeusern wegzurollen waere muehsam, und placeAtStart setzt ohnehin schon alles
// richtig (Bahnanfang, Nase entlang der Bahn, Kamera hart dahinter).
// Das ist bewusst NICHT cycleModel: das zaehlt die Modelle durch und wuerde ausserdem in den
// Todesstern-Hangar wechseln (der X-Wing gehoert dort hin, wenn man ihn per M waehlt). Hier steigt
// man auf einer Insel ein — da will niemand plotzlich im Todesstern sitzen.
function evaBoardXwing(){
  const idx = MODEL_NAMES.indexOf('XWing');
  if(idx < 0) return;
  clearEva();
  currentModel = idx;
  document.getElementById('mdl').textContent = MODEL_NAMES[idx];
  buildModel(MODEL_NAMES[idx]);
  spec = PLANE_SPECS[MODEL_NAMES[idx]] || DEFAULT_SPEC;
  placeAtStart(MODEL_NAMES[idx]);
  refreshIslands();    // der Parkplatz ist jetzt leer -> Inseln ohne geparkten X-Wing neu bauen
  showBig('\u2708\ufe0f'); bigTimer = 1.2;
}

// ============================================================
//  Weltraum: Übergang Himmel -> Weltall, Erdkugel, Mond
// ============================================================
// Ein einziger Zustand schaltet den Ort um:
//   'earth' = flache Inselwelt (Meer, Inseln, Träger, Verkehr, Wolken)
//   'space' = Weltall (schwarz, Sterne, Erdkugel unter einem, Mond in der Ferne)
//   'moon'  = Mondoberfläche (kachelnde Kraterlandschaft, kein Meer, keine Inseln)
//   'mars'  = Marsoberfläche (kachelnde Aram-Chaos-Landschaft)
//   'death' = Hangar im Todesstern (ein Innenraum statt einer Landschaft)
// Die x/z-Koordinaten laufen durch: die Inselwelt ist unendlich, man taucht also genau dort
// wieder ein, wo man absinkt — es braucht keine Rückrechnung auf den Startpunkt.
let locale = 'earth';
let wantHangarStart = true;   // beim Spielstart einmal in den Todesstern-Hangar wechseln
let hangarStartT = 1.5;       // erst so viele Sekunden nach dem Laden wechseln: beim App-Start
                              // laufen danach noch andere GLB-Callbacks, die die Position verschoben
// Höhengrenzen: unter 80 % Schub riegelt der Höhendeckel des Modells ab (X-Wing 3000 m). Ab 80 %
// ist der Deckel offen: ab 3000 m dunkelt der Himmel ein, bei 6000 m ist man im Weltall.
const ATMO_TOP  = 3000;     // ab hier wird der Himmel dunkler
const SPACE_Y   = 4000;     // ab hier ist man im Weltall (Übergang also 3000–4000 m)
// Rückweg zur Erde erst deutlich tiefer (Hysterese): sonst rutscht man beim Suchen nach Mond/Mars/
// Sonne schon bei einem kleinen Sinkflug wieder in die Atmosphäre.
const EARTH_Y   = 2200;     // so tief muss man sinken, um wieder in der Inselwelt zu landen
const SPACE_THR = 0.8;      // erst ab 80 % Schub traegt die Fahrt aus der Atmosphäre heraus
const EARTH_R   = 20000;    // Radius der Erdkugel
// (Die Kantenlängen und Abflughöhen der Oberflächen stehen unten in GROUNDS.)
// Schwerkraft je Ort: Mond ein Sechstel, Mars gut ein Drittel, Weltall schwerelos.
// Im Todesstern-Hangar wirkt künstliche Schwerkraft — angenehm niedrig zum Aufsetzen.
const GRAV_AT = { earth: 9.81, moon: 1.62, mars: 3.71, death: 4.0, space: 0 };
const STAR_R    = 1200000;  // Radius der Sternenkuppel (muss hinter allen Himmelskörpern liegen)
// Tempo im Weltall: 100 % Schub = Warp 1 ("Lichtgeschwindigkeit" im Spielmaßstab). Wer 100 % hält,
// rutscht in den Hyperraum und wird weiter schneller — bis Warp 10.
const SPACE_C   = 3000;     // m/s = Warp 1
const WARP_MAX  = 10;       // Warp 10 als Obergrenze
const WARP_RAMP = 12;       // Sekunden von Warp 1 auf Warp 10
// Himmelskörper: Radius, Entfernung, Richtung relativ zur Ausflugrichtung (yaw = Drehung um die
// Hochachse, up = Anteil nach oben), Symbol fürs HUD, landbar?
// Der Mond liegt bewusst genau in Ausflugrichtung — so sieht man ihn gleich beim Austritt.
const BODY_DEFS = [
  { key:'moon', r:12000,  dist:150000, yaw: 0,    up:0.35, sym:'🌙', land:true  },
  { key:'mars', r:30000,  dist:400000, yaw: 2.1,  up:0.50, sym:'🔴', land:true  },
  { key:'sun',  r:120000, dist:900000, yaw:-2.1,  up:0.80, sym:'☀️', land:false },
  { key:'death',r:20000,  dist:250000, yaw: 1.05, up:0.45, sym:'',   land:true  },   // Hangar-Landung   // bewusst ohne Symbol
];
const BODY_GLB = { moon:()=>window.MOON_GLB, mars:()=>window.MARS_GLB, sun:()=>window.SUN_GLB,
                   death:()=>window.DEATHSTAR_GLB };
const bodies = BODY_DEFS.map(def => ({ def, obj:null, center:new THREE.Vector3() }));
const bodyOf = (key)=> bodies.find(b => b.def.key === key);

let starDome = null, starMat = null, earthBall = null;
let spacePlaced = false;      // wurden die Himmelskörper schon positioniert?
let warpBrakeLock = 0;        // Sekunden, in denen die Hyperraum-Bremse ruht (nach Ortswechseln)
// warpDrive = Aufbau des Antriebs (bestimmt, wie schnell er werden KANN; wächst bei 100 % Schub).
// warpVis   = wie tief er tatsächlich im Hyperraum steckt — haengt allein an der GESCHWINDIGKEIT und
//             blendet den Effekt gleitend ein, genau wie der Uebergang Himmel -> Weltall.
let warpDrive = 0, warpVis = 0, warpRing = null, warpMat = null, warpSpin = 0;
function warpFactor(){ return 1 + (WARP_MAX-1)*warpDrive; }
let spaceBlend = 0;                 // 0 = Tageshimmel, 1 = Weltall
// Wie stark die Kamera das Rollen des Fliegers mitmacht: 0 = nie (Erde/Mond/Mars, Horizont bleibt
// unten), 1 = voll (Weltall, der Flieger steht immer aufrecht im Bild). Gleitend, damit der
// Übergang beim Ein- und Austritt weich ist und nicht in einem Frame umschlägt.
let camRoll = 0;
const CAM_ROLL_RATE = 2.5;          // Sekunden-Rate der Blende (~0,4 s für den Wechsel)
const SKY_DAY = new THREE.Color(0x87b8e8), SKY_SPACE = new THREE.Color(0x02030a);
const _skyC = new THREE.Color();

// Lädt ein Kugel-GLB und normiert es auf einen Zielradius (die Modelle sind r=100).
function preloadSphereGLB(dataUrl, radius, cb){
  if(!dataUrl || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(radius*2 / Math.max(size.x, size.y, size.z));
    const wrap = new THREE.Group(); wrap.add(obj);
    cb(wrap);
  }, (err)=>{ console.warn('Weltraum-GLB Ladefehler:', err); });
}
// ---------- MILCHSTRASSE ------------------------------------------------------------------------
// Ein echtes Panoramafoto (sky_pano_-_milkyway_by_MozillaHubs), und das ist die richtige Loesung —
// mein vorheriger Versuch, das Band aus 1.500 gerechneten Sternen und 40 Schleierflecken zu bauen,
// ist dafuer ersatzlos entfallen. Er hatte zwei Probleme, die sich nicht wegrechnen liessen:
//   · Die Schleierflecken waren als Vielecke zu erkennen (SphereGeometry mit 6 Segmenten bei 98 px
//     Bildgroesse), und additiv ueberlagert traten die Kanten doppelt hervor.
//   · Ein Sternband aus einzelnen Punkten sieht nie wie eine Galaxie aus. Die Milchstrasse ist ein
//     Schleier aus Milliarden unaufloesbarer Sterne, mit Staubbaendern und ungleicher Helligkeit —
//     das sind gewachsene Strukturen, keine Verteilungsfunktion.
//
// Das Panorama loest beides auf einmal und kostet dabei WENIGER: 334 KB GLB gegen 1.540 Instanzen.
// Es ist eine Kugelschale (Radius 500 im Modell, hier auf die Kuppel skaliert) mit einer 1024x512
// JPEG-Textur als emissiveTexture — sie leuchtet also selbst und braucht kein Licht, genau wie ein
// Sternhimmel es tun muss.
//
// Die vorhandene Sternenkuppel (starDome) BLEIBT und liegt darueber: 1024 px auf 360 Grad sind
// 2,8 px pro Grad, waehrend der Bildschirm 13,3 px pro Grad zeigt — Sterne aus dem Panorama waeren
// also weiche Flecken. Die Kuppel liefert die scharfen Punkte, das Panorama den Schleier dahinter.
// Zusammen ergibt das erst den Himmel.
let mwDome = null, mwMat = null;
// Radius als Anteil von STAR_R. 0,96 legt das Band INNERHALB der Sternenkuppel — das ist Absicht
// und war beim ersten Versuch mit 0,98 zu knapp: bei zwei transparenten Kugelschalen entscheidet
// der Abstand die Zeichenreihenfolge, und 2 % von 1,2 Mio. Metern sind bei den Rundungen des
// logarithmischen Tiefenpuffers kein sicherer Abstand.
// Es muss ausserdem weiter weg sein als der fernste Himmelskoerper (Sonne bei 1.020.000 m) und
// naeher als die Far-Plane (1.600.000 m): 0,96 mal 1.200.000 sind 1.152.000 m, beides erfuellt.
const MW_R = 0.96;
function buildMilkyWay(){
  if(mwDome || !window.MILKYWAY_GLB) return;
  // Dieselbe Hilfsfunktion, mit der auch Erde, Mond und Sterne geladen werden: sie skaliert das
  // Modell auf den gewuenschten Radius und packt es in eine Gruppe.
  preloadSphereGLB(window.MILKYWAY_GLB, STAR_R*MW_R, (g)=>{
    g.traverse(o=>{
      if(!o.isMesh) return;
      // Das Material des Modells nutzt emissiveTexture — genau richtig, aber es ist ein
      // MeshStandardMaterial, und das kostet unnoetig (PBR-Rechnung fuer eine Flaeche, die nur
      // leuchtet). Auf MeshBasic umgestellt, mit der Textur als map: gleiches Bild, weniger Arbeit,
      // und garantiert lichtunabhaengig.
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const tex = src && (src.emissiveMap || src.map);
      // OPAK und ganz nach hinten. Das Panorama IST der Sternhimmel — im Bild sind eigene Sterne
      // und Nebel — es braucht also keine Transparenz und soll nichts durchlassen.
      //
      // Zwei Anlaeufe hat mich das gekostet, und beide Fehler stecken hier als Warnung: erst
      // additiv mit renderOrder -2 (unsichtbar, weil vor scene.background gemalt), dann transparent
      // mit renderOrder -1 wie die Kuppel — und damit lag es bei GLEICHER Ordnung, wo Three.js nach
      // Abstand sortiert: die Kuppel (1.200.000 m) kam zuerst, das Panorama (1.152.000 m) legte sich
      // mit 85 % darueber, und von den Sternen blieben 15 %.
      //
      // Opak und mit renderOrder -3 ist die Reihenfolge eindeutig: Panorama, dann Kuppel, dann
      // alles andere. depthWrite bleibt AUS, damit die Kugel nichts vor sich wegschneidet.
      mwMat = new THREE.MeshBasicMaterial({ map:tex, side:THREE.DoubleSide, depthWrite:false });
      o.material = mwMat;
      o.renderOrder = -3;
      o.frustumCulled = false;
    });
    g.visible = false;
    mwDome = g;
    scene.add(g);
  });
}
// Wie hell das Panorama steht. 1,6 HEBT es ueber die Bildhelligkeit hinaus, und das ist Absicht:
// das Foto ist eine Langzeitbelichtung und im Original ueberwiegend sehr dunkel — im Spiel kam
// davon nur "etwas lila masse" an. Ueber 1 multipliziert werden die Nebel kraeftig und die
// eingebauten Sterne des Panoramas sichtbar, ohne dass der schwarze Anteil aufhellt (schwarz mal
// irgendwas bleibt schwarz).
const MW_BRIGHT = 1.6;
const _mwC = new THREE.Color();
function updateMilkyWay(f){
  if(!mwDome) return;
  mwDome.visible = f > 0.02;
  if(!mwDome.visible) return;
  // Mitwandern wie die Sternenkuppel: das Band soll immer gleich weit weg bleiben. Ohne das fliegt
  // man daraus heraus, sobald man ein paar Hunderttausend Meter zurueckgelegt hat — und im
  // Hyperraum sind das Sekunden.
  mwDome.position.copy(state.pos);
  // Eingeblendet wird ueber die FARBE, nicht die Deckkraft: das Material ist opak (siehe
  // buildMilkyWay), hat also keine. Von Schwarz nach Weiss multipliziert ist der Weg von
  // unsichtbar nach voll — und beim Aufstieg von der Erde erscheint das Band damit genauso
  // allmaehlich wie die Sterne.
  if(mwMat){
    const s = f * MW_BRIGHT;
    _mwC.setRGB(s, s, s);
    mwMat.color.copy(_mwC);
  }
}
function preloadSpace(){
  // Sternenkuppel: exakte Kugelschale, von innen sichtbar, lichtunabhängig, blendet mit der Höhe ein
  preloadSphereGLB(window.STARS_GLB, STAR_R, (g)=>{
    starMat = new THREE.MeshBasicMaterial({ color:0xffffff, side:THREE.DoubleSide,
                                            transparent:true, opacity:0, depthWrite:false });
    g.traverse(o=>{ if(o.isMesh){ o.material = starMat; o.renderOrder = -1; } });
    // DREIFACH, jeweils anders gedreht: das GLB hat 780 Sterne, und auf den ganzen Himmel verteilt
    // ist das wenig (mit dem Auge sieht man rund 3.000). Drei Kopien geben 2.340, und clone(true)
    // teilt die Geometrie-Buffer — es kommen also nur zwei Draw-Calls hinzu, keine neuen Vertices.
    //
    // Die Winkel sind bewusst KEINE glatten Teiler von 360 Grad: bei 120 Grad wuerden sich die
    // Muster zur Deckung bringen und als Symmetrie auffallen. 0,7 und 2,3 rad sind krumm genug.
    // Zusaetzlich um zwei Achsen gedreht, damit auch die Pole der Kugel nicht zusammenfallen.
    const kuppeln = new THREE.Group();
    kuppeln.add(g);
    for(const [ry, rx] of [[0.7, 1.1], [2.3, 0.45]]){
      const k = g.clone(true);
      k.rotation.set(rx, ry, 0);
      kuppeln.add(k);
    }
    kuppeln.visible = false; starDome = kuppeln; scene.add(kuppeln);
  });
  buildMilkyWay();      // Milchstrassen-Panorama hinter der Sternenkuppel (siehe dort)
  preloadSphereGLB(window.EARTH_GLB, EARTH_R, (g)=>{ g.visible = false; earthBall = g; scene.add(g); });
  for(const b of bodies){
    const data = BODY_GLB[b.def.key] && BODY_GLB[b.def.key]();
    preloadSphereGLB(data, b.def.r, (g)=>{ g.visible = false; b.obj = g; scene.add(g); });
  }
  preloadWarpRing();
  preloadAsteroid();
  preloadGround('moon');
  preloadGround('mars');
  preloadStationGLB(window.MOONBASE_GLB, (g)=>{
    g.scale.setScalar(5.52);       // im Original 100 m — als Station auf dem Mond zu zierlich
    moonBaseObj = g;
  });
  // ISS auf Star-Destroyer-Größe (1200 m). Im Original ist sie nur 120 m groß (gemessen) und war
  // damit im Sternenfeld praktisch nicht zu finden — gegen einen Todesstern mit 20 km Radius
  // verschwindet sie. Zehnfach vergrößert ist sie noch auf 12 km Entfernung 62 px hoch und damit
  // auch für ein Kind eindeutig zu sehen. Nicht maßstabsgetreu, aber das ist hier auch der
  // Todesstern nicht.
  preloadStationGLB(window.ISS_GLB, (g)=>{
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3(); box.getSize(size);
    g.scale.setScalar(ISS_LEN / Math.max(size.x, size.y, size.z));
    brightenISS(g);
    issObj = g;
  });
  // Der Rover ist nur ~4 m lang — auf 10 m gestreckt, damit man ihn aus der Luft erkennt.
  preloadStationGLB(window.ROVER_GLB, (g)=>{
    const box = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3(); box.getSize(size);
    g.scale.setScalar(10 / Math.max(size.x, size.y, size.z));
    roverObj = g;
  });
  // Apollo Lunar Roving Vehicle fuer den Mond. Es kommt in ECHTER Groesse (3,10 m) — das Modell ist
  // schon darauf gebaut, und anders als der Mars-Rover (der auf 10 m hochskaliert wird, damit er in
  // der weiten Landschaft auffaellt) sitzt man hier drin: ein 10 m langes Mondauto waere seltsam.
  preloadStationGLB(window.LUNAR_GLB, (g)=>{
    lunarObj = g;
  });
  preloadShips();
  preloadHangar();
  preloadDestroyer();
}
// Hyperraum-Ring (Spacedrive-Torus): liegt im Modell flach in der XZ-Ebene, wird aufgestellt und
// zentriert, damit er als Röhre um den Flieger sitzt. Eigenes additives Material -> leuchtet immer.
function preloadWarpRing(){
  if(!window.SPACEDRIVE_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.SPACEDRIVE_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    obj.rotation.x = Math.PI/2;                       // Ringebene senkrecht zur Flugachse
    const box0 = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box0.getSize(size);
    obj.scale.setScalar(44 / Math.max(size.x, size.y, size.z));   // ~44 m Außendurchmesser
    const box1 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box1.getCenter(c);
    obj.position.sub(c);                              // Ringmitte auf den Ursprung
    warpMat = new THREE.MeshBasicMaterial({ color:0x88a0ff, transparent:true, opacity:0,
      blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
    obj.traverse(o=>{ if(o.isMesh){ o.material = warpMat; o.renderOrder = 996; } });
    const wrap = new THREE.Group(); wrap.add(obj);
    wrap.visible = false; warpRing = wrap; scene.add(wrap);
  }, (err)=>{ console.warn('Spacedrive-GLB Ladefehler:', err); });
}

// ---------- Boden-Oberflächen: kachelnde Landschaften auf Mond und Mars ----------
// Beide Patches haben Ränder, die NICHT zusammenpassen (Mond ~60 m, Mars ~50 m Höhensprung),
// deshalb wird jede zweite Kachel gespiegelt: dann trifft jeder Rand auf sich selbst und die
// Landschaft ist nahtlos. Beide Modelle bringen ein Sockel-Mesh mit (Unterseite), das Mars-Modell
// zusätzlich eine Maßstabs-Platte — beides wird beim Laden verworfen.
const GROUND_FIELD_N = 128;    // Höhenraster je Kachel (Mond 23 m, Mars 59 m Rasterweite)
const GROUND_LIFT = 1.5;       // kleiner Aufschlag, damit der Flieger nicht in einer Senke versinkt
const GROUNDS = {
  moon: { glb:()=>window.CRATER_GLB,     tile:2999, leave:1000,
          dropRe:/Bruno_LP_2/,           dropMat:['material_1'] },
  mars: { glb:()=>window.MARSGROUND_GLB, tile:7494, leave:2000,   // 7494: die z-Ausdehnung des
          // Patches ist 3 m kleiner als die x-Ausdehnung — mit 7497 lägen die Randzeilen des
          // Höhenrasters außerhalb der Geometrie (256 Löcher, Bodenhöhe 0 statt −70 m)
          dropRe:/LP_2|Comparison/,      dropMat:['material_1','material_2'] },
};
for(const k in GROUNDS)
  Object.assign(GROUNDS[k], { tpl:null, tiles:new Map(), field:null, row:0, ray:null });

function preloadGround(key){
  const G = GROUNDS[key];
  const data = G.glb && G.glb();
  if(!data || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = data.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const drop = [];
    obj.traverse(o=>{
      if(!o.isMesh) return;
      const mn = (o.material && o.material.name) || '';
      if(G.dropRe.test(o.name||'') || G.dropMat.indexOf(mn) >= 0) drop.push(o);
    });
    for(const o of drop) if(o.parent) o.parent.remove(o);
    // Spiegelung kehrt die Flächenorientierung um -> von beiden Seiten sichtbar machen
    obj.traverse(o=>{ if(o.isMesh && o.material) o.material.side = THREE.DoubleSide; });
    obj.updateMatrixWorld(true);
    G.tpl = obj;
    G.field = new Float32Array(GROUND_FIELD_N*GROUND_FIELD_N);
    G.row = 0;
    G.ray = new THREE.Raycaster();
    buildGroundIndex(G);
  }, (err)=>{ console.warn('Boden-GLB Ladefehler ('+key+'):', err); });
}
// Suchraster über die Terrain-Dreiecke. Der Grund: der three.js-Raycaster prüft pro Strahl JEDES
// Dreieck des Meshes. Beim Mars sind das 37.962 Stück, also 128 ms für eine Rasterzeile — achtmal
// über dem Budget eines 60-Hz-Frames, und das lief beim Start minutenlang (gemessen mit
// C:\tmp\raycost.js). Mit den Dreiecken in XZ-Zellen kostet ein Höhenwert nur noch die Handvoll
// Dreiecke seiner Zelle. Aufgebaut wird das Raster einmal beim Laden.
const GROUND_CELL = 24;             // Zellenkante in Metern
function buildGroundIndex(G){
  const cells = new Map(), verts = [];
  const p = new THREE.Vector3();
  G.tpl.traverse(o=>{
    if(!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for(let k = 0; k+2 < n; k += 3){
      const tri = [];
      for(let c = 0; c < 3; c++){
        const vi = idx ? idx.getX(k+c) : k+c;
        p.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi)).applyMatrix4(o.matrixWorld);
        tri.push(p.x, p.y, p.z);
      }
      const base = verts.length;
      verts.push(tri[0],tri[1],tri[2], tri[3],tri[4],tri[5], tri[6],tri[7],tri[8]);
      const x0 = Math.floor(Math.min(tri[0],tri[3],tri[6])/GROUND_CELL);
      const x1 = Math.floor(Math.max(tri[0],tri[3],tri[6])/GROUND_CELL);
      const z0 = Math.floor(Math.min(tri[2],tri[5],tri[8])/GROUND_CELL);
      const z1 = Math.floor(Math.max(tri[2],tri[5],tri[8])/GROUND_CELL);
      for(let gx = x0; gx <= x1; gx++) for(let gz = z0; gz <= z1; gz++){
        const key = gx + ',' + gz;
        let list = cells.get(key);
        if(!list){ list = []; cells.set(key, list); }
        list.push(base);
      }
    }
  });
  G.idx = { cells, v: new Float32Array(verts) };
  console.log('Höhenraster-Index', G.tile.toFixed(0), ':', (verts.length/9).toFixed(0), 'Dreiecke in', cells.size, 'Zellen');
}
// Höhe der Kachelvorlage an (x,z) — der höchste Punkt unter dem Strahl, wie beim Raycast von oben.
function sampleGroundTpl(G, x, z){
  if(!G.idx) return null;
  const list = G.idx.cells.get(Math.floor(x/GROUND_CELL) + ',' + Math.floor(z/GROUND_CELL));
  if(!list) return null;
  const v = G.idx.v;
  let top = null;
  for(const b of list){
    const ax=v[b], ay=v[b+1], az=v[b+2], bx=v[b+3], by=v[b+4], bz=v[b+5], cx=v[b+6], cy=v[b+7], cz=v[b+8];
    const d1x=bx-ax, d1z=bz-az, d2x=cx-ax, d2z=cz-az;
    const den = d1x*d2z - d2x*d1z;
    if(Math.abs(den) < 1e-12) continue;              // senkrechte Fläche, von oben nicht zu treffen
    const px = x-ax, pz = z-az;
    const u = (px*d2z - d2x*pz)/den, w = (d1x*pz - px*d1z)/den;
    if(u < -1e-9 || w < -1e-9 || u+w > 1+1e-9) continue;
    const y = ay + u*(by-ay) + w*(cy-ay);
    if(top === null || y > top) top = y;
  }
  return top;
}
// Höhenraster aus der ECHTEN Geometrie ausmessen (nicht geschätzt). Mit dem Zellenraster ist eine
// Zeile so billig, dass acht Zeilen pro Frame passen — nach 16 Frames steht das Raster.
function stepGroundFields(){
  for(const k in GROUNDS){
    const G = GROUNDS[k];
    if(!G.tpl || !G.field || G.row >= GROUND_FIELD_N) continue;
    const N = GROUND_FIELD_N, half = G.tile/2, step = G.tile/(N-1);
    for(let n = 0; n < 8 && G.row < N; n++, G.row++){
      const iz = G.row;
      for(let ix=0; ix<N; ix++){
        const y = sampleGroundTpl(G, -half + ix*step, -half + iz*step);
        G.field[iz*N+ix] = (y === null) ? 0 : y;
      }
    }
    return;                     // pro Frame nur ein Terrain
  }
}
// Bodenhöhe: Spiegel-Kachelung + bilineare Interpolation im Höhenraster.
function groundHeightAt(key, x, z){
  const G = GROUNDS[key];
  if(!G || !G.field || G.row < GROUND_FIELD_N) return 0;
  const N = GROUND_FIELD_N, T = G.tile;
  const ix = Math.round(x/T), iz = Math.round(z/T);
  let lx = x - ix*T, lz = z - iz*T;          // lokal in der Kachel: -T/2 .. +T/2
  if(ix & 1) lx = -lx;                       // jede zweite Kachel gespiegelt
  if(iz & 1) lz = -lz;
  const fx = (lx + T/2)/T*(N-1), fz = (lz + T/2)/T*(N-1);
  const x0 = Math.max(0, Math.min(N-2, Math.floor(fx))), z0 = Math.max(0, Math.min(N-2, Math.floor(fz)));
  const tx = fx - x0, tz = fz - z0;
  const h00 = G.field[z0*N+x0],     h10 = G.field[z0*N+x0+1];
  const h01 = G.field[(z0+1)*N+x0], h11 = G.field[(z0+1)*N+x0+1];
  const h = (h00*(1-tx)+h10*tx)*(1-tz) + (h01*(1-tx)+h11*tx)*tz;
  // Lieber einen Hauch schweben als im Boden stecken: das Raster kann eine Kuppe abschneiden.
  return h + GROUND_LIFT;
}
// Genaue Bodenhöhe in Bodennähe: EIN Raycast pro Frame gegen die Kachel unter dem Flieger.
// Das Höhenraster ist für den Anflug gut genug, aber auf dem Mars weicht es bis zu 65 m ab
// (zerklüftetes Gelände, 59 m Rasterweite) — damit würde der Flieger im Boden landen.
let groundHitY = null, groundHitX = 0, groundHitZ = 0;
const _gRay = new THREE.Raycaster(), _gFrom = new THREE.Vector3(), _gDown = new THREE.Vector3(0,-1,0);
// Der X-Wing ist ~10 m breit und ~12 m lang: es genügt nicht, die Höhe unter der Rumpfmitte zu
// messen. Auf zerklüftetem Grund steckten sonst Flügelspitzen oder Nase im Hang. Deshalb werden
// fünf Punkte unter dem Flieger abgetastet und der HÖCHSTE genommen — er setzt auf der höchsten
// Stelle auf, statt einzusinken.
// Tastpunkte für den Boden-Raycast, relativ zum Bezugspunkt. Für das FLUGZEUG ein Kreuz über die
// Spannweite: es nimmt den höchsten Treffer, damit keine Flügelspitze im Hang steckt.
// Für den ASTRONAUTEN wäre das falsch — er stünde auf der höchsten Stelle im 7-m-Umkreis und damit
// sichtbar über dem Boden (gemessen bis 73 m auf dem Mars). Er tastet nur unter seinen Füßen.
const GROUND_PROBES = [[0,0], [6,0], [-6,0], [0,7], [0,-7]];
const GROUND_PROBES_FOOT = [[0,0]];
function stepGroundExact(){
  groundHitY = null;
  const G = GROUNDS[locale];
  if(!G || !G.tpl) return;
  // Gemessen wird dort, wo man IST: während der EVA am Astronauten, sonst am Flieger. Vorher stand
  // hier state.pos, die während der EVA auf dem Flieger festgehalten wird — der exakte Bodenwert
  // galt dann für eine Stelle, an der man längst nicht mehr war.
  const F = worldFocus();
  const approx = groundHeightAt(locale, F.x, F.z);
  if(F.y - approx > 300) return;                    // weit oben genügt das Raster
  const T = G.tile;
  // Die Mondbasis mitprüfen: sie ist ein GEBÄUDE und steht auf einer eigenen Fläche, die höher liegt
  // als der Kraterboden — ohne sie landet man unter der Plattform, und darauf soll man auch laufen.
  //
  // Der Mars-Rover darf hier NICHT stehen, obwohl er es lange tat (seit dem 23.08., als er reine
  // Kulisse war und man nicht einsteigen konnte). Ein FAHRZEUG ist kein Boden: sitzt man darin, tastet
  // der Raycast sein eigenes Dach ab, der Rover klettert darauf, und im nächsten Frame noch höher.
  // Im Browser gemessen an einer Stelle, deren echter Grund bei −71,84 m liegt: mit sichtbarem Rover
  // gab groundHitY +2,82 m. Genau das war „der Mars-Rover lässt sich nicht steuern, die Kamera geht
  // unter ihn" — er entfernte sich nach oben, während die Kamera dem echten Boden folgte.
  //
  // Auf dem Mond fiel es nie auf, weil dort die Basis in extra steht und der Lunar Rover außen vor
  // bleibt. Deshalb ist die Regel jetzt gleich für beide Orte: nur Gebäude, keine Fahrzeuge.
  const extra = (locale === 'moon') ? moonBaseObj : null;
  let best = null;
  // Draußen zu Fuß nur der Punkt unter den Füßen (siehe GROUND_PROBES_FOOT) — im Rover ebenso: die
  // Ausdehnung des Fahrzeugs steckt schon in vehicleGroundY, das ein eigenes Kreuz von 5 m abtastet.
  for(const [dx, dz] of (eva ? GROUND_PROBES_FOOT : GROUND_PROBES)){
    const px = F.x + dx, pz = F.z + dz;
    _gFrom.set(px, approx + 400, pz);
    const tile = G.tiles.get(Math.round(px/T) + ',' + Math.round(pz/T));
    if(tile){
      _gRay.set(_gFrom, _gDown);
      const hit = _gRay.intersectObject(tile, true);
      if(hit.length && (best === null || hit[0].point.y > best)) best = hit[0].point.y;
    }
    if(extra && extra.visible){
      _gRay.set(_gFrom, _gDown);
      const hit2 = _gRay.intersectObject(extra, true);
      // höchster Treffer = Oberseite dessen, was direkt darunter liegt (Plattform oder Dach)
      for(const h of hit2) if(best === null || h.point.y > best) best = h.point.y;
    }
  }
  if(best !== null){ groundHitY = best; groundHitX = F.x; groundHitZ = F.z; }
}
function updateGroundTiles(){
  const G = GROUNDS[locale];
  if(!G || !G.tpl) return;
  const T = G.tile;
  // Bezugspunkt: während der EVA der Astronaut (siehe worldFocus) — sonst fehlte die Kachel unter
  // seinen Füßen, sobald er sich vom Flieger entfernte.
  const F = worldFocus();
  const pix = Math.round(F.x/T), piz = Math.round(F.z/T);
  const need = new Set();
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const ix = pix+dx, iz = piz+dz, key = ix+','+iz;
    need.add(key);
    if(!G.tiles.has(key)){
      const g = G.tpl.clone(true);
      g.scale.set((ix & 1) ? -1 : 1, 1, (iz & 1) ? -1 : 1);
      g.position.set(ix*T, 0, iz*T);
      scene.add(g); G.tiles.set(key, g);
    }
  }
  for(const [key, g] of G.tiles){ if(!need.has(key)){ scene.remove(g); G.tiles.delete(key); } }
}
function clearGroundTiles(){
  for(const k in GROUNDS){
    const G = GROUNDS[k];
    for(const [,g] of G.tiles) scene.remove(g);
    G.tiles.clear();
  }
  if(moonBaseObj) moonBaseObj.visible = false;
  if(roverObj)    roverObj.visible = false;
  if(lunarObj)    lunarObj.visible = false;
  if(beaconObj)   beaconObj.visible = false;
}

// ---------- Mondbasis und ISS ----------
// Die Mondbasis steht neben dem Landepunkt auf dem Mond, die ISS hängt im Weltall in Erdnähe.
let moonBaseObj = null, issObj = null, roverObj = null;
let lunarObj = null;      // Apollo Lunar Roving Vehicle — das Fahrzeug auf dem Mond
const issCenter = new THREE.Vector3();     // aktueller Platz der ISS
// Die ISS ist 120 m groß (unnormiert übernommen). So nah heran heißt: Landung im Hangar, dieselbe
// Die ISS aufhellen. Im Weltall ist das Streulicht bewusst schwach (hemiLight fällt auf 0,15), und
// das Modell besteht aus dunklem Metall und Solarpaneelen — im Sternenfeld sieht man davon fast
// nichts. Ein Eigenleuchten (emissive) macht sie unabhängig von der Beleuchtung sichtbar, ohne dass
// sie wie eine Lampe wirkt: die Farbe des Materials wird nur zu einem Teil als Eigenleuchten
// übernommen. Das ist dasselbe Mittel, das die Blaulichter der Feuerwehr benutzen.
function brightenISS(root){
  root.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map(m=>{
      const c = m.clone();                       // eigene Instanz, sonst färbt es andere Modelle mit
      if(c.emissive){
        // Grundton aus der eigenen Farbe bzw. Textur, gedämpft — dunkle Teile bleiben dunkler als
        // helle, die Station behält also ihre Struktur.
        c.emissive = new THREE.Color(0xffffff);
        c.emissiveIntensity = 0.55;
        if(c.map) c.emissiveMap = c.map;         // Eigenleuchten folgt der Textur
      }
      if(c.color) c.color.multiplyScalar(1.25);  // Grundfarbe etwas anheben
      return c;
    });
    if(o.material.length === 1) o.material = o.material[0];
  });
}

// Logik wie beim Todesstern. Der Andockabstand muss zur Größe passen (etwas mehr als die halbe
// Ausdehnung), sonst flöge man mitten durch das Modell hindurch, ohne anzudocken — beim Star
// Destroyer sind es 700 bei 1200 m Länge, hier dieselbe Größenordnung.
// Zielgröße im Spiel. Das Original hat nur ~120 m (ausgemessen), war damit im Sternenfeld praktisch
// unsichtbar. 1200 m — Star-Destroyer-Größe — half, reichte aber noch nicht: das Modell ist
// überwiegend dunkles Metall, und im Weltall ist das Streulicht bewusst heruntergefahren.
// Jetzt das Doppelte eines Star Destroyers, dazu ein Eigenleuchten (siehe brightenISS).
const ISS_LEN  = 2400;
const ISS_DOCK = 1300;    // etwas mehr als die halbe Ausdehnung, sonst fliegt man durch das Modell
const issDrift = new THREE.Vector3();      // ihr eigener, langsamer Kurs
function preloadStationGLB(dataUrl, cb){
  if(!dataUrl || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const wrap = new THREE.Group(); wrap.add(gltf.scene);
    wrap.visible = false; scene.add(wrap); cb(wrap);
  }, (err)=>{ console.warn('Station-GLB Ladefehler:', err); });
}
// ---------- Hangar im Todesstern ----------
// Ein Innenraum statt einer Landschaft: das Modell steht fest im Ursprung, der Boden ist eben und
// wird beim Laden EINMAL per Raycast ausgemessen (kein Höhenraster nötig). Wer weit genug hinaus-
// oder hochfliegt, ist wieder im Weltall.
const HANGAR_SPAN = 300;           // Kantenlänge, auf die das Modell normiert wird
// Aus der Geometrie vermessen (C:\tmp\hangarmap3.js — Halle = überdachte, innen freie Zellen):
// Die Halle ist 235 x 200 m groß, ihre Mitte liegt bei (14, 0), der Boden bei 7 m, die Decke bei
// 77 m (also 70 m Hallenhöhe), und die Öffnung liegt bei x-MAX (2179 freie Sichtlinien gegen 3 an
// x-min). Gemessen wird der Boden deshalb in der Hallenmitte — die erste Messung hatte eine
// Plattform im Aufbaubereich (43 m) für den Boden gehalten.
const HANGAR_X = -20;              // Startplatz: tief in der Halle, die Öffnung 160 m voraus
const HANGAR_Z = 0;
const HANGAR_HOVER = 25;           // Schwebehöhe über dem Hangarboden
const HANGAR_YAW = -Math.PI/2;     // Nase (liegt auf -Z) zeigt damit auf +X, also zum Ausgang
let hangarCeilY = 1e9;             // Unterkante des Dachs, beim Laden gemessen (siehe preloadHangar)
const HANGAR_OUT_R = 200;
// ---- Wo der Hangarboden WIRKLICH endet ----
// Per Raycast-Raster ausgemessen (C:/tmp/hangar_raster.js): die tragende Flaeche ist ein
// durchgehendes Rechteck x = -140..130, z = -145..145 auf y = 6,25 (die Oeffnung liegt am +X-Ende).
// Das war der gemeldete Fehler: surfaceY gibt fuer 'death' UEBERALL hangarFloorY zurueck, also lief
// der Astronaut jenseits der Hallenkante auf unsichtbarem Boden weiter — gemessen bis zur
// EVA-Leine bei 4000 m, ohne dass je etwas passierte. Genau so fuehlt sich "im Uebergang haengen
// bleiben" an. Fuer den FLIEGER blieb es unbemerkt, weil updateLocale state.pos prueft und der
// X-Wing im Hangar stehen bleibt, waehrend man zu Fuss unterwegs ist.
const HANGAR_FLOOR_X0 = -140, HANGAR_FLOOR_X1 = 130;
const HANGAR_FLOOR_Z0 = -145, HANGAR_FLOOR_Z1 = 145;
function onHangarFloor(x, z){
  return x >= HANGAR_FLOOR_X0 && x <= HANGAR_FLOOR_X1
      && z >= HANGAR_FLOOR_Z0 && z <= HANGAR_FLOOR_Z1;
}          // so weit vom Zentrum -> zurück ins All (Öffnung liegt bei 141)
let hangarObj = null, hangarFloorY = 0;
// Wohin man beim Verlassen des Hangars zurückkehrt: Todesstern, Star Destroyer oder die ISS.
let hangarHost = null;      // { pos: Vector3, up: number }
// Sekunden, in denen kein neues Andocken möglich ist. ISS und Star Destroyer ziehen mit dem Flieger
// mit — ohne diese Sperre hätte der Gastgeber einen direkt nach dem Hinausfliegen wieder eingesaugt.
let dockLock = 0;
function preloadHangar(){
  if(!window.HANGAR_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.HANGAR_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    const box0 = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box0.getSize(size);
    obj.scale.setScalar(HANGAR_SPAN / Math.max(size.x, size.y, size.z));
    const box1 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box1.getCenter(c);
    obj.position.set(-c.x, -box1.min.y, -c.z);        // mittig, tiefster Punkt auf y=0
    const wrap = new THREE.Group(); wrap.add(obj);
    wrap.visible = false; scene.add(wrap);
    hangarObj = wrap;
    // Bodenhöhe GENAU AM STARTPLATZ messen: der Strahl von oben trifft zuerst das Dach (Innenraum),
    // also je Strahl den tiefsten Treffer nehmen. Über mehrere Messpunkte den Median — robust gegen
    // einzelne Strahlen, die durch eine Öffnung fallen oder auf einem Aufbau landen. Die Sondierung
    // der Geometrie ergab hier 5,9 m Boden und darüber rund 67 m freien Raum.
    wrap.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    const hits = [];
    for(const [dx,dz] of [[0,0],[25,0],[-25,0],[0,25],[0,-25],[25,25],[-25,-25],[25,-25],[-25,25]]){
      ray.set(new THREE.Vector3(HANGAR_X+dx, HANGAR_SPAN*2, HANGAR_Z+dz), new THREE.Vector3(0,-1,0));
      let low = null;
      for(const h of ray.intersectObject(wrap, true))
        if(low === null || h.point.y < low) low = h.point.y;
      if(low !== null) hits.push(low);
    }
    hits.sort((a,b)=>a-b);
    hangarFloorY = hits.length ? hits[Math.floor(hits.length/2)] : 0;
    // Decke genauso vermessen: Strahlen nach OBEN, tiefster Treffer ist die Unterkante des Dachs.
    // Vorher galt "höher als 85 m über dem Boden" als hinausgestiegen — man flog also durch das Dach.
    const up = new THREE.Vector3(0,1,0), tops = [];
    for(const dx of [-60,0,60]) for(const dz of [-60,0,60]){
      const r = new THREE.Raycaster(new THREE.Vector3(HANGAR_X+dx, hangarFloorY+3, HANGAR_Z+dz), up);
      const h = r.intersectObject(wrap, true);
      if(h.length) tops.push(h[0].point.y);
    }
    tops.sort((a,b)=>a-b);
    if(tops.length) hangarCeilY = tops[Math.floor(tops.length/2)];
    console.log('Hangar geladen: Boden bei y =', hangarFloorY.toFixed(1), '| Decke bei y =', hangarCeilY.toFixed(1),
                '| Startplatz', HANGAR_X, HANGAR_Z, '| Blickrichtung yaw', HANGAR_YAW.toFixed(3));
  }, (err)=>{ console.warn('Hangar-GLB Ladefehler:', err); });
}
function enterHangar(host){
  if(!hangarObj || dockLock > 0) return false;
  if(!spacePlaced) layoutBodies();          // sonst liegen alle Körper auf (0,0,0) — siehe layoutBodies
  const dsb = bodyOf('death');
  hangarHost = host || (dsb ? { pos: dsb.center.clone(), up: dsb.def.r*1.4 } : null);
  locale = 'death';
  warpDrive = 0; warpVis = 0; warpBrakeLock = 6;
  for(const b of bodies) if(b.obj) b.obj.visible = false;
  if(earthBall) earthBall.visible = false;
  earthWorldVisible(false);
  clearGroundTiles();
  hangarObj.visible = true;
  // Auf dem freien Streifen schwebend, Nase zum Ausgang, Schub auf Schwebestufe -> Landen mit 10 %.
  // Das gilt für jeden Eintritt, egal aus welcher Richtung man angeflogen kam.
  state.pos.set(HANGAR_X, hangarFloorY + HANGAR_HOVER, HANGAR_Z);
  state.vel.set(0, 0, 0);
  state.quat.setFromEuler(new THREE.Euler(0, HANGAR_YAW, 0, 'YXZ'));
  state.throttle = VTOL_HOVER; state.onGround = false; state.stalling = false;
  // Kamera hart hinter den Flieger setzen — sonst schwenkt sie erst von der alten Position heran.
  // Früher stand hier eine eigene Rechnung mit anderen Abständen (30 m / +9 m); jetzt dieselbe wie
  // bei allen Ortswechseln, damit die Kamera hinterher nicht noch auf ihre Sollposition kriecht.
  snapCamera();
  showSpaceHint('🛰️');
  flashFade();
  console.log('[Hangar] Eintritt bei', state.pos.x.toFixed(0), state.pos.y.toFixed(0), state.pos.z.toFixed(0),
              '| Boden', hangarFloorY.toFixed(1), '| yaw', HANGAR_YAW.toFixed(2));
  return true;
}
function leaveHangar(){
  locale = 'space';
  if(hangarObj) hangarObj.visible = false;
  // knapp über dem Gastgeber wieder herauskommen (Todesstern oder Star Destroyer)
  if(hangarHost) state.pos.copy(hangarHost.pos).add(new THREE.Vector3(0, hangarHost.up, 0));
  else { const b = bodyOf('death'); if(b) state.pos.copy(b.center).add(new THREE.Vector3(0, b.def.r*1.4, 0)); }
  // Kamera mitnehmen: das ist ein Sprung über Kilometer (beim Todesstern 28 km). Ohne Snap kriecht
  // sie hinterher, und wer gleich mit Vollgas wegfliegt, lässt sie nie aufholen — dann ist der
  // Flieger nur noch ein Punkt im Bild.
  snapCamera();
  for(const bb of bodies) if(bb.obj) bb.obj.visible = true;
  if(earthBall){ earthBall.position.copy(earthHome); earthBall.visible = true; }
  warpBrakeLock = 6; dockLock = 6;
  if(state.throttle > 0.5) state.throttle = 0.5;
  showSpaceHint('🚀');
  console.log('[Hangar] verlassen -> Weltall bei', state.pos.x.toFixed(0), state.pos.y.toFixed(0), state.pos.z.toFixed(0));
}

// ---------- Mondbasis und Mars-Rover ----------
// Mondbasis: auf JEDER Kachel steht eine, an einer aus der Kachelnummer abgeleiteten (also immer
// gleichen) Stelle. Gerendert wird nur die der aktuellen Kachel — das Modell hat 37.758 Dreiecke,
// neun Stück gleichzeitig wären zu viel. Rover: erscheint beim Landeanflug neben dem Aufsetzpunkt.
// Über beiden steht eine Leuchtsäule, damit man sie aus der Luft findet; sie erscheint auch dann,
// wenn das Modell selbst noch nicht geladen ist — dann weiß man trotzdem, wo es hingehört.
// (Hier stand roverAnchor: die gewuerfelte Stelle, an der der Mars-Rover 45-80 m entfernt abgesetzt
// wurde. Sie ist entfallen — das Fahrzeug steht jetzt 30 m rechts neben dem X-Wing und bleibt dort,
// siehe roverSpot/roverSpawnBesideXwing.)
let _lastBase = null;      // wo Basis bzw. Rover gerade stehen (für den Start-/Landeverkehr)
let _lastBaseY = 0;        // und auf welcher Höhe — die Landeplätze rechnen damit
// Dünner, blasser Lichtstrahl: der erste Versuch war so breit, dass er die Basis verdeckte.
const beaconMat = new THREE.MeshBasicMaterial({ color:0x9fd8ff, transparent:true, opacity:0.12,
  blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 600, 8, 1, true);
let beaconObj = null;
function showBeacon(x, y, z, col){
  if(!beaconObj){ beaconObj = new THREE.Mesh(beaconGeo, beaconMat); beaconObj.renderOrder = 995; scene.add(beaconObj); }
  beaconObj.position.set(x, y + 300, z);
  beaconMat.color.setHex(col);
  beaconObj.visible = true;
}
// Feste Stelle der Basis in einer Kachel (deterministisch, damit sie beim Wiederkommen dort steht).
// Gewählt wird die FLACHSTE von 16 Kandidaten: die Basis ist ein starres Modell und sitzt auf dem
// Kraterwert ihres Zentrums, der Krater hat aber bis 80 m Relief, während ihre Fläche nur 14 m
// abfällt (vermessen, C:\tmp\basefit.js). An einer welligen Stelle steckt die Fläche im Hang. Die
// Auswahl drückt die Höhenstreuung im Landeplatzring von 55 m auf 14 m (C:\tmp\basefit2.js).
const _baseSpots = new Map();
function baseSpotForTile(ix, iz){
  const key = ix + ',' + iz;
  const known = _baseSpots.get(key);
  if(known) return known;
  const T = GROUNDS.moon.tile, cand = [];
  for(let c = 0; c < 16; c++){
    const r1 = cellRnd(ix, iz, 4711 + c*97), r2 = cellRnd(ix, iz, 1337 + c*89);
    cand.push({ x: ix*T + (r1-0.5)*T*0.6, z: iz*T + (r2-0.5)*T*0.6 });
  }
  // Ohne fertiges Höhenraster lässt sich nichts vergleichen — dann vorläufig der erste Kandidat,
  // und beim nächsten Aufruf (Raster fertig) wird richtig gewählt und gemerkt.
  const G = GROUNDS.moon;
  if(!G.field || G.row < GROUND_FIELD_N) return cand[0];
  let best = cand[0], bestSpread = Infinity;
  for(const c of cand){
    let mn = Infinity, mx = -Infinity;
    for(let r = 120; r <= 250; r += 26) for(let k = 0; k < 8; k++){
      const a = k/8*Math.PI*2;
      const y = groundHeightAt('moon', c.x + Math.cos(a)*r, c.z + Math.sin(a)*r);
      if(y < mn) mn = y;
      if(y > mx) mx = y;
    }
    if(mx - mn < bestSpread){ bestSpread = mx - mn; best = c; }
  }
  _baseSpots.set(key, best);
  console.log('Mondbasis-Standort Kachel', key, '-> Ring-Streuung', bestSpread.toFixed(1), 'm');
  return best;
}
// Höhenprofil der Basisfläche über ihrer eigenen Nullhöhe — vermessen mit C:\tmp\baseprobe2.js
// (Faktor 5,52, je Ring 72 Punkte). Zwischen 100 und 260 m ist die Fläche rundum frei und flach
// (Höhenstreuung unter 1 m); die Aufbauten stehen bei 40–80 m, ab 280 m fällt der Rand ab.
const BASE_PROFILE = [[100,25.3],[120,24.1],[140,22.6],[160,20.9],[180,19.0],
                      [200,17.1],[220,15.1],[240,13.1],[260,11.1]];
function basePlatformY(r){
  const P = BASE_PROFILE;
  if(r < P[0][0] || r > P[P.length-1][0]) return null;
  for(let i = 1; i < P.length; i++) if(r <= P[i][0]){
    const [r0,h0] = P[i-1], [r1,h1] = P[i];
    return h0 + (h1-h0)*(r-r0)/(r1-r0);
  }
  return null;
}
// Höhe, auf der die Basis sitzt: der Kraterwert ihres Zentrums, aber so weit angehoben, dass ihre
// Fläche nirgends im Hang versinkt. Der Krater hat bis 80 m Relief, die Fläche fällt nur 14 m ab —
// ohne das steckte sie oft im Boden, und alles, was darauf landet, war unsichtbar.
const _baseYs = new Map();
function baseGroundY(p){
  const key = p.x.toFixed(0) + ',' + p.z.toFixed(0);
  if(_baseYs.has(key)) return _baseYs.get(key);
  const c = groundHeightAt('moon', p.x, p.z);
  let lift = 0;
  for(let r = 110; r <= 260; r += 25){
    const plat = basePlatformY(r);
    if(plat === null) continue;
    for(let k = 0; k < 12; k++){
      const a = k/12*Math.PI*2;
      const y = groundHeightAt('moon', p.x + Math.cos(a)*r, p.z + Math.sin(a)*r);
      if(y - (c + plat) + 2 > lift) lift = y - (c + plat) + 2;    // 2 m Luft
    }
  }
  const out = c + Math.max(0, lift);
  if(GROUNDS.moon.field && GROUNDS.moon.row >= GROUND_FIELD_N) _baseYs.set(key, out);
  return out;
}
function placeGroundBase(){
  if(moonBaseObj && locale !== 'moon') moonBaseObj.visible = false;
  if(roverObj    && locale !== 'mars') roverObj.visible = false;
  if(lunarObj    && locale !== 'moon') lunarObj.visible = false;
  if(beaconObj && !GROUNDS[locale]) beaconObj.visible = false;
  if(locale === 'moon'){
    const T = GROUNDS.moon.tile;
    // Bezugspunkt ist die FLIEGER-Position (state.pos), und die bleibt während der EVA stehen — die
    // Mondbasis wandert also nicht weg, während man um sie herumläuft. Ihre Leuchtsäule bleibt
    // sichtbar: anders als der Rover ist sie ein Gebäude, das man aus der Luft finden muss.
    const p = _basePosMoon && Math.hypot(_basePosMoon.x - state.pos.x, _basePosMoon.z - state.pos.z) < T*0.7
      ? _basePosMoon
      : baseSpotForTile(Math.round(state.pos.x/T), Math.round(state.pos.z/T));
    const y = baseGroundY(p);
    if(moonBaseObj){
      moonBaseObj.position.set(p.x, y, p.z); moonBaseObj.visible = true;
      moonBaseObj.updateMatrixWorld(true);      // sonst raycastet der Bodencheck gegen die alte Stelle
    }
    showBeacon(p.x, y, p.z, 0x9fd8ff);
    _lastBase = p; _lastBaseY = y;
  }
  // EIGENES if, kein "else if": auf dem Mond stehen Basis UND Fahrzeug, das sind zwei unabhaengige
  // Dinge. Als "else if" war dieser Zweig fuer 'moon' unerreichbar (der Mondbasis-Zweig oben greift
  // immer zuerst) — im Browser gemessen: roverSpot.moon blieb null und der Lunar Rover war
  // unsichtbar, das Radar zeigte nur einen Blip statt zwei.
  if(locale === 'mars' || locale === 'moon'){
    // Das Fahrzeug steht 30 m rechts neben dem gelandeten X-Wing (roverSpawnBesideXwing) und bleibt
    // dort. Frueher stand hier ein gewuerfelter Ankerpunkt 45-80 m weit weg, dazu eine orange
    // Leuchtsaeule, die den Weg zeigte — beides ist entfallen: das Fahrzeug steht ja sichtbar
    // daneben, und einsteigen kann man jetzt auch.
    // Auf dem Mond gilt dasselbe, dort mit dem Apollo-Rover. Die Leuchtsaeule der Mondbasis (weiter
    // oben, hellblau) bleibt — die markiert die Basis, kein Fahrzeug.
    roverSpawnBesideXwing();
    if(locale === 'mars' && beaconObj) beaconObj.visible = false;
  }
}

// Oberflächenhöhe an (x,z) — je Ort: Erde (Meer/Insel/Trägerdeck) oder Mondboden.
// Liegt (x,z) auf der Fläche der Mondbasis? Dann ihre absolute Höhe, sonst null.
// Gemeinsame Grundlage für surfaceY (Astronaut, X-Wing) und padSurfaceY (landende Schiffe) — vorher
// kannte nur padSurfaceY die Fläche, weshalb Schiffe richtig standen, der Astronaut aber durchsackte.
function basePlatformNear(x, z){
  if(locale !== 'moon' || !_lastBase || !moonBaseObj || !moonBaseObj.visible) return null;
  const plat = basePlatformY(Math.hypot(x - _lastBase.x, z - _lastBase.z));
  return (plat === null) ? null : _lastBaseY + plat;
}
function surfaceY(x, z){
  if(locale === 'death') return hangarFloorY;          // ebener Hangarboden
  if(GROUNDS[locale]){
    // Auf der Fläche der Mondbasis zählt DEREN Höhe, nicht der Kraterboden darunter: die Basis wird
    // über das Relief angehoben (siehe baseGroundY), sonst steckte sie im Hang. Ohne diese Abfrage
    // lieferte surfaceY den Kraterwert, und alles, was sich auf der Fläche bewegt, sackte um die
    // Anhebung durch — beim Astronauten deutlich zu sehen.
    // Die Prüfung steht VOR dem Raycast-Wert: der trifft die Basisgeometrie nicht zuverlässig,
    // weil ihre Weltmatrix erst beim Rendern aktualisiert wird.
    const bp = basePlatformNear(x, z);
    if(bp !== null) return bp;
    // In Bodennähe der exakte Wert aus dem Raycast, sonst der Rasterwert. Die Toleranz ist beim
    // Astronauten enger: er läuft 6 m/s, nach einer Sekunde wäre er sonst 6 m von der Messstelle
    // entfernt und stünde auf einer Höhe, die dort nicht mehr gilt. Beim Flugzeug sind 5 m
    // unkritisch, weil es selbst 20 m breit ist.
    // Das gilt auch im ROVER: nachgemessen liegt die Messstelle beim Fahren maximal 1,39 m entfernt
    // (im Mittel 0,14 m), also innerhalb der 1,5 m. Eine groessere Toleranz fuer den Rover war
    // versucht und wieder verworfen — sie aenderte nichts, weil hier gar kein Fehler lag.
    const tol = eva ? 1.5 : 5;
    if(groundHitY !== null && Math.abs(x-groundHitX) < tol && Math.abs(z-groundHitZ) < tol) return groundHitY;
    return groundHeightAt(locale, x, z);
  }
  if(locale === 'space') return -1e9;                  // im Weltall gibt es keinen Boden
  return isOnCarrier(x, z) ? fordDeckY : (isOnLand(x, z) ? ISLAND_Y : 0);
}

// ---------- Ortswechsel ----------
// Erdwelt beim Verlassen abräumen (und beim Zurückkommen wieder aufbauen lassen).
function earthWorldVisible(on){
  ground.visible = on;
  // Der MEERESBODEN gehoert dazu, und dass er hier fehlte, war ein echter Fehler: gemeldet als
  // "warum sehe ich die unterwasserwelt aus dem hangar im weltraum?". Nachgemessen stand
  // seabedMesh.visible nach enterSpace() UND nach enterHangar() weiter auf true.
  //
  // Sichtbar wurde es, weil der Boden dem Spieler folgt (updateSeabed rastert ihn auf dessen
  // Position) und 6 km gross ist. Im Weltall haengt er also als brauner Teppich um den Flieger,
  // und im Hangar liegt er quer durch die Halle — der Hangarboden steht bei hangarFloorY, der
  // Meeresgrund bei -80 bis -120 m, aber ein 6-km-Gitter sieht man auch von der Seite.
  //
  // Warum updateSeabed allein es nicht rettet: der Aufruf im Loop haengt zwar an
  // locale === 'earth', das hoert aber nur auf zu RECHNEN. Ein Mesh, das nicht mehr
  // aktualisiert wird, bleibt in der Szene stehen. Genau derselbe Unterschied wie bei
  // ground selbst, das deshalb schon immer in dieser Zeile stand.
  seabedMesh.visible = on;
  for(const cl of clouds) cl.visible = on;
  if(!on){
    const shared = sharedGeos();
    for(const [,isl] of islandCells) if(isl) dropFromScene(isl, shared);
    islandCells.clear();
    for(const [,grp] of carrierCells) if(grp) dropFromScene(grp, shared);
    carrierCells.clear();
    for(const e of fleet) removePlane(e);
    fleet.length = 0; clearFlyby(); clearAiEffects();
    clearRescue();
    clearSeaShips();                     // Handelsschiffe gibt es nur auf der Erde
    clearOrcas();                        // die Killerwale ebenso (updateOrcas raeumt sonst erst im naechsten Frame)
    clearUwCells();                      // und die Unterwasserwelt (Wracks, Seegras, Korallen)
    clearFish();                         // und die Fischschwaerme (siehe dort: sonst einen Frame zu spaet)
    clearDrift();                        // und die Bewegungspartikel: sie stehen in WELTkoordinaten
                                         // um die alte Kamera, ein Ortswechsel springt aber ueber km
    clearComets();                       // dasselbe fuer die Kometenstreifen
  } else {
    updateIslands();                     // Zellen um die aktuelle Position neu aufbauen
  }
}
// Himmelskörper um die aktuelle Position herum setzen: waagerechte Flugrichtung als Bezug, dann pro
// Körper drehen (yaw) und anheben (up). Muss laufen, BEVOR irgendeine Körper-Distanz geprüft wird —
// sonst liegen alle Zentren bei (0,0,0) und der nächstgrößte Körper "schluckt" den Spieler.
// Wo die Erdkugel im Weltall steht. Sie wird als Kulisse missbraucht, solange man auf Mond oder Mars
// ist (dort hängt sie am Himmel und wandert mit) — ohne gemerkten Heimatplatz blieb sie danach an
// dieser Kulissenstelle stehen: eine 40 km große Kugel mitten im Flugraum, durch die man hindurchflog.
const earthHome = new THREE.Vector3();
function layoutBodies(fromEarth){
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const base = new THREE.Vector3(fwd.x, 0, fwd.z);
  if(base.lengthSq() < 1e-6) base.set(0,0,-1);
  base.normalize();
  const upAxis = new THREE.Vector3(0,1,0);
  for(const b of bodies){
    const d = base.clone().applyAxisAngle(upAxis, b.def.yaw);
    d.y = b.def.up; d.normalize();
    b.center.copy(state.pos).addScaledVector(d, b.def.dist);
  }
  // Beim Aufstieg von der Erde liegt ihr Mittelpunkt genau EARTH_R unter dem Austrittspunkt, damit
  // ihre Oberfläche dort ist, wo eben noch die flache Welt war. Startet man dagegen im Hangar des
  // Todessterns, muss sie in die Ferne — 20 km unter dem Flieger wäre man sofort wieder in ihr drin.
  if(fromEarth) earthHome.set(state.pos.x, -EARTH_R, state.pos.z);
  else earthHome.copy(state.pos).addScaledVector(base, -EARTH_R*4.5).setY(-EARTH_R*1.5);
  if(earthBall) earthBall.position.copy(earthHome);
  spacePlaced = true;
}
function enterSpace(){
  locale = 'space';
  // Erst mal umschauen: der Schub geht auf die Hälfte, sonst rutscht man mit 100 % direkt in den
  // Hyperraum und ist weg, bevor man Erde, ISS und Mond gesehen hat.
  warpDrive = 0; warpVis = 0; warpBrakeLock = 6;
  if(state.throttle > 0.5) state.throttle = 0.5;
  // Erdkugel so legen, dass ihre Oberfläche dort liegt, wo die flache Welt war (macht layoutBodies)
  if(earthBall) earthBall.visible = true;
  layoutBodies(true);
  // Die ISS zieht in Erdnähe ihre Bahn — gleich beim Austritt in Sichtweite. Nur den Platz merken;
  // gesetzt wird sie in placeBodies(), damit sie auch dann erscheint, wenn ihr Modell erst später
  // fertig geladen ist (genau daran waren ISS, Mondbasis und Rover vorher unsichtbar geblieben).
  // Gleich beim Austritt in Sichtweite. Bei 2400 m Größe braucht es Abstand, sonst füllt sie das
  // ganze Bild: 4,5 km sind nah genug, um sie sofort zu sehen, und weit genug, um sie ganz zu
  // erfassen.
  issCenter.copy(state.pos).add(new THREE.Vector3(1700, 1100, -4000));
  issDrift.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(40);
  earthWorldVisible(false);
  showSpaceHint('🚀');
  console.log('[Ort] Weltall, Austritt bei y =', state.pos.y.toFixed(0));
}
function enterEarth(atSphere){
  locale = 'earth';
  warpDrive = 0; warpVis = 0;
  if(atSphere && spacePlaced){
    // Ab hier GENAU derselbe Weg wie bei Mond und Mars: setupApproach() setzt eine frische
    // waagerechte Lage, ruhige Fahrt, die Nase auf das Ziel und die Kamera hart dahinter. Vorher
    // hatte die Erde eigenen Code, der die Fluglage aus dem Weltall übernahm — bei senkrechter Nase
    // oder kopfüber lieferte das einen unbrauchbaren Kurs, und man kam im Sturzflug an.
    // Ziel ist der Punkt, an dem man die Kugel berührt hat; er muss VOR earthWorldVisible(true)
    // feststehen, weil die Inselzellen um die neue Position herum aufgebaut werden.
    const n = state.pos.clone().sub(earthHome).normalize();
    const hit = earthHome.clone().addScaledVector(n, EARTH_R);
    setupApproach('earth', hit.x, hit.z, 1600, 900);
    flashFade();
  }
  if(earthBall) earthBall.visible = false;
  for(const b of bodies) if(b.obj) b.obj.visible = false;
  if(issObj) issObj.visible = false;
  if(hangarObj) hangarObj.visible = false;
  clearGroundTiles();
  earthWorldVisible(true);
  showSpaceHint('🌍');
  console.log('[Ort] Erde');
}
// Flieger im Abstand dist vor dem Zielpunkt (tx,tz) einsetzen, in Höhe alt darüber, Nase auf das
// Ziel. Setzt auch die Kamera hart dahinter: sonst steht sie noch an der alten Stelle und schwenkt
// nach dem Wechsel sichtbar um den Flieger herum.
let _basePosMoon = null;
// Kamera hart hinter den Flieger setzen: nach einem Ortswechsel steht sie noch an der alten Stelle
// und schwenkt sichtbar um ihn herum, während sie nachzieht.
// Zusatzabstand der Kamera bei Fahrt: im Hyperraum sieht es besser aus (und gibt ein Tempogefühl),
// wenn die Kamera zurückweicht. Der Faktor ist so gewählt, dass er den früheren Lerp-Rückstand bei
// normaler Fahrt genau nachbildet (bei 690 m/s 43,7 m gegen vorher 43,3 m) — nur wächst er jetzt
// nicht endlos weiter: gedeckelt bei rund 150 m Gesamtabstand (erreicht ab Warp 1,7), sonst wäre der
// Flieger bei Warp 10 nur noch ein Punkt — dort waren es vorher 526 m.
// Einen Lerp-Faktor, der FUER EINEN FRAME BEI 60 fps gedacht ist, auf die echte Framezeit umrechnen.
//
// Warum das ueberhaupt sein muss: pos.lerp(ziel, 0.06) zieht je AUFRUF um 6 % nach. Wie schnell
// das in Sekunden ist, haengt damit an der Bildrate — bei 30 fps dauert dasselbe doppelt so lange.
// Fuer eine Kamera ist das direkt sichtbar, weil jeder Bildraten-Wackler zu einer Bewegung wird.
//
// Die Umrechnung ist exakt und nicht genaehert: (1-k) ist der Anteil, der je 1/60 s UEBRIG bleibt.
// Ueber dt Sekunden bleibt davon (1-k)^(dt*60) — der nachgezogene Anteil ist eins minus das.
// Bei dt = 1/60 kommt genau k heraus, das bisherige Verhalten bei 60 fps bleibt also erhalten.
//
// dt wird geklemmt: der Loop deckelt sein dt schon auf 0,05 s, aber ein Aufruf mit dt = 0 (erster
// Frame, bevor dtCam gesetzt ist) wuerde 0 liefern und die Kamera festhalten.
function frameLerp(k, dt){
  const d = Math.max(0.0001, Math.min(0.1, dt || 1/60));
  return 1 - Math.pow(1 - k, d*60);
}
function camBackExtra(){
  return Math.min(125, state.vel.length() * 0.025);
}
function snapCamera(){
  if(typeof camera === 'undefined') return;
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  // Genau die Stelle einnehmen, die updateCamera() im nächsten Frame anstrebt — mit einem anderen
  // Abstand zieht die Kamera nach dem Ortswechsel noch sichtbar nach (mit lerp 0,06 rund eine halbe
  // Sekunde lang). Gerechnet wird mit der WAAGERECHTEN Nasenrichtung: mit der vollen bliebe bei
  // steiler Lage kein waagerechter Abstand übrig, und eine Euler-Zerlegung ist bei senkrechter Nase
  // singulär — genau so kommt man aus dem Weltall an.
  const f = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  f.y = 0;
  if(f.lengthSq() < 1e-6) f.set(0,0,-1);
  f.normalize();
  const cfg = viewConfigs[viewMode], cc = camCfg();
  const d = cfg.dist*cc.dist + camBackExtra();
  camera.position.set(state.pos.x - f.x*d,
                      state.pos.y + cfg.height*cc.hgt,
                      state.pos.z - f.z*d);
  // wie in updateCamera: nur in der Inselwelt gibt es unten einen Boden — ausser man TAUCHT.
  // Diese Klemme war genau die Sperre, die eine Unterwasserwelt unsichtbar gemacht haette.
  if(locale === 'earth' && !subTaucht() && camera.position.y < 2) camera.position.y = 2;
  camera.up.set(0,1,0);
  camera.lookAt(state.pos);
}
// Schub, mit dem man an einem Himmelskörper ankommt. 30 % ist genau die Schwelle, ab der der X-Wing
// waagerecht vorwärts fliegt (darunter übernehmen die Repulsoren: 20 % schweben, 10 % sinken) — man
// kommt also ruhig an und ist einen Tastendruck vom Schweben entfernt. Vorher 40 %.
const APPROACH_THR = 0.3;
function setupApproach(key, tx, tz, dist, alt){
  const a = Math.random()*Math.PI*2;
  const px = tx + Math.cos(a)*dist, pz = tz + Math.sin(a)*dist;
  // Mond und Mars haben ein Höhenraster, die Erde nicht — dort zählt die Meereshöhe.
  const gy = GROUNDS[key] ? groundHeightAt(key, px, pz) : 0;
  state.pos.set(px, gy + alt, pz);
  const dir = new THREE.Vector3(tx - px, 0, tz - pz).normalize();
  state.quat.setFromEuler(new THREE.Euler(0, Math.atan2(-dir.x, -dir.z), 0, 'YXZ'));
  state.vel.copy(dir).multiplyScalar(110);
  state.throttle = APPROACH_THR; state.onGround = false; state.stalling = false;
  snapCamera();
}

// Anflug fuer das JETPACK — das Gegenstueck zu setupApproach, nur fuer den Astronauten.
//
// Vorher setzte das Jetpack einfach auf dem Boden auf: man kam aus dem Weltall und STAND ploetzlich
// auf der Insel. Der X-Wing fliegt an, und das Jetpack soll es genauso tun („der jetpack soll bitte
// auch so anfliegen wie der x wing und nicht einfach auf der erde sein").
//
// Die Werte sind aufs Astronauten-Tempo umgerechnet: der Flieger startet 1600 m entfernt und 900 m
// hoch mit 110 m/s, was 15 s Anflug ergibt. Mit JET_VMAX = 45 m/s waeren dieselben 1600 m knapp zwei
// Minuten. 500 m und 180 m Hoehe ergeben bei halbem Schub 24 s — dieselbe Ordnung wie beim Flieger.
//
// Das Jetpack bleibt dabei AN (eva.jet bleibt true): man fliegt selbst herunter und landet mit den
// Schubstufen, wie man es auf dem Hinweg gelernt hat. Genau das ist der Unterschied zum bisherigen
// „ist einfach da".
const JET_APPROACH_DIST = 500;    // m vom Ziel entfernt einsetzen
const JET_APPROACH_ALT  = 180;    // m ueber dem Grund am Einsetzpunkt
function jetApproach(key, tx, tz){
  if(!eva) return;
  const a = Math.random()*Math.PI*2;
  const px = tx + Math.cos(a)*JET_APPROACH_DIST, pz = tz + Math.sin(a)*JET_APPROACH_DIST;
  // Mond und Mars haben ein Hoehenraster, die Erde nicht — dort zaehlt die Meereshoehe (wie in
  // setupApproach).
  const gy = GROUNDS[key] ? groundHeightAt(key, px, pz) : 0;
  eva.group.position.set(px, gy + JET_APPROACH_ALT, pz);
  // Nase auf das Ziel, leicht gesenkt: er kommt von oben herunter und sieht dabei, wohin es geht.
  const dir = new THREE.Vector3(tx - px, 0, tz - pz).normalize();
  eva.yaw = Math.atan2(-dir.x, -dir.z);
  // Nase 20 Grad runter: so passen Sinkzeit und Anflugzeit zusammen. Bei halbem Schub (22,5 m/s)
  // sind das 24 s fuer die 500 m waagerecht und 23 s fuer die 180 m Hoehe — er kommt also TIEF am
  // Ziel an, nicht darueber. Mit 300 m Hoehe und 14 Grad waeren es 23 s gegen 54 s gewesen: er waere
  // in voller Hoehe darueber hinweggeflogen.
  eva.jetPitch = -0.35;
  eva.jetRoll = 0;
  eva.jetVel = new THREE.Vector3(dir.x*JET_VMAX*0.5, 0, dir.z*JET_VMAX*0.5);
  eva.vy = 0; eva.onGround = false;
  state.throttle = 0.5;                    // halber Schub: zuegig heran, aber beherrschbar
  eva.planeAt.copy(eva.group.position);    // sonst zieht die EVA-Leine sofort zurueck
  jetSnapCam();                            // Sprung ueber Hunderte km — Kamera mitnehmen
  flashFade();
}
// Auf eine Oberfläche wechseln (Mond oder Mars).
function enterGround(key){
  locale = key;
  warpDrive = 0; warpVis = 0;
  const b = bodyOf(key);
  if(b && b.obj) b.obj.visible = false;              // man ist jetzt darauf
  earthWorldVisible(false);
  // Landeanflug: so einsetzen, dass Basis bzw. Rover schon VOR dem Flieger liegen — vorher musste
  // man nach dem Wechsel erst um 180° drehen, um sie überhaupt zu sehen.
  if(key === 'moon'){
    const T = GROUNDS.moon.tile;
    const bp = baseSpotForTile(0, 0);
    _basePosMoon = bp;                                   // Basis dort aufstellen (siehe placeGroundBase)
    setupApproach(key, bp.x, bp.z, 1400, 520);
  } else {
    // Mars: der Anflug geht auf (0,0), das Fahrzeug wird danach von placeGroundBase neben dem
    // Flieger abgesetzt. Frueher stand hier zusaetzlich roverAnchor = {0,0} — nur eine Merkstelle
    // fuer das alte Ankersystem, jetzt gegenstandslos.
    setupApproach(key, 0, 0, 900, 400);
  }
  updateGroundTiles();
  placeGroundBase();
  showSpaceHint(b ? b.def.sym : '🌙');
  flashFade();
  console.log('[Ort] Oberfläche', key);
}
function leaveGround(){
  // Die Fahrzeugstellplaetze verfallen beim Verlassen des Himmelskoerpers: kommt man zurueck,
  // landet man woanders, und das Fahrzeug wird dort neu neben dem X-Wing abgesetzt.
  roverSpot.moon = null; roverSpot.mars = null;
  xwingSpot.moon = null; xwingSpot.mars = null;
  const from = locale;
  locale = 'space';
  warpDrive = 0; warpVis = 0; warpBrakeLock = 6;
  if(state.throttle > 0.5) state.throttle = 0.5;    // erst umschauen, nicht gleich in den Hyperraum
  clearGroundTiles();
  const b = bodyOf(from);
  // knapp über der Kugel wieder ins Weltall setzen (Fahrt und Blickrichtung bleiben)
  if(b) state.pos.copy(b.center).add(new THREE.Vector3(0, b.def.r*1.4, 0));
  snapCamera();                    // auch hier ein Sprung über Kilometer — Kamera mitnehmen
  for(const bb of bodies) if(bb.obj) bb.obj.visible = true;
  // Die Erde war als Kulisse am Himmel des Himmelskörpers unterwegs — zurück auf ihren Platz, sonst
  // steht sie als Kugel mitten im Flugraum und man fliegt hindurch.
  if(earthBall){ earthBall.position.copy(earthHome); earthBall.visible = true; }
  showSpaceHint('🚀');
  flashFade();
}
function updateLocale(){
  if(state.crashed || state.ejected || state.falling) return;
  // AM JETPACK zaehlt die Hoehe des ASTRONAUTEN, nicht die des stehenden Fliegers: er ist derjenige,
  // der hinausfliegt. Dieselben Schwellen wie beim Flieger — auf der Erde SPACE_Y, auf Mond und Mars
  // die Verlassehoehe des Ortes, im Hangar die Hallengrenzen. So kommt man ins Weltall, indem man
  // selbst hoch genug steigt; das Jetpack springt nicht mehr von allein dorthin.
  if(eva && eva.jet && locale !== 'space'){
    const jp = eva.group.position;
    if(locale === 'earth'){
      if(jp.y >= SPACE_Y) evaJetToSpace();
    } else if(locale === 'death'){
      // Aus der Halle hinaus: seitlich ueber HANGAR_OUT_R oder unten unter den Boden. Nach oben ist
      // die Decke fest, genau wie fuer den Flieger — dort stoesst man an und bleibt drin.
      const top = hangarCeilY - 7;
      if(jp.y > top){ jp.y = top; if(eva.jetVel && eva.jetVel.y > 0) eva.jetVel.y = 0; }
      if(Math.hypot(jp.x, jp.z) > HANGAR_OUT_R || jp.y < hangarFloorY - 20) evaJetToSpace();
    } else {
      const G = GROUNDS[locale];
      if(G && jp.y - surfaceY(jp.x, jp.z) > G.leave) evaJetToSpace();
    }
    return;
  }
  if(locale === 'earth'){
    if(state.pos.y >= SPACE_Y) enterSpace();
  } else if(locale === 'space'){
    // erledigt Anflug, Hyperraum-Bremse, Orbit-Grenze UND den Wiedereintritt an der Erdkugel —
    // aber NUR fuer den FLIEGER. Am Jetpack macht updateJet dieselbe Arbeit selbst, mit den
    // Astronauten-Wegen (evaEndJetToEarth, evaEndJetToGround, evaEndJetToHangar) und mit der
    // dockLock-Sperre.
    //
    // Liefe updateSpaceBodies am Jetpack mit, waere das ein sofortiger Rueckwurf: die Erd-Pruefung
    // dort fragt dockLock GAR NICHT ab und ruft enterEarth(true) direkt. Beim Austritt von der Erde
    // steht man 24.000 m vom Erdmittelpunkt entfernt, die Rueckkehrschale liegt bei 22.200 m — knapp
    // darueber, und im naechsten Frame zieht die Bremse einen wieder hinein oder man sinkt ein
    // Stueck und ist drin. Genau das war der gemeldete Reset „am uebergang zum weltall".
    if(!(eva && eva.jet)) updateSpaceBodies();
  } else if(locale === 'death'){
    // Die Decke ist fest — wer hochzieht, stößt an und bleibt drin. Vorher zählte "85 m über dem
    // Boden" als hinausgestiegen, also flog man einfach durch das Dach, während der Boden einen
    // Crash auslöst. Hinaus geht es durch die Öffnung (oder nach unten, wenn man den Boden verfehlt).
    const top = hangarCeilY - 7;
    if(state.pos.y > top){
      state.pos.y = top;
      if(state.vel.y > 0) state.vel.y = 0;
    }
    if(Math.hypot(state.pos.x, state.pos.z) > HANGAR_OUT_R ||
       state.pos.y < hangarFloorY - 20) leaveHangar();     // auch nach unten hinaus
  } else {
    const G = GROUNDS[locale];
    if(G && state.pos.y - surfaceY(state.pos.x, state.pos.z) > G.leave) leaveGround();
  }
}
// Auf welchen Himmelskörper fliegt man zu? Es zählt die Richtung, nicht die Entfernung — sonst
// springt die Anzeige beim Vorbeiflug auf einen Körper um, den man gar nicht ansteuert.
// Rückgabe: { def, dist } oder null.
const EARTH_TARGET = { key:'earth', sym:'🌍', r:EARTH_R };
function aimedBody(){
  if(!spacePlaced) return null;
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const to = new THREE.Vector3();
  // Die Erde steht nicht in der Körperliste (sie ist eine eigene Kugel), zählt aber als Ziel —
  // sonst zeigte die Anzeige beim Heimflug irgendeinen Himmelskörper statt der Erde.
  const cands = bodies.slice();
  cands.push({ def:EARTH_TARGET, center:earthHome });
  let best = null, bestDot = -2, nearest = null, nd = Infinity;
  for(const b of cands){
    to.copy(b.center).sub(state.pos);
    const d = Math.max(0, to.length() - b.def.r);
    if(d < nd){ nd = d; nearest = { def:b.def, dist:d, dot:-1 }; }
    const dot = to.normalize().dot(fwd);
    if(dot > bestDot){ bestDot = dot; best = { def:b.def, dist:d, dot }; }
  }
  return (bestDot > 0.2) ? best : nearest;      // fliegt er auf keinen zu, zeigt er den nächsten
}
// Himmelskörper an ihren Platz setzen und ein-/ausblenden. Läuft JEDEN Frame, weil die GLB-Modelle
// asynchron nachladen: wer schneller im Weltall ist als der Mond geladen war, hätte ihn sonst nie
// zu sehen bekommen (er wurde nur beim Eintritt einmal sichtbar geschaltet).
function placeBodies(){
  const show = (locale === 'space') && spacePlaced;
  for(const b of bodies){
    if(!b.obj) continue;
    b.obj.visible = show;
    if(show) b.obj.position.copy(b.center);
  }
  // Die Erdkugel ebenso jeden Frame nachziehen: laedt ihr Modell erst nach dem Weltraum-Eintritt
  // fertig, stuende sie sonst bei (0,0,0) statt an ihrem Platz.
  if(earthBall && show){ earthBall.position.copy(earthHome); earthBall.visible = true; }
  const here = bodyOf(locale);
  if(here && here.obj) here.obj.visible = false;                  // man steht darauf
  if(issObj){
    issObj.visible = (locale === 'space') && spacePlaced;
    if(issObj.visible) issObj.position.copy(issCenter);
  }
  placeGroundBase();          // Mondbasis / Mars-Rover ebenfalls jeden Frame nachziehen
}
// Himmelskörper im Weltall: Anflug, Hyperraum-Bremse und Orbit-Grenze.
// Gibt true zurück, wenn der Ort gewechselt wurde.
const _bodyDir = new THREE.Vector3();
// Kleinster Abstand des im letzten Frame geflogenen WEGSTÜCKS zu einem Punkt. Bei Warptempo legt der
// Flieger pro Frame hunderte Meter zurück — eine Prüfung der aktuellen Position allein übersieht
// eine Kugel, durch die er mitten hindurchgesprungen ist. Sprünge über 6 km sind keine Flugstrecke,
// sondern Ortswechsel; dann gilt wieder nur der Punkt.
const _segFrom = new THREE.Vector3(), _segAB = new THREE.Vector3(), _segAC = new THREE.Vector3();
let _segOk = false;
function pathDist(c){
  const dNow = state.pos.distanceTo(c);
  if(!_segOk) return dNow;
  _segAB.copy(state.pos).sub(_segFrom);
  const len2 = _segAB.lengthSq();
  if(len2 < 1 || len2 > 6000*6000) return dNow;
  _segAC.copy(c).sub(_segFrom);
  const k = Math.max(0, Math.min(1, _segAC.dot(_segAB)/len2));
  return Math.min(dNow, _segAC.sub(_segAB.multiplyScalar(k)).length());
}
// Hyperraum-Bremse für einen Körper: kurz davor herausfallen, damit man ihn in Ruhe ansehen kann —
// aber NUR beim Anflug. Die Fahrt muss zu mindestens 30 % auf ihn zeigen: mit einer reinen
// "größer null"-Prüfung reichte schon ein leichtes Schwenken beim Wegfliegen. Dazu ruht die Bremse
// kurz nach jedem Ortswechsel, weil man da noch dicht am Körper startet.
// Abstand, ab dem gebremst wird, als Vielfaches des Körperradius — und der Schub, auf den gedrosselt
// wird. Vorher r*3 und 50 %: beim Mars (30 km Radius) fiel man also 90 km vor der Oberfläche aus dem
// Hyperraum und kroch den Rest mit halber Fahrt. r*1,5 und 90 % lassen den Anflug zügig weitergehen.
const WARP_BRAKE_AT  = 1.5;
const WARP_BRAKE_THR = 0.9;
function warpBrakeFor(center, d, r){
  // Nie am Jetpack: dort gibt es keinen Hyperraum, aus dem man herausfallen koennte, und der
  // gedrosselte Schub war der gemeldete Ruecksprung von 100 % auf 90 %. warpDrive ist am Jetpack
  // jetzt ohnehin 0 (siehe updateWarp), aber die Bremse soll den Schub gar nicht erst anfassen.
  if(eva && eva.jet) return;
  if(d >= r*WARP_BRAKE_AT || warpDrive <= 0.02 || warpBrakeLock > 0) return;
  const v = state.vel.length();
  const toward = v > 1 ? state.vel.dot(_bodyDir.copy(center).sub(state.pos).normalize())/v : 0;
  if(toward > 0.3){
    warpDrive = 0;
    if(state.throttle > WARP_BRAKE_THR) state.throttle = WARP_BRAKE_THR;
    showSpaceHint('🛑', 2);
  }
}
function updateSpaceBodies(){
  if(!spacePlaced) return false;            // ohne gesetzte Zentren nichts prüfen
  // Die Erde ZUERST und wie jeden anderen Körper: sie steht nicht in bodies (sie ist eine eigene
  // Kugel), und genau deshalb griff bei ihr weder die Hyperraum-Bremse noch ein Wiedereintritt an
  // der Oberfläche. Der Wechsel hing allein an der Höhe (y < EARTH_Y) — wer seitlich zurückkam,
  // flog mitten durch die Erdkugel hindurch, und die Inselwelt erschien erst beim Absinken.
  // Gerechnet wird mit earthHome, nicht mit dem geladenen Modell: earth_glb.js kommt asynchron, und
  // wer schneller im Weltall ist als die Kugel fertig, hätte sonst keinen Weg zurück.
  {
    const dE = pathDist(earthHome);
    warpBrakeFor(earthHome, dE, EARTH_R);
    // Schale etwas über EARTH_Y, damit auch der senkrechte Rückflug hier landet (er kam früher über
    // den reinen Höhentest) — ein Kriterium für alle Richtungen.
    if(dE < EARTH_R + EARTH_Y){ enterEarth(true); _segOk = false; return true; }
  }
  for(const b of bodies){
    if(!b.obj) continue;
    const d = pathDist(b.center);
    warpBrakeFor(b.center, d, b.def.r);
    if(b.def.land){
      if(d < b.def.r + 1500){
        if(b.def.key === 'death'){
          if(enterHangar({ pos:b.center.clone(), up:b.def.r*1.4 })){ _segOk = false; return true; }
        }
        else { enterGround(b.def.key); _segOk = false; return true; }
      }
    } else if(d < b.def.r + 300){
      // Orbit-Grenze: nur die Bewegung ZUM Körper hin wird gestoppt, seitlich fliegt er weiter.
      // So kann man ihn umkreisen, ohne hineinzufliegen (Landung dort kommt später).
      const n = state.pos.clone().sub(b.center).normalize();
      const radial = state.vel.dot(n);
      if(radial < 0) state.vel.addScaledVector(n, -radial);
      state.pos.copy(b.center).addScaledVector(n, b.def.r + 300);
    }
  }
  // Erst wenn alle Prüfungen durch sind, wird die Position zum Startpunkt des nächsten Wegstücks.
  _segFrom.copy(state.pos); _segOk = true;
  return false;
}
// Hyperraum: kein Tor und kein Schalter — wer im Weltall 100 % hält, wird immer schneller
// (Antriebsaufbau bis Warp 10), und der Hyperraum blendet sich GLEITEND MIT DER GESCHWINDIGKEIT ein.
function updateWarp(dt){
  if(warpBrakeLock > 0) warpBrakeLock -= dt;
  if(dockLock > 0) dockLock -= dt;
  // Der Hyperraum baut auch am Jetpack auf: ohne ihn ist das Weltall unbenutzbar, weil der Mond
  // 150 km weit weg ist (siehe JET_VMAX). Was NICHT gilt, ist die Hyperraum-BREMSE — die
  // drosselte den Schub bei jedem Zuflug auf einen Koerper auf 90 %, und weil man im Jetpack
  // staendig in der Naehe von etwas ist, passierte das dauernd (siehe warpBrakeFor).
  const full = (locale === 'space' && state.throttle >= 0.999 && !state.crashed);
  warpDrive = full ? Math.min(1, warpDrive + dt/WARP_RAMP) : Math.max(0, warpDrive - dt*0.6);
  // Sicht-Anteil rein aus dem Tempo: der Ring erscheint erst AB Lichtgeschwindigkeit (Warp 1) und
  // ist bei Warp 10 voll da.
  const warp = (locale === 'space') ? state.vel.length()/SPACE_C : 0;
  const wv = Math.max(0, Math.min(1, (warp - 1.0) / (WARP_MAX - 1.0)));
  const before = warpVis;
  warpVis += (wv - warpVis) * Math.min(1, 4*dt);        // sanft nachziehen, kein Aufblitzen
  if(before <= 0.02 && warpVis > 0.02){ playSonicBoom(); rumble(350, 0.8, 0.6); }   // Warp-Schwelle
  warpSpin += dt*3;
  if(warpRing){
    warpRing.visible = warpVis > 0.01;
    if(warpRing.visible){
      const jetAn = !!(eva && eva.jet);
      // Am Jetpack auf die KOERPERMITTE, nicht auf eva.group.position: das ist die Fusshoehe (der
      // Astronaut wird mit den Fuessen auf y = 0 gesetzt, siehe preloadAstronaut). Der Ring sass also
      // um seine Fuesse, und er stand um eine halbe Koerperlaenge zu hoch darin.
      // ASTRONAUT_H*0.5 ist die Mitte — und zwar entlang seiner MITGEKIPPTEN Hochachse, sonst wandert
      // die Mitte beim Nicken aus dem Ring heraus.
      if(jetAn){
        const mitte = new THREE.Vector3(0, ASTRONAUT_H*0.5, 0)
          .applyEuler(new THREE.Euler(eva.jetPitch, eva.yaw, eva.jetRoll || 0, 'YXZ'));
        warpRing.position.copy(eva.group.position).add(mitte);
      } else {
        warpRing.position.copy(state.pos);
      }
      // Ausrichtung: am JETPACK aus yaw und Nickwinkel des Astronauten, sonst aus der Fliegerlage.
      // updateJet setzt state.quat nie — der Ring behielt also die Lage, die der Flieger beim
      // Aussteigen hatte, und stand schief zur Flugrichtung. Genau das war das gemeldete
      // „sieht aus als waere er nach rechts verdreht": man steigt im Hangar mit yaw -1,57 aus
      // (Nase zum Ausgang), fliegt dann in eine andere Richtung, und der Ring blieb quer stehen.
      if(jetAn){
        // GENAU dieselbe Lage wie der Astronaut selbst (siehe updateJet): +jetPitch, yaw, jetRoll.
        // Zwei Fehler steckten hier: das Vorzeichen des Nickwinkels war negativ (dieselbe Verwechslung
        // wie beim Modell — eine Nase auf -Z wird von +pitch gehoben), und die Querlage fehlte ganz.
        // Damit stand der Ring bei jedem Steigflug und in jeder Kurve anders als der Astronaut, und
        // weil die Kamera mit IHM dreht, sah der Ring im Bild aus, als bliebe er stehen.
        warpRing.quaternion.setFromEuler(
          new THREE.Euler(eva.jetPitch, eva.yaw, eva.jetRoll || 0, 'YXZ'));
      } else {
        warpRing.quaternion.copy(state.quat);
      }
      warpRing.rotateZ(warpSpin);
      // Groesse: der Ring ist auf 44 m Aussendurchmesser gebaut — passend um einen 11 m breiten
      // X-Wing. Um einen 1,9 m grossen Astronauten ist das ein Reifen, in dem er verloren wirkt,
      // und die Kamera sitzt naeher dran als beim Flieger. Am Jetpack deshalb auf 40 %.
      const s = (1 + warpVis*0.4) * (jetAn ? 0.4 : 1);
      warpRing.scale.set(s, s, s);
      if(warpMat) warpMat.opacity = 0.15 + 0.6*warpVis;
    }
  }
  // Himmelskörper langsam drehen (die Sonne etwas flotter)
  if(locale === 'space'){
    for(const b of bodies) if(b.obj) b.obj.rotation.y += dt * (b.def.key === 'sun' ? 0.05 : 0.02);
    if(issObj && issObj.visible){ issObj.rotation.y += dt*0.08; issObj.rotation.z += dt*0.03; }
  }
}
// Sanfter Übergang Himmel -> Weltall: Farben, Nebel, Licht, Sterne, Erdkugel.
function updateSpaceBlend(dt){
  const target = (locale === 'earth')
    ? Math.max(0, Math.min(1, (state.pos.y - ATMO_TOP)/(SPACE_Y - ATMO_TOP))) : 1;
  placeBodies();
  spaceBlend += (target - spaceBlend) * Math.min(1, 3*dt);
  const f = spaceBlend;
  // Kamera-Mitrollen nur im echten Weltall — nicht auf Mond/Mars und nicht im Hangar, wo es
  // wieder einen Boden gibt, an dem man sich ausrichtet.
  const rollTarget = (locale === 'space') ? 1 : 0;
  camRoll += (rollTarget - camRoll) * Math.min(1, CAM_ROLL_RATE*dt);
  _skyC.copy(SKY_DAY).lerp(SKY_SPACE, f);
  scene.background.copy(_skyC);
  scene.fog.color.copy(_skyC);
  scene.fog.near = 900  + f*200000;         // Nebel praktisch aus, sobald es dunkel wird
  scene.fog.far  = 3000 + f*1500000;
  // Streulicht im All von 0,15 auf 0,45 (1,0 - 0,55*f): mit 0,15 blieb praktisch nur die Sonne, und
  // die kommt aus einer festen Richtung — wer von ihr wegfliegt, sieht seinen eigenen Flieger als
  // Silhouette. Gewuenscht als "den xwing etwas heller lassen, so dass er auch im dunkeln immer gut
  // zu erkennen ist". Physikalisch gibt es im Vakuum kein Streulicht, aber ein unsichtbares
  // Fahrzeug ist der schlechtere Tausch.
  // Der HIMMEL bleibt davon unberuehrt: er ist scene.background, und Sterne wie Panorama sind
  // MeshBasic — beides ist lichtunabhaengig.
  hemiLight.intensity = 1.0  - 0.55*f;
  sun.intensity       = 0.85 + 0.35*f;      // dafür knallt die Sonne härter
  if(starDome){
    starDome.visible = f > 0.02;
    starDome.position.copy(state.pos);      // Kuppel bleibt immer gleich weit weg
    if(starMat) starMat.opacity = f;
  }
  updateMilkyWay(f);                        // Sternband, mit demselben Wert eingeblendet
  // Auf Mond UND Mars hängt die Erde als Kugel am Himmel und wandert mit (wie eine Kulisse).
  // Ohne das Umsetzen stünde sie weiter dort, wo sie beim Verlassen der Atmosphäre lag — nämlich
  // mit dem Mittelpunkt 20 km unter dem Startpunkt, also als "Unterbau" unter der Landschaft.
  if(GROUNDS[locale] && earthBall){
    earthBall.visible = true;
    earthBall.position.set(state.pos.x + 90000, 45000, state.pos.z - 60000);
  }
  // UNTER WASSER zaehlt nichts von dem oben: dort ist der Himmel gruen-blau und die Sicht endet
  // nach wenigen Dutzend Metern. Das laeuft NACH dem Weltall-Blend, damit es dessen Werte
  // ueberschreibt statt mit ihnen zu ringen — im Wasser ist man nie im Weltall, die beiden
  // Zustaende schliessen sich aus.
  updateUnderwater(dt);
}
// ---------- Unterwasser-Sicht -----------------------------------------------------------------
// Drei Dinge machen den Unterschied zwischen "die Kamera ist unter Null" und "ich bin im Meer":
//   1. NEBEL. An Luft steht er auf 900/3000 m. Im Wasser sieht man 20-40 m weit, nicht 3 km.
//      Das ist der wichtigste Punkt — ohne ihn sieht Unterwasser aus wie Ueberwasser mit
//      blauem Anstrich.
//   2. FARBE. Sie wird MIT DER TIEFE dunkler: an der Oberflaeche tuerkis, auf 200 m fast schwarz.
//      Rot verschwindet im Wasser zuerst, deshalb laeuft die Tiefenfarbe nach Blaugruen und nicht
//      nach Grau.
//   3. LICHT. Die Sonne kommt nicht mit: auf Tiefe bleibt Streulicht von oben.
// Geblendet wird ueber uwBlend, damit das Durchtauchen der Oberflaeche kein Schnitt ist. Der Wert
// laeuft in UW_RATE pro Sekunde nach — bei 2,5 ist der Wechsel in 0,4 s durch, also sichtbar als
// Uebergang, aber ohne Wartezeit.
// Wo der Nebel ANFAENGT. 3 m war der Hauptgrund fuer den milchigen Eindruck: schon direkt vor der
// Linse lag Schleier, also auch ueber dem eigenen Boot. Mit Abstand bleibt der Nahbereich klar und
// erst die Ferne faerbt sich ein — das ist der Unterschied zwischen durchsichtigem Wasser und
// Suppe, und er wirkt staerker als jede Erhoehung der Sichtweite.
//
// 22 m: die Kamera steht 76,8 m hinter der Bootsmitte, das Heck ist also 29,8 m weg. Der Nebel
// soll VOR dem Heck anfangen, damit der Rumpf einen leichten Schleier bekommt und nicht aufgeklebt
// wirkt — aber nicht direkt an der Linse, sonst ist alles milchig (mit 3 m war genau das der Fall).
const UW_FOG_NEAR = 22;
// Sichtweiten deutlich hochgesetzt (42 -> 75 an der Oberflaeche, 16 -> 38 unten). Gewuenscht war
// "etwas mehr licht", und die Sichtweite gehoert dazu: 42 m sind fuer ein 95 m langes U-Boot
// weniger als eine halbe Bootslaenge, man sah nie mehr als einen Ausschnitt des eigenen Rumpfes.
// Mit 75 m ist der ganze Rumpf im Bild und der Grund taucht als Flaeche auf, nicht als Kante,
// die aus dem Nichts kommt. Klares tropisches Wasser gibt real 30 bis 50 m Sicht — 75 m sind
// grosszuegig, aber das ist eine Kinderwelt mit Korallen und Fischschwaermen, und die soll man
// sehen. Der Nebel BLEIBT deutlich (75 m gegen 3.000 m an Luft), es ist also weiter Unterwasser.
const UW_FOG_FAR  = 180;    // m Sichtweite knapp unter der Oberflaeche
// Am Grund fast dieselbe Sichtweite wie oben (165 gegen 180 m). Vorher waren es 135 m, und das war
// die Ursache fuer "in der tiefsee sieht man nichts": der Bug liegt schon 123,8 m von der Kamera
// entfernt, der Meeresboden zieht sich vom Boot bis zum Horizont, und bei flachem Blickwinkel
// liegt der groesste Teil davon jenseits der Sichtgrenze.
// Der geringe Unterschied bleibt als Andeutung von Tiefe — mehr braucht es nicht, weil es "fuer ein
// kind keinen unterschied macht ob im flachen oder tiefen wasser".
const UW_FOG_DEEP = 165;
// Farben heller und klarer: das alte UW_DEEP (0x02141c) war praktisch schwarz, und mit SEA_DEPTH
// auf 100 m erreicht man diese Tiefe jetzt auch wirklich — vorher lag sie unter dem, was man beim
// Spielen sah. Das neue Tief ist ein tiefes Blaugruen: dunkel genug, dass Tiefe sich nach Tiefe
// anfuehlt, hell genug, dass man Wrack, Grund und Fische darin erkennt.
const UW_SURF = new THREE.Color(0x62c3cc);   // Wasserfarbe knapp unter der Oberflaeche (Lagune)
// Am Grund nur noch etwas dunkler als oben (war 1c5f6e). Aus demselben Grund wie die Sichtweite:
// die Tiefe soll das Bild nicht zuziehen.
const UW_DEEP = new THREE.Color(0x3f97a5);
const UW_RATE = 2.5;
// TOTZONE unter der Wasserlinie: bis hierher bleibt das Bild ueber Wasser. Der Grund steht im
// Screenshot: bei Tiefe 1 m lag schon ein Drittel Unterwasserfarbe ueber dem Bild, obwohl das Boot
// mit dem Turm heraussah — gemeldet als "es gibt immer noch einen einfluss auf wellen und sicht auf
// der meeresoberflaeche". 3 m sind bei einem 13 m dicken Rumpf "Deck gerade nass", und sie decken
// den Wellenhub (2,49 m) mit ab: eine ueberlaufende Welle kann den Wert nicht mehr anheben.
const UW_DIVE_START = 3;
// Und ueber welche weitere Strecke dann eingeblendet wird: von 3 bis 8 m Tiefe. Bei 8 m ist der
// Turm sicher unter Wasser, dort gehoert die volle Unterwassersicht hin.
const UW_DIVE_BAND = 5;
// Eigener Blend-Wert fuer den Kamera-Zug, und der Grund dafuer ist wichtig: er darf NICHT uwBlend
// sein. uwBlend kommt aus cameraDepth(), also aus der Kamerahoehe — wuerde der Zug daran
// haengen, haette man einen Kreis: Zug senkt die Kamera, Kamera ist unter Wasser, Zug wird
// staerker; taucht die Kamera aus, faellt der Zug weg, sie steigt weiter, im naechsten Frame
// wieder umgekehrt. Genau die Sorte Schwingung, die als Zittern im Bild ankommt.
//
// uwCamBlend haengt deshalb am FAHRZEUG: dessen Tiefe rechnet niemand aus der Kamera zurueck,
// die Kette ist also gerichtet. Und inhaltlich ist es auch das Richtige — nah heran soll die
// Kamera, wenn das BOOT taucht, nicht erst wenn die Linse nass wird.
let uwCamBlend = 0;
function updateUwCamBlend(dt){
  // NUR DAS U-BOOT taucht. Das klingt selbstverstaendlich, war aber der Fehler: vorher wurde die
  // Tiefe aus der Hoehe abgeleitet (-state.pos.y), und damit galt jedes Boot als getaucht — denn
  // y = 0 ist die WASSERLINIE, und ein Rumpf liegt konstruktiv darunter. stepBoat setzt
  // pos.y = seaSurfaceY - BOAT_DRAFT, das Feuerwehrboot faehrt also dauerhaft 1,1 m unter Null und
  // schwankt mit der Welle zwischen -3,4 und +1,4 m. clamp(-y/3) lieferte dort 0,37 bis 1,0, und
  // weil uwBlend das Maximum nimmt, lag ueber dem offenen Meer Unterwassernebel — im Wellentakt
  // schwankend. Gemeldet als "die sicht auf der erde hat jetzt eine abhaengigkeit zur welle".
  //
  // Also nicht raten, sondern fragen, wer tauchen KANN. Alles andere schwimmt, wie tief sein Rumpf
  // auch sitzt. Gemessen wird dann gegen die WASSERLINIE an dieser Stelle (seaYAt) und nicht gegen
  // y = 0: das U-Boot liegt aufgetaucht selbst auf der Welle, mit y = 0 als Bezug haette es im
  // Wellental schon als getaucht gegolten.
  //
  // UW_DIVE_BAND (3 m) ist der Uebergang zur vollen Unterwassersicht. Er ist groesser als der
  // Wellenhub, also kann eine einzelne Welle den Wert nicht durchreissen.
  let ziel = 0;
  if(locale === 'earth' && isSub() && !eva){
    const tiefe = seaYAt(state.pos.x, state.pos.z) - state.pos.y;
    // Erst ab der Totzone anfangen (siehe UW_DIVE_START), dann ueber UW_DIVE_BAND einblenden.
    const roh = Math.min(1, Math.max(0, (tiefe - UW_DIVE_START) / UW_DIVE_BAND));
    ziel = roh*roh*(3 - 2*roh);      // smoothstep: laeuft an beiden Enden weich aus
  }
  uwCamBlend += (ziel - uwCamBlend) * Math.min(1, UW_RATE*dt);
}
let uwBlend = 0;            // 0 = an Luft, 1 = unter Wasser
const _uwC = new THREE.Color();
// Wie tief ist die KAMERA unter der Wasserflaeche? Positiv = drunter, negativ = drueber.
// Gefragt ist die Kamera und nicht das Fahrzeug: entscheidend ist, was man SIEHT. Beim getauchten
// U-Boot haengt die Kamera hinter dem Turm und kann noch heraussehen, wenn das Boot knapp unter
// der Oberflaeche fährt — dann soll das Bild auch nicht gruen sein.
//
// Als MASS und nicht als ja/nein: daraus wird der Blendwert (siehe updateUnderwater), und genau
// der Unterschied hat das Aufblitzen an der Oberflaeche behoben. Die frueher hier stehende
// Funktion cameraUnderwater() ist deshalb entfallen — sie gab ein true/false zurueck, das nach
// dem Umbau niemand mehr brauchte.
function cameraDepth(){
  if(locale !== 'earth') return -1e9;
  return seaYAt(camera.position.x, camera.position.z) - camera.position.y;
}
// Ueber welche Strecke der Wechsel Luft <-> Wasser laeuft. 1,5 m ist etwa eine Kopfhoehe: taucht
// die Linse ein, ist das Bild nach anderthalb Metern voll unter Wasser. Kuerzer waere wieder ein
// Schalter, laenger wuerde das Wasser noch in 5 m Tiefe halb durchsichtig wirken.
const UW_BAND = 1.5;
// Geometrisch (multiplikativ) blenden statt linear. Fuer Groessen, bei denen das VERHAELTNIS zaehlt
// und nicht die Differenz — Sichtweiten sind genau so eine: der Schritt von 3.000 auf 1.500 m ist
// im Bild kaum zu sehen, der von 300 auf 150 m sehr wohl. Beide sind aber derselbe Faktor.
// Beide Werte muessen positiv sein (Nebelabstaende sind das immer).
function uwGeoBlend(von, nach, b){
  if(von <= 0 || nach <= 0) return von + (nach - von)*b;   // Notausgang, sollte nie greifen
  return Math.exp(Math.log(von) + (Math.log(nach) - Math.log(von))*b);
}
function updateUnderwater(dt){
  updateUwCamBlend(dt);          // Kamera-Zug (eigener Wert, siehe dort — nicht uwBlend)
  // GLEITENDER Zielwert statt 0/1. Der harte Boolean liess den Nebel an der Oberflaeche
  // aufblitzen: gemessen sprang die Sichtweite bei 3 m Bootstiefe zwischen 79,7 und 3.000 m,
  // also um Faktor 38, jedes Mal wenn eine Welle ueber die Linse lief (8-mal in 20 s). Mit dem
  // Band bleibt eine ueberspuelte Linse ein Waschen und wird kein Blitz.
  //
  // smoothstep obendrauf, damit auch die ERSTE Ableitung stetig ist: an beiden Enden des Bandes
  // laeuft die Aenderung aus, statt mit einer Kante anzufangen. Denselben Weg gehen die Wellen
  // am Schelf (seabedY) und der Orca-Tauchbogen — im Bild ist eine Kante immer zu sehen.
  // Die LINSE: erst ab einem halben Meter unter der Flaeche zaehlt sie als eingetaucht. Ohne diesen
  // Vorlauf schaltete schon eine Kraeuselung das Bild um, wenn die Kamera genau auf der Hoehe der
  // Wasserlinie schwebt.
  const roh = Math.min(1, Math.max(0, (cameraDepth() - 0.5) / UW_BAND));
  const kamZiel = roh*roh*(3 - 2*roh);
  // IM U-BOOT entscheidet ALLEIN das Boot, die Kamera zaehlt dort gar nicht. Der Grund ist
  // nachgerechnet: die Verfolgerkamera kippt mit der Nase mit, und weil sie 76,8 m hinter dem Boot
  // sitzt, hebt dieser Abstand sie bei Tauchlage weit an — 31,5 m ueber dem Boot bei 15 Grad,
  // 48,8 m bei den 30 Grad, die SUB_PMAX erlaubt. Die Linse war damit erst ab rund 50 m Bootstiefe
  // nass, und weil der Nickwinkel beim Steuern dauernd wechselt, wanderte sie um Dutzende Meter
  // auf und ab: "wechselt erst ab einer tiefe von ca 50 m komplett unter wasser. vorher schwingt
  // sie, je nach neigungswinkel des uboots immer hin und her".
  //
  // Die Kamera bleibt nur fuer den Fall, fuer den sie gedacht war: Fahrzeuge, die NICHT tauchen,
  // deren Linse aber in eine Welle geraet — Schlauchboot im Wellenberg, zu Fuss in der Brandung.
  const ziel = isSub() ? uwCamBlend : Math.max(kamZiel, uwCamBlend);
  uwBlend += (ziel - uwBlend) * Math.min(1, UW_RATE*dt);
  if(uwBlend < 0.002){
    uwBlend = 0;
    // An Luft gelten die Werte von updateSpaceBlend — nur das Unterwasser-Ambient muss hier aus,
    // denn updateSpaceBlend kennt es nicht und wuerde es stehen lassen.
    uwAmbient.intensity = 0;
    return;
  }
  // Tiefenanteil: 0 an der Oberflaeche, 1 auf SEA_DEPTH. Gerechnet wird mit der TIEFEREN von
  // Kamera und Fahrzeug — bei getauchtem Boot haengt die Kamera bis zu 5 m hoeher, und mit ihrem
  // Wert allein waere die Farbe eine Spur zu hell fuer die Tiefe, in der man wirklich faehrt.
  // Farbtiefe: im U-Boot zaehlt DAS BOOT, nicht die Kamera. Sonst wandert die Wasserfarbe mit dem
  // Nickwinkel, weil die mitkippende Kamera bis 49 m ueber oder unter dem Boot haengt (siehe oben).
  // Ausserhalb des U-Boots die Kamera, denn dort gibt es kein Tauchen und die Linse entscheidet.
  const tiefRef = (locale === 'earth' && isSub() && !eva) ? state.pos.y : camera.position.y;
  const tief = Math.min(1, Math.max(0, -tiefRef / SEA_DEPTH));
  _uwC.copy(UW_SURF).lerp(UW_DEEP, tief);
  const b = uwBlend;
  scene.background.lerp(_uwC, b);
  scene.fog.color.lerp(_uwC, b);
  const far = UW_FOG_FAR + (UW_FOG_DEEP - UW_FOG_FAR)*tief;
  // GEOMETRISCH blenden, nicht linear — das war der Grund fuer den holprigen Uebergang.
  // Linear gerechnet (far + (uw-far)*b) blieben bei halbem Blendwert noch 1.575 m Sichtweite von
  // 3.000: die erste Haelfte des Uebergangs war unsichtbar, und die ganze Aenderung fiel in die
  // letzten 5 % — also 1,2 s nichts und dann ein Ruck.
  //
  // Sichtweite wirkt multiplikativ: von 3.000 auf 1.500 m sieht man kaum, von 300 auf 150 m ist
  // ein Weltunterschied. Ueber den Logarithmus geblendet ist jeder Schritt gleich stark sichtbar
  // (b=0,5 gibt 671 m statt 1.575 m), der Wechsel laeuft also gleichmaessig durch.
  scene.fog.near = uwGeoBlend(scene.fog.near, UW_FOG_NEAR, b);
  scene.fog.far  = uwGeoBlend(scene.fog.far,  far,         b);
  // Licht: die Sonne dringt gedaempft ein, das Streulicht von oben bleibt. Eine Daempfung mit der
  // Tiefe muss sein — ohne sie stuenden die Wracks unten im hellen Sonnenlicht.
  //
  // Sie war aber ZU STARK: 1 - 0,75*tief liess am Grund nur ein Viertel des Streulichts uebrig,
  // und weil tief ueber SEA_DEPTH lief, war das bei 200 m Tiefe der Normalfall. Nachgemessen kam
  // das Streulicht auf 180 m bei 0,37 an und die Sonne bei 0,10 — dazu 19 m Sichtweite. Unten war
  // es damit praktisch Nacht, gemeldet als "ich haette unter wasser gerne etwas mehr licht".
  //
  // Jetzt bleibt am Grund die HAELFTE (1 - 0,5*tief), und der Grundwert des Streulichts steigt von
  // 1,05 auf 1,35. Am Grund sind das 1,35*0,5 = 0,68 statt 0,26 — also gut das Zweieinhalbfache.
  // Die Sonne zieht mit (0,28 -> 0,40): sie gibt die Richtung, aus der das Licht einfaellt, und
  // ohne sie wirkt alles flach ausgeleuchtet statt "von oben".
  // Zweite Aufhellung, gewuenscht als "die ganze optik kann gerne etwas heller sein". Am Grund
  // bleiben jetzt 70 % des Lichts statt 50 %, und der Grundwert steigt auf 1,6 — dort also 1,12
  // gegen zuvor 0,68 und gegen 0,26 im Ursprungszustand. Die Sonne zieht mit (0,55): sie gibt die
  // Richtung, aus der das Licht einfaellt, und ohne sie wirkt alles flach.
  // Die Tiefe daempft nur noch WENIG (0,08 statt 0,3): ausdruecklich gewuenscht, weil es "fuer ein
  // kind keinen unterschied macht ob im flachen oder tiefen wasser". Am Grund bleiben damit 92 %
  // des Lichts statt 70 %. Ein kleiner Rest Verlauf bleibt, damit Tiefe ueberhaupt spuerbar ist.
  const dunkel = 1 - 0.08*tief;
  hemiLight.intensity = hemiLight.intensity + (1.75*dunkel - hemiLight.intensity)*b;
  sun.intensity       = sun.intensity       + (0.60*dunkel - sun.intensity      )*b;
  // Das richtungslose Licht (siehe uwAmbient): es macht aus der schwarzen Bootssilhouette einen
  // Koerper und hebt den Meeresboden vom Wasser ab. 0,75 ist kraeftig, aber unter Wasser gehoert
  // das so — dort gibt es kaum Schatten, weil das Licht an jedem Wasserteilchen gestreut wird.
  uwAmbient.intensity = uwAmbient.intensity + (0.95*dunkel - uwAmbient.intensity)*b;
}

// ---------- Weltraum-Anzeige über dem Flieger ----------
// Gleiche Machart und Größe wie die Wassertropfen/Kisten: ein 60-px-Symbol, das an die projizierte
// Position über dem Flugzeug gesetzt wird. Zeigt Ort, das angeflogene Ziel mit Entfernung und die
// Trefferzahl — auf der Erde bleibt es leer (dort erscheinen dort Tropfen und Kisten).
// Kurzes Abdunkeln: der Wechsel zwischen Weltall und Oberfläche ist ein harter Schnitt (die
// Landschaft ist eine flache Kachelwelt, der Himmelskörper eine Kugel). Ein 0,4 s langes Aufblenden
// aus Schwarz kaschiert ihn, ohne dass eine echte Kamerafahrt nötig wäre.
let fadeEl = null, fadeT = 0, fadeDur = 0.4, fadeHold = 0;
function ensureFadeEl(){
  if(fadeEl) return;
  fadeEl = document.createElement('div');
  fadeEl.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;'
    + 'display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;'
    + 'font-family:system-ui,sans-serif;';
  document.body.appendChild(fadeEl);
}
function flashFade(dur){
  ensureFadeEl();
  fadeEl.textContent = '';
  fadeHold = 0; fadeDur = dur || 0.4; fadeT = fadeDur;
}
// Startvorhang: schwarz bleiben, bis der Hangar geladen ist und der Wechsel dorthin erfolgt ist.
// Ohne ihn sah man den X-Wing erst zwei Sekunden auf der Insel — das Spiel beginnt aber immer im
// Todesstern. Die Wartezeit selbst bleibt nötig, weil danach noch GLB-Callbacks die Position
// verschieben. Hebt sich notfalls auch von selbst, falls der Hangar nie fertig wird.
function startCurtain(sec){
  ensureFadeEl();
  fadeEl.textContent = '🚀 startet …';
  fadeEl.style.opacity = '1';
  fadeHold = sec;
}
function updateFade(dt){
  if(!fadeEl) return;
  if(fadeHold > 0){
    fadeHold -= dt;
    fadeEl.style.opacity = '1';
    if(fadeHold <= 0) flashFade(0.6);
    return;
  }
  if(fadeT <= 0) return;
  fadeT -= dt;
  fadeEl.style.opacity = String(Math.max(0, Math.min(1, fadeT/fadeDur)));
}
let spaceEl = null, spaceHintT = 0, spaceHintTxt = '', lastAimKey = '';
let aimCand = '', aimCandT = 0;     // Kandidat für einen echten Zielwechsel + wie lange schon
const _spaceV = new THREE.Vector3();
// Kurz etwas über dem Flieger zeigen (Standard 3 s). Wird bei jedem neuen Ereignis neu gestartet,
// bei Trefferserien bleibt der Zähler also stehen, solange es weiterknallt.
function showSpaceHint(txt, sec){ spaceHintTxt = txt; spaceHintT = (sec === undefined) ? 3 : sec; }
function updateSpaceHint(dt){
  if(!spaceEl){
    spaceEl = document.createElement('div');
    spaceEl.style.cssText = 'position:absolute;font-size:60px;opacity:0;transition:opacity .3s;'
      + 'pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap;'
      // weiß, weil die Zahl beim Asteroidenzähler sonst schwarz auf schwarzem Weltall stand
      + 'color:#fff;text-shadow:2px 2px 6px rgba(0,0,0,0.8);';
    document.body.appendChild(spaceEl);
  }
  // Nur bei einem ECHTEN Statuswechsel aufblitzen: er muss den Körper eng anfliegen (Winkel > ~25°
  // genau) und das mindestens eine Sekunde halten. Sonst würde die Anzeige beim Herumkurven ständig
  // neu getriggert und stünde praktisch dauerhaft im Bild. Gezeigt wird nur das Symbol.
  if(locale === 'space'){
    const aim = aimedBody();
    const key = (aim && aim.dot > 0.9) ? aim.def.key : '';
    if(key && key !== lastAimKey){
      if(key === aimCand){
        aimCandT += dt;
        if(aimCandT >= 1.0){
          if(aim.def.sym) showSpaceHint(aim.def.sym);    // Körper ohne Symbol melden sich nicht
          lastAimKey = key; aimCand = ''; aimCandT = 0;
        }
      } else { aimCand = key; aimCandT = 0; }
    } else if(!key){ aimCand = ''; aimCandT = 0; }   // lastAimKey bleibt: kein Neu-Auslösen
  } else { lastAimKey = ''; aimCand = ''; aimCandT = 0; }

  if(spaceHintT <= 0){ spaceEl.style.opacity = '0'; return; }
  spaceHintT -= dt;
  if(spaceHintT <= 0){ spaceEl.style.opacity = '0'; return; }
  spaceEl.textContent = spaceHintTxt;
  _spaceV.set(state.pos.x, state.pos.y + 16, state.pos.z).project(camera);
  spaceEl.style.left = ((_spaceV.x*0.5+0.5)*innerWidth) + 'px';
  spaceEl.style.top  = ((-_spaceV.y*0.5+0.5)*innerHeight) + 'px';
  spaceEl.style.opacity = (_spaceV.z < 1) ? '1' : '0';       // nur wenn vor der Kamera
}

// ---------- Start- und Landeverkehr an Basis bzw. Rover ----------
// Zwei Schiffe pendeln dauerhaft: aufsteigen, verschwinden, an anderer Stelle wieder herunterkommen,
// kurz stehen, wieder los. Sie nutzen dieselben Modelle wie der Weltraumverkehr (geklont, also ohne
// zusätzlichen Speicher) und lassen sich nicht rammen — sie sind Kulisse.
const PAD_CLIMB = 70;              // m/s beim Auf- und Absteigen
const PAD_TOP = 1400;              // Höhe, in der sie verschwinden bzw. auftauchen
const shipTpl = {};                // key -> Vorlage zum Klonen
const pads = [];                   // { obj, phase, t, x, z, hold }
// Auf dem Landeplatz sollen alle gleich groß wirken (die Enterprise ist im All 640 m lang) und wie
// der X-Wing senkrecht auf- und absteigen: waagerecht bleiben, nur Höhe ändern. Dazu wird jeder
// Klon auf PAD_LEN normiert und so verschoben, dass seine UNTERSEITE auf dem Boden sitzt.
const PAD_LEN = 34;
function ensurePads(){
  if(pads.length >= 2) return;
  const keys = Object.keys(shipTpl);
  if(!keys.length) return;
  while(pads.length < 2){
    const tpl = shipTpl[keys[pads.length % keys.length]];
    const inner = tpl.wrap.children[0].clone(true);
    inner.scale.multiplyScalar(PAD_LEN / tpl.def.len);
    // Die Ariane 6 wird hier AUFGERICHTET: sie ist im GLB aufrecht modelliert (Laengsachse Y,
    // 62 m), und SHIP_DEFS legt sie mit rot [-PI/2,0,0] auf die Seite, damit sie im Weltall wie
    // alle anderen mit der Nase auf -Z zieht. Auf einem Landeplatz ist das falsch — eine Rakete
    // landet und startet senkrecht. Gemessen lag sie mit 34,00 m Laenge auf dem Boden statt 34,0 m
    // hoch zu stehen. Die Drehung wird deshalb NUR fuer den Landeplatz zurueckgenommen; im
    // Weltall bleibt sie waagerecht. Sie steht im GLB um X und Z mittig (0,037 / 0,054 m), bleibt
    // beim Aufrichten also an ihrem Platz.
    const aufrecht = (tpl.def.key === 'rocket');
    if(aufrecht) inner.rotation.set(0, 0, 0);
    const holder = new THREE.Group();
    holder.add(inner);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(holder);
    inner.position.y -= box.min.y;                    // Unterseite auf y = 0 des Halters
    holder.visible = false; scene.add(holder);
    // Höhe merken: die Schiffe werden auf dieselbe LÄNGE normiert, sind dabei aber sehr
    // unterschiedlich hoch (gemessen: Enterprise 7,42 m als flache Untertasse, Shuttle 12,12 m).
    // Der Aufsetz-Aufschlag muss deshalb pro Schiff verschieden sein, sonst versinkt das flachste
    // im Boden, sobald das Höhenprofil ein paar Meter danebenliegt.
    const hBox = new THREE.Box3().setFromObject(holder);
    const hSize = new THREE.Vector3(); hBox.getSize(hSize);
    // Bei der aufrechten Rakete ist die Hoehe das FALSCHE Mass: 34 m x PAD_LIFT_FRAC waeren 15,3 m
    // Aufschlag, sie schwebte also sichtbar ueber dem Boden. Der Aufschlag soll ja nur verhindern,
    // dass ein FLACHES Schiff im Hoehenraster versinkt — eine 34 m hohe Rakete kann das gar nicht.
    // Fuer sie zaehlt deshalb ihr Grundriss (3,3 m), nicht ihre Hoehe.
    const hMass = aufrecht ? Math.min(hSize.x, hSize.z) : hSize.y;
    pads.push({ obj:holder, phase:'down', t:0, x:0, z:0, hold:0, yaw:Math.random()*Math.PI*2,
                h:Math.max(1, hMass) });
  }
}
// Aufschlag über dem gemessenen Boden. Das Höhenraster kann eine Kuppe abschneiden, und das
// Höhenprofil der Mondbasis ist eine Interpolation — beides liegt um Meter daneben. Ein FESTER
// Aufschlag von 3 m genügte deshalb nicht: er ist für ein 12 m hohes Shuttle reichlich, aber die
// nur 7,4 m flache Enterprise verschwand im Boden (beobachtet und nachgemessen). Jetzt ist der
// Aufschlag ein Anteil der Schiffshöhe, mit 3 m als Untergrenze — so ragt jedes Schiff gleich
// deutlich heraus, egal wie flach es gebaut ist.
const PAD_LIFT = 3;                // Mindest-Aufschlag (m)
const PAD_LIFT_FRAC = 0.45;        // zusätzlich dieser Anteil der eigenen Schiffshöhe
// Aufsetzhöhe eines Landeplatzes: auf dem Mond aus dem vermessenen Profil der Basisfläche, gerechnet
// von der Höhe, auf der die Basis tatsächlich steht. Bewusst OHNE Raycast — ein Raycast arbeitet mit
// obj.matrixWorld, und die aktualisiert three.js erst beim Rendern, während placeGroundBase() die
// Basis erst NACH updatePads() setzt. Landeplätze, die in so einem Frame entstanden, fielen deshalb
// auf den Kraterboden zurück und standen unter der Fläche: unsichtbar.
// lift = zusätzlicher Aufschlag für DIESES Schiff (siehe PAD_LIFT_FRAC). Auch auf der Mondbasis
// nötig: ihr Höhenprofil ist eine Interpolation und liegt um Meter daneben — genau daran ist die
// flache Enterprise im Boden verschwunden.
// Hilfsvektoren fuer den Landeplatz-Raycast (wiederverwendet, damit pro Frame kein Muell entsteht)
const _padFrom = new THREE.Vector3(), _padDown = new THREE.Vector3(0,-1,0);
const _padRay = new THREE.Raycaster();
function padSurfaceY(x, z, lift){
  const up = (lift === undefined) ? PAD_LIFT : lift;
  // EXAKTE Bodenhoehe per Raycast, so wie stepGroundExact es fuer den Flieger tut. Damit landen die
  // Schiffe wirklich auf der Oberflaeche statt darueber: der Aufschlag `up` ist dann nur noch ein
  // Rueckfall, wenn kein Strahl trifft.
  //
  // Frueher stand hier ausdruecklich „bewusst OHNE Raycast", weil three.js obj.matrixWorld erst beim
  // Rendern aktualisiert und placeGroundBase() die Basis nach updatePads() setzt — Landeplaetze fielen
  // dann auf den Kraterboden. Der Ausweg war ein Aufschlag von 3 m plus 45 % der Schiffshoehe, und
  // genau der war sichtbar: das Shuttle stand 8,4 m ueber dem Boden, die Enterprise 6,3 m, die Rakete
  // 4,5 m. Gemeldet als „die raumschiffe auf dem mond landen nicht exakt auf der oberflaeche sondern
  // in der luft".
  //
  // Die Matrix laesst sich aber erzwingen: updateMatrixWorld(true) auf dem Ziel, dann trifft der
  // Strahl auch in dem Frame, in dem die Basis gerade gesetzt wurde.
  const G = GROUNDS[locale];
  if(G && G.tiles){
    const approx = groundHeightAt(locale, x, z);
    _padFrom.set(x, approx + 400, z);
    let best = null;
    const T = G.tile;
    const tile = G.tiles.get(Math.round(x/T) + ',' + Math.round(z/T));
    if(tile){
      tile.updateMatrixWorld(true);
      _padRay.set(_padFrom, _padDown);
      const hit = _padRay.intersectObject(tile, true);
      if(hit.length) best = hit[0].point.y;
    }
    // Die Mondbasis mitpruefen: die Schiffe landen auf ihrer Flaeche, nicht auf dem Kraterboden.
    if(locale === 'moon' && moonBaseObj && moonBaseObj.visible){
      moonBaseObj.updateMatrixWorld(true);
      _padRay.set(_padFrom, _padDown);
      for(const h of _padRay.intersectObject(moonBaseObj, true)){
        if(best === null || h.point.y > best) best = h.point.y;
      }
    }
    if(best !== null) return best;
  }
  // Rueckfall wie bisher: Hoehenprofil der Basis bzw. das Raster, mit Aufschlag gegen die
  // Ungenauigkeit der Interpolation.
  const bp = basePlatformNear(x, z);          // Fläche der Mondbasis (siehe dort)
  if(bp !== null) return bp + up;
  return groundHeightAt(locale, x, z) + up;
}
function padSpot(p){
  const c = _lastBase;
  // Auf dem Mond mitten auf die helle Fläche NEBEN dem Gebäude — dort sieht man die Schiffe am
  // besten. Vermessen (C:\tmp\baseprobe2.js, Faktor 5,52): die Aufbauten stehen bei 40–80 m Radius,
  // von 100 bis 260 m ist die Fläche rundum frei und flach (Höhenstreuung unter 1 m).
  const a = Math.random()*Math.PI*2;
  const d = (locale === 'moon') ? 110 + Math.random()*145 : 120 + Math.random()*90;
  p.x = (c ? c.x : state.pos.x) + Math.cos(a)*d;
  p.z = (c ? c.z : state.pos.z) + Math.sin(a)*d;
}
function updatePads(dt){
  if(!GROUNDS[locale]){ for(const p of pads) p.obj.visible = false; return; }
  ensurePads();
  for(const p of pads){
    // Landeplatz nachziehen, wenn die Basis inzwischen woanders steht
    if(_lastBase && Math.hypot(p.x - _lastBase.x, p.z - _lastBase.z) > 600) padSpot(p);
    // Jeden Frame frisch: die Rechnung ist nur noch eine Interpolation im Profil, und ein gemerkter
    // Wert wäre falsch, sobald die Basis ihre Höhe ändert (Standortwechsel oder Anhebung).
    // Aufschlag aus der eigenen Höhe: ein flaches Schiff braucht mehr, um sichtbar zu bleiben.
    const gy = padSurfaceY(p.x, p.z, PAD_LIFT + (p.h || 0) * PAD_LIFT_FRAC);
    p.obj.rotation.set(0, p.yaw, 0);                  // immer waagerecht, nur gedreht
    if(p.phase === 'down'){
      if(!p.obj.visible){
        padSpot(p); p.yaw = Math.random()*Math.PI*2;
        p.obj.position.set(p.x, gy + PAD_TOP, p.z); p.obj.visible = true;
      }
      p.obj.position.y -= PAD_CLIMB*dt;
      if(p.obj.position.y <= gy){ p.obj.position.y = gy; p.phase = 'hold'; p.hold = 3 + Math.random()*6; }
    } else if(p.phase === 'hold'){
      p.hold -= dt;
      if(p.hold <= 0) p.phase = 'up';
    } else {
      p.obj.position.y += PAD_CLIMB*dt;
      if(p.obj.position.y > gy + PAD_TOP){ p.obj.visible = false; p.phase = 'down'; }
    }
  }
}

// Ein Objekt in Flugrichtung drehen. NICHT lookAt() verwenden: das richtet bei normalen Objekten
// die +Z-Achse zum Ziel (anders als bei Kameras), und alle Modelle hier sind auf „Nase = -Z"
// vorgedreht — mit lookAt fliegen sie rückwärts.
const _NOSE = new THREE.Vector3(0,0,-1);
// Nase in Flugrichtung — MIT definiertem Oben. setFromUnitVectors nimmt die KUERZESTE Drehung,
// und die laesst den Roll frei: das Schiff kippt beliebig um seine Laengsachse. Gemessen ueber
// 10.500 Flugrichtungen waren das im Mittel 45,3 Grad, bei ueber der Haelfte mehr als 25 Grad und
// im schlimmsten Fall 180. Beim Millennium Falcon faellt genau das auf, weil er eine flache Scheibe
// ist: gekippt sieht er aus, als flieche er seitwaerts mit der rechten Seite voraus — so gemeldet.
// Mit lookAt bleibt das Deck waagerecht: Roll im Mittel 1,8 Grad, die Nase trifft die Flugrichtung
// exakt (0,00 Grad Abweichung, nachgemessen).
// lookAt richtet die +Z-Achse auf das Ziel — mit Ziel = +dir landet unsere -Z-Nase korrekt auf dir
// (mit -dir stand sie genau rueckwaerts; beides durchgerechnet, nicht geraten).
// Bei Flug fast senkrecht ist "oben" nicht definiert -> dann eine andere Bezugsachse.
const _faceM = new THREE.Matrix4(), _faceUp = new THREE.Vector3(0,1,0),
      _faceAlt = new THREE.Vector3(0,0,1), _faceZero = new THREE.Vector3(0,0,0),
      _faceDir = new THREE.Vector3();
function faceAlong(obj, dir){
  if(dir.lengthSq() < 1e-9) return;
  _faceDir.copy(dir).normalize();
  _faceM.lookAt(_faceZero, _faceDir, Math.abs(_faceDir.y) > 0.98 ? _faceAlt : _faceUp);
  obj.quaternion.setFromRotationMatrix(_faceM);
}

// ---------- Star Destroyer: der Flugzeugträger des Weltalls ----------
// Sie stehen verteilt im Raum (praktisch ortsfest) und lassen sich anfliegen — die Landung führt in
// denselben Hangar wie beim Todesstern. Fremde Schiffe steuern sie ebenfalls an und verschwinden
// darin, sodass man ständig Verkehr um sie herum sieht.
const DESTROYER_COUNT = 5;         // nur 10.964 Dreiecke pro Stück, also günstig
const DESTROYER_LEN = 1200;        // Länge im Spiel (echter Sternenzerstörer: 1600 m)
const DESTROYER_DOCK = 700;        // so nah -> Landung im Hangar
let destroyerTpl = null;
const destroyers = [];             // { obj }
function preloadDestroyer(){
  if(!window.DESTROYER_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.DESTROYER_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;               // Nase liegt bereits auf -Z (vermessen)
    const box0 = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box0.getSize(size);
    obj.scale.setScalar(DESTROYER_LEN / Math.max(size.x, size.y, size.z));
    const box1 = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3(); box1.getCenter(c);
    obj.position.sub(c);
    const wrap = new THREE.Group(); wrap.add(obj);
    destroyerTpl = wrap;
  }, (err)=>{ console.warn('Star-Destroyer-GLB Ladefehler:', err); });
}
function placeDestroyer(d){
  const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
  d.obj.position.copy(state.pos).addScaledVector(dir, 6000 + Math.random()*12000);
  d.obj.rotation.set(0, Math.random()*Math.PI*2, 0);
  d.obj.visible = true;
}
function updateDestroyers(dt){
  if(locale !== 'space'){ for(const d of destroyers) d.obj.visible = false; return; }
  while(destroyers.length < DESTROYER_COUNT && destroyerTpl){
    const obj = destroyerTpl.clone(true);
    obj.visible = false; scene.add(obj);
    destroyers.push({ obj });
  }
  for(const d of destroyers){
    if(!d.obj.visible){ placeDestroyer(d); continue; }
    // sie treiben nur langsam mit, damit sie nicht sofort außer Sicht sind
    d.obj.position.addScaledVector(state.vel, 0.9*dt);
    const dist = d.obj.position.distanceTo(state.pos);
    // Am Jetpack ueber evaEndJetToHangar (siehe die ISS weiter unten): direkt gerufen blieb das
    // Jetpack an und enterHangar setzte den Schub auf VTOL_HOVER — der gemeldete 20-%-Ruecksprung.
    if(dist < DESTROYER_DOCK && eva && eva.jet){
      evaEndJetToHangar({ pos: d.obj.position.clone(), up: DESTROYER_LEN*0.8 }); return;
    }
    if(dist < DESTROYER_DOCK && enterHangar({ pos: d.obj.position.clone(), up: DESTROYER_LEN*0.8 })) return;
    if(dist > 30000) placeDestroyer(d);
  }
}
// Der nächstgelegene Destroyer — Ziel für den fremden Verkehr
function nearestDestroyer(from){
  let best = null, bd = Infinity;
  for(const d of destroyers){
    if(!d.obj.visible) continue;
    const dd = d.obj.position.distanceTo(from);
    if(dd < bd){ bd = dd; best = d; }
  }
  return best;
}

// ---------- Fremde Raumschiffe im Weltall ----------
// Sie fliegen einfach geradeaus ihre Bahn und werden neu eingesetzt, wenn sie zu weit weg sind.
// Die Modelle liegen in ihren Dateien unterschiedlich: das Shuttle zeigt mit der Nase auf +Z, die
// Razor Crest steht senkrecht (Nase −Y), die Serenity liegt längs (Nase −X). Deshalb wird jedes
// Modell in einem Wrapper vorgedreht, sodass außen einheitlich „Nase = −Z" gilt (wie beim Spieler).
// count = wie viele von der Sorte unterwegs sind. Die Serenity bleibt einmalig: ihr Modell hat
// 289.000 Dreiecke (22-mal so viel wie das Shuttle), mehrere Exemplare würden das Bild ausbremsen.
// Nase-Richtung je Modell vermessen: Shuttle +Z, Razor Crest senkrecht (-Y), Serenity -X,
// Star-Trek-Schiffe längs Z, beide mit der Nase auf +Z (bei der Voyager sind die Warpgondeln
// breiter als der Bug — das hatte die erste Achsvermessung in die Irre geführt).
// Alles wird auf „Nase = -Z" vorgedreht, so wie es das Spiel überall erwartet.
// count = wie viele von der Sorte unterwegs sind. Die schweren Modelle wurden vereinfacht
// (Vertex-Clustering, siehe WELTRAUM_PLAN.md): Serenity 288.678 -> 32.930, Voyager 147.206 -> 14.526,
// Enterprise 49.588 -> 19.388, Razor Crest 38.112 -> 9.843 Dreiecke. Deshalb sind jetzt von allen
// mehrere unterwegs, und die Szene ist trotzdem leichter als vorher.
// Längen nach den offiziellen Angaben (Kanon bzw. real), damit die Größenverhältnisse untereinander
// stimmen: Shuttle 37,2 m · Razor Crest 24,27 m · Serenity 82,1 m · Voyager 344,5 m ·
// Enterprise-D 642,5 m. Auf dem Landeplatz werden sie allerdings alle auf dieselbe Länge normiert
// (PAD_LEN), sonst wäre die Enterprise dort 26-mal so groß wie die Razor Crest.
const SHIP_DEFS = [
  { key:'shuttle',    glb:()=>window.SHUTTLE_GLB,    len:37,  rot:[0, Math.PI, 0],    count:9 },
  // Razor Crest: 24,27 m laut Wookieepedia (war 30). Serenity: 82,1 m laut den offiziellen
  // Blueprints (war 60) — sie ist also größer als gedacht, nicht kleiner.
  { key:'razor',      glb:()=>window.RAZOR_GLB,      len:24.27, rot:[Math.PI/2, 0, 0],  count:6 },
  { key:'serenity',   glb:()=>window.SERENITY_GLB,   len:82.1,  rot:[0, -Math.PI/2, 0], count:2 },
  { key:'voyager',    glb:()=>window.VOYAGER_GLB,    len:340, rot:[0, Math.PI, 0],    count:2 },
  { key:'enterprise', glb:()=>window.ENTERPRISE_GLB, len:640, rot:[0, Math.PI, 0],    count:2 },
  // Millennium Falcon (by jay2307). 40 m Länge wie gewünscht — im Kanon sind es 34,75 m, das Modell
  // ist mit 4,38:1 (Länge:Höhe) etwas bauchiger als die genannten 40 × 8 m, bei 40 m Länge wird es
  // also 9,1 m hoch. Die Länge zählt, weil sie das ist, was man im Vergleich zu anderen Schiffen sieht.
  // Im Modell liegt die Längsachse auf X (ausgemessen: 359,8 × 82,1 × 270,1 roh) — also um 90°
  // drehen, damit die Nase wie bei allen anderen auf -Z zeigt.
  { key:'falcon',     glb:()=>window.FALCON_GLB,     len:40,  rot:[0, Math.PI/2, 0],  count:4 },
  // Die Ariane 6 von den Inseln — sie steigt dort ins All und zieht hier oben weiter ihre Bahn.
  // Sie ist AUFRECHT modelliert (Längsachse Y, 62 m gemessen), alle anderen liegen waagerecht mit
  // der Nase auf -Z. Deshalb -90 Grad um X: sonst flöge sie mit der Spitze nach oben seitwärts
  // durchs Bild. len bleibt 62 — das ist ihre echte Höhe, und preloadShips skaliert auf die
  // größte Achse, also genau darauf.
  { key:'rocket',     glb:()=>window.ROCKET_GLB,     len:62,  rot:[-Math.PI/2, 0, 0], count:3 },
];
const ships = [];
function preloadShips(){
  for(const def of SHIP_DEFS){
    const data = def.glb && def.glb();
    if(!data || !THREE.GLTFLoader) continue;
    const gl = new THREE.GLTFLoader();
    const b64 = data.split(',')[1];
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    gl.parse(bytes.buffer, '', (gltf)=>{
      const obj = gltf.scene;
      obj.rotation.set(def.rot[0], def.rot[1], def.rot[2]);
      const box0 = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3(); box0.getSize(size);
      obj.scale.setScalar(def.len / Math.max(size.x, size.y, size.z));
      const box1 = new THREE.Box3().setFromObject(obj);
      const c = new THREE.Vector3(); box1.getCenter(c);
      obj.position.sub(c);                       // Schwerpunkt in den Ursprung
      shipTpl[def.key] = { wrap:new THREE.Group(), def };
      shipTpl[def.key].wrap.add(obj.clone(true));       // Vorlage für den Start-/Landeverkehr
      for(let i = 0; i < (def.count || 1); i++){
        const wrap = new THREE.Group();
        wrap.add(i === 0 ? obj : obj.clone(true));      // Klone teilen Geometrie und Texturen
        wrap.visible = false; scene.add(wrap);
        ships.push({ obj:wrap, def, vel:new THREE.Vector3(0,0,-1),
                     drift:new THREE.Vector3(), lag: 0.04 + Math.random()*0.10 });
      }
    }, (err)=>{ console.warn('Raumschiff-GLB Ladefehler ('+def.key+'):', err); });
  }
}
function placeShip(s){
  const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
  // Entfernung an der SCHIFFSLÄNGE ausrichten, damit alle etwa gleich groß im Bild stehen (~2–3°).
  // Vorher lagen alle 2,5–9,5 km entfernt: ein 37-m-Shuttle war dort 0,4° groß und praktisch
  // unsichtbar, während die 640 m lange Enterprise gut zu sehen war.
  const dist = Math.max(500, s.def.len * 25 * (0.7 + Math.random()*0.8));
  s.obj.position.copy(state.pos).addScaledVector(dir, dist);
  // eigener Kurs, mit dem sie „hin und her" ziehen — Waffen haben sie keine, nur die X-Wings schießen
  s.drift.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize()
    .multiplyScalar(80 + Math.random()*170);
  // Gemischt: negativ = etwas schneller als der Spieler (überholt ihn langsam), positiv = langsamer
  // (wird überholt). Zusammen mit dem eigenen Kurs zieht mancher auch einfach quer durchs Bild.
  s.lag = -0.06 + Math.random()*0.20;
  s.dock = Math.random() < 0.2;         // Anflug auf einen Star Destroyer statt freier Bahn
  s.obj.visible = true;
}
// (Hier stand eine Leuchtsäule über der ISS. Sie war nur nötig, weil die Station mit 120 m zu klein
// zum Finden war — jetzt ist sie 1200 m groß und von selbst gut zu sehen. Der blaue Balken im
// Sternenhimmel sah außerdem nicht gut aus.)

function updateShips(dt){
  if(locale !== 'space'){ for(const s of ships) s.obj.visible = false; return; }
  // Die ISS zieht mit: sonst ist sie nach wenigen Sekunden aus dem Bild. Sie folgt dem Flieger mit
  // 92 % seines Tempos plus ihrem eigenen langsamen Kurs; ist sie doch zu weit weg, kommt die
  // nächste Station in Sichtweite vorbei.
  issCenter.addScaledVector(state.vel, 0.92*dt).addScaledVector(issDrift, dt);
  // Anflug auf die Station: sie ist wie Todesstern und Star Destroyer anfliegbar — nur wenn ihr
  // Modell auch wirklich zu sehen ist, sonst dockte man an einer unsichtbaren Station an.
  if(issObj && issObj.visible && issCenter.distanceTo(state.pos) < ISS_DOCK){
    // Am JETPACK ueber evaEndJetToHangar andocken, nicht direkt ueber enterHangar: das beendet das
    // Jetpack sauber und stellt den Astronauten in die Halle. Direkt gerufen blieb eva.jet an, der
    // Ort wechselte im Hintergrund, und enterHangar setzte state.throttle auf VTOL_HOVER — das war
    // der gemeldete Ruecksprung „er geht staendig zurueck auf 20 %", inklusive des Gefuehls, nicht
    // von der ISS wegzukommen: man dockte immer wieder an, ohne es zu merken.
    if(eva && eva.jet){ evaEndJetToHangar({ pos: issCenter.clone(), up: 400 }); return; }
    if(enterHangar({ pos: issCenter.clone(), up: 400 })) return;
  }
  // Mit 2400 m Größe ist sie auch auf 15 km noch gut zu erkennen (rund 100 px hoch), darf also
  // entsprechend weiter wegtreiben.
  if(issCenter.distanceTo(state.pos) > 15000){
    const dir = new THREE.Vector3(Math.random()-0.5, Math.random()*0.4+0.1, Math.random()-0.5).normalize();
    issCenter.copy(state.pos).addScaledVector(dir, 4500 + Math.random()*5000);
    issDrift.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize().multiplyScalar(40);
  }
  for(const s of ships){
    if(!s.obj.visible){ placeShip(s); continue; }
    // Etwa jedes dritte Schiff steuert einen Star Destroyer an und verschwindet darin — so sieht man
    // ständig, wie andere den Träger anfliegen.
    if(s.dock){
      const d = nearestDestroyer(s.obj.position);
      if(d){
        const to = d.obj.position.clone().sub(s.obj.position);
        const dist = to.length();
        s.vel.lerp(to.normalize().multiplyScalar(Math.max(260, state.vel.length()*0.9)), Math.min(1, 0.8*dt));
        s.obj.position.addScaledVector(s.vel, dt);
        faceAlong(s.obj, s.vel);
        if(dist < DESTROYER_LEN*0.45){ placeShip(s); }        // eingeflogen -> neu einsetzen
        continue;
      }
    }
    // wie bei den Asteroiden: Tempo des Fliegers minus kleinem Rückstand, dazu der eigene Kurs.
    // So bleiben sie im Blick, statt bei Warp 0,5 sofort nach hinten zu verschwinden.
    const want = state.vel.clone().multiplyScalar(1 - s.lag).add(s.drift);
    s.vel.lerp(want, Math.min(1, 1.2*dt));
    s.obj.position.addScaledVector(s.vel, dt);
    faceAlong(s.obj, s.vel);                                                    // Nase voraus
    // relativ zur eigenen Größe aufräumen: kleine Schiffe früher, damit sie nicht als Punkt enden
    if(s.obj.position.distanceTo(state.pos) > Math.max(4000, s.def.len*90)) placeShip(s);
  }
}

// ---------- Asteroiden + Laser (nur im Weltall) ----------
// Im Weltall treiben Asteroiden um den Flieger. Mit B feuert der X-Wing zwei orangene Laserblitze
// (Einzelschuss pro Druck) und zerstört sie. Sie erscheinen nur bei Unterlicht-Fahrt: im Hyperraum
// würde man sie bei Warp gar nicht sehen, geschweige denn treffen.
const AST_COUNT = 20;              // wie viele gleichzeitig unterwegs sind
const AST_NEAR = 2000, AST_FAR = 9000, AST_DROP = 16000;   // Spawn-Nähe/-Weite, Aufräum-Distanz
const AI_XW_COUNT = 5;             // fremde X-Wings, die selbst auf Asteroiden schießen
                                   // (je 37.889 Dreiecke — das Spielermodell wird nicht vereinfacht,
                                   // weil man es aus wenigen Metern sieht)
const LASER_SPEED = 2500, LASER_LIFE = 2.5;                // m/s über Eigenfahrt, Sekunden
let asteroidTemplate = null, astHits = 0;
const asteroids = [], bolts = [], flashes = [];
const laserMat = new THREE.MeshBasicMaterial({ color:0xff7a10, transparent:true, opacity:0.95,
  blending:THREE.AdditiveBlending, depthWrite:false });
const boltGeo = new THREE.CylinderGeometry(0.6, 0.6, 26, 6, 1, true);
boltGeo.rotateX(Math.PI/2);        // Zylinderachse auf die Flugrichtung (-Z) legen
const flashGeo = new THREE.SphereGeometry(1, 12, 8);
const flashMat = new THREE.MeshBasicMaterial({ color:0xffb040, transparent:true, opacity:0.9,
  blending:THREE.AdditiveBlending, depthWrite:false });

function preloadAsteroid(){
  if(!window.ASTEROID_GLB || !THREE.GLTFLoader) return;
  const gl = new THREE.GLTFLoader();
  const b64 = window.ASTEROID_GLB.split(',')[1];
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  gl.parse(bytes.buffer, '', (gltf)=>{
    const obj = gltf.scene;
    // auf Durchmesser 2 normieren und zentrieren -> die Skalierung der Kopie IST dann der Radius
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3(); box.getSize(size);
    obj.scale.setScalar(2 / Math.max(size.x, size.y, size.z));
    const c = new THREE.Vector3(); new THREE.Box3().setFromObject(obj).getCenter(c);
    obj.position.sub(c);
    const wrap = new THREE.Group(); wrap.add(obj);
    asteroidTemplate = wrap;
  }, (err)=>{ console.warn('Asteroid-GLB Ladefehler:', err); });
}
function spawnAsteroid(){
  if(!asteroidTemplate) return;
  const g = asteroidTemplate.clone(true);
  const r = 60 + Math.random()*140;                     // 60–200 m Radius
  g.scale.setScalar(r);
  // völlig zufällig rundum verteilt (kein Vorzugsbereich) und mit zufälligem Kurs unterwegs
  const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
  g.position.copy(state.pos).addScaledVector(dir, AST_NEAR + Math.random()*(AST_FAR-AST_NEAR));
  g.rotation.set(Math.random()*6.28, Math.random()*6.28, Math.random()*6.28);
  scene.add(g);
  // Eigenbewegung: eine kleine Zufallsdrift, dazu (in updateAsteroids) das Tempo des Fliegers minus
  // einem kleinen Rückstand — so zieht man nur langsam an ihnen vorbei und kann zielen.
  const drift = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5)
    .normalize().multiplyScalar(15 + Math.random()*35);    // 15–50 m/s eigener Kurs
  asteroids.push({ grp:g, r, drift, lag: 0.02 + Math.random()*0.06,   // 2–8 % langsamer als der Flieger
    vel: drift.clone(),
    spin:new THREE.Vector3((Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4, (Math.random()-0.5)*0.4) });
}
function clearAsteroids(){
  for(const a of asteroids) scene.remove(a.grp); asteroids.length = 0;
  for(const b of bolts) scene.remove(b.mesh);    bolts.length = 0;
  for(const f of flashes) scene.remove(f.mesh);  flashes.length = 0;
  for(const w of aiXwings) scene.remove(w.grp);  aiXwings.length = 0;
}

// ---------- Fremde X-Wings, die im Weltall selbst auf Asteroiden schießen ----------
// Bewusst einfach gehalten: nächsten Brocken anfliegen, aus der Distanz feuern, danach das nächste
// Ziel. Ihre Treffer zählen NICHT auf den eigenen Zähler.
const aiXwings = [];
function spawnAiXwing(){
  if(!glbTemplates['XWing']) return;
  const holder = new THREE.Group();
  const m = glbTemplates['XWing'].clone(true);
  m.rotation.y = Math.PI;                 // Nase auf -Z, wie beim Spieler
  m.scale.setScalar(6);                   // ~70 m — mit 36 m war auf 3 km Entfernung nichts zu sehen
  holder.add(m);
  const dir = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
  holder.position.copy(state.pos).addScaledVector(dir, 600 + Math.random()*1600);
  scene.add(holder);
  aiXwings.push({ grp:holder, target:null, cool:0.5 + Math.random(),
    speed: 300 + Math.random()*300,
    vel: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize() });
}
function updateAiXwings(dt){
  while(aiXwings.length < AI_XW_COUNT && glbTemplates['XWing']) spawnAiXwing();
  for(let i=aiXwings.length-1;i>=0;i--){
    const w = aiXwings[i];
    // Ziel suchen/nachziehen: der nächstgelegene Asteroid
    if(!w.target || asteroids.indexOf(w.target) < 0){
      let best = null, bd = Infinity;
      for(const a of asteroids){
        const d = a.grp.position.distanceTo(w.grp.position);
        if(d < bd){ bd = d; best = a; }
      }
      w.target = best;
    }
    // Kurs: sanft auf das Ziel einschwenken (sonst driftet er einfach weiter)
    if(w.target){
      const to = w.target.grp.position.clone().sub(w.grp.position).normalize();
      w.vel.lerp(to, Math.min(1, 1.2*dt)).normalize();
    }
    // Tempo mithalten: sonst sind sie bei Warp 0,5 sofort außer Sicht
    const keep = Math.max(w.speed, state.vel.length()*0.92);
    w.cruise = keep;                                   // für die Laserbolzen (siehe unten)
    w.grp.position.addScaledVector(w.vel, keep*dt);
    faceAlong(w.grp, w.vel);                             // Nase in Flugrichtung
    // Feuern, wenn das Ziel vor ihm und in Reichweite ist
    w.cool -= dt;
    if(w.target && w.cool <= 0){
      const to = w.target.grp.position.clone().sub(w.grp.position);
      const d = to.length();
      if(d < 3000 && to.normalize().dot(w.vel) > 0.9){
        // Eigengeschwindigkeit mitgeben, sonst bleibt der Schuss hinter dem Schützen zurück
        fireBolt(w.grp.position, w.vel, false, w.vel.clone().multiplyScalar(w.cruise || w.speed), 45);
        w.cool = 0.8 + Math.random()*0.8;
      }
    }
    if(w.grp.position.distanceTo(state.pos) > 6000){       // zu weit weg -> neu einsetzen
      scene.remove(w.grp); aiXwings.splice(i,1);
    }
  }
}
function boom(pos, r){
  const m = new THREE.Mesh(flashGeo, flashMat.clone());
  m.position.copy(pos); m.renderOrder = 998; scene.add(m);
  flashes.push({ mesh:m, t:0, r });
}
// Zwei Blitze links und rechts der Nase. mine = vom Spieler (zählt auf den Trefferzähler).
// ahead = wie weit vor dem Schützen der Bolzen entsteht (bei großen Modellen mehr, sonst steckt er
// im eigenen Rumpf).
function fireBolt(pos, fwd, mine, baseVel, ahead){
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1), fwd.clone().normalize());
  const right = new THREE.Vector3(1,0,0).applyQuaternion(q);
  const dir = fwd.clone().normalize();
  const v = dir.clone().multiplyScalar(LASER_SPEED);
  if(baseVel) v.add(baseVel);
  for(const side of [-1, 1]){
    const m = new THREE.Mesh(boltGeo, laserMat);
    m.position.copy(pos).addScaledVector(right, side*5).addScaledVector(dir, ahead || 10);
    m.quaternion.copy(q);
    m.renderOrder = 997;
    scene.add(m);
    bolts.push({ mesh:m, vel:v.clone(), t:0, mine:!!mine });
  }
}
// Ein Schuss pro Tastendruck (B / Gamepad-B) — beide sind flankengesteuert.
function fireLaser(){
  if(locale !== 'space' || state.crashed) return;
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  fireBolt(state.pos, fwd, true, state.vel);
  rumble(80, 0.25, 0.2);
}
function updateAsteroids(dt){
  // nur im Weltall und nur UNTERHALB des Hyperraums (unter Warp 1) — im Hyperraum wäre Zielen
  // reine Glückssache, und die Brocken würden unsichtbar vorbeirauschen
  const on = (locale === 'space' && state.vel.length() < SPACE_C);
  if(!on){ if(asteroids.length || bolts.length || flashes.length || aiXwings.length) clearAsteroids(); return; }
  while(asteroids.length < AST_COUNT && asteroidTemplate) spawnAsteroid();
  updateAiXwings(dt);

  for(let i=asteroids.length-1;i>=0;i--){
    const a = asteroids[i];
    // Tempo sanft an den Flieger angleichen (minus Rückstand) + eigene Drift -> sie werden nur
    // langsam überholt, egal ob man mit Warp 0,1 oder knapp unter Warp 1 unterwegs ist.
    const want = state.vel.clone().multiplyScalar(1 - a.lag).add(a.drift);
    a.vel.lerp(want, Math.min(1, 1.5*dt));
    a.grp.position.addScaledVector(a.vel, dt);
    a.grp.rotation.x += a.spin.x*dt; a.grp.rotation.y += a.spin.y*dt; a.grp.rotation.z += a.spin.z*dt;
    const d = a.grp.position.distanceTo(state.pos);
    if(d > AST_DROP){ scene.remove(a.grp); asteroids.splice(i,1); continue; }
    if(d < a.r + 10){                       // gerammt: er zerbricht, der Flieger bleibt heil
      boom(a.grp.position, a.r*1.3); astHits++;
      scene.remove(a.grp); asteroids.splice(i,1);
      rumble(300, 0.7, 0.6); showSpaceHint('💥 ' + astHits);
    }
  }
  for(let i=bolts.length-1;i>=0;i--){
    const b = bolts[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.t += dt;
    let hit = false;
    for(let k=asteroids.length-1;k>=0;k--){
      const a = asteroids[k];
      if(b.mesh.position.distanceTo(a.grp.position) < a.r + 14){
        boom(a.grp.position, a.r*1.4);
        if(b.mine){ astHits++; rumble(200, 0.5, 0.4); showSpaceHint('💥 ' + astHits); }  // fremde zählen nicht
        scene.remove(a.grp); asteroids.splice(k,1);
        hit = true; break;
      }
    }
    if(hit || b.t > LASER_LIFE){ scene.remove(b.mesh); bolts.splice(i,1); }
  }
  for(let i=flashes.length-1;i>=0;i--){
    const f = flashes[i]; f.t += dt;
    const k = f.t/0.45;
    if(k >= 1){ scene.remove(f.mesh); flashes.splice(i,1); continue; }
    f.mesh.scale.setScalar(f.r*(0.4 + 1.6*k));
    f.mesh.material.opacity = 0.9*(1-k);
  }
}

// ---------- Höhen-Schatten am Boden (Hilfe fürs Kind, ab <=20 m) ----------
// Flacher, flugzeugförmiger Umriss (Kreuz aus zwei Ellipsen: Rumpf + Flügel),
// folgt der X/Z-Position, liegt knapp über dem Boden. Bei niedriger Höhe größer/dunkler.
// depthTest ist AN — genau wie beim ovalen Schatten darunter, und aus demselben Grund. Vorher stand
// hier depthTest:false, damit der Schatten nie von einer Welle verdeckt wird; er wurde damit aber
// ueber ALLES gezeichnet, auch ueber Objekte, die zwischen ihm und der Kamera stehen. Solange der
// Traeger auf dem Wasser lag, fiel das nicht auf. Seit er IM Wasser liegt (FORD_DRAFT), sieht man den
// Schatten auf dem Wasser durch seinen Rumpf hindurch — genau so gemeldet.
//
// Gegen das Flackern im animierten Wasser (z-fighting) hilft polygonOffset, nicht das Abschalten des
// Tiefentests: dieselbe Kombination, mit der der ovale Schatten seit laengerem sauber im Wasser liegt.
// depthWrite bleibt aus — der Schatten ist ein Aufkleber und soll nichts anderes verdecken.
const shadowMat = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.3,
  depthWrite:false, depthTest:true, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
const planeShadow = new THREE.Group();
planeShadow.renderOrder = 999;
const shBody = new THREE.Mesh(new THREE.CircleGeometry(1, 24), shadowMat);
shBody.rotation.x = -Math.PI/2; shBody.scale.set(1.2, 1, 4.5); shBody.renderOrder = 999;
planeShadow.add(shBody);
const shWing = new THREE.Mesh(new THREE.CircleGeometry(1, 24), shadowMat);
shWing.rotation.x = -Math.PI/2; shWing.scale.set(5.5, 1, 1.1); shWing.renderOrder = 999;
planeShadow.add(shWing);
planeShadow.visible = false;
scene.add(planeShadow);
// Zweiter Schatten fuer alles, was KEIN Flugzeug ist: die beiden Boote und der Astronaut zu Fuss.
// Der Umriss oben ist ein Flugzeug (Rumpf- und Fluegelellipse gekreuzt) — unter einem Boot sah das
// falsch aus, deshalb war der Schatten dort ganz abgeschaltet. Ein schlichtes Oval passt fuer beide:
// laenglich in Fahrtrichtung beim Boot, rund beim Astronauten (die Skalierung setzt updateShadow).
// EIGENES Material: shadowMat gehoert dem Flugzeug-Schatten, und beide setzen ihre Deckkraft nach
// der Hoehe. Mit einem gemeinsamen Material wuerde der eine den anderen mitverstellen.
// depthTest ist hier AN (anders als beim Flugzeug-Schatten): nur so verdeckt das Objekt seinen
// eigenen Schatten. Mit depthTest:false wurde er ueber allem gezeichnet, also auch ueber den Fuessen
// des Astronauten und ueber dem Bootsrumpf — er sah aus, als laege er OBEN AUF dem Objekt.
// depthWrite bleibt aus: der Schatten ist ein Aufkleber und soll nichts anderes verdecken.
// Damit er nicht im Wasser flackert, liegt er parallel zur Wellenflaeche (siehe updateOvalShadow) —
// eine waagerechte Scheibe wuerde am Rand eintauchen, gemessen bis 0,54 m (C:/tmp/dt.js).
const ovalShadowMat = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.3,
  depthWrite:false, depthTest:true, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
// Wieder ein VOLLER Kreis. Vorher fehlte das vordere Stueck, damit der Schatten nicht ueber dem
// eigenen Rumpf liegt — das war aber nur ein Pflaster gegen depthTest:false und sah als V-Kerbe
// kuenstlich aus. Mit depthTest verdeckt das Objekt seinen Schatten selbst, und der Kreis darf
// vollstaendig sein.
const ovalShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), ovalShadowMat);
ovalShadow.rotation.x = -Math.PI/2;
// KEIN renderOrder 999: das erzwang das Zeichnen zuletzt, was zusammen mit depthTest:false den
// Schatten ueber alles legte. Jetzt entscheidet der Tiefenpuffer, und der polygonOffset im Material
// haelt ihn knapp vor der Auflageflaeche, ohne mit ihr zu flimmern.
ovalShadow.visible = false;
scene.add(ovalShadow);


function buildModel(name) {
  // altes Mesh entfernen
  while (modelHolder.children.length) modelHolder.remove(modelHolder.children[0]);
  propMeshes = [];

  // Das Feuerwehrboot ist kein Flugzeug-GLB: es kommt aus derselben Vorlage wie die
  // Rettungsboote (makeFireBoat), damit es genau so aussieht wie das, das zum Wrack fährt.
  if(name === 'Boat'){
    modelHolder.add(makeFireBoat());
    return { span: 16, scale: 1 };
  }
  // Das U-Boot ist dasselbe Modell wie das KI-Boot auf dem Meer: shipTemplates['sub'] ist beim
  // Laden auf 95 m normiert UND auf seine Wasserlinie gesetzt (siehe preloadSeaShips, wl 0,1537).
  // Genau das braucht man hier — dann liegt es aufgetaucht richtig im Wasser, ohne ein einziges
  // eigenes Mass. Fehlt es noch, bleibt der Halter leer; preloadSeaShips ruft nach dem Laden von
  // 'sub' refreshIslands, und cycleModel/buildModel greifen dann auf die fertige Vorlage zu —
  // dasselbe Muster wie preloadBoat beim Feuerwehrboot.
  if(name === 'Sub'){
    if(shipTemplates['sub']) modelHolder.add(shipTemplates['sub'].clone(true));
    return { span: 24, scale: 1 };     // 24 m: groesste Breite des Modells (Druckkoerper 23,2 m)
  }
  // Alle Flugzeuge sind externe GLB-Modelle. Ausrichtung (rotation.y) pro Modell.
  const GLB_ROT = { Canadair: Math.PI, AlphaJet: Math.PI/2, Airbus: Math.PI,
                    Mustang: -Math.PI, Transall: 0, XWing: Math.PI };
  const GLB_SPAN = { Canadair: 20, AlphaJet: 9, Airbus: 30, Mustang: 11, Transall: 20, XWing: 11 };
  if(glbTemplates[name]){
    const m = glbTemplates[name].clone(true);
    m.rotation.y = GLB_ROT[name] || 0;
    modelHolder.add(m);
    return { span: GLB_SPAN[name] || 11, scale: 1 };
  }
  // GLB noch nicht geladen -> leer lassen (wird nachgezogen, sobald preloadGLB fertig ist)
  return { span: GLB_SPAN[name] || 11, scale: 1 };
}

// ---------- Flugeigenschaften pro Modell ----------
// vMax = Höchstgeschwindigkeit (m/s) bei 100 % Schub. Schub setzt die ZIEL-Geschwindigkeit linear
// (30 % Schub -> 30 % vMax). accel = wie schnell er sich der Zielgeschwindigkeit nähert (m/s²) —
// klein = träge (Airbus), groß = spritzig. vTO = Abhebe-/Stall-Geschwindigkeit.
const PLANE_SPECS = {
  SuperCup:   { vTO: 32, vMax: 55,  accel: 16,  pitch: 1.3, roll: 2.4, turn: 1.2 },
  Mustang:    { vTO: 40, vMax: 139, accel: 24, pitch: 1.6, roll: 3.0, turn: 1.3, aero:true, maxAlt: 1400 },  // P-51: ~500 km/h, Looping+Rolle
  Transall:   { vTO: 40, vMax: 71,  accel: 16,  pitch: 1.0, roll: 1.6, turn: 0.85, aero:false, maxAlt: 600, maxBank: 0.7 }, // Transporter, träge
  Pitts:      { vTO: 38, vMax: 64,  accel: 18, pitch: 1.6, roll: 3.0, turn: 1.3 },
  Bf109:      { vTO: 46, vMax: 90,  accel: 20, pitch: 1.2, roll: 2.4, turn: 1.0 },
  CurtissR3C: { vTO: 44, vMax: 85,  accel: 19, pitch: 1.2, roll: 2.3, turn: 1.0 },
  Airbus:     { vTO: 60, vMax: 106, accel: 25,  pitch: 0.8, roll: 1.4, turn: 0.7, aero:false, maxAlt: 800, maxBank: 0.6 },  // ~380 km/h, träge
  Canadair:   { vTO: 40, vMax: 63,  accel: 16,  pitch: 1.1, roll: 1.8, turn: 0.9, aero:false, maxAlt: 500, maxBank: 0.7 }, // ~228 km/h
  // Alpha-Jet: sau schnell + sehr wendig. Überschall bei 100 % (~1300 km/h). Beschleunigt gemächlich.
  AlphaJet:   { vTO: 55, vMax: 361, accel: 28, pitch: 1.9, roll: 3.8, turn: 1.6, aero:true, maxAlt: 2200 },
  // X-Wing: Steuerung wie der Alpha Jet, aber deutlich schneller — vMax 686 m/s heißt
  // Schallgeschwindigkeit (343 m/s) genau bei 50 % Schub und Mach 2 bei Vollgas; ab 80 %
  // reicht die Fahrt später, um die Erde zu verlassen. Dazu Senkrechtstart (vtol).
  XWing:      { vTO: 55, vMax: 686, accel: 60, pitch: 1.9, roll: 3.8, turn: 1.6, aero:true, maxAlt: 3000, vtol:true },
  // Feuerwehrboot: fährt auf dem Meer statt zu fliegen (boat:true -> eigener Physikzweig stepBoat).
  // 24 m/s sind rund 86 km/h — für ein Boot reichlich, aber sonst dauert die Anfahrt zum Brand zu
  // lang. vTO/pitch/roll/aero sind hier bedeutungslos, weil stepBoat die Flugphysik gar nicht
  // erreicht; turn ist die Wendigkeit am Ruder.
  Boat:       { vTO: 0, vMax: 24, accel: 9, pitch: 0, roll: 0, turn: 1.0, boat:true },
  // U-Boot: fährt auf UND unter dem Meer (sub:true -> eigener Physikzweig stepSub).
  // 14 m/s = 50 km/h. Das KI-U-Boot fährt 14,4 km/h, aber das ist Kulisse, die man betrachtet —
  // hier legt man Strecke zurück, und der Weg zum nächsten Wrack soll keine Geduldsprobe werden.
  // Weniger als das Feuerwehrboot (86 km/h): unter Wasser gibt es keine Bugwelle als Bezug, bei
  // hohem Tempo sähe man nur den Nebel vorbeiziehen.
  // pitch ist hier NICHT bedeutungslos wie beim Boot: die Nase steuert die Tiefe (siehe stepSub),
  // 0,55 rad/s sind sanft — ein U-Boot legt sich nicht wie ein Jagdflugzeug auf die Nase.
  Sub:        { vTO: 0, vMax: 14, accel: 5, pitch: 0.55, roll: 0, turn: 0.8, sub:true },
};

// ---------- X-Wing: Senkrechtstart und -landung (VTOL) ----------
// Der Schub steuert unter 30 % nicht die Fahrt, sondern das SENKRECHTE Steigen/Sinken. Drei Stufen,
// und ALLE DREI setzen sicher auf — der Repulsor bleibt bis 0 % an:
//   0 %  zügig sinken (VTOL_DROP) und trotzdem sanft aufsetzen — die schnelle Landung
//  10 %  ruhig sinken (VTOL_SINK), Nase wird waagerecht gezogen — die gemütliche Landung
//  20 %  abheben und SCHWEBEN: steigt auf 20 m über Grund und bleibt dort stehen; ist er schon
//        höher, hält er einfach seine Höhe (Start von Landebahn, Wiese, Trägerdeck oder Wasser)
//  25 %  Übergangszone (Schweben klingt aus, Vorwärtsschub setzt ein)
//  30 %+ normaler Vorwärtsflug — ab hier greift die unveränderte Flugphysik
//
// Bei 0 % war früher der Antrieb AUS: freier Fall, Strömungsabriss, und aus 100 m Höhe ein Absturz
// (die Crash-Schwelle liegt bei 16 m/s, im freien Fall erreicht man aus 100 m schon 44 m/s). Wer nur
// den Schub loslässt, um herunterzukommen, hat sein Schiff verloren — für ein Kind ist das keine
// Landung, sondern eine Falle. Jetzt trägt der Repulsor auch bei 0 %, es sinkt nur schneller.
// Damit gibt es unter 30 % Schub keinen freien Fall und keinen Strömungsabriss mehr: abstürzen kann
// man weiterhin, aber nur durch eine Kollision oder auf der falschen Oberfläche (Wasser).
//
// Im WELTALL gilt das alles nicht — dort ist kein Boden, auf dem man landen könnte, und 0/10/20 %
// sind ganz normale Fahrstufen (0,1 · Warp usw., siehe vtolMix). Das gilt genauso für das Jetpack:
// es fliegt ausschließlich im Weltall und regelt den Schub linear über JET_VMAX.
const VTOL_LAND  = 0.10;   // bis hier: sinken
const VTOL_HOVER = 0.20;   // hier: senkrecht steigen
const VTOL_FWD   = 0.30;   // ab hier: kein VTOL mehr
const VTOL_SINK  = -10;    // m/s Sinkrate bei VTOL_LAND (zügig, damit man nicht wartet)
// Sinkrate bei 0 % Schub: doppelt so schnell wie bei 10 %, damit der Unterschied deutlich zu spüren
// ist (aus 20 m Schwebehöhe 1,0 s gegen 2,0 s). Sicher ist beides — das Aufsetzen selbst wird
// unabhängig von der Rate immer als saubere Landung gewertet (siehe vtolLand in stepPhysics).
const VTOL_DROP  = -20;
const VTOL_CLIMB = 10;     // m/s Steigrate bei VTOL_HOVER
const VTOL_HOVER_ALT = 20; // m über Grund: Schwebehöhe bei VTOL_HOVER (Boden, Deck oder Mondkrater)
// ---------- Selbst-Aufrichten der Querlage (Rollen loslassen) ----------
// Lässt man LT/RT (bzw. Q/E) los, dreht sich die Schräglage von allein wieder auf null. Das Fenster
// ist bewusst begrenzt: bis 60° Querlage hilft er mit, darüber (Richtung Rückenflug) bleibt er
// liegen — sonst könnte man keine Rolle mehr fliegen und der Flieger würde mitten in der Figur
// zurückdrehen. RATE ist die Annäherung pro Sekunde (2,2 = angenehm zügig, aber sichtbar weich).
const AUTO_LEVEL_MAX  = 1.05;   // rad (~60°): darüber kein Eingriff — Kunstflug bleibt frei
const AUTO_LEVEL_RATE = 2.2;    // wie schnell die Querlage zurückgeht
const DEFAULT_SPEC = { vTO: 44, vMax: 80, accel: 18, pitch: 1.2, roll: 2.2, turn: 1.0 };
let spec = DEFAULT_SPEC;   // aktive Flugeigenschaften (bei Modellwechsel gesetzt)

// ---------- Flugzustand (muss VOR buildModel stehen) ----------
const state = {
  pos: new THREE.Vector3(0, 0.3, 110),   // am Boden (Inselhöhe), hinten auf der Bahn
  quat: new THREE.Quaternion(),
  vel: new THREE.Vector3(0, 0, 0),        // steht still -> selbst starten!
  throttle: 0,
  onGround: true,
  crashed: false,
  crashTimer: 0,
  water: 0,          // Wasser-Ladung 0..1 (nur Canadair)
  scoopTime: 0,      // wie lange schon tief über Wasser (fürs Aufnehmen)
  ejected: false,    // Schleudersitz ausgelöst (AlphaJet) -> Flieger führerlos
  falling: false,    // führerloser Sturz nach Gebäude-Kollision
};

let currentModel = 0;
document.getElementById('mdl').textContent = MODEL_NAMES[0];
buildModel(MODEL_NAMES[0]);
spec = PLANE_SPECS[MODEL_NAMES[0]] || DEFAULT_SPEC;

function cycleModel() {
  if(locale !== 'earth') enterEarth();       // nur der X-Wing kann im Weltall sein
  // Wer per Taste das Modell wechselt, verlaesst die Kai-Einstiegs-Kette bewusst: der gemerkte
  // Flieger-Platz gilt dann nicht mehr (sonst setzte Y einen spaeter dorthin zurueck, obwohl man
  // ueber die Auswahl eingestiegen ist).
  harborBoatFrom = null;
  currentModel = (currentModel+1) % MODEL_NAMES.length;
  document.getElementById('mdl').textContent = MODEL_NAMES[currentModel];
  buildModel(MODEL_NAMES[currentModel]);
  spec = PLANE_SPECS[MODEL_NAMES[currentModel]] || DEFAULT_SPEC;
  placeAtStart(MODEL_NAMES[currentModel]);   // neues Flugzeug an passender Startposition am Boden
  // Der X-Wing gehört in den Todesstern-Hangar — auch wenn man ihn per Modellwechsel wieder wählt.
  if(MODEL_NAMES[currentModel] === 'XWing' && hangarObj) enterHangar();
  // Inseln neu bauen: das Modell, das man SELBST fahrt, darf nicht zusaetzlich als Kulisse dastehen.
  // Beim Vorfeld war das schon so geloest (parkPlaneAt laesst den eigenen Platz frei), aber
  // cycleModel baute die Zellen nie neu — beim Wechsel per Taste blieb der alte Stand stehen.
  // Am Feuerwehrboot fiel das sofort auf: es liegt am Strand, und wer es per M waehlte, sass mitten
  // im Kulissenboot. Gemeldet als „jetzt sind wenn man das boot nimmt 2 boote uebereinander".
  refreshIslands();
  // Motorsound wird von updateEngineSound automatisch nachgezogen (erkennt Modellwechsel)
}

// Passende Startposition je Modell suchen (ortsfest, deterministisch):
//  Airbus -> Stadt-Flugschneise · AlphaJet/Mustang -> Trägerdeck · Canadair -> Hafen · Transall -> Landebahn.
// Sucht in wachsenden Ringen um den Ursprung. Rückgabe {x,y,z,yaw} oder null (Fallback Start-Bahn).
function findStart(name){
  const near = (cx,cz)=>{     // helper: Suche in Ringen 0..8 um (cx,cz)
    for(let r=0;r<=8;r++){
      for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==r) continue;   // nur Ring-Rand
        const res = probe(cx+dx, cz+dz); if(res) return res;
      }
    }
    return null;
  };
  let probe;
  if(name==='Airbus'){
    // Stadt-Insel: Flugschneise liegt bei x≈Inselmitte, entlang Z -> dort am Bahn-Anfang aufstellen
    probe=(cx,cz)=>{ const info=islandInfo(cx,cz); if(!info) return null;
      if(cellRnd(cx,cz,99)>=0.10) return null;                 // nur Städte
      const rwLen=Math.min(260, info.radius*1.4);
      // ans +Z-Ende stellen, Nase (-Z bei yaw=0) läuft die ganze Bahn entlang
      return { x:info.wx, y:ISLAND_Y, z:info.wz + rwLen*0.5 - 20, yaw:0 }; };
  } else if(name==='AlphaJet'){
    // Der Alpha Jet bleibt auf dem Traegerdeck — er ist der Jet, und ein Katapultstart ist genau
    // sein Auftritt. Die Mustang steht jetzt auf einer Insel (siehe unten): sie ist ein Warbird,
    // kein Marineflieger, und man findet sie so viel leichter wieder.
    probe=(cx,cz)=>{ const info=carrierInfo(cx,cz); if(!info) return null;
      const dz=FORD_LEN*0.5-30;
      return { y:fordDeckY, yaw:info.rot, _deck:{info,dz} }; };
  } else if(name === 'Sub'){
    // Genau der Platz, an dem auch das Kulissen-U-Boot liegt (harborSubLocal) — dritte Seite des
    // Hafens, rueckwaerts, Bug aufs Wasser. Damit findet man es beim Start ueber die Modellauswahl
    // an derselben Stelle wie zu Fuss, und die Kulisse verschwindet dort (buildIsland fragt isSub).
    probe=(cx,cz)=>{ const info=islandInfo(cx,cz); if(!info) return null;
      const bl = harborSubLocal(cx, cz); if(!bl) return null;
      return { x:info.wx + bl.x, y:0, z:info.wz + bl.z, yaw:bl.rot }; };
  } else if(name==='Canadair' || name==='Boat'){
    probe=(cx,cz)=>{ const info=islandInfo(cx,cz); if(!info) return null;
      // AM STRAND, ruecklings: die Nase zeigt aufs Wasser, das Heck steht im Sand. So laeuft man von
      // hinten heran und steigt ein, ohne durch Wasser zu muessen (dort faengt das Schlauchboot an).
      //
      // Vorher standen beide IM Wasser (radius*1,14 bzw. 1,35) neben dem Hafen. Fuer die Canadair war
      // das in Ordnung — sie ist ein Flugboot —, aber das Einsteigen war „fast nicht moeglich", weil
      // der Weg dorthin durchs Wasser fuehrte. Am Strand ist der Grund fest (evaSolid kennt den
      // Sandrand), also faellt der Konflikt weg.
      //
      // Dieselbe Radialstelle wie das Kai-Boot (HARBOR_BOAT_FAC = Sandkante), aber auf der ANDEREN
      // Seite des Hafens: das Feuerwehrboot liegt +HARBOR_BOAT_SIDE tangential, die Canadair -SIDE.
      // So stehen sie nie ineinander, und beide sind vom Hafen aus zu Fuss erreichbar.
      const ang = -Math.PI/2 + (cellRnd(cx,cz,46)-0.5)*1.2;    // Hafenwinkel (wie harborLocal)
      const rx = Math.cos(ang), rz = Math.sin(ang);            // radial nach aussen
      const tx = -rz,           tz = rx;                       // tangential
      const rr = info.radius * HARBOR_BOAT_FAC;
      const side = (name === 'Boat') ? HARBOR_BOAT_SIDE : -HARBOR_BOAT_SIDE;
      const px = info.wx + rx*rr + tx*side, pz = info.wz + rz*rr + tz*side;
      // Nase (-Z bei yaw) radial nach aussen, also aufs Wasser — dieselbe Rechnung wie in
      // harborBoatLocal (dort nachgerechnet: Skalarprodukt 1,000 fuer alle vier Himmelsrichtungen).
      return { x:px, y:0, z:pz, yaw:Math.atan2(-rx, -rz) }; };
  } else {  // Transall, Mustang und Default -> Landebahn einer NICHT-Stadt-Insel
    // Nicht-Stadt ausdruecklich: vorher zaehlte jede Insel, also auch eine Wolkenkratzer-Stadt.
    // Dort steht die Bahn in einer Schneise zwischen Tuermen, und mit der traegen Transall (0,85
    // Wendigkeit, 600 m Hoehendeckel) ist das ein unschoener Start. Auf einer normalen Insel hat man
    // freie Sicht, den Hafen, die Rakete und — seit dieser Runde — das Vorfeld mit allen anderen
    // Flugzeugen direkt daneben. Dieselbe Bedingung wie ueberall: cellRnd(...,99) >= 0,10.
    probe=(cx,cz)=>{ const info=islandInfo(cx,cz); if(!info) return null;
      if(cellRnd(cx,cz,99) < 0.10) return null;                // Staedte ueberspringen
      const rwLen=Math.min(260, info.radius*1.4);
      // ans +Z-Ende stellen, Nase (-Z bei yaw=0) laeuft die ganze Bahn entlang
      return { x:info.wx, y:ISLAND_Y, z:info.wz + rwLen*0.5 - 20, yaw:0 }; };
  }
  const pcx=Math.round(state.pos.x/CELL), pcz=Math.round(state.pos.z/CELL);
  return near(pcx,pcz);
}
function placeAtStart(name){
  const s = findStart(name);
  // Das U-Boot braucht denselben Rueckfall wie das Boot: die Start-Landebahn waere Land, dort kaeme
  // es nicht weg. Es braucht aber MEHR Wasser (95 m Rumpf gegen 16 m), deshalb ein eigener Zweig
  // mit weiterem Suchradius statt einer gemeinsamen Bedingung.
  if(!s && name === 'Sub'){
    let px = 0, pz = 0, found = false;
    for(let r = CELL*1.2; r < CELL*8 && !found; r += CELL*0.5){
      for(let a = 0; a < 16 && !found; a++){
        const tx = Math.cos(a/16*Math.PI*2)*r, tz = Math.sin(a/16*Math.PI*2)*r;
        // Der ganze Rumpf muss frei sein, nicht nur die Mitte: an drei Stellen laengs pruefen.
        let ok = true;
        for(const d of [-47, 0, 47]){
          const qx = tx, qz = tz + d;
          if(isOnLand(qx,qz) || isOnBeach(qx,qz) || isOnCarrier(qx,qz)
             || hitsBuilding(qx, ISLAND_Y+2, qz, false)){ ok = false; break; }
        }
        if(ok){ px = tx; pz = tz; found = true; }
      }
    }
    state.pos.set(px, 0, pz); state.quat.identity();
  } else if(!s && name === 'Boat'){
    // Boot-Fallback: offenes Meer suchen (die Start-Bahn waere Land -> es kaeme nicht weg).
    let px = 0, pz = 0, found = false;
    for(let r = CELL*0.7; r < CELL*6 && !found; r += CELL*0.5){
      for(let a = 0; a < 12 && !found; a++){
        const tx = Math.cos(a/12*Math.PI*2)*r, tz = Math.sin(a/12*Math.PI*2)*r;
        if(!isOnLand(tx,tz) && !isOnBeach(tx,tz) && !isOnCarrier(tx,tz)
           && !hitsBuilding(tx, ISLAND_Y+2, tz, false)){
          px = tx; pz = tz; found = true;
        }
      }
    }
    state.pos.set(px, 0, pz); state.quat.identity();
  } else if(!s){ // Fallback: Start-Insel-Bahn
    state.pos.set(0,ISLAND_Y,110); state.quat.identity();
  } else {
    // Trägerdeck: Position exakt entlang der gedrehten Deck-Achse setzen
    if(s._deck){
      const {info,dz}=s._deck; const cs=Math.cos(info.rot), sn=Math.sin(info.rot);
      state.pos.set(info.wx + sn*dz, fordDeckY, info.wz + cs*dz);
    } else {
      state.pos.set(s.x, s.y, s.z);
    }
    state.quat.setFromEuler(new THREE.Euler(0, s.yaw, 0, 'YXZ'));
  }
  state.vel.set(0,0,0); state.throttle=0; state.onGround=true;
  state.crashed=false; state.crashTimer=0; state.ejected=false; state.falling=false; state.stalling=false; boosting=false;
  xwingLaunch=false;   // eine laufende Startsequenz endet mit dem Reset (siehe boostDruck)
  wasSupersonic=false; if(vaporCone) vaporCone.visible=false; vaporT=0;
  clearRescue(); clearParachute(); clearBoatSpray(); clearEva();
  planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
  // Kamera HART hinter den Flieger setzen (nicht lerpen) -> hängt nie im Himmel nach Crash/Wechsel.
  if(typeof camera !== 'undefined'){
    const back = new THREE.Vector3(0,0,1).applyQuaternion(state.quat);
    camera.position.set(state.pos.x + back.x*24, state.pos.y + 8, state.pos.z + back.z*24);
    camera.lookAt(state.pos);
  }
}

// ---------- Audio (Web Audio API) ----------
let audioCtx = null, engineBuf = null, crashBuf = null;
let engineSrc = null, engineGain = null;
const decodedCache = {};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // Crash vorab dekodieren
  decodeSound(window.FMS_SND._crash).then(b => crashBuf = b);
  // Motorsound wird von updateEngineSound (im Loop) automatisch gestartet
}
function b64ToArrayBuffer(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function decodeSound(dataUrl) {
  if (decodedCache[dataUrl]) return Promise.resolve(decodedCache[dataUrl]);
  return audioCtx.decodeAudioData(b64ToArrayBuffer(dataUrl)).then(buf => {
    decodedCache[dataUrl] = buf; return buf;
  });
}
function soundUrlFor(name){
  // Canadair -> Propellersound (SuperCup), AlphaJet/X-Wing -> Turbine (Airbus), sonst Propeller.
  // Das Boot hat keinen Eintrag: sein Motor wird synthetisch erzeugt (siehe makeBoatEngineBuffer).
  const turbine = (name==='AlphaJet' || name==='XWing');
  return window.FMS_SND[name] || (turbine ? window.FMS_SND['Airbus'] : window.FMS_SND['SuperCup']);
}
// ---- Motorbootgeräusch (synthetisch, kein Sample) ----
// Zwei Anteile, die zusammen wie ein Außenborder klingen:
//  1. Auspuffschläge: ein Grundton um 42 Hz mit Obertönen, dazu ein leichtes Flattern in der
//     Drehzahl (echte Motoren laufen nie exakt rund) — das gibt das typische Blubbern.
//  2. Wasserrauschen: gefiltertes Rauschen, das den Schaum am Rumpf andeutet.
// Der Puffer ist so lang, dass der Grundton sauber durchläuft (ganze Perioden), sonst knackt es
// bei jeder Loop-Wiederholung.
let boatEngineBuf = null;
function makeBoatEngineBuffer(){
  if(!audioCtx) return null;
  const sr = audioCtx.sampleRate;
  // Der Puffer muss sich NAHTLOS schließen, sonst knackt es bei jeder Wiederholung — hörbar, weil
  // der Loop zwei Sekunden kurz ist. Dafür muss jede beteiligte Schwingung am Pufferende genau
  // dort stehen, wo sie angefangen hat. Also: eine Grundperiode T festlegen und alle Frequenzen
  // als ganzzahlige Vielfache von 1/T wählen.
  // (Ein erster Versuch mit "ganzen Perioden der Grundfrequenz" ging schief: die Frequenzmodulation
  // verschiebt die Phase, gemessen sprang das Signal am Ende von −0,63 auf −0,01.)
  const T = 2.0;                                  // Looplänge in Sekunden
  const len = Math.round(sr * T);
  const hz = (k)=> k / T;                         // k-te Harmonische der Looplänge
  const F0   = hz(84);                            // 42 Hz Auspuffschlag
  const WOB1 = hz(6), WOB2 = hz(15);              // 3 und 7,5 Hz Drehzahl-Flattern
  const buf = audioCtx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // Wasserrauschen am Rumpf: tiefpassgefiltertes Rauschen. Zufall schließt sich nicht von allein,
  // deshalb wird nur die erste HÄLFTE erzeugt und dann gespiegelt fortgesetzt — damit ist der Wert
  // am Pufferende derselbe wie am Anfang. Rauschen klingt gespiegelt genauso zufällig, das Ohr
  // erkennt in Rauschen keine Achsensymmetrie.
  const half = Math.floor(len/2);
  const noise = new Float32Array(len);
  let lp = 0;
  for(let i=0;i<=half;i++){
    lp += ((Math.random()*2-1) - lp) * 0.06;      // Tiefpass ~ ein paar hundert Hz
    noise[i] = lp;
  }
  for(let i=half+1;i<len;i++) noise[i] = noise[len-i];   // gespiegelt -> noise[len-1] = noise[1]
  // Phase INTEGRIEREN statt f*t zu rechnen: bei modulierter Frequenz ist nur das Integral stetig,
  // und weil alle Anteile ganzzahlige Vielfache von 1/T sind, endet es wieder bei 0 (mod 2π) —
  // nachgemessen schließt es auf 0,0000 Perioden.
  let ph = 0;
  const AM1 = 0.035, AM2 = 0.02;
  for(let i=0;i<len;i++){
    const t = i / sr;
    const wob = 1 + AM1*Math.sin(2*Math.PI*WOB1*t) + AM2*Math.sin(2*Math.PI*WOB2*t);
    ph += 2*Math.PI*F0*wob/sr;
    // Auspuffschläge: Grundton + Obertöne, abfallend gewichtet
    let v = Math.sin(ph)*0.55 + Math.sin(2*ph)*0.28 + Math.sin(3*ph)*0.14 + Math.sin(5*ph)*0.06;
    // Schlagcharakter: Halbwellen anschärfen (Auspufftakt statt reiner Sinus)
    v = Math.sign(v) * Math.pow(Math.abs(v), 0.72);
    d[i] = v*0.62 + noise[i]*0.5;
  }
  // Normieren, damit die Lautstärke-Regelung dieselbe Skala hat wie bei den Samples
  let peak = 0;
  for(let i=0;i<len;i++) peak = Math.max(peak, Math.abs(d[i]));
  if(peak > 0) for(let i=0;i<len;i++) d[i] /= peak;
  return buf;
}
function startEngineLoop(buf) {
  if (!audioCtx || !buf) return;
  if (engineSrc) { try { engineSrc.stop(); } catch(e){} }
  engineSrc = audioCtx.createBufferSource();
  engineSrc.buffer = buf;
  engineSrc.loop = true;
  engineGain = audioCtx.createGain();
  engineGain.gain.value = 0;
  engineSrc.connect(engineGain).connect(audioCtx.destination);
  engineSrc.start();
}
// updateEngineSound ist die EINZIGE Steuerstelle: sorgt dafür, dass für das aktuelle
// Modell der richtige Loop läuft (deckt Start + Wechsel einheitlich ab, keine Races).
let engineFor = null;          // welches Modell aktuell klingt
let enginePending = null;      // welches Modell gerade geladen wird
let engineBufCurrent = null;   // Puffer des aktuell laufenden Loops
// ---- U-BOOT-MOTOR: tiefes Summen statt Aussenborder ---------------------------------------------
// Das U-Boot lief bisher mit demselben synthetischen Motor wie das Feuerwehrboot. Das ist als
// Notloesung verstaendlich (beides sind Schiffsdiesel), klingt aber falsch: ein Aussenborder
// blubbert und schlaegt, ein getauchtes U-Boot summt. Man hoert einen Elektromotor und die
// Schraube, gedaempft durch den Druckkoerper — keine Auspuffschlaege, denn unter Wasser laeuft
// kein Verbrennungsmotor.
//
// Gebaut nach demselben Verfahren wie makeBoatEngineBuffer, und der wichtigste Punkt daran ist der
// NAHTLOSE Loop: jede beteiligte Schwingung muss am Pufferende genau dort stehen, wo sie angefangen
// hat, sonst knackt es bei jeder Wiederholung. Dafuer werden alle Frequenzen als ganzzahlige
// Vielfache von 1/T gewaehlt.
let subEngineBuf = null;
function makeSubEngineBuffer(){
  if(!audioCtx) return null;
  const sr = audioCtx.sampleRate;
  const T = 2.0;                                  // Looplaenge in Sekunden
  const len = Math.round(sr * T);
  const hz = (k)=> k / T;                         // k-te Harmonische der Looplaenge
  // Grundton 26 Hz: deutlich tiefer als der Aussenborder (42 Hz). Ein Elektromotor unter Last
  // brummt tief und gleichmaessig, und die Tiefe traegt durch das Wasser.
  const F0   = hz(52);
  // Die SCHRAUBE: sieben Blaetter bei niedriger Drehzahl geben ein Wummern um 8 Hz. Das ist der
  // Klang, den man von U-Boot-Aufnahmen kennt.
  const BLADE = hz(16);
  // Ganz langsames Schwellen, damit es nicht wie ein Dauerton steht.
  const SWELL = hz(3);
  const buf = audioCtx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  // Wasserrauschen: viel dumpfer gefiltert als beim Boot (0,015 statt 0,06), weil man es durch den
  // Druckkoerper hoert. Erste Haelfte erzeugen und gespiegelt fortsetzen, damit der Puffer sich
  // schliesst — Rauschen klingt gespiegelt genauso zufaellig.
  const half = Math.floor(len/2);
  const noise = new Float32Array(len);
  let lp = 0, lp2 = 0;
  for(let i=0;i<=half;i++){
    lp  += ((Math.random()*2-1) - lp) * 0.015;    // sehr tiefer Tiefpass: dumpfes Stroemungsrauschen
    lp2 += (lp - lp2) * 0.05;                     // zweite Stufe, nimmt die letzten Hoehen weg
    noise[i] = lp2;
  }
  for(let i=half+1;i<len;i++) noise[i] = noise[len-i];
  // Phase integrieren (siehe makeBoatEngineBuffer): nur so ist sie bei modulierter Frequenz stetig.
  let ph = 0;
  for(let i=0;i<len;i++){
    const t = i / sr;
    // Leichtes Schwellen der Drehzahl, viel schwaecher als beim Aussenborder (der flattert).
    const wob = 1 + 0.012*Math.sin(2*Math.PI*SWELL*t);
    ph += 2*Math.PI*F0*wob/sr;
    // Reine Sinusanteile ohne Schlagcharakter: ein Elektromotor hat keine Zuendungen. Die
    // geradzahligen Obertoene ueberwiegen, das klingt nach Maschine statt nach Motor.
    let v = Math.sin(ph)*0.62 + Math.sin(2*ph)*0.22 + Math.sin(4*ph)*0.08;
    // Das Schraubenwummern moduliert die Lautstaerke — genau das macht den U-Boot-Klang.
    const blade = 1 + 0.35*Math.sin(2*Math.PI*BLADE*t);
    v *= blade;
    // Stroemungsrauschen dazu, kraeftiger als beim Boot: unter Wasser ist es das, was man neben
    // dem Motor hoert.
    v = v*0.62 + noise[i]*8.0;
    d[i] = Math.max(-1, Math.min(1, v*0.5));
  }
  return buf;
}
// ---- MEERESKULISSE: Moewen an der Insel, Ozeanrauschen draussen ---------------------------------
// Zwei Aufnahmen (ambient.js), beide als Dauerloop, beide LEISE — sie sollen die Szene traegen, nicht
// im Vordergrund stehen. Der Motor bleibt das laute Geraeusch.
//
// Ortsabhaengig, und das ist der Reiz: Moewen sind Kuestenvoegel, man hoert sie also nur in
// Inselnaehe, und das Ozeanrauschen gehoert nach draussen aufs offene Meer. Wer vom Hafen hinaus
// faehrt, hoert die Moewen verklingen und das Meer aufkommen.
//
// Beides nur UEBER Wasser und in Bodennaehe: unter Wasser hoert man keine Moewen (dort laeuft der
// Motor und das Stroemungsrauschen), und aus 3.000 m Hoehe auch nicht.
const AMB_GULL_R  = 900;    // m: bis hierher sind Moewen zu hoeren. Etwas mehr als ein Inselradius
                            // (170 bis 330 m) plus Schelf — man hoert sie also schon beim Anfahren.
const AMB_MAX_Y   = 400;    // m Hoehe: darueber verstummt die Kulisse. Ein Flugzeug in Reisehoehe
                            // hoert nur seinen Motor.
const AMB_GULL_VOL = 0.26;  // Grundlautstaerke. Von 0,16 hoch ("das moewen ambiente kann ein wenig
                            // lauter werden") — Kulisse bleibt es trotzdem, der Motor liegt bei
                            // 0,09 bis 0,25 und das Ozeanrauschen bleibt, wo es war ("wind ist super").
const AMB_OCEAN_VOL= 0.13;  // unveraendert: genau richtig getroffen.
const AMB_RATE    = 0.7;    // wie schnell die Lautstaerke nachlaeuft (pro Sekunde). Langsam, damit
                            // der Wechsel Insel/offenes Meer ein Uebergang ist und kein Umschalten.
let ambGullSrc = null, ambGullGain = null;
let ambOceanSrc = null, ambOceanGain = null;
let ambStarted = false;
// Einen Dauerloop starten. Eigener Gain-Knoten je Spur, damit beide unabhaengig geblendet werden.
function ambStart(dataUrl, cb){
  if(!audioCtx || !dataUrl) return;
  decodeSound(dataUrl).then(buf=>{
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = audioCtx.createGain();
    gain.gain.value = 0;          // stumm starten und einblenden, sonst knallt es beim Einsetzen
    src.connect(gain).connect(audioCtx.destination);
    src.start();
    cb(src, gain);
  }).catch(err=>console.warn('Ambient-Sound Ladefehler:', err));
}
function updateAmbient(dt){
  if(!audioCtx || audioCtx.state !== 'running' || !window.FMS_AMB) return;
  // Einmal starten, sobald der Context laeuft (die Autoplay-Sperre der Browser verlangt das).
  if(!ambStarted){
    ambStarted = true;
    ambStart(window.FMS_AMB.gulls, (s,g)=>{ ambGullSrc = s; ambGullGain = g; });
    ambStart(window.FMS_AMB.ocean, (s,g)=>{ ambOceanSrc = s; ambOceanGain = g; });
  }
  if(!ambGullGain || !ambOceanGain) return;
  let gull = 0, ocean = 0;
  // Nur in der Inselwelt, nur ueber Wasser, nur in Bodennaehe — und nicht getaucht (uwCamBlend
  // steuert schon Nebel und Farbe, hier bestimmt es die Stille unter Wasser).
  if(soundOn && locale === 'earth' && uwCamBlend < 0.3){
    const F = worldFocus();
    const y = eva ? eva.group.position.y : state.pos.y;
    if(y < AMB_MAX_Y){
      // Mit der Hoehe ausblenden, nicht hart abschneiden: sonst setzt die Kulisse beim Steigen
      // ploetzlich aus.
      const hoehe = 1 - Math.max(0, Math.min(1, y / AMB_MAX_Y));
      // MOEWEN: wie weit ist die naechste Insel? islandInfo ist gecacht, die Abfrage also billig.
      // Gesucht wird im Umkreis von AMB_GULL_R, das sind bei CELL 850 zwei Zellen in jede Richtung.
      let nah = 1e9;
      const pcx = Math.round(F.x / CELL), pcz = Math.round(F.z / CELL);
      for(let dz=-1; dz<=1; dz++) for(let dx=-1; dx<=1; dx++){
        const info = islandInfo(pcx+dx, pcz+dz);
        if(!info) continue;
        const d = Math.hypot(F.x-info.wx, F.z-info.wz) - info.radius;
        if(d < nah) nah = d;
      }
      // Voll am Ufer, aus bei AMB_GULL_R. smoothstep, damit es an beiden Enden weich auslaeuft.
      const gRoh = 1 - Math.max(0, Math.min(1, nah / AMB_GULL_R));
      gull = gRoh*gRoh*(3-2*gRoh) * AMB_GULL_VOL * hoehe;
      // OZEAN: das Gegenstueck — draussen laut, an der Insel leise. Nicht ganz aus, denn Brandung
      // hoert man auch am Ufer; deshalb bleibt ein Drittel stehen.
      ocean = (0.33 + 0.67*(1-gRoh)) * AMB_OCEAN_VOL * hoehe;
    }
  }
  // Gleitend nachfuehren (siehe AMB_RATE): ein harter Wechsel waere als Klicken zu hoeren.
  const k = Math.min(1, AMB_RATE*dt);
  ambGullGain.gain.value  += (gull  - ambGullGain.gain.value ) * k;
  ambOceanGain.gain.value += (ocean - ambOceanGain.gain.value) * k;
}
// ---- SONAR-PING auf B: Lautstaerke nach Abstand zum naechsten Wrack ----------------------------
// Erst lief er automatisch alle 15 s. Auf Wunsch jetzt "nicht alle 15s sondern als aktion auf b
// lautstaerke in abhaengigkeit der entfernung behalten" — und das ist auch das bessere Geraet: man
// pingt, wenn man wissen will, ob da etwas ist, statt zu warten, bis der Takt es verraet.
// Der Ping ergaenzt das Periskop, denn unter Wasser reicht der Blick nur 165 bis 180 m. Man HOERT
// also, dass da etwas ist, bevor man es sieht.
const SONAR_R      = 1200;  // m: ab hier ist ueberhaupt etwas zu hoeren. Etwas weniger als der
                            // Periskop-Radius (1.400 m), damit das Bild eher da ist als der Ton.
const SONAR_VOL_MIN= 0.05;  // "lautstaerke in abhaengigkeit der entfernung behalten": am Rand
const SONAR_VOL_MAX= 0.30;  // schwach, am Wrack deutlich. Hoeher als beim automatischen Ping, denn
                            // jetzt loest man ihn selbst aus und will die Antwort auch hoeren.
const SONAR_COOL   = 2.5;   // s Sperre zwischen zwei Pings. Von 1,2 hoch: der Ping selbst klingt
                            // rund 3 s, ein neuer setzte also mitten in den Nachhall des vorigen
                            // ("nach 1,2 sek startet es neu"). 2,5 s lassen ihn fast ausklingen und
                            // halten die Ueberlappung auf den Rest des Halls beschraenkt — das
                            // klingt nach Echo statt nach Doppelschlag.
let sonarCool = 0;
// Der Ping ist eine AUFNAHME (ambient.js, Schluessel "sonar") und kein synthetischer Sinus mehr —
// "hier ein richtiger sonar ping". Sie wird einmal dekodiert und danach aus dem Puffer gespielt,
// sonst dekodiert jeder Tastendruck 216 kB neu.
//
// UND SIE WIRD NORMIERT. Die Datei ist extrem leise ausgesteuert: gemeldet als "das geraeusch ist
// extremst leise ... wenn ich den lautsprecher voll aufdrehe kann ich es leise wahrnehmen".
// Nachgemessen an den MP3-Skalierungsfaktoren (global_gain, C:/tmp/mp3lev.js) liegt ihr Median bei
// 123, waehrend die beiden hoerbaren Ambient-Aufnahmen bei 151 (Moewen) und 162 (Ozean) liegen —
// vier Stufen sind eine Verdopplung, der Ping liegt also rund Faktor 900 darunter.
//
// Eine feste Zahl im Gain waere die falsche Antwort darauf: sie muesste bei jeder neuen Aufnahme
// wieder von Hand angepasst werden. Stattdessen wird der SPITZENWERT gesucht und der Puffer darauf
// skaliert. Danach heisst vol = 0,30 wirklich "30 % Vollaussteuerung", genau wie beim Motor
// (0,09 bis 0,25) — der Pegel haengt an dieser Zahl und nicht mehr an der Datei.
const SONAR_PEAK = 0.9;     // Ziel-Spitzenwert. Nicht 1,0: zwei ueberlappende Pings addieren sich,
                            // und oberhalb von 1 schneidet die Ausgabe hart ab (Knacken).
// Auf den Spitzenwert normieren, an Ort und Stelle. Mehrfaches Anwenden schadet nicht: danach IST
// der Spitzenwert das Ziel, ein zweiter Durchgang skaliert also mit 1.
function normalizePeak(buf, ziel){
  let peak = 0;
  for(let c=0;c<buf.numberOfChannels;c++){
    const d = buf.getChannelData(c);
    for(let i=0;i<d.length;i++){ const a = Math.abs(d[i]); if(a > peak) peak = a; }
  }
  if(peak <= 0) return buf;                 // reine Stille: nichts zu holen
  const f = ziel / peak;
  for(let c=0;c<buf.numberOfChannels;c++){
    const d = buf.getChannelData(c);
    for(let i=0;i<d.length;i++) d[i] *= f;
  }
  return buf;
}
let sonarBuf = null, sonarPending = false;
function playSonarPing(vol){
  if(!soundOn || !audioCtx || audioCtx.state !== 'running') return;
  if(!sonarBuf){
    // Beim ersten Mal dekodieren und den Ping DANACH nachziehen — sonst waere der allererste
    // Tastendruck stumm, und das fuehlt sich wie ein Fehler an.
    if(!sonarPending && window.FMS_AMB && window.FMS_AMB.sonar){
      sonarPending = true;
      decodeSound(window.FMS_AMB.sonar).then(b=>{
        sonarBuf = normalizePeak(b, SONAR_PEAK);
        sonarPending = false;
        playSonarPing(vol);       // jetzt liegt der Puffer, also kommt der Ping doch
      }).catch(err=>{ sonarPending = false; console.warn('Sonar-Ping Ladefehler:', err); });
    }
    return;
  }
  const src = audioCtx.createBufferSource(); src.buffer = sonarBuf;
  const g = audioCtx.createGain(); g.gain.value = vol;
  src.connect(g).connect(audioCtx.destination);
  src.start();
}
// Abstand zum naechsten Wrack im RAUM, oder Infinity. Getrennt von updateSonar, weil der Tastendruck
// ihn braucht und nicht der Frametakt.
function sonarDist(){
  const pcx = Math.round(state.pos.x / CELL), pcz = Math.round(state.pos.z / CELL);
  const span = Math.ceil(SONAR_R / CELL) + 1;
  let nah = Infinity;
  for(let dz=-span; dz<=span; dz++) for(let dx=-span; dx<=span; dx++){
    for(const wi of wreckInfos(pcx+dx, pcz+dz)){
      // Abstand im RAUM, nicht in der Ebene: ein Wrack 100 m unter einem ist nicht 'da', und beim
      // Fahren dicht unter der Oberflaeche macht das den Unterschied.
      const d = Math.hypot(wi.wx-state.pos.x, wi.y-state.pos.y, wi.wz-state.pos.z);
      if(d < nah) nah = d;
    }
  }
  return nah;
}
// B im getauchten U-Boot: einmal pingen. Die Lautstaerke haengt am naechsten Wrack — das ist der
// Sinn der Sache, man tastet damit die Umgebung ab.
// Ist nichts in Reichweite, kommt der Ping TROTZDEM, nur ganz leise: ein Sonar, das auf Tastendruck
// schweigt, fuehlt sich kaputt an, und "nichts geortet" ist selbst eine Antwort.
function sonarPing(){
  if(sonarCool > 0) return;
  sonarCool = SONAR_COOL;
  const nah = sonarDist();
  if(nah > SONAR_R){ playSonarPing(SONAR_VOL_MIN*0.6); return; }
  // Naeher = lauter, mit smoothstep, damit die Naehe sich am Ende deutlicher anfuehlt als am Rand.
  const f = 1 - nah/SONAR_R;
  const s = f*f*(3-2*f);
  playSonarPing(SONAR_VOL_MIN + (SONAR_VOL_MAX-SONAR_VOL_MIN)*s);
}
// Nur noch die Sperre herunterzaehlen — gepingt wird auf Tastendruck (siehe sonarPing).
function updateSonar(dt){
  if(sonarCool > 0) sonarCool -= dt;
}
function updateEngineSound() {
  if (!audioCtx) return;
  // AudioContext jeden Frame aufwecken, falls (noch) suspendiert (Browser-Autoplay-Sperre).
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const running = audioCtx.state === 'running';
  // Im Schlauchboot laeuft derselbe synthetische Aussenborder wie beim Feuerwehrboot — es ist ja
  // auch einer. Das schlaegt das Modell des abgestellten Fliegers, denn zu hoeren ist das Boot.
  //
  // Das U-BOOT hat seit dieser Runde einen EIGENEN Motor ('Sub'). Vorher lief dort der
  // Aussenborder, und das klang falsch: ein Aussenborder blubbert und schlaegt, ein U-Boot summt.
  const model = (eva && eva.boat) ? 'Boat' : (isSub() ? 'Sub' : MODEL_NAMES[currentModel]);
  // Boot: eigener, synthetisch erzeugter Motorloop (kein Sample zum Dekodieren).
  if (model === 'Boat') {
    if (!boatEngineBuf) boatEngineBuf = makeBoatEngineBuffer();
    if (boatEngineBuf && engineFor !== 'Boat') { engineBufCurrent = boatEngineBuf; engineFor = 'Boat'; }
  }
  // U-Boot: tiefes Summen mit Schraubenwummern (siehe makeSubEngineBuffer).
  else if (model === 'Sub') {
    if (!subEngineBuf) subEngineBuf = makeSubEngineBuffer();
    if (subEngineBuf && engineFor !== 'Sub') { engineBufCurrent = subEngineBuf; engineFor = 'Sub'; }
  }
  // Puffer fürs aktuelle Modell laden (nur einmal pro Modell)
  else if (engineFor !== model && enginePending !== model) {
    enginePending = model;
    decodeSound(soundUrlFor(model)).then(buf => {
      if (MODEL_NAMES[currentModel] === model) { engineBufCurrent = buf; engineFor = model; }
      enginePending = null;
    });
  }
  // Loop (neu) starten, wenn: Puffer da, aber kein Source läuft ODER Context erst jetzt "running".
  // engineFor wird oben gesetzt; der Loop-Start hängt zusätzlich am running-State.
  if (running && engineBufCurrent && (!engineSrc || engineSrc.buffer !== engineBufCurrent)) {
    startEngineLoop(engineBufCurrent);
  }
  if (!engineGain || !engineSrc) return;
  // Während des Crash-Einsatzes: Motor stumm (nur Sirene). Ebenso, während man ausgestiegen ist —
  // der Flieger steht mit abgeschaltetem Motor.
  // Draussen ist der Flugzeugmotor aus — AUSSER im Schlauchboot, dort laeuft dessen eigener.
  if (!soundOn || state.crashed || (eva && !eva.boat)) { engineGain.gain.value = 0; return; }
  // Im Schlauchboot bestimmt sein Gas die Drehzahl, nicht der Schub des abgestellten Fliegers.
  const t = (eva && eva.boat) ? (eva.boatThr || 0) : state.throttle;
  // Das U-Boot bekommt denselben synthetischen Motor: es ist ein Schiffsdiesel, kein Flugzeug.
  if (isWaterCraft() || (eva && eva.boat)) {
    // Boot: der Motor bollert auch im Leerlauf deutlich hörbar (ein Außenborder läuft ja weiter),
    // und die Drehzahl steigt weniger steil als bei einem Flugzeug. Umkehrschub (negativer Wert)
    // klingt genauso wie Vorwärtsfahrt — die Schraube dreht ja nur andersherum.
    const a = Math.abs(t);
    engineGain.gain.value = 0.09 + a * 0.16;
    engineSrc.playbackRate.value = 0.72 + a * 0.55;
    return;
  }
  // Lautstärke steigt MONOTON (Vollgas bleibt am lautesten), aber deutlich FLACHER als früher,
  // damit es insgesamt nicht zu laut wird: 0 % -> 0.05, 100 % -> 0.23.
  const vol = 0.05 + t * 0.18;
  engineGain.gain.value = vol;
  engineSrc.playbackRate.value = 0.7 + t * 0.9; // Tonhöhe ∝ Schub
}
function playCrash() {
  if (!soundOn || !audioCtx || !crashBuf) return;
  const s = audioCtx.createBufferSource();
  s.buffer = crashBuf;
  const g = audioCtx.createGain(); g.gain.value = 0.9;
  s.connect(g).connect(audioCtx.destination);
  s.start();
}
// Überschallknall: kurzer, tiefer Rausch-Impuls (synthetisch, kein Sample nötig).
function playSonicBoom(){
  if(!soundOn || !audioCtx) return;
  const dur = 0.5, sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(1, Math.floor(sr*dur), sr);
  const d = buf.getChannelData(0);
  for(let i=0;i<d.length;i++){
    const env = Math.pow(1 - i/d.length, 2);      // schnelles Abklingen
    d[i] = (Math.random()*2-1) * env;             // weißes Rauschen mit Hüllkurve
  }
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const lp = audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=220; // dumpf/tief
  const g = audioCtx.createGain(); g.gain.value = 0.6;
  src.connect(lp).connect(g).connect(audioCtx.destination);
  src.start();
}

// ---- Sirene (Tatütata) synthetisch: zwei abwechselnde Töne ----
let sirenOsc = null, sirenGain = null, sirenTimer = null;
function startSiren() {
  if (!soundOn || !audioCtx || sirenOsc) return;
  sirenOsc = audioCtx.createOscillator();
  sirenOsc.type = 'square';
  sirenGain = audioCtx.createGain();
  sirenGain.gain.value = 0.06;                 // leise (dein Wunsch: leichtes Tatütata)
  sirenOsc.connect(sirenGain).connect(audioCtx.destination);
  sirenOsc.frequency.value = 660;
  sirenOsc.start();
  let hi = true;
  sirenTimer = setInterval(() => {
    if (!sirenOsc) return;
    hi = !hi;
    sirenOsc.frequency.setValueAtTime(hi ? 660 : 500, audioCtx.currentTime); // Ta-Tü
  }, 500);
}
function stopSiren() {
  if (sirenTimer) { clearInterval(sirenTimer); sirenTimer = null; }
  if (sirenOsc) { try { sirenOsc.stop(); } catch(e){} sirenOsc = null; sirenGain = null; }
}
// Audio erst nach erster Nutzer-Interaktion starten (Browser-Regel)
function armAudio(){ initAudio(); if(audioCtx && audioCtx.state==='suspended') audioCtx.resume(); }
addEventListener('keydown', armAudio, { once:true });
addEventListener('pointerdown', armAudio, { once:true });
// Gamepad: beim ersten Tastendruck (im Loop) aktivieren
let audioArmed = false;
let soundOn = false;   // Ton standardmäßig AUS (nervt auf Dauer); D-Pad ↓ / N schaltet um
function toggleSound(){
  soundOn = !soundOn;
  if(soundOn) armAudio();                        // beim Einschalten Audio initialisieren
  if(engineGain) engineGain.gain.value = 0;      // Motor sofort anpassen (wird im Loop nachgezogen)
  showToggle(soundOn ? '🔊' : '🔇');
}

// ---------- Flugzustand ----------
function resetPlane() {
  // Der X-Wing beginnt im Hangar des Todessterns, alle anderen Modelle in der Inselwelt.
  const toHangar = (MODEL_NAMES[currentModel] === 'XWing') && hangarObj;
  if(locale !== 'earth' && !toHangar) enterEarth();
  state.water = 0;
  state.scoopTime = 0;
  placeAtStart(MODEL_NAMES[currentModel]);   // modellgerechte Startposition (Stadt/Träger/Hafen/Bahn)
  // Missions-Zustände zurücksetzen (der Schalter leadOn bleibt!)
  clearFire(); fireRespawnT=-1; airborneT=0;
  clearCargoTarget(); cargoRespawnT=-1;
  clearPaxTarget(); paxLoad=0; paxLoadT=0; lastPaxLoad=0; paxRespawnT=-1;
  paxBoardQueue=0; paxDropQueue=0; paxDropping=false; paxServiced=false;
  for(const pfg of activePax) scene.remove(pfg.group); activePax.length=0;
  showBig('');
  if(toHangar) enterHangar();               // überschreibt die Erd-Startposition
}

// ---------- Eingaben ----------
const keys = {};
addEventListener('keydown', e => {
  keys[e.code]=true;
  if(e.code==='KeyR') resetPlane();
  if(e.code==='KeyV') cycleView();
  if(e.code==='KeyM') cycleModel();
  if(e.code==='KeyX') state.throttle = 0;
  if(e.code==='KeyB') buttonB();          // B = Aktion (Wasser, Loeschen, Sitz, Kisten, huepfen)
  if(e.code==='KeyY') buttonY();          // Y = ein-/aussteigen und umsteigen (wie am Controller)
  // T (Aufgaben) und J (Schiffs-Diagnose) sind entfallen. J dient jetzt nur noch dem Umsehen
  // nach links (siehe lookX weiter unten) — der Diagnose-Schalter ist raus.

  if(e.code==='KeyH') toggleHelp();       // Tastaturbelegung ein/aus (Standard: aus)
  if(e.code==='KeyN') toggleSound();      // Ton an/aus (Standard: aus)

  if(e.code==='Space') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code]=false; });

let gamepadIndex = null;
addEventListener('gamepadconnected', e => { gamepadIndex=e.gamepad.index;
  document.getElementById('pad').textContent='Controller: '+e.gamepad.id; });
addEventListener('gamepaddisconnected', ()=>{ stopRumble(); gamepadIndex=null;
  document.getElementById('pad').textContent='Controller getrennt.'; });
function deadzone(v, dz=0.15){ return Math.abs(v)<dz ? 0 : (v-Math.sign(v)*dz)/(1-dz); }

// Controller-Vibration (Gamepad Haptics API). Läuft nur, wo unterstützt (Chrome/Edge, X-Input);
// sonst still ignoriert. strong = tiefes Wummern, weak = feines Rattern (je 0..1).
let _rumDbg = '';   // Diagnose (per Taste J sichtbar)
function rumble(durMs, strong, weak){
  if(gamepadIndex===null){ _rumDbg='kein Gamepad'; return; }
  const gp = navigator.getGamepads()[gamepadIndex];
  if(!gp){ _rumDbg='gp null'; return; }
  const w = (weak==null?strong:weak);
  // Variante 1: Standard vibrationActuator.playEffect('dual-rumble', {...})
  const va = gp.vibrationActuator;
  if(va && va.playEffect){
    try{ va.playEffect('dual-rumble', { startDelay:0, duration:durMs, strongMagnitude:strong, weakMagnitude:w });
         _rumDbg='vibrationActuator.playEffect'; return; }catch(e){ _rumDbg='playEffect-Fehler: '+e.message; }
  }
  // Variante 2: vibrationActuator.pulse(value, duration)  (ältere/andere Impl.)
  if(va && va.pulse){
    try{ va.pulse(Math.max(strong,w), durMs); _rumDbg='vibrationActuator.pulse'; return; }catch(e){ _rumDbg='pulse-Fehler: '+e.message; }
  }
  // Variante 3: hapticActuators[0].pulse(...)
  const ha = gp.hapticActuators && gp.hapticActuators[0];
  if(ha && ha.pulse){
    try{ ha.pulse(Math.max(strong,w), durMs); _rumDbg='hapticActuators.pulse'; return; }catch(e){ _rumDbg='haptic-Fehler: '+e.message; }
  }
  _rumDbg='kein Aktuator (va='+(!!va)+' ha='+(!!ha)+')';
}
// Laufende Vibration SOFORT beenden (beim Schließen/Verstecken/Trennen). Deckt dieselben
// Aktuator-Varianten wie rumble() ab. reset() ist die saubere Stopp-API; sonst 0-Effekt.
function stopRumble(){
  if(gamepadIndex===null) return;
  const gp = navigator.getGamepads()[gamepadIndex]; if(!gp) return;
  const va = gp.vibrationActuator;
  if(va){
    try{ if(va.reset){ va.reset(); return; } }catch(e){}
    try{ if(va.playEffect){ va.playEffect('dual-rumble', { startDelay:0, duration:0, strongMagnitude:0, weakMagnitude:0 }); return; } }catch(e){}
    try{ if(va.pulse){ va.pulse(0, 0); return; } }catch(e){}
  }
  const ha = gp.hapticActuators && gp.hapticActuators[0];
  if(ha && ha.pulse){ try{ ha.pulse(0, 0); }catch(e){} }
}
// Beim Verlassen/Verstecken der Seite die Vibration stoppen (pagehide feuert auch beim Tab-Schliessen).
addEventListener('pagehide', stopRumble);
addEventListener('blur', stopRumble);
document.addEventListener('visibilitychange', ()=>{ if(document.hidden) stopRumble(); });
// Vibration an Ereignisse koppeln (Flankenerkennung): Crash stark, Landung sanft, Stall zittern.
let _rumPrevCrashed=false, _rumPrevGround=true, _rumStallT=0;
function updateRumble(dt){
  // CRASH: sobald crashed neu true wird -> kräftiger Stoß
  if(state.crashed && !_rumPrevCrashed) rumble(400, 1.0, 0.9);
  _rumPrevCrashed = state.crashed;
  // LANDUNG: sobald er neu aufsetzt (Boden), sanft — aber NICHT beim Crash und nicht am Reset-Stillstand
  if(state.onGround && !_rumPrevGround && !state.crashed && state.vel.length() > 4) rumble(160, 0.25, 0.4);
  _rumPrevGround = state.onGround;
  // STALL: solange gestallt -> leichtes Dauer-Zittern (alle ~0,25 s neu anstoßen)
  if(state.stalling && !state.crashed){
    _rumStallT -= dt;
    if(_rumStallT <= 0){ rumble(260, 0.15, 0.35); _rumStallT = 0.22; }
  } else _rumStallT = 0;
}

// Blick-Eingabe für den Astronauten (rechter Stick bzw. I/J/K/L). Wird in readInput gesetzt und in
// updateCamera ausgewertet — beim Fahrzeug immer 0.
let lookX = 0, lookY = 0;
let btnPrev = {};
let aPrev = false;   // A-Taste-Halten fuer Umkehrschub (-20 %)
let cPrev = false;   // C-Taste-Halten (Tastatur-Bremse)
let xPrev = false, kbBoostPrev = false;   // X/Shift-Halten fuer Boost
let boosting = false;   // Boost aktiv -> extra Beschleunigung (Physik liest das)
// Startsequenz des X-Wing: X (bzw. Shift) am BODEN gedrueckt heisst „hoch und los" — erst senkrecht
// auf die Schwebehoehe, dann Vollgas vorwaerts. Ohne das setzte X sofort 100 % Schub, damit war der
// VTOL-Bereich (unter VTOL_FWD) verlassen, und der X-Wing rollte wie ein normales Flugzeug los und
// hob erst bei vTO = 55 m/s ab. Gemeldet als „wenn man beim x-wing mit x beschleunigt, steigt der
// flieger nicht auf die minimale schwebehoehe".
//
// Ein eigener Zustand, kein Rechnen im Eingabe-Zweig: der laeuft jeden Frame, und ohne Merker
// begaenne die Sequenz bei jedem Bild neu.
let xwingLaunch = false;
// X bzw. Shift gedrueckt. Beim X-WING am Boden beginnt damit die Startsequenz: erst senkrecht auf die
// Schwebehoehe (Schub auf VTOL_HOVER, der VTOL-Block regelt das Steigen), und sobald die erreicht ist,
// Vollgas vorwaerts. Jedes andere Modell und der fliegende X-Wing bekommen wie bisher direkt 100 %.
function boostDruck(){
  boosting = true;
  const xw = isXWing() && !state.crashed && !state.ejected && !state.falling;
  if(xw && (state.onGround || xwingLaunch)){
    // In der Sequenz: solange er noch unter der Schwebehoehe ist, Schwebestufe halten. VTOL_HOVER
    // laesst ihn mit VTOL_CLIMB steigen und riegelt bei VTOL_HOVER_ALT ab — dieselbe Regelung, die
    // auch beim Aussteigen aus dem Hangar greift.
    xwingLaunch = true;
    const grund = (locale === 'earth')
      ? (isOnCarrier(state.pos.x, state.pos.z) ? fordDeckY
        : (isOnLand(state.pos.x, state.pos.z) ? ISLAND_Y : 0))
      : surfaceY(state.pos.x, state.pos.z);
    // Etwas unter der Sollhoehe umschalten (80 %): die Steigrate wird angeregelt und laeuft die
    // letzten Meter langsam aus — wer auf die volle Hoehe wartet, wartet lange.
    if(state.pos.y - grund >= VTOL_HOVER_ALT*0.8){ xwingLaunch = false; state.throttle = 1; }
    else state.throttle = VTOL_HOVER;
    return;
  }
  state.throttle = 1;
}
function edge(gp, i){ const now = gp.buttons[i] && gp.buttons[i].pressed;
  const was = btnPrev[i]; btnPrev[i]=now; return now && !was; }

// Schub-Auto-Repeat: solange gehalten, alle THR_REPEAT_MS eine 20%-Stufe.
// Erster Schritt sofort, danach im Intervall. Richtungswechsel wirkt sofort.
const THR_REPEAT_MS = 350;
let thrHoldDir = 0, thrLastStep = -1e9;
function thrHold(dir){
  const t = performance.now();
  if(dir === 0){ thrHoldDir = 0; return; }
  if(dir !== thrHoldDir){ thrHoldDir = dir; thrLastStep = -1e9; }  // sofort bei Neu-/Richtungswechsel
  if(t - thrLastStep >= THR_REPEAT_MS){ thrStep(dir); thrLastStep = t; }
}

function readInput() {
  let pitch=0, roll=0, yaw=0, thrDir=0;

  // ---- Tastatur ----
  if(keys['ArrowUp'])    pitch-=1;
  if(keys['ArrowDown'])  pitch+=1;
  if(keys['ArrowLeft'])  yaw-=1;    // Pfeile ←→ = lenken (Querruder)
  if(keys['ArrowRight']) yaw+=1;
  if(keys['KeyQ'])       roll-=1;   // Q/E rollen (Tastatur-Ersatz für LT/RT)
  if(keys['KeyE'])       roll+=1;
  if(keys['KeyW'])       thrDir = +1;   // W/S = Schub hoch/runter (Auto-Repeat, s.u.)
  else if(keys['KeyS'])  thrDir = -1;
  if(keys['Space'])      state.throttle = 1;
  // Umsehen beim Astronauten: I/J/K/L als Tastatur-Pendant zum rechten Stick (die Pfeiltasten sind
  // fürs Laufen belegt). Nur draußen wirksam.
  // Auch im Rover kein freies Umsehen: dort lenkt der linke Stick und der rechte gibt Schub,
  // genau wie im Schlauchboot.
  // Am Jetpack gilt die Fahrzeug-Belegung wie im Rover und im Boot: der Schub ist das Gas.
  if(eva && !eva.boat && !eva.rover && !eva.jet){
    lookX = (keys['KeyL'] ? 1 : 0) - (keys['KeyJ'] ? 1 : 0);
    lookY = (keys['KeyI'] ? 1 : 0) - (keys['KeyK'] ? 1 : 0);   // I hebt, K senkt
  }
  // C HALTEN = Umkehrschub -20 % (Bremse), Tastatur-Pendant zu "A halten" am Controller.
  if(keys['KeyC']) state.throttle = -0.2; else if(cPrev) state.throttle = 0;
  cPrev = !!keys['KeyC'];
  // SHIFT HALTEN = BOOST (Tastatur-Pendant zu X): sofort 100 %, losgelassen -> 50 %.
  const kbBoost = !!(keys['ShiftLeft'] || keys['ShiftRight']);
  if(kbBoost){ boostDruck(); }
  else { if(!(gamepadIndex!==null)) boosting = false; if(kbBoostPrev){ state.throttle = 0.5; xwingLaunch = false; } }
  kbBoostPrev = kbBoost;

  // ---- Gamepad ----
  if(gamepadIndex!==null){
    const gp = navigator.getGamepads()[gamepadIndex];
    if(gp){
      const lx=deadzone(gp.axes[0]||0), ly=deadzone(gp.axes[1]||0);
      // linker Stick: ←→ = Querruder/Lenken, ↕ = Nase (Höhenruder)
      yaw   += lx;
      pitch += ly;
      // NUR LT/RT rollen: RT nach rechts, LT nach links
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
      roll += (rt - lt);
      // Rechter Stick: im Fahrzeug steuert er vertikal den Schub (in 10%-Stufen, nur bis 0),
      // horizontal ist er unbelegt. Beim Astronauten ZU FUSS ist der Motor aus — dort ist der GANZE
      // Stick frei und schwenkt die Kamera (siehe evaLook / updateCamera).
      // Im SCHLAUCHBOOT gilt wieder die Fahrzeug-Belegung: Schub rechts, lenken links — genau wie
      // beim Feuerwehrboot. Es ist ja auch ein Boot, und zwei verschiedene Boots-Steuerungen zu
      // lernen waere fuer ein Kind eine unnoetige Huerde.
      const rx = deadzone(gp.axes[2] || 0), ry2 = gp.axes[3] || 0;
      if(eva && !eva.boat && !eva.rover && !eva.jet){
        lookX = rx;
        // Vorzeichen umgedreht: der Stick liefert für "oben" einen negativen Wert (wie der linke).
        // Ohne das senkte "Stick nach oben" die Kamera, statt sie zu heben.
        lookY = -deadzone(ry2);
      } else {
        lookX = 0; lookY = 0;
        if(ry2 < -0.5) thrDir = +1; else if(ry2 > 0.5) thrDir = -1;
      }

      // A HALTEN = Umkehrschub -20 % (Bremse); beim LOSLASSEN -> Motor 0.
      const aDown = gp.buttons[0] && gp.buttons[0].pressed;
      if(aDown) state.throttle = -0.2;
      else if(aPrev) state.throttle = 0;   // A gerade losgelassen -> Motor aus
      aPrev = aDown;

      // X HALTEN = BOOST: sofort 100 % Schub + extra Beschleunigung; beim LOSLASSEN -> 50 % Schub.
      const xDown = gp.buttons[2] && gp.buttons[2].pressed;
      if(xDown){ boostDruck(); }
      else { boosting = false; if(xPrev){ state.throttle = 0.5; xwingLaunch = false; } }
      xPrev = xDown;

      // Y = EIN- UND AUSSTEIGEN, B = nur noch Aktionen, Modellwechsel auf D-Pad rechts.
      // Vorher lag der Modellwechsel auf Y und das Ein-/Aussteigen mit auf B — wer neben seinem
      // Flieger loeschen wollte, stieg stattdessen ein. Jetzt hat jede Taste eine Aufgabe.
      if(edge(gp,3)) buttonY();       // Y = ein-/aussteigen, umsteigen
      if(edge(gp,1)) buttonB();       // B = Aktion: Wasser, Loeschen, Schleudersitz, Kisten, huepfen

      if(edge(gp,9)) resetPlane();    // Start/Menu = Reset
      // D-Pad: oben(12)=Hilfe, unten(13)=Ton an/aus. Links/rechts sind frei — die Seitenansicht
      // liegt jetzt auf den Schultertasten (getauscht), und Verkehr/Aufgaben brauchen keine
      // Schalter mehr.
      if(edge(gp,12)) toggleHelp();
      if(edge(gp,13)) toggleSound();  // D-Pad unten = Ton an/aus
      // D-Pad RECHTS = Modellwechsel (war frei, und Y brauchte den Platz fuers Ein-/Aussteigen).
      if(edge(gp,15)) cycleModel();
      // LB(4)/RB(5) GEHALTEN = Ansicht von links/rechts (vorher D-Pad links/rechts).
      const vLeft  = gp.buttons[4] && gp.buttons[4].pressed;
      const vRight = gp.buttons[5] && gp.buttons[5].pressed;
      sideView = vLeft ? -1 : (vRight ? 1 : 0);
    }
  } else {
    sideView = 0;   // ohne Controller keine Seitenansicht
  }
  thrHold(thrDir);   // Auto-Repeat auswerten
  roll = Math.max(-1, Math.min(1, roll));
  return { pitch, roll, yaw };
}

// ---------- Ansichten ----------
let viewMode=0;
let sideView=0;   // 0=normal, -1=von links, +1=von rechts (D-Pad links/rechts gehalten)
const viewConfigs=[{dist:24,height:8,lerp:0.06},{dist:14,height:5,lerp:0.10},{dist:6,height:3,lerp:0.18}];
function cycleView(){ viewMode=(viewMode+1)%viewConfigs.length; }
// Kamera-Abstandsfaktor pro Modell (große/nahe Modelle brauchen mehr Abstand)
// Kamera pro Modell: dist=Abstand-Faktor, hgt=Höhen-Faktor (kleiner = flacher/mehr von hinten)
const CAM_CFG = {
  Airbus:   { dist: 1.8,  hgt: 1.4 },
  Canadair: { dist: 1.3,  hgt: 1.1 },
  Transall: { dist: 1.7,  hgt: 1.2 },    // großer Transporter
  XWing:    { dist: 1.2,  hgt: 1.0 },    // X-Wing: kompakt, minimal mehr Abstand als der Jet
  // Boot: deutlich weiter weg und höher als bei den Fliegern. Aus der Flieger-Perspektive (34 m
  // hinter, 5,6 m über dem Ziel) sah man vom 16 m langen Boot fast nur den Aufbau und nichts von
  // der Fahrtrichtung. Mit diesen Faktoren sind es rund 55 m Abstand und 14 m Höhe — Blickwinkel
  // etwa 15° von oben, man sieht Wellen, Kurs und das Ufer voraus.
  Boat:     { dist: 2.3,  hgt: 1.75 },
  // U-Boot: 95 m lang, also viermal so lang wie das Feuerwehrboot — es braucht Abstand, sonst
  // füllt der Turm das Bild. Aber FLACHER (hgt 0,9): unter Wasser will man nach VORNE sehen, wohin
  // man fährt, nicht von oben auf das eigene Deck. Von schräg oben sähe man beim Tauchen nur Rumpf.
  // U-Boot: 95 m lang, viermal so lang wie das Feuerwehrboot — es braucht Abstand, sonst sitzt die
  // Kamera IM Rumpf. Genau das war der Fehler eines Versuchs, sie unter Wasser heranzuholen: bei
  // 26,2 m Abstand und 47 m halber Rumpflaenge stand sie 20,6 m innerhalb des Bootes ("die kamera
  // folgt ins innere des uboots"). 2,6 ergibt 62,4 m, also 15,4 m hinter dem Heck.
  //
  // hgt von 0,9 auf 1,5: 0,9 war fuer "nach vorne sehen statt aufs eigene Deck" gedacht, ergab
  // aber nur 7,2 m Hoehe ueber einem 13 m dicken Rumpf — man sah ihn von der SEITE, und beim
  // Tauchen schob sich das Heck ins Bild. 12 m gibt den Blick schraeg von hinten oben: Turm, Deck
  // und der Weg voraus sind zusammen zu sehen.
  //
  // dist von 2,6 auf 3,2 (62,4 -> 76,8 m): auf Wunsch weiter weg. Damit liegen 29,8 m zwischen
  // Kamera und Heck statt 15,4 m, das Boot steht also ganz im Bild statt es zu fuellen. Der Bug
  // ist dann 123,8 m entfernt, knapp mehr als die Sichtweite am Grund (135 m deckt ihn, in der
  // Tiefe verliert er sich leicht im Blau — das gehoert dazu).
  Sub:      { dist: 3.2,  hgt: 1.5 },
};
function camCfg(){ return CAM_CFG[MODEL_NAMES[currentModel]] || { dist:1, hgt:1 }; }

// ---------- großer Text (Start/Landung) ----------
const bigEl = document.getElementById('big');
let bigTimer=0;
function showBig(t){ bigEl.textContent=t; bigEl.style.opacity = t?1:0; if(t) bigTimer=2.0; }

// Schub in 10%-Stufen (rechter Stick nur 0..100 %). Umkehrschub (-20 %) liegt jetzt auf A (gehalten).
function thrStep(dir){
  let p = Math.round(state.throttle*10);     // Stufen 0..10 = 0,...,100 %
  p = Math.max(0, Math.min(10, p + dir));
  state.throttle = p/10;
}

// ---------- Physik ----------
// ---------- Feuerwehrboot: Fahrt auf dem Meer ----------
// Bewusst KEINE Flugphysik: kein Auftrieb, kein Strömungsabriss, keine Höhe. Das Boot liegt immer
// auf der Wasseroberfläche (waveY) und lenkt mit dem linken Stick bzw. den Pfeiltasten. Der Schub
// arbeitet wie bei den Fliegern als Ziel-Geschwindigkeit, damit die Bedienung dieselbe bleibt
// (Umkehrschub auf A/C fährt also rückwärts — bei einem Boot ist das richtig so).
// Land ist eine Wand: es rammt nicht und sinkt nicht, es kommt einfach nicht weiter.
const BOAT_YAW = 0.9;        // Wendigkeit am Ruder (rad/s bei voller Fahrt)
// So weit VOR dem Mittelpunkt wird auf Hindernisse geprueft — der halbe Rumpf, denn dort ist der Bug.
// Ohne das prueft ein 16-m-Boot nur seinen MITTELPUNKT: der Bug steckte gemessen 17,9 m im Rumpf
// eines Containerschiffs, bevor ueberhaupt etwas ansprach, und wurde dann seitlich hinausgedrueckt.
// Genau das sah aus wie "ich dringe ein und werde rausgeschoben, ich pralle nicht ab". Mit 8 m
// Vorausschau bleiben davon 1,0 m (C:/tmp/diag_boot4.js). Das Schlauchboot macht das ueber
// DINGHY_LAND_R schon lange; dem laengeren Boot fehlte es.
const BOAT_LOOK = 8;         // m Vorausschau (halbe Bootslaenge)
const BOAT_HALF_W = 2.2;     // halbe Bootsbreite (Modell: 4,35 m, ausgemessen)
// Darf das Boot an diese Stelle? Die Frage hat ZWEI Teile, und die muessen getrennt beantwortet
// werden — genau das war der Fehler, als beide zusammengefasst waren:
//
// SCHIFFE: der GANZE Umriss muss frei sein. Ein einzelner Punkt vor dem Bug genuegt nicht — gemessen
//   haben 5,4 % aller Lagen die Bootsmitte im Rumpf, waehrend dieser Punkt schon wieder im Freien
//   liegt (Nase quer zur Bordwand hinaus, oder ueber die Bugspitze hinweg). Die Sperre gab die Fahrt
//   dann frei, mitten im Stahl. Geprueft werden Bug, Mitte und Heck, je auf der Mittellinie und an
//   beiden Seiten.
//
// LAND UND STRAND: nur der BUG. Am Ufer soll man anlegen und wieder wegkommen — ein Boot liegt dort
//   nun einmal mit dem Heck im Sand. Mit der Umrisspruefung war bis 8 m vom Strandrand KEINE von 24
//   Richtungen frei: das Boot stand bewegungslos und kam nicht mehr los (C:/tmp/strand.js). Fuer den
//   Bug allein hat es dort noch nie ein Problem gegeben — man steigt ja aus.
function boatWaterFree(cx, cz, fx, fz){
  // Land/Strand/Traeger: nur der Bug (siehe oben).
  if(!isOpenWater(cx + fx*BOAT_LOOK, cz + fz*BOAT_LOOK)) return false;
  // Schiffe: der ganze Umriss. hitsSeaShip statt isOpenWater, damit hier WIRKLICH nur die Schiffe
  // zaehlen und nicht wieder der Strand mit hineingeraet.
  if(typeof seaShips === 'undefined' || !seaShips.length) return true;
  const sx = -fz, sz = fx;                                  // quer zur Fahrtrichtung
  for(let i = -1; i <= 1; i++){                             // Heck, Mitte, Bug
    const lx = cx + fx*BOAT_LOOK*i, lz = cz + fz*BOAT_LOOK*i;
    for(let j = -1; j <= 1; j++){                           // backbord, Mitte, steuerbord
      if(hitsSeaShip(lx + sx*BOAT_HALF_W*j, ISLAND_Y + 2, lz + sz*BOAT_HALF_W*j)) return false;
    }
  }
  return true;
}
const BOAT_ROLL = 0.25;      // wie stark es sich in die Kurve legt (rein optisch)
// Wie stark das Boot mit der Dünung nickt. Angehoben (0,5 -> 1,0): bei den größeren Wellen soll man
// dem 16-m-Boot ansehen, dass es arbeitet. Die Neigung, die es dabei erfährt, kommt aus der
// Wellensteilheit über SEINE Länge — ein kurzes Boot folgt der Welle, ein langes Schiff überbrückt
// sie. Deshalb wackeln die Boote und die 250-m-Schiffe bleiben ruhig, ohne dass man das eigens
// einbauen muss (gemessen: 3,2 Grad beim Boot gegen 0,5 Grad beim Kreuzfahrtschiff).
const BOAT_BOB = 1.0;
// Tiefgang: um so viel liegt der Kiel UNTER der Wasserlinie.
// Alle Werte am GEBAUTEN Objekt nachgemessen (makeFireBoat), nicht geschätzt — der frühere
// Kommentar hier war falsch und hat zwei Korrekturen in die falsche Richtung verursacht:
//   Deck bei y = 3,00 (die dichteste Punktebene des Modells, 70.401 Punkte) — nicht 2,70.
//   Antrieb bis y = 0,55 hinunter — nicht 1,31. Die Schrauben brauchen also viel weniger Tiefe.
// Nötige Reserve nach oben: 0,45 m, weil das GERENDERTE Wasser im Wellental bis 0,45 m höher liegt
// als der Wert, mit dem das Boot rechnet (das Meeresgitter interpoliert linear zwischen Punkten,
// die 62,5 m auseinander liegen — das Boot ist nur 16 m lang), plus 0,44 m Nicken = 0,89 m.
// Mit 2,0 blieben davon 0,11 m: das Boot stand sichtbar voll Wasser, vom Rumpf war nichts mehr zu
// sehen. 1,1 m versenkt den Antrieb 0,55 m und lässt 1,90 m Freibord, davon 1,01 m nach Reserve.
const BOAT_DRAFT = 1.1;
// An der Küste ABGLEITEN statt anzuhalten: von der Fahrtrichtung aus schrittweise zur Seite drehen
// (abwechselnd links/rechts), bis ein Schritt im Wasser landet, und die Fahrt dorthin umlenken. So
// gleitet ein Boot an jedem Ufer ab, in jedem Anfahrtwinkel. Beide Boote nutzen das.
//
// Drei Fallen, die hier vorher zugeschlagen haben — alle ausgemessen:
//  1. Erst X und Z EINZELN zu probieren half nicht: bei senkrechter Anfahrt ist die eine
//     Komponente ohnehin null, und die Zweige setzten dabei die Fahrt auf null.
//  2. Nur ±90° zu prüfen genügt nicht — bei senkrechter Anfahrt auf eine runde Küste liegt auch
//     der Querschritt noch in der Sperrzone.
//  3. Die Schrittweite darf NICHT allein an der Fahrt hängen. War die Fahrt erst genullt, war
//     der Schritt (spd*dt) null, das Ausweichen konnte nichts verschieben, die Fahrt baute sich
//     auf und wurde erneut genullt: eine Endlosschleife. Gemessen 561 Frames bewegungslos,
//     obwohl 13 von 24 Richtungen frei waren. Daher eine Mindestschrittweite und die
//     Nasenrichtung als Rückfall, wenn das Boot steht.
// pos/vel werden IN PLACE verändert; fwd ist die Nasenrichtung (Rückfall, wenn das Boot steht).
// look ist die Vorausschau (halbe Rumpflaenge). Sie wird in ZWEI Durchgaengen benutzt, und das ist
// wichtig:
//   Durchgang 1 peilt look voraus — so landet das Boot nicht in einer Lage, in der sein Mittelpunkt
//     frei ist, aber der BUG im Rumpf steckt (ohne das blieben 6,7 m Eindringung).
//   Durchgang 2 peilt nur den naechsten Schritt. Denn mit der Vorausschau ALLEIN wird das Ausweichen
//     blind, sobald man frontal vor einem langen Rumpf steht: gemessen waren dort von 12 Richtungen
//     nur noch 4 frei statt 8 (C:/tmp/sack.js). Das Boot fand keinen Ausweg, blieb stehen — und das
//     Containerschiff fuhr darueber hinweg. So faehrt man "von vorne durch das ganze Schiff",
//     waehrend es quer einwandfrei sperrt.
// Lieber knapp am Rumpf entlangschrammen (Durchgang 2) als bewegungslos ueberfahren werden.
function coastSlide(pos, vel, fwd, dt, look){
  const spd0 = Math.hypot(vel.x, vel.z);
  const sp = Math.max(spd0 * dt, 0.05);                  // mind. 5 cm pro Frame -> klemmt nie
  let ux, uz;
  if(spd0 > 1e-6){ ux = vel.x/spd0; uz = vel.z/spd0; }                   // Fahrtrichtung
  else { const fl = Math.hypot(fwd.x, fwd.z) || 1;                       // steht: Nasenrichtung
         ux = fwd.x/fl; uz = fwd.z/fl; }
  // Zwei Durchgaenge: erst streng (Ziellage UND ein Stueck voraus muessen frei sein), dann als
  // Notausgang nur die Ziellage. Ohne den zweiten Durchgang wird das Ausweichen blind, sobald man
  // frontal vor einem langen Rumpf steht (von 12 Richtungen nur noch 4 frei, C:/tmp/sack.js) — dann
  // wird das Boot bewegungslos ueberfahren.
  // WICHTIG ist, dass immer die TATSAECHLICHE Ziellage geprueft wird (pos + d*sp). Vorher wurde nur
  // ein Punkt reach voraus geprueft, im Vorausschau-Durchgang also 8 m weiter, als das Boot sich
  // bewegt. Die Lage, in der es dann wirklich landete, war ungeprueft: gemessen schob coastSlide es
  // so in den Rumpf eines Kreuzfahrtschiffs und dort Frame um Frame weiter, obwohl die
  // Umrisspruefung besetzt meldete (Trace C:/tmp/v8.js).
  for(const weit of (look ? [look, 0] : [0])){
    for(const deg of [20, 40, 60, 80, 100, 120]){
      const a = deg*Math.PI/180, ca = Math.cos(a), sa = Math.sin(a);
      for(const sgn of [1, -1]){
        const dx = ux*ca - uz*sa*sgn, dz = ux*sa*sgn + uz*ca;   // Richtung um ±deg gedreht
        // Die Lage, in der das Boot nach diesem Schritt WIRKLICH liegt:
        const zx = pos.x + dx*sp, zz2 = pos.z + dz*sp;
        if(look ? !boatWaterFree(zx, zz2, dx, dz) : !isOpenWater(zx, zz2)) continue;
        // und, wenn moeglich, auch noch ein Stueck weiter in dieselbe Richtung
        if(weit > 0 && !boatWaterFree(pos.x + dx*(sp+weit), pos.z + dz*(sp+weit), dx, dz)) continue;
        pos.x += dx*sp; pos.z += dz*sp;
        // Fahrt in die freie Richtung umlenken — etwas Tempo geht verloren, wie beim Schrammen an
        // einer Mole, aber es gleitet weiter statt jeden Frame neu anzustoßen.
        const keep = Math.max(spd0*0.85, 2);
        vel.x = dx*keep; vel.z = dz*keep;
        return true;
      }
    }
  }
  // Selbst 120° Abweichung blockiert (echte Sackgasse, etwa eine enge Bucht): Fahrt abbauen, aber
  // nicht ganz — die Schraube gibt weiter Ruderdruck (siehe authority), man dreht also heraus.
  vel.x *= 0.3; vel.z *= 0.3;
  return false;
}
function stepBoat(dt, inp){
  const eB = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  // Ruderwirkung hängt an der Fahrt — aber nicht nur: eine laufende Schraube drückt auch im Stand
  // Wasser aufs Ruder, ein Boot dreht sich also auf der Stelle, wenn man Gas gibt. Ohne diesen
  // Anteil kam man aus einer Bucht nicht mehr heraus: dort ist die Fahrt null, und mit ihr wäre
  // auch das Ruder fast wirkungslos gewesen.
  const spd = Math.hypot(state.vel.x, state.vel.z);
  const thrHelp = Math.abs(state.throttle) * 0.5;              // Schraubenstrahl aufs Ruder
  const authority = Math.min(1, 0.25 + thrHelp + spd / spec.vMax);
  let yaw = eB.y - inp.yaw * BOAT_YAW * authority * dt;
  // Krängung: legt sich in die Kurve und richtet sich von allein wieder auf (rein optisch).
  let roll = eB.z + (-inp.yaw * BOAT_ROLL * authority - eB.z) * Math.min(1, 3*dt);
  // Nicken aus der Dünung: die Welle vor dem Bug gegen die hinter dem Heck.
  const fwdB = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  // Gerechnet wird relativ zur Gittermitte (= Flieger), nicht in Weltkoordinaten — siehe
  // seaSurfaceY. Bug und Heck liegen 8 m vor und hinter der Mitte.
  const bowY  = seaSurfaceY(fwdB.x*8, fwdB.z*8, dt);
  const sternY= seaSurfaceY(-fwdB.x*8, -fwdB.z*8, dt);
  const pitchT = Math.atan2(bowY - sternY, 16) * BOAT_BOB;
  const pitch = eB.x + (pitchT - eB.x) * Math.min(1, 2.5*dt);
  state.quat.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));

  // Fahrt: Schub = Zielgeschwindigkeit, sanft angeregelt (wie bei den Fliegern).
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const targetV = spec.vMax * state.throttle;              // negativ = rückwärts (Umkehrschub)
  const fwdSpeed = state.vel.x*fwd.x + state.vel.z*fwd.z;
  const dv = targetV - fwdSpeed;
  const push = Math.sign(dv) * Math.min(Math.abs(dv)/Math.max(dt,1e-4), spec.accel);
  state.vel.x += fwd.x * push * dt;
  state.vel.z += fwd.z * push * dt;
  // Wasserwiderstand: quer zur Fahrtrichtung bremst es stark ab -> es rutscht nicht seitlich weg.
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const sideSpd = state.vel.x*side.x + state.vel.z*side.z;
  const damp = 1 - Math.min(1, 4*dt);
  state.vel.x -= side.x * sideSpd * (1-damp);
  state.vel.z -= side.z * sideSpd * (1-damp);
  state.vel.y = 0;

  // Bewegen — aber nur, solange das Ziel Wasser ist. Land, Hafen und Trägerrumpf halten es auf.
  // "Wasser" heißt fürs Boot: kein Land, kein Trägerdeck, kein Bauwerk — UND nicht der Strand.
  // isOnLand fragt nur die Grasfläche (info.radius) ab, der Sandrand reicht aber bis radius*1.12
  // (siehe buildIsland). Ohne isOnBeach fuhr das Boot gut 30 m weit über den Strand, was aussah,
  // als führe es an Land.
  const nx = state.pos.x + state.vel.x*dt, nz = state.pos.z + state.vel.z*dt;
  // Geprueft wird der GANZE Rumpf (Bug, Mitte, Heck, beide Seiten) — siehe boatWaterFree. Ein
  // einzelner Punkt vor dem Bug liess das Boot aus 5,4 % aller Lagen mitten durch den Stahl fahren.
  if(boatWaterFree(nx, nz, fwd.x, fwd.z)){ state.pos.x = nx; state.pos.z = nz; }
  else {
    // Blockiert -> an der Kueste abgleiten (dieselbe Logik nutzt das Schlauchboot, siehe coastSlide).
    coastSlide(state.pos, state.vel, fwd, dt, BOAT_LOOK);
  }
  // Steckt es (doch) in einem Schiffsrumpf, quer hinausschieben. Das kann passieren, obwohl die
  // Fahrt geprueft wird: die Schiffe FAHREN, ein Rumpf kann sich also ueber ein stillliegendes Boot
  // schieben. coastSlide hilft dort nicht (es sucht nur nach vorne) — siehe pushOutOfSeaShip.
  pushOutOfSeaShip(state.pos, state.vel, dt);

  // Auf der Wasseroberfläche liegen, aber mit TIEFGANG: vorher sass der Kiel genau auf der
  // Wasserlinie, also schwamm das ganze Boot obenauf und man sah hinten die Schrauben (die liegen
  // im Modell bei 0,14–1,31 m). BOAT_DRAFT senkt es so weit ein, dass die Schraubenebene unter
  // Wasser verschwindet und der Rumpf im Wasser liegt statt darauf.
  // Bezug ist die Gittermitte (siehe seaSurfaceY), nicht die Weltposition, und dt trifft den
  // Wellenstand, den updateSea gleich danach ins Gitter schreibt.
  state.pos.y = seaSurfaceY(0, 0, dt) - BOAT_DRAFT;
  state.onGround = true;      // fürs HUD/Sound: das Boot ist per Definition „am Boden"
  state.stalling = false;
  planeGroup.position.copy(state.pos);
  planeGroup.quaternion.copy(state.quat);
  // (bigTimer wird im Loop abgebaut — siehe dort, damit es auch während der EVA läuft.)
}

// ---------- U-BOOT: fahren und tauchen -----------------------------------------------------
// Gebaut nach stepBoat, um eine TIEFENACHSE erweitert. Der Unterschied zu allem anderen im Spiel:
// hier ist y frei steuerbar und zwischen zwei Grenzen eingespannt, die BEIDE wandern — oben die
// Duenung, unten der Meeresboden.
//
// STEUERUNG (so gewuenscht: "Nase steuert die Tiefe"): Pfeil hoch/runter bzw. linker Stick legt die
// Nase an, und die FAHRT traegt es dann hinunter oder hinauf — wie ein Flugzeug, nur im Wasser.
// Steht es still, bringt die schoenste Nasenlage nichts: ohne Fahrt kein Anstroemen der
// Tiefenruder. Das ist physikalisch richtig und spielt sich gut, weil man dadurch von selbst Gas
// gibt, statt sich senkrecht auf den Grund zu setzen.
//
// Eine Eigenheit noch, die man im Spiel sofort merkt: das Boot taucht NICHT von allein wieder auf.
// Es haelt die Tiefe, die man ihm gegeben hat, so wie ein austariertes U-Boot es tut. Ohne das
// muesste man dauernd gegen einen Auftrieb ansteuern — fuer ein Kind anstrengend statt schoen.
const SUB_YAW      = 0.55;   // rad/s Ruderwirkung bei voller Fahrt (traeger als das Boot: 0,9)
const SUB_ROLL     = 0.18;   // wie stark es sich in die Kurve legt (rein optisch)
// rad (~10 Grad): so steil legt es die Nase hoechstens an. Von 0,52 (30 Grad) heruntergesetzt —
// gewuenscht war ein Boot, das beim Tauchen waagerecht bleibt. Ganz ohne Neigung geht es nicht, denn
// die Nasenlage IST die Tiefensteuerung (vy = fwdSpeed * sin(pitch), siehe stepSub); bei 0 Grad
// wuerde das Boot die Tiefe nie aendern. 10 Grad sieht man kaum und steuert sich ruhig.
// Die Sinkrate bleibt dieselbe, weil SUB_DIVE_EFF entsprechend steigt (siehe dort).
const SUB_PMAX     = 0.17;
const SUB_LOOK     = 47;     // m Vorausschau = halbe Rumpflaenge (95 m), wie BOAT_LOOK beim Boot
const SUB_HALF_W   = 12;     // m halbe Breite fuer die Umrisspruefung (Druckkoerper 23,2 m)
// Wie weit vor dem Bug nach Ufer gesucht wird, wenn man mit Y aussteigen will (siehe buttonY).
// 130 m: halbe Rumpflaenge (47) plus der Abstand, den das Boot vor dem Strand haelt. Beim Liegeplatz
// der Startinsel sind es gemessen 85 m bis zur Sandkante, auf grossen Inseln etwas mehr.
const SUB_UFER_R   = 130;
// Aufgetaucht liegt das Modell auf y = 0: shipTemplates['sub'] ist auf seine Wasserlinie normiert
// (preloadSeaShips, wl 0,1537). 0 heisst hier also "aufgetaucht wie das KI-Boot".
const SUB_SURF_Y   = 0;
// Wie weit ueber dem Meeresboden es spaetestens aufhoert. Der Rumpf ist 13 m dick und der Ursprung
// liegt auf der Wasserlinie, also 3 m ueber der Rumpfmitte — 12 m lassen den Kiel frei.
const SUB_FLOOR_CLR = 12;
// Sinkrate = Fahrt * sin(Nickwinkel) * dieser Faktor. Von 0,75 auf 2,16 erhoeht, weil die maximale
// Nasenlage von 30 auf 10 Grad gesunken ist (SUB_PMAX) — nachgerechnet gibt das exakt dieselbe
// Rate wie vorher: sin(30 Grad)*0,75 = 0,375 und sin(10 Grad)*2,16 = 0,375.
// Der Faktor ist damit groesser als 1, das Boot sinkt also STEILER als seine Nase zeigt. Physikalisch
// ist das falsch, hier aber genau gewollt: ein U-Boot mit Tiefenrudern UND Tauchzellen sinkt auch
// waagerecht, und ein Kind soll die Tiefe steuern, ohne dass sich das Bild kippt.
const SUB_DIVE_EFF = 2.16;
// Wie schnell die Nase in die Waagerechte zurueckgeht, wenn man nichts drueckt. Nicht null: sonst
// bliebe sie steil stehen und das Boot tauchte bis zum Grund weiter, obwohl man nur angetippt hat.
const SUB_PITCH_BACK = 1.4;
function stepSub(dt, inp){
  const eB = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  const spd = Math.hypot(state.vel.x, state.vel.z);
  // Ruderwirkung wie beim Boot: die Schraube drueckt auch im Stand Wasser aufs Ruder.
  const thrHelp = Math.abs(state.throttle) * 0.5;
  const authority = Math.min(1, 0.25 + thrHelp + spd / spec.vMax);
  const yaw = eB.y - inp.yaw * SUB_YAW * authority * dt;
  const roll = eB.z + (-inp.yaw * SUB_ROLL * authority - eB.z) * Math.min(1, 3*dt);
  // NASENLAGE. inp.pitch ist +1 bei Pfeil runter und -1 bei Pfeil hoch (siehe readInput) —
  // dieselbe Belegung wie im Flieger, wo hoch die Nase senkt. Hier heisst das ABTAUCHEN, und das
  // passt zusammen: Nase runter = tiefer. inp.pitch greift also mit demselben Vorzeichen an.
  let pitch = eB.x;
  if(Math.abs(inp.pitch) > 0.01){
    pitch += inp.pitch * spec.pitch * dt;
  } else {
    // Nichts gedrueckt: Nase glatt ziehen. Die TIEFE bleibt trotzdem stehen (die Rechnung unten
    // setzt y nur weiter, solange die Nase liegt) — es richtet sich waagerecht aus, statt zu sinken.
    pitch += (0 - pitch) * Math.min(1, SUB_PITCH_BACK*dt);
  }
  pitch = Math.max(-SUB_PMAX, Math.min(SUB_PMAX, pitch));
  state.quat.setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));

  // Fahrt, genau wie beim Boot: Schub setzt die Zielgeschwindigkeit, sanft angeregelt.
  // Gerechnet wird mit der WAAGERECHTEN Nasenrichtung — die Tiefe kommt getrennt aus der
  // Nasenlage. Nimmt man den vollen Vorwaertsvektor, verliert man beim Tauchen an Fahrt, und das
  // Boot bliebe in steiler Lage fast stehen.
  const fwd3 = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const fl = Math.hypot(fwd3.x, fwd3.z) || 1;
  const fwd = new THREE.Vector3(fwd3.x/fl, 0, fwd3.z/fl);
  const targetV = spec.vMax * state.throttle;
  const fwdSpeed = state.vel.x*fwd.x + state.vel.z*fwd.z;
  const dv = targetV - fwdSpeed;
  const push = Math.sign(dv) * Math.min(Math.abs(dv)/Math.max(dt,1e-4), spec.accel);
  state.vel.x += fwd.x * push * dt;
  state.vel.z += fwd.z * push * dt;
  // Querwiderstand: es rutscht nicht seitlich weg (wie bei beiden Booten).
  const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const sideSpd = state.vel.x*side.x + state.vel.z*side.z;
  const damp = 1 - Math.min(1, 4*dt);
  state.vel.x -= side.x * sideSpd * (1-damp);
  state.vel.z -= side.z * sideSpd * (1-damp);
  state.vel.y = 0;                      // die Tiefe wird gesetzt, nicht integriert (siehe unten)

  // Waagerecht bewegen. GETAUCHT gelten andere Hindernisse als an der Oberflaeche, und das ist der
  // interessante Teil: eine Insel ist unter Wasser kein Land mehr, sondern ein Hang, der zum
  // Strand hinauffuehrt — dagegen schuetzt schon die Bodenfreiheit weiter unten. Was weiterhin
  // sperrt, sind die SCHIFFSRUEMPFE: die haengen im Wasser, und durch einen 300-m-Frachter faehrt
  // man nicht hindurch.
  const nx = state.pos.x + state.vel.x*dt, nz = state.pos.z + state.vel.z*dt;
  const tief = state.pos.y < -6;        // sicher unter der Duenung und unter dem Kiel der Schiffe
  const frei = tief ? !subHullBlocked(nx, nz, fwd.x, fwd.z)
                    : boatWaterFree(nx, nz, fwd.x, fwd.z);
  if(frei){ state.pos.x = nx; state.pos.z = nz; }
  else coastSlide(state.pos, state.vel, fwd, dt, SUB_LOOK);
  if(!tief) pushOutOfSeaShip(state.pos, state.vel, dt);

  // ---- TIEFE. Zwei Grenzen, die beide wandern:
  //   oben  die sichtbare Wasseroberflaeche an dieser Stelle (seaSurfaceY — das U-Boot IST der
  //         Flieger, sitzt also in der Gittermitte, siehe dort),
  //   unten der Meeresboden (seabedY) plus Bodenfreiheit.
  // Dazwischen traegt die Fahrt es entlang der Nasenlage.
  const surf = seaSurfaceY(0, 0, dt) + SUB_SURF_Y;
  // BODENGRENZE fuer die TIEFSTE STELLE DES BOOTES, nicht fuer den Schwerpunkt. Der Rumpf ist 95 m
  // lang, bei Nicklage haengt ein Ende also weit unter der Mitte: 12,2 m bei 15 Grad, 23,5 m bei
  // den 30 Grad, die SUB_PMAX erlaubt. Mit 12 m Bodenfreiheit unter der MITTE steckte die Nase ab
  // 15 Grad im Grund — gemeldet als "ich kann in den boden eintauchen".
  //
  // Gemessen wird an drei Stellen laengs (Bug, Mitte, Heck) und die STRENGSTE Grenze gewinnt. Der
  // Grund muss dort abgefragt werden, wo das Ende wirklich steht: 47 m weiter vorne kann der Boden
  // schon angestiegen sein, und genau in einen solchen Hang faehrt man beim Abtauchen hinein.
  const fSub = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  let grund = -1e9;
  for(const d of [-SUB_LOOK, 0, SUB_LOOK]){
    const gx = state.pos.x + fSub.x*d, gz = state.pos.z + fSub.z*d;
    // Wie tief haengt dieses Ende unter der Bootsmitte? fSub.y ist der Sinus der Nicklage.
    const tiefer = -fSub.y * d;      // bei Nase unten (fSub.y<0) und d>0 (Bug) positiv
    const g = seabedY(gx, gz) + SUB_FLOOR_CLR + Math.max(0, tiefer);
    if(g > grund) grund = g;
  }
  // Positiver pitch heisst Nase nach OBEN (Nase auf -Z), also steigt es dann — daher +sin.
  const vy = fwdSpeed * Math.sin(pitch) * SUB_DIVE_EFF;
  state.pos.y += vy * dt;
  // Auftauchen endet an der Oberflaeche: dort liegt es auf seiner Wasserlinie und faehrt wie ein
  // Boot weiter. Nach unten ist der Grund die Grenze — es setzt sich nicht hinein.
  if(state.pos.y > surf) state.pos.y = surf;
  // grund kann UEBER surf liegen (Flachwasser am Strand). Dann gewinnt die Oberflaeche, sonst
  // wuerde das Boot aus dem Wasser gehoben.
  const unten = Math.min(grund, surf);
  if(state.pos.y < unten) state.pos.y = unten;
  // onGround/stalling: fuers HUD und den Sound gilt dasselbe wie beim Boot — es faehrt, es fliegt
  // nicht, einen Stroemungsabriss gibt es hier nicht.
  state.onGround = (state.pos.y >= surf - 0.05);
  state.stalling = false;
  planeGroup.position.copy(state.pos);
  planeGroup.quaternion.copy(state.quat);
}
// Getaucht sperren nur die Schiffsruempfe (siehe stepSub). Aufgebaut wie boatWaterFree, aber OHNE
// isOpenWater: unter Wasser ist eine Insel kein Land, sondern ein Hang.
function subHullBlocked(cx, cz, fx, fz){
  if(typeof seaShips === 'undefined' || !seaShips.length) return false;
  const sx = -fz, sz = fx;
  for(let i = -1; i <= 1; i++){
    const lx = cx + fx*SUB_LOOK*i, lz = cz + fz*SUB_LOOK*i;
    for(let j = -1; j <= 1; j++){
      if(hitsSeaShip(lx + sx*SUB_HALF_W*j, ISLAND_Y + 2, lz + sz*SUB_HALF_W*j)) return true;
    }
  }
  return false;
}
function stepPhysics(dt, inp){
  // Wenn abgestürzt: Feuerwehr löscht, dann Reset (Reset erst wenn Pilot gelandet)
  if(state.crashed){
    state.crashTimer -= dt;
    updateRescue(dt);
    if(state.crashTimer <= 0) resetPlane();
    return;
  }

  state.throttle = Math.max(-0.2, Math.min(1, state.throttle));   // -0.2 = Umkehrschub (Bremse)

  // Nach Schleudersitz: Flieger ist führerlos -> keine Steuerung, stürzt schnell ab.
  if(state.ejected){
    state.quat.multiply(new THREE.Quaternion().setFromEuler(
      new THREE.Euler(1.0*dt, 1.4*dt, 2.2*dt, 'XYZ')));   // schnelles Trudeln
    state.quat.normalize();
    // rascher Sturz: Nase runter + starke Schwerkraft, wenig Bremsung
    state.vel.y -= 26 * dt;
    state.pos.addScaledVector(state.vel, dt);
    const wreckY = surfaceY(state.pos.x, state.pos.z);
    if(state.pos.y <= wreckY){
      // Aufschlag -> Feuerwehr (3 s), Fallschirm schwebt im Hintergrund weiter
      state.pos.y = wreckY;
      state.crashed = true; state.crashTimer = 3.0;
      state.ejected = false;
      playCrash();
      const wreckE = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
      state.quat.setFromEuler(new THREE.Euler(0.15, wreckE.y, 0.4, 'YXZ'));
      planeGroup.position.copy(state.pos);
      planeGroup.quaternion.copy(state.quat);
      crashRescue(state.pos.x, state.pos.z, isOnLand(state.pos.x, state.pos.z));
      return;
    }
    planeGroup.position.copy(state.pos);
    planeGroup.quaternion.copy(state.quat);
    return;
  }

  // Das Boot fährt, es fliegt nicht: eigener Zweig, der die komplette Flugphysik überspringt.
  if(spec.boat){ stepBoat(dt, inp); return; }
  // Das U-Boot fährt und taucht: eigener Zweig, der die Flugphysik ebenso überspringt.
  if(spec.sub){ stepSub(dt, inp); return; }

  // Steuerraten aus dem aktiven Modell (Airbus träge, SuperCup wendig)
  const pitchRate=spec.pitch, rollRate=spec.roll, yawRate=0.7;
  const e = new THREE.Euler(inp.pitch*pitchRate*dt, -inp.yaw*yawRate*dt, -inp.roll*rollRate*dt, 'XYZ');
  const dq = new THREE.Quaternion().setFromEuler(e);
  state.quat.multiply(dq); state.quat.normalize();

  // --- Rollen loslassen (LT/RT bzw. Q/E) -> Querlage geht von selbst auf null zurück. ---
  // Nur die QUERLAGE, nicht die Nase: Steigen und Sinken bleiben so steuerbar wie vorher, der
  // Flieger legt sich nur wieder waagerecht — wie ein echtes Flugzeug mit Eigenstabilität.
  // Kunstflug bleibt möglich, weil das Aufrichten nur bis AUTO_LEVEL_MAX Querlage wirkt: wer weiter
  // rollt (Richtung Rückenflug), bleibt dort liegen und kann die Rolle sauber durchziehen.
  // Im Weltall gilt sie GENAUSO — und dort ist sie sogar wichtiger als in der Luft: die Querlage
  // erzeugt weiter unten eine Kurve (spec.turn), also driftet ein schräg stehender X-Wing dauernd
  // vom Kurs ab und fliegt am angepeilten Planeten vorbei. Genau daran ist ein Kind gescheitert.
  // Weil die Kamera im All mitrollt, dreht sich beim Aufrichten die Sternenkulisse sichtbar mit
  // zurück — das ist gewollt und zeigt, dass er sich gerade stellt.
  // Am Boden bleibt sie aus, dort hält ihn schon die Fahrwerks-Dämpfung waagerecht.
  if(inp.roll === 0 && !state.onGround){
    const eR = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
    if(Math.abs(eR.z) < AUTO_LEVEL_MAX){
      eR.z += (0 - eR.z) * Math.min(1, AUTO_LEVEL_RATE*dt);
      state.quat.setFromEuler(eR);
    }
  }

  // --- Nicht-Kunstflug-Modelle (Airbus/Transall/Canadair): KEIN Looping/keine Rolle. ---
  // Nick (Nase hoch/runter) und Querlage werden hart begrenzt -> statt Überschlag legt er sich
  // nur in die Kurve bzw. steigt maximal steil, kippt aber nie über Kopf.
  if(!spec.aero && !state.onGround){
    const eL = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
    const maxPitch = 1.05;                       // ~60° Nase hoch/runter, kein Überkopf
    const maxBank  = spec.maxBank || 0.7;        // ~40° Querlage max
    eL.x = Math.max(-maxPitch, Math.min(maxPitch, eL.x));
    eL.z = Math.max(-maxBank,  Math.min(maxBank,  eL.z));
    state.quat.setFromEuler(eL);
  }

  // --- Kurvenflug aus Querlage: Schräglage erzeugt Gieren (wie ein echtes Flugzeug). ---
  // Nicht-Kunstflug: volle Kopplung (kurven über die Querlage). Kunstflug-Jets: nur SCHWACHE
  // Kopplung (~20 %), damit sie sich beim Kurvenlegen sanft zur Seite ziehen (nicht nur rollen),
  // ohne dass ein Looping/eine Rolle verzogen wird. Beim Überkopf-Fliegen (Looping) kehrt cos(bank)
  // das Vorzeichen um -> deshalb mit cos gewichten, damit die Rolle sauber bleibt.
  if(!state.onGround){
    const eB = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
    const bank = eB.z;                       // Querlage (rad)
    let turn = bank * spec.turn;
    if(spec.aero) turn *= 0.25 * Math.max(0, Math.cos(bank));   // 75% Rolle / 25% Seitwärts
    const turnQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), turn*dt);
    state.quat.premultiply(turnQ); state.quat.normalize();
  }

  const forward = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const upV      = new THREE.Vector3(0,1,0).applyQuaternion(state.quat);

  // --- Intuitives Flugmodell: Schub = ZIELGESCHWINDIGKEIT (linear), sanft angeregelt. ---
  // 30 % Schub -> ~30 % vMax und BLEIBT dort (kein Weiterbeschleunigen). Auftrieb auf 1 g
  // gedeckelt -> kein Selbst-Steigen; Höhe kommt aus der Nase (Pitch). Sturz beschleunigt,
  // Steigflug bremst (über die Vektorzerlegung von Schwerkraft/Nase).
  const GRAV = GRAV_AT[locale] !== undefined ? GRAV_AT[locale] : 9.81;   // Mond leichter, Weltall schwerelos
  // Im Weltall gilt nicht die Luft-Höchstgeschwindigkeit, sondern Warp: 100 % = Warp 1,
  // im Hyperraum wächst das weiter bis Warp 10.
  const vMax = (locale === 'space') ? SPACE_C * warpFactor() : spec.vMax;
  const speed = state.vel.length();
  // X-Wing (VTOL): unter 30 % Schub übernehmen die Repulsoren. vtolMix blendet Vortrieb,
  // Schwerkraft und Auftrieb aus (1 = ganz aus bei <= 20 %, 0 = normaler Flug ab 30 %), damit
  // „senkrecht" wirklich senkrecht ist und die Steig-/Sinkrate exakt am Schub hängt.
  //
  // Bei 0 % Schub gilt das JETZT AUCH. Vorher stand hier `state.throttle > 0.001`, der Repulsor war
  // damit aus, und wer nur den Schub loslässt, fiel wie ein Stein (aus 100 m mit 44 m/s auf eine
  // Crash-Schwelle von 16 m/s). Gewollt ist das Gegenteil: 0 % ist die SCHNELLE Landung, nicht der
  // Absturz. Der Umkehrschub (throttle bis -0,2, A/C halten) bleibt außen vor — das ist die Bremse
  // im Vorwärtsflug und soll die Flugphysik nicht abschalten.
  //
  // Im Weltall gibt es keinen Boden und nichts zu schweben: dort ist der Schub linear, damit
  // 10 % = Warp 0,1 ... 100 % = Warp 1 gilt. Schweben/Landen nur über Erde und Mond.
  const vtolMix = (spec.vtol && locale !== 'space' && state.throttle >= 0 && state.throttle < VTOL_FWD)
    ? Math.min(1, (VTOL_FWD - state.throttle) / (VTOL_FWD - VTOL_HOVER)) : 0;
  const vtolRest = 1 - vtolMix;
  const targetV = vMax * Math.max(0, state.throttle);          // Wunschgeschwindigkeit aus Schub
  const fwdSpeed = state.vel.dot(forward);                     // aktuelle Fahrt in Nasenrichtung
  const dv = targetV - fwdSpeed;
  const aMax = (locale === 'space') ? SPACE_C                  // im Vakuum zieht der Antrieb voll durch
             : (boosting ? spec.accel*1.6 : spec.accel);        // Boost (X/Shift): extra Beschleunigung
  const push = Math.sign(dv) * Math.min(Math.abs(dv)/Math.max(dt,1e-4), aMax) * vtolRest;  // m/s², begrenzt
  const accel = new THREE.Vector3();
  if(dv < 0){
    // ABBREMSEN auf die Zielfahrt wirkt wie Luftwiderstand: entgegen der FAHRT (nicht entgegen der
    // Nase) und nur WAAGERECHT. Entgegen der Nase würde dieselbe Bremse bei nach unten zeigender
    // Nase den Sturz auffangen — Motor aus oder Strömungsabriss ergäbe ein Schweben mit ~20 m/s
    // statt eines echten Absturzes. Im Waagerechtflug ist das identisch zu vorher.
    // Zusätzlich blendet die Bremse mit steigender Sinkrate aus (voll bis -4 m/s, ab -12 m/s gar
    // nicht mehr): im Sturz soll er Fahrt GEWINNEN. Der Umkehrschub (A/C halten) bremst immer.
    // Ausblenden gilt nur in der Erdatmosphäre — im Weltall/auf dem Mond gibt es keinen Sturzflug,
    // dort soll der Antrieb immer sauber auf die Zielgeschwindigkeit herunterregeln.
    const bFade = (locale !== 'earth' || state.throttle < 0) ? 1
                : Math.max(0, Math.min(1, (state.vel.y + 12) / 8));
    const hx = state.vel.x, hz = state.vel.z, hl = Math.hypot(hx, hz);
    if(hl > 0.001 && bFade > 0){ const b = Math.abs(push)*bFade; accel.x -= (hx/hl)*b; accel.z -= (hz/hl)*b; }
  } else {
    accel.addScaledVector(forward, push);                      // Vortrieb entlang Nase (sanft an Ziel)
  }
  accel.y -= GRAV * vtolRest;                                  // Schwerkraft (immer -Y)
  // Auftrieb ⟂ Flügel, GEDECKELT auf 1 g: ab vTO hält er das Gewicht (waagerecht = Höhe halten),
  // darunter reicht er nicht -> Flieger sinkt (Gleitflug/Stall). Nie mehr als 1 g -> kein Hochschießen.
  // Der X-Wing hat Repulsorlift: er trägt sich unabhängig von der Fahrt. Deshalb sackt er beim
  // Wechsel vom Schweben in den Vorwärtsflug nicht durch, sondern beschleunigt waagerecht.
  // Auch bei 0 % Schub — vorher war er dort aus und der Flieger fiel wie jeder andere. Das ist der
  // Kern der neuen Steuerung: 0 % sinkt schnell, aber getragen und mit sicherem Aufsetzen. Nur der
  // Umkehrschub (negativer throttle) schaltet ihn ab, das ist die Bremse im Vorwärtsflug.
  // Flügel-Flieger brauchen Fahrt; im Strömungsabriss gibt es gar keinen Auftrieb.
  const repulsor = !!spec.vtol && state.throttle >= 0;
  const liftF = repulsor ? 1 : Math.min(1, (speed*speed)/(spec.vTO*spec.vTO)) * (state.stalling ? 0 : 1);
  accel.addScaledVector(upV, GRAV * liftF * vtolRest);
  state.vel.addScaledVector(accel, dt);

  // Harte Obergrenze: Normalflug knapp über der Zielgeschwindigkeit, im Sturz etwas mehr (Gleitflug).
  const vNow = state.vel.length();
  const diving = state.vel.y < -2;
  const vCap = diving ? vMax*1.25 : vMax*1.03;
  if(vNow > vCap) state.vel.multiplyScalar(vCap / vNow);

  // Höhen-Deckel: sanft abriegeln (kein hartes Ruckeln, kein "Anstoßen"/Crash). In den letzten
  // 120 m vor maxAlt wird die Steig-Geschwindigkeit gedämpft; bei maxAlt ist Schluss nach oben.
  // Der Deckel gilt nur in der Erdatmosphäre — und der X-Wing schiebt sich ab 80 % Schub hindurch
  // (genug Fahrt, um die Erde zu verlassen).
  const altCapOn = (locale === 'earth') && !(spec.vtol && state.throttle >= SPACE_THR);
  if(spec.maxAlt && altCapOn){
    const over = (state.pos.y - ISLAND_Y) - (spec.maxAlt - 120);
    if(over > 0 && state.vel.y > 0){
      const damp = Math.max(0, 1 - over/120);                  // 1 -> 0 über die letzten 120 m
      state.vel.y *= damp;
    }
    if((state.pos.y - ISLAND_Y) >= spec.maxAlt && state.vel.y > 0) state.vel.y = 0;
  }

  // --- Ruderwirksamkeit ∝ Fahrt: schnell = Geschwindigkeit folgt der Nase (sauberer Looping/Kurve);
  //     langsam = Flieger sackt durch (Nase zeigt hoch, sinkt trotzdem = echter Gleit-/Stall-Effekt). ---
  const vlen = state.vel.length();
  if(vlen > 0.001){
    const authority = Math.min(1, speed / spec.vTO);           // 0 (steht) .. 1 (ab vTO volle Kontrolle)
    // Im VTOL-Schweben abgeschaltet (vtolRest = 0) — sonst zieht die waagerechte Nase die
    // senkrechte Fahrt nach vorne und der Senkrechtstart driftet weg. Im Strömungsabriss ebenfalls
    // aus: dort gibt es keinen Ruderdruck, und die Umlenkung würde den Sturz flach ziehen.
    const base = (spec.aero ? 0.14 : 0.09) * vtolRest * (state.stalling ? 0 : 1);  // Jets koppeln straffer
    const dir = state.vel.clone().normalize();
    dir.lerp(forward, base * authority);
    state.vel.copy(dir.multiplyScalar(vlen));
  }

  // --- X-Wing (VTOL): Steig-/Sinkrate aus dem Schub anregeln. Läuft NACH der Ruderwirksamkeit,
  // damit das senkrechte Steigen nicht Richtung Nase weggedreht wird (vtolMix siehe oben).
  //
  // NICHT im Sturz nach einer Kollision (state.falling): dort setzt hitsBuilding den Schub auf 0,
  // und seit der Repulsor auch bei 0 % trägt, würde diese Regelung den Sturz auf -20 m/s einbremsen,
  // während der falling-Block ihn beschleunigen will. Ein Aufprall gegen ein Haus soll ein Absturz
  // bleiben — die neue Landestufe gilt fürs LANDEN, nicht fürs Verunglücken.
  if(vtolMix > 0 && !state.falling){
    // Zielrate aus dem Schub: 0 % zügig sinken, 10 % ruhig sinken, 20 % schweben. Beim Schweben wird
    // nicht endlos gestiegen, sondern die Schwebehöhe angeregelt: unter 20 m über Grund steigt er,
    // darüber bleibt er stehen (nie von selbst sinken — sonst könnte man nicht in der Luft warten).
    let tv;
    if(state.throttle <= VTOL_LAND){
      // Zwischen 0 % und 10 % wird die Sinkrate durchgeblendet: bei 0 % zügig (VTOL_DROP, -20 m/s),
      // bei 10 % ruhig (VTOL_SINK, -10 m/s). Nicht zwei harte Stufen, sondern ein Übergang — sonst
      // fällt die Sinkrate bei 5 % Schub sprunghaft um die Hälfte, und ein Analogstick geht nun mal
      // durch alle Werte. Sicher aufsetzen tut er in diesem ganzen Bereich (siehe vtolLand).
      const kL = Math.min(1, Math.max(0, state.throttle / VTOL_LAND));
      tv = VTOL_DROP + (VTOL_SINK - VTOL_DROP) * kL;
    } else {
      const agl = state.pos.y - surfaceY(state.pos.x, state.pos.z);          // Höhe über Grund
      const hov = Math.max(0, Math.min(VTOL_CLIMB, (VTOL_HOVER_ALT - agl) * 0.5));
      const kH  = Math.min(1, (state.throttle - VTOL_LAND) / (VTOL_HOVER - VTOL_LAND));
      tv = VTOL_SINK + (hov - VTOL_SINK) * kH;                               // 10 % -> sinken, 20 % -> schweben
    }
    // Höhendeckel auch beim Senkrechtsteigen einhalten (sanft über die letzten 120 m)
    if(spec.maxAlt && altCapOn && tv > 0){
      const over = (state.pos.y - ISLAND_Y) - (spec.maxAlt - 120);
      if(over > 0) tv *= Math.max(0, 1 - over/120);
    }
    // Senkrechtrate anregeln (ersetzt Schwerkraft/Auftrieb), Horizontalfahrt austrudeln lassen
    state.vel.y += (tv - state.vel.y) * Math.min(1, 4*dt) * vtolMix;
    const vDamp = 1 - (1 - Math.exp(-1.2*dt)) * vtolMix;
    state.vel.x *= vDamp; state.vel.z *= vDamp;
    // Landeanflug (0 bis 10 %): Nase und Querlage sanft waagerecht ziehen -> setzt immer gerade auf.
    // Gilt für beide Sinkraten, auch die schnelle bei 0 % — schief aufsetzen wäre sonst der einzige
    // Weg, sich bei 0 % doch noch das Schiff zu zerlegen (tilt > 0,9 zählt als harte Landung).
    if(state.throttle <= VTOL_LAND && !state.onGround){
      const eV = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
      const kV = Math.min(1, 2.5*dt);
      eV.x += (0 - eV.x) * kV; eV.z += (0 - eV.z) * kV;
      state.quat.setFromEuler(eV);
    }
  }

  // --- STALL: zu wenig Fahrt -> Nase kippt nach unten (übersteuert Looping/Input), Flieger fällt.
  // WICHTIG: die normale Physik + Schub laufen WEITER -> mit Nase-runter/Vollgas gewinnt man Fahrt
  // und kommt wieder raus. Bodenkontakt im Stall = IMMER Crash. Ausstieg sobald Fahrt >= vStall.
  // NUR geschwindigkeitsabhaengig (nicht vom Schub): Stall erst bei fast keiner Fahrt, damit
  // Langsamflug/Landen mit wenig Schub moeglich bleibt. MIT HYSTERESE: einmal im Abriss braucht er
  // 50 % der Abhebegeschwindigkeit, um wieder herauszukommen — sonst flackert der Zustand im Sturz
  // (Sinkfahrt zaehlt als Fahrt) und der Sturz bleibt bei ~10 m/s haengen statt zu beschleunigen.
  const vStall = spec.vTO * (state.stalling ? 0.5 : 0.20);
  // !state.falling ist wichtig: nach einer Kollision (Haus, Turm, Rakete) steht die Fahrt auf 0,
  // und ohne diese Bedingung griff hier zuerst der Stall — Nase auf -75 Grad, Querlage heraus,
  // Dauer-Zittern am Controller — obwohl der Flieger schon senkrecht faellt (Fall-Block weiter
  // unten). Man sah also einen Strömungsabriss vor dem Sturz. Im Sturz gibt es auch sachlich
  // keinen Auftrieb mehr, der abreissen koennte.
  if(locale === 'earth' && !repulsor && !state.onGround && !state.falling && speed < vStall && vtolMix <= 0){
    state.stalling = true;
    // Nase konsequent nach unten zwingen (bis ~ -75° Pitch), Querlage rausnehmen -> kein Trudeln.
    const eS = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
    eS.z *= 0.85;
    eS.x += (-1.3 - eS.x) * Math.min(1, 3.5*dt);
    state.quat.setFromEuler(eS);
    // Kräftiges Sinken (Auftrieb ist weg): zusammen mit der Schwerkraft fällt er wie ein Stein.
    // Geschwindigkeit wird NICHT abgewürgt -> mit Nase runter/Vollgas gewinnt man wieder Fahrt.
    state.vel.y -= 25 * dt;
  } else {
    state.stalling = false;                          // genug Fahrt -> normal steuerbar
  }

  // Abhebe-Sperre: am Boden unter der modell-Abhebe-Geschwindigkeit kein Steigen,
  // egal wie sehr man die Nase zieht -> abheben erst ab genug Schub/Fahrt.
  if(state.onGround && speed < spec.vTO && state.vel.y > 0 && vtolMix <= 0) state.vel.y = 0;

  // Umkehrschub (throttle<0) bremst -> bei Stillstand STOPP (kein Rückwärtsgang). Sobald die
  // Vorwärts-Komponente der Geschwindigkeit auf 0 fällt, Horizontalfahrt komplett anhalten.
  if(state.throttle < 0){
    const fwdDot = state.vel.x*forward.x + state.vel.z*forward.z;   // Fahrt in Nasenrichtung
    if(fwdDot <= 0){ state.vel.x = 0; state.vel.z = 0; }
  }

  state.pos.addScaledVector(state.vel, dt);

  // ---- Gebäude-Kollision: Prallt am Haus ab (fliegt NICHT durch) und fällt GERADE nach unten ----
  if(locale === 'earth' && !state.falling && hitsBuilding(state.pos.x, state.pos.y, state.pos.z, state.onGround)){
    state.falling = true;
    // Einen laufenden Stall ausdruecklich beenden: sonst bleibt er den ganzen Sturz ueber stehen
    // (Zittern am Controller), und beim Aufschlag zaehlt hardLand ihn mit.
    state.stalling = false;
    playCrash();                       // 1. Geräusch: Aufprall gegen das Hindernis
    state.throttle = 0;
    state.vel.set(0, 0, 0);            // stoppt sofort (kein Durchfliegen, kein Vortrieb)
    // Bei einem BERG radial an den Hangfuß nach außen schieben, damit er AUSSEN am Hang
    // herunterrutscht statt im Kegel zu stecken/durchzufallen (bei Häusern nicht nötig).
    const po = pushOutOfHill(state.pos.x, state.pos.z);
    if(po){ state.pos.x = po.x; state.pos.z = po.z; }
  }
  if(state.falling){
    // langsames Kippen der Nase nach unten, aber KEIN seitliches Wegdriften -> senkrechter Fall
    state.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.8*dt, 0, 0, 'XYZ')));
    state.quat.normalize();
    state.vel.x = 0; state.vel.z = 0;                      // strikt senkrecht (nicht durchs Haus driften)
    state.vel.y -= 22*dt;                                  // fällt beschleunigt gerade runter
    state.pos.y += state.vel.y * dt;
    const gy = surfaceY(state.pos.x, state.pos.z);
    if(state.pos.y <= gy){
      state.pos.y = gy; state.falling = false;
      state.crashed = true; state.crashTimer = 3.0;
      playCrash();                     // 2. Geräusch: Aufschlag auf dem Boden
      const w = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
      state.quat.setFromEuler(new THREE.Euler(0.15, w.y, 0.4, 'YXZ'));
      planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
      crashRescue(state.pos.x, state.pos.z, isOnLand(state.pos.x, state.pos.z));
      return;
    }
    planeGroup.position.copy(state.pos); planeGroup.quaternion.copy(state.quat);
    return;
  }

  // ---- Boden / Start / Landung / Crash ----
  // Oberfläche ortsabhängig: über Land = Inselhöhe, über Trägerdeck = Deckhöhe, sonst Meer (y=0).
  const overLand = isOnLand(state.pos.x, state.pos.z);
  const onCarrierDeck = isOnCarrier(state.pos.x, state.pos.z);
  const GROUND_Y = surfaceY(state.pos.x, state.pos.z);
  const wasGround = state.onGround;
  if(state.pos.y <= GROUND_Y){
    const vspeed = speed;
    const sinkRate = -state.vel.y;   // wie schnell fällt er?
    const eul0 = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
    const tilt = Math.abs(eul0.x) + Math.abs(eul0.z);

    if(!wasGround){
      // Crash, wenn: hier nicht landbar (falsche Oberfläche fürs Modell) ODER
      // zu schnell / zu steil gesunken / zu schräg aufgesetzt.
      const badSpot   = !canLandHere(state.pos.x, state.pos.z);
      // X-Wing im Senkrecht-Sinkflug setzt IMMER sauber auf — nie „hart gelandet". Das gilt jetzt
      // im GANZEN Landebereich bis 0 %: vorher stand hier `state.throttle > 0`, also war die
      // schnelle Landung bei 0 % ausgerechnet die einzige, die als Absturz zählte (VTOL_DROP ist
      // -20 m/s, die Schwelle liegt bei 16). Der Umkehrschub bleibt außen vor, der ist negativ.
      const vtolLand  = spec.vtol && state.throttle >= 0 && state.throttle <= VTOL_LAND;
      const hardLand  = !vtolLand && (vspeed > 55 || sinkRate > 16 || tilt > 0.9 || state.stalling);  // Stall = kein sanftes Landen
      if(badSpot || hardLand){
        state.crashed = true;
        state.crashTimer = 3.0;              // 3 Sek Löschsequenz
        playCrash();
        const wreckE = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
        state.quat.setFromEuler(new THREE.Euler(0.15, wreckE.y, 0.4, 'YXZ'));
        state.pos.y = GROUND_Y;
        planeGroup.position.copy(state.pos);
        planeGroup.quaternion.copy(state.quat);
        crashRescue(state.pos.x, state.pos.z, overLand);
        return;
      }
    }
    // Beim ROLLEN auf falscher Fläche (z.B. Jet rollt ins Gras) ebenfalls Crash — aber nur wenn er
    // sich noch bewegt (nicht direkt beim Reset/Stillstand). Fuer die Canadair gilt das nicht mehr:
    // sie darf inzwischen ueberall auf der Erde aufsetzen und rollen (siehe canLandHere), also auf
    // Wasser, Bahn, Deck und Wiese.
    if(wasGround && vspeed > 3 && !canLandHere(state.pos.x, state.pos.z)){
      state.crashed = true;
      state.crashTimer = 3.0;
      playCrash();
      const wreckE = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
      state.quat.setFromEuler(new THREE.Euler(0.15, wreckE.y, 0.4, 'YXZ'));
      state.pos.y = GROUND_Y;
      planeGroup.position.copy(state.pos);
      planeGroup.quaternion.copy(state.quat);
      crashRescue(state.pos.x, state.pos.z, overLand);
      return;
    }
    state.pos.y = GROUND_Y;
    if(state.vel.y < 0) state.vel.y = 0;
    state.vel.x *= 0.995; state.vel.z *= 0.995;   // wenig Rollreibung -> rollt zum Abheben an
    state.onGround = true;
    const eul = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
    eul.x *= 0.9; eul.z *= 0.9;                    // Nase am Boden waagerecht halten
    state.quat.setFromEuler(eul);
  } else {
    state.onGround = false;
  }

  // Transform
  planeGroup.position.copy(state.pos);
  planeGroup.quaternion.copy(state.quat);
  floatCanadair(dt);   // als Flugboot auf der Duenung liegen, nicht starr auf der Nulllinie
}

// Das Canadair ist ein FLUGBOOT und muss auf dem Wasser mitschwimmen.
// Warum das hier steht und nicht in surfaceY: surfaceY ist zugleich die Kontaktschwelle der
// Landelogik ("state.pos.y <= GROUND_Y"). Laesst man sie mit der Welle schwingen, gilt das
// Flugzeug im Wellental als abgehoben, faellt einen Frame und wird beim Wiederaufsetzen erneut auf
// harte Landung geprueft (vspeed > 55 — das Canadair fliegt bis 63). Deshalb bleibt state.pos auf
// der Nulllinie und nur die DARSTELLUNG wandert: die Physik merkt nichts davon.
//
// Der Grund, aus dem es sein muss (gemessen, C:/tmp/cana.js + cana2.js): das Modell steht mit der
// Unterkante auf y = 0, sein Rumpf ist rund 3,3 m hoch — und die sichtbare Wasserflaeche an der
// Stelle des Fliegers steigt bis +2,94 m (seaMeshY, ueber 60 s abgetastet; das Gitter wandert mit
// dem Flieger, siehe recycleWorld). Die Welle deckte den Rumpf also zu 89 % zu.
const CANADAIR_HULL = 6.4;     // halbe Rumpflaenge (Modell 12,71 m, gemessen) — fuers Nicken
const CANADAIR_BOB  = 0.7;     // wie stark es der Wellenneigung folgt (Boot: BOAT_BOB)
const _canaFwd = new THREE.Vector3();
// Der geglaettete Nickwinkel. MUSS zwischen den Frames stehen bleiben: rechnet man ihn jedes Bild
// frisch aus state.quat, ist der Glaettungsfaktor bei 60 fps nur 0,042 — angezeigt wuerden 4 % der
// Wellenneigung, das Nicken waere unsichtbar. stepBoat hat das Problem nicht, weil es sein Ergebnis
// in state.quat zurueckschreibt und im naechsten Frame von dort weiterrechnet.
let canaPitch = 0;
function floatCanadair(dt){
  // Schwimmt es gerade? Nur das Canadair, nur unten, nur auf offenem Wasser (auf der Landebahn
  // steht es auf seinem Bugrad, auf dem Traeger darf es gar nicht landen).
  const schwimmt = locale === 'earth' && isCanadair() && state.onGround
    && !isOnLand(state.pos.x, state.pos.z) && !isOnCarrier(state.pos.x, state.pos.z);
  if(!schwimmt){
    // Den Nickwinkel sanft abbauen. Ohne das behielt der Flieger nach dem Abheben die letzte
    // Wellenneigung (bis 17 Grad) und flog mit schiefer Nase weiter, und beim naechsten Aufsetzen
    // haette es gesprungen. Sanft, damit ein Start aus dem Wellenberg keinen Ruck gibt.
    if(canaPitch !== 0){
      canaPitch *= Math.max(0, 1 - 3*dt);
      if(Math.abs(canaPitch) < 1e-4) canaPitch = 0;
    }
    return;
  }
  // Gerechnet wird relativ zur Gittermitte (= Flieger), nicht in Weltkoordinaten — siehe
  // seaSurfaceY: das Meeresgitter wandert mit, und mit Weltkoordinaten liegt man bis zu 3,18 m
  // daneben.
  // Absoluter Wert, KEIN Zuschlag auf state.pos.y: die Wasserhoehe ist die Hoehe, auf der es liegt.
  planeGroup.position.y = seaSurfaceY(0, 0, dt) - CANADAIR_DRAFT;
  // Nicken aus der Duenung: die Welle vor dem Bug gegen die hinter dem Heck — dasselbe Verfahren
  // wie beim Feuerwehrboot (stepBoat), nur mit der Rumpflaenge des Canadair.
  _canaFwd.set(0, 0, -1).applyQuaternion(state.quat);
  const bowY   = seaSurfaceY( _canaFwd.x*CANADAIR_HULL,  _canaFwd.z*CANADAIR_HULL, dt);
  const sternY = seaSurfaceY(-_canaFwd.x*CANADAIR_HULL, -_canaFwd.z*CANADAIR_HULL, dt);
  const pitchT = Math.atan2(bowY - sternY, CANADAIR_HULL*2) * CANADAIR_BOB;
  canaPitch += (pitchT - canaPitch) * Math.min(1, 2.5*dt);
  // Auf die Lage des Fliegers ADDIERT, nicht ersetzt: Kurs (yaw) und Querlage (roll) bleiben so,
  // wie die Flugphysik sie gesetzt hat, und nur die Nase wippt mit der Welle.
  const eC = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  eC.x += canaPitch;
  planeGroup.quaternion.setFromEuler(eC);
}
// Wo der Flieger fuer die KAMERA steht. Normalerweise ist das state.pos — nur das schwimmende
// Canadair steht woanders, als es rechnet (siehe floatCanadair): dessen state.pos bleibt auf der
// Nulllinie, waehrend die Anzeige mit der Welle wandert. Ohne diesen Bezug bliebe die Kamera starr
// stehen und das Flugzeug huepfte bis 2,94 m in ihrem Bild auf und ab.
const _camRef = new THREE.Vector3();
function planeCamRef(){
  _camRef.copy(state.pos);
  _camRef.y = planeGroup.position.y;   // beim Canadair die schwimmende Hoehe, sonst identisch
  return _camRef;
}

// ---------- Kamera ----------
// updateCamera() bekommt kein dt übergeben (historisch), die EVA-Kamera braucht aber eines für ein
// bildratenunabhängiges Nachziehen. Der Loop schreibt es hier hinein, bevor er updateCamera ruft.
let dtCam = 1/60;
const _camOff = new THREE.Vector3(), _camDes = new THREE.Vector3();
// Hilfsvektoren fuer die Kamera-Kollision (wiederverwendet, damit pro Frame kein Muell entsteht)
const _camFix = new THREE.Vector3(), _camTry = new THREE.Vector3();
function updateCamera(){
  // ---- JETPACK: eine echte FLUGGERAET-Kamera, gebaut wie die Verfolgerkamera des X-Wing.
  //
  // Sie stand vorher im EVA-Zweig weiter unten, zusammen mit „zu Fuss", Boot und Rover. Das war der
  // Fehler: dort wird auf einen Punkt VOR dem Astronauten geschaut (EVA_LOOK_AHEAD), damit man beim
  // Umsehen an ihm vorbei in den Himmel blicken kann. Beim Fliegen dreht sich das Bild dann um einen
  // Punkt vor ihm, statt um ihn selbst — gemeldet als „die kamera faehrt um den jetpack herum,
  // anstatt die optik eines fluggeraetes (xwing) zu haben". Der X-Wing schaut auf SICH SELBST.
  //
  // Drei Dinge macht sie deshalb genau wie der Flieger:
  //   1. lookAt direkt auf den Astronauten — er sitzt in der Bildmitte, das Bild dreht sich um ihn.
  //   2. Abstand waechst mit dem Tempo (camBackExtra): bei Warp reichten die festen 13,3 m nicht,
  //      man klebte am Ruecken („kamera bei warp viel zu nah"). Der Flieger nimmt bis 125 m dazu.
  //   3. back und up aus DEMSELBEN Quaternion wie die Fluglage, Nickwinkel geklemmt — dann kippt das
  //      Bild bei steilem Steigflug nicht um.
  if(eva && eva.jet){
    const g = eva.group.position;
    // Der VOLLE Nickwinkel, NICHT geklemmt. Erst hatte ich ihn wie beim Flieger auf ±0,9 rad (51°)
    // begrenzt — dort ist das richtig, weil ein Flieger Loopings macht und ueber Kopf gehen kann.
    // Das Jetpack kann das nicht: eva.jetPitch ist in updateJet schon hart auf ±JET_PMAX (72°)
    // begrenzt, ein Ueberkopf gibt es also nie. Die Klemme setzte die Kamera bei Vollnicken dafuer um
    // 20 Grad NEBEN die Flugachse, und genau das war „die kamera bleibt nicht hinter dem jetpack".
    const jp = eva.jetPitch;
    // Der rechte Stick lenkt am Jetpack (Schub), umsehen gibt es nicht — evaOrbit bleibt 0 und wird
    // hier deshalb gar nicht gebraucht. Bei LB/RB (sideView) schaut man wie im Flieger von der Seite.
    // Die Querlage nimmt die Kamera GENAUSO mit wie beim Flieger: über camRoll, das gleitend zwischen
    // Erdatmosphäre (0 — Horizont bleibt unten) und Weltall (1 — es gibt kein oben, die Kulisse dreht
    // mit) blendet. Ohne das rollte der Astronaut, das Bild aber nicht, und man sah der Querlage nicht
    // an, dass sie eine Kurve zieht.
    const jrCam = (eva.jetRoll || 0) * camRoll;
    const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(jp, eva.yaw, jrCam, 'YXZ'));
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(camQ);
    const upV  = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
    // Grundabstand 13,3 m (7 m mal Abstandsfaktor 1,9) plus ein Tempo-Zuschlag wie beim Flieger, aber
    // auf ein Drittel geskaliert: der X-Wing nimmt bis 125 m dazu und ist mit 11 m Spannweite dabei
    // noch gut zu sehen — ein 1,9 m grosser Astronaut waere auf 138 m ein Punkt. Ein Drittel gibt bei
    // Warp bis 55 m, und damit steht er im Bild wie der X-Wing auf seinen 149 m.
    // Ohne jeden Zuschlag klebte die Kamera bei Warp auf 13,3 m am Ruecken („kamera bei warp viel zu
    // nah") — dort legt man 3000 bis 30.000 m pro Sekunde zurueck, da braucht der Blick Vorlauf.
    const dist = 7*1.9 + camBackExtra()/3;
    const hoch = 3.4*1.9;
    const desired = g.clone().addScaledVector(back, dist).addScaledVector(upV, hoch);
    // Von der Seite schauen (LB/RB), wie im Flieger — auch hier auf ihn gerichtet.
    if(sideView !== 0){
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
      desired.copy(g).addScaledVector(right, dist*sideView*0.7).addScaledVector(upV, hoch*0.5);
    }
    // Die RICHTUNG wird HART gesetzt, nur die LAENGE weich nachgezogen. Vorher wurde der ganze
    // Abstandsvektor gelerpt, und damit hing die Kamera beim Lenken hinter der Achse zurueck:
    // nachgerechnet 6,2 Grad beim Drehen (JET_YAW 1,3 rad/s bei Lerp 12/s) und 4,8 Grad beim Nicken.
    // Zusammen mit der frueheren Nickwinkel-Klemme waren das bis 26 Grad — das ist das gemeldete
    // „die kamera bleibt nicht hinter dem jetpack (exakt wie ein flieger)". Jetzt sitzt sie in jedem
    // Bild genau auf der Flugachse; weich bleibt nur, wie schnell sie bei Tempowechseln aufholt.
    //
    // Die Laenge braucht das Nachziehen, weil der Tempo-Zuschlag (camBackExtra) mit der Fahrt
    // waechst: beim Beschleunigen auf Warp waechst der Sollabstand von 14 auf 55 m, und ohne
    // Nachziehen sprang die Kamera dabei.
    const richtung = _camDes.copy(desired).sub(g);          // Sollrichtung samt Solllaenge
    const sollLen  = richtung.length();
    const istLen   = camera.position.distanceTo(g);
    const vJ = eva.jetVel ? eva.jetVel.length() : 0;
    const kJ = Math.min(1, (6 + vJ*0.05) * dtCam);          // nur fuer die Laenge
    const neueLen = (istLen > 0.001) ? istLen + (sollLen - istLen) * kJ : sollLen;
    if(sollLen > 0.001){
      camera.position.copy(g).addScaledVector(richtung.multiplyScalar(1/sollLen), neueLen);
    }
    camera.up.copy(upV);
    // Auf IHN schauen — das ist der Kern des Ganzen (siehe oben, Punkt 1).
    camera.lookAt(g);
    return;
  }
  // Draußen unterwegs: Kamera hinter dem Astronauten, leicht von oben — und mit dem rechten Stick
  // frei um ihn herum schwenkbar (siehe evaOrbit/evaPitch). Losgelassen gleitet sie von allein
  // zurück, damit man die Orientierung nicht verliert.
  if(eva){
    const g = eva.group;
    // Blickziel: wird unten je nach Schwenk gesetzt (Kopfhöhe, gehoben oder gesenkt).
    const look = new THREE.Vector3(g.position.x, g.position.y + ASTRONAUT_H*0.6, g.position.z);
    camera.up.set(0,1,0);
    // LB/RB gehalten = von links/rechts schauen, genau wie im Flieger. Hat Vorrang vor dem
    // freien Schwenken, weil es eine feste, wiederfindbare Ansicht ist.
    if(sideView !== 0){
      const right = new THREE.Vector3(Math.cos(eva.yaw), 0, -Math.sin(eva.yaw));   // quer zum Blick
      const desired = g.position.clone().addScaledVector(right, 6*sideView);
      desired.y = g.position.y + 2.6;
      camera.position.lerp(desired, Math.min(1, 10*dtCam));
      camera.lookAt(look);
      return;
    }
    // Freies Umsehen: der Stick verstellt den Winkel, ohne Eingabe läuft beides zurück auf null.
    const active = Math.abs(lookX) > 0.01 || Math.abs(lookY) > 0.01;
    if(active){
      // Minus: Stick nach rechts soll den BLICK nach rechts schwenken. Die Kamera muss dafür nach
      // LINKS um den Astronauten wandern, weil sie ihn ansieht — mit Plus fühlte es sich vertauscht an.
      evaOrbit -= lookX * EVA_LOOK_SPEED * dtCam;
      evaPitch += lookY * EVA_LOOK_SPEED * 0.6 * dtCam;
      // Nicht über den Scheitel und nicht unter den Boden schwenken.
      evaPitch = Math.max(EVA_PITCH_MIN, Math.min(EVA_PITCH_MAX, evaPitch));
      // Der Umlaufwinkel darf ganz herum gehen, aber im Bereich bleiben, damit die Rückkehr
      // den kurzen Weg nimmt.
      while(evaOrbit >  Math.PI) evaOrbit -= 2*Math.PI;
      while(evaOrbit < -Math.PI) evaOrbit += 2*Math.PI;
    } else {
      // Zurückgleiten: erst der Umlauf, dann die Höhe — beides weich, damit es nicht zuckt.
      const k = Math.min(1, EVA_LOOK_RETURN * dtCam);
      evaOrbit += (0 - evaOrbit) * k;
      evaPitch += (0 - evaPitch) * k;
      if(Math.abs(evaOrbit) < 0.002) evaOrbit = 0;
      if(Math.abs(evaPitch) < 0.002) evaPitch = 0;
    }
    // Kameraplatz und BLICKZIEL zusammen. Entscheidend ist, dass sich das Blickziel mitbewegt:
    // sonst schaut man immer nur auf den Astronauten, und "nach oben schauen" gibt es nicht.
    const yaw = eva.yaw + evaOrbit;
    // Die Kamera steht bei ALLEN Sub-Modi schräg hinter und über dem Astronauten — zu Fuß, im Boot,
    // im Rover und am Jetpack gleich. Das ist die Ansicht, die man von einem Fahrzeug erwartet.
    //
    // AM JETPACK folgt sie zusätzlich dem NICKEN, genau wie die Verfolgerkamera des Fliegers. Ich
    // hatte das Nicken erst ganz herausgenommen, weil die Kamera bei steilem Steigflug unter dem
    // Astronauten stand und das Bild umkippte. Das war die falsche Abhilfe: gemeldet kam zurück
    // „die Kamera bleibt starr, der Astronaut dreht sich" — er kippte im Bild, der Rahmen nicht,
    // und damit sah man seine Flugrichtung nicht mehr.
    //
    // Das JETPACK hat seine eigene Kamera bekommen (ganz oben in updateCamera, nach dem Muster der
    // Verfolgerkamera des Fliegers). Hier geht es nur noch um „zu Fuss", Boot und Rover: dort bleibt
    // die Kamera waagerecht, es gibt kein Nicken, und der rechte Stick dient dem freien Umsehen.
    const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));   // waagerecht hinter ihm
    const fwd  = new THREE.Vector3(-back.x, 0, -back.z);               // waagerechte Blickrichtung
    // Blickziel: vor dem Astronauten, um evaPitch gehoben bzw. gesenkt. Positiv = in den Himmel,
    // negativ = auf den Boden vor ihm. Im Boot und im Rover ist evaPitch 0 (der rechte Stick gibt
    // dort Schub statt umzusehen), die Rechnung fällt also von allein auf „geradeaus" zurück.
    look.copy(g.position)
        .addScaledVector(fwd, EVA_LOOK_AHEAD * Math.cos(evaPitch))
        .setY(g.position.y + ASTRONAUT_H*0.6 + EVA_LOOK_AHEAD * Math.sin(evaPitch));
    // Kamera: hinter ihm, gegenläufig zum Schwenk — schaut er hinauf, sinkt sie etwas, damit der
    // Blick über ihn hinweg in den Himmel geht statt auf seinen Helm.
    // Im Schlauchboot weiter weg und hoeher: bei 40 km/h ueber die Duenung braucht man Vorausblick
    // aufs Wasser und die Kueste, genau wie beim Feuerwehrboot. Zu Fuss bleibt es dicht dran.
    // Abstandsfaktor: das Schlauchboot braucht den meisten Platz, der Rover etwas weniger,
    // zu Fuss ist die Kamera am naechsten dran.
    // Am Jetpack am weitesten weg: er fliegt mit 162 km/h durch einen leeren Raum, in dem es
    // keine Bodenmerkmale gibt — ohne Abstand fehlt jedes Gefuehl fuer Fahrt und Richtung.
    // Der Abstandsfaktor richtet sich nach der GRÖSSE des Fahrzeugs. Im Rover hing er bisher nicht
    // am Modell, obwohl die beiden weit auseinanderliegen: der Perseverance ist ausgemessen 10,0 m
    // lang und 5,45 m hoch, der Apollo Lunar Rover 3,09 x 1,77 m. Mit demselben Faktor 1,5 füllte
    // der Mars-Rover das Bild — er ist gut dreimal so lang wie der Mondrover. Auf dem Mars also
    // 2,3: das ergibt 16,1 m Abstand statt 10,5 m, und damit steht er so im Bild wie der Mondrover.
    const roverBt = (locale === 'mars') ? 2.3 : 1.5;
    const bt = eva.boat ? 1.7 : (eva.rover ? roverBt : 1);
    const dist = 7*bt - 1.5 * Math.max(0, Math.sin(evaPitch));
    const desired = g.position.clone().addScaledVector(back, dist);
    // Höhe für alle gleich gerechnet: 3,4 m mal Abstandsfaktor über dem Astronauten.
    // Der evaPitch-Anteil (freies Umsehen mit dem rechten Stick) gilt nur, wo man sich umsieht — im
    // Boot und im Rover lenkt derselbe Stick, dort ist evaPitch immer 0.
    desired.y = g.position.y + 3.4*bt - 2.2 * Math.sin(evaPitch);
    // Nicht unter den Boden: sonst schaut man durch das Gelände. Beim Blick nach oben darf sie
    // deshalb auch nicht beliebig tief — der Boden gewinnt.
    // Ueber Wasser zaehlt die WELLENhoehe: surfaceY gibt dort 0 zurueck, die Duenung reicht aber bis
    // 1,6 m — ohne das taucht die Kamera in einen Wellenberg und man sieht kurz nur Blau.
    const floor = (eva.boat ? seaYAt(desired.x, desired.z) : evaFootY(desired.x, desired.z)) + 1.2;
    if(desired.y < floor) desired.y = floor;
    // Beim Schwenken schneller folgen als beim Zurückgleiten — sonst fühlt sich der Stick zäh an.
    camera.position.lerp(desired, Math.min(1, (active ? 14 : 6) * dtCam));
    // camera.up bleibt hier (0,1,0), oben im Zweig gesetzt: zu Fuss, im Boot und im Rover soll der
    // Horizont waagerecht stehen. Nur die Jetpack-Kamera kippt mit (eigener Block ganz oben).
    camera.lookAt(look);
    return;
  }
  // Schleudersitz-Phasen: 1) Jet trudelt -> Fallschirm im Blick.
  // 2) Jet aufgeschlagen (crashed) -> Blick auf Wrack/Feuerwehr, Fallschirm oben im Bild.
  if(parachute){
    if(state.crashed){
      // auf die Absturzstelle schauen, weit genug für Feuerwehr + Fallschirm darüber
      const focus = state.pos;
      const desired = focus.clone().add(new THREE.Vector3(28, 20, 40));
      camera.position.lerp(desired, frameLerp(0.06, dtCam));
      camera.lookAt(focus.x, focus.y + 6, focus.z);
    } else {
      const focus = parachute.group.position;
      const desired = focus.clone().add(new THREE.Vector3(30, 18, 42));
      camera.position.lerp(desired, frameLerp(0.06, dtCam));
      camera.lookAt(focus.x, focus.y - 4, focus.z);
    }
    return;
  }
  const cfg=viewConfigs[viewMode];
  const cc = camCfg();                            // pro Modell: Abstand + Höhe getrennt
  // Seitenansicht (D-Pad links/rechts gehalten): Kamera seitlich neben den Flieger.
  if(sideView !== 0){
    const right = new THREE.Vector3(1,0,0).applyQuaternion(state.quat);
    const side = 24 * cc.dist * sideView;         // links (-) / rechts (+)
    const desired = state.pos.clone().addScaledVector(right, side);
    desired.y += 6;
    if(locale === 'earth' && !subTaucht() && desired.y < 2) desired.y = 2;
    // frameLerp: derselbe Grund wie bei der Verfolgerkamera unten — 0,18 gilt fuer einen Frame
    // bei 60 fps und muesste sonst bei jeder anderen Bildrate anders schnell nachziehen.
    camera.position.lerp(desired, frameLerp(0.18, dtCam));
    camera.lookAt(state.pos);
    return;
  }
  // Verfolgerkamera folgt GIEREN + NICKEN (beim Looping sieht man, wohin es geht). In der Luft über
  // der Erde wird das ROLLEN verworfen -> kein Überschlagen, der Horizont bleibt unten.
  // IM WELTALL rollt sie MIT: dort gibt es kein oben und unten, und ohne Mitrollen sah man dem
  // X-Wing kaum an, ob er aufrecht oder auf dem Kopf fliegt. Mitgedreht bleibt er immer richtig
  // herum im Bild und die Sternenkulisse dreht sich — so wie man es aus Weltraumspielen kennt.
  // camRoll blendet den Anteil gleitend ein, damit der Übergang Erde <-> All nicht springt; auf
  // Mond und Mars (mit Boden und Schwerkraft) bleibt die Kamera aufrecht.
  // UNTER WASSER holt die Kamera naeher heran, und das ist die Loesung eines gemessenen Problems,
  // nicht Geschmack: das U-Boot ist 95 m lang, die Kamera stand 62,8 m hinter seiner Mitte (24 m
  // Basisabstand mal Faktor 2,6), und die Sichtweite unter Wasser ist 42 m oben und 30 m auf
  // 100 m Tiefe. Nachgemessen war der Bug bei 109,8 m Kameradistanz IMMER im Nebel, und vom
  // ganzen Boot sah man 26 m (oben) bis 14 m (unten) — gemeldet als "unterwass fahren wirkt
  // seltsam". Ohne sichtbares eigenes Fahrzeug fehlt jeder Bezug: man sieht Nebel, ein Stueck
  // Rumpf und weiss nicht, wohin die Nase zeigt.
  //
  // uwCamPull blendet den Faktor mit uwBlend ein, also mit demselben Wert, der auch Nebel und
  // Farbe fuehrt (siehe updateUnderwater). Damit ist das Herankommen genau der Uebergang durch
  // die Oberflaeche und kein Sprung.
  //
  // 0,42 ist gerechnet, nicht geraten: 24 m * 2,6 * 0,42 = 26,2 m hinter der Mitte, der Bug also
  // 73 m entfernt. Das ist bei 30 m Sicht noch zu weit fuer den Bug — bewusst so. Ein U-Boot,
  // dessen Bug im Dunkel verschwindet, ist genau richtig; was fehlte, war der TURM als Bezug,
  // und der steht bei 26 m mitten im klaren Bereich.
  const camE = new THREE.Euler().setFromQuaternion(state.quat, 'YXZ');
  const yaw = camE.y;
  // IM U-BOOT kippt die Kamera NICHT mit der Nase. Das war die Ursache mehrerer Probleme: sie sitzt
  // 76,8 m hinter dem Boot, und dieser Abstand hebt sie bei Nicklage weit an — nachgerechnet 48,8 m
  // ueber dem Boot bei den frueheren 30 Grad. Dadurch tauchte die Linse erst ab rund 50 m Bootstiefe
  // ein und wanderte beim Steuern staendig auf und ab ("das ist sehr verwirrend").
  // Beim U-Boot bringt das Mitkippen auch nichts: man will nach vorne sehen, wohin man faehrt, und
  // nicht in die Tauchrichtung. Im Flugzeug bleibt es, dort gehoert es zum Fluggefuehl.
  const pitch = isSub() ? 0 : Math.max(-0.9, Math.min(0.9, camE.x));   // ~±51° Nicken
  const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, camE.z*camRoll, 'YXZ'));
  const back = new THREE.Vector3(0,0,1).applyQuaternion(camQ);   // hinter dem Flieger (mit Nicken)
  const upV  = new THREE.Vector3(0,1,0).applyQuaternion(camQ);   // Kamera-Oben (rollt nie mit)
  // Hier zog die Kamera unter Wasser einmal naeher heran (UW_CAM_PULL), damit das eigene Boot im
  // 42-m-Nebel ueberhaupt zu sehen war. Das ist RUECKGEBAUT: bei 95 m Rumpflaenge sass sie damit
  // im Boot. Geloest ist es jetzt ueber die Sichtweite (UW_FOG_FAR 150 m) — der richtige Hebel,
  // denn zu sehen war das Problem, nicht der Abstand.
  const desired = planeCamRef().clone()
    .addScaledVector(back, cfg.dist*cc.dist + camBackExtra())
    .addScaledVector(upV,  cfg.height*cc.hgt);
  // Nur in der Inselwelt ist y = 0 der Meeresboden. Im Weltall liegt die Erdkugel UNTER dem Spieler
  // (Mittelpunkt bei y = -EARTH_R), man fliegt sie also im Negativen an — dort hätte diese Klemme die
  // Kamera bei y = 2 festgehalten, während der Flieger kilometerweit darunter weiterflog.
  if(locale === 'earth' && !subTaucht() && desired.y < 2) desired.y = 2;
  // Hier stand einmal ein DECKEL, der die Kamera beim Tauchen unter der Wasserflaeche halten
  // sollte — gegen das Flackern der Unterwassersicht. Er ist wieder heraus, weil er es nicht
  // konnte: er rechnete mit seaYAt, und das schwankt selbst um 4,8 m, die Kamera lief der Welle
  // also hinterher. Geloest ist das Flackern in updateUnderwater (uwBlend nimmt das Maximum aus
  // Kamera- und Fahrzeugtiefe). Die Kamera darf hier ruhig mit der Welle atmen.
  // Die Kamera darf nicht IN einem Schiffsrumpf sitzen. Sie hatte bisher gar keine Kollision, und
  // weil sie rund 30 m hinter dem Fahrzeug haengt, steckte sie beim Vorbeifahren an einem 300-m-
  // Frachter regelmaessig darin: gemessen bei bis zu 50 % der Kurse, wenn das Boot laengsseits
  // faehrt. Man sah dann von INNEN roten Stahl und hielt es fuer "ich fahre durch das Schiff",
  // obwohl das Boot draussen im Wasser blieb — auf dem Screenshot war rings um das Boot ja Wasser.
  // Loesung: die Kamera in solchen Faellen naeher heranholen, bis sie im Freien ist. Das ist die
  // uebliche Loesung fuer Verfolgerkameras und stoert nicht: naeher dran ist immer eine gueltige Sicht.
  if(locale === 'earth' && typeof hitsSeaShip === 'function'){
    const ref = eva ? eva.group.position : state.pos;
    _camFix.copy(desired).sub(ref);
    const full = _camFix.length();
    if(full > 1 && hitsSeaShip(desired.x, desired.y, desired.z)){
      // In Achtelschritten heranziehen, bis frei. Der letzte Rueckfall ist die Fahrzeugposition
      // selbst — dort ist die Kamera notfalls "im" Fahrzeug, aber niemals in einem fremden Rumpf.
      for(let s = 7; s >= 1; s--){
        _camTry.copy(ref).addScaledVector(_camFix, s/8);
        if(!hitsSeaShip(_camTry.x, _camTry.y, _camTry.z)){ desired.copy(_camTry); break; }
        if(s === 1) desired.copy(ref);
      }
    }
  }
  camera.up.copy(upV);
  // Nachgezogen wird der ABSTAND zum Flieger, nicht die absolute Position. Zieht man die Position
  // nach, wächst der Rückstand mit der Fahrt und mit sinkender Bildrate — bei Mach 2 waren es rund
  // 190 m, bei Warp 10 etwa 500 m, und der Flieger war nur noch ein Punkt. So bleibt das weiche
  // Nachziehen in Kurven, aber der Abstand ist genau der, den camBackExtra() vorgibt.
  const camSpd = state.vel.length();
  // Der Faktor gilt fuer EINEN Frame bei 60 fps — und genau das war der Fehler: er wurde direkt
  // als Lerp-Anteil benutzt, haing also an der BILDRATE statt an der Zeit. Bei 30 fps zog die
  // Kamera in derselben Realzeit nur halb so oft nach, die Zeitkonstante verdoppelte sich.
  //
  // GEMESSEN (X-Wing bei Mach 2,5, Nickrate 1,9 rad/s, 66,8 m Abstand): die Zeitkonstante lief
  // von 25,1 ms bei 60 fps auf 75,3 ms bei 20 fps — Faktor 3. Der Winkelrueckstand in der Kurve
  // stieg dabei von 1,93 auf 5,78 Grad, das Bild wanderte um 4,5 m seitlich. Weil die Bildrate
  // beim Fliegen schwankt (neue Zellen, Raketen, Vorfelder), WACKELTE diese Nachfuehrung
  // staendig — gemeldet als "die haelt gefuehlt den abstand nicht immer 100%, als wuerde man
  // abbremsen und beschleunigen. beim xwing mit mach 2,5 ists am extremsten egal in welcher
  // hoehe". Die Kamera hat also jeden Bildraten-Wackler in eine sichtbare Bewegung uebersetzt.
  //
  // frameLerp rechnet den Frame-Faktor auf die echte Framezeit um: (1-k) ist der Restanteil je
  // 1/60 s, bei dt Sekunden also hoch (dt*60). Bei genau 60 fps kommt derselbe Wert wie vorher
  // heraus, bei jeder anderen Bildrate der zeitlich richtige — nachgerechnet bleibt die
  // Zeitkonstante bei 60, 45, 30 und 20 fps konstant bei 25,1 ms.
  const k = frameLerp(Math.min(0.5, cfg.lerp * (1 + camSpd/120)), dtCam);
  // Bezug ist die ANGEZEIGTE Position (siehe planeCamRef) — beim schwimmenden Canadair weicht sie
  // von state.pos ab, sonst sind beide gleich.
  const ref = planeCamRef();
  _camOff.copy(camera.position).sub(ref);
  _camDes.copy(desired).sub(ref);
  camera.position.copy(ref).add(_camOff.lerp(_camDes, k));
  camera.lookAt(ref);
}

// ---------- Welt recyceln ----------
function recycleWorld(){
  // Meer folgt dem Bezugspunkt — während der EVA also dem Astronauten (siehe worldFocus). Sonst
  // stünde er beim Weglaufen irgendwann neben dem Meeresgitter, und die Inseln um ihn herum wären
  // nicht geladen.
  const F = worldFocus();
  // Das Gitter folgt dem Spieler STUFENLOS, und das muss so bleiben: seaSurfaceY(0, 0) liefert die
  // Hoehe der Gittermitte, und drei Fahrzeuge verlassen sich darauf, dass die Mitte ihre eigene
  // Position ist (stepBoat, stepSub, floatCanadair).
  // Ein Einrasten auf SEA_STEP war hier versucht, um bei uebersprungenen updateSea-Frames den
  // Wellenversatz zu vermeiden — es haette den Spieler aber bis zu 31,25 m neben die Gittermitte
  // gesetzt, bei 250 m Wellenlaenge also bis zu 1,5 m Hoehenfehler. Die Boote wuerden schweben.
  ground.position.x = F.x;
  ground.position.z = F.z;
  // Inseln in Sichtweite erzeugen/entfernen
  updateIslands();
  for(const cl of clouds){
    const dx=cl.position.x-F.x, dz=cl.position.z-F.z;
    if(dx> CLOUD_SPREAD/2) cl.position.x-=CLOUD_SPREAD;
    if(dx<-CLOUD_SPREAD/2) cl.position.x+=CLOUD_SPREAD;
    if(dz> CLOUD_SPREAD/2) cl.position.z-=CLOUD_SPREAD;
    if(dz<-CLOUD_SPREAD/2) cl.position.z+=CLOUD_SPREAD;
  }
}

// ---------- HUD ----------
const elAlt=document.getElementById('alt'), elSpd=document.getElementById('spd'),
      elThr=document.getElementById('thr'), elStat=document.getElementById('status'),
      elAltRow=document.getElementById('altrow'), elSpdU=document.getElementById('spdu'),
      elThrLbl=document.getElementById('thrlbl'), elThrU=document.getElementById('thru'),
      elAltLbl=document.getElementById('altlbl');
// Symbolreihe fuer die Ladeanzeige. repeat() wirft bei negativer Anzahl, und ein Wurf in updateHUD
// haelt den ganzen Frame an — deshalb wird hier immer auf 0..max geklemmt (NaN wird zu 0). Eine
// Anzeige darf das Spiel nicht anhalten, egal was der Zaehler gerade sagt.
// Text nur schreiben, wenn er sich WIRKLICH geaendert hat.
//
// updateHUD setzt 21 textContent-Werte pro Frame, also 1.260 mal pro Sekunde. Die meisten aendern
// sich dabei nicht: Beschriftungen ("Hoehe", "Schub"), Einheiten (" %", " km/h") und selbst Hoehe
// und Tempo stehen oft mehrere Frames auf derselben gerundeten Zahl.
//
// Jede Zuweisung an textContent ist aber eine DOM-Mutation, auch wenn der Wert gleich bleibt: der
// Browser wirft dafuer Layout und Paint des Elements neu an. Das laeuft im selben Frame wie das
// Rendern der 3D-Szene und ist damit ein direkter Ruckelbeitrag — und zwar einer, der bei hohem
// Tempo NICHT haeufiger, aber bei knapper Frame-Zeit besonders stoerend wird.
//
// Der Vergleich kostet nichts (ein String-Vergleich gegen den bereits im DOM stehenden Wert), und
// die eingesparten Mutationen sind der ganze Sinn. Deshalb geht ab hier JEDE HUD-Textausgabe durch
// diese Funktion und nicht mehr direkt auf textContent.
function setTxt(el, val){
  if(!el) return;
  const s = '' + val;
  if(el.textContent !== s) el.textContent = s;
}
function repeatSym(sym, count, max){
  const nRaw = Math.round(count);
  const n = Math.max(0, Math.min(max === undefined ? 99 : max, isFinite(nRaw) ? nRaw : 0));
  return sym.repeat(n);
}
function updateHUD(){
  // Im Weltall gibt es keine sinnvolle Höhe -> Zeile ausblenden. Auf dem Mond zählt die Höhe
  // ÜBER DEM KRATERBODEN (der schwankt um ±60 m).
  // Höhenzeile aus: im Weltall gibt es keine sinnvolle Höhe, und das Boot fährt immer auf 0.
  // Beim Astronauten bleibt sie AN: beim Hüpfen sieht man dort, wie hoch er kommt — auf dem Mond
  // sechsmal so hoch wie auf der Erde, und genau das ist der Reiz daran.
  // Im Schlauchboot faehrt er wie das Feuerwehrboot immer auf der Wasserlinie -> Zeile aus.
  // Im U-BOOT bleibt die Zeile AN — dort ist sie das wichtigste Instrument, nur zeigt sie die
  // TIEFE statt der Hoehe (siehe unten). Beim Feuerwehrboot und im Schlauchboot bleibt sie aus:
  // die fahren immer auf der Wasserlinie.
  if(elAltRow) elAltRow.style.display =
      (locale === 'space' || (isBoat() && !eva) || (eva && eva.boat)) ? 'none' : '';
  // Beschriftung der Zeile mitfuehren: "Tiefe" im U-Boot, sonst "Hoehe". Ohne das stand dort
  // "Hoehe: 80 m", waehrend man 80 m unter Wasser war.
  setTxt(elAltLbl, isSub() ? 'Tiefe' : 'Höhe');
  // Bezugsobjekt: draußen der Astronaut, sonst der Flieger. Vorher stand hier immer state.* — das
  // gehört aber dem STEHENDEN Flieger, das HUD zeigte also dessen Höhe und Tempo 0, während man lief.
  const hp = eva ? eva.group.position : state.pos;
  const altRef = (GROUNDS[locale] || locale === 'death') ? surfaceY(hp.x, hp.z) : 0.3;
  // Im U-Boot die TIEFE unter der Wasseroberflaeche, also der Wert nach unten statt nach oben.
  // Bezug ist die sichtbare Flaeche an SEINER Stelle (seaSurfaceY, Gittermitte = Fahrzeug), nicht
  // die Null-Ebene: bei 1,6 m Duenung waere die Anzeige sonst dauernd um bis zu 1,6 m daneben und
  // zeigte aufgetaucht abwechselnd 0 und 2 m.
  if(isSub() && !eva){
    setTxt(elAlt, Math.max(0, Math.round(seaSurfaceY(0, 0, 0) - state.pos.y)));
  } else {
    setTxt(elAlt, Math.max(0, Math.round(hp.y - altRef)));
  }
  // Im Weltall wird in Warp gerechnet (Warp 1 = 100 % Schub), sonst in km/h.
  if(eva){
    // Zu Fuß: das eigene Lauftempo. Statt des Schubs (der Motor ist draußen aus) steht dort die
    // senkrechte Sprunggeschwindigkeit — beim Hüpfen sieht man sie hochzählen und wieder fallen.
    // Die Beschriftung wechselt mit, „Schub: 12 %" wäre hier irreführend.
    //
    // AM JETPACK IM WELTALL zählt Warp, nicht km/h — genau wie beim Flieger. Dort fliegt man mit
    // SPACE_C * warpFactor(), also bis 30.000 m/s: das sind 108 Millionen km/h, eine Zahl, die
    // niemandem etwas sagt. Der EVA-Zweig schrieb bisher immer km/h, weil die Warp-Anzeige nur im
    // Flieger-Zweig stand.
    if(eva.jet && locale === 'space'){
      setTxt(elSpd, 'Warp ' + (eva.jetVel ? (eva.jetVel.length()/SPACE_C).toFixed(1) : '0.0'));
      setTxt(elSpdU, '');
    } else {
      setTxt(elSpd, Math.round(evaSpeedKmh()));
      setTxt(elSpdU, ' km/h');
    }
    // Statt des Schubs (der Motor ist draußen aus) die SPRUNGWEITE: während des Sprungs wächst sie
    // mit, nach der Landung bleibt der erreichte Wert stehen. Vom Dach der Mondbasis wird das
    // richtig weit, weil dort nur ein Sechstel der Erdanziehung bremst.
    //
    // Das gilt aber nur, solange er WIRKLICH zu Fuß ist. In jedem Fahrzeug — Schlauchboot, Rover
    // und Jetpack — wird nicht gehüpft (siehe evaJump), dort ist die Sprungweite eine tote Zahl.
    // Gemeldet wurde genau das: der Rover zeigte „Sprung", obwohl man gerade mit 100 km/h fährt.
    // In allen drei Fahrzeugen steht deshalb der Schub in Prozent, wie im Flieger.
    // Die Schubquelle unterscheidet sich: das Boot fährt mit eva.boatThr (eigener Gashebel, damit
    // A rückwärts fahren kann), Rover und Jetpack regeln direkt über state.throttle.
    if(eva.boat || eva.rover || eva.jet){
      const thrQuelle = eva.boat ? (eva.boatThr || 0) : (state.throttle || 0);
      setTxt(elThr, Math.round(Math.abs(thrQuelle) * 100));
      setTxt(elThrLbl, 'Schub');
      setTxt(elThrU, ' %');
    } else {
      setTxt(elThr, evaJumpDist.toFixed(1));
      setTxt(elThrLbl, 'Sprung');
      setTxt(elThrU, ' m');
    }
  } else {
    setTxt(elThrLbl, 'Schub');
    setTxt(elThrU, ' %');
    setTxt(elThr, Math.round(state.throttle*100));
    if(locale === 'space'){
      setTxt(elSpd, 'Warp ' + (state.vel.length()/SPACE_C).toFixed(1));
      setTxt(elSpdU, '');
    } else {
      setTxt(elSpd, Math.round(state.vel.length()*3.6));
      setTxt(elSpdU, ' km/h');
    }
  }
  // Nur Symbole (Joshi kann noch nicht lesen): 🪂 Schleudersitz, 🚒 Feuerwehr,
  // 💧-Reihe = Tankfüllung, 🔥 = aktives Feuer.
  let s = '';
  if(eva){
    // Draußen: Symbol zeigt, was B jetzt tut — einsteigen (nah am Flieger) oder hüpfen.
    // Im Schlauchboot gilt keins von beidem: dort faehrt man, bis Land kommt (dann steigt er von
    // allein aus), also steht dort das Boot selbst.
    // Nur das SYMBOL, kein Tempo: Rover und Jetpack schrieben es hier noch einmal hin, obwohl die
    // Zeile darüber („km/h") es schon zeigt — gemeldet als doppelte Geschwindigkeitsanzeige. Die
    // Symbolreihe sagt, WAS man gerade ist; die Zahlen stehen im HUD.
    // Zu Fuß bleibt der Hinweis dahinter: ✈️ heißt „hier kannst du mit Y einsteigen", ⤒ heißt hüpfen.
    // AM JETPACK die Schub-Phase, mit genau denselben Zeichen wie beim X-Wing (siehe dort):
    // ⏬ schnell sinken (0 %) · ⬇️ ruhig sinken (10 %) · ⬆️ steigen und schweben (20 %) · 🚀 vorwaerts.
    // Vorher stand dort nur 🚀, also sah man den Schubstufen nicht an, was sie tun — und genau die
    // Steig- und Sink-Symbole wurden vermisst. Im Weltall gibt es kein Sinken, dort zaehlt nur die
    // Fahrt, also immer 🚀.
    const jq = state.throttle;
    s = eva.jet ? (locale === 'space' ? '\u{1F680}'
                  : (jq <= 0.001 ? '⏬'
                  : (jq <= VTOL_LAND ? '⬇️' : (jq < VTOL_FWD ? '⬆️' : '\u{1F680}'))))
      : eva.boat ? '🛟'
      : eva.rover ? '🚙'
      : ('🧑‍🚀 ' + ((evaCanBoard() || roverNear() || xwingParkNear() || parkPlaneNear()) ? '✈️' : '⤒'));
  }
  else if(state.ejected || parachute) s = '🪂';
  else if(state.crashed) s = '🚒';
  else {
    // Der Verkehr laeuft immer und die Aufgaben-Umschaltung ist ausgebaut -> keine Schalter-Symbole
    // mehr, nur noch der Zustand des Fahrzeugs selbst.
    if(isXWing()){
      // Schub-Phase: 🛬 am Boden · ⏬ schnell sinken · ⬇️ ruhig sinken · ⬆️ steigen · 🚀 vorwärts
      // Bei 0 % stand hier ⚠️ („Antrieb aus"): das stimmte, solange der Repulsor dort aus war und
      // man wirklich fiel. Jetzt ist 0 % die schnelle LANDUNG, also der doppelte Pfeil — eine
      // Warnung wäre irreführend. Im Weltall gibt es kein Sinken, dort zählt nur die Fahrt.
      const tq = state.throttle;
      s = (state.onGround ? '🛬' : (tq < 0 ? '⚠️'
        : (locale === 'space' ? '🚀'
        : (tq <= 0.001 ? '⏬'
        : (tq <= VTOL_LAND ? '⬇️' : (tq < VTOL_FWD ? '⬆️' : '🚀'))))));
    } else if(isSub()){
      // Aufgetaucht oder getaucht — das ist im U-Boot die Information, die man braucht, und man
      // sieht sie nicht immer am Bild (getaucht dicht unter der Oberflaeche sieht aus wie
      // aufgetaucht). state.onGround setzt stepSub genau darauf: es liegt auf der Wasserlinie.
      s = '\u{1F6E5}\u{FE0F}' + (state.onGround ? '' : ' \u{1F30A}');
    } else if(isBoat()){
      // Das Boot schöpft aus dem Meer, unter dem es fährt -> kein Tank, keine Tropfen-Anzeige.
      s = (boatSpray_ ? '💦' : '🚤');
      if(fire) s += ' 🔥';
    } else if(isCanadair()){
      s = (waterDrop ? '💦' : (repeatSym('💧', state.water*4, 4) || '·'));   // 0..4 Tropfen
      if(fire) s += ' 🔥';
    } else if(isTransall()){
      s = (repeatSym('📦', crateLoad, CRATE_MAX) || '·');   // geladene Kisten
    } else if(isAirbus()){
      s = (repeatSym('🧍', paxLoad, PAX_MAX) || '·');       // eingestiegene Menschen
    }
  }
  // Ort voranstellen: 🚀 Weltall · 🌙 Mond (auf der Erde kein Extra-Symbol).
  // Im Weltall zählt 💥 die zerstörten Asteroiden mit.
  // Die großen Symbole über dem Flieger blitzen nur kurz auf (updateSpaceHint). Damit die Suchhilfe
  // nicht verloren geht, steht Ort und Entfernung zum angeflogenen Körper dauerhaft klein hier.
  let nav = '';
  if(locale === 'space'){
    const aim = aimedBody();
    nav = '🚀' + ((aim && aim.def.sym) ? ' ' + aim.def.sym + Math.round(aim.dist/1000) + 'km' : '');
  } else if(GROUNDS[locale]){ const hb = bodyOf(locale); nav = hb ? hb.def.sym : '🌙'; }
  else if(locale === 'death') nav = '🛰️';
  setTxt(elStat, nav ? (nav + ' ' + s) : s);
}

// ---------- Radar/Kompass (rechts, immer sichtbar) ----------
// Zeigt Flieger (Mitte, Nase nach oben) + Ziel-Blip (Richtung/Distanz, Ampelfarbe).
// In der Inselwelt ist der Blip die nächste brennende Stelle, im Weltall der angeflogene Körper.
const radarCv = document.getElementById('radar');
const radarCtx = radarCv.getContext('2d');
// Radar-Ziele im Weltall: alles, was man anfliegen kann — Mond, Mars, Erde, ISS und Todesstern,
// jedes in eigener Farbe, damit man sie auseinanderhält. Sonne und Star Destroyer bleiben bewusst
// draußen, sonst wird die Scheibe zu voll. Rückgabe: Liste von {x,z,col}.
const SPACE_BLIP_COL = { moon:'#dddddd', mars:'#ff7744', death:'#aa88ff', earth:'#44aaff', iss:'#ffdd44' };
function spaceTargets(){
  const out = [];
  if(!spacePlaced) return out;
  for(const b of bodies){
    const col = SPACE_BLIP_COL[b.def.key];
    if(!col) continue;                                  // Sonne hat keine Farbe -> nicht aufs Radar
    if(b.def.key === locale) continue;                  // darauf steht man gerade
    out.push({ x:b.center.x, z:b.center.z, col });
  }
  out.push({ x:earthHome.x, z:earthHome.z, col:SPACE_BLIP_COL.earth });
  if(issObj && issObj.visible) out.push({ x:issCenter.x, z:issCenter.z, col:SPACE_BLIP_COL.iss });
  return out;
}
// Zu Fuss und im Rover zeigt das Radar die FAHRZEUGE. Auf Mond und Mars sind das bis zu drei Dinge,
// deshalb ein Array (updateRadar kann das schon, siehe spaceTargets):
//   X-Wing weiss, Mars-Rover orange, Lunar Rover blau.
// Im Rover bleibt nur der X-Wing uebrig — man sitzt ja im anderen Fahrzeug.
// Auf der ERDE bleibt es beim einen weissen Punkt fuer den eigenen Flieger: dort steht auf jeder
// Insel ein X-Wing, es braucht keine Fuehrung zu einem bestimmten.
const FOOT_COL = { xwing:'#ffffff', mars:'#ffb060', moon:'#6fb8ff' };
function footTargets(){
  const out = [];
  // Am Jetpack ist man im WELTALL (locale === 'space'), also zeigt das Radar dasselbe wie im
  // Flieger: Mond, Mars, Erde, ISS und Todesstern, jedes in eigener Farbe. Das ist der Rueckweg —
  // man fliegt den Todesstern an und dockt an. Dafuer musste hier nichts gebaut werden, die Abfrage
  // steht schon in updateRadar/spaceTargets; sie greift automatisch, weil der Ort stimmt.
  if(locale === 'moon' || locale === 'mars'){
    const xs = xwingSpot[locale];
    if(xs) out.push({ x:xs.x, z:xs.z, col:FOOT_COL.xwing });
    else out.push({ x:eva.planeAt.x, z:eva.planeAt.z, col:FOOT_COL.xwing });
    // das Fahrzeug nur, solange man NICHT darin sitzt
    if(!eva.rover){
      const rs = roverSpot[locale];
      if(rs && roverObjFor(locale)) out.push({ x:rs.x, z:rs.z, col:FOOT_COL[locale] });
    }
    return out;
  }
  return [{ x:eva.planeAt.x, z:eva.planeAt.z, col:FOOT_COL.xwing }];
}
function activeTarget(){
  // Draußen unterwegs: das Radar zeigt, wo die Fahrzeuge stehen. Sonst findet man sie nach ein paar
  // Hundert Metern nicht mehr wieder. Brände bleiben weg: zu Fuß kann man ohnehin nichts löschen.
  if(eva) return footTargets()[0];
  if(locale === 'space'){          // im Weltall immer der nächste Himmelskörper
    let best = null, bd = Infinity;
    for(const b of bodies){
      if(!b.obj) continue;
      const d = state.pos.distanceTo(b.center);
      if(d < bd){ bd = d; best = b; }
    }
    return best ? { x:best.center.x, z:best.center.z, col:'#88ccff' } : null;
  }
  // In der Inselwelt zeigt das Radar die naechstgelegene BRENNENDE Stelle — bewusst nur eine,
  // sonst wird die Scheibe zu voll. Es zaehlt das eigene Feuer (updateFire) genauso wie die Braende
  // der KI-Canadairs (aiFires), denn beide lassen sich loeschen. Rot = noch kein Wasser an Bord,
  // gruen = geladen.
  const nf = nearestFireXZ();
  if(nf) return { x:nf.x, z:nf.z, col:(state.water>0 ? '#33cc44' : '#cc4444') };
  return null;
  // ---- ab hier unerreichbar (frueheres Missions-Radar) ----
  if(isTransall() && cargoTarget) return {x:cargoTarget.x, z:cargoTarget.z, col:(crateLoad>0?'#e8c020':'#cc4444')};
  if(isAirbus() && paxTarget) return {x:paxTarget.x, z:paxTarget.z, col:(paxLoad>=PAX_MAX?'#e8c020':'#cc4444')};
  return null;
}
// ---- PERISKOP-ANSICHT statt Radar, solange man getaucht ist ------------------------------------
// Gewuenscht: "wäre es nett wenn unter wasser das radar aus ist, aber man an der stelle vielleicht
// wie bei einem periskop klein sieht was oben ist. man weiß nicht, ist man im offenen meer, steuert
// man auf eine insel zu. unter wasser sind die vielen inseln eher schwierig."
//
// Das ist ein echtes Orientierungsproblem: unter Wasser sieht man 165 m weit, eine Insel ist aber
// erst ab dem Schelf zu erkennen, und der beginnt Hunderte Meter vom Ufer. Man faehrt also blind.
// Das normale Radar hilft nicht — es zeigt Feuer-Ziele und Fahrzeuge, keine Kueste.
//
// Die Periskop-Scheibe zeigt dafuer genau das, was fehlt: wo Land ist. Sie tastet die Umgebung in
// einem Raster ab (isOnLand/isOnBeach) und malt Inseln als gruene Flecken auf blaues Wasser, mit
// dem eigenen Kurs nach oben — dieselbe Konvention wie beim Radar, damit man nicht umdenken muss.
const PERI_R      = 1400;   // m Reichweite. Bewusst weit: eine Insel soll auftauchen, BEVOR man am
                            // Schelf ist, sonst kommt die Warnung zu spaet. 1.400 m sind knapp zwei
                            // Zellen, also immer mindestens eine Nachbarinsel im Bild.
const PERI_RASTER = 26;     // Abtastpunkte je Achse. 26x26 = 676 isOnLand-Abfragen — deshalb wird
                            // die Scheibe nicht jeden Frame neu gerechnet (siehe periT).
const PERI_RATE   = 0.4;    // s zwischen zwei Neuberechnungen. Bei 50 km/h faehrt man in dieser Zeit
                            // 5,6 m, das Bild ist also praktisch aktuell.
let periT = 0, periDaten = null, periKurs = 0;
function updatePeriscope(dt){
  const drin = isSub() && !eva && locale === 'earth' && uwCamBlend > 0.5;
  // Umschalten: getaucht das Periskop, sonst das normale Radar. Beide teilen dieselbe Canvas —
  // zwei Instrumente an derselben Stelle waeren doppelter Platzbedarf fuer denselben Zweck.
  if(!drin){ periDaten = null; return false; }
  periT -= dt;
  if(periT <= 0 || !periDaten){
    periT = PERI_RATE;
    // Kurs merken: die Karte wird gedreht gezeichnet, damit "oben" die Fahrtrichtung ist.
    const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
    periKurs = Math.atan2(fwd.x, fwd.z);
    // Umgebung abtasten. In WELTkoordinaten, achsenparallel — die Drehung passiert erst beim Malen.
    const N = PERI_RASTER;
    if(!periDaten) periDaten = new Uint8Array(N*N);
    for(let iz=0; iz<N; iz++) for(let ix=0; ix<N; ix++){
      const wx = state.pos.x + ((ix/(N-1))*2-1)*PERI_R;
      const wz = state.pos.z + ((iz/(N-1))*2-1)*PERI_R;
      // 2 = Land, 1 = Strand (Flachwasser, hier wird es eng), 0 = Wasser.
      periDaten[iz*N+ix] = isOnLand(wx, wz) ? 2 : (isOnBeach(wx, wz) ? 1 : 0);
    }
  }
  // ---- Malen. Dieselbe Scheibe wie das Radar, damit die Anzeige an ihrem Platz bleibt.
  const W=radarCv.width, H=radarCv.height, cx=W/2, cy=H/2, R=W/2-6;
  const g = radarCtx;
  g.clearRect(0,0,W,H);
  // Wasser als Grund, in der Farbe, die man auch draussen sieht.
  g.fillStyle='rgba(20,70,90,0.85)';
  g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.fill();
  // Auf die Scheibe beschneiden, sonst malt das Raster ueber den Rand hinaus.
  g.save();
  g.beginPath(); g.arc(cx,cy,R-1,0,Math.PI*2); g.clip();
  const N = PERI_RASTER;
  // Ein Rasterpunkt deckt so viele Pixel ab. Mit +1 gemalt, damit keine Luecken zwischen den
  // Kaestchen bleiben — sonst sieht die Kueste aus wie ein Gitter.
  const px = (R*2)/N + 1;
  // Aus der Radar-Formel hergeleitet (siehe der Kommentar am Kopf dieser Funktion), damit beide
  // Anzeigen garantiert gleich herum sind. Meine erste, frei hingeschriebene Drehmatrix war
  // links-rechts gespiegelt: die Bildschirm-y-Achse zeigt nach unten, und das kehrt den Drehsinn um.
  const cosK = Math.cos(periKurs), sinK = Math.sin(periKurs);
  for(let iz=0; iz<N; iz++) for(let ix=0; ix<N; ix++){
    const v = periDaten[iz*N+ix];
    if(!v) continue;
    // Rasterpunkt -> Meter relativ zum Boot -> Bildpunkt, dabei um den Kurs gedreht.
    const rx = ((ix/(N-1))*2-1)*PERI_R, rz = ((iz/(N-1))*2-1)*PERI_R;
    const dx = sinK*rz - cosK*rx;           // wie bx = sin(head - worldAng) im Radar
    const dz = cosK*rz + sinK*rx;           // wie -by = cos(head - worldAng)
    const bx = cx + (dx/PERI_R)*(R-2);
    const by = cy - (dz/PERI_R)*(R-2);      // minus, weil "oben" im Bild vorne ist
    g.fillStyle = v===2 ? '#5aa845' : '#d8cf9a';   // Land gruen, Strand sandfarben
    g.fillRect(bx-px/2, by-px/2, px, px);
  }
  g.restore();
  // ---- WRACKS als rote Punkte. Sie kommen aus wreckInfo, das deterministisch ist — eine Zelle
  // liefert ihr Wrack also auch dann, wenn sie noch nicht gebaut wurde. Damit reicht die Anzeige
  // weiter als die Unterwasserwelt (UW_VIEW_CELLS 2 Zellen) und man kann gezielt hinfahren.
  //
  // Abgesucht werden die Zellen im Periskop-Radius. Bei PERI_R 1.400 m und CELL 850 m sind das
  // 5x5 Zellen — 25 wreckInfo-Abfragen, und die sind billig (cellRnd plus ein seabedY).
  const pcx = Math.round(state.pos.x / CELL), pcz = Math.round(state.pos.z / CELL);
  const span = Math.ceil(PERI_R / CELL) + 1;
  for(let dz=-span; dz<=span; dz++) for(let dx=-span; dx<=span; dx++){
    // Eine Zelle kann mehrere Wracks tragen (WRECK_TRIES), also alle durchgehen.
    for(const wi of wreckInfos(pcx+dx, pcz+dz)){
      const rx = wi.wx - state.pos.x, rz = wi.wz - state.pos.z;
      // Etwas enger als PERI_R, damit der Punkt (3 bis 4,5 px Radius) ganz in der Scheibe bleibt:
      // er wird ohne Clipping gemalt, weil er UEBER dem Gelaenderaster liegen soll.
      if(Math.hypot(rx, rz) > PERI_R*0.94) continue;
      // Dieselbe Drehung wie das Gelaenderaster darueber, damit Wrack und Kueste zusammenpassen.
      const wdx = sinK*rz - cosK*rx;
      const wdz = cosK*rz + sinK*rx;
      const wx2 = cx + (wdx/PERI_R)*(R-2);
      const wy2 = cy - (wdz/PERI_R)*(R-2);
      // Grossfunde (das volle Schiffsmodell) etwas groesser und heller: sie sind die lohnendere
      // Fahrt, und man soll vorher sehen, ob es sich um einen kleinen oder grossen Fund handelt.
      const rad = wi.gross ? 4.5 : 3;
      g.fillStyle = wi.gross ? '#ff5544' : '#c03828';
      g.beginPath(); g.arc(wx2, wy2, rad, 0, Math.PI*2); g.fill();
      // Dunkler Rand, damit der Punkt auf gruener Insel und blauem Wasser gleich gut zu sehen ist.
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1; g.stroke();
    }
  }
  // Rand und eigenes Boot in der Mitte, wie beim Radar.
  g.strokeStyle='rgba(255,255,255,0.6)'; g.lineWidth=2;
  g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.stroke();
  g.fillStyle='#ffffff';
  g.beginPath();
  g.moveTo(cx,cy-7); g.lineTo(cx-5,cy+6); g.lineTo(cx+5,cy+6);
  g.closePath(); g.fill();
  // Periskop-Symbol, damit klar ist, dass hier etwas anderes steht als sonst.
  g.font='11px system-ui,sans-serif';
  g.fillStyle='rgba(255,255,255,0.85)';
  g.textAlign='center';
  g.fillText('\u{1F52D}', cx, H-6);
  return true;
}
function updateRadar(){
  // GETAUCHT zeigt die Scheibe eine Periskop-Karte statt der Ziel-Blips (siehe updatePeriscope):
  // unter Wasser sind Feuer und Fahrzeuge belanglos, gebraucht wird die Kueste. Uebernimmt das
  // Periskop, ist hier nichts mehr zu tun.
  if(updatePeriscope(dtCam)) return;
  const W=radarCv.width, H=radarCv.height, cx=W/2, cy=H/2, R=W/2-6;
  radarCtx.clearRect(0,0,W,H);
  // Scheibe
  radarCtx.fillStyle='rgba(10,25,40,0.55)';
  radarCtx.beginPath(); radarCtx.arc(cx,cy,R,0,Math.PI*2); radarCtx.fill();
  radarCtx.strokeStyle='rgba(255,255,255,0.6)'; radarCtx.lineWidth=2;
  radarCtx.beginPath(); radarCtx.arc(cx,cy,R,0,Math.PI*2); radarCtx.stroke();
  // Flieger-Dreieck (Mitte, zeigt nach oben = Flugrichtung)
  radarCtx.fillStyle='#ffffff';
  radarCtx.beginPath();
  radarCtx.moveTo(cx,cy-7); radarCtx.lineTo(cx-5,cy+6); radarCtx.lineTo(cx+5,cy+6);
  radarCtx.closePath(); radarCtx.fill();
  // Ziel-Blips relativ zum Flieger-Kurs. Im Weltall sind es mehrere (Mond, Mars, Erde, ISS,
  // Todesstern), in der Inselwelt genau einer: die nächste brennende Stelle.
  // Der Maßstab unterscheidet sich stark — Inseln liegen Hunderte Meter, Himmelskörper
  // Hunderttausende weit weg —, deshalb je Welt eine eigene Bezugsweite.
  const blips = (locale === 'space') ? spaceTargets()
              : eva ? footTargets()                     // zu Fuss/im Rover: bis zu drei Fahrzeuge
              : (()=>{ const a=activeTarget(); return a ? [a] : []; })();
  if(blips.length){
    // Bezugspunkt und Blickrichtung: normalerweise der Flieger, während der EVA der Astronaut.
    // Sonst zeigte die Scheibe die Richtung, in die das abgestellte Flugzeug schaut — und das
    // Dreieck in der Mitte hätte nichts mit dem zu tun, was man gerade steuert.
    const selfX = eva ? eva.group.position.x : state.pos.x;
    const selfZ = eva ? eva.group.position.z : state.pos.z;
    const head = eva ? eva.yaw + Math.PI
               : (()=>{ const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
                        return Math.atan2(fwd.x, fwd.z); })();
    // Distanz auf den Radarradius abbilden. In der Inselwelt reicht ein linearer Maßstab (alles
    // liegt in derselben Größenordnung). Im Weltall NICHT: dort sind es 2 km bis zur ISS und
    // 900 km bis zur Sonne. Linear gerechnet landeten ISS (10,3 px) und Erde (12,6 px) beide unter
    // dem weißen Flieger-Dreieck in der Mitte — genau deshalb war die ISS nicht zu finden.
    // Logarithmisch bekommt jede Größenordnung denselben Platz: nahe Ziele wandern sichtbar aus
    // der Mitte heraus, ferne bleiben trotzdem unterscheidbar.
    const RMAX = R - 8;
    const radiusFor = (dist)=>{
      // Zu Fuß ist der Maßstab viel kleiner: 500 m sind hier weit (Laufen 6 m/s), während ein
      // Flieger in derselben Zeit Kilometer macht. Ohne eigenen Maßstab klebte das Flugzeug-Blip
      // direkt in der Mitte und man sah nicht, in welche Richtung man laufen muss.
      if(eva) return Math.min(RMAX, dist/500*RMAX + 8);
      if(locale !== 'space') return Math.min(RMAX, dist/2500*RMAX + 10);
      const NEAR = 1000, FAR = 900000;                     // 1 km ... 900 km (Sonne)
      const d = Math.max(NEAR, Math.min(FAR, dist));
      const f = Math.log(d/NEAR) / Math.log(FAR/NEAR);     // 0 (nah) .. 1 (fern)
      return 12 + f * (RMAX - 12);                         // ab 12 px, damit nichts unterm Flieger klebt
    };
    for(const tgt of blips){
      const dx=tgt.x-selfX, dz=tgt.z-selfZ;
      // Zielwinkel relativ zum Kurs; im Radar zeigt "oben" = vorn
      const worldAng=Math.atan2(dx, dz);
      const rel=head-worldAng;   // Ziel rechts -> Blip rechts (nicht spiegelverkehrt)
      const rr=radiusFor(Math.hypot(dx,dz));
      const bx=cx + Math.sin(rel)*rr;
      const by=cy - Math.cos(rel)*rr;
      radarCtx.fillStyle=tgt.col;
      radarCtx.beginPath(); radarCtx.arc(bx,by,5,0,Math.PI*2); radarCtx.fill();
      radarCtx.strokeStyle='rgba(0,0,0,0.5)'; radarCtx.lineWidth=1; radarCtx.stroke();
    }
  }
}

// ---------- Gyroskop / künstlicher Horizont (unter dem Radar) ----------
// Zeigt Fluglage: Nicken (Horizontlinie hoch/runter) + Rollen (Horizont kippt). Grüner Ring +
// "Landelicht", wenn die Lage FÜR EINE SANFTE LANDUNG passt (fast waagerecht, geringe Sinkrate).
const gyroCv = document.getElementById('gyro');
const gyroCtx = gyroCv.getContext('2d');
function updateGyro(){
  const W=gyroCv.width, H=gyroCv.height, cx=W/2, cy=H/2, R=W/2-6;
  const g=gyroCtx; g.clearRect(0,0,W,H);
  // Beim Boot gibt es keine Fluglage und nichts zu landen -> Instrument bleibt leer.
  // Auch im U-Boot: es gibt keine Fluglage und nichts zu landen. Die Tiefe steht im HUD.
  if(isWaterCraft()){ gyroCv.style.display='none'; return; }
  gyroCv.style.display='';
  // Fluglage aus der Orientierung (Nicken/Rollen).
  //
  // AM JETPACK aus eva.jetPitch/jetRoll und eva.jetVel: state.quat und state.vel gehoeren dem
  // stehenden Flieger, und updateJet setzt sie am Boden gar nicht — das Instrument zeigte dort also
  // die Lage eines Fliegers, der irgendwo geparkt ist. Gemeldet als „der jetpack hat aber auch keine
  // verbindung zum gyroskop, ist also noch nicht ueberall ein flieger". Es fliegt wie ein Flieger,
  // also bekommt es auch den kuenstlichen Horizont — mit denselben Grenzen fuers Landefenster.
  const jetAn = !!(eva && eva.jet);
  let pitch, roll, sink, spdK, vTOref;
  if(jetAn){
    pitch = eva.jetPitch;            // + = Nase hoch, dieselbe Vorzeichen-Regel wie beim Flieger
    roll  = eva.jetRoll || 0;
    sink  = eva.jetVel ? -eva.jetVel.y : 0;
    spdK  = eva.jetVel ? eva.jetVel.length() : 0;
    // Bezugstempo fuers Landefenster: beim Flieger die Abhebegeschwindigkeit, am Jetpack die
    // Schwebestufe (20 % von JET_VMAX = 9 m/s). Mal 1,4 wie beim Flieger.
    vTOref = JET_VMAX * VTOL_HOVER;
  } else {
    const e = new THREE.Euler().setFromQuaternion(state.quat,'YXZ');
    pitch = e.x;                     // + = Nase hoch
    roll  = e.z;                     // Querlage
    sink  = -state.vel.y;            // >0 = sinkt
    spdK  = state.vel.length();
    vTOref = spec.vTO;
  }
  // "Sanfte-Landung-Fenster": fast waagerecht + moderate Sinkrate + nicht zu schnell.
  const softOk = Math.abs(pitch) < 0.22 && Math.abs(roll) < 0.22 && sink < 6 && sink > -1 && spdK < vTOref*1.4;
  // Instrument-Ring
  g.save(); g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.clip();
  // Himmel/Boden, um Roll gedreht und um Pitch verschoben (künstlicher Horizont)
  g.translate(cx,cy); g.rotate(-roll);
  const off = Math.max(-R, Math.min(R, pitch*R*1.6));   // Pitch -> Horizont-Verschiebung
  g.fillStyle='#5aa0e0'; g.fillRect(-R, -R+off, 2*R, 2*R);          // Himmel
  g.fillStyle='#6b7a45'; g.fillRect(-R, off,    2*R, 2*R);          // Boden
  g.strokeStyle='#fff'; g.lineWidth=2; g.beginPath(); g.moveTo(-R,off); g.lineTo(R,off); g.stroke();  // Horizontlinie
  g.restore();
  // fester Flieger-Marker in der Mitte (zeigt aktuelle Lage relativ zum Horizont)
  g.strokeStyle='#ffd400'; g.lineWidth=3;
  g.beginPath(); g.moveTo(cx-16,cy); g.lineTo(cx-5,cy); g.moveTo(cx+5,cy); g.lineTo(cx+16,cy);
  g.moveTo(cx,cy-4); g.lineTo(cx,cy); g.stroke();
  // Rahmen: grün wenn Landelage passt, sonst weiß
  g.strokeStyle = softOk ? '#33dd44' : 'rgba(255,255,255,0.7)';
  g.lineWidth = softOk ? 4 : 2;
  g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.stroke();
  if(softOk){ g.fillStyle='#33dd44'; g.beginPath(); g.arc(cx, H-10, 4, 0, Math.PI*2); g.fill(); }  // Landelicht
}

// ---------- Loop ----------
let last=performance.now();
// ==================== KI-Flugverkehr in der Luft ====================
// Ambient-Flieger (deterministisch pro Zelle wie carrierInfo), die EXAKT das tun, was der Spieler
// kann: Airbus landet + Menschen raus/rein, Transall Touchdown+Rollen+Durchstarten+Kistenabwurf,
// Canadair fischt Wasser + löscht Feuer, Mustang Kunstflug. Flügelwackeln bei Nähe, Kondensstreifen.
// Über Trägerzellen: AlphaJet/Mustang fliegen eine gedrehte Deck-Platzrunde und setzen im Touch-and-Go
// kurz auf dem Flugdeck auf (kein Halt); AlphaJet erscheint zusätzlich als ruhiger Reise-Kreis.
// KEINE Kollision, KEIN Radar. Höhe im Reiseflug immer ±Spielerhöhe. Toggle: Taste J oder LB (Standard an).
// Zusätzlich: sporadischer Alpha-Jet-Überschall-Vorbeiflug von hinten.
// Der Flugverkehr laeuft IMMER (kein Schalter mehr, auch kein HUD-Symbol).
let worldClock = 0;                // fortlaufende Zeitbasis (kein Date.now nötig)
const TRAFFIC_ROT = { Canadair: Math.PI, AlphaJet: Math.PI/2, Airbus: Math.PI,
                      Mustang: -Math.PI, Transall: 0 };   // wie GLB_ROT in buildModel
const aiEffects = [];              // eigenständige KI-Kisten/Menschen (wie Spieler-activeCrates/Pax)

// Eigene Material-Instanzen, damit KI nie mit Spieler-Effekten kollidiert.
const aiTrailMat  = new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.4, depthWrite:false });
const aiSprayMat  = new THREE.MeshBasicMaterial({ color:0xdff2ff, transparent:true, opacity:0.55, depthWrite:false });
const aiDropMat   = new THREE.MeshLambertMaterial({ color:0x9fd8ff, transparent:true, opacity:0.7 });
const aiVaporMat  = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false });

// Reiseflughöhe immer im Rahmen der Spielerhöhe (±Offset), aber nie zu tief.
function cruiseAltFor(e){ return Math.max(70, state.pos.y + (e.altOff||0)); }

// ================= Persistente KI-Reise-Flotte =================
// Feste Anzahl Flieger, die ECHTE Punkt-zu-Punkt-Missionen fliegen (wie der Spieler): Canadair
// pendelt Wasser<->Feuer und löscht, Transall lädt an Insel A + wirft an Insel B ab, Airbus holt
// Menschen und fliegt sie WEIT zu einer anderen Bahn, Jet/Mustang reisen (mit Träger-Touch-and-Go).
// Sie reisen mit dem Spieler durch die Welt (Recycling: zu weit weg -> respawn nahebei mit neuer
// Mission). KEINE Kollision, KEINE optischen Missions-Hinweise — nur echtes Verhalten.
const FLEET_COMP = ['Airbus','Airbus','Airbus','Transall','Transall','Canadair','Canadair','Mustang','Mustang','AlphaJet','AlphaJet'];
const FLEET_MODELS = ['Airbus','Transall','Canadair','Mustang','AlphaJet'];
const SPEEDS = { Airbus:60, Transall:52, Canadair:48, Mustang:80, AlphaJet:130 };   // m/s
const TURN   = { Airbus:0.5, Transall:0.55, Canadair:0.6, Mustang:0.9, AlphaJet:0.9 };
const ARRIVE = 45;                 // Ankunftsradius (m) für Wegpunkte
const fleet = [];

// ---- Kurs-/Positions-Helfer ----
function angleDiff(a,b){ let d=(b-a)%(Math.PI*2); if(d>Math.PI)d-=Math.PI*2; if(d<-Math.PI)d+=Math.PI*2; return d; }
function aiForward(e){ return { fx:-Math.sin(e.heading), fz:-Math.cos(e.heading) }; }
function aiCellOf(e){ return { cx:Math.round(e.group.position.x/CELL), cz:Math.round(e.group.position.z/CELL) }; }

// Bewegt e Richtung (tx,tz) auf Zielhöhe ty. Gibt horizontale Restdistanz zurück.
function flyToward(e, tx, tz, ty, dt, speedMul){
  const px=e.group.position.x, pz=e.group.position.z;
  const dx=tx-px, dz=tz-pz, dist=Math.hypot(dx,dz);
  const desired=Math.atan2(dx,dz)+Math.PI;             // Front = -Z (wie faceTowards)
  const diff=angleDiff(e.heading, desired);
  const maxTurn=(e.turn||0.6)*dt;
  e.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));
  const spd=e.spd*(speedMul==null?1:speedMul);
  e.group.position.x += -Math.sin(e.heading)*spd*dt;
  e.group.position.z += -Math.cos(e.heading)*spd*dt;
  e.group.position.y += (ty - e.group.position.y)*Math.min(1, dt*1.2);
  e.group.rotation.y = e.heading;
  // Bank aus Drehrate (tiefpassgefiltert) + Flügelwackeln bei Spielernähe
  const targetBank=Math.max(-0.6, Math.min(0.6, diff*1.4));
  e.bank = (e.bank||0) + (targetBank-(e.bank||0))*Math.min(1,dt*3);
  e.holder.rotation.z = e.bank + waveRoll(e, dt, px, pz);
  e.holder.rotation.x = 0;
  return dist;
}

// ---- KI-Weltsuche (relativ zur KI-Position, analog zu findIslandInCone/spawnFire/nearestWaterXZ) ----
function aiFindIsland(e, pred, opts){
  opts=opts||{};
  const c=aiCellOf(e), minCells=opts.minCells||0, R=opts.R||2, useCone=!!opts.cone;
  const {fx,fz}=aiForward(e), COS=Math.cos((opts.coneDeg||70)*Math.PI/180);
  const px=e.group.position.x, pz=e.group.position.z;
  let best=null, bd=1e9;
  for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){
    if(minCells && Math.max(Math.abs(dx),Math.abs(dz))<minCells) continue;
    const cx=c.cx+dx, cz=c.cz+dz, info=islandInfo(cx,cz); if(!info) continue;
    if(!pred(info,cx,cz)) continue;
    const rx=info.wx-px, rz=info.wz-pz, d=Math.hypot(rx,rz); if(d<60) continue;
    if(useCone && (rx*fx+rz*fz)/(d||1) < COS) continue;
    if(d<bd){ bd=d; best={info,cx,cz,d}; }
  }
  return best;
}
function aiFindRunwayIsland(e, exCx, exCz){
  const pred=(info,cx,cz)=> cellRnd(cx,cz,99)>=0.10 && !(cx===exCx&&cz===exCz);  // keine Wolkenkratzer-Stadt
  return aiFindIsland(e, pred, {cone:true, R:3}) || aiFindIsland(e, pred, {R:3});
}
function aiFindCargoTarget(e, exCx, exCz){
  const pred=(info,cx,cz)=> info.radius<230 && cellRnd(cx,cz,99)>=0.10 && !(cx===exCx&&cz===exCz);
  return aiFindIsland(e, pred, {cone:true, R:3}) || aiFindIsland(e, pred, {R:4});
}
function aiFindDistantIsland(e){
  const pred=(info,cx,cz)=> cellRnd(cx,cz,99)>=0.10;   // keine Wolkenkratzer-Stadt als Ziel
  return aiFindIsland(e, pred, {minCells:5, R:9, cone:true}) || aiFindIsland(e, pred, {minCells:5, R:9});
}
// Feuer auf einer Wieseninsel (keine Stadt), Feuerfleck abseits von Bauwerken. Baut e.fireGrp.
function aiFindFireIsland(e){
  const pred=(info,cx,cz)=> cellRnd(cx,cz,99)>=0.10;   // keine Stadt (die brennt nicht)
  const hit=aiFindIsland(e, pred, {cone:true, R:3}) || aiFindIsland(e, pred, {R:3});
  if(!hit) return null;
  const buildings=islandBuildings(hit.cx,hit.cz)||[];
  let fx,fz,ok=false;
  for(let tries=0; tries<20 && !ok; tries++){
    const a=Math.random()*Math.PI*2, rr=hit.info.radius*(0.35+Math.random()*0.4);
    const lx=Math.cos(a)*rr, lz=Math.sin(a)*rr; ok=true;
    for(const b of buildings){ if(Math.hypot(lx-b.x, lz-b.z)<40){ ok=false; break; } }
    if(ok){ fx=hit.info.wx+lx; fz=hit.info.wz+lz; }
  }
  if(!ok) return null;
  const g=new THREE.Group();
  for(let i=0;i<6;i++){
    const fl=new THREE.Mesh(new THREE.ConeGeometry(1.6,5,6), flameMat);
    fl.position.set((Math.random()-0.5)*8, ISLAND_Y+2.5, (Math.random()-0.5)*8); g.add(fl);
  }
  g.position.set(fx,0,fz); scene.add(g); e.fireGrp=g; registerAiFire(e, g, fx, fz);
  return { x:fx, z:fz };
}
// Nächste Wasserstelle (analog nearestWaterXZ, aber um die KI-Position).
function aiNearestWater(e){
  const px=e.group.position.x, pz=e.group.position.z;
  if(!isOnLand(px,pz)){ const {fx,fz}=aiForward(e); return { x:px+fx*400, z:pz+fz*400 }; }
  for(let r=90; r<=760; r+=80) for(let a=0;a<8;a++){
    const qx=px+Math.cos(a/8*6.283)*r, qz=pz+Math.sin(a/8*6.283)*r;
    if(!isOnLand(qx,qz)) return { x:qx, z:qz };
  }
  return { x:px+300, z:pz+300 };
}
// Träger in der Nähe (für Jet/Mustang Touch-and-Go).
function aiFindCarrier(e, R){
  const c=aiCellOf(e); R=R||3;
  const px=e.group.position.x, pz=e.group.position.z; let best=null,bd=1e9;
  for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){
    const car=carrierInfo(c.cx+dx, c.cz+dz); if(!car) continue;
    const d=Math.hypot(car.wx-px, car.wz-pz); if(d<bd){ bd=d; best=car; }
  }
  return best;
}
function aiRandomWaypoint(e){
  const a=Math.random()*Math.PI*2, d=CELL*(2+Math.random()*2);
  return { x:e.group.position.x+Math.cos(a)*d, z:e.group.position.z+Math.sin(a)*d };
}
// Zufälliger Punkt um den Spieler in Zell-Radius-Vielfachen (für Spawn/Recycling).
function spawnAroundPlayer(minMul, maxMul){
  const a=Math.random()*Math.PI*2, r=VIEW_CELLS*CELL*(minMul+Math.random()*(maxMul-minMul));
  return { x:state.pos.x+Math.cos(a)*r, z:state.pos.z+Math.sin(a)*r };
}

// ---- Flieger bauen / Mission zuweisen / entfernen ----
function spawnPlane(model, x, z){
  if(!glbTemplates[model]) return null;
  const group=new THREE.Group(), holder=new THREE.Group(); group.add(holder);
  const m=glbTemplates[model].clone(true); m.rotation.y=TRAFFIC_ROT[model]||0; holder.add(m);
  const altOff=(Math.random()-0.5)*90;
  group.position.set(x, Math.max(60, state.pos.y+altOff), z); scene.add(group);
  const wantsTrail=(model==='Airbus'||model==='AlphaJet'||model==='Mustang');
  let trail=null;
  if(wantsTrail){
    const N=36, geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N*3),3));
    const line=new THREE.Line(geo, aiTrailMat); line.frustumCulled=false; scene.add(line);
    trail={ line, pts:[], N };
  }
  let spray=null, drop=null;
  if(model==='Canadair'){
    spray=new THREE.Mesh(new THREE.ConeGeometry(4,6,12,1,true), aiSprayMat); spray.visible=false; group.add(spray);
    drop =new THREE.Mesh(new THREE.CylinderGeometry(0.8,2.4,16,12,1,true), aiDropMat); drop.visible=false; group.add(drop);
  }
  const e={ model, group, holder, trail, spray, drop, altOff,
            spd:SPEEDS[model]||60, turn:TURN[model]||0.6, heading:Math.random()*Math.PI*2,
            bank:0, wave:0, waveCd:3, aeroT:0,
            state:'', timer:0, dst:null, fireXZ:null, fireGrp:null, tank:0,
            crateLoad:0, dropQueue:0, dropTimer:0, paxLoad:0, loadCx:0, loadCz:0,
            onFinal:false, rolling:false, rollRun:0, carrier:null, info:null, rt:null, s:0 };
  assignMission(e);
  return e;
}
function assignMission(e){
  clearAiFire(e);
  if(e.spray) e.spray.visible=false;
  if(e.drop)  e.drop.visible=false;
  e.dst=null; e.fireXZ=null; e.tank=0; e.crateLoad=0; e.dropQueue=0; e.dropTimer=0;
  e.paxLoad=0; e.carrier=null; e.info=null; e.rt=null; e.timer=0; e.onFinal=false; e.rolling=false; e.rollRun=0;
  e.crashT=0; e.wrecked=false; e.chute=null; e.crashFire=null; e.rescue=null;
  if(e.model==='Canadair')      e.state='toWater';
  else if(e.model==='Transall') e.state='toLoad';
  else if(e.model==='Airbus')   e.state='toBoard';
  else                          e.state='cruise';   // Mustang / AlphaJet
}
function removePlane(e){
  // Freigeben wie die Zellen: Kondensstreifen, Sprueh- und Abwurfkegel sind eigene Geometrien je
  // Maschine, das Modell selbst ist geteilt (siehe disposeTree).
  dropFromScene(e.group);
  if(e.trail) dropFromScene(e.trail.line);
  clearAiFire(e);
  if(e.chute){ clearChuteBoat(e.chute); scene.remove(e.chute.group); e.chute=null; }
  if(e.crashFire){ scene.remove(e.crashFire); e.crashFire=null; }
  if(e.rescue){ for(const r of e.rescue){ scene.remove(r.group); scene.remove(r.jet); } e.rescue=null; }
}

// ---- Träger-Touch-and-Go-Delegation für Jet/Mustang (nutzt bestehendes stepCarrier) ----
function enterCarrier(e, car){
  const turnR=70, L=Math.max(220, FORD_LEN+120), rwHalf=FORD_LEN*0.5, P=2*L+2*Math.PI*turnR;
  e.info={ car, wx:car.wx, wz:car.wz, vLin0:e.spd };
  e.rt={ turnR, L, rwHalf, P }; e.s=0; e.timer=P/e.spd + 1.0;   // ~eine Deckrunde
  e.carrier=car; e.state='carrierLap';
}

// ---- Bahnanflug für KI: Anflug ENTLANG der Bahnachse (x=wx, Z-Achse) zur zugewandten Schwelle ----
// Löst zugleich "im Grünen landen" UND das Fahren durch Häuser/Berge: der Bahnkorridor wird von
// islandBuildings bauwerksfrei gehalten -> ein achsentreuer Anflug ist automatisch hindernisfrei.
function aiRunwayApproach(e, info){
  const half=Math.min(260, info.radius*1.4)/2;
  const nearSign=(e.group.position.z >= info.wz) ? 1 : -1;      // dem Flieger zugewandte Schwelle
  return { thx:info.wx, thz:info.wz + nearSign*half,            // Schwelle = Aufsetzpunkt
           apx:info.wx, apz:info.wz + nearSign*(half+260),      // Anflugfixpunkt (auf Achse, weit draußen)
           midx:info.wx, midz:info.wz, half, nearSign, iwz:info.wz };  // Bahnmitte + Seite
}
// 3-Phasen-Landung: (1) hoch auf die Bahnachse einschwenken, (2) Gleitpfad HART an die Distanz
// gekoppelt (kein Absacken) zur Schwelle, (3) auf der Bahn bis zur Mitte ausrollen.
function aiFlyRunway(e, info, dt){
  const a=aiRunwayApproach(e, info), APP=Math.max(cruiseAltFor(e), 90);   // Anflughöhe sicher über Berge
  if(!e.onFinal && !e.rolling){                                // Phase 1: auf die Achse (hoch bleiben)
    const d=flyToward(e, a.apx, a.apz, APP, dt);
    if(d < ARRIVE*1.5) e.onFinal=true;
    return false;
  }
  if(e.onFinal){                                               // Phase 2: Gleitpfad ÜBER die Schwelle zur Mitte
    const dz=Math.abs(e.group.position.z - a.thz);             // Distanz bis zur Schwelle (Höhe daran gekoppelt)
    const glide=ISLAND_Y + Math.min(1, dz/260)*(APP-ISLAND_Y); // Aufsetzhöhe = Boden GENAU an der Schwelle
    flyToward(e, a.midx, a.midz, glide, dt, 0.7);              // Ziel = Bahnmitte -> zieht über die Schwelle
    e.group.position.y = glide;                                // Höhe HART setzen -> exakter Gleitpfad
    // Erst "gelandet"/rollend, wenn die Schwelle WIRKLICH überflogen ist (auf der Bahn).
    if(a.nearSign*(e.group.position.z - a.iwz) <= a.half){ e.onFinal=false; e.rolling=true; }
    return false;
  }
  const d=flyToward(e, a.midx, a.midz, ISLAND_Y, dt, 0.35);    // Phase 3: auf der Bahn zur Mitte ausrollen
  e.group.position.y = ISLAND_Y;
  if(d < ARRIVE){ e.rolling=false; return true; }
  return false;
}
// Start: geradeaus auf der aktuellen Achse (Bahnrichtung) wegrollen/steigen bis über Berghöhe,
// dann erst frei navigieren. Braucht kein Ziel — hält den bauwerksfreien Bahnkorridor.
function aiDepartRunway(e, dt){
  const APP=Math.max(cruiseAltFor(e), 90);
  e.rollRun=(e.rollRun||0) + e.spd*dt;                          // zurückgelegte Startrollstrecke (m)
  const tx=e.group.position.x - Math.sin(e.heading)*400, tz=e.group.position.z - Math.cos(e.heading)*400;
  if(e.rollRun < 130){                                          // Phase A: Bodenlauf (rollt, hebt noch nicht ab)
    flyToward(e, tx, tz, ISLAND_Y, dt, 0.5 + Math.min(0.5, e.rollRun/130));
    e.group.position.y = ISLAND_Y;
    return false;
  }
  const climb=ISLAND_Y + Math.min(1,(e.rollRun-130)/520)*(APP-ISLAND_Y);  // Phase B: flach steigen (streckengekoppelt)
  flyToward(e, tx, tz, climb, dt, 1);
  e.group.position.y = climb;
  if(climb >= APP-2){ e.rollRun=0; return true; }
  return false;
}
// ---- KI-Feuer (Canadair): in aiFires registriert, damit auch der SPIELER es löschen kann ----
const aiFires = [];
function registerAiFire(e, grp, x, z){ aiFires.push({ grp, x, z, r:60, owner:e }); }
function clearAiFire(e){
  if(e.fireGrp){ scene.remove(e.fireGrp); e.fireGrp=null; }
  for(let i=aiFires.length-1;i>=0;i--){ if(aiFires[i].owner===e) aiFires.splice(i,1); }
}

// ---- Missions-Statemachine je Modell ----
function stepMission(e, dt){
  if(e.state==='crash') return;   // Absturz laeuft allein in aiStepCrash -> Missionslogik AUS
  const cruise=cruiseAltFor(e);
  switch(e.model){
    case 'Canadair': {
      if(e.state==='toWater'){
        if(!e.dst) e.dst=aiNearestWater(e);
        const d=flyToward(e, e.dst.x, e.dst.z, isOnLand(e.dst.x,e.dst.z)?cruise:Math.min(cruise,60), dt);
        if(d<ARRIVE){ e.state='tanking'; e.timer=2; e.dst=null; }
      } else if(e.state==='tanking'){
        flyToward(e, e.group.position.x-Math.sin(e.heading)*80, e.group.position.z-Math.cos(e.heading)*80, 12, dt, 0.6);
        if(e.spray){ e.spray.visible=true; e.spray.position.set(0,-3,2); e.spray.rotation.x=Math.PI; }
        e.timer-=dt; if(e.timer<=0){ if(e.spray)e.spray.visible=false; e.tank=1; e.state='toFire'; }
      } else if(e.state==='toFire'){
        if(!e.fireXZ){ const f=aiFindFireIsland(e); if(f){ e.fireXZ=f; } else { const w=aiRandomWaypoint(e); const dd=flyToward(e,w.x,w.z,cruise,dt); return; } }
        const dtF=Math.hypot(e.fireXZ.x-e.group.position.x, e.fireXZ.z-e.group.position.z);
        const ty=dtF<220 ? ISLAND_Y+22 : cruise;
        const d=flyToward(e, e.fireXZ.x, e.fireXZ.z, ty, dt, dtF<220?0.7:1);
        if(d<ARRIVE+15){ e.state='dropFire'; e.timer=1.2; if(e.drop){ e.drop.visible=true; e.drop.position.set(0,-9,0);} clearAiFire(e); }
      } else if(e.state==='dropFire'){
        flyToward(e, e.fireXZ.x, e.fireXZ.z, ISLAND_Y+18, dt, 0.7);
        e.timer-=dt; if(e.timer<=0){ if(e.drop)e.drop.visible=false; e.tank=0; e.fireXZ=null; e.state='cooldown'; e.timer=3; }
      } else { // cooldown
        flyToward(e, e.group.position.x-Math.sin(e.heading)*200, e.group.position.z-Math.cos(e.heading)*200, cruise, dt);
        e.timer-=dt; if(e.timer<=0){ e.state='toWater'; e.dst=null; }
      }
      break;
    }
    case 'Transall': {
      if(e.state==='toLoad'){
        if(!e.dst){ const h=aiFindRunwayIsland(e, 999,999); if(h){ e.dst={info:h.info,cx:h.cx,cz:h.cz}; } else { const w=aiRandomWaypoint(e); flyToward(e,w.x,w.z,cruise,dt); return; } }
        if(aiFlyRunway(e, e.dst.info, dt)){ e.state='loading'; e.loadCx=e.dst.cx; e.loadCz=e.dst.cz; e.crateLoad=0; e.dst=null; }
      } else if(e.state==='loading'){
        e.group.position.y = ISLAND_Y;                        // steht auf der Bahn
        e.crateLoad=Math.min(4, e.crateLoad+dt*2.5);
        if(e.crateLoad>=4){ e.state='depart'; e.rollRun=0; }
      } else if(e.state==='depart'){
        if(aiDepartRunway(e, dt)){ e.state='toTarget'; e.dst=null; }
      } else if(e.state==='toTarget'){
        if(!e.dst){ const h=aiFindCargoTarget(e, e.loadCx, e.loadCz); if(h){ e.dst={x:h.info.wx,z:h.info.wz}; } else { const w=aiRandomWaypoint(e); flyToward(e,w.x,w.z,cruise,dt); return; } }
        const d=flyToward(e, e.dst.x, e.dst.z, ISLAND_Y+30, dt);
        if(d<ARRIVE+20){ e.state='dropping'; e.dropQueue=Math.max(2,Math.floor(e.crateLoad)||2); e.crateLoad=0; e.dropTimer=0; }
      } else if(e.state==='dropping'){
        flyToward(e, e.group.position.x-Math.sin(e.heading)*200, e.group.position.z-Math.cos(e.heading)*200, ISLAND_Y+30, dt);
        e.dropTimer-=dt; if(e.dropTimer<=0 && e.dropQueue>0){ aiDropCrate(e); e.dropQueue--; e.dropTimer=0.35; }
        if(e.dropQueue<=0){ assignMission(e); }
      }
      break;
    }
    case 'Airbus': {
      if(e.state==='toBoard'){
        if(!e.dst){ const h=aiFindRunwayIsland(e, 999,999); if(h){ e.dst={info:h.info,cx:h.cx,cz:h.cz}; } else { const w=aiRandomWaypoint(e); flyToward(e,w.x,w.z,cruise,dt); return; } }
        if(aiFlyRunway(e, e.dst.info, dt)){ e.state='boarding'; e.timer=2; e.dst=null; }
      } else if(e.state==='boarding'){
        e.group.position.y = ISLAND_Y;                        // steht auf der Bahn
        e.timer-=dt; e.paxLoad=Math.min(4, (2-e.timer)/2*4);
        if(e.timer<=0){ e.paxLoad=4; e.state='depart'; e.rollRun=0; }
      } else if(e.state==='depart'){
        if(aiDepartRunway(e, dt)){ e.state='toFar'; e.dst=null; }
      } else if(e.state==='toFar'){
        if(!e.dst){ const h=aiFindDistantIsland(e); if(h){ e.dst={info:h.info,cx:h.cx,cz:h.cz}; } else { const w=aiRandomWaypoint(e); flyToward(e,w.x,w.z,cruise,dt); return; } }
        const d=flyToward(e, e.dst.info.wx, e.dst.info.wz, cruise, dt);
        if(d < e.dst.info.radius+400){ e.state='landing'; e.onFinal=false; e.rolling=false; }
      } else if(e.state==='landing'){
        if(aiFlyRunway(e, e.dst.info, dt)){ aiPaxSequence(e); e.state='unload'; e.timer=5; e.dst=null; }
      } else if(e.state==='unload'){
        e.group.position.y += (ISLAND_Y-e.group.position.y)*Math.min(1,dt*3);
        e.timer-=dt; if(e.timer<=0){ e.paxLoad=0; assignMission(e); }
      }
      break;
    }
    default: {   // Mustang & AlphaJet: reisen + (Jet/Mustang) Träger-Touch-and-Go
      if(e.state==='carrierLap'){
        stepCarrier(e, dt);
        // Auf der Platzrunde faehrt der Jet auf Deckhoehe — dort steht kein Traeger im Weg (er
        // kreist ja darum), aber sehr wohl ein 47 m hohes Containerschiff. Genau dort flog er
        // hindurch, weil die allgemeine Hindernisvermeidung in diesem Zustand nicht laeuft (und
        // nicht laufen darf, siehe AI_AVOID_STATES). Also hier eigens nachsehen.
        const {fx:cfx, fz:cfz} = aiForward(e);
        const shTop = aiShipAhead(e.group.position.x, e.group.position.z, cfx, cfz,
                                  Math.max(140, e.spd*1.7), e.group.position.y);
        if(shTop){ e.carrier=null; e.info=null; e.rt=null; e.heading=e.group.rotation.y; aiCrash(e, shTop); break; }
        e.timer-=dt; if(e.timer<=0){ e.carrier=null; e.info=null; e.rt=null; e.heading=e.group.rotation.y; e.state='cruise'; e.dst=null; }
        break;
      }
      if(!e.dst){
        const car=(Math.random()<0.5)?aiFindCarrier(e,3):null;
        if(car){ e.dst={x:car.wx,z:car.wz,carrier:car}; }
        else { e.dst=aiRandomWaypoint(e); }
      }
      const d=flyToward(e, e.dst.x, e.dst.z, cruise, dt);
      // Mustang: unterwegs Kunstflug (Rolle + Looping) via Zeitfenster
      if(e.model==='Mustang'){
        e.aeroT+=dt; const u=(e.aeroT%16)/16, lo=winWin(u,0.35,0.45,0.55,0.65);
        e.holder.rotation.x = lo*Math.PI*2;                    // Looping (Bank kommt aus flyToward)
      }
      if(d<ARRIVE+40){
        if(e.dst && e.dst.carrier){ enterCarrier(e, e.dst.carrier); }
        else { e.dst=null; }
      }
      break;
    }
  }
}

// ================= (behalten) Träger-Touch-and-Go: Deck-Platzrunde =================
// ---- Position auf der Platzrunde (Racetrack) ----
function rtPoint(e, s){
  const info=e.info, R=e.rt.turnR, L=e.rt.L, wx=info.wx, wz=info.wz;
  const t1=L, t2=L+Math.PI*R, t3=2*L+Math.PI*R;
  if(s < t1)      return { x:wx,           z:wz+L/2 - s,                 seg:0 };          // Landebahn (-Z)
  if(s < t2){ const a=Math.PI-(s-t1)/R; return { x:(wx+R)+R*Math.cos(a), z:(wz-L/2)-R*Math.sin(a), seg:1 }; }
  if(s < t3)      return { x:wx+2*R,       z:(wz-L/2)+(s-t2),            seg:2 };          // Gegenanflug (+Z)
  const a=(s-t3)/R; return { x:(wx+R)+R*Math.cos(a), z:(wz+L/2)+R*Math.sin(a), seg:3 };
}
function rtAltCarrier(e, p, cruise){
  if(p.seg!==0) return cruise;                       // Kurven/Gegenanflug: Reiseflug
  const zRel=p.z - e.info.wz, L=e.rt.L, touch=24;    // nur ±24 m um die Deckmitte am Deck
  const az=Math.abs(zRel);
  if(az <= touch) return fordDeckY;                  // Aufsetzfenster (Touch)
  const t=Math.min(1,(az-touch)/(L/2-touch));
  return fordDeckY + t*(cruise-fordDeckY);           // Anflug/Steigflug: Deck<->Reiseflug
}
function stepCarrier(e, dt){
  const cruise=cruiseAltFor(e), P=e.rt.P, car=e.info.car;
  const cs=Math.cos(car.rot), sn=Math.sin(car.rot);
  const p0=rtPoint(e, e.s);
  // beim Deck-Überflug langsamer, damit der Jet das kurze Deck nicht überschießt
  const overDeck=(p0.seg===0 && Math.abs(p0.z-e.info.wz)<=e.rt.rwHalf);
  e.s=(e.s + (overDeck ? e.info.vLin0*0.45 : e.info.vLin0)*dt) % P;
  const p=rtPoint(e, e.s);
  const lx=p.x-e.info.wx, lz=p.z-e.info.wz;           // lokale Deltas -> um rot in die Welt drehen
  const wxp=car.wx + lx*cs + lz*sn, wzp=car.wz - lx*sn + lz*cs;
  const alt=rtAltCarrier(e, p, cruise);
  const cy=e.group.position.y||alt;
  e.group.position.set(wxp, cy+(alt-cy)*Math.min(1,dt*3), wzp);
  const pn=rtPoint(e, (e.s+2)%P);                    // Blickpunkt voraus (ebenfalls gedreht)
  const lnx=pn.x-e.info.wx, lnz=pn.z-e.info.wz;
  faceTowards(e.group, car.wx+lnx*cs+lnz*sn, car.wz-lnx*sn+lnz*cs);
  e.holder.rotation.z=waveRoll(e, dt, wxp, wzp);     // Flügelwackeln bei Spielernähe
  e.holder.rotation.x=0;
}

// Flügelwackeln: gibt zusätzlichen Roll zurück, wenn der Spieler nah ist.
function waveRoll(e, dt, x, z){
  e.waveCd-=dt;
  const near=Math.hypot(x-state.pos.x, z-state.pos.z)<260 && Math.abs((e.group.position.y||0)-state.pos.y)<200;
  if(near && e.wave<=0 && e.waveCd<=0){ e.wave=1.5; e.waveCd=9; }
  if(e.wave>0){ e.wave-=dt; return Math.sin(e.wave*22)*0.5; }
  return 0;
}

// Trapez-Fenster 0..1..0.
function winWin(u,a,b,c,d){ if(u<=a||u>=d)return 0; if(u<b)return (u-a)/(b-a); if(u>c)return 1-(u-c)/(d-c); return 1; }

// ---- KI-Effekte: echte Kisten (mit Fallschirm) + Menschen, exakt wie beim Spieler ----
function aiDropCrate(e){
  const back=new THREE.Vector3(0,0,1); back.applyEuler(new THREE.Euler(0,e.group.rotation.y,0));
  const g=makeCrate();
  g.position.set(e.group.position.x+back.x*6, e.group.position.y-2, e.group.position.z+back.z*6);
  scene.add(g);
  aiEffects.push({ obj:g, vy:-2, vx:0, vz:0, landed:0, update(dt){
    this.vy=Math.max(this.vy-4*dt,-6);
    this.obj.position.y+=this.vy*dt;
    const gy=isOnLand(this.obj.position.x,this.obj.position.z)?ISLAND_Y:0;
    if(this.obj.position.y<=gy+1.5){ this.obj.position.y=gy+1.5; this.landed+=dt; if(this.landed>4) return false; }
    return true;
  }});
}
function aiPaxSequence(e){
  // 3 Menschen raus (gestaffelt), dann 3 rein — wie updatePax, aber am KI-Airbus verankert.
  const right=new THREE.Vector3(1,0,0); right.applyEuler(new THREE.Euler(0,e.group.rotation.y,0));
  const bx=e.group.position.x, bz=e.group.position.z, away=14;
  for(let i=0;i<3;i++){
    aiEffects.push(makePaxWalker(bx+right.x*3, bz+right.z*3, right.x, right.z, away, 'out', 0.3*i));
    aiEffects.push(makePaxWalker(bx+right.x*3, bz+right.z*3, right.x, right.z, away, 'in', 2.5+0.3*i));
  }
}
function makePaxWalker(x,z,rx,rz,away,phase,delay){
  const g=makePerson(); g.position.set(phase==='out'?x:x+rx*away, ISLAND_Y, phase==='out'?z:z+rz*away);
  g.visible=false; scene.add(g);
  return { obj:g, t:-delay, update(dt){
    this.t+=dt; if(this.t<0){ return true; } this.obj.visible=true;
    const f=Math.min(1,this.t/1.5), dist=phase==='out'?f*away:(1-f)*away;
    this.obj.position.set(x+rx*dist, ISLAND_Y, z+rz*dist);
    if(this.t>1.6){ scene.remove(this.obj); return false; }
    return true;
  }};
}
function updateAiEffects(dt){
  for(let i=aiEffects.length-1;i>=0;i--){ if(!aiEffects[i].update(dt)){ scene.remove(aiEffects[i].obj); aiEffects.splice(i,1); } }
}
function clearAiEffects(){ for(const e of aiEffects) scene.remove(e.obj); aiEffects.length=0; }

function trafficTrail(e){
  const tr=e.trail; if(!tr) return;
  const ry=e.group.rotation.y, back=new THREE.Vector3(Math.sin(ry),0,Math.cos(ry));
  const tail=e.group.position.clone().addScaledVector(back,12); tail.y=e.group.position.y;
  tr.pts.push(tail); if(tr.pts.length>tr.N) tr.pts.shift();
  const arr=tr.line.geometry.attributes.position.array;
  for(let i=0;i<tr.N;i++){ const p=tr.pts[i]||tr.pts[0]||tail; arr[i*3]=p.x; arr[i*3+1]=p.y; arr[i*3+2]=p.z; }
  tr.line.geometry.attributes.position.needsUpdate=true;
}

// ---- Flotte initialisieren / aktualisieren / recyceln ----
function initFleet(){
  if(!FLEET_MODELS.every(m=>glbTemplates[m])) return;   // erst wenn alle GLB geladen sind
  for(const model of FLEET_COMP){
    const p=spawnAroundPlayer(0.4,1.2);
    const e=spawnPlane(model, p.x, p.z);
    if(e) fleet.push(e);
  }
}
function recycleIfFar(e){
  if(e.state==='crash') return;                                 // Crash-Sequenz nicht unterbrechen
  const d=Math.hypot(e.group.position.x-state.pos.x, e.group.position.z-state.pos.z);
  if(d > VIEW_CELLS*CELL*1.5){
    const p=spawnAroundPlayer(0.9,1.3);
    e.group.position.set(p.x, Math.max(60, state.pos.y+e.altOff), p.z);
    e.heading=Math.random()*Math.PI*2;
    if(e.trail) e.trail.pts.length=0;
    assignMission(e);
  }
}
// ---- Hindernis-Ausweichen: deterministische Höhensonde (Turm/Berg/Haus aus r1/r2 rekonstruiert,
// unabhängig davon, ob die Insel schon gerendert ist) + "hochziehen & abdrehen" bei Gefahr. ----
function aiObstacleTopAt(x, z, margin){
  margin=margin||0;
  const pcx=Math.round(x/CELL), pcz=Math.round(z/CELL);
  let top=0;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const cx=pcx+dx, cz=pcz+dz;
    const info=islandInfo(cx,cz); if(!info) continue;
    const lx=x-info.wx, lz=z-info.wz;
    // Wolkenkratzer-Stadt = geschlossener BLOCK: volle Turmhöhe über die ganze Stadtfläche.
    // (Sonst rutschen schnelle Jets durch die ~26 m breiten Gassen zwischen den Türmen.)
    if(cellRnd(cx,cz,99)<0.10){
      if(Math.hypot(lx,lz) < info.radius*0.94 + margin){ if(165>top)top=165; }
      continue;
    }
    const list=islandBuildings(cx,cz); if(!list) continue;
    for(const b of list){
      if(b.type==='hill'){
        const rBase=30+b.r1*50, hh=20+b.r2*40, dr=Math.hypot(lx-b.x,lz-b.z);
        if(dr < rBase+margin){ const t=hh*Math.max(0,1-Math.max(0,dr-margin)/rBase); if(t>top)top=t; }
      } else {
        let w,d,h;
        if(b.type==='tower'){ w=14+b.r1*10; d=14+b.r2*10; h=70+b.r1*90; }
        else { w=5+b.r1*11; d=5+b.r2*9; const h0=4+b.r1*b.r2*12+b.r1*4; h=h0+Math.min(h0*0.5,4); }
        const hw=Math.max(w,d)/2;
        if(Math.abs(lx-b.x) < hw+margin && Math.abs(lz-b.z) < hw+margin){ if(h>top)top=h; }
      }
    }
  }
  // Alles, was auf dem MEER steht, kennt das Insel-Raster nicht — es muss eigens dazu, sonst fliegen
  // die KI-Maschinen mitten hindurch. Genau das war der Fall: durch die Handelsschiffe UND durch den
  // Flugzeugträger.
  let seaTop = 0;
  // Flugzeugträger: sein Aufbau ist das Hindernis, das Flugdeck selbst wird ja angeflogen. Die
  // Rumpf-Halbbreite (nicht die Deckbreite) zählt, weil die Bordwand seitlich übersteht.
  const car = carrierHullAt(x, z);
  if(car){
    const towerTop = fordTower ? fordTower.top : fordDeckY + 22;
    // Innerhalb des Turm-Grundrisses die Turmspitze, sonst die Deckhöhe.
    const info = car.info, rx = x-info.wx, rz = z-info.wz;
    const cs = Math.cos(info.rot), sn = Math.sin(info.rot);
    const lx2 = rx*cs - rz*sn, lz2 = rx*sn + rz*cs;
    let t = fordDeckY;
    if(fordTower && lx2 > fordTower.minX-margin && lx2 < fordTower.maxX+margin
                 && lz2 > fordTower.minZ-margin && lz2 < fordTower.maxZ+margin) t = towerTop;
    else if(!fordTower) t = towerTop;
    if(t > seaTop) seaTop = t;
  }
  // Handelsschiffe: Aufbauten bis 53 m (Containerschiff) bzw. 60 m Masthöhe (Großsegler) — daran
  // fliegt man sich tot, wenn die KI sie nicht sieht. Rechteck im Schiffssystem wie in hitsSeaShip.
  if(typeof seaShips !== 'undefined'){
    for(const sh of seaShips){
      if(!sh.group) continue;
      const rx = x - sh.x, rz = z - sh.z;
      const cs = Math.cos(sh.heading), sn = Math.sin(sh.heading);
      const lx2 = rx*cs - rz*sn, lz2 = rx*sn + rz*cs;
      if(Math.abs(lx2 - sh.cx) < sh.hw + margin && Math.abs(lz2 - sh.cz) < sh.hl + margin
         && sh.top > seaTop) seaTop = sh.top;
    }
  }
  return Math.max(ISLAND_Y + top, seaTop);   // Welt-Y der Hindernisspitze
}
// In welchen Zustaenden weicht eine KI-Maschine Hindernissen aus. Am Boden (loading, boarding,
// unload, depart) und im Absturz braucht es das nicht.
// Erweitert um toFire, toTarget und landing: das sind normale Reisestrecken, auf denen bloss nie
// gemessen wurde. carrierLap steht NICHT hier, obwohl der Jet dort durch Schiffe flog — auf der
// Platzrunde liegt er auf DECKHOEHE (12 m), und aiObstacleTopAt meldet fuer den Traeger genau diese
// Hoehe. Die Bedingung topY + 25 > py waere damit immer wahr, der Jet saehe seinen EIGENEN Traeger
// als Hindernis und stuerzte bei jedem Landeversuch ab (nachgerechnet, C:/tmp/diag_lap.js).
// Die Platzrunde bekommt deshalb eine eigene, engere Pruefung: aiShipAhead() sieht nur die
// HANDELSSCHIFFE, nicht den Traeger, unter dem sie kreist.
// toWater, dropFire und dropping bleiben bewusst AUS: dort fliegt die Maschine absichtlich im
// Tiefflug (Wasser aufnehmen, abwerfen), und Ausweichen wuerde die Mission zerstoeren.
const AI_AVOID_STATES = { toLoad:1, toBoard:1, toFar:1, cruise:1, cooldown:1,
                          toFire:1, toTarget:1, landing:1 };
// Steht auf der Strecke voraus ein HANDELSSCHIFF (kein Traeger, keine Insel)? Fuer die
// Traeger-Platzrunde, wo alles andere ignoriert werden muss. Gibt die Hoehe des Aufbaus oder 0.
// Getastet wird dichter als in aiAvoidObstacles: auf Deckhoehe zaehlt jeder Meter, und die Luecken
// dort (bis 153 m bei Tempo 200) sind breiter als ein Schiff quer ist.
function aiShipAhead(x, z, fx, fz, look, py){
  if(typeof seaShips === 'undefined') return 0;
  for(let dd = 30; dd <= look; dd += 30){
    const tx = x + fx*dd, tz = z + fz*dd;
    for(const sh of seaShips){
      if(!sh.group) continue;
      const rx = tx - sh.x, rz = tz - sh.z;
      const cs = Math.cos(sh.heading), sn = Math.sin(sh.heading);
      const lx = rx*cs - rz*sn, lz = rx*sn + rz*cs;
      if(Math.abs(lx - sh.cx) < sh.hw + 22 && Math.abs(lz - sh.cz) < sh.hl + 22
         && sh.top + 25 > py) return sh.top;
    }
  }
  return 0;
}

// ---- Triebwerksausfall ueber dem Meer ----
// Grund: Abstuerze passierten nur an Hindernissen, und die stehen alle an Land — fuer das
// Feuerwehrboot war also nie eines erreichbar. Ein Jet kann deshalb auch ueber offenem Wasser
// ausfallen; das brennende Wrack treibt dann dort, wo das Boot hinkommt.
// Nur Jets (AlphaJet/Mustang), weil nur die einen Schleudersitz haben — bei den Verkehrsfliegern
// waere ein Absturz ohne Rettung des Piloten unschoen. Und nur, wenn WIRKLICH das Boot gefahren
// wird: sonst haette man beim normalen Fliegen ploetzlich abstuerzende Maschinen ohne Anlass.
const AI_SEA_FAIL_EVERY = 20;    // Sekunden Ruhe zwischen zwei Ausfällen (danach kommt sicher einer)
const AI_SEA_FAIL_AHEAD = 10;    // Sekunden Fahrzeit, die er VOR dem Boot niedergeht
const AI_SEA_FAIL_HEIGHT = 260;  // Höhe (m), aus der er herunterkommt
let aiSeaFailT = 6;              // erster Ausfall kurz nach dem Losfahren
function updateSeaFailures(dt){
  if(!isBoat() || locale !== 'earth') { aiSeaFailT = 6; return; }
  // Läuft schon ein brennendes Wrack herum? Dann wartet der nächste, sonst wird es zu viel.
  for(const e of fleet) if(e.state === 'crash') return;
  aiSeaFailT -= dt;
  if(aiSeaFailT > 0) return;
  // Einen Jet holen. Vorher wurde nur gewürfelt UND auf einen Jet gewartet, der zufällig über
  // Wasser in Reichweite flog — der kam praktisch nie, weil die vier Jets der Flotte ihre eigenen
  // Missionen fliegen (meist über Land oder weit weg). Deshalb wird jetzt einer AKTIV in Position
  // gebracht: es sind ohnehin KI-Flieger, die ständig neu eingesetzt werden.
  const jets = fleet.filter(e => (e.model === 'AlphaJet' || e.model === 'Mustang') && e.state !== 'crash');
  if(!jets.length) return;
  const e = jets[Math.floor(Math.random()*jets.length)];
  // Zielpunkt: etwa AI_SEA_FAIL_AHEAD Sekunden Fahrzeit voraus, auf Wasser. Liegt dort eine Insel,
  // wird seitlich ausgewichen, bis eine Wasserstelle im Blickfeld liegt — man soll den Absturz
  // sehen können, ohne erst um eine Insel herumfahren zu müssen.
  const fwd = new THREE.Vector3(0,0,-1).applyQuaternion(state.quat);
  const fl = Math.hypot(fwd.x, fwd.z) || 1;
  const fx = fwd.x/fl, fz = fwd.z/fl;
  const dist = Math.max(150, spec.vMax * AI_SEA_FAIL_AHEAD);   // Boot: 24 m/s -> ~240 m
  let tx = null, tz = null;
  const water = (x,z)=> !isOnLand(x,z) && !isOnBeach(x,z) && !isOnCarrier(x,z);
  // Erst geradeaus, dann in wachsendem Winkel nach links und rechts (bis ±60°, im Blickfeld).
  for(const deg of [0, 15, 30, 45, 60]){
    for(const sgn of (deg === 0 ? [1] : [1,-1])){
      const a = deg*Math.PI/180*sgn, ca = Math.cos(a), sa = Math.sin(a);
      const dx = fx*ca - fz*sa, dz = fx*sa + fz*ca;
      for(const f of [1, 0.75, 1.3]){                          // etwas näher/weiter probieren
        const px = state.pos.x + dx*dist*f, pz = state.pos.z + dz*dist*f;
        if(water(px, pz)){ tx = px; tz = pz; break; }
      }
      if(tx !== null) break;
    }
    if(tx !== null) break;
  }
  if(tx === null) return;              // ringsum kein Wasser (in einer Bucht) -> nächstes Mal
  aiSeaFailT = AI_SEA_FAIL_EVERY;
  // Jet über den Zielpunkt setzen, Nase in Fahrtrichtung, dann Ausfall auslösen. Er trudelt von
  // dort herunter und schlägt in der Nähe auf — sichtbar vor dem Boot.
  e.group.position.set(tx, AI_SEA_FAIL_HEIGHT, tz);
  e.heading = Math.atan2(-fx, -fz);
  e.group.rotation.y = e.heading;
  e.state = 'cruise'; e.onFinal = false; e.rolling = false;
  e.chute = null; e.wrecked = false; e.crashFire = null;
  aiCrash(e, 0);
}
function aiAvoidObstacles(e, dt){
  if(e.state==='crash'){ aiStepCrash(e, dt); return; }
  if(!AI_AVOID_STATES[e.state] || e.onFinal || e.rolling) return;
  const {fx,fz}=aiForward(e), look=Math.max(140, e.spd*1.7);
  const px=e.group.position.x, pz=e.group.position.z, py=e.group.position.y;
  const isJet=(e.model==='AlphaJet'||e.model==='Mustang');   // schnell + Schleudersitz -> Crash
  // Jets: enger Blick auf drohende Kollision. Airliner: breiter, um sanft auszuweichen.
  let danger=0, hitTop=0;
  for(const dd of [look*0.45, look*0.75, look]){
    const topY=aiObstacleTopAt(px+fx*dd, pz+fz*dd, 22);
    if(topY + 25 > py){ danger=Math.max(danger, topY+45); hitTop=Math.max(hitTop, topY); }
  }
  if(!danger) return;
  if(isJet){ aiCrash(e, hitTop); return; }                   // Jet/Mustang: kein Ausweichen -> Crash
  e.group.position.y += (danger - py)*Math.min(1, dt*3);       // Airliner: schnell hochziehen
  const rx=-fz, rz=fx, sd=look*0.7;
  const rightTop=aiObstacleTopAt(px+fx*sd+rx*100, pz+fz*sd+rz*100, 22);
  const leftTop =aiObstacleTopAt(px+fx*sd-rx*100, pz+fz*sd-rz*100, 22);
  const turnDir=(leftTop < rightTop) ? -1 : 1;
  e.heading += turnDir*(e.turn||0.6)*dt*2.4;
  e.group.rotation.y=e.heading;
  e.holder.rotation.z += turnDir*0.35;
}
// ---- KI-Crash: Schleudersitz (Fallschirm) + trudelnder Sturz + Wrack + eigene Feuerwehr ----
function aiCrash(e, hitTop){
  if(e.state==='crash') return;
  e.state='crash'; e.crashT=0; e.vy=0; e.spinV=2.5+Math.random()*2;
  if(e.trail){ e.trail.pts.length=0; }
  // Schleudersitz: Pilot am Fallschirm an aktueller Position, sinkt gemächlich (wie ejectSeat/makeParachute).
  const chute=makeParachute(); chute.position.copy(e.group.position); scene.add(chute);
  e.chute={ group:chute, vy:-9 };
}
function aiStepCrash(e, dt){
  e.crashT+=dt;
  // Fallschirm sinkt + pendelt
  if(e.chute && !chuteSeaRescue(e.chute, dt)){
    e.chute.group.position.y += e.chute.vy*dt;
    e.chute.group.position.x += Math.sin(e.chute.group.position.y*0.1)*2*dt;
    const cs=isOnCarrier(e.chute.group.position.x,e.chute.group.position.z)?fordDeckY:(isOnLand(e.chute.group.position.x,e.chute.group.position.z)?ISLAND_Y:0);
    if(e.chute.group.position.y<=cs+1) e.chute.group.position.y=cs+1;
  }
  // Führerloser Flieger: trudelt und stürzt zu Boden
  if(!e.wrecked){
    e.vy=Math.max(e.vy-14*dt, -55);
    e.group.position.y += e.vy*dt;
    e.group.position.x += -Math.sin(e.heading)*e.spd*0.35*dt;
    e.group.position.z += -Math.cos(e.heading)*e.spd*0.35*dt;
    e.holder.rotation.z += e.spinV*dt; e.holder.rotation.x += e.spinV*0.6*dt;
    // Aufschlaghöhe: Trägerdeck, Insel — oder das Meer. Über Wasser zählt die Wellenhöhe, sonst
    // hinge das Wrack bei einem Wellental in der Luft und stäke auf einem Wellenberg darin
    // (die Dünung schwankt um ±1,7 m).
    const onDeck = isOnCarrier(e.group.position.x, e.group.position.z);
    const onIsl  = isOnLand(e.group.position.x, e.group.position.z);
    const gy = onDeck ? fordDeckY : (onIsl ? ISLAND_Y
             : seaSurfaceY(e.group.position.x - state.pos.x, e.group.position.z - state.pos.z));
    if(e.group.position.y <= gy+1.5){                          // aufgeschlagen -> Wrack + Feuer + Feuerwehr
      e.group.position.y=gy+1.5; e.wrecked=true; e.crashT=0;
      e.wreckSea = !onDeck && !onIsl;                          // treibt es im Wasser?
      const fg=new THREE.Group();
      for(let i=0;i<6;i++){ const fl=new THREE.Mesh(new THREE.ConeGeometry(1.6,5,6), flameMat); fl.position.set((Math.random()-0.5)*8, gy+2.5, (Math.random()-0.5)*8); fg.add(fl); }
      fg.position.set(e.group.position.x,0,e.group.position.z); scene.add(fg); e.crashFire=fg;
      e.rescue=aiSpawnRescue(e.group.position.x, e.group.position.z);
    }
    return;
  }
  // Wrack liegt: Feuerwehr fährt heran und löscht (eigene KI-Einheiten, spielerunabhängig).
  // AUSNAHME: treibt das Wrack im Meer und man fährt selbst das Feuerwehrboot, bleibt die KI-Rettung
  // weg — sonst wäre der Brand gelöscht, bevor man hingefahren ist, und man käme nie zum Einsatz.
  const mineToPut = e.wreckSea && isBoat();
  if(e.rescue && !mineToPut) aiStepRescue(e, dt);
  // Wie lange bleibt das Wrack liegen? Normal 8 s. Für das Boot viel zu kurz: bei 86 km/h sind das
  // gerade 190 m Anfahrt. Ein Seewrack wartet daher deutlich länger auf den Spieler — und ist das
  // Feuer aus (selbst gelöscht), verschwindet es nach kurzer Nachbrennzeit von allein.
  const linger = mineToPut ? (e.crashFire ? 75 : 3) : 8;
  if(e.crashT > linger){                                       // aufräumen + Flieger respawnen
    if(e.crashFire){ scene.remove(e.crashFire); e.crashFire=null; }
    if(e.chute){ clearChuteBoat(e.chute); scene.remove(e.chute.group); e.chute=null; }
    if(e.rescue){ for(const r of e.rescue){ scene.remove(r.group); scene.remove(r.jet); } e.rescue=null; }
    const p=spawnAroundPlayer(0.9,1.3);
    e.group.position.set(p.x, Math.max(70, state.pos.y+e.altOff), p.z);
    e.heading=Math.random()*Math.PI*2; e.holder.rotation.set(0,0,0); e.wrecked=false;
    e.wreckSea=false;                                          // gilt nur für DIESEN Absturz
    assignMission(e);
  }
}
// Eigene KI-Rettungseinheiten (nutzt makeRescueUnit, aber getrennt von der Spieler-rescueUnits-Liste).
function aiSpawnRescue(x, z){
  const list=[];
  const truck=makeRescueUnit(x,z,true), boat=makeRescueUnit(x,z,false);
  if(truck) list.push(truck);
  if(boat)  list.push(boat);
  return list.length?list:null;
}
function aiStepRescue(e, dt){
  for(const r of e.rescue){
    r.t+=dt; const driveT=Math.min(1, r.t/1.6), ease=1-Math.pow(1-driveT,3);
    r.group.position.lerpVectors(r.start, r.stop, ease);
    faceTowards(r.group, r.wreck.x, r.wreck.z);
    const jet=r.jet;
    if(driveT>=1){
      jet.visible=(Math.floor(r.t*12)%2===0);
      const noz=r.group.position.clone(); noz.y+=5; const target=r.wreck;
      jet.position.copy(noz.clone().lerp(target,0.5));
      jet.scale.set(1, noz.distanceTo(target), 1);
      jet.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0), target.clone().sub(noz).normalize());
      if(e.crashFire){ e.crashFire.visible=(Math.floor(r.t*8)%2===0); }   // Feuer erlischt zusehends
    } else jet.visible=false;
  }
}
function updateTraffic(dt){
  if(fleet.length===0){ initFleet(); }
  for(const e of fleet){ stepMission(e, dt); aiAvoidObstacles(e, dt); trafficTrail(e); recycleIfFar(e); }
  updateAiEffects(dt);
}

// -------- Alpha-Jet-Überschall-Vorbeiflug (sporadisch, von hinten) --------
// Fliegt tief (Action-Zone). Hindernisse (Stadt/Berg/Haus) sind REAL: weit genug weg -> hochziehen,
// zu nah/zu tief -> Absprung (Schleudersitz) + Crash, wie bei der frei fliegenden Flotte.
let flyby=null, flybyTimer=10+Math.random()*12;
const FLYBY_MAX_CLIMB=140;   // max. vertikale Steigrate (m/s); reicht die Distanz nicht -> Crash
const FLYBY_LOOK=800;        // Vorausschau-Reichweite (m) im Korridor
const FLYBY_CLR=25;          // Sicherheitsabstand ueber der Hindernisspitze (m)
function makeFlybyCone(){ const c=new THREE.Mesh(new THREE.ConeGeometry(6,9,20,1,true),aiVaporMat); c.renderOrder=996; scene.add(c); return c; }
function spawnFlyby(){
  if(!glbTemplates['AlphaJet']) return;
  const fwd=new THREE.Vector3(0,0,-1).applyQuaternion(state.quat); fwd.y=0;
  if(fwd.lengthSq()<1e-4) fwd.set(0,0,-1); fwd.normalize();
  const rightV=new THREE.Vector3(-fwd.z,0,fwd.x);
  const side=(Math.random()<0.5?-1:1)*(8+Math.random()*12);        // knapp seitlich
  const start=state.pos.clone().addScaledVector(fwd,-380).addScaledVector(rightV,side);
  start.y=state.pos.y+4+Math.random()*12;                          // tiefer Vorbeiflug (Action-Zone)
  const group=new THREE.Group(), holder=new THREE.Group(); group.add(holder);
  const m=glbTemplates['AlphaJet'].clone(true); m.rotation.y=TRAFFIC_ROT['AlphaJet']; holder.add(m);
  group.position.copy(start); scene.add(group);
  flyby={ group, holder, vel:fwd.clone().multiplyScalar(SOUND_SPEED+60), cone:makeFlybyCone(),
          coneT:0, boomed:false, life:6, fwd:fwd.clone() };
}
function updateFlyby(dt){
  if(!flyby){ flybyTimer-=dt; if(flybyTimer<=0){ spawnFlyby(); flybyTimer=16+Math.random()*20; } return; }
  const f=flyby;
  if(f.crashed){ flybyStepCrash(dt); return; }
  f.group.position.addScaledVector(f.vel,dt);
  // Dynamisch (Flughoehe / Steigrate / Hindernishoehe): fuer JEDES Hindernis im Korridor voraus die
  // noetige Steigrate = (Hindernis+Puffer - Flughoehe) / Distanz. Das Maximum entscheidet:
  // schaffbar (<= FLYBY_MAX_CLIMB) -> rechtzeitig hochziehen; sonst -> Absprung + Crash (kein Durchflug).
  const spd=SOUND_SPEED+60, dirx=f.vel.x/spd, dirz=f.vel.z/spd;
  let needVy=0;
  for(let d=40; d<=FLYBY_LOOK; d+=25){
    const raw=aiObstacleTopAt(f.group.position.x+dirx*d, f.group.position.z+dirz*d, 20);
    if(raw > f.group.position.y){ const v=(raw+FLYBY_CLR - f.group.position.y)*spd/d; if(v>needVy) needVy=v; }
  }
  if(needVy > FLYBY_MAX_CLIMB){ flybyCrash(); return; }             // zu nah/zu tief -> Crash
  if(needVy > 0){ f.group.position.y += Math.min(needVy, FLYBY_MAX_CLIMB)*dt; }   // rechtzeitig steigen
  faceTowards(f.group, f.group.position.x+f.vel.x, f.group.position.z+f.vel.z);
  f.life-=dt;
  const ahead=f.group.position.clone().sub(state.pos).dot(f.fwd);
  if(!f.boomed && ahead>0){ f.boomed=true; f.coneT=0.6; playSonicBoom(); }
  if(f.coneT>0){ f.coneT-=dt; aiVaporMat.opacity=Math.max(0,Math.min(0.5,f.coneT));
    f.cone.position.copy(f.group.position).addScaledVector(f.fwd,-4);
    f.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), f.fwd.clone().negate()); f.cone.visible=true;
  } else f.cone.visible=false;
  if(f.life<=0 || ahead>900) clearFlyby();
}
// Flyby-Crash: Schleudersitz + trudelnder Sturz + Wrack + eigene Feuerwehr (wie Flotte).
function flybyCrash(){
  const f=flyby; if(!f || f.crashed) return;
  f.crashed=true; f.crashT=0; f.vy=0; f.spin=2.5+Math.random()*2; f.wrecked=false;
  f.cone.visible=false;
  const chute=makeParachute(); chute.position.copy(f.group.position); scene.add(chute);
  f.chute={ group:chute, vy:-9 };
}
function flybyStepCrash(dt){
  const f=flyby; f.crashT+=dt;
  if(f.chute && !chuteSeaRescue(f.chute, dt)){
    f.chute.group.position.y += f.chute.vy*dt;
    f.chute.group.position.x += Math.sin(f.chute.group.position.y*0.1)*2*dt;
    const cs=isOnCarrier(f.chute.group.position.x,f.chute.group.position.z)?fordDeckY:(isOnLand(f.chute.group.position.x,f.chute.group.position.z)?ISLAND_Y:0);
    if(f.chute.group.position.y<=cs+1) f.chute.group.position.y=cs+1;
  }
  if(!f.wrecked){
    f.vy=Math.max(f.vy-14*dt, -55);
    f.group.position.y += f.vy*dt;
    f.group.position.x += f.fwd.x*60*dt; f.group.position.z += f.fwd.z*60*dt;   // trudelt noch etwas vorwaerts
    f.holder.rotation.z += f.spin*dt; f.holder.rotation.x += f.spin*0.6*dt;
    const gy=isOnCarrier(f.group.position.x,f.group.position.z)?fordDeckY:(isOnLand(f.group.position.x,f.group.position.z)?ISLAND_Y:0);
    if(f.group.position.y <= gy+1.5){
      f.group.position.y=gy+1.5; f.wrecked=true; f.crashT=0;
      const fg=new THREE.Group();
      for(let i=0;i<6;i++){ const fl=new THREE.Mesh(new THREE.ConeGeometry(1.6,5,6), flameMat); fl.position.set((Math.random()-0.5)*8, gy+2.5, (Math.random()-0.5)*8); fg.add(fl); }
      fg.position.set(f.group.position.x,0,f.group.position.z); scene.add(fg); f.crashFire=fg;
      f.rescue=aiSpawnRescue(f.group.position.x, f.group.position.z);
    }
    return;
  }
  if(f.rescue) aiStepRescue(f, dt);
  if(f.crashT > 8) clearFlyby();   // aufraeumen (clearFlyby entfernt auch chute/fire/rescue)
}
function clearFlyby(){
  if(!flyby) return;
  dropFromScene(flyby.group); dropFromScene(flyby.cone);   // der Vapor-Kegel ist je Vorbeiflug neu
  if(flyby.chute){ clearChuteBoat(flyby.chute); scene.remove(flyby.chute.group); }
  if(flyby.crashFire){ scene.remove(flyby.crashFire); }
  if(flyby.rescue){ for(const r of flyby.rescue){ scene.remove(r.group); scene.remove(r.jet); } }
  flyby=null;
}

function updateTrafficAll(dt){
  worldClock+=dt;
  updateTraffic(dt); updateFlyby(dt);
  updateSeaFailures(dt);   // Triebwerksausfall über dem Meer (nur wenn das Boot gefahren wird)
}


function loop(now){
  let dt=(now-last)/1000; last=now; if(dt>0.05)dt=0.05;
  // Audio beim ersten Gamepad-Kontakt aktivieren (falls noch nicht per Taste geschehen)
  if(!audioArmed && gamepadIndex!==null){
    const gp = navigator.getGamepads()[gamepadIndex];
    if(gp && (gp.buttons.some(b=>b.pressed) || gp.axes.some(a=>Math.abs(a)>0.3))){
      armAudio(); audioArmed = true;
    }
  }
  const inp=readInput();
  // PAUSE: solange die Hilfe/Anleitung (Overlay) sichtbar ist, steht das Spiel still.
  // readInput() lief bereits -> D-Pad ↑ / H kann das Overlay wieder schließen (weiter geht's).
  const hintEl = document.getElementById('hint');
  if(hintEl && hintEl.classList.contains('show')){
    renderer.render(scene,camera);
    requestAnimationFrame(loop);
    return;
  }
  if(eva) updateEva(dt, inp);   // draußen unterwegs: der Flieger steht, der Astronaut läuft
  else stepPhysics(dt,inp);
  // Großes Symbol in der Bildmitte ausblenden. Das gehört HIERHER und nicht in die Physik: dort
  // stand es in stepPhysics und stepBoat, und während der EVA läuft keines von beiden — das
  // 🧑‍🚀 blieb deshalb für immer stehen.
  if(bigTimer > 0){ bigTimer -= dt; if(bigTimer <= 0) showBig(''); }
  updateRumble(dt);          // Controller-Vibration (Crash/Stall/Landung)
  updateEngineSound();
  updateAmbient(dt);         // Meereskulisse: Moewen an der Insel, Ozeanrauschen draussen
  updateSonar(dt);           // U-Boot getaucht: Ping alle 15 s, lauter je naeher das Wrack
  updateScoop(dt);           // Wasser aufnehmen (Canadair)
  updateWaterDrop(dt);       // Wasserabwurf-Animation
  updateBoatSpray(dt);       // Feuerwehrboot: Wasserstrahl + Löschen
  updateFire(dt);            // Waldbrand-Modus (Canadair)
  updateThumb(dt);           // grüner Daumen über dem Flieger
  updateScoopHint(dt);       // große Wassertropfen beim Tanken
  updateCrates(dt);          // Transall: Kisten laden/abwerfen
  updateTransallMission(dt); // Transall: Fracht-Ziel + Navigation
  updateAirbusMission(dt);   // Airbus: Ziel + Ankunft (Aussteigen)
  updatePax(dt);             // Airbus: Figuren steigen seitlich ein/aus (im Paket-Takt)
  updateToggleHint(dt);      // Umschalt-Symbol (Ton an/aus) ausblenden
  updateRadar();             // Radar/Kompass rechts (immer sichtbar)
  updateGyro();              // Gyroskop/künstlicher Horizont darunter (Lande-Hilfe)
  updateParachute(dt);       // Schleudersitz-Fallschirm (AlphaJet)
  updateSonic(dt);           // Überschallknall + Vapor-Cone (AlphaJet ab Schallgeschwindigkeit)
  updateShadow();            // Höhen-Schatten am Boden (ab <=20 m)
  if(locale === 'earth') updateSea(dt);   // animierte Meereswellen (nur in der Erdwelt)
  for(const p of propMeshes) p.rotation.z += (10 + state.throttle*40) * dt;  // Propeller drehen
  if(locale === 'earth') updateTrafficAll(dt);   // KI-Flugverkehr (Bahnen, Choreografie, Vorbeiflug)
  updateShipsSea(dt);        // Handelsschiffe auf dem Meer (feste Hindernisse, fahren gemaechlich)
  updateHarborBoats(dt);     // die Feuerwehrboote am Kai schwimmen mit der Duenung
  updateHarborSubs(dt);      // die U-Boote am Strand ebenso
  updatePlaneLOD();          // geparkte Flieger ab 1.200 m ausblenden (89 % der Dreiecke)
  // Der Meeresboden wird nur gerechnet, wenn man ihn sehen KANN: im U-Boot, im Schlauchboot oder
  // knapp ueber dem Wasser. Aus 8.000 m Hoehe verdeckt ihn die Meeresflaeche vollstaendig, und die
  // Rechnung kostet 9,3 ms (im Code dokumentiert) bei jedem Rasterwechsel — beim X-Wing alle 0,9 s.
  // Dass er dabei nie fertig wird (9 Frames je Durchgang, aber alle 0,9 s ein Neustart), war die
  // Ursache fuer die "alten flachen meeresboden artefakte": eine halb gerechnete Flaeche behaelt
  // ihre alten Hoehen.
  if(seaFloorNeeded()) updateSeabed();
  // Und die Unterwasserwelt (616 Meshes je Zelle!) nur, wenn man tauchen kann. Vorher lief das auch
  // im Airbus auf Reiseflughoehe mit.
  if(seaFloorNeeded()) updateUwCells();
  updateFish(dt);            // wandernde Fischschwaerme (raeumen sich ab, wenn man die Erde verlaesst)
  updateReefFish(dt);        // standorttreue Schwaerme an Wracks und Riffen (kreisen an ihrem Platz)
  updateDrift(dt);           // Bewegungsreferenz unter Wasser (Blasen) und auf Mond/Mars (Staub)
  updateComets(dt);          // im Weltall: Kometenstreifen entgegen der Fahrtrichtung
  updateOrcas(dt);           // Killerwale: Springer (45 Grad, 10 m hoch) und tauchende Schule
  updateRockets(dt);         // Raketenstarts auf den Inseln (starten bei Annäherung, steigen ins All)
  // Erststart: sobald der Hangar geladen IST und danach kurz Ruhe war, beginnt der X-Wing dort.
  // Die Wartezeit ist nötig, weil beim App-Start noch weitere Modelle nachladen (siehe oben).
  if(wantHangarStart && hangarObj && MODEL_NAMES[currentModel] === 'XWing' && locale === 'earth'
     && !state.crashed && state.onGround){
    hangarStartT -= dt;
    if(hangarStartT <= 0){ wantHangarStart = false; enterHangar(); }
  }
  stepGroundFields();        // Höhenraster von Mond und Mars in Häppchen ausmessen
  stepGroundExact();         // exakte Bodenhöhe unter dem Flieger (nur in Bodennähe)
  updateLocale();            // Erde <-> Weltall <-> Mond
  updateWarp(dt);            // Hyperraum aufbauen/abbauen + Ring-Effekt
  updateAsteroids(dt);       // Asteroiden treiben, Laserblitze fliegen, Explosionen verblassen
  updateDestroyers(dt);      // Star Destroyer im Raum (anfliegbar wie der Todesstern)
  updateShips(dt);           // fremde Raumschiffe ziehen ihre Bahn durchs Weltall

  updatePads(dt);            // Start- und Landeverkehr an Mondbasis bzw. Mars-Rover
  updateSpaceHint(dt);       // Ort/Ziel/Treffer kurz über dem Flieger (wie Tropfen und Kisten)
  updateFade(dt);            // kurzes Aufblenden nach einem Ortswechsel
  updateSpaceBlend(dt);      // Himmel/Sterne/Licht überblenden
  if(locale === 'earth') recycleWorld();
  else if(GROUNDS[locale]) updateGroundTiles();
  dtCam = dt;                // für die EVA-Kamera (updateCamera nimmt kein dt)
  updateCamera();
  updateHUD();
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
if(window.STORY_HOOK) STORY_HOOK();
updateIslands();
// Den Meeresboden EINMAL komplett rechnen, bevor das erste Bild steht. Danach uebernimmt
// updateSeabed und rechnet nur haeppchenweise nach (siehe dort). Muss hier stehen und nicht im
// Meeres-Block: seabedY braucht CELL und islandInfo, die erst mit dem Insel-System kommen.
seabedInit();
preloadAllGLB();       // echte GLB-Modelle laden (ersetzen Fallback, sobald fertig)
preloadBoat();         // Feuerwehrboot-GLB laden
preloadTruck();        // Feuerwehrauto-GLB laden
preloadParachute();    // Fallschirm-GLB laden (Reserve)
preloadChute2();       // Fallschirm 2 (TopNotch Assets) — Kisten UND Pilot
preloadAstronaut();    // Astronaut — am Fallschirm und zum Aussteigen
preloadDinghy();       // Schlauchboot — Rettung fuer alles, was sonst im Wasser landet
preloadSeaShips();     // Handelsschiffe: Kreuzfahrer, Liberty, Container, Grosssegler
preloadOrca();         // Killerwale (animiert, eigener Mixer pro Tier)
preloadFord();         // Flugzeugträger-GLB laden (schwimmende Landebahn)
preloadHarbor();       // Hafen-GLB laden (an jeder Insel)
preloadRocketPad();    // Ariane 6 und Startrampe (auf jeder zweiten Nicht-Stadt-Insel)
preloadXwingPark();    // der geparkte X-Wing auf jeder Nicht-Stadt-Insel (zum Einsteigen)
preloadSpace();        // Sternenkuppel, Erdkugel, Mondkugel, Mond-Kraterlandschaft
placeAtStart(MODEL_NAMES[currentModel]);   // Startmodell (X-Wing) auf der Landebahn aufstellen
startCurtain(20);      // schwarz, bis der Hangar bereit ist (siehe wantHangarStart im Loop)
camera.position.set(state.pos.x, state.pos.y+10, state.pos.z+25);
camera.lookAt(state.pos);
if(window.STORY_START) STORY_START();
requestAnimationFrame(loop);
