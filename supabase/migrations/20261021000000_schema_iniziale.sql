-- Quaderno di Vasca: tanks, readings, calibration, settings. Every row belongs to its owner (auth.uid()).
create table public.vasche (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numero int not null,
  nome text not null,
  alias text[] not null default '{}',
  volume_l numeric not null,
  superficie_m2 numeric,
  inoculo date,
  ceppo text not null default '',
  attiva boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner, numero)
);

create table public.rilevazioni (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  vasca_id uuid not null references public.vasche(id) on delete cascade,
  ts timestamptz not null default now(),
  ph numeric,
  temp numeric,
  livello_cm numeric,
  od750 numeric,
  diluizione numeric not null default 1,
  pc jsonb,
  micro jsonb,
  note text not null default '',
  fonte text not null default 'manuale' check (fonte in ('manuale', 'voce')),
  trascrizione text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rilevazioni_vasca_ts on public.rilevazioni (vasca_id, ts);
create index rilevazioni_owner on public.rilevazioni (owner);

create table public.calibrazione (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  od numeric not null,
  gl numeric not null,
  created_at timestamptz not null default now()
);
create index calibrazione_owner on public.calibrazione (owner);

create table public.impostazioni (
  owner uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- People allowed to use the AI functions (checked by the edge function)
create table public.ammessi (
  email text primary key
);

alter table public.vasche enable row level security;
alter table public.rilevazioni enable row level security;
alter table public.calibrazione enable row level security;
alter table public.impostazioni enable row level security;
alter table public.ammessi enable row level security;

create policy "proprie vasche" on public.vasche for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "proprie rilevazioni" on public.rilevazioni for all to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and exists (select 1 from public.vasche v where v.id = vasca_id and v.owner = (select auth.uid())));
create policy "propria calibrazione" on public.calibrazione for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "proprie impostazioni" on public.impostazioni for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
-- ammessi: no policies, readable only by the service role

create or replace function public.tocca_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger rilevazioni_updated before update on public.rilevazioni
  for each row execute function public.tocca_updated_at();

-- Creates the 11 greenhouse tanks for the calling user, only if they have none yet
create or replace function public.crea_vasche_iniziali() returns void
language plpgsql security invoker set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'non autenticato'; end if;
  if exists (select 1 from public.vasche where owner = auth.uid()) then return; end if;
  for n in 1..11 loop
    insert into public.vasche (numero, nome, volume_l)
    values (n, 'Vasca ' || n, case when n <= 2 then 1000 when n <= 4 then 4000 else 10000 end);
  end loop;
end $$;
revoke execute on function public.crea_vasche_iniziali() from anon, public;
grant execute on function public.crea_vasche_iniziali() to authenticated;

-- Private bucket for microscope photos, one folder per user
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create policy "foto proprie lettura" on storage.objects for select to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto proprie scrittura" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto proprie cancellazione" on storage.objects for delete to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = (select auth.uid())::text);
