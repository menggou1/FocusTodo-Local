param(
    [Parameter(Mandatory = $true)][ValidateSet('before', 'after')][string]$Phase
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'This script is only for disposable Windows GitHub Actions runners.'
}
$connections = @(Get-NetTCPConnection)
$snapshot = [ordered]@{
    phase = $Phase
    timestampUtc = [DateTime]::UtcNow.ToString('o')
    ipv4Range = @(netsh.exe int ipv4 show dynamicport tcp)
    ipv6Range = @(netsh.exe int ipv6 show dynamicport tcp)
    excludedIpv4Ranges = @(netsh.exe int ipv4 show excludedportrange protocol=tcp)
    totalConnections = $connections.Count
    states = @($connections | Group-Object State | ForEach-Object { @{ state = $_.Name; count = $_.Count } })
    loopbackStates = @($connections | Where-Object { $_.RemoteAddress -in @('127.0.0.1', '::1') } | Group-Object State | ForEach-Object { @{ state = $_.Name; count = $_.Count } })
}
$directory = if ($env:FOCUS_ACCEPTANCE_DIR) { $env:FOCUS_ACCEPTANCE_DIR } else { Join-Path $PSScriptRoot '../dist/acceptance' }
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $directory "windows-network-$Phase.json") -Encoding utf8
$snapshot | ConvertTo-Json -Depth 5 | Write-Output
