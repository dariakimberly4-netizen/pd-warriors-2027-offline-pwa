(()=> {
const K='pdw-people-v4', S='pdw-selected-v4';
const defaultPeople=[
 {id:'P-0001',name:'Maria Santos',type:'Participant',snack:false,lunch:false,raffle:false},
 {id:'C-0001',name:'Jose Santos',type:'Companion',snack:false,lunch:false,raffle:null}
];
const normalize=a=>a.map((p,i)=>({...p,id:p.id||((p.type==='Companion'?'C':'P')+'-'+String(i+1).padStart(4,'0')),attendance:!!p.attendance,attendanceAt:p.attendanceAt||'',snack:!!p.snack,snackAt:p.snackAt||'',lunch:!!p.lunch,lunchAt:p.lunchAt||'',raffle:p.type==='Companion'?null:!!p.raffle,raffleAt:p.type==='Companion'?'':(p.raffleAt||'')}));
let people=normalize(JSON.parse(localStorage.getItem(K)||localStorage.getItem('pdw-people-v3')||localStorage.getItem('pdw-people')||'null')||defaultPeople);
let selected=Number(localStorage.getItem(S)); if(!Number.isInteger(selected)||!people[selected]) selected=null;
let screen='home', query='', winner='', scannerStream=null;
const NEW_KEY='pdw-new-seen-v16';
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
const modules=[
 ['register','1','Register','Step 1 • Upload Excel or register manually offline'],
 ['database','DB','Attendee Database','Search imported names by first or last name'],
 ['documents','2','Documents','Step 2 • Collect PWD / Senior ID / authorization'],
 ['pass','3','Digital Passes','Step 3 • Generate individual QR codes'],
 ['scanner','4','QR Scanner','Step 4 • Scan participant or companion QR'],
 ['claims','5','Claims','Step 5 • Check-in + Snack + Lunch + Raffle claims'],
 ['raffle','DRAW','Raffle Draw','Draw a winner from eligible participants only'],
 ['export','DOC','Export Documents','Export document and claim status offline'],
 ['backup','SAFE','Backup / Restore','Save or restore all offline event data']
];

function stopScanner(){if(scannerStream){scannerStream.getTracks().forEach(t=>t.stop());scannerStream=null}}
function setScreen(s){screen=s; stopScanner(); render(); if(s==='scanner') setTimeout(startScanner,100)}
function selectPerson(i){selected=i;localStorage.setItem(S,String(i));screen='documents';render();setTimeout(refreshDocStatuses,0)}
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
 ${content}
 <footer>STRENGTH • HOPE • COURAGE • UNITY • HEALING</footer>
 </main>`;
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
    <button class="moduleCard ${((id==='backup'&&isNew('backup'))||(id==='claims'&&isNew('claims')))?'newFeature':''}" data-screen="${id}" data-new-id="${id==='backup'?'backup':id==='claims'?'claims':''}">
      <span class="badge">${badge}</span>
      <span class="moduleCopy"><strong>${title}${id==='backup'&&isNew('backup')?'<span class="newPill">NEW FEATURE</span>':id==='claims'&&isNew('claims')?'<span class="newPill">NEW CHECK-IN</span>':''}</strong><small>${desc}</small></span>
      <span class="chev">›</span>
    </button>`).join('')}
 </section>`;
}

function pageHeader(title){
 return `<div class="sectionHead"><button id="backHome" class="backBtn">‹ HOME</button><h2>${title}</h2></div>`;
}

function body(){
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
 </section>`;

 if(screen==='documents')return pageHeader('Documents')+(p?`
 <section class="panel">
   <div class="selectedBanner">
     <div><small>SELECTED ATTENDEE</small><b>${esc(p.name)}</b><span>${esc(p.type)} • Pass #${esc(p.id)}</span></div>
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

 if(screen==='raffle')return pageHeader('Raffle Draw')+`
 <section class="panel">
   <p class="lead">Eligible pool: <b>${people.filter(x=>x.type==='Participant').length} participants</b>. Companions are excluded.</p>
   <button id="draw" class="danger full">DRAW WINNER</button>
   ${winner?`<div class="winner">${esc(winner)}</div>`:''}
 </section>`;

 if(screen==='export')return pageHeader('Export Documents')+`
 <section class="panel">
   <p class="lead">Export attendee, attendance and claim status stored on this device.</p>
   <button id="csv" class="primary full">DOWNLOAD CSV</button>
   <p class="note">The CSV contains status and timestamps. Use Backup / Restore to preserve actual uploaded document files.</p>
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
 return hits.map(({p,i})=>`
  <div class="personRow">
    <div><b>${esc(p.name)}</b><small>${esc(p.type)} • Pass ${esc(p.id)} • ${p.type==='Participant'?'Raffle eligible':'No raffle'}</small></div>
    <button class="primary select" data-i="${i}">SELECT</button>
  </div>`).join('');
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
 return `<div class="claims">${ks.map(k=>{
   const label=k==='attendance'?'CHECK-IN':k.toUpperCase();
   const done=!!p[k], t=p[k+'At']||'';
   return `<button class="claim ${done?'claimed':''} ${k==='attendance'&&isNew('attendance')?'newFeature':''}" data-k="${k}" data-new-id="${k==='attendance'?'attendance':''}" ${done?'disabled':''}>
     <span>${label}${k==='attendance'&&isNew('attendance')?'<b class="newPill claimNew">NEW FEATURE</b>':''}</span>
     <small>${done?'✓ '+(k==='attendance'?'CHECKED IN':'CLAIMED')+' • TAP TO CORRECT':'TAP TO '+(k==='attendance'?'CHECK IN':'CLAIM')}</small>
     ${done&&t?`<em>${formatTime(t)}${isNew('timestamps')?'<b class="timeNew"> NEW TIMESTAMP</b>':''}</em>`:''}
   </button>`
 }).join('')}</div>`;
}

