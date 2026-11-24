'use strict';
const content=document.querySelector('#content'),statusLine=document.querySelector('#status'),dialog=document.querySelector('#order-dialog');
const fa=n=>new Intl.NumberFormat('fa-IR').format(n),money=n=>fa(Math.round(n/10))+' تومان';
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
const action=(label,href)=>{const a=el('a',label,'action');a.href=href;return a;};
function csrf(){return document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10)||'';}
async function api(path,body,method='POST'){
 const r=await fetch('/api/manage/'+path,{credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-CSRFToken':csrf()}:{},method:body?method:'GET',body:body?JSON.stringify(body):undefined});
 let data;try{data=await r.json();}catch{throw Error('پاسخ سرور دریافت نشد.');}if(!r.ok)throw Error(data.message||'درخواست انجام نشد.');return data;
}
function box(title){const card=el('section',undefined,'box');card.append(el('h2',title));content.append(card);return card;}
function table(host,headers,rows){const wrap=el('div',undefined,'table-wrap'),t=el('table'),head=el('tr');headers.forEach(x=>head.append(el('th',x)));const h=el('thead');h.append(head);t.append(h);const body=el('tbody');rows.forEach(cells=>{const row=el('tr');cells.forEach(x=>{const td=el('td');td.append(x instanceof Node?x:document.createTextNode(String(x??'—')));row.append(td);});body.append(row);});t.append(body);wrap.append(t);host.append(wrap);if(!rows.length)host.append(el('p','داده‌ای برای نمایش وجود ندارد.','empty'));}
function badge(o){return el('span',o.statusLabel,'pill '+o.status);}
function detailsButton(o){const b=el('button','جزئیات');b.addEventListener('click',()=>showOrder(o));return b;}
function orderTable(host,orders){table(host,['کد سفارش','تاریخ','وضعیت','محصولات',''],orders.map(o=>[el('b',o.code,'ltr'),new Date(o.createdAt).toLocaleDateString('fa-IR'),badge(o),o.items.map(i=>i.title+' × '+fa(i.quantity)).join('، '),detailsButton(o)]));}
async function showOrder(o){
 const d=document.querySelector('#order-detail');d.replaceChildren(el('h2','جزئیات سفارش'),el('p',o.code,'ltr'),badge(o));
 if(o.address){d.append(el('h3','نشانی تحویل'),el('p',[o.address.name,o.address.province,o.address.city,o.address.street,'پلاک '+o.address.plate,'واحد '+o.address.unit,'کدپستی '+o.address.postal].join('، ')));}
 o.items.forEach(i=>{const row=el('div',undefined,'order-line');if(i.image){const img=el('img');img.className='thumb';img.src=i.image;img.alt=i.title;row.append(img);}row.append(el('strong',i.title),el('span',fa(i.quantity)+' عدد'));d.append(row);});
 if(o.total!==undefined){const list=el('dl');for(const [label,value] of [['جمع محصولات',o.subtotal],['تخفیف',o.discount],['ارسال',o.shipping_fee],['مالیات',o.tax],['مبلغ نهایی',o.total]]){list.append(el('dt',label),el('dd',money(value)));}d.append(list);}
 const next={paid:['processing','شروع آماده‌سازی'],processing:['shipped','ثبت ارسال'],shipped:['delivered','ثبت تحویل']}[o.status];
 if(next){const b=el('button',next[1]);b.addEventListener('click',async()=>{if(!confirm('تغییر وضعیت این سفارش را تأیید می‌کنید؟'))return;b.disabled=true;try{const data=await api('orders/'+o.id+'/transition',{status:next[0]});showOrder(data.order);statusLine.textContent='وضعیت سفارش ثبت شد.';}catch(e){statusLine.textContent=e.message;b.disabled=false;}});d.append(b);}
 d.append(action('مشاهدهٔ پرونده در مدیریت اطلاعات','/admin/shop/order/'+o.id+'/change/'));if(!dialog.open)dialog.showModal();
}
document.querySelector('#dialog-close').addEventListener('click',()=>dialog.close());
const titles={dashboard:'داشبورد',orders:'سفارش‌ها',products:'محصولات',inventory:'موجودی انبار',customers:'مشتریان',reports:'گزارش فروش',events:'رویدادهای مدیریتی',settings:'تنظیمات فروشگاه'};
let generation=0;
async function page(name){
 const current=++generation;document.querySelector('#page-title').textContent=titles[name];content.replaceChildren();statusLine.className='';statusLine.textContent='در حال دریافت اطلاعات…';document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
 try{
  const result=await api(name==='reports'?'dashboard':name==='inventory'?'products':name);if(current!==generation)return;statusLine.textContent='';
  if(name==='dashboard'||name==='reports'){
   if(name==='dashboard'){const cards=el('div',undefined,'kpis');for(const [label,value] of [['فروش پرداخت‌شده',money(result.paidTotal)],['تعداد سفارش‌ها',fa(result.orders)],['مشتریان',result.customers===null?'دسترسی محدود':fa(result.customers)],['هشدار موجودی',fa(result.lowStockCount)]]){const c=el('div',undefined,'card');c.append(el('span',label),el('strong',value));cards.append(c);}content.append(cards);}
   const chart=box('روند فروش پرداخت‌شده'),graph=el('div',undefined,'chart'),sales=result.sales.filter(x=>x.day);const max=Math.max(1,...sales.map(x=>x.total));sales.slice().reverse().forEach(x=>{const bar=el('div',undefined,'bar');bar.style.height=Math.max(2,160*x.total/max)+'px';bar.title=x.day+' · '+money(x.total);graph.append(bar);});chart.append(graph);if(!sales.length)chart.append(el('p','هنوز پرداخت تأییدشده‌ای ثبت نشده است.','empty'));
   table(chart,['روز','فروش'],sales.map(x=>[new Date(x.day).toLocaleDateString('fa-IR'),money(x.total)]));
   if(name==='dashboard'){orderTable(box('آخرین سفارش‌ها'),result.recent);table(box('هشدار موجودی انبار'),['شناسه انبار','موجودی',''],result.lowStock.map(v=>[v.sku,fa(v.stock),action('مدیریت موجودی','/admin/shop/variant/'+v.id+'/change/')]));}
  }
  if(name==='orders'){
   const host=box('فهرست سفارش‌ها'),toolbar=el('div',undefined,'toolbar'),search=el('input'),filter=el('select');search.placeholder='جست‌وجوی کد یا نام محصول';
   [['','همهٔ وضعیت‌ها'],['pending','در انتظار پرداخت'],['paid','پرداخت‌شده'],['processing','آماده‌سازی'],['shipped','ارسال‌شده'],['delivered','تحویل‌شده'],['cancelled','لغوشده']].forEach(([v,label])=>{const option=el('option',label);option.value=v;filter.append(option);});toolbar.append(search,filter);host.append(toolbar);const list=el('div');host.append(list);
   const draw=()=>{list.replaceChildren();const q=search.value.toLowerCase();orderTable(list,result.orders.filter(o=>(!filter.value||o.status===filter.value)&&(o.code.toLowerCase().includes(q)||o.items.some(x=>x.title.toLowerCase().includes(q)))));};search.addEventListener('input',draw);filter.addEventListener('change',draw);draw();host.append(el('p','حداکثر ۱۰۰ سفارش آخر؛ آرشیو کامل در مدیریت اطلاعات در دسترس است.','muted'),action('آرشیو کامل','/admin/shop/order/'));
  }
  if(name==='products'){
   const host=box('محصولات و گونه‌ها');host.append(action('افزودن محصول','/admin/shop/product/add/'));table(host,['محصول','گروه','گونه‌ها','وضعیت',''],result.products.map(p=>[p.title,p.gender||p.category,fa(p.variants.length),p.isDemo?'نمونه':p.active?'فعال':'پیش‌نویس',action('ویرایش و گالری','/admin/shop/product/'+p.id+'/change/')]));
  }
  if(name==='inventory'){
   table(box('اصلاح موجودی با ثبت رویداد و قفل دیتابیس'),['محصول','شناسه انبار','رنگ / اندازه','موجودی',''],result.products.flatMap(p=>p.variants.map(v=>{const b=el('button','اصلاح موجودی');b.addEventListener('click',async()=>{const input=prompt('تعداد تغییر موجودی را وارد کنید؛ مثال: ۵ یا منفی ۲');if(input===null||input.trim()==='')return;const delta=Number(input);if(!Number.isInteger(delta)||!delta){alert('عدد صحیح غیرصفر وارد کنید.');return;}if(!confirm('اصلاح موجودی '+v.sku+' به میزان '+fa(delta)+' تأیید می‌شود؟'))return;b.disabled=true;try{await api('inventory/'+v.id+'/adjust',{delta});page('inventory');statusLine.textContent='اصلاح موجودی ثبت شد.';}catch(e){statusLine.className='error';statusLine.textContent=e.message;b.disabled=false;}});return[p.title,v.sku,[v.color,v.size].join(' / '),fa(v.stock),b];})));
  }
  if(name==='customers'){table(box('فهرست مشتریان'),['نام','موبایل تأییدشده','تاریخ عضویت','وضعیت',''],result.customers.map(c=>[c.display_name||'ثبت نشده',c.mobile||'—',new Date(c.date_joined).toLocaleDateString('fa-IR'),c.is_active?'فعال':'مسدود',action('پرونده مشتری','/admin/shop/customer/'+c.id+'/change/')]));}
  if(name==='events'){table(box('رویدادها بدون ثبت کلید و محتوای حساس'),['رویداد','شناسه مرتبط','زمان'],result.events.map(e=>[e.action,e.target,new Date(e.created_at).toLocaleString('fa-IR')]));}
  if(name==='settings'){
   const host=box('تنظیمات عمومی'),form=el('form',undefined,'settings-form');const label=(text,input)=>{const l=el('label',text);l.append(input);form.append(l);};const n=el('input');n.value=result.settings.name||'FitNestPro';n.required=true;n.maxLength=100;label('نام فروشگاه',n);const tax=el('input');tax.type='number';tax.min=0;tax.max=10000;tax.value=result.settings.taxBps||0;label('مالیات بر حسب صدم درصد؛ ۹۰۰ یعنی ۹ درصد',tax);const enabled=el('input');enabled.type='checkbox';enabled.checked=result.settings.orderingEnabled;label('پذیرش سفارش؛ پرداخت تا اتصال درگاه همچنان غیرفعال است',enabled);const save=el('button','ذخیرهٔ تنظیمات');save.type='submit';form.append(save);form.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('ذخیرهٔ تنظیمات را تأیید می‌کنید؟'))return;save.disabled=true;try{await api('settings',{name:n.value,taxBps:Number(tax.value),orderingEnabled:enabled.checked},'PATCH');statusLine.className='success';statusLine.textContent='تنظیمات ذخیره شد.';}catch(err){statusLine.className='error';statusLine.textContent=err.message;}finally{save.disabled=false;}});host.append(form);
   const external=box('اتصال‌ها');external.append(el('p','پیامک: '+(result.smsEnabled?'فعال در تنظیمات سرور':'غیرفعال')),el('p','پرداخت: متصل نشده؛ موفقیت آزمایشی به سفارش واقعی اعمال نمی‌شود.'),el('p','کلیدها فقط از متغیر محیطی سرور خوانده می‌شوند.'));table(external,['روش ارسال','هزینه','وضعیت'],result.shipping.map(s=>[s.name,s.quote_required?'نیازمند استعلام':money(s.fee),s.active?'فعال':'غیرفعال']));external.append(action('ویرایش روش ارسال','/admin/shop/shippingmethod/'));
  }
 }catch(error){if(current===generation){statusLine.className='error';statusLine.textContent=error.message;const retry=el('button','تلاش دوباره');retry.addEventListener('click',()=>page(name));content.append(retry);}}
}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{history.replaceState(null,'','#'+button.dataset.page);page(button.dataset.page);}));
const available=[...document.querySelectorAll('[data-page]')].map(x=>x.dataset.page);page(available.includes(location.hash.slice(1))?location.hash.slice(1):available[0]||'products');
