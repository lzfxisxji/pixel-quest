/* Pixel Kart: race simulation. Deterministic, fixed step, no dependencies.

   The one idea that carries the whole feel is that a kart's *heading* and its
   *velocity direction* are separate. Throttle pushes along the heading; grip
   pulls the velocity back towards it. When the player holds the drift key the
   grip is weak, so the back end steps out, the velocity keeps its old direction
   while the nose rotates - and the kart slides. That single separation is why
   drifting is a thing you can see, not a speed multiplier with a sound.

   Everything else follows the same rule: one source of truth. Position on the
   circuit comes from PixelKartTracks.locate, so the lap counter, the AI's racing
   line, the surface under the tyres and the minimap can never disagree. */
(function(root){
  'use strict';
  const {TRACKS,BY_ID,locate,ahead,pointAt,limitAhead,RUMBLE,GRASS}=root.PixelKartTracks
    ||(typeof require==='function'?require('./kart-tracks.js'):null);

  // Handling numbers, in logical pixels and seconds. Shared by every kart so the
  // field is decided by driving, not by stats.
  const TOP=330;             // top speed on tarmac
  const ACCEL=430;           // how fast speed is built
  const BRAKE=760;           // braking under load
  const COAST=170;           // engine braking when off the throttle
  /* A spin costs about 0.45s and has to hurt enough to matter: bleeding only
     62% a second left a spun kart at 75% of its entry speed, so it simply kept
     racing and stayed in the pack, colliding again on the next corner. Bleeding
     a *fraction* rather than a flat amount per second is deliberate - a flat
     430px/s drove speed to exactly zero, and a kart at zero has no steering
     authority at all, so it sat motionless mid-corner until the next kart
     arrived and pushed it onto the grass. The floor is what makes a hit
     recoverable: still a punishing loss of time, but the kart drives out. */
  const SPIN_SCRUB=2.6;        // fraction of speed bled per second while spinning
  const SPIN_MIN=45;           // px/s floor while a spin is resolving
  // Terminal velocity. The engine pushes with a constant force and drag rises
  // linearly with speed, so equilibrium sits at exactly ACCEL/DRAG = TOP: the
  // number in the spec is the speed the kart reaches, not a ceiling it never
  // gets to. Boost scales both together, so a boosted kart really is faster.
  const DRAG=ACCEL/TOP;
  const GRIP=9.5;            // how hard velocity is pulled back to the heading
  const DRIFT_GRIP=1.15;     // ...and how weakly, while drifting
  const STEER=3.05;          // steering rate at speed
  const DRIFT_STEER=3.9;     // a drifting kart rotates faster - that is the point
  const DRIFT_BREAK=1.5;      // sliding speed at which the drift breaks loose
  const MIN_DRIFT=95;        // too slow to initiate a drift
  const OFFROAD=0.62;        // grip and top-speed multiplier off the tarmac
  const HIT_TIME=0.85;       // how long a hazard or bump stops you
  const MAX_RECOVER=8;       // px of barrier correction per frame
  // A kart that has run wide keeps enough speed to steer itself back onto the
  // tarmac. Steering authority scales with speed, so without a floor a kart that
  // slowed down in the grass could never turn towards the road again.
  const GRASS_FLOOR=95;      // px/s - enough steering authority to drive out
  // A kart that somehow ends up far outside the circuit is walked back towards it
  // rather than trusted, so a bad frame can never launch a kart into infinity and
  // leave the race unable to finish.
  const LOST_LIMIT=200;      // px outside the barrier line before recovery starts
  const BODY=13;             // collision radius
  const RACERS=5;
  const LAPS=2;
  /* Difficulty scales the whole field, never the player's kart. `skill` is the
     corner speed each AI trusts, `nerve` is how close to the limit it dares run,
     and `mistake` is how often it gets something wrong. Easy is deliberately
     forgiving: slower reactions and real, visible errors. */
  /* `field` scales how close to the physical corner limit the AI drives. It can
     only ever be at or below 1: `vmax` is what the tyres can actually hold, so a
     value above it does not make a better driver, it just drives into the grass
     on every corner. Skill above the limit is expressed through the racing line
     and drift timing instead. `mistake` is the chance per decision of a visible
     fumble, and hard is deliberately mistake-free. */
  const DIFFICULTIES=Object.freeze({
    easy:{field:.90,nerve:.90,mistake:.11,label:'Relaxed' },
    medium:{field:.96,nerve:.95,mistake:.04,label:'Competitive'},
    hard:{field:1,nerve:1.0,mistake:0,label:'Ruthless'}
  });

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const wrapAngle=a=>{while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;};
  const ITEMS=Object.freeze({
    banana:{name:'Banana',armed:.35},
    ink:{name:'Ink Slick',armed:.5},
    lightning:{name:'Lightning',armed:0},
    boost:{name:'Boost',armed:0},
    shell:{name:'Bubble Shield',armed:0}
  });
  // Item odds shift with race position, so the leader is never handed a banana
  // while the last kart is trusted with a boost. Weighted, not scripted.
  const ODDS={
    1:[['banana',30],['ink',22],['lightning',18],['boost',10],['shell',20]],
    2:[['banana',26],['ink',22],['lightning',18],['boost',16],['shell',18]],
    3:[['banana',22],['ink',20],['lightning',16],['boost',24],['shell',18]],
    4:[['banana',18],['ink',16],['lightning',14],['boost',34],['shell',18]],
    5:[['banana',12],['ink',12],['lightning',10],['boost',52],['shell',14]]
  };

  class Race{
    constructor(options={}){
      this.options={track:'meadow',character:'explorer',difficulty:'medium',laps:LAPS,...options};
      this.track=BY_ID[this.options.track]||TRACKS[0];
      this.laps=this.options.laps||this.track.laps||LAPS;
      this.seed=(options.seed??1)>>>0;
      this.fxSeed=((options.seed??1)^0x9e3779b9)>>>0;
      this.tick=0;this.paused=false;this.phase='countdown';this.countdown=3.2;
      this.clock=0;this.raceTime=0;this.events=[];this.finishOrder=[];
      this.hazards=[];this.particles=[];this.boxes=this.buildBoxes();
      this.entrants=this.pickEntrants();
      this.karts=this.entrants.map((e,i)=>this.newKart(i,e));
      this.sparks=[];
    }
    random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    // A second, independent stream. Particles and fumbles draw from here so the
    // number of sparks a kart happens to shed can never shift the item rolls:
    // race outcomes stay a function of the seed, not of how busy the screen got.
    fx(){this.fxSeed=(Math.imul(this.fxSeed,1664525)+1013904223)>>>0;return this.fxSeed/4294967296;}
    get tier(){return DIFFICULTIES[this.options.difficulty]||DIFFICULTIES.medium;}
    // One player plus four AI, all six characters available, never duplicated.
    pickEntrants(){
      const ids=Object.keys(root.PixelKartAssets?root.PixelKartAssets.KARTS:{explorer:1,soldier:1,mystic:1,dora:1,goku:1,nezha:1});
      const pool=ids.filter(id=>id!==this.options.character);
      for(let i=pool.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
      const tier=this.tier;
      return [{id:this.options.character,player:true,skill:1,nerve:1,errorChance:0},...pool.slice(0,RACERS-1).map((id,i)=>{
        // A small spread inside the tier, so four rivals do not drive as one kart.
        // The spread only ever goes below 1 - see DIFFICULTIES on why.
        const offset=[.985,.94,.9,.86][i]??1;
        return {id,player:false,skill:tier.field*offset,nerve:tier.nerve,errorChance:tier.mistake};
      })];
    }
    newKart(index,entrant){
      const slot=this.track.slots[index],L=this.track.length;
      const seed=locate(this.track,slot.x,slot.y);
      /* The grid sits a little behind the start line, so a kart begins with
         *negative* progress and its first crossing of the line starts lap 1
         rather than completing it. Starting from the raw sample distance would
         begin the count a whole lap high and award a bogus sub-second lap. */
      const startS=seed.s-L;
      return {index,id:entrant.id,player:!!entrant.player,skill:entrant.skill,
        nerve:entrant.nerve??1,errorChance:entrant.errorChance??0,
        x:slot.x,y:slot.y,angle:slot.angle,vx:0,vy:0,speed:0,
        steer:0,throttle:0,brake:0,drifting:false,driftTime:0,driftDir:0,
        slip:0,boost:0,boostTime:0,hit:0,spin:0,blind:0,shield:false,
        item:null,itemAge:0,wantUse:false,
        // fumble: time left in a mistake; fumbleWait: time until the next one is
        // considered. driftHold/driftCool govern how long a slide is committed to.
        fumble:0,fumbleWait:1+index*1.7,driftHold:0,driftCool:0,fumbles:0,dodge:0,
        lapsDone:0,progress:startS,
        lastS:startS,lastIndex:seed.index,
        place:index+1,finished:false,finishTime:0,bestLap:0,lapStart:0,lastLap:0,
        offroad:false,surface:'road',wheelSpin:0,bodyRoll:0,lateral:0,lateralVisual:0};
    }
    // Item boxes: a few rows around the lap, three abreast, always on the racing
    // surface so none of them is placed somewhere unreachable.
    buildBoxes(){
      const t=this.track,boxes=[],rows=[.18,.44,.68,.88];
      for(const f of rows){
        for(let lane=-1;lane<=1;lane++){
          const index=Math.floor(f*t.count)%t.count,p=t.samples[index];
          const offset=lane*Math.min(13,p.half*.42);
          boxes.push({x:p.x+p.nx*offset,y:p.y+p.ny*offset,index,taken:false,phase:boxes.length*.7});
        }
      }
      return boxes;
    }
    get player(){return this.karts[0];}

    /* ---- items ---------------------------------------------------------- */
    rollItem(place){
      const table=ODDS[clamp(place,1,5)]||ODDS[3];
      let roll=this.random()*table.reduce((a,b)=>a+b[1],0);
      for(const[name,weight]of table){roll-=weight;if(roll<=0)return name;}
      return 'boost';
    }
    giveBox(kart,box){
      if(!box.taken&&!kart.item){
        box.taken=true;
        const place=this.positionOf(kart);
        kart.item=this.rollItem(place);
        kart.itemAge=0;
        this.events.push({type:'item',kart:kart.index,name:kart.item,place});
        this.burst(box.x,box.y,'#ffe6a0',10,26);
      }
    }
    // Any kart can spend its own item, so the player and the AI go through the
    // same code path and the same rules.
    useItem(kart){
      if(!kart.item||kart.hit>0)return false;
      const name=kart.item;
      if(ITEMS[name]&&ITEMS[name].armed>0){
        // A placed hazard drops behind the kart, on the road it is actually on.
        const behind=26;
        this.hazards.push({type:name,x:kart.x-Math.cos(kart.angle)*behind,y:kart.y-Math.sin(kart.angle)*behind,
          life:26,armed:ITEMS[name].armed,owner:kart.index});
        kart.item=null;
        this.events.push({type:'drop',kart:kart.index,name});
        return true;
      }
      if(name==='boost'){
        kart.boost=1;kart.boostTime=1.5;
        this.events.push({type:'boost',kart:kart.index});
      }else if(name==='lightning'){
        for(const other of this.karts){
          if(other===kart)continue;
          other.hit=Math.max(other.hit,HIT_TIME);
          other.spin=1;
          other.shield=false;
        }
        kart.boost=1;kart.boostTime=.7;
        this.events.push({type:'lightning',kart:kart.index});
      }else if(name==='shell'){
        kart.shield=true;
      }
      kart.item=null;
      return true;
    }
    startDrift(kart){
      if(kart.drifting||kart.speed<MIN_DRIFT||kart.hit>0)return false;
      kart.drifting=true;kart.driftTime=0;kart.driftDir=0;
      this.events.push({type:'drift',kart:kart.index});
      return true;
    }
    endDrift(kart){
      if(!kart.drifting)return;
      kart.drifting=false;
      // A drift only pays if it lasted: a quick tap gives a nudge, a long one a
      // proper launch. Both reward committing to the corner.
      const t=kart.driftTime;
      if(t>.34){kart.boost=1;kart.boostTime=clamp(t*.5,.28,1.35);this.events.push({type:'boost',kart:kart.index});}
      kart.driftTime=0;
    }

    /* ---- physics -------------------------------------------------------- */
    stepKart(kart,dt,input){
      kart.hit=Math.max(0,kart.hit-dt);
      kart.blind=Math.max(0,kart.blind-dt);
      kart.spin=Math.max(0,kart.spin-dt*2.2);
      kart.boostTime=Math.max(0,kart.boostTime-dt);
      kart.itemArmed=Math.max(0,kart.itemArmed-dt);
      kart.boost=clamp(kart.boost+(kart.boostTime>0?dt*3:-dt*2.2),0,1);
      if(kart.boostTime<=0)kart.boost=Math.max(0,kart.boost-dt*1.6);

      const hit=kart.hit>0;
      const spin=kart.spin>0;
      let steer=input.steer||0,throttle=input.throttle||0,brake=input.brake||0;
      /* A hit stops you, but it must not *park* you.

         Zeroing the throttle outright meant a hit kart simply coasted: with no
         drive and no brake the only force left was engine braking, so it decayed
         from 45px/s to a dead stop in a quarter second and then sat there - and
         because steering authority scales with speed, a kart at zero could not
         steer itself out of the grass it had been knocked into. It stayed there
         for the rest of the race. A stunned kart now keeps a reduced throttle so
         it can drive itself out, and keeps steering authority for the same
         reason; the punishment is the lost speed and the blind swing, not a
         stranded kart. */
      if(hit||spin){throttle=Math.min(throttle,.45);brake=0;}
      if(kart.blind>0)steer*=.12;                    // ink: the kart still goes, but cannot be aimed

      const where=locate(this.track,kart.x,kart.y,kart.lastIndex,kart.lastS);
      kart.lastIndex=where.index;kart.lastS=where.s;kart.progress=where.s;
      kart.offroad=where.surface!=='road';
      const surface=where.surface;
      // Rumble shakes the kart and costs a little grip; grass costs a lot of both.
      const rumble=surface==='rumble';
      const gripScale=kart.offroad?OFFROAD:rumble?.82:1;
      const topScale=kart.offroad?OFFROAD:1;

      // --- drift state
      if(input.drift){
        if(!kart.drifting)this.startDrift(kart);
      }else if(kart.drifting)this.endDrift(kart);
      if(kart.drifting&&(kart.speed<MIN_DRIFT*.6||hit||spin))this.endDrift(kart);
      if(kart.drifting){
        kart.driftTime+=dt;
        if(kart.driftDir===0&&Math.abs(steer)>.25)kart.driftDir=Math.sign(steer);
        // Holding opposite lock mid-drift tightens the rotation, like a real slide.
        if(kart.driftDir!==0&&Math.sign(steer)===-kart.driftDir)steer=kart.driftDir;
      }

      // --- speed along the heading
      // Constant drive force, linear drag, one balance point at `top`. Grass and
      // kerbs scale the force rather than clamping the result, so running wide
      // costs you acceleration and top speed but never produces a hard stop.
      const top=TOP*topScale*(1+.34*kart.boost);
      if(throttle>0)kart.speed+=ACCEL*topScale*throttle*(1+.34*kart.boost)*dt;
      if(brake>0)kart.speed-=BRAKE*brake*dt;
      if(!throttle&&!brake)kart.speed-=COAST*dt;
      // Rolling resistance and air drag, scaled so they sum to ACCEL at `top`.
      kart.speed-=DRAG*kart.speed*dt;
      if(kart.drifting)kart.speed-=Math.abs(kart.slip)*1.1*dt;   // sliding scrubs speed
      /* A spin has to scrub speed, or a kart that is hit at 250px/s keeps all of
         it while travelling sideways with no steering at all and a 33px half-width
         road cannot contain it. Bleeding a *fraction* of the speed rather than a
         flat amount per second is what makes a hit recoverable: the loss is
         proportional, so it never reaches zero, and a kart that still has a
         crawl of speed still has the steering authority to drive itself out. */
      if(spin)kart.speed=Math.max(kart.speed*(1-SPIN_SCRUB*dt),SPIN_MIN);
      kart.speed=clamp(kart.speed,0,top);

      // --- rotation
      const authority=clamp(kart.speed/120,0,1);
      let rate=(kart.drifting?DRIFT_STEER:STEER)*authority*gripScale;
      if(kart.drifting)rate*=1+.5*clamp(kart.slip/90,0,1);       // more angle, more rotation
      kart.angle+=steer*rate*dt+(kart.spin>0?kart.spin*7*dt:0);
      kart.steer+=(steer-kart.steer)*Math.min(1,dt*12);

      /* --- velocity: this is where a drift actually happens.

         The velocity vector is CARRIED over from the previous frame, not rebuilt
         from the heading. Rebuilding it every frame is the bug that makes a
         drift invisible: with vx initialised to the heading there is nothing for
         grip to correct, so the slip angle stays at exactly zero and the kart
         rotates on the spot instead of sliding. Carrying v forward and letting
         grip pull it back towards the nose is the whole mechanic - while
         drifting, grip is weak, so the tail steps out and the kart keeps going
         the way it was going while the nose points somewhere new. */
      const dirX=Math.cos(kart.angle),dirY=Math.sin(kart.angle);
      if(hit||spin){
        // Stunned: the velocity is not under the kart's control any more.
        kart.vx=dirX*kart.speed;kart.vy=dirY*kart.speed;
      }else{
        const grip=(kart.drifting?DRIFT_GRIP:GRIP)*gripScale;
        const blend=1-Math.exp(-grip*dt);
        kart.vx+=(dirX*kart.speed-kart.vx)*blend;
        kart.vy+=(dirY*kart.speed-kart.vy)*blend;
      }
      const vx=kart.vx,vy=kart.vy;
      kart.slip=kart.drifting?Math.hypot(dirX*kart.speed-vx,dirY*kart.speed-vy):0;
      // Body roll: the kart leans into the corner, and slides flatter when drifting.
      kart.lateralVisual+=(kart.slip-kart.lateralVisual)*Math.min(1,dt*10);
      kart.bodyRoll+=(kart.steer*.34+kart.lateralVisual*.012-kart.bodyRoll)*Math.min(1,dt*9);
      kart.wheelSpin+=kart.speed*dt*.08;

      // --- integrate, then keep the kart inside the barriers
      kart.x+=kart.vx*dt;kart.y+=kart.vy*dt;
      this.confine(kart,where);

      // --- hazards under the wheels
      for(const h of this.hazards){
        if(h.armed>0)continue;
        if(Math.hypot(kart.x-h.x,kart.y-h.y)<BODY+5){
          if(kart.shield){kart.shield=false;h.life=Math.min(h.life,.01);this.burst(kart.x,kart.y,'#9fe8ff',14,30);this.events.push({type:'block',kart:kart.index});continue;}
          if(h.type==='banana'){kart.spin=1;kart.hit=Math.max(kart.hit,.5);}
          else if(h.type==='ink'){kart.blind=1.6;kart.hit=Math.max(kart.hit,.35);}
          h.life=0;
          this.events.push({type:'hit',kart:kart.index,by:h.type,owner:h.owner});
        }
      }
    }
    // Barriers: push back onto the circuit and scrub the speed that went into them.
    // The offset is measured along the sample normal n=(-ty,tx), so a kart sitting
    // `dist-edge` past the edge is exactly that far along side*n from the road:
    // stepping by -side*n lands it back on the barrier line. The correction is
    // also capped, so even a wildly out-of-place kart is nudged back over a few
    // frames instead of being teleported across the map.
    confine(kart,where){
      const t=this.track;
      const here=locate(t,kart.x,kart.y,kart.lastIndex,kart.lastS);
      const edge=here.sample.half+RUMBLE+GRASS;
      const dist=Math.abs(here.offset);
      if(dist<=edge)return;
      const side=Math.sign(here.offset)||1;
      const push=Math.min(dist-edge,MAX_RECOVER);
      kart.x-=here.sample.nx*side*push;
      kart.y-=here.sample.ny*side*push;
      const nx=-here.sample.nx*side,ny=-here.sample.ny*side;    // back towards the road
      const into=kart.vx*nx+kart.vy*ny;
      if(into<0){kart.vx-=nx*into*1.35;kart.vy-=ny*into*1.35;}
      /* Scrub for hitting the wall, but never to a standstill.

         A flat factor applied every frame the kart is out of bounds is a death
         spiral: at 60fps 0.82^60 is about four-millionths, so a kart that ran
         wide was pinned at the barrier line at walking pace within a quarter
         second - and because steering authority scales with speed, a kart that
         slow could never turn back towards the road. It sat in the grass
         indefinitely. Scrubbing on the size of the impact, and holding a floor,
         keeps the wall soft without turning it into a trap.

         The floor is a *grass* speed, not a kart speed: a kart held against the
         barrier is off the tarmac by definition, and letting it keep accelerating
         there meant a kart in the grass reached 190px/s against 191 on the road -
         no penalty at all for going off. Capping at the offroad top speed means
         the wall costs what the grass costs, and the floor only stops it stopping
         dead, which is what made it unrecoverable in the first place. */
      if(into<-20)kart.speed=Math.max(kart.speed*0.94,SPIN_MIN);
      kart.speed=Math.min(kart.speed,TOP*OFFROAD);
      if(kart.drifting)this.endDrift(kart);
    }
    // Karts are solid: shoving happens, and both parties slow down for it.
    resolveContacts(){
      for(let i=0;i<this.karts.length;i++)for(let j=i+1;j<this.karts.length;j++){
        const a=this.karts[i],b=this.karts[j];
        const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
        const min=BODY*2;
        if(dist>=min||dist<1e-6)continue;
        const nx=dx/dist,ny=dy/dist,overlap=(min-dist)/2;
        a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
        const rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
        if(rel<0){
          const jimp=-rel*.62;
          a.vx-=nx*jimp;a.vy-=ny*jimp;b.vx+=nx*jimp;b.vy+=ny*jimp;
          a.speed*=.9;b.speed*=.9;
          if(Math.abs(rel)>110){
            for(const k of[a,b]){if(k.shield){k.shield=false;continue;}k.hit=Math.max(k.hit,.35);}
            this.events.push({type:'bump',a:i,b:j});
          }
        }
      }
    }
    burst(x,y,color,count=12,speed=40){
      for(let i=0;i<count;i++){
        const a=this.fx()*Math.PI*2,v=this.fx()*speed;
        this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.3+this.fx()*.3,color,size:1+Math.floor(this.fx()*2)});
      }
    }
    /* ---- the AI --------------------------------------------------------- */
    /* Every AI aims at a point on the racing line ahead of it and brakes to the
       speed that corner will still be drivable at. Corner-entry speed therefore
       comes out of the track geometry rather than a difficulty number, and the
       tier only decides how close to that limit each driver is willing to run.

       On top of that sits `fumble`: at the easier tiers an AI periodically
       lifts, runs wide or locks a wheel, and visibly loses time doing it. Those
       are timed events rather than per-frame dice, so a mistake is something you
       can watch happen and take advantage of, not a permanent handicap. */
    aiDrive(kart,dt){
      const t=this.track;
      const here=locate(t,kart.x,kart.y,kart.lastIndex,kart.lastS);
      const look=clamp(58+kart.speed*.34,60,190);
      const aim=ahead(t,here.index,look);
      /* Aim at the racing line, then subtract the kart's own distance from it.
         Without that cross-track term a kart that is pushed wide keeps aiming at
         the same absolute point, so it drives parallel to the line instead of
         converging back onto it. The gain is deliberately gentle: raising it
         enough to correct faster at racing speed just makes the field weave, and
         measured grass time got worse rather than better. */
      const lineHere=here.sample.line;
      let lateral=aim.line*clamp(1.2-Math.abs(aim.k)*180,.25,1.2);
      lateral=clamp(lateral-(here.offset-lineHere)*0.7,-here.sample.half+9,here.sample.half-9);
      /* Steer around a hazard sitting on the road just ahead, rather than into it.

         The dodge is applied as a *bias on the racing line* and is scaled by how
         much room the chosen side actually has, then eased in over a few frames
         through `kart.dodge`. Snapping the aim point a fixed 22px sideways every
         frame instead used to make the kart overshoot its own avoidance and put
         itself in the grass - which is how 8% of the hard field's time ended up
         off the tarmac, entirely from item play. */
      let dodge=0,dodgeRoom=0;
      for(const h of this.hazards){
        if(h.life<=0)continue;
        const dx=h.x-kart.x,dy=h.y-kart.y;
        const ahead=dx*Math.cos(kart.angle)+dy*Math.sin(kart.angle);
        if(ahead<6||ahead>look*1.15)continue;
        const side=dx*Math.sin(kart.angle)-dy*Math.cos(kart.angle);
        if(Math.abs(side)>26)continue;
        // Pick the side with more room and commit to it, so the AI does not
        // weave between two hazards that are barely clear of each other.
        const room=here.sample.half-9;
        dodge=side>0?-1:1;
        if(Math.abs(here.offset+dodge*(Math.abs(side)+13))>room)dodge=-dodge;
        dodgeRoom=Math.max(dodgeRoom,Math.abs(side)+13);
      }
      const wantDodge=dodge?clamp(dodgeRoom/(here.sample.half-9),.35,1):0;
      kart.dodge+=(wantDodge-kart.dodge)*Math.min(1,dt*7);
      if(dodge)lateral=clamp(here.offset+dodge*dodgeRoom*kart.dodge,-here.sample.half+7,here.sample.half-7);
      const target=pointAt(t,aim.i,lateral);
      // Every AI owns a private fumble schedule, advanced on its own little
      // stream. The choice of *when* to make a mistake is therefore independent
      // of how many other karts are drawing random numbers, so a field on Easy
      // is reliably slower than the same field on Hard.
      kart.fumbleWait-=dt;
      if(kart.errorChance>0&&kart.fumble<=0&&kart.fumbleWait<=0&&kart.speed>40){
        if(this.fx()<kart.errorChance){kart.fumble=.5+this.fx()*.9;kart.fumbles++;}
        else kart.fumbleWait=1.2+this.fx()*2.4;
      }
      const fumble=kart.fumble>0;
      if(fumble)kart.fumble-=dt;
      // A fumbled AI trusts less of the corner: it brakes early and steers wide.
      const nerve=kart.nerve*(fumble?.82:1);
      /* Confidence margin. A driver already off the racing line has less room
         to spare than the raw corner limit suggests, so back off in proportion
         to how far off line it is. Without this the quickest AI sits exactly on
         the limit with no reserve, loses it on the first bump, and ends up
         slower than a more cautious rival. */
      const off=Math.abs(here.offset-here.sample.line);
      const margin=clamp(1-off/(here.sample.half*1.5),.68,1);
      const limit=limitAhead(t,here.index,look*(fumble?1.25:.9))*kart.skill*nerve*margin;
      let throttle=1,brake=0;
      if(kart.speed>limit*1.06){throttle=0;brake=clamp((kart.speed-limit)/70,0,1);}
      else if(kart.speed>limit)throttle=.35;
      if(kart.offroad){throttle=1;brake=0;}
      const desired=Math.atan2(target.y-kart.y,target.x-kart.x);
      const error=wrapAngle(desired-kart.angle);
      let steer=clamp(error*2.6,-1,1);
      if(fumble)steer=clamp(steer*.45+(this.fx()-.5)*.7,-1,1);   // a genuine error
      if(Math.abs(error)>2.1){throttle=0.3;steer=clamp(error*3,-1,1);}
      // Stranded well outside the circuit, everything else is secondary: point
      // the nose at the nearest piece of road and drive back onto the circuit.
      if(Math.abs(here.offset)>here.sample.half+RUMBLE+GRASS+LOST_LIMIT){
        const centre=pointAt(t,here.index,0);
        steer=clamp(wrapAngle(Math.atan2(centre.y-kart.y,centre.x-kart.x)-kart.angle)*2.4,-1,1);
        throttle=1;brake=0;
      }
      /* A kart that is off the road - or spinning helplessly towards it - stops
         racing and starts recovering: aim at the centre of the road, take the
         racing line's speed back, and hold it there until it is back on tarmac.
         Without this a single spin on a straight was unrecoverable, because a
         spun kart has no steering authority and simply slides into the grass. */
      const stranded=kart.offroad||kart.spin>0;
      if(stranded){
        /* Aim at the centre of the road *ahead*, not at the nearest point on it.
           Aiming at `here.index` points at a spot the kart has already passed, so
           on a curve the recovery target sits behind the kart and it steers the
           wrong way, which is how it stayed in the grass. */
        const aheadIndex=(here.index+Math.round(look*.5))%t.count;
        const centre=pointAt(t,aheadIndex,0);
        steer=clamp(wrapAngle(Math.atan2(centre.y-kart.y,centre.x-kart.x)-kart.angle)*2.6,-1,1);
        throttle=1;brake=0;
      }
      /* Drifting is committed to, not held forever. A kart enters a slide on a
         tight corner, carries it for a fixed beat, then straightens to take the
         exit. Without that release a kart that started a drift on lap one would
         still be sideways on lap two, and the whole field would look like one
         continuous slide rather than four drivers taking their corners.

         The trigger is the corner itself, measured as how much the limit ahead
         drops below the top speed - a curvature constant would only fire on the
         four or five hairpins per lap, and a drift is exactly what the long
         sweepers want too. It also has to be reachable: a slide needs enough
         speed to be worth having, and never above the corner's own limit. */
      const limitNow=limitAhead(t,here.index,look*.55);
      const tight=clamp(1-limitNow/TOP,0,1);
      const wantDrift=tight>.06&&limitNow>MIN_DRIFT*1.12&&kart.speed>MIN_DRIFT*1.05
        &&!kart.offroad&&!fumble&&Math.abs(here.offset)<here.sample.half*.7;
      if(wantDrift&&!kart.drifting&&kart.driftCool<=0){
        kart.driftHold=clamp(.4+tight*1.2,.4,1.15);   // tighter corner, longer slide
        /* The gap between slides has to be short. A slide is worth having on
           every corner worth sliding at, and a cooldown of the slide's own
           length plus a fixed margin blocked 293 of the 300 frames per lap
           where a drift was otherwise wanted - the field measurably stopped
           drifting (0.1s of slide per 100s of racing). A fifth of a second is
           enough to stop a kart from sawing at the wheel on one long bend. */
        kart.driftCool=kart.driftHold+.2;
      }
      if(kart.drifting&&kart.driftTime>kart.driftHold)kart.driftCool=Math.max(kart.driftCool,.25);
      /* A slide also has to *end* when the corner does, not only when its timer
         runs out. Holding the committed slide past the apex used to carry the
         kart onto the exit kerb and into the grass, because a slide has almost no
         grip and the AI was still asking for lock well after the road had
         opened up. Once the corner ahead is no longer tight, the drift is
         released immediately so the kart can drive out of it. */
      if(kart.drifting&&tight<.05)kart.driftHold=Math.min(kart.driftHold,kart.driftTime);
      kart.driftCool-=dt;
      const drift=wantDrift&&(kart.drifting||kart.driftCool<=0);
      this.aiItems(kart,dt);
      return {steer,throttle,brake,drift};
    }
    aiItems(kart,dt){
      if(kart.item){
        kart.itemAge=(kart.itemAge||0)+dt;
        if(kart.itemAge<1.1)return;
        const name=kart.item;
        if(name==='boost'||name==='lightning'||name==='shell'){kart.item=null;kart.wantUse=true;return;}
        // Drop a hazard when a rival is close behind, otherwise keep it.
        let behind=false;
        for(const other of this.karts){
          if(other===kart)continue;
          const d=Math.hypot(other.x-kart.x,other.y-kart.y);
          if(d<95&&this.behind(other,kart)){behind=true;break;}
        }
        if(behind){kart.item=null;kart.wantUse=true;}
        return;
      }
      kart.itemAge=0;
    }
    behind(a,b){
      const d=Math.atan2(b.y-a.y,b.x-a.x);
      return Math.abs(wrapAngle(d-b.angle))<1.5;
    }
    step(dt,input={}){
      if(this.paused||this.phase==='finished')return;
      dt=clamp(dt,0,1/30);
      this.tick+=dt;
      if(this.phase==='countdown'){
        this.countdown-=dt;
        if(this.countdown<=0){this.phase='racing';this.events.push({type:'go'});}
        return;
      }
      this.raceTime+=dt;
      if(input.use)this.useItem(this.player);
      for(const kart of this.karts){
        const control=kart.player
          ?{steer:input.steer||0,throttle:input.throttle||0,brake:input.brake||0,drift:!!input.drift}
          :this.aiDrive(kart,dt);
        if(kart.wantUse){this.useItem(kart);kart.wantUse=false;}
        this.stepKart(kart,dt,control);
      }
      this.resolveContacts();
      // Item boxes: whoever reaches one first takes it, so a race for position
      // through a box row is a real thing that happens.
      for(const box of this.boxes){
        if(box.taken)continue;
        for(const kart of this.karts){
          if(Math.hypot(kart.x-box.x,kart.y-box.y)<BODY+8){this.giveBox(kart,box);break;}
        }
      }
      for(const h of this.hazards){h.armed=Math.max(0,h.armed-dt);h.life-=dt;}
      this.hazards=this.hazards.filter(h=>h.life>0);
      for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;p.life-=dt;}
      this.particles=this.particles.filter(p=>p.life>0);
      this.updateLaps();
      this.updatePlaces();
      if(this.karts.every(k=>k.finished))this.phase='finished';
    }
    /* Laps are counted from the unwrapped distance locate() returns, which is
       monotonic across the start line, so a lap cannot be lost by cutting. */
    updateLaps(){
      const t=this.track;
      for(const kart of this.karts){
        if(kart.finished)continue;
        const lap=Math.floor(kart.progress/t.length);
        if(lap>kart.lapsDone){
          const time=this.raceTime-kart.lapStart;
          kart.lapStart=this.raceTime;
          if(kart.lapsDone>0&&time>0)kart.lastLap=time;
          if(time>0)kart.bestLap=kart.bestLap?Math.min(kart.bestLap,time):time;
          kart.lapsDone=lap;
          if(lap>=this.laps){
            kart.finished=true;kart.finishTime=this.raceTime;
            this.finishOrder.push({kart:kart.index,time:this.raceTime});
            this.events.push({type:'finish',kart:kart.index,place:this.finishOrder.length});
          }else this.events.push({type:'lap',kart:kart.index,lap:lap+1});
        }
      }
    }
    positionOf(kart){
      const t=this.track;
      return this.karts.filter(k=>k.finished).length+1+
        this.karts.filter(k=>!k.finished&&k.progress>kart.progress).length;
    }
    updatePlaces(){
      const order=[...this.karts].sort((a,b)=>{
        if(a.finished&&b.finished)return a.finishTime-b.finishTime;
        if(a.finished)return -1;
        if(b.finished)return 1;
        return b.progress-a.progress;
      });
      order.forEach((k,i)=>k.place=i+1);
      this.order=order;
    }
    snapshot(){
      return {phase:this.phase,paused:this.paused,countdown:this.countdown,raceTime:this.raceTime,
        laps:this.laps,track:this.track.id,options:{...this.options},
        order:(this.order||this.karts).map(k=>k.index),
        karts:this.karts.map(k=>({index:k.index,id:k.id,player:k.player,x:k.x,y:k.y,angle:k.angle,
          speed:k.speed,lap:k.lapsDone+1,place:k.place,item:k.item,drifting:k.drifting,
          hit:k.hit,finished:k.finished,boost:k.boost,offroad:k.offroad,blind:k.blind,
          shield:k.shield,bestLap:k.bestLap,finishTime:k.finishTime}))};
    }
  }
  const api=Object.freeze({Race,TRACKS,ITEMS,ODDS,DIFFICULTIES,TOP,ACCEL,BRAKE,MIN_DRIFT,BODY,RACERS,LAPS,clamp,wrapAngle});
  root.PixelKartCore=api;
  if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
