# =========================================================
#  MediConnect · iniciar-n8n.ps1
#  Levanta un n8n SOLO para MediConnect.
#
#  Usa su propia carpeta de datos ($HOME\mediconnect-n8n), así que
#  no toca ningún otro n8n que ya tengas ni sus credenciales.
#
#  Uso:
#    powershell -ExecutionPolicy Bypass -File .\herramientas\iniciar-n8n.ps1
#
#  Para detenerlo: Ctrl + C en esta ventana.
# =========================================================

$env:N8N_USER_FOLDER              = "$HOME\mediconnect-n8n"
$env:N8N_PORT                     = "5678"
$env:GENERIC_TIMEZONE             = "America/El_Salvador"
$env:TZ                           = "America/El_Salvador"
$env:N8N_DIAGNOSTICS_ENABLED      = "false"
$env:N8N_VERSION_NOTIFICATIONS_ENABLED = "false"

New-Item -ItemType Directory -Force -Path $env:N8N_USER_FOLDER | Out-Null

Write-Host ""
Write-Host "  MediConnect · n8n" -ForegroundColor Blue
Write-Host "  Carpeta de datos : $($env:N8N_USER_FOLDER)"
Write-Host "  Editor           : http://localhost:5678"
Write-Host "  Base del webhook : http://localhost:5678/webhook"
Write-Host ""
Write-Host "  Para que la app lo alcance desde un telefono, en OTRA ventana:" -ForegroundColor DarkGray
Write-Host "    cloudflared tunnel --url http://localhost:5678" -ForegroundColor DarkGray
Write-Host ""

n8n start
