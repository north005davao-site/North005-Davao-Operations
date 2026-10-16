(()=>{
const NAME="ORGANIZATIONAL CHART";
const O={q:"",sub:false};window.ORG=O;
const MU=()=>window.MUNI||{};
const areaOf=m=>m=="SAMAL"?"SAMAL":"DDN",AL={DDN:"Davao del Norte",SAMAL:"Samal"};
const num=c=>parseInt(String(c||"").replace(/\D/g,""))||0;
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
function subscribe(){if(O.sub)return;O.sub=true;let t;const f=()=>{clearTimeout(t);t=setTimeout(()=>{if(cur==NAME)go(cur)},800)};let c=sb.channel("org");["profiles","registry_outlets","registry_relievers"].forEach(x=>c=c.on("postgres_changes",{event:"*",schema:"public",table:x},f));c.subscribe()}
const ini=s=>String(s||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const node=(color,label,sub,count,open,kids,flag)=>`<details class="on"${open?" open":""}><summary><span class="av" style="background:${color}">${esc(ini(label))}</span><span class="nt"><b>${label}</b>${sub?`<small>${sub}</small>`:""}</span>${count!=null?`<span class="cnt">${count}</span>`:""}${flag||""}</summary><div class="kids">${kids}</div></details>`;
const leaf=(color,label,sub,flag)=>`<div class="lf"><span class="dot" style="background:${color}"></span><span><b>${label}</b>${sub?` <small>${sub}</small>`:""}</span>${flag||""}</div>`;

async function org(v){
  subscribe();v.innerHTML='<div class="empty">Loading…</div>';
  const[P,Ot,Rl]=await Promise.all([all("profiles","id,full_name,username,role,status"),all("registry_outlets","booth_code,municipality,sr_name,collector,status"),all("registry_relievers","name,municipality,status")]);
  const act=P.filter(p=>p.status=="active"),by=r=>act.filter(p=>p.role==r).sort((a,b)=>(a.full_name||"").localeCompare(b.full_name||""));
  const admins=by("admin"),sups=by("supervisor"),collAcc=by("collector");
  const q=O.q.toLowerCase(),hit=s=>!q||String(s).toLowerCase().includes(q);
  const accFor=n=>collAcc.find(a=>(a.full_name||"").toUpperCase().split(/\s+/).includes(n)||(a.username||"").toUpperCase().startsWith(n));
  // collectors from registry grouped by area
  const grp={DDN:new Map(),SAMAL:new Map()};let un=[];
  Ot.forEach(o=>{if(!o.collector){un.push(o);return}const g=grp[areaOf(o.municipality)];if(!g.has(o.collector))g.set(o.collector,[]);g.get(o.collector).push(o)});
  const tellerCount=Ot.filter(o=>o.sr_name).length;
  const kidsOf=(list)=>list.sort((a,b)=>num(a.booth_code)-num(b.booth_code)).filter(o=>hit(o.booth_code+" "+(o.sr_name||""))).map(o=>leaf((MU()[o.municipality]||[0,"#94a3b8"])[1],esc(o.sr_name||"(no teller)"),esc(o.booth_code),o.status!="ACTIVE"?'<span class="pill" style="background:#94a3b8">inactive</span>':!o.sr_name?'<span class="pill" style="background:#f59e0b">needs details</span>':"")).join("");
  const areaNode=a=>{const g=grp[a],names=[...g.keys()].sort(),nBooths=names.reduce((s,n)=>s+g.get(n).length,0);
    const cn=names.map(n=>{const list=g.get(n),acc=accFor(n.toUpperCase()),k=kidsOf(list);if(q&&!k&&!hit(n))return"";
      return node("#d4a72c",esc(n),acc?`Account: ${esc(acc.full_name||acc.username)}`:'<span style="color:var(--mu)">no collector account yet</span>',list.length+" booths",!!q,k||'<div class="lf"><small>No match</small></div>')}).join("");
    return cn||!q?node("#3b82f6",AL[a],"Area",names.length+" collectors · "+nBooths+" booths",true,cn||'<div class="lf"><small>No collectors assigned yet.</small></div>'):""};
  const supKids=sups.length?sups.filter(s=>hit(s.full_name+" "+s.username)).map(s=>leaf("#8b5cf6",esc(s.full_name||s.username),"Field Sales Supervisor")).join(""):'<div class="lf"><small>No active supervisors yet.</small></div>';
  const rel=Rl.filter(r=>hit(r.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(r=>leaf("#06b6d4",esc(r.name),esc(r.municipality||""),r.status&&r.status!="ACTIVE"?'<span class="pill" style="background:#94a3b8">inactive</span>':"")).join("");
  const unk=kidsOf(un);
  const top=admins.length?admins.map(a=>`<div class="top"><span class="av big" style="background:#e0b13a;color:#1a1300">${esc(ini(a.full_name||a.username))}</span><div><b>${esc(a.full_name||a.username)}</b><br><small>Operations Administrator</small></div></div>`).join(""):'<div class="top"><div><b>Operations Administrator</b><br><small>No active administrator found</small></div></div>';
  v.innerHTML=`<div class="kpis" style="margin-bottom:14px"><div class="kpi"><small>Supervisors</small><b>${sups.length}</b></div><div class="kpi"><small>Collectors</small><b>${grp.DDN.size+grp.SAMAL.size}</b></div><div class="kpi"><small>Tellers / booths</small><b>${tellerCount} / ${Ot.length}</b></div><div class="kpi"><small>Relievers</small><b>${Rl.length}</b></div></div>
  <div class="tbar"><input id="oq" placeholder="Find a teller, booth, collector…" value="${esc(O.q)}"><button class="ghost" id="oe">Expand all</button><button class="ghost" id="oc">Collapse all</button></div>
  <div class="ot">${top}<div class="kids root">${node("#8b5cf6","Field Sales Supervisors","Reports to the Operations Administrator",sups.length,true,supKids)}${node("#3b82f6","Field Sales Collectors","Collectors by area, with their booths and tellers",grp.DDN.size+grp.SAMAL.size,true,areaNode("DDN")+areaNode("SAMAL")+(un.length&&unk?node("#f59e0b","Booths without a collector","Assign a collector in Master Registry",un.length,false,unk):""))}${node("#06b6d4","Relievers","From Master Registry",Rl.length,!!q,rel||'<div class="lf"><small>None found.</small></div>')}</div></div>`;
  $("#oq").oninput=e=>{O.q=e.target.value;org(v).then(()=>{const i=$("#oq");i.focus();i.setSelectionRange(O.q.length,O.q.length)})};
  $("#oe").onclick=()=>v.querySelectorAll(".ot details").forEach(d=>d.open=true);$("#oc").onclick=()=>v.querySelectorAll(".ot details").forEach(d=>d.open=false)}

window.MODS=Object.assign(window.MODS||{},{[NAME]:org});
})();
