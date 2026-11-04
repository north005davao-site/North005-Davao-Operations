(()=>{
const MN=["January","February","March","April","May","June","July","August","September","October","November","December"];
const money=n=>"₱"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const short=n=>Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2});
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fd=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return MN[m-1].slice(0,3)+" "+d+", "+y};
const ERR={OVERPAY:"That payment is more than the remaining balance.",BEFORE_TAKEN:"A payment can't be dated before the cash advance was taken.",BELOW_PAID:"The amount can't be lower than what has already been paid."};
const emsg=e=>{const m=(e&&e.message)||"";for(const k in ERR)if(m.includes(k))return ERR[k];return(e&&e.message)||"Something went wrong. Please try again."};
const C={view:"list",tab:"list",id:null,m:null,q:"",st:"",coll:"",sub:false};window.CAS=C;

// Status calculation: Unpaid, Partially Paid, Paid
const isPaid=r=>Number(r.paid||0)>=Number(r.amount||0);
const open=r=>!isPaid(r);
const statusOf=r=>{
  const p=Number(r.paid||0),a=Number(r.amount||0);
  if(p>=a)return"Paid";
  if(p>0)return"Partially Paid";
  return"Unpaid";
};
const pill=r=>{
  const st=statusOf(r);
  if(st==="Paid")return'<span class="pill" style="background:#22c55e;color:#fff;font-weight:600">Paid</span>';
  if(st==="Partially Paid")return'<span class="pill" style="background:#f59e0b;color:#1a1300;font-weight:600">Partially Paid</span>';
  return'<span class="pill" style="background:#ef4444;color:#fff;font-weight:600">Unpaid</span>';
};
const caRef=r=>"CA-"+(r.id&&r.id.length>8?r.id.slice(0,8).toUpperCase():String(r.id||"001").padStart(3,"0"));
const caNorm=s=>String(s||"").trim().replace(/\s+/g," ").toUpperCase();

function dlg(html){const d=document.createElement("dialog");d.innerHTML=html;document.body.appendChild(d);d.showModal();d.close_=()=>{d.close();d.remove()};return d}
function subscribe(){if(C.sub)return;C.sub=true;let tm;const f=()=>{clearTimeout(tm);tm=setTimeout(()=>{if(!QUIETW()&&cur=="CASH ADVANCE (C.A) & PAYMENTS"&&!document.querySelector("dialog[open]"))go(cur)},500)};
  sb.channel("ca").on("postgres_changes",{event:"*",schema:"public",table:"cash_advances"},f).on("postgres_changes",{event:"*",schema:"public",table:"ca_payments"},f).subscribe()}

// Helper: Calculate collector-level running financial summaries
function calcCollectorSummaries(rows){
  const byCol=new Map();
  rows.forEach(r=>{
    const name=r.collector_name||"Unknown";
    const key=caNorm(name);
    const amt=Number(r.amount||0),paid=Number(r.paid||0),rem=Math.max(0,amt-paid);
    if(!byCol.has(key)){
      byCol.set(key,{name,collector_id:r.collector_id,totalAdv:0,totalPaid:0,remBalance:0,count:0,openCount:0,paidCount:0,advances:[]});
    }
    const c=byCol.get(key);
    c.totalAdv+=amt;
    c.totalPaid+=paid;
    c.remBalance+=rem;
    c.count++;
    if(rem>0)c.openCount++;else c.paidCount++;
    c.advances.push(r);
  });
  return byCol;
}

async function ca(v){subscribe();return C.view=="detail"&&C.id?detail(v):list(v)}

