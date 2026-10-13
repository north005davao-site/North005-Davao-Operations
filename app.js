const SB_URL="https://aplntnljisjpjvfblvlu.supabase.co",SB_KEY="sb_publishable_CnYeee1LF3BwV55pjUUsOw_6PT8-u9_";
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}),$=s=>document.querySelector(s);
const G=[["CORE OPERATIONS",["DASHBOARD","MASTER REGISTRY","SALES & COLLECTION","ETS LIVE TRACKING"]],
["FINANCE & PROPERTY",["CASH ADVANCE (C.A) & PAYMENTS","OUTLET RENTALS & LOAD ALLOWANCE"]],
["WORKFORCE & TOOLS",["USER & ACCESS MANAGEMENT","ATTENDANCE / WORKFORCE MONITORING","ORGANIZATIONAL CHART","EMPLOYEE DOCUMENTS","THERMAL PAPER DAILY SUMMARY"]],
["SYSTEM ADMINISTRATION",["BACK UP & RESTORE"]],["PROFILE",["MY ACCOUNT"]]];
const ROLES={admin:"Operations Administrator",supervisor:"Field Sales Supervisor",collector:"Field Sales Collector",rep:"Sales Representative",reliever:"Reliever"};
const CORE=G[0][1],FIN=G[1][1],CA="CASH ADVANCE (C.A) & PAYMENTS",ATT="ATTENDANCE / WORKFORCE MONITORING",ACC="MY ACCOUNT";
const ALLOW={admin:null,supervisor:[...CORE,...FIN,ACC],collector:[CA,ACC],rep:[ATT,ACC],reliever:[ATT,ACC]};
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
function tab(m){const prev=mode;mode=m;
  const vis=(id,on)=>{const e=$("#"+id),was=!e.classList.contains("hide");e.classList.toggle("hide",!on);if(on&&!was)pop(e)};
  vis("fN",m=="S");vis("fU",m!="C");vis("fP",m!="F");vis("fC",m=="S"||m=="C");vis("ph",m=="S"||m=="C");
  $("#fg").classList.toggle("hide",m!="L");$("#bk").classList.toggle("hide",m!="F"&&m!="C");
  $("#sw").classList.toggle("hide",m=="F"||m=="C");$("#sw").textContent=m=="S"?"Already have an account? Login":"No account yet? Sign up";
  setLabel();$("#sub").textContent={L:"Sign in to your account",S:"Create your account",F:"Request a password reset",C:"Choose a new password"}[m];pop($("#sub"));
  $("#pwl").textContent=m=="C"?"New password":"Password";if(prev!=m){$("#pw").value=$("#pw2").value=""}setMsg("")}
$("#sw").onclick=()=>tab(mode=="S"?"L":"S");$("#fg").onclick=()=>tab("F");$("#bk").onclick=async()=>{if(mode=="C"){await quiet()}tab("L")};
async function loadMe(){const{data:{user}}=await sb.auth.getUser();if(!user)return null;const{data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();me=data;return data}
function showDone(){$("#frm").classList.add("hide");pop($("#dn"));$("#dn").classList.remove("hide")}
$("#dnb").onclick=()=>{$("#dn").classList.add("hide");$("#frm").classList.remove("hide");tab("L")};

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
function enter(){show("app");$("#who").textContent=me.full_name+" · "+ROLES[me.role];
  const a=allowed();$("#navs").innerHTML=G.map(([g,it])=>{const f=it.filter(n=>a.includes(n));return f.length?`<div class="grp">${g}</div>`+f.map(n=>`<button class="nav" data-n="${esc(n)}">${esc(n)}</button>`).join(""):""}).join("");
  document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{if(window.CAS)CAS.view="list";if(window.DOCS)DOCS.id=null;if(window.THERMAL)THERMAL.ed=null;if(window.ORG){ORG.path=[];ORG.data=null}go(b.dataset.n);$("#side").classList.remove("open")});
  go(a.includes(cur)?cur:a[0]);live()}
function live(){if(ch)sb.removeChannel(ch);
  ch=sb.channel("n005").on("postgres_changes",{event:"*",schema:"public",table:"profiles"},async()=>{
    const old=me;const p=await loadMe();if(!p||p.status!="active"){await out();return}
    if(p.role!=old.role){enter();return}if(cur=="USER & ACCESS MANAGEMENT")go(cur)})
  .on("postgres_changes",{event:"*",schema:"public",table:"password_requests"},()=>{if(cur=="USER & ACCESS MANAGEMENT")go(cur)}).subscribe()}
