// ---------- Tabs ----------
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).style.display = 'block';
  });
});

// ---------- Preview URL en registro ----------
const subdomInput = document.getElementById('regSubdominio');
const urlPreview  = document.getElementById('urlPreview');

subdomInput.addEventListener('input', () => {
  const val = subdomInput.value.trim().toLowerCase();
  urlPreview.textContent = val ? `/reservar?b=${val}` : '/reservar';
});

// ---------- Redirigir si ya tiene sesión ----------
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    const { data: negocio } = await supabaseClient
      .from('negocios')
      .select('id')
      .eq('dueno_id', data.session.user.id)
      .maybeSingle();

    if (negocio) {
      window.location.href = 'panel.html';
    } else {
      window.location.href = 'confirmar.html';
    }
  }
})();

// ---------- LOGIN ----------
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg');
  msg.textContent = 'Verificando...';
  msg.className = 'form-msg info';

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email, password,
  });

  if (error) {
    msg.textContent = 'Correo o contraseña incorrectos.';
    msg.className = 'form-msg error';
    return;
  }

  // Verificar que tenga negocio
  const { data: negocio } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('dueno_id', data.user.id)
    .maybeSingle();

  if (!negocio) {
    // Recién se registró, ir a activar
    window.location.href = 'confirmar.html';
    return;
  }

  msg.textContent = '¡Bienvenido! Cargando tu panel...';
  msg.className = 'form-msg ok';

  setTimeout(() => {
    window.location.href = 'panel.html';
  }, 600);
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
  const subdominio = document.getElementById('regSubdominio').value.trim().toLowerCase();
  const password   = document.getElementById('regPassword').value;
  const password2  = document.getElementById('regPassword2').value;

  // Validaciones
  if (password !== password2) {
    msg.textContent = 'Las contraseñas no coinciden.';
    msg.className = 'form-msg error';
    return;
  }
  if (!/^[a-z0-9-]+$/.test(subdominio)) {
    msg.textContent = 'La URL solo puede tener minúsculas, números y guiones.';
    msg.className = 'form-msg error';
    return;
  }
  if (subdominio.length < 3) {
    msg.textContent = 'La URL debe tener al menos 3 caracteres.';
    msg.className = 'form-msg error';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  msg.textContent = 'Creando tu cuenta...';
  msg.className = 'form-msg info';

  // 1. Verificar subdominio disponible
  const { data: existente } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('subdominio', subdominio)
    .maybeSingle();

  if (existente) {
    msg.textContent = 'Esa URL ya está tomada. Prueba con otra.';
    msg.className = 'form-msg error';
    submitBtn.disabled = false;
    return;
  }

  // 2. Crear usuario en Auth
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre_negocio: nombre,
        subdominio: subdominio,
        telefono: telefono,
      },
    },
  });

  if (authError) {
    msg.textContent = 'Error: ' + authError.message;
    msg.className = 'form-msg error';
    submitBtn.disabled = false;
    return;
  }

  // 3. Como no requiere confirmación, va directo a activar la cuenta
  msg.textContent = '¡Cuenta creada! Activando tu barbería...';
  msg.className = 'form-msg ok';

  setTimeout(() => {
    window.location.href = 'confirmar.html';
  }, 800);
});
