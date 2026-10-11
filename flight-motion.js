/* Presentation only: path and captures are supplied by FlightCore.preview. */
(function(root){'use strict';
class Motion{
 constructor(){this.generation=0;this.active=new Set();this.elements=new Set();this.paused=false}
 owns(element){return this.elements.has(element)}
 pause(value){this.paused=value;for(const a of this.active)value?a.pause():a.play()}
 cancel(){this.generation++;for(const a of this.active)a.cancel();this.active.clear();for(const b of this.elements){b.classList.remove('travelling','flying','landing-hit');delete b.dataset.motionProgress}this.elements.clear();this.paused=false}
 async animate(element,frames,duration,id){if(id!==this.generation)return false;const a=element.animate(frames,{duration,easing:'linear',fill:'forwards'});this.active.add(a);if(this.paused)a.pause();try{await a.finished}catch{return false}this.active.delete(a);if(id!==this.generation){a.cancel();return false}const end=frames[frames.length-1];for(const k of ['left','top'])if(end[k])element.style[k]=end[k];a.cancel();return true}
 point(color,index,p){const [x,y]=FlightArt.point(color,index,p);return {left:(x+.5)/15*100+'%',top:(y+.5)/15*100+'%'}}
 async play(buttons,plan,{onStep=()=>{},onHit=()=>{}}={}){
  this.cancel();const id=this.generation,b=buttons[plan.color*4+plan.index];this.elements.add(b);b.classList.add('travelling');b.classList.remove('hit');b.style.setProperty('--plane-size','4%');let previous=plan.from;
  for(const p of plan.path){const fly=previous>=0&&Math.abs(p-previous)>1,to=this.point(plan.color,plan.index,p),from={left:b.style.left,top:b.style.top};b.classList.toggle('flying',fly);const lift=fly?'-65%':'-24%',frames=[{...from,transform:'translate(-50%,-50%)'},{left:from.left,top:from.top,transform:`translate(-50%,calc(-50% + ${lift}))`,offset:.2},{...to,transform:`translate(-50%,calc(-50% + ${lift}))`,offset:.78},{...to,transform:'translate(-50%,-50%)'}];
   if(!await this.animate(b,frames,fly?(Math.abs(p-previous)>4?320:240):150,id))return false;b.dataset.motionProgress=p;onStep(p,fly);previous=p;
  }
  b.classList.remove('flying');
  if(plan.captured.length){onHit();for(const [c,i]of plan.captured){const enemy=buttons[c*4+i];this.elements.add(enemy);enemy.classList.add('travelling','landing-hit');enemy.classList.remove('hit')}
   const outcomes=await Promise.all(plan.captured.map(async([c,i])=>{const enemy=buttons[c*4+i];if(!await this.animate(enemy,[{filter:'brightness(1)'},{filter:'brightness(2.5)',offset:.5},{filter:'brightness(1)'}],140,id))return false;return this.animate(enemy,[{left:enemy.style.left,top:enemy.style.top,transform:'translate(-50%,-50%)',opacity:1},{...this.point(c,i,-1),transform:'translate(-50%,-50%) scale(.65)',opacity:.4}],220,id)}));if(outcomes.some(x=>!x))return false;
  }
  if(id!==this.generation)return false;for(const e of this.elements){e.classList.remove('travelling','landing-hit');delete e.dataset.motionProgress}this.elements.clear();return true;
 }
}
root.FlightMotion=Motion;
})(globalThis);
