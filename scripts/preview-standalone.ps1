# Run the isolated React preview in the foreground; Ctrl+C stops this server.
[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 5511,

    [switch]$Open,

    [switch]$Static
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
    if ($Static) {
        & npm.cmd run build:standalone
        if ($LASTEXITCODE -ne 0) { throw "Preview build failed (exit $LASTEXITCODE)." }
    }
    $previewArgs = @("$Port")
    if ($Static) { $previewArgs += '--static' }
    if ($Open) {
        $previewArgs += '--open'
    }
    & node (Join-Path $PSScriptRoot 'preview-standalone.mjs') @previewArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Preview failed (exit $LASTEXITCODE). If port $Port is in use, use -Port with a free port. If HMR fails, try -Static -Port 5512 -Open."
    }
} finally {
    Pop-Location
}
