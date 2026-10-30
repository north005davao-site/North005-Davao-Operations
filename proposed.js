// PROPOSED LOCATIONS MODULE - North005 Davao Operations ERP
// Follows existing module patterns: IIFE, window.MODS registration, sb/me/PAGER/LIB globals
(()=>{
const NAME="PROPOSED LOCATIONS";
const BUCKET="proposed-location-photos";
const STATUS_LIST=["Submitted","For Survey","Approved","Disapproved"];
const REMARKS_LIST=["Pending","Deployed"];
const TABS=[
  {k:"all",         label:"All Proposed Locations", filter:r=>true},
  {k:"submitted",   label:"Submitted",              filter:r=>r.status==="Submitted"},
  {k:"survey",      label:"For Survey",             filter:r=>r.status==="For Survey"},
  {k:"approved",    label:"Approved Locations",     filter:r=>r.status==="Approved"},
  {k:"disapproved", label:"Disapproved Locations",  filter:r=>r.status==="Disapproved"},
  {k:"deployed",    label:"Deployed Locations",     filter:r=>r.status==="Approved"&&r.remarks==="Deployed"}
];
const MUNI_LIST=["PANABO","STO. TOMAS","CARMEN","KAPALONG","TAGUM","TALAINGOD","SAMAL","NEW CORELLA","ASUNCION","SANTO TOMAS","BRAULIO E. DUJALI","SAN ISIDRO","CITY OF TAGUM","NABUNTURAN","MAWAB","COMPOSTELA","NEW BATAAN","MONTEVISTA","LAAK","MACO","MARAGUSAN","PANTUKAN","MONKAYO"];

const PL={tab:"all",q:"",filterStatus:"",filterRemarks:"",filterDateFrom:"",filterDateTo:"",filterDeployFrom:"",filterDeployTo:"",filterMuni:"",filterBoothCode:"",sub:false};
window.PROPOSED=PL;
let RECORDS=[],timer=null;

const adm=()=>me&&me.role==="admin";
const sup=()=>me&&(me.role==="admin"||me.role==="supervisor");
const esc=window.esc||(s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])));
const fdate=s=>{if(!s)return"\u2014";const[y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString("en-PH",{timeZone:"UTC",month:"short",day:"numeric",year:"numeric"})};
const statusColor=s=>{return s==="Approved"?"#22c55e":s==="Disapproved"?"#ef4444":s==="For Survey"?"#06b6d4":"#e0b13a"};
const remarkColor=r=>r==="Deployed"?"#22c55e":"#9fb0d8";

// --------------------------------------------------------
// Supabase helpers
// --------------------------------------------------------
async function fetchAll(){
  let out=[],i=0;
  for(;;){
    const{data,error}=await sb.from("proposed_locations").select("*").order("created_at",{ascending:false}).range(i,i+999);
    if(error||!data)break;
    out=out.concat(data);
    if(data.length<1000)break;
    i+=1000;
  }
  return out;
}

async function logHistory(location_id,field,old_value,new_value,note=""){
  try{
    await sb.from("proposed_location_history").insert({location_id,changed_by:me.id,field,old_value:String(old_value??""),new_value:String(new_value??""),note});
  }catch(e){console.warn("History log skipped:",e)}
}

async function signedUrl(path){
  if(!path)return null;
  try{
    const{data}=await sb.storage.from(BUCKET).createSignedUrl(path,3600);
    return data?.signedUrl||null;
  }catch(e){return null}
}

function subscribe(){
  if(PL.sub)return;
  PL.sub=true;
  sb.channel("proposed")
    .on("postgres_changes",{event:"*",schema:"public",table:"proposed_locations"},()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{if(!QUIETW()&&cur===NAME&&!document.querySelector("dialog[open]"))go(cur)},600);
    })
    .on("postgres_changes",{event:"*",schema:"public",table:"proposed_location_images"},()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{if(!QUIETW()&&cur===NAME&&!document.querySelector("dialog[open]"))go(cur)},600);
    })
    .subscribe();
}

