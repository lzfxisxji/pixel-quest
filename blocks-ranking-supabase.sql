-- Independent Tetris ranking tables/RPCs. Run after enabling anonymous sign-ins.
begin;
create table if not exists public.bt_sessions(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 options jsonb not null,names text[] not null,seed integer not null,
 created_at timestamptz not null default clock_timestamp(), finished_at timestamptz
);
create index if not exists bt_owner_created on public.bt_sessions(owner_id,created_at);
create table if not exists public.bt_scores(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.bt_sessions(id),side integer not null check(side in(0,1)),
 nickname text not null check(char_length(nickname) between 2 and 12 and nickname~'^[A-Za-z0-9一-鿿]+$'),
 mode text not null check(mode in('ai','local')),difficulty text not null check(difficulty in('easy','normal','hard','expert')),
 initial_rows integer not null check(initial_rows between 0 and 10),ai_level text not null check(ai_level in('easy','normal','hard','none')),
 survival_ms bigint not null check(survival_ms between 0 and 14400000),score bigint not null check(score between 0 and 100000000),
 lines integer not null check(lines between 0 and 100000),finished_at timestamptz not null default clock_timestamp(),unique(session_id,side)
);
create index if not exists bt_best_score on public.bt_scores(mode,difficulty,initial_rows,ai_level,lower(nickname),survival_ms desc,score desc,lines desc,finished_at);
alter table public.bt_sessions enable row level security;alter table public.bt_scores enable row level security;
revoke all on public.bt_sessions,public.bt_scores from anon,authenticated;
grant all on public.bt_sessions,public.bt_scores to service_role;
create or replace function public.bt_create_session(p_options jsonb,p_names text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();o jsonb;sid uuid;seedvalue integer;name text;
begin
 if uid is null then raise exception 'sign-in required';end if;
 if p_options is null or p_options->>'mode' is null or p_options->>'difficulty' is null
 or p_options->>'mode' not in('ai','local') or p_options->>'difficulty' not in('easy','normal','hard','expert')
 or p_options->>'rows' is null or (p_options->>'rows')::integer not between 0 and 10
 or (p_options->>'mode'='ai' and (p_options->>'ai' is null or p_options->>'ai' not in('easy','normal','hard'))) then raise exception 'invalid options';end if;
 if p_names is null or array_ndims(p_names)<>1 or array_lower(p_names,1)<>1 or cardinality(p_names)<>2 then raise exception 'invalid nicknames';end if;
 foreach name in array p_names loop if name is null or char_length(name) not between 2 and 12 or name!~'^[A-Za-z0-9一-鿿]+$' then raise exception 'invalid nickname';end if;end loop;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,7));
 if (select count(*) from public.bt_sessions where owner_id=uid and created_at>clock_timestamp()-interval '1 minute')>=3
 or(select count(*) from public.bt_sessions where owner_id=uid and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'too many matches';end if;
 o:=jsonb_build_object('mode',p_options->>'mode','difficulty',p_options->>'difficulty','rows',(p_options->>'rows')::integer,'ai',case when p_options->>'mode'='ai' then p_options->>'ai' else 'none' end,'rule','survival');seedvalue:=floor(random()*2147483646)::integer;
 insert into public.bt_sessions(owner_id,options,names,seed)values(uid,o,p_names,seedvalue)returning id into sid;
 return jsonb_build_object('session_id',sid,'seed',seedvalue);
end $$;
create or replace function public.bt_leaderboard(p_mode text,p_difficulty text,p_rows integer,p_ai text)
returns table(rank bigint,nickname text,survival_ms bigint,score bigint,lines integer,finished_at timestamptz)
language sql stable security definer set search_path='' as $$
 with best as(select distinct on(lower(s.nickname))s.* from public.bt_scores s where s.mode=p_mode and s.difficulty=p_difficulty and s.initial_rows=p_rows and s.ai_level=p_ai
 order by lower(s.nickname),s.survival_ms desc,s.score desc,s.lines desc,s.finished_at,s.id)
 select row_number()over(order by b.survival_ms desc,b.score desc,b.lines desc,b.finished_at,b.id),b.nickname,b.survival_ms,b.score,b.lines,b.finished_at from best b
 order by b.survival_ms desc,b.score desc,b.lines desc,b.finished_at,b.id limit 100
$$;
-- ONLY the authenticated server verifier can call this RPC with derived replay stats.
create or replace function public.bt_accept_result(p_session uuid,p_stats jsonb)returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.bt_sessions;v jsonb;i integer:=0;expected integer;
begin
 select * into s from public.bt_sessions where id=p_session for update;if not found then raise exception 'session missing';end if;
 if s.finished_at is not null then return jsonb_build_object('ok',true);end if;
 expected:=case when s.options->>'mode'='ai' then 1 else 2 end;
 if jsonb_typeof(p_stats)<>'array' or jsonb_array_length(p_stats)<>expected then raise exception 'invalid verified stats';end if;
 for v in select value from jsonb_array_elements(p_stats)loop
  insert into public.bt_scores(session_id,side,nickname,mode,difficulty,initial_rows,ai_level,survival_ms,score,lines)
  values(s.id,i,s.names[i+1],s.options->>'mode',s.options->>'difficulty',(s.options->>'rows')::integer,s.options->>'ai',(v->>'survival_ms')::bigint,(v->>'score')::bigint,(v->>'lines')::integer);i:=i+1;
 end loop;
 update public.bt_sessions set finished_at=clock_timestamp()where id=s.id;return jsonb_build_object('ok',true);
end $$;
revoke all on function public.bt_create_session(jsonb,text[]),public.bt_leaderboard(text,text,integer,text),public.bt_accept_result(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.bt_create_session(jsonb,text[])to authenticated;
grant execute on function public.bt_leaderboard(text,text,integer,text)to anon,authenticated;
grant execute on function public.bt_accept_result(uuid,jsonb)to service_role;
commit;
