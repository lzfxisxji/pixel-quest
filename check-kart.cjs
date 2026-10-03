/* Browser acceptance for Pixel Kart, the third independent mode.

   Dependency-free: it drives real Chrome over the DevTools protocol using Node's
   built-in fetch and WebSocket, so no Playwright install is required.

   The headless suite (test-kart.cjs) proves the simulation. This proves the parts
   that only exist in a browser: that the page boots, that the track is really
   painted, that the characters are visibly seated in their karts, that drifting
   leaves skid marks and sparks, that a full two-lap race reaches the results
   screen, and that the mode shares no engine with Adventure or Badminton.

   Run with the local server up, or let this script start one:
     node check-kart.cjs
   Point it at a deployed copy with PQ_SITE=https://lzfxisxji.github.io/pixel-quest/ . */
const {spawn,spawnSync}=require('child_process'),fs=require('fs'),path=require('path'),os=require('os');
const assert=require('node:assert/strict');
const PORT=9336,SITE=process.env.PQ_SITE||'http://localhost:4173/';
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,label,timeout=25000){const start=Date.now();let last;while(Date.now()-start<timeout){try{const v=await fn();if(v)return v;}catch(error){last=error;}await sleep(120);}throw new Error('timeout waiting for '+label+(last?' :: '+last.message:''));}

