(()=>{
const SV={DDN:["PETER JOHN CARRILLO"],SAMAL:["PETER JOHN CARRILLO"]};
const CC={JOHN:["FFFF0000","FFFF0000"],JAYSON:["FFE97132","FFE97132"],MUHLEN:["FF00B0F0","FF00B0F0"],JASON:["FF92D050","FF92D050"],"MAC²":["FFFFFF00","FFFFFF00"],NELSON:["FFFF0000","FFFF0000"],CHARLIE:["FF215F9A","FF215F9A"]},PAL=[["FFFFC000","FFFFC000"],["FF00B0F0","FF00B0F0"],["FF7030A0","FF7030A0"],["FFFF66CC","FFFF66CC"]],ccol=(n,i)=>CC[n]||PAL[i%PAL.length];
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
  const A=snap.areas[area],ws=wb.addWorksheet("Sheet1",{properties:{tabColor:{argb:"FF22C55E"}}}),n=A.outlets.length,k=A.collectors.length,sam=area=="SAMAL";
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
  widths(ws,{A:5.1,B:19.3,C:68.4,D:63.2,E:48.6,F:27,G:22.7,H:27,I:25.7,J:22.3});
  ws.getColumn(4).hidden=true;
  for(let r=t1-1;r<=t2;r++)ws.getRow(r).hidden=true;
  return{ws,rowOf,tot,cm,gr}}

function areaSheetNarrow(wb,snap,area,col,S1,idx){
  const A=snap.areas[area],os=A.outlets.filter(o=>o.collector==col),ws=wb.addWorksheet((col+" NEW AREA").replace(/[:\\/?*\[\]]/g," ").slice(0,31),{properties:{tabColor:{argb:ccol(col,idx)[1]}}});
  put(ws,"A1","DATE",{font:FN(18,1),fill:"FFCC99FF",al:"center"});put(ws,"B1",0,{fx:"Sheet1!E1",res:ser(snap.date),fmt:"d-mmm-yy",font:FN(18,1),fill:"FF99CCFF",al:"center"});
  ws.mergeCells("C1:G1");put(ws,"C1",col,{font:FN(18,1,"FF36363D"),fill:ccol(col,idx)[0],al:"center"});
  ["OUTLETS","TELLER","TOTAL BETS","PAYOUTS","COMMISSION","PALAWAN","SALARY"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"2",h,{font:FN(12,1),al:"center"}));
  os.forEach((o,i)=>{const r=3+i,s=S1.rowOf[o.code];OFF=!!o.off;
    put(ws,"A"+r,0,{fx:`Sheet1!D${s}`,res:o.code+" "+o.address,font:FN(11)});put(ws,"B"+r,0,{fx:`Sheet1!E${s}`,res:o.teller,font:FN(11)});
    put(ws,"C"+r,0,{fx:`Sheet1!F${s}`,res:o.bets,font:FN(14),fmt:PESO,al:"center"});put(ws,"D"+r,0,{fx:`Sheet1!G${s}`,res:o.pay,font:FN(14),fmt:PESO});
    put(ws,"E"+r,0,{fx:`C${r}*0.125`,res:o.comm,font:FN(14),fmt:PESO});put(ws,"F"+r,0,{fx:`C${r}-D${r}-E${r}`,res:o.pal,font:FN(14),fmt:PESO});put(ws,"G"+r,0,{fx:`Sheet1!J${s}`,res:o.sal,font:FN(14),fmt:PESO})});OFF=false;
  const e=2+os.length,c=e+1,t=e+2,sum=(o,f)=>os.reduce((s,x)=>s+x[f],0),bets=sum(0,"bets"),pay=sum(0,"pay"),comm=bets*0.125;
  put(ws,"A"+c,"COLLECTOR",{font:FN(11,1)});put(ws,"B"+c,col,{font:FN(11,1)});put(ws,"G"+c,500,{font:FN(14),fmt:PESO});
  put(ws,"A"+t,"TOTAL",{font:FN(11,1)});
  [["C",bets],["D",pay],["E",comm],["F",bets-pay-comm]].forEach(([k,v])=>put(ws,k+t,0,{fx:`SUM(${k}3:${k}${e})`,res:v,font:FN(14,1),fmt:PESO}));put(ws,"G"+t,0,{fx:`SUM(G3:G${c})`,res:sum(0,"sal")+500,font:FN(14,1),fmt:PESO});
  put(ws,"E"+(t+1),"COMMISSION",{font:FN(11,1)});put(ws,"F"+(t+1),0,{fx:`E${t}`,res:comm,font:FN(14,1),fmt:PESO});
  put(ws,"E"+(t+2),"TOTAL GROSS",{font:FN(11,1)});put(ws,"F"+(t+2),0,{fx:`SUM(F${t},F${t+1})`,res:bets-pay,font:FN(14,1),fmt:PESO});
  widths(ws,{A:65.1,B:30.2,C:22,D:19.7,E:20.9,F:22.3,G:20.9})}

