async function activarCuenta() {
  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    return mostrarError('No encontramos tu sesión. Vuelve a iniciar sesión.');
  }

  const user = sessionData.session.user;
  const meta = user.user_metadata || {};

  const { data: negocioExistente } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('dueno_id', user.id)
    .maybeSingle();

  if (negocioExistente) {
    setTimeout(() => window.location.href = 'panel.html', 500);
    return;
  }

  if (!meta.nombre_negocio || !meta.subdominio) {
    return mostrarError('Faltan datos del registro. Contáctanos para ayudarte.');
  }

  const trialFin = new Date();
  trialFin.setDate(trialFin.getDate() + TRIAL_DAYS);

  const { data: negocioCreado, error: negocioError } = await supabaseClient
    .from('negocios')
    .insert({
      dueno_id:            user.id,
      nombre:              meta.nombre_negocio,
      subdominio:          meta.subdominio,
      telefono_whatsapp:   meta.telefono || '',
      email_contacto:      user.email,
      estado_suscripcion:  'trial',
      trial_termina_en:    trialFin.toISOString(),
    })
    .select()
    .single();

  if (negocioError) {
    console.error(negocioError);
    return mostrarError('Error al crear tu barbería: ' + negocioError.message);
  }

  const negocioId = negocioCreado.id;

  const { data: barberoCreado, error: barberoError } = await supabaseClient
    .from('barberos')
    .insert({
      negocio_id: negocioId,
      nombre: 'Barbero 1',
      activo: true,
      orden: 1,
    })
    .select()
    .single();

  if (barberoError) {
    return mostrarError('Error al crear barbero: ' + barberoError.message);
  }

  const barberoId = barberoCreado.id;

  const horarios = [
    { dia_semana: 0, abre_minuto: null, cierra_minuto: null, abre_minuto_tarde: null, cierra_minuto_tarde: null },
    { dia_semana: 1, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
    { dia_semana: 2, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
    { dia_semana: 3, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
    { dia_semana: 4, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
    { dia_semana: 5, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
    { dia_semana: 6, abre_minuto: 480, cierra_minuto: 1020, abre_minuto_tarde: null, cierra_minuto_tarde: null },
  ].map(h => ({ ...h, negocio_id: negocioId, barbero_id: barberoId }));

  await supabaseClient.from('horarios').insert(horarios);

  const servicios = [
    { nombre: 'Corte clásico',       precio: 25000, duracion_min: 30, orden: 1 },
    { nombre: 'Arreglo de barba',    precio: 18000, duracion_min: 20, orden: 2 },
    { nombre: 'Combo corte + barba', precio: 38000, duracion_min: 50, orden: 3 },
    { nombre: 'Afeitado clásico',    precio: 22000, duracion_min: 25, orden: 4 },
    { nombre: 'Corte niño',          precio: 18000, duracion_min: 25, orden: 5 },
  ].map(s => ({
    ...s,
    negocio_id: negocioId,
    barbero_id: barberoId,
    activo: true,
  }));

  await supabaseClient.from('servicios').insert(servicios);

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('successView').style.display = 'block';
}

function mostrarError(msg) {
  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('errorView').style.display = 'block';
  document.getElementById('errorMsg').textContent = msg;
}

activarCuenta();
