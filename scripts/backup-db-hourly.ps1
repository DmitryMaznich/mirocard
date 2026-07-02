<#
.SYNOPSIS
  Creates an hourly SQLite-only backup for Mirocard.
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$BackupRoot = $env:MIROCARD_BACKUP_ROOT,
  [int]$RetentionDays = 14
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $scriptRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $PSScriptRoot }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = 'C:\\MirocardBackups'
}

$hourlyRoot = Join-Path $BackupRoot 'hourly-db'
New-Item -ItemType Directory -Force -Path $hourlyRoot | Out-Null

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dbSource = Join-Path $ProjectRoot 'runtime\data\mirocard.db'
$dbOut = Join-Path $hourlyRoot "mirocard-db-$stamp.db"

& node (Join-Path $ProjectRoot 'scripts\backup-sqlite.mjs') --db $dbSource --out $dbOut

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $dbOut
"$($hash.Hash)  $(Split-Path $dbOut -Leaf)" | Set-Content -Path ($dbOut + '.sha256') -Encoding ASCII

if ($RetentionDays -gt 0) {
  $cutoff = (Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem -LiteralPath $hourlyRoot -File -Filter 'mirocard-db-*.db*' |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force
}

Write-Host "Hourly DB backup complete: $dbOut"
