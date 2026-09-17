const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../assets/quote-model.js');
test('pound price never masquerades as case price or derives weight from qty',()=>{
  const o=M.offer({id:'s',unit:'LBS',price:'3.20',qty:200,pack:'6X24'});
  assert.equal(o.orderUnit,'case');assert.equal(o.orderPrice,null);
});
test('verified case weight yields correct extended estimate',()=>{
  const i={id:'s',unit:'LB',price:3.20};const config={PRODUCT_OVERRIDES:{s:{caseWeightLb:24}}};
  assert.equal(M.offer(i,config).orderPrice,76.8);
  assert.deepEqual(M.totals([i],{s:3},config),{subtotal:230.4,pending:0,count:1});
});
test('mixed known and unknown prices are separately represented',()=>{
  const items=[{id:'a',unit:'BOX',price:'32.50'},{id:'b',unit:'LB',price:'4.10'}];
  assert.deepEqual(M.totals(items,{a:2,b:1}),{subtotal:65,pending:1,count:2});
  for(const price of ['',null,'no price',Infinity,-2])assert.equal(M.offer({unit:'CS',price}).orderPrice,null);
});
test('explicit pound ordering and invalid quantities',()=>{
  assert.equal(M.offer({unit:'LB',price:'3.2',order_unit:'lb'}).orderPrice,3.2);
  for(const q of [-1,1.5,Infinity,'bad',10000])assert.equal(M.quantity(q),0);
});
function app(fetch){
  const storage={};const element={addEventListener(){}};
  const ctx={window:{BUSINESS_CONFIG:{name:'Test',phone:'555-0100',locations:[{id:'nc',name:'NC'}]},SITE_CONFIG:{API_URL:'http://localhost/test'},QuoteModel:M},document:{getElementById(){return element;}},localStorage:{getItem(k){return storage[k];},setItem(k,v){storage[k]=v;}},URLSearchParams,AbortController,setTimeout,clearTimeout,Intl,crypto:require('node:crypto').webcrypto,fetch};
  let source=fs.readFileSync(require.resolve('../assets/catalog.js'),'utf8');
  source=source.replace(/load\(\);\s*\}\)\(\);\s*$/,`draw=function(){};refresh=function(){};bar=function(){};
  window.test={submit,parse,orderText,setup:function(){items=[{id:'a',name:'Shrimp',unit:'LB',price:'3.2'}];cart={a:2};customer.name='Test';customer.phone='5551234567';customer.location='nc';customer.fulfillment='delivery';customer.address='Test address';},state:function(){return {cart,pending,sent,error,busy};}};
  })();`);
  vm.runInNewContext(source,ctx);ctx.window.test.setup();return {api:ctx.window.test,storage};
}
test('request preserves existing sheet fields and records reference/location/details',async()=>{
  let sent;const {api}=app(async(url,options)=>{sent=Object.fromEntries(options.body);return {ok:true,json:async()=>({ok:true})};});
  await api.submit();assert.equal(sent.action,'submitOrder');assert.match(sent.items,/2 cases/);assert.match(sent.total,/Pricing to confirm/);assert.match(sent.notes,/Reference: TB-/);assert.match(sent.notes,/Location: NC/);assert.match(sent.notes,/Address: Test address/);
  assert.match(api.state().sent,/TB-/);assert.equal(Object.keys(api.state().cart).length,0);
});
test('network uncertainty preserves quote and prevents duplicate resend',async()=>{
  let calls=0;const {api}=app(async()=>{calls++;throw Error('network');});
  await api.submit();await api.submit();assert.equal(calls,1);assert.equal(api.state().cart.a,2);assert.ok(api.state().pending);assert.equal(api.state().sent,'');
});
test('invalid success response never clears the cart',async()=>{
  const {api}=app(async()=>({ok:true,json:async()=>({})}));await api.submit();assert.ok(api.state().pending);assert.equal(api.state().cart.a,2);assert.equal(api.state().sent,'');
});
test('server rejection exposes actionable error without a success message',async()=>{
  const {api}=app(async()=>({ok:true,json:async()=>({error:'rejected'})}));await api.submit();assert.equal(api.state().pending,null);assert.equal(api.state().cart.a,2);assert.match(api.state().error,/not accepted/);
});
test('CSV quoted names and multiline fields survive parsing',()=>{
  const {api}=app(()=>{});const parsed=api.parse('id,name,price,unit\r\na,"Fish, \"\"fresh\"\"\nfillet",2.50,LB\r\n');assert.equal(parsed[0].name,'Fish, "fresh"\nfillet');assert.equal(parsed[0].price,'2.50');
});
