# setup-auto-backup.ps1
# Ejecutar UNA SOLA VEZ como Administrador para programar el backup automático
# Corre el backup del código a las 11pm todos los días

$taskName   = "FlowTask - Backup Codigo GitHub"
$scriptPath = "C:\Projects\flowtask\backup-code.ps1"
$action     = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -File `"$scriptPath`""

# Todos los días a las 23:00
$trigger    = New-ScheduledTaskTrigger -Daily -At "23:00"

$settings   = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 5) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName $taskName `
    -Action   $action `
    -Trigger  $trigger `
    -Settings $settings `
    -RunLevel Highest `
    -Force

Write-Host ""
Write-Host "✓ Tarea programada: '$taskName'" -ForegroundColor Green
Write-Host "  Corre todos los dias a las 23:00" -ForegroundColor Cyan
Write-Host "  Backup en: github.com/senseinaka/flowtask" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para ejecutar manualmente ahora:" -ForegroundColor Yellow
Write-Host "  Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor White
