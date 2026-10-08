# Trip to Japan – alle gesprochenen Texte

Stand: 08.10.2026, direkt aus dem Code gezogen (`story.js`, `etappe2.js` … `etappe6b.js`).

## Stimmen

Gesprochen wird über die Sprachausgabe des Browsers (`sprich()` in `story.js`). Es gibt zwei Rollen:

| Rolle im Code | Stimme | Wer spricht |
|---|---|---|
| *(keine)* | **weiblich** (Katja, Amala, Seraphina, Louisa, Hedda, Elke, Klarissa, Tanja, Google Deutsch) | Erzählerin, Bodenstation im All, U-Boot-Crew Etappe 1, Startsequenz-Ansage |
| `pilot` | **männlich** (Conrad, Killian, Florian, Stefan, Ralf, Kasper, Bernd, Christoph). Ohne männliche Stimme: Standardstimme mit tieferer Tonlage (pitch 0,75) | Pilot, Kapitän, Kranführer, Polizei, Air-Race-Ansager, U-Boot-Funk Etappe 5 |

- Tempo immer 1,0.
- Mit Ton aus laufen dieselben Sätze als Untertitel.
- `{…}` wird zur Laufzeit eingesetzt.
- Nummerierte Listen sind eine Ansage aus mehreren Sätzen, die nacheinander gesprochen werden.

---

## Allgemein

| Situation | Stimme | Text |
|---|---|---|
| Startsequenz beginnt (X-Wing, freier Flug) | weiblich | Bitte Startsequenz durchführen! |
| Startsequenz geschafft (X-Wing, freier Flug) | weiblich | Startsequenz abgeschlossen. Guten Flug! |

Bei Transall (Etappe 2) und Mustang (Etappe 5) läuft die Startsequenz still. Dort sagen Pilot bzw. Ansager eigene Sätze (siehe unten).

---

## Intro (Spielstart)

**Stimme:** weiblich (Erzählerin) · **Situation:** Kenji kommt aus der Schule, Kamerafahrt

1. Endlich Ferien!
2. Kenji wurde eingeladen, den Sommer mit seinem Freund in Japan zu verbringen.
3. Da er aber kein Geld hat und seine Eltern ihm keines geben wollen, muss er versuchen, auf eigene Faust den Weg zu meistern.
4. Er hat volle sechs Wochen Zeit, sein Ziel zu erreichen, muss aber schwierige Aufgaben meistern.
5. Am Ende winkt ein Abenteuer, das er so noch nie erlebt hat – und vielleicht der größte Spaß seines Lebens.

---

## Etappe 1 – Der Aufbruch am Strand

### Risiko (1 Tag): X-Wing → Startsequenz verpasst → Mars

| Situation | Stimme | Text |
|---|---|---|
| Startsequenz beginnt | weiblich | Bitte Startsequenz durchführen! |
| Startsequenz geschafft | weiblich | Startsequenz abgeschlossen. Guten Flug! |

**Startsequenz verpasst – Autostart ins All, Flug zum Mars** · Stimme: weiblich (Bodenstation)

1. Hallo. Du bist wohl etwas nervös gewesen.
2. Aber keine Sorge, wir haben die Startsequenz und den Start automatisch durchgeführt.
3. Zur Erinnerung: Du hast dich freiwillig gemeldet, als erster Mensch zum Mars zu fliegen und als Beweis einen Stein mitzubringen.
4. Falls du vergessen hast, wie man fliegt, erklären wir es noch einmal kurz.
5. Mit dem linken Stick lenkst du und hebst oder senkst die Nase. Mit L T und R T rollst du.
6. Mit dem rechten Stick stellst du den Schub ein. Bei vollem Schub springt der Warp-Antrieb an, so kommst du schnell zum Mars.
7. Der rote Punkt im Radar zeigt dir den Weg. Kurz vor dem Mars bremst der Antrieb von selbst ab.
8. Zum Landen gehst du auf zehn Prozent Schub, dann sinkt der X-Wing langsam und setzt senkrecht auf.
9. Mit Y steigst du aus und wieder ein. Zum Starten gibst du zwanzig Prozent Schub, dann steigst du senkrecht auf.
10. Du kommst schon klar. Wir sehen und hören uns dann in einer Woche wieder. Viel Spaß!

