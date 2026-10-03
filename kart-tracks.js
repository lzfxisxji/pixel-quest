/* Pixel Kart: circuit geometry. Three hand-laid closed circuits, resampled onto a
   uniform arc length so every consumer (physics, AI, renderer, minimap) can step
   the track by index and know exactly where it is.

   One query, `locate(x, y)`, answers everything the rest of the game asks about a
   world point: which sample it belongs to, how far across the road it is, what is
   under the tyres, and how far the kart has come round the lap. Deriving that once,
   here, is what keeps a drifting kart from ending up on the grass while the AI
   thinks it is still on the racing line. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  // Surface bands, measured out from the centre line. They are the same on every
  // circuit so the AI only has to learn one set of rules.
  const RUMBLE=5;          // painted kerb at the edge of the tarmac
  const GRASS=22;          // slow grass before the barrier
  const CELL=64;           // spatial hash cell, in logical pixels
  const SPACING=4;         // arc length between samples
  const LATERAL=520;       // grip budget, px/s^2, shared by every kart
  /* The karts' top speed. It lives here as well as in kart-core because the
     corner-speed curve is capped by it, and a corner limit above the speed a
     kart can actually reach carries no information. The two are asserted to
     agree in test-kart.cjs, so they cannot drift apart unnoticed. */
  const TOP_SPEED=330;
  const BRAKE=520;         // deceleration the AI plans its braking around
  const BRAKE_DISTANCE=190;// how far ahead it starts slowing for a corner
  const MIN_INNER=18;       // how much clear tarmac must sit inside the tightest corner
  const MIN_SEPARATION=170; // closest two separate parts of a circuit may come

  /* Centripetal Catmull-Rom (alpha = 0.5) through the control points, then
     walked at a fixed arc length. Centripetal parameterisation is the variant
     that provably avoids the cusps and self-intersections uniform Catmull-Rom
     produces when control points bunch up - which is exactly what a circuit
     laid out with a hairpin next to a straight does. */
  function resample(nodes,widths,spacing){
    const n=nodes.length,dense=[];
    const widthAt=i=>widths[((i%n)+n)%n%widths.length];
    const dist=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let i=0;i<n;i++){
      const p0=nodes[(i-1+n)%n],p1=nodes[i],p2=nodes[(i+1)%n],p3=nodes[(i+2)%n],
            w0=widthAt(i-1),w1=widthAt(i),w2=widthAt(i+1),w3=widthAt(i+2);
      // Centripetal knot spacing: t advances by sqrt(distance), which is the
      // parameterisation that cannot produce a cusp or a loop, no matter how
      // unevenly the control points are spaced.
      const t0=0,
            t1=t0+Math.max(1e-4,Math.sqrt(dist(p0,p1))),
            t2=t1+Math.max(1e-4,Math.sqrt(dist(p1,p2))),
            t3=t2+Math.max(1e-4,Math.sqrt(dist(p2,p3)));
      const STEPS=48;
      for(let s=0;s<STEPS;s++){
        const t=t1+(t2-t1)*(s/STEPS);
        // de Casteljau on the non-uniform knots, three levels of bisection.
        const a1=blend(p0,p1,w0,w1,(t-t0)/(t1-t0));
        const a2=blend(p1,p2,w1,w2,(t-t1)/(t2-t1));
        const a3=blend(p2,p3,w2,w3,(t-t2)/(t3-t2));
        const b1=blend(a1,a2,a1[2],a2[2],(t-t0)/(t2-t0));
        const b2=blend(a2,a3,a2[2],a3[2],(t-t1)/(t3-t1));
        dense.push(blend(b1,b2,b1[2],b2[2],(t-t1)/(t2-t1)));
      }
    }
    /* Walk the dense polyline at a fixed arc length.

       The lap's true perimeter is measured first and the sample count is chosen
       to suit it, then every stride is exactly perimeter/count. Emitting on a
       fixed `spacing` instead would leave a remainder that has to go somewhere:
       dumped at the seam it makes one stride measurably wider than all the
       others - right where the start line and the lap counter live - and split
       up it makes a stride shorter than all the others. Choosing the count up
       front is what makes the spacing uniform all the way round. */
    let perimeter=0;
    for(let i=1;i<=dense.length;i++){
      const a=dense[i-1],b=dense[i%dense.length];
      perimeter+=Math.hypot(b[0]-a[0],b[1]-a[1]);
    }
    const count=Math.max(32,Math.round(perimeter/spacing));
    const stride=perimeter/count;
    const out=[];
    let previous=dense[0],sinceLast=0;
    for(let i=1;i<=dense.length;i++){
      const current=dense[i%dense.length];
      const segment=Math.hypot(current[0]-previous[0],current[1]-previous[1]);
      if(segment>1e-9){
        const ux=(current[0]-previous[0])/segment,uy=(current[1]-previous[1])/segment;
        let travelled=0;
        while(sinceLast+(segment-travelled)>=stride){
          travelled+=stride-sinceLast;
          out.push({x:previous[0]+ux*travelled,y:previous[1]+uy*travelled,
            w:previous[2]+(current[2]-previous[2])*(travelled/segment)});
          sinceLast=0;
          if(out.length===count)break;
        }
        sinceLast+=segment-travelled;
      }
      previous=current;
      if(out.length===count)break;
    }
    // The walk is exhaustive, so this only fires on a degenerate circuit.
    while(out.length<count&&out.length>0){
      const last=out[out.length-1],first=out[0];
      out.push({x:last.x+(first.x-last.x)/2,y:last.y+(first.y-last.y)/2,w:(last.w+first.w)/2});
    }
    return out;
  }
  const blend=(a,b,wa,wb,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,wa+(wb-wa)*t];

  // Tightest corner radius and closest approach between separate stretches of
  // the lap. Both are properties a driver would feel, so both get measured.
  function shapeQuality(points){
    const n=points.length;
    let tightest=Infinity;
    for(let i=0;i<n;i++){
      const a=points[(i-1+n)%n],b=points[i],c=points[(i+1)%n];
      const la=Math.hypot(b.x-a.x,b.y-a.y),lb=Math.hypot(c.x-b.x,c.y-b.y),lc=Math.hypot(c.x-a.x,c.y-a.y);
      const denom=la*lb*lc;
      const k=denom>1e-6?Math.abs(2*((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))/denom):0;
      if(k>1e-7)tightest=Math.min(tightest,1/k);
    }
    let separation=Infinity;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      if(Math.min(j-i,n-(j-i))*SPACING<220)continue;   // neighbours along the lap
      const d=Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y);
      if(d<separation)separation=d;
    }
    return {tightest,separation};
  }

  function build(def){
    const nodes=resample(def.nodes,def.widths,SPACING),count=nodes.length;
    if(count<64)throw new Error('circuit '+def.id+' is too short');
    // Measured, not assumed: a corner tighter than the road is wide would fold the
    // inside edge of the tarmac over itself, and two stretches of track closer
    // together than this could not be told apart on screen. Both are refused here
    // rather than left for a player to discover.
    const quality=shapeQuality(nodes);
    if(quality.tightest<def.half+MIN_INNER)
      throw new Error('circuit '+def.id+' has an undrivable corner ('+quality.tightest.toFixed(0)+'px radius for a '+def.half+'px half width)');
    if(quality.separation<MIN_SEPARATION)
      throw new Error('circuit '+def.id+' passes too close to itself ('+quality.separation.toFixed(0)+'px apart)');
    // Tangent, normal, signed curvature and cumulative arc length per sample.
    const samples=new Array(count);
    /* Arc length per sample, measured from the sample *before* it and rebased so
       sample 0 sits at zero. Accumulating from index -1 would include the wrap
       stride, and then zeroing sample 0 would leave every other sample one full
       stride too far along - which shows up as the lap counting a phantom extra
       stride the moment a kart crosses the line. */
    const length=new Array(count);
    let run=0;
    for(let i=0;i<count;i++){
      const a=nodes[(i-1+count)%count],b=nodes[(i+1)%count],p=nodes[i];
      const span=Math.hypot(b.x-a.x,b.y-a.y)||1;
      const tx=(b.x-a.x)/span,ty=(b.y-a.y)/span;
      if(i>0)run+=Math.hypot(p.x-nodes[i-1].x,p.y-nodes[i-1].y);
      length[i]=run;
      samples[i]={x:p.x,y:p.y,tx,ty,nx:-ty,ny:tx,half:p.w,i,s:run,k:0,line:0,vmax:0,curve:0};
    }
    const lapLength=run+Math.hypot(nodes[0].x-nodes[count-1].x,nodes[0].y-nodes[count-1].y);
    for(let i=0;i<count;i++){
      const a=samples[(i-1+count)%count],b=samples[i],c=samples[(i+1)%count];
      // Menger curvature: how much the tangent turns per unit of length.
      const area=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
      const la=Math.hypot(b.x-a.x,b.y-a.y),lb=Math.hypot(c.x-b.x,c.y-b.y),lc=Math.hypot(c.x-a.x,c.y-a.y);
      const denom=la*lb*lc;
      samples[i].k=denom>1e-6?(2*area)/denom:0;
    }
    /* Smooth the curvature before it becomes a speed limit.

       Three points span 12px of arc, so the raw Menger value is noisy: it swings
       between 135px and 1400px radius over a stretch the road barely changes,
       and a speed limit built from it told the AI a 135px hairpin was a 265px/s
       sweeper. The racing line is already blurred ten times over, so the limit
       has to be derived from a comparably smooth curvature or the two disagree
       about where the corners are. Seven passes of a nine-sample box is a 76px
       window, which is the same order as the road is wide. */
    {
      const raw=samples.map(s=>s.k);
      let k=raw.slice();
      for(let pass=0;pass<7;pass++){
        const next=new Array(count);
        for(let i=0;i<count;i++){
          let sum=0;
          for(let d=-4;d<=4;d++)sum+=k[(i+d+count)%count];
          next[i]=sum/9;
        }
        k=next;
      }
      for(let i=0;i<count;i++)samples[i].k=k[i];
    }
    // ---- racing line -------------------------------------------------------
    // Aim for the inside of each corner, then blur the offsets along the lap so
    // the line flows out-in-out instead of snapping apex to apex.
    const maxLine=(i)=>Math.max(0,samples[i].half-13-2);
    const raw=new Array(count);
    for(let i=0;i<count;i++)raw[i]=-Math.sign(samples[i].k)*Math.min(Math.abs(samples[i].k)*2600,maxLine(i));
    let line=raw.slice();
    for(let pass=0;pass<10;pass++){
      const next=new Array(count);
      for(let i=0;i<count;i++){
        let sum=0;
        for(let d=-9;d<=9;d++)sum+=line[(i+d+count)%count];
        next[i]=sum/19;
      }
      line=next;
    }
    for(let i=0;i<count;i++){
      samples[i].line=clamp(line[i],-maxLine(i),maxLine(i));
      /* Speed the corners allow: sqrt(lateral grip / curvature).

         The ceiling is the karts' own top speed, and that is the whole point of
         the number being *derived* rather than clamped by eye. Clamping the
         corner speed at 320 - below the 330px/s the karts can actually reach -
         reported "flat out" for every corner gentler than a 320px radius, and
         38% of meadow, 56% of harbour and 48% of neon are gentler than that. The
         AI was told to take half of every circuit at full speed and duly ran
         wide through all of it. A limit above the top speed would be equally
         meaningless in the other direction, so it is capped at the top speed
         and the shape of the curve below it is what carries the information. */
      const k=Math.abs(samples[i].k);
      samples[i].curve=k>1e-5?clamp(Math.sqrt(LATERAL/k),70,TOP_SPEED):TOP_SPEED;
    }
    // Brake early enough for what is coming. The constraint propagates backwards
    // around the lap, so a fast section is capped by the slowest corner after it.
    // Each pass carries it one braking-distance further back, hence the repeats.
    const LOOK=Math.round(BRAKE_DISTANCE/SPACING);
    for(let i=0;i<count;i++)samples[i].vmax=samples[i].curve;
    for(let pass=0;pass*LOOK<count;pass++)for(let i=count-1;i>=0;i--){
      const here=samples[i],ahead=samples[(i+LOOK)%count];
      const allowed=Math.sqrt(ahead.vmax*ahead.vmax+2*BRAKE*BRAKE_DISTANCE);
      if(allowed<here.vmax)here.vmax=allowed;
    }
    const track={id:def.id,name:def.name,note:def.note,theme:def.theme,length:lapLength,
      samples,count,laps:def.laps||2,
      minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,
      bounds:{x0:0,y0:0,x1:0,y1:0}};
    let reach=0;
    for(let i=0;i<count;i++){
      const p=samples[i],far=p.half+RUMBLE+GRASS;
      reach=Math.max(reach,far);
      track.minX=Math.min(track.minX,p.x-far);track.maxX=Math.max(track.maxX,p.x+far);
      track.minY=Math.min(track.minY,p.y-far);track.maxY=Math.max(track.maxY,p.y+far);
    }
    // Pad for the barriers, the decoration and the camera looking outwards.
    const pad=54;
    track.bounds={x0:track.minX-pad,y0:track.minY-pad,x1:track.maxX+pad,y1:track.maxY+pad};
    track.reach=reach+2;
    // ---- spatial hash ------------------------------------------------------
    // Every sample is filed into each cell its surface band can reach, so a lookup
    // only ever has to read one bucket instead of sweeping the whole lap.
    const grid=new Map(),key=(cx,cy)=>cx+','+cy;
    for(let i=0;i<count;i++){
      const p=samples[i],far=p.half+RUMBLE+GRASS+2;
      for(let cx=Math.floor((p.x-far)/CELL);cx<=Math.floor((p.x+far)/CELL);cx++)
        for(let cy=Math.floor((p.y-far)/CELL);cy<=Math.floor((p.y+far)/CELL);cy++){
          const k=key(cx,cy);
          let bucket=grid.get(k);
          if(!bucket)grid.set(k,bucket=[]);
          bucket.push(i);
        }
    }
    track.grid=grid;
    /* The grid start: two columns of karts staggered back from the line.

       The line is not at an arbitrary sample: a start/finish line belongs on the
       straightest stretch available, and the grid sits up to 90 samples (360px)
       *behind* it, so the run-in behind the line and the run-out after it both
       have to be gentle. The score is the total heading change over that whole
       window, which is the honest measure of how much a driver has to steer -
       `vmax` cannot be used for it, because `vmax` saturates at TOP and reads
       320 through a long 470px-radius arc that still sweeps a kart off the road
       in about a second. Passing `def.start` pins the line explicitly. */
    const AHEAD_RUNOUT=150,BACK_RUNOUT=90;
    const turnBetween=(a,b)=>{let d=Math.atan2(b.ty,b.tx)-Math.atan2(a.ty,a.tx);
      while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return Math.abs(d);};
    let startLine=0,bestScore=Infinity;
    for(let i=0;i<count;i++){
      let score=0;
      for(let d=-BACK_RUNOUT+1;d<=AHEAD_RUNOUT;d++)
        score+=turnBetween(samples[(i+d-1+count*2)%count],samples[(i+d+count*2)%count]);
      if(score<bestScore){bestScore=score;startLine=i;}
    }
    if(def.start!==undefined)startLine=Math.round((def.start%lapLength)/SPACING)%count;
    track.start=startLine*SPACING;
    track.startIndex=startLine;
    const startSample=samples[startLine];
    track.startAngle=Math.atan2(startSample.ty,startSample.tx);
    track.slots=[];
    for(let i=0;i<5;i++){
      const back=Math.floor(i/2)*34+22,across=(i%2?1:-1)*17;
      const sample=samples[(startLine-back+count*2)%count];
      track.slots.push({x:sample.x+sample.nx*across,y:sample.y+sample.ny*across,angle:Math.atan2(sample.ty,sample.tx)});
    }
    return track;
  }

  /* Where a world point sits on the circuit. Returns the nearest sample index,
     the signed distance across the road (+ is the left-hand normal), the surface
     under it, and the unwrapped distance travelled, which is what makes a lap. */
  function locate(track,x,y,lastIndex,lastS){
    const bucket=track.grid.get(Math.floor(x/CELL)+','+Math.floor(y/CELL));
    let best=-1,bestD=Infinity;
    if(bucket)for(let b=0;b<bucket.length;b++){
      const i=bucket[b],p=track.samples[i],d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);
      if(d<bestD){bestD=d;best=i;}
    }
    if(best<0){   // far outside the filed area: fall back to a coarse sweep
      for(let i=0;i<track.count;i+=4){const p=track.samples[i],d=(p.x-x)*(p.x-x)+(p.y-y)*(p.y-y);if(d<bestD){bestD=d;best=i;}}
    }
    const p=track.samples[best];
    const offset=(x-p.x)*p.nx+(y-p.y)*p.ny;
    const a=Math.abs(offset);
    const surface=a<=p.half?'road':a<=p.half+RUMBLE?'rumble':'grass';
    let s=p.s;
    if(lastIndex!==undefined&&lastS!==undefined){
      /* Unwrap onto the same lap as the previous frame, so `s` keeps counting
         forwards across the start line. The correction is a true modulo rather
         than a single +/-L: a kart that was teleported (hit by a hazard, shoved
         by a barrier) or momentarily filed to the wrong cell can be more than
         one lap away from its own history, and a one-shot correction would then
         leave `s` a whole lap short - which silently corrupts the lap count. */
      const L=track.length;
      let d=(p.s-lastS)%L;
      if(d<-L/2)d+=L;else if(d>L/2)d-=L;
      s=lastS+d;
    }
    return {index:best,s,offset,surface,sample:p};
  }
  // Point on the racing line `metres` further on, used by the AI to aim.
  function ahead(track,index,metres){const step=Math.round(metres/SPACING);return track.samples[(index+step+track.count*4)%track.count];}
  function pointAt(track,index,offset){const p=track.samples[((index%track.count)+track.count)%track.count];return {x:p.x+p.nx*offset,y:p.y+p.ny*offset};}
  // Slowest limit anywhere in the next `metres`, so the AI brakes early.
  function limitAhead(track,index,metres){
    const steps=Math.max(1,Math.round(metres/SPACING));
    let v=Infinity;
    for(let d=0;d<=steps;d++){const s=track.samples[(index+d)%track.count];if(s.vmax<v)v=s.vmax;}
    return v;
  }
  /* A circuit is described the way a kart circuit actually reads: a base loop
     whose radius is modulated over the angle, plus a skew that bunches the nodes
     into some corners and stretches others into straights.

     Because the nodes are emitted in strictly increasing angle about a centre,
     the polygon is star shaped and therefore cannot cross itself. The centripetal
     spline then resamples it at a uniform arc length, and the build step measures
     the result and refuses anything undrivable - so a corner tighter than the road
     is wide, or two stretches of track too close to tell apart, can never reach
     the game. These constants were chosen against exactly those measurements:
     each circuit has its own length, corner tightness and speed range. */
  function nodesOf(def){
    const nodes=[],widths=[],count=def.nodes;
    for(let i=0;i<count;i++){
      const t=i/count*Math.PI*2;
      // The skew stays monotone in t, so node order - and therefore simplicity - holds.
      const a=t+def.skew[0]*Math.sin(t+def.skew[1])+.5*def.skew[0]*Math.sin(2*t+def.skew[1]*1.7);
      const r=def.radius*(1+def.wave[0]*Math.cos(2*a+def.phase[0])
                              +def.wave[1]*Math.cos(3*a+def.phase[1])
                              +def.wave[2]*Math.cos(4*a+def.phase[2]));
      nodes.push([def.cx+Math.cos(a)*r,def.cy+Math.sin(a)*r*def.squash]);
      widths.push(def.half);
    }
    return {nodes,widths};
  }
  const CIRCUITS=Object.freeze([
    {id:'meadow',name:'Sunrise Meadow',note:'Long and open, with one big back straight. Room to drift.',
     laps:2,nodes:16,radius:420,half:40,cx:600,cy:470,squash:.86,skew:[.34,.6],
     wave:[.05,.10,.07],phase:[0,1.2,.4],
     theme:{asphalt:'#4b4a58',asphaltDark:'#3f3e4c',kerb:'#eae5d2',kerbRed:'#d4553f',grass:'#4f8b47',grassDark:'#40753a',sand:'#c3a979',sky:'#7ec8e8',crowd:'#f0e6c8'}},
    {id:'harbour',name:'Old Harbour',note:'Tighter corners and a narrow causeway. Brake earlier.',
     laps:2,nodes:20,radius:360,half:33,cx:600,cy:470,squash:.92,skew:[.30,2.1],
     wave:[.13,.12,.09],phase:[2.2,.4,1.1],
     theme:{asphalt:'#3f4550',asphaltDark:'#353a45',kerb:'#eae5d2',kerbRed:'#3f7fc4',grass:'#6f7c4b',grassDark:'#5b673d',sand:'#b1a175',sky:'#8fb6d8',crowd:'#e6dcc0'}},
    {id:'neon',name:'Neon Ridge',note:'The fastest lap of the three, with a technical middle section.',
     laps:2,nodes:24,radius:400,half:36,cx:600,cy:470,squash:.95,skew:[.38,4.0],
     wave:[.10,.10,.08],phase:[1.0,2.6,.3],
     theme:{asphalt:'#2f3340',asphaltDark:'#282b36',kerb:'#e9e2f5',kerbRed:'#c455a8',grass:'#3c5b73',grassDark:'#304b5f',sand:'#7d7591',sky:'#4a3f70',crowd:'#d8cff0'}}
  ]);
  const TRACKS=Object.freeze(CIRCUITS.map(def=>build({...def,...nodesOf(def)})));
  const BY_ID=Object.freeze(Object.fromEntries(TRACKS.map(t=>[t.id,t])));
  const api=Object.freeze({TRACKS,BY_ID,locate,ahead,pointAt,limitAhead,build,SPACING,CELL,RUMBLE,GRASS});
  root.PixelKartTracks=api;
  if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
