let barbero = null;
let negocio = null;
let citas = [];
let currentFilter = 'hoy';

function minutesToLabel(mins) {
  if (mins === null || mins === undefined) return '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? 'p.m.' : 'a.m.';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
function formatCOP(n) { return '$' + n.toLocaleString('es-CO'); }
function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function endOfWeekStr() {
  const d = new Date();
  const diff = 7 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = sessionData.session.user.id;
  const userEmail = sessionData.session.user.email;

  const { data: barberoData, error } = await supabaseClient
    .from('barberos')
    .select('*, negocios(nombre, subdominio)')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error || !barberoData) {
    alert('No encontramos tu cuenta de barbero. Serás redirigido al login.');
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  barbero = barberoData;
  negocio = barberoData.negocios;

  document.getElementById('barberoNombre').textContent = barbero.nombre;
  document.getElementById('negocioNombreLabel').textContent = negocio.nombre;
  document.getElementById('userEmail').textContent = userEmail;

  const initials = getInitials(barbero.nombre);
  document.getElementById('avatarInitials').textContent = initials;
  if (barbero.foto_url) {
    const img = document.getElementById('avatarImg');
    img.src = barbero.foto_url;
    img.style.display = 'block';
    document.getElementById('avatarInitials').style.display = 'none';
  }

  loadPerfilForm();

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('agendaView').style.display = 'block';

  await loadCitas();
  initRealtime();
}

function initRealtime() {
  supabaseClient
    .channel('mis-citas-' + barbero.id)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'citas', filter: `barbero_id=eq.${barbero.id}` },
      (payload) => {
        loadCitas();
        if (payload.eventType === 'INSERT') {
          showToast(`Nueva cita: ${payload.new.nombre_cliente}`);
          playNotifSound();
        }
      }
    )
    .subscribe();
}

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
  });
});

async function loadCitas() {
  const { data, error } = await supabaseClient
    .from('citas').select('*')
    .eq('barbero_id', barbero.id)
    .in('estado', ['confirmada', 'completada', 'cancelada'])
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) { console.error(error); return; }

  citas = data || [];
  renderCitas();
}