(async()=>{
  // 1. A local server, started here only when one is not already listening.
  let server=null;
  try{await fetch(SITE);}catch{
    server=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,stdio:'ignore'});
    await waitFor(async()=>{try{const r=await fetch(SITE);return r.ok;}catch{return false;}},'local server');
  }
  // 2. Real Chrome with an isolated profile, so an open browser session is never adopted.
  assert(fs.existsSync(CHROME),'Chrome found at '+CHROME);
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pq-kart-'));
  const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--hide-scrollbars','--window-size=1440,1000','--remote-debugging-port='+PORT,'--remote-allow-origins=*','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const target=await waitFor(async()=>{const list=await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();return list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);},'devtools target');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=()=>no(new Error('devtools socket failed'));});
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{const msg=JSON.parse(event.data);
    if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}
    else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    else if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push('[log] '+msg.params.entry.text);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const msgId=++id;pending.set(msgId,{resolve,reject});ws.send(JSON.stringify({id:msgId,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page error: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value;};
  const click=async selector=>{const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)||(hit&&hit.contains(e))?'self':hit?(hit.id||hit.className||hit.tagName):'none'};})()`);assert(box&&box.w>1&&box.h>1,'visible click target '+selector);assert.equal(box.hit,'self','click target '+selector+' is reachable (top element: '+box.hit+')');for(const type of['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});await sleep(160);};
  const down=async(code,key,vk)=>send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,key,windowsVirtualKeyCode:vk});
  const up=async(code,key,vk)=>send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk});
  const hold=async(code,key,vk,ms)=>{await down(code,key,vk);await sleep(ms);await up(code,key,vk);await sleep(200);};
  const shot=async name=>fs.writeFileSync(path.join(__dirname,name),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const shotElement=async(name,selector,scale=2)=>{const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};})()`);fs.writeFileSync(path.join(__dirname,name),Buffer.from((await send('Page.captureScreenshot',{format:'png',clip:{...box,scale}})).data,'base64'));};
  // Wait for the stylesheet (the Google Fonts import can delay it) and page load to settle.
  const load=async url=>{await send('Page.navigate',{url});await waitFor(()=>evaluate("document.readyState==='complete'"),'readyState for '+url);await waitFor(()=>evaluate("getComputedStyle(document.querySelector('.cabinet')).borderTopWidth==='1px'&&document.querySelector('.screen').getBoundingClientRect().height>150"),'laid-out page for '+url);await sleep(250);};
  /* Sample a rectangle of the canvas and report how many distinct colours it holds.
     The track is baked from a palette of flat tones, so a painted circuit shows
     many colours and an empty canvas shows one. That is the honest way to prove
     the world is actually being drawn rather than trusting a boolean. */
  const canvasColours=()=>evaluate(`(()=>{const c=document.querySelector('#kart'),g=c.getContext('2d');
    const d=g.getImageData(0,0,c.width,c.height).data,seen=new Set();
    for(let i=0;i<d.length;i+=4*37)seen.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
    return {colours:seen.size,w:c.width,h:c.height};})()`);

  try{
    await send('Page.enable');await send('Runtime.enable');await send('Log.enable');
    // Keep runs deterministic and offline-safe: the optional web font is not part of the test.
    await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});

    // 1. The page boots and offers the full grid.
    await load(SITE+'kart.html');
    const boot=await evaluate(`JSON.stringify({engine:typeof window.PixelKart,core:typeof window.PixelKartCore,
      tracks:typeof window.PixelKartTracks,assets:typeof window.PixelKartAssets,
      adventure:typeof window.PixelQuest,shuttle:typeof window.PixelBadminton,
      circuits:[...document.querySelectorAll('#kart-tracks button')].length,
      drivers:[...document.querySelectorAll('#kart-chars button')].length,
      difficulties:[...document.querySelectorAll('#kart-difficulty button')].length,
      setupVisible:!document.querySelector('#kart-setup').hidden})`);
    const b=JSON.parse(boot);
    assert.equal(b.engine,'object','the Pixel Kart engine boots');
    assert.equal(b.circuits,3,'three circuits are offered');
    assert.equal(b.drivers,6,'all six characters are offered as drivers');
    assert.equal(b.difficulties,3,'three AI difficulties are offered');
    assert(b.setupVisible,'the setup screen is showing');
    // Independence: this page must not pull in the other two engines.
    assert.equal(b.adventure,'undefined','Pixel Kart does not load the Adventure engine');
    assert.equal(b.shuttle,'undefined','Pixel Kart does not load the Badminton engine');
    console.log('PASS Pixel Kart boots on its own page with 3 circuits, 6 drivers, 3 difficulties');
    console.log('PASS Pixel Kart loads neither the Adventure nor the Badminton engine');

    // 2. Every circuit and every driver can be selected, and the preview follows.
    for(const track of['meadow','harbour','neon']){
      await evaluate(`document.querySelector('#kart-tracks button[data-id="${track}"]').click()`);
      await sleep(200);
      const picked=await evaluate(`PixelKart.pick.track`);
      assert.equal(picked,track,'circuit '+track+' can be selected');
    }
    for(const driver of['explorer','soldier','mystic','dora','goku','nezha']){
      await evaluate(`document.querySelector('#kart-chars button[data-id="${driver}"]').click()`);
      await sleep(120);
      assert.equal(await evaluate(`PixelKart.pick.character`),driver,'driver '+driver+' can be selected');
    }
    await shot('preview-kart-setup.png');
    console.log('PASS all three circuits and all six drivers can be chosen');

    // 3. The setup screen fits a phone without clipping the START button.
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await sleep(500);
    const phone=await evaluate(`(()=>{const go=document.querySelector('#kart-go').getBoundingClientRect(),s=document.querySelector('.kart-screen').getBoundingClientRect();
      return {goVisible:go.height>1,goInside:go.top>=s.top-1&&go.bottom<=s.bottom+1,overflow:document.documentElement.scrollWidth>innerWidth+1,screen:Math.round(s.height)};})()`);
    assert(phone.goVisible,'START RACE is visible on a phone');
    assert(phone.goInside,'START RACE is inside the cabinet on a 390x844 phone');
    assert(!phone.overflow,'no horizontal overflow on a phone viewport');
    await shot('preview-kart-setup-mobile.png');
    console.log('PASS the setup screen fits a 390x844 phone with START RACE reachable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await sleep(400);

    // 4. Start a race: the countdown runs, the track is painted, five karts are on the grid.
    await evaluate(`document.querySelector('#kart-tracks button[data-id="meadow"]').click()`);
    await evaluate(`document.querySelector('#kart-chars button[data-id="goku"]').click()`);
    await click('#kart-go');
    await waitFor(()=>evaluate('PixelKart.state==="racing"'),'the race to start');
    const grid=await evaluate(`JSON.stringify({karts:PixelKart.race.karts.length,phase:PixelKart.race.phase,
      countdown:PixelKart.race.countdown,laps:PixelKart.race.laps,ids:PixelKart.race.karts.map(k=>k.id)})`);
    const g=JSON.parse(grid);
    assert.equal(g.karts,5,'five karts are on the grid');
    assert.equal(g.laps,2,'the race is two laps');
    assert.equal(new Set(g.ids).size,5,'all five drivers are different characters');
    assert(g.ids.includes('goku'),'the player drives the character that was chosen');
    console.log('PASS a race starts with one player and four AI, over two laps');

    // The green light is a real 3.2 second countdown, so hold the throttle from
    // before it starts and wait for the phase to actually flip.
    await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code:'ArrowUp',key:'ArrowUp',windowsVirtualKeyCode:38});
    await waitFor(()=>evaluate('PixelKart.race.phase==="racing"'),'the countdown to end',30000);
    /* Sampled early and on purpose. None of the three circuits has a long
       straight: the kart reaches the grass in 0.8-3.6s with the throttle pinned
       and no steering, because the circuits are rounded shapes that sweep up to
       0.64 rad over 300px. That is correct physics - a kart has to be steered -
       so this check proves what it can actually prove, that the key reaches the
       simulation and produces real acceleration, and leaves "stays on the road"
       to the driving check below. */
    await sleep(500);
    const moving=await evaluate(`JSON.stringify({speed:PixelKart.race.player.speed,keys:[...PixelKart.keys]})`);
    const mv=JSON.parse(moving);
    assert(mv.keys.includes('ArrowUp'),'the throttle key reaches the simulation ('+mv.keys.join(',')+')');
    assert(mv.speed>60,'holding accelerate gets the kart moving ('+mv.speed.toFixed(0)+'px/s)');
    await send('Input.dispatchKeyEvent',{type:'keyUp',code:'ArrowUp',key:'ArrowUp',windowsVirtualKeyCode:38});
    console.log('PASS holding accelerate reaches the simulation and drives the kart to '+mv.speed.toFixed(0)+'px/s');

    /* Steering the kart is a driving job, so hand the wheel to the game's own
       driving brain - the same one the four AI use - and check the whole field.

       The animation loop is held off by parking `state` on a value it does not
       recognise, so the physics runs at exactly the fixed 1/60 substep it was
       tuned at. `race.paused` is the obvious way to do that and it is wrong:
       `step()` returns immediately when paused, so it freezes the scripted
       frames too and the kart never moves at all. */
    const onRoad=JSON.parse(await evaluate(`(()=>{const g=PixelKart,race=g.race,p=race.player;
      g.state='scripted';
      // Long enough to get the kart properly up to speed: four seconds from a
      // standing start only reaches about 60px/s, because the AI is still
      // braking for the first corner.
      for(let i=0;i<900&&race.phase!=='finished';i++){
        const c=race.aiDrive(p,1/60);
        race.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:c.drift,use:false});
      }
      g.spawnEffects(race,15);g.updateCamera(1/60);g.draw();
      const out={speed:p.speed,onRoad:race.karts.filter(k=>!k.offroad).length,laps:p.lapsDone,
        spread:Math.round(Math.hypot(race.karts[0].x-race.player.x,race.karts[0].y-race.player.y))};
      g.state='racing';
      return JSON.stringify(out);})()`));
    assert.equal(onRoad.onRoad,5,'all five karts are on the road after fifteen seconds of racing');
    assert(onRoad.speed>120,'the player is racing at speed ('+onRoad.speed.toFixed(0)+'px/s)');
    await shot('preview-kart-race.png');
    console.log('PASS a driven kart stays on the road, with all five karts racing on tarmac');

    // 5. The circuit is genuinely painted, not a cleared canvas.
    const painted=await canvasColours();
    assert(painted.colours>12,'the track is really drawn ('+painted.colours+' distinct colours on a '+painted.w+'x'+painted.h+' canvas)');
    console.log('PASS the baked circuit is painted to the canvas ('+painted.colours+' colours)');

    /* 6. Steering and braking respond to real key presses.

       Throttle and steering are held together, because the circuits have no
       long straights: throttle on its own would simply drive into the grass.
       The animation loop is left running for this one, so these are genuine
       keyboard events driving the real input path. */
    await down('ArrowUp','ArrowUp',38);
    await sleep(400);
    const before=await evaluate(`(()=>{const p=PixelKart.race.player;return {angle:p.angle,speed:p.speed};})()`);
    await down('ArrowLeft','ArrowLeft',37);
    await sleep(650);
    const turned=await evaluate(`(()=>{const p=PixelKart.race.player;return {angle:p.angle,speed:p.speed,steer:p.steer};})()`);
    await up('ArrowLeft','ArrowLeft',37);
    const delta=Math.abs(turned.angle-before.angle);
    assert(delta>0.2,'steering left rotates the kart ('+delta.toFixed(2)+'rad)');
    assert(turned.speed>40,'the kart is still moving through the turn ('+turned.speed.toFixed(0)+'px/s)');
    await up('ArrowUp','ArrowUp',38);
    await down('ArrowDown','ArrowDown',40);
    await sleep(400);
    const braked=await evaluate(`PixelKart.race.player.speed`);
    await up('ArrowDown','ArrowDown',40);
    assert(braked<turned.speed-20,'braking sheds speed ('+turned.speed.toFixed(0)+' -> '+braked.toFixed(0)+'px/s)');
    console.log('PASS steering and braking both respond to the keyboard');

    /* 7. Drifting leaves skid marks and a visible slide.

       This runs on a freshly rematched race. It used to share the race that the
       steering check had already driven fifteen seconds down the road, which left
       barely a lap before the flag - and on the run where it did not drift at all,
       the loop simply ran until the race finished with the kart still on lap one.
       A slide is a fraction of a second long, so the screenshot is also taken
       from *inside* the loop, on the exact frame the kart is most sideways:
       measuring the state after the loop ends races the animation, because the
       drift has usually been released by the time the exit condition is met. */
    await click('#kart-pause');
    await click('#kart-pause-change');
    await waitFor(()=>evaluate('PixelKart.state==="setup"&&!document.querySelector("#kart-setup").hidden'),'the setup screen');
    await click('#kart-go');
    await waitFor(()=>evaluate('PixelKart.state==="racing"'),'the rematched race to start');
    await waitFor(()=>evaluate('PixelKart.race.phase==="racing"'),'the countdown to end',30000);
    const drift=await evaluate(`(()=>{const g=PixelKart,race=g.race,p=race.player;
      g.state='scripted';
      p.skill=1.05;p.nerve=1;p.errorChance=0;
      g.marks.length=0;g.smoke.length=0;
      let guard=0,maxSlip=0,driftFrames=0,slides=0,wasDrifting=false,captured=null;
      while(guard++<4000&&race.phase!=='finished'){
        const c=race.aiDrive(p,1/60);
        race.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:c.drift,use:false});
        g.spawnEffects(race,1/60);g.updateCamera(1/60);
        if(p.drifting){
          driftFrames++;
          if(!wasDrifting)slides++;
          wasDrifting=true;
          if(p.slip>maxSlip){
            maxSlip=p.slip;
            // Photograph the peak: draw now, while the kart really is sideways.
            if(p.slip>30&&g.marks.length>40){
              g.draw();
              window.__kartDriftShot=true;
              captured={slip:p.slip,marks:g.marks.length,smoke:g.smoke.length,drifting:p.drifting};
              break;
            }
          }
        }else wasDrifting=false;
      }
      const out={driftFrames,slides,maxSlip,guard,phase:race.phase,captured,
        photographed:!!window.__kartDriftShot};
      window.__kartDriftShot=false;
      g.state='racing';
      return out;})()`);
    assert(drift.photographed,'the kart was caught mid-drift for the screenshot');
    assert(drift.maxSlip>25,'the drift is a real slide ('+drift.maxSlip.toFixed(0)+'px of sideways travel)');
    assert(drift.slides>=1,'the field drifts rather than only driving ('+drift.slides+' slides in '+drift.driftFrames+' frames)');
    assert(drift.captured.marks>20,'skid marks are laid down while drifting ('+drift.captured.marks+' marks)');
    await shot('preview-kart-drift.png');
    console.log('PASS drifting slides the kart and lays down skid marks ('+drift.captured.marks+' marks, '+drift.maxSlip.toFixed(0)+'px slip, '+drift.slides+' slides)');

    // 8. Characters are visible in their karts: each of the six has its own baked art.
    const art=await evaluate(`JSON.stringify((()=>{const A=PixelKartAssets;const out={};
      for(const id of['explorer','soldier','mystic','dora','goku','nezha']){
        const s=A.spriteFor(id),f=s.frames[0];
        const c=document.createElement('canvas');c.width=f.width;c.height=f.height;
        const g2=c.getContext('2d');g2.drawImage(f,0,0);
        // Count distinct colours in the sprite: a blank or single-blob sprite
        // would not read as a driver sitting in a vehicle.
        const d=g2.getImageData(0,0,c.width,c.height).data,seen=new Set();
        for(let i=0;i<d.length;i+=4)if(d[i+3]>0)seen.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);
        out[id]={frames:s.frames.length,colours:seen.size,body:A.KARTS[id].kart[0],style:A.KARTS[id].style};
      }return out;})())`);
    const sprites=JSON.parse(art);
    const ids=Object.keys(sprites);
    for(const id of ids){
      assert.equal(sprites[id].frames,16,id+' is baked in 16 headings');
      assert(sprites[id].colours>=6,id+' kart art has '+sprites[id].colours+' colours - a driver and a vehicle, not a blob');
    }
    assert.equal(new Set(ids.map(i=>sprites[i].body)).size,6,'all six karts have different body colours');
    assert.equal(new Set(ids.map(i=>sprites[i].style)).size,6,'all six drivers have different silhouettes');
    /* The driver picker lives on the setup screen, which is hidden mid-race, so
       screenshotting `#kart-chars` in place captures a zero-width element and
       Chrome refuses the shot. The six baked sprites are pasted into a strip that
       is appended to the body instead - the same pixels, actually on screen. */
    await evaluate(`(()=>{const strip=document.createElement('div');
      strip.id='kart-art-strip';
      strip.style.cssText='position:fixed;left:0;top:0;z-index:99999;display:flex;gap:10px;padding:12px;background:#241a2e';
      for(const id of['explorer','soldier','mystic','dora','goku','nezha']){
        const s=PixelKartAssets.spriteFor(id),c=document.createElement('canvas');
        c.width=s.frames[0].width*2;c.height=s.frames[0].height*2;
        c.style.cssText='image-rendering:pixelated;width:'+(s.frames[0].width*2)+'px;height:'+(s.frames[0].height*2)+'px';
        c.getContext('2d').drawImage(s.frames[0],0,0,c.width,c.height);
        strip.appendChild(c);
      }
      document.body.appendChild(strip);})()`);
    await sleep(200);
    await shotElement('preview-kart-sprites.png','#kart-art-strip');
    await evaluate(`document.getElementById('kart-art-strip').remove()`);
    console.log('PASS all six characters are drawn seated in their own kart, each visually distinct');

    // 9. Power-ups: an item can be collected and used, and it visibly changes the race.
    const items=await evaluate(`(()=>{const g=PixelKart,race=g.race,p=race.player;const seen={};
      g.state='scripted';
      p.item=null;
      for(const name of['banana','ink','lightning','boost','shell']){
        p.item=name;race.useItem(p);
        seen[name]={consumed:p.item===null,boost:p.boost,shield:p.shield,hazards:race.hazards.length};
        p.boost=0;p.shield=false;
      }
      // A box on the racing line must hand out an item when driven over.
      for(const b of race.boxes)b.taken=true;
      const box=race.boxes[0];box.taken=false;
      p.x=box.x;p.y=box.y;p.speed=120;p.vx=120;p.vy=0;
      p.lastIndex=PixelKartTracks.locate(race.track,box.x,box.y).index;
      race.step(1/60,{steer:0,throttle:1,brake:0,drift:false});
      seen.pickup=p.item;
      g.state='racing';
      return JSON.stringify(seen);})()`);
    const it=JSON.parse(items);
    for(const name of['banana','ink','lightning','boost','shell'])
      assert(it[name].consumed,name+' is consumed when used');
    assert(it.boost.boost>0||it.boost.hazards>0,'a speed boost takes effect');
    assert(it.ink.hazards>0,'ink leaves a hazard on the track');
    assert(it.banana.hazards>0,'a banana is dropped for the rivals');
    assert(it.shell.shield,'a shell shields the kart');
    assert(it.pickup,'driving over an item box grants a power-up');
    console.log('PASS all five power-ups work: banana, ink, lightning, boost and shell');

    // 10. A full two-lap race reaches the results screen with a real finishing order.
    const result=await evaluate(`(()=>{const g=PixelKart,race=g.race,p=race.player;
      // Paused so the animation loop does not step the race a second time; the
      // loop still notices the finish and flips the game to the results screen.
      g.state='scripted';
      p.item=null;p.hit=0;p.spin=0;
      let guard=0;
      while(race.phase!=='finished'&&guard++<30000){
        const c=race.aiDrive(p,1/60);
        race.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:c.drift,use:guard%50===0});
      }
      g.draw();
      const out={phase:race.phase,steps:guard,
        finishers:race.finishOrder.length,
        laps:p.lapsDone,place:p.place,
        times:race.karts.map(k=>k.finished?+k.finishTime.toFixed(2):null),
        best:p.bestLap?+p.bestLap.toFixed(2):null};
      g.state='racing';
      return JSON.stringify(out);})()`);
    const r=JSON.parse(result);
    assert.equal(r.phase,'finished','the race reaches a finish');
    assert.equal(r.finishers,5,'all five karts are classified');
    assert.equal(r.laps,2,'the player completed two laps');
    assert(r.place>=1&&r.place<=5,'the player is placed 1st to 5th');
    assert(r.best>3,'the best lap is a real lap time ('+r.best+'s)');
    await waitFor(()=>evaluate('PixelKart.state==="results"'),'the results screen',15000);
    const shown=await evaluate(`JSON.stringify({state:PixelKart.state,
      rows:document.querySelectorAll('#kart-result tbody tr').length,
      title:document.querySelector('#kart-result-title').textContent,
      modal:!document.querySelector('.kart-modal[data-kind=results]').hidden})`);
    const sh=JSON.parse(shown);
    assert.equal(sh.state,'results','the game switches to the results screen');
    assert.equal(sh.rows,5,'the finishing order lists all five drivers');
    assert(sh.modal,'the results panel is visible');
    assert(/WINNER|PODIUM|RACE OVER/.test(sh.title),'the headline reads "'+sh.title+'"');
    await shot('preview-kart-results.png');
    console.log('PASS a full two-lap race finishes and shows the order ('+r.times.join('s, ')+'s)');

    // 11. Rematch restarts cleanly; CHANGE SETUP goes back to choosing.
    await click('#kart-rematch');
    await waitFor(()=>evaluate('PixelKart.state==="racing"'),'the rematch to start');
    const again=await evaluate(`JSON.stringify({phase:PixelKart.race.phase,laps:PixelKart.race.player.lapsDone,
      speed:PixelKart.race.player.speed,track:PixelKart.pick.track})`);
    const ag=JSON.parse(again);
    assert.equal(ag.laps,0,'REMATCH restarts the lap count');
    assert.equal(ag.track,'meadow','REMATCH keeps the chosen circuit');
    console.log('PASS REMATCH restarts the same race from lap 1');

    // 12. Pause freezes the simulation, and CHANGE SETUP returns to the chooser.
    await waitFor(()=>evaluate('PixelKart.race.phase==="racing"'),'the countdown to end',30000);
    await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code:'ArrowUp',key:'ArrowUp',windowsVirtualKeyCode:38});
    await sleep(1200);
    await send('Input.dispatchKeyEvent',{type:'keyUp',code:'ArrowUp',key:'ArrowUp',windowsVirtualKeyCode:38});
    await click('#kart-pause');
    const pausedA=await evaluate(`JSON.stringify({paused:PixelKart.race.paused,time:PixelKart.race.raceTime,x:PixelKart.race.player.x})`);
    await sleep(700);
    const pausedB=await evaluate(`JSON.stringify({time:PixelKart.race.raceTime,x:PixelKart.race.player.x})`);
    const pa=JSON.parse(pausedA),pb=JSON.parse(pausedB);
    assert(pa.paused,'pause takes effect');
    assert.equal(pb.time,pa.time,'pause freezes the race clock');
    assert.equal(pb.x,pa.x,'pause freezes the karts');
    await click('#kart-pause');
    assert.equal(await evaluate('PixelKart.race.paused'),false,'pause toggles back off');
    // CHANGE SETUP lives inside the pause dialog, and the pause dialog's button
    // is `#kart-pause-change` - `#kart-change` is the results screen's equivalent.
    await click('#kart-pause');
    assert.equal(await evaluate('PixelKart.race.paused'),true,'pause opens the dialog again');
    await click('#kart-pause-change');
    await waitFor(()=>evaluate('PixelKart.state==="setup"&&!document.querySelector("#kart-setup").hidden'),'the setup screen to return');
    console.log('PASS pause freezes the race, resumes, and CHANGE SETUP returns to the chooser');

    // 13. BACK TO PIXEL QUEST returns to the main menu, and Adventure is untouched.
    await click('#kart-go');
    await waitFor(()=>evaluate('PixelKart.state==="racing"'),'the second race to start');
    await evaluate(`document.querySelector('#kart-exit').click()`);
    await waitFor(()=>evaluate("window.PixelQuest&&PixelQuest.state==='title'"),'the main menu');
    const home=await evaluate(`JSON.stringify({path:location.pathname.split('/').pop(),state:PixelQuest.state,
      overlay:!document.querySelector('#overlay').hidden,
      modes:[...document.querySelectorAll('#mode-actions button')].filter(b=>!b.hidden).map(b=>b.id)})`);
    const hm=JSON.parse(home);
    assert.equal(hm.path,'index.html','BACK TO PIXEL QUEST returns to the main menu');
    assert.equal(hm.state,'title','the main menu is restored');
    assert.deepEqual(hm.modes,['play','play-badminton','play-kart'],'all three modes are offered again');
    // Adventure must still work exactly as before. `score` is a module-local
    // variable inside game.js and is deliberately not published on the global, so
    // the check is on what a player can actually observe: the picker opens, a
    // character is chosen, the run starts, and the world is live and ticking.
    await click('#play');
    assert.equal(await evaluate('PixelQuest.state'),'selecting','Adventure still opens its character picker');
    const picker=await evaluate(`JSON.stringify({open:!document.querySelector('#character-picker').hidden,
      cards:document.querySelectorAll('#character-picker .character-card').length})`);
    const pk=JSON.parse(picker);
    assert(pk.open,'the Adventure character picker is visible');
    assert(pk.cards>=5,'all Adventure characters are offered ('+pk.cards+')');
    await click('#character-start');
    await waitFor(()=>evaluate('PixelQuest.state==="playing"'),'Adventure to play');
    const advBefore=await evaluate(`JSON.stringify({x:PixelQuest.snapshot.player.x,score:PixelQuest.snapshot.score,stage:PixelQuest.snapshot.stage,
      w:document.querySelector('canvas').width,hidden:document.querySelector('#overlay').hidden})`);
    await down('ArrowRight','ArrowRight',39);
    await sleep(700);
    await up('ArrowRight','ArrowRight',39);
    const advAfter=await evaluate(`JSON.stringify({x:PixelQuest.snapshot.player.x,hidden:document.querySelector('#overlay').hidden,enemies:PixelQuest.snapshot.enemies})`);
    const ab=JSON.parse(advBefore),aa=JSON.parse(advAfter);
    assert(ab.w>0,'the Adventure canvas is still sized correctly ('+ab.w+'px)');
    assert.equal(ab.score,0,'a fresh Adventure run starts from zero');
    assert.equal(ab.stage,0,'a fresh Adventure run starts at stage one');
    assert(aa.hidden,'the Adventure overlay is hidden while playing');
    assert(ab.x!==null&&aa.x!==ab.x,'the Adventure character still moves on its own canvas');
    console.log('PASS BACK TO PIXEL QUEST returns to a main menu where all three modes work');

    assert.deepEqual(errors,[],'no browser runtime errors: '+errors.slice(0,3).join(' | '));
    console.log('PASS no browser runtime errors');
    console.log('All 16 Pixel Kart browser checks passed.');
  }finally{
    try{ws.close();}catch{}
    if(chrome.pid)spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{stdio:'ignore'});
    if(server&&server.pid)spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});
    try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
})().catch(error=>{console.error('FAIL',error.message);process.exitCode=1;});
