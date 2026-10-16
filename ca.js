(()=>{
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const money=n=>"₱"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const short=n=>Number(n).toLocaleString("en-US",{maximumFractionDigits:2});
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fd=s=>{const[y,m,d]=s.split("-").map(Number);return MN[m-1].slice(0,3)+" "+d+", "+y};
const ERR={OPEN_BALANCE:"This collector still has an unpaid cash advance. It must be fully paid before a new one can be taken.",OVERPAY:"That payment is more than the remaining balance.",BEFORE_TAKEN:"A payment can't be dated before the cash advance was taken.",BELOW_PAID:"The amount can't be lower than what has already been paid."};
const emsg=e=>{const m=(e&&e.message)||"";for(const k in ERR)if(m.includes(k))return ERR[k];return "Something went wrong. Please try again."};
const C={view:"list",id:null,m:null,q:"",st:"",sub:false};window.CAS=C;
const open=r=>Number(r.paid)<Number(r.amount);
const pill=r=>open(r)?'<span class="pill" style="background:#f59e0b">Open</span>':'<span class="pill" style="background:#22c55e">Paid</span>';

function dlg(html){const d=document.createElement("dialog");d.innerHTML=html;document.body.appendChild(d);d.showModal();d.close_=()=>{d.close();d.remove()};return d}
function subscribe(){if(C.sub)return;C.sub=true;let tm;const f=()=>{clearTimeout(tm);tm=setTimeout(()=>{if(!QUIETW()&&cur=="CASH ADVANCE (C.A) & PAYMENTS"&&!document.querySelector("dialog[open]"))go(cur)},500)};
  sb.channel("ca").on("postgres_changes",{event:"*",schema:"public",table:"cash_advances"},f).on("postgres_changes",{event:"*",schema:"public",table:"ca_payments"},f).subscribe()}

async function ca(v){subscribe();return C.view=="detail"&&C.id?detail(v):list(v)}

async function list(v){
  const adm=me.role=="admin";
  LOAD(v);
  const{data}=await sb.from("ca_summary").select("*").order("taken_on",{ascending:false}).range(0,999);const rows=data||[];
  const tA=rows.reduce((s,r)=>s+Number(r.amount),0),tP=rows.reduce((s,r)=>s+Number(r.paid),0);
  v.innerHTML=`<div class="kpis" style="margin-bottom:14px"><div class="kpi"><small>Total advanced</small><b>${money(tA)}</b></div><div class="kpi"><small>Total paid</small><b>${money(tP)}</b></div><div class="kpi"><small>Remaining balance</small><b>${money(tA-tP)}</b></div><div class="kpi"><small>Open cash advances</small><b>${rows.filter(open).length}</b></div></div>
  <div class="tbar"><input id="cq" placeholder="Search collector or note…" value="${esc(C.q)}"><select id="cs"><option value="">All</option><option value="open"${C.st=="open"?" selected":""}>Open</option><option value="paid"${C.st=="paid"?" selected":""}>Fully paid</option></select>${adm?'<button class="ghost" id="cn">+ New Cash Advance</button>':""}</div><div id="ct"></div>`;
  const draw=()=>{const q=C.q.toLowerCase(),f=rows.filter(r=>(!q||(r.collector_name+" "+(r.note||"")).toLowerCase().includes(q))&&(!C.st||(C.st=="open")==open(r)));const pg=PAGER.paginate("ca",f);
    $("#ct").innerHTML=f.length?`<div class="tw"><table><thead><tr><th>Collector</th><th>Date taken</th><th>Amount</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${pg.slice.map(r=>`<tr data-i="${r.id}" style="cursor:pointer"><td><b>${esc(r.collector_name)}</b></td><td>${fd(r.taken_on)}</td><td>${money(r.amount)}</td><td>${money(r.paid)}</td><td><b>${money(r.amount-r.paid)}</b></td><td>${pill(r)}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:`<div class="empty"><b>CASH ADVANCE (C.A) &amp; PAYMENTS</b><br>No cash advances yet.${adm?" Use “+ New Cash Advance” to add one.":""}</div>`;
    $("#ct").querySelectorAll("tr[data-i]").forEach(t=>t.onclick=()=>{C.view="detail";C.id=t.dataset.i;C.m=null;go(cur)});PAGER.bind($("#ct"),pg.st,draw)};
  $("#cq").oninput=e=>{C.q=e.target.value;PAGER.reset("ca");draw()};$("#cs").onchange=e=>{C.st=e.target.value;PAGER.reset("ca");draw()};
  if(adm)$("#cn").onclick=()=>newCA(rows,()=>list(v));draw()}

async function newCA(rows,done){
  const{data:cs}=await sb.from("profiles").select("id,full_name,username").eq("role","collector").eq("status","active").order("full_name");
  const busy=new Set(rows.filter(open).map(r=>r.collector_id));
  if(!cs||!cs.length){const d=dlg(`<h4 style="margin:0 0 8px">New cash advance</h4><p>There are no active collector accounts yet. In USER &amp; ACCESS MANAGEMENT, set the person's role to <b>Field Sales Collector</b> and status to <b>active</b>.</p><button class="ghost" id="x">Close</button>`);d.querySelector("#x").onclick=d.close_;return}
  const d=dlg(`<h4 style="margin:0 0 6px">New cash advance</h4><label>Collector</label><select id="nc">${cs.map(c=>`<option value="${c.id}">${esc(c.full_name||c.username)}${busy.has(c.id)?" — has unpaid balance":""}</option>`).join("")}</select>
  <div class="g2"><div><label>Date taken</label><input type="date" id="nd" value="${iso(new Date())}"></div><div><label>Amount (₱)</label><input type="number" id="na" min="1" step="0.01" inputmode="decimal"></div></div><label>Note (optional)</label><input id="nt">
  <div class="msg" id="nm"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="ns">Save</button><button class="ghost" id="nx">Cancel</button></div>`);
  d.querySelector("#nx").onclick=d.close_;
  d.querySelector("#ns").onclick=async()=>{const m=d.querySelector("#nm"),id=d.querySelector("#nc").value,a=parseFloat(d.querySelector("#na").value),dt=d.querySelector("#nd").value;
    if(busy.has(id))return m.textContent=ERR.OPEN_BALANCE;if(!(a>0))return m.textContent="Enter the amount.";if(!dt)return m.textContent="Choose the date taken.";
    const c=cs.find(x=>x.id==id),{error}=await sb.from("cash_advances").insert({collector_id:id,collector_name:c.full_name||c.username,taken_on:dt,amount:a,note:d.querySelector("#nt").value.trim()||null,created_by:me.id});
    if(error)return m.textContent=emsg(error);d.close_();done()}}

async function detail(v){
  const adm=me.role=="admin";
  const[A,P]=await Promise.all([sb.from("ca_summary").select("*").eq("id",C.id).maybeSingle(),sb.from("ca_payments").select("*").eq("ca_id",C.id).order("paid_on")]);
  if(!A.data){C.view="list";C.id=null;return list(v)}
  const r=A.data,pays=P.data||[],paid=Number(r.paid),amt=Number(r.amount),rem=amt-paid;
  if(!C.m){const base=pays.length?pays[pays.length-1].paid_on:iso(new Date()),today=iso(new Date());C.m=(rem>0&&today>=r.taken_on?today:base>=r.taken_on?base:r.taken_on).slice(0,7)}
  v.innerHTML=`<div class="tbar"><button class="ghost" id="bk2">← Back to list</button><b style="font-size:16px">${esc(r.collector_name)}</b>${pill(r)}<span class="chip">Taken ${fd(r.taken_on)}</span>${adm?'<button class="ghost" id="ed" style="margin-left:auto">Edit</button><button class="ghost" id="dl">Delete</button>':""}</div>
  ${r.note?`<div class="chip" style="margin:-4px 0 10px">Note: ${esc(r.note)}</div>`:""}
  <div class="kpis"><div class="kpi"><small>Cash advance</small><b>${money(amt)}</b></div><div class="kpi"><small>Total paid</small><b>${money(paid)}</b></div><div class="kpi"><small>Remaining balance</small><b>${money(rem)}</b></div></div>
  <div class="prog" style="margin:12px 0"><i style="width:${Math.min(100,paid/amt*100)}%"></i></div>
  <div class="box" style="max-width:none"><div class="tbar" style="margin-bottom:8px"><button class="chip2" id="pm">‹</button><b id="mt" style="min-width:150px;text-align:center"></b><button class="chip2" id="nm2">›</button><span class="chip" id="ms"></span>${adm?'<span class="chip">Click a day to record a payment</span>':""}</div><div id="cal"></div></div>
  <h4 class="h">Payments</h4><div id="pl"></div>`;
  $("#bk2").onclick=()=>{C.view="list";C.id=null;go(cur)};
  if(adm){$("#ed").onclick=()=>editCA(r,()=>detail(v));$("#dl").onclick=async()=>{if(!confirm("Delete this cash advance and all its payments?"))return;const{error}=await sb.from("cash_advances").delete().eq("id",r.id);if(error)return alert("Could not delete.");C.view="list";C.id=null;go(cur)}}
  const map=new Map(pays.map(p=>[p.paid_on,p]));
  const calDraw=()=>{let[y,m]=C.m.split("-").map(Number);const first=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate(),today=iso(new Date());let cells="",tot=0;
    for(let i=0;i<first;i++)cells+='<div class="cd x"></div>';
    for(let d=1;d<=days;d++){const ds=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`,p=map.get(ds),off=ds<r.taken_on;if(p)tot+=Number(p.amount);
      cells+=`<div class="cd${p?" paid":""}${off?" off":""}${ds==today?" today":""}${adm&&!off?" ck":""}" data-d="${ds}"><span>${d}</span>${ds==r.taken_on?"<i>Taken</i>":""}${p?`<b>${short(p.amount)}</b>`:""}</div>`}
    $("#mt").textContent=MN[m-1]+" "+y;$("#ms").textContent="Paid this month: "+money(tot);
    $("#cal").innerHTML='<div class="calg">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(w=>`<div class="wd">${w}</div>`).join("")+cells+"</div>";
    if(adm)$("#cal").querySelectorAll(".cd.ck").forEach(c=>c.onclick=()=>payDlg(r,rem,map.get(c.dataset.d),c.dataset.d,()=>detail(v)))};
  const step=k=>{let[y,m]=C.m.split("-").map(Number);m+=k;if(m<1){m=12;y--}if(m>12){m=1;y++}C.m=y+"-"+String(m).padStart(2,"0");calDraw()};
  $("#pm").onclick=()=>step(-1);$("#nm2").onclick=()=>step(1);calDraw();
  const plDraw=()=>{const list=[...pays].reverse(),pg=PAGER.paginate("capay",list);
    $("#pl").innerHTML=list.length?`<div class="tw"><table><thead><tr><th>Date</th><th>Amount</th></tr></thead><tbody>${pg.slice.map(p=>`<tr><td>${fd(p.paid_on)}</td><td>${money(p.amount)}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="empty">No payments yet.</div>';PAGER.bind($("#pl"),pg.st,plDraw)};plDraw()}

function payDlg(r,rem,p,ds,done){
  const max=rem+(p?Number(p.amount):0),d=dlg(`<h4 style="margin:0 0 4px">Payment — ${fd(ds)}</h4><div class="chip">Collector: ${esc(r.collector_name)} · You can enter up to ${money(max)}</div><label>Amount paid (₱)</label><input type="number" id="pa" min="0" step="0.01" inputmode="decimal" value="${p?p.amount:""}" ${""}><div class="msg" id="pmsg"></div>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="ps">Save</button><button class="ghost" id="px">Cancel</button>${p?'<button class="ghost" id="pd" style="margin-left:auto">Remove payment</button>':""}</div>`);
  d.querySelector("#px").onclick=d.close_;d.querySelector("#pa").focus();
  d.querySelector("#ps").onclick=async()=>{const m=d.querySelector("#pmsg"),a=parseFloat(d.querySelector("#pa").value);let error;
    if(!(a>0)){if(!p)return m.textContent="Enter an amount, or cancel.";({error}=await sb.from("ca_payments").delete().eq("id",p.id))}
    else if(a>max+0.0001)return m.textContent="That is more than the remaining balance ("+money(max)+").";
    else if(p)({error}=await sb.from("ca_payments").update({amount:a}).eq("id",p.id));else({error}=await sb.from("ca_payments").insert({ca_id:r.id,paid_on:ds,amount:a,created_by:me.id}));
    if(error)return m.textContent=emsg(error);d.close_();done()};
  if(p)d.querySelector("#pd").onclick=async()=>{const{error}=await sb.from("ca_payments").delete().eq("id",p.id);if(error)return d.querySelector("#pmsg").textContent=emsg(error);d.close_();done()}}

function editCA(r,done){
  const d=dlg(`<h4 style="margin:0 0 6px">Edit cash advance — ${esc(r.collector_name)}</h4><div class="g2"><div><label>Date taken</label><input type="date" id="ed1" value="${r.taken_on}"></div><div><label>Amount (₱)</label><input type="number" id="ed2" min="1" step="0.01" value="${r.amount}"></div></div><label>Note</label><input id="ed3" value="${esc(r.note||"")}">
  <div class="msg" id="em"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="es">Save</button><button class="ghost" id="ex">Cancel</button></div>`);
  d.querySelector("#ex").onclick=d.close_;
  d.querySelector("#es").onclick=async()=>{const a=parseFloat(d.querySelector("#ed2").value),m=d.querySelector("#em");if(!(a>0))return m.textContent="Enter the amount.";
    const{error}=await sb.from("cash_advances").update({taken_on:d.querySelector("#ed1").value,amount:a,note:d.querySelector("#ed3").value.trim()||null}).eq("id",r.id);if(error)return m.textContent=emsg(error);d.close_();done()}}

window.MODS=Object.assign(window.MODS||{},{"CASH ADVANCE (C.A) & PAYMENTS":ca});
})();