| Situation | Stimme | Text |
|---|---|---|
| Stein aufgehoben | weiblich | Super, du hast den Stein! Jetzt zurück zur Erde. |

### Sicher (4 Tage): U-Boot → zwei Wracks fotografieren

**Nach dem Einsteigen, Ziffernfeld zeigt 14 02** · Stimme: weiblich (U-Boot-Crew)

1. Hallo, danke für deine Hilfe.
2. Du siehst jung aus, und als würdest du zum ersten Mal ein U-Boot fahren. Wir helfen dir.
3. Wir haben den universellen Code für U-Boote für dich eingegeben.
4. Jetzt erklären wir dir kurz die Steuerung.
5. Mit dem rechten Stick oder W und S gibst du Fahrt. Ohne Fahrt kann das U-Boot nicht tauchen.
6. Linker Stick nach vorn oder Pfeil hoch taucht ab, nach hinten taucht wieder auf. Gelenkt wird nach links und rechts.
7. Mit B schickst du einen Sonar-Ping: Je näher ein Wrack ist, desto lauter kommt er zurück. Nach jedem Ping zeigt dir die Scheibe oben rechts kurz die Wracks als rote Punkte.
8. Wir möchten die Wracks nachbauen, um daraus künstliche Riffe zu erschaffen.
9. Wir wissen, dass es hier in der Nähe viele Wracks gibt.
10. Finde zwei unterschiedliche Schiffswracks und mache jeweils ein Foto davon, dann können wir der Umwelt helfen.
11. Fotografiert wird mit {Y am Controller / F an der Tastatur}, wenn du nah genug dran bist. Viel Spaß!

| Situation | Stimme | Text |
|---|---|---|
| Foto: Schiffstyp schon vorhanden | weiblich | Diesen Schiffstyp haben wir schon. Such ein anderes Schiff! |
| Erstes Foto | weiblich | Super, ein {Frachter / Segelschiff}! Jetzt fehlt noch ein anderes Schiff. |
| Zweites Foto – geschafft | weiblich | Toll gemacht! Mit beiden Fotos können wir die Riffe bauen. Danke! |

---

## Etappe 2 – Die Wüste

### Risiko (1 Tag): X-Wing mit Kurzschluss → Startsequenz verpasst → Mond

| Situation | Stimme | Text |
|---|---|---|
| Startsequenz beginnt | weiblich | Bitte Startsequenz durchführen! |
| Startsequenz geschafft (trotz Kurzschluss) | weiblich | Startsequenz abgeschlossen. Guten Flug! |

**Startsequenz verpasst – Fall A: in Etappe 1 schon auf dem Mars** · Stimme: weiblich

1. Du schon wieder. Wohl immer noch ein wenig nervös, was?
2. Diesmal war es aber nicht deine Schuld. Der Flieger hatte einen Kurzschluss, deshalb war die Startsequenz nicht wie gewohnt.
3. Wir haben das wieder automatisch geregelt. Alles andere kennst du schon.
4. Der Unterschied ist: Diesmal fliegst du zum Mond und holst von dort einen Stein. Bis in einer Woche dann!

**Startsequenz verpasst – Fall B: zum ersten Mal im All** · Stimme: weiblich

1. Hallo. Da hatte der Flieger wohl einen Kurzschluss, deshalb war die Startsequenz nicht wie gewohnt.
2. Aber keine Sorge, wir haben die Startsequenz und den Start automatisch durchgeführt.
3. Zur Erinnerung: Du hast dich freiwillig gemeldet, zum Mond zu fliegen und als Beweis einen Stein mitzubringen.
4. Falls du vergessen hast, wie man fliegt, erklären wir es noch einmal kurz.
5. Mit dem linken Stick lenkst du und hebst oder senkst die Nase. Mit L T und R T rollst du.
6. Mit dem rechten Stick stellst du den Schub ein. Bei vollem Schub springt der Warp-Antrieb an, so kommst du schnell zum Mars.
7. Der rote Punkt im Radar zeigt dir den Weg. Kurz vor dem Mars bremst der Antrieb von selbst ab.
8. Zum Landen gehst du auf zehn Prozent Schub, dann sinkt der X-Wing langsam und setzt senkrecht auf.
9. Mit Y steigst du aus und wieder ein. Zum Starten gibst du zwanzig Prozent Schub, dann steigst du senkrecht auf.
10. Du kommst schon klar. Wir sehen und hören uns dann in einer Woche wieder. Viel Spaß!

