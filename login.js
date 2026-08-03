// Toggle contraseña
document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    const eyeOpen = btn.querySelector('.eye-open');
    const eyeClosed = btn.querySelector('.eye-closed');

    if (input.type === 'password') {
      input.type = 'text';
      eyeOpen.style.display = 'none';
      eyeClosed.style.display = 'block';
    } else {
      input.type = 'password';
      eyeOpen.style.display = 'block';
      eyeClosed.style.display = 'none';
    }
  });
});

// Tabs
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).style.display = 'block';
  });
});

const subdomInput = document.getElementById('regSubdominio');
const urlPreview = document.getElementById('urlPreview');
subdomInput.addEventListener('input', () => {
  const val = subdomInput.value.trim().toLowerCase();
  urlPreview.textContent = val ? `/reservar?b=${val}` : '/reservar';
});

// Función para redirigir según tipo de usuario
async function redirectByUserType(userId, showError = null) {
  // Verificar si es dueño
  const { data: negocio } = await supabaseClient
    .from('negocios')
    .select('id')
    .eq('dueno_id', userId)
    .maybeSingle();

  if (negocio) {
    window.location.href = 'panel.html';
    return;
  }

  // Verificar si es barbero
  const { data: barbero } = await supabaseClient
    .from('barberos')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (barbero) {
    window.location.href = 'mi-agenda.html';
    return;
  }

  // Verificar si es un usuario reciente con metadata (dueño registrándose)
  const { data: userData } = await supabaseClient.auth.getUser();
  const meta = userData?.user?.user_metadata || {};

  if (meta.nombre_negocio && meta.subdominio) {
    // Es un dueño que acaba de registrarse
    window.location.href = 'confirmar.html';
    return;
  }

  // No es dueño ni barbero ni tiene registro pendiente
  // Cerrar sesión y mostrar error
  await supabaseClient.auth.signOut();

  if (showError) {
    showError('Esta cuenta no tiene acceso al sistema. Contacta al administrador de tu barbería.');
  } else {
    alert('Esta cuenta no tiene acceso al sistema. Contacta al administrador de tu barbería.');
  }
}

// Verificar sesión activa
(async () => {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) {
    await redirectByUserType(data.session.user.id);
  }
})();

// LOGIN
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('loginMsg');
  msg.textContent = 'Verificando...';
  msg.className = 'form-msg info';

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    msg.textContent = 'Correo o contraseña incorrectos.';
    msg.className = 'form-msg error';
    return;
  }

  msg.textContent = '¡Bienvenido! Cargando...';
  msg.className = 'form-msg ok';

  setTimeout(() => {
    redirectByUserType(data.user.id, (errorMsg) => {
      msg.textContent = errorMsg;
      msg.className = 'form-msg error';
    });
  }, 600);
});

// REGISTRO
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('registerMsg');
  msg.textContent = '';
  msg.className = 'form-msg';

  const nombre = document.getElementById('regNombre').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const telefono = document.getElementById('regTelefono').value.trim();
  const subdominio = document.getElementById('regSubdominio').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;

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

  const { data: existente } = await supabaseClient
    .from('negocios').select('id').eq('subdominio', subdominio).maybeSingle();

  if (existente) {
    msg.textContent = 'Esa URL ya está tomada.';
    msg.className = 'form-msg error';
    submitBtn.disabled = false;
    return;
  }

  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email, password,
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

  msg.textContent = '¡Cuenta creada! Activando...';
  msg.className = 'form-msg ok';
  setTimeout(() => { window.location.href = 'confirmar.html'; }, 800);
});
