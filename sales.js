(()=>{
const esc=window.esc||(s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])));
const SV={DDN:["PETER JOHN CARRILLO"],SAMAL:["PETER JOHN CARRILLO"]};
const CC={
  JOHN:    ["FFFF0000","FFBF0000"],
  JAYSON:  ["FFE97132","FFE97132"],
  MUHLEN:  ["FF3399FF","FF02A5E3"],
  JASON:   ["FF92D050","FF92D04F"],
  "MAC²":  ["FFFFFF00","FFFFC000"],
  NELSON:  ["FFFFFF00","FFFF0000"],
  CHARLIE: ["FFFFFF00","FF215F9A"]
},PAL=[["FFFFC000","FFFFC000"],["FF00B0F0","FF00B0F0"],["FF7030A0","FF7030A0"],["FFFF66CC","FFFF66CC"]],ccol=(n,i)=>CC[n]||PAL[i%PAL.length];
const ORDER_MAP={DDN:["JOHN","JAYSON","MUHLEN","JASON","MAC²"],SAMAL:["NELSON","CHARLIE"]};
const sortCollectors=(list,area)=>{const order=ORDER_MAP[area]||[];return[...list].sort((a,b)=>{const ia=order.indexOf(a),ib=order.indexOf(b);if(ia!==-1&&ib!==-1)return ia-ib;if(ia!==-1)return -1;if(ib!==-1)return 1;return a.localeCompare(b)})};
let OFF=false;
const LABEL={DDN:"DAVAO DEL NORTE",SAMAL:"SAMAL"};
const areaOf=m=>m=="SAMAL"?"SAMAL":"DDN";
const salary=b=>!(b>=100)||b>=61000?0:b<5000?250:300+10*(Math.floor(b/1000)-5);
const MON=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"],MONL=["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];
const MUNI=window.MUNI;
const dp=s=>{const[y,m,d]=s.split("-").map(Number);return{y,m,d}};
const ser=s=>{const{y,m,d}=dp(s);return Date.UTC(y,m-1,d)/86400000+25569};
const dmy=s=>{const{y,m,d}=dp(s);return d+"-"+MON[m-1][0]+MON[m-1].slice(1).toLowerCase()+"-"+String(y).slice(2)};
const longD=s=>{const{y,m,d}=dp(s);return MONL[m-1]+" "+d+", "+y};
const peso=n=>"₱"+Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const r2=n=>parseFloat(Number(n).toFixed(2));
const num=v=>typeof v=="number"?v:parseFloat(String(v??"").replace(/[₱,\s]/g,""))||0;
const bcode=v=>{const s=String(v??"").trim();return s?s.toUpperCase().replace(/\s+/g,"-"):null};
const nat=(a,b)=>(parseInt(a.code.replace(/\D/g,""))||0)-(parseInt(b.code.replace(/\D/g,""))||0);

function parseAccounting(X,buf){
  const wb=X.read(buf,{type:"array"}),rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:null,raw:true});
  const h=rows.findIndex(r=>r.some(c=>/^outlet name$/i.test(String(c||"").trim())));if(h<0)throw new Error("header");
  const ix=re=>rows[h].findIndex(c=>re.test(String(c||"").trim()));
  const C={d:ix(/^draw date$/i),o:ix(/^outlet name$/i),t:ix(/^teller$/i),g:ix(/^gross$/i),n:ix(/^net$/i),c:ix(/less commission/i),p:ix(/less payments?/i),k:ix(/coll/i)};
  const seen=new Map(),dups=[],dates={};
  const iso=v=>{if(v==null)return null;if(typeof v=="number"){const p=X.SSF.parse_date_code(v);return p?`${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`:null}
    const m=String(v).match(/(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];const d=new Date(v);return isNaN(d)?null:d.toISOString().slice(0,10)};
  for(const r of rows.slice(h+1)){
    const code=bcode(r[C.o]);if(!code||!/\d/.test(code)||/:$/.test(code))continue;if(typeof r[C.g]!="number"&&!/\d/.test(String(r[C.g]??"")))continue;
    if(seen.has(code)){dups.push(code);continue}
    const d=iso(r[C.d]);if(d)dates[d]=(dates[d]||0)+1;
    seen.set(code,{code,teller:String(r[C.t]??code).trim(),drawDate:d,gross:num(r[C.g]),net:num(r[C.n]),lessComm:num(r[C.c]),lessPay:num(r[C.p]),coll:num(r[C.k])})}
  const ds=Object.entries(dates).sort((a,b)=>b[1]-a[1]);
  return{rows:[...seen.values()],dups,date:ds[0]?.[0]||null,mixed:ds.length>1}}

function addr(o){return o.address||[o.purok,o.barangay].filter(Boolean).join(", ")}
function compute(O,rows){
  const eod=new Map(rows.map(r=>[r.code,r])),have=new Set(O.map(o=>o.booth_code));
  const A={DDN:{outlets:[]},SAMAL:{outlets:[]}};
  for(const o of O){const r=eod.get(o.booth_code);
    const bets=r?r.gross:0,pay=r?r.lessPay:0,comm=bets*0.125;
    A[areaOf(o.municipality)].outlets.push({code:o.booth_code,teller:o.sr_name||"",address:addr(o),collector:o.collector||"",off:o.status!="ACTIVE"||!o.sr_name,bets,pay,comm,pal:bets-pay-comm,sal:salary(bets)})}
  for(const k in A){const a=A[k];a.outlets.sort(nat);
    const rawCols=[...new Set(a.outlets.map(o=>o.collector).filter(Boolean))];
    a.collectors=sortCollectors(rawCols,k);
    const bets=a.outlets.reduce((s,o)=>s+o.bets,0),pay=a.outlets.reduce((s,o)=>s+o.pay,0),comm=bets*0.125;
    a.totals={bets,pay,comm,pal:bets-pay-comm,gross:bets-pay,sal:a.outlets.reduce((s,o)=>s+o.sal,0)+500*a.collectors.length};
    a.noCollector=a.outlets.filter(o=>!o.collector).length}
  return{areas:A,unmatched:rows.filter(r=>!have.has(r.code))}}

const padL=(s,l=17)=>s.padEnd(l," ");
const msgText=(d,t)=>`Good day po\nFor your review\n${dmy(d)}\n\n${padL("Total Bets:")}${peso(t.bets)}\n${padL("Payouts:")}${peso(t.pay)}\n${padL("Commission:")}${peso(t.comm)}\n${padL("Palawan:")}${peso(t.pal)}\n${padL("Gross:")}${peso(t.gross)}\n${padL("Salary:")}${peso(t.sal)}`;

// ---------------- Excel ----------------
const PESO='_-"₱"* #,##0.00_-;\\-"₱"* #,##0.00_-;_-"₱"* "-"??_-;_-@_-';
const FN=(sz,b,c)=>({name:"Arial",size:sz,bold:!!b,...(c?{color:{argb:c}}:{})}),TH={style:"thin"},BR={top:TH,left:TH,bottom:TH,right:TH};
const fillc=a=>({type:"pattern",pattern:"solid",fgColor:{argb:a}});
function put(ws,a,v,o={}){const c=ws.getCell(a);c.value=o.fx!==undefined?{formula:o.fx,result:o.res}:v;c.font=o.font||FN(11);if(OFF&&!o.nb)c.font={...c.font,color:{argb:"FFFF0000"}};if(o.fmt)c.numFmt=o.fmt;if(o.fill)c.fill=fillc(o.fill);c.alignment={horizontal:o.al||undefined,vertical:"middle"};if(!o.nb)c.border=BR;return c}
function widths(ws,w){Object.entries(w).forEach(([k,v])=>ws.getColumn(k).width=v)}

