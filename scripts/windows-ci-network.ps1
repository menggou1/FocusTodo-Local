param(
    [switch]$Configure,
    [Parameter(Mandatory = $true)][ValidateSet('before', 'after')][string]$Phase
)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
    throw 'This script is only for disposable Windows GitHub Actions runners.'
}
$originalRange = @(netsh.exe int ipv4 show dynamicport tcp)
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect the TCP port pool.' }
if ($Configure) {
    # Chromium's many fresh profiles create short-lived loopback connections.
    # Give the complete suite a larger pool without retries or shorter coverage.
    foreach ($family in @('ipv4', 'ipv6')) {
        netsh.exe int $family set dynamicport tcp start=10000 num=55536
        if ($LASTEXITCODE -ne 0) { throw "Cannot configure $family TCP port pool." }
    }
}
$connections = @(Get-NetTCPConnection)
$snapshot = [ordered]@{
    phase = $Phase
    timestampUtc = [DateTime]::UtcNow.ToString('o')
    configured = [bool]$Configure
    originalIpv4Range = $originalRange
    ipv4Range = @(netsh.exe int ipv4 show dynamicport tcp)
    ipv6Range = @(netsh.exe int ipv6 show dynamicport tcp)
    excludedIpv4Ranges = @(netsh.exe int ipv4 show excludedportrange protocol=tcp)
    totalConnections = $connections.Count
    states = @($connections | Group-Object State | ForEach-Object { @{ state = $_.Name; count = $_.Count } })
    loopbackStates = @($connections | Where-Object { $_.RemoteAddress -in @('127.0.0.1', '::1') } | Group-Object State | ForEach-Object { @{ state = $_.Name; count = $_.Count } })
}
$directory = Join-Path $PSScriptRoot '../docs/acceptance'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $directory "windows-network-$Phase.json") -Encoding utf8
$snapshot | ConvertTo-Json -Depth 5 | Write-Output
