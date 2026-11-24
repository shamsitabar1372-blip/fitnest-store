"""Phone OTP authentication. No browser-visible codes or development bypass."""
from pathlib import Path
from contextlib import contextmanager
from urllib.request import Request,urlopen
from urllib.parse import urlencode
import sqlite3,secrets,hashlib,hmac,time,re,os,json,threading

class AuthError(Exception):
    def __init__(self,message,status=400,retry=0):
        self.message,self.status,self.retry=message,status,retry

def normalize_mobile(value):
    if not isinstance(value,str) or len(value)>30:raise AuthError('شمارهٔ موبایل معتبر وارد کنید.')
    value=value.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789')).replace(' ','').replace('-','')
    if value.startswith('+98'):value='0'+value[3:]
    elif value.startswith('0098'):value='0'+value[4:]
    elif value.startswith('98') and len(value)==12:value='0'+value[2:]
    if not re.fullmatch(r'09[0-9]{9}',value):raise AuthError('شمارهٔ موبایل معتبر وارد کنید.')
    return value

def send_kavenegar(mobile,code):
    key=os.environ.get('KAVENEGAR_API_KEY','')
    template=os.environ.get('KAVENEGAR_OTP_TEMPLATE','')
    if not key or not template or not re.fullmatch(r'[A-Za-z0-9_-]+',key):
        raise AuthError('ارسال پیامک هنوز فعال نشده است. لطفاً بعداً تلاش کنید.',503)
    request=Request('https://api.kavenegar.com/v1/'+key+'/verify/lookup.json',
        data=urlencode({'receptor':mobile,'token':code,'template':template,'type':'sms'}).encode(),
        headers={'Content-Type':'application/x-www-form-urlencoded'},method='POST')
    try:
        with urlopen(request,timeout=10) as response:result=json.loads(response.read(65536))
        if result.get('return',{}).get('status')!=200:raise ValueError('Provider rejected message')
    except Exception:
        # Provider exception URLs may contain credentials; never return/log their text.
        raise AuthError('ارسال پیامک انجام نشد. لطفاً کمی بعد تلاش کنید.',503) from None