async function go(n){cur=n;try{localStorage.setItem("n005_mod",n)}catch(e){}$("#ttl").textContent=n;document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("on",b.dataset.n==n));
  const v=$("#view");
  if(window.MODS&&MODS[n])return MODS[n](v);
  if(n==ACC)return acct(v);if(n=="USER & ACCESS MANAGEMENT")return users(v);if(n=="BACK UP & RESTORE")return backup(v);
  v.innerHTML=`<div class="empty"><b>${esc(n)}</b><br>No records yet. This module is empty and ready to be configured.</div>`}

function acct(v){v.innerHTML=`<div class="box"><label>Full name</label><input id="an" value="${esc(me.full_name)}"><label>Username</label><input value="${esc(me.username)}" disabled><label>Role</label><input value="${esc(ROLES[me.role])}" disabled>
<label>New password (leave blank to keep)</label><input id="ap" type="password" autocomplete="new-password"><button class="btn" id="as">Save changes</button><div class="msg" id="am" style="color:var(--gold)"></div></div>`;
  $("#as").onclick=async()=>{const m=$("#am"),p=$("#ap").value,n=$("#an").value.trim()||me.full_name;
    if(p&&p.length<MINPW)return m.textContent="Password must be at least "+MINPW+" characters.";
    let r=await sb.from("profiles").update({full_name:n}).eq("id",me.id);if(r.error)return m.textContent="Could not save.";
    if(p){r=await sb.auth.updateUser({password:p});if(r.error)return m.textContent=r.error.message}
    me.full_name=n;$("#who").textContent=n+" · "+ROLES[me.role];$("#ap").value="";m.textContent="Saved."}}

let UQ="";
async function users(v){
  const[P,R]=await Promise.all([sb.from("profiles").select("*").order("created_at"),sb.from("password_requests").select("*").eq("status","open").order("created_at")]);
  const ps=P.data||[],rq=R.data||[],find=id=>ps.find(x=>x.id==id);
  const opt=(o,s,blank)=>(blank?`<option value="">— assign —</option>`:"")+Object.entries(o).map(([k,l])=>`<option value="${k}"${k==s?" selected":""}>${l}</option>`).join("");
  const draw=()=>{
    const q=UQ.toLowerCase(),list=ps.filter(x=>!q||[x.full_name,x.username,ROLES[x.role]||"",x.status].join(" ").toLowerCase().includes(q)),pend=ps.filter(x=>x.status=="pending").length,pg=PAGER.paginate("users",list);
    v.innerHTML=(rq.length?`<h4 class="h">Password requests (${rq.length})</h4><div class="tw"><table><tbody>${rq.map(r=>`<tr><td>${esc(r.username)}</td><td>${new Date(r.created_at).toLocaleString()}</td><td><button class="ghost" data-pr="${r.user_id}" data-pn="${esc(r.username)}">Reset password</button></td></tr>`).join("")}</tbody></table></div>`:"")+
    `<h4 class="h">Accounts (${ps.length})${pend?` · <span style="color:var(--gold)">${pend} awaiting approval</span>`:""}</h4><div class="tbar"><input id="uq" placeholder="Search name, username, role…" value="${esc(UQ)}"></div><div class="tw"><table><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>${pg.slice.map(x=>{const self=x.id==me.id;return `<tr><td>${esc(x.full_name)}</td><td>${esc(x.username)}</td>
    <td>${self?ROLES[x.role]:`<select data-r="${x.id}">${opt(ROLES,x.role,1)}</select>`}</td><td>${self?"active":`<select data-s="${x.id}">${opt({pending:"pending",active:"active",disabled:"disabled"},x.status)}</select>`}</td>
    <td>${self?"":`<button class="ghost" data-pr="${x.id}" data-pn="${esc(x.username)}">Reset password</button> <button class="ghost" data-d="${x.id}" data-pn="${esc(x.username)}">Remove</button>`}</td></tr>`}).join("")}</tbody></table></div>`+(list.length?pg.bar:'<div class="empty" style="margin-top:10px">No matching accounts.</div>');
    PAGER.bind(v,pg.st,draw);
    const qi=$("#uq");qi.oninput=e=>{UQ=e.target.value;PAGER.reset("users");draw();const n=$("#uq");n.focus();n.setSelectionRange(UQ.length,UQ.length)};
    v.querySelectorAll("[data-r]").forEach(e=>e.onchange=async()=>{const r=await sb.from("profiles").update({role:e.value||null}).eq("id",e.dataset.r);if(r.error)alert("Could not change role.");else find(e.dataset.r).role=e.value||null});
    v.querySelectorAll("[data-s]").forEach(e=>e.onchange=async()=>{const p=find(e.dataset.s);if(e.value=="active"&&!p.role){alert("Assign a role first.");e.value=p.status;return}
      const r=await sb.from("profiles").update({status:e.value}).eq("id",p.id);if(r.error)alert("Could not change status.");else p.status=e.value});
    v.querySelectorAll("[data-pr]").forEach(e=>e.onclick=async()=>{const t=prompt("Temporary password for "+e.dataset.pn+" (min 8 characters). They must change it at next login.");if(!t)return;if(t.length<MINPW)return alert("The temporary password must be at least "+MINPW+" characters.");
      const r=await sb.rpc("admin_reset_password",{target:e.dataset.pr,temp_pw:t});alert(r.error?"Failed: "+r.error.message:"Done. Give "+e.dataset.pn+" the temporary password.")});
    v.querySelectorAll("[data-d]").forEach(e=>e.onclick=async()=>{if(!confirm("Permanently remove "+e.dataset.pn+"?"))return;const r=await sb.rpc("admin_delete_user",{target:e.dataset.d});if(r.error)alert(r.error.message)})};
  draw()}