// --------------------------------------------------------
// Filter & paginate
// --------------------------------------------------------
function applyFilters(rows,tab){
  const tabDef=TABS.find(t=>t.k===tab)||TABS[0];
  let r=rows.filter(tabDef.filter);
  if(PL.q){
    const q=PL.q.toLowerCase();
    r=r.filter(x=>[x.purok,x.barangay,x.municipality,x.booth_code].filter(Boolean).join(" ").toLowerCase().includes(q));
  }
  if(PL.filterStatus)r=r.filter(x=>x.status===PL.filterStatus);
  if(PL.filterRemarks)r=r.filter(x=>x.remarks===PL.filterRemarks);
  if(PL.filterMuni)r=r.filter(x=>(x.municipality||"").toUpperCase().includes(PL.filterMuni.toUpperCase()));
  if(PL.filterBoothCode)r=r.filter(x=>(x.booth_code||"").toLowerCase().includes(PL.filterBoothCode.toLowerCase()));
  if(PL.filterDateFrom)r=r.filter(x=>x.date_submitted&&x.date_submitted>=PL.filterDateFrom);
  if(PL.filterDateTo)r=r.filter(x=>x.date_submitted&&x.date_submitted<=PL.filterDateTo);
  if(PL.filterDeployFrom)r=r.filter(x=>x.deployment_date&&x.deployment_date>=PL.filterDeployFrom);
  if(PL.filterDeployTo)r=r.filter(x=>x.deployment_date&&x.deployment_date<=PL.filterDeployTo);
  return r;
}

// --------------------------------------------------------
// Main render
// --------------------------------------------------------
async function proposedLocations(v){
  subscribe();
  LOAD(v);
  RECORDS=await fetchAll();
  v.dataset.mod=cur;
  render(v);
}

