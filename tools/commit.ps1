# Commit mit automatisch hochgezaehlter PWA-Cache-Version (sw.js).
# Aufruf:  powershell -File tools/commit.ps1 "Commit-Nachricht"
#      oder powershell -File tools/commit.ps1 -Datei nachricht.txt   (mehrzeilig)
# Zaehlt nur hoch, wenn sich eine gecachte Datei (nicht Doku/Tools/Modelle) aendert.
param([string]$Nachricht, [string]$Datei)
if(-not $Nachricht -and -not $Datei){ throw 'Nachricht oder -Datei angeben' }
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
git add -A
$staged = git diff --cached --name-only
if(-not $staged){ 'Nichts zu committen.'; exit 0 }
$relevant = $staged | Where-Object { $_ -notmatch '^(README\.md|Konzept\.md|\.gitignore|\.nojekyll|sw\.js|tools/.*|models/.*)$' }
if($relevant){
  $sw = Join-Path $root 'sw.js'
  $utf8 = New-Object Text.UTF8Encoding $false
  $t = [IO.File]::ReadAllText($sw, $utf8)
  $headT = (git show HEAD:sw.js) -join "`n"
  $alt = [int]([regex]::Match($headT, 'reise-nach-japan-v(\d+)').Groups[1].Value)
  $neu = $alt + 1
  $t = [regex]::Replace($t, 'reise-nach-japan-v\d+', "reise-nach-japan-v$neu")
  [IO.File]::WriteAllText($sw, $t, $utf8)
  git add sw.js
  "PWA-Cache: v$alt -> v$neu"
}
if($Datei){ git commit -q -F $Datei } else { git commit -q -m $Nachricht }
git log --oneline -1