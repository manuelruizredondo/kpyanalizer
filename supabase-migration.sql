-- =====================================================================
-- KPY CSS Analyzer - Supabase Migration
-- Base de datos para análisis de CSS y gestión de proyectos
-- =====================================================================

-- =====================================================================
-- 1. TABLA: profiles
-- Extiende los usuarios de auth.users con información adicional
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('super_admin', 'editor')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE public.profiles IS 'Perfiles de usuario extendidos desde auth.users';

-- =====================================================================
-- 2. TABLA: projects
-- Grupos de análisis CSS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE public.projects IS 'Proyectos que agrupan múltiples análisis CSS';

-- =====================================================================
-- 3. TABLA: scans
-- Cada análisis de CSS con métricas resumidas
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  line_count INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
  class_count INTEGER DEFAULT 0,
  id_count INTEGER DEFAULT 0,
  important_count INTEGER DEFAULT 0,
  variable_count INTEGER DEFAULT 0,
  total_selectors INTEGER DEFAULT 0,
  total_declarations INTEGER DEFAULT 0,
  unique_declarations INTEGER DEFAULT 0,
  reuse_ratio FLOAT DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE public.scans IS 'Análisis individuales de archivos CSS con métricas resumidas';

-- =====================================================================
-- 4. TABLA: scan_details
-- Almacena datos JSON completos para vista detallada
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.scan_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL UNIQUE REFERENCES public.scans(id) ON DELETE CASCADE,
  analysis_data JSONB DEFAULT '{}'::jsonb,
  w3c_validation JSONB,
  ds_coverage JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

COMMENT ON TABLE public.scan_details IS 'Datos JSON detallados de cada escaneo CSS';

-- =====================================================================
-- 5. ÍNDICES para optimización de consultas
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_scans_project_created
ON public.scans(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scans_created_by
ON public.scans(created_by);

-- =====================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_details ENABLE ROW LEVEL SECURITY;

-- Profiles: leer todos, actualizar solo el propio
CREATE POLICY "Usuarios autenticados pueden leer perfiles"
ON public.profiles FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Projects: CRUD completo para autenticados
CREATE POLICY "Usuarios autenticados pueden CRUD proyectos"
ON public.projects FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Scans: CRUD completo para autenticados
CREATE POLICY "Usuarios autenticados pueden CRUD escaneos"
ON public.scans FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Scan Details: CRUD completo para autenticados
CREATE POLICY "Usuarios autenticados pueden CRUD detalles de escaneos"
ON public.scan_details FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- =====================================================================
-- 7. TRIGGER: Auto-crear perfil cuando un usuario nuevo se registra
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'editor'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 8. TRIGGER: Auto-actualizar updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================================
