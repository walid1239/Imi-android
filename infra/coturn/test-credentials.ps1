$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) { throw "Create infra/coturn/.env first." }
$secretLine = Get-Content $envFile | Where-Object { $_ -match '^TURN_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw "TURN_SECRET is missing from the local .env file." }
$secret = $secretLine.Substring("TURN_SECRET=".Length).Trim()
if ([string]::IsNullOrWhiteSpace($secret) -or $secret -like "REPLACE*" -or $secret -like "CHANGE_ME*") {
    throw "TURN_SECRET is empty or still a placeholder."
}

$expiresAt = [DateTimeOffset]::UtcNow.AddMinutes(10).ToUnixTimeSeconds()
$username = "$expiresAt" + ":local-trickle-test"
$hmac = New-Object System.Security.Cryptography.HMACSHA1
try {
    $hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($secret)
    $credentialBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($username))
    $credential = [Convert]::ToBase64String($credentialBytes)
} finally {
    $hmac.Dispose()
}

# This prints only a 10-minute test username and its derived credential, never TURN_SECRET.
Write-Output "username=$username"
Write-Output "credential=$credential"