function wire(){
 const ex=document.getElementById('excel'); if(ex)ex.onchange=e=>e.target.files[0]&&importExcel(e.target.files[0]);
 const openPass=document.getElementById('openPass'); if(openPass)openPass.onclick=()=>setScreen('pass');
 document.querySelectorAll('.docInput').forEach(inp=>inp.onchange=async e=>{
   const file=e.target.files?.[0]; if(!file||selected==null)return;
   try{await putDoc(docKey(people[selected],e.target.dataset.slot),file);await refreshDocStatuses()}
   catch{alert('Could not save this document on the device.')}
 });
 document.querySelectorAll('[data-view-slot]').forEach(b=>b.onclick=()=>viewDoc(b.dataset.viewSlot));
 document.querySelectorAll('[data-delete-slot]').forEach(b=>b.onclick=()=>removeDoc(b.dataset.deleteSlot));
 if((screen==='documents'||screen==='claims')&&selected!==null)setTimeout(refreshDocStatuses,0);
 const add=document.getElementById('addwalk'); if(add)add.onclick=()=>{
  const n=document.getElementById('walkname').value.trim(),t=document.getElementById('walktype').value;
  if(!n)return alert('Enter a name.');
  const count=people.filter(x=>x.type===t).length+1;
  people.push({id:passId(t,count),name:n,type:t,attendance:false,attendanceAt:'',snack:false,snackAt:'',lunch:false,lunchAt:'',raffle:t==='Companion'?null:false,raffleAt:''});
  save();alert('Walk-in saved offline.');render()
 };
 const s=document.getElementById('search'); if(s)s.oninput=e=>{query=e.target.value;document.getElementById('results').innerHTML=results();bindSelect()};
 bindSelect();
 const p=selected==null?null:people[selected];
 if(p&&document.getElementById('qr')){
  const el=document.getElementById('qr');
  if(window.QRCode)new QRCode(el,{text:JSON.stringify({event:'PDWPH-GET-TOGETHER-2027',passId:p.id,name:p.name,type:p.type}),width:210,height:210,correctLevel:QRCode.CorrectLevel.M});
  else el.textContent='QR library loading…';
 }
 const g=document.getElementById('gotoclaims'); if(g)g.onclick=()=>setScreen('claims');
 document.querySelectorAll('.claim').forEach(b=>b.onclick=()=>{
   const k=b.dataset.k;if(selected==null)return;
   const already=!!people[selected][k];
   if(already){
     const label=k==='attendance'?'check-in':k+' claim';
     if(!confirm('This '+label+' is already recorded. Undo it?'))return;
     people[selected][k]=false;
     people[selected][k+'At']='';
     save();render();return;
   }
   people[selected][k]=true;
   people[selected][k+'At']=new Date().toISOString();
   if(isNew('timestamps'))markSeen('timestamps');
   save();render()
 });
 const d=document.getElementById('draw'); if(d)d.onclick=()=>{const pool=people.filter(x=>x.type==='Participant');winner=pool.length?pool[Math.floor(Math.random()*pool.length)].name:'No participants';render()};
 const c=document.getElementById('csv'); if(c)c.onclick=exportCsv;
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
   if(pnme){pn++;a.push({id:passId('Participant',pn,pid>=0?r[pid]:''),name:pnme,type:'Participant',attendance:false,attendanceAt:'',snack:false,snackAt:'',lunch:false,lunchAt:'',raffle:false,raffleAt:''})}
   if(cnme){cn++;a.push({id:passId('Companion',cn,cid>=0?r[cid]:''),name:cnme,type:'Companion',attendance:false,attendanceAt:'',snack:false,snackAt:'',lunch:false,lunchAt:'',raffle:null,raffleAt:''})}
  });
  if(!a.length)return alert('No participant names found below the header.');
  people=a;selected=null;save();localStorage.removeItem(S);alert(a.length+' people imported and saved offline.');render()
 }catch(e){alert('Could not read this Excel file.')}
}

