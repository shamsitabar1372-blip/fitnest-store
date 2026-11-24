import unittest,tempfile,threading,json,sys
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import serve
from auth_backend import AuthStore

class QuietHandler(serve.Handler):
    def log_message(self,*_):pass

class AuthHTTPTests(unittest.TestCase):
    def setUp(self):
        self.environment=patch.dict('os.environ',{'KAVENEGAR_API_KEY':'','KAVENEGAR_OTP_TEMPLATE':'','FITNEST_PUBLIC_ORIGIN':'','FITNEST_TRUST_PROXY':'0'});self.environment.start()
        self.temp=tempfile.TemporaryDirectory();self.messages=[]
        serve.AUTH=AuthStore(self.temp.name,sender=lambda phone,code:self.messages.append((phone,code)))
        self.server=serve.ThreadingHTTPServer(('127.0.0.1',0),QuietHandler);self.server.allow_lan=False
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.base='http://127.0.0.1:'+str(self.server.server_port)
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();serve.AUTH=None
        self.temp.cleanup();self.environment.stop()
    def call(self,path,data=None,cookie='',origin=None):
        headers={'Content-Type':'application/json','Origin':origin or self.base}
        if cookie:headers['Cookie']=cookie
        req=Request(self.base+'/api/auth/'+path,headers=headers,data=json.dumps(data).encode() if data is not None else None)
        try:r=urlopen(req,timeout=5)
        except HTTPError as e:r=e
        with r:return r.status,json.loads(r.read()),r.headers
    def test_full_flow_cookie_and_logout(self):
        status,body,headers=self.call('request',{'mobile':'09123456789'})
        self.assertEqual(status,200);self.assertNotIn('code',body)
        challenge=headers.get('Set-Cookie').split(';')[0]
        status,body,headers=self.call('verify',{'code':self.messages[-1][1]},challenge)
        self.assertEqual(status,200)
        cookie=next(value for value in headers.get_all('Set-Cookie') if value.startswith('fitnest_session='))
        self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Strict',cookie)
        session=cookie.split(';')[0]
        self.assertTrue(self.call('session',cookie=session)[1]['authenticated'])
        self.assertEqual(self.call('verify',{'code':self.messages[-1][1]},challenge)[0],400)
        self.assertEqual(self.call('logout',{},session)[0],200)
        self.assertFalse(self.call('session',cookie=session)[1]['authenticated'])
    def test_cross_origin_and_missing_code_cannot_login(self):
        self.assertEqual(self.call('request',{'mobile':'09123456789'},origin='https://attacker.invalid')[0],403)
        self.assertEqual(len(self.messages),0)
        self.assertEqual(self.call('verify',{'code':'0000'})[0],400)
        self.assertFalse(self.call('session')[1]['authenticated'])
    def test_production_sets_secure_cookie(self):
        with patch.dict('os.environ',{'FITNEST_PUBLIC_ORIGIN':'https://fitnestpro.ir'}):
            status,_,headers=self.call('request',{'mobile':'09123456789'},origin='https://fitnestpro.ir')
            self.assertEqual(status,200);self.assertIn('; Secure',headers['Set-Cookie'])

if __name__=='__main__':unittest.main()
