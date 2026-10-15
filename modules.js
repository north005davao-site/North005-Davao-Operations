(()=>{const P={},js=u=>P[u]||(P[u]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=u;s.onload=res;s.onerror=()=>{delete P[u];rej(new Error("load failed"))};document.head.appendChild(s)})),
  css=u=>P[u]||(P[u]=new Promise(res=>{const l=document.createElement("link");l.rel="stylesheet";l.href=u;l.onload=res;l.onerror=res;document.head.appendChild(l)})),CD="https://cdn.jsdelivr.net/npm/";
  window.LIB={js,xlsx:()=>window.XLSX?Promise.resolve():js(CD+"xlsx@0.18.5/dist/xlsx.full.min.js"),exceljs:()=>window.ExcelJS?Promise.resolve():js(CD+"exceljs@4.4.0/dist/exceljs.min.js"),
    leaflet:()=>Promise.all([css(CD+"leaflet@1.9.4/dist/leaflet.css"),window.L?0:js(CD+"leaflet@1.9.4/dist/leaflet.js")])}})();
(()=>{
const MUNI={"PANABO":["Panabo City","#22c55e"],"STO. TOMAS":["Sto. Tomas","#facc15"],"CARMEN":["Carmen","#ef4444"],"KAPALONG":["Kapalong","#3b82f6"],"TAGUM":["Tagum City","#a855f7"],"TALAINGOD":["Talaingod","#ec4899"],"SAMAL":["Samal","#06b6d4"]};
const COLLECTORS=["JOHN","JAYSON","MUHLEN","JASON","MAC²","NELSON","CHARLIE"];
const normMuni=s=>{s=String(s||"").toUpperCase();return s.includes("TAGUM")?"TAGUM":s.includes("PANABO")?"PANABO":s.includes("CARMEN")?"CARMEN":s.includes("TOMAS")?"STO. TOMAS":s.includes("TALAINGOD")?"TALAINGOD":s.includes("KAPALONG")?"KAPALONG":s.includes("SAMAL")?"SAMAL":null};
const ph=v=>{if(v==null||v==="")return null;let s=String(v).replace(/\D/g,"");if(s.length==10&&s[0]=="9")s="0"+s;return s||null};
const coord=v=>{const m=String(v??"").match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);if(!m)return[null,null];const a=+m[1],b=+m[2];return a>3&&a<22&&b>115&&b<128?[a,b]:[null,null]};
const tx=v=>{const s=String(v??"").trim();return s||null};
const bc=v=>{const s=tx(v);return s?s.toUpperCase().replace(/\s+/g,"-"):null};
const natural=(a,b)=>(a.municipality||"").localeCompare(b.municipality||"")||(parseInt((a.booth_code||"").replace(/\D/g,""))||0)-(parseInt((b.booth_code||"").replace(/\D/g,""))||0);

const PG={},SIZES=[10,15,20,25,50,100];
const pgState=k=>PG[k]||(PG[k]={page:1,size:10});
function paginate(k,rows){const st=pgState(k),total=rows.length,pages=Math.max(1,Math.ceil(total/st.size));st.page=Math.min(Math.max(1,st.page),pages);
  const a=total?(st.page-1)*st.size+1:0,b=Math.min(total,st.page*st.size),nums=[];for(let p=1;p<=pages;p++)if(p==1||p==pages||Math.abs(p-st.page)<=1)nums.push(p);
  let h="",prev=0;nums.forEach(p=>{if(prev&&p-prev>1)h+='<span class="chip">…</span>';h+=`<button class="chip2${p==st.page?" on":""}" data-pg="${p}">${p}</button>`;prev=p});
  const bar=total>10?`<div class="pg"><span class="chip">${a}–${b} of ${total}</span><span class="pgc"><span class="chip">Rows</span><select data-pgsize>${SIZES.map(s=>`<option${s==st.size?" selected":""}>${s}</option>`).join("")}</select><button class="chip2" data-pg="prev"${st.page<=1?" disabled":""}>‹</button>${h}<button class="chip2" data-pg="next"${st.page>=pages?" disabled":""}>›</button></span></div>`:"";
  return{st,slice:rows.slice((st.page-1)*st.size,st.page*st.size),bar}}
function bindPager(root,st,redraw){root.querySelectorAll("[data-pg]").forEach(b=>b.onclick=()=>{const v=b.dataset.pg;st.page=v=="prev"?st.page-1:v=="next"?st.page+1:+v;redraw()});const s=root.querySelector("[data-pgsize]");if(s)s.onchange=()=>{st.size=+s.value;st.page=1;redraw()}}
window.PAGER={paginate,bind:bindPager,reset:k=>{pgState(k).page=1}};window.MUNI=MUNI;

function parseAreas(X,buf){
  const wb=X.read(buf,{type:"array"}),out=new Map();
  for(const name of wb.SheetNames){
    if(!/\sAREA$/i.test(name.trim()))continue;
    const col=name.trim().replace(/\s+NEW\s+AREA$/i,"").replace(/\s+AREA$/i,"").trim().toUpperCase();
    const rows=X.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true}),wide=/^NO\.?$/i.test(String((rows[1]||[])[0]||"").trim());
    for(const r of rows.slice(2)){let code,addr,teller;
      if(wide){code=bc(r[1]);addr=tx(r[2]);teller=tx(r[4]);if(!code||!/^DDN-\d+$/.test(code))continue}
      else{const mm=String(r[0]??"").match(/^\s*DDN[\s\-]*(\d+)\s*[-–]?\s*(.*)$/i);if(!mm)continue;code="DDN-"+mm[1];addr=tx(mm[2]);teller=tx(r[1])}
      if(teller&&/^0$/.test(teller))teller=null;
      out.set(code,{booth_code:code,collector:col,address:addr,sr_name:teller,wide})}}
  return[...out.values()]}

