import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || '/root/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
const page = await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('output',{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const speech=()=>page.waitForFunction(()=>!document.querySelector('#speech').hidden,{timeout:6000});
async function drain(){
  for(let i=0;i<10;i++){
    if(await page.$eval('#speech',el=>el.hidden))return;
    await page.keyboard.press('Space');await pause(35);
  }
  throw new Error('Dialogue did not drain');
}
async function clickObject(id){await page.click(`[data-object="${id}"]`);await speech()}
async function selectItem(id){
 if(await page.$eval('#inventory-panel',e=>e.hidden))await page.click('#inventory-toggle');
 await page.click(`[data-item="${id}"]`);
 assert.equal(await page.$eval('#inventory-panel',e=>e.hidden),true);
}
try{
 await page.setViewport({width:1440,height:1000,deviceScaleFactor:1});
 await page.goto(process.env.GAME_URL || 'http://localhost:8090',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.screenshot({path:'output/title-desktop.png'});
 await page.click('#start');
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'output/pony-speech-desktop.png'});
 assert.equal(await page.$eval('#speech',e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.waitForFunction(()=>document.querySelector('#speech-text').textContent==='I dream bigger.',{timeout:6000});
 await drain();
 await page.mouse.move(0,0);
 await page.screenshot({path:'output/country-lane-desktop.png'});
 assert.equal(await page.$('.room-caption'),null);
 assert.equal(await page.$('.masthead'),null);
 assert.equal(await page.$('footer'),null);
 assert.equal(await page.$('#inventory-label'),null);
 assert.equal(await page.$('#verbs'),null);
 // Examine object and NPC dialogue, then solve with the inventory.
 await page.click('[data-object="gate"]',{button:'right'});await speech();
 assert.match(await page.$eval('#speech-text',e=>e.textContent),/high latch/);await drain();
 await clickObject('inn');await drain();
 assert.equal(await page.$eval('#choices',e=>e.hidden),false);
 await page.click('#choices button');await drain();
 await clickObject('rope');await drain();
 assert.ok(await page.$('[data-item="rope"]'));
 await selectItem('rope');await page.click('[data-object="gate"]');await speech();await drain();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).room==='motorway');
 await speech();await drain();
 await page.waitForFunction(()=>!document.querySelector('#handover').hidden);
 assert.equal(await page.$eval('#stage',e=>e.dataset.actor),'pony');
 assert.equal(await page.$eval('#hotspots',e=>e.inert),true);
 assert.equal(await page.$('[data-item="rope"]'),null);
 await page.screenshot({path:'output/handover-desktop.png'});
 // Reload at the chapter boundary: it must not strand the pony on the motorway.
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.click('#start');assert.equal(await page.$eval('#handover',e=>e.hidden),false);
 await page.click('#play-paul');await drain();
 assert.equal(await page.$eval('#stage',e=>e.dataset.actor),'paul');
 assert.ok(await page.$('[data-object="pony"]'));
 assert.equal(await page.$$eval('.inventory-item',e=>e.length),0);
 await page.screenshot({path:'output/paul-motorway-desktop.png'});
 // Radio has a distinct source and does not stop the world or the player.
 await clickObject('radio');
 assert.equal(await page.$eval('#speech',e=>e.dataset.voice),'radio');
 await page.screenshot({path:'output/radio-speech-desktop.png'});
 const ground=await page.$eval('#scene',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width*360/960,y:r.y+r.height*500/640}});
 await page.mouse.click(ground.x,ground.y);
 await page.waitForFunction(()=>Math.abs(JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).x-360)<1,{timeout:4000});
 assert.equal(await page.$eval('#speech',e=>e.hidden),false);
 await drain();
 await page.click('[data-object="pony"]',{button:'right'});await speech();
 assert.equal(await page.$eval('#speech',e=>e.dataset.voice),'paul');
 await page.screenshot({path:'output/paul-speech-desktop.png'});await drain();
 // Paul's player identity and inventory survive reloads independently of the prologue.
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.click('#start');
 assert.equal(await page.$eval('#stage',e=>e.dataset.actor),'paul');
 await clickObject('hut');await drain();
 assert.ok(await page.$('[data-item="cone"]'));
 await selectItem('cone');await clickObject('road');await drain();
 assert.equal(await page.$('[data-item="cone"]'),null);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).roadClosed),false);
 // Paul retraces the pony's route and gets a carrot from the innkeeper.
 await page.click('[data-object="back"]');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).room==='lane');
 assert.equal(await page.$eval('#stage',e=>e.dataset.actor),'paul');
 await page.focus('[data-object="gate"]');await page.keyboard.press('e');await speech();
 assert.equal(await page.$eval('#speaker',e=>e.textContent),'Paul');
 assert.match(await page.$eval('#speech-text',e=>e.textContent),/Teeth marks/);await drain();
 await clickObject('inn');await drain();
 await page.click('#choices button');await drain();
 assert.ok(await page.$('[data-item="carrot"]'));
 await page.click('[data-object="path"]');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).room==='motorway');
 // An early carrot attempt is refused without consuming it; no dead end.
 await selectItem('carrot');await clickObject('pony');
 assert.match(await page.$eval('#speech-text',e=>e.textContent),/Traffic first/);await drain();
 assert.ok(await page.$('[data-item="carrot"]'));
 await clickObject('radio');await drain();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).roadClosed),true);
 await selectItem('carrot');await clickObject('pony');await drain();
 assert.equal(await page.$('[data-item="carrot"]'),null);
 const pressSave=await page.evaluate(()=>localStorage.getItem('pony-quest-illustrated-v1'));
 await clickObject('radio');await drain();
 await page.click('#choices button');await drain();
 await page.waitForFunction(()=>!document.querySelector('#ending').hidden);
 assert.equal(await page.$eval('#ending-headline',e=>e.textContent),'Loose Shetland closes M25');
 assert.match(await page.$eval('#ending',e=>e.textContent),/Horse & Hound/);
 assert.equal(await page.$eval('#article-source',e=>e.href),'https://www.horseandhound.co.uk/news/loose-shetland-closes-m25-41577');
 assert.match(await page.$eval('#ending-quote',e=>e.textContent),/He seemed excited rather than distressed/);
 await page.screenshot({path:'output/ending-desktop.png'});
 // Different banter must still end with the real Horse & Hound report.
 await page.evaluate(s=>localStorage.setItem('pony-quest-illustrated-v1',s),pressSave);
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.click('#start');await clickObject('radio');await drain();
 await page.click('#choices button:nth-child(3)');await drain();
 assert.equal(await page.$eval('#ending-headline',e=>e.textContent),'Loose Shetland closes M25');
 await page.click('#replay');await drain();
 assert.match(await page.$eval('#scene',e=>e.getAttribute('aria-label')),/Country lane/);
 assert.equal(await page.$$eval('.inventory-item',e=>e.length),0);
 await page.keyboard.press('h');assert.equal(await page.$eval('#hotspot-toggle',e=>e.getAttribute('aria-pressed')),'true');
 await page.keyboard.press('h');
 await page.click('#options-toggle');await page.click('#help-toggle');assert.ok(await page.$eval('#help-dialog',e=>e.open));await page.keyboard.press('Escape');
 await page.click('#options-toggle');await page.click('#sound-toggle');assert.equal(await page.$eval('#sound-toggle',e=>e.textContent),'Sound on');await page.click('#sound-toggle');
 // Migrate the previous pony-only game's completed save into the new chapter boundary.
 await page.evaluate(()=>localStorage.setItem('pony-quest-illustrated-v1',JSON.stringify({room:'motorway',x:500,y:480,inventory:['carrot'],gateOpen:true,roadClosed:true,finished:true,started:true})));
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.click('#start');assert.equal(await page.$eval('#handover',e=>e.hidden),false);
 await page.click('#play-paul');await drain();
 assert.equal(await page.$eval('#stage',e=>e.dataset.actor),'paul');
 assert.equal(await page.$$eval('.inventory-item',e=>e.length),0);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('pony-quest-illustrated-v1')).roadClosed),false);
 // Touch layout: no overflow, same interaction surface, readable controls.
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
 await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.screenshot({path:'output/title-mobile.png'});
 await page.tap('#start');await pause(150);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'output/paul-mobile.png'});
 await page.tap('#options-toggle');await page.tap('#hint');await speech();await drain();
 // Optional examination works on touch without activating the primary interaction.
 const sign=await page.$eval('[data-object="m25"]',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}});
 await page.touchscreen.touchStart(sign.x,sign.y);await pause(550);await page.touchscreen.touchEnd();
 await speech();assert.match(await page.$eval('#speech-text',e=>e.textContent),/difficult place/);await drain();
 await page.tap('#inventory-toggle');assert.equal(await page.$eval('#inventory-panel',e=>e.hidden),false);
 await page.tap('#inventory-close');assert.equal(await page.$eval('#inventory-panel',e=>e.hidden),true);
 await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:1});await pause(150);
 await page.screenshot({path:'output/paul-landscape.png'});
 // The long article is scrollable and its source/replay links remain reachable on small screens.
 await page.evaluate(s=>localStorage.setItem('pony-quest-illustrated-v1',JSON.stringify({...JSON.parse(s),finished:true,statement:'excited'})),pressSave);
 await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
 await page.tap('#start');
 assert.equal(await page.$eval('#ending',e=>e.hidden),false);
 await page.screenshot({path:'output/ending-landscape.png'});
 await page.$eval('#article-source',e=>e.scrollIntoView());
 const sourceVisible=await page.$eval('#article-source',e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight});
 assert.equal(sourceVisible,true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const bounds=await page.$eval('.cabinet',e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom,height:innerHeight}));
 assert.ok(bounds.top>=0&&bounds.bottom<=bounds.height,'Landscape cabinet must fit vertically');
 assert.deepEqual(errors,[]);
 console.log('PASS: full game with contextual clicks, item tray, right-click/keyboard/touch examination, pony-to-Paul handover, safe recovery, fixed Horse & Hound ending, source link, save migration and responsive layouts; no browser errors.');
} catch(error) {
 console.error('Playthrough failed:',error.message);
 if(!page.isClosed()){await page.screenshot({path:'output/test-failure.png'});console.error(await page.evaluate(()=>({save:localStorage.getItem('pony-quest-illustrated-v1'),speech:document.querySelector('#speech-text').textContent,speechHidden:document.querySelector('#speech').hidden,inventory:document.querySelector('#inventory-panel').hidden,inventoryDisabled:document.querySelector('#inventory-toggle').disabled})));}
 throw error;
} finally {await browser.close()}
