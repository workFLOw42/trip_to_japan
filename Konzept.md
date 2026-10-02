# 🎮 KONZEPT: Kenjis Ferien-Abenteuer — „Ohne Geld nach Japan 🇯🇵“

Ein 3D-Abenteuerspiel im Browser auf Basis der WebGL/Three.js-Engine des „Flugspiel“ ([workFLOw42/flightsimulator](https://github.com/workFLOw42/flightsimulator)).

---

## 📌 Arbeitsstand (02.10.2026)

**Gebaut und spielbar:** Etappe 1 (alle Wege inkl. Mars-Trip) und Etappe 2 (X-Wing-Falle mit Kurzschluss,
Mond-Trip, Transall-Flugschule) · Startmenü mit Etappen-Sprung (Test) · Globus-Reise zwischen den Etappen ·
Tageszähler · Stimmen (Pilot männlich) · Offline-PWA · Highscores still gespeichert (noch ohne Anzeige).
Details zum Gebauten in der [README](README.md); Stolperstellen der Engine in [ENGINE_RISIKEN.md](ENGINE_RISIKEN.md).

**Als Nächstes:** Etappe 3 (Indischer Ozean).

### 🔧 Beim Bauen entschieden (weicht vom Text unten ab oder ergänzt ihn)

- **„Startsequenz“ statt „Preflight-Check“** – die Sprachausgabe kann das englische Wort nicht aussprechen.
  Im X-Wing gibt es **keine Anleitung** (nur Leuchte + Zeit): wer sie nicht kennt, soll scheitern.
  Die Transall-Flugschule erklärt sie; dort läuft sie **ohne Zeitlimit und ohne Kurzschluss**.
- **Ziel ist Fukuoka** (dort wohnt Kenjis Freund), nicht der Fuji. Start auf dem Globus: München.
  Etappenorte auf dem Globus: Saudi-Arabien (Wüste), Malediven, Malaysia, Hongkong, Fukuoka.
- **Absturz** auf einem Flugweg (Freiflug, Mars/Mond, Erde, All, Transall) = **7 Tage**.
- **Etappe 1:** X-Wing und U-Boot stehen am Strand, das U-Boot wird über einen **Ring am Strand** bestiegen
  (kein Schlauchboot). Unterwasser gibt es **genau 5 Wracks** (2 Segler, 3 Liberty), keine kleinen.
  Aufgabe: **zwei unterschiedliche Wracks fotografieren** (Riffe nachbauen). Der Code 14 02 wird **nicht
  gesprochen**, nur im Ziffernfeld gezeigt, das nach der Ansage verschwindet. Das **Periskop** zeigt nur nach
  einem Sonar-Ping ein Bild (verblasst über 10 s).
- **Etappe 2 ist reine Wüste** (kein Wasser), Abwurfziel ist eine **Oase**.
  Mond-Text je nach Etappe 1: war man auf dem Mars, kurz („Du schon wieder …“), sonst wie der Mars-Text.
  Der Mondstein liegt auf der Plattform der Mondbasis. Man ist **nicht der erste Mensch** auf dem Mond.
- **Transall-Flugschule ohne Autopilot:** Erklärung am Boden (Startsequenz, Kurzschluss, Start, Abwurf, Landung),
  dann *„Du kannst doch fliegen?“* – **NEIN** → „Für Anfänger ist das leider nichts. Bitte steige wieder aus.“
  → 7 Tage. **JA** → Kenji fliegt selbst von Anfang an (kein „Pilot wird schlecht“). Nach dem Abwurf ist die
  Mission vorbei; **landen muss man nicht** (erst später mit dem Alpha Jet), aber es wird erklärt:
  30 % Schub, langsam runter, grüner Gyro-Ring.
- **Kenji zu Fuß:** A Sprung, B Aerial Evade, X Silly Dance, Y Butterfly Twirl, L3 + Stick Moonwalk;
  schwimmen (RT tauchen, LT auf). Auf Mond und Mars springt er dank geringer Schwerkraft höher.
- **Ton:** an = Stimme ohne Untertitel, aus = Untertitel; Umschalten setzt am aktuellen Wort fort.
  Alles blendet mit der Schwarzblende zum Globus aus.
- **Aufgeräumt** gegenüber dem Flugspiel: kein Jetpack, kein Modellwechsel, kein Steg, keine Zufallsfeuer,
  keine Hangar-Landung (ISS/Todesstern/Sternenzerstörer bleiben als Objekte), Warp mit Streifen statt Ring.
- **Hilfe:** D-Pad ↑ = Anleitung (pausiert), D-Pad ← = aktuelle Aufgabe (pausiert **nicht**, sonst gewönne man
  Bedenkzeit).

### Ursprünglicher Stand (01.10.2026)

**Fertig ausgearbeitet:** Tage-Regel & Finale-Grenzen · Fehlschläge aller Etappen · Etappen-Wahl (hinlaufen, „1 Tag“/„4 Tage“ im Mario-Stil) · Preflight-Check inkl. Kurzschluss & Bestenliste · Abwurf-Physik Transall · Kran in Etappe 4 (Wind-Zyklen, 4 Lücken, 6 min, 2 Fehler, HUD + Ladeplan) · Schlucht-Baukasten · Modell-Liste.

**Als Nächstes:** Stellwerk in Etappe 6 (Entwurf steht dort, 3 offene Fragen).

**Danach offen:** Finale-Szenen (was ist spielbar, was Zwischensequenz?) · Rahmen (Hauptmenü, Spielstand, Bestenliste, freigeschaltetes Minispiel) · Stimmen/Erzähler (Text, Sprachausgabe oder Aufnahme?) · genaue Position des verdeckten Containers.

**Spielfigur:** Kenji ist fertig geriggt → **`models/kenji.glb`** (Skelett + 16 Animationen, alle in place, fertig für Three.js).

**Modelle:** alle Downloads liegen in `_quellen/` – **vollständig** (Surfbrett + Snowboard am 02.10.2026 ergänzt).

---

## 🛠️ Technische Basis: Übernahme aus dem „Flugspiel“

Das Spiel übernimmt die **Mechanik** (Flugphysik, Steuerung, Kamera, Wasser/Schwimmen, Fallschirm/EVA) und **vorhandene Modelle** aus dem Repo `Flugspiel`.

- **Optik wie im Flugspiel:** gleiche Außenkamera, keine eigenen Innenraum-Modelle.
- **„Cockpit“ = HUD:** Instrumente und Kontrollleuchten (Preflight-Check, Inverted Controls) werden als HUD-Elemente eingeblendet.

**Bereits vorhandene Modelle (Flugspiel):**

| Einsatz im Konzept | Modell im Flugspiel |
|---|---|
| X-Wing (Etappen 1–3) | `xwing_2.0_by_GaryPhelps.glb` |
| Transall-Flugschule (Etappe 2) | `transall_c-160.glb` |
| P-51 Mustang (Etappe 5, Finale Stufe 2) | `p-51_mustang.glb` |
| Alpha Jet (Etappe 6) | `dornier_alpha_jet_a_west_germany.glb` |
| Feuerwehrboot (Etappe 3) | `fire_rescue_boat.glb` |
| Frachtschiff für die Container (Etappe 4) | `container_ship_by_RM02.glb` |
| Schiffswracks (Etappe 1) | `liberty_ship_by_AlanTinka.glb`, `empty_ship_by_Liaval.glb` |
| Mars-Trip (Fehlschlag Etappe 1) | `mars_*`, `perseverance_*` |
| Mond-Trip (Fehlschlag Etappen 2 + 3) | `moon_*`, `moonbase_by_eggshell.d.glb` |
| Not-Absprung (Finale Stufe 1) | `parachute*.glb` |
| U-Boot (Etappen 1 + 5) | `submarine_glb.js` (vermutlich – prüfen) |
| Hafen / Kai | `low_poly_mini_harbor.glb`, `the_wharf_fishing_harbor_*.glb` |

**Neu besorgt (01.10.2026, liegen in `_quellen/`):**

| Einsatz im Konzept | Modell | Stand |
|---|---|---|
| Container-Kran (Etappe 4) | `building_crane_low_poly_by_Mostafa Hamed.glb` | 0,9 MB, 19 k Dreiecke – passt. **Animiert** (6,7 s): Drehen des Auslegers, Laufkatze fährt aus/ein, Haken dreht. Die drei Teile sind eigene Nodes → im Spiel direkt per Eingabe steuern statt den Clip abzuspielen. Ein Heben/Senken des Hakens ist **nicht** animiert. |
| Frachtschiff am Kai (Etappe 4) | `cargo_ship_06_without_containers_by_gogiart.glb` | 14,2 MB, 337 k Dreiecke – verkleinern. Feeder-Schiff **ohne Ladung**, ~78 m, flaches durchgehendes Deck zwischen Vorschiff und Deckshaus. Die Ladung wird komplett aus Klonen des 12-Dreieck-Containers aufgebaut → Lücken frei wählbar, Ladung kostet fast nichts. *(Alternative mit fester Ladung: `cargo_ship_07_by_gogiart.glb`, 47,5 MB – nicht genutzt.)* |
| Container (Etappe 4) | `container_by_H.A.K_Niazi.glb` | 0,3 MB, **12 Dreiecke** (ein Quader mit Foto-Textur) – ideal, beliebig oft klonbar für Ladung + Stapel an Deck. Proportionen ca. 2,5 : 1,1 : 1 → beim Einbau auf echtes 20-Fuß-Maß (6,1 × 2,6 × 2,4 m) skalieren. |
| Schnellboot (Etappe 4) | `speedboat_n2_by_Jonathan Geoffroy.glb` | 3,4 MB, 96 k Dreiecke, 43 Materialien – verkleinern |
| Polizeiboot (Etappe 4) | `police_boat_by_gogiart.glb` | 8,8 MB, 209 k Dreiecke – verkleinern |
| Mt. Fuji (Etappe 6, Finale Stufen 1 + 2) | `mount_fuji_-_honshu_japan_by_Rafael Kenji Horota.glb` | 12,5 MB, 374 k Dreiecke, 1 Foto-Textur (0,7 MB) – Gelände-Mesh, gut verkleinerbar. Root-Node ist **gekippt und skaliert** → beim Einbau neutralisieren und auf echte Höhe (3776 m) bringen. Nur Außenhülle: **Höhlensystem, Felsspalte und Krater-Schlot** für den Alpha-Jet-Run müssen selbst gebaut werden. |
| Shinkansen (Etappe 6) | `n700-3000_series_shinkansen_by_Avatar of bciarfello.glb` | 27,4 MB, 514 k Dreiecke (reine Geometrie, keine Texturen) – stark verkleinern |
| Surfbrett (Finale, alle Stufen) | `prancha_de_surf_surfboard_by_Leandro Cruz.glb` | 0,7 MB, 13 k Dreiecke, orange Textur + 3 Finnen. Original schief und 4,8 m lang → **`models/surfboard.glb`**: ausgerichtet (Nase +Z, Deck oben, Finnen unten auf y = 0), auf **1,90 m** skaliert. |
| Snowboard (Finale Stufe 1) | `intermediate_advanced_snowboard_by_Final Render Animation Studio.glb` | 1,9 MB, 1,7 k Dreiecke, rot/weiß, Normal-Map. Material von Spec-Gloss auf Standard-PBR umgestellt (Three.js kann Spec-Gloss nicht mehr) → **`models/snowboard.glb`**: auf **1,45 m** (Kindergröße) skaliert, Länge entlang Z, Unterseite auf y = 0. Vorschau beider Bretter neben Kenji: `_quellen/Bretter_vorschau.png`. |

**Selbst gebaut (aus Code, keine Modelle nötig) – „Schlucht-Baukasten“:**

Das Fuji-Modell liefert nur die Außenhülle. Höhle, Spalte und Ausbruch für Etappe 6 entstehen in Three.js aus Code. Vorteil: Engstellen, Kurven und Länge lassen sich exakt auf „sehr schwer, aber schaffbar“ abstimmen. Derselbe Baukasten dient für die **Unterwasser-Schlucht in Etappe 5** (U-Boot-Slalom).

| Teil | Bauweise | Aufwand |
|---|---|---|
| Höhleneingang | Dunkle Öffnung in der Fuji-Flanke mit Fels-Brocken drumherum – vor das Mesh gesetzt, das Fuji-Mesh wird nicht aufgeschnitten | klein |
| Höhle / Tunnel | `TubeGeometry` entlang einer frei festgelegten Kurve, Innenwand verrauscht, Lava-Glühen; Kollision = Abstand zur Kurve | mittel |
| Felsspalte (Messerflug) | Zwei Felswände mit schmalem senkrechtem Schlitz; Prüfung: Rollwinkel ≈ 90° → passt, sonst Crash | klein |
| Magma-Wand | Glühende Fläche mit animiertem Lava-Muster, Bremspunkt davor | klein |
| Schlot & Krater | Senkrechte Röhre nach oben zum Gipfel; den Krater hat das Fuji-Modell schon | klein |
| Ausbruch | Partikel (Funken, Rauch, Lava-Brocken) + rotes Leuchten am Gipfel; baut auf `flameMat`/`smokeMat` des Waldbrands im Flugspiel auf | mittel |

**Spielfigur Kenji:** eigene Anime-Figur (Image-to-3D, ~40 k Dreiecke, 1,50 m, Blick +Z), per Mixamo geriggt (28 Bones `mixamorig:*`) → **`models/kenji.glb`** (5,4 MB, Figur + 16 Animationen). Rohdaten und Entstehung liegen lokal in `_mixamo/` und `_intern/` (nicht im Repo). Clip-Namen für `THREE.AnimationMixer`: `idle` 1,8 s · `walk` 1,0 s · `run` 0,6 s · `jump` 1,9 s · `jump_down` 2,5 s · `land` 1,1 s · `crouch_to_stand` 1,0 s · `swim` 4,5 s · `fly` 2,6 s · `hang` 2,3 s · `dance_hiphop` 18,5 s · `dance_silly` 3,8 s · `moonwalk` 1,0 s (Fußbewegung nach hinten) · **Specials:** `jump_special` 2,1 s (Salto, eigentlich 5 m Weg) · `aerial_evade` 3,7 s (Ausweich-Salto, eigentlich 2,1 m seitlich) · `butterfly_twirl` 3,0 s (Butterfly-Kick, eigentlich 2,1 m Weg). Alle **in place**: wo Mixamo die Figur vorwärts bewegt (`jump_down` 1,95 m, `land` 1,04 m und die drei Specials), wurde die Hüftbewegung in x/z per Skript entfernt, die Höhe (y) bleibt. Soll ein Sprung Strecke machen, verschiebt der Code die Figur. `hang`/`swim`/`fly` haben die Hüfte nicht auf Stehhöhe → Figur im Spiel passend positionieren.

**Animations-Zuordnung (Stand 02.10.2026):**

| Situation | Clips | Einbau |
|---|---|---|
| **Surfen / Snowboarden** | `idle` (Fahren), `crouch_to_stand` (aufstehen, z. B. nach dem Anpaddeln), `land` (nach Sprung/Welle), `jump` (Sprung über Kante) | Kenji steht seitlich auf dem Brett (Füße 0,52 m auseinander, Knie gebeugt – Mixamo „Standing Idle“ ist eine Kampf-/Surf-Haltung). Brett unter die Fußmitte, um **−156°** gedreht (Brettachse = Linie zwischen den Füßen), Kenji um die Deckhöhe anheben (Surfbrett 0,17 m, Snowboard 0,04 m). Brett als Kind der Figur oder umgekehrt; Kurven = Brett + Figur zusammen neigen (Rollwinkel per Code). Kontrollbild `_quellen/Bretter_mit_Kenji.png`. |
| **Fallschirmsprung** | `fly` (freier Fall, Bauchlage), `hang` (am geöffneten Schirm), danach `land` → `idle` | Freier Fall: `fly` liegt flach, Kopf in Blickrichtung → Figur passend zur Fallrichtung drehen. Am Schirm: `hang` – Hände 0,8 m über der Hüfte → dort die Gurte/Leinen des Schirms ansetzen. Landung: auf `land` überblenden (Hüfte startet hoch und federt ab). |
| **Wasser** | `swim` | Hüfte auf Wasserhöhe legen. |
| **An Land** | `walk`, `run`, `jump`, `jump_down`, `moonwalk` | Bewegung kommt aus dem Code. |
| **Jubel / Belohnung** | `dance_hiphop`, `dance_silly`, `jump_special`, `aerial_evade`, `butterfly_twirl` | z. B. nach gelungener Etappe oder im Finale. |

**Noch fehlend:** ggf. Stellwerk-Häuschen (Etappe 6 – Bedienung läuft übers HUD).

---

## 🏄‍♂️ Das Spiel

### 💡 Grundidee & Rahmen-Mechanik

Die Sommerferien haben begonnen! Kenji will es in 6 Wochen von zu Hause bis nach Japan schaffen, um seinen besten Freund bei dessen Großeltern zu besuchen – komplett ohne Geld!

- **6 Etappen / Aufgaben:** Auf der Route gen Osten Richtung Japan.
- **Tage-Regel:** Jede Etappe hat einen Risiko-Weg und einen sicheren Weg.
  - Risiko-Weg geschafft → **1 Tag**
  - Sicherer Weg geschafft → **4 Tage**
  - Gescheitert (egal auf welchem Weg) → **7 Tage**
  - Es gibt kein vorzeitiges Ende: Kenji kommt immer in Japan an, die verbrauchten Tage (6–42) bestimmen die Finale-Stufe.
- **Der Strategie-Loop:** Kenji nutzt den ersten Versuch oft als „Erkundungs-Run“ (Analysieren, Physik verstehen), um in Folgeruns die optimalen Abkürzungen zu fliegen.

### 🚶 Die Wahl am Start jeder Etappe

- Kenji steht mit seiner **Spielfigur** zu Beginn jeder Etappe **hinter den beiden Möglichkeiten** (z. B. X-Wing links, U-Boot rechts).
- Er **läuft zu Fuß** auf das gewünschte Fahrzeug zu und **steigt ein** – genau wie der Astronaut im Flugspiel (hinlaufen, **Y** = einsteigen).
- Über jeder Wahlmöglichkeit schwebt im **Super-Mario-Stil** groß die Zeit: **„1 Tag“** über dem Risiko-Weg, **„4 Tage“** über dem sicheren Weg.
- *Flugspiel-Basis:* Laufen, Hüpfen, Radar und Einsteigen per **Y** gibt es dort schon – auch für U-Boot am Strand und Feuerwehrboot am Kai.

### ✈️ Der Preflight-Check

Der Preflight-Check ist das zentrale Sicherheits- & Kontroll-Ritual vor jedem Flug. Er stellt sicher, dass alle Achsen ordnungsgemäß funktionieren – besonders wichtig, wenn das Schiff einen Steuerungs-Kurzschluss (Inverted Controls) aufweist!

Kenji muss diesen Check in den Risiko-Szenarien innerhalb des **10-Sekunden-Countdowns** fehlerfrei durchführen, um die manuelle Kontrolle zu übernehmen. Auf dem sicheren Weg (Mustang, Etappe 5) gibt es keinen Timer – dort führt ein Ansager durch.

1. **Bremse halten** – verhindert ungewolltes Rollen beim Start.
   - Aktion: Bremse gedrückt halten.
   - Prüfung: Der Tacho bleibt auf 0 km/h fixiert, das Triebwerk baut den ersten Druck auf.
2. **Ruder-Ausschlag links & rechts** – Test der Gier- und Roll-Achse.
   - Aktion: Lenkeingabe komplett nach links, dann komplett nach rechts.
   - Prüfung:
     - Normale Steuerung: Flieger/Fahrzeug neigt sich passend zur Taste.
     - Kurzschluss-Warnung: Schlägt das Ruder entgegengesetzt aus, leuchtet das rote Inverted-Controls-Symbol auf!
3. **Höhenruder hoch & runter** – Test der Nick-Achse.
   - Aktion: Nase hochziehen, dann Nase drücken.
   - Prüfung: Überprüfung, ob Oben/Unten auf der Pitch-Achse vertauscht sind.
4. **Triebwerk freigeben & Bremse lösen** – Startfreigabe erfolgt.
   - Aktion: Bremse lösen und Vollgas geben.
   - Ergebnis: Die Kontrollleuchte für den Preflight-Check schaltet auf **GRÜN** und die manuelle Steuerung wird freigeschaltet.

**Regeln:**
- Die Leuchte wird **nur grün**, wenn die Reihenfolge exakt stimmt: **Bremse halten → links / rechts / hoch / runter → Bremse loslassen → Gas geben**.
- Innerhalb der 10 s darf Kenji **beliebig oft von vorne beginnen**.
- **Grün ist grün:** Sobald die Leuchte einmal grün ist, ist der Check bestanden – der Timer **stoppt sofort**, und Kenji kann danach z. B. auch wieder vom Gas gehen. Erreicht der Timer null, ohne dass die Leuchte grün war, übernimmt der Autopilot.
- **Nettes Nebenprodukt – Bestenliste:** Die gestoppte Zeit ergibt zwei Highscores: **Preflight** (normal) und **Preflight Inverted** (mit Kurzschluss).
- **Bei Kurzschluss** sind **alle** Eingaben vertauscht: Bremse ↔ Gas, links ↔ rechts, hoch ↔ runter. Gewertet wird, was das **Flugzeug** tut, nicht welche Taste gedrückt wurde – Kenji muss also umdenken. Der **einzige Hinweis** ist die rote Inverted-Controls-Kontrollleuchte im HUD.

**⚠️ Was passiert bei einem Fehler oder Zeitablauf?**
- **Timer auf null, Leuchte nicht grün:** Der Notfall-Autopilot schaltet sich ein und übernimmt das Steuer – Kenji wird automatisch auf die Sonder-Mission (z. B. Mars- oder Mond-Trip) geschickt.
- **Kurzschluss-Erkennung:** Wenn Kenji beim Preflight-Check genau hinsieht, merkt er bereits im Stand, ob die Steuerung vertauscht ist, und kann im Kopf die Tasten vor dem Start umpolen!

### 🗺️ Die 6 Etappen nach Japan im Detail

---

#### 🚀 Etappe 1: Der Aufbruch am Strand

**Risiko (X-Wing):** Preflight-Check im 10s-Timer.
- Unwissenheit/Fehlschlag: Autopilot fliegt zum Mars (Lern-Trip: Fliegen & Landen erklärt bekommen, Mars-Stein holen) → **7 Tage** vergangen.
- Pro-Level (spätere Runs): Check geschafft → **1 Tag** vergangen.

**Sicher (U-Boot):**
- Funkspruch: Das U-Boot wurde per Universalschlüssel **1402** freigeschaltet! (Gesprochen „vierzehn – null zwei“, damit es im Ohr bleibt.)
- Aufgabe: Ruhiges Abtauchen & Unterwasser-Fotosequenz von 2 Schiffswracks.
- Ergebnis: Geschafft → **4 Tage** vergangen. Auf diesem Weg kann man nicht scheitern.

**🎓 Lerneffekt Etappe 1**
- **Lernen aus Fehlern:** Scheitern ist kein Game Over, sondern eine Lernchance (Flugschule auf dem Mars-Trip).
- **Informationen wahrnehmen:** Beiläufige Details (Code 1402) als wertvoll für spätere Situationen erkennen.

---

#### 🛩️ Etappe 2: Die Wüste (Flugschule & Die X-Wing-Falle)

**Risiko (Die X-Wing-Falle):** Wer wieder unüberlegt reintappt, gerät in die Kurzschluss-Falle (Inverted Controls + 10s Timer).
- Fehlschlag: Autopilot fliegt zum Mond (Mondgestein holen) → **7 Tage** vergangen.
- Gemeistert: In 10s trotz Kurzschluss den Check knacken → **1 Tag** vergangen.

**Sicher (Co-Pilot auf Transall) – DIE FLUGSCHULE:**
- **Mut-Test:** Pilot fragt: „Du kannst doch fliegen?“ → Kenji MUSS mit **[JA]** antworten und Zuversicht beweisen!
- **Erklär-Phase:** Pilot erklärt Preflight-Check, Kurzschluss-Symbole & Abwurf-Physik:
  - „Wir fliegen auf **300 m** – halte die Höhe zwischen **270 und 330 m**!“
  - Die Abwurf-Entfernung wächst **linear** mit dem Schub – zwischen 60 % (sicher fliegen) und 100 % (v max):
    - 60 % Schub (~155 km/h) → 300 m vor dem Ziel abwerfen
    - 80 % Schub (~205 km/h) → 400 m vor dem Ziel abwerfen
    - 100 % Schub (~256 km/h) → 500 m vor dem Ziel abwerfen
  - **Merksatz:** „Schub in Prozent mal 5 = Meter vor dem Ziel.“ Schneller → früher abwerfen.
- **Aktion:** Pilot wird schlecht, Kenji übernimmt das Steuer! (Toleranz ± 50 m)
- **Abwurf-Mechanik (neu, nicht aus dem Flugspiel):** Im Flugspiel fällt die Kiste hinten raus, behält nur 30 % der Fluggeschwindigkeit und sinkt sofort am Schirm – sie landet fast senkrecht unter dem Abwurfpunkt. Für diese Aufgabe behält sie ihren **vollen Schwung**, fällt **kurz frei** und sinkt dann am Schirm; von 300 m braucht sie etwa **7 s** bis zum Boden. Daraus folgt die 5-m-pro-%-Regel. Die Fallzeit wächst mit der Höhe: Am Rand des Höhenbands (270/330 m) liegt die Kiste bei Vollgas knapp an der Toleranzgrenze (~50 m daneben), bei 60 % Schub bei ~30 m – Höhe halten zählt also. Feinabstimmung bei der Umsetzung.
- *Transall im Flugspiel: Abheben bei 40 m/s (= 56 % v max), v max 71 m/s (~256 km/h), max. Höhe 600 m. Unter ~56 % Schub sinkt sie – daher der Bereich 60–100 %, die Flugphysik bleibt unverändert.*
- **Ergebnis:** Treffer → **4 Tage** vergangen („Perfekt!“ / „Gut gemacht!“). Daneben → **7 Tage** vergangen.

**🎓 Lerneffekt Etappe 2**
- **Impulskontrolle & Selbstreflexion:** Nicht stur denselben Fehler wiederholen (X-Wing-Falle), sondern die eigenen Lücken ehrlich einschätzen.
- **Verantwortung & Mut:** Steht man zu einer Zusage ([JA]), muss man die Verantwortung übernehmen und das Gelernte unter Druck umsetzen.
- **Angewandte Physik:** Verstehen, wie Geschwindigkeit den Schwung und Flugweg von Objekten beeinflusst.

---

#### 🚤 Etappe 3: Der Indische Ozean (Neues Lernen vs. Sichere Routine)

**Risiko (X-Wing – Das Scheingefühl):**
- Kenji fühlt sich beim X-Wing erstmals sicher. Schlägt er den 10s-Check → **1 Tag** vergangen.
- Fehlschlag: Autopilot fliegt zum Mond (Mondgestein holen, analog zum Mars-Trip in Etappe 1) → **7 Tage** vergangen.
  - **Zweiter Mond-Trip** (schon in Etappe 2 gescheitert): Funkspruch der Kommandozentrale: „Du schon wieder … Das trifft sich ja gut – wir haben es nämlich auch verbockt und den Stein vom Mond verloren. Hol mal bitte noch einen. Du weißt ja, wie es geht. Bis nächste Woche dann!“
- **Haken:** Er überspringt das Bootstraining und hat in Etappe 4 Nachteile! Ihm fehlt das Wissen über die Trägheit in Kurven (früh bremsen) – bei der Schnellboot-Flucht wird er daher vermutlich scheitern.

**Sicher (Feuerwehrboot auf dem reißenden Fluss):**
- Kapitän erklärt Trägheit in Kurven (langsam fahren!) und Lösch-Manöver (anhalten, querstellen, löschen).
- **Challenge:** 3 Feuer in unter 2 min löschen & max. 2 Felskontakte.
- **Ergebnis:** Geschafft → **4 Tage** vergangen (+ Boots-Wissen für Etappe 4!). 3 Felskontakte ODER > 2 min → **7 Tage** vergangen.

**🎓 Lerneffekt Etappe 3**
- **Vorausschauendes Denken:** Masse und Trägheit von Schiffen einkalkulieren (frühzeitig abbremsen).
- **Strategische Neugier:** Erkennen, dass das Erlernen einer neuen Mechanik (Boot fahren) langfristig wertvoller sein kann als das Wählen einer gewohnten Routine.

---

#### 🌴 Etappe 4: Südostasien / Dschungel (Fokus unter Stress vs. Geduld im Wind)

**Risiko (Schnellboot-Flucht vor der Polizei):**
- **Szenario:** Kenji kapert das Schnellboot, die Polizei nimmt mit Sirenen die Verfolgung auf!
- **Gameplay:** Zu langsam → Polizei holt ihn ein. Blindes Vollgas → Boot zerschellt an den Felsen. Kurve 1 zeigt haarscharf, dass Vollgas nicht reicht.
- **Ergebnis:** Geschafft → **1 Tag** vergangen. Eingeholt / zerschellt → eine kurze Geschichte wird erzählt (7 Tage Gefängnis), danach ist Kenji wieder frei → **7 Tage** vergangen.

**Sicher (Container-Kran bei Wind):**
- **Szenario:** 4 Container müssen auf ein Frachtschiff verladen werden, während Wind weht.
- **Gameplay:** Wind driftet den Container seitlich ab. Kenji muss das Pendeln des Kranarms mit Feingefühl ausgleichen.
- **Großzügige Zeit – Geduld ist die Aufgabe:** **6 Minuten für 4 Container.** Das reicht, um sich Zeit zu lassen und in Ruhe zu arbeiten. Die Zeit ist dafür da, möglichst **fehlerfrei** zu bleiben – nicht, um sie zu unterbieten.
  - **Wer hetzt, verliert Zeit:** Ruckartiges Drehen oder Anhalten bringt den Container ins Pendeln. Dann bleiben nur zwei Auswege: **ewig warten**, bis das Pendeln ausschwingt – oder den Container **ganz nach oben ziehen**, damit das Seil kurz wird und das Pendeln schnell abklingt (danach wieder langsam absenken).
  - **Rahmenbedingungen (Vorgabe):** Seil ganz **einziehen ~10 s**, ganz **ausfahren ~10 s**. Ein Container am **langen Seil** pendelt nach einem Anstoß **~1 min**, bis er ruhig hängt.
  - **Feinabstimmung der Physik** (Wind-Zyklen, Seillängen, Kranbewegung, Dämpfung) erfolgt bei der Umsetzung so, dass diese Rahmenbedingungen stimmen und alle 4 Container in 6 min mit höchstens 2 Fehlern schaffbar sind.
- **Wind in Zyklen:** Der Wind kommt abwechselnd **von links, von rechts, von links, von rechts …** Jede Phase baut sich von **0 langsam bis stark** auf und fällt dann **ruckartig auf 0** zurück. Wer den Moment verpasst, erlebt, wie der ausgelenkte Container **zurückpendelt**. Er wird **nicht angesagt** – Kenji soll das Muster selbst entdecken. Sichtbar ist er nur über Windsack/Flaggen und den Windpfeil im HUD.
- **Nicht jeder Container bei jedem Wind:** Jeder Stellplatz bzw. Container lässt sich nur in bestimmten Phasen des Zyklus sicher verladen (z. B. wenn der Wind längs der Lücke weht oder in der Flaute). Zur falschen Zeit treibt der Wind den Container gegen die Nachbarn.
- **Der Sonder-Container (Knobel-Aufgabe):** Ein Stellplatz liegt **außerhalb der Reichweite** des Krans – der Ausleger dreht bzw. reicht nicht weit genug hinüber. Er ist nur erreichbar, wenn Kenji bei **voller Windstärke** das Seil **fast ganz lang** lässt: Der Wind drückt den hängenden Container seitlich hinaus (je länger das Seil, desto weiter der Versatz), bis er **knapp über** seiner Position steht – dann **fallen lassen**. Bricht der Wind vorher ruckartig ab, pendelt der Container zurück, und Kenji muss auf die nächste Phase **aus derselben Richtung** warten.
  - Erst wer den Wind-Zyklus kennt, weiß, **wann** der Maximalwind kommt – und dass man ihn hier nicht als Störung, sondern als **Werkzeug** nutzt.
  - Der Container kommt dabei **schräg** an und wird in die Lücke **fallen gelassen** statt sanft abgesetzt – das zählt als **ein Fehler** (siehe Fehlergrenze).
- **Der Präzisions-Container (Gegenstück):** Eine Lücke ist **minimal** – kaum breiter als der Container. Er passt nur bei **Flaute (0 Wind)** und **null horizontaler Bewegung**: Ausleger und Laufkatze stehen still, das Pendeln ist komplett ausgeschwungen, erst dann senkrecht absenken.
  - Die beiden Sonder-Container bilden die Extreme des Zyklus: einer braucht den **stärksten** Wind, der andere **gar keinen**.
- **Die Lektion:** Abwarten, beobachten, die richtige Gelegenheit erkennen – und dann ruhig zugreifen.
- **Steuerung (wie Fliegen):** L-Stick ←→ / ← → = Ausleger drehen · L-Stick ↕ / ↑ ↓ = **Laufkatze vor/zurück** (bewegt das Seil auf dem Ausleger nach außen/innen) · R-Stick ↕ / W S = Haken heben/senken · **B** = greifen/lösen · **Y** = ein-/aussteigen.
- **Marker am Ausleger:** Am Ausleger sind **Markierungen** (Skala) angebracht, an denen Kenji sieht, wo die Laufkatze steht – und damit, wo der Container abgelassen wird. Zusammen mit dem Drehwinkel des Auslegers lässt sich so jede Position **auch blind** anfahren.
- **Aufbau:** Das Frachtschiff liegt **längsseits am Kai**, der Kran steht auf dem Kai. Das Deck ist voll beladen bis auf **4 Lücken**:
  1. **Doppel-Lücke, erster Container:** Zwei Lücken liegen **recht mittig** direkt nebeneinander. Der erste muss **präzise** sitzen – steht er schief oder versetzt, passt der zweite nicht mehr.
  2. **Doppel-Lücke, zweiter Container = Präzisions-Container:** Quasi **null Toleranz**, nur bei **0 Wind und 0 horizontaler Bewegung**.
  3. **Reichweiten-Container (Windtrick):** **Außerhalb der Reichweite** des Krans – volle Windstärke, fast volles Seil, knapp über die Position bringen und fallen lassen.
  4. **Verdeckter Container:** **Hinten, diagonal entfernt** vom ersten Container (aber nicht auf maximaler Reichweite). Aus der Kamera ist die Position **nicht richtig zu sehen** – Kenji muss sich an den vorderen Reihen, den **Markern am Ausleger** und am Wind orientieren und ihn **blind setzen**. *(Exakte Position noch festzulegen.)*
     - **Versteckte Toleranz:** Diese Lücke hat **mehr Spiel**, als es aussieht – für den Spieler nicht offensichtlich. Wer sich sauber an Markern und Raster orientiert, schafft es, auch ohne die Lücke zu sehen.
- **Physik:** Der Container hängt am Seil wie ein Pendel; Wind und eigene ruckartige Bewegungen bringen ihn zum Schwingen (Trägheit wie beim Boot in Etappe 3). Seil + Haken werden selbst gebaut, das Kran-Modell bewegt nur Ausleger und Laufkatze.
- **Gegen den Wind drehen:** Dreht Kenji den Ausleger **gegen** den Wind, bremst der Wind das Nachschwingen des Containers – er kann **schneller** drehen, ohne dass es pendelt; je stärker der Wind, desto schneller. **Mit** dem Wind ist es umgekehrt: Der Wind schiebt den Container zusätzlich an, hier muss er langsamer drehen.
- **Ansicht & HUD:** Die Kamera bleibt **außen** am Kran wie beim Flieger (keine Kabinen-Ansicht). Das HUD zeigt:
  - **Pendel-Anzeige:** Punkt in einem Kreis – schwingt mit dem Container und wird **grün**, wenn er ruhig hängt (Pflicht für den Präzisions-Container).
  - **Drehwinkel des Auslegers** in Grad (z. B. „47°“).
  - **Ladeplan (ein-/ausblendbar):** Zu Beginn der Aufgabe bekommt Kenji einen **Plan** des Decks von oben, auf dem alle 4 Ziel-Lücken eingezeichnet sind – jeweils mit **ca. Drehwinkel (°)** und **Marker-Nummer** am Ausleger. Per Taste ein- und ausblendbar (Vorschlag: **D-Pad ←** / Tastatur **P**). Wer den Plan nutzt, kann mit Drehwinkel + Markern **jede** Lücke – auch die verdeckte – sicher treffen.
  - **Wind-Anzeige:** Pfeil für **Richtung** (links/rechts) + **Stärke** (Balken 0 → max), damit Kenji den Zyklus beobachten und den Maximalwind bzw. die Flaute kommen sehen kann.
  - **Seillänge / Höhe** des Hakens.
  - **Fehlerzähler** (●●○) und **Restzeit** (6:00).
  - **Container-Zähler** (z. B. 2/4).
- **„Präzise verladen“:** Container steht in der Markierung, wird sanft aufgesetzt und pendelt beim Lösen nicht mehr.
- **Fehlergrenze: 2 Fehler erlaubt.** Ein Fehler ist z. B. Anstoßen an einen Nachbar-Container, zu hartes Aufsetzen oder Fallenlassen.
  - **Einer davon ist praktisch eingeplant:** Der Reichweiten-Container (Windtrick) lässt sich nur durch Fallenlassen verladen. Damit bleibt **ein** echter Fehler als Puffer für die übrigen drei.
  - **Lektion:** Manchmal muss man einen kleinen Fehler bewusst in Kauf nehmen, um das Ziel zu erreichen – und den Puffer dafür nicht vorher verspielen.
- **Ergebnis:** Alle 4 Container in 6 min verladen, höchstens 2 Fehler → **4 Tage** vergangen. Zeit abgelaufen ODER 3. Fehler → **7 Tage** vergangen.

**🎓 Lerneffekt Etappe 4**
- **Reaktionsschnelligkeit & Stress-Fokus:** Unter Zeitdruck ruhig bleiben, Hindernisse analysieren und die feine Balance zwischen Tempo und Kontrolle finden.
- **Feingefühl & Geduld:** Äußere Störfaktoren (Wind, Schwung) akzeptieren und durch gezieltes Gegensteuern ausgleichen.
- **Beobachten & Muster erkennen:** Nicht sofort losstürmen, sondern Abläufe (Wind-Zyklus) beobachten und auf den richtigen Moment warten.
- **Um die Ecke denken:** Ein Hindernis (der Wind) kann zur Lösung werden, wenn man es geschickt einsetzt.
- **Planen & Hilfsmittel nutzen:** Einen Plan lesen und Messwerte (Grad, Marker) übertragen, statt nur nach Augenmaß zu arbeiten.
- **Fehler einplanen:** Perfektion ist nicht immer möglich – manchmal gehört ein kleiner, bewusster Fehler zum Weg, und man muss sich den Spielraum dafür aufheben.

---

#### 🏙️ Etappe 5: Chinesisches Meer / Küste (Code-Erinnerung vs. Air-Race)

**Risiko (Highspeed-U-Boot durch die Felsenschlucht):**
- **Das Code-Rätsel:** Ein Ziffernfeld mit NUR 1 Versuch! Kenji muss sich an das Detail aus Etappe 1 erinnern (1402).
- **Gameplay:** Nach richtiger Eingabe folgt eine rasante Slalom-Fahrt durch eine enge Unterwasser-Schlucht.
- **Ergebnis:** Geschafft → **1 Tag** vergangen. Falscher Code / Crash → **7 Tage** vergangen.

**Sicher (Kunstflug-Show im Mustang – Red Bull Air Race):**
- **Szenario:** Kenji nimmt an einer Flugshow teil, um sich das Ticket zu verdienen.
- **Gameplay:** Preflight-Check absolvieren, dann mit der P-51 Mustang einen Slalom-Parcours durch Pylone/Zielringe über dem Meer fliegen!
  - Preflight-Check hier **ohne Timer und ohne Kurzschluss**: Ein Ansager führt Schritt für Schritt durch – an ihm kann Kenji nicht scheitern. Gescheitert werden kann erst im Parcours.
- **Ergebnis:** Sauber absolviert → **4 Tage** vergangen. Crashes/Pylonen gerammt → **7 Tage** vergangen.

**🎓 Lerneffekt Etappe 5**
- **Transferleistung & Gedächtnis:** Beiläufig erhaltene Informationen speichern und im entscheidenden Moment abrufen.
- **Räumliche Präzision:** Komplette Beherrschung von Drehungen, Rollen und Abständen im dreidimensionalen Raum.

---

#### 🌋 Etappe 6: Ankunft in Japan (Extreme Supersonic Vulkan-Flucht vs. Shinkansen-Präzision)

**Risiko (Alpha Jet Vulkan-Schlucht & Krater-Flucht):**
- **Fluggerät & Speed:** Alpha Jet (fliegt knapp über Mach 1 bei Vollgas).
- **Gameplay:**
  1. Anflug mit Vollgas auf das glühende Höhlensystem unter dem Mt. Fuji.
  2. **Die Extrem-Spalte:** Kurz vor dem Höhlenende muss das Flugzeug um exakt 90° quer gelegt werden (Messerflug), um haarscharf bei Vollgas durch eine engste Felsspalte zu passen!
  3. **Das Brems- & Steigmanöver:** Sofort nach der Spalte voll in die Eisen steigen (Bremse/Umkehrschub halten), um vor der brennenden Magma-Wand abzubremsen, die Nase um 90° hochreißen und mit Vollgas senkrecht aus dem ausbrechenden Krater schießen!
  4. Punktlandung am Strand.
- **Schwierigkeit:** Sehr schwer zu schaffen, erfordert absolute Spitzenkonzentration unter extremem Druck!
- **Ergebnis:** Geschafft → **1 Tag** vergangen. Gescheitert → eine kurze Geschichte wird erzählt (7 Tage Krankenhaus) → **7 Tage** vergangen.

**Sicher (Shinkansen Express – Das Stellwerk-Labyrinth):**
- **Szenario:** Damit der japanische Zug auf die Sekunde pünktlich bleibt, hilft Kenji im Stellwerk aus.
- **Gameplay:** Weichen-Stellen auf Zeit in einem komplexen Gleis-Labyrinth.
- **Ergebnis:** Null Fehler & pünktlich → **4 Tage** vergangen. Verheddert / Falsche Weiche → **7 Tage** vergangen.
- **Entwurf (01.10.2026, noch nicht bestätigt):**
  - **Ansicht:** Kenji läuft zum Stellwerk-Häuschen, **Y** = einsteigen. Kamera schräg von oben auf den Bahnhof, Shinkansen fahren in 3D; im **HUD** der Gleisplan als Stellwerkspult (Gleise, Weichen, Signale rot/grün).
  - **Steuerung:** L-Stick / Pfeiltasten = Markierung von Weiche zu Weiche, **B** = Weiche umstellen.
  - **Ablauf:** Züge kommen nacheinander, jeder mit **Zielgleis** + **Abfahrtszeit** (Fahrplantafel im HUD). Richtige Fahrstraße → Signal grün. Weiche unter einem fahrenden Zug ist **gesperrt** → vorausdenken. Zu spät gestellt → Zug wartet vor Rot, verliert Zeit.
  - **Steigerung:** erst ein Zug nach dem anderen, später zwei gleichzeitig mit kreuzenden Wegen; der **letzte Zug ist der kniffligste**.
  - **Offene Fragen:** (1) Ansicht so ok? (2) „Null Fehler“ streng oder kleine Fehlergrenze wie beim Kran (z. B. leicht verspätet ok, falsches Gleis nicht)? (3) Umfang – Vorschlag ~6 Züge in 4–5 min.
  - **Modelle:** Shinkansen vorhanden (stark verkleinern); Gleise, Bahnsteige, Häuschen aus Code.

**🎓 Lerneffekt Etappe 6**
- **Konzentration unter Extremdruck:** Selbst in schier unmöglichen Situationen kühlen Kopf bewahren und millimetergenau steuern.
- **Konzentration bis zur letzten Sekunde:** Auf dem sicheren Weg lernen, auch kurz vor dem Ziel niemals nachzulassen oder nachlässig zu werden.

---

### 🏆 Das 5-Stufen-Finale in Japan

| Stufe | Verbrauchte Zeit | Restzeit | Freigeschaltetes Event & Gameplay |
|---|---|---|---|
| **Stufe 1 (Pro)** | 6 Tage (Nur 1-Tag-Wege) | 5 volle Wochen | **Der Ultimative Run:** Flugzeug kapern → Mt. Fuji Anflug → Not-Absprung → Punktlandung am Gipfel → Snowboard-Abfahrt → Sprung ins Meer → 5m Monsterwellen-Surfen! (Schaltet das Minispiel dauerhaft im Hauptmenü frei) |
| **Stufe 2 (Fast Perfekt)** | 9–12 Tage (1–2× sicherer Weg ODER 1× Fehlschlag, Rest Risiko geschafft) | ~4 Wochen | **Rundflug & Hohe Wellen:** Kenji und sein Freund buchen einen Rundflug im Kunstflugzeug (P-51 Mustang – nutzt dieselben Kunstflug-Manöver wie der Jet, nur etwas langsamer) direkt um den Mt. Fuji herum, genießen die Aussicht und surfen danach auf hohen, schnellen Wellen. |
| **Stufe 3 (Solide)** | 15–21 Tage | 3–4 Wochen | **Mittlere Wellen:** „Schade, dass wir keine Zeit für den Fuji-Gipfel haben...“ → Gemeinsame Strandtage und Surfen auf schönen mittleren Wellen. |
| **Stufe 4 (Lern-Run)** | 24–39 Tage | 1–2 Wochen | **Kleine Wellen:** „Lass uns zusammen surfen lernen!“ → Gemütliches Üben auf kleinen Anfänger-Wellen. |
| **Stufe 5 (Notfall)** | 42 Tage (Alle Versuche gerissen) | 1 Nachmittag | **Das Versprechen:** Kurze Umarmung am Strand, Füße kurz ins Wasser halten: „Nächstes Jahr machen wir den Pro-Run!“ |

> **Hinweis zur Tage-Rechnung:** Jede Etappe kostet 1, 4 oder 7 Tage – die Summe nach 6 Etappen liegt daher immer im 3er-Raster (6, 9, 12 … 39, 42). Die Stufen-Grenzen decken dieses Raster lückenlos ab.

### 🎓 Übergeordneter Lerneffekt des Finales

- **Verbindung von Einsatz & Belohnung:** Erleben, dass kluges Planen, Durchhalten und saubere Leistung zu außergewöhnlichen Erfolgen führen.
- **Keine Frustration bei Rückschlägen:** Jedes Ende bietet einen versöhnlichen, positiven Abschluss und motiviert dazu, das gelernte Wissen im nächsten Anlauf noch besser einzusetzen.
