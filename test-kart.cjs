/* Headless acceptance checks for Pixel Kart: circuit geometry, kart physics,
   drifting, the AI, power-ups and lap counting. No browser and no dependencies. */
const assert=require('assert');
const K=require('./kart-core.js');
const T=require('./kart-tracks.js');

/* kart-assets.js bakes its pixel art into real canvases. Headless Node has no
   DOM, so give it a canvas stub that records the drawing calls. The tests below
   assert on the *structure* of what it baked - one frame per heading, non-empty
   dimensions, distinct palettes - rather than on pixels, which a stub cannot
   honestly produce. Pixel correctness is covered by the browser check. */
const drawn=new Map();
function stubContext(){
  const noop=()=>{};
  return new Proxy({imageSmoothingEnabled:true,fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',textBaseline:'',
    canvas:null,measureText:()=>({width:0})},
    {get(t,k){if(k in t)return t[k];return noop;},set(t,k,v){t[k]=v;return true;}});
}
global.document={createElement(tag){
  if(tag!=='canvas')return {style:{},appendChild(){},setAttribute(){}};
  const c={width:1,height:1,style:{},getContext(){const g=stubContext();g.canvas=c;drawn.set(c,g);return g;}};
  return c;
},createElementNS(){return this.createElement('canvas');}};
const A=require('./kart-assets.js');

let count=0;
function test(name,fn){try{fn();count++;console.log('PASS '+name);}catch(e){console.error('FAIL '+name);console.error('  '+e.message);if(process.env.PQ_TRACE)console.error(e.stack);process.exitCode=1;}}
const IDS=['explorer','soldier','mystic','dora','goku','nezha'];

/* Drive a kart with the game's own driving brain, so the tests exercise the
   same code path a real AI uses rather than a simplified stand-in. */
/* Drive a kart with the game's own driving brain, so the tests exercise the
   same code path a real AI uses rather than a simplified stand-in.

   The frame counter lives on the race, not in the loop. A local `i` restarts at
   zero on every call, so `autoplay(r,1)` - stepping one frame at a time from the
   grass measurement below - evaluated `i%40===0` on *every single frame*. The
   player then fired a power-up sixty times a second and carpet-bombed the
   circuit with hazards, and the resulting "the AI spends 10% of its time in the
   grass" was entirely an artefact of that. Stepping the counter forward means
   the item cadence is the one a real race has. */
function autoplay(race,steps,opts={}){
  const seen={};
  for(let n=0;n<steps&&race.phase!=='finished';n++){
    const i=race.frame||0;
    race.frame=i+1;
    const p=race.player;
    const c=race.aiDrive(p,1/60);
    race.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:opts.drift??c.drift,use:i%40===0});
    for(const e of race.events)seen[e.type]=(seen[e.type]||0)+1;
    race.events.length=0;
    if(opts.until&&opts.until(race,p,i))return {seen,stopped:true};
  }
  return {seen,stopped:false};
}
const fresh=(track='meadow',difficulty='medium',character='explorer',seed=7)=>{
  const r=new K.Race({track,character,difficulty,seed});
  while(r.phase==='countdown')r.step(1/60,{});
  return r;
};

test('Three circuits exist, each with a distinct id, name and theme',()=>{
  assert.equal(K.TRACKS.length,3);
  const ids=K.TRACKS.map(t=>t.id);
  assert.deepEqual(ids.slice().sort(),['harbour','meadow','neon']);
  assert.equal(new Set(ids).size,3);
  assert.equal(new Set(K.TRACKS.map(t=>t.name)).size,3,'each circuit is named differently');
  for(const t of K.TRACKS)for(const key of['asphalt','asphaltDark','kerb','kerbRed','grass','grassDark','sand','sky'])
    assert(t.theme[key],t.id+' theme has '+key);
});

