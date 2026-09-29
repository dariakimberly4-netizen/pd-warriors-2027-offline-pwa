(()=> {
const K='pdw-people-v4', S='pdw-selected-v4';
const defaultPeople=[
 {id:'P-0001',name:'Maria Santos',type:'Participant',snack:false,lunch:false,raffle:false},
 {id:'C-0001',name:'Jose Santos',type:'Companion',snack:false,lunch:false,raffle:null}
];
const normalize=a=>a.map((p,i)=>({...p,id:p.id||((p.type==='Companion'?'C':'P')+'-'+String(i+1).padStart(4,'0')),snack:!!p.snack,lunch:!!p.lunch,raffle:p.type==='Companion'?null:!!p.raffle}));
let people=normalize(JSON.parse(localStorage.getItem(K)||localStorage.getItem('pdw-people-v3')||localStorage.getItem('pdw-people')||'null')||defaultPeople);
let selected=Number(localStorage.getItem(S)); if(!Number.isInteger(selected)||!people[selected]) selected=null;
let screen='home', query='', winner='', scannerStream=null;
const save=()=>localStorage.setItem(K,JSON.stringify(people)); save();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const app=document.getElementById('app');
const DOC_DB='pdw-documents-v1', DOC_STORE='documents';
function openDocDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DOC_DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(DOC_STORE))db.createObjectStore(DOC_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function putDoc(key,file){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readwrite');tx.objectStore(DOC_STORE).put({name:file.name,type:file.type,size:file.size,updated:Date.now(),blob:file},key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function getDoc(key){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readonly');const r=tx.objectStore(DOC_STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
async function deleteDoc(key){const db=await openDocDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DOC_STORE,'readwrite');tx.objectStore(DOC_STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
const docKey=(person,slot)=>person.id+'::'+slot;
const modules=[
 ['register','1','Register','Step 1 • Upload Excel or register manually offline'],
 ['database','DB','Attendee Database','Search imported names by first or last name'],
 ['documents','2','Documents','Step 2 • Collect PWD / Senior ID / authorization'],
 ['pass','3','Digital Passes','Step 3 • Generate individual QR codes'],
 ['scanner','4','QR Scanner','Step 4 • Scan participant or companion QR'],
 ['claims','5','Claims','Step 5 • Tap Snack, Lunch or Raffle to mark CLAIMED'],
 ['raffle','DRAW','Raffle Draw','Draw a winner from eligible participants only'],
 ['export','DOC','Export Documents','Export document and claim status offline']
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
 <section class="moduleList">
   ${modules.map(([id,badge,title,desc])=>`
    <button class="moduleCard" data-screen="${id}">
      <span class="badge">${badge}</span>
      <span class="moduleCopy"><strong>${title}</strong><small>${desc}</small></span>
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
 <section class="panel"><div class="passCompact">${passSummary(p)}</div>${claimButtons(p)}</section>`:`
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
   <p class="lead">Export attendee and claim status stored on this device.</p>
   <button id="csv" class="primary full">DOWNLOAD CSV</button>
   <p class="note">The CSV does not contain actual PWD ID, Senior Citizen ID, or authorization-letter image files.</p>
 </section>`;
 return '';
}

function render(){
 app.innerHTML=shell(body());
 app.querySelectorAll('[data-screen]').forEach(b=>b.onclick=()=>setScreen(b.dataset.screen));
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
   if(nm)nm.textContent=rec?rec.name:'No file saved';
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
function claimButtons(p){
 const ks=['snack','lunch',...(p.raffle===null?[]:['raffle'])];
 return `<div class="claims">${ks.map(k=>`
  <button class="claim ${p[k]?'claimed':''}" data-k="${k}" ${p[k]?'disabled':''}>
   <span>${k.toUpperCase()}</span><small>${p[k]?'✓ CLAIMED':'TAP TO CLAIM'}</small>
  </button>`).join('')}</div>`;
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
 if(screen==='documents'&&selected!==null)setTimeout(refreshDocStatuses,0);
 const add=document.getElementById('addwalk'); if(add)add.onclick=()=>{
  const n=document.getElementById('walkname').value.trim(),t=document.getElementById('walktype').value;
  if(!n)return alert('Enter a name.');
  const count=people.filter(x=>x.type===t).length+1;
  people.push({id:passId(t,count),name:n,type:t,snack:false,lunch:false,raffle:t==='Companion'?null:false});
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
 document.querySelectorAll('.claim').forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(selected==null)return;people[selected][k]=true;save();render()});
 const d=document.getElementById('draw'); if(d)d.onclick=()=>{const pool=people.filter(x=>x.type==='Participant');winner=pool.length?pool[Math.floor(Math.random()*pool.length)].name:'No participants';render()};
 const c=document.getElementById('csv'); if(c)c.onclick=exportCsv;
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
   if(pnme){pn++;a.push({id:passId('Participant',pn,pid>=0?r[pid]:''),name:pnme,type:'Participant',snack:false,lunch:false,raffle:false})}
   if(cnme){cn++;a.push({id:passId('Companion',cn,cid>=0?r[cid]:''),name:cnme,type:'Companion',snack:false,lunch:false,raffle:null})}
  });
  if(!a.length)return alert('No participant names found below the header.');
  people=a;selected=null;save();localStorage.removeItem(S);alert(a.length+' people imported and saved offline.');render()
 }catch(e){alert('Could not read this Excel file.')}
}

function exportCsv(){
 const rows=[['Pass ID','Name','Type','Snack','Lunch','Raffle'],...people.map(p=>[p.id,p.name,p.type,p.snack?'Claimed':'Not claimed',p.lunch?'Claimed':'Not claimed',p.raffle===null?'Not eligible':p.raffle?'Claimed':'Not claimed'])];
 const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='PDW_2027_Attendees_Claims.csv';a.click();URL.revokeObjectURL(a.href)
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