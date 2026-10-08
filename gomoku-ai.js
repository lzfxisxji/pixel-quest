/* Candidate-based, deterministic tactical evaluation with bounded alpha-beta search. */
(function(root){'use strict';
const {SIZE:N,DIRS,inside,line}=root.GomokuCore||(typeof require==='function'?require('./gomoku-core.js'):{});
const LEVELS={easy:{depth:0,width:0,ms:0},normal:{depth:1,width:12,ms:180},hard:{depth:3,width:7,ms:450},expert:{depth:5,width:8,ms:1300}};
function candidates(b){const set=new Set();for(let i=0;i<b.length;i++)if(b[i]){const x=i%N,y=Math.floor(i/N);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(inside(x+dx,y+dy)&&!b[(y+dy)*N+x+dx])set.add((y+dy)*N+x+dx)}return set.size?[...set]:b.some(v=>v)?[]:[112]}
function profile(b,i,color){const x=i%N,y=Math.floor(i/N);let score=0,fours=0,threes=0;for(const [dx,dy]of DIRS){let s='';for(let n=-5;n<=5;n++){const xx=x+dx*n,yy=y+dy*n;s+=!inside(xx,yy)?'2':n===0?'1':b[yy*N+xx]===color?'1':b[yy*N+xx]===0?'0':'2'}
 if(s.includes('11111'))return {score:10000000,fours:4,threes:4,win:true};
 const open4=s.includes('011110');let four=false;
 for(let a=1;a<=5;a++){const w=s.slice(a,a+5);if(w.length===5&&!w.includes('2')&&w.split('1').length-1===4)four=true}
 const open3=['01110','010110','011010'].some(p=>s.includes(p));
 if(open4){score+=150000;fours++}else if(four){score+=22000;fours++}
 else if(open3){score+=4500;threes++}else if(['211100','001112','211010','010112'].some(p=>s.includes(p)))score+=500;
 else if(['001100','01010','0010100'].some(p=>s.includes(p)))score+=260;
 else if(s.includes('11'))score+=55;else score+=8;
 }
 if(fours>=2)score+=200000;if(fours&&threes)score+=75000;if(threes>=2)score+=24000;
 score+=14-Math.abs(x-7)-Math.abs(y-7);return {score,fours,threes,win:false}}
function ranked(b,color){return candidates(b).map(i=>{const own=profile(b,i,color),opp=profile(b,i,3-color);return {i,own,opp,score:own.score+opp.score*1.08}}).sort((a,b)=>b.score-a.score||Math.abs(a.i%N-7)+Math.abs(Math.floor(a.i/N)-7)-Math.abs(b.i%N-7)-Math.abs(Math.floor(b.i/N)-7)||a.i-b.i)}
function choose(board,color,difficulty='normal',opts={}){
 const b=Uint8Array.from(board),cfg=LEVELS[difficulty]||LEVELS.normal,random=opts.random||Math.random,start=Date.now();let nodes=0,completed=0;
 const all=ranked(b,color);if(!all.length)return {index:-1,nodes,depth:0,reason:'full'};
 const win=all.find(m=>m.own.win);if(win)return {index:win.i,nodes,depth:0,reason:'win'};
 const blocks=all.filter(m=>m.opp.win);if(blocks.length)return {index:blocks[0].i,nodes,depth:0,reason:'block'};
 if(difficulty==='easy'){const nearby=all.filter(m=>{const x=m.i%N,y=Math.floor(m.i/N);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(inside(x+dx,y+dy)&&b[(y+dy)*N+x+dx])return true;return false});const pool=nearby.length?nearby:all;return {index:pool[Math.min(pool.length-1,Math.floor(random()*pool.length))].i,nodes,depth:0,reason:'nearby-random'}}
 if(difficulty==='normal')return {index:all[0].i,nodes:all.length,depth:1,reason:'formations'};
 let best=all[0].i;const limit=start+(opts.ms??cfg.ms),maxNodes=opts.maxNodes??(difficulty==='expert'?16000:4500),TIMEOUT={};
 function search(turn,depth,alpha,beta,ply){if(++nodes>maxNodes||Date.now()>limit)throw TIMEOUT;const moves=ranked(b,turn);if(!moves.length)return 0;const immediate=moves.find(m=>m.own.win);if(immediate)return 10000000-ply*10000;
 if(depth===0){const own=moves.map(m=>m.own.score).sort((a,b)=>b-a),opp=moves.map(m=>m.opp.score).sort((a,b)=>b-a);return own[0]+(own[1]||0)*.2-opp[0]*1.12-(opp[1]||0)*.22}
 const forced=moves.filter(m=>m.opp.win),list=forced.length?forced:moves.slice(0,Math.max(4,cfg.width-ply));let value=-Infinity;
 for(const m of list){b[m.i]=turn;let v;try{v=-search(3-turn,depth-1,-beta,-alpha,ply+1)}finally{b[m.i]=0}value=Math.max(value,v);alpha=Math.max(alpha,v);if(alpha>=beta)break}return value}
 for(let depth=2;depth<=cfg.depth;depth++){let iterationBest=best,value=-Infinity,complete=true;const ordered=[...all.slice(0,cfg.width)].sort((a,b)=>Number(b.i===best)-Number(a.i===best));try{for(const m of ordered){b[m.i]=color;let v;try{v=-search(3-color,depth-1,-Infinity,-value,1)}finally{b[m.i]=0}if(v>value){value=v;iterationBest=m.i}}}catch(e){if(e!==TIMEOUT)throw e;complete=false}if(complete){best=iterationBest;completed=depth}else break}
 return {index:best,nodes,depth:completed||1,reason:completed?'alpha-beta':'threat-fallback',elapsed:Date.now()-start};
}
root.GomokuAI={LEVELS,candidates,profile,ranked,choose};if(typeof module!=='undefined')module.exports=root.GomokuAI;
})(globalThis);
