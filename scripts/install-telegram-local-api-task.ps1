<#
.SYNOPSIS
  Installs the Windows scheduled task that runs the local Telegram Bot API
  server (telegram-bot-api.exe), used so mirocard_feedback_bot.py can
  download videos over 20 MB (see docs/feedback-bot-setup.md, "Video
  ingestion").

.DESCRIPTION
  Registers "TelegramLocalBotApi" as an always-running task (starts at boot,
  restarts on crash, no execution time limit), independent of
  MirocardFeedbackBot. Run this once, directly on the runtime host, after
  downloading telegram-bot-api.exe and obtaining api_id/api_hash from
  https://my.telegram.org/apps.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ApiId,
  [Parameter(Mandatory = $true)][string]$ApiHash,
  [string]$ExePath = "C:\Users\dmazn\Projects\Mirocard2\telegram-bot-api\telegram-bot-api.exe",
  [string]$DataDir = "C:\Users\dmazn\Projects\Mirocard2\telegram-bot-api\data",
  [int]$HttpPort = 8081,
  [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) { throw "Missing executable: $ExePath" }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$taskName = 'TelegramLocalBotApi'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
  throw "Scheduled task already exists: $taskName. Re-run with -Force to replace it."
}
if ($existing -and $Force) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$exeArgs = "--api-id=$ApiId --api-hash=$ApiHash --http-port=$HttpPort --dir=`"$DataDir`""
$action = New-ScheduledTaskAction -Execute $ExePath -Argument $exeArgs -WorkingDirectory (Split-Path $ExePath -Parent)
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
# S4U, matching MirocardFeedbackBot's task: survives logoff/disconnect and
# runs without an active session (see install-feedback-bot-task.ps1 for why
# Interactive logon silently stops working after the starting session ends).
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Local Telegram Bot API server (persistent) — used for video downloads > 20 MB' | Out-Null

Write-Host "Registered task: $taskName"
Write-Host "Start it now with:"
Write-Host "  Start-ScheduledTask -TaskName `"$taskName`""
Write-Host "Then set TELEGRAM_LOCAL_API_URL=http://127.0.0.1:$HttpPort in feedback-bot/.env and restart MirocardFeedbackBot."
