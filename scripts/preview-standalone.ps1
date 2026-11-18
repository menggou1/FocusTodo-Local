# Run the isolated React preview in the foreground; Ctrl+C stops this server.
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5511,

    [switch]$Open
)

$ErrorActionPreference = 'Stop'
$vite = Join-Path $PSScriptRoot '../node_modules/vite/bin/vite.js'
if ($Port -eq 5500) {
    throw 'Port 5500 is reserved for the stable application. Choose a different preview port.'
}
if (-not (Test-Path -LiteralPath $vite -PathType Leaf)) {
    throw 'Vite is missing. Run npm ci in the project directory first.'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    $viteArgs = @('--config', 'vite.standalone.config.mjs', '--host', '127.0.0.1', '--port', "$Port", '--strictPort')
    if ($Open) {
        $viteArgs += '--open'
    }
    Write-Host 'Starting the isolated preview with HMR. Ctrl+C to stop.'
    & node $vite @viteArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Preview failed (exit $LASTEXITCODE). If port $Port is in use, rerun with -Port and a free port."
    }
} finally {
    Pop-Location
}
