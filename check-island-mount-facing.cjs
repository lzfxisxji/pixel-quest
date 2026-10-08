const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4173/island.html');await page.click('#start');
 const count=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.id='mount-facing-gallery';canvas.width=600;canvas.height=400;document.body.append(canvas);
  const c=canvas.getContext('2d'),v=new IslandView(canvas,PixelModeCharacters),original=IslandAssets.mount;
  c.fillStyle='#70bdcc';c.fillRect(0,0,600,400);let count=0;
  for(const [row,id]of ['ground','fire','wing','water','skateboard'].entries())for(const [col,face]of [1,-1].entries()){
   const p={character:'explorer',x:150+col*300,y:70+row*75,mount:id,face,lives:3,respawn:0,inv:0,side:0,ground:row%2===0,vx:face*120,anim:1,attackTime:0};
   IslandAssets.mount=(ctx,m,x,y,t)=>{const transform=ctx.getTransform();if(transform.a!==face||transform.d!==1||Math.abs(transform.a*x+transform.e-p.x)>.01)throw Error('mount facing/anchor incorrect '+id);original(ctx,m,x,y,t);count++};
   v.hero(p,.1);c.fillStyle='#163442';c.font='12px monospace';c.fillText(id+' '+(face<0?'LEFT':'RIGHT'),p.x-50,p.y+18);
  }
  IslandAssets.mount=original;return count;
 });assert.equal(count,10);
 await page.locator('#mount-facing-gallery').screenshot({path:'preview-island-mount-facing.png'});
 for(const id of ['ground','fire','wing','water','skateboard']){
  await page.evaluate(id=>{const m=PixelIsland.match,p=m.players[0];m.pickup(p,{type:id,alive:true});p.x=350;p.y=m.ground(350);p.ground=true;p.inv=10},id);
  await page.keyboard.down('a');await page.waitForTimeout(100);await page.keyboard.up('a');assert.equal(await page.evaluate(()=>PixelIsland.match.players[0].face),-1);
  await page.keyboard.down('d');await page.waitForTimeout(100);await page.keyboard.up('d');assert.equal(await page.evaluate(()=>PixelIsland.match.players[0].face),1);
 }
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS all five mounts mirrored around rider anchor; actual left/right keyboard riding; no runtime errors');
})().catch(e=>{console.error(e);process.exit(1)});
