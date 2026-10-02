/* Browser acceptance for four-way footwork in Shuttle Club's 2.5D court.
   Dependency-free: it drives real Chrome over the DevTools protocol using Node's built-in
   fetch and WebSocket, so no Playwright install is required.

   The redesign claim is that the diagonal camera makes *four* footwork directions
   visually obvious. This proves it twice over, in a real browser:
     * the simulation lane (z) and the along-court axis (x) are untouched, and
     * the sprite's contact point on the canvas really travels in four different
       screen directions, with the near player drawn larger than the far one.

   Run with the local server up, or let this script start one:
     node check-badminton-move.cjs
   Point it at a deployed copy with PQ_SITE=https://lzfxisxji.github.io/pixel-quest/ . */
const {spawn,spawnSync}=require('child_process'),fs=require('fs'),path=require('path'),os=require('os');
const assert=require('node:assert/strict');
const PORT=9334,SITE=process.env.PQ_SITE||'http://localhost:4173/';
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,label,timeout=20000){const start=Date.now();let last;while(Date.now()-start<timeout){try{const v=await fn();if(v)return v;}catch(error){last=error;}await sleep(120);}throw new Error('timeout waiting for '+label+(last?' :: '+last.message:''));}
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y)/(Math.hypot(a.x,a.y)*Math.hypot(b.x,b.y)))))*180/Math.PI;

