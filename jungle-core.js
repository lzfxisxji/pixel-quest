/* One rule engine for humans and every AI tier. Red=1, Blue=-1. */
(function(root){'use strict';
const W=7,H=9,names=['','鼠','猫','狗','狼','豹','虎','狮','象'];
const inside=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<W&&y>=0&&y<H;
function tile(i){const x=i%W,y=Math.floor(i/W);if(y>=3&&y<=5&&[1,2,4,5].includes(x))return {type:'water',owner:0};if(x===3&&(y===0||y===8))return {type:'den',owner:y===0?-1:1};if((y===0||y===8)&&[2,4].includes(x)||x===3&&(y===1||y===7))return {type:'trap',owner:y<4?-1:1};return {type:'land',owner:0}}
function initial(){const b=Array(63).fill(0);for(const [x,y,r]of [[0,0,7],[6,0,6],[1,1,3],[5,1,2],[0,2,1],[2,2,5],[4,2,4],[6,2,8]]){b[y*7+x]=-r;b[(8-y)*7+6-x]=r}return b}
const key=s=>s.turn+':'+s.board.join(',');
function state(board=initial(),turn=1){const s={board:[...board],turn,quiet:0,ply:0,winner:null,reason:'',seen:{}};s.seen[key(s)]=1;return s}
function rank(board,i){const p=board[i],t=tile(i);return t.type==='trap'&&t.owner===-Math.sign(p)?0:Math.abs(p)}
function canCapture(board,from,to){const a=board[from],b=board[to];if(!a||!b||Math.sign(a)===Math.sign(b))return false;if((tile(from).type==='water')!==(tile(to).type==='water'))return false;const ar=rank(board,from),br=rank(board,to);if(br===0)return true;if(ar===0)return false;if(Math.abs(a)===1&&Math.abs(b)===8)return true;if(Math.abs(a)===8&&Math.abs(b)===1)return false;return ar>=br}
function moves(s,side=s.turn){if(s.winner!==null)return [];const out=[];for(let from=0;from<63;from++){const p=s.board[from];if(Math.sign(p)!==side)continue;const x=from%7,y=Math.floor(from/7);for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){let xx=x+dx,yy=y+dy;if(!inside(xx,yy))continue;let to=yy*7+xx;if(tile(to).type==='water'&&Math.abs(p)!==1){if(![6,7].includes(Math.abs(p)))continue;let blocked=false;while(inside(xx,yy)&&tile(yy*7+xx).type==='water'){if(s.board[yy*7+xx])blocked=true;xx+=dx;yy+=dy}if(blocked||!inside(xx,yy))continue;to=yy*7+xx}const t=tile(to),target=s.board[to];if(t.type==='den'&&t.owner===side||Math.sign(target)===side)continue;if(target&&!canCapture(s.board,from,to))continue;out.push({from,to,capture:target})}}return out}
function step(s,m){const board=[...s.board],p=board[m.from],captured=board[m.to];board[m.to]=p;board[m.from]=0;const n={board,turn:-s.turn,quiet:captured?0:s.quiet+1,ply:s.ply+1,winner:null,reason:'',seen:{...s.seen}};
if(tile(m.to).type==='den'){n.winner=s.turn;n.reason='进入对方兽穴'}else if(!board.some(v=>Math.sign(v)===n.turn)){n.winner=s.turn;n.reason='对方动物全部被吃掉'}else if(!moves(n).length){n.winner=s.turn;n.reason='对方没有合法走法'}
const k=key(n);n.seen[k]=(n.seen[k]||0)+1;if(n.winner===null&&(n.seen[k]>=3||n.quiet>=100)){n.winner=0;n.reason=n.seen[k]>=3?'同一局面出现三次':'连续 100 手无吃子'}return n}
class Match{constructor(){this.reset()}reset(board=initial(),turn=1){this.s=state(board,turn);this.history=[]}play(from,to){const m=moves(this.s).find(m=>m.from===from&&m.to===to);if(!m)return false;this.history.push(this.s);this.s=step(this.s,m);return true}undo(count=1){let changed=false;while(count-->0&&this.history.length){this.s=this.history.pop();changed=true}return changed}}
const api={W,H,names,inside,tile,initial,key,state,rank,canCapture,moves,step,Match};root.JungleCore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
