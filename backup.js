(()=>{
const NAME="BACK UP & RESTORE",KEY="n005_lastbackup";
const TABLES=[["profiles","id,username,full_name,role,status,area,created_at"],["registry_outlets","*"],["registry_relievers","*"],["daily_reports","*"],["cash_advances","*"],["ca_payments","*"],["rental_plans","*"],["rental_records","*"],["rental_payments","*"],["attendance","*"],["thermal_days","*"],["thermal_lines","*"],["thermal_restocks","*"]];
const LABEL={profiles:"Accounts (names, roles, status — never passwords)",registry_outlets:"Master Registry outlets",registry_relievers:"Relievers",daily_reports:"Daily sales reports",cash_advances:"Cash advances",ca_payments:"Cash advance payments",rental_plans:"Rental & load booth setups",rental_records:"Rental & load fee periods",rental_payments:"Rental & load payments",attendance:"Attendance records",thermal_days:"Thermal paper days",thermal_lines:"Thermal paper lines",thermal_restocks:"Thermal paper restocks"};
const B={bk:null};window.BACKUP=B;setTimeout(()=>{B.make=makeBackup;B.run=runRestore},0);
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error)throw new Error(t+": "+error.message);if(!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
const chunk=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o};
const omit=(r,...k)=>{const o={...r};k.forEach(x=>delete o[x]);return o};
const fmt=iso=>new Date(iso).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"});
const ago=iso=>{const d=Math.floor((Date.now()-new Date(iso))/864e5);return d<=0?"today":d==1?"yesterday":d+" days ago"};

async function makeBackup(progress){
  const data={},counts={};let n=0;
  for(const[t,c]of TABLES){progress("Reading "+(LABEL[t]||t)+"… ("+(++n)+"/"+TABLES.length+")");data[t]=await all(t,c);counts[t]=data[t].length}
  return{app:"north005",version:2,at:new Date().toISOString(),by:me.username,counts,data}}

async function runRestore(bk,log){
  const rows=t=>bk.data[t]||[],rep={},put=(t,k,v)=>{(rep[t]=rep[t]||{done:0,skipped:0,notes:[]});if(k=="n")rep[t].notes.push(v);else rep[t][k]+=v};
  const up=async(t,list,conflict)=>{for(const c of chunk(list,200)){const{error}=await sb.from(t).upsert(c,{onConflict:conflict});if(error)throw new Error(LABEL[t]+": "+error.message)}};
  // 1. accounts: match by username (passwords are never part of a backup)
  log("Matching accounts…");const cur=await all("profiles","id,username"),byUser=new Map(cur.map(p=>[p.username,p.id])),idMap=new Map(),missing=[];
  rows("profiles").forEach(p=>{const nid=byUser.get(p.username);if(nid)idMap.set(p.id,nid);else missing.push(p.username)});
  for(const p of rows("profiles")){const nid=idMap.get(p.id);if(!nid)continue;if(nid==me.id){put("profiles","skipped",1);continue}
    const{error}=await sb.from("profiles").update({full_name:p.full_name,role:p.role,status:p.status,area:p.area}).eq("id",nid);if(error)put("profiles","skipped",1);else put("profiles","done",1)}
  put("profiles","skipped",missing.length);if(missing.length)put("profiles","n","Not on this site yet (they must sign up first): "+missing.join(", "));
  // 2. registry
  log("Restoring Master Registry…");await up("registry_outlets",rows("registry_outlets").map(r=>omit(r,"id","created_at","updated_at")),"booth_code");put("registry_outlets","done",rows("registry_outlets").length);
  await up("registry_relievers",rows("registry_relievers").map(r=>omit(r,"id","created_at")),"name");put("registry_relievers","done",rows("registry_relievers").length);
  // 3. daily sales reports
  log("Restoring daily sales reports…");await up("daily_reports",rows("daily_reports").map(r=>({report_date:r.report_date,snapshot:r.snapshot,created_by:me.id})),"report_date");put("daily_reports","done",rows("daily_reports").length);
  // 4. rentals & load allowance (plans first, then monthly records mapped to the new plan ids)
  log("Restoring rental & load booth setups…");const oldPlan=new Map(rows("rental_plans").map(p=>[p.id,p.booth_code+"|"+p.kind]));
  await up("rental_plans",rows("rental_plans").map(r=>omit(r,"id","created_at","updated_at")),"booth_code,kind");put("rental_plans","done",rows("rental_plans").length);
  const newPlan=new Map((await all("rental_plans","id,booth_code,kind")).map(p=>[p.booth_code+"|"+p.kind,p.id]));
  log("Restoring monthly rental & load records…");const rr=[];rows("rental_records").forEach(r=>{const nid=newPlan.get(oldPlan.get(r.plan_id));if(nid)rr.push({...omit(r,"id","created_at","updated_at"),plan_id:nid});else put("rental_records","skipped",1)});
  await up("rental_records",rr,"plan_id,period");put("rental_records","done",rr.length);
  // payments: map each old fee period to the new one; old backups that only marked a period "paid" get one full payment
  log("Restoring rental & load payments…");const oldRec=new Map(rows("rental_records").map(r=>[r.id,newPlan.get(oldPlan.get(r.plan_id))+"|"+r.period])),newRec=new Map((await all("rental_records","id,plan_id,period")).map(r=>[r.plan_id+"|"+r.period,r.id])),rp=[];
  rows("rental_payments").forEach(p=>{const id=newRec.get(oldRec.get(p.record_id));if(id)rp.push({record_id:id,paid_on:p.paid_on,amount:p.amount,created_by:me.id});else put("rental_payments","skipped",1)});
  const hasPay=new Set(rows("rental_payments").map(p=>p.record_id));
  rows("rental_records").forEach(r=>{if(r.status=="paid"&&!hasPay.has(r.id)&&Number(r.amount)>0){const id=newRec.get(oldRec.get(r.id));if(id)rp.push({record_id:id,paid_on:r.paid_on||r.cover_start||r.period,amount:r.amount,created_by:me.id})}});
  for(const c of chunk(rp,200)){const{error}=await sb.from("rental_payments").upsert(c,{onConflict:"record_id,paid_on"});if(error)put("rental_payments","skipped",c.length);else put("rental_payments","done",c.length)}
  // 5. cash advances: oldest first, each with its payments, so the one-open-advance rule is respected
  log("Restoring cash advances & payments…");const curCA=await all("cash_advances","id,collector_id,taken_on,amount"),caKey=new Map(curCA.map(c=>[c.collector_id+"|"+c.taken_on+"|"+Number(c.amount),c.id])),pays=rows("ca_payments");
  for(const c of rows("cash_advances").slice().sort((a,b)=>a.taken_on.localeCompare(b.taken_on))){
    const nc=idMap.get(c.collector_id);if(!nc){put("cash_advances","skipped",1);put("cash_advances","n","Skipped an advance for "+c.collector_name+" (no matching account here).");continue}
    let id=caKey.get(nc+"|"+c.taken_on+"|"+Number(c.amount));
    if(!id){const{data,error}=await sb.from("cash_advances").insert({collector_id:nc,collector_name:c.collector_name,taken_on:c.taken_on,amount:c.amount,note:c.note,created_by:me.id}).select("id").single();
      if(error){put("cash_advances","skipped",1);put("cash_advances","n","Skipped an advance for "+c.collector_name+" ("+c.taken_on+"): "+(/OPEN_BALANCE/.test(error.message)?"that collector still has an unpaid advance here.":"could not be added."));continue}id=data.id}
    put("cash_advances","done",1);
    for(const p of pays.filter(x=>x.ca_id==c.id).sort((a,b)=>a.paid_on.localeCompare(b.paid_on))){const{error}=await sb.from("ca_payments").upsert({ca_id:id,paid_on:p.paid_on,amount:p.amount,created_by:me.id},{onConflict:"ca_id,paid_on"});if(error)put("ca_payments","skipped",1);else put("ca_payments","done",1)}}
  // 6. attendance (through a secure admin function, matched to accounts by username)
  log("Restoring attendance…");const att=[];rows("attendance").forEach(a=>{const nid=idMap.get(a.user_id);if(nid)att.push({...omit(a,"id","created_at"),user_id:nid});else put("attendance","skipped",1)});
  for(const c of chunk(att,300)){const{data,error}=await sb.rpc("admin_restore_attendance",{p:c});if(error)throw new Error("Attendance: "+error.message);put("attendance","done",data||0);put("attendance","skipped",c.length-(data||0))}
  // 7. thermal paper: each day in the backup replaces the same day here
  log("Restoring thermal paper days…");const byDay=new Map();rows("thermal_lines").forEach(l=>{if(!byDay.has(l.report_date))byDay.set(l.report_date,[]);byDay.get(l.report_date).push({booth_code:l.booth_code,rolls:l.rolls})});
  for(const d of rows("thermal_days")){const{error}=await sb.rpc("save_thermal_day",{p_date:d.report_date,p_opening:d.opening_stock,p_written:d.written_allocated,p_image:null,p_note:d.note,p_lines:byDay.get(d.report_date)||[]});if(error)put("thermal_days","skipped",1);else{put("thermal_days","done",1);put("thermal_lines","done",(byDay.get(d.report_date)||[]).length)}}
  const have=new Set((await all("thermal_restocks","restock_date,rolls,note")).map(r=>r.restock_date+"|"+r.rolls+"|"+(r.note||"")));
  const add=rows("thermal_restocks").filter(r=>!have.has(r.restock_date+"|"+r.rolls+"|"+(r.note||""))).map(r=>({restock_date:r.restock_date,rolls:r.rolls,note:r.note,created_by:me.id}));
  for(const c of chunk(add,200)){const{error}=await sb.from("thermal_restocks").insert(c);if(error)throw new Error("Restocks: "+error.message)}put("thermal_restocks","done",add.length);put("thermal_restocks","skipped",rows("thermal_restocks").length-add.length);
  return rep}

function drawBackupCard(){
  const last=localStorage.getItem(KEY);const el=$("#lb");if(!el)return;
  const stale=!last||(Date.now()-new Date(last))>7*864e5;
  el.innerHTML=last?`Last backup downloaded: <b>${fmt(last)}</b> (${ago(last)})${stale?' <span style="color:#f59e0b">— it has been more than a week</span>':""}`:'<span style="color:#f59e0b">No backup has been downloaded from this browser yet.</span>'}

async function backup(v){
  v.innerHTML=`<div class="dgrid" style="margin-top:0"><div class="dc"><h4>Download a backup</h4><p style="margin:0 0 10px;color:var(--mu);font-size:13.5px">Saves all your records into one file you can keep on your computer or phone: registry, sales reports, cash advances, rentals, attendance and thermal paper.</p><div class="chip" id="lb" style="margin-bottom:10px"></div><button class="btn" id="bd" style="width:auto;padding:11px 22px;margin:0">Download backup</button><div class="msg" id="bm" style="text-align:left;color:var(--gold);min-height:20px"></div></div>
  <div class="dc"><h4>Restore from a backup</h4><div class="drop" id="rz" tabindex="0" style="margin-top:0"><b>Drop a backup file here</b><br><span class="chip">or click to choose a .json file</span><input type="file" id="rf" accept=".json,application/json" hidden></div><div id="rp"></div></div></div>
  <div class="dc" style="margin-top:14px"><h4>Good to know</h4><div style="font-size:13.5px;line-height:1.6;color:var(--mu)">
  <b style="color:var(--tx)">Included:</b> every record listed above, plus account names, roles and statuses.<br>
  <b style="color:var(--tx)">Not included:</b> passwords (nobody's, ever), and uploaded files — employee documents, profile and chart photos, and thermal sheet photos stay safely in storage.<br>
  <b style="color:var(--tx)">How restoring works:</b> it adds missing records and updates ones that already exist. <b>Nothing is deleted.</b> Accounts are matched by username, so on a brand-new site people must sign up first, then restore.<br>
  <b style="color:var(--tx)">Tip:</b> download a backup after each week's work, and before any big change.</div></div>`;
  drawBackupCard();
  $("#bd").onclick=async()=>{const b=$("#bd"),m=$("#bm");b.disabled=true;m.style.color="var(--gold)";try{const bk=await makeBackup(t=>m.textContent=t),total=Object.values(bk.counts).reduce((s,n)=>s+n,0),blob=new Blob([JSON.stringify(bk)],{type:"application/json"}),a=document.createElement("a");
      a.href=URL.createObjectURL(blob);a.download="north005-backup-"+bk.at.slice(0,10)+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);localStorage.setItem(KEY,bk.at);drawBackupCard();m.textContent="Backup downloaded: "+total.toLocaleString()+" records ("+(blob.size/1048576).toFixed(2)+" MB)."}
    catch(e){m.style.color="#ff8b9b";m.textContent="The backup could not be completed. Please try again."}b.disabled=false};
  const z=$("#rz"),inp=$("#rf");z.onclick=e=>{if(e.target!==inp)inp.click()};inp.onclick=e=>e.stopPropagation();inp.onchange=()=>{if(inp.files[0])load(inp.files[0]);inp.value=""};
  z.ondragover=e=>{e.preventDefault();z.classList.add("over")};z.ondragleave=()=>z.classList.remove("over");z.ondrop=e=>{e.preventDefault();z.classList.remove("over");if(e.dataTransfer.files[0])load(e.dataTransfer.files[0])}}

