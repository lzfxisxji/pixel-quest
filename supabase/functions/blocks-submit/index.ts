import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import './blocks-core-verifier.js';
import './replay.js';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'};
Deno.serve(async req=>{
 const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response({error:'POST required'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return response({error:'sign-in required'},401);
  // Administrator secret exists ONLY in the server environment, never the webpage.
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await client.auth.getUser(token);if(auth.error||!auth.data.user)return response({error:'invalid session'},401);
  const text=await req.text();if(text.length>5000000)return response({error:'replay too large'},413);
  const {session_id,log}=JSON.parse(text);
  const query=await client.from('bt_sessions').select('*').eq('id',session_id).eq('owner_id',auth.data.user.id).single();
  if(query.error||!query.data)return response({error:'match session not found'},403);
  const s=query.data;if(s.finished_at)return response({ok:true});
  const wall=Date.now()-Date.parse(s.created_at);if(wall<0||wall>86400000)return response({error:'session expired'},400);
  const engine=(globalThis as any).PixelBlocksCore,verify=(globalThis as any).BlocksReplay;
  const stats=verify(engine,{...s.options,seed:s.seed},log,wall);
  const accepted=await client.rpc('bt_accept_result',{p_session:session_id,p_stats:stats});if(accepted.error)throw accepted.error;
  return response({ok:true});
 }catch(e){return response({error:e instanceof Error?e.message:'verification failed'},400)}
});
