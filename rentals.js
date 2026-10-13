(()=>{
const NAME="OUTLET RENTALS & LOAD ALLOWANCE";
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const money=n=>"₱"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fd=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return MN[m-1].slice(0,3)+" "+d+", "+y};
const cov=(a,b)=>a&&b?fd(a)+" → "+fd(b):"";
// n months after the ORIGINAL start day (anchored, so a 31st goes Feb 28 then back to Mar 31)
const addA=(s,n)=>{const[y,m,d]=s.split("-").map(Number),t=new Date(y,m-1+n,1),last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();return iso(new Date(t.getFullYear(),t.getMonth(),Math.min(d,last)))};
const KIND={rental:"Outlet Rental",load:"Load Allowance"};
const R={kind:"rental",tab:"rec",m:iso(new Date()).slice(0,7),q:"",f:"",sub:false,busy:false};window.RENTS=R;window.RENT_MATH={addA};
const MU=()=>window.MUNI||{};
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
const lab=m=>{const[y,mm]=m.split("-").map(Number);return MN[mm-1]+" "+y};
function dlg(html){const d=document.createElement("dialog");d.innerHTML=html;document.body.appendChild(d);d.showModal();d.close_=()=>{d.close();d.remove()};return d}
function subscribe(){if(R.sub)return;R.sub=true;let t;const f=()=>{clearTimeout(t);t=setTimeout(()=>{if(cur==NAME&&!R.busy&&!document.querySelector("dialog[open]"))go(cur)},700)};
  sb.channel("rent").on("postgres_changes",{event:"*",schema:"public",table:"rental_plans"},f).on("postgres_changes",{event:"*",schema:"public",table:"rental_records"},f).subscribe()}
const pill=(t,c)=>`<span class="pill" style="background:${c}">${t}</span>`;
const muni=m=>MU()[m]?pill(MU()[m][0],MU()[m][1]):esc(m||"");

// periods of a plan from index n0 while the period has started (cover_start <= today)
function periods(p,n0,today){const out=[];if(!p.start_date)return out;for(let n=n0;n<n0+600;n++){const s=addA(p.start_date,n);if(s>today)break;out.push({n,s,e:addA(p.start_date,n+1)})}return out}
const mkRow=(p,x,paid)=>({plan_id:p.id,period:x.s.slice(0,7)+"-01",cover_start:x.s,due_date:x.e,amount:p.monthly_amount,paid_to:p.paid_to||null,status:paid?"paid":"unpaid",paid_on:paid?x.s:null});
async function insertRows(rows){for(let i=0;i<rows.length;i+=400){const{error}=await sb.from("rental_records").upsert(rows.slice(i,i+400),{onConflict:"plan_id,period",ignoreDuplicates:true});if(error)throw error}}

// continue every plan's chain up to the current period (never recreates deleted older periods)
async function ensure(plans){
  const today=iso(new Date()),live=plans.filter(p=>p.active&&p.start_date&&p.monthly_amount!=null);if(!live.length)return;
  const last=(await sb.from("rental_records").select("plan_id,cover_start,period").order("period",{ascending:false}).range(0,9999)).data||[],lb=new Map();last.forEach(r=>{if(!lb.has(r.plan_id))lb.set(r.plan_id,r)});
  const rows=[];live.forEach(p=>{const l=lb.get(p.id);if(!l)return;const ls=l.cover_start||l.period;let n=0;while(addA(p.start_date,n)<=ls&&n<900)n++;periods(p,n,today).forEach(x=>rows.push(mkRow(p,x,false)))});
  if(rows.length)await insertRows(rows)}

async function rent(v){
  subscribe();const adm=me.role=="admin";v.innerHTML='<div class="empty">Loading…</div>';
  const P0=await all("rental_plans");if(adm)try{await ensure(P0)}catch(e){}
  const[O,P,Rc]=await Promise.all([all("registry_outlets","booth_code,municipality,sr_name,collector,status"),adm?all("rental_plans"):Promise.resolve(P0),sb.from("rental_records").select("*").eq("period",R.m+"-01").range(0,4999)]);
  const reg=new Map(O.map(o=>[o.booth_code,o])),plans=P.filter(p=>p.kind==R.kind),recBy=new Map((Rc.data||[]).map(r=>[r.plan_id,r]));
  const info=p=>{const o=reg.get(p.booth_code)||{};return{teller:o.sr_name||"",muni:o.municipality||""}};
  v.innerHTML=`<div class="tbar"><button class="chip2" data-k="rental">Outlet Rentals</button><button class="chip2" data-k="load">Load Allowance</button><span style="width:10px"></span><button class="chip2" data-t="rec">Monthly records</button><button class="chip2" data-t="set">Booth setup</button></div>
  <div class="tbar">${R.tab=="rec"?`<button class="chip2" id="pm">‹</button><b id="mt" style="min-width:150px;text-align:center">${lab(R.m)}</b><button class="chip2" id="nm">›</button><button class="ghost" id="tm">This month</button>`:`<select id="sf"><option value="">All booths</option><option value="set"${R.f=="set"?" selected":""}>Set up</option><option value="not"${R.f=="not"?" selected":""}>Not set up</option></select>`}<input id="rq" placeholder="Search booth, teller, paid to…" value="${esc(R.q)}">${adm&&R.tab=="set"?'<button class="ghost" id="ab">+ Add Booth</button><button class="ghost" id="aa">Add all booths from Master Registry</button>':""}</div><div id="rk"></div><div id="rb"></div>`;
  v.querySelectorAll("[data-k]").forEach(b=>{b.classList.toggle("on",b.dataset.k==R.kind);b.onclick=()=>{R.kind=b.dataset.k;rent(v)}});
  v.querySelectorAll("[data-t]").forEach(b=>{b.classList.toggle("on",b.dataset.t==R.tab);b.onclick=()=>{R.tab=b.dataset.t;rent(v)}});
  const key="rent_"+R.kind+R.tab;$("#rq").oninput=e=>{R.q=e.target.value;PAGER.reset(key);draw()};
  if(R.tab=="rec"){const step=k=>{let[y,m]=R.m.split("-").map(Number);m+=k;if(m<1){m=12;y--}if(m>12){m=1;y++}R.m=y+"-"+String(m).padStart(2,"0");rent(v)};$("#pm").onclick=()=>step(-1);$("#nm").onclick=()=>step(1);$("#tm").onclick=()=>{R.m=iso(new Date()).slice(0,7);rent(v)}}
  else{$("#sf").onchange=e=>{R.f=e.target.value;PAGER.reset(key);draw()};if(adm){$("#ab").onclick=()=>planDlg(null,null,O,plans,()=>rent(v),R.kind);$("#aa").onclick=()=>bulkDlg(O,plans,()=>rent(v),R.kind)}}
  const draw=()=>{const q=R.q.toLowerCase();
    if(R.tab=="set"){$("#rk").innerHTML=`<div class="chip" style="margin-bottom:10px">Every booth from Master Registry is listed. Set the date the cover period starts (e.g. Aug 4, 2026): it runs one month (to Sep 4), then Sep 4 → Oct 4, and so on automatically.</div>`;
      const pb=new Map(plans.map(p=>[p.booth_code,p])),codes=[...new Set([...O.filter(o=>o.status=="ACTIVE"||pb.has(o.booth_code)).map(o=>o.booth_code),...plans.map(p=>p.booth_code)])].sort((a,b)=>(parseInt(a.replace(/\D/g,""))||0)-(parseInt(b.replace(/\D/g,""))||0));
      const rows=codes.map(c=>({c,p:pb.get(c)})).filter(x=>(!R.f||(R.f=="set")==!!x.p)&&(!q||[x.c,reg.get(x.c)?.sr_name||"",x.p?.paid_to||""].join(" ").toLowerCase().includes(q))),pg=PAGER.paginate(key,rows);
      $("#rb").innerHTML=rows.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Municipality</th><th>Cover starts</th><th>Default monthly amount</th><th>Paid to</th><th>Status</th></tr></thead><tbody>${pg.slice.map(({c,p})=>{const o=reg.get(c)||{};return`<tr data-c="${esc(c)}"${adm?' style="cursor:pointer"':""}><td><b>${esc(c)}</b></td><td>${esc(o.sr_name||"")}</td><td>${muni(o.municipality)}</td><td>${p&&p.start_date?fd(p.start_date):'<span style="color:var(--mu)">—</span>'}</td><td>${p?(p.monthly_amount!=null?money(p.monthly_amount):'<span style="color:var(--mu)">varies</span>'):""}</td><td>${esc(p?.paid_to||"")}</td><td>${p?(p.active?pill("Active","#22c55e"):pill("Inactive","#94a3b8")):pill("Not set up","#f59e0b")}</td></tr>`}).join("")}</tbody></table></div>`+pg.bar:'<div class="empty"><b>Booth setup</b><br>No booths match. Upload the masterlist in Master Registry first.</div>';
      if(adm)$("#rb").querySelectorAll("tr[data-c]").forEach(t=>t.onclick=()=>planDlg(pb.get(t.dataset.c)||null,t.dataset.c,O,plans,()=>rent(v),R.kind));PAGER.bind($("#rb"),pg.st,draw);return}
    const all2=plans.filter(p=>p.active||recBy.has(p.id)).map(p=>({p,r:recBy.get(p.id)})),rows=all2.filter(x=>!q||[x.p.booth_code,info(x.p).teller,x.r?.paid_to||x.p.paid_to||""].join(" ").toLowerCase().includes(q)),pg=PAGER.paginate(key,rows);
    const due=all2.reduce((s,x)=>s+(x.r?Number(x.r.amount):0),0),paid=all2.reduce((s,x)=>s+(x.r&&x.r.status=="paid"?Number(x.r.amount):0),0),nog=all2.filter(x=>!x.r).length,today=iso(new Date()),od=all2.filter(x=>x.r&&x.r.status!="paid"&&x.r.due_date&&x.r.due_date<today).length;
    $("#rk").innerHTML=`<div class="kpis" style="margin-bottom:12px"><div class="kpi"><small>Total for ${lab(R.m)}</small><b>${money(due)}</b></div><div class="kpi"><small>Paid</small><b>${money(paid)}</b></div><div class="kpi"><small>Unpaid</small><b>${money(due-paid)}</b>${od?`<small style="color:#ef4444">${od} overdue</small>`:""}</div><div class="kpi"><small>Booths</small><b>${all2.length}</b>${nog?`<small>${nog} without a record</small>`:""}</div></div>`;
    $("#rb").innerHTML=rows.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Municipality</th><th>Paid to</th><th>Amount</th><th>Status</th><th>Cover period</th></tr></thead><tbody>${pg.slice.map(({p,r})=>{const i=info(p);return`<tr data-p="${p.id}"${adm?' style="cursor:pointer"':""}><td><b>${esc(p.booth_code)}</b></td><td>${esc(i.teller)}</td><td>${muni(i.muni)}</td><td>${esc((r&&r.paid_to)||p.paid_to||"")}</td><td>${r?money(r.amount):'<span style="color:var(--mu)">—</span>'}</td><td>${r?(r.status=="paid"?pill("Paid","#22c55e"):(r.due_date&&r.due_date<today?pill("Overdue","#ef4444"):pill("Unpaid","#f59e0b"))):pill("No record","#94a3b8")}</td><td>${r?cov(r.cover_start,r.due_date):""}</td></tr>`}).join("")}</tbody></table></div>`+pg.bar:`<div class="empty"><b>${KIND[R.kind].toUpperCase()}</b><br>No booths set up yet.${adm?" Open “Booth setup” to start.":""}</div>`;
    if(adm)$("#rb").querySelectorAll("tr[data-p]").forEach(t=>t.onclick=()=>{const p=plans.find(x=>x.id==t.dataset.p);recDlg(p,recBy.get(p.id),R.m,reg.get(p.booth_code),()=>rent(v))});PAGER.bind($("#rb"),pg.st,draw)};
  draw()}

async function createPlan(body,markPaid){const{data,error}=await sb.from("rental_plans").insert(body).select().single();if(error)throw error;
  if(data.monthly_amount!=null&&data.start_date){const today=iso(new Date()),rows=periods(data,0,today).map(x=>mkRow(data,x,markPaid&&x.e<=today));if(rows.length)await insertRows(rows)}return data}

function planDlg(p,code,O,plans,done,kind){
  const k=p?p.kind:kind,start0=p&&p.start_date?p.start_date:"";
  const d=dlg(`<h4 style="margin:0 0 6px">${p?"Edit":"Set up"} booth — ${KIND[k]}</h4>${p||code?`<div class="chip">${esc(p?p.booth_code:code)}</div>`:`<label>Booth code</label><input id="pb" list="bl" placeholder="Type or pick a booth code"><datalist id="bl">${O.filter(o=>!plans.some(x=>x.booth_code==o.booth_code)).map(o=>`<option value="${esc(o.booth_code)}">${esc(o.sr_name||"")}</option>`).join("")}</datalist>`}
  <label>Cover period starts on</label><input type="date" id="ps" value="${start0}"><div class="chip" id="ph2" style="margin-top:6px"></div>
  <label>Default monthly amount (₱) — optional, leave blank if it varies</label><input type="number" id="pa" min="0" step="0.01" inputmode="decimal" value="${p&&p.monthly_amount!=null?p.monthly_amount:""}">
  <label>Paid to (landowner / payee) — optional</label><input id="pt" value="${esc(p?p.paid_to||"":"")}"><label>Note — optional</label><input id="pn" value="${esc(p?p.note||"":"")}">
  ${p?`<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="pc" style="width:auto"${p.active?" checked":""}> Active</label>`:`<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="pe" style="width:auto"> Mark periods before today as already paid</label>`}
  <p style="color:var(--mu);font-size:12px;margin:6px 0 0">Records for each month are created automatically. Changing the amount here only affects future months.</p>
  <div class="msg" id="pm2"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="ps2">Save</button><button class="ghost" id="px">Cancel</button>${p?'<button class="ghost" id="pd" style="margin-left:auto">Delete</button>':""}</div>`);
  const ps=d.querySelector("#ps"),hint=()=>{const s=ps.value;d.querySelector("#ph2").textContent=s?`First period: ${fd(s)} → ${fd(addA(s,1))}. Then ${fd(addA(s,1))} → ${fd(addA(s,2))}, ${fd(addA(s,2))} → ${fd(addA(s,3))} …`:"Pick the date the first period starts."};hint();ps.oninput=hint;
  d.querySelector("#px").onclick=d.close_;
  d.querySelector("#ps2").onclick=async()=>{const m=d.querySelector("#pm2"),a=d.querySelector("#pa").value.trim(),body={start_date:ps.value||null,monthly_amount:a===""?null:parseFloat(a),paid_to:d.querySelector("#pt").value.trim()||null,note:d.querySelector("#pn").value.trim()||null};
    if(!body.start_date)return m.textContent="Pick the date the cover period starts.";if(body.monthly_amount!==null&&!(body.monthly_amount>=0))return m.textContent="Enter a valid amount.";d.querySelector("#ps2").disabled=true;R.busy=true;
    try{if(p){body.active=d.querySelector("#pc").checked;const{error}=await sb.from("rental_plans").update(body).eq("id",p.id);if(error)throw error}
      else{const c=code||d.querySelector("#pb").value.trim().toUpperCase();if(!O.some(o=>o.booth_code==c)){R.busy=false;d.querySelector("#ps2").disabled=false;return m.textContent="Choose a booth code from Master Registry."}await createPlan({...body,booth_code:c,kind:k},d.querySelector("#pe").checked)}
      R.busy=false;d.close_();done()}catch(e){R.busy=false;d.querySelector("#ps2").disabled=false;m.textContent=/duplicate/i.test(e.message||"")?"That booth is already set up for "+KIND[k]+".":"Could not save."}};
  if(p)d.querySelector("#pd").onclick=async()=>{if(!confirm("Delete this booth and ALL its monthly records?"))return;const{error}=await sb.from("rental_plans").delete().eq("id",p.id);if(error)return d.querySelector("#pm2").textContent="Could not delete.";d.close_();done()}}

function bulkDlg(O,plans,done,kind){
  const have=new Set(plans.map(p=>p.booth_code)),todo=O.filter(o=>o.status=="ACTIVE"&&!have.has(o.booth_code));
  const d=dlg(`<h4 style="margin:0 0 6px">Add all booths — ${KIND[kind]}</h4><p style="margin:0 0 6px"><b>${todo.length}</b> booth(s) from Master Registry are not set up yet.</p>
  <label>Cover period starts on (same date for all)</label><input type="date" id="bs"><div class="chip" id="bh" style="margin-top:6px"></div><label>Default monthly amount (₱) — optional</label><input type="number" id="ba" min="0" step="0.01" inputmode="decimal"><label>Paid to — optional</label><input id="bt">
  <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="be" style="width:auto"> Mark periods before today as already paid</label><p style="color:var(--mu);font-size:12px;margin:6px 0 0">You can change each booth's date or amount afterwards by clicking it in the list.</p>
  <div class="msg" id="bm"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="bg">Add ${todo.length} booth(s)</button><button class="ghost" id="bx">Cancel</button></div>`);
  const bs=d.querySelector("#bs");bs.oninput=()=>d.querySelector("#bh").textContent=bs.value?`First period: ${fd(bs.value)} → ${fd(addA(bs.value,1))}, then it repeats monthly.`:"";
  d.querySelector("#bx").onclick=d.close_;
  d.querySelector("#bg").onclick=async()=>{const m=d.querySelector("#bm"),a=d.querySelector("#ba").value.trim();if(!todo.length)return m.textContent="Every booth is already set up.";if(!bs.value)return m.textContent="Pick the date the cover period starts.";
    const amt=a===""?null:parseFloat(a);if(amt!==null&&!(amt>=0))return m.textContent="Enter a valid amount.";d.querySelector("#bg").disabled=true;R.busy=true;m.style.color="var(--gold)";m.textContent="Adding booths…";
    try{const body=todo.map(o=>({booth_code:o.booth_code,kind,start_date:bs.value,monthly_amount:amt,paid_to:d.querySelector("#bt").value.trim()||null})),made=[];
      for(let i=0;i<body.length;i+=200){const{data,error}=await sb.from("rental_plans").insert(body.slice(i,i+200)).select();if(error)throw error;made.push(...data)}
      if(amt!==null){const today=iso(new Date()),paid=d.querySelector("#be").checked,rows=[];made.forEach(p=>periods(p,0,today).forEach(x=>rows.push(mkRow(p,x,paid&&x.e<=today))));m.textContent="Creating monthly records…";await insertRows(rows)}
      R.busy=false;d.close_();done()}catch(e){R.busy=false;d.querySelector("#bg").disabled=false;m.style.color="#ff8b9b";m.textContent="Could not add the booths. Nothing more was changed."}}}

function recDlg(p,r,m,o,done){
  const t0=iso(new Date());let st0=r?(r.cover_start||r.paid_on||m+"-01"):null;
  if(!st0){if(p.start_date){for(let n=0;n<900;n++){const s=addA(p.start_date,n);if(s.slice(0,7)==m){st0=s;break}if(s.slice(0,7)>m)break}}st0=st0||(m==t0.slice(0,7)?t0:m+"-01")}
  const anchored=p.start_date&&(()=>{for(let n=0;n<900;n++){if(addA(p.start_date,n)==st0)return n}return -1})(),due0=r&&r.due_date?r.due_date:(anchored>=0&&p.start_date?addA(p.start_date,anchored+1):addA(st0,1));let manual=!!(r&&r.due_date&&r.due_date!=addA(st0,1)&&!(anchored>=0&&r.due_date==addA(p.start_date,anchored+1)));
  const d=dlg(`<h4 style="margin:0 0 4px">${esc(p.booth_code)} — ${KIND[p.kind]}</h4><div class="chip">${esc(lab(m))}${o&&o.sr_name?" · "+esc(o.sr_name):""}</div>
  <div class="g2"><div><label>Amount (₱)</label><input type="number" id="ra" min="0" step="0.01" inputmode="decimal" value="${r?r.amount:(p.monthly_amount??"")}"></div><div><label>Status</label><select id="rs"><option value="unpaid"${!r||r.status=="unpaid"?" selected":""}>Unpaid</option><option value="paid"${r&&r.status=="paid"?" selected":""}>Paid</option></select></div></div>
  <div class="g2"><div><label>Payment / cover start date</label><input type="date" id="rd" value="${st0}"></div><div><label>Due date (set automatically)</label><input type="date" id="rdd" value="${due0}"></div></div>
  <div class="chip" id="rcv" style="margin-top:6px"></div>
  <div class="g2"><div><label>Paid to</label><input id="rp" value="${esc((r&&r.paid_to)||p.paid_to||"")}"></div><div><label>Note — optional</label><input id="rn" value="${esc(r?r.note||"":"")}"></div></div>
  <p style="color:var(--mu);font-size:12px;margin:6px 0 0">Pick the payment date and the due date becomes one month later (you can still change it). To change the amount for future months, edit the booth in Booth setup.</p>
  <div class="msg" id="rm2"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="rsv">Save</button><button class="ghost" id="rx">Cancel</button>${r?'<button class="ghost" id="rdl" style="margin-left:auto">Delete record</button>':""}</div>`);
  const sd=d.querySelector("#rd"),dd=d.querySelector("#rdd"),cv=d.querySelector("#rcv"),show=()=>cv.textContent=sd.value&&dd.value?"Cover period: "+fd(sd.value)+" → "+fd(dd.value):"";show();
  sd.oninput=()=>{if(sd.value&&!manual)dd.value=addA(sd.value,1);show()};dd.oninput=()=>{manual=true;show()};
  d.querySelector("#rx").onclick=d.close_;
  d.querySelector("#rsv").onclick=async()=>{const msg=d.querySelector("#rm2"),a=parseFloat(d.querySelector("#ra").value),s=sd.value,due=dd.value,paid=d.querySelector("#rs").value=="paid";
    if(!(a>=0))return msg.textContent="Enter the amount.";if(!s)return msg.textContent="Choose the payment date.";if(!due||due<s)return msg.textContent="The due date must be on or after the payment date.";
    const body={amount:a,status:paid?"paid":"unpaid",paid_on:paid?s:null,cover_start:s,due_date:due,period:s.slice(0,7)+"-01",paid_to:d.querySelector("#rp").value.trim()||null,note:d.querySelector("#rn").value.trim()||null};let error;
    if(r)({error}=await sb.from("rental_records").update(body).eq("id",r.id));else({error}=await sb.from("rental_records").insert({...body,plan_id:p.id}));
    if(error)return msg.textContent=/duplicate/i.test(error.message)?"This booth already has a record for "+lab(s.slice(0,7))+".":"Could not save.";R.m=s.slice(0,7);d.close_();done()};
  if(r)d.querySelector("#rdl").onclick=async()=>{if(!confirm("Delete this record?"))return;const{error}=await sb.from("rental_records").delete().eq("id",r.id);if(error)return d.querySelector("#rm2").textContent="Could not delete.";d.close_();done()}}

window.RENT_MATH.periods=periods;window.MODS=Object.assign(window.MODS||{},{[NAME]:rent});
})();
