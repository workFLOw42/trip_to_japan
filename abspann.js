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
function zeile(k, v, gross){ return '<div style="display:flex;justify-content:space-between;gap:28px;' + (gross ? 'font-size:22px;font-weight:700;margin-top:10px' : '') + '"><span style="opacity:.8">' + k + '</span><b>' + v + '</b></div>'; }
function e6Nachtrag(){
  if(story.reiseLog.some(e => e.etappe === 6)) return;
  const rest = story.tage - story.reiseLog.reduce((s, e) => s + e.tage, 0);
  if(rest > 0) story.reiseLog.push({ etappe: 6, ort: ORT[5], tage: rest, wie: rest === 1 ? 'mit dem Alpha Jet' : rest === 4 ? 'mit dem Shinkansen' : '' });
}
function abspannText(){
  e1Nachtrag(); e6Nachtrag();
  const L = story.reiseLog.slice().sort((a, b) => a.etappe - b.etappe);
  const tage = story.tage, stufe = story.finaleStufe ? story.finaleStufe() : 5;
  const stufenName = { 1: 'Pro-Run', 2: 'Fast perfekt', 3: 'Solide', 4: 'Lern-Run', 5: 'Das Versprechen' }[stufe];
  let h = '<div style="font-size:44px;font-weight:800;margin-bottom:6px">Reise nach Japan</div>'
    + '<div style="font-size:20px;opacity:.85;margin-bottom:40px">Kenji hat es nach Fukuoka geschafft!</div>'
    + '<div style="font-size:24px;font-weight:700;margin-bottom:10px">Die Reise</div><div style="min-width:440px;text-align:left">';
  for(const e of L) h += zeile('Etappe ' + e.etappe + ' · ' + e.ort, (e.tage === 1 ? '1 Tag' : e.tage + ' Tage') + (e.wie ? ' <span style="font-weight:400;opacity:.75">(' + e.wie + ')</span>' : ''));
  h += zeile('Zusammen', tage + ' von 42 Tagen', true) + zeile('Finale', 'Stufe ' + stufe + ' – ' + stufenName, true) + '</div>';
  // Tricks je Name
  const T = (story.finaleAb && story.finaleAb.tricks) || [], n = {};
  for(const x of T) n[x] = (n[x] || 0) + 1;
  const liste = Object.entries(n).sort((a, b) => b[1] - a[1]);
  if(liste.length){
    h += '<div style="font-size:24px;font-weight:700;margin:50px 0 10px">Tricks</div><div style="min-width:320px;text-align:left">';
    for(const [k, v] of liste) h += zeile(k, v + '×');
    h += zeile('Zusammen', T.length + ' Tricks', true) + '</div>';
  }
  h += '<div style="font-size:40px;font-weight:800;margin-top:90px;color:#ffd23f">Für Samu!</div>'
    + '<div style="font-size:30px;font-weight:700;margin-top:6px">Hab dich lieb!</div>'
    + '<div style="height:60vh"></div>';
  return h;
}
story.abspann = function(){
  if(ab) return;
  if(story.finaleStufe && story.finaleStufe() === 1) proMerken();
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
  ab.h = roll.offsetHeight; ab.dauer = (innerHeight + ab.h) / 42;   // ~42 px/s
  if(story.hudSichtbar) story.hudSichtbar(false);
  story.abspannLaeuft = true;
};
function abspannSchritt(dt){
  if(!ab) return;
  ab.t += dt;
  ab.roll.style.top = (innerHeight - ab.t * 42) + 'px';
  if(ab.t > ab.dauer){ ab.el.remove(); ab = null; story.abspannLaeuft = false; if(story.hudSichtbar) story.hudSichtbar(true); }
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
const TEXT5 = ['Puh, das war knapp – nur noch ein Nachmittag!', 'Kenji und sein Freund halten die Füße ins Meer und umarmen sich.', 'Nächstes Jahr machen wir den Pro-Run!'];
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
    const jetzt = performance.now(), dt = Math.min(0.1, (jetzt - (hookAbspann.t || jetzt)) / 1000); hookAbspann.t = jetzt; abspannSchritt(dt);
    e1Nachtrag();
    if(story.etappe === 6 && story.phase === 'ankunft' && story.finaleStufe && story.finaleStufe() >= 5 && eva) stufe5();
    return r;
  };
  // Etappe 6 endet mit der Ankunft (Globus nach Fukuoka): eintragen
  if(story.e6ankunft){ const ankOrig = story.e6ankunft; story.e6ankunft = function(tage, wie){ loggen(6, tage, wie); return ankOrig.apply(this, arguments); }; }
}
const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hookAbspann(); };
})();