class AuthStore:
    TTL=180
    SESSION_TTL=43200
    def __init__(self,directory,sender=None,clock=time.time):
        self.directory=Path(directory);self.directory.mkdir(parents=True,exist_ok=True)
        secret=self.directory/'auth.key'
        try:
            fd=os.open(secret,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'wb') as f:f.write(secrets.token_bytes(32))
        except FileExistsError:pass
        self.secret=secret.read_bytes()
        if len(self.secret)!=32:raise RuntimeError('Invalid auth key file')
        self.path=self.directory/'auth.sqlite3';self.sender=sender or send_kavenegar;self.clock=clock
        self.lock=threading.RLock()
        with self.transaction() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,mobile TEXT UNIQUE NOT NULL,created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,mobile TEXT NOT NULL,digest TEXT NOT NULL,expires REAL NOT NULL,attempts INTEGER NOT NULL,state TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS limits(subject TEXT NOT NULL,created REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS limits_subject ON limits(subject,created);
            ''')
    @contextmanager
    def transaction(self):
        with self.lock:
            db=sqlite3.connect(self.path,timeout=10);db.row_factory=sqlite3.Row
            try:
                db.execute('BEGIN IMMEDIATE');yield db;db.commit()
            except Exception:db.rollback();raise
            finally:db.close()
    def digest(self,value):return hmac.new(self.secret,value.encode(),hashlib.sha256).hexdigest()
    def ready(self):return self.sender!=send_kavenegar or bool(os.environ.get('KAVENEGAR_API_KEY') and os.environ.get('KAVENEGAR_OTP_TEMPLATE'))
    def _limit(self,db,subject,seconds,maximum,now):
        subject=self.digest(subject)
        count=db.execute('SELECT COUNT(*) FROM limits WHERE subject=? AND created>?',(subject,now-seconds)).fetchone()[0]
        if count>=maximum:raise AuthError('تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.',429,60)
    def request(self,mobile,ip):
        mobile=normalize_mobile(mobile)
        if not self.ready():raise AuthError('ارسال پیامک هنوز فعال نشده است. لطفاً بعداً تلاش کنید.',503)
        now=self.clock();token=secrets.token_urlsafe(32);challenge=self.digest(token)
        code=f'{secrets.randbelow(10000):04d}'
        with self.transaction() as db:
            db.execute('DELETE FROM limits WHERE created<?',(now-86400,))
            db.execute('DELETE FROM challenges WHERE expires<?',(now,))
            db.execute('DELETE FROM sessions WHERE expires<?',(now,))
            for subject,seconds,maximum in [('phone:'+mobile,60,1),('phone:'+mobile,900,3),('phone:'+mobile,86400,10),('send-ip:'+ip,3600,10),('send-ip:'+ip,86400,30),('global-send',86400,200)]:
                self._limit(db,subject,seconds,maximum,now)
            for subject in ['phone:'+mobile,'send-ip:'+ip,'global-send']:
                db.execute('INSERT INTO limits VALUES(?,?)',(self.digest(subject),now))
            db.execute('DELETE FROM challenges WHERE mobile=?',(mobile,))
            db.execute('INSERT INTO challenges VALUES(?,?,?,?,0,?)',(challenge,mobile,self.digest(challenge+':'+mobile+':'+code),now+self.TTL,'pending'))
        try:self.sender(mobile,code)
        except Exception:
            with self.transaction() as db:db.execute('DELETE FROM challenges WHERE id=?',(challenge,))
            raise AuthError('ارسال پیامک انجام نشد. لطفاً کمی بعد تلاش کنید.',503) from None
        with self.transaction() as db:db.execute("UPDATE challenges SET state='sent' WHERE id=?",(challenge,))
        return token,{'ok':True,'expiresIn':self.TTL,'retryAfter':60}
    def verify(self,token,code,ip,old_session=''):
        if not isinstance(code,str):code=''
        code=code.translate(str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','01234567890123456789'))
        now=self.clock();error=None;result=None
        with self.transaction() as db:
            self._limit(db,'verify-ip:'+ip,900,40,now)
            db.execute('INSERT INTO limits VALUES(?,?)',(self.digest('verify-ip:'+ip),now))
            row=db.execute("SELECT * FROM challenges WHERE id=? AND state='sent'",(self.digest(token),)).fetchone() if isinstance(token,str) and len(token)<=128 else None
            if not row or row['expires']<=now or row['attempts']>=5:
                error=AuthError('کد منقضی شده یا تعداد تلاش‌ها تمام شده است. کد جدید بگیرید.')
            elif not re.fullmatch(r'[0-9]{4}',code) or not hmac.compare_digest(self.digest(row['id']+':'+row['mobile']+':'+code),row['digest']):
                db.execute('UPDATE challenges SET attempts=attempts+1 WHERE id=?',(row['id'],))
                error=AuthError('کد واردشده صحیح نیست.')
            else:
                db.execute('DELETE FROM challenges WHERE mobile=?',(row['mobile'],))
                db.execute('INSERT OR IGNORE INTO users VALUES(?,?,?)',(secrets.token_hex(16),row['mobile'],now))
                user=db.execute('SELECT id,mobile FROM users WHERE mobile=?',(row['mobile'],)).fetchone()
                session=secrets.token_urlsafe(32)
                if old_session:db.execute('DELETE FROM sessions WHERE id=?',(self.digest(old_session),))
                db.execute('INSERT INTO sessions VALUES(?,?,?)',(self.digest(session),user['id'],now+self.SESSION_TTL))
                result=session,dict(user)
        # Commit failed-attempt counters before raising; otherwise guessing would be unlimited.
        if error:raise error
        return result
    def session(self,token):
        if not isinstance(token,str) or len(token)>128:return None
        with self.transaction() as db:
            row=db.execute('SELECT users.id,users.mobile FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.id=? AND sessions.expires>?',(self.digest(token),self.clock())).fetchone()
            return dict(row) if row else None
    def logout(self,token):
        with self.transaction() as db:db.execute('DELETE FROM sessions WHERE id=?',(self.digest(token),))
