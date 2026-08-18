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

// ——— Recuperación de contraseña ———
const recoveryUrl = new URL(window.location.href);
const recoveryCode = recoveryUrl.searchParams.get('code');
const esRecuperacion = recoveryUrl.hash.includes('type=recovery') || recoveryCode !== null;

async function manejarRecuperacion() {
  if (recoveryCode) {
    const { error } = await supabaseClient.auth.exchangeCodeForSession(recoveryCode);
    if (error) {
      mostrarError('El enlace expiró o no es válido. Solicita uno nuevo desde el login.');
      return;
    }
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    mostrarError('No pudimos verificar tu cuenta. Solicita un nuevo enlace.');
    return;
  }

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('recoveryView').style.display = 'block';

  document.getElementById('recoveryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('recoveryMsg');
    const pass1 = document.getElementById('newPass').value;
    const pass2 = document.getElementById('newPass2').value;

    if (pass1 !== pass2) {
      msg.textContent = 'Las contraseñas no coinciden.';
      msg.className = 'form-msg error';
      return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const { error } = await supabaseClient.auth.updateUser({ password: pass1 });

    if (error) {
      msg.textContent = 'Error: ' + error.message;
      msg.className = 'form-msg error';
      btn.disabled = false;
      btn.textContent = 'Actualizar contraseña';
      return;
    }

    document.getElementById('recoveryView').innerHTML =
      '<div class="check-email-icon" style="background: var(--success-soft, #dcf5e3); color: var(--success, #177d3f);">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</div>' +
      '<h2>Contraseña actualizada</h2>' +
      '<p>Ya puedes iniciar sesión con tu nueva contraseña.</p>' +
      '<p class="mt-4"><a href="login.html" class="btn btn-primary btn-lg">Ir al login</a></p>';
  });
}

if (esRecuperacion) {
  manejarRecuperacion();
} else {
  activarCuenta();
}