function sheet1(wb,snap,area,eod,L){
  const A=snap.areas[area],ws=wb.addWorksheet("Sheet1"),n=A.outlets.length,k=A.collectors.length,sam=area=="SAMAL";
  const first=3,last=2+n,cf=last+1,cl=last+k,tot=cl+1,cm=tot+1,gr=tot+2,t1=tot+8,t2=t1+56,rowOf={};
  put(ws,"C1","DATE",{font:FN(24,1),fill:"FFB4E5A2",al:"center"});put(ws,"D1","DATE",{font:FN(24,1),fill:"FFB4E5A2",al:"center"});ws.getRow(1).height=30;ws.getRow(2).height=20.25;
  put(ws,"E1",new Date(snap.date+"T00:00:00Z"),{font:FN(24,1),fmt:"d-mmm-yy",fill:"FFA5C9EC",al:"center"});
  ws.mergeCells("F1:J1");put(ws,"F1",LABEL[area],{font:FN(22,1),fill:"FFFFFF00",al:"center"});
  ["NO.","BOOTH CODE","ADDRESS","OUTLETS","TELLER","TOTAL BETS",sam?"PAY OUT":"PAYOUTS","COMMISSION","PALAWAN","SALARY"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"2",h,{font:FN(i<5?14:16,1),al:"center"}));
  const rng=c=>`'${eod}'!$B$2:$G$1500,${c},FALSE`;
  A.outlets.forEach((o,i)=>{const r=first+i;rowOf[o.code]=r;OFF=!!o.off;ws.getRow(r).height=18;
    put(ws,"A"+r,i+1,{font:FN(12,1),al:"center"});put(ws,"B"+r,o.code,{font:FN(11,1),al:"center"});put(ws,"C"+r,o.address,{font:FN(12,1),al:"left"});
    put(ws,"D"+r,0,{fx:`B${r}&" "&C${r}`,res:o.code+" "+o.address,font:FN(11),al:"left"});put(ws,"E"+r,o.teller,{font:FN(14)});
    put(ws,"F"+r,0,{fx:`IFERROR(VLOOKUP($B${r},${rng(3)}),0)`,res:o.bets,font:FN(11,1),fmt:"#,##0.00"});
    put(ws,"G"+r,0,{fx:`IFERROR(VLOOKUP($B${r},${rng(6)}),0)`,res:o.pay,font:FN(14),fmt:PESO});
    put(ws,"H"+r,0,{fx:`F${r}*0.125`,res:o.comm,font:FN(14),fmt:PESO});put(ws,"I"+r,0,{fx:`F${r}-G${r}-H${r}`,res:o.pal,font:FN(14),fmt:PESO});
    put(ws,"J"+r,0,{fx:`IF(F${r}<100,0,IF(F${r}>=61000,0,LOOKUP(F${r},$H$${t1}:$H$${t2},$J$${t1}:$J$${t2})))`,res:o.sal,font:FN(14),fmt:PESO})});OFF=false;
  A.collectors.forEach((c,i)=>{const r=cf+i;put(ws,"D"+r,"COLLECTOR",{font:FN(14),al:"left"});put(ws,"E"+r,c,{font:FN(14)});put(ws,"J"+r,500,{font:FN(14),fmt:PESO})});
  const T=A.totals,sumc=(c,e,res)=>put(ws,c+tot,0,{fx:`SUM(${c}${first}:${c}${e})`,res,font:FN(14,1),fmt:PESO});
  put(ws,"C"+tot,"TOTAL",{font:FN(14,1),al:"left"});put(ws,"D"+tot,"TOTAL",{font:FN(14,1),al:"left"});
  sumc("F",last,T.bets);sumc("G",last,T.pay);sumc("H",last,T.comm);sumc("I",last,T.pal);sumc("J",cl,T.sal);
  put(ws,"H"+cm,"COMMISSION",{font:FN(14,1)});put(ws,"I"+cm,0,{fx:`H${tot}`,res:T.comm,font:FN(14,1),fmt:PESO});
  put(ws,"H"+gr,"TOTAL GROSS",{font:FN(14,1)});put(ws,"I"+gr,0,{fx:`SUM(I${tot},I${cm})`,res:T.gross,font:FN(14,1),fmt:PESO});
  const pb=tot+4;const CM={name:"Cutive Mono",size:11,color:{argb:"FF02A5E3"}};put(ws,"C"+pb,"PREPARED BY: ",{font:CM,al:"left",nb:1});put(ws,"C"+(pb+1),"SV: "+SV[area][0],{font:{...CM,size:18,bold:true,italic:true},al:"center",nb:1});
  put(ws,"H"+(t1-1),"SALARY TABLE",{font:FN(12,1)});put(ws,"I"+(t1-1),"(daily gross sales)",{font:FN(10)});put(ws,"J"+(t1-1),"SALARY",{font:FN(12,1)});
  for(let i=0;i<=56;i++){const r=t1+i,lo=i==0?100:5000+(i-1)*1000;put(ws,"H"+r,lo,{font:FN(11),fmt:"#,##0"});put(ws,"I"+r,i==0?4999:lo+999,{font:FN(11),fmt:"#,##0"});
    put(ws,"J"+r,i<2?(i?300:250):0,i<2?{font:FN(11),fmt:'"₱"#,##0'}:{fx:`J${r-1}+10`,res:300+10*(i-1),font:FN(11),fmt:'"₱"#,##0'})}
  widths(ws, sam?{A:5.63,B:19.63,C:69.63,D:24.13,E:38.25,F:19.75,G:19.75,H:19.75,I:19.75,J:19.75}:{A:5.13,B:19.38,C:68.5,D:63.25,E:48.5,F:27,G:22.63,H:27,I:25.63,J:22.38});
  ws.getColumn(4).hidden=true;
  for(let r=t1-1;r<=t2;r++)ws.getRow(r).hidden=true;
  return{ws,rowOf,tot,cm,gr}}

function areaSheetNarrow(wb,snap,area,col,S1,idx){
  const A=snap.areas[area],os=A.outlets.filter(o=>o.collector==col),ws=wb.addWorksheet((col+" NEW AREA").replace(/[:\\/?*\[\]]/g," ").slice(0,31),{properties:{tabColor:{argb:ccol(col,idx)[1]}}});
  ws.getRow(1).height=35.45;ws.getRow(2).height=22.5;
  put(ws,"A1","DATE",{font:FN(18,1),fill:"FFCC99FF",al:"center"});put(ws,"B1",0,{fx:"Sheet1!E1",res:ser(snap.date),fmt:"d-mmm-yy",font:FN(18,1),fill:"FF99CCFF",al:"center"});
  ws.mergeCells("C1:G1");put(ws,"C1",col,{font:FN(18,1,"FF36363D"),fill:ccol(col,idx)[0],al:"center"});
  ["OUTLETS","TELLER","TOTAL BETS","PAYOUTS","COMMISSION","PALAWAN","SALARY"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"2",h,{font:FN(12,1),al:"center"}));
  os.forEach((o,i)=>{const r=3+i,s=S1.rowOf[o.code];OFF=!!o.off;ws.getRow(r).height=18;
    put(ws,"A"+r,0,{fx:`Sheet1!D${s}`,res:o.code+" "+o.address,font:FN(11)});put(ws,"B"+r,0,{fx:`Sheet1!E${s}`,res:o.teller,font:FN(11)});
    put(ws,"C"+r,0,{fx:`Sheet1!F${s}`,res:o.bets,font:FN(14),fmt:PESO,al:"center"});put(ws,"D"+r,0,{fx:`Sheet1!G${s}`,res:o.pay,font:FN(14),fmt:PESO});
    put(ws,"E"+r,0,{fx:`C${r}*0.125`,res:o.comm,font:FN(14),fmt:PESO});put(ws,"F"+r,0,{fx:`C${r}-D${r}-E${r}`,res:o.pal,font:FN(14),fmt:PESO});put(ws,"G"+r,0,{fx:`Sheet1!J${s}`,res:o.sal,font:FN(14),fmt:PESO})});OFF=false;
  const e=2+os.length,c=e+1,t=e+2,sum=(o,f)=>os.reduce((s,x)=>s+x[f],0),bets=sum(0,"bets"),pay=sum(0,"pay"),comm=bets*0.125;
  put(ws,"A"+c,"COLLECTOR",{font:FN(11,1)});put(ws,"B"+c,col,{font:FN(11,1)});put(ws,"G"+c,500,{font:FN(14),fmt:PESO});
  put(ws,"A"+t,"TOTAL",{font:FN(11,1)});
  [["C",bets],["D",pay],["E",comm],["F",bets-pay-comm]].forEach(([k,v])=>put(ws,k+t,0,{fx:`SUM(${k}3:${k}${e})`,res:v,font:FN(14,1),fmt:PESO}));put(ws,"G"+t,0,{fx:`SUM(G3:G${c})`,res:sum(0,"sal")+500,font:FN(14,1),fmt:PESO});
  put(ws,"E"+(t+1),"COMMISSION",{font:FN(11,1)});put(ws,"F"+(t+1),0,{fx:`E${t}`,res:comm,font:FN(14,1),fmt:PESO});
  put(ws,"E"+(t+2),"TOTAL GROSS",{font:FN(11,1)});put(ws,"F"+(t+2),0,{fx:`SUM(F${t},F${t+1})`,res:bets-pay,font:FN(14,1),fmt:PESO});
  widths(ws,{A:69.63,B:40.63,C:25,D:23.5,E:24.63,F:25.13,G:23.38})}