function render(v){
  const tab=PL.tab;
  const tabDef=TABS.find(t=>t.k===tab)||TABS[0];
  const filtered=applyFilters(RECORDS,tab);
  const pg=PAGER.paginate("pl_"+tab,filtered);

  const tabsHtml=TABS.map(t=>{
    const cnt=applyFilters(RECORDS,t.k).length;
    return`<button class="chip2${t.k===tab?" on":""}" data-plt="${t.k}">${esc(t.label)} <small style="opacity:.7">${cnt}</small></button>`;
  }).join("");

  v.innerHTML=`
<div class="hdr2">
  <div>
    <div style="font-size:17px;font-weight:700">\uD83D\uDCCD Proposed Locations</div>
    <div class="chip">Manage booth location proposals, surveys, approvals, and deployments</div>
  </div>
  ${adm()?`<button class="btn" id="pl-add" style="width:auto;padding:9px 18px;margin:0">+ Add Location</button>`:""}
</div>

<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">${tabsHtml}</div>

<div class="tbar" id="pl-filters">
  <input id="pl-q" placeholder="Search purok, barangay, municipality, booth code\u2026" value="${esc(PL.q)}" style="flex:2;min-width:180px">
  <select id="pl-fs" style="min-width:130px">
    <option value="">All statuses</option>
    ${STATUS_LIST.map(s=>`<option value="${s}"${s===PL.filterStatus?" selected":""}>${s}</option>`).join("")}
  </select>
  <select id="pl-fr" style="min-width:120px">
    <option value="">All remarks</option>
    ${REMARKS_LIST.map(r=>`<option value="${r}"${r===PL.filterRemarks?" selected":""}>${r}</option>`).join("")}
  </select>
  <input id="pl-fm" placeholder="Municipality filter\u2026" value="${esc(PL.filterMuni)}" style="min-width:140px;max-width:200px">
  <input id="pl-fb" placeholder="Booth code filter\u2026" value="${esc(PL.filterBoothCode)}" style="min-width:120px;max-width:180px">
</div>
<div class="tbar" style="margin-top:-6px">
  <label style="font-size:12px;color:var(--mu);display:flex;align-items:center;gap:6px;white-space:nowrap">Submitted from <input type="date" id="pl-df" value="${PL.filterDateFrom}" style="width:140px;padding:6px 8px"></label>
  <label style="font-size:12px;color:var(--mu);display:flex;align-items:center;gap:6px;white-space:nowrap">to <input type="date" id="pl-dt" value="${PL.filterDateTo}" style="width:140px;padding:6px 8px"></label>
  <label style="font-size:12px;color:var(--mu);display:flex;align-items:center;gap:6px;white-space:nowrap">Deployed from <input type="date" id="pl-ddf" value="${PL.filterDeployFrom}" style="width:140px;padding:6px 8px"></label>
  <label style="font-size:12px;color:var(--mu);display:flex;align-items:center;gap:6px;white-space:nowrap">to <input type="date" id="pl-ddt" value="${PL.filterDeployTo}" style="width:140px;padding:6px 8px"></label>
  <button class="ghost" id="pl-clear-filters" style="font-size:12px;padding:5px 10px">Clear filters</button>
  <span class="chip" id="pl-count">${filtered.length} record${filtered.length===1?"":"s"}</span>
</div>

<div class="tw" id="pl-table">
  ${filtered.length===0?`<div class="empty"><b>${esc(tabDef.label)}</b><br>No proposed locations found.</div>`:`
  <table>
    <thead><tr>
      <th>#</th><th>Purok</th><th>Barangay</th><th>Municipality</th><th>Coordinates</th>
      <th>Date Submitted</th><th>Status</th><th>Remarks</th><th>Booth Code</th>
      <th>Deployment Date</th><th style="width:110px"></th>
    </tr></thead>
    <tbody>
    ${pg.slice.map((r,i)=>{
      const rowNum=(pg.st.page-1)*pg.st.size+i+1;
      const coordStr=r.lat!=null&&r.lng!=null?`${r.lat}, ${r.lng}`:"";
      return`<tr>
        <td style="color:var(--mu);font-size:12px">${rowNum}</td>
        <td>${esc(r.purok||"\u2014")}</td>
        <td>${esc(r.barangay||"\u2014")}</td>
        <td>${esc(r.municipality||"\u2014")}</td>
        <td style="font-size:12px">${coordStr?`<a href="https://www.google.com/maps?q=${r.lat},${r.lng}" target="_blank" rel="noopener" style="color:var(--gold)">${coordStr}</a>`:"\u2014"}</td>
        <td style="font-size:12px">${fdate(r.date_submitted)}</td>
        <td><span class="pill" style="background:${statusColor(r.status)}">${esc(r.status)}</span></td>
        <td><span class="pill" style="background:${remarkColor(r.remarks)}">${esc(r.remarks||"Pending")}</span></td>
        <td style="font-weight:600">${esc(r.booth_code||"\u2014")}</td>
        <td style="font-size:12px">${fdate(r.deployment_date)}</td>
        <td style="white-space:nowrap">
          <button class="ghost" data-plview="${r.id}" style="padding:5px 9px;font-size:12px">View</button>
          ${adm()?`<button class="ghost" data-pledit="${r.id}" style="padding:5px 9px;font-size:12px;margin-left:3px">Edit</button>`:""}
        </td>
      </tr>`;}).join("")}
    </tbody>
  </table>
  `}
</div>
${filtered.length>0?pg.bar:""}`;

  // Wire tabs
  v.querySelectorAll("[data-plt]").forEach(b=>b.onclick=()=>{PL.tab=b.dataset.plt;PAGER.reset("pl_"+PL.tab);render(v)});
  // Wire pager
  PAGER.bind(v,pg.st,()=>render(v));

  // Wire filters
  const q=document.getElementById("pl-q");
  if(q)q.oninput=e=>{PL.q=e.target.value;PAGER.reset("pl_"+PL.tab);render(v);const n=document.getElementById("pl-q");if(n){n.focus();n.setSelectionRange(PL.q.length,PL.q.length)}};
  const fs=document.getElementById("pl-fs");if(fs)fs.onchange=e=>{PL.filterStatus=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const fr=document.getElementById("pl-fr");if(fr)fr.onchange=e=>{PL.filterRemarks=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const fm=document.getElementById("pl-fm");if(fm)fm.oninput=e=>{PL.filterMuni=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const fb=document.getElementById("pl-fb");if(fb)fb.oninput=e=>{PL.filterBoothCode=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const df=document.getElementById("pl-df");if(df)df.onchange=e=>{PL.filterDateFrom=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const dt=document.getElementById("pl-dt");if(dt)dt.onchange=e=>{PL.filterDateTo=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const ddf=document.getElementById("pl-ddf");if(ddf)ddf.onchange=e=>{PL.filterDeployFrom=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const ddt=document.getElementById("pl-ddt");if(ddt)ddt.onchange=e=>{PL.filterDeployTo=e.target.value;PAGER.reset("pl_"+PL.tab);render(v)};
  const clr=document.getElementById("pl-clear-filters");
  if(clr)clr.onclick=()=>{PL.q="";PL.filterStatus="";PL.filterRemarks="";PL.filterMuni="";PL.filterBoothCode="";PL.filterDateFrom="";PL.filterDateTo="";PL.filterDeployFrom="";PL.filterDeployTo="";PAGER.reset("pl_"+PL.tab);render(v)};

  // Add button
  const addBtn=document.getElementById("pl-add");
  if(addBtn)addBtn.onclick=()=>openForm(null,v);

  // View / Edit row buttons
  v.querySelectorAll("[data-plview]").forEach(b=>b.onclick=()=>{const r=RECORDS.find(x=>x.id===b.dataset.plview);if(r)openDetail(r,v)});
  v.querySelectorAll("[data-pledit]").forEach(b=>b.onclick=()=>{const r=RECORDS.find(x=>x.id===b.dataset.pledit);if(r)openForm(r,v)});
}

// --------------------------------------------------------
// Add / Edit Form Dialog
// --------------------------------------------------------
async function openForm(row,v){
  const isNew=!row;
  const r=row?{...row}:{status:"Submitted",remarks:"Pending"};
  const d=document.createElement("dialog");
  d.innerHTML=`
<h4 style="margin:0 0 10px">${isNew?"Add Proposed Location":"Edit Proposed Location"}</h4>
<div class="g2">
  <div><label>Purok</label><input id="pf-purok" value="${esc(r.purok||"")}"></div>
  <div><label>Barangay</label><input id="pf-brgy" value="${esc(r.barangay||"")}"></div>
  <div><label>Municipality</label>
    <input id="pf-muni" list="pf-muni-list" value="${esc(r.municipality||"")}">
    <datalist id="pf-muni-list">${MUNI_LIST.map(m=>`<option value="${m}">`).join("")}</datalist>
  </div>
  <div><label>Coordinates <small style="color:var(--mu)">(lat, lng \u2014 e.g. 7.4604, 125.7849)</small></label>
    <input id="pf-coords" value="${r.lat!=null?r.lat+", "+r.lng:""}" placeholder="7.4604, 125.7849">
  </div>
  <div><label>Date Submitted</label><input type="date" id="pf-ds" value="${esc(r.date_submitted||"")}"></div>
  <div><label>Status</label>
    <select id="pf-st">${STATUS_LIST.map(s=>`<option${s===r.status?" selected":""}>${s}</option>`).join("")}</select>
  </div>
  <div><label>Remarks</label>
    <select id="pf-rm">${REMARKS_LIST.map(x=>`<option${x===r.remarks?" selected":""}>${x}</option>`).join("")}</select>
  </div>
  <div><label>Deployment Date <small style="color:var(--mu)">(only when actually deployed)</small></label>
    <input type="date" id="pf-dd" value="${esc(r.deployment_date||"")}">
  </div>
  <div><label>Booth Code <small style="color:var(--mu)">(manually assigned \u2014 do not auto-generate)</small></label>
    <input id="pf-bc" value="${esc(r.booth_code||"")}" placeholder="e.g. DDN-001" style="text-transform:uppercase">
  </div>
</div>
<div class="msg" id="pf-msg"></div>
<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
  <button class="btn" id="pf-save" style="width:auto;padding:10px 20px;margin:0">Save</button>
  <button class="ghost" id="pf-cancel">Cancel</button>
  ${!isNew&&adm()?'<button class="ghost" id="pf-del" style="margin-left:auto;color:#ef4444;border-color:#ef4444">Delete</button>':""}
</div>`;
  document.body.appendChild(d);
  d.showModal();
  const msg=d.querySelector("#pf-msg"),close=()=>{d.close();d.remove()};
  d.querySelector("#pf-cancel").onclick=close;

  // Validate coords helper
  const parseCoords=s=>{
    const m=String(s??"").match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
    if(!m)return[null,null];
    const a=+m[1],b=+m[2];
    return a>3&&a<22&&b>115&&b<128?[a,b]:[null,null];
  };

  d.querySelector("#pf-save").onclick=async()=>{
    const btn=d.querySelector("#pf-save");
    btn.disabled=true;
    btn.textContent="Saving\u2026";
    const bc=(d.querySelector("#pf-bc").value.trim()||"").toUpperCase().replace(/\s+/g,"-")||null;
    const coordStr=d.querySelector("#pf-coords").value;
    const[lat,lng]=coordStr?parseCoords(coordStr):[null,null];
    if(coordStr&&lat===null){
      msg.textContent="Coordinates must be valid lat, lng within the Philippines (e.g. 7.4604, 125.7849)";
      btn.disabled=false;
      btn.textContent="Save";
      return;
    }
    // Optional booth code duplicate check against master registry
    if(bc){
      const{data:existing}=await sb.from("registry_outlets").select("booth_code").eq("booth_code",bc).maybeSingle();
      if(!isNew&&row.booth_code===bc){
        // same code, keep
      }else if(existing){
        const ok=confirm(`Booth code "${bc}" already exists in the Master Registry. Assign it anyway?\n\n(Review to avoid accidental duplicates.)`);
        if(!ok){btn.disabled=false;btn.textContent="Save";return}
      }
    }
    const payload={
      purok:d.querySelector("#pf-purok").value.trim()||null,
      barangay:d.querySelector("#pf-brgy").value.trim()||null,
      municipality:d.querySelector("#pf-muni").value.trim()||null,
      lat,
      lng,
      date_submitted:d.querySelector("#pf-ds").value||null,
      status:d.querySelector("#pf-st").value,
      remarks:d.querySelector("#pf-rm").value,
      deployment_date:d.querySelector("#pf-dd").value||null,
      booth_code:bc,
      updated_at:new Date().toISOString()
    };
    if(isNew){
      payload.created_by=me.id;
      const{data:ins,error}=await sb.from("proposed_locations").insert(payload).select().single();
      if(error){msg.textContent="Could not save: "+error.message;btn.disabled=false;btn.textContent="Save";return}
      await logHistory(ins.id,"record","","created","Record created");
    }else{
      const{error}=await sb.from("proposed_locations").update(payload).eq("id",row.id);
      if(error){msg.textContent="Could not save: "+error.message;btn.disabled=false;btn.textContent="Save";return}
      // Log changed fields
      if(payload.status!==row.status)await logHistory(row.id,"status",row.status,payload.status);
      if(payload.remarks!==row.remarks)await logHistory(row.id,"remarks",row.remarks,payload.remarks);
      if(payload.booth_code!==row.booth_code)await logHistory(row.id,"booth_code",row.booth_code,payload.booth_code);
      if(payload.deployment_date!==row.deployment_date)await logHistory(row.id,"deployment_date",row.deployment_date,payload.deployment_date);
    }
    close();
    RECORDS=await fetchAll();
    render(v);
  };

  if(!isNew&&adm()){
    d.querySelector("#pf-del").onclick=async()=>{
      if(!confirm("Permanently delete this proposed location and all its images and history?"))return;
      const{error}=await sb.from("proposed_locations").delete().eq("id",row.id);
      if(error){d.querySelector("#pf-msg").textContent="Could not delete: "+error.message;return}
      close();
      RECORDS=await fetchAll();
      render(v);
    };
  }
}

// --------------------------------------------------------
// Detail / View Dialog
// --------------------------------------------------------
async function openDetail(row,v){
  const d=document.createElement("dialog");
  d.innerHTML=`<div id="pd-body"><div class="spin" style="margin:30px auto"></div></div>`;
  document.body.appendChild(d);
  d.showModal();

  // Load images and history in parallel
  const[imgsRes,histRes]=await Promise.all([
    sb.from("proposed_location_images").select("*").eq("location_id",row.id).order("uploaded_at"),
    sb.from("proposed_location_history").select("*,changed_by_profile:profiles!proposed_location_history_changed_by_fkey(full_name)").eq("location_id",row.id).order("changed_at",{ascending:false}).limit(30)
  ]);
  const imgs=imgsRes.data||[],hist=histRes.data||[];
  const propImgs=imgs.filter(i=>i.category==="proposed"),depImgs=imgs.filter(i=>i.category==="deployed");
  const coordStr=row.lat!=null&&row.lng!=null?`${row.lat}, ${row.lng}`:null;

  d.querySelector("#pd-body").innerHTML=`
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
  <h4 style="margin:0;flex:1">\uD83D\uDCCD Location Details</h4>
  <span class="pill" style="background:${statusColor(row.status)}">${esc(row.status)}</span>
  <span class="pill" style="background:${remarkColor(row.remarks||"Pending")}">${esc(row.remarks||"Pending")}</span>
  <button class="ghost" id="pd-close">\u2715 Close</button>
</div>
<div class="g2" style="gap:4px 20px;font-size:13.5px">
  <div><label style="font-size:11px">Purok</label><div>${esc(row.purok||"\u2014")}</div></div>
  <div><label style="font-size:11px">Barangay</label><div>${esc(row.barangay||"\u2014")}</div></div>
  <div><label style="font-size:11px">Municipality</label><div>${esc(row.municipality||"\u2014")}</div></div>
  <div><label style="font-size:11px">Booth Code</label><div style="font-weight:700">${esc(row.booth_code||"\u2014")}</div></div>
  <div><label style="font-size:11px">Date Submitted</label><div>${fdate(row.date_submitted)}</div></div>
  <div><label style="font-size:11px">Deployment Date</label><div>${fdate(row.deployment_date)}</div></div>
  <div><label style="font-size:11px">Coordinates</label><div>${coordStr?`<a href="https://www.google.com/maps?q=${row.lat},${row.lng}" target="_blank" rel="noopener" style="color:var(--gold)">\uD83D\uDCCD ${coordStr}</a>`:"\u2014"}</div></div>
</div>
${coordStr?`<div id="pd-map" style="height:260px;border-radius:12px;border:1px solid var(--line);margin:14px 0 4px;z-index:0"></div>`:""}
<hr style="border:none;border-top:1px solid var(--line);margin:14px 0">

<!-- Image upload / management -->
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
  <b>Attachments</b>
  ${sup()?`
  <label class="ghost up" style="cursor:pointer;padding:6px 12px;font-size:12px">
    + Upload Proposed Photos
    <input type="file" id="pd-up-prop" accept="image/*" multiple hidden>
  </label>
  <label class="ghost up" style="cursor:pointer;padding:6px 12px;font-size:12px">
    + Upload Deployed Photos
    <input type="file" id="pd-up-dep" accept="image/*" multiple hidden>
  </label>`:""}
</div>
<div class="msg" id="pd-upmsg" style="color:var(--gold);min-height:16px"></div>

<div style="margin-bottom:6px"><b style="font-size:12px;color:var(--mu)">PROPOSED LOCATION PHOTOS</b></div>
<div id="pd-prop-imgs" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">
  ${propImgs.length===0?`<div class="chip" style="color:var(--mu)">No proposed location photos yet.</div>`:"<div class='chip' style='color:var(--mu)'>Loading photos\u2026</div>"}
</div>
<div style="margin-bottom:6px"><b style="font-size:12px;color:var(--mu)">DEPLOYED LOCATION PHOTOS</b></div>
<div id="pd-dep-imgs" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">
  ${depImgs.length===0?`<div class="chip" style="color:var(--mu)">No deployed photos yet.</div>`:"<div class='chip' style='color:var(--mu)'>Loading photos\u2026</div>"}
</div>

${sup()||adm()?`<hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
<div style="display:flex;gap:10px;flex-wrap:wrap">
  ${adm()?`<button class="ghost" id="pd-edit" style="padding:8px 16px">\u270E Edit Record</button>`:""}
  <button class="ghost" id="pd-close2" style="padding:8px 16px">Close</button>
</div>`:"<button class='ghost' id='pd-close2' style='margin-top:12px;padding:8px 16px'>Close</button>"}

<!-- Status History -->
<hr style="border:none;border-top:1px solid var(--line);margin:14px 0">
<div style="margin-bottom:6px"><b style="font-size:12px;color:var(--mu)">STATUS HISTORY</b></div>
<div id="pd-hist">
${hist.length===0?`<div class="chip" style="color:var(--mu)">No history yet.</div>`:hist.map(h=>`<div class="lf" style="border-bottom:1px solid var(--line);padding:6px 0">
  <div class="dot" style="background:var(--gold)"></div>
  <div class="nt">
    <div style="font-size:13px"><b>${esc(h.field||"record")}</b>: ${esc(h.old_value||"(none)")} \u2192 <b>${esc(h.new_value||"(none)")}</b>${h.note?` <span style="color:var(--mu);font-size:12px">(${esc(h.note)})</span>`:""}</div>
    <small>${h.changed_by_profile?.full_name||"Unknown"} \u00B7 ${new Date(h.changed_at).toLocaleString("en-PH",{timeZone:"Asia/Manila"})}</small>
  </div>
</div>`).join("")}
</div>`;

  const close=()=>{d.close();d.remove()};
  d.querySelector("#pd-close").onclick=close;
  const cl2=d.querySelector("#pd-close2");if(cl2)cl2.onclick=close;
  const editBtn=d.querySelector("#pd-edit");
  if(editBtn)editBtn.onclick=()=>{close();openForm(row,v)};

  // Load signed URLs for images
  const renderImgs=async(els,cat)=>{
    const catImgs=imgs.filter(i=>i.category===cat);
    if(!catImgs.length){els.innerHTML=`<div class="chip" style="color:var(--mu)">No ${cat} photos yet.</div>`;return}
    const urls=await Promise.all(catImgs.map(i=>signedUrl(i.storage_path)));
    els.innerHTML=catImgs.map((img,idx)=>`
      <div style="position:relative;display:inline-block">
        <a href="${urls[idx]||"#"}" target="_blank" rel="noopener">
          <img src="${urls[idx]||""}" alt="${esc(img.filename||"photo")}" style="width:150px;height:120px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">
        </a>
        ${adm()?`<button data-pldel="${img.id}" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:6px;padding:2px 7px;cursor:pointer;font-size:11px">\u2715</button>`:""}
      </div>`).join("");
    if(adm())els.querySelectorAll("[data-pldel]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Delete this photo?"))return;
      const img=catImgs.find(i=>i.id===b.dataset.pldel);if(!img)return;
      await sb.storage.from(BUCKET).remove([img.storage_path]);
      await sb.from("proposed_location_images").delete().eq("id",img.id);
      openDetail(row,v);
      close();
    });
  };

  const propEl=d.querySelector("#pd-prop-imgs"),depEl=d.querySelector("#pd-dep-imgs");
  if(propImgs.length)renderImgs(propEl,"proposed");
  if(depImgs.length)renderImgs(depEl,"deployed");

  // Upload handlers
  const setupUpload=(inputId,cat)=>{
    const inp=d.querySelector("#"+inputId);
    if(!inp)return;
    inp.onchange=async e=>{
      const files=[...e.target.files];
      e.target.value="";
      if(!files.length)return;
      const upmsg=d.querySelector("#pd-upmsg");
      upmsg.textContent=`Uploading ${files.length} photo(s)\u2026`;
      let ok=0;
      for(const file of files){
        if(file.size>20*1048576){
          upmsg.textContent="File too large (max 20 MB each). Skipping "+file.name;
          continue;
        }
        const ext=file.name.split(".").pop().toLowerCase()||"jpg";
        const path=`${row.id}/${cat}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const{error:upErr}=await sb.storage.from(BUCKET).upload(path,file,{contentType:file.type});
        if(upErr){upmsg.textContent="Upload failed: "+upErr.message;continue}
        await sb.from("proposed_location_images").insert({location_id:row.id,category:cat,storage_path:path,filename:file.name,uploaded_by:me.id});
        ok++;
      }
      upmsg.textContent=`${ok} photo(s) uploaded.`;
      // Refresh images in dialog without closing
      const newImgsRes=await sb.from("proposed_location_images").select("*").eq("location_id",row.id).order("uploaded_at");
      const newImgs=newImgsRes.data||[];
      imgs.length=0;
      imgs.push(...newImgs);
      const pi=imgs.filter(i=>i.category==="proposed"),di=imgs.filter(i=>i.category==="deployed");
      if(pi.length)renderImgs(d.querySelector("#pd-prop-imgs"),"proposed");
      else d.querySelector("#pd-prop-imgs").innerHTML=`<div class="chip" style="color:var(--mu)">No proposed location photos yet.</div>`;
      if(di.length)renderImgs(d.querySelector("#pd-dep-imgs"),"deployed");
      else d.querySelector("#pd-dep-imgs").innerHTML=`<div class="chip" style="color:var(--mu)">No deployed photos yet.</div>`;
    };
  };
  setupUpload("pd-up-prop","proposed");
  setupUpload("pd-up-dep","deployed");

  // Map preview
  if(coordStr){
    await LIB.leaflet();
    const mapEl=d.querySelector("#pd-map");
    if(mapEl){
      const m=L.map(mapEl,{zoomControl:true}).setView([row.lat,row.lng],15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"\u00A9 OpenStreetMap"}).addTo(m);
      const pin=L.divIcon({className:"",html:`<svg width="28" height="38" viewBox="0 0 28 38"><path d="M14 1C6.8 1 1 6.8 1 14c0 10 13 23 13 23s13-13 13-23C27 6.8 21.2 1 14 1z" fill="#e0b13a" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,iconSize:[28,38],iconAnchor:[14,37]});
      L.marker([row.lat,row.lng],{icon:pin}).bindPopup(`<b>\uD83D\uDCCD ${esc(row.booth_code||"Proposed Location")}</b><br>${esc([row.purok,row.barangay,row.municipality].filter(Boolean).join(", "))}`).addTo(m).openPopup();
      setTimeout(()=>m.invalidateSize(),120);
    }
  }
}

// --------------------------------------------------------
// Register module
// --------------------------------------------------------
window.MODS=Object.assign(window.MODS||{},{[NAME]:proposedLocations});
})();