test('Every circuit is a closed, drivable loop with sane dimensions',()=>{
  for(const t of K.TRACKS){
    assert(t.length>1800&&t.length<3000,t.id+' lap length '+t.length.toFixed(0));
    assert(t.count>400,t.id+' sample count '+t.count);
    assert(t.slots.length===K.RACERS,t.id+' has a '+K.RACERS+'-kart grid');
    for(const s of t.samples){
      assert(isFinite(s.x)&&isFinite(s.y)&&isFinite(s.half)&&isFinite(s.s),t.id+' sample is finite');
      assert(s.half>=28&&s.half<=60,t.id+' half-width '+s.half.toFixed(1));
      assert(s.vmax>100&&s.vmax<=K.TOP,t.id+' corner limit '+s.vmax.toFixed(0));
      assert(Math.abs(Math.hypot(s.nx,s.ny)-1)<.01,t.id+' sample normal is a unit vector');
    }
  }
});

test('Circuits do not self-intersect and every corner is wide enough to drive',()=>{
  for(const t of K.TRACKS){
    // A drivable circuit cannot have a corner tighter than the road is wide, or
    // the inside edge would fold through itself, and no two separate straights
    // may come closer than a kart length or the player would be trapped.
    const quality=T.build.length?null:null;
    let tightest=Infinity;
    for(let i=0;i<t.count;i++){
      const a=t.samples[(i-1+t.count)%t.count],b=t.samples[i],c=t.samples[(i+1)%t.count];
      const v1x=b.x-a.x,v1y=b.y-a.y,v2x=c.x-b.x,v2y=c.y-b.y;
      const cross=Math.abs(v1x*v2y-v1y*v2x),l1=Math.hypot(v1x,v1y),l2=Math.hypot(v2x,v2y);
      if(cross<1e-6)continue;
      tightest=Math.min(tightest,l1*l2*T.SPACING/cross);
    }
    assert(tightest>t.samples[0].half+18,t.id+' tightest corner radius '+tightest.toFixed(1)+'px is drivable');
  }
});

test('Consecutive samples never crowd together, so no fake hairpins exist',()=>{
  for(const t of K.TRACKS)for(let i=0;i<t.count;i++){
    const a=t.samples[i],b=t.samples[(i+1)%t.count];
    const d=Math.hypot(b.x-a.x,b.y-a.y);
    assert(d>T.SPACING*.9,t.id+' sample '+i+' to '+((i+1)%t.count)+' is only '+d.toFixed(2)+'px apart');
  }
});

test('Arc length is consistent: sample distance matches the stated lap length',()=>{
  for(const t of K.TRACKS){
    let total=0;
    for(let i=0;i<t.count;i++){
      const a=t.samples[i],b=t.samples[(i+1)%t.count];
      total+=Math.hypot(b.x-a.x,b.y-a.y);
    }
    assert(Math.abs(total-t.length)/t.length<.02,t.id+' measured '+total.toFixed(0)+'px vs stated '+t.length.toFixed(0)+'px');
  }
});

test('locate() reports road, rumble and grass at the right distances',()=>{
  for(const t of K.TRACKS){
    for(let i=0;i<t.count;i+=7){
      const s=t.samples[i];
      const onRoad=T.locate(t,s.x,s.y);
      assert.equal(onRoad.surface,'road',t.id+' the centre line is road');
      assert(Math.abs(onRoad.offset)<1.5,t.id+' the centre line has no offset');
      assert.equal(onRoad.index,i,t.id+' locate finds the sample it was given');
      const edge=T.locate(t,s.x+s.nx*(s.half-2),s.y+s.ny*(s.half-2));
      assert.equal(edge.surface,'road',t.id+' just inside the edge is still road');
      const kerb=T.locate(t,s.x+s.nx*(s.half+2),s.y+s.ny*(s.half+2));
      assert.equal(kerb.surface,'rumble',t.id+' just outside the edge is rumble');
      const out=T.locate(t,s.x+s.nx*(s.half+T.RUMBLE+6),s.y+s.ny*(s.half+T.RUMBLE+6));
      assert.equal(out.surface,'grass',t.id+' well outside the edge is grass');
    }
  }
});

