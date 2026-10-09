(function(r){'use strict';
const solved=n=>Array.from({length:n*n},(_,i)=>(i+1)%(n*n));
const complete=b=>b.every((v,i)=>v===(i+1)%b.length);
function valid(b,n){return [3,4,5].includes(n)&&b.length===n*n&&new Set(b).size===n*n&&b.every(v=>Number.isInteger(v)&&v>=0&&v<n*n)}
function adjacent(a,b,n){return Math.abs(a%n-b%n)+Math.abs(Math.floor(a/n)-Math.floor(b/n))===1}
function distance(b,n){return b.reduce((d,v,i)=>v?d+Math.abs(i%n-(v-1)%n)+Math.abs(Math.floor(i/n)-Math.floor((v-1)/n)):d,0)}
function solvable(b,n){if(!valid(b,n))return false;let inv=0;for(let i=0;i<b.length;i++)if(b[i])for(let j=i+1;j<b.length;j++)if(b[j]&&b[i]>b[j])inv++;return n%2?inv%2===0:(inv+n-Math.floor(b.indexOf(0)/n))%2===1}
function shuffle(n,previous='',rng=Math.random){if(![3,4,5].includes(n))throw Error('请选择 3×3、4×4 或 5×5');for(let attempt=0;attempt<200;attempt++){const b=solved(n);let zero=b.length-1,last=-1;for(let k=0;k<(n===3?100:n===4?320:700);k++){const options=b.map((_,i)=>i).filter(i=>i!==last&&adjacent(i,zero,n)),i=options[Math.min(options.length-1,Math.floor(rng()*options.length))];b[zero]=b[i];b[i]=0;last=zero;zero=i}if(distance(b,n)>=(n===3?14:n===4?32:60)&&b.join(',')!==previous)return b}throw Error('打乱失败，请重新开始')}
function nickname(value){return String(value).normalize('NFKC').replace(/[^一-鿿A-Za-z0-9]/gu,'')}
class Match{constructor(n,b,now=()=>performance.now()){if(!valid(b,n)||!solvable(b,n)||complete(b))throw Error('无效初始棋盘');this.n=n;this.board=[...b];this.initial=[...b];this.moves=[];this.now=now;this.started=null;this.ended=null}
move(i){const z=this.board.indexOf(0);if(this.ended!==null||!Number.isInteger(i)||i<0||i>=this.board.length||!adjacent(i,z,this.n))return false;this.started??=this.now();[this.board[z],this.board[i]]=[this.board[i],this.board[z]];this.moves.push(i);if(complete(this.board))this.ended=this.now();return true}
elapsed(){return this.started===null?0:Math.max(0,(this.ended??this.now())-this.started)}}
const compare=(a,b)=>a.time_ms-b.time_ms||a.moves-b.moves||Date.parse(a.finished_at)-Date.parse(b.finished_at)||String(a.id).localeCompare(String(b.id));
function best(rows,n){const sorted=rows.filter(x=>x.mode===n).sort(compare),seen=new Set();return sorted.filter(x=>{const k=x.nickname.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).map((x,i)=>({...x,rank:i+1}))}
function time(ms){ms=Math.floor(ms);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`}
r.NumberCore={solved,complete,valid,adjacent,distance,solvable,shuffle,nickname,Match,compare,best,time};if(typeof module!=='undefined')module.exports=r.NumberCore;
})(globalThis);
