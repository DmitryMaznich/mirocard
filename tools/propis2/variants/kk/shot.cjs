const {chromium}=require('playwright');
(async()=>{const [,, svg, out, clip]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:1400},deviceScaleFactor:3});
const s=require('fs').readFileSync(svg,'utf8').replace(/<rect class="propis-text-word-hit"/g,'<rect style="display:none"');
await p.setContent(`<body style="margin:0;background:#fff"><div id=h style="width:1000px">${s}</div></body>`);
await p.evaluate(()=>{const e=document.querySelector('svg');e.removeAttribute('width');e.removeAttribute('height');e.style.width='1000px';e.style.height='auto'});
const [x,y,w,h]=clip.split(',').map(Number);
await p.screenshot({path:out,clip:{x,y,width:w,height:h}});await b.close();})()
