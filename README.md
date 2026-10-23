# Reise nach Japan 🇯🇵

**▶️ Spielen: https://workflow42.github.io/trip_to_japan/**
(Chrome/Edge empfohlen – Edge hat die natürlichsten Stimmen. Controller oder Tastatur. Nach dem ersten
vollständigen Laden auch offline spielbar, auf Tablets über „Zum Startbildschirm hinzufügen“ als App installierbar.)

Ein 3D-Abenteuerspiel im Browser: **Samu** will in den Sommerferien ohne Geld zu seinem Freund nach
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
- **Intro:** Samu kommt aus der Schule, die Kamera fährt heran und schwenkt hinter ihn, die Erzählstimme
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
  - verpasst → Autopilot zum **Mond** → **7 Tage**. Der Text hängt davon ab, wo Samu schon war: Mars und Mond
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
- **Schnellboot („1 Tag“):** im gelben Ring am Kai einsteigen (wie bei den anderen Booten). Samu kapert das Boot, zwei
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
Stadt **Tokio** auf der Startinsel mit Hochhäusern, Möwen und Mini-Godzillas; hinter Samu stapft ein **Riesen-Godzilla**
durch die Häuser. Links der Bahnhof **東京 Tokio** mit dem **Shinkansen** (das Gleis läuft als Ring um die Insel), rechts die
Startbahn mit dem **Alpha Jet**. Voraus der **Mount Fuji** (2 km hoch, steht im Meer). Musik „Ancient Japan“.
- **Alpha Jet („1 Tag“):** Startsequenz mit Ansage und 10-s-Countdown wie beim X-Wing. Verpasst → Flughafenpolizei → **7 Tage**.
  Geschafft → dem roten Radarpunkt bis kurz vor den Fuji folgen, Blende, **Höhle im Vulkan**: Autopilot ~18 s mit Ansage,
  dann ~15 s selbst, immer Vollgas, ohne Gyroskop. Berührung oder unter 100 % → **7 Tage** (ohne Ansage). Am **Ausgang ins
  Licht** sofort (weißer Blitz) die **Filmsequenz**: nur Vulkan und Meer, der Jet schießt mit Überschallknall senkrecht aus
  dem Krater, Ausbruch mit Rauchsäule, Lavaströmen und Grollen (kein Motorton), langsame Abblende. Danach 500 m / 50 %,
  *„Du bist der absolute Wahnsinn! …“*, landen auf dem Flugfeld am **Fukuoka-Beach** (Jets setzen bis ~30 % Schub auf, bremsen
  mit Umkehrschub) → **1 Tag**. Absturz → **7 Tage**.
- **Shinkansen („4 Tage“), `etappe6c.js`:** Stellwerk ausgefallen, Weichen defekt – Samu wählt die Gleise. ~98 s Fahrt
  0 → 300 → 0 km/h, 23 Runden: oben im HUD je Gleis zwei Symbole (grün ok / rot durchgestrichen), genau ein Gleis ist bei
  beiden grün. L-Stick: ein Druck = ein Gleis. Wahlzeit 2 / 1,5 / 1 s (bis 150 / bis 250 / darüber), dann **2 s Ruhe** (HUD
  leer), Signale erst nach der Wahl sichtbar. **3 Gleise erst beim Bremsen ab ~195 km/h** (das neue Gleis zweigt in der Mitte
  ab). Kamera über dem Triebwagen. Falsches Gleis → Notbremsung → **7 Tage**; alles richtig → Einfahrt Fukuoka-Beach → **4 Tage**.
- **Ende (beide Wege):** Globus – der Faden wächst von Tokio nach **Fukuoka**, der lila Punkt wird zur 🌊. Danach steht Samu
  am **Fukuoka-Beach**: Meer mit weißem **Torii** und den **Meoto-Iwa** (Vorbild Sakurai-Futamigaura), Strand mit Palmen,
  Surfbrett im Sand (Ring „Surfen“, kommt bald), Lagerfeuer mit Samurai, eine Samurai-Gruppe, Godzillas; dahinter das Vorfeld
  mit der C-400 (Pfeil, Schild noch leer), die Landebahn, der Bahnhof **Fukuoka-Beach** (Gleis entlang der Küste) und die
  Stadt mit einem 130 m hohen Riesen-Godzilla.
- **Joshi und Fuchsi (jedes Ende):** Am Strand rund um das Surfbrett laufen Joshi und Fuchsi aus „Das Geheimland“ umher. Joshi
  schaut sich um und kniet sich hin, dann kommt Fuchsi und setzt sich zu ihm. Tanzt Samu in der Nähe (X), spielt Joshi
  Luftgitarre, Fuchsi und Barki tanzen, und Samu tanzt endlos weiter (wie mit den Aliens auf dem Mond), bis er weiterläuft.
  Geht Samu surfen, surft Joshi ~10 m neben ihm mit und springt eigene Tricks (Salto vorwärts/rückwärts, 360 links/rechts,
  Salto mit 360) – Fuchsi wartet am Strand.

