(()=>{
const NAME="THERMAL PAPER DAILY SUMMARY",BUCKET="thermal-images";
const MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const fd=s=>{if(!s)return"";const[y,m,d]=s.split("-").map(Number);return MO[m-1]+" "+d+", "+y};
const SHEET="From thermal sheet";
const T={date:null,ed:null,sub:false,busy:false};window.THERMAL=T;
const MU=()=>window.MUNI||{};
const n0=v=>Number.isFinite(+v)?+v:0;
async function all(t,cols){let out=[],i=0;for(;;){const{data,error}=await sb.from(t).select(cols||"*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
function subscribe(){if(T.sub)return;T.sub=true;let t;const f=()=>{clearTimeout(t);t=setTimeout(()=>{if(!QUIETW()&&cur==NAME&&!T.ed&&!T.busy&&!document.querySelector("dialog[open]"))go(cur)},700)};
  let c=sb.channel("thermal");["thermal_days","thermal_lines","thermal_restocks"].forEach(x=>c=c.on("postgres_changes",{event:"*",schema:"public",table:x},f));c.subscribe();
  document.addEventListener("paste",e=>{if(cur!=NAME||T.ed||document.querySelector("dialog[open]"))return;const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type));if(f){e.preventDefault();startFromImage($("#view"),f)}})}
const normBooth=s=>{s=String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"");const m=s.match(/(\d{1,5})$/);return m?"DDN-"+m[1]:String(s||"").trim()};

// ---- parsing (used by both the quick-list box and OCR) ----
function parseLines(text){const out=[],re=/(?:DDN|DON|D0N|ODN)?[\s:._]*?(\d{2,4})\s*[-–—_~=:]\s*(\d{1,3})(?!\d)/gi;let m;while((m=re.exec(text))){out.push({booth:"DDN-"+m[1],rolls:+m[2]})}return out}
function parseHeader(text){const h={},mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  let m=text.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})\s*,?\s*(20\d\d)/i);if(m)h.date=`${m[3]}-${String(mo[m[1].toLowerCase()]).padStart(2,"0")}-${String(+m[2]).padStart(2,"0")}`;
  m=text.match(/stock[s]?\s*on\s*hand\D{0,6}(\d{2,4})/i);if(m)h.opening=+m[1];
  m=text.match(/(\d{2,4})\s*rolls?\s*alloc/i);if(m)h.written=+m[1];
  m=text.match(/(\d{1,4})\s*rolls?\s*\+\s*(\d{1,4})\s*rolls?\s*=\s*(\d{1,4})/i);if(m){h.opening=+m[1];h.restock=+m[2];h.onhand=+m[3]}
  m=text.match(/(\d{2,4})\s*rolls?\s*on\s*hand/i);if(m)h.onhand=+m[1];m=text.match(/(\d{1,4})\s*rolls?\s*remain/i);if(m)h.remaining=+m[1];return h}
window.THERMAL_PARSE={parseLines,parseHeader,normBooth};

