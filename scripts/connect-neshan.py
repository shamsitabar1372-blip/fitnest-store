"""Local Neshan setup without changing PowerShell execution policy or storing credentials."""
from pathlib import Path
import argparse,getpass,os,subprocess,sys

ROOT=Path(__file__).resolve().parents[1]
STOP_LOCAL_SERVERS=r'''
$ErrorActionPreference='Stop'
$projectRoot=$env:FITNEST_MANAGED_PROJECT_ROOT
$oldServers=@(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($projectRoot,[System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    $_.CommandLine -match 'backend[\\/]manage\.py.*runserver.*127\.0\.0\.1:8081'
})
foreach ($oldServer in $oldServers) { Stop-Process -Id $oldServer.ProcessId -ErrorAction SilentlyContinue }
'''

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true',help='Check launcher paths without asking for a key or restarting anything.')
    args=parser.parse_args()
    python=ROOT/'.venv/Scripts/python.exe'
    manage=ROOT/'backend/manage.py'
    if not python.is_file() or not manage.is_file(): raise SystemExit('Project environment is missing. Run the local setup first.')
    if args.check:
        print('Launcher paths OK. No credentials requested; no services called or restarted.')
        return 0
    if os.name!='nt': raise SystemExit('This helper is for local Windows development only.')
    key=getpass.getpass('Paste Neshan SERVICES key, then press Enter (input is hidden): ').strip()
    if not key.startswith('service.') or len(key)>512 or any(char.isspace() for char in key):
        raise SystemExit('Enter the SERVICES key beginning service.; not the web map key. No server was changed.')
    stop_env=os.environ.copy();stop_env['FITNEST_MANAGED_PROJECT_ROOT']=str(ROOT)
    try:
        subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',STOP_LOCAL_SERVERS],env=stop_env,cwd=ROOT,check=True,timeout=30,creationflags=subprocess.CREATE_NO_WINDOW)
    except (subprocess.SubprocessError,OSError):
        raise SystemExit('Could not close the previous local server. Close it with Ctrl+C and run this helper again.') from None
    env=os.environ.copy()
    env.update(NESHAN_SERVICE_API_KEY=key,NESHAN_SERVICES_ENABLED='1',DJANGO_LOCAL='1',DJANGO_DEBUG='1',DB_ENGINE='sqlite')
    key=None
    print('Starting local server at http://127.0.0.1:8081/ . Keep this window open. The key is not saved to a file.')
    try:
        return subprocess.call([str(python),'-u',str(manage),'runserver','127.0.0.1:8081','--noreload'],cwd=ROOT,env=env)
    except KeyboardInterrupt: return 130
    finally: env.pop('NESHAN_SERVICE_API_KEY',None)

if __name__=='__main__': sys.exit(main())
