# Baut die Engine aus dem Flugspiel-Repo nach engine/ und erzeugt index.html.
# Aufruf aus dem Projektordner:  powershell -File tools/build_engine.ps1
# Die Engine bleibt UNVERAENDERT – die Spiellogik haengt sich in story.js per Wrapper ein.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path (Split-Path -Parent $root) 'Flugspiel'
$dst  = Join-Path $root 'engine'
$utf8 = New-Object Text.UTF8Encoding $false
New-Item -ItemType Directory -Force $dst | Out-Null

$html  = [IO.File]::ReadAllText((Join-Path $src 'Flugspiel.html'), $utf8)
$lines = $html -split "`r?`n"

# Der grosse Inline-Script-Block (der erste <script> ohne src) = die Engine
$start = -1; $end = -1
for($i = 0; $i -lt $lines.Count; $i++){
  if($start -lt 0 -and $lines[$i].Trim() -eq '<script>'){ $start = $i; continue }
  if($start -ge 0 -and $lines[$i].Trim() -eq '</script>'){ $end = $i; break }
}
if($start -lt 0 -or $end -lt 0){ throw 'Engine-Script-Block nicht gefunden' }
# Story-Hooks in den Boot-Block (Ende der Engine) einfuegen:
#   STORY_HOOK  – vor updateIslands(): Wrapper setzen, bevor Inseln/Startplatz berechnet werden
#   STORY_START – vor dem ersten requestAnimationFrame(loop): Startplatz/Blende der Story setzen
$body = $lines[($start+1)..($end-1)]
$iIsl = -1; $iRaf = -1
for($i = $body.Count-1; $i -ge 0; $i--){
  if($iRaf -lt 0 -and $body[$i] -eq 'requestAnimationFrame(loop);'){ $iRaf = $i }
  if($iIsl -lt 0 -and $body[$i] -eq 'updateIslands();'){ $iIsl = $i }
}
if($iIsl -lt 0 -or $iRaf -lt 0 -or $iIsl -gt $iRaf){ throw 'Boot-Block nicht gefunden' }
$body = @($body[0..($iIsl-1)]) + 'if(window.STORY_HOOK) STORY_HOOK();' + @($body[$iIsl..($iRaf-1)]) +
        'if(window.STORY_START) STORY_START();' + @($body[$iRaf..($body.Count-1)])
$engine = "// AUTOMATISCH ERZEUGT aus ../Flugspiel/Flugspiel.html (tools/build_engine.ps1) – nicht von Hand aendern`n" +
          ($body -join "`n") + "`n"
[IO.File]::WriteAllText((Join-Path $dst 'engine.js'), $engine, $utf8)

# Kopf + HUD-Markup (alles vor dem Engine-Block), Script-Pfade auf engine/ umbiegen
$head = @()
$assets = @()
foreach($ln in $lines[0..($start-1)]){
  if($ln -match '<script src="([^"]+)"></script>'){ $assets += $Matches[1]; $head += ($ln -replace 'src="', 'src="engine/'); continue }
  $ln = $ln -replace '<title>Flugspiel</title>', '<title>Reise nach Japan</title>'
  $ln = $ln -replace 'content="Flugspiel"', 'content="Reise nach Japan"'
  $head += $ln
}
foreach($a in $assets){ Copy-Item -Force (Join-Path $src $a) (Join-Path $dst $a) }

# Kenji als eingebettetes GLB (wie die Flugspiel-Modelle)
$kb = [IO.File]::ReadAllBytes((Join-Path $root 'models\kenji.glb'))
[IO.File]::WriteAllText((Join-Path $root 'kenji_glb.js'),
  'window.KENJI_GLB = "data:model/gltf-binary;base64,' + [Convert]::ToBase64String($kb) + '";' + "`n", $utf8)

$out = ($head -join "`n") + "`n" +
  '<script src="kenji_glb.js"></script>' + "`n" +
  '<script src="story.js"></script>' + "`n" +
  '<script src="wueste_snd.js"></script>' + "`n" +
  '<script src="etappe2.js"></script>' + "`n" +
  '<script src="etappe3.js"></script>' + "`n" +
  '<script src="hafen_glb.js"></script>' + "`n" +
  '<script src="etappe4.js"></script>' + "`n" +
  '<script src="flucht_glb.js"></script>' + "`n" +
  '<script src="etappe4b.js"></script>' + "`n" +
  '<script src="engine/engine.js"></script>' + "`n" +
  "</body>`n</html>`n"
[IO.File]::WriteAllText((Join-Path $root 'index.html'), $out, $utf8)
"engine.js: $([math]::Round($engine.Length/1KB)) KB, $($assets.Count) Assets kopiert, index.html erzeugt"