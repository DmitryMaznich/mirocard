<#
.SYNOPSIS
  Installs Windows scheduled tasks for Mirocard backups to Synology.

.DESCRIPTION
  Creates two tasks under the current Windows user:
    - Mirocard Project Backup: daily full recovery package.
    - Mirocard DB Hourly Backup: hourly SQLite backup.

  Run this from a normal PowerShell session as the Windows user that can access
  the Synology SMB share. No password is stored in the task; Windows uses the
  user's existing SMB credential for SmartNAS.
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$BackupRoot = 'C:\\MirocardBackups',
  [string]$DailyTime = '03:10',
  [switch]$Force
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $scriptRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $PSScriptRoot }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path
}

$projectScript = Join-Path $ProjectRoot 'scripts\backup-project.ps1'
$dbScript = Join-Path $ProjectRoot 'scripts\backup-db-hourly.ps1'

if (-not (Test-Path -LiteralPath $projectScript -PathType Leaf)) { throw "Missing script: $projectScript" }
if (-not (Test-Path -LiteralPath $dbScript -PathType Leaf)) { throw "Missing script: $dbScript" }

Write-Host "Testing backup root: $BackupRoot"
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$probe = Join-Path $BackupRoot '.mirocard-write-test.txt'
"Mirocard backup write test $((Get-Date).ToString('o'))" | Set-Content -Path $probe -Encoding UTF8
Remove-Item -LiteralPath $probe -Force

function Register-MirocardTask {
  param(
    [string]$TaskName,
    [string]$Argument,
    [Microsoft.Management.Infrastructure.CimInstance]$Trigger
  )

  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing -and -not $Force) {
    throw "Scheduled task already exists: $TaskName. Re-run with -Force to replace it."
  }
  if ($existing -and $Force) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  }

  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $Argument -WorkingDirectory $ProjectRoot
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 4)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $Trigger -Settings $settings -Description 'Mirocard backup task' | Out-Null
  Write-Host "Registered task: $TaskName"
}

$dailyArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$projectScript`" -BackupRoot `"$BackupRoot`""
$hourlyArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$dbScript`" -BackupRoot `"$BackupRoot`""

$dailyTrigger = New-ScheduledTaskTrigger -Daily -At ([DateTime]::Parse($DailyTime))
$hourlyTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 1)

Register-MirocardTask -TaskName 'Mirocard Project Backup' -Argument $dailyArgs -Trigger $dailyTrigger
Register-MirocardTask -TaskName 'Mirocard DB Hourly Backup' -Argument $hourlyArgs -Trigger $hourlyTrigger

Write-Host "Backup tasks installed. Run once manually with:"
Write-Host '  Start-ScheduledTask -TaskName "Mirocard Project Backup"'
Write-Host '  Start-ScheduledTask -TaskName "Mirocard DB Hourly Backup"'
