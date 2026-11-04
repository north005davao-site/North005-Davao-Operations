const SB_URL="https://aplntnljisjpjvfblvlu.supabase.co",SB_KEY="sb_publishable_CnYeee1LF3BwV55pjUUsOw_6PT8-u9_";
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}),$=s=>document.querySelector(s);
window.LASTWRITE=0;window.QUIETW=()=>Date.now()-window.LASTWRITE<2500;
(()=>{const f=sb.from.bind(sb);sb.from=t=>{const q=f(t);return new Proxy(q,{get(o,k){const v=o[k];if(k==="insert"||k==="update"||k==="upsert"||k==="delete")return(...x)=>{window.LASTWRITE=Date.now();return v.apply(o,x)};return typeof v==="function"?v.bind(o):v}})};const r=sb.rpc.bind(sb);sb.rpc=(...x)=>{window.LASTWRITE=Date.now();return r(...x)}})();
let lastMod=null;window.LOAD=v=>{if(v.dataset.mod!==cur){v.innerHTML='<div class="empty">Loading…</div>';v.dataset.mod=cur}};
const ini=s=>String(s||"?").replace(/[^A-Za-z0-9 ]/g,"").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?";
window.PHOTO={
  async crop(file,w=640,h=800){const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file)});const c=document.createElement("canvas");c.width=w;c.height=h;const s=Math.max(w/img.width,h/img.height),dw=img.width*s,dh=img.height*s;c.getContext("2d").drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);URL.revokeObjectURL(img.src);return new Promise(r=>c.toBlob(r,"image/jpeg",.86))},
  async signed(p){if(!p)return null;const{data}=await sb.storage.from("profile-photos").createSignedUrl(p,3600);return data?data.signedUrl:null},
  async uploadProfile(pid,file){const blob=await PHOTO.crop(file),path=`${pid}/${Date.now()}.jpg`,up=await sb.storage.from("profile-photos").upload(path,blob,{contentType:"image/jpeg"});if(up.error)throw up.error;
    const{data:old}=await sb.from("profiles").select("photo_path").eq("id",pid).maybeSingle(),r=await sb.from("profiles").update({photo_path:path}).eq("id",pid);if(r.error)throw r.error;
    if(old&&old.photo_path)sb.storage.from("profile-photos").remove([old.photo_path]);return path},
  async removeProfile(pid){const{data:old}=await sb.from("profiles").select("photo_path").eq("id",pid).maybeSingle(),r=await sb.from("profiles").update({photo_path:null}).eq("id",pid);if(r.error)throw r.error;if(old&&old.photo_path)await sb.storage.from("profile-photos").remove([old.photo_path])}};
const G=[["CORE OPERATIONS",["DASHBOARD","MASTER REGISTRY","SALES & COLLECTION","ETS LIVE TRACKING"]],
["FINANCE & PROPERTY",["CASH ADVANCE (C.A) & PAYMENTS","OUTLET RENTALS & LOAD ALLOWANCE"]],
["WORKFORCE & TOOLS",["USER & ACCESS MANAGEMENT","ATTENDANCE / WORKFORCE MONITORING","ORGANIZATIONAL CHART","EMPLOYEE DOCUMENTS","THERMAL PAPER DAILY SUMMARY"]],
["EXPANSION & PLANNING",["PROPOSED LOCATIONS"]],
["SYSTEM ADMINISTRATION",["BACK UP & RESTORE"]],["PROFILE",["MY ACCOUNT"]]];
const ROLES={admin:"Operations Administrator",supervisor:"Field Sales Supervisor",collector:"Field Sales Collector",rep:"Sales Representative",reliever:"Reliever"};
const CORE=G[0][1],FIN=G[1][1],CA="CASH ADVANCE (C.A) & PAYMENTS",ATT="ATTENDANCE / WORKFORCE MONITORING",ACC="MY ACCOUNT",PROP="PROPOSED LOCATIONS";
const ALLOW={admin:null,supervisor:[...CORE,...FIN,PROP,ACC],collector:[CA,ACC],rep:[ATT,ACC],reliever:[ATT,ACC]};
let me=null,cur=null,mode="L",ch=null;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const show=id=>["boot","auth","intro","app"].forEach(x=>$("#"+x).classList.toggle("hide",x!=id));
const setMsg=(t,ok)=>{const m=$("#msg");m.textContent=t;m.style.color=ok?"#8fe3a8":"#ff8b9b"};
const allowed=()=>{const a=ALLOW[me.role];return a?G.flatMap(g=>g[1]).filter(n=>a.includes(n)):G.flatMap(g=>g[1])};
const uid=s=>s.trim().toLowerCase();
const em=u=>u+"@north005.app";

