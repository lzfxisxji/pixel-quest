const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4173/');
  await page.click('#play');await page.click('#character-start');
  const firework=await page.evaluate(()=>{
    loadStage(0);world.enemies=[];player.x=world.flagX;player.y=208;player.ground=true;update();
    for(let i=0;i<48;i++)update();draw();
    return {stage,finishTime,exitPhase,sparks:fireworks.filter(f=>f.kind==='spark').length,pipe:world.exitX};
  });
  assert.equal(firework.stage,0);assert(firework.sparks>0);assert(firework.pipe>0);
  await page.screenshot({path:__dirname+'/preview-fireworks.png'});
  const next=await page.evaluate(()=>{for(let i=0;i<220&&stage===0;i++)update();return {stage,state,overlay:document.querySelector('#overlay').hidden};});
  assert.deepEqual(next,{stage:1,state:'playing',overlay:true});
  const final=await page.evaluate(()=>{loadStage(3);world.enemies=[];player.x=world.flagX;player.y=208;player.ground=true;update();for(let i=0;i<240&&state==='playing';i++)update();return {stage,state,overlay:document.querySelector('#overlay').hidden};});
  assert.deepEqual(final,{stage:3,state:'victory',overlay:false});
  assert.deepEqual(errors,[]);
  console.log('PASS browser fireworks, automatic pipe transition, final victory, no page errors');
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
