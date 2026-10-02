const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:4173/');await page.click('#play');await page.click('#character-start');
  const result=await page.evaluate(()=>{
    const rewards={};for(const name of characterIds){selectCharacter(name);start();rewards[name]=rewardFor('mushroom');}
    selectCharacter('soldier');start();rewards.soldierTier3=[];player.power=1;rewards.soldierTier3.push(rewardFor('mushroom'),rewardFor('flower'));
    world.enemies=[];player.x=55;player.y=208;player.inv=0;camera=0;
    const types=['weaponN','weaponL','weaponS','dorayaki','dragonball','mysticOrb'];
    items=types.map((type,i)=>({type,x:118+i*37,y:178,w:14,h:12,age:0,vx:0,vy:0}));draw();
    return rewards;
  });
  assert.deepEqual(result,{explorer:'mushroom',soldier:'weaponN',mystic:'mysticOrb',dora:'dorayaki',goku:'dragonball',soldierTier3:['weaponL','weaponS']});
  await page.locator('#game').screenshot({path:__dirname+'/preview-powerups.png'});
  assert.deepEqual(errors,[]);console.log('PASS character rewards and pixel pickup rendering');await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
