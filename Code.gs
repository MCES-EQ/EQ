/** EQ Partner Center backend (Google Apps Script)\n * Required Script Properties:\n * LINE_CHANNEL_ID = your LINE Login channel ID\n * SCHEDULE_SPREADSHEET_ID = 115上班表 spreadsheet id\n * MASTER_SPREADSHEET_ID = EQ志工主資料庫 spreadsheet id\n */
const CFG = {
  MASTER_ID: PropertiesService.getScriptProperties().getProperty('MASTER_SPREADSHEET_ID') || '1TssKrjjbUgKtq_fHcAhIG9vyEqbtatVTGVRoVh_nL5c',
  SCHEDULE_ID: PropertiesService.getScriptProperties().getProperty('SCHEDULE_SPREADSHEET_ID') || '1VIMJ1UwX1Zo3adPK1VWhD9nFQ7v6Id7jRNAF-75nWKk',
  CHANNEL_ID: PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ID'),
  MEMBER_SHEET: 'Line名單',
  FINANCE_SHEET: '財務報表',
  BUDGET_SHEET: '預算編列',
  ACTIVE_CUTOFF: new Date('2026-11-23T00:00:00+08:00')
};
function out(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return out({ok:true,service:'EQ Partner Center',version:'2.1'})}
function doPost(e){try{const p=JSON.parse(e.postData.contents||'{}');if(p.action==='auth')return out(auth_(p));if(p.action==='bind')return out(bind_(p));if(p.action==='dashboard')return out(dashboard_(p));if(p.action==='support')return out(support_(p));return out({ok:false,message:'unknown action'})}catch(err){return out({ok:false,message:String(err.message||err)})}}
function verifyLine_(idToken){if(!CFG.CHANNEL_ID)throw new Error('LINE_CHANNEL_ID 尚未設定');const res=UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify',{method:'post',payload:{id_token:idToken,client_id:CFG.CHANNEL_ID},muteHttpExceptions:true});const data=JSON.parse(res.getContentText());if(res.getResponseCode()!==200)throw new Error('LINE 登入驗證失敗');return data}
function master_(){return SpreadsheetApp.openById(CFG.MASTER_ID)}
function ensureMemberSheet_(){
  const ss=master_();
  const sh=ss.getSheetByName(CFG.MEMBER_SHEET);
  if(!sh)throw new Error('找不到 Line名單 分頁');
  return sh;
}
function cleanName_(v){return String(v||'').replace(/[（(].*?[）)]/g,'').replace(/\s+/g,'').trim()}
function sameName_(cell,name){const a=cleanName_(cell),b=cleanName_(name);return !!a&&!!b&&(a===b||a.includes(b)||b.includes(a))}
function afterActiveCutoff_(){return new Date()>=CFG.ACTIVE_CUTOFF}
function isTrue_(v){return ['TRUE','true','1','是','啟用','有效'].includes(String(v||'').trim())}
function memberBySub_(sub){
  const sh=ensureMemberSheet_(),v=sh.getDataRange().getDisplayValues();
  for(let i=1;i<v.length;i++){
    if(v[i][7]===sub&&v[i][8]!=='停用'){
      const active=isTrue_(v[i][11]); // L 有效志工
      return {row:i+1,name:v[i][1],role:v[i][9]||'志工夥伴',active};
    }
  }
  return null;
}
function auth_(p){
  const line=verifyLine_(p.idToken),m=memberBySub_(line.sub);
  if(!m)return {ok:true,status:'needs_binding'};
  if(afterActiveCutoff_()&&!m.active)return {ok:true,status:'inactive',message:'11/23 起志工專區以續任確認後的有效志工名單為準；目前你的帳號尚未列為有效志工。'};
  return {ok:true,status:'ok',member:{name:m.name,role:m.role,picture:line.picture||''}}
}
function bind_(p){
  const line=verifyLine_(p.idToken),sh=ensureMemberSheet_(),v=sh.getDataRange().getDisplayValues();
  for(let i=1;i<v.length;i++){
    const name=v[i][1], phoneLast3=String(v[i][6]||'').trim(), status=v[i][8], active=isTrue_(v[i][11]);
    if(sameName_(name,p.name)&&phoneLast3===String(p.phoneLast3)&&status!=='停用'){
      if(afterActiveCutoff_()&&!active)return {ok:false,message:'11/23 起只開放續任確認後的有效志工登入，如有疑問請聯絡組長。'};
      sh.getRange(i+1,8).setValue(line.sub);       // H LINE_USER_ID
      sh.getRange(i+1,9).setValue('啟用');         // I 登入狀態
      if(!v[i][9])sh.getRange(i+1,10).setValue('志工夥伴'); // J 角色
      sh.getRange(i+1,11).setValue(new Date());    // K 綁定時間
      return {ok:true,member:{name:name,role:v[i][9]||'志工夥伴',picture:line.picture||''}};
    }
  }
  return {ok:false,message:'名單核對不到。請確認姓名與手機末三碼，或聯絡組長協助。'};
}
function requireMember_(idToken){const line=verifyLine_(idToken),m=memberBySub_(line.sub);if(!m)throw new Error('尚未完成志工身分綁定');if(afterActiveCutoff_()&&!m.active)throw new Error('目前未列在有效志工名單中');return {line,m}}
function dashboard_(p){
  const auth=requireMember_(p.idToken);
  return {ok:true,data:{
    classes:readClasses_(),
    prep:readPrep_(),
    mySupport:findMySupport_(auth.m.name),
    myCalendar:findMyCalendar_(auth.m.name),
    finance:readFinance_()
  }};
}
function scheduleSheets_(){return ['(一上)我是心情魔法師','(二上)我是幸福魔法師','(三上)好人氣養成班','(四上)超人氣養成班','(五上)我是EQ高手','(六上)我好你也好']}
function readClasses_(){const ss=SpreadsheetApp.openById(CFG.SCHEDULE_ID),out=[];scheduleSheets_().forEach(name=>{const sh=ss.getSheetByName(name);if(!sh)return;const v=sh.getDataRange().getDisplayValues();let cls='';for(let r=2;r<v.length;r++){if(v[r][0])cls=v[r][0];if(!v[r][2])continue;out.push({sheet:name,row:r+1,cls,unit:v[r][1],date:v[r][2],day:v[r][3],time:v[r][4],main:[v[r][5],v[r][6]].filter(Boolean).filter(x=>x!=='─'),support:[v[r][7],v[r][8],v[r][9]].filter(Boolean),note:v[r][10]||''})}});return out}
function readPrep_(){const ss=SpreadsheetApp.openById(CFG.SCHEDULE_ID),sh=ss.getSheetByName('(115上)備課日期');if(!sh)return [];const v=sh.getDataRange().getDisplayValues(),out=[];let grade='';for(let r=2;r<v.length;r++){if(v[r][0])grade=v[r][0];if(!v[r][1])continue;out.push({grade,date:v[r][1],day:v[r][2],time:v[r][3],content:v[r][4],people:v[r].slice(5,14).filter(Boolean).join('、')})}return out}
function findMySupport_(name){return readClasses_().filter(x=>x.support.some(n=>sameName_(n,name)))}
function findMyCalendar_(name){
  const rows=readClasses_(),out=[];
  rows.forEach(x=>{
    const isMain=x.main.some(n=>sameName_(n,name));
    const isSupport=x.support.some(n=>sameName_(n,name));
    if(isMain||isSupport)out.push(Object.assign({},x,{role:isMain?'主講':'協助'}));
  });
  return out;
}
function support_(p){const a=requireMember_(p.idToken),ss=SpreadsheetApp.openById(CFG.SCHEDULE_ID),sh=ss.getSheetByName(p.sheet);if(!sh||!scheduleSheets_().includes(p.sheet))throw new Error('班表分頁不符');const row=Number(p.row);if(row<3)throw new Error('列號不符');const range=sh.getRange(row,8,1,3),vals=range.getDisplayValues()[0];if(vals.some(x=>String(x).includes(a.m.name)))return {ok:true,message:'已經登記過了'};const idx=vals.findIndex(x=>!x);if(idx<0)throw new Error('這堂課協助名額已滿');range.getCell(1,idx+1).setValue(a.m.name);return {ok:true}}
function moneyNum_(v){
  const t=String(v||'').replace(/NT\$/g,'').replace(/,/g,'').replace(/\s/g,'');
  const n=Number(t.replace(/[^0-9.-]/g,''));
  return isNaN(n)?0:n;
}
function readFinance_(){
  const ss=master_(),tx=ss.getSheetByName(CFG.FINANCE_SHEET),bud=ss.getSheetByName(CFG.BUDGET_SHEET);
  if(!tx)return null;
  const v=tx.getDataRange().getDisplayValues(),transactions=[];
  let income=0,expense=0,lastBalance=0;
  for(let i=1;i<v.length;i++){
    const date=v[i][0],item=v[i][1],inVal=moneyNum_(v[i][6]),outVal=Math.abs(moneyNum_(v[i][7])),bal=moneyNum_(v[i][8]);
    if(bal||String(v[i][8]||'').trim())lastBalance=bal;
    if(!date&&!item&&!inVal&&!outVal)continue;
    if(inVal){income+=inVal;transactions.push({date,item:item||'收入',type:'收入',amount:Math.abs(inVal),note:''})}
    if(outVal){expense+=outVal;transactions.push({date,item:item||'支出',type:'支出',amount:outVal,note:''})}
  }
  let budget=0,period='115學年度',budgetItems=[];
  if(bud){
    const b=bud.getDataRange().getDisplayValues();
    for(let i=1;i<b.length;i++){
      const amount=Math.abs(moneyNum_(b[i][2]));
      if(!b[i][0]&&!b[i][1]&&!amount&&!b[i][3])continue;
      budget+=amount;
      if(b[i][0])period=b[i][0];
      budgetItems.push({period:b[i][0]||period,item:b[i][1]||'未命名預算',amount,note:b[i][3]||''});
    }
  }
  return {income,expense,budget,balance:lastBalance,availableAfterBudget:lastBalance-budget,period,budgetItems,transactions:transactions.reverse().slice(0,80)};
}
