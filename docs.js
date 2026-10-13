(()=>{
const NAME="EMPLOYEE DOCUMENTS",BUCKET="employee-docs",MAX=10*1024*1024;
const ROLES={admin:"Operations Administrator",supervisor:"Field Sales Supervisor",collector:"Field Sales Collector",rep:"Sales Representative",reliever:"Reliever"};
const SLOTS=[["resume","Resume / Biodata","Resume or biodata of the employee."],["valid_id","Photocopy of a Valid ID","Front and back may be uploaded as separate files."],["clearance","Barangay / Police / NBI Clearance","Choose which clearance it is, then upload."],["cbta","Commission Based Teller Agreement (CBTA)","Signed agreement."]];
const OK=["application/pdf","image/jpeg","image/png","image/webp","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const KIND={barangay:"Barangay",police:"Police",nbi:"NBI"};
const Dc={id:null,q:"",role:"",inc:false,active:null,sub:false,kind:"barangay"};window.DOCS=Dc;
const fd=s=>new Date(s).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
const sz=b=>b>=1048576?(b/1048576).toFixed(1)+" MB":Math.max(1,Math.round(b/1024))+" KB";
const safe=n=>n.replace(/[^\w.\-]+/g,"_").slice(-80);
function subscribe(){if(Dc.sub)return;Dc.sub=true;let t;sb.channel("docs").on("postgres_changes",{event:"*",schema:"public",table:"employee_docs"},()=>{clearTimeout(t);t=setTimeout(()=>{if(cur==NAME&&!document.querySelector("dialog[open]")&&!Dc.busy)go(cur)},600)}).subscribe();
  document.addEventListener("paste",onPaste)}
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}

async function docs(v){subscribe();return Dc.id?detail(v):list(v)}

async function list(v){
  v.innerHTML='<div class="empty">Loading…</div>';
  const[P,D]=await Promise.all([all("profiles","id,full_name,username,role,status"),all("employee_docs","id,profile_id,doc_type")]);
  const by=new Map();D.forEach(d=>{if(!by.has(d.profile_id))by.set(d.profile_id,new Set());by.get(d.profile_id).add(d.doc_type)});
  const staff=P.filter(p=>p.role&&p.role!="admin"&&p.status!="disabled").map(p=>({...p,has:by.get(p.id)||new Set()})).sort((a,b)=>(a.full_name||"").localeCompare(b.full_name||""));
  const complete=staff.filter(s=>s.has.size==4).length;
  v.innerHTML=`<div class="kpis" style="margin-bottom:14px"><div class="kpi"><small>Employees</small><b>${staff.length}</b></div><div class="kpi"><small>Complete (4 of 4)</small><b>${complete}</b></div><div class="kpi"><small>Incomplete</small><b>${staff.length-complete}</b></div></div>
  <div class="tbar"><input id="dq" placeholder="Search name or username…" value="${esc(Dc.q)}"><select id="dr"><option value="">All roles</option>${Object.entries(ROLES).filter(([k])=>k!="admin").map(([k,l])=>`<option value="${k}"${k==Dc.role?" selected":""}>${l}</option>`).join("")}</select><label class="ghost up" style="display:inline-flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="di" style="width:auto"${Dc.inc?" checked":""}> Incomplete only</label></div><div id="dl"></div>`;
  const draw=()=>{const q=Dc.q.toLowerCase(),f=staff.filter(s=>(!q||(s.full_name+" "+s.username).toLowerCase().includes(q))&&(!Dc.role||s.role==Dc.role)&&(!Dc.inc||s.has.size<4)),pg=PAGER.paginate("docs",f),c=(s,k)=>s.has.has(k)?'<span style="color:#22c55e">✔</span>':'<span style="color:var(--mu)">—</span>';
    $("#dl").innerHTML=f.length?`<div class="tw"><table><thead><tr><th>Name</th><th>Role</th><th>Resume</th><th>Valid ID</th><th>Clearance</th><th>CBTA</th><th>Complete</th></tr></thead><tbody>${pg.slice.map(s=>`<tr data-i="${s.id}" style="cursor:pointer"><td><b>${esc(s.full_name||s.username)}</b></td><td>${ROLES[s.role]}</td><td>${c(s,"resume")}</td><td>${c(s,"valid_id")}</td><td>${c(s,"clearance")}</td><td>${c(s,"cbta")}</td><td><span class="pill" style="background:${s.has.size==4?"#22c55e":s.has.size?"#f59e0b":"#94a3b8"}">${s.has.size}/4</span></td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="empty"><b>EMPLOYEE DOCUMENTS</b><br>No employees yet. Staff appear here once their accounts have a role.</div>';
    $("#dl").querySelectorAll("tr[data-i]").forEach(t=>t.onclick=()=>{Dc.id=t.dataset.i;go(cur)});PAGER.bind($("#dl"),pg.st,draw)};
  $("#dq").oninput=e=>{Dc.q=e.target.value;PAGER.reset("docs");draw()};$("#dr").onchange=e=>{Dc.role=e.target.value;PAGER.reset("docs");draw()};$("#di").onchange=e=>{Dc.inc=e.target.checked;PAGER.reset("docs");draw()};draw()}

async function detail(v){
  const[P,D]=await Promise.all([sb.from("profiles").select("id,full_name,username,role").eq("id",Dc.id).maybeSingle(),sb.from("employee_docs").select("*").eq("profile_id",Dc.id).order("created_at")]);
  if(!P.data){Dc.id=null;return list(v)}
  const p=P.data,files=D.data||[],done=SLOTS.filter(([k])=>files.some(f=>f.doc_type==k)).length;
  v.innerHTML=`<div class="tbar"><button class="ghost" id="bk3">← Back to list</button><b style="font-size:16px">${esc(p.full_name||p.username)}</b><span class="chip">${ROLES[p.role]||""}</span><span class="pill" style="background:${done==4?"#22c55e":"#f59e0b"}">${done}/4 complete</span></div>
  <div class="chip" style="margin-bottom:12px">Drag a file onto a box, click it to browse, or click a box and press <b>Ctrl + V</b> to paste a screenshot or copied file. PDF, JPG, PNG, WEBP, DOC or DOCX · up to 10 MB each.</div>
  <div class="dgrid" style="margin-top:0">${SLOTS.map(([k,l,h])=>{const fs=files.filter(f=>f.doc_type==k);return`<div class="dc"><h4>${l} ${fs.length?'<span style="color:#22c55e">✔</span>':'<span class="chip">missing</span>'}</h4><div class="chip" style="margin-bottom:8px">${h}</div>
    ${k=="clearance"?`<select data-kind style="margin-bottom:8px">${Object.entries(KIND).map(([a,b])=>`<option value="${a}"${a==Dc.kind?" selected":""}>${b} clearance</option>`).join("")}</select>`:""}
    ${fs.map(f=>`<div class="attn" style="cursor:default"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.clearance_kind?`<span class="pill" style="background:var(--gold)">${KIND[f.clearance_kind]}</span> `:""}${esc(f.file_name)}<br><span class="chip">${sz(f.size_bytes||0)} · ${fd(f.created_at)}</span></span><button class="ghost" data-v="${f.id}">View</button><button class="ghost" data-d="${f.id}">Delete</button></div>`).join("")}
    <div class="drop" tabindex="0" data-s="${k}"><b>Drop file here</b><br><span class="chip">or click · or press Ctrl+V</span><input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,image/*" multiple></div><div class="msg" data-m="${k}" style="min-height:16px;color:var(--gold)"></div></div>`}).join("")}</div>`;
  $("#bk3").onclick=()=>{Dc.id=null;Dc.active=null;go(cur)};
  const kd=v.querySelector("[data-kind]");if(kd)kd.onchange=()=>Dc.kind=kd.value;
  v.querySelectorAll(".drop").forEach(z=>{const k=z.dataset.s,inp=z.querySelector("input");
    const act=()=>{Dc.active=k;v.querySelectorAll(".drop").forEach(x=>x.classList.toggle("act",x==z))};
    z.onclick=e=>{act();if(e.target!==inp)inp.click()};z.onfocus=act;inp.onclick=e=>e.stopPropagation();inp.onchange=()=>{upload(v,k,[...inp.files]);inp.value=""};
    z.ondragover=e=>{e.preventDefault();act();z.classList.add("over")};z.ondragleave=()=>z.classList.remove("over");z.ondrop=e=>{e.preventDefault();z.classList.remove("over");upload(v,k,[...e.dataTransfer.files])}});
  v.querySelectorAll("[data-v]").forEach(b=>b.onclick=async()=>{const f=files.find(x=>x.id==b.dataset.v),{data,error}=await sb.storage.from(BUCKET).createSignedUrl(f.file_path,300);if(error)return alert("Could not open the file.");window.open(data.signedUrl,"_blank")});
  v.querySelectorAll("[data-d]").forEach(b=>b.onclick=async()=>{const f=files.find(x=>x.id==b.dataset.d);if(!confirm("Delete "+f.file_name+"?"))return;await sb.storage.from(BUCKET).remove([f.file_path]);const{error}=await sb.from("employee_docs").delete().eq("id",f.id);if(error)return alert("Could not delete.");detail(v)});
  if(Dc.active){const z=v.querySelector(`.drop[data-s="${Dc.active}"]`);if(z)z.classList.add("act")}}

function onPaste(e){if(cur!=NAME||!Dc.id)return;if(/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName)&&document.activeElement.type!="file")return;
  const items=[...(e.clipboardData?.files||[])];if(!items.length)return;e.preventDefault();
  const k=Dc.active;const v=$("#view");if(!k){const m=v.querySelector("[data-m]");const first=v.querySelector(".chip");alert("Click the box you want first (Resume, Valid ID, Clearance or CBTA), then press Ctrl+V.");return}
  upload(v,k,items.map(f=>f.name&&f.name!="image.png"?f:new File([f],"pasted-"+Date.now()+"."+(f.type.split("/")[1]||"png"),{type:f.type})))}

async function upload(v,k,files){
  const m=v.querySelector(`[data-m="${k}"]`);if(!files.length)return;Dc.busy=true;let n=0,bad="";
  for(const f of files){
    if(!OK.includes(f.type)){bad=f.name+": file type not allowed.";continue}if(f.size>MAX){bad=f.name+": larger than 10 MB.";continue}
    m.textContent="Uploading "+f.name+"…";const path=`${Dc.id}/${k}/${Date.now()}-${safe(f.name)}`;
    const up=await sb.storage.from(BUCKET).upload(path,f,{contentType:f.type,upsert:false});if(up.error){bad=f.name+": upload failed.";continue}
    const ins=await sb.from("employee_docs").insert({profile_id:Dc.id,doc_type:k,clearance_kind:k=="clearance"?Dc.kind:null,file_path:path,file_name:f.name,mime:f.type,size_bytes:f.size,uploaded_by:me.id});
    if(ins.error){await sb.storage.from(BUCKET).remove([path]);bad=f.name+": could not save.";continue}n++}
  Dc.busy=false;await detail(v);const m2=v.querySelector(`[data-m="${k}"]`);if(m2)m2.textContent=bad?(n?n+" uploaded. ":"")+bad:n+" file(s) uploaded."}

window.MODS=Object.assign(window.MODS||{},{[NAME]:docs});
})();
