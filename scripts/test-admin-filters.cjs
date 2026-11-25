// Exercise the shipped panel's filters with a small DOM double, not a copied predicate.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../backend/static/ops/panel.js'),'utf8');
class Element {
 constructor(tag,text){this.tag=tag;this.textContent=text;this.children=[];this.dataset={};this.events={};this.attributes={};this.value='';}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=nodes}
 setAttribute(key,value){this.attributes[key]=value}
 addEventListener(event,fn){this.events[event]=fn}
}
const root=new Element('section'),context={el:(...args)=>new Element(...args),fa:String},data=[
 {id:1,title:'TEE',name:'تیشرت مردانه',parentCategory:'clothing',gender:'men',variants:[{id:1,sku:'M-1',size:'S'},{id:2,sku:'M-2',size:'M'}]},
 {id:2,title:'TEE',name:'تیشرت زنانه',parentCategory:'clothing',gender:'women',variants:[{id:3,sku:'W-1',size:'M'}]},
 {id:3,title:'ISO WHEY',name:'ایزو وی',parentCategory:'supplements',gender:'',variants:[{id:4,sku:'P-1',size:''}]},
 {id:4,title:'SHAKER',name:'شیکر',parentCategory:'gear',gender:'',variants:[{id:5,sku:'G-1',size:''}]}
];let shown;
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('const productFilters='),source.indexOf('async function page(')),context);
context.categoryTable(root,data,'inventory',(_,items)=>shown=items);
const [categories,genders,sizes,finder]=root.children;
const click=(group,key,value)=>group.children.find(n=>n.dataset[key]===value).events.click();
assert.equal(shown.length,4);
click(genders,'gender','men');assert.deepEqual(Array.from(shown,p=>p.id),[1]);
click(sizes,'size','M');assert.deepEqual(Array.from(shown[0].variants,v=>v.id),[2]);
click(genders,'gender','women');assert.deepEqual(Array.from(shown,p=>p.id),[2]);
finder.children[2].events.click();assert.equal(shown.length,4);
click(categories,'category','supplements');assert.deepEqual(Array.from(shown,p=>p.id),[3]);
finder.children[2].events.click();finder.children[0].value='W-1';finder.children[0].events.input();assert.deepEqual(Array.from(shown,p=>p.id),[2]);
finder.children[0].value='no-such-product';finder.children[0].events.input();assert.equal(shown.length,0);
finder.children[2].events.click();finder.children[1].value='1';finder.children[1].events.change();assert.deepEqual(Array.from(shown,p=>p.id),[1]);
console.log('PASS: category/gender/size/product/SKU filters, empty search and reset.');