> ⚠️ Auffällig: Sätze 6 und 7 sagen „zum Mars“ / „vor dem Mars“, obwohl das Ziel der Mond ist. Sie stammen aus dem Mars-Text.

| Situation | Stimme | Text |
|---|---|---|
| Stein aufgehoben | weiblich | Super, du hast den Stein! Jetzt zurück zur Erde. |

### Sicher (4 Tage): Transall → Flugschule, Kiste abwerfen

**Nach dem Einsteigen, am Boden** · Stimme: männlich (Pilot)

1. Hallo, willkommen an Bord! Ich bin dein Pilot. Wir bringen Hilfsgüter zu einer Oase in der Wüste. Pass gut auf, dann lernst du was.
2. Vor jedem Flug machen wir die Startsequenz: Bremse halten, Ruder links und rechts, Nase hoch und runter, Bremse los, Gas geben.
3. Leuchtet dabei dieses rote Symbol mit den zwei Pfeilen, hat der Flieger einen Kurzschluss. Dann ist alles vertauscht, und du musst umgekehrt steuern.
4. Zum Starten gibst du nach der Startsequenz Vollgas. Ab etwa hundertfünfzig Kilometern pro Stunde ziehst du die Nase sanft hoch.
5. Wir fliegen auf dreihundert Metern. Halte die Höhe zwischen zweihundertsiebzig und dreihundertdreißig.
6. Die Kisten fallen mit unserem Schwung nach vorne. Je schneller wir sind, desto früher musst du sie abwerfen.
7. Merk dir: Schub in Prozent mal fünf gleich Meter vor dem Ziel. Bei sechzig Prozent wirfst du also dreihundert Meter vorher ab, bei hundert Prozent fünfhundert Meter.
8. Abgeworfen wird mit B. Die Entfernung zur Oase steht in der Anzeige.
9. Und zum Landen: Gas auf dreißig Prozent und langsam runter. Halte die Nase und die Flügel gerade. Wird der Ring im Gyroskop rechts grün, bist du im richtigen Winkel. Dann aufsetzen und bremsen.

| Situation | Stimme | Text |
|---|---|---|
| Frage (Auswahl Ja / Nein) | männlich | Und, du kannst doch fliegen, oder? |
| Antwort „Nein“ → 7 Tage | männlich | Oh man! Für Anfänger ist das leider nichts. Bitte steige wieder aus. |
| Antwort „Ja“ | männlich | Super! Dann zeig mal, was du kannst. Erst die Startsequenz. |
| Startsequenz geschafft | männlich | Sehr gut! Jetzt Vollgas und ab zur Oase. Der rote Punkt im Radar zeigt dir den Weg. |
| Kiste unter 20 m von der Mitte → 4 Tage | männlich | Perfekt! Mitten in die Oase! |
| Kiste getroffen → 4 Tage | männlich | Gut gemacht! Die Kiste ist angekommen. |
| Kiste daneben → 7 Tage | männlich | Oh, daneben. Die Leute müssen die Kiste jetzt suchen. |

---

## Etappe 3 – Der Fluss

### Risiko (1 Tag): X-Wing → Startsequenz verpasst → Mond

| Situation | Stimme | Text |
|---|---|---|
| Startsequenz beginnt | weiblich | Bitte Startsequenz durchführen! |
| Startsequenz geschafft | weiblich | Startsequenz abgeschlossen. Guten Flug! |

Startsequenz verpasst: Der Text hängt davon ab, wo Kenji schon war. Stimme: weiblich (Bodenstation).

**Fall A – Mars (E1) und Mond (E2):**

1. Na, wen haben wir denn da? Erst der Mars, dann der Mond, und jetzt schon wieder. Du bist ja ein richtiger Weltraum-Profi.
2. Das trifft sich gut. Wir haben es nämlich auch verbockt und den Stein vom Mond verloren.
3. Hol mal bitte noch einen. Du weißt ja, wie es geht. Bis nächste Woche dann!

**Fall B – nur Mond (E2):**

