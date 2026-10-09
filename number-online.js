/* Only session-based RPCs can create online scores; never write score tables directly. */
(function(r){class Online{constructor(){this.config=r.NumberPuzzleConfig||{};this.enabled=!!(this.config.supabaseUrl&&this.config.supabasePublicKey);this.client=null}
async init(){if(!this.enabled)return;const key=this.config.supabasePublicKey;if(key.startsWith('sb_secret_'))throw Error('配置错误：必须使用公开客户端密钥');if(key.startsWith('ey')){try{if(JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='service_role')throw Error('禁止使用管理员密钥')}catch(e){if(e.message.includes('管理员'))throw e}}
if(!this.client){const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.57.4');this.client=createClient(this.config.supabaseUrl,key)}const {data,error}=await this.client.auth.getSession();if(error)throw error;if(!data.session){const sign=await this.client.auth.signInAnonymously();if(sign.error)throw sign.error}}
async rpc(name,args){await this.init();const {data,error}=await this.client.rpc(name,args);if(error)throw Error(error.message);return data}
create(nick,n){return this.rpc('np_create_session',{p_nickname:nick,p_mode:n})}
begin(id,first){return this.rpc('np_begin',{p_session:id,p_first:first})}
finish(id,moves){return this.rpc('np_finish',{p_session:id,p_moves:moves})}
list(n){return this.rpc('np_leaderboard',{p_mode:n})}}
r.NumberOnline=Online})(globalThis);