function renderCitas() {
  const list = document.getElementById('citasList');
  const hoy = todayStr();
  const manana = tomorrowStr();
  const finSemana = endOfWeekStr();

  const counts = {
    hoy: citas.filter(c => c.fecha === hoy && c.estado === 'confirmada').length,
    manana: citas.filter(c => c.fecha === manana && c.estado === 'confirmada').length,
    semana: citas.filter(c => c.fecha >= hoy && c.fecha <= finSemana && c.estado === 'confirmada').length,
    todas: citas.filter(c => c.estado === 'confirmada').length,
  };

  Object.keys(counts).forEach(k => {
    const el = document.getElementById('c-' + k);
    if (el) el.textContent = counts[k];
  });
  document.getElementById('citasCount').textContent = counts.hoy;

  let filtradas = citas;
  if (currentFilter === 'hoy') {
    filtradas = citas.filter(c => c.fecha === hoy);
  } else if (currentFilter === 'manana') {
    filtradas = citas.filter(c => c.fecha === manana);
  } else if (currentFilter === 'semana') {
    filtradas = citas.filter(c => c.fecha >= hoy && c.fecha <= finSemana);
  }

  if (!filtradas.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <h3>No hay citas en esta vista</h3>
        <p>Cuando tengas citas confirmadas aparecerán aquí.</p>
      </div>`;
    return;
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let siguienteId = null;
  const citasHoyConfirmadas = filtradas
    .filter(c => c.fecha === hoy && c.estado === 'confirmada' && c.hora_inicio >= nowMinutes)
    .sort((a, b) => a.hora_inicio - b.hora_inicio);
  if (citasHoyConfirmadas.length > 0) {
    siguienteId = citasHoyConfirmadas[0].id;
  }

  list.innerHTML = '';
  filtradas.forEach(cita => {
    const card = document.createElement('div');
    card.className = 'cita-card ' + (cita.estado || '');
    if (cita.id === siguienteId) card.classList.add('siguiente');

    const fechaLabel = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    const telFormatted = cita.telefono.replace(/\s/g, '');
    const waLink = `https://wa.me/57${telFormatted}?text=${encodeURIComponent(`Hola ${cita.nombre_cliente}, te contacto de ${negocio.nombre}`)}`;

    card.innerHTML = `
      <div class="cita-hora-badge">${minutesToLabel(cita.hora_inicio)}</div>
      <div class="cita-info">
        <div class="cita-info-top">
          <strong>${cita.nombre_cliente}</strong>
          <span class="cita-badge ${cita.estado}">${cita.estado}</span>
        </div>
        <span>${cita.servicio_nombre} · ${formatCOP(cita.precio)} · ${cita.duracion} min</span>
        <span>${fechaLabel}</span>
        <span>Tel: <a href="${waLink}" target="_blank">${cita.telefono}</a></span>
      </div>
      <div class="cita-actions">
        ${cita.estado === 'confirmada' ? `
          <button class="complete-btn" data-id="${cita.id}">Completar</button>
          <button class="cancel-btn" data-id="${cita.id}">Cancelar</button>
        ` : ''}
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.complete-btn').forEach(b =>
    b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'completada')));
  list.querySelectorAll('.cancel-btn').forEach(b =>
    b.addEventListener('click', () => updateEstadoCita(b.dataset.id, 'cancelada')));
}

async function updateEstadoCita(id, estado) {
  const { error } = await supabaseClient.from('citas').update({ estado }).eq('id', id);
  if (error) return showToast('Error al actualizar', 'error');
  showToast(estado === 'completada' ? 'Cita completada' : 'Cita cancelada');
  loadCitas();
}

document.getElementById('filterBar').addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-chip')) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  renderCitas();
});

function loadPerfilForm() {
  document.getElementById('perfilNombre').value = barbero.nombre || '';
  document.getElementById('perfilTelefono').value = barbero.telefono || '';
  document.getElementById('perfilEmail').value = barbero.email || '';

  const fotoImg = document.getElementById('fotoImg');
  const fotoPlaceholder = document.getElementById('fotoPlaceholder');
  const removeBtn = document.getElementById('removeFotoBtn');

  fotoPlaceholder.textContent = getInitials(barbero.nombre);

  if (barbero.foto_url) {
    fotoImg.src = barbero.foto_url;
    fotoImg.style.display = 'block';
    fotoPlaceholder.style.display = 'none';
    removeBtn.style.display = 'inline-flex';
  } else {
    fotoImg.style.display = 'none';
    fotoPlaceholder.style.display = 'block';
    removeBtn.style.display = 'none';
  }
}

document.getElementById('perfilForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  const nombre = document.getElementById('perfilNombre').value.trim();
  const telefono = document.getElementById('perfilTelefono').value.trim();
  const email = document.getElementById('perfilEmail').value.trim().toLowerCase();

  try {
    // Actualizar nombre y teléfono en la tabla barberos
    const { error: updateError } = await supabaseClient
      .from('barberos')
      .update({ nombre, telefono })
      .eq('id', barbero.id);

    if (updateError) {
      showToast('Error al guardar datos', 'error');
      submitBtn.disabled = false;
      return;
    }

    barbero.nombre = nombre;
    barbero.telefono = telefono;
    document.getElementById('barberoNombre').textContent = nombre;
    document.getElementById('avatarInitials').textContent = getInitials(nombre);
    document.getElementById('fotoPlaceholder').textContent = getInitials(nombre);

    // Si el email cambió, actualizarlo en Auth y en tabla
    const emailAnterior = (barbero.email || '').toLowerCase();
    if (email !== emailAnterior) {
      // Actualizar email en Supabase Auth
      const { error: authError } = await supabaseClient.auth.updateUser({ email });

      if (authError) {
        showToast('Error al cambiar email: ' + authError.message, 'error');
        submitBtn.disabled = false;
        return;
      }

      // Actualizar email en tabla barberos
      const { error: emailError } = await supabaseClient
        .from('barberos')
        .update({ email })
        .eq('id', barbero.id);

      if (emailError) {
        showToast('Email de auth cambiado pero error al guardar en tabla', 'error');
        submitBtn.disabled = false;
        return;
      }

      barbero.email = email;
      showToast('Datos guardados. Revisa tu nuevo correo para confirmar el cambio de email.');
    } else {
      showToast('Datos guardados');
    }
  } catch (err) {
    console.error(err);
    showToast('Error inesperado', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('uploadFotoBtn').addEventListener('click', () => {
  document.getElementById('fotoInput').click();
});

document.getElementById('fotoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Máx 2MB', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Solo imágenes', 'error'); return; }

  showToast('Subiendo foto...');

  const fileExt = file.name.split('.').pop();
  const fileName = `foto-${Date.now()}.${fileExt}`;
  const filePath = `${barbero.id}/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('barberos').upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) return showToast('Error: ' + uploadError.message, 'error');

  const { data: urlData } = supabaseClient.storage.from('barberos').getPublicUrl(filePath);
  const fotoUrl = urlData.publicUrl;

  const { error: updateError } = await supabaseClient
    .from('barberos').update({ foto_url: fotoUrl }).eq('id', barbero.id);

  if (updateError) return showToast('Error al guardar', 'error');

  barbero.foto_url = fotoUrl;

  document.getElementById('fotoImg').src = fotoUrl;
  document.getElementById('fotoImg').style.display = 'block';
  document.getElementById('fotoPlaceholder').style.display = 'none';
  document.getElementById('removeFotoBtn').style.display = 'inline-flex';

  const avatarImg = document.getElementById('avatarImg');
  avatarImg.src = fotoUrl;
  avatarImg.style.display = 'block';
  document.getElementById('avatarInitials').style.display = 'none';

  showToast('Foto actualizada');
});

document.getElementById('removeFotoBtn').addEventListener('click', async () => {
  if (!confirm('¿Quitar tu foto?')) return;
  const { error } = await supabaseClient
    .from('barberos').update({ foto_url: null }).eq('id', barbero.id);
  if (error) return showToast('Error', 'error');
  barbero.foto_url = null;
  document.getElementById('fotoImg').style.display = 'none';
  document.getElementById('fotoPlaceholder').style.display = 'block';
  document.getElementById('removeFotoBtn').style.display = 'none';
  document.getElementById('avatarImg').style.display = 'none';
  document.getElementById('avatarInitials').style.display = 'block';
  showToast('Foto eliminada');
});

document.getElementById('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass1 = document.getElementById('newPassword').value;
  const pass2 = document.getElementById('newPassword2').value;

  if (pass1 !== pass2) {
    showToast('Las contraseñas no coinciden', 'error');
    return;
  }
  if (pass1.length < 6) {
    showToast('Mínimo 6 caracteres', 'error');
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: pass1 });

  if (error) {
    showToast('Error: ' + error.message, 'error');
    return;
  }

  document.getElementById('newPassword').value = '';
  document.getElementById('newPassword2').value = '';
  showToast('Contraseña actualizada');
});

init();
