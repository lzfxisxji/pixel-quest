/* Combat presentation only: no collision, damage or input state. */
(function(root){'use strict';
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function label(c,s,x,y,size,color,align='center'){c.font='bold '+size+'px monospace';c.textAlign=align;c.fillStyle=color;c.fillText(s,Math.round(x),Math.round(y));}
function disc(c,x,y,r,color){for(let yy=-r;yy<=r;yy+=3){const w=Math.sqrt(Math.max(0,r*r-yy*yy));box(c,x-w,y+yy,w*2,3,color);}}
function ring(c,x,y,r,color,width=3){for(let i=0;i<28;i++){const a=i/28*Math.PI*2;box(c,x+Math.cos(a)*r-width/2,y+Math.sin(a)*r-width/2,width,width,color);}}
function segment(c,x,y,tx,ty,width,color){const distance=Math.hypot(tx-x,ty-y),steps=Math.max(1,Math.ceil(distance/3));for(let i=0;i<=steps;i++){const t=i/steps;box(c,x+(tx-x)*t-width/2,y+(ty-y)*t-width/2,width,width,color);}}
function star(c,x,y,r,color){for(let i=0;i<8;i++){const a=i*Math.PI/4;segment(c,x,y,x+Math.cos(a)*r,y+Math.sin(a)*r,i%2?3:5,color);}disc(c,x,y,r*.28,'#fff9cf');}
function ribbon(c,x,y,d,length,t){for(let i=0;i<length;i+=6){const yy=y+Math.sin(i*.08-t*17)*12;box(c,x+d*i,yy,10,9,'#e74068');box(c,x+d*i,yy,9,3,'#ffb2c6');}}
function fist(c,x,y,r){box(c,x-r,y-r,r*2,r*2,'#172f49');box(c,x-r+3,y-r+3,r*2-6,r*2-6,'#79cfea');box(c,x-r+5,y-r+4,r*2-10,4,'#e2f8ff');for(let i=0;i<3;i++)box(c,x-r+6+i*6,y-r+10,2,r-1,'#345b82');}
function attack(c,p,t,height,color){const a=p.action;if(!a||['light','heavy'].includes(a.kind))return;const d=a.direction||p.facing,x=p.x,y=p.y-46,effect=a.move?.effect??a.effect,r=a.kind==='ultimate'?20:12,q=Math.min(1,a.t/a.start),reach=(a.range||a.move?.range||60)*Math.sin(q*Math.PI/2);
 if(p.id==='soldier'){box(c,x+d*21,y-8,36,12,'#263b49');box(c,x+d*30,y-5,32,4,'#b8ced5');box(c,x+d*24,y+4,10,13,'#273c49');if(q>.7)star(c,x+d*58,y,10,'#ffd97a');}
 else if(p.id==='nezha'){if(effect==='sash')ribbon(c,x+d*15,y,d,reach,t);else{ring(c,x+d*32,y,14,'#ffe491',4);ring(c,x+d*32,y,18,'#bf823e',2);}}
 else if(p.id==='happy'){box(c,x-23,p.y-64,46,38,'#a32835');box(c,x-15,p.y-62,30,10,'#9fe8ff');disc(c,x-23,p.y-55,11,'#ffda5b');disc(c,x+23,p.y-55,11,'#ffda5b');const hx=x+d*(30+reach*.65);if(effect==='mecha')for(let i=0;i<6;i++)box(c,hx-d*(25+i*7),y-9+Math.sin(t*30+i)*6,8,18-i*2,i%2?'#ff9e37':'#ffe88a');segment(c,x+d*24,y,hx,y,12,'#426c86');segment(c,x+d*24,y-3,hx,y-3,3,'#b5e5f4');fist(c,hx,y,16);}
 else if(p.id==='explorer'){if(effect==='star'){for(let i=0;i<4;i++)star(c,x-d*i*20,p.y-47+Math.sin(t*14+i)*16,9,'#ffe379');star(c,x+d*reach*.6,y,16,'#fff58c');}else{disc(c,x+d*30,y,r,'#fca146');for(let i=0;i<5;i++)box(c,x+d*30-8+i*4,y-18-Math.sin(t*20+i)*6,4,12,'#ffde79');}}
 else if(p.id==='mystic'){const ex=x+d*6,ey=p.y-height+22;disc(c,ex,ey,6,'#ffe8bc');ring(c,ex,ey,10+q*5,'#cfa4ff',2);for(let i=0;i<4;i++)segment(c,ex+d*14,ey,ex+d*(25+i*8),ey+(i-1.5)*5,2,'#dec6ff');}
 else if(p.id==='dora'){box(c,x+d*23,y-11,24,22,'#7c94a7');box(c,x+d*37,y-14,10,28,'#dcebed');ring(c,x+d*47,y,12,'#f0ffff',3);}
 else if(p.id==='goku'){const cx=x+d*(16+q*15);disc(c,cx,y,r*q+3,'#52bdff');ring(c,cx,y,r+9,'#b4f2ff',2);if(a.kind==='ultimate'){for(let i=0;i<9;i++)box(c,x-35+i*8,p.y-12-((t*100+i*13)%88),4,20,'#ffdf6c88');for(let i=0;i<4;i++)segment(c,x-18+i*10,p.y-height+15,x-24+i*13,p.y-height-8,4,'#ffe678');}}
 else if(p.id==='astro'){const hx=x+d*(28+(a.range?reach*.55:0));ring(c,hx,y,r+6,'#6bdcff',3);disc(c,hx,y,r*.6,'#e8ffff');if(effect==='atomicFist')fist(c,hx,y,12);else for(let i=0;i<3;i++)box(c,hx-d*(12+i*6),y-5,4,10,'#72dcff');}
 else if(p.id==='wuwa'){for(let i=0;i<7;i++){const xx=x+d*(15+i*7),yy=p.y-65+Math.sin(t*18+i*.6)*5;disc(c,xx,yy,3+i*.55,i%2?'#7de9ff':'#e0ffff');}if(effect==='tidal')ring(c,x+d*reach*.6,y,22,'#77dfff',4);}
}
function projectile(c,b,t,color){const d=Math.sign(b.vx),r=b.radius,e=b.effect;
 if(e==='bullet'){box(c,b.x-10,b.y-3,20,6,'#ffe09a');box(c,b.x-d*24,b.y-1,16,2,'#efb267');return;}
 if(e==='lightning'){for(let i=0;i<12;i++)box(c,b.x-d*50+i*d*5,b.y+Math.sin(i*1.8+t*45)*9,7,4,i%2?'#62caff':'#edffff');return;}
 if(e==='ring'){ring(c,b.x,b.y,16,'#cf8536',6);ring(c,b.x,b.y,13,'#ffe38c',3);return;}
 if(e==='arrow'){segment(c,b.x-d*27,b.y,b.x+d*17,b.y,4,'#ffb34b');for(let i=0;i<5;i++)box(c,b.x+d*(17+i*3),b.y-8+i*2,3,16-i*4,'#ffe18e');return;}
 if(e==='air'){for(let i=0;i<4;i++)ring(c,b.x-d*i*12,b.y,Math.max(3,r-i*4),i%2?'#a9e8eb':'#edfaff',3);return;}
 if(e==='water'||e==='tidal'){for(let i=0;i<12;i++){const xx=b.x-d*i*6;const yy=b.y+Math.sin(t*17+i*.4)*(e==='tidal'?r*.7:7);disc(c,xx,yy,e==='tidal'?12:5,i%2?'#79dfff':'#d8fcff');}if(e==='tidal'){for(let i=0;i<12;i++){const a=-Math.PI*.8+i*.14;box(c,b.x+Math.cos(a)*r*d,b.y+Math.sin(a)*r,8,9,i%2?'#d8fcff':'#5bbdec');}}return;}
 if(e==='atomic'||e==='atomicBeam'){disc(c,b.x,b.y,r,'#65d4ee');disc(c,b.x+d*4,b.y,r*.65,'#eaffff');for(let i=0;i<(e==='atomicBeam'?14:5);i++)box(c,b.x-d*(r+i*7),b.y-r*.3,8,r*.6,i%2?'#9aecff':'#e3ffff');if(e==='atomic'){ring(c,b.x,b.y,r+5,'#3eafda',2);for(let i=0;i<3;i++){const a=t*8+i*2.1;disc(c,b.x+Math.cos(a)*(r+7),b.y+Math.sin(a)*(r+7),3,'#dcffff');}}else{box(c,b.x-d*40,b.y-r*.6,42,r*1.2,'#b8f7ff');box(c,b.x-d*44,b.y-3,48,6,'#ffffff');}return;}
 if(e==='wave'||e==='eye'){for(let i=0;i<3;i++)ring(c,b.x-d*i*12,b.y,r-i*4,'#d4aaff',3);if(e==='eye'){disc(c,b.x,b.y,r*.65,'#fff3db');disc(c,b.x+d*4,b.y,r*.25,'#805bc2');}return;}
 if(e==='beam'||e==='saiyan'){for(let i=0;i<12;i++)box(c,b.x-d*i*8,b.y-r*.4,9,r*.8,i%2?'#e8ffff':'#6bcfff');disc(c,b.x,b.y,r,'#5dc9ff');disc(c,b.x+d*5,b.y,r*.65,'#f0ffff');if(e==='saiyan')ring(c,b.x,b.y,r+6,'#ffe787',3);return;}
 // Explorer's fireballs retain an unmistakable orange flame silhouette.
 disc(c,b.x,b.y,r,'#fc9342');disc(c,b.x+d*3,b.y,r*.6,'#fff2b1');for(let i=0;i<6;i++)box(c,b.x-d*(r+i*6),b.y-5+Math.sin(t*26+i)*5,8,10-i,'#ffbf6388');
}
const impacts=[];function notify(p,event,t){if(['hit','block','break','empty','combo','dodge'].includes(event.type))impacts.push({x:p.x,y:p.y-45,side:p.side,t,type:event.type,value:event.type==='dodge'?'闪避':event.type==='hit'?'-'+Math.round(event.damage*10)/10:event.type==='block'?'格挡':event.type==='break'?'破防':event.type==='empty'?'需要 '+event.cost+' 能量':event.name});}
function feedback(c,t,colors){for(let i=impacts.length-1;i>=0;i--){const e=impacts[i],age=t-e.t;if(age>.85){impacts.splice(i,1);continue;}c.save();c.globalAlpha=Math.min(1,(.85-age)*3);const color=e.type==='block'?'#9beaff':e.type==='empty'?'#ff8585':colors[e.side];if(e.type==='hit'||e.type==='break'){const r=12+age*68;ring(c,e.x,e.y,r,color,3);for(let j=0;j<8;j++){const a=j*Math.PI/4;segment(c,e.x+Math.cos(a)*r*.4,e.y+Math.sin(a)*r*.4,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,2,'#fff1c8');}}if(e.type==='combo'){const x=e.side?554:40;box(c,x,133,366,36,'#112431dd');box(c,x,133,4,36,color);label(c,e.value,x+183,157,17,color);}else label(c,e.value,Math.max(90,Math.min(870,e.x)),e.y-44-age*30,e.type==='empty'?13:20,color);c.restore();}}
root.PixelFightingVFX={attack,projectile,notify,feedback};
})(globalThis);