async function list(v){
  const adm=me.role=="admin";
  LOAD(v);
  const{data}=await sb.from("ca_summary").select("*").order("taken_on",{ascending:false}).range(0,999);
  const rows=data||[];
  
  // Calculate running balances (Level 1: Individual, Level 2: Collector Overall)
  const summaries=calcCollectorSummaries(rows);
  const tA=rows.reduce((s,r)=>s+Number(r.amount||0),0);
  const tP=rows.reduce((s,r)=>s+Number(r.paid||0),0);
  const tRem=Math.max(0,tA-tP);
  const nOpen=rows.filter(open).length;
  const nPaid=rows.filter(isPaid).length;
  
  // Collect unique collectors for filter dropdown
  const collectorNames=[...summaries.values()].map(c=>c.name).sort();

  v.innerHTML=`
  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><small>Total Cash Advances</small><b>${rows.length}</b></div>
    <div class="kpi"><small>Total Amount Advanced</small><b>${money(tA)}</b></div>
    <div class="kpi"><small>Total Amount Paid</small><b>${money(tP)}</b></div>
    <div class="kpi"><small>Total Outstanding Balance</small><b style="color:${tRem>0?'var(--gold)':'#22c55e'}">${money(tRem)}</b></div>
    <div class="kpi"><small>Open Advances</small><b style="color:${nOpen>0?'#f59e0b':'#22c55e'}">${nOpen}</b></div>
    <div class="kpi"><small>Fully Paid Advances</small><b style="color:#22c55e">${nPaid}</b></div>
  </div>

  <div class="tbar" style="margin-bottom:10px">
    <button class="chip2${C.tab==='list'?' on':''}" id="ca-tab-list">All Cash Advances (${rows.length})</button>
    <button class="chip2${C.tab==='summary'?' on':''}" id="ca-tab-sum">Collector Financial Summary (${summaries.size})</button>
    ${adm?'<button class="ghost" id="cn" style="margin-left:auto;font-weight:600;border-color:var(--gold);color:var(--gold)">+ New Cash Advance</button>':""}
  </div>

  <div class="tbar" style="gap:8px">
    <input id="cq" placeholder="Search collector, note, or ref…" value="${esc(C.q)}" style="flex:2;min-width:180px">
    <select id="ccoll" style="flex:1;min-width:160px">
      <option value="">All Collectors</option>
      ${collectorNames.map(cn=>`<option value="${esc(cn)}"${C.coll===cn?' selected':''}>${esc(cn)}</option>`).join("")}
    </select>
    <select id="cs" style="flex:1;min-width:150px">
      <option value="">All Statuses</option>
      <option value="open"${C.st=="open"?" selected":""}>Open (Unpaid & Partial)</option>
      <option value="unpaid"${C.st=="unpaid"?" selected":""}>Unpaid Only</option>
      <option value="partial"${C.st=="partial"?" selected":""}>Partially Paid Only</option>
      <option value="paid"${C.st=="paid"?" selected":""}>Fully Paid Only</option>
    </select>
    ${(C.q||C.st||C.coll)?'<button class="ghost" id="ca-clear-filt" title="Clear filters">Clear</button>':''}
  </div>

  <div id="ct"></div>`;

  const drawList=()=>{
    const q=C.q.toLowerCase();
    const f=rows.filter(r=>{
      const matchQ=!q||(r.collector_name+" "+(r.note||"")+" "+caRef(r)).toLowerCase().includes(q);
      const matchColl=!C.coll||caNorm(r.collector_name)===caNorm(C.coll);
      const st=statusOf(r);
      const matchSt=!C.st||
        (C.st==="open"&&open(r))||
        (C.st==="unpaid"&&st==="Unpaid")||
        (C.st==="partial"&&st==="Partially Paid")||
        (C.st==="paid"&&st==="Paid");
      return matchQ&&matchColl&&matchSt;
    });

    const pg=PAGER.paginate("ca",f);
    $("#ct").innerHTML=f.length?`
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Collector</th>
              <th>Date Taken</th>
              <th>Advance Amount</th>
              <th>Paid</th>
              <th>Remaining Balance</th>
              <th>Collector Overall Bal</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${pg.slice.map(r=>{
              const rem=Math.max(0,Number(r.amount||0)-Number(r.paid||0));
              const colSum=summaries.get(caNorm(r.collector_name));
              const colBal=colSum?colSum.remBalance:rem;
              return `<tr data-i="${r.id}" style="cursor:pointer">
                <td><span class="chip" style="font-family:monospace;font-weight:700">${esc(caRef(r))}</span></td>
                <td><b>${esc(r.collector_name)}</b></td>
                <td>${fd(r.taken_on)}</td>
                <td>${money(r.amount)}</td>
                <td>${money(r.paid)}</td>
                <td><b style="color:${rem>0?'#f59e0b':'#22c55e'}">${money(rem)}</b></td>
                <td><span class="chip" style="color:${colBal>0?'var(--gold)':'#22c55e'}">${money(colBal)}</span></td>
                <td>${pill(r)}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`+pg.bar:`<div class="empty"><b>CASH ADVANCE (C.A) &amp; PAYMENTS</b><br>No cash advances match your criteria.${adm?" Use “+ New Cash Advance” to add one.":""}</div>`;

    $("#ct").querySelectorAll("tr[data-i]").forEach(t=>t.onclick=()=>{C.view="detail";C.id=t.dataset.i;C.m=null;go(cur)});
    PAGER.bind($("#ct"),pg.st,drawList);
  };

  const drawSummary=()=>{
    const q=C.q.toLowerCase();
    const list=[...summaries.values()].filter(c=>!q||c.name.toLowerCase().includes(q));
    const pg=PAGER.paginate("ca_sum",list);

    $("#ct").innerHTML=list.length?`
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Collector</th>
              <th>Total Advances</th>
              <th>Open Advances</th>
              <th>Total Advanced</th>
              <th>Total Paid</th>
              <th>Overall Outstanding Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${pg.slice.map(c=>`<tr>
              <td><b>${esc(c.name)}</b></td>
              <td>${c.count}</td>
              <td>${c.openCount>0?`<span class="pill" style="background:#f59e0b">${c.openCount} open</span>`:'<span class="chip">0</span>'}</td>
              <td>${money(c.totalAdv)}</td>
              <td>${money(c.totalPaid)}</td>
              <td><b style="font-size:15px;color:${c.remBalance>0?'var(--gold)':'#22c55e'}">${money(c.remBalance)}</b></td>
              <td>${c.remBalance>0?'<span class="pill" style="background:#ef4444;color:#fff">Has Balance</span>':'<span class="pill" style="background:#22c55e;color:#fff">Clear</span>'}</td>
              <td><button class="ghost" data-filter-col="${esc(c.name)}" style="padding:4px 10px;font-size:12px">View Advances</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`+pg.bar:`<div class="empty">No collector summaries found.</div>`;

    $("#ct").querySelectorAll("[data-filter-col]").forEach(b=>b.onclick=()=>{
      C.coll=b.dataset.filterCol;
      C.tab="list";
      $("#ca-tab-list").classList.add("on");
      $("#ca-tab-sum").classList.remove("on");
      $("#ccoll").value=C.coll;
      draw();
    });
    PAGER.bind($("#ct"),pg.st,drawSummary);
  };

  const draw=()=>{
    if(C.tab==="summary")drawSummary();
    else drawList();
  };

  $("#cq").oninput=e=>{C.q=e.target.value;PAGER.reset("ca");PAGER.reset("ca_sum");draw()};
  $("#cs").onchange=e=>{C.st=e.target.value;PAGER.reset("ca");draw()};
  $("#ccoll").onchange=e=>{C.coll=e.target.value;PAGER.reset("ca");draw()};
  const clr=$("#ca-clear-filt");if(clr)clr.onclick=()=>{C.q="";C.st="";C.coll="";$("#cq").value="";$("#cs").value="";$("#ccoll").value="";draw()};

  $("#ca-tab-list").onclick=()=>{C.tab="list";$("#ca-tab-list").classList.add("on");$("#ca-tab-sum").classList.remove("on");draw()};
  $("#ca-tab-sum").onclick=()=>{C.tab="summary";$("#ca-tab-sum").classList.add("on");$("#ca-tab-list").classList.remove("on");draw()};

  if(adm)$("#cn").onclick=()=>newCA(rows,summaries,()=>list(v));
  draw();
}

async function newCA(rows,summaries,done){
  // Collectors MUST map to a real profile UUID: cash_advances.collector_id is a uuid column.
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const[{data:profiles},{data:Ot}]=await Promise.all([
    sb.from("profiles").select("id,full_name,username,role,status").eq("role","collector").order("full_name"),
    sb.from("registry_outlets").select("collector").not("collector","is",null)
  ]);
  const byName=new Map();
  (profiles||[]).forEach(p=>{
    if(!p.id||!UUID.test(p.id))return;
    const nm=String(p.full_name||p.username||"").trim();
    if(!nm)return;
    byName.set(caNorm(nm),{id:p.id,name:nm,active:String(p.status||"").toLowerCase()==="active"});
  });
  let cs=[...byName.values()].filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name));
  if(!cs.length)cs=[...byName.values()].sort((a,b)=>a.name.localeCompare(b.name));
  // Registry collectors without a login account cannot be referenced (no uuid) — list them instead of inventing ids
  const noProfile=[];
  (Ot||[]).forEach(o=>{
    const n=String(o.collector||"").trim();
    if(!n)return;
    const k=caNorm(n);
    if(!byName.has(k)&&!noProfile.some(m=>caNorm(m)===k))noProfile.push(n);
  });
  if(!cs||!cs.length){
    const d=dlg(`<h4 style="margin:0 0 8px">New cash advance</h4><p>There are no active collector accounts yet. Add a collector under User Management first.</p><button class="ghost" id="x">Close</button>`);
    d.querySelector("#x").onclick=d.close_;return;
  }

  // Calculate each collector's current running overall balance to display informatively (NEVER BLOCKS)
  const colBals=summaries||calcCollectorSummaries(rows);

  const d=dlg(`
    <h4 style="margin:0 0 6px">New cash advance</h4>
    <p style="font-size:12.5px;color:var(--mu);margin:0 0 10px">Collectors can receive multiple cash advances across different dates. Previous balances are tracked independently.</p>
    ${noProfile.length?"<p style=\"font-size:12px;color:#f59e0b;margin:0 0 10px\">Not listed — no login account yet: "+esc(noProfile.join(", "))+"</p>":""}
    <label>Collector</label>
    <select id="nc">
      ${cs.map(c=>{
        const sum=colBals.get(caNorm(c.name));
        const remBal=sum?sum.remBalance:0;
        const note=remBal>0?` — has unpaid balance (${money(remBal)})`:` — No outstanding balance`;
        return `<option value="${c.id}" data-name="${esc(c.name)}">${esc(c.name)}${note}</option>`;
      }).join("")}
    </select>
    <div class="g2" style="margin-top:10px">
      <div><label>Date taken</label><input type="date" id="nd" value="${iso(new Date())}"></div>
      <div><label>Amount (₱)</label><input type="number" id="na" min="1" step="0.01" inputmode="decimal" placeholder="0.00"></div>
    </div>
    <label style="margin-top:10px">Note (optional)</label>
    <input id="nt" placeholder="Purpose or reference details…">
    <div class="msg" id="nm"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn" id="ns">Save Cash Advance</button>
      <button class="ghost" id="nx">Cancel</button>
    </div>
  `);

  d.querySelector("#nx").onclick=d.close_;
  d.querySelector("#ns").onclick=async()=>{
    const m=d.querySelector("#nm"),sel=d.querySelector("#nc"),opt=sel.options[sel.selectedIndex];
    const id=sel.value,name=opt.dataset.name;
    const a=parseFloat(d.querySelector("#na").value),dt=d.querySelector("#nd").value;

    if(!(a>0))return m.textContent="Please enter a valid advance amount greater than 0.";
    if(!dt)return m.textContent="Please choose the date taken.";
    if(!UUID.test(id))return m.textContent="This collector has no login account with a profile ID, so the advance cannot be saved.";

    m.style.color="var(--gold)";m.textContent="Saving cash advance…";
    
    // Multiple advances per collector are explicitly allowed!
    // Insert new independent transaction record into cash_advances
    const payload={
      collector_id: id,
      collector_name: name,
      taken_on: dt,
      amount: a,
      note: d.querySelector("#nt").value.trim()||null,
      created_by: me.id
    };

    const{error}=await sb.from("cash_advances").insert(payload);
    if(error){
      m.style.color="#ff8b9b";
      return m.textContent=emsg(error);
    }
    d.close_();
    done();
  };
}

