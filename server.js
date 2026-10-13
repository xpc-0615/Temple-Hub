// Zero-dependency local server for the TempleHub competition demo.
// It persists only demo reservations; do not use it as production infrastructure.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
  await fetch(`${lineApi}/reply`, {method:'POST', headers:lineHeaders(), body:JSON.stringify({replyToken, messages})});
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

http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/config.js') return send(res, 200, `window.TempleHubConfig=${JSON.stringify({liffId:process.env.LIFF_ID || ''})};`, 'application/javascript; charset=utf-8');
  if (req.method === 'POST' && req.url === '/callback') {
    const raw = await rawBody(req);
    if (!verifyLineSignature(raw, req.headers['x-line-signature'])) return send(res, 401, {error:'Invalid LINE signature'});
    const payload = JSON.parse(raw || '{}');
    for (const event of payload.events || []) {
      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text;
        const match = /考試|文昌|學測|祈福/.test(text);
        await lineReply(event.replyToken, match ? [examReply()] : [{type:'text',text:'請告訴我你想祈求的目標，例如：「下週考試，想求心安」。'}]);
      }
      if (event.type === 'postback' && event.postback?.data === 'action=exam') await lineReply(event.replyToken, [examReply()]);
    }
    return send(res, 200, {});
  }
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/TempleHub_完整流程Demo.html'))) {
    return send(res, 200, fs.readFileSync(path.join(root, 'TempleHub_完整流程Demo.html'), 'utf8'), 'text/html; charset=utf-8');
  }
  if (req.method === 'POST' && req.url === '/api/bookings') {
    const item = await body(req); const db = readDb();
    db.bookings[item.code] = { ...item, status:'reserved', createdAt:new Date().toISOString() }; writeDb(db); return send(res, 201, { code:item.code, status:'reserved' });
  }
  if (req.method === 'POST' && req.url === '/api/redeem') {
    const {code} = await body(req); const db = readDb(); const booking = db.bookings[code];
    if (!booking || booking.status !== 'reserved') return send(res, 404, {ok:false});
    booking.status='redeemed'; booking.redeemedAt=new Date().toISOString(); writeDb(db); return send(res, 200, {ok:true, merchant:booking.merchant});
  }
  if (req.method === 'POST' && req.url === '/api/checkin') {
    const {code, temple} = await body(req); const db = readDb(); if (db.bookings[code]) { db.bookings[code].checkedInAt=new Date().toISOString(); db.bookings[code].temple=temple; writeDb(db); } return send(res, 200, {ok:true});
  }
  if (req.method === 'POST' && req.url === '/api/vows') {
    const vow = await body(req); const db = readDb(); if (!db.vows) db.vows=[];
    db.vows = db.vows.filter(item => item.code !== vow.code); db.vows.push({...vow, createdAt:new Date().toISOString(), remindedAt:null}); writeDb(db); return send(res, 201, {ok:true});
  }
  if (req.method === 'POST' && req.url === '/api/reminders/run') {
    const db = readDb(); const today = new Date().toISOString().slice(0,10); let sent=0;
    for (const vow of db.vows || []) if (vow.date <= today && !vow.remindedAt && await linePush(vow.lineUserId, `TempleHub 提醒：今天是你預計回 ${vow.temple} 還願的日子。`)) { vow.remindedAt=new Date().toISOString(); sent++; }
    writeDb(db); return send(res, 200, {ok:true, sent});
  }
  send(res, 404, {error:'Not found'});
}).listen(process.env.PORT || 3000, () => console.log('TempleHub demo: http://localhost:' + (process.env.PORT || 3000)));