function areaSheetWide(wb,snap,area,col,S1,idx){
  const A=snap.areas[area],os=A.outlets.filter(o=>o.collector==col),ws=wb.addWorksheet((col+" AREA").replace(/[:\\/?*\[\]]/g," ").slice(0,31),{properties:{tabColor:{argb:ccol(col,idx)[1]}}});
  put(ws,"C1","DATE",{font:FN(24,1),fill:"FFB4E5A2",al:"center"});put(ws,"D1","DATE",{font:FN(24,1),fill:"FFB4E5A2",al:"center"});ws.getRow(1).height=30;put(ws,"E1",0,{fx:"Sheet1!E1",res:ser(snap.date),font:FN(24,1),fmt:"d-mmm-yy",fill:"FFA5C9EC",al:"center"});
  ws.mergeCells("F1:J1");put(ws,"F1",col,{font:FN(22,1),fill:"FFFFFF00",al:"center"});
  ["NO.","BOOTH CODE","ADDRESS","OUTLETS","TELLER","TOTAL BETS","PAY OUT","COMMISSION","PALAWAN","SALARY"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"2",h,{font:FN(14,1),al:"center"}));
  os.forEach((o,i)=>{const r=3+i,s=S1.rowOf[o.code];OFF=!!o.off;ws.getRow(r).height=18;put(ws,"A"+r,i+1,{font:FN(12,1),al:"center"});put(ws,"B"+r,o.code,{});put(ws,"C"+r,o.address,{});put(ws,"D"+r,0,{fx:`B${r}&" "&C${r}`,res:o.code+" "+o.address});put(ws,"E"+r,o.teller,{});
    put(ws,"F"+r,0,{fx:`Sheet1!F${s}`,res:o.bets,fmt:"#,##0.00",font:FN(11,1)});put(ws,"G"+r,0,{fx:`Sheet1!G${s}`,res:o.pay,font:FN(14),fmt:PESO});put(ws,"H"+r,0,{fx:`F${r}*0.125`,res:o.comm,font:FN(14),fmt:PESO});
    put(ws,"I"+r,0,{fx:`F${r}-G${r}-H${r}`,res:o.pal,font:FN(14),fmt:PESO});put(ws,"J"+r,0,{fx:`Sheet1!J${s}`,res:o.sal,font:FN(14),fmt:PESO})});OFF=false;
  const e=2+os.length,c=e+1,t=e+2,sum=f=>os.reduce((s,x)=>s+x[f],0),bets=sum("bets"),pay=sum("pay"),comm=bets*0.125;
  put(ws,"D"+c,"COLLECTOR",{font:FN(14)});put(ws,"E"+c,col,{font:FN(14)});put(ws,"J"+c,500,{font:FN(14),fmt:PESO});put(ws,"C"+t,"TOTAL",{font:FN(14,1)});put(ws,"D"+t,"TOTAL",{font:FN(14,1)});
  [["F",bets],["G",pay],["H",comm],["I",bets-pay-comm]].forEach(([k,v])=>put(ws,k+t,0,{fx:`SUM(${k}3:${k}${e})`,res:v,font:FN(14,1),fmt:PESO}));put(ws,"J"+t,0,{fx:`SUM(J3:J${c})`,res:sum("sal")+500,font:FN(14,1),fmt:PESO});
  put(ws,"H"+(t+1),"COMMISSION",{font:FN(14,1)});put(ws,"I"+(t+1),0,{fx:`H${t}`,res:comm,font:FN(14,1),fmt:PESO});put(ws,"H"+(t+2),"TOTAL GROSS",{font:FN(14,1)});put(ws,"I"+(t+2),0,{fx:`SUM(I${t},I${t+1})`,res:bets-pay,font:FN(14,1),fmt:PESO});
  widths(ws,{A:5.63,B:19.63,C:69.63,D:24.13,E:38.25,F:19.75,G:19.75,H:19.75,I:19.75,J:19.75});
  ws.getColumn(4).hidden=true}

function eodSheet(wb,snap,area,S1,eod){
  const ws=wb.addWorksheet(eod),rows=snap.rows,L=rows.length+1,T=snap.areas[area].totals,O=snap.areas[area=="DDN"?"SAMAL":"DDN"].totals;
  ["Draw Date","Outlet Name","Teller","Gross","Net","Less Commission","Less Payments","Coll/Tapada"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"1",h,{font:{name:"Calibri",size:11,bold:true},al:"center",nb:1}));
  rows.forEach((r,i)=>{const n=i+2;[r.drawDate||snap.date,r.code,r.teller,r.gross,r.net,r.lessComm,r.lessPay,r.coll].forEach((v,j)=>put(ws,String.fromCharCode(65+j)+n,v,{font:{name:"Calibri",size:11},al:"center",nb:1}))});
  const cal={name:"Calibri",size:11},block=(r0,vals)=>{put(ws,"B"+r0,"Good day po",{font:cal,nb:1});put(ws,"B"+(r0+1),"For your review",{font:cal,nb:1});
    if(vals.dateFx)put(ws,"B"+(r0+3),0,{fx:"Sheet1!E1",res:ser(snap.date),fmt:"d-mmm-yy",font:cal,al:"left",nb:1});else put(ws,"B"+(r0+3),new Date(snap.date+"T00:00:00Z"),{fmt:"d-mmm-yy",font:cal,al:"left",nb:1});
    ["Total Bets:","Payouts:","Commission:","Palawan:","Gross:","Salary:"].forEach((l,i)=>{const r=r0+5+i;put(ws,"B"+r,l,{font:cal,nb:1});
      put(ws,"D"+r,vals.v[i],vals.f?{fx:vals.f[i],res:vals.r[i],fmt:PESO,font:cal,al:"right",nb:1}:{fmt:PESO,font:cal,al:"right",nb:1})})};
  const vals=t=>[t.bets,t.pay,t.comm,t.pal,t.gross,t.sal],s1=(c,r)=>`Sheet1!${c}${r}`;
  const mine={dateFx:1,v:vals(T),r:vals(T),f:[s1("F",S1.tot),s1("G",S1.tot),s1("H",S1.tot),s1("I",S1.tot),s1("I",S1.gr),s1("J",S1.tot)]};
  if(area=="DDN"){block(L+7,mine);
    ["Total Bets:","Payouts:","Commission:","Palawan:","Gross:","Salary:"].forEach((l,i)=>{put(ws,"F"+(L+18+i),l,{font:cal,nb:1});put(ws,"G"+(L+18+i),0,{fx:`D${L+12+i}+D${L+26+i}`,res:vals(T)[i]+r2(vals(O)[i]),fmt:PESO,font:cal,nb:1})});
    block(L+21,{v:vals(O).map(r2)})}
  else{["D","E","F","G","H"].forEach((c,i)=>{const s=snap.rows.reduce((a,r)=>a+[r.gross,r.net,r.lessComm,r.lessPay,r.coll][i],0);put(ws,c+(L+7),0,{fx:`SUM(${c}2:${c}${L+6})`,res:s,font:cal,nb:1})});block(L+24,mine)}
  widths(ws,{A:13.1,B:14.2,C:11.1,D:14,E:11.7,F:18.4,G:16.4,H:12.2})}

function lowSheet(wb,snap,eod,threshold,L){
  const ws=wb.addWorksheet("Low Sales"),low=snap.rows.filter(r=>r.gross<threshold),areaOfCode={};
  for(const k of ["DDN","SAMAL"])snap.areas[k].outlets.forEach(o=>areaOfCode[o.code]=k);
  const W=c=>({font:{name:"Arial",size:10,bold:true,color:{argb:"FFFFFFFF"}}});
  ws.mergeCells("A1:B1");ws.getRow(1).height=27.75;ws.getRow(3).height=18;ws.getRow(4).height=18;
  put(ws,"A1","LOW SALES REPORT — EOD",{font:FN(13,1,"FFFFFFFF"),fill:"FFC00000",al:"center"});put(ws,"B1","",{fill:"FFC00000"});
  put(ws,"C1",0,{fx:"Sheet1!E1",res:ser(snap.date),fmt:"mmmm dd, yyyy",font:FN(16,1,"FFFFFFFF"),fill:"FFC00000",al:"center"});put(ws,"D1","",{fill:"FFC00000"});
  put(ws,"A2","Low Sales Threshold (₱):",{font:FN(10,1,"FFFFFFFF"),fill:"FFFF6600",al:"center"});put(ws,"B2",threshold,{font:FN(11,1,"FF8B0000"),fill:"FFFFF2CC",fmt:"#,##0",al:"center"});
  put(ws,"C2","Threshold used when this file was created",{font:{name:"Arial",size:9,italic:true,color:{argb:"FF666666"}},al:"left",nb:1});
  ws.mergeCells("A3:D3");put(ws,"A3","Outlets in the accounting file with gross sales below the threshold (DDN and Samal).",{font:{name:"Arial",size:9,italic:true,color:{argb:"FFFFFFFF"}},fill:"FFAA0000",al:"center"});
  ["Outlet Name","Gross","Status","Area"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"4",h,{...W(),fill:"FF8B0000",al:"center"}));
  const base={font:FN(10),al:"center"};
  low.forEach((r,i)=>{const n=5+i,f=i%2?"FFFFFFFF":"FFFFE0E0",st=r.gross<1000?"🔴 Critical":r.gross<2000?"🟠 Very Low":"🟡 Low";
    put(ws,"A"+n,r.code,{...base,fill:f});put(ws,"B"+n,r.gross,{...base,fill:f,fmt:"#,##0"});put(ws,"C"+n,0,{...base,fill:f,fx:`IF(B${n}="","",IF(B${n}<1000,"🔴 Critical",IF(B${n}<2000,"🟠 Very Low","🟡 Low")))`,res:st});put(ws,"D"+n,areaOfCode[r.code]||"—",{...base,fill:f})});
  const e=5+low.length,rg=`'${eod}'!$D$2:$D$${L}`,tb={font:FN(10,1),al:"center",fill:"FFFFC000"};
  put(ws,"A"+e,"Total Low Sales Outlets:",tb);put(ws,"B"+e,0,{...tb,fx:`COUNTIF(${rg},"<"&$B$2)`,res:low.length});put(ws,"C"+e,"",tb);put(ws,"D"+e,"",tb);
  put(ws,"A"+(e+1),"Total Gross (Low Sales):",tb);put(ws,"B"+(e+1),0,{...tb,fx:`SUMIF(${rg},"<"&$B$2,${rg})`,res:low.reduce((s,r)=>s+r.gross,0),fmt:"#,##0"});put(ws,"C"+(e+1),"",tb);put(ws,"D"+(e+1),"",tb);
  widths(ws,{A:23.9,B:21.1,C:35.7,D:14})}

function buildXlsx(EJ,snap,area,threshold=3000){
  const wb=new EJ.Workbook(),eod=("EOD - "+longD(snap.date)).slice(0,31),L=snap.rows.length+1;
  wb.creator="North005 Davao ERP";const S1=sheet1(wb,snap,area,eod,L);
  snap.areas[area].collectors.forEach((c,i)=>area=="DDN"?areaSheetNarrow(wb,snap,area,c,S1,i):areaSheetWide(wb,snap,area,c,S1,i));
  eodSheet(wb,snap,area,S1,eod);lowSheet(wb,snap,eod,threshold,L);
  wb.calcProperties={fullCalcOnLoad:true};return wb}

