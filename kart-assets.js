/* Pixel Kart: generated art. Every kart, driver and item is drawn here from code
   - there are no image files anywhere in this mode.

   The drivers are the important part. Each character is re-drawn seated in a
   kart, seen from above and slightly behind: shoulders either side of the seat,
   the top of their head in the middle, and their arms reaching forward to the
   wheel. Hair, skin and shirt colours are taken from that character's own
   palette in character-assets.js, and each keeps a distinct silhouette (cap,
   helmet, third eye, round blue head, spikes, hair buns) so you can tell the
   five racers apart at a glance from directly above.

   Karts are baked once per character at 16 headings, so the renderer only ever
   blits a finished sprite instead of rotating pixels every frame. */
(function(root){
  'use strict';
  const assets=root.PixelQuestCharacters||(typeof require==='function'?require('./character-assets.js'):null);
  const PAL=assets.palette;
  const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const shade=(h,f)=>{const[r,g,b]=hex(h);const m=v=>Math.max(0,Math.min(255,Math.round(v*f)));return'#'+[m(r),m(g),m(b)].map(v=>v.toString(16).padStart(2,'0')).join('');};
  const mix=(a,b,t)=>{const A=hex(a),B=hex(b);return'#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};

  /* Per-character kart liveries and driver colouring. `hair` is what a driver
     looks like from above, `style` picks the silhouette, `shirt` is the race suit
     over their shoulders, and `kart` is the bodywork they inherited. */
  const KARTS={
    explorer:{name:'Pixel Explorer',style:'cap',kart:['#e7533f','#a8352a','#ff8a72'],
      hair:PAL.R,skin:PAL.S,shirt:'#27779c',trim:PAL.Y,wheel:'#3a3f46',number:'1'},
    soldier:{name:'Commando',style:'helmet',kart:['#5b6977','#3d4753','#8a9aa8'],
      hair:'#7d8b98',skin:PAL.S,shirt:'#237bea',trim:'#ffc15e',wheel:'#2f343a',number:'2'},
    mystic:{name:'Three-Eyed Kid',style:'thirdEye',kart:['#2675de','#1a4ea0','#6fa8f5'],
      hair:'#9b532b',skin:PAL.S,shirt:'#5b4fd6',trim:'#ffe1b1',wheel:'#333a4a',number:'3'},
    dora:{name:'Doraemon',style:'round',kart:['#3dbbff','#1f7fc4','#8fe0ff'],
      hair:'#3dbbff',skin:'#fff9e9',shirt:'#f34c4a',trim:'#ffcf45',wheel:'#2b3742',number:'4'},
    goku:{name:'Son Goku',style:'spikes',kart:['#f78a28','#b85510','#ffb35e'],
      hair:'#18202c',skin:PAL.S,shirt:'#2269b4',trim:'#ffdd62',wheel:'#2a2f38',number:'5'},
    nezha:{name:'Nezha',style:'buns',kart:['#36c185','#1f7a4f','#7fe0b0'],
      hair:'#182027',skin:PAL.S,shirt:'#dc3d36',trim:'#ffd066',wheel:'#2f3a33',number:'6'}
  };
  const SIZE=30;          // kart sprite is SIZE x SIZE, kart facing right
  const DIRS=16;          // baked headings

  function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;return{c,g};}

  /* One driver, seated, seen from above and slightly behind. Drawn in kart-local
     space where +x is forward, so the head sits in the middle of the cockpit with
     the shoulders either side and the arms reaching forward to the wheel. */
  function drawDriver(g,driver){
    const{style,hair,skin,shirt,trim}=driver;
    const px=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
    const disc=(cx,cy,r,color)=>{g.fillStyle=color;for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r+0.35)px(cx+x-r,cy+y-r,1,1,color);};
    const ring=(cx,cy,r,color)=>{g.fillStyle=color;for(let y=-r-1;y<=r+1;y++)for(let x=-r-1;x<=r+1;x++){const d=x*x+y*y;if(d<=(r+1)*(r+1)&&d>=r*r)px(cx+x-r-1,cy+y-r-1,1,1,color);}};
    const hairLit=shade(hair,1.3),hairDark=shade(hair,.62),shirtLit=shade(shirt,1.18),shirtDark=shade(shirt,.72);
    // Shoulders, either side of the seat, then the collar between them.
    px(-6.4,3.4,6,4.2,shirtDark);
    px(-6.4,-7.6,6,4.2,shirtDark);
    px(-6.4,3.4,6,1.5,shirt);
    px(-6.4,-4.9,6,1.5,shirt);
    px(-3.2,-1.5,3,3,shirtLit);
    px(-3.2,-1.5,3,1,shirtDark);
    // Arms reaching forward to the wheel, drawn before the head so the head sits on top.
    for(let i=0;i<5;i++){
      px(0.4+i*1.15,3.1-i*.22,1.35,1.35,shirt);
      px(0.4+i*1.15,-4.45+i*.22,1.35,1.35,shirt);
    }
    // Gloved hands on the rim.
    px(5.5,1.5,1.6,1.6,skin);px(5.5,-3.1,1.6,1.6,skin);
    // Head: a 7px disc with a dark outline so it reads against any bodywork.
    disc(-1.6,-.5,3.6,hairDark);
    if(style==='round'){
      // Doraemon: a big round blue head, white face, red nose, two eyes.
      disc(-1.6,-.5,3.2,hair);
      disc(-2,-.9,2.5,hairLit);
      g.fillStyle=skin;
      for(let y=-2;y<=2;y++)for(let x=-1;x<=3;x++)if(x*x*.55+y*y<=5)px(x-1.2,y-1.1,1,1,skin);
      px(.9,-1.1,1.7,1.7,'#e8544f');
      px(-3.5,-2.6,1.2,1.2,'#20262e');px(.2,-2.6,1.2,1.2,'#20262e');
      disc(-4.9,-.9,1.3,hair);disc(1.9,-1,1.3,hair);
    }else{
      disc(-1.6,-.5,3.2,hair);
      disc(-2.1,-1,2.5,hairLit);
      disc(.4,.3,2.1,skin);                        // face, towards the front
      px(-2.9,.2,1.1,1.1,'#241a12');px(-.4,.2,1.1,1.1,'#241a12');
      if(style==='cap'){
        // Explorer: a red cap with the brim over the face and a yellow band.
        disc(-1.6,-.5,3.2,hair);
        px(-5,.4,5.4,1.7,shade(hair,.78));
        px(.4,1.3,2.6,1.1,shade(hair,.55));
        px(-4.6,-4,1.4,4,trim);
        disc(-2.1,-1,2.4,hairLit);
        disc(.4,.3,1.9,skin);
        px(-2.7,.2,1,1,'#241a12');px(-.5,.2,1,1,'#241a12');
      }else if(style==='helmet'){
        // Commando: a rounded helmet, chin strap, dark visor band.
        disc(-1.6,-.5,3.3,hair);
        disc(-2.1,-1,2.5,hairLit);
        px(-4.6,-1.4,5.2,1.3,shade(hair,.5));
        px(-4.6,1.3,1.1,2.6,shade(hair,.45));
        px(-4.9,-3.7,3,1.2,trim);
        disc(.4,.3,1.9,skin);
        px(-2.7,.2,1,1,'#241a12');px(-.5,.2,1,1,'#241a12');
      }else if(style==='thirdEye'){
        // Three-Eyed Kid: a headband, and the third eye glowing on the brow.
        disc(-1.6,-.5,3.2,hair);
        px(-4.9,-1.1,5.6,1.4,trim);
        disc(.3,-.6,1.1,'#e8f7ff');
        px(.5,-.4,.7,.7,'#2b4a6b');
        disc(-2.1,-1,2.4,hairLit);
        disc(.4,.5,1.9,skin);
        px(-2.7,.4,1,1,'#241a12');px(-.5,.4,1,1,'#241a12');
      }else if(style==='spikes'){
        // Goku: black spiky hair fanning out behind the head.
        disc(-1.6,-.5,3.2,hair);
        for(const[sx,sy,s]of [[-5.4,-3.2,1.7],[-6,.1,1.7],[-5.4,3,1.7],[-3.3,-4.2,1.6],[-.9,-4.9,1.6],[1.6,-4.1,1.6],[-2.3,4.2,1.5],[.7,4.3,1.5]])
          px(sx,sy,s,s,hair);
        disc(-2.1,-1,2.4,shade(hair,1.5));
        disc(.5,.5,1.9,skin);
        px(-2.6,.4,1,1,'#241a12');px(-.4,.4,1,1,'#241a12');
      }else if(style==='buns'){
        // Nezha: two hair buns tied with red ribbons.
        disc(-1.6,-.5,3.2,hair);
        disc(-4.6,-4.1,1.8,hair);disc(.8,-4.3,1.8,hair);
        px(-5.6,-5.4,2.2,1.4,shirt);px(.2,-5.6,2.2,1.4,shirt);
        disc(-2.1,-1,2.4,shade(hair,1.6));
        disc(.5,.5,1.9,skin);
        px(-2.6,.4,1,1,'#241a12');px(-.4,.4,1,1,'#241a12');
      }
    }
    // Steering wheel on top of the hands, so they read as gripping it.
    ring(6.9,-.5,2.1,shade(driver.wheel,1.45));
    disc(6.9,-.5,.9,shade(driver.wheel,.55));
    px(6.6,-1,.6,1.4,shade(driver.wheel,1.6));
  }

  /* Kart bodywork seen from above, nose at +x. The cockpit is a dark tub so the
     driver sitting in it is always legible, whatever colour the bodywork is. */
  function drawKart(g,driver){
    const{kart,trim,wheel}=driver;
    const[body,bodyDark,bodyLit]=kart;
    const px=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
    const disc=(cx,cy,r,color)=>{g.fillStyle=color;for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r+0.35)px(cx+x-r,cy+y-r,1,1,color);};
    const tyre=(x,y,w,h)=>{
      px(x,y,w,h,shade(wheel,.55));
      px(x+.6,y+.6,w-1.2,h-1.2,wheel);
      px(x+1.2,y+1,w-2.4,1,shade(wheel,1.3));
      for(let i=1;i<h-1;i+=2)px(x+.4,y+i,w-.8,1,shade(wheel,.7));
    };
    // Contact shadow under the whole kart.
    g.globalAlpha=.25;disc(.8,1.6,10.5,'#0b0f14');g.globalAlpha=1;
    // Tyres first, so bodywork overlaps their inner edge.
    tyre(4.4,-10.4,6.2,4.2);tyre(4.4,6.2,6.2,4.2);
    tyre(-10.6,-10.4,7,4.4);tyre(-10.6,6,7,4.4);
    // Main tub: a rounded rectangle, then a tapered nose on the front.
    px(-11.5,-5.4,19,10.8,bodyDark);
    px(-11.5,-4.6,19,9.2,body);
    px(-11.5,-4.6,19,1.8,bodyLit);
    px(-11.5,2.8,19,1.8,bodyDark);
    // Nose cone.
    for(let i=0;i<6;i++){const t=i/5,half=3.1-t*1.5;px(7.5+i,-half,1,half*2,i<2?bodyLit:body);}
    px(13.4,-1.6,1.4,3.2,bodyDark);
    // Side pods along the flanks.
    px(-8,-7.1,9,2,bodyDark);px(-8,5.1,9,2,bodyDark);
    px(-8,-7.1,9,1,body);px(-8,5.1,9,1,body);
    // Rear engine block and exhausts behind the seat.
    px(-13.6,-3,3,6,shade(wheel,1.05));
    px(-13.6,-3,3,1.4,shade(wheel,1.35));
    px(-15,-1.4,1.6,2.8,'#8b8f96');
    // Cockpit tub: dark, so the driver always reads against it.
    px(-6.6,-4.2,9,8.4,shade(wheel,.5));
    px(-5.8,-3.4,8,6.8,shade(wheel,.82));
    px(-5.8,-3.4,8,1.2,shade(wheel,.62));
    // Seat back, behind the driver.
    px(-6.6,-4.2,2.2,8.4,shade(wheel,1.2));
    // Racing number on the nose.
    g.fillStyle=trim;g.font='bold 5px monospace';g.textAlign='center';g.textBaseline='middle';
    g.fillText(driver.number,10.4,0);
  }

  // Bake one kart per character at every heading.
  const cache={};
  function spriteFor(id){
    if(cache[id])return cache[id];
    const driver=Object.assign({},KARTS[id]),frames=[];
    for(let d=0;d<DIRS;d++){
      const{c,g}=makeCanvas(SIZE,SIZE),half=SIZE/2;
      g.save();g.translate(half,half);
      g.rotate(d/DIRS*Math.PI*2);
      drawKart(g,driver);
      drawDriver(g,driver);
      g.restore();
      frames.push(c);
    }
    return cache[id]={frames,size:SIZE,dirs:DIRS};
  }

  /* Items. Each is a small sprite drawn from code, same pixel discipline. */
  const ITEMS={
    banana:{name:'Banana',hint:'Drop it. Anyone who touches it spins.'},
    ink:{name:'Ink Slick',hint:'Drop it. Anyone who touches it cannot steer.'},
    lightning:{name:'Lightning',hint:'Use it. Every rival is slowed and spun.'},
    boost:{name:'Boost',hint:'Use it for a burst of speed.'},
    shell:{name:'Bubble Shield',hint:'Use it. One hit is absorbed.'}
  };
  const itemCache={};
  function itemSprite(name){
    if(itemCache[name])return itemCache[name];
    const{c,g}=makeCanvas(18,18),px=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
    if(name==='banana'){
      for(let i=0;i<9;i++){const t=i/8;px(3+i,t*9+.5|0,2,3,i<3?'#8a6a1f':i<6?'#ffd93b':'#f0c020');}
      px(3,1,2,2,'#6b5216');px(11,10,2,2,'#6b5216');
      px(5,4,6,2,'#fff08a');
    }else if(name==='ink'){
      for(let y=0;y<14;y++)for(let x=0;x<16;x++){
        const d=Math.hypot(x-7.5,y-7)/7;
        if(d<1){const t=1-d;px(x+1,y+2,1,1,t>.55?'#3b3560':t>.3?'#241f3d':'#15122a');}
      }
      px(5,5,2,2,'#6f66a8');px(10,8,1.4,1.4,'#6f66a8');px(7,10,1.2,1.2,'#584f8c');
    }else if(name==='lightning'){
      const bolt=[[9,0],[5,8],[8,8],[4,16],[12,7],[9,7],[13,0]];
      for(const[x,y]of bolt){px(x-1,y,3,2,'#ffe98a');}
      for(const[x,y]of [[8,2],[6,9],[10,8],[5,14]]){px(x,y,2,2,'#fffbe0');}
      for(const[x,y]of [[2,3],[15,4],[1,12],[14,13]]){px(x,y,2,2,'#8fd8ff');}
    }else if(name==='boost'){
      px(3,7,12,5,'#e8534a');px(3,7,12,1.6,'#ff9d6e');
      for(let i=0;i<4;i++)px(4,8+i*1.3,7-i*.8,1,'#fff3d0');
      px(11,6,3,7,'#ffcf45');px(11.6,7,1.4,5,'#fff0b0');
    }else if(name==='shell'){
      for(let y=0;y<16;y++)for(let x=0;x<16;x++){
        const d=Math.hypot(x-7.5,y-7.5)/7.5;
        if(d<1)px(x+1,y+1,1,1,d<.72?'#9fe8ff':d<.88?'#5fc8f0':'#2f9fd0');
      }
      px(5,4,2,2,'#ffffff');px(8,10,1.5,1.5,'#e8fbff');
    }
    itemCache[name]=c;
    return c;
  }
  // The item box the karts drive through: a floating cube with a soft glow.
  let boxSprite=null;
  function itemBox(){
    if(boxSprite)return boxSprite;
    const{c,g}=makeCanvas(20,20),px=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
    for(let y=0;y<20;y++)for(let x=0;x<20;x++){
      const d=Math.hypot(x-9.5,y-9.5)/9.5;
      if(d<1)px(x,y,1,1,d<.55?'#fff3c4':d<.8?'#ffd166':'#e0a53c');
    }
    px(5,6,10,8,'#ff6b6b');px(5,6,10,2,'#ff9d9d');
    px(7,9,2,2,'#ffffff');px(11,9,2,2,'#ffffff');
    px(5,10,3,1,'#ffffff');px(12,10,3,1,'#ffffff');
    px(8,6,4,2,'#4a4a6a');
    boxSprite=c;
    return c;
  }

  const api=Object.freeze({KARTS,SIZE,DIRS,spriteFor,itemSprite,itemBox,ITEMS,shade,mix});
  root.PixelKartAssets=api;
  if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
