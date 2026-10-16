(()=>{
const MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],ML=["January","February","March","April","May","June","July","August","September","October","November","December"];
const money=n=>"₱"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const ax=n=>{n=Number(n);return n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,"")+"M":n>=1e3?(n/1e3).toFixed(0)+"k":String(Math.round(n))};
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const dp=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const fd=s=>{const d=dp(s);return d.getDate()+" "+MN[d.getMonth()]+" "+d.getFullYear()};
const sh=s=>{const d=dp(s);return d.getDate()+" "+MN[d.getMonth()]};
const D={date:null,area:"ALL",range:7,sub:false};window.DASH=D;
const MU=()=>window.MUNI||{};
const KEYS=["bets","pay","comm","pal","gross","sal"],KL={bets:"Total Bets",pay:"Payouts",comm:"Commission",pal:"Palawan",gross:"Gross",sal:"Salary"};
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
const nav=n=>{if(window.CAS)CAS.view="list";go(n)};
function subscribe(){if(D.sub)return;D.sub=true;let tm;const f=()=>{clearTimeout(tm);tm=setTimeout(()=>{if(!QUIETW()&&cur=="DASHBOARD"&&!document.querySelector("dialog[open]"))go(cur)},800)};
  let c=sb.channel("dash");["daily_reports","cash_advances","ca_payments","rental_plans","rental_records","rental_payments","registry_outlets","profiles","password_requests"].forEach(t=>c=c.on("postgres_changes",{event:"*",schema:"public",table:t},f));c.subscribe()}
const sumT=(a,b)=>{const o={};KEYS.forEach(k=>o[k]=Number(a?.[k]||0)+Number(b?.[k]||0));return o};
const pickT=(s,area)=>area=="DDN"?s.ddn:area=="SAMAL"?s.samal:sumT(s.ddn,s.samal);