function exportCsv(){
 const rows=[['Pass ID','Name','Type','Attendance','Check-in Time','Snack','Snack Time','Lunch','Lunch Time','Raffle','Raffle Time'],...people.map(p=>[p.id,p.name,p.type,p.attendance?'Checked in':'Not checked in',p.attendanceAt?formatTime(p.attendanceAt):'',p.snack?'Claimed':'Not claimed',p.snackAt?formatTime(p.snackAt):'',p.lunch?'Claimed':'Not claimed',p.lunchAt?formatTime(p.lunchAt):'',p.raffle===null?'Not eligible':p.raffle?'Claimed':'Not claimed',p.raffleAt?formatTime(p.raffleAt):''])];
 const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='PDW_2027_Attendees_Claims.csv';a.click();URL.revokeObjectURL(a.href)
}

async function backupEventData(){
 try{
  const docs=await listDocs();
  const packedDocs=[];
  for(const d of docs){
   packedDocs.push({key:d.key,name:d.value.name,type:d.value.type,size:d.value.size,updated:d.value.updated,data:await blobToDataURL(d.value.blob)});
  }
  const payload={version:1,event:'PDWPH-GET-TOGETHER-2027',exportedAt:new Date().toISOString(),people,selected,documents:packedDocs};
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:'application/json'}));a.download='PDW_2027_OFFLINE_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }catch{alert('Could not create the backup file.')}
}
async function restoreEventData(file){
 try{
  const data=JSON.parse(await file.text());
  if(!Array.isArray(data.people))throw Error('Invalid backup');
  if(!confirm('Restore this backup and replace the current event data on this device?'))return;
  people=normalize(data.people);selected=(Number.isInteger(data.selected)&&people[data.selected])?data.selected:null;save();
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