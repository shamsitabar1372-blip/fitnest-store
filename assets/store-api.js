/* Django storefront adapter. The old static preview remains independent. */
'use strict';
if(document.documentElement.dataset.storeApi==='true'){
 const state={catalog:[],cart:{items:[],subtotal:0},profile:{name:'',mobile:'',addresses:[]},orders:[],reviews:[],shipping:[],quote:null,quoteRevision:0,ready:false};
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=amount=>formatToman(amount/10);
 const csrfToken=()=>document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10)||'';
 async function api(path,data,method='POST'){
  let response;try{response=await fetch('/api/'+path,{method:data===undefined?'GET':method,credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json','X-CSRFToken':csrfToken()},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)});}catch{throw Error('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.');}
  let result;try{result=await response.json();}catch{throw Error('سرویس فروشگاه پاسخ معتبر نداد.');}if(!response.ok)throw Error(result.message||'درخواست انجام نشد.');return result;
 }
 const notify=message=>{cartStatus.textContent=message;profileStatus.textContent=message;profileStatus.hidden=false;};
 const frontProduct=p=>({id:p.id,category:p.parentCategory,name:p.name,english:String(p.title).replace(/[<>"`\\]/g,''),gender:p.gender||null,subtitle:p.description,supplementCategory:p.category,mark:String(p.attributes.mark||'').replace(/[^A-Z0-9 -]/g,''),tag:'نمونه',inStock:p.variants.some(v=>v.stock>0),server:p});
 const findProduct=(title,gender)=>products.find(p=>p.english===title&&(!gender||p.gender===gender));
 const defaultVariant=p=>p?.server?.variants.find(v=>v.stock>0)||p?.server?.variants[0];
 const selectedVariant=()=>activeProduct?.category==='clothing'?activeProduct.server.variants.find(v=>v.color===document.getElementById('clothing-color').value&&v.size===document.getElementById('clothing-size').value):defaultVariant(activeProduct);
 function applyCart(data){state.cart=data;cartItems=data.items.map(i=>({...i,variantId:i.variantId}));cartCode=data.items.length?'سبد ذخیره‌شده در سرور':'';updateCartView();if(data.pendingOrder)cartStatus.textContent='سفارش '+data.pendingOrder.code+' در انتظار پرداخت است؛ سبد محفوظ مانده است.';}
 async function refreshAccount(){
  if(!authenticatedUser)return;
  const [p,a,o,r]=await Promise.all([api('profile'),api('addresses'),api('orders'),api('reviews')]);
  state.profile={name:p.user.name,mobile:p.user.mobile,addresses:a.addresses,selectedAddressId:a.addresses.find(x=>x.selected)?.id};state.orders=o.orders;state.reviews=r.reviews;
  savedAddresses=a.addresses;selectedAddressId=state.profile.selectedAddressId??null;accountIdentity={name:p.user.name,mobile:p.user.mobile};
 }
 // The server session owns carts; browser identifiers and stored prices are never imported.
 readAccountData=()=>({...state.profile,addresses:state.profile.addresses.slice()});
 writeAccountData=()=>{throw Error('برای ذخیرهٔ اطلاعات از فرم متصل به سرور استفاده کنید.');};
 migrateLegacyCart=()=>{};
 switchCartOwner=()=>{cartItems=[];updateCartView();api('cart').then(applyCart).catch(e=>notify(e.message));};
 transferGuestCart=()=>switchCartOwner();
 authApi=async(path,data)=>{const result=await api('auth/'+path,data);if(path==='verify'){authenticatedUser=result.user;await refreshAccount();}if(path==='logout')document.getElementById('local-test-banner')?.remove();return result;};
 const acceptRealUser=acceptVerifiedUser;
 acceptVerifiedUser=(user,mergeGuest=false)=>{
  if(user?.isTest!==true){document.getElementById('local-test-banner')?.remove();return acceptRealUser(user,mergeGuest);}
  if(!/^[a-f0-9]{32}$/.test(user.id)||user.mobile!==null)throw Error('پاسخ حساب آزمایشی معتبر نیست.');
  authenticatedUser=user;accountIdentity={name:state.profile.name||'مشتری آزمایشی محلی',mobile:''};savedAddresses=state.profile.addresses;
  document.getElementById('account-mobile').readOnly=true;document.getElementById('account-mobile').placeholder='شماره در حالت آزمایشی تأیید نشده است';
  profileToggle.classList.add('is-signed-in');profileToggle.setAttribute('aria-label','حساب مشتری آزمایشی محلی');document.getElementById('profile-icon').innerHTML=iconMarkup.profileActive;
  profileRegister.hidden=true;profileWelcome.hidden=true;profileSuccess.hidden=false;syncProfileLinks();
  document.getElementById('profile-success-title').textContent='حساب مشتری آزمایشی';profileSuccess.querySelector('p').textContent='فقط برای آزمایش محلی؛ شمارهٔ موبایل تأیید نشده و پرداخت واقعی غیرفعال است.';
  if(!document.getElementById('local-test-banner')){const banner=node('p','حالت آزمایشی محلی · شمارهٔ موبایل تأیید نشده · پرداخت واقعی غیرفعال','local-test-banner');banner.id='local-test-banner';banner.setAttribute('role','status');document.querySelector('main').before(banner);}
  authMessage('وارد حساب آزمایشی محلی شدید.');switchCartOwner();if(pendingCheckout)openCheckout();
 };
 function enableLocalTestLogin(){
  for(const host of [profileWelcome,profileRegister]){
   const existing=host.querySelector('.local-test-entry');if(existing){existing.hidden=false;continue;}
   const group=node('div',undefined,'local-test-entry'),button=node('button','ورود آزمایشی محلی','local-test-login');button.type='button';
   group.append(node('p','مخصوص مدیر این سیستم؛ بدون پیامک و بدون تأیید شماره. ورود، حساب همین مرورگر را به مشتری آزمایشی تغییر می‌دهد.'),button);
   button.addEventListener('click',async()=>{button.disabled=true;try{const result=await api('auth/local-test',{});authenticatedUser=result.user;await refreshAccount();acceptVerifiedUser(result.user);document.querySelectorAll('.local-test-entry').forEach(entry=>entry.hidden=true);}catch(error){authMessage(error.message,true);}finally{button.disabled=false;}});
   host.append(group);
  }
 }
 profileToggle.addEventListener('click',()=>{api('auth/session').then(result=>{if(result.localTestLoginAvailable)enableLocalTestLogin();else document.querySelectorAll('.local-test-entry').forEach(entry=>entry.hidden=true);}).catch(()=>{});});
 const originalLoad=loadAccountFields;
 loadAccountFields=()=>{originalLoad();document.getElementById('account-contact-status').textContent='اطلاعات در حساب شما روی سرور ذخیره می‌شود.';if(authenticatedUser)refreshAccount().then(()=>{originalLoad();document.getElementById('account-contact-status').textContent='اطلاعات حساب از سرور دریافت شد.';}).catch(e=>notify(e.message));};
 function cartTitle(item){return [item.gender==='men'?"MEN'S":item.gender==='women'?"WOMEN'S":'',item.title].filter(Boolean).join(' ');}
 updateCartView=()=>{
  cartCount=cartItems.reduce((sum,i)=>sum+i.quantity,0);cartButton.classList.toggle('has-items',cartCount>0);cartButton.setAttribute('aria-label','سبد خرید، '+faDigits(cartCount)+' کالا');cartCountLabel.textContent=faDigits(cartCount);cartTotalElement.textContent=money(state.cart.subtotal);cartCheckoutButton.disabled=!cartCount;
  document.getElementById('cart-code-row').hidden=true;cartItemsElement.replaceChildren();
  if(!cartItems.length)cartItemsElement.append(node('p',state.ready?'سبد خرید شما خالی است.':'در حال دریافت سبد خرید…','cart-empty'));
  for(const item of cartItems){
   const row=node('article',undefined,'cart-line'),copy=node('div',undefined,'cart-line-copy'),tools=node('div',undefined,'cart-line-tools');
   copy.append(node('small',item.category==='clothing'?(item.gender==='men'?"Men's Clothing":"Women's Clothing"):item.category),node('strong',item.title),node('span',[item.color,item.size].filter(Boolean).join(' · '),'cart-line-price'),node('span',money(item.unitPrice)+' برای هر عدد','cart-line-price'));
   if(!item.available)copy.append(node('small','موجودی تغییر کرده؛ گزینه یا تعداد را اصلاح کنید.'));
   for(const [text,delta] of [['−',-1],['+',1],['حذف',-item.quantity]]){const removing=text==='حذف',b=node('button',removing?undefined:text,removing?'cart-remove-icon':'cart-quantity-button');b.type='button';b.setAttribute('aria-label',(removing?'حذف از سبد خرید: ':text+' ')+item.title);if(removing){b.title='حذف از سبد خرید';b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6h18M9 6V4h6v2M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';}b.addEventListener('click',async()=>{b.disabled=true;try{applyCart(await api('cart',{variantId:item.variantId,quantity:item.quantity+delta}));cartStatus.textContent=removing?'محصول از سبد خرید حذف شد.':'سبد روی سرور ذخیره شد.';}catch(e){cartStatus.textContent=e.message;b.disabled=false;}});if(text==='+')tools.append(node('output',faDigits(item.quantity),'cart-quantity'));tools.append(b);}
   row.append(copy,tools);cartItemsElement.append(row);
  }
  updateCheckoutReview();
 };
 addToCart=async(title,quantity=1,gender=null,color='',size='')=>{
  try{if(!state.ready)throw Error('دریافت اطلاعات فروشگاه هنوز کامل نشده است.');const p=findProduct(title,gender),v=p?.category==='clothing'?p.server.variants.find(x=>x.color===color&&x.size===size):defaultVariant(p);if(!v)throw Error('ابتدا رنگ و اندازه را انتخاب کنید.');if(v.stock<1)throw Error('این محصول ناموجود است.');const old=state.cart.items.find(i=>i.variantId===v.id);applyCart(await api('cart',{variantId:v.id,quantity:(old?.quantity||0)+quantity}));closeProductModal();openCart();cartStatus.textContent='محصول به سبد ذخیره‌شده در سرور اضافه شد.';}catch(e){notify(e.message);productModalStatus.textContent=e.message;}
 };
 updateClothingStock=()=>{if(activeProduct?.category!=='clothing')return;const v=selectedVariant(),available=Boolean(v&&v.stock>0);const text=!v?'رنگ و اندازه را انتخاب کنید.':available?'موجود · '+money(v.price):'این گزینه ناموجود است.';document.getElementById('clothing-stock').textContent=text;productModalStatus.textContent=text;productModalStatus.classList.toggle('is-unavailable',!available);productModalAdd.disabled=!available;};
 ['clothing-color','clothing-size'].forEach(id=>document.getElementById(id).addEventListener('change',()=>updateClothingStock()));
 const oldModal=openProductModal;
 openProductModal=(product,trigger)=>{
  const p=findProduct(product.english,product.gender);if(!p)return;
  oldModal(p,trigger);document.getElementById('clothing-demo-note').hidden=!p.server.isDemo;
  if(p.category==='clothing'){
   for(const [id,key,label] of [['clothing-color','color','انتخاب رنگ'],['clothing-size','size','انتخاب اندازه']]){const select=document.getElementById(id);select.replaceChildren(new Option(label,''));[...new Set(p.server.variants.map(v=>v[key]))].forEach(v=>select.add(new Option(v,v)));}
   const rows=document.getElementById('clothing-size-rows');rows.replaceChildren();const sizes=p.server.attributes.sizeChart||[];
   if(Array.isArray(sizes))sizes.slice(0,20).forEach(row=>{const tr=node('tr');[row.size,row.width,row.length].forEach(v=>tr.append(node('td',String(v??'—'))));rows.append(tr);});
   const specs=document.getElementById('clothing-specs');specs.replaceChildren();for(const [key,value] of Object.entries(p.server.attributes).filter(([key,value])=>!['sizeChart','mark','tag'].includes(key)&&typeof value==='string'))specs.append(node('li',key+' : '+value));
   if(!specs.childElementCount)specs.append(node('li','مشخصات تکمیلی این محصول هنوز ثبت نشده است.'));updateClothingStock();
  }else{const v=defaultVariant(p),available=Boolean(v&&v.stock>0);productModalStatus.textContent=available?'موجود · '+money(v.price):'ناموجود';productModalStatus.classList.toggle('is-unavailable',!available);productModalAdd.disabled=!available;}
  const nutrition=document.getElementById('product-nutrition-panel');if(p.category==='supplements'){const facts=p.server.attributes.nutrition;nutrition.hidden=!facts;if(facts){const keys=['calories','protein','carbohydrates','sugars','fat','servingSize'];nutrition.querySelectorAll('li b').forEach((value,index)=>value.textContent=String(facts[keys[index]]??'ثبت نشده'));}}
  const images=p.server.images,thumbs=document.getElementById('product-modal-thumbnails');thumbs.replaceChildren();
  if(images.length){
   const show=index=>{const image=images[index],img=node('img');img.src=image.path;img.alt=image.alt||p.english;img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';productModalMedia.replaceChildren(img);[...thumbs.children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));};
   images.forEach((image,index)=>{const label=image.alt||p.english+' · تصویر '+faDigits(index+1),b=node('button',undefined,'product-modal-thumb'),preview=node('img');b.type='button';b.setAttribute('aria-label','نمایش '+label);b.title=label;preview.src=image.path;preview.alt='';preview.loading='lazy';preview.decoding='async';b.append(preview);b.addEventListener('click',()=>show(index));thumbs.append(b);});show(0);
  }
 };
 function productCard(p){
  const card=node('article',undefined,'product-card'),photo=node('div',undefined,'product-photo product-photo--'+p.category);photo.tabIndex=0;photo.setAttribute('role','button');photo.setAttribute('aria-label','جزئیات '+p.english);photo.dataset.openProduct=p.english;photo.dataset.gender=p.gender||'';
  if(p.server.images.length){const img=node('img');img.src=p.server.images[0].path;img.alt=p.server.images[0].alt;img.loading='lazy';img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';photo.append(img);}else{const object=node('div',undefined,'product-object');object.append(node('span',p.mark||p.english));photo.append(object);}
  const info=node('div',undefined,'product-info');info.dir='ltr';info.append(node('div',p.category==='clothing'?(p.gender==='men'?"MEN'S SPORTSWEAR":"WOMEN'S SPORTSWEAR"):p.category.toUpperCase(),'product-brand'),node('h3',p.english,'product-title'),node('div',p.subtitle,'product-subtitle'));
  const bottom=node('div',undefined,'product-bottom'),priceEl=node('span',undefined,'product-price');priceEl.lang='fa';priceEl.dir='rtl';
  if(p.server.variants.length){const amount=node('bdi',tomanFormatter.format(Math.min(...p.server.variants.map(v=>v.price))/10),'product-price-amount');amount.dir='ltr';priceEl.append(amount,node('span','تومان','product-price-currency'));}
  else{priceEl.textContent='قیمت ثبت نشده';priceEl.classList.add('product-price--empty');}bottom.append(priceEl);
  if(p.server.isDemo)bottom.append(node('small','نمونه؛ قابل فروش واقعی نیست'));
  if(p.category!=='clothing'){const stock=node('span',p.inStock?'موجود':'ناموجود','stock-status '+(p.inStock?'stock-status--available':'stock-status--unavailable'));stock.lang='fa';stock.dir='rtl';bottom.append(stock);}
  const add=node('button','افزودن به سبد خرید','add-button');add.type='button';add.dataset.add=p.english;add.dataset.gender=p.gender||'';add.disabled=p.category!=='clothing'&&!p.inStock;bottom.append(add);info.append(bottom);card.append(photo,info);return card;
 }
 drawProducts=()=>{
  const grids=isClothingCatalog?{catalog:'catalog-grid'}:productGrids;
  for(const [key,id] of Object.entries(grids)){
   const host=document.getElementById(id),clothing=['clothing','womensClothing','catalog'].includes(key),gender=key==='catalog'?catalogGender:key==='womensClothing'?'women':'men';host.replaceChildren();
   let list=products.filter(p=>(clothing?p.category==='clothing'&&p.gender===gender:p.category===key)&&(p.category!=='supplements'||activeSupplementCategory==='all'||p.supplementCategory===activeSupplementCategory)&&(key!=='catalog'||clothingTypeFilter==='all'||p.mark===clothingTypeFilter));
   if(clothing&&key!=='catalog')list=list.slice(0,4);host.classList.toggle('clothing-showcase',clothing&&key!=='catalog');
   list.forEach((p,i)=>{host.append(productCard(p));if(i===1&&clothing&&key!=='catalog'){const a=node('a','دیدن همه محصولات','clothing-view-all');a.href='index.html?clothing='+gender;host.append(a);}});
   if(key==='catalog')document.getElementById('catalog-count').textContent=faDigits(list.length)+' محصول';if(!list.length)host.append(node('p',state.ready?'محصولی در این دسته ثبت نشده است.':'در حال دریافت محصولات…','product-subtitle'));
  }
 };
 searchMatches=term=>{const words=term.trim().toLowerCase().split(/\s+/).filter(Boolean);return words.length?products.filter(p=>words.every(word=>['men',"men's",'مردانه'].includes(word)?p.gender==='men':['women',"women's",'زنانه'].includes(word)?p.gender==='women':[p.english,p.name,p.category,p.gender,p.subtitle].join(' ').toLowerCase().includes(word))).slice(0,30):[];};
 // Replace account form handlers in the capture phase, before their preview-only handlers.
 accountForm.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();if(!accountForm.reportValidity())return;const status=document.getElementById('account-contact-status');status.textContent='در حال ذخیره…';try{await api('profile',{name:document.getElementById('account-name').value},'PATCH');await refreshAccount();status.textContent='اطلاعات روی سرور ذخیره شد.';}catch(error){status.textContent=error.message;}},true);
 addressForm.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();if(!addressForm.reportValidity())return;const data=Object.fromEntries(new FormData(addressForm));if(pickedCoordinates)data.coordinates=pickedCoordinates;const status=document.getElementById('account-map-status');status.textContent='در حال ذخیرهٔ نشانی…';try{const result=await api('addresses'+(editingAddressId?'/'+editingAddressId:''),data,editingAddressId?'PATCH':'POST');state.profile.addresses=result.addresses;savedAddresses=result.addresses;selectedAddressId=savedAddresses.find(a=>a.selected)?.id??null;state.profile.selectedAddressId=selectedAddressId;closeAddressEditor();document.getElementById('address-book-status').textContent='نشانی روی سرور ذخیره شد.';}catch(error){status.textContent=error.message;}},true);
 addressList.addEventListener('click',async e=>{const b=e.target.closest('[data-select-address]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();try{const data=await api('addresses/'+b.dataset.selectAddress,{select:true},'PATCH');state.profile.addresses=data.addresses;savedAddresses=data.addresses;selectedAddressId=b.dataset.selectAddress;state.profile.selectedAddressId=selectedAddressId;renderAddressList();}catch(error){notify(error.message);}},true);
 updateCheckoutReview=()=>{
  if(!checkoutMode)return;resetCheckoutConfirmation();state.quote=null;state.quoteRevision++;
  const a=savedAddresses.find(a=>a.id===selectedAddressId);document.getElementById('checkout-address-summary').textContent=a?[a.province,a.city,a.street,'پلاک '+a.plate,'واحد '+a.unit].join('، '):'نشانی تحویل را انتخاب کنید.';
  const lines=document.getElementById('checkout-lines');lines.replaceChildren();cartItems.forEach(i=>{const row=node('div',undefined,'checkout-line');row.append(node('strong',cartTitle(i)),node('span',faDigits(i.quantity)+' × '+money(i.unitPrice)));lines.append(row);});
  document.getElementById('checkout-count').textContent=faDigits(cartCount);document.getElementById('checkout-total').textContent='در انتظار محاسبهٔ ارسال';document.getElementById('checkout-cart-code').textContent='پس از ثبت سفارش صادر می‌شود';
  let controls=document.getElementById('server-checkout-controls');if(!controls){controls=node('div');controls.id='server-checkout-controls';const shipping=node('select');shipping.id='server-shipping';shipping.setAttribute('aria-label','روش ارسال');shipping.addEventListener('change',()=>updateCheckoutReview());const apply=node('button','محاسبهٔ نهایی');apply.id='server-quote-button';apply.type='button';apply.addEventListener('click',requestQuote);const message=node('p',undefined,'checkout-quote-feedback');message.id='server-quote-status';message.setAttribute('role','status');message.setAttribute('aria-live','polite');controls.append(node('p','روش ارسال'),shipping,apply,message);lines.after(controls);}
  const select=controls.querySelector('select'),previousShipping=select.value;select.replaceChildren();select.add(new Option('انتخاب روش ارسال',''));state.shipping.forEach(s=>{if(!s.quote_required)select.add(new Option(s.name+' · '+money(s.fee),s.id));});if([...select.options].some(o=>o.value===previousShipping))select.value=previousShipping;
  const shippingReady=state.shipping.some(s=>!s.quote_required);select.disabled=!shippingReady;document.getElementById('server-quote-status').textContent=shippingReady?'روش ارسال را انتخاب کنید و محاسبهٔ نهایی را بزنید.':'محاسبهٔ نهایی هنوز ممکن نیست: روش ارسال و هزینهٔ آن در تنظیمات فروشگاه فعال نشده است. تیک تأیید پس از محاسبهٔ موفق فعال می‌شود.';
  document.getElementById('checkout-confirm').disabled=true;document.getElementById('checkout-finalize').disabled=true;document.getElementById('checkout-finalize').textContent='ثبت سفارش و ادامهٔ پرداخت';
  document.getElementById('checkout-status').textContent=state.cart.pendingOrder?'سفارش '+state.cart.pendingOrder.code+' در انتظار پرداخت است. برای مشاهده یا لغو به تاریخچهٔ سفارش‌ها بروید.':'درگاه پرداخت غیرفعال است. ثبت سفارش نیز به فعال‌بودن فروشگاه و هزینهٔ مشخص ارسال نیاز دارد.';
 };
 async function requestQuote(){
  const revision=++state.quoteRevision,button=document.getElementById('server-quote-button'),feedback=document.getElementById('server-quote-status'),confirmation=document.getElementById('checkout-confirm');
  state.quote=null;confirmation.checked=false;confirmation.disabled=true;document.getElementById('checkout-finalize').disabled=true;
  const report=message=>{feedback.textContent=message;document.getElementById('checkout-status').textContent=message;};
  button.disabled=true;button.textContent='در حال محاسبه…';report('در حال بررسی مبلغ، موجودی و هزینهٔ ارسال…');
  try{
   if(state.cart.pendingOrder)throw Error('ابتدا سفارش در انتظار پرداخت را از تاریخچه مدیریت کنید.');
   if(!selectedAddressId)throw Error('ابتدا نشانی تحویل را انتخاب کنید.');
   if(!state.shipping.some(s=>!s.quote_required))throw Error('هیچ روش ارسال با هزینهٔ مشخص فعال نیست. مدیر فروشگاه باید روش ارسال و هزینهٔ آن را تنظیم و فعال کند.');
   const input={addressId:selectedAddressId,shippingId:Number(document.getElementById('server-shipping').value)};
   if(!input.shippingId)throw Error('روش ارسال را از فهرست انتخاب کنید.');
   const data=await api('checkout/quote',input);if(revision!==state.quoteRevision)return;
   state.quote={...input,amount:data.quote.total,key:crypto.randomUUID()};document.getElementById('checkout-total').textContent=money(data.quote.total);report('مبلغ نهایی محاسبه شد. اکنون می‌توانید تیک تأیید آدرس و سفارش را بزنید. درگاه پرداخت هنوز غیرفعال است.');confirmation.disabled=false;
  }catch(error){if(revision===state.quoteRevision){report(error.message);feedback.scrollIntoView({block:'nearest'});}}
  finally{button.disabled=false;button.textContent='محاسبهٔ نهایی';}
 }
 document.getElementById('checkout-finalize').addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();const q=state.quote;if(!q||!document.getElementById('checkout-confirm').checked)return;const button=e.currentTarget;button.disabled=true;try{const data=await api('orders/create',{addressId:q.addressId,shippingId:q.shippingId,idempotencyKey:q.key});const o=data.order;document.getElementById('checkout-status').textContent='سفارش '+o.code+' در انتظار پرداخت ثبت شد. هیچ پرداختی انجام نشده و درگاه غیرفعال است.';state.quote=null;state.orders.unshift(o);applyCart(await api('cart'));}catch(error){document.getElementById('checkout-status').textContent=error.message;button.disabled=false;}},true);
 const priorMapKey=readNeshanKey;readNeshanKey=key=>key===NESHAN_SERVICE_KEY_STORAGE?'':priorMapKey(key);
 document.getElementById('address-line').placeholder='پس از انتخاب نقطه روی نقشه، نشانی اینجا نمایش داده می‌شود';
 document.getElementById('map-picker-confirm').addEventListener('click',async event=>{
  event.preventDefault();event.stopImmediatePropagation();if(!draftCoordinates)return;
  const point=pickedCoordinates={...draftCoordinates},status=document.getElementById('account-map-status');
  const province=addressForm.elements.namedItem('province'),city=addressForm.elements.namedItem('city'),street=addressForm.elements.namedItem('street');
  if(mapPlace?.province)province.value=mapPlace.province;if(mapPlace?.city)city.value=mapPlace.city;
  const previous=[province.value,city.value,street.value];closeMapPicker();const session=mapSession;
  status.textContent='موقعیت روی نقشه ثبت شد.';focusAddressDetails('address-line');
  status.textContent='موقعیت ثبت شد؛ در حال دریافت نشانی…';
  try{
   const result=await api('maps/reverse',{lat:point.lat,lng:point.lng});
   if(mapSession!==session||addressForm.hidden||pickedCoordinates!==point)return;
   [province,city,street].forEach((field,index)=>{const value=result.address[['province','city','street'][index]];if(value&&field.value===previous[index])field.value=value;});
   status.textContent='موقعیت و نشانی دریافت شد؛ متن نشانی را بررسی و پلاک، واحد و کد پستی را تکمیل کنید.';
  }catch(error){if(mapSession===session&&!addressForm.hidden&&pickedCoordinates===point)status.textContent=error.message;}
 },true);
 function enableLocalMapWebSetup(){
  if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))return;
  document.documentElement.classList.add('local-map-web-setup');
  mapKeySetup.querySelector('p').textContent='تنظیم نقشه در این مرورگر: فقط کلید «نقشه وب» نشان را وارد کنید. کلید سرویس‌ها را اینجا وارد نکنید.';
  const privateInput=document.getElementById('neshan-service-key');privateInput.value='';privateInput.disabled=true;privateInput.hidden=true;
  const webInput=document.getElementById('neshan-map-key');webInput.placeholder='کلید نقشه وب نشان (web.…)';webInput.value=readNeshanKey(NESHAN_MAP_KEY_STORAGE);
  const save=document.getElementById('save-neshan-key');save.textContent='ذخیره و نمایش نقشه';
  mapPicker.querySelector('.map-picker-head').after(mapKeySetup);
  if(!document.getElementById('local-map-service-setup')){const link=node('a','تنظیم کلید سرویس تبدیل موقعیت به نشانی (ورود مدیر)');link.id='local-map-service-setup';link.href='/local-map-setup/';link.target='_blank';link.rel='noopener';mapKeySetup.append(link);}
  save.addEventListener('click',async event=>{
   event.preventDefault();event.stopImmediatePropagation();const key=webInput.value.trim();
   if(!key.startsWith('web.')||key.length>512){showMapMessage('کلید «نقشه وب» را از پنل نشان کپی کنید؛ کلید سرویس‌ها مناسب این کادر نیست.');webInput.focus();return;}
   save.disabled=true;
   try{localStorage.setItem(NESHAN_MAP_KEY_STORAGE,key);if(accountMap){accountMap.remove();accountMap=null;accountMarker=null;}await loadAddressMap(mapSession);}
   catch{showMapMessage('ذخیرهٔ کلید در مرورگر ممکن نشد.');}
   finally{save.disabled=false;}
  },true);
 }
 const preview=document.getElementById('checkout-success-preview');if(preview)preview.hidden=true;
 paidOrdersForAccount=()=>state.orders;
 renderOrderHistory=()=>{
  const host=document.getElementById('account-order-history');host.replaceChildren();visibleOrders=state.orders;
  if(!state.orders.length)host.append(node('p','هنوز سفارشی ثبت نشده است.','account-empty'));
  state.orders.forEach((o,index)=>{const card=node('article',undefined,'account-order-card');card.append(node('h3',o.code),node('p',o.statusLabel+' · '+new Date(o.createdAt).toLocaleDateString('fa-IR')));o.items.forEach(i=>{const row=node('div',undefined,'account-order-product');if(i.image){const img=node('img');img.src=i.image;img.alt=i.title;img.width=60;img.height=60;img.style.objectFit='contain';row.append(img);}row.append(node('strong',i.title),node('span',faDigits(i.quantity)+' عدد'));card.append(row);});const b=node('button','مشاهدهٔ فاکتور','account-invoice-open');b.type='button';b.dataset.invoiceIndex=String(index);card.append(b);if(o.status==='pending'){const cancel=node('button','لغو سفارش');cancel.type='button';cancel.addEventListener('click',async()=>{if(!confirm('سفارش لغو شود؟'))return;try{await api('orders/'+o.id+'/cancel',{});await refreshAccount();renderOrderHistory();}catch(e){notify(e.message);}});card.append(cancel);}host.append(card);});
 };
 openInvoice=async(order,trigger)=>{try{const data=await api('orders/'+order.id),o=data.order;const details=document.getElementById('invoice-details'),lines=document.getElementById('invoice-lines');details.replaceChildren();lines.replaceChildren();for(const [label,value] of [['کد سفارش',o.code],['وضعیت',o.statusLabel],['روش ارسال',o.shipping],['هزینه ارسال',money(o.shipping_fee)],['تخفیف',money(o.discount)],['مالیات',money(o.tax)]]){const field=node('div',undefined,'invoice-field');field.append(node('span',label),node('strong',value));details.append(field);}o.items.forEach(i=>{const row=node('li');row.append(node('strong',i.title+' × '+faDigits(i.quantity)),node('span',money(i.quantity*i.unitPrice)));lines.append(row);});document.getElementById('invoice-total-label').textContent='مبلغ نهایی سفارش';document.getElementById('invoice-products-total').textContent=money(o.total);document.getElementById('invoice-note').textContent=o.paidAt?'پرداخت این سفارش در سرور تأیید شده است.':'این سفارش پرداخت نشده است؛ فاکتور به معنی تأیید پرداخت نیست.';lastInvoiceFocus=trigger;invoiceBackdrop.classList.add('is-open');invoiceBackdrop.setAttribute('aria-hidden','false');profileBackdrop.inert=true;document.getElementById('invoice-close').focus();}catch(e){notify(e.message);}};
 renderReviewList=()=>{
  reviewList.replaceChildren();const bought=new Map();state.orders.filter(o=>o.status==='delivered').forEach(o=>o.items.forEach(i=>bought.set(i.productId,i)));
  if(!bought.size)reviewList.append(node('p','پس از تحویل سفارش می‌توانید برای محصول دیدگاه ثبت کنید.','account-empty'));
  bought.forEach((item,id)=>{const form=node('form',undefined,'account-review-card'),rating=node('select'),comment=node('textarea'),status=node('p');rating.setAttribute('aria-label','امتیاز محصول');rating.required=true;rating.add(new Option('انتخاب امتیاز',''));[1,2,3,4,5].forEach(n=>rating.add(new Option('★'.repeat(n),n)));comment.maxLength=2000;comment.required=true;comment.placeholder='تجربهٔ استفاده از محصول';const previous=state.reviews.find(r=>r.product_id===id);if(previous){rating.value=String(previous.rating);comment.value=previous.comment;}const save=node('button','ثبت امتیاز و دیدگاه');save.type='submit';if(item.image){const img=node('img');img.src=item.image;img.alt=item.title;img.width=70;img.height=70;form.append(img);}form.append(node('h3',item.title),rating,comment,save,status);form.addEventListener('submit',async e=>{e.preventDefault();e.stopPropagation();save.disabled=true;try{const saved=await api('reviews',{productId:id,rating:Number(rating.value),comment:comment.value});state.reviews=saved.reviews;status.textContent='دیدگاه ذخیره شد و پس از بررسی منتشر می‌شود.';}catch(error){status.textContent=error.message;}finally{save.disabled=false;}});reviewList.append(form);});
 };
 async function boot(){
  products.splice(0);cartItems=[];drawProducts();updateCartView();
  try{
   const session=await api('auth/session');state.mapsReady=Boolean(session.mapServicesAvailable);if(session.localTestLoginAvailable)enableLocalTestLogin();if(session.localTestLoginAvailable||session.user?.isTest)enableLocalMapWebSetup();let offset=0,all=[];for(;;){const data=await api('products?offset='+offset);all.push(...data.products);offset+=data.products.length;if(offset>=data.total||!data.products.length)break;}
   state.catalog=all;products.splice(0,products.length,...all.map(frontProduct));state.shipping=(await api('shipping')).methods;state.ready=true;
   if(session.authenticated){authenticatedUser=session.user;await refreshAccount();acceptVerifiedUser(session.user,false);}else authenticatedUser=null;
   applyCart(await api('cart'));drawProducts();
  }catch(error){state.ready=false;for(const id of (isClothingCatalog?['catalog-grid']:Object.values(productGrids))){const host=document.getElementById(id);host.replaceChildren(node('p',error.message,'product-subtitle'));const retry=node('button','تلاش دوباره');retry.addEventListener('click',boot);host.append(retry);}notify(error.message);}
 }
 boot();
}