function areaSheetWide(wb,snap,area,col,S1,idx){
  const A=snap.areas[area],os=A.outlets.filter(o=>o.collector==col),ws=wb.addWorksheet((col+" AREA").replace(/[:\\/?*\[\]]/g," ").slice(0,31),{properties:{tabColor:{argb:ccol(col,idx)[1]}}});
  put(ws,"C1","DATE",{font:FN(24,1),fill:"FFB4E5A2",al:"center"});put(ws,"D1","DATE",{font:FN(24,1),fill:"FFB4E5A2",al:"center"});ws.getRow(1).height=30;put(ws,"E1",0,{fx:"Sheet1!E1",res:ser(snap.date),font:FN(24,1),fmt:"d-mmm-yy",fill:"FFA5C9EC",al:"center"});
  ws.mergeCells("F1:J1");put(ws,"F1",col,{font:FN(22,1),fill:"FFFFFF00",al:"center"});
  ["NO.","BOOTH CODE","ADDRESS","OUTLETS","TELLER","TOTAL BETS","PAY OUT","COMMISSION","PALAWAN","SALARY"].forEach((h,i)=>put(ws,String.fromCharCode(65+i)+"2",h,{font:FN(14,1),al:"center"}));
  os.forEach((o,i)=>{const r=3+i,s=S1.rowOf[o.code];OFF=!!o.off;put(ws,"A"+r,i+1,{font:FN(12,1),al:"center"});put(ws,"B"+r,o.code,{});put(ws,"C"+r,o.address,{});put(ws,"D"+r,0,{fx:`B${r}&" "&C${r}`,res:o.code+" "+o.address});put(ws,"E"+r,o.teller,{});
    put(ws,"F"+r,0,{fx:`Sheet1!F${s}`,res:o.bets,fmt:"#,##0.00",font:FN(11,1)});put(ws,"G"+r,0,{fx:`Sheet1!G${s}`,res:o.pay,font:FN(14),fmt:PESO});put(ws,"H"+r,0,{fx:`F${r}*0.125`,res:o.comm,font:FN(14),fmt:PESO});
    put(ws,"I"+r,0,{fx:`F${r}-G${r}-H${r}`,res:o.pal,font:FN(14),fmt:PESO});put(ws,"J"+r,0,{fx:`Sheet1!J${s}`,res:o.sal,font:FN(14),fmt:PESO})});OFF=false;
  const e=2+os.length,c=e+1,t=e+2,sum=f=>os.reduce((s,x)=>s+x[f],0),bets=sum("bets"),pay=sum("pay"),comm=bets*0.125;
  put(ws,"D"+c,"COLLECTOR",{font:FN(14)});put(ws,"E"+c,col,{font:FN(14)});put(ws,"J"+c,500,{font:FN(14),fmt:PESO});put(ws,"C"+t,"TOTAL",{font:FN(14,1)});put(ws,"D"+t,"TOTAL",{font:FN(14,1)});
  [["F",bets],["G",pay],["H",comm],["I",bets-pay-comm]].forEach(([k,v])=>put(ws,k+t,0,{fx:`SUM(${k}3:${k}${e})`,res:v,font:FN(14,1),fmt:PESO}));put(ws,"J"+t,0,{fx:`SUM(J3:J${c})`,res:sum("sal")+500,font:FN(14,1),fmt:PESO});
  put(ws,"H"+(t+1),"COMMISSION",{font:FN(14,1)});put(ws,"I"+(t+1),0,{fx:`H${t}`,res:comm,font:FN(14,1),fmt:PESO});put(ws,"H"+(t+2),"TOTAL GROSS",{font:FN(14,1)});put(ws,"I"+(t+2),0,{fx:`SUM(I${t},I${t+1})`,res:bets-pay,font:FN(14,1),fmt:PESO});
  widths(ws,{A:5.1,B:19.3,C:68.4,D:63.2,E:48.6,F:27,G:22.7,H:27,I:25.7,J:22.3});
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

function getSheet1Chunks(outlets,area){
  if(area==="SAMAL"){
    return[
      {start:0,end:Math.min(28,outlets.length),isLast:outlets.length<=28,name:"Sheet1 Part 1"},
      {start:Math.min(28,outlets.length),end:outlets.length,isLast:true,name:"Sheet1 Part 2"}
    ];
  }
  const chunks=[];let start=0,part=1;
  while(start<outlets.length){
    let end=outlets.length;
    if(part===1)end=Math.min(32,outlets.length);
    else if(part===2)end=Math.min(65,outlets.length);
    else if(part===3)end=Math.min(98,outlets.length);
    else end=outlets.length;
    const isLast=end>=outlets.length;
    chunks.push({start,end,isLast,name:`Sheet1 Part ${part}`});
    start=end;part++;
  }
  return chunks;
}

function buildSheet1ChunkHtml(snap,area,startIdx,endIdx,isLastChunk){
  const A=snap.areas[area],t=A.totals,sam=area==="SAMAL";
  const outletsSlice=A.outlets.slice(startIdx,endIdx);
  const dateStr=dmy(snap.date);
  const areaTitle=LABEL[area]||area;
  let h=`<div style="background:#ffffff;padding:16px;width:1380px;box-sizing:border-box;font-family:Calibri,Arial,sans-serif;">
    <table style="border-collapse:collapse;width:100%;font-size:11px;color:#000000;table-layout:fixed;">
      <colgroup>
        <col style="width:45px">
        <col style="width:120px">
        <col style="width:380px">
        <col style="width:260px">
        <col style="width:120px">
        <col style="width:115px">
        <col style="width:120px">
        <col style="width:125px">
        <col style="width:95px">
      </colgroup>
      <thead>
        <tr style="height:36px;">
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#b4e5a2;font-size:22px;font-weight:bold;text-align:center;">DATE</th>
          <th style="border:1px solid #bfbfbf;background:#a5c9ec;font-size:20px;font-weight:bold;text-align:center;">${esc(dateStr)}</th>
          <th colspan="5" style="border:1px solid #bfbfbf;background:#ffff00;font-size:20px;font-weight:bold;text-align:center;">${esc(areaTitle)}</th>
        </tr>
        <tr style="height:26px;font-size:12px;font-weight:bold;text-align:center;">
          <th style="border:1px solid #bfbfbf;background:#ffffff;">NO.</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">BOOTH CODE</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">ADDRESS</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">TELLER</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">TOTAL BETS</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">${sam?"PAY OUT":"PAYOUTS"}</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">COMMISSION</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">PALAWAN</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">SALARY</th>
        </tr>
      </thead>
      <tbody>`;
  outletsSlice.forEach((o,idx)=>{
    const rowNum=startIdx+idx+1;
    const isOff=!!o.off;
    const color=isOff?"#ff0000":"#000000";
    const bold=isOff?"font-weight:bold;":"";
    const sc=`border:1px solid #bfbfbf;padding:3px 5px;color:${color};${bold}`;
    const betsVal=o.bets>0?money(o.bets):"0.00";
    const payVal=o.pay>0?"₱ "+money(o.pay):(isOff?"—":"₱ 0.00");
    const commVal=o.comm>0?"₱ "+money(o.comm):(isOff?"—":"₱ 0.00");
    const palVal=o.pal!==0?"₱ "+money(o.pal):(isOff?"—":"₱ 0.00");
    const salVal=o.sal>0?money(o.sal):"0";
    h+=`<tr style="height:22px;">
      <td style="${sc}text-align:center;">${rowNum}</td>
      <td style="${sc}text-align:center;font-weight:bold;">${esc(o.code)}</td>
      <td style="${sc}text-align:left;">${esc(o.address||"")}</td>
      <td style="${sc}text-align:left;">${esc(o.teller||"")}</td>
      <td style="${sc}text-align:right;">${betsVal}</td>
      <td style="${sc}text-align:right;">${payVal}</td>
      <td style="${sc}text-align:right;">${commVal}</td>
      <td style="${sc}text-align:right;">${palVal}</td>
      <td style="${sc}text-align:right;">${salVal}</td>
    </tr>`;
  });
  if(isLastChunk){
    A.collectors.forEach(c=>{
      h+=`<tr style="height:22px;">
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;padding:3px 5px;font-weight:bold;text-align:left;">${esc(c)}</td>
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;"></td>
        <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">500.00</td>
      </tr>`;
    });
    h+=`<tr style="height:26px;font-weight:bold;">
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">TOTAL</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.bets)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.pay)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.comm)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.pal)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.sal)}</td>
    </tr>
    <tr style="height:24px;font-weight:bold;">
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">COMMISSION</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.comm)}</td>
      <td style="border:none;"></td>
    </tr>
    <tr style="height:24px;font-weight:bold;">
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">TOTAL GROSS</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(t.gross)}</td>
      <td style="border:none;"></td>
    </tr>`;
  }
  h+=`</tbody></table>`;
  if(isLastChunk){
    const svName=SV[area]?.[0]||"PETER JOHN CARRILLO";
    h+=`<div style="margin-top:20px;padding-left:170px;">
      <div style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#02A5E3;font-weight:bold;">PREPARED BY:</div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:18px;color:#02A5E3;font-weight:bold;font-style:italic;margin-top:4px;">SV: ${esc(svName)}</div>
    </div>`;
  }
  h+=`</div>`;
  return h;
}

function buildAreaTableHtmlDDN(snap,col){
  const A=snap.areas.DDN,os=A.outlets.filter(o=>o.collector===col);
  const dateStr=dmy(snap.date);
  const colColor={JOHN:"#FF0000",JAYSON:"#E97132",MUHLEN:"#00B0F0",JASON:"#92D050","MAC²":"#FFFF00"}[col]||"#FF0000";
  const sumBets=os.reduce((s,x)=>s+x.bets,0),sumPay=os.reduce((s,x)=>s+x.pay,0),sumComm=sumBets*0.125,sumPal=sumBets-sumPay-sumComm,sumSal=os.reduce((s,x)=>s+x.sal,0);
  let h=`<div style="background:#ffffff;padding:16px;width:1300px;box-sizing:border-box;font-family:Calibri,Arial,sans-serif;">
    <table style="border-collapse:collapse;width:100%;font-size:11px;color:#000000;table-layout:fixed;">
      <colgroup>
        <col style="width:430px">
        <col style="width:250px">
        <col style="width:125px">
        <col style="width:115px">
        <col style="width:125px">
        <col style="width:130px">
        <col style="width:125px">
      </colgroup>
      <thead>
        <tr style="height:36px;">
          <th style="border:1px solid #bfbfbf;background:#CC99FF;font-size:18px;font-weight:bold;text-align:center;">DATE :</th>
          <th style="border:1px solid #bfbfbf;background:#99CCFF;font-size:18px;font-weight:bold;text-align:center;">${esc(dateStr)}</th>
          <th colspan="5" style="border:1px solid #bfbfbf;background:${colColor};font-size:20px;font-weight:bold;text-align:center;color:#000000;">${esc(col)}</th>
        </tr>
        <tr style="height:26px;font-size:12px;font-weight:bold;text-align:center;">
          <th style="border:1px solid #bfbfbf;background:#ffffff;">OUTLETS:</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">TELLER</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">TOTAL BETS</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">PAYOUTS</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">COMMISSION</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">PALAWAN</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">SALARY</th>
        </tr>
      </thead>
      <tbody>`;
  os.forEach(o=>{
    const isOff=!!o.off;
    const color=isOff?"#ff0000":"#000000";
    const bold=isOff?"font-weight:bold;":"";
    const sc=`border:1px solid #bfbfbf;padding:3px 5px;color:${color};${bold}`;
    const outletText=o.code+" "+(o.address||"");
    const betsVal=o.bets>0?money(o.bets):"0.00";
    const payVal=o.pay>0?"₱ "+money(o.pay):(isOff?"—":"₱ 0.00");
    const commVal=o.comm>0?"₱ "+money(o.comm):(isOff?"—":"₱ 0.00");
    const palVal=o.pal!==0?"₱ "+money(o.pal):(isOff?"—":"₱ 0.00");
    const salVal=o.sal>0?money(o.sal):"0";
    h+=`<tr style="height:22px;">
      <td style="${sc}text-align:left;">${esc(outletText)}</td>
      <td style="${sc}text-align:left;">${esc(o.teller||"")}</td>
      <td style="${sc}text-align:right;">${betsVal}</td>
      <td style="${sc}text-align:right;">${payVal}</td>
      <td style="${sc}text-align:right;">${commVal}</td>
      <td style="${sc}text-align:right;">${palVal}</td>
      <td style="${sc}text-align:right;">${salVal}</td>
    </tr>`;
  });
  h+=`<tr style="height:22px;">
      <td style="border:1px solid #bfbfbf;padding:3px 5px;font-weight:bold;text-align:left;">COLLECTOR</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;font-weight:bold;text-align:left;">${esc(col)}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;font-weight:bold;">₱ 500.00</td>
    </tr>
    <tr style="height:26px;font-weight:bold;">
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">TOTAL</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumBets)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumPay)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumComm)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumPal)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumSal+500)}</td>
    </tr>
    <tr style="height:24px;font-weight:bold;">
      <td colspan="4" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">COMMISSION</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumComm)}</td>
      <td style="border:none;"></td>
    </tr>
    <tr style="height:24px;font-weight:bold;">
      <td colspan="4" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">TOTAL GROSS</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumBets-sumPay)}</td>
      <td style="border:none;"></td>
    </tr></tbody></table></div>`;
  return h;
}

function buildAreaTableHtmlSamal(snap,col){
  const A=snap.areas.SAMAL,os=A.outlets.filter(o=>o.collector===col);
  const dateStr=dmy(snap.date);
  const sumBets=os.reduce((s,x)=>s+x.bets,0),sumPay=os.reduce((s,x)=>s+x.pay,0),sumComm=sumBets*0.125,sumPal=sumBets-sumPay-sumComm,sumSal=os.reduce((s,x)=>s+x.sal,0);
  let h=`<div style="background:#ffffff;padding:16px;width:1380px;box-sizing:border-box;font-family:Calibri,Arial,sans-serif;">
    <table style="border-collapse:collapse;width:100%;font-size:11px;color:#000000;table-layout:fixed;">
      <colgroup>
        <col style="width:45px">
        <col style="width:120px">
        <col style="width:380px">
        <col style="width:260px">
        <col style="width:120px">
        <col style="width:115px">
        <col style="width:120px">
        <col style="width:125px">
        <col style="width:95px">
      </colgroup>
      <thead>
        <tr style="height:36px;">
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;"></th>
          <th style="border:1px solid #bfbfbf;background:#b4e5a2;font-size:22px;font-weight:bold;text-align:center;">DATE</th>
          <th style="border:1px solid #bfbfbf;background:#a5c9ec;font-size:20px;font-weight:bold;text-align:center;">${esc(dateStr)}</th>
          <th colspan="5" style="border:1px solid #bfbfbf;background:#ffff00;font-size:20px;font-weight:bold;text-align:center;">SAMAL</th>
        </tr>
        <tr style="height:26px;font-size:12px;font-weight:bold;text-align:center;">
          <th style="border:1px solid #bfbfbf;background:#ffffff;">NO.</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">BOOTH CODE</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">ADDRESS</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">TELLER</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">TOTAL BETS</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">PAY OUT</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">COMMISSION</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">PALAWAN</th>
          <th style="border:1px solid #bfbfbf;background:#ffffff;">SALARY</th>
        </tr>
      </thead>
      <tbody>`;
  os.forEach((o,idx)=>{
    const isOff=!!o.off;
    const color=isOff?"#ff0000":"#000000";
    const bold=isOff?"font-weight:bold;":"";
    const sc=`border:1px solid #bfbfbf;padding:3px 5px;color:${color};${bold}`;
    const betsVal=o.bets>0?money(o.bets):"0.00";
    const payVal=o.pay>0?"₱ "+money(o.pay):(isOff?"—":"₱ 0.00");
    const commVal=o.comm>0?"₱ "+money(o.comm):(isOff?"—":"₱ 0.00");
    const palVal=o.pal!==0?"₱ "+money(o.pal):(isOff?"—":"₱ 0.00");
    const salVal=o.sal>0?money(o.sal):"0";
    h+=`<tr style="height:22px;">
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
  });
  h+=`<tr style="height:22px;">
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;font-weight:bold;text-align:left;">${esc(col)}</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">500.00</td>
    </tr>
    <tr style="height:26px;font-weight:bold;">
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">TOTAL</td>
      <td style="border:1px solid #bfbfbf;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumBets)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumPay)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumComm)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumPal)}</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumSal+500)}</td>
    </tr>
    <tr style="height:24px;font-weight:bold;">
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">COMMISSION</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumComm)}</td>
      <td style="border:none;"></td>
    </tr>
    <tr style="height:24px;font-weight:bold;">
      <td colspan="6" style="border:none;"></td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:left;">TOTAL GROSS</td>
      <td style="border:1px solid #bfbfbf;padding:3px 5px;text-align:right;">₱ ${money(sumBets-sumPay)}</td>
      <td style="border:none;"></td>
    </tr></tbody></table></div>`;
  return h;
}

function getScreenshotItems(snap,area){
  const items=[],A=snap.areas[area];
  const chunks=getSheet1Chunks(A.outlets,area);
  chunks.forEach((chunk,i)=>{
    const partNum=i+1;
    items.push({name:`Sheet1 Part ${partNum}`,filename:`0${partNum}_Sheet1_Part_${partNum}.png`,type:"sheet1",chunk});
  });
  let nextIdx=chunks.length+1;
  A.collectors.forEach(col=>{
    const prefix=nextIdx<10?`0${nextIdx}`:`${nextIdx}`;
    const safeCol=col.replace(/[^a-zA-Z0-9]/g,"2");
    let sheetName="",filename="";
    if(area==="DDN"){sheetName=`${col} NEW AREA`;filename=`${prefix}_${safeCol}_NEW_AREA.png`}
    else{sheetName=`${col} AREA`;filename=`${prefix}_${safeCol}_AREA.png`}
    items.push({name:sheetName,filename,type:"collector",col});
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
        let html="",renderWidth=1400;
        if(it.type==="sheet1"){html=buildSheet1ChunkHtml(snap,T.area,it.chunk.start,it.chunk.end,it.chunk.isLast);renderWidth=1400}
        else if(T.area==="DDN"){html=buildAreaTableHtmlDDN(snap,it.col);renderWidth=1320}
        else{html=buildAreaTableHtmlSamal(snap,it.col);renderWidth=1400}
        const stage=document.createElement("div");
        stage.style.position="fixed";stage.style.left="-99999px";stage.style.top="0px";stage.style.width=renderWidth+"px";stage.style.backgroundColor="#ffffff";stage.style.zIndex="-9999";
        stage.innerHTML=html;document.body.appendChild(stage);
        await new Promise(r=>setTimeout(r,60));
        const canvas=await html2canvas(stage,{scale:2,backgroundColor:"#ffffff",logging:false,windowWidth:renderWidth+100});
        document.body.removeChild(stage);
        const dataUrl=canvas.toDataURL("image/png");
        const blob=await new Promise(r=>canvas.toBlob(r,"image/png"));
        const record={...it,dataUrl,blob};generatedScreenshots.push(record);
        const card=document.createElement("div");
        card.className="box";card.style.margin="0";card.style.padding="10px";card.style.display="flex";card.style.flexDirection="column";card.style.gap="8px";
        card.innerHTML=`<div style="font-weight:bold;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(it.name)}">${esc(it.name)}</div>
          <div style="background:#000;border:1px solid var(--line);border-radius:6px;overflow:hidden;cursor:pointer;height:160px;display:flex;align-items:center;justify-content:center" class="thumb-wrap">
            <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain" alt="${esc(it.name)}">
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span style="font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(it.filename)}</span>
            <button class="ghost" style="padding:4px 8px;font-size:11px" data-dl>Download</button>
          </div>`;
        card.querySelector(".thumb-wrap").onclick=()=>{
          const w=window.open("");
          w.document.write(`<title>${esc(it.name)}</title><body style="margin:0;background:#18181b;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${dataUrl}" style="max-width:98%;max-height:98vh;box-shadow:0 8px 30px rgba(0,0,0,0.7);border-radius:4px"></body>`);
        };
        card.querySelector("[data-dl]").onclick=()=>{
          const a=document.createElement("a");a.href=dataUrl;a.download=it.filename;a.click();
        };
        sGrid.appendChild(card);
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

window.SALES={parseAccounting,compute,buildXlsx,msgText,salary};
window.MODS=Object.assign(window.MODS||{},{"SALES & COLLECTION":sales});
})();
