<#
index_gemini.ps1

PowerShell automation to run Gemini CLI indexing against the repository files.
This script will:
- look for GEMINI_API_KEY and CURSOR_API_KEY from environment variables or .env file
- run `gemini index` (or the nearest equivalent) for files under the repo
- show a short summary at the end

This script assumes the Gemini CLI provides commands similar to `gemini index --source <file-or-dir> --api-key $key`.
Because different Gemini CLI versions may differ, the script is conservative and prints the exact commands it will run and asks confirmation.
#>

param(
    [string]$RepoRoot = (Get-Location).Path,
    [string]$IndexDir = "src"
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

Write-Info "Repo root: $RepoRoot"

# Load .env if exists (simple parser)
$envFile = Join-Path $RepoRoot ".env"
if (Test-Path $envFile) {
    Write-Info "Loading $envFile"
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^(\s*#|$)') { return }
        $p = $_ -split '=',2
        if ($p.Count -ge 2) { $name=$p[0].Trim(); $val=$p[1].Trim(); if (-not [string]::IsNullOrEmpty($name) -and -not [string]::IsNullOrEmpty($val)) { Set-Item -Path env:$name -Value $val } }
    }
}

$geminiKey = $env:GEMINI_API_KEY
$cursorKey = $env:CURSOR_API_KEY

if (-not $geminiKey) { Write-Warn "GEMINI_API_KEY not set in environment. Indexing likely to fail without it." }

# Find files to index
$target = Join-Path $RepoRoot $IndexDir
if (-not (Test-Path $target)) {
    Write-Warn "Index directory '$IndexDir' not found under repo root. Falling back to repository root."
    $target = $RepoRoot
}

Write-Info "Files/dirs to index: $target"

# Example command — customize to match your gemini CLI
$cmdTemplate = 'gemini index --source "{0}" --api-key "{1}"'
$cmd = [string]::Format($cmdTemplate, $target, $geminiKey)

Write-Host "About to run the following command:" -ForegroundColor Green
Write-Host $cmd -ForegroundColor White

$ok = Read-Host "Proceed to run the command? (y/N)"
if ($ok -notmatch '^[Yy]') { Write-Warn "Indexing canceled by user."; exit 1 }

try {
    Write-Info "Running: $cmd"
    # Execute the command in the shell so PATH is used
    $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command",$cmd -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -eq 0) { Write-Info "Indexing command finished successfully." } else { Write-Warn "Indexing command finished with exit code: $($proc.ExitCode)" }
} catch {
    Write-Err "Failed to run indexing command: $_"
}

Write-Info "Indexing script finished. Verify in the Gemini/Cursor admin UI that the index was created."
