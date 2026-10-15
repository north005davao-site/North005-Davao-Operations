(()=>{
const TZ="Asia/Manila",NAME="ATTENDANCE / WORKFORCE MONITORING";
const ROLES={rep:"Sales Representative",reliever:"Reliever"};
const A={date:null,role:"",q:"",sub:false,tick:null};window.ATT=A;
const today=()=>new Date().toLocaleDateString("en-CA",{timeZone:TZ});
const tm=t=>t?new Date(t).toLocaleTimeString("en-PH",{timeZone:TZ,hour:"numeric",minute:"2-digit"}):"—";
const fdate=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString("en-PH",{timeZone:"UTC",weekday:"short",month:"short",day:"numeric",year:"numeric"})};
const hrs=(a,b)=>{if(!a)return"—";if(!b)return"In progress";const m=Math.max(0,Math.round((new Date(b)-new Date(a))/60000));return Math.floor(m/60)+"h "+String(m%60).padStart(2,"0")+"m"};
const loc=(la,ln)=>la!=null?`<a href="https://www.google.com/maps?q=${la},${ln}" target="_blank" rel="noopener" style="color:var(--gold)">📍 Map</a>`:'<span style="color:var(--mu)">no location</span>';
const ERR={ALREADY_IN:"You already timed in today.",NOT_IN:"You have no open time-in for today.",BOOTH_REQUIRED:"Choose the booth you are covering today.",NOT_ALLOWED:"Your account can't use attendance."};
const emsg=e=>{const m=(e&&e.message)||"";for(const k in ERR)if(m.includes(k))return ERR[k];return "Something went wrong. Please try again."};
function subscribe(){if(A.sub)return;A.sub=true;let t;sb.channel("att").on("postgres_changes",{event:"*",schema:"public",table:"attendance"},()=>{clearTimeout(t);t=setTimeout(()=>{if(!QUIETW()&&cur==NAME&&!document.querySelector("dialog[open]"))go(cur)},600)}).subscribe()}
function getPos(){return new Promise(res=>{if(!navigator.geolocation)return res(null);navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy}),()=>res(null),{enableHighAccuracy:true,timeout:15000,maximumAge:0})})}

async function att(v){subscribe();clearInterval(A.tick);return me.role=="admin"?monitor(v):mine(v)}