const MINPW=8,LBL={L:"Login",S:"Create Account",F:"Send Request to Administrator",C:"Set New Password"};
let LO=false;
const quiet=async()=>{LO=true;try{await sb.auth.signOut()}finally{setTimeout(()=>{LO=false},900)}};
const pop=el=>{if(!el)return;el.classList.remove("pop");void el.offsetWidth;el.classList.add("pop")};
const setLabel=()=>{$("#go").textContent=LBL[mode]};
function tab(m){const prev=mode;mode=m;$("#out-done")?.classList.add("hide");
  const vis=(id,on)=>{const e=$("#"+id),was=!e.classList.contains("hide");e.classList.toggle("hide",!on);if(on&&!was)pop(e)};
  vis("fN",m=="S");vis("fU",m!="C");vis("fP",m!="F");vis("fC",m=="S"||m=="C");vis("ph",m=="S"||m=="C");
  $("#fg").classList.toggle("hide",m!="L");$("#bk").classList.toggle("hide",m!="F"&&m!="C");
  $("#sw").classList.toggle("hide",m=="F"||m=="C");$("#sw").textContent=m=="S"?"Already have an account? Login":"No account yet? Sign up";
  setLabel();$("#sub").textContent={L:"Sign in to your account",S:"Create your account",F:"Request a password reset",C:"Choose a new password"}[m];pop($("#sub"));
  $("#pwl").textContent=m=="C"?"New password":"Password";if(prev!=m){$("#pw").value=$("#pw2").value=""}setMsg("")}