// ---------------- UI ----------------
let T={date:null,area:"DDN",q:"",busy:false,sub:false},P=null;
const COLL=["JOHN","JAYSON","MUHLEN","JASON","MAC²","NELSON","CHARLIE"];
async function allOutlets(){let out=[],i=0;for(;;){const{data,error}=await sb.from("registry_outlets").select("*").range(i,i+999);if(error||!data)break;out=out.concat(data);if(data.length<1000)break;i+=1000}return out}
function subscribe(){if(T.sub)return;T.sub=true;let tm;sb.channel("sales").on("postgres_changes",{event:"*",schema:"public",table:"daily_reports"},()=>{clearTimeout(tm);tm=setTimeout(()=>{if(!QUIETW()&&cur=="SALES & COLLECTION"&&!T.busy)go(cur)},500)}).subscribe()}
const money=n=>Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});

async function sales(v){
  const adm=me.role=="admin";T.busy=false;P=null;
  v.innerHTML=`<div class="tbar"><select id="sd" style="max-width:200px"></select><input type="date" id="sdd" style="max-width:170px">${adm?`<label class="ghost up">Import Accounting File (Excel)<input type="file" id="sf" accept=".xlsx,.xls,.csv" hidden></label>`:""}<span class="chip" id="sc"></span></div><div id="sp"></div><div id="sr"><div class="empty">Loading…</div></div>`;
  const{data:ds}=await sb.from("daily_reports").select("report_date").order("report_date",{ascending:false});const dates=(ds||[]).map(x=>x.report_date);
  if(!T.date||!dates.includes(T.date))T.date=dates[0]||null;
  $("#sd").innerHTML=dates.length?dates.map(d=>`<option value="${d}"${d==T.date?" selected":""}>${dmy(d)}</option>`).join(""):'<option>No saved dates</option>';
  $("#sd").onchange=e=>{T.date=e.target.value;sales(v)};
  $("#sdd").value=T.date||"";$("#sdd").onchange=e=>{if(dates.includes(e.target.value)){T.date=e.target.value;sales(v)}else{$("#sc").textContent="No report saved for "+(e.target.value||"that date")}};
  if(adm)$("#sf").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(f)startImport(v,f)};
  subscribe();
  if(!T.date){$("#sr").innerHTML=`<div class="empty"><b>SALES &amp; COLLECTION</b><br>No reports yet.${adm?" Use “Import Accounting File (Excel)” to create the first daily report.":""}</div>`;return}
  const{data}=await sb.from("daily_reports").select("snapshot").eq("report_date",T.date).single();if(!data)return;
  showReport(v,data.snapshot,adm)}

async function copyReportMsg(text){
  try{
    const html=`<pre style="font-family:Consolas,monospace;white-space:pre">${text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>`;
    if(navigator.clipboard&&window.ClipboardItem){
      const textBlob=new Blob([text],{type:"text/plain"});
      const htmlBlob=new Blob([html],{type:"text/html"});
      await navigator.clipboard.write([new ClipboardItem({"text/plain":textBlob,"text/html":htmlBlob})]);
      return true;
    }
  }catch(e){}
  try{await navigator.clipboard.writeText(text);return true}catch(e){return false}
}

function cleanCollectorName(col){
  if(!col) return "";
  return String(col)
    .replace(/[\u00C2\u00A0]*\u00B2|\^2/g, "²")
    .trim();
}

