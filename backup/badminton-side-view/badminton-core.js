/* Shuttle Club: independent deterministic simulation, in logical pixel units. */
(function(root){
  'use strict';
  // 13.4 m singles length mapped to 376 px; 1.55 m net is approximately 44 px.
  const COURT=Object.freeze({left:52,right:428,net:240,netTop:180,floor:224});
  const DIFFICULTIES=Object.freeze({
    easy:{speed:85,reaction:.32,error:38,jumpChance:.25},
    medium:{speed:111,reaction:.17,error:20,jumpChance:.65},
    hard:{speed:137,reaction:.075,error:7,jumpChance:1}
  });
  const ABILITIES=Object.freeze({
    explorer:{name:'Firebird clear',description:'A deep, blazing clear with a fast opening burst.',color:'#ff9b55',vy:-230,drag:.0030,target:'back'},
    soldier:{name:'Lightning drive',description:'A fast, low drive aimed into the open court.',color:'#79e7ff',vy:-140,drag:.0019,target:'open'},
    mystic:{name:'Third-eye orbit',description:'A towering lob that pushes the opponent to the baseline.',color:'#cfabff',vy:-310,drag:.0045,target:'back'},
    dora:{name:'Air cannon',description:'A powerful clear; the follow-through gives a 2-second speed boost.',color:'#b6f6ff',vy:-210,drag:.0025,target:'open'},
    goku:{name:'Kamehameha smash',description:'A forceful steep shot in the air; a power clear on the ground.',color:'#77d5ff',vy:40,drag:.0018,target:'open'},
    nezha:{name:'Crimson ribbon drop',description:'A deceptive, curling drop into the front court.',color:'#ff8dad',vy:-165,drag:.0065,target:'front'}
  });
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Footwork has two axes. x runs along the 13.4 m length; z runs across the court
  // width, 0 at the back line and 1 at the front line. Height stays in y, so
  // jumping, reach and shuttle physics are untouched by the lateral axis.
  // LANE_SPEED is how many court widths per second the base player covers, and it
  // scales with the player's speed so both axes share one acceleration curve.
  const LANE_SPEED=1.8;
  function integrate(b,dt){
    const speed=Math.hypot(b.vx,b.vy),drag=b.drag??.0045;
    b.vx-=drag*speed*b.vx*dt;
    b.vy+=(274-drag*speed*b.vy)*dt;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  function flight(b,max=4){
    const copy={...b},path=[];
    for(let t=0;t<max;t+=1/120){integrate(copy,1/120);path.push({x:copy.x,y:copy.y,t});if(copy.y>=COURT.floor-3)break;}
    return path;
  }
  function launchVelocity(x,y,target,vy,drag=.0045,ensureClear=true){
    const dir=target>x?1:-1;
    let result;
    for(let attempt=0;attempt<7;attempt++){
      let lo=4,hi=1000;
      for(let i=0;i<24;i++){
        const mid=(lo+hi)/2,path=flight({x,y,vx:mid*dir,vy,drag});
        const landing=path[path.length-1];
        if((landing.x-target)*dir<0)lo=mid;else hi=mid;
      }
      result={vx:(lo+hi)/2*dir,vy,drag};
      const crossing=flight({x,y,...result}).find(p=>(p.x-COURT.net)*dir>=0);
      if(!ensureClear||!crossing||crossing.y<COURT.netTop-7||y>=COURT.floor)break;
      vy-=35;
    }
    return result;
  }
  class Match{
    constructor(options={}){this.options={character:'explorer',opponent:'soldier',difficulty:'medium',mode:'normal',...options};this.seed=(options.seed??Date.now())>>>0;this.events=[];this.tick=0;this.paused=false;this.score=[0,0];this.server=0;this.phase='serve';this.timer=0;this.rally=0;this.bestRally=0;this.winner=null;this.message='YOUR SERVE · J TO START';this.messageTime=2;this.particles=[];this.players=[this.newPlayer(0,this.options.character),this.newPlayer(1,this.options.opponent)];this.resetRally();}
    random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    newPlayer(side,character){return {side,character,x:side?344:136,y:COURT.floor,vx:0,vy:0,z:.5,vz:0,ground:true,jumpVisual:false,swing:0,shot:'clear',cooldown:0,meter:50,skillCooldown:0,boost:0,jumpBuffer:0,animation:0,hits:0};}
    get config(){return DIFFICULTIES[this.options.difficulty]||DIFFICULTIES.medium;}
    get special(){return this.options.mode==='special';}
    resetRally(){
      this.phase='serve';this.timer=0;this.rally=0;this.aiClock=0;this.aiTarget=344;this.aiLane=.5;this.aiAttempt=0;
      for(const p of this.players){p.x=p.side?344:136;p.y=COURT.floor;p.vx=0;p.vy=0;p.z=.5;p.vz=0;p.ground=true;p.jumpVisual=false;p.swing=0;p.cooldown=0;}
      this.shuttle={x:0,y:0,vx:0,vy:0,drag:.0045,lastHitter:null,trail:[],skill:null,live:false};
      this.attachServe();this.message=this.server?'AI SERVING…':'YOUR SERVE · J TO START';this.messageTime=2;
    }
    attachServe(){const p=this.players[this.server];this.shuttle.x=p.x+(p.side?-17:17);this.shuttle.y=p.y-35;}
    serve(){if(this.phase!=='serve')return false;const p=this.players[this.server];this.phase='rally';this.shuttle.live=true;this.performHit(p,'clear',true);this.events.push({type:'serve',side:this.server});return true;}
    requestSwing(side,shot='clear'){
      const p=this.players[side];if(this.phase==='serve'){if(side===this.server)return this.serve();return false;}
      if(this.phase!=='rally'||p.cooldown>0)return false;
      if(shot==='special'&&(!this.special||p.meter<100||p.skillCooldown>0))return false;
      p.swing=.24;p.cooldown=.29;p.shot=shot;p.animation=.28;return true;
    }
    inReach(p){const b=this.shuttle,dx=b.x-(p.x+(p.side?-15:15)),dy=b.y-(p.y-34);return dx*dx/(48*48)+dy*dy/(39*39)<=1&&b.x>=(p.side?COURT.net-4:COURT.left-15)&&b.x<=(p.side?COURT.right+15:COURT.net+4);}
    performHit(p,shot,serving=false){
      const b=this.shuttle;if(!serving&&(b.lastHitter===p.side||!this.inReach(p)))return false;
      const opponent=this.players[1-p.side],dir=p.side?-1:1;
      let target=p.side?102:378,vy=-205,drag=.0045,skill=null;
      if(shot==='drop'){target=p.side?205:275;vy=-160;drag=.0058;}
      if(shot==='smash'){target=p.side?115:365;vy=p.ground?-150:25;drag=.0032;}
      if(shot==='special'){
        skill=ABILITIES[p.character]||ABILITIES.explorer;vy=skill.vy;drag=skill.drag;
        if(p.character==='goku'&&p.ground)vy=-175;
        if(skill.target==='front')target=p.side?201:279;
        if(skill.target==='open')target=opponent.x>(p.side?144:336)?(p.side?80:275):(p.side?205:400);
        p.meter=0;p.skillCooldown=8;if(p.character==='dora')p.boost=2;
        this.message=skill.name.toUpperCase();this.messageTime=1.1;
      }
      if(p.side&&!serving){target+= (this.random()-.5)*2*this.config.error;}
      target=clamp(target,COURT.left-12,COURT.right+12);
      const launch=launchVelocity(b.x,b.y,target,vy,drag);
      Object.assign(b,launch,{lastHitter:p.side,skill:skill?{character:p.character,color:skill.color}:null,live:true});
      p.swing=0;p.animation=.25;p.shot=shot;p.hits++;if(shot!=='special')p.meter=Math.min(100,p.meter+25);
      this.rally++;this.bestRally=Math.max(this.bestRally,this.rally);this.aiClock=this.config.reaction;this.aiAttempt=0;
      this.events.push({type:'hit',side:p.side,shot,skill:skill?.name});
      this.burst(b.x,b.y,skill?.color||'#fff2b6',10);
      return true;
    }
    burst(x,y,color,count=15){for(let i=0;i<count;i++){const angle=this.random()*Math.PI*2,speed=20+this.random()*65;this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:.4+this.random()*.3,color});}}
    award(side,reason){
      if(this.phase!=='rally')return;
      this.score[side]++;this.server=side;this.phase='point';this.timer=1.7;this.shuttle.live=false;
      this.message=(side?'AI POINT':'YOUR POINT')+' · '+reason;this.messageTime=1.7;
      if(this.score[side]>=11)this.winner=side;
      this.events.push({type:'point',side,reason,score:[...this.score]});this.burst(this.shuttle.x,Math.min(this.shuttle.y,COURT.floor),side?'#f3939a':'#ffdb70',20);
    }
    ai(dt){
      const p=this.players[1],b=this.shuttle,c=this.config;
      if(this.phase==='serve'){if(this.server&&this.timer>.95)this.serve();return {move:0};}
      if(this.phase!=='rally')return {move:0};
      this.aiClock-=dt;
      if(this.aiClock<=0){
        this.aiClock=c.reaction;
        if(b.lastHitter===0){
          const path=flight(b);let intercept=path.find(q=>q.y>=COURT.floor-42&&q.y>b.y&&q.x>COURT.net);
          if(!intercept)intercept=path[path.length-1];
          this.aiTarget=clamp(intercept.x-10+(this.random()-.5)*c.error*.4,COURT.net+23,COURT.right-10);
          // Stand forward for a short ball and deep for a long one, exaggerated so the
          // shuffle actually reads on a court that is only 30 px wide on screen.
          this.aiLane=clamp(1.12-1.24*clamp((intercept.x-COURT.net)/(COURT.right-COURT.net),0,1),0,1);
        }else{this.aiTarget=338;this.aiLane=.5;}
      }
      const movement=Math.abs(this.aiTarget-p.x)>6?Math.sign(this.aiTarget-p.x):0;
      const lateral=Math.abs(this.aiLane-p.z)>.02?Math.sign(this.aiLane-p.z):0;
      let jump=false;
      if(b.lastHitter===0&&Math.abs(b.x-p.x)<70&&b.y<158&&b.vy>0&&p.ground&&this.random()<c.jumpChance*dt*12)jump=true;
      if(b.lastHitter===0&&this.inReach(p)&&p.cooldown<=0){
        this.aiAttempt+=dt;
        if(this.aiAttempt>c.reaction*.42){
          let shot=!p.ground&&b.y<155?'smash':this.players[0].x<160?'drop':'clear';
          if(this.special&&p.meter>=100&&p.skillCooldown<=0&&this.random()<.7)shot='special';
          this.requestSwing(1,shot);this.aiAttempt=0;
        }
      }
      return {move:movement,side:lateral,jump};
    }
    step(dt,input={}){
      if(this.paused||this.phase==='finished')return;
      dt=clamp(dt,0,1/30);this.tick+=dt;this.timer+=this.phase==='serve'?dt:0;
      if(this.messageTime>0)this.messageTime-=dt;
      for(const p of this.players){p.cooldown=Math.max(0,p.cooldown-dt);p.skillCooldown=Math.max(0,p.skillCooldown-dt);p.boost=Math.max(0,p.boost-dt);p.animation=Math.max(0,p.animation-dt);}
      if(this.phase==='point'){
        this.timer-=dt;this.stepParticles(dt);
        if(this.timer<=0){if(this.winner!==null){this.phase='finished';this.events.push({type:'finish',winner:this.winner,score:[...this.score]});}else this.resetRally();}return;
      }
      if(input.shot)this.requestSwing(0,input.shot);
      const ai=this.ai(dt);
      for(let side=0;side<2;side++){
        const p=this.players[side],control=side?ai:input,speed=(side?this.config.speed:126)*(p.boost>0?1.25:1),desired=(control.move||0)*speed,laneScale=LANE_SPEED/126,desiredLane=(control.side||0)*speed*laneScale;
        const acceleration=p.ground?1000:650,laneAcceleration=acceleration*laneScale;
        p.vx+=clamp(desired-p.vx,-acceleration*dt,acceleration*dt);
        p.vz+=clamp(desiredLane-p.vz,-laneAcceleration*dt,laneAcceleration*dt);
        if(control.jump)p.jumpBuffer=.12;
        if(p.jumpBuffer>0&&p.ground){p.vy=-230;p.ground=false;p.jumpVisual=true;p.jumpBuffer=0;this.events.push({type:'jump',side});}
        p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);p.x+=p.vx*dt;p.z=clamp(p.z+p.vz*dt,0,1);p.x=clamp(p.x,side?COURT.net+19:COURT.left+8,side?COURT.right-8:COURT.net-19);
        if(!p.ground){p.vy+=620*dt;p.y+=p.vy*dt;if(p.y>=COURT.floor){p.y=COURT.floor;p.vy=0;p.ground=true;p.jumpVisual=false;}}
      }
      if(this.phase==='serve')this.attachServe();
      if(this.phase==='rally'){
        const b=this.shuttle;
        for(let i=0;i<2;i++){
          const oldX=b.x;integrate(b,dt/2);
          for(const p of this.players)if(p.swing>0&&b.lastHitter!==p.side&&this.inReach(p))this.performHit(p,p.shot);
          if((oldX-COURT.net)*(b.x-COURT.net)<=0&&oldX!==b.x&&b.y+3>=COURT.netTop){b.x=COURT.net-Math.sign(b.vx)*3;b.vx*=-.18;this.award(1-b.lastHitter,'NET');break;}
          if(b.y>=COURT.floor-3){b.y=COURT.floor-3;const out=b.x<COURT.left||b.x>COURT.right;this.award(out?1-b.lastHitter:(b.x<COURT.net?1:0),out?'OUT':'IN');break;}
          if(b.y<-120||b.x<-80||b.x>560){this.award(1-b.lastHitter,'OUT');break;}
        }
        b.trail.push({x:b.x,y:b.y});if(b.trail.length>10)b.trail.shift();
      }
      for(const p of this.players)p.swing=Math.max(0,p.swing-dt);
      this.stepParticles(dt);
    }
    stepParticles(dt){for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=80*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);}
    snapshot(){return {phase:this.phase,paused:this.paused,score:[...this.score],server:this.server,winner:this.winner,rally:this.rally,bestRally:this.bestRally,options:{...this.options},players:this.players.map(p=>({...p})),shuttle:{...this.shuttle,trail:undefined},message:this.message};}
  }
  const api=Object.freeze({Match,COURT,DIFFICULTIES,ABILITIES,integrate,flight,launchVelocity});
  root.PixelBadmintonCore=api;if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
