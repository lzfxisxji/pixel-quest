/* Adventure-only Astro Boy sprites, authored as pixel matrices. Original cast is untouched. */
(function(root){'use strict';const colors={A:'#111d27',Q:'#35475a',S:'#ffbe86',T:'#de865c',W:'#fff4dc',K:'#1b242b',G:'#31b778',Y:'#a0e2aa',R:'#e54438',D:'#9c292b',H:'#ff9180',B:'#64d9ff'};
const rows=[
'..........A.............',
'.........AAA............',
'.........AQA............',
'........AAQAA...........',
'.......AAQQAAA..........',
'....AAAAQAAAAAAA........',
'...AAQAAAASSSSAAA.......',
'..AAAAAASSSSSSSSAA......',
'.AAAAAASTSSSSSSSAA......',
'...AAASSSAKSSKSSSA......',
'....ASTSSWKSSWKSSA......',
'....ASSSSWKSSWKSSA......',
'.....ATSSSSSSSSSA.......',
'......ASSSHHSSSA........',
'.......ATSSSSSA.........',
'......ASSSSSSSSA........',
'.....ASSTSSSSSTSSA......',
'.....ASSTSSSSSTSSA......',
'......ASGGYYGGSA........',
'.......AKKKKKKA.........',
'.......ASSSSSSA.........',
'......ARRR..RRRA........',
'......ARRR..RRRA........',
'.....ADRRR..RRRDA.......'];
function edit(src,changes){const g=src.map(r=>r.split(''));for(const [x,y,s]of changes)for(let i=0;i<s.length;i++)g[y][x+i]=s[i];return g.map(r=>r.join(''));}
const art={astro:rows,astroIdle:edit(rows,[[9,13,'SHHSS']]),astroWalk:edit(rows,[[5,16,'ASS'],[16,16,'SSA'],[5,17,'...'],[16,17,'...'],[6,21,'ARRR'],[12,21,'SSSA'],[6,22,'ARRR'],[12,22,'ARRR'],[5,23,'ADRRR'],[12,23,'ARRRDA']]),astroRun:edit(rows,[[4,16,'ASSS'],[16,15,'SSSA'],[16,16,'....'],[6,21,'ASSS'],[12,21,'ARRRA'],[4,22,'ARRRA'],[12,22,'ARRRA'],[4,23,'ADRRRA'],[12,23,'ARRRDA']]),astroJump:edit(rows,[[4,14,'ASS'],[16,14,'SSA'],[4,15,'ASS'],[16,15,'SSA'],[5,17,'...'],[16,17,'...'],[6,21,'ARRR'],[12,21,'RRRA'],[6,22,'ARRR'],[12,22,'RRRA']]),astroShoot:edit(rows,[[16,15,'SSSSSSA'],[16,16,'SSSSSSA'],[16,17,'.......']]),reactor:['....AAAA....','..AAWWWWAA..','.AWBBBBBBWA.','AWBBWWWWBBWA','AWBBWBBWBBWA','AWBBWWWWBBWA','.AWBBBBBBWA.','..AAWWWWAA..','....AAAA....']};
for(const v of Object.values(art))Object.freeze(v);root.PixelAstro=Object.freeze({art:Object.freeze(art),colors:Object.freeze(colors)});if(typeof module==='object')module.exports=root.PixelAstro;})(typeof globalThis==='object'?globalThis:this);