function safeCollectorFilename(col){
  return cleanCollectorName(col)
    .replace(/²/g, "2")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function getSheet1Chunks(outlets,area){
  const total=outlets.length;
  if(total===0)return[{start:0,end:0,isLast:true,name:"Sheet1"}];
  const maxPerPage=area==="SAMAL"?28:32;
  if(total<=maxPerPage){
    return[{start:0,end:total,isLast:true,name:"Sheet1"}];
  }
  const chunks=[];let start=0,part=1;
  while(start<total){
    let remaining=total-start;
    let take=Math.min(maxPerPage,remaining);
    if(remaining>maxPerPage&&(remaining-maxPerPage)<5){
      take=Math.ceil(remaining/2);
    }
    let end=start+take;
    const isLast=(end>=total);
    chunks.push({start,end,isLast,name:`Sheet1 Part ${part}`});
    start=end;part++;
  }
  return chunks;
}

function buildExcelTabBar(area, activeSheetName, dateStr){
  const longDateStr = longD(dateStr);
  const eodName = ("EOD - " + longDateStr).slice(0, 31);
  let tabs = [];
  if(area === "SAMAL"){
    tabs = [
      { name: "Sheet1", color: null, textColor: "#333333" },
      { name: "NELSON AREA", color: "#FF0000", textColor: "#ffffff" },
      { name: "CHARLIE AREA", color: "#215F9A", textColor: "#ffffff" },
      { name: eodName, color: null, textColor: "#555555" },
      { name: "Low Sales", color: null, textColor: "#555555" }
    ];
  } else {
    tabs = [
      { name: "Sheet1", color: null, textColor: "#333333" },
      { name: "JOHN NEW AREA", color: "#BF0000", textColor: "#ffffff" },
      { name: "JAYSON NEW AREA", color: "#E97132", textColor: "#ffffff" },
      { name: "MUHLEN NEW AREA", color: "#02A5E3", textColor: "#000000" },
      { name: "JASON NEW AREA", color: "#92D04F", textColor: "#000000" },
      { name: "MAC² NEW AREA", color: "#FFC000", textColor: "#000000" },
      { name: eodName, color: null, textColor: "#555555" }
    ];
  }

  const normActive = cleanCollectorName(activeSheetName).toUpperCase();
  const tabsHtml = tabs.map(tab => {
    const isActive = cleanCollectorName(tab.name).toUpperCase() === normActive;
    if(isActive){
      const underlineColor = tab.color || "#107c41";
      const fontColor = (tab.color === "#FFC000" || tab.color === "#92D04F") ? "#107c41" : (tab.color || "#107c41");
      return `<div style="background:#ffffff;border-top:1px solid #d4d4d4;border-left:1px solid #d4d4d4;border-right:1px solid #d4d4d4;border-bottom:3px solid ${underlineColor};padding:3px 12px 1px 12px;font-weight:bold;color:${fontColor};font-size:10px;border-radius:2px 2px 0 0;box-shadow:0 -1px 2px rgba(0,0,0,0.06);white-space:nowrap;display:flex;align-items:center;">${esc(tab.name)}</div>`;
    } else {
      if(tab.color){
        return `<div style="background:${tab.color};border:1px solid rgba(0,0,0,0.18);padding:3px 10px;font-weight:bold;color:${tab.textColor};font-size:10px;border-radius:2px 2px 0 0;white-space:nowrap;display:flex;align-items:center;">${esc(tab.name)}</div>`;
      } else {
        return `<div style="background:#f3f3f3;border:1px solid #d4d4d4;padding:3px 10px;font-weight:normal;color:#444444;font-size:10px;border-radius:2px 2px 0 0;white-space:nowrap;display:flex;align-items:center;">${esc(tab.name)}</div>`;
      }
    }
  }).join("");

  return `<div class="excel-tab-bar" style="background:#f3f3f3;border-top:1px solid #c8c8c8;display:flex;align-items:center;height:24px;min-height:24px;padding:0 6px;font-family:'Segoe UI',Calibri,Arial,sans-serif;user-select:none;box-sizing:border-box;margin-top:auto;">
    <div style="display:flex;gap:4px;color:#595959;font-weight:bold;margin-right:8px;font-size:10px;">
      <span>&#x25C0;</span><span>&#x25B6;</span>
    </div>
    <div style="display:flex;align-items:flex-end;gap:2px;height:100%;padding-top:2px;">
      ${tabsHtml}
    </div>
    <div style="margin-left:6px;width:15px;height:15px;border-radius:50%;border:1px solid #b0b0b0;display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;font-weight:bold;">+</div>
    <div style="margin-left:auto;width:200px;height:7px;background:#e1e4e8;border-radius:4px;position:relative;">
      <div style="position:absolute;left:20px;width:55px;height:100%;background:#b6bcc4;border-radius:4px;"></div>
    </div>
  </div>`;
}

function verifyScreenshotContent(element, expected){
  const issues = [];
  if(!element) return { valid: false, issues: ["Element is null"] };
  if(expected && expected.outletCount != null){
    const rows = element.querySelectorAll("tr[data-row-type='outlet']");
    if(rows.length !== expected.outletCount){
      issues.push(`Expected ${expected.outletCount} outlets, found ${rows.length}`);
    }
  }
  if(expected && expected.hasCollectors){
    const colRows = element.querySelectorAll("tr[data-row-type='collector']");
    if(colRows.length === 0){
      issues.push("Missing collector rows");
    }
  }
  if(expected && expected.hasTotals){
    const totRow = element.querySelector("tr[data-row-type='total']");
    const commRow = element.querySelector("tr[data-row-type='commission']");
    const grossRow = element.querySelector("tr[data-row-type='gross']");
    if(!totRow) issues.push("Missing TOTAL row");
    if(!commRow) issues.push("Missing COMMISSION row");
    if(!grossRow) issues.push("Missing TOTAL GROSS row");
  }
  if(expected && expected.hasPreparedBy){
    const prepRows = element.querySelectorAll("tr[data-row-type='prepared-by']");
    if(prepRows.length === 0) issues.push("Missing PREPARED BY section");
  }
  const tabBar = element.querySelector(".excel-tab-bar");
  if(!tabBar){
    issues.push("Missing worksheet tab bar");
  }
  const scrollW = element.scrollWidth;
  const scrollH = element.scrollHeight;
  const clientW = element.clientWidth;
  const clientH = element.clientHeight;
  if(scrollW > clientW + 2){
    issues.push(`Horizontal overflow detected: scrollWidth ${scrollW} > clientWidth ${clientW}`);
  }
  if(scrollH > clientH + 2){
    issues.push(`Vertical overflow detected: scrollHeight ${scrollH} > clientHeight ${clientH}`);
  }
  return { valid: issues.length === 0, issues };
}

function buildSheet1ChunkHtml(snap,area,startIdx,endIdx,isLastChunk){
  const A=snap.areas[area],t=A.totals,sam=area==="SAMAL";
  const outletsSlice=A.outlets.slice(startIdx,endIdx);
  const dateStr=dmy(snap.date);
  const areaTitle=LABEL[area]||area;
  let h=`<div class="excel-capture-sheet" style="background:#ffffff;width:fit-content;min-width:1024px;min-height:440px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;font-family:Calibri,Arial,sans-serif;margin:0;padding:0;">
    <table style="border-collapse:collapse;width:1024px;font-size:10px;color:#000000;table-layout:fixed;margin:0;padding:0;">
      <colgroup>
        <col style="width:24px">
        <col style="width:32px">
        <col style="width:94px">
        <col style="width:260px">
        <col style="width:180px">
        <col style="width:95px">
        <col style="width:80px">
        <col style="width:90px">
        <col style="width:95px">
        <col style="width:74px">
      </colgroup>
      <thead>
        <tr style="height:18px;">
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;height:18px;"></th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">A</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">B</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">C</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">E</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">F</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">G</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">H</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">I</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">J</th>
        </tr>
        <tr style="height:28px;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">1</td>
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#b4e5a2;font-size:14px;font-weight:bold;text-align:center;color:#000000;">DATE</th>
          <th style="border:1px solid #bfbfbf;background:#a5c9ec;font-size:14px;font-weight:bold;text-align:center;color:#000000;">${esc(dateStr)}</th>
          <th colspan="5" style="border:1px solid #bfbfbf;background:#ffff00;font-size:15px;font-weight:bold;text-align:center;color:#000000;">${esc(areaTitle)}</th>
        </tr>
        <tr style="height:18px;font-size:10px;font-weight:bold;text-align:center;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">2</td>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">NO.</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">BOOTH CODE</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">ADDRESS</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">TELLER</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">TOTAL BETS</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">${sam?"PAY OUT":"PAYOUTS"}</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">COMMISSION</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">PALAWAN</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">SALARY</th>
        </tr>
      </thead>
      <tbody>`;
  let renderedRows=2;
  outletsSlice.forEach((o,idx)=>{
    const excelRow=startIdx+idx+3;
    const isOff=!!o.off;
    const color=isOff?"#ff0000":"#000000";
    const bold=isOff?"font-weight:bold;":"";
    const sc=`border:1px solid #bfbfbf;padding:0 3px;color:${color};${bold};overflow:hidden;white-space:nowrap;`;
    const betsVal=isOff?(sam?"0.00 P":"0.00"):(sam?money(o.bets)+" P":(o.bets>0?money(o.bets):"0.00"));
    const payVal=isOff?(sam?"-":"0.00 P"):(sam?(o.pay>0?money(o.pay)+" P":"-"):(o.pay>0?money(o.pay)+" P":"0.00 P"));
    const commVal=isOff?(sam?`<span style="float:left">P</span>-`:"P -"):(sam?`<span style="float:left">P</span>${money(o.comm)} P`:money(o.comm)+" P");
    const palVal=isOff?(sam?`<span style="float:left">P</span>-`:"P -"):(sam?`<span style="float:left">P</span>${money(o.pal)} P`:money(o.pal)+" P");
    const salVal=isOff?"0":(o.sal>0?money(o.sal):"0.00");
    h+=`<tr data-row-type="outlet" style="height:13px;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${excelRow}</td>
      <td style="${sc}text-align:center;">${startIdx+idx+1}</td>
      <td style="${sc}text-align:center;font-weight:bold;">${esc(o.code)}</td>
      <td style="${sc}text-align:left;">${esc(o.address||"")}</td>
      <td style="${sc}text-align:left;">${esc(o.teller||"")}</td>
      <td style="${sc}text-align:right;">${betsVal}</td>
      <td style="${sc}text-align:right;">${payVal}</td>
      <td style="${sc}text-align:right;">${commVal}</td>
      <td style="${sc}text-align:right;">${palVal}</td>
      <td style="${sc}text-align:right;">${salVal}</td>
    </tr>`;
    renderedRows++;
  });
  let curRow=startIdx+outletsSlice.length+3;
  if(isLastChunk){
    if(sam){
      A.collectors.forEach(c=>{
        h+=`<tr data-row-type="collector" style="height:13px;line-height:13px;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;font-weight:bold;text-align:left;">${esc(c)}</td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">0.00 P</td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:center;">-</td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>-</td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>-</td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">500.00 P</td>
        </tr>`;
        renderedRows++;
      });
    }else{
      A.collectors.forEach(c=>{
        h+=`<tr data-row-type="collector" style="height:13px;line-height:13px;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;font-weight:bold;text-align:left;">${esc(c)}</td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;"></td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">P</td>
          <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">500.00</td>
        </tr>`;
        renderedRows++;
      });
    }
    h+=`<tr data-row-type="total" style="height:13.5px;font-weight:bold;line-height:13.5px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">TOTAL</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(t.bets)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">${money(t.pay)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(t.comm)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(t.pal)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(t.sal)} P</td>
    </tr>
    <tr data-row-type="commission" style="height:13px;font-weight:bold;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">COMMISSION</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(t.comm)}</td>
      <td style="border:none;"></td>
    </tr>
    <tr data-row-type="gross" style="height:13px;font-weight:bold;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">TOTAL GROSS</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(t.gross)}</td>
      <td style="border:none;"></td>
    </tr>`;
    const svName=SV[area]?.[0]||"PETER JOHN CARRILLO";
    h+=`<tr data-row-type="prepared-by" style="height:14px;line-height:14px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:none;"></td>
      <td style="border:none;font-family:'Cutive Mono',Consolas,monospace;font-size:10px;color:#02a5e3;font-weight:bold;padding-left:4px;">PREPARED BY:</td>
      <td colspan="7" style="border:none;"></td>
    </tr>
    <tr data-row-type="prepared-by" style="height:15px;line-height:15px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:none;"></td>
      <td colspan="2" style="border:none;font-family:'Cutive Mono',Consolas,monospace;font-size:13px;color:#02a5e3;font-weight:bold;font-style:italic;padding-left:4px;">SV: ${esc(svName)}</td>
      <td colspan="6" style="border:none;"></td>
    </tr>`;
    renderedRows+=5;
  }
  // Fill empty rows only if sheet has few rows so table maintains clean landscape proportion
  while(renderedRows < 26){
    h+=`<tr style="height:13px;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
    </tr>`;
    renderedRows++;
  }
  h+=`</tbody></table>`;
  h+=buildExcelTabBar(area, "Sheet1", snap.date);
  h+=`</div>`;
  return h;
}

function buildAreaTableHtmlDDN(snap,rawCol){
  const col=cleanCollectorName(rawCol);
  const A=snap.areas.DDN,os=A.outlets.filter(o=>cleanCollectorName(o.collector)===col);
  const dateStr=dmy(snap.date);
  const colColor={JOHN:"#FF0000",JAYSON:"#E97132",MUHLEN:"#02A5E3",JASON:"#92D04F","MAC²":"#FFFF00"}[col]||"#FF0000";
  const sumBets=os.reduce((s,x)=>s+x.bets,0),sumPay=os.reduce((s,x)=>s+x.pay,0),sumComm=sumBets*0.125,sumPal=sumBets-sumPay-sumComm,sumSal=os.reduce((s,x)=>s+x.sal,0);
  let h=`<div class="excel-capture-sheet" style="background:#ffffff;width:fit-content;min-width:1024px;min-height:440px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;font-family:Calibri,Arial,sans-serif;margin:0;padding:0;">
    <table style="border-collapse:collapse;width:1024px;font-size:10px;color:#000000;table-layout:fixed;margin:0;padding:0;">
      <colgroup>
        <col style="width:24px">
        <col style="width:305px">
        <col style="width:177px">
        <col style="width:108px">
        <col style="width:102px">
        <col style="width:107px">
        <col style="width:109px">
        <col style="width:92px">
      </colgroup>
      <thead>
        <tr style="height:18px;">
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;height:18px;"></th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">A</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">B</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">C</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">D</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">E</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">F</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">G</th>
        </tr>
        <tr style="height:28px;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">1</td>
          <th style="border:1px solid #bfbfbf;background:#CC99FF;font-size:15px;font-weight:bold;text-align:center;color:#000000;">DATE :</th>
          <th style="border:1px solid #bfbfbf;background:#99CCFF;font-size:15px;font-weight:bold;text-align:center;color:#000000;">${esc(dateStr)}</th>
          <th colspan="5" style="border:1px solid #bfbfbf;background:${colColor};font-size:17px;font-weight:bold;text-align:center;color:#000000;">${esc(col)}</th>
        </tr>
        <tr style="height:18px;font-size:10px;font-weight:bold;text-align:center;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">2</td>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">OUTLETS:</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">TELLER</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">TOTAL BETS</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">PAYOUTS</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">COMMISSION</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">PALAWAN</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">SALARY</th>
        </tr>
      </thead>
      <tbody>`;
  let renderedRows=2;
  os.forEach((o,idx)=>{
    const isOff=!!o.off;
    const color=isOff?"#ff0000":"#000000";
    const bold=isOff?"font-weight:bold;":"";
    const sc=`border:1px solid #bfbfbf;padding:0 3px;color:${color};${bold};overflow:hidden;white-space:nowrap;`;
    const outletText=o.code+" "+(o.address||"");
    const betsVal=isOff?"0.00":(o.bets>0?money(o.bets):"0.00");
    const payVal=isOff?"-":(o.pay>0?money(o.pay):"-");
    const commVal=isOff?"-":(o.comm>0?money(o.comm):"-");
    const palVal=isOff?"-":(o.pal!==0?money(o.pal):"-");
    const salVal=isOff?"0":(o.sal>0?money(o.sal):"0.00");
    h+=`<tr data-row-type="outlet" style="height:13px;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${3+idx}</td>
      <td style="${sc}text-align:left;">${esc(outletText)}</td>
      <td style="${sc}text-align:left;">${esc(o.teller||"")}</td>
      <td style="${sc}text-align:right;"><span style="float:left">P</span>${betsVal}</td>
      <td style="${sc}text-align:right;"><span style="float:left">P</span>${payVal}</td>
      <td style="${sc}text-align:right;"><span style="float:left">P</span>${commVal}</td>
      <td style="${sc}text-align:right;"><span style="float:left">P</span>${palVal}</td>
      <td style="${sc}text-align:right;"><span style="float:left">P</span>${salVal}</td>
    </tr>`;
    renderedRows++;
  });
  let curRow=3+os.length;
  h+=`<tr data-row-type="collector" style="height:13px;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;font-weight:bold;text-align:left;">COLLECTOR</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;font-weight:bold;text-align:left;">${esc(col)}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>500.00</td>
    </tr>
    <tr data-row-type="total" style="height:14px;font-weight:bold;line-height:14px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">TOTAL</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumBets)}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumPay)}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumComm)}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumPal)}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumSal+500)}</td>
    </tr>
    <tr data-row-type="commission" style="height:13px;font-weight:bold;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td colspan="4" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">COMMISSION</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumComm)}</td>
      <td style="border:none;"></td>
    </tr>
    <tr data-row-type="gross" style="height:13px;font-weight:bold;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td colspan="4" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">TOTAL GROSS</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumBets-sumPay)}</td>
      <td style="border:none;"></td>
    </tr>`;
  renderedRows+=4;
  while(renderedRows < 26){
    h+=`<tr style="height:13px;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
    </tr>`;
    renderedRows++;
  }
  h+=`</tbody></table>`;
  h+=buildExcelTabBar("DDN", col + " NEW AREA", snap.date);
  h+=`</div>`;
  return h;
}

function buildAreaTableHtmlSamal(snap,rawCol){
  const col=cleanCollectorName(rawCol);
  const A=snap.areas.SAMAL,os=A.outlets.filter(o=>cleanCollectorName(o.collector)===col);
  const otherCol=cleanCollectorName(A.collectors.filter(c=>cleanCollectorName(c)!==col)[0]||"");
  const dateStr=dmy(snap.date);
  const sumBets=os.reduce((s,x)=>s+x.bets,0),sumPay=os.reduce((s,x)=>s+x.pay,0),sumComm=sumBets*0.125,sumPal=sumBets-sumPay-sumComm,sumSal=os.reduce((s,x)=>s+x.sal,0);
  let h=`<div class="excel-capture-sheet" style="background:#ffffff;width:fit-content;min-width:1024px;min-height:440px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;font-family:Calibri,Arial,sans-serif;margin:0;padding:0;">
    <table style="border-collapse:collapse;width:1024px;font-size:10px;color:#000000;table-layout:fixed;margin:0;padding:0;">
      <colgroup>
        <col style="width:24px">
        <col style="width:32px">
        <col style="width:94px">
        <col style="width:260px">
        <col style="width:180px">
        <col style="width:95px">
        <col style="width:80px">
        <col style="width:90px">
        <col style="width:95px">
        <col style="width:74px">
      </colgroup>
      <thead>
        <tr style="height:18px;">
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;height:18px;"></th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">A</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">B</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">C</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">E</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">F</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">G</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">H</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">I</th>
          <th style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;font-weight:normal;text-align:center;">J</th>
        </tr>
        <tr style="height:28px;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">1</td>
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#b4e5a2;font-size:14px;font-weight:bold;text-align:center;color:#000000;">DATE</th>
          <th style="border:1px solid #bfbfbf;background:#a5c9ec;font-size:14px;font-weight:bold;text-align:center;color:#000000;">${esc(dateStr)}</th>
          <th colspan="5" style="border:1px solid #bfbfbf;background:#ffff00;font-size:15px;font-weight:bold;text-align:center;color:#000000;">SAMAL</th>
        </tr>
        <tr style="height:18px;font-size:10px;font-weight:bold;text-align:center;">
          <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:10px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">2</td>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">NO.</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">BOOTH CODE</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">ADDRESS</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">TELLER</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">TOTAL BETS</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">PAY OUT</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">COMMISSION</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">PALAWAN</th>
          <th style="border:1px solid #808080;background:#ffffff;color:#000000;">SALARY</th>
        </tr>
      </thead>
      <tbody>`;
  let renderedRows=2;
  os.forEach((o,idx)=>{
    const isOff=!!o.off;
    const color=isOff?"#ff0000":"#000000";
    const bold=isOff?"font-weight:bold;":"";
    const sc=`border:1px solid #bfbfbf;padding:0 3px;color:${color};${bold};overflow:hidden;white-space:nowrap;`;
    const betsVal=isOff?"0.00 P":(o.bets>0?money(o.bets)+" P":"0.00 P");
    const payVal=isOff?"-":(o.pay>0?money(o.pay)+" P":"-");
    const commVal=isOff?`<span style="float:left">P</span>-`:(o.comm>0?`<span style="float:left">P</span>${money(o.comm)} P`:`<span style="float:left">P</span>-`);
    const palVal=isOff?`<span style="float:left">P</span>-`:(o.pal!==0?`<span style="float:left">P</span>${money(o.pal)} P`:`<span style="float:left">P</span>-`);
    const salVal=isOff?"0":(o.sal>0?money(o.sal):"0.00");
    h+=`<tr data-row-type="outlet" style="height:12.5px;line-height:12.5px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${3+idx}</td>
      <td style="${sc}text-align:center;">${idx+1}</td>
      <td style="${sc}text-align:center;font-weight:bold;">${esc(o.code)}</td>
      <td style="${sc}text-align:left;">${esc(o.address||"")}</td>
      <td style="${sc}text-align:left;">${esc(o.teller||"")}</td>
      <td style="${sc}text-align:right;">${betsVal}</td>
      <td style="${sc}text-align:right;">${payVal}</td>
      <td style="${sc}text-align:right;">${commVal}</td>
      <td style="${sc}text-align:right;">${palVal}</td>
      <td style="${sc}text-align:right;">${salVal}</td>
    </tr>`;
    renderedRows++;
  });
  let curRow=3+os.length;
  h+=`<tr data-row-type="collector" style="height:12.5px;line-height:12.5px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;font-weight:bold;text-align:left;">${esc(otherCol)}</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">0.00 P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:center;">-</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>-</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>-</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">500.00 P</td>
    </tr>
    <tr data-row-type="total" style="height:14px;font-weight:bold;line-height:14px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">TOTAL</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumBets)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;">${money(sumPay)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumComm)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumPal)} P</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumSal+500)} P</td>
    </tr>
    <tr data-row-type="commission" style="height:13px;font-weight:bold;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">COMMISSION</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumComm)}</td>
      <td style="border:none;"></td>
    </tr>
    <tr data-row-type="gross" style="height:13px;font-weight:bold;line-height:13px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:left;">TOTAL GROSS</td>
      <td style="border:1px solid #bfbfbf;padding:0 3px;text-align:right;"><span style="float:left">P</span>${money(sumBets-sumPay)}</td>
      <td style="border:none;"></td>
    </tr>`;
  renderedRows+=4;
  while(renderedRows < 26){
    h+=`<tr style="height:12.5px;line-height:12.5px;">
      <td style="border:1px solid #d4d4d4;background:#f2f2f2;color:#595959;font-size:9.5px;font-family:'Segoe UI',Calibri,Arial,sans-serif;text-align:center;">${curRow++}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
    </tr>`;
    renderedRows++;
  }
  h+=`</tbody></table>`;
  h+=buildExcelTabBar("SAMAL", col + " AREA", snap.date);
  h+=`</div>`;
  return h;
}

function getScreenshotItems(snap,area){
  const items=[],A=snap.areas[area];
  const chunks=getSheet1Chunks(A.outlets,area);
  chunks.forEach((chunk,i)=>{
    const partNum=i+1;
    items.push({
      name:`Sheet1 Part ${partNum}`,
      filename:`0${partNum}_Sheet1_Part_${partNum}.png`,
      type:"sheet1",
      chunk,
      expected: {
        outletCount: chunk.end - chunk.start,
        hasCollectors: chunk.isLast,
        hasTotals: chunk.isLast,
        hasPreparedBy: chunk.isLast
      }
    });
  });
  let nextIdx=chunks.length+1;
  A.collectors.forEach(rawCol=>{
    const col=cleanCollectorName(rawCol);
    const prefix=nextIdx<10?`0${nextIdx}`:`${nextIdx}`;
    const safeCol=safeCollectorFilename(col);
    let sheetName="",filename="";
    if(area==="DDN"){sheetName=`${col} NEW AREA`;filename=`${prefix}_${safeCol}_NEW_AREA.png`}
    else{sheetName=`${col} AREA`;filename=`${prefix}_${safeCol}_AREA.png`}
    const outletCount = A.outlets.filter(o=>cleanCollectorName(o.collector)===col).length;
    items.push({
      name:sheetName,
      filename,
      type:"collector",
      col,
      expected: {
        outletCount,
        hasCollectors: true,
        hasTotals: true,
        hasPreparedBy: false
      }
    });
    nextIdx++;
  });
  return items;
}

function showReport(v,snap,adm){
  const A=snap.areas[T.area],t=A.totals,warn=[];
  if(snap.skipped?.length)warn.push(`${snap.skipped.length} outlet(s) in the file were not in Master Registry and were left out: ${snap.skipped.join(", ")}`);
  if(A.noCollector)warn.push(`${A.noCollector} outlet(s) in this area have no collector assigned (they are in Sheet1 but not in any collector sheet).`);
  const kp=[["Total Bets",t.bets],["Payouts",t.pay],["Commission",t.comm],["Palawan",t.pal],["Gross",t.gross],["Salary",t.sal]];
  $("#sr").innerHTML=`<div class="tbar"><button class="chip2" data-a="DDN">Davao del Norte</button><button class="chip2" data-a="SAMAL">Samal</button><span class="chip">${A.outlets.length} outlets · ${A.collectors.length} collectors</span></div>
  ${warn.map(w=>`<div class="warn2">⚠ ${esc(w)}</div>`).join("")}
  <div class="kpis">${kp.map(([l,x])=>`<div class="kpi"><small>${l}</small><b>₱${money(x)}</b></div>`).join("")}</div>
  <div class="box" style="max-width:none;margin:14px 0"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px"><b>Report message</b><button class="ghost" id="cp" style="margin-left:auto">Copy</button><button class="btn" id="dx" style="width:auto;padding:8px 16px;margin:0">Download Excel</button>${adm?'<button class="ghost" id="dd">Delete this day</button>':""}</div><div class="msgbox" id="mb">${esc(msgText(snap.date,t))}</div><div class="msg" id="sm" style="color:var(--gold);min-height:16px"></div></div>
  <div class="box" style="max-width:none;margin:14px 0" id="ss-box">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <b>📸 Automatic Report Screenshots</b>
      <span class="chip" id="ss-status" style="margin-left:auto">Ready to generate</span>
      <button class="btn" id="btn-gen-ss" style="width:auto;padding:8px 16px;margin:0">Generate Screenshots</button>
      <button class="ghost" id="btn-zip-ss" style="display:none;width:auto;margin:0">Download All Screenshots (ZIP)</button>
    </div>
    <div id="ss-progress" style="display:none;margin:10px 0;">
      <div style="background:var(--line);border-radius:6px;overflow:hidden;height:8px;width:100%">
        <div id="ss-bar" style="background:var(--gold);height:100%;width:0%;transition:width 0.2s"></div>
      </div>
      <div id="ss-msg" style="font-size:12px;color:var(--dim);margin-top:5px">Ready</div>
    </div>
    <div id="ss-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:14px;margin-top:12px"></div>
  </div>
  <div class="tbar"><input id="sq" placeholder="Search outlets…" value="${esc(T.q)}"></div><div id="stb"></div>`;
  document.querySelectorAll("[data-a]").forEach(b=>{b.classList.toggle("on",b.dataset.a==T.area);b.onclick=()=>{T.area=b.dataset.a;T.q="";showReport(v,snap,adm)}});
  $("#cp").onclick=async()=>{
    const ok=await copyReportMsg(msgText(snap.date,t));
    $("#sm").textContent=ok?"Copied with aligned columns.":"Select the text and copy it manually.";
  };
  $("#dx").onclick=async()=>{$("#sm").textContent="Preparing Excel…";try{await LIB.exceljs();const wb=buildXlsx(ExcelJS,snap,T.area),buf=await wb.xlsx.writeBuffer(),a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));a.download=(T.area=="DDN"?"DDN":"SAMAL")+" - "+longD(snap.date)+".xlsx";a.click();$("#sm").textContent="Downloaded."}catch(e){$("#sm").textContent="Could not create the Excel file."}};
  if(adm)$("#dd").onclick=async()=>{if(!confirm("Delete the saved report for "+dmy(snap.date)+"?"))return;const{error}=await sb.from("daily_reports").delete().eq("report_date",snap.date);if(error)return $("#sm").textContent="Could not delete.";T.date=null;sales(v)};
  
  let generatedScreenshots=[];
  const btnGen=$("#btn-gen-ss"),btnZip=$("#btn-zip-ss"),pBox=$("#ss-progress"),pBar=$("#ss-bar"),pMsg=$("#ss-msg"),sStat=$("#ss-status"),sGrid=$("#ss-grid");
  btnGen.onclick=async()=>{
    try{
      btnGen.disabled=true;btnZip.style.display="none";pBox.style.display="block";pBar.style.width="0%";pMsg.textContent="Loading image engine…";sStat.textContent="Loading dependencies…";
      await Promise.all([LIB.html2canvas(),LIB.jszip()]);
      const items=getScreenshotItems(snap,T.area),total=items.length;
      generatedScreenshots=[];sGrid.innerHTML="";
      for(let i=0;i<total;i++){
        const it=items[i];
        pMsg.textContent=`Rendering ${it.name} (${i+1}/${total})…`;sStat.textContent=`Rendering (${i+1}/${total})`;
        pBar.style.width=Math.round((i/total)*100)+"%";
        let html="";
        if(it.type==="sheet1"){
          html=buildSheet1ChunkHtml(snap,T.area,it.chunk.start,it.chunk.end,it.chunk.isLast);
        }else if(T.area==="DDN"){
          html=buildAreaTableHtmlDDN(snap,it.col);
        }else{
          html=buildAreaTableHtmlSamal(snap,it.col);
        }
        const stage=document.createElement("div");
        stage.style.position="absolute";stage.style.left="-99999px";stage.style.top="0px";
        stage.style.display="inline-block";stage.style.width="auto";stage.style.height="auto";
        stage.style.overflow="visible";stage.style.backgroundColor="#ffffff";stage.style.zIndex="-9999";
        stage.innerHTML=html;document.body.appendChild(stage);
        await new Promise(r=>setTimeout(r,80));

        const card=stage.firstElementChild||stage;
        let measuredWidth=Math.ceil(Math.max(1024,card.scrollWidth,card.offsetWidth));
        let measuredHeight=Math.ceil(Math.max(420,card.scrollHeight,card.offsetHeight));
        card.style.width=measuredWidth+"px";
        card.style.height=measuredHeight+"px";
        card.style.overflow="visible";

        const check=verifyScreenshotContent(card,it.expected);
        if(!check.valid){
          console.warn(`[Content Verification] Warning for ${it.name}:`,check.issues);
          measuredWidth=Math.ceil(Math.max(measuredWidth,card.scrollWidth));
          measuredHeight=Math.ceil(Math.max(measuredHeight,card.scrollHeight));
          card.style.width=measuredWidth+"px";
          card.style.height=measuredHeight+"px";
        }

        const canvas=await html2canvas(card,{
          scale:1,
          backgroundColor:"#ffffff",
          logging:false,
          width:measuredWidth,
          height:measuredHeight,
          windowWidth:measuredWidth+50,
          windowHeight:measuredHeight+50,
          scrollX:0,
          scrollY:0
        });
        document.body.removeChild(stage);
        const dataUrl=canvas.toDataURL("image/png");
        const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
        const record={...it,dataUrl,blob};generatedScreenshots.push(record);
        const uiCard=document.createElement("div");
        uiCard.className="box";uiCard.style.margin="0";uiCard.style.padding="10px";uiCard.style.display="flex";uiCard.style.flexDirection="column";uiCard.style.gap="8px";
        uiCard.innerHTML=`<div style="font-weight:bold;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(it.name)}">${esc(it.name)}</div>
          <div style="background:#0f172a;border:1px solid var(--line);border-radius:6px;overflow:hidden;cursor:pointer;height:140px;display:flex;align-items:center;justify-content:center" class="thumb-wrap" title="Click to view full image">
            <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.4)" alt="${esc(it.name)}">
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(it.filename)}</span>
            <button class="ghost" style="padding:4px 8px;font-size:11px" data-dl>Download</button>
          </div>`;
        uiCard.querySelector(".thumb-wrap").onclick=()=>{
          const w=window.open("");
          w.document.write(`<title>${esc(it.name)}</title><body style="margin:0;background:#18181b;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${dataUrl}" style="max-width:98%;max-height:98vh;box-shadow:0 8px 30px rgba(0,0,0,0.7);border-radius:4px"></body>`);
        };
        uiCard.querySelector("[data-dl]").onclick=()=>{
          const a=document.createElement("a");a.href=dataUrl;a.download=it.filename;a.click();
        };
        sGrid.appendChild(uiCard);
        pBar.style.width=Math.round(((i+1)/total)*100)+"%";
      }
      sStat.textContent=`Completed (${total} screenshots)`;
      pMsg.textContent=`All ${total} screenshots generated successfully.`;
      btnZip.style.display="inline-flex";
      setTimeout(()=>{pBox.style.display="none"},1500);
    }catch(err){
      console.error("Screenshot error:",err);sStat.textContent="Error generating screenshots";pMsg.textContent="Error: "+(err.message||"Failed to render");
    }finally{
      btnGen.disabled=false;
    }
  };
  btnZip.onclick=async()=>{
    if(!generatedScreenshots.length)return;
    try{
      btnZip.textContent="Creating ZIP…";btnZip.disabled=true;await LIB.jszip();
      const zip=new JSZip();
      generatedScreenshots.forEach(it=>zip.file(it.filename,it.blob));
      const zipBlob=await zip.generateAsync({type:"blob"});
      const a=document.createElement("a");
      a.href=URL.createObjectURL(zipBlob);
      a.download=`${T.area=="DDN"?"DDN":"SAMAL"} - Screenshots - ${longD(snap.date)}.zip`;
      a.click();
      btnZip.textContent="Download All Screenshots (ZIP)";
    }catch(err){
      console.error("ZIP error:",err);alert("Could not create ZIP: "+(err.message||"Unknown error"));btnZip.textContent="Download All Screenshots (ZIP)";
    }finally{
      btnZip.disabled=false;
    }
  };

  const draw=()=>{const q=T.q.toLowerCase(),rows=A.outlets.filter(o=>!q||[o.code,o.teller,o.collector,o.address].join(" ").toLowerCase().includes(q)),pg=PAGER.paginate("sales_"+T.area,rows);
    $("#stb").innerHTML=rows.length?`<div class="tw"><table><thead><tr><th>Booth</th><th>Teller</th><th>Collector</th><th>Total Bets</th><th>Payouts</th><th>Commission</th><th>Palawan</th><th>Salary</th></tr></thead><tbody>${pg.slice.map(o=>`<tr><td><b>${esc(o.code)}</b></td><td>${esc(o.teller)}</td><td>${esc(o.collector)}</td><td>${money(o.bets)}</td><td>${money(o.pay)}</td><td>${money(o.comm)}</td><td>${money(o.pal)}</td><td>${money(o.sal)}</td></tr>`).join("")}</tbody></table></div>`+pg.bar:'<div class="empty">No outlets.</div>';
    PAGER.bind($("#stb"),pg.st,draw)};
  $("#sq").oninput=e=>{T.q=e.target.value;PAGER.paginate("sales_"+T.area,[]).st.page=1;draw()};draw()}

