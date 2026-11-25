// Regression: a successful server reverse lookup must fill the visible address form.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/store-api.js'), 'utf8');
const start = source.indexOf(" document.getElementById('map-picker-confirm').addEventListener");
const end = source.indexOf(' function enableLocalMapWebSetup()', start);
assert.ok(start >= 0 && end > start);
async function check(changeDuringRequest) {
  const fields = {province:{value:''},city:{value:''},street:{value:''}};
  const status = {textContent:''};
  let listener;
  const sandbox = {
    document:{getElementById:id=>id==='map-picker-confirm'?{addEventListener:(_,fn)=>listener=fn}:status},
    addressForm:{hidden:false,elements:{namedItem:name=>fields[name]}},
    draftCoordinates:{lat:35.8,lng:50.9},pickedCoordinates:null,mapPlace:null,mapSession:1,
    closeMapPicker:()=>{sandbox.mapSession++},focusAddressDetails:()=>{},
    api:async(path,data)=>{
      assert.equal(path,'maps/reverse');assert.equal(data.lat,35.8);
      if(changeDuringRequest) fields.street.value='نشانی ویرایش‌شده توسط کاربر';
      return {address:{province:'البرز',city:'کرج',street:'بلوار دانش‌آموز'}};
    }
  };
  vm.runInNewContext(source.slice(start,end),sandbox);
  await listener({preventDefault(){},stopImmediatePropagation(){}});
  assert.equal(fields.province.value,'البرز');assert.equal(fields.city.value,'کرج');
  assert.equal(fields.street.value,changeDuringRequest?'نشانی ویرایش‌شده توسط کاربر':'بلوار دانش‌آموز');
  assert.match(status.textContent,/نشانی دریافت شد/);
}
(async()=>{await check(false);await check(true);console.log('PASS: map confirmation fills address; concurrent user edits preserved.');})().catch(error=>{console.error(error);process.exitCode=1});
