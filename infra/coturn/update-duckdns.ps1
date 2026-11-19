$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:DUCKDNS_TOKEN)) {
    throw "Set DUCKDNS_TOKEN in your Windows user environment before running this script."
}
$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) { throw "Create infra/coturn/.env from .env.example first." }

$lines = Get-Content $envFile
$domainLine = $lines | Where-Object { $_ -match '^DUCKDNS_DOMAIN=' } | Select-Object -First 1
if (-not $domainLine) { throw "DUCKDNS_DOMAIN is missing from infra/coturn/.env." }
$domain = $domainLine.Substring("DUCKDNS_DOMAIN=".Length).Trim()
if ($domain -like "REPLACE*") { throw "Replace the DUCKDNS_DOMAIN placeholder locally." }

$publicIp = (Invoke-RestMethod -Uri "https://api4.ipify.org").ToString().Trim()
if ($publicIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw "Could not determine a public IPv4 address." }
# This is the static private IP assigned to the Coturn container in docker-compose.yml,
# not the Windows host LAN address used as the router's port-forward destination.
$containerLanIp = "172.30.250.10"

$uri = "https://www.duckdns.org/update?domains=$([uri]::EscapeDataString($domain))&token=$([uri]::EscapeDataString($env:DUCKDNS_TOKEN))&ip=$publicIp"
$result = (Invoke-RestMethod -Uri $uri).ToString().Trim()
if ($result -ne "OK") { throw "DuckDNS update failed (response: $result)." }

$newExternalIp = "$publicIp/$containerLanIp"
$updated = $false
$lines = $lines | ForEach-Object {
    if ($_ -match '^TURN_EXTERNAL_IP=') { $updated = $true; "TURN_EXTERNAL_IP=$newExternalIp" } else { $_ }
}
if (-not $updated) { $lines += "TURN_EXTERNAL_IP=$newExternalIp" }
Set-Content -Path $envFile -Value $lines -Encoding ascii
Write-Host "DuckDNS updated; TURN_EXTERNAL_IP refreshed. Restart Coturn if the public IP changed."
