/* Combat presentation only: no collision, damage or input state. */
(function(root){'use strict';
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function label(c,s,x,y,size,color,align='center'){c.font='bold '+size+'px monospace';c.textAlign=align;c.fillStyle=color;c.fillText(s,Math.round(x),Math.round(y));}
function disc(c,x,y,r,color){for(let yy=-r;yy<=r;yy+=3){const w=Math.sqrt(Math.max(0,r*r-yy*yy));box(c,x-w,y+yy,w*2,3,color);}}
function ring(c,x,y,r,color,width=3){for(let i=0;i<28;i++){const a=i/28*Math.PI*2;box(c,x+Math.cos(a)*r-width/2,y+Math.sin(a)*r-width/2,width,width,color);}}
function segment(c,x,y,tx,ty,width,color){const distance=Math.hypot(tx-x,ty-y),steps=Math.max(1,Math.ceil(distance/3));for(let i=0;i<=steps;i++){const t=i/steps;box(c,x+(tx-x)*t-width/2,y+(ty-y)*t-width/2,width,width,color);}}
function attack(c,p,t,height,color){const a=p.action;if(!a)return;if(p.id==="goku"&&a.kind==="special")color="#58c8ff";const d=a.direction||p.facing,progress=Math.min(1,a.t/a.duration),strike=Math.sin(Math.min(1,a.t/a.start)*Math.PI/2)*(1-Math.max(0,(a.t-a.start)/(a.duration-a.start))),x=p.x,y=p.y;
 if(a.kind==='light'||a.kind==='heavy')return;
 {const r=(a.kind==='ultimate'?22:12)*(1+Math.sin(t*24)*.12),handX=x+d*30,handY=y-46;disc(c,handX,handY,r+5,color+'44');disc(c,handX,handY,r,color);disc(c,handX+d*2,handY-2,r*.55,'#fffbdc');ring(c,handX,handY,r+9,color,2);for(let i=0;i<5;i++){const angle=t*7+i*Math.PI*2/5;box(c,handX+Math.cos(angle)*(r+16),handY+Math.sin(angle)*(r+16),3,3,'#fff4bd');}if(a.kind==='ultimate'){for(let i=0;i<8;i++){const xx=x-42+i*12,yy=y-12-((t*110+i*17)%100);box(c,xx,yy,3,14,color+'aa');}ring(c,x,y-39,49+Math.sin(t*16)*3,color+'99',3);} }
 if(a.move?.range&&a.kind==='special'){for(let i=0;i<12;i++)box(c,x+d*(20+i*a.range/12),y-45+Math.sin(t*24+i*.6)*14,12,6,i%2?color:'#fff0d3');}
}
function projectile(c,b,t,color){if(b.id==="goku"&&!b.ultimate)color="#58c8ff";const d=Math.sign(b.vx),r=b.radius;for(let i=0;i<6;i++)box(c,b.x-d*(r+10+i*8),b.y-3,8,6,color+['cc','aa','88','66','44','22'][i]);
 if(b.effect==='lightning'||b.id==='soldier'){if(b.effect==='lightning'||b.ultimate){for(let i=0;i<15;i++)box(c,b.x-d*45+i*d*6,b.y+Math.sin(i*1.9+t*40)*10,9,4,i%2?color:'#e9ffff');}else {box(c,b.x-9,b.y-3,18,6,'#ffca67');box(c,b.x+2*d,b.y-2,7,4,'#fff3bd');}return;}
 if(b.id==='nezha'){if(!b.ultimate){ring(c,b.x,b.y,16,'#cf8536',6);ring(c,b.x,b.y,13,'#ffe38c',3);for(let i=0;i<3;i++)box(c,b.x+Math.cos(t*15+i*2.1)*16,b.y+Math.sin(t*15+i*2.1)*16,4,4,'#fff8cf');}else for(let i=0;i<15;i++){const yy=b.y+Math.sin(t*18+i*.55)*18;box(c,b.x-65+i*9,yy,14,9,'#e73c65');box(c,b.x-63+i*9,yy,10,3,'#ffafbe');}return;}
 if(b.id==='mystic'&&!b.ultimate&&b.effect!=='wave'){segment(c,b.x-d*27,b.y,b.x+d*17,b.y,4,'#ffb34b');for(let i=0;i<5;i++)box(c,b.x+d*(17+i*3),b.y-8+i*2,3,16-i*4,'#ffe18e');return;}
 if(b.id==='dora'){for(let i=0;i<3;i++)ring(c,b.x-d*i*10,b.y,r-i*3,i===0?'#f0ffff':color,3);disc(c,b.x,b.y,r*.4,'#d1f6ff');return;}
 disc(c,b.x,b.y,r+7,color+'33');disc(c,b.x,b.y,r,color);disc(c,b.x+d*3,b.y-2,r*.63,'#fff6d5');disc(c,b.x+d*5,b.y-4,r*.32,'#ffffff');if(b.effect==='beam'||b.ultimate){for(let i=0;i<9;i++)box(c,b.x-d*(i*8),b.y-r*.35,9,r*.7,i%2?'#c2f6ff':'#fff9dd');}else ring(c,b.x,b.y,r+4,color,2);
}
const impacts=[];function notify(p,event,t){if(['hit','block','break','empty','combo','dodge'].includes(event.type))impacts.push({x:p.x,y:p.y-45,side:p.side,t,type:event.type,value:event.type==='dodge'?'闪避':event.type==='hit'?'-'+Math.round(event.damage*10)/10:event.type==='block'?'格挡':event.type==='break'?'破防':event.type==='empty'?'需要 '+event.cost+' 能量':event.name});}
function feedback(c,t,colors){for(let i=impacts.length-1;i>=0;i--){const e=impacts[i],age=t-e.t;if(age>.85){impacts.splice(i,1);continue;}c.save();c.globalAlpha=Math.min(1,(.85-age)*3);const color=e.type==='block'?'#9beaff':e.type==='empty'?'#ff8585':colors[e.side];if(e.type==='hit'||e.type==='break'){const r=12+age*68;ring(c,e.x,e.y,r,color,3);for(let j=0;j<8;j++){const a=j*Math.PI/4;segment(c,e.x+Math.cos(a)*r*.4,e.y+Math.sin(a)*r*.4,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,2,'#fff1c8');}}if(e.type==='combo'){const x=e.side?554:40;box(c,x,133,366,36,'#112431dd');box(c,x,133,4,36,color);label(c,e.value,x+183,157,17,color);}else label(c,e.value,Math.max(90,Math.min(870,e.x)),e.y-44-age*30,e.type==='empty'?13:20,color);c.restore();}}
root.PixelFightingVFX={attack,projectile,notify,feedback};
})(globalThis);
