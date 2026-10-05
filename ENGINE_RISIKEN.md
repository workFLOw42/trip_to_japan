# Risiken bei der Übernahme der Flugspiel-Engine

Geprüft: `engine/engine.js` (13.946 Zeilen, unveränderte Kopie aus dem Flugspiel) gegen `story.js` und `etappe2.js`.
Kategorie **akut** = betrifft Etappe 1/2 schon jetzt · **später** = betrifft geplante Etappen laut Konzept ·
**Wartung** = Engine-Updates und Build. Die Lösungen sind Vorschläge, noch nichts davon ist umgesetzt.

*Stand: 02.10.2026, Engine 13.946 Zeilen.*

## Funde

### Tasten und Eingabe

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|
| R3 | niedrig | akut | engine.js:11070 · etappe2.js (Kistenabwurf) | Taste **B** ruft zusätzlich `buttonB()` der Engine auf. In der Transall ist das der Engine-Kistenabwurf (`dropCrate`), den etappe2.js sperrt – funktioniert, hängt aber an dieser Sperre. Im All ist B der Laser. | **Entschieden:** Jedes Fahrzeug hat auf B seine eigene Funktion. Ob sie in einer Etappe gebraucht wird oder gesperrt werden muss, wird von Fall zu Fall bei der jeweiligen Etappe entschieden (Transall: gesperrt). |

### Lade-Callbacks

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|
| R5 | mittel | akut | engine.js:7088, 7139, 7470, 7501, 7580 | Fünf Modell-Ladecallbacks rufen `refreshIslands()` auf, sobald ihr Modell fertig ist – auch Sekunden nach dem Start. Das baut alle Inselzellen neu. Die Story-Kulissen hängen nicht an den Inselzellen und überleben das, aber jede Story-Änderung an Inselbauten (z. B. ein Objekt in einer Inselgruppe) würde dabei verschwinden. | Story-Objekte nie in Inselgruppen hängen (bisher so); bei Bedarf `refreshIslands` wrappen und Story-Bauten danach neu setzen. |
| R6 | niedrig | akut | engine.js:7084, 7135 | Der Callback ruft `buildModel(name)`, wenn das aktive Modell nachlädt. Harmlos für das Flugzeug selbst, aber `buildModel` setzt ggf. Modellparameter neu – wer kurz nach dem Start einsteigt, bekommt das Modell zweimal gebaut. | Beobachten; kein Handlungsbedarf, solange nach `buildModel` nichts Story-Eigenes am Modell hängt. |

### Timer

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|

### Feste Annahmen der Engine (Höhe, Welt)

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|
| R8 | hoch | später | engine.js:10344, 11869–11877, 8011–8012 | Jedes Modell hat eine **Höchstgrenze** (`maxAlt`, gerechnet ab Meereshöhe `ISLAND_Y`, nicht ab Boden): Alpha Jet 2.200 m, Mustang 1.400 m, Transall 600 m. Ab 3.000 m wird der Himmel dunkel, ab 4.000 m wechselt die Engine ins All. Ein echter **Fuji (3.776 m)** läge mitten im All-Übergang, und der Alpha Jet käme nicht über den Gipfel. | Fuji-Modell auf einen Gipfel weit unter 2.200 m skalieren (z. B. 1.200–1.500 m) – oder für Etappe 6 `maxAlt` und den All-Übergang (`ATMO_TOP`/`SPACE_Y`) per Wrapper anheben. Vor Etappe 6 entscheiden. |
| R9 | mittel | später | engine.js:11869 | Die Höhengrenze rechnet ab Meereshöhe. Über einem hohen Gelände (Fuji, Dünen) bleibt dem Flugzeug weniger Luft als gedacht: über einem 1.500-m-Gipfel hat der Alpha Jet nur noch 700 m. Für den Fallschirm-Absprung über dem Gipfel (Finale) kann das knapp werden. | Absprunghöhe im Finale gegen `maxAlt − Gipfelhöhe` planen. |
| R10 | mittel | später | engine.js:8800–8823 | `surfaceY` auf der Erde kennt nur Insel (0,3 m), Träger und Wasser. Jedes **eigene Gelände** (Wüste, Fuji, Höhle, Hafenkai) muss wie in etappe2.js `surfaceY`, `evaFootY`, `isOnLand`, `isOnBeach`, `isOpenWater`, `seaYAt`, `seabedY` und `hitsBuilding` **gemeinsam** ersetzen – fehlt eine, landet Kenji im Boden oder schwimmt im Sand. | Für jede neue Welt eine gemeinsame „Gelände-Schicht“ bauen (wie `hookWelt2`), statt einzelne Funktionen zu ersetzen. |
| R11 | mittel | später | engine.js:5549–5617, 5656–5661 | Schatten (Kenji und Fahrzeuge) liegen an Land fest auf `ISLAND_Y`. Für Kenji ist das gelöst (story.js), **für Flugzeuge nicht** – auf einem Gelände mit Höhe (Fuji, Kai, Dünen) schwebt der Flugzeugschatten unter der Oberfläche oder ist unsichtbar. | Für hohes Gelände den Flugzeugschatten genauso auf `surfaceY` setzen (wie bei Kenji). |

### Performance

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|
| R13 | niedrig | später | engine.js:52–59 | Das Bodengitter ist nur **6 × 6 km** groß und folgt dem Spieler. Für weite Flüge über eigenes Gelände (Wüste, später Küste/Japan) sieht man am Horizont den Gitterrand, wenn die Sichtweite (Nebel 3 km) erhöht wird. | Nebel/Sichtweite nicht über ~3 km anheben, oder eigene Geländekacheln wie Mond/Mars nutzen. |