Zwischen den Etappen zeigt der **Globus** den bisherigen Weg (blau = München, gelb = Etappen, lila = Fukuoka; am Ende von Etappe 6 wird daraus die 🌊).

## Steuerung zu Fuß

| Controller | Tastatur | |
|---|---|---|
| linker Stick | Pfeile | laufen (bis zur Hälfte gehen, weiter rennen) |
| rechter Stick | J L I K | umsehen |
| A | Leertaste | springen (auf Mond und Mars viel höher) |
| B | B | hinknien / aufstehen (der Hund kommt zum Spielen) |
| X / Y | X / Y | Hip Hop Dance (der Hund tollt mit) / Butterfly Twirl · Y am Fahrzeug: einsteigen |
| L3 halten + Stick | M halten + Pfeile | Moonwalk |
| RT / LT im Wasser | E / Q | tauchen / auftauchen |
| D-Pad ↑ | H | Anleitung (Pause) |
| D-Pad ← | T | aktuelle Aufgabe (keine Pause) |
| D-Pad ↓ | N | Ton an (Stimme) / aus (Untertitel) |

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | wird von `tools/build_engine.ps1` erzeugt (HUD-Markup aus dem Flugspiel, direkt nach `<body>` das Ladebild aus `tools/ladebild.html`) |
| `engine/` | Flugspiel-Engine + Modelle, **unverändert** kopiert von `tools/build_engine.ps1` |
| `story.js` | Spiellogik und Etappe 1 – hängt sich per Wrapper in die Engine ein |
| `objekte.js` | **Objekt-Katalog mit Grenzen** (aus „Das Geheimland“ übernommen, 16.10.2026): jedes Objekt einmal global als Typ (`story.typ`), gesetzt mit `story.setze(typ, etappe, { x, z, dreh, … })`. Jedes Bauteil ist eine Grenze in seiner echten Form (Quader, Zylinder, Kugel, freie Formen in Scheiben) – Samu läuft nicht hinein oder hindurch, wer drinsteckt, kommt immer hinaus. Bewegliche Dinge (`beweglich: true`) nehmen ihre Grenze mit. Bisher nutzt es das Uferdorf in Etappe 5; die übrigen Etappen werden nach und nach umgestellt |
| `spuren.js` | **Schatten, Laufspuren, Bootsgischt** (wie im Geheimland): Samus Schatten so klein und blass wie Joshis (0,48 m, 60 %), beim Gehen und Laufen Staubwölkchen an jedem Fuß (Farbe je Etappe, nicht auf Beton, Bahn, im Wasser), in jedem Boot Spritzer am Bug und eine Heckwelle, je schneller desto mehr |
| `haeuser.js` | **Häuser im Stil ihrer Region, im Anime-Look**: global der Typ `haus` (Grundfläche, Höhe, Tür vorn, Grenze), je Region nur das Aussehen (`story.hausStile`). Toon-Shading mit drei harten Lichtstufen und dunklem Umriss. Stile: `deutsch` (E1), `hafen` + `halle` (E4), `china` (E5), `japan` (E6), `turm` (Hochhaus, alle Städte); dazu der Typ `zelt` (Beduinenzelt, E2). Alle Häuser einer Welt werden je Material zu einem Mesh zusammengefasst (`story.stadtBauen`) |
| `etappe1.js` | Etappe 1 als Festland: Strand, Nadelbäume, Schule „AEG“ (fest), Stadt, Ariane, X-Wing-Parkplatz, U-Boot und Ring |
| `etappe2.js` | Etappe 2 (Wüste, X-Wing-Falle, Transall-Flugschule) |
| `etappe3.js` | Etappe 3 (Fluss, Feuerwehrboot, X-Wing ohne Kurzschluss) |
| `etappe4.js` | Etappe 4: Hafen-Welt und Container-Kran |
| `etappe4b.js` | Etappe 4: Schnellboot-Flucht (Kanal, Polizei) |
| `etappe5.js` | Etappe 5: Insel, Skyline, Küstendorf, Air Race mit der Mustang |
| `etappe5b.js` | Etappe 5: U-Boot an der Küste, Code-Feld, Felsenschlucht mit Sonar-Karte |
| `etappe6.js` | Etappe 6: Tokio mit Bahnhof (Ringgleis) und Alpha Jet, Startsequenz, Hinflug, Fuji (2 km) im Meer; Fukuoka-Beach (Festland: Strand, Torii, Meoto-Iwa, Surfbrett, Palmen, Lagerfeuer, Vorfeld, Bahn, Bahnhof, Stadt), Ende mit Globus |
| `etappe6c.js` | Etappe 6c: Shinkansen – Weichen wählen (eigene Strecke, 2 → 3 Gleise, HUD, Notbremsung, Einfahrt) |
| `finale.js` | Finale: Fuji-Sprung, Snowboard-Abfahrt, Surfen (Brandungswellen, Monsterwellen, Meoto-Iwa), Rundflug |
| `abspann.js` | Ende der Reise: Reiselog, Abspann, „Ab zum Strand“, Stufe 5 am Strand |
| `strandfreunde.js` | Joshi und Fuchsi am Fukuoka-Beach: laufen umher, knien, Luftgitarre zu Samus Tanz, Joshi surft mit |
| `statistik.js` | Statistiken: alle Spiele (Startmenü „Statistiken“) und dieses Spiel (Abspann) – Reisezeiten, Mond/Mars, Bestzeiten, Monsterwellen, Tricks; nur echte Spiele, nur Gespieltes |
| `etappe6b.js` | Etappe 6b: Höhle im Vulkan als eigene Szene (Autopilot, kurvige Röhre in Abschnitten, Ausgang ins Licht), Filmsequenz mit Ausbruch, Landung am Strand. Der frühere Senkrechtschacht liegt in `_intern/archiv/e6b_senkrechtschacht/` |
| `flucht_glb.js` | Schnellboot und Polizeiboot (verkleinert) als Base64 |
| `hafen_glb.js` | Frachtschiff (verkleinert), Container und Kran als Base64 |
| `samu_glb.js` | Samu als eingebettetes GLB (aus `models/samu.glb`) |
| `samu_kopf.js` | Samus Gesicht auf dem Globus (aus der Figur-Zeichnung) |
| `meeresschildkroete_glb.js` | Meeresschildkröten und Babys für Etappe 3 (animiert, unverändert, 2 MB) |
| `krokodil_glb.js` | Krokodile im Fluss (Etappe 3), unverändert (Lizenz ND), 7,7 MB |
| `tiere.js` | Tiere und Inseln: fliegende Möwen (Etappe 1, 4, 5, 6 und an jeder Insel), **sitzende Möwen** (`story.sitzMoewen`: kommt Samu zu nahe, fliegen sie als fliegende Möwen auf, ziehen einen Bogen und landen wieder auf ihrem Platz – bisher am Kai in Etappe 4), Hunde (1), Pandas (5), Godzillas und Samurai (6), Mount Fuji statt der Kegel-Hügel |
| `begleiter.js` | **Hund als Begleiter** (Shiba Inu, wie der Fuchs im Geheimland): in jeder Etappe zu Fuß dabei, begleitet Samu frei, kommt und setzt sich neben ihn, wenn er stehen bleibt, tollt vor ihm herum, wenn er lange steht oder Hip Hop tanzt; **B** = Samu kniet, der Hund kommt, springt vor Freude und setzt sich daneben. Er ist ein Körper (Samu läuft nicht durch ihn), läuft nicht durch Grenzen, nicht ins Wasser und um die anderen Tiere herum, scheucht sitzende Möwen auf und bellt ab und zu (leiser mit der Entfernung, beim Tollen doppelt so oft, beim Aufscheuchen). Im Fahrzeug wartet er sitzend; im Finale bleibt er am Fukuoka-Beach |
| `shiba_glb.js` | Shiba Inu (Hund, `begleiter.js`): Clips Idle, Walk, Run, Jump, SitDown (`Dog\|…`), 2.660 Dreiecke, unverändert |
| `bellen_snd.js` | Bellen des Hundes (`begleiter.js`) |
| `fuji_glb.js` | Mount Fuji für alle Inselberge (vereinfacht: 2.752 Dreiecke, Höhe und Farbe vom Original abgetastet) |
| `zug_glb.js` | Shinkansen (Etappe 6): Triebwagen und Mittelwagen aus dem Original geschnitten, hinterer Triebwagen gedreht (3,3 MB statt 26 MB) |
| `godzilla_glb.js` | Godzilla (Etappe 6): Mini-Godzillas (1 m) in der Stadt und am Strand-Flughafen, Riesen-Godzilla (60 m) hinter der Stadt; verkleinert und aufgehellt |
| `samurai_glb.js` | Samurai am Fukuoka-Beach (Etappe 6), sitzend und stehend |
| `surfboard_glb.js` | Surfbrett (Etappe 6: steckt am Fukuoka-Beach im Sand) |
| `wolf_glb.js` | Wolf (Finale: Rudel im Wald neben der Snowboardpiste, unterhalb der Baumgrenze) |
| `finale_snd.js` | Finale-Töne: Carving (Snowboard), Grind (Rail), Wind (Fallschirm, leise auf der Piste) |
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

