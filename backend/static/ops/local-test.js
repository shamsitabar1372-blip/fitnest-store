'use strict';
const form=document.getElementById('local-test-form'),message=document.getElementById('local-test-status');
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;message.textContent='در حال ورود به حساب آزمایشی…';
 try{
  const response=await fetch('/api/auth/local-test',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':form.elements.csrfmiddlewaretoken.value},body:'{}',signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok)throw Error(data.message||'ورود انجام نشد.');
  location.assign('/');
 }catch(error){message.textContent=error.message||'ارتباط با سرور برقرار نشد.';button.disabled=false;}
});