$("#sw").onclick=()=>tab(mode=="S"?"L":"S");$("#fg").onclick=()=>tab("F");$("#bk").onclick=async()=>{if(mode=="C"){await quiet()}tab("L")};
async function loadMe(){const{data:{user}}=await sb.auth.getUser();if(!user)return null;const{data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();me=data;return data}
function showDone(){$("#frm").classList.add("hide");$("#out-done")?.classList.add("hide");pop($("#dn"));$("#dn").classList.remove("hide")}
$("#dnb").onclick=()=>{$("#dn").classList.add("hide");$("#out-done")?.classList.add("hide");$("#frm").classList.remove("hide");tab("L")};
function showPostLogout(){show("auth");$("#frm").classList.add("hide");$("#dn").classList.add("hide");const od=$("#out-done");if(od){od.classList.remove("hide");pop(od)}}
const dno=$("#dno");if(dno){dno.onclick=()=>{const od=$("#out-done");if(od)od.classList.add("hide");$("#frm").classList.remove("hide");pop($("#frm"));tab("L");setTimeout(()=>$("#user")?.focus(),60)}}

$("#go").onclick=async()=>{
  const u=uid($("#user").value),pw=$("#pw").value,b=$("#go");b.disabled=true;b.classList.add("busy");b.textContent={L:"Signing in…",S:"Creating your account…",F:"Sending…",C:"Saving…"}[mode];setMsg("");
  const end=()=>{b.disabled=false;b.classList.remove("busy");setLabel()};
  try{
    if(mode=="F"){if(!u)throw"Enter your username.";await sb.rpc("request_password_reset",{uname:u});
      setMsg("Request sent. The Administrator will give you a temporary password.",1);return end()}
    if(mode=="C"){if(pw.length<MINPW)throw"Password must be at least "+MINPW+" characters.";if(pw!==$("#pw2").value)throw"Passwords do not match.";
      const r=await sb.auth.updateUser({password:pw});if(r.error)throw r.error.message;
      await sb.from("profiles").update({must_change:false}).eq("id",me.id);me.must_change=false;clear();end();return intro()}
    if(!/^[a-z0-9_.-]{3,30}$/.test(u))throw"Username: 3-30 letters, numbers, . _ -";if(!pw)throw"Enter your password.";
    if(mode=="S"){const name=$("#name").value.trim();if(!name)throw"Enter your full name.";if(pw.length<MINPW)throw"Password must be at least "+MINPW+" characters.";
      if(pw!==$("#pw2").value)throw"Passwords do not match.";
      const r=await sb.auth.signUp({email:em(u),password:pw,options:{data:{full_name:name}}});
      if(r.error)throw/registered|already/i.test(r.error.message)?"That username is already taken.":r.error.message;
      if(!r.data||!r.data.session)throw"Your account was created, but you could not be signed in automatically. Please log in."}
    else{const{error}=await sb.auth.signInWithPassword({email:em(u),password:pw});if(error)throw"Incorrect username or password."}
    const p=await loadMe();
    if(!p)throw"Could not load your account. Try again.";
    if(p.status=="pending"){const wasS=mode=="S";me=null;await quiet();clear();end();if(wasS)showDone();else{tab("L");setMsg("Your account is still awaiting approval by the Administrator.")}return}
    if(p.status=="disabled"){me=null;await quiet();throw"This account is disabled. Contact the Administrator."}
    if(p.must_change){end();tab("C");setMsg("Set a new password to continue.",1);return}
    clear();end();intro();
  }catch(e){setMsg(typeof e=="string"?e:"Something went wrong. Please try again.");end()}};
const clear=()=>{$("#name").value=$("#user").value=$("#pw").value=$("#pw2").value="";document.querySelectorAll(".eye.on").forEach(b=>b.click())};
addEventListener("keydown",e=>{if(e.key=="Enter"&&!$("#auth").classList.contains("hide"))$("#go").click()});

function intro(){show("intro");$("#wl").textContent="Welcome, "+me.full_name.split(" ")[0];
  setTimeout(()=>$("#intro").classList.add("out"),3900);setTimeout(()=>{$("#intro").classList.remove("out");enter()},4700)}
async function hdrAvatar(){const e=$("#hav");if(!e)return;e.textContent=ini(me.full_name);e.style.backgroundImage="";if(me.photo_path){const u=await PHOTO.signed(me.photo_path);if(u){e.style.backgroundImage=`url('${u}')`;e.textContent=""}}}
function enter(){show("app");$("#who").textContent=me.full_name+" · "+ROLES[me.role];hdrAvatar();
  const a=allowed();$("#navs").innerHTML=G.map(([g,it])=>{const f=it.filter(n=>a.includes(n));return f.length?`<div class="grp">${g}</div>`+f.map(n=>`<button class="nav" data-n="${esc(n)}">${esc(n)}</button>`).join(""):""}).join("");
  document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{if(window.CAS)CAS.view="list";if(window.RENTS){RENTS.view="list";RENTS.id=null}if(window.DOCS)DOCS.id=null;if(window.THERMAL)THERMAL.ed=null;if(window.ORG){ORG.path=[];ORG.data=null}go(b.dataset.n);$("#side").classList.remove("open")});
  go(a.includes(cur)?cur:a[0]);live()}
function live(){if(ch)sb.removeChannel(ch);
  ch=sb.channel("n005").on("postgres_changes",{event:"*",schema:"public",table:"profiles"},async()=>{
    const old=me;const p=await loadMe();if(!p||p.status!="active"){await out();return}
    if(p.photo_path!==old.photo_path)hdrAvatar();if(p.role!=old.role){enter();return}if(cur=="USER & ACCESS MANAGEMENT"&&!QUIETW())go(cur)})
  .on("postgres_changes",{event:"*",schema:"public",table:"password_requests"},()=>{if(cur=="USER & ACCESS MANAGEMENT")go(cur)}).subscribe()}
async function go(n){const v0=$("#view");if(lastMod!==n)v0.dataset.mod="";lastMod=n;cur=n;try{localStorage.setItem("n005_mod",n)}catch(e){}$("#ttl").textContent=n;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("on",b.dataset.n==n));
  const v=$("#view");
  if(window.MODS&&MODS[n])return MODS[n](v);
  if(n==ACC)return acct(v);if(n=="USER & ACCESS MANAGEMENT")return users(v);if(n=="BACK UP & RESTORE")return backup(v);
  v.innerHTML=`<div class="empty"><b>${esc(n)}</b><br>No records yet. This module is empty and ready to be configured.</div>`}

