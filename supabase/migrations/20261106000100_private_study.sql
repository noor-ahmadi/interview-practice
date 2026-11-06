begin;

create table public.study_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null check (version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.study_writes (
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  expected_version bigint not null,
  applied_version bigint not null,
  payload_hash text not null,
  primary key (owner_id, request_id)
);

alter table public.study_state enable row level security;
alter table public.study_writes enable row level security;
create policy "Read own study state" on public.study_state
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.study_state, public.study_writes from anon, authenticated;
grant select on public.study_state to authenticated;

-- One snapshot commits schedules, review logs, notes and session position together.
-- Clients cannot bypass the version check by writing the tables directly.
create function public.commit_study(p_request_id uuid, p_expected_version bigint, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  saved public.study_state%rowtype;
  receipt public.study_writes%rowtype;
  actual_version bigint := 0;
  fingerprint text;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_request_id is null or p_expected_version is null or p_expected_version < 0
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or p_payload->>'schemaVersion' is distinct from '1'
    or jsonb_typeof(p_payload->'schedules') is distinct from 'object'
    or jsonb_typeof(p_payload->'reviews') is distinct from 'array'
    or octet_length(p_payload::text) > 5242880 then
    raise exception 'Invalid study snapshot' using errcode = '22023';
  end if;
  fingerprint := md5(p_payload::text);
  -- Also serializes the first write, before a study_state row exists.
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  select * into receipt from public.study_writes where owner_id = actor and request_id = p_request_id;
  if found then
    if receipt.expected_version <> p_expected_version or receipt.payload_hash <> fingerprint then
      raise exception 'Request ID was reused for different data' using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'duplicate', 'version', receipt.applied_version);
  end if;
  select * into saved from public.study_state where owner_id = actor for update;
  if found then actual_version := saved.version; end if;
  if actual_version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', actual_version, 'payload', saved.payload);
  end if;
  insert into public.study_state (owner_id, version, payload) values (actor, actual_version + 1, p_payload)
    on conflict (owner_id) do update set version = excluded.version, payload = excluded.payload, updated_at = now();
  insert into public.study_writes values (actor, p_request_id, p_expected_version, actual_version + 1, fingerprint);
  return jsonb_build_object('status', 'saved', 'version', actual_version + 1);
end;
$$;
revoke all on function public.commit_study(uuid, bigint, jsonb) from public, anon;
grant execute on function public.commit_study(uuid, bigint, jsonb) to authenticated;

commit;