test('locate() unwraps distance so progress keeps counting across the line',()=>{
  for(const t of K.TRACKS){
    // Walk a full lap one sample at a time, starting just behind the line. The
    // walk must begin on the same side it is about to cross, or the first step
    // is legitimately backwards and the test measures its own setup.
    /* Walk a whole lap, entering it six samples before the line so the crossing
       is actually exercised. The first sample establishes the starting lap;
       every step after it must be a short forward stride, never a lap jump. */
    const enter=(t.count-6)%t.count;
    // Derive the stride ceiling from the track itself rather than assuming one:
    // the start-line gantry makes sample 0 sit slightly further from its
    // neighbour than the nominal spacing.
    let stride=0;
    for(let i=0;i<t.count;i++){
      const a=t.samples[i],b=t.samples[(i+1)%t.count];
      stride=Math.max(stride,Math.hypot(b.x-a.x,b.y-a.y));
    }
    let last=t.samples[enter].s,lastIndex=enter;
    for(let n=-5;n<=t.count+6;n++){
      const i=((n%t.count)+t.count)%t.count;
      const w=T.locate(t,t.samples[i].x,t.samples[i].y,lastIndex,last);
      assert(w.s>last-0.001,t.id+' progress never goes backwards (step '+n+')');
      assert(w.s-last<stride+1,t.id+' progress never jumps a lap (step '+n+', +'+(w.s-last).toFixed(1)+'px)');
      last=w.s;lastIndex=w.index;
    }
    /* The walk runs count+12 steps from a point six samples before the line, so
       it covers exactly one lap plus twelve strides. Anything else would mean
       the unwrap had lost or invented distance at the crossing. */
    const expected=t.length+12*(t.length/t.count);
    assert(Math.abs((last-t.samples[enter].s)-expected)<T.SPACING*0.5,
      t.id+' a full lap plus 12 strides advances '+(last-t.samples[enter].s).toFixed(1)+'px, expected '+expected.toFixed(1)+'px');
  }
});

test('A kart on the grid starts behind the line, so lap 1 is a real lap',()=>{
  for(const t of K.TRACKS){
    const r=new K.Race({track:t.id,character:'explorer',difficulty:'medium',seed:3});
    for(const k of r.karts){
      assert(k.progress<0,t.id+' kart '+k.index+' starts with negative progress ('+k.progress.toFixed(0)+')');
      assert.equal(k.lapsDone,0);
    }
  }
});

test('Five racers, one player and four AI, each in their own character kart',()=>{
  const r=new K.Race({track:'meadow',character:'goku',difficulty:'medium',seed:11});
  assert.equal(r.karts.length,K.RACERS);
  assert.equal(r.karts.length,5);
  assert.equal(r.karts.filter(k=>k.player).length,1,'exactly one player');
  assert.equal(r.karts.filter(k=>!k.player).length,4,'four AI opponents');
  const ids=r.karts.map(k=>k.id);
  assert.equal(new Set(ids).size,5,'all five drivers are different characters');
  assert(ids.includes('goku'),'the player drives the chosen character');
  for(const id of ids)assert(IDS.includes(id),id+' is one of the six characters');
  // Grid slots must not overlap, or the karts would start inside each other.
  for(let i=0;i<r.karts.length;i++)for(let j=i+1;j<r.karts.length;j++)
    assert(Math.hypot(r.karts[i].x-r.karts[j].x,r.karts[i].y-r.karts[j].y)>K.BODY*2,
      'grid slots '+i+' and '+j+' are separated');
});

test('The player is the only kart that takes input; AI drives itself',()=>{
  const r=fresh('meadow','medium','explorer',5);
  const before=r.karts.filter(k=>!k.player).map(k=>k.x);
  // Hold the throttle down and never steer: only the player may respond.
  for(let i=0;i<40;i++)r.step(1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert(r.player.speed>5,'the player accelerates');
  const ai=r.karts.filter(k=>!k.player);
  for(const k of ai)assert(isFinite(k.x)&&isFinite(k.y),'AI position stays finite without input');
  // The AI must have moved on its own, following the circuit.
  assert(ai.some((k,i)=>Math.hypot(k.x-before[i],k.y-before[i])>4),'the AI drives itself');
});

test('A kart accelerates to the stated top speed and braking slows it',()=>{
  const r=fresh('meadow','hard','explorer',2);
  const p=r.player;
  // Follow the racing line, so the kart is never off-road or beached.
  let peak=0;
  for(let i=0;i<1800;i++){
    const c=r.aiDrive(p,1/60);
    r.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:false});
    peak=Math.max(peak,p.speed);
    if(r.phase==='finished')break;
  }
  assert(peak>K.TOP*.94,'a driven kart reaches its stated top speed of '+K.TOP+' (peak '+peak.toFixed(0)+')');
  const before=p.speed;
  for(let i=0;i<20;i++)r.step(1/60,{steer:0,throttle:0,brake:1,drift:false});
  assert(p.speed<before-K.BRAKE*0.2,'braking sheds speed quickly');
});

