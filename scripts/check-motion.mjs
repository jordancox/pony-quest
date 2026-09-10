import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();
try {
 await page.setViewport({width:1200,height:850});
 await page.evaluateOnNewDocument(()=>{
   const original=CanvasRenderingContext2D.prototype.drawImage,heads=new WeakMap();let nextID=0;
   window.motionSamples=[];
   CanvasRenderingContext2D.prototype.drawImage=function(...args){
     original.apply(this,args);
     const image=args[0];
     if(this.canvas.id!=='scene'||!(image instanceof HTMLCanvasElement)||args.length!==5)return;
     if(!heads.has(image)){
       const data=image.getContext('2d').getImageData(0,0,image.width,image.height).data;
       let top=image.height,bottom=0;
       for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(data[(y*image.width+x)*4+3]>0){top=Math.min(top,y);bottom=Math.max(bottom,y)}
       let total=0,count=0;
       for(let y=top;y<top+(bottom-top)*.19;y++)for(let x=0;x<image.width;x++)if(data[(y*image.width+x)*4+3]>0){total+=x;count++}
       heads.set(image,{head:total/count,id:nextID++});
     }
     const matrix=this.getTransform(),head=heads.get(image);
     window.motionSamples.push({type:image.width/image.height<1.2?'paul':'pony',id:head.id,x:matrix.e/2,y:matrix.f/2,headOffset:(args[1]+head.head*args[3]/image.width)*Math.sign(matrix.a),time:performance.now()});
   };
 });
 await page.goto(process.env.GAME_URL||'http://localhost:8090',{waitUntil:'networkidle0'});

 for(const actor of ['pony','paul']){
   await page.evaluate(actor=>localStorage.setItem('pony-quest-illustrated-v1',JSON.stringify({version:2,actor,room:actor==='pony'?'lane':'motorway',x:250,y:500,inventory:[],gateOpen:actor==='paul',started:true})),actor);
   await page.reload({waitUntil:'networkidle0'});
   await page.waitForFunction(()=>!document.querySelector('#start').disabled);
   await page.click('#start');await page.evaluate(()=>{window.motionSamples=[]});
   const target=await page.$eval('#scene',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width*650/960,y:r.y+r.height*500/640}});
   await page.mouse.click(target.x,target.y);await page.mouse.move(0,0);
   await page.waitForFunction(()=>Math.abs(JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).x-650)<1,{timeout:7000});
   const samples=await page.evaluate(actor=>window.motionSamples.filter(s=>s.type===actor&&s.x>270&&s.x<620),actor);
   const frames=new Set(samples.map(s=>s.id));
   assert.equal(frames.size,8,`${actor} must use all eight walk frames`);
   const offsets=samples.map(s=>s.headOffset),spread=Math.max(...offsets)-Math.min(...offsets);
   // Perspective introduces small continuous scale changes on the country-lane slope.
   assert.ok(spread<4,`${actor} head registration drift: ${spread.toFixed(2)} world pixels`);
   assert.ok(samples.length>45,`${actor} animation should render continuously`);
   console.log(`${actor}: eight frames, ${samples.length} rendered movement samples, head drift ${spread.toFixed(2)} world pixels.`);
 }

 console.log('PASS: anchored eight-frame cycles and smooth movement.');
}catch(error){console.error('Motion test:',error.message);throw error}finally{await browser.close()}
