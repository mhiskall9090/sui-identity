<#
index_all_gemini.ps1

Walks repository top-level files and directories and runs the Gemini CLI to index them.
This script is careful: it builds a list of commands, prints them, prompts for confirmation,
and runs them sequentially. It loads .env into environment variables first.

USAGE:
  .\scripts\index_all_gemini.ps1 -RepoRoot <path> -IncludeHidden:$false

Note: the exact `gemini` CLI flags may differ. Edit $cmdTemplate to match your gemini CLI.
#>

param(
    [string]$RepoRoot = (Get-Location).Path,
    [bool]$IncludeHidden = $false
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

Write-Info "Repo root: $RepoRoot"

# Load .env (simple)
$envFile = Join-Path $RepoRoot ".env"
if (Test-Path $envFile) {
    Write-Info "Loading $envFile"
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $p = $_ -split '=',2
        if ($p.Count -ge 2) { $name=$p[0].Trim(); $val=$p[1].Trim(); if ($name -and $val) { Set-Item -Path env:$name -Value $val } }
    }
}

$geminiKey = $env:GEMINI_API_KEY
if (-not $geminiKey) { Write-Warn "GEMINI_API_KEY not set. The script will print commands but indexing will fail unless you set the env or .env." }

# Build list of top-level entries to index (skip common noise)
$excludes = @('.git','node_modules','venv','.venv','dist','build','target','.idea','.vscode')

$entries = Get-ChildItem -Path $RepoRoot -Force | Where-Object {
    if (-not $IncludeHidden -and ($_.Attributes -band [System.IO.FileAttributes]::Hidden)) { return $false }
    foreach ($e in $excludes) { if ($_.Name -ieq $e) { return $false } }
    return $true
}

# Command template - update if your gemini CLI uses different flags
$cmdTemplate = 'gemini index --source "{0}" --api-key "{1}"'

$commands = @()
foreach ($item in $entries) {
    $path = $item.FullName
    # Prefer indexing directories (group files). For single large files, you can index the file directly.
    if ($item.PSIsContainer) {
        $commands += [string]::Format($cmdTemplate, $path, $env:GEMINI_API_KEY)
    } else {
        $commands += [string]::Format($cmdTemplate, $path, $env:GEMINI_API_KEY)
    }
}

if ($commands.Count -eq 0) { Write-Warn "No files found to index."; exit 1 }

Write-Host "The following index commands will be executed:" -ForegroundColor Green
$i=1
foreach ($c in $commands) { Write-Host "$i. $c"; $i++ }

$ok = Read-Host "Proceed to run these commands sequentially? (y/N)"
if ($ok -notmatch '^[Yy]') { Write-Warn "Indexing cancelled by user."; exit 1 }

foreach ($c in $commands) {
    Write-Info "Running: $c"
    try {
        # Use Start-Process so we don't lose streaming output; run in powershell process
        $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$c -NoNewWindow -Wait -PassThru
        if ($proc.ExitCode -eq 0) { Write-Info "Command succeeded." } else { Write-Warn "Command finished with exit code $($proc.ExitCode)" }
    } catch {
        Write-Err "Failed to run command: $_"
    }
}

Write-Info "Repository-wide indexing finished. Verify in your Gemini/Cursor dashboard."