1. Du schon wieder.
2. Das trifft sich ja gut. Wir haben es nämlich auch verbockt und den Stein vom Mond verloren.
3. Hol mal bitte noch einen. Du weißt ja, wie es geht. Bis nächste Woche dann!

**Fall C – nur Mars (E1):**

1. Du schon wieder. Wohl immer noch ein wenig nervös, was?
2. Wir haben die Startsequenz und den Start wieder automatisch erledigt. Wie man fliegt, weißt du ja noch vom Mars.
3. Diesmal geht es zum Mond. Hol von dort einen Stein, genau wie auf dem Mars. Bis in einer Woche dann!

**Fall D – zum ersten Mal im All:**

1. Hallo. Du warst wohl etwas nervös.
2. Aber keine Sorge, wir haben die Startsequenz und den Start automatisch durchgeführt.
3. Zur Erinnerung: Du hast dich freiwillig gemeldet, zum Mond zu fliegen und als Beweis einen Stein mitzubringen.
4. Falls du vergessen hast, wie man fliegt, erklären wir es noch einmal kurz.
5. Mit dem linken Stick lenkst du und hebst oder senkst die Nase. Mit L T und R T rollst du.
6. Mit dem rechten Stick stellst du den Schub ein. Bei vollem Schub springt der Warp-Antrieb an, so kommst du schnell zum Mars.
7. Der rote Punkt im Radar zeigt dir den Weg. Kurz vor dem Mars bremst der Antrieb von selbst ab.
8. Zum Landen gehst du auf zehn Prozent Schub, dann sinkt der X-Wing langsam und setzt senkrecht auf.
9. Mit Y steigst du aus und wieder ein. Zum Starten gibst du zwanzig Prozent Schub, dann steigst du senkrecht auf.
10. Du kommst schon klar. Wir sehen und hören uns dann in einer Woche wieder. Viel Spaß!

> ⚠️ Wie Etappe 2 Fall B: Sätze 6 und 7 sagen „Mars“.

| Situation | Stimme | Text |
|---|---|---|
| Stein aufgehoben | weiblich | Super, du hast den Stein! Jetzt zurück zur Erde. |

### Sicher (4 Tage): Feuerwehrboot → drei Feuer löschen

**Nach dem Einsteigen** · Stimme: männlich (Kapitän)

1. Ahoi! Gut, dass du da bist. Weiter unten am Fluss brennt es an drei Stellen, und wir brauchen jede Hand.
2. Mit dem rechten Stick oder W und S gibst du Gas, gelenkt wird mit dem linken Stick oder den Pfeilen.
3. Pass auf: Ein Boot ist schwer. Es fährt in der Kurve weiter geradeaus, bevor es dreht, und je schneller du bist, desto schlechter gehorcht das Ruder. Vor jeder Kurve nimmst du also Gas zurück und lenkst früh ein.
4. Die Strömung schiebt uns flussabwärts. Wer zu schnell ist, landet auf den Felsen.
5. Zum Löschen bremst du ab und stellst dich quer, mit der Nase zum Feuer am Ufer. Dann schaltest du mit B den Wasserstrahl ein.
6. Drei Feuer in zwei Minuten. Und höchstens zwei Mal an einen Felsen, sonst ist das Boot hin. Los geht's!

| Situation | Stimme | Text |
|---|---|---|
| 1. Felskontakt | männlich | Vorsicht, ein Felsen! Langsamer in den Kurven. |
| 2. Felskontakt | männlich | Noch ein Felsen! Beim nächsten ist das Boot hin. |
| 1. Feuer aus | männlich | Super, das erste Feuer ist aus! |
| 2. Feuer aus | männlich | Klasse, nur noch eins! |
| Alle Feuer aus → 4 Tage | männlich | Großartig! Alle Feuer sind aus. Du bist ein echter Held! |
| Zeit abgelaufen → 7 Tage | männlich | Oh nein, das hat zu lange gedauert. Die Feuerwehr vom Land übernimmt. |
| 3. Felskontakt → 7 Tage | männlich | Autsch! Das Boot ist leck. Wir müssen abschleppen lassen. |

---

## Etappe 4 – Der Hafen

### Risiko (1 Tag): Schnellboot → Flucht vor der Polizei

