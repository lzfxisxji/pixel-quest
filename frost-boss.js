/* Giant Lizard boss (classic FC Snow Bros world-1 style): hops along the arena floor,
   periodically spawns small monsters that players must freeze and kick into it.
   Only kicked rolling snowballs deal damage. Multiple phases ramp aggression. */
(function(r){
function create(kind){
  if(!kind) return null;
  if(kind==='lizard') return {
    kind:'lizard',
    x: 272, y: 310, w: 96, h: 60,
    vx: 70, vy: 0, ground: false,
    hp: 8, max: 8,
    timer: 2.6, spawn: 3.4, jump: 2.1,
    phase: 0, inv: 0, alive: true,
    anim: 0, flash: 0, dead: 0, face: -1
  };
  // Legacy fallback (unused by current stages).
  return { kind, x:480, y:322, w:56, h:48, hp:kind==='mini'?3:6, max:kind==='mini'?3:6, timer:2, summon:4, phase:0, inv:0, alive:true };
}
function update(b, dt, m){
  if(!b?.alive){ if(b) b.dead+=dt; return; }
  b.anim += dt;
  b.inv = Math.max(0, b.inv - dt);
  b.flash = Math.max(0, b.flash - dt);
  b.phase = b.hp <= b.max/2 ? 1 : 0;
  const groundY = 370;
  if(b.kind==='lizard'){
    b.x += b.vx * dt;
    if(b.x <= 12){ b.x = 12; b.vx = Math.abs(b.vx); b.face = 1; }
    if(b.x + b.w >= 628){ b.x = 628 - b.w; b.vx = -Math.abs(b.vx); b.face = -1; }
    b.vy = Math.min(530, b.vy + 780 * dt);
    const oldBottom = b.y + b.h;
    b.y += b.vy * dt;
    b.ground = false;
    if(b.vy >= 0 && oldBottom <= groundY + 2 && b.y + b.h >= groundY){
      b.y = groundY - b.h; b.vy = 0; b.ground = true;
    }
    b.jump -= dt;
    if(b.ground && b.jump <= 0){
      b.vy = -340; b.ground = false;
      b.jump = b.phase >= 1 ? 1.5 : 2.3;
    }
    b.spawn -= dt;
    if(b.spawn <= 0){
      const angry = b.phase >= 1;
      const n = angry ? 2 : 1;
      for(let i=0;i<n;i++){
        if(m.enemies.filter(e=>e.alive).length + m.balls.length < 6){
          const bx = Math.max(20, Math.min(580, b.x + (i ? 34 : -34)));
          m.enemies.push(m.ai.create('slime', bx, 318));
        }
      }
      b.spawn = angry ? 3.0 : 4.4;
    }
    return;
  }
  // Legacy behaviour
  b.inv = Math.max(0, b.inv - dt);
  b.timer -= dt; b.summon -= dt;
  b.x = 440 + Math.sin(m.time * .55) * 65;
  if(b.timer <= 0){
    b.phase++;
    const angry = b.hp <= b.max/2;
    if(b.phase % 2 === 0){ for(const dir of [-1,1]) m.enemyShots.push({x:b.x+20,y:345,w:10,h:10,vx:dir*(angry?130:95),vy:0,life:5}); }
    else { for(let i=0;i<(angry?4:3);i++) m.enemyShots.push({x:90+i*140,y:60,w:9,h:9,vx:0,vy:105,life:4}); }
    m.events.push({type:'bossAttack'});
    b.timer = angry ? 1.8 : 2.8;
  }
  if(b.summon <= 0){
    if(m.enemies.filter(e=>e.alive).length + m.balls.length < 5) m.enemies.push(m.ai.create('slime',230,350,Math.floor(m.time)));
    b.summon = b.hp <= b.max/2 ? 4 : 6;
  }
}
function hit(b){
  if(!b?.alive || b.inv > 0) return false;
  b.hp--; b.inv = .5; b.flash = .2;
  if(b.hp <= 0) b.alive = false;
  return true;
}
const api = { create, update, hit };
r.FrostBoss = api;
if(typeof module === 'object') module.exports = api;
})(globalThis);