async function detail(v){
  const adm=me.role=="admin";
  const[A,P,AllCA]=await Promise.all([
    sb.from("ca_summary").select("*").eq("id",C.id).maybeSingle(),
    sb.from("ca_payments").select("*").eq("ca_id",C.id).order("paid_on"),
    sb.from("ca_summary").select("*").range(0,999)
  ]);

  if(!A.data){C.view="list";C.id=null;return list(v)}
  const r=A.data,pays=P.data||[],paid=Number(r.paid||0),amt=Number(r.amount||0),rem=Math.max(0,amt-paid);

  // Level 2: Calculate collector's overall running balance across all their advances
  const allRows=AllCA.data||[];
  const collectorAdvances=allRows.filter(x=>caNorm(x.collector_name)===caNorm(r.collector_name));
  const colTotalAdv=collectorAdvances.reduce((s,x)=>s+Number(x.amount||0),0);
  const colTotalPaid=collectorAdvances.reduce((s,x)=>s+Number(x.paid||0),0);
  const colOverallRem=Math.max(0,colTotalAdv-colTotalPaid);

  if(!C.m){
    const base=pays.length?pays[pays.length-1].paid_on:iso(new Date()),today=iso(new Date());
    C.m=(rem>0&&today>=r.taken_on?today:base>=r.taken_on?base:r.taken_on).slice(0,7);
  }

  v.innerHTML=`
  <div class="tbar">
    <button class="ghost" id="bk2">← Back to list</button>
    <span class="chip" style="font-family:monospace;font-weight:700">${esc(caRef(r))}</span>
    <b style="font-size:16px">${esc(r.collector_name)}</b>
    ${pill(r)}
    <span class="chip">Taken ${fd(r.taken_on)}</span>
    ${adm?'<button class="ghost" id="ed" style="margin-left:auto">Edit</button><button class="ghost" id="dl">Delete</button>':""}
  </div>
  ${r.note?`<div class="chip" style="margin:-4px 0 10px">Note: ${esc(r.note)}</div>`:""}

  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><small>This Advance Amount</small><b>${money(amt)}</b></div>
    <div class="kpi"><small>Total Paid on This Advance</small><b>${money(paid)}</b></div>
    <div class="kpi"><small>This Advance Remaining Balance</small><b style="color:${rem>0?'#f59e0b':'#22c55e'}">${money(rem)}</b></div>
    <div class="kpi"><small>${esc(r.collector_name)}’s Overall Outstanding Balance</small><b style="color:${colOverallRem>0?'var(--gold)':'#22c55e'}">${money(colOverallRem)}</b><span class="chip" style="font-size:11px">${collectorAdvances.length} advance(s) total</span></div>
  </div>
  <div class="prog" style="margin:0 0 18px"><i style="width:${Math.min(100,amt>0?paid/amt*100:0)}%"></i></div>

  <div class="ca-detail-grid">
    <div>
      <h4 class="h" style="margin-top:0">Payments History (${pays.length})</h4>
      <div id="pl"></div>
    </div>
    <div>
      <div class="box ca-box-cal" style="margin:0">
        <div class="ca-cal-hdr">
          <div class="ca-cal-nav">
            <button class="chip2" id="pm" aria-label="Previous month">‹</button>
            <b id="mt"></b>
            <button class="chip2" id="nm2" aria-label="Next month">›</button>
          </div>
          <div class="ca-cal-meta">
            <span class="chip" id="ms"></span>
            ${adm?'<span class="chip">Click a day to record a payment</span>':""}
          </div>
        </div>
        <div id="cal"></div>
      </div>
    </div>
  </div>`;

  $("#bk2").onclick=()=>{C.view="list";C.id=null;go(cur)};
  if(adm){
    $("#ed").onclick=()=>editCA(r,()=>detail(v));
    $("#dl").onclick=async()=>{
      if(!confirm(`Delete Cash Advance ${caRef(r)} for ${r.collector_name} and all associated payment records?`))return;
      const{error}=await sb.from("cash_advances").delete().eq("id",r.id);
      if(error)return alert("Could not delete cash advance.");
      C.view="list";C.id=null;go(cur);
    };
  }

  const map=new Map(pays.map(p=>[p.paid_on,p]));
  const calDraw=()=>{
    let[y,m]=C.m.split("-").map(Number);const first=new Date(y,m-1,1).getDay(),days=new Date(y,m,0).getDate(),today=iso(new Date());
    let cells="",tot=0;
    for(let i=0;i<first;i++)cells+='<div class="cd x"></div>';
    for(let d=1;d<=days;d++){
      const ds=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`,p=map.get(ds),off=ds<r.taken_on;
      if(p)tot+=Number(p.amount||0);
      cells+=`<div class="cd${p?" paid":""}${off?" off":""}${ds==today?" today":""}${adm&&!off?" ck":""}" data-d="${ds}"><span>${d}</span>${ds==r.taken_on?"<i>Taken</i>":""}${p?`<b>${short(p.amount)}</b>`:""}</div>`;
    }
    $("#mt").textContent=MN[m-1]+" "+y;
    $("#ms").textContent="Paid this month: "+money(tot);
    $("#cal").innerHTML='<div class="calg">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(w=>`<div class="wd">${w}</div>`).join("")+cells+"</div>";
    if(adm)$("#cal").querySelectorAll(".cd.ck").forEach(c=>c.onclick=()=>payDlg(r,rem,map.get(c.dataset.d),c.dataset.d,()=>detail(v)));
  };

  const step=k=>{let[y,m]=C.m.split("-").map(Number);m+=k;if(m<1){m=12;y--}if(m>12){m=1;y++}C.m=y+"-"+String(m).padStart(2,"0");calDraw()};
  $("#pm").onclick=()=>step(-1);
  $("#nm2").onclick=()=>step(1);
  calDraw();

  const plDraw=()=>{
    let runBal=amt;
    const list=[...pays].map(p=>{
      runBal=Math.max(0,runBal-Number(p.amount||0));
      return{...p,runBal};
    }).reverse();
    const pg=PAGER.paginate("capay",list);

    $("#pl").innerHTML=list.length?`
      <div class="tw">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount Paid</th>
              <th>Balance After</th>
              ${adm?'<th></th>':''}
            </tr>
          </thead>
          <tbody>
            ${pg.slice.map(p=>`<tr>
              <td>${fd(p.paid_on)}</td>
              <td><b>${money(p.amount)}</b></td>
              <td>${money(p.runBal)}</td>
              ${adm?`<td><button class="ghost" data-pay-edit="${p.id}" data-ds="${p.paid_on}" style="padding:2px 8px;font-size:12px">Edit</button></td>`:''}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`+pg.bar:'<div class="empty">No payments recorded yet. Click a date on the calendar to record a payment.</div>';

    if(adm){
      $("#pl").querySelectorAll("[data-pay-edit]").forEach(b=>{
        b.onclick=()=>{
          const p=pays.find(x=>x.id==b.dataset.payEdit);
          payDlg(r,rem,p,b.dataset.ds,()=>detail(v));
        };
      });
    }
    PAGER.bind($("#pl"),pg.st,plDraw);
  };
  plDraw();
}

function payDlg(r,rem,p,ds,done){
  const max=rem+(p?Number(p.amount):0);
  const d=dlg(`
    <h4 style="margin:0 0 4px">Payment — ${fd(ds)}</h4>
    <div class="chip" style="margin-bottom:8px">Collector: <b>${esc(r.collector_name)}</b> · Advance ${esc(caRef(r))} · Max payment: ${money(max)}</div>
    <label>Amount paid (₱)</label>
    <input type="number" id="pa" min="0" step="0.01" inputmode="decimal" value="${p?p.amount:""}" placeholder="0.00">
    <div class="msg" id="pmsg"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn" id="ps">Save Payment</button>
      <button class="ghost" id="px">Cancel</button>
      ${p?'<button class="ghost" id="pd" style="margin-left:auto;color:#ef4444">Remove payment</button>':""}
    </div>
  `);

  d.querySelector("#px").onclick=d.close_;
  d.querySelector("#pa").focus();

  d.querySelector("#ps").onclick=async()=>{
    const m=d.querySelector("#pmsg"),a=parseFloat(d.querySelector("#pa").value);
    let error;
    if(!(a>0)){
      if(!p)return m.textContent="Enter an amount greater than 0, or cancel.";
      ({error}=await sb.from("ca_payments").delete().eq("id",p.id));
    } else if(a>max+0.0001){
      return m.textContent="That is more than the remaining balance ("+money(max)+").";
    } else if(p){
      ({error}=await sb.from("ca_payments").update({amount:a}).eq("id",p.id));
    } else {
      ({error}=await sb.from("ca_payments").insert({ca_id:r.id,paid_on:ds,amount:a,created_by:me.id}));
    }
    if(error)return m.textContent=emsg(error);
    d.close_();
    done();
  };

  if(p){
    d.querySelector("#pd").onclick=async()=>{
      if(!confirm("Remove this payment of "+money(p.amount)+"?"))return;
      const{error}=await sb.from("ca_payments").delete().eq("id",p.id);
      if(error)return d.querySelector("#pmsg").textContent=emsg(error);
      d.close_();
      done();
    };
  }
}

function editCA(r,done){
  const d=dlg(`
    <h4 style="margin:0 0 6px">Edit Cash Advance — ${esc(r.collector_name)}</h4>
    <div class="chip" style="margin-bottom:8px">Reference: ${esc(caRef(r))}</div>
    <div class="g2">
      <div><label>Date taken</label><input type="date" id="ed1" value="${r.taken_on}"></div>
      <div><label>Amount (₱)</label><input type="number" id="ed2" min="1" step="0.01" value="${r.amount}"></div>
    </div>
    <label style="margin-top:10px">Note</label>
    <input id="ed3" value="${esc(r.note||"")}">
    <div class="msg" id="em"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn" id="es">Save Changes</button>
      <button class="ghost" id="ex">Cancel</button>
    </div>
  `);
  d.querySelector("#ex").onclick=d.close_;
  d.querySelector("#es").onclick=async()=>{
    const a=parseFloat(d.querySelector("#ed2").value),m=d.querySelector("#em");
    if(!(a>0))return m.textContent="Enter a valid amount.";
    const paid=Number(r.paid||0);
    if(a<paid)return m.textContent=ERR.BELOW_PAID+" (Already paid: "+money(paid)+").";
    const{error}=await sb.from("cash_advances").update({taken_on:d.querySelector("#ed1").value,amount:a,note:d.querySelector("#ed3").value.trim()||null}).eq("id",r.id);
    if(error)return m.textContent=emsg(error);
    d.close_();
    done();
  };
}

window.MODS=Object.assign(window.MODS||{},{"CASH ADVANCE (C.A) & PAYMENTS":ca});
})();
