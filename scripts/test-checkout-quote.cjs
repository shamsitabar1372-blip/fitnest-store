// Checkout must explain missing configuration and only unlock after a server quote.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/store-api.js'),'utf8');
const start=source.indexOf(' async function requestQuote(){'),end=source.indexOf(" document.getElementById('checkout-finalize').addEventListener",start);
assert.ok(start>=0&&end>start);
async function check({shipping=[],address='1',shippingId='',error=null,stale=false}){
 const controls=Object.fromEntries(['server-quote-button','server-quote-status','checkout-confirm','checkout-finalize','checkout-status','server-shipping','checkout-total'].map(id=>[id,{disabled:false,checked:true,textContent:'',value:shippingId,scrollIntoView(){}}]));
 let calls=0;
 const state={quote:{old:true},cart:{},shipping,quoteRevision:0};
 const sandbox={state,selectedAddressId:address,document:{getElementById:id=>controls[id]},crypto:{randomUUID:()=> 'test-idempotency-key'},money:n=>String(n),api:async(path,input)=>{calls++;assert.equal(path,'checkout/quote');assert.equal(input.addressId,address);assert.equal(input.shippingId,2);assert.equal('coupon' in input,false);if(error)throw Error(error);if(stale)state.quoteRevision++;return {quote:{total:1500000}}}};
 vm.runInNewContext(source.slice(start,end),sandbox);await sandbox.requestQuote();
 assert.equal(controls['server-quote-button'].disabled,false);
 if(!shipping.length||!address||!shippingId||error||stale){assert.equal(state.quote,null);assert.equal(controls['checkout-confirm'].disabled,true);}else{assert.equal(calls,1);assert.equal(controls['checkout-confirm'].disabled,false);assert.equal(controls['checkout-confirm'].checked,false);assert.equal(state.quote.amount,1500000);}
 if(!shipping.length&&address){assert.equal(calls,0);assert.match(controls['server-quote-status'].textContent,/روش ارسال/);}
 if(error)assert.equal(controls['server-quote-status'].textContent,error);
}
(async()=>{
 await check({});await check({shipping:[{id:2,quote_required:false}],shippingId:'2'});
 await check({shipping:[{id:2,quote_required:false}],shippingId:'2',error:'موجودی تغییر کرده است.'});
 await check({shipping:[{id:2,quote_required:false}],shippingId:'2',stale:true});
 console.log('PASS: missing shipping is explicit; server quote unlocks review; failures/stale quotes stay blocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
