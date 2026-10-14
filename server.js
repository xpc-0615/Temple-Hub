// Zero-dependency local server for the TempleHub competition demo.
// It persists only demo reservations; do not use it as production infrastructure.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {templeCards,shopCards,couponCards,shops,offerings} = require('./messages');
const root = __dirname;
const dbFile = path.join(root, 'data', 'demo-state.json');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const readDb = () => { try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { return { bookings: {} }; } };
const writeDb = db => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const send = (res, status, body, type='application/json; charset=utf-8') => { res.writeHead(status, {'Content-Type':type}); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
const body = req => new Promise(resolve => { let raw=''; req.on('data', c => raw += c); req.on('end', () => { try { resolve(JSON.parse(raw||'{}')); } catch { resolve({}); } }); });
const rawBody = req => new Promise(resolve => { let raw=''; req.on('data', c => raw += c); req.on('end', () => resolve(raw)); });
const lineApi = 'https://api.line.me/v2/bot/message';
const lineHeaders = () => ({'Content-Type':'application/json', Authorization:`Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`});
const lineReady = () => Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET);
async function lineReply(replyToken, messages) {
  if (!lineReady()) return;
  const response=await fetch(`${lineApi}/reply`, {method:'POST', headers:lineHeaders(), body:JSON.stringify({replyToken, messages})});
  if(!response.ok) console.error('LINE reply failed',response.status);
}
async function linePush(to, text) {
  if (!lineReady() || !to || to === 'demo-user') return false;
  const result = await fetch(`${lineApi}/push`, {method:'POST', headers:lineHeaders(), body:JSON.stringify({to, messages:[{type:'text',text}]})});
  return result.ok;
}
function verifyLineSignature(raw, signature) {
  const expected = crypto.createHmac('SHA256', process.env.LINE_CHANNEL_SECRET || '').update(raw).digest('base64');
  return signature && expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
function examReply() {
  const liffUrl = process.env.APP_URL || 'https://example.com';
  return {type:'flex', altText:'TempleHub 已為你準備考試祈福流程', contents:{type:'bubble', header:{type:'box',layout:'vertical',contents:[{type:'text',text:'TempleHub 考試祈福',weight:'bold',color:'#FFFFFF'}],backgroundColor:'#8B1A2B',paddingAll:'16px'},body:{type:'box',layout:'vertical',contents:[{type:'text',text:'建議向文昌帝君祈求學業與考運。',wrap:true},{type:'text',text:'已依台北市文昌宮公開資訊整理參拜與供品準備。',wrap:true,size:'sm',color:'#766D65',margin:'md'}]},footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'primary',color:'#8B1A2B',action:{type:'uri',label:'開始準備與預約',uri:liffUrl}}]}}};
}

function liffLink(query='') { const base=process.env.LIFF_ID ? `https://liff.line.me/${process.env.LIFF_ID}` : process.env.APP_URL; return base ? base+'/?'+query : null; }
async function verifiedUser(req){
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');
  if(!token) return null;
  const r=await fetch('https://api.line.me/v2/profile',{headers:{Authorization:'Bearer '+token}});
  if(!r.ok) return null;
  return (await r.json()).userId;
}

