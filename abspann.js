// Trip to Japan – Ende der Reise (Live-Wunsch 13.10.2026): Reiselog, Abspann, "Ab zum Strand", Stufe 5 am Strand.
// Laedt nach finale.js, vor der Engine.
//   Reiselog: jedes Etappen-Ende (story.etappeEnde 1-5, story.e6ankunft 6) traegt Etappe, Ort, Weg und Tage ein.
//   Abspann: laeuft einmal, beim ersten Aussteigen aus dem Surfen (finale.js ruft story.abspann). Langsame Kamerafahrt um den
//            Fukuoka-Beach und den Fuji, darueber rollt der Text: Reise-Zusammenfassung, Trick-Statistik, Widmung
//            "Für Samu! Hab dich lieb!", unten rechts "by workFLOw ©2026". Danach frei weiterspielen.
//   Pro-Run (Stufe 1, 6 Tage) geschafft -> localStorage; im Startmenue unter "Neues Spiel" dann "Ab zum Strand" (alles frei).
//   Stufe 5 (42 Tage): kein Surfen (Schild "Außer Betrieb"); kurze Szene am Strand, dann der Abspann.
(function(){
'use strict';
const story = window.STORY;
const PRO_KEY = 'reise-nach-japan-pro';
const ORT = ['München', 'Die Wüste', 'Der Indische Ozean', 'Südostasien', 'Chinesisches Meer', 'Japan – Tokio'];

// ---- Reiselog -----------------------------------------------------------------------------------------------------
story.reiseLog = story.reiseLog || [];
function loggen(etappe, tage, wie){
  if(story.reiseLog.some(e => e.etappe === etappe)) return;   // je Etappe einmal (Neustart/Test)
  story.reiseLog.push({ etappe, ort: ORT[etappe - 1] || ('Etappe ' + etappe), tage, wie: wie || '' });
}
const endeOrig = story.etappeEnde;
story.etappeEnde = function(tage, wie){ loggen(story.etappe, tage, wie); return endeOrig.apply(this, arguments); };
// Etappe 1 endet in story.js intern (X-Wing, U-Boot, Mars) – dort fehlt der Eintrag; beim Start von Etappe 2 nachtragen
function e1Nachtrag(){
  if(story.reiseLog.some(e => e.etappe === 1) || story.etappe < 2) return;
  const w = story.e1weg === 'uboot' ? 'mit dem U-Boot' : story.e1weg === 'mars' ? 'mit dem Mars-Trip' : 'mit dem X-Wing';
  const t = story.e1weg === 'uboot' ? 4 : story.e1weg === 'mars' ? 7 : 1;
  story.reiseLog.unshift({ etappe: 1, ort: ORT[0], tage: t, wie: w });
}

// ---- Pro-Run-Freischaltung ----------------------------------------------------------------------------------------
story.proGeschafft = () => { try { return !!localStorage.getItem(PRO_KEY); } catch(e){ return false; } };
function proMerken(){ try { localStorage.setItem(PRO_KEY, String(Date.now())); } catch(e){} }

// ---- Abspann -------------------------------------------------------------------------------------------------------
let ab = null;
// rekord: undefined = keine Rekord-Spalte; '' = Spalte leer (damit der Wert trotzdem buendig steht); Text = in der Spalte.
// Live-Wunsch 19.10.2026: alle Zeiten rechtsbuendig untereinander, "Neuer Rekord!" rechts daneben (vorher hing er am Wert).
function zeile(k, v, gross, rekord){
  const st = gross ? 'font-size:22px;font-weight:700;margin-top:10px;' : '';
  if(rekord === undefined) return '<div style="display:flex;justify-content:space-between;gap:28px;' + st + '"><span style="opacity:.8">' + k + '</span><b>' + v + '</b></div>';
  return '<div style="display:grid;grid-template-columns:1fr auto ' + REKORD_B + 'px;gap:0 18px;align-items:baseline;' + st + '"><span style="opacity:.8">' + k
    + '</span><b style="text-align:right;font-variant-numeric:tabular-nums">' + v + '</b><span style="color:#ffd23f;font-weight:700;font-size:.9em">' + (rekord || '') + '</span></div>';
}
const REKORD_B = 130;   // px fuer "Neuer Rekord!"
// Sicherheitsnetz: fehlt eine Etappe im Log, nicht stillschweigend alle Resttage Etappe 6 zuschlagen (Live-Befund 14.10.: E2/E3
// fehlten, E6 hatte "3 Tage") – nur wenn genau Etappe 6 fehlt, bekommt sie den Rest
function e6Nachtrag(){
  if(story.reiseLog.some(e => e.etappe === 6)) return;
  const fehlt = [2, 3, 4, 5].filter(n => !story.reiseLog.some(e => e.etappe === n));
  const rest = story.tage - story.reiseLog.reduce((s, e) => s + e.tage, 0);
  if(fehlt.length){ for(const n of fehlt) story.reiseLog.push({ etappe: n, ort: ORT[n - 1], tage: 0, wie: '?' }); return; }
  if(rest > 0) story.reiseLog.push({ etappe: 6, ort: ORT[5], tage: rest, wie: rest === 1 ? 'mit dem Alpha Jet' : rest === 4 ? 'mit dem Shinkansen' : '' });
}
function abspannText(){
  e1Nachtrag(); e6Nachtrag();
  const L = story.reiseLog.slice().sort((a, b) => a.etappe - b.etappe);
  const tage = story.tage, stufe = story.finaleStufe ? story.finaleStufe() : 5;
  const stufenName = { 1: 'Pro-Run', 2: 'Fast perfekt', 3: 'Solide', 4: 'Lern-Run', 5: 'Das Versprechen' }[stufe];
  let h = '<div style="font-size:44px;font-weight:800;margin-bottom:6px">Reise nach Japan</div>'
    + '<div style="font-size:20px;opacity:.85;margin-bottom:40px">Samu hat es nach Fukuoka geschafft!</div>'
    + '<div style="font-size:24px;font-weight:700;margin-bottom:10px">Die Reise</div><div style="min-width:440px;text-align:left">';
  for(const e of L) h += zeile('Etappe ' + e.etappe + ' · ' + e.ort, e.wie === '?' ? '–' : (e.tage === 1 ? '1 Tag' : e.tage + ' Tage') + (e.wie ? ' <span style="font-weight:400;opacity:.75">(' + e.wie + ')</span>' : ''));
  h += zeile('Zusammen', tage + ' von 42 Tagen', true) + zeile('Finale', 'Stufe ' + stufe + ' – ' + stufenName, true) + '</div>';
  // Live-Wunsch 14.10.2026: alle Statistiken dieses Spiels (nur was gemacht wurde), Ueberschriften in Gold (statistik.js).
  // Die Reisezeit steht schon oben ("Zusammen"), die Trick-Zahl unten.
  const T = (story.finaleAb && story.finaleAb.tricks) || [];
  const st = story.statistikHtml ? story.statistikHtml('spiel', zeile, true) : '';   // ohne "Die Reise" (steht oben)
  if(st){
    h += '<div style="font-size:24px;font-weight:700;margin:50px 0 4px">Statistik</div><div style="min-width:360px;text-align:left">' + st;
    const nT = T.filter(t => t && t.s !== 'welle').length; if(nT) h += zeile('Zusammen', nT + (nT === 1 ? ' Trick' : ' Tricks'), true);
    h += '</div>';
  }
  h += '<div style="font-size:40px;font-weight:800;margin-top:90px;color:#ffd23f">Für Samu!</div>'
    + '<div style="font-size:30px;font-weight:700;margin-top:6px">Hab dich lieb!</div>'
    + '<div id="abspann-ende" style="height:1px"></div>';
  return h;
}
story.abspann = function(){
  if(ab) return;
  if(story.spielZiehen) story.spielZiehen();                // statistik.js: Reisezeit, Anzahl Spiele (einmal je Spiel)
  // Nur ein echtes Spiel ("Neues Spiel" aus dem Menue) schaltet frei – vorher reichte der Testzugang "Finale 1-3"
  // (springt mit 0 Tagen, also Stufe 1, direkt ins Finale) und "Ab zum Strand" stand ohne Durchspielen im Menue.
  if(story.echtesSpiel && story.finaleStufe && story.finaleStufe() === 1) proMerken();
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;z-index:28;pointer-events:none;overflow:hidden;color:#fff;font-family:system-ui,sans-serif;'
    + 'text-shadow:0 2px 6px rgba(0,0,0,.7);background:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.15) 40%,rgba(0,0,0,.35))';
  const roll = document.createElement('div');
  roll.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:100%;display:flex;flex-direction:column;align-items:center;text-align:center;';
  roll.innerHTML = abspannText();
  const sig = document.createElement('div');
  sig.style.cssText = 'position:absolute;right:18px;bottom:14px;font-size:15px;opacity:.85;font-weight:600';
  sig.textContent = 'by workFLOw ©2026';
  el.appendChild(roll); el.appendChild(sig); document.body.appendChild(el);
  const F = story.e6, mitte = { x: F.STRANDPLATZ.x - 120, z: F.STRANDPLATZ.z };
  ab = { el, roll, t: 0, h: 0, mitte, dauer: 0 };
  // Live-Wunsch 19.10.2026: das Menue sofort, wenn der Abspann durch ist – vorher rollten nach der Widmung noch 60 % Bildhoehe
  // Leerraum durch (gut 5 s nichts). Jetzt endet er, wenn die Widmung oben aus dem Bild ist: Rollhoehe + Bildhoehe, mehr nicht.
  ab.h = roll.offsetHeight; ab.dauer = story.abspannTestDauer || (innerHeight + ab.h) / 42;   // ~42 px/s (Testdauer fuer den Browser-Test)
  if(story.hudSichtbar) story.hudSichtbar(false);
  story.abspannLaeuft = true;
  // Eigene Uhr (Live-Befund 19.10.2026: "das Weiterspielen-Menue kam immer erst, wenn man 3 s X gedrueckt hat, nie
  // automatisch" – auf allen Wegen gleich). Vorher lief der Abspann nur in updateHUD; die Engine ruft das nicht, solange sie
  // steht (#hint/Pause, Inventar) – und was dort eine Ansage oder ein Menue offen hielt, hielt den Abspann mit an. Jetzt laeuft
  // er auf requestAnimationFrame, unabhaengig von der Bildschleife der Engine.
  let vor = performance.now();
  (function uhr(){
    if(!ab) return;
    const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - vor) / 1000); vor = jetzt;
    abspannSchritt(dt);
    if(ab) requestAnimationFrame(uhr);
  })();
};
function abspannSchritt(dt){
  if(!ab) return;
  ab.t += dt;
  ab.roll.style.top = (innerHeight - ab.t * 42) + 'px';
  if(ab.t > ab.dauer){ ab.el.remove(); ab = null; story.abspannLaeuft = false; if(story.hudSichtbar) story.hudSichtbar(true); nachDemAbspann(); }
}
// Live-Wunsch 14.10.2026: nach dem Abspann (jede Stufe) kurz fragen – ins Hauptmenue (Seite neu laden, die Statistik ist schon
// gespeichert) oder weiterspielen. Stick/Pfeile waehlen, A/Enter bestaetigt, B/Esc = weiterspielen.
function nachDemAbspann(){
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;inset:0;z-index:29;display:flex;flex-direction:column;align-items:center;justify-content:center;'
    + 'background:rgba(0,0,0,.45);color:#fff;font-family:system-ui,sans-serif;text-align:center;user-select:none';
  const OPT = [{ t: 'Weiterspielen' }, { t: 'Ins Hauptmenü', menue: true }];
  el.innerHTML = '<div style="font-size:30px;font-weight:700">Wie geht es weiter?</div>'
    + '<div style="display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:24px">'
    + OPT.map((o, i) => '<button data-i="' + i + '" style="min-width:240px;height:44px;border-radius:10px;border:2px solid rgba(255,255,255,.45);'
      + 'background:rgba(255,255,255,.1);color:#fff;font:600 18px system-ui;cursor:pointer;transition:all .12s">' + o.t + '</button>').join('') + '</div>'
    + '<div style="font-size:14px;margin-top:16px;opacity:.7">↑ ↓ wählen · A / Enter</div>';
  document.body.appendChild(el);
  const kn = [...el.querySelectorAll('button')]; let wahl = 0, fertig = false;
  story.abspannFrage = true;                                        // solange die Frage steht, keine Spielsteuerung
  const zeige = () => kn.forEach((b, i) => { const an = i === wahl; b.style.background = an ? '#ffd23f' : 'rgba(255,255,255,.1)'; b.style.color = an ? '#1a1a1a' : '#fff';
    b.style.borderColor = an ? '#ffd23f' : 'rgba(255,255,255,.45)'; b.style.transform = an ? 'scale(1.08)' : 'none'; });
  const ende = (i) => { if(fertig) return; fertig = true; window.removeEventListener('keydown', taste, true); el.remove(); story.abspannFrage = false;
    if(OPT[i].menue) location.reload(); };
  function taste(e){
    const c = e.code; if(!['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter', 'Space', 'NumpadEnter', 'Escape', 'KeyB'].includes(c)) return;
    e.preventDefault(); e.stopPropagation();
    if(c === 'ArrowUp' || c === 'KeyW' || c === 'ArrowDown' || c === 'KeyS'){ wahl = 1 - wahl; zeige(); }
    else if(c === 'Escape' || c === 'KeyB') ende(0); else ende(wahl);
  }
  window.addEventListener('keydown', taste, true);
  kn.forEach((b, i) => { b.addEventListener('pointerenter', () => { wahl = i; zeige(); }); b.addEventListener('pointerdown', (e) => { e.stopPropagation(); ende(i); }); });
  zeige();
  // Gamepad: Flanken (erst nach dem Loslassen zaehlen – sonst rutscht ein noch gedrueckter Knopf durch)
  let pA = true, pB = true, pV = true;
  (function pad(){
    if(fertig) return;
    for(const gp of (navigator.getGamepads ? navigator.getGamepads() : [])){
      if(!gp) continue;
      const y = gp.axes[1] || 0, a = !!(gp.buttons[0] && gp.buttons[0].pressed), b = !!(gp.buttons[1] && gp.buttons[1].pressed);
      const v = Math.abs(y) > 0.5 || !!(gp.buttons[12] && gp.buttons[12].pressed) || !!(gp.buttons[13] && gp.buttons[13].pressed);
      if(v && !pV){ wahl = 1 - wahl; zeige(); }
      if(a && !pA){ ende(wahl); return; }
      if(b && !pB){ ende(0); return; }
      pA = a; pB = b; pV = v; break;
    }
    requestAnimationFrame(pad);
  })();
}
// Kamerafahrt: langsamer Kreis ueber dem Strand, Blick zwischen Strand und Fuji
function abspannKamera(){
  if(!ab) return false;
  const F = story.e6, a = ab.t * 0.05, m = ab.mitte, r = 260;
  camera.up.set(0, 1, 0);
  camera.position.set(m.x + Math.cos(a) * r, 70 + Math.sin(ab.t * 0.13) * 15, m.z + Math.sin(a) * r);
  camera.lookAt(F.STRANDPLATZ.x * 0.7 + F.FUJI.x * 0.3, 60, F.STRANDPLATZ.z * 0.7 + F.FUJI.z * 0.3);
  return true;
}

