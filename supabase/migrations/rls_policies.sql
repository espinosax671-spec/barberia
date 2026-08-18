-- ============================================================
-- RLS (Row Level Security) — CitaBarber
-- Ejecutar en Supabase → SQL Editor con el rol postgres.
-- Es idempotente: puedes volver a ejecutarlo sin problemas.
-- ============================================================

-- 1) Habilitar RLS en todas las tablas ------------------------
ALTER TABLE public.negocios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbero_festivos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- NEGOCIOS
-- ============================================================
DROP POLICY IF EXISTS "negocios_select_publico" ON public.negocios;
CREATE POLICY "negocios_select_publico" ON public.negocios
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "negocios_insert_dueno" ON public.negocios;
CREATE POLICY "negocios_insert_dueno" ON public.negocios
  FOR INSERT TO authenticated
  WITH CHECK (dueno_id = auth.uid());

DROP POLICY IF EXISTS "negocios_update_dueno" ON public.negocios;
CREATE POLICY "negocios_update_dueno" ON public.negocios
  FOR UPDATE TO authenticated
  USING (dueno_id = auth.uid())
  WITH CHECK (dueno_id = auth.uid());

-- ============================================================
-- BARBEROS
-- ============================================================
DROP POLICY IF EXISTS "barberos_select_publico" ON public.barberos;
CREATE POLICY "barberos_select_publico" ON public.barberos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "barberos_insert_dueno" ON public.barberos;
CREATE POLICY "barberos_insert_dueno" ON public.barberos
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

DROP POLICY IF EXISTS "barberos_update_dueno_o_propio" ON public.barberos;
CREATE POLICY "barberos_update_dueno_o_propio" ON public.barberos
  FOR UPDATE TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid())
    OR auth_user_id = auth.uid()
  )
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid())
    OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS "barberos_delete_dueno" ON public.barberos;
CREATE POLICY "barberos_delete_dueno" ON public.barberos
  FOR DELETE TO authenticated
  USING (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

-- ============================================================
-- SERVICIOS
-- ============================================================
DROP POLICY IF EXISTS "servicios_select_publico" ON public.servicios;
CREATE POLICY "servicios_select_publico" ON public.servicios
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "servicios_insert_dueno" ON public.servicios;
CREATE POLICY "servicios_insert_dueno" ON public.servicios
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

DROP POLICY IF EXISTS "servicios_update_dueno" ON public.servicios;
CREATE POLICY "servicios_update_dueno" ON public.servicios
  FOR UPDATE TO authenticated
  USING (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()))
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

DROP POLICY IF EXISTS "servicios_delete_dueno" ON public.servicios;
CREATE POLICY "servicios_delete_dueno" ON public.servicios
  FOR DELETE TO authenticated
  USING (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

-- ============================================================
-- HORARIOS
-- ============================================================
DROP POLICY IF EXISTS "horarios_select_publico" ON public.horarios;
CREATE POLICY "horarios_select_publico" ON public.horarios
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "horarios_insert_dueno" ON public.horarios;
CREATE POLICY "horarios_insert_dueno" ON public.horarios
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

DROP POLICY IF EXISTS "horarios_update_dueno" ON public.horarios;
CREATE POLICY "horarios_update_dueno" ON public.horarios
  FOR UPDATE TO authenticated
  USING (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()))
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

-- ============================================================
-- BARBERO_FESTIVOS
-- ============================================================
DROP POLICY IF EXISTS "festivos_select_publico" ON public.barbero_festivos;
CREATE POLICY "festivos_select_publico" ON public.barbero_festivos
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "festivos_insert_dueno" ON public.barbero_festivos;
CREATE POLICY "festivos_insert_dueno" ON public.barbero_festivos
  FOR INSERT TO authenticated
  WITH CHECK (barbero_id IN (
    SELECT b.id FROM public.barberos b
    INNER JOIN public.negocios n ON n.id = b.negocio_id
    WHERE n.dueno_id = auth.uid()
  ));

DROP POLICY IF EXISTS "festivos_update_dueno" ON public.barbero_festivos;
CREATE POLICY "festivos_update_dueno" ON public.barbero_festivos
  FOR UPDATE TO authenticated
  USING (barbero_id IN (
    SELECT b.id FROM public.barberos b
    INNER JOIN public.negocios n ON n.id = b.negocio_id
    WHERE n.dueno_id = auth.uid()
  ))
  WITH CHECK (barbero_id IN (
    SELECT b.id FROM public.barberos b
    INNER JOIN public.negocios n ON n.id = b.negocio_id
    WHERE n.dueno_id = auth.uid()
  ));

DROP POLICY IF EXISTS "festivos_delete_dueno" ON public.barbero_festivos;
CREATE POLICY "festivos_delete_dueno" ON public.barbero_festivos
  FOR DELETE TO authenticated
  USING (barbero_id IN (
    SELECT b.id FROM public.barberos b
    INNER JOIN public.negocios n ON n.id = b.negocio_id
    WHERE n.dueno_id = auth.uid()
  ));

-- ============================================================
-- CITAS
-- ============================================================
-- Los clientes (anon) reservan y consultan disponibilidad.
DROP POLICY IF EXISTS "citas_insert_anon" ON public.citas;
CREATE POLICY "citas_insert_anon" ON public.citas
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "citas_select_anon" ON public.citas;
CREATE POLICY "citas_select_anon" ON public.citas
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "citas_select_dueno" ON public.citas;
CREATE POLICY "citas_select_dueno" ON public.citas
  FOR SELECT TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid())
    OR barbero_id IN (SELECT id FROM public.barberos WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "citas_update_dueno" ON public.citas;
CREATE POLICY "citas_update_dueno" ON public.citas
  FOR UPDATE TO authenticated
  USING (
    negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid())
    OR barbero_id IN (SELECT id FROM public.barberos WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid())
    OR barbero_id IN (SELECT id FROM public.barberos WHERE auth_user_id = auth.uid())
  );

-- ============================================================
-- NOTIFICACIONES
-- ============================================================
DROP POLICY IF EXISTS "notificaciones_select_dueno" ON public.notificaciones;
CREATE POLICY "notificaciones_select_dueno" ON public.notificaciones
  FOR SELECT TO authenticated
  USING (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

DROP POLICY IF EXISTS "notificaciones_update_dueno" ON public.notificaciones;
CREATE POLICY "notificaciones_update_dueno" ON public.notificaciones
  FOR UPDATE TO authenticated
  USING (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()))
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

DROP POLICY IF EXISTS "notificaciones_insert_dueno" ON public.notificaciones;
CREATE POLICY "notificaciones_insert_dueno" ON public.notificaciones
  FOR INSERT TO authenticated
  WITH CHECK (negocio_id IN (SELECT id FROM public.negocios WHERE dueno_id = auth.uid()));

-- ============================================================
-- AYUDA A DEPURAR (opcional)
-- ============================================================
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;