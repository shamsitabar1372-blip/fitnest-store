import unittest,tempfile,sys,concurrent.futures
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from auth_backend import AuthStore,AuthError,normalize_mobile

class OTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.now=100000.;self.messages=[]
        self.store=AuthStore(self.temp.name,sender=lambda mobile,code:self.messages.append((mobile,code)),clock=lambda:self.now)
    def tearDown(self):self.temp.cleanup()
    def issue(self,mobile='09123456789'):
        token,result=self.store.request(mobile,'127.0.0.1')
        return token,self.messages[-1][1],result
    def test_mobile_normalization(self):
        for number in ['۰۹۱۲۳۴۵۶۷۸۹','٠٩١٢٣٤٥٦٧٨٩','+989123456789','00989123456789','989123456789']:
            self.assertEqual(normalize_mobile(number),'09123456789')
        for number in ['',None,'1234','09123456789<script>']:
            with self.assertRaises(AuthError):normalize_mobile(number)
    def test_real_sender_disabled_without_configuration(self):
        with patch.dict('os.environ',{},clear=True):
            store=AuthStore(Path(self.temp.name)/'unconfigured')
            with self.assertRaises(AuthError) as result:store.request('09123456789','127.0.0.1')
            self.assertEqual(result.exception.status,503)
    def test_one_time_session_and_logout(self):
        token,code,result=self.issue();self.assertRegex(code,r'^\d{4}$');self.assertNotIn('code',result)
        session,user=self.store.verify(token,code,'127.0.0.1')
        self.assertEqual(self.store.session(session)['mobile'],'09123456789')
        with self.assertRaises(AuthError):self.store.verify(token,code,'127.0.0.1')
        self.store.logout(session);self.assertIsNone(self.store.session(session))
    def test_expiry(self):
        token,code,_=self.issue();self.now+=181
        with self.assertRaises(AuthError):self.store.verify(token,code,'127.0.0.1')
    def test_five_bad_attempts_persist(self):
        token,code,_=self.issue();wrong='9999' if code!='9999' else '0000'
        for _ in range(5):
            with self.assertRaises(AuthError):self.store.verify(token,wrong,'127.0.0.1')
        with self.assertRaises(AuthError):self.store.verify(token,code,'127.0.0.1')
        with self.store.transaction() as db:
            row=db.execute('SELECT attempts,digest FROM challenges').fetchone()
            self.assertEqual(row['attempts'],5);self.assertNotEqual(row['digest'],code)
    def test_cooldown_resend_and_old_code_invalidation(self):
        token,code,_=self.issue()
        with self.assertRaises(AuthError) as error:self.issue()
        self.assertEqual(error.exception.status,429)
        self.now+=61;new_token,new_code,_=self.issue()
        with self.assertRaises(AuthError):self.store.verify(token,code,'127.0.0.1')
        self.assertTrue(self.store.verify(new_token,new_code,'127.0.0.1'))
    def test_daily_phone_budget_and_no_account_enumeration(self):
        for _ in range(3):self.issue();self.now+=61
        with self.assertRaises(AuthError):self.issue()
    def test_session_survives_restart_but_expires(self):
        token,code,_=self.issue();session,user=self.store.verify(token,code,'127.0.0.1')
        other=AuthStore(self.temp.name,sender=lambda *_:None,clock=lambda:self.now)
        self.assertEqual(other.session(session)['id'],user['id'])
        self.now+=43201;self.assertIsNone(other.session(session))
    def test_single_use_under_concurrent_verification(self):
        token,code,_=self.issue()
        def attempt(_):
            try:self.store.verify(token,code,'127.0.0.1');return True
            except AuthError:return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sum(pool.map(attempt,range(2))),1)
    def test_delivery_failure_does_not_leave_usable_challenge(self):
        def fail(*_):raise RuntimeError('Provider URL with a secret must not be exposed')
        self.store.sender=fail
        with self.assertRaises(AuthError) as result:self.issue()
        self.assertNotIn('secret',result.exception.message)
        with self.store.transaction() as db:self.assertEqual(db.execute('SELECT COUNT(*) FROM challenges').fetchone()[0],0)

if __name__=='__main__':unittest.main()
