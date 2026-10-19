// Trip to Japan – Statistiken (Live-Wunsch 14.10.2026). Laedt nach abspann.js, vor der Engine.
//   Gesamt (localStorage, alle bisherigen Spiele): Spiele, kuerzeste/laengste Reisezeit, Reisen zum Mond/Mars, Monsterwellen
//   (15/20/30 m), alle Tricks je Sportart; die Bestzeiten (Startsequenz, mit Kurzschluss, Frachtverladung, Loeschaktion,
//   Schnellbootfahrt) im bestehenden Highscore-Speicher (story.neueZeit).
//   Dieses Spiel (story.spielStat): dieselben Werte, fuer den Abspann.
//   Gezaehlt wird nur ein echtes Spiel ("Neues Spiel", "Ab zum Strand") – Testzugaenge verfaelschen sonst die Rekorde.
//   Angezeigt wird nur, was es schon gibt (nichts verraten, was man noch nicht gespielt hat).
(function(){
'use strict';
const story = window.STORY;
const KEY = 'reise-nach-japan-statistik';
function laden(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }
function sichern(s){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch(e){} }
story.statistikGesamt = laden;

// ---- dieses Spiel -----------------------------------------------------------------------------------------------
const spiel = story.spielStat = { zeiten: {}, mond: 0, mars: 0, monster: {}, gezogen: false };
const echt = () => !!story.echtesSpiel;                        // story.js setzt es beim Start aus dem Menue
// Bestzeiten: dieses Spiel immer merken, den Rekord nur in einem echten Spiel schreiben
const zeitOrig = story.neueZeit;
story.neueZeit = function(name, s){
  const besser = spiel.zeiten[name] === undefined || s < spiel.zeiten[name];
  if(besser) spiel.zeiten[name] = Math.round(s * 100) / 100;
  if(!echt()) return false;
  const neu = zeitOrig.apply(this, arguments);
  // "Neuer Rekord!" gehoert zur Bestzeit dieses Spiels: nur setzen, wenn genau sie gespeichert wurde
  if(besser) (spiel.rekorde = spiel.rekorde || {})[name] = neu;
  return neu;
};
// Etappen-Enden: Kran (Fracht), Feuerwehrboot (Loeschen), Schnellboot, Mond-/Mars-Trip
function etappeErfasst(wie){
  if(wie === 'mit dem Kran' && story.kran4) story.neueZeit('fracht', story.kran4.t);
  else if(wie === 'mit dem Feuerwehrboot' && story.boot3) story.neueZeit('loeschen', story.boot3.t);
  else if(wie === 'mit dem Schnellboot' && story.flucht) story.neueZeit('schnellboot', story.flucht.t);
  else if(wie === 'U-Boot-Schlucht' && story.schlucht) story.neueZeit('schlucht', story.schlucht.t);   // Live-Wunsch 19.10.2026
  else if(/^mit dem (Mond|Mars)-Trip$/.test(wie || '')){ const z = /Mond/.test(wie) ? 'mond' : 'mars'; spiel[z]++;
    if(echt()){ const g = laden(); g[z] = (g[z] || 0) + 1; sichern(g); } }
}
// Monsterwellen und Tricks: gleich beim Entstehen gesamt zaehlen (im freien Spiel gibt es keinen Abspann)
function trickErfasst(t){
  if(!t || !echt()) return;
  const g = laden(); g.tricks = g.tricks || {}; const s = g.tricks[t.s] = g.tricks[t.s] || {}; s[t.n] = (s[t.n] || 0) + 1; sichern(g);
}
// Monsterwelle geritten (15/20/30 m): finale.js ruft story.welleGeritten(H)
story.welleGeritten = function(H){
  const k = H >= 30 ? 30 : H >= 20 ? 20 : 15; spiel.monster[k] = (spiel.monster[k] || 0) + 1;
  if(echt()){ const g = laden(); g.monster = g.monster || {}; g.monster[k] = (g.monster[k] || 0) + 1; sichern(g); }
};
// Spielende (Abspann bzw. Stufe 5): Reisezeit und Anzahl Spiele, einmal je Spiel
story.spielZiehen = function(){
  if(spiel.gezogen || !echt() || story.freiesSpiel) return; spiel.gezogen = true;
  const g = laden(), t = story.tage;
  g.spiele = (g.spiele || 0) + 1;
  if(g.kuerzeste === undefined || t < g.kuerzeste){ g.kuerzeste = t; spiel.rekordKurz = g.spiele > 1; }
  if(g.laengste === undefined || t > g.laengste) g.laengste = t;
  sichern(g);
};

// ---- Anzeige ------------------------------------------------------------------------------------------------------
const GOLD = '#ffd23f';
const ZEITNAME = [['startsequenz', 'Schnellste Startsequenz'], ['startsequenzKurzschluss', 'Schnellste Startsequenz mit Kurzschluss'],
  ['fracht', 'Schnellste Frachtverladung'], ['loeschen', 'Schnellste Löschaktion'], ['schnellboot', 'Schnellste Schnellbootfahrt'],
  ['schlucht', 'Schnellste U-Boot-Fahrt durch die Schlucht'], ['airrace', 'Schnellstes Air Race']];
// "Neuer Rekord!" steht in einer eigenen Spalte rechts neben dem Wert (Live-Wunsch 19.10.2026: alle Zeiten rechtsbuendig
// untereinander, der Rekord daneben). Werte mit Rekord sind deshalb [Text, true]; zeile() bekommt das als drittes Feld.
const REKORD = 'Neuer Rekord!';
const SPORT = [['fall', 'Fallschirmspringen'], ['snow', 'Snowboarden'], ['surf', 'Surfen']];
function sek(s){ return s < 60 ? s.toFixed(2).replace('.', ',') + ' s' : Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') + ' min'; }
function tage(t){ return t === 1 ? '1 Tag' : t + ' Tage'; }
// Bloecke: [[Ueberschrift, [[Name, Wert], ...]], ...] – leere Bloecke fallen weg
function bloecke(d){
  const B = [];
  const reise = []; if(d.spiele) reise.push(['Reisen nach Japan', String(d.spiele)]);
  if(d.kuerzeste !== undefined) reise.push([d.einSpiel ? 'Reisezeit' : 'Kürzeste Reisezeit', tage(d.kuerzeste), !!d.rekordKurz]);
  if(d.laengste !== undefined && !d.einSpiel) reise.push(['Längste Reisezeit', tage(d.laengste)]);
  if(d.mond) reise.push(['Reisen zum Mond', String(d.mond)]);
  if(d.mars) reise.push(['Reisen zum Mars', String(d.mars)]);
  if(reise.length) B.push(['Die Reise', reise]);
  const z = []; for(const [k, n] of ZEITNAME) if(d.zeiten && d.zeiten[k] !== undefined) z.push([d.einSpiel ? n.replace('Schnellste ', '').replace('Schnellstes ', '') : n, sek(d.zeiten[k]), !!(d.rekorde && d.rekorde[k])]);
  if(z.length) B.push([d.einSpiel ? 'Zeiten' : 'Bestzeiten', z.map(([a, b, r]) => [a.charAt(0).toUpperCase() + a.slice(1), b, r])]);
  const w = []; for(const h of [15, 20, 30]) if(d.monster && d.monster[h]) w.push([h + '-m-Welle geritten', d.monster[h] + '×']);
  if(w.length) B.push(['Monsterwellen', w]);
  for(const [s, titel] of SPORT){ const t = d.tricks && d.tricks[s]; if(!t) continue;
    const k = Object.keys(t).sort((a, b) => a.localeCompare(b, 'de', { numeric: true })); if(k.length) B.push([titel, k.map(x => [x, t[x] + '×'])]); }
  return B;
}
function gesamtDaten(){ const g = laden(); g.zeiten = story.highscores ? story.highscores() : {}; return g; }
// Daten dieses Spiels (Tricks aus finale.js, ohne die Monsterwellen – die stehen extra)
function spielDaten(){
  const T = (story.finaleAb && story.finaleAb.tricks) || [], tr = {};
  for(const t of T){ if(!t || t.s === 'welle') continue; const s = tr[t.s] = tr[t.s] || {}; s[t.n] = (s[t.n] || 0) + 1; }
  return { einSpiel: true, kuerzeste: story.tage, rekordKurz: spiel.rekordKurz, mond: spiel.mond, mars: spiel.mars, zeiten: spiel.zeiten, rekorde: spiel.rekorde, monster: spiel.monster, tricks: tr };
}
story.statistikBloecke = (welche) => bloecke(welche === 'spiel' ? spielDaten() : gesamtDaten());
// HTML fuer Abspann und Statistik-Seite: Ueberschriften in Gold
story.statistikHtml = function(welche, zeile, ohneReise){
  const B = story.statistikBloecke(welche).filter(b => !(ohneReise && b[0] === 'Die Reise')); if(!B.length) return '';
  let h = '';
  for(const [titel, liste] of B){
    h += '<div style="font-size:21px;font-weight:700;margin:22px 0 6px;color:' + GOLD + '">' + titel + '</div>';
    // Rekord-Spalte nur in Bloecken, die einen Rekord haben koennen (Zeiten, Reise) – dort fuer ALLE Zeilen, damit die Werte
    // rechtsbuendig untereinander stehen (auch die ohne Rekord)
    const spalte = liste.some(z => z.length > 2);
    for(const [k, v, r] of liste) h += zeile(k, v, false, spalte ? (r ? REKORD : '') : undefined);
  }
  return h;
};

// ---- Hooks ---------------------------------------------------------------------------------------------------------
function hookStatistik(){
  const endeOrig = story.etappeEnde;
  story.etappeEnde = function(tage, wie){ try { etappeErfasst(wie); } catch(e){ console.warn('Statistik', e); } return endeOrig.apply(this, arguments); };
  const trOrig = story.trickZaehlen;
  story.trickZaehlen = function(t){ try { trickErfasst(t); } catch(e){} if(trOrig) return trOrig.apply(this, arguments); };
}
const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hookStatistik(); };
})();
