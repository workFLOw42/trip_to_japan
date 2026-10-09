# Reise nach Japan 🇯🇵

**▶️ Spielen: https://workflow42.github.io/trip_to_japan/**
(Chrome/Edge empfohlen – Edge hat die natürlichsten Stimmen. Controller oder Tastatur. Nach dem ersten
vollständigen Laden auch offline spielbar, auf Tablets über „Zum Startbildschirm hinzufügen“ als App installierbar.)

Ein 3D-Abenteuerspiel im Browser: **Kenji** will in den Sommerferien ohne Geld zu seinem Freund nach
**Fukuoka** in Japan – über 6 Etappen mit X-Wing, U-Boot, Transall, Feuerwehrboot, Container-Kran, Mustang
und Alpha Jet, bis zum Finale am Mt. Fuji. Er hat 6 Wochen (42 Tage); jede Etappe kostet je nach Weg
1, 4 oder 7 Tage, und die übrigen Tage bestimmen, wie groß das Finale wird.

Technische Basis ist die Engine des **[Flugspiel](https://github.com/workFLOw42/flightsimulator)**
(reines HTML + JavaScript + three.js, keine Installation).

## Stand

Das Konzept steht in **[Konzept.md](Konzept.md)**. Spielbar sind **Etappe 1 bis 6** (beide Wege), danach folgt
vorerst ein Platzhalter.

**Startmenü:** *Neues Spiel* oder – zum Testen – direkt **E2 … E6** und **E6 Höhle** (springt direkt in den Autopiloten
der Vulkanhöhle) (linker Stick / ← → wählen, A / Enter starten).

### Etappe 1 – Der Aufbruch am Strand
Festland (`etappe1.js`, Vorbild Fukuoka-Beach): im Westen das offene Meer mit U-Boot, Wracks, Schiffen und Orcas, dann ein
Strand und eine Wiese mit Nadelbäumen. Die Schule **AEG** ist ein festes Gebäude, dahinter eine Stadt und schräg dahinter
die **Ariane** auf ihrer Rampe. Am Strand ein kleiner Parkplatz mit dem X-Wing, daneben der U-Boot-Ring. Im Sonar sieht man
unten die Küste, oben das Meer mit den Wracks.
- **Intro:** Kenji kommt aus der Schule, die Kamera fährt heran und schwenkt hinter ihn, die Erzählstimme
  erzählt die Geschichte. Schon nach dem Schwenk kann man laufen; einsteigen erst nach der Ansage.
- **Zwei Wege**, markiert mit Lichtsäule und Schild: **X-Wing „1 Tag“** und **U-Boot „4 Tage“**.
- **X-Wing:** Startsequenz in 10 s – ohne Anleitung (man soll scheitern, wenn man sie nicht kennt).
  - geschafft → selbst zum Radarpunkt fliegen → **1 Tag**
  - verpasst → Autostart ins All, **Mars-Trip**: landen, leuchtenden Stein holen, zurück zur Erde → **7 Tage**
  - Absturz (egal wo) → **7 Tage**
- **U-Boot:** im gelben Ring am Strand einsteigen. Code ist schon eingegeben (Ziffernfeld, nur kurz sichtbar).
  Fünf Wracks (2 Segler, 3 Liberty) suchen – das Periskop zeigt nur nach einem **Sonar-Ping (B)** ein Bild,
  das über 10 s verblasst. Zwei **unterschiedliche** Wracks fotografieren (Controller Y / Tastatur F; angezeigt wird die passende Taste) → **4 Tage**.

### Etappe 2 – Die Wüste
Nur Wüste, kein Wasser: Dünen, Felsen, Kakteen, Flugfeld, Oase mit Palmen. Leise arabische Musik zu Beginn, Wüstenwind.
- **X-Wing-Falle („1 Tag“):** Startsequenz mit **Kurzschluss** – alles vertauscht (Bremse ↔ Gas, links ↔ rechts,
  hoch ↔ runter), einziger Hinweis ist die rote Leuchte ⇄.
  - geschafft → Flug mit vertauschter Steuerung zum Radarpunkt → **1 Tag**
  - verpasst → Autopilot zum **Mond**, Stein auf der Plattform der Mondbasis holen → **7 Tage**
- **Transall-Flugschule („4 Tage“):** Der Pilot (männliche Stimme) erklärt Startsequenz, Kurzschluss, Start,
  Abwurf und Landung, dann fragt er: *„Du kannst doch fliegen?“*
  - NEIN → „Für Anfänger ist das leider nichts“ → **7 Tage**
  - JA → Startsequenz (ohne Zeitlimit), selbst starten, auf 270–330 m zur Oase, Kiste mit **B** abwerfen.
    Merksatz: *Schub in Prozent × 5 = Meter vor dem Ziel.* Treffer (± 50 m) → **4 Tage**, daneben → **7 Tage**.

### Etappe 3 – Der Fluss
Grüne Uferlandschaft mit einem gewundenen Fluss: sechs enge Kurven mit Geraden dazwischen, Sandufer, Bäume,
Felsen außen in den Kurven und in der Flussmitte, dazu eine versetzte Felsgruppe zwischen Feuer 1 und 2.
Wüstenwind wie in Etappe 2 (ohne Musik).
- **X-Wing („1 Tag“):** normale Startsequenz in 10 s (kein Kurzschluss).
  - geschafft → zum Radarpunkt → **1 Tag**, aber ohne Boots-Wissen für Etappe 4
  - verpasst → Autopilot zum **Mond** → **7 Tage**. Der Text hängt davon ab, wo Kenji schon war: Mars und Mond
    („Weltraum-Profi“), nur Mond (*„Du schon wieder … den Stein verloren“*), nur Mars, oder zum ersten Mal
    (volle Flugerklärung).
- **Feuerwehrboot („4 Tage“):** im gelben Ring am Ufer einsteigen (wie beim U-Boot). Der Kapitän erklärt Trägheit
  in Kurven, Strömung und Löschen; die Zeit läuft erst danach. Drei Feuer am Ufer flussabwärts in **2 Minuten** löschen
  (bremsen, quer stellen mit der Nase zum Feuer, **B**), höchstens **2 Felskontakte**.
  Das Boot ist hier träger als sonst: es bremst langsam, rutscht in Kurven weiter geradeaus, und das Ruder wird mit
  der Fahrt steifer – mit Vollgas kommt man durch keine Kurve. Ufer kosten fast die ganze Fahrt.
  Geschafft → *„Du bist ein echter Held!“*; Felsen zählen weiter, bis der Satz zu Ende ist → **4 Tage**
  (+ Boots-Wissen). 3. Felskontakt oder Zeit um → **7 Tage**. Live abgestimmt: ~16 s Rest bei 2 Kontakten.

### Etappe 4 – Der Hafen
Hafenbecken mit Kai (glattes Wasser), Frachtschiff längsseits (Ladung als Fächer um den Kran), Container-Kran und ein Kanal
(60 m breit, sieben Kurven, Häuser am Ufer) bis zur Mündung aufs offene Meer mit Schiffen.
- **Schnellboot („1 Tag“):** im gelben Ring am Kai einsteigen (wie bei den anderen Booten). Kenji kapert das Boot, zwei
  Polizeiboote mit Blaulicht jagen ihn: eines kommt von hinten und nimmt die Kurven so schnell, wie der Radius es zulässt, das zweite wartet in einem Seitenarm und schießt an der
  Abzweigung heraus. Durch den Kanal bis zu den gelben Bojen an der Mündung. Das Ruder wird mit der Fahrt steifer –
  Kurve 1 schafft man mit Vollgas nur haarscharf. HUD: Abstand zur Polizei, Rest bis zur Mündung, Felskontakte.
  Risiko-Variante: nur perfekt gefahren (Vollgas, vor jeder Kurve passend bremsen) knapp zu schaffen. Entkommen → **1 Tag**. Eingeholt (< 15 m) oder 3 Felskontakte → kurze Geschichte (eine Woche Gefängnis) → **7 Tage**.
- **Container-Kran („4 Tage“):** im gelben Ring am Kranfuß einsteigen. Vier Container vom Kai in vier Lücken, **6 Minuten**,
  höchstens **2 Fehler**. Der Container hängt wie ein Pendel; Wind kommt abwechselnd von links und rechts, baut sich
  langsam auf und fällt ruckartig ab (nicht angesagt).
  - **Steuerung in Stufen:** L-Stick / ← → dreht den Ausleger um **5°** je Druck, **LT/RT** bzw. **Q/E** fährt die
    Laufkatze einen **Marker** nach innen/außen, R-Stick / W S hebt und senkt, **B** hängt an und löst, **P** Ladeplan.
  - Ohne Last hängt der Haken senkrecht, ganz oben hängt die Last fest unter der Katze – dort beruhigt sie sich sofort.
  - **HUD:** Pendelpunkt (grün = ruhig), Winkel und Marker groß, Seil, Abstand zu dem, was darunter liegt
    (grün = aufgesetzt), Wind, Container, Fehler, Zeit. Über einem Lager-Container „▼ tiefer“ / „B: anhängen“.
  - **Ladeplan:** Draufsicht mit Fächer, Lücken, Drehbereich, Ausleger und Haken; je Lücke Winkel und Marker, dazu
    Seil-Richtwerte (greifen 31 m · über der Ladung bis 24 m · in der Lücke 26,5 m). Wie man eine Lücke schafft,
    steht bewusst nicht drin.
  - Lücke 1 und 2 liegen hintereinander in der Mitte (2 nur bei Flaute und ruhig), Lücke 3 außerhalb des
    Drehbereichs (nur mit vollem Seitenwind, dann fallen lassen = 1 Fehler, aber er sitzt), Lücke 4 hinten außen.
  - Geschafft → **4 Tage**, Zeit um oder 3. Fehler → **7 Tage**.

### Etappe 5 – Chinesisches Meer (Hongkong)
Startinsel mit Bahn im offenen Meer, dahinter eine Hochhaus-Skyline. Auf der Bahn starten und landen keine anderen
Flieger (am Himmel fliegen trotzdem welche).
- **Air Race mit der Mustang („4 Tage“):** Startsequenz ohne Zeitlimit und ohne Erklärung, dann ein Parcours über dem
  Meer, gewertet **auf Zeit** (Ziel unter **90 s**): Slalom durch Pylonen-Tore, **Messerflug** durch ein schmales hohes
  Tor (mind. 60° Querlage), **Looping** zwischen Eingangs- und Ausgangsring (das Spiel prüft den ganzen Looping; der
  Ausgang erscheint erst ab der Hälfte), **Steilflug** senkrecht durch zwei Ringe übereinander, zum Schluss eine
  **Schraube** bis zum Zielring. Sichtbar sind nur das aktuelle (leuchtend, mit Säule) und das nächste Tor; ein Pfeil
  am Rand zeigt zum aktuellen, wenn es nicht im Bild ist.
  Strafen: Tor verpasst +5 s, Pylon gestreift +3 s, zu hoch +2 s, Messerflug/Schraube vergessen +3 s, Looping ausgelassen
  +15 s. Im Zielring stoppt die Zeit, danach **sauber auf der Insel landen** (20 % Schub). Absturz → **7 Tage**.
- **U-Boot-Schlucht („1 Tag“):** U-Boot und gelber Ring an der Küste neben einem kleinen Dorf (Pandas, Möwen). Nach dem
  Einsteigen Schwarzblende, dann das Code-Feld: **14 02** mit nur **einem Versuch** (der Code stand nur in Etappe 1 im
  U-Boot). Danach durch die Felsenschlucht: Wände, Decke, Felsbogen, Felsrippe, Sonar-Karte nach dem Ping (B).
  Höchstens **2 Kontakte**, Zeitlimit **250 s**. Geschafft → **1 Tag**; falscher Code, 3. Kontakt oder Zeit um → **7 Tage**.

### Etappe 6 – Japan (Tokio, Fuji) → Fukuoka
Stadt **Tokio** auf der Startinsel mit Hochhäusern, Möwen und Mini-Godzillas; hinter Kenji stapft ein **Riesen-Godzilla**
durch die Häuser. Links der Bahnhof **東京 Tokio** mit dem **Shinkansen** (das Gleis läuft als Ring um die Insel), rechts die
Startbahn mit dem **Alpha Jet**. Voraus der **Mount Fuji** (2 km hoch, steht im Meer). Musik „Ancient Japan“.
- **Alpha Jet („1 Tag“):** Startsequenz mit Ansage und 10-s-Countdown wie beim X-Wing. Verpasst → Flughafenpolizei → **7 Tage**.
  Geschafft → dem roten Radarpunkt bis kurz vor den Fuji folgen, Blende, **Höhle im Vulkan**: Autopilot ~18 s mit Ansage,
  dann ~15 s selbst, immer Vollgas, ohne Gyroskop. Berührung oder unter 100 % → **7 Tage** (ohne Ansage). Am **Ausgang ins
  Licht** sofort (weißer Blitz) die **Filmsequenz**: nur Vulkan und Meer, der Jet schießt mit Überschallknall senkrecht aus
  dem Krater, Ausbruch mit Rauchsäule, Lavaströmen und Grollen (kein Motorton), langsame Abblende. Danach 500 m / 50 %,
  *„Du bist der absolute Wahnsinn! …“*, landen auf dem Flugfeld am **Fukuoka-Beach** (Jets setzen bis ~30 % Schub auf, bremsen
  mit Umkehrschub) → **1 Tag**. Absturz → **7 Tage**.
- **Shinkansen („4 Tage“), `etappe6c.js`:** Stellwerk ausgefallen, Weichen defekt – Kenji wählt die Gleise. ~98 s Fahrt
  0 → 300 → 0 km/h, 23 Runden: oben im HUD je Gleis zwei Symbole (grün ok / rot durchgestrichen), genau ein Gleis ist bei
  beiden grün. L-Stick: ein Druck = ein Gleis. Wahlzeit 2 / 1,5 / 1 s (bis 150 / bis 250 / darüber), dann **2 s Ruhe** (HUD
  leer), Signale erst nach der Wahl sichtbar. **3 Gleise erst beim Bremsen ab ~195 km/h** (das neue Gleis zweigt in der Mitte
  ab). Kamera über dem Triebwagen. Falsches Gleis → Notbremsung → **7 Tage**; alles richtig → Einfahrt Fukuoka-Beach → **4 Tage**.
- **Ende (beide Wege):** Globus – der Faden wächst von Tokio nach **Fukuoka**, der lila Punkt wird zur 🌊. Danach steht Kenji
  am **Fukuoka-Beach**: Meer mit weißem **Torii** und den **Meoto-Iwa** (Vorbild Sakurai-Futamigaura), Strand mit Palmen,
  Surfbrett im Sand (Ring „Surfen“, kommt bald), Lagerfeuer mit Samurai, eine Samurai-Gruppe, Godzillas; dahinter das Vorfeld
  mit der C-400 (Pfeil, Schild noch leer), die Landebahn, der Bahnhof **Fukuoka-Beach** (Gleis entlang der Küste) und die
  Stadt mit einem 130 m hohen Riesen-Godzilla.

Zwischen den Etappen zeigt der **Globus** den bisherigen Weg (blau = München, gelb = Etappen, lila = Fukuoka; am Ende von Etappe 6 wird daraus die 🌊).

## Steuerung zu Fuß

| Controller | Tastatur | |
|---|---|---|
| linker Stick | Pfeile | laufen (bis zur Hälfte gehen, weiter rennen) |
| rechter Stick | J L I K | umsehen |
| A | Leertaste | springen (auf Mond und Mars viel höher) |
| B | B | Aerial Evade |
| X / Y | X / Y | Silly Dance / Butterfly Twirl · Y am Fahrzeug: einsteigen |
| L3 halten + Stick | M halten + Pfeile | Moonwalk |
| RT / LT im Wasser | E / Q | tauchen / auftauchen |
| D-Pad ↑ | H | Anleitung (Pause) |
| D-Pad ← | T | aktuelle Aufgabe (keine Pause) |
| D-Pad ↓ | N | Ton an (Stimme) / aus (Untertitel) |

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | wird von `tools/build_engine.ps1` erzeugt (HUD-Markup aus dem Flugspiel) |
| `engine/` | Flugspiel-Engine + Modelle, **unverändert** kopiert von `tools/build_engine.ps1` |
| `story.js` | Spiellogik und Etappe 1 – hängt sich per Wrapper in die Engine ein |
| `etappe1.js` | Etappe 1 als Festland: Strand, Nadelbäume, Schule „AEG“ (fest), Stadt, Ariane, X-Wing-Parkplatz, U-Boot und Ring |
| `etappe2.js` | Etappe 2 (Wüste, X-Wing-Falle, Transall-Flugschule) |
| `etappe3.js` | Etappe 3 (Fluss, Feuerwehrboot, X-Wing ohne Kurzschluss) |
| `etappe4.js` | Etappe 4: Hafen-Welt und Container-Kran |
| `etappe4b.js` | Etappe 4: Schnellboot-Flucht (Kanal, Polizei) |
| `etappe5.js` | Etappe 5: Insel, Skyline, Küstendorf, Air Race mit der Mustang |
| `etappe5b.js` | Etappe 5: U-Boot an der Küste, Code-Feld, Felsenschlucht mit Sonar-Karte |
| `etappe6.js` | Etappe 6: Tokio mit Bahnhof (Ringgleis) und Alpha Jet, Startsequenz, Hinflug, Fuji (2 km) im Meer; Fukuoka-Beach (Festland: Strand, Torii, Meoto-Iwa, Surfbrett, Palmen, Lagerfeuer, Vorfeld, Bahn, Bahnhof, Stadt), Ende mit Globus |
| `etappe6c.js` | Etappe 6c: Shinkansen – Weichen wählen (eigene Strecke, 2 → 3 Gleise, HUD, Notbremsung, Einfahrt) |
| `etappe6b.js` | Etappe 6b: Höhle im Vulkan als eigene Szene (Autopilot, kurvige Röhre in Abschnitten, Ausgang ins Licht), Filmsequenz mit Ausbruch, Landung am Strand. Der frühere Senkrechtschacht liegt in `_intern/archiv/e6b_senkrechtschacht/` |
| `flucht_glb.js` | Schnellboot und Polizeiboot (verkleinert) als Base64 |
| `hafen_glb.js` | Frachtschiff (verkleinert), Container und Kran als Base64 |
| `kenji_glb.js` | Kenji als eingebettetes GLB (aus `models/kenji.glb`) |
| `schildkroete_glb.js` | Schildkröten für Etappe 3 (verkleinert und aufgehellt, 1,5 MB) |
| `krokodil_glb.js` | Krokodile im Fluss (Etappe 3), unverändert (Lizenz ND), 7,7 MB |
| `tiere.js` | Tiere und Inseln: fliegende Möwen (Etappe 1, 4, 5, 6 und an jeder Insel), Hunde (1), Pandas (5), Godzillas und Samurai (6), Mount Fuji statt der Kegel-Hügel |
| `fuji_glb.js` | Mount Fuji für alle Inselberge (vereinfacht: 2.752 Dreiecke, Höhe und Farbe vom Original abgetastet) |
| `zug_glb.js` | Shinkansen (Etappe 6): Triebwagen und Mittelwagen aus dem Original geschnitten, hinterer Triebwagen gedreht (3,3 MB statt 26 MB) |
| `godzilla_glb.js` | Godzilla (Etappe 6): Mini-Godzillas (1 m) in der Stadt und am Strand-Flughafen, Riesen-Godzilla (60 m) hinter der Stadt; verkleinert und aufgehellt |
| `samurai_glb.js` | Samurai am Fukuoka-Beach (Etappe 6), sitzend und stehend |
| `surfboard_glb.js` | Surfbrett (Etappe 6: steckt am Fukuoka-Beach im Sand) |
| `campfire_glb.js` | Lagerfeuer, animiert (Etappe 6, Fukuoka-Beach) |
| `moewe_glb.js` | Möwen sitzend und fliegend (Etappe 1, 4, 5) |
| `panda_glb.js` | Panda (Etappe 5) |
| `hund_glb.js` | Labrador (Etappe 1), verkleinert (4,4 MB statt 9,3 MB) |
| `musik_snd.js` | Musik für Etappe 1 („Summer Vacation“, unter der Intro-Ansage leiser), 4 („Atlas Thailand“), 5 („Chinese Flute“) und 6 („Ancient Japan“), spielt zu Beginn leise (`story.etappenMusik`) |
| `fluss_snd.js` | Musik für Etappe 3 („Atlas Maldives“, 2:35), spielt zu Beginn leise wie die Wüstenmusik |
| `kamel_glb.js` | Kamel für die Herden in Etappe 2 (verkleinert: nur Grundfarbe als 512er JPEG, 1,7 MB) |
| `c400_glb.js` | Transall-Modell: C-400 als eingebettetes GLB (aus `models/c400.glb`, Nase gedreht); die alte C-160 (`transall_glb.js`) ist aus dem Spiel entfernt, `tools/build_engine.ps1` kopiert sie nicht mehr. Flugwerte bleiben die der Transall |
| `wueste_snd.js` | Wüsten-Sounds (Musik, Wind) als Base64 |
| `sw.js`, `manifest.json` | Offline-Cache und App-Installation (PWA) |
| `ENGINE_RISIKEN.md` | bekannte Stolperstellen der Engine-Übernahme |

Ladeordnung: `kenji_glb.js` → `story.js` → `etappe1.js` → `wueste_snd.js` → `kamel_glb.js` → `etappe2.js` → `schildkroete_glb.js` → `fluss_snd.js` → `krokodil_glb.js` → `etappe3.js` → `hafen_glb.js` → `musik_snd.js` → `moewe_glb.js` → `hund_glb.js` → `panda_glb.js` → `fuji_glb.js` → `tiere.js` → `etappe4.js` → `flucht_glb.js` → `etappe4b.js` → `etappe5.js` → `etappe5b.js` → `zug_glb.js` → `surfboard_glb.js` → `campfire_glb.js` → `godzilla_glb.js` → `samurai_glb.js` → `etappe6.js` → `etappe6b.js` → `etappe6c.js` → `engine/engine.js`. Die Engine ruft am Ende
ihres Boot-Blocks `STORY_HOOK` (Wrapper setzen) und `STORY_START` (Startszene) auf – die zwei Zeilen fügt das Build-Skript ein.

**Welten:** Jede Etappe baut ihre Kulisse in eine eigene Gruppe – `story.welt(n).add(obj)`, nie `scene.add(obj)`.
Sichtbar ist zentral nur die Welt der aktuellen Etappe und nur auf der Erde (Mond und Mars teilen sich den
Koordinatenraum, sonst stünden dort Wüstenfelsen oder die Schule). Beim Etappenwechsel `story.weltEntsorgen(n)`:
gibt alles frei, außer Objekten mit `userData.fremd = true` (Engine-Modelle mit geteilten Materialien – nur
abhängen). Der pre-commit-Hook lehnt `scene.add(` in `story.js`/`etappe*.js` ab; bewusst globale Stellen tragen
`// global-ok`.

Engine aktualisieren: `powershell -File tools/build_engine.ps1` (Flugspiel-Repo muss daneben liegen).

**Version / Offline:** Committen mit `powershell -File tools/commit.ps1 "Nachricht"` – das zählt die Cache-Version
in `sw.js` hoch, sobald sich eine gecachte Datei ändert. Modelle und große Sounds (`*_glb.js`, `*_snd.js`) liegen in
einem eigenen Cache, dessen Version nur bei geänderten Modellen hochgeht – sonst würden bei jedem Update über
100 MB neu geladen. Die Seite prüft jede Minute auf eine neue Version und lädt am Startbildschirm von selbst neu
(kein Strg+F5 nötig); mitten im Spiel erscheint nur ein Hinweis. Der pre-commit-Hook
(`cp tools/pre-commit .git/hooks/pre-commit`) ist das Sicherheitsnetz, falls die Version vergessen wurde.

**Spielstand:** Highscores (Startsequenz, mit Kurzschluss) werden schon still im Browser gespeichert
(`localStorage`, übersteht Updates, gilt pro Gerät) – angezeigt werden sie erst später.

**Diagnose:** `index.html?debug` zeigt unten links den Zustand der Spielfigur.

**Eigene Modelle** in `models/`:

| Datei | Inhalt |
|---|---|
| `kenji.glb` | Spielfigur Kenji (Mixamo-Skelett, 16 Animationen: `idle`, `walk`, `run`, `jump`, `jump_down`, `land`, `crouch_to_stand`, `swim`, `fly`, `hang`, `dance_hiphop`, `dance_silly`, `moonwalk`, `jump_special`, `aerial_evade`, `butterfly_twirl`) |
| `surfboard.glb` | Surfbrett, 1,90 m |
| `snowboard.glb` | Snowboard, 1,45 m |

Schule, Wüste, Oase, Flugfeld, Fluss, Hafenbecken, Kanal und Globus sind aus Code gebaut.

## 🙏 Danksagungen

Dieses Spiel wäre ohne die großartige Arbeit vieler Künstlerinnen und Künstler nicht möglich. Herzlichen Dank!

**Eigens für dieses Spiel:**

| Modell / Sound | Künstler/in | Lizenz |
|---|---|---|
| [Prancha de Surf / Surfboard](https://sketchfab.com/3d-models/prancha-de-surf-surfboard-bafbc865dc8642b1bacc484dd9a5f1fc) | **Leandro Cruz** (Sketchfab) | [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/) – ausgerichtet und skaliert |
| [Intermediate Advanced Snowboard](https://sketchfab.com/3d-models/intermediate-advanced-snowboard-267e04a025434d7d8587ec2ee60ad62e) | **Final Render Animation Studio** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – skaliert, Material auf PBR umgestellt |
| Arabic Islamic Music (46 s) | **bombinsound** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| Desert Wind 2 | **tanweraman** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| Atlas Maldives (2:35, Etappe 3) · Atlas Thailand (Etappe 4) | **vadim_makes_sound** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| Chinese Flute Relaxing Music (short, Etappe 5) | **nourishedbymusic** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| Summer Vacation (Etappe 1) | **kulakovka** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| Ancient Japan (Etappe 6) | **alec_koff** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| [Building crane low poly](https://sketchfab.com/3d-models/building-crane-low-poly-52d3ffdc37f844a892bebbd7e76f1939) | **Mostafa Hamed** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – Haken und Laufkatze ersetzt |
| [Cargo Ship 06 without containers](https://sketchfab.com/3d-models/cargo-ship-06-without-containers-c73ae6cc314941069a0e3a7ca6acc26d) | **gogiart** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – verkleinert (Dreiecke, Texturen) |
| [Container](https://sketchfab.com/3d-models/container-92bd84031ebc4ddcbf3b3d3689c4bf31) | **H.A.K_Niazi** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – skaliert, eingefärbt |
| [Speedboat n°2](https://sketchfab.com/3d-models/speedboat-n2-66da3d79c45c41719c19fb80d0009bef) | **Jonathan Geoffroy** (Sketchfab) | [CC BY-NC 4.0](http://creativecommons.org/licenses/by-nc/4.0/) – verkleinert. **Nicht-kommerziell:** das Spiel darf mit diesem Modell nicht verkauft werden |
| [Police Boat](https://sketchfab.com/3d-models/police-boat-959e50ef12a546d8a203182c4ccef17a) | **gogiart** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – verkleinert, Blaulicht ergänzt |

Rigging und Animationen der Spielfigur: **[Mixamo](https://www.mixamo.com)** (Adobe).

**Aus dem Flugspiel übernommen** (3D-Modelle über **[Sketchfab](https://sketchfab.com)** unter Creative-Commons-Lizenzen, Namensnennung gemäß Lizenz):

| Modell | Künstler/in (Sketchfab) |
|---|---|
| X-Wing 2.0 | **GaryPhelps** |
| C-400 (als Transall) · Dornier Alpha Jet A | **42manako** |
| Bactrian Camel (Low Poly), CC-BY-NC-SA-4.0 | **Nyilonelycompany** |
| Tortoise - turtle, CC-BY-4.0 | **Daniel Zuleta Art** |
| Ring-Billed Gull · Ring-Billed Gull – in Flight, CC-BY-4.0 | **Oregon State University Ecampus** |
| Panda, CC-BY-4.0 | **firoh** (Assets 4 Games) |
| Labrador Dog, CC-BY-4.0 | **kenchoo** |
| Nile Crocodile Swimming, CC-BY-NC-ND-4.0 (unverändert) | **Monster** |
| Mount Fuji – Honshu, Japan, CC-BY-4.0 (vereinfacht) | **Rafael Kenji Horota** |
| N700-3000 Series Shinkansen, CC-BY-4.0 (gekürzt) | **Layo** (bciarfello) |
| Godzilla, CC-BY-4.0 (verkleinert) | **savounited** |
| Susanoo (Samurai), CC-BY-4.0 | **tranb95** |
| Stage Campfire, CC-BY-4.0 (unverändert) | **daedaljs** |
| P-51 Mustang | **UlissesVinicios** |
| Canadair CL-215 | **AlessioPassera** |
| Airbus A380-800 | **OUTPISTON** |
| U-Boot (Submarine) | **Helindu** |
| Liberty-Frachter | **AlanTinka** |
| Großsegler | **Liaval** |
| Containerschiff | **RM02** |
| Kreuzfahrtschiff | **farhad.Guli** |
| Fire Rescue Boat | **gogiart** |
| Mercedes Atego Fire Engine | **Aeroux Games 3D** |
| Schlauchboot | **Mike0916** |
| Killerwal (Killer Whale) | **Trouvaille** |
| Parachute | **stroodledoodle** |
| Parachute Simple | **TopNotch Assets** |
| Gerald R. Ford Aircraft Carrier | **Usman Zia** |
| The Wharf – Fishing Harbor | **Mehdi Shahsavan** |
| Ariane 6 (ESA) | **Clarence365** |
| Earth · Moon · Mars | **Akshat** |
| Moon – Giordano Bruno Crater · Mars – Aram Chaos Region · Sun · Death Star | **Sebastian Sosnowski** |
| Moonbase | **eggshell.d** |
| Perseverance (NASA Mars Landing 2021) | **Thomas Flynn** |
| Minecraft Java Edition Stars | **AjaxGb** |
| Spacedrive | **tamminen** |
| Asteroid 01 | **exabyte** |
| ISS | **colinf** |
| Space Shuttle | **Jan Tesař** |
| Razor Crest (Star Wars) | **Quiznos323** |
| Serenity | **mohamedhussien** |
| Star Wars Hangar Interior | **Aditya Voxel** |
| Star Destroyer (Star Wars) | **rubaun** |
| USS Voyager (Star Trek) | **CGI Tutorials** |
| USS Enterprise-D (Star Trek) | **LoganRolphh** |
| Millennium Falcon (Star Wars) | **jay2307** |
| Astronaut im Raumanzug | **LasquetiSpice** |

Weitere verwendete Technik:
- **[three.js](https://threejs.org)** (r128) — 3D-Rendering, inkl. GLTFLoader.
- **Motor-/Crash-Sounds** aus dem **FMS (Flug-Modell-Simulator)**, Freeware von Möller (2001).
- **Sprachausgabe** über die Web Speech API des Browsers (z. B. Microsoft Katja/Stefan, in Edge Conrad/Killian).

## 📄 Lizenz

Der Spielcode ist frei nutzbar. Die 3D-Modelle und Sounds Dritter unterliegen ihren oben genannten Lizenzen –
bei Weiterverwendung bitte die Namensnennung beibehalten.
