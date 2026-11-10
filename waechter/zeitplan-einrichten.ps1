# Richtet den Claude-Wächter als tägliche Windows-Aufgabe ein (Standard 06:00).
# Einmal ausführen:  powershell -ExecutionPolicy Bypass -File waechter\zeitplan-einrichten.ps1
# Entfernen:         Unregister-ScheduledTask -TaskName "Website-Waechter" -Confirm:$false
param([string]$Uhrzeit = "06:00")

$Skript = Join-Path $PSScriptRoot "waechter.ps1"
$Aktion = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Skript`"" `
  -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$Ausloeser = New-ScheduledTaskTrigger -Daily -At $Uhrzeit
# StartWhenAvailable: Lief der Laptop um die Uhrzeit nicht, holt Windows den Lauf nach.
$Einstellungen = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

Register-ScheduledTask -TaskName "Website-Waechter" -Action $Aktion -Trigger $Ausloeser `
  -Settings $Einstellungen -Description "Prüft die Website täglich und meldet Probleme per ntfy." -Force | Out-Null
Write-Host "Aufgabe 'Website-Waechter' eingerichtet: täglich um $Uhrzeit."