function acct(v){
  v.innerHTML=`<div class="split-2col">
    <div class="box" style="text-align:center;padding:24px 20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:14px;color:#fff">Profile Photo</div>
      <div style="display:flex;justify-content:center;margin-bottom:14px">
        <div class="avl" id="avl" tabindex="0" title="Click, drop an image, or press Ctrl+V to paste" style="width:130px;height:160px;margin:0 auto"></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px">
        <button class="ghost" id="avu" style="font-size:13px;padding:7px 14px">Upload photo</button>
        <button class="ghost" id="avr" style="font-size:13px;padding:7px 14px">Remove</button>
      </div>
      <div class="chip" style="font-size:11.5px;line-height:1.4">JPG, PNG, or WEBP. Click photo, drop image, or paste with <b>Ctrl + V</b>. Also shown on the Organizational Chart.</div>
      <div class="msg" id="avm" style="min-height:18px;color:var(--gold);margin-top:8px"></div>
      <div style="border-top:1px solid var(--line);margin-top:16px;padding-top:14px;text-align:left">
        <div style="font-size:11.5px;color:var(--mu);letter-spacing:.5px">ACCOUNT STATUS</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <b style="color:#fff">${esc(me.full_name)}</b>
          <span class="pill" style="background:#22c55e">Active</span>
        </div>
      </div>
    </div>

    <div class="box" style="padding:24px 22px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--line);padding-bottom:12px">
        <div>
          <div style="font-size:17px;font-weight:700;color:#fff">Account Details &amp; Security</div>
          <div class="chip">Manage your personal information and account credentials</div>
        </div>
        <span class="pill" style="background:var(--gold);color:#1a1300">${esc(ROLES[me.role])}</span>
      </div>

      <div class="form-grid-2">
        <div>
          <label>Full name</label>
          <input id="an" value="${esc(me.full_name)}" placeholder="Your full name" style="width:100%">
        </div>
        <div>
          <label>Username</label>
          <input value="${esc(me.username)}" disabled style="width:100%;opacity:.75">
        </div>
        <div>
          <label>System Role</label>
          <input value="${esc(ROLES[me.role])}" disabled style="width:100%;opacity:.75">
        </div>
        <div>
          <label>New password <span class="chip">(leave blank to keep current)</span></label>
          <input id="ap" type="password" autocomplete="new-password" placeholder="At least 8 characters" style="width:100%">
        </div>
      </div>

      <div style="display:flex;gap:12px;align-items:center;margin-top:20px;border-top:1px solid var(--line);padding-top:16px">
        <button class="btn" id="as" style="width:auto;padding:10px 24px;margin:0">Save changes</button>
        <div class="msg" id="am" style="color:var(--gold);font-weight:600"></div>
      </div>
    </div>
  </div>`;
  const paint=async()=>{const el=$("#avl");if(!el)return;el.style.backgroundImage="";el.textContent=ini(me.full_name);if(me.photo_path){const u=await PHOTO.signed(me.photo_path);if(u&&$("#avl")){$("#avl").style.backgroundImage=`url('${u}')`;$("#avl").textContent=""}}};paint();
  const up=async f=>{const m=$("#avm");if(!f||!/^image\//.test(f.type)){if(m)m.textContent="Please choose an image file.";return}if(f.size>20*1048576){m.textContent="That image is too large (max 20 MB).";return}
    m.style.color="var(--gold)";m.textContent="Uploading…";try{me.photo_path=await PHOTO.uploadProfile(me.id,f);m.textContent="Photo updated.";paint();hdrAvatar()}catch(e){m.style.color="#ff8b9b";m.textContent="Could not upload the photo."}};
  window.__accUp=up;const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=()=>{if(inp.files[0])up(inp.files[0]);inp.value=""};
  $("#avu").onclick=()=>inp.click();$("#avl").onclick=()=>inp.click();
  const av=$("#avl");av.ondragover=e=>{e.preventDefault();av.classList.add("over")};av.ondragleave=()=>av.classList.remove("over");av.ondrop=e=>{e.preventDefault();av.classList.remove("over");up([...e.dataTransfer.files][0])};
  $("#avr").onclick=async()=>{if(!me.photo_path)return;if(!confirm("Remove your profile photo?"))return;try{await PHOTO.removeProfile(me.id);me.photo_path=null;paint();hdrAvatar();$("#avm").textContent="Photo removed."}catch(e){$("#avm").textContent="Could not remove the photo."}};
  $("#as").onclick=async()=>{const m=$("#am"),p=$("#ap").value,n=$("#an").value.trim()||me.full_name;
    if(p&&p.length<MINPW)return m.textContent="Password must be at least "+MINPW+" characters.";
    let r=await sb.from("profiles").update({full_name:n}).eq("id",me.id);if(r.error)return m.textContent="Could not save.";
    if(p){r=await sb.auth.updateUser({password:p});if(r.error)return m.textContent=r.error.message}
    me.full_name=n;$("#who").textContent=n+" · "+ROLES[me.role];hdrAvatar();$("#ap").value="";m.textContent="Saved."}}
document.addEventListener("paste",e=>{if(cur!=ACC||!window.__accUp)return;const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type));if(f){e.preventDefault();window.__accUp(f)}});

