/* NES-reference side-area layouts, drawn with this project's existing tile art. */
(function(g){'use strict';const routes={
'1-1':[{entry:58,height:2,exit:128,exitHeight:3,room:'vault19'}],
'1-2':[{entry:29,height:3,exit:137,exitHeight:3,room:'gallery27'}],
'2-1':[{entry:94,height:2,exit:143,exitHeight:3,room:'vault19'}],
'3-1':[{entry:45,height:3,exit:94,exitHeight:2,room:'arch12'}],
'4-1':[{entry:94,height:2,exit:143,exitHeight:3,room:'exit18'}],
'5-1':[{entry:143,height:6,exit:150,exitHeight:2,room:'block10'}],
'5-2':[{entry:45,height:3,exit:94,exitHeight:2,room:'waterway'}],
'6-2':[{entry:45,height:3,exit:70,exitHeight:2,room:'vault19'},{entry:94,height:2,exit:120,exitHeight:2,room:'waterway'},{entry:143,height:3,exit:165,exitHeight:2,room:'exit18'}],
'7-1':[{entry:94,height:2,exit:143,exitHeight:3,room:'vault19'}],
'8-1':[{entry:94,height:2,exit:110,exitHeight:2,room:'late17'}]
};
const titles={vault19:'BRICK VAULT / 19 COINS',gallery27:'COIN GALLERY / 27 COINS',arch12:'BRICK ARCH / POWER-UP',exit18:'PIPE CHAMBER / POWER-UP',block10:'COIN BLOCK CHAMBER',late17:'FINAL COIN CHAMBER',waterway:'UNDERWATER PASSAGE'};
function set(w,x,y,type='brick',content){w.tiles.set(`${x},${y}`,{x:x*16,y:y*16,w:16,h:16,type,content,bump:0});}
function pipe(w,x,height){for(let dx=0;dx<2;dx++)for(let y=14-height;y<14;y++)set(w,x+dx,y,y===14-height?'pipeTop':'pipe');}
function attach(w){w.portals=w.portals.filter(p=>p.type!=='bonus'&&p.type!=='returnMarker');for(const [i,r]of (routes[w.course.id]||[]).entries()){for(const x of [r.entry,r.exit])for(let dx=0;dx<2;dx++){for(let y=4;y<14;y++)w.tiles.delete(`${x+dx},${y}`);for(let y=14;y<17;y++)set(w,x+dx,y,'ground');}pipe(w,r.entry,r.height);pipe(w,r.exit,r.exitHeight);const id=`${w.course.id}:${i}:${r.room}`;w.portals.push({x:r.entry*16,y:(14-r.height)*16,w:32,h:16,type:'bonus',room:r.room,roomId:id,returnX:r.exit*16,returnY:(14-r.exitHeight)*16});w.portals.push({x:r.exit*16,y:(14-r.exitHeight)*16,w:32,h:16,type:'returnMarker',roomId:id});w.enemies=w.enemies.filter(e=>Math.abs(e.x-r.entry*16)>40&&Math.abs(e.x-r.exit*16)>40);if(r.height>4){set(w,r.entry-4,12,'stone');set(w,r.entry-2,10,'stone');}}return w;}
function room(meta,themes,route){const name=route.room||'vault19',water=name==='waterway',length=water?100:30,w={tiles:new Map(),collect:[],enemies:[],platforms:[],portals:[],length:length*16,flagX:Infinity,exitX:Infinity,checkpointX:Infinity,theme:{...themes[1],sky:water?'#123d5b':'#070e17',hills:'#132231',far:'#162d3c',grass:'#537590'},kind:water?'water':'underground',scene:'bonus',course:meta,hasFlag:false,roomId:route.roomId,roomType:name,roomTitle:titles[name],spawn:{x:32,y:144}};
const coin=(x,y)=>w.collect.push({x:x*16+4,y:y*16+3,w:8,h:11}),line=(a,b,y)=>{for(let x=a;x<=b;x++)coin(x,y);},blockLine=(a,b,y)=>{for(let x=a;x<=b;x++)set(w,x,y);},coinBlock=(x,y)=>{set(w,x,y,'brick','coin');w.tiles.get(`${x},${y}`).coinRemaining=10;};
for(let x=0;x<length;x++){for(let y=14;y<17;y++)set(w,x,y,'ground');if(!water)set(w,x,3,'stone');}for(let y=4;y<14;y++)set(w,0,y,'stone');
if(name==='vault19'){for(let y=11;y<14;y++)blockLine(8,14,y);line(9,13,5);line(8,14,7);line(8,14,9);}
if(name==='gallery27'){blockLine(5,22,11);line(6,14,5);line(6,14,7);line(6,14,9);coinBlock(18,8);blockLine(18,20,12);}
if(name==='arch12'){blockLine(7,10,7);blockLine(13,16,7);for(let y=8;y<=11;y++){blockLine(7,8,y);blockLine(15,16,y);}line(11,12,5);line(10,13,6);for(const [x,y]of [[10,8],[13,8],[9,9],[14,9],[8,10],[15,10]])coin(x,y);set(w,9,7,'brick','mushroom');}
if(name==='exit18'){blockLine(5,16,11);line(5,13,6);line(5,13,9);set(w,24,8,'brick','mushroom');set(w,22,12,'stone');set(w,23,10,'stone');}
if(name==='block10'){for(let y=11;y<14;y++)blockLine(6,15,y);line(7,11,6);line(7,11,9);coinBlock(13,8);}
if(name==='late17'){blockLine(6,17,11);line(7,14,6);line(6,14,9);coinBlock(19,8);set(w,20,12,'stone');}
if(water){for(let x=9;x<88;x+=14){for(let y=11;y<14;y++)set(w,x,y,'stone');for(let j=0;j<4;j++)coin(x+j,7-(x%3));w.platforms.push({x:(x+6)*16,y:144,w:32,h:8,base:(x+6)*16,t:0,range:5,vx:0,sinking:true});}w.enemies=[{x:28*16,y:100,w:14,h:12,vx:-.5,vy:0,type:'fish',alive:true,age:0},{x:49*16,y:140,w:14,h:12,vx:-.65,vy:0,type:'fish',alive:true,age:80},{x:70*16,y:90,w:14,h:12,vx:-.6,vy:0,type:'squid',alive:true,age:140}];}
const exit=water?94:25;for(let y=4;y<14;y++)set(w,exit+1,y,'pipe');for(let y=12;y<14;y++)set(w,exit,y,'pipeSide');w.portals=[{x:exit*16,y:192,w:16,h:32,type:'return',direction:'right'}];return w;}
g.AdventureBonus={routes,titles,attach,room};if(typeof module!=='undefined')module.exports=g.AdventureBonus;
})(globalThis);