async function load(file){
  const p=$("#rp");p.innerHTML='<div class="chip" style="margin-top:10px">Reading the file…</div>';let bk;
  try{bk=JSON.parse(await file.text());if(bk.app!="north005"||!bk.data)throw 0}catch(e){p.innerHTML='<div class="warn2" style="margin-top:10px">That file is not a North005 backup.</div>';return}
  B.bk=bk;const have=TABLES.filter(([t])=>(bk.data[t]||[]).length);
  const cur=await all("profiles","username").catch(()=>[]),here=new Set(cur.map(x=>x.username)),miss=(bk.data.profiles||[]).filter(x=>!here.has(x.username)).map(x=>x.username);
  p.innerHTML=`<div style="margin-top:12px"><div class="chip">Backup made ${esc(fmt(bk.at))}${bk.by?" by "+esc(bk.by):""}</div>
  <div class="tw" style="margin:8px 0"><table><thead><tr><th>What</th><th>Records in the file</th></tr></thead><tbody>${have.map(([t])=>`<tr><td>${esc(LABEL[t]||t)}</td><td>${bk.data[t].length.toLocaleString()}</td></tr>`).join("")||'<tr><td colspan="2">The file is empty.</td></tr>'}</tbody></table></div>
  ${miss.length?`<div class="warn2">⚠ ${miss.length} account(s) in the backup are not on this site, so their cash advances and attendance will be skipped: ${esc(miss.slice(0,8).join(", "))}${miss.length>8?" …":""}</div>`:""}
  <div class="chip" style="margin-bottom:8px">Existing records with the same booth code, date or month are updated from the backup. Nothing is deleted.</div>
  <label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="rk"> I understand and want to restore this backup</label>
  <button class="btn" id="rg" style="width:auto;padding:10px 22px;margin:0" disabled>Restore now</button> <button class="ghost" id="rc">Cancel</button><pre id="rl" style="display:none;white-space:pre-wrap;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;margin-top:12px;font-size:12.5px;max-height:240px;overflow:auto"></pre><div id="rr"></div></div>`;
  $("#rk").onchange=e=>$("#rg").disabled=!e.target.checked;$("#rc").onclick=()=>{p.innerHTML="";B.bk=null};
  $("#rg").onclick=async()=>{const lg=$("#rl");lg.style.display="block";const log=s=>{lg.textContent+=s+"\n";lg.scrollTop=lg.scrollHeight};$("#rg").disabled=true;$("#rk").disabled=true;$("#rc").disabled=true;
    try{const rep=await runRestore(bk,log);log("Done.");$("#rr").innerHTML=`<div class="tw" style="margin-top:10px"><table><thead><tr><th>What</th><th>Restored</th><th>Skipped</th></tr></thead><tbody>${Object.entries(rep).map(([t,r])=>`<tr><td>${esc(LABEL[t]||t)}</td><td>${r.done}</td><td>${r.skipped}</td></tr>`).join("")}</tbody></table></div>${Object.values(rep).flatMap(r=>r.notes).map(n=>`<div class="chip" style="margin-top:6px">${esc(n)}</div>`).join("")}`}
    catch(e){log("Stopped: "+e.message+". Records restored before this point are kept; nothing was deleted.");$("#rc").disabled=false}}}

window.MODS=Object.assign(window.MODS||{},{[NAME]:backup});
})();
