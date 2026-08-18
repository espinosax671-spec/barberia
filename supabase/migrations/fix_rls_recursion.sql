-- ============================================================
-- FIX RECURSIÓN RLS — CitaBarber
-- Elimina llamadas a funciones dentro de políticas RLS
-- (causa: "infinite recursion detected in policy for relation")
-- Ejecutar en Supabase → SQL Editor. Es idempotente.
-- ============================================================

-- 1) Política SELECT de negocios SIN llamar a es_admin() ------
DROP POLICY IF EXISTS "negocios_select_authenticated" ON public.negocios;
CREATE POLICY "negocios_select_authenticated" ON public.negocios
  FOR SELECT TO authenticated
  USING (
    dueno_id = auth.uid()
    OR id IN (SELECT negocio_id FROM public.barberos WHERE auth_user_id = auth.uid())
  );

-- 2) Eliminar política UPDATE que usaba la función ------------
DROP POLICY IF EXISTS "negocios_update_admin" ON public.negocios;

-- 3) Eliminar política de admins que usaba la función ---------
DROP POLICY IF EXISTS "admins_select" ON public.admins;

-- 4) RPC para listar todas las barberías (solo super admin) ---
CREATE OR REPLACE FUNCTION public.obtener_negocios()
RETURNS SETOF public.negocios
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.negocios;
$$;

REVOKE ALL ON FUNCTION public.obtener_negocios() FROM public;
GRANT EXECUTE ON FUNCTION public.obtener_negocios() TO authenticated;

-- 5) Verificación: lista de políticas (opcional) --------------
-- SELECT tablename, policyname, cmd, roles, qual
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;