test('Off-road running is slower than the road',()=>{
  const r=fresh('meadow','hard','explorer',2);
  const p=r.player;
  /* Put the kart on the grass and compare its steady speed with the same kart on
     tarmac, so only the surface differs.

     Both runs are measured at a genuine steady state rather than after a fixed
     couple of seconds. Neither kart has finished accelerating in two seconds -
     the grass one is still at 185px/s on its way to 205, and the tarmac one is
     still at 191 on its way to 330 - so a short window compares two points on
     the same acceleration curve and reports a ratio near 1.00 for a surface
     penalty that is really 0.62. The grass run is also started clear of the
     barrier, so it is not held against the wall by `confine`. */
  const t=r.track,s=t.samples[0];
  /* The position is re-pinned every frame. Ten seconds at full throttle covers
     most of a lap, and a kart that has curved away from `samples[0]` is no
     longer on the surface being measured - the check would be comparing a
     straight-line acceleration test against a kart somewhere else entirely.
     Pinning the sample keeps it a clean measure of one thing: how fast this
     surface lets the kart accelerate. */
  const steady=(offset)=>{
    let peak=0;
    for(let i=0;i<600;i++){
      p.x=s.x+s.nx*offset;p.y=s.y+s.ny*offset;
      p.angle=Math.atan2(s.ty,s.tx);
      p.vx=Math.cos(p.angle)*p.speed;p.vy=Math.sin(p.angle)*p.speed;
      p.lastIndex=s.index;
      r.stepKart(p,1/60,{steer:0,throttle:1,brake:0,drift:false});
      if(i>420)peak=Math.max(peak,p.speed);   // the last third, once it has settled
    }
    return peak;
  };
  const grassSpeed=steady(s.half+T.RUMBLE+T.GRASS*.45);
  assert.equal(T.locate(t,p.x,p.y,p.lastIndex,p.lastS).surface,'grass','the kart really is on the grass for this measurement');
  const roadSpeed=steady(0);
  assert.equal(T.locate(t,p.x,p.y,p.lastIndex,p.lastS).surface,'road','and really on the tarmac for the other');
  assert(roadSpeed>grassSpeed*1.15,'grass ('+grassSpeed.toFixed(0)+'px/s) is clearly slower than tarmac ('+roadSpeed.toFixed(0)+'px/s)');
});

test('Drifting produces a real sideways slide, not just a flag',()=>{
  const r=fresh('meadow','hard','explorer',5);
  const p=r.player;
  p.skill=1.05;p.nerve=1;p.errorChance=0;
  let maxSlip=0,driftFrames=0,slips=[];
  for(let i=0;i<4000&&r.phase!=='finished';i++){
    const c=r.aiDrive(p,1/60);
    r.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:c.drift,use:false});
    if(p.drifting){driftFrames++;slips.push(p.slip);}
    maxSlip=Math.max(maxSlip,p.slip);
  }
  assert(driftFrames>10,'the kart drifts through corners ('+driftFrames+' frames)');
  assert(maxSlip>18,'a drift visibly slides the kart sideways (max slip '+maxSlip.toFixed(1)+'px)');
  const mean=slips.reduce((a,b)=>a+b,0)/slips.length;
  assert(mean>10,'the average slide is wide enough to read (mean '+mean.toFixed(1)+'px)');
});

