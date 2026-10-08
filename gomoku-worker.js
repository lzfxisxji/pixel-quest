/* Search stays off the UI thread; jobs contain only the current public board. */
importScripts('gomoku-core.js','gomoku-ai.js');
self.onmessage=({data})=>{try{const result=GomokuAI.choose(data.board,data.color,data.difficulty);self.postMessage({id:data.id,...result})}catch(error){self.postMessage({id:data.id,error:error.message})}};
