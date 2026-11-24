$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) { python -m venv .venv }
& .venv/Scripts/python.exe -m pip install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
$env:DJANGO_LOCAL = '1'
$env:DJANGO_DEBUG = '1'
$env:DB_ENGINE = 'sqlite'
& .venv/Scripts/python.exe backend/manage.py migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& .venv/Scripts/python.exe backend/manage.py setup_roles
& .venv/Scripts/python.exe backend/manage.py collectstatic --noinput
& .venv/Scripts/python.exe backend/manage.py runserver 127.0.0.1:8081 --noreload