async function startImport(v,file){
  const sp=$("#sp");sp.innerHTML='<div class="box" style="max-width:none;margin-bottom:12px">Reading file…</div>';T.busy=true;
  try{await LIB.xlsx();P={...parseAccounting(XLSX,await file.arrayBuffer())};if(!P.rows.length)throw 0}catch(e){T.busy=false;sp.innerHTML='<div class="box" style="max-width:none;margin-bottom:12px">That file does not look like the accounting summary (needs Draw Date, Outlet Name, Gross… columns).</div>';return}
  P.date=P.date||new Date().toISOString().slice(0,10);P.pick={};await preview(v)}

async function preview(v){
  const sp=$("#sp"),O=await allOutlets();
  if(!O.length){sp.innerHTML='<div class="box" style="max-width:none;margin-bottom:12px"><b>Master Registry is empty.</b><br>Upload the masterlist in MASTER REGISTRY first, so outlets can be matched to areas.<br><br><button class="ghost" id="pc">Close</button></div>';$("#pc").onclick=()=>{T.busy=false;sp.innerHTML=""};return}
  const R=compute(O,P.rows),D=R.areas.DDN.totals,S=R.areas.SAMAL.totals,{data:ex}=await sb.from("daily_reports").select("report_date").eq("report_date",P.date);
  const un=R.unmatched,tg=P.rows.reduce((s,r)=>s+r.gross,0);
  sp.innerHTML=`<div class="box" style="max-width:none;margin-bottom:14px"><b>Import preview</b>
  <div style="display:flex;gap:10px;align-items:center;margin:8px 0;flex-wrap:wrap"><label style="margin:0">Report date</label><input type="date" id="pd" value="${P.date}" style="width:auto"><span class="chip">${P.rows.length} outlets in file · gross ₱${money(tg)}</span></div>
  ${P.mixed?'<div class="warn2">⚠ The file has more than one draw date. The most common one was used.</div>':""}${P.dups.length?`<div class="warn2">⚠ Duplicate outlet rows ignored (first one used): ${esc(P.dups.join(", "))}</div>`:""}${ex&&ex.length?'<div class="warn2">⚠ A report for this date already exists. Saving will replace it.</div>':""}
  <div class="kpis"><div class="kpi"><small>DDN Total Bets</small><b>₱${money(D.bets)}</b></div><div class="kpi"><small>DDN Gross</small><b>₱${money(D.gross)}</b></div><div class="kpi"><small>Samal Total Bets</small><b>₱${money(S.bets)}</b></div><div class="kpi"><small>Samal Gross</small><b>₱${money(S.gross)}</b></div></div>
  ${un.length?`<div class="warn2" style="margin-top:12px"><b>${un.length} outlet(s) are not in Master Registry.</b> Choose the municipality (and collector) to add them, or leave them out.<div class="tw" style="margin-top:8px"><table><thead><tr><th>Booth</th><th>Gross</th><th>Municipality</th><th>Collector</th></tr></thead><tbody>${un.map(u=>`<tr><td><b>${esc(u.code)}</b></td><td>${money(u.gross)}</td><td><select data-u="${esc(u.code)}"><option value="">— choose —</option>${Object.entries(MUNI).map(([k,l])=>`<option value="${k}"${P.pick[u.code]==k?" selected":""}>${l[0]}</option>`).join("")}</select></td><td><input data-c="${esc(u.code)}" list="cl2" value="${esc(P.pick[u.code+"_c"]||"")}" style="min-width:120px"></td></tr>`).join("")}</tbody></table></div><datalist id="cl2">${COLL.map(c=>`<option value="${c}">`).join("")}</datalist>
  <div style="margin-top:8px"><button class="ghost" id="ad">Add chosen outlets to registry</button> <label style="display:inline-flex;gap:6px;align-items:center;margin-left:10px"><input type="checkbox" id="sk" style="width:auto"> Save without the outlets that are not added</label></div></div>`:""}
  ${R.areas.DDN.noCollector+R.areas.SAMAL.noCollector?`<div class="warn2" style="margin-top:12px">⚠ ${R.areas.DDN.noCollector+R.areas.SAMAL.noCollector} outlet(s) have no collector yet (use “Import Areas” in Master Registry or edit them).</div>`:""}
  <div style="margin-top:12px;display:flex;gap:8px;align-items:center"><button class="btn" id="sv" style="width:auto;padding:10px 20px;margin:0">Save report</button><button class="ghost" id="cn">Cancel</button><span class="chip" id="pm"></span></div></div>`;
  $("#pd").onchange=e=>{P.date=e.target.value;preview(v)};$("#cn").onclick=()=>{T.busy=false;P=null;sp.innerHTML=""};
  sp.querySelectorAll("[data-u]").forEach(s=>s.onchange=()=>P.pick[s.dataset.u]=s.value);sp.querySelectorAll("[data-c]").forEach(s=>s.oninput=()=>P.pick[s.dataset.c+"_c"]=s.value.trim().toUpperCase());
  if($("#ad"))$("#ad").onclick=async()=>{const add=un.filter(u=>P.pick[u.code]).map(u=>({booth_code:u.code,municipality:P.pick[u.code],sr_name:null,collector:P.pick[u.code+"_c"]||null,needs_details:true,status:"ACTIVE"}));
    if(!add.length)return $("#pm").textContent="Choose a municipality for at least one outlet.";const{error}=await sb.from("registry_outlets").insert(add);if(error)return $("#pm").textContent="Could not add (already exists?).";preview(v)};
  $("#sv").onclick=async()=>{if(un.length&&!$("#sk")?.checked)return $("#pm").textContent="Add the missing outlets, or tick “Save without…”.";
    $("#sv").disabled=true;const snap={date:P.date,rows:P.rows,areas:R.areas,skipped:un.map(u=>u.code),sv:SV};
    const{error}=await sb.from("daily_reports").upsert({report_date:P.date,snapshot:snap,created_by:me.id},{onConflict:"report_date"});
    if(error){$("#sv").disabled=false;return $("#pm").textContent="Could not save."}T.date=P.date;T.busy=false;P=null;sales(v)}}

window.SALES={parseAccounting,compute,buildXlsx,msgText,salary,buildSheet1ChunkHtml,buildAreaTableHtmlDDN,buildAreaTableHtmlSamal,buildExcelTabBar,getSheet1Chunks,getScreenshotItems,verifyScreenshotContent,cleanCollectorName,safeCollectorFilename,CC};
window.MODS=Object.assign(window.MODS||{},{"SALES & COLLECTION":sales});
})();
