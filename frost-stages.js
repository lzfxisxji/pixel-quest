/* Original fixed-screen layouts, redesigned to echo the classic Snow Bros. tower of
   stacked floors joined by ladders. Add new worlds by appending stage records. */
(function(r){
const W=640,H=400,GROUND={x:12,y:370,w:616};
// Shared upper-floor heights for the classic tower look. Floors leave an alternating
// gap (right/left) so players can drop down like the original, while ladders climb up.
const FLOORS=[{x:24,y:290,w:536},{x:80,y:210,w:536},{x:24,y:130,w:536}];
// Ladder patterns per stage: each entry is [topY, bottomY, x]. A ladder bridges two floors.
const LAD=[
 [[290,370,120],[290,370,470],[210,290,300],[130,210,120],[130,210,470]],
 [[290,370,90],[290,370,520],[210,290,200],[210,290,420],[130,210,300]],
 [[290,370,150],[290,370,440],[210,290,90],[210,290,520],[130,210,300]],
 [[290,370,300],[210,290,120],[210,290,470],[130,210,300]],
 [[290,370,120],[290,370,470],[210,290,300]],
 [[290,370,90],[290,370,520],[210,290,300],[130,210,120],[130,210,470]],
 [[290,370,150],[290,370,440],[210,290,90],[210,290,520],[130,210,300]],
 [[290,370,300],[210,290,120],[210,290,470],[130,210,300]],
 [[290,370,120],[290,370,470],[210,290,300],[130,210,120],[130,210,470]],
 [[290,370,300],[210,290,120],[210,290,470]]
];
const types=[['slime','slime','runner'],['slime','runner','jumper','slime'],['runner','jumper','shooter','slime','runner'],['shield','runner','flyer','jumper','shooter'],['slime','runner','slime'],['heavy','shield','shooter','jumper','flyer'],['heavy','runner','shield','shooter','flyer','jumper'],['shield','heavy','shooter','jumper','flyer','runner'],['heavy','shield','shooter','flyer','jumper','runner','heavy'],['slime','runner','jumper','shield']];
const names=['初雪练习场','松林回廊','晶蓝冰洞','雪顶钟楼','霜角守卫','极光峡谷','冰晶工坊','暮色雪堡','暴风前夜','寒星王座'];
const LW=12; // ladder width
const stages=LAD.map((ladders,i)=>{
  const platforms=[GROUND,...FLOORS];
  const enemies=types[i].map((type,j)=>{
    const lvl=j===0?GROUND:FLOORS[(j-1)%FLOORS.length];
    return {type,x:lvl.x+30+(j*70)%(lvl.w-60),y:lvl.y-20};
  });
  return {
    id:i,name:names[i],biome:i<3?'forest':i<7?'cave':'castle',
    platforms,
    ladders:ladders.map(([top,bottom,x])=>({x,top,bottom,w:LW})),
    enemies,
    boss:i===4?'mini':i===9?'major':null
  };
});
const api={W,H,stages};
r.FrostStages=api;
if(typeof module==='object')module.exports=api;
})(globalThis);
