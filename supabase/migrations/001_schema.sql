-- =========================================================
-- Imperium Odonto — estrutura do banco
-- Perfis: master (dono do sistema), admin (dono do consultório),
--         dentista, recepcao (sem acesso à parte clínica)
-- =========================================================

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  plano text not null default 'padrao',
  mensalidade numeric(10,2),
  vencimento date,
  settings jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete cascade,
  nome text not null,
  email text,
  role text not null check (role in ('master','admin','dentista','recepcao')),
  cro text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint profile_clinic_required check (role = 'master' or clinic_id is not null)
);
create index on public.profiles (clinic_id);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  nome text not null,
  telefone text not null default '',
  email text,
  data_nascimento date,
  cpf text,
  endereco text,
  alergias text,
  observacoes text,
  dentista_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.patients (clinic_id);

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  dente int,
  faces text[],
  tipo text not null,
  status text not null check (status in ('planejado','em_andamento','realizado')),
  data date not null,
  descricao text,
  valor numeric(10,2),
  retorno date,
  dentista_id uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.procedures (clinic_id);
create index on public.procedures (patient_id);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  dentes int[] not null default '{}',
  tipo text not null,
  data date not null,
  descricao text,
  imagens text[] not null default '{}',
  criado_em timestamptz not null default now()
);
create index on public.exams (clinic_id);
create index on public.exams (patient_id);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  dentista_id uuid references public.profiles(id) on delete set null,
  data_hora timestamp not null, -- horário local do consultório
  duracao_min int not null default 30,
  motivo text not null default '',
  status text not null default 'agendada' check (status in ('agendada','confirmada','concluida','faltou','cancelada')),
  observacoes text,
  criado_em timestamptz not null default now()
);
create index on public.appointments (clinic_id, data_hora);
create index on public.appointments (patient_id);

create table public.sent_messages (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  key text not null,
  em timestamptz not null default now(),
  primary key (clinic_id, key)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  clinic_id uuid references public.clinics(id) on delete cascade,
  user_id uuid,
  acao text not null,
  tabela text not null,
  registro_id uuid,
  em timestamptz not null default now()
);
create index on public.audit_log (clinic_id, em desc);

-- ---------------- funções de permissão ----------------
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  left join public.clinics c on c.id = p.clinic_id
  where p.id = (select auth.uid()) and p.ativo and (p.role = 'master' or c.ativo)
$$;

create function private.my_clinic() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.clinic_id from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.id = (select auth.uid()) and p.ativo and c.ativo
$$;

create function private.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_role() = 'master', false)
$$;

-- qualquer pessoa ativa do consultório
create function private.in_clinic(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_master() or (cid is not null and cid = private.my_clinic())
$$;

-- parte clínica (odontograma, procedimentos, exames): admin e dentista
create function private.is_clinical(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_master()
      or (cid is not null and cid = private.my_clinic() and private.my_role() in ('admin','dentista'))
$$;

create function private.is_clinic_admin(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_master()
      or (cid is not null and cid = private.my_clinic() and private.my_role() = 'admin')
$$;

-- pasta do arquivo no storage = id do consultório
create function private.is_clinical_folder(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_master()
      or (folder = private.my_clinic()::text and private.my_role() in ('admin','dentista'))
$$;

grant execute on all functions in schema private to authenticated;

-- usado pela tela de primeiro acesso (só diz se já existe conta master)
create function public.sistema_inicializado() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where role = 'master')
$$;
grant execute on function public.sistema_inicializado() to anon, authenticated;

-- ---------------- RLS ----------------
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.procedures enable row level security;
alter table public.exams enable row level security;
alter table public.appointments enable row level security;
alter table public.sent_messages enable row level security;
alter table public.audit_log enable row level security;

create policy clinics_select on public.clinics for select to authenticated
  using (private.is_master() or id = private.my_clinic());
create policy clinics_update on public.clinics for update to authenticated
  using (private.is_clinic_admin(id)) with check (private.is_clinic_admin(id));
create policy clinics_insert on public.clinics for insert to authenticated
  with check (private.is_master());
create policy clinics_delete on public.clinics for delete to authenticated
  using (private.is_master());

-- perfis só são criados/alterados pela função de servidor (gerenciar-usuarios)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.in_clinic(clinic_id));

create policy patients_select on public.patients for select to authenticated using (private.in_clinic(clinic_id));
create policy patients_insert on public.patients for insert to authenticated with check (private.in_clinic(clinic_id));
create policy patients_update on public.patients for update to authenticated using (private.in_clinic(clinic_id)) with check (private.in_clinic(clinic_id));
create policy patients_delete on public.patients for delete to authenticated using (private.is_clinic_admin(clinic_id));

create policy procedures_all on public.procedures for all to authenticated
  using (private.is_clinical(clinic_id)) with check (private.is_clinical(clinic_id));
create policy exams_all on public.exams for all to authenticated
  using (private.is_clinical(clinic_id)) with check (private.is_clinical(clinic_id));
create policy appointments_all on public.appointments for all to authenticated
  using (private.in_clinic(clinic_id)) with check (private.in_clinic(clinic_id));

create policy sent_select on public.sent_messages for select to authenticated using (private.in_clinic(clinic_id));
create policy sent_insert on public.sent_messages for insert to authenticated with check (private.in_clinic(clinic_id));

create policy audit_select on public.audit_log for select to authenticated using (private.is_clinic_admin(clinic_id));

-- só o master mexe em plano/mensalidade/bloqueio
create function private.guard_clinic_billing() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_master() and (select auth.uid()) is not null then
    new.ativo := old.ativo;
    new.plano := old.plano;
    new.mensalidade := old.mensalidade;
    new.vencimento := old.vencimento;
  end if;
  return new;
end $$;
create trigger clinics_guard before update on public.clinics
  for each row execute function private.guard_clinic_billing();

-- registro de quem alterou o quê (LGPD)
create function private.audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
  rid uuid;
begin
  if tg_op = 'DELETE' then cid := old.clinic_id; rid := old.id;
  else cid := new.clinic_id; rid := new.id; end if;
  insert into public.audit_log (clinic_id, user_id, acao, tabela, registro_id)
  values (cid, (select auth.uid()), lower(tg_op), tg_table_name, rid);
  return null;
end $$;

create trigger audit_patients after insert or update or delete on public.patients for each row execute function private.audit();
create trigger audit_procedures after insert or update or delete on public.procedures for each row execute function private.audit();
create trigger audit_exams after insert or update or delete on public.exams for each row execute function private.audit();
create trigger audit_appointments after insert or update or delete on public.appointments for each row execute function private.audit();

-- ---------------- arquivos de exames (raio-X) ----------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exames', 'exames', false, 10485760, array['image/jpeg','image/png','image/webp']);

create policy exames_select on storage.objects for select to authenticated
  using (bucket_id = 'exames' and private.is_clinical_folder((storage.foldername(name))[1]));
create policy exames_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exames' and private.is_clinical_folder((storage.foldername(name))[1]));
create policy exames_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exames' and private.is_clinical_folder((storage.foldername(name))[1]));

-- ---------------- tempo real (2 pessoas usando ao mesmo tempo) ----------------
alter publication supabase_realtime add table public.patients, public.procedures, public.exams, public.appointments, public.sent_messages;

-- ---------------- consultório inicial ----------------
insert into public.clinics (nome) values ('Imperium Odonto');