// ---- Stufe 5: am Strand (kein Surfen), dann Abspann ------------------------------------------------------------------
const TEXT5 = ['Puh, das war knapp – nur noch ein Nachmittag!', 'Samu und sein Freund halten die Füße ins Meer und umarmen sich.', 'Nächstes Jahr machen wir den Pro-Run!'];
function stufe5(){
  if(story.stufe5Gezeigt) return; story.stufe5Gezeigt = true;
  story.spaeter(3, () => story.sprich(TEXT5, () => story.spaeter(1.5, () => story.abspann()), 'pilot'));
}

// ---- Hooks ---------------------------------------------------------------------------------------------------------
function hookAbspann(){
  const camOrig = updateCamera;
  updateCamera = function(){ if(abspannKamera()) return; return camOrig.apply(this, arguments); };
  const hudOrig = updateHUD;
  updateHUD = function(){
    const r = hudOrig.apply(this, arguments);
    // (der Abspann laeuft auf eigener Uhr, siehe story.abspann)
    e1Nachtrag();
    if(story.etappe === 6 && story.phase === 'ankunft' && story.finaleStufe && story.finaleStufe() >= 5 && eva) stufe5();
    return r;
  };
  // Waehrend Abspann und Frage: keine Spielsteuerung (A/B/Y kaemen sonst im Spiel an – huepfen, einsteigen)
  const gesperrt = () => !!(story.abspannLaeuft || story.abspannFrage);
  const yOrig = buttonY, bOrig = buttonB;
  buttonY = function(){ if(gesperrt()) return; return yOrig.apply(this, arguments); };
  buttonB = function(){ if(gesperrt()) return; return bOrig.apply(this, arguments); };
  const evaOrig = updateEva;
  updateEva = function(dt, inp){ return evaOrig.call(this, dt, gesperrt() ? {} : inp); };
  // Etappe 6 endet mit der Ankunft (Globus nach Fukuoka): eintragen
  if(story.e6ankunft){ const ankOrig = story.e6ankunft; story.e6ankunft = function(tage, wie){ loggen(6, tage, wie); return ankOrig.apply(this, arguments); }; }
}
const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hookAbspann(); };
})();