http.createServer(async (req, res) => {
  if(req.method==='GET' && req.url==='/api/offerings') return send(res,200,{items:offerings});
  if(req.method==='GET' && req.url==='/health') return send(res,200,{ok:true,version:'chat-carousel-1'});
  if (req.method === 'GET' && req.url === '/config.js') return send(res, 200, `window.TempleHubConfig=${JSON.stringify({liffId:process.env.LIFF_ID || ''})};`, 'application/javascript; charset=utf-8');
  if (req.method === 'POST' && req.url === '/callback') {
    const raw = await rawBody(req);
    if (!verifyLineSignature(raw, req.headers['x-line-signature'])) return send(res, 401, {error:'Invalid LINE signature'});
    const payload = JSON.parse(raw || '{}');
    for (const event of payload.events || []) {
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text;
        const match = /考試|文昌|學測|祈福/.test(text);
        await lineReply(event.replyToken, match ? [templeCards()] : [{type:'text',text:'歡迎來到 TempleHub！請告訴我你的祈福需求，例如「下週考試，想求心安」。目前開放考試祈福示範。'}]);
      }
      if(event.type==='follow') await lineReply(event.replyToken,[{type:'text',text:'歡迎來到 TempleHub。輸入「考試祈福」開始選廟、準備供品與參拜旅程。'}]);
      if(event.type==='postback') {
        const data=new URLSearchParams(event.postback?.data||'');
        if(data.get('action')==='exam') await lineReply(event.replyToken,[templeCards()]);
        else if(data.has('temple')) {const url=liffLink('temple=wenchang');await lineReply(event.replyToken,[url?{type:'template',altText:'台北市文昌宮・開啟供品清單',template:{type:'buttons',text:'已選台北市文昌宮。在供品清單內比較每項供品的店家，確認後建立預約。',actions:[{type:'uri',label:'查看供品清單',uri:url}]}}:{type:'text',text:'供品清單設定中，請稍後再試。'}]);}
        else if(data.has('shop')) { const shop=shops.find(s=>s.id===data.get('shop')); const url=liffLink('shop='+encodeURIComponent(shop?.name||'')); await lineReply(event.replyToken,[url?{type:'template',altText:'開啟供品準備與參拜流程',template:{type:'buttons',text:'已選 '+(shop?.name||'示範店家')+'，前往準備清單與預約。',actions:[{type:'uri',label:'開啟供品與參拜流程',uri:url}]}}:{type:'text',text:'LIFF 尚未設定，請稍後再試。'}]); }
        else if(data.has('coupon')) {const db=readDb(); const eligible=Object.values(db.bookings).some(b=>b.lineUserId===event.source?.userId&&b.checkedInAt); await lineReply(event.replyToken,[{type:'text',text:eligible?'已領取示範優惠：'+data.get('coupon')+'。此券僅供競賽展示，無真實折扣效力。':'請先完成參拜流程，再領取附近商家優惠。'}]);}
      }
    }
    return send(res, 200, {});
  }
  if (req.method === 'GET' && (req.url.split('?')[0] === '/' || req.url.startsWith('/TempleHub_完整流程Demo.html'))) {
    return send(res, 200, fs.readFileSync(path.join(root, 'TempleHub_完整流程Demo.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  if (req.method === 'POST' && req.url === '/api/bookings') {
    const user=await verifiedUser(req);if(!user) return send(res,401,{error:'請從 LINE 登入後預約'});
    const item = await body(req); item.lineUserId=user; item.code='TH-'+crypto.randomBytes(12).toString('hex').toUpperCase(); const db = readDb();
    if(!Array.isArray(item.selections)||!item.selections.length) return send(res,400,{error:'請至少選擇一項供品與店家'});
    const resolved=[];
    for(const selection of item.selections){const product=offerings.find(p=>p.id===selection.itemId);const option=product?.options.find(o=>o.id===selection.optionId);if(!option||resolved.some(p=>p.itemId===product.id))return send(res,400,{error:'供品或店家選擇無效'});resolved.push({itemId:product.id,item:product.name,...option});}
    item.items=resolved;item.total=resolved.reduce((sum,p)=>sum+p.price,0);item.merchant=Array.from(new Set(resolved.map(p=>p.name))).join('、');
    db.bookings[item.code] = { ...item, status:'reserved', createdAt:new Date().toISOString() }; writeDb(db); return send(res, 201, { code:item.code, status:'reserved' });
  }
  if (req.method === 'POST' && req.url === '/api/redeem') {
    if(!process.env.MERCHANT_KEY || req.headers['x-merchant-key']!==process.env.MERCHANT_KEY) return send(res,403,{error:'需要店家核銷權限'});
    const {code} = await body(req); const db = readDb(); const booking = db.bookings[code];
    if (!booking || booking.status !== 'reserved') return send(res, 404, {ok:false});
    booking.status='redeemed'; booking.redeemedAt=new Date().toISOString(); writeDb(db); return send(res, 200, {ok:true, merchant:booking.merchant});
  }
  if (req.method === 'POST' && req.url === '/api/checkin') {
    const user=await verifiedUser(req); if(!user) return send(res,401,{error:'請先在 LINE 登入'});
    const {code}=await body(req);const db=readDb();const booking=db.bookings[code];
    if(!booking||booking.lineUserId!==user||booking.status!=='redeemed') return send(res,409,{error:'請先完成本人預約的取貨核銷'});
    if(booking.checkedInAt) return send(res,200,{ok:true,alreadyCompleted:true});
    booking.checkedInAt=new Date().toISOString();writeDb(db);
    const r=await fetch(`${lineApi}/push`,{method:'POST',headers:lineHeaders(),body:JSON.stringify({to:user,messages:[{type:'text',text:'參拜完成！以下為附近商家示範優惠。'},couponCards()]})});
    return send(res,200,{ok:true,couponSent:r.ok});
  }
  if (req.method === 'POST' && req.url === '/api/vows') {
    const user=await verifiedUser(req);if(!user) return send(res,401,{error:'請先登入 LINE'});
    const vow = await body(req);vow.lineUserId=user; const db = readDb(); if(!db.bookings[vow.code]||db.bookings[vow.code].lineUserId!==user||!/^\d{4}-\d{2}-\d{2}$/.test(vow.date||'')) return send(res,400,{error:'無效的還願紀錄'}); if (!db.vows) db.vows=[];
    db.vows = db.vows.filter(item => item.code !== vow.code); db.vows.push({...vow, createdAt:new Date().toISOString(), remindedAt:null}); writeDb(db); return send(res, 201, {ok:true});
  }
  if (req.method === 'POST' && req.url === '/api/reminders/run') {
    if(!process.env.CRON_SECRET || req.headers.authorization!=='Bearer '+process.env.CRON_SECRET) return send(res,403,{error:'Forbidden'});
    const db = readDb(); const today = new Date().toISOString().slice(0,10); let sent=0;
    for (const vow of db.vows || []) if (vow.date <= today && !vow.remindedAt && await linePush(vow.lineUserId, `TempleHub 提醒：今天是你預計回 ${vow.temple} 還願的日子。`)) { vow.remindedAt=new Date().toISOString(); sent++; }
    writeDb(db); return send(res, 200, {ok:true, sent});
  }
  send(res, 404, {error:'Not found'});
}).listen(process.env.PORT || 3000, () => console.log('TempleHub demo: http://localhost:' + (process.env.PORT || 3000)));