Ladeordnung: `samu_glb.js` → `samu_kopf.js` → `story.js` → `objekte.js` → `haeuser.js` → `spuren.js` → `etappe1.js` → `wueste_snd.js` → `kamel_glb.js` → `etappe2.js` → `meeresschildkroete_glb.js` → `fluss_snd.js` → `krokodil_glb.js` → `etappe3.js` → `hafen_glb.js` → `musik_snd.js` → `moewe_glb.js` → `hund_glb.js` → `panda_glb.js` → `fuji_glb.js` → `tiere.js` → `shiba_glb.js` → `bellen_snd.js` → `begleiter.js` → `etappe4.js` → `flucht_glb.js` → `etappe4b.js` → `etappe5.js` → `etappe5b.js` → `zug_glb.js` → `surfboard_glb.js` → `campfire_glb.js` → `godzilla_glb.js` → `samurai_glb.js` → `etappe6.js` → `etappe6b.js` → `etappe6c.js` → `snowboard_glb.js` → `wolf_glb.js` → `finale_snd.js` → `finale.js` → `abspann.js` → `joshi_glb.js` → `fuchsi_glb.js` → `gitarre_snd.js` → `strandfreunde.js` → `statistik.js` → `engine/engine.js`. Die Engine ruft am Ende
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
| `samu.glb` | Spielfigur Samu (Mixamo-Skelett, 17 Animationen: `idle`, `walk`, `run`, `jump`, `jump_down`, `land`, `crouch_to_stand`, `swim`, `fly`, `hang`, `dance_hiphop`, `dance_silly`, `moonwalk`, `jump_special`, `aerial_evade`, `butterfly_twirl`, `kneel` – Mixamo „Kneeling Down“, B) |
| `surfboard.glb` | Surfbrett, 1,90 m |
| `snowboard.glb` | Snowboard, 1,45 m |

