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

Das Konzept steht in **[Konzept.md](Konzept.md)**. Spielbar sind **Etappe 1 und 2**, danach folgt
vorerst ein Platzhalter.

**Startmenü:** *Neues Spiel* oder – zum Testen – direkt **E2 … E6** (linker Stick / ← → wählen, A / Enter starten).

### Etappe 1 – Der Aufbruch am Strand
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

Zwischen den Etappen zeigt der **Globus** den bisherigen Weg (blau = München, gelb = Etappen, lila = Fukuoka).

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
| `etappe2.js` | Etappe 2 (Wüste, X-Wing-Falle, Transall-Flugschule) |
| `kenji_glb.js` | Kenji als eingebettetes GLB (aus `models/kenji.glb`) |
| `wueste_snd.js` | Wüsten-Sounds (Musik, Wind) als Base64 |
| `sw.js`, `manifest.json` | Offline-Cache und App-Installation (PWA) |
| `ENGINE_RISIKEN.md` | bekannte Stolperstellen der Engine-Übernahme |

Ladeordnung: `kenji_glb.js` → `story.js` → `wueste_snd.js` → `etappe2.js` → `engine/engine.js`. Die Engine ruft am Ende
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

Schule, Wüste, Oase, Flugfeld und Globus sind aus Code gebaut.

## 🙏 Danksagungen

Dieses Spiel wäre ohne die großartige Arbeit vieler Künstlerinnen und Künstler nicht möglich. Herzlichen Dank!

**Eigens für dieses Spiel:**

| Modell / Sound | Künstler/in | Lizenz |
|---|---|---|
| [Prancha de Surf / Surfboard](https://sketchfab.com/3d-models/prancha-de-surf-surfboard-bafbc865dc8642b1bacc484dd9a5f1fc) | **Leandro Cruz** (Sketchfab) | [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/) – ausgerichtet und skaliert |
| [Intermediate Advanced Snowboard](https://sketchfab.com/3d-models/intermediate-advanced-snowboard-267e04a025434d7d8587ec2ee60ad62e) | **Final Render Animation Studio** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – skaliert, Material auf PBR umgestellt |
| Arabic Islamic Music (46 s) | **bombinsound** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |
| Desert Wind 2 | **tanweraman** ([Pixabay](https://pixabay.com)) | [Pixabay-Lizenz](https://pixabay.com/service/license-summary/) |

Rigging und Animationen der Spielfigur: **[Mixamo](https://www.mixamo.com)** (Adobe).

**Aus dem Flugspiel übernommen** (3D-Modelle über **[Sketchfab](https://sketchfab.com)** unter Creative-Commons-Lizenzen, Namensnennung gemäß Lizenz):

| Modell | Künstler/in (Sketchfab) |
|---|---|
| X-Wing 2.0 | **GaryPhelps** |
| Transall C-160 · Dornier Alpha Jet A | **42manako** |
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
