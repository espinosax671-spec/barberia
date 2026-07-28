// ---------- Tabs ----------
document.querySelectorAll('.login-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.login-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).style.display = 'block';
  });
});

// ---------- Verificar sesión activa ----------
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    window.location.href = 'panel.html';
  }
})();

// ---------- LOGIN ----------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg');
  msg.textContent = 'Verificando...';
  msg.className = 'form-msg';

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    msg.textContent = 'Correo o contraseña incorrectos.';
    msg.classList.add('error');
    return;
  }

  // Verificar que tenga negocio registrado
  const { data: negocio } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('dueno_id', data.user.id)
    .maybeSingle();

  if (!negocio) {
    msg.textContent = 'No encontramos una barbería asociada a este correo.';
    msg.classList.add('error');
    await supabaseClient.auth.signOut();
    return;
  }

  window.location.href = 'panel.html';
});

// ---------- REGISTRO ----------
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('registerMsg');
  msg.textContent = '';
  msg.className = 'form-msg';

  const nombre     = document.getElementById('regNombre').value.trim();
  const email      = document.getElementById('regEmail').value.trim();
  const telefono   = document.getElementById('regTelefono').value.trim();
  const direccion  = document.getElementById('regDireccion').value.trim();
  const subdominio = document.getElementById('regSubdominio').value.trim().toLowerCase();
  const password   = document.getElementById('regPassword').value;
  const password2  = document.getElementById('regPassword2').value;

  // Validaciones
  if (password !== password2) {
    msg.textContent = 'Las contraseñas no coinciden.';
    msg.classList.add('error');
    return;
  }
  if (!/^[a-z0-9-]+$/.test(subdominio)) {
    msg.textContent = 'El nombre único solo puede tener letras minúsculas, números y guiones.';
    msg.classList.add('error');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  msg.textContent = 'Creando tu cuenta...';

  // 1. Verificar subdominio disponible
  const { data: existente } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('subdominio', subdominio)
    .maybeSingle();

  if (existente) {
    msg.textContent = 'Ese nombre ya está en uso. Prueba con otro.';
    msg.classList.add('error');
    submitBtn.disabled = false;
    return;
  }

  // 2. Crear usuario en Auth
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (authError) {
    msg.textContent = 'Error al crear la cuenta: ' + authError.message;
    msg.classList.add('error');
    submitBtn.disabled = false;
    return;
  }

  const userId = authData.user.id;

  // 3. Crear negocio
  const { error: negocioError } = await supabaseClient
    .from('negocios')
    .insert({
      dueno_id:           userId,
      nombre:             nombre,
      subdominio:         subdominio,
      direccion:          direccion,
      telefono_whatsapp:  telefono,
      estado_suscripcion: 'trial',
    });

  if (negocioError) {
    msg.textContent = 'Error al guardar tu barbería: ' + negocioError.message;
    msg.classList.add('error');
    submitBtn.disabled = false;
    return;
  }

  // 4. Obtener id del negocio recién creado
  const { data: negocioData } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('dueno_id', userId)
    .maybeSingle();

  if (negocioData) {
    // 5. Crear horarios por defecto
    const horarios = [
      { dia_semana: 1, abre_minuto: 540,  cierra_minuto: 1140 }, // Lunes
      { dia_semana: 2, abre_minuto: 540,  cierra_minuto: 1140 }, // Martes
      { dia_semana: 3, abre_minuto: 540,  cierra_minuto: 1140 }, // Miércoles
      { dia_semana: 4, abre_minuto: 540,  cierra_minuto: 1140 }, // Jueves
      { dia_semana: 5, abre_minuto: 540,  cierra_minuto: 1140 }, // Viernes
      { dia_semana: 6, abre_minuto: 540,  cierra_minuto: 1020 }, // Sábado
      { dia_semana: 0, abre_minuto: null, cierra_minuto: null  }, // Domingo cerrado
    ].map(h => ({ ...h, negocio_id: negocioData.id }));

    await supabaseClient.from('horarios').insert(horarios);

    // 6. Crear servicios por defecto
    const servicios = [
      { nombre: 'Corte clásico',      precio: 25000, duracion_min: 30, orden: 1 },
      { nombre: 'Arreglo de barba',   precio: 18000, duracion_min: 20, orden: 2 },
      { nombre: 'Combo corte + barba',precio: 38000, duracion_min: 50, orden: 3 },
      { nombre: 'Afeitado clásico',   precio: 22000, duracion_min: 25, orden: 4 },
      { nombre: 'Corte niño',         precio: 18000, duracion_min: 25, orden: 5 },
      { nombre: 'Diseño / Line up',   precio: 12000, duracion_min: 15, orden: 6 },
    ].map(s => ({ ...s, negocio_id: negocioData.id, activo: true }));

    await supabaseClient.from('servicios').insert(servicios);
  }

  // 7. Éxito
  msg.textContent = '¡Cuenta creada! Redirigiendo a tu panel...';
  msg.classList.add('ok');

  setTimeout(() => {
    window.location.href = 'panel.html';
  }, 1500);
});