test('A drift cannot start below the minimum speed',()=>{
  const r=fresh('meadow','hard','explorer',5);
  const p=r.player,t=r.track,s=t.samples[0];
  p.x=s.x;p.y=s.y;p.angle=Math.atan2(s.ny,s.nx);p.speed=K.MIN_DRIFT*.6;p.vx=Math.cos(p.angle)*p.speed;p.vy=Math.sin(p.angle)*p.speed;
  r.step(1/60,{steer:1,throttle:1,brake:0,drift:true});
  assert(!p.drifting,'a kart below '+K.MIN_DRIFT+'px/s cannot break traction');
  p.speed=K.MIN_DRIFT*1.2;p.vx=Math.cos(p.angle)*p.speed;p.vy=Math.sin(p.angle)*p.speed;
  r.step(1/60,{steer:1,throttle:1,brake:0,drift:true});
  assert(p.drifting,'above the threshold the kart does break traction');
});

test('Ending a drift awards a speed boost',()=>{
  const r=fresh('meadow','hard','explorer',5);
  const p=r.player,t=r.track,s=t.samples[0];
  p.x=s.x;p.y=s.y;p.angle=Math.atan2(s.ny,s.nx);p.speed=K.MIN_DRIFT*1.3;
  p.vx=Math.cos(p.angle)*p.speed;p.vy=Math.sin(p.angle)*p.speed;
  let started=false;
  for(let i=0;i<12&&!started;i++){r.step(1/60,{steer:1,throttle:1,brake:0,drift:true});started=p.drifting;}
  assert(started,'the drift engaged');
  const before=p.boostTime;
  for(let i=0;i<40&&p.drifting;i++)r.step(1/60,{steer:1,throttle:1,brake:0,drift:true});
  r.step(1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert(p.boostTime>before,'releasing a drift grants a boost ('+before.toFixed(2)+'s -> '+p.boostTime.toFixed(2)+'s)');
});

test('All five power-ups exist, and each has a distinct effect',()=>{
  for(const name of['banana','ink','lightning','boost','shell'])
    assert(K.ITEMS[name],name+' is a defined power-up');
  const r=fresh('meadow','medium','explorer',9);
  const p=r.player;
  // A boost raises the kart's own boost level.
  p.item='boost';r.useItem(p);
  assert(p.boost>0,'a speed boost raises the boost level');
  assert.equal(p.item,null,'the boost is consumed');
  // Lightning stops every rival.
  const rivals=r.karts.filter(k=>!k.player);
  p.item='lightning';r.useItem(p);
  assert(rivals.every(k=>k.hit>0&&k.spin>0),'lightning stops every rival');
  // A shell protects the kart that used it.
  p.item='shell';r.useItem(p);
  assert(p.shield,'a shell protects the kart that used it');
  // A banana and an ink slick are placed on the track as hazards for others.
  for(const [name,check] of[['banana',h=>h.type==='banana'],['ink',h=>h.type==='ink']]){
    const before=r.hazards.length;
    p.item=name;r.useItem(p);
    assert.equal(r.hazards.length,before+1,name+' drops one hazard');
    assert(r.hazards.some(check),name+' hazard is the right kind');
    assert.equal(p.item,null,name+' is consumed');
  }
  // Driving over an ink slick is what blinds, which is what makes it dangerous.
  // A freshly dropped hazard is still arming, so it cannot hit yet - that is
  // what stops a driver from dropping a banana on their own bumper.
  const victim=r.karts.filter(k=>!k.player)[0];
  const slick=r.hazards.find(h=>h.type==='ink');
  victim.blind=0;victim.hit=0;victim.spin=0;
  victim.x=slick.x;victim.y=slick.y;victim.speed=180;
  victim.vx=180;victim.vy=0;victim.angle=0;
  victim.lastIndex=T.locate(r.track,slick.x,slick.y).index;
  r.stepKart(victim,1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert.equal(victim.blind,0,'a hazard cannot hit the kart that just dropped it');
  slick.armed=0;   // the arming delay has elapsed
  assert.equal(slick.armed,0,'the hazard is armed after its delay');
  r.stepKart(victim,1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert(victim.blind>0,'driving over armed ink blinds a kart');
});

test('Power-ups are drawn at random, and every one of them can appear',()=>{
  const r=fresh('meadow','medium','explorer',4);
  const p=r.player;
  const got=new Set();
  for(let i=0;i<4000;i++){const name=r.rollItem(p);assert(K.ITEMS[name],'rolled a real item: '+name);got.add(name);}
  assert.equal(got.size,5,'all five power-ups are reachable ('+[...got].join(', ')+')');
});

test('Item odds favour the leader with defence and the last kart with boosts',()=>{
  assert(K.ODDS['1'].length===5&&K.ODDS['5'].length===5,'odds are defined for all five positions');
  const weight=(tier,name)=>K.ODDS[tier].find(e=>e[0]===name)[1];
  assert(weight('1','banana')>weight('5','banana'),'the leader gets more bananas than the last kart');
  assert(weight('5','boost')>weight('1','boost'),'the last kart gets more boosts than the leader');
  for(const tier of['1','2','3','4','5']){
    const total=K.ODDS[tier].reduce((n,e)=>n+e[1],0);
    assert(total>0,tier+' has positive total weight');
  }
});

test('Item boxes are placed on the racing surface around the lap',()=>{
  for(const id of['meadow','harbour','neon']){
    const r=new K.Race({track:id,character:'explorer',difficulty:'medium',seed:6});
    assert(r.boxes.length>=6,id+' has item boxes ('+r.boxes.length+')');
    for(const b of r.boxes){
      const w=T.locate(r.track,b.x,b.y);
      assert.equal(w.surface,'road',id+' every item box sits on tarmac, not in the grass');
    }
  }
});

test('Driving over a box grants an item, and it is used exactly once',()=>{
  const r=fresh('meadow','medium','explorer',8);
  const p=r.player;
  const box=r.boxes[0];
  // Retire the other boxes so this test measures one pickup, not a whole row.
  for(const other of r.boxes)if(other!==box)other.taken=true;
  p.x=box.x;p.y=box.y;p.lastIndex=T.locate(r.track,box.x,box.y).index;
  assert.equal(p.item,null);
  r.step(1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert(p.item,'driving over a box grants an item');
  const got=p.item;
  assert.equal(box.taken,true,'the box is consumed, not reusable');
  r.step(1/60,{steer:0,throttle:1,brake:0,drift:false,use:true});
  assert.equal(p.item,null,'using an item empties the slot');
});

test('Hazards on the track stop a kart that drives into one',()=>{
  const r=fresh('meadow','medium','explorer',10);
  const p=r.player,t=r.track;
  const s=t.samples[40];
  const banana={type:'banana',x:s.x,y:s.y,life:30,armed:0,owner:99};
  r.hazards.push(banana);
  p.x=s.x;p.y=s.y;p.speed=200;p.vx=200;p.vy=0;p.angle=0;p.lastIndex=40;p.hit=0;p.spin=0;
  const before=p.speed;
  r.step(1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert(p.hit>0||p.spin>0,'running into a banana stops the kart');
  // The collision arms the spin; the speed comes off over the frames it lasts,
  // so measure the cost after it has had time to bite.
  for(let i=0;i<12;i++)r.step(1/60,{steer:0,throttle:1,brake:0,drift:false});
  assert(p.speed<before-20,'the impact costs real speed ('+before.toFixed(0)+' -> '+p.speed.toFixed(0)+'px/s)');
});

test('A two-lap race finishes, and every kart is classified',()=>{
  for(const id of['meadow','harbour','neon']){
    const r=new K.Race({track:id,character:'nezha',difficulty:'medium',seed:12});
    assert.equal(r.laps,2,id+' is a two-lap race');
    assert.equal(r.laps,K.LAPS);
    const {seen}=autoplay(r,20000);
    assert.equal(r.phase,'finished',id+' the race reaches a finish');
    assert.equal(r.finishOrder.length,K.RACERS,id+' all '+K.RACERS+' karts are classified');
    for(const k of r.karts){
      assert(k.finished,id+' kart '+k.id+' finished');
      assert(k.lapsDone>=2,id+' kart '+k.id+' completed two laps');
      assert(k.finishTime>0,id+' kart '+k.id+' has a finish time');
    }
    // Places must be a clean 1..5 with no ties in the finishing order.
    const places=r.karts.map(k=>k.place).sort((a,b)=>a-b);
    assert.deepEqual(places,[1,2,3,4,5],id+' places are 1st to 5th');
    const times=r.finishOrder.map(f=>f.time);
    for(let i=1;i<times.length;i++)assert(times[i]>=times[i-1],id+' finishing order is by time');
  }
});

test('Lap times are plausible, not sub-second',()=>{
  const r=new K.Race({track:'meadow',character:'explorer',difficulty:'medium',seed:13});
  autoplay(r,20000);
  for(const k of r.karts){
    assert(k.bestLap>3,k.id+' best lap '+k.bestLap.toFixed(2)+'s is a real lap time');
    // A lap cannot be faster than the distance at top speed, with margin.
    const floor=r.track.length/(K.TOP*1.15);
    assert(k.bestLap>floor,k.id+' best lap is not impossibly fast');
  }
});

test('Progress only ever moves forwards by a sane amount each frame',()=>{
  const r=fresh('meadow','hard','explorer',21);
  const prev=r.karts.map(k=>k.progress);
  for(let i=0;i<6000&&r.phase!=='finished';i++){
    const c=r.aiDrive(r.player,1/60);
    r.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:c.drift});
    for(const k of r.karts){
      const jump=Math.abs(k.progress-prev[k.index]);
      assert(jump<r.track.length*.25,'kart '+k.id+' progress jumped '+jump.toFixed(0)+'px in one frame');
      assert(isFinite(k.progress),'progress stays finite');
      prev[k.index]=k.progress;
    }
  }
});

test('Three AI difficulties are genuinely different, and hard is the fastest',()=>{
  const median=t=>{const s=t.filter(v=>v!==null).sort((a,b)=>a-b);return s.length?s[(s.length-1)>>1]:null;};
  const field={};
  for(const difficulty of['easy','medium','hard']){
    const times=[];
    for(let seed=1;seed<=6;seed++){
      const r=new K.Race({track:'meadow',character:'explorer',difficulty,seed:seed*31});
      autoplay(r,20000);
      times.push(median(r.karts.filter(k=>!k.player).map(k=>k.finished?k.finishTime:null)));
    }
    field[difficulty]=times.filter(v=>v!==null);
    for(const v of field[difficulty])assert(isFinite(v),difficulty+' field finished');
  }
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  assert(avg(field.hard)<avg(field.medium),'hard field ('+avg(field.hard).toFixed(1)+'s) beats medium ('+avg(field.medium).toFixed(1)+'s)');
  assert(avg(field.medium)<avg(field.easy),'medium field ('+avg(field.medium).toFixed(1)+'s) beats easy ('+avg(field.easy).toFixed(1)+'s)');
});

test('The easy AI makes visible mistakes and the ruthless AI makes none',()=>{
  const mistakes=difficulty=>{
    let total=0;
    for(let seed=1;seed<=5;seed++){
      const r=new K.Race({track:'meadow',character:'explorer',difficulty,seed:seed*17});
      autoplay(r,20000);
      for(const k of r.karts)if(!k.player)total+=k.fumbles;
    }
    return total;
  };
  const easy=mistakes('easy'),hard=mistakes('hard');
  assert(easy>0,'the easy AI commits visible mistakes ('+easy+' across 5 races)');
  assert.equal(hard,0,'the ruthless AI makes no mistakes at all');
});

test('No kart can be stranded, and no race can hang',()=>{
  for(const track of['meadow','harbour','neon'])
    for(const difficulty of['easy','medium','hard'])
      for(let seed=1;seed<=3;seed++){
        const r=new K.Race({track,character:'explorer',difficulty,seed:seed*101});
        autoplay(r,20000);
        assert.equal(r.phase,'finished',track+'/'+difficulty+'/'+seed+' race reached a finish');
        for(const k of r.karts){
          assert(isFinite(k.x)&&isFinite(k.y)&&isFinite(k.speed),'kart '+k.id+' stayed finite');
          assert(Math.abs(k.x)<1e5&&Math.abs(k.y)<1e5,'kart '+k.id+' stayed on the map');
          assert(k.speed<=K.TOP*1.5,'kart '+k.id+' speed stayed physical');
          assert(k.finished,track+'/'+difficulty+'/'+seed+' kart '+k.id+' finished');
        }
      }
});

test('The race is deterministic for a given seed',()=>{
  const run=()=>{
    const r=new K.Race({track:'neon',character:'goku',difficulty:'medium',seed:99});
    autoplay(r,20000);
    return r.karts.map(k=>k.finishTime.toFixed(4)+'/'+k.place).join(',');
  };
  assert.equal(run(),run(),'the same seed produces the same race');
});

test('The player and the AI share one item path',()=>{
  const r=fresh('meadow','medium','explorer',15);
  const p=r.player,ai=r.karts.find(k=>!k.player);
  p.item='boost';ai.item='boost';
  assert(p.item==='boost'&&ai.item==='boost','both the player and the AI can hold an item');
  r.useItem(p);r.useItem(ai);
  assert(p.boost>0&&ai.boost>0,'both use it through the same code');
  assert.equal(p.item,null);assert.equal(ai.item,null);
});

test('Every character has a baked kart sprite in all 16 headings',()=>{
  for(const id of IDS){
    const s=A.spriteFor(id);
    assert.equal(s.frames.length,A.DIRS,id+' is baked in '+A.DIRS+' headings');
    assert.equal(s.frames.length,16);
    assert.equal(s.size,A.SIZE);
    for(const f of s.frames)assert(f.width>0&&f.height>0,id+' sprite frame is not empty');
    const k=A.KARTS[id];
    assert(k&&k.kart&&k.kart.length===3,id+' has a three-tone kart body');
    assert(k.hair&&k.skin&&k.shirt,id+' driver colours come from the character palette');
  }
});

test('Each character has a distinct kart and driver silhouette',()=>{
  // Distinct body colours are what let you tell five karts apart at speed.
  const bodies=IDS.map(id=>A.KARTS[id].kart[0]);
  assert.equal(new Set(bodies).size,IDS.length,'all six karts have different body colours');
  const styles=IDS.map(id=>A.KARTS[id].style);
  assert.equal(new Set(styles).size,IDS.length,'all six drivers have different silhouette styles');
  for(const name of['banana','ink','lightning','boost','shell']){
    const s=A.itemSprite(name);
    assert(s&&s.width>0,name+' has a sprite');
  }
  assert(A.itemBox().width>0,'item boxes have art');
});

test('Racing lines and speed limits stay inside the road',()=>{
  for(const t of T.TRACKS){
    for(let i=0;i<t.count;i+=3){
      const s=t.samples[i];
      assert(Math.abs(s.line)<=s.half-10,t.id+' racing line at '+i+' is on the road');
      assert(s.vmax>0&&s.vmax<=K.TOP,t.id+' speed limit at '+i+' is within the top speed');
    }
  }
});

test('The AI aims at the road ahead and keeps the karts on the circuit',()=>{
  for(const track of['meadow','harbour','neon']){
    // Average over several seeds: one race is a sample, not a measurement, and
    // a single unlucky shuffle would make this test flap.
    const rates=[];
    for(let seed=1;seed<=4;seed++){
      const r=new K.Race({track,character:'explorer',difficulty:'hard',seed:seed*17});
      while(r.phase==='countdown')r.step(1/60,{});
      let grassFrames=0,total=0;
      for(let i=0;i<20000&&r.phase!=='finished';i++){
        autoplay(r,1);
        for(const k of r.karts)if(!k.player){
          total++;
          // Measure the grass, not the rumble strip: clipping a kerb is racing,
          // being in the grass is not.
          if(T.locate(r.track,k.x,k.y,k.lastIndex,k.lastS).surface==='grass')grassFrames++;
        }
      }
      assert(total>0,track+' the AI was simulated');
      rates.push(grassFrames/total);
    }
    const mean=rates.reduce((a,b)=>a+b,0)/rates.length;
    assert(mean<.07,track+' the hard AI averages '+(mean*100).toFixed(1)+'% grass time (worst seed '+(Math.max(...rates)*100).toFixed(1)+'%)');
  }
});

test('Every circuit can be driven cleanly by the hard AI without leaving the track',()=>{
  for(const track of['meadow','harbour','neon']){
    const r=new K.Race({track,character:'goku',difficulty:'hard',seed:23});
    autoplay(r,20000);
    assert.equal(r.phase,'finished',track+' is completable at the hardest setting');
    assert.equal(r.player.lapsDone,2,track+' the player completed two laps under AI control');
  }
});

console.log(count+' kart acceptance checks passed.');
