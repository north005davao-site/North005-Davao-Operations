(()=>{
const NAME="THERMAL PAPER DAILY SUMMARY",BUCKET="thermal-images";
const MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fd=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return MO[m-1]+" "+d+", "+y};
const SHEET="From thermal sheet";
const T={date:null,ed:null,sub:false,busy:false};window.THERMAL=T;
const MU=()=>window.MUNI||{};
const n0=v=>Number.isFinite(+v)?+v:0;
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
function subscribe(){if(T.sub)return;T.sub=true;let t;const f=()=>{clearTimeout(t);t=setTimeout(()=>{if(!QUIETW()&&cur==NAME&&!T.ed&&!T.busy&&!document.querySelector("dialog[open]"))go(cur)},700)};
  let c=sb.channel("thermal");["thermal_days","thermal_lines","thermal_restocks"].forEach(x=>c=c.on("postgres_changes",{event:"*",schema:"public",table:x},f));c.subscribe();
  document.addEventListener("paste",e=>{if(cur!=NAME||T.ed||document.querySelector("dialog[open]"))return;const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type));if(f){e.preventDefault();startFromImage($("#view"),f)}})}
const normBooth=s=>{s=String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");const m=s.match(/(\d{1,5})$/);return m?"DDN-"+m[1]:String(s||"").trim()};

// ---- parsing (used by both the quick-list box and OCR) ----
function parseLines(text){const out=[],re=/(?:DDN|DON|D0N|ODN)?[\s:._]*?(\d{2,4})\s*[-–—_~=:]\s*(\d{1,3})(?!\d)/gi;let m;while((m=re.exec(text))){out.push({booth:"DDN-"+m[1],rolls:+m[2]})}return out}
function parseHeader(text){const h={},mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  let m=text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\s*,?\s*(20\d\d)/i);if(m)h.date=`${m[3]}-${String(mo[m[1].toLowerCase()]).padStart(2,"0")}-${String(+m[2]).padStart(2,"0")}`;
  m=text.match(/stock[s]?\s*on\s*hand\D{0,6}(\d{2,4})/i);if(m)h.opening=+m[1];
  m=text.match(/(\d{2,4})\s*rolls?\s*alloc/i);if(m)h.written=+m[1];
  m=text.match(/(\d{1,4})\s*rolls?\s*\+\s*(\d{1,4})\s*rolls?\s*=\s*(\d{1,4})/i);if(m){h.opening=+m[1];h.restock=+m[2];h.onhand=+m[3]}
  m=text.match(/(\d{2,4})\s*rolls?\s*on\s*hand/i);if(m)h.onhand=+m[1];m=text.match(/(\d{1,4})\s*rolls?\s*remain/i);if(m)h.remaining=+m[1];return h}
window.THERMAL_PARSE={parseLines,parseHeader,normBooth};