async function mine(v){
  const td=today();LOAD(v);
  const{data}=await sb.from("attendance").select("*").order("work_date",{ascending:false}).range(0,399);const rows=data||[],t0=rows.find(r=>r.work_date==td);
  const rel=me.role=="reliever";let booths=[];
  if(rel&&!t0){const r=await sb.rpc("booth_options");booths=r.data||[]}
  const state=!t0?"out":t0.time_out?"done":"in";
  v.innerHTML=`<div class="box" style="max-width:520px;margin:0 auto 16px;text-align:center"><div class="chip">${fdate(td)}</div><div id="clk" style="font-size:38px;font-weight:700;margin:6px 0">--:--</div>
  <div style="margin-bottom:12px">${state=="out"?"You have not timed in yet.":state=="in"?`Timed in at <b>${tm(t0.time_in)}</b>${t0.booth_code?" · Booth <b>"+esc(t0.booth_code)+"</b>":""}`:`Done for today · ${tm(t0.time_in)} – ${tm(t0.time_out)} (${hrs(t0.time_in,t0.time_out)})`}</div>
  ${state=="out"&&rel?`<label style="text-align:left">Booth you are covering today</label><input id="bth" list="bl3" placeholder="Type or pick a booth code" style="margin-bottom:8px"><datalist id="bl3">${booths.map(b=>`<option value="${esc(b.booth_code)}">${esc(b.sr_name||"")}</option>`).join("")}</datalist>`:""}
  ${state!="done"?`<button class="btn" id="ab" style="font-size:17px;padding:14px;margin-top:4px">${state=="out"?"Time In":"Time Out"}</button>`:""}<div class="msg" id="am2" style="min-height:20px"></div></div>
  <h4 class="h">My attendance</h4><div id="ah"></div>`;
  const clk=()=>{$("#clk")&&($("#clk").textContent=new Date().toLocaleTimeString("en-PH",{timeZone:TZ,hour:"numeric",minute:"2-digit",second:"2-digit"}))};clk();A.tick=setInterval(()=>{if(cur!=NAME||!$("#clk"))return clearInterval(A.tick);clk()},1000);
  if($("#ab"))$("#ab").onclick=async()=>{const b=$("#ab"),m=$("#am2");let booth=null;
    if(state=="out"&&rel){booth=$("#bth").value.trim().toUpperCase();if(!booths.some(x=>x.booth_code==booth))return m.textContent=ERR.BOOTH_REQUIRED}
    b.disabled=true;m.style.color="var(--gold)";m.textContent="Getting your location…";let p=await getPos();
    if(!p){if(!confirm("Your location could not be read. Record without location?\n\nTip: allow location access for this site in your browser settings.")){b.disabled=false;m.textContent="";return}p={lat:null,lng:null,acc:null}}
    m.textContent="Saving…";const args={p_lat:p.lat,p_lng:p.lng,p_acc:p.acc};
    const r=state=="out"?await sb.rpc("clock_in",{...args,p_booth:booth}):await sb.rpc("clock_out",args);
    if(r.error){b.disabled=false;m.style.color="#ff8b9b";return m.textContent=emsg(r.error)}att(v)};
  const draw=()=>{const pg=PAGER.paginate("att_me",rows);$("#ah").innerHTML=rows.length?`<div class="tw"><table><thead><tr><th>Date</th><th>Time in</th><th>Time out</th><th>Hours</th>${rel?"<th>Booth</th>":""}<th>Location</th></tr></thead><tbody>${pg.slice.map(r=>`<tr><td>${fdate(r.work_date)}</td><td>${tm(r.time_in)}</td><td>${tm(r.time_out)}</td><td>${hrs(r.time_in,r.time_out)}</td>${rel?`<td>${esc(r.booth_code||"")}</td>`:""}<td>${loc(r.in_lat,r.in_lng)}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="empty">No attendance yet.</div>';PAGER.bind($("#ah"),pg.st,draw)};draw()}

async function monitor(v){
  if(!A.date)A.date=today();
  LOAD(v);
  const[P,R]=await Promise.all([sb.from("profiles").select("id,full_name,username,role").in("role",["rep","reliever"]).eq("status","active").range(0,999),sb.from("attendance").select("*").eq("work_date",A.date).range(0,999)]);
  const staff=P.data||[],rec=new Map((R.data||[]).map(r=>[r.user_id,r]));
  const rows=staff.map(s=>({s,r:rec.get(s.id)})).sort((a,b)=>(a.r?0:1)-(b.r?0:1)||(a.s.full_name||"").localeCompare(b.s.full_name||""));
  const inn=rows.filter(x=>x.r).length,out=rows.filter(x=>x.r&&x.r.time_out).length;
  v.innerHTML=`<div class="tbar"><input type="date" id="ad" value="${A.date}" style="max-width:170px"><button class="ghost" id="at">Today</button><select id="ar"><option value="">All roles</option><option value="rep"${A.role=="rep"?" selected":""}>Sales Representatives</option><option value="reliever"${A.role=="reliever"?" selected":""}>Relievers</option></select><input id="aq" placeholder="Search name…" value="${esc(A.q)}"><span class="live"><i></i>Live</span></div>
  <div class="kpis" style="margin-bottom:14px"><div class="kpi"><small>Active staff</small><b>${rows.length}</b></div><div class="kpi"><small>Timed in</small><b>${inn}</b></div><div class="kpi"><small>Timed out</small><b>${out}</b></div><div class="kpi"><small>Not timed in</small><b>${rows.length-inn}</b></div></div><div id="at2"></div>`;
  $("#ad").onchange=e=>{A.date=e.target.value||today();PAGER.reset("att_ad");monitor(v)};$("#at").onclick=()=>{A.date=today();monitor(v)};
  $("#ar").onchange=e=>{A.role=e.target.value;PAGER.reset("att_ad");draw()};$("#aq").oninput=e=>{A.q=e.target.value;PAGER.reset("att_ad");draw()};
  const draw=()=>{const q=A.q.toLowerCase(),f=rows.filter(x=>(!A.role||x.s.role==A.role)&&(!q||(x.s.full_name+" "+x.s.username).toLowerCase().includes(q))),pg=PAGER.paginate("att_ad",f);
    $("#at2").innerHTML=f.length?`<div class="tw"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Time in</th><th>Time out</th><th>Hours</th><th>Booth covered</th><th>In</th><th>Out</th><th></th></tr></thead><tbody>${pg.slice.map(({s,r})=>`<tr><td><b>${esc(s.full_name||s.username)}</b></td><td>${ROLES[s.role]}</td><td>${r?(r.time_out?'<span class="pill" style="background:#22c55e">Done</span>':'<span class="pill" style="background:#06b6d4">On duty</span>'):'<span class="pill" style="background:#94a3b8">No record</span>'}</td><td>${r?tm(r.time_in):"—"}</td><td>${r?tm(r.time_out):"—"}</td><td>${r?hrs(r.time_in,r.time_out):"—"}</td><td>${esc(r?.booth_code||"")}</td><td>${r?loc(r.in_lat,r.in_lng):""}</td><td>${r&&r.time_out?loc(r.out_lat,r.out_lng):""}</td><td>${r?`<button class="ghost" data-x="${r.id}">Delete</button>`:""}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="empty"><b>ATTENDANCE</b><br>No active Sales Representatives or Relievers yet.</div>';
    $("#at2").querySelectorAll("[data-x]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this attendance record?"))return;const{error}=await sb.from("attendance").delete().eq("id",b.dataset.x);if(error)return alert("Could not delete.");monitor(v)});PAGER.bind($("#at2"),pg.st,draw)};draw()}

window.MODS=Object.assign(window.MODS||{},{[NAME]:att});
})();
