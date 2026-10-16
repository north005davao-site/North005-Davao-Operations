(()=>{
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const money=n=>"₱"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fd=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return MN[m-1].slice(0,3)+" "+d+", "+y};
const addMonth=s=>{const[y,m,d]=s.split("-").map(Number),last=new Date(y,m+1,0).getDate();return iso(new Date(y,m,Math.min(d,last)))};
const cov=(a,b)=>a&&b?fd(a)+" → "+fd(b):"";
const KIND={rental:"Outlet Rental",load:"Load Allowance"};
const R={kind:"rental",tab:"rec",m:iso(new Date()).slice(0,7),q:"",sub:false};window.RENTS=R;
const MU=window.MUNI||{};
async function all(t){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select("*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
const lab=m=>{const[y,mm]=m.split("-").map(Number);return MN[mm-1]+" "+y};
function dlg(html){const d=document.createElement("dialog");d.innerHTML=html;document.body.appendChild(d);d.showModal();d.close_=()=>{d.close();d.remove()};return d}
function subscribe(){if(R.sub)return;R.sub=true;let tm;const f=()=>{clearTimeout(tm);tm=setTimeout(()=>{if(cur=="OUTLET RENTALS & LOAD ALLOWANCE"&&!document.querySelector("dialog[open]"))go(cur)},500)};
  sb.channel("rent").on("postgres_changes",{event:"*",schema:"public",table:"rental_plans"},f).on("postgres_changes",{event:"*",schema:"public",table:"rental_records"},f).subscribe()}
const pill=(t,c)=>`<span class="pill" style="background:${c}">${t}</span>`;
const muni=m=>MU[m]?pill(MU[m][0],MU[m][1]):esc(m||"");

async function rent(v){
  subscribe();const adm=me.role=="admin";v.innerHTML='<div class="empty">Loading…</div>';
  const[O,P,Rc]=await Promise.all([all("registry_outlets"),all("rental_plans"),sb.from("rental_records").select("*").eq("period",R.m+"-01").range(0,4999)]);
  const reg=new Map(O.map(o=>[o.booth_code,o])),plans=P.filter(p=>p.kind==R.kind),recBy=new Map((Rc.data||[]).map(r=>[r.plan_id,r]));
  const info=p=>{const o=reg.get(p.booth_code)||{};return{teller:o.sr_name||"",muni:o.municipality||"",coll:o.collector||""}};
  v.innerHTML=`<div class="tbar"><button class="chip2" data-k="rental">Outlet Rentals</button><button class="chip2" data-k="load">Load Allowance</button><span style="width:10px"></span><button class="chip2" data-t="rec">Monthly records</button><button class="chip2" data-t="set">Booth setup</button></div>
  <div class="tbar"><button class="chip2" id="pm">‹</button><b id="mt" style="min-width:150px;text-align:center">${lab(R.m)}</b><button class="chip2" id="nm">›</button><button class="ghost" id="tm">This month</button><input id="rq" placeholder="Search booth, teller, paid to…" value="${esc(R.q)}">${adm?'<button class="ghost" id="ab">+ Add Booth</button><button class="ghost" id="gn" hidden>Generate</button>':""}</div><div id="rk"></div><div id="rb"></div>`;
  v.querySelectorAll("[data-k]").forEach(b=>{b.classList.toggle("on",b.dataset.k==R.kind);b.onclick=()=>{R.kind=b.dataset.k;rent(v)}});
  v.querySelectorAll("[data-t]").forEach(b=>{b.classList.toggle("on",b.dataset.t==R.tab);b.onclick=()=>{R.tab=b.dataset.t;rent(v)}});
  const step=k=>{let[y,m]=R.m.split("-").map(Number);m+=k;if(m<1){m=12;y--}if(m>12){m=1;y++}R.m=y+"-"+String(m).padStart(2,"0");rent(v)};
  $("#pm").onclick=()=>step(-1);$("#nm").onclick=()=>step(1);$("#tm").onclick=()=>{R.m=iso(new Date()).slice(0,7);rent(v)};
  const key="rent_"+R.kind+R.tab;$("#rq").oninput=e=>{R.q=e.target.value;PAGER.reset(key);draw()};
  if(adm)$("#ab").onclick=()=>planDlg(null,O,()=>rent(v),R.kind);
  const missing=plans.filter(p=>p.active&&!recBy.has(p.id)&&p.monthly_amount!=null);
  if(adm&&R.tab=="rec"&&missing.length){const g=$("#gn");g.hidden=false;g.textContent=`Generate ${lab(R.m)} (${missing.length})`;
    g.onclick=async()=>{g.disabled=true;const prevR=(await sb.from("rental_records").select("plan_id,period,due_date").lt("period",R.m+"-01").order("period",{ascending:false}).range(0,4999)).data||[],lastBy=new Map();prevR.forEach(x=>{if(!lastBy.has(x.plan_id))lastBy.set(x.plan_id,x)});
      const rows=missing.map(p=>{const pr=lastBy.get(p.id),cs=pr&&pr.due_date&&pr.due_date.slice(0,7)==R.m?pr.due_date:R.m+"-01";return{plan_id:p.id,period:R.m+"-01",cover_start:cs,due_date:addMonth(cs),amount:p.monthly_amount,paid_to:p.paid_to||null}});
      const{error}=await sb.from("rental_records").upsert(rows,{onConflict:"plan_id,period",ignoreDuplicates:true});if(error){g.disabled=false;return alert("Could not generate records.")}rent(v)}}
  const draw=()=>{const q=R.q.toLowerCase(),match=(p,r)=>!q||[p.booth_code,info(p).teller,(r&&r.paid_to)||p.paid_to||""].join(" ").toLowerCase().includes(q);
    if(R.tab=="set"){$("#rk").innerHTML="";const f=plans.filter(p=>match(p,null)),pg=PAGER.paginate(key,f);
      $("#rb").innerHTML=f.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Municipality</th><th>Default monthly amount</th><th>Paid to</th><th>Status</th></tr></thead><tbody>${pg.slice.map(p=>{const i=info(p);return`<tr data-p="${p.id}"${adm?' style="cursor:pointer"':""}><td><b>${esc(p.booth_code)}</b></td><td>${esc(i.teller)}</td><td>${muni(i.muni)}</td><td>${p.monthly_amount!=null?money(p.monthly_amount):'<span style="color:var(--mu)">varies</span>'}</td><td>${esc(p.paid_to||"")}</td><td>${p.active?pill("Active","#22c55e"):pill("Inactive","#94a3b8")}</td></tr>`}).join("")}</tbody></table></div>`+pg.bar:`<div class="empty"><b>${KIND[R.kind]}</b><br>No booths set up yet.${adm?" Use “+ Add Booth” to start.":""}</div>`;
      if(adm)$("#rb").querySelectorAll("tr[data-p]").forEach(t=>t.onclick=()=>planDlg(plans.find(p=>p.id==t.dataset.p),O,()=>rent(v),R.kind));PAGER.bind($("#rb"),pg.st,draw);return}
    const all2=plans.filter(p=>p.active||recBy.has(p.id)).map(p=>({p,r:recBy.get(p.id)})),rows=all2.filter(x=>match(x.p,x.r)),pg=PAGER.paginate(key,rows);
    const due=all2.reduce((s,x)=>s+(x.r?Number(x.r.amount):0),0),paid=all2.reduce((s,x)=>s+(x.r&&x.r.status=="paid"?Number(x.r.amount):0),0),nog=all2.filter(x=>!x.r).length;
    $("#rk").innerHTML=`<div class="kpis" style="margin-bottom:12px"><div class="kpi"><small>Total for ${lab(R.m)}</small><b>${money(due)}</b></div><div class="kpi"><small>Paid</small><b>${money(paid)}</b></div><div class="kpi"><small>Unpaid</small><b>${money(due-paid)}</b></div><div class="kpi"><small>Booths</small><b>${all2.length}</b>${nog?`<small>${nog} without a record</small>`:""}</div></div>`;
    $("#rb").innerHTML=rows.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Municipality</th><th>Paid to</th><th>Amount</th><th>Status</th><th>Cover period</th></tr></thead><tbody>${pg.slice.map(({p,r})=>{const i=info(p);return`<tr data-p="${p.id}"${adm?' style="cursor:pointer"':""}><td><b>${esc(p.booth_code)}</b></td><td>${esc(i.teller)}</td><td>${muni(i.muni)}</td><td>${esc((r&&r.paid_to)||p.paid_to||"")}</td><td>${r?money(r.amount):'<span style="color:var(--mu)">—</span>'}</td><td>${r?(r.status=="paid"?pill("Paid","#22c55e"):(r.due_date&&r.due_date<iso(new Date())?pill("Overdue","#ef4444"):pill("Unpaid","#f59e0b"))):pill("No record","#94a3b8")}</td><td>${r?cov(r.cover_start,r.due_date):""}</td></tr>`}).join("")}</tbody></table></div>`+pg.bar:`<div class="empty"><b>${KIND[R.kind].toUpperCase()}</b><br>No booths set up yet.${adm?" Use “+ Add Booth” to start.":""}</div>`;
    if(adm)$("#rb").querySelectorAll("tr[data-p]").forEach(t=>t.onclick=()=>{const p=plans.find(x=>x.id==t.dataset.p);recDlg(p,recBy.get(p.id),R.m,reg.get(p.booth_code),()=>rent(v))});PAGER.bind($("#rb"),pg.st,draw)};
  draw()}

function planDlg(p,O,done,kind){
  const d=dlg(`<h4 style="margin:0 0 6px">${p?"Edit":"Add"} booth — ${KIND[p?p.kind:kind]}</h4>${p?`<div class="chip">${esc(p.booth_code)}</div>`:`<label>Booth code</label><input id="pb" list="bl" placeholder="Type or pick a booth code"><datalist id="bl">${O.map(o=>`<option value="${esc(o.booth_code)}">${esc(o.sr_name||"")}</option>`).join("")}</datalist>`}
  <label>Default monthly amount (₱) — optional, leave blank if it varies</label><input type="number" id="pa" min="0" step="0.01" inputmode="decimal" value="${p&&p.monthly_amount!=null?p.monthly_amount:""}">
  <label>Paid to (landowner / payee) — optional</label><input id="pt" value="${esc(p?p.paid_to||"":"")}"><label>Note — optional</label><input id="pn" value="${esc(p?p.note||"":"")}">
  ${p?`<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" id="pc" style="width:auto"${p.active?" checked":""}> Active</label><p style="color:var(--mu);font-size:12px;margin:6px 0 0">Changing the default amount only affects months generated from now on. Existing monthly records keep their amount.</p>`:""}
  <div class="msg" id="pm2"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="ps">Save</button><button class="ghost" id="px">Cancel</button>${p?'<button class="ghost" id="pd" style="margin-left:auto">Delete</button>':""}</div>`);
  d.querySelector("#px").onclick=d.close_;
  d.querySelector("#ps").onclick=async()=>{const m=d.querySelector("#pm2"),a=d.querySelector("#pa").value.trim(),body={monthly_amount:a===""?null:parseFloat(a),paid_to:d.querySelector("#pt").value.trim()||null,note:d.querySelector("#pn").value.trim()||null};
    if(body.monthly_amount!==null&&!(body.monthly_amount>=0))return m.textContent="Enter a valid amount.";let error;
    if(p){body.active=d.querySelector("#pc").checked;({error}=await sb.from("rental_plans").update(body).eq("id",p.id))}
    else{const code=d.querySelector("#pb").value.trim().toUpperCase();if(!O.some(o=>o.booth_code==code))return m.textContent="Choose a booth code from Master Registry.";({error}=await sb.from("rental_plans").insert({...body,booth_code:code,kind}))}
    if(error)return m.textContent=/duplicate/i.test(error.message)?"That booth is already set up for "+KIND[kind]+".":"Could not save.";d.close_();done()};
  if(p)d.querySelector("#pd").onclick=async()=>{if(!confirm("Delete this booth and ALL its monthly records?"))return;const{error}=await sb.from("rental_plans").delete().eq("id",p.id);if(error)return d.querySelector("#pm2").textContent="Could not delete.";d.close_();done()}}

function recDlg(p,r,m,o,done){
  const t0=iso(new Date()),st0=r?(r.cover_start||r.paid_on||m+"-01"):(m==t0.slice(0,7)?t0:m+"-01"),due0=r?(r.due_date||addMonth(st0)):addMonth(st0);let manual=!!(r&&r.due_date&&r.due_date!=addMonth(st0));
  const d=dlg(`<h4 style="margin:0 0 4px">${esc(p.booth_code)} — ${KIND[p.kind]}</h4><div class="chip">${esc(lab(m))}${o&&o.sr_name?" · "+esc(o.sr_name):""}</div>
  <div class="g2"><div><label>Amount (₱)</label><input type="number" id="ra" min="0" step="0.01" inputmode="decimal" value="${r?r.amount:(p.monthly_amount??"")}"></div><div><label>Status</label><select id="rs"><option value="unpaid"${!r||r.status=="unpaid"?" selected":""}>Unpaid</option><option value="paid"${r&&r.status=="paid"?" selected":""}>Paid</option></select></div></div>
  <div class="g2"><div><label>Payment / cover start date</label><input type="date" id="rd" value="${st0}"></div><div><label>Due date (set automatically)</label><input type="date" id="rdd" value="${due0}"></div></div>
  <div class="chip" id="rcv" style="margin-top:6px"></div>
  <div class="g2"><div><label>Paid to</label><input id="rp" value="${esc((r&&r.paid_to)||p.paid_to||"")}"></div><div><label>Note — optional</label><input id="rn" value="${esc(r?r.note||"":"")}"></div></div>
  <p style="color:var(--mu);font-size:12px;margin:6px 0 0">Pick the payment date and the due date becomes one month later (you can still change it). To change the default amount for future months, edit the booth in Booth setup.</p>
  <div class="msg" id="rm2"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="rsv">Save</button><button class="ghost" id="rx">Cancel</button>${r?'<button class="ghost" id="rdl" style="margin-left:auto">Delete record</button>':""}</div>`);
  const sd=d.querySelector("#rd"),dd=d.querySelector("#rdd"),cv=d.querySelector("#rcv"),show=()=>cv.textContent=sd.value&&dd.value?"Cover period: "+fd(sd.value)+" → "+fd(dd.value):"";show();
  sd.oninput=()=>{if(sd.value&&!manual)dd.value=addMonth(sd.value);show()};dd.oninput=()=>{manual=true;show()};
  d.querySelector("#rx").onclick=d.close_;
  d.querySelector("#rsv").onclick=async()=>{const msg=d.querySelector("#rm2"),a=parseFloat(d.querySelector("#ra").value),s=sd.value,due=dd.value,paid=d.querySelector("#rs").value=="paid";
    if(!(a>=0))return msg.textContent="Enter the amount.";if(!s)return msg.textContent="Choose the payment date.";if(!due||due<s)return msg.textContent="The due date must be on or after the payment date.";
    const body={amount:a,status:paid?"paid":"unpaid",paid_on:paid?s:null,cover_start:s,due_date:due,period:s.slice(0,7)+"-01",paid_to:d.querySelector("#rp").value.trim()||null,note:d.querySelector("#rn").value.trim()||null};let error;
    if(r)({error}=await sb.from("rental_records").update(body).eq("id",r.id));else({error}=await sb.from("rental_records").insert({...body,plan_id:p.id}));
    if(error)return msg.textContent=/duplicate/i.test(error.message)?"This booth already has a record for "+lab(s.slice(0,7))+".":"Could not save.";R.m=s.slice(0,7);d.close_();done()};
  if(r)d.querySelector("#rdl").onclick=async()=>{if(!confirm("Delete this record?"))return;const{error}=await sb.from("rental_records").delete().eq("id",r.id);if(error)return d.querySelector("#rm2").textContent="Could not delete.";d.close_();done()}}

window.MODS=Object.assign(window.MODS||{},{"OUTLET RENTALS & LOAD ALLOWANCE":rent});
})();