Schule, Wüste, Oase, Flugfeld, Fluss, Hafenbecken, Kanal und Globus sind aus Code gebaut.

## 🙏 Danksagungen und Lizenzen

Dieses Spiel wäre ohne die großartige Arbeit vieler Künstlerinnen und Künstler nicht möglich. Herzlichen Dank!
Alle 3D-Modelle stammen von **[Sketchfab](https://sketchfab.com)**, alle Töne (soweit nicht anders angegeben) von
**[Pixabay](https://pixabay.com)** ([Pixabay-Lizenz](https://pixabay.com/service/license-summary/)).
NC-Lizenzen bedeuten: **nicht kommerziell** – das Spiel darf mit diesen Werken nicht verkauft werden.

### 3D-Modelle – eigens für Reise nach Japan

| Werk | Urheber/in | Lizenz | wofür |
|---|---|---|---|
| [C-400](https://sketchfab.com/3d-models/c-400-ef4c7b9f505646b7a1d6704d245b9a3e) | **42manako** | CC-BY-NC-4.0 | Transportflugzeug (Nase gedreht) |
| [Ghost classic](https://sketchfab.com/3d-models/ghost-classic-f02308be0bd74ee99aeffef7eb41e170) | **skalson** | CC-BY-4.0 | Geist an der Schultür (Etappe 1) |
| [Bactrian Camel (Low Poly)](https://sketchfab.com/3d-models/bactrian-camel-low-poly-1fb4d897df2e4d12ab185302a36b3d5f) | **Nyilonelycompany** | CC-BY-NC-SA-4.0 | Kamel (Wüste, Etappe 2) |
| [Sea Turtle – Animated Low Poly](https://sketchfab.com/3d-models/sea-turtle-animated-low-poly-d2c766bc36724d5998b62f8b2150acb9) | **WildPoly3D** | CC-BY-NC-4.0 | Meeresschildkröte (Fluss, Etappe 3, unverändert) |
| [SeaTurtle Baby – Animated Low Poly](https://sketchfab.com/3d-models/seaturtle-baby-animated-low-poly-d6a5a74b67df418585c33ed37873531a) | **WildPoly3D** | CC-BY-NC-4.0 | Schildkröten-Baby (Etappe 3, unverändert) |
| [Nile Crocodile Swimming](https://sketchfab.com/3d-models/nile-crocodile-swimming-8bdc3a1551fb4d9d9a58e56b9385bd22) | **Monster** | CC-BY-NC-ND-4.0 | Krokodil im Fluss (unverändert) |
| [Cargo Ship 06 without containers](https://sketchfab.com/3d-models/cargo-ship-06-without-containers-c73ae6cc314941069a0e3a7ca6acc26d) | **gogiart** (agt14032013) | CC-BY-4.0 | Frachtschiff im Hafen (verkleinert) |
| [Container](https://sketchfab.com/3d-models/container-92bd84031ebc4ddcbf3b3d3689c4bf31) | **H.A.K_Niazi** | CC-BY-4.0 | Container im Hafen (skaliert, eingefärbt) |
| [Building crane low poly](https://sketchfab.com/3d-models/building-crane-low-poly-52d3ffdc37f844a892bebbd7e76f1939) | **Mostafa Hamed** | CC-BY-4.0 | Hafenkran (Haken/Laufkatze ersetzt) |
| [Ring-Billed Gull](https://sketchfab.com/3d-models/ring-billed-gull-3df7913df7f34b90b152b05e12737c43) | **Oregon State University Ecampus** (osuecampus) | CC-BY-4.0 | sitzende Möwen (Etappe 4) |
| [Ring-Billed Gull – in Flight](https://sketchfab.com/3d-models/ring-billed-gull-in-flight-fba809cd4766411bb8c4236e9da606bc) | **Oregon State University Ecampus** (osuecampus) | CC-BY-4.0 | fliegende Möwen |
| [Labrador Dog](https://sketchfab.com/3d-models/labrador-dog-1f56cfbab07e4fe49b5d9e521c82073a) | **kenchoo** | CC-BY-4.0 | Hund (Etappe 1, verkleinert) |
| [Panda](https://sketchfab.com/3d-models/panda-388c3230515848cb9c07724f2230af43) | **firoh** (Assets 4 Games) | CC-BY-4.0 | Panda (Etappe 5) |
| [Mount Fuji – Honshu, Japan](https://sketchfab.com/3d-models/mount-fuji-honshu-japan-b081cb6aed1043cbab1818e071c5b3e3) | **Rafael Kenji Horota** | CC-BY-4.0 | Fuji-Berg (vereinfacht) |
| [Shiba Inu Doggy](https://sketchfab.com/3d-models/shiba-inu-doggy-87a3ef91e9074ba996176d91f6863e6b) | **aaadragon** | CC-BY-4.0 | Hund-Begleiter |
| [Alien Hip Hop Dancing](https://sketchfab.com/3d-models/alien-hip-hop-dancing-fac7a402b9f940aa955da87f8eb0619c) | **nonny** | CC-BY-4.0 | großes tanzendes Alien auf dem Mond |
| [Funky Alien (Rigged & Animated)](https://sketchfab.com/3d-models/funky-alien-rigged-animated-09150cbfee3148748a8ea15e9066a1cb) | **jungle_jim** | CC-BY-4.0 | kleines tanzendes Alien auf dem Mond |
| [Fox](https://sketchfab.com/3d-models/fox-39f97fe58f0b47ce80b6e02814001dd7) | **pxltiger** | CC-BY-4.0 | Fuchsi am Fukuoka-Beach (nur die benutzten Animationen) |
| [Speedboat n°2](https://sketchfab.com/3d-models/speedboat-n2-66da3d79c45c41719c19fb80d0009bef) | **Jonathan Geoffroy** | CC-BY-NC-4.0 | Schnellboot der Flucht (Etappe 4, verkleinert) |
| [Police Boat](https://sketchfab.com/3d-models/police-boat-959e50ef12a546d8a203182c4ccef17a) | **gogiart** (agt14032013) | CC-BY-4.0 | Polizeiboot (verkleinert, Blaulicht ergänzt) |
| [N700-3000 Series Shinkansen](https://sketchfab.com/3d-models/n700-3000-series-shinkansen-f70820be44e0467d8b1614f2aa3045bd) | **Layo** (bciarfello) | CC-BY-4.0 | Shinkansen (Etappe 6, gekürzt) |
| [Prancha de Surf / surfboard](https://sketchfab.com/3d-models/prancha-de-surf-surfboard-bafbc865dc8642b1bacc484dd9a5f1fc) | **Leandro Cruz** | CC-BY-SA-4.0 | Surfbrett (ausgerichtet, skaliert) |
| [Stage Campfire](https://sketchfab.com/3d-models/stage-campfire-82f37f8bf0f645768e32ab7185df13ca) | **daedaljs** | CC-BY-4.0 | Lagerfeuer (unverändert) |
| [Godzilla](https://sketchfab.com/3d-models/godzilla-ca862e19cad04f95af49263405ee04dd) | **savounited** | CC-BY-4.0 | Godzilla (Etappe 6, verkleinert, aufgehellt) |
| [Susanoo](https://sketchfab.com/3d-models/susanoo-15d8821b6d0842c48eb2652639287fdd) | **tranb95** | CC-BY-4.0 | Samurai (Etappe 6) |
| [Intermediate Advanced Snowboard](https://sketchfab.com/3d-models/intermediate-advanced-snowboard-267e04a025434d7d8587ec2ee60ad62e) | **Final Render Animation Studio** | CC-BY-4.0 | Snowboard (Finale, skaliert) |
| [Wolf](https://sketchfab.com/3d-models/wolf-e319f122c2474d3186b841b019fb0edd) | **OLEKSO** | CC-BY-NC-4.0 | Wolf (unverändert) |

### 3D-Modelle – Fahrzeuge, Meer und Weltall

| Werk | Urheber/in | Lizenz | wofür |
|---|---|---|---|
| [Canadair CL-215](https://sketchfab.com/3d-models/canadair-cl-215-85a01bcfe0834228bd5261ad5754ecca) | **AlessioPassera** | CC-BY-4.0 | Löschflugzeug |
| [Lowpoly Eurofighter Typhoon F2](https://sketchfab.com/3d-models/lowpoly-eurofighter-typhoon-f2-e870911a25f84f67a65201ae5de9cea1) | **SIpriv** | CC-BY-4.0 | Düsenjet |
| [Airbus A380-800](https://sketchfab.com/3d-models/airbus-a380-800-9cc4aa572fa745f19d19ec8ee9826c21) | **OUTPISTON** | CC-BY-NC-SA-4.0 | Verkehrsflugzeug / Flugverkehr |
| [P-51 Mustang](https://sketchfab.com/3d-models/p-51-mustang-36f0f3e71d2a4c18b479db1ae8f9e7a7) | **UlissesVinicios** | CC-BY-4.0 | Propellerflugzeug |
| [Parachute Simple](https://sketchfab.com/3d-models/parachute-simple-030a235d6f314a86bebc33f322c0e71c) | **TopNotch Assets** (Sketchfab-Konto Sxnneh) | CC-BY-4.0 | einfacher Fallschirm |
| [Millenium Falcon](https://sketchfab.com/3d-models/millenium-falcon-64a83c7671274870889d19e1ecfb8ea6) | **jay2307** | CC-BY-4.0 | Raumschiff |
| [Fire Rescue Boat](https://sketchfab.com/3d-models/fire-rescue-boat-066ad028822c42eab411df40f5dc70d9) | **gogiart** (Sketchfab-Konto agt14032013) | CC-BY-4.0 | Feuerwehrboot |
| [Schlauchboot](https://sketchfab.com/3d-models/schlauchboot-9b0fc1ad28fc49da90aa135cfb89e414) | **Mike0916** | CC-BY-NC-SA-4.0 | Schlauchboot |
| [Cruise Ship](https://sketchfab.com/3d-models/cruise-ship-bb782326932e4c179e34f3d6c8e36b86) | **farhad.Guli** | CC-BY-4.0 | Kreuzfahrtschiff |
| [Liberty ship](https://sketchfab.com/3d-models/liberty-ship-a1db8e8414464c5d8b11383e202fcf26) | **AlanTinka** | CC-BY-4.0 | Frachter |
| [Container Ship](https://sketchfab.com/3d-models/container-ship-aaa41cca946b4a08bc08cf692b7757be) | **RM02** | CC-BY-4.0 | Containerschiff |
| [Empty Ship](https://sketchfab.com/3d-models/empty-ship-f254f07be1324a138da32833b32486d8) | **Liaval** | CC-BY-4.0 | Großsegler |
| [Orthoceras – Steampunk Abyssal Cruiser](https://sketchfab.com/3d-models/orthoceras-steampunk-abyssal-cruiser-1d3278516cad4f28a9d2d46fe823304d) | **Red Kaiser** | CC-BY-NC-4.0 | U-Boot |
| [Mercedes Atego Fire Engine](https://sketchfab.com/3d-models/mercedes-atego-fire-engine-7e798389467d4e15a070459c016c52c8) | **Aeroux Games 3D** | CC-BY-4.0 | Feuerwehrauto |
| [T-65 X-wing Starfighter – Star Wars](https://sketchfab.com/3d-models/t-65-x-wing-starfighter-star-wars-993d2920342f46f7b92baf3aea1c3cf3) | **Quiznos323** | CC-BY-NC-SA-4.0 | X-Wing (Raumjäger) |
| [Xwing 2.0](https://sketchfab.com/3d-models/xwing-20-cae716a9d92c4d56825ffb1dc1ea3525) | **GaryPhelps** | CC-BY-4.0 | zweiter X-Wing |
| [[Extracted] Minecraft Java Edition's Stars](https://sketchfab.com/3d-models/extracted-minecraft-java-editions-stars-c8868b7ffc4a473eb5cd9203a59e3650) | **AjaxGb** | CC-BY-4.0 | Sternenhimmel |
| [Sky Pano – Milkyway](https://sketchfab.com/3d-models/sky-pano-milkyway-0016725c047a4ea18cd0b5e5ef2fe441) | **MozillaHubs** (mozillareality) | CC-BY-NC-SA-4.0 | Milchstraße am Himmel |
| [Earth](https://sketchfab.com/3d-models/earth-41fc80d85dfd480281f21b74b2de2faa) | **Akshat** | CC-BY-4.0 | Erde (Weltall, Globus) |
| [Moon](https://sketchfab.com/3d-models/moon-4db2273f6dd943b8ad7fa5e3b1b2431a) | **Akshat** | CC-BY-4.0 | Mond |
| [Mars](https://sketchfab.com/3d-models/mars-9c7bbc64d8c74acfa9ec344c0fc10e1a) | **Akshat** | CC-BY-4.0 | Mars |
| [Moon – Giordano Bruno Crater](https://sketchfab.com/3d-models/moon-giordano-bruno-crater-1f49ab263ba1403f8874ae92743bb654) | **Sebastian Sosnowski** | CC-BY-4.0 | Mondoberfläche |
| [Mars – Aram Chaos region](https://sketchfab.com/3d-models/mars-aram-chaos-region-5c9b99de0405465f81ff0ba244ef69e2) | **Sebastian Sosnowski** | CC-BY-4.0 | Marsoberfläche |
| [Sun](https://sketchfab.com/3d-models/sun-9ef1c68fbb944147bcfcc891d3912645) | **Sebastian Sosnowski** | CC-BY-4.0 | Sonne |
| [Asteroid 01](https://sketchfab.com/3d-models/asteroid-01-df95d3da67aa4c769ec81394e0b0ffef) | **exabyte** | CC-BY-4.0 | Asteroiden |
| [MoonBase](https://sketchfab.com/3d-models/moonbase-6b2c2a4bdd554fb2a00d70d8274856e3) | **eggshell.d** | CC-BY-4.0 | Mondbasis |
| [ISS](https://sketchfab.com/3d-models/iss-867d22ce560b466e9ff7a16455fc453b) | **colinf** | CC-BY-4.0 | Raumstation ISS |
| [spaceshuttle](https://sketchfab.com/3d-models/spaceshuttle-b0c3acde450a441aa9da6403fd1e13e5) | **Jan Tesař** | CC-BY-NC-4.0 | Space Shuttle |
| [Razor Crest – Star Wars](https://sketchfab.com/3d-models/razor-crest-star-wars-172cb62cc1e141cfae4c48440c348de0) | **Quiznos323** | CC-BY-NC-SA-4.0 | Raumschiff (verkleinert) |
| [Serenity](https://sketchfab.com/3d-models/serenity-28edf4f757454dab84787e8df59228d5) | **mohamedhussien** | CC-BY-4.0 | Raumschiff (verkleinert) |
| [Star Destroyer](https://sketchfab.com/3d-models/star-destroyer-aaa18e14129a461c839877389bd28504) | **rubaun** | CC-BY-4.0 | Sternenzerstörer |
| [Star Trek Online – USS Enterprise D](https://sketchfab.com/3d-models/star-trek-online-uss-enterprise-d-595123c3348646a4a7e6871ebf0e9fae) | **LoganRolphh** | CC-BY-4.0 | Raumschiff Enterprise (verkleinert) |
| ESA Ariane 6 (64) – Rakete und Startturm | **Clarence365** | CC-BY-4.0 | Raketen auf den Inseln (verkleinert, Turm abgetrennt) |
| [Orca – Animated Low Poly](https://sketchfab.com/3d-models/orca-animated-low-poly-1033151e98dd4152a9c10cc91ff90586) | **WildPoly3D** | CC-BY-NC-4.0 | Orcas im Meer |
| [Low poly rainbow trout (Oncorhynchus mykiss)](https://sketchfab.com/3d-models/low-poly-rainbow-trout-oncorhynchus-mykiss-e2c052bd12fd492d9abf0a1c05cff175) | **Natural History Museum of Los Angeles County** | CC-BY-NC-SA-4.0 | Forellen / Fische |
| [Stingray – Animated Low Poly](https://sketchfab.com/3d-models/stingray-animated-low-poly-e3847b39eb9943b48df614e74e95a71f) | **WildPoly3D** | CC-BY-NC-4.0 | Rochen |
| [Furseal – Animated Low Poly](https://sketchfab.com/3d-models/furseal-animated-low-poly-c667fd35da0f4922a0f9321b9d250543) | **WildPoly3D** | CC-BY-NC-4.0 | Seelöwe |
| [Seal – Animated Low Poly](https://sketchfab.com/3d-models/seal-animated-low-poly-38b4c159b1b649cd9e65839b14d7de41) | **WildPoly3D** | CC-BY-NC-4.0 | Robbe |

### Musik

| Werk | Urheber/in | Lizenz | wofür |
|---|---|---|---|
| Summer Vacation (Pixabay-ID 308510) | **kulakovka** (Pixabay) | Pixabay-Lizenz | Musik Etappe 1 |
| Arabic Islamic Music (46 s, Pixabay-ID 494148) | **bombinsound** (Pixabay) | Pixabay-Lizenz | Musik Wüste, Etappe 2 |
| Atlas Maldives (2:35, Pixabay-ID 574470) | **vadim_makes_sound** (Pixabay) | Pixabay-Lizenz | Musik Fluss, Etappe 3 |
| Atlas Thailand (Pixabay-ID 562340) | **vadim_makes_sound** (Pixabay) | Pixabay-Lizenz | Musik Hafen, Etappe 4 |
| Chinese Flute Relaxing Music (short, Pixabay-ID 120917) | **nourishedbymusic** (Pixabay) | Pixabay-Lizenz | Musik Etappe 5 |
| Ancient Japan (Pixabay-ID 492751) | **alec_koff** (Pixabay) | Pixabay-Lizenz | Musik Etappe 6 |
| Punk Rock Guitar Loop (Pixabay-ID 278767) | **idoberg** (Pixabay) | Pixabay-Lizenz | Joshis Luftgitarre am Fukuoka-Beach |

### Geräusche

| Werk | Urheber/in | Lizenz | wofür |
|---|---|---|---|
| Ghost Woo (Pixabay-ID 135543) | **shut_up_ghost** (Pixabay) | Pixabay-Lizenz | Geist an der Schultür |
| Desert Wind 2 (Pixabay-ID 350417) | **tanweraman** (Pixabay) | Pixabay-Lizenz | Wüstenwind (Loop), Etappe 2 |
| Friendly Big Dog Bark 1 (Pixabay-ID 535471) | **yodguard** (Pixabay) | Pixabay-Lizenz | Hundebellen |
| Intense Skiing Carving (Pixabay-ID 447134) | **u_sda88n6jzm** (Pixabay) | Pixabay-Lizenz | Snowboard auf der Piste (Finale) |
| Can Sliding Across Wooden Desk (Pixabay-ID 98693) | **freesound_community** (Pixabay) | Pixabay-Lizenz | Rail-Grind (Finale) |
| Soft Wind (Pixabay-ID 477404) | **storegraphic** (Pixabay) | Pixabay-Lizenz | Fallschirm / Snowboard (Finale) |
| Prop Plane (Pixabay-ID 14513) | **freesound_community** (Pixabay) | Pixabay-Lizenz | Propellermotor |
| Jet Engine (Pixabay-ID 6753) | **freesound_community** (Pixabay) | Pixabay-Lizenz | Düsentriebwerk (X-Wing, Eurofighter) |
| Thai Motor Boat (Pixabay-ID 64851) | **freesound_community** (Pixabay) | Pixabay-Lizenz | Motorboot (Feuerwehrboot, Schlauchboot) |
| Car Crash Sound Effect (Pixabay-ID 376874) | **Dragon Studio** (Pixabay) | Pixabay-Lizenz | Absturz |
| Seagulls in Coastal Village (Pixabay-ID 486871) | **jonathanslattermusic** (Pixabay) | Pixabay-Lizenz | Möwen am Meer |
| Ocean Waves (Pixabay-ID 496030) | **magiaz** (Pixabay) | Pixabay-Lizenz | Meeresrauschen |
| Deepsea Sonar (Pixabay-ID 386156) | **Dragon Studio** (Pixabay) | Pixabay-Lizenz | Sonar des U-Boots |

### Sonstiges

| Werk | Urheber/in | Lizenz | wofür |
|---|---|---|---|
| Spielfigur Joshi | eigenes Foto (T-Pose), freigestellt und als Comic-Figur gezeichnet mit **Google Gemini**, daraus ein 3D-Modell mit dem Bild-zu-3D-Dienst von **[MakerWorld](https://makerworld.com)** (Bambu Lab), fürs Animieren aufbereitet | eigene Figur (nach den Nutzungsbedingungen der Dienste) | Joshi am Fukuoka-Beach |
| Spielfigur Samu | eigenes Foto (T-Pose), freigestellt und als Comic-Figur gezeichnet mit **Google Gemini**, daraus ein 3D-Modell mit dem Bild-zu-3D-Dienst von **[MakerWorld](https://makerworld.com)** (Bambu Lab), fürs Animieren aufbereitet | eigene Figur (nach den Nutzungsbedingungen der Dienste) | die Spielfigur Samu |
| [Mixamo](https://www.mixamo.com) (Auto-Rigging und Animationen) | **Adobe** | Mixamo-Nutzungsbedingungen (lizenzfrei nutzbar) | Skelett und 17 Bewegungen der Spielfigur Samu, Skelett und 6 Bewegungen von Joshi |
| [three.js](https://threejs.org) r128 inkl. GLTFLoader | **three.js authors** | MIT | 3D-Darstellung |
| Web Speech API (Stimmen des Browsers/Betriebssystems) | Browser-/OS-Hersteller | – | Sprachausgabe |

## 📄 Lizenz

Der Spielcode ist frei nutzbar. Die 3D-Modelle und Sounds Dritter unterliegen ihren oben genannten Lizenzen –
bei Weiterverwendung bitte die Namensnennung beibehalten.
