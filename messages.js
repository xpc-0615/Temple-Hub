// Chatroom cards use postbacks so recommendations stay inside LINE.
const temples = [{id:'wenchang',name:'台北市文昌宮',address:'臺北市民生西路45巷9弄2之1號',description:'文昌帝君・考試祈福。供品與參拜方式以廟方公告為準。'}];
const shops = [{id:'baihui',name:'柏輝金紙店',address:'臺北市大同區昌吉街55號',description:'公開資料示範・祭祀用品與部分供品'},{id:'laodasheng',name:'老大生香燭金紙舖',address:'臺北市南門市場',description:'公開資料示範・香品與祭祀用品'},{id:'jixiang',name:'吉祥堂香舖',address:'臺北市信義路二段79巷15-3號',description:'公開資料示範・香品與金紙組合'}];
function carousel(items, title, action) {
  return {type:'flex',altText:title,contents:{type:'carousel',contents:items.map(item=>({type:'bubble',body:{type:'box',layout:'vertical',spacing:'md',contents:[{type:'text',text:item.name,weight:'bold',size:'xl',wrap:true},{type:'text',text:item.address,size:'sm',color:'#666666',wrap:true},{type:'text',text:item.description,size:'sm',wrap:true},{type:'text',text:'示範名單，尚未合作',size:'xs',color:'#999999',wrap:true}]},footer:{type:'box',layout:'vertical',contents:[{type:'button',style:'primary',color:'#8B1A2B',action:{type:'postback',label:action.label,data:action.data(item),displayText:action.label+'：'+item.name}}]}}))}};
}
function templeCards(){return carousel(temples,'考試祈福宮廟推薦',{label:'選擇這間宮廟',data:item=>'temple='+item.id});}
function shopCards(){return carousel(shops,'供品店家推薦',{label:'選擇這間店家',data:item=>'shop='+item.id});}
function couponCards(){return carousel([{id:'cafe',name:'參拜後・街角茶飲示範店',address:'宮廟周邊商圈（虛構示範）',description:'完成參拜專屬：飲品折 NT$10。無真實兌換效力。'},{id:'food',name:'參拜後・在地餐館示範店',address:'宮廟周邊商圈（虛構示範）',description:'完成參拜專屬：餐點九折。無真實兌換效力。'}],'參拜完成，領取附近商家示範優惠',{label:'領取示範優惠',data:item=>'coupon='+item.id});}
module.exports={templeCards,shopCards,couponCards,temples,shops};
