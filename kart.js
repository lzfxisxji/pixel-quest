/* Pixel Kart: presentation. Owns the canvas, the camera, the HUD and the input.
   The simulation in kart-core.js never draws and never reads the DOM, so a race
   can be stepped headlessly by the tests and drawn here without either side
   knowing about the other.

   The track is *baked*. The circuit is static, so instead of re-assembling a few
   hundred road quads every frame - which no amount of pixel-art styling would
   make fast enough - the whole lap, kerbs, start line, barriers and scenery are
   rasterised once into an offscreen canvas the size of the circuit. Each frame
   then blits one rectangle of it. That is what makes the pixel art possible at
   all: a 1px kerb stripe is a real pixel here, not a scaled vector. */
(function(root){
  'use strict';
  const K=root.PixelKartCore||(typeof require==='function'?require('./kart-core.js'):null);
  const T=root.PixelKartTracks||(typeof require==='function'?require('./kart-tracks.js'):null);
  const A=root.PixelKartAssets||(typeof require==='function'?require('./kart-assets.js'):null);
  const {locate}=T;
  const clamp=K.clamp;

  const VIEW_W=960,VIEW_H=540;      // logical size; the canvas scales to fit
  const ZOOM=1.55;                  // >1 so the kart and the road ahead read big
  const CAM_LERP=6.5;               // how quickly the camera catches the kart
  /* How far in front of the kart the camera sits, in world pixels. The world
     transform already multiplies by ZOOM, so this must NOT be scaled by it
     again - doing that pushed the kart to the edge of the frame. Tuned so the
     kart sits a little below centre at rest and drifts towards the centre as it
     speeds up, which keeps the road ahead visible without losing the kart. */
  const LOOK_AHEAD=40;
  const LOOK_SPEED=52;

  /* ---- audio ---------------------------------------------------------------
     WebAudio only, no asset files. A square-wave engine whose frequency follows
     the rev counter is most of what sells a kart game, and it costs one
     oscillator. Everything is created lazily on the first gesture, because a
     browser will not let audio start before one. */
  const sound={
    ctx:null,master:null,engine:null,engineGain:null,started:false,muted:false,
    init(){
      if(this.started)return;
      const AC=root.AudioContext||root.webkitAudioContext;
      if(!AC)return;
      try{this.ctx=new AC();}catch{return;}
      this.master=this.ctx.createGain();
      this.master.gain.value=this.muted?0:.16;
      this.master.connect(this.ctx.destination);
      this.engine=this.ctx.createOscillator();
      this.engine.type='square';
      this.engineGain=this.ctx.createGain();
      this.engineGain.gain.value=0;
      this.engine.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engine.start();
      this.started=true;
    },
    resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume();},
    // rev is 0..1; a kart off the throttle goes quiet and drops an octave.
    engine_(rev,load){
      if(!this.started)return;
      const t=this.ctx.currentTime;
      const f=load?58+rev*180:0;
      this.engine.frequency.setTargetAtTime(f,t,.05);
      this.engineGain.gain.setTargetAtTime(load?.05+rev*.09:0,t,.06);
    },
    blip(freq,dur=.08,type='square',vol=.5){
      if(!this.started||this.muted)return;
      const t=this.ctx.currentTime;
      const o=this.ctx.createOscillator(),g=this.ctx.createGain();
      o.type=type;o.frequency.value=freq;
      g.gain.setValueAtTime(vol,t);
      g.gain.exponentialRampToValueAtTime(.0001,t+dur);
      o.connect(g);g.connect(this.master);
      o.start(t);o.stop(t+dur+.02);
    },
    slide(){this.blip(300,.22,'sawtooth',.22);},
    pickup(){this.blip(660,.07);setTimeout(()=>this.blip(990,.09),70);},
    hit(){this.blip(140,.3,'sawtooth',.6);},
    boost(){this.blip(420,.1,'sawtooth',.4);setTimeout(()=>this.blip(760,.16,'sawtooth',.4),80);},
    lap(){this.blip(880,.1);setTimeout(()=>this.blip(1180,.14),100);},
    finish(){[660,880,1100,1320].forEach((f,i)=>setTimeout(()=>this.blip(f,.2),i*130));}
  };

  /* ---- track baking --------------------------------------------------------
     One pass over the samples, painting the road as a chain of quads: grass
     everywhere, then a wider sand shoulder, then the kerb stripe, then the
     asphalt, then the racing-line tint. Painting back to front in that order
     means each band only has to cover the one outside it. */
  function bakeTrack(track){
    const b=track.bounds;
    const w=Math.ceil(b.x1-b.x0),h=Math.ceil(b.y1-b.y0);
    const c=root.document.createElement('canvas');
    c.width=w;c.height=h;
    const g=c.getContext('2d');
    g.imageSmoothingEnabled=false;
    const th=track.theme;
    const off={x:-b.x0,y:-b.y0};
    g.translate(off.x,off.y);

    // Grass base, with a couple of tone bands so it is not one flat slab.
    g.fillStyle=th.grass;
    g.fillRect(b.x0,b.y0,w,h);
    g.fillStyle=th.grassDark;
    for(let i=0;i<track.count;i+=7){
      const p=track.samples[i];
      g.fillRect(Math.round(p.x-p.half-24),Math.round(p.y-p.half-24),10,10);
    }
    // Sand / run-off shoulder just outside the kerb.
    band(g,track,th.sand,p=>p.half+18,off,true);

    // Kerb: alternating blocks of the two kerb colours, the classic rumble strip.
    const kerbStep=6;
    for(let i=0;i<track.count;i+=kerbStep){
      const p=track.samples[i];
      const red=((i/kerbStep)|0)%2===0;
      g.fillStyle=red?th.kerbRed:th.kerb;
      for(const side of[-1,1]){
        const a=side*(p.half+2),b=side*(p.half+8);
        g.fillRect(Math.round(p.x+p.nx*a),Math.round(p.y+p.ny*a),3,3);
        g.fillRect(Math.round(p.x+p.nx*b),Math.round(p.y+p.ny*b),3,3);
      }
    }
    // Asphalt, then a slightly darker centre strip for a bit of surface interest.
    band(g,track,th.asphalt,p=>p.half,off);
    band(g,track,th.asphaltDark,p=>p.half*.42,off);

    // Start/finish line: a chequered band across the road.
    const sl=track.samples[track.startIndex];
    for(let r=0;r<4;r++)for(let q=-6;q<=6;q++){
      g.fillStyle=((r+q)&1)?'#f6f6f6':'#1c1c22';
      const a=q*5.2,b=(q+1)*5.2;
      const x0=sl.x+sl.nx*a+sl.tx*r*3,x1=sl.x+sl.nx*b+sl.tx*r*3;
      const y0=sl.y+sl.ny*a+sl.ty*r*3,y1=sl.y+sl.ny*b+sl.ty*r*3;
      g.fillRect(Math.round(Math.min(x0,x1)),Math.round(Math.min(y0,y1)),
        Math.round(Math.abs(x1-x0))+1,Math.round(Math.abs(y1-y0))+1);
    }

    // Barriers: a low wall hugging the outer edge, so the circuit reads as a
    // built track rather than a stripe on the grass.
    g.fillStyle=th.kerb;
    for(let i=0;i<track.count;i+=1){
      const p=track.samples[i];
      const a=p.half+18+track.reach*.06;
      g.fillRect(Math.round(p.x+p.nx*a-1.5),Math.round(p.y+p.ny*a-1.5),4,4);
      g.fillRect(Math.round(p.x-p.nx*a-1.5),Math.round(p.y-p.ny*a-1.5),4,4);
    }
    g.fillStyle='rgba(0,0,0,.22)';
    for(let i=0;i<track.count;i+=1){
      const p=track.samples[i];
      const a=p.half+20+track.reach*.06;
      g.fillRect(Math.round(p.x+p.nx*a-1),Math.round(p.y+p.ny*a-1),2,2);
      g.fillRect(Math.round(p.x-p.nx*a-1),Math.round(p.y-p.ny*a-1),2,2);
    }

    decorate(g,track,th,off);
    return {canvas:c,off,w,h};
  }
  // Fill the band between the centre line and +/- width, as a chain of quads.
  function band(g,track,color,width,off,skip){
    g.fillStyle=color;
    for(let i=0;i<track.count;i++){
      const p=track.samples[i];
      const a=p.nx*width(p),b=p.ny*width(p);
      g.fillRect(Math.round(p.x+p.nx*-width(p)-1.5),Math.round(p.y+p.ny*-width(p)-1.5),
        Math.round(Math.abs(b-a)+3),Math.round(Math.abs(b-a)+3));
    }
  }
  /* Scenery. Deterministic - a small LCG seeded from the track id - so the same
     circuit always looks the same, and a screenshot in a bug report matches the
     screenshot on the developer's machine. */
  function decorate(g,track,th,off){
    let seed=0;
    for(const ch of track.id)seed=(Math.imul(seed,31)+ch.charCodeAt(0))>>>0;
    const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    // Grandstands and trees around the outside, kept clear of the road.
    for(let i=0;i<track.count;i+=5){
      const p=track.samples[i];
      if(rnd()<.62)continue;
      const side=rnd()<.5?-1:1;
      const d=p.half+34+rnd()*46;
      const x=p.x+p.nx*d*side,y=p.y+p.ny*d*side;
      if(x<track.bounds.x0+6||x>track.bounds.x1-6||y<track.bounds.y0+6||y>track.bounds.y1-6)continue;
      const roll=rnd();
      if(roll<.42){
        // A block of crowd: a few rows of tiny dots in the theme's crowd colour.
        const w=16+Math.floor(rnd()*22),h=7+Math.floor(rnd()*6);
        g.fillStyle=th.kerb;
        g.fillRect(Math.round(x-w/2),Math.round(y-h),w,h);
        for(let a=0;a<w;a+=2)for(let b=1;b<h;b+=2){
          if(rnd()<.72){g.fillStyle=rnd()<.5?th.crowd:th.kerbRed;g.fillRect(Math.round(x-w/2+a),Math.round(y-h+b),1,1);}
        }
        g.fillStyle='rgba(0,0,0,.3)';
        g.fillRect(Math.round(x-w/2),Math.round(y),w,2);
      }else if(roll<.74){
        // A tree: a trunk and a lumpy canopy.
        const r=5+Math.floor(rnd()*5);
        g.fillStyle=th.grassDark;
        g.fillRect(Math.round(x-1),Math.round(y-3),3,5);
        for(let a=-r;a<=r;a+=2)for(let b=-r;b<=r;b+=2){
          if(a*a+b*b<=r*r&&rnd()<.86){
            g.fillStyle=(a+b)<0?th.grass:th.grassDark;
            g.fillRect(Math.round(x+a),Math.round(y-5+b),2,2);
          }
        }
      }else{
        // A marshal post / tyre stack.
        g.fillStyle=th.asphaltDark;
        g.fillRect(Math.round(x-4),Math.round(y-5),9,6);
        g.fillStyle=th.kerbRed;
        g.fillRect(Math.round(x-4),Math.round(y-5),9,2);
      }
    }
    // Start gantry over the line.
    const sl=track.samples[track.startIndex];
    const a=sl.half+22;
    g.fillStyle=th.asphaltDark;
    g.fillRect(Math.round(sl.x+sl.nx*a-3),Math.round(sl.y+sl.ny*a-3),6,6);
    g.fillRect(Math.round(sl.x-sl.nx*a-3),Math.round(sl.y-sl.ny*a-3),6,6);
    g.fillStyle=th.kerb;
    const gw=Math.abs(sl.nx*a*2);
    g.fillRect(Math.round(Math.min(sl.x+sl.nx*a,sl.x-sl.nx*a)-4),Math.round(sl.y-12),gw+8,7);
    g.fillStyle=th.kerbRed;
    g.fillRect(Math.round(Math.min(sl.x+sl.nx*a,sl.x-sl.nx*a)-4),Math.round(sl.y-12),gw+8,2);
  }

  /* ---- the game ------------------------------------------------------------ */
  class KartGame{
    constructor(doc){
      this.root=doc;
      this.doc=doc;
      this.canvas=doc.querySelector('#kart');
      this.g=this.canvas.getContext('2d');
      this.g.imageSmoothingEnabled=false;
      this.baked=new Map();
      this.keys=new Set();
      this.pressed=new Set();
      this.touch={};
      this.camera={x:0,y:0};
      this.marks=[];          // skid marks, oldest first
      this.smoke=[];          // drift sparks / dust
      this.lastCountdown=99;
      this.bestLap=0;
      this.state='setup';     // setup | racing | results
      this.buildSetup();
      this.bind();
      this.resize();
      let last=performance.now();
      const frame=now=>{
        const dt=Math.min(.05,(now-last)/1000);
        last=now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    /* ---- setup screen: character, circuit, difficulty ---- */
    buildSetup(){
      const host=this.root.querySelector('#kart-setup');
      const chars=A.KARTS;
      const charRow=this.root.querySelector('#kart-chars');
      charRow.innerHTML='';
      this.pick={character:'explorer',track:'meadow',difficulty:'medium'};
      for(const[id,k]of Object.entries(chars)){
        const b=this.doc.createElement('button');
        b.className='kart-chip';b.dataset.id=id;
        b.setAttribute('aria-pressed',String(id===this.pick.character));
        const cv=this.doc.createElement('canvas');
        cv.width=44;cv.height=44;cv.className='kart-chip-art';
        b.appendChild(cv);
        const label=this.doc.createElement('span');
        label.textContent=k.name;
        b.appendChild(label);
        b.onclick=()=>this.pickCharacter(id);
        charRow.appendChild(b);
        const spr=A.spriteFor(id);
        const cg=cv.getContext('2d');
        cg.imageSmoothingEnabled=false;
        cg.drawImage(spr.frames[0],2,2,26,26,4,4,36,36);
      }
      const trackRow=this.root.querySelector('#kart-tracks');
      trackRow.innerHTML='';
      for(const t of K.TRACKS){
        const b=this.doc.createElement('button');
        b.className='kart-track';b.dataset.id=t.id;
        b.setAttribute('aria-pressed',String(t.id===this.pick.track));
        b.innerHTML=`<strong>${t.name}</strong><span>${t.note}</span>`+
          `<em>${(t.length/28.4).toFixed(0)}m · ${t.theme.sky}</em>`;
        b.onclick=()=>this.pickTrack(t.id);
        trackRow.appendChild(b);
      }
      const diffRow=this.root.querySelector('#kart-difficulty');
      diffRow.innerHTML='';
      for(const[id,k]of Object.entries(K.DIFFICULTIES)){
        const b=this.doc.createElement('button');
        b.className='kart-diff';b.dataset.id=id;
        b.setAttribute('aria-pressed',String(id===this.pick.difficulty));
        b.textContent=k.label;
        b.onclick=()=>this.pickDifficulty(id);
        diffRow.appendChild(b);
      }
      this.pickCharacter('explorer');
      this.pickDifficulty('medium');
    }
    paintChips(container,value){
      for(const b of container.querySelectorAll('button'))
        b.setAttribute('aria-pressed',String(b.dataset.id===value));
    }
    pickCharacter(id){
      this.pick.character=id;
      this.paintChips(this.root.querySelector('#kart-chars'),id);
      this.root.querySelector('#kart-char-name').textContent=A.KARTS[id].name.toUpperCase();
      this.paintPreview();
    }
    pickTrack(id){this.pick.track=id;this.paintChips(this.root.querySelector('#kart-tracks'),id);this.paintPreview();}
    pickDifficulty(id){
      this.pick.difficulty=id;
      this.paintChips(this.root.querySelector('#kart-difficulty'),id);
      const d=K.DIFFICULTIES[id];
      this.root.querySelector('#kart-diff-name').textContent=d.label.toUpperCase();
      this.root.querySelector('#kart-diff-copy').textContent=
        id==='easy'?'Forgiving rivals. They brake late, run wide and get it wrong.':
        id==='medium'?'Four rivals who push but keep it tidy.':
        'Ruthless. They use every corner and never make a mistake.';
    }

    // A small top-down preview of the chosen circuit, drawn from the real baked
    // track - so the player picks the shape they will actually drive, not an icon.
    paintPreview(){
      const cv=this.root.querySelector('#kart-preview');
      if(!cv)return;
      const g=cv.getContext('2d');
      g.imageSmoothingEnabled=false;
      g.clearRect(0,0,cv.width,cv.height);
      const baked=this.bakedFor(K.TRACKS.find(t=>t.id===this.pick.track)||K.TRACKS[0]);
      const b=baked.canvas;
      const scale=Math.min(cv.width/b.width,cv.height/b.height);
      const w=b.width*scale,h=b.height*scale;
      g.drawImage(b,(cv.width-w)/2,(cv.height-h)/2,w,h);
    }
    bakedFor(track){
      if(!this.baked.has(track.id))this.baked.set(track.id,bakeTrack(track));
      return this.baked.get(track.id);
    }

    start(){
      sound.init();sound.resume();
      this.race=new K.Race({track:this.pick.track,character:this.pick.character,
        difficulty:this.pick.difficulty,seed:(Date.now()&0xffff)+1});
      this.track=this.race.track;
      this.bakedFor(this.track);
      this.camera.x=this.race.player.x;
      this.camera.y=this.race.player.y;
      this.marks.length=0;this.smoke.length=0;
      this.lastCountdown=99;this.bestLap=0;
      this.state='racing';
      this.root.querySelector('#kart-setup').hidden=true;
      this.root.querySelector('#kart-hud').hidden=false;
      // Match the cabinet to the circuit's grass so the letterbox around the
      // 16:9 screen reads as more of the same world rather than a black band.
      this.root.querySelector('#kart-screen').style.background=this.track.theme.grassDark;
      this.root.querySelector('#kart-stage').textContent=this.track.name.toUpperCase();
      this.root.querySelector('#kart-screen').dataset.phase='racing';
      // The screen element changes height when the setup panel is hidden (the
      // setup screen is content-sized, the race screen is 16:9), so the canvas
      // backing store has to be re-fitted here or the race is drawn stretched.
      this.resize();
    }
    toSetup(){
      this.state='setup';
      if(this.race)this.race.paused=false;
      this.hideOverlay();
      this.root.querySelector('#kart-setup').hidden=false;
      this.root.querySelector('#kart-hud').hidden=true;
      this.root.querySelector('#kart-screen').style.background='';
      this.root.querySelector('#kart-stage').textContent='PICK YOUR DRIVER';
      this.root.querySelector('#kart-screen').dataset.phase='setup';
      this.resize();
      this.paintPreview();
    }

    bind(){
      const add=(code)=>{this.keys.add(code);this.pressed.add(code);};
      const drop=(code)=>this.keys.delete(code);
      this.root.addEventListener('keydown',e=>{
        if(this.state==='setup'){
          if(e.code==='Enter'){e.preventDefault();this.start();}
          return;
        }
        if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter','Escape'].includes(e.code))e.preventDefault();
        if(!this.keys.has(e.code))this.pressed.add(e.code);
        this.keys.add(e.code);
        if(e.repeat)return;
        if(e.code==='KeyP')this.togglePause();
        if(e.code==='Escape')this.root.querySelector('#kart-exit').click();
        if(e.code==='KeyM')sound.muted=!sound.muted;
        if(e.code==='Enter'&&this.state==='results')this.rematch();
      });
      this.root.addEventListener('keyup',e=>this.keys.delete(e.code));
      this.root.addEventListener('blur',()=>{this.keys.clear();});
      this.root.querySelector('#kart-go').onclick=()=>this.start();
      this.root.querySelector('#kart-rematch').onclick=()=>{this.hideOverlay();this.start();};
      this.root.querySelector('#kart-change').onclick=()=>{this.hideOverlay();this.toSetup();};
      this.root.querySelector('#kart-exit').onclick=()=>{location.href=this.doc.body.dataset.home||'index.html';};
      this.root.querySelector('#kart-pause').onclick=()=>this.togglePause();
      this.root.querySelector('#kart-resume').onclick=()=>this.togglePause();
      this.root.querySelector('#kart-pause-change').onclick=()=>{this.hideOverlay();if(this.race)this.race.paused=false;this.toSetup();};
      this.root.querySelector('#kart-pause-exit').onclick=()=>{location.href=this.doc.body.dataset.home||'index.html';};
      this.root.querySelector('#kart-fullscreen').onclick=()=>{
        if(this.doc.fullscreenElement)this.doc.exitFullscreen();
        else this.root.querySelector('#kart-screen').requestFullscreen?.().catch(()=>{});
      };
      // Touch: a steering pad on the left, throttle/brake/drift/item on the right.
      for(const el of this.root.querySelectorAll('[data-touch]')){
        const code=el.dataset.touch;
        const on=e=>{e.preventDefault();sound.init();sound.resume();add(code);el.classList.add('is-down');};
        const off=e=>{e.preventDefault();drop(code);el.classList.remove('is-down');};
        el.addEventListener('pointerdown',on);
        el.addEventListener('pointerup',off);
        el.addEventListener('pointercancel',off);
        el.addEventListener('pointerleave',off);
      }
      this.root.querySelector('#kart-view').addEventListener('pointerdown',()=>{sound.init();sound.resume();});
      // The cabinet is sized by the viewport, so a window resize changes the
      // canvas backing store. Without this the race would be drawn stretched.
      root.addEventListener('resize',()=>this.resize());
    }
    togglePause(){
      if(!this.race||this.state!=='racing')return;
      this.race.paused=!this.race.paused;
      this.root.querySelector('#kart-screen').dataset.phase=this.race.paused?'paused':'racing';
      if(this.race.paused)this.showOverlay('paused');else this.hideOverlay();
    }
    // The one place the results/paused dialog is shown, so the two modals can
    // never both be visible and the canvas is never left covered by accident.
    showOverlay(kind){
      const ov=this.root.querySelector('#kart-overlay');
      for(const m of ov.querySelectorAll('.kart-modal'))m.hidden=m.dataset.kind!==kind;
      ov.hidden=false;
    }
    hideOverlay(){
      this.root.querySelector('#kart-overlay').hidden=true;
      for(const m of this.root.querySelectorAll('.kart-modal'))m.hidden=true;
    }
    rematch(){
      this.hideOverlay();
      this.start();
    }

    readInput(){
      const k=this.keys,t=this.touch;
      const on=code=>k.has(code)||t[code];
      if(this.race&&this.race.paused)return {};
      return {
        steer:(on('ArrowRight')||on('KeyD')?1:0)-(on('ArrowLeft')||on('KeyA')?1:0),
        throttle:(on('ArrowUp')||on('KeyW')||on('Space'))?1:0,
        brake:(on('ArrowDown')||on('KeyS'))?1:0,
        drift:!!(on('ShiftLeft')||on('ShiftRight')||on('KeyJ')||on('KeyK')),
        use:this.pressed.has('Enter')||this.pressed.has('Space')||on('KeyL')||on('KeyU')
      };
    }

    /* The canvas backing store is sized to exactly the screen element, so there
       is never a letterbox strip, and `scale` is the device-pixels-per-logical
       pixel factor the world and HUD transforms are built from. Because the
       screen is 16:9 while the race is drawn in 960x540 logical pixels, the two
       ratios agree to within a rounding pixel. */
    resize(){
      const cv=this.canvas;
      const box=this.root.querySelector('#kart-screen');
      const rect=box.getBoundingClientRect();
      const w=Math.max(320,Math.round(rect.width)),h=Math.max(180,Math.round(rect.height));
      if(cv.width!==w)cv.width=w;
      if(cv.height!==h)cv.height=h;
      this.scale=w/VIEW_W;
      this.g.imageSmoothingEnabled=false;
    }

    update(dt){
      if(this.state!=='racing'||!this.race)return;
      const race=this.race;
      const input=this.readInput();
      // Fixed 1/60 substeps: the physics is tuned in those units and a variable
      // frame would otherwise change how a corner feels between machines.
      let left=dt;
      while(left>0){
        const h=Math.min(1/60,left);
        race.step(h,input);
        left-=h;
      }
      this.consumeEvents(race);
      this.spawnEffects(race,dt);
      this.updateCamera(dt);
      this.updateAudio(race);
      this.pressed.clear();
      const p=race.player;
      this.bestLap=p.bestLap;
      if(race.phase==='finished'&&this.state==='racing'){
        this.state='results';
        this.root.querySelector('#kart-screen').dataset.phase='results';
        this.showResults(race);
        this.showOverlay('results');
        sound.finish();
      }
      if(race.phase==='countdown'){
        const n=Math.ceil(race.countdown);
        if(n!==this.lastCountdown&&n>0){this.lastCountdown=n;sound.blip(520,.12);}
        if(n<=0&&this.lastCountdown!==0){this.lastCountdown=0;sound.blip(880,.2);}
      }
    }
    consumeEvents(race){
      for(const e of race.events){
        if(e.type==='item'&&race.karts[e.kart].player)sound.pickup();
        else if(e.type==='boost'&&race.karts[e.kart].player)sound.boost();
        else if(e.type==='hit'&&race.karts[e.kart].player)sound.hit();
        else if(e.type==='lap'&&race.karts[e.kart].player)sound.lap();
        else if(e.type==='drift'&&race.karts[e.kart].player)sound.slide();
      }
      race.events.length=0;
    }
    // Skid marks and drift sparks, laid down only where something is happening.
    spawnEffects(race,dt){
      for(const k of race.karts){
        const sliding=k.drifting&&k.speed>40;
        if((sliding||k.slip>6)&&Math.abs(k.steer)>.12){
          const back=11;
          for(const side of[-1,1]){
            this.marks.push({
              x:k.x-Math.cos(k.angle)*back+Math.cos(k.angle+Math.PI/2)*side*5,
              y:k.y-Math.sin(k.angle)*back+Math.sin(k.angle+Math.PI/2)*side*5,
              angle:k.angle,life:3.2
            });
          }
          if(this.marks.length>900)this.marks.splice(0,this.marks.length-900);
        }
        if(sliding&&Math.random()<.5){
          this.smoke.push({x:k.x-Math.cos(k.angle)*12,y:k.y-Math.sin(k.angle)*12,
            vx:(Math.random()-.5)*30,vy:(Math.random()-.5)*30,life:.4,
            color:k.drifting?['#ffd166','#ff9f43','#fff3c4'][Math.floor(Math.random()*3)]:'#cfd6e4'});
        }
        if(k.offroad&&k.speed>60&&Math.random()<.35){
          this.smoke.push({x:k.x-Math.cos(k.angle)*10,y:k.y-Math.sin(k.angle)*10,
            vx:(Math.random()-.5)*20,vy:(Math.random()-.5)*20,life:.5,color:'#c8b48a'});
        }
      }
      for(const m of this.marks)m.life-=dt;
      this.marks=this.marks.filter(m=>m.life>0);
      for(const s of this.smoke){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;}
      this.smoke=this.smoke.filter(s=>s.life>0);
    }
    // The camera leads the kart and leans towards its velocity, so a drift
    // visibly throws the view to the outside - which is most of why a slide
    // feels like a slide.
    updateCamera(dt){
      const p=this.race.player;
      // Lead along the direction of travel, not the nose: mid-drift the kart is
      // pointed into the corner while it is actually travelling outwards, and a
      // camera that followed the nose would swing wildly mid-slide.
      const dir=Math.atan2(p.vy||Math.sin(p.angle),p.vx||Math.cos(p.angle));
      const moving=p.speed>25;
      const a=moving?dir:p.angle;
      const look=LOOK_AHEAD+Math.min(LOOK_SPEED,p.speed*.18);
      const tx=p.x+Math.cos(a)*look;
      const ty=p.y+Math.sin(a)*look;
      const k=1-Math.exp(-CAM_LERP*dt);
      this.camera.x+=(tx-this.camera.x)*k;
      this.camera.y+=(ty-this.camera.y)*k;
    }
    updateAudio(race){
      if(!sound.started)return;
      const p=race.player;
      const rev=clamp(p.speed/K.TOP,0,1);
      const load=race.phase==='racing'&&!race.paused;
      sound.engine_(rev,load);
    }
    showResults(race){
      const order=[...race.karts].sort((a,b)=>{
        if(a.finished&&b.finished)return a.finishTime-b.finishTime;
        if(a.finished)return -1;
        if(b.finished)return 1;
        return b.progress-a.progress;
      });
      const rows=order.map((k,i)=>{
        const t=k.finished?k.finishTime.toFixed(2)+'s':'DNF';
        return `<tr class="${k.player?'is-player':''}"><td>${i+1}</td><td>${A.KARTS[k.id].name}</td>`+
          `<td>${k.finished?t:'—'}</td><td>${k.bestLap?k.bestLap.toFixed(2)+'s':'—'}</td></tr>`;
      }).join('');
      const place=race.player.place;
      const title=place===1?'WINNER!':place<=3?'PODIUM':'RACE OVER';
      this.root.querySelector('#kart-result-title').textContent=title;
      this.root.querySelector('#kart-result-kicker').textContent=
        place===1?'CHEQUERED FLAG · FIRST PLACE':`CHEQUERED FLAG · FINISHED ${place}${ordinal(place)}`;
      this.root.querySelector('#kart-result').innerHTML=
        `<p class="kart-result-summary">You finished <strong>${place}${ordinal(place)}</strong> of ${K.RACERS} · `+
        `best lap ${race.player.bestLap?race.player.bestLap.toFixed(2)+'s':'—'}</p>`+
        `<table><thead><tr><th>#</th><th>DRIVER</th><th>TIME</th><th>BEST LAP</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    /* ---- drawing ---- */
    draw(){
      const g=this.g;
      g.imageSmoothingEnabled=false;
      if(!this.race){
        g.setTransform(1,0,0,1,0,0);
        g.clearRect(0,0,this.canvas.width,this.canvas.height);
        return;
      }
      const race=this.race,track=this.track,baked=this.bakedFor(track);
      // Clear in device pixels before any transform is applied. The world pass
      // paints edge to edge, but clearing here rather than at the end of the
      // HUD pass matters: a clear after the world would erase it.
      g.setTransform(1,0,0,1,0,0);
      g.clearRect(0,0,this.canvas.width,this.canvas.height);
      g.imageSmoothingEnabled=false;
      /* World pass. The canvas is `scale` device pixels per logical pixel, so a
         world point must be scaled once, panned by the camera and only then
         offset by the centre of the view. ZOOM is applied to the scale, not
         folded into the translation - doing both would double-count it.

         The ground is filled across the *visible* rectangle rather than the
         circuit's own bounds: the camera looks past the edge of the track, and
         filling only the bounds would leave bare canvas along whichever side
         the kart happens to be on. */
      const sc=this.scale*ZOOM;
      g.setTransform(sc,0,0,sc,0,0);
      g.translate(VIEW_W/(2*ZOOM)-this.camera.x,VIEW_H/(2*ZOOM)-this.camera.y);
      g.fillStyle=track.theme.grassDark;
      g.fillRect(this.camera.x-VIEW_W,this.camera.y-VIEW_H,VIEW_W*2,VIEW_H*2);

      g.drawImage(baked.canvas,baked.off.x,baked.off.y);

      this.drawMarks(g);
      this.drawBoxes(g,race);
      this.drawHazards(g,race);
      // Karts are drawn back to front so a kart further up the screen sits
      // behind one lower down, which is the whole of the depth cue in a top-down
      // racer - the y coordinate is the depth.
      const order=[...race.karts].sort((a,b)=>a.y-b.y);
      for(const k of order)this.drawKart(g,k,race);
      this.drawSmoke(g);
      for(const p of race.particles)this.drawParticle(g,p);
      this.drawItemBoxHeld(g,race);

      g.setTransform(this.scale,0,0,this.scale,0,0);
      this.drawHud(race);
    }
    drawMarks(g){
      for(const m of this.marks){
        g.globalAlpha=clamp(m.life/3.2,0,1)*.5;
        g.fillStyle='#1b1b22';
        g.save();g.translate(m.x,m.y);g.rotate(m.angle);
        g.fillRect(-2,-1,4,2);
        g.restore();
      }
      g.globalAlpha=1;
    }
    drawSmoke(g){
      for(const s of this.smoke){
        g.globalAlpha=clamp(s.life/.45,0,1)*.7;
        g.fillStyle=s.color;
        g.fillRect(Math.round(s.x)-1,Math.round(s.y)-1,2,2);
      }
      g.globalAlpha=1;
    }
    drawParticle(g,p){
      g.globalAlpha=clamp(p.life/.6,0,1);
      g.fillStyle=p.color;
      g.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);
      g.globalAlpha=1;
    }
    drawBoxes(g,race){
      const box=A.itemBox();
      const t=race.raceTime;
      for(const b of race.boxes){
        if(b.taken)continue;
        const bob=Math.sin(t*3+b.phase)*1.5;
        g.drawImage(box,Math.round(b.x-10),Math.round(b.y-10-bob));
      }
    }
    drawHazards(g,race){
      for(const h of race.hazards){
        const spr=A.itemSprite(h.type);
        if(spr)g.drawImage(spr,Math.round(h.x-8),Math.round(h.y-8));
        else{
          g.fillStyle='#ffd93d';
          g.fillRect(Math.round(h.x-4),Math.round(h.y-4),8,8);
        }
      }
    }
    drawItemBoxHeld(g,race){
      // The item a kart is carrying floats just above it, so you can see who has
      // what without reading a HUD row.
      for(const k of race.karts){
        if(!k.item)continue;
        const spr=A.itemSprite(k.item);
        const bob=Math.sin(race.raceTime*5+k.index)*2;
        if(spr)g.drawImage(spr,Math.round(k.x-8),Math.round(k.y-24-bob));
        else{
          g.fillStyle='#9fe8ff';
          g.fillRect(Math.round(k.x-6),Math.round(k.y-22-bob),12,12);
        }
      }
    }
    drawKart(g,k,race){
      const spr=A.spriteFor(k.id);
      const frames=spr.frames;
      // Pick the baked heading closest to the way the kart is actually travelling,
      // not the way it is pointing - that difference is the drift.
      const heading=Math.atan2(k.vy||Math.sin(k.angle),k.vx||Math.cos(k.angle));
      let idx=Math.round((heading/(Math.PI*2))*frames.length)%frames.length;
      if(idx<0)idx+=frames.length;
      const img=frames[idx];
      const half=img.width/2;
      const px=Math.round(k.x),py=Math.round(k.y);
      // Shadow first, then the flame behind the kart, then the kart itself: the
      // order is what stops the boost trail from covering the driver.
      g.globalAlpha=.3;g.fillStyle='#12121a';
      g.beginPath();g.ellipse(px+2,py+4,K.BODY+1,K.BODY*.85,0,0,Math.PI*2);g.fill();
      g.globalAlpha=1;
      if(k.boost>.05){
        const flick=Math.floor(race.raceTime*22+k.index)%3;
        g.globalAlpha=clamp(k.boost,0,1)*.9;
        g.fillStyle=['#ffe066','#ff9f43','#ff5e5b'][flick];
        for(let i=0;i<3;i++){
          const d=half-2+i*4;
          g.fillRect(px-d-(k.boost>.6?2:0),py-2-flick%2,4,4);
        }
        g.globalAlpha=1;
      }
      g.save();
      g.translate(px,py);
      if(k.hit>0&&Math.floor(k.hit*18)%2)g.globalAlpha=.45;
      g.drawImage(img,-half,-half);
      g.restore();
      g.globalAlpha=1;
      if(k.shield){
        g.strokeStyle='#9fe8ff';g.lineWidth=1.5;
        g.beginPath();g.arc(px,py,17,0,Math.PI*2);g.stroke();
      }
    }
    drawHud(race){
      const g=this.g,th=this.track.theme;
      const p=race.player;
      g.setTransform(this.scale,0,0,this.scale,0,0);
      // ---- speed / lap / place, drawn as arcade pixel panels
      this.panel(12,12,168,58,th);
      this.text('LAP',24,26,'#cfe3ff',11);
      this.text(`${Math.min(race.laps,p.lapsDone+1)}/${race.laps}`,24,52,'#fff',22);
      this.text('PLACE',104,26,'#cfe3ff',11);
      this.text(`${p.place}`,104,52,'#fff',22);
      this.text(ordinal(p.place),126,50,'#9fb6d4',13);

      this.panel(VIEW_W-180,12,168,58,th);
      this.text('SPEED',VIEW_W-168,26,'#cfe3ff',11);
      this.text(String(Math.round(p.speed*0.42)),VIEW_W-168,52,'#fff',22);
      this.text('KM/H',VIEW_W-96,50,'#9fb6d4',11);
      this.text('BEST LAP',VIEW_W-168,64,'#9fb6d4',9);
      this.text(p.bestLap?p.bestLap.toFixed(2)+'s':'--.--',VIEW_W-108,64,'#cfe3ff',9);

      // ---- the item you are holding
      if(p.item){
        this.panel(VIEW_W/2-34,VIEW_H-84,68,68,th);
        const spr=A.itemSprite(p.item);
        if(spr)g.drawImage(spr,VIEW_W/2-32,VIEW_H-80,64,64);
        else{g.fillStyle='#9fe8ff';g.fillRect(VIEW_W/2-24,VIEW_H-72,48,48);}
        this.text(K.ITEMS[p.item].name,VIEW_W/2,VIEW_H-96,'#ffe9a8',10,'center');
      }
      this.text('ENTER / L  USE ITEM',VIEW_W/2,VIEW_H-8,'#8fa6c4',10,'center');

      // ---- standings down the right edge
      const order=(race.order||race.karts).slice().sort((a,b)=>a.place-b.place);
      this.panel(12,82,116,20+order.length*17,th);
      this.text('STANDINGS',22,96,'#cfe3ff',10);
      order.forEach((k,i)=>{
        const y=110+i*17;
        g.fillStyle=k.player?'rgba(255,224,102,.18)':'transparent';
        g.fillRect(16,y-10,108,16);
        this.text(String(i+1),22,y,th.kerb,11);
        const spr=A.spriteFor(k.id);
        g.drawImage(spr.frames[0],32,y-9,9,9);
        this.text(A.KARTS[k.id].name,46,y,k.player?'#ffe066':'#dbe6f5',10);
      });

      this.drawMinimap(race);

      // ---- countdown, pause and results
      if(race.phase==='countdown'&&race.countdown>0){
        const n=Math.ceil(race.countdown);
        const txt=n>3?'READY':String(Math.max(1,n));
        this.big(txt,n>3?'#ffe066':'#fff',VIEW_W/2,VIEW_H/2-40,n>3?54:96);
        this.text('GET READY',VIEW_W/2,VIEW_H/2+40,'#cfe3ff',16,'center');
      }
      if(race.paused)this.big('PAUSED','#fff',VIEW_W/2,VIEW_H/2-20,60);
    }
    panel(x,y,w,h,th){
      const g=this.g;
      g.fillStyle='rgba(10,12,20,.72)';
      g.fillRect(x,y,w,h);
      g.strokeStyle=th.kerbRed;g.lineWidth=2;
      g.strokeRect(x+1,y+1,w-2,h-2);
    }
    text(str,x,y,color,size,align){
      const g=this.g;
      g.font=`700 ${size}px "Press Start 2P","Courier New",monospace`;
      g.textAlign=align||'left';
      g.textBaseline='alphabetic';
      g.fillStyle='rgba(0,0,0,.6)';
      g.fillText(str,x+1,y+1);
      g.fillStyle=color;
      g.fillText(str,x,y);
    }
    big(str,color,x,y,size){
      const g=this.g;
      g.font=`700 ${size}px "Press Start 2P","Courier New",monospace`;
      g.textAlign='center';
      g.lineWidth=7;g.strokeStyle='rgba(0,0,0,.75)';
      g.strokeText(str,x,y);
      g.fillStyle=color;
      g.fillText(str,x,y);
    }
    // The minimap is the same baked track, drawn once into a small canvas, so
    // the dots are guaranteed to sit on the road the player is actually driving.
    drawMinimap(race){
      const key='mini-'+this.track.id;
      if(!this.mini||this.miniKey!==key){
        const b=this.bakedFor(this.track);
        const size=132;
        const cv=this.doc.createElement('canvas');
        cv.width=size;cv.height=size;
        const cg=cv.getContext('2d');
        cg.imageSmoothingEnabled=false;
        const sc=Math.min(size/b.w,size/b.h);
        const w=b.w*sc,h=b.h*sc;
        cg.drawImage(b.canvas,(size-w)/2,(size-h)/2,w,h);
        this.mini={canvas:cv,sc,ox:(size-w)/2-b.off.x*sc,oy:(size-h)/2-b.off.y*sc,size};
        this.miniKey=key;
      }
      const m=this.mini,g=this.g;
      const x=VIEW_W-152,y=VIEW_H-152;
      g.fillStyle='rgba(10,12,20,.72)';
      g.fillRect(x-6,y-6,m.size+12,m.size+12);
      g.strokeStyle=this.track.theme.kerbRed;g.lineWidth=2;
      g.strokeRect(x-5,y-5,m.size+10,m.size+10);
      g.drawImage(m.canvas,x,y);
      for(const k of race.karts){
        const px=x+m.ox+k.x*m.sc,py=y+m.oy+k.y*m.sc;
        g.fillStyle=k.player?'#ffe066':'#e2e8f5';
        g.fillRect(Math.round(px)-2,Math.round(py)-2,k.player?5:4,k.player?5:4);
        if(k.player){
          g.strokeStyle='#1c1c22';g.lineWidth=1;
          g.strokeRect(Math.round(px)-3,Math.round(py)-3,7,7);
        }
      }
    }
  }
  function ordinal(n){return ['st','nd','rd'][n-1]||'th';}

  const api=Object.freeze({KartGame,bakeTrack,VIEW_W,VIEW_H,sound});
  root.PixelKartView=api;
  if(typeof module==='object')module.exports=api;
  if(root.document&&root.document.addEventListener){
    root.document.addEventListener('DOMContentLoaded',()=>{
      const host=root.document.getElementById('kart-screen');
      if(!host)return;
      const game=new KartGame(root.document);
      root.PixelKart=game;
      if(root.opener&&!root.opener.closed)root.opener.postMessage({type:'kart-ready'},'*');
    });
  }
})(typeof globalThis==='object'?globalThis:this);