| Situation | Stimme | Text |
|---|---|---|
| Start der Flucht (mit Sirene) | männlich (Polizei) | Halt! Polizei! Stehen bleiben! |
| 1. Kontakt mit der Kaimauer | männlich | Autsch, die Mauer! |
| 1. Kontakt mit einem Felsen | männlich | Autsch, ein Felsen! |
| 2. Kontakt | männlich | Noch einer! Beim nächsten ist das Boot hin. |
| Entkommen → 1 Tag | männlich | Geschafft! Die Polizei ist weit hinten. Ab aufs offene Meer! |

**Eingeholt → 7 Tage** · Stimme: männlich

1. Halt, Polizei! Das war's mit der Flucht.
2. Kenji muss mit auf die Wache. Ein geklautes Boot ist kein Spaß.
3. Nach einer Woche im Gefängnis darf er wieder gehen. Er hat viel Zeit gehabt, über alles nachzudenken.

**3. Kontakt, Boot zerschellt → 7 Tage** · Stimme: männlich

1. Krach! Das Boot ist am Felsen zerschellt, und schon ist die Polizei da.
2. Kenji muss mit auf die Wache. Ein geklautes Boot ist kein Spaß.
3. Nach einer Woche im Gefängnis darf er wieder gehen. Er hat viel Zeit gehabt, über alles nachzudenken.

### Sicher (4 Tage): Container-Kran → vier Container verladen

**Nach dem Einsteigen** · Stimme: männlich (Kranführer)

1. Hallo! Wir müssen vier Container auf das Schiff bringen, und es weht ganz schön.
2. Mit dem linken Stick oder den Pfeilen links und rechts drehst du den Ausleger, jedes Mal um fünf Grad. Mit R T fährt die Laufkatze einen Marker nach außen, mit L T einen nach innen. Auf der Tastatur sind das E und Q.
3. Mit dem rechten Stick oder W und S hebst und senkst du den Haken. Mit B hängst du einen Container an und löst ihn wieder.
4. Der Container hängt am Seil wie eine Schaukel. Wer schnell hintereinander fährt, bringt ihn zum Pendeln. Ganz oben hängt er fest unter der Katze, dort beruhigt er sich sofort.
5. Rechts siehst du den Ladeplan: das Schiff von oben, die vier Lücken, und wo dein Haken gerade ist. Dazu für jede Lücke Winkel und Marker. Mit P blendest du ihn aus und ein.
6. Oben siehst du, wie hoch dein Container über dem hängt, was darunter ist. Grün heißt aufgesetzt. Im Plan stehen die Seillängen zum Greifen und Absetzen.
7. Sechs Minuten hast du, und höchstens zwei Fehler. Lass dir Zeit, Geduld ist hier die Kunst. Los geht's!

| Situation | Stimme | Text |
|---|---|---|
| Container gegriffen | männlich | Angehängt. |
| 1. Container abgesetzt | männlich | Sehr gut, der erste sitzt! |
| 2. Container abgesetzt | männlich | Prima, schon zwei! |
| 3. Container abgesetzt | männlich | Super, nur noch einer! |
| 4. Container → 4 Tage | männlich | Großartig! Alle vier Container sind an Bord. Das war echte Geduldsarbeit! |
| 1. Fehler | männlich | {Grund}. Ein Fehler. |
| 2. Fehler | männlich | {Grund}. Zwei Fehler – der nächste ist zu viel. |
| 3. Fehler → 7 Tage | männlich | Oh nein, das waren zu viele Fehler. Wir brechen ab. |
| Zeit abgelaufen → 7 Tage | männlich | Oh, die Zeit ist um. Das Schiff muss ohne die Container auslaufen. |

Mögliche **{Grund}**-Texte (der erste Buchstabe wird großgeschrieben):

- Container fallen gelassen
- Fallen gelassen
- Daneben – Container stößt an
- Zu unruhig für die enge Lücke
- Zu hart aufgesetzt
- Pendelt noch beim Lösen

---

## Etappe 5 – Chinesisches Meer

### Risiko (1 Tag): U-Boot → Code und Felsenschlucht

**Nach dem Einsteigen, Code-Pad offen** · Stimme: männlich (Funk)

