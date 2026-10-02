const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4173/');await page.click('#play');await page.click('#choose-soldier');await page.click('#character-start');
  await page.evaluate(()=>{loadStage(2);player.power=2;player.weapon='lightning';score=4321;});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>state),'paused');assert(await page.isVisible('#home'));
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>state),'confirmhome');assert(await page.isVisible('#cancel-home'));
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>state),'paused');
  await page.click('#home');assert.equal(await page.evaluate(()=>state),'confirmhome');await page.click('#cancel-home');assert.equal(await page.evaluate(()=>state),'paused');
  await page.keyboard.press('KeyP');assert.equal(await page.evaluate(()=>state),'playing');
  await page.keyboard.press('Escape');await page.click('#home');
  await page.setViewportSize({width:390,height:844});
  const fit=await page.evaluate(()=>{const screen=document.querySelector('.screen').getBoundingClientRect(),content=document.querySelector('.overlay-content').getBoundingClientRect();return content.top>=screen.top-1&&content.bottom<=screen.bottom+1;});
  assert(fit,'confirmation fits mobile game screen');await page.locator('.screen').screenshot({path:__dirname+'/preview-home-confirmation.png'});
  await page.click('#play');assert.equal(await page.evaluate(()=>state),'title');assert(await page.isVisible('#continue'));
  await page.click('#continue');const resumed=await page.evaluate(()=>({state,stage,score,character:player.character,power:player.power,weapon:player.weapon}));
  assert.deepEqual(resumed,{state:'playing',stage:2,score:4321,character:'soldier',power:2,weapon:'lightning'});
  assert.deepEqual(errors,[]);console.log('PASS Esc confirmation, cancel, P resume, home, continue, mobile layout, no page errors');
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
