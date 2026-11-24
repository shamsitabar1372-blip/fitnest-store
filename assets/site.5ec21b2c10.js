const iconMarkup = {
      search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m15.5 15.5 5 5"></path></svg>',
      profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"></circle><path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2"></path></svg>',
      bag:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16l-1 13H5L4 8Z"></path><path d="M8 8V6a4 4 0 0 1 8 0v2"></path></svg>',
      profileActive:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"></circle><path d="M4.5 20.5c.2-4.1 3.4-7 7.5-7s7.3 2.9 7.5 7v.5h-15v-.5Z"></path></svg>'
    };
    document.getElementById('search-icon').innerHTML=iconMarkup.search;
    document.getElementById('profile-icon').innerHTML=iconMarkup.profile;
    document.getElementById('bag-icon').innerHTML=iconMarkup.bag;
    const heroSlides=[
      {image:'assets/optimized/slide-1-main-original.f7018c05f7.jpg',alt:'بدنساز ورزیده در حال آماده شدن برای ددلیفت در باشگاه',shadow:'assets/optimized/slide-1-overlay-original.1bdc2441b8.jpg',eyebrow:'FITNESS, WITH INTENTION',first:'Stay',second:'Professional',description:'تمرین جدی، تغذیهٔ حساب‌شده و انضباطی که نتیجه می‌سازد.'},
      {image:'assets/optimized/hero-nutrition-lossless.2f15109678.webp',srcset:"assets/optimized/hero-nutrition-lossless.2f15109678.webp 1776w",sizes:'100vw',alt:'سه ظرف مکمل ورزشی با نورپردازی بنفش در استودیو',coverProducts:true,eyebrow:'SPORTS NUTRITION',first:'Protein',second:'Essentials',description:'پروتئین و مکمل‌های ورزشی، با اطلاعات روشن برای انتخاب آگاهانه.'},
      {image:'assets/optimized/hero-fitness-lossless.0faedaa5d8.webp',srcset:"assets/optimized/hero-fitness-lossless.0faedaa5d8.webp 1776w",sizes:'100vw',alt:'ورزشکار زن در حال ددلیفت در باشگاه، با فضای تیره برای عنوان بنر',cover:true,eyebrow:'FUEL YOUR DISCIPLINE',first:'Fuel',second:'Your Focus',description:'انتخاب مکمل، با اطلاعات دقیق و متناسب با هدف تمرینی.'}
    ];
    const hero=document.getElementById('hero'), heroImage=document.querySelector('.hero-runner'), heroBackdrop=document.getElementById('hero-backdrop'), heroShadow=document.getElementById('hero-silhouette');
    const heroEyebrow=document.getElementById('hero-eyebrow'), heroFirst=document.getElementById('hero-title-first'), heroSecond=document.getElementById('hero-title-second'), heroDescription=document.getElementById('hero-description');
    const heroDots=[...document.querySelectorAll('[data-hero-slide]')];
    let activeHeroSlide=0, heroTimer, heroRequest=0, heroPaused=false;
    function showHeroSlide(index){
      const nextIndex=(index+heroSlides.length)%heroSlides.length;
      if(nextIndex===activeHeroSlide)return;
      const request=++heroRequest, slide=heroSlides[nextIndex];
      activeHeroSlide=nextIndex;
      heroDots.forEach((dot,i)=>dot.setAttribute('aria-current',String(i===nextIndex)));
      hero.classList.add('is-changing');
      heroImage.classList.toggle('hero-runner--contain',Boolean(slide.contain));
      heroImage.classList.toggle('hero-runner--cover',Boolean(slide.cover));
      heroImage.classList.toggle('hero-runner--cover-products',Boolean(slide.coverProducts));
      if(slide.contain){heroBackdrop.src=slide.image;heroBackdrop.classList.add('is-visible');}
      else heroBackdrop.classList.remove('is-visible');
      heroImage.srcset=slide.srcset||''; heroImage.sizes=slide.sizes||'100vw';
      heroImage.src=slide.image; heroImage.alt=slide.alt;
      setTimeout(()=>{
        if(request!==heroRequest)return;
        if(slide.shadow){heroShadow.src=slide.shadow;heroShadow.classList.remove('is-hidden');heroShadow.alt='سایهٔ ورزشکار زن در فضای تمرین';}
        else heroShadow.classList.add('is-hidden');
        heroEyebrow.textContent=slide.eyebrow; heroFirst.textContent=slide.first; heroSecond.textContent=slide.second; heroDescription.textContent=slide.description;
        requestAnimationFrame(()=>hero.classList.remove('is-changing'));
      },220);
    }
    const heroPauseButton=document.getElementById('hero-pause');
    function startHeroTimer(){clearInterval(heroTimer);if(heroPaused||document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;heroTimer=setInterval(()=>showHeroSlide(activeHeroSlide+1),10000);}
    heroPauseButton.addEventListener('click',()=>{
      heroPaused=!heroPaused;
      heroPauseButton.setAttribute('aria-pressed',String(heroPaused));
      heroPauseButton.setAttribute('aria-label',heroPaused?'ادامهٔ اسلایدشو':'توقف اسلایدشو');
      heroPauseButton.innerHTML=heroPaused?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12"/></svg>';
      startHeroTimer();
    });
    document.getElementById('hero-prev').addEventListener('click',()=>{showHeroSlide(activeHeroSlide-1);startHeroTimer();});
    document.getElementById('hero-next').addEventListener('click',()=>{showHeroSlide(activeHeroSlide+1);startHeroTimer();});
    heroDots.forEach(dot=>dot.addEventListener('click',()=>{showHeroSlide(Number(dot.dataset.heroSlide));startHeroTimer();}));
    document.addEventListener('visibilitychange',startHeroTimer);
    startHeroTimer();
    const preloadNextSlide=()=>{
      if(document.hidden||navigator.connection?.saveData||['slow-2g','2g'].includes(navigator.connection?.effectiveType))return;
      const slide=heroSlides[(activeHeroSlide+1)%heroSlides.length],image=new Image();
      image.fetchPriority='low';image.decoding='async';image.sizes=slide.sizes||'100vw';image.srcset=slide.srcset||'';image.src=slide.image;
    };
    window.addEventListener('load',()=>{if('requestIdleCallback' in window)requestIdleCallback(preloadNextSlide,{timeout:5000});else setTimeout(preloadNextSlide,2500);},{once:true});
    const products = [
      {category:'supplements',supplementCategory:'protein',name:'ایزو وی', english:'ISO WHEY', subtitle:'پروتئین وی ایزوله', group:'daily', type:'پروتئین ورزشی', tag:'پرفروش', weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'protein',name:'پیور پروتئین', english:'PURE PROTEIN', subtitle:'پروتئین وی', group:'daily', type:'پروتئین ورزشی', tag:'محبوب', weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'protein',name:'گلدن وی', english:'GOLDEN WHEY', subtitle:'پروتئین وی روزمره', group:'recovery', type:'پروتئین ورزشی', tag:'روزانه', weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'protein',name:'مس وی', english:'MASS WHEY', subtitle:'پروتئین افزایش حجم', group:'mass', type:'پروتئین ورزشی', tag:'تمرینی', weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'creatine',name:'کراتین مونوهیدرات',english:'CREATINE MONOHYDRATE',subtitle:'مکمل کراتین نمونه',type:'مکمل ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'creatine',name:'کراتین',english:'CREATINE',subtitle:'محصول نمونهٔ دستهٔ کراتین',type:'مکمل ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'vitamine',name:'مولتی‌ویتامین',english:'MULTIVITAMIN',subtitle:'مکمل ویتامینی نمونه',type:'مکمل ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'vitamine',name:'ویتامین D3',english:'VITAMIN D3',subtitle:'محصول نمونهٔ دستهٔ ویتامین‌ها',type:'مکمل ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'bars',name:'پروتئین بار',english:'PROTEIN BAR',subtitle:'میان‌وعدهٔ نمونه',type:'اسنک ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'bars',name:'انرژی بار',english:'ENERGY BAR',subtitle:'محصول نمونهٔ دستهٔ اسنک',type:'اسنک ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'pre-workout',name:'پری‌ورک‌اوت',english:'PRE-WORKOUT',subtitle:'مکمل پیش از تمرین نمونه',type:'مکمل ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'supplements',supplementCategory:'pre-workout',name:'پودر پیش‌تمرین',english:'PRE-TRAINING',subtitle:'محصول نمونهٔ دستهٔ پیش از تمرین',type:'مکمل ورزشی',tag:'نمونه',weight:'بسته‌بندی نمونه'},
      {category:'clothing',name:'تی‌شرت تمرینی',english:'TRAINING TEE',subtitle:'لباس سبک برای تمرین روزانه',type:'پوشاک ورزشی',tag:'نمونه',mark:'TEE'},
      {category:'clothing',name:'شلوارک ورزشی',english:'TRAINING SHORTS',subtitle:'آزادی حرکت در تمرین',type:'پوشاک ورزشی',tag:'نمونه',mark:'SHORTS'},
      {category:'clothing',name:'لگ ورزشی',english:'TRAINING LEGGINGS',subtitle:'پوشاک فیتنس زنانه',type:'پوشاک ورزشی',tag:'نمونه',mark:'LEGGINGS'},
      {category:'clothing',name:'هودی تمرینی',english:'TRAINING HOODIE',subtitle:'لایهٔ گرم برای قبل و بعد تمرین',type:'پوشاک ورزشی',tag:'نمونه',mark:'HOODIE'},
      {category:'gear',name:'شیکر ورزشی',english:'SPORTS SHAKER',subtitle:'برای نوشیدنی‌های ورزشی',type:'تجهیزات تمرین',tag:'نمونه',mark:'SHAKER'},
      {category:'gear',name:'دستکش تمرین',english:'TRAINING GLOVES',subtitle:'لوازم کاربردی تمرین قدرتی',type:'تجهیزات تمرین',tag:'نمونه',mark:'GLOVES'},
      {category:'gear',name:'بند لیفت',english:'LIFTING STRAPS',subtitle:'اکسسوری تمرین با وزنه',type:'تجهیزات تمرین',tag:'نمونه',mark:'STRAPS'},
      {category:'gear',name:'کش تمرینی',english:'RESISTANCE BAND',subtitle:'لوازم تمرین مقاومتی',type:'تجهیزات تمرین',tag:'نمونه',mark:'BAND'}
    ];
    const legacyCartStorageKey='fitnest-cart-v1',legacyCartCodeStorageKey='fitnest-cart-code-v1';
    let cartStorageKey='fitnest-cart-v2:guest',cartCodeStorageKey='fitnest-cart-code-v2:guest';
    let cartCount=0, cartItems=[], activeProduct=null, modalQuantity=1, lastProductTrigger=null, lastCartFocus=null;
    let cartCode='';
    function makeCartCode(){
      const date=new Date(),datePart=`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
      const bytes=new Uint8Array(6);
      if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(bytes);
      else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
      return `FN-${datePart}-${Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase()}`;
    }
    function validCartItems(value){
      return Array.isArray(value)?value.filter(item=>products.some(product=>product.english===item?.title)&&Number.isInteger(item.quantity)&&item.quantity>0).map(item=>({title:item.title,quantity:Math.min(item.quantity,99),gender:['men','women'].includes(item.gender)?item.gender:null,color:['مشکی','بنفش','خاکستری'].includes(item.color)?item.color:'',size:['S','M','L','XL'].includes(item.size)?item.size:''})):[];
    }
    function cartOwnerId(mobile){
      return String(mobile||'').replace(/[۰-۹]/g,char=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char))).replace(/[٠-٩]/g,char=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(char))).replace(/[^0-9]/g,'');
    }
    function migrateLegacyCart(){
      try{
        const owner=cartOwnerId(readAccountData().mobile);
        const previous=localStorage.getItem(legacyCartStorageKey);
        if(!owner||previous===null)return;
        const key='fitnest-cart-v2:'+owner;
        if(localStorage.getItem(key)===null){
          localStorage.setItem(key,JSON.stringify(validCartItems(JSON.parse(previous))));
          const code=localStorage.getItem(legacyCartCodeStorageKey);
          if(code)localStorage.setItem('fitnest-cart-code-v2:'+owner,code);
        }
        // Mark migration only after the account copy was saved successfully.
        localStorage.removeItem(legacyCartStorageKey);
        localStorage.removeItem(legacyCartCodeStorageKey);
      }catch{}
    }
    function switchCartOwner(mobile=''){
      const owner=cartOwnerId(mobile)||'guest';
      cartStorageKey='fitnest-cart-v2:'+owner;
      cartCodeStorageKey='fitnest-cart-code-v2:'+owner;
      cartItems=[];cartCode='';
      try{
        cartItems=validCartItems(JSON.parse(localStorage.getItem(cartStorageKey)||'[]'));
        if(cartItems.length)cartCode=localStorage.getItem(cartCodeStorageKey)||'';
      }catch{}
      updateCartView();
      cartStatus.textContent='';
    }
    const cartButton=document.querySelector('.cart'), cartBackdrop=document.getElementById('cart-backdrop'), cartItemsElement=document.getElementById('cart-items'), cartCountLabel=document.getElementById('cart-count-label'), cartTotalElement=document.getElementById('cart-total'), cartStatus=document.getElementById('cart-status'), cartCheckoutButton=document.getElementById('cart-checkout');
    const profileToggle=document.getElementById('profile-toggle'), profileBackdrop=document.getElementById('profile-backdrop'), profileStatus=document.getElementById('profile-status');
    const profileWelcome=document.getElementById('profile-welcome'), profileRegister=document.getElementById('profile-register'), profileSuccess=document.getElementById('profile-success'), profileLinks=document.querySelector('.profile-links'), accountView=document.getElementById('account-view'), profileDrawer=document.querySelector('.profile-drawer');
    const socialLinks={instagram:'',whatsapp:''};
    function syncProfileLinks(){
      const signedIn=profileToggle.classList.contains('is-signed-in');
      profileLinks.hidden=!signedIn;
      profileLinks.querySelectorAll('.profile-link--member').forEach(link=>link.hidden=!signedIn);
    }
    syncProfileLinks();
    profileWelcome.addEventListener('click',event=>{
      const social=event.target.closest('[data-social]');if(!social)return;
      const url=socialLinks[social.dataset.social];
      if(url)window.open(url,'_blank','noopener,noreferrer');
      else profileStatus.textContent=`لینک رسمی ${social.dataset.social==='instagram'?'اینستاگرام':'واتساپ'} فروشگاه هنوز ثبت نشده است.`;
    });
    const accountForm=document.getElementById('account-form'), mapPicker=document.getElementById('map-picker-backdrop');
    let accountMap=null, accountMarker=null, pickedCoordinates=null, editingAddressId=null, savedAddresses=[], selectedAddressId=null, accountIdentity={name:'',mobile:''}, checkoutMode=false, pendingCheckout=false, profileAuthMode='register';
    let authenticatedUser=null;
    function accountProfileKey(){return authenticatedUser?'fitnest-profile-v2:'+authenticatedUser.id:'fitnest-profile-guest';}
    function readAccountData(){
      let data={};try{const stored=JSON.parse(localStorage.getItem(accountProfileKey())||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))data=stored;}catch{}
      if(!Array.isArray(data.addresses)){
        const hasLegacyAddress=['province','city','street','plate','unit','postal'].some(key=>data[key]);
        data.addresses=hasLegacyAddress?[{id:'legacy-address',province:data.province||'',city:data.city||'',street:data.street||'',plate:data.plate||'',unit:data.unit||'',postal:data.postal||'',coordinates:data.coordinates||null}]:[];
      }
      data.name=typeof data.name==='string'?data.name.slice(0,100):'';
      data.mobile=typeof data.mobile==='string'?data.mobile.slice(0,20):'';
      data.addresses=data.addresses.filter(address=>address&&typeof address==='object'&&!Array.isArray(address)).slice(0,30);
      return data;
    }
    function writeAccountData(extra={}){
      const current=readAccountData(),name=document.getElementById('account-name')?.value.trim()||accountIdentity.name||current.name||'',mobile=authenticatedUser?.mobile||accountIdentity.mobile||current.mobile||'';
      localStorage.setItem(accountProfileKey(),JSON.stringify({...current,name,mobile,addresses:savedAddresses,selectedAddressId,...extra}));
      accountIdentity={name,mobile};
    }
    try { const stored=readAccountData(); accountIdentity={name:stored.name||'',mobile:stored.mobile||''};savedAddresses=stored.addresses; } catch {}
    function loadAccountFields(){
      const stored=readAccountData();savedAddresses=stored.addresses;accountIdentity={name:stored.name||accountIdentity.name,mobile:stored.mobile||accountIdentity.mobile};
      selectedAddressId=savedAddresses.some(address=>address.id===stored.selectedAddressId)?stored.selectedAddressId:(savedAddresses[0]?.id??null);
      document.getElementById('account-name').value=stored.name||accountIdentity.name;
      document.getElementById('account-mobile').value=stored.mobile||accountIdentity.mobile;
      document.getElementById('account-contact-status').textContent='اطلاعات تماس در همین مرورگر ذخیره می‌شود.';
      document.getElementById('address-book-status').textContent='';
      editingAddressId=null;document.getElementById('address-form').hidden=true;document.getElementById('address-book').hidden=false;renderAddressList();
      addAddressButton.setAttribute('aria-expanded','false');
    }
    const accountTabs=[...document.querySelectorAll('[data-account-tab]')];
    function activateAccountTab(tab='addresses'){
      for(const button of accountTabs){
        const selected=button.dataset.accountTab===tab;
        button.setAttribute('aria-selected',String(selected));
        button.tabIndex=selected?0:-1;
        document.getElementById('account-tab-'+button.dataset.accountTab).hidden=!selected;
      }
      if(!checkoutMode){
        const titles={addresses:['اطلاعات حساب','اطلاعات تماس و نشانی تحویل سفارش‌ها را ثبت و ویرایش کن.'],orders:['سفارش‌های من','تاریخچهٔ سفارش‌های پرداخت‌شده را اینجا ببین.'],reviews:['امتیاز و دیدگاه‌ها','به محصولاتی که خریده‌ای امتیاز بده و تجربه‌ات را بنویس.']};
        accountView.querySelector('.account-view-head h3').textContent=titles[tab][0];
        accountView.querySelector('.account-view-head p').textContent=titles[tab][1];
      }
      if(tab==='orders')renderOrderHistory();
      if(tab==='reviews')renderReviewList();
    }
    accountTabs.forEach(button=>button.addEventListener('click',()=>activateAccountTab(button.dataset.accountTab)));
    document.getElementById('account-tabs').addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const current=accountTabs.findIndex(button=>button.getAttribute('aria-selected')==='true');
      const next=event.key==='Home'?0:event.key==='End'?accountTabs.length-1:(current+(event.key==='ArrowLeft'?1:-1)+accountTabs.length)%accountTabs.length;
      activateAccountTab(accountTabs[next].dataset.accountTab);accountTabs[next].focus();
    });
    function openAccountView(tab='addresses'){profileWelcome.hidden=true;profileRegister.hidden=true;profileSuccess.hidden=true;profileLinks.hidden=true;accountView.hidden=false;profileDrawer.classList.add('is-account-view');profileStatus.hidden=true;loadAccountFields();activateAccountTab(tab);(checkoutMode?document.getElementById('add-address'):document.getElementById('account-tab-'+tab+'-button')).focus();}
    function closeAccountView(){setCheckoutMode(false);accountView.hidden=true;profileDrawer.classList.remove('is-account-view');profileStatus.hidden=false;syncProfileLinks();if(profileToggle.classList.contains('is-signed-in'))profileSuccess.hidden=false;else profileWelcome.hidden=false;}
    accountForm.addEventListener('submit',event=>{
      event.preventDefault();if(!accountForm.reportValidity())return;
      const form=new FormData(accountForm);accountIdentity={name:String(form.get('name')).trim(),mobile:authenticatedUser?.mobile||''};
      try{writeAccountData();document.getElementById('account-contact-status').textContent='اطلاعات تماس ذخیره شد.';}
      catch{document.getElementById('account-contact-status').textContent='ذخیره‌سازی مرورگر در دسترس نیست.';}
    });
    const addressBook=document.getElementById('address-book'),addressList=document.getElementById('address-saved-list'),addressForm=document.getElementById('address-form');
    const addAddressButton=document.getElementById('add-address');
    function renderAddressList(){
      updateCheckoutReview();
      addressList.replaceChildren();
      if(!savedAddresses.length){const empty=document.createElement('p');empty.className='address-empty';empty.textContent='هنوز نشانی‌ای ذخیره نشده؛ برای شروع «افزودن آدرس» را بزن.';addressList.append(empty);return;}
      savedAddresses.forEach((address,index)=>{
        const card=document.createElement('article');card.className='address-saved-item';
        const title=document.createElement('strong');title.textContent=[address.city,address.province].filter(Boolean).join('، ')||`نشانی ${index+1}`;
        const edit=document.createElement('button');edit.type='button';edit.className='address-edit-button';edit.textContent='ویرایش آدرس';edit.dataset.editAddress=address.id;
        const details=document.createElement('p');details.textContent=[address.street,address.plate?`پلاک ${address.plate}`:'',address.unit?`واحد ${address.unit}`:''].filter(Boolean).join('، ');
        const postal=document.createElement('small');postal.textContent=address.postal?`کد پستی: ${address.postal}`:'';
        const select=document.createElement('button');
        select.type='button';
        select.className='address-select-button';
        select.dataset.selectAddress=address.id;
        const selected=address.id===selectedAddressId;
        card.classList.toggle('is-selected',selected);
        select.textContent=selected?'آدرس منتخب':'انتخاب برای ارسال';
        select.setAttribute('aria-pressed',String(selected));
        card.append(title,edit,details,postal,select);
        addressList.append(card);
      });
    }
    function openAddressEditor(address=null){
      resetCheckoutConfirmation();
      addressForm.reset();
      editingAddressId=address?.id??null;
      const coordinates=address?.coordinates;
      pickedCoordinates=Number.isFinite(coordinates?.lat)&&Number.isFinite(coordinates?.lng)?coordinates:null;
      for(const field of ['province','city','street','plate','unit','postal']){
        addressForm.elements.namedItem(field).value=address?.[field]??'';
      }
      document.getElementById('address-form-title').textContent=address?'ویرایش آدرس':'افزودن آدرس جدید';
      document.getElementById('account-map-status').textContent=pickedCoordinates?`موقعیت ذخیره‌شده: ${pickedCoordinates.lat.toFixed(5)}, ${pickedCoordinates.lng.toFixed(5)}`:'هنوز موقعیتی روی نقشه انتخاب نشده است.';
      addressBook.hidden=false;addressForm.hidden=false;document.getElementById('add-address').setAttribute('aria-expanded','true');document.getElementById('address-book-status').textContent=address?'آدرس برای ویرایش باز شد.':'فرم افزودن آدرس باز شد.';
      updateCheckoutReview();
      if(address)focusAddressDetails('address-province');
    }
    addAddressButton.addEventListener('click',()=>{
      openAddressEditor();
      openMapPicker();
    });
    function closeAddressEditor(){addressForm.hidden=true;addressBook.hidden=false;editingAddressId=null;document.getElementById('add-address').setAttribute('aria-expanded','false');renderAddressList();document.getElementById('add-address').focus();}
    document.getElementById('address-form-cancel').addEventListener('click',closeAddressEditor);
    addressList.addEventListener('click',event=>{const button=event.target.closest('[data-edit-address]');if(!button)return;const address=savedAddresses.find(item=>item.id===button.dataset.editAddress);if(address)openAddressEditor(address);});
    addressList.addEventListener('click',event=>{
      const button=event.target.closest('[data-select-address]');
      if(!button||button.dataset.selectAddress===selectedAddressId)return;
      const id=button.dataset.selectAddress;
      const status=document.getElementById('address-book-status');
      try{
        writeAccountData({selectedAddressId:id});
        selectedAddressId=id;
        renderAddressList();
        Array.from(addressList.querySelectorAll('[data-select-address]')).find(item=>item.dataset.selectAddress===id)?.focus();
        status.textContent='آدرس ارسال انتخاب شد.';
      }catch{status.textContent='انتخاب آدرس ذخیره نشد.';}
    });
    addressForm.addEventListener('submit',event=>{
      event.preventDefault();if(!addressForm.reportValidity())return;
      if(!pickedCoordinates){document.getElementById('account-map-status').textContent='برای ذخیرهٔ نشانی، موقعیت را روی نقشه انتخاب کن.';document.getElementById('open-address-map').focus();return;}
      const form=new FormData(addressForm),id=editingAddressId||`address-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const address={id,province:String(form.get('province')).trim(),city:String(form.get('city')).trim(),street:String(form.get('street')).trim(),plate:String(form.get('plate')).trim(),unit:String(form.get('unit')).trim(),postal:String(form.get('postal')).trim(),coordinates:pickedCoordinates};
      const wasEditing=Boolean(editingAddressId);
      const addresses=wasEditing?savedAddresses.map(item=>item.id===editingAddressId?address:item):[...savedAddresses,address];
      try{
        const nextSelectedId=selectedAddressId??id;
        writeAccountData({addresses,selectedAddressId:nextSelectedId});
        savedAddresses=addresses;
        selectedAddressId=nextSelectedId;
        closeAddressEditor();
        document.getElementById('address-book-status').textContent=wasEditing?'آدرس ویرایش و ذخیره شد.':'آدرس جدید ذخیره شد.';
      }
      catch{document.getElementById('account-map-status').textContent='ذخیره‌سازی مرورگر در دسترس نیست؛ آدرس را موقتاً یادداشت کن.';}
    });
    const productGrids={supplements:'supplements-grid',clothing:'clothing-grid',womensClothing:'womens-clothing-grid',gear:'gear-grid'};
    let activeSupplementCategory='protein';
    const supplementCategoryButtons=[...document.querySelectorAll('[data-supplement-category]')];
    const faDigits=n=>String(n).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
    const productDescriptions={
      'ISO WHEY':'Whey protein isolate', 'PURE PROTEIN':'Pure whey protein', 'GOLDEN WHEY':'Everyday whey protein', 'MASS WHEY':'Protein for weight gain',
      'CREATINE MONOHYDRATE':'Creatine monohydrate powder', 'CREATINE':'Creatine supplement', 'MULTIVITAMIN':'Daily multivitamin', 'VITAMIN D3':'Vitamin D3 supplement',
      'PROTEIN BAR':'Protein snack bar', 'ENERGY BAR':'Energy snack', 'PRE-WORKOUT':'Pre-workout formula', 'PRE-TRAINING':'Pre-training formula',
      'TRAINING TEE':'Lightweight everyday training shirt', 'TRAINING SHORTS':'Training shorts for active movement', 'TRAINING LEGGINGS':'Flexible training leggings', 'TRAINING HOODIE':'Warm layer for before and after training',
      'SPORTS SHAKER':'Shaker for sports drinks', 'TRAINING GLOVES':'Gloves for strength training', 'LIFTING STRAPS':'Weightlifting accessory', 'RESISTANCE BAND':'Resistance training band'
    };
    const productTypes={'پروتئین ورزشی':'Sports Nutrition','مکمل ورزشی':'Sports Supplements','اسنک ورزشی':'Sports Snacks','پوشاک ورزشی':'Sportswear','تجهیزات تمرین':'Training Gear'};
    const productBadges={'پرفروش':'BEST SELLER','محبوب':'POPULAR','روزانه':'DAILY','تمرینی':'TRAINING','نمونه':'FEATURED'};
    const productCategoryLabels={supplements:'مکمل‌های ورزشی',clothing:'پوشاک ورزشی',gear:'تجهیزات ورزشی'};
    const cartCategoryLabels={supplements:'Supplements',clothing:'Clothing',gear:'Gear'};
    const sampleProductPrices={'ISO WHEY':2450000,'PURE PROTEIN':2150000,'GOLDEN WHEY':1850000,'MASS WHEY':1950000,'CREATINE MONOHYDRATE':1350000,'CREATINE':1100000,'MULTIVITAMIN':620000,'VITAMIN D3':450000,'PROTEIN BAR':120000,'ENERGY BAR':95000,'PRE-WORKOUT':1250000,'PRE-TRAINING':950000,'TRAINING TEE':890000,'TRAINING SHORTS':990000,'TRAINING LEGGINGS':1290000,'TRAINING HOODIE':1790000,'SPORTS SHAKER':450000,'TRAINING GLOVES':620000,'LIFTING STRAPS':390000,'RESISTANCE BAND':330000};
    const tomanFormatter=new Intl.NumberFormat('fa-IR');
    const formatToman=amount=>`${tomanFormatter.format(amount)} تومان`;
    const previewOrder={id:'preview',items:[{title:'MASS WHEY',quantity:1},{title:'TRAINING TEE',quantity:1}]};
    let visibleOrders=[];
    function orderCode(order){return order===previewOrder?'FN-DEMO-001':String(order.code||order.id||'—');}
    function orderDate(order){
      const date=order===previewOrder?new Date():new Date(order.paidAt||order.createdAt||'');
      return Number.isNaN(date.getTime())?'ثبت نشده':date.toLocaleDateString('fa-IR-u-ca-persian');
    }
    function orderUnitPrice(item){return Number.isFinite(item.unitPrice)&&item.unitPrice>=0?item.unitPrice:(sampleProductPrices[item.title]||0);}
    function paidOrdersForAccount(){
      try{
        const records=JSON.parse(localStorage.getItem('fitnest-paid-orders-v1')||'[]');
        return Array.isArray(records)?records.filter(order=>order?.status==='paid'&&order.mobile===accountIdentity.mobile&&Array.isArray(order.items)).sort((a,b)=>new Date(b.paidAt||0)-new Date(a.paidAt||0)):[];
      }catch{return [];}
    }
    function accountOrderItems(order){return order.items.filter(item=>products.some(product=>product.english===item?.title)&&Number.isInteger(item.quantity)&&item.quantity>0);}
    function renderOrderHistory(){
      const host=document.getElementById('account-order-history');host.replaceChildren();
      const paid=paidOrdersForAccount();
      if(!paid.length){const empty=document.createElement('p');empty.className='account-empty';empty.textContent='هنوز سفارش پرداخت‌شده‌ای برای این حساب ثبت نشده است. کارت زیر فقط نمونهٔ ظاهر تاریخچه است.';host.append(empty);}
      visibleOrders=paid.length?paid:[previewOrder];
      for(const [index,order] of visibleOrders.entries()){
        const demo=order===previewOrder,card=document.createElement('article');card.className='account-order-card';
        const head=document.createElement('div');head.className='account-order-head';
        const heading=document.createElement('div'),title=document.createElement('strong'),meta=document.createElement('small'),badge=document.createElement('span');
        title.textContent=demo?'سفارش نمونه':'سفارش ثبت‌شده';
        meta.textContent=demo?'پیش‌نمایش؛ خرید واقعی نیست.':'جزئیات خرید شما';
        badge.className=`account-order-badge${demo?' is-demo':''}`;badge.textContent=demo?'نمایشی':'پرداخت‌شده';heading.append(title,meta);head.append(heading,badge);
        const metadata=document.createElement('div');metadata.className='account-order-meta';
        for(const [label,value,language] of [['تاریخ',orderDate(order),'fa'],['کد سفارش',orderCode(order),'en']]){
          const field=document.createElement('span'),caption=document.createElement('span'),text=document.createElement('b');caption.textContent=label;text.textContent=value;text.lang=language;if(language==='en')text.dir='ltr';field.append(caption,text);metadata.append(field);
        }
        const list=document.createElement('ul');list.className='account-order-items';
        const items=accountOrderItems(order);
        for(const item of items){
          const product=products.find(entry=>entry.english===item.title);
          const row=document.createElement('li'),productInfo=document.createElement('div'),thumb=document.createElement('div'),name=document.createElement('span'),count=document.createElement('span');
          productInfo.className='account-order-product';thumb.className=`account-order-thumb account-order-thumb--${product.category}`;
          thumb.setAttribute('role','img');thumb.setAttribute('aria-label',`تصویر ${item.title}`);thumb.innerHTML=productVisual(product);
          name.className='account-order-product-name';name.lang='en';name.textContent=item.title+(item.color&&item.size?` · ${item.color} / ${item.size}`:'');
          count.className='account-order-quantity';count.textContent=`${faDigits(item.quantity)} عدد`;
          productInfo.append(thumb,name);row.append(productInfo,count);list.append(row);
        }
        const footer=document.createElement('div');footer.className='account-order-foot';
        const invoiceButton=document.createElement('button');invoiceButton.type='button';invoiceButton.className='account-invoice-open';invoiceButton.dataset.invoiceIndex=String(index);
        invoiceButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l3 3v15H4V3h3Zm10 0v4h3M8 11h8M8 15h8M8 19h5"></path></svg><span>مشاهدهٔ فاکتور</span>';
        footer.append(invoiceButton);
        card.append(head,metadata,list,footer);host.append(card);
      }
    }
    const invoiceBackdrop=document.getElementById('invoice-backdrop');
    let lastInvoiceFocus=null;
    function openInvoice(order,trigger){
      if(!order)return;
      lastInvoiceFocus=trigger;
      const details=document.getElementById('invoice-details'),lines=document.getElementById('invoice-lines');
      details.replaceChildren();lines.replaceChildren();
      for(const [label,value] of [['کد سفارش',orderCode(order)],['تاریخ سفارش',orderDate(order)],['وضعیت',order===previewOrder?'نمونهٔ نمایشی':'پرداخت‌شده'],['روش ارسال','تیپاکس']]){
        const field=document.createElement('div'),caption=document.createElement('span'),text=document.createElement('strong');
        field.className='invoice-field';caption.textContent=label;text.textContent=value;
        if(label==='کد سفارش'){text.lang='en';text.dir='ltr';}
        field.append(caption,text);details.append(field);
      }
      const items=accountOrderItems(order);
      for(const item of items){
        const line=document.createElement('li'),name=document.createElement('div'),title=document.createElement('strong'),quantity=document.createElement('span'),price=document.createElement('span');
        title.lang='en';title.textContent=item.title+(item.color&&item.size?` · ${item.color} / ${item.size}`:'');quantity.textContent=` · ${faDigits(item.quantity)} عدد`;
        price.textContent=formatToman(orderUnitPrice(item)*item.quantity);
        name.append(title,quantity);line.append(name,price);lines.append(line);
      }
      const subtotal=items.reduce((sum,item)=>sum+orderUnitPrice(item)*item.quantity,0);
      const paidAmount=Number.isFinite(order.paidAmount)?order.paidAmount:null;
      document.getElementById('invoice-total-label').textContent=paidAmount===null?'جمع محصولات':'مبلغ پرداخت‌شده';
      document.getElementById('invoice-products-total').textContent=formatToman(paidAmount??subtotal);
      document.getElementById('invoice-note').textContent=order===previewOrder?'این فاکتور فقط پیش‌نمایش است؛ قیمت‌ها نمونه‌اند و پرداختی انجام نشده است.':paidAmount===null?'مبلغ نمایش‌داده‌شده جمع محصولات است؛ مبلغ نهایی و هزینهٔ ارسال از اطلاعات پرداخت تکمیل می‌شود.':'مبلغ پرداخت‌شده مطابق اطلاعات سفارش ثبت شده است.';
      invoiceBackdrop.classList.add('is-open');invoiceBackdrop.setAttribute('aria-hidden','false');profileBackdrop.inert=true;
      document.getElementById('invoice-close').focus();
    }
    function closeInvoice(){
      invoiceBackdrop.classList.remove('is-open');invoiceBackdrop.setAttribute('aria-hidden','true');profileBackdrop.inert=false;
      if(lastInvoiceFocus?.isConnected)lastInvoiceFocus.focus();
    }
    document.getElementById('account-order-history').addEventListener('click',event=>{
      const button=event.target.closest('[data-invoice-index]');if(button)openInvoice(visibleOrders[Number(button.dataset.invoiceIndex)],button);
    });
    document.getElementById('invoice-close').addEventListener('click',closeInvoice);
    invoiceBackdrop.addEventListener('click',event=>{if(event.target===invoiceBackdrop)closeInvoice();});
    function reviewStorageKey(){return 'fitnest-product-reviews-v1:'+encodeURIComponent(accountIdentity.mobile||'demo');}
    function readReviews(){try{const data=JSON.parse(localStorage.getItem(reviewStorageKey())||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data:{};}catch{return {};}}
    function renderReviewList(){
      const host=document.getElementById('account-review-list');host.replaceChildren();
      const paid=paidOrdersForAccount(),demo=!paid.length,orders=demo?[previewOrder]:paid;
      if(demo){const note=document.createElement('p');note.className='account-empty';note.textContent='پس از ثبت خرید واقعی، محصولات آن اینجا برای امتیاز و دیدگاه نمایش داده می‌شوند. کارت‌های زیر نمونه‌اند.';host.append(note);}
      const reviews=readReviews(),seen=new Set();
      for(const order of orders)for(const item of accountOrderItems(order)){
        const key=order.id+'|'+item.title;if(seen.has(key))continue;seen.add(key);
        const saved=reviews[key]||{},card=document.createElement('form');card.className='account-review-card';card.dataset.reviewKey=key;card.dataset.rating=String(Number(saved.rating)||0);
        const head=document.createElement('div');head.className='account-review-head';
        const product=products.find(entry=>entry.english===item.title),productInfo=document.createElement('div'),copy=document.createElement('div'),thumb=document.createElement('div'),name=document.createElement('strong'),caption=document.createElement('small');
        productInfo.className='account-review-product';copy.className='account-review-product-copy';
        thumb.className=`account-order-thumb account-order-thumb--${product.category}`;thumb.setAttribute('role','img');thumb.setAttribute('aria-label',`تصویر ${item.title}`);thumb.innerHTML=productVisual(product);
        name.lang='en';name.textContent=item.title;caption.textContent=demo?'محصول نمونه':'خرید ثبت‌شده';copy.append(name,caption);productInfo.append(thumb,copy);head.append(productInfo);
        const label=document.createElement('label');label.className='account-review-label';label.textContent='امتیاز شما به این محصول';
        const stars=document.createElement('div');stars.className='account-rating';stars.setAttribute('role','group');stars.setAttribute('aria-label','امتیاز از یک تا پنج');
        for(let value=5;value>=1;value--){const star=document.createElement('button');star.type='button';star.dataset.rate=String(value);star.setAttribute('aria-label',`${faDigits(value)} از ۵ ستاره`);star.setAttribute('aria-pressed',String(Number(saved.rating)===value));star.classList.toggle('is-active',value<=Number(saved.rating||0));star.textContent='☆';stars.append(star);}
        const textarea=document.createElement('textarea');textarea.className='account-review-text';textarea.required=true;textarea.maxLength=1000;textarea.placeholder='تجربهٔ خود را دربارهٔ این محصول بنویسید...';textarea.setAttribute('aria-label','دیدگاه شما');textarea.value=typeof saved.comment==='string'?saved.comment:'';
        const save=document.createElement('button');save.className='account-review-save';save.type='submit';save.textContent=saved.comment?'ویرایش دیدگاه':'ثبت دیدگاه';
        const status=document.createElement('p');status.className='account-review-status';status.setAttribute('role','status');
        card.append(head,label,stars,textarea,save,status);host.append(card);
      }
    }
    const reviewList=document.getElementById('account-review-list');
    reviewList.addEventListener('click',event=>{
      const star=event.target.closest('[data-rate]');if(!star)return;
      const card=star.closest('[data-review-key]'),rating=Number(star.dataset.rate);card.dataset.rating=String(rating);
      card.querySelectorAll('[data-rate]').forEach(button=>{button.classList.toggle('is-active',Number(button.dataset.rate)<=rating);button.setAttribute('aria-pressed',String(Number(button.dataset.rate)===rating));});
      card.querySelector('.account-review-status').textContent='';
    });
    reviewList.addEventListener('submit',event=>{
      event.preventDefault();const card=event.target,rating=Number(card.dataset.rating),status=card.querySelector('.account-review-status');
      if(!rating){status.textContent='لطفاً ابتدا به محصول امتیاز بدهید.';return;}
      const comment=card.querySelector('textarea').value.trim();if(!comment){status.textContent='لطفاً دیدگاهتان را بنویسید.';return;}
      try{const reviews=readReviews();reviews[card.dataset.reviewKey]={rating,comment};localStorage.setItem(reviewStorageKey(),JSON.stringify(reviews));status.textContent='امتیاز و دیدگاه در همین مرورگر ذخیره شد.';card.querySelector('.account-review-save').textContent='ویرایش دیدگاه';}
      catch{status.textContent='ذخیرهٔ دیدگاه در مرورگر ممکن نشد.';}
    });
    function resetCheckoutConfirmation(){
      document.getElementById('checkout-confirm').checked=false;
      document.getElementById('checkout-finalize').disabled=true;
      document.getElementById('checkout-status').textContent='';
    }
    function setCheckoutMode(enabled){
      checkoutMode=enabled;
      accountView.classList.toggle('is-checkout',enabled);
      document.getElementById('account-tabs').hidden=enabled;
      if(enabled)activateAccountTab('addresses');
      document.getElementById('checkout-review').hidden=!enabled;
      accountView.querySelector('.account-view-head h3').textContent=enabled?'آدرس تحویل و تأیید سفارش':'اطلاعات حساب';
      accountView.querySelector('.account-view-head p').textContent=enabled?'آدرس ارسال را انتخاب کن و جزئیات سفارش را بررسی کن.':'اطلاعات تماس و نشانی تحویل سفارش‌ها را ثبت و ویرایش کن.';
      document.getElementById('account-back').textContent=enabled?'بازگشت به سبد خرید':'بازگشت به حساب';
      resetCheckoutConfirmation();
    }
    function openCheckout(){
      if(!cartItems.length)return;
      closeCart();
      openProfile();
      if(!authenticatedUser){
        pendingCheckout=true;
        setCheckoutMode(false);
        accountView.hidden=true;
        profileDrawer.classList.remove('is-account-view');
        profileRegister.hidden=true;profileSuccess.hidden=true;profileWelcome.hidden=false;
        syncProfileLinks();
        profileStatus.hidden=false;
        profileStatus.textContent='برای ادامهٔ سفارش، وارد حساب شوید یا حساب بسازید. سبد خرید شما حفظ می‌شود.';
        profileWelcome.querySelector('[data-profile-action="ورود"]').focus();
        return;
      }
      pendingCheckout=false;
      setCheckoutMode(true);
      openAccountView();
      document.getElementById('address-book').scrollIntoView({block:'start'});
      addAddressButton.focus({preventScroll:true});
    }
    function transferGuestCart(mobile){
      const guestItems=cartItems.map(item=>({...item})),guestCode=cartCode;
      switchCartOwner(mobile);
      for(const guest of guestItems){
        const existing=cartItems.find(item=>cartItemKey(item)===cartItemKey(guest));
        if(existing)existing.quantity=Math.min(99,existing.quantity+guest.quantity);
        else cartItems.push(guest);
      }
      if(!cartCode&&guestCode)cartCode=guestCode;
      updateCartView();
      // Clear the guest copy only after the merged member cart is saved.
      try{
        const saved=localStorage.getItem(cartStorageKey);
        if(saved===JSON.stringify(cartItems)){
          localStorage.removeItem('fitnest-cart-v2:guest');
          localStorage.removeItem('fitnest-cart-code-v2:guest');
        }
      }catch{}
    }
    let authStep='mobile',authBusy=false,authGeneration=0,otpTimer=null,otpResendAt=0,otpExpiresAt=0;
    const authMobile=profileRegister.elements.mobile,authCode=profileRegister.elements.code,authSubmit=document.getElementById('auth-submit'),otpStep=document.getElementById('otp-code-step'),otpResend=document.getElementById('otp-resend');
    function digits(value){return String(value).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));}
    function normalizedAuthMobile(value){let number=digits(value).replace(/[ -]/g,'');if(number.startsWith('+98'))number='0'+number.slice(3);else if(number.startsWith('0098'))number='0'+number.slice(4);return number;}
    function authMessage(message,error=false){profileStatus.hidden=false;profileStatus.textContent=message;profileStatus.classList.toggle('is-error',error);}
    async function authApi(path,data){
      if(location.protocol==='file:')throw new Error('برای ورود پیامکی، سایت را از آدرس سرور باز کنید، نه فایل مستقیم.');
      let response;
      try{response=await fetch('/api/auth/'+path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(15000)});}
      catch{throw new Error('ارتباط با سرویس ورود برقرار نشد. دوباره تلاش کنید.');}
      let result;try{result=await response.json();}catch{throw new Error('سرویس ورود روی این میزبان فعال نیست.');}
      if(!response.ok){const error=new Error(result.message||'درخواست انجام نشد.');error.retryAfter=result.retryAfter||0;throw error;}
      return result;
    }
    function updateOtpTimer(){
      const wait=Math.max(0,Math.ceil((otpResendAt-Date.now())/1000)),remaining=Math.max(0,Math.ceil((otpExpiresAt-Date.now())/1000));
      otpResend.disabled=authBusy||wait>0;otpResend.textContent=wait?`ارسال مجدد پس از ${faDigits(wait)} ثانیه`:'ارسال مجدد کد';
      document.getElementById('otp-expiry').textContent=remaining?`اعتبار کد: ${faDigits(Math.floor(remaining/60))}:${faDigits(String(remaining%60).padStart(2,'0'))}`:'کد منقضی شده است؛ کد جدید بگیرید.';
    }
    function resetAuthForm(){
      authGeneration++;clearInterval(otpTimer);authBusy=false;authStep='mobile';
      profileRegister.reset();authMobile.readOnly=false;authMobile.disabled=false;authCode.disabled=true;authCode.required=false;otpStep.hidden=true;
      authSubmit.disabled=false;authSubmit.textContent='دریافت کد تأیید';
    }
    function showProfileAuth(mode){
      profileAuthMode=mode;resetAuthForm();
      profileWelcome.hidden=true;profileLinks.hidden=true;profileSuccess.hidden=true;profileRegister.hidden=false;
      profileRegister.querySelector('h3').textContent='ورود یا ساخت حساب';
      authMessage('شمارهٔ موبایل خود را وارد کنید تا کد تأیید ارسال شود.');authMobile.focus();
    }
    function acceptVerifiedUser(user,mergeGuest=false){
      if(!user||typeof user.id!=='string'||!/^[a-f0-9]{32}$/.test(user.id)||!/^09[0-9]{9}$/.test(user.mobile))throw new Error('پاسخ سرویس ورود معتبر نیست.');
      authenticatedUser={id:user.id,mobile:user.mobile};
      // Only the verified phone may adopt its own older demo profile.
      try{const legacy=JSON.parse(localStorage.getItem('fitnest-account-profile')||'{}');if(normalizedAuthMobile(legacy?.mobile||'')===user.mobile&&!localStorage.getItem(accountProfileKey()))localStorage.setItem(accountProfileKey(),JSON.stringify(legacy));}catch{}
      const profile=readAccountData();accountIdentity={name:profile.name||'کاربر',mobile:user.mobile};savedAddresses=profile.addresses;
      const mobileField=document.getElementById('account-mobile');mobileField.readOnly=true;
      profileToggle.classList.add('is-signed-in');profileToggle.setAttribute('aria-label','حساب کاربری، شمارهٔ موبایل تأیید شده');
      document.getElementById('profile-icon').innerHTML=iconMarkup.profileActive;
      if(mergeGuest)transferGuestCart(user.mobile);else switchCartOwner(user.mobile);
      profileRegister.hidden=true;profileWelcome.hidden=true;profileSuccess.hidden=false;syncProfileLinks();
      document.getElementById('profile-success-title').textContent=profile.name?`خوش آمدی، ${profile.name}`:'خوش آمدید';
      profileSuccess.querySelector('p').textContent='شمارهٔ موبایل شما تأیید شد.';
      authMessage('با موفقیت وارد حساب شدید.');if(pendingCheckout)openCheckout();
    }
    async function requestOtp(){
      const mobile=normalizedAuthMobile(authMobile.value);authMobile.value=mobile;
      if(!/^09[0-9]{9}$/.test(mobile)){authMessage('شمارهٔ موبایل را به‌شکل 09123456789 وارد کنید.',true);authMobile.focus();return;}
      if(authBusy)return;const generation=authGeneration;
      authBusy=true;authSubmit.disabled=true;otpResend.disabled=true;authMessage('در حال ارسال کد تأیید…');
      try{
        const result=await authApi('request',{mobile});if(generation!==authGeneration)return;
        authStep='code';authMobile.readOnly=true;otpStep.hidden=false;authCode.disabled=false;authCode.required=true;authCode.value='';
        document.getElementById('otp-recipient-text').textContent=`کد به ${mobile} ارسال شد`;
        otpResendAt=Date.now()+result.retryAfter*1000;otpExpiresAt=Date.now()+result.expiresIn*1000;
        clearInterval(otpTimer);otpTimer=setInterval(updateOtpTimer,1000);authSubmit.textContent='تأیید و ادامه';authMessage('کد ۴ رقمی پیامک‌شده را وارد کنید.');authCode.focus();
      }catch(error){if(generation===authGeneration)authMessage(error.message,true);}
      finally{if(generation===authGeneration){authBusy=false;authSubmit.disabled=false;if(authStep==='code')updateOtpTimer();}}
    }
    profileRegister.addEventListener('submit',async event=>{
      event.preventDefault();if(authBusy)return;
      if(authStep==='mobile'){await requestOtp();return;}
      const code=digits(authCode.value).trim();authCode.value=code;
      if(!/^[0-9]{4}$/.test(code)){authMessage('کد تأیید باید ۴ رقم باشد.',true);authCode.focus();return;}
      authBusy=true;authSubmit.disabled=true;const generation=authGeneration;
      try{const result=await authApi('verify',{code});if(generation!==authGeneration)return;clearInterval(otpTimer);acceptVerifiedUser(result.user,true);}
      catch(error){if(generation===authGeneration)authMessage(error.message,true);}
      finally{if(generation===authGeneration){authBusy=false;authSubmit.disabled=false;}}
    });
    authCode.addEventListener('input',()=>{authCode.value=digits(authCode.value).replace(/[^0-9]/g,'').slice(0,4);});
    document.getElementById('otp-edit-mobile').addEventListener('click',()=>{const mobile=authMobile.value;resetAuthForm();authMobile.value=mobile;authMessage('شمارهٔ موبایل را ویرایش کنید.');authMobile.focus();});
    otpResend.addEventListener('click',()=>{if(!authBusy&&Date.now()>=otpResendAt)requestOtp();});
    async function logoutVerifiedUser(){
      try{await authApi('logout',{});}
      catch(error){authMessage(error.message,true);return;}
      authenticatedUser=null;accountIdentity={name:'',mobile:''};savedAddresses=[];selectedAddressId=null;pendingCheckout=false;
      profileToggle.classList.remove('is-signed-in');switchCartOwner();profileToggle.setAttribute('aria-label','حساب کاربری');
      document.getElementById('profile-icon').innerHTML=iconMarkup.profile;syncProfileLinks();resetAuthForm();
      if(!accountView.hidden)closeAccountView();profileSuccess.hidden=true;profileRegister.hidden=true;profileWelcome.hidden=false;
      authMessage('از حساب کاربری خارج شدید.');
    }
    function updateCheckoutReview(){
      if(!checkoutMode)return;
      resetCheckoutConfirmation();
      const address=savedAddresses.find(item=>item.id===selectedAddressId);
      document.getElementById('checkout-address-summary').textContent=address?
        ['ارسال به',address.province,address.city,address.street,address.plate?'پلاک '+address.plate:'',address.unit?'واحد '+address.unit:'',address.postal?'کد پستی '+address.postal:''].filter(Boolean).join('، '):
        'برای ادامه، یک آدرس اضافه و انتخاب کن.';
      const lines=document.getElementById('checkout-lines');
      lines.replaceChildren();
      document.getElementById('checkout-cart-code').textContent=cartCode||'—';
      cartItems.forEach(item=>{
        const row=document.createElement('div');
        row.className='checkout-line';
        const copy=document.createElement('div');
        copy.className='checkout-line-copy';
        const title=document.createElement('strong');
        title.lang='en';title.dir='ltr';title.textContent=item.gender?`${item.gender==='men'?"MEN'S":"WOMEN'S"} ${item.title}${item.color&&item.size?` · ${item.color} / ${item.size}`:''}`:item.title;
        const quantity=document.createElement('small');
        quantity.textContent=faDigits(item.quantity)+' عدد × '+formatToman(sampleProductPrices[item.title]||0);
        const total=document.createElement('strong');
        total.textContent=formatToman(item.quantity*(sampleProductPrices[item.title]||0));
        copy.append(title,quantity);row.append(copy,total);lines.append(row);
      });
      document.getElementById('checkout-count').textContent=faDigits(cartItems.reduce((sum,item)=>sum+item.quantity,0));
      document.getElementById('checkout-total').textContent=formatToman(cartItems.reduce((sum,item)=>sum+item.quantity*(sampleProductPrices[item.title]||0),0));
      document.getElementById('checkout-confirm').disabled=!address||!cartItems.length||!addressForm.hidden;
    }
    document.getElementById('checkout-confirm').addEventListener('change',event=>{
      document.getElementById('checkout-finalize').disabled=!event.target.checked||event.target.disabled;
      document.getElementById('checkout-status').textContent='';
    });
    document.getElementById('checkout-finalize').addEventListener('click',()=>{
      const address=savedAddresses.find(item=>item.id===selectedAddressId);
      if(!checkoutMode||!address||!cartItems.length||!addressForm.hidden||!document.getElementById('checkout-confirm').checked)return;
      document.getElementById('checkout-status').textContent='بازبینی سفارش تأیید شد. پرداخت پس از اتصال درگاه امکان‌پذیر خواهد بود.';
      document.getElementById('checkout-finalize').disabled=true;
    });
    const purchaseSuccessBackdrop=document.getElementById('purchase-success-backdrop');
    let lastSuccessFocus=null;
    function openPurchaseSuccessPreview(){
      lastSuccessFocus=document.activeElement;
      purchaseSuccessBackdrop.classList.add('is-open');
      purchaseSuccessBackdrop.setAttribute('aria-hidden','false');
      document.body.classList.add('modal-open');
      document.getElementById('purchase-success-close').focus();
    }
    function closePurchaseSuccessPreview(){
      purchaseSuccessBackdrop.classList.remove('is-open');
      purchaseSuccessBackdrop.setAttribute('aria-hidden','true');
      if(!profileBackdrop.classList.contains('is-open'))document.body.classList.remove('modal-open');
      if(lastSuccessFocus?.isConnected)lastSuccessFocus.focus();
    }
    document.getElementById('checkout-success-preview').addEventListener('click',openPurchaseSuccessPreview);
    document.getElementById('purchase-success-close').addEventListener('click',closePurchaseSuccessPreview);
    purchaseSuccessBackdrop.addEventListener('click',event=>{if(event.target===purchaseSuccessBackdrop)closePurchaseSuccessPreview();});
    document.getElementById('purchase-success-done').addEventListener('click',()=>{closePurchaseSuccessPreview();closeProfile();window.scrollTo({top:0,behavior:'smooth'});});
    const productVisual=(p,showCardLabel=true)=>p.category==='supplements'?`<div class="pack">${showCardLabel?`<span class="pack-name">${p.english}</span><span class="pack-type">KAREN PHARMA</span>`:''}</div>`:`<div class="product-object">${showCardLabel?`<span>${p.mark}</span>`:''}</div>`;
    const productModal=document.getElementById('product-modal-backdrop');
    const productModalTitle=document.getElementById('product-modal-title');
    const productModalMedia=document.getElementById('product-modal-media');
    const productModalStatus=document.getElementById('product-modal-status');
    const productModalAdd=document.getElementById('product-modal-add');
    const productQuantity=document.getElementById('product-quantity');
    const cartItemKey=item=>`${item.title}|${item.gender||''}|${item.color||''}|${item.size||''}`;
    function updateCartView(){
      cartCount=cartItems.reduce((sum,item)=>sum+item.quantity,0);
      if(cartCount&&!cartCode)cartCode=makeCartCode();
      if(!cartCount)cartCode='';
      try{
        localStorage.setItem(cartStorageKey,JSON.stringify(cartItems));
        if(cartCode)localStorage.setItem(cartCodeStorageKey,cartCode);
        else localStorage.removeItem(cartCodeStorageKey);
      }catch{}
      document.getElementById('cart-code-row').hidden=!cartCode;
      document.getElementById('cart-code').textContent=cartCode;
      cartButton.classList.toggle('has-items',cartCount>0);
      cartButton.setAttribute('aria-label',`سبد خرید، ${faDigits(cartCount)} کالا`);
      cartCountLabel.textContent=faDigits(cartCount);
      cartCheckoutButton.disabled=cartCount===0;
      const cartTotal=cartItems.reduce((sum,item)=>sum+(sampleProductPrices[item.title]||0)*item.quantity,0);
      cartTotalElement.textContent=formatToman(cartTotal);
      updateCheckoutReview();
      cartItemsElement.replaceChildren();
      if(!cartItems.length){
        const empty=document.createElement('div');empty.className='cart-empty';empty.textContent='سبد خریدت هنوز خالی است. از بین محصولات، چیزی برای تمرینت انتخاب کن.';cartItemsElement.append(empty);
      }
      for(const item of cartItems){
        const product=products.find(p=>p.english===item.title);if(!product)continue;
        const row=document.createElement('article');row.className='cart-line';
        const copy=document.createElement('div');copy.className='cart-line-copy';
        const category=document.createElement('small');category.lang='en';category.textContent=product.category==='clothing'&&item.gender?`${item.gender==='men'?"Men's":"Women's"} Clothing`:cartCategoryLabels[product.category];
        const title=document.createElement('strong');title.lang='en';title.dir='ltr';title.textContent=item.title;
        copy.append(category,title);
        if(item.color&&item.size){const variant=document.createElement('span');variant.className='cart-line-price';variant.textContent=`${item.color} · ${item.size}`;copy.append(variant);}
        const price=document.createElement('span');price.className='cart-line-price';price.textContent=formatToman(sampleProductPrices[item.title]||0)+' قیمت هر عدد';copy.append(price);
        const tools=document.createElement('div');tools.className='cart-line-tools';const key=cartItemKey(item);
        const button=(attribute,text,label)=>{const element=document.createElement('button');element.type='button';element.className=attribute==='cartRemove'?'cart-remove':'cart-quantity-button';element.dataset[attribute]=key;element.textContent=text;if(label)element.setAttribute('aria-label',label);return element;};
        const quantity=document.createElement('output');quantity.className='cart-quantity';quantity.textContent=faDigits(item.quantity);
        tools.append(button('cartMinus','−','کم کردن تعداد '+item.title),quantity,button('cartPlus','+','زیاد کردن تعداد '+item.title),button('cartRemove','حذف'));
        row.append(copy,tools);cartItemsElement.append(row);
      }
    }
    function openCart(){
      lastCartFocus=document.activeElement;
      cartBackdrop.classList.add('is-open');
      cartBackdrop.setAttribute('aria-hidden','false');
      document.body.classList.add('modal-open');
      document.getElementById('cart-close').focus();
    }
    function closeCart(){
      cartBackdrop.classList.remove('is-open');
      cartBackdrop.setAttribute('aria-hidden','true');
      document.body.classList.remove('modal-open');
      if(lastCartFocus?.isConnected)lastCartFocus.focus();
    }
    let lastProfileFocus=null;
    function openProfile(){
      lastProfileFocus=document.activeElement;
      profileBackdrop.classList.add('is-open');
      profileBackdrop.setAttribute('aria-hidden','false');
      profileToggle.setAttribute('aria-expanded','true');
      document.body.classList.add('modal-open');
      document.getElementById('profile-close').focus();
    }
    function closeProfile(){
      pendingCheckout=false;
      if(mapPicker.classList.contains('is-open'))closeMapPicker();
      if(!accountView.hidden)closeAccountView();
      profileBackdrop.classList.remove('is-open');
      profileBackdrop.setAttribute('aria-hidden','true');
      profileToggle.setAttribute('aria-expanded','false');
      document.body.classList.remove('modal-open');
      if(lastProfileFocus?.isConnected)lastProfileFocus.focus();
    }
    document.getElementById('profile-register-back').addEventListener('click',()=>{resetAuthForm();profileRegister.hidden=true;profileWelcome.hidden=false;authMessage('');});
    document.getElementById('account-back').addEventListener('click',()=>{
      if(checkoutMode){closeProfile();openCart();}
      else closeAccountView();
    });
    const mapElement=document.getElementById('address-map');
    const mapSearchInput=document.getElementById('map-search-input');
    const mapConfirmButton=document.getElementById('map-picker-confirm');
    const mapCoordinatesLabel=document.getElementById('map-picker-coords');
    const mapKeySetup=document.getElementById('neshan-key-setup');
    const mapHint=mapPicker.querySelector('.map-picker-hint');
    const mapInstructions='ابتدا شهر یا استان را پیدا کن. سپس روی محل دقیق تحویل بزن یا پین را جابه‌جا کن.';
    let draftCoordinates=null, mapPlace=null, mapSession=0, mapSearchRequest=0;
    const provincialCenters=[
      ['تهران','تهران',35.6892,51.3890],['البرز','کرج',35.8400,50.9391],['خراسان رضوی','مشهد',36.2972,59.6067],
      ['اصفهان','اصفهان',32.6546,51.6680],['فارس','شیراز',29.5918,52.5837],['آذربایجان شرقی','تبریز',38.0962,46.2738],
      ['قم','قم',34.6416,50.8746],['گیلان','رشت',37.2808,49.5832],['خوزستان','اهواز',31.3183,48.6706],
      ['یزد','یزد',31.8974,54.3569],['آذربایجان غربی','ارومیه',37.5527,45.0761],['اردبیل','اردبیل',38.2498,48.2933],
      ['ایلام','ایلام',33.6374,46.4227],['بوشهر','بوشهر',28.9234,50.8203],['چهارمحال و بختیاری','شهرکرد',32.3256,50.8644],
      ['خراسان جنوبی','بیرجند',32.8649,59.2262],['خراسان شمالی','بجنورد',37.4747,57.3290],['زنجان','زنجان',36.6736,48.4787],
      ['سمنان','سمنان',35.5769,53.3953],['سیستان و بلوچستان','زاهدان',29.4963,60.8629],['قزوین','قزوین',36.2688,50.0041],
      ['کردستان','سنندج',35.3149,46.9988],['کرمان','کرمان',30.2832,57.0788],['کرمانشاه','کرمانشاه',34.3142,47.0650],
      ['کهگیلویه و بویراحمد','یاسوج',30.6682,51.5879],['گلستان','گرگان',36.8456,54.4393],['لرستان','خرم‌آباد',33.4878,48.3558],
      ['مازندران','ساری',36.5633,53.0601],['مرکزی','اراک',34.0954,49.7013],['هرمزگان','بندرعباس',27.1832,56.2666],
      ['همدان','همدان',34.7989,48.5150]
    ];
    function focusAddressDetails(id){
      const field=document.getElementById(id);
      field.focus({preventScroll:true});
      field.scrollIntoView({block:'nearest'});
    }
    function closeMapPicker(){
      mapSession++;
      clearTimeout(mapSearchTimer);
      mapPicker.classList.remove('is-open');
      profileBackdrop.inert=false;
      if(!accountView.hidden)focusAddressDetails('open-address-map');
      mapPicker.setAttribute('aria-hidden','true');
    }
    const NESHAN_MAP_KEY_STORAGE='fitnest-neshan-map-key', NESHAN_SERVICE_KEY_STORAGE='fitnest-neshan-services-key';
    const isLocalPreview=['localhost','127.0.0.1','[::1]',''].includes(location.hostname);
    if(!isLocalPreview)document.body.classList.add('public-preview');
    function readNeshanKey(storageKey){
      try{
        if(storageKey===NESHAN_SERVICE_KEY_STORAGE)return isLocalPreview?(sessionStorage.getItem(storageKey)||''):'';
        return localStorage.getItem(storageKey)?.trim()||'';
      }catch{return '';}
    }
    try{
      // Migrate an existing local test key into this tab only; never migrate it on a public origin.
      const legacy=localStorage.getItem(NESHAN_SERVICE_KEY_STORAGE)||localStorage.getItem('fitnest-neshan-web-key')||'';
      if(isLocalPreview&&legacy.startsWith('service.'))sessionStorage.setItem(NESHAN_SERVICE_KEY_STORAGE,legacy);
      localStorage.removeItem(NESHAN_SERVICE_KEY_STORAGE);
      if(legacy.startsWith('service.'))localStorage.removeItem('fitnest-neshan-web-key');
      document.getElementById('neshan-map-key').value=readNeshanKey(NESHAN_MAP_KEY_STORAGE);
      const serviceField=document.getElementById('neshan-service-key');
      serviceField.value=readNeshanKey(NESHAN_SERVICE_KEY_STORAGE);
      serviceField.hidden=!isLocalPreview;serviceField.disabled=!isLocalPreview;
    }catch{}
    function ensureNeshan(){
      if(window.L)return Promise.resolve();
      if(window._fitnestNeshanPromise)return window._fitnestNeshanPromise;
      window._fitnestNeshanPromise=new Promise((resolve,reject)=>{
        if(!document.getElementById('neshan-leaflet-css')){const link=document.createElement('link');link.id='neshan-leaflet-css';link.rel='stylesheet';link.href='https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.css';document.head.append(link);}
        const script=document.createElement('script');
        script.src='https://static.neshan.org/sdk/leaflet/v1.9.4/neshan-sdk/v1.0.8/index.js';
        const fail=()=>{
          clearTimeout(timeout);
          script.remove();
          reject(new Error('Neshan SDK unavailable'));
        };
        const timeout=setTimeout(fail,12000);
        script.onload=()=>{
          clearTimeout(timeout);
          if(window.L?.Map)resolve();
          else fail();
        };
        script.onerror=fail;
        document.head.append(script);
      }).catch(error=>{window._fitnestNeshanPromise=null;throw error;});return window._fitnestNeshanPromise;
    }
    function showMapMessage(message){
      const status=document.createElement('div');
      status.className='map-picker-error';
      status.setAttribute('role','status');
      status.textContent=message;
      mapElement.replaceChildren(status);
    }
    function watchMapTiles(map){
      function watchLayer(layer){
        if(!(layer instanceof L.GridLayer))return;
        let tileLoaded=false;
        layer.on('loading',()=>{tileLoaded=false;});
        layer.on('tileload',()=>{
          tileLoaded=true;
          mapHint.textContent=mapInstructions;
        });
        layer.on('tileerror',()=>{
          if(tileLoaded)return;
          mapHint.textContent='تصویر نقشه بارگذاری نشد. اتصال اینترنت، کلید نقشه وب و دامنهٔ مجاز را بررسی کن.';
          mapKeySetup.hidden=false;
        });
      }
      if(!L.GridLayer)return;
      map.eachLayer(watchLayer);
      map.on('layeradd',event=>watchLayer(event.layer));
    }
    async function loadAddressMap(session){
      const apiKey=readNeshanKey(NESHAN_MAP_KEY_STORAGE);
      mapKeySetup.hidden=Boolean(apiKey?.startsWith('web.')&&readNeshanKey(NESHAN_SERVICE_KEY_STORAGE));
      if(!apiKey.startsWith('web.')){
        showMapMessage('برای نمایش نقشه، کلید «نقشه وب» نشان را وارد کن.');
        return;
      }
      if(!accountMap)showMapMessage('در حال بارگذاری نقشهٔ نشان…');
      try{
        await ensureNeshan();
        if(session!==mapSession)return;
        const city=document.getElementById('address-city').value.trim();
        const localCenter=provincialCenters.find(([,name])=>name===city)?.slice(2);
        const center=draftCoordinates?[draftCoordinates.lat,draftCoordinates.lng]:mapPlace?.center??localCenter??[35.6892,51.3890];
        const zoom=draftCoordinates?16:mapPlace?.zoom??12;
        if(!accountMap){
          mapElement.replaceChildren();
          accountMap=new L.Map(mapElement.id,{key:apiKey,maptype:'standard-night',center,zoom});
          accountMap.on('click',event=>setMapMarker(event.latlng));
          watchMapTiles(accountMap);
        }else{
          accountMap.setView(center,zoom);
        }
        if(draftCoordinates)setMapMarker(draftCoordinates);
        accountMap.invalidateSize();
      }catch{
        if(session!==mapSession)return;
        showMapMessage('نقشهٔ نشان بارگذاری نشد. اتصال اینترنت و سپس کلید نقشه وب و دامنهٔ مجاز را بررسی کن.');
        mapKeySetup.hidden=false;
      }
    }
    function openMapPicker(){
      const province=document.getElementById('address-province'),city=document.getElementById('address-city');
      document.getElementById('map-picker-place').textContent=province.value.trim()||city.value.trim()?`${province.value.trim()} ${city.value.trim()} — برای تغییر شهر یا محله جست‌وجو کن.`:'استان، شهر یا نشانی را جست‌وجو کن.';
      document.getElementById('map-search-results').hidden=true;
      mapHint.textContent=mapInstructions;
      mapSearchInput.value='';
      mapPlace=null;
      clearMapPoint();
      draftCoordinates=pickedCoordinates;
      mapPicker.setAttribute('aria-hidden','false');
      mapPicker.classList.add('is-open');
      profileBackdrop.inert=true;
      mapSearchInput.focus({preventScroll:true});
      loadAddressMap(++mapSession);
    }
    document.getElementById('open-address-map').addEventListener('click',openMapPicker);
    let mapSearchTimer=0,mapSearchResults=[];
    function normalizeMapSearch(value){
      return value.replaceAll('ي','ی').replaceAll('ك','ک').replace(/[\s\u200c-]+/g,'').replace(/^استان/u,'');
    }
    async function searchMapLocations(term){
      const session=mapSession, request=++mapSearchRequest;
      const resultsBox=document.getElementById('map-search-results');
      const search=normalizeMapSearch(term);
      if(!search)return;
      const localResults=provincialCenters.flatMap(([province,city,lat,lng])=>{
        const cityMatch=normalizeMapSearch(city).includes(search);
        const provinceMatch=normalizeMapSearch(province).includes(search);
        if(!cityMatch&&!provinceMatch)return [];
        const isProvince=/^استان\s/u.test(term)||!cityMatch;
        return [{province,city,title:isProvince?`استان ${province}`:city,center:[lat,lng],zoom:isProvince?9:12}];
      });
      resultsBox.hidden=false;
      if(localResults.length){
        renderMapResults(resultsBox,localResults);
        return;
      }
      resultsBox.innerHTML='<div class="map-search-message">در حال جست‌وجو…</div>';
      const apiKey=readNeshanKey(NESHAN_SERVICE_KEY_STORAGE);
      if(!apiKey){
        resultsBox.innerHTML='<div class="map-search-message">جست‌وجوی دقیق نشانی هنوز به سرویس امن سایت متصل نیست؛ شهر را انتخاب و موقعیت را روی نقشه مشخص کنید.</div>';
        mapKeySetup.hidden=false;
        return;
      }
      try{
        const normalizedTerm=term.replaceAll('ي','ی').replaceAll('ك','ک').trim();
        const explicitCity=provincialCenters
          .filter(([,city])=>new RegExp(`(?:^|[\\s،,])${city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[\\s،,])`).test(normalizedTerm))
          .sort((a,b)=>b[1].length-a[1].length)[0];
        const scope=explicitCity?{province:explicitCity[0],city:explicitCity[1]}:
          mapPlace?.city?{province:mapPlace.province,city:mapPlace.city}:{};
        async function lookup(address){
          const query=encodeURIComponent(JSON.stringify({address,...scope}));
          const response=await fetch(`https://api.neshan.org/geocoding/v1?json=${query}`,{headers:{'Api-Key':apiKey},signal:AbortSignal.timeout(8000)});
          if(!response.ok)throw new Error(String(response.status));
          const data=await response.json();
          return (data.items??[]).filter(item=>{
            const city=normalizeMapSearch((item.city||'').replace(/^(شهر|شهرستان)\s+/,''));
            const province=normalizeMapSearch(item.province||'');
            return Number.isFinite(item.location?.latitude)&&Number.isFinite(item.location?.longitude)&&
              (!scope.city||city===normalizeMapSearch(scope.city))&&
              (!scope.province||province===normalizeMapSearch(scope.province));
          });
        }
        let items=await lookup(normalizedTerm);
        if(session!==mapSession||request!==mapSearchRequest)return;
        if(!items.length&&explicitCity){
          const cityName=explicitCity[1];
          const remainder=normalizedTerm.replace(new RegExp(`(?:^|[\\s،,])${cityName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=$|[\\s،,])`),' ').trim();
          if(remainder)items=await lookup(remainder);
        }
        if(session!==mapSession||request!==mapSearchRequest)return;
        const results=items.map(item=>({
          province:item.province,city:item.city,title:item.neighbourhood||item.city||term,
          center:[item.location.latitude,item.location.longitude],zoom:item.neighbourhood?15:12
        }));
        renderMapResults(resultsBox,results);
      }catch(error){
        if(session!==mapSession||request!==mapSearchRequest)return;
        resultsBox.innerHTML='<div class="map-search-message"></div>';
        const code=/^\d{3}$/.test(error.message)?` (کد ${error.message})`:'';
        resultsBox.firstElementChild.textContent=`جست‌وجوی نشان در دسترس نیست${code}. اتصال اینترنت و دسترسی کلید به سرویس تبدیل آدرس به نقطه را بررسی کن.`;
      }
    }
    function renderMapResults(box,results){
      mapSearchResults=results;
      if(!results.length){
        box.innerHTML='<div class="map-search-message">نتیجه‌ای پیدا نشد. نام استان یا شهر را دقیق‌تر بنویس.</div>';
        return;
      }
      box.replaceChildren(...results.map((item,index)=>{
        const option=document.createElement('button');option.type='button';option.className='map-search-result';option.dataset.mapResult=String(index);
        const icon=document.createElement('span');icon.className='map-search-pin';icon.setAttribute('aria-hidden','true');icon.textContent='⌖';
        const copy=document.createElement('span');copy.className='map-search-result-copy';
        const title=document.createElement('strong');title.textContent=item.title;
        const detail=document.createElement('small');detail.textContent=[item.city,item.province].filter(Boolean).join('، ');
        copy.append(title,detail);option.append(icon,copy);return option;
      }));
    }
    document.getElementById('map-search-form').addEventListener('submit',event=>{
      event.preventDefault();
      clearTimeout(mapSearchTimer);
      const term=mapSearchInput.value.trim();
      if(term)searchMapLocations(term);
    });
    mapSearchInput.addEventListener('input',event=>{
      clearTimeout(mapSearchTimer);
      mapSearchRequest++;
      document.getElementById('map-search-results').hidden=true;
      const term=event.target.value.trim();
      if(term.length>=2)mapSearchTimer=setTimeout(()=>searchMapLocations(term),420);
    });
    document.getElementById('map-search-results').addEventListener('click',event=>{
      const option=event.target.closest('[data-map-result]');if(!option)return;const item=mapSearchResults[Number(option.dataset.mapResult)];if(!item)return;
      mapPlace=item;
      clearMapPoint();
      accountMap?.setView(item.center,item.zoom);
      mapSearchInput.value=item.title;
      document.getElementById('map-picker-place').textContent=`${item.title} · محل دقیق تحویل را روی نقشه انتخاب کن.`;
      document.getElementById('map-search-results').hidden=true;
      mapSearchInput.focus({preventScroll:true});
    });
    document.getElementById('save-neshan-key').addEventListener('click',async()=>{
      const mapKey=document.getElementById('neshan-map-key').value.trim(),serviceKey=document.getElementById('neshan-service-key').value.trim();
      try{
        if(mapKey)localStorage.setItem(NESHAN_MAP_KEY_STORAGE,mapKey);
        if(serviceKey&&isLocalPreview)sessionStorage.setItem(NESHAN_SERVICE_KEY_STORAGE,serviceKey);
        if(accountMap){accountMap.remove();accountMap=null;accountMarker=null;}
        await loadAddressMap(mapSession);
      }catch{showMapMessage('ذخیرهٔ تنظیمات نقشه در این مرورگر ممکن نشد.');}
    });
    function clearMapPoint(){
      accountMarker?.remove();
      accountMarker=null;
      draftCoordinates=null;
      mapConfirmButton.disabled=true;
      mapCoordinatesLabel.textContent='نقطهٔ دقیق تحویل را روی نقشه انتخاب کن.';
    }
    function setMapMarker(latlng){
      if(accountMarker)accountMarker.setLatLng(latlng);
      else{
        accountMarker=L.marker(latlng,{draggable:true,alt:'موقعیت تحویل سفارش'}).addTo(accountMap);
        accountMarker.on('dragend',()=>setMapMarker(accountMarker.getLatLng()));
      }
      draftCoordinates={lat:latlng.lat,lng:latlng.lng};
      mapCoordinatesLabel.textContent=`${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
      mapConfirmButton.disabled=false;
    }
    document.getElementById('map-picker-confirm').addEventListener('click',async()=>{
      if(!draftCoordinates)return;
      const coordinates=pickedCoordinates=draftCoordinates;
      const status=document.getElementById('account-map-status');
      const apiKey=readNeshanKey(NESHAN_SERVICE_KEY_STORAGE);
      const province=addressForm.elements.namedItem('province');
      const city=addressForm.elements.namedItem('city');
      const street=addressForm.elements.namedItem('street');
      if(mapPlace?.province)province.value=mapPlace.province;
      if(mapPlace?.city)city.value=mapPlace.city;
      const valuesBeforeLookup=[province.value,city.value,street.value];
      const point=`${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)}`;
      status.textContent=`موقعیت انتخاب شد (${point}).`;
      closeMapPicker();
      focusAddressDetails(street.value?'address-plate':'address-line');
      if(!apiKey)return;
      const session=mapSession;
      try{
        const url=`https://api.neshan.org/v5/reverse?lat=${coordinates.lat}&lng=${coordinates.lng}`;
        const response=await fetch(url,{headers:{'Api-Key':apiKey},signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new Error('Reverse lookup failed');
        const result=await response.json();
        if(mapSession!==session||addressForm.hidden||pickedCoordinates!==coordinates)return;
        const fields=[province,city,street];
        [result.state,result.city||result.village,result.formatted_address].forEach((value,index)=>{
          if(value&&fields[index].value===valuesBeforeLookup[index])fields[index].value=value;
        });
      }catch{
        if(mapSession===session&&!addressForm.hidden&&pickedCoordinates===coordinates)
          status.textContent=`موقعیت انتخاب شد (${point}). نشانی را در فرم وارد یا بررسی کن.`;
      }
    });
    document.getElementById('map-picker-close').addEventListener('click',closeMapPicker);
    mapPicker.addEventListener('click',event=>{if(event.target===mapPicker)closeMapPicker();});
    function adjustCartItem(key,change){
      const item=cartItems.find(row=>cartItemKey(row)===key);
      if(!item)return;
      if(![-1,1].includes(change))return;
      item.quantity=Math.min(99,item.quantity+change);
      if(item.quantity<=0)cartItems=cartItems.filter(row=>cartItemKey(row)!==key);
      updateCartView();
      cartStatus.textContent='سبد خرید به‌روز شد';
    }
    function openProductModal(product,trigger){
      activeProduct=product; modalQuantity=1; lastProductTrigger=trigger;
      const title=product.english||'Fitness Product', available=product.inStock!==false;
      productModalTitle.textContent=product.gender?`${product.gender==='men'?"MEN'S":"WOMEN'S"} ${title}`:title;
      document.getElementById('product-modal-kicker').textContent=product.category==='clothing'&&product.gender?`پوشاک ورزشی ${product.gender==='men'?'مردانه':'زنانه'}`:productCategoryLabels[product.category]||'اطلاعات محصول';
      document.getElementById('product-modal-description').textContent=product.subtitle||'توضیحات کامل این محصول در مرحلهٔ بعد اضافه می‌شود.';
      document.getElementById('product-nutrition-panel').hidden=product.category!=='supplements';
      productModalStatus.textContent=available?'موجود':'ناموجود';
      productModalStatus.classList.toggle('is-unavailable',!available);
      productModalMedia.className=`product-modal-media product-photo--${product.category}`;
      productModalMedia.innerHTML=productVisual(product,false);
      document.getElementById('clothing-info').hidden=product.category!=='clothing';
      const thumbnails=document.getElementById('product-modal-thumbnails');
      thumbnails.innerHTML=product.category==='clothing'?['front','back','fabric'].map((view,index)=>`<button class="product-modal-thumb" type="button" data-product-view="${view}" aria-pressed="${index===0}">${['روبه‌رو','پشت','بافت'][index]}</button>`).join(''):'';
      productModalMedia.dataset.view='front';
      if(product.category==='clothing'){
        const colors=['مشکی','بنفش','خاکستری'],sizes=['S','M','L','XL'];
        const color=document.getElementById('clothing-color'),size=document.getElementById('clothing-size');
        color.innerHTML='<option value="">انتخاب رنگ</option>'+colors.map(value=>`<option>${value}</option>`).join('');
        size.innerHTML='<option value="">انتخاب سایز</option>'+sizes.map(value=>`<option>${value}</option>`).join('');
        document.getElementById('clothing-size-rows').innerHTML=sizes.map((value,index)=>`<tr><td>${value}</td><td>${48+index*4} cm</td><td>${65+index*2} cm</td></tr>`).join('');
        document.getElementById('clothing-specs').innerHTML=`<li>شناسهٔ نمونه: FN-${product.gender==='women'?'W':'M'}-${product.mark}</li><li>نوع: ${product.english}</li><li>جنس، کشسانی و فرم لباس: در انتظار اطلاعات واقعی محصول</li><li>مشخصات مدل و سایز تن مدل: در انتظار عکس و اطلاعات واقعی</li><li>روش شست‌وشو: پس از ثبت مشخصات پارچه درج می‌شود.</li>`;
        document.getElementById('clothing-recommendations').innerHTML=products.filter(item=>item.category==='clothing'&&item.english!==product.english).slice(0,3).map(item=>`<button type="button" data-recommend-product="${item.english}">${item.english}</button>`).join('');
        updateClothingStock();
      }
      else productModalAdd.disabled=!available;
      productQuantity.textContent=String(modalQuantity);
      productModal.classList.add('is-open');
      productModal.setAttribute('aria-hidden','false');
      document.body.classList.add('modal-open');
      document.getElementById('product-modal-close').focus();
    }
    function updateClothingStock(){
      if(activeProduct?.category!=='clothing')return;
      const color=document.getElementById('clothing-color').value,size=document.getElementById('clothing-size').value;
      const available=Boolean(color&&size)&&!(color==='بنفش'&&size==='XL');
      const status=document.getElementById('clothing-stock');
      status.textContent=!color||!size?'برای بررسی موجودی، رنگ و سایز را انتخاب کن.':available?'موجود · آمادهٔ افزودن به سبد':'ناموجود در این رنگ و سایز';
      status.style.color=available?'#74d99a':'#f2838d';
      productModalStatus.textContent=!color||!size?'انتخاب رنگ و سایز':available?'موجود':'ناموجود';
      productModalStatus.classList.toggle('is-unavailable',Boolean(color&&size&&!available));
      productModalAdd.disabled=!available;
    }
    ['clothing-color','clothing-size'].forEach(id=>document.getElementById(id).addEventListener('change',updateClothingStock));
    document.getElementById('product-modal-thumbnails').addEventListener('click',event=>{const button=event.target.closest('[data-product-view]');if(!button)return;productModalMedia.dataset.view=button.dataset.productView;document.querySelectorAll('[data-product-view]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));});
    document.getElementById('clothing-recommendations').addEventListener('click',event=>{const button=event.target.closest('[data-recommend-product]');if(!button)return;const item=products.find(product=>product.english===button.dataset.recommendProduct);if(item)openProductModal({...item,gender:activeProduct.gender},button);});
    function closeProductModal(){
      productModal.classList.remove('is-open');
      productModal.setAttribute('aria-hidden','true');
      document.body.classList.remove('modal-open');
      if(lastProductTrigger?.isConnected)lastProductTrigger.focus();
      activeProduct=null;
    }
    function addToCart(title,quantity=1,gender=null,color='',size=''){
      const product=products.find(p=>p.english===title);
      if(!product||product.inStock===false||!Number.isInteger(quantity)||quantity<1)return;
      quantity=Math.min(quantity,99);
      gender=['men','women'].includes(gender)?gender:null;
      if(product.category==='clothing'&&(!gender||!['مشکی','بنفش','خاکستری'].includes(color)||!['S','M','L','XL'].includes(size)))return;
      const item=cartItems.find(row=>row.title===title&&row.gender===gender&&row.color===color&&row.size===size);
      if(item)item.quantity=Math.min(99,item.quantity+quantity);
      else cartItems.push({title,quantity,gender,color,size});
      updateCartView();
      cartStatus.textContent='محصول به سبد خرید اضافه شد';
      if(productModal.classList.contains('is-open'))closeProductModal();
      openCart();
    }
    const catalogGender=new URLSearchParams(location.search).get('clothing');
    const isClothingCatalog=['men','women'].includes(catalogGender);
    let clothingTypeFilter='all';
    if(isClothingCatalog){
      const catalog=document.getElementById('clothing-catalog');
      [...document.querySelector('main').children].forEach(section=>section.hidden=section!==catalog);
      document.getElementById('catalog-title').textContent=catalogGender==='men'?'Men’s Clothing':'Women’s Clothing';
      document.title=`FitNestPro | ${catalogGender==='men'?"Men’s":"Women’s"} Clothing`;
      document.getElementById('catalog-back').href=`index.html#${catalogGender==='men'?'clothing':'womens-clothing'}`;
      document.querySelector('.wordmark').href='index.html';
    }
    document.getElementById('clothing-type-filter').addEventListener('change',event=>{clothingTypeFilter=event.target.value;drawProducts();});
    function drawProducts(){
      const grids=isClothingCatalog?{catalog:'catalog-grid'}:productGrids;
      Object.entries(grids).forEach(([category,gridId])=>{
        const grid=document.getElementById(gridId);
        const sourceCategory=category==='catalog'||category==='womensClothing'?'clothing':category;
        let visible=products.filter(p=>p.category===sourceCategory&&(sourceCategory!=='supplements'||activeSupplementCategory==='all'||p.supplementCategory===activeSupplementCategory)&&(category!=='catalog'||clothingTypeFilter==='all'||p.mark===clothingTypeFilter));
        if(sourceCategory==='clothing'&&!isClothingCatalog)visible=visible.slice(0,4);
        const showcase=sourceCategory==='clothing'&&!isClothingCatalog;
        grid.classList.toggle('clothing-showcase',showcase);
        if(category==='catalog')document.getElementById('catalog-count').textContent=`${faDigits(visible.length)} محصول`;
        const cards=visible.map(p=>{
          const visual=productVisual(p);
          const gender=category==='catalog'?catalogGender:category==='clothing'?'men':category==='womensClothing'?'women':null;
          const brand=p.category==='clothing'?`${gender==='men'?"MEN'S":"WOMEN'S"} SPORTSWEAR`:p.category==='supplements'?`KAREN PHARMA · ${productTypes[p.type]||'Sports Nutrition'}`:(productTypes[p.type]||'Fitness');
          const title=p.english||'Fitness Product';
          const description=productDescriptions[title]||'Quality gear for your training routine';
          const badge=productBadges[p.tag]||'FEATURED';
          const available=p.inStock!==false;
          return `<article class="product-card" dir="ltr"><div class="product-photo product-photo--${p.category}" data-open-product="${title}" data-gender="${gender||''}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="نمایش جزئیات ${title}"><span class="product-badge">${badge}</span>${visual}</div><div class="product-info"><div class="product-brand">${brand}</div><h3 class="product-title">${title}</h3><div class="product-subtitle">${description}</div><div class="product-bottom">${p.category==='clothing'?'':`<span class="stock-status ${available?'stock-status--available':'stock-status--unavailable'}" lang="fa">${available?'موجود':'ناموجود'}</span>`}<button class="add-button" type="button" aria-label="${available?'افزودن '+title+' به سبد خرید':title+' ناموجود است'}" data-add="${title}" data-gender="${gender||''}" ${available?'':'disabled'}><b aria-hidden="true">+</b><span lang="fa">افزودن به سبد خرید</span></button></div></div></article>`;
        });
        if(showcase)cards.splice(Math.min(2,cards.length),0,`<a class="clothing-view-all" href="index.html?clothing=${category==='clothing'?'men':'women'}" aria-label="دیدن همه محصولات ${category==='clothing'?'مردانه':'زنانه'}"><small aria-hidden="true">EXPLORE</small><span>دیدن همه محصولات</span></a>`);
        grid.innerHTML=cards.length?cards.join(''):'<p class="product-subtitle">محصولی در این دسته موجود نیست.</p>';
      });
    }
    const searchWrap=document.getElementById('search-wrap'),searchToggle=document.getElementById('search-toggle'),searchInput=document.getElementById('search'),searchPanel=document.getElementById('search-panel');
    const searchHistoryKey='fitnest-search-history-v1',popularSearches=['WHEY','CREATINE','TRAINING TEE','SHAKER','PROTEIN BAR'];
    function readSearchHistory(){try{const value=JSON.parse(localStorage.getItem(searchHistoryKey)||'[]');return Array.isArray(value)?value.filter(item=>typeof item==='string').map(item=>item.slice(0,120)).slice(0,6):[];}catch{return [];}}
    function saveSearchHistory(term){
      const query=term.trim().slice(0,120);if(!query)return;
      try{localStorage.setItem(searchHistoryKey,JSON.stringify([query,...readSearchHistory().filter(item=>item.toLowerCase()!==query.toLowerCase())].slice(0,6)));}catch{}
    }
    function searchMatches(term){
      const words=term.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      if(!words.length)return [];
      const variants=products.flatMap(product=>product.category==='clothing'?[{...product,gender:'men'},{...product,gender:'women'}]:[product]);
      return variants.filter(product=>{
        const category=product.category==='supplements'?'supplement مکمل':product.category==='clothing'?'clothing پوشاک لباس':'gear تجهیزات';
        const searchable=`${product.english} ${product.name} ${product.subtitle} ${category}`.toLocaleLowerCase();
        return words.every(word=>{
          if(['men',"men's",'male','مردانه'].includes(word))return product.gender==='men';
          if(['women',"women's",'female','زنانه'].includes(word))return product.gender==='women';
          return searchable.includes(word);
        });
      });
    }
    function searchHeading(title,aside){const row=document.createElement('div'),heading=document.createElement('strong');row.className='search-panel-head';heading.textContent=title;row.append(heading);if(aside)row.append(aside);searchPanel.append(row);}
    function searchChip(term){const button=document.createElement('button');button.type='button';button.className='search-chip';button.dataset.searchTerm=term;button.textContent=term;return button;}
    function renderSearchPanel(){
      searchPanel.replaceChildren();const term=searchInput.value.trim();
      if(!term){
        searchHeading('جست‌وجوهای پرطرفدار');const popular=document.createElement('div');popular.className='search-chips';popularSearches.forEach(value=>popular.append(searchChip(value)));searchPanel.append(popular);
        const history=readSearchHistory();const clear=document.createElement('button');clear.type='button';clear.className='search-panel-clear';clear.textContent='پاک کردن سابقه';clear.dataset.clearSearchHistory='';
        searchHeading('جست‌وجوهای اخیر',history.length?clear:null);
        if(history.length){const chips=document.createElement('div');chips.className='search-chips';history.forEach(value=>chips.append(searchChip(value)));searchPanel.append(chips);}
        else{const empty=document.createElement('p');empty.className='search-history-empty';empty.textContent='هنوز جست‌وجویی ثبت نشده است.';searchPanel.append(empty);}
        return;
      }
      const matches=searchMatches(term),count=document.createElement('small');count.textContent=`${faDigits(matches.length)} محصول`;searchHeading('نتایج محصولات',count);
      if(!matches.length){const empty=document.createElement('p');empty.className='search-no-results';empty.textContent='محصولی پیدا نشد. نام دیگری را جست‌وجو کن.';searchPanel.append(empty);return;}
      const list=document.createElement('div');list.className='search-results';
      matches.forEach(product=>{
        const card=document.createElement('article'),thumb=document.createElement('div'),copy=document.createElement('div'),category=document.createElement('small'),name=document.createElement('strong'),description=document.createElement('span'),actions=document.createElement('div'),add=document.createElement('button'),details=document.createElement('button');
        card.className=`search-result${product.category==='clothing'?' search-result--clothing':''}`;thumb.className=`account-order-thumb account-order-thumb--${product.category}`;thumb.setAttribute('role','img');thumb.setAttribute('aria-label',`تصویر ${product.english}`);thumb.innerHTML=productVisual(product);
        copy.className='search-result-copy';category.textContent=product.category==='supplements'?'SUPPLEMENTS':product.category==='clothing'?`${product.gender==='men'?"MEN'S":"WOMEN'S"} CLOTHING`:'GEAR';name.lang='en';name.textContent=product.gender?`${product.gender==='men'?"MEN'S":"WOMEN'S"} ${product.english}`:product.english;description.textContent=product.name;copy.append(category,name,description);
        actions.className='search-result-actions';add.type='button';add.dataset.searchAdd=product.english;add.dataset.gender=product.gender||'';add.textContent=product.inStock===false?'ناموجود':'افزودن به سبد خرید';add.disabled=product.inStock===false;
        details.type='button';details.dataset.searchDetails=product.english;details.dataset.gender=product.gender||'';details.textContent='مشاهدهٔ جزئیات';actions.append(add,details);card.append(thumb,copy,actions);list.append(card);
      });searchPanel.append(list);
    }
    function setSearchOpen(open){searchWrap.classList.toggle('is-open',open);searchPanel.hidden=!open;searchToggle.setAttribute('aria-expanded',String(open));searchToggle.setAttribute('aria-label',open?'بستن جست‌وجو':'بازکردن جست‌وجو');if(open)renderSearchPanel();}
    searchToggle.addEventListener('click',()=>{const open=searchPanel.hidden;setSearchOpen(open);if(open)searchInput.focus();});
    searchInput.addEventListener('focus',()=>setSearchOpen(true));
    searchInput.addEventListener('input',()=>{setSearchOpen(true);});
    searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const first=searchMatches(searchInput.value)[0];if(first){saveSearchHistory(searchInput.value);setSearchOpen(false);searchInput.value='';openProductModal(first,searchToggle);}}});
    searchPanel.addEventListener('click',event=>{
      const clear=event.target.closest('[data-clear-search-history]');if(clear){try{localStorage.removeItem(searchHistoryKey);}catch{}renderSearchPanel();return;}
      const chip=event.target.closest('[data-search-term]');if(chip){searchInput.value=chip.dataset.searchTerm;renderSearchPanel();searchInput.focus();return;}
      const add=event.target.closest('[data-search-add]');if(add){saveSearchHistory(searchInput.value||add.dataset.searchAdd);setSearchOpen(false);searchInput.value='';const product=products.find(item=>item.english===add.dataset.searchAdd);if(product?.category==='clothing')openProductModal({...product,gender:add.dataset.gender||null},searchToggle);else addToCart(add.dataset.searchAdd);return;}
      const details=event.target.closest('[data-search-details]');if(details){const product=products.find(item=>item.english===details.dataset.searchDetails);if(product){saveSearchHistory(searchInput.value||product.english);setSearchOpen(false);searchInput.value='';openProductModal({...product,gender:details.dataset.gender||null},searchToggle);}}
    });
    document.addEventListener('click',event=>{if(!searchWrap.contains(event.target))setSearchOpen(false);});
    supplementCategoryButtons.forEach(button=>button.addEventListener('click',()=>{activeSupplementCategory=button.dataset.supplementCategory;supplementCategoryButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));drawProducts();}));
    document.querySelectorAll('[data-show-all]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.showAll==='supplements'){activeSupplementCategory='all';supplementCategoryButtons.forEach(item=>item.setAttribute('aria-pressed','false'));}drawProducts();}));
    document.addEventListener('click',e=>{
      if(e.target.closest('#profile-toggle')){openProfile();return;}
      if(e.target===profileBackdrop||e.target.closest('#profile-close')){closeProfile();return;}
      const profileAction=e.target.closest('[data-profile-action]');
      if(profileAction){
        if(profileAction.dataset.profileAction==='ثبت‌نام'){showProfileAuth('register');return;}
        if(profileAction.dataset.profileAction==='ورود'){showProfileAuth('login');return;}
        if(profileAction.dataset.profileAction==='حساب کاربری'){openAccountView('addresses');return;}
        if(profileAction.dataset.profileAction==='سفارش‌های من'){openAccountView('orders');return;}
        if(profileAction.dataset.profileAction==='خروج از حساب کاربری'){logoutVerifiedUser();return;}
        profileStatus.textContent=`بخش «${profileAction.dataset.profileAction}» در نسخهٔ بعد فعال می‌شود`;return;
      }
      if(e.target.closest('.cart')){openCart();return;}
      if(e.target===cartBackdrop){closeCart();return;}
      if(e.target.closest('#cart-close')){closeCart();return;}
      if(e.target.closest('#cart-continue')){closeCart();requestAnimationFrame(()=>document.getElementById(isClothingCatalog?'catalog-grid':'supplements').scrollIntoView({behavior:'smooth',block:'start'}));return;}
      if(e.target.closest('#cart-checkout')){openCheckout();return;}
      const plus=e.target.closest('[data-cart-plus]');
      if(plus){adjustCartItem(plus.dataset.cartPlus,1);return;}
      const minus=e.target.closest('[data-cart-minus]');
      if(minus){adjustCartItem(minus.dataset.cartMinus,-1);return;}
      const remove=e.target.closest('[data-cart-remove]');
      if(remove){cartItems=cartItems.filter(item=>cartItemKey(item)!==remove.dataset.cartRemove);updateCartView();cartStatus.textContent='محصول از سبد خرید حذف شد';return;}
      const addButton=e.target.closest('[data-add]');
      if(addButton){if(!addButton.disabled){const product=products.find(item=>item.english===addButton.dataset.add);if(product?.category==='clothing')openProductModal({...product,gender:addButton.dataset.gender||null},addButton);else addToCart(addButton.dataset.add);}return;}
      if(e.target===document.getElementById('product-modal-close')){closeProductModal();return;}
      if(e.target===productModal){closeProductModal();return;}
      if(e.target.closest('#product-quantity-minus')){modalQuantity=Math.max(1,modalQuantity-1);productQuantity.textContent=String(modalQuantity);return;}
      if(e.target.closest('#product-quantity-plus')){modalQuantity=Math.min(99,modalQuantity+1);productQuantity.textContent=String(modalQuantity);return;}
      if(e.target.closest('#product-modal-add')){if(activeProduct&&activeProduct.inStock!==false&&!productModalAdd.disabled)addToCart(activeProduct.english||'Fitness Product',modalQuantity,activeProduct.gender||null,activeProduct.category==='clothing'?document.getElementById('clothing-color').value:'',activeProduct.category==='clothing'?document.getElementById('clothing-size').value:'');return;}
      const image=e.target.closest('[data-open-product]');
      if(image){const product=products.find(item=>item.english===image.dataset.openProduct);if(product)openProductModal({...product,gender:image.dataset.gender||null},image);}
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!searchPanel.hidden){setSearchOpen(false);searchToggle.focus();return;}
      if(e.key==='Escape'&&invoiceBackdrop.classList.contains('is-open')){closeInvoice();return;}
      if(e.key==='Escape'&&purchaseSuccessBackdrop.classList.contains('is-open')){closePurchaseSuccessPreview();return;}
      if(e.key==='Tab'&&purchaseSuccessBackdrop.classList.contains('is-open')){
        const controls=[document.getElementById('purchase-success-close'),document.getElementById('purchase-success-done')];
        if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls[1].focus();}
        else if(!e.shiftKey&&document.activeElement===controls[1]){e.preventDefault();controls[0].focus();}
        return;
      }
      if(e.key==='Escape'&&mapPicker.classList.contains('is-open')){closeMapPicker();return;}
      if(e.key==='Escape'&&profileBackdrop.classList.contains('is-open')){closeProfile();return;}
      if(e.key==='Escape'&&cartBackdrop.classList.contains('is-open')){closeCart();return;}
      const image=e.target.closest?.('[data-open-product]');
      if(image&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const product=products.find(item=>item.english===image.dataset.openProduct);if(product)openProductModal({...product,gender:image.dataset.gender||null},image);return;}
      if(e.key==='Escape'&&productModal.classList.contains('is-open'))closeProductModal();
    });
    if(!document.documentElement.dataset.storeApi){migrateLegacyCart();switchCartOwner();}
    drawProducts();
// Reuse the lazy-loaded card image for its decorative background only after it loads.
const clothingCardImage=document.querySelector('.category-card--clothing img');
if(clothingCardImage){
  const revealClothingBackground=()=>clothingCardImage.closest('.category-card--clothing').classList.add('is-image-ready');
  if(clothingCardImage.complete&&clothingCardImage.naturalWidth)revealClothingBackground();
  else clothingCardImage.addEventListener('load',revealClothingBackground,{once:true});
}

if(!document.documentElement.dataset.storeApi&&location.protocol!=='file:')authApi('session').then(result=>{if(result.authenticated)acceptVerifiedUser(result.user,false);}).catch(()=>{});
