-- Run once in a NEW Supabase project's SQL Editor. No secrets belong in this file.
begin;
create table if not exists public.np_sessions (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 nickname text not null check(char_length(nickname) between 2 and 12 and nickname ~ '^[A-Za-z0-9一-鿿]+$'),
 mode integer not null check(mode in (3,4,5)), board integer[] not null,
 created_at timestamptz not null default clock_timestamp(), started_at timestamptz,
 first_move integer, finished_at timestamptz
);
create index if not exists np_session_owner_created on public.np_sessions(owner_id,created_at);
create table if not exists public.np_scores (
 id uuid primary key default gen_random_uuid(), session_id uuid not null unique references public.np_sessions(id),
 nickname text not null check(char_length(nickname) between 2 and 12 and nickname ~ '^[A-Za-z0-9一-鿿]+$'),
 mode integer not null check(mode in (3,4,5)), time_ms bigint not null check(time_ms between 1 and 86400000),
 moves integer not null check(moves between 1 and 10000), finished_at timestamptz not null default clock_timestamp()
);
-- Also upgrades existing 3x3/4x4 installations without deleting any data.
alter table public.np_sessions drop constraint if exists np_sessions_mode_check;
alter table public.np_sessions add constraint np_sessions_mode_check check(mode in (3,4,5));
alter table public.np_scores drop constraint if exists np_scores_mode_check;
alter table public.np_scores add constraint np_scores_mode_check check(mode in (3,4,5));
create index if not exists np_score_best on public.np_scores(mode,lower(nickname),time_ms,moves,finished_at);
alter table public.np_sessions enable row level security;
alter table public.np_scores enable row level security;
-- Intentionally NO table policies: all direct table access is denied.
-- Narrow SECURITY DEFINER RPCs enforce ownership, legal moves and allowed fields.
revoke all on public.np_sessions,public.np_scores from anon,authenticated;

create or replace function public.np_neighbor(a integer,b integer,n integer) returns boolean
language sql immutable set search_path='' as $$select abs(a%n-b%n)+abs(a/n-b/n)=1$$;
create or replace function public.np_shuffle(n integer) returns integer[]
language plpgsql volatile set search_path='' as $$
declare b integer[]; z integer; prev integer; k integer; j integer; opts integer[]; attempt integer; dist integer;
begin
 if n not in (3,4,5) then raise exception 'invalid mode'; end if;
 for attempt in 1..200 loop
  select array_agg(i order by i) into b from generate_series(1,n*n-1) i; b:=b||array[0];z:=n*n-1;prev:=-1;
  for k in 1..(case when n=3 then 100 when n=4 then 320 else 700 end) loop
   select array_agg(i) into opts from generate_series(0,n*n-1) i where i<>prev and public.np_neighbor(i,z,n);
   j:=opts[1+floor(random()*cardinality(opts))::integer];b[z+1]:=b[j+1];b[j+1]:=0;prev:=z;z:=j;
  end loop;
  dist:=0;for k in 1..n*n loop if b[k]>0 then dist:=dist+abs((k-1)%n-(b[k]-1)%n)+abs((k-1)/n-(b[k]-1)/n);end if;end loop;
  if dist >= (case when n=3 then 14 when n=4 then 32 else 60 end) then return b;end if;
 end loop;raise exception 'shuffle retry required';
end $$;
create or replace function public.np_create_session(p_nickname text,p_mode integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); b integer[]; old integer[]; sid uuid;
begin
 if uid is null then raise exception 'anonymous sign-in required';end if;
 if p_mode not in (3,4,5) or p_mode is null or p_nickname is null or char_length(p_nickname) not between 2 and 12 or p_nickname !~ '^[A-Za-z0-9一-鿿]+$' then raise exception 'invalid nickname or mode';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if (select count(*) from public.np_sessions where owner_id=uid and created_at>clock_timestamp()-interval '1 minute')>=3
 or (select count(*) from public.np_sessions where owner_id=uid and created_at>clock_timestamp()-interval '1 hour')>=20 then raise exception 'too many challenges; try again later';end if;
 select board into old from public.np_sessions where owner_id=uid and mode=p_mode order by created_at desc limit 1;
 loop b:=public.np_shuffle(p_mode);exit when old is null or b<>old;end loop;
 insert into public.np_sessions(owner_id,nickname,mode,board) values(uid,p_nickname,p_mode,b) returning id into sid;
 return jsonb_build_object('session_id',sid,'board',b);
