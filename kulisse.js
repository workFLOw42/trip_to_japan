// Meeres-Kulisse nach dem Abstand zum Strand (Wunsch 04.11.2026, wie im Flugspiel inselwelt.js): ersetzt updateAmbient der Engine.
// Laedt nach story.js, vor allen Spieldateien: ihre Huellen (Hoehle, Kinderzimmer, Wueste, Etappen ...) legen sich darum, weil sie
// ihren Vorgaenger in STORY_HOOK zuerst aufrufen.
//   Wasser: Moewen klingen nach so viel Wasser ab, wie die Insel vom Strand bis zur Mitte misst ("die Moewen sind rund um die Inseln");
//           Wellen draussen laut, am Ufer ein Drittel (wie bisher).
//   Land:   Wellen laufen bis KUL_WELLE m hinter der Strandkante aus (Inselmitte: keine Wellen), Moewen sinken bis KUL_MOEWE m auf
//           KUL_MOEWE_REST, in einer Wolkenkratzerstadt auf KUL_MOEWE_STADT.
//   Still:  im Zug (story.zugFahrt), unter Wasser, Ton aus, ueber AMB_MAX_Y (Engine).
(function(){
'use strict';
const story = window.STORY;
const KUL_WELLE = 70, KUL_MOEWE = 140, KUL_MOEWE_REST = 0.25, KUL_MOEWE_STADT = 0.08;
const glatt = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const stadtCache = new Map();
function istStadt(cx, cz){                                   // Wolkenkratzerstadt: die Insel hat Tuerme
  const k = cx + ',' + cz;
  if(!stadtCache.has(k)){ const L = typeof islandBuildings === 'function' ? islandBuildings(cx, cz) || [] : [];   // global-ok: Engine
    stadtCache.set(k, L.some(b => b.type === 'tower')); }
  return stadtCache.get(k);
}
function hook(){
  const STRAND = typeof BEACH_FACTOR !== 'undefined' ? BEACH_FACTOR : 1.12;                                     // global-ok: Engine
  updateAmbient = function(dt){                                                                                  // global-ok: Engine
    if(!audioCtx || audioCtx.state !== 'running' || !window.FMS_AMB) return;
    if(!ambStarted){                                                                                             // global-ok: Engine
      ambStarted = true;                                                                                         // global-ok: Engine
      ambStart(window.FMS_AMB.gulls, (q, g) => { ambGullSrc = q; ambGullGain = g; });                           // global-ok: Engine
      ambStart(window.FMS_AMB.ocean, (q, g) => { ambOceanSrc = q; ambOceanGain = g; });                         // global-ok: Engine
    }
    if(!ambGullGain || !ambOceanGain) return;
    let gull = 0, ocean = 0;
    const imZug = !!(story && story.zugFahrt && story.zugFahrt());
    if(soundOn && locale === 'earth' && uwCamBlend < 0.3 && !imZug){
      const F = worldFocus(), y = eva ? eva.group.position.y : state.pos.y;
      if(y < AMB_MAX_Y){
        const hoehe = 1 - Math.max(0, Math.min(1, y / AMB_MAX_Y));
        let nah = 1e9, rand = 1, stadt = false;                // Abstand zur Strandkante (innen negativ), Strandradius
        const pcx = Math.round(F.x / CELL), pcz = Math.round(F.z / CELL);
        for(let dz = -1; dz <= 1; dz++) for(let dx = -1; dx <= 1; dx++){
          const info = islandInfo(pcx + dx, pcz + dz); if(!info) continue;
          const d = Math.hypot(F.x - info.wx, F.z - info.wz) - info.radius * STRAND;
          if(d < nah){ nah = d; rand = info.radius * STRAND; stadt = istStadt(pcx + dx, pcz + dz); }
        }
        if(nah >= 0){                                          // auf dem Wasser
          const gRoh = 1 - Math.max(0, Math.min(1, nah / AMB_GULL_R));
          gull = (1 - glatt(nah / rand)) * AMB_GULL_VOL * hoehe;
          ocean = (0.33 + 0.67 * (1 - gRoh)) * AMB_MEER_VOL * hoehe;
        } else {                                               // an Land: nach innen leiser
          const innen = -nah, rest = stadt ? KUL_MOEWE_STADT : KUL_MOEWE_REST;
          gull = (1 - (1 - rest) * glatt(innen / KUL_MOEWE)) * AMB_GULL_VOL * hoehe;
          ocean = 0.33 * (1 - glatt(innen / KUL_WELLE)) * AMB_MEER_VOL * hoehe;
        }
      }
    }
    const k = Math.min(1, AMB_RATE * dt);
    ambGullGain.gain.value += (gull - ambGullGain.gain.value) * k;
    ambOceanGain.gain.value += (ocean - ambOceanGain.gain.value) * k;
  };
}
const hookVorher = window.STORY_HOOK;
window.STORY_HOOK = function(){ if(hookVorher) hookVorher(); hook(); };
})();
