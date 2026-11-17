# Run the isolated React preview in the foreground; Ctrl+C stops this server.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $projectRoot
try {
    if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
        throw 'Vite is missing. Run npm ci in the project directory first.'
    }
    Write-Host 'FocusTodo React preview: http://127.0.0.1:5511/'
    Write-Host 'HMR enabled. Port conflicts fail without stopping any existing process. Ctrl+C to stop.'
    & npm.cmd run dev -- --host 127.0.0.1 --port 5511 --strictPort
    $previewExitCode = $LASTEXITCODE
    if ($previewExitCode -ne 0) {
        throw "Preview failed (exit $previewExitCode). Check the Vite error above; no process was stopped."
    }
} finally {
    Pop-Location
}