async function dash(v){
  subscribe();const adm=me.role=="admin";LOAD(v);
  const today=new Date(),ym=iso(today).slice(0,7);
  const[S,CA,PL,RR,O,PN,PR]=await Promise.all([
    sb.from("report_summary").select("*").order("report_date",{ascending:false}).range(0,399),
    sb.from("ca_summary").select("*").range(0,999),
    all("rental_plans"),sb.from("rental_summary").select("*").eq("period",ym+"-01").range(0,4999),
    all("registry_outlets","booth_code,municipality,needs_details,lat,collector,status,sr_name"),
    adm?sb.from("profiles").select("id",{count:"exact",head:true}).eq("status","pending"):Promise.resolve({count:0}),
    adm?sb.from("password_requests").select("id",{count:"exact",head:true}).eq("status","open"):Promise.resolve({count:0})]);
  const sums=S.data||[],dates=sums.map(s=>s.report_date);
  if(!D.date||!dates.includes(D.date))D.date=dates[0]||null;
  const cur_=sums.find(s=>s.report_date==D.date),prev=sums.find(s=>s.report_date<D.date);
  let snap=null;if(D.date){const r=await sb.from("daily_reports").select("snapshot").eq("report_date",D.date).maybeSingle();snap=r.data?.snapshot||null}
  const hr=today.getHours(),greet=hr<12?"Good morning":hr<18?"Good afternoon":"Good evening",first=(me.full_name||"").split(" ")[0];
  const head=`<div class="hdr2"><div><div style="font-size:20px;font-weight:700">${greet}, ${esc(first)}</div><div class="chip">${D.date?"Report of "+fd(D.date):"No sales report yet"} · <span class="live"><i></i>Live</span></div></div>
  <div class="tbar" style="margin:0">${dates.length?`<select id="dd" style="max-width:170px">${dates.slice(0,120).map(d=>`<option value="${d}"${d==D.date?" selected":""}>${fd(d)}</option>`).join("")}</select>`:""}
  ${[["ALL","All areas"],["DDN","Davao del Norte"],["SAMAL","Samal"]].map(([k,l])=>`<button class="chip2" data-a="${k}">${l}</button>`).join("")}${[7,30].map(n=>`<button class="chip2" data-r="${n}">${n} days</button>`).join("")}</div></div>`;
  // KPI
  let kpi="";
  if(cur_){const t=pickT(cur_,D.area),pt=prev?pickT(prev,D.area):null;
    kpi=`<div class="kpis">${KEYS.map(k=>{let d="";if(pt&&Number(pt[k])>0){const p=(t[k]-pt[k])/pt[k]*100;if(k!="sal")d=`<small class="delta ${p>=0?"up":"dn"}">${p>=0?"▲":"▼"} ${Math.abs(p).toFixed(1)}% vs ${sh(prev.report_date)}</small>`}
      const split=D.area=="ALL"?`<small>DDN ${money(cur_.ddn?.[k])} · Samal ${money(cur_.samal?.[k])}</small>`:"";
      return`<div class="kpi"><small>${KL[k]}</small><b>${money(t[k])}</b>${d}${split}</div>`}).join("")}</div>`}
  else kpi=`<div class="empty"><b>DASHBOARD</b><br>No sales report yet. Import the first accounting file in SALES &amp; COLLECTION.</div>`;
  // trend
  const trend=()=>{if(!D.date)return"";const end=dp(D.date),days=[];for(let i=D.range-1;i>=0;i--){const d=new Date(end);d.setDate(d.getDate()-i);days.push(iso(d))}
    const pts=days.map(d=>{const s=sums.find(x=>x.report_date==d);if(!s)return{d};const t=pickT(s,D.area);return{d,bets:t.bets,gross:t.gross}}),mx=Math.max(1,...pts.map(p=>p.bets||0));
    const step=(()=>{const raw=mx/4,p=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/p;return(n<=1?1:n<=2?2:n<=5?5:10)*p})(),top=step*Math.ceil(mx/step),W=700,H=240,L=46,R=14,T=14,B=30,x=i=>L+(days.length==1?(W-L-R)/2:i*(W-L-R)/(days.length-1)),y=v=>T+(H-T-B)*(1-v/top);
    const line=k=>{let d="",open=false;pts.forEach((p,i)=>{if(p[k]==null){open=false;return}d+=(open?"L":"M")+x(i).toFixed(1)+" "+y(p[k]).toFixed(1)+" ";open=true});return d};
    const grid=Array.from({length:Math.round(top/step)+1},(_,i)=>i*step).map(g=>`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" style="stroke:var(--line)"/><text x="${L-6}" y="${y(g)+4}" text-anchor="end" font-size="11" style="fill:var(--mu)">${ax(g)}</text>`).join("");
    const every=Math.ceil(days.length/8),xl=pts.map((p,i)=>i%every==0||i==days.length-1?`<text x="${x(i)}" y="${H-8}" text-anchor="middle" font-size="11" style="fill:var(--mu)">${sh(p.d)}</text>`:"").join("");
    const dots=k=>pts.map((p,i)=>p[k]==null?"":`<circle cx="${x(i)}" cy="${y(p[k])}" r="3.5" style="fill:${k=="bets"?"var(--gold)":"#06b6d4"}"><title>${sh(p.d)} · ${KL[k]} ${money(p[k])}</title></circle>`).join("");
    return`<div class="dc"><h4>Sales trend — last ${D.range} days <span class="chip"><span style="color:var(--gold)">●</span> Total Bets &nbsp; <span style="color:#06b6d4">●</span> Gross</span></h4><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${grid}${xl}<path d="${line("bets")}" fill="none" stroke-width="2.5" style="stroke:var(--gold)"/><path d="${line("gross")}" fill="none" stroke-width="2.5" style="stroke:#06b6d4"/>${dots("bets")}${dots("gross")}</svg>${pts.some(p=>p.bets!=null)?"":'<div class="empty" style="padding:14px">No reports in this period.</div>'}</div>`};
  // collectors + low sales
  let coll="",low="";
  if(snap){const areas=D.area=="ALL"?["DDN","SAMAL"]:[D.area],by={};areas.forEach(a=>(snap.areas[a]?.outlets||[]).forEach(o=>{const k=o.collector||"Unassigned";by[k]=(by[k]||0)+o.bets}));
    const arr=Object.entries(by).sort((a,b)=>b[1]-a[1]),mx=Math.max(1,...arr.map(a=>a[1]));
    coll=`<div class="dc"><h4>Collections by collector <a data-go="SALES & COLLECTION">Full report →</a></h4><div class="bars">${arr.length?arr.map(([n,vv])=>`<div class="br"><span>${esc(n)}</span><div class="bt"><i style="width:${vv/mx*100}%"></i></div><b>${money(vv)}</b></div>`).join(""):'<div class="empty" style="padding:14px">No data.</div>'}</div></div>`;
    const ao={};["DDN","SAMAL"].forEach(a=>(snap.areas[a]?.outlets||[]).forEach(o=>ao[o.code]={a,t:o.teller}));
    const L3=(snap.rows||[]).filter(r=>r.gross<3000&&(D.area=="ALL"||ao[r.code]?.a==D.area)).sort((a,b)=>a.gross-b.gross),tot=L3.reduce((s,r)=>s+r.gross,0);
    low=`<div class="dc"><h4>Low sales (below ₱3,000) <a data-go="SALES & COLLECTION">Report →</a></h4><div style="margin-bottom:8px"><b style="font-size:19px">${L3.length}</b> outlets · ${money(tot)}</div>${L3.slice(0,8).map(r=>`<div class="attn" style="cursor:default"><span style="flex:1"><b style="background:none;padding:0;min-width:0;color:var(--tx)">${esc(r.code)}</b> <span class="chip">${esc(ao[r.code]?.t||"")}</span></span><span>${money(r.gross)}</span><span class="pill" style="background:${r.gross<1000?"#ef4444":r.gross<2000?"#f59e0b":"#facc15"}">${r.gross<1000?"Critical":r.gross<2000?"Very low":"Low"}</span></div>`).join("")||'<div class="chip">None 🎉</div>'}${L3.length>8?`<div class="chip" style="margin-top:6px">+ ${L3.length-8} more in the Excel report</div>`:""}</div>`}
  // cash advances
  const oc=(CA.data||[]).filter(r=>Number(r.paid)<Number(r.amount)),tA=(CA.data||[]).reduce((s,r)=>s+Number(r.amount),0),tP=(CA.data||[]).reduce((s,r)=>s+Number(r.paid),0);
  const cad=`<div class="dc"><h4>Cash advances <a data-go="CASH ADVANCE (C.A) & PAYMENTS">Open →</a></h4><div class="g2" style="gap:6px 12px"><div><small class="chip">Advanced</small><br><b>${money(tA)}</b></div><div><small class="chip">Paid</small><br><b>${money(tP)}</b></div><div><small class="chip">Remaining</small><br><b>${money(tA-tP)}</b></div><div><small class="chip">Open</small><br><b>${oc.length}</b></div></div>
  ${oc.sort((a,b)=>(b.amount-b.paid)-(a.amount-a.paid)).slice(0,5).map(r=>`<div class="attn" style="cursor:default"><span style="flex:1">${esc(r.collector_name)}</span><span>${money(r.amount-r.paid)}</span></div>`).join("")}</div>`;
  // rentals
  const rec=new Map((RR.data||[]).map(r=>[r.plan_id,r])),rk=k=>{const ps=PL.filter(p=>p.kind==k&&p.active),rs=ps.map(p=>rec.get(p.id)).filter(Boolean),due=rs.reduce((s,r)=>s+Number(r.amount),0),pd=rs.reduce((s,r)=>s+Number(r.paid||0),0);return{n:ps.length,due,pd,unpaid:rs.filter(r=>Number(r.paid||0)<Number(r.amount)).length,miss:ps.filter(p=>!rec.has(p.id)).length}};
  const rn=rk("rental"),ld=rk("load"),mname=ML[today.getMonth()]+" "+today.getFullYear();
  const rent=`<div class="dc"><h4>Rentals &amp; load allowance — ${mname} <a data-go="OUTLET RENTALS & LOAD ALLOWANCE">Open →</a></h4>${[["Outlet rentals",rn],["Load allowance",ld]].map(([l,r])=>`<div style="margin:8px 0"><b>${l}</b> <span class="chip">${r.n} booths</span><div class="g2" style="gap:2px 12px;font-size:13px"><span>Due ${money(r.due)}</span><span>Paid ${money(r.pd)}</span><span>Unpaid ${money(r.due-r.pd)}</span><span>${r.miss} without record</span></div></div>`).join("")}</div>`;
  // registry
  const by={};O.forEach(o=>by[o.municipality]=(by[o.municipality]||0)+1);const mxm=Math.max(1,...Object.values(by));
  const reg=`<div class="dc"><h4>Master registry — ${O.length} outlets <a data-go="ETS LIVE TRACKING">Map →</a></h4><div class="bars">${Object.entries(MU()).map(([k,l])=>`<div class="br"><span>${l[0]}</span><div class="bt"><i style="width:${(by[k]||0)/mxm*100}%;background:${l[1]}"></i></div><b>${by[k]||0}</b></div>`).join("")}</div></div>`;
  // attention
  const items=[];
  if(adm&&PN.count)items.push([PN.count,"account(s) awaiting approval","USER & ACCESS MANAGEMENT"]);if(adm&&PR.count)items.push([PR.count,"password reset request(s)","USER & ACCESS MANAGEMENT"]);
  const nd=O.filter(o=>o.needs_details).length,nc=O.filter(o=>o.lat==null).length,ncl=O.filter(o=>!o.collector&&o.status=="ACTIVE").length;
  if(nd)items.push([nd,"booth(s) flagged “Needs details”","MASTER REGISTRY"]);if(nc)items.push([nc,"booth(s) have no map coordinates","MASTER REGISTRY"]);if(ncl)items.push([ncl,"active booth(s) have no collector","MASTER REGISTRY"]);
  const up=rn.unpaid+ld.unpaid;if(up)items.push([up,"unpaid rental / load record(s) this month","OUTLET RENTALS & LOAD ALLOWANCE"]);const ms=rn.miss+ld.miss;if(ms)items.push([ms,"booth(s) without a record this month","OUTLET RENTALS & LOAD ALLOWANCE"]);
  if(cur_&&cur_.skipped)items.push([cur_.skipped,"outlet(s) were left out of the latest report","SALES & COLLECTION"]);
  if(dates[0]){const age=Math.floor((today-dp(dates[0]))/864e5);if(age>=2)items.push([age,"days since the latest sales report","SALES & COLLECTION"])}
  const att=`<div class="dc"><h4>Needs attention</h4>${items.length?items.map(([n,t,g])=>`<div class="attn" data-go="${esc(g)}"><b>${n}</b><span>${esc(t)}</span></div>`).join(""):'<div class="chip">All clear ✓</div>'}</div>`;
  v.innerHTML=head+kpi+(cur_?`<div style="margin-top:14px">${trend()}</div>`:"")+`<div class="dgrid">${coll}${low}${cad}${rent}${reg}${att}</div>`;
  const dd=$("#dd");if(dd)dd.onchange=e=>{D.date=e.target.value;dash(v)};
  v.querySelectorAll("[data-a]").forEach(b=>{b.classList.toggle("on",b.dataset.a==D.area);b.onclick=()=>{D.area=b.dataset.a;dash(v)}});
  v.querySelectorAll("[data-r]").forEach(b=>{b.classList.toggle("on",+b.dataset.r==D.range);b.onclick=()=>{D.range=+b.dataset.r;dash(v)}});
  v.querySelectorAll("[data-go]").forEach(a=>a.onclick=()=>nav(a.dataset.go))}

window.MODS=Object.assign(window.MODS||{},{"DASHBOARD":dash});
})();
