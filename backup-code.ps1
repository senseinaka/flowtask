# backup-code.ps1 — Auto-backup del código fuente a GitHub
# Se puede ejecutar manualmente o programar con Task Scheduler

$projectPath = "C:\Projects\flowtask"
$logFile     = "$projectPath\backup-code.log"
$timestamp   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log($msg) {
    "$timestamp — $msg" | Out-File -FilePath $logFile -Append -Encoding UTF8
    Write-Host "$timestamp — $msg"
}

Set-Location $projectPath

# Verificar si hay cambios
$status = git status --porcelain 2>&1
if (-not $status) {
    Write-Log "Sin cambios — nada para respaldar."
    exit 0
}

Write-Log "Cambios detectados. Iniciando backup..."

# Stage + commit
$dateLabel = Get-Date -Format "yyyy-MM-dd HH:mm"
git add . 2>&1 | Out-Null
git commit -m "auto-backup: $dateLabel" 2>&1 | Out-Null

# Push
$pushResult = git push 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Log "Backup exitoso → github.com/senseinaka/flowtask"
} else {
    Write-Log "Error al hacer push: $pushResult"
}