let UQ="";
const AUDIT_KEY="north005_admin_audit_log";
function logAudit(action,details){
  try{
    const list=JSON.parse(localStorage.getItem(AUDIT_KEY)||"[]");
    list.unshift({at:new Date().toISOString(),by:me?me.username:"admin",action,details});
    if(list.length>100)list.pop();
    localStorage.setItem(AUDIT_KEY,JSON.stringify(list));
  }catch(e){}
}

function editUserModal(p,done){
  const d=document.createElement("dialog");
  d.innerHTML=`
    <h4 style="margin:0 0 6px">Edit Account — ${esc(p.full_name||p.username)}</h4>
    <div class="chip" style="margin-bottom:12px">Username: <b>${esc(p.username)}</b> · Created ${new Date(p.created_at).toLocaleDateString()}</div>
    
    <label>Full Name</label>
    <input id="eu-name" value="${esc(p.full_name||"")}" placeholder="Full Name">
    
    <div class="g2" style="margin-top:10px">
      <div>
        <label>System Role</label>
        <select id="eu-role">
          <option value="">— Assign Role —</option>
          ${Object.entries(ROLES).map(([k,l])=>`<option value="${k}"${k===p.role?' selected':''}>${l}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Account Status</label>
        <select id="eu-status">
          <option value="pending"${p.status==='pending'?' selected':''}>Pending Approval</option>
          <option value="active"${p.status==='active'?' selected':''}>Active</option>
          <option value="disabled"${p.status==='disabled'?' selected':''}>Disabled / Deactivated</option>
        </select>
      </div>
    </div>

    <label style="margin-top:10px">Assigned Area</label>
    <select id="eu-area">
      <option value="">— None / Unassigned —</option>
      <option value="DDN"${p.area==='DDN'?' selected':''}>Davao del Norte (DDN)</option>
      <option value="SAMAL"${p.area==='SAMAL'?' selected':''}>Samal</option>
    </select>
    
    <div class="msg" id="eu-msg"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn" id="eu-save">Save Changes</button>
      <button class="ghost" id="eu-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(d);
  d.showModal();
  const m=d.querySelector("#eu-msg");
  const close=()=>{d.close();d.remove()};
  d.querySelector("#eu-cancel").onclick=close;

  d.querySelector("#eu-save").onclick=async()=>{
    const name=d.querySelector("#eu-name").value.trim();
    const role=d.querySelector("#eu-role").value||null;
    const status=d.querySelector("#eu-status").value;
    const area=d.querySelector("#eu-area").value||null;

    if(!name)return m.textContent="Full name is required.";
    if(status==="active"&&!role)return m.textContent="Please assign a system role before activating this account.";

    m.style.color="var(--gold)";m.textContent="Saving user account…";
    const{error}=await sb.from("profiles").update({full_name:name,role,status,area}).eq("id",p.id);
    if(error){
      m.style.color="#ff8b9b";
      return m.textContent="Could not update account: "+error.message;
    }

    logAudit("EDIT_USER",`Updated ${p.username}: name="${name}", role="${role}", status="${status}", area="${area}"`);
    if(p.id===me.id){
      me.full_name=name;me.role=role;me.area=area;
      $("#who").textContent=name+" · "+ROLES[role];
    }
    if(window.PERSONNEL&&typeof window.PERSONNEL.load==="function"){
      await window.PERSONNEL.load(true);
    }
    close();
    done();
  };
}

