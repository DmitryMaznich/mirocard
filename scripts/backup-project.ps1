<#
.SYNOPSIS
  Creates a disaster-recovery backup package for the Mirocard project.

.DESCRIPTION
  The package contains:
    - a git bundle with all refs;
    - working-tree patches for uncommitted tracked changes;
    - untracked non-ignored files;
    - valuable ignored assets such as PNG/PDF/DOCX/fonts outside generated folders;
    - a consistent SQLite backup made with VACUUM INTO;
    - a manifest and SHA-256 checksum.

  Secrets are not included by default. Store .env and backend/.env in a password
  manager or run with -IncludeSecrets only into a trusted encrypted destination.
#>

[CmdletBinding()]
param(
  [string]$ProjectRoot = "",
  [string]$BackupRoot = $env:MIROCARD_BACKUP_ROOT,
  [int]$RetentionDays = 30,
  [switch]$IncludeSecrets,
  [switch]$NoPrune
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "==> $Message"
}

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

function Get-RelativePath([string]$BasePath, [string]$FullPath) {
  $baseUri = [Uri]((Resolve-Path $BasePath).Path.TrimEnd('\') + '\')
  $fileUri = [Uri](Resolve-Path $FullPath).Path
  return [Uri]::UnescapeDataString($baseUri.MakeRelativeUri($fileUri).ToString()).Replace('/', '\')
}

function Ensure-InsidePath([string]$RootPath, [string]$CandidatePath) {
  $root = [System.IO.Path]::GetFullPath($RootPath).TrimEnd('\') + '\'
  $candidate = [System.IO.Path]::GetFullPath($CandidatePath)
  if (-not $candidate.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside backup root: $candidate"
  }
}

function Copy-WithRelativePath([string]$SourcePath, [string]$BasePath, [string]$DestinationRoot) {
  $relative = Get-RelativePath -BasePath $BasePath -FullPath $SourcePath
  $destination = Join-Path $DestinationRoot $relative
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item -LiteralPath $SourcePath -Destination $destination -Force
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $scriptRoot = if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $PSScriptRoot }
  $ProjectRoot = (Resolve-Path (Join-Path $scriptRoot '..')).Path
}

if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = 'C:\\MirocardBackups'
}

$ProjectRoot = (Resolve-Path $ProjectRoot).Path
New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
$BackupRoot = (Resolve-Path $BackupRoot).Path

Assert-Command git
Assert-Command node
Assert-Command Compress-Archive

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "mirocard-backup-$stamp"
$packageName = "mirocard-project-$stamp.zip"
$packagePath = Join-Path $BackupRoot $packageName
Ensure-InsidePath -RootPath $BackupRoot -CandidatePath $packagePath

if (Test-Path $staging) {
  Remove-Item -LiteralPath $staging -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
  Write-Step "Collecting git state"
  $manifestPath = Join-Path $staging 'manifest.txt'
  $remoteText = (& git -C $ProjectRoot remote -v) -join "`n"
  $statusText = (& git -C $ProjectRoot status --short) -join "`n"
  $headText = (& git -C $ProjectRoot log -1 --oneline --decorate) -join "`n"
  $branchText = (& git -C $ProjectRoot branch --show-current) -join "`n"

  @(
    "Mirocard backup",
    "CreatedAt=$((Get-Date).ToString('o'))",
    "ProjectRoot=$ProjectRoot",
    "Branch=$branchText",
    "Head=$headText",
    "Status=", $statusText,
    "Remotes=", $remoteText,
    "",
    "Restore order:",
    "1. Restore git bundle.",
    "2. Apply git-staged.patch and git-working-tree.patch if needed.",
    "3. Copy untracked-files and ignored-assets if needed.",
    "4. Restore db/mirocard.db to runtime/data/mirocard.db."
  ) | Set-Content -Path $manifestPath -Encoding UTF8

  if ($remoteText -match 'github\.com.*@') {
    "WARNING: Git remote appears to contain credentials. Rotate the token and remove it from origin." |
      Add-Content -Path $manifestPath -Encoding UTF8
    Write-Warning "Git remote appears to contain credentials. Rotate the token and remove it from origin."
  }

  $gitDir = Join-Path $staging 'git'
  New-Item -ItemType Directory -Force -Path $gitDir | Out-Null
  & git -C $ProjectRoot bundle create (Join-Path $gitDir "mirocard-$stamp.bundle") --all
  & git -C $ProjectRoot diff --staged | Set-Content -Path (Join-Path $gitDir 'git-staged.patch') -Encoding UTF8
  & git -C $ProjectRoot diff | Set-Content -Path (Join-Path $gitDir 'git-working-tree.patch') -Encoding UTF8

  Write-Step "Copying untracked non-ignored files"
  $untrackedRoot = Join-Path $staging 'untracked-files'
  New-Item -ItemType Directory -Force -Path $untrackedRoot | Out-Null
  $untracked = & git -C $ProjectRoot ls-files --others --exclude-standard
  foreach ($rel in $untracked) {
    if ([string]::IsNullOrWhiteSpace($rel)) { continue }
    $source = Join-Path $ProjectRoot $rel
    if (Test-Path -LiteralPath $source -PathType Leaf) {
      Copy-WithRelativePath -SourcePath $source -BasePath $ProjectRoot -DestinationRoot $untrackedRoot
    }
  }

  Write-Step "Copying valuable ignored assets"
  $ignoredAssetsRoot = Join-Path $staging 'ignored-assets'
  New-Item -ItemType Directory -Force -Path $ignoredAssetsRoot | Out-Null
  $valuableExtensions = @('.png', '.jpg', '.jpeg', '.webp', '.pdf', '.docx', '.xlsx', '.pptx', '.ttf', '.otf', '.mp3', '.wav', '.md', '.html')
  $excludedSegments = @('\.git\', '\node_modules\', '\dist\', '\runtime\', '\.cache\', '\.worktrees\', '\.superpowers\', '\.claude\', '\__pycache__\')
  $files = Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Force -ErrorAction SilentlyContinue
  foreach ($file in $files) {
    $full = $file.FullName
    $normalized = $full.Replace('/', '\')
    $skip = $false
    foreach ($segment in $excludedSegments) {
      if ($normalized.IndexOf($segment, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $skip = $true; break }
    }
    if ($skip) { continue }
    if ($valuableExtensions -notcontains $file.Extension.ToLowerInvariant()) { continue }

    $rel = Get-RelativePath -BasePath $ProjectRoot -FullPath $full
    $tracked = (& git -C $ProjectRoot ls-files -- $rel) -join ''
    if (-not [string]::IsNullOrWhiteSpace($tracked)) { continue }

    Copy-WithRelativePath -SourcePath $full -BasePath $ProjectRoot -DestinationRoot $ignoredAssetsRoot
  }

  Write-Step "Creating consistent SQLite backup"
  $dbRoot = Join-Path $staging 'db'
  New-Item -ItemType Directory -Force -Path $dbRoot | Out-Null
  $dbSource = Join-Path $ProjectRoot 'runtime\data\mirocard.db'
  $dbOut = Join-Path $dbRoot "mirocard-$stamp.db"
  & node (Join-Path $ProjectRoot 'scripts\backup-sqlite.mjs') --db $dbSource --out $dbOut

  Write-Step "Fetching latest production DB backup from runtime host"
  $prodDbRoot = Join-Path $dbRoot 'production'
  New-Item -ItemType Directory -Force -Path $prodDbRoot | Out-Null
  try {
    & python (Join-Path $ProjectRoot 'scripts\fetch-production-db-backup.py') --env (Join-Path $ProjectRoot '.env') --out-dir $prodDbRoot
  } catch {
    $warning = "Production DB fetch failed: $($_.Exception.Message)"
    Write-Warning $warning
    $warning | Add-Content -Path $manifestPath -Encoding UTF8
  }

  Write-Step "Recording secrets policy"
  $secretsDir = Join-Path $staging 'secrets'
  New-Item -ItemType Directory -Force -Path $secretsDir | Out-Null
  @(
    "Secrets are not included by default.",
    "Store these separately in a password manager:",
    "- $ProjectRoot\.env",
    "- $ProjectRoot\backend\.env",
    "- Synology/SSH/GitHub credentials",
    "",
    "If this backup was created with -IncludeSecrets, the secrets directory contains plaintext copies. Protect it accordingly."
  ) | Set-Content -Path (Join-Path $secretsDir 'README.txt') -Encoding UTF8

  if ($IncludeSecrets) {
    Write-Warning "Including plaintext secrets in the backup package. Use only with an encrypted destination."
    foreach ($secretRel in @('.env', 'backend\.env')) {
      $secretPath = Join-Path $ProjectRoot $secretRel
      if (Test-Path -LiteralPath $secretPath -PathType Leaf) {
        Copy-WithRelativePath -SourcePath $secretPath -BasePath $ProjectRoot -DestinationRoot $secretsDir
      }
    }
  }

  Write-Step "Compressing backup package"
  if (Test-Path -LiteralPath $packagePath) {
    Remove-Item -LiteralPath $packagePath -Force
  }
  Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $packagePath -CompressionLevel Optimal
  $hash = Get-FileHash -Algorithm SHA256 -LiteralPath $packagePath
  "$($hash.Hash)  $packageName" | Set-Content -Path ($packagePath + '.sha256') -Encoding ASCII

  if (-not $NoPrune -and $RetentionDays -gt 0) {
    Write-Step "Pruning backup packages older than $RetentionDays days"
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -LiteralPath $BackupRoot -File -Filter 'mirocard-project-*.zip*' |
      Where-Object { $_.LastWriteTime -lt $cutoff } |
      Remove-Item -Force
  }

  Write-Host "Backup complete: $packagePath"
  Write-Host "Checksum: $($packagePath).sha256"
} finally {
  if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}