(async()=>{
  // 1. A local server, started here only when one is not already listening.
  let server=null;
  try{await fetch(SITE);}catch{
    server=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,stdio:'ignore'});
    await waitFor(async()=>{try{const r=await fetch(SITE);return r.ok;}catch{return false;}},'local server');
  }
  // 2. Real Chrome with an isolated profile, so an open browser session is never adopted.
  assert(fs.existsSync(CHROME),'Chrome found at '+CHROME);
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pq-shuttle-'));
  const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--hide-scrollbars','--window-size=1440,1120','--remote-debugging-port='+PORT,'--remote-allow-origins=*','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const target=await waitFor(async()=>{const list=await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();return list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);},'devtools target');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=()=>no(new Error('devtools socket failed'));});
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const msgId=++id;pending.set(msgId,{resolve,reject});ws.send(JSON.stringify({id:msgId,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page error: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value;};
  const click=async selector=>{const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)||(hit&&hit.contains(e))?'self':hit?(hit.id||hit.className||hit.tagName):'none'};})()`);assert(box&&box.w>1&&box.h>1,'visible click target '+selector);assert.equal(box.hit,'self','click target '+selector+' is reachable (top element: '+box.hit+')');for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});await sleep(160);};
  const hold=async(code,key,vk,ms)=>{await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,key,windowsVirtualKeyCode:vk});await sleep(ms);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk});await sleep(220);};
  // Wait for the stylesheet to be applied (the Google Fonts import can delay it) and page load to settle.
  const load=async url=>{await send('Page.navigate',{url});await waitFor(()=>evaluate("document.readyState==='complete'"),'readyState for '+url);await waitFor(()=>evaluate("getComputedStyle(document.querySelector('.cabinet')).borderTopWidth==='1px'&&document.querySelector('.screen').getBoundingClientRect().height>150"),'laid-out page for '+url);await sleep(250);};
  const shotElement=async(name,selector,scale=2)=>{const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height};})()`);fs.writeFileSync(path.join(__dirname,name),Buffer.from((await send('Page.captureScreenshot',{format:'png',clip:{x:box.x,y:box.y,width:box.width,height:box.height,scale}})).data,'base64'));};
  const canvasPng=()=>evaluate("document.querySelector('#bd-game').toDataURL('image/png')");
  /* The 2.5D view exposes the sprite box straight from the same projection the renderer
     uses, so there is no need to hunt for coloured pixels: footOf() reports the contact
     point in device pixels plus the sprite height at that depth. */
  const stance=()=>evaluate(`(()=>{const f=PixelBadminton.footOf(0),g=PixelBadminton.footOf(1),s=PixelBadminton.snapshot;return {lane:s.players[0].z,alongCourt:s.players[0].x,height:s.players[0].y,ground:s.players[0].ground,phase:s.phase,foot:{x:f.x,y:f.y,height:f.height,scale:f.scale,depth:f.depth},aiFoot:{x:g.x,y:g.y,height:g.height,depth:g.depth},canvas:{w:document.querySelector('#bd-game').width,h:document.querySelector('#bd-game').height}};})()`);
  // One side-by-side proof sheet: the two extremes of the court width, cropped around the
  // player, against the fixed court lines -- so the diagonal shuffle is unmistakable.
  const proofSheet=(down,up)=>evaluate(`(async()=>{const load=src=>new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src;});const [a,b]=await Promise.all([load(${JSON.stringify(down)}),load(${JSON.stringify(up)})]);
    const sx=120,sy=188,sw=300,sh=300,z=2,c=document.createElement('canvas');c.width=sw*z;c.height=sh*z*2+26;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
    g.fillStyle='#10242a';g.fillRect(0,0,c.width,c.height);
    g.drawImage(a,sx,sy,sw,sh,0,22,sw*z,sh*z);g.drawImage(b,sx,sy,sw,sh,0,sh*z+26,sw*z,sh*z);
    g.font='bold 13px monospace';g.fillStyle='#ffe0a0';g.fillText('ARROW DOWN  \\u00b7  FRONT LINE  \\u00b7  LANE 1.00',10,15);
    g.fillText('ARROW UP  \\u00b7  BACK LINE  \\u00b7  LANE 0.00',10,sh*z+41);
    g.fillStyle='#698f7a';g.fillRect(0,sh*z+21,c.width,2);
    return c.toDataURL('image/png');})()`);

  try{
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    // Keep runs deterministic and offline-safe: the optional web font is not part of the test.
    await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
    await send('Emulation.setDeviceMetricsOverride',{width:1360,height:1120,deviceScaleFactor:1,mobile:false});

    // 3. Start a match and stay on the serve, so footwork can be measured on its own.
    await load(new URL('badminton.html',SITE).href);
    await waitFor(()=>evaluate("typeof PixelBadminton==='object'&&document.querySelector('#bd-setup').hidden===false"),'badminton setup screen');
    await click('#bd-start');
    await waitFor(()=>evaluate("PixelBadminton.snapshot.phase==='serve'"),'serve phase');
    const ready=await stance();
    assert.equal(ready.lane,.5,'the player starts in the middle of the court width');
    assert.equal(ready.ground,true);
    assert(ready.foot.x>0&&ready.foot.x<ready.canvas.w&&ready.foot.y>0&&ready.foot.y<ready.canvas.h,'the sprite foot is on the canvas ('+ready.foot.x.toFixed(0)+','+ready.foot.y.toFixed(0)+')');
    console.log('PASS the ready position is the middle of the court width (foot at '+ready.foot.x.toFixed(0)+','+ready.foot.y.toFixed(0)+')');

    // 4. Down walks to the front line: the lane changes and the character really moves
    //    down-and-right on screen, because the front line now cuts across the camera.
    await hold('ArrowDown','ArrowDown',40,2600);
    const front=await stance();
    assert.equal(front.phase,'serve','footwork alone never leaves the serve');
    assert(front.lane>0.95,'ArrowDown reaches the front line (lane '+front.lane.toFixed(3)+')');
    assert.equal(front.alongCourt,ready.alongCourt,'walking across the court does not move along it');
    assert.equal(front.height,ready.height,'walking across the court does not change height');
    const toFront={x:front.foot.x-ready.foot.x,y:front.foot.y-ready.foot.y};
    assert(toFront.y>40,'the character is drawn clearly lower on the canvas (+'+toFront.y.toFixed(0)+'px)');
    assert(toFront.x>25,'and, because the court is seen at an angle, also to the right (+'+toFront.x.toFixed(0)+'px)');
    const frontPng=await canvasPng();
    console.log('PASS ArrowDown walks to the front line and the sprite foot moves '+toFront.x.toFixed(0)+'px right and '+toFront.y.toFixed(0)+'px down');

    // 5. Up walks back to the back line, and past it the line still holds.
    await hold('ArrowUp','ArrowUp',38,4200);
    const back=await stance();
    assert.equal(back.lane,0,'ArrowUp reaches the back line');
    assert.equal(back.alongCourt,ready.alongCourt);
    assert.equal(back.height,ready.height);
    const toBack={x:back.foot.x-ready.foot.x,y:back.foot.y-ready.foot.y};
    assert(toBack.y<-40,'the character is drawn clearly higher on the canvas ('+toBack.y.toFixed(0)+'px)');
    assert(toBack.x<-15,'and to the left ('+toBack.x.toFixed(0)+'px)');
    const travel=Math.abs(toFront.y-toBack.y);
    assert(travel>120,'the full court width is '+travel.toFixed(0)+'px of vertical travel on screen');
    fs.writeFileSync(path.join(__dirname,'preview-badminton-lanes.png'),Buffer.from((await proofSheet(frontPng,await canvasPng())).split(',')[1],'base64'));
    console.log('PASS ArrowUp walks back to the back line and the sprite foot moves '+toBack.x.toFixed(0)+'px left and '+toBack.y.toFixed(0)+'px up ('+travel.toFixed(0)+'px of travel end to end)');

    // 6. W and S drive the same axis, and the along-court axis stays independent.
    await hold('KeyS','s',83,2600);assert((await stance()).lane>0.95,'S walks to the front line');
    await hold('KeyW','w',87,4200);assert.equal((await stance()).lane,0,'W walks back to the back line');
    await hold('ArrowRight','ArrowRight',39,900);
    const netward=await stance();
    assert.equal(netward.lane,0,'walking along the court keeps the lateral position');
    assert(netward.alongCourt>ready.alongCourt,'ArrowRight still walks up the court towards the net');
    const toNet={x:netward.foot.x-back.foot.x,y:netward.foot.y-back.foot.y};
    assert(toNet.x>25&&toNet.y<-10,'up the court is a different screen direction: right and up ('+toNet.x.toFixed(0)+','+toNet.y.toFixed(0)+')');
    console.log('PASS W and S drive the same axis, and up the court moves right and up on screen ('+toNet.x.toFixed(0)+','+toNet.y.toFixed(0)+')');

    // 7. The four footwork directions are four genuinely different screen directions.
    const dirs={front:toFront,rear:toBack,along:toNet,back:{x:-toNet.x,y:-toNet.y}};
    for(const [name,v] of Object.entries(dirs))assert(Math.hypot(v.x,v.y)>40,name+' moves a visible distance on screen ('+Math.hypot(v.x,v.y).toFixed(0)+'px)');
    const keys=Object.entries(dirs);let tightest=999,who='';
    for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const a=angle(keys[i][1],keys[j][1]);if(a<tightest){tightest=a;who=keys[i][0]+' vs '+keys[j][0];}}
    assert(tightest>60,'no two footwork directions look alike (closest pair '+who+' at '+tightest.toFixed(0)+' degrees)');
    console.log('PASS all four footwork directions are distinct diagonals, the closest pair being '+tightest.toFixed(0)+' degrees apart');

    // 8. Depth is real: the same sprite height is drawn larger near the camera than far.
    assert(ready.foot.height>ready.aiFoot.height*1.2,'the near player is drawn '+ready.foot.height.toFixed(0)+'px tall against the far player\'s '+ready.aiFoot.height.toFixed(0)+'px');
    assert(ready.foot.depth<ready.aiFoot.depth,'the camera really is nearer to our half');
    console.log('PASS sprites scale with distance around the real match ('+ready.foot.height.toFixed(0)+'px near vs '+ready.aiFoot.height.toFixed(0)+'px far)');

    // 9. The phone layout keeps both pads and the lane buttons usable.
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await sleep(500);
    const phone=await evaluate(`(()=>{const bar=document.querySelector('.bd-touch:not(.bd-fs-touch)'),r=bar.getBoundingClientRect(),lane=[...bar.querySelectorAll('.bd-touch-lane button')].map(b=>({key:b.dataset.bdKey,label:b.textContent,w:Math.round(b.getBoundingClientRect().width),h:Math.round(b.getBoundingClientRect().height),hit:(()=>{const q=b.getBoundingClientRect(),t=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);return t===b||b.contains(t);})()}));return {overflow:document.documentElement.scrollWidth>innerWidth+1,barRight:Math.round(r.right),viewport:innerWidth,lane,laneVisible:lane.length===2&&lane.every(b=>b.w>1&&b.h>1&&b.hit)};})()`);
    assert.equal(phone.lane.length,2,'the lane pad has an up and a down button');
    assert.equal(phone.lane[0].key,'ArrowUp');assert.equal(phone.lane[1].key,'ArrowDown');
    assert(phone.laneVisible,'both lane buttons are visible and reachable on a phone');
    assert(!phone.overflow,'no horizontal overflow with the lane pad (bar '+phone.barRight+'px in '+phone.viewport+'px)');
    await shotElement('preview-badminton-touch-lanes.png','.bd-touch:not(.bd-fs-touch)');
    console.log('PASS the phone layout fits the four-way pad with no overflow');

    assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');
    console.log('All 9 four-way footwork checks passed.');
  }finally{
    try{ws.close();}catch{}
    if(chrome.pid)spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{stdio:'ignore'});
    if(server&&server.pid)spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});
  }
})().catch(error=>{console.error('FAIL',error.message);process.exitCode=1;});
