/* Original pixel animal portraits, drawn in a 20x20 logical grid. */
(function(root){function animal(ctx,rank,x,y,size){ctx.save();ctx.translate(x,y);ctx.scale(size/20,size/20);const r=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h)},ink='#182a32',ivory='#fff0bd';
const fur={1:'#9facc0',2:'#dfae6f',3:'#b98d66',4:'#7897a6',5:'#e8bf60',6:'#e39447',7:'#e7b35c',8:'#96b1b4'}[rank];
if(rank===7){r(3,2,14,16,'#956040');r(1,5,18,11,'#ad703c');r(5,0,10,19,'#ad703c')}
if(rank===8){r(1,5,6,9,'#718e98');r(13,5,6,9,'#718e98');r(2,6,4,6,'#a7c1bf');r(14,6,4,6,'#a7c1bf')}
if([2,4,5,6].includes(rank)){r(4,1,4,7,fur);r(12,1,4,7,fur);r(5,3,2,3,'#c98179');r(13,3,2,3,'#c98179')}
if(rank===3){r(2,3,4,12,'#6a4d3d');r(14,3,4,12,'#6a4d3d')}
if(rank===1){r(2,1,6,7,fur);r(12,1,6,7,fur);r(3,2,4,4,'#e8a0ac');r(13,2,4,4,'#e8a0ac');r(16,15,4,2,'#e8a0ac');r(18,11,2,5,'#e8a0ac')}
r(4,5,12,10,fur);r(6,3,8,14,fur);r(5,7,3,2,ink);r(12,7,3,2,ink);r(5,7,1,1,ivory);r(12,7,1,1,ivory);
if(rank===8){r(8,10,4,8,fur);r(10,16,5,3,fur);r(6,11,2,4,ivory);r(13,11,2,4,ivory);r(9,12,2,1,'#617b8a')}
else{r(7,10,6,5,rank===4?'#c5d2cb':ivory);r(9,10,2,2,rank===1?'#e88eaa':ink);r(9,13,2,1,ink);if(rank===1){r(8,14,1,2,'#fff');r(10,14,1,2,'#fff')}}
if(rank===6){for(const [a,b]of [[6,4],[12,4],[4,10],[14,10],[4,13],[14,13]])r(a,b,2,2,'#654830')}
if(rank===5){for(const [a,b]of [[7,4],[12,5],[4,11],[15,12],[6,14]])r(a,b,1,2,'#684732')}
if(rank===2){r(2,11,4,1,ivory);r(14,11,4,1,ivory);r(1,13,5,1,ivory);r(14,13,5,1,ivory)}
if(rank===4){r(4,5,3,2,'#c9d7d4');r(13,5,3,2,'#c9d7d4');r(7,15,6,2,'#c9d7d4')}
ctx.restore()}
root.JungleArt={animal};})(globalThis);