function parseMasterlist(X,buf){
  const wb=X.read(buf,{type:"array"}),map=new Map(),rel=new Map();
  for(const name of wb.SheetNames){
    const rows=X.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:null,raw:true});
    if(/RELIEVER/i.test(name)){
      const h=rows.findIndex(r=>r.some(c=>/^RELIEVERS$/i.test(String(c||"").trim())));if(h<0)continue;
      const ix=re=>rows[h].findIndex(c=>re.test(String(c||"").trim()));const [n,c,m,s]=[ix(/^RELIEVERS$/i),ix(/CONTACT/i),ix(/MUNICIPALITY/i),ix(/^STATUS$/i)];
      for(const r of rows.slice(h+1)){const nm=tx(r[n]);if(nm)rel.set(nm.toUpperCase(),{name:nm,contact:ph(r[c]),municipality:tx(r[m])&&String(r[m]).trim().toUpperCase(),status:tx(r[s])?String(r[s]).trim().toUpperCase():"ACTIVE"})}
      continue}
    const h=rows.findIndex(r=>r.some(c=>/^SALES REPRESENTATIVE$/i.test(String(c||"").trim())));if(h<0)continue;
    const muni=normMuni(name);if(!muni)continue;
    const ix=re=>rows[h].findIndex(c=>re.test(String(c||"").trim()));
    const C={sr:ix(/^SALES REPRESENTATIVE$/i),br:ix(/^BARANGAY$/i),pu:ix(/^PUROK$/i),id:ix(/^ID NO\.?$/i),oa:ix(/^OPERATIONS ADMINISTRATOR$/i),oai:ix(/^OPERATIONS ADMINISTRATOR\s*-\s*ID/i),st:ix(/^STATUS$/i),ct:ix(/SR CONTACT/i),bo:ix(/^BOOTH CODE$/i),pos:ix(/^POS NO/i),co:ix(/^COORDINATES/i)};
    let oa=null,oai=null;
    for(const r of rows.slice(h+1)){
      const code=bc(r[C.bo]);if(!code)continue;
      if(tx(r[C.oa]))oa=tx(r[C.oa]);if(tx(r[C.oai]))oai=tx(r[C.oai]);
      const[lat,lng]=coord(r[C.co]);
      map.set(code,{booth_code:code,municipality:muni,sr_name:tx(r[C.sr]),barangay:tx(r[C.br]),purok:tx(r[C.pu]),sr_id_no:tx(r[C.id]),oa_name:oa,oa_id_no:oai,status:tx(r[C.st])?String(r[C.st]).trim().toUpperCase():"ACTIVE",sr_contact:ph(r[C.ct]),pos_no:tx(r[C.pos]),lat,lng})}
  }
  return{outlets:[...map.values()],relievers:[...rel.values()]}}

