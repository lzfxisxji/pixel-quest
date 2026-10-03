/* Browser acceptance for the Pixel Quest main menu mode selection (Adventure / Badminton).
   Dependency-free: it drives real Chrome over the DevTools protocol using Node's built-in
   fetch and WebSocket, so no Playwright install is required. Run with the local server up,
   or let this script start one itself:  node check-menu.cjs
   Point it at a deployed copy instead with PQ_SITE, e.g.
   PQ_SITE=https://lzfxisxji.github.io/pixel-quest/ node check-menu.cjs (no local server is
   started in that case). */
const {spawn,spawnSync}=require('child_process'),fs=require('fs'),path=require('path'),os=require('os');
const assert=require('node:assert/strict');
const PORT=9333,SITE=process.env.PQ_SITE||'http://localhost:4173/';
// Where the site's home page lives. '/' on the local server, '/<repo>/' on GitHub Pages.
const BASE=new URL(SITE).pathname;
const CHROME=process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,label,timeout=20000){const start=Date.now();let last;while(Date.now()-start<timeout){try{const v=await fn();if(v)return v;}catch(error){last=error;}await sleep(120);}throw new Error('timeout waiting for '+label+(last?' :: '+last.message:''));}

(async()=>{
  // 1. A local server, started here only when one is not already listening.
  let server=null;
  try{await fetch(SITE);}catch{
    server=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,stdio:'ignore'});
    await waitFor(async()=>{try{const r=await fetch(SITE);return r.ok;}catch{return false;}},'local server');
  }
  // 2. Real Chrome with an isolated profile, so an open browser session is never adopted.
  assert(fs.existsSync(CHROME),'Chrome found at '+CHROME);
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'pq-menu-'));
  const chrome=spawn(CHROME,['--headless=new','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--hide-scrollbars','--window-size=1440,1120','--remote-debugging-port='+PORT,'--remote-allow-origins=*','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'});
  const target=await waitFor(async()=>{const list=await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();return list.find(t=>t.type==='page'&&t.webSocketDebuggerUrl);},'devtools target');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=()=>no(new Error('devtools socket failed'));});
  let id=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{const msg=JSON.parse(event.data);if(msg.id&&pending.has(msg.id)){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const msgId=++id;pending.set(msgId,{resolve,reject});ws.send(JSON.stringify({id:msgId,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error('page error: '+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value;};
  // Real mouse input, after scrolling the target into view and proving nothing covers it.
  const click=async selector=>{const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)||(hit&&hit.contains(e))?'self':hit?(hit.id||hit.className||hit.tagName):'none'};})()`);assert(box&&box.w>1&&box.h>1,'visible click target '+selector);assert.equal(box.hit,'self','click target '+selector+' is reachable (top element: '+box.hit+')');for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x:box.x,y:box.y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});await sleep(160);};
  const press=async(code,key,vk)=>{await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,key,windowsVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk});await sleep(160);};
  // Wait for the stylesheet to be applied (the Google Fonts import can delay it) and page load to settle.
  const load=async url=>{await send('Page.navigate',{url});await waitFor(()=>evaluate("document.readyState==='complete'"),'readyState for '+url);await waitFor(()=>evaluate("getComputedStyle(document.querySelector('.cabinet')).borderTopWidth==='1px'&&document.querySelector('.screen').getBoundingClientRect().height>150"),'laid-out page for '+url);await sleep(250);};
  const menuState=()=>evaluate(`(()=>{const row=document.querySelector('#mode-actions'),adv=document.querySelector('#play'),bad=document.querySelector('#play-badminton'),kart=document.querySelector('#play-kart');const r=row.getBoundingClientRect(),a=adv.getBoundingClientRect(),b=bad.getBoundingClientRect(),k=kart.getBoundingClientRect();return {playMode:PixelQuest.state,overlayHidden:document.querySelector('#overlay').hidden,rowVisible:r.height>1,adventureLabel:adv.textContent.trim(),badmintonLabel:bad.textContent.trim(),kartLabel:kart.textContent.trim(),badmintonHidden:bad.hidden,kartHidden:kart.hidden,adventureVisible:a.height>1&&a.width>1,badmintonVisible:b.height>1&&b.width>1,kartVisible:k.height>1&&k.width>1,sideBySide:Math.abs(a.top-b.top)<2&&Math.abs(a.top-k.top)<2&&b.left>a.right-2&&k.left>b.right-2,threeInOneRow:k.left<=r.right+1&&k.right<=r.right+1};})()`);
  const shot=async name=>fs.writeFileSync(path.join(__dirname,name),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));

  try{
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    // Keep runs deterministic and offline-safe: the optional web font is not part of the test.
    await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
    await send('Emulation.setDeviceMetricsOverride',{width:1360,height:1120,deviceScaleFactor:1,mobile:false});

    // 3. The main menu offers both modes side by side.
    await load(SITE);
    let menu=await menuState();
    assert.equal(menu.playMode,'title');assert.equal(menu.overlayHidden,false);assert(menu.rowVisible,'the mode row is in the main menu');
    assert.equal(menu.adventureLabel,'ADVENTURE ▶');assert.equal(menu.badmintonLabel,'BADMINTON ▶');
    assert(menu.adventureVisible&&menu.badmintonVisible&&menu.kartVisible,'all three mode buttons are visible');
    assert(menu.sideBySide,'the modes sit side by side');assert(menu.threeInOneRow,'all three modes share one row');
    assert.equal(menu.badmintonHidden,false);
    await shot('preview-mode-select.png');
    console.log('PASS main menu offers ADVENTURE and BADMINTON side by side');

    // 4. Adventure Mode still opens the existing character picker and plays.
    await click('#play');
    assert.equal(await evaluate('PixelQuest.state'),'selecting');
    assert.equal(await evaluate("document.querySelector('#character-picker').hidden"),false);
    console.log('PASS Adventure Mode opens the existing character picker');

    // 5. Pause hides the mode row, and RETURN HOME brings the whole menu back.
    await click('#character-start');
    await waitFor(()=>evaluate("PixelQuest.state==='playing'"),'adventure running');
    await press('Escape','Escape',27);
    assert.equal(await evaluate('PixelQuest.state'),'paused');
    assert.equal(await evaluate("document.querySelector('#play-badminton').hidden"),true,'the mode row is not offered while paused');
    await click('#home');assert.equal(await evaluate('PixelQuest.state'),'confirmhome');
    await click('#play');
    await waitFor(()=>evaluate("PixelQuest.state==='title'"),'back on the main menu');
    menu=await menuState();
    assert.equal(menu.overlayHidden,false);assert.equal(menu.badmintonHidden,false);
    assert(menu.adventureVisible&&menu.badmintonVisible&&menu.kartVisible&&menu.sideBySide);
    console.log('PASS RETURN HOME restores the main menu with both modes');

    // 6. Enter on the focused Badminton button starts Badminton Mode.
    await evaluate("document.querySelector('#play-badminton').focus()");
    await press('Enter','Enter',13);
    await waitFor(async()=>await evaluate("location.pathname.endsWith('badminton.html')&&typeof PixelBadminton==='object'"),'badminton page');
    await waitFor(()=>evaluate("document.querySelector('#bd-setup').hidden===false"),'badminton setup screen');
    const court=await evaluate(`({phase:PixelBadminton.snapshot.phase,heroes:document.querySelectorAll('#bd-characters .bd-character').length,title:document.title,adventureLink:document.querySelector('.mode-switch a[data-leave]').getAttribute('href')})`);
    assert.equal(court.phase,'setup');assert.equal(court.heroes,6);assert.match(court.title,/Shuttle Club/);assert.equal(court.adventureLink,'./');
    console.log('PASS keyboard Enter on BADMINTON launches the Shuttle Club setup screen');

    // 7. A started badminton match leaves the adventure save alone, and pause still works.
    const before=await evaluate("localStorage.getItem('pq-save')");
    await click('#bd-start');
    await waitFor(()=>evaluate("PixelBadminton.snapshot.phase==='serve'"),'badminton serve');
    assert.equal(await evaluate("localStorage.getItem('pq-save')"),before,'badminton leaves the adventure save alone');
    await press('Escape','Escape',27);assert.equal(await evaluate('PixelBadminton.snapshot.paused'),true);
    await press('Escape','Escape',27);assert.equal(await evaluate('PixelBadminton.snapshot.paused'),false);
    console.log('PASS badminton gameplay and pause are unchanged, adventure save untouched');

    // 8. BACK TO PIXEL QUEST returns from a live match to the main menu.
    await press('Escape','Escape',27);
    await click('#bd-modal-tertiary');
    assert.equal(await evaluate("document.querySelector('#bd-modal-title').textContent"),'RETURN HOME?');
    await click('#bd-modal-primary');
    await waitFor(()=>evaluate("location.pathname==="+JSON.stringify(BASE)+"&&typeof PixelBadminton==='undefined'"),'back to the main menu');
    await waitFor(()=>evaluate("typeof PixelQuest==='object'&&PixelQuest.state==='title'"),'main menu state');
    menu=await menuState();
    assert.equal(menu.overlayHidden,false);assert.equal(menu.badmintonHidden,false);
    assert(menu.adventureVisible&&menu.badmintonVisible&&menu.kartVisible,'the main menu is fully restored after a match');
    console.log('PASS BACK TO PIXEL QUEST from a live match returns to the main menu');

    // 9. The mode row still fits a phone-sized game screen without horizontal overflow.
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await sleep(450);
    const phone=await evaluate(`(()=>{const row=document.querySelector('#mode-actions'),content=document.querySelector('.overlay-content'),s=document.querySelector('.screen');const w=row.getBoundingClientRect(),c=content.getBoundingClientRect(),r=s.getBoundingClientRect();return {fits:w.left>=r.left-1&&w.right<=r.right+1,contentFits:c.top>=r.top-1&&c.bottom<=r.bottom+1,overflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...row.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height>1).length,screenHeight:Math.round(r.height),contentHeight:Math.round(c.height)};})()`);
    assert.equal(phone.buttons,3,'all three modes stay visible on a phone');
    assert(!phone.overflow,'no horizontal overflow on a phone viewport');
    assert(phone.fits,'the mode row fits the phone game screen');
    assert(phone.contentFits,'main menu fits the phone game screen (content '+phone.contentHeight+'px in '+phone.screenHeight+'px)');
    await shot('preview-mode-select-mobile.png');
    console.log('PASS the mode row fits a 390x844 phone screen');

    // 10. A landscape phone keeps the 16:9 cabinet and still fits the mode row.
    await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
    await sleep(400);
    const land=await evaluate(`(()=>{const s=document.querySelector('.screen').getBoundingClientRect(),row=document.querySelector('#mode-actions').getBoundingClientRect();return {ratio:Number((s.width/s.height).toFixed(3)),rowFits:row.left>=s.left-1&&row.right<=s.right+1,overflow:document.documentElement.scrollWidth>innerWidth+1};})()`);
    assert(Math.abs(land.ratio-16/9)<.02,'landscape cabinet keeps 16:9 (got '+land.ratio+')');
    assert(land.rowFits,'the mode row fits the landscape phone screen');
    assert(!land.overflow,'no horizontal overflow on a landscape phone');
    console.log('PASS the mode row fits an 844x390 landscape phone');

    // 11. PIXEL KART is reachable from the menu, loads its own page, and the
    // other two modes' pages link to it - the three modes share no engine code.
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await sleep(300);
    await load(SITE);
    const modeButtons=await evaluate(`(()=>[...document.querySelectorAll('#mode-actions button')].filter(b=>!b.hidden).map(b=>b.id))()`);
    assert.deepEqual(modeButtons,['play','play-badminton','play-kart'],'the menu offers all three modes in order');
    console.log('PASS the main menu offers Adventure, Badminton and Pixel Kart');

    // Keyboard Enter on a focused PIXEL KART button must launch it, exactly as it
    // does for BADMINTON.
    await evaluate(`document.querySelector('#play-kart').focus()`);
    await press('Enter','Enter',13);
    await sleep(2200);
    const kartPage=await evaluate(`JSON.stringify({path:location.pathname.split('/').pop(),
      booted:typeof window.PixelKart!=='undefined',
      setup:!!document.querySelector('#kart-setup')&&!document.querySelector('#kart-setup').hidden,
      tracks:[...document.querySelectorAll('#kart-tracks button')].length,
      drivers:[...document.querySelectorAll('#kart-chars button')].length,
      difficulties:[...document.querySelectorAll('#kart-difficulty button')].length,
      loadsAdventure:typeof window.PixelQuest!=='undefined',
      loadsBadminton:typeof window.PixelBadminton!=='undefined'})`);
    const k=JSON.parse(kartPage);
    assert.equal(k.path,'kart.html','PIXEL KART opens its own page');
    assert(k.booted,'the Pixel Kart engine boots');
    assert(k.setup,'the setup screen is shown');
    assert.equal(k.tracks,3,'three circuits are offered');
    assert.equal(k.drivers,6,'all six characters are offered');
    assert.equal(k.difficulties,3,'three AI difficulties are offered');
    assert(!k.loadsAdventure,'Pixel Kart does not load the Adventure engine');
    assert(!k.loadsBadminton,'Pixel Kart does not load the Badminton engine');
    console.log('PASS PIXEL KART is independent: its own page, engine, 3 circuits, 6 drivers');
    await shot('preview-kart-setup.png');

    // Coming back from Pixel Kart restores a working main menu.
    await evaluate(`document.querySelector('#kart-exit').click()`);
    await waitFor(()=>evaluate("window.PixelQuest&&PixelQuest.state==='title'"),'back on the main menu from Pixel Kart');
    const backHome=await evaluate(`JSON.stringify({path:location.pathname.split('/').pop(),state:window.PixelQuest&&PixelQuest.state,overlay:!document.querySelector('#overlay').hidden})`);
    const bh=JSON.parse(backHome);
    assert.equal(bh.path,'index.html','BACK TO PIXEL QUEST returns to the main menu');
    assert.equal(bh.state,'title','the main menu title screen is restored');
    assert(bh.overlay,'the main menu overlay is visible again');
    console.log('PASS BACK TO PIXEL QUEST returns to a working main menu');

    // Both other pages link to Pixel Kart, so the mode is reachable from anywhere.
    for(const page of ['badminton.html','kart.html']){
      await load(SITE+page);
      const links=await evaluate(`JSON.stringify([...document.querySelectorAll('.mode-switch a,.mode-switch .active-mode')].map(e=>e.textContent.trim().split(/\\s{2,}|NEW/)[0].trim()))`);
      const l=JSON.parse(links);
      assert(l.some(t=>/ADVENTURE/i.test(t)),page+' links back to Adventure');
      assert(l.some(t=>/SHUTTLE CLUB/i.test(t)),page+' links to Shuttle Club');
      assert(l.some(t=>/PIXEL KART/i.test(t)),page+' links to Pixel Kart');
    }
    console.log('PASS every mode page links to all three modes');

    assert.deepEqual(errors,[]);console.log('PASS no browser runtime errors');
    console.log('All 15 main-menu integration checks passed.');
  } finally {
    try{ws.close();}catch{}
    if(chrome.pid)spawnSync('taskkill',['/PID',String(chrome.pid),'/T','/F'],{stdio:'ignore'});
    if(server&&server.pid)spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});
    try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
