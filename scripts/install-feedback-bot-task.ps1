<#
.SYNOPSIS
  Installs the Windows scheduled task that runs the Mirocard feedback bot.

.DESCRIPTION
  Registers "MirocardFeedbackBot" as an always-running task (starts at boot,
  restarts on crash, no execution time limit) - independent of the
  MirocardBackend2 task and of the Kaplieva_bot process. Run this once,
  directly on the runtime host, after feedback-bot/ has been deployed there.
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\Users\dmazn\Projects\Mirocard2",
  [string]$PythonExe = "python",
  [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$botScript = Join-Path $ProjectRoot 'feedback-bot\mirocard_feedback_bot.py'
if (-not (Test-Path -LiteralPath $botScript -PathType Leaf)) { throw "Missing script: $botScript" }

$taskName = 'MirocardFeedbackBot'
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
  throw "Scheduled task already exists: $taskName. Re-run with -Force to replace it."
}
if ($existing -and $Force) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Task Scheduler launches actions via CreateProcess, which does not resolve
# the Microsoft Store Python's App Execution Alias (WindowsApps\python.exe is
# a reparse-point stub that only activates for shell-resolved launches).
# Routing through cmd.exe /c mirrors how an interactive/SSH shell resolves
# "python" on PATH, which does work.
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $PythonExe `"$botScript`"" -WorkingDirectory (Split-Path $botScript -Parent)
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
# S4U (not Interactive): survives logoff/disconnect and runs without an active
# session. An Interactive-logon task silently stops firing once the session
# that started it ends and never recovers until someone logs back in and
# restarts it by hand - this is what caused the bot to sit dead 2026-07-17
# through 2026-07-27 (see feedback-bot outage in project memory).
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType S4U -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Mirocard testers-group feedback bot (persistent)' | Out-Null

Write-Host "Registered task: $taskName"
Write-Host "Start it now with:"
Write-Host "  Start-ScheduledTask -TaskName `"$taskName`""