1. Hallo! Dieses U-Boot braucht einen Code, sonst fährt es nicht los.
2. Du hast nur einen Versuch. Kennst du ihn? Mit Raute bestätigst du, mit Stern löschst du die letzte Ziffer.

| Situation | Stimme | Text |
|---|---|---|
| Code richtig (14 02) | männlich | Code richtig! Das U-Boot ist frei. Abtauchen und durch die Felsenschlucht – vorsichtig, die Wände sind nah. |
| 1. Kontakt mit der Felswand | männlich | Autsch, die Felswand! |
| 1. Kontakt mit der Felsdecke | männlich | Bumm, die Felsdecke! Nicht so hoch! |
| 1. Kontakt mit dem Felsbogen | männlich | Bumm! Unter dem Felsbogen musst du tiefer! |
| 1. Kontakt mit der Felsrippe | männlich | Krach! Über die Felsrippe musst du höher! |
| 2. Kontakt | männlich | Noch ein Treffer! Beim nächsten ist der Rumpf leck. |
| Durch die Schlucht → 1 Tag | männlich | Geschafft! Durch die ganze Schlucht – das war Maßarbeit! |

**Code falsch → 7 Tage** · Stimme: männlich

1. Falscher Code. Das U-Boot bleibt gesperrt.
2. Ein Fischer nimmt Kenji schließlich mit – sein Kutter ist langsam, und die Fahrt dauert eine ganze Woche.

**3. Kontakt, Rumpf leck → 7 Tage** · Stimme: männlich

1. Krach! Der Rumpf ist leck, das U-Boot muss auftauchen.
2. Bis es repariert ist, vergeht eine ganze Woche.

**Zeit abgelaufen (250 s) → 7 Tage** · Stimme: männlich

1. Die Zeit ist um – der Sauerstoff wird knapp, das U-Boot muss auftauchen.
2. Die Fahrt dauert jetzt viel länger: eine ganze Woche.

### Sicher (4 Tage): Mustang → Air Race

**Nach dem Einsteigen, vor der Startsequenz** · Stimme: männlich (Ansager)

1. Willkommen beim Air Race über dem Chinesischen Meer! Ich bin heute dein Ansager.
2. Du fliegst die Mustang durch {Anzahl der Tore} Tore: zwischen den Pylonen hindurch, unter der Spitze, und durch die Ringe.
3. Dazu kommen drei Figuren: ein Messerflug durch ein ganz schmales Tor, ein Looping und ein Steilflug senkrecht hoch durch zwei Ringe übereinander. Zum Schluss eine Schraube, und nach dem Ziel landest du auf der Insel.
4. Gewertet wird die Zeit. Ein verpasstes Tor kostet fünf Sekunden, ein gestreifter Pylon oder eine vergessene Figur drei.
5. Schaffst du es unter 80 Sekunden, geht es schon morgen weiter nach Japan.
6. Es leuchtet immer das Tor, durch das du als Nächstes musst, dahinter siehst du schon das folgende. Ich sage dir an, wenn eine Figur kommt.
7. Erst die Startsequenz, dann geht es los!

> ⚠️ Auffällig: Satz 3 sagt „drei Figuren“, zählt aber vier auf (Messerflug, Looping, Steilflug, Schraube). Satz 4 nennt „zu hoch +2 s“ und „Looping +15 s“ nicht.

