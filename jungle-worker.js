importScripts('jungle-core.js','jungle-ai.js');
onmessage=({data})=>{try{postMessage({id:data.id,...JungleAI.choose(data.state,data.difficulty)})}catch(e){postMessage({id:data.id,error:String(e)})}};
