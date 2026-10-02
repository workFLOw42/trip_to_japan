# Reise nach Japan 🇯🇵

**▶️ Spielen: https://workflow42.github.io/trip_to_japan/**
(Chrome/Edge empfohlen, Controller oder Tastatur. Nach dem ersten vollständigen Laden auch offline spielbar,
auf Tablets über „Zum Startbildschirm hinzufügen“ als App installierbar.)

Ein 3D-Abenteuerspiel im Browser: **Kenji** will in den Sommerferien ohne Geld bis nach Japan –
über 6 Etappen mit X-Wing, U-Boot, Transall, Feuerwehrboot, Container-Kran, Mustang und Alpha Jet,
bis zum Surf-Finale am Mt. Fuji.

Technische Basis ist die Engine des **[Flugspiel](https://github.com/workFLOw42/flightsimulator)**
(reines HTML + JavaScript + three.js, keine Installation).

## Stand

Das Konzept steht in **[Konzept.md](Konzept.md)**. Spielbar ist der **Beginn von Etappe 1**:
Startbildschirm, Intro (Kenji kommt aus der Schule, Kamerafahrt, Erzählstimme mit Untertitel),
danach freies Laufen auf der Startinsel mit Tricks (A Sprung, B Moonwalk, X Silly Dance, Y Butterfly Twirl).
X-Wing und U-Boot stehen am Strand (Einsteigen mit **Y**). Im X-Wing: **Startsequenz** in 10 s, sonst Autostart.
Mars-Trip, U-Boot-Aufgabe und Etappe 2 folgen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | wird von `tools/build_engine.ps1` erzeugt (HUD-Markup aus dem Flugspiel) |
| `engine/` | Flugspiel-Engine + Modelle, **unverändert** kopiert von `tools/build_engine.ps1` |
| `story.js` | die Spiellogik – hängt sich per Wrapper in die Engine ein |
| `kenji_glb.js` | Kenji als eingebettetes GLB (aus `models/kenji.glb`) |
| `sw.js`, `manifest.json` | Offline-Cache und App-Installation (PWA) |

Engine aktualisieren: `powershell -File tools/build_engine.ps1` (Flugspiel-Repo muss daneben liegen).

**Version / Offline:** Committen mit `powershell -File tools/commit.ps1 "Nachricht"` – das zählt die Cache-Version
in `sw.js` hoch, sobald sich eine gecachte Datei ändert; installierte Geräte laden dann die neue Version.
Der pre-commit-Hook (`cp tools/pre-commit .git/hooks/pre-commit`) ist das Sicherheitsnetz: er bricht ab,
wenn die Version vergessen wurde (`git add` im Hook scheitert im Google-Drive-Ordner).

**Diagnose:** `index.html?debug` zeigt unten links den Zustand der Spielfigur.

Fertig sind bisher die Modelle in `models/`:

| Datei | Inhalt |
|---|---|
| `kenji.glb` | Spielfigur Kenji (1,50 m, Mixamo-Skelett, 16 Animationen: `idle`, `walk`, `run`, `jump`, `jump_down`, `land`, `crouch_to_stand`, `swim`, `fly`, `hang`, `dance_hiphop`, `dance_silly`, `moonwalk`, `jump_special`, `aerial_evade`, `butterfly_twirl`) |
| `surfboard.glb` | Surfbrett, 1,90 m |
| `snowboard.glb` | Snowboard, 1,45 m |

## 🙏 Danksagungen

| Modell | Künstler/in | Lizenz |
|---|---|---|
| [Prancha de Surf / Surfboard](https://sketchfab.com/3d-models/prancha-de-surf-surfboard-bafbc865dc8642b1bacc484dd9a5f1fc) | **Leandro Cruz** (Sketchfab) | [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/) – ausgerichtet und skaliert |
| [Intermediate Advanced Snowboard](https://sketchfab.com/3d-models/intermediate-advanced-snowboard-267e04a025434d7d8587ec2ee60ad62e) | **Final Render Animation Studio** (Sketchfab) | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) – skaliert, Material auf PBR umgestellt |

Rigging und Animationen der Spielfigur: **[Mixamo](https://www.mixamo.com)** (Adobe).

## 📄 Lizenz

Der Spielcode ist frei nutzbar. Die 3D-Modelle Dritter unterliegen ihren oben genannten Lizenzen –
bei Weiterverwendung bitte die Namensnennung beibehalten.