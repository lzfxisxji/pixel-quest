/* Independent freestyle Gomoku rules. No imports from other game engines. */
(function(root){'use strict';
const SIZE=15,DIRS=[[1,0],[0,1],[1,1],[1,-1]],inside=(x,y)=>x>=0&&y>=0&&x<SIZE&&y<SIZE;
function line(board,x,y,color){for(const [dx,dy]of DIRS){const before=[],after=[];for(let n=1;inside(x-dx*n,y-dy*n)&&board[(y-dy*n)*SIZE+x-dx*n]===color;n++)before.unshift((y-dy*n)*SIZE+x-dx*n);for(let n=1;inside(x+dx*n,y+dy*n)&&board[(y+dy*n)*SIZE+x+dx*n]===color;n++)after.push((y+dy*n)*SIZE+x+dx*n);const all=[...before,y*SIZE+x,...after];if(all.length>=5){const pos=before.length,start=Math.min(Math.max(0,pos-4),all.length-5);return all.slice(start,start+5)}}return []}
class Match{
 constructor(){this.reset()}
 reset(){this.board=new Uint8Array(SIZE*SIZE);this.history=[];this.turn=1;this.winner=0;this.winning=[];this.finished=false;return this}
 place(x,y){if(this.finished||!Number.isInteger(x)||!Number.isInteger(y)||!inside(x,y)||this.board[y*SIZE+x])return false;const color=this.turn;this.board[y*SIZE+x]=color;this.history.push({x,y,color});this.winning=line(this.board,x,y,color);if(this.winning.length){this.winner=color;this.finished=true}else if(this.history.length===SIZE*SIZE)this.finished=true;else this.turn=3-color;return true}
 undo(count=1){if(this.finished)return false;let removed=0;while(count-->0&&this.history.length){const m=this.history.pop();this.board[m.y*SIZE+m.x]=0;this.turn=m.color;removed++}this.winning=[];return removed>0}
 snapshot(){return {board:Array.from(this.board),turn:this.turn,winner:this.winner,winning:[...this.winning],finished:this.finished,moves:this.history.length,last:this.history.at(-1)||null}}
}
root.GomokuCore={SIZE,DIRS,inside,line,Match};if(typeof module!=='undefined')module.exports=root.GomokuCore;
})(globalThis);
