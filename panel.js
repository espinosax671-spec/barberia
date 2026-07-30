let negocio = null;
let barberos = [];
let citas = [];
let currentBarberoServicios = null;
let currentBarberoHorarios = null;
let currentFilter = 'todas';

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
function minutesToHHMM(mins) {
  if (mins === null || mins === undefined) return '';
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const HORARIOS_DEFAULT = [
  { dia_semana: 0, abre_minuto: null, cierra_minuto: null, abre_minuto_tarde: null, cierra_minuto_tarde: null },
  { dia_semana: 1, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
  { dia_semana: 2, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
  { dia_semana: 3, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
  { dia_semana: 4, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
  { dia_semana: 5, abre_minuto: 480, cierra_minuto: 720, abre_minuto_tarde: 840, cierra_minuto_tarde: 1140 },
  { dia_semana: 6, abre_minuto: 480, cierra_minuto: 1020, abre_minuto_tarde: null, cierra_minuto_tarde: null },
];

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function init() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  if (!sessionData.session) {
    window.location.href = 'login.html';
    return;
  }

  const userId = sessionData.session.user.id;
  const userEmail = sessionData.session.user.email;

  const { data: negocioData, error } = await supabaseClient
    .from('negocios')
    .select('*')
    .eq('dueno_id', userId)
    .maybeSingle();

  if (error || !negocioData) {
    alert('No encontramos tu negocio. Serás redirigido al login.');
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }

  negocio = negocioData;

  document.getElementById('negocioNombre').textContent = negocio.nombre;
  document.getElementById('userEmail').textContent = userEmail;

  if (negocio.logo_url) {
    const headerLogo = document.getElementById('headerLogo');
    headerLogo.src = negocio.logo_url;
    headerLogo.style.display = 'block';
  }

  const badge = document.getElementById('planBadge');
  badge.style.display = 'none';

  const tiendaUrl = `${APP_BASE_URL}/reservar.html?b=${negocio.subdominio}`;
  document.getElementById('tiendaUrl').textContent = tiendaUrl.replace(/^https?:\/\//, '');
  document.getElementById('viewShopBtn').href = tiendaUrl;
  const shareMsg = encodeURIComponent(`¡Agenda tu cita en ${negocio.nombre}! 💈\n${tiendaUrl}`);
  document.getElementById('shareWhatsappBtn').href = `https://wa.me/?text=${shareMsg}`;

  document.getElementById('copyUrlBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(tiendaUrl);
    showToast('URL copiada');
  });

  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('panelView').style.display = 'block';

  await loadBarberos();
  await loadCitas();
  loadNegocioForm();
  loadNotificaciones();

  initRealtime();
}

function initRealtime() {
  supabaseClient
    .channel('citas-' + negocio.id)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'citas', filter: `negocio_id=eq.${negocio.id}` },
      (payload) => {
        loadCitas();
        if (payload.eventType === 'INSERT') {
          showToast(`🔔 Nueva cita: ${payload.new.nombre_cliente}`);
          playNotifSound();
        }
      }
    )
    .subscribe();

  supabaseClient
    .channel('notif-' + negocio.id)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `negocio_id=eq.${negocio.id}` },
      () => loadNotificaciones()
    )
    .subscribe();

  supabaseClient
    .channel('barberos-' + negocio.id)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'barberos', filter: `negocio_id=eq.${negocio.id}` },
      () => loadBarberos()
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

    if (btn.dataset.tab === 'servicios') loadServicios();
    if (btn.dataset.tab === 'horarios') loadHorarios();
    if (btn.dataset.tab === 'citas') loadCitas();
  });
});

async function loadBarberos() {
  const { data, error } = await supabaseClient
    .from('barberos').select('*')
    .eq('negocio_id', negocio.id)
    .order('orden', { ascending: true });

  if (error) { console.error(error); return; }

  barberos = data || [];

  if (barberos.length > 0) {
    if (!currentBarberoServicios) currentBarberoServicios = barberos[0].id;
    if (!currentBarberoHorarios) currentBarberoHorarios = barberos[0].id;
  }

  renderBarberosList();
  renderBarberosSelectors();
}

