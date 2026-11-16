// 產生 24 組不同規範／載重／斷面組合的 Excel，供 verify_excel.py 以 LibreOffice 重算比對
const D=require('path').join(__dirname,'..','dist')+'/';for(const f of ['zip','calc','xlsx','docx','diagram','export'])require(D+f+'.js');
const fs=require('fs');const out=process.argv[2];
const cases=[];const codes=Object.keys(SteelCalc.CODES);
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const presets=SteelCalc.PRESETS;
for(let i=0;i<24;i++){const p=presets[i%presets.length];
 const x={code:codes[i%4],load:i%3==0?'double':'single',shape:i%5==0?'welded':'rolled',relative:i%7==0?'braced':'free',rotation:i%2?'yes':'no',
  d:p.d,bf:p.bf,tw:p.tw,tf:p.tf,r:i%5==0?6:p.r,Fy:[2500,3300,3500][i%3],E:2040000,P:Math.round(5+rnd()*60),N:[0,50,100,200,300][i%5],
  a:[0,100,p.d*0.4,p.d*0.75,p.d*1.2,3000][i%6],Lb:[1500,3000,4500,6000][i%4],M:Math.round(rnd()*80),sxMode:i%6==5?'manual':'auto',Sx:900};
 const r=SteelCalc.calculate(x);if(r.errors.length){console.error(i,r.errors);continue}
 fs.writeFileSync(out+'/c'+i+'.xlsx',SteelExport.buildExcel(r));
 cases.push({i,x,checks:r.checks.map(c=>({id:c.id,state:c.state,ratio:c.ratio,cap:c.cap})),steps:Object.fromEntries([...r.pre,...r.checks.flatMap(c=>c.steps)].map(s=>[s.key,s.value]))});}
fs.writeFileSync(out+'/cases.json',JSON.stringify(cases));