end $$;
create or replace function public.np_begin(p_session uuid,p_first integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.np_sessions; z integer;
begin
 select * into s from public.np_sessions where id=p_session and owner_id=auth.uid() for update;
 if not found then raise exception 'session not found';end if;
 if s.finished_at is not null or s.created_at<clock_timestamp()-interval '24 hours' then raise exception 'session expired';end if;
 if s.started_at is not null then if p_first<>s.first_move then raise exception 'invalid first move';end if;return jsonb_build_object('started_at',s.started_at);end if;
 z:=array_position(s.board,0)-1;
 if p_first is null or p_first<0 or p_first>=s.mode*s.mode or not public.np_neighbor(p_first,z,s.mode) then raise exception 'illegal first move';end if;
 update public.np_sessions set started_at=clock_timestamp(),first_move=p_first where id=s.id returning started_at into s.started_at;
 return jsonb_build_object('started_at',s.started_at);
end $$;
create or replace function public.np_leaderboard(p_mode integer) returns table(rank bigint,nickname text,time_ms bigint,moves integer,finished_at timestamptz)
language sql stable security definer set search_path='' as $$
 with best as(select distinct on(lower(s.nickname)) s.* from public.np_scores s where s.mode=p_mode and p_mode in(3,4,5)
 order by lower(s.nickname),s.time_ms,s.moves,s.finished_at,s.id), ranked as(
 select row_number()over(order by b.time_ms,b.moves,b.finished_at,b.id) as rank,b.nickname,b.time_ms,b.moves,b.finished_at from best b)
 select * from ranked order by rank limit 100
$$;
create or replace function public.np_finish(p_session uuid,p_moves integer[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.np_sessions; b integer[]; goal integer[]; z integer; i integer; v integer; ms bigint; stamp timestamptz; result public.np_scores; place bigint;
begin
 if auth.uid() is null then raise exception 'sign-in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into s from public.np_sessions where id=p_session and owner_id=auth.uid() for update;
 if not found then raise exception 'session not found';end if;
 select * into result from public.np_scores where session_id=s.id;
 if not found then
  stamp:=clock_timestamp();
  if s.started_at is null or s.created_at<stamp-interval '24 hours' then raise exception 'session not started or expired';end if;
  if p_moves is null or coalesce(cardinality(p_moves),0) not between 1 and 10000 or array_ndims(p_moves)<>1 or array_lower(p_moves,1)<>1 or p_moves[1] is distinct from s.first_move then raise exception 'invalid move log';end if;
  b:=s.board;z:=array_position(b,0)-1;
  foreach i in array p_moves loop
   if i is null or i<0 or i>=s.mode*s.mode or not public.np_neighbor(i,z,s.mode) then raise exception 'illegal move';end if;
   v:=b[i+1];b[z+1]:=v;b[i+1]:=0;z:=i;
  end loop;
  select array_agg(k order by k) into goal from generate_series(1,s.mode*s.mode-1) k;goal:=goal||array[0];
  if b<>goal then raise exception 'puzzle not solved';end if;
  ms:=floor(extract(epoch from (stamp-s.started_at))*1000)::bigint;
  if ms<cardinality(p_moves)*40 or ms>86400000 then raise exception 'implausible elapsed time';end if;
  if exists(select 1 from public.np_sessions where owner_id=s.owner_id and finished_at>stamp-interval '5 seconds') then raise exception 'submit rate exceeded';end if;
  insert into public.np_scores(session_id,nickname,mode,time_ms,moves,finished_at) values(s.id,s.nickname,s.mode,ms,cardinality(p_moves),stamp) returning * into result;
  update public.np_sessions set finished_at=stamp where id=s.id;
 end if;
 -- Rank ALL best scores, even if this nickname is outside the public TOP 100.
 with best as(select distinct on(lower(q.nickname)) q.* from public.np_scores q where q.mode=s.mode order by lower(q.nickname),q.time_ms,q.moves,q.finished_at,q.id), ranked as(
 select lower(q.nickname) as nick,row_number()over(order by q.time_ms,q.moves,q.finished_at,q.id) as rn from best q)
 select rn into place from ranked where nick=lower(s.nickname);
 return jsonb_build_object('rank',place,'time_ms',result.time_ms,'moves',result.moves);
end $$;
revoke all on function public.np_neighbor(integer,integer,integer),public.np_shuffle(integer),public.np_create_session(text,integer),public.np_begin(uuid,integer),public.np_finish(uuid,integer[]),public.np_leaderboard(integer) from public,anon,authenticated;
grant execute on function public.np_create_session(text,integer),public.np_begin(uuid,integer),public.np_finish(uuid,integer[]) to authenticated;
grant execute on function public.np_leaderboard(integer) to anon,authenticated;
commit;
