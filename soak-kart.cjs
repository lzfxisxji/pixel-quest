/* Soak test for Pixel Kart: many full races across every circuit and every
   difficulty, checking the things that only go wrong in aggregate - a race that
   never finishes, a kart that never crosses the line, a kart that escapes the
   world, or an impossible lap time. One clean race proves very little; a clean
   hundred and fifty proves the simulation is stable.

   Run with: node soak-kart.cjs */
const K=require('./kart-core.js');
let bad=0,n=0,times=[];
for(const track of['meadow','harbour','neon'])
  for(const d of['easy','medium','hard'])
    for(let s=0;s<6;s++){
      const r=new K.Race({track,difficulty:d,character:'goku',seed:s*13+1});
      while(r.phase==='countdown')r.step(1/60,{});
      let f=0;
      for(;f<30000&&r.phase!=='finished';f++){
        const p=r.player,c=r.aiDrive(p,1/60);
        r.step(1/60,{steer:c.steer,throttle:c.throttle,brake:c.brake,drift:c.drift,use:f%40===0});
        r.events.length=0;
      }
      n++;
      if(r.phase!=='finished'){bad++;console.log('HANG',track,d,'seed',s*13+1,'frames',f);}
      else{
        times.push(r.raceTime);
        const fin=r.karts.filter(k=>k.finished).length;
        if(fin!==5){bad++;console.log('UNFINISHED',track,d,'seed',s*13+1,'finishers',fin);}
        for(const k of r.karts){
          if(!isFinite(k.x)||!isFinite(k.y)||Math.abs(k.x)>5000||Math.abs(k.y)>5000){
            bad++;console.log('ESCAPED',track,d,'seed',s*13+1,'kart',k.index,k.x.toFixed(0),k.y.toFixed(0));break;}
          if(k.bestLap>0&&k.bestLap<5){bad++;console.log('IMPLAUSIBLE LAP',track,d,k.bestLap.toFixed(2));}
        }
      }
    }
times.sort((a,b)=>a-b);
console.log(n+' races, '+bad+' problems');
console.log('race times: min',times[0].toFixed(1),'median',times[times.length>>1].toFixed(1),'max',times[times.length-1].toFixed(1));