function renderBarberosList() {
  const list = document.getElementById('barberosList');
  if (!barberos.length) {
    list.innerHTML = `
      <div class="empty-state">
        <h3>No hay barberos</h3>
        <p>Agrega tu primer barbero para empezar a recibir citas.</p>
      </div>`;
    return;
  }
  list.innerHTML = '';
  barberos.forEach(b => {
    const card = document.createElement('div');
    card.className = 'barbero-card' + (b.activo ? '' : ' inactivo');
    const avatarHtml = b.foto_url
      ? `<div class="barbero-avatar has-photo"><img src="${b.foto_url}" alt="${b.nombre}"></div>`
      : `<div class="barbero-avatar">${getInitials(b.nombre)}</div>`;

    card.innerHTML = `
      ${avatarHtml}
      <div class="barbero-card-info">
        <strong>${b.nombre}</strong>
        <span>${b.telefono || 'Sin teléfono'}</span>
        ${b.email ? `<span class="barbero-email">${b.email}</span>` : ''}
      </div>
      <div class="barbero-card-actions">
        <button class="edit-btn">Editar</button>
        <button class="toggle-btn">${b.activo ? 'Desactivar' : 'Activar'}</button>
        <button class="delete-btn">Eliminar</button>
      </div>
    `;
    card.querySelector('.edit-btn').addEventListener('click', () => openBarberoModal(b));
    card.querySelector('.toggle-btn').addEventListener('click', async () => {
      await supabaseClient.from('barberos').update({ activo: !b.activo }).eq('id', b.id);
      loadBarberos();
    });
    card.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm(`¿Eliminar al barbero "${b.nombre}"? Se borrarán también sus horarios y servicios.`)) return;
      await supabaseClient.from('barberos').delete().eq('id', b.id);
      showToast('Barbero eliminado');
      loadBarberos();
    });
    list.appendChild(card);
  });
}

function renderBarberosSelectors() {
  ['serviciosBarberoSelector', 'horariosBarberoSelector'].forEach(selectorId => {
    const container = document.getElementById(selectorId);
    container.innerHTML = '';
    barberos.forEach(b => {
      const chip = document.createElement('button');
      chip.className = 'barbero-chip';
      chip.textContent = b.nombre;
      const activeId = selectorId === 'serviciosBarberoSelector' ? currentBarberoServicios : currentBarberoHorarios;
      if (b.id === activeId) chip.classList.add('active');
      chip.addEventListener('click', () => {
        if (selectorId === 'serviciosBarberoSelector') {
          currentBarberoServicios = b.id;
          loadServicios();
        } else {
          currentBarberoHorarios = b.id;
          loadHorarios();
        }
      });
      container.appendChild(chip);
    });
  });
}

let editingBarberoId = null;

document.getElementById('addBarberoBtn').addEventListener('click', () => openBarberoModal(null));

function openBarberoModal(barbero) {
  editingBarberoId = barbero ? barbero.id : null;
  document.getElementById('barberoModalTitle').textContent = barbero ? 'Editar barbero' : 'Nuevo barbero';
  document.getElementById('modalBarberoNombre').value = barbero ? barbero.nombre : '';
  document.getElementById('modalBarberoTel').value = barbero ? barbero.telefono || '' : '';
  document.getElementById('modalBarberoEmail').value = barbero ? barbero.email || '' : '';
  document.getElementById('modalBarberoPass').value = '';

  const authFields = document.getElementById('authFields');
  if (barbero && barbero.auth_user_id) {
    authFields.style.display = 'none';
  } else {
    authFields.style.display = 'block';
  }

  document.getElementById('barberoModal').style.display = 'flex';
}

document.getElementById('cancelBarberoBtn').addEventListener('click', () => {
  document.getElementById('barberoModal').style.display = 'none';
});

