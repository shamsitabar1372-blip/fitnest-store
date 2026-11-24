/* Django storefront adapter. The old static preview remains independent. */
'use strict';
if(document.documentElement.dataset.storeApi==='true'){
 const state={catalog:[],cart:{items:[],subtotal:0},profile:{name:'',mobile:'',addresses:[]},orders:[],reviews:[],shipping:[],quote:null,ready:false};
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
 const selectedVariant=()=>activeProduct?.server?.variants.find(v=>activeProduct.category!=='clothing'||(v.color===document.getElementById('clothing-color').value&&v.size===document.getElementById('clothing-size').value));
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
 authApi=async(path,data)=>{const result=await api('auth/'+path,data);if(path==='verify'){authenticatedUser=result.user;await refreshAccount();}return result;};
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
   for(const [text,delta] of [['−',-1],['+',1],['حذف',-item.quantity]]){const b=node('button',text,'cart-quantity-button');b.type='button';b.setAttribute('aria-label',text+' '+item.title);b.addEventListener('click',async()=>{b.disabled=true;try{applyCart(await api('cart',{variantId:item.variantId,quantity:item.quantity+delta}));cartStatus.textContent='سبد روی سرور ذخیره شد.';}catch(e){cartStatus.textContent=e.message;b.disabled=false;}});if(text==='+')tools.append(node('output',faDigits(item.quantity),'cart-quantity'));tools.append(b);}
   row.append(copy,tools);cartItemsElement.append(row);
  }
  updateCheckoutReview();
 };
 addToCart=async(title,quantity=1,gender=null,color='',size='')=>{
  try{if(!state.ready)throw Error('دریافت اطلاعات فروشگاه هنوز کامل نشده است.');const p=findProduct(title,gender),v=p?.server.variants.find(x=>p.category!=='clothing'||(x.color===color&&x.size===size));if(!v)throw Error('ابتدا رنگ و اندازه را انتخاب کنید.');const old=state.cart.items.find(i=>i.variantId===v.id);applyCart(await api('cart',{variantId:v.id,quantity:(old?.quantity||0)+quantity}));closeProductModal();openCart();cartStatus.textContent='محصول به سبد ذخیره‌شده در سرور اضافه شد.';}catch(e){notify(e.message);productModalStatus.textContent=e.message;}
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
  }else{const v=p.server.variants[0];productModalStatus.textContent=v&&v.stock>0?'موجود · '+money(v.price):'ناموجود';productModalAdd.disabled=!v||v.stock<1;}
  const nutrition=document.getElementById('product-nutrition-panel');if(p.category==='supplements'){const facts=p.server.attributes.nutrition;nutrition.hidden=!facts;if(facts){const keys=['calories','protein','carbohydrates','sugars','fat','servingSize'];nutrition.querySelectorAll('li b').forEach((value,index)=>value.textContent=String(facts[keys[index]]??'ثبت نشده'));}}
  const images=p.server.images,thumbs=document.getElementById('product-modal-thumbnails');thumbs.replaceChildren();
  if(images.length){const show=image=>{const img=node('img');img.src=image.path;img.alt=image.alt;img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';productModalMedia.replaceChildren(img);};show(images[0]);images.forEach((image,index)=>{const b=node('button',String(index+1),'product-modal-thumb');b.type='button';b.setAttribute('aria-label',image.alt);b.addEventListener('click',()=>show(image));thumbs.append(b);});}
 };
 function productCard(p){
  const card=node('article',undefined,'product-card'),photo=node('div',undefined,'product-photo product-photo--'+p.category);photo.tabIndex=0;photo.setAttribute('role','button');photo.setAttribute('aria-label','جزئیات '+p.english);photo.dataset.openProduct=p.english;photo.dataset.gender=p.gender||'';
  if(p.server.images.length){const img=node('img');img.src=p.server.images[0].path;img.alt=p.server.images[0].alt;img.loading='lazy';img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';photo.append(img);}else{const object=node('div',undefined,'product-object');object.append(node('span',p.mark||p.english));photo.append(object);}
  const info=node('div',undefined,'product-info');info.dir='ltr';info.append(node('div',p.category==='clothing'?(p.gender==='men'?"MEN'S SPORTSWEAR":"WOMEN'S SPORTSWEAR"):p.category.toUpperCase(),'product-brand'),node('h3',p.english,'product-title'),node('div',p.subtitle,'product-subtitle'));
  const bottom=node('div',undefined,'product-bottom'),priceEl=node('span',p.server.variants.length?money(Math.min(...p.server.variants.map(v=>v.price))):'قیمت ثبت نشده','product-subtitle');priceEl.lang='fa';bottom.append(priceEl);
  if(p.server.isDemo)bottom.append(node('small','نمونه؛ قابل فروش واقعی نیست'));
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
  if(!checkoutMode)return;resetCheckoutConfirmation();state.quote=null;
  const a=savedAddresses.find(a=>a.id===selectedAddressId);document.getElementById('checkout-address-summary').textContent=a?[a.province,a.city,a.street,'پلاک '+a.plate,'واحد '+a.unit].join('، '):'نشانی تحویل را انتخاب کنید.';
  const lines=document.getElementById('checkout-lines');lines.replaceChildren();cartItems.forEach(i=>{const row=node('div',undefined,'checkout-line');row.append(node('strong',cartTitle(i)),node('span',faDigits(i.quantity)+' × '+money(i.unitPrice)));lines.append(row);});
  document.getElementById('checkout-count').textContent=faDigits(cartCount);document.getElementById('checkout-total').textContent='در انتظار محاسبهٔ ارسال';document.getElementById('checkout-cart-code').textContent='پس از ثبت سفارش صادر می‌شود';
  let controls=document.getElementById('server-checkout-controls');if(!controls){controls=node('div');controls.id='server-checkout-controls';const shipping=node('select');shipping.id='server-shipping';shipping.setAttribute('aria-label','روش ارسال');shipping.addEventListener('change',()=>updateCheckoutReview());const coupon=node('input');coupon.id='server-coupon';coupon.placeholder='کد تخفیف (اختیاری)';coupon.maxLength=40;const apply=node('button','محاسبهٔ نهایی');apply.type='button';apply.addEventListener('click',requestQuote);controls.append(node('p','روش ارسال و کد تخفیف'),shipping,coupon,apply);lines.after(controls);}
  const select=controls.querySelector('select');if(!select.options.length){select.add(new Option('انتخاب روش ارسال',''));state.shipping.forEach(s=>{if(!s.quote_required)select.add(new Option(s.name+' · '+money(s.fee),s.id));});}
  document.getElementById('checkout-confirm').disabled=true;document.getElementById('checkout-finalize').disabled=true;document.getElementById('checkout-finalize').textContent='ثبت سفارش و ادامهٔ پرداخت';
  document.getElementById('checkout-status').textContent=state.cart.pendingOrder?'سفارش '+state.cart.pendingOrder.code+' در انتظار پرداخت است. برای مشاهده یا لغو به تاریخچهٔ سفارش‌ها بروید.':'درگاه پرداخت غیرفعال است. ثبت سفارش نیز به فعال‌بودن فروشگاه و هزینهٔ مشخص ارسال نیاز دارد.';
 };
 async function requestQuote(){
  state.quote=null;document.getElementById('checkout-confirm').disabled=true;document.getElementById('checkout-finalize').disabled=true;
  try{if(state.cart.pendingOrder)throw Error('ابتدا سفارش در انتظار پرداخت را از تاریخچه مدیریت کنید.');const input={addressId:selectedAddressId,shippingId:Number(document.getElementById('server-shipping').value),coupon:document.getElementById('server-coupon').value};if(!selectedAddressId||!input.shippingId)throw Error('نشانی و روش ارسال را انتخاب کنید.');const data=await api('checkout/quote',input);state.quote={...input,amount:data.quote.total,key:crypto.randomUUID()};document.getElementById('checkout-total').textContent=money(data.quote.total);document.getElementById('checkout-status').textContent='مبلغ شامل ارسال و مالیات است. درگاه هنوز غیرفعال است.';document.getElementById('checkout-confirm').disabled=false;}catch(error){document.getElementById('checkout-status').textContent=error.message;}
 }
 document.getElementById('checkout-finalize').addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();const q=state.quote;if(!q||!document.getElementById('checkout-confirm').checked)return;const button=e.currentTarget;button.disabled=true;try{const data=await api('orders/create',{addressId:q.addressId,shippingId:q.shippingId,coupon:q.coupon,idempotencyKey:q.key});const o=data.order;document.getElementById('checkout-status').textContent='سفارش '+o.code+' در انتظار پرداخت ثبت شد. هیچ پرداختی انجام نشده و درگاه غیرفعال است.';state.quote=null;state.orders.unshift(o);applyCart(await api('cart'));}catch(error){document.getElementById('checkout-status').textContent=error.message;button.disabled=false;}},true);
 document.getElementById('server-coupon')?.addEventListener('input',()=>{state.quote=null;});
 const priorMapKey=readNeshanKey;readNeshanKey=key=>key===NESHAN_SERVICE_KEY_STORAGE?'':priorMapKey(key);
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
 document.addEventListener('input',e=>{if(e.target.id==='server-coupon'){state.quote=null;document.getElementById('checkout-confirm').checked=false;document.getElementById('checkout-confirm').disabled=true;document.getElementById('checkout-finalize').disabled=true;}});
 async function boot(){
  products.splice(0);cartItems=[];drawProducts();updateCartView();
  try{
   const session=await api('auth/session');let offset=0,all=[];for(;;){const data=await api('products?offset='+offset);all.push(...data.products);offset+=data.products.length;if(offset>=data.total||!data.products.length)break;}
   state.catalog=all;products.splice(0,products.length,...all.map(frontProduct));state.shipping=(await api('shipping')).methods;state.ready=true;
   if(session.authenticated){authenticatedUser=session.user;await refreshAccount();acceptVerifiedUser(session.user,false);}else authenticatedUser=null;
   applyCart(await api('cart'));drawProducts();
  }catch(error){state.ready=false;for(const id of (isClothingCatalog?['catalog-grid']:Object.values(productGrids))){const host=document.getElementById(id);host.replaceChildren(node('p',error.message,'product-subtitle'));const retry=node('button','تلاش دوباره');retry.addEventListener('click',boot);host.append(retry);}notify(error.message);}
 }
 boot();
}
