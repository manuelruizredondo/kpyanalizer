-- ============================================================================
-- RLS hardening — kpyanalyzer (Supabase: lqgdrkwabcjrnnthlrmi)
-- ============================================================================
-- Estado previo: todas las tablas tenían políticas "planas"
--   USING (auth.uid() IS NOT NULL)  → cualquier usuario autenticado podía
--   leer, editar Y BORRAR los datos de cualquier otro.
--
-- Objetivo (endurecer SIN romper la app):
--   • SELECT  → sigue abierto a autenticados. El dashboard/historial/detalle
--               dependen de que todo el equipo vea todos los escaneos.
--   • INSERT  → solo puedes crear filas a tu nombre (created_by = auth.uid()).
--   • UPDATE  → sigue abierto a autenticados. Lo necesita "Recalcular scores"
--               (actualiza TODOS los escaneos del proyecto) y el reordenar
--               acciones. El riesgo de un UPDATE indebido es bajo (solo métricas).
--   • DELETE  → SOLO el autor o un super_admin. Ésta es la protección real:
--               evita que alguien destruya el trabajo de otro.
--
-- Es idempotente: borra las políticas actuales de estas tablas (sea cual sea su
-- nombre) y recrea el set. Ejecutar en el SQL Editor de Supabase.
-- ============================================================================

-- Helper: ¿el usuario actual es super_admin? (security definer para poder leer
-- profiles saltándose su propia RLS; search_path fijado por seguridad)
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

-- Borra TODAS las políticas actuales de las 4 tablas (agnóstico al nombre)
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('projects', 'scans', 'scan_details', 'action_items')
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Asegura RLS activo
alter table public.projects      enable row level security;
alter table public.scans         enable row level security;
alter table public.scan_details  enable row level security;
alter table public.action_items  enable row level security;

-- ---------------------------------------------------------------------------
-- PROJECTS
-- ---------------------------------------------------------------------------
create policy projects_select on public.projects
  for select using (auth.uid() is not null);
create policy projects_insert on public.projects
  for insert with check (created_by = auth.uid());
create policy projects_update on public.projects
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy projects_delete on public.projects
  for delete using (created_by = auth.uid() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- SCANS
-- ---------------------------------------------------------------------------
create policy scans_select on public.scans
  for select using (auth.uid() is not null);
create policy scans_insert on public.scans
  for insert with check (created_by = auth.uid());
create policy scans_update on public.scans
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy scans_delete on public.scans
  for delete using (created_by = auth.uid() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- SCAN_DETAILS (sin created_by propio: la pertenencia deriva del scan padre)
-- ---------------------------------------------------------------------------
create policy scan_details_select on public.scan_details
  for select using (auth.uid() is not null);
create policy scan_details_insert on public.scan_details
  for insert with check (auth.uid() is not null);
create policy scan_details_update on public.scan_details
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy scan_details_delete on public.scan_details
  for delete using (
    exists (
      select 1 from public.scans s
      where s.id = scan_details.scan_id
        and (s.created_by = auth.uid() or public.is_super_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- ACTION_ITEMS (UPDATE abierto: el reordenar toca sort_order de todos)
-- ---------------------------------------------------------------------------
create policy action_items_select on public.action_items
  for select using (auth.uid() is not null);
create policy action_items_insert on public.action_items
  for insert with check (created_by = auth.uid());
create policy action_items_update on public.action_items
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
create policy action_items_delete on public.action_items
  for delete using (created_by = auth.uid() or public.is_super_admin());

-- ============================================================================
-- Verificación rápida (opcional):
--   select tablename, cmd, policyname from pg_policies
--   where schemaname='public'
--     and tablename in ('projects','scans','scan_details','action_items')
--   order by tablename, cmd;
-- ============================================================================
