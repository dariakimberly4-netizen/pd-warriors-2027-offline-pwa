(()=> {
const K='pdw-people-v4', S='pdw-selected-v4';
const defaultPeople=[
 {id:'P-0001',name:'Maria Santos',type:'Participant',snack:false,lunch:false,raffle:false},
 {id:'C-0001',name:'Jose Santos',type:'Companion',snack:false,lunch:false,raffle:null}
];
const normalize=a=>a.map((p,i)=>({
 ...p,
 id:p.id||((p.type==='Companion'?'C':'P')+'-'+String(i+1).padStart(4,'0')),
 linkedId:p.linkedId||'',
 attendance:!!p.attendance,attendanceAt:p.attendanceAt||'',
 snack:!!p.snack,snackAt:p.snackAt||'',
 lunch:!!p.lunch,lunchAt:p.lunchAt||'',
 raffle:p.type==='Companion'?null:!!p.raffle,raffleAt:p.type==='Companion'?'':(p.raffleAt||''),
 docVerify:{
   pwd:p.docVerify?.pwd||'Not Submitted',
   senior:p.docVerify?.senior||'Not Submitted',
   authorization:p.docVerify?.authorization||'Not Submitted'
 },
 docNotes:p.docNotes||''
}));
let people=normalize(JSON.parse(localStorage.getItem(K)||localStorage.getItem('pdw-people-v3')||localStorage.getItem('pdw-people')||'null')||defaultPeople);
function ensureLinks(){
 for(let i=0;i<people.length-1;i++){
   const a=people[i],b=people[i+1];
   if(!a.linkedId&&!b.linkedId&&a.type==='Participant'&&b.type==='Companion'){
     a.linkedId=b.id;b.linkedId=a.id;
   }
 }
}
ensureLinks();
let selected=Number(localStorage.getItem(S)); if(!Number.isInteger(selected)||!people[selected]) selected=null;
let screen='home', query='', winner='', scannerStream=null, pendingCorrection=null, readinessResults=null;
const STAFF_SESSION='pdw-staff-session-v1', STAFF_NAMES='pdw-staff-names-v1', AUDIT_KEY='pdw-audit-v1', RAFFLE_WINNERS_KEY='pdw-raffle-winners-v1', LAST_BACKUP_KEY='pdw-last-backup-v1', STAFF_PIN='2027';
let currentStaff=null, staffNames=[], auditLog=[], raffleWinners=[];
try{currentStaff=JSON.parse(sessionStorage.getItem(STAFF_SESSION)||'null')}catch{}
try{staffNames=JSON.parse(localStorage.getItem(STAFF_NAMES)||'[]')}catch{}
try{auditLog=JSON.parse(localStorage.getItem(AUDIT_KEY)||'[]')}catch{}
try{raffleWinners=JSON.parse(localStorage.getItem(RAFFLE_WINNERS_KEY)||'[]')}catch{}
function addAudit(action,person=null,detail=''){
 if(!currentStaff)return;
 auditLog.unshift({
   at:new Date().toISOString(),
   staff:currentStaff.name,
   action,
   passId:person?.id||'',
   attendee:person?.name||'',
   detail
 });
 if(auditLog.length>5000)auditLog=auditLog.slice(0,5000);
 localStorage.setItem(AUDIT_KEY,JSON.stringify(auditLog));
}
const NEW_KEY='pdw-new-seen-v25';
let seenNew={};try{seenNew=JSON.parse(localStorage.getItem(NEW_KEY)||'{}')}catch{}
function isNew(id){return !seenNew[id]}
function markSeen(id){seenNew[id]=true;localStorage.setItem(NEW_KEY,JSON.stringify(seenNew))}

const save=()=>localStorage.setItem(K,JSON.stringify(people)); save();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const app=document.getElementById('app');
const DOC_DB='pdw-documents-v1', DOC_STORE='documents';
function openDocDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DOC_DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(DOC_STORE))db.createObjectStore(DOC_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putDoc(key,file){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readwrite');tx.objectStore(DOC_STORE).put({name:file.name,type:file.type,size:file.size,updated:Date.now(),blob:file},key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function getDoc(key){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readonly');const r=tx.objectStore(DOC_STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function deleteDoc(key){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readwrite');tx.objectStore(DOC_STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
const docKey=(person,slot)=>person.id+'::'+slot;
async function listDocs(){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readonly');const store=tx.objectStore(DOC_STORE);const out=[];const r=store.openCursor();r.onsuccess=()=>{const c=r.result;if(c){out.push({key:c.key,value:c.value});c.continue()}else resolve(out)};r.onerror=()=>reject(r.error)})}
async function clearDocs(){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readwrite');tx.objectStore(DOC_STORE).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
function blobToDataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
function dataURLToBlob(dataURL){const [head,data]=dataURL.split(',');const mime=(head.match(/data:(.*?);base64/)||[])[1]||'application/octet-stream';const bin=atob(data);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime})}

function u16(n){return new Uint8Array([n&255,(n>>>8)&255])}
function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
function concatBytes(parts){let len=0;for(const p of parts)len+=p.length;const out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
let crcTable=null;
function crc32(bytes){
 if(!crcTable){crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0}}
 let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0
}
function dosDateTime(ms){
 const d=new Date(ms||Date.now()),year=Math.max(1980,d.getFullYear());
 const time=((d.getHours()<<11)|(d.getMinutes()<<5)|(Math.floor(d.getSeconds()/2)))&0xffff;
 const date=(((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xffff;
 return {time,date}
}
function safeFilePart(s){return String(s||'').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'unknown'}
async function makeZip(entries){
 const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
 for(const e of entries){
   const nameBytes=enc.encode(e.name);
   const data=new Uint8Array(await e.blob.arrayBuffer());
   const crc=crc32(data),dt=dosDateTime(e.updated);
   const local=concatBytes([
     u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.date),
     u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0),nameBytes,data
   ]);
   locals.push(local);
   const central=concatBytes([
     u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.date),
     u32(crc),u32(data.length),u32(data.length),u16(nameBytes.length),u16(0),u16(0),
     u16(0),u16(0),u32(0),u32(offset),nameBytes
   ]);
   centrals.push(central);offset+=local.length;
 }
 const centralBlock=concatBytes(centrals),localBlock=concatBytes(locals);
 const end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(entries.length),u16(entries.length),u32(centralBlock.length),u32(localBlock.length),u16(0)]);
 return new Blob([localBlock,centralBlock,end],{type:'application/zip'})
}
function docSlotInfo(key){
 const slot=String(key).split('::')[1]||'';
 if(slot.startsWith('pwd-'))return {group:'pwd',label:slot==='pwd-back'?'PWD-Back':'PWD-Front'};
 if(slot.startsWith('senior-'))return {group:'senior',label:slot==='senior-back'?'Senior-ID-Back':'Senior-ID-Front'};
 if(slot==='authorization')return {group:'authorization',label:'Authorization-Letter'};
 return {group:'other',label:safeFilePart(slot||'Document')}
}
async function exportDocumentFiles(group){
 try{
   const docs=await listDocs(),entries=[];
   for(const d of docs){
     const info=docSlotInfo(d.key);
     if(group!=='all'&&info.group!==group)continue;
     const pass=String(d.key).split('::')[0]||'UNKNOWN';
     const person=people.find(p=>p.id===pass);
     const original=d.value.name||'document';
     const dot=original.lastIndexOf('.');
     const ext=dot>=0?original.slice(dot):'';
     const filename=safeFilePart(pass)+'_'+safeFilePart(person?.name||'Unknown')+'_'+info.label+ext;
     entries.push({name:filename,blob:d.value.blob,updated:d.value.updated||Date.now()});
   }
   if(!entries.length){alert('No uploaded '+(group==='all'?'document files':group==='pwd'?'PWD files':group==='senior'?'Senior ID files':'authorization letters')+' found on this device.');return}
   const zip=await makeZip(entries);
   const a=document.createElement('a');
   a.href=URL.createObjectURL(zip);
   const label=group==='all'?'ALL_DOCUMENTS':group==='pwd'?'PWD_FILES':group==='senior'?'SENIOR_ID_FILES':'AUTHORIZATION_LETTERS';
   a.download='PDW_2027_'+label+'_'+new Date().toISOString().slice(0,10)+'.zip';
   a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
   markSeen('doc-export');
 }catch(e){alert('Could not create the document ZIP file.')}
}
function hasWonRaffle(p){return raffleWinners.some(w=>w.id===p.id)}
function raffleEligible(p){return p.type==='Participant'&&p.attendance===true&&p.raffle===true&&!hasWonRaffle(p)}
function eventStats(){
 const participants=people.filter(p=>p.type==='Participant');
 const companions=people.filter(p=>p.type==='Companion');
 const docsSubmitted=people.reduce((n,p)=>n+['pwd','senior','authorization'].filter(k=>(p.docVerify?.[k]||'Not Submitted')!=='Not Submitted').length,0);
 const docsVerified=people.reduce((n,p)=>n+['pwd','senior','authorization'].filter(k=>p.docVerify?.[k]==='Verified').length,0);
 return {
   total:people.length,
   participants:participants.length,
   companions:companions.length,
   checkedIn:people.filter(p=>p.attendance).length,
   snack:people.filter(p=>p.snack).length,
   lunch:people.filter(p=>p.lunch).length,
   raffleClaimed:participants.filter(p=>p.raffle).length,
   raffleEligible:participants.filter(raffleEligible).length,
   winners:raffleWinners.length,
   docsSubmitted,
   docsVerified
 }
}
function statCard(label,value,note=''){return `<div class="reportStat"><b>${value}</b><span>${label}</span>${note?`<small>${note}</small>`:''}</div>`}

function normalizeName(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function duplicateIssues(list){
 const issues=[],ids=new Map(),names=new Map();
 list.forEach(p=>{
   const id=String(p.id||'').trim().toLowerCase();
   const nk=(p.type||'')+'::'+normalizeName(p.name);
   if(id){
     if(ids.has(id))issues.push('Duplicate Pass ID: '+p.id+' ('+ids.get(id)+' / '+p.name+')');
     else ids.set(id,p.name);
   }
   if(normalizeName(p.name)){
     if(names.has(nk))issues.push('Duplicate '+p.type+' name: '+p.name);
     else names.set(nk,p.name);
   }
 });
 return [...new Set(issues)];
}
function nextWalkInId(type){
 const prefix=type==='Companion'?'C':'P';
 let n=people.filter(p=>p.type===type).length+1,id='';
 do{id=prefix+'-'+String(n++).padStart(4,'0')}while(people.some(p=>String(p.id).toLowerCase()===id.toLowerCase()));
 return id;
}
function readinessRow(id,label,note=''){
 return `<div class="readyRow" data-ready-row="${id}"><span class="readyDot">…</span><div><b>${label}</b><small>${note||'Checking…'}</small></div></div>`
}
function renderReadinessResults(){
 if(!readinessResults)return;
 for(const r of readinessResults){
   const el=document.querySelector('[data-ready-row="'+r.id+'"]');if(!el)continue;
   el.classList.toggle('readyOk',r.ok===true);
   el.classList.toggle('readyWarn',r.ok==='warn');
   el.classList.toggle('readyBad',r.ok===false);
   const dot=el.querySelector('.readyDot'),small=el.querySelector('small');
   dot.textContent=r.ok===true?'✓':r.ok==='warn'?'!':'×';
   small.textContent=r.note;
 }
 const summary=document.getElementById('readySummary');
 if(summary){
   const bad=readinessResults.filter(r=>r.ok===false).length;
   const warn=readinessResults.filter(r=>r.ok==='warn').length;
   summary.className='readySummary '+(bad?'readyBad':warn?'readyWarn':'readyOk');
   summary.innerHTML=bad?'<b>NOT READY YET</b><span>Fix the red items before event day.</span>':warn?'<b>READY WITH NOTES</b><span>Core offline use is ready. Review the yellow items.</span>':'<b>EVENT DEVICE READY</b><span>Core offline checks passed on this device.</span>';
 }
}
async function runReadinessCheck(){
 const results=[];
 let swOk=false,cacheOk=false,dbOk=false;
 try{swOk=!!navigator.serviceWorker?.controller}catch{}
 results.push({id:'sw',ok:swOk,note:swOk?'Offline service worker is active.':'Open this site online once and refresh so offline mode can activate.'});
 try{
   if('caches' in window){const keys=await caches.keys();cacheOk=keys.some(k=>k==='pdw-2027-v25')}
 }catch{}
 results.push({id:'cache',ok:cacheOk,note:cacheOk?'Current v25 app files are cached.':'Current version is not fully cached yet. Open it online once.'});
 results.push({id:'attendees',ok:people.length>0,note:people.length?people.length+' attendee record(s) saved locally.':'No attendee list is saved on this device.'});
 try{const db=await openDocDb();dbOk=!!db;db.close()}catch{}
 results.push({id:'docs',ok:dbOk,note:dbOk?'Local document storage is available.':'Local document storage could not be opened.'});
 results.push({id:'excel',ok:!!window.XLSX,note:window.XLSX?'Excel import library is loaded/cached.':'Excel import library is unavailable offline on this device.'});
 results.push({id:'qrgen',ok:!!window.QRCode,note:window.QRCode?'Digital pass QR generation is available.':'QR generation library is unavailable offline.'});
 const scanOk=('BarcodeDetector' in window);
 results.push({id:'qrscan',ok:scanOk?true:'warn',note:scanOk?'Camera QR detection is supported.':'Camera QR detection is not supported here; staff can still search names manually.'});
 results.push({id:'zip',ok:!!window.JSZip,note:window.JSZip?'Document ZIP export is available.':'ZIP export library is unavailable offline.'});
 const lastBackup=localStorage.getItem(LAST_BACKUP_KEY);
 results.push({id:'backup',ok:lastBackup?true:'warn',note:lastBackup?'Last backup: '+formatTime(lastBackup):'No backup has been created on this device yet.'});
 readinessResults=results;
 renderReadinessResults();
 addAudit('Ran offline readiness check',null,results.filter(r=>r.ok===false).length+' failed');
}

const modules=[
 ['register','1','Register','Step 1 • Upload Excel or register manually offline'],
 ['database','DB','Attendee Database','Search imported names by first or last name'],
 ['profile','NEW','Participant Profile','Summary, linked companion and document verification'],
 ['documents','2','Documents','Step 2 • Collect PWD / Senior ID / authorization'],
 ['pass','3','Digital Passes','Step 3 • Generate individual QR codes'],
 ['scanner','4','QR Scanner','Step 4 • Scan participant or companion QR'],
 ['claims','5','Claims','Step 5 • Check-in + Snack + Lunch + Raffle claims'],
 ['raffle','DRAW','Raffle Draw','Draw a winner from eligible participants only'],
 ['export','DOC','Export Documents','Export document and claim status offline'],
 ['report','RPT','End-of-Event Report','Live totals for attendance, claims, documents and raffle'],
 ['readiness','READY','Offline Readiness Check','Test this device before event day'],
 ['backup','SAFE','Backup / Restore','Save or restore all offline event data'],
 ['audit','LOG','Staff Activity','Offline audit trail of staff actions']
];

function stopScanner(){if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null}}
function setScreen(s){screen=s; pendingCorrection=null; stopScanner(); render(); if(s==='scanner') setTimeout(startScanner,100)}
function selectPerson(i){selected=i;localStorage.setItem(S,String(i));addAudit('Selected attendee',people[i]);screen='database';render()}
function passId(type,n,raw){if(raw)return String(raw).trim();return(type==='Companion'?'C':'P')+'-'+String(n).padStart(4,'0')}

function shell(content){
 return `<main>
 <header class="brand">
   <img class="brandLogo" src="https://e6f82797-63ce-4bab-a068-36498212aea2.sandbox.floot.app/_cdn/static/17d6c48c-4486-4966-82fa-9ac8c81f53ed-pd-warriors-logo.jpg" alt="PD Warriors Philippines logo">
   <div class="brandText">
     <div class="org">PARKINSON'S DISEASE WARRIORS<br>PHILIPPINES</div>
     <h1>Get Together 2027</h1>
     <div class="subtitle">Digital Stub &amp; Document System</div>
   </div>
 </header>
 <div class="rule"></div>
 ${currentStaff?`<div class="staffBar"><div><small>OFFLINE STAFF SESSION</small><b>${esc(currentStaff.name)}</b></div><button id="logoutStaff" type="button">LOG OUT</button></div>`:''}
 ${content}
 <footer>STRENGTH • HOPE • COURAGE • UNITY • HEALING</footer>
 </main>`;
}

function staffLogin(){
 const recent=[...new Set(staffNames)].slice(0,8);
 return `
 <section class="staffLoginPanel">
   <div class="loginBadge">OFFLINE STAFF LOGIN</div>
   <h2>Staff Login</h2>
   <p>Internet is not required. Staff access and activity are stored on this device.</p>
   <label>Staff Name
     <input id="staffName" class="field" list="recentStaff" autocomplete="off" placeholder="Enter staff name">
     <datalist id="recentStaff">${recent.map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>
   </label>
   <label>4-Digit PIN
     <input id="staffPin" class="field" inputmode="numeric" maxlength="4" type="password" placeholder="••••">
   </label>
   <button id="staffLoginBtn" class="primary full">LOGIN OFFLINE</button>
   <p id="staffLoginMsg" class="loginMsg"></p>
   <div class="loginHint">Event PIN: <b>2027</b></div>
 </section>`;
}

function home(){
 return `
 <section class="offlineBox">
   <div class="offlineTitle">OFFLINE MODE</div>
   <p>This event system is designed to operate from data stored on this device.<br>
   Participants receive Snack + Lunch + Raffle.<br>
   Companions receive Snack + Lunch only.</p>
 </section>
 <div class="newFeatureNotice"><b>NEW FEATURES</b><span>Gold-highlighted items are new. The highlight disappears after the first click.</span></div>
 <section class="moduleList">
   ${modules.map(([id,badge,title,desc])=>`
    <button class="moduleCard ${((id==='readiness'&&isNew('readiness'))||(id==='raffle'&&isNew('raffle-safe'))||(id==='report'&&isNew('event-report'))||(id==='profile'&&isNew('profile'))||(id==='backup'&&isNew('backup'))||(id==='claims'&&isNew('claims')))?'newFeature':''}" data-screen="${id}" data-new-id="${id==='readiness'?'readiness':id==='raffle'?'raffle-safe':id==='report'?'event-report':id==='profile'?'profile':id==='backup'?'backup':id==='claims'?'claims':''}">
      <span class="badge">${badge}</span>
      <span class="moduleCopy"><strong>${title}${id==='readiness'&&isNew('readiness')?'<span class="newPill">NEW CHECK</span>':id==='raffle'&&isNew('raffle-safe')?'<span class="newPill">SAFE DRAW</span>':id==='report'&&isNew('event-report')?'<span class="newPill">NEW REPORT</span>':id==='profile'&&isNew('profile')?'<span class="newPill">NEW PROFILE</span>':id==='backup'&&isNew('backup')?'<span class="newPill">NEW FEATURE</span>':id==='claims'&&isNew('claims')?'<span class="newPill">NEW CHECK-IN</span>':''}</strong><small>${id==='database'&&selected!==null&&people[selected]?desc+' • Selected: '+esc(people[selected].name):desc}</small>${id==='database'&&selected!==null&&people[selected]?'<span class="selectedMini">✓ SELECTED</span>':''}</span>
      <span class="chev">›</span>
    </button>`).join('')}
 </section>`;
}

function pageHeader(title){
 return `<div class="sectionHead"><button id="backHome" class="backBtn">‹ HOME</button><h2>${title}</h2></div>`;
}

function body(){
 if(!currentStaff)return staffLogin();
 const p=selected==null?null:people[selected];
 if(screen==='home')return home();
 if(screen==='register')return pageHeader('Register')+`
 <section class="panel">
   <p class="lead">Upload the event Excel list or add a walk-in manually. Data is saved on this device.</p>
   <label class="primary actionLabel">CHOOSE EXCEL<input id="excel" hidden type="file" accept=".xlsx,.xls"></label>
   <p class="note">Looks for <b>Participant Name</b> and <b>Companion Name</b>. Existing Participant No. and Companion No. are used as pass IDs when available.</p>
   <div class="divider"></div>
   <h3>Walk-in Registration</h3>
   <input id="walkname" class="field" placeholder="Full name">
   <div class="split"><select id="walktype" class="field"><option>Participant</option><option>Companion</option></select><button id="addwalk" class="primary">ADD WALK-IN</button></div>
   <p class="savedCount">${people.length} people saved on this device.</p>
 </section>`;

 if(screen==='database')return pageHeader('Attendee Database')+`
 <section class="panel">
   <p class="lead">Search by first name, last name, or any part of the attendee name.</p>
   <input id="search" class="field" value="${esc(query)}" placeholder="Search first name or last name…">
   <div id="results">${results()}</div>
   ${selected!==null&&people[selected]?`
     <div class="selectedProceed">
       <div>
         <small>SELECTED ATTENDEE</small>
         <b>✓ ${esc(people[selected].name)}</b>
         <span>${esc(people[selected].type)} • Pass #${esc(people[selected].id)}</span>
       </div>
       <button id="proceedSelected" class="primary">PROCEED TO NEXT STEP</button>
     </div>`:''}
 </section>`;

 if(screen==='profile')return pageHeader('Participant Profile')+(p?`
 <section class="panel profilePanel">
   <div class="profileHero">
     <div>
       <small>SELECTED ATTENDEE</small>
       <h3>${esc(p.name)}</h3>
       <span>${esc(p.type)} • Pass #${esc(p.id)}</span>
     </div>
     <span class="profileType">${p.type==='Participant'?'RAFFLE ELIGIBLE':'NO RAFFLE'}</span>
   </div>

   <div class="profileQuick">
     <button id="profileDocs" class="primary">UPLOAD DOCUMENTS</button>
     <button id="profilePass" class="softBtn">DIGITAL PASS</button>
     <button id="profileClaims" class="softBtn">CLAIMS / CHECK-IN</button>
   </div>

   <div class="profileSection ${isNew('linking')?'newFeature':''}" id="linkedSection">
     <div class="profileSectionTitle"><b>Linked Participant / Companion</b>${isNew('linking')?'<span class="newPill">NEW LINK</span>':''}</div>
     ${linkedCard(p)}
   </div>

   <div class="profileSection ${isNew('verification')?'newFeature':''}" id="verifySection">
     <div class="profileSectionTitle"><b>Document Verification</b>${isNew('verification')?'<span class="newPill">NEW VERIFICATION</span>':''}</div>
     <div class="verifyGrid">
       ${verifyRow('PWD ID','pwd',p)}
       ${verifyRow('Senior Citizen ID','senior',p)}
       ${verifyRow('Authorization Letter','authorization',p)}
     </div>
     <label class="notesLabel">Staff Notes
       <textarea id="docNotes" class="notesBox" placeholder="Optional verification notes…">${esc(p.docNotes||'')}</textarea>
     </label>
   </div>

   <div class="profileSection">
     <div class="profileSectionTitle"><b>Attendance & Stub Summary</b></div>
     <div class="summaryGrid">
       ${summaryItem('Check-in',p.attendance,p.attendanceAt)}
       ${summaryItem('Snack',p.snack,p.snackAt)}
       ${summaryItem('Lunch',p.lunch,p.lunchAt)}
       ${p.raffle===null?summaryText('Raffle','Not eligible'):summaryItem('Raffle',p.raffle,p.raffleAt)}
     </div>
   </div>
 </section>`:`
 <section class="panel empty"><b>No attendee selected</b><p>Open Attendee Database, search the name, then tap SELECT.</p></section>`);

 if(screen==='documents')return pageHeader('Documents')+(p?`
 <section class="panel">
   <div class="selectedBanner">
     <div><small>SELECTED ATTENDEE</small><b>${esc(p.name)}</b><span>${esc(p.type)} • Pass #${esc(p.id)}${linkedPerson(p)?' • Linked: '+esc(linkedPerson(p).name):''}</span></div>
     <button id="openPass" class="primary">OPEN DIGITAL PASS</button>
   </div>
   <p class="lead">Upload the attendee's supporting documents. Files are stored locally on this device for offline use.</p>

   <div class="docUploadGrid">
     ${docUploadCard('PWD ID — Front','pwd-front')}
     ${docUploadCard('PWD ID — Back','pwd-back')}
     ${docUploadCard('Senior Citizen ID — Front','senior-front')}
     ${docUploadCard('Senior Citizen ID — Back','senior-back')}
     ${docUploadCard('Authorization Letter','authorization')}
   </div>

   <p class="note"><b>Accepted:</b> photo/image or PDF. These files stay on this device unless staff exports or downloads them.</p>

   <div class="divider"></div>
   <section class="docExportBox ${isNew('doc-export')?'newFeature':''}">
     <div class="profileSectionTitle"><b>Export Uploaded Files</b>${isNew('doc-export')?'<span class="newPill">NEW DOWNLOADS</span>':''}</div>
     <p class="note">Download all uploaded files by document type as ZIP files.</p>
     <div class="docExportButtons">
       <button type="button" class="exportDocBtn" data-export-docs="pwd">DOWNLOAD ALL PWD FILES</button>
       <button type="button" class="exportDocBtn" data-export-docs="senior">DOWNLOAD ALL SENIOR ID FILES</button>
       <button type="button" class="exportDocBtn" data-export-docs="authorization">DOWNLOAD ALL AUTHORIZATION LETTERS</button>
       <button type="button" class="exportDocBtn exportAll" data-export-docs="all">DOWNLOAD ALL DOCUMENTS</button>
     </div>
   </section>
 </section>`:`
 <section class="panel empty"><b>No attendee selected</b><p>Open Attendee Database, search the name, then tap SELECT.</p></section>`);

 if(screen==='pass')return pageHeader('Digital Passes')+(p?passCard(p):`
 <section class="panel empty"><b>No attendee selected</b><p>Open Attendee Database, search the name, then tap SELECT.</p></section>`);

 if(screen==='claims')return pageHeader('Claims')+(p?`
 <section class="panel">
   <div class="passCompact">${passSummary(p)}</div>

   <div class="claimDocs">
     <h3>Upload ID Before Claiming Stub</h3>
     <p class="note">Staff can upload the attendee's PWD ID or Senior Citizen ID directly on this claim screen.</p>

     <div class="claimDocButtons">
       <label class="claimDocUpload">
         <span>UPLOAD PWD ID</span>
         <small class="docStatus" data-doc-status="pwd-front">CHECKING…</small>
         <input hidden class="docInput" data-slot="pwd-front" type="file" accept="image/*,.pdf,application/pdf">
       </label>

       <label class="claimDocUpload">
         <span>UPLOAD SENIOR ID</span>
         <small class="docStatus" data-doc-status="senior-front">CHECKING…</small>
         <input hidden class="docInput" data-slot="senior-front" type="file" accept="image/*,.pdf,application/pdf">
       </label>
     </div>

     <div class="claimDocNames">
       <small data-doc-name="pwd-front">PWD ID: No file saved</small>
       <small data-doc-name="senior-front">Senior ID: No file saved</small>
     </div>
   </div>

   <div class="claimDivider"></div>
   ${claimButtons(p)}
 </section>`:`
 <section class="panel empty">Select an attendee first.</section>`);

 if(screen==='scanner')return pageHeader('QR Scanner')+`
 <section class="panel">
   <p id="scanmsg" class="lead">Tap START CAMERA and point the rear camera at the attendee QR code.</p>
   <button id="startcam" class="primary full">START CAMERA</button>
   <video id="camera" class="camera" playsinline muted></video>
   <p class="note">If camera QR detection is unavailable, search the attendee name manually.</p>
 </section>`;

 if(screen==='raffle'){
 const pool=people.filter(raffleEligible);
 return pageHeader('Raffle Draw')+`
 <section class="panel rafflePanel">
   <div class="raffleRules">
     <b>SAFE RAFFLE RULES</b>
     <span>Only participants who are checked in, have claimed their raffle stub, and have not already won are included. Companions are always excluded.</span>
   </div>
   <div class="raffleCount"><b>${pool.length}</b><span>Eligible participants remaining</span></div>
   <button id="draw" class="danger full" ${pool.length?'':'disabled'}>${pool.length?'DRAW WINNER':'NO ELIGIBLE PARTICIPANTS'}</button>
   ${winner?`<div class="winner">${esc(winner)}</div>`:''}
   <div class="winnerHistory">
     <div class="profileSectionTitle"><b>Winner History</b><span class="winnerCount">${raffleWinners.length}</span></div>
     ${raffleWinners.length?raffleWinners.map((w,i)=>`
       <div class="winnerRow">
         <div><b>#${i+1} ${esc(w.name)}</b><span>${esc(w.id)}</span></div>
         <small>${formatTime(w.at)}${w.staff?' • '+esc(w.staff):''}</small>
       </div>`).join(''):'<div class="empty">No raffle winners yet.</div>'}
   </div>
 </section>`;
 }

 if(screen==='report'){
 const s=eventStats();
 return pageHeader('End-of-Event Report')+`
 <section class="panel reportPanel">
   <p class="lead">Live totals from the records currently stored on this device.</p>
   <div class="reportGrid">
     ${statCard('Registered',s.total,s.participants+' participants • '+s.companions+' companions')}
     ${statCard('Checked In',s.checkedIn)}
     ${statCard('Snack Claimed',s.snack)}
     ${statCard('Lunch Claimed',s.lunch)}
     ${statCard('Raffle Claimed',s.raffleClaimed)}
     ${statCard('Raffle Eligible Now',s.raffleEligible)}
     ${statCard('Raffle Winners',s.winners)}
     ${statCard('Documents Submitted',s.docsSubmitted)}
     ${statCard('Documents Verified',s.docsVerified)}
   </div>
   <div class="reportActions">
     <button id="reportCsv" class="primary">DOWNLOAD EVENT REPORT CSV</button>
     <button id="reportStatusCsv" class="softBtn">DOWNLOAD ATTENDEE STATUS CSV</button>
   </div>
   <p class="note">Totals update immediately whenever check-in, claims, verification, or raffle results change on this device.</p>
 </section>`;
 }

 if(screen==='export')return pageHeader('Export Documents')+`
 <section class="panel exportPanel">
   <p class="lead">Export the event records and the actual uploaded document files stored on this device.</p>

   <div class="exportBlock">
     <b>Event Status Report</b>
     <span>Attendance, Snack, Lunch, Raffle, document verification, notes and timestamps.</span>
     <button id="csv" class="primary full">DOWNLOAD STATUS CSV</button>
   </div>

   <div class="exportBlock exportFilesBlock ${isNew('doc-export')?'newFeature':''}">
     <div class="profileSectionTitle"><b>Actual Uploaded Documents</b>${isNew('doc-export')?'<span class="newPill">NEW DOWNLOADS</span>':''}</div>
     <span>Download uploaded files by document type or download everything together.</span>
     <div class="docExportButtons">
       <button type="button" class="exportDocBtn" data-export-docs="pwd">DOWNLOAD ALL PWD FILES</button>
       <button type="button" class="exportDocBtn" data-export-docs="senior">DOWNLOAD ALL SENIOR ID FILES</button>
       <button type="button" class="exportDocBtn" data-export-docs="authorization">DOWNLOAD ALL AUTHORIZATION LETTERS</button>
       <button type="button" class="exportDocBtn exportAll" data-export-docs="all">DOWNLOAD ALL DOCUMENTS</button>
     </div>
     <small>ZIP files are created directly from documents stored on this device.</small>
   </div>

   <p class="note"><b>Offline:</b> once this version has loaded and cached, the ZIP export works from the documents already stored on this device.</p>
 </section>`;

 if(screen==='audit')return pageHeader('Staff Activity')+`
 <section class="panel">
   <p class="lead">Activity is recorded locally on this device while staff are logged in.</p>
   <div class="auditActions"><button id="auditCsv" class="primary">DOWNLOAD AUDIT CSV</button><button id="clearAudit" class="softBtn">CLEAR AUDIT</button></div>
   <div class="auditList">
     ${auditLog.length?auditLog.slice(0,200).map(a=>`
       <div class="auditRow">
         <div><b>${esc(a.action)}</b><span>${esc(a.attendee||'System')}${a.passId?' • '+esc(a.passId):''}</span></div>
         <div><strong>${esc(a.staff)}</strong><small>${formatTime(a.at)}</small></div>
       </div>`).join(''):'<div class="empty">No staff activity recorded yet.</div>'}
   </div>
 </section>`;

 if(screen==='readiness')return pageHeader('Offline Readiness Check')+`
 <section class="panel readinessPanel">
   <p class="lead">Run this check on the actual phone, tablet, or laptop that will be used during the event.</p>
   <div id="readySummary" class="readySummary"><b>CHECK NOT RUN YET</b><span>Tap the button below.</span></div>
   <div class="readyList">
     ${readinessRow('sw','Offline App','Service worker / offline shell')}
     ${readinessRow('cache','Current Version Cached','v25 app files')}
     ${readinessRow('attendees','Attendee List','Participant and companion records')}
     ${readinessRow('docs','Local Document Storage','PWD, Senior ID and Authorization files')}
     ${readinessRow('excel','Excel Import','Offline spreadsheet import')}
     ${readinessRow('qrgen','QR Pass Generator','Digital pass generation')}
     ${readinessRow('qrscan','QR Camera Scanner','Camera scanning support')}
     ${readinessRow('zip','Document ZIP Export','Download all uploaded files')}
     ${readinessRow('backup','Backup File','Recent event backup')}
   </div>
   <button id="runReady" class="primary full">RUN OFFLINE READINESS CHECK</button>
   <p class="note">For the strongest test, run this once online, then switch the device to airplane mode and open the system again.</p>
 </section>`;

 if(screen==='backup')return pageHeader('Backup / Restore')+`
 <section class="panel">
   <p class="lead">Create one offline backup file containing attendees, attendance, stub claims, timestamps, and uploaded documents.</p>
   <button id="backupNow" class="primary full">BACKUP EVENT DATA</button>
   <div class="divider"></div>
   <label class="danger full restoreLabel">RESTORE BACKUP<input id="restoreFile" hidden type="file" accept=".json,application/json"></label>
   <p class="note"><b>Important:</b> restoring replaces the event data currently saved on this device.</p>
 </section>`;
 return '';
}

function render(){
 app.innerHTML=shell(body());
 app.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>{
   if(b.dataset.newId){markSeen(b.dataset.newId)}
   setScreen(b.dataset.screen)
 });
 const back=document.getElementById('backHome'); if(back)back.onclick=()=>setScreen('home');
 wire();
}

function results(){
 const hits=people.map((p,i)=>({p,i})).filter(x=>x.p.name.toLowerCase().includes(query.trim().toLowerCase()));
 if(!hits.length)return '<div class="empty">No name found.</div>';
 return hits.map(({p,i})=>{
  const isSelected=selected===i;
  return `
  <div class="personRow ${isSelected?'selectedPerson':''}">
    <div>
      <div class="personNameLine"><b>${esc(p.name)}</b>${isSelected?'<span class="selectedTag">✓ SELECTED</span>':''}</div>
      <small>${esc(p.type)} • Pass ${esc(p.id)} • ${p.type==='Participant'?'Raffle eligible':'No raffle'}</small>
    </div>
    <button class="primary select ${isSelected?'selectedBtn':''}" data-i="${i}">${isSelected?'OPEN SELECTED':'SELECT'}</button>
  </div>`
 }).join('');
}

function linkedPerson(p){return p.linkedId?people.find(x=>x.id===p.linkedId):null}
function linkedCard(p){
 const l=linkedPerson(p);
 if(!l)return '<div class="linkedEmpty">No linked participant/companion found.</div>';
 return `<button type="button" class="linkedCard" data-linked-id="${esc(l.id)}">
   <div><b>${esc(l.name)}</b><small>${esc(l.type)} • Pass #${esc(l.id)}</small></div>
   <span>OPEN ›</span>
 </button>`
}
function verifyRow(label,key,p){
 const opts=['Not Submitted','Submitted','For Review','Verified','Rejected'];
 return `<label class="verifyRow"><span>${label}</span>
   <select class="verifySelect" data-verify="${key}">
     ${opts.map(o=>`<option value="${o}" ${p.docVerify?.[key]===o?'selected':''}>${o}</option>`).join('')}
   </select>
 </label>`
}
function summaryItem(label,done,time){return `<div class="summaryItem ${done?'done':''}"><b>${label}</b><span>${done?'✓ Complete':'Pending'}</span>${done&&time?`<small>${formatTime(time)}</small>`:''}</div>`}
function summaryText(label,text){return `<div class="summaryItem"><b>${label}</b><span>${text}</span></div>`}
function docGroup(slot){return slot.startsWith('pwd-')?'pwd':slot.startsWith('senior-')?'senior':slot==='authorization'?'authorization':''}
async function refreshProfileDocs(){
 if(selected==null||!people[selected]||screen!=='profile')return;
 const p=people[selected];
 const groups={pwd:['pwd-front','pwd-back'],senior:['senior-front','senior-back'],authorization:['authorization']};
 let changed=false;
 for(const [g,slots] of Object.entries(groups)){
   let has=false;
   for(const s of slots){if(await getDoc(docKey(p,s))){has=true;break}}
   if(has&&p.docVerify[g]==='Not Submitted'){p.docVerify[g]='Submitted';changed=true}
   if(!has&&p.docVerify[g]==='Submitted'){p.docVerify[g]='Not Submitted';changed=true}
 }
 if(changed){save();render()}
}
function docUploadCard(label,slot){return `
 <div class="docUploadCard">
   <div class="docUploadTop"><b>${label}</b><span class="docStatus" data-doc-status="${slot}">CHECKING…</span></div>
   <div class="docActions">
     <label class="docUploadBtn">UPLOAD<input hidden class="docInput" data-slot="${slot}" type="file" accept="image/*,.pdf,application/pdf"></label>
     <button class="docViewBtn" data-view-slot="${slot}" type="button">VIEW</button>
     <button class="docDeleteBtn" data-delete-slot="${slot}" type="button">DELETE</button>
   </div>
   <small class="docFileName" data-doc-name="${slot}">No file saved</small>
 </div>`}
async function refreshDocStatuses(){
 if(selected==null||!people[selected])return;
 const p=people[selected];
 const slots=['pwd-front','pwd-back','senior-front','senior-back','authorization'];
 for(const slot of slots){
   const rec=await getDoc(docKey(p,slot));
   const st=document.querySelector('[data-doc-status="'+slot+'"]');
   const nm=document.querySelector('[data-doc-name="'+slot+'"]');
   const view=document.querySelector('[data-view-slot="'+slot+'"]');
   const del=document.querySelector('[data-delete-slot="'+slot+'"]');
   if(st){st.textContent=rec?'SAVED':'NOT SUBMITTED';st.classList.toggle('saved',!!rec)}
   if(nm){
   const prefix=slot==='pwd-front'?'PWD ID: ':slot==='senior-front'?'Senior ID: ':'';
   nm.textContent=prefix+(rec?rec.name:'No file saved');
 }
   if(view)view.disabled=!rec;
   if(del)del.disabled=!rec;
 }
}
async function viewDoc(slot){
 if(selected==null)return;
 const p=people[selected], rec=await getDoc(docKey(p,slot));
 if(!rec)return;
 const url=URL.createObjectURL(rec.blob);
 window.open(url,'_blank');
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function removeDoc(slot){
 if(selected==null)return;
 if(!confirm('Delete this document from this device?'))return;
 await deleteDoc(docKey(people[selected],slot));
 addAudit('Document deleted',people[selected],slot);
 const g=docGroup(slot);
 if(g){
   const p=people[selected];
   const related=g==='pwd'?['pwd-front','pwd-back']:g==='senior'?['senior-front','senior-back']:['authorization'];
   let remains=false;for(const s of related){if(await getDoc(docKey(p,s))){remains=true;break}}
   if(!remains)p.docVerify[g]='Not Submitted';
   save();
 }
 await refreshDocStatuses();
}
function passSummary(p){return `<div class="passName">${esc(p.name)}</div><div class="passMeta">${esc(p.type)} • Pass #${esc(p.id)}</div>`}
function passCard(p){return `
 <section class="panel pass">
   ${passSummary(p)}
   <div id="qr" class="qr"></div>
   <div class="qrLabel">QR CODE GENERATED</div>
   <button id="gotoclaims" class="primary full">OPEN CLAIMS</button>
 </section>`}
function formatTime(v){if(!v)return'';try{return new Date(v).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return v}}
function claimButtons(p){
 const ks=['attendance','snack','lunch',...(p.raffle===null?[]:['raffle'])];
 return `<div class="claims" id="claimsGrid">${ks.map(k=>{
   const label=k==='attendance'?'CHECK-IN':k.toUpperCase();
   const done=!!p[k], t=p[k+'At']||'', correcting=pendingCorrection===k;
   const highlight=k==='attendance'&&!done;
   return `<button type="button" class="claim ${done?'claimed':''} ${highlight?'newFeature checkinHighlight':''} ${correcting?'correctionMode':''}" data-k="${k}" aria-pressed="${done?'true':'false'}">
     <span>${label}${highlight?'<b class="newPill claimNew">NEW FEATURE</b>':''}</span>
     <small>${correcting?'TAP AGAIN TO UNDO':done?'✓ '+(k==='attendance'?'CHECKED IN':'CLAIMED')+' • TAP TO CORRECT':'TAP TO '+(k==='attendance'?'CHECK IN':'CLAIM')}</small>
     ${done&&t?`<em>${formatTime(t)}</em>`:''}
   </button>`
 }).join('')}</div>`;
}

function wire(){
 const loginBtn=document.getElementById('staffLoginBtn');
 if(loginBtn)loginBtn.onclick=()=>{
   const name=document.getElementById('staffName').value.trim();
   const pin=document.getElementById('staffPin').value.trim();
   const msg=document.getElementById('staffLoginMsg');
   if(!name){msg.textContent='Enter the staff name.';return}
   if(pin!==STAFF_PIN){msg.textContent='Incorrect PIN.';return}
   currentStaff={name,loginAt:new Date().toISOString()};
   sessionStorage.setItem(STAFF_SESSION,JSON.stringify(currentStaff));
   if(!staffNames.includes(name)){staffNames.unshift(name);staffNames=staffNames.slice(0,20);localStorage.setItem(STAFF_NAMES,JSON.stringify(staffNames))}
   addAudit('Staff login');
   screen='home';render();
 };
 const logout=document.getElementById('logoutStaff');
 if(logout)logout.onclick=()=>{addAudit('Staff logout');currentStaff=null;sessionStorage.removeItem(STAFF_SESSION);screen='home';stopScanner();render()};
 const ex=document.getElementById('excel'); if(ex)ex.onchange=e=>e.target.files[0]&&importExcel(e.target.files[0]);
 const runReady=document.getElementById('runReady'); if(runReady)runReady.onclick=runReadinessCheck;
 if(screen==='readiness'&&readinessResults)setTimeout(renderReadinessResults,0);
 const openPass=document.getElementById('openPass'); if(openPass)openPass.onclick=()=>setScreen('pass');
 const profileDocs=document.getElementById('profileDocs'); if(profileDocs)profileDocs.onclick=()=>setScreen('documents');
 const profilePass=document.getElementById('profilePass'); if(profilePass)profilePass.onclick=()=>setScreen('pass');
 const profileClaims=document.getElementById('profileClaims'); if(profileClaims)profileClaims.onclick=()=>setScreen('claims');
 const linkedBtn=document.querySelector('.linkedCard'); if(linkedBtn)linkedBtn.onclick=()=>{
   const i=people.findIndex(x=>x.id===linkedBtn.dataset.linkedId);
   if(i>=0){markSeen('linking');selected=i;localStorage.setItem(S,String(i));screen='profile';render();setTimeout(refreshProfileDocs,0)}
 };
 document.querySelectorAll('.verifySelect').forEach(sel=>sel.onchange=e=>{
   if(selected==null)return;
   people[selected].docVerify[e.target.dataset.verify]=e.target.value;
   addAudit('Document verification changed',people[selected],e.target.dataset.verify+' → '+e.target.value);
   markSeen('verification');save();render();
 });
 const notes=document.getElementById('docNotes'); if(notes)notes.onchange=e=>{if(selected==null)return;people[selected].docNotes=e.target.value;addAudit('Verification notes updated',people[selected]);save()};
 document.querySelectorAll('.docInput').forEach(inp=>inp.onchange=async e=>{
   const file=e.target.files?.[0]; if(!file||selected==null)return;
   try{
   const slot=e.target.dataset.slot;
   await putDoc(docKey(people[selected],slot),file);
   addAudit('Document uploaded',people[selected],slot+' • '+file.name);
   const g=docGroup(slot);
   if(g&&people[selected].docVerify[g]==='Not Submitted')people[selected].docVerify[g]='Submitted';
   save();
   await refreshDocStatuses();
   if(screen==='profile')render();
 }
   catch{alert('Could not save this document on the device.')}
 });
 document.querySelectorAll('[data-view-slot]').forEach(b=>b.onclick=()=>viewDoc(b.dataset.viewSlot));
 document.querySelectorAll('[data-delete-slot]').forEach(b=>b.onclick=()=>removeDoc(b.dataset.deleteSlot));
 if((screen==='documents'||screen==='claims')&&selected!==null)setTimeout(refreshDocStatuses,0);
 const add=document.getElementById('addwalk'); if(add)add.onclick=()=>{
  const n=document.getElementById('walkname').value.trim(),t=document.getElementById('walktype').value;
  if(!n)return alert('Enter a name.');
  const duplicate=people.find(p=>p.type===t&&normalizeName(p.name)===normalizeName(n));
  if(duplicate){
    addAudit('Duplicate walk-in blocked',duplicate,n);
    return alert('DUPLICATE WARNING\n\n'+n+' is already registered as a '+t+' with Pass '+duplicate.id+'.\n\nNo duplicate was added.');
  }
  const id=nextWalkInId(t);
  people.push({id,name:n,type:t,linkedId:'',attendance:false,attendanceAt:'',snack:false,snackAt:'',lunch:false,lunchAt:'',raffle:t==='Companion'?null:false,raffleAt:'',docVerify:{pwd:'Not Submitted',senior:'Not Submitted',authorization:'Not Submitted'},docNotes:''});
  addAudit('Walk-in registered',people[people.length-1]);
  save();alert('Walk-in saved offline. Pass '+id);render()
 };
 const s=document.getElementById('search'); if(s)s.oninput=e=>{query=e.target.value;document.getElementById('results').innerHTML=results();bindSelect()};
 bindSelect();
 const proceedSelected=document.getElementById('proceedSelected'); if(proceedSelected)proceedSelected.onclick=()=>setScreen('profile');
 const p=selected==null?null:people[selected];
 if(p&&document.getElementById('qr')){
  const el=document.getElementById('qr');
  if(window.QRCode)new QRCode(el,{text:JSON.stringify({event:'PDWPH-GET-TOGETHER-2027',passId:p.id,name:p.name,type:p.type}),width:210,height:210,correctLevel:QRCode.CorrectLevel.M});
  else el.textContent='QR library loading…';
 }
 const g=document.getElementById('gotoclaims'); if(g)g.onclick=()=>setScreen('claims');
 const claimsGrid=document.getElementById('claimsGrid');
 if(claimsGrid)claimsGrid.addEventListener('click',e=>{
   const b=e.target.closest('.claim'); if(!b||selected==null)return;
   e.preventDefault(); e.stopPropagation();
   const k=b.dataset.k;
   const already=!!people[selected][k];
   if(already){
     if(pendingCorrection===k){
       people[selected][k]=false;
       people[selected][k+'At']='';
       addAudit('Claim corrected / undone',people[selected],k);
       pendingCorrection=null;
       save(); render(); return;
     }
     pendingCorrection=k;
     render(); return;
   }
   pendingCorrection=null;
   people[selected][k]=true;
   people[selected][k+'At']=new Date().toISOString();
   addAudit(k==='attendance'?'Checked in':'Claim recorded',people[selected],k);
   if(isNew('timestamps'))markSeen('timestamps');
   save(); render();
 },true);
 const d=document.getElementById('draw'); if(d)d.onclick=()=>{
   const pool=people.filter(raffleEligible);
   if(!pool.length)return;
   const picked=pool[Math.floor(Math.random()*pool.length)];
   const record={id:picked.id,name:picked.name,at:new Date().toISOString(),staff:currentStaff?.name||''};
   raffleWinners.push(record);
   localStorage.setItem(RAFFLE_WINNERS_KEY,JSON.stringify(raffleWinners));
   winner=picked.name;
   addAudit('Raffle winner drawn',picked,'Winner #'+raffleWinners.length);
   render();
 };
 const c=document.getElementById('csv'); if(c)c.onclick=exportCsv;
 const reportCsv=document.getElementById('reportCsv'); if(reportCsv)reportCsv.onclick=exportEventReportCsv;
 const reportStatusCsv=document.getElementById('reportStatusCsv'); if(reportStatusCsv)reportStatusCsv.onclick=exportCsv;
 document.querySelectorAll('[data-export-docs]').forEach(b=>b.onclick=()=>exportDocumentFiles(b.dataset.exportDocs));
 const zipBtn=document.getElementById('exportDocsZip'); if(zipBtn)zipBtn.onclick=exportDocumentFiles;
 const auditCsv=document.getElementById('auditCsv'); if(auditCsv)auditCsv.onclick=exportAuditCsv;
 const clearAudit=document.getElementById('clearAudit'); if(clearAudit)clearAudit.onclick=()=>{
   if(confirm('Clear the staff activity log saved on this device?')){addAudit('Cleared audit trail');auditLog=[];localStorage.setItem(AUDIT_KEY,'[]');render()}
 };
 const bk=document.getElementById('backupNow'); if(bk)bk.onclick=backupEventData;
 const rf=document.getElementById('restoreFile'); if(rf)rf.onchange=e=>e.target.files?.[0]&&restoreEventData(e.target.files[0]);
 const st=document.getElementById('startcam'); if(st)st.onclick=startScanner;
}
function bindSelect(){document.querySelectorAll('.select').forEach(b=>b.onclick=()=>selectPerson(Number(b.dataset.i)))}

async function importExcel(file){
 try{
  if(!window.XLSX)throw Error('Excel library not loaded');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),sh=wb.Sheets[wb.SheetNames[0]],m=XLSX.utils.sheet_to_json(sh,{header:1,defval:''});
  const hi=m.findIndex(r=>Array.isArray(r)&&r.some(v=>String(v).trim().toLowerCase()==='participant name'));
  if(hi<0)return alert('Participant Name header not found.');
  const h=m[hi].map(v=>String(v).trim().toLowerCase()),pc=h.indexOf('participant name'),cc=h.indexOf('companion name'),pid=h.indexOf('participant no.'),cid=h.indexOf('companion no.');
  const a=[];let pn=0,cn=0;
  m.slice(hi+1).forEach(r=>{
   const pnme=String(r[pc]||'').trim(),cnme=cc>=0?String(r[cc]||'').trim():'';
   let pObj=null,cObj=null;
   if(pnme){pn++;pObj={id:passId('Participant',pn,pid>=0?r[pid]:''),name:pnme,type:'Participant',linkedId:'',attendance:false,attendanceAt:'',snack:false,snackAt:'',lunch:false,lunchAt:'',raffle:false,raffleAt:'',docVerify:{pwd:'Not Submitted',senior:'Not Submitted',authorization:'Not Submitted'},docNotes:''}}
   if(cnme){cn++;cObj={id:passId('Companion',cn,cid>=0?r[cid]:''),name:cnme,type:'Companion',linkedId:'',attendance:false,attendanceAt:'',snack:false,snackAt:'',lunch:false,lunchAt:'',raffle:null,raffleAt:'',docVerify:{pwd:'Not Submitted',senior:'Not Submitted',authorization:'Not Submitted'},docNotes:''}}
   if(pObj&&cObj){pObj.linkedId=cObj.id;cObj.linkedId=pObj.id}
   if(pObj)a.push(pObj);if(cObj)a.push(cObj)
  });
  if(!a.length)return alert('No participant names found below the header.');
  const dupes=duplicateIssues(a);
  if(dupes.length){
    addAudit('Excel import blocked for duplicates',null,dupes.length+' duplicate issue(s)');
    return alert('DUPLICATE WARNING\n\nThe Excel file was NOT imported.\n\n'+dupes.slice(0,8).join('\n')+(dupes.length>8?'\n…plus '+(dupes.length-8)+' more.':''));
  }
  people=normalize(a);ensureLinks();selected=null;addAudit('Excel attendee list imported',null,a.length+' people');save();localStorage.removeItem(S);alert(a.length+' people imported and linked offline. No duplicates found.');render()
 }catch(e){alert('Could not read this Excel file.')}
}

function exportEventReportCsv(){
 const s=eventStats();
 const rows=[
   ['PD Warriors Philippines Get Together 2027','End-of-Event Report'],
   ['Generated',new Date().toISOString()],
   ['Metric','Total'],
   ['Registered',s.total],
   ['Participants',s.participants],
   ['Companions',s.companions],
   ['Checked In',s.checkedIn],
   ['Snack Claimed',s.snack],
   ['Lunch Claimed',s.lunch],
   ['Raffle Claimed',s.raffleClaimed],
   ['Raffle Eligible Now',s.raffleEligible],
   ['Raffle Winners',s.winners],
   ['Documents Submitted',s.docsSubmitted],
   ['Documents Verified',s.docsVerified],
   [],
   ['Raffle Winner History'],
   ['Pass ID','Name','Draw Time','Staff'],
   ...raffleWinners.map(w=>[w.id,w.name,w.at,w.staff])
 ];
 const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='PDW_2027_End_of_Event_Report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 addAudit('Downloaded end-of-event report');
}
function exportCsv(){
 const rows=[['Pass ID','Name','Type','Linked Pass','Linked Name','PWD Verification','Senior ID Verification','Authorization Verification','Verification Notes','Attendance','Check-in Time','Snack','Snack Time','Lunch','Lunch Time','Raffle','Raffle Time'],...people.map(p=>{const l=linkedPerson(p);return[p.id,p.name,p.type,p.linkedId||'',l?.name||'',p.docVerify?.pwd||'Not Submitted',p.docVerify?.senior||'Not Submitted',p.docVerify?.authorization||'Not Submitted',p.docNotes||'',p.attendance?'Checked in':'Not checked in',p.attendanceAt?formatTime(p.attendanceAt):'',p.snack?'Claimed':'Not claimed',p.snackAt?formatTime(p.snackAt):'',p.lunch?'Claimed':'Not claimed',p.lunchAt?formatTime(p.lunchAt):'',p.raffle===null?'Not eligible':p.raffle?'Claimed':'Not claimed',p.raffleAt?formatTime(p.raffleAt):'']})];
 const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='PDW_2027_Attendees_Claims.csv';a.click();URL.revokeObjectURL(a.href)
}

function safeFilePart(v){return String(v||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').slice(0,90)||'Unknown'}
function slotFileLabel(slot){
 const labels={
   'pwd-front':'PWD_ID_Front',
   'pwd-back':'PWD_ID_Back',
   'senior-front':'Senior_Citizen_ID_Front',
   'senior-back':'Senior_Citizen_ID_Back',
   'authorization':'Authorization_Letter'
 };
 return labels[slot]||safeFilePart(slot);
}
function fileExtension(name,type){
 const m=String(name||'').match(/(\.[A-Za-z0-9]{1,8})$/);
 if(m)return m[1];
 if(type==='application/pdf')return '.pdf';
 if(type==='image/png')return '.png';
 if(type==='image/jpeg')return '.jpg';
 return '';
}
async function exportDocumentFiles(){
 const btn=document.getElementById('exportDocsZip');
 const status=document.getElementById('exportDocsStatus');
 try{
   if(!window.JSZip){alert('ZIP exporter is still loading. Please reopen this page once while online, then try again.');return}
   const docs=await listDocs();
   if(!docs.length){alert('There are no uploaded document files to export yet.');return}
   if(btn){btn.disabled=true;btn.textContent='CREATING ZIP…'}
   if(status)status.textContent=docs.length+' uploaded file'+(docs.length===1?'':'s')+' found. Preparing export…';

   const zip=new JSZip();
   const root=zip.folder('PDW_2027_Documents');
   const manifest=[['Pass ID','Name','Type','Document','Original File','Verification Status']];

   for(const d of docs){
     const key=String(d.key||'');
     const split=key.indexOf('::');
     const passId=split>=0?key.slice(0,split):key;
     const slot=split>=0?key.slice(split+2):'document';
     const person=people.find(p=>p.id===passId);
     const personName=person?.name||'Unknown Attendee';
     const folderName=safeFilePart(passId+' - '+personName);
     const folder=root.folder(folderName);
     const label=slotFileLabel(slot);
     const ext=fileExtension(d.value?.name,d.value?.type);
     folder.file(label+ext,d.value.blob);

     const group=docGroup(slot);
     const verify=group?(person?.docVerify?.[group]||'Not Submitted'):'';
     manifest.push([passId,personName,person?.type||'',label,d.value?.name||'',verify]);
   }

   const manifestCsv=manifest.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
   root.file('Document_Manifest.csv',manifestCsv);

   const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
   const a=document.createElement('a');
   a.href=URL.createObjectURL(blob);
   a.download='PDW_2027_Document_Files_'+new Date().toISOString().slice(0,10)+'.zip';
   a.click();
   setTimeout(()=>URL.revokeObjectURL(a.href),3000);
   if(status)status.textContent=docs.length+' document file'+(docs.length===1?'':'s')+' exported successfully.';
 }catch(e){
   console.error(e);
   alert('Could not export the document ZIP on this device.');
   if(status)status.textContent='Document export failed. Please try again.';
 }finally{
   if(btn){btn.disabled=false;btn.textContent='EXPORT DOCUMENT FILES (.ZIP)'}
 }
}

function docSlotInfo(key){
 const slot=String(key).split('::')[1]||'';
 if(slot.startsWith('pwd-'))return {group:'pwd',label:slot==='pwd-back'?'PWD-Back':'PWD-Front'};
 if(slot.startsWith('senior-'))return {group:'senior',label:slot==='senior-back'?'Senior-ID-Back':'Senior-ID-Front'};
 if(slot==='authorization')return {group:'authorization',label:'Authorization-Letter'};
 return {group:'other',label:'Document'};
}
function safeName(s){return String(s||'').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim()||'Unknown'}
async function exportDocumentFiles(group){
 try{
   if(!window.JSZip){alert('ZIP library is not ready. Reopen the site while online once, then try again.');return}
   const docs=await listDocs(),zip=new JSZip();let count=0;
   for(const d of docs){
     const info=docSlotInfo(d.key); if(group!=='all'&&info.group!==group)continue;
     const pass=String(d.key).split('::')[0]||'UNKNOWN';
     const person=people.find(p=>p.id===pass);
     const original=d.value.name||'document';
     const dot=original.lastIndexOf('.'),ext=dot>=0?original.slice(dot):'';
     zip.file(safeName(pass)+'_'+safeName(person?.name||'Unknown')+'_'+info.label+ext,d.value.blob);
     count++;
   }
   if(!count){alert('No uploaded files found for this category.');return}
   const blob=await zip.generateAsync({type:'blob'});
   const a=document.createElement('a');a.href=URL.createObjectURL(blob);
   const label=group==='all'?'ALL_DOCUMENTS':group==='pwd'?'PWD_FILES':group==='senior'?'SENIOR_ID_FILES':'AUTHORIZATION_LETTERS';
   a.download='PDW_2027_'+label+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
   markSeen('doc-export');
 }catch{alert('Could not create the document ZIP file.')}
}

function exportAuditCsv(){
 const rows=[['Time','Staff','Action','Pass ID','Attendee','Detail'],...auditLog.map(a=>[a.at,a.staff,a.action,a.passId,a.attendee,a.detail])];
 const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='PDW_2027_Staff_Audit.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function backupEventData(){
 try{
  const docs=await listDocs();
  const packedDocs=[];
  for(const d of docs){
   packedDocs.push({key:d.key,name:d.value.name,type:d.value.type,size:d.value.size,updated:d.value.updated,data:await blobToDataURL(d.value.blob)});
  }
  const payload={version:2,event:'PDWPH-GET-TOGETHER-2027',exportedAt:new Date().toISOString(),people,selected,raffleWinners,auditLog,documents:packedDocs};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));a.download='PDW_2027_OFFLINE_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);localStorage.setItem(LAST_BACKUP_KEY,new Date().toISOString());addAudit('Event backup created');
 }catch{alert('Could not create the backup file.')}
}
async function restoreEventData(file){
 try{
  const data=JSON.parse(await file.text());
  if(!Array.isArray(data.people))throw Error('Invalid backup');
  if(!confirm('Restore this backup and replace the current event data on this device?'))return;
  people=normalize(data.people);ensureLinks();selected=(Number.isInteger(data.selected)&&people[data.selected])?data.selected:null;
  raffleWinners=Array.isArray(data.raffleWinners)?data.raffleWinners:[];
  auditLog=Array.isArray(data.auditLog)?data.auditLog:auditLog;
  localStorage.setItem(RAFFLE_WINNERS_KEY,JSON.stringify(raffleWinners));
  localStorage.setItem(AUDIT_KEY,JSON.stringify(auditLog));
  save();
  if(selected===null)localStorage.removeItem(S);else localStorage.setItem(S,String(selected));
  await clearDocs();
  for(const d of (data.documents||[])){
    const blob=dataURLToBlob(d.data);
    const restored=new File([blob],d.name||'document',{type:d.type||blob.type});
    await putDoc(d.key,restored);
  }
  alert('Backup restored successfully.');screen='home';render();
 }catch{alert('This backup file could not be restored.')}
}

async function startScanner(){
 const msg=document.getElementById('scanmsg'),video=document.getElementById('camera');if(!video)return;
 if(!('BarcodeDetector'in window)){msg.textContent='QR scanning is not supported by this browser. Search the attendee name manually.';return}
 try{
  scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});video.srcObject=scannerStream;await video.play();
  const detector=new BarcodeDetector({formats:['qr_code']});msg.textContent='Camera active — point at the QR code.';
  const loop=async()=>{
   if(screen!=='scanner'||!scannerStream)return;
   try{
    const codes=await detector.detect(video);
    if(codes[0]){
     let data;try{data=JSON.parse(codes[0].rawValue)}catch{}
     const i=people.findIndex(x=>(data?.passId&&x.id===data.passId)||(data?.name&&x.name===data.name));
     if(i>=0){stopScanner();selected=i;localStorage.setItem(S,String(i));screen='claims';render();return}
     msg.textContent='QR read, but attendee was not found on this device.'
    }
   }catch{}
   requestAnimationFrame(loop)
  };loop()
 }catch{msg.textContent='Camera permission was not granted or the camera is unavailable.'}
}
render();
})();