'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const W = 960, H = 640, SAVE_KEY = 'pony-quest-illustrated-v1';
  ctx.setTransform(2,0,0,2,0,0);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const fresh = () => ({version:2, actor:'pony', room:'lane', x:410, y:500, inventory:[], gateOpen:false,
    handoverPending:false, conePlaced:false, roadClosed:false, carrotTaken:false, ponySettled:false,
    statement:null, finished:false, started:false});
  let state = fresh(), saved = null;
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && ['lane','motorway'].includes(s.room) && Array.isArray(s.inventory)) {
      if (s.version === 2 && ['pony','paul'].includes(s.actor)) {
        saved = {...fresh(), ...s, inventory:[...new Set(s.inventory.filter(i => ['rope','cone','carrot'].includes(i)))]};
      } else {
        // Earlier pony-only saves resume at the handover, preserving the escape.
        saved = {...fresh(), started:!!s.started, gateOpen:!!s.gateOpen,
          room:s.gateOpen?'motorway':'lane', handoverPending:!!s.gateOpen,
          x:s.gateOpen?658:s.x, y:s.gateOpen?490:s.y,
          inventory:s.gateOpen?[]:s.inventory.filter(i=>i==='rope')};
      }
      if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y)) { saved.x=410; saved.y=500; }
    }
  } catch { /* Storage is optional, including for file:// play. */ }
  let ready=false, active=false, item=null, hovered=null, moving=false, inventoryOpen=false;
  let target=null, arrival=null, direction=1, walkDistance=0, speed=0, roomChanging=false;
  let queue=[], speechDone=null, speaking=false, choiceOpen=false, speechRemaining=0, speechCritical=false, currentSpeaker='', optionsOpen=false;
  let images={}, frames=[], paulFrames=[], lastTime=0, sound=false, audio=null, ambientTimer=null;
  const itemInfo={
    rope:{name:'rope',description:'A useful length of rope. Excellent for reaching things a small horse cannot.'},
    cone:{name:'cone',description:'The universal symbol for “somebody else is dealing with this”.'},
    carrot:{name:'carrot',description:'The innkeeper’s carrot. More persuasive than a strongly worded request.'}
  };
  const objects = {
    lane:[
      {id:'inn',name:'inn door',x:90,y:354,w:92,h:153,walk:[200,455]},
      {id:'sign',name:'pub sign',x:73,y:168,w:111,h:124,walk:[210,452]},
      {id:'rope',name:'length of rope',x:290,y:473,w:65,h:40,walk:[337,499],visible:()=>!has('rope')&&!state.gateOpen},
      {id:'gate',name:'gate latch',x:853,y:406,w:122,h:160,walk:[745,546]},
      {id:'path',name:'path to the motorway',x:494,y:356,w:83,h:60,walk:[462,452]},
      {id:'sky',name:'distant motorway',x:816,y:271,w:168,h:110,walk:[587,510]}
    ],
    motorway:[
      {id:'hut',name:'maintenance hut',x:234,y:281,w:114,h:190,walk:[290,439]},
      {id:'radio',name:'police radio',x:561,y:324,w:167,h:114,walk:[548,443]},
      {id:'road',name:'traffic checkpoint',x:726,y:413,w:87,h:108,walk:[649,473]},
      {id:'m25',name:'M25 sign',x:811,y:113,w:216,h:161,walk:[585,455]},
      {id:'back',name:'back to the country lane',x:183,y:438,w:105,h:66,walk:[202,443]},
      {id:'pony',name:'escaped pony',x:658,y:443,w:134,h:106,walk:[548,491],visible:()=>state.actor==='paul'}
    ]
  };
  function has(id){return state.inventory.includes(id)}
  function save(){
    if(!active)return;
    try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}
  }
  function worldObjects(){return objects[state.room].filter(o=>!o.visible||o.visible())}
  function setUIEnabled(enabled){
    $('inventory').inert=!enabled; $('hotspots').inert=!enabled; $('inventory-toggle').disabled=!enabled;
    $('hint').disabled=!enabled;
  }
  function updateUI(){
    $('stage').dataset.actor=state.actor;
    canvas.setAttribute('aria-label',`${state.room==='lane'?'Country lane':'Motorway'}. Playing as ${state.actor==='pony'?'the pony':'Paul Anthem'}. Click the ground to walk, or Tab through interactive objects.`);
    $('hotspots').replaceChildren();
    for(const o of worldObjects()){
      const b=document.createElement('button'); b.className='hotspot'; b.dataset.object=o.id;
      b.setAttribute('aria-label',o.name); b.title=o.name;
      Object.assign(b.style,{left:`${o.x/W*100}%`,top:`${o.y/H*100}%`,width:`${o.w/W*100}%`,height:`${o.h/H*100}%`});
      const marker=document.createElement('span'); marker.className='marker'; marker.ariaHidden='true';
      const label=document.createElement('span');label.className='hotspot-name';label.textContent=o.name;
      b.append(marker,label);b.addEventListener('pointerenter',()=>{hovered=o;sentence()});
      b.addEventListener('pointerleave',()=>{hovered=null;sentence()});
      b.addEventListener('focus',()=>{hovered=o;sentence()});
      b.addEventListener('blur',()=>{hovered=null;sentence()});
      bindInteraction(b,()=>interact(o),()=>interact(o,true));$('hotspots').append(b);
    }
    $('inventory').replaceChildren();
    if(!state.inventory.length){for(let i=0;i<3;i++){const slot=document.createElement('span');slot.className='empty-slot';slot.ariaHidden='true';$('inventory').append(slot)}}
    for(const id of state.inventory){
      const b=document.createElement('button');b.className='inventory-item'+(item===id?' selected':'');b.dataset.item=id;b.setAttribute('aria-label',itemInfo[id].name);b.setAttribute('aria-pressed',String(item===id));
      const c=document.createElement('canvas');c.width=48;c.height=48;c.ariaHidden='true';drawItem(c.getContext('2d'),id,0,0,48);
      b.title=itemInfo[id].name;b.append(c);
      bindInteraction(b,()=>{
        if(!canAct())return;
        if(item===id){clearAction();return}
        item=id;inventoryOpen=false;tone(420,.05,.015);updateUI();
      },()=>{if(canAct())say(itemInfo[id].description)});$('inventory').append(b);
    }
    $('inventory-toggle').classList.toggle('holding',!!item);
    $('selected-item').hidden=!item;$('bag-icon').toggleAttribute('hidden',!!item);
    if(item){const c=$('selected-item').getContext('2d');c.clearRect(0,0,48,48);drawItem(c,item,0,0,48)}
    $('options').hidden=!optionsOpen;$('options-toggle').setAttribute('aria-expanded',String(optionsOpen));
    $('inventory-panel').hidden=!inventoryOpen;
    $('inventory-toggle').setAttribute('aria-expanded',String(inventoryOpen));
    sentence();setUIEnabled(active&&!speechCritical&&!choiceOpen&&!roomChanging&&!state.handoverPending&&!state.finished);
  }
  function primaryAction(o){
    if(['sign','sky','m25','road'].includes(o.id))return 'Look at';
    if(['inn','radio','pony'].includes(o.id))return 'Talk to';
    if(o.id==='rope')return 'Pick up';
    if(['gate','hut'].includes(o.id))return 'Open';
    return 'Walk to';
  }
  function sentence(){
    $('command').textContent=item?`Use ${itemInfo[item].name} with ${hovered?.name||'…'}`:
      hovered?`${primaryAction(hovered)} ${hovered.name}`:'Click to walk · right-click to examine';

  }
  function clearAction(){item=null;hovered=null;updateUI()}
  // One primary action per hotspot; examination is optional and never blocks a puzzle.
  function bindInteraction(button,primary,examine){
    let timer=null,held=false;
    const cancelHold=()=>{clearTimeout(timer);timer=null};
    button.addEventListener('pointerdown',e=>{
      held=false;
      if(e.pointerType==='touch')timer=setTimeout(()=>{held=true;examine()},450);
    });
    button.addEventListener('pointerup',cancelHold);
    button.addEventListener('pointercancel',cancelHold);
    button.addEventListener('pointerleave',cancelHold);
    button.addEventListener('click',()=>{if(held){held=false;return}primary()});
    button.addEventListener('contextmenu',e=>{e.preventDefault();cancelHold();if(!held)examine()});
  }
  function canWalk(){return active&&ready&&!choiceOpen&&!roomChanging&&!state.handoverPending&&!state.finished&&!$('help-dialog').open}
  function canAct(){return canWalk()&&!speechCritical}
  function addItem(id){if(!has(id))state.inventory.push(id);inventoryOpen=true;tone(640,.1,.025);updateUI();save()}
  function removeItem(id){state.inventory=state.inventory.filter(i=>i!==id);if(item===id)item=null;updateUI();save()}

  function say(lines,done){
    queue=(Array.isArray(lines)?lines:[lines]).map(l=>typeof l==='string'?{who:state.actor==='pony'?'Pony':'Paul',text:l}:l);
    speechDone=done||null;speechCritical=!!done;nextSpeech();
  }
  function nextSpeech(){
    if(!speaking&&!queue.length)return;
    const line=queue.shift();
    if(!line){
      speaking=false;speechCritical=false;$('speech').hidden=true;
      const fn=speechDone;speechDone=null;updateUI();if(fn)fn();return;
    }
    speaking=true;currentSpeaker=line.who;
    const radio=['Control','Horse & Hound','Police radio'].includes(line.who);
    $('speech').dataset.voice=radio?'radio':line.who.startsWith('Innkeeper')?'innkeeper':line.who.toLowerCase();
    $('speech').hidden=false;$('speaker').textContent=line.who;
    $('radio-speaker').textContent=line.who;
    $('speech-text').textContent=line.text;
    speechRemaining=Math.max(2.4,Math.min(9,.9+line.text.length*.048));
    setUIEnabled(canAct());positionSpeech();
    if(radio)radioSquawk();else tone(line.who==='Pony'?370:230,.045,.012);
  }
  function positionSpeech(){
    if(!speaking||$('speech').dataset.voice==='radio')return;
    let x=state.x,y=state.y-actorHeight(state.actor,state.y)-16;
    if(currentSpeaker==='Pony'&&state.actor==='paul'){x=658;y=490-actorHeight('pony',490)-16}
    if(currentSpeaker.startsWith('Innkeeper')){x=130;y=270}
    const box=$('stage').getBoundingClientRect(),speech=$('speech');
    const half=speech.offsetWidth/box.width*W/2;
    x=Math.max(half+14,Math.min(W-half-14,x));
    const textHeight=speech.offsetHeight/box.height*H;
    y=Math.max(textHeight+15,Math.min(H-50,y));
    speech.style.left=`${x/W*100}%`;speech.style.top=`${y/H*100}%`;
  }
  function choices(options){
    stopWalk();choiceOpen=true;$('choices').hidden=false;$('choices').replaceChildren();
    options.forEach(o=>{const b=document.createElement('button');b.textContent='› '+o.text;b.onclick=()=>{choiceOpen=false;$('choices').hidden=true;updateUI();o.run()};$('choices').append(b)});
    setUIEnabled(false);$('choices').firstElementChild.focus({preventScroll:true});
  }
  const person=(who,text)=>({who,text});
  function interact(o,examine=false){
    if(!canAct()){if(canWalk())walkTo(...o.walk);return}
    optionsOpen=false;
    const action=examine?'Look at':item?'Use':primaryAction(o),used=examine?null:item;hovered=o;sentence();
    if(action==='Look at'){perform(o,action,used);return}
    walkTo(...o.walk,()=>perform(o,action,used));
  }
  function perform(o,action,used){
    clearAction();
    if(state.actor==='paul'){performPaul(o,action,used);return}
    if(used){
      if(used==='rope'&&o.id==='gate'){
        state.gateOpen=true;removeItem('rope');
        say(['Loop the rope over the latch. Pull with the teeth.','A triumph for the opposable lip.'],()=>changeRoom('motorway'));return;
      }
      say(used==='rope'?'I could tie that up. But it would not tie up the problem.':used==='cone'?'It needs to go at the traffic checkpoint. Somewhere officially inconvenient.':'I have big plans for this carrot. Mostly digestive.');return;
    }
    if(action==='Look at'){
      const descriptions={
        inn:'The Hare & Hounds. An establishment with a troublingly narrow view of its clientele.',
        sign:'Hare. Hounds. Not one mention of ponies. I shall be writing a letter.',
        rope:'A loose length of rope. Long enough to loop over that gate latch.',
        gate:state.gateOpen?'The latch is loose now. It just needs a push.':'A high latch. A low pony. A classic design failure.',
        path:state.gateOpen?'The service path leads straight to the motorway.':'The service path joins the gate. There is no sneaking around it.',
        sky:'A magnificent river of red lights. They must be going somewhere important.',
        hut:has('cone')||state.roadClosed?'A maintenance hut. Mostly cones, with a small amount of hut.':'The door is ajar. Inside: cones. Cones as far as the eye can see.',
        radio:'A police radio on the open car window. Someone called Paul is having a morning.',
        road:state.roadClosed?'The traffic is stopped. The cone has spoken.':'A gap in the barrier. It could use something orange and authoritative.',
        m25:'M25. London. Heathrow. None of these sound like a field.',
        back:'A quiet path back to the pub. Civilization, or a reasonable approximation.'
      };say(descriptions[o.id]);return;
    }
    switch(o.id){
      case 'rope':
        if(['Walk to','Pick up','Pull','Use'].includes(action)){addItem('rope');say('A little frayed. Like the patience of whoever owns this gate.')}
        else say('It is already quite open to suggestion. Pick it up.');break;
      case 'inn':
        if(['Talk to','Open','Walk to','Push','Pull'].includes(action)){
          say([person('Innkeeper, inside','If that is the milkman, you are early. If that is the pony, you are late.'),'Ahem. Neigh.'],()=>choices([
            {text:'Ask about the gate.',run:()=>say([person('Innkeeper','Latch sticks. Loop a bit of rope over it and give it a pull.'),'I appreciate a publican with practical advice for livestock.'])},
            {text:'Ask for breakfast.',run:()=>say([person('Innkeeper','Kitchen opens at seven. No hooves on the tables this time.'),'One incident. They never let you forget.'])},
            {text:'Leave with what remains of your dignity.',run:()=>say('Good day to you, too.')}
          ]));
        }else say('The pub is not portable. A pity.');break;
      case 'gate':case 'path':
        if(state.gateOpen){changeRoom('motorway');break}
        if(action==='Close'){say('Already closed. Infuriatingly thorough work.');break}
        say(['The latch is too high for my nose.','Something long and loopable might do the trick.']);break;
      case 'sign':say('A pub sign is not a useful travelling companion.');break;
      case 'sky':say('First the gate. Then the wider world. Then possibly breakfast.');break;

    }
  }
  function performPaul(o,action,used){
    if(used){
      if(used==='cone'&&o.id==='road'){
        state.conePlaced=true;removeItem('cone');save();
        say(['Checkpoint marked.','Now to ask Control to stop the traffic. A cone alone is not a police operation.']);return;
      }
      if(used==='carrot'&&o.id==='pony'){
        if(!state.roadClosed){say('Traffic first. I am not coaxing a pony towards a live carriageway.');return}
        state.ponySettled=true;removeItem('carrot');save();
        say(['There we are. A little cooperation.',person('Pony','*a very satisfied crunch*'),
          person('Control','Officers have the pony. We can lead it back to the field.'),
          'Good. That leaves the slightly more unpredictable animal: the press.']);return;
      }
      say(used==='cone'?'The cone belongs at the traffic checkpoint.':
        used==='carrot'?'This is for the pony. I can negotiate my own breakfast later.':
        'I do not think that is the answer.');return;
    }
    if(action==='Look at'){
      const description={
        inn:'The Hare & Hounds. Someone here must know where the pony came from. And what it eats.',
        sign:'The Hare & Hounds. We may have to add “& Pony” after today.',
        gate:'A rope over the latch. Teeth marks in the wood. This was a planned operation.',
        path:'The pony’s escape route. I can follow it back to the motorway.',
        sky:'Every one of those brake lights is a potential complaint.',
        hut:state.conePlaced||has('cone')?'Enough cones to close half of Berkshire. One will do.':'Roadworks supplies. There should be a cone inside.',
        radio:'My link to Control. And, inevitably, the press office.',
        road:state.roadClosed?'Control has held the traffic. We can approach the pony safely.':state.conePlaced?'The checkpoint is marked. Control still needs to hold the traffic.':'The checkpoint needs marking before Control can hold the traffic.',
        m25:'The M25. A difficult place to keep an incident discreet.',
        back:'The country lane. There is a pub, and possibly someone useful.',
        pony:state.ponySettled?'Calm, chewing, and under supervision. Better than most press conferences.':'Not frightened. Not especially remorseful, either. Perhaps hungry.'
      };say(description[o.id]||'Nothing useful there.');return;
    }
    switch(o.id){
      case 'inn':
        if(['Walk to','Talk to','Open','Push','Pull'].includes(action)){
          say([person('Innkeeper','You will be here about the pony.'),'Does it do this often?'],()=>choices([
            {text:'Have you got anything a pony would eat?',run:()=>{
              if(state.carrotTaken){say([person('Innkeeper','I already gave you my best carrot.'),state.ponySettled?'It was very well received.':'Right. Best put it to work.']);return}
              state.carrotTaken=true;addItem('carrot');
              say([person('Innkeeper','Here. A carrot. Works better than shouting.'),'I wish the press were this straightforward.']);
            }},
            {text:'How did it get out?',run:()=>say([person('Innkeeper','Rope over the latch. Clever little thing.'),'I am beginning to appreciate that.'])},
            {text:'I had better get back to it.',run:()=>say('Thank you. Hopefully the road will be open before breakfast.')}
          ]));
        }else say('I should knock. There are limits to my authority.');break;
      case 'gate':case 'path':changeRoom('motorway');break;
      case 'hut':
        if(['Open','Walk to','Pick up','Use','Push','Pull'].includes(action)){
          if(has('cone')||state.conePlaced){say('One cone is enough for this checkpoint.');break}
          addItem('cone');say('A traffic cone. Finally, a member of the team who stays where I put them.');
        }else say('Roadworks supplies. Opening the door would be a good start.');break;
      case 'radio':
        if(['Walk to','Talk to','Use','Open'].includes(action))talkRadio();
        else say('I need that where it is.');break;
      case 'road':say(state.roadClosed?'The traffic is being held. Now for the pony.':state.conePlaced?'Checkpoint marked. I should radio Control.':'I need a cone here, then permission from Control to hold the traffic.');break;
      case 'pony':
        if(action==='Pick up'){say('Small for a horse is not the same as small for a pocket.');break}
        if(['Push','Pull'].includes(action)){say('No wrestling. I need to persuade it.');break}
        say(state.ponySettled?['Stay there, please.',person('Pony','*contented chewing*')]:
          ['Hello. Would you consider returning to your field?',person('Pony','*an unimpressed snort*'),
            state.roadClosed?'A food-based argument, then.':'First I need the traffic stopped. Then I can tempt it closer.']);break;
      case 'back':changeRoom('lane');break;
      case 'sign':case 'sky':say('I should concentrate on the animal currently holding up the motorway.');break;
      default:say('That will not get the pony home.');
    }
  }
  function talkRadio(){
    if(!state.conePlaced){say([person('Control','Paul, mark the checkpoint with a cone. Then call us to hold the traffic.'),'Understood. The maintenance hut should have one.']);return}
    if(!state.roadClosed){
      state.roadClosed=true;save();updateUI();
      say(['Checkpoint marked. Please hold the traffic.',person('Control','Confirmed. Traffic held. You can approach the animal.'),'Now, what does a pony consider a reasonable offer?']);return;
    }
    if(!state.ponySettled){say([person('Control','Traffic is still held. Any progress with the pony?'),'We are exploring a carrot-based solution.',person('Control','Try the pub. Someone there must feed it.')]);return}
    say([person('Horse & Hound','Mr Anthem? We are reporting on the escaped Shetland. How would you describe its condition?')],()=>choices([
      {text:'Excited, rather than distressed.',run:()=>finish('excited')},
      {text:'The pony is assisting officers with their enquiries.',run:()=>finish('enquiries')},
      {text:'It wanted breakfast. We underestimated it.',run:()=>finish('breakfast')}
    ]));
  }
  const statements={
    excited:'He seemed excited rather than distressed.',
    enquiries:'The pony is assisting officers with their enquiries.',
    breakfast:'It wanted breakfast. We underestimated it.'
  };
  function finish(statement){
    state.statement=statement;
    const lines=statement==='excited'?[statements.excited]:[
      statements[statement],person('Horse & Hound','And was the pony distressed?'),
      'No. He seemed excited rather than distressed.'
    ];
    say([...lines,person('Horse & Hound','Thank you, Mr Anthem. Our readers will enjoy this one.'),
      'I rather suspect they will.'],()=>{state.finished=true;inventoryOpen=false;save();$('ending').hidden=false;updateUI();$('ending').scrollTop=0;$('ending').focus({preventScroll:true});tone(660,.3,.025)});
  }
  function showHandover(){
    stopWalk();state.handoverPending=true;save();$('handover').hidden=false;updateUI();
    $('play-paul').focus({preventScroll:true});
  }
  function playPaul(){
    if(!state.handoverPending)return;
    state.actor='paul';state.handoverPending=false;state.inventory=[];
    state.room='motorway';state.x=440;state.y=459;direction=1;walkDistance=0;
    $('handover').hidden=true;clearAction();save();
    say([person('Control','Paul? We have a pony on the M25. You are nearest.'),
      'I was told this was a media enquiry.',person('Control','It is. The media are enquiring why there is a pony on the M25.'),
      'Right. Secure the road. Recover the pony. Sound reassuring.']);
  }
  $('play-paul').onclick=playPaul;

  function constrain(x,y){
    if(state.room==='lane'){
      x=Math.max(185,Math.min(790,x));
      const min= x<420?452:452+(x-420)*.25;
      const max= x<450?515:Math.min(576,515+(x-450)*.2);
      return [x,Math.max(min,Math.min(max,y))];
    }
    x=Math.max(195,Math.min(710,x));
    return [x,Math.max(434,Math.min(482+(x-195)*.16,y))];
  }
  function walkTo(x,y,fn){
    [x,y]=constrain(x,y);target={x,y};arrival=fn||null;moving=true;
    if(Math.abs(x-state.x)>2)direction=x>state.x?1:-1;
  }
  function stopWalk(){moving=false;target=null;arrival=null;speed=0}
  async function changeRoom(room){
    stopWalk();optionsOpen=false;inventoryOpen=false;roomChanging=true;setUIEnabled(false);$('curtain').classList.add('closed');
    await new Promise(r=>setTimeout(r,reducedMotion.matches?0:220));
    state.room=room;state.x=room==='lane'?720:440;state.y=room==='lane'?540:459;direction=room==='lane'?-1:1;
    const escaped=room==='motorway'&&state.actor==='pony';
    if(escaped){state.x=658;state.y=490;state.handoverPending=true;}
    updateUI();save();$('curtain').classList.remove('closed');roomChanging=false;updateUI();
    if(escaped)say(['The M25. At last.','It looked smaller from the field.'],showHandover);
  }
  canvas.addEventListener('click',e=>{
    if(!canWalk())return;
    const r=canvas.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
    if(item)clearAction();
    inventoryOpen=false;optionsOpen=false;updateUI();walkTo(x,y);
  });
  $('options-toggle').onclick=()=>{optionsOpen=!optionsOpen;inventoryOpen=false;updateUI()};
  $('inventory-toggle').onclick=()=>{if(canAct()){inventoryOpen=!inventoryOpen;optionsOpen=false;updateUI()}};
  $('inventory-close').onclick=()=>{inventoryOpen=false;updateUI();$('inventory-toggle').focus()};
  $('hotspot-toggle').onclick=()=>{const on=$('stage').classList.toggle('show-hotspots');$('hotspot-toggle').setAttribute('aria-pressed',String(on))};
  $('help-toggle').onclick=()=>{optionsOpen=false;updateUI();$('help-dialog').showModal()};
  for(const b of document.querySelectorAll('.dialog-close,.dialog-done'))b.onclick=()=>$('help-dialog').close();
  $('fullscreen-toggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen()}catch{$('fullscreen-toggle').title='Fullscreen is unavailable in this browser'}};
  if(!document.fullscreenEnabled)$('fullscreen-toggle').hidden=true;
  $('hint').onclick=()=>{
    if(!canAct())return;
    optionsOpen=false;updateUI();
    const hint=state.actor==='pony'?(has('rope')?'Click the rope in your pockets, then click the gate latch.':'Pick up the loose rope on the path. A small horse needs a little extra reach.'):
      !state.conePlaced?(has('cone')?'Use the cone at the traffic checkpoint beside the barrier.':'Open the maintenance hut to get a cone.'):
      !state.roadClosed?'Talk to the police radio to have Control stop the traffic.':
      !state.ponySettled?(has('carrot')?'Give or use the carrot on the escaped pony.':'Return to the country lane. Talk to the innkeeper and ask for pony food.'):
      'Click the police radio. Horse & Hound is waiting for your account.';
    say(hint);
  };
  document.addEventListener('keydown',e=>{
    if($('help-dialog').open)return;
    const isButton=e.target.closest?.('button');
    if((e.key===' '||(e.key==='Enter'&&!isButton))&&speaking){e.preventDefault();nextSpeech();return}
    if(e.key==='Escape'){optionsOpen=false;inventoryOpen=false;clearAction();return}
    if(e.key.toLowerCase()==='h'&&active){$('hotspot-toggle').click();return}
    if(e.key.toLowerCase()==='i'&&canAct()){e.preventDefault();$('inventory-toggle').click();return}
    if(e.key.toLowerCase()==='e'&&canAct()){
      const focused=document.activeElement;
      const o=worldObjects().find(o=>o.id===focused?.dataset.object)||hovered;
      if(focused?.dataset.item)say(itemInfo[focused.dataset.item].description);
      else if(o)interact(o,true);
    }
  });
  $('start').onclick=()=>start(false);$('new-game').onclick=()=>start(true);$('replay').onclick=()=>start(true);
  function start(reset){
    if(!ready)return;
    state=(!reset&&saved)?{...saved,inventory:[...saved.inventory]}:fresh();saved=null;
    [state.x,state.y]=constrain(state.x,state.y);
    const intro=!state.started;state.started=true;active=true;queue=[];speaking=false;speechDone=null;speechCritical=false;choiceOpen=false;roomChanging=false;optionsOpen=false;stopWalk();
    $('speech').hidden=true;$('choices').hidden=true;$('title-screen').hidden=true;$('ending').hidden=!state.finished;$('handover').hidden=true;inventoryOpen=false;
    clearAction();save();
    if(state.handoverPending){showHandover();return}
    if(intro)say(['Some ponies dream of open fields.','I dream bigger.']);
  }

  // Small native pixel props remain separate, collectible objects rather than baked scenery.
  function drawItem(c,id,x,y,size){
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(size/48,size/48);c.imageSmoothingEnabled=false;
    if(id==='rope'){
      for(let ring=0;ring<3;ring++){
        for(let a=0;a<Math.PI*2;a+=.10){const px=Math.round(23+Math.cos(a)*(17-ring*4)),py=Math.round(26+Math.sin(a)*(11-ring*3));c.fillStyle='#49302a';c.fillRect(px-2,py,4,4);c.fillStyle=Math.floor(a*10)%2?'#b89051':'#dab679';c.fillRect(px,py,2,2)}
      }
      c.fillStyle='#8d653e';for(let i=0;i<14;i++)c.fillRect(34+Math.floor(i/5),29+i,3,2);
      c.fillStyle='#edcc8c';c.fillRect(12,19,3,2);c.fillRect(17,17,4,2);
    }else if(id==='cone'){
      c.fillStyle='#2c222b';c.fillRect(6,38,36,6);c.fillStyle='#6a4032';c.fillRect(8,36,32,4);
      for(let row=0;row<31;row++){const half=3+Math.floor(row/3);c.fillStyle=row>12&&row<20?'#dbceb4':'#c86324';c.fillRect(24-half,7+row,half*2,1);c.fillStyle=row>12&&row<20?'#fff0c9':'#f4a342';c.fillRect(24-half,7+row,3,1)}
      c.fillStyle='#ffe0a2';c.fillRect(22,6,4,2);
    }else if(id==='carrot'){
      c.fillStyle='#264934';c.fillRect(28,5,4,12);c.fillRect(32,8,8,4);c.fillStyle='#75a65c';c.fillRect(27,4,3,10);c.fillRect(32,5,3,9);c.fillRect(35,8,7,2);
      for(let i=0;i<24;i++){c.fillStyle='#a84b24';c.fillRect(14+Math.floor(i*.5),38-i,Math.max(2,Math.floor(i*.38)),2);c.fillStyle='#ef9a3f';c.fillRect(14+Math.floor(i*.5),37-i,Math.max(1,Math.floor(i*.24)),2)}
    }c.restore();
  }
  function draw(t){
    ctx.imageSmoothingEnabled=false;
    if(images[state.room])ctx.drawImage(images[state.room],0,0,W,H);
    else {ctx.fillStyle='#161622';ctx.fillRect(0,0,W,H)}
    if(!ready)return;
    if(state.room==='lane'&&!has('rope')&&!state.gateOpen)drawItem(ctx,'rope',261,448,59);
    if(state.room==='motorway'){
      // Lamp glints are separate from the static room artwork.
      if(!reducedMotion.matches){
        const pulse=Math.sin(t*.009)>0;
        ctx.globalAlpha=.55;ctx.fillStyle=pulse?'#ff7460':'#567bff';ctx.fillRect(pulse?528:563,294,19,3);ctx.globalAlpha=1;
      }
      if(state.conePlaced)drawItem(ctx,'cone',698,422,62);
    }
    const actors=[{x:state.x,y:state.y,type:state.actor,walking:moving,dir:direction}];
    if(state.actor==='paul'&&state.room==='motorway')actors.push({x:658,y:490,type:'pony',walking:false,dir:-1});
    actors.sort((a,b)=>a.y-b.y).forEach(drawActor);
    if(speaking&&$('speech').dataset.voice==='radio'&&state.room==='motorway'){
      ctx.save();ctx.strokeStyle='#a2f5ff';ctx.lineWidth=2;
      const phase=reducedMotion.matches?1:(Math.floor(t/140)%3)+1;
      for(let i=0;i<phase;i++){ctx.beginPath();ctx.arc(562,316,10+i*8,-.9,.9);ctx.stroke()}
      ctx.restore();
    }
    positionSpeech();
  }
  function actorHeight(type,y){return (type==='paul'?166:109)*(.84+(y-435)/260)}
  function drawActor(actor){
    const sheet=actor.type==='paul'?paulFrames:frames;
    if(!sheet.length)return;
    const cycleDistance=actor.type==='paul'?88:98;
    const index=actor.walking&&!reducedMotion.matches?Math.floor(walkDistance/cycleDistance*sheet.length)%sheet.length:2;
    const frame=sheet[index];
    const zoom=actorHeight(actor.type,actor.y)/frame.bodyHeight;
    ctx.fillStyle='#16102370';ctx.beginPath();ctx.ellipse(actor.x,actor.y-2,actor.type==='paul'?20:49,6,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(actor.x,actor.y);ctx.scale(actor.dir,1);
    ctx.drawImage(frame.image,-frame.anchorX*zoom,-frame.anchorY*zoom,frame.image.width*zoom,frame.image.height*zoom);ctx.restore();
  }
  function tick(t){
    const dt=Math.min((t-lastTime)/1000||0,.05);lastTime=t;
    const paused=$('help-dialog').open||document.hidden;
    if(moving&&target&&!paused){
      const dx=target.x-state.x,dy=target.y-state.y,d=Math.hypot(dx,dy);
      const cruise=state.actor==='paul'?120:130;
      speed=Math.min(cruise,speed+640*dt,Math.sqrt(2*600*d));
      const step=Math.min(d,speed*dt);
      if(d<.35||step>=d){state.x=target.x;state.y=target.y;const fn=arrival;stopWalk();save();if(fn)fn()}
      else{state.x+=dx/d*step;state.y+=dy/d*step;walkDistance+=step;}
    }
    if(speaking&&!paused){speechRemaining-=dt;if(speechRemaining<=0)nextSpeech()}
    draw(t);requestAnimationFrame(tick);
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load '+src));img.src=src})}
  function buildFrames(img){
    const result=[],atlas=document.createElement('canvas');atlas.width=img.width;atlas.height=img.height;
    const a=atlas.getContext('2d',{willReadFrequently:true});a.drawImage(img,0,0);
    const data=a.getImageData(0,0,atlas.width,atlas.height),p=data.data;
    for(let i=0;i<p.length;i+=4){if(p[i]>p[i+1]+65&&p[i+2]>p[i+1]+55)p[i+3]=0}
    a.putImageData(data,0,0);
    const cw=img.width/4,ch=img.height/2,regions=[];
    for(let n=0;n<8;n++){
      const sx=Math.round(n%4*cw),sy=Math.round(Math.floor(n/4)*ch);
      let bx=cw,by=ch,ex=0,ey=0;
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(p[((sy+y)*img.width+sx+x)*4+3]>0){bx=Math.min(bx,x);by=Math.min(by,y);ex=Math.max(ex,x);ey=Math.max(ey,y)}
      // Register on the head, not the silhouette of swinging limbs.
      let sum=0,count=0;
      const headBottom=by+(ey-by)*.19;
      for(let y=by;y<headBottom;y++)for(let x=bx;x<=ex;x++)if(p[((sy+y)*img.width+sx+x)*4+3]>0){sum+=x;count++}
      regions.push({sx,sy,bx,by,ex,ey,headX:sum/Math.max(1,count)});
    }
    const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
    const refHead=median(regions.map(r=>r.headX)),top=median(regions.map(r=>r.by));
    const bottom=median(regions.map(r=>r.ey)),bodyHeight=bottom-top+1;
    const center=median(regions.map(r=>(r.bx+r.ex)/2+refHead-r.headX));
    for(const r of regions){
      const f=document.createElement('canvas');f.width=Math.ceil(cw+80);f.height=Math.ceil(bodyHeight+64);
      f.getContext('2d').drawImage(atlas,r.sx,r.sy,cw,ch,40+refHead-r.headX,32-r.by,cw,ch);
      result.push({image:f,anchorX:40+center,anchorY:32+bodyHeight,bodyHeight});
    }
    return result;
  }
  function radioSquawk(){
    if(!sound||!audio)return;
    const duration=.18,buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);
    const samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.13;
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
    source.buffer=buffer;filter.type='bandpass';filter.frequency.value=1500;filter.Q.value=.8;
    gain.gain.setValueAtTime(.5,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    source.connect(filter).connect(gain).connect(audio.destination);source.start();
  }
  function tone(freq,duration,volume){
    if(!sound||!audio)return;
    const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.value=freq;
    gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
    osc.connect(gain).connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);
  }
  $('sound-toggle').onclick=async()=>{
    try{
      if(!audio){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('No Web Audio');audio=new AC()}
      sound=!sound;clearInterval(ambientTimer);
      if(sound){await audio.resume();tone(740,.16,.025);ambientTimer=setInterval(()=>{if(document.hidden)return;tone(state.room==='lane'?1150+Math.random()*450:110,.24,.013);},3400)}else await audio.suspend();
      $('sound-toggle').textContent=sound?'Sound on':'Sound off';$('sound-toggle').setAttribute('aria-pressed',String(sound));
    }catch{sound=false;$('sound-toggle').textContent='Sound unavailable';$('sound-toggle').disabled=true}
  };
  async function load(){
    try{
      const [lane,motorway,pony,paul]=await Promise.all([loadImage('assets/art/country-lane.png'),loadImage('assets/art/motorway.png'),loadImage('assets/art/pony-walk8.png'),loadImage('assets/art/paul-walk8.png')]);
      images={lane,motorway};frames=buildFrames(pony);paulFrames=buildFrames(paul);ready=true;
      $('start').disabled=false;$('start').textContent=saved?(saved.finished?'Read your headline':saved.handoverPending?'Continue as Paul':'Continue'):'Play';$('new-game').hidden=!saved;
      updateUI();
    }catch(error){$('load-status').hidden=false;$('load-status').textContent='Could not load the artwork. Please retry.';$('start').disabled=false;$('start').textContent='Retry loading';$('start').onclick=()=>{location.reload()};console.error(error)}
  }
  updateUI();load();requestAnimationFrame(tick);
})();
