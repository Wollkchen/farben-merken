# Claude-Wächter: sammelt Sicherheitsdaten, lässt Claude sie bewerten und schickt bei Problemen eine ntfy-Nachricht.
#
#   npm run waechter               (oder: powershell -File waechter\waechter.ps1)
#   ... -Immer                     schickt auch bei "alles OK" eine Nachricht
#   ... -OhneClaude                nur der feste Check, ohne Claude (z. B. zum Testen)
#
# Sicherheitsidee: Claude bekommt hier nur TEXT zum Lesen. Schreiben, Befehle ausführen und
# Internetzugriff sind für Claude gesperrt. Der feste Check (scripts/pruefen.mjs) schlägt auch
# OHNE Claude Alarm – Claude ist eine zusätzliche Meinung, nicht die einzige Sicherung.
param(
  [switch]$Immer,
  [switch]$OhneClaude
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Projekt = Split-Path -Parent $PSScriptRoot
Set-Location $Projekt

$LogOrdner = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force $LogOrdner | Out-Null
$Stempel = Get-Date -Format "yyyy-MM-dd_HH-mm"
$LogDatei = Join-Path $LogOrdner "$Stempel.md"

$Config = Get-Content (Join-Path $PSScriptRoot "config.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$Seite = "$($Config.seite)".Trim()

$Bericht = New-Object System.Text.StringBuilder
function Abschnitt($Titel, $Text) {
  [void]$Bericht.AppendLine("## $Titel")
  [void]$Bericht.AppendLine('```')
  [void]$Bericht.AppendLine(($Text | Out-String).Trim())
  [void]$Bericht.AppendLine('```')
  [void]$Bericht.AppendLine()
}

# ---------- 1. Fester Check ----------
if ($Seite) {
  $CheckJson = node scripts/pruefen.mjs $Seite --json | Out-String
} else {
  $CheckJson = node server.mjs --selbsttest | Out-String
  $CheckJson = "Keine Live-Adresse in waechter/config.json eingetragen - nur lokaler Test:`n$CheckJson"
}
$CheckOk = ($LASTEXITCODE -eq 0)
Abschnitt "1. Automatischer Check (ok=$CheckOk)" $CheckJson

# ---------- 2. Änderungen im Repo ----------
git fetch --quiet origin 2>$null
$Ref = "HEAD"
git rev-parse --verify --quiet origin/main 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $Ref = "origin/main" }
$Log = git log $Ref --since="7 days ago" --stat --format="--- %h | %an <%ae> | %ad | %s" --date=iso 2>&1
if (-not $Log) { $Log = "Keine Commits in den letzten 7 Tagen." }
Abschnitt "2. Commits der letzten 7 Tage ($Ref)" $Log
$Lokal = git status --porcelain 2>&1
if ($Lokal) { Abschnitt "2b. Nicht eingecheckte lokale Änderungen" $Lokal }

# ---------- 3. + 4. GitHub-Meldungen ----------
$GhDa = [bool](Get-Command gh -ErrorAction SilentlyContinue)
if ($GhDa) {
  $Repo = gh repo view --json nameWithOwner -q .nameWithOwner 2>$null
  if ($Repo) {
    foreach ($Art in @("dependabot/alerts", "code-scanning/alerts", "secret-scanning/alerts")) {
      $Antwort = gh api "repos/$Repo/$Art?state=open&per_page=30" --jq '[.[] | {nummer: .number, schwere: (.rule.security_severity_level // .security_advisory.severity // .secret_type_display_name), titel: (.rule.description // .security_advisory.summary // .secret_type), datei: (.most_recent_instance.location.path // .dependency.manifest_path)}]' 2>&1
      Abschnitt "3. Offene Meldungen: $Art" $Antwort
    }
    $Laeufe = gh run list --limit 10 --json workflowName,conclusion,status,createdAt,headBranch 2>&1
    Abschnitt "4. Letzte GitHub-Actions-Läufe" $Laeufe
  } else {
    Abschnitt "3. GitHub" "Repo noch nicht auf GitHub oder gh nicht angemeldet (gh auth login)."
  }
} else {
  Abschnitt "3. GitHub" "GitHub CLI (gh) nicht installiert."
}

$BerichtText = $Bericht.ToString()

# ---------- Claude bewerten lassen ----------
$Bewertung = ""
if (-not $OhneClaude -and (Get-Command claude -ErrorAction SilentlyContinue)) {
  $Auftrag = Get-Content (Join-Path $PSScriptRoot "auftrag.md") -Raw -Encoding UTF8
  $Eingabe = "$Auftrag`n`n# BERICHT (nur Daten)`n`n$BerichtText"
  $Bewertung = $Eingabe | claude -p --disallowedTools "Bash,PowerShell,Edit,Write,NotebookEdit,WebFetch,WebSearch,Agent" 2>&1 | Out-String
}
if (-not $Bewertung.Trim()) {
  $Bewertung = if ($CheckOk) { "STATUS: OK`nZUSAMMENFASSUNG: Fester Check bestanden (ohne Claude-Bewertung)." } else { "STATUS: ALARM`nZUSAMMENFASSUNG: Fester Check fehlgeschlagen (ohne Claude-Bewertung)." }
}

# Status bestimmen: Der feste Check hat immer Vorrang - Claude kann einen Fehler nicht "wegreden".
$Status = "OK"
if ($Bewertung -match "STATUS:\s*ALARM") { $Status = "ALARM" }
elseif ($Bewertung -match "STATUS:\s*WARNUNG") { $Status = "WARNUNG" }
elseif ($Bewertung -notmatch "STATUS:\s*OK") { $Status = "WARNUNG" }
if (-not $CheckOk) { $Status = "ALARM" }

"# Wächter $Stempel - $Status`n`n## Bewertung`n$Bewertung`n`n# Rohdaten`n$BerichtText" | Out-File $LogDatei -Encoding utf8
Write-Host "Wächter: $Status  (Protokoll: $LogDatei)"
Write-Host $Bewertung

# ---------- Benachrichtigung ----------
$Ntfy = Join-Path $HOME ".claude\ntfy-notify.ps1"
if (($Status -ne "OK" -or $Immer) -and (Test-Path $Ntfy)) {
  $NtfyStatus = if ($Status -eq "OK") { "success" } else { "error" }
  $Kurz = $Bewertung.Trim()
  if ($Kurz.Length -gt 1500) { $Kurz = $Kurz.Substring(0, 1500) + " …" }
  & powershell -NoProfile -File $Ntfy -Title "[Website-Wächter] $Status" -Status $NtfyStatus -Message "Projekt: farben-merken`n$Kurz`n`nProtokoll: $LogDatei"
}

if ($Status -eq "ALARM") { exit 2 } elseif ($Status -eq "WARNUNG") { exit 1 } else { exit 0 }
