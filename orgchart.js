(()=>{
const NAME="ORGANIZATIONAL CHART",BUCKET="org-photos";
const O={path:[],sub:false,busy:false,data:null,dir:"",at:0};window.ORG=O;
const MU=()=>window.MUNI||{};
const areaOf=m=>m=="SAMAL"?"SAMAL":"DDN",AL={DDN:"Davao del Norte",SAMAL:"Samal"};
const num=c=>parseInt(String(c||"").replace(/\D/g,""))||0;
const ini=s=>String(s||"?").replace(/[^A-Za-z0-9 ]/g,"").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
const safeKey=k=>k.replace(/[^\w.\-]+/g,"_").slice(0,80);
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
function subscribe(){if(O.sub)return;O.sub=true;let t;const f=()=>{O.data=null;clearTimeout(t);t=setTimeout(()=>{if(!QUIETW()&&cur==NAME&&!O.busy&&!document.querySelector("dialog[open]"))go(cur)},700)};let c=sb.channel("org");["profiles","registry_outlets","org_photos"].forEach(x=>c=c.on("postgres_changes",{event:"*",schema:"public",table:x},f));c.subscribe()}

async function loadData(){
  const[P,Ot,PH]=await Promise.all([all("profiles","id,full_name,username,role,status,area,photo_path"),all("registry_outlets","booth_code,municipality,sr_name,collector,status"),all("org_photos")]);
  const paths=PH.map(p=>p.photo_path),pp=P.filter(p=>p.photo_path).map(p=>p.photo_path);
  const[su,sp]=await Promise.all([paths.length?sb.storage.from(BUCKET).createSignedUrls(paths,3600).then(r=>r.data||[]):[],pp.length?sb.storage.from("profile-photos").createSignedUrls(pp,3600).then(r=>r.data||[]):[]]);
  const url=new Map(PH.map(p=>[p.key,su.find(s=>s.path==p.photo_path)?.signedUrl||null]));
  P.forEach(p=>{if(p.photo_path)url.set("p:"+p.id,sp.find(s=>s.path==p.photo_path)?.signedUrl||null)});
  O.data={P:P.filter(p=>p.status=="active"),Ot,PH,url};O.at=Date.now()}

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
  const{P,Ot,url}=O.data,by=r=>P.filter(p=>p.role==r).sort((a,b)=>(a.full_name||"").localeCompare(b.full_name||""));
  const admins=by("admin"),sups=by("supervisor"),collAcc=by("collector"),grp={DDN:new Map(),SAMAL:new Map()},una={DDN:[],SAMAL:[]};
  Ot.forEach(o=>{const a=areaOf(o.municipality);if(!o.collector){una[a].push(o);return}if(!grp[a].has(o.collector))grp[a].set(o.collector,[]);grp[a].get(o.collector).push(o)});
  const nameTok=s=>String(s||"").toUpperCase().replace(/[^A-Z ]/g," ").split(/\s+/).filter(w=>w.length>1),sameName=(a,b)=>{const x=nameTok(a),y=nameTok(b);if(!x.length||!y.length)return false;const[s,l]=x.length<=y.length?[x,y]:[y,x];return s.length>=2&&s.every(w=>l.includes(w))},repAcc=[...by("rep"),...by("reliever")],tellerAcc=n=>repAcc.find(a=>sameName(a.full_name,n));
  const accFor=n=>collAcc.find(a=>(a.full_name||"").toUpperCase().split(/\s+/).includes(n)||(a.username||"").toUpperCase().startsWith(n));
  return{admins,sups,grp,una,accFor,tellerAcc,url,Ot}}

const card=(o,adm)=>`<div class="pc${o.big?" big":""}${o.sm?" sm":""}" data-k="${esc(o.key||"")}" data-nav="${esc(o.nav||"")}" style="--i:${o.i||0}"${o.nav?' tabindex="0"':""}>
  <div class="ph"${o.url?` style="background-image:url('${o.url}')"`:""}>${o.url?"":`<span>${esc(o.icon||ini(o.name))}</span>`}</div>
  ${adm&&o.key?`<button class="cam" data-up="${esc(o.key)}" title="Upload photo">📷</button>${o.edit?`<button class="cam ed" data-ed="${esc(o.edit)}" title="Set area">✎</button>`:""}`:""}
  <div class="tg"><small>${esc(o.role)}</small><b>${esc(o.name)}</b>${o.sub?`<em>${esc(o.sub)}</em>`:""}</div></div>`;

async function org(v){
  subscribe();const adm=me.role=="admin";
  if(!O.data||Date.now()-O.at>30000){LOAD(v);await loadData()}
  const B=build(),path=O.path,url=k=>B.url.get(k)||null;let feat="",row="",crumb="Organization",pg=null,msg="";
  const supCard=(s,i,nav)=>({key:"p:"+s.id,nav,name:s.full_name||s.username,role:"Supervisor"+(s.area?" · "+s.area:""),sub:s.area?AL[s.area]:"Set area ✎",url:url("p:"+s.id),i,edit:adm?s.id:null});
  const collName=n=>{const a=B.accFor(n);return a?(a.full_name||a.username):n};
  if(!path.length){
    feat=B.admins.length?B.admins.map(a=>card({key:"p:"+a.id,name:a.full_name||a.username,role:"Operations Administrator",url:url("p:"+a.id),big:1},adm)).join(""):card({name:"Operations Administrator",role:"Top of the organization",big:1,icon:"★"},adm);
    row=B.sups.map((s,i)=>card(supCard(s,i,"sup:"+s.id),adm)).join("");
    if(!B.sups.length)msg="No active supervisors yet. Set a user's role to Field Sales Supervisor in User & Access Management.";
  }else{
    const sid=path[0].split(":")[1],s=B.sups.find(x=>x.id==sid);if(!s){O.path=[];return org(v)}
    if(path.length==1){crumb=(s.full_name||s.username)+(s.area?" · "+AL[s.area]:"");feat=card(supCard(s,0,""),adm);
      if(!s.area)msg="This supervisor has no area yet. Click ✎ on the card to choose Davao del Norte or Samal.";
      else{const names=[...B.grp[s.area].keys()].sort();row=names.map((n,i)=>{const ac=B.accFor(n),k=ac?"p:"+ac.id:"c:"+n;return card({key:k,nav:"col:"+n,name:collName(n),role:"Collector",sub:B.grp[s.area].get(n).length+" booths"+(ac?" · "+n:""),url:url(k),i},adm)}).join("")+(B.una[s.area].length?card({nav:"una",name:"No collector yet",role:"Booths",sub:B.una[s.area].length+" booths",icon:"?",i:names.length},false):"");if(!names.length&&!B.una[s.area].length)msg="No booths in "+AL[s.area]+" yet (upload the masterlist in Master Registry)."}
    }else{
      const tok=path[1],isUna=tok=="una";let list=[],title="";
      if(isUna){list=B.una[s.area]||[];title="Booths without a collector";feat=card({name:title,role:"Booths",sub:list.length+" booths",icon:"?",big:1},false)}
      else{const n=tok.split(":").slice(1).join(":");list=B.grp[s.area]?.get(n)||[];title=collName(n);const ac=B.accFor(n),k=ac?"p:"+ac.id:"c:"+n;feat=card({key:k,name:title,role:"Collector",sub:list.length+" booths",url:url(k),big:1},adm)}
      crumb=(s.full_name||s.username)+" › "+title;list=list.slice().sort((a,b)=>num(a.booth_code)-num(b.booth_code));pg=PAGER.paginate("org_t",list);
      row=pg.slice.map((o,i)=>{const ac=o.sr_name?B.tellerAcc(o.sr_name):null,k=ac?"p:"+ac.id:"t:"+o.booth_code;return card({key:k,name:o.sr_name||"(no teller)",role:o.booth_code,sub:MU()[o.municipality]?MU()[o.municipality][0]:"",url:url(k),i,sm:1},adm)}).join("");if(!list.length)msg="No booths here."}
  }
  v.innerHTML=`<div class="stage${O.dir=="back"?" sback":""}" id="stg">${path.length?'<button class="back" id="bk4" aria-label="Back">←</button>':""}<div class="deco"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <img class="olg" src="${window.LOGO||""}" alt="North-005"><div class="crumb">${esc(crumb)}</div><div class="feat">${feat}</div><div class="row">${row}</div>${msg?`<div class="omsg">${esc(msg)}</div>`:""}<div class="opg" id="opg"></div></div>
  ${adm?`<div class="chip" style="margin-top:8px">Tap 📷 on a card (or drag an image onto it) to add a photo. Click a supervisor, then a collector, to go deeper.</div>`:""}`;
  O.dir="";const stg=$("#stg");
  if(pg&&pg.bar){$("#opg").innerHTML=pg.bar;PAGER.bind($("#opg"),pg.st,()=>org(v))}
  if($("#bk4"))$("#bk4").onclick=()=>{O.dir="back";O.path.pop();org(v)};
  v.querySelectorAll(".pc[data-nav]").forEach(c=>{const n=c.dataset.nav;if(!n)return;const goNext=()=>{stg.classList.add("go");setTimeout(()=>{O.path.push(n);PAGER.reset("org_t");org(v)},230)};c.onclick=goNext;c.onkeydown=e=>{if(e.key=="Enter")goNext()}});
  if(adm){v.querySelectorAll("[data-up]").forEach(b=>b.onclick=e=>{e.stopPropagation();const i=document.createElement("input");i.type="file";i.accept="image/*";i.onchange=()=>{if(i.files[0])uploadPhoto(b.dataset.up,i.files[0],()=>org(v))};i.click()});
    v.querySelectorAll(".pc").forEach(c=>{const k=c.dataset.k;if(!k)return;c.ondragover=e=>{e.preventDefault();c.classList.add("over")};c.ondragleave=()=>c.classList.remove("over");c.ondrop=e=>{e.preventDefault();e.stopPropagation();c.classList.remove("over");const f=[...e.dataTransfer.files].find(x=>/^image\//.test(x.type));if(f)uploadPhoto(k,f,()=>org(v))}});
    v.querySelectorAll("[data-ed]").forEach(b=>b.onclick=e=>{e.stopPropagation();const s=B.sups.find(x=>x.id==b.dataset.ed);areaDlg(s,()=>{O.data=null;org(v)})})}}

function areaDlg(s,done){const d=document.createElement("dialog");d.innerHTML=`<h4 style="margin:0 0 6px">${esc(s.full_name||s.username)}</h4><div class="chip">Supervisor</div><label>Area handled</label><select id="sa"><option value="">— choose —</option><option value="DDN"${s.area=="DDN"?" selected":""}>Davao del Norte (DDN)</option><option value="SAMAL"${s.area=="SAMAL"?" selected":""}>Samal</option></select><p style="color:var(--mu);font-size:12px">The collectors shown under this supervisor are the ones whose booths are in this area.</p><div class="msg" id="sm"></div><div style="display:flex;gap:8px"><button class="btn" id="ss">Save</button><button class="ghost" id="sx">Cancel</button></div>`;
  document.body.appendChild(d);d.showModal();const close=()=>{d.close();d.remove()};d.querySelector("#sx").onclick=close;
  d.querySelector("#ss").onclick=async()=>{const a=d.querySelector("#sa").value||null,{error}=await sb.from("profiles").update({area:a}).eq("id",s.id);if(error)return d.querySelector("#sm").textContent="Could not save.";close();done()}}

window.MODS=Object.assign(window.MODS||{},{[NAME]:org});
})();
