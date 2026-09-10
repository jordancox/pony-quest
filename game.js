'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('scene'), ctx = canvas.getContext('2d');
  const W = 960, H = 640, SAVE_KEY = 'pony-quest-illustrated-v1';
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
  let target=null, arrival=null, direction=1, walkDistance=0, roomChanging=false;
  let queue=[], speechDone=null, speaking=false, choiceOpen=false;
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
    $('room-label').textContent=state.room==='lane'?'The country lane':'The motorway';
    $('chapter-label').textContent=state.actor==='pony'?'PROLOGUE · THE PONY':'PART ONE · PAUL ANTHEM';
    $('inventory-label').textContent=state.actor==='pony'?'POCKETS (METAPHORICAL)':"PAUL’S POCKETS";
    $('stage').dataset.actor=state.actor;
    canvas.setAttribute('aria-label',`${$('room-label').textContent}. Playing as ${state.actor==='pony'?'the pony':'Paul Anthem'}. Click the ground to walk, or Tab through the interactive object buttons.`);
    $('objective').textContent=state.finished?'The real story, preserved in Horse & Hound.':
      state.handoverPending?'The pony is free. Paul’s morning is about to change.':
      state.actor==='pony'?'Escape the gate. The wider world awaits.':
      !state.conePlaced?'Mark the checkpoint. Then radio Control.':
      !state.roadClosed?'Radio Control to hold the traffic.':
      !state.ponySettled?(has('carrot')?'Offer the carrot to the escaped pony.':'Find something to tempt the pony. Try the innkeeper.'):
      'The pony is safe. Horse & Hound is waiting on the radio.';
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
    if(!state.inventory.length){const p=document.createElement('p');p.className='empty-inventory';p.textContent=state.actor==='pony'?'Nothing but ambition.':'Not nearly enough equipment.';$('inventory').append(p)}
    for(const id of state.inventory){
      const b=document.createElement('button');b.className='inventory-item'+(item===id?' selected':'');b.dataset.item=id;b.setAttribute('aria-label',itemInfo[id].name);b.setAttribute('aria-pressed',String(item===id));
      const c=document.createElement('canvas');c.width=48;c.height=48;c.ariaHidden='true';drawItem(c.getContext('2d'),id,0,0,48);
      const name=document.createElement('span');name.textContent=itemInfo[id].name;b.append(c,name);
      bindInteraction(b,()=>{
        if(!canAct())return;
        if(item===id){clearAction();return}
        item=id;inventoryOpen=false;tone(420,.05,.015);updateUI();
      },()=>{if(canAct())say(itemInfo[id].description)});$('inventory').append(b);
    }
    $('inventory-count').textContent=String(state.inventory.length);
    $('inventory-panel').hidden=!inventoryOpen;
    $('inventory-toggle').setAttribute('aria-expanded',String(inventoryOpen));
    sentence();setUIEnabled(active&&!speaking&&!choiceOpen&&!roomChanging&&!state.handoverPending&&!state.finished);
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
    $('cancel-action').hidden=!item;
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
  function canAct(){return active&&ready&&!speaking&&!choiceOpen&&!roomChanging&&!state.handoverPending&&!state.finished&&!$('help-dialog').open}
  function addItem(id){if(!has(id))state.inventory.push(id);inventoryOpen=true;tone(640,.1,.025);updateUI();save()}
  function removeItem(id){state.inventory=state.inventory.filter(i=>i!==id);if(item===id)item=null;updateUI();save()}

  function say(lines,done){
    stopWalk();
    queue=(Array.isArray(lines)?lines:[lines]).map(l=>typeof l==='string'?{who:state.actor==='pony'?'Pony':'Paul',text:l}:l);
    speechDone=done||null;nextSpeech();
  }
  function nextSpeech(){
    const line=queue.shift();
    if(!line){speaking=false;$('speech').hidden=true;const fn=speechDone;speechDone=null;updateUI();if(fn)fn();return}
    speaking=true;$('speech').hidden=false;$('speaker').textContent=line.who;$('speech-text').textContent=line.text;
    $('speech-text').style.color=line.who==='Pony'?'#ffecb0':'#c6e5ec';setUIEnabled(false);tone(line.who==='Pony'?370:230,.045,.012);
  }
  function choices(options){
    choiceOpen=true;$('choices').hidden=false;$('choices').replaceChildren();
    options.forEach(o=>{const b=document.createElement('button');b.textContent='› '+o.text;b.onclick=()=>{choiceOpen=false;$('choices').hidden=true;updateUI();o.run()};$('choices').append(b)});
    setUIEnabled(false);$('choices').firstElementChild.focus({preventScroll:true});
  }
  const person=(who,text)=>({who,text});
  function interact(o,examine=false){
    if(!canAct())return;
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
  function stopWalk(){moving=false;target=null;arrival=null}
  async function changeRoom(room){
    stopWalk();roomChanging=true;setUIEnabled(false);$('curtain').classList.add('closed');
    await new Promise(r=>setTimeout(r,reducedMotion.matches?0:220));
    state.room=room;state.x=room==='lane'?720:440;state.y=room==='lane'?540:459;direction=room==='lane'?-1:1;
    const escaped=room==='motorway'&&state.actor==='pony';
    if(escaped){state.x=658;state.y=490;state.handoverPending=true;}
    updateUI();save();$('curtain').classList.remove('closed');roomChanging=false;updateUI();
    if(escaped)say(['The M25. At last.','It looked smaller from the field.'],showHandover);
  }
  canvas.addEventListener('click',e=>{
    if(speaking){nextSpeech();return}if(!canAct())return;
    const r=canvas.getBoundingClientRect(), x=(e.clientX-r.left)/r.width*W,y=(e.clientY-r.top)/r.height*H;
    if(item)clearAction();
    inventoryOpen=false;updateUI();walkTo(x,y);
  });
  $('speech-next').onclick=nextSpeech;
  $('cancel-action').onclick=()=>{if(canAct()){stopWalk();clearAction()}};
  $('inventory-toggle').onclick=()=>{if(canAct()){inventoryOpen=!inventoryOpen;updateUI()}};
  $('inventory-close').onclick=()=>{inventoryOpen=false;updateUI();$('inventory-toggle').focus()};
  $('hotspot-toggle').onclick=()=>{const on=$('stage').classList.toggle('show-hotspots');$('hotspot-toggle').setAttribute('aria-pressed',String(on))};
  $('help-toggle').onclick=()=>{$('help-dialog').showModal()};
  for(const b of document.querySelectorAll('.dialog-close,.dialog-done'))b.onclick=()=>$('help-dialog').close();
  $('fullscreen-toggle').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen()}catch{$('fullscreen-toggle').title='Fullscreen is unavailable in this browser'}};
  if(!document.fullscreenEnabled)$('fullscreen-toggle').hidden=true;
  $('hint').onclick=()=>{
    if(!canAct())return;
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
    if((e.key==='Enter'||e.key===' ')&&speaking&&!isButton){e.preventDefault();nextSpeech();return}
    if(e.key==='Escape'&&canAct()){stopWalk();inventoryOpen=false;clearAction();return}
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
    const intro=!state.started;state.started=true;active=true;queue=[];speaking=false;choiceOpen=false;roomChanging=false;stopWalk();
    $('speech').hidden=true;$('choices').hidden=true;$('title-screen').hidden=true;$('ending').hidden=!state.finished;$('handover').hidden=true;inventoryOpen=false;
    clearAction();save();
    if(state.handoverPending){showHandover();return}
    if(intro)say(['Some ponies dream of open fields.','I dream bigger.'],()=>updateUI());
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
  }
  function drawActor(actor){
    const scale=.84+(actor.y-435)/260;
    const sheet=actor.type==='paul'?paulFrames:frames;
    const frame=sheet[actor.walking&&!reducedMotion.matches?Math.floor(walkDistance/20)%sheet.length:0];
    if(!frame)return;
    const height=(actor.type==='paul'?166:109)*scale,width=height*frame.width/frame.height;
    ctx.fillStyle='#16102370';ctx.beginPath();ctx.ellipse(Math.round(actor.x),Math.round(actor.y-2),width*.39,6*scale,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(Math.round(actor.x),Math.round(actor.y));ctx.scale(actor.dir,1);
    ctx.drawImage(frame,Math.round(-width/2),Math.round(-height),Math.round(width),Math.round(height));ctx.restore();
  }

  function tick(t){
    const dt=Math.min((t-lastTime)/1000||0,.05);lastTime=t;
    if(moving&&target&&!speaking&&!$('help-dialog').open){
      const dx=target.x-state.x,dy=target.y-state.y,d=Math.hypot(dx,dy),step=165*dt;
      if(d<=step){state.x=target.x;state.y=target.y;const fn=arrival;stopWalk();save();if(fn)fn()}
      else{state.x+=dx/d*step;state.y+=dy/d*step;walkDistance+=step;}
    }
    draw(t);requestAnimationFrame(tick);
  }
  function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not load '+src));img.src=src})}
  function buildFrames(img){
    const result=[];
    // Chroma-key is performed once on load; all gameplay uses the cached sprite frames.
    const atlas=document.createElement('canvas');atlas.width=img.width;atlas.height=img.height;
    const a=atlas.getContext('2d',{willReadFrequently:true});a.drawImage(img,0,0);
    const data=a.getImageData(0,0,atlas.width,atlas.height),p=data.data;
    for(let i=0;i<p.length;i+=4){if(p[i]>p[i+1]+65&&p[i+2]>p[i+1]+55)p[i+3]=0}
    a.putImageData(data,0,0);
    const cell=img.width/4;
    for(let n=0;n<4;n++){
      let minX=Math.ceil(n*cell),maxX=Math.floor((n+1)*cell)-1,minY=0,maxY=img.height-1;
      let bx=maxX,by=maxY,ex=minX,ey=0;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){if(p[(y*img.width+x)*4+3]>0){bx=Math.min(bx,x);by=Math.min(by,y);ex=Math.max(ex,x);ey=Math.max(ey,y)}}
      const f=document.createElement('canvas');f.width=ex-bx+1;f.height=ey-by+1;
      f.getContext('2d').drawImage(atlas,bx,by,f.width,f.height,0,0,f.width,f.height);result.push(f);
    }
    return result;
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
      const [lane,motorway,pony,paul]=await Promise.all([loadImage('assets/art/country-lane.png'),loadImage('assets/art/motorway.png'),loadImage('assets/art/pony-key.png'),loadImage('assets/art/paul-key.png')]);
      images={lane,motorway};frames=buildFrames(pony);paulFrames=buildFrames(paul);ready=true;
      $('start').disabled=false;$('start').textContent=saved?(saved.finished?'Read your headline':saved.handoverPending?'Continue as Paul':'Continue adventure'):'Begin the adventure';$('new-game').hidden=!saved;
      updateUI();
    }catch(error){$('load-status').textContent='The artwork could not load. Check the connection, then retry.';$('start').disabled=false;$('start').textContent='Retry loading';$('start').onclick=()=>{location.reload()};console.error(error)}
  }
  updateUI();load();requestAnimationFrame(tick);
})();
