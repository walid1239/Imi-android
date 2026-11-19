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

$publicIp = (Invoke-RestMethod -Uri "https://api.ipify.org").ToString().Trim()
if ($publicIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw "Could not determine a public IPv4 address." }
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match '^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.' -and $_.IPAddress -ne '127.0.0.1' } |
    Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $lanIp) { throw "Could not find a private LAN IPv4 address; set TURN_EXTERNAL_IP manually." }

$uri = "https://www.duckdns.org/update?domains=$([uri]::EscapeDataString($domain))&token=$([uri]::EscapeDataString($env:DUCKDNS_TOKEN))&ip=$publicIp"
$result = (Invoke-RestMethod -Uri $uri).ToString().Trim()
if ($result -ne "OK") { throw "DuckDNS update failed (response: $result)." }

$newExternalIp = "$publicIp/$lanIp"
$updated = $false
$lines = $lines | ForEach-Object {
    if ($_ -match '^TURN_EXTERNAL_IP=') { $updated = $true; "TURN_EXTERNAL_IP=$newExternalIp" } else { $_ }
}
if (-not $updated) { $lines += "TURN_EXTERNAL_IP=$newExternalIp" }
Set-Content -Path $envFile -Value $lines -Encoding ascii
Write-Host "DuckDNS updated; TURN_EXTERNAL_IP refreshed. Restart Coturn if the public IP changed."