| Situation | Stimme | Text |
|---|---|---|
| Startsequenz geschafft | männlich | Startsequenz abgeschlossen. Die Zeit läuft – Vollgas und ab durchs erste Tor! |
| Vor dem Messerflug-Tor | männlich | Messerflug! Leg die Mustang auf die Seite. |
| Vor dem Looping-Eingang | männlich | Jetzt der Looping! Durch den Ring, dann voll ziehen und durch den zweiten Ring wieder raus. |
| Vor dem Steilflug (unterer Ring) | männlich | Steilflug! Unter dem Ring senkrecht hochziehen und durch beide Ringe nach oben. |
| Vor dem oberen Ring | männlich | Weiter senkrecht hoch, durch den oberen Ring! |
| Nach dem Steilflug | männlich | Über den Rücken abkippen und zurück zur Insel! |
| Vor der Schraube | männlich | Letzte Figur: bis zum Zielring eine Schraube – einmal ganz um die eigene Achse rollen! |
| Messerflug richtig | männlich | Messerflug, super! |
| Looping richtig | männlich | Looping geschafft! |
| Schraube richtig | männlich | Schraube, klasse! |
| Pylon gestreift (+3 s) | männlich | Pylon gestreift! Plus drei Sekunden. |
| Zu hoch über dem Pylon (+2 s) | männlich | Zu hoch! Plus zwei Sekunden. |
| Messerflug nicht auf der Seite (+3 s) | männlich | Nicht auf der Seite! Plus drei Sekunden. |
| Looping nicht vollständig (+15 s) | männlich | Kein ganzer Looping! Plus fünfzehn Sekunden. |
| Keine Schraube (+3 s) | männlich | Keine Schraube gedreht! Plus drei Sekunden. |
| Tor verpasst (+5 s) | männlich | Tor verpasst! Plus fünf Sekunden. |
| Gelandet → 4 Tage | männlich | Sauber gelandet! {Zeit, z. B. 72,4} Sekunden – super geflogen! |
| Abgestürzt → 7 Tage | männlich | Oh nein, die Mustang ist abgestürzt! Das Rennen ist vorbei. |
| Über 80 s → 7 Tage | männlich | Die Zeit ist um. Schade – das war leider zu langsam. |

**Zielring durchflogen** · Stimme: männlich

1. Im Ziel! Die Zeit ist gestoppt – jetzt noch sauber auf der Insel landen.
2. Gas auf zwanzig Prozent, langsam runter und auf der Bahn aufsetzen.

---

## Etappe 6 – Japan (Fuji)

| Situation | Stimme | Text |
|---|---|---|
| Hinweis nach der Ankunft (Text, nicht gesprochen) | – | Zwei Wege: Alpha Jet (weiß) oder Shinkansen (gelber Ring am Bahnsteig) – hinlaufen und Y drücken |
| Shinkansen-Ring (Text) | – | Die Fahrt mit dem Shinkansen kommt bald – nimm heute den Alpha Jet! |

### Risiko (1 Tag): Alpha Jet → Höhle im Fuji

Keine Ansage beim Einsteigen, nur das Startsequenz-HUD mit Countdown (still).

**Startsequenz verpasst → 7 Tage** · Stimme: männlich

1. Die Startsequenz hat nicht geklappt – ohne Startsequenz darf hier keiner fliegen.
2. Die Flughafenpolizei nimmt Kenji fest. Eine Woche Gefängnis.

| Situation | Stimme | Text |
|---|---|---|
| Startsequenz geschafft (Text) | – | Folge dem roten Punkt im Radar – Start: X / Shift halten |

**In der Höhle, Autopilot** · Stimme: männlich

1. Wie bist du hier reingeraten? Egal!
2. Du musst da schleunigst raus, der Vulkan bricht gleich aus.
3. Immer Vollgas durch die Höhle.
4. Drei
5. Zwei
6. Eins
7. LOS!

| Situation | Stimme | Text |
|---|---|---|
| Ab jetzt selbst fliegen (Text) | – | Vollgas! Durch die Höhle – nichts berühren! |
| Fels berührt → 7 Tage | männlich | Krach – der Alpha ist am Fels zerschellt! · Kenji wird gerettet, muss aber eine Woche ins Krankenhaus. |
| Unter 100 % Schub → 7 Tage | männlich | Zu langsam! Du musst immer Vollgas fliegen – der Vulkan war schneller. |

**Nach der Filmsequenz, 2 s nach der Blende (500 m, 50 % Schub)** · Stimme: männlich

1. Du bist der Wahnsinn – ein wahres Fliegerass!
2. Jetzt noch landen, dann hast du es geschafft.

Dazu der Hinweis (Text): *Lande am Flughafen am Strand (roter Punkt im Radar)*

| Situation | Stimme | Text |
|---|---|---|
| Gelandet → 1 Tag | männlich | Sauber gelandet! Was für ein Flug! |
| Abgestürzt (Hinflug oder nach der Höhle) → 7 Tage | männlich | Oh nein, abgestürzt! · Kenji kommt ins Krankenhaus und muss eine Woche bleiben. |

### Sicher (4 Tage): Shinkansen

Folgt.
