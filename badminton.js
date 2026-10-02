/* Shuttle Club frontend. Only character art is shared with the adventure.
   The court is drawn through PixelBadmintonView: one pinhole camera over a metric
   court, so the floor is a trapezoid, the four footwork directions read as four
   distinct screen directions, and characters scale with their distance. */
(function(){
  'use strict';
  const {Match,COURT,ABILITIES,flight}=PixelBadmintonCore,view=PixelBadmintonView,assets=PixelQuestCharacters;
  const $=s=>document.querySelector(s),canvas=$('#bd-game'),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
  const setup=$('#bd-setup'),modal=$('#bd-modal'),keys=new Set(),edges=new Set();
  const shortNames={explorer:'EXPLORER',soldier:'COMMANDO',mystic:'THREE-EYED',dora:'DORAEMON',goku:'SON GOKU',nezha:'NEZHA'};
  const settings={character:'explorer',opponent:'soldier',difficulty:'medium',mode:'normal'};
  const colors={explorer:'#f5bf59',soldier:'#82c9ff',mystic:'#c6a5f0',dora:'#82e1ef',goku:'#f6af6e',nezha:'#ed97ac'};
  let match=null,dialog='',destination='./',clock=0,accumulator=0,last=performance.now(),muted=false;
  let record={wins:0,matches:0,bestRally:0};
  try{const r=JSON.parse(localStorage.getItem('pq-badminton-records'));if(r&&Number.isFinite(r.matches)&&Number.isFinite(r.wins))record={...record,...r};}catch{}
  function updateRecord(){$('#bd-record').textContent=record.wins+' WINS / '+record.matches+' MATCHES';}updateRecord();
  const sound={context:null,
    init(){try{if(!this.context)this.context=new(window.AudioContext||window.webkitAudioContext)();this.context.resume().catch(()=>{});}catch{}},
    tone(freq,length=.07,type='triangle',volume=.065){if(!this.context||muted)return;const c=this.context,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.5),c.currentTime+length);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+length);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+length);},
    event(e){if(e.type==='hit'){this.tone(e.shot==='special'?900:e.shot==='smash'?180:560,.085,'triangle');}if(e.type==='point'){this.tone(e.side?230:740,.18,'square',.025);}if(e.type==='serve')this.tone(400);if(e.type==='jump')this.tone(300,.05);if(e.type==='finish'){for(let i=0;i<4;i++)setTimeout(()=>this.tone([523,659,784,1047][i],.18,'triangle'),i*140);}}
  };
  const sportArt={...assets.art};
  // Keep the existing Commando's face and uniform, exchange his rifle for a racket.
  for(const name of ['soldier','soldierWalk','soldierJump'])sportArt[name]=assets.art[name].map((row,y)=>y>=9&&y<=14?row.split('').map((c,x)=>x>=12?'.':c==='G'?'W':c).join(''):row);
  // Snap sprite origins to half a logical pixel: exactly one device pixel on the 2x
  // canvas, so the pixel art stays crisp while positions still move smoothly.
  const snap=n=>Math.round(n*2)/2;
  function sprite(c,name,x,y,flip,scale=1,palette={}){
    const rows=sportArt[name]||sportArt.hero,width=Math.max(...rows.map(r=>r.length));c.save();c.translate(snap(x)+(flip?width*scale:0),snap(y));c.scale(flip?-scale:scale,scale);
    for(let yy=0;yy<rows.length;yy++)for(let xx=0;xx<rows[yy].length;xx++){const char=rows[yy][xx];if(char!=='.'){c.fillStyle=palette[char]||assets.palette[char]||'#fff';c.fillRect(xx,yy,1,1);}}c.restore();
  }
  // Total ground speed, so crossing the court sideways animates like running up it.
  const groundSpeed=p=>Math.hypot(p.vx||0,(p.vz||0)*147);
  function basePose(p,moving){const step=moving&&Math.floor(clock*11)%2;if(p.character==='explorer')return !p.ground?'jump':step?'walk':'hero';if(p.character==='soldier')return !p.ground?'soldierJump':step?'soldierWalk':'soldier';if(p.character==='mystic')return !p.ground?'mysticJump':step?'mysticWalk':'mystic';if(p.character==='goku')return p.animation>0?'gokuShoot':step?'gokuWalk':'goku';if(p.character==='nezha')return step?'nezhaWalk':'nezha';return step?'doraWalk':'dora';}
  function portrait(c,id){c.clearRect(0,0,c.canvas.width,c.canvas.height);c.imageSmoothingEnabled=false;const pose=id==='explorer'?'hero':id,rows=sportArt[pose],scale=72/rows.length,width=Math.max(...rows.map(r=>r.length));sprite(c,pose,(c.canvas.width-width*scale)/2,c.canvas.height-rows.length*scale-4,false,scale,assets.colors[id]||{});}
  for(const id of assets.ids){
    const button=document.createElement('button');button.className='bd-character';button.dataset.character=id;button.setAttribute('aria-label',assets.names[id]);button.setAttribute('aria-pressed',String(id===settings.character));button.innerHTML='<canvas width="120" height="84" aria-hidden="true"></canvas><span>'+shortNames[id]+'</span>';
    button.addEventListener('click',()=>{settings.character=id;for(const b of $('#bd-characters').children)b.setAttribute('aria-pressed',String(b===button));$('#bd-selected-name').textContent=assets.names[id].toUpperCase();describe();});$('#bd-characters').append(button);portrait(button.querySelector('canvas').getContext('2d'),id);
    const option=document.createElement('option');option.value=id;option.textContent=assets.names[id];$('#bd-opponent').append(option);
  }
  $('#bd-opponent').value='soldier';$('#bd-opponent').addEventListener('change',e=>settings.opponent=e.target.value);
  for(const [selector,field] of [['#bd-difficulty','difficulty'],['#bd-style','mode']])for(const b of $(selector).children)b.addEventListener('click',()=>{settings[field]=b.dataset.value;for(const peer of $(selector).children)peer.setAttribute('aria-pressed',String(b===peer));describe();});
  function describe(){
    $('#bd-difficulty-copy').textContent={easy:'A relaxed partner: slower feet, longer reactions.',medium:'A steady rally partner with a sharp return.',hard:'Quick footwork, precise placement and aerial smashes.'}[settings.difficulty];
    $('#bd-style-copy').textContent=settings.mode==='normal'?'Equal movement and rackets. Pure badminton.':ABILITIES[settings.character].name+' · '+ABILITIES[settings.character].description;
    document.body.classList.toggle('bd-special',settings.mode==='special');
  }
  function start(){sound.init();keys.clear();edges.clear();match=new Match(settings);setup.hidden=true;modal.hidden=true;dialog='';$('#bd-stage').textContent=settings.difficulty.toUpperCase()+' / '+(settings.mode==='special'?'HERO SKILLS':'NORMAL MATCH');$('#bd-live').textContent='Match started. Your serve. Press J.';canvas.focus();}
  $('#bd-start').addEventListener('click',start);
  function showDialog(kind){
    if(!match)return;keys.clear();edges.clear();match.paused=true;dialog=kind;modal.hidden=false;$('#bd-final-score').hidden=kind!=='finished';
    const data={paused:['TAKE A BREATHER','PAUSED','Your next rally will be right here.','KEEP PLAYING ▶','MATCH SETUP','BACK TO PIXEL QUEST'],leave:['LEAVE SHUTTLE CLUB?','RETURN HOME?','This match will end. Your adventure progress is kept separately.','YES, RETURN HOME','CANCEL',''],setup:['START A NEW MATCH?','NEW MATCH?','The current score will be reset.','YES, MATCH SETUP','CANCEL',''],finished:[match.winner===0?'THE COURT IS YOURS':'A GOOD RALLY, WELL PLAYED',match.winner===0?'YOU WIN!':'AI WINS','Longest rally: '+match.bestRally+' hits · '+assets.names[match.players[0].character]+' vs '+assets.names[match.players[1].character],'PLAY AGAIN ▶','MATCH SETUP','BACK TO PIXEL QUEST']}[kind];
    $('#bd-modal-tag').textContent=data[0];$('#bd-modal-title').textContent=data[1];$('#bd-modal-copy').textContent=data[2];$('#bd-modal-primary').textContent=data[3];$('#bd-modal-secondary').textContent=data[4];$('#bd-modal-tertiary').textContent=data[5];$('#bd-modal-tertiary').hidden=!data[5];$('#bd-final-score').textContent=match.score[0]+' — '+match.score[1];$('#bd-modal-primary').focus();
  }
  function resume(){if(!match)return;match.paused=false;modal.hidden=true;dialog='';canvas.focus();}
  function openSetup(){match=null;dialog='';modal.hidden=true;setup.hidden=false;keys.clear();edges.clear();$('#bd-stage').textContent='PRACTICE MAKES PIXEL PERFECT';$('#bd-start').focus();}
  $('#bd-modal-primary').addEventListener('click',()=>{if(dialog==='paused')resume();else if(dialog==='leave')location.href=destination;else if(dialog==='setup')openSetup();else if(dialog==='finished')start();});
  $('#bd-modal-secondary').addEventListener('click',()=>{if(dialog==='leave'||dialog==='setup')showDialog(match.phase==='finished'?'finished':'paused');else if(dialog==='finished')openSetup();else showDialog('setup');});
  $('#bd-modal-tertiary').addEventListener('click',()=>{destination='./';showDialog('leave');});
  $('#bd-pause').addEventListener('click',()=>{if(match&&match.phase!=='finished'){if(dialog==='paused')resume();else if(!dialog)showDialog('paused');}});
  for(const a of document.querySelectorAll('[data-leave]'))a.addEventListener('click',e=>{if(match&&match.phase!=='finished'){e.preventDefault();destination=a.getAttribute('href');showDialog('leave');}});
  $('#bd-sound').addEventListener('click',()=>{muted=!muted;$('#bd-sound').textContent=muted?'SOUND OFF':'SOUND ON';$('#bd-sound').setAttribute('aria-pressed',String(!muted));if(!muted)sound.init();});
  $('#bd-fullscreen').addEventListener('click',()=>{const promise=document.fullscreenElement?document.exitFullscreen():$('.badminton-screen').requestFullscreen();promise?.catch(()=>{});});
  const fsTools=document.createElement('div');fsTools.className='bd-fullscreen-tools';fsTools.innerHTML='<button aria-label="Pause fullscreen match">Ⅱ</button><button aria-label="Exit fullscreen">⛶</button>';$('.badminton-screen').append(fsTools);fsTools.children[0].onclick=()=>$('#bd-pause').click();fsTools.children[1].onclick=()=>$('#bd-fullscreen').click();
  const fsTouch=$('.bd-touch').cloneNode(true);fsTouch.classList.add('bd-fs-touch');$('.badminton-screen').append(fsTouch);
  const relevant=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyA','KeyD','KeyW','KeyS','Space','KeyK','KeyJ','KeyH','KeyL','KeyE','KeyP','Escape']);
  window.addEventListener('keydown',e=>{
    if((e.code==='KeyP'||e.code==='Escape')&&match){e.preventDefault();if(e.repeat)return;if(dialog==='leave'||dialog==='setup')showDialog(match.phase==='finished'?'finished':'paused');else if(dialog==='paused')resume();else if(!dialog&&match.phase!=='finished')showDialog('paused');return;}
    if(e.code==='Enter'&&setup.hidden===false&&e.target.tagName!=='SELECT'&&e.target.tagName!=='BUTTON'){e.preventDefault();start();return;}
    if(!match||dialog||!relevant.has(e.code))return;e.preventDefault();if(!keys.has(e.code))edges.add(e.code);keys.add(e.code);
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',()=>{keys.clear();edges.clear();if(match&&match.phase!=='finished'&&!dialog)showDialog('paused');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&match&&match.phase!=='finished'&&!dialog)showDialog('paused');});
  modal.addEventListener('keydown',e=>{if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button')].filter(b=>!b.hidden);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}}});
  for(const b of document.querySelectorAll('[data-bd-key]')){
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);sound.init();if(!keys.has(b.dataset.bdKey))edges.add(b.dataset.bdKey);keys.add(b.dataset.bdKey);b.classList.add('held');});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{keys.delete(b.dataset.bdKey);b.classList.remove('held');});
  }
  // Two-axis footwork. In this projection the two axes are diagonal on screen:
  // move walks along the court (up-right / down-left), side walks across it
  // (down-right / up-left). Forward is the front line, so ArrowDown / S adds lane.
  function input(){const move=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),side=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));let shot=edges.has('KeyE')?'special':keys.has('KeyH')?'smash':keys.has('KeyL')?'drop':keys.has('KeyJ')?'clear':null;return {move,side,jump:edges.has('Space')||edges.has('KeyK'),shot};}
  function events(){for(const event of match.events.splice(0)){sound.event(event);if(event.type==='point')$('#bd-live').textContent=(event.side?'AI':'You')+' scored. '+match.score[0]+' to '+match.score[1]+'. '+event.reason;if(event.type==='finish'){record.matches++;if(event.winner===0)record.wins++;record.bestRally=Math.max(record.bestRally,match.bestRally);try{localStorage.setItem('pq-badminton-records',JSON.stringify(record));}catch{}updateRecord();$('#bd-live').textContent=(event.winner===0?'You win.':'AI wins.')+' Final score '+match.score.join(' to ');showDialog('finished');}}}

  /* ------------------------------------------------------------------ court */
  const rect=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const text=(s,x,y,size=8,color='#eee9cf',align='left')=>{ctx.font='bold '+size+'px monospace';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,Math.round(x),Math.round(y));};
  const PAL={floor:'#2f544c',floorShade:'#26463f',mat:'#ba8b62',matLine:'#9c7958',matEdge:'#c7976b',
    court:'#43796a',courtEdge:'#56917b',courtSkirt:'#2b5348',line:'#ebedcd',lineSoft:'#e3e9c9',lineFaint:'#a9cab0',
    wall:'#172f3b',wallMid:'#294b51',window:'#668b93',windowWarm:'#bfab96',windowDeep:'#9c6c76',
    crowd:['#8a9d96','#ac8d85','#637a8b','#9a9d79'],skin:'#caad8b',board:'#354d46'};
  const P=(x,z,y)=>view.projectCourt(x,z,y===undefined?COURT.floor:y);
  // The floor is tilted, so anything round on it is projected point by point instead
  // of being approximated with a 2D ellipse. Radii are given in metres.
  const groundRing=(x,z,rx,rz,steps=22)=>{const out=[];for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2;out.push(P(x+Math.cos(a)*rx*view.PX_PER_M,z+Math.sin(a)*rz/view.COURT.width));}return out;};
  const polygon=p=>{ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();};
  const fillPoly=(p,color)=>{if(p.length<3)return;polygon(p);ctx.fillStyle=color;ctx.fill();};
  const fillRing=fillPoly;
  const strokeRing=(p,color,width=1)=>{polygon(p);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
  const line=(a,b,color,width=1)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();};
  const dashed=(a,b,color,step=5)=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),n=Math.max(1,Math.round(len/step));for(let i=0;i<n;i+=2){const t0=i/n,t1=Math.min(1,(i+1)/n);line({x:a.x+dx*t0,y:a.y+dy*t0},{x:a.x+dx*t1,y:a.y+dy*t1},color,1);}};

  // ---- static backdrop: arena floor, mat, court markings and the far stand ----
  const background=document.createElement('canvas');background.width=view.SIZE.width*2;background.height=view.SIZE.height*2;
  const bg=background.getContext('2d');bg.imageSmoothingEnabled=false;
  const bgPoly=p=>{if(p.length<3)return;bg.beginPath();bg.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)bg.lineTo(p[i].x,p[i].y);bg.closePath();bg.fill();};
  const bgLine=(a,b,color,width=1)=>{bg.beginPath();bg.moveTo(a.x,a.y);bg.lineTo(b.x,b.y);bg.strokeStyle=color;bg.lineWidth=width;bg.stroke();};
  const bgQuad=(x0,z0,x1,z1,color)=>{bg.fillStyle=color;bgPoly([P(x0,z0),P(x1,z0),P(x1,z1),P(x0,z1)]);};
  function bgLabel(s,x,y,size,color,angle){bg.save();bg.translate(x,y);bg.rotate(angle);bg.font='bold '+size+'px monospace';bg.textAlign='center';bg.fillStyle=color;bg.fillText(s,0,0);bg.restore();}
  function drawStand(){
    // The stand is a vertical plane just behind the far baseline. Its base edge is a
    // straight line on screen, so the whole backdrop is one clipped polygon.
    const z0=-3.4,z1=2.6,base0=P(view.WALL.x,z0),base1=P(view.WALL.x,z1);
    bg.fillStyle=PAL.wall;bgPoly([base0,base1,{x:base1.x,y:-600},{x:base0.x,y:-600}]);
    bg.save();bg.beginPath();bg.moveTo(base0.x,base0.y);bg.lineTo(base1.x,base1.y);bg.lineTo(base1.x,-600);bg.lineTo(base0.x,-600);bg.closePath();bg.clip();
    const H=m=>COURT.floor-m*view.PX_PER_M;
    for(let i=0;i<10;i++){
      const za=-2.9+i*.68,zb=za+.56;
      bgQuad2(za,zb,H(2.1),H(4.6),PAL.window);
      bgQuad2(za+.04,zb-.04,H(2.18),H(3.0),PAL.windowWarm);
      bgQuad2(za+.04,zb-.04,H(3.0),H(3.66),PAL.windowDeep);
    }
    for(let row=0;row<3;row++){
      const stand=H(.1+row*.62);
      bgQuad2(-3.2,2.4,stand-3,stand,row%2?PAL.wallMid:PAL.wall);
      for(let i=0;i<44;i++){
        const z=-3.15+i*.13,head=P(view.WALL.x,z,H(.34+row*.62)),size=Math.max(1.8,Math.abs(head.y-P(view.WALL.x,z,stand).y));
        bg.fillStyle=PAL.crowd[(i*3+row)%4];bg.fillRect(Math.round(head.x-size*.3),Math.round(head.y+size*.3),Math.max(2,Math.round(size*.6)),Math.max(2,Math.round(size*.8)));
        bg.fillStyle=PAL.skin;bg.fillRect(Math.round(head.x-size*.2),Math.round(head.y),Math.max(1,Math.round(size*.42)),Math.max(1,Math.round(size*.32)));
      }
    }
    bg.restore();
  }
  // a quad on the stand plane, spanning z0..z1 and two simulation heights
  function bgQuad2(z0,z1,yBottom,yTop,color){bg.fillStyle=color;bgPoly([P(view.WALL.x,z0,yBottom),P(view.WALL.x,z1,yBottom),P(view.WALL.x,z1,yTop),P(view.WALL.x,z0,yTop)]);}
  function drawFloorAndCourt(){
    const M=view.MAT;
    // the wooden arena floor the whole court sits on
    bg.fillStyle=PAL.floorShade;bgPoly([P(M.x0,M.z0),P(M.x1,M.z0),P(M.x1,M.z1),P(M.x0,M.z1)]);
    bg.fillStyle=PAL.mat;bgPoly([P(M.x0+.5,M.z0+.22),P(M.x1-.5,M.z0+.22),P(M.x1-.5,M.z1-.3),P(M.x0+.5,M.z1-.3)]);
    for(let z=M.z0+.5;z<M.z1;z+=.18)bgLine(P(M.x0+.5,z),P(M.x1-.5,z),PAL.matLine,.7);
    for(let x=M.x0+8;x<M.x1;x+=28)bgLine(P(x,M.z0+.22),P(x,M.z1-.3),PAL.matEdge,.5);
    // The court surface is the *doubles* rectangle: the two 0.46 m corridors either
    // side of the singles sidelines are part of the same floor, not bare mat.
    const cx0=COURT.left,cx1=COURT.right,cz0=view.zFar,cz1=view.zNear;
    // a symmetric apron all the way round, so the court reads as one raised slab
    const rimM=.2,rimX=rimM*view.PX_PER_M,rimZ=rimM/view.COURT.width;
    bg.fillStyle=PAL.courtSkirt;
    bgPoly([P(cx0-rimX,cz0-rimZ),P(cx1+rimX,cz0-rimZ),P(cx1+rimX,cz1+rimZ),P(cx0-rimX,cz1+rimZ)]);
    bg.fillStyle=PAL.court;
    bgPoly([P(cx0,cz0),P(cx1,cz0),P(cx1,cz1),P(cx0,cz1)]);
    // markings last, so nothing paints over them
    for(const [x0,z0,x1,z1,kind] of view.LINES){
      const color=kind==='outer'?PAL.lineFaint:kind==='service'?PAL.lineSoft:PAL.line;
      bgLine(P(x0,z0),P(x1,z1),color,kind==='outer'?.7:kind==='netline'?1.4:1);
    }
    // two low boards behind the far sideline, keeping the old court's signage
    const zBoard=view.zFar-.14,bh=.55*view.PX_PER_M;
    for(const [x0,x1,label] of [[COURT.left+8,COURT.left+178,'SHUTTLE CLUB'],[COURT.right-178,COURT.right-8,'PLAY ONE MORE']]){
      bg.fillStyle=PAL.board;bgPoly([P(x0,zBoard,bh),P(x1,zBoard,bh),P(x1,zBoard,0),P(x0,zBoard,0)]);
      bgLine(P(x0,zBoard,bh),P(x1,zBoard,bh),'#769b8a',1);
      const a=P(x0,zBoard,bh*.55),b=P(x1,zBoard,bh*.55),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      bgLabel(label,mid.x,mid.y+1,Math.max(3,Math.min(5,Math.hypot(b.x-a.x,b.y-a.y)/32)),'#c9d6b3',Math.atan2(b.y-a.y,b.x-a.x));
    }
  }
  bg.setTransform(2,0,0,2,0,0);
  // Distance haze: the arena floor darkens towards the horizon, so the far side of
  // the frame reads as depth instead of a flat slab of green.
  const haze=bg.createLinearGradient(0,0,0,view.SIZE.height);
  haze.addColorStop(0,'#142329');haze.addColorStop(.42,PAL.floorShade);haze.addColorStop(.8,PAL.floor);haze.addColorStop(1,'#33594f');
  bg.fillStyle=haze;bg.fillRect(0,0,view.SIZE.width,view.SIZE.height);
  drawStand();drawFloorAndCourt();

  /* ---- net, players, shuttle --------------------------------------------- */
  function drawNet(){
    const z0=view.zFar,z1=view.zNear,top=COURT.netTop;
    for(let z=z0;z<=z1+.001;z+=.25)line(P(COURT.net,z,top),P(COURT.net,z,COURT.floor),'#c5d6ba44',1);
    for(let y=top;y<COURT.floor;y+=8)line(P(COURT.net,z0,y),P(COURT.net,z1,y),'#c5d6ba66',1);
    fillPoly([P(COURT.net,z0,top),P(COURT.net,z1,top),P(COURT.net,z1,top+3),P(COURT.net,z0,top+3)],"#fff1ce");
    for(const z of [z0,z1]){line(P(COURT.net,z,top),P(COURT.net,z,COURT.floor),'#405965',3);fillPoly([P(COURT.net,z-.03,COURT.floor),P(COURT.net,z-.03,COURT.floor-5),P(COURT.net,z+.03,COURT.floor-5),P(COURT.net,z+.03,COURT.floor)],'#294a4e');}
  }
  const racket=document.createElement('canvas');racket.width=15;racket.height=28;const rc=racket.getContext('2d');
  for(let y=0;y<17;y++)for(let x=0;x<13;x++){const v=((x-6)/5.5)**2+((y-8)/7.5)**2;if(v>.69&&v<1.15)rect(rc,x+1,y,1,1,'#e7d7a6');else if(v<=.69&&(x%3===0||y%3===0))rect(rc,x+1,y,1,1,'#9bbab5');}rect(rc,7,17,2,5,'#8eab9e');rect(rc,7,22,2,6,'#e47b53');
  function drawPlayer(p,active){
    const speed=groundSpeed(p),moving=speed>14,pose=basePose(p,moving),rows=sportArt[pose],
      box=view.spriteOf(p.x,p.z,p.y),scale=box.height/rows.length,k=box.height/41,
      width=Math.max(...rows.map(r=>r.length))*scale,dir=p.side?-1:1;
    const lift=Math.min(1,Math.max(0,COURT.floor-p.y)/110);
    // contact shadow on the slanted floor: it stays on the spot, shrinks and fades
    fillRing(groundRing(p.x,p.z,view.SHADOW_METRES*(1-.45*lift),view.SHADOW_METRES*(1-.45*lift)),'rgba(14,38,32,'+(.34*(1-.6*lift)).toFixed(3)+')');
    if(p.boost>0)for(let i=0;i<3;i++)rect(ctx,box.x-dir*(15+i*7)*k,box.y-18*k+i*5*k,5*k,2*k,'#b9f9ff88');
    if(!p.ground&&p.character==='dora'){rect(ctx,box.x,box.y-box.height-4*k,1,6*k,'#e6b24d');const span=[10,5,2,5][Math.floor(clock*30)%4];rect(ctx,box.x-span*k,box.y-box.height-6*k,span*2*k,2*k,'#ffda6e');}
    // A grounded bob whose amplitude follows the real speed, so footwork across the
    // court animates as smoothly as footwork up and down it.
    const bob=p.ground?Math.sin(clock*(4.5+speed*.035))*.15*(speed/126):0;
    sprite(ctx,pose,box.x-width/2,box.y-box.height+bob,p.side===1,scale,assets.colors[p.character]||{});
    const swing=p.animation>0?1-p.animation/.28:0,angle=p.animation>0?(-1.5+swing*3.1):-.3+Math.sin(clock*3)*.07;
    ctx.save();ctx.translate(snap(box.x+dir*13*k),snap(box.y-22*k));ctx.scale(dir,1);ctx.rotate(angle);ctx.drawImage(racket,1,-27);ctx.restore();
    if(p.animation>0)for(let i=0;i<4;i++)rect(ctx,box.x+dir*(16+i*5)*k,box.y-35*k+Math.sin(i+clock*25)*10*k,2*k,2*k,p.shot==='special'?colors[p.character]:'#f8efbe');
    if(active&&p.swing>0)rect(ctx,box.x-2*k,box.y-47*k,4*k,2*k,'#fff4b2');
  }
  function drawShuttle(b){
    const at=P(b.x,b.z,b.y),spot=P(b.x,b.z,COURT.floor);
    if(b.trail)for(let i=0;i<b.trail.length;i++){const t=b.trail[i],q=P(t.x,t.z,t.y),size=1+i/4;rect(ctx,q.x-size/2,q.y-size/2,size,size,b.skill?b.skill.color+'88':'#e9ebc133');}
    // how high the shuttle is, read off the court it is over
    fillRing(groundRing(b.x,b.z,.22,.22),'rgba(14,38,32,.30)');
    dashed(spot,at,'#e9ebc12e',6);
    ctx.save();ctx.translate(snap(at.x),snap(at.y));
    const ahead=P(b.x+(b.vx||0)/60,b.z+(b.vz||0)/60,b.y+(b.vy||0)/60);
    ctx.rotate(Math.atan2(ahead.y-at.y,ahead.x-at.x));ctx.scale(1.2,1.2);
    rect(ctx,-5,-4,2,8,'#a9d1c5');rect(ctx,-4,-3,4,6,'#f6f4d9');rect(ctx,-3,-2,5,4,'#ffffff');rect(ctx,-7,-3,3,1,'#fff9db');rect(ctx,-7,2,3,1,'#fff9db');rect(ctx,1,-2,3,4,'#c99961');rect(ctx,3,-1,1,2,'#ffe0a1');ctx.restore();
  }
  // Where the shuttle will touch down. The prediction is the same integration the
  // simulation runs, so the marker can never drift away from the ball.
  function drawLanding(b){
    const path=flight(b),land=path[path.length-1];if(!land)return;
    const pulse=.5+.5*Math.sin(clock*7),radius=.52+.2*pulse;
    fillRing(groundRing(land.x,land.z,radius,radius),'rgba(255,214,120,'+(.10+.06*pulse).toFixed(3)+')');
    strokeRing(groundRing(land.x,land.z,radius,radius),'rgba(255,225,150,'+(.5+.3*pulse).toFixed(3)+')',1.2);
    const c=P(land.x,land.z);
    for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])line({x:c.x+dx*5,y:c.y+dy*5},{x:c.x+dx*9,y:c.y+dy*9},'rgba(255,235,170,.6)',1);
  }

  function draw(){
    ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(background,0,0);
    ctx.setTransform(2,0,0,2,0,0);
    const display=match||attract,behind=[],front=[];
    for(const p of display.players)(p.x>COURT.net?behind:front).push({depth:P(p.x,p.z,p.y).depth,draw:()=>drawPlayer(p,!!match)});
    const b=display.shuttle;
    if(b)(b.x>COURT.net?behind:front).push({depth:P(b.x,b.z,b.y).depth,draw:()=>drawShuttle(b)});
    // The net is a plane at the middle of the court, so players and the shuttle just
    // need to be painted on whichever side of it they are, nearer one last.
    behind.sort((a,c)=>c.depth-a.depth);front.sort((a,c)=>c.depth-a.depth);
    if(match&&match.phase==='rally'&&b)front.push({depth:0,draw:()=>drawLanding(b)});
    for(const item of behind)item.draw();
    drawNet();
    for(const item of front)item.draw();
    for(const p of display.particles||[]){const q=P(p.x,p.z,p.y);rect(ctx,q.x,q.y,2,2,p.color);}
    rect(ctx,10,7,460,38,'#132d35ee');rect(ctx,10,44,460,1,'#698f7a');
    text('YOU',23,18,6,'#99cbb3');text(shortNames[display.players[0].character],23,32,9,'#f3cf85');text('AI · '+settings.difficulty.toUpperCase(),456,18,6,'#b1c7c5','right');text(shortNames[display.players[1].character],456,32,9,'#bddfd9','right');
    text(String(display.score[0]).padStart(2,'0'),216,34,22,'#ffe0a0','right');text(':',240,31,16,'#719b8c','center');text(String(display.score[1]).padStart(2,'0'),264,34,22,'#c9e5d0');
    if(match){
      text('FIRST TO 11',240,55,6,'#d1dabc','center');text('RALLY '+match.rally,240,65,6,'#94b6aa','center');
      for(const p of match.players){const x=p.side?330:21;
        if(match.special){text('E / '+Math.round(p.meter)+'%'+(p.skillCooldown>0?' · '+Math.ceil(p.skillCooldown)+'s':''),x,258,6,p.meter>=100&&p.skillCooldown===0?'#ffe3a2':'#bdd8c8');rect(ctx,x,261,126,3,'#173f40');rect(ctx,x,261,126*p.meter/100,3,colors[p.character]);}
      }
      if(match.phase==='serve'){const p=match.players[match.server],head=view.spriteOf(p.x,p.z,p.y);text('▼',head.x,head.y-head.height-9,10,'#f9d77f','center');text(match.server?'AI SERVING…':'J TO SERVE',240,96,10,'#fff0bc','center');}
      if(match.phase==='point'){rect(ctx,142,84,196,23,'#16393bdc');text(match.message,240,100,10,'#ffe0a0','center');}
      else if(match.messageTime>0&&match.phase==='rally'&&match.shuttle.skill){text(match.message,240,92,8,match.shuttle.skill.color,'center');}
      if(match.phase==='finished'&&match.winner===0)for(let i=0;i<24;i++){const x=(i*79)%480,y=(clock*27+i*21)%180;rect(ctx,x,y,2,3,['#ffd77b','#c1e6b5','#eea6ab'][i%3]);}
      if(!match.special)text('J CLEAR  ·  L DROP  ·  H SMASH',240,261,6,'#e6ebd0','center');
    }
    ctx.setTransform(1,0,0,1,0,0);
  }
  const attract=new Match({...settings,seed:17});Object.assign(attract.shuttle,{x:255,y:118,z:.55,vx:30,vy:20,vz:.05});
  function loop(now){
    const elapsed=Math.min(.08,(now-last)/1000);last=now;clock+=elapsed;accumulator+=elapsed;
    while(accumulator>=1/60){if(match&&!dialog){match.step(1/60,input());events();}edges.clear();accumulator-=1/60;}draw();requestAnimationFrame(loop);
  }requestAnimationFrame(loop);
  // Read-only acceptance surface: no adventure globals or storage are used.
  const courtPoint=(x,z,y)=>{const q=P(x,z,y);return {x:q.x*2,y:q.y*2,scale:q.scale,depth:q.depth};};
  Object.defineProperty(window,'PixelBadminton',{value:Object.freeze({
    get snapshot(){return match?match.snapshot():{phase:'setup',options:{...settings}};},
    get records(){return {...record};},
    // Canvas pixels, because the canvas is drawn at 2x, for the browser checks.
    get camera(){return {...view.CAMERA};},
    footOf(side){const p=(match||attract).players[side],box=view.spriteOf(p.x,p.z,p.y);return {x:box.x*2,y:box.y*2,height:box.height*2,scale:box.scale,depth:box.depth,lane:p.z,alongCourt:p.x,altitude:p.y};},
    project:(x,z,y)=>courtPoint(x,z,y),
    // The shuttle's own prediction, so a check can compare marker and landing.
    landing(){if(!match)return null;const path=flight(match.shuttle),last=path[path.length-1];return last?{x:last.x,z:last.z}:null;}
  })});
})();
