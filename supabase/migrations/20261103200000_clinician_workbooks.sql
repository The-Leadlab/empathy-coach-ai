-- Clinician (admin) workbooks — private drafts for Simon.
-- Do NOT apply to production until reviewed. Run manually in the SQL editor.

create table if not exists public.clinician_workbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled workbook',
  topic text not null default '',
  method text not null default '',
  audience text not null default 'adult client',
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinician_workbook_sections (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.clinician_workbooks(id) on delete cascade,
  position integer not null default 0,
  kind text not null default 'intro',
  title text not null default '',
  body_md text not null default '',
  sources jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  updated_at timestamptz not null default now()
);

create table if not exists public.clinician_workbook_messages (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.clinician_workbooks(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clinician_workbooks_owner_idx on public.clinician_workbooks (owner_id);
create index if not exists clinician_workbook_sections_wb_idx on public.clinician_workbook_sections (workbook_id, position);
create index if not exists clinician_workbook_messages_wb_idx on public.clinician_workbook_messages (workbook_id, created_at);

alter table public.clinician_workbooks enable row level security;
alter table public.clinician_workbook_sections enable row level security;
alter table public.clinician_workbook_messages enable row level security;

-- Owner admin CRUD
drop policy if exists "Admin owners manage workbooks" on public.clinician_workbooks;
create policy "Admin owners manage workbooks"
  on public.clinician_workbooks for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    and owner_id = auth.uid()
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    and owner_id = auth.uid()
  );

drop policy if exists "Admins read all workbooks" on public.clinician_workbooks;
create policy "Admins read all workbooks"
  on public.clinician_workbooks for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin owners manage sections" on public.clinician_workbook_sections;
create policy "Admin owners manage sections"
  on public.clinician_workbook_sections for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.clinician_workbooks w
      where w.id = workbook_id and w.owner_id = auth.uid()
    )
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.clinician_workbooks w
      where w.id = workbook_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "Admins read all sections" on public.clinician_workbook_sections;
create policy "Admins read all sections"
  on public.clinician_workbook_sections for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admin owners manage messages" on public.clinician_workbook_messages;
create policy "Admin owners manage messages"
  on public.clinician_workbook_messages for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.clinician_workbooks w
      where w.id = workbook_id and w.owner_id = auth.uid()
    )
  )
  with check (
    public.has_role(auth.uid(), 'admin')
    and exists (
      select 1 from public.clinician_workbooks w
      where w.id = workbook_id and w.owner_id = auth.uid()
    )
  );

drop policy if exists "Admins read all workbook messages" on public.clinician_workbook_messages;
create policy "Admins read all workbook messages"
  on public.clinician_workbook_messages for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.clinician_workbooks to authenticated;
grant select, insert, update, delete on public.clinician_workbook_sections to authenticated;
grant select, insert, update, delete on public.clinician_workbook_messages to authenticated;

notify pgrst, 'reload schema';
