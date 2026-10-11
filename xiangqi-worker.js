importScripts('xiangqi-core.js','xiangqi-ai.js');
onmessage=({data})=>{try{postMessage({id:data.id,...XiangqiAI.choose(data.state,data.tier)})}catch(e){postMessage({id:data.id,error:e.message})}};