let S={tab:"o",q:"",m:"",O:[],R:[]},timer=null,subbed=false,mapState=null;
async function all(t){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select("*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
const pill=m=>MUNI[m]?`<span class="pill" style="background:${MUNI[m][1]}">${MUNI[m][0]}</span>`:esc(m||"");
function subscribe(){if(subbed)return;subbed=true;
  sb.channel("reg").on("postgres_changes",{event:"*",schema:"public",table:"registry_outlets"},bump).on("postgres_changes",{event:"*",schema:"public",table:"registry_relievers"},bump).subscribe()}
function bump(){clearTimeout(timer);timer=setTimeout(()=>{if(!QUIETW()&&!document.querySelector("dialog[open]")&&(cur=="MASTER REGISTRY"||cur=="ETS LIVE TRACKING")&&!S.busy)go(cur)},500)}

const OF=[["booth_code","Booth code"],["sr_name","Sales representative"],["municipality","Municipality","m"],["barangay","Barangay"],["purok","Purok"],["sr_id_no","SR ID no."],["oa_name","Operations Administrator"],["oa_id_no","OA ID no."],["status","Status","s"],["sr_contact","SR contact #"],["pos_no","POS no."],["coords","Coordinates (lat, lng)"],["collector","Collector / Area","c"],["address","Address (for reports)"],["needs_details","Needs details","k"]];
const RF=[["name","Reliever name"],["contact","Contact #"],["municipality","Municipality"],["status","Status","s"]];
function edit(kind,row,done){
  const F=kind=="o"?OF:RF,tb=kind=="o"?"registry_outlets":"registry_relievers",d=document.createElement("dialog"),r={...row};
  if(kind=="o")r.coords=r.lat!=null?r.lat+", "+r.lng:"";
  const inp=([k,l,t])=>{const val=esc(r[k]??"");
    if(t=="m")return`<label>${l}</label><select data-k="${k}">${Object.entries(MUNI).map(([a,b])=>`<option value="${a}"${a==r[k]?" selected":""}>${b[0]}</option>`).join("")}</select>`;
    if(t=="s")return`<label>${l}</label><select data-k="${k}">${["ACTIVE","INACTIVE"].map(x=>`<option${x==(r[k]||"ACTIVE")?" selected":""}>${x}</option>`).join("")}</select>`;
    if(t=="k")return`<label style="display:flex;gap:8px;align-items:center;margin-top:14px"><input type="checkbox" style="width:auto" data-k="${k}"${r[k]?" checked":""}> ${l}</label>`;
    return`<label>${l}</label><input data-k="${k}" value="${val}"${t=="c"?' list="cl"':""}>`};
  d.innerHTML=`<h4 style="margin:0 0 6px">${row.id?"Edit":"Add"} ${kind=="o"?"outlet":"reliever"}</h4><datalist id="cl">${COLLECTORS.map(c=>`<option value="${c}">`).join("")}</datalist><div class="g2">${F.map(inp).join("")}</div><div class="msg" id="dm"></div>
  <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="ds">Save</button><button class="ghost" id="dc">Cancel</button>${row.id?'<button class="ghost" id="dx" style="margin-left:auto">Delete</button>':""}</div>`;
  document.body.appendChild(d);d.showModal();const m=d.querySelector("#dm"),close=()=>{d.close();d.remove()};
  d.querySelector("#dc").onclick=close;
  d.querySelector("#ds").onclick=async()=>{const p={};d.querySelectorAll("[data-k]").forEach(e=>p[e.dataset.k]=e.type=="checkbox"?e.checked:(e.value.trim()||null));
    if(kind=="o"){p.booth_code=bc(p.booth_code);if(!p.booth_code)return m.textContent="Booth code is required.";
      if(p.coords){const[a,b]=coord(p.coords);if(a==null)return m.textContent="Coordinates must look like 7.4604, 125.7849";p.lat=a;p.lng=b}else{p.lat=null;p.lng=null}delete p.coords;if(p.sr_contact)p.sr_contact=ph(p.sr_contact)}
    else if(!p.name)return m.textContent="Name is required.";
    const q=row.id?sb.from(tb).update(p).eq("id",row.id):sb.from(tb).insert(p),{error}=await q;
    if(error)return m.textContent=/duplicate/i.test(error.message)?"That already exists.":"Could not save.";close();done()};
  const x=d.querySelector("#dx");if(x)x.onclick=async()=>{if(!confirm("Delete this record?"))return;const{error}=await sb.from(tb).delete().eq("id",row.id);if(error)return m.textContent="Could not delete.";close();done()}}

async function registry(v){
  const adm=me.role=="admin";const soft=v.dataset.mod==cur&&S.O.length>0,fetchAll=async()=>{[S.O,S.R]=await Promise.all([all("registry_outlets"),all("registry_relievers")]);S.O.sort(natural);S.R.sort((a,b)=>a.name.localeCompare(b.name))};if(soft)await fetchAll();v.dataset.mod=cur;
  v.innerHTML=`<div class="tbar"><button class="chip2 on" data-t="o">Outlets</button><button class="chip2" data-t="r">Relievers</button><input id="rq" placeholder="Search…" value="${esc(S.q)}"><select id="rm"><option value="">All municipalities</option>${Object.entries(MUNI).map(([k,l])=>`<option value="${k}"${k==S.m?" selected":""}>${l[0]}</option>`).join("")}</select>${adm?`<button class="ghost" id="ra">+ Add</button><label class="ghost up">Upload Masterlist (Excel)<input type="file" id="ru" accept=".xlsx,.xls" hidden></label><label class="ghost up">Import Areas (Excel report)<input type="file" id="ra2" accept=".xlsx,.xls" hidden></label>`:""}<span class="chip" id="rc"></span></div><div id="rp"></div><div class="tw" id="rt"><div class="empty">Loading…</div></div>`;
  if(!soft)await fetchAll();
  const draw=()=>{
    v.querySelectorAll("[data-t]").forEach(b=>b.classList.toggle("on",b.dataset.t==S.tab));$("#rm").classList.toggle("hide",S.tab!="o");
    const q=S.q.toLowerCase(),has=r=>Object.values(r).some(x=>x!=null&&String(x).toLowerCase().includes(q));
    const rows=(S.tab=="o"?S.O.filter(r=>(!S.m||r.municipality==S.m)):S.R).filter(r=>!q||has(r));$("#rc").textContent=rows.length+" record"+(rows.length==1?"":"s");
    if(!rows.length){$("#rt").innerHTML=`<div class="empty"><b>${S.tab=="o"?"Master Registry":"Relievers"}</b><br>No records yet.${adm?" Use “Upload Masterlist (Excel)” to import, or “+ Add”.":""}</div>`;return}
    const pg=PAGER.paginate("reg_"+S.tab,rows);
    const head=S.tab=="o"?["Booth code","Sales representative","Municipality","Barangay","Purok","Collector","Status","Contact","POS no.","Coordinates"]:["Name","Contact","Municipality","Status"];
    const cell=r=>S.tab=="o"?[`${r.needs_details?"⚠ ":""}<b>${esc(r.booth_code)}</b>`,esc(r.sr_name),pill(r.municipality),esc(r.barangay),esc(r.purok),esc(r.collector),esc(r.status),esc(r.sr_contact),esc(r.pos_no),r.lat!=null?r.lat+", "+r.lng:'<span style="color:var(--red)">missing</span>']:[esc(r.name),esc(r.contact),esc(r.municipality),esc(r.status)];
    $("#rt").innerHTML=`<table><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${pg.slice.map((r,i)=>`<tr data-i="${r.id}"${adm?' style="cursor:pointer"':""}>${cell(r).map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`+pg.bar;PAGER.bind($("#rt"),pg.st,draw);
    if(adm)$("#rt").querySelectorAll("tr[data-i]").forEach(tr=>tr.onclick=()=>edit(S.tab,(S.tab=="o"?S.O:S.R).find(x=>x.id==tr.dataset.i),()=>registry(v)))};
  v.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{S.tab=b.dataset.t;PAGER.reset("reg_"+S.tab);draw()});
  $("#rq").oninput=e=>{S.q=e.target.value;PAGER.reset("reg_"+S.tab);draw()};$("#rm").onchange=e=>{S.m=e.target.value;PAGER.reset("reg_"+S.tab);draw()};
  if(adm){$("#ra").onclick=()=>edit(S.tab,{},()=>registry(v));
    $("#ra2").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const p=$("#rp");p.innerHTML='<div class="box" style="max-width:none;margin-bottom:12px">Reading file…</div>';
      try{await LIB.xlsx();const list=parseAreas(XLSX,await f.arrayBuffer());if(!list.length)throw 0;const ex=new Map(S.O.map(o=>[o.booth_code,o])),upd=list.filter(x=>ex.has(x.booth_code)),add=list.filter(x=>!ex.has(x.booth_code)),by={};list.forEach(x=>by[x.collector]=(by[x.collector]||0)+1);
        p.innerHTML=`<div class="box" style="max-width:none;margin-bottom:12px"><b>Areas found in your report</b><div style="margin:6px 0">${Object.entries(by).map(([k,n])=>`<span class="pill" style="background:var(--gold)">${esc(k)}</span> ${n}`).join(" &nbsp; ")}</div><div>${upd.length} existing booth(s) will get their collector.</div>${add.length?`<div style="margin-top:4px">${add.length} booth(s) are not in the registry and will be added with a ⚠ “Needs details” flag: ${add.map(x=>esc(x.booth_code)).join(", ")}</div>`:""}<p style="color:var(--mu);font-size:13px">Nothing else is changed or deleted.</p><button class="btn" id="ok2">Confirm</button> <button class="ghost" id="no2">Cancel</button><span id="pg2" class="chip" style="margin-left:10px"></span></div>`;
        $("#no2").onclick=()=>p.innerHTML="";
        $("#ok2").onclick=async()=>{S.busy=true;$("#ok2").disabled=true;try{
          const U=upd.map(x=>({booth_code:x.booth_code,municipality:ex.get(x.booth_code).municipality,collector:x.collector})),N=add.map(x=>({booth_code:x.booth_code,municipality:normMuni(x.address||"")||(x.wide?"SAMAL":"TAGUM"),sr_name:x.sr_name,address:x.address,collector:x.collector,needs_details:true,status:"ACTIVE"}));
          for(const g of [U,N])for(let i=0;i<g.length;i+=200){const{error}=await sb.from("registry_outlets").upsert(g.slice(i,i+200),{onConflict:"booth_code"});if(error)throw error}
          S.busy=false;registry(v)}catch(x){S.busy=false;$("#pg2").textContent="Failed. Nothing more was changed.";$("#ok2").disabled=false}}}
      catch(x){p.innerHTML='<div class="box" style="max-width:none;margin-bottom:12px">I could not find collector area sheets (names ending in “AREA”) in that file.</div>'}};
    $("#ru").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const p=$("#rp");p.innerHTML='<div class="box">Reading file…</div>';
      try{await LIB.xlsx();const r=parseMasterlist(XLSX,await f.arrayBuffer());if(!r.outlets.length&&!r.relievers.length)throw 0;
        const by={};r.outlets.forEach(o=>by[o.municipality]=(by[o.municipality]||0)+1);const nc=r.outlets.filter(o=>o.lat==null);
        p.innerHTML=`<div class="box" style="max-width:none;margin-bottom:12px"><b>Ready to import</b><div style="margin:6px 0">${r.outlets.length} outlets · ${r.relievers.length} relievers · ${nc.length} outlet(s) without valid coordinates${nc.length?` (${nc.map(o=>esc(o.booth_code)).join(", ")})`:""}</div><div style="margin-bottom:8px">${Object.entries(by).map(([k,n])=>`${pill(k)} ${n}`).join(" &nbsp; ")}</div><p style="color:var(--mu);font-size:13px;margin:0 0 10px">Existing booths are updated by booth code; collector and address fields you set are kept. Nothing is deleted.</p><button class="btn" id="ok">Confirm import</button> <button class="ghost" id="no">Cancel</button><span id="pg" class="chip" style="margin-left:10px"></span></div>`;
        $("#no").onclick=()=>p.innerHTML="";
        $("#ok").onclick=async()=>{S.busy=true;$("#ok").disabled=true;try{
          const A=r.outlets.filter(o=>o.lat!=null),B=r.outlets.filter(o=>o.lat==null).map(({lat,lng,...o})=>o);let n=0;
          for(const g of [A,B])for(let i=0;i<g.length;i+=200){const{error}=await sb.from("registry_outlets").upsert(g.slice(i,i+200),{onConflict:"booth_code"});if(error)throw error;n+=Math.min(200,g.length-i);$("#pg").textContent=n+" / "+r.outlets.length}
          for(let i=0;i<r.relievers.length;i+=200){const{error}=await sb.from("registry_relievers").upsert(r.relievers.slice(i,i+200),{onConflict:"name"});if(error)throw error}
          S.busy=false;registry(v)}catch(x){S.busy=false;$("#pg").textContent="Import failed. Nothing more was changed.";$("#ok").disabled=false}}}
      catch(x){p.innerHTML='<div class="box" style="max-width:none;margin-bottom:12px">That file does not look like the North005 masterlist.</div>'}}}
  draw();subscribe()}

async function ets(v){
  v.innerHTML='<div class="empty">Loading map…</div>';await LIB.leaflet();
  v.innerHTML=`<div class="tbar" id="lg"></div><div id="map"></div>`;
  const O=(await all("registry_outlets")).filter(o=>o.lat!=null),miss=0;
  if(mapState){mapState.map.remove();mapState=null}
  const map=L.map("map",{zoomControl:true}).setView([7.45,125.8],10);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
  const groups={},on=new Set(Object.keys(MUNI)),el=map.getContainer();
  const pin=c=>L.divIcon({className:"",html:`<svg width="28" height="38" viewBox="0 0 28 38"><path d="M14 1C6.8 1 1 6.8 1 14c0 10 13 23 13 23s13-13 13-23C27 6.8 21.2 1 14 1z" fill="${c}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,iconSize:[28,38],iconAnchor:[14,37],tooltipAnchor:[0,-34],popupAnchor:[0,-34]});
  const line=(l,x)=>x?`<div><span style="color:#667">${l}</span> ${esc(x)}</div>`:"";
  for(const k in MUNI)groups[k]=L.layerGroup().addTo(map);
  O.forEach(o=>{const c=MUNI[o.municipality]?.[1]||"#888";
    L.marker([o.lat,o.lng],{icon:pin(c)}).bindTooltip(o.booth_code,{permanent:true,direction:"top",className:"bl"})
     .bindPopup(`<div class="pp"><b>📍 ${esc(o.booth_code)}</b>${line("Teller",o.sr_name)}${line("Municipality",MUNI[o.municipality]?.[0])}${line("Address",[o.purok,o.barangay].filter(Boolean).join(", "))}${line("Status",o.status)}${line("Contact",o.sr_contact)}${line("POS no.",o.pos_no)}${line("SR ID",o.sr_id_no)}${line("Operations Admin",o.oa_name)}${line("Collector",o.collector)}${line("Coordinates",o.lat+", "+o.lng)}</div>`)
     .addTo(groups[o.municipality]||map)});
  const counts={};O.forEach(o=>counts[o.municipality]=(counts[o.municipality]||0)+1);
  const legend=()=>{$("#lg").innerHTML=Object.entries(MUNI).map(([k,l])=>`<button class="chip2 leg" data-k="${k}" style="${on.has(k)?"":"opacity:.4"}"><i style="background:${l[1]}"></i>${l[0]} <small>${counts[k]||0}</small></button>`).join("")+`<span class="chip">${O.length} pin${O.length==1?"":"s"}</span>`;
    $("#lg").querySelectorAll(".leg").forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(on.has(k)){on.delete(k);map.removeLayer(groups[k])}else{on.add(k);groups[k].addTo(map)}legend()})};
  legend();
  const lab=()=>el.classList.toggle("nolab",map.getZoom()<13);map.on("zoomend",lab);
  if(O.length)map.fitBounds(O.map(o=>[o.lat,o.lng]),{padding:[40,40],maxZoom:15});
  else $("#view").insertAdjacentHTML("beforeend",`<div class="empty" style="margin-top:12px">No outlets with coordinates yet. Upload the masterlist in MASTER REGISTRY to see pins here.</div>`);
  lab();setTimeout(()=>map.invalidateSize(),100);mapState={map};subscribe()}

window.parseMasterlist=parseMasterlist;window.parseAreas=parseAreas;
window.MODS={"MASTER REGISTRY":registry,"ETS LIVE TRACKING":ets};
})();
