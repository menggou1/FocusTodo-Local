param([switch]$NoBrowser, [ValidateRange(1, 65535)][int]$Port = 5500)

$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
if (-not $siteRoot -and $PSCommandPath) { $siteRoot = Split-Path -Parent $PSCommandPath }
if (-not $siteRoot) { $siteRoot = (Get-Location).Path }

try {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $launchArgs = @((Join-Path $siteRoot 'scripts/start.cjs'), '--port', [string]$Port)
        if ($NoBrowser) { $launchArgs += '--no-browser' }
        & node @launchArgs
        exit $LASTEXITCODE
    }
    elseif (Get-Command python -ErrorAction SilentlyContinue) {
        Write-Host "Open http://127.0.0.1:$Port/index.html (Ctrl+C to stop)."
        & python -m http.server $Port --bind 127.0.0.1 --directory $siteRoot
        exit $LASTEXITCODE
    }
    else { throw 'Install Node.js 22+ (recommended) or Python 3.7+ and try again.' }
}
catch {
    Write-Error ('FocusTodo startup failed: ' + $_.Exception.Message) -ErrorAction Continue
    exit 1
}