function backup(v){v.innerHTML=`<div class="box"><p>All data lives in your Supabase database and is shared by every user and device. Use this for an offline copy.</p><button class="btn" id="bd">Download backup</button>
<label>Restore from backup file (updates names, roles and status of existing accounts)</label><input type="file" id="rf" accept=".json"><div class="msg" id="bm" style="color:var(--gold)"></div></div>`;
  $("#bd").onclick=async()=>{const r=await sb.from("profiles").select("username,full_name,role,status,created_at");if(r.error)return $("#bm").textContent="Backup failed.";
    const at=new Date().toISOString(),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify({app:"north005",at,profiles:r.data},null,1)],{type:"application/json"}));a.download="north005-backup-"+at.slice(0,10)+".json";a.click();$("#bm").textContent="Backup downloaded."};
  $("#rf").onchange=async e=>{try{const j=JSON.parse(await e.target.files[0].text());if(j.app!="north005")throw 0;let n=0;
    for(const p of j.profiles||[]){const r=await sb.from("profiles").update({full_name:p.full_name,role:p.role,status:p.status}).eq("username",p.username);if(!r.error)n++}
    $("#bm").textContent="Restored "+n+" account(s)."}catch(x){$("#bm").textContent="Invalid backup file."}}}

async function out(){await quiet();clear();me=null;cur=null;try{localStorage.removeItem("n005_mod")}catch(e){}if(ch){sb.removeChannel(ch);ch=null}tab("L");show("auth")}
$("#out").onclick=out;$("#menu").onclick=()=>$("#side").classList.toggle("open");
sb.auth.onAuthStateChange(ev=>{if(ev==="SIGNED_OUT"&&me&&!LO){me=null;cur=null;if(ch){sb.removeChannel(ch);ch=null}tab("L");show("auth");setMsg("Your session ended. Please log in again.")}});
document.querySelectorAll(".eye").forEach(b=>b.onclick=()=>{const i=b.previousElementSibling,s=i.type=="password";i.type=s?"text":"password";b.classList.toggle("on",s);b.setAttribute("aria-label",s?"Hide password":"Show password")});
(()=>{const P=$("#parts");for(let i=0;i<22;i++){const e=document.createElement("i"),s=3+Math.random()*7;e.style.cssText=`left:${Math.random()*100}%;width:${s}px;height:${s}px;animation-duration:${9+Math.random()*12}s;animation-delay:${-Math.random()*14}s;--dx:${Math.round(Math.random()*80-40)}px`;P.appendChild(e)}
  [...document.querySelector("#frm").children].forEach((e,i)=>e.style.setProperty("--n",i))})();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{show("boot");
  const toLogin=m=>{show("auth");if(m)setMsg(m)};
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