async function removeUserModal(p,done){
  if(p.id===me.id){
    alert("You cannot remove or deactivate your own administrator account.");
    return;
  }

  // Check for historical transactions (Cash advances, payments, attendance)
  const[caRes,attRes]=await Promise.all([
    sb.from("cash_advances").select("id").or(`collector_id.eq.${p.id},created_by.eq.${p.id}`).limit(1),
    sb.from("attendance").select("id").eq("user_id",p.id).limit(1)
  ]);
  const hasHistory=(caRes.data&&caRes.data.length>0)||(attRes.data&&attRes.data.length>0);

  const d=document.createElement("dialog");
  d.innerHTML=`
    <h4 style="margin:0 0 6px">Remove or Deactivate Account</h4>
    <div class="chip" style="margin-bottom:12px">User: <b>${esc(p.full_name||p.username)}</b> (@${esc(p.username)}) · ${ROLES[p.role]||"No Role"}</div>
    
    ${hasHistory?`
      <div class="warn2" style="margin-bottom:12px">
        <b>Data Integrity Protection:</b> This account is linked to historical operational/financial records (Cash Advances, Payments, or Attendance).
        <p style="margin:4px 0 0;font-size:12.5px;color:var(--tx)">To preserve financial history and audit compliance, this account will be <b>Deactivated (Disabled)</b> instead of permanently deleted.</p>
      </div>
    `:`
      <p style="font-size:13.5px;line-height:1.5">You can deactivate this account to prevent login, or permanently remove it if no historical records exist.</p>
    `}

    <div class="msg" id="rm-msg"></div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn" id="rm-deact" style="background:#f59e0b;color:#1a1300">Deactivate Account (Safe)</button>
      ${!hasHistory?`<button class="ghost" id="rm-delete" style="color:#ef4444;border-color:#ef4444">Permanent Delete</button>`:''}
      <button class="ghost" id="rm-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(d);
  d.showModal();
  const m=d.querySelector("#rm-msg");
  const close=()=>{d.close();d.remove()};
  d.querySelector("#rm-cancel").onclick=close;

  d.querySelector("#rm-deact").onclick=async()=>{
    m.style.color="var(--gold)";m.textContent="Deactivating account…";
    const{error}=await sb.from("profiles").update({status:"disabled"}).eq("id",p.id);
    if(error){m.style.color="#ff8b9b";return m.textContent="Failed: "+error.message}
    logAudit("DEACTIVATE_USER",`Deactivated user @${p.username} (${p.full_name}). Financial history preserved.`);
    if(window.PERSONNEL)await window.PERSONNEL.load(true);
    close();
    done();
  };

  const delBtn=d.querySelector("#rm-delete");
  if(delBtn){
    delBtn.onclick=async()=>{
      if(!confirm(`Are you completely sure you want to PERMANENTLY remove @${p.username}? This cannot be undone.`))return;
      m.style.color="var(--gold)";m.textContent="Removing account…";
      const r=await sb.rpc("admin_delete_user",{target:p.id});
      if(r.error){
        m.style.color="#f59e0b";
        m.textContent="Database constraint prevented deletion. Deactivating account safely instead…";
        await sb.from("profiles").update({status:"disabled"}).eq("id",p.id);
        logAudit("DEACTIVATE_USER_FALLBACK",`Deactivated @${p.username} (FK constraint prevented hard delete).`);
        setTimeout(()=>{close();done()},1200);
        return;
      }
      logAudit("DELETE_USER",`Permanently deleted user @${p.username}`);
      close();
      done();
    };
  }
}

async function users(v){
  const[P,R]=await Promise.all([sb.from("profiles").select("*").order("created_at"),sb.from("password_requests").select("*").eq("status","open").order("created_at")]);
  const ps=P.data||[],rq=R.data||[],find=id=>ps.find(x=>x.id==id);
  const opt=(o,s,blank)=>(blank?`<option value="">— assign —</option>`:"")+Object.entries(o).map(([k,l])=>`<option value="${k}"${k==s?" selected":""}>${l}</option>`).join("");
  
  const draw=()=>{
    const q=UQ.toLowerCase(),list=ps.filter(x=>!q||[x.full_name,x.username,ROLES[x.role]||"",x.status,x.area||""].join(" ").toLowerCase().includes(q)),pend=ps.filter(x=>x.status=="pending").length,pg=PAGER.paginate("users",list);

    v.innerHTML=(rq.length?`<h4 class="h">Password requests (${rq.length})</h4><div class="tw"><table><tbody>${rq.map(r=>`<tr><td>${esc(r.username)}</td><td>${new Date(r.created_at).toLocaleString()}</td><td><button class="ghost" data-pr="${r.user_id}" data-pn="${esc(r.username)}">Reset password</button></td></tr>`).join("")}</tbody></table></div>`:"")+
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h4 class="h" style="margin:0">User &amp; Access Management (${ps.length})${pend?` · <span style="color:var(--gold)">${pend} awaiting approval</span>`:""}</h4>
    </div>
    <div class="tbar"><input id="uq" placeholder="Search name, username, role, area…" value="${esc(UQ)}"></div>
    <div class="tw">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Area</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${pg.slice.map(x=>{
            const self=x.id==me.id;
            const stColor=x.status==="active"?"#22c55e":x.status==="disabled"?"#ef4444":"#f59e0b";
            return `<tr>
              <td><b>${esc(x.full_name)}</b></td>
              <td>${esc(x.username)}</td>
              <td><span class="chip" style="font-weight:600">${esc(ROLES[x.role]||"— none —")}</span></td>
              <td>${esc(x.area||"—")}</td>
              <td><span class="pill" style="background:${stColor};color:#fff">${esc(x.status)}</span></td>
              <td style="white-space:nowrap">
                <button class="ghost" data-edit-user="${x.id}" style="padding:4px 9px;font-size:12.5px">Edit</button>
                ${self?"":`
                  <button class="ghost" data-pr="${x.id}" data-pn="${esc(x.username)}" style="padding:4px 9px;font-size:12.5px">Reset Password</button>
                  <button class="ghost" data-rm-user="${x.id}" style="padding:4px 9px;font-size:12.5px;color:#ef4444">Remove</button>
                `}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`+(list.length?pg.bar:'<div class="empty" style="margin-top:10px">No matching accounts.</div>');

    PAGER.bind(v,pg.st,draw);
    const qi=$("#uq");
    qi.oninput=e=>{UQ=e.target.value;PAGER.reset("users");draw();const n=$("#uq");n.focus();n.setSelectionRange(UQ.length,UQ.length)};

    v.querySelectorAll("[data-edit-user]").forEach(e=>e.onclick=()=>{
      const p=find(e.dataset.editUser);
      if(p)editUserModal(p,()=>users(v));
    });

    v.querySelectorAll("[data-rm-user]").forEach(e=>e.onclick=()=>{
      const p=find(e.dataset.rmUser);
      if(p)removeUserModal(p,()=>users(v));
    });

    v.querySelectorAll("[data-pr]").forEach(e=>e.onclick=async()=>{
      const t=prompt("Temporary password for "+e.dataset.pn+" (min 8 characters). They must change it at next login.");
      if(!t)return;
      if(t.length<MINPW)return alert("The temporary password must be at least "+MINPW+" characters.");
      const r=await sb.rpc("admin_reset_password",{target:e.dataset.pr,temp_pw:t});
      if(r.error)alert("Failed: "+r.error.message);
      else{
        logAudit("RESET_PASSWORD",`Set temporary password for @${e.dataset.pn}`);
        alert("Done. Give "+e.dataset.pn+" the temporary password.");
      }
    });
  };
  draw();
}

function backup(v){v.innerHTML=`<div class="split-half">
  <div class="box">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px">📥 Download Offline Backup</div>
    <p style="color:var(--mu);font-size:13.5px;line-height:1.5;margin-bottom:16px">All data lives in your Supabase database and is shared by every user and device. Use this to download an offline JSON copy of accounts and roles.</p>
    <button class="btn" id="bd" style="width:auto;padding:10px 22px">Download backup</button>
    <div class="msg" id="bm" style="color:var(--gold);margin-top:10px"></div>
  </div>
  <div class="box">
    <div style="font-size:16px;font-weight:700;margin-bottom:8px">📤 Restore from Backup File</div>
    <p style="color:var(--mu);font-size:13.5px;line-height:1.5;margin-bottom:14px">Restore from a backup JSON file (updates names, roles, and status of existing accounts).</p>
    <label style="margin-bottom:6px">Select JSON file</label>
    <input type="file" id="rf" accept=".json" style="width:100%">
  </div>
</div>`;
  $("#bd").onclick=async()=>{const r=await sb.from("profiles").select("username,full_name,role,status,created_at");if(r.error)return $("#bm").textContent="Backup failed.";
    const at=new Date().toISOString(),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({app:"north005",at,profiles:r.data},null,1)],{type:"application/json"}));a.download="north005-backup-"+at.slice(0,10)+".json";a.click();$("#bm").textContent="Backup downloaded."};
  $("#rf").onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());if(j.app!="north005")throw 0;let n=0;
    for(const p of j.profiles||[]){const r=await sb.from("profiles").update({full_name:p.full_name,role:p.role,status:p.status}).eq("username",p.username);if(!r.error)n++}
    $("#bm").textContent="Restored "+n+" account(s)."}catch(x){$("#bm").textContent="Invalid backup file."}}}

function confirmLogout(){const dlg=$("#dlg-logout");if(dlg){dlg.classList.remove("modal-closing");dlg.showModal()}}
function closeLogoutConfirm(){const dlg=$("#dlg-logout");if(!dlg||!dlg.open)return;dlg.classList.add("modal-closing");setTimeout(()=>{try{dlg.close()}catch(e){}dlg.classList.remove("modal-closing")},200)}
async function doLogout(){closeLogoutConfirm();await quiet();clear();me=null;cur=null;try{localStorage.removeItem("n005_mod")}catch(e){}if(ch){sb.removeChannel(ch);ch=null}showPostLogout()}
async function out(){confirmLogout()}
$("#out").onclick=confirmLogout;$("#menu").onclick=()=>$("#side").classList.toggle("open");
$("#btn-cancel-logout")?.addEventListener("click",closeLogoutConfirm);
$("#btn-confirm-logout")?.addEventListener("click",doLogout);
$("#dlg-logout")?.addEventListener("click",e=>{if(e.target===$("#dlg-logout"))closeLogoutConfirm()});
$("#dlg-logout")?.addEventListener("cancel",e=>{e.preventDefault();closeLogoutConfirm()});
sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT"&&me&&!LO){me=null;cur=null;if(ch){sb.removeChannel(ch);ch=null}$("#out-done")?.classList.add("hide");$("#frm")?.classList.remove("hide");tab("L");show("auth");setMsg("Your session ended. Please log in again.")}});
document.querySelectorAll(".eye").forEach(b=>b.onclick=()=>{const i=b.previousElementSibling,s=i.type=="password";i.type=s?"text":"password";b.classList.toggle("on",s);b.setAttribute("aria-label",s?"Hide password":"Show password")});
(()=>{const P=$("#parts");for(let i=0;i<22;i++){const e=document.createElement("i"),s=3+Math.random()*7;e.style.cssText=`left:${Math.random()*100}%;width:${s}px;height:${s}px;animation-duration:${9+Math.random()*12}s;animation-delay:${-Math.random()*14}s;--dx:${Math.round(Math.random()*80-40)}px`;P.appendChild(e)}
  [...document.querySelector("#frm").children].forEach((e,i)=>e.style.setProperty("--n",i))})();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{show("boot");
  const toLogin=m=>{$("#out-done")?.classList.add("hide");$("#dn")?.classList.add("hide");$("#frm")?.classList.remove("hide");show("auth");if(m)setMsg(m)};
  try{
    const{data:{session}}=await sb.auth.getSession();if(!session)return toLogin("");
    let p=null,err=null;
    for(let i=0;i<3&&!p;i++){const r=await sb.from("profiles").select("*").eq("id",session.user.id).maybeSingle();p=r.data;err=r.error;if(!p&&err&&i<2)await wait(700*(i+1));else if(!p&&!err)break}
    if(!p){if(err){toLogin("Could not reach the server. Check your connection, then reload this page.");return}
      await sb.auth.signOut();return toLogin("Your account could not be found. Please log in again.")}
    if(p.status!="active"){await sb.auth.signOut();return toLogin(p.status=="pending"?"Your account is still awaiting approval.":"This account is disabled. Contact the Administrator.")}
    me=p;if(p.must_change){tab("C");toLogin("Set a new password to continue.");$("#msg").style.color="#8fe3a8";return}
    try{const sv=localStorage.getItem("n005_mod");if(sv)cur=sv}catch(e){}
    enter();
  }catch(e){toLogin("Could not restore your session. Please log in.")}
})();
