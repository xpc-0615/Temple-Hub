// Chatroom cards use postbacks so recommendations stay inside LINE.
const temples = [{id:'wenchang',name:'台北市文昌宮',address:'臺北市民生西路45巷9弄2之1號',description:'文昌帝君・考試祈福。供品與參拜方式以廟方公告為準。'}];
const shops = [{id:'baihui',name:'柏輝金紙店',address:'臺北市大同區昌吉街55號',description:'公開資料示範・祭祀用品與部分供品'},{id:'laodasheng',name:'老大生香燭金紙舖',address:'臺北市南門市場',description:'公開資料示範・香品與祭祀用品'},{id:'jixiang',name:'吉祥堂香舖',address:'臺北市信義路二段79巷15-3號',description:'公開資料示範・香品與金紙組合'}];
function carousel(items, title, action) {
  return {type:'flex',altText:title,contents:{type:'carousel',contents:items.map(item=>({type:'bubble',body:{type:'box',layout:'vertical',spacing:'md',contents:[{type:'text',text:item.name,weight:'bold',size:'xl',wrap:true},{type:'text',text:item.address,size:'sm',color:'#666666',wrap:true},{type:'text',text:item.description,size:'sm',wrap:true},{type:'text',text:'示範名單，尚未合作',size:'xs',color:'#999999',wrap:true}]},footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'primary',color:'#8B1A2B',action:{type:'postback',label:action.label,data:action.data(item),displayText:action.label+'：'+item.name}}]}}))}};
}
function templeCards(){return carousel(temples,'考試祈福宮廟推薦',{label:'選擇這間宮廟',data:item=>'temple='+item.id});}
function shopCards(){return carousel(shops,'供品店家推薦',{label:'選擇這間店家',data:item=>'shop='+item.id});}
function couponCards(){return carousel([{id:'cafe',name:'參拜後・街角茶飲示範店',address:'宮廟周邊商圈（虛構示範）',description:'完成參拜專屬：飲品折 NT$10。無真實兌換效力。'},{id:'food',name:'參拜後・在地餐館示範店',address:'宮廟周邊商圈（虛構示範）',description:'完成參拜專屬：餐點九折。無真實兌換效力。'}],'參拜完成，領取附近商家示範優惠',{label:'領取示範優惠',data:item=>'coupon='+item.id});}
const offerings=[
 {id:'tea',name:'包種茶',note:'常見民俗取「包中」之意，非必要供品。',options:[{id:'tea-a',name:'雙連茶行 A',price:60},{id:'tea-b',name:'在地茶行 B',price:75}]},
 {id:'rice',name:'粽子',note:'常見考試祈福供品；請依宮廟規範準備。',options:[{id:'rice-a',name:'市場粽子店 A',price:45},{id:'rice-b',name:'手作粽子店 B',price:55}]},
 {id:'fruit',name:'水果',note:'可準備一般敬果，份量依個人需求。',options:[{id:'fruit-a',name:'雙連水果店 A',price:100},{id:'fruit-b',name:'市場水果店 B',price:120}]}
];
// Each item has one settlement price across all eligible demonstration merchants.
for(const item of offerings){item.price=item.options[0].price;for(const option of item.options)option.price=item.price;}
const bundle={id:'exam',name:'考試祈福禮包',regularPrice:205,price:185,discount:20};
function redeemItem(booking,itemId,merchantId){
 const item=booking?.items?.find(i=>i.itemId===itemId);
 if(!item)throw Error('訂單沒有此供品');
 if(!item.eligibleMerchantIds?.includes(merchantId))throw Error('這間店家不能兌換此供品');
 if(item.redeemedAt)throw Error('此供品已兌換，不能重複核銷');
 item.redeemedAt=new Date().toISOString();item.redeemedBy=merchantId;
 booking.status=booking.items.every(i=>i.redeemedAt)?'redeemed':'partially_redeemed';
 return item;
}
const stations=[
 {id:'arrival',title:'入廟・閱讀現場規範',action:'先閱讀公告，確認參拜動線、供品放置區及是否開放用香。',meaning:'尊重廟方管理與其他參拜者，先了解這座宮廟的做法。',attention:'不要擋住出入口；不確定時詢問服務人員。此流程為展示示意，並非台北市文昌宮認證流程。',location:'入口公告處'},
 {id:'prayer',title:'敬拜・上香或合掌致意',action:'依現場人員指引敬拜；若允許用香，請先確認持香、插香與數量規定；不開放用香時可依指引合掌致意。',meaning:'以尊重的方式表達祈願，讓自己整理目標與心意。',attention:'避免香火接近衣物、頭髮與他人；不自行點火或增設香爐。沒有全台通用的用香規則，請以廟方公告為準。',location:'指定敬拜區旁（避免靠近火源）'},
 {id:'finish',title:'禮成・整理與感謝',action:'確認供品如何處理，依指引整理物品與環境，再記下自己的還願計畫。',meaning:'讓參拜有完整收尾，也為下一位參拜者保留整潔空間。',attention:'不擅自拿取他人的供品；垃圾依現場分類，不在動線中停留。',location:'禮成出口／服務台'}
];
function advanceStation(booking,stationCode){
 const completed=booking.steps||[];const next=stations[completed.length];
 if(!next)throw Error('所有關卡已完成');
 if(stationCode!=='TH-STATION:'+next.id)throw Error('這不是目前關卡的 QR，請依順序完成');
 booking.steps=[...completed,{id:next.id,completedAt:new Date().toISOString()}];return booking.steps;
}
module.exports={templeCards,shopCards,couponCards,temples,shops,offerings,bundle,redeemItem,stations,advanceStation};
