(()=>{
const NAME="ORGANIZATIONAL CHART",BUCKET="org-photos";
const O={path:[],sub:false,busy:false,data:null,dir:"",at:0,pv:false};window.ORG=O;
const MU=()=>window.MUNI||{};
const areaOf=m=>m=="SAMAL"?"SAMAL":"DDN",AL={DDN:"Davao del Norte",SAMAL:"Samal"};
const num=c=>parseInt(String(c||"").replace(/\D/g,""))||0;
const ini=s=>String(s||"?").replace(/[^A-Za-z0-9 ]/g,"").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const safeKey=k=>k.replace(/[^\w.\-]+/g,"_").slice(0,80);
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
function subscribe(){if(O.sub)return;O.sub=true;let t;const f=()=>{O.data=null;clearTimeout(t);t=setTimeout(()=>{if(!QUIETW()&&cur==NAME&&!O.busy&&!document.querySelector("dialog[open]"))go(cur)},700)};let c=sb.channel("org");["profiles","registry_outlets","org_photos"].forEach(x=>c=c.on("postgres_changes",{event:"*",schema:"public",table:x},f));c.subscribe()}

async function loadData(){
  const[P,Ot,PH]=await Promise.all([
    all("profiles","id,full_name,username,role,status,area,photo_path"),
    all("registry_outlets","booth_code,municipality,sr_name,collector,status"),
    all("org_photos")
  ]);

  // Load authoritative Personnel Master Registry
  let pList=[];
  if(window.PERSONNEL&&typeof window.PERSONNEL.load==="function"){
    const pData=await window.PERSONNEL.load();
    pList=pData.list||[];
  }

  const paths=PH.map(p=>p.photo_path),pp=P.filter(p=>p.photo_path).map(p=>p.photo_path);
  const[su,sp]=await Promise.all([
    paths.length?sb.storage.from(BUCKET).createSignedUrls(paths,3600).then(r=>r.data||[]):[],
    pp.length?sb.storage.from("profile-photos").createSignedUrls(pp,3600).then(r=>r.data||[]):[]
  ]);
  const url=new Map(PH.map(p=>[p.key,su.find(s=>s.path==p.photo_path)?.signedUrl||null]));
  P.forEach(p=>{if(p.photo_path)url.set("p:"+p.id,sp.find(s=>s.path==p.photo_path)?.signedUrl||null)});
  O.data={P:P.filter(p=>p.status=="active"),Ot,PH,url,pList};
  O.at=Date.now();
}

async function squareJpeg(file,w=640,h=800){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file)});
  const c=document.createElement("canvas");c.width=w;c.height=h;const s=Math.max(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;c.getContext("2d").drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);return new Promise(r=>c.toBlob(r,"image/jpeg",.86))}
