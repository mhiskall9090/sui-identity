<#
setup_gemini.ps1

Interactive PowerShell script to:
- verify if `gemini` CLI is available
- optionally try to install it via winget if missing
- collect API keys (GEMINI_API_KEY, CURSOR_API_KEY) and write a .env file in the repo root
- optionally persist keys to user environment via setx
- offer to run the indexing script afterwards

This script is conservative: it won't perform any network install unless you confirm.
#>

param(
    [string]$RepoRoot = (Get-Location).Path
)

function Write-Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Write-Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Write-Err($m){ Write-Host "[ERROR] $m" -ForegroundColor Red }

Write-Info "Repository root: $RepoRoot"

# Check for gemini
$geminiCmd = Get-Command gemini -ErrorAction SilentlyContinue
if (-not $geminiCmd) {
    Write-Warn "Could not find 'gemini' in PATH."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        $install = Read-Host "winget is available. Try to install Gemini CLI via winget? (y/N)"
        if ($install -match '^[Yy]') {
            Write-Info "Attempting to install 'google.gemini' via winget. This requires internet and admin rights."
            try {
                winget install --id Google.Gemini -e --silent
            } catch {
                Write-Warn "winget install failed or package id unknown. Please install gemini CLI manually: https://developers.google.com/" 
            }
            $geminiCmd = Get-Command gemini -ErrorAction SilentlyContinue
        } else {
            Write-Info "Skipping automatic install. Please install Gemini CLI and re-run this script."
        }
    } else {
        Write-Warn "winget not found. Please install the Gemini CLI manually and ensure 'gemini' is on PATH."
    }
}

if ($geminiCmd) { Write-Info "Found gemini at: $($geminiCmd.Source)" }

# Collect API keys
$envFilePath = Join-Path -Path $RepoRoot -ChildPath ".env"
Write-Info "I'll create/update the .env file at: $envFilePath"

$existing = @{}
if (Test-Path $envFilePath) {
    Write-Info ".env exists — reading existing values (values will be preserved unless overwritten)."
    Get-Content $envFilePath | ForEach-Object {
        if ($_ -match '^(\s*#|$)') { return }
        $parts = $_ -split '=',2
        if ($parts.Count -ge 2) { $existing[$parts[0].Trim()] = $parts[1].Trim() }
    }
}

function Prompt-For-Secret($name, $current) {
    if ($current) { $prompt = "$name (press Enter to keep existing)" } else { $prompt = "$name (will be saved to .env)" }
    $val = Read-Host -AsSecureString $prompt
    if ($val.Length -gt 0) { return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($val)) }
    return $current
}

$geminiKey = $null
if ($existing.ContainsKey('GEMINI_API_KEY')) { $geminiKey = $existing['GEMINI_API_KEY'] }
$cursorKey = $null
if ($existing.ContainsKey('CURSOR_API_KEY')) { $cursorKey = $existing['CURSOR_API_KEY'] }

$newGemini = Prompt-For-Secret 'GEMINI_API_KEY' $geminiKey
if ($newGemini) { $existing['GEMINI_API_KEY'] = $newGemini }

$newCursor = Prompt-For-Secret 'CURSOR_API_KEY' $cursorKey
if ($newCursor) { $existing['CURSOR_API_KEY'] = $newCursor }

Write-Info "Writing .env file (sensitive values are written in plain-text to the repository .env file — take care with source control)."

$lines = @()
foreach ($k in $existing.Keys) { $lines += "$k=$($existing[$k])" }

Set-Content -Path $envFilePath -Value $lines -Encoding UTF8

$persist = Read-Host "Optionally persist these keys into your Windows user environment variables (setx). Persist? (y/N)"
if ($persist -match '^[Yy]') {
    foreach ($k in @('GEMINI_API_KEY','CURSOR_API_KEY')) {
        if ($existing.ContainsKey($k)) {
            Write-Info "Setting user environment variable: $k"
            setx $k $existing[$k] | Out-Null
        }
    }
    Write-Info "You may need to restart your shell/terminal for setx changes to take effect."
}

if ($geminiCmd) {
    $runIndex = Read-Host "Run indexing now using scripts/index_gemini.ps1? (y/N)"
    if ($runIndex -match '^[Yy]') {
        $scriptPath = Join-Path -Path $RepoRoot -ChildPath "scripts/index_gemini.ps1"
        if (Test-Path $scriptPath) {
            Write-Info "Invoking index script..."
            & $scriptPath -RepoRoot $RepoRoot
        } else {
            Write-Warn "Index script not found at $scriptPath — run it manually when ready."
        }
    }
} else {
    Write-Warn "gemini CLI not available — skipping indexing step."
}

Write-Info "Setup script finished. See docs/GEMINI_SETUP.md for more info."
