const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const OUT=path.resolve('out');for(const d of['svg','png','web'])fs.mkdirSync(path.join(OUT,d),{recursive:true});
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+path.resolve('kit.html'));await p.waitForFunction(()=>window.__done);const SV=await p.evaluate(()=>window.SV);
for(const[k,v]of Object.entries(SV))fs.writeFileSync(path.join(OUT,k),v+'\n');
// rasterise
async function png(svgFile,out,w,h,bg){const s=fs.readFileSync(path.join(OUT,svgFile),'utf8');const q=await b.newPage({viewport:{width:w,height:h}});
 await q.setContent(`<html><body style="margin:0;background:${bg||'transparent'}"><div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${s.replace('<svg ','<svg style="width:100%;height:100%" ')}</div></body></html>`);
 await q.screenshot({path:path.join(OUT,out),omitBackground:!bg});await q.close()}
await png('svg/app-icon.svg','png/app-icon-1024.png',1024,1024);
await png('svg/app-icon-light.svg','png/app-icon-light-1024.png',1024,1024);
await png('web/favicon.svg','fav-512.png',512,512);
for(const sfx of['for-dark-bg','for-light-bg']){await png(`svg/wordmark-${sfx}.svg`,`png/wordmark-${sfx}.png`,1736,464);await png(`svg/logo-stacked-${sfx}.svg`,`png/logo-stacked-${sfx}.png`,1736,600);await png(`svg/mark-${sfx}.svg`,`png/mark-${sfx}.png`,1080,680);await png(`svg/logo-horizontal-en-${sfx}.svg`,`png/logo-horizontal-en-${sfx}.png`,2232,408);}
// instagram profile (circle crop safe) & og image
const ig=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#0E2A47"/>${fs.readFileSync(path.join(OUT,'svg/mark-for-dark-bg.svg'),'utf8').replace(/^<svg[^>]*>/,'<svg x="22" y="38" width="76" height="44" viewBox="6 26 108 68">')}</svg>`;fs.writeFileSync(path.join(OUT,'ig.svg'),ig);
await png('ig.svg','png/instagram-profile-1080.png',1080,1080);fs.unlinkSync(path.join(OUT,'ig.svg'));
const og=await b.newPage({viewport:{width:1200,height:630}});const st=fs.readFileSync(path.join(OUT,'svg/logo-stacked-for-dark-bg.svg'),'utf8');
await og.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400&display=swap" rel="stylesheet"></head><body style="margin:0"><div style="width:1200px;height:630px;background:radial-gradient(90% 90% at 50% 40%,#164571 0%,#0E2A47 65%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Readex Pro'">${st.replace('<svg ','<svg style="width:720px" ')}<div dir="rtl" style="color:#C9D6E3;font-size:34px;margin-top:26px">شنو يصير لك؟ اكتب الاسمين وتعرف</div></div></body></html>`);
await og.evaluate(()=>document.fonts.ready);await og.waitForTimeout(500);await og.screenshot({path:path.join(OUT,'web/og-image.png')});
await b.close();console.log('done',Object.keys(SV).length)})()
