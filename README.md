# Trip to Japan 🇯🇵

Ein 3D-Abenteuerspiel im Browser: **Kenji** will in den Sommerferien ohne Geld bis nach Japan –
über 6 Etappen mit X-Wing, U-Boot, Transall, Feuerwehrboot, Container-Kran, Mustang und Alpha Jet,
bis zum Surf-Finale am Mt. Fuji.

Technische Basis ist die Engine des **[Flugspiel](https://github.com/workFLOw42/flightsimulator)**
(reines HTML + JavaScript + three.js, keine Installation).

## Stand

Das Spiel ist in der **Konzeptphase**. Das Konzept steht in **[Konzept.md](Konzept.md)**.

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