async function thermal(v){subscribe();if(T.ed)return editor(v);
  LOAD(v);
  const[S,R,O]=await Promise.all([sb.from("thermal_summary").select("*").order("report_date",{ascending:false}).range(0,999),all("thermal_restocks"),all("registry_outlets","booth_code,municipality,sr_name")]);
  const days=S.data||[],reg=new Map(O.map(o=>[o.booth_code,o]));if(!T.date||!days.some(d=>d.report_date==T.date))T.date=days[0]?.report_date||null;
  const rs=d=>R.filter(r=>r.restock_date==d).reduce((s,r)=>s+r.rolls,0),remain=d=>d.opening_stock+rs(d.report_date)-d.allocated,day=days.find(d=>d.report_date==T.date);
  let lines=[];if(day){const r=await sb.from("thermal_lines").select("*").eq("report_date",T.date).range(0,999);lines=r.data||[]}
  const cnt={};lines.forEach(l=>cnt[l.booth_code]=(cnt[l.booth_code]||0)+1);
  v.innerHTML=`<div class="tbar">${days.length?`<select id="td" style="max-width:190px">${days.map(d=>`<option value="${d.report_date}"${d.report_date==T.date?" selected":""}>${fd(d.report_date)}</option>`).join("")}</select>`:""}<button class="ghost" id="tn">+ Manual Entry</button><button class="ghost" id="tr">+ Restock</button>${day?'<button class="ghost" id="te">Edit this day</button><button class="ghost" id="tx">Delete day</button>':""}</div>
  <div class="drop" id="tz" tabindex="0" style="margin:0 0 14px"><b>Drop the thermal report photo here</b><br><span class="chip">or click to choose · or press Ctrl+V to paste a photo</span><input type="file" id="tf" hidden accept="image/*"></div>
  ${day?`<div class="kpis" style="margin-bottom:12px"><div class="kpi"><small>Opening stock</small><b>${day.opening_stock}</b></div><div class="kpi"><small>Restocked that day</small><b>${rs(day.report_date)}</b></div><div class="kpi"><small>Rolls given</small><b>${day.allocated}</b><small>${day.booths} lines</small></div><div class="kpi"><small>Remaining balance</small><b>${remain(day)}</b><small>on hand ${day.opening_stock+rs(day.report_date)}</small></div></div>
  ${day.written_allocated!=null&&day.written_allocated!=day.allocated?`<div class="warn2">⚠ The sheet says <b>${day.written_allocated}</b> rolls allocated, but the lines add up to <b>${day.allocated}</b> (difference ${day.allocated-day.written_allocated}). Use “Edit this day” to check them.</div>`:""}
  ${day.image_path?'<div style="margin-bottom:10px"><button class="ghost" id="tv">View sheet photo</button></div>':""}<div id="tl"></div>`:`<div class="empty"><b>THERMAL PAPER DAILY SUMMARY</b><br>No daily summaries yet. Drop a photo above, or use “+ Manual Entry”.</div>`}
  <h4 class="h">Stock history</h4><div id="th"></div><h4 class="h">Restocks</h4><div id="trs"></div>`;
  if($("#td"))$("#td").onchange=e=>{T.date=e.target.value;PAGER.reset("th_l");go(cur)};
  const z=$("#tz"),inp=$("#tf");z.onclick=e=>{if(e.target!==inp)inp.click()};inp.onclick=e=>e.stopPropagation();inp.onchange=()=>{if(inp.files[0])startFromImage(v,inp.files[0])};
  z.ondragover=e=>{e.preventDefault();z.classList.add("over")};z.ondragleave=()=>z.classList.remove("over");z.ondrop=e=>{e.preventDefault();z.classList.remove("over");const f=[...e.dataTransfer.files].find(x=>/^image\//.test(x.type));if(f)startFromImage(v,f)};
  const prevInfo=d=>defaults(days,R,d);
  $("#tn").onclick=()=>{const d=iso(new Date()),p=prevInfo(d);T.ed={date:d,opening:p.opening,written:"",note:"",lines:[],image:null,prev:p};thermal(v)};
  $("#tr").onclick=()=>restockDlg(()=>thermal(v));
  if(day){$("#te").onclick=()=>{T.ed={date:day.report_date,opening:day.opening_stock,restock:(R.find(r=>r.restock_date==day.report_date&&r.note===SHEET)||{}).rolls??"",written:day.written_allocated??"",note:day.note||"",lines:lines.map(l=>({booth:l.booth_code,rolls:l.rolls})),image:day.image_path?{path:day.image_path}:null,prev:prevInfo(day.report_date),existing:true};thermal(v)};
    $("#tx").onclick=async()=>{if(!confirm("Delete the thermal summary for "+fd(day.report_date)+"?"))return;if(day.image_path)await sb.storage.from(BUCKET).remove([day.image_path]);const{error}=await sb.from("thermal_days").delete().eq("report_date",day.report_date);if(error)return alert("Could not delete.");T.date=null;thermal(v)};
    if($("#tv"))$("#tv").onclick=async()=>{const{data,error}=await sb.storage.from(BUCKET).createSignedUrl(day.image_path,300);if(error)return alert("Could not open the photo.");window.open(data.signedUrl,"_blank")};
    const draw=()=>{const pg=PAGER.paginate("th_l",lines.slice().sort((a,b)=>(parseInt(a.booth_code.replace(/\D/g,""))||0)-(parseInt(b.booth_code.replace(/\D/g,""))||0)));
      $("#tl").innerHTML=lines.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Municipality</th><th>Rolls</th><th>Check</th></tr></thead><tbody>${pg.slice.map(l=>{const o=reg.get(l.booth_code),f=[];if(!o)f.push('<span class="pill" style="background:#f59e0b">not in registry</span>');if(cnt[l.booth_code]>1)f.push('<span class="pill" style="background:#ef4444">duplicate</span>');
        return`<tr><td><b>${esc(l.booth_code)}</b></td><td>${esc(o?.sr_name||"")}</td><td>${o&&MU()[o.municipality]?`<span class="pill" style="background:${MU()[o.municipality][1]}">${MU()[o.municipality][0]}</span>`:""}</td><td><b>${l.rolls}</b></td><td>${f.join(" ")}</td></tr>`}).join("")}</tbody></table></div>`+pg.bar:'<div class="empty">No lines on this day.</div>';PAGER.bind($("#tl"),pg.st,draw)};draw()}
  const hist=()=>{const pg=PAGER.paginate("th_h",days);$("#th").innerHTML=days.length?`<div class="tw"><table><thead><tr><th>Date</th><th>Opening</th><th>Restocked</th><th>Given</th><th>Remaining</th><th>Lines</th></tr></thead><tbody>${pg.slice.map(d=>`<tr data-d="${d.report_date}" style="cursor:pointer"><td>${fd(d.report_date)}</td><td>${d.opening_stock}</td><td>${rs(d.report_date)}</td><td>${d.allocated}</td><td><b>${remain(d)}</b></td><td>${d.booths}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="chip">Nothing yet.</div>';
    $("#th").querySelectorAll("tr[data-d]").forEach(t=>t.onclick=()=>{T.date=t.dataset.d;PAGER.reset("th_l");go(cur)});PAGER.bind($("#th"),pg.st,hist)};hist();
  const rsd=()=>{const f=R.slice().sort((a,b)=>b.restock_date.localeCompare(a.restock_date)),pg=PAGER.paginate("th_r",f);$("#trs").innerHTML=f.length?`<div class="tw"><table><thead><tr><th>Date</th><th>Rolls</th><th>Note</th><th></th></tr></thead><tbody>${pg.slice.map(r=>`<tr><td>${fd(r.restock_date)}</td><td><b>+${r.rolls}</b></td><td>${esc(r.note||"")}</td><td><button class="ghost" data-r="${r.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="chip">No restocks recorded.</div>';
    $("#trs").querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this restock?"))return;const{error}=await sb.from("thermal_restocks").delete().eq("id",b.dataset.r);if(error)return alert("Could not delete.");thermal(v)});PAGER.bind($("#trs"),pg.st,rsd)};rsd()}

function defaults(days,R,d){const prev=days.filter(x=>x.report_date<d).sort((a,b)=>b.report_date.localeCompare(a.report_date))[0];if(!prev)return{opening:0,from:null};
  const rs=x=>R.filter(r=>r.restock_date==x).reduce((s,r)=>s+r.rolls,0),between=R.filter(r=>r.restock_date>prev.report_date&&r.restock_date<d).reduce((s,r)=>s+r.rolls,0);
  return{opening:Math.max(0,prev.opening_stock+rs(prev.report_date)-prev.allocated+between),from:prev.report_date}}

function restockDlg(done){const d=document.createElement("dialog");d.innerHTML=`<h4 style="margin:0 0 6px">Restock thermal paper</h4><div class="g2"><div><label>Date received</label><input type="date" id="rd" value="${iso(new Date())}"></div><div><label>Rolls received</label><input type="number" id="rr" min="1" step="1" inputmode="numeric"></div></div><label>Note (optional)</label><input id="rn"><div class="msg" id="rm"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="rs">Save</button><button class="ghost" id="rx">Cancel</button></div>`;document.body.appendChild(d);d.showModal();
  const close=()=>{d.close();d.remove()};d.querySelector("#rx").onclick=close;
  d.querySelector("#rs").onclick=async()=>{const n=parseInt(d.querySelector("#rr").value),dt=d.querySelector("#rd").value,m=d.querySelector("#rm");if(!(n>0)||!dt)return m.textContent="Enter the date and number of rolls.";
    const{error}=await sb.from("thermal_restocks").insert({restock_date:dt,rolls:n,note:d.querySelector("#rn").value.trim()||null,created_by:me.id});if(error)return m.textContent="Could not save.";close();done()}}

// ---------------- editor ----------------
async function startFromImage(v,file){const days=(await sb.from("thermal_summary").select("*").range(0,999)).data||[],R=await all("thermal_restocks"),d=iso(new Date()),p=defaults(days,R,d);
  T.ed={date:d,opening:p.opening,written:"",note:"",lines:[],image:{file,url:URL.createObjectURL(file)},prev:p,days,R};thermal(v)}

async function loadScript(src){return new Promise((res,rej)=>{if(window.Tesseract)return res();const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
async function toCanvas(file,maxW){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=file.url||URL.createObjectURL(file.file||file)});
  const sc=Math.min(1,maxW/img.width),c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);return c}
function enhance(c){const x=c.getContext("2d"),im=x.getImageData(0,0,c.width,c.height),d=im.data;let lo=255,hi=0;for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];d[i]=d[i+1]=d[i+2]=g;if(g<lo)lo=g;if(g>hi)hi=g}
  const k=255/Math.max(1,hi-lo);for(let i=0;i<d.length;i+=4){const g=Math.max(0,Math.min(255,(d[i]-lo)*k));d[i]=d[i+1]=d[i+2]=g}x.putImageData(im,0,0);return c}


// ---- two-column reading (idea: read each column on its own so lines never mix across the page) ----
const cut=(c,x,y,w,h)=>{const k=document.createElement("canvas");k.width=Math.max(1,Math.floor(w));k.height=Math.max(1,Math.floor(h));k.getContext("2d").drawImage(c,x,y,w,h,0,0,k.width,k.height);return k};
function splitSheet(c){const W=c.width,H=c.height;return{header:cut(c,0,0,W,H*.14),left:cut(c,0,H*.05,W*.52,H*.93),right:cut(c,W*.46,H*.05,W*.54,H*.93)}}
function parseColumn(text,col){const out=[];
  for(const raw of String(text||"").split("\n")){const line=raw.trim().replace(/^[^\w]+/,"");if(!line)continue;const u=line.toUpperCase();
    if(/STOCK|REPORT|REMAIN|ALLOC|BALANCE|ROLLS|^DATE|^SEP|^OCT|^NOV|^DEC/.test(u))continue;
    let m=line.match(/\bD[DO0]N[\s\-_]*(\d{3,4})\b/i),code=null,rest="";
    if(m){code=m[1];rest=line.slice(line.indexOf(m[0])+m[0].length)}else{m=line.match(/\b(\d{3,4})\b/);if(m){code=m[1];rest=line.slice(line.indexOf(m[0])+m[0].length)}}
    if(!code)continue;const r=rest.match(/[\-–—~:_=.\s]+(\d{1,3})\b/);let rolls=r?+r[1]:null,a=false;if(rolls==null||rolls<=0||rolls>500){rolls=5;a=true}
    out.push({booth:"DDN-"+code,rolls,u:a,a,c:col})}
  return out}
const prep=(c,thr)=>{const k=cut(c,0,0,c.width,c.height);enhance(k);if(thr){const x=k.getContext("2d"),im=x.getImageData(0,0,k.width,k.height),d=im.data;for(let i=0;i<d.length;i+=4){const g=d[i]>=thr?255:0;d[i]=d[i+1]=d[i+2]=g}x.putImageData(im,0,0)}return k};
const toB64=(c,maxW=1600)=>new Promise(res=>{const s=Math.min(1,maxW/c.width),k=cut(c,0,0,c.width,c.height);let o=k;if(s<1){o=document.createElement("canvas");o.width=Math.round(c.width*s);o.height=Math.round(c.height*s);o.getContext("2d").drawImage(c,0,0,o.width,o.height)}o.toBlob(b=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(",")[1]);fr.readAsDataURL(b)},"image/jpeg",.85)});
window.THERMAL_PARSE.parseColumn=parseColumn;

async function editor(v){
  const E=T.ed,adm=true;let urlP=null;
  if(E.image&&E.image.path&&!E.image.url){const{data}=await sb.storage.from(BUCKET).createSignedUrl(E.image.path,600);E.image.url=data?.signedUrl}
  const O=await all("registry_outlets","booth_code,municipality,sr_name"),reg=new Map(O.map(o=>[o.booth_code,o]));
  const Rr=E.R||await all("thermal_restocks"),restock=()=>Rr.filter(r=>r.restock_date==E.date).reduce((s,r)=>s+r.rolls,0);
  v.innerHTML=`<div class="tbar"><button class="ghost" id="ec">← Cancel</button><b style="font-size:16px">${E.existing?"Edit":"New"} thermal summary</b></div>
  <div class="dgrid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));margin-top:0">
  ${E.image&&E.image.url?`<div class="dc"><h4>Sheet photo <span class="chip">compare while you type</span></h4><div style="max-height:70vh;overflow:auto;border-radius:10px;border:1px solid var(--line)"><img id="eimg" src="${E.image.url}" alt="Thermal report" style="width:100%;display:block"></div>${E.image.file?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" id="ei" style="width:auto;padding:9px 16px;margin:0">✨ Read handwriting with AI</button><button class="ghost" id="eo">Free OCR (printed text only)</button></div><div class="chip" id="eop" style="margin-top:8px"></div><div class="chip" style="margin-top:6px">Rows marked “check digits” are ones the AI was unsure about. Always compare with the photo, then edit anything that is wrong.</div>`:""}</div>`:""}
  <div class="dc"><h4>Details</h4><div class="g2"><div><label>Date</label><input type="date" id="ed" value="${E.date}"></div><div><label>Opening stock (rolls)</label><input type="number" id="eop2" min="0" step="1" value="${E.opening}"></div><div><label>New rolls received today (restock)</label><input type="number" id="ers" min="0" step="1" value="${E.restock??""}" placeholder="0"></div><div><label>Total allocated written on sheet (optional)</label><input type="number" id="ew" min="0" step="1" value="${E.written}"></div><div><label>Note (optional)</label><input id="en" value="${esc(E.note)}"></div></div>
  <div class="chip" style="margin-top:6px">${E.prev&&E.prev.from?`Opening stock carried over from ${fd(E.prev.from)}'s remaining balance.`:"First day: type your stocks on hand as the opening stock."}</div>
  <label>Quick list — type or paste booth-rolls pairs (e.g. <i>764-5 1475-5 398-10</i> or one per line)</label><textarea id="eq" rows="3" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font:inherit" placeholder="764-5, 1475-5, 398-10 …"></textarea><button class="ghost" id="ea" style="margin-top:6px">Add these to the list</button></div></div>
  <div class="dc" style="margin-top:14px"><h4>Lines <span class="chip" id="esum"></span></h4><div class="tw" style="max-height:60vh;overflow:auto"><table><thead><tr><th>#</th><th>Booth code</th><th>Rolls</th><th>Teller</th><th>Check</th><th></th></tr></thead><tbody id="elb"></tbody></table></div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="ghost" id="er">+ Add row</button></div><div class="msg" id="em" style="color:#ff8b9b"></div><div style="display:flex;gap:8px;margin-top:6px"><button class="btn" id="es" style="width:auto;padding:10px 24px;margin:0">Save summary</button><button class="ghost" id="ec2">Cancel</button></div></div>`;
  const body=$("#elb"),cnt=()=>{const c={};E.lines.forEach(l=>{const b=normBooth(l.booth);if(b)c[b]=(c[b]||0)+1});return c};
  const flags=l=>{const b=normBooth(l.booth),f=[];if(!b)return"";if(l.a)f.push('<span class="pill" style="background:#eab308;color:#111">assumed 5 — check</span>');else if(l.u)f.push('<span class="pill" style="background:#eab308;color:#111">check digits</span>');if(!reg.has(b))f.push('<span class="pill" style="background:#f59e0b">not in registry</span>');if(cnt()[b]>1)f.push('<span class="pill" style="background:#ef4444">duplicate</span>');return f.join(" ")};
  const others=()=>Rr.filter(r=>r.restock_date==E.date&&r.note!==SHEET).reduce((s,r)=>s+r.rolls,0),restockNow=()=>others()+n0($("#ers")?$("#ers").value:E.restock);
  const sum=()=>{const tot=E.lines.reduce((s,l)=>s+n0(l.rolls),0),op=n0($("#eop2").value),w=$("#ew").value===""?null:n0($("#ew").value),oh=op+restockNow(),rem=oh-tot;
    $("#esum").innerHTML=`${E.lines.length} lines · <b>${tot}</b> rolls given · on hand <b>${oh}</b> · remaining <b${rem<0?' style="color:#ef4444"':""}>${rem}</b>${w!=null&&w!=tot?` · <span style="color:#f59e0b">⚠ sheet says ${w} (difference ${tot-w})</span>`:w!=null?' · <span style="color:#22c55e">✔ matches the sheet</span>':""}`;
    body.querySelectorAll("tr").forEach((tr,i)=>{const l=E.lines[i];tr.querySelector(".fl").innerHTML=flags(l);tr.querySelector(".tn").textContent=reg.get(normBooth(l.booth))?.sr_name||""})};
  const rows=(focus)=>{body.innerHTML=E.lines.map((l,i)=>`<tr${l.u?' style="background:rgba(234,179,8,.14)"':""}><td>${i+1}${l.c?` <span class="chip">${l.c}</span>`:""}</td><td><input class="bi" data-i="${i}" value="${esc(l.booth)}" style="min-width:110px"></td><td><input class="ri" data-i="${i}" type="number" min="0" step="1" inputmode="numeric" value="${l.rolls??""}" style="width:90px"></td><td class="tn" style="color:var(--mu)"></td><td class="fl"></td><td><button class="ghost" data-x="${i}">✕</button></td></tr>`).join("");
    body.querySelectorAll(".bi").forEach(e=>{e.oninput=()=>{E.lines[+e.dataset.i].booth=e.value;E.lines[+e.dataset.i].u=false;E.lines[+e.dataset.i].a=false;sum()};e.onblur=()=>{const n=normBooth(e.value);if(n&&n!=e.value){e.value=n;E.lines[+e.dataset.i].booth=n;sum()}};e.onkeydown=k=>{if(k.key=="Enter"){k.preventDefault();body.querySelector(`.ri[data-i="${e.dataset.i}"]`).focus()}}});
    body.querySelectorAll(".ri").forEach(e=>{e.oninput=()=>{E.lines[+e.dataset.i].rolls=e.value;E.lines[+e.dataset.i].u=false;E.lines[+e.dataset.i].a=false;sum()};e.onkeydown=k=>{if(k.key=="Enter"){k.preventDefault();const i=+e.dataset.i;if(i==E.lines.length-1){E.lines.push({booth:"",rolls:""});rows(i+1)}else body.querySelector(`.bi[data-i="${i+1}"]`).focus()}}});
    body.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{E.lines.splice(+b.dataset.x,1);rows()});sum();if(focus!=null){const f=body.querySelector(`.bi[data-i="${focus}"]`);f&&f.focus()}};
  rows();
  ["ed","eop2","ers","ew","en"].forEach(id=>$("#"+id).oninput=()=>{E.date=$("#ed").value;E.opening=$("#eop2").value;E.restock=$("#ers").value;E.written=$("#ew").value;E.note=$("#en").value;sum()});
  $("#ed").onchange=async()=>{E.date=$("#ed").value;if(!E.existing){const days=E.days||(await sb.from("thermal_summary").select("*").range(0,999)).data||[];E.days=days;const p=defaults(days,Rr,E.date);E.prev=p;E.opening=p.opening;editor(v)}else sum()};
  $("#er").onclick=()=>{E.lines.push({booth:"",rolls:""});rows(E.lines.length-1)};
  $("#ea").onclick=()=>{const p=parseLines($("#eq").value);if(!p.length){$("#em").textContent="I couldn't find any booth-rolls pairs like 764-5 in that text.";return}$("#em").textContent="";p.forEach(x=>E.lines.push({booth:x.booth,rolls:x.rolls}));$("#eq").value="";rows()};
  const cancel=()=>{if(E.image&&E.image.url&&E.image.file)URL.revokeObjectURL(E.image.url);T.ed=null;go(cur)};$("#ec").onclick=cancel;$("#ec2").onclick=cancel;
  const verdict=(n,tot,w,x)=>{let s=w==null?"":(w==tot?" ✔ The lines add up to the total written on the sheet ("+w+").":" ⚠ The lines add up to "+tot+" but the sheet says "+w+" (difference "+(tot-w)+") — check the highlighted rows against the photo.");
    if(x){const oh=n0($("#eop2").value)+n0($("#ers").value);if(x.onhand!=null&&x.onhand!=oh)s+=" ⚠ The sheet says "+x.onhand+" rolls on hand, but opening stock + received = "+oh+".";if(x.remaining!=null){const rem=oh-tot;s+=x.remaining==rem?" ✔ Remaining balance matches ("+rem+").":" ⚠ The sheet says remaining "+x.remaining+", but the numbers give "+rem+"."}}return s};
  if($("#ei"))$("#ei").onclick=async()=>{const b=$("#ei"),pr=$("#eop");b.disabled=true;pr.style.color="var(--gold)";pr.textContent="Preparing the photo…";
    try{const full=await toCanvas(E.image,2400),S=splitSheet(full),images=[{label:"HEADER",data:await toB64(S.header),media_type:"image/jpeg"},{label:"LEFT COLUMN",data:await toB64(S.left),media_type:"image/jpeg"},{label:"RIGHT COLUMN",data:await toB64(S.right),media_type:"image/jpeg"}];
      pr.textContent="Reading the handwriting column by column… this can take up to a minute.";const r=await sb.functions.invoke("read-thermal",{body:{images}});
      const x=r.data;if(r.error&&!x)throw new Error("invoke");
      if(x&&x.error){const m={NO_KEY:"AI reading is not set up yet. Add your Anthropic API key in Supabase (Edge Functions → Secrets → ANTHROPIC_API_KEY), then try again.",AI_ERROR:"The AI service returned an error (code "+(x.status||"?")+"). "+(x.status==401?"Check the API key.":x.status==400||x.status==404?"Check the model name or credits.":""),PARSE:"The AI answered in an unexpected format. Please try again.",BAD_IMAGE:"That photo could not be used. Try a clearer or smaller photo.",FORBIDDEN:"Only the Administrator can use this.",UNAUTHORIZED:"Please log in again."}[x.error]||"The reader could not finish. Please try again.";pr.style.color="#ff8b9b";pr.textContent=m;b.disabled=false;return}
      if(x.date&&!E.existing){E.date=x.date;$("#ed").value=x.date}if(x.allocated_total!=null){E.written=x.allocated_total;$("#ew").value=x.allocated_total}
      if(x.stocks_on_hand!=null&&!(E.prev&&E.prev.from)&&!(+E.opening>0)){E.opening=x.stocks_on_hand;$("#eop2").value=x.stocks_on_hand}
      if(x.restock!=null){E.restock=x.restock;$("#ers").value=x.restock}
      const add=(x.lines||[]).map(l=>({booth:"DDN-"+l.booth,rolls:l.rolls,u:!!l.uncertain||!!l.assumed,a:!!l.assumed,c:l.col||""}));if(E.lines.length&&add.length&&!confirm("Replace the "+E.lines.length+" lines already in the list with the "+add.length+" lines the AI read?"))E.lines.push(...add);else if(add.length)E.lines=add;
      rows();const un=add.filter(l=>l.u).length,tot=E.lines.reduce((s,l)=>s+n0(l.rolls),0);pr.style.color="var(--gold)";
      pr.textContent=add.length?"The AI read "+add.length+" lines"+(un?" ("+un+" flagged to check)":"")+(x.stocks_on_hand!=null?". Sheet: "+x.stocks_on_hand+" on hand"+(x.restock!=null?" + "+x.restock+" received":""):"")+"."+verdict(add.length,tot,x.allocated_total,{onhand:x.on_hand_total,remaining:x.remaining}):"The AI could not find booth lines in this photo."}
    catch(e){pr.style.color="#ff8b9b";pr.textContent="The reader could not be reached. Please try again or type the numbers."}b.disabled=false};
  if($("#eo"))$("#eo").onclick=async()=>{const b=$("#eo"),pr=$("#eop");b.disabled=true;pr.style.color="var(--gold)";
    try{pr.textContent="Loading the reader (first time takes a moment)…";await loadScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
      const full=await toCanvas(E.image,2400),S=splitSheet(full),run=async(cv,name)=>(await Tesseract.recognize(cv,"eng",{tessedit_pageseg_mode:"6",logger:m=>{if(m.status=="recognizing text")pr.textContent=name+"… "+Math.round(m.progress*100)+"%"}})).data.text||"";
      const pass=async thr=>{const H=await run(prep(S.header,thr),"Reading the header"),L=await run(prep(S.left,thr),"Reading the left column"),R=await run(prep(S.right,thr),"Reading the right column");return{H,L,R,left:parseColumn(L,"L"),right:parseColumn(R,"R")}};
      let best=await pass(0);if(best.left.length+best.right.length<8){pr.textContent="Trying a second pass with stronger contrast…";const b2=await pass(135);if(b2.left.length+b2.right.length>best.left.length+best.right.length)best=b2}
      const all=best.H+" "+best.L+" "+best.R,h=parseHeader(all);if(h.date&&!E.existing){E.date=h.date;$("#ed").value=h.date}if(h.opening!=null&&!(+E.opening>0)){E.opening=h.opening;$("#eop2").value=h.opening}if(h.restock!=null){E.restock=h.restock;$("#ers").value=h.restock}if(h.written!=null){E.written=h.written;$("#ew").value=h.written}
      const add=[...best.left,...best.right];
      if(add.length){E.lines.push(...add);rows();const tot=E.lines.reduce((s,l)=>s+n0(l.rolls),0);pr.textContent="Found "+add.length+" lines ("+best.left.length+" left, "+best.right.length+" right). Please check every one against the photo."+verdict(add.length,tot,h.written!=null?h.written:null,{onhand:h.onhand,remaining:h.remaining})}
      else pr.textContent="Couldn't read booth numbers from this photo (free OCR can't read handwriting). Use “Read handwriting with AI” or type them in the quick list box.";sum()}
    catch(e){pr.style.color="#ff8b9b";pr.textContent="The reader could not run. Please type the numbers using the quick list box."}b.disabled=false};
  $("#es").onclick=async()=>{const m=$("#em");m.textContent="";if(!E.date)return m.textContent="Choose the date.";const clean=E.lines.map(l=>({booth_code:normBooth(l.booth),rolls:l.rolls})).filter(l=>l.booth_code||String(l.rolls)!=="");
    for(const l of clean){if(!l.booth_code)return m.textContent="A row is missing its booth code.";if(!(Number.isInteger(+l.rolls)&&+l.rolls>=0&&String(l.rolls)!==""))return m.textContent="Check the rolls for "+l.booth_code+" (whole number).";l.rolls=+l.rolls}
    if(E.opening===""||!(+E.opening>=0))return m.textContent="Enter the opening stock.";const b=$("#es");b.disabled=true;T.busy=true;
    try{let path=E.image&&E.image.path?E.image.path:null;
      if(E.image&&E.image.file){m.style.color="var(--gold)";m.textContent="Uploading photo…";const c=await toCanvas(E.image,2000),blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));path=`${E.date}/${Date.now()}.jpg`;const up=await sb.storage.from(BUCKET).upload(path,blob,{contentType:"image/jpeg"});if(up.error)throw up.error}
      const r=await sb.rpc("save_thermal_day",{p_date:E.date,p_opening:+E.opening,p_written:E.written===""?null:+E.written,p_image:path,p_note:E.note.trim()||null,p_lines:clean});if(r.error)throw r.error;
      const rs0=n0(E.restock),sheetRow=Rr.find(r=>r.restock_date==E.date&&r.note===SHEET);
      if(rs0>0){const q=sheetRow?sb.from("thermal_restocks").update({rolls:rs0}).eq("id",sheetRow.id):sb.from("thermal_restocks").insert({restock_date:E.date,rolls:rs0,note:SHEET,created_by:me.id});const rr=await q;if(rr.error)throw rr.error}
      else if(sheetRow){const rr=await sb.from("thermal_restocks").delete().eq("id",sheetRow.id);if(rr.error)throw rr.error}
      T.date=E.date;T.ed=null;T.busy=false;go(cur)}catch(e){T.busy=false;b.disabled=false;m.style.color="#ff8b9b";m.textContent="Could not save. Please try again."}}}

window.MODS=Object.assign(window.MODS||{},{[NAME]:thermal});
})();