document.getElementById('barberoForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBarberoBtn');
  submitBtn.disabled = true;

  const nombre = document.getElementById('modalBarberoNombre').value.trim();
  const telefono = document.getElementById('modalBarberoTel').value.trim();
  const email = document.getElementById('modalBarberoEmail').value.trim();
  const password = document.getElementById('modalBarberoPass').value;

  try {
    if (editingBarberoId) {
      await supabaseClient.from('barberos').update({ nombre, telefono }).eq('id', editingBarberoId);
      showToast('Barbero actualizado');
      document.getElementById('barberoModal').style.display = 'none';
      loadBarberos();
    } else {
      let authUserId = null;

      if (email && password) {
        if (password.length < 6) {
          showToast('La contraseña debe tener al menos 6 caracteres', 'error');
          submitBtn.disabled = false;
          return;
        }

        const { data: currentSession } = await supabaseClient.auth.getSession();

        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email,
          password,
        });

        if (authError) {
          showToast('Error al crear cuenta: ' + authError.message, 'error');
          submitBtn.disabled = false;
          return;
        }

        authUserId = authData.user.id;

        if (currentSession.session) {
          await supabaseClient.auth.setSession({
            access_token: currentSession.session.access_token,
            refresh_token: currentSession.session.refresh_token,
          });
        }
      }

      const { data: nuevoBarbero, error: barberoError } = await supabaseClient
        .from('barberos')
        .insert({
          negocio_id: negocio.id,
          nombre,
          telefono,
          email: email || null,
          auth_user_id: authUserId,
          activo: true,
          orden: barberos.length + 1,
        })
        .select().single();

      if (barberoError) {
        showToast('Error al crear barbero: ' + barberoError.message, 'error');
        submitBtn.disabled = false;
        return;
      }

      const horarios = HORARIOS_DEFAULT.map(h => ({
        ...h, negocio_id: negocio.id, barbero_id: nuevoBarbero.id,
      }));
      await supabaseClient.from('horarios').insert(horarios);

      let serviciosBase = [];
      if (barberos.length > 0) {
        const { data: serviciosExistentes } = await supabaseClient
          .from('servicios')
          .select('nombre, precio, duracion_min, orden')
          .eq('negocio_id', negocio.id)
          .eq('barbero_id', barberos[0].id)
          .eq('activo', true)
          .order('orden', { ascending: true });
        serviciosBase = serviciosExistentes || [];
      }

      if (serviciosBase.length === 0) {
        serviciosBase = [
          { nombre: 'Corte clásico',       precio: 25000, duracion_min: 30, orden: 1 },
          { nombre: 'Arreglo de barba',    precio: 18000, duracion_min: 20, orden: 2 },
          { nombre: 'Combo corte + barba', precio: 38000, duracion_min: 50, orden: 3 },
          { nombre: 'Afeitado clásico',    precio: 22000, duracion_min: 25, orden: 4 },
          { nombre: 'Corte niño',          precio: 18000, duracion_min: 25, orden: 5 },
        ];
      }

      const serviciosParaCrear = serviciosBase.map(s => ({
        nombre: s.nombre, precio: s.precio, duracion_min: s.duracion_min, orden: s.orden,
        negocio_id: negocio.id, barbero_id: nuevoBarbero.id, activo: true,
      }));
      await supabaseClient.from('servicios').insert(serviciosParaCrear);

      document.getElementById('barberoModal').style.display = 'none';

      if (email && password) {
        mostrarCredenciales(nombre, email, password);
      } else {
        showToast('Barbero creado');
      }

      loadBarberos();
    }
  } catch (err) {
    console.error(err);
    showToast('Error inesperado', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

function mostrarCredenciales(nombre, email, password) {
  const loginUrl = `${APP_BASE_URL}/login.html`;
  const box = document.getElementById('credencialesBox');
  box.innerHTML = `
    <div class="cred-row"><span>Nombre</span><span>${nombre}</span></div>
    <div class="cred-row"><span>Link</span><span>${loginUrl}</span></div>
    <div class="cred-row"><span>Email</span><span>${email}</span></div>
    <div class="cred-row"><span>Contraseña</span><span>${password}</span></div>
  `;

  const mensaje = `Hola ${nombre}! Ya tienes acceso a tu panel en ${negocio.nombre}.\n\nEntra aquí: ${loginUrl}\nEmail: ${email}\nContraseña: ${password}\n\n(Puedes cambiar la contraseña después)`;

  document.getElementById('copyCredencialesBtn').onclick = () => {
    navigator.clipboard.writeText(mensaje);
    showToast('Mensaje copiado');
  };

  document.getElementById('closeCredencialesBtn').onclick = () => {
    document.getElementById('credencialesModal').style.display = 'none';
  };

  document.getElementById('credencialesModal').style.display = 'flex';
}

async function loadCitas() {
  const { data, error } = await supabaseClient
    .from('citas').select('*, barberos(nombre)')
    .eq('negocio_id', negocio.id)
    .order('fecha', { ascending: false })
    .order('hora_inicio', { ascending: true });

  if (error) { console.error(error); return; }
  citas = data || [];
  renderCitas();
}

function renderCitas() {
  const list = document.getElementById('citasList');
  const hoy = todayStr();

  const counts = {
    todas: citas.length,
    hoy: citas.filter(c => c.fecha === hoy).length,
    confirmada: citas.filter(c => c.estado === 'confirmada').length,
    completada: citas.filter(c => c.estado === 'completada').length,
    cancelada: citas.filter(c => c.estado === 'cancelada').length,
  };

  Object.keys(counts).forEach(k => {
    const el = document.getElementById('c-' + k);
    if (el) el.textContent = counts[k];
  });
  document.getElementById('citasCount').textContent = counts.confirmada;

  let filtradas = citas;
  if (currentFilter === 'hoy') filtradas = citas.filter(c => c.fecha === hoy);
  else if (currentFilter !== 'todas') filtradas = citas.filter(c => c.estado === currentFilter);

  if (!filtradas.length) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <h3>No hay citas en esta vista</h3>
        <p>Cuando alguien reserve una cita, aparecerá aquí.</p>
      </div>`;
    return;
  }

  list.innerHTML = '';
  filtradas.forEach(cita => {
    const card = document.createElement('div');
    card.className = 'cita-card ' + (cita.estado || '');
    const fechaLabel = new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const barberoNombre = cita.barberos ? cita.barberos.nombre : 'Sin barbero';
    card.innerHTML = `
      <div class="cita-info">
        <div class="cita-info-top">
          <strong>${cita.nombre_cliente}</strong>
          <span class="cita-badge ${cita.estado}">${cita.estado}</span>
        </div>
        <span>${cita.servicio_nombre} · ${formatCOP(cita.precio)} · con ${barberoNombre}</span>
        <span>${fechaLabel} · ${minutesToLabel(cita.hora_inicio)}</span>
        <span>Tel: ${cita.telefono}</span>
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

document.getElementById('citasFilterBar').addEventListener('click', (e) => {
  if (!e.target.classList.contains('filter-chip')) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  e.target.classList.add('active');
  currentFilter = e.target.dataset.filter;
  renderCitas();
});

async function loadServicios() {
  if (!currentBarberoServicios) return;
  renderBarberosSelectors();

  const { data, error } = await supabaseClient
    .from('servicios').select('*')
    .eq('negocio_id', negocio.id)
    .eq('barbero_id', currentBarberoServicios)
    .order('orden', { ascending: true });

  const list = document.getElementById('serviciosList');
  if (error) { list.innerHTML = '<p class="hint">Error.</p>'; return; }

  if (!data.length) {
    list.innerHTML = `<div class="empty-state"><h3>Sin servicios</h3><p>Agrega servicios.</p></div>`;
    return;
  }

  list.innerHTML = '';
  data.forEach(s => list.appendChild(renderServicioRow(s)));
}

function renderServicioRow(s) {
  const row = document.createElement('div');
  row.className = 'servicio-row' + (s.activo ? '' : ' inactivo');
  row.innerHTML = `
    <input type="text" value="${s.nombre}" data-field="nombre" placeholder="Nombre">
    <input type="number" value="${s.precio}" data-field="precio" placeholder="Precio">
    <input type="number" value="${s.duracion_min}" data-field="duracion_min" placeholder="Minutos">
    <div class="row-actions">
      <button class="save-btn">Guardar</button>
      <button class="toggle-btn">${s.activo ? 'Ocultar' : 'Mostrar'}</button>
      <button class="delete-btn">Eliminar</button>
    </div>
  `;
  row.querySelector('.save-btn').addEventListener('click', async () => {
    const nombre = row.querySelector('[data-field="nombre"]').value.trim();
    const precio = parseInt(row.querySelector('[data-field="precio"]').value, 10);
    const duracion_min = parseInt(row.querySelector('[data-field="duracion_min"]').value, 10);
    await supabaseClient.from('servicios').update({ nombre, precio, duracion_min }).eq('id', s.id);
    showToast('Servicio actualizado');
    loadServicios();
  });
  row.querySelector('.toggle-btn').addEventListener('click', async () => {
    await supabaseClient.from('servicios').update({ activo: !s.activo }).eq('id', s.id);
    loadServicios();
  });
  row.querySelector('.delete-btn').addEventListener('click', async () => {
    if (!confirm(`¿Eliminar "${s.nombre}"?`)) return;
    await supabaseClient.from('servicios').delete().eq('id', s.id);
    showToast('Servicio eliminado');
    loadServicios();
  });
  return row;
}

document.getElementById('addServicioBtn').addEventListener('click', async () => {
  if (!currentBarberoServicios) { showToast('Selecciona un barbero primero', 'error'); return; }
  await supabaseClient.from('servicios').insert({
    negocio_id: negocio.id, barbero_id: currentBarberoServicios,
    nombre: 'Nuevo servicio', precio: 0, duracion_min: 30, activo: true, orden: 999,
  });
  loadServicios();
});

async function loadHorarios() {
  if (!currentBarberoHorarios) return;
  renderBarberosSelectors();

  const { data, error } = await supabaseClient
    .from('horarios').select('*')
    .eq('negocio_id', negocio.id)
    .eq('barbero_id', currentBarberoHorarios)
    .order('dia_semana', { ascending: true });

  const list = document.getElementById('horariosList');
  if (error) { list.innerHTML = '<p class="hint">Error.</p>'; return; }

  list.innerHTML = '';
  data.forEach(h => {
    const abierto = h.abre_minuto !== null;
    const tieneTarde = h.abre_minuto_tarde !== null;
    const row = document.createElement('div');
    row.className = 'horario-row';
    row.dataset.id = h.id;
    row.innerHTML = `
      <div class="horario-header">
        <span class="dia-nombre">${DIAS[h.dia_semana]}</span>
        <label><input type="checkbox" class="abierto-check" ${abierto ? 'checked' : ''}> Abierto</label>
      </div>
      <div class="horario-turnos" ${abierto ? '' : 'style="display:none;"'}>
        <div class="turno">
          <span class="turno-label">Mañana</span>
          <label>Desde <input type="time" class="abre-input" value="${minutesToHHMM(h.abre_minuto) || '08:00'}"></label>
          <label>Hasta <input type="time" class="cierra-input" value="${minutesToHHMM(h.cierra_minuto) || '12:00'}"></label>
        </div>
        <label class="turno-toggle">
          <input type="checkbox" class="tarde-check" ${tieneTarde ? 'checked' : ''}>
          Tiene turno tarde (con descanso al mediodía)
        </label>
        <div class="turno turno-tarde" ${tieneTarde ? '' : 'style="display:none;"'}>
          <span class="turno-label">Tarde</span>
          <label>Desde <input type="time" class="abre-tarde-input" value="${minutesToHHMM(h.abre_minuto_tarde) || '14:00'}"></label>
          <label>Hasta <input type="time" class="cierra-tarde-input" value="${minutesToHHMM(h.cierra_minuto_tarde) || '19:00'}"></label>
        </div>
      </div>
    `;
    const check = row.querySelector('.abierto-check');
    const turnos = row.querySelector('.horario-turnos');
    const tardeCheck = row.querySelector('.tarde-check');
    const turnoTarde = row.querySelector('.turno-tarde');

    check.addEventListener('change', () => {
      turnos.style.display = check.checked ? 'block' : 'none';
    });
    tardeCheck.addEventListener('change', () => {
      turnoTarde.style.display = tardeCheck.checked ? 'flex' : 'none';
    });
    list.appendChild(row);
  });
}

document.getElementById('guardarHorariosBtn').addEventListener('click', async () => {
  const filas = document.querySelectorAll('#horariosList .horario-row');
  const actualizaciones = [];
  filas.forEach(row => {
    const abierto = row.querySelector('.abierto-check').checked;
    const tieneTarde = row.querySelector('.tarde-check').checked;
    const abre = abierto ? hhmmToMinutes(row.querySelector('.abre-input').value) : null;
    const cierra = abierto ? hhmmToMinutes(row.querySelector('.cierra-input').value) : null;
    const abreTarde = (abierto && tieneTarde) ? hhmmToMinutes(row.querySelector('.abre-tarde-input').value) : null;
    const cierraTarde = (abierto && tieneTarde) ? hhmmToMinutes(row.querySelector('.cierra-tarde-input').value) : null;
    actualizaciones.push(
      supabaseClient.from('horarios').update({
        abre_minuto: abre, cierra_minuto: cierra,
        abre_minuto_tarde: abreTarde, cierra_minuto_tarde: cierraTarde,
      }).eq('id', row.dataset.id)
    );
  });
  const resultados = await Promise.all(actualizaciones);
  const huboError = resultados.some(r => r.error);
  showToast(huboError ? 'Error al guardar' : 'Horarios actualizados', huboError ? 'error' : 'success');
});

function loadNegocioForm() {
  document.getElementById('campoNombre').value = negocio.nombre || '';
  document.getElementById('campoDescripcion').value = negocio.descripcion || '';
  document.getElementById('campoDireccion').value = negocio.direccion || '';
  document.getElementById('campoCiudad').value = negocio.ciudad || '';
  document.getElementById('campoTelefono').value = negocio.telefono_whatsapp || '';

  const logoImg = document.getElementById('logoImg');
  const logoPlaceholder = document.getElementById('logoPlaceholder');
  const removeBtn = document.getElementById('removeLogoBtn');

  if (negocio.logo_url) {
    logoImg.src = negocio.logo_url;
    logoImg.style.display = 'block';
    logoPlaceholder.style.display = 'none';
    removeBtn.style.display = 'inline-flex';
  } else {
    logoImg.style.display = 'none';
    logoPlaceholder.style.display = 'block';
    removeBtn.style.display = 'none';
  }
}

document.getElementById('negocioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = document.getElementById('campoNombre').value.trim();
  const descripcion = document.getElementById('campoDescripcion').value.trim();
  const direccion = document.getElementById('campoDireccion').value.trim();
  const ciudad = document.getElementById('campoCiudad').value.trim();
  const telefono_whatsapp = document.getElementById('campoTelefono').value.trim();

  const { error } = await supabaseClient
    .from('negocios')
    .update({ nombre, descripcion, direccion, ciudad, telefono_whatsapp })
    .eq('id', negocio.id);

  if (error) return showToast('Error al guardar', 'error');
  negocio.nombre = nombre;
  document.getElementById('negocioNombre').textContent = nombre;
  showToast('Datos actualizados');
});

document.getElementById('uploadLogoBtn').addEventListener('click', () => {
  document.getElementById('logoInput').click();
});

document.getElementById('logoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Máx 2MB', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Solo imágenes', 'error'); return; }

  showToast('Subiendo logo...');
  const fileExt = file.name.split('.').pop();
  const fileName = `logo-${Date.now()}.${fileExt}`;
  const filePath = `${negocio.id}/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('logos').upload(filePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) return showToast('Error: ' + uploadError.message, 'error');

  const { data: urlData } = supabaseClient.storage.from('logos').getPublicUrl(filePath);
  const logoUrl = urlData.publicUrl;

  const { error: updateError } = await supabaseClient
    .from('negocios').update({ logo_url: logoUrl }).eq('id', negocio.id);

  if (updateError) return showToast('Error al guardar', 'error');

  negocio.logo_url = logoUrl;
  document.getElementById('logoImg').src = logoUrl;
  document.getElementById('logoImg').style.display = 'block';
  document.getElementById('logoPlaceholder').style.display = 'none';
  document.getElementById('removeLogoBtn').style.display = 'inline-flex';
  const headerLogo = document.getElementById('headerLogo');
  headerLogo.src = logoUrl;
  headerLogo.style.display = 'block';
  showToast('Logo actualizado');
});

document.getElementById('removeLogoBtn').addEventListener('click', async () => {
  if (!confirm('¿Quitar el logo?')) return;
  const { error } = await supabaseClient
    .from('negocios').update({ logo_url: null }).eq('id', negocio.id);
  if (error) return showToast('Error', 'error');
  negocio.logo_url = null;
  document.getElementById('logoImg').style.display = 'none';
  document.getElementById('logoPlaceholder').style.display = 'block';
  document.getElementById('removeLogoBtn').style.display = 'none';
  document.getElementById('headerLogo').style.display = 'none';
  showToast('Logo eliminado');
});

async function loadNotificaciones() {
  const { data } = await supabaseClient
    .from('notificaciones').select('*')
    .eq('negocio_id', negocio.id)
    .order('creado_en', { ascending: false }).limit(20);

  const noLeidas = (data || []).filter(n => !n.leida).length;
  const badge = document.getElementById('notifBadge');
  if (noLeidas > 0) {
    badge.textContent = noLeidas;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
  renderNotifDropdown(data || []);
}

function renderNotifDropdown(notifs) {
  const dropdown = document.getElementById('notifDropdown');
  dropdown.innerHTML = `
    <div class="notif-dropdown-header">
      <strong>Notificaciones</strong>
      ${notifs.some(n => !n.leida) ? '<button class="notif-mark-read" id="markAllReadBtn">Marcar leídas</button>' : ''}
    </div>`;
  if (!notifs.length) {
    dropdown.innerHTML += '<div class="notif-empty">No tienes notificaciones</div>';
    return;
  }
  notifs.forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item' + (n.leida ? '' : ' no-leida');
    const fecha = new Date(n.creado_en).toLocaleString('es-CO', {
      day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit'
    });
    item.innerHTML = `<strong>${n.titulo}</strong><p>${n.mensaje || ''}</p><time>${fecha}</time>`;
    dropdown.appendChild(item);
  });

  const markAllBtn = document.getElementById('markAllReadBtn');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await supabaseClient.from('notificaciones')
        .update({ leida: true })
        .eq('negocio_id', negocio.id).eq('leida', false);
      loadNotificaciones();
    });
  }
}

document.getElementById('notifBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const dd = document.getElementById('notifDropdown');
  const wasHidden = dd.style.display === 'none';
  dd.style.display = wasHidden ? 'block' : 'none';
  if (wasHidden) { loadCitas(); loadNotificaciones(); }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#notifBtn') && !e.target.closest('#notifDropdown')) {
    document.getElementById('notifDropdown').style.display = 'none';
  }
});

// ========== ESTADÍSTICAS ==========
let currentPeriod = 'hoy';
let chartCitasDia = null;
let chartEstados = null;

document.getElementById('openStatsBtn').addEventListener('click', () => {
  document.getElementById('statsModal').style.display = 'flex';
  loadEstadisticas();
});

document.getElementById('closeStatsBtn').addEventListener('click', () => {
  document.getElementById('statsModal').style.display = 'none';
});

document.querySelectorAll('.stats-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.stats-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    loadEstadisticas();
  });
});

function getDateRange(period) {
  const now = new Date();
  const hoy = now.toISOString().slice(0, 10);
  let start = hoy;

  if (period === 'semana') {
    const d = new Date(now);
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
    d.setDate(d.getDate() - dayOfWeek);
    start = d.toISOString().slice(0, 10);
  } else if (period === 'mes') {
    start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  } else if (period === '30dias') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    start = d.toISOString().slice(0, 10);
  }

  return { start, end: hoy };
}

async function loadEstadisticas() {
  const { start, end } = getDateRange(currentPeriod);
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: citasPeriodo } = await supabaseClient
    .from('citas')
    .select('*, barberos(nombre)')
    .eq('negocio_id', negocio.id)
    .gte('fecha', start)
    .lte('fecha', end);

  const citasP = citasPeriodo || [];
  const completadas = citasP.filter(c => c.estado === 'completada');
  const canceladas = citasP.filter(c => c.estado === 'cancelada');
  const confirmadas = citasP.filter(c => c.estado === 'confirmada');
  const citasHoy = citasP.filter(c => c.fecha === hoy);

  const ingresos = completadas.reduce((sum, c) => sum + (c.precio || 0), 0);
  document.getElementById('kpiIngresos').textContent = formatCOP(ingresos);
  document.getElementById('kpiCompletadas').textContent = completadas.length;
  document.getElementById('kpiHoy').textContent = citasHoy.length;

  const totalFinalizadas = completadas.length + canceladas.length;
  const asistencia = totalFinalizadas > 0
    ? Math.round((completadas.length / totalFinalizadas) * 100)
    : 0;
  document.getElementById('kpiAsistencia').textContent = asistencia + '%';

  renderChartCitasDia();
  renderChartEstados(completadas.length, canceladas.length, confirmadas.length);
  renderTopBarberos(completadas);
  renderTopServicios(completadas);
  renderTopHoras(citasP);
}

async function renderChartCitasDia() {
  const dias = [];
  const labels = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().slice(0, 10));
    labels.push(d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }));
  }

  const { data } = await supabaseClient
    .from('citas')
    .select('fecha, estado')
    .eq('negocio_id', negocio.id)
    .in('estado', ['completada', 'confirmada'])
    .in('fecha', dias);

  const counts = dias.map(dia => (data || []).filter(c => c.fecha === dia).length);

  const canvas = document.getElementById('chartCitasDia');
  if (chartCitasDia) chartCitasDia.destroy();

  chartCitasDia = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Citas',
        data: counts,
        backgroundColor: 'rgba(40, 86, 214, 0.85)',
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

function renderChartEstados(comp, can, conf) {
  const canvas = document.getElementById('chartEstados');
  if (chartEstados) chartEstados.destroy();

  if (comp + can + conf === 0) {
    canvas.parentElement.innerHTML = '<p class="stats-empty">Sin datos en este período</p>';
    return;
  }

  chartEstados = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Completadas', 'Canceladas', 'Pendientes'],
      datasets: [{
        data: [comp, can, conf],
        backgroundColor: ['#157a3d', '#c8202f', '#2856d6'],
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 12 } } }
      }
    }
  });
}

function renderTopBarberos(completadas) {
  const list = document.getElementById('rankingBarberos');
  const conteo = {};

  completadas.forEach(c => {
    const nombre = c.barberos ? c.barberos.nombre : 'Sin barbero';
    if (!conteo[nombre]) conteo[nombre] = { citas: 0, ingresos: 0 };
    conteo[nombre].citas++;
    conteo[nombre].ingresos += c.precio || 0;
  });

  const ranking = Object.entries(conteo)
    .sort((a, b) => b[1].ingresos - a[1].ingresos)
    .slice(0, 5);

  if (!ranking.length) {
    list.innerHTML = '<p class="stats-empty">Sin datos aún</p>';
    return;
  }

  list.innerHTML = ranking.map(([nombre, stats], i) => `
    <div class="ranking-item">
      <div class="ranking-position">${i + 1}</div>
      <div class="ranking-info">
        <strong>${nombre}</strong>
        <span>${stats.citas} ${stats.citas === 1 ? 'cita' : 'citas'}</span>
      </div>
      <div class="ranking-value">${formatCOP(stats.ingresos)}</div>
    </div>
  `).join('');
}

function renderTopServicios(completadas) {
  const list = document.getElementById('rankingServicios');
  const conteo = {};

  completadas.forEach(c => {
    const nombre = c.servicio_nombre || 'Sin nombre';
    if (!conteo[nombre]) conteo[nombre] = { veces: 0, total: 0 };
    conteo[nombre].veces++;
    conteo[nombre].total += c.precio || 0;
  });

  const ranking = Object.entries(conteo)
    .sort((a, b) => b[1].veces - a[1].veces)
    .slice(0, 5);

  if (!ranking.length) {
    list.innerHTML = '<p class="stats-empty">Sin datos aún</p>';
    return;
  }

  list.innerHTML = ranking.map(([nombre, stats], i) => `
    <div class="ranking-item">
      <div class="ranking-position">${i + 1}</div>
      <div class="ranking-info">
        <strong>${nombre}</strong>
        <span>${stats.veces} ${stats.veces === 1 ? 'vez' : 'veces'}</span>
      </div>
      <div class="ranking-value">${formatCOP(stats.total)}</div>
    </div>
  `).join('');
}

function renderTopHoras(citasP) {
  const list = document.getElementById('rankingHoras');
  const conteo = {};

  citasP.forEach(c => {
    if (c.estado === 'cancelada') return;
    const hora = Math.floor(c.hora_inicio / 60);
    const bloque = `${hora}:00`;
    if (!conteo[bloque]) conteo[bloque] = 0;
    conteo[bloque]++;
  });

  const ranking = Object.entries(conteo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!ranking.length) {
    list.innerHTML = '<p class="stats-empty">Sin datos aún</p>';
    return;
  }

  list.innerHTML = ranking.map(([hora, veces], i) => {
    const horaNum = parseInt(hora);
    const period = horaNum >= 12 ? 'p.m.' : 'a.m.';
    let h12 = horaNum % 12;
    if (h12 === 0) h12 = 12;
    return `
      <div class="ranking-item">
        <div class="ranking-position">${i + 1}</div>
        <div class="ranking-info">
          <strong>${h12}:00 ${period}</strong>
          <span>${veces} ${veces === 1 ? 'cita' : 'citas'}</span>
        </div>
      </div>
    `;
  }).join('');
}
// ========== FIN ESTADÍSTICAS ==========

setInterval(() => { loadNotificaciones(); loadCitas(); }, 60000);

init();