### Aufräumen

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|

### Wartung (Engine-Updates, Build)

| ID | Schwere | Kat. | Ort | Problem | Mögliche Lösung |
|---|---|---|---|---|---|
| R16 | hoch | Wartung | story.js + etappe2.js (62 ersetzte Funktionen) | Die Story ersetzt **62 Engine-Funktionen** per Namen (z. B. `updateEva`, `readInput`, `stepPhysics`, `surfaceY`, `hitsBuilding`). Heute gibt es alle, keine ist `const` (also ersetzbar). Wird im Flugspiel eine davon **umbenannt, zur `const`-Pfeilfunktion oder intern anders aufgerufen**, greift der Wrapper still nicht mehr – ohne Fehlermeldung. | Beim Build prüfen, dass alle 62 Namen als `function Name(` in engine.js stehen, und sonst abbrechen. Die Liste kann das Build-Skript selbst aus story.js/etappe2.js ziehen. |
| R17 | hoch | Wartung | tools/build_engine.ps1 | Das Build-Skript fügt die Hooks fest vor `updateIslands();` und vor dem **letzten** `requestAnimationFrame(loop);` ein und bricht ab, wenn es sie nicht findet – gut. Ändert sich aber die **Reihenfolge im Boot-Block** (z. B. neue `preload*`-Aufrufe vor `updateIslands`), laufen die Story-Wrapper zu spät für diese. | Nach jedem Engine-Update den Boot-Block lesen (letzte ~25 Zeilen von engine.js) und die Testreihe laufen lassen. |
| R18 | mittel | Wartung | story.js / etappe2.js (direkte Engine-Variablen) | Die Story liest und schreibt viele Engine-Variablen direkt (`state`, `eva`, `locale`, `wantHangarStart`, `_islandCache`, `_wreckCache`, `periT`, `sonarCool`, `harborHeight`, `seaPos`, `seaCol` …). Umbenennungen im Flugspiel brechen das ebenfalls still. | Wie R16 in die Build-Prüfung aufnehmen. |
| R19 | mittel | Wartung | engine.js (Zeilennummern) | Kommentare, Notizen und Tests im Projekt nennen Engine-Zeilennummern. Nach jedem Flugspiel-Update verschieben sie sich. | Zeilennummern nur als Hinweis verstehen; Stellen immer über Funktionsnamen suchen. |

## Bereits gelöst

- R1: X im U-Boot verstellte den Schub (Tastatur auf 0, Controller-Boost auf 100/50 %) → Foto liegt jetzt auf Controller **Y** bzw. Tastatur **F**, die Anzeige nennt die Taste passend zum Eingabegerät, X ist im U-Boot wirkungslos.
- R2: Taste V (`cycleView`) verstellte den Kameraabstand, auf den die Story-Kameras nicht ausgelegt sind → in der Story gesperrt (`cycleView` ist leer, `viewMode` bleibt 0). Damit ersetzt die Story eine Engine-Funktion mehr (R16).
- R4: R / Start setzte mitten im Flug zurück (Ausweg aus einem 7-Tage-Absturz) → manueller Reset gesperrt. `resetPlane` wirkt nur noch nach einem Absturz (Engine-Löschsequenz oder R zum Abkürzen); in Flugaufgaben wird daraus das Etappen-Ende mit 7 Tagen.
- R12: Wüstenboden wurde jedes Bild neu gerechnet (5,3 ms) → das Gitter rastet in der Wüste auf 62,5 m ein (`recycleWorld`-Wrapper), gerechnet wird nur bei einem Rasterwechsel. Gemessen: im Stand 0,01 ms, bei 240 m/s im Mittel 0,54 ms (einzelne Bilder mit Rasterwechsel weiter ~8 ms).
- R7: Story-`setTimeout`s liefen in Pause und Globus weiter → `story.spaeter(sek, fn)` zählt über die Spielzeit (steht bei offener Anleitung und im Globus). Anleitung hält zusätzlich Ansagen an, die Aufgabe nur die Ansagen (Spiel läuft). Beim Start einer Globus-Reise werden Ansagen und Timer der alten Etappe verworfen. Schwarzblende und Untertitel-Takt bleiben bei `setTimeout`.
- R14: Etappe-1-Kulissen wurden nur ausgeblendet → `e1aufraeumen` entfernt Schule, Ring, Marken samt Schildern und Stein und gibt Geometrie, Material und Texturen frei (`story.entsorgen`, auch für spätere Etappen nutzbar).
- R15: Globus-Fäden wurden jedes Bild neu gebaut, aber nie freigegeben → vor dem Neuzeichnen `entsorgen`. Gemessen: Geometrien im Globus bleiben stabil (416 → 417 in 3 s).
- Wrapper reichte nur 4 von 5 Argumenten an `hitsBuilding` weiter → Schiffe drehten auf der Stelle (alle Wrapper nutzen jetzt `.apply(this, arguments)`).
- Zustände liefen in die nächste Etappe mit (`autostart.blende` → Autostart endlos) → Zurücksetzen beim Etappenwechsel.
- `resetPlane` räumt Sirene/Feuerwehr auf, wird beim Etappen-Ende umgangen → Aufräumen in der Schwarzblende zum Globus.
- KI-Canadairs legten Feuer auf der einzigen Insel, KI-Flotte stürzte in der Wüste ab → Feuersuche bzw. Flotte abgeschaltet.
- Schatten an Land fest auf `ISLAND_Y` → für Kenji auf echte Bodenhöhe gesetzt (Flugzeuge siehe R11).
- Ladecallback (`preloadFord`) rief `placeAtStart` und warf Kenji aus dem Fußmodus → Träger-Modell wird nicht geladen.