async function thermal(v){subscribe();if(T.ed)return editor(v);
  LOAD(v);
  const[S,R,O]=await Promise.all([sb.from("thermal_summary").select("*").order("report_date",{ascending:false}).range(0,999),all("thermal_restocks"),all("registry_outlets","booth_code,municipality,sr_name")]);
  const days=S.data||[],reg=new Map(O.map(o=>[o.booth_code,o]));if(!T.date||!days.some(d=>d.report_date==T.date))T.date=days[0]?.report_date||null;
  const rs=d=>R.filter(r=>r.restock_date==d).reduce((s,r)=>s+r.rolls,0),remain=d=>d.opening_stock+rs(d.report_date)-d.allocated,day=days.find(d=>d.report_date==T.date);
  let lines=[];if(day){const r=await sb.from("thermal_lines").select("*").eq("report_date",T.date).range(0,999);lines=r.data||[]}
  const cnt={};lines.forEach(l=>cnt[l.booth_code]=(cnt[l.booth_code]||0)+1);
  v.innerHTML=`<div class="tbar">${days.length?`<select id="td" style="max-width:190px">${days.map(d=>`<option value="${d.report_date}"${d.report_date==T.date?" selected":""}>${fd(d.report_date)}</option>`).join("")}</select>`:""}<button class="ghost" id="tn">+ Manual Entry</button><button class="ghost" id="tr">+ Restock</button>${day?'<button class="ghost" id="te">Edit this day</button><button class="ghost" id="tx">Delete day</button>':""}</div>
  <div class="drop" id="tz" tabindex="0" style="margin:0 0 14px"><b>Drop the thermal report photo here</b><br><span class="chip">or click to choose · or press Ctrl+V to paste a photo</span><input type="file" id="tf" hidden accept="image/*"></div>
  ${day?`<div class="kpis" style="margin-bottom:12px"><div class="kpi"><small>Opening stock</small><b>${day.opening_stock}</b></div><div class="kpi"><small>Restocked that day</small><b>${rs(day.report_date)}</b></div><div class="kpi"><small>Rolls given</small><b>${day.allocated}</b><small>${day.booths} lines</small></div><div class="kpi"><small>Remaining balance</small><b>${remain(day)}</b><small>on hand ${day.opening_stock+rs(day.report_date)}</small></div></div>
  ${day.written_allocated!=null&&day.written_allocated!=day.allocated?`<div class="warn2">⚠ The sheet says <b>${day.written_allocated}</b> rolls allocated, but the lines add up to <b>${day.allocated}</b> (difference ${day.allocated-day.written_allocated}). Use “Edit this day” to check them.</div>`:""}
  ${day.image_path?'<div style="margin-bottom:10px"><button class="ghost" id="tv">View sheet photo</button></div>':""}<div id="tl"></div>`:`<div class="empty"><b>THERMAL PAPER DAILY SUMMARY</b><br>No daily summaries yet. Drop a photo above, or use “+ Manual Entry”.</div>`}
  <h4 class="h">Stock history</h4><div id="th"></div><h4 class="h">Restocks</h4><div id="trs"></div>`;
  if($("#td"))$("#td").onchange=e=>{T.date=e.target.value;PAGER.reset("th_l");go(cur)};
  const z=$("#tz"),inp=$("#tf");z.onclick=e=>{if(e.target!==inp)inp.click()};inp.onclick=e=>e.stopPropagation();inp.onchange=()=>{if(inp.files[0])startFromImage(v,inp.files[0])};
  z.ondragover=e=>{e.preventDefault();z.classList.add("over")};z.ondragleave=()=>z.classList.remove("over");z.ondrop=e=>{e.preventDefault();z.classList.remove("over");const f=[...e.dataTransfer.files].find(x=>/^image\//.test(x.type));if(f)startFromImage(v,f)};
  const prevInfo=d=>defaults(days,R,d);
  $("#tn").onclick=()=>{const d=iso(new Date()),p=prevInfo(d);T.ed={date:d,opening:p.opening,written:"",note:"",lines:[],image:null,prev:p};thermal(v)};
  $("#tr").onclick=()=>restockDlg(()=>thermal(v));
  if(day){$("#te").onclick=()=>{T.ed={date:day.report_date,opening:day.opening_stock,restock:(R.find(r=>r.restock_date==day.report_date&&r.note===SHEET)||{}).rolls??"",written:day.written_allocated??"",note:day.note||"",lines:lines.map(l=>({booth:l.booth_code,rolls:l.rolls})),image:day.image_path?{path:day.image_path}:null,prev:prevInfo(day.report_date),existing:true};thermal(v)};
    $("#tx").onclick=async()=>{if(!confirm("Delete the thermal summary for "+fd(day.report_date)+"?"))return;if(day.image_path)await sb.storage.from(BUCKET).remove([day.image_path]);const{error}=await sb.from("thermal_days").delete().eq("report_date",day.report_date);if(error)return alert("Could not delete.");T.date=null;thermal(v)};
    if($("#tv"))$("#tv").onclick=async()=>{const{data,error}=await sb.storage.from(BUCKET).createSignedUrl(day.image_path,300);if(error)return alert("Could not open the photo.");window.open(data.signedUrl,"_blank")};
    const draw=()=>{const pg=PAGER.paginate("th_l",lines.slice().sort((a,b)=>(parseInt(a.booth_code.replace(/\D/g,""))||0)-(parseInt(b.booth_code.replace(/\D/g,""))||0)));
      $("#tl").innerHTML=lines.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Municipality</th><th>Rolls</th><th>Check</th></tr></thead><tbody>${pg.slice.map(l=>{const o=reg.get(l.booth_code),f=[];if(!o)f.push('<span class="pill" style="background:#f59e0b">not in registry</span>');if(cnt[l.booth_code]>1)f.push('<span class="pill" style="background:#ef4444">duplicate</span>');
        return`<tr><td><b>${esc(l.booth_code)}</b></td><td>${esc(o?.sr_name||"")}</td><td>${o&&MU()[o.municipality]?`<span class="pill" style="background:${MU()[o.municipality][1]}">${MU()[o.municipality][0]}</span>`:""}</td><td><b>${l.rolls}</b></td><td>${f.join(" ")}</td></tr>`}).join("")}</tbody></table></div>`+pg.bar:'<div class="empty">No lines on this day.</div>';PAGER.bind($("#tl"),pg.st,draw)};draw()}
  const hist=()=>{const pg=PAGER.paginate("th_h",days);$("#th").innerHTML=days.length?`<div class="tw"><table><thead><tr><th>Date</th><th>Opening</th><th>Restocked</th><th>Given</th><th>Remaining</th><th>Lines</th></tr></thead><tbody>${pg.slice.map(d=>`<tr data-d="${d.report_date}" style="cursor:pointer"><td>${fd(d.report_date)}</td><td>${d.opening_stock}</td><td>${rs(d.report_date)}</td><td>${d.allocated}</td><td><b>${remain(d)}</b></td><td>${d.booths}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="chip">Nothing yet.</div>';
    $("#th").querySelectorAll("tr[data-d]").forEach(t=>t.onclick=()=>{T.date=t.dataset.d;PAGER.reset("th_l");go(cur)});PAGER.bind($("#th"),pg.st,hist)};hist();
  const rsd=()=>{const f=R.slice().sort((a,b)=>b.restock_date.localeCompare(a.restock_date)),pg=PAGER.paginate("th_r",f);$("#trs").innerHTML=f.length?`<div class="tw"><table><thead><tr><th>Date</th><th>Rolls</th><th>Note</th><th></th></tr></thead><tbody>${pg.slice.map(r=>`<tr><td>${fd(r.restock_date)}</td><td><b>+${r.rolls}</b></td><td>${esc(r.note||"")}</td><td><button class="ghost" data-r="${r.id}">Delete</button></td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="chip">No restocks recorded.</div>';
    $("#trs").querySelectorAll("[data-r]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this restock?"))return;const{error}=await sb.from("thermal_restocks").delete().eq("id",b.dataset.r);if(error)return alert("Could not delete.");thermal(v)});PAGER.bind($("#trs"),pg.st,rsd)};rsd()}

function defaults(days,R,d){const prev=days.filter(x=>x.report_date<d).sort((a,b)=>b.report_date.localeCompare(a.report_date))[0];if(!prev)return{opening:0,from:null};
  const rs=x=>R.filter(r=>r.restock_date==x).reduce((s,r)=>s+r.rolls,0),between=R.filter(r=>r.restock_date>prev.report_date&&r.restock_date<d).reduce((s,r)=>s+r.rolls,0);
  return{opening:Math.max(0,prev.opening_stock+rs(prev.report_date)-prev.allocated+between),from:prev.report_date}}

function restockDlg(done){const d=document.createElement("dialog");d.innerHTML=`<h4 style="margin:0 0 6px">Restock thermal paper</h4><div class="g2"><div><label>Date received</label><input type="date" id="rd" value="${iso(new Date())}"></div><div><label>Rolls received</label><input type="number" id="rr" min="1" step="1" inputmode="numeric"></div></div><label>Note (optional)</label><input id="rn"><div class="msg" id="rm"></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn" id="rs">Save</button><button class="ghost" id="rx">Cancel</button></div>`;document.body.appendChild(d);d.showModal();
  const close=()=>{d.close();d.remove()};d.querySelector("#rx").onclick=close;
  d.querySelector("#rs").onclick=async()=>{const n=parseInt(d.querySelector("#rr").value),dt=d.querySelector("#rd").value,m=d.querySelector("#rm");if(!(n>0)||!dt)return m.textContent="Enter the date and number of rolls.";
    const{error}=await sb.from("thermal_restocks").insert({restock_date:dt,rolls:n,note:d.querySelector("#rn").value.trim()||null,created_by:me.id});if(error)return m.textContent="Could not save.";close();done()}}

// ---------------- editor ----------------
async function startFromImage(v,file){const days=(await sb.from("thermal_summary").select("*").range(0,999)).data||[],R=await all("thermal_restocks"),d=iso(new Date()),p=defaults(days,R,d);
  T.ed={date:d,opening:p.opening,written:"",note:"",lines:[],image:{file,url:URL.createObjectURL(file)},prev:p,days,R};thermal(v)}

// ================= FREE LOCAL READER + AI EXTRACTION =================
// Supports both local Tesseract.js (free, no API key) and Gemini API (better accuracy for difficult handwriting)
// Gemini extraction sends the image to Google's Gemini API but uses your own API key stored locally.
const TESS_SRC="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const NUMWHITE="0123456789-–—";      // digits + dashes only, so letters can never become a booth code
const DASHES=/[-–—~_:.]/;
const THERMAL_GEMINI_KEY = 'thermal_gemini_api_key';
let WORKER=null,PROG=null;

// Gemini API system prompt for thermal paper extraction
const THERMAL_SYSTEM_PROMPT = `You read handwritten thermal paper daily summary sheets (lottery/collection booth allocation reports).

Extract data into STRICT JSON with no preamble, no markdown fences, nothing but the JSON object.

Schema:
{
  "date": string or null,
  "opening_stock": number or null,
  "written_allocated": number or null,
  "restocked_today": number or null,
  "on_hand": number or null,
  "remaining": number or null,
  "lines": [
    {
      "booth": string,
      "rolls": number
    }
  ]
}

Example format from the sheet:
DDN 767 - 5
    1723 - 5
    1794 - 5
    772 - 5
...
DDN 397 - 5
    425 - 5
    426 - 10

All lines above that have booth numbers (767, 1723, 1794, 772, 397, 425, 426...) with "- N" rolls are booth allocations. Extract EVERY single one.

Rules:
- Extract EVERY line that contains a booth code followed by a number of rolls. This includes the "DDN XXX - Y" lines AND all indented lines underneath them (like 1723 - 5, 1794 - 5, etc.).
- The dash "-" means "allocated" / "gets" the number of rolls. It is NOT subtraction. "1723 - 5" means booth 1723 gets 5 rolls.
- Look for booth code patterns: DDN-###, DON-###, D0N-###, ODN-###, or just bare numbers (###). Also booth codes may have 2-4 digits.
- There are TWO columns. Read left column completely top-to-bottom (all lines in left column), then right column completely top-to-bottom (all lines in right column). Do not mix them.
- For each match like "(booth) - (rolls)", extract booth and rolls as numbers.
- Normalize booth codes: if prefixed with DDN/DON/D0N/ODN keep/normalize to DDN-### format (uppercase). If it's just a bare number like 1723, assume DDN-1723.
- Preserve the exact sequence as written. Do NOT skip any line that matches the booth-roll pattern.
- Count ALL booth allocation entries - if you see 32 lines total with booth-roll pairs, extract exactly 32.
- Don't miss any line even if faint, small, indented, or crowded.
- For header fields (date, stocks on hand, totals, remaining balance), extract if clearly visible.
- Numbers only in numeric fields, no currency symbols or text.
- If truly not present, use null.
- Output ONLY the JSON object.`;

async function loadScript(src){return new Promise((res,rej)=>{if(window.Tesseract)return res();const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("reader"));document.head.appendChild(s)})}
async function getWorker(){if(WORKER)return WORKER;await loadScript(TESS_SRC);WORKER=await Tesseract.createWorker("eng",1,{logger:m=>{if(PROG)try{PROG(m)}catch(e){}}});return WORKER}
async function ocr(canvas,params){const w=await getWorker(),r=await w.recognize(canvas,Object.assign({tessedit_pageseg_mode:"6"},params||{}),{blocks:true});return r&&r.data||{}}

async function extractViaGemini(image, onStep){
  const apiKey = localStorage.getItem(THERMAL_GEMINI_KEY);
  if(!apiKey) {
    throw new Error('No Gemini API key found. Please add one in settings.');
  }
  const say = onStep || (() => {});
  say('Preparing image for AI extraction...');
  const base64 = await fileToBase64(image);
  if(!base64) {
    throw new Error('Could not process image');
  }
  say('Sending to Gemini API...');
  const GEMINI_MODEL = 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      system_instruction: {parts: [{text: THERMAL_SYSTEM_PROMPT}]},
      contents: [{
        role: 'user', 
        parts: [
          {inline_data: {mime_type: 'image/jpeg', data: base64}},
          {text: 'Extract the thermal paper data from this image as instructed.'}
        ]
      }],
      generationConfig: {responseMimeType: 'application/json'}
    })
  });
  if(!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || ('HTTP ' + response.status));
  }
  const data = await response.json();
  const candidate = (data.candidates||[])[0];
  const textBlocks = (candidate?.content?.parts||[]).filter(p=>p.text).map(p=>p.text).join('\n');
  let clean = textBlocks.trim().replace(/^```json/i,'').replace(/^```/,'').replace(/```\s*$/,'').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if(firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(clean);
  // Convert to format expected by thermal module
  const lines = (parsed.lines || []).map(l => ({
    booth: normBooth(l.booth),
    rolls: Number(l.rolls) || 0,
    u: false,
    c: ''
  }));
  const header = {
    date: parsed.date,
    opening: parsed.opening_stock,
    written: parsed.written_allocated,
    onhand: parsed.on_hand,
    remaining: parsed.remaining,
    restocked_today: parsed.restocked_today
  };
  // Convert canvas if available (for preview)
  const canvas = await toCanvas(image, 800);
  say('Extraction complete!');
  return {lines, header, canvas};
}

// API key management
function getThermalApiKey(){ return localStorage.getItem(THERMAL_GEMINI_KEY); }
function setThermalApiKey(key){ if(key) localStorage.setItem(THERMAL_GEMINI_KEY, key); else localStorage.removeItem(THERMAL_GEMINI_KEY); }

async function loadAny(src){
  if(typeof Blob!="undefined"&&src instanceof Blob){try{return await createImageBitmap(src,{imageOrientation:"from-image"})}catch(e){}}
  return await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=(typeof Blob!="undefined"&&src instanceof Blob)?URL.createObjectURL(src):src})}

async function fileToBase64(file){
  if(!file) return null;
  const f = (file.file || file.url) || file;
  // If it's already a data URL
  if(typeof f === 'string' && f.startsWith('data:')) {
    return f.split(',')[1];
  }
  if(f instanceof Blob || (f.constructor && f.constructor.name === 'File')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }
  return null;
}
async function toCanvas(file,maxW){const img=await loadAny((file&&(file.file||file.url))||file),w=img.width||img.naturalWidth,h=img.height||img.naturalHeight;
  const sc=Math.min(1,maxW/w),c=document.createElement("canvas");c.width=Math.round(w*sc);c.height=Math.round(h*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);if(img.close)img.close();return c}
const ctx=c=>c.getContext("2d",{willReadFrequently:true});

// -- image preparation -----------------------------------------------------------
function contrast(c){ // grayscale + contrast stretch (2–98 percentile): pale or unevenly lit photos still read
  const x=ctx(c),im=x.getImageData(0,0,c.width,c.height),d=im.data,n=c.width*c.height,h=new Uint32Array(256);
  for(let i=0;i<d.length;i+=4){const g=(.299*d[i]+.587*d[i+1]+.114*d[i+2])|0;d[i]=d[i+1]=d[i+2]=g;h[g]++}
  let lo=0,hi=255,a=0;for(let g=0;g<256;g++){a+=h[g];if(a>=n*.02){lo=g;break}}a=0;for(let g=255;g>=0;g--){a+=h[g];if(a>=n*.02){hi=g;break}}
  const k=255/Math.max(1,hi-lo);
  for(let i=0;i<d.length;i+=4){const v=(d[i]-lo)*k;d[i]=d[i+1]=d[i+2]=v<0?0:v>255?255:v}
  x.putImageData(im,0,0);return c}
function rotate(c,deg){const r=deg*Math.PI/180,s=Math.abs(Math.sin(r)),co=Math.abs(Math.cos(r)),w=c.width,h=c.height;
  const k=document.createElement("canvas");k.width=Math.round(w*co+h*s);k.height=Math.round(w*s+h*co);
  const x=k.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,k.width,k.height);x.translate(k.width/2,k.height/2);x.rotate(r);x.drawImage(c,-w/2,-h/2);return k}
function inkScore(c){const x=ctx(c),d=x.getImageData(0,0,c.width,c.height).data,rows=new Float64Array(c.height);
  for(let y=0;y<c.height;y++){let n=0;for(let xx=0;xx<c.width;xx++)if(d[(y*c.width+xx)*4]<150)n++;rows[y]=n}
  let s=0;for(let y=0;y<rows.length;y++)s+=rows[y]*rows[y];return s}
function deskew(c){ // ±5° in 0.5° steps on a small copy — straightens a photo taken slightly crooked
  const sc=Math.min(1,700/c.width),p=document.createElement("canvas");p.width=Math.round(c.width*sc);p.height=Math.round(c.height*sc);
  p.getContext("2d").drawImage(c,0,0,p.width,p.height);
  let best=0,bs=-1;for(let a=-5;a<=5.01;a+=.5){const s=inkScore(rotate(p,a));if(s>bs){bs=s;best=a}}
  return best?rotate(c,best):c}
function upscale(c,minW){if(c.width>=minW)return c;const k=Math.min(3,minW/c.width),o=document.createElement("canvas");
  o.width=Math.round(c.width*k);o.height=Math.round(c.height*k);
  const x=o.getContext("2d");x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";x.drawImage(c,0,0,o.width,o.height);return o}
function blur3(c){ // gentle 3×3 blur — smooths JPEG/paper noise so thresholding doesn't leave specks
  const x=ctx(c),w=c.width,h=c.height,im=x.getImageData(0,0,w,h),d=im.data,t=new Float32Array(w*h*3);
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=(y*w+xx)*4,l=xx>0?i-4:i,r=xx<w-1?i+4:i;
    for(let k=0;k<3;k++)t[(y*w+xx)*3+k]=(d[l+k]+2*d[i+k]+d[r+k])/4}
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const p=(y*w+xx),i=p*4,u=(y>0?y-1:y)*w+xx,dn=(y<h-1?y+1:y)*w+xx;
    for(let k=0;k<3;k++)d[i+k]=(t[u*3+k]+2*t[p*3+k]+t[dn*3+k])/4}
  x.putImageData(im,0,0);return c}
function despeckle(c){ // drop the 1–2px specks thresholding leaves behind; real strokes are wider
  const x=ctx(c),w=c.width,h=c.height,im=x.getImageData(0,0,w,h),d=im.data,n=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=(y*w+xx)*4;if(d[i]>=128)continue;let k=0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const ny=y+dy,nx=xx+dx;if(ny<0||nx<0||ny>=h||nx>=w)continue;if(d[(ny*w+nx)*4]<128)k++}
    n[y*w+xx]=k}
  for(let p=0;p<w*h;p++)if(n[p]&&n[p]<3){const i=p*4;d[i]=d[i+1]=d[i+2]=255}
  x.putImageData(im,0,0);return c}
function autoCrop(c){ // keep only the page itself — the dark desk around it would otherwise read as noise
  const x=ctx(c),w=c.width,h=c.height,d=x.getImageData(0,0,w,h).data;
  const cw=new Uint32Array(w),rw=new Uint32Array(h);
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++)if(d[(y*w+xx)*4]>170){cw[xx]++;rw[y]++}
  let x0=0,x1=w-1,y0=0,y1=h-1;const thx=Math.round(h*.25),thy=Math.round(w*.25);
  while(x0<x1&&cw[x0]<thx)x0++;while(x1>x0&&cw[x1]<thx)x1--;
  while(y0<y1&&rw[y0]<thy)y0++;while(y1>y0&&rw[y1]<thy)y1--;
  if(x1-x0<w*.35||y1-y0<h*.35)return c;
  const mx=Math.round((x1-x0)*.02),my=Math.round((y1-y0)*.02);
  x0=Math.max(0,x0-mx);y0=Math.max(0,y0-my);x1=Math.min(w-1,x1+mx);y1=Math.min(h-1,y1+my);
  const k=document.createElement("canvas");k.width=x1-x0+1;k.height=y1-y0+1;
  k.getContext("2d").drawImage(c,x0,y0,k.width,k.height,0,0,k.width,k.height);return k}
function unrule(c){ // erase the notebook's printed ruling & margin rules. They survive thresholding as
  const x=ctx(c),w=c.width,h=c.height,im=x.getImageData(0,0,w,h),d=im.data;   // dashed fragments and would be read as minus signs
  const dark=i=>d[i]<170,vrun=(xx,y)=>{let a=y,b=y;while(a>0&&dark(((a-1)*w+xx)*4))a--;while(b<h-1&&dark(((b+1)*w+xx)*4))b++;return b-a+1},hrun=(xx,y)=>{let a=xx,b=xx;while(a>0&&dark((y*w+a-1)*4))a--;while(b<w-1&&dark((y*w+b+1)*4))b++;return b-a+1};
  const THIN=7;                                   // a printed rule is 1–6px thin; handwriting strokes are 8px+
  const thinX=new Uint8Array(w*h);                // 1 = dark pixel no thicker than a printed rule
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){const i=(y*w+xx)*4;if(dark(i)&&vrun(xx,y)<=THIN)thinX[i]=1}
  // projection: a real rule lights up one scan-line across much of the page width at once —
  // a handwritten dash is short, so it can never reach that count even where it sits on a rule
  const rx=new Float64Array(h);for(let y=0;y<h;y++){let n=0;for(let xx=0;xx<w;xx++)n+=thinX[(y*w+xx)*4];rx[y]=n}
  const thx=Math.max(150,Math.round(w*.18));
  for(let y=0;y<h;y++)if(rx[y]>=thx)for(let xx=0;xx<w;xx++){const i=(y*w+xx)*4;if(thinX[i])d[i]=d[i+1]=d[i+2]=255}
  const ry=new Float64Array(w);for(let xx=0;xx<w;xx++){let n=0;for(let y=0;y<h;y++)n+=thinX[(y*w+xx)*4];ry[xx]=n}
  const thy=Math.max(150,Math.round(h*.18));
  for(let xx=0;xx<w;xx++)if(ry[xx]>=thy)for(let y=0;y<h;y++){const i=(y*w+xx)*4;if(thinX[i])d[i]=d[i+1]=d[i+2]=255}
  x.putImageData(im,0,0);return c}
function clean(c,tol=16,win=30){ // adaptive (local average) threshold → pure black writing on white, survives shadows and glare
  const x=ctx(c),w=c.width,h=c.height,im=x.getImageData(0,0,w,h),d=im.data,W=w+1,I=new Float64Array(W*(h+1));
  for(let y=0;y<h;y++){let rs=0;for(let xx=0;xx<w;xx++){rs+=d[(y*w+xx)*4];I[(y+1)*W+xx+1]=I[y*W+xx+1]+rs}}
  const r=win>>1;
  for(let y=0;y<h;y++)for(let xx=0;xx<w;xx++){
    const x0=xx-r<0?0:xx-r,xa=xx+r+1>w?w:xx+r+1,y0=y-r<0?0:y-r,ya=y+r+1>h?h:y+r+1;
    const mean=(I[ya*W+xa]-I[y0*W+xa]-I[ya*W+x0]+I[y0*W+x0])/((xa-x0)*(ya-y0)),i=(y*w+xx)*4,v=d[i]<mean-tol?0:255;
    d[i]=d[i+1]=d[i+2]=v}
  x.putImageData(im,0,0);return c}

// -- reading the sheet ----------------------------------------------------------
function wordsOf(data){const out=[];
  if(Array.isArray(data.blocks))data.blocks.forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(w=>{if(w&&w.text)out.push(w)}))));
  if(!out.length&&typeof data.tsv=="string")data.tsv.split("\n").slice(1).forEach(ln=>{const p=ln.split("\t");if(p.length>=12&&p[11]&&+p[10]>0)out.push({text:p[11],confidence:+p[10],bbox:{x0:+p[6],y0:+p[7],x1:+p[6]+ +p[8],y1:+p[7]+ +p[9]}})});
  return out}
function groupRows(words){const ws=words.filter(w=>w.bbox&&/\d/.test(w.text)).sort((a,b)=>a.bbox.y0-b.bbox.y0),rows=[];
  for(const w of ws){const hh=(w.bbox.y1-w.bbox.y0)||10,my=(w.bbox.y0+w.bbox.y1)/2;let r=null;
    for(const q of rows){if(Math.abs(q.my-my)<Math.max(hh,q.hh)*.75){r=q;break}}
    if(!r){r={my,hh,ws:[]};rows.push(r)}r.ws.push(w);r.my=(r.my*(r.ws.length-1)+my)/r.ws.length;r.hh=Math.max(r.hh,hh)}
  rows.forEach(r=>r.ws.sort((a,b)=>a.bbox.x0-b.bbox.x0));return rows}
function rowText(r){ // rebuild the line from symbol boxes, so numbers the engine glued together can be split again
  let t="",prev=null,sup=false;const hh=r.hh||40;                                // e.g. "424-5512-2" → "424-5 512-2"
  const put=(b,txt)=>{if(!txt)return;const back=prev!=null&&b.x0<prev-hh*.5;     // box jumping backwards = a new column segment
    if(prev!=null){if(sup)sup=false;else if(back){t+=" ";sup=true}else if(b.x0-prev>hh*.45)t+=" "}
    t+=txt;if(!back)prev=b.x1};
  for(const w of r.ws){const sy=w.symbols;if(sy&&sy.length){for(const s of sy){if(s.bbox)put(s.bbox,s.text)}}else if(w.bbox){put(w.bbox,w.text)}}
  return t}
function rowConf(ws){ // word confidence is 0 for symbol-only words — the real score sits on each symbol
  let s=0,n=0;ws.forEach(w=>(w.symbols||[]).forEach(y=>{if(/\d/.test(y.text||"")&&+y.confidence>0){s+=+y.confidence;n++}}));
  if(!n){const v=ws.filter(w=>/\d/.test(w.text)&&+w.confidence>0);if(!v.length)return null;s=0;v.forEach(w=>s+=+w.confidence);n=v.length}
  return n?s/n:null}
const HEADRE=/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|date|stock|hand|roll|alloc|remain|balance|total|report|thermal)/i;
function headingBands(data){ // lines like "STOCKS ON HAND 118 + 282 = 400 ROLLS" or "OCT. 9, 2026" — never allocations
  const rows=[];wordsOf(data).filter(w=>w.bbox).sort((a,b)=>a.bbox.y0-b.bbox.y0).forEach(w=>{
    const hh=(w.bbox.y1-w.bbox.y0)||10,my=(w.bbox.y0+w.bbox.y1)/2;let r=null;
    for(const q of rows)if(Math.abs(q.my-my)<Math.max(hh,q.hh)*.75){r=q;break}
    if(!r){r={my,hh,y0:w.bbox.y0,y1:w.bbox.y1,t:""};rows.push(r)}
    r.t+=" "+w.text;r.hh=Math.max(r.hh,hh);r.y0=Math.min(r.y0,w.bbox.y0);r.y1=Math.max(r.y1,w.bbox.y1)});
  return rows.filter(r=>HEADRE.test(r.t)).map(r=>({y0:r.y0-r.hh*.6,y1:r.y1+r.hh*.6}))}
function parseRow(text,conf){ // "350 - 5", "DDN-350 5", "350-5 351-5 424-5" → booth entries
  const nums=text.match(/\d+/g)||[];if(nums.length<2)return[];
  const pos=[],re=/\d+/g;let m;while((m=re.exec(text)))pos.push([m.index,m.index+m[0].length]);
  const yi=nums.findIndex(n=>/^(19|20)\d{2}$/.test(n));                                 // a year is never an allocation
  if(yi>=0&&!(yi===0&&nums.length===2&&DASHES.test(text.slice(pos[0][1],pos[1][0]))))return[];
  if(nums.length>2&&nums.every(n=>n.length<=2))return[];                                  // "15-10-26" is a date, not three booths
  const out=[];
  for(let i=0;i+1<pos.length;i+=2){
    const between=text.slice(pos[i][1],pos[i+1][0]),b=nums[i],q=nums[i+1],sep=DASHES.test(between);
    if(b.length<2||b.length>4)continue;                                                  // not a booth number — don't invent one
    if(!sep&&(b.length<3||/^0/.test(b)))continue;                                         // "15 20" / "015 20" is a date, not an allocation
    const n=+q;
    if(q.length>3||n<1)out.push({booth:"DDN-"+b,rolls:"",u:true,c:""});                 // quantity unreadable → left blank for review
    else out.push({booth:"DDN-"+b,rolls:n,u:!sep||n>99||(conf!=null&&conf<68),c:""})}
  return out}
async function readSheet(src,onStep){const say=t=>{if(onStep)onStep(t)};
  say("Preparing the photo…");let c=await toCanvas(src,2200);c=upscale(c,1800);c=contrast(c);
  say("Trimming to the page…");c=autoCrop(c);say("Correcting the angle…");c=deskew(c);
  say("Cleaning the image…");c=blur3(c);c=clean(c);c=despeckle(c);c=unrule(c);
  let who="Reading the handwriting";
  PROG=m=>{const p=Math.round((m.progress||0)*100);if(m.status=="recognizing text")say(who+"… "+p+"%");else if(m.status)say("Starting the free reader… "+p+"%")};
  try{
    say("Reading the handwriting…");
    const data=await ocr(c,{tessedit_char_whitelist:NUMWHITE,tessedit_pageseg_mode:"6"});
    who="Reading the sheet heading";say("Reading the sheet heading…");
    const full=await ocr(c,{tessedit_pageseg_mode:"6"}),lines=[],bands=headingBands(full);
    groupRows(wordsOf(data)).forEach(r=>{
      const my=(r.ws[0].bbox.y0+r.ws[r.ws.length-1].bbox.y1)/2;
      if(bands.some(b=>my>=b.y0&&my<=b.y1))return;                                 // heading, date or stock note — not an allocation
      const conf=rowConf(r.ws);parseRow(rowText(r),conf).forEach(p=>lines.push(p))});
    return{lines,header:parseHeader(String(full.text||"")+" "+String(data.text||"")),canvas:c}
  }finally{PROG=null}}
Object.assign(window.THERMAL_PARSE,{readSheet,contrast,clean,deskew,toCanvas,ocr,extractViaGemini,parseRow,rowText,groupRows,wordsOf,rowConf,unrule,upscale,autoCrop,headingBands,blur3,despeckle,getThermalApiKey,setThermalApiKey});

async function editor(v){
  const E=T.ed,adm=true;let urlP=null;
  if(E.image&&E.image.path&&!E.image.url){const{data}=await sb.storage.from(BUCKET).createSignedUrl(E.image.path,600);E.image.url=data?.signedUrl}
  const O=await all("registry_outlets","booth_code,municipality,sr_name"),reg=new Map(O.map(o=>[o.booth_code,o]));
  const Rr=E.R||await all("thermal_restocks"),restock=()=>Rr.filter(r=>r.restock_date==E.date).reduce((s,r)=>s+r.rolls,0);
  v.innerHTML=`<div class="tbar"><button class="ghost" id="ec">← Cancel</button><b style="font-size:16px">${E.existing?"Edit":"New"} thermal summary</b></div>
  <div class="dgrid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));margin-top:0">
  ${E.image&&E.image.url?`<div class="dc"><h4>Sheet photo <span class="chip">compare while you type</span></h4><div style="max-height:70vh;overflow:auto;border-radius:10px;border:1px solid var(--line);text-align:center"><img id="eimg" src="${E.image.url}" alt="Thermal report" style="max-width:100%;height:auto;display:block;margin:0 auto"></div><div class="chip" id="eop" style="margin-top:8px"></div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="ghost" id="er2">↻ Read with Tesseract (local)</button><button class="ghost" id="er3">✨ Read with Gemini AI</button><span class="chip" id="ekey">${getThermalApiKey() ? 'Gemini API key set' : 'No Gemini API key'}</span></div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><input type="password" id="ekeyinp" placeholder="Google Gemini API key (AIza...)" style="width:220px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--tx)"><button class="ghost" id="esavekey">Save key</button><button class="ghost" id="eclearkey">Clear</button></div><div class="chip" style="margin-top:6px">Tesseract runs locally with no API key. Gemini AI gives better accuracy but requires an API key (stored in your browser only).</div><div class="chip" style="margin-top:6px">Amber rows are uncertain. Always compare with the photo, then fix anything that is wrong before saving.</div></div></div>`:""}
  <div class="dc"><h4>Details</h4><div class="g2"><div><label>Date</label><input type="date" id="ed" value="${E.date}"></div><div><label>Opening stock (rolls)</label><input type="number" id="eop2" min="0" step="1" value="${E.opening}"></div><div><label>New rolls received today (restock)</label><input type="number" id="ers" min="0" step="1" value="${E.restock??""}" placeholder="0"></div><div><label>Total allocated written on sheet (optional)</label><input type="number" id="ew" min="0" step="1" value="${E.written}"></div><div><label>Note (optional)</label><input id="en" value="${esc(E.note)}"></div></div>
  <div class="chip" style="margin-top:6px">${E.prev&&E.prev.from?`Opening stock carried over from ${fd(E.prev.from)}'s remaining balance.`:"First day: type your stocks on hand as the opening stock."}</div>
  <label>Quick list — type or paste booth-rolls pairs (e.g. <i>764-5 1475-5 398-10</i> or one per line)</label><textarea id="eq" rows="3" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--tx);font:inherit" placeholder="764-5, 1475-5, 398-10 …"></textarea><button class="ghost" id="ea" style="margin-top:6px">Add these to the list</button></div></div>
  <div class="dc" style="margin-top:14px"><h4>Lines <span class="chip" id="esum"></span></h4><div class="chip" style="margin-bottom:8px">Amber = uncertain reading · red = duplicate booth · orange = booth not in the Master Registry. Everything is editable — add, fix or remove any row.</div><div class="tw" style="max-height:60vh;overflow:auto"><table><thead><tr><th>#</th><th>Booth code</th><th>Rolls</th><th>Teller</th><th>Check</th><th></th></tr></thead><tbody id="elb"></tbody></table></div><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="ghost" id="er">+ Add row</button></div><div class="msg" id="em" style="color:#ff8b9b"></div><div style="display:flex;gap:8px;margin-top:6px"><button class="btn" id="es" style="width:auto;padding:10px 24px;margin:0">Save summary</button><button class="ghost" id="ec2">Cancel</button></div></div>`;
  const body=$("#elb"),cnt=()=>{const c={};E.lines.forEach(l=>{const b=normBooth(l.booth);if(b)c[b]=(c[b]||0)+1});return c};
  const flags=l=>{const b=normBooth(l.booth),f=[];if(!b)return"";if(l.rolls===""||l.rolls==null)f.push('<span class="pill" style="background:#eab308;color:#111">no quantity yet</span>');else if(l.u)f.push('<span class="pill" style="background:#eab308;color:#111">check digits</span>');if(!reg.has(b))f.push('<span class="pill" style="background:#f59e0b">not in registry</span>');if(cnt()[b]>1)f.push('<span class="pill" style="background:#ef4444">duplicate</span>');return f.join(" ")};
  const others=()=>Rr.filter(r=>r.restock_date==E.date&&r.note!==SHEET).reduce((s,r)=>s+r.rolls,0),restockNow=()=>others()+n0($("#ers")?$("#ers").value:E.restock);
  const sum=()=>{const tot=E.lines.reduce((s,l)=>s+n0(l.rolls),0),op=n0($("#eop2").value),w=$("#ew").value===""?null:n0($("#ew").value),oh=op+restockNow(),rem=oh-tot;
    $("#esum").innerHTML=`${E.lines.length} lines · <b>${tot}</b> rolls given · on hand <b>${oh}</b> · remaining <b${rem<0?' style="color:#ef4444"':""}>${rem}</b>${w!=null&&w!=tot?` · <span style="color:#f59e0b">⚠ sheet says ${w} (difference ${tot-w})</span>`:w!=null?' · <span style="color:#22c55e">✔ matches the sheet</span>':""}`;
    body.querySelectorAll("tr").forEach((tr,i)=>{const l=E.lines[i];tr.querySelector(".fl").innerHTML=flags(l);tr.querySelector(".tn").textContent=reg.get(normBooth(l.booth))?.sr_name||""})};
  const rows=(focus)=>{body.innerHTML=E.lines.map((l,i)=>`<tr${l.u||l.rolls===""?' style="background:rgba(234,179,8,.14)"':""}><td>${i+1}${l.c?` <span class="chip">${l.c}</span>`:""}</td><td><input class="bi" data-i="${i}" value="${esc(l.booth)}" style="min-width:110px"></td><td><input class="ri" data-i="${i}" type="number" min="0" step="1" inputmode="numeric" value="${l.rolls??""}" style="width:90px"></td><td class="tn" style="color:var(--mu)"></td><td class="fl"></td><td><button class="ghost" data-x="${i}">✕</button></td></tr>`).join("");
    body.querySelectorAll(".bi").forEach(e=>{e.oninput=()=>{E.lines[+e.dataset.i].booth=e.value;E.lines[+e.dataset.i].u=false;E.lines[+e.dataset.i].a=false;sum()};e.onblur=()=>{const n=normBooth(e.value);if(n&&n!=e.value){e.value=n;E.lines[+e.dataset.i].booth=n;sum()}};e.onkeydown=k=>{if(k.key=="Enter"){k.preventDefault();body.querySelector(`.ri[data-i="${e.dataset.i}"]`).focus()}}});
    body.querySelectorAll(".ri").forEach(e=>{e.oninput=()=>{E.lines[+e.dataset.i].rolls=e.value;E.lines[+e.dataset.i].u=false;E.lines[+e.dataset.i].a=false;sum()};e.onkeydown=k=>{if(k.key=="Enter"){k.preventDefault();const i=+e.dataset.i;if(i==E.lines.length-1){E.lines.push({booth:"",rolls:""});rows(i+1)}else body.querySelector(`.bi[data-i="${i+1}"]`).focus()}}});
    body.querySelectorAll("[data-x]").forEach(b=>b.onclick=()=>{E.lines.splice(+b.dataset.x,1);rows()});sum();if(focus!=null){const f=body.querySelector(`.bi[data-i="${focus}"]`);f&&f.focus()}};
  rows();
  ["ed","eop2","ers","ew","en"].forEach(id=>$("#"+id).oninput=()=>{E.date=$("#ed").value;E.opening=$("#eop2").value;E.restock=$("#ers").value;E.written=$("#ew").value;E.note=$("#en").value;sum()});
  $("#ed").onchange=async()=>{E.date=$("#ed").value;if(!E.existing){const days=E.days||(await sb.from("thermal_summary").select("*").range(0,999)).data||[];E.days=days;const p=defaults(days,Rr,E.date);E.prev=p;E.opening=p.opening;editor(v)}else sum()};
  $("#er").onclick=()=>{E.lines.push({booth:"",rolls:""});rows(E.lines.length-1)};
  $("#ea").onclick=()=>{const p=parseLines($("#eq").value);if(!p.length){$("#em").textContent="I couldn't find any booth-rolls pairs like 764-5 in that text.";return}$("#em").textContent="";p.forEach(x=>E.lines.push({booth:x.booth,rolls:x.rolls}));$("#eq").value="";rows()};
  const cancel=()=>{if(E.image&&E.image.url&&E.image.file)URL.revokeObjectURL(E.image.url);T.ed=null;go(cur)};$("#ec").onclick=cancel;$("#ec2").onclick=cancel;
  const say=(t,err)=>{const pr=$("#eop");if(!pr)return;pr.style.color=err?"#ff8b9b":"var(--gold)";pr.textContent=t};
  async function autoRead(method='tesseract'){ // runs by itself right after a photo is dropped, pasted or chosen
    const pr=$("#eop");if(!E.image||!pr||pr.dataset.busy)return;pr.dataset.busy="1";
    const rb1=$("#er2"), rb2=$("#er3");if(rb1)rb1.disabled=true;if(rb2)rb2.disabled=true;
    try{
      let r;
      if(method === 'gemini') {
        r = await extractViaGemini(E.image, say);
      } else {
        r = await readSheet(E.image, say);
      }
      const head=r.header||{};
      if(!E.existing&&head.date){E.date=head.date;$("#ed").value=head.date}
      // "400 rolls on hand" is the day's opening stock; the sheet's "118 + 282 = 400" line means
      // allocated + remaining = on hand, so it must not be read as opening + restock.
      const oh=head.onhand!=null?head.onhand:(head.opening!=null?head.opening:null);
      if(oh!=null&&!(+E.opening>0)&&!(E.prev&&E.prev.from)){E.opening=oh;$("#eop2").value=oh}
      if(head.written!=null&&(E.written==null||E.written==="")){E.written=head.written;$("#ew").value=head.written}
      const found=r.lines||[];
      if(!found.length){say("I couldn't find booth lines in this photo. The photo is safe above — type the pairs in the quick list box (e.g. 350-5) or add rows one by one, then check them against the photo.",true);return}
      if(E.lines.length&&found.length&&!confirm("Replace the "+E.lines.length+" lines already in the list with the "+found.length+" lines read from the photo? (Cancel adds them underneath instead.)"))E.lines.push(...found);
      else E.lines=found;
      rows();
      const un=found.filter(l=>l.u).length,miss=found.filter(l=>l.rolls===""||l.rolls==null).length;
      say("Read "+found.length+" rows"+(un?" · "+un+" flagged to check":"")+(miss?" · "+miss+" still need a quantity":"")+". Compare every row with the photo before saving."+(head.written!=null?" Sheet total: "+head.written+".":""))
    }catch(e){say("Extraction failed: "+e.message+". The photo and everything you typed are safe. Use the quick list box or add rows by hand.",true)}
    finally{const b1=$("#er2"), b2=$("#er3");if(b1)b1.disabled=false;if(b2)b2.disabled=false;pr.dataset.busy=""}
  }
  if(E.image&&!E.read){E.read=true;const pr=$("#eop");if(pr){pr.style.color="var(--gold)";pr.textContent='Photo loaded. Click "Read with Gemini AI" to extract.';}}
  if($("#er3"))$("#er3").onclick=()=>{
    const key = getThermalApiKey();
    if(!key){
      const pr=$("#eop");
      if(pr){ pr.style.color="#ff8b9b"; pr.textContent="Please add a Gemini API key first."; }
      return;
    }
    autoRead('gemini');
  };
  if($("#esavekey"))$("#esavekey").onclick=()=>{
    const inp=$("#ekeyinp");
    const ek=$("#ekey");
    if(inp&&inp.value.trim()){ setThermalApiKey(inp.value.trim()); if(ek) ek.textContent="Gemini API key set"; inp.value='';
      const pr=$("#eop"); if(pr){ pr.style.color="var(--gold)"; pr.textContent="API key saved."; }
    }
  };
  if($("#eclearkey"))$("#eclearkey").onclick=()=>{
    setThermalApiKey(null);
    const ek=$("#ekey");
    if(ek) ek.textContent="No Gemini API key";
    const pr=$("#eop"); if(pr){ pr.style.color="var(--gold)"; pr.textContent="API key cleared."; }
  };
  if($("#ekeyinp")){
    $("#ekeyinp").addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); if($("#esavekey")) $("#esavekey").click(); }});
  }
  $("#es").onclick=async()=>{const m=$("#em");m.textContent="";if(!E.date)return m.textContent="Choose the date.";const clean=E.lines.map(l=>({booth_code:normBooth(l.booth),rolls:l.rolls})).filter(l=>l.booth_code||String(l.rolls)!=="");
    for(const l of clean){if(!l.booth_code)return m.textContent="A row is missing its booth code.";if(!(Number.isInteger(+l.rolls)&&+l.rolls>=0&&String(l.rolls)!==""))return m.textContent="Check the rolls for "+l.booth_code+" (whole number).";l.rolls=+l.rolls}
    if(E.opening===""||!(+E.opening>=0))return m.textContent="Enter the opening stock.";const b=$("#es");b.disabled=true;T.busy=true;
    try{let path=E.image&&E.image.path?E.image.path:null;
      if(E.image&&E.image.file){m.style.color="var(--gold)";m.textContent="Uploading photo…";const c=await toCanvas(E.image,2000),blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.85));path=`${E.date}/${Date.now()}.jpg`;const up=await sb.storage.from(BUCKET).upload(path,blob,{contentType:"image/jpeg"});if(up.error)throw up.error}
      const r=await sb.rpc("save_thermal_day",{p_date:E.date,p_opening:+E.opening,p_written:E.written===""?null:+E.written,p_image:path,p_note:E.note.trim()||null,p_lines:clean});if(r.error)throw r.error;
      const rs0=n0(E.restock),sheetRow=Rr.find(r=>r.restock_date==E.date&&r.note===SHEET);
      if(rs0>0){const q=sheetRow?sb.from("thermal_restocks").update({rolls:rs0}).eq("id",sheetRow.id):sb.from("thermal_restocks").insert({restock_date:E.date,rolls:rs0,note:SHEET,created_by:me.id});const rr=await q;if(rr.error)throw rr.error}
      else if(sheetRow){const rr=await sb.from("thermal_restocks").delete().eq("id",sheetRow.id);if(rr.error)throw rr.error}
      T.date=E.date;T.ed=null;T.busy=false;go(cur)}catch(e){T.busy=false;b.disabled=false;      m.style.color="#ff8b9b";m.textContent="Could not save: "+(e?.message||String(e))}}}

window.MODS=Object.assign(window.MODS||{},{[NAME]:thermal});
})();
