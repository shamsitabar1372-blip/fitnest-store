$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$backupName = 'fitnest-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
# Uses credentials already configured INSIDE the database container, never in command arguments.
docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --file="/backups/$1"' sh $backupName
if ($LASTEXITCODE -ne 0) { throw 'Backup failed.' }
Write-Output "Backup created in .private/backups/$backupName. Encrypt before off-site transfer."
