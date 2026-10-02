/* Shuttle Club 2.5D court view.
   One pinhole camera over a metric court. The simulation keeps its own three axes
   (x along the 13.4 m length, z across the 5.18 m width, y for height above the
   floor); this file is the only place that turns them into screen pixels, so the
   renderer, the landing markers and the tests all agree on where a point is.
   Only badminton.html loads this. */
(function(root){
  'use strict';
  // The side-view court drew the 1.55 m net 44 px tall. That ratio is the bridge
  // between the old simulation units and the new metric world.
  const NET_HEIGHT=1.55,PX_PER_M=44/NET_HEIGHT;
  const COURT={length:13.4,width:5.18,doubles:6.1,netHeight:NET_HEIGHT};
  // Simulation anchors, identical to PixelBadmintonCore.COURT.
  const NET_X=240,LEFT=52,RIGHT=428,FLOOR=224;
  const SIZE={width:480,height:270};
  // Chosen numerically (see _cam sweeps / test-badminton.cjs) so that every one of
  // the four footwork directions is a clearly different diagonal on screen:
  //   * the playable envelope (x 60..420, z 0..1) plus a full sprite above the feet
  //     stays inside the frame and clear of the 45 px score bar;
  //   * the two ground axes meet at ~67 degrees instead of ~54, so "along" and
  //     "across" can never be confused for one another;
  //   * the near corner draws 1.8x the far corner (62 px vs 34 px tall), which is
  //     what makes the depth read;
  //   * the whole court sits fully inside with ~50 px of stand above the far baseline.
  const CAMERA={distance:17,elevation:27,azimuth:60,fieldOfView:50,targetHeight:.75};
  const SPRITE_METRES=1.45;          // stylised player height in the metric world
  const SHADOW_METRES=.62;           // radius of the contact shadow
  const WALL={x:560,height:3.6,spread:8};   // stand behind the far baseline

  // Real badminton markings, in metres, converted to simulation units (2 dup = net).
  const M_TO_PX=PX_PER_M;
  const SERVICE_LINE=1.98*M_TO_PX;   // short service line: 1.98 m from the net
  const LONG_SERVICE=.76*M_TO_PX;    // doubles long service line: 0.76 m in from the back
  const DOUBLES_Z=.5*(COURT.doubles-COURT.width)/COURT.width;   // 0.46 m outside each sideline

  // --- axis bridge -----------------------------------------------------------
  const metresAlong=x=>(x-NET_X)/(RIGHT-LEFT)*COURT.length;
  const metresAcross=z=>(z-.5)*COURT.width;
  const metresUp=y=>(FLOOR-y)/PX_PER_M;
  const world=(x,z,y)=>[metresAlong(x??NET_X),metresUp(y??FLOOR),metresAcross(z??.5)];

  // --- camera ----------------------------------------------------------------
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const l=Math.hypot(a[0],a[1],a[2]);return [a[0]/l,a[1]/l,a[2]/l];};
  function makeCamera(settings){
    const elevation=settings.elevation*Math.PI/180,azimuth=settings.azimuth*Math.PI/180;
    const flat=settings.distance*Math.cos(elevation),rise=settings.distance*Math.sin(elevation);
    const position=[-flat*Math.cos(azimuth),rise,flat*Math.sin(azimuth)],target=[0,settings.targetHeight,0];
    const forward=unit(sub(target,position)),right=unit(cross(forward,[0,1,0])),up=cross(right,forward);
    return {position,target,forward,right,up,focal:(SIZE.width/2)/Math.tan(settings.fieldOfView*Math.PI/360)};
  }
  const cam=makeCamera(CAMERA);
  // projects a world point. depth runs along the view axis, and scale is how many
  // screen pixels one metre covers there, which is what sizes the sprites.
  function project(p){
    const delta=sub(p,cam.position),depth=dot(delta,cam.forward);
    if(depth<=.05)return {x:SIZE.width/2,y:SIZE.height/2,depth:0,scale:0,behind:true};
    const scale=cam.focal/depth;
    return {x:SIZE.width/2+cam.focal*dot(delta,cam.right)/depth,y:SIZE.height/2-cam.focal*dot(delta,cam.up)/depth,depth,scale,behind:false};
  }
  const projectCourt=(x,z,y)=>project(world(x,z,y));

  // A local affine copy of the ground plane, so a circle drawn on the court comes
  // out as the ellipse the tilted floor really makes. Hand the six numbers straight
  // to ctx.transform, then draw in court units.
  function groundBasis(x,z){
    const o=projectCourt(x,z,FLOOR),a=projectCourt(x+1,z,FLOOR),b=projectCourt(x,z+1,FLOOR);
    return [a.x-o.x,a.y-o.y,b.x-o.x,b.y-o.y,o.x,o.y];
  }
  // Sprite box: contact point, height in pixels and the projection scale.
  function spriteOf(x,z,y){
    const foot=projectCourt(x,z,y??FLOOR);
    return {x:foot.x,y:foot.y,height:foot.scale*SPRITE_METRES,scale:foot.scale,depth:foot.depth};
  }
  const shadowWidth=(x,z)=>projectCourt(x,z,FLOOR).scale*SHADOW_METRES;

  // --- court markings, in simulation units ------------------------------------
  // The floor is the full doubles rectangle (zFar..zNear). z 0 and z 1 are the two
  // *singles* sidelines drawn inside it, so the 0.46 m doubles corridors read as
  // part of the same court. Baseline / service / long-service lines run the whole
  // width, exactly as they do on a real court.
  const zFar=-DOUBLES_Z,zNear=1+DOUBLES_Z;
  const LINES=[
    [LEFT,0,RIGHT,0,'sideline'],[LEFT,1,RIGHT,1,'sideline'],
    [LEFT,zFar,LEFT,zNear,'baseline'],[RIGHT,zFar,RIGHT,zNear,'baseline'],
    [LEFT,zFar,RIGHT,zFar,'outer'],[LEFT,zNear,RIGHT,zNear,'outer'],
    [NET_X,zFar,NET_X,zNear,'netline'],
    [LEFT+SERVICE_LINE,zFar,LEFT+SERVICE_LINE,zNear,'service'],[RIGHT-SERVICE_LINE,zFar,RIGHT-SERVICE_LINE,zNear,'service'],
    [LEFT+LONG_SERVICE,zFar,LEFT+LONG_SERVICE,zNear,'outer'],[RIGHT-LONG_SERVICE,zFar,RIGHT-LONG_SERVICE,zNear,'outer'],
    [LEFT,.5,LEFT+SERVICE_LINE,.5,'service'],[RIGHT-SERVICE_LINE,.5,RIGHT,.5,'service']
  ];
  // The mat the court sits on, and the stand behind the far baseline.
  const MAT={x0:LEFT-4*M_TO_PX,x1:RIGHT+3.2*M_TO_PX,z0:zFar-1.2,z1:zNear+1.6};
  const wallProject=h=>projectCourt(WALL.x,h,FLOOR);
  // A quad on the wall plane, given z0,z1 (width) and h0,h1 (height in metres).
  function wallQuad(z0,z1,h0,h1){
    const a=wallProject(h0),c=wallProject(h1);
    return [
      projectCourt(WALL.x,z0,FLOOR-h0*PX_PER_M),projectCourt(WALL.x,z1,FLOOR-h0*PX_PER_M),
      projectCourt(WALL.x,z1,FLOOR-h1*PX_PER_M),projectCourt(WALL.x,z0,FLOOR-h1*PX_PER_M)
    ];
  }
  function wallPoint(z,h){return projectCourt(WALL.x,z,FLOOR-h*PX_PER_M);}

  var api=Object.freeze({
    SIZE,COURT,CAMERA,SPRITE_METRES,SHADOW_METRES,WALL,MAT,LINES,
    NET_X,LEFT,RIGHT,FLOOR,PX_PER_M,M_TO_PX,SERVICE_LINE,LONG_SERVICE,DOUBLES_Z,zFar,zNear,
    metresAlong,metresAcross,metresUp,world,project,projectCourt,groundBasis,spriteOf,shadowWidth,
    wallQuad,wallPoint,makeCamera
  });
  root.PixelBadmintonView=api;
  if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
