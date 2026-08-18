-- ============================================================
-- SUPER ADMIN — CitaBarber
-- Control de acceso: aprobación de barberías por el administrador.
-- Ejecutar en Supabase → SQL Editor (rol postgres). Es idempotente.
-- ============================================================

-- 1) Tabla de super admins ------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- 2) Columna de aprobación en negocios -----------------------
ALTER TABLE public.negocios ADD COLUMN IF NOT EXISTS aprobado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.negocios.aprobado
  IS 'false = pendiente o bloqueada, true = aprobada por el super admin';

-- 3) Funciones helper (security definer) ----------------------
CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.aprobar_negocio(p_id uuid, p_aprobado boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.negocios
     SET aprobado = p_aprobado
   WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.es_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.aprobar_negocio(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.aprobar_negocio(uuid, boolean) TO authenticated;

-- 4) El dueño NO puede tocar la columna aprobado --------------
REVOKE UPDATE (aprobado) ON public.negocios FROM authenticated;

-- 5) Ajustes de políticas RLS en negocios ---------------------
DROP POLICY IF EXISTS "negocios_select_publico" ON public.negocios;
CREATE POLICY "negocios_select_publico" ON public.negocios
  FOR SELECT TO anon
  USING (aprobado = true);

DROP POLICY IF EXISTS "negocios_select_authenticated" ON public.negocios;
CREATE POLICY "negocios_select_authenticated" ON public.negocios
  FOR SELECT TO authenticated
  USING (
    dueno_id = auth.uid()
    OR public.es_admin()
    OR id IN (SELECT negocio_id FROM public.barberos WHERE auth_user_id = auth.uid())
  );

-- Nuevas barberías siempre nacen pendientes (aprobado = false)
DROP POLICY IF EXISTS "negocios_insert_dueno" ON public.negocios;
CREATE POLICY "negocios_insert_dueno" ON public.negocios
  FOR INSERT TO authenticated
  WITH CHECK (dueno_id = auth.uid() AND aprobado = false);

DROP POLICY IF EXISTS "negocios_update_admin" ON public.negocios;
CREATE POLICY "negocios_update_admin" ON public.negocios
  FOR UPDATE TO authenticated
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

-- 6) Solo se pueden crear citas en barberías aprobadas --------
DROP POLICY IF EXISTS "citas_insert_anon" ON public.citas;
CREATE POLICY "citas_insert_anon" ON public.citas
  FOR INSERT TO anon
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE aprobado = true)
  );

-- 7) Unicidad de subdominio (protege contra dobles registros) --
ALTER TABLE public.negocios
  DROP CONSTRAINT IF EXISTS negocios_subdominio_unique;
ALTER TABLE public.negocios
  ADD CONSTRAINT negocios_subdominio_unique UNIQUE (subdominio);

-- 8) Admins pueden listar otras cuentas admin -----------------
DROP POLICY IF EXISTS "admins_select" ON public.admins;
CREATE POLICY "admins_select" ON public.admins
  FOR SELECT TO authenticated
  USING (public.es_admin());

-- ============================================================
-- 9) REGISTRO DE TU CUENTA COMO SUPER ADMIN
-- ============================================================
INSERT INTO public.admins (auth_user_id)
VALUES ('6dc1b900-f239-403a-bf19-76a41985e440');
