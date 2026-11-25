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
const productFilters={products:'',inventory:''};
const genderFilters={products:'',inventory:''};
const sizeFilters={products:'',inventory:''};
const itemFilters={products:'',inventory:''},productSearch={products:'',inventory:''};
function categoryTable(host,products,section,draw){
 const filters=el('div',undefined,'toolbar category-filters'),genders=el('div',undefined,'toolbar category-filters gender-filters'),sizes=el('div',undefined,'toolbar category-filters size-filters'),list=el('div'),count=el('p',undefined,'muted'),buttons=[],genderButtons=[],sizeButtons=[];
 filters.setAttribute('role','group');filters.setAttribute('aria-label','فیلتر دسته‌بندی محصولات');
 genders.setAttribute('role','group');genders.setAttribute('aria-label','فیلتر پوشاک مردانه و زنانه');
 sizes.setAttribute('role','group');sizes.setAttribute('aria-label','فیلتر سایز پوشاک');sizes.append(el('span','سایز:','muted'));
 const finder=el('div',undefined,'toolbar product-finder'),search=el('input'),picker=el('select'),reset=el('button','پاک‌کردن فیلترها');
 search.type='search';search.placeholder='جست‌وجوی نام محصول یا شناسهٔ انبار…';search.setAttribute('aria-label','جست‌وجوی نام فارسی، انگلیسی یا شناسهٔ انبار');search.value=productSearch[section];picker.setAttribute('aria-label','انتخاب محصول');reset.type='button';finder.append(search,picker,reset);
 const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[۰-۹٠-٩]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).trim();
 const render=()=>{const category=productFilters[section],gender=genderFilters[section],size=sizeFilters[section];let items=products.filter(p=>(!category||(p.parentCategory||p.category)===category)&&(!gender||p.gender===gender));if(size)items=items.map(p=>({...p,variants:p.variants.filter(v=>v.size===size)})).filter(p=>p.variants.length);
  const words=normalize(productSearch[section]).split(/\s+/).filter(Boolean);items=items.filter(p=>words.every(word=>normalize([p.title,p.name,...p.variants.map(v=>v.sku)].join(' ')).includes(word)));
  if(itemFilters[section]&&!items.some(p=>String(p.id)===itemFilters[section]))itemFilters[section]='';
  picker.replaceChildren();const all=el('option','همهٔ محصولات');all.value='';picker.append(all);items.forEach(p=>{const option=el('option',p.title+(p.gender==='men'?' · Men’s':p.gender==='women'?' · Women’s':''));option.value=String(p.id);picker.append(option);});picker.value=itemFilters[section];if(itemFilters[section])items=items.filter(p=>String(p.id)===itemFilters[section]);
  buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===category)));genderButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gender===gender)));sizeButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.size===size)));count.textContent=fa(items.length)+' محصول';list.replaceChildren();draw(list,items);};
 search.addEventListener('input',()=>{productSearch[section]=search.value;render();});picker.addEventListener('change',()=>{itemFilters[section]=picker.value;render();});reset.addEventListener('click',()=>{productFilters[section]='';genderFilters[section]='';sizeFilters[section]='';itemFilters[section]='';productSearch[section]='';search.value='';render();});
 for(const [value,label] of [['','همه'],['gear','Gear'],['clothing','Clothing'],['supplements','Supplements']]){const button=el('button',label);button.type='button';button.dataset.category=value;button.addEventListener('click',()=>{productFilters[section]=value;if(value!=='clothing'){genderFilters[section]='';sizeFilters[section]='';}render();});buttons.push(button);filters.append(button);}
 for(const [value,label] of [['','همه'],['men',"Men’s"],['women',"Women’s"]]){const button=el('button',label);button.type='button';button.dataset.gender=value;button.addEventListener('click',()=>{genderFilters[section]=value;if(value)productFilters[section]='clothing';render();});genderButtons.push(button);genders.append(button);}
 const sizeOrder=['XXXS','XXS','XS','S','M','L','XL','XXL','2XL','XXXL','3XL','4XL','5XL'];
 const availableSizes=[...new Set(products.filter(p=>(p.parentCategory||p.category)==='clothing').flatMap(p=>p.variants.map(v=>v.size)).filter(Boolean))].sort((a,b)=>{const ai=sizeOrder.indexOf(a.toUpperCase()),bi=sizeOrder.indexOf(b.toUpperCase());return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b,undefined,{numeric:true});});
 for(const value of ['',...availableSizes]){const button=el('button',value||'همهٔ سایزها');button.type='button';button.dataset.size=value;if(value)button.dir='ltr';button.addEventListener('click',()=>{sizeFilters[section]=value;if(value)productFilters[section]='clothing';render();});sizeButtons.push(button);sizes.append(button);}
 host.append(filters,genders,sizes,finder,count,list);render();
}
async function page(name){
 const current=++generation;document.querySelector('#page-title').textContent=titles[name];content.replaceChildren();statusLine.className='';statusLine.textContent='در حال دریافت اطلاعات…';document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
 try{
  const result=await api(name==='reports'?'dashboard':name==='inventory'?'products':name);if(current!==generation)return;
  if(['products','inventory'].includes(name)&&result.total!==undefined){while(result.products.length<result.total){const more=await api('products?offset='+result.products.length);if(current!==generation)return;if(!more.products.length)break;result.products.push(...more.products);result.total=more.total;}}
  statusLine.textContent='';
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
   const host=box('محصولات و گونه‌ها');host.append(action('افزودن محصول','/admin/shop/product/add/'));categoryTable(host,result.products,'products',(list,items)=>table(list,['محصول','گروه','گونه‌ها','وضعیت',''],items.map(p=>[p.title,p.gender||p.category,fa(p.variants.length),p.isDemo?'نمونه':p.active?'فعال':'پیش‌نویس',action('ویرایش و گالری','/admin/shop/product/'+p.id+'/change/')])));
  }
  if(name==='inventory'){
   categoryTable(box('تعیین موجودی قابل فروش'),result.products,'inventory',(list,items)=>{const showGender=!genderFilters.inventory&&items.some(p=>['men','women'].includes(p.gender));return table(list,['محصول','شناسه انبار',...(showGender?['گروه پوشاک']:[]),'رنگ / اندازه','موجودی',''],items.flatMap(p=>p.variants.map(v=>{const b=el('button','تعیین موجودی');b.addEventListener('click',async()=>{const input=prompt('موجودی نهایی قابل فروش را وارد کنید؛ برای ناموجودشدن محصول، ۰ وارد کنید. موجودی فعلی: '+fa(v.stock),String(v.stock));if(input===null||input.trim()==='')return;const digits=input.trim().replace(/[۰-۹٠-٩]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c));if(!/^\d+$/.test(digits)||!Number.isSafeInteger(Number(digits))){alert('موجودی باید عدد صحیح صفر یا بیشتر باشد.');return;}const stock=Number(digits),delta=stock-v.stock;if(!delta){statusLine.textContent='موجودی از قبل همین مقدار است.';return;}if(Math.abs(delta)>100000){alert('در هر مرحله حداکثر ۱۰۰٬۰۰۰ عدد تغییر مجاز است.');return;}if(!confirm('موجودی '+v.sku+' از '+fa(v.stock)+' به '+fa(stock)+' تغییر کند؟'))return;b.disabled=true;try{await api('inventory/'+v.id+'/adjust',{delta,expectedStock:v.stock});await page('inventory');statusLine.textContent='موجودی نهایی ثبت شد.';}catch(e){statusLine.className='error';statusLine.textContent=e.message;b.disabled=false;}});return[p.title,v.sku,...(showGender?[p.gender==='men'?"Men’s":p.gender==='women'?"Women’s":'—']:[]),[v.color,v.size].join(' / '),fa(v.stock),b];})));});
  }
  if(name==='customers'){table(box('فهرست مشتریان'),['نام','موبایل تأییدشده','تاریخ عضویت','وضعیت',''],result.customers.map(c=>[c.display_name||'ثبت نشده',c.mobile||'—',new Date(c.date_joined).toLocaleDateString('fa-IR'),c.is_active?'فعال':'مسدود',action('پرونده مشتری','/admin/shop/customer/'+c.id+'/change/')]));}
  if(name==='events'){table(box('رویدادها بدون ثبت کلید و محتوای حساس'),['رویداد','شناسه مرتبط','زمان'],result.events.map(e=>[e.action,e.target,new Date(e.created_at).toLocaleString('fa-IR')]));}
  if(name==='settings'){
   if(result.localMapSetupAvailable)content.append(action('تنظیم کلید سرویس نشانی نشان','/local-map-setup/'));
   const host=box('تنظیمات عمومی'),form=el('form',undefined,'settings-form');const label=(text,input)=>{const l=el('label',text);l.append(input);form.append(l);};const n=el('input');n.value=result.settings.name||'FitNestPro';n.required=true;n.maxLength=100;label('نام فروشگاه',n);const tax=el('input');tax.type='number';tax.min=0;tax.max=10000;tax.value=result.settings.taxBps||0;label('مالیات بر حسب صدم درصد؛ ۹۰۰ یعنی ۹ درصد',tax);const enabled=el('input');enabled.type='checkbox';enabled.checked=result.settings.orderingEnabled;label('پذیرش سفارش؛ پرداخت تا اتصال درگاه همچنان غیرفعال است',enabled);const save=el('button','ذخیرهٔ تنظیمات');save.type='submit';form.append(save);form.addEventListener('submit',async e=>{e.preventDefault();if(!confirm('ذخیرهٔ تنظیمات را تأیید می‌کنید؟'))return;save.disabled=true;try{await api('settings',{name:n.value,taxBps:Number(tax.value),orderingEnabled:enabled.checked},'PATCH');statusLine.className='success';statusLine.textContent='تنظیمات ذخیره شد.';}catch(err){statusLine.className='error';statusLine.textContent=err.message;}finally{save.disabled=false;}});host.append(form);
   const external=box('اتصال‌ها');external.append(el('p','پیامک: '+(result.smsEnabled?'فعال در تنظیمات سرور':'غیرفعال')),el('p','پرداخت: متصل نشده؛ موفقیت آزمایشی به سفارش واقعی اعمال نمی‌شود.'),el('p','کلیدها فقط از متغیر محیطی سرور خوانده می‌شوند.'));table(external,['روش ارسال','هزینه','وضعیت'],result.shipping.map(s=>[s.name,s.quote_required?'نیازمند استعلام':money(s.fee),s.active?'فعال':'غیرفعال']));external.append(action('ویرایش روش ارسال','/admin/shop/shippingmethod/'));
  }
 }catch(error){if(current===generation){statusLine.className='error';statusLine.textContent=error.message;const retry=el('button','تلاش دوباره');retry.addEventListener('click',()=>page(name));content.append(retry);}}
}
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{history.replaceState(null,'','#'+button.dataset.page);page(button.dataset.page);}));
const available=[...document.querySelectorAll('[data-page]')].map(x=>x.dataset.page);page(available.includes(location.hash.slice(1))?location.hash.slice(1):available[0]||'products');