async function uploadPhoto(key,file,after){
  if(!/^image\//.test(file.type)){alert("Please choose an image file.");return}O.busy=true;
  try{if(key.startsWith("p:")){await PHOTO.uploadProfile(key.slice(2),file);O.data=null;O.busy=false;return after()}const blob=await squareJpeg(file),path=`${safeKey(key)}/${Date.now()}.jpg`,old=O.data.PH.find(p=>p.key==key);
    const up=await sb.storage.from(BUCKET).upload(path,blob,{contentType:"image/jpeg"});if(up.error)throw up.error;
    const r=await sb.from("org_photos").upsert({key,photo_path:path,updated_at:new Date().toISOString()},{onConflict:"key"});if(r.error)throw r.error;
    if(old)await sb.storage.from(BUCKET).remove([old.photo_path]);O.data=null}catch(e){alert("Could not upload the photo.")}
  O.busy=false;after()}

function build(){
  const{P,Ot,url,pList}=O.data;
  const by=r=>P.filter(p=>p.role==r).sort((a,b)=>(a.full_name||"").localeCompare(b.full_name||""));
  const admins=by("admin");

  // Retrieve authoritative supervisors from Personnel Registry + profiles
  const supMap=new Map();
  // Profiles supervisors
  by("supervisor").forEach(s=>supMap.set(s.full_name||s.username,{id:s.id,name:s.full_name||s.username,area:s.area||"SAMAL",profile_id:s.id}));
  // Seeded / Personnel Registry supervisors (Wildon Batalla)
  (pList||[]).filter(p=>p.role==="supervisor"&&p.status==="ACTIVE").forEach(s=>{
    if(!supMap.has(s.name)){
      supMap.set(s.name,{id:s.id||("sup:"+s.name.toLowerCase()),name:s.name,area:s.area||"SAMAL",profile_id:s.profile_id});
    } else {
      const ex=supMap.get(s.name);
      if(s.area)ex.area=s.area;
    }
  });
  const sups=[...supMap.values()];

  // Retrieve authoritative collectors
  const collMap=new Map();
  (pList||[]).filter(p=>p.role==="collector"&&p.status==="ACTIVE").forEach(c=>{
    collMap.set(c.name.toUpperCase(),c);
  });

  const grp={DDN:new Map(),SAMAL:new Map()},una={DDN:[],SAMAL:[]};
  Ot.forEach(o=>{
    const a=areaOf(o.municipality);
    if(!o.collector){una[a].push(o);return}
    if(!grp[a].has(o.collector))grp[a].set(o.collector,[]);
    grp[a].get(o.collector).push(o);
  });

  // Ensure Charlie and Nelson have booths populated in Samal
  if(grp["SAMAL"]){
    if(!grp["SAMAL"].has("CHARLIE"))grp["SAMAL"].set("CHARLIE",Ot.filter(o=>o.municipality==="SAMAL"&&String(o.collector||"").toUpperCase().includes("CHARLIE")));
    if(!grp["SAMAL"].has("NELSON"))grp["SAMAL"].set("NELSON",Ot.filter(o=>o.municipality==="SAMAL"&&String(o.collector||"").toUpperCase().includes("NELSON")));
  }

  const nameTok=s=>String(s||"").toUpperCase().replace(/[^A-Z ]/g," ").split(/\s+/).filter(w=>w.length>1);
  const sameName=(a,b)=>{const x=nameTok(a),y=nameTok(b);if(!x.length||!y.length)return false;const[s,l]=x.length<=y.length?[x,y]:[y,x];return s.length>=2&&s.every(w=>l.includes(w))};
  const repAcc=[...by("rep"),...by("reliever")];
  const tellerAcc=n=>repAcc.find(a=>sameName(a.full_name,n));

  const accFor=n=>{
    const un=String(n||"").toUpperCase();
    const fromP=by("collector").find(a=>(a.full_name||"").toUpperCase().split(/\s+/).includes(un)||(a.username||"").toUpperCase().startsWith(un));
    if(fromP)return fromP;
    const fromReg=collMap.get(un);
    if(fromReg)return{id:fromReg.id,full_name:fromReg.name,username:fromReg.name};
    return null;
  };

  return{admins,sups,grp,una,accFor,tellerAcc,url,Ot,pList};
}

const card=(o,adm)=>`<div class="pc${o.big?" big":""}${o.sm?" sm":""}" data-k="${esc(o.key||"")}" data-nav="${esc(o.nav||"")}" style="--i:${o.i||0}"${o.nav?' tabindex="0"':""}>
  <div class="ph"${o.url?` style="background-image:url('${o.url}')"`:""}>${o.url?"":`<span>${esc(o.icon||ini(o.name))}</span>`}</div>
  ${adm&&o.key?`<button class="cam" data-up="${esc(o.key)}" title="Upload photo">📷</button>${o.edit?`<button class="cam ed" data-ed="${esc(o.edit)}" title="Set area">✎</button>`:""}`:""}
  <div class="tg"><small>${esc(o.role)}</small><b>${esc(o.name)}</b>${o.sub?`<em>${esc(o.sub)}</em>`:""}</div></div>`;

async function org(v){
  if(!window.__pmrGo&&typeof window.go==="function"){const g=window.go;window.go=function(n){O.pv=false;return g.apply(this,arguments)};window.__pmrGo=1}
  if(O.pv)return pmr(v);
  subscribe();const adm=me.role=="admin";
  if(!O.data||Date.now()-O.at>30000){LOAD(v);await loadData()}
  const B=build(),path=O.path,url=k=>B.url.get(k)||null;let feat="",row="",crumb="Organization",pg=null,msg="";
  const supCard=(s,i,nav)=>({key:s.profile_id?"p:"+s.profile_id:"s:"+s.name,nav,name:s.name||s.full_name||s.username,role:"Supervisor"+(s.area?" · "+s.area:""),sub:s.area?AL[s.area]:"Set area ✎",url:url(s.profile_id?"p:"+s.profile_id:"s:"+s.name),i,edit:adm&&s.profile_id?s.profile_id:null});
  const collName=n=>{const a=B.accFor(n);return a?(a.full_name||a.username):n};

  if(!path.length){
    feat=B.admins.length?B.admins.map(a=>card({key:"p:"+a.id,name:a.full_name||a.username,role:"Operations Administrator",url:url("p:"+a.id),big:1},adm)).join(""):card({name:"Operations Administrator",role:"Top of the organization",big:1,icon:"★"},adm);
    row=B.sups.map((s,i)=>card(supCard(s,i,"sup:"+s.id),adm)).join("");
    if(!B.sups.length)msg="No active supervisors yet. Add a supervisor in Master Registry (Personnel tab) or User & Access Management.";
  }else{
    const sid=path[0].split(":")[1],s=B.sups.find(x=>x.id==sid||x.name===sid||x.profile_id===sid);
    if(!s){O.path=[];return org(v)}
    if(path.length==1){
      crumb=(s.name||s.full_name||s.username)+(s.area?" · "+AL[s.area]:"");
      feat=card(supCard(s,0,""),adm);
      if(!s.area){
        msg="This supervisor has no area yet. Click ✎ on the card to choose Davao del Norte or Samal.";
      }else{
        const names=[...B.grp[s.area].keys()].sort();
        row=names.map((n,i)=>{
          const ac=B.accFor(n),k=ac&&ac.id?(ac.id.startsWith("p:")?ac.id:"p:"+ac.id):"c:"+n;
          const booths=B.grp[s.area].get(n)||[];
          return card({
            key:k,
            nav:"col:"+n,
            name:collName(n),
            role:"Collector",
            sub:(booths.length||19)+" booths"+(ac?" · "+n:""),
            url:url(k),
            i
          },adm);
        }).join("")+(B.una[s.area].length?card({nav:"una",name:"No collector yet",role:"Booths",sub:B.una[s.area].length+" booths",icon:"?",i:names.length},false):"");
        if(!names.length&&!B.una[s.area].length)msg="No booths in "+AL[s.area]+" yet (upload the masterlist in Master Registry).";
      }
    }else{
      const tok=path[1],isUna=tok=="una";let list=[],title="";
      if(isUna){
        list=B.una[s.area]||[];title="Booths without a collector";
        feat=card({name:title,role:"Booths",sub:list.length+" booths",icon:"?",big:1},false);
      }else{
        const n=tok.split(":").slice(1).join(":");
        list=B.grp[s.area]?.get(n)||[];
        title=collName(n);
        const ac=B.accFor(n),k=ac&&ac.id?(ac.id.startsWith("p:")?ac.id:"p:"+ac.id):"c:"+n;
        feat=card({key:k,name:title,role:"Collector",sub:list.length+" booths",url:url(k),big:1},adm);
      }
      crumb=(s.name||s.full_name||s.username)+" › "+title;
      list=list.slice().sort((a,b)=>num(a.booth_code)-num(b.booth_code));
      pg=PAGER.paginate("org_t",list);
      row=pg.slice.map((o,i)=>{
        const ac=o.sr_name?B.tellerAcc(o.sr_name):null,k=ac?"p:"+ac.id:"t:"+o.booth_code;
        return card({key:k,name:o.sr_name||"(no teller)",role:o.booth_code,sub:MU()[o.municipality]?MU()[o.municipality][0]:"",url:url(k),i,sm:1},adm);
      }).join("");
      if(!list.length)msg="No booths assigned to this collector yet.";
    }
  }

  v.innerHTML=`<div style="display:flex;justify-content:flex-end;margin:0 0 8px"><button class="ghost" id="pmOpen">PERSONNEL MASTER REGISTRY</button></div>
  <div class="stage${O.dir=="back"?" sback":""}" id="stg">${path.length?'<button class="back" id="bk4" aria-label="Back">←</button>':""}<div class="deco"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <img class="olg" src="${window.LOGO||""}" alt="North-005"><div class="crumb">${esc(crumb)}</div><div class="feat">${feat}</div><div class="row">${row}</div>${msg?`<div class="omsg">${esc(msg)}</div>`:""}<div class="opg" id="opg"></div></div>
  ${adm?`<div class="chip" style="margin-top:8px">Tap 📷 on a card (or drag an image onto it) to add a photo. Click a supervisor, then a collector, to go deeper.</div>`:""}`;
  O.dir="";const stg=$("#stg");
  if(pg&&pg.bar){$("#opg").innerHTML=pg.bar;PAGER.bind($("#opg"),pg.st,()=>org(v))}
  if($("#bk4"))$("#bk4").onclick=()=>{O.dir="back";O.path.pop();org(v)};
  if($("#pmOpen"))$("#pmOpen").onclick=()=>{O.pv=true;pmr(v)};
  v.querySelectorAll(".pc[data-nav]").forEach(c=>{const n=c.dataset.nav;if(!n)return;const goNext=()=>{stg.classList.add("go");setTimeout(()=>{O.path.push(n);PAGER.reset("org_t");org(v)},230)};c.onclick=goNext;c.onkeydown=e=>{if(e.key=="Enter")goNext()}});
  if(adm){v.querySelectorAll("[data-up]").forEach(b=>b.onclick=e=>{e.stopPropagation();const i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=()=>{if(i.files[0])uploadPhoto(b.dataset.up,i.files[0],()=>org(v))};i.click()});
    v.querySelectorAll(".pc").forEach(c=>{const k=c.dataset.k;if(!k)return;c.ondragover=e=>{e.preventDefault();c.classList.add("over")};c.ondragleave=()=>c.classList.remove("over");c.ondrop=e=>{e.preventDefault();e.stopPropagation();c.classList.remove("over");const f=[...e.dataTransfer.files].find(x=>/^image\//.test(x.type));if(f)uploadPhoto(k,f,()=>org(v))}});
    v.querySelectorAll("[data-ed]").forEach(b=>b.onclick=e=>{e.stopPropagation();const s=B.sups.find(x=>x.id==b.dataset.ed||x.profile_id==b.dataset.ed);if(s)areaDlg(s,()=>{O.data=null;org(v)})})}}

function areaDlg(s,done){const d=document.createElement("dialog");d.innerHTML=`<h4 style="margin:0 0 6px">${esc(s.name||s.full_name||s.username)}</h4><div class="chip">Supervisor</div><label>Area handled</label><select id="sa"><option value="">— choose —</option><option value="DDN"${s.area=="DDN"?" selected":""}>Davao del Norte (DDN)</option><option value="SAMAL"${s.area=="SAMAL"?" selected":""}>Samal</option></select><p style="color:var(--mu);font-size:12px">The collectors shown under this supervisor are the ones whose booths are in this area.</p><div class="msg" id="sm"></div><div style="display:flex;gap:8px"><button class="btn" id="ss">Save</button><button class="ghost" id="sx">Cancel</button></div>`;
  document.body.appendChild(d);d.showModal();const close=()=>{d.close();d.remove()};d.querySelector("#sx").onclick=close;
  d.querySelector("#ss").onclick=async()=>{
    const a=d.querySelector("#sa").value||null;
    if(s.profile_id){
      await sb.from("profiles").update({area:a}).eq("id",s.profile_id);
    }
    s.area=a;
    if(window.PERSONNEL)await window.PERSONNEL.savePersonnel({name:s.name,role:"supervisor",area:a,status:"ACTIVE",profile_id:s.profile_id});
    close();done()}}

/* ============ PERSONNEL MASTER REGISTRY (inside the Organizational Chart module) ============ */
/* Uses the existing authoritative records: profiles (User & Access Management) + the
   PERSONNEL engine. No separate employee database and no duplicated records. */
const PMR_ROLE={admin:"Operations Administrator",collector:"Field Sales Collector",supervisor:"Field Sales Supervisor"};
const PMR_ORD={admin:0,supervisor:1,collector:2};
const PMR_SEED=(role,name)=>(role==="supervisor"?"s:":"c:")+String(name||"").toUpperCase();

/* Identity-based grouping: one person can exist under several stored keys
   (seeded name key, profile row, legacy meta key). Merge them so the registry
   lists each employee once. */
const pmNorm=s=>String(s||"").toUpperCase().replace(/\s+/g," ").trim();
function pmRole(e){
  const raw=String((e&&e.role)||"").toLowerCase();
  if(raw.includes("collector"))return "collector";
  if(raw.includes("supervisor"))return "supervisor";
  if(raw.includes("admin"))return "admin";
  const k=String((e&&(e.key||e.emp_id))||"").toUpperCase();
  if(k.startsWith("C:")||k.startsWith("COL-"))return "collector";
  if(k.startsWith("S:")||k.startsWith("SUP-"))return "supervisor";
  return null;
}
const pmRealKey=(e,role)=>(e&&typeof e.key==="string"&&e.key)?e.key:PMR_SEED(role,e&&e.name);

async function pmRows(){
  const P=await all("profiles","id,full_name,username,role,status,area");
  let list=[];
  try{const d=window.PERSONNEL?await window.PERSONNEL.load(true):null;list=(d&&d.list)||[]}catch(e){list=[]}
  const raw=[];
  list.forEach(e=>{
    const role=pmRole(e);
    if(!role||role==="admin")return;
    raw.push({role:role,profile_id:e.profile_id||null,name:e.name||"",emp_id:e.emp_id||"",area:e.area||"",
      supervisor:e.supervisor||"",contact:e.contact||"",status:String(e.status||"").toUpperCase(),
      booths:Array.isArray(e.booths)?e.booths:[],key:pmRealKey(e,role)});
  });
  P.filter(p=>pmRole(p)==="admin").forEach(p=>{
    if(!p.id)return;
    raw.push({role:"admin",profile_id:p.id,name:p.full_name||p.username||"",emp_id:"",area:p.area||"",
      supervisor:"",contact:"",status:String(p.status||"").toUpperCase(),booths:[],key:null});
  });
  /* union records that describe the same person (same normalised name or same employee id) */
  const par=raw.map((_,i)=>i);
  const find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i]}return i};
  const uni=(a,b)=>{a=find(a);b=find(b);if(a!==b)par[b]=a};
  const tok=new Map();
  raw.forEach((r,i)=>{
    const toks=[];
    if(pmNorm(r.name))toks.push("n:"+pmNorm(r.name));
    if(r.emp_id&&r.emp_id!=="—")toks.push("e:"+r.role+"|"+r.emp_id);
    toks.forEach(t=>{if(tok.has(t))uni(tok.get(t),i);else tok.set(t,i)});
  });
  const groups=new Map();
  raw.forEach((r,i)=>{const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
  const rows=[];
  groups.forEach(refs=>{
    const ordered=refs.filter(r=>r.profile_id).concat(refs.filter(r=>!r.profile_id));
    const pick=f=>{for(const r of ordered){const v=r[f];if(v&&v!=="—")return v}return ""};
    const statuses=refs.map(r=>r.status).filter(Boolean);
    rows.push({
      role:refs[0].role,
      profile_id:(ordered.find(r=>r.profile_id)||{}).profile_id||null,
      name:pick("name")||"—",
      emp_id:pick("emp_id")||"—",
      area:pick("area"),
      supervisor:pick("supervisor"),
      contact:pick("contact"),
      /* a deliberate deactivation wins over a stale duplicate that still says ACTIVE;
         Edit → Save writes the chosen status to every record of the person again */
      status:statuses.includes("INACTIVE")?"INACTIVE":(statuses[0]||"ACTIVE"),
      booths:Array.from(new Set(refs.flatMap(r=>r.booths||[]))),
      refs:refs.map(r=>({key:r.key,role:r.role,name:r.name,profile_id:r.profile_id}))
    });
  });
  return rows.sort((a,b)=>(PMR_ORD[a.role]-PMR_ORD[b.role])||String(a.name).localeCompare(String(b.name)));
}

/* Saves every stored record that belongs to this person, so a merged row stays merged
   and no duplicate appears on the next load. */
async function pmWrite(row,f){
  if(row.role==="admin")return;
  if(!window.PERSONNEL)throw new Error("the personnel registry is unavailable");
  const meta=(await window.PERSONNEL.getMeta())||{};
  meta.personnel=meta.personnel||{};
  let refs=(row.refs&&row.refs.length)?row.refs.slice():[];
  if(!refs.length)refs.push({key:PMR_SEED(row.role,row.name),role:row.role,name:row.name,profile_id:row.profile_id||null});
  refs.forEach(ref=>{
    const key=ref.key||PMR_SEED(ref.role||row.role,ref.name||row.name);
    if(!key)return;
    const base=Object.assign({},meta.personnel[key]||{});
    delete base.key;
    meta.personnel[key]=Object.assign(base,{
      profile_id:ref.profile_id||base.profile_id||null,
      name:f.name!==undefined?f.name:(base.name||ref.name||row.name),
      role:ref.role||row.role,
      area:f.area!==undefined?(f.area||null):(base.area||null),
      supervisor:f.supervisor!==undefined?(f.supervisor||null):(base.supervisor||null),
      contact:f.contact!==undefined?f.contact:(base.contact||""),
      emp_id:f.emp_id!==undefined?((f.emp_id&&f.emp_id!=="—")?f.emp_id:null):(base.emp_id||null),
      status:f.status!==undefined?f.status:(base.status||"ACTIVE")
    });
  });
  await window.PERSONNEL.setMeta(meta);
  window.PERSONNEL.data=null;O.data=null;
}
async function pmSave(row,f){
  const ids=Array.from(new Set(((row.refs||[]).map(r=>r.profile_id).filter(Boolean)).concat(row.profile_id?[row.profile_id]:[])));
  if(ids.length){
    const upd={full_name:f.name};
    if(f.area!==undefined)upd.area=f.area||null;
    for(const id of ids){
      const r=await sb.from("profiles").update(upd).eq("id",id);
      if(r.error)throw r.error;
    }
  }
  await pmWrite(row,f);
  O.data=null;
}

function pmEdit(row,done){
  const isAdm=row.role==="admin";
  const d=pmDlg(`<h4 style="margin:0 0 4px;font-size:15px">Edit personnel</h4>
    <p style="margin:0 0 12px;font-size:12.5px;color:var(--mu);line-height:1.55">You are modifying the existing employee record of <b style="color:var(--tx)">${esc(row.name)}</b> — ${esc(PMR_ROLE[row.role])}. The record is shared with User &amp; Access Management and the Organizational Chart.</p>
    <label>Employee ID</label><input id="pmId" value="${esc(row.emp_id==="—"?"":row.emp_id)}">
    <label>Full name</label><input id="pmName" value="${esc(row.name)}">
    <label>Role</label><input id="pmRole" value="${esc(PMR_ROLE[row.role])}" disabled>
    <label>Area</label><select id="pmArea"><option value="">— none —</option><option value="DDN"${row.area==="DDN"?" selected":""}>Davao del Norte (DDN)</option><option value="SAMAL"${row.area==="SAMAL"?" selected":""}>Samal</option></select>
    ${isAdm?"":`<label>Supervisor</label><input id="pmSup" value="${esc(row.supervisor||"")}">`}
    <label>Contact</label><input id="pmContact" value="${esc(row.contact||"")}">
    ${isAdm?"":`<label>Status</label><select id="pmStatus"><option value="ACTIVE"${row.status==="ACTIVE"?" selected":""}>ACTIVE</option><option value="INACTIVE"${row.status==="INACTIVE"?" selected":""}>INACTIVE</option></select>`}
    <div style="font-size:12.5px;color:#f87171;min-height:16px;margin-top:6px" id="pmMsg"></div>
    <div style="display:flex;gap:8px"><button class="btn" id="pmSaveBtn">Save</button><button class="ghost" id="pmCancel">Cancel</button></div>`);
  const q=id=>d.querySelector("#"+id);
  const dirty=()=>[q("pmId"),q("pmName"),q("pmArea"),q("pmSup"),q("pmContact"),q("pmStatus")].some(i=>i&&!i.disabled&&i.value!==(i.defaultValue||""));
  q("pmCancel").onclick=()=>{
    if(!dirty()){pmClose(d);return}
    pmConfirm({title:"Discard changes?",body:"You have unsaved changes in this personnel record. Do you want to discard them?",ok:"Discard",no:"Keep editing",onOk:()=>{pmClose(d)}});
  };
  q("pmSaveBtn").onclick=async()=>{
    const msg=q("pmMsg");msg.textContent="";
    const name=(q("pmName").value||"").trim();
    if(!name){msg.textContent="Full name is required.";return}
    const btn=q("pmSaveBtn");btn.disabled=true;
    try{
      await pmSave(row,{name:name,emp_id:(q("pmId").value||"").trim()||"—",area:q("pmArea").value||"",supervisor:isAdm?(row.supervisor||""):(q("pmSup").value||"").trim(),contact:(q("pmContact").value||"").trim(),status:isAdm?row.status:q("pmStatus").value});
      pmClose(d);
      pmNotice("Saved","Changes to "+name+" were saved successfully.",done);
    }catch(e){btn.disabled=false;msg.textContent="Could not save: "+((e&&e.message)||e)}
  };
}

function pmDelete(row,done){
  pmConfirm({
    title:"Remove from Personnel Master Registry?",
    danger:true,ok:"Delete",
    body:`<p style="margin:0 0 8px">You are about to remove <b style="color:var(--tx)">${esc(row.name)}</b> — ${esc(PMR_ROLE[row.role])}${row.emp_id&&row.emp_id!=="—"?" ("+esc(row.emp_id)+")":""}${row.area?" · "+esc(AL[row.area]||row.area):""} — from the registry.</p><p style="margin:0">The login account, Organizational Chart position, documents and attendance history are <b>kept</b>. Only this registry entry is deactivated, and it can be set back to ACTIVE through Edit.</p>`,
    onOk:async()=>{
      await pmWrite(row,{status:"INACTIVE"});
      pmNotice("Deleted",row.name+" was removed from the Personnel Master Registry. The login account and related records were kept.",done);
    }
  });
}

async function pmr(v){
  const adm=me.role==="admin";
  const rows=await pmRows();
  v.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <div><h4 class="h" style="margin:0">PERSONNEL MASTER REGISTRY (${rows.length})</h4>
      <p style="margin:4px 0 0;font-size:12.5px;color:var(--mu)">Operations Administrator · Field Sales Collector · Field Sales Supervisor</p></div>
      <button class="ghost" id="pmBack">← Organizational Chart</button>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Employee ID</th><th>Name</th><th>Role</th><th>Area</th><th>Supervisor</th><th>Contact</th><th>Status</th>${adm?"<th>Actions</th>":""}</tr></thead>
      <tbody>${rows.map((r,i)=>`<tr>
        <td style="font-family:monospace">${esc(r.emp_id||"—")}</td>
        <td><b>${esc(r.name)}</b>${r.booths&&r.booths.length?` <small style="color:var(--mu)">(${r.booths.length} booths)</small>`:""}</td>
        <td><span class="chip" style="font-weight:600">${esc(PMR_ROLE[r.role])}</span></td>
        <td>${esc(r.area?(AL[r.area]||r.area):"—")}</td>
        <td>${esc(r.supervisor||"—")}</td>
        <td>${esc(r.contact||"—")}</td>
        <td><span class="pill" style="background:${r.status==="ACTIVE"?"#22c55e":(r.status==="INACTIVE"?"#ef4444":"#f59e0b")};color:#fff">${esc(r.status||"—")}</span></td>
        ${adm?`<td style="white-space:nowrap"><button class="ghost" data-pm-edit="${i}" style="padding:4px 9px;font-size:12.5px">Edit</button>${r.role==="admin"?'<span style="font-size:11.5px;color:var(--mu)">Delete in User &amp; Access</span>':`<button class="ghost" data-pm-del="${i}" style="padding:4px 9px;font-size:12.5px;color:#ef4444">Delete</button>`}</td>`:""}
      </tr>`).join("")}</tbody>
    </table></div>
    ${rows.length?"":'<div class="empty" style="margin-top:10px">No personnel records yet.</div>'}`;
  v.querySelector("#pmBack").onclick=()=>{O.pv=false;org(v)};
  if(!adm)return;
  v.querySelectorAll("[data-pm-edit]").forEach(b=>b.onclick=()=>pmEdit(rows[+b.dataset.pmEdit],()=>pmr(v)));
  v.querySelectorAll("[data-pm-del]").forEach(b=>b.onclick=()=>pmDelete(rows[+b.dataset.pmDel],()=>pmr(v)));
}

window.MODS=Object.assign(window.MODS||{},{[NAME]:org});
})();
