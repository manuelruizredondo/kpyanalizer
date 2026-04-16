-- =====================================================================
-- KPY CSS Analyzer - Asignación de roles
-- Ejecutar DESPUÉS de haber creado los 3 usuarios desde Authentication
-- =====================================================================

-- Manu → super_admin
UPDATE public.profiles
SET role = 'super_admin', full_name = 'Manu'
WHERE email = 'manuelruizredondo@gmail.com';

-- Pablo → editor
UPDATE public.profiles
SET role = 'editor', full_name = 'Pablo'
WHERE email = 'bascoylopez@gmail.com';

-- Sergio → editor
UPDATE public.profiles
SET role = 'editor', full_name = 'Sergio'
WHERE email = 'seggio@gmail.com';

-- Verificar que los roles se asignaron correctamente
SELECT email, full_name, role FROM public.profiles;
