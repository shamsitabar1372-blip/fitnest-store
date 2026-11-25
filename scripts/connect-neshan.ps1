$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$secureKey = Read-Host 'Paste Neshan SERVICES key (input is hidden)' -AsSecureString
$serviceKey = [System.Net.NetworkCredential]::new('', $secureKey).Password
if (-not $serviceKey.StartsWith('service.') -or $serviceKey.Length -gt 512) { throw 'Use the services key beginning service.; not the web map key.' }
# Close only this project's local development servers; preserve the database and sessions.
$oldServers = @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Where-Object { $_.CommandLine -like "*$projectRoot*" -and $_.CommandLine -match 'backend[\\/]manage\.py.*runserver.*127\.0\.0\.1:8081' })
foreach ($oldServer in $oldServers) { Stop-Process -Id $oldServer.ProcessId -ErrorAction SilentlyContinue }
$env:NESHAN_SERVICE_API_KEY = $serviceKey
$env:NESHAN_SERVICES_ENABLED = '1'
$env:DJANGO_LOCAL = '1'
$env:DJANGO_DEBUG = '1'
$env:DB_ENGINE = 'sqlite'
$serviceKey = $null
$secureKey.Dispose()
try {
    & .venv/Scripts/python.exe -u backend/manage.py runserver 127.0.0.1:8081 --noreload
} finally {
    Remove-Item Env:NESHAN_SERVICE_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:NESHAN_SERVICES_ENABLED -ErrorAction SilentlyContinue